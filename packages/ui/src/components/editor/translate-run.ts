import { newCaptionStyle } from '../../state/caption-preferences-store.ts';
import { withNewCaptionStyle } from '../../model/caption-preferences.ts';
import { create } from 'zustand';
import {
  RpcError,
  type CapabilityNotConfiguredDetails,
  type DocumentContent,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type JobRecord,
  type Localized,
  type TransactionReceipt,
  type TranslateParams,
  type TranslateRefreshSummary,
  type TranslateSummary,
  type UndoTarget,
} from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { captionChips, languageName } from '../../model/caption-tracks.ts';
import { rootSequence } from '../../model/editor.ts';
import { readSpeechWords, speechCaptionBody, type SpeechWords } from '../../model/speech-cues.ts';
import { jobRemedy, rejectionRemedy, type Remedy } from '../../model/task-facts.ts';
import { translateParams, type TranslateSetup } from '../../model/translate-setup.ts';
import { retryNote, translationOf } from '../../model/translate-progress.ts';
import { derivedFrom, pairedOriginal, retextCaption, translationCaptionOperations, translationCues } from '../../model/translation-cues.ts';
import {
  editUnit,
  markUnit,
  readTranslation,
  type PairRow,
  type SourceSentence,
  type TranslationBody,
  type TranslationUnit,
} from '../../model/translation-doc.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { focusDocument, waitForDocument } from './transcribe-run.ts';
import { TEXT_NOT_CONFIGURED_REASON, TRANSLATE_COPY as C } from './translate-copy.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { jobErrorText, remedyHintText } from '../../model/localized-text.ts';

/**
 * “Translate to…” in the subtitle panel (prototype panel-aitools-flows.jsx `TranslateFlow`, and the running state and receipt in panel-translate.jsx):
 * submits `pipelines.start` (`translate`, with `captions: true` and the user's `bilingual` choice), and follows the parent job through the `jobs` topic. After the flow writes the `translation` document, it creates this language's caption layer itself (caption-layer.ts in jobs, placed the same way as `translationCaptionOperations`). On completion it leaves a receipt with an “Undo” from `summary.captions` (undoing the flow's caption-layer transaction). On failure or interruption, it gives the reason and a “Retry” (`pipelines.retry`, which resumes the same job from the step where it stopped).
 *
 * The state lives in a module-level store (the same as transcribe-run.ts): the style entry card switches to the properties page, and “go to the Models page” leaves the editor, and translation must not drop because of that.
 * Runs started elsewhere (agents, the CLI) only show progress. A translation without a caption layer is “Put on screen” from the comparison list (`putOnScreen`, done by the editor itself).
 * The flow's parent job will never be `needs-reconciliation` (Runtime marks it `interrupted` on restart), but this still guards against pointing at a background task.
 * No automatic retry: re-running the “Translate” step calls the online model again.
 */

export type TranslateRunStatus = 'submitting' | 'running';

/** The settings at the start of a translation: used to put it on screen when it completes. */
export interface TranslateIntent {
  videoId: Id;
  speechDocumentId: Id;
  targetLanguage: string;
  /** Show alongside the original. */
  bilingual: boolean;
}

export interface TranslateRun extends TranslateIntent {
  /** null until submit succeeds. */
  jobId: Id | null;
  status: TranslateRunStatus;
  /**
   * The task's `updatedAt` at retry. When `pipelines.retry` returns, the mirror may still hold the ended record, and when another task event arrives it must not be taken as this run's result and finalized again. Once the record changes (the re-run has started), this no longer matches.
   */
  retriedAt: string | null;
}

export type TranslateProblemKind = 'not-configured' | 'failed' | 'empty' | 'pending' | 'decide';

export interface TranslateProblem {
  kind: TranslateProblemKind;
  title: string;
  message: string;
  /** Remedies from the Models page, settings, or background tasks. */
  remedy: Remedy | null;
  /** A flow that can be retried: the same task. `note` says whether a retry will be billed again. */
  retry: { jobId: Id; note: 'charges' | 'free' | null; intent: TranslateIntent } | null;
  /** The in-place refresh of this translation failed (both the subtitle panel and the outdated-translation tool page attach it). A new translation has no such issue. */
  refresh?: Id;
}

/** The receipt after a translation is put on screen (prototype `DoneView`): an AI run always leaves an exit that can be undone when it finishes. */
export interface TranslateReceipt {
  /** The transaction that created the caption layer. null when Runtime did not provide one (no “Undo”). */
  transactionId: Id | null;
  language: string;
  translationDocumentId: Id;
  count: number;
  bilingual: boolean;
  undone: boolean;
}

export type CompareMode = 'src' | 'bi' | 'trans';

/** Comparison bar (prototype panel-subtitle.jsx `ListBar`): the list shows the original, the original plus the translation, or the translation only, and which translation it is compared against. */
export interface ComparePref {
  mode: CompareMode;
  /** The `translation` document compared against. null when none is selected (the first one is used). */
  documentId: Id | null;
}

/**
 * In-place refresh of one translation (“Re-translate with model API” in the comparison list, product design §5.10 “sentence-level and outdated translations”): a `translate` flow with `translationId`. It re-translates only the named sentences (when none are named, the outdated and not-yet-translated ones), and writes the result as a new version of the same translation document. In the caption layer only those sentences change. It is tracked per translation, so only one refresh of the same translation runs at a time.
 */
export interface RefreshRun {
  videoId: Id;
  translationId: Id;
  /** null until submit succeeds. */
  jobId: Id | null;
  /** The number of sentences to re-translate (the stats bar says “Re-translating N sentences”). */
  count: number;
}

interface TranslateRunState {
  runs: Record<Id, TranslateRun>;
  /** The in-place refresh, recorded per translation document. */
  refreshes: Record<Id, RefreshRun>;
  problems: Record<Id, TranslateProblem>;
  receipts: Record<Id, TranslateReceipt>;
  compare: Record<Id, ComparePref>;
  /** The settings page is open (kept when the panel unmounts and mounts again, for example after configuring the text model on the Models page and coming back). */
  flow: Record<Id, boolean>;
}

const EMPTY: TranslateRunState = { runs: {}, refreshes: {}, problems: {}, receipts: {}, compare: {}, flow: {} };

export const useTranslateRun = create<TranslateRunState>()(() => ({ ...EMPTY }));

/** The session capability used. Tests supply a fake. */
export interface TranslateDeps {
  runtime: {
    startTranslate(params: TranslateParams): Promise<Id>;
    retryPipeline(jobId: Id): Promise<void>;
    cancelJob(jobId: Id): Promise<void>;
    readDocument(videoId: Id, documentId: Id, revision?: string): Promise<DocumentContent>;
    videos: {
      apply(operations: EditOperation[], label?: Localized): Promise<TransactionReceipt | null>;
      undo(target: UndoTarget): Promise<TransactionReceipt | null>;
    };
  };
  /** When `undo` has a value, the notice includes “Undo.” */
  toast(kind: 'positive' | 'neutral' | 'negative', message: string, undo?: () => void): void;
}

let deps: TranslateDeps | null = null;
let unwatch: (() => void) | null = null;

/** On panel mount, bind the session and the notices. The first binding starts watching the `jobs` topic. */
export function bindTranslate(next: TranslateDeps): void {
  deps = next;
  unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
}

/** For tests: unbind and clear the state. */
export function resetTranslate(): void {
  unwatch?.();
  unwatch = null;
  deps = null;
  useTranslateRun.setState({ ...EMPTY });
}

const without = <T>(record: Record<Id, T>, key: Id): Record<Id, T> => {
  const { [key]: _, ...rest } = record;
  return rest;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function setRun(run: TranslateRun): void {
  useTranslateRun.setState((s) => ({ runs: { ...s.runs, [run.videoId]: run }, problems: without(s.problems, run.videoId) }));
}

function patchRun(videoId: Id, patch: Partial<TranslateRun>): void {
  useTranslateRun.setState((s) => (s.runs[videoId] ? { runs: { ...s.runs, [videoId]: { ...s.runs[videoId]!, ...patch } } } : {}));
}

function endRun(videoId: Id, problem?: TranslateProblem): void {
  useTranslateRun.setState((s) => ({
    runs: without(s.runs, videoId),
    problems: problem ? { ...s.problems, [videoId]: problem } : s.problems,
  }));
}

function report(videoId: Id, problem: TranslateProblem): void {
  useTranslateRun.setState((s) => ({ problems: { ...s.problems, [videoId]: problem } }));
}

export function dismissTranslateProblem(videoId: Id): void {
  useTranslateRun.setState((s) => ({ problems: without(s.problems, videoId) }));
}

export function dismissReceipt(videoId: Id): void {
  useTranslateRun.setState((s) => ({ receipts: without(s.receipts, videoId) }));
}

export function setCompare(videoId: Id, pref: ComparePref): void {
  useTranslateRun.setState((s) => ({ compare: { ...s.compare, [videoId]: pref } }));
}

export function openFlow(videoId: Id, open: boolean): void {
  useTranslateRun.setState((s) => ({ flow: open ? { ...s.flow, [videoId]: true } : without(s.flow, videoId) }));
}

function isNotConfigured(details: unknown): details is CapabilityNotConfiguredDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { code?: unknown }).code === 'CAPABILITY_NOT_CONFIGURED' &&
    typeof (details as { remedy?: unknown }).remedy === 'object'
  );
}

/** When submit is rejected: if no text model is configured, give the reason in place, with `remedy.hint` and a route to the Models page. Other rejections (the model does not support structured output, and so on) show the original message. */
export function translateSubmitProblem(error: unknown): TranslateProblem {
  const message = messageOf(error);
  const details = error instanceof RpcError ? error.details : (error as { details?: unknown } | null)?.details;
  if (isNotConfigured(details)) {
    return {
      kind: 'not-configured',
      title: C.notConfigured(TEXT_NOT_CONFIGURED_REASON[details.reason] ?? details.reason),
      message: remedyHintText(details.remedy) || message,
      remedy: rejectionRemedy('generateText', error),
      retry: null,
    };
  }
  return { kind: 'failed', title: C.submitFailed, message, remedy: null, retry: null };
}

/** Submit a translation. Only one language can be translated per video at a time (“one language, one track”: two at once would race for the pairing of the same source). */
export async function startTranslate(setup: TranslateSetup & { bilingual: boolean }): Promise<boolean> {
  const bound = deps;
  const { videoId } = setup;
  if (!bound || useTranslateRun.getState().runs[videoId]) return false;
  const intent: TranslateIntent = {
    videoId,
    speechDocumentId: setup.speechDocumentId,
    targetLanguage: setup.targetLanguage,
    bilingual: setup.bilingual,
  };
  setRun({ ...intent, jobId: null, status: 'submitting', retriedAt: null });
  useTranslateRun.setState((s) => ({ receipts: without(s.receipts, videoId) }));
  try {
    // The caption layer is created by the flow (`captions: true`); bilingual follows the user's choice.
    const jobId = await bound.runtime.startTranslate({ ...translateParams(setup), captions: true, bilingual: setup.bilingual, captionStyle: newCaptionStyle() });
    patchRun(videoId, { jobId, status: 'running' });
    // Task events can arrive before the reply. This is a new task, so the mirror has no old record of it that already ended.
    settle(useJobs.getState().jobs);
    return true;
  } catch (error) {
    endRun(videoId, translateSubmitProblem(error));
    return false;
  }
}

/**
 * Re-translate one translation in place. When `sentences` is given, only those sentences are re-translated (even ones that are current). Otherwise Runtime picks the outdated and not-yet-translated ones.
 * The subtitle panel does not open a parameters page, so the model is the one the translation settings page defaults to. The outdated-translation tool page uses the model it selects (passed in by the caller; null means the text generation default).
 * When rejected, the issue card is attached to the subtitle panel and the tool page (with `refresh`).
 */
export async function startRefresh(o: {
  videoId: Id;
  /** The translation document. */
  record: DocumentRecord;
  /** The translation's language (the in-place refresh must match it). */
  language: string;
  sentences?: readonly Id[];
  /** The number of sentences to re-translate. */
  count: number;
  model: { providerId: string; modelId: string } | null;
}): Promise<boolean> {
  const bound = deps;
  const { videoId, record } = o;
  if (!bound || useTranslateRun.getState().refreshes[record.id]) return false;
  const run: RefreshRun = { videoId, translationId: record.id, jobId: null, count: o.count };
  useTranslateRun.setState((s) => ({ refreshes: { ...s.refreshes, [record.id]: run }, problems: without(s.problems, videoId) }));
  try {
    const jobId = await bound.runtime.startTranslate({
      videoId,
      ...(record.sourceDocumentId ? { documentId: record.sourceDocumentId } : {}),
      targetLanguage: o.language,
      translationId: record.id,
      ...(o.sentences ? { sentences: [...o.sentences] } : {}),
      ...(o.model ? { provider: o.model.providerId, model: o.model.modelId } : {}),
    });
    useTranslateRun.setState((s) => (s.refreshes[record.id] ? { refreshes: { ...s.refreshes, [record.id]: { ...run, jobId } } } : {}));
    settle(useJobs.getState().jobs);
    return true;
  } catch (error) {
    endRefresh(record.id);
    report(videoId, { ...translateSubmitProblem(error), refresh: record.id });
    return false;
  }
}

function endRefresh(translationId: Id): void {
  useTranslateRun.setState((s) => ({ refreshes: without(s.refreshes, translationId) }));
}

/** The outcome of the in-place refresh. On success, a notice with “Undo” (undoes the write of the translation together with the captions). On failure or interruption, an issue card (retry from the menu). */
function finishRefresh(run: RefreshRun, job: JobRecord): void {
  endRefresh(run.translationId);
  if (job.state === 'cancelled') {
    deps?.toast('neutral', C.refreshCancelled);
    return;
  }
  if (job.state === 'needs-reconciliation') {
    report(run.videoId, {
      kind: 'decide',
      title: C.refreshFailed,
      message: jobErrorText(job.error) ?? '',
      remedy: { label: C.decide, target: { tab: 'tasks', taskId: job.jobId }, hint: '' },
      retry: null,
      refresh: run.translationId,
    });
    return;
  }
  if (job.state !== 'completed') {
    report(run.videoId, {
      kind: 'failed',
      title: job.state === 'interrupted' ? C.refreshInterrupted : C.refreshFailed,
      message: jobErrorText(job.error) ?? '',
      remedy: jobRemedy({ kind: 'generateText', providerId: job.providerId, error: job.error }),
      retry: null,
      refresh: run.translationId,
    });
    return;
  }
  const refresh = (job.pipeline?.summary as Partial<TranslateSummary> | null | undefined)?.refresh as TranslateRefreshSummary | undefined;
  const count = refresh?.sentences.length ?? run.count;
  const transactionId = refresh?.transactionId;
  const bound = deps;
  bound?.toast(
    'positive',
    C.retranslated(count),
    transactionId
      ? () => {
          void bound.runtime.videos.undo({ transaction: transactionId });
        }
      : undefined,
  );
}

/** Re-run the same task from the step where it stopped (`pipelines.retry`). On completion, put it on screen per the original settings. */
export async function retryTranslate(videoId: Id): Promise<void> {
  const bound = deps;
  const retry = useTranslateRun.getState().problems[videoId]?.retry;
  if (!bound || !retry || useTranslateRun.getState().runs[videoId]) return;
  const before = useJobs.getState().jobs.find((job) => job.jobId === retry.jobId);
  setRun({ ...retry.intent, jobId: retry.jobId, status: 'submitting', retriedAt: null });
  try {
    await bound.runtime.retryPipeline(retry.jobId);
    patchRun(videoId, { status: 'running', retriedAt: before?.updatedAt ?? null });
  } catch (error) {
    // It can still be retried: keep “Retry.”
    endRun(videoId, { kind: 'failed', title: C.failed, message: C.retryFailed(messageOf(error)), remedy: null, retry });
  }
}

export async function cancelTranslate(jobId: Id): Promise<void> {
  try {
    await deps?.runtime.cancelJob(jobId);
  } catch (error) {
    deps?.toast('negative', C.cancelFailed(messageOf(error)));
  }
}

/** Watches the task submitted from here and wraps up when it ends. Each round is handled only once: the state is changed synchronously first, so later events that see it is no longer `running` skip it. */
function settle(jobs: readonly JobRecord[]): void {
  for (const run of Object.values(useTranslateRun.getState().refreshes)) {
    if (!run.jobId) continue;
    const job = jobs.find((candidate) => candidate.jobId === run.jobId);
    if (job && !isJobLive(job)) finishRefresh(run, job);
  }
  for (const run of Object.values(useTranslateRun.getState().runs)) {
    if (run.status !== 'running' || !run.jobId) continue;
    const job = jobs.find((candidate) => candidate.jobId === run.jobId);
    if (!job || isJobLive(job)) continue;
    // Before a retry, wait for the previous ended record to change.
    if (run.retriedAt !== null && job.updatedAt === run.retriedAt) continue;
    finish(run, job);
  }
}

function finish(run: TranslateRun, job: JobRecord): void {
  const intent: TranslateIntent = {
    videoId: run.videoId,
    speechDocumentId: run.speechDocumentId,
    targetLanguage: run.targetLanguage,
    bilingual: run.bilingual,
  };
  if (job.state === 'cancelled') {
    endRun(run.videoId);
    deps?.toast('neutral', C.cancelled);
    return;
  }
  if (job.state === 'needs-reconciliation') {
    endRun(run.videoId, {
      kind: 'decide',
      title: C.failed,
      message: jobErrorText(job.error) ?? '',
      remedy: { label: C.decide, target: { tab: 'tasks', taskId: job.jobId }, hint: '' },
      retry: null,
    });
    return;
  }
  if (job.state !== 'completed') {
    endRun(run.videoId, {
      kind: 'failed',
      title: job.state === 'interrupted' ? C.interrupted : C.failed,
      message: jobErrorText(job.error) ?? '',
      // The parent task's kind is `pipeline`. Remedies look up the text model it uses (credential and configuration problems go to the Models page).
      remedy: jobRemedy({ kind: 'generateText', providerId: job.providerId, error: job.error }),
      retry: { jobId: job.jobId, note: retryNote(job), intent },
    });
    return;
  }
  const translationDocumentId = translationOf(job);
  if (!translationDocumentId) {
    endRun(run.videoId, { kind: 'failed', title: C.failed, message: C.badDocument, remedy: null, retry: null });
    return;
  }
  const captions = (job.pipeline?.summary as Partial<TranslateSummary> | null | undefined)?.captions;
  const language = languageName(run.targetLanguage);
  const compare: ComparePref = { mode: run.bilingual ? 'bi' : 'trans', documentId: translationDocumentId };
  if (captions?.status === 'empty') {
    endRun(run.videoId, { kind: 'empty', title: C.emptyTitle, message: C.empty, remedy: null, retry: null });
    return;
  }
  if (captions?.status !== 'created' && captions?.status !== 'existing') {
    // It cannot be put on screen (the asset is not on the timeline), or the flow did not create a caption layer: the translation is in the video, so leave a line in the comparison list, “Put on screen.”
    endRun(run.videoId, {
      kind: 'pending',
      title: C.pendingTitle,
      message: captions?.status === 'not-on-timeline' ? C.offTimeline : C.pending,
      remedy: null,
      retry: null,
    });
    return;
  }
  // `existing`: during the run, another path already created a caption layer for this translation. The receipt points to it and offers no undo.
  const receipt: TranslateReceipt = {
    transactionId: captions.status === 'created' ? (captions.transactionId ?? null) : null,
    language,
    translationDocumentId,
    count: captions.cueCount ?? cueCountOf(run.videoId, captions.documentId ?? null),
    bilingual: captions.bilingual ?? run.bilingual,
    undone: false,
  };
  useTranslateRun.setState((s) => ({
    runs: without(s.runs, run.videoId),
    receipts: { ...s.receipts, [run.videoId]: receipt },
    compare: { ...s.compare, [run.videoId]: compare },
  }));
  if (captions.documentId) focusDocument(run.videoId, captions.documentId);
}

/** The number of cues in the current version of one caption document in the snapshot; 0 when it cannot be read. */
function cueCountOf(videoId: Id, documentId: Id | null): number {
  const video = useVideo.getState().video;
  const record = documentId && video?.videoId === videoId ? video.state?.video.documents[documentId] : undefined;
  const summary = record?.revisions[record.currentRevision]?.summary as { cueCount?: unknown } | undefined;
  return typeof summary?.cueCount === 'number' ? summary.cueCount : 0;
}

type PlaceOutcome =
  { placed: { transactionId: Id; language: string; count: number }; captionDocumentId: Id | null } | { problem: TranslateProblem };

const pending = (message: string = C.pending): PlaceOutcome => ({
  problem: { kind: 'pending', title: C.pendingTitle, message, remedy: null, retry: null },
});

/**
 * Put a translation already in the video onto the screen (“Put on screen” in the comparison list, one transaction). It reads the translation and the transcript it was translated from, cuts subtitles by the timing of each sentence's member words, and creates a new caption track for this language. It does not write if the video is not open, is read-only, or the translation does not reach the snapshot in time. In that case it leaves the line “Put on screen from the comparison list.”
 * Translations submitted from here do not go through this path, since the flow creates their caption layer.
 */
async function place(videoId: Id, translationDocumentId: Id, bilingual: boolean): Promise<PlaceOutcome> {
  const bound = deps;
  if (!bound) return pending();
  try {
    if (!(await waitForDocument(videoId, translationDocumentId))) return pending();
    const content = await bound.runtime.readDocument(videoId, translationDocumentId);
    const translation = readTranslation(content.body);
    const speechDocumentId = content.document.sourceDocumentId ?? translation?.sourceBasis.speechRef.id ?? null;
    if (!translation || !speechDocumentId) return { problem: { kind: 'failed', title: C.failed, message: C.badDocument, remedy: null, retry: null } };
    const speechContent = await bound.runtime.readDocument(videoId, speechDocumentId);
    const speech = readSpeechWords(speechContent.body);
    const assetId = speechContent.document.sourceAssetId ?? null;
    if (!speech || !assetId) return { problem: { kind: 'failed', title: C.failed, message: C.badDocument, remedy: null, retry: null } };
    const video = useVideo.getState().video;
    const snapshot = video?.videoId === videoId && canEdit(video) ? video.state!.video : null;
    const sequence = snapshot ? rootSequence(snapshot) : null;
    if (!snapshot || !sequence) return pending();
    const cues = translationCues(speech, translation.units);
    if (!cues.length) return { problem: { kind: 'empty', title: C.emptyTitle, message: C.empty, remedy: null, retry: null } };
    const body = speechCaptionBody(cues, speech.speakers);
    const language = translation.language || content.document.language || '';
    const label = language ? languageName(language) : C.unnamed;
    const paired = pairedOriginal(captionChips(sequence, snapshot.documents), snapshot.documents, speechDocumentId);
    const operations = translationCaptionOperations(
      sequence,
      body,
      {
        translationDocumentId,
        translationRevision: content.revision,
        speechDocumentId,
        speechRevision: speechContent.revision,
        assetId,
        language,
        name: label,
        bilingual,
      },
      paired,
    );
    // On failure the editor has already shown the engine's own message. The translation is still in the video, so leave a note on how to continue.
    const receipt = await bound.runtime.videos.apply(withNewCaptionStyle(operations, newCaptionStyle()), EditLabel.translateTo({ language: language ? label : EditLabel.unnamedTranslation() }));
    if (!receipt) return pending();
    return {
      placed: { transactionId: receipt.transactionId, language: label, count: cues.length },
      captionDocumentId: receipt.refs?.['translation-caption'] ?? null,
    };
  } catch (error) {
    return pending(E.thenNext(messageOf(error), C.pending));
  }
}

/** Undo on the receipt: reverts the put-on-screen transaction (the new track, the caption document, the instances, and the display change to the original). The translation document was written separately by Runtime, so it stays. */
export async function undoReceipt(videoId: Id): Promise<void> {
  const bound = deps;
  const receipt = useTranslateRun.getState().receipts[videoId];
  if (!bound || !receipt?.transactionId || receipt.undone) return;
  const result = await bound.runtime.videos.undo({ transaction: receipt.transactionId });
  if (!result) {
    bound.toast('negative', C.undoFailed);
    return;
  }
  useTranslateRun.setState((s) => (s.receipts[videoId] ? { receipts: { ...s.receipts, [videoId]: { ...s.receipts[videoId]!, undone: true } } } : {}));
}

/** A translation already in the video but not yet on screen (translated elsewhere, or undone): put it on, with a notice that has “Undo.” */
export async function putOnScreen(videoId: Id, translationDocumentId: Id, bilingual = true): Promise<void> {
  const bound = deps;
  if (!bound) return;
  const outcome = await place(videoId, translationDocumentId, bilingual);
  if ('problem' in outcome) {
    report(videoId, outcome.problem);
    return;
  }
  dismissTranslateProblem(videoId);
  if (outcome.captionDocumentId) focusDocument(videoId, outcome.captionDocumentId);
  const { transactionId, language, count } = outcome.placed;
  bound.toast('positive', C.placed(language, count), () => {
    void bound.runtime.videos.undo({ transaction: transactionId });
  });
}

export interface TranslationEdit {
  videoId: Id;
  /** The translation document. */
  record: DocumentRecord;
  body: TranslationBody;
  sentences: readonly SourceSentence[];
  row: PairRow;
  text: string;
  /** The transcript the translation was translated from. Used to re-cut the subtitles of this sentence. */
  speech: SpeechWords;
  documents: Record<Id, DocumentRecord>;
}

/**
 * The transaction for changing one sentence of a translation: a new version of the translation document. With `retext`, the cues of that sentence in the caption document generated from it are also changed (`retextCaption`; other cues are untouched). Undo restores both sides together.
 */
async function translationOperations(
  bound: TranslateDeps,
  edit: Pick<TranslationEdit, 'videoId' | 'record' | 'speech' | 'documents'>,
  result: { body: TranslationBody; unit: TranslationUnit },
  retext: boolean,
): Promise<EditOperation[]> {
  const previous = edit.record.revisions[edit.record.currentRevision]?.summary;
  const operations: EditOperation[] = [
    {
      type: 'putDocument',
      documentId: edit.record.id,
      kind: edit.record.kind,
      body: result.body,
      summary: { ...(previous && typeof previous === 'object' ? previous : {}), unitCount: result.body.units.length },
    },
  ];
  if (!retext) return operations;
  const fresh = translationCues(edit.speech, [result.unit]);
  for (const caption of Object.values(edit.documents)) {
    if (!derivedFrom(caption, edit.record.id)) continue;
    const content = await bound.runtime.readDocument(edit.videoId, caption.id);
    if (typeof content.body !== 'object' || content.body === null) continue;
    const body = retextCaption(content.body as Record<string, unknown>, result.unit.id, fresh, edit.speech.speakers);
    const summary = caption.revisions[caption.currentRevision]?.summary;
    operations.push({
      type: 'putDocument',
      documentId: caption.id,
      kind: caption.kind,
      body,
      summary: { ...(summary && typeof summary === 'object' ? summary : {}), cueCount: Array.isArray(body.cues) ? body.cues.length : 0 },
    });
  }
  return operations;
}

/**
 * Edit one sentence of a translation in place (click the translation side, commit on blur). One transaction writes a new version of the translation document, plus the cues of that sentence in the caption document generated from it.
 * Editing clears the stale mark, since the edited text is now reviewed (`editUnit`). Returns the new body (the panel uses it before the new version is fetched); null when nothing changed.
 */
export async function editTranslation(edit: TranslationEdit): Promise<TranslationBody | null> {
  const bound = deps;
  if (!bound) return null;
  const result = await editUnit(edit.body, edit.sentences, edit.row, edit.text);
  if (!result) return null;
  try {
    const receipt = await bound.runtime.videos.apply(await translationOperations(bound, edit, result, true), EditLabel.editTranslation());
    if (!receipt) return null;
    bound.toast('positive', C.edited, () => {
      void bound.runtime.videos.undo({ transaction: receipt.transactionId });
    });
    return result.body;
  } catch (error) {
    bound.toast('negative', C.editFailed(messageOf(error)));
    return null;
  }
}

/**
 * Mark a sentence as stale, or clear the stale mark (the sentence's ⋯ menu). One transaction writes a new version of the translation document and goes into the undo history. Caption text does not change, so captions are not touched. When the mark is cleared and the source sentence's words changed, the cues of that sentence are re-cut with the new words (`rebound` of `markUnit`). Returns the new body; null when nothing changed.
 */
export async function markTranslation(edit: Omit<TranslationEdit, 'text' | 'sentences'> & { on: boolean }): Promise<TranslationBody | null> {
  const bound = deps;
  if (!bound) return null;
  const result = markUnit(edit.body, edit.row, edit.on);
  if (!result) return null;
  try {
    const label = edit.on ? EditLabel.markTranslationStale() : EditLabel.clearTranslationStale();
    const receipt = await bound.runtime.videos.apply(await translationOperations(bound, edit, result, result.rebound), label);
    if (!receipt) return null;
    bound.toast('positive', edit.on ? C.markedStale : C.clearedStale, () => {
      void bound.runtime.videos.undo({ transaction: receipt.transactionId });
    });
    return result.body;
  } catch (error) {
    bound.toast('negative', C.markFailed(messageOf(error)));
    return null;
  }
}
