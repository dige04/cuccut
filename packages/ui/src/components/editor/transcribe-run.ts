import { newCaptionStyle } from '../../state/caption-preferences-store.ts';
import { withNewCaptionStyle } from '../../model/caption-preferences.ts';
import { create } from 'zustand';
import {
  RpcError,
  type AssetRecord,
  type CapabilityNotConfiguredDetails,
  type DocumentContent,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type JobRecord,
  type Localized,
  type Sequence,
  type TransactionReceipt,
  type TranscribeSummary,
  type UndoTarget,
} from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { guessLanguage } from '../../model/cue-edit.ts';
import { rootSequence } from '../../model/editor.ts';
import { formatClock } from '../../model/format.ts';
import {
  deriveCues,
  projectableItems,
  projectSpeech,
  readSpeechWords,
  speechCaptionBody,
  speechCaptionOperations,
} from '../../model/speech-cues.ts';
import { jobRemedy, type Remedy } from '../../model/task-facts.ts';
import { reconcileOptions } from '../../model/task-reconcile.ts';
import type { TranscribeOptions, TranscribeSetup } from '../../model/transcribe-setup.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { NOT_CONFIGURED_REASON, SUBTITLE_COPY as C } from './subtitle-copy.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { jobErrorText, remedyHintText } from '../../model/localized-text.ts';

/**
 * “Generate subtitles” and “Re-transcribe” in the subtitle panel (prototype panel-subtitle.jsx, empty state → `LiveHead`): submits the transcription flow (`transcribe` of `pipelines.start`, architecture design §7.9) and follows the parent task through the `jobs` topic. After the flow's transcribe step, the flow creates the subtitle layer itself (caption-layer.ts in jobs, split the same way as model/speech-cues.ts). A new transcript is added, not overwritten. When this asset already has original subtitles on screen, the new layer is added disabled. On completion, the new layer is selected per `summary.captions`, with a hint that offers “Undo” (it undoes the transaction that created the subtitle layer in the flow).
 *
 * Generating from a transcript already in the video (`generateFromSpeech`) doesn't recognize again; it is still cut in the editor and written as one transaction.
 *
 * The state lives in a module-level store rather than in the panel: the style entry card switches to the properties page, which unmounts the subtitle panel, and the transcription must not lose its connection because of that.
 * Transcriptions started elsewhere (by an agent, or from the command line) only show progress; after completion, the user clicks “Generate subtitles” to write the transcript into the video.
 */

export type RunStatus = 'submitting' | 'running' | 'writing';

export interface TranscribeRun {
  videoId: Id;
  assetId: Id;
  assetName: string;
  /** null before submission succeeds, and when generating directly from an existing transcript. */
  jobId: Id | null;
  status: RunStatus;
}

export type ProblemKind = 'not-configured' | 'failed' | 'empty' | 'pending' | 'decide';

export interface TranscribeProblem {
  kind: ProblemKind;
  title: string;
  message: string;
  /** Remedy that sends the user to the model page, settings, or service page (`jobRemedy`). */
  remedy: Remedy | null;
}

interface SubtitleRunState {
  runs: Record<Id, TranscribeRun>;
  problems: Record<Id, TranscribeProblem>;
  /** The subtitle document just generated: the panel selects it on its next render. */
  focus: Record<Id, Id>;
  /** The track chip selected in each video's track bar (kept when the panel unmounts and mounts again). */
  chosen: Record<Id, string>;
  /** Transcription settings per video (language, model, prompt); default values when none are set. The glossary is not here: the video keeps that itself. */
  setups: Record<Id, TranscribeSetup>;
}

export const useSubtitleRun = create<SubtitleRunState>()(() => ({ runs: {}, problems: {}, focus: {}, chosen: {}, setups: {} }));

/** Session capabilities used; tests supply fakes. */
export interface TranscribeDeps {
  runtime: {
    startPipeline(pipeline: string, params: Record<string, unknown>): Promise<Id>;
    readDocument(videoId: Id, documentId: Id, revision?: string): Promise<DocumentContent>;
    cancelJob(jobId: Id): Promise<void>;
    videos: {
      apply(operations: EditOperation[], label?: Localized): Promise<TransactionReceipt | null>;
      undo(target: UndoTarget): Promise<TransactionReceipt | null>;
    };
  };
  /** When `undo` has a value, the hint includes “Undo”. */
  toast(kind: 'positive' | 'neutral' | 'negative', message: string, undo?: () => void): void;
}

let deps: TranscribeDeps | null = null;
let unwatch: (() => void) | null = null;

/** When the panel mounts, binds the session and hints; on the first binding, starts watching the `jobs` topic. */
export function bindTranscribe(next: TranscribeDeps): void {
  deps = next;
  unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
}

/** For tests: unbind and clear the state. */
export function resetTranscribe(): void {
  unwatch?.();
  unwatch = null;
  deps = null;
  useSubtitleRun.setState({ runs: {}, problems: {}, focus: {}, chosen: {}, setups: {} });
}

const without = <T>(record: Record<Id, T>, key: Id): Record<Id, T> => {
  const { [key]: _, ...rest } = record;
  return rest;
};

function setRun(run: TranscribeRun): void {
  useSubtitleRun.setState((s) => ({ runs: { ...s.runs, [run.videoId]: run }, problems: without(s.problems, run.videoId) }));
}

function patchRun(videoId: Id, patch: Partial<TranscribeRun>): void {
  useSubtitleRun.setState((s) => (s.runs[videoId] ? { runs: { ...s.runs, [videoId]: { ...s.runs[videoId]!, ...patch } } } : {}));
}

/** End this round. If there is a problem, leave it on the panel. */
function endRun(videoId: Id, problem?: TranscribeProblem): void {
  useSubtitleRun.setState((s) => ({
    runs: without(s.runs, videoId),
    problems: problem ? { ...s.problems, [videoId]: problem } : s.problems,
  }));
}

/**
 * A transcribe Job that needs the user to decide in the task details (architecture design §7.5): the result is unknown (it may already be billed, so it is not resent automatically), or the recognition result exists but was not written into the video (`APPLY_FAILED`, `STALE_JOB_INPUT`; it can be written again). When the transcribe step of the transcription flow hits such a Job, the flow fails and points to that Job. Once it has been handled and the transcript has been written into the video, “Generate subtitles” uses it directly. A job the user cancelled (`cancelled`, even if the result exists) is no longer asked about.
 */
export function awaitingDecision(job: JobRecord): boolean {
  return job.state === 'needs-reconciliation' || (job.state === 'failed' && reconcileOptions(job).includes('apply'));
}

export function decisionProblem(job: JobRecord): TranscribeProblem {
  const unsettled = job.state === 'needs-reconciliation';
  return {
    kind: 'decide',
    title: unsettled ? C.unsettledTitle : C.unappliedTitle,
    message: unsettled ? C.unsettled : C.unapplied(jobErrorText(job.error) ?? ''),
    remedy: { label: C.decide, target: { tab: 'tasks', taskId: job.jobId }, hint: '' },
  };
}

export function dismissProblem(videoId: Id): void {
  useSubtitleRun.setState((s) => ({ problems: without(s.problems, videoId) }));
}

export function chooseChip(videoId: Id, key: string): void {
  useSubtitleRun.setState((s) => ({ chosen: { ...s.chosen, [videoId]: key } }));
}

/** Change this video's transcription settings (starts from the defaults if never set). */
export function patchSetup(videoId: Id, base: TranscribeSetup, patch: Partial<TranscribeSetup>): void {
  useSubtitleRun.setState((s) => ({ setups: { ...s.setups, [videoId]: { ...(s.setups[videoId] ?? base), ...patch } } }));
}

/** Makes the panel select this subtitle document (after generating or importing it). */
export function focusDocument(videoId: Id, documentId: Id): void {
  useSubtitleRun.setState((s) => ({ focus: { ...s.focus, [videoId]: documentId } }));
}

export function clearFocus(videoId: Id): void {
  useSubtitleRun.setState((s) => ({ focus: without(s.focus, videoId) }));
}

function isNotConfigured(details: unknown): details is CapabilityNotConfiguredDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { code?: unknown }).code === 'CAPABILITY_NOT_CONFIGURED' &&
    typeof (details as { remedy?: unknown }).remedy === 'object'
  );
}

/** Submission rejected: when transcription isn't configured, give the reason in place, plus `remedy.hint` and where to go. */
export function submitProblem(error: unknown): TranscribeProblem {
  const message = error instanceof Error ? error.message : String(error);
  const details = error instanceof RpcError ? error.details : (error as { details?: unknown } | null)?.details;
  if (isNotConfigured(details)) {
    return {
      kind: 'not-configured',
      title: C.notConfigured(NOT_CONFIGURED_REASON[details.reason] ?? details.reason),
      message: remedyHintText(details.remedy) || message,
      remedy: jobRemedy({ kind: 'transcribe', providerId: details.providerId ?? '', error: { code: details.code, message, details } }),
    };
  }
  return { kind: 'failed', title: C.submitFailed, message, remedy: null };
}

export interface MediaCandidate {
  asset: AssetRecord;
  /** This asset's existing transcript (the latest one). If present, subtitles are generated from it directly, without recognizing again. */
  speech: DocumentRecord | null;
}

/**
 * Assets that can generate subtitles: video and audio placed on the timeline that can be projected onto the sequence. (An asset that is only in the library, even if transcribed, can't reach the picture.) Ordered by first appearance on the timeline.
 */
export function mediaCandidates(sequence: Sequence, assets: Record<Id, AssetRecord>, documents: Record<Id, DocumentRecord>): MediaCandidate[] {
  const created = (record: DocumentRecord) => record.revisions[record.currentRevision]?.createdAt ?? '';
  return Object.values(assets)
    .filter((asset) => asset.kind === 'video' || asset.kind === 'audio')
    .map((asset) => ({ asset, first: Math.min(...projectableItems(sequence, asset.id).map(startFrame)) }))
    .filter(({ first }) => Number.isFinite(first))
    .sort((a, b) => a.first - b.first)
    .map(({ asset }) => {
      const speeches = Object.values(documents).filter((record) => record.kind === 'speech' && record.sourceAssetId === asset.id);
      const speech = speeches.reduce<DocumentRecord | null>((best, record) => (!best || created(record) >= created(best) ? record : best), null);
      return { asset, speech };
    });
}

const startFrame = (item: Sequence['items'][number]) => ('span' in item ? item.span.fromFrame : item.fromFrame);

/** Asset name without its extension, used as the subtitle document's name. */
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;

/** Submit the transcription flow. Only one round at a time per video. `options` are the transcription settings that differ from the defaults (`transcribeRequestOptions`). */
export async function startTranscribe(videoId: Id, asset: { id: Id; name: string }, options: TranscribeOptions = {}): Promise<void> {
  const bound = deps;
  if (!bound || useSubtitleRun.getState().runs[videoId]) return;
  setRun({ videoId, assetId: asset.id, assetName: asset.name, jobId: null, status: 'submitting' });
  try {
    const jobId = await bound.runtime.startPipeline('transcribe', { ...options, videoId, assetId: asset.id, captionStyle: newCaptionStyle() });
    patchRun(videoId, { jobId, status: 'running' });
    // Task events can arrive before the receipt.
    settle(useJobs.getState().jobs);
  } catch (error) {
    endRun(videoId, submitProblem(error));
  }
}

/** No transcription: generates subtitles directly from the transcript already in the video. */
export async function generateFromSpeech(videoId: Id, asset: { id: Id; name: string }, speechDocumentId: Id): Promise<void> {
  if (!deps || useSubtitleRun.getState().runs[videoId]) return;
  const run: TranscribeRun = { videoId, assetId: asset.id, assetName: asset.name, jobId: null, status: 'writing' };
  setRun(run);
  await writeCaptions(run, speechDocumentId);
}

export async function cancelTranscribe(jobId: Id): Promise<void> {
  try {
    await deps?.runtime.cancelJob(jobId);
  } catch (error) {
    deps?.toast('negative', C.cancelFailed(error instanceof Error ? error.message : String(error)));
  }
}

/** Watch the task submitted from here: when it ends, wrap up. Each round is wrapped up only once. The state is changed synchronously first, so later events that see it isn't `running` skip it. */
function settle(jobs: readonly JobRecord[]): void {
  for (const run of Object.values(useSubtitleRun.getState().runs)) {
    if (run.status !== 'running' || !run.jobId) continue;
    const job = jobs.find((candidate) => candidate.jobId === run.jobId);
    if (!job || isJobLive(job)) continue;
    endRun(run.videoId);
    finish(run, job, jobs);
  }
}

/** The `transcribe` Job submitted by the flow's transcribe step (the latest one if retried). null if this isn't a flow, or it hasn't been submitted yet. */
export function transcribeStepJob(parent: JobRecord, jobs: readonly JobRecord[]): JobRecord | null {
  if (parent.kind !== 'pipeline') return null;
  return jobs
    .filter((job) => job.kind === 'transcribe' && job.submitter.kind === 'pipeline' && job.submitter.id === parent.jobId)
    .reduce<JobRecord | null>((latest, job) => (!latest || job.createdAt >= latest.createdAt ? job : latest), null);
}

function finish(run: TranscribeRun, job: JobRecord, jobs: readonly JobRecord[]): void {
  const { videoId } = run;
  if (job.state === 'cancelled') {
    deps?.toast('neutral', C.cancelled);
    return;
  }
  if (job.state !== 'completed') {
    const step = transcribeStepJob(job, jobs);
    if (step && awaitingDecision(step)) return report(videoId, decisionProblem(step));
    // Transcription finished without writing a document: there is no audio track, or no speech was heard (this step is recorded as failed).
    if (step?.state === 'completed' && !step.result?.documentId) return report(videoId, silence(step));
    return report(videoId, {
      kind: 'failed',
      title: job.state === 'interrupted' ? C.interrupted : C.failed,
      message: jobErrorText(job.error) ?? '',
      // The parent task's kind is `pipeline`, so the remedy is looked up by the transcribe step (credential and model pack problems go to the model page).
      remedy: jobRemedy({ kind: 'transcribe', providerId: job.providerId, error: job.error }),
    });
  }
  const captions = (job.pipeline?.summary as Partial<TranscribeSummary> | null | undefined)?.captions;
  if (!captions || captions.status === 'disabled') return leavePending(run);
  if (captions.status === 'empty') return report(videoId, { kind: 'empty', title: C.noSpeechTitle, message: C.noSpeech, remedy: null });
  if (captions.status === 'not-on-timeline') {
    return report(videoId, { kind: 'empty', title: C.offTimelineTitle, message: C.offTimeline, remedy: null });
  }
  if (captions.documentId) focusDocument(videoId, captions.documentId);
  if (captions.status !== 'created') return;
  const bound = deps;
  const count = captions.cueCount ?? 0;
  const transactionId = captions.transactionId;
  // Undo applies to the video open in the editor; it isn't offered if the video has changed.
  const here = useVideo.getState().video?.videoId === videoId;
  bound?.toast(
    'positive',
    captions.enabled === false ? C.createdShelved(count) : C.created(count),
    transactionId && here ? () => void bound.runtime.videos.undo({ transaction: transactionId }) : undefined,
  );
}

function report(videoId: Id, problem: TranscribeProblem): void {
  useSubtitleRun.setState((s) => ({ problems: { ...s.problems, [videoId]: problem } }));
}

function silence(job: JobRecord): TranscribeProblem {
  const noAudio = job.warnings.some((warning) => warning.code === 'no-audio-track');
  return { kind: 'empty', title: noAudio ? C.noAudioTitle : C.noSpeechTitle, message: noAudio ? C.noAudio : C.noSpeech, remedy: null };
}

/**
 * When the Runtime writes a `speech` document (translation is `translation`), it advances the video version. Wait for that document to appear in the snapshot before submitting; otherwise submitting with the old version is treated as a conflict.
 * Returns false if it never appears (the video changed, or was reopened).
 */
export function waitForDocument(videoId: Id, documentId: Id, ms = 10_000): Promise<boolean> {
  const ready = () => {
    const video = useVideo.getState().video;
    return video?.videoId === videoId && !!video.state?.video.documents[documentId];
  };
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const stop = useVideo.subscribe(() => {
      if (!ready()) return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, ms);
  });
}

/** The transcript is already in the video, but this round generated no subtitles: leave a line saying so; “Generate subtitles” will take the path that uses the existing transcript. */
function leavePending(run: TranscribeRun, message: string = C.pending): void {
  endRun(run.videoId, { kind: 'pending', title: C.pendingTitle, message, remedy: null });
  if (useVideo.getState().video?.videoId !== run.videoId) deps?.toast('neutral', C.otherVideo(run.assetName));
}

async function writeCaptions(run: TranscribeRun, speechDocumentId: Id): Promise<void> {
  const bound = deps;
  if (!bound) return endRun(run.videoId);
  const { videoId, assetId } = run;
  try {
    if (!(await waitForDocument(videoId, speechDocumentId))) return leavePending(run);
    const content = await bound.runtime.readDocument(videoId, speechDocumentId);
    const speech = readSpeechWords(content.body);
    if (!speech) return endRun(videoId, { kind: 'failed', title: C.writeFailedTitle, message: C.badSpeech, remedy: null });
    if (!speech.words.length) return endRun(videoId, { kind: 'empty', title: C.noSpeechTitle, message: C.noSpeech, remedy: null });
    const video = useVideo.getState().video;
    const snapshot = video?.videoId === videoId && canEdit(video) ? video.state!.video : null;
    const sequence = snapshot ? rootSequence(snapshot) : null;
    if (!sequence) return leavePending(run);
    // Subtitles are cut on the asset clock. When no word can be projected onto the timeline (the asset trimmed away the speech), nothing is written.
    const placed = projectSpeech(sequence, assetId, speech.words);
    if (!placed.length) return endRun(videoId, { kind: 'empty', title: C.offTimelineTitle, message: C.offTimeline, remedy: null });
    const cues = deriveCues(speech.words);
    const shown = new Set(placed.map((word) => word.id));
    const visible = cues.filter((cue) => cue.wordIds.some((id) => shown.has(id))).length;
    const body = speechCaptionBody(cues, speech.speakers);
    const language =
      content.document.language ??
      guessLanguage(
        cues
          .slice(0, 30)
          .map((cue) => cue.text)
          .join(''),
      );
    const operations = speechCaptionOperations(sequence, body, {
      name: baseName(run.assetName),
      ...(language ? { language } : {}),
      speechDocumentId,
      speechRevision: content.revision,
      assetId,
      trackName: C.trackName,
    });
    // On failure the editor has already shown the engine's own words. The transcript is still in the video, so leave a note on how to continue.
    const receipt = await bound.runtime.videos.apply(withNewCaptionStyle(operations, newCaptionStyle()), EditLabel.generateSubtitles());
    if (!receipt) return endRun(videoId, { kind: 'failed', title: C.writeFailedTitle, message: C.pending, remedy: null });
    const documentId = receipt.refs?.['speech-caption'];
    useSubtitleRun.setState((s) => ({
      runs: without(s.runs, videoId),
      focus: documentId ? { ...s.focus, [videoId]: documentId } : s.focus,
    }));
    const from = placed[0]!.start;
    const to = Math.max(...placed.map((word) => word.end));
    bound.toast('positive', C.generated(visible, formatClock(from), formatClock(to)), () => {
      void bound.runtime.videos.undo({ transaction: receipt.transactionId });
    });
  } catch (error) {
    leavePending(run, E.thenNext(error instanceof Error ? error.message : String(error), C.pending));
  }
}
