import type { ApplicationRecord, Id, JobCancellation, JobRecord } from '@cuccut/protocol';
import { applicationOpen } from './job-application.ts';
import { isTerminal, type StoredJob } from './job-ledger.ts';

/**
 * Recovery matrix at restart (architecture design §7.5): when the ledger is read, each job is handled according to where it stopped. This only decides; execution is in JobManager.
 *
 * | Where it stopped | Handling |
 * | --- | --- |
 * | Queued, not yet claimed (transcription and generation submitted by the connection, the Runtime, or an external service) | The old reservation is released; validate again before re-queuing (video and material, Provider, authorization and budget) |
 * | Queued, submitted by an agent | `interrupted`: its Run ended with the restart, and an already-stopped old Run is not executed |
 * | Running on this machine or a node, no recovery capability | `interrupted`, a new attempt allowed (`jobs.reconcile retry` or resubmit) |
 * | Running on an online or agent Provider, with a queryable remote task ID | Query the remote (`RemoteTaskQuery`); no Provider supports this yet |
 * | Running on an online or agent Provider, result unknown and not queryable | `needs-reconciliation`, budget deducted under the conservative rule, never automatically re-sent |
 * | Output published, apply not finished | Reuse the output: look up the receipt by the recorded `commandId` first; only if nothing was committed, validate again and apply |
 * | Parent job and steps of a fixed pipeline | `interrupted`, reconciled by PipelineRunner itself |
 * | Jobs not going through a model (export, model install), executed on behalf of a remote node, transcription without video | `interrupted` (the execution function or input file exists only in memory) |
 */

export type RecoveryAction =
  /** Already terminal; left alone. */
  | { kind: 'keep' }
  /** Mark as `interrupted`. */
  | { kind: 'interrupt' }
  /** Release the old reservation, validate, then re-queue. */
  | { kind: 'requeue' }
  /** Mark as `needs-reconciliation`. */
  | { kind: 'reconcile' }
  /** Query the remote task. */
  | { kind: 'query-remote'; remoteTaskId: string }
  /** Reuse the published output and complete the apply. */
  | { kind: 'resume-application' };

/**
 * A queryable remote task (§7.5 “submitted to the cloud, has a task ID”): after the Provider submits, it returns a remote task ID, which is recorded in the ledger; after restart it is queried by that ID.
 * The existing online adapters are all single synchronous HTTP requests with no remote task ID, and they do not implement this interface. When the query returns `pending`, `running` or
 * `succeeded`, how to retrieve the result (resuming) is not defined, so all of these are converted to `needs-reconciliation` (architecture design §14).
 */
export interface RemoteTaskQuery {
  supports(providerId: string): boolean;
  query(task: { jobId: Id; providerId: string; modelId: string; remoteTaskId: string }): Promise<RemoteTaskStatus>;
}

export type RemoteTaskStatus =
  /** The remote has no such task: the request never arrived. */
  { status: 'not-found' } | { status: 'failed'; message: string } | { status: 'pending' | 'running' | 'succeeded' };

/** An online or agent Provider (data leaves the machine, may be billed); local and node are not. */
export function isExternalProvider(providerId: string): boolean {
  return providerId !== 'local' && !providerId.startsWith('node:');
}

/** Whether the Runtime can re-queue it (at restart) or the user can retry it (`jobs.reconcile retry`): transcription and generation jobs with video. */
export function retryable(job: StoredJob): boolean {
  const { record, spec } = job;
  if (record.parentJobId != null) return false;
  if (record.submitter.kind === 'node' || record.submitter.kind === 'pipeline') return false;
  if ('hosted' in spec || 'task' in spec) return false;
  if ('capability' in spec) return true;
  return record.kind === 'transcribe' && record.videoId !== null;
}

export function recoveryAction(job: StoredJob, latest: ApplicationRecord | undefined, remote: RemoteTaskQuery | undefined): RecoveryAction {
  const { record, spec } = job;
  if (latest && applicationOpen(latest.state)) return { kind: 'resume-application' };
  if (isTerminal(record.state)) return { kind: 'keep' };
  if ('hosted' in spec) return { kind: 'interrupt' };
  if (record.state === 'queued') {
    const agent = record.submitter.kind === 'agent';
    return retryable(job) && !agent ? { kind: 'requeue' } : { kind: 'interrupt' };
  }
  // Local and node computation has no recovery capability. Those the user cannot retry (fixed-pipeline steps, transcription without video, tasks that do not go through a model) are also only interrupted:
  // budget is still settled by whether they started; marking them `needs-reconciliation` would only leave a record that can only be abandoned.
  if (!isExternalProvider(record.providerId) || !retryable(job)) return { kind: 'interrupt' };
  if (job.remoteTaskId && remote?.supports(record.providerId)) return { kind: 'query-remote', remoteTaskId: job.remoteTaskId };
  return { kind: 'reconcile' };
}

/**
 * The three facts when cancelling or abandoning (§7.4). `stage`:
 * - `queued`: not started yet, nothing was sent;
 * - `running`: stopped while executing (`confirmed`: the executor confirmed the stop; a node replies this way);
 * - `after-result`: the result was obtained but not applied (the stop barrier blocked auto-apply);
 * - `unknown`: abandoning an outbound call with an unknown result (`jobs.reconcile discard`).
 */
export function cancellationFacts(
  record: Pick<JobRecord, 'providerId'>,
  stage: 'queued' | 'running' | 'after-result' | 'unknown',
  requestedAt: string,
  options: { confirmed?: boolean; now?: string } = {},
): JobCancellation {
  const localStoppedAt = options.now ?? new Date().toISOString();
  const external = isExternalProvider(record.providerId);
  const node = record.providerId.startsWith('node:');
  let remote: JobCancellation['remote'];
  let cost: JobCancellation['cost'] = 'none';
  switch (stage) {
    case 'queued':
      remote = external || node ? 'not-submitted' : 'not-applicable';
      break;
    case 'running':
      if (external) {
        // Dropping the HTTP request does not mean the vendor has stopped: the request may still complete remotely and be billed.
        remote = 'cancel-unsupported';
        cost = 'possible';
      } else remote = node ? (options.confirmed ? 'cancelled' : 'unknown') : 'not-applicable';
      break;
    case 'after-result':
      remote = 'not-applicable';
      cost = external ? 'charged' : 'none';
      break;
    case 'unknown':
      remote = 'unknown';
      cost = external ? 'possible' : 'none';
      break;
  }
  return { requestedAt, localStoppedAt, remote, cost };
}
