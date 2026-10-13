import { spawn, type ChildProcess } from 'node:child_process';
import { killProcessTree, type SpawnProcess } from '@cuccut/process-host';

/**
 * Runs one command on the user's behalf (the update action in architecture design §12.9): no shell, standard input closed, and output handed to the caller segment by segment in arrival order.
 * When stopped, it ends the processes it spawned as well (on POSIX, the whole process group; on Windows, the process tree via taskkill /T). A timeout is handled the same way.
 */

/** The end of the output: strips terminal color, keeps only the last version of lines rewritten by `\r`, and when over the limit, cuts off whole earlier lines. */
export class CommandOutput {
  readonly #limit: number;
  /** Completed lines, each ending with `\n`. */
  #done = '';
  /** The line that is not finished yet. */
  #line = '';
  #lines = 0;
  #carriage = false;
  #truncated = false;

  constructor(limit: number) {
    this.#limit = limit;
  }

  push(chunk: string): void {
    // eslint-disable-next-line no-control-regex
    for (const piece of chunk.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').split(/(\r\n|\n|\r)/)) {
      if (piece === '\n' || piece === '\r\n') {
        this.#done += `${this.#line}\n`;
        this.#line = '';
        this.#lines += 1;
        this.#carriage = false;
      } else if (piece === '\r') this.#carriage = true;
      else if (piece) {
        if (this.#carriage) this.#line = '';
        this.#carriage = false;
        this.#line += piece;
      }
    }
    this.#trim();
  }

  get text(): string {
    return this.#done + this.#line;
  }

  get lines(): number {
    return this.#lines;
  }

  get truncated(): boolean {
    return this.#truncated;
  }

  #trim(): void {
    if (this.#line.length > this.#limit) {
      this.#line = this.#line.slice(-this.#limit);
      this.#truncated = true;
    }
    const excess = this.#done.length + this.#line.length - this.#limit;
    if (excess <= 0) return;
    const cut = this.#done.indexOf('\n', excess - 1);
    this.#done = cut < 0 ? '' : this.#done.slice(cut + 1);
    this.#truncated = true;
  }
}

export type CommandOutcome =
  | { kind: 'exited'; exitCode: number }
  | { kind: 'signalled'; signal: string }
  | { kind: 'failed-to-start'; reason: string }
  | { kind: 'timed-out' }
  | { kind: 'aborted' };

export interface RunCommandOptions {
  env: NodeJS.ProcessEnv;
  signal: AbortSignal;
  timeoutMs: number;
  onOutput(chunk: string): void;
  /** Asks the program to exit first; forcibly ends it if it has not exited after a while. */
  killGraceMs?: number;
  platform?: NodeJS.Platform;
  /** Injected by tests; also used to launch taskkill on Windows. */
  spawn?: SpawnProcess;
}

export async function runCommand(argv: readonly string[], options: RunCommandOptions): Promise<CommandOutcome> {
  const platform = options.platform ?? process.platform;
  const posix = platform !== 'win32';
  const run = options.spawn ?? spawn;
  if (options.signal.aborted) return { kind: 'aborted' };
  return await new Promise<CommandOutcome>((resolve) => {
    let child: ChildProcess;
    try {
      child = run(argv[0]!, argv.slice(1), {
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        // POSIX: it forms its own process group, so stopping ends the processes it spawned (brew's curl, pip's build) as well.
        detached: posix,
      });
    } catch (error) {
      resolve({ kind: 'failed-to-start', reason: String(error) });
      return;
    }
    let stopped: 'aborted' | 'timed-out' | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    // Windows' taskkill /F is a forced kill; if the grace period runs out, it just kills again.
    const kill = (signal: NodeJS.Signals) => killProcessTree(child, signal, { platform, spawn: run });
    const stop = (reason: 'aborted' | 'timed-out') => {
      if (stopped) return;
      stopped = reason;
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), options.killGraceMs ?? 5_000);
    };
    const onAbort = () => stop('aborted');
    options.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => stop('timed-out'), options.timeoutMs);
    child.stdout!.setEncoding('utf8');
    child.stderr!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => options.onOutput(chunk));
    child.stderr!.on('data', (chunk: string) => options.onOutput(chunk));
    let settled = false;
    const finish = (outcome: CommandOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      options.signal.removeEventListener('abort', onAbort);
      resolve(outcome);
    };
    child.on('error', (error: NodeJS.ErrnoException) => finish({ kind: 'failed-to-start', reason: error.code ?? error.message }));
    child.on('close', (code, signal) => {
      if (stopped) finish({ kind: stopped });
      else if (code !== null) finish({ kind: 'exited', exitCode: code });
      else finish({ kind: 'signalled', signal: signal ?? 'unknown' });
    });
  });
}
