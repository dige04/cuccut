import { defineMessages, type Id, type JobKind, type JobRecord } from '@cuccut/protocol';
import { JOB_PHASE_LABEL } from '../copy.ts';
import { agoLabel } from './format.ts';
import { jobLive, jobPercent, jobRetrying } from './task-list.ts';
import { zhHans } from './tools-records.zh-Hans.ts';
import { zhHant } from './tools-records.zh-Hant.ts';
import { ja } from './tools-records.ja.ts';
import { ko } from './tools-records.ko.ts';
import { es } from './tools-records.es.ts';
import { fr } from './tools-records.fr.ts';
import { de } from './tools-records.de.ts';
import { nl } from './tools-records.nl.ts';
import { ptBR } from './tools-records.pt-BR.ts';
import { it } from './tools-records.it.ts';
import { ru } from './tools-records.ru.ts';
import { pl } from './tools-records.pl.ts';
import { tr } from './tools-records.tr.ts';
import { vi } from './tools-records.vi.ts';
import { jobErrorText, jobWaitText } from './localized-text.ts';

/** Status words and reasons for record cards (translations in `tools-records.<语言>.ts`). */
const en = {
  generating: 'Generating',
  queued: 'Queued',
  cancelled: 'Cancelled',
  failed: 'Failed',
  unfinished: 'Didn’t finish',
  unknown: 'Result unknown',
  interrupted: 'Runtime stopped or restarted before this finished',
  reconcile: 'Runtime restarted before this call responded. The result is unknown and it may already have been billed',
  noResult: 'Nothing was generated',
};
export type ToolsRecordsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Records in the right column of the tools page (design mocks tool-tts.jsx "Generation records", tool-image.jsx, tool-transcribe.jsx "Transcription records"):
 * not a separate list the tools page keeps itself, but the subset of `jobs` topic tasks of this kind: submitted from this computer's UI (connection), and not belonging to any video.
 * The models page's "Test synthesis" / "Test image generation" are submitted the same way and also appear here, listed honestly (that is also a real call).
 * "Delete this record" only hides it locally: the Runtime has no method to delete a Job, and it is still visible among background tasks.
 */

function isLive(job: Pick<JobRecord, 'state' | 'endedAt'>): boolean {
  return jobLive(job);
}

/** Records of this kind, newest first; those hidden locally are not listed. */
export function toolJobs(jobs: readonly JobRecord[], kind: JobKind, hidden: readonly Id[]): JobRecord[] {
  const skip = new Set(hidden);
  return jobs
    .filter((job) => job.kind === kind && job.videoId === null && job.submitter.kind === 'connection' && !skip.has(job.jobId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Records listed in the right column: cancelled ones are not listed; ones that may already have been charged are kept as they are (`cancellation.cost` is not `none`). */
export function listedRecords(list: readonly JobRecord[]): JobRecord[] {
  return list.filter((job) => job.state !== 'cancelled' || (!!job.cancellation && job.cancellation.cost !== 'none'));
}

/** Count of in-progress records (queued or running): the "N in progress" beside the right column's title. */
export function liveCount(list: readonly JobRecord[]): number {
  return list.filter(isLive).length;
}

/**
 * How many tasks are ahead of a queued one (design mock model-tools.js `aheadOf`). The Runtime queues per executor: each cloud provider has its own queue,
 * so only count tasks on the same provider that were submitted earlier and haven't finished (running ones count too). `all` passes all tasks; ones in videos also take a place in the queue.
 */
export function aheadOf(all: readonly JobRecord[], job: JobRecord): number {
  const at = Date.parse(job.createdAt);
  return all.filter((x) => x.jobId !== job.jobId && x.providerId === job.providerId && isLive(x) && Date.parse(x.createdAt) < at).length;
}

/**
 * What the Runtime recorded a queued task as waiting for (`JobRecord.wait`: a concurrency slot in the same queue, or a machine resource; architecture design §7.6, §7.7),
 * a sentence for people to read. null when there is none yet, and the caller falls back to the `aheadOf` estimate.
 */
export function queuedDetail(job: Pick<JobRecord, 'state' | 'wait'>): string | null {
  return job.state === 'queued' ? jobWaitText(job.wait) : null;
}

/** Hidden local records are kept up to this many; the oldest are forgotten first. */
export const HIDDEN_LIMIT = 500;

/** Hide a record (one already hidden is not recorded again). */
export function hideJob(hidden: readonly Id[], jobId: Id): Id[] {
  if (hidden.includes(jobId)) return [...hidden];
  return [...hidden, jobId].slice(-HIDDEN_LIMIT);
}

// ---- Record card status ----

export type RecordStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted' | 'needs-reconciliation';

export function recordStatus(job: Pick<JobRecord, 'state' | 'endedAt'>): RecordStatus {
  if (jobRetrying(job)) return 'running';
  return job.state === 'completed' ? 'done' : job.state;
}

/** The word in a record card's top-right corner (design mock tool-tts.jsx `RecordCard`): for a finished one, how long ago; otherwise the status. */
export function stateLabel(job: Pick<JobRecord, 'state' | 'endedAt' | 'createdAt'>, now: number): string {
  switch (job.state) {
    case 'completed':
      return agoLabel(job.endedAt ?? job.createdAt, now);
    case 'running':
      return M.generating;
    case 'queued':
      return M.queued;
    case 'cancelled':
      return M.cancelled;
    case 'failed':
      return M.failed;
    case 'interrupted':
      return job.endedAt === null ? M.generating : M.unfinished;
    case 'needs-reconciliation':
      return M.unknown;
  }
}

/** A record that didn't succeed (failed, interrupted, outcome unknown): the card is drawn as an error, with the reason. */
export function didNotFinish(job: Pick<JobRecord, 'state' | 'endedAt'>): boolean {
  if (jobRetrying(job)) return false;
  return job.state === 'failed' || job.state === 'interrupted' || job.state === 'needs-reconciliation';
}

/**
 * The line shown while running: stage, which one of several (when an image generation makes several), and the percentage. The percentage is not written when the total is unknown (no fabrication).
 * "Generating 1/4 · 25%", "Generating", "Saving result · 100%".
 */
export function phaseLabel(job: Pick<JobRecord, 'phase' | 'progress'>): string {
  const p = job.progress;
  const count = p && p.unit === 'outputs' && p.total ? ` ${p.done}/${p.total}` : '';
  const pct = jobPercent(job);
  return `${JOB_PHASE_LABEL[job.phase]}${count}${pct !== null ? ` · ${pct}%` : ''}`;
}

/** A sentence for a record that didn't succeed: failures carry the Runtime's reason; an interruption says the Runtime was stopped. */
export function failureText(job: Pick<JobRecord, 'state' | 'error'>): string {
  if (job.state === 'interrupted') return M.interrupted;
  if (job.state === 'needs-reconciliation') return M.reconcile;
  return jobErrorText(job.error) || M.noResult;
}
