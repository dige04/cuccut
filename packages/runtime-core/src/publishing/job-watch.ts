import type { Logger } from '@cuccut/harness';
import { isTerminal } from '@cuccut/jobs';
import type { Id, JobRecord } from '@cuccut/protocol';

/** The part of the JobManager publishing reads: job records and their changes. */
export interface PublishingJobSource {
  inspect(jobId: Id): JobRecord;
  onChange(listener: (job: JobRecord) => void): () => void;
}

/**
 * Waits for jobs publishing started ("Render and pin" exports, copy proposals) to finish. One `onChange` subscription serves every watched job; it is
 * taken on the first watch and dropped on `close`.
 */
export class JobWatch {
  readonly #jobs: PublishingJobSource;
  readonly #log: Logger;
  readonly #watchers = new Map<Id, Array<(job: JobRecord | null) => void>>();
  #unsubscribe: (() => void) | null = null;

  constructor(jobs: PublishingJobSource, log: Logger) {
    this.#jobs = jobs;
    this.#log = log;
  }

  /** Calls `done` once when the job is in a final state: at once when it already is, with null when the job no longer exists. */
  watch(jobId: Id, done: (job: JobRecord | null) => void): void {
    let job: JobRecord | null;
    try {
      job = this.#jobs.inspect(jobId);
    } catch {
      job = null;
    }
    if (!job || isTerminal(job.state)) {
      queueMicrotask(() => this.#call(done, job, jobId));
      return;
    }
    this.#unsubscribe ??= this.#jobs.onChange((changed) => this.#changed(changed));
    const list = this.#watchers.get(jobId) ?? [];
    list.push(done);
    this.#watchers.set(jobId, list);
  }

  /** Jobs still being waited for. */
  get pending(): number {
    return this.#watchers.size;
  }

  #changed(job: JobRecord): void {
    if (!isTerminal(job.state)) return;
    const list = this.#watchers.get(job.jobId);
    if (!list) return;
    this.#watchers.delete(job.jobId);
    for (const done of list) this.#call(done, job, job.jobId);
  }

  #call(done: (job: JobRecord | null) => void, job: JobRecord | null, jobId: Id): void {
    try {
      done(job);
    } catch (error) {
      this.#log.warn('Handling a finished job failed', { jobId, error: String(error) });
    }
  }

  close(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#watchers.clear();
  }
}
