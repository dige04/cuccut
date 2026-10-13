import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { RpcError, isEngineErrorBody, localizeText, type EngineErrorBody, type VideoEvent, type RpcErrorCode } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import { findBundledBinary } from '@cuccut/process-host';
import { RcVideo } from '@cuccut/protocol/messages/runtime-core';

/**
 * Client for the Engine Host child process (architecture design §2.3).
 *
 * The protocol is JSON lines over stdin/stdout: requests `{id, method, params}`, responses `{id, result}` / `{id, error}`, pushes `{event: "video.event", params}`. The engine always writes events first, then the response that triggers them. They are handled here in line order, so when a caller gets the receipt, the matching event has already been applied to the mirror.
 */

export interface EngineHostOptions {
  command: string;
  env?: NodeJS.ProcessEnv;
  log: Logger;
  onEvent: (event: VideoEvent) => void;
  /** The process exited unexpectedly (not caused by `close()`). */
  onExit: (info: { code: number | null; signal: NodeJS.Signals | null }) => void;
}

interface Pending {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/** Engine error codes mapped to protocol error codes (command and protocol spec §11). The original error body is kept in `details`. */
const CODE_MAP: [RegExp, RpcErrorCode][] = [
  [
    /^(PROJECT_REVISION_CONFLICT|IDEMPOTENCY_CONFLICT|UNDO_CONFLICT|UNDO_UNAVAILABLE|TIMELINE_OVERLAP|TARGET_LOCKED|VIDEO_LOCKED)$/,
    'conflict',
  ],
  [/^(ENTITY_NOT_FOUND|VIDEO_NOT_OPEN)$/, 'not-found'],
  [/^(INVALID_|TIME_|SOURCE_|MEDIA_|ASSET_|PACKAGE_|UNKNOWN_METHOD)/, 'invalid-request'],
  [/^VIDEO_READ_ONLY$/, 'forbidden'],
  // Stop barrier (§7.4): not a conflict, so it must not be retried as one.
  [/^TASK_STOPPED$/, 'forbidden'],
];

export function engineError(body: EngineErrorBody): RpcError {
  const code = CODE_MAP.find(([pattern]) => pattern.test(body.code))?.[1] ?? 'internal';
  // The engine gives only English default text and references (command and protocol spec §11.1); they are expanded in the Runtime's language, and the references are handed to the client with the error.
  return new RpcError(code, localizeText(body.message, body.messageRef), body, body.messageRef);
}

export class EngineHost {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #log: Logger;
  readonly #pending = new Map<number, Pending>();
  readonly #exited: Promise<void>;
  #nextId = 1;
  #closing = false;
  #alive = true;

  private constructor(child: ChildProcessWithoutNullStreams, options: EngineHostOptions) {
    this.#child = child;
    this.#log = options.log;
    const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => this.#onLine(line, options.onEvent));
    const errLines = readline.createInterface({ input: child.stderr, crlfDelay: Infinity });
    errLines.on('line', (line) => this.#log.warn('Engine output', { line: line.slice(0, 500) }));
    child.stdin.on('error', () => {});
    this.#exited = new Promise((resolve) => {
      child.once('exit', (code, signal) => {
        this.#alive = false;
        const error = new RpcError('engine-unavailable', RcVideo.engineExited());
        for (const pending of this.#pending.values()) pending.reject(error);
        this.#pending.clear();
        if (!this.#closing) {
          this.#log.error('Video engine exited unexpectedly', { code, signal });
          options.onExit({ code, signal });
        }
        resolve();
      });
    });
  }

  static start(options: EngineHostOptions): Promise<EngineHost> {
    return new Promise((resolve, reject) => {
      const child = spawn(options.command, [], { env: options.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
      child.once('error', (error) => reject(new RpcError('engine-unavailable', RcVideo.engineStartFailed({ reason: error.message }))));
      child.once('spawn', () => {
        const host = new EngineHost(child, options);
        host.request<{ version: string; pid: number }>('host.hello', {}).then((hello) => {
          options.log.info('Video engine ready', hello);
          resolve(host);
        }, reject);
      });
    });
  }

  get alive(): boolean {
    return this.#alive;
  }

  get pid(): number | null {
    return this.#child.pid ?? null;
  }

  request<T>(method: string, params: unknown): Promise<T> {
    if (!this.#alive) return Promise.reject(new RpcError('engine-unavailable', RcVideo.engineNotRunning()));
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { method, resolve: resolve as (value: unknown) => void, reject });
      this.#child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  /** Close stdin: the engine exits after finishing the requests it has already received, and the lock is released with the process. Force-terminate on timeout. */
  async close(timeoutMs = 5_000): Promise<void> {
    if (!this.#alive) return;
    this.#closing = true;
    this.#child.stdin.end();
    const timer = setTimeout(() => this.#child.kill('SIGKILL'), timeoutMs);
    await this.#exited;
    clearTimeout(timer);
  }

  #onLine(line: string, onEvent: (event: VideoEvent) => void): void {
    let message: { id?: number; result?: unknown; error?: unknown; event?: string; params?: unknown };
    try {
      message = JSON.parse(line);
    } catch {
      this.#log.warn('Engine output an unparseable line');
      return;
    }
    if (message.event === 'video.event') {
      try {
        onEvent(message.params as VideoEvent);
      } catch (error) {
        this.#log.error('Applying a video event failed', { error: String(error) });
      }
      return;
    }
    if (typeof message.id !== 'number') return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    if (message.error !== undefined) {
      pending.reject(
        isEngineErrorBody(message.error) ? engineError(message.error) : new RpcError('internal', RcVideo.engineRequestFailed({ method: pending.method })),
      );
    } else pending.resolve(message.result);
  }
}

/**
 * Finding the Engine Host executable: the `CUCCUT_ENGINE_HOST` environment variable; the directory of native programs shipped with the app (`CUCCUT_BIN_DIR`, the packaged `<resources>/bin`);
 * or, walking up from this module, `{release,debug}/engine-host` in the cargo output directory (built in development by `npm run build:engine`; the directory follows
 * `build.target-dir` in `.cargo/config*.toml`).
 */
export function resolveEngineHostCommand(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CUCCUT_ENGINE_HOST) return env.CUCCUT_ENGINE_HOST;
  return findBundledBinary('engine-host', path.dirname(fileURLToPath(import.meta.url)), env);
}
