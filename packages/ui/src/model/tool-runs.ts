import {
  pipelineStepLabel,
  GRANT_DATA_KIND_LABELS,
  GRANT_DATA_KINDS,
  grantCreateParamsFor,
  LINK_COOKIE_BROWSERS,
  localizeText,
  RpcError,
  type GrantCreateParams,
  type GrantRequestItem,
  type Id,
  type JobRecord,
  type LinkCookieBrowser,
  type ModelCapabilitiesView,
  type ModelRef,
  type PipelineStepState,
  type SpeechModelInfo,
  type TextModelInfo,
  type ToolInputKind,
  type ToolStatus,
  type TranscribeDestination,
} from '@cuccut/protocol';
import { recipientName } from './data-grants.ts';
import { usedCookieText } from './link-cookies.ts';
import type { ToolId, ToolTargetKey, VideoToolId } from './tool-catalog.ts';
import { langLabel } from './tool-targets.ts';
import { cloudModelOptions, modelKeyOf, speaks, type ToolModelOption } from './tools-models.ts';
import { M } from './tool-runs-copy.ts';
import { transcribeJobOf } from './transcribe-speakers.ts';
import { jobErrorText } from './localized-text.ts';

/**
 * One run of a video tool (product design §2.7 “progress and failures”, “next steps on the result page”, “authorization completes in place”; design file model-tool-runs.js).
 *
 * A run is one fixed-flow parent task in the background tasks (`kind: 'pipeline'`). Steps, progress, and where a failure stopped are all read from records in the `jobs` topic; the UI does not run a separate copy. The step table follows the Runtime’s flow (`pipeline.steps`; names and labels come from Runtime), not the design file’s demo table. Skipped steps (not needed this time, e.g. “New video” when not creating a new video) are not listed.
 *
 * Submission: the flow name and the directory parameters that are fixed for the flow come from `tools.list`’s `execution` (`executionByInput` by input kind), and are merged into the parameters given by the UI; they are not hard-coded. When the submission is rejected by in-place authorization (`details.pendingGrants`), ask the user to confirm, issue `grants.create` item by item, then resubmit with the same `commandId`.
 */

// ---- Flows and tools ----

/** Flow name → tool page (transcoding is split into compress and merge by `action`). null when it belongs to no tool. */
export function toolOfJob(job: Pick<JobRecord, 'kind' | 'pipeline'>): ToolId | null {
  const name = job.pipeline?.name;
  switch (name) {
    case 'transcribe':
      return 'transcribe';
    case 'translate':
    case 'translate-subtitles':
      return 'translate-subtitles';
    case 'dub':
      return 'dub';
    case 'link-import':
      return 'link-import';
    case 'transcode':
      return job.pipeline?.params.action === 'merge' ? 'merge-video' : job.pipeline?.params.action === 'extract-audio' ? 'extract-audio' : 'compress-video';
    default:
      return null;
  }
}

/**
 * Flow tasks shown in the background task details as a video-tool run (steps, retry from this step, back to the tool): transcribe, translate captions, translate dubbing.
 * Download video also uses this view. Link flows with an old video target keep the original details page.
 */
export function toolRunOf(job: Pick<JobRecord, 'kind' | 'pipeline'>): VideoToolId | null {
  if (job.kind !== 'pipeline') return null;
  const tool = toolOfJob(job);
  if (tool === 'link-import' && !job.pipeline?.params.videoId && !job.pipeline?.params.create && !job.pipeline?.params.target) return tool;
  return tool === 'transcribe' || tool === 'translate-subtitles' || tool === 'dub' ? tool : null;
}

/** Whether this task counts as a run record of this video tool. The transcription page separately collects “start from a link, transcribe after download” link imports (design file: the same result). */
export function isRunOf(job: JobRecord, tool: VideoToolId): boolean {
  if (job.kind !== 'pipeline' || !job.pipeline) return false;
  if (toolOfJob(job) === tool) return true;
  return tool === 'transcribe' && job.pipeline.name === 'link-import' && job.pipeline.params.transcribe === true;
}

/** The run records of this tool, newest first. */
export function runsOf(jobs: readonly JobRecord[], tool: VideoToolId): JobRecord[] {
  return jobs.filter((j) => isRunOf(j, tool)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

// ---- Steps and progress ----

export type RunStepStatus = 'done' | 'running' | 'failed' | 'pending';
export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface RunStep {
  name: string;
  label: string;
  status: RunStepStatus;
  /** Progress (0–100) of the step currently running; null if it cannot be read. */
  pct: number | null;
}

export interface RunView {
  jobId: Id;
  status: RunStatus;
  steps: RunStep[];
  /** Index in `steps` of the current step (running, stopped, or the next one to run). */
  cur: number;
  /** The reason shown to people for a failure or cancellation. */
  error: string | null;
  errorCode: string | null;
  /** How many times it has been retried (the first run is 1). */
  attempt: number;
}

/** Maps Runtime step status to the four states in the UI. Skipped steps are null (not listed). */
export function stepStatus(status: PipelineStepState['status']): RunStepStatus | null {
  switch (status) {
    case 'completed':
      return 'done';
    case 'running':
      return 'running';
    case 'failed':
    case 'cancelled':
    case 'interrupted':
      return 'failed';
    case 'pending':
      return 'pending';
    case 'skipped':
      return null;
    default: {
      const never: never = status;
      return never;
    }
  }
}

function runStatus(job: JobRecord): RunStatus {
  switch (job.state) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'completed':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
    case 'interrupted':
    case 'needs-reconciliation':
      return 'failed';
    default: {
      const never: never = job.state;
      return never;
    }
  }
}

/** Progress (0–100) of a subtask: proportional when there is a total; null otherwise. */
function childPct(jobId: Id | null, jobs: readonly JobRecord[]): number | null {
  if (!jobId) return null;
  const p = jobs.find((j) => j.jobId === jobId)?.progress;
  if (!p || !p.total) return null;
  return Math.max(0, Math.min(100, (p.done / p.total) * 100));
}

export const DIARIZE_STEP = {
  name: 'diarize' as const,
  get label(): string {
    return M.diarizeStep;
  },
};

/**
 * The run view of a flow task; null if it is not a flow task. `jobs` is used to read the subtask progress of the step currently running.
 * `opts.diarizeStep`: when transcription is diarized by the “speaker diarization” model package (`diarizeStepOf` in model/transcribe-speakers.ts), “transcribe” is split into “transcribe” and “identify speakers” (design file model-tool-runs.js `plan`). In the flow it is one step; it is separated by the transcription task’s phase (`diarizing`).
 */
export function runView(job: JobRecord, jobs: readonly JobRecord[] = [], opts: { diarizeStep?: boolean } = {}): RunView | null {
  const pipeline = job.pipeline;
  if (!pipeline) return null;
  const steps: RunStep[] = [];
  for (const s of pipeline.steps) {
    const status = stepStatus(s.status);
    if (!status) continue;
    if (opts.diarizeStep && pipeline.name === 'transcribe' && s.name === 'transcribe') {
      steps.push(...splitDiarize(pipelineStepLabel(s), status, childPct(s.jobId, jobs), transcribeJobOf(job.jobId, jobs)?.phase === 'diarizing'));
      continue;
    }
    steps.push({ name: s.name, label: pipelineStepLabel(s), status, pct: status === 'running' ? childPct(s.jobId, jobs) : null });
  }
  const status = runStatus(job);
  let cur = steps.findIndex((s) => s.status === 'running' || s.status === 'failed');
  if (cur < 0) cur = steps.findIndex((s) => s.status === 'pending');
  if (cur < 0) cur = Math.max(0, steps.length - 1);
  const stopped = status === 'failed' || status === 'cancelled';
  return {
    jobId: job.jobId,
    status,
    steps,
    cur,
    error: stopped ? (jobErrorText(job.error) ?? null) : null,
    errorCode: stopped ? (job.error?.code ?? null) : null,
    attempt: Math.max(1, job.attempt),
  };
}

/** “Transcribe” is split into two steps. Once the transcription task reaches the speaker-diarization phase, transcription counts as complete, and “identify speakers” is running (or stopped). Before that, “identify speakers” is waiting. */
function splitDiarize(label: string, status: RunStepStatus, pct: number | null, diarizing: boolean): RunStep[] {
  const later = (s: RunStepStatus): RunStep => ({ ...DIARIZE_STEP, status: s, pct: null });
  if (status === 'done' || status === 'pending') return [{ name: 'transcribe', label, status, pct: null }, later(status)];
  if (diarizing) return [{ name: 'transcribe', label, status: 'done', pct: null }, later(status)];
  return [{ name: 'transcribe', label, status, pct: status === 'running' ? pct : null }, later('pending')];
}

/** Progress (0–100) of the whole run: the completed steps plus the proportion of the current step. */
export function pct(run: RunView): number {
  if (run.status === 'done') return 100;
  if (!run.steps.length) return 0;
  const done = run.steps.filter((s) => s.status === 'done').length;
  const current = run.steps[run.cur];
  const part = current && current.status === 'running' ? (current.pct ?? 0) / 100 : 0;
  return Math.round(((done + part) / run.steps.length) * 100);
}

/** Status phrase: Transcribing · step 2 / 4. On failure, says which step it stopped at. */
export function phase(run: RunView): string {
  if (run.status === 'done') return M.phaseDone;
  if (run.status === 'queued') return M.phaseQueued;
  const step = run.steps[run.cur];
  if (!step) return run.status === 'cancelled' ? M.phaseCancelled : run.status === 'failed' ? M.phaseUnfinished : M.phasePreparing;
  const at = M.stepAt(run.cur + 1, run.steps.length);
  if (run.status === 'cancelled') return M.cancelledAt(step.label, at);
  if (run.status === 'failed') return M.stoppedAt(step.label, at);
  return M.runningAt(step.label, at);
}

/** The few words on the right of a step row: done / stopped at this step / N% / waiting. */
export function stepNote(step: RunStep): string {
  if (step.status === 'done') return M.stepDone;
  if (step.status === 'failed') return M.stepStopped;
  if (step.status === 'running') return step.pct === null ? M.stepRunning : `${Math.round(step.pct)}%`;
  return M.stepWaiting;
}

// ---- Result page ----

/** Whether the result is a video (it gets “Open editor”). */
export function opensMovie(tool: VideoToolId, input: ToolInputKind, opts: { target?: ToolTargetKey } = {}): boolean {
  return !(tool === 'translate-subtitles' && input === 'file') && !((tool === 'link-import' || tool === 'transcribe') && opts.target === 'none');
}

// ---- In-place authorization ----

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGrantItem(value: unknown): value is GrantRequestItem {
  if (!isObject(value)) return false;
  return (
    typeof value.recipient === 'string' &&
    typeof value.capability === 'string' &&
    typeof value.purpose === 'string' &&
    Array.isArray(value.dataKinds) &&
    value.dataKinds.every((k) => typeof k === 'string' && (GRANT_DATA_KINDS as readonly string[]).includes(k))
  );
}

/** Pending approval items carried by a rejection (`details.pendingGrants`; only rejections from a present user carry them). null when there are none. */
export function pendingGrantsOf(error: unknown): GrantRequestItem[] | null {
  const details = error instanceof RpcError ? error.details : isObject(error) ? error.details : undefined;
  if (!isObject(details) || !Array.isArray(details.pendingGrants)) return null;
  const items = details.pendingGrants.filter(isGrantItem);
  return items.length ? items : null;
}

/** Same recipient and same data kinds: an earlier consent is recognized, which prevents a loop when the request is still rejected after granting. */
export function grantKey(item: Pick<GrantRequestItem, 'recipient' | 'dataKinds'>): string {
  return `${item.recipient}:${[...item.dataKinds].sort().join(',')}`;
}

/** Provider ID → name (the providers for each capability in the model view). The authorized recipient is written using this. */
export function providerLabels(view: ModelCapabilitiesView | null): Map<string, string> {
  const map = new Map<string, string>();
  if (view) for (const cap of Object.values(view)) for (const p of cap.providers) map.set(p.providerId, p.label);
  return map;
}

export interface GrantLine {
  key: string;
  recipient: string;
  what: string;
  cost: string;
}

/** One item on the authorization card: who it goes to, what is sent, and the estimated cost (the amount is written when there is an estimate; otherwise it says honestly that no estimate is available). */
export function grantLines(items: readonly GrantRequestItem[], labels: ReadonlyMap<string, string>): GrantLine[] {
  const seen = new Set<string>();
  const out: GrantLine[] = [];
  for (const item of items) {
    const key = grantKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const recipient = recipientName(item.recipient, labels);
    const cost = item.estimate
      ? M.costEstimate(item.estimate.amount, item.estimate.currency)
      : item.cost === 'subscription'
        ? M.costSubscription(recipient)
        : item.cost === 'free-local'
          ? M.costFree
          : M.costMetered(recipient);
    const what = M.grantWhat(
      item.dataKinds.map((k) => GRANT_DATA_KIND_LABELS[k]),
      localizeText(item.purpose, item.purposeRef),
    );
    out.push({ key, recipient, what, cost });
  }
  return out;
}

// ---- Submit ----

export interface PipelineRequest {
  pipeline: string;
  params: Record<string, unknown>;
}

/**
 * How this tool runs when it starts from this kind of input: the flow name and the directory parameters that the flow fixes (`execution.params`, e.g. `captions: true` for translate captions) are merged into the parameters given by the UI (the UI’s values take precedence). null when the state is not yet available or this tool is not a flow (do not submit, and do not fall back to a hard-coded flow name).
 */
export function toolRequest(status: ToolStatus | null | undefined, input: ToolInputKind, params: Record<string, unknown>): PipelineRequest | null {
  if (!status) return null;
  const execution = status.executionByInput?.[input] ?? status.execution;
  if (execution.kind !== 'pipeline') return null;
  return { pipeline: execution.pipeline, params: { ...(execution.params ?? {}), ...params } };
}

/** The two methods used for submission in the session (replaced with fakes in tests). */
export interface ToolStartSession {
  startPipelineWithCommand(pipeline: string, params: Record<string, unknown>, commandId: string): Promise<Id>;
  createGrant(params: GrantCreateParams): Promise<unknown>;
}

export type StartOutcome =
  | { kind: 'started'; jobId: Id }
  | { kind: 'grants'; items: GrantRequestItem[] }
  /** Replacing an edited transcript without `acceptEdited` (`TRANSCRIPT_EDITED`; a product-design gate for manual edits in re-transcription): resubmit with it after consent. */
  | { kind: 'edited'; error: Error }
  | { kind: 'failed'; error: Error };

/** Rejected on submit with `TRANSCRIPT_EDITED` (`RpcError.code` is `conflict`; the code is in `details.code`). */
export function transcriptEditedOf(error: unknown): boolean {
  const details = error instanceof RpcError ? error.details : isObject(error) ? error.details : undefined;
  return isObject(details) && details.code === 'TRANSCRIPT_EDITED';
}

/** Explanation for when consent was already given and the grants were issued, but Runtime still requires these items (the user is not asked for consent again). */
export const grantLoopText = (): string => M.grantLoop;

/** Start once. When rejected by in-place authorization, returns the pending approval items (the same `commandId` is kept for resubmission); other failures are returned as they are. */
export async function startTool(session: ToolStartSession, request: PipelineRequest, commandId: string): Promise<StartOutcome> {
  try {
    const jobId = await session.startPipelineWithCommand(request.pipeline, request.params, commandId);
    return { kind: 'started', jobId };
  } catch (error) {
    const items = pendingGrantsOf(error);
    if (items) return { kind: 'grants', items };
    const err = error instanceof Error ? error : new Error(String(error));
    if (transcriptEditedOf(error)) return { kind: 'edited', error: err };
    return { kind: 'failed', error: err };
  }
}

/**
 * After the user consents: grant item by item (`grants.create(grantCreateParamsFor(item))`), then resubmit with the same `commandId`. `granted` records the items granted in this round (`grantKey`). If the resubmission is rejected again and asks for something already granted, stop and explain; do not ask for consent again.
 */
export async function grantAndRestart(
  session: ToolStartSession,
  request: PipelineRequest,
  commandId: string,
  items: readonly GrantRequestItem[],
  granted: Set<string>,
): Promise<StartOutcome> {
  if (items.some((item) => granted.has(grantKey(item)))) return { kind: 'failed', error: new Error(grantLoopText()) };
  try {
    for (const item of items) {
      await session.createGrant(grantCreateParamsFor(item));
      granted.add(grantKey(item));
    }
  } catch (error) {
    return { kind: 'failed', error: error instanceof Error ? error : new Error(String(error)) };
  }
  const outcome = await startTool(session, request, commandId);
  if (outcome.kind === 'grants' && outcome.items.every((item) => granted.has(grantKey(item)))) return { kind: 'failed', error: new Error(grantLoopText()) };
  return outcome;
}

// ---- Parameters for each tool ----

/** Video target: an item in Space (candidates carry only item IDs; a video that has never been opened has no videoId), or a new video. */
export type VideoTarget = { entryId: Id } | { create: { projectId: Id; name?: string; media?: string } };

export interface AsrChoice {
  provider?: string;
  model?: string;
  /** The language to assert. An empty string or none means auto-detect. */
  language?: string;
  /** Whether to identify speakers (the “More options” toggle). The tool page always sends true or false explicitly; when not given, Runtime decides based on the model. */
  diarize?: boolean;
}

/**
 * Where the result lands when the video already has a transcript (product design: re-transcription). `new-video` creates a new video (when `name` is empty, Runtime uses “<original name> · Re-transcribed”). `replace` swaps in the new transcript and carries translations over. `acceptEdited` means the user has seen the warning about manual edits and still wants to replace. When the video has no transcript yet, Runtime ignores these.
 */
export interface TranscribeDestinationChoice {
  destination: TranscribeDestination;
  name?: string;
  acceptEdited?: boolean;
}

/** Transcription (`transcribe` flow): create a new video from a local file, or write into an editable video in Space. `assetId` is given when the video has several assets and the user picked one. */
export function transcribeParams(
  target: VideoTarget,
  asr: AsrChoice,
  assetId?: Id | null,
  dest?: TranscribeDestinationChoice | null,
): Record<string, unknown> {
  const name = dest?.destination === 'new-video' ? dest.name?.trim() : '';
  return {
    target,
    ...(assetId ? { assetId } : {}),
    ...(dest && 'entryId' in target ? { destination: dest.destination } : {}),
    ...(name && 'entryId' in target ? { name } : {}),
    ...(dest?.destination === 'replace' && 'entryId' in target ? { translations: 'carry' } : {}),
    ...(dest?.destination === 'replace' && dest.acceptEdited && 'entryId' in target ? { acceptEdited: true } : {}),
    ...(asr.provider ? { provider: asr.provider } : {}),
    ...(asr.model ? { model: asr.model } : {}),
    ...(asr.language ? { language: asr.language } : {}),
    ...(asr.diarize !== undefined ? { diarize: asr.diarize } : {}),
  };
}

/**
 * File-only transcription (the `transcribe` flow with no target, `TranscribeFileParams`): a local file, or a media item in Space (`{ entryId }`). TXT and SRT are written to `outDir` (the save location when not given). Does not accept `diarize`, `assetId`, or `captions`.
 */
export function transcribeFileParams(file: string | { entryId: Id }, asr: AsrChoice, outDir?: string): Record<string, unknown> {
  return {
    file,
    ...(outDir ? { outDir } : {}),
    ...(asr.provider ? { provider: asr.provider } : {}),
    ...(asr.model ? { model: asr.model } : {}),
    ...(asr.language ? { language: asr.language } : {}),
  };
}

/** Import from a link (`link-import` flow): where it lands (new, add to existing, or download only). `transcribe` transcribes after download (using the default speech recognition model). */
export function linkParams(o: {
  url: string;
  target: ToolTargetKey;
  projectId?: Id | null;
  entryId?: Id | null;
  transcribe?: boolean;
}): Record<string, unknown> {
  const params: Record<string, unknown> = { url: o.url.trim() };
  if (o.target === 'create' && o.projectId) params.target = { create: { projectId: o.projectId } };
  else if (o.target === 'video' && o.entryId) params.target = { entryId: o.entryId };
  else if (o.projectId) params.projectId = o.projectId;
  if (o.transcribe && o.target !== 'none') params.transcribe = true;
  return params;
}

/** Translate captions (video): the `translate` flow. The catalog supplies `captions: true`; bilingual output has to be layered on top of it (merged in `toolRequest`). */
export function translateVideoParams(o: {
  entryId: Id;
  documentId?: Id | null;
  targetLanguage: string;
  bilingual: boolean;
  provider?: string;
  model?: string;
}) {
  return {
    target: { entryId: o.entryId },
    ...(o.documentId ? { documentId: o.documentId } : {}),
    targetLanguage: o.targetLanguage,
    ...(o.bilingual ? { bilingual: true } : {}),
    ...(o.provider ? { provider: o.provider } : {}),
    ...(o.model ? { model: o.model } : {}),
  };
}

/** Translate captions (caption file): the `translate-subtitles` flow, file to file. */
export function translateFileParams(o: {
  /** The local path of the caption file, or a caption item in Space. */
  input: string | { entryId: Id };
  targetLanguage: string;
  bilingual: boolean;
  provider?: string;
  model?: string;
  /** The save location for this run. When not given, Runtime writes to its save location. */
  outDir?: string;
}) {
  return {
    input: o.input,
    targetLanguage: o.targetLanguage,
    ...(o.bilingual ? { bilingual: true } : {}),
    ...(o.provider ? { provider: o.provider } : {}),
    ...(o.model ? { model: o.model } : {}),
    ...(o.outDir ? { outDir: o.outDir } : {}),
  };
}

export type OriginalAudio = 'duck' | 'mute' | 'keep';

/**
 * Translate dubbing: when an existing translation is chosen, give `translationId` (and its source transcript). Otherwise give the target language and the text model used for translation (`textProvider` / `textModel`) to translate first. `provider` / `model` are for speech synthesis. The voice is not given (the model’s default voice is used; speaker-bound voices stay as they are).
 */
export function dubParams(o: {
  entryId: Id;
  translation: { id: Id; documentId: Id } | null;
  targetLanguage: string | null;
  /** The source transcript to translate first. When not given, Runtime takes the single transcript in the video. */
  documentId?: Id | null;
  originalAudio: OriginalAudio;
  provider?: string;
  model?: string;
  textProvider?: string;
  textModel?: string;
}) {
  return {
    target: { entryId: o.entryId },
    ...(o.translation
      ? { translationId: o.translation.id, documentId: o.translation.documentId }
      : {
          targetLanguage: o.targetLanguage,
          ...(o.documentId ? { documentId: o.documentId } : {}),
          ...(o.textProvider ? { textProvider: o.textProvider } : {}),
          ...(o.textModel ? { textModel: o.textModel } : {}),
        }),
    originalAudio: o.originalAudio,
    ...(o.provider ? { provider: o.provider } : {}),
    ...(o.model ? { model: o.model } : {}),
  };
}

/** Translation needs structured output. A provider that does not support it is listed but cannot be used (this applies to translation in the captions panel and in the home-page fixed flow as well). */
export function translateModelOptions(view: ModelCapabilitiesView): ToolModelOption<TextModelInfo>[] {
  return cloudModelOptions(view, 'generateText').map((o) =>
    o.usable && o.info.structuredOutput === false ? { ...o, usable: false, why: M.noStructuredOutput } : o,
  );
}

/**
 * The default dubbing engine: the one selected earlier, if it is still available; otherwise the effective default (usable and able to speak this language); otherwise the first one that is usable and speaks the language; otherwise the first usable one.
 * When `lang` is unknown (the translation does not label its language), do not pick by language.
 */
export function dubEngineKey(
  options: readonly ToolModelOption<Pick<SpeechModelInfo, 'languages'>>[],
  saved: string | null,
  effective: ModelRef | null,
  lang: string | null,
): string | null {
  if (saved && options.some((o) => o.key === saved)) return saved;
  const fits = (o: ToolModelOption<Pick<SpeechModelInfo, 'languages'>>) => o.usable && (!lang || speaks(o.info.languages, lang));
  const preferred = effective ? modelKeyOf(effective.providerId, effective.modelId) : null;
  return (options.find((o) => o.key === preferred && fits(o)) ?? options.find(fits) ?? options.find((o) => o.usable) ?? options[0])?.key ?? null;
}

// ---- After a failure ----

/** When transcribing and the video’s main track has several assets (`TRANSCRIBE_ASSET_AMBIGUOUS`), the user has to pick one, and the run restarts with `assetId`. */
export function ambiguousAssets(job: Pick<JobRecord, 'error'> | null): Id[] | null {
  const error = job?.error;
  if (!error || error.code !== 'TRANSCRIBE_ASSET_AMBIGUOUS' || !isObject(error.details)) return null;
  const ids = error.details.assetIds;
  return Array.isArray(ids) ? ids.filter((x): x is Id => typeof x === 'string') : null;
}

/**
 * Restart after the asset is picked (a new run with a new commandId): uses this run’s frozen parameters plus `assetId`. If this run has already been written into a video, the target becomes that video (no new one is created).
 */
export function withAsset(job: Pick<JobRecord, 'pipeline' | 'videoId'>, assetId: Id): PipelineRequest | null {
  const pipeline = job.pipeline;
  if (!pipeline) return null;
  const params: Record<string, unknown> = { ...pipeline.params, assetId };
  if (job.videoId) params.target = { videoId: job.videoId };
  return { pipeline: pipeline.name, params };
}

/** The kind of input this run started from (inferred from the frozen parameters when there is no local record). */
export function runInput(job: Pick<JobRecord, 'pipeline'>): ToolInputKind {
  const pipeline = job.pipeline;
  if (!pipeline) return 'video';
  if (pipeline.name === 'translate-subtitles') return 'file';
  if (pipeline.name === 'link-import') return 'link';
  if (pipeline.name === 'transcribe' && 'file' in pipeline.params) return 'file';
  const target = isObject(pipeline.params.target) ? pipeline.params.target : null;
  return target && isObject(target.create) ? 'file' : 'video';
}

/** Where a link import or transcription lands, and whether it transcribes after download (inferred from the frozen parameters). File-only transcription is `none`. */
export function runOpts(job: Pick<JobRecord, 'pipeline'>): { target?: ToolTargetKey; transcribe?: boolean } {
  const pipeline = job.pipeline;
  if (pipeline?.name === 'transcribe') {
    if ('file' in pipeline.params) return { target: 'none' };
    const target = isObject(pipeline.params.target) ? pipeline.params.target : null;
    return target && isObject(target.create) ? { target: 'create' } : {};
  }
  if (!pipeline || pipeline.name !== 'link-import') return {};
  const target = isObject(pipeline.params.target) ? pipeline.params.target : null;
  return { target: !target ? 'none' : isObject(target.create) ? 'create' : 'video', transcribe: pipeline.params.transcribe === true };
}

// ---- Result ----

/** The name recorded locally at submission (the summary only has IDs): run title, video name, project name, and the language of the source transcript. */
export interface RunMeta {
  tool: VideoToolId;
  input: ToolInputKind;
  title: string;
  videoName?: string | null;
  projectName?: string | null;
  sourceLanguage?: string | null;
  target?: ToolTargetKey;
  transcribe?: boolean;
}

/**
 * The caption layer the flow created (`summary.captions`). After main was merged, this is replaced with protocol’s `PipelineCaptionsSummary` (origin/main:packages/protocol/src/pipelines.ts).
 */
export interface CaptionsFacts {
  status: 'created' | 'existing' | 'disabled' | 'not-on-timeline' | 'empty';
  enabled: boolean | null;
  bilingual: boolean;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function captionsOf(value: unknown): CaptionsFacts | null {
  if (!isObject(value)) return null;
  const status = value.status;
  if (status !== 'created' && status !== 'existing' && status !== 'disabled' && status !== 'not-on-timeline' && status !== 'empty') return null;
  return { status, enabled: typeof value.enabled === 'boolean' ? value.enabled : null, bilingual: value.bilingual === true };
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function dirName(path: string): string {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join('/') || path;
}

/** One sentence for the caption layer. When it was not created, says why; when the option is off, says nothing. */
function captionsLine(c: CaptionsFacts | null, lang: string | null, translation: boolean): string | null {
  if (!c) return null;
  switch (c.status) {
    case 'created':
      return M.captionsCreated({ language: translation ? langLabel(lang) : null, bilingual: c.bilingual, disabled: c.enabled === false });
    case 'existing':
      return translation ? M.captionsExistingTranslation : M.captionsExistingTranscript;
    case 'not-on-timeline':
      return M.captionsNotOnTimeline;
    case 'empty':
      return M.captionsEmpty;
    case 'disabled':
      return null;
    default: {
      const never: never = c.status;
      return never;
    }
  }
}

/** The carry-over when the transcript is replaced (the summary’s `translations`, `captionPins`, `dubs`): one sentence each for translations and dubs per language, and for pins. If something is stale, a hint to refresh. */
function carryLines(summary: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const translations = carryTranslationsOf(summary);
  for (const t of translations) lines.push(M.carryTranslation(langLabel(t.language), t.kept, t.keptReviewed, t.stale));
  const pins = isObject(summary.captionPins) ? summary.captionPins : null;
  const reanchored = pins ? (num(pins.reanchored) ?? 0) : 0;
  const orphaned = pins ? (num(pins.orphaned) ?? 0) : 0;
  if (reanchored + orphaned > 0) lines.push(M.carryPins(reanchored, orphaned));
  const dubs = Array.isArray(summary.dubs) ? summary.dubs.filter(isObject) : [];
  for (const d of dubs) lines.push(M.carryDub(langLabel(str(d.language)), num(d.kept) ?? 0, num(d.stale) ?? 0));
  if (!lines.length) return [M.nothingToCarry];
  if (translations.some((t) => t.stale > 0)) lines.push(M.refreshHint);
  return lines;
}

/**
 * A transcription that replaced the transcript (`summary.target === 'replace'`): the result page offers “Undo” (undoes that transaction by `replaced.transactionId`; not offered when it is missing) and “Refresh stale translations” (when there are stale sentences). null for other runs.
 */
export function transcriptSwitchOf(job: JobRecord): { videoId: Id; transactionId: Id | null; stale: boolean } | null {
  const summary = job.pipeline?.name === 'transcribe' && job.state === 'completed' ? job.pipeline.summary : null;
  if (!summary || summary.target !== 'replace') return null;
  const videoId = str(summary.videoId);
  if (!videoId) return null;
  const transactionId = isObject(summary.replaced) ? str(summary.replaced.transactionId) : null;
  return { videoId, transactionId, stale: carryTranslationsOf(summary).some((t) => t.stale > 0) };
}

/** The translations carried over in the summary (items that cannot be read are skipped). */
export function carryTranslationsOf(
  summary: Record<string, unknown> | null | undefined,
): Array<{ language: string; kept: number; keptReviewed: number; stale: number }> {
  if (!summary || !Array.isArray(summary.translations)) return [];
  return summary.translations.filter(isObject).map((t) => ({
    language: str(t.language) ?? '',
    kept: num(t.kept) ?? 0,
    keptReviewed: num(t.keptReviewed) ?? 0,
    stale: num(t.stale) ?? 0,
  }));
}

/**
 * A few sentences on the result page (design file tool-specs.jsx `result`), read from the flow summary (`pipeline.summary`). The summary only has IDs, so names come from `meta` (recorded locally at submission) or `videoName` (looked up in Space by video ID). An empty array when they cannot be read.
 */
export function resultLines(job: JobRecord, meta: RunMeta | null, videoName: string | null): string[] {
  const summary = job.pipeline?.summary;
  if (!summary || !job.pipeline) return [];
  const name = meta?.videoName ?? videoName ?? M.thisVideo;
  const project = meta?.projectName ?? null;
  const lines: string[] = [];
  switch (job.pipeline.name) {
    case 'transcribe': {
      const model = str(summary.modelId);
      if (Array.isArray(summary.files)) {
        const names = summary.files.filter((f): f is string => typeof f === 'string').map(baseName);
        lines.push(M.savedFiles(names));
        lines.push(M.transcriptLanguage(langLabel(str(summary.language)), model));
        return lines;
      }
      // Landing (`summary.target`, product design: re-transcription): a new video, the transcript replaced, or there was no transcript before, so it was written directly.
      const target = str(summary.target);
      if (target === 'replace') lines.push(M.replacedTranscript(name));
      else if (target === 'new-video') {
        const created = isObject(summary.newVideo) ? str(summary.newVideo.name) : null;
        // The `meta.videoName` recorded at submission is the original video; the `videoName` looked up by ID is the new video.
        lines.push(M.newVideoFrom(created ?? videoName ?? M.newVideo, project, meta?.videoName ?? null));
      } else if (summary.createdVideo === true) lines.push(M.createdVideoLinked(videoName ?? meta?.videoName ?? M.newVideo, project));
      else lines.push(M.wroteTranscript(name));
      lines.push(M.transcriptLanguage(langLabel(str(summary.language)), model));
      const speakers = job.pipeline.params.diarize === true ? num(summary.speakerCount) : null;
      if (speakers) lines.push(M.speakersFound(speakers));
      const caption = captionsLine(captionsOf(summary.captions), null, false);
      if (caption) lines.push(caption);
      if (target === 'replace') lines.push(...carryLines(summary));
      return lines;
    }
    case 'translate': {
      const lang = str(summary.targetLanguage);
      lines.push(M.wroteTranslation(name, langLabel(lang), meta?.sourceLanguage ? langLabel(meta.sourceLanguage) : null));
      const units = num(summary.unitCount);
      if (units !== null) lines.push(M.unitCount(units));
      const caption = captionsLine(captionsOf(summary.captions), lang, true);
      if (caption) lines.push(caption);
      return lines;
    }
    case 'translate-subtitles': {
      const file = str(summary.file);
      if (file) lines.push(M.subtitleFileWritten(baseName(file), dirName(file)));
      if (summary.bilingual === true) lines.push(M.bilingualLayout);
      const stripped = num(summary.markupStripped);
      if (stripped) lines.push(M.markupStripped(stripped));
      return lines;
    }
    case 'dub': {
      const lang = str(summary.language);
      const translation = isObject(summary.translation) ? summary.translation : null;
      lines.push(translation?.created === true ? M.dubTranslated(langLabel(lang)) : M.dubReusedTranslation(langLabel(lang)));
      const synthesis = isObject(summary.synthesis) ? summary.synthesis : null;
      const engine = synthesis ? [str(synthesis.providerId), str(synthesis.modelId)].filter(Boolean).join(' · ') : '';
      lines.push(M.dubWritten(name, langLabel(lang), engine));
      const units = isObject(summary.units) ? summary.units : null;
      const placed = num(units?.placed);
      const total = num(units?.total);
      if (placed !== null && total !== null) lines.push(M.dubPlaced(placed, total));
      const audio = summary.originalAudio;
      if (audio === 'duck' || audio === 'mute' || audio === 'keep') lines.push(M.originalAudio[audio]);
      return lines;
    }
    case 'link-import': {
      const files = isObject(summary.files) ? summary.files : null;
      const media = str(files?.media);
      const file = media ? baseName(media) : M.media;
      const title = str(summary.title);
      const videoId = str(summary.videoId);
      if (summary.createdVideo === true) lines.push(M.linkCreatedVideo(videoName ?? title ?? M.newVideo, project));
      else if (videoId) lines.push(M.linkAddedTo(file, name));
      else lines.push(M.linkDownloaded(file, media ? dirName(media) : null));
      const browser = str(summary.cookieBrowser);
      if (browser && (LINK_COOKIE_BROWSERS as readonly string[]).includes(browser)) lines.push(usedCookieText(browser as LinkCookieBrowser));
      // Transcription from a link import does not create a caption layer (remote §14 records it as not implemented): say so honestly.
      if (Array.isArray(summary.transcriptFiles)) lines.push(M.linkTranscribedFiles);
      else if (str(summary.transcribeJobId)) lines.push(M.linkTranscribed);
      return lines;
    }
    default:
      return lines;
  }
}

/** The video the run wrote into (or created). null when there is no video. */
export function resultVideoId(job: JobRecord): Id | null {
  const summary = job.pipeline?.summary;
  return (summary && str(summary.videoId)) ?? job.videoId ?? null;
}

/** The run title when there is no local record: the tool name, plus whatever can be read from the frozen parameters (file name, link, target language). */
export function fallbackTitle(job: JobRecord, toolName: string, videoName: string | null): string {
  const params = job.pipeline?.params ?? {};
  const target = isObject(params.target) ? params.target : null;
  const create = target && isObject(target.create) ? target.create : null;
  const media = str(create?.media) ?? str(params.file);
  const lang = str(params.targetLanguage);
  const what = media
    ? baseName(media)
    : str(params.url)
      ? str(params.url)!.replace(/^https?:\/\//, '')
      : str(params.input)
        ? baseName(str(params.input)!)
        : (videoName ?? M.fallbackVideo);
  return `${toolName} · ${what}${lang ? ` → ${langLabel(lang)}` : ''}`;
}
