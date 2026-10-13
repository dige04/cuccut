// Process supervision in development (`npm run dev`): `electron-vite dev`, together with the Electron it starts and the Runtime that Electron starts, are kept together; when a stop
// signal arrives they are all asked to stop together, anything still alive after the timeout is force-killed, and it exits only once all of them have exited.
//
// Why it is needed: when electron-vite receives SIGTERM it only shuts down Vite and exits, without passing the signal on to Electron. Upper layers that signal by pid only (the editor's tasks, the terminal panel's
// “stop”, process managers) therefore leave Electron and the Runtime behind, which then keep writing to a terminal that is already closed. If Electron hangs on exit (for example the main process pops up a modal
// error box), it also keeps holding the terminal.
//
// Trade-off: on POSIX the child process uses `detached` (setsid) to form its own process group, so `kill(-pgid)` once reaches the grandchild (Electron) and great-grandchild (Runtime),
// and the new Electron that electron-vite swaps in when it rebuilds the main process is in the group too. The cost is that when the terminal closes, the kernel's SIGHUP no longer goes straight to the group, so this has to forward it;
// if this process itself is killed with SIGKILL, the group is left behind (clean it up with `kill -- -<pgid>`). The export Workers, ACP agents and OpenCode services started by the Runtime each form
// their own groups; they are not handled here but are shut down by the Runtime's stop order (ACP agents are force-killed as a whole group when the Runtime exits). Windows has no process groups: Ctrl+C and closing the console are already delivered to every process on the console, so here the child process tree is force-killed with `taskkill /T /F` only after the timeout.

import { spawn, spawnSync } from 'node:child_process';

/** On receiving these signals, ask the whole group to stop: terminal closed (SIGHUP), Ctrl+C (SIGINT), upper layer stops by pid (SIGTERM). */
export const SHUTDOWN_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'];

/**
 * The signal used to ask the whole group to stop, whichever one was received: the same signal the group gets when Ctrl+C is pressed in the terminal, and every process in the group treats it as a normal exit (Electron goes through
 * `before-quit`, the Runtime shuts down in its stop order, and electron-vite exits directly). SIGTERM would end Electron's GPU, network and renderer child processes directly, so they would be gone before the main process has started to quit.
 */
export const STOP_SIGNAL = 'SIGINT';

/**
 * How long to wait after asking it to stop before force-killing. This is longer than the desktop app's own normal-exit limit, so it does not step in during an exit that is proceeding normally: `before-quit` asks the Runtime to stop over IPC and waits up to 8 seconds,
 * and after a forced kill on timeout it waits another 2 seconds (`src/main/runtime-supervisor.ts`, `src/main/stop-child.ts`). A normal exit takes under a second.
 */
export const FORCE_KILL_MS = 12_000;

/** Maximum time to wait for them to exit after a forced kill (SIGKILL cannot be ignored and normally finishes within milliseconds; this only keeps an abnormal case from hanging). */
const KILL_WAIT_MS = 2_000;
const POLL_MS = 50;

/**
 * Output still goes straight to the terminal as before (Vite colors output and clears the screen based on the TTY). stdin also stays as it was: Vite shuts the server down and exits when stdin ends, so it must not be replaced with an empty stream.
 * On POSIX it forms its own group; on Windows `detached` gives it a separate console window, and Ctrl+C cannot reach it.
 */
export function devSpawnOptions(platform) {
  return { stdio: 'inherit', detached: platform !== 'win32' };
}

/** Runs `command` under supervision and exits with its exit code; exits with 0 when it stopped because of a stop signal. */
export function superviseDevProcess(command, args, { cwd, platform = process.platform, forceKillMs = FORCE_KILL_MS } = {}) {
  // Writing to stdio fails after the terminal is closed (EIO, EPIPE). If left unhandled it becomes an uncaught exception, and this process ends before it has finished shutting down.
  for (const stream of [process.stdout, process.stderr]) stream.on('error', () => {});

  const groups = platform !== 'win32';
  const child = spawn(command, args, { cwd, env: process.env, ...devSpawnOptions(platform) });
  const childRunning = () => child.exitCode === null && child.signalCode === null;

  const running = () => {
    if (!groups) return childRunning();
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const signalGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // ESRCH: the group has no processes left
    }
  };

  let stopping = false;
  let exitCode = 0;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    // Not sent separately on Windows: Ctrl+C and closing the console have already been delivered to every process, and there `kill` is equivalent to an immediate termination.
    if (groups) signalGroup(STOP_SIGNAL);
    const force = setTimeout(() => {
      process.stderr.write(`[dev] Still running ${forceKillMs / 1000} s after the stop request; force-killing\n`);
      if (groups) signalGroup('SIGKILL');
      else if (childRunning()) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      setTimeout(() => process.exit(exitCode), KILL_WAIT_MS);
    }, forceKillMs);
    const poll = setInterval(() => {
      if (running()) return;
      clearInterval(poll);
      clearTimeout(force);
      process.exit(exitCode);
    }, POLL_MS);
  };

  child.on('error', (error) => {
    process.stderr.write(`[dev] Could not start ${command}: ${error.message}\n`);
    process.exit(1);
  });
  // It exited on its own (the app was closed, or the build failed): exit with its exit code, and still ask the rest of the group to stop.
  child.on('exit', (code) => {
    if (stopping) return;
    exitCode = code ?? 1;
    stop();
  });
  for (const signal of SHUTDOWN_SIGNALS) process.on(signal, stop);
  return child;
}
