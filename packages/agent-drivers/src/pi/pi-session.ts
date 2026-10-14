/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * the turn lifecycle in packages/server/src/server/agent/providers/pi/agent.ts (one prompt through agent_settled is one turn; without agent_settled in older versions, it finishes on agent_end; the failure reason is taken from the last assistant message's errorMessage; interrupt runs clear_queue and then abort;
 * when steer replies “Unknown command: steer” it is treated as unsupported; images are sent with the message only when the model's input includes image) and the startup arguments in cli-runtime.ts.
 * Changed to CucCut's AgentSession: developer instructions are injected through an --append-system-prompt file; CucCut's MCP service is injected through registerMcpServer in a temporary extension; extension questions (extension_ui_request) are always cancelled with a notice; the resume handle is pi's session file.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentModeLabel, newId, RpcError, type AgentErrorCode, type DriverId, type DriverProbe, type Id, type Localized } from '@cuccut/protocol';
import { DriversCommon, DriversPi } from '@cuccut/protocol/messages/agent-drivers';
import {
  MCP_TOOL_CALL_TIMEOUT_MS,
  type AgentEvent,
  type AgentInput,
  type AgentPersistenceHandle,
  type AgentSession,
  type ApprovalResponse,
  type CreateSessionOptions,
  type InterruptReceipt,
  type Logger,
  type McpServerSpec,
  type TurnSettings,
} from '@cuccut/harness';
import { agentError } from '../acp/acp-session.ts';
import { refField, textOf, type DriverText } from '../driver-text.ts';
import { PI_ENV, type PiInstall } from './pi-binary.ts';
import { PiItemMapper } from './pi-items.ts';
import { isPiThinkingLevel, parseModelReference, piModelId, piModelTakesImages, type PiModel } from './pi-models.ts';
import { PiRpcProcess, piErrorMessage } from './pi-rpc-process.ts';

/** Driver id (`pi` in `BUILTIN_DRIVER_IDS`). */
export const PI_DRIVER_ID: DriverId = 'pi';

/**
 * pi has no per-action approval channel (it never asks a person before running tools), so CucCut can only let it run under “full access”.
 * This is the notice shown in the session when access is not full access. The text matches the Pi caveat in the prototype `designs/cuccut/app/data.js` (with the subject changed to Pi). It varies by language, so fetch it at the point of use.
 */
export function piAccessWarning(): Localized {
  return DriversPi.fullAccessOnly({ mode: agentModeLabel('fullAccess') });
}

/** steer and follow_up both exist (since pi 0.84.4). There is no approval channel. Session files can be resumed. Images are sent with the message (when the model does not accept images, it falls back to a path hint). */
export const PI_CAPABILITIES: DriverProbe['capabilities'] = { steer: true, approvals: false, resume: true, images: true };

/** How long to wait for agent_settled after agent_end. Older pi versions do not send agent_settled, so if no new activity arrives within this period, the turn is considered finished. */
const SETTLE_FALLBACK_MS = 1_500;
/** Reply to prompt: before pi starts running, wait up to 10 seconds for the MCP services exposed directly. */
const PROMPT_ACK_TIMEOUT_MS = 60_000;
/** MCP service names that pi allows. */
const MCP_NAME = /^[A-Za-z0-9_-]+$/;

interface Turn {
  id: string;
  mapper: PiItemMapper;
  cancelled: boolean;
  /** agent_start has been received: only then wait for agent_end / agent_settled to finish. */
  started: boolean;
  stopReason: string | null;
  errorMessage: string | null;
  settleTimer: NodeJS.Timeout | null;
}

interface PiState {
  model?: PiModel | null;
  thinkingLevel?: string;
  sessionFile?: string;
  sessionId?: string;
}

/** What is stored in the resume handle. */
interface PiPersistence {
  sessionFile: string;
  sessionId: string | null;
}

/**
 * One CucCut session = one `pi --mode rpc` process (its working directory is the project directory). pi stores the conversation itself as a session file (`~/.pi/agent/sessions/…`).
 * On resume, the process is started again with `--session <file>`.
 *
 * Access mode: pi runs commands and edits files without asking a person first, and CucCut cannot control its native permissions. When the mode is not “full access”, it still runs, but at session start (and the first time the mode switches to another one) it emits a notice explaining this (`piAccessWarning`), rather than refusing. The Harness only opens sessions for it under full access, given `approvals: false`, so refusing again here would only leave the user stuck on an unclear error. CucCut's own tools (MCP) are still gated by the Runtime's ApprovalService according to the access mode.
 */
export class PiSession implements AgentSession {
  readonly id = newId('ags');
  readonly capabilities = PI_CAPABILITIES;
  readonly #log: Logger;
  readonly #cwd: string;
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  readonly #tempDir: string;
  #proc!: PiRpcProcess;
  #state: PiState = {};
  #turn: Turn | null = null;
  #closed = false;
  #early: AgentEvent[] | null = [];
  #accessWarned = false;
  #askWarned = false;
  /** This process has sent agent_settled: after that, agent_end no longer counts as the end of a turn. */
  #settles = false;
  #mcpExtension: string | null = null;

  private constructor(cwd: string, tempDir: string, log: Logger) {
    this.#cwd = cwd;
    this.#tempDir = tempDir;
    this.#log = log;
  }

  static async start(install: PiInstall, options: CreateSessionOptions, log: Logger): Promise<PiSession> {
    if (options.confinement) {
      // pi has no sandbox parameter, so it cannot be restricted to writing only the working directory and to no network access (architecture design §6.9).
      throw new RpcError('driver-unavailable', DriversCommon.confinedUnsupported({ name: 'Pi' }));
    }
    // The temp directory holds the developer instructions and the MCP extension (which contains a token): only the owner can read it, and it is deleted when the session closes.
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pi-'));
    await fs.chmod(tempDir, 0o700);
    const session = new PiSession(options.cwd, tempDir, log);
    try {
      await session.#open(install, options);
    } catch (error) {
      await session.#proc?.close();
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      if (error instanceof RpcError) throw error;
      throw agentError('driver-failed', DriversCommon.startFailed({ name: 'Pi', error: piErrorMessage(error) }), null);
    }
    return session;
  }

  async #open(install: PiInstall, options: CreateSessionOptions): Promise<void> {
    const args = ['--mode', 'rpc'];
    const instructions = options.developerInstructions?.trim();
    if (instructions) {
      // Written to a file and passed to --append-system-prompt: instructions can be long, and this keeps them out of the process list.
      const file = path.join(this.#tempDir, 'instructions.md');
      await fs.writeFile(file, instructions, { mode: 0o600 });
      args.push('--append-system-prompt', file);
    }
    const extension = await this.#writeMcpExtension(options.mcpServers);
    if (extension) args.push('--extension', extension);

    const resume = readPersistence(options.resume);
    if (resume) {
      const exists = await fs
        .stat(resume.sessionFile)
        .then((s) => s.isFile())
        .catch(() => false);
      if (exists) args.push('--session', resume.sessionFile);
      else {
        // If native session resume fails, say so honestly rather than pretending the context is still there (architecture design §2.5). pi writes the session file only after the first reply.
        this.#warn(DriversCommon.resumeFailed({ name: 'Pi', error: DriversPi.sessionFileMissing() }));
      }
    }

    this.#proc = new PiRpcProcess({ command: install.command, args, cwd: options.cwd, env: { ...install.env, ...PI_ENV } }, this.#log);
    this.#proc.onMessage((message) => this.#onEvent(message));
    void this.#proc.exited.then((reason) => this.#onExit(reason));
    try {
      this.#state = ((await this.#proc.request({ type: 'get_state' })) ?? {}) as PiState;
    } catch (error) {
      const tail = this.#proc.stderrTail();
      const text = piErrorMessage(error);
      throw new Error(tail && !text.includes(tail) ? String(DriversPi.withStderr({ error: text, tail })) : text);
    }
    this.#checkAccess(options.accessMode);
  }

  /**
   * CucCut's tool channel (an MCP service over Streamable HTTP). pi 1.0 has built-in MCP support, but it reads only its own mcp.json.
   * So here a per-process extension is written, used only by this process, which calls `registerMcpServer` on load. `exposure: 'direct'` declares the tools to the model directly, like built-in tools (the default codemode requires the model to write a script before it can call them). The timeout, like native approval, “waits indefinitely” (MCP_TOOL_CALL_TIMEOUT_MS, in seconds).
   * If an extension that replaces the built-in MCP is installed, the registration is reported as extension_error, and the user is then told.
   */
  async #writeMcpExtension(servers: Record<string, McpServerSpec> | undefined): Promise<string | null> {
    const entries = Object.entries(servers ?? {}).filter(([name]) => {
      if (MCP_NAME.test(name)) return true;
      this.#warn(DriversPi.mcpNameInvalid({ name }));
      return false;
    });
    if (!entries.length) return null;
    const timeout = Math.round(MCP_TOOL_CALL_TIMEOUT_MS / 1000);
    const config = Object.fromEntries(
      entries.map(([name, spec]) => [name, { url: spec.url, headers: spec.headers, exposure: 'direct', timeout }]),
    );
    const source = [
      // i18n-ignore: comment written into the source code of the Pi extension; it is handed to Pi to load and is not shown to people
      '// Extension CucCut generates for this Pi session: registers the CucCut MCP server. Deleted when the session ends.',
      `const servers = ${JSON.stringify(config)};`,
      'export default function cuccut(pi) {',
      '  for (const [name, config] of Object.entries(servers)) pi.registerMcpServer(name, config);',
      '}',
      '',
    ].join('\n');
    const file = path.join(this.#tempDir, `cuccut-mcp-${randomUUID().slice(0, 8)}.mjs`);
    await fs.writeFile(file, source, { mode: 0o600 });
    this.#mcpExtension = file;
    return file;
  }

  async startTurn(input: AgentInput, settings: TurnSettings): Promise<{ turnId: string }> {
    if (this.#closed || this.#proc.hasExited) throw new Error(String(DriversCommon.sessionClosed({ name: 'Pi' })));
    if (this.#turn) throw new Error(String(DriversCommon.turnInProgress()));
    this.#checkAccess(settings.accessMode);
    await this.#applyModel(settings);
    await this.#applyEffort(settings);
    const message = await this.#message(input);
    const turnId = newId('turn');
    const turn: Turn = {
      id: turnId,
      mapper: new PiItemMapper(turnId, this.#cwd),
      cancelled: false,
      started: false,
      stopReason: null,
      errorMessage: null,
      settleTimer: null,
    };
    this.#turn = turn;
    this.#emit({ type: 'turn.started', turnId });
    this.#proc.request({ type: 'prompt', ...message }, PROMPT_ACK_TIMEOUT_MS).then(
      (data) => {
        // handled: the extension or command handled it itself, no model call was started, so there will be no agent_settled.
        if ((data as { disposition?: unknown } | null)?.disposition === 'handled') this.#finish(turn);
      },
      (error: unknown) => {
        // The process exited: left to session.exited (the Harness records AGENT_EXITED); not reported again here.
        if (this.#proc.hasExited) return;
        if (turn.cancelled) return this.#finish(turn);
        const text = piErrorMessage(error);
        this.#finish(turn, { error: text, code: errorCode(text) });
      },
    );
    return { turnId };
  }

  async steer(turnId: string, input: AgentInput): Promise<'accepted' | 'unavailable'> {
    const turn = this.#turn;
    if (!turn || turn.id !== turnId || turn.cancelled) return 'unavailable';
    try {
      // pi hands it to the model after the current batch of tool calls ends, and before the next model call.
      await this.#proc.request({ type: 'steer', ...(await this.#message(input)) });
      return 'accepted';
    } catch (error) {
      // Older versions reply “Unknown command: steer”. Other errors (for example, the turn happening to end) are likewise handed to the Harness to queue for the next turn.
      this.#log.info('Pi does not accept steer', { error: piErrorMessage(error) });
      return 'unavailable';
    }
  }

  async interrupt(turnId: string): Promise<InterruptReceipt> {
    const turn = this.#turn;
    if (!turn || turn.id !== turnId) return { status: 'not-running' };
    turn.cancelled = true;
    // Clear any queued steer / follow_up first, so they do not start another turn after abort. Older versions have no clear_queue; ignore it.
    await this.#proc.requestStopWork({ type: 'clear_queue' }, 5_000).catch(() => undefined);
    // abort waits until pi is idle before replying (after the running command has been killed). If no reply comes for a short time, it still counts as sent; only a failure to send counts as unknown.
    const abort = this.#proc.requestStopWork({ type: 'abort' }, null);
    const outcome = await Promise.race([
      abort.then(
        () => 'ok' as const,
        (error: unknown) => {
          this.#log.warn('Pi interrupt failed', { error: piErrorMessage(error) });
          return 'failed' as const;
        },
      ),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 5_000).unref()),
    ]);
    if (outcome === 'ok' && this.#turn === turn && !turn.started) this.#finish(turn);
    return { status: outcome === 'failed' ? 'unknown' : 'requested' };
  }

  /** pi does not request approval (`capabilities.approvals` is false), so there is nothing to answer here. */
  async respondToApproval(_approvalId: Id, _response: ApprovalResponse): Promise<void> {}

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.#listeners.add(listener);
    const early = this.#early;
    if (early) {
      this.#early = null;
      // The subscriber may not have registered this session yet (AgentManager records it only after subscribing): re-emit on the next microtask.
      queueMicrotask(() => early.forEach((event) => this.#emit(event)));
    }
    return () => this.#listeners.delete(listener);
  }

  describePersistence(): AgentPersistenceHandle | null {
    const sessionFile = this.#state.sessionFile;
    if (!sessionFile) return null;
    const data: PiPersistence = { sessionFile, sessionId: this.#state.sessionId ?? null };
    return { driverId: PI_DRIVER_ID, data };
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#turn?.settleTimer) clearTimeout(this.#turn.settleTimer);
    await this.#proc.close();
    await fs.rm(this.#tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  // ---- Per-turn settings ----

  #checkAccess(mode: TurnSettings['accessMode']): void {
    if (mode === 'fullAccess' || this.#accessWarned) return;
    this.#accessWarned = true;
    this.#warn(piAccessWarning());
  }

  async #applyModel(settings: TurnSettings): Promise<void> {
    if (!settings.model) return;
    const current = this.#state.model;
    if (current && piModelId(current) === settings.model) return;
    const ref = parseModelReference(settings.model);
    const provider = ref.provider ?? (current && current.provider !== 'unknown' ? current.provider : null);
    if (!provider) throw agentError('driver-failed', DriversPi.modelFormat({ model: settings.model }), 'AGENT_MODEL_UNAVAILABLE');
    try {
      const model = (await this.#proc.request({ type: 'set_model', provider, modelId: ref.id })) as PiModel | null;
      this.#state.model = model ?? { provider, id: ref.id };
    } catch (error) {
      throw agentError('driver-failed', DriversPi.switchModelFailed({ model: settings.model, error: piErrorMessage(error) }), 'AGENT_MODEL_UNAVAILABLE');
    }
  }

  async #applyEffort(settings: TurnSettings): Promise<void> {
    const level = settings.effort;
    if (!level || level === this.#state.thinkingLevel) return;
    if (!isPiThinkingLevel(level)) {
      this.#warn(DriversPi.effortUnsupported({ level }));
      return;
    }
    try {
      await this.#proc.request({ type: 'set_thinking_level', level });
      this.#state.thinkingLevel = level;
    } catch (error) {
      this.#warn(DriversPi.effortFailed({ error: piErrorMessage(error) }));
    }
  }

  /** Message body for prompt / steer. When the model does not accept images, images are not sent; instead, the local path of each image is appended after the text (pi has a read tool). */
  async #message(input: AgentInput): Promise<{ message: string; images?: Array<{ type: 'image'; data: string; mimeType: string }> }> {
    const images = input.images ?? [];
    if (!images.length) return { message: input.text };
    if (!piModelTakesImages(this.#state.model)) {
      // i18n-ignore: image path hint appended after the prompt, handed to the model
      const hints = images.map((image) => `[Image: ${image.path}]`).join('\n');
      return { message: `${input.text}\n\n${hints}` };
    }
    const encoded = await Promise.all(
      images.map(async (image) => ({
        type: 'image' as const,
        data: (await fs.readFile(image.path)).toString('base64'),
        mimeType: image.mimeType,
      })),
    );
    return { message: input.text, images: encoded };
  }

  // ---- Events ----

  #onEvent(event: Record<string, unknown>): void {
    switch (event.type) {
      case 'extension_ui_request':
        return this.#onUiRequest(event);
      case 'extension_error': {
        const error = String(event.error ?? '');
        if (this.#mcpExtension && String(event.extensionPath ?? '') === this.#mcpExtension) {
          this.#warn(DriversPi.mcpConnectFailed({ error }));
        } else {
          this.#warn(DriversPi.extensionError({ error }));
        }
        return;
      }
      case 'auto_retry_start': {
        const message: DriverText = event.errorMessage != null ? String(event.errorMessage) : DriversPi.modelCallFailed();
        this.#emit({
          type: 'session.error',
          turnId: this.#turn?.id ?? null,
          message: String(message),
          ...refField('messageRef', message),
          willRetry: true,
          code: errorCode(String(event.errorMessage ?? '')),
        });
        return;
      }
      case 'auto_retry_end':
        if (event.success === false && this.#turn && typeof event.finalError === 'string') this.#turn.errorMessage = event.finalError;
        return;
    }
    const turn = this.#turn;
    if (!turn) return;
    switch (event.type) {
      case 'agent_start':
        turn.started = true;
        if (turn.settleTimer) clearTimeout(turn.settleTimer);
        turn.settleTimer = null;
        break;
      case 'message_end': {
        const message = (event.message ?? {}) as { role?: unknown; stopReason?: unknown; errorMessage?: unknown };
        if (message.role === 'assistant') {
          turn.stopReason = typeof message.stopReason === 'string' ? message.stopReason : null;
          turn.errorMessage = typeof message.errorMessage === 'string' && message.errorMessage ? message.errorMessage : null;
        }
        break;
      }
      case 'agent_end':
        // There may be later automatic retries, restarts after compaction, and queued steers: agent_settled is authoritative. Older versions do not send agent_settled; if nothing happens for a while, finish.
        if (event.willRetry !== true && !this.#settles) {
          if (turn.settleTimer) clearTimeout(turn.settleTimer);
          turn.settleTimer = setTimeout(() => this.#finish(turn), SETTLE_FALLBACK_MS);
          turn.settleTimer.unref?.();
        }
        break;
      case 'agent_settled':
        this.#settles = true;
        this.#finish(turn);
        return;
    }
    for (const mapped of turn.mapper.map(event)) this.#emit(mapped);
  }

  /** An extension asks the user for an answer (select / confirm / input / editor). CucCut has no channel for this, so cancel immediately; notifications are turned into hints. */
  #onUiRequest(event: Record<string, unknown>): void {
    const method = String(event.method ?? '');
    if (method === 'notify') {
      if (event.notifyType === 'error' || event.notifyType === 'warning') this.#warn(DriversPi.notice({ message: String(event.message ?? '') }));
      return;
    }
    if (!['select', 'confirm', 'input', 'editor'].includes(method)) return; // setStatus, setWidget and the like need no reply
    this.#proc.send({ type: 'extension_ui_response', id: event.id, cancelled: true });
    if (!this.#askWarned) {
      this.#askWarned = true;
      const title = typeof event.title === 'string' ? event.title : '';
      this.#warn(DriversPi.extensionAsked({ title }));
    }
  }

  #finish(turn: Turn, failure?: { error: string; code: AgentErrorCode | null }): void {
    if (this.#turn !== turn) return;
    if (turn.settleTimer) clearTimeout(turn.settleTimer);
    for (const mapped of turn.mapper.finish()) this.#emit(mapped);
    this.#turn = null;
    let outcome: 'completed' | 'interrupted' | 'failed' = 'completed';
    let error: DriverText | null = null;
    let code: AgentErrorCode | null = null;
    if (turn.cancelled || turn.stopReason === 'aborted') outcome = 'interrupted';
    else if (failure) ({ error, code } = failure);
    else if (turn.stopReason === 'error' || turn.errorMessage) {
      error = turn.errorMessage ?? DriversPi.modelCallFailed();
      code = errorCode(String(error));
    }
    if (error) outcome = 'failed';
    this.#emit({ type: 'turn.completed', turnId: turn.id, outcome, error: textOf(error), ...refField('errorRef', error), errorCode: code });
  }

  #onExit(reason: Localized): void {
    const turn = this.#turn;
    if (turn) {
      if (turn.settleTimer) clearTimeout(turn.settleTimer);
      for (const mapped of turn.mapper.finish()) this.#emit(mapped);
      this.#turn = null;
    }
    this.#emit({ type: 'session.exited', error: this.#closed ? null : String(reason), ...(this.#closed ? {} : refField('errorRef', reason)) });
  }

  #warn(message: DriverText): void {
    this.#emit({ type: 'session.warning', message: String(message), ...refField('messageRef', message) });
  }

  #emit(event: AgentEvent): void {
    // Hints emitted during session startup (resume failure, access mode) come before the Harness subscribes: hold them and re-emit on subscribe.
    if (this.#early) {
      this.#early.push(event);
      return;
    }
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#log.error('AgentEvent listener threw', { error: String(error) });
      }
    }
  }
}

function readPersistence(handle: AgentPersistenceHandle | null): PiPersistence | null {
  if (!handle || handle.driverId !== PI_DRIVER_ID) return null;
  const data = handle.data as { sessionFile?: unknown; sessionId?: unknown } | null;
  if (typeof data?.sessionFile !== 'string' || !data.sessionFile) return null;
  return { sessionFile: data.sessionFile, sessionId: typeof data.sessionId === 'string' ? data.sessionId : null };
}

/** Error text → structured reason (pi's errors are text only). */
export function errorCode(text: string): AgentErrorCode | null {
  if (/no api key|not logged in|\/login|unauthori[sz]ed|authentication|\b401\b|invalid api key/i.test(text)) return 'AGENT_AUTH_REQUIRED';
  if (/rate.?limit|too many requests|\b429\b/i.test(text)) return 'AGENT_RATE_LIMITED';
  if (/credit|billing|quota|insufficient.?balance|\b402\b/i.test(text)) return 'AGENT_BILLING_REQUIRED';
  return null;
}
