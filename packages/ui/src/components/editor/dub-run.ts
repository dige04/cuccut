import { create } from 'zustand';
import {
  RpcError,
  type CapabilityNotConfiguredDetails,
  type DocumentContent,
  type DubParams,
  type DubSummary,
  type EditOperation,
  type Grant,
  type GrantCreateParams,
  type Id,
  type JobRecord,
  type Localized,
  type TransactionReceipt,
  type UndoTarget,
} from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { langName } from '../../model/tools-models.ts';
import { dubFailureFacts, dubRemedy, dubRetryNote, dubSummaryOf, dubWarnings, type DubFailureFacts } from '../../model/dub-progress.ts';
import { grantPurpose, grantRefusal, grantRequest, refusalKey, type GrantRefusal } from '../../model/dub-setup.ts';
import { fallbackUndoOperations, mutedItemsOf, planTransaction } from '../../model/dub-undo.ts';
import { rootSequence } from '../../model/editor.ts';
import { rejectionRemedy, type Remedy } from '../../model/task-facts.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { DUB_COPY as C } from './dub-copy.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { jobErrorText, remedyHintText } from '../../model/localized-text.ts';

/**
 * Tool page › running state of translated voice-over (design panel-dub.jsx progress, issues and receipts): submits `pipelines.start` (`dub`) and follows the parent task through the `jobs` topic. On completion the Runtime has already written the dub group into the video in one transaction, so here we only read the summary and leave a receipt with “Undo this dub”.
 *
 * - Authorization: when the first dub is refused with `GRANT_REQUIRED` / `GRANT_REVOKED` (`forbidden`), no error is raised; a “question” card is left instead. Only after the user confirms in the dialog, having seen clearly what goes out, to whom, limited to which video, and for what purpose, is `grants.create` sent, and on success the same parameters are resubmitted. When translation and synthesis go to different providers, it can be refused twice in a row (different recipients), with a question asked each time. If the same recipient and the same data were already sent and still refused, it stops with an error instead of looping.
 *   - Failure or interruption: gives the reason, the remedy, and “Retry” (`pipelines.retry`, which resumes the same task from the step where it stopped). A retry can also be refused for authorization, and is asked the same way.
 *   - Undo: prefers undoing the operation that applied the dub (`videos.undo`); when that is not possible (it was edited afterwards), falls back to partial undo (model/dub-undo.ts).
 *
 * State lives in a module-level store (same as translate-run.ts): leaving this page, going to settings to grant authorization, or going to the model page to configure a provider does not disconnect the dub.
 * No automatic retry: rerunning calls the online model again.
 */

export type DubRunStatus = 'submitting' | 'running' | 'settling';

/** The settings at start: wrap-up, questions and retries follow them. */
export interface DubIntent {
  videoId: Id;
  /** The language dubbed into (BCP 47). */
  language: string;
  /** The video's name: used in the authorization purpose and the confirmation dialog. */
  videoName: string | null;
}

export interface DubRun extends DubIntent {
  /** Null until submit succeeds (during a retry, it is that task). */
  jobId: Id | null;
  status: DubRunStatus;
  /** During a retry, the task's `updatedAt`: when the mirror still has the already-ended record, do not wrap up (same as translate-run.ts). */
  retriedAt: string | null;
}

/** What to do after an authorization refusal: restart with the same parameters, or retry the same task. */
export type DubResume = { kind: 'start'; params: DubParams; intent: DubIntent } | { kind: 'retry'; jobId: Id; intent: DubIntent };

export interface DubAsk {
  refusal: GrantRefusal;
  /** The purpose of the authorization (written as is in the confirmation dialog; sent as is with `grants.create`). */
  purpose: string;
  resume: DubResume;
  /** The (recipient + data kind) pairs already sent in this chain: stop when one was sent and is still refused. */
  granted: string[];
  status: 'asking' | 'granting';
  error: string | null;
}

export type DubProblemKind = 'not-configured' | 'failed';

export interface DubProblem {
  kind: DubProblemKind;
  title: string;
  message: string;
  remedy: Remedy | null;
  /** A flow that can be retried: the same task; `note` says whether a retry would spend money again on what was already done. */
  retry: { jobId: Id; note: 'charges' | 'partial' | 'free' | null; intent: DubIntent } | null;
  /** Per-sentence facts (which sentences were not synthesized, and why). */
  facts: DubFailureFacts | null;
}

/** The receipt after a dub completes: one AI run always leaves an undoable exit when it ends. */
export interface DubReceipt {
  jobId: Id;
  videoId: Id;
  summary: DubSummary;
  /** The ducking amount when `duck` (from the frozen params). */
  duckDb: number | null;
  warnings: Array<{ code: string; title: string; detail: string }>;
  /** Whether the operation was undone (`full`), or could not be and fell back to partial undo (`partial`). */
  undone: 'full' | 'partial' | null;
  undoing: boolean;
}

/** Before starting, downloads the separation model first (design panel-dub.jsx “Download model and…”): when the download task ends, starts with `resume`; if it did not install properly, does not start. */
export interface DubInstallWait {
  jobId: Id;
  resume: Extract<DubResume, { kind: 'start' }>;
}

interface DubRunState {
  runs: Record<Id, DubRun>;
  problems: Record<Id, DubProblem>;
  asks: Record<Id, DubAsk>;
  receipts: Record<Id, DubReceipt>;
  installs: Record<Id, DubInstallWait>;
}

const EMPTY: DubRunState = { runs: {}, problems: {}, asks: {}, receipts: {}, installs: {} };

export const useDubRun = create<DubRunState>()(() => ({ ...EMPTY }));

/** The session capabilities used; tests supply fakes. */
export interface DubDeps {
  runtime: {
    startDub(params: DubParams): Promise<Id>;
    createGrant(params: GrantCreateParams): Promise<Grant>;
    retryPipeline(jobId: Id): Promise<void>;
    cancelJob(jobId: Id): Promise<void>;
    readDocument(videoId: Id, documentId: Id, revision?: string): Promise<DocumentContent>;
    videos: {
      apply(operations: EditOperation[], label?: Localized): Promise<TransactionReceipt | null>;
      undo(target: UndoTarget): Promise<TransactionReceipt | null>;
      clearError(): void;
    };
  };
  /** When `undo` has a value, the notice has “Undo”. */
  toast(kind: 'positive' | 'neutral' | 'negative', message: string, undo?: () => void): void;
}

let deps: DubDeps | null = null;
let unwatch: (() => void) | null = null;

/** When the tool page mounts, binds the session and the notices; on the first binding, starts watching the `jobs` topic. */
export function bindDub(next: DubDeps): void {
  deps = next;
  unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
}

/** For tests: unbinds and clears state. */
export function resetDub(): void {
  unwatch?.();
  unwatch = null;
  deps = null;
  useDubRun.setState({ ...EMPTY });
}

const without = <T>(record: Record<Id, T>, key: Id): Record<Id, T> => {
  const { [key]: _, ...rest } = record;
  return rest;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function setRun(run: DubRun): void {
  useDubRun.setState((s) => ({
    runs: { ...s.runs, [run.videoId]: run },
    problems: without(s.problems, run.videoId),
    asks: without(s.asks, run.videoId),
  }));
}

function patchRun(videoId: Id, patch: Partial<DubRun>): void {
  useDubRun.setState((s) => (s.runs[videoId] ? { runs: { ...s.runs, [videoId]: { ...s.runs[videoId]!, ...patch } } } : {}));
}

function endRun(videoId: Id, problem?: DubProblem): void {
  useDubRun.setState((s) => ({
    runs: without(s.runs, videoId),
    problems: problem ? { ...s.problems, [videoId]: problem } : s.problems,
  }));
}

function ask(videoId: Id, next: DubAsk): void {
  useDubRun.setState((s) => ({ runs: without(s.runs, videoId), problems: without(s.problems, videoId), asks: { ...s.asks, [videoId]: next } }));
}

function patchAsk(videoId: Id, patch: Partial<DubAsk>): void {
  useDubRun.setState((s) => (s.asks[videoId] ? { asks: { ...s.asks, [videoId]: { ...s.asks[videoId]!, ...patch } } } : {}));
}

function patchReceipt(videoId: Id, patch: Partial<DubReceipt>): void {
  useDubRun.setState((s) => (s.receipts[videoId] ? { receipts: { ...s.receipts, [videoId]: { ...s.receipts[videoId]!, ...patch } } } : {}));
}

export function dismissDubProblem(videoId: Id): void {
  useDubRun.setState((s) => ({ problems: without(s.problems, videoId) }));
}

export function dismissDubReceipt(videoId: Id): void {
  useDubRun.setState((s) => ({ receipts: without(s.receipts, videoId) }));
}

function isNotConfigured(details: unknown): details is CapabilityNotConfiguredDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { code?: unknown }).code === 'CAPABILITY_NOT_CONFIGURED' &&
    typeof (details as { remedy?: unknown }).remedy === 'object'
  );
}

/** When a submit is rejected (not an authorization refusal): if no speech synthesis or text model is configured, shows `remedy.hint` in place along with the path to the model page; otherwise passes the original message through. */
export function dubSubmitProblem(error: unknown, retry: DubProblem['retry'] = null): DubProblem {
  const message = messageOf(error);
  const details = error instanceof RpcError ? error.details : (error as { details?: unknown } | null)?.details;
  if (isNotConfigured(details)) {
    const kind = details.remedy.capability === 'generateText' ? 'generateText' : 'synthesizeSpeech';
    return {
      kind: 'not-configured',
      title: C.notConfigured,
      message: remedyHintText(details.remedy) || message,
      remedy: rejectionRemedy(kind, error),
      retry,
      facts: null,
    };
  }
  return { kind: 'failed', title: retry ? C.failed : C.submitFailed, message: retry ? C.retryFailed(message) : message, remedy: null, retry, facts: null };
}

/**
 * Submit (start or retry). A refusal for authorization is turned into a question (if the same recipient and the same data were sent and are still refused, an error is raised instead). On success, returns the task ID.
 * `granted` is the authorizations already sent in this chain.
 */
async function submit(resume: DubResume, granted: readonly string[]): Promise<Id | null> {
  const bound = deps;
  const { intent } = resume;
  const { videoId } = intent;
  if (!bound) return null;
  const before = resume.kind === 'retry' ? useJobs.getState().jobs.find((job) => job.jobId === resume.jobId) : undefined;
  setRun({ ...intent, jobId: resume.kind === 'retry' ? resume.jobId : null, status: 'submitting', retriedAt: null });
  try {
    if (resume.kind === 'start') {
      const jobId = await bound.runtime.startDub(resume.params);
      patchRun(videoId, { jobId, status: 'running' });
      // A task event may arrive before the receipt; this is a new task, so the mirror has no old ended record of it.
      settle(useJobs.getState().jobs);
      return jobId;
    }
    await bound.runtime.retryPipeline(resume.jobId);
    patchRun(videoId, { status: 'running', retriedAt: before?.updatedAt ?? null });
    return resume.jobId;
  } catch (error) {
    const retry = resume.kind === 'retry' ? { jobId: resume.jobId, note: before ? dubRetryNote(before) : null, intent } : null;
    const refusal = grantRefusal(error);
    if (refusal && !granted.includes(refusalKey(refusal))) {
      ask(videoId, { refusal, purpose: grantPurpose(intent.language, intent.videoName), resume, granted: [...granted], status: 'asking', error: null });
      return null;
    }
    if (refusal) {
      endRun(videoId, { kind: 'failed', title: C.grantStillRefused, message: refusal.message, remedy: null, retry, facts: null });
      return null;
    }
    endRun(videoId, dubSubmitProblem(error, retry));
    return null;
  }
}

/** Starts voice-over dubbing. Only one dub per video at a time (two groups would fight over the same original sentences' muting and ducking). Returns the task ID on success. */
export async function startDub(params: DubParams, intent: DubIntent): Promise<Id | null> {
  if (!deps || useDubRun.getState().runs[intent.videoId]) return null;
  useDubRun.setState((s) => ({ receipts: without(s.receipts, intent.videoId) }));
  return submit({ kind: 'start', params, intent }, []);
}

/**
 * The separation model's download task was submitted: when it completes (`completed`), dubbing starts with the same parameters; on failure or cancel, it does not start, and a notice says so (the download's own notice gives the reason).
 * Staying on this page while waiting does not disconnect it (same as `awaitInstall` in speakers-run.ts).
 */
export function awaitDubInstall(installJobId: Id, params: DubParams, intent: DubIntent): void {
  const wait: DubInstallWait = { jobId: installJobId, resume: { kind: 'start', params, intent } };
  useDubRun.setState((s) => ({ installs: { ...s.installs, [intent.videoId]: wait }, problems: without(s.problems, intent.videoId) }));
  settle(useJobs.getState().jobs);
}

/**
 * The user pressed “Grant and continue” in the confirmation dialog: sends `grants.create` (limited to this video, per use, amount unknown), and on success starts or retries. If granting fails, the question stays open and the reason is written there. Returns the newly started task ID (during a retry, the original task).
 */
export async function confirmGrant(videoId: Id): Promise<Id | null> {
  const bound = deps;
  const current = useDubRun.getState().asks[videoId];
  if (!bound || !current || current.status === 'granting' || useDubRun.getState().runs[videoId]) return null;
  patchAsk(videoId, { status: 'granting', error: null });
  try {
    await bound.runtime.createGrant(grantRequest(current.refusal, videoId, current.purpose));
  } catch (error) {
    patchAsk(videoId, { status: 'asking', error: C.grantFailed(messageOf(error)) });
    return null;
  }
  return submit(current.resume, [...current.granted, refusalKey(current.refusal)]);
}

/** Do not grant: closes the question. If it was a refused retry, “Retry” is kept. */
export function dismissAsk(videoId: Id): void {
  const current = useDubRun.getState().asks[videoId];
  useDubRun.setState((s) => ({ asks: without(s.asks, videoId) }));
  const resume = current?.resume;
  if (!current || resume?.kind !== 'retry') return;
  const job = useJobs.getState().jobs.find((j) => j.jobId === resume.jobId);
  const problem: DubProblem = {
    kind: 'failed',
    title: C.failed,
    message: current.refusal.message,
    remedy: null,
    retry: { jobId: resume.jobId, note: job ? dubRetryNote(job) : null, intent: resume.intent },
    facts: null,
  };
  useDubRun.setState((s) => ({ problems: { ...s.problems, [videoId]: problem } }));
}

/** Reruns the same task from the step where it stopped (`pipelines.retry`). */
export async function retryDub(videoId: Id): Promise<void> {
  const retry = useDubRun.getState().problems[videoId]?.retry;
  if (!deps || !retry || useDubRun.getState().runs[videoId]) return;
  await submit({ kind: 'retry', jobId: retry.jobId, intent: retry.intent }, []);
}

export async function cancelDub(jobId: Id): Promise<void> {
  try {
    await deps?.runtime.cancelJob(jobId);
  } catch (error) {
    deps?.toast('negative', C.cancelFailed(messageOf(error)));
  }
}

/** Watches the tasks submitted from here and the pending download: wraps up when they end. Each round is wrapped up only once: the state is changed synchronously first, so later events that see it is no longer `running` skip it. */
function settle(jobs: readonly JobRecord[]): void {
  for (const run of Object.values(useDubRun.getState().runs)) {
    if (run.status !== 'running' || !run.jobId) continue;
    const job = jobs.find((candidate) => candidate.jobId === run.jobId);
    if (!job || isJobLive(job)) continue;
    if (run.retriedAt !== null && job.updatedAt === run.retriedAt) continue;
    patchRun(run.videoId, { status: 'settling' });
    finish({ ...run, status: 'settling' }, job);
  }
  for (const [videoId, wait] of Object.entries(useDubRun.getState().installs)) {
    const job = jobs.find((candidate) => candidate.jobId === wait.jobId);
    if (!job || isJobLive(job)) continue;
    useDubRun.setState((s) => ({ installs: without(s.installs, videoId) }));
    if (job.state === 'completed') void startDub(wait.resume.params, wait.resume.intent);
    else deps?.toast(job.state === 'cancelled' ? 'neutral' : 'negative', C.separateDownloadStopped);
  }
}

function finish(run: DubRun, job: JobRecord): void {
  const intent: DubIntent = { videoId: run.videoId, language: run.language, videoName: run.videoName };
  const label = langName(run.language);
  if (job.state === 'cancelled') {
    endRun(run.videoId);
    deps?.toast('neutral', C.cancelled);
    return;
  }
  if (job.state !== 'completed') {
    // Authorization revoked or expired midway through the run: the same question is asked; after confirmation, it retries.
    const refusal = grantRefusal(job.error);
    if (refusal) {
      ask(run.videoId, {
        refusal,
        purpose: grantPurpose(run.language, run.videoName),
        resume: { kind: 'retry', jobId: job.jobId, intent },
        granted: [],
        status: 'asking',
        error: null,
      });
      return;
    }
    const retryable = job.state === 'failed' || job.state === 'interrupted';
    endRun(run.videoId, {
      kind: 'failed',
      title: job.state === 'interrupted' ? C.interrupted : C.failed,
      message: jobErrorText(job.error) ?? '',
      remedy: dubRemedy(job),
      retry: retryable ? { jobId: job.jobId, note: dubRetryNote(job), intent } : null,
      facts: dubFailureFacts(job),
    });
    return;
  }
  const summary = dubSummaryOf(job);
  if (!summary) {
    endRun(run.videoId, { kind: 'failed', title: C.failed, message: jobErrorText(job.error) ?? '', remedy: null, retry: null, facts: null });
    return;
  }
  const duck = job.pipeline?.params.duckDb;
  const receipt: DubReceipt = {
    jobId: job.jobId,
    videoId: run.videoId,
    summary,
    duckDb: typeof duck === 'number' ? duck : null,
    warnings: dubWarnings(job),
    undone: null,
    undoing: false,
  };
  useDubRun.setState((s) => ({ runs: without(s.runs, run.videoId), receipts: { ...s.receipts, [run.videoId]: receipt } }));
  deps?.toast('positive', C.doneToast(label, summary.units.placed), () => void undoDub(run.videoId));
}

/**
 * “Undo this dub” on the receipt: first undoes the operation that applied the dub (the `createdBy` of the earliest version of the dub plan document, read from the snapshot at undo time). If that cannot be undone (edited afterwards: `UNDO_CONFLICT`; already undone: `UNDO_UNAVAILABLE`), falls back to partial undo: one transaction deletes this group's instances, restores the clips that were muted this time, and removes the ducking triggered by the dub track (the muted items are recorded in the dub plan body). After a successful partial undo, the undo-failure error on the editor is cleared.
 */
export async function undoDub(videoId: Id): Promise<void> {
  const bound = deps;
  const receipt = useDubRun.getState().receipts[videoId];
  if (!bound || !receipt || receipt.undone || receipt.undoing) return;
  const snapshotOf = () => {
    const video = useVideo.getState().video;
    return video?.videoId === videoId && canEdit(video) ? video.state!.video : null;
  };
  const first = snapshotOf();
  if (!first) {
    bound.toast('negative', C.undoNotOpen);
    return;
  }
  patchReceipt(videoId, { undoing: true });
  const { summary } = receipt;
  const label = EditLabel.undoDub({ language: summary.language });
  try {
    const transactionId = planTransaction(first.documents[summary.planDocumentId]);
    if (transactionId && (await bound.runtime.videos.undo({ transaction: transactionId }))) {
      patchReceipt(videoId, { undone: 'full', undoing: false });
      return;
    }
    // Falling back to partial undo: work out what is left from the current snapshot.
    const snapshot = snapshotOf();
    const sequence = snapshot
      ? (Object.values(snapshot.sequences).find((s) => s.tracks.some((t) => t.id === summary.trackId)) ?? rootSequence(snapshot))
      : null;
    if (!snapshot || !sequence) {
      bound.toast('negative', C.undoFailed);
      patchReceipt(videoId, { undoing: false });
      return;
    }
    let muted: Id[] = [];
    if (snapshot.documents[summary.planDocumentId]) {
      try {
        muted = mutedItemsOf((await bound.runtime.readDocument(videoId, summary.planDocumentId)).body);
      } catch {
        // The dub plan cannot be read: the muted instances cannot be restored; do the rest.
      }
    }
    const fallback = fallbackUndoOperations(sequence, { groupId: summary.groupId, trackId: summary.trackId }, muted);
    if (fallback.operations.length === 0) {
      // Nothing is left (for example, it was already undone with the editor's undo): the undo-failure notice need not stay up.
      bound.runtime.videos.clearError();
      patchReceipt(videoId, { undone: snapshot.documents[summary.planDocumentId] ? 'partial' : 'full', undoing: false });
      return;
    }
    if (!(await bound.runtime.videos.apply(fallback.operations, label))) {
      bound.toast('negative', C.undoFailed);
      patchReceipt(videoId, { undoing: false });
      return;
    }
    bound.runtime.videos.clearError();
    patchReceipt(videoId, { undone: 'partial', undoing: false });
    bound.toast('neutral', C.undonePartial);
  } catch (error) {
    bound.toast('negative', E.labeled(C.undoFailed, messageOf(error)));
    patchReceipt(videoId, { undoing: false });
  }
}
