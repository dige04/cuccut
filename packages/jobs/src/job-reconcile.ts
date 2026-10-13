import { RpcError, type ApplicationRecord, type JobReconcileDecision } from '@cuccut/protocol';
import { JobsReconcile as J } from '@cuccut/protocol/messages/jobs/job-reconcile.ts';
import type { StoredJob } from './job-ledger.ts';
import { joinList } from './job-text.ts';
import { retryable } from './job-recovery.ts';

/**
 * The decisions of `jobs.reconcile` and the states they are legal in (architecture design §7.5). The set is closed; there are no other decisions:
 *
 * | Decision | Legal states | Result |
 * | --- | --- | --- |
 * | `retry` | Transcription (with video) and generation jobs in `needs-reconciliation` or `interrupted` | The same job goes back to `queued`, `attempt` increments by one, and it is admitted again (a new call and reservation); when there is a video, the video must already be open |
 * | `discard` | `needs-reconciliation` | `cancelled`, recording the three facts about the cancellation; budget deducted under the conservative rule is not refunded |
 * | `apply` | `failed`, or `cancelled` whose latest apply is `stale-input`, `rejected` or `cancelled`, with the output present | First look up the receipt by the old `commandId`, then create a new apply, validate again, and commit; the video must already be open |
 *
 * There is no “marked as committed / not committed”: the user's judgment cannot be verified, so it is not used to refund budget or replay requests.
 */

export const RECONCILE_DECISIONS: readonly JobReconcileDecision[] = ['retry', 'discard', 'apply'];

export function reconcileChoices(job: StoredJob, latest: ApplicationRecord | undefined): JobReconcileDecision[] {
  const { record } = job;
  const choices: JobReconcileDecision[] = [];
  if ((record.state === 'needs-reconciliation' || record.state === 'interrupted') && retryable(job)) choices.push('retry');
  if (record.state === 'needs-reconciliation') choices.push('discard');
  if (
    (record.state === 'failed' || record.state === 'cancelled') &&
    record.videoId !== null &&
    record.result !== null &&
    latest !== undefined &&
    (latest.state === 'stale-input' || latest.state === 'rejected' || latest.state === 'cancelled')
  ) {
    choices.push('apply');
  }
  return choices;
}

export function reconcileNotAllowed(job: StoredJob, decision: JobReconcileDecision, allowed: JobReconcileDecision[]): RpcError {
  const message = allowed.length > 0 ? J.onlyAllowed({ allowed: joinList(allowed) }) : J.noneAllowed();
  return new RpcError('conflict', message, { code: 'RECONCILE_NOT_ALLOWED', state: job.record.state, decision, allowed });
}
