import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { agentEnv, findOnPath, isExecutable, pickNewest } from '../login-shell.ts';

const run = promisify(execFile);

export interface PiInstall {
  command: string;
  version: string | null;
  env: NodeJS.ProcessEnv;
}

/** Environment variable that overrides the executable location. */
export const PI_PATH_VARIABLE = 'CUCCUT_PI_PATH';

/**
 * Passed on every pi launch: do not check online for new versions (neither the probe nor the session needs it, and it saves a network round trip). Older versions do not recognize this variable and still run. */
export const PI_ENV: Record<string, string> = { PI_SKIP_VERSION_CHECK: '1' };

let located: { at: number; result: Promise<PiInstall | null> } | null = null;

/**
 * `CUCCUT_PI_PATH` takes precedence. Otherwise, take the newest version found on the login shell's PATH and in common install locations (`~/.local/bin`, Homebrew, `/usr/local/bin`, and the bin directory of each nvm version).
 * The result is cached for 30 seconds, to avoid running `--version` every time a session opens.
 */
export function locatePi(): Promise<PiInstall | null> {
  if (located && Date.now() - located.at <= 30_000) return located.result;
  located = { at: Date.now(), result: findPi() };
  return located.result;
}

async function findPi(): Promise<PiInstall | null> {
  const env = await agentEnv();
  const override = process.env[PI_PATH_VARIABLE];
  if (override) return { command: override, version: await readPiVersion(override, env), env };
  const candidates: string[] = [];
  const onPath = await findOnPath(process.platform === 'win32' ? 'pi.cmd' : 'pi', env.PATH ?? '');
  if (onPath) candidates.push(onPath);
  for (const file of await knownLocations()) {
    if (await isExecutable(file)) candidates.push(file);
  }
  return pickNewest(candidates, async (command) => ({ command, version: await readPiVersion(command, env), env }));
}

/** Common landing spots for npm global installs. nvm has one global directory per Node version; list each one. */
async function knownLocations(): Promise<string[]> {
  const home = os.homedir();
  const out = [path.join(home, '.local/bin/pi'), '/opt/homebrew/bin/pi', '/usr/local/bin/pi'];
  const nvm = path.join(process.env.NVM_DIR || path.join(home, '.nvm'), 'versions/node');
  const versions = await fs.readdir(nvm).catch(() => [] as string[]);
  for (const version of versions) out.push(path.join(nvm, version, 'bin/pi'));
  return out;
}

/** Executable the user specified manually: only this one is used, with no searching elsewhere. Null when it is missing or not executable. */
export async function piAt(command: string): Promise<PiInstall | null> {
  if (!(await isExecutable(command))) return null;
  const env = await agentEnv();
  return { command, version: await readPiVersion(command, env), env };
}

/** Version number in the output of `pi --version` (measured: 1.0.4 prints only `1.0.4`). */
export function parsePiVersion(output: string): string | null {
  return /(\d+(?:\.\d+)+)/.exec(output)?.[1] ?? null;
}

async function readPiVersion(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(command, ['--version'], { env: { ...env, ...PI_ENV }, timeout: 10_000 });
    return parsePiVersion(stdout) ?? parsePiVersion(stderr);
  } catch {
    return null;
  }
}
