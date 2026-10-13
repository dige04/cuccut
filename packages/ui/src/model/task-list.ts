import { localizeText, type Conversation, type Id, type JobKind, type JobRecord, type Project, type TaskSummary } from '@cuccut/protocol';
import { JOB_PHASE_LABEL, TASK_KIND_LABEL, TASK_STATUS_LABEL, TASK_VIEW_COPY, VIDEO_CARD_COPY } from '../copy.ts';
import { exportPhaseLabel, exportTitle } from './export-job.ts';
import { shortenPath } from './format.ts';
import { isLinkImport, linkKindLabel, linkPhaseText, linkTitle } from './link-import.ts';
import { jobErrorText, jobWaitText } from './localized-text.ts';
import { langName } from './tools-models.ts';

/**
 * Unified table of background tasks (prototype page-tasks.jsx, product design §2.1 user revision): tasks in agent sessions (TaskSummary) and
 * model computations (JobRecord) are combined into one table, which the tasks page, sidebar and task pill all read from. A pure function: the time and directory are passed in as parameters.
 */

/**
 * Kind of task: an agent task, or a Job kind. An export is also a Job (`kind: 'export'`, architecture design §9.11): its title, location and stage come from its
 * `export` information; the task pill does not list this video's exports (the export button in the top bar already shows their progress).
 * `legacyImport` is the round that imports an old project at startup (`legacy-import` topic, model/legacy-import-run.ts), not a Job.
 */
export type TaskKind = 'agent' | JobKind | 'legacyImport';

/** Prototype tone: the chip and kind-icon background colors are taken from it (page-tasks.jsx `TaskCard`). */
export type TaskTone = 'accent' | 'info' | 'notice' | 'neutral' | 'positive' | 'negative';

export type TaskAction = { type: 'stop'; taskId: Id } | { type: 'cancel'; jobId: Id };

export interface TaskRow {
  id: Id;
  /** Source: an agent task, a Job, or the round that imported the old project at this startup. */
  origin: 'task' | 'job' | 'legacy-import';
  kind: TaskKind;
  /** The kind as shown: usually `kindLabel(kind)`; a generic `pipeline` kind from a link import is shown as “从链接导入” (“Import from link”). */
  kindText: string;
  title: string;
  /** The “where” in the subtitle: for an agent task it is project › session; for a Job it is model · where it runs. */
  where: string;
  /** Start time; a Job still queued uses its submission time. */
  startedAt: string;
  endedAt: string | null;
  /** In-progress group: agent tasks that are running or stopping, and Jobs that are queued or running. */
  live: boolean;
  queued: boolean;
  /** Agent task waiting for user approval. */
  waiting: boolean;
  /** Text of the status chip. */
  label: string;
  tone: TaskTone;
  /** Stage of a running Job; for a queued Job, what the Runtime has recorded it is waiting for (null when there is none). */
  phase: string | null;
  /** 0–100; null means progress is not determinate. */
  pct: number | null;
  /** Progress bar on the card: a number is determinate progress, `indet` spins, and null draws nothing. */
  progress: number | 'indet' | null;
  /** Source chip: work submitted by an agent through a tool shows “Agent”; other connections show “命令行” (“Command line”). */
  chip: 'agent' | 'cli' | null;
  action: TaskAction | null;
  conversationId: Id | null;
  projectId: Id | null;
  videoId: Id | null;
  error: string | null;
}

/** The video open in the editor: a transcription's title shows its name and asset name, and the pill's “这个视频” (“This video”) is judged by it too. */
export interface OpenVideoFacts {
  videoId: Id;
  name: string;
  projectId: Id | null;
  assets: Readonly<Record<Id, { name: string }>>;
}

export interface TaskContext {
  projects: readonly Pick<Project, 'id' | 'name'>[];
  conversations: readonly Pick<Conversation, 'id' | 'projectId' | 'activity'>[];
  video?: OpenVideoFacts | null;
}

export interface TaskGroup {
  id: 'active' | 'history';
  label: string;
  items: TaskRow[];
}

/** Truncates to n characters (by code point), appending “…” when it overflows (prototype model-task-facts.js `clip`). */
export function clip(text: string, n: number): string {
  const chars = Array.from(text.trim());
  return chars.length > n ? `${chars.slice(0, n).join('')}…` : chars.join('');
}

/** Integer 0–100; null when the total is unknown or 0 (no percentage is made up). Rounded down: an unfinished task never shows 100%. */
export function jobPercent(job: Pick<JobRecord, 'progress'>): number | null {
  const p = job.progress;
  if (!p || p.total == null || !(p.total > 0)) return null;
  return Math.max(0, Math.min(100, Math.floor((p.done / p.total) * 100)));
}

const AGENT_PROVIDER_NAME: Record<string, string> = { codex: 'Codex', claude: 'Claude' };

/** Where a Job runs: this machine, a remote node, or the cloud; an agent Provider runs on this machine (prototype data.js `runsOn: '本机 · Codex'`). */
export function runsOnLabel(providerId: string): string {
  if (providerId === 'local') return TASK_VIEW_COPY.local;
  if (providerId.startsWith('node:')) return TASK_VIEW_COPY.node;
  if (providerId.startsWith('agent:')) {
    const id = providerId.slice('agent:'.length);
    return `${TASK_VIEW_COPY.local} · ${AGENT_PROVIDER_NAME[id] ?? id}`;
  }
  return TASK_VIEW_COPY.cloud;
}

export function kindLabel(kind: TaskKind): string {
  return TASK_KIND_LABEL[kind];
}

/** Session ID: the agent task's own, or that of a Job an agent submitted through a tool. */
function jobConversation(job: JobRecord): Id | null {
  return job.submitter.kind === 'agent' ? job.submitter.id : null;
}

/** Name of the transcription pipeline (the Runtime's `TRANSCRIBE_PIPELINE`). */
const TRANSCRIBE_PIPELINE = 'transcribe';

/**
 * Parent task of the transcription pipeline (`transcribe` from `pipelines.start`: the editor's generate-subtitles and re-transcribe, and transcription from agents and the command line). It hands recognition to a
 * `transcribe` Job, and in the task table it shows “转录” (“Transcription”) just as that transcription does, not the generic “流程” (“Pipeline”).
 */
function isTranscribePipeline(job: Pick<JobRecord, 'kind' | 'pipeline'>): boolean {
  return job.kind === 'pipeline' && job.pipeline?.name === TRANSCRIBE_PIPELINE;
}

/** The asset being transcribed: a transcription Job records it on itself; the parent task of a transcription pipeline records it in its frozen parameters (when a source is given) or in its destination (replacing the transcript, or creating a new video). */
function transcribeAsset(job: JobRecord): Id | null {
  if (job.assetId) return job.assetId;
  const params = isTranscribePipeline(job) ? job.pipeline!.params : null;
  if (!params) return null;
  const landing = params.landing && typeof params.landing === 'object' ? (params.landing as { assetId?: unknown }) : null;
  const assetId = params.assetId ?? landing?.assetId;
  return typeof assetId === 'string' && assetId ? assetId : null;
}

function jobTitle(job: JobRecord, video: OpenVideoFacts | null): string {
  const g = job.generation;
  if (g?.capability === 'generateImage' && g.prompt.trim()) return clip(g.prompt, 40);
  if (g?.capability === 'synthesizeSpeech' && g.text.trim()) return clip(g.text, 40);
  if (job.kind === 'transcribe' || isTranscribePipeline(job)) {
    if (!video) return kindLabel('transcribe');
    const assetId = transcribeAsset(job);
    const asset = assetId ? video.assets[assetId]?.name : undefined;
    return [kindLabel('transcribe'), video.name, asset].filter(Boolean).join(' · ');
  }
  // Import from link: “从链接导入 · 标题” (“Import from link · title”); while the title has not yet been resolved, the site name is written.
  if (isLinkImport(job)) return linkTitle(job);
  // Agent translating on its own: “翻译 · 访谈 · 英语” (“Translate · Interview · English”); the video name is only known while it is open.
  if (job.kind === 'agentTranslate') {
    return [kindLabel(job.kind), video?.name, job.translation ? langName(job.translation.targetLanguage) : null].filter(Boolean).join(' · ');
  }
  // Export: “导出视频 · MP4 · 访谈” (“Export video · MP4 · Interview”); the kind and format come from the frozen settings; the video name is only known while it is open.
  if (job.kind === 'export' && job.export) return [exportTitle(job.export.settings), video?.name].filter(Boolean).join(' · ');
  return kindLabel(job.kind);
}

/**
 * For these kinds of Job, `providerId` is not a model provider but the name of a tool or source (yt-dlp, google-fonts), and `modelId` is the tool version or font family;
 * they all run on this machine, and must not fall under “云端” (“Cloud”) through `runsOnLabel`.
 */
function localToolWhere(job: JobRecord): string | null {
  if (isLinkImport(job) || job.kind === 'toolInstall' || job.kind === 'toolUpdate') {
    return [[job.providerId, job.modelId].filter(Boolean).join(' '), TASK_VIEW_COPY.local].join(' · ');
  }
  if (job.kind === 'fontDownload') return [job.modelId, TASK_VIEW_COPY.local].filter(Boolean).join(' · ');
  return null;
}

/** // Where: for an export, the directory it is written to (this machine); for other Jobs, model · where it runs. */
function jobWhere(job: JobRecord): string {
  // Agent translating on its own: `modelId` is the Driver, and “本机 · Codex” (“This machine · Codex”) already says it all.
  if (job.kind === 'agentTranslate') return runsOnLabel(job.providerId);
  if (job.kind === 'export' && job.export) return [shortenPath(job.export.destination.dir), runsOnLabel(job.providerId)].join(' · ');
  return localToolWhere(job) ?? [job.modelId, runsOnLabel(job.providerId)].filter(Boolean).join(' · ');
}

/**
 * The automatic rerun after a Worker crash (the `crashed` branch of job-manager): the status is first derived as `interrupted`, but `endedAt` is not written,
 * and the same task then runs again right away. An interruption that has really ended always has `endedAt`.
 */
export function jobRetrying(job: Pick<JobRecord, 'state' | 'endedAt'>): boolean {
  return job.state === 'interrupted' && job.endedAt === null;
}

/** Not yet ended: queued, running, or automatically rerunning after a crash. */
export function jobLive(job: Pick<JobRecord, 'state' | 'endedAt'>): boolean {
  return job.state === 'queued' || job.state === 'running' || jobRetrying(job);
}

const JOB_ENDED: Record<Exclude<JobRecord['state'], 'queued' | 'running'>, { label: string; tone: TaskTone }> = {
  completed: { label: TASK_VIEW_COPY.completed, tone: 'positive' },
  failed: { label: TASK_VIEW_COPY.failed, tone: 'negative' },
  // Cancellation is not called a failure: a failure means the pipeline broke, while cancellation is stopped by the user (prototype page-tasks.jsx, round 120).
  cancelled: { label: TASK_VIEW_COPY.cancelled, tone: 'neutral' },
  // Interrupted: the Runtime stopped or restarted before it finished, and it is not resumed. The pipeline did not break, and the user did not stop it.
  interrupted: { label: TASK_VIEW_COPY.interrupted, tone: 'neutral' },
  // Outcome unknown: when the Runtime restarted, the outgoing call had not yet returned, so it may already have been billed; it is not re-sent automatically (§7.5) and waits for the user to decide.
  'needs-reconciliation': { label: TASK_VIEW_COPY.needsReconciliation, tone: 'notice' },
};

export function jobRow(job: JobRecord, ctx: TaskContext): TaskRow {
  const video = ctx.video && job.videoId === ctx.video.videoId ? ctx.video : null;
  const conversationId = jobConversation(job);
  const conversation = conversationId ? ctx.conversations.find((c) => c.id === conversationId) : undefined;
  const queued = job.state === 'queued';
  const retrying = jobRetrying(job);
  const running = job.state === 'running' || retrying;
  const pct = job.state === 'running' ? jobPercent(job) : null;
  // While queued, that row shows what the Runtime has recorded it is waiting for (a concurrency slot or machine resources, architecture design §7.6).
  const phase = retrying
    ? TASK_VIEW_COPY.retrying
    : running
      ? job.kind === 'export'
        ? exportPhaseLabel(job)
        : isLinkImport(job)
          ? linkPhaseText(job)
          : job.kind === 'agentTranslate'
            ? VIDEO_CARD_COPY.agentTranslating
            : JOB_PHASE_LABEL[job.phase]
      : queued
        ? jobWaitText(job.wait)
        : null;
  const status =
    job.state === 'queued'
      ? { label: TASK_VIEW_COPY.queued, tone: 'info' as const }
      : running
        ? { label: pct == null ? phase! : `${phase} · ${pct}%`, tone: 'accent' as const }
        : JOB_ENDED[job.state as keyof typeof JOB_ENDED];
  // The transcription pipeline shows “转录” and draws the transcription icon: it is the same kind as the row combined with it during its transcription (`taskRows`), so nothing jumps before or after.
  const kind: TaskKind = isTranscribePipeline(job) ? 'transcribe' : job.kind;
  return {
    id: job.jobId,
    origin: 'job',
    kind,
    kindText: isLinkImport(job) ? linkKindLabel() : kindLabel(kind),
    title: jobTitle(job, video),
    where: jobWhere(job),
    startedAt: job.startedAt ?? job.createdAt,
    endedAt: job.endedAt,
    live: queued || running,
    queued,
    waiting: false,
    label: status.label,
    tone: status.tone,
    phase,
    pct,
    progress: running ? (pct ?? 'indet') : queued ? 'indet' : null,
    chip: job.submitter.kind === 'agent' ? 'agent' : job.submitter.kind === 'connection' ? 'cli' : null,
    // An agent translating on its own has no cancel option: cancelling this record cannot stop the agent, so to stop it, stop that session (open the session, or stop the Agent task on its row).
    action: (queued || running) && job.kind !== 'agentTranslate' ? { type: 'cancel', jobId: job.jobId } : null,
    conversationId,
    projectId: conversation?.projectId ?? video?.projectId ?? null,
    videoId: job.videoId,
    error: jobErrorText(job.error) ?? null,
  };
}

export function agentRow(task: TaskSummary, ctx: TaskContext): TaskRow {
  const conversation = ctx.conversations.find((c) => c.id === task.conversationId);
  const project = task.projectId ? ctx.projects.find((p) => p.id === task.projectId) : undefined;
  const live = task.status === 'running' || task.status === 'stopping';
  // While waiting for user approval, the task itself is still in progress; the wait is recorded in the session's activity (product design §3.1).
  const waiting = task.status === 'running' && conversation?.activity === 'awaiting-approval';
  // The session title is often the first sentence (which is the task goal): when they are the same, only the project is written.
  const title = task.conversationTitle && task.conversationTitle !== task.goal ? task.conversationTitle : null;
  const where = [project?.name ?? (title ? null : TASK_VIEW_COPY.noProject), title].filter(Boolean).join(' › ');
  const tone: TaskTone = waiting
    ? 'notice'
    : task.status === 'failed'
      ? 'negative'
      : task.status === 'completed'
        ? 'positive'
        : task.status === 'stopped'
          ? 'neutral'
          : 'accent';
  return {
    id: task.taskId,
    origin: 'task',
    kind: 'agent',
    kindText: kindLabel('agent'),
    title: task.goal,
    where,
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    live,
    queued: false,
    waiting,
    label: waiting ? TASK_VIEW_COPY.awaitingApproval : TASK_STATUS_LABEL[task.status],
    tone,
    phase: null,
    pct: null,
    progress: live && !waiting ? 'indet' : null,
    chip: null,
    action: task.status === 'running' ? { type: 'stop', taskId: task.taskId } : null,
    conversationId: task.conversationId,
    projectId: task.projectId,
    videoId: null,
    error: localizeText(task.error, task.errorRef) ?? null,
  };
}

/**
 * The transcription that a running fixed pipeline is waiting for: both the import-from-link and the transcription pipeline submit the transcription using their own jobId as the submitter (`video-create.ts`
 * `transcribeInVideo`, and the “转写” (“Transcribe”) step of the transcription pipeline).
 */
function livePipelineTranscribe(parent: JobRecord, jobs: readonly JobRecord[]): JobRecord | null {
  return (
    jobs.find(
      (j) =>
        j.kind === 'transcribe' &&
        j.submitter.kind === 'pipeline' &&
        j.submitter.id === parent.jobId &&
        (j.state === 'queued' || j.state === 'running' || jobRetrying(j)),
    ) ?? null
  );
}

export interface TaskRowsOptions {
  /**
   * When a fixed pipeline reaches transcription, it is combined into one row with its transcription (prototype model-import.js `attach`: the same task becomes a transcription, showing the transcription's stage and model · this machine):
   * both the import-from-link and the transcription pipeline (generate subtitles, re-transcribe) do this. Task details find the row as-is by ID, so pass false.
   */
  fold?: boolean;
}

/**
 * Combined into one table, later ones first. Steps of a fixed pipeline (`parentJobId`) are folded under their parent task and do not get a row of their own (consistent with `jobs.list`);
 * when `fold` applies, the pipeline keeps its own ID, title, source and cancellation during transcription, while its kind, stage, progress and “where” are replaced with those of that transcription. The pipeline's progress, which counts steps (the transcription step of the transcription pipeline is 2/4), is not shown as the transcription's progress, and the transcription does not get a row of its own.
 */
export function taskRows(
  tasks: readonly TaskSummary[],
  jobs: readonly JobRecord[],
  ctx: TaskContext,
  options: TaskRowsOptions = {},
): TaskRow[] {
  const fold = options.fold ?? true;
  const folded = new Set<Id>();
  const jobRows = jobs
    .filter((j) => !j.parentJobId)
    .map((j) => {
      const row = jobRow(j, ctx);
      const child = fold && row.live && j.kind === 'pipeline' ? livePipelineTranscribe(j, jobs) : null;
      if (!child) return row;
      folded.add(child.jobId);
      const { kind, kindText, where, queued, label, tone, phase, pct, progress } = jobRow(child, ctx);
      return { ...row, kind, kindText, where, queued, label, tone, phase, pct, progress };
    });
  const rows = [...tasks.map((t) => agentRow(t, ctx)), ...jobRows.filter((r) => !folded.has(r.id))];
  return rows.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

/** Two groups: in progress (running, queued, stopping) and history, each keeping its order in the table. */
export function taskGroups(rows: readonly TaskRow[]): [TaskGroup, TaskGroup] {
  return [
    { id: 'active', label: TASK_VIEW_COPY.activeSection, items: rows.filter((r) => r.live) },
    { id: 'history', label: TASK_VIEW_COPY.historyGroup, items: rows.filter((r) => !r.live) },
  ];
}
