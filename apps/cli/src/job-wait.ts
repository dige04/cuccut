import type { CucCutClient } from '@cuccut/client';
import type { JobRecord } from '@cuccut/protocol';
import { M } from './cli-copy.ts';
import { CliError } from './envelope.ts';
import type { ProgressReporter } from './catalog/progress.ts';

/**
 * Wait for a task to reach a terminal state (agent-surface design §5.4): shared by the `--wait` of derived commands and by admin commands that need to follow progress.
 *
 * - Subscribes to the `jobs` topic rather than polling; subscribes before submission (`watchJobs`), so no change after submission is missed.
 * - Ctrl-C asks the Runtime to cancel the task and keeps waiting for a terminal state (`cancelled`); pressing it again exits immediately (130), and the task keeps running in the Runtime.
 * - Connection drops: `RUNTIME_UNAVAILABLE` (exit code 3).
 */

/** Mirror of the `jobs` topic: task id → latest record; after `listen`, each change is handed to the listener. */
export interface JobWatcher {
  records: ReadonlyMap<string, JobRecord>;
  listen(listener: (job: JobRecord) => void): void;
  close(): void;
}

export function watchJobs(client: CucCutClient): JobWatcher {
  const records = new Map<string, JobRecord>();
  let listener: ((job: JobRecord) => void) | null = null;
  const close = client.subscribeJobs({
    snapshot: (snapshot) => {
      records.clear();
      for (const job of snapshot.jobs) records.set(job.jobId, job);
      if (listener) for (const job of snapshot.jobs) listener(job);
    },
    event: (event) => {
      // Live segments (`job.segments`) are unrelated to waiting for tasks.
      if (event.type !== 'job.updated') return;
      records.set(event.job.jobId, event.job);
      listener?.(event.job);
    },
  });
  return {
    records,
    listen: (next) => (listener = next),
    close: () => void close(),
  };
}

/**
 * Terminal states: `completed`, `failed`, `cancelled`, `needs-reconciliation` (same as `isTerminal` in `packages/jobs`; it requires user reconciliation, and the exit code counts as failure).
 * An automatic retry after a worker crash (`interrupted` → `running`) does not count as finished; an interruption caused by the Runtime stopping (`JOB_INTERRUPTED`) does.
 */
export function isFinished(job: JobRecord): boolean {
  return (
    job.state === 'completed' ||
    job.state === 'failed' ||
    job.state === 'cancelled' ||
    job.state === 'needs-reconciliation' ||
    (job.state === 'interrupted' && job.error?.code === 'JOB_INTERRUPTED')
  );
}

export interface WaitOptions {
  progress: ProgressReporter;
  /** Seconds; when reached, the task is not cancelled and the result is `timeout`. */
  timeoutSec?: number | undefined;
  /** Only recognizes records after the Nth attempt (on retry, earlier terminal states do not count). */
  minAttempt?: number;
  /** Record used before the subscription snapshot arrives (`jobs wait` checks once first): tasks that have already ended need not wait for the snapshot. */
  initial?: JobRecord;
  /** Called on each record change (for things to do besides progress, such as printing command output line by line). */
  onUpdate?: (job: JobRecord) => void;
}

export type WaitOutcome = { kind: 'finished'; job: JobRecord } | { kind: 'timeout'; job: JobRecord | null };

/** Waits for `jobId` to reach a terminal state or time out; closes `watcher` when done. */
export function waitForJob(client: CucCutClient, jobId: string, watcher: JobWatcher, options: WaitOptions): Promise<WaitOutcome> {
  const { progress } = options;
  let latest: JobRecord | null = null;
  let settled = false;
  let cancelRequested = false;

  return new Promise<WaitOutcome>((resolve, reject) => {
    const cleanups: (() => void)[] = [() => watcher.close()];
    const settle = (outcome: WaitOutcome | Error) => {
      if (settled) return;
      settled = true;
      for (const cleanup of cleanups) cleanup();
      if (outcome instanceof Error) reject(outcome);
      else resolve(outcome);
    };

    const onJob = (job: JobRecord) => {
      if (job.jobId !== jobId || settled || job.attempt < (options.minAttempt ?? 1)) return;
      latest = job;
      progress.update(job);
      options.onUpdate?.(job);
      if (!isFinished(job)) return;
      progress.done(job);
      settle({ kind: 'finished', job });
    };

    watcher.listen(onJob);
    cleanups.push(
      client.onState((state) => {
        if (state.status === 'disconnected' || state.status === 'incompatible') {
          settle(new CliError('RUNTIME_UNAVAILABLE', M.runtimeLost(state.reason), { jobId }));
        }
      }),
    );

    if (options.timeoutSec !== undefined) {
      const seconds = options.timeoutSec;
      const timer = setTimeout(() => {
        progress.note(M.waitTimeout(seconds, jobId));
        settle({ kind: 'timeout', job: latest });
      }, seconds * 1000);
      cleanups.push(() => clearTimeout(timer));
    }

    const onSigint = () => {
      if (cancelRequested) process.exit(130);
      cancelRequested = true;
      progress.cancelling(jobId);
      client.request('jobs.cancel', { jobId }).catch((error: unknown) => progress.note(M.jobCancelFailed(String(error))));
    };
    process.on('SIGINT', onSigint);
    cleanups.push(() => process.off('SIGINT', onSigint));

    const current = watcher.records.get(jobId) ?? options.initial;
    if (current) onJob(current);
  });
}
