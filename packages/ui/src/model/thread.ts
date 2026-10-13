import { live, type ApprovalDecision, type ApprovalRequest, type HistoryEntry, type Id, type RiskLevel, type TimelineItem } from '@cuccut/protocol';
import { APPROVAL_COPY } from '../copy.ts';
import { cuccutStep, type CucCutStepKind } from './agent-tool-steps.ts';
import { shortenPath } from './format.ts';
import { M } from './thread-copy.ts';

type Item<K extends TimelineItem['kind']> = Extract<TimelineItem, { kind: K }>;

/**
 * A group of consecutive execution steps (reasoning, tool calls, and receipts for video edits), folded by default into a one-line summary (product design §3.2.2).
 * `undone`: the transaction ids of those edits in this session that were later undone (receipts use this to show “Undone”).
 */
export interface StepsBlock {
  type: 'steps';
  id: Id;
  items: (Item<'reasoning'> | Item<'tool-call'> | Item<'video-change'>)[];
  undone: ReadonlySet<Id>;
}

export type ThreadBlock =
  | { type: 'user'; id: Id; item: Item<'user-message'> }
  | { type: 'agent'; id: Id; item: Item<'agent-message'> }
  | StepsBlock
  | { type: 'approval'; id: Id; item: Item<'approval'> }
  | { type: 'notice'; id: Id; item: Item<'notice'> }
  /** Status line of a task: placed at the end of the task, it reads “Worked for X” or gives the reason it stopped or failed. */
  | { type: 'task'; id: Id; item: Item<'task'> };

/**
 * Arranges entries into thread blocks, in order of appearance; consecutive steps are merged into one group; a task entry is moved after its last entry.
 * Receipts for video edits (product design §6.5 change card) are also part of the process and are folded into the same group as the steps: between two passages of text there is only one summary line, and the receipts are ordered by time once expanded.
 */
export function buildThread(items: readonly TimelineItem[]): ThreadBlock[] {
  const tasks = new Map<Id, Item<'task'>>();
  const lastIndex = new Map<Id, number>();
  const undone = new Set<Id>();
  items.forEach((item, i) => {
    if (item.kind === 'task') tasks.set(item.id, item);
    if (item.kind === 'video-change' && item.undoOf) undone.add(item.undoOf);
    if (item.taskId) lastIndex.set(item.taskId, i);
  });

  const blocks: ThreadBlock[] = [];
  let steps: StepsBlock | null = null;
  const flushTasksEndingAt = (i: number) => {
    for (const [taskId, task] of tasks) {
      if (lastIndex.get(taskId) === i) blocks.push({ type: 'task', id: `task-end/${taskId}`, item: task });
    }
  };

  items.forEach((item, i) => {
    // Records for newly created videos, slides, designs and design systems take no row and do not break a step group: the video card is attached by video-cards.ts after the row in this round that last references it,
    // and slide, design and design-system cards work the same way.
    if (item.kind === 'video-created' || item.kind === 'slides-created' || item.kind === 'design-created' || item.kind === 'design-system-created') {
      flushTasksEndingAt(i);
      return;
    }
    if (item.kind === 'reasoning' || item.kind === 'tool-call' || item.kind === 'video-change') {
      if (item.kind === 'reasoning' && !item.text.trim()) {
        flushTasksEndingAt(i);
        return;
      }
      if (!steps) {
        steps = { type: 'steps', id: `steps/${item.id}`, items: [], undone };
        blocks.push(steps);
      }
      steps.items.push(item);
    } else {
      if (item.kind !== 'task') steps = null;
      switch (item.kind) {
        case 'user-message':
          blocks.push({ type: 'user', id: item.id, item });
          break;
        case 'agent-message':
          // A reply that is still streaming and has no text yet takes no row: whether this round is still running is shown by the turn footer.
          if (item.text.trim()) blocks.push({ type: 'agent', id: item.id, item });
          break;
        case 'approval':
          blocks.push({ type: 'approval', id: item.id, item });
          break;
        case 'notice':
          blocks.push({ type: 'notice', id: item.id, item });
          break;
        case 'task':
          break;
      }
    }
    flushTasksEndingAt(i);
  });
  return blocks;
}

/** CucCut's own video tools (the Runtime's MCP tool channel, server name `cuccut`). */

function videoTool(item: Item<'tool-call'>): string | null {
  if (item.tool !== 'mcp' || !item.title.startsWith('cuccut.')) return null;
  return item.title.slice('cuccut.'.length);
}

/** Title of a step row: video tools are written as actions (`M.videoTools`), with edits carrying their description; everything else is kept as is. */
export function toolTitle(item: Item<'tool-call'>): string {
  const name = videoTool(item);
  const action = name && Object.hasOwn(M.videoTools, name) ? M.videoTools[name] : undefined;
  if (!action) return item.title;
  let label: unknown;
  try {
    label = item.detail ? (JSON.parse(item.detail) as { label?: unknown }).label : undefined;
  } catch {
    label = undefined;
  }
  return typeof label === 'string' && label ? M.toolTitle(action, label) : action;
}

/** Category of a step row (product design §3.2.2): the protocol's tool kinds have no “Read”, so reads and searches are derived from `(tool, title)`. */
export type StepKind = 'command' | 'read' | 'edit' | 'search' | 'other';

export const STEP_LABELS: Record<StepKind, string> = live(() => M.steps);

/**
 * The Claude Driver records its built-in read and search tools as `other`, with titles of the form “<tool name> <short description>” (claude-items in agent-drivers):
 * `Read <路径>`, `Grep <模式> · <路径>`, `Glob <模式> · <路径>`.
 */
const READ_TITLE = /^Read(?:\s+(.*))?$/;
const SEARCH_TITLE = /^(?:Grep|Glob)(?:\s+(.*))?$/;

/** Paths are relative to the session working directory (absolute paths under the working directory have the prefix removed, and `./` is removed). */
export function relativePath(path: string, cwd?: string | null): string {
  if (path.startsWith('./')) return path.slice(2);
  if (cwd && path.startsWith('/')) {
    const root = cwd.replace(/\/+$/, '');
    if (path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  }
  return path;
}

/** Files involved in an edit step (including deletions): Codex writes each line as “<type> <path>”, Claude as “<tool name> <path>”; if neither is present, the title is used. */
function editPaths(item: Item<'tool-call'>): string[] {
  const fromDetail = (item.detail ?? '').split('\n').flatMap((line) => {
    const space = line.indexOf(' ');
    const path = space > 0 ? line.slice(space + 1).trim() : '';
    return path ? [path] : [];
  });
  if (fromDetail.length) return fromDetail;
  return item.title
    .split(', ')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * The category, fixed category name and secondary summary of one tool call (the command itself, relative path, query terms). CucCut's own tools show their own category name and argument summary
 * (agent-tool-steps.ts); `tool` is their category key (the icon is taken from it), and the group header summary still counts them as “Called a tool”.
 */
export function toolStep(
  item: Item<'tool-call'>,
  cwd?: string | null,
): { kind: StepKind; label: string; summary: string; tool?: CucCutStepKind } {
  const step = (kind: StepKind, summary: string) => ({ kind, label: STEP_LABELS[kind], summary: summary.trim() });
  switch (item.tool) {
    case 'command':
      return step('command', item.title);
    case 'file-change':
      return step(
        'edit',
        editPaths(item)
          .map((p) => relativePath(p, cwd))
          .join(', '),
      );
    case 'web-search':
      return step('search', item.title);
    case 'other': {
      const read = READ_TITLE.exec(item.title);
      if (read) return step('read', relativePath(read[1] ?? '', cwd));
      const search = SEARCH_TITLE.exec(item.title);
      if (search) return step('search', search[1] ?? '');
      return step('other', toolTitle(item));
    }
    case 'mcp': {
      const cuccut = cuccutStep(item);
      if (cuccut) return { kind: 'other', label: cuccut.label, summary: cuccut.summary, tool: cuccut.kind };
      return step('other', toolTitle(item));
    }
  }
}

/** Paths used for file counting: reads take the path in the summary, and edits take every file the change involves. */
function stepPaths(item: Item<'tool-call'>, kind: StepKind, cwd?: string | null): string[] {
  if (kind === 'edit') return editPaths(item).map((p) => relativePath(p, cwd));
  if (kind === 'read') return [toolStep(item, cwd).summary];
  return [];
}

/**
 * One-sentence summary of a group of steps: grouped in order of each kind's first appearance; reads and edits are counted by deduplicated path,
 * and video edits are counted by receipt (“Read 2 files, ran a command”). When there is only thinking, it reads “Thinking”.
 *
 * Only receipts are counted: tools that submit video edits put a receipt in the call (apart from `edits_apply`, transcription and translation also submit them),
 * and one successful `edits_apply` is both a tool call and a receipt, so counting by calls would double-count, while failed calls submit nothing.
 */
export function stepsSummary(items: StepsBlock['items'], cwd?: string | null): string {
  type Key = Exclude<StepKind, 'other'> | 'video' | 'tool';
  const order: Key[] = [];
  const paths: Partial<Record<Key, Set<string>>> = {};
  let videoEdits = 0;
  for (const item of items) {
    if (item.kind === 'video-change') {
      if (!order.includes('video')) order.push('video');
      videoEdits++;
      continue;
    }
    if (item.kind !== 'tool-call') continue;
    const { kind } = toolStep(item, cwd);
    const key: Key = kind === 'other' ? 'tool' : kind;
    if (!order.includes(key)) order.push(key);
    for (const path of stepPaths(item, kind, cwd)) (paths[key] ??= new Set()).add(path);
  }
  const P = M.phrase;
  const phrase: Record<Key, string> = {
    command: P.command,
    read: P.read(paths.read?.size ?? 0),
    edit: P.edit(paths.edit?.size ?? 0),
    search: P.search,
    video: P.video(videoEdits),
    tool: P.tool,
  };
  if (order.length) return M.summary(order.map((key) => phrase[key]));
  return items.some((i) => i.kind === 'reasoning') ? M.thinking : M.stepsFallback;
}

/**
 * Which files were changed in a file-change step. The Codex Driver writes each change as a line “<type> <path>” (map-item in agent-drivers).
 * Deleted files cannot be opened.
 */
export function changedFiles(item: Item<'tool-call'>): { path: string; change: string }[] {
  if (item.tool !== 'file-change' || !item.detail) return [];
  return item.detail.split('\n').flatMap((line) => {
    const space = line.indexOf(' ');
    if (space <= 0) return [];
    const change = line.slice(0, space);
    const path = line.slice(space + 1).trim();
    return path && change !== 'delete' ? [{ path, change }] : [];
  });
}

// ---- Approval card ----

/**
 * Title, action kind, displayed input summary, and full text for copying, of the approval card (prototype agent-thread.jsx `PermissionMsg`).
 * The input of a tool call is the tool name plus its target; the argument summary is in `reason`, and the card writes it on its own line. `risk` is taken from the timeline entry (older records do not have it).
 */
export function approvalSummary(
  request: ApprovalRequest,
  risk?: RiskLevel,
): { title: string; kind: string; subject: string; copyText: string } {
  switch (request.kind) {
    case 'command':
      return { title: APPROVAL_COPY.title.command, kind: APPROVAL_COPY.kind.command, subject: request.command, copyText: request.command };
    case 'file-change':
      return {
        title: APPROVAL_COPY.title['file-change'],
        kind: APPROVAL_COPY.kind['file-change'],
        subject: request.files.length ? request.files.map(shortenPath).join('\n') : APPROVAL_COPY.projectFiles,
        copyText: request.files.length ? request.files.join('\n') : APPROVAL_COPY.projectFiles,
      };
    case 'tool':
      return {
        title: risk === 'high' ? APPROVAL_COPY.title.highRisk : APPROVAL_COPY.title.tool,
        kind: APPROVAL_COPY.kind.tool,
        subject: [request.tool, ...request.files.map(shortenPath)].join('\n'),
        copyText: [request.tool, ...request.files].join('\n'),
      };
  }
}

/**
 * What is written when a decided approval collapses into one line (the `label` of the prototype `PermissionMsg`). For approvals auto-allowed by a rule or access mode, the prototype's
 * `autoAllowLabel` line is written; for “Always allow” clicked by the user, “Stop asking about <rule> from now on” is written.
 *
 * The answer the user clicked is taken from the timeline's `decision`; earlier records do not have it, so it falls back to `chosen` (the answer clicked in this window),
 * and if neither exists, “Allowed” is written.
 * The prototype also distinguishes two auto-allow kinds, “Edit” and “Reply loop”; `decidedBy: 'auto'` cannot tell which tier let it through, so “Access mode” is always written.
 */
export function approvalDecidedLabel(item: Item<'approval'>, chosen: ApprovalDecision | undefined): string {
  const rule = item.request.rule ?? null;
  switch (item.status) {
    case 'accepted':
      if (item.decidedBy === 'rule') return APPROVAL_COPY.autoRule(rule);
      if (item.decidedBy === 'auto') return APPROVAL_COPY.autoMode;
      return (item.decision ?? chosen) === 'accept-always' && rule ? APPROVAL_COPY.acceptedAlways(rule) : APPROVAL_COPY.accepted;
    case 'declined':
      return APPROVAL_COPY.declined;
    case 'cancelled':
      return APPROVAL_COPY.cancelled;
    case 'pending':
      return '';
  }
}

// ---- Undo and restore of change cards ----

/** The last action taken on this card in this window: undo (yielding compensating transaction U), or restore (undoing U, yielding R). */
export type LocalUndoAction = { kind: 'undo'; transactionId: Id } | { kind: 'restore'; transactionId: Id };

export type ChangeUndoState =
  | { state: 'applied' }
  /** `restore`: when restoring is possible, the compensating transaction to undo (undoing it puts this step back); otherwise null. */
  | { state: 'undone'; restore: Id | null };

/**
 * Whether a change card is “Undone” or still in effect, and whether it can be “Restored”.
 *
 * - When the editor has this video open, there is history (`history`): starting from this entry, follow `undoneBy`; being undone an odd number of times means undone,
 *   and the last entry on the chain (an undo at an odd level) is the one to undo when restoring.
 * - With no history (the video is not open), or when the history does not yet include the action just taken in this window: use the action in this window, and failing that, the undo recorded in the session (`undoneInThread`).
 * - Restore is offered only when that entry is exactly the top of the current connection's “Redo” stack (`redo`, from edits.undoState). An undo is a compensating transaction:
 *   when it is not the top of the stack (you have edited this video since, or the undo was done by the Agent), it cannot reliably be judged that undoing it puts this step back, so “Restore” is not drawn.
 */
export function changeUndoState(input: {
  transactionId: Id;
  undoneInThread: boolean;
  local: LocalUndoAction | null;
  history: readonly HistoryEntry[] | null;
  redo: Id | null;
}): ChangeUndoState {
  const { transactionId, undoneInThread, local, history, redo } = input;
  const undone = (undo: Id): ChangeUndoState => ({ state: 'undone', restore: redo === undo ? undo : null });
  const byId = history ? new Map(history.map((entry) => [entry.transactionId, entry])) : null;
  if (byId?.has(transactionId) && (!local || byId.has(local.transactionId))) {
    let current = transactionId;
    let flips = 0;
    const seen = new Set<Id>([transactionId]);
    for (let next = byId.get(current)?.undoneBy; next && !seen.has(next); next = byId.get(current)?.undoneBy) {
      seen.add(next);
      current = next;
      flips++;
    }
    return flips % 2 === 1 ? undone(current) : { state: 'applied' };
  }
  if (local) return local.kind === 'undo' ? undone(local.transactionId) : { state: 'applied' };
  return undoneInThread ? { state: 'undone', restore: null } : { state: 'applied' };
}
