import type { Id, MessageRef, TimelineItem } from '@cuccut/protocol';

/** The source of a video (`VideoRef.source`): which project it belongs to, or which working directory of a no-project session it is in. */
export interface HandoffSource {
  projectId: Id | null;
  conversationId: Id | null;
}

/** Picks the session fields to show (the `Conversation` in the directory). */
export interface HandoffConversation {
  id: Id;
  projectId: Id | null;
  /** For a session that shares another session's working directory: that session's id. */
  folderOf?: Id;
  title: string;
  archived: boolean;
  updatedAt: string;
}

/**
 * Which session “continue with this video's current session” refers to in the “Session” row (prototype model-ai-prompt.js `sessionOptions`: the most recent one in this project):
 *
 * 1. If the user is currently in a session (the one on the left of Home, or the floating session for this video in Space that was started most recently): if it belongs to the same project as the video, or is the no-project session the video lives in (or one sharing its working directory), that is the one.
 * 2. If the video belongs to a project: the most recently updated, non-archived session in that project.
 * 3. If the video does not belong to a project: the most recently updated, non-archived session among the one it lives in and the sessions sharing its working directory; if all of them are archived, the one it lives in.
 *
 * null if there is none. Whether anything has been said (message count) is checked by the caller: a session with no messages does not get “continue” (`sessionOptions`).
 */
export function currentConversation<T extends HandoffConversation>({
  source,
  current,
  conversations,
}: {
  source: HandoffSource | null;
  current: Id | null;
  conversations: readonly T[];
}): T | null {
  if (!source) return null;
  const belongs = (c: T) =>
    source.projectId ? c.projectId === source.projectId : c.id === source.conversationId || (!!c.folderOf && c.folderOf === source.conversationId);
  const here = current ? conversations.find((c) => c.id === current) : undefined;
  if (here && belongs(here)) return here;
  let latest: T | null = null;
  for (const c of conversations) if (!c.archived && belongs(c) && (!latest || c.updatedAt > latest.updatedAt)) latest = c;
  if (!latest && !source.projectId) return conversations.find((c) => c.id === source.conversationId) ?? null;
  return latest;
}

/**
 * Where a handoff to the Agent is sent: a new session (in the video's project, or sharing the working directory of the no-project session the video lives in: `folderOf`), or continuing an existing one.
 */
export type HandoffPlan =
  | { kind: 'existing'; conversationId: Id }
  | { kind: 'create'; projectId: Id }
  | { kind: 'create'; projectId: null; folderOf: Id }
  | { kind: 'none' };

/**
 * Where to send based on the choice in the “Session” row (product design §5.10 “hand to agent”): a new session is created in the video's project. If the video is not in a project, the new session shares its working directory with the session the video lives in (architecture design §3.10, `conversations.create` `folderOf`), and it can be opened the same way, without creating a project. That session must still be in the directory.
 * The session being continued must also still be in the directory.
 */
export function planHandoff({
  session,
  source,
  conversations,
}: {
  session: 'new' | { id: Id };
  source: HandoffSource | null;
  conversations: readonly { id: Id }[];
}): HandoffPlan {
  if (session === 'new') {
    if (source?.projectId) return { kind: 'create', projectId: source.projectId };
    const owner = source?.conversationId;
    return owner && conversations.some((c) => c.id === owner) ? { kind: 'create', projectId: null, folderOf: owner } : { kind: 'none' };
  }
  return conversations.some((c) => c.id === session.id) ? { kind: 'existing', conversationId: session.id } : { kind: 'none' };
}

/** The message count in a session (the “Session” row shows “already has n messages”): what the user said and what the Agent replied both count; tool calls, thinking, and notifications do not. */
export function messageCount(items: readonly { kind: string }[]): number {
  let n = 0;
  for (const item of items) if (item.kind === 'user-message' || item.kind === 'agent-message') n++;
  return n;
}

/**
 * How far the handoff from a tools page that stays in place (finding cut points, refreshing stale translations; `agentStaysOnPage`) has got, read from that session's timeline (prototype model-agent.js `sessionProgress`): `starting` while the messages are still queued or the task has not appeared yet. While the task runs, a pending approval means `waiting` (the user has to go to the session and allow it); otherwise it is `running`, and `step` is the title of the most recent step. When the task ends, it follows the task's status. The results themselves (cut suggestions, re-translated sentences) are written into the video as usual; this only reports progress.
 */
export type AgentRunState =
  | { kind: 'starting' }
  | { kind: 'running'; step: string | null }
  | { kind: 'waiting'; step: string | null }
  | { kind: 'done' }
  | { kind: 'failed'; error: string | null; errorRef: MessageRef | null }
  | { kind: 'stopped' };

/**
 * Matching the task: if a task ID came back when the message was sent, match by it. A message that was queued (the session was busy) has none, so match the first task that starts after the handoff. The same sentence may have been sent more than once in this session, so it is not matched by its text.
 */
export function agentRunState({
  taskId,
  handedAt,
  items,
}: {
  taskId: Id | null;
  handedAt: string;
  items: readonly TimelineItem[] | undefined;
}): AgentRunState {
  if (!items) return { kind: 'starting' };
  let task: Extract<TimelineItem, { kind: 'task' }> | null = null;
  for (const item of items) {
    if (item.kind !== 'task') continue;
    if (taskId ? item.id === taskId : item.startedAt >= handedAt) {
      task = item;
      break;
    }
  }
  if (!task) return { kind: 'starting' };
  const id = task.id;
  if (task.status === 'completed') return { kind: 'done' };
  if (task.status === 'stopped') return { kind: 'stopped' };
  if (task.status === 'failed') return { kind: 'failed', error: task.error, errorRef: task.errorRef ?? null };
  let step: string | null = null;
  let waiting = false;
  for (const item of items) {
    if (item.taskId !== id) continue;
    if (item.kind === 'tool-call') step = item.title;
    else if (item.kind === 'approval') waiting = item.status === 'pending';
  }
  return waiting ? { kind: 'waiting', step } : { kind: 'running', step };
}

/** A handoff recorded on this machine (`useAiToolAgentRuns`): `restored` marks one that was left from the last time the App was opened and has not been matched yet in this session. */
export interface StoredAgentRun {
  conversationId: Id;
  taskId: Id | null;
  restored?: boolean;
}

/**
 * Reconnects to a handoff still running after a restart (prototype panel-aitools.jsx: “when the tools page is reopened, reconnect to the one still running”). For a record left over from last time: if that session's task is still running (one sent with a task ID must be the same task; one that was queued, when the session is busy or the message is still in the queue), it reconnects and removes `restored`, so the tools page keeps drawing progress and shows the result when it finishes.
 * Ones that already finished, or whose session no longer exists, are dropped, and the tools page goes back to the parameters page. Nothing changes if the directory has not loaded yet. Handoffs made after this opening are not affected. Returns the original object when nothing changed.
 */
export function adoptRestoredRuns<T extends StoredAgentRun>(
  runs: Record<string, T>,
  {
    ready,
    conversations,
    queued,
  }: { ready: boolean; conversations: readonly { id: Id; activeTaskId: Id | null }[]; queued: (conversationId: Id) => boolean },
): Record<string, T> {
  if (!ready) return runs;
  let changed = false;
  const next: Record<string, T> = {};
  for (const [key, run] of Object.entries(runs)) {
    if (!run.restored) {
      next[key] = run;
      continue;
    }
    changed = true;
    const active = conversations.find((c) => c.id === run.conversationId)?.activeTaskId ?? null;
    const live = run.taskId ? active === run.taskId : active !== null || queued(run.conversationId);
    if (live) {
      const { restored: _drop, ...adopted } = run;
      next[key] = adopted as T;
    }
  }
  return changed ? next : runs;
}

/**
 * When a message was not sent, puts the sentence back into the input box (for example, the Agent is not connected, or sending failed). If the box already has text, it is appended after it with a blank line, so nothing the user was partway through writing is overwritten; if the same sentence is already there, it is not added again.
 */
export function mergeDraft(existing: string | undefined, text: string): string {
  const before = existing ?? '';
  const next = text.trim();
  if (!next) return before;
  if (!before.trim()) return next;
  if (before.includes(next)) return before;
  return `${before.trimEnd()}\n\n${next}`;
}
