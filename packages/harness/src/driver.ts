import type {
  AgentErrorCode,
  AgentMode,
  ApprovalDecision,
  ApprovalRequest,
  DriverId,
  DriverProbe,
  Id,
  MessageRef,
  ToolCallKind,
  ToolCallStatus,
} from '@cuccut/protocol';

/**
 * Driver ABI (architecture design §3.1).
 *
 * `AgentDriver` connects to a complete agent runtime through its machine protocol, not by parsing the terminal screen. The types here carry no concepts from any specific engine: Codex's thread / item are translated inside the Driver into the events below.
 */
export interface AgentDriver {
  readonly id: DriverId;
  /**
   * false: this Driver has not passed integration testing (architecture design §3.11 D08); only probe results are shown, and the Harness does not let it start sessions. If not given, true. Matches `verified` in the probe result.
   */
  readonly verified?: boolean;
  /**
   * Whether this one has been run end to end in CucCut on a real machine (true for Claude, Codex, OpenCode). When a shared implementation of the same protocol is verified with one member, it counts as `verified`; other presets and user-added agents have `tested` false: sessions can be opened, but the UI shows "not tested in CucCut" (§3.11 D08). If not given, it is treated as `verified`. Matches `tested` in the probe result.
   */
  readonly tested?: boolean;
  /**
   * true: probing starts an agent process (ACP agents can take over ten seconds to cold-start), not just fast commands like `--version`. `agents.list` doesn't wait for its first probe, and the "cheap correction" doesn't re-probe it (architecture design §3.11). If not given, false.
   */
  readonly slowProbe?: boolean;
  /**
   * Probes installation, version, login status, and model table, and gives a capability snapshot entry (§3.6, §3.11). Does not include user preferences: enabled, default, etc. are merged by the Harness. Probing must not start model calls that cost money; if the model table can be obtained without being logged in, it is still provided (Claude's `supportedModels()` can).
   */
  probe(options?: ProbeOptions): Promise<DriverProbe>;
  /**
   * This Driver version's constants (name, command, minimum version, subscription, login command, install method, `verified`, `tested`, capabilities), with no probing and no process start. The Driver registry uses this to fill in the disk cache's machine facts (`store/agent-probes.json`, §3.11) into full probe results: the cache stores only machine facts, not constants, so after a CucCut upgrade the constants are always fresh, and the cache file doesn't need a version record; if it doesn't match, the whole file is invalidated.
   * Drivers that don't implement it (test fakes) don't read the disk cache and probe from scratch at each startup.
   */
  describe?(): DriverDescription;
  createSession(options: CreateSessionOptions): Promise<AgentSession>;
}

/** The constant part of `describe()`: the probe result minus machine facts and the `status` / `unavailableReason` derived from `state`. */
export type DriverDescription = Pick<
  DriverProbe,
  'id' | 'name' | 'command' | 'minVersion' | 'plan' | 'planRef' | 'loginCommand' | 'install' | 'verified' | 'tested' | 'capabilities'
>;

export interface ProbeOptions {
  /** Executable specified manually by the user; null means search PATH and common install locations. */
  executable?: string | null;
  /**
   * Forced: don't use the Driver's own cache (Claude's model table, Codex and ACP's model catalog and login status); query again for real. "Re-detect" (`agents.detect`), after installation finishes, and the correction after a runtime error use this; the background refresh at startup does not.
   */
  force?: boolean;
}

/**
 * Per-turn settings (architecture design §3.11, §3.12). When model, effort, or access mode changes on a session, the next turn runs with the new settings, without restarting the native session: Codex passes approvalPolicy / sandboxPolicy / model / effort on `turn/start`; Claude uses `setPermissionMode` and `setModel`, and when effort changes, the Driver restarts Query itself with the resume handle.
 *
 * Mapping from access mode to native policy (whichever side is stricter). Actions the native side asks about are looked up by the Harness by risk level and mode (`decideApproval`):
 *
 * | Mode | Claude permissionMode | Codex approvalPolicy / sandbox |
 * | --- | --- | --- |
 * | plan | plan | untrusted / read-only |
 * | ask | default | untrusted / workspace-write |
 * | autoAcceptEdits | acceptEdits | untrusted / workspace-write; fileChange inside the working directory is auto-approved by the Harness |
 * | auto | auto (falls back to default when the model doesn't support it) | on-request / workspace-write; a request to escape the sandbox counts as `high` |
 * | fullAccess | bypassPermissions | never / workspace-write (isolation not relaxed) |
 *
 * Under `untrusted`, Codex's apply_patch sends a fileChange approval (inferred from the codex source at main@4642370542, not tested: `assess_patch_safety` in `core/src/safety.rs` always returns AskUser under UnlessTrusted, and `app-server/src/bespoke_event_handling.rs` converts it to `item/fileChange/requestApproval`); ask and autoAcceptEdits don't collapse into one tier; after answering acceptForSession, the same path no longer asks.
 *
 * CucCut's own MCP server (`cuccut`) is always allowed on the native side (Codex `default_tools_approval_mode: 'approve'`, Claude pre-approves `mcp__cuccut__*`): its write operations are gated by the Runtime's ApprovalService according to access mode; blocking again on the native side would make the user click twice.
 */
export interface TurnSettings {
  accessMode: AgentMode;
  /** null = not passed; the Agent's own default is used. */
  model: string | null;
  effort: string | null;
}

export interface CreateSessionOptions extends TurnSettings {
  cwd: string;
  /** Executable specified manually by the user. */
  executable?: string | null;
  /** Result of the last `describePersistence()`; if present, the native session is resumed. */
  resume: AgentPersistenceHandle | null;
  developerInstructions?: string;
  /** The tool channel through which the agent enters the Runtime over MCP (architecture design §3.5). Must be included on both creation and resume: tokens are issued per native session. */
  mcpServers?: Record<string, McpServerSpec>;
  /**
   * A restricted one-shot call (agent as Provider, architecture design §6.9): `cwd-write-only` allows writing only in the working directory (not including the system temp directory), commands have no network access, and it never requests approval (out-of-bounds actions are denied directly, since no one is there to approve). When given, `accessMode` has no effect.
   */
  confinement?: 'cwd-write-only';
}

/** A Streamable HTTP MCP server. `headers` contains the token and must not be written to logs. */
export interface McpServerSpec {
  url: string;
  headers: Record<string, string>;
}

/**
 * Native timeout floor the Driver sets for MCP tool calls. CucCut's tools at levels like `ask` wait for the user to click allow on the card before returning; when the native default timeout (Codex's `tool_timeout_sec`, default 60 seconds) is reached, the tool call fails on the Agent side while the card is still shown, and it is then cleared by "MCP disconnected", so the user can't tell why. Like native approval, it "waits indefinitely"; here it is set to 24 hours.
 * Time-consuming tools already return `jobId` immediately (architecture design §3.5) and don't rely on this timeout.
 */
export const MCP_TOOL_CALL_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Issuer of the tool channel (the entry point of ToolCatalog, architecture design §3.5). One authorization per native session, revoked when the session closes; authorization is bound to the session only, and tool-call permissions are checked in the Runtime against the session's current task.
 */
export interface AgentToolAccess {
  grant(conversationId: Id): ToolGrant;
  /** Entry-layer guidance (§3.8): handed to the native session as developer instructions. */
  readonly instructions: string;
  /**
   * A segment appended after `instructions` at the start of each native session (§3.8: index of open skills). An empty string means nothing is appended; on error it is treated as empty and doesn't block the session. It is fetched only once at session start: changes made during the session do not affect this native session.
   */
  sessionInstructions?(conversationId: Id): Promise<string>;
}

export interface ToolGrant {
  mcpServers: Record<string, McpServerSpec>;
  revoke(): void;
}

/** Native resume handle. The Runtime only stores it and does not interpret it. */
export type AgentPersistenceHandle = { driverId: DriverId; data: unknown };

export interface AgentInput {
  text: string;
  /** Images attached to a message, already stored locally. The Harness doesn't pass them when the Driver doesn't support images (`capabilities.images` is false). */
  images?: AgentImage[];
}

export interface AgentImage {
  path: string;
  mimeType: string;
}

export interface InterruptReceipt {
  /** `unknown`: whether native cancellation took effect is uncertain; the caller must not immediately let through the replacement turn (§3.1). */
  status: 'requested' | 'not-running' | 'unknown';
}

export interface ApprovalResponse {
  /**
   * `cancel`: rejects and ends this turn; used only by the stop barrier (D04), not exposed externally. `accept-always` at the Driver is equivalent to `accept-for-session`: the rule is stored by the Harness, and the Driver doesn't write native persistent settings.
   */
  decision: ApprovalDecision | 'cancel';
}

export interface AgentSession {
  readonly id: Id;
  readonly capabilities: DriverProbe['capabilities'];
  startTurn(input: AgentInput, settings: TurnSettings): Promise<{ turnId: string }>;
  steer?(turnId: string, input: AgentInput): Promise<'accepted' | 'unavailable'>;
  interrupt(turnId: string): Promise<InterruptReceipt>;
  respondToApproval(approvalId: Id, response: ApprovalResponse): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  describePersistence(): AgentPersistenceHandle | null;
  close(): Promise<void>;
}

/** Driver-independent entry. */
export type AgentItem =
  | { kind: 'agent-message'; id: string; text: string }
  | { kind: 'reasoning'; id: string; text: string }
  | {
      kind: 'tool-call';
      id: string;
      tool: ToolCallKind;
      title: string;
      detail: string | null;
      output: string | null;
      status: ToolCallStatus;
      exitCode: number | null;
      durationMs: number | null;
    }
  | { kind: 'user-message'; id: string; text: string }
  | { kind: 'other'; id: string; label: string };

export type TurnOutcome = 'completed' | 'interrupted' | 'failed';

export type AgentEvent =
  | { type: 'turn.started'; turnId: string }
  | {
      type: 'turn.completed';
      turnId: string;
      outcome: TurnOutcome;
      error: string | null;
      /** Message reference for `error` (message-ref.ts): included when the Driver wrote the reason itself; not included when it is the Agent's original words. */
      errorRef?: MessageRef;
      errorCode?: AgentErrorCode | null;
    }
  | { type: 'item.started'; turnId: string; item: AgentItem }
  | { type: 'item.completed'; turnId: string; item: AgentItem }
  | {
      type: 'item.delta';
      turnId: string;
      itemId: string;
      channel: 'text' | 'reasoning' | 'output';
      delta: string;
    }
  | {
      type: 'approval.requested';
      turnId: string;
      approvalId: Id;
      request: ApprovalRequest;
      /**
       * Whether this request is an attempt to escape the sandbox (writing outside the working directory, network access, etc.), not a per-item confirmation required by policy. The Harness counts it as `high` based on this (§3.12). Not given when the Driver doesn't know.
       */
      escalation?: boolean;
    }
  /** The native side has already settled this approval (e.g., the turn was interrupted), so the pending card in the UI should be collapsed. */
  | { type: 'approval.resolved'; approvalId: Id }
  | { type: 'session.warning'; message: string; messageRef?: MessageRef }
  | { type: 'session.error'; turnId: string | null; message: string; messageRef?: MessageRef; willRetry: boolean; code?: AgentErrorCode | null }
  /** Agent process exited. `error` is empty for a normal close. */
  | { type: 'session.exited'; error: string | null; errorRef?: MessageRef };
