/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * - CLAUDE_SETTINGS_MODEL_ENV_KEYS and readClaudeSettingsModels in packages/server/src/server/agent/providers/claude/models.ts (reads the models from the model and env in settings.json)
 * - spawnClaudeCodeProcess in packages/server/src/server/agent/providers/claude/query.ts (starts claude on Windows without going through cmd.exe)
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DriversClaude } from '@cuccut/protocol/messages/agent-drivers';
import type { DriverText } from '../driver-text.ts';
import { agentEnv, findOnPath, isExecutable, pickNewest } from '../login-shell.ts';

const run = promisify(execFile);

export interface ClaudeInstall {
  command: string;
  version: string | null;
  env: NodeJS.ProcessEnv;
}

/**
 * The file name searched for on PATH, plus common locations to check when it is not found on PATH (for example, when the login shell's configuration was not loaded).
 * - macOS / Linux: the official script (`~/.local/bin`), the legacy local install (`~/.claude/local`), Homebrew.
 * - Windows: `%USERPROFILE%\.local\bin\claude.exe` installed by the official script; the batch shim `%APPDATA%\npm\claude.cmd` from a global npm install (see `resolveCmdShim`). Not verified on Windows.
 */
export function claudeSearch(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): { names: string[]; locations: string[] } {
  if (platform === 'win32') {
    const win = path.win32;
    const appData = env.APPDATA || win.join(home, 'AppData', 'Roaming');
    return {
      names: ['claude.exe', 'claude.cmd'],
      locations: [win.join(home, '.local', 'bin', 'claude.exe'), win.join(appData, 'npm', 'claude.cmd')],
    };
  }
  return {
    names: ['claude'],
    locations: [
      path.join(home, '.claude', 'local', 'claude'),
      path.join(home, '.local', 'bin', 'claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ],
  };
}

/**
 * The `claude.cmd` that npm installs on Windows is a batch shim. Since Node 20.12 / 18.20.2, a .cmd cannot be run directly with `execFile` / `spawn` without a shell (EINVAL), and going through cmd.exe breaks the quoted JSON arguments the SDK passes to the CLI (so paseo's claude/query.ts uses `shell: false`). So the file it actually starts is read from the shim: npm's cmd-shim writes `"%dp0%\<relative path>"`, and the last one is taken (there may be a `%dp0%\node.exe` before it).
 * An `.exe` is used directly; a `.js` is run with node (see `claudeExec`; the SDK also starts a `.js` pathToClaudeCodeExecutable with node itself). When it cannot be read, it returns null. Not verified on Windows.
 */
export function parseCmdShimTarget(content: string, shimDir: string): string | null {
  const targets = [...content.matchAll(/"%~?dp0%?\\([^"%]+)"/gi)].map((m) => m[1]!).filter((rel) => !/^node\.exe$/i.test(rel));
  const last = targets.at(-1);
  return last ? path.win32.join(shimDir, last) : null;
}

/** Replaces a `.cmd` with the file the shim points to; if it is not a `.cmd` or cannot be read, it is returned as is (the probe then reports that `--version` did not exit normally). */
export async function resolveCmdShim(file: string): Promise<string> {
  if (!/\.cmd$/i.test(file)) return file;
  try {
    const target = parseCmdShimTarget(await fs.readFile(file, 'utf8'), path.win32.dirname(file));
    return target && (await isExecutable(target)) ? target : file;
  } catch {
    return file;
  }
}

/** The program and leading arguments for running claude subcommands (`--version`, `auth status`): a `.js` entry is handed to node. */
export function claudeExec(command: string): { file: string; args: string[] } {
  return /\.[cm]?js$/i.test(command) ? { file: 'node', args: [command] } : { file: command, args: [] };
}

let located: { at: number; result: Promise<ClaudeInstall | null> } | null = null;

/**
 * `CUCCUT_CLAUDE_PATH` takes precedence; otherwise, among the login shell's PATH and common install locations, the newest version is taken.
 * The result is cached for 30 seconds, to avoid running `--version` every time a session opens.
 */
export function locateClaude(): Promise<ClaudeInstall | null> {
  if (!located || Date.now() - located.at > 30_000) {
    located = { at: Date.now(), result: findClaude() };
  }
  return located.result;
}

async function findClaude(): Promise<ClaudeInstall | null> {
  const env = await agentEnv();
  const override = process.env.CUCCUT_CLAUDE_PATH;
  if (override) return inspectClaude(override, env);

  const search = claudeSearch(process.platform, env, os.homedir());
  const candidates: string[] = [];
  for (const name of search.names) {
    const onPath = await findOnPath(name, env.PATH ?? '');
    if (onPath) candidates.push(onPath);
  }
  for (const file of search.locations) {
    if (await isExecutable(file)) candidates.push(file);
  }
  const resolved = process.platform === 'win32' ? await Promise.all(candidates.map(resolveCmdShim)) : candidates;
  return pickNewest(resolved, (command) => inspectClaude(command, env));
}

/** The claude path the user specified manually: only this one is used, and nowhere else is searched. null if it does not exist or is not executable. */
export async function claudeAt(command: string): Promise<ClaudeInstall | null> {
  if (!(await isExecutable(command))) return null;
  return inspectClaude(process.platform === 'win32' ? await resolveCmdShim(command) : command, await agentEnv());
}

/** Runs `--version` once; version is null when it cannot be read (the probe reports "error"). */
export async function inspectClaude(command: string, env: NodeJS.ProcessEnv): Promise<ClaudeInstall> {
  return { command, version: await readClaudeVersion(command, env), env };
}

/** `claude --version` prints `2.1.284 (Claude Code)`. */
export function parseClaudeVersion(output: string): string | null {
  return /(\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null;
}

async function readClaudeVersion(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    const exec = claudeExec(command);
    const { stdout } = await run(exec.file, [...exec.args, '--version'], { env, timeout: 10_000 });
    return parseClaudeVersion(stdout);
  } catch {
    return null;
  }
}

/** The JSON from `claude auth status` (fields verified on 2.1.284 and in the binary). */
export interface ClaudeAuthStatus {
  loggedIn?: boolean;
  /** `none` / `claude.ai` / `api_key` / `api_key_helper` / `oauth_token` / `third_party` */
  authMethod?: string;
  /** `firstParty` / `bedrock` / `vertex` / `foundry` / `gateway` …… */
  apiProvider?: string;
  subscriptionType?: string;
  email?: string;
  orgName?: string;
}

export interface ClaudeLogin {
  /** null: the login status cannot be read (older versions have no `auth status`, or the output is not JSON). */
  loggedIn: boolean | null;
  /** Description of the logged-in account, for example "Claude Pro subscription". No email. CucCut writes this as `Localized`; third-party cloud names are verbatim. */
  account: DriverText | null;
  detail: string | null;
}

/**
 * `claude auth status`: stdout is JSON; the exit code is 0 when logged in and 1 when not (stdout is still JSON), so a non-zero exit code is parsed too.
 * It only reads the status; it does not log in or input credentials.
 */
export async function readClaudeLogin(install: ClaudeInstall): Promise<ClaudeLogin> {
  let stdout = '';
  let failure = '';
  try {
    const exec = claudeExec(install.command);
    ({ stdout } = await run(exec.file, [...exec.args, 'auth', 'status'], { env: install.env, timeout: 10_000 }));
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string };
    stdout = e.stdout ?? '';
    failure = (e.stderr || e.message).trim();
  }
  let status: ClaudeAuthStatus;
  try {
    status = JSON.parse(stdout) as ClaudeAuthStatus;
  } catch {
    return { loggedIn: null, account: null, detail: failure || stdout.trim() || null };
  }
  // Authentication for third-party clouds (Bedrock, Vertex, …) happens outside the CLI, so loggedIn is not checked (unverified: no such account is at hand).
  const loggedIn = status.loggedIn === true || status.authMethod === 'third_party';
  return { loggedIn, account: loggedIn ? claudeAccount(status) : null, detail: null };
}

function subscription(type: string | undefined): DriverText | undefined {
  switch (type) {
    case 'pro':
      return DriversClaude.subscriptionPro();
    case 'max':
      return DriversClaude.subscriptionMax();
    case 'team':
      return DriversClaude.subscriptionTeam();
    case 'enterprise':
      return DriversClaude.subscriptionEnterprise();
    default:
      return undefined;
  }
}

/** Names of third-party clouds: product names as they are; any annotations are written by CucCut. */
function provider(name: string | undefined): DriverText | undefined {
  switch (name) {
    case 'bedrock':
      return 'Amazon Bedrock';
    case 'vertex':
      return 'Google Vertex AI';
    case 'foundry':
      return 'Microsoft Foundry';
    case 'anthropicAws':
      return DriversClaude.providerAnthropicAws();
    case 'anthropicGoogleCloud':
      return DriversClaude.providerAnthropicGoogleCloud();
    default:
      return undefined;
  }
}

/**
 * Login method → account description on the settings page. No email is included: it would appear in logs and snapshots. The CucCut-written explanation is `Localized` (the probe result carries `accountRef`); an unrecognized third-party cloud keeps the original name given by the CLI.
 */
export function claudeAccount(status: ClaudeAuthStatus): DriverText {
  if (status.apiProvider === 'gateway') return DriversClaude.enterpriseGateway();
  switch (status.authMethod) {
    case 'claude.ai':
      return subscription(status.subscriptionType) ?? DriversClaude.claudeAccount();
    case 'oauth_token':
      return DriversClaude.longLivedToken();
    case 'api_key':
    case 'api_key_helper':
      return DriversClaude.apiKey();
    case 'third_party':
      return provider(status.apiProvider) ?? status.apiProvider ?? DriversClaude.thirdPartyCloud();
    default:
      return DriversClaude.claudeAccount();
  }
}

/** The `claudeAccount` text (in the current language). */
export function describeClaudeAccount(status: ClaudeAuthStatus): string {
  return String(claudeAccount(status));
}

/** Claude Code's config directory: `CLAUDE_CONFIG_DIR`, default `~/.claude`. */
export function claudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

/**
 * Models specified by `env` keys in the user settings (the user layer is loaded in a session, see `claudeSettingsOptions` in claude-session.ts, and these take effect).
 * `ANTHROPIC_SMALL_FAST_MODEL` is the small model used for background work, not an optional main model, so it is not collected.
 */
export const CLAUDE_SETTINGS_MODEL_ENV_KEYS = [
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
] as const;

export interface ClaudeSettingsModels {
  /** `model` in `settings.json`. null if not set. */
  model: string | null;
  /** Models specified in `env` in `settings.json`, in the order of `CLAUDE_SETTINGS_MODEL_ENV_KEYS`, de-duplicated. */
  envModels: Array<{ key: (typeof CLAUDE_SETTINGS_MODEL_ENV_KEYS)[number]; id: string }>;
}

/** Models in the user settings (`model` and `env` in `settings.json`). When the file cannot be read or is not JSON, nothing is returned. */
export async function readClaudeSettingsModels(file: string): Promise<ClaudeSettingsModels> {
  const none: ClaudeSettingsModels = { model: null, envModels: [] };
  let settings: { model?: unknown; env?: unknown };
  try {
    settings = JSON.parse(await fs.readFile(file, 'utf8')) as { model?: unknown; env?: unknown };
  } catch {
    return none;
  }
  if (!settings || typeof settings !== 'object') return none;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const env = settings.env && typeof settings.env === 'object' ? (settings.env as Record<string, unknown>) : {};
  const envModels: ClaudeSettingsModels['envModels'] = [];
  for (const key of CLAUDE_SETTINGS_MODEL_ENV_KEYS) {
    const id = text(env[key]);
    if (id && !envModels.some((m) => m.id === id)) envModels.push({ key, id });
  }
  return { model: text(settings.model), envModels };
}
