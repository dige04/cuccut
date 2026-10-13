import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DriversCodex } from '@cuccut/protocol/messages/agent-drivers';
import type { DriverText } from '../driver-text.ts';
import { agentEnv, findOnPath, isExecutable, pickNewest } from '../login-shell.ts';

const run = promisify(execFile);

export interface CodexInstall {
  command: string;
  version: string | null;
  env: NodeJS.ProcessEnv;
}

/**
 * The codex installed along with the desktop app. `~/.codex/config.toml` is shared by all clients,
 * and newer clients may write models that an older CLI does not recognize, so the codex on PATH may not be usable.
 */
const BUNDLED_CODEX = [
  '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
  '/Applications/Codex.app/Contents/Resources/codex',
];

let located: { at: number; result: Promise<CodexInstall | null> } | null = null;

/**
 * `CUCCUT_CODEX_PATH` takes precedence; otherwise the newest version among the login shell's PATH and known install locations is used.
 * The result is cached for 30 seconds, to avoid running `--version` every time a session is opened.
 */
export function locateCodex(): Promise<CodexInstall | null> {
  if (!located || Date.now() - located.at > 30_000) {
    located = { at: Date.now(), result: findCodex() };
  }
  return located.result;
}

async function findCodex(): Promise<CodexInstall | null> {
  const env = await agentEnv();
  const override = process.env.CUCCUT_CODEX_PATH;
  if (override) return { command: override, version: await readCodexVersion(override, env), env };

  const candidates: string[] = [];
  const onPath = await findOnPath(process.platform === 'win32' ? 'codex.exe' : 'codex', env.PATH ?? '');
  if (onPath) candidates.push(onPath);
  if (process.platform === 'darwin') {
    for (const file of BUNDLED_CODEX) {
      for (const candidate of [file, path.join(os.homedir(), file)]) {
        if (await isExecutable(candidate)) candidates.push(candidate);
      }
    }
  }
  return pickNewest(candidates, async (command) => ({ command, version: await readCodexVersion(command, env), env }));
}

/** A codex the user specified manually: only this one is accepted, and nothing else is searched for. Null when it does not exist or is not executable. */
export async function codexAt(command: string): Promise<CodexInstall | null> {
  if (!(await isExecutable(command))) return null;
  const env = await agentEnv();
  return { command, version: await readCodexVersion(command, env), env };
}

async function readCodexVersion(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    const { stdout } = await run(command, ['--version'], { env, timeout: 10_000 });
    return stdout.trim().replace(/^codex-cli\s+/, '') || null;
  } catch {
    return null;
  }
}

/**
 * Raw `codex login status` output (“Logged in using ChatGPT”, “Logged in using an API key - sk-…”) → account description shown in the settings page and the input area footnote.
 * The raw text may contain a masked key, which is not passed on outside; unrecognized text is written as 「Codex 账号」 (Codex account).
 */
export function codexAccount(status: string): DriverText {
  const method = /Logged in using (.+)/i.exec(status)?.[1]?.trim().toLowerCase() ?? '';
  if (method.startsWith('chatgpt')) return DriversCodex.chatgptAccount();
  if (method.startsWith('amazon bedrock')) return 'Amazon Bedrock';
  if (method.startsWith('an api key')) return DriversCodex.apiKey();
  if (method.includes('access token')) return DriversCodex.accessToken();
  if (method.startsWith('workload identity')) return DriversCodex.workloadIdentity();
  return DriversCodex.codexAccount();
}

/** Text of `codexAccount` (in the current language). */
export function describeCodexAccount(status: string): string {
  return String(codexAccount(status));
}

/** An exit code of 0 from `codex login status` means logged in. */
export async function readCodexLogin(install: CodexInstall): Promise<{ loggedIn: boolean; detail: string }> {
  try {
    const { stdout, stderr } = await run(install.command, ['login', 'status'], {
      env: install.env,
      timeout: 10_000,
    });
    return { loggedIn: true, detail: (stdout || stderr).trim() };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string };
    return { loggedIn: false, detail: (e.stdout || e.stderr || e.message).trim() };
  }
}
