/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * OpenCodeV2Runtime.start in packages/server/src/server/agent/providers/opencode/v2/runtime.ts (`opencode serve
 * --hostname 127.0.0.1 --port 0`, a random OPENCODE_PASSWORD, waiting for the `server listening on` line on stdout, Basic auth,
 * treating an HTML response as an incompatible API, draining stderr without keeping it, ending the process group politely first and then forcefully)
 * and OpenCodeHttpError in http-error.ts.
 * Changed to one serve process per session for CucCut (no reference-counted process pool). HTTP and the event stream use a hand-written fetch client
 * (no dependency on @opencode/client). The session handles event stream disconnects and process exits.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { Logger } from '@cuccut/harness';
import { DriversOpencode } from '@cuccut/protocol/messages/agent-drivers';
import type { DriverText } from '../driver-text.ts';
import { OPENCODE_ENV } from './opencode-preset.ts';

/** One entry in the event stream: `{ id, type, data, durable? }` (the `V2Event` of v2). */
export interface OpenCodeEvent {
  id?: string;
  type: string;
  data: Record<string, unknown>;
  durable?: { aggregateID: string; seq: number };
}

/** OpenCode returned a non-2xx status, or returned a web page (not the v2 API). */
export class OpenCodeHttpError extends Error {
  readonly name = 'OpenCodeHttpError';
  readonly operation: string;
  readonly status: number;
  readonly tag: string | null;
  constructor(operation: string, status: number, tag: string | null, detail: DriverText | null) {
    super(String(DriversOpencode.httpFailed({ operation, status: String(status), tag: tag ?? '', detail: detail ?? '' })));
    this.operation = operation;
    this.status = status;
    this.tag = tag;
  }
}

export interface RequestOptions {
  /** Query parameters. `location` is encoded as `location[directory]=…`, matching the v2 API's format. */
  query?: Record<string, string | undefined>;
  location?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Time limit for a single request, default 30 seconds. */
  timeoutMs?: number;
}

export interface ServeOptions {
  command: string;
  env: NodeJS.ProcessEnv;
  /** Working directory of the child process. The API sets the project directory from `location` in each request; this only affects serve itself. */
  cwd: string;
  log: Logger;
  /** Time limit for waiting on the `server listening on` line and `/api/info`, default 30 seconds. */
  startupTimeoutMs?: number;
}

const LISTENING = /server listening on (http:\/\/127\.0\.0\.1:\d+)\r?\n/;

/**
 * One `opencode serve` child process and its HTTP client. Listens only on 127.0.0.1 and generates a random password on each start, so other processes cannot connect.
 */
export class OpenCodeServer {
  readonly url: string;
  /** Reason for exit: values CucCut writes (signal, exit code) are `Localized`; a process start error is the original text; a normal exit is null. */
  readonly exited: Promise<DriverText | null>;
  readonly #proc: ChildProcess;
  readonly #auth: string;
  readonly #log: Logger;
  readonly #abort = new AbortController();
  #exitedFlag = false;
  #stopping: Promise<void> | null = null;

  private constructor(proc: ChildProcess, url: string, auth: string, exited: Promise<DriverText | null>, log: Logger) {
    this.#proc = proc;
    this.url = url;
    this.#auth = auth;
    this.exited = exited;
    this.#log = log;
    void exited.then(() => {
      this.#exitedFlag = true;
      this.#abort.abort(new Error(String(DriversOpencode.processExited())));
    });
  }

  get hasExited(): boolean {
    return this.#exitedFlag;
  }

  static async start(options: ServeOptions): Promise<OpenCodeServer> {
    const password = randomBytes(32).toString('base64url');
    const timeoutMs = options.startupTimeoutMs ?? 30_000;
    const proc = spawn(options.command, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
      cwd: options.cwd,
      env: { ...options.env, ...OPENCODE_ENV, OPENCODE_PASSWORD: password },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let exitedFlag = false;
    const exited = new Promise<DriverText | null>((resolve) => {
      proc.once('exit', (code, signal) => {
        exitedFlag = true;
        resolve(
          signal ? DriversOpencode.killedBySignal({ signal }) : code === 0 ? null : DriversOpencode.exitCode({ code: String(code) }),
        );
      });
      proc.once('error', (error) => {
        exitedFlag = true;
        resolve(error.message);
      });
    });
    // The output may contain credentials: drain it without keeping it, and only log its length in the debug log.
    proc.stderr?.on('data', (chunk: Buffer) => options.log.debug('opencode serve stderr', { bytes: chunk.length }));
    const deadline = Date.now() + timeoutMs;
    let url: string;
    try {
      url = await new Promise<string>((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(() => finish(new Error(String(DriversOpencode.serveNotReady({ seconds: String(Math.round(timeoutMs / 1000)) })))), timeoutMs);
        const finish = (result: string | Error) => {
          clearTimeout(timer);
          proc.stdout?.off('data', onData);
          if (result instanceof Error) reject(result);
          else resolve(result);
        };
        const onData = (chunk: Buffer) => {
          buffer = (buffer + chunk.toString()).slice(-8192);
          const match = LISTENING.exec(buffer);
          if (match) finish(match[1]!);
        };
        proc.stdout?.on('data', onData);
        void exited.then((reason) =>
          finish(new Error(String(DriversOpencode.serveExitedAtStart({ reason: reason ?? DriversOpencode.exitCode({ code: '0' }) })))),
        );
      });
      // Keep reading stdout afterwards too, so the pipe does not fill up and block the child process.
      proc.stdout?.on('data', () => undefined);
    } catch (error) {
      await stopProcess(proc, () => exitedFlag, exited);
      throw error;
    }
    const auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
    const server = new OpenCodeServer(proc, url, auth, exited, options.log);
    try {
      await server.request('GET', '/api/info', { timeoutMs: Math.max(1, deadline - Date.now()) });
    } catch (error) {
      await server.close();
      throw error;
    }
    return server;
  }

  async request<T = unknown>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const signals = [this.#abort.signal, AbortSignal.timeout(options.timeoutMs ?? 30_000)];
    if (options.signal) signals.push(options.signal);
    const response = await fetch(this.#url(path, options), {
      method,
      headers: { authorization: this.#auth, ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.any(signals),
    });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || type.includes('text/html')) {
      const text = await response.text().catch(() => '');
      let tag: string | null = null;
      let detail: DriverText | null = null;
      try {
        const body = JSON.parse(text) as { _tag?: unknown; message?: unknown };
        tag = typeof body._tag === 'string' ? body._tag : null;
        detail = typeof body.message === 'string' ? body.message : null;
      } catch {
        detail = type.includes('text/html') ? DriversOpencode.htmlResponse() : null;
      }
      throw new OpenCodeHttpError(`${method} ${path}`, response.status, tag, detail);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /**
   * Subscribe to the global event stream (`GET /api/event`, SSE). Each `data:` is one JSON event; lines starting with `:` are heartbeats and are ignored.
   * When the stream ends or errors, calls `onClose` (with a reason; a `stop()` that ends it on purpose gives a reason of null).
   */
  subscribe(onEvent: (event: OpenCodeEvent) => void, onClose: (error: DriverText | null) => void): () => void {
    const controller = new AbortController();
    let stopped = false;
    const signal = AbortSignal.any([controller.signal, this.#abort.signal]);
    void (async () => {
      try {
        const response = await fetch(this.#url('/api/event', {}), {
          headers: { authorization: this.#auth, accept: 'text/event-stream' },
          signal,
        });
        if (!response.ok || !response.body) throw new Error(String(DriversOpencode.streamConnectFailed({ status: String(response.status) })));
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
          buffer += decoder.decode(chunk, { stream: true });
          let gap: RegExpExecArray | null;
          while ((gap = /\r?\n\r?\n/.exec(buffer))) {
            const frame = buffer.slice(0, gap.index);
            buffer = buffer.slice(gap.index + gap[0].length);
            const event = parseFrame(frame);
            if (event) onEvent(event);
          }
        }
        if (!stopped) onClose(DriversOpencode.streamEnded());
      } catch (error) {
        if (!stopped) onClose(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      stopped = true;
      controller.abort();
    };
  }

  /** End serve: send SIGTERM to the whole process group first, and SIGKILL if it has not exited after 5 seconds. */
  close(): Promise<void> {
    this.#stopping ??= stopProcess(this.#proc, () => this.#exitedFlag, this.exited);
    return this.#stopping;
  }

  #url(path: string, options: RequestOptions): string {
    const url = new URL(path, this.url);
    if (options.location) url.searchParams.set('location[directory]', options.location);
    for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.set(key, value);
    return url.toString();
  }
}

/** One SSE frame: joins the `data:` lines and parses them into an event; heartbeats and unparseable frames return null. */
export function parseFrame(frame: string): OpenCodeEvent | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
    .join('\n');
  if (!data) return null;
  try {
    const event = JSON.parse(data) as OpenCodeEvent;
    if (typeof event?.type !== 'string') return null;
    event.data ??= {};
    return event;
  } catch {
    return null;
  }
}

async function stopProcess(proc: ChildProcess, hasExited: () => boolean, exited: Promise<unknown>): Promise<void> {
  if (hasExited()) return;
  const kill = (signal: NodeJS.Signals) => {
    try {
      // A child process started detached forms its own process group, so ending it also ends the commands it spawned.
      if (process.platform !== 'win32' && proc.pid) process.kill(-proc.pid, signal);
      else proc.kill(signal);
    } catch {
      proc.kill(signal);
    }
  };
  kill('SIGTERM');
  const timer = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5_000).unref());
  if ((await Promise.race([exited.then(() => 'exited' as const), timer])) === 'timeout') {
    kill('SIGKILL');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1_000).unref())]);
  }
}
