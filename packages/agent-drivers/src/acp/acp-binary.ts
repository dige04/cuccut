import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { agentEnv, findOnPath, isExecutable, pickNewest } from '../login-shell.ts';
import type { AcpPreset } from './acp-presets.ts';

const run = promisify(execFile);

export interface AcpInstall {
  command: string;
  version: string | null;
  env: NodeJS.ProcessEnv;
}

const located = new Map<string, { at: number; result: Promise<AcpInstall | null> }>();

/** The environment variables that override the executable location, e.g. `CUCCUT_GEMINI_PATH`. Hyphens in the id become underscores (`my-agent` → `CUCCUT_MY_AGENT_PATH`). */
export function acpPathVariable(preset: Pick<AcpPreset, 'id'>): string {
  return `CUCCUT_${preset.id.toUpperCase().replace(/-/g, '_')}_PATH`;
}

/**
 * `CUCCUT_<ID>_PATH` takes precedence. Otherwise, among the login shell's PATH and the known install locations, pick the one with the newest version.
 * Results are cached per preset for 30 seconds, so that `--version` does not run every time a session opens.
 */
export function locateAcp(preset: AcpPreset): Promise<AcpInstall | null> {
  // The key includes the command: when a user removes an agent and then adds a different command under the same id, the old result is not reused.
  const key = `${preset.id}\0${preset.command}`;
  const hit = located.get(key);
  if (hit && Date.now() - hit.at <= 30_000) return hit.result;
  const entry = { at: Date.now(), result: findAcp(preset) };
  located.set(key, entry);
  return entry.result;
}

async function findAcp(preset: AcpPreset): Promise<AcpInstall | null> {
  const env = await agentEnv();
  // Agents without a minimum version (user-added) do not run `--version`: the command may be something like npx, which would report a version other than the agent's.
  const readVersion = preset.minVersion !== null;
  const version = (command: string) => (readVersion ? readAcpVersion(command, env) : Promise.resolve(null));
  const override = process.env[acpPathVariable(preset)];
  if (override) return { command: override, version: await version(override), env };
  // An absolute path (which users may enter when adding) is accepted as the only candidate.
  if (path.isAbsolute(preset.command)) {
    return (await isExecutable(preset.command)) ? { command: preset.command, version: await version(preset.command), env } : null;
  }

  const candidates: string[] = [];
  const onPath = await findOnPath(process.platform === 'win32' ? `${preset.command}.exe` : preset.command, env.PATH ?? '');
  if (onPath) candidates.push(onPath);
  if (!readVersion) return onPath ? { command: onPath, version: null, env } : null;
  for (const location of preset.knownLocations ?? []) {
    const file = location.startsWith('~/') ? path.join(os.homedir(), location.slice(2)) : location;
    if (await isExecutable(file)) candidates.push(file);
  }
  return pickNewest(candidates, async (command) => ({ command, version: await readAcpVersion(command, env), env }));
}

/** The executable the user specified manually. Only this one is accepted; nothing else is searched. Null when it does not exist or is not executable. */
export async function acpAt(command: string, options: { readVersion?: boolean } = {}): Promise<AcpInstall | null> {
  if (!(await isExecutable(command))) return null;
  const env = await agentEnv();
  return { command, version: options.readVersion === false ? null : await readAcpVersion(command, env), env };
}

/** The first version number in the `--version` output (`0.46.0`; `2026.03.30` from `2026.03.30-abc`; `0.11.0` from `kimi, version 0.11.0`). */
export function parseAcpVersion(output: string): string | null {
  return /(\d+(?:\.\d+)+)/.exec(output)?.[1] ?? null;
}

async function readAcpVersion(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(command, ['--version'], { env, timeout: 10_000 });
    return parseAcpVersion(stdout) ?? parseAcpVersion(stderr);
  } catch {
    return null;
  }
}
