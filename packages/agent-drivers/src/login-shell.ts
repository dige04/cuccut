import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

/**
 * Finds the agent command line: the login shell's environment and PATH, executable checks, picking the newest version among several installs, and the environment for child processes.
 * Shared by the Claude, Codex, and ACP Drivers.
 */

const run = promisify(execFile);
const MARK = '__CUCCUT_ENV__';

let loginShell: Promise<Record<string, string> | null> | null = null;

/** State maintained by the login shell itself, not environment the user configured: not carried over. */
const SHELL_STATE_ENV = new Set(['PWD', 'OLDPWD', 'SHLVL', '_', 'CUCCUT_LOGIN_SHELL_PROBE']);

/**
 * The login shell's full environment (the result of `env -0` run via `$SHELL -ilc`); null on failure or on Windows. Fetched only once.
 *
 * Desktop apps launched from Finder or the Dock do not get the PATH entries added in shell config (for example `~/.bun/bin`), or variables (`GEMINI_API_KEY`, `XAI_API_KEY`, keys that the agents read themselves). This problem is hidden when developing in a terminal. The approach follows VS Code's shellEnv
 * (paseo's login-shell-env.ts likewise imports the whole environment). Here `env -0` is used instead of starting another node; NUL-separated, so multi-line values are not split incorrectly.
 */
export function resolveLoginShellEnv(): Promise<Record<string, string> | null> {
  loginShell ??= (async () => {
    if (process.platform === 'win32') return null;
    const shell = process.env.SHELL || '/bin/zsh';
    try {
      const { stdout } = await run(shell, ['-ilc', `printf '${MARK}'; /usr/bin/env -0; printf '${MARK}'`], {
        timeout: 5000,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, CUCCUT_LOGIN_SHELL_PROBE: '1' },
      });
      const parts = stdout.split(MARK);
      return parts.length >= 3 ? parseEnv0(parts[1]!) : null;
    } catch {
      return null;
    }
  })();
  return loginShell;
}

/** `env -0` output → variable table, with the shell's own state (`SHELL_STATE_ENV`) removed. */
export function parseEnv0(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const entry of text.split('\0')) {
    const eq = entry.indexOf('=');
    if (eq <= 0) continue;
    const key = entry.slice(0, eq);
    if (!SHELL_STATE_ENV.has(key)) env[key] = entry.slice(eq + 1);
  }
  return env;
}

/**
 * Merges the login shell environment with the current process: variables the current process already has take priority (values such as `CUCCUT_*` given by the Runtime at startup are not overridden by
 * shell config); only variables present in the login shell alone are added. PATH is merged from both sides, with the login shell's first.
 */
export function mergeLoginEnv(login: Record<string, string> | null, current: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = { ...login, ...current };
  const searchPath = mergePath(login?.PATH ?? '', current.PATH ?? '');
  if (searchPath) merged.PATH = searchPath;
  return merged;
}

/** Merges the login shell's PATH with the current process's PATH (login shell first); when the login shell cannot be read, only the current PATH is used. */
export async function resolveLoginShellPath(): Promise<string> {
  const login = await resolveLoginShellEnv();
  return mergePath(login?.PATH ?? '', process.env.PATH ?? '');
}

function mergePath(...lists: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const dir of list.split(path.delimiter)) {
      if (dir && !seen.has(dir)) {
        seen.add(dir);
        out.push(dir);
      }
    }
  }
  return out.join(path.delimiter);
}

/**
 * Variables left by the host Claude Code session. If the Runtime itself was launched from within Claude Code (during development or testing), these leak to child processes,
 * making claude think it is embedded in another session ("cannot be launched inside another session"), or carrying the host's effort, account, file checkpoint, and similar switches (real tests leaked more than a dozen, including `CLAUDE_EFFORT`, `CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL`,
 * `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING`, `CLAUDE_CODE_USER_EMAIL`). The host will add new ones, so they are cleared by prefix:
 * all `CLAUDE_*` and `CLAUDECODE*` are removed, keeping only what users configure themselves, from the allowlist below. `ANTHROPIC_*` is outside the cleanup scope and is kept as-is.
 *
 * Limitation: when the Runtime is launched from Claude Code, the `ANTHROPIC_*` variables injected by the host (for example `ANTHROPIC_BASE_URL`) cannot be told apart from ones the user configured, so they are passed down anyway.
 */
const HOST_ENV_PREFIXES = ['CLAUDE_', 'CLAUDECODE'];

/**
 * `CLAUDE_*` variables kept during prefix cleanup: all are set by the user in their own shell, and host sessions do not set them (the names were checked against the claude 2.1.281 binary).
 * Effort (`CLAUDE_EFFORT`, `CLAUDE_CODE_EFFORT_LEVEL`) is not kept: CucCut sets it on each turn itself.
 */
export const USER_CLAUDE_ENV = new Set([
  // Config directory
  'CLAUDE_CONFIG_DIR',
  // Which cloud or gateway to use, and skipping the CLI's own cloud auth (auth is handled by an external proxy or gateway)
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_GATEWAY',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
  'CLAUDE_CODE_SKIP_VERTEX_AUTH',
  'CLAUDE_CODE_SKIP_FOUNDRY_AUTH',
  'CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH',
  'CLAUDE_CODE_SKIP_ANTHROPIC_GOOGLE_CLOUD_AUTH',
  'CLAUDE_CODE_SKIP_MANTLE_AUTH',
  // Credentials: the long-lived token generated by `claude setup-token`; cache duration for apiKeyHelper
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_API_KEY_HELPER_TTL_MS',
  // Enterprise network: mTLS client certificate, certificate store
  'CLAUDE_CODE_CLIENT_CERT',
  'CLAUDE_CODE_CLIENT_KEY',
  'CLAUDE_CODE_CLIENT_KEY_PASSPHRASE',
  'CLAUDE_CODE_CERT_STORE',
  // Requests and output
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
  'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
  'CLAUDE_CODE_MAX_RETRIES',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  // Environment for command execution (location of Git Bash on Windows)
  'CLAUDE_CODE_SHELL',
  'CLAUDE_CODE_SHELL_PREFIX',
  'CLAUDE_CODE_GIT_BASH_PATH',
  'CLAUDE_CODE_TMPDIR',
]);

/** Removes the host Claude Code session variables (see `HOST_ENV_PREFIXES`); returns a new object and does not modify the one passed in. */
export function stripHostSessionEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (HOST_ENV_PREFIXES.some((prefix) => key.startsWith(prefix)) && !USER_CLAUDE_ENV.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Environment for agent child processes: the login shell environment, with variables the current process lacks added (`mergeLoginEnv`), and the host session variables removed. */
export async function agentEnv(): Promise<NodeJS.ProcessEnv> {
  return stripHostSessionEnv(mergeLoginEnv(await resolveLoginShellEnv(), process.env));
}

export async function isExecutable(file: string): Promise<boolean> {
  try {
    await fs.access(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findOnPath(name: string, searchPath: string): Promise<string | null> {
  for (const dir of searchPath.split(path.delimiter)) {
    if (dir && (await isExecutable(path.join(dir, name)))) return path.join(dir, name);
  }
  return null;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Among several install locations, picks the one with the newest version that can report its version. If none can report a version, takes the first, so that the probe reports the raw error rather than "not installed".
 */
export async function pickNewest<T extends { version: string | null }>(
  candidates: Iterable<string>,
  inspect: (command: string) => Promise<T>,
): Promise<T | null> {
  const installs = await Promise.all([...new Set(candidates)].map(inspect));
  const usable = installs.filter((i) => i.version !== null);
  usable.sort((a, b) => compareVersions(b.version!, a.version!));
  return usable[0] ?? installs[0] ?? null;
}
