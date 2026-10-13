import {
  clampOutput,
  nowIso,
  newId,
  refOf,
  type AgentErrorCode,
  type Id,
  type Localized,
  type MessageRef,
  type TaskStatus,
  type TimelineItem,
} from '@cuccut/protocol';
import { HarnessRuns as H } from '@cuccut/protocol/messages/harness';
import type { AgentEvent, AgentItem, TurnOutcome } from './driver.ts';
import type { ConversationState } from './conversation-state.ts';

/** Volatile state of one execution attempt (Run) in the Runtime (architecture design §1.5, D03). */
export interface RunContext {
  taskId: Id;
  runGeneration: number;
  turnId: string | null;
  /** Stop barrier established: no further calls are approved (D04). */
  stopRequested: boolean;
  /**
   * The structured reason carried by `session.error` in this turn. A later one overrides an earlier one. Used when a turn fails and the end event carries no reason, and also when the native process exits unexpectedly. Not used when the turn ends successfully (an error with `willRetry` may already have been retried successfully).
   */
  errorCode?: AgentErrorCode | null;
}

/** Follow-up actions the Harness must handle after projection. */
export type ProjectionSignal =
  | { type: 'none' }
  | { type: 'turn-finished'; outcome: TurnOutcome; error: string | Localized | null; errorCode: AgentErrorCode | null }
  | { type: 'approval-blocked'; approvalId: Id }
  | { type: 'session-exited'; error: string | Localized | null };

/**
 * Combines a text and its message ref into one `Localized` (returned as-is when there is no ref). The separate `message` / `messageRef` in a Driver event enter the entry through this, and it can also be placed as a nested argument in other copy.
 */
export function withRef(text: string, ref: MessageRef | null | undefined): string | Localized {
  return ref ? { ...refOf(ref), text, toString: () => text } : text;
}

const NONE: ProjectionSignal = { type: 'none' };

/**
 * ConversationProjector (architecture design §11.3): projects Driver events into conversation entries.
 * Card state comes only from events, never inferred from the model's natural language.
 */
export function projectAgentEvent(state: ConversationState, run: RunContext | null, event: AgentEvent): ProjectionSignal {
  const taskId = run?.taskId ?? null;
  switch (event.type) {
    case 'turn.started':
      if (run) run.turnId = event.turnId;
      return NONE;

    case 'item.started':
    case 'item.completed': {
      const item = toTimelineItem(state, itemKey(event.turnId, event.item.id), event.item, taskId, event.type === 'item.completed');
      if (item) state.upsert(item);
      return NONE;
    }

    case 'item.delta': {
      const key = itemKey(event.turnId, event.itemId);
      if (!state.item(key)) {
        if (event.channel === 'output') return NONE;
        state.upsert({
          kind: event.channel === 'reasoning' ? 'reasoning' : 'agent-message',
          id: key,
          createdAt: nowIso(),
          taskId,
          text: '',
          streaming: true,
        });
      }
      state.append(key, event.channel === 'output' ? 'output' : 'text', event.delta);
      return NONE;
    }

    case 'approval.requested': {
      const blocked = run?.stopRequested === true;
      state.upsert({
        kind: 'approval',
        id: `approval/${event.approvalId}`,
        createdAt: nowIso(),
        taskId,
        approvalId: event.approvalId,
        request: event.request,
        status: blocked ? 'cancelled' : 'pending',
        decidedAt: blocked ? nowIso() : null,
      });
      if (blocked) return { type: 'approval-blocked', approvalId: event.approvalId };
      state.updateConversation({ activity: 'awaiting-approval' });
      return NONE;
    }

    case 'approval.resolved': {
      const item = state.item(`approval/${event.approvalId}`);
      if (item?.kind === 'approval' && item.status === 'pending') {
        state.upsert({ ...item, status: 'cancelled', decidedAt: nowIso() });
        refreshActivity(state);
      }
      return NONE;
    }

    case 'session.warning':
      addNotice(state, taskId, 'warning', withRef(event.message, event.messageRef));
      return NONE;

    case 'session.error':
      if (run && event.code) run.errorCode = event.code;
      addNotice(
        state,
        taskId,
        event.willRetry ? 'warning' : 'error',
        event.willRetry ? H.retrying({ message: withRef(event.message, event.messageRef) }) : withRef(event.message, event.messageRef),
      );
      return NONE;

    case 'turn.completed':
      return {
        type: 'turn-finished',
        outcome: event.outcome,
        error: event.error === null ? null : withRef(event.error, event.errorRef),
        errorCode: event.errorCode ?? null,
      };

    case 'session.exited':
      return { type: 'session-exited', error: event.error === null ? null : withRef(event.error, event.errorRef) };
  }
}

/** End the task: collapse all unfinished entries, write the task's terminal state, and return the session to idle or failed. */
export function finishTask(
  state: ConversationState,
  run: RunContext,
  status: TaskStatus,
  error: string | Localized | null,
  errorCode: AgentErrorCode | null = null,
): void {
  for (const item of state.items()) {
    if (item.taskId !== run.taskId) continue;
    if ((item.kind === 'agent-message' || item.kind === 'reasoning') && item.streaming) {
      state.upsert({ ...item, streaming: false });
    } else if (item.kind === 'tool-call' && item.status === 'running') {
      state.upsert({ ...item, status: 'interrupted' });
    } else if (item.kind === 'approval' && item.status === 'pending') {
      state.upsert({ ...item, status: 'cancelled', decidedAt: nowIso() });
    }
  }
  const task = state.item(run.taskId);
  if (task?.kind === 'task') {
    const { errorRef: _stale, ...rest } = task;
    state.upsert({
      ...rest,
      status,
      endedAt: nowIso(),
      error: error === null ? null : String(error),
      ...(error !== null && typeof error !== 'string' ? { errorRef: refOf(error) } : {}),
      ...(errorCode ? { errorCode } : {}),
    });
  }
  // A finished task counts as read only once the user has seen it. A UI currently viewing this session marks it read immediately.
  state.updateConversation({ activity: status === 'failed' ? 'failed' : 'idle', activeTaskId: null, unread: true });
}

/** The session's activity state is re-summarized from its entries: a pending approval means “waiting for approval”. */
export function refreshActivity(state: ConversationState): void {
  const conv = state.conversation;
  if (!conv.activeTaskId) return;
  if (conv.activity === 'stopping') return;
  const waiting = state.items().some((i) => i.kind === 'approval' && i.status === 'pending' && i.taskId === conv.activeTaskId);
  const activity = waiting ? 'awaiting-approval' : 'running';
  if (conv.activity !== activity) state.updateConversation({ activity });
}

/** One prompt in the session. CucCut's own messages are `Localized` (with a ref, so the UI regenerates them in the current language); the Agent's verbatim words are plain strings. */
export function addNotice(state: ConversationState, taskId: Id | null, level: 'info' | 'warning' | 'error', text: string | Localized): void {
  const ref = typeof text === 'string' ? null : refOf(text);
  state.upsert({ kind: 'notice', id: newId('note'), createdAt: nowIso(), taskId, level, text: String(text), ...(ref ? { textRef: ref } : {}) });
}

function itemKey(turnId: string, itemId: string): Id {
  return `${turnId || 'turn'}/${itemId}`;
}

function toTimelineItem(
  state: ConversationState,
  id: Id,
  item: AgentItem,
  taskId: Id | null,
  completed: boolean,
): TimelineItem | null {
  const existing = state.item(id);
  const createdAt = existing?.createdAt ?? nowIso();
  switch (item.kind) {
    case 'agent-message':
    case 'reasoning': {
      // The completion event carries the full text; the start event may be empty, in which case keep the text already streamed in.
      const prior = existing && (existing.kind === 'agent-message' || existing.kind === 'reasoning') ? existing.text : '';
      const text = completed ? item.text || prior : prior || item.text;
      return { kind: item.kind, id, createdAt, taskId, text, streaming: !completed };
    }
    case 'tool-call': {
      const priorOutput = existing?.kind === 'tool-call' ? existing.output : '';
      return {
        kind: 'tool-call',
        id,
        createdAt,
        taskId,
        tool: item.tool,
        title: item.title,
        detail: item.detail,
        output: clampOutput(item.output ?? priorOutput),
        status: completed && item.status === 'running' ? 'completed' : item.status,
        exitCode: item.exitCode,
        durationMs: item.durationMs,
      };
    }
    case 'user-message':
    case 'other':
      return null;
  }
}
