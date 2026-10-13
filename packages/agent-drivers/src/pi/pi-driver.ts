/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * the model catalog in packages/server/src/server/agent/providers/pi/agent.ts (start a `pi --mode rpc`, get_available_models,
 * read the current model, shut it down). Changed to CucCut's DriverProbe: login state is judged by whether the available model table is empty; the model table is cached for 10 minutes, keyed by command and version; protocol paths that have been verified are marked `verified: true`, and `tested: false` is recorded separately (not yet run with a real model account).
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import { driverAvailability, nowIso, refOf, type DriverModel, type DriverProbe, type DriverState } from '@cuccut/protocol';
import type { AgentDriver, AgentSession, CreateSessionOptions, DriverDescription, Logger, ProbeOptions } from '@cuccut/harness';
import { DriversCommon, DriversPi } from '@cuccut/protocol/messages/agent-drivers';
import { agentError } from '../acp/acp-session.ts';
import { refField, textOf, type DriverText } from '../driver-text.ts';
import { compareVersions } from '../login-shell.ts';
import { locatePi, PI_ENV, piAt, type PiInstall } from './pi-binary.ts';
import { derivePiModels, type PiModel } from './pi-models.ts';
import { PiRpcProcess, piErrorMessage } from './pi-rpc-process.ts';
import { PI_CAPABILITIES, PI_DRIVER_ID, PiSession } from './pi-session.ts';

/** Model table cache: kept for 10 minutes when obtained; if not logged in or on error, retry after 1 minute. */
const CATALOG_TTL_MS = 10 * 60_000;
const CATALOG_RETRY_MS = 60_000;

/**
 * Minimum version. The latest-appearing command used is clear_queue (pi 0.84.4, see paseo's compatibility notes). steer and agent_settled have fallbacks:
 * report unsupported when the reply is “Unknown command”, and finish on agent_end when agent_settled is absent. Only tested in practice on 1.0.4.
 * The 0.62.0 in the prototype is a demo value and was not adopted.
 */
export const PI_MIN_VERSION = '0.84.4';

interface PiCatalog {
  state: 'ready' | 'signed-out' | 'error';
  detail: DriverText | null;
  models: DriverModel[];
}

export interface PiDriverOptions {
  /** Find the executable. By default searches via `CUCCUT_PI_PATH`, the login shell's PATH, and common install locations. Tests inject a fake pi. */
  locate?: () => Promise<PiInstall | null>;
  /** Total time limit for the probe (starting the process and fetching the model table), default 30 seconds (measured: the first catalog fetch with an API key takes about ten-odd seconds). */
  probeTimeoutMs?: number;
}

/**
 * Pi (`@earendil-works/pi-coding-agent`): connected through the JSON line protocol of `pi --mode rpc` (architecture design §3.1). One pi process per session.
 *
 * Openness level (D08): the protocol path between the Driver and pi has been run end to end with the real pi 1.0.4 and a scripted model service (write, edit, command, read, steer, interrupt, resume, MCP and developer instructions). Following the rule “open once the protocol path is verified”, `verified` is true. It has not yet been run in CucCut with a real model account, so `tested` is false.
 * There is no approval channel (`approvals: false`), so it only suits “full access”.
 */
export class PiDriver implements AgentDriver {
  readonly id = PI_DRIVER_ID;
  /** The protocol path has been verified with the real pi and a scripted model service (D08 in architecture design §3.11): sessions may be opened. */
  readonly verified = true;
  /** Not yet run with a real model account in CucCut: sessions can be opened, and the UI shows “not tested in CucCut”. */
  readonly tested = false;
  /** The probe starts a `pi --mode rpc` process to fetch the model table (the first fetch with an API key takes about ten-odd seconds). `agents.list` does not wait for it (§3.11). */
  readonly slowProbe = true;
  readonly #log: Logger;
  readonly #locate: () => Promise<PiInstall | null>;
  readonly #probeTimeoutMs: number;
  readonly #catalogs = new Map<string, { at: number; ttl: number; result: Promise<PiCatalog> }>();

  constructor(log: Logger, options: PiDriverOptions = {}) {
    this.#log = log.child('pi');
    this.#locate = options.locate ?? locatePi;
    this.#probeTimeoutMs = options.probeTimeoutMs ?? 30_000;
  }

  describe(): DriverDescription {
    return {
      id: this.id,
      name: 'Pi',
      command: 'pi',
      minVersion: PI_MIN_VERSION,
      plan: String(DriversPi.plan()),
      planRef: refOf(DriversPi.plan()),
      loginCommand: 'pi',
      install: [
        {
          kind: 'npm',
          label: 'npm',
          needs: 'Node.js',
          command: 'npm install -g @earendil-works/pi-coding-agent',
          upgrade: 'npm install -g @earendil-works/pi-coding-agent@latest',
        },
      ],
      verified: this.verified,
      tested: this.tested,
      capabilities: PI_CAPABILITIES,
    };
  }

  async probe(options: ProbeOptions = {}): Promise<DriverProbe> {
    const install = await this.#find(options.executable);
    const base = {
      ...this.describe(),
      latestVersion: null,
      account: null,
      models: [],
      configModel: null,
      configModelKnown: null,
      checkedAt: nowIso(),
    };
    const result = (state: Exclude<DriverState, 'disabled'>, detail: DriverText | null, extra: Partial<DriverProbe> = {}): DriverProbe => ({
      ...base,
      version: install?.version ?? null,
      executable: install?.command ?? options.executable ?? null,
      realExecutable: null,
      ...extra,
      state,
      ...driverAvailability(state),
      detail: textOf(detail),
      ...refField('detailRef', detail),
    });
    if (!install) {
      const detail = options.executable
        ? DriversCommon.executableMissing({ command: 'pi', path: options.executable })
        : DriversCommon.commandMissing({ command: 'pi', hint: DriversPi.installHint() });
      return result('not-installed', detail);
    }
    const realExecutable = await fs.realpath(install.command).catch(() => null);
    if (!install.version) return result('error', DriversCommon.versionFailed({ command: install.command }), { realExecutable });
    if (compareVersions(install.version, PI_MIN_VERSION) < 0) {
      return result('outdated', DriversCommon.outdated({ name: 'Pi', version: install.version, min: PI_MIN_VERSION }), { realExecutable });
    }
    const catalog = await this.#catalog(install, options.force === true);
    const extra: Partial<DriverProbe> = { realExecutable, models: catalog.models };
    if (catalog.state === 'signed-out') return result('signed-out', catalog.detail, extra);
    if (catalog.state === 'error') return result('error', catalog.detail, extra);
    return result('ready', null, extra);
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const install = await this.#find(options.executable);
    if (!install) throw agentError('driver-unavailable', DriversCommon.commandNotFound({ command: 'pi' }), 'AGENT_NOT_INSTALLED');
    return PiSession.start(install, options, this.#log);
  }

  #find(executable: string | null | undefined): Promise<PiInstall | null> {
    return executable ? piAt(executable) : this.#locate();
  }

  /** Model table and login state, cached by “which command, which version”. Concurrent probes share one fetch; `force` skips the cache. */
  #catalog(install: PiInstall, force: boolean): Promise<PiCatalog> {
    const key = `${install.command}\0${install.version ?? ''}`;
    const hit = this.#catalogs.get(key);
    if (!force && hit && Date.now() - hit.at < hit.ttl) return hit.result;
    const entry: { at: number; ttl: number; result: Promise<PiCatalog> } = { at: Date.now(), ttl: CATALOG_TTL_MS, result: null as never };
    entry.result = this.#readCatalog(install).then((catalog) => {
      if (catalog.state !== 'ready') entry.ttl = CATALOG_RETRY_MS;
      return catalog;
    });
    this.#catalogs.set(key, entry);
    return entry.result;
  }

  /**
   * Start a temporary `pi --mode rpc --no-session` (in the home directory, writes no session file): get_available_models and get_state, then shut it down. Does not call a model.
   *
   * Login state: pi's get_available_models lists only models with usable credentials (subscription login via `/login`, keys in auth.json, API keys in environment variables, and custom services in models.json all count). If there are none, you are not logged in. Whether `~/.pi/agent/auth.json` exists is not checked: pi creates an empty file containing `{}` on every start, so its existence does not mean logged in. The probe also does not read the contents of the credentials file (architecture design §3.11).
   */
  async #readCatalog(install: PiInstall): Promise<PiCatalog> {
    const proc = new PiRpcProcess(
      { command: install.command, args: ['--mode', 'rpc', '--no-session'], cwd: os.homedir(), env: { ...install.env, ...PI_ENV } },
      this.#log,
    );
    const timeout = this.#probeTimeoutMs;
    try {
      const [available, state] = await Promise.all([
        proc.request({ type: 'get_available_models' }, timeout),
        proc.request({ type: 'get_state' }, timeout).catch(() => null),
      ]);
      const raw = (available as { models?: unknown } | null)?.models;
      const list = Array.isArray(raw) ? (raw as PiModel[]) : [];
      const current = ((state as { model?: PiModel | null } | null)?.model ?? null) as PiModel | null;
      const models = derivePiModels(list, current);
      if (!models.length) {
        return {
          state: 'signed-out',
          detail: DriversPi.signedOut(),
          models: [],
        };
      }
      return { state: 'ready', detail: null, models };
    } catch (error) {
      this.#log.warn('Pi probe failed', { error: piErrorMessage(error) });
      return { state: 'error', detail: DriversPi.rpcFailed({ error: piErrorMessage(error) }), models: [] };
    } finally {
      await proc.close();
    }
  }
}
