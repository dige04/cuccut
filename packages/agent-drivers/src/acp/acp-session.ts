/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * ACPAgentSession in packages/server/src/server/agent/providers/acp-agent.ts: initializeResumedSession (session/load first, then session/resume; cwd and mcpServers are not lost when resuming), replayingHistory (history replayed during load is not treated as new content), handlePromptResponse (stopReason → turn result), the pending table for requestPermission, setMode / setModel (session/set_model), closeSession; and the generic session assembly in generic-acp-agent.ts.
 * Changed to CucCut's AgentSession events; "allow for this session" is recorded by the Driver itself, and the native "always allow" is never chosen; access modes map to the stricter side.
 */
import fs from 'node:fs/promises';
import { RpcError, newId, normalizeAgentMode, type AgentErrorCode, type DriverProbe, type Id, type Localized } from '@cuccut/protocol';
import { DriversAcp, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import type {
  AgentEvent,
  AgentInput,
  AgentPersistenceHandle,
  AgentSession,
  ApprovalResponse,
  CreateSessionOptions,
  InterruptReceipt,
  Logger,
  TurnSettings,
} from '@cuccut/harness';
import type {
  AgentCapabilities,
  Client,
  ContentBlock,
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  SessionUpdate,
} from '@agentclientprotocol/sdk';
import { refField, textOf, type DriverText } from '../driver-text.ts';
import type { AcpInstall } from './acp-binary.ts';
import { AcpProcess, acpErrorMessage, isAuthRequired, withTimeout } from './acp-connection.ts';
import {
  acpMcpServers,
  approvalOf,
  availableModes,
  contentText,
  findSelectOption,
  isOwnMcpTool,
  mergeToolSnapshot,
  planText,
  selectPermissionOption,
  toolItem,
  type AcpSessionState,
  type ToolSnapshot,
} from './acp-items.ts';
import { ACP_ENV, loginAdvice, type AcpPreset } from './acp-presets.ts';

/** Session capabilities: ACP has no channel for interjecting into an in-progress turn; images and resume depend on the agent's `initialize` response. */
export function acpCapabilities(caps: AgentCapabilities | null | undefined): DriverProbe['capabilities'] {
  return {
    steer: false,
    approvals: true,
    resume: caps?.loadSession === true || !!caps?.sessionCapabilities?.resume,
    images: caps?.promptCapabilities?.image === true,
  };
}

/** A startup error with a structured reason: the Harness reads `agentCode` (such as `AGENT_AUTH_REQUIRED`). */
export function agentError(code: ConstructorParameters<typeof RpcError>[0], message: string | Localized, agentCode: AgentErrorCode | null): RpcError {
  const error = new RpcError(code, message);
  return agentCode ? Object.assign(error, { agentCode }) : error;
}

interface OpenMessage {
  id: string;
  kind: 'agent-message' | 'reasoning';
  text: string;
}

interface Turn {
  id: string;
  cancelled: boolean;
  message: OpenMessage | null;
  tools: Map<string, ToolSnapshot>;
  finished: Set<string>;
  declined: Set<string>;
  planId: string | null;
}

interface PendingApproval {
  turnId: string;
  toolCallId: string;
  options: PermissionOption[];
  grantKey: string;
  resolve: (response: RequestPermissionResponse) => void;
}

const CANCELLED: RequestPermissionResponse = { outcome: { outcome: 'cancelled' } };

export class AcpSession implements AgentSession {
  readonly id: Id = newId('ags');
  capabilities: DriverProbe['capabilities'] = acpCapabilities(null);

  readonly #preset: AcpPreset;
  readonly #log: Logger;
  readonly #cwd: string;
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  readonly #approvals = new Map<Id, PendingApproval>();
  /** Categories "allowed for this session" (the classification keys of `approvalOf`): later requests of the same category are answered directly without asking. */
  readonly #grants = new Set<string>();
  /** The MCP service names passed to the agent (CucCut's tool channel): native approvals for these tools are allowed directly (`isOwnMcpTool`). */
  #mcpServerNames: ReadonlySet<string> = new Set();
  #proc!: AcpProcess;
  #sessionId: string | null = null;
  #state: AcpSessionState = {};
  #modeId: string | null = null;
  #modelId: string | null = null;
  #modeWarned = false;
  /** While `session/load` replays history: these updates are old content and are not treated as output of this turn. */
  #replaying = false;
  /** Developer instructions prepended to the first turn of a new session (ACP's `session/new` has no such field). */
  #instructions: string | null = null;
  #turn: Turn | null = null;
  #closed = false;
  #early: AgentEvent[] | null = [];

  private constructor(preset: AcpPreset, options: CreateSessionOptions, log: Logger) {
    this.#preset = preset;
    this.#cwd = options.cwd;
    this.#log = log;
  }

  static async start(install: AcpInstall, preset: AcpPreset, options: CreateSessionOptions, log: Logger): Promise<AcpSession> {
    if (options.confinement) {
      // ACP has no sandbox parameter, so it cannot restrict writes to the working directory only or block network access (architecture design §6.9).
      throw new RpcError('driver-unavailable', DriversCommon.confinedUnsupported({ name: preset.name }));
    }
    const session = new AcpSession(preset, options, log);
    const client: Client = {
      requestPermission: (params) => session.#onPermission(params),
      sessionUpdate: (params) => session.#onUpdate(params),
    };
    try {
      session.#proc = await AcpProcess.start({
        command: install.command,
        args: preset.args,
        cwd: options.cwd,
        env: { ...install.env, ...preset.env, ...ACP_ENV },
        log,
        label: preset.name,
        client,
      });
    } catch (error) {
      throw agentError('driver-failed', DriversCommon.startFailed({ name: preset.name, error: acpErrorMessage(error) }), null);
    }
    try {
      await session.#open(options);
    } catch (error) {
      await session.#proc.close();
      if (error instanceof RpcError) throw error;
      if (isAuthRequired(error)) {
        throw agentError(
          'driver-unavailable',
          DriversAcp.signedOut({ name: preset.name, login: loginAdvice(preset), detail: acpErrorMessage(error) }),
          'AGENT_AUTH_REQUIRED',
        );
      }
      throw agentError('driver-failed', DriversCommon.openSessionFailed({ name: preset.name, error: acpErrorMessage(error) }), null);
    }
    void session.#proc.exited.then((reason) => session.#onExit(reason));
    return session;
  }

  async #open(options: CreateSessionOptions): Promise<void> {
    const caps = this.#proc.init.agentCapabilities;
    this.capabilities = acpCapabilities(caps);
    const conn = this.#proc.connection;
    let mcpServers = acpMcpServers(options.mcpServers);
    if (mcpServers.length > 0 && caps?.mcpCapabilities?.http !== true) {
      // Known limitation: CucCut's tool channel only offers Streamable HTTP, and there is no adapter for agents that only accept stdio.
      mcpServers = [];
      this.#warn(DriversAcp.mcpHttpUnsupported({ name: this.#preset.name }));
    }
    this.#mcpServerNames = new Set(mcpServers.map((server) => server.name));
    const params = { cwd: options.cwd, mcpServers };

    const resumeId = readSessionId(options.resume, this.#preset.id);
    if (resumeId) {
      try {
        if (caps?.loadSession) {
          this.#replaying = true;
          try {
            const res = await conn.loadSession({ sessionId: resumeId, ...params });
            this.#adopt(resumeId, res as AcpSessionState);
          } finally {
            this.#replaying = false;
          }
          return;
        }
        if (caps?.sessionCapabilities?.resume) {
          const res = await conn.resumeSession({ sessionId: resumeId, ...params });
          this.#adopt(resumeId, res as AcpSessionState);
          return;
        }
        throw new Error(String(DriversAcp.resumeUnsupported({ name: this.#preset.name })));
      } catch (error) {
        if (isAuthRequired(error)) throw error;
        // If native session resume fails, say so honestly; do not pretend the context is still there (architecture design §2.5).
        this.#log.warn('ACP session resume failed; starting a new one', { error: acpErrorMessage(error) });
        this.#warn(DriversCommon.resumeFailed({ name: this.#preset.name, error: acpErrorMessage(error) }));
      }
    }
    const res = await conn.newSession(params);
    this.#adopt(res.sessionId, res as AcpSessionState);
    this.#instructions = options.developerInstructions?.trim() || null;
  }

  #adopt(sessionId: string, state: AcpSessionState): void {
    this.#sessionId = sessionId;
    this.#state = { modes: state.modes ?? null, models: state.models ?? null, configOptions: state.configOptions ?? null };
    this.#modeId = state.modes?.currentModeId ?? findSelectOption(state.configOptions, 'mode')?.currentValue ?? null;
    this.#modelId = state.models?.currentModelId ?? findSelectOption(state.configOptions, 'model')?.currentValue ?? null;
  }

  async startTurn(input: AgentInput, settings: TurnSettings): Promise<{ turnId: string }> {
    if (this.#closed) throw new Error(String(DriversCommon.sessionClosed({ name: this.#preset.name })));
    if (this.#turn) throw new Error(String(DriversCommon.turnInProgress()));
    const sessionId = this.#requireSession();
    await this.#applyMode(settings);
    await this.#applyModel(settings);
    const prompt = await this.#prompt(input);
    const turnId = newId('turn');
    const turn: Turn = {
      id: turnId,
      cancelled: false,
      message: null,
      tools: new Map(),
      finished: new Set(),
      declined: new Set(),
      planId: null,
    };
    this.#turn = turn;
    this.#instructions = null;
    this.#emit({ type: 'turn.started', turnId });
    this.#proc.connection.prompt({ sessionId, prompt }).then(
      (res) => this.#finishTurn(turn, res.stopReason === 'cancelled' || turn.cancelled ? 'interrupted' : 'completed', null, null),
      async (error: unknown) => {
        // The process exited: this is handed to session.exited (the Harness records AGENT_EXITED), so it is not reported again here.
        const exited = await withTimeout(
          this.#proc.exited.then(() => true),
          300,
          'alive',
        ).catch(() => false);
        if (exited && !turn.cancelled) return this.#dropTurn(turn);
        if (turn.cancelled) return this.#finishTurn(turn, 'interrupted', null, null);
        const code: AgentErrorCode | null = isAuthRequired(error) ? 'AGENT_AUTH_REQUIRED' : null;
        this.#finishTurn(turn, 'failed', acpErrorMessage(error), code);
      },
    );
    return { turnId };
  }

  async interrupt(turnId: string): Promise<InterruptReceipt> {
    const turn = this.#turn;
    if (!turn || turn.id !== turnId) return { status: 'not-running' };
    turn.cancelled = true;
    // After ACP requires cancellation, all pending approvals are answered with cancelled.
    this.#settleApprovals(turn.id);
    try {
      await withTimeout(this.#proc.connection.cancel({ sessionId: this.#requireSession() }), 15_000, 'session/cancel timed out');
      return { status: 'requested' };
    } catch (error) {
      this.#log.warn('ACP interrupt request failed', { error: acpErrorMessage(error) });
      return { status: 'unknown' };
    }
  }

  async respondToApproval(approvalId: Id, response: ApprovalResponse): Promise<void> {
    const pending = this.#approvals.get(approvalId);
    if (!pending) return;
    this.#approvals.delete(approvalId);
    // "Always allow" rules are stored by the Harness. The native side only handles session-level allowance, which is recorded here; it never selects the agent's own allow_always.
    if (response.decision === 'accept-for-session' || response.decision === 'accept-always') this.#grants.add(pending.grantKey);
    switch (response.decision) {
      case 'accept':
      case 'accept-for-session':
      case 'accept-always': {
        const option = selectPermissionOption(pending.options, 'allow');
        if (option) {
          pending.resolve({ outcome: { outcome: 'selected', optionId: option.optionId } });
          return;
        }
        // The agent offered only "always allow": the user's persistent settings in it are not written, and this request is treated as a rejection.
        this.#warn(DriversAcp.onlyAlwaysAllow({ name: this.#preset.name }));
        this.#reject(pending);
        return;
      }
      case 'decline':
        this.#reject(pending);
        return;
      case 'cancel':
        pending.resolve(CANCELLED);
        if (this.#turn?.id === pending.turnId) await this.interrupt(pending.turnId);
        return;
    }
  }

  #reject(pending: PendingApproval): void {
    if (this.#turn?.id === pending.turnId) this.#turn.declined.add(pending.toolCallId);
    const option = selectPermissionOption(pending.options, 'reject');
    pending.resolve(option ? { outcome: { outcome: 'selected', optionId: option.optionId } } : CANCELLED);
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.#listeners.add(listener);
    const early = this.#early;
    if (early) {
      this.#early = null;
      // The subscriber may not have registered this session yet (AgentManager records it after subscribing), so re-emit on the next microtask.
      queueMicrotask(() => early.forEach((event) => this.#emit(event)));
    }
    return () => this.#listeners.delete(listener);
  }

  describePersistence(): AgentPersistenceHandle | null {
    return this.#sessionId ? { driverId: this.#preset.id, data: { sessionId: this.#sessionId } } : null;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#settleApprovals(null);
    const caps = this.#proc.init.agentCapabilities;
    if (this.#sessionId && caps?.sessionCapabilities?.close && !this.#proc.hasExited) {
      await withTimeout(this.#proc.connection.closeSession({ sessionId: this.#sessionId }), 2000, 'session/close timed out').catch(
        () => undefined,
      );
    }
    await this.#proc.close();
  }

  // ---- Mode and model per turn ----

  /**
   * Access mode → session mode: takes the first candidate from the preset that the agent has (see the mapping table in acp-presets.ts). For presets with an "allow all" config option (`permissionOption`), it is turned on in full access and turned off in other modes; when leaving full access, it is turned off before the mode is changed.
   */
  async #applyMode(settings: TurnSettings): Promise<void> {
    const mode = normalizeAgentMode(settings.accessMode);
    if (mode !== 'fullAccess') await this.#applyPermissionOption(false);
    const candidates = this.#preset.modes[mode === 'plan' ? 'plan' : mode === 'fullAccess' ? 'fullAccess' : 'ask'];
    const available = availableModes(this.#state);
    const target = candidates.find((id) => available.ids.includes(id)) ?? null;
    if (!target) {
      this.#warnModeOnce();
    } else if (target !== this.#modeId) {
      const sessionId = this.#requireSession();
      try {
        if (available.via === 'config' && available.configId) {
          const res = await this.#proc.connection.setSessionConfigOption({ sessionId, configId: available.configId, value: target });
          if (res?.configOptions?.length) this.#state.configOptions = res.configOptions;
        } else {
          await this.#proc.connection.setSessionMode({ sessionId, modeId: target });
        }
        this.#modeId = target;
      } catch (error) {
        // If the mode cannot be set, do not start this turn: running in a broader mode would go beyond CucCut's access mode.
        throw agentError('driver-failed', DriversAcp.modeSwitchFailed({ name: this.#preset.name, mode: target, error: acpErrorMessage(error) }), null);
      }
    }
    if (mode === 'fullAccess') await this.#applyPermissionOption(true);
  }

  /**
   * The "allow all" config option (`permissionOption`) is set to `on` / `off`; if it already has that value, nothing is sent. If the session has no such config option: when turning it on, a notice is shown once (it runs with per-item confirmation, which is stricter); when turning it off, there is nothing to do. If it cannot be turned off, the turn does not start (it would be broader than CucCut's mode); if it cannot be turned on, only a notice is shown (stricter).
   */
  async #applyPermissionOption(on: boolean): Promise<void> {
    const spec = this.#preset.permissionOption;
    if (!spec) return;
    const option = this.#state.configOptions?.find((o) => o.type === 'select' && o.id === spec.configId);
    if (!option) {
      if (on) this.#warnModeOnce(DriversAcp.noAllowAllSwitch({ name: this.#preset.name, configId: spec.configId }));
      return;
    }
    const value = on ? spec.on : spec.off;
    if (option.type === 'select' && option.currentValue === value) return;
    const sessionId = this.#requireSession();
    try {
      const res = await this.#proc.connection.setSessionConfigOption({ sessionId, configId: spec.configId, value });
      if (res?.configOptions?.length) this.#state.configOptions = res.configOptions;
      else if (option.type === 'select') option.currentValue = value;
    } catch (error) {
      const message = DriversAcp.setOptionFailed({ name: this.#preset.name, configId: spec.configId, value, error: acpErrorMessage(error) });
      if (!on) throw agentError('driver-failed', message, null);
      this.#warn(DriversAcp.stillAskThisTurn({ failure: message }));
    }
  }

  /** The access mode cannot be mapped onto the agent (no matching session mode or switch): a notice is shown only once for the whole session. */
  #warnModeOnce(message?: Localized): void {
    if (this.#modeWarned) return;
    this.#modeWarned = true;
    this.#warn(message ?? DriversAcp.noMatchingMode({ name: this.#preset.name }));
  }

  async #applyModel(settings: TurnSettings): Promise<void> {
    const model = settings.model;
    if (!model || model === this.#modelId) return;
    const sessionId = this.#requireSession();
    const option = findSelectOption(this.#state.configOptions, 'model');
    try {
      if (option) {
        const res = await this.#proc.connection.setSessionConfigOption({ sessionId, configId: option.id, value: model });
        if (res?.configOptions?.length) this.#state.configOptions = res.configOptions;
      } else if (this.#state.models) {
        // Legacy model switching (the SDK 0.29 wrapper no longer has this method).
        await this.#proc.connection.extMethod('session/set_model', { sessionId, modelId: model });
      } else {
        this.#warn(DriversAcp.modelSwitchUnsupported({ name: this.#preset.name }));
        this.#modelId = model;
        return;
      }
      this.#modelId = model;
    } catch (error) {
      throw agentError(
        'driver-failed',
        DriversCommon.modelSwitchFailed({ name: this.#preset.name, model, error: acpErrorMessage(error) }),
        'AGENT_MODEL_UNAVAILABLE',
      );
    }
  }

  /** CucCut input → ACP content blocks: on the first turn of a new session, developer instructions are attached first, then text and images (the Harness does not pass images when they are unsupported). */
  async #prompt(input: AgentInput): Promise<ContentBlock[]> {
    const blocks: ContentBlock[] = [];
    if (this.#instructions) blocks.push({ type: 'text', text: `<system-instructions>\n${this.#instructions}\n</system-instructions>` });
    if (input.text || !input.images?.length) blocks.push({ type: 'text', text: input.text });
    for (const image of input.images ?? []) {
      blocks.push({ type: 'image', mimeType: image.mimeType, data: (await fs.readFile(image.path)).toString('base64') });
    }
    return blocks;
  }

  // ---- Requests and notifications from the agent ----

  async #onPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const turn = this.#turn;
    if (this.#replaying || !turn || turn.cancelled || params.sessionId !== this.#sessionId) return CANCELLED;
    const id = params.toolCall.toolCallId;
    const snapshot = mergeToolSnapshot(id, params.toolCall, turn.tools.get(id));
    turn.tools.set(id, snapshot);
    if (isOwnMcpTool(snapshot, this.#mcpServerNames)) {
      const option = selectPermissionOption(params.options, 'allow');
      if (option) return { outcome: { outcome: 'selected', optionId: option.optionId } };
    }
    const { request, grantKey } = approvalOf(snapshot, this.#cwd);
    if (this.#grants.has(grantKey)) {
      const option = selectPermissionOption(params.options, 'allow');
      if (option) return { outcome: { outcome: 'selected', optionId: option.optionId } };
    }
    return new Promise((resolve) => {
      const approvalId = newId('appr');
      this.#approvals.set(approvalId, { turnId: turn.id, toolCallId: id, options: params.options, grantKey, resolve });
      this.#emit({ type: 'approval.requested', turnId: turn.id, approvalId, request });
    });
  }

  #onUpdate(notification: SessionNotification): void {
    if (this.#replaying || notification.sessionId !== this.#sessionId) return;
    const update: SessionUpdate = notification.update;
    switch (update.sessionUpdate) {
      case 'current_mode_update':
        this.#modeId = update.currentModeId;
        return;
      case 'config_option_update':
        this.#state.configOptions = update.configOptions;
        return;
      case 'available_commands_update':
        // Slash commands: CucCut's UI does not list them for now.
        return;
    }
    const turn = this.#turn;
    if (!turn) {
      this.#log.debug('Ignoring ACP update outside a turn', { kind: update.sessionUpdate });
      return;
    }
    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        this.#append(turn, 'agent-message', contentText(update.content));
        return;
      case 'agent_thought_chunk':
        this.#append(turn, 'reasoning', contentText(update.content));
        return;
      case 'tool_call':
      case 'tool_call_update': {
        this.#closeMessage(turn);
        const id = update.toolCallId;
        const previous = turn.tools.get(id);
        const snapshot = mergeToolSnapshot(id, update, previous);
        turn.tools.set(id, snapshot);
        const terminal = snapshot.status === 'completed' || snapshot.status === 'failed';
        if (terminal && !turn.finished.has(id)) {
          turn.finished.add(id);
          const status = turn.declined.has(id) && snapshot.status === 'failed' ? 'declined' : undefined;
          this.#emit({ type: 'item.completed', turnId: turn.id, item: toolItem(snapshot, status, this.#cwd) });
        } else if (!terminal && (!previous || update.sessionUpdate === 'tool_call')) {
          this.#emit({ type: 'item.started', turnId: turn.id, item: toolItem(snapshot, undefined, this.#cwd) });
        }
        return;
      }
      case 'plan': {
        this.#closeMessage(turn);
        turn.planId ??= newId('item');
        this.#emit({ type: 'item.completed', turnId: turn.id, item: { kind: 'agent-message', id: turn.planId, text: planText(update) } });
        return;
      }
      default:
        this.#log.debug('Ignoring ACP update', { kind: update.sessionUpdate });
    }
  }

  #append(turn: Turn, kind: OpenMessage['kind'], text: string): void {
    if (!text) return;
    if (turn.message && turn.message.kind !== kind) this.#closeMessage(turn);
    turn.message ??= { id: newId('item'), kind, text: '' };
    turn.message.text += text;
    this.#emit({
      type: 'item.delta',
      turnId: turn.id,
      itemId: turn.message.id,
      channel: kind === 'reasoning' ? 'reasoning' : 'text',
      delta: text,
    });
  }

  #closeMessage(turn: Turn): void {
    const message = turn.message;
    if (!message) return;
    turn.message = null;
    this.#emit({ type: 'item.completed', turnId: turn.id, item: { kind: message.kind, id: message.id, text: message.text } });
  }

  #finishTurn(turn: Turn, outcome: 'completed' | 'interrupted' | 'failed', error: DriverText | null, code: AgentErrorCode | null): void {
    if (this.#turn !== turn) return;
    this.#closeMessage(turn);
    // Steps without a terminal state when the turn ends: a rejected one is recorded as declined; the others must not be treated as completed.
    for (const [id, snapshot] of turn.tools) {
      if (turn.finished.has(id)) continue;
      turn.finished.add(id);
      this.#emit({
        type: 'item.completed',
        turnId: turn.id,
        item: toolItem(snapshot, turn.declined.has(id) ? 'declined' : 'interrupted', this.#cwd),
      });
    }
    this.#settleApprovals(turn.id);
    this.#turn = null;
    this.#emit({ type: 'turn.completed', turnId: turn.id, outcome, error: textOf(error), ...refField('errorRef', error), errorCode: code });
  }

  #dropTurn(turn: Turn): void {
    if (this.#turn === turn) this.#turn = null;
  }

  /** Pending approvals are answered with cancelled, and the approval cards in the UI collapse. `turnId` null means all of them. */
  #settleApprovals(turnId: string | null): void {
    for (const [approvalId, pending] of this.#approvals) {
      if (turnId !== null && pending.turnId !== turnId) continue;
      this.#approvals.delete(approvalId);
      pending.resolve(CANCELLED);
      this.#emit({ type: 'approval.resolved', approvalId });
    }
  }

  #onExit(reason: Localized | null): void {
    this.#settleApprovals(null);
    this.#turn = null;
    const error = this.#closed ? null : reason;
    this.#emit({ type: 'session.exited', error: textOf(error), ...refField('errorRef', error) });
  }

  #requireSession(): string {
    if (!this.#sessionId) throw new Error(String(DriversCommon.sessionNotReady({ name: this.#preset.name })));
    return this.#sessionId;
  }

  #warn(message: DriverText): void {
    this.#emit({ type: 'session.warning', message: String(message), ...refField('messageRef', message) });
  }

  #emit(event: AgentEvent): void {
    // Prompts emitted while the session is opening (resume failure, CucCut's tools unavailable) are sent before the Harness subscribes: they are held and replayed on subscribe.
    if (this.#early) {
      this.#early.push(event);
      return;
    }
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#log.error('AgentEvent listener failed', { error: String(error) });
      }
    }
  }
}

function readSessionId(handle: AgentPersistenceHandle | null, driverId: string): string | null {
  if (!handle || handle.driverId !== driverId) return null;
  const data = handle.data as { sessionId?: unknown } | null;
  return typeof data?.sessionId === 'string' ? data.sessionId : null;
}
