import type { JobReconcileDecision, JobRecord } from '@cuccut/protocol';
import { jobRetrying } from './task-list.ts';

/**
 * Reconciliation choices offered to the user in task details (architecture design §7.5, `jobs.reconcile`). Derived from the facts visible in the record, in line with the Runtime's `reconcileChoices` (job-reconcile.ts in packages/jobs);
 * the Runtime is the authority: conditions it cannot see (for example, the hosted execution mode) are rejected by it with `RECONCILE_NOT_ALLOWED`, and the UI reports that honestly.
 *
 * - `retry`: generation tasks in `needs-reconciliation` or `interrupted`, and transcriptions with a video, that are not a step of a fixed pipeline and were not submitted by a remote node;
 * - `discard`: `needs-reconciliation`;
 * - `apply`: `failed` or `cancelled`, with the output present and a video, and the most recent apply was `stale-input`, `rejected` or `cancelled`.
 */
export function reconcileOptions(job: JobRecord): JobReconcileDecision[] {
  const options: JobReconcileDecision[] = [];
  // A task automatically rerunning after a crash (`interrupted`, no `endedAt`) has not ended yet, so no decision is offered.
  if (jobRetrying(job)) return options;
  if ((job.state === 'needs-reconciliation' || job.state === 'interrupted') && retryable(job)) options.push('retry');
  if (job.state === 'needs-reconciliation') options.push('discard');
  const latest = job.applications?.at(-1);
  if (
    (job.state === 'failed' || job.state === 'cancelled') &&
    job.videoId !== null &&
    job.result !== null &&
    latest !== undefined &&
    (latest.state === 'stale-input' || latest.state === 'rejected' || latest.state === 'cancelled')
  ) {
    options.push('apply');
  }
  return options;
}

function retryable(job: JobRecord): boolean {
  if (job.parentJobId != null) return false;
  if (job.submitter.kind === 'node' || job.submitter.kind === 'pipeline') return false;
  if (job.generation) return true;
  return job.kind === 'transcribe' && job.videoId !== null;
}

/** Calls handed to an online or agent Provider (data is sent out, and may be billed); this machine and remote nodes are not. */
export function chargesOnRetry(job: Pick<JobRecord, 'providerId'>): boolean {
  return job.providerId !== 'local' && !job.providerId.startsWith('node:');
}
