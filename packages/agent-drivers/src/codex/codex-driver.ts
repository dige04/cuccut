import fs from 'node:fs/promises';
import { RpcError, driverAvailability, nowIso, refOf, type DriverInstallOption, type DriverProbe, type DriverState } from '@cuccut/protocol';
import type { AgentDriver, AgentSession, CreateSessionOptions, DriverDescription, Logger, ProbeOptions } from '@cuccut/harness';
import { DriversCodex, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import { refField, textOf, type DriverText } from '../driver-text.ts';
import { compareVersions } from '../login-shell.ts';
import { codexAt, locateCodex, codexAccount, readCodexLogin, type CodexInstall } from './codex-binary.ts';
import { codexHome, readCodexConfigModel } from './codex-config.ts';
import { listCodexModels, type CodexCatalog } from './codex-models.ts';
import { CODEX_CAPABILITIES, CodexSession } from './codex-session.ts';

/** Model catalog cache: a successful result is kept for 10 minutes; after a failure or an empty table, retry after 1 minute (no need to wait long after logging in or upgrading). */
const CATALOG_TTL_MS = 10 * 60_000;
const CATALOG_RETRY_MS = 60_000;

/** The version the machine protocol (`codex-protocol.ts`) is checked against; older app-server fields do not match (architecture design §6.9). */
export const CODEX_MIN_VERSION = '0.158.0';

const INSTALL: DriverInstallOption[] = [
  { kind: 'brew', label: 'Homebrew', needs: 'Homebrew', command: 'brew install codex', upgrade: 'brew upgrade codex' },
  { kind: 'npm', label: 'npm', needs: 'Node.js', command: 'npm install -g @openai/codex', upgrade: 'npm install -g @openai/codex@latest' },
];

export interface CodexDriverOptions {
  /**
   * Finds the codex executable. By default it searches `CUCCUT_CODEX_PATH`, the login shell's PATH and known install locations (`locateCodex`).
   * Tests inject a fake codex, which does not read the login shell and does not touch the real codex on this machine.
   */
  locate?: () => Promise<CodexInstall | null>;
  /** Overall time limit for fetching the model table (temporary app-server), 15 seconds by default. Tests use it to cover the case where it hangs and never responds. */
  modelListTimeoutMs?: number;
}

/**
 * Codex Driver: connects through the machine protocol of `codex app-server` (architecture design §3.1).
 * One app-server process per session (§2.1 “Agent process: per session”).
 */
export class CodexDriver implements AgentDriver {
  readonly id = 'codex' as const;
  /** A full session has been run successfully on real hardware in CucCut (D08 in §3.11). */
  readonly tested = true;
  readonly #log: Logger;
  readonly #locate: () => Promise<CodexInstall | null>;
  readonly #modelListTimeoutMs: number | undefined;
  readonly #catalogs = new Map<string, { at: number; ttl: number; result: Promise<CodexCatalog | null> }>();

  constructor(log: Logger, options: CodexDriverOptions = {}) {
    this.#log = log.child('codex');
    this.#locate = options.locate ?? locateCodex;
    this.#modelListTimeoutMs = options.modelListTimeoutMs;
  }

  describe(): DriverDescription {
    return {
      id: this.id,
      name: 'Codex',
      command: 'codex',
      minVersion: CODEX_MIN_VERSION,
      plan: String(DriversCodex.plan()),
      planRef: refOf(DriversCodex.plan()),
      loginCommand: 'codex login',
      install: INSTALL,
      // Passed integration tests, so sessions can be opened (D08 in architecture design §3.11).
      verified: true,
      tested: this.tested,
      capabilities: CODEX_CAPABILITIES,
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
        ? DriversCommon.executableMissing({ command: 'codex', path: options.executable })
        : DriversCommon.commandMissing({ command: 'codex', hint: DriversCodex.installHint() });
      return result('not-installed', detail);
    }
    const [realExecutable, configModel] = await Promise.all([
      fs.realpath(install.command).catch(() => null),
      readCodexConfigModel(install.env),
    ]);
    if (!install.version) return result('error', DriversCommon.versionFailed({ command: install.command }), { realExecutable, configModel });
    if (compareVersions(install.version, CODEX_MIN_VERSION) < 0) {
      return result('outdated', DriversCommon.outdated({ name: 'Codex', version: install.version, min: CODEX_MIN_VERSION }), { realExecutable, configModel });
    }
    // The model table is fetched even when not logged in: per the codex source (models-manager), without credentials it does not go online and falls back to the built-in table shipped with the CLI and the local cache (not tested in practice).
    const [login, catalog] = await Promise.all([readCodexLogin(install), this.#catalog(install, options.force === true)]);
    const extra: Partial<DriverProbe> = {
      realExecutable,
      models: catalog?.models ?? [],
      configModel,
      // Whether the configured model is recognized, including hidden models; when there is no config or the catalog was not obtained, it cannot be determined, and the result is null.
      configModelKnown: configModel && catalog && catalog.all.length > 0 ? catalog.all.includes(configModel) : null,
    };
    if (!login.loggedIn) {
      return result('signed-out', DriversCodex.signedOut({ detail: login.detail }), extra);
    }
    const account = codexAccount(login.detail);
    return result('ready', null, { ...extra, account: textOf(account), ...refField('accountRef', account) });
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const install = await this.#find(options.executable);
    if (!install) throw new RpcError('driver-unavailable', DriversCommon.commandNotFound({ command: 'codex' }));
    try {
      return await CodexSession.start(install, options, this.#log);
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw new RpcError('driver-failed', DriversCommon.startFailed({ name: 'Codex', error: error instanceof Error ? error.message : String(error) }));
    }
  }

  #find(executable: string | null | undefined): Promise<CodexInstall | null> {
    return executable ? codexAt(executable) : this.#locate();
  }

  /**
   * Model catalog, cached per 「which codex, which version, which config directory」; probes that arrive at the same time share one request.
   * When it cannot be obtained (timeout, error), it is null, and the probe still returns normally with `models` as an empty table. `force` (re-detect) skips the cache, and the newly fetched result is still registered for later sharing.
   */
  #catalog(install: CodexInstall, force: boolean): Promise<CodexCatalog | null> {
    const key = [install.command, install.version ?? '', codexHome(install.env)].join('\0');
    const hit = this.#catalogs.get(key);
    if (!force && hit && Date.now() - hit.at < hit.ttl) return hit.result;
    const entry = { at: Date.now(), ttl: CATALOG_TTL_MS, result: Promise.resolve<CodexCatalog | null>(null) };
    entry.result = listCodexModels(install, this.#log, this.#modelListTimeoutMs).then(
      (catalog) => {
        if (catalog.all.length === 0) entry.ttl = CATALOG_RETRY_MS;
        return catalog;
      },
      (error: unknown) => {
        this.#log.warn("Couldn't get the Codex model list", { error: error instanceof Error ? error.message : String(error) });
        entry.ttl = CATALOG_RETRY_MS;
        return null;
      },
    );
    this.#catalogs.set(key, entry);
    return entry.result;
  }
}
