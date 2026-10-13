import type { ChildProcess } from 'node:child_process';

/** How long to wait after a forced kill at most for it to exit (SIGKILL / TerminateProcess normally finish within a few milliseconds; this only keeps an abnormal case from hanging the shutdown). */
const KILL_WAIT_MS = 2_000;

/** The message that asks the child process to stop over the IPC channel (the Runtime entry point recognizes it, `apps/runtime/src/main.ts`). */
export const STOP_MESSAGE = { type: 'stop' } as const;

/**
 * Asks the child process to stop itself and waits for it to exit; force-kills it if it runs past `timeoutMs`. Returns whether it exited on its own (`exited`) or was force-killed (`killed`).
 *
 * When there is an IPC channel, it sends `STOP_MESSAGE` over the channel, and the child shuts down as usual (the Runtime's stop order, architecture design §2.4). On Windows there is no SIGTERM that can be handled (`kill('SIGTERM')` simply ends the process), so a signal cannot be used to ask it to stop. Only without an IPC channel (or when the message cannot be sent) does it fall back to SIGTERM, which on Windows amounts to a forced kill.
 */
export function stopChild(child: ChildProcess, timeoutMs: number): Promise<'exited' | 'killed'> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve('exited');
  return new Promise((resolve) => {
    let killed = false;
    let giveUp: NodeJS.Timeout | null = null;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
      giveUp = setTimeout(() => resolve('killed'), KILL_WAIT_MS);
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      if (giveUp) clearTimeout(giveUp);
      resolve(killed ? 'killed' : 'exited');
    });
    if (child.connected) {
      child.send(STOP_MESSAGE, (error) => {
        if (error) child.kill('SIGTERM');
      });
    } else child.kill('SIGTERM');
  });
}
