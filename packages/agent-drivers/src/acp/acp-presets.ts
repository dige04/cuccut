/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * the startup commands in packages/server/src/server/agent/providers/generic-acp-agent.ts, cursor-acp-agent.ts and kimi-acp-agent.ts (`cursor-agent acp`, `kimi acp`), the `grok agent stdio` in the provider directory, and `NO_BROWSER` during probing; copilot-acp-agent.ts's `copilot --acp`, the URL-form mode ids, and "allow all" implemented through the `allow_all` config option.
 * Changed to CucCut's preset table: names, subscriptions and install methods follow the prototype designs/cuccut/app/data.js MORE_HARNESSES.
 */
import type { DriverId, DriverInstallOption, Localized } from '@cuccut/protocol';
import { DriversAcp } from '@cuccut/protocol/messages/agent-drivers';
import { officialScript } from '../driver-text.ts';

/** The built-in ACP presets (the five among `BUILTIN_DRIVER_IDS` that connect through ACP). */
export type BuiltinAcpDriverId = 'copilot' | 'gemini' | 'cursor' | 'grok' | 'kimi';
/** Drivers connected through ACP: built-in presets, or user-added agents (`agents.addProvider`). */
export type AcpDriverId = DriverId;

/**
 * Whether ACP's shared implementation has been verified (architecture design §3.11 D08): a shared implementation of the same protocol counts as verified once a full session has run on a real machine with one vendor. Presets without their own `verified`, and user-added agents, take this value. It has already run new session, approval, follow-up, interrupt and resume on a real machine through the claude-code-acp adapter (Claude Code's ACP wrapper), so it is true; when it is false, only the probe result is shown, and sessions cannot be opened.
 */
export const ACP_SHARED_VERIFIED = true;

/**
 * A preset for one ACP agent: the same `AcpDriver` implementation; the only differences are how it is found, how it is started and how it is logged in.
 * A user-added agent is also a preset (`customAcpPreset`): it has no minimum version, install method, login command or known locations.
 */
export interface AcpPreset {
  id: AcpDriverId;
  name: string;
  /** The name typed in the terminal, also the file name searched for on PATH; user-added ones may be absolute paths. */
  command: string;
  /** The arguments that start it with ACP (JSON lines over stdio). */
  args: string[];
  /** Extra environment variables added when starting it (the `env` of a user-added agent). May contain secrets; not written to logs. */
  env?: Record<string, string>;
  /**
   * The minimum version CucCut can drive: a version tested on this machine, or a version recorded from the porting source as carrying ACP. null: there is no requirement, and `--version` is not run (a user-added command may be `npx` or similar, and `--version` would not report the agent's version).
   */
  minVersion: string | null;
  /** What subscription or account is needed (text written by CucCut; the current language is read when displayed). */
  plan?: Localized;
  /**
   * The command to log in from the terminal. When several vendors have no separate login subcommand, fill in the command that starts the interactive interface (log in there following the prompts).
   */
  loginCommand: string | null;
  /**
   * A sentence shown to the user when not logged in, saying how to log in. If not given, it says "run … in the terminal to log in" based on `loginCommand`; it is written here when several login methods coexist (Gemini CLI's Google account and API key).
   */
  loginHint?: Localized;
  install?: DriverInstallOption[];
  /** A sentence shown when not installed: how to install it. */
  installHint?: Localized;
  /** Known install locations outside PATH (paths starting with `~` are relative to the user's home directory). */
  knownLocations?: string[];
  /** Where the model table comes from: `session` reads the models in the `session/new` response (`models`, or config options categorized as model); `cursor` uses an extension method. */
  models: 'session' | 'cursor';
  /**
   * Candidates that map access modes to ACP session modes (`session/set_mode`); the first one the agent has is taken, in order. If none, nothing is set and a notice is shown once.
   * Only native modes no broader than CucCut's modes are used (architecture design §3.12: the stricter of the two sides).
   */
  modes: Record<'plan' | 'ask' | 'fullAccess', string[]>;
  /**
   * "Allow all" is not a session mode but a config option for some agents (Copilot's `allow_all`): in full access it is set to `on` through `session/set_config_option`, and in other modes to `off` (when leaving full access, it is turned off first, then the mode is changed). When the session has no such config option, nothing is set, and full access runs according to `modes` with a notice shown once.
   */
  permissionOption?: { configId: string; on: string; off: string };
  /**
   * Whether a session can be opened (D08, architecture design §3.11). If not given, takes `ACP_SHARED_VERIFIED`: the shared implementation is verified, so presets of the same protocol count as verified.
   */
  verified?: boolean;
  /**
   * Whether this vendor's agent itself has run a full session on CucCut on a real machine. If not given, it is false: sessions can still be opened, but the UI shows "not tested in CucCut".
   * The shared implementation was verified through the claude-code-acp adapter; the built-in presets have not yet been tested with their own agents.
   */
  tested?: boolean;
}

/** The note shown when not logged in: `loginHint`; if absent, the login command is used. */
export function loginAdvice(preset: Pick<AcpPreset, 'loginHint' | 'loginCommand' | 'command'>): Localized {
  return preset.loginHint ?? DriversAcp.loginViaTerminal({ command: preset.loginCommand ?? preset.command });
}

/**
 * Mapping from access modes to native session modes (the stricter of the two sides):
 *
 * | CucCut mode | Candidates | Notes |
 * | --- | --- | --- |
 * | plan | plan → default | Only produces plans; falls back to per-item confirmation when there is no plan mode |
 * | ask / autoAcceptEdits / auto | default | Asks before acting, decided by the Harness's decision table; the native auto-edit mode lets writes outside the working directory through, so it is not used |
 * | fullAccess | yolo / bypassPermissions → default | No longer asks |
 */
export const ACP_MODES: AcpPreset['modes'] = {
  plan: ['plan', 'default'],
  ask: ['default'],
  fullAccess: ['yolo', 'bypassPermissions', 'default'],
};

const LOCAL_BIN = (command: string) => [`~/.local/bin/${command}`, `/opt/homebrew/bin/${command}`, `/usr/local/bin/${command}`];

/** Copilot's session mode ids are in URL form (verified on `copilot --acp` 1.0.92). */
const COPILOT_MODE = (name: 'agent' | 'plan') => `https://agentclientprotocol.com/protocol/session-modes#${name}`;

/** Human-facing fields (`plan`, `loginHint`, `installHint`, and the official script's `install`) are written as getters: the current language is read when they are accessed. */
export const ACP_PRESETS: Record<BuiltinAcpDriverId, AcpPreset> = {
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    command: 'copilot',
    args: ['--acp'],
    // The version whose `initialize` and `session/new` (URL-form mode ids and the allow_all config option) were checked locally. paseo has connected through `copilot --acp` since 2026-04-02 (at that time npm was around 1.0.15), but whether earlier versions have these modes and config options was not checked, so the version requirement follows the locally verified version for now.
    minVersion: '1.0.92',
    get plan() {
      return DriversAcp.copilotPlan();
    },
    // The `authMethods` in `initialize` say "run copilot login in the terminal"; `/login` in the interactive interface also works.
    loginCommand: 'copilot login',
    get loginHint() {
      return DriversAcp.copilotLoginHint();
    },
    install: [
      {
        kind: 'npm',
        label: 'npm',
        needs: 'Node.js',
        command: 'npm install -g @github/copilot',
        upgrade: 'npm install -g @github/copilot@latest',
      },
    ],
    get installHint() {
      return DriversAcp.copilotInstallHint();
    },
    knownLocations: LOCAL_BIN('copilot'),
    models: 'session',
    // #autopilot turns allow-all on by itself and runs until completion, which is broader than any CucCut mode, so it is not used; full access is #agent plus allow_all.
    modes: {
      plan: [COPILOT_MODE('plan'), 'plan'],
      ask: [COPILOT_MODE('agent'), 'default'],
      fullAccess: [COPILOT_MODE('agent'), 'default'],
    },
    permissionOption: { configId: 'allow_all', on: 'on', off: 'off' },
    tested: false,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    args: ['--acp'],
    // The version whose `initialize` and `session/new` were checked locally; earlier versions use `--experimental-acp`.
    minVersion: '0.46.0',
    get plan() {
      return DriversAcp.geminiPlan();
    },
    // Gemini CLI has no separate login subcommand: after starting it, choose a login method in the interactive interface.
    loginCommand: 'gemini',
    // If using an API key, storing the key in ~/.gemini/.env is most reliable: Gemini CLI reads it itself, regardless of how CucCut starts it.
    get loginHint() {
      return DriversAcp.geminiLoginHint();
    },
    install: [
      { kind: 'brew', label: 'Homebrew', needs: 'Homebrew', command: 'brew install gemini-cli', upgrade: 'brew upgrade gemini-cli' },
      {
        kind: 'npm',
        label: 'npm',
        needs: 'Node.js',
        command: 'npm install -g @google/gemini-cli',
        upgrade: 'npm install -g @google/gemini-cli@latest',
      },
    ],
    get installHint() {
      return DriversAcp.geminiInstallHint();
    },
    knownLocations: LOCAL_BIN('gemini'),
    models: 'session',
    modes: ACP_MODES,
    tested: false,
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor Agent',
    command: 'cursor-agent',
    args: ['acp'],
    minVersion: '2026.03.30',
    get plan() {
      return DriversAcp.cursorPlan();
    },
    loginCommand: 'cursor-agent login',
    get install() {
      return [officialScript('curl https://cursor.com/install -fsS | bash', 'cursor-agent update')];
    },
    get installHint() {
      return DriversAcp.cursorInstallHint();
    },
    knownLocations: LOCAL_BIN('cursor-agent'),
    models: 'cursor',
    modes: ACP_MODES,
    tested: false,
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    command: 'grok',
    args: ['agent', 'stdio'],
    minVersion: '0.2.11',
    get plan() {
      return DriversAcp.grokPlan();
    },
    // On first start, log in in the browser (or set XAI_API_KEY).
    loginCommand: 'grok',
    get install() {
      return [officialScript('curl -fsSL https://x.ai/cli/install.sh | bash', 'curl -fsSL https://x.ai/cli/install.sh | bash')];
    },
    get installHint() {
      return DriversAcp.grokInstallHint();
    },
    knownLocations: [...LOCAL_BIN('grok'), '~/.grok/bin/grok'],
    models: 'session',
    modes: ACP_MODES,
    tested: false,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi Code',
    command: 'kimi',
    args: ['acp'],
    minVersion: '0.11.0',
    get plan() {
      return DriversAcp.kimiPlan();
    },
    // Enter /login in the interactive interface to log in.
    loginCommand: 'kimi',
    // The prototype does not give an install command that can be listed safely: install it following the official instructions.
    install: [],
    get installHint() {
      return DriversAcp.kimiInstallHint();
    },
    knownLocations: LOCAL_BIN('kimi'),
    models: 'session',
    modes: ACP_MODES,
    tested: false,
  },
};

/** Extra environment for probe and session processes: do not try to open a browser to log in yourself (a browser popping up from a background process would leave the user wondering where it came from). */
export const ACP_ENV: Record<string, string> = { NO_BROWSER: '1', NO_OPEN_BROWSER: '1' };
