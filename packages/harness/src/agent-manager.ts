import {
  RpcError,
  driverAvailability,
  nowIso,
  refOf,
  type CustomAgentProviderView,
  type DriverId,
  type DriverProbe,
  type Id,
} from '@cuccut/protocol';
import { HarnessAgents as HA } from '@cuccut/protocol/messages/harness';
import { driverProbeFacts, type AgentProbeStore, type StoredDriverProbes } from '@cuccut/runtime-storage';
import type {
  AgentDriver,
  AgentEvent,
  AgentPersistenceHandle,
  AgentSession,
  AgentToolAccess,
  DriverDescription,
  ToolGrant,
  TurnSettings,
} from './driver.ts';
import { silentLogger, type Logger } from './logger.ts';

export interface DriverRefreshOptions {
  /** Does not use the Driver's own cache (`ProbeOptions.force`), and does not share a run with an in-progress non-forced probe. */
  force?: boolean;
  /** Why probing (written to the log): startup, detect, configure, setup, list, stale, correction… */
  reason: string;
}

interface InflightProbe {
  /** On return, uses this to recognize whether it is still this Driver's current probe: if it was superseded by a forced probe or a replaced executable, the result is discarded. */
  token: object;
  force: boolean;
  promise: Promise<DriverProbe>;
}

/**
 * Driver registry (architecture design §3.1, §3.11). `AgentDriver` and `ModelProvider` are registered separately.
 *
 * Probe results are cached per Driver, with no expiry (§3.11):
 * - At startup, the disk cache (`store/agent-probes.json`, `load`) is read first, so the UI shows the last results immediately; then the Harness refreshes once in the background.
 * - Each Driver probes independently and writes its own result: as each one finishes, it is written to the cache, saved to disk, and notified (`onChange`); slow ones (ACP cold starts) don't hold up fast ones;
 *   a probe that throws is recorded as an `error` result without clearing other Drivers. Concurrent refresh requests for the same Driver share one probe.
 * - Re-probing happens only at these times: startup, "re-detect", executable changed, after installation finishes, a runtime error indicating the cache is stale (the Harness decides), plus the cheap correction in `recheckStale` and on-demand probing by `current`.
 *
 * The registry is dynamic: ACP agents added by the user (`agents.addProvider`) are registered at runtime and unregistered on removal (`unregister`), along with their results, in-progress probes, and cache entries. Drivers registered with `custom` (their config summary) are user-added; the rest are built-in.
 */
export class DriverRegistry {
  readonly #drivers = new Map<DriverId, AgentDriver>();
  readonly #custom = new Map<DriverId, CustomAgentProviderView>();
  readonly #executables = new Map<DriverId, string>();
  readonly #results = new Map<DriverId, DriverProbe>();
  readonly #inflight = new Map<DriverId, InflightProbe>();
  readonly #listeners = new Set<(id: DriverId) => void>();
  #store: AgentProbeStore | null = null;
  #log: Logger = silentLogger;
  #closed = false;

  /** Registers (or replaces) a Driver. `custom`: config summary of a user-added agent; if not given, the Driver is built-in. */
  register(driver: AgentDriver, options: { custom?: CustomAgentProviderView } = {}): void {
    this.#drivers.set(driver.id, driver);
    if (options.custom) this.#custom.set(driver.id, structuredClone(options.custom));
    else this.#custom.delete(driver.id);
    this.#results.delete(driver.id);
    this.#inflight.delete(driver.id);
  }

  /**
   * Unregisters a Driver: drops its results and executable, cancels any in-progress probe (its result won't be written when it returns), and immediately deletes its entries from the probe cache file. Returns whether it was registered. Preferences and sessions are handled by the Harness.
   */
  unregister(id: DriverId): boolean {
    if (!this.#drivers.delete(id)) return false;
    this.#custom.delete(id);
    this.#executables.delete(id);
    this.#results.delete(id);
    this.#inflight.delete(id);
    if (!this.#closed) this.#persist();
    return true;
  }

  has(id: DriverId): boolean {
    return this.#drivers.has(id);
  }

  /** Config summary of a user-added agent; null for built-in ones or ones not registered. */
  custom(id: DriverId): CustomAgentProviderView | null {
    const found = this.#custom.get(id);
    return found ? structuredClone(found) : null;
  }

  /**
   * Executable manually specified by the user (Settings › Advanced). Used by probes and new sessions. When it changes, this Driver's results are dropped (they belong to another executable) and any in-progress probe is cancelled; the caller initiates re-probing. Returns whether it actually changed.
   */
  setExecutable(id: DriverId, executable: string | null): boolean {
    if ((this.#executables.get(id) ?? null) === executable) return false;
    if (executable) this.#executables.set(id, executable);
    else this.#executables.delete(id);
    this.#results.delete(id);
    this.#inflight.delete(id);
    return true;
  }

  executable(id: DriverId): string | null {
    return this.#executables.get(id) ?? null;
  }

  ids(): DriverId[] {
    return [...this.#drivers.keys()];
  }

  get(id: DriverId): AgentDriver {
    const driver = this.#drivers.get(id);
    if (!driver) throw new RpcError('driver-unavailable', HA.noDriver({ id }));
    return driver;
  }

  /**
   * Reads the disk cache as each Driver's initial results. Set the executable first before calling: entries whose probe-time executable doesn't match the current one are dropped; entries for unregistered Drivers and Drivers without `describe()` are ignored; a corrupt file counts as no cache. Each later probe completion writes back to this file.
   */
  async load(store: AgentProbeStore, log: Logger = silentLogger): Promise<void> {
    this.#store = store;
    this.#log = log;
    const stored = await store.load().catch((error: unknown) => {
      log.warn('Failed to read the Agent probe cache; continuing without it', { error: String(error) });
      return {} as StoredDriverProbes;
    });
    for (const [id, entry] of Object.entries(stored) as [DriverId, NonNullable<StoredDriverProbes[DriverId]>][]) {
      const driver = this.#drivers.get(id);
      if (!driver?.describe || this.#results.has(id) || this.#inflight.has(id)) continue;
      const { executableOverride, ...facts } = entry;
      if (executableOverride !== this.executable(id)) continue;
      this.#results.set(id, { ...driver.describe(), ...facts, ...driverAvailability(facts.state), id });
    }
  }

  /** Existing probe results (including those from the disk cache), in registration order; Drivers with no result yet are not in it (see `checking`). */
  snapshot(): DriverProbe[] {
    return this.ids().flatMap((id) => this.#results.get(id) ?? []);
  }

  result(id: DriverId): DriverProbe | null {
    return this.#results.get(id) ?? null;
  }

  /** Drivers that have no result yet and are (or will be) probed for the first time. */
  checking(): DriverId[] {
    return this.ids().filter((id) => !this.#results.has(id));
  }

  /** A Driver's result changed (probe completed). */
  onChange(listener: (id: DriverId) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Re-probes these Drivers (all by default); each one is written and notified as it completes; resolves once all have finished (succeeded or recorded as error), never rejects. */
  async refresh(ids: DriverId[] = this.ids(), options: DriverRefreshOptions): Promise<void> {
    await Promise.allSettled(ids.filter((id) => this.#drivers.has(id)).map((id) => this.#probe(id, options)));
  }

  /**
   * The result for one Driver, for callers that care only about that one (agent Provider, §6.9): if within `maxAgeMs`, used directly; otherwise only that one is probed and awaited, with the result still written to the cache and notified as usual. Null if not registered.
   */
  async current(id: DriverId, maxAgeMs: number): Promise<DriverProbe | null> {
    if (!this.#drivers.has(id)) return null;
    const cached = this.#results.get(id);
    if (cached && Date.now() - Date.parse(cached.checkedAt) <= maxAgeMs) return cached;
    return this.#probe(id, { reason: 'provider' });
  }

  /**
   * Cheap correction (§3.11): for Drivers whose probe only runs fast commands like `--version` or login status, whose result is not `ready`, and which haven't been probed in over `maxAgeMs`, probe once more in the background. Drivers marked `slowProbe` (ACP, Pi, OpenCode, which spawn an agent process every time) are skipped.
   */
  recheckStale(maxAgeMs: number): void {
    for (const id of this.ids()) {
      const result = this.#results.get(id);
      if (!result || result.state === 'ready' || this.#inflight.has(id)) continue;
      if (this.#drivers.get(id)!.slowProbe === true) continue;
      if (Date.now() - Date.parse(result.checkedAt) <= maxAgeMs) continue;
      void this.#probe(id, { reason: 'stale' });
    }
  }

  /** Runtime stopping: probes completing after this point are no longer written, saved, or notified. */
  close(): void {
    this.#closed = true;
    this.#listeners.clear();
  }

  /** Waits for the last disk write to finish. */
  flush(): Promise<void> {
    return this.#store?.flush() ?? Promise.resolve();
  }

  #probe(id: DriverId, options: DriverRefreshOptions): Promise<DriverProbe> {
    const force = options.force === true;
    const running = this.#inflight.get(id);
    if (running && (running.force || !force)) return running.promise;
    const driver = this.#drivers.get(id)!;
    const executable = this.executable(id);
    const token = {};
    const startedAt = Date.now();
    const promise = Promise.resolve()
      .then(() => driver.probe({ executable, ...(force ? { force: true } : {}) }))
      .catch((error: unknown) => failedProbe(driver, executable, error))
      .then((probe) => {
        if (this.#inflight.get(id)?.token !== token) return probe;
        this.#inflight.delete(id);
        if (this.#closed) return probe;
        this.#results.set(id, probe);
        this.#log.info('Agent probe finished', { driverId: id, state: probe.state, reason: options.reason, force, ms: Date.now() - startedAt });
        this.#persist();
        for (const listener of this.#listeners) listener(id);
        return probe;
      });
    this.#inflight.set(id, { token, force, promise });
    return promise;
  }

  #persist(): void {
    const store = this.#store;
    if (!store) return;
    const drivers: StoredDriverProbes = {};
    for (const [id, probe] of this.#results) drivers[id] = { ...driverProbeFacts(probe), executableOverride: this.executable(id) };
    store.save(drivers).catch((error: unknown) => this.#log.warn('Failed to write the Agent probe cache', { error: String(error) }));
  }
}

/** A Driver's probe threw (it shouldn't): record as an `error` result, using `describe()`'s constants if they can be obtained. */
function failedProbe(driver: AgentDriver, executable: string | null, error: unknown): DriverProbe {
  const description: DriverDescription = driver.describe?.() ?? {
    id: driver.id,
    name: driver.id,
    command: driver.id,
    minVersion: '',
    plan: '',
    loginCommand: null,
    install: [],
    verified: driver.verified !== false,
    tested: driver.tested ?? driver.verified !== false,
    capabilities: { steer: false, approvals: false, resume: false, images: false },
  };
  const detail = HA.probeFailed({ error: error instanceof Error ? error.message : String(error) });
  return {
    ...description,
    id: driver.id,
    state: 'error',
    ...driverAvailability('error'),
    version: null,
    latestVersion: null,
    detail: detail.text,
    detailRef: refOf(detail),
    executable,
    realExecutable: null,
    account: null,
    models: [],
    configModel: null,
    configModelKnown: null,
    checkedAt: nowIso(),
  };
}

interface LiveSession {
  session: AgentSession;
  driverId: DriverId;
  grant: ToolGrant | null;
  unsubscribe: () => void;
}

export interface EnsureSessionOptions {
  conversationId: Id;
  driverId: DriverId;
  cwd: string;
  /** Initial settings when creating a native session; existing sessions ignore it, and per-turn settings are passed with `startTurn`. */
  settings: TurnSettings;
  resume: AgentPersistenceHandle | null;
}

/**
 * AgentManager: at most one live native session per session (architecture design §2.1 "Agent process: per session"). Access mode, model, and effort are passed to the Driver per turn, without restarting it; only when the agent is switched (for sessions with no task yet) is the old one closed.
 */
export class AgentManager {
  readonly #drivers: DriverRegistry;
  readonly #onEvent: (conversationId: Id, session: AgentSession, event: AgentEvent) => void;
  readonly #log: Logger;
  readonly #tools: AgentToolAccess | null;
  readonly #live = new Map<Id, LiveSession>();
  readonly #starting = new Map<Id, Promise<AgentSession>>();

  constructor(
    drivers: DriverRegistry,
    onEvent: (conversationId: Id, session: AgentSession, event: AgentEvent) => void,
    log: Logger,
    tools: AgentToolAccess | null = null,
  ) {
    this.#drivers = drivers;
    this.#onEvent = onEvent;
    this.#log = log.child('agents');
    this.#tools = tools;
  }

  get(conversationId: Id): AgentSession | null {
    return this.#live.get(conversationId)?.session ?? null;
  }

  async ensure(options: EnsureSessionOptions): Promise<AgentSession> {
    const pending = this.#starting.get(options.conversationId);
    if (pending) return pending;
    const live = this.#live.get(options.conversationId);
    if (live && live.driverId === options.driverId) return live.session;

    const start = (async () => {
      let resume = options.resume;
      if (live) {
        // Agent switched: the old resume handle belongs to another Agent and must not be resumed.
        resume = null;
        await this.release(options.conversationId);
      }
      if (resume && resume.driverId !== options.driverId) resume = null;
      const driver = this.#drivers.get(options.driverId);
      // Tool authorization follows the native session: revoked when the session closes (idle, process exit).
      // Additional guidance at session start (index of open skills, §3.8): if it can't be obtained, don't attach it; don't block the session.
      const extra = this.#tools?.sessionInstructions
        ? await this.#tools.sessionInstructions(options.conversationId).catch((error: unknown) => {
            this.#log.warn('Failed to read extra session instructions', { conversationId: options.conversationId, error: String(error) });
            return '';
          })
        : '';
      const grant = this.#tools?.grant(options.conversationId) ?? null;
      let session: AgentSession;
      try {
        session = await driver.createSession({
          cwd: options.cwd,
          ...options.settings,
          executable: this.#drivers.executable(options.driverId),
          resume,
          ...(this.#tools ? { developerInstructions: extra ? `${this.#tools.instructions}\n\n${extra}` : this.#tools.instructions } : {}),
          ...(grant ? { mcpServers: grant.mcpServers } : {}),
        });
      } catch (error) {
        grant?.revoke();
        throw error;
      }
      const unsubscribe = session.subscribe((event) => this.#onEvent(options.conversationId, session, event));
      this.#live.set(options.conversationId, { session, driverId: options.driverId, grant, unsubscribe });
      this.#log.info('Native session ready', { conversationId: options.conversationId, driverId: options.driverId });
      return session;
    })();
    this.#starting.set(options.conversationId, start);
    try {
      return await start;
    } finally {
      this.#starting.delete(options.conversationId);
    }
  }

  /** If the process has already exited, only the record is removed; close is not called. */
  forget(conversationId: Id, session: AgentSession): void {
    const live = this.#live.get(conversationId);
    if (live?.session !== session) return;
    live.unsubscribe();
    live.grant?.revoke();
    this.#live.delete(conversationId);
  }

  async release(conversationId: Id): Promise<void> {
    const live = this.#live.get(conversationId);
    if (!live) return;
    this.#live.delete(conversationId);
    live.unsubscribe();
    live.grant?.revoke();
    await live.session.close().catch((error) => {
      this.#log.warn('Failed to close native session', { conversationId, error: String(error) });
    });
  }

  async releaseAll(): Promise<void> {
    await Promise.allSettled([...this.#starting.values()]);
    await Promise.all([...this.#live.keys()].map((id) => this.release(id)));
  }
}
