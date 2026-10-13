import type { ApplicationRecord, Id } from '@cuccut/protocol';
import { RecordJournal, type LedgerOptions } from './record-journal.ts';

/**
 * Application ledger (architecture design §7.2): `<runtime-home>/store/applications.jsonl` (append-only JSONL, format in `record-journal.ts`; the old `applications.json` is imported on first read and then renamed `.migrated`), kept separate from the job ledger. The result of an execution (the artifact) and “applied to the video” are two records: one task can have several applications (a re-run after restart, or the user's `jobs.reconcile apply`), and each one is written to the ledger first and then committed in a transaction.
 *
 * This is the authority for application state; the `applications` in a task record is its projection. Every write waits until it reaches disk (crash-safe ordering depends on this). Writes are serialized, so a write started later always lands after.
 */

/**
 * The position needed to reopen the video (given by the Runtime and handed back unchanged; the JobManager does not interpret it). After a restart no video is open, so before a re-run is applied, the video is reopened from this. If the directory is gone, or a different video is now in it, that is `stale-input`.
 */
export type VideoPlace = Record<string, unknown>;

/** One entry in the ledger: the public record, plus the position needed for recovery and how many times it has been committed (the sequence number of the next `commandId`). */
export interface StoredApplication {
  record: ApplicationRecord;
  place: VideoPlace | null;
  submissions: number;
}

export class ApplicationLedger {
  readonly file: string;
  readonly #items = new Map<Id, StoredApplication>();
  readonly #journal: RecordJournal;
  #frozen = false;

  constructor(file: string, options: LedgerOptions = {}) {
    this.file = file;
    this.#journal = new RecordJournal({
      file,
      keyField: 'applicationId',
      key: applicationKey,
      moveOnPut: true,
      legacy: file.endsWith('.jsonl') ? { file: file.slice(0, -1), records: legacyApplications } : undefined,
      writable: () => !this.#frozen,
      compaction: options.compaction,
      log: options.log,
    });
  }

  async load(): Promise<void> {
    const items = (await this.#journal.load()) as StoredApplication[];
    this.#items.clear();
    for (const item of items) this.#items.set(item.record.applicationId, item);
  }

  get(applicationId: Id): StoredApplication | undefined {
    return this.#items.get(applicationId);
  }

  /** The applications of one task, oldest first. */
  forJob(jobId: Id): StoredApplication[] {
    return [...this.#items.values()].filter((item) => item.record.jobId === jobId);
  }

  /** The most recent application of one task; undefined if there is none. */
  latest(jobId: Id): StoredApplication | undefined {
    return this.forJob(jobId).at(-1);
  }

  all(): StoredApplication[] {
    return [...this.#items.values()];
  }

  /** Writes one entry and waits until it reaches disk. */
  put(item: StoredApplication): Promise<void> {
    item.record.updatedAt = new Date().toISOString();
    this.#items.delete(item.record.applicationId);
    this.#items.set(item.record.applicationId, item);
    if (this.#frozen) return Promise.resolve();
    return this.#journal.put(item.record.applicationId, item);
  }

  /** Deletes the applications of these tasks (when the tasks are evicted). */
  remove(jobIds: ReadonlySet<Id>): Promise<void> {
    const removed: Id[] = [];
    for (const [id, item] of this.#items) {
      if (!jobIds.has(item.record.jobId)) continue;
      this.#items.delete(id);
      removed.push(id);
    }
    if (removed.length === 0 || this.#frozen) return Promise.resolve();
    return this.#journal.remove(removed);
  }

  /** Fault injection: simulates the process crashing at this moment; later writes are not persisted. */
  freeze(): void {
    this.#frozen = true;
  }

  flush(): Promise<void> {
    return this.#journal.flush();
  }
}

function applicationKey(value: unknown): string | null {
  const applicationId = (value as Partial<StoredApplication> | null)?.record?.applicationId;
  return typeof applicationId === 'string' ? applicationId : null;
}

/** Old format `applications.json`: `{ formatVersion: 1, applications: StoredApplication[] }`. */
function legacyApplications(data: unknown): unknown[] | null {
  const file = data as { formatVersion?: unknown; applications?: unknown } | null;
  return file?.formatVersion === 1 && Array.isArray(file.applications) ? file.applications : null;
}
