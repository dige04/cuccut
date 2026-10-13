import { create } from 'zustand';
import { type Id, type JobRecord, type SpeakersSummary, type TransactionReceipt, type UndoTarget } from '@cuccut/protocol';
import { changedNames } from '../../model/speakers-proposal.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { SPEAKERS_COPY as C } from './speakers-copy.ts';
import { jobErrorText } from '../../model/localized-text.ts';

/**
 * Tools page › Identify speakers (prototype panel-aitools-flows.jsx `SpeakerFlow`, architecture design §6.6): submits `pipelines.start` (`speakers`) and follows the parent task through the `jobs` topic. When it completes, the parent task's `pipeline.summary` is the proposal (not yet written into the video), which goes to the confirm page. After names are changed on the confirm page,
 * “apply” goes through `edits.applySpeakers` (one edit transaction). On the receipt, undo and redo both act on whole transactions (undoing that undo is the redo).
 *
 * State lives in a module-level store (same as translate-run.ts). The Tools page may be closed or switched to another panel, and identification must not drop because of that; the confirm page also remains.
 * If the “speaker diarization” model pack is not installed, the settings page opens the download first. After the download task completes, identification starts automatically here (`awaitInstall`).
 */

export type SpeakersRunStatus = 'submitting' | 'running';

export interface SpeakersRun {
  videoId: Id;
  /** Null until the submission succeeds. */
  jobId: Id | null;
  status: SpeakersRunStatus;
  /** The task's `updatedAt` on retry: if the mirror still holds the record for the already-finished run, do not finalize (same as translate-run.ts). */
  retriedAt: string | null;
}

/** Confirm page: the identification result and the names the user has edited. */
export interface SpeakersProposal {
  videoId: Id;
  jobId: Id;
  summary: SpeakersSummary;
  /** Speaker ID → edited name (exactly as typed in the input). */
  names: Record<Id, string>;
  applying: boolean;
}

/** Receipt after applying. */
export interface SpeakersReceipt {
  videoId: Id;
  jobId: Id;
  summary: SpeakersSummary;
  names: Record<Id, string>;
  /** The transaction for apply (or redo); null when there is no change to undo (no undo offered). */
  transactionId: Id | null;
  /** Undoes that transaction: redo is undoing it. */
  undoTransactionId: Id | null;
  undone: boolean;
  busy: boolean;
}

export type SpeakersProblemKind = 'failed' | 'decide' | 'apply';

export interface SpeakersProblem {
  kind: SpeakersProblemKind;
  title: string;
  message: string;
  /** Tasks that can be re-run from the step where they stopped (`pipelines.retry`). */
  retryJobId: Id | null;
  /** The one background task that needs a human decision. */
  taskId: Id | null;
}

interface SpeakersRunState {
  runs: Record<Id, SpeakersRun>;
  proposals: Record<Id, SpeakersProposal>;
  receipts: Record<Id, SpeakersReceipt>;
  problems: Record<Id, SpeakersProblem>;
  /** Videos waiting for the model pack to finish downloading before starting → the download task. */
  installs: Record<Id, Id>;
}

const EMPTY: SpeakersRunState = { runs: {}, proposals: {}, receipts: {}, problems: {}, installs: {} };

export const useSpeakersRun = create<SpeakersRunState>()(() => ({ ...EMPTY }));

export const SPEAKERS_PIPELINE = 'speakers';

/** Session capabilities used; tests supply fakes. */
export interface SpeakersDeps {
  runtime: {
    startPipeline(pipeline: string, params: Record<string, unknown>): Promise<Id>;
    retryPipeline(jobId: Id): Promise<void>;
    cancelJob(jobId: Id): Promise<void>;
    videos: {
      applySpeakers(jobId: Id, names?: Record<Id, string>): Promise<TransactionReceipt | null>;
      undo(target: UndoTarget): Promise<TransactionReceipt | null>;
    };
  };
  toast(kind: 'positive' | 'neutral' | 'negative', message: string): void;
}

let deps: SpeakersDeps | null = null;
let unwatch: (() => void) | null = null;

/** Binds the session and prompt when the Tools page mounts; on the first binding, starts watching the `jobs` topic. */
export function bindSpeakers(next: SpeakersDeps): void {
  deps = next;
  unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
}

/** For tests: unbinds and clears state. */
export function resetSpeakers(): void {
  unwatch?.();
  unwatch = null;
  deps = null;
  useSpeakersRun.setState({ ...EMPTY });
}

const without = <T>(record: Record<Id, T>, key: Id): Record<Id, T> => {
  const { [key]: _, ...rest } = record;
  return rest;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function patch<K extends 'proposals' | 'receipts'>(key: K, videoId: Id, change: Partial<SpeakersRunState[K][Id]>): void {
  useSpeakersRun.setState((s) => {
    const current = s[key][videoId];
    return current ? ({ [key]: { ...s[key], [videoId]: { ...current, ...change } } } as Partial<SpeakersRunState>) : {};
  });
}

function endRun(videoId: Id, problem?: SpeakersProblem): void {
  useSpeakersRun.setState((s) => ({
    runs: without(s.runs, videoId),
    problems: problem ? { ...s.problems, [videoId]: problem } : s.problems,
  }));
}

export function dismissSpeakersProblem(videoId: Id): void {
  useSpeakersRun.setState((s) => ({ problems: without(s.problems, videoId) }));
}

/** “done” on the receipt and “discard” on the confirm page return to the settings state. */
export function closeSpeakers(videoId: Id): void {
  useSpeakersRun.setState((s) => ({ proposals: without(s.proposals, videoId), receipts: without(s.receipts, videoId) }));
}

/** Starts identification (`documentId`: which transcript to use when the video has several). Only one run per video at a time. */
export async function startSpeakers(videoId: Id, documentId?: Id): Promise<boolean> {
  const bound = deps;
  if (!bound || useSpeakersRun.getState().runs[videoId]) return false;
  useSpeakersRun.setState((s) => ({
    runs: { ...s.runs, [videoId]: { videoId, jobId: null, status: 'submitting', retriedAt: null } },
    proposals: without(s.proposals, videoId),
    receipts: without(s.receipts, videoId),
    problems: without(s.problems, videoId),
    installs: without(s.installs, videoId),
  }));
  try {
    const jobId = await bound.runtime.startPipeline(SPEAKERS_PIPELINE, { videoId, ...(documentId ? { documentId } : {}) });
    useSpeakersRun.setState((s) =>
      s.runs[videoId] ? { runs: { ...s.runs, [videoId]: { ...s.runs[videoId]!, jobId, status: 'running' } } } : {},
    );
    // Task events may arrive before the receipt.
    settle(useJobs.getState().jobs);
    return true;
  } catch (error) {
    endRun(videoId, { kind: 'failed', title: C.submitFailed, message: messageOf(error), retryJobId: null, taskId: null });
    return false;
  }
}

/** The model pack's download task was submitted: once it finishes (`completed`), identification starts; if it fails or is cancelled, it does not start (the download's own notice states the reason). */
export function awaitInstall(videoId: Id, installJobId: Id): void {
  useSpeakersRun.setState((s) => ({ installs: { ...s.installs, [videoId]: installJobId }, problems: without(s.problems, videoId) }));
  settle(useJobs.getState().jobs);
}

/** Re-runs the same task from the step where it stopped (`pipelines.retry`). */
export async function retrySpeakers(videoId: Id): Promise<void> {
  const bound = deps;
  const jobId = useSpeakersRun.getState().problems[videoId]?.retryJobId;
  if (!bound || !jobId || useSpeakersRun.getState().runs[videoId]) return;
  const before = useJobs.getState().jobs.find((job) => job.jobId === jobId);
  useSpeakersRun.setState((s) => ({
    runs: { ...s.runs, [videoId]: { videoId, jobId, status: 'submitting', retriedAt: null } },
    problems: without(s.problems, videoId),
  }));
  try {
    await bound.runtime.retryPipeline(jobId);
    useSpeakersRun.setState((s) =>
      s.runs[videoId]
        ? { runs: { ...s.runs, [videoId]: { ...s.runs[videoId]!, status: 'running', retriedAt: before?.updatedAt ?? null } } }
        : {},
    );
  } catch (error) {
    endRun(videoId, { kind: 'failed', title: C.failed, message: messageOf(error), retryJobId: jobId, taskId: null });
  }
}

export async function cancelSpeakers(jobId: Id): Promise<void> {
  try {
    await deps?.runtime.cancelJob(jobId);
  } catch (error) {
    deps?.toast('negative', C.cancelFailed(messageOf(error)));
  }
}

/** Watches the tasks submitted from here and the pending downloads, and finalizes when they end. Each round finalizes only once: the state is changed synchronously first. */
function settle(jobs: readonly JobRecord[]): void {
  const state = useSpeakersRun.getState();
  for (const run of Object.values(state.runs)) {
    if (run.status !== 'running' || !run.jobId) continue;
    const job = jobs.find((candidate) => candidate.jobId === run.jobId);
    if (!job || isJobLive(job)) continue;
    if (run.retriedAt !== null && job.updatedAt === run.retriedAt) continue;
    finish(run, job);
  }
  for (const [videoId, installJobId] of Object.entries(state.installs)) {
    const job = jobs.find((candidate) => candidate.jobId === installJobId);
    if (!job || isJobLive(job)) continue;
    useSpeakersRun.setState((s) => ({ installs: without(s.installs, videoId) }));
    if (job.state === 'completed') void startSpeakers(videoId);
  }
}

function isSummary(value: unknown): value is SpeakersSummary {
  const s = value as Partial<SpeakersSummary> | null | undefined;
  return !!s && Array.isArray(s.speakers) && typeof s.timescale === 'number' && typeof s.proposalArtifactId === 'string';
}

function finish(run: SpeakersRun, job: JobRecord): void {
  const { videoId } = run;
  if (job.state === 'cancelled') {
    endRun(videoId);
    deps?.toast('neutral', C.cancelled);
    return;
  }
  if (job.state === 'needs-reconciliation') {
    endRun(videoId, { kind: 'decide', title: C.failed, message: jobErrorText(job.error) ?? '', retryJobId: null, taskId: job.jobId });
    return;
  }
  if (job.state !== 'completed') {
    endRun(videoId, {
      kind: 'failed',
      title: job.state === 'interrupted' ? C.interrupted : C.failed,
      message: jobErrorText(job.error) ?? '',
      retryJobId: job.jobId,
      taskId: null,
    });
    return;
  }
  const summary = job.pipeline?.summary;
  if (!isSummary(summary)) {
    endRun(videoId, { kind: 'failed', title: C.failed, message: C.badResult, retryJobId: null, taskId: null });
    return;
  }
  useSpeakersRun.setState((s) => ({
    runs: without(s.runs, videoId),
    proposals: { ...s.proposals, [videoId]: { videoId, jobId: job.jobId, summary, names: {}, applying: false } },
  }));
}

/** Rename on the confirm page (exactly as typed in the input; leading and trailing whitespace is trimmed on submit, and an empty name is not submitted). */
export function renameSpeaker(videoId: Id, speakerId: Id, name: string): void {
  const proposal = useSpeakersRun.getState().proposals[videoId];
  if (proposal) patch('proposals', videoId, { names: { ...proposal.names, [speakerId]: name } });
}

/**
 * Apply (`edits.applySpeakers`). On failure (most likely the script or translation was changed after identification), the proposal is dropped and a reason is left, and the settings page offers “run again”.
 * The editor also shows the engine's or Runtime's original message as usual.
 */
export async function applySpeakers(videoId: Id): Promise<boolean> {
  const bound = deps;
  const proposal = useSpeakersRun.getState().proposals[videoId];
  if (!bound || !proposal || proposal.applying) return false;
  patch('proposals', videoId, { applying: true });
  const receipt = await bound.runtime.videos.applySpeakers(proposal.jobId, changedNames(proposal.summary.speakers, proposal.names));
  if (!receipt) {
    const reason = useVideo.getState().video?.commandError?.message ?? '';
    useSpeakersRun.setState((s) => ({
      proposals: without(s.proposals, videoId),
      problems: {
        ...s.problems,
        [videoId]: { kind: 'apply', title: C.applyFailed, message: reason || C.applyStale, retryJobId: null, taskId: null },
      },
    }));
    return false;
  }
  useSpeakersRun.setState((s) => ({
    proposals: without(s.proposals, videoId),
    receipts: {
      ...s.receipts,
      [videoId]: {
        videoId,
        jobId: proposal.jobId,
        summary: proposal.summary,
        names: proposal.names,
        transactionId: receipt.undo.available ? receipt.transactionId : null,
        undoTransactionId: null,
        undone: false,
        busy: false,
      },
    },
  }));
  return true;
}

/** “undo” on the receipt: undoes the apply (or redo) transaction. */
export async function undoSpeakers(videoId: Id): Promise<void> {
  const bound = deps;
  const receipt = useSpeakersRun.getState().receipts[videoId];
  if (!bound || !receipt?.transactionId || receipt.undone || receipt.busy) return;
  patch('receipts', videoId, { busy: true });
  const result = await bound.runtime.videos.undo({ transaction: receipt.transactionId });
  if (!result) {
    patch('receipts', videoId, { busy: false });
    bound.toast('negative', C.undoFailed);
    return;
  }
  patch('receipts', videoId, { busy: false, undone: true, undoTransactionId: result.transactionId });
}

/** “redo” on the receipt: undoes that undo. */
export async function redoSpeakers(videoId: Id): Promise<void> {
  const bound = deps;
  const receipt = useSpeakersRun.getState().receipts[videoId];
  if (!bound || !receipt?.undoTransactionId || !receipt.undone || receipt.busy) return;
  patch('receipts', videoId, { busy: true });
  const result = await bound.runtime.videos.undo({ transaction: receipt.undoTransactionId });
  if (!result) {
    patch('receipts', videoId, { busy: false });
    bound.toast('negative', C.redoFailed);
    return;
  }
  patch('receipts', videoId, { busy: false, undone: false, undoTransactionId: null, transactionId: result.transactionId });
}
