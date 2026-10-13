import {
  localizeText,
  type Id,
  type JobRecord,
  type ModelBundleStatus,
  type ModelCapabilitiesView,
  type SpaceEntry,
  type TimelineItem,
  type VideoChange,
} from '@cuccut/protocol';
import { JOB_PHASE_LABEL, VIDEO_CARD_COPY } from '../copy.ts';
import type { ConversationOutput } from './conversation-outputs.ts';
import {
  cancelPending,
  exportOutputs,
  exportPhaseLabel,
  exportProgressLine,
  exportTitle,
  exportWarnings,
  isPreviewExport,
  type ExportOutputFact,
} from './export-job.ts';
import { formatClock } from './format.ts';
import { downloadProgress, isLinkImport, linkFrozen, linkIssue, linkMeta, linkPhaseText, linkSummary } from './link-import.ts';
import { isPlayable, videoTargetOf } from './space.ts';
import { jobRemedy, type Remedy } from './task-facts.ts';
import { jobLive, jobPercent, jobRetrying, kindLabel, runsOnLabel } from './task-list.ts';
import { bundleName } from './models-local.ts';
import { langName } from './tools-models.ts';
import { reconcileOptions } from './task-reconcile.ts';
import type { ThreadBlock } from './thread.ts';
import { isAgentTranslate, isTranslateJob, TRANSLATE_PIPELINE, targetOf, translateProgress } from './translate-progress.ts';
import { jobErrorText, jobWaitText } from './localized-text.ts';

/**
 * Video cards and download cards in the conversation thread (product design §3.2.2, §6.5; prototype model-agent-cards.js, model-agent-projects.js `sessionArtifacts`).
 * Pure functions: card content is computed only from conversation entries (`video-created`, `video-change`) and from the Job records submitted by the agent. It does not read reply text.
 *
 * - **One video card per video per conversation.** A video is “referenced” when the conversation has its `video-created` / `video-change`, when a task in some turn submitted a Job pointing at it (transcription, export, translation, importing from a link into it; a Job's reference lands on the last group of steps of that task), or when the first user message carries its editor state (`openingVideo`: a conversation that starts from an open video, with the video brought in by the first sentence). The card attaches to the later of the two places below:
 *   (a) after the last block that references it; (b) if an activity on the card has not ended by the start of a later turn (running or queued): after the last block of the last turn that started before that activity ended (while still running, this is the latest turn). Only the activity's `endedAt` and that turn's user message `createdAt` are compared. Once the activity ends, the card no longer moves and does not move back. After the card moves away, earlier turns no longer have it. The card lists all activities of this conversation on this video, the same as the card in the “Artifacts” popover.
 * - **Download card:** for a link import started by the agent, one card while the parent task has no `videoId` yet. Once the video is created (the parent task carries `videoId`), the video card replaces it at the same position, and the download activity is merged into the card (a transcription submitted by the pipeline is one row). A download-only job that creates no video keeps the download card after completion and records the saved files.
 * - Generation tasks such as speech synthesis and image generation do not go into video cards (the prototype's candidate cards do not exist in the shipped app yet).
 *
 * Assigning Jobs to turns: `submitter` is the agent of this conversation (`kind: 'agent'`, `id` is the conversation), and `taskId` is that turn's task. Jobs submitted by a fixed pipeline (`submitter.kind === 'pipeline'`) are assigned to the parent task. A pipeline's steps (`parentJobId`) do not get rows of their own; their progress is read through the parent task.
 */

type Item<K extends TimelineItem['kind']> = Extract<TimelineItem, { kind: K }>;

export type ThreadCard =
  /** `jobIds`: the activities (rows) this conversation has on this video, in submission order (the same list as `conversationVideoJobs`). */
  { kind: 'video'; key: string; video: ConversationOutput; jobIds: Id[] } | { kind: 'download'; key: string; jobId: Id };

/** Jobs that become a row on the video card: transcription, export, fixed pipelines (translation, importing from a link into this video, …), and the agent's own translation. */
function isRowJob(job: JobRecord): boolean {
  return !isPreviewExport(job) && (job.kind === 'transcribe' || job.kind === 'export' || job.kind === 'pipeline' || isAgentTranslate(job));
}

/** The agent task in the conversation that a Job belongs to: a Job submitted directly by the agent belongs to that agent's own task; a Job submitted by a fixed pipeline belongs to the parent task (walking up at most a few levels). */
export function agentOwner(job: JobRecord, byId: ReadonlyMap<Id, JobRecord>, conversationId: Id): JobRecord | null {
  let cur: JobRecord | undefined = job;
  for (let depth = 0; cur && depth < 4; depth++) {
    const s: JobRecord['submitter'] = cur.submitter;
    if (s.kind === 'agent') return s.id === conversationId ? cur : null;
    if (s.kind !== 'pipeline') return null;
    cur = byId.get(s.id);
  }
  return null;
}

function agentTaskId(job: JobRecord): Id | null {
  return job.submitter.kind === 'agent' ? job.submitter.taskId : null;
}

/** Whether this video entry in Space is at this location (source directory + relative path). */
export function isVideoAt(entry: SpaceEntry, target: VideoChange['target']): boolean {
  if (entry.kind !== 'video' || entry.relPath !== target.path) return false;
  return 'projectId' in target ? entry.source.projectId === target.projectId : entry.source.conversationId === target.conversationId;
}

function blockTaskIds(block: ThreadBlock): Id[] {
  if (block.type === 'steps') return [...new Set(block.items.map((i) => i.taskId).filter((id): id is Id => !!id))];
  return block.item.taskId ? [block.item.taskId] : [];
}

/**
 * The video's name, open location and duration on the card: the most recent `video-created` / `video-change` in the conversation, or the Space entry
 * (the name follows Space; a video newly created by a pipeline can only be found through `ref.videoId`). If neither exists, the link's title. When no location is found, `video` is null (the button is disabled).
 */
export function videoOutput(
  videoId: Id,
  items: readonly TimelineItem[],
  entries: readonly SpaceEntry[],
  jobs: readonly JobRecord[],
): ConversationOutput {
  const last = items.findLast(
    (i): i is Item<'video-change'> | Item<'video-created'> =>
      (i.kind === 'video-change' || i.kind === 'video-created') && i.videoId === videoId,
  );
  const change = items.findLast((i): i is Item<'video-change'> => i.kind === 'video-change' && i.videoId === videoId);
  // Videos that come in only with the first message (`openingVideo`): the name and time are taken from that message.
  const said = items.find((i): i is Item<'user-message'> => i.kind === 'user-message' && i.context?.videoId === videoId);
  const entry =
    entries.find((e) => e.kind === 'video' && e.ref && 'videoId' in e.ref && e.ref.videoId === videoId) ??
    (last ? entries.find((e) => isVideoAt(e, last.target)) : undefined) ??
    null;
  const link = jobs.find((j) => isLinkImport(j) && j.videoId === videoId);
  const latest = jobs
    .filter((j) => j.videoId === videoId)
    .reduce<JobRecord | null>((a, j) => (!a || j.createdAt > a.createdAt ? j : a), null);
  const linkName = link ? (linkMeta(link).title ?? null) : null;
  return {
    id: videoId,
    kind: 'video',
    name: entry?.name ?? last?.videoName ?? said?.context?.videoName ?? linkName ?? VIDEO_CARD_COPY.download.fallbackName,
    video: last?.target ?? (entry ? videoTargetOf(entry) : null),
    entry,
    durationSeconds: change?.durationSeconds.after ?? entry?.media?.durationSec ?? null,
    at: last?.createdAt ?? latest?.createdAt ?? said?.createdAt ?? '',
    taskId: last?.taskId ?? null,
  };
}

/**
 * A video brought into the conversation with the first sentence (product design §3.2.2, §5.1): when the first user message carries editor state (sent from Space's floating conversation, or from the start page while a video is open),
 * this video gets a video card after that message, and “Open editor” returns to it. Only the first message counts: later messages carrying editor state do not move the card; the card keeps following the agent's references.
 */
export function openingVideo(items: readonly TimelineItem[]): { videoId: Id; itemId: Id } | null {
  const first = items.find((i): i is Item<'user-message'> => i.kind === 'user-message');
  return first?.context ? { videoId: first.context.videoId, itemId: first.id } : null;
}

/** When an activity ends: not yet ended (queued, running, or rerunning after a crash) is Infinity; ended without a recorded time is -Infinity (it does not carry over to later turns). */
function endOf(job: JobRecord | undefined): number {
  if (!job) return -Infinity;
  if (jobLive(job)) return Infinity;
  const t = job.endedAt ? Date.parse(job.endedAt) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * Thread block id → the cards (video cards and download cards) attached after it. Under the same block, they are ordered by first reference.
 * `blocks` is the output of `buildThread(items)`; `jobs` is the Job mirror (including pipeline steps).
 */
export function threadCards(input: {
  blocks: readonly ThreadBlock[];
  items: readonly TimelineItem[];
  jobs: readonly JobRecord[];
  conversationId: Id;
  entries: readonly SpaceEntry[];
}): Map<Id, ThreadCard[]> {
  const { blocks, items, jobs, conversationId, entries } = input;

  // Turns: each user message starts a turn; block → turn, task → turn (the turn where the task first appears).
  // Each turn records its start time (the user message's createdAt; the stretch before the first user message counts as long ago) and its last content block.
  const blockTurn: number[] = [];
  const taskTurn = new Map<Id, number>();
  const turnStart: number[] = [];
  const turnLast: number[] = [];
  let turn = -1;
  blocks.forEach((block, i) => {
    if (block.type === 'user' || turn < 0) {
      turn++;
      const at = block.type === 'user' ? Date.parse(block.item.createdAt) : NaN;
      turnStart[turn] = Number.isFinite(at) ? at : -Infinity;
    }
    blockTurn[i] = turn;
    if (block.type === 'task') return;
    turnLast[turn] = i;
    for (const id of blockTaskIds(block)) if (!taskTurn.has(id)) taskTurn.set(id, turn);
  });

  // Entry → the block it belongs to. Entries without a block of their own (records of newly created videos, empty replies) fall into the nearest preceding block.
  const itemBlock = new Map<Id, number>();
  blocks.forEach((block, i) => {
    if (block.type === 'task') return;
    if (block.type === 'steps') block.items.forEach((it) => itemBlock.set(it.id, i));
    else itemBlock.set(block.item.id, i);
  });
  const anchorOf = new Map<Id, number>();
  let lastBlock = -1;
  for (const item of items) {
    const own = itemBlock.get(item.id);
    if (own !== undefined) lastBlock = own;
    if (lastBlock >= 0) anchorOf.set(item.id, own ?? lastBlock);
  }

  /** The block an agent task's Job attaches to: the last group of steps of this task in this turn; if there are no steps, the last content block of this turn. */
  const jobAnchor = (taskId: Id): number | null => {
    const t = taskTurn.get(taskId);
    if (t === undefined) return null;
    let steps = -1;
    let content = -1;
    blocks.forEach((block, i) => {
      if (blockTurn[i] !== t || block.type === 'task') return;
      content = i;
      if (block.type === 'steps' && block.items.some((it) => it.taskId === taskId)) steps = i;
    });
    return steps >= 0 ? steps : content >= 0 ? content : null;
  };

  interface Ref {
    first: number;
    last: number;
    seq: number;
    card: ThreadCard;
    /** Video card: the turn in which each activity on the card was referenced. */
    jobTurns: Map<Id, number>;
  }
  const refs = new Map<string, Ref>();
  let seq = 0;
  const refer = (videoId: Id, at: number, jobId?: Id) => {
    const key = `video:${videoId}`;
    let ref = refs.get(key);
    if (!ref) {
      const jobIds = conversationVideoJobs(videoId, jobs, conversationId);
      const card: ThreadCard = { kind: 'video', key, video: videoOutput(videoId, items, entries, jobs), jobIds };
      ref = { first: at, last: at, seq: seq++, card, jobTurns: new Map() };
      refs.set(key, ref);
    }
    ref.first = Math.min(ref.first, at);
    ref.last = Math.max(ref.last, at);
    if (jobId && !ref.jobTurns.has(jobId)) ref.jobTurns.set(jobId, blockTurn[at]!);
  };

  const opening = openingVideo(items);
  const openingAt = opening ? anchorOf.get(opening.itemId) : undefined;
  if (opening && openingAt !== undefined) refer(opening.videoId, openingAt);

  for (const item of items) {
    if (item.kind !== 'video-change' && item.kind !== 'video-created') continue;
    const at = anchorOf.get(item.id);
    if (at !== undefined) refer(item.videoId, at);
  }

  const byId = new Map(jobs.map((j) => [j.jobId, j]));
  const ordered = [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.jobId.localeCompare(b.jobId));
  for (const job of ordered) {
    if (job.parentJobId) continue;
    const owner = agentOwner(job, byId, conversationId);
    const taskId = owner ? agentTaskId(owner) : null;
    if (!owner || !taskId) continue;
    const at = jobAnchor(taskId);
    if (at === null) continue;
    if (job.videoId && isRowJob(job)) refer(job.videoId, at, job.jobId);
    else if (!job.videoId && isLinkImport(job) && owner === job) {
      const key = `download:${job.jobId}`;
      refs.set(key, { first: at, last: at, seq: seq++, card: { kind: 'download', key, jobId: job.jobId }, jobTurns: new Map() });
    }
  }

  /**
   * The block a video card attaches to (rules in the file header): (b) for each activity, the last turn that started after the turn where it was referenced and before it ended; take the latest such turn.
   * If that is not earlier than the turn containing the last reference, attach after the last block of that turn; otherwise attach after the last reference.
   */
  const anchor = (ref: Ref): number => {
    let to = -1;
    for (const [jobId, from] of ref.jobTurns) {
      const end = endOf(byId.get(jobId));
      for (let u = turn; u > from; u--) {
        if (turnStart[u]! < end) {
          to = Math.max(to, u);
          break;
        }
      }
    }
    return to >= 0 && to >= blockTurn[ref.last]! && turnLast[to] !== undefined ? Math.max(turnLast[to]!, ref.last) : ref.last;
  };

  const out = new Map<Id, ThreadCard[]>();
  [...refs.values()]
    .sort((a, b) => a.first - b.first || a.seq - b.seq)
    .forEach((ref) => {
      const id = blocks[ref.card.kind === 'video' ? anchor(ref) : ref.last]!.id;
      const list = out.get(id);
      if (list) list.push(ref.card);
      else out.set(id, [ref.card]);
    });
  return out;
}

/** All activities on this video in this conversation, in submission order. This is the same list as the video card in the thread and the one in the “Artifacts” popover. */
export function conversationVideoJobs(videoId: Id, jobs: readonly JobRecord[], conversationId: Id): Id[] {
  const byId = new Map(jobs.map((j) => [j.jobId, j]));
  return jobs
    .filter((j) => !j.parentJobId && j.videoId === videoId && isRowJob(j) && agentOwner(j, byId, conversationId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.jobId.localeCompare(b.jobId))
    .map((j) => j.jobId);
}

/** The videos this conversation's agent has given activities to (created by a pipeline, transcription, export, …). Fills in videos without a `video-change` in the “Artifacts” popover. */
export function conversationJobVideos(jobs: readonly JobRecord[], conversationId: Id): Id[] {
  const byId = new Map(jobs.map((j) => [j.jobId, j]));
  const ids: Id[] = [];
  for (const j of jobs) {
    if (j.parentJobId || !j.videoId || !isRowJob(j) || ids.includes(j.videoId)) continue;
    if (agentOwner(j, byId, conversationId)) ids.push(j.videoId);
  }
  return ids;
}

// ---- Status words ----

export type VideoStatusKey = 'transcribing' | 'queued' | 'translating' | 'transcribed' | 'failed';

export interface VideoStatus {
  key: VideoStatusKey;
  /** “transcribing · 45%”, “queued”, “translating · 30%”, “transcribed”, “failed”. */
  text: string;
}

/**
 * The status word in the video card header (prototype `badge`): when this video's transcription is running or queued, that takes precedence. When no transcription is running but a translation is (the translation pipeline, whichever way it was started, or the agent translating itself), it is “translating”; with only one such job, which is the translation pipeline and has steps, the percentage is included. Otherwise, if a transcription result exists (a completed transcription wrote a transcript, or the editor has the video open and its document has `speech`), it is “transcribed”. If a transcription has failed, it is “failed”. When nothing is known, null (nothing is shown).
 * Do not infer “not transcribed” from the absence of a record: the Job mirror holds only the tasks this Runtime remembers, and the video's document cannot be read when the video is not open.
 */
export function videoStatus(videoId: Id, jobs: readonly JobRecord[], transcribedInEditor: boolean): VideoStatus | null {
  const mine = jobs.filter((j) => j.kind === 'transcribe' && j.videoId === videoId);
  const running = mine.find((j) => j.state === 'running' || jobRetrying(j));
  if (running) {
    const pct = running.state === 'running' ? jobPercent(running) : null;
    return {
      key: 'transcribing',
      text: pct == null ? VIDEO_CARD_COPY.status.transcribing : `${VIDEO_CARD_COPY.status.transcribing} · ${pct}%`,
    };
  }
  if (mine.some((j) => j.state === 'queued')) return { key: 'queued', text: VIDEO_CARD_COPY.status.queued };
  const translating = jobs.filter((j) => isTranslateJob(j, videoId) && (j.state === 'running' || jobRetrying(j)));
  if (translating.length) {
    const one = translating.length === 1 ? translating[0]! : null;
    const pct = one && one.state === 'running' && !isAgentTranslate(one) && one.pipeline?.steps.length ? translateProgress(one, jobs).percent : null;
    return { key: 'translating', text: pct == null ? VIDEO_CARD_COPY.status.translating : `${VIDEO_CARD_COPY.status.translating} · ${pct}%` };
  }
  if (transcribedInEditor || mine.some((j) => j.state === 'completed' && j.result?.documentId)) {
    return { key: 'transcribed', text: VIDEO_CARD_COPY.status.transcribed };
  }
  if (mine.some((j) => j.state === 'failed')) return { key: 'failed', text: VIDEO_CARD_COPY.status.failed };
  return null;
}

// ---- One activity per row ----

export type RowState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';

export interface JobRowView {
  jobId: Id;
  kind: 'transcribe' | 'translate' | 'export' | 'link-import' | 'other';
  name: string;
  state: RowState;
  /** Right side of the header: while running, the percentage (null when there is no total); otherwise a single status word. */
  tail: string | null;
  /** Progress bar: 0–100. While running with no total, null (a thin indeterminate bar). Not drawn when not running. */
  pct: number | null;
  /** While running: “recognizing · recognized 1:02 / 3:26”. While queued, it says what the activity is waiting for. */
  line: string | null;
  /** The model and parameters used for transcription and re-transcription (a read-only line, assembled by `asrLine`). null for other activities or when the model is unknown. */
  asr: AsrFacts | null;
  /** Elapsed time (only while running). */
  elapsed: string | null;
  facts: string[];
  warnings: string[];
  /** The file after export completes. */
  files: ExportOutputFact[];
  /** Exported files that can be played (the final cut and audio; portable packages do not go into the asset library). */
  playable: Record<string, string>;
  error: string | null;
  canCancel: boolean;
  /** `retry` from `jobs.reconcile` applies (interrupted, result unknown). */
  canRetry: boolean;
  remedy: Remedy | null;
}

function rowState(job: JobRecord): RowState {
  if (job.state === 'queued') return 'queued';
  if (job.state === 'running' || jobRetrying(job)) return 'running';
  if (job.state === 'completed') return 'done';
  if (job.state === 'failed') return 'failed';
  if (job.state === 'cancelled') return 'cancelled';
  return 'interrupted';
}

function rowKind(job: JobRecord): JobRowView['kind'] {
  if (job.kind === 'transcribe') return 'transcribe';
  if (job.kind === 'export') return 'export';
  if (isLinkImport(job)) return 'link-import';
  if (isAgentTranslate(job)) return 'translate';
  if (job.kind === 'pipeline' && job.pipeline?.name === TRANSLATE_PIPELINE) return 'translate';
  if (job.kind === 'pipeline' && job.pipeline?.name === 'transcribe') return 'transcribe';
  return 'other';
}

/** The same video already had a completed transcription before: this one is called “re-transcription”. */
function isRetranscribe(job: JobRecord, jobs: readonly JobRecord[]): boolean {
  return jobs.some(
    (j) =>
      j.jobId !== job.jobId &&
      j.kind === 'transcribe' &&
      j.videoId === job.videoId &&
      j.state === 'completed' &&
      j.createdAt < job.createdAt,
  );
}

function rowName(job: JobRecord, kind: JobRowView['kind'], jobs: readonly JobRecord[]): string {
  switch (kind) {
    case 'transcribe':
      return job.kind === 'transcribe' && isRetranscribe(job, jobs) ? VIDEO_CARD_COPY.retranscribe : kindLabel('transcribe');
    case 'export':
      return job.export ? exportTitle(job.export.settings) : kindLabel('export');
    case 'translate': {
      const lang = targetOf(job);
      return lang ? `${VIDEO_CARD_COPY.translate} · ${lang}` : VIDEO_CARD_COPY.translate;
    }
    case 'link-import':
      return VIDEO_CARD_COPY.linkImport;
    default:
      return kindLabel(job.kind);
  }
}

/** Transcription progress counts: by seconds, “recognized 1:02 / 3:26”; by segments, “recognized 12 / 40 segments”. */
function transcribeCount(job: JobRecord): string | null {
  const p = job.progress;
  if (!p) return null;
  if (p.unit === 'seconds') return VIDEO_CARD_COPY.recognized(formatClock(p.done), p.total != null ? formatClock(p.total) : null);
  if (p.unit === 'segments') return VIDEO_CARD_COPY.segments(p.done, p.total);
  return null;
}

/** The running row: stage, counts and percentage. */
function progressOf(job: JobRecord, kind: JobRowView['kind'], jobs: readonly JobRecord[]): { line: string | null; pct: number | null } {
  if (jobRetrying(job)) return { line: VIDEO_CARD_COPY.retrying, pct: null };
  const phase = JOB_PHASE_LABEL[job.phase];
  switch (kind) {
    case 'export':
      return { line: [exportPhaseLabel(job), exportProgressLine(job)].filter(Boolean).join(' · '), pct: jobPercent(job) };
    case 'translate': {
      const p = translateProgress(job, jobs);
      // The agent's own translation has no per-sentence progress: only the total sentence count is written, and the progress bar is indeterminate (prototype `phaseLabel` / `countLabel`'s `byAgent`).
      if (p.agent) {
        const total = p.agent.sentences ? VIDEO_CARD_COPY.sentenceTotal(p.agent.sentences) : null;
        return { line: [VIDEO_CARD_COPY.agentTranslating, total].filter(Boolean).join(' · '), pct: null };
      }
      const count = p.units ? VIDEO_CARD_COPY.translated(p.units.done, p.units.total) : null;
      return { line: [p.step ?? phase, count].filter(Boolean).join(' · '), pct: p.percent };
    }
    case 'link-import': {
      const d = downloadProgress(job, jobs);
      return { line: [linkPhaseText(job), d ? downloaded(d) : null].filter(Boolean).join(' · '), pct: d?.pct ?? null };
    }
    case 'transcribe':
      return { line: [phase, transcribeCount(job)].filter(Boolean).join(' · '), pct: jobPercent(job) };
    default:
      return { line: phase, pct: jobPercent(job) };
  }
}

/** “downloaded 30 MB / 92 MB”. When `downloadProgress` has a total, only the two numbers are given (`pct` is not null). With no total, `text` is already the full sentence. */
const downloaded = (d: { pct: number | null; text: string }) => (d.pct === null ? d.text : VIDEO_CARD_COPY.downloaded(d.text));

const warningText = (w: JobRecord['warnings'][number]) => VIDEO_CARD_COPY.warning[w.code] ?? localizeText(w.detail, w.detailRef) ?? w.code;

/** One activity per row (prototype `jobRow`): while running, the stage and progress; after completion, the result facts and the file; on failure, the reason and where to go; on cancel, it says cancelled. `now` is used to compute elapsed time. */
export function jobRowView(job: JobRecord, jobs: readonly JobRecord[], now: number): JobRowView {
  const state = rowState(job);
  const kind = rowKind(job);
  const running = state === 'running';
  const progress = running ? progressOf(job, kind, jobs) : null;
  const done = state === 'done';
  const files = done && kind === 'export' ? exportOutputs(job) : [];
  const playable: Record<string, string> = {};
  if (done && kind === 'export') {
    // The final cut and audio can be played (subtitles and portable packages are only shown in the folder). The extension is checked again with isPlayable: the browser cannot play AVI.
    for (const [i, o] of (job.result?.outputs ?? []).entries()) {
      if ((o.media.kind === 'video' || o.media.kind === 'audio') && (!o.path || isPlayable(files[i]!.name)))
        playable[files[i]!.key] = o.artifactId;
    }
  }
  const facts: string[] = [];
  if (done && kind === 'transcribe' && job.result?.documentId) facts.push(VIDEO_CARD_COPY.documentWritten);
  if (done && kind === 'translate') {
    const lang = targetOf(job);
    if (lang) facts.push(lang);
  }
  const warnings = done ? (kind === 'export' ? exportWarnings(job) : [...new Set(job.warnings.map(warningText))]) : [];
  const failed = state === 'failed' || state === 'interrupted';
  const error = failed
    ? kind === 'link-import'
      ? (linkIssue(job.error, job.state)?.title ?? jobErrorText(job.error) ?? VIDEO_CARD_COPY.notFinished)
      : (jobErrorText(job.error) ?? VIDEO_CARD_COPY.notFinished)
    : null;
  const tail =
    state === 'running'
      ? progress?.pct != null
        ? `${progress.pct}%`
        : null
      : state === 'queued'
        ? VIDEO_CARD_COPY.tail.queued
        : state === 'done'
          ? VIDEO_CARD_COPY.tail.done
          : state === 'failed'
            ? VIDEO_CARD_COPY.tail.failed
            : state === 'cancelled'
              ? VIDEO_CARD_COPY.tail.cancelled
              : job.state === 'needs-reconciliation'
                ? VIDEO_CARD_COPY.tail.unknown
                : VIDEO_CARD_COPY.tail.interrupted;
  const started = job.startedAt ? Date.parse(job.startedAt) : NaN;
  return {
    jobId: job.jobId,
    kind,
    name: rowName(job, kind, jobs),
    state,
    tail,
    pct: progress?.pct ?? null,
    line: running ? progress!.line || null : state === 'queued' ? jobWaitText(job.wait) : null,
    asr: asrFacts(job, jobs),
    elapsed: running && Number.isFinite(started) ? VIDEO_CARD_COPY.elapsed(formatClock(Math.max(0, now - started) / 1000)) : null,
    facts,
    warnings,
    files,
    playable,
    error,
    // The agent's own translation cannot be cancelled: that turn is still writing the translation, and cancelling the record cannot stop the agent. To stop it, stop that conversation.
    canCancel: jobLive(job) && !jobRetrying(job) && !(kind === 'export' && cancelPending(job)) && !isAgentTranslate(job),
    canRetry: reconcileOptions(job).includes('retry'),
    remedy: failed ? jobRemedy(job) : null,
  };
}

// ---- Models and parameters for transcription ----

/**
 * What the transcription row uses (product design §3.2.2 video card; prototype `asrLine`). `language`: the language tag; null means auto-detect;
 * undefined means unknown (not recorded; this segment is not shown). `diarize` is the effective speaker diarization (a model that cannot distinguish speakers and reported a warning does not count).
 */
export interface AsrFacts {
  providerId: string;
  modelId: string;
  language: string | null | undefined;
  diarize: boolean;
}

/** Transcription Jobs that a pipeline (transcription, import from link) submitted with its own jobId as the submitter; later submissions come later. */
function pipelineTranscribes(parent: JobRecord, jobs: readonly JobRecord[]): JobRecord[] {
  return jobs
    .filter((j) => j.kind === 'transcribe' && j.submitter.kind === 'pipeline' && j.submitter.id === parent.jobId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.jobId.localeCompare(b.jobId));
}

/**
 * Model and parameters for the transcription row. Provider and model come from the transcription Job (for the parent task of a transcription pipeline, the submission it made; if it has not submitted yet, the choice frozen by the parent task).
 * Language and speaker diarization come from the transcription Job's `transcribe`. For earlier records that lack these, fall back to the parameters frozen by the pipeline (a missing `language` means auto-detect,
 * and a missing `diarize` is not written). null when it is not a transcription or there is no model.
 */
export function asrFacts(job: JobRecord, jobs: readonly JobRecord[]): AsrFacts | null {
  if (rowKind(job) !== 'transcribe') return null;
  const parentId = job.kind === 'pipeline' ? job.jobId : job.submitter.kind === 'pipeline' ? job.submitter.id : null;
  const parent = parentId === job.jobId ? job : parentId ? jobs.find((j) => j.jobId === parentId) : undefined;
  const source = job.kind === 'transcribe' ? job : (pipelineTranscribes(job, jobs).at(-1) ?? job);
  if (!source.modelId) return null;
  const params = parent?.pipeline?.params;
  const asked = source.transcribe;
  const unavailable = source.warnings.some((w) => w.code === 'diarization-unavailable');
  return {
    providerId: source.providerId,
    modelId: source.modelId,
    language: asked ? asked.language.tag : params ? (typeof params.language === 'string' ? params.language : null) : undefined,
    diarize: (asked ? asked.diarize : params?.diarize === true) && !unavailable,
  };
}

/**
 * The model's display name (same source as the model menu on the transcription tool page). Local and node models use the model pack's name; online models show “API provider · model”.
 * When the capability view does not have it, the model ID is written as is.
 */
export function asrModelName(
  view: ModelCapabilitiesView | null,
  bundles: readonly Pick<ModelBundleStatus, 'bundleId' | 'label'>[],
  providerId: string,
  modelId: string,
): string {
  const provider = view?.transcribe.providers.find((p) => p.providerId === providerId);
  const model = provider?.models.find((m) => m.modelId === modelId);
  if (providerId === 'local' || providerId.startsWith('node:')) {
    const bundle = bundles.find((b) => b.bundleId === modelId);
    return bundle ? bundleName(bundle) : model?.label || modelId;
  }
  const name = model?.label || modelId;
  return provider && provider.kind === 'online' ? `${provider.label} · ${name}` : name;
}

/**
 * The text of the transcription row: “model · local or cloud · language · speaker diarization” (product design §3.2.2). `words` are the transcription tool page's “Auto-detect” and “Identify speakers”, passed in by the UI layer (the same wording as that page).
 */
export function asrLine(facts: AsrFacts, modelName: string, words: { auto: string; speakers: string }): string {
  const language = facts.language === undefined ? null : facts.language === null ? words.auto : langName(facts.language);
  return [modelName, runsOnLabel(facts.providerId), language, facts.diarize ? words.speakers : null].filter(Boolean).join(' · ');
}

// ---- Expand and collapse ----

/** Folding considers only these: status, remedies, and whether it can be retried. */
type FoldRow = Pick<JobRowView, 'state' | 'remedy' | 'canRetry'>;

/**
 * Whether this row needs someone to act (prototype `needsAction`): it is not complete (failed, or interrupted with an unknown result), and there is somewhere to go (a remedy from `jobRemedy`,
 * or a retry from `jobs.reconcile`). Failures with nowhere to go, and cancelled rows, do not count.
 */
export function needsAction(row: FoldRow): boolean {
  return (row.state === 'failed' || row.state === 'interrupted') && (row.remedy !== null || row.canRetry);
}

/**
 * Which rows are expanded and which are collapsed on the video card (product design §3.2.2; prototype `foldRows`). `rows` follow the order of `cardRows` (submission order).
 * - If activities are running or queued: expand all in-progress ones, in their original order. In this case, ended ones stay collapsed.
 * - If all have ended: expand only the last one. “Last” is by submission order (the spec says “by submission order”, not by end time).
 * - The rest go into `earlier`, **newest first**. `pending` is the count of those still needing action (`needsAction`); expanded rows are not counted.
 */
export function foldRows<R extends FoldRow>(rows: readonly R[]): { shown: R[]; earlier: R[]; pending: number } {
  const live = rows.filter((r) => r.state === 'running' || r.state === 'queued');
  const shown = live.length ? live : rows.slice(-1);
  const earlier = rows.filter((r) => !shown.includes(r)).reverse();
  return { shown, earlier, pending: earlier.filter(needsAction).length };
}

/**
 * The rows listed on the card (in submission order). For a parent task that imports from a link into this video: while downloading and importing, it is one row. Once the transcription submitted by the pipeline appears,
 * its progress is read from the transcription row, and the parent task no longer takes its own row. After completion it is no longer listed (prototype: after the download finishes, only the transcription remains on the card). It stays on failure or cancellation, with the reason.
 * The same applies to a transcription pipeline's parent task: once the transcription Job it submitted appears, its progress is read from that row (one row per transcription). Only when transcription is done but the pipeline is still on later steps
 * (building the subtitle track), or fails or is cancelled after that, does the parent task's row stay.
 */
export function cardRows(jobIds: readonly Id[], jobs: readonly JobRecord[]): JobRecord[] {
  const byId = new Map(jobs.map((j) => [j.jobId, j]));
  return jobIds
    .map((id) => byId.get(id))
    .filter((j): j is JobRecord => !!j)
    .filter((j) => !isPreviewExport(j))
    .filter((j) => {
      if (j.kind === 'pipeline' && j.pipeline?.name === 'transcribe') {
        const child = pipelineTranscribes(j, jobs).at(-1);
        return !child || (child.state === 'completed' && j.state !== 'completed');
      }
      if (!isLinkImport(j)) return true;
      if (j.state === 'completed') return false;
      return !jobs.some((t) => t.kind === 'transcribe' && t.submitter.kind === 'pipeline' && t.submitter.id === j.jobId);
    });
}

// ---- Download card ----

export interface DownloadCardView {
  jobId: Id;
  state: RowState;
  title: string;
  /** Video title; the site name until it has been parsed. */
  name: string;
  /** The redacted link. */
  source: string | null;
  pct: number | null;
  line: string | null;
  elapsed: string | null;
  error: string | null;
  hint: string | null;
  /** Files saved by a download-only job that creates no video (media and subtitles); they can be shown in the folder. */
  files: { name: string; path: string }[];
  canCancel: boolean;
  canRetry: boolean;
}

const basename = (file: string) => file.split(/[\\/]/).pop() || file;

/** Download card (prototype `download`): source, amount downloaded, elapsed time, cancel. On failure, the reason and an explanation; on completion, the saved files. */
export function downloadCardView(job: JobRecord, jobs: readonly JobRecord[], now: number): DownloadCardView {
  const state = rowState(job);
  const running = state === 'running';
  const frozen = linkFrozen(job);
  const meta = linkMeta(job);
  const d = running ? downloadProgress(job, jobs) : null;
  const issue = state === 'failed' || state === 'interrupted' ? linkIssue(job.error, job.state) : null;
  const summary = state === 'done' ? linkSummary(job) : null;
  const started = job.startedAt ? Date.parse(job.startedAt) : NaN;
  const T = VIDEO_CARD_COPY.download;
  return {
    jobId: job.jobId,
    state,
    title: { queued: T.queued, running: T.running, done: T.done, failed: T.failed, cancelled: T.cancelled, interrupted: T.interrupted }[
      state
    ],
    name: meta.title ?? (frozen.host || T.fallbackName),
    source: frozen.url || null,
    pct: d?.pct ?? null,
    line: running ? [linkPhaseText(job), d ? downloaded(d) : null].filter(Boolean).join(' · ') : null,
    elapsed: running && Number.isFinite(started) ? VIDEO_CARD_COPY.elapsed(formatClock(Math.max(0, now - started) / 1000)) : null,
    error: issue ? issue.title : state === 'failed' ? (jobErrorText(job.error) ?? T.failed) : null,
    hint: issue ? issue.body : null,
    files: summary ? [summary.files.media, ...summary.files.subtitles].map((path) => ({ name: basename(path), path })) : [],
    canCancel: jobLive(job) && !jobRetrying(job),
    canRetry: reconcileOptions(job).includes('retry'),
  };
}
