import type { JobRecord, JobWarning } from '@cuccut/protocol';
import type { VideoPlace } from './application-ledger.ts';
import type { GenerationInputSpec, TaskInputSpec, TranscribeInputSpec } from './input-hash.ts';
import { RecordJournal, type LedgerOptions } from './record-journal.ts';

/**
 * Job ledger: `<runtime-home>/store/jobs.jsonl` (append-only JSONL; every append is fsync'd; when the line count grows, the whole file is compacted, §7.3; format in `record-journal.ts`). Each entry is the public `JobRecord` plus the frozen task spec. Writes are serialized, so a write started later always lands after. The old `jobs.json` is imported on first read and then renamed `jobs.json.migrated`.
 */

export interface StoredJob {
  record: JobRecord;
  /**
   * A transcription task is `TranscribeInputSpec`; a generation task (`record.kind` is `synthesizeSpeech` / `generateImage`) is `GenerationInputSpec`; an export (`export`) is `TaskInputSpec`; a task executed by another module, which the JobManager only records (fixed flow), is `HostedJobSpec`.
   */
  spec: TranscribeInputSpec | GenerationInputSpec | TaskInputSpec | HostedJobSpec;
  /** Worker version of the first attempt: retries must match (architecture design §6.5). */
  workerVersion: string | null;
  /** The video's position at submission: on re-queue after a restart, the video is opened by it first (§7.5). None when there is no video. */
  videoPlace?: VideoPlace | null;
  /** Remote task ID (given after submission to an online Provider that can be queried; used to query after a restart, §7.5). No existing Provider has one yet. */
  remoteTaskId?: string;
  /** Publish intent (§7.3): recorded in the ledger before writing to the artifact store; cleared when the result and application are recorded (or the task ends). On restart, if it is present, artifacts are claimed by it. */
  publishing?: PublishIntent;
}

/** The artifacts to be published and the result. The artifact store is content-addressed, so artifact IDs are computed before writing. */
export interface PublishIntent {
  /** `sha256:<hex>`, in the order of application. */
  artifactIds: string[];
  /** The result after publishing (documents and asset IDs added after applying are not included). */
  result: NonNullable<JobRecord['result']>;
  /** The target reference when applying to the video; null when it is only published and not applied. */
  targetRefs: string[] | null;
  warnings: JobWarning[];
}

/** Hosted task: execution and frozen parameters are the host's responsibility (`hosted` is its name); here there is only the record. */
export interface HostedJobSpec {
  hosted: string;
}

/** Terminal states: `needs-reconciliation` also counts (no longer executed; waiting for the user to decide with `jobs.reconcile`). */
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'needs-reconciliation']);

export function isTerminal(state: JobRecord['state']): boolean {
  return TERMINAL.has(state);
}

export class JobLedger {
  readonly file: string;
  readonly #journal: RecordJournal;

  constructor(file: string, options: LedgerOptions = {}) {
    this.file = file;
    this.#journal = new RecordJournal({
      file,
      keyField: 'jobId',
      key: jobKey,
      moveOnPut: false,
      legacy: file.endsWith('.jsonl') ? { file: file.slice(0, -1), records: legacyJobs } : undefined,
      compaction: options.compaction,
      log: options.log,
    });
  }

  async load(): Promise<StoredJob[]> {
    return (await this.#journal.load()) as StoredJob[];
  }

  /**
   * Queues a write of a full snapshot (in creation order). It writes only the tasks that changed since the last write, plus the deleted tasks; nothing is written when nothing changed.
   * Returns a Promise that completes when this write completes (or, if nothing changed, when the write already queued completes).
   */
  save(jobs: readonly StoredJob[]): Promise<void> {
    return this.#journal.replace(jobs.map((job) => [job.record.jobId, job] as const));
  }

  /** Waits for all queued writes to complete. */
  flush(): Promise<void> {
    return this.#journal.flush();
  }
}

function jobKey(value: unknown): string | null {
  const jobId = (value as Partial<StoredJob> | null)?.record?.jobId;
  return typeof jobId === 'string' ? jobId : null;
}

/** Old format `jobs.json`: `{ formatVersion: 1, jobs: StoredJob[] }`. */
function legacyJobs(data: unknown): unknown[] | null {
  const file = data as { formatVersion?: unknown; jobs?: unknown } | null;
  return file?.formatVersion === 1 && Array.isArray(file.jobs) ? file.jobs : null;
}
