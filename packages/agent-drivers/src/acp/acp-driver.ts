/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * ACPAgentClient.fetchCatalog in packages/server/src/server/agent/providers/acp-agent.ts (starts a temporary process, session/new, reads the model table, shuts it down) and PROBE_ENV; resolveCursorCatalogModels / fetchCursorModelCatalog in cursor-acp-agent.ts (`cursor/list_available_models`); the generic Driver assembly in generic-acp-agent.ts.
 * Changed to CucCut's DriverProbe: when login is required (-32000), it reports signed-out; the model table is cached per version for 10 minutes.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import { nowIso, driverAvailability, refOf, type DriverModel, type DriverProbe, type DriverState } from '@cuccut/protocol';
import { DriversAcp, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import type { AgentDriver, AgentSession, CreateSessionOptions, DriverDescription, Logger, ProbeOptions } from '@cuccut/harness';
import { refField, textOf, type DriverText } from '../driver-text.ts';
import { compareVersions } from '../login-shell.ts';
import { acpAt, locateAcp, type AcpInstall } from './acp-binary.ts';
import { AcpProcess, acpErrorMessage, isAuthRequired, withTimeout } from './acp-connection.ts';
import { deriveModels, type AcpSessionState } from './acp-items.ts';
import {
  ACP_ENV,
  ACP_PRESETS,
  ACP_SHARED_VERIFIED,
  loginAdvice,
  type AcpDriverId,
  type AcpPreset,
  type BuiltinAcpDriverId,
} from './acp-presets.ts';
import { AcpSession, acpCapabilities, agentError } from './acp-session.ts';

/** Model table cache: a result is kept for 10 minutes; if signed out or on error, retry after 1 minute (no need to wait long after logging in or upgrading). */
const CATALOG_TTL_MS = 10 * 60_000;
const CATALOG_RETRY_MS = 60_000;

interface AcpCatalog {
  state: 'ready' | 'signed-out' | 'error';
  /** For signed-out, this is the Agent's original wording; for error, it is an explanation written by CucCut. */
  detail: DriverText | null;
  models: DriverModel[];
  capabilities: DriverProbe['capabilities'];
}

export interface AcpDriverOptions {
  /**
   * Finds the executable. By default it looks in `CUCCUT_<ID>_PATH`, the login shell's PATH and known install locations (`locateAcp`).
   * Tests inject a fake agent, which does not read the login shell and does not touch the real command on this machine.
   */
  locate?: () => Promise<AcpInstall | null>;
  /** Overall time limit for a probe (starting the process, initializing, creating a session, fetching the model table); default 30 seconds (Gemini CLI takes more than ten seconds to cold start). */
  probeTimeoutMs?: number;
  /** Whether a session can be opened; if not given, takes the preset's `verified`, and if the preset does not give one either, `ACP_SHARED_VERIFIED`. */
  verified?: boolean;
}

/**
 * A Driver connected through the Agent Client Protocol (architecture design §3.1): one implementation, where the preset (GitHub Copilot, Gemini CLI, Cursor Agent, Grok, Kimi Code, and user-added agents) determines how it is found, started and logged in. Each session has one agent process.
 *
 * The shared implementation has run a full session on a real machine through the claude-code-acp adapter (new session, approval, follow-up, interrupt, resume; §3.11 D08, `ACP_SHARED_VERIFIED`): presets and user-added agents default to `verified`. Whether each agent itself has been tested on CucCut is given by the preset's `tested`.
 */
export class AcpDriver implements AgentDriver {
  readonly id: AcpDriverId;
  /** Whether a session can be opened (architecture design §3.11 D08): the constructor argument first, then the preset, default `ACP_SHARED_VERIFIED`. */
  readonly verified: boolean;
  /** Whether this vendor has run a full session on a real machine in CucCut: takes the preset's `tested`; false if not given. */
  readonly tested: boolean;
  /** The probe starts the agent process (cold start can take more than ten seconds): `agents.list` does not wait for it, and does not make a "cheap correction" (§3.11). */
  readonly slowProbe = true;
  readonly preset: AcpPreset;
  readonly #log: Logger;
  readonly #locate: () => Promise<AcpInstall | null>;
  readonly #probeTimeoutMs: number;
  readonly #catalogs = new Map<string, { at: number; ttl: number; result: Promise<AcpCatalog> }>();

  constructor(preset: AcpPreset | BuiltinAcpDriverId, log: Logger, options: AcpDriverOptions = {}) {
    this.preset = typeof preset === 'string' ? ACP_PRESETS[preset] : preset;
    this.id = this.preset.id;
    this.verified = options.verified ?? this.preset.verified ?? ACP_SHARED_VERIFIED;
    this.tested = this.preset.tested ?? false;
    this.#log = log.child(this.id);
    this.#locate = options.locate ?? (() => locateAcp(this.preset));
    this.#probeTimeoutMs = options.probeTimeoutMs ?? 30_000;
  }

  /**
   * Constant part. Capabilities (`capabilities`) actually come from the agent's `initialize` response and are facts about this machine; the probe cache does not store them. When read back from the disk cache, the conservative values here are used first (`acpCapabilities(null)`); the background probe after startup then replaces them with the real ones. Sessions opened before that follow the `initialize` response (`AcpSession.capabilities`); only the check before sending an image may refuse once because of the conservative value.
   */
  describe(): DriverDescription {
    const preset = this.preset;
    return {
      id: this.id,
      name: preset.name,
      command: preset.command,
      minVersion: preset.minVersion ?? '',
      plan: preset.plan ? String(preset.plan) : '',
      ...(preset.plan ? { planRef: refOf(preset.plan) } : {}),
      loginCommand: preset.loginCommand,
      install: preset.install ?? [],
      verified: this.verified,
      tested: this.tested,
      capabilities: acpCapabilities(null),
    };
  }

  async probe(options: ProbeOptions = {}): Promise<DriverProbe> {
    const preset = this.preset;
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
        ? DriversCommon.executableMissing({ command: preset.command, path: options.executable })
        : DriversCommon.commandMissing({ command: preset.command, hint: preset.installHint ?? DriversCommon.installItFirst() });
      return result('not-installed', detail);
    }
    const realExecutable = await fs.realpath(install.command).catch(() => null);
    // No minimum version (user-added agents): the version is not checked; the ACP-mode probe starts directly.
    if (preset.minVersion !== null) {
      if (!install.version) return result('error', DriversCommon.versionFailed({ command: install.command }), { realExecutable });
      if (compareVersions(install.version, preset.minVersion) < 0) {
        return result('outdated', DriversCommon.outdated({ name: preset.name, version: install.version, min: preset.minVersion }), {
          realExecutable,
        });
      }
    }
    const catalog = await this.#catalog(install, options.force === true);
    const extra: Partial<DriverProbe> = { realExecutable, models: catalog.models, capabilities: catalog.capabilities };
    if (catalog.state === 'signed-out') {
      const login = preset.loginHint || preset.loginCommand ? loginAdvice(preset) : DriversAcp.loginPerInstructions();
      return result('signed-out', DriversAcp.signedOut({ name: preset.name, login, detail: catalog.detail ?? '' }), extra);
    }
    if (catalog.state === 'error') return result('error', catalog.detail, extra);
    return result('ready', null, extra);
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const install = await this.#find(options.executable);
    if (!install) throw agentError('driver-unavailable', DriversCommon.commandNotFound({ command: this.preset.command }), 'AGENT_NOT_INSTALLED');
    return AcpSession.start(install, this.preset, options, this.#log);
  }

  #find(executable: string | null | undefined): Promise<AcpInstall | null> {
    return executable ? acpAt(executable, { readVersion: this.preset.minVersion !== null }) : this.#locate();
  }

  /**
   * The model table and login status are cached by "which command, which version"; concurrent probes share a single fetch. `force` (re-detect, after installation finishes, correction after an error) does not use the cache and really starts a process: after logging in in the terminal and clicking "re-detect", it must not still get a signed-out from within the last 10 minutes. The newly fetched result is still recorded for later sharing.
   * This cache layer does not conflict with the Driver registry cache (§3.11): the registry only decides when `probe()` is called; here we only avoid starting processes repeatedly within a short time.
   */
  #catalog(install: AcpInstall, force: boolean): Promise<AcpCatalog> {
    const key = `${install.command}\0${install.version ?? ''}`;
    const hit = this.#catalogs.get(key);
    if (!force && hit && Date.now() - hit.at < hit.ttl) return hit.result;
    const entry: { at: number; ttl: number; result: Promise<AcpCatalog> } = {
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

  /**
   * Starts a temporary process: `initialize`, `session/new` (no MCP connection, no model call), reads the model table, then shuts it down.
   * Does not open a browser (`NO_BROWSER`): an agent that is not logged in returns -32000 on `session/new` and is recorded as signed-out.
   */
  async #readCatalog(install: AcpInstall): Promise<AcpCatalog> {
    const preset = this.preset;
    let proc: AcpProcess | null = null;
    let done = false;
    let capabilities = acpCapabilities(null);
    const run = async (): Promise<AcpCatalog> => {
      const started = await AcpProcess.start({
        command: install.command,
        args: preset.args,
        cwd: os.homedir(),
        env: { ...install.env, ...preset.env, ...ACP_ENV },
        log: this.#log,
        label: preset.name,
        client: {
          requestPermission: () => ({ outcome: { outcome: 'cancelled' } }),
          sessionUpdate: () => undefined,
        },
        initTimeoutMs: this.#probeTimeoutMs,
      });
      // A process that starts after the timeout: nobody is waiting for it, so shut it down.
      if (done) {
        await started.close();
        throw new Error('probe timed out');
      }
      proc = started;
      const caps = proc.init.agentCapabilities;
      capabilities = acpCapabilities(caps);
      const session = await proc.connection.newSession({ cwd: os.homedir(), mcpServers: [] });
      let models = deriveModels(session as AcpSessionState);
      if (preset.models === 'cursor') models = (await this.#cursorModels(proc, models)) ?? models;
      if (caps?.sessionCapabilities?.close) {
        await withTimeout(proc.connection.closeSession({ sessionId: session.sessionId }), 2000, 'session/close timed out').catch(
          () => undefined,
        );
      }
      return { state: 'ready', detail: null, models, capabilities };
    };
    try {
      const running = run();
      // It can still fail after the timeout (the process is shut down): by then nobody is waiting for it.
      running.catch(() => undefined);
      return await withTimeout(
        running,
        this.#probeTimeoutMs,
        String(DriversAcp.probeTimeout({ name: preset.name, seconds: Math.round(this.#probeTimeoutMs / 1000) })),
      );
    } catch (error) {
      if (isAuthRequired(error)) return { state: 'signed-out', detail: acpErrorMessage(error), models: [], capabilities };
      this.#log.warn('ACP probe failed', { error: acpErrorMessage(error) });
      return { state: 'error', detail: DriversAcp.acpModeFailed({ name: preset.name, error: acpErrorMessage(error) }), models: [], capabilities };
    } finally {
      done = true;
      await (proc as AcpProcess | null)?.close();
    }
  }

  /**
   * Cursor's model table goes through the extension method `cursor/list_available_models` (switching the model in a session changes its global preference, so the probe cannot try them one by one). If it cannot be fetched, falls back to the models in the `session/new` response.
   */
  async #cursorModels(proc: AcpProcess, fallback: DriverModel[]): Promise<DriverModel[] | null> {
    try {
      const res = (await proc.connection.extMethod('cursor/list_available_models', {})) as { models?: unknown };
      if (!Array.isArray(res.models)) return null;
      const current = fallback.find((m) => m.isDefault)?.id ?? null;
      return res.models
        .filter((m): m is { value: string; name?: string } => !!m && typeof (m as { value?: unknown }).value === 'string')
        .map((m) => ({
          id: m.value,
          label: typeof m.name === 'string' && m.name ? m.name : m.value,
          description: null,
          tier: null,
          isDefault: m.value === current,
          efforts: [],
          defaultEffort: null,
        }));
    } catch (error) {
      this.#log.debug('cursor/list_available_models unavailable', { error: acpErrorMessage(error) });
      return null;
    }
  }
}

/** One Driver for each built-in ACP preset, in the order of `BUILTIN_DRIVER_IDS`. */
export function acpDrivers(log: Logger): AcpDriver[] {
  return (['copilot', 'gemini', 'cursor', 'grok', 'kimi'] as const).map((id) => new AcpDriver(id, log));
}
