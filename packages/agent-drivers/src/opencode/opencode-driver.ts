/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra). Modified:
 * the version check from packages/server/src/server/agent/providers/opencode/runtime-client.ts (1.x uses the old interface, v2 from 2.0.10 on),
 * and OpenCodeV2AgentClient in v2/agent.ts (fetchCatalog starts a serve to read the model table; createSession / resumeSession).
 * Changed to CucCut's DriverProbe: accepts only 2.x, and 1.x reports the version as too old. Having no account still counts as ready (OpenCode Zen's free models need no login).
 * The model table is cached per version for 10 minutes. It passed integration acceptance on a real machine (opencode 2.0.24) with a free model, and is marked `verified: true`.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import { nowIso, driverAvailability, refOf, type DriverId, type DriverModel, type DriverProbe, type DriverState } from '@cuccut/protocol';
import type { AgentDriver, AgentSession, CreateSessionOptions, DriverDescription, Logger, ProbeOptions } from '@cuccut/harness';
import { DriversCommon, DriversOpencode } from '@cuccut/protocol/messages/agent-drivers';
import { refField, textOf, type DriverText } from '../driver-text.ts';
import { compareVersions } from '../login-shell.ts';
import { agentError } from '../acp/acp-session.ts';
import { locateOpenCode, majorVersion, openCodeAt, type OpenCodeInstall } from './opencode-binary.ts';
import { readCatalog } from './opencode-models.ts';
import { OPENCODE_PRESET } from './opencode-preset.ts';
import { OpenCodeServer } from './opencode-server.ts';
import { OPENCODE_DRIVER_ID, OpenCodeSession, openCodeCapabilities } from './opencode-session.ts';

/** Model table cache: a result is kept for 10 minutes; after an error, retry after 1 minute. */
const CATALOG_TTL_MS = 10 * 60_000;
const CATALOG_RETRY_MS = 60_000;

interface OpenCodeCatalogResult {
  state: 'ready' | 'error';
  detail: DriverText | null;
  models: DriverModel[];
  account: string | null;
}

export interface OpenCodeDriverOptions {
  /** Finds the executable. By default looks in `CUCCUT_OPENCODE_PATH`, the login shell PATH, and known install locations. Tests inject a fake opencode. */
  locate?: () => Promise<OpenCodeInstall | null>;
  /** Time limit for the probe (starting serve, reading the model table) and for opening a session; default 30 seconds. */
  timeoutMs?: number;
}

/**
 * The OpenCode (2.x) Driver (architecture design §3.1): starts one `opencode serve` per session and drives it through its v2 HTTP API and event stream.
 *
 * Verified on a real machine (opencode 2.0.24) with a free model for edit approval, rejection, interruption, resume, and image turns (D08): `verified` is true.
 */
export class OpenCodeDriver implements AgentDriver {
  readonly id: DriverId = OPENCODE_DRIVER_ID;
  /** Passed integration acceptance on a real machine with a free model (architecture design §3.11, D08). */
  readonly verified = true;
  /** A full session has been run end to end in CucCut with a real opencode. */
  readonly tested = true;
  /** The probe starts an `opencode serve` to read the model table. `agents.list` does not wait for it, and there is no "cheap correction" (§3.11). */
  readonly slowProbe = true;
  readonly #log: Logger;
  readonly #locate: () => Promise<OpenCodeInstall | null>;
  readonly #timeoutMs: number;
  readonly #catalogs = new Map<string, { at: number; ttl: number; result: Promise<OpenCodeCatalogResult> }>();

  constructor(log: Logger, options: OpenCodeDriverOptions = {}) {
    this.#log = log.child('opencode');
    this.#locate = options.locate ?? locateOpenCode;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  describe(): DriverDescription {
    return {
      id: this.id,
      name: OPENCODE_PRESET.name,
      command: OPENCODE_PRESET.command,
      minVersion: OPENCODE_PRESET.minVersion,
      plan: String(OPENCODE_PRESET.plan),
      planRef: refOf(OPENCODE_PRESET.plan),
      loginCommand: OPENCODE_PRESET.loginCommand,
      install: [...OPENCODE_PRESET.install],
      verified: this.verified,
      tested: this.tested,
      capabilities: openCodeCapabilities(),
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
        ? DriversCommon.executableMissing({ command: 'opencode', path: options.executable })
        : DriversCommon.commandMissing({ command: 'opencode', hint: OPENCODE_PRESET.installHint });
      return result('not-installed', detail);
    }
    const realExecutable = await fs.realpath(install.command).catch(() => null);
    if (!install.version) return result('error', DriversCommon.versionFailed({ command: install.command }), { realExecutable });
    if (majorVersion(install.version) !== 2 || compareVersions(install.version, OPENCODE_PRESET.minVersion) < 0) {
      const newer = (majorVersion(install.version) ?? 0) > 2;
      return result(
        'outdated',
        newer
          ? DriversOpencode.unsupportedMajor({ version: install.version })
          : DriversOpencode.tooOld({ version: install.version, min: OPENCODE_PRESET.minVersion, command: OPENCODE_PRESET.install[0]!.command }),
        { realExecutable },
      );
    }
    const catalog = await this.#catalog(install, options.force === true);
    const extra: Partial<DriverProbe> = { realExecutable, models: catalog.models, account: catalog.account };
    if (catalog.state === 'error') return result('error', catalog.detail, extra);
    return result('ready', catalog.detail, extra);
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const install = await this.#find(options.executable);
    if (!install) throw agentError('driver-unavailable', DriversCommon.commandNotFound({ command: 'opencode' }), 'AGENT_NOT_INSTALLED');
    if (!install.version || majorVersion(install.version) !== 2 || compareVersions(install.version, OPENCODE_PRESET.minVersion) < 0) {
      throw agentError(
        'driver-unavailable',
        DriversOpencode.unsupportedVersion({ version: install.version ?? DriversOpencode.versionUnknown(), min: OPENCODE_PRESET.minVersion }),
        null,
      );
    }
    return OpenCodeSession.start(install, options, this.#log, this.#timeoutMs);
  }

  #find(executable: string | null | undefined): Promise<OpenCodeInstall | null> {
    return executable ? openCodeAt(executable) : this.#locate();
  }

  /** Model table, cached by "which command, which version"; concurrent probes share one fetch; `force` skips the cache. */
  #catalog(install: OpenCodeInstall, force: boolean): Promise<OpenCodeCatalogResult> {
    const key = `${install.command}\0${install.version ?? ''}`;
    const hit = this.#catalogs.get(key);
    if (!force && hit && Date.now() - hit.at < hit.ttl) return hit.result;
    const entry: { at: number; ttl: number; result: Promise<OpenCodeCatalogResult> } = {
      at: Date.now(),
      ttl: CATALOG_TTL_MS,
      result: Promise.resolve() as never,
    };
    entry.result = this.#readCatalog(install).then((catalog) => {
      if (catalog.state !== 'ready') entry.ttl = CATALOG_RETRY_MS;
      return catalog;
    });
    this.#catalogs.set(key, entry);
    return entry.result;
  }

  /** Starts a temporary serve, reads the model table and the enabled providers under the user's home directory, then shuts it down. Creates no session and calls no model. */
  async #readCatalog(install: OpenCodeInstall): Promise<OpenCodeCatalogResult> {
    let server: OpenCodeServer | null = null;
    try {
      server = await OpenCodeServer.start({
        command: install.command,
        env: install.env,
        cwd: os.homedir(),
        log: this.#log,
        startupTimeoutMs: this.#timeoutMs,
      });
      const catalog = await readCatalog(server, os.homedir());
      // Works without an account: OpenCode ships free OpenCode Zen models that need no login. State this honestly; do not report "not logged in".
      const detail = catalog.account
        ? null
        : DriversOpencode.noModelAccount({ command: OPENCODE_PRESET.loginCommand });
      return { state: 'ready', detail, models: catalog.models, account: catalog.account };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#log.warn('OpenCode probe failed', { error: message });
      return { state: 'error', detail: DriversOpencode.probeFailed({ error: message }), models: [], account: null };
    } finally {
      await server?.close();
    }
  }
}
