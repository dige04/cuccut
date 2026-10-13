import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { SpawnProcess } from './system-terminal.ts';

/**
 * Ends a child process together with the processes it spawned (for example pip's build in an update command, the installer started by winget, and the ffmpeg started by yt-dlp when merging).
 *
 * - POSIX: the child must be started `detached`, so it forms its own process group (the group number is its pid); the signal is sent to the whole group; if the group is already gone, the signal is sent to the child itself.
 * - Windows: there is no process-group signal, and `child.kill()` only ends the direct child. `taskkill /PID <pid> /T /F` ends the whole process tree by parent-child relationship; if taskkill cannot start, it falls back to `child.kill()`. `/F` is a forced end with no step first asking the process to exit: on Windows the caller's grace period is just a second kill.
 *   A grandchild whose parent has already exited is not in the tree and cannot be found (not verified on Windows).
 */

export interface KillProcessTreeOptions {
  platform?: NodeJS.Platform;
  spawn?: SpawnProcess;
  /** Environment for finding taskkill (`SystemRoot`); defaults to the current process's. */
  env?: NodeJS.ProcessEnv;
}

export function killProcessTree(child: Pick<ChildProcess, 'pid' | 'kill'>, signal: NodeJS.Signals, options: KillProcessTreeOptions = {}): void {
  const platform = options.platform ?? process.platform;
  const pid = child.pid;
  if (platform === 'win32') {
    if (pid === undefined) {
      safeKill(child, signal);
      return;
    }
    const run = options.spawn ?? spawn;
    try {
      run(taskkillPath(options.env ?? process.env), ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () =>
        safeKill(child, signal),
      );
    } catch {
      safeKill(child, signal);
    }
    return;
  }
  if (pid === undefined) {
    safeKill(child, signal);
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    safeKill(child, signal);
  }
}

/** taskkill in System32 (not searched for on PATH, so a same-named program cannot stand in for it). */
export function taskkillPath(env: NodeJS.ProcessEnv): string {
  const root = env.SystemRoot || env.SYSTEMROOT || env.windir || env.WINDIR || 'C:\\Windows';
  return path.win32.join(root, 'System32', 'taskkill.exe');
}

function safeKill(child: Pick<ChildProcess, 'kill'>, signal: NodeJS.Signals): void {
  try {
    child.kill(signal);
  } catch {
    // Already ended.
  }
}
