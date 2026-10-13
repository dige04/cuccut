/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * buildOptions (query options) in packages/server/src/server/agent/providers/claude/agent.ts, toSdkUserMessage (image blocks),
 * steerActiveTurn (priority:'next'), interruptActiveTurn / discardQueuedSteers (withdraw unread appended messages before interrupting),
 * readMissingResumedConversationError (conversations that cannot be resumed), handlePermissionRequest (canUseTool's pending table;
 * ExitPlanMode carries the full plan text `planText`), normalizeClaudeAskUserQuestionRequestInput (the input shape of AskUserQuestion; CucCut does not answer it, it rejects it and lets Claude ask in text), CLAUDE_SETTING_SOURCES (which settings layers are loaded; CucCut only takes the user layer).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import {
  agentModeLabel,
  newId,
  normalizeAgentMode,
  type AgentErrorCode,
  type AgentMode,
  type ApprovalRequest,
  type Autonomy,
  type Id,
} from '@cuccut/protocol';
import { DriversClaude, DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
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
import type {
  CanUseTool,
  EffortLevel,
  McpServerConfig,
  ModelInfo,
  Options,
  PermissionMode,
  PermissionResult,
  SDKAssistantMessageError,
  SDKMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { commandRule } from '../approval-rule.ts';
import { refField, textOf } from '../driver-text.ts';
import type { ClaudeInstall } from './claude-binary.ts';
import { ClaudeItemMapper, FILE_TOOLS, splitMcpTool, summarizeToolInput, toolFiles } from './claude-items.ts';
import { claudeAutoModeSupport, isClaudeEffort } from './claude-models.ts';
import { createMessageInput, sdkQueryFactory, type ClaudeQuery, type ClaudeQueryFactory, type MessageInput } from './claude-query.ts';

const CAPABILITIES = { steer: true, approvals: true, resume: true, images: true };

/** CucCut's own MCP tools are always allowed on the native side, and are gated by the Runtime's ApprovalService (see the note on `TurnSettings`). */
const CUCCUT_TOOLS = 'mcp__cuccut__';

/**
 * The tool Claude uses to ask the user questions. The Driver ABI approvals are only allow and deny, and cannot carry the user's answer back: if this were allowed as an approval, Claude would get back the original input
 * with no answer. So no approval card is shown; the request is denied directly, Claude is told to write the question in its reply and end this turn, and the user's next message is the answer.
 * This sentence is for the model: it is written in English and asks the model to ask in the user's language, so that the reply is not steered into one particular language.
 */
const ASK_USER_QUESTION = 'AskUserQuestion';
export const ASK_USER_QUESTION_DENIAL =
  'AskUserQuestion is not available here: the user cannot see or answer it. Instead, write your question(s) to the user as plain text in your reply ' +
  '(list the options if there are any), in the language the user has been using, then end your turn and wait for their answer in the next message.';

/** The tool that exits plan mode: the approval card carries the full plan text, no “always allow” is offered, and no session-level allow is recorded (the user must see every plan). */
const EXIT_PLAN_MODE = 'ExitPlanMode';

/**
 * Access mode → Claude's permissionMode (architecture design §3.12; for the mapping table see `TurnSettings`).
 * `auto` requires model support (`supportsAutoMode`); when unsupported, it falls back to `default` and shows a notice.
 */
export function claudePermissionMode(mode: AgentMode | Autonomy): PermissionMode {
  switch (normalizeAgentMode(mode)) {
    case 'plan':
      return 'plan';
    case 'ask':
      return 'default';
    case 'autoAcceptEdits':
      return 'acceptEdits';
    case 'auto':
      return 'auto';
    case 'fullAccess':
      return 'bypassPermissions';
  }
}

/**
 * Claude Code's settings layers: shared by the session and the probe (`supportedModels()`), so both see the same auth and model settings.
 *
 * - Only the `user` layer is loaded (`$CLAUDE_CONFIG_DIR/settings.json`, default `~/.claude/settings.json`): the `env` the user configured there
 *   (`ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`…), `apiKeyHelper` and `model` must take effect. The probe's `claude auth status`
 *   uses all of the CLI's own settings; if the session loaded no layers at all, users who authenticate through these settings would be probed as logged in while the session fails to authenticate.
 * - `project` and `local` are not loaded: both are relative to the session's cwd (`.claude/settings.json`, `.claude/settings.local.json`),
 *   and the cwd is the video's working directory. The hooks, permission rules and MCP services there are not something the user configured for CucCut, and they may come along with material directories supplied by others;
 *   for this reason the CLAUDE.md in the project is not loaded either.
 * - User-layer permission rules and hooks would bypass CucCut's approval (when an allow rule matches, the CLI does not go through canUseTool, and a PreToolUse hook can allow directly), which violates “the Driver side must not be more permissive than CucCut's mode” (architecture design §3.12). The flag layer's `disableAllHooks` turns off non-managed hooks;
 *   the managed layer `allowManagedPermissionRulesOnly` passed by the parent process makes user-layer permission rules ineffective (`allowedTools` is then ineffective too,
 *   and CucCut's own tools are allowed separately by canUseTool). Limitation (unverified): when the machine already has IT-managed settings, the SDK by default discards the managed layer passed by the parent process (it is only merged if the admin set `parentSettingsBehavior: 'merge'`); in that case user-layer allow rules still take effect.
 */
export function claudeSettingsOptions(): Pick<Options, 'settingSources' | 'settings' | 'managedSettings'> {
  // A new object is given each time, so that several Queries do not share one.
  return {
    settingSources: ['user'],
    settings: { disableAllHooks: true },
    managedSettings: { allowManagedPermissionRulesOnly: true },
  };
}

/**
 * Native error → structured failure reason (architecture design §3.11). SDK 0.3.288's `SDKAssistantMessageError` has 13 kinds in total:
 * account-related ones (not logged in, organization not allowed to use it, account frozen, verification required, cloud credentials invalid) all require the user to handle login themselves, and map to `AGENT_AUTH_REQUIRED`;
 * `invalid_request`, `server_error`, `unknown` and `max_output_tokens` are not in these groups, are null, and the UI only shows the raw text.
 */
export function claudeErrorCode(error: SDKAssistantMessageError | null | undefined): AgentErrorCode | null {
  switch (error) {
    case 'authentication_failed':
    case 'oauth_org_not_allowed':
    case 'account_on_hold':
    case 'verification_required':
    case 'cloud_credential_error':
      return 'AGENT_AUTH_REQUIRED';
    case 'billing_error':
      return 'AGENT_BILLING_REQUIRED';
    case 'model_not_found':
      return 'AGENT_MODEL_UNAVAILABLE';
    case 'rate_limit':
    case 'overloaded':
      return 'AGENT_RATE_LIMITED';
    default:
      return null;
  }
}

/** The two kinds recognized among startup-failure results (`startup_failure_reason`). */
function startupErrorCode(reason: string | undefined): AgentErrorCode | null {
  if (reason === 'gateway_signin_required') return 'AGENT_AUTH_REQUIRED';
  if (reason === 'cli_version_too_old') return 'AGENT_OUTDATED';
  return null;
}

/**
 * McpServerSpec → SDK Streamable HTTP config. The headers contain a token: it is passed only to the SDK and never logged.
 * `timeout`: a tool call may be waiting for user approval (see `MCP_TOOL_CALL_TIMEOUT_MS`), so the CLI's default value is not used.
 */
export function claudeMcpServers(servers: Record<string, McpServerSpec>): Record<string, McpServerConfig> {
  return Object.fromEntries(
    Object.entries(servers).map(([name, spec]) => [
      name,
      { type: 'http' as const, url: spec.url, headers: spec.headers, timeout: MCP_TOOL_CALL_TIMEOUT_MS },
    ]),
  );
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/** A user message: images are read as base64 image blocks placed first, and the text goes last (slash commands only expand when they are in the last block). */
export async function toClaudeUserMessage(input: AgentInput): Promise<SDKUserMessage> {
  const content: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }> = [];
  for (const image of input.images ?? []) {
    const mediaType = image.mimeType === 'image/jpg' ? 'image/jpeg' : image.mimeType;
    if (!IMAGE_TYPES.has(mediaType)) throw new Error(String(DriversClaude.imageUnsupported({ mimeType: image.mimeType })));
    const data = (await fs.readFile(image.path)).toString('base64');
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType as ImageMediaType, data } });
  }
  content.push({ type: 'text', text: input.text });
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, uuid: randomUUID() };
}

interface Applied {
  mode: PermissionMode;
  model: string | null;
  effort: EffortLevel | null;
}

/** A running Query (one claude process). Replaced with a new one when the effort level changes or resuming fails. */
interface LiveQuery {
  query: ClaudeQuery;
  input: MessageInput<SDKUserMessage>;
  applied: Applied;
  /** Native session id requested for resumption when this Query was started. */
  resume: string | null;
  /** A system/init has been received: the native session has been established or resumed successfully. */
  initialized: boolean;
  /** Closed on purpose (restart, closing the session): its ending does not count as an unexpected process exit. */
  retired: boolean;
  models: Promise<ModelInfo[]> | null;
  stderr: string[];
}

interface Turn {
  id: string;
  message: SDKUserMessage;
  settings: TurnSettings;
  mapper: ClaudeItemMapper;
  /** Interruption has been requested (the user stopped it, or the approval was cancelled): when the result arrives, it is recorded as interrupted. */
  interrupting: boolean;
  errorCode: AgentErrorCode | null;
  errorText: string | null;
  /** UUIDs of messages appended (steer) during this turn: on interruption, the ones Claude has not yet read are withdrawn. */
  steers: string[];
  /** Resumption failed; this turn has already been resent in a new session. */
  retriedFresh: boolean;
}

interface PendingApproval {
  turnId: string;
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  /** null: this kind does not record session-level allow. */
  grantKey: string | null;
  resolve: (result: PermissionResult) => void;
}

/**
 * Claude Code session: the whole session uses one long-lived SDK Query, whose input is a streaming `AsyncIterable<SDKUserMessage>` (architecture design §3.1).
 *
 * The Query is started in the first turn: the permission mode, model and effort level are only known with `startTurn`, and the effort level can only be given when the Query is started.
 * Each turn first compares settings: if the mode changed, `setPermissionMode`; if the model changed, `setModel`; if the effort level changed, the Query is restarted with the resumption handle.
 */
export class ClaudeSession implements AgentSession {
  readonly id: Id = newId('ags');
  readonly capabilities = CAPABILITIES;

  readonly #install: ClaudeInstall;
  readonly #options: CreateSessionOptions;
  readonly #log: Logger;
  readonly #factory: ClaudeQueryFactory;
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  readonly #approvals = new Map<Id, PendingApproval>();
  /** “Allow for this session” and “always allow” are both recorded only here on the native side: requests of the same kind are allowed directly, and no Claude settings file is written. */
  readonly #sessionGrants = new Set<string>();
  /** Models already told that auto is not supported, so the notice is not repeated every turn. */
  readonly #autoWarned = new Set<string>();

  #live: LiveQuery | null = null;
  /** Native session id: given by the resumption handle, or by system/init. The next Query resumes with it. */
  #sessionId: string | null;
  #turn: Turn | null = null;
  #closed = false;

  constructor(install: ClaudeInstall, options: CreateSessionOptions, log: Logger, factory: ClaudeQueryFactory = sdkQueryFactory) {
    this.#install = install;
    this.#options = options;
    this.#log = log;
    this.#factory = factory;
    this.#sessionId = readSessionId(options.resume);
  }

  async startTurn(input: AgentInput, settings: TurnSettings): Promise<{ turnId: string }> {
    if (this.#closed) throw new Error(String(DriversCommon.sessionClosed({ name: 'Claude' })));
    if (this.#turn) throw new Error(String(DriversCommon.turnInProgress()));
    const message = await toClaudeUserMessage(input);
    const live = await this.#prepare(settings);
    const turnId = newId('turn');
    this.#turn = {
      id: turnId,
      message,
      settings,
      mapper: new ClaudeItemMapper(turnId, Date.now, this.#options.cwd),
      interrupting: false,
      errorCode: null,
      errorText: null,
      steers: [],
      retriedFresh: false,
    };
    this.#emit({ type: 'turn.started', turnId });
    live.input.push(message);
    return { turnId };
  }

  async steer(turnId: string, input: AgentInput): Promise<'accepted' | 'unavailable'> {
    const turn = this.#turn;
    if (!turn || turn.id !== turnId || turn.interrupting || !this.#live) return 'unavailable';
    const message = await toClaudeUserMessage(input);
    // The turn may have ended while the image was being read: if it has ended, do not append, so that the message does not become a turn nobody is waiting for.
    const live = this.#live;
    if (this.#turn !== turn || turn.interrupting || !live) return 'unavailable';
    message.priority = 'next';
    turn.steers.push(message.uuid!);
    // The user sent a new message: pending approvals are voided (Claude is answered with a rejection), and it starts over according to the new instructions.
    // i18n-ignore: rejection note for Claude, written for the model
    this.#settleApprovals('用户发来了新的消息，这次操作没有执行。');
    live.input.push(message);
    return 'accepted';
  }

  async interrupt(turnId: string): Promise<InterruptReceipt> {
    const turn = this.#turn;
    const live = this.#live;
    if (!turn || turn.id !== turnId || !live) return { status: 'not-running' };
    turn.interrupting = true;
    turn.mapper.interrupting();
    // i18n-ignore: rejection note for Claude, written for the model
    this.#settleApprovals('任务已停止。');
    await this.#discardSteers(live, turn);
    try {
      await withTimeout(live.query.interrupt(), 10_000, 'interrupt');
      return { status: 'requested' };
    } catch (error) {
      this.#log.warn('Claude interrupt request failed', { error: errorMessage(error) });
      return { status: 'unknown' };
    }
  }

  async respondToApproval(approvalId: Id, response: ApprovalResponse): Promise<void> {
    const pending = this.#approvals.get(approvalId);
    if (!pending) return;
    this.#approvals.delete(approvalId);
    switch (response.decision) {
      case 'accept-for-session':
      case 'accept-always':
        // “Always allow” rules are stored by the Harness; here they are handled only as session-level allow, and updatedPermissions is never sent back (that would be written into Claude's settings file).
        if (pending.grantKey) this.#sessionGrants.add(pending.grantKey);
        pending.resolve({ behavior: 'allow', updatedInput: pending.input });
        this.#afterAllowed(pending);
        return;
      case 'accept':
        pending.resolve({ behavior: 'allow', updatedInput: pending.input });
        this.#afterAllowed(pending);
        return;
      case 'decline':
        this.#turn?.mapper.declined(pending.toolUseId);
        // i18n-ignore: rejection note for Claude, written for the model
        pending.resolve({ behavior: 'deny', message: '用户拒绝了这次操作。' });
        return;
      case 'cancel': {
        // Stop barrier (D04): deny and end this turn.
        const turn = this.#turn;
        if (turn && turn.id === pending.turnId) {
          turn.interrupting = true;
          turn.mapper.interrupting();
        }
        // i18n-ignore: rejection note for Claude, written for the model
        pending.resolve({ behavior: 'deny', message: '任务已停止。', interrupt: true });
        return;
      }
    }
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  describePersistence(): AgentPersistenceHandle | null {
    return this.#sessionId ? { driverId: 'claude', data: { sessionId: this.#sessionId } } : null;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    // i18n-ignore: rejection note for Claude, written for the model
    this.#settleApprovals('会话已关闭。');
    const live = this.#live;
    this.#live = null;
    if (live) this.#retire(live);
    this.#emit({ type: 'session.exited', error: null });
  }

  // ---- Establishing, comparing and restarting the Query ----

  /** Prepares the Query according to this turn's settings: starts it if there is none, restarts it if the effort level changed, then aligns the model and permission mode. */
  async #prepare(settings: TurnSettings): Promise<LiveQuery> {
    const effort = this.#effort(settings.effort);
    let live = this.#live;
    if (live && live.applied.effort !== effort) {
      // The effort level can only be given when the Query is started: restart with the resumption handle (a convention in driver.ts). 2.1.x's `applyFlagSettings({ effortLevel })`
      // can change it without a restart, but it was not adopted: it is the flag settings layer, and how it stacks with the user's own settings has not been verified.
      this.#log.info('Claude effort changed; restarting the Query with the resume handle', { from: live.applied.effort, to: effort });
      this.#retire(live);
      this.#live = null;
      live = null;
    }
    live ??= this.#start(settings, effort);
    await this.#reconcile(live, settings);
    return live;
  }

  #start(settings: TurnSettings, effort: EffortLevel | null): LiveQuery {
    const confined = this.#options.confinement === 'cwd-write-only';
    // auto starts as default first: whether the model supports it can only be asked once the Query is running, so the switch happens in the first turn's comparison.
    const mode = confined ? 'acceptEdits' : settings.accessMode === 'auto' ? 'default' : claudePermissionMode(settings.accessMode);
    const input = createMessageInput<SDKUserMessage>();
    const resume = this.#sessionId;
    const live: LiveQuery = {
      query: null as unknown as ClaudeQuery,
      input,
      applied: { mode, model: settings.model, effort },
      resume,
      initialized: false,
      retired: false,
      models: null,
      stderr: [],
    };
    const options = this.#queryOptions(live, mode, settings.model, effort, resume, confined);
    live.query = this.#factory({ prompt: input.iterable, options });
    this.#live = live;
    void this.#pump(live);
    return live;
  }

  #queryOptions(
    live: LiveQuery,
    mode: PermissionMode,
    model: string | null,
    effort: EffortLevel | null,
    resume: string | null,
    confined: boolean,
  ): Options {
    const options: Options = {
      // Use the claude the user installed themselves, not the platform binary bundled with the SDK.
      pathToClaudeCodeExecutable: this.#install.command,
      // install.env is the result of agentEnv(): the login shell's environment (the current process takes precedence), with the host Claude Code session variables (CLAUDECODE, etc.) removed.
      // The SDK uses it to replace the child process's environment entirely, and then adds CLAUDE_CODE_ENTRYPOINT and the like itself.
      env: this.#install.env,
      cwd: this.#options.cwd,
      // Only the user layer is loaded; hooks and the user layer's permission rules are turned off (see claudeSettingsOptions).
      ...claudeSettingsOptions(),
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        ...(this.#options.developerInstructions ? { append: this.#options.developerInstructions } : {}),
      },
      permissionMode: mode,
      // This only allows switching to bypassPermissions (“full access”) later; the mode in effect is still set by permissionMode. Without it, the session cannot switch over mid-way.
      // Always on. Unverified: in default mode it really does not change prompting behavior; whether the CLI refuses to start because of it when running as root or in similar environments.
      allowDangerouslySkipPermissions: !confined,
      canUseTool: this.#canUseTool,
      includePartialMessages: true,
      stderr: (data) => {
        live.stderr.push(data);
        if (live.stderr.length > 20) live.stderr.shift();
      },
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      ...(resume ? { resume } : {}),
    };
    // A restricted one-off call follows §6.9 “no MCP services, no CucCut tools”: even if the caller passes them, they are not accepted.
    if (this.#options.mcpServers && !confined) {
      options.mcpServers = claudeMcpServers(this.#options.mcpServers);
      options.allowedTools = [`${CUCCUT_TOOLS}*`];
    }
    if (confined) {
      // Restricted one-off call (§6.9): Claude Code has no sandbox that fully corresponds to Codex's workspace-write. The approximation:
      // file changes are allowed by acceptEdits (limited to the working directory; anything outside it will prompt), commands go into Claude Code's built-in sandbox and may not escape it,
      // and anything that would prompt is denied directly by canUseTool (no one is there to approve). Whether the system temp directory is writable and whether the network is fully cut off depends on the sandbox defaults — unverified.
      options.sandbox = { enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false };
    }
    return options;
  }

  /** Stops later messages from entering this Query, ends its input, and shuts down the process. */
  #retire(live: LiveQuery): void {
    live.retired = true;
    live.input.end();
    try {
      live.query.close();
    } catch (error) {
      this.#log.debug('Closing the Claude Query failed', { error: errorMessage(error) });
    }
  }

  async #reconcile(live: LiveQuery, settings: TurnSettings): Promise<void> {
    if (live.applied.model !== settings.model) {
      try {
        await withTimeout(live.query.setModel(settings.model ?? undefined), 15_000, 'setModel');
      } catch (error) {
        const model = settings.model ?? DriversClaude.defaultModel();
        throw Object.assign(new Error(String(DriversClaude.switchModelFailed({ model, error: errorMessage(error) }))), {
          agentCode: 'AGENT_MODEL_UNAVAILABLE',
        });
      }
      live.applied.model = settings.model;
    }
    if (this.#options.confinement === 'cwd-write-only') return;
    const mode = await this.#resolveMode(live, settings);
    if (live.applied.mode === mode) return;
    try {
      await withTimeout(live.query.setPermissionMode(mode), 15_000, 'setPermissionMode');
      live.applied.mode = mode;
    } catch (error) {
      if (mode !== 'auto') throw error;
      this.#warnAutoUnsupported(settings.model, errorMessage(error));
      if (live.applied.mode !== 'default') {
        await withTimeout(live.query.setPermissionMode('default'), 15_000, 'setPermissionMode');
        live.applied.mode = 'default';
      }
    }
  }

  async #resolveMode(live: LiveQuery, settings: TurnSettings): Promise<PermissionMode> {
    const mode = claudePermissionMode(settings.accessMode);
    if (mode !== 'auto') return mode;
    live.models ??= withTimeout(live.query.supportedModels(), 15_000, 'supportedModels').catch(() => []);
    if (claudeAutoModeSupport(await live.models, settings.model) === false) {
      this.#warnAutoUnsupported(settings.model, null);
      return 'default';
    }
    return 'auto';
  }

  #warnAutoUnsupported(model: string | null, reason: string | null): void {
    const key = model ?? 'default';
    if (this.#autoWarned.has(key)) return;
    this.#autoWarned.add(key);
    const message = DriversClaude.autoUnsupported({ model: model ?? '', reason: reason ?? '' });
    this.#emit({ type: 'session.warning', message: String(message), ...refField('messageRef', message) });
  }

  #effort(effort: string | null): EffortLevel | null {
    if (!effort) return null;
    if (isClaudeEffort(effort)) return effort;
    this.#log.warn("Claude doesn't recognize this effort level; using the default", { effort });
    return null;
  }

  // ---- Message stream ----

  async #pump(live: LiveQuery): Promise<void> {
    let failure: unknown = null;
    try {
      for await (const message of live.query) {
        if (live.retired || this.#live !== live) continue;
        this.#onMessage(live, message);
      }
    } catch (error) {
      failure = error;
    }
    if (live.retired || this.#live !== live) return;
    const turn = this.#turn;
    if (turn && !live.initialized && live.resume && !turn.retriedFresh) {
      // A process started with a resumption handle went away before the session was established: most likely the native session cannot be resumed, so this turn is resent in a new session (unverified: never reproduced for real).
      void this.#retryFresh(turn, failure ? errorMessage(failure) : lastLine(live.stderr));
      return;
    }
    // The process is gone, and the session ends with it (the Harness drops it when it receives session.exited); a later close() does not send session.exited again.
    this.#closed = true;
    this.#live = null;
    this.#turn = null;
    // i18n-ignore: rejection note for Claude, written for the model
    this.#settleApprovals('Claude Code 进程已退出。');
    const reason = failure ? errorMessage(failure) : lastLine(live.stderr);
    this.#log.warn('Claude Code process exited', { error: reason });
    this.#emit({ type: 'session.exited', error: reason || null });
  }

  #onMessage(live: LiveQuery, message: SDKMessage): void {
    if ('session_id' in message && typeof message.session_id === 'string' && message.session_id && !this.#sessionId) {
      this.#sessionId = message.session_id;
    }
    if (message.type === 'system') {
      if (message.subtype === 'init') {
        live.initialized = true;
        if (live.resume && message.session_id !== live.resume) {
          // Unverified: when resumption succeeds, Claude Code keeps the original session id. If they do not match, the one the CLI gives takes precedence.
          this.#log.info('Claude resumed session id differs from the handle', { requested: live.resume, actual: message.session_id });
        }
        this.#sessionId = message.session_id;
      } else if (message.subtype === 'status' && message.permissionMode) {
        // The CLI changed the mode itself (leaving plan mode after ExitPlanMode is approved, and entering it when Claude calls EnterPlanMode): note it, and the next turn's comparison switches it back
        // to the session's current access mode. This is intentional: the access mode is managed by the Harness (§3.12, the stricter of the two sides wins). While the session is still “plan first”,
        // the native side returning to plan is what matches the Harness's lookup; if the user changed the access mode, the next turn switches to the new level.
        live.applied.mode = message.permissionMode;
      } else if (message.subtype === 'api_retry') {
        const text = DriversClaude.apiRetry({ error: message.error, attempt: message.attempt, max: message.max_retries });
        this.#emit({
          type: 'session.error',
          turnId: this.#turn?.id ?? null,
          message: String(text),
          ...refField('messageRef', text),
          willRetry: true,
          code: claudeErrorCode(message.error),
        });
      }
      return;
    }
    const turn = this.#turn;
    if (!turn) {
      this.#log.debug('Ignoring Claude message outside a turn', { type: message.type });
      return;
    }
    if (message.type === 'result') {
      this.#onResult(live, turn, message);
      return;
    }
    if (message.type === 'assistant' && message.error && !message.parent_tool_use_id) {
      turn.errorCode ??= claudeErrorCode(message.error);
      turn.errorText ??= assistantText(message.message.content as unknown) || message.error;
    }
    for (const event of turn.mapper.map(message)) this.#emit(event);
  }

  #onResult(live: LiveQuery, turn: Turn, result: Extract<SDKMessage, { type: 'result' }>): void {
    const errors = result.subtype === 'success' ? [] : result.errors;
    if (live.resume && !turn.retriedFresh && errors.some((e) => /^No conversation found with session ID/.test(e))) {
      // The native session cannot be resumed (identified by the raw error text; unverified: never reproduced for real).
      void this.#retryFresh(turn, errors.join('\n'));
      return;
    }
    // Appended messages did not make it into this turn and are queued as the next turn (queued_turn_count > 0): CucCut's turn waits for them to finish before ending.
    if (!turn.interrupting && (result.queued_turn_count ?? 0) > 0) return;
    const aborted = result.terminal_reason === 'aborted_streaming' || result.terminal_reason === 'aborted_tools';
    const failed = result.is_error || result.subtype !== 'success' || turn.errorCode !== null;
    const outcome = turn.interrupting || aborted ? 'interrupted' : failed ? 'failed' : 'completed';
    const error =
      outcome === 'failed'
        ? turn.errorText ?? (errors.join('\n') || (result.subtype === 'success' ? result.result : '') || DriversClaude.turnFailed({ subtype: result.subtype }))
        : null;
    const errorCode = outcome === 'failed' ? (turn.errorCode ?? startupErrorCode(result.subtype === 'success' ? undefined : result.startup_failure_reason)) : null;
    // i18n-ignore: rejection note for Claude, written for the model
    this.#settleApprovals('回合已结束。');
    this.#turn = null;
    this.#emit({ type: 'turn.completed', turnId: turn.id, outcome, error: textOf(error), ...refField('errorRef', error), errorCode });
  }

  /** Native session cannot be resumed: drop the handle, resend this turn in a new session, and say so honestly (architecture design §2.5). */
  async #retryFresh(turn: Turn, reason: string): Promise<void> {
    this.#log.warn('Claude session resume failed; starting a new one', { error: reason });
    const old = this.#live;
    if (old) this.#retire(old);
    this.#live = null;
    this.#sessionId = null;
    turn.retriedFresh = true;
    const warning = DriversCommon.resumeFailed({ name: 'Claude Code', error: reason });
    this.#emit({ type: 'session.warning', message: String(warning), ...refField('messageRef', warning) });
    try {
      const live = this.#start(turn.settings, this.#effort(turn.settings.effort));
      await this.#reconcile(live, turn.settings);
      if (this.#turn === turn) live.input.push(turn.message);
    } catch (error) {
      if (this.#turn !== turn) return;
      this.#turn = null;
      this.#emit({ type: 'turn.completed', turnId: turn.id, outcome: 'failed', error: errorMessage(error), errorCode: null });
    }
  }

  // ---- Approval ----

  readonly #canUseTool: CanUseTool = (toolName, input, options) => {
    if (toolName.startsWith(CUCCUT_TOOLS)) return Promise.resolve({ behavior: 'allow', updatedInput: input });
    if (toolName === ASK_USER_QUESTION) {
      // No approval card is shown (see ASK_USER_QUESTION). The step on the timeline is recorded as “rejected” rather than “failed”.
      // Unverified: whether the CLI still goes through canUseTool to ask about this tool under bypassPermissions and auto modes (auto may hand it to a classifier); when it does not go through, it runs with native behavior.
      this.#turn?.mapper.declined(options.toolUseID);
      return Promise.resolve({ behavior: 'deny', message: ASK_USER_QUESTION_DENIAL });
    }
    if (this.#options.confinement === 'cwd-write-only') {
      // i18n-ignore: rejection note for Claude, written for the model
      return Promise.resolve({ behavior: 'deny', message: '这次调用不允许越过工作目录或访问网络。' });
    }
    const turn = this.#turn;
    if (this.#closed || !turn || turn.interrupting || options.signal.aborted) {
      // i18n-ignore: rejection note for Claude, written for the model
      return Promise.resolve({ behavior: 'deny', message: '任务已停止。' });
    }
    const { request, grantKey } = approvalRequest(toolName, input, options, this.#options.cwd);
    if (grantKey && this.#sessionGrants.has(grantKey)) return Promise.resolve({ behavior: 'allow', updatedInput: input });

    return new Promise<PermissionResult>((resolve) => {
      const approvalId = newId('appr');
      this.#approvals.set(approvalId, { turnId: turn.id, toolName, toolUseId: options.toolUseID, input, grantKey, resolve });
      options.signal.addEventListener(
        'abort',
        () => {
          // Claude withdrew this request (the turn was interrupted, etc.): take down the pending approval card.
          if (!this.#approvals.delete(approvalId)) return;
          this.#emit({ type: 'approval.resolved', approvalId });
          // i18n-ignore: rejection note for Claude, written for the model
          resolve({ behavior: 'deny', message: '请求已撤回。' });
        },
        { once: true },
      );
      this.#emit({ type: 'approval.requested', turnId: turn.id, approvalId, request });
    });
  };

  /**
   * The prompt after allowing. After ExitPlanMode is approved, the CLI leaves plan mode and starts making changes per the plan; but while the CucCut session's access mode is still “plan first”,
   * the Harness rejects these changes per §3.12, and Claude only receives “the user rejected it” (the Driver cannot tell whether the mode auto-rejected it or the user clicked it).
   * The Driver ABI cannot change the session's access mode, so it can only prompt the user to switch it themselves; once switched, the remaining approvals in this turn are looked up under the new mode, and the native side follows on the next turn.
   */
  #afterAllowed(pending: PendingApproval): void {
    if (pending.toolName !== EXIT_PLAN_MODE) return;
    const turn = this.#turn;
    if (!turn || turn.id !== pending.turnId || normalizeAgentMode(turn.settings.accessMode) !== 'plan') return;
    const message = DriversClaude.exitedPlanMode({ plan: agentModeLabel('plan'), edit: agentModeLabel('autoAcceptEdits') });
    this.#emit({ type: 'session.warning', message: String(message), ...refField('messageRef', message) });
  }

  /** Settle all pending approvals: answer Claude with a rejection, and have the UI take down the pending cards. */
  #settleApprovals(message: string): void {
    for (const [approvalId, pending] of [...this.#approvals]) {
      this.#approvals.delete(approvalId);
      pending.resolve({ behavior: 'deny', message });
      this.#emit({ type: 'approval.resolved', approvalId });
    }
  }

  /**
   * On interruption, withdraw appended messages Claude has not yet read; otherwise they would still run a turn after the interruption. The SDK runtime has `cancelAsyncMessage`,
   * but the public `Query` type does not have it yet; if it is missing, skip it (unverified: withdrawal has never been reproduced for real).
   */
  async #discardSteers(live: LiveQuery, turn: Turn): Promise<void> {
    const cancel = (live.query as ClaudeQuery & { cancelAsyncMessage?: (uuid: string) => Promise<boolean> }).cancelAsyncMessage;
    const uuids = turn.steers.splice(0);
    if (!cancel) return;
    for (const uuid of uuids) {
      try {
        await withTimeout(cancel.call(live.query, uuid), 5_000, 'cancelAsyncMessage');
      } catch (error) {
        this.#log.debug('Withdrawing a queued message failed', { error: errorMessage(error) });
      }
    }
  }

  #emit(event: AgentEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#log.error('AgentEvent listener failed', { error: String(error) });
      }
    }
  }
}

/**
 * canUseTool request → CucCut approval request, and the memory key for “allow for this session”:
 * commands are keyed by `commandRule` (the same command name and subcommand count as one kind); file changes are one kind regardless of tool; other tools are keyed by tool name.
 */
export function approvalRequest(
  toolName: string,
  input: Record<string, unknown>,
  options: Parameters<CanUseTool>[2],
  cwd: string,
): { request: ApprovalRequest; grantKey: string | null } {
  const reason = options.decisionReason ?? null;
  if (toolName === EXIT_PLAN_MODE) {
    // The approval card's `reason` carries the full plan text (the detail of that step on the timeline is also the full text, see claude-items.ts). No “always allow” is offered, and no session-level allow is recorded.
    const plan = typeof input.plan === 'string' && input.plan.trim() ? input.plan.trim() : null;
    return { request: { kind: 'tool', tool: toolName, server: null, reason: plan ?? reason, files: [], rule: null }, grantKey: null };
  }
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : '';
    const rule = commandRule(command);
    const description = typeof input.description === 'string' && input.description.trim() ? input.description : null;
    return {
      request: { kind: 'command', command, cwd, reason: description ?? reason, rule },
      grantKey: `command:${rule ?? command}`,
    };
  }
  if (FILE_TOOLS.has(toolName)) {
    const files = toolFiles(input);
    if (options.blockedPath && !files.includes(options.blockedPath)) files.push(options.blockedPath);
    return { request: { kind: 'file-change', reason, files, rule: null }, grantKey: 'file-change' };
  }
  // The approval request has only one `reason`: a summary of the arguments comes first, followed by Claude's reason (when it gives one).
  const mcp = splitMcpTool(toolName);
  const summary = summarizeToolInput(toolName, input);
  return {
    request: {
      kind: 'tool',
      tool: mcp?.tool ?? toolName,
      server: mcp?.server ?? null,
      reason: reason ? `${summary} · ${reason}` : summary,
      files: toolFiles(input),
      rule: toolName,
    },
    grantKey: `tool:${toolName}`,
  };
}

function readSessionId(handle: AgentPersistenceHandle | null): string | null {
  if (!handle || handle.driverId !== 'claude') return null;
  const data = handle.data as { sessionId?: unknown } | null;
  return typeof data?.sessionId === 'string' && data.sessionId ? data.sessionId : null;
}

function assistantText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return (content as Array<{ type: string; text?: unknown }>)
    .map((c) => (c.type === 'text' && typeof c.text === 'string' ? c.text : ''))
    .join('')
    .trim();
}

function lastLine(lines: string[]): string {
  return lines.join('').trim().split('\n').filter(Boolean).pop()?.trim() ?? '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(String(DriversCommon.timedOut({ label, seconds: ms / 1000 })))), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
