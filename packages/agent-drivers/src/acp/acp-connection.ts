/*
 * Part of the mechanism is ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * packages/server/src/server/agent/providers/acp-agent.ts's createLoggedNdJsonStream / normalizeACPIncomingMessage
 * (an NDJSON stream that tolerates non-JSON lines), summarizeACPRequestError / extractACPErrorDataMessage (the original error text), buildACPClientCapabilities (no file read/write and no terminal), rejectOnSpawnError, terminateChildProcess.
 * Adapted to use CucCut's Logger and Chinese comments, and the diagnostics table and import history were removed.
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  type AnyMessage,
  type Client,
  type InitializeResponse,
  type Stream,
} from '@agentclientprotocol/sdk';
import { RUNTIME_VERSION, type Localized } from '@cuccut/protocol';
import { DriversAcp, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import type { Logger } from '@cuccut/harness';

/** ACP's “login required” (`RequestError.authRequired`). */
export const ACP_AUTH_REQUIRED = -32000;
const METHOD_NOT_FOUND = -32601;

const STDERR_TAIL_BYTES = 4096;

/**
 * On POSIX the agent process forms its own process group (`detached`), and on cleanup the whole group is ended, so processes the agent spawns do not become orphans when only the agent itself is ended.
 * cursor-agent, as soon as it starts, runs `rg --files --follow` in the working directory to index files for @, and exits on SIGTERM without ending that rg. The probe starts it in the home directory, and an rg stuck on a `stat` in an iCloud Drive directory would keep running indefinitely.
 * Windows has no process groups: it ends the process tree instead (`taskkill /T /F`).
 */
const PROCESS_GROUPS = process.platform !== 'win32';
/** How long to wait after a polite stop (SIGTERM) before force-killing. */
const STOP_GRACE_MS = 2_000;
/** After force-killing, the maximum time to wait for the process group to disappear. SIGKILL cannot be ignored and normally finishes within milliseconds; this only keeps an abnormal case from hanging the close. */
const KILL_WAIT_MS = 5_000;
const GROUP_POLL_MS = 20;

/**
 * Agent processes not yet cleaned up. When the Runtime exits (including probes still running when it stops), they are force-killed synchronously. Processes that form their own group do not end with the Runtime, and some agents do not exit even after stdin is closed (cursor-agent would keep running).
 */
const live = new Set<AcpProcess>();
let exitHookInstalled = false;

export interface AcpErrorLike {
  code: number;
  message: string;
  data?: unknown;
}

export function isAcpError(value: unknown): value is AcpErrorLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { code?: unknown }).code === 'number' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

export function isAuthRequired(error: unknown): boolean {
  return isAcpError(error) && error.code === ACP_AUTH_REQUIRED;
}

export function isMethodNotFound(error: unknown): boolean {
  return isAcpError(error) && error.code === METHOD_NOT_FOUND;
}

/** Original error text: JSON-RPC errors carry the explanation in `data` (`details`, `message`, and the like). Otherwise use `message`. */
export function acpErrorMessage(error: unknown): string {
  if (isAcpError(error)) {
    const detail = dataMessage(error.data);
    return detail && detail !== error.message ? `${error.message}: ${detail}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function dataMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  for (const key of ['details', 'errorMessage', 'message', 'detail', 'title']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return dataMessage(record.error);
}

/** On timeout, fail with `message`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * JSON lines over stdio. The SDK's built-in `ndJsonStream` prints to the console when it hits a line that is not JSON. Some agents mix log lines into stdout, so here a warning is logged and the line is skipped. A numeric id sent as a string is converted back to a number (some agents respond this way).
 */
export function acpNdJsonStream(output: WritableStream<Uint8Array>, input: ReadableStream<Uint8Array>, log: Logger): Stream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const readable = new ReadableStream<AnyMessage>({
    async start(controller) {
      let buffer = '';
      const reader = input.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              controller.enqueue(normalizeIncoming(JSON.parse(trimmed) as AnyMessage));
            } catch {
              log.warn('ACP agent wrote a non-JSON line to stdout; ignored', { length: trimmed.length });
            }
          }
        }
      } catch (error) {
        log.debug('ACP stdout reading ended', { error: String(error) });
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
  const writable = new WritableStream<AnyMessage>({
    async write(message) {
      const writer = output.getWriter();
      try {
        await writer.write(encoder.encode(`${JSON.stringify(message)}\n`));
      } finally {
        writer.releaseLock();
      }
    },
  });
  return { readable, writable };
}

function normalizeIncoming(message: AnyMessage): AnyMessage {
  if ('id' in message && !('method' in message) && typeof message.id === 'string' && /^\d+$/.test(message.id)) {
    const id = Number(message.id);
    if (Number.isSafeInteger(id)) return { ...message, id } as AnyMessage;
  }
  return message;
}

export interface AcpProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  log: Logger;
  /** Human-readable name, used in error explanations. */
  label: string;
  /** Handles requests and notifications sent by the agent. */
  client: Client;
  /** Time limit from startup to the `initialize` response. Default 20 seconds. */
  initTimeoutMs?: number;
}

/**
 * An agent process running over ACP: spawn, attach the connection, `initialize`. It provides no file read/write and no terminal (the agent reads and writes files and runs commands itself). Approvals come back to CucCut via `session/request_permission`.
 */
export class AcpProcess {
  readonly child: ChildProcess;
  readonly connection: ClientSideConnection;
  init!: InitializeResponse;
  /** Resolves when the process exits: null for a normal exit, otherwise an explanation (the exit code, the signal, and the tail of stderr). */
  readonly exited: Promise<Localized | null>;
  readonly #log: Logger;
  readonly #label: string;
  #stderr = '';
  #closing = false;
  #exitedFlag = false;
  /** The process group (the process tree on Windows) has already been cleaned up. No more signals are sent, so that a reused process ID does not hit an unrelated process. */
  #treeGone = false;

  private constructor(options: AcpProcessOptions) {
    this.#log = options.log;
    this.#label = options.label;
    this.child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: PROCESS_GROUPS,
    });
    AcpProcess.#track(this);
    this.child.stdin!.on('error', (error) => this.#log.debug('ACP stdin error', { error: String(error) }));
    this.child.stderr!.on('data', (chunk: Buffer) => {
      this.#stderr = (this.#stderr + chunk.toString('utf8')).slice(-STDERR_TAIL_BYTES);
    });
    this.exited = new Promise((resolve) => {
      this.child.once('error', (error) => {
        if (this.child.pid === undefined) this.#markTreeGone();
        if (this.#exitedFlag) return;
        this.#exitedFlag = true;
        resolve(DriversCommon.startFailed({ name: this.#label, error: error.message }));
      });
      this.child.once('exit', (code, signal) => {
        // If it exited on its own (a crash, or an exit after stdin closed), the processes it left behind are useless now, so force-kill them immediately. Those during close() are cleaned up by close().
        if (!this.#closing) void this.#killLeftovers();
        if (this.#exitedFlag) return;
        this.#exitedFlag = true;
        if (this.#closing || code === 0) resolve(null);
        else {
          const status = signal ?? DriversAcp.exitCode({ code: String(code) });
          resolve(DriversAcp.exited({ name: this.#label, status, tail: this.stderrTail() }));
        }
      });
    });
    const stream = acpNdJsonStream(
      Writable.toWeb(this.child.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(this.child.stdout!) as ReadableStream<Uint8Array>,
      this.#log,
    );
    this.connection = new ClientSideConnection(() => options.client, stream);
  }

  static async start(options: AcpProcessOptions): Promise<AcpProcess> {
    const proc = new AcpProcess(options);
    const exitedEarly = proc.exited.then((reason) => {
      throw new Error(String(reason ?? DriversAcp.exitedBeforeInit({ name: options.label })));
    });
    try {
      proc.init = await withTimeout(
        Promise.race([
          proc.connection.initialize({
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
            clientInfo: { name: 'cuccut', title: 'CucCut', version: RUNTIME_VERSION },
          }),
          exitedEarly,
        ]),
        options.initTimeoutMs ?? 20_000,
        String(DriversAcp.initTimeout({ name: options.label })),
      );
      exitedEarly.catch(() => undefined);
      return proc;
    } catch (error) {
      exitedEarly.catch(() => undefined);
      // The connection dropped first and the exit event arrives later: wait briefly for the exit reason (with the tail of stderr), which is more useful than “connection closed”.
      const reason = await withTimeout(proc.exited, 500, 'alive').catch(() => null);
      await proc.close();
      throw reason ? new Error(String(reason)) : error;
    }
  }

  get hasExited(): boolean {
    return this.#exitedFlag;
  }

  /** The last non-empty line of stderr (used in error explanations). */
  stderrTail(): string {
    const lines = this.#stderr
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.at(-1)?.slice(0, 300) ?? '';
  }

  /**
   * Shut down the process, along with the processes it spawned: close stdin, SIGTERM the whole group, and after 2 seconds SIGKILL the whole group if processes remain in it, then wait until the group has no processes. Even if the agent has already exited on its own, its leftover processes are still cleaned up. On Windows, the process tree is force-killed (SIGTERM there is already equivalent to a force-kill).
   */
  async close(): Promise<void> {
    this.#closing = true;
    if (!this.#exitedFlag) this.child.stdin?.end();
    if (!PROCESS_GROUPS) {
      await this.#killTree();
    } else {
      this.#signalGroup('SIGTERM');
      if (!(await this.#groupGone(STOP_GRACE_MS))) {
        this.#signalGroup('SIGKILL');
        await this.#groupGone(KILL_WAIT_MS);
      }
    }
    await this.exited;
  }

  /** After the agent exits on its own, force-kill the processes it left in the group. On Windows the process tree is disconnected along with the agent, so they can no longer be found. */
  async #killLeftovers(): Promise<void> {
    if (!PROCESS_GROUPS) return this.#markTreeGone();
    this.#signalGroup('SIGKILL');
    await this.#groupGone(KILL_WAIT_MS);
  }

  #signalGroup(signal: NodeJS.Signals): void {
    const pid = this.child.pid;
    if (pid === undefined || this.#treeGone) return;
    try {
      process.kill(-pid, signal);
    } catch {
      // ESRCH: no processes are left in the group
    }
  }

  /** Waits until the process group has no processes, for at most `ms`. Returns whether it is now empty. */
  async #groupGone(ms: number): Promise<boolean> {
    const deadline = performance.now() + ms;
    for (;;) {
      const pid = this.child.pid;
      if (pid === undefined || this.#treeGone) return true;
      try {
        process.kill(-pid, 0);
      } catch (error) {
        // ESRCH: no processes are left in the group. EPERM means processes are still there: this happens on macOS while processes in the group are exiting (or they may belong to another user), so keep waiting.
        if ((error as NodeJS.ErrnoException).code !== 'EPERM') {
          this.#markTreeGone();
          return true;
        }
      }
      if (performance.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, GROUP_POLL_MS));
    }
  }

  /** Windows: `taskkill /T` follows the still-running agent to find the processes it spawned and ends them too. If taskkill is unavailable, only the agent itself is ended. */
  async #killTree(): Promise<void> {
    const pid = this.child.pid;
    if (!this.#exitedFlag && pid !== undefined) {
      await new Promise<void>((resolve) =>
        execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, timeout: KILL_WAIT_MS }, () => resolve()),
      );
      if (!this.#exitedFlag) this.child.kill('SIGKILL');
    }
    this.#markTreeGone();
  }

  #markTreeGone(): void {
    this.#treeGone = true;
    live.delete(this);
  }

  static #track(proc: AcpProcess): void {
    live.add(proc);
    if (exitHookInstalled) return;
    exitHookInstalled = true;
    // While exiting, only synchronous work is possible: on POSIX, force-kill the whole group; on Windows, end only the agent itself, without waiting for taskkill.
    process.once('exit', () => {
      for (const p of live) {
        const pid = p.child.pid;
        if (pid === undefined || p.#treeGone) continue;
        try {
          if (PROCESS_GROUPS) process.kill(-pid, 'SIGKILL');
          else if (!p.#exitedFlag) p.child.kill('SIGKILL');
        } catch {
          // ESRCH: already gone
        }
      }
    });
  }
}
