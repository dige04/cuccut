import { create } from 'zustand';
import { ToastQueue } from '@react-spectrum/s2';
import type { DocumentContent, DocumentRecord, DubParams, EditOperation, Id, JobRecord, Localized, TransactionReceipt, UndoTarget } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { dubSummaryOf } from '../../model/dub-progress.ts';
import { grantRefusal } from '../../model/dub-setup.ts';
import { retextTranslation } from '../../model/dub-takes.ts';
import { readTranslation } from '../../model/translation-doc.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { DUB_REGEN_COPY as C } from './dub-copy.ts';
import { jobErrorText } from '../../model/localized-text.ts';

/**
 * Submitting and wrapping up per-sentence re-dub (design timeline-dub.jsx “Re-generate these sentences” and “Edit translation and re-dub…”, panel-dub-fit.jsx):
 * submits `pipelines.start` (`dub` with `regroup`), re-dubbing only those sentences and writing them back into the original group. Which sentences are queued is not recorded here: the timeline reads it from the `params.regroup` frozen in the running dub flow in the `jobs` mirror (model/dub-takes.ts), so jobs started elsewhere (by an agent or from the command line) are shown the same way.
 *
 * Separate from the translated voice-over in the tool page (dub-run.ts): that one dubs one group at a time per video and leaves the whole group's receipt when complete. Here, several different sentences from several groups can be re-dubbed at the same time on one video, and on completion only one notice is shown (how many sentences were replaced, and which were not), with “Undo”, which undoes the one operation the Runtime wrote back (the plan gets a new version in that operation, and that version's `createdBy` is the transaction).
 *
 * Authorization: only synthesis goes out. When refused (`GRANT_REQUIRED` / `GRANT_REVOKED`), the notice honestly says which provider's authorization is missing; authorization is not requested here.
 */

/** The session and editing capabilities used; tests supply fakes. */
export interface RegenDeps {
  runtime: {
    startDub(params: DubParams): Promise<Id>;
    readDocument(videoId: Id, documentId: Id, revision?: string): Promise<DocumentContent>;
  };
  apply(operations: EditOperation[], label?: Localized): Promise<TransactionReceipt | null>;
  undo(target: UndoTarget): Promise<TransactionReceipt | null>;
}

/** Editor dependencies: the session and editing actions (actions are called via closures, not relying on `this`). */
export function regenDeps(runtime: RegenDeps['runtime'], actions: Pick<RegenDeps, 'apply' | 'undo'>): RegenDeps {
  return { runtime, apply: (operations, label) => actions.apply(operations, label), undo: (target) => actions.undo(target) };
}

interface Pending {
  jobId: Id;
  videoId: Id;
  groupId: string;
  units: Id[];
  /** This group's dub plan, and the versions it had at submit time: the version that appears after completion is the one the Runtime wrote back. */
  planDocumentId: Id | null;
  revisions: string[];
  deps: RegenDeps;
}

/** The sentences the “Edit translation and re-dub” dialog should open with. */
export interface FitRequest {
  videoId: Id;
  groupId: string;
  units: Id[];
}

interface RegenState {
  pending: Record<Id, Pending>;
  /** The group being submitted (before the submit receipt). */
  busy: Record<string, true>;
  fit: FitRequest | null;
}

export const useDubRegen = create<RegenState>()(() => ({ pending: {}, busy: {}, fit: null }));

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const TOAST_MS = 5000;

let unwatch: (() => void) | null = null;

/** For tests: clears state and stops watching tasks. */
export function resetDubRegen(): void {
  unwatch?.();
  unwatch = null;
  useDubRegen.setState({ pending: {}, busy: {}, fit: null });
}

export function openDubFit(request: FitRequest): void {
  if (request.units.length > 0) useDubRegen.setState({ fit: request });
}

export function closeDubFit(): void {
  useDubRegen.setState({ fit: null });
}

function documentsOf(videoId: Id): Record<Id, DocumentRecord> | null {
  const video = useVideo.getState().video;
  return video?.videoId === videoId ? (video.state?.video.documents ?? null) : null;
}

export interface RegenRequest {
  videoId: Id;
  groupId: string;
  units: Id[];
  /** This group's dub plan (undo looks for its new version). */
  planDocumentId: Id | null;
}

/** Re-dubs only these sentences (with a new seed). Returns the task ID on a successful submit; if the same group is already being submitted, or there are no sentences, does nothing. */
export async function regenerateUnits(deps: RegenDeps, request: RegenRequest): Promise<Id | null> {
  const { videoId, groupId, units, planDocumentId } = request;
  if (units.length === 0) return null;
  if (useDubRegen.getState().busy[groupId]) {
    ToastQueue.neutral(C.busy, { timeout: TOAST_MS });
    return null;
  }
  const plan = planDocumentId ? documentsOf(videoId)?.[planDocumentId] : undefined;
  useDubRegen.setState((s) => ({ busy: { ...s.busy, [groupId]: true } }));
  try {
    const jobId = await deps.runtime.startDub({ videoId, regroup: { groupId, units: [...units], seed: 'new' } });
    useDubRegen.setState((s) => ({
      pending: {
        ...s.pending,
        [jobId]: { jobId, videoId, groupId, units: [...units], planDocumentId, revisions: plan ? Object.keys(plan.revisions) : [], deps },
      },
    }));
    unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
    ToastQueue.neutral(C.submitted(units.length), { timeout: TOAST_MS });
    // A task event may arrive before the receipt.
    settle(useJobs.getState().jobs);
    return jobId;
  } catch (error) {
    const refusal = grantRefusal(error);
    ToastQueue.negative(refusal ? C.grantRefused(refusal.recipient) : C.submitFailed(messageOf(error)), { timeout: TOAST_MS * 2 });
    return null;
  } finally {
    useDubRegen.setState((s) => {
      const { [groupId]: _, ...rest } = s.busy;
      return { busy: rest };
    });
  }
}

export interface RetextRequest extends RegenRequest {
  /** The translation this dub uses (the `translationRef.id` of the plan body). */
  translationId: Id | null;
  /** Translation unit → the text it was changed to; unchanged ones are not included. */
  texts: ReadonlyMap<Id, string>;
}

/**
 * Edit translation and re-dub: first writes a new version of the translation in one edit (only the sentences given are changed); once that commits, only those sentences are re-dubbed, since synthesis reads the translation's current version.
 * If the translation edit fails (the editor has already notified), nothing is re-dubbed.
 */
export async function retextAndRegenerate(deps: RegenDeps, request: RetextRequest): Promise<Id | null> {
  const { videoId, translationId, texts } = request;
  if (translationId && texts.size > 0) {
    let content: DocumentContent;
    try {
      content = await deps.runtime.readDocument(videoId, translationId);
    } catch (error) {
      ToastQueue.negative(C.submitFailed(messageOf(error)), { timeout: TOAST_MS * 2 });
      return null;
    }
    const body = readTranslation(content.body);
    const result = body ? await retextTranslation(body, texts) : null;
    if (result) {
      const record = documentsOf(videoId)?.[translationId];
      const previous = record?.revisions[record.currentRevision]?.summary;
      const receipt = await deps.apply(
        [
          {
            type: 'putDocument',
            documentId: translationId,
            kind: record?.kind ?? 'translation',
            body: result.body,
            summary: { ...(previous && typeof previous === 'object' ? previous : {}), unitCount: result.body.units.length },
          },
        ],
        EditLabel.editDubText(),
      );
      if (!receipt) return null;
    }
  }
  return regenerateUnits(deps, request);
}

/** The operation the Runtime wrote back: the `createdBy` of the earliest version of the dub plan that appears after submit. */
function regroupTransaction(pending: Pending): Id | null {
  if (!pending.planDocumentId) return null;
  const record = documentsOf(pending.videoId)?.[pending.planDocumentId];
  if (!record) return null;
  const known = new Set(pending.revisions);
  let first: { createdAt: string; createdBy: Id } | null = null;
  for (const [key, revision] of Object.entries(record.revisions)) {
    if (known.has(key) || !revision?.createdBy) continue;
    if (!first || revision.createdAt < first.createdAt) first = revision;
  }
  return first?.createdBy ?? null;
}

/** Watches the tasks submitted from here: wraps up when one ends, and each is wrapped up only once (removed synchronously first). */
function settle(jobs: readonly JobRecord[]): void {
  for (const pending of Object.values(useDubRegen.getState().pending)) {
    const job = jobs.find((candidate) => candidate.jobId === pending.jobId);
    if (!job || isJobLive(job)) continue;
    useDubRegen.setState((s) => {
      const { [pending.jobId]: _, ...rest } = s.pending;
      return { pending: rest };
    });
    finish(pending, job);
  }
  if (Object.keys(useDubRegen.getState().pending).length === 0) {
    unwatch?.();
    unwatch = null;
  }
}

function finish(pending: Pending, job: JobRecord): void {
  if (job.state === 'cancelled') {
    ToastQueue.neutral(C.cancelled, { timeout: TOAST_MS });
    return;
  }
  if (job.state !== 'completed') {
    ToastQueue.negative(C.failed(jobErrorText(job.error) ?? job.state), { timeout: TOAST_MS * 2 });
    return;
  }
  const units = dubSummaryOf(job)?.regroup?.units ?? [];
  const replaced = units.filter((u) => u.status === 'replaced').length;
  const others = new Map<string, number>();
  for (const unit of units) if (unit.status !== 'replaced') others.set(unit.status, (others.get(unit.status) ?? 0) + 1);
  const rest = [...others].map(([status, n]) => C.notPlaced(status, n));
  if (replaced === 0) {
    ToastQueue.neutral([C.doneNone, ...rest].join(' · '), { timeout: TOAST_MS * 2 });
    return;
  }
  ToastQueue.positive([C.done(replaced, units.length || pending.units.length), ...rest].join(' · '), {
    actionLabel: C.undo,
    shouldCloseOnAction: true,
    onAction: () => {
      const transaction = regroupTransaction(pending);
      if (!transaction) {
        ToastQueue.neutral(C.undoMissing, { timeout: TOAST_MS });
        return;
      }
      void pending.deps.undo({ transaction });
    },
  });
}
