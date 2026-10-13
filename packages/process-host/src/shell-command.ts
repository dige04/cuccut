import { spawn, type ChildProcess } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { killProcessTree } from './process-tree.ts';
import type { SpawnProcess } from './system-terminal.ts';

/**
 * Runs a shell command in a background process and passes its output on line by line (Agent install and upgrade commands run on the settings page, architecture design §12.9).
 *
 * - Runs through a shell (`/bin/sh -c` on Unix, `cmd.exe /d /s /c` on Windows): the command is a fixed string from a probe result, for example `brew upgrade codex`; the caller is responsible for passing only commands of this kind.
 * - stdin is closed. On Unix it is placed in its own session (`detached`) with no controlling terminal, so commands such as `sudo` that need a password fail immediately instead of hanging.
 * - stdout and stderr are merged and sent line by line. Only the last segment of a `\r` used by progress bars is kept; terminal control sequences (colors, cursor) are removed; a line that is too long is truncated.
 * - `cancel()`: on Unix it sends SIGTERM to the whole process group, then SIGKILL after the grace period; on Windows it ends the process tree with `taskkill /T /F` (not verified).
 */

export interface ShellCommandOptions {
  command: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Each new batch of output lines. */
  onLines: (lines: string[]) => void;
  /** How long after `cancel()` before it is forcibly ended (default 3 seconds). */
  killGraceMs?: number;
  /** Maximum number of characters kept per line (default 2000). */
  maxLineChars?: number;
  platform?: NodeJS.Platform;
  spawn?: SpawnProcess;
}

export interface ShellCommandExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** The exit was caused by `cancel()`. */
  cancelled: boolean;
  /** Why it could not start (for example, the shell does not exist); null if it started. */
  error: string | null;
}

export interface ShellCommandRun {
  readonly pid: number | undefined;
  readonly exited: Promise<ShellCommandExit>;
  cancel(): void;
}

const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

/** Removes terminal control sequences; with `\r` overwrites, keeps only the last non-empty segment. */
export function cleanOutputLine(raw: string, maxChars = 2000): string {
  const segments = raw.replace(ANSI, '').split('\r');
  let line = '';
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]!.length > 0) {
      line = segments[i]!;
      break;
    }
  }
  // Other control characters (backspace, bell) do not enter the UI; tabs are kept.
  line = line.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  return line.length > maxChars ? `${line.slice(0, maxChars)}…` : line;
}

export function runShellCommand(options: ShellCommandOptions): ShellCommandRun {
  const platform = options.platform ?? process.platform;
  const run = options.spawn ?? spawn;
  const windows = platform === 'win32';
  const maxLineChars = options.maxLineChars ?? 2000;
  let cancelled = false;
  let finished = false;
  let killTimer: NodeJS.Timeout | null = null;

  let child: ChildProcess;
  try {
    child = windows
      ? run(options.env?.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${options.command}"`], {
          env: options.env,
          cwd: options.cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsVerbatimArguments: true,
          windowsHide: true,
        })
      : run('/bin/sh', ['-c', options.command], {
          env: options.env,
          cwd: options.cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        });
  } catch (error) {
    return { pid: undefined, exited: Promise.resolve({ code: null, signal: null, cancelled: false, error: String(error) }), cancel() {} };
  }

  // The two streams are each split into lines separately, and the split lines are merged into one output.
  const readers = [child.stdout, child.stderr].map((stream) => {
    const decoder = new StringDecoder('utf8');
    let pending = '';
    const flush = (text: string, end: boolean) => {
      pending += text;
      const parts = pending.split('\n');
      pending = end ? '' : parts.pop()!;
      const lines = parts.filter((part, index) => !(end && index === parts.length - 1 && part === '')).map((part) => cleanOutputLine(part, maxLineChars));
      if (lines.length) options.onLines(lines);
    };
    stream?.on('data', (chunk: Buffer) => flush(decoder.write(chunk), false));
    return { end: () => flush(decoder.end(), true) };
  });

  const exited = new Promise<ShellCommandExit>((resolve) => {
    let spawnError: string | null = null;
    child.once('error', (error) => {
      spawnError = String(error);
      // If it could not start, there will be no close.
      if (child.pid === undefined) settle(null, null);
    });
    child.once('close', (code, signal) => settle(code, signal));
    // A command may leave a background process that keeps holding the output pipe, and then `close` never comes: after the process exits, wait at most 2 more seconds.
    let closeTimer: NodeJS.Timeout | null = null;
    child.once('exit', (code, signal) => {
      closeTimer = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        settle(code, signal);
      }, 2000);
      closeTimer.unref?.();
    });
    function settle(code: number | null, signal: NodeJS.Signals | null) {
      if (finished) return;
      finished = true;
      if (killTimer) clearTimeout(killTimer);
      if (closeTimer) clearTimeout(closeTimer);
      for (const reader of readers) reader.end();
      resolve({ code, signal, cancelled, error: spawnError });
    }
  });

  return {
    pid: child.pid,
    exited,
    cancel() {
      if (finished || cancelled) return;
      cancelled = true;
      if (child.pid === undefined) return;
      const tree = { platform, spawn: run };
      // Windows: taskkill /T /F ends the npm and node under cmd; there is no grace step. (Not verified.)
      killProcessTree(child, 'SIGTERM', tree);
      if (windows) return;
      killTimer = setTimeout(() => killProcessTree(child, 'SIGKILL', tree), options.killGraceMs ?? 3000);
      killTimer.unref?.();
    },
  };
}
