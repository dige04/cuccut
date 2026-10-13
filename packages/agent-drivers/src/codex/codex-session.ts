/**
 * Codex session (the machine protocol of `codex app-server`).
 *
 * The check in `steer` for the rejections that definitely mean "not delivered" (`isDefinitiveSteerRejection`) is ported from paseo's
 * packages/server/src/server/agent/providers/codex-app-server-agent.ts (`isDefinitiveCodexSteerRejection`,
 * `steerActiveTurn`), Apache-2.0, Copyright (c) 2025-present Mohamed Boudra. Modified:
 * changed to CucCut's `'accepted' | 'unavailable'` return value, and checked first against the active turn that CucCut itself records.
 */
import { spawn } from 'node:child_process';
import {
  RUNTIME_VERSION,
  newId,
  normalizeAgentMode,
  type AgentErrorCode,
  type AgentMode,
  type Autonomy,
  type DriverProbe,
  type Id,
} from '@cuccut/protocol';
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
import type { CodexInstall } from './codex-binary.ts';
import type {
  ApprovalsReviewer,
  AskForApproval,
  CodexApprovalDecision,
  CodexMcpServer,
  CodexThreadItem,
  CodexTurn,
  CodexTurnError,
  CodexUserInput,
  CommandApprovalParams,
  FileChangeApprovalParams,
  InitializeParams,
  SandboxMode,
  SandboxPolicy,
  SandboxWorkspaceWrite,
  ThreadResumeParams,
  ThreadStartParams,
  ThreadStartResponse,
  TurnStartParams,
  TurnStartResponse,
  TurnSteerParams,
  TurnSteerResponse,
} from './codex-protocol.ts';
import { DriversCodex, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import { commandRule } from '../approval-rule.ts';
import { errorRefField, refField, textOf, type DriverText } from '../driver-text.ts';
import { classifyCodexError } from './codex-error.ts';
import { mapCodexItem } from './map-item.ts';
import { CodexRpcConnection, CodexRpcError, NO_RESPONSE, type RpcId } from './rpc-connection.ts';

/** What the Codex session actually supports: steer uses `turn/steer`, images use `localImage`. */
export const CODEX_CAPABILITIES: DriverProbe['capabilities'] = { steer: true, approvals: true, resume: true, images: true };

/**
 * Access mode → Codex's approval policy, reviewer, and sandbox (architecture design §3.12). When the two sides disagree, take the stricter one: actions Codex asks about are then decided by the Harness
 * per CucCut's decision table as auto, ask, or reject. Actions Codex does not ask about (those executed directly inside the sandbox) CucCut cannot intercept,
 * so Codex's policy must not be looser than CucCut's mode. Old values are converted to new ones first.
 *
 * | Mode | approvalPolicy | sandbox | Notes |
 * | --- | --- | --- | --- |
 * | plan | untrusted | read-only | Read-only sandbox; untrusted commands all ask |
 * | ask | untrusted | workspace-write | Commands and file edits both ask, handed to the user |
 * | autoAcceptEdits | untrusted | workspace-write | Both ask; file edits inside the working directory are auto-accepted by the Harness |
 * | auto | on-request | workspace-write | Runs directly inside the sandbox; asks when leaving the sandbox (rated `high`, handed to the user) |
 * | fullAccess | never | workspace-write | Never asks; the sandbox still applies |
 *
 * The reviewer is always set explicitly to `user`: if the user's config.toml sets the reviewer to auto_review, actions Codex asks about would bypass CucCut's decision table.
 * When the mode changes mid-session, the next turn carries the new policy on `turn/start`; `sandboxPolicy` is sent separately only when the sandbox changes (entering or leaving plan-first).
 */
export function codexPolicy(mode: AgentMode | Autonomy): { approvalPolicy: AskForApproval; approvalsReviewer: ApprovalsReviewer; sandbox: SandboxMode } {
  switch (normalizeAgentMode(mode)) {
    case 'plan':
      return { approvalPolicy: 'untrusted', approvalsReviewer: 'user', sandbox: 'read-only' };
    case 'ask':
    case 'autoAcceptEdits':
      return { approvalPolicy: 'untrusted', approvalsReviewer: 'user', sandbox: 'workspace-write' };
    case 'auto':
      return { approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write' };
    case 'fullAccess':
      return { approvalPolicy: 'never', approvalsReviewer: 'user', sandbox: 'workspace-write' };
  }
}

/**
 * Time limit for CucCut tool calls (seconds, `mcp_servers.<name>.tool_timeout_sec`). Session approvals have no time limit, and the user may take a long time to respond;
 * Codex gives up on a tool call after its default 60 seconds, so it is relaxed to one day via `MCP_TOOL_CALL_TIMEOUT_MS`.
 */
export const CODEX_TOOL_TIMEOUT_SEC = MCP_TOOL_CALL_TIMEOUT_MS / 1000;

/**
 * CucCut input → Codex's `UserInput`: text first; images (already on the local machine) are passed as `localImage` paths, which Codex reads itself.
 * When there are only images and no text, no empty text segment is sent.
 */
export function codexUserInput(input: AgentInput): CodexUserInput[] {
  const images = (input.images ?? []).map((image): CodexUserInput => ({ type: 'localImage', path: image.path }));
  const text: CodexUserInput[] = input.text || images.length === 0 ? [{ type: 'text', text: input.text, text_elements: [] }] : [];
  return [...text, ...images];
}

/**
 * The sandbox carried on each turn (`sandboxPolicy` on `turn/start`). It is sent only when the sandbox differs from the thread's current one. `workspaceWrite` uses Codex's default details
 * (no extra writable directories, no network, still writable `/tmp` and `$TMPDIR`), since sending it would override `sandbox_workspace_write` in the user's config.toml.
 */
export function codexSandboxPolicy(sandbox: SandboxMode): SandboxPolicy {
  switch (sandbox) {
    case 'read-only':
      return { type: 'readOnly', networkAccess: false };
    case 'workspace-write':
      return { type: 'workspaceWrite', writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false };
    case 'danger-full-access':
      return { type: 'dangerFullAccess' };
  }
}

/**
 * Restricted one-shot call (`confinement: 'cwd-write-only'`, architecture design §6.9): the sandbox allows writes only to the working directory, removes the default-writable `/tmp` and
 * `$TMPDIR`, and commands get no network. Approval policy `never`: out-of-bounds actions are not asked about and simply fail.
 */
const CONFINED_POLICY: { approvalPolicy: AskForApproval; sandbox: SandboxMode } = { approvalPolicy: 'never', sandbox: 'workspace-write' };
const CONFINED_WORKSPACE_WRITE: SandboxWorkspaceWrite = {
  writable_roots: [],
  network_access: false,
  exclude_tmpdir_env_var: true,
  exclude_slash_tmp: true,
};

interface PendingApproval {
  rpcId: RpcId;
  settle: (decision: CodexApprovalDecision) => void;
  abandon: () => void;
}

/** "Always allow" rules are stored by the Harness; the native side only handles session-level allowance (see `ApprovalResponse`). */
const DECISION: Record<ApprovalResponse['decision'], CodexApprovalDecision> = {
  accept: 'accept',
  'accept-for-session': 'acceptForSession',
  'accept-always': 'acceptForSession',
  decline: 'decline',
  cancel: 'cancel',
};

/** Errors not retried within the turn: the `turn/completed` (failed) that Codex sends next carries the same error, so the error is recorded now and reported together when the turn ends. */
interface TurnFailure {
  /** The original text from Codex; when absent, the "unknown error" written by CucCut. */
  message: DriverText;
  code: AgentErrorCode | null;
}

export class CodexSession implements AgentSession {
  readonly id: Id = newId('ags');
  readonly capabilities = CODEX_CAPABILITIES;

  readonly #conn: CodexRpcConnection;
  readonly #log: Logger;
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  readonly #approvals = new Map<Id, PendingApproval>();
  readonly #approvalByRpc = new Map<string, Id>();
  readonly #fileChanges = new Map<string, string[]>();
  #threadId: string | null = null;
  #confined = false;
  /** The thread's current sandbox: when the mode switches into or out of plan-first, the next turn's `turn/start` carries `sandboxPolicy`. */
  #sandbox: SandboxMode = 'workspace-write';
  /** Under `on-request`, Codex asks only about actions that leave the sandbox: when reported to the Harness they are marked as out-of-bounds (§3.12). Updated with each turn's access mode. */
  #escalationOnly = false;
  /** The turn currently running: recorded on the `turn/start` response or `turn/started`, cleared on `turn/completed`. Steer is sent only to it. */
  #activeTurnId: string | null = null;
  #lastCompletedTurnId: string | null = null;
  readonly #turnFailures = new Map<string, TurnFailure>();

  private constructor(conn: CodexRpcConnection, log: Logger) {
    this.#conn = conn;
    this.#log = log;
  }

  static async start(install: CodexInstall, options: CreateSessionOptions, log: Logger): Promise<CodexSession> {
    const child = spawn(install.command, ['app-server'], {
      cwd: options.cwd,
      env: install.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const session = new CodexSession(new CodexRpcConnection(child, log), log);
    try {
      await session.#initialize(options);
      return session;
    } catch (error) {
      await session.#conn.close();
      throw error;
    }
  }

  async #initialize(options: CreateSessionOptions): Promise<void> {
    const conn = this.#conn;
    conn.onNotification((method, params) => this.#onNotification(method, params));
    conn.onExit((error) => {
      this.#activeTurnId = null;
      // An error was reported but the process exited before turn/completed arrived: report the recorded error rather than swallow it.
      for (const [turnId, failure] of this.#turnFailures) {
        this.#emit({
          type: 'session.error',
          turnId,
          message: textOf(failure.message),
          ...refField('messageRef', failure.message),
          willRetry: false,
          code: failure.code,
        });
      }
      this.#turnFailures.clear();
      for (const pending of this.#approvals.values()) pending.abandon();
      this.#approvals.clear();
      this.#emit({ type: 'session.exited', error: error ? error.message : null, ...errorRefField('errorRef', error) });
    });
    conn.handle('item/commandExecution/requestApproval', (params, rpcId) => {
      const p = params as CommandApprovalParams;
      return this.#askApproval(rpcId, p.turnId, {
        kind: 'command',
        command: p.command ?? '',
        cwd: p.cwd ?? null,
        reason: p.reason ?? null,
        rule: commandRule(p.command ?? ''),
      });
    });
    conn.handle('item/fileChange/requestApproval', (params, rpcId) => {
      const p = params as FileChangeApprovalParams;
      return this.#askApproval(rpcId, p.turnId, {
        kind: 'file-change',
        reason: p.reason ?? null,
        files: this.#fileChanges.get(p.itemId) ?? (p.grantRoot ? [p.grantRoot] : []),
        // File edits are allowed according to the access mode; no rules are stored.
        rule: null,
      });
    });

    const init: InitializeParams = {
      clientInfo: { name: 'cuccut', title: 'CucCut', version: RUNTIME_VERSION },
      capabilities: null,
    };
    await conn.request('initialize', init);
    conn.notify('initialized');

    const confined = options.confinement === 'cwd-write-only';
    this.#confined = confined;
    const policy = confined ? CONFINED_POLICY : codexPolicy(options.accessMode);
    this.#sandbox = policy.sandbox;
    this.#escalationOnly = policy.approvalPolicy === 'on-request';
    const config: NonNullable<ThreadStartParams['config']> = {
      ...(options.mcpServers ? { mcp_servers: codexMcpServers(options.mcpServers) } : {}),
      ...(confined ? { sandbox_workspace_write: CONFINED_WORKSPACE_WRITE } : {}),
    };
    const base: ThreadStartParams = {
      cwd: options.cwd,
      ...policy,
      ...(options.model ? { model: options.model } : {}),
      developerInstructions: options.developerInstructions ?? null,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    };
    const resumeThreadId = readThreadId(options.resume);
    if (resumeThreadId) {
      try {
        const params: ThreadResumeParams = { ...base, threadId: resumeThreadId, excludeTurns: true };
        const res = await conn.request<ThreadStartResponse>('thread/resume', params);
        this.#threadId = res.thread.id;
        return;
      } catch (error) {
        // When the native session cannot be restored, say so honestly rather than pretend the context is still there (architecture design §2.5).
        this.#log.warn('Codex session resume failed; starting a new one', { error: String(error) });
        const warning = DriversCommon.resumeFailed({ name: 'Codex', error: errorMessage(error) });
        queueMicrotask(() => this.#emit({ type: 'session.warning', message: String(warning), ...refField('messageRef', warning) }));
      }
    }
    const res = await conn.request<ThreadStartResponse>('thread/start', base);
    this.#threadId = res.thread.id;
  }

  async startTurn(input: AgentInput, settings: TurnSettings): Promise<{ turnId: string }> {
    const policy = codexPolicy(settings.accessMode);
    const sandboxChanged = !this.#confined && policy.sandbox !== this.#sandbox;
    const params: TurnStartParams = {
      threadId: this.#requireThread(),
      input: codexUserInput(input),
      // A restricted session's policy is fixed; a normal session uses the session's current access mode, model, and effort on each turn.
      ...(this.#confined ? {} : { approvalPolicy: policy.approvalPolicy, approvalsReviewer: policy.approvalsReviewer }),
      ...(sandboxChanged ? { sandboxPolicy: codexSandboxPolicy(policy.sandbox) } : {}),
      ...(settings.model ? { model: settings.model } : {}),
      ...(settings.effort ? { effort: settings.effort } : {}),
    };
    // The approval for this turn may arrive before the response, so the out-of-bounds flag is switched to this turn's value before the request is sent.
    if (!this.#confined) this.#escalationOnly = policy.approvalPolicy === 'on-request';
    const res = await this.#conn.request<TurnStartResponse>('turn/start', params);
    if (sandboxChanged) this.#sandbox = policy.sandbox;
    // The response and turn/started and turn/completed may arrive in the same batch of output: a turn that has already ended is not recorded as active.
    if (res.turn.status === 'inProgress' && res.turn.id !== this.#lastCompletedTurnId) this.#activeTurnId = res.turn.id;
    return { turnId: res.turn.id };
  }

  /**
   * Inserts input into the turn that is running (`turn/steer`, with `expectedTurnId` as a precondition).
   * - If this turn has already ended (the active turn CucCut recorded is not it): no request is sent; returns `unavailable` directly.
   * - If Codex explicitly rejects it (method does not exist, no active turn, the active turn is not this one, or the turn cannot be steered): `unavailable`; the input was definitely not delivered.
   * - Timeouts, disconnects, and similar cases where it is unclear whether delivery happened: throws, and does not return `unavailable`. The Harness would treat that as not delivered, and the UI would send it again, causing a duplicate.
   */
  async steer(turnId: string, input: AgentInput): Promise<'accepted' | 'unavailable'> {
    if (!this.#threadId || this.#activeTurnId !== turnId) return 'unavailable';
    const params: TurnSteerParams = { threadId: this.#threadId, input: codexUserInput(input), expectedTurnId: turnId };
    try {
      const res = await this.#conn.request<TurnSteerResponse>('turn/steer', params, 30_000);
      if (res?.turnId !== turnId) throw new Error(String(DriversCodex.steerMismatch({ expected: turnId, received: String(res?.turnId) })));
      return 'accepted';
    } catch (error) {
      if (isDefinitiveSteerRejection(error)) return 'unavailable';
      throw error;
    }
  }

  async interrupt(turnId: string): Promise<InterruptReceipt> {
    try {
      await this.#conn.request('turn/interrupt', { threadId: this.#requireThread(), turnId }, 15_000);
      return { status: 'requested' };
    } catch (error) {
      this.#log.warn('Codex interrupt request failed', { error: String(error) });
      return { status: 'unknown' };
    }
  }

  async respondToApproval(approvalId: Id, response: ApprovalResponse): Promise<void> {
    const pending = this.#approvals.get(approvalId);
    if (!pending) return;
    this.#approvals.delete(approvalId);
    this.#approvalByRpc.delete(String(pending.rpcId));
    pending.settle(DECISION[response.decision]);
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  describePersistence(): AgentPersistenceHandle | null {
    return this.#threadId ? { driverId: 'codex', data: { threadId: this.#threadId } } : null;
  }

  async close(): Promise<void> {
    for (const pending of this.#approvals.values()) pending.abandon();
    this.#approvals.clear();
    await this.#conn.close();
  }

  #requireThread(): string {
    if (!this.#threadId) throw new Error(String(DriversCommon.sessionNotReady({ name: 'Codex' })));
    return this.#threadId;
  }

  #emit(event: AgentEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#log.error('AgentEvent listener threw', { error: String(error) });
      }
    }
  }

  #askApproval(
    rpcId: RpcId,
    turnId: string,
    request: Extract<AgentEvent, { type: 'approval.requested' }>['request'],
  ): Promise<{ decision: CodexApprovalDecision }> {
    return new Promise((resolve, reject) => {
      const approvalId = newId('appr');
      this.#approvals.set(approvalId, {
        rpcId,
        settle: (decision) => resolve({ decision }),
        abandon: () => reject(NO_RESPONSE),
      });
      this.#approvalByRpc.set(String(rpcId), approvalId);
      this.#emit({ type: 'approval.requested', turnId, approvalId, request, ...(this.#escalationOnly ? { escalation: true } : {}) });
    });
  }

  #onNotification(method: string, raw: unknown): void {
    const p = (raw ?? {}) as Record<string, unknown>;
    if (typeof p.threadId === 'string' && this.#threadId && p.threadId !== this.#threadId) return;
    const turnId = typeof p.turnId === 'string' ? p.turnId : '';

    switch (method) {
      case 'turn/started': {
        const turnId = (p.turn as CodexTurn).id;
        this.#activeTurnId = turnId;
        this.#emit({ type: 'turn.started', turnId });
        return;
      }
      case 'turn/completed': {
        const turn = p.turn as CodexTurn;
        if (this.#activeTurnId === turn.id) this.#activeTurnId = null;
        this.#lastCompletedTurnId = turn.id;
        const stashed = this.#turnFailures.get(turn.id) ?? null;
        this.#turnFailures.delete(turn.id);
        const outcome = turn.status === 'interrupted' ? 'interrupted' : turn.status === 'failed' ? 'failed' : 'completed';
        // Failed turn: prefer the error the turn itself carries; if there is none, use the earlier non-retried error notification.
        const failure = outcome === 'failed' ? (turn.error ? turnFailure(turn.error) : stashed) : null;
        if (outcome !== 'failed' && stashed) {
          // An error was reported but the turn did not fail (should not happen per the protocol): do not swallow that error.
          this.#emit({
            type: 'session.error',
            turnId: turn.id,
            message: textOf(stashed.message),
            ...refField('messageRef', stashed.message),
            willRetry: false,
            code: stashed.code,
          });
        }
        this.#emit({
          type: 'turn.completed',
          turnId: turn.id,
          outcome,
          error: textOf(failure?.message) ?? turn.error?.message ?? null,
          ...refField('errorRef', failure?.message),
          errorCode: failure?.code ?? null,
        });
        return;
      }
      case 'item/started':
      case 'item/completed': {
        const item = p.item as CodexThreadItem;
        if (item.type === 'fileChange') {
          const changes = (item as { changes?: Array<{ path: string }> }).changes ?? [];
          this.#fileChanges.set(
            item.id,
            changes.map((c) => c.path),
          );
        }
        this.#emit({
          type: method === 'item/started' ? 'item.started' : 'item.completed',
          turnId,
          item: mapCodexItem(item),
        });
        return;
      }
      case 'item/agentMessage/delta':
      case 'item/plan/delta':
        this.#emit({ type: 'item.delta', turnId, itemId: String(p.itemId), channel: 'text', delta: String(p.delta ?? '') });
        return;
      case 'item/reasoning/summaryTextDelta':
        this.#emit({ type: 'item.delta', turnId, itemId: String(p.itemId), channel: 'reasoning', delta: String(p.delta ?? '') });
        return;
      case 'item/reasoning/summaryPartAdded':
        if (Number(p.summaryIndex) > 0) {
          this.#emit({ type: 'item.delta', turnId, itemId: String(p.itemId), channel: 'reasoning', delta: '\n\n' });
        }
        return;
      case 'item/commandExecution/outputDelta':
        this.#emit({ type: 'item.delta', turnId, itemId: String(p.itemId), channel: 'output', delta: String(p.delta ?? '') });
        return;
      case 'serverRequest/resolved': {
        const approvalId = this.#approvalByRpc.get(String(p.requestId));
        if (!approvalId) return;
        this.#approvalByRpc.delete(String(p.requestId));
        this.#approvals.get(approvalId)?.abandon();
        this.#approvals.delete(approvalId);
        this.#emit({ type: 'approval.resolved', approvalId });
        return;
      }
      case 'error': {
        const failure = turnFailure((p.error ?? {}) as Partial<CodexTurnError>);
        const willRetry = p.willRetry === true;
        // Not retried, and belongs to the running turn: the turn/completed (failed) that follows carries it, so report it then, to avoid showing it twice in the UI.
        if (!willRetry && turnId && turnId === this.#activeTurnId) {
          this.#turnFailures.set(turnId, failure);
          return;
        }
        // Retried ones (the turn continues), or ones that do not belong to the running turn: report as a session error without ending the turn.
        this.#emit({
          type: 'session.error',
          turnId: turnId || null,
          message: textOf(failure.message),
          ...refField('messageRef', failure.message),
          willRetry,
          code: failure.code,
        });
        return;
      }
      default:
        this.#log.debug('Ignoring codex notification', { method });
    }
  }
}

export function codexMcpServers(servers: Record<string, McpServerSpec>): Record<string, CodexMcpServer> {
  return Object.fromEntries(
    Object.entries(servers).map(([name, spec]) => [
      name,
      {
        url: spec.url,
        http_headers: spec.headers,
        default_tools_approval_mode: 'approve' as const,
        tool_timeout_sec: CODEX_TOOL_TIMEOUT_SEC,
      },
    ]),
  );
}

function turnFailure(error: Partial<CodexTurnError>): TurnFailure {
  const message: DriverText = typeof error.message === 'string' && error.message ? error.message : DriversCommon.unknownError();
  return {
    message,
    code: classifyCodexError({ message: String(message), codexErrorInfo: error.codexErrorInfo ?? null, additionalDetails: error.additionalDetails ?? null }),
  };
}

/**
 * The `turn/steer` rejections that definitely mean the input was not delivered (wording from app-server `turn_processor.rs`, checked against the codex source and 0.159.0):
 * the method does not exist (`-32601`), or `-32600` with "no active turn", "the active turn is not this one", or "this turn cannot be steered" (`activeTurnNotSteerable`).
 * Other `-32600`, timeouts, and disconnects are treated as unclear.
 */
function isDefinitiveSteerRejection(error: unknown): boolean {
  if (!(error instanceof CodexRpcError)) return false;
  if (error.code === -32601) return true;
  if (error.code !== -32600) return false;
  const data = error.data as { codexErrorInfo?: unknown } | null | undefined;
  const info = data?.codexErrorInfo;
  if (info && typeof info === 'object' && 'activeTurnNotSteerable' in info) return true;
  return error.message === 'no active turn to steer' || /^expected active turn id `[^`]+` but found `[^`]+`$/.test(error.message);
}

function readThreadId(handle: AgentPersistenceHandle | null): string | null {
  if (!handle || handle.driverId !== 'codex') return null;
  const data = handle.data as { threadId?: unknown } | null;
  return typeof data?.threadId === 'string' ? data.threadId : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
