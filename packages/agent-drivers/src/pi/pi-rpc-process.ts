/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * JsonlRpcProcess in packages/server/src/server/agent/providers/jsonl-rpc-process.ts (`req_N` request ids, the pending table, per-request timeouts,
 * requestStopWork, the stderr tail, shutdown as stdin end → SIGTERM → SIGKILL) and line splitting in jsonl-frame-decoder.ts (split only on LF, strip the trailing CR).
 * Changed to CucCut's Logger and Node's built-in spawn. Removed rpc_chunk fragmentation (v2) and process-tree cleanup.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Localized } from '@cuccut/protocol';
import { DriversPi } from '@cuccut/protocol/messages/agent-drivers';
import type { Logger } from '@cuccut/harness';
import { LocalizedError } from '../driver-text.ts';

const STDERR_LIMIT = 8192;
const GRACEFUL_MS = 2_000;
const FORCE_MS = 1_000;
export const PI_RPC_DEFAULT_TIMEOUT_MS = 30_000;

export interface PiRpcLaunch {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout | null;
}

export type PiCommand = { type: string; [key: string]: unknown };

/**
 * One child process of `pi --mode rpc`: commands are written to stdin (one JSON object per line, with an `id`); replies are read from stdout (`type: 'response'`, matched by `id`), along with events (no `id`).
 *
 * Line splitting recognizes only LF. JSON strings may contain U+2028 / U+2029, where Node's readline would split, so readline is not used.
 */
export class PiRpcProcess {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #log: Logger;
  readonly #pending = new Map<string, Pending>();
  readonly #listeners = new Set<(message: Record<string, unknown>) => void>();
  #buffer = '';
  #stderr = '';
  #nextId = 1;
  #disposed = false;
  #exited = false;
  #closing: Promise<void> | null = null;
  /** Completes when the process exits, with the exit description as the value (code, signal, and stderr tail). */
  readonly exited: Promise<Localized>;

  constructor(launch: PiRpcLaunch, log: Logger) {
    this.#log = log;
    this.#child = spawn(launch.command, launch.args, { cwd: launch.cwd, env: launch.env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.#child.stdout.setEncoding('utf8');
    this.#child.stderr.setEncoding('utf8');
    this.#child.stdout.on('data', (chunk: string) => this.#read(chunk));
    this.#child.stderr.on('data', (chunk: string) => {
      this.#stderr = (this.#stderr + chunk).slice(-STDERR_LIMIT);
    });
    this.#child.stdin.on('error', (error) => this.#stdinFailed(error));
    this.exited = new Promise((resolve) => {
      let settled = false;
      const done = (reason: Localized) => {
        if (settled) return;
        settled = true;
        this.#exited = true;
        this.#failAll(new LocalizedError(reason));
        resolve(reason);
      };
      this.#child.on('error', (error) => done(DriversPi.processStartFailed({ error: error.message })));
      this.#child.on('exit', (code, signal) => {
        const tail = this.stderrTail();
        done(DriversPi.processExited({ code: String(code ?? 'null'), signal: String(signal ?? 'null'), tail }));
      });
    });
  }

  get hasExited(): boolean {
    return this.#exited;
  }

  /** Last few lines of stderr, attached on error. */
  stderrTail(): string {
    return this.#stderr.trim().split('\n').slice(-5).join('\n');
  }

  onMessage(listener: (message: Record<string, unknown>) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Send one command and wait for the response's `data`. With `success: false`, fails with its `error`. When `timeoutMs` is null, only wait for the response, exit, or close. */
  request(command: PiCommand, timeoutMs: number | null = PI_RPC_DEFAULT_TIMEOUT_MS): Promise<unknown> {
    if (this.#disposed) return Promise.reject(new Error(String(DriversPi.processClosed())));
    const id = `req_${this.#nextId++}`;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const timer =
        timeoutMs !== null && timeoutMs > 0
          ? setTimeout(() => {
              this.#pending.delete(id);
              reject(new Error(String(DriversPi.requestTimeout({ command: command.type, ms: String(Date.now() - started) }))));
            }, timeoutMs)
          : null;
      this.#pending.set(id, { resolve, reject, timer });
      this.send({ ...command, id });
    });
  }

  /**
   * For commands meant to make it stop (abort, clear_queue): if the process has already exited, the goal counts as achieved, and no error is raised.
   * Just before a child process dies, its stdin may close first and requests fail first. In that case, wait for close and then check whether it really exited.
   */
  async requestStopWork(command: PiCommand, timeoutMs: number | null = PI_RPC_DEFAULT_TIMEOUT_MS): Promise<void> {
    if (this.#exited) return;
    try {
      await this.request(command, timeoutMs);
    } catch (error) {
      await this.#closing?.catch(() => undefined);
      if (!this.#exited) throw error;
    }
  }

  /** Messages that do not wait for a reply (extension_ui_response and the like). */
  send(message: Record<string, unknown>): void {
    if (this.#disposed) return;
    if (this.#child.stdin.destroyed || !this.#child.stdin.writable) {
      this.#stdinFailed(new Error(String(DriversPi.stdinUnwritable())));
      return;
    }
    try {
      this.#child.stdin.write(`${JSON.stringify(message)}\n`);
    } catch (error) {
      this.#stdinFailed(error);
    }
  }

  /** Shut down: close stdin first to let it exit on its own. If it has not exited after 2 seconds, send SIGTERM; then after 1 more second, send SIGKILL. */
  close(): Promise<void> {
    if (!this.#closing) {
      this.#failAll(new Error(String(DriversPi.processClosed())));
      this.#closing = this.#terminate();
    }
    return this.#closing;
  }

  async #terminate(): Promise<void> {
    if (this.#exited) return;
    try {
      this.#child.stdin.end();
    } catch {
      // Race at close time, ignored.
    }
    const wait = (ms: number) =>
      Promise.race([this.exited.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms).unref())]);
    if (await wait(GRACEFUL_MS)) return;
    this.#child.kill('SIGTERM');
    if (await wait(GRACEFUL_MS)) return;
    this.#log.warn('Pi process did not exit after SIGTERM; sending SIGKILL');
    this.#child.kill('SIGKILL');
    if (!(await wait(FORCE_MS))) this.#log.warn('Pi process still has not reported exit after SIGKILL');
  }

  #read(chunk: string): void {
    this.#buffer += chunk;
    let newline = this.#buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.#buffer.slice(0, newline).replace(/\r$/, '');
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.trim()) this.#line(line);
      newline = this.#buffer.indexOf('\n');
    }
  }

  #line(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.#log.debug('Ignoring a non-JSON line from Pi', { line: line.slice(0, 200) });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const message = parsed as Record<string, unknown>;
    if (message.type === 'response') {
      this.#response(message);
      return;
    }
    for (const listener of this.#listeners) {
      try {
        listener(message);
      } catch (error) {
        this.#log.error('Handling a Pi event failed', { error: String(error) });
      }
    }
  }

  #response(message: Record<string, unknown>): void {
    const id = typeof message.id === 'string' ? message.id : null;
    const pending = id ? this.#pending.get(id) : undefined;
    if (!pending) {
      // A reply with no id: the command itself was not valid JSON (`command: 'parse'`). We never send such a command, so just log it.
      if (message.success === false) this.#log.warn('Pi sent an error response with no matching request', { error: String(message.error ?? '') });
      return;
    }
    if (pending.timer) clearTimeout(pending.timer);
    this.#pending.delete(id!);
    if (message.success === false) {
      pending.reject(
        new Error(typeof message.error === 'string' && message.error ? message.error : String(DriversPi.commandFailed({ command: String(message.command) }))),
      );
      return;
    }
    pending.resolve(message.data);
  }

  #stdinFailed(error: unknown): void {
    if (this.#disposed) return;
    this.#log.warn("Writing to Pi's stdin failed", { error: error instanceof Error ? error.message : String(error) });
    // Most likely the process is exiting. Wait a moment for its exit, so pending requests fail with the real exit reason (stderr). If it still does not exit, shut it down.
    setTimeout(() => {
      if (!this.#exited) void this.close();
    }, 500).unref();
  }

  #failAll(error: Error): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const pending of this.#pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }
}

export function piErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
