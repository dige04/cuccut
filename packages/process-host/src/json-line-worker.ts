import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { refOf, type Localized, type MessageRef } from '@cuccut/protocol';
import { ProcessHostWorker as W } from '@cuccut/protocol/messages/process-host';

/**
 * Private executor channel (architecture design §13.1 `process-host`): a JSON-line child process client over stdio.
 *
 * The protocol is the same as Engine Host and Model Worker: requests `{id, method, params}`, responses `{id, result}` / `{id, error}`, pushes `{event, params}`. This module does not know any method or event names; it is only responsible for:
 *
 * - incrementing numeric `id`s and the table of in-flight requests; when the child exits, all in-flight requests are rejected with `WorkerExitedError`;
 * - an optional request timeout (none by default: one inference can run for several minutes);
 * - stderr keeps only its last segment (64 KiB by default), for taking the tail in crash diagnostics;
 * - `close()` closes stdin so the child exits by itself, with SIGKILL after the grace period; `kill()` ends it immediately.
 *
 * An exit caused by `close()` / `kill()` is marked `expected`, so callers can tell a normal stop from a crash.
 */

export interface WorkerCommand {
  command: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface JsonLineWorkerOptions extends WorkerCommand {
  /** Number of bytes of stderr tail kept (default 64 KiB). */
  stderrLimitBytes?: number;
  /** Each line of stderr (for log forwarding). */
  onStderrLine?: (line: string) => void;
}

export interface WorkerEvent {
  event: string;
  params: unknown;
}

export interface WorkerExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** The exit was caused by `close()` / `kill()`. */
  expected: boolean;
}

/** The error body returned by the child process. If its shape is wrong, `code` is `MALFORMED_ERROR`. */
export interface WorkerErrorBody {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}

/** The request received an error response. */
export class WorkerRequestError extends Error {
  readonly method: string;
  readonly body: WorkerErrorBody;
  /** Message reference for the explanation, for re-display in the reader's language. */
  readonly messageRef: MessageRef;

  constructor(method: string, body: WorkerErrorBody) {
    const message = W.requestFailed({ method, code: body.code, message: body.message });
    super(message.text);
    this.messageRef = refOf(message);
    this.name = 'WorkerRequestError';
    this.method = method;
    this.body = body;
  }

  get code(): string {
    return this.body.code;
  }
}

/** The child process exited while the request was in flight (or it was already gone when the request was sent). */
export class WorkerExitedError extends Error {
  readonly method: string;
  readonly exit: WorkerExit | null;
  /** Message reference for the explanation, for re-display in the reader's language. */
  readonly messageRef: MessageRef;

  constructor(method: string, exit: WorkerExit | null) {
    const message: Localized = exit
      ? W.exited({ method, code: String(exit.code), signal: String(exit.signal) })
      : W.notRunning({ method });
    super(message.text);
    this.messageRef = refOf(message);
    this.name = 'WorkerExitedError';
    this.method = method;
    this.exit = exit;
  }
}

export class WorkerTimeoutError extends Error {
  readonly method: string;
  readonly timeoutMs: number;
  /** Message reference for the explanation, for re-display in the reader's language. */
  readonly messageRef: MessageRef;

  constructor(method: string, timeoutMs: number) {
    const message = W.timedOut({ method, ms: timeoutMs });
    super(message.text);
    this.messageRef = refOf(message);
    this.name = 'WorkerTimeoutError';
    this.method = method;
    this.timeoutMs = timeoutMs;
  }
}

export class WorkerSpawnError extends Error {
  /** Message reference for the explanation, for re-display in the reader's language. */
  readonly messageRef: MessageRef;

  constructor(command: string, cause: Error) {
    const message = W.spawnFailed({ command, error: cause.message });
    super(message.text, { cause });
    this.messageRef = refOf(message);
    this.name = 'WorkerSpawnError';
  }
}

interface Pending {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_STDERR_LIMIT = 64 * 1024;
const DEFAULT_GRACE_MS = 5_000;

export class JsonLineWorker {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #pending = new Map<number, Pending>();
  readonly #eventListeners = new Set<(event: WorkerEvent) => void>();
  readonly #exitListeners = new Set<(exit: WorkerExit) => void>();
  readonly #stderrLimit: number;
  readonly #stderr: Buffer[] = [];
  readonly #exited: Promise<WorkerExit>;
  #stderrBytes = 0;
  #nextId = 1;
  #expected = false;
  #exit: WorkerExit | null = null;

  private constructor(child: ChildProcessWithoutNullStreams, options: JsonLineWorkerOptions) {
    this.#child = child;
    this.#stderrLimit = options.stderrLimitBytes ?? DEFAULT_STDERR_LIMIT;
    const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => this.#onLine(line));
    child.stderr.on('data', (chunk: Buffer) => this.#onStderr(chunk));
    if (options.onStderrLine) {
      const onLine = options.onStderrLine;
      readline.createInterface({ input: child.stderr, crlfDelay: Infinity }).on('line', (line) => onLine(line));
    }
    child.stdin.on('error', () => {});
    // `close` rather than `exit`: the process counts as exited only after stdio has been read to the end, so the last few response lines the child wrote before exiting are not lost.
    this.#exited = new Promise((resolve) => {
      child.once('close', (code, signal) => {
        const exit: WorkerExit = { code, signal, expected: this.#expected };
        this.#exit = exit;
        for (const pending of this.#pending.values()) {
          if (pending.timer) clearTimeout(pending.timer);
          pending.reject(new WorkerExitedError(pending.method, exit));
        }
        this.#pending.clear();
        for (const listener of this.#exitListeners) listener(exit);
        resolve(exit);
      });
    });
  }

  /** Starts the child process; returns once the process is up (the `spawn` event), without sending any request. */
  static start(options: JsonLineWorkerOptions): Promise<JsonLineWorker> {
    return new Promise((resolve, reject) => {
      const child = spawn(options.command, [...(options.args ?? [])], {
        env: options.env ?? process.env,
        cwd: options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.once('error', (error) => reject(new WorkerSpawnError(options.command, error)));
      child.once('spawn', () => resolve(new JsonLineWorker(child, options)));
    });
  }

  get pid(): number | null {
    return this.#child.pid ?? null;
  }

  get alive(): boolean {
    return this.#exit === null;
  }

  /** Resolves when the process exits; resolves immediately if it has already exited. */
  get exited(): Promise<WorkerExit> {
    return this.#exited;
  }

  request<T>(method: string, params: unknown, options: { timeoutMs?: number } = {}): Promise<T> {
    if (this.#exit) return Promise.reject(new WorkerExitedError(method, this.#exit));
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const pending: Pending = { method, resolve: resolve as (value: unknown) => void, reject, timer: null };
      if (options.timeoutMs !== undefined) {
        const timeoutMs = options.timeoutMs;
        pending.timer = setTimeout(() => {
          this.#pending.delete(id);
          reject(new WorkerTimeoutError(method, timeoutMs));
        }, timeoutMs);
      }
      this.#pending.set(id, pending);
      this.#child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  onEvent(listener: (event: WorkerEvent) => void): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  onExit(listener: (exit: WorkerExit) => void): () => void {
    this.#exitListeners.add(listener);
    return () => this.#exitListeners.delete(listener);
  }

  /** Closes stdin so the child process finishes the requests it has received and exits by itself; SIGKILL after the grace period. */
  async close(graceMs = DEFAULT_GRACE_MS): Promise<WorkerExit> {
    if (this.#exit) return this.#exit;
    this.#expected = true;
    this.#child.stdin.end();
    const timer = setTimeout(() => this.#child.kill('SIGKILL'), graceMs);
    const exit = await this.#exited;
    clearTimeout(timer);
    return exit;
  }

  /** Ends the child process immediately. */
  async kill(signal: NodeJS.Signals = 'SIGKILL'): Promise<WorkerExit> {
    if (this.#exit) return this.#exit;
    this.#expected = true;
    this.#child.kill(signal);
    return this.#exited;
  }

  /** The last segment of stderr (at most `stderrLimitBytes` bytes), decoded as UTF-8. */
  stderrTail(): string {
    return Buffer.concat(this.#stderr).toString('utf8');
  }

  #onStderr(chunk: Buffer): void {
    this.#stderr.push(chunk);
    this.#stderrBytes += chunk.length;
    while (this.#stderrBytes > this.#stderrLimit && this.#stderr.length > 0) {
      const head = this.#stderr[0]!;
      const excess = this.#stderrBytes - this.#stderrLimit;
      if (head.length <= excess) {
        this.#stderr.shift();
        this.#stderrBytes -= head.length;
      } else {
        this.#stderr[0] = head.subarray(excess);
        this.#stderrBytes -= excess;
      }
    }
  }

  #onLine(line: string): void {
    let message: { id?: unknown; result?: unknown; error?: unknown; event?: unknown; params?: unknown };
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message !== 'object' || message === null) return;
    if (typeof message.event === 'string') {
      const event: WorkerEvent = { event: message.event, params: message.params ?? {} };
      for (const listener of this.#eventListeners) {
        try {
          listener(event);
        } catch {
          // An exception thrown by a listener itself does not affect the channel.
        }
      }
      return;
    }
    if (typeof message.id !== 'number') return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    if (pending.timer) clearTimeout(pending.timer);
    if (message.error !== undefined) pending.reject(new WorkerRequestError(pending.method, errorBody(message.error)));
    else pending.resolve(message.result);
  }
}

function errorBody(raw: unknown): WorkerErrorBody {
  if (typeof raw === 'object' && raw !== null) {
    const body = raw as Record<string, unknown>;
    if (typeof body.code === 'string' && typeof body.message === 'string') {
      return {
        code: body.code,
        message: body.message,
        ...(typeof body.retryable === 'boolean' ? { retryable: body.retryable } : {}),
        ...(body.details !== undefined ? { details: body.details } : {}),
      };
    }
  }
  return { code: 'MALFORMED_ERROR', message: W.malformedError().text, details: raw };
}
