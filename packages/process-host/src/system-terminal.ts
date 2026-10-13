import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProcessHostTools as T } from '@cuccut/protocol/messages/process-host';

/**
 * Runs a command in the system terminal (architecture design §12.9: actions that need a password or administrator rights are handed to the system terminal, for the user to run themselves).
 * It only opens the terminal and puts the command into it; CucCut does not know the result of the command in the terminal, and the UI re-probes afterwards.
 *
 * - macOS: writes a `.command` script in a temporary directory (0o700, first `rm -f "$0"` to delete itself), and opens it with `open <file>`. It goes through the user's default `.command` handler (usually Terminal), needs no automation permission, and does not use osascript.
 *   The script ends with `exec "$SHELL" -l` to keep the window open, so the user can read the output and keep working in it.
 * - Windows: `cmd.exe /c start "" cmd.exe /k <command>`. (Unverified: no real Windows environment test.)
 * - Linux: tries `x-terminal-emulator -e`, `gnome-terminal --`, `konsole -e`, `xterm -e` in turn, and returns `unsupported` if none of them is on PATH. (Unverified: no real Linux desktop test.)
 *
 * The command is a fixed string the caller takes from the Agent's probe result, not something given by a user or a web page; it still accepts only a single line, and the hint line (“CucCut: run <command>”) is escaped with shell single quotes.
 */

export type TerminalStatus = 'opened' | 'unsupported';

export interface SystemTerminalResult {
  status: TerminalStatus;
  /** Reason for `unsupported`, for logging. */
  detail: string | null;
}

/** Same shape as `child_process.spawn`; tests inject a fake, so no real terminal is opened. */
export type SpawnProcess = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

export interface SystemTerminalOptions {
  platform?: NodeJS.Platform;
  spawn?: SpawnProcess;
  /** Directory where the macOS `.command` script is written (defaults to the system temporary directory). */
  tmpDir?: string;
  /** Environment for finding terminal programs on Linux (defaults to the current process's). */
  env?: NodeJS.ProcessEnv;
  /** Linux: whether this terminal program is on PATH (by default looks for the executable in `env.PATH`). */
  available?: (program: string) => Promise<boolean>;
}

/** The terminals tried in turn on Linux, and the arguments that come before the program to be run. */
export const LINUX_TERMINALS: readonly { program: string; args: readonly string[] }[] = [
  { program: 'x-terminal-emulator', args: ['-e'] },
  { program: 'gnome-terminal', args: ['--'] },
  { program: 'konsole', args: ['-e'] },
  { program: 'xterm', args: ['-e'] },
];

/** POSIX shell single-quote escaping. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** The line printed first in the terminal. */
export function terminalBanner(command: string): string {
  return T.terminalBanner({ command }).text;
}

/** Content of the macOS `.command` script. */
export function macCommandScript(command: string): string {
  return [
    '#!/bin/sh',
    // Deleted when opened: no script is left in the temporary directory.
    'rm -f "$0"',
    // The working directory of the `.command` is not fixed; login and install both start from the user's home directory, consistent with opening a new terminal window.
    'cd "$HOME" 2>/dev/null',
    'clear',
    `printf '%s\\n' ${shellQuote(terminalBanner(command))}`,
    command,
    // Keeps the window open: gives the user a login shell after the command ends.
    'exec "${SHELL:-/bin/zsh}" -l',
    '',
  ].join('\n');
}

/** The `sh -c` script run inside the Linux terminal. */
export function posixTerminalScript(command: string): string {
  return `printf '%s\\n' ${shellQuote(terminalBanner(command))}; ${command}; exec "\${SHELL:-/bin/sh}" -l`;
}

export async function openSystemTerminal(command: string, options: SystemTerminalOptions = {}): Promise<SystemTerminalResult> {
  if (!command.trim() || /[\r\n\0]/.test(command)) throw new Error('The terminal command must be a single non-empty line');
  const platform = options.platform ?? process.platform;
  const run = options.spawn ?? spawn;
  if (platform === 'darwin') return openMac(command, run, options.tmpDir ?? os.tmpdir());
  if (platform === 'win32') return openWindows(command, run);
  if (platform === 'linux' || platform === 'freebsd' || platform === 'openbsd') {
    const env = options.env ?? process.env;
    return openLinux(command, run, options.available ?? ((program) => onPath(program, env.PATH ?? '')));
  }
  return { status: 'unsupported', detail: `Unsupported platform ${platform}` };
}

async function openMac(command: string, run: SpawnProcess, tmpDir: string): Promise<SystemTerminalResult> {
  const file = path.join(tmpDir, `cuccut-${crypto.randomBytes(6).toString('hex')}.command`);
  // `wx`: does not overwrite an existing file; 0o700: only the current user can read, write and execute it.
  await fs.writeFile(file, macCommandScript(command), { flag: 'wx', mode: 0o700 });
  // umask may remove the execute bit, so it is set again.
  await fs.chmod(file, 0o700);
  const outcome = await exitOf(run('open', [file], { stdio: 'ignore' }));
  if (outcome.ok && outcome.code === 0) return { status: 'opened', detail: null };
  // If it was not opened, the script will not delete itself.
  await fs.rm(file, { force: true }).catch(() => {});
  return { status: 'unsupported', detail: outcome.ok ? `open exited with code ${outcome.code}` : outcome.error };
}

async function openWindows(command: string, run: SpawnProcess): Promise<SystemTerminalResult> {
  // The first quoted argument of `start` is the window title; verbatim stops Node from adding quotes to the arguments, so the command is handed to the new cmd as is.
  const child = run('cmd.exe', ['/c', 'start', '""', 'cmd.exe', '/k', command], {
    stdio: 'ignore',
    detached: true,
    windowsVerbatimArguments: true,
    windowsHide: true,
  });
  const outcome = await exitOf(child);
  if (outcome.ok && outcome.code === 0) return { status: 'opened', detail: null };
  return { status: 'unsupported', detail: outcome.ok ? `start exited with code ${outcome.code}` : outcome.error };
}

async function openLinux(command: string, run: SpawnProcess, available: (program: string) => Promise<boolean>): Promise<SystemTerminalResult> {
  const tried: string[] = [];
  for (const terminal of LINUX_TERMINALS) {
    if (!(await available(terminal.program))) continue;
    tried.push(terminal.program);
    const child = run(terminal.program, [...terminal.args, 'sh', '-c', posixTerminalScript(command)], { stdio: 'ignore', detached: true });
    // The terminal program stays open, so do not wait for it to exit: having started counts as opened.
    const started = await spawnOf(child);
    if (started.ok) {
      child.unref();
      return { status: 'opened', detail: null };
    }
  }
  return { status: 'unsupported', detail: tried.length ? `No terminal could be started: ${tried.join(', ')}` : 'No terminal program found' };
}

type Outcome = { ok: true; code: number | null } | { ok: false; error: string };

function exitOf(child: ChildProcess): Promise<Outcome> {
  return new Promise((resolve) => {
    child.once('error', (error) => resolve({ ok: false, error: String(error) }));
    child.once('exit', (code) => resolve({ ok: true, code }));
  });
}

function spawnOf(child: ChildProcess): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    child.once('error', () => resolve({ ok: false }));
    child.once('spawn', () => resolve({ ok: true }));
  });
}

async function onPath(program: string, searchPath: string): Promise<boolean> {
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue;
    try {
      await fs.access(path.join(dir, program), fs.constants.X_OK);
      return true;
    } catch {
      // Next directory.
    }
  }
  return false;
}
