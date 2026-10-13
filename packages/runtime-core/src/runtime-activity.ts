import type { RuntimeInfo, RuntimeStatus } from '@cuccut/protocol';
import type { TrustedPrincipal } from './gateway.ts';

/**
 * Whether anyone is using the Runtime (architecture design §2.2): authenticated connections on the local gateway, unfinished tasks, open external services, and HTTP requests on the same port
 * (an agent in a session calls tools through the tool bridge over HTTP and holds no WebSocket connection). `runtime.status` reports it. A Runtime started by the CLI (`--idle-exit`) exits itself through `onIdle` when it has been idle for `runtime.idleExitMinutes`.
 *
 * Connections to the web service and to external services use their own ports and are not counted; while those are open, the Runtime is not idle.
 *
 * A CLI connection does not count as in use until it sends a request other than the Runtime's status methods. A connection that only queries status (`runtime.status`, `runtime.info`, as in `cuccut runtime status`) neither resets the idle timer nor restarts it on disconnect, and the reported `idleSince` is the value from before the query.
 */

export interface ActivitySources {
  info: RuntimeInfo;
  /** Number of queued or running tasks. */
  activeJobs: () => number;
  /** IDs of the external services that are open (or opening or closing). */
  runningServices: () => string[];
}

export interface IdleExitOptions {
  /** Minutes of idle time before exit (setting `runtime.idleExitMinutes`, read at each check). */
  minutes: () => number;
  onIdle: () => void;
  /** Interval between checks (default 15 seconds). Shorter in tests. */
  checkMs?: number;
  now?: () => number;
}

const DEFAULT_CHECK_MS = 15_000;

/** Methods that only read the Runtime's own state. A CLI connection that sends only these does not count as in use. */
const PASSIVE_METHODS: ReadonlySet<string> = new Set(['runtime.status', 'runtime.info']);

type CountedKind = keyof RuntimeStatus['connections'];

export class RuntimeActivity {
  readonly #sources: ActivitySources;
  readonly #idle: IdleExitOptions | null;
  readonly #now: () => number;
  readonly #connections: Record<CountedKind, number> = { desktop: 0, cli: 0, agent: 0 };
  /** A CLI connection that has not yet sent any request other than these. */
  readonly #passive = new Set<string>();
  #idleSince: number | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #fired = false;

  constructor(sources: ActivitySources, idle: IdleExitOptions | null) {
    this.#sources = sources;
    this.#idle = idle;
    this.#now = idle?.now ?? Date.now;
  }

  /** Starts the periodic check (only when idle exit is enabled). The timer does not keep the process alive. */
  start(): void {
    if (!this.#idle || this.#timer) return;
    this.#idleSince = this.#busy() ? null : this.#now();
    this.#timer = setInterval(() => this.check(), this.#idle.checkMs ?? DEFAULT_CHECK_MS);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  connected(principal: TrustedPrincipal): void {
    if (isCounted(principal.kind)) this.#connections[principal.kind]++;
    if (principal.kind === 'cli') this.#passive.add(principal.connectionId);
    else this.#idleSince = null;
  }

  /** A request arrives on a connection (after the handshake). A CLI connection starts counting as in use when it first sends a request other than a status query. */
  requested(principal: TrustedPrincipal, method: string): void {
    if (PASSIVE_METHODS.has(method) || !this.#passive.delete(principal.connectionId)) return;
    this.#idleSince = null;
  }

  disconnected(principal: TrustedPrincipal): void {
    if (isCounted(principal.kind)) this.#connections[principal.kind] = Math.max(0, this.#connections[principal.kind] - 1);
    // A connection that only queried status does not change the idle timer, either when it arrives or when it leaves. Once an in-use connection disconnects and nothing else is busy, idle time counts from now.
    if (this.#passive.delete(principal.connectionId)) return;
    if (!this.#busy()) this.#idleSince = this.#now();
  }

  /** A request arrives (the HTTP tool bridge, the media channel): idle time is recomputed from now. */
  touch(): void {
    if (this.#idleSince !== null) this.#idleSince = this.#now();
  }

  /** Checks once: if busy, resets to zero; if idle long enough, calls `onIdle` (only once). */
  check(): void {
    if (!this.#idle || this.#fired) return;
    if (this.#busy()) {
      this.#idleSince = null;
      return;
    }
    const now = this.#now();
    this.#idleSince ??= now;
    if (now - this.#idleSince >= this.#idle.minutes() * 60_000) {
      this.#fired = true;
      this.stop();
      this.#idle.onIdle();
    }
  }

  status(): RuntimeStatus {
    const busy = this.#busy();
    return {
      info: this.#sources.info,
      connections: { ...this.#connections },
      activeJobs: this.#sources.activeJobs(),
      runningServices: this.#sources.runningServices(),
      idleExit: this.#idle
        ? {
            minutes: this.#idle.minutes(),
            idleSince: busy || this.#idleSince === null ? null : new Date(this.#idleSince).toISOString(),
          }
        : null,
    };
  }

  #busy(): boolean {
    const { desktop, cli, agent } = this.#connections;
    return desktop + cli + agent - this.#passive.size > 0 || this.#sources.activeJobs() > 0 || this.#sources.runningServices().length > 0;
  }
}

function isCounted(kind: TrustedPrincipal['kind']): kind is CountedKind {
  return kind === 'desktop' || kind === 'cli' || kind === 'agent';
}
