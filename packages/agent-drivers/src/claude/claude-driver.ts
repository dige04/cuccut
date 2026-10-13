import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RpcError, driverAvailability, nowIso, refOf, type DriverInstallOption, type DriverModel, type DriverProbe, type DriverState } from '@cuccut/protocol';
import { DriversClaude, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import type { AgentDriver, AgentSession, CreateSessionOptions, DriverDescription, Logger, ProbeOptions } from '@cuccut/harness';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { officialScript, refField, textOf, type DriverText } from '../driver-text.ts';
import { compareVersions } from '../login-shell.ts';
import { claudeAt, claudeConfigDir, locateClaude, readClaudeLogin, readClaudeSettingsModels, type ClaudeInstall } from './claude-binary.ts';
import { FALLBACK_CLAUDE_MODELS, claudeModelKnown, mapClaudeModels, withSettingsModels, type ClaudeModelEntry } from './claude-models.ts';
import { createMessageInput, sdkQueryFactory, type ClaudeQueryFactory } from './claude-query.ts';
import { ClaudeSession, claudeSettingsOptions } from './claude-session.ts';

const CAPABILITIES: DriverProbe['capabilities'] = { steer: true, approvals: true, resume: true, images: true };

/** The control protocol the SDK depends on (streaming input, `canUseTool`, `supportedModels()`) was complete only from 2.0 onward (not checked version by version; set to the SDK's requirement). */
export const CLAUDE_MIN_VERSION = '2.0.0';

/** The three install methods from the design prototype's data.js. The official script's name varies with the language, so it is fetched when used. */
const installOptions = (): DriverInstallOption[] => [
  officialScript('curl -fsSL https://claude.ai/install.sh | bash', 'claude update'),
  { kind: 'brew', label: 'Homebrew', needs: 'Homebrew', command: 'brew install --cask claude-code', upgrade: 'brew upgrade --cask claude-code' },
  { kind: 'npm', label: 'npm', needs: 'Node.js', command: 'npm install -g @anthropic-ai/claude-code', upgrade: 'npm install -g @anthropic-ai/claude-code@latest' },
];

export interface ClaudeDriverOptions {
  /**
   * Finds the claude executable. By default it looks in `CUCCUT_CLAUDE_PATH`, the login shell's PATH and common install locations (`locateClaude`).
   * Tests inject a fake claude, do not read the login shell, and do not touch the real claude on this machine.
   */
  locate?: () => Promise<ClaudeInstall | null>;
  /** The factory that starts a Query. The default is the SDK's `query()`; tests inject a fake Query (`testing/fake-claude.ts`). */
  queryFactory?: ClaudeQueryFactory;
  /** Claude Code's user settings file: reads `model` and the models in `env`. Default `$CLAUDE_CONFIG_DIR/settings.json` (`~/.claude/settings.json`). */
  settingsFile?: string;
}

/**
 * Claude Code Driver: drives the claude the user installed themselves through `@anthropic-ai/claude-agent-sdk` (architecture design §3.1).
 * One long-lived Query per session, i.e. one claude process per session (§2.1 "Agent process: per session").
 */
export class ClaudeDriver implements AgentDriver {
  readonly id = 'claude' as const;
  /** Has run a full session on a real machine in CucCut (§3.11 D08). */
  readonly tested = true;
  readonly #log: Logger;
  readonly #locate: () => Promise<ClaudeInstall | null>;
  readonly #factory: ClaudeQueryFactory;
  readonly #settingsFile: string | null;
  #models: { key: string; result: Promise<ClaudeModelEntry[] | null> } | null = null;

  constructor(log: Logger, options: ClaudeDriverOptions = {}) {
    this.#log = log.child('claude');
    this.#locate = options.locate ?? locateClaude;
    this.#factory = options.queryFactory ?? sdkQueryFactory;
    this.#settingsFile = options.settingsFile ?? null;
  }

  describe(): DriverDescription {
    return {
      id: this.id,
      name: 'Claude Code',
      command: 'claude',
      minVersion: CLAUDE_MIN_VERSION,
      plan: String(DriversClaude.plan()),
      planRef: refOf(DriversClaude.plan()),
      // Consistent with the design prototype, this uses `claude` (the first run guides login). `claude auth login` only exists in 2.1.x, and the minimum version 2.0.0 may not have it.
      loginCommand: 'claude',
      install: installOptions(),
      // Verified by integration tests: sessions can be opened (architecture design §3.11 D08).
      verified: true,
      tested: this.tested,
      capabilities: CAPABILITIES,
    };
  }

  async probe(options: ProbeOptions = {}): Promise<DriverProbe> {
    const install = await this.#find(options.executable);
    const base = {
      ...this.describe(),
      latestVersion: null,
      account: null,
      models: [] as DriverModel[],
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
        ? DriversCommon.executableMissing({ command: 'claude', path: options.executable })
        : DriversCommon.commandMissing({ command: 'claude', hint: DriversClaude.installHint() });
      return result('not-installed', detail);
    }
    const realExecutable = await fs.realpath(install.command).catch(() => null);
    if (!install.version) return result('error', DriversCommon.versionFailed({ command: install.command }), { realExecutable });
    if (compareVersions(install.version, CLAUDE_MIN_VERSION) < 0) {
      return result('outdated', DriversCommon.outdated({ name: 'Claude Code', version: install.version, min: CLAUDE_MIN_VERSION }), {
        realExecutable,
      });
    }

    const settingsFile = this.#settingsFile ?? path.join(claudeConfigDir(install.env), 'settings.json');
    const [login, models, settings] = await Promise.all([
      readClaudeLogin(install),
      this.#readModels(install, realExecutable, settingsFile, options.force === true),
      readClaudeSettingsModels(settingsFile),
    ]);
    const table = models ?? FALLBACK_CLAUDE_MODELS;
    const configModel = settings.model;
    const extra: Partial<DriverProbe> = {
      realExecutable,
      // Models specified in settings.json's env are used later (the user layer is loaded in a session, so they work).
      models: withSettingsModels(table, settings.envModels).map(({ resolvedModel: _, ...model }) => model),
      configModel,
      // Compares against the CLI's own model table: when `model` names a model this version of the CLI does not recognize, the UI prompts an upgrade.
      configModelKnown: configModel === null ? null : claudeModelKnown(configModel, table),
    };
    if (login.loggedIn === false) {
      return result('signed-out', DriversClaude.signedOut(), extra);
    }
    // When the login status cannot be read (older versions have no `auth status`), do not block: if really not logged in, the first turn fails with AGENT_AUTH_REQUIRED.
    if (login.loggedIn === null) this.#log.warn("Couldn't read Claude Code's sign-in status", { detail: login.detail });
    return result('ready', null, { ...extra, account: textOf(login.account), ...refField('accountRef', login.account) });
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const install = await this.#find(options.executable);
    if (!install) throw new RpcError('driver-unavailable', DriversCommon.commandNotFound({ command: 'claude' }));
    // The claude process starts on the first turn (see ClaudeSession), so a process start failure does not throw here.
    return new ClaudeSession(install, options, this.#log, this.#factory);
  }

  #find(executable: string | null | undefined): Promise<ClaudeInstall | null> {
    return executable ? claudeAt(executable) : this.#locate();
  }

  /**
   * Model table: starts a Query that sends no message, asks `supportedModels()`, and closes it. It costs nothing and needs no login (about 0.3 seconds measured on 2.1.284).
   * The model table only changes with the claude version and the user settings (settings.json's env can change models), so it is cached by "executable, version, settings.json modification time" with no time limit: the same claude is asked only once in the Runtime, and the next probe after an upgrade or a settings change asks again. Ordinary probes are just the two short commands `--version` and `auth status`. A failure is null (the caller falls back to the built-in table), and failures are not cached.
   * `force` (re-detect) does not use the cache.
   */
  async #readModels(
    install: ClaudeInstall,
    realExecutable: string | null,
    settingsFile: string,
    force: boolean,
  ): Promise<ClaudeModelEntry[] | null> {
    const settingsMtime = await fs.stat(settingsFile).then(
      (stat) => stat.mtimeMs,
      () => null,
    );
    const key = `${realExecutable ?? install.command}@${install.version}#${settingsMtime ?? 'none'}`;
    const cached = this.#models;
    if (!force && cached && cached.key === key) return cached.result;
    const entry = { key, result: this.#fetchModels(install) };
    this.#models = entry;
    void entry.result.then((models) => {
      if (models === null && this.#models === entry) this.#models = null;
    });
    return entry.result;
  }

  async #fetchModels(install: ClaudeInstall): Promise<ClaudeModelEntry[] | null> {
    const input = createMessageInput<SDKUserMessage>();
    let query: ReturnType<ClaudeQueryFactory> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      query = this.#factory({
        prompt: input.iterable,
        options: {
          pathToClaudeCodeExecutable: install.command,
          env: install.env,
          cwd: os.tmpdir(),
          // The same settings layers as the session: the user layer's env (ANTHROPIC_DEFAULT_*_MODEL and the like) affects the model table; hooks are off, so the probe does not trigger SessionStart.
          ...claudeSettingsOptions(),
          persistSession: false,
        },
      });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('supportedModels timed out')), 15_000);
      });
      const infos = await Promise.race([query.supportedModels(), timeout]);
      const models = mapClaudeModels(infos);
      return models.length > 0 ? models : null;
    } catch (error) {
      this.#log.warn("Couldn't read Claude Code's model list; using the built-in short list", { error: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      clearTimeout(timer);
      input.end();
      try {
        query?.close();
      } catch {
        // Already exited.
      }
    }
  }
}
