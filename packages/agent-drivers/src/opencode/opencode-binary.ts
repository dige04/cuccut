/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra). Modified:
 * the VERSION_PATTERN and major-version check from packages/server/src/server/agent/providers/opencode/runtime-client.ts.
 * Changed to CucCut's install lookup (same as acp/acp-binary.ts: environment-variable override, login shell PATH, and the newest one among known locations).
 */
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { agentEnv, findOnPath, isExecutable, pickNewest } from '../login-shell.ts';
import { OPENCODE_PATH_VARIABLE, OPENCODE_PRESET } from './opencode-preset.ts';

const run = promisify(execFile);

export interface OpenCodeInstall {
  command: string;
  version: string | null;
  env: NodeJS.ProcessEnv;
}

let located: { at: number; result: Promise<OpenCodeInstall | null> } | null = null;

/**
 * `CUCCUT_OPENCODE_PATH` takes priority; otherwise, picks the newest version among `opencode` and `opencode2` on the login shell PATH and in known install locations.
 * When both 1.x and 2.x are installed, 2.x is chosen. The result is cached for 30 seconds.
 */
export function locateOpenCode(): Promise<OpenCodeInstall | null> {
  if (located && Date.now() - located.at <= 30_000) return located.result;
  located = { at: Date.now(), result: findOpenCode() };
  return located.result;
}

async function findOpenCode(): Promise<OpenCodeInstall | null> {
  const env = await agentEnv();
  const override = process.env[OPENCODE_PATH_VARIABLE];
  if (override) return { command: override, version: await readOpenCodeVersion(override, env), env };

  const candidates: string[] = [];
  const exe = process.platform === 'win32' ? '.exe' : '';
  for (const name of [OPENCODE_PRESET.command, ...OPENCODE_PRESET.commandAliases]) {
    const onPath = await findOnPath(`${name}${exe}`, env.PATH ?? '');
    if (onPath) candidates.push(onPath);
  }
  for (const location of OPENCODE_PRESET.knownLocations) {
    const file = location.startsWith('~/') ? path.join(os.homedir(), location.slice(2)) : location;
    if (await isExecutable(file)) candidates.push(file);
  }
  return pickNewest(candidates, async (command) => ({ command, version: await readOpenCodeVersion(command, env), env }));
}

/** An executable the user specified manually: only this one is accepted. Null if it does not exist or is not executable. */
export async function openCodeAt(command: string): Promise<OpenCodeInstall | null> {
  if (!(await isExecutable(command))) return null;
  const env = await agentEnv();
  return { command, version: await readOpenCodeVersion(command, env), env };
}

const VERSION_PATTERN = /^(?:opencode\s+)?v?(\d+\.\d+\.\d+)(?:[-+][\w.-]+)?$/i;

/** Output of `opencode --version`: 2.x is `opencode v2.0.24`, 1.x is `1.18.34`. Null if it is not recognized. */
export function parseOpenCodeVersion(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const match = VERSION_PATTERN.exec(line.trim());
    if (match) return match[1]!;
  }
  return null;
}

/** Major version number; null if it cannot be read. */
export function majorVersion(version: string): number | null {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : null;
}

async function readOpenCodeVersion(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(command, ['--version'], { env, timeout: 10_000 });
    return parseOpenCodeVersion(stdout) ?? parseOpenCodeVersion(stderr);
  } catch {
    return null;
  }
}
