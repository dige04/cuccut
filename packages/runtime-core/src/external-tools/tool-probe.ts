import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Localized } from '@cuccut/protocol';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';

/**
 * Probes external tools (architecture design §12.9): finds the executable in the given search path and runs its version-printing argument once. It runs only locally and makes no network calls.
 * It does not go through a shell, has a time limit, and is killed on timeout.
 */

const PROBE_TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT = 8_000;

/** The value on Windows when `PATHEXT` is not set. */
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * Looks for `command` in `searchPath` (in PATH format); null if it is not found.
 *
 * On Windows, extensions are added in the `PATHEXT` order, as on the command line (`yt-dlp` tries `yt-dlp.com` and `yt-dlp.exe` first, then `.bat` and `.cmd`). The bare name comes last. A name that already has an extension is looked up as is only.
 * What is found may be a batch script. Whether it can be run is decided by the caller (see `windowsScriptKind`).
 */
export async function findOnPath(
  command: string,
  searchPath: string,
  platform: NodeJS.Platform = process.platform,
  pathExt: string | null = null,
): Promise<string | null> {
  const names = platform === 'win32' && !/\.[^.\\/]+$/.test(command) ? [...pathExtensions(pathExt).map((ext) => `${command}${ext}`), command] : [command];
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir || !path.isAbsolute(dir)) continue;
    for (const name of names) {
      const file = path.join(dir, name);
      if (await isExecutableFile(file)) return file;
    }
  }
  return null;
}

/** Splits `PATHEXT` into a list of lowercase extensions (dropping empty entries, entries not starting with a dot, and duplicates). */
export function pathExtensions(pathExt: string | null | undefined): string[] {
  const list = (pathExt || DEFAULT_PATHEXT)
    .split(';')
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => /^\.[^.\\/]+$/.test(ext));
  return [...new Set(list)];
}

/** Reads an environment variable without regard to case (on Windows the keys are case-insensitive, and in the expanded object they may appear as `Path` or `PathExt`). */
export function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  if (env[name] !== undefined) return env[name];
  const upper = name.toUpperCase();
  const key = Object.keys(env).find((k) => k.toUpperCase() === upper);
  return key === undefined ? undefined : env[key];
}

/**
 * Files on Windows that cannot run directly without a shell: `.cmd` and `.bat` need `cmd.exe` to run (starting them from Node without a shell fails with EINVAL).
 * Other files that are not `.exe` or `.com` (`.ps1`, `.py`, no extension) are not Windows programs either. Null when the file can run directly.
 */
export function windowsScriptKind(file: string): 'batch' | 'other' | null {
  const ext = path.win32.extname(file).toLowerCase();
  if (ext === '.exe' || ext === '.com') return null;
  return ext === '.cmd' || ext === '.bat' ? 'batch' : 'other';
}

/** Is a regular file that can be executed (follows symbolic links). */
export async function isExecutableFile(file: string): Promise<boolean> {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) return false;
  return fs.access(file, constants.X_OK).then(
    () => true,
    () => false,
  );
}

export type ProbeOutcome = { ok: true; output: string } | { ok: false; reason: Localized };

/** Runs `file args…` and returns stdout (plus stderr when stdout is not enough). A non-zero exit, a timeout, or a failure to start all return `ok: false` with the reason. */
export async function runVersionProbe(
  file: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeOutcome> {
  return await new Promise<ProbeOutcome>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(file, [...args], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (error) {
      resolve({ ok: false, reason: RcExternalTools.probeCannotStart({ error: String(error) }) });
      return;
    }
    let output = '';
    let errors = '';
    let settled = false;
    const finish = (outcome: ProbeOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ ok: false, reason: RcExternalTools.probeTimeout({ command: args.join(' '), seconds: Math.round(timeoutMs / 1000) }) });
    }, timeoutMs);
    child.stdout!.setEncoding('utf8');
    child.stderr!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      output = (output + chunk).slice(0, OUTPUT_LIMIT);
    });
    child.stderr!.on('data', (chunk: string) => {
      errors = (errors + chunk).slice(-OUTPUT_LIMIT);
    });
    child.on('error', (error: NodeJS.ErrnoException) => finish({ ok: false, reason: RcExternalTools.probeCannotStartCode({ code: error.code ?? error.message }) }));
    child.on('close', (code, signal) => {
      if (code === 0) finish({ ok: true, output: output || errors });
      else
        finish({
          ok: false,
          reason: RcExternalTools.probeExited({
            code: String(code ?? signal),
            detail: errors.trim() ? errors.trim().split('\n').at(-1)!.slice(0, 200) : '',
          }),
        });
    });
  });
}
