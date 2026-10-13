import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { canonicalJson, type FileJobObserver, type FileTranscribeRequest } from '@cuccut/jobs';
import {
  NODE_ERROR,
  NODE_ERROR_STATUS,
  NODE_JOB_ERROR,
  RpcError,
  newId,
  type Id,
  type JobRecord,
  type JobState,
  type JobSubmitter,
  type ModelBundleStatus,
  type NodeErrorCode,
  type NodeJob,
  type NodeJobEvent,
  type NodeJobRequest,
  type NodeJobState,
} from '@cuccut/protocol';
import { nodeJobRequestSchema } from '@cuccut/protocol/schemas';
import { silentNodeLog, type NodeLogger } from './node-logger.ts';
import { NodesServer as NS } from '@cuccut/protocol/messages/nodes';

/**
 * Remote tasks on the node (node protocol spec §5–§7).
 *
 * Here a task passes through `awaiting-input` (waiting for the initiator to upload the media). After the upload and digest check, it is handed to JobManager, which uses the same model-pack queue, the same Provider, the same crash retry and output validation as local tasks. JobManager's record changes are mapped to `NodeJob` and recorded as events with `seq`.
 * An automatic retry after a Worker crash is not reported externally as `interrupted` (the initiator would take it for a node restart); it only shows as `attempt` incrementing.
 *
 * Files: `<jobsDir>/<jobId>/input` (the uploaded media, deleted when the task terminates) and `result.json` (the validated result, deleted on `DELETE` or when the retention period after termination ends). Events and records are kept in memory. On Runtime restart the whole directory is cleared, and JobManager's ledger marks unfinished tasks as `interrupted`.
 */

/** Executor driven by NodeJobs: JobManager satisfies it structurally. */
export interface NodeJobRunner {
  submitFile(request: FileTranscribeRequest, submitter: JobSubmitter, observer?: FileJobObserver): Promise<{ jobId: Id }>;
  cancel(jobId: Id): Promise<{ state: JobState }>;
  onChange(listener: (job: JobRecord) => void): () => void;
  list(): JobRecord[];
}

/** Model pack status: ModelCatalog satisfies it structurally. */
export interface NodeModels {
  list(): Promise<ModelBundleStatus[]>;
  status(bundleId: string): Promise<ModelBundleStatus | null>;
}

export interface NodeLimits {
  /** Maximum number of unfinished tasks per client (1 running plus 8 queued). */
  maxActivePerClient: number;
  /** Media size limit (default 16 GiB). */
  maxInputBytes: number;
  /** Free space to keep at minimum on the disk where staging lives (default 2 GiB). */
  diskReserveBytes: number;
  /** Fail if the upload has not completed this long after creation (default 10 minutes). */
  inputExpiryMs: number;
  /** How long results and records are kept after termination (default 10 minutes). */
  resultRetentionMs: number;
  /** Maximum time for `cancel` to wait for the task to terminate (default 15 seconds). */
  cancelWaitMs: number;
  /** How many expired tasks to remember, so result requests can get `410` (default 1000). */
  tombstones: number;
}

export const DEFAULT_NODE_LIMITS: NodeLimits = {
  maxActivePerClient: 9,
  maxInputBytes: 16 * 1024 ** 3,
  diskReserveBytes: 2 * 1024 ** 3,
  inputExpiryMs: 10 * 60_000,
  resultRetentionMs: 10 * 60_000,
  cancelWaitMs: 15_000,
  tombstones: 1000,
};

/** Node protocol HTTP error: `code` determines the status code (spec §8). */
export class NodeHttpError extends Error {
  readonly code: NodeErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: NodeErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'NodeHttpError';
    this.code = code;
    this.status = NODE_ERROR_STATUS[code];
    this.details = details;
  }
}

type StoredEvent = Exclude<NodeJobEvent, { type: 'heartbeat' }>;
type EventListener = (event: StoredEvent | null) => void;
type WithoutSeq<T> = T extends unknown ? Omit<T, 'seq'> : never;

interface Entry {
  job: NodeJob;
  clientId: string;
  request: NodeJobRequest;
  fingerprint: string;
  dir: string;
  events: StoredEvent[];
  listeners: Set<EventListener>;
  inputTimer: ReturnType<typeof setTimeout> | null;
  retentionTimer: ReturnType<typeof setTimeout> | null;
  upload: AbortController | null;
  /** Already handed to JobManager. */
  submitted: boolean;
  /** The new attempt number for the automatic retry after a Worker crash; `interrupted` reported by JobManager during this period is not exposed externally. */
  retrying: number | null;
  output: { sha256: string; byteLength: number } | null;
  terminal: Promise<void>;
  settle: () => void;
}

export interface NodeJobsOptions {
  /** `<home>/staging/node-jobs` */
  dir: string;
  runner: NodeJobRunner;
  models: NodeModels;
  /** Whether this capability is currently open for sharing (all on by default). Checked only at creation: tasks already accepted are not affected by later switch changes. */
  capabilityEnabled?: (capability: string) => boolean;
  log?: NodeLogger;
  limits?: Partial<NodeLimits>;
  /** Free bytes on the disk where staging lives (default `fs.statfs`). */
  freeBytes?: (dir: string) => Promise<number>;
}

const TERMINAL = new Set<NodeJobState>(['completed', 'failed', 'cancelled', 'interrupted']);
const INPUT_FILE = 'input';
const RESULT_FILE = 'result.json';

export function isNodeJobTerminal(state: NodeJobState): boolean {
  return TERMINAL.has(state);
}

export class NodeJobs {
  readonly limits: NodeLimits;
  readonly #dir: string;
  readonly #runner: NodeJobRunner;
  readonly #models: NodeModels;
  readonly #capabilityEnabled: (capability: string) => boolean;
  readonly #log: NodeLogger;
  readonly #freeBytes: (dir: string) => Promise<number>;
  readonly #entries = new Map<Id, Entry>();
  /** `<clientId>\n<clientJobId>` → jobId */
  readonly #idempotency = new Map<string, Id>();
  /** Tasks whose retention period has ended and were deleted: jobId → clientId (result requests get `410`). */
  readonly #expired = new Map<Id, string>();
  readonly #unsubscribe: () => void;

  constructor(options: NodeJobsOptions) {
    this.limits = { ...DEFAULT_NODE_LIMITS, ...options.limits };
    this.#dir = options.dir;
    this.#runner = options.runner;
    this.#models = options.models;
    this.#capabilityEnabled = options.capabilityEnabled ?? (() => true);
    this.#log = options.log ?? silentNodeLog;
    this.#freeBytes = options.freeBytes ?? diskFreeBytes;
    this.#unsubscribe = this.#runner.onChange((record) => this.#onRecord(record));
  }

  /** Runtime startup: delete any remote task directories left over from last time (their tasks are no longer in memory). */
  async sweep(): Promise<void> {
    await fs.rm(this.#dir, { recursive: true, force: true });
    await fs.mkdir(this.#dir, { recursive: true });
  }

  /** Number of remote tasks on this node (`ShareStatus.jobs`). */
  counts(): { running: number; queued: number } {
    let running = 0;
    let queued = 0;
    for (const entry of this.#entries.values()) {
      if (entry.job.state === 'running') running++;
      else if (entry.job.state === 'queued') queued++;
    }
    return { running, queued };
  }

  // ---- §5.1 Create ----

  async create(clientId: string, body: unknown): Promise<{ created: boolean; job: NodeJob }> {
    const parsed = nodeJobRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.taskRequestInvalid().text, {
        issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const request = parsed.data as NodeJobRequest;
    const fingerprint = canonicalJson(request);
    const key = `${clientId}\n${request.clientJobId}`;
    const existing = this.#idempotent(key, fingerprint);
    if (existing) return { created: false, job: existing };

    if (!this.#capabilityEnabled(request.kind)) {
      throw new NodeHttpError(NODE_ERROR.CAPABILITY_DISABLED, NS.transcribeNotShared().text, { capability: request.kind });
    }
    const status = await this.#models.status(request.bundleId);
    if (!status || status.capability !== 'transcribe' || status.state === 'not-installed' || status.state === 'error') {
      throw new NodeHttpError(NODE_ERROR.MODEL_NOT_READY, NS.bundleNotReady().text, {
        bundleId: request.bundleId,
        state: status?.state ?? 'unknown',
        ...(status?.reason ? { reason: status.reason } : {}),
      });
    }
    this.#checkQueue(clientId);
    if (request.input.byteLength > this.limits.maxInputBytes) {
      throw new NodeHttpError(NODE_ERROR.INPUT_TOO_LARGE, NS.inputTooLarge().text, { maxBytes: this.limits.maxInputBytes });
    }
    await fs.mkdir(this.#dir, { recursive: true });
    const free = await this.#freeBytes(this.#dir);
    if (free < request.input.byteLength + this.limits.diskReserveBytes) {
      throw new NodeHttpError(NODE_ERROR.DISK_LOW, NS.diskLow().text);
    }

    // Between the two awaits, a create with the same idempotency key may have arrived, or other tasks may have filled the queue.
    const raced = this.#idempotent(key, fingerprint);
    if (raced) return { created: false, job: raced };
    this.#checkQueue(clientId);

    const jobId = newId('job');
    const dir = path.join(this.#dir, jobId);
    let settle!: () => void;
    const terminal = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const entry: Entry = {
      job: {
        jobId,
        clientJobId: request.clientJobId,
        state: 'awaiting-input',
        phase: 'awaiting-input',
        progress: null,
        attempt: 1,
        error: null,
        output: null,
        lastSeq: 0,
      },
      clientId,
      request,
      fingerprint,
      dir,
      events: [],
      listeners: new Set(),
      inputTimer: null,
      retentionTimer: null,
      upload: null,
      submitted: false,
      retrying: null,
      output: null,
      terminal,
      settle,
    };
    this.#entries.set(jobId, entry);
    this.#idempotency.set(key, jobId);
    entry.inputTimer = setTimeout(() => {
      entry.inputTimer = null;
      if (entry.job.state !== 'awaiting-input') return;
      entry.upload?.abort();
      this.#log.warn('Remote job media was not uploaded in time', { jobId, clientId });
      void this.#finishLocal(entry, 'failed', { code: NODE_JOB_ERROR.INPUT_EXPIRED, message: NS.uploadExpired().text });
    }, this.limits.inputExpiryMs);
    entry.inputTimer.unref?.();
    await fs.mkdir(dir, { recursive: true });
    this.#emitJob(entry);
    this.#log.info('Remote job created', { jobId, clientId, bundleId: request.bundleId, byteLength: request.input.byteLength });
    return { created: true, job: structuredClone(entry.job) };
  }

  // ---- §5.2 Upload ----

  /**
   * Stream the request body into the task directory while computing its sha256. `contentLength` is the request header's value (if it is missing, the caller first returns 400).
   * If the digest and length both match, hand the task to JobManager. If they do not, the task fails with `INPUT_HASH_MISMATCH` and the media is deleted immediately.
   * If the connection drops during the upload, delete the partial file; the task still waits for the upload.
   */
  async upload(clientId: string, jobId: Id, contentLength: number, body: Readable): Promise<void> {
    const entry = this.#own(clientId, jobId);
    if (entry.job.state !== 'awaiting-input' || entry.upload) {
      throw new NodeHttpError(NODE_ERROR.INVALID_STATE, NS.notAwaitingUpload().text, { state: entry.job.state });
    }
    const expected = entry.request.input;
    if (contentLength !== expected.byteLength) {
      await this.#rejectInput(entry, NS.lengthMismatch().text);
      throw new NodeHttpError(NODE_ERROR.INPUT_HASH_MISMATCH, NS.lengthMismatch().text, {
        expectedBytes: expected.byteLength,
        receivedBytes: contentLength,
      });
    }

    const controller = new AbortController();
    entry.upload = controller;
    const file = path.join(entry.dir, INPUT_FILE);
    const partial = `${file}.part`;
    const hash = crypto.createHash('sha256');
    let received = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      await pipeline(body, meter, createWriteStream(partial), { signal: controller.signal });
    } catch (error) {
      await fs.rm(partial, { force: true }).catch(() => {});
      if (entry.upload === controller) entry.upload = null;
      if (controller.signal.aborted) throw new NodeHttpError(NODE_ERROR.INVALID_STATE, NS.noLongerAwaitingUpload().text, { state: entry.job.state });
      // The initiator disconnected: the task still waits for upload, and re-upload is allowed.
      this.#log.warn('Remote job upload interrupted', { jobId, clientId });
      throw error;
    }
    entry.upload = null;
    if (entry.job.state !== 'awaiting-input') {
      await fs.rm(partial, { force: true }).catch(() => {});
      throw new NodeHttpError(NODE_ERROR.INVALID_STATE, NS.noLongerAwaitingUpload().text, { state: entry.job.state });
    }
    const digest = `sha256:${hash.digest('hex')}`;
    if (received !== expected.byteLength || digest !== expected.contentHash) {
      await fs.rm(partial, { force: true }).catch(() => {});
      await this.#rejectInput(entry, NS.digestMismatch().text);
      throw new NodeHttpError(NODE_ERROR.INPUT_HASH_MISMATCH, NS.digestOrLengthMismatch().text);
    }
    await fs.rename(partial, file);
    if (entry.inputTimer) clearTimeout(entry.inputTimer);
    entry.inputTimer = null;

    // Handing off to JobManager: the first record change (queued) arrives before submitFile returns, so mark it first.
    entry.submitted = true;
    const options = entry.request.options;
    try {
      await this.#runner.submitFile(
        {
          jobId,
          file,
          contentHash: expected.contentHash,
          bundleId: entry.request.bundleId,
          language: options.language,
          track: expected.track,
          range: expected.range,
          diarize: options.diarize,
          hint: options.hint ?? null,
          timescale: options.timescale,
          resultFile: path.join(entry.dir, RESULT_FILE),
        },
        { kind: 'node', id: clientId },
        this.#observer(entry),
      );
    } catch (error) {
      entry.submitted = false;
      const unavailable = error instanceof RpcError && error.code === 'conflict';
      const bundle = unavailable ? (error.details as { bundle?: ModelBundleStatus | null } | undefined)?.bundle : undefined;
      await this.#finishLocal(
        entry,
        'failed',
        unavailable
          ? { code: 'MODEL_LOAD_FAILED', message: NS.bundleNotReady().text, details: { state: bundle?.state ?? 'unknown' } }
          : { code: 'JOB_INTERRUPTED', message: NS.notAccepted().text },
      );
      if (unavailable) throw new NodeHttpError(NODE_ERROR.MODEL_NOT_READY, NS.bundleNotReady().text, { state: bundle?.state ?? 'unknown' });
      throw new NodeHttpError(NODE_ERROR.INVALID_STATE, NS.notAccepted().text);
    }
    this.#log.info('Remote job media verified; queued', { jobId, clientId });
  }

  // ---- §5.3 Read, cancel, delete ----

  get(clientId: string, jobId: Id): NodeJob {
    return structuredClone(this.#own(clientId, jobId).job);
  }

  /** Idempotent. A running task is waited on until it terminates, for at most `cancelWaitMs`; on timeout, the current state is returned. */
  async cancel(clientId: string, jobId: Id): Promise<NodeJob> {
    const entry = this.#own(clientId, jobId);
    await this.#cancel(entry, this.limits.cancelWaitMs);
    return structuredClone(entry.job);
  }

  /** Unfinished tasks are cancelled first, then the media, result, events and record are deleted. After that, this task always returns 404. */
  async remove(clientId: string, jobId: Id): Promise<void> {
    const entry = this.#own(clientId, jobId);
    await this.#cancel(entry, null);
    await this.#drop(entry, false);
  }

  /** When a client is revoked, all its tasks are cancelled and deleted. */
  async removeClient(clientId: string): Promise<void> {
    const entries = [...this.#entries.values()].filter((e) => e.clientId === clientId);
    await Promise.allSettled(entries.map((e) => this.#cancel(e, null)));
    await Promise.allSettled(entries.map((e) => this.#drop(e, false)));
    for (const [jobId, owner] of this.#expired) if (owner === clientId) this.#expired.delete(jobId);
  }

  /** When sharing is closed or the Runtime stops, all remote tasks are cancelled and deleted. */
  async closeAll(): Promise<void> {
    const entries = [...this.#entries.values()];
    await Promise.allSettled(entries.map((e) => this.#cancel(e, null)));
    await Promise.allSettled(entries.map((e) => this.#drop(e, false)));
    this.#expired.clear();
    await fs.rm(this.#dir, { recursive: true, force: true }).catch(() => {});
  }

  /** Stop receiving changes from JobManager (the last step of stopping the Runtime). */
  detach(): void {
    this.#unsubscribe();
  }

  // ---- §6 Events ----

  /**
   * Subscribe to a task's events. First give the existing events with `seq > since`. If the task has already terminated, `done` is true (the caller closes the stream after writing).
   * Otherwise, later events are passed to `listener` one by one. After the terminal event, or when the task is deleted, `listener(null)` signals the end.
   */
  subscribe(clientId: string, jobId: Id, since: number, listener: EventListener): { backlog: StoredEvent[]; done: boolean; close(): void } {
    const entry = this.#own(clientId, jobId);
    const backlog = entry.events.filter((e) => e.seq > since);
    if (isNodeJobTerminal(entry.job.state)) return { backlog, done: true, close() {} };
    entry.listeners.add(listener);
    return { backlog, done: false, close: () => entry.listeners.delete(listener) };
  }

  // ---- §7 Result ----

  result(clientId: string, jobId: Id): { file: string; sha256: string; byteLength: number } {
    const entry = this.#entries.get(jobId);
    if (!entry || entry.clientId !== clientId) {
      if (this.#expired.get(jobId) === clientId) throw new NodeHttpError(NODE_ERROR.RESULT_EXPIRED, NS.resultDeleted().text);
      throw new NodeHttpError(NODE_ERROR.JOB_NOT_FOUND, NS.taskNotFound().text);
    }
    if (entry.job.state !== 'completed') throw new NodeHttpError(NODE_ERROR.INVALID_STATE, NS.taskNotCompleted().text, { state: entry.job.state });
    if (!entry.output) throw new NodeHttpError(NODE_ERROR.RESULT_EXPIRED, NS.resultDeleted().text);
    return { file: path.join(entry.dir, RESULT_FILE), ...entry.output };
  }

  // ---- Internal ----

  #own(clientId: string, jobId: Id): Entry {
    const entry = this.#entries.get(jobId);
    // Other clients' tasks are always treated as nonexistent.
    if (!entry || entry.clientId !== clientId) throw new NodeHttpError(NODE_ERROR.JOB_NOT_FOUND, NS.taskNotFound().text);
    return entry;
  }

  #idempotent(key: string, fingerprint: string): NodeJob | null {
    const jobId = this.#idempotency.get(key);
    const entry = jobId ? this.#entries.get(jobId) : undefined;
    if (!entry) return null;
    if (entry.fingerprint !== fingerprint) throw new NodeHttpError(NODE_ERROR.IDEMPOTENCY_CONFLICT, NS.idempotencyConflict().text);
    return structuredClone(entry.job);
  }

  #checkQueue(clientId: string): void {
    let active = 0;
    for (const entry of this.#entries.values()) if (entry.clientId === clientId && !isNodeJobTerminal(entry.job.state)) active++;
    if (active >= this.limits.maxActivePerClient) {
      throw new NodeHttpError(NODE_ERROR.QUEUE_FULL, NS.queueFull().text, { limit: this.limits.maxActivePerClient });
    }
  }

  #observer(entry: Entry): FileJobObserver {
    return {
      warning: (warning) => {
        if (isNodeJobTerminal(entry.job.state)) return;
        const { code, segmentId, detail } = warning;
        this.#emit(entry, {
          type: 'warning',
          warning: { code, ...(segmentId !== undefined ? { segmentId } : {}), ...(detail !== undefined ? { detail } : {}) },
        });
      },
      language: (tag, confidence) => {
        if (!isNodeJobTerminal(entry.job.state)) this.#emit(entry, { type: 'language', tag, confidence });
      },
      retrying: (attempt) => {
        entry.retrying = attempt;
      },
      output: (output) => {
        entry.output = { sha256: output.sha256, byteLength: output.byteLength };
      },
    };
  }

  /** JobManager record change → NodeJob. */
  #onRecord(record: JobRecord): void {
    const entry = this.#entries.get(record.jobId);
    if (!entry || !entry.submitted || isNodeJobTerminal(entry.job.state)) return;
    // Automatic retry after a crash: this one is marked interrupted, then immediately goes back to running. The initiator only sees the attempt number increase.
    if (record.state === 'interrupted' && entry.retrying !== null && record.endedAt === null) return;
    if (record.state === 'running' && entry.retrying !== null && record.attempt >= entry.retrying) entry.retrying = null;
    const job = entry.job;
    // The node runs only local transcription, so no outbound-call `needs-reconciliation` will occur; if one does, treat it as an interruption.
    const state: NodeJobState = record.state === 'needs-reconciliation' ? 'interrupted' : record.state;
    const next: Omit<NodeJob, 'lastSeq'> = {
      jobId: job.jobId,
      clientJobId: job.clientJobId,
      state,
      phase: record.phase,
      // The node only transcribes, so progress is measured only in seconds and segments.
      progress:
        record.progress && (record.progress.unit === 'seconds' || record.progress.unit === 'segments')
          ? { done: record.progress.done, total: record.progress.total, unit: record.progress.unit }
          : null,
      attempt: record.attempt,
      error: remoteError(record.error),
      output: state === 'completed' ? entry.output : null,
    };
    if (state === 'completed' && !entry.output) {
      next.state = 'failed';
      next.error = { code: 'INTERNAL', message: NS.completedWithoutResult().text };
    }
    if (sameJob(job, next)) return;
    Object.assign(job, next);
    this.#emitJob(entry);
    if (isNodeJobTerminal(job.state)) void this.#terminated(entry);
  }

  /** The node itself ends the task (cancelled while waiting for upload, upload mismatch, upload expired, or it could not enter the queue). */
  async #finishLocal(entry: Entry, state: 'failed' | 'cancelled', error: NodeJob['error']): Promise<void> {
    if (isNodeJobTerminal(entry.job.state)) return;
    Object.assign(entry.job, { state, phase: 'done', progress: null, error, output: null } satisfies Partial<NodeJob>);
    this.#emitJob(entry);
    await this.#terminated(entry);
  }

  async #rejectInput(entry: Entry, message: string): Promise<void> {
    await this.#finishLocal(entry, 'failed', { code: NODE_JOB_ERROR.INPUT_HASH_MISMATCH, message });
  }

  /** On termination: delete the uploaded media (if there is no result, the whole directory), and start the result's retention period. */
  async #terminated(entry: Entry): Promise<void> {
    if (entry.inputTimer) clearTimeout(entry.inputTimer);
    entry.inputTimer = null;
    entry.upload?.abort();
    const { jobId } = entry.job;
    this.#log.info('Remote job finished', { jobId, clientId: entry.clientId, state: entry.job.state, code: entry.job.error?.code });
    if (entry.job.state === 'completed') {
      await fs.rm(path.join(entry.dir, INPUT_FILE), { force: true }).catch(() => {});
      await fs.rm(path.join(entry.dir, `${INPUT_FILE}.part`), { force: true }).catch(() => {});
    } else {
      await fs.rm(entry.dir, { recursive: true, force: true }).catch(() => {});
    }
    if (this.#entries.get(jobId) === entry && !entry.retentionTimer) {
      entry.retentionTimer = setTimeout(() => {
        entry.retentionTimer = null;
        void this.#drop(entry, true);
      }, this.limits.resultRetentionMs);
      entry.retentionTimer.unref?.();
    }
    entry.settle();
  }

  async #cancel(entry: Entry, waitMs: number | null): Promise<void> {
    const state = entry.job.state;
    if (isNodeJobTerminal(state)) return;
    if (!entry.submitted) {
      entry.upload?.abort();
      await this.#finishLocal(entry, 'cancelled', null);
      return;
    }
    const cancelled = this.#runner.cancel(entry.job.jobId).catch((error: unknown) => {
      this.#log.warn('Failed to cancel remote job', { jobId: entry.job.jobId, error: String(error) });
    });
    const done = Promise.all([cancelled, entry.terminal]);
    if (waitMs === null) {
      await done;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([done, new Promise((resolve) => (timer = setTimeout(resolve, waitMs)))]);
    clearTimeout(timer);
  }

  /** Delete a task's files, events and record. On `expired`, leave a tombstone so result requests get `410`. */
  async #drop(entry: Entry, expired: boolean): Promise<void> {
    const { jobId } = entry.job;
    if (this.#entries.get(jobId) !== entry) return;
    this.#entries.delete(jobId);
    const key = `${entry.clientId}\n${entry.job.clientJobId}`;
    if (this.#idempotency.get(key) === jobId) this.#idempotency.delete(key);
    if (entry.inputTimer) clearTimeout(entry.inputTimer);
    if (entry.retentionTimer) clearTimeout(entry.retentionTimer);
    entry.upload?.abort();
    for (const listener of entry.listeners) listener(null);
    entry.listeners.clear();
    if (expired) {
      this.#expired.set(jobId, entry.clientId);
      while (this.#expired.size > this.limits.tombstones) this.#expired.delete(this.#expired.keys().next().value!);
    }
    await fs.rm(entry.dir, { recursive: true, force: true }).catch(() => {});
    this.#log.info(expired ? 'Remote job expired and was deleted' : 'Remote job deleted', { jobId, clientId: entry.clientId });
  }

  #emitJob(entry: Entry): void {
    this.#emit(entry, { type: 'job' });
  }

  /** Record an event and pass it to the subscribers. `job` events carry the complete NodeJob as it was emitted (`lastSeq` is that event's seq). */
  #emit(entry: Entry, payload: { type: 'job' } | WithoutSeq<Extract<StoredEvent, { type: 'warning' | 'language' }>>): void {
    const seq = entry.job.lastSeq + 1;
    entry.job.lastSeq = seq;
    const event: StoredEvent =
      payload.type === 'job' ? { seq, type: 'job', job: structuredClone(entry.job) } : ({ seq, ...payload } as StoredEvent);
    entry.events.push(event);
    const terminal = event.type === 'job' && isNodeJobTerminal(event.job.state);
    for (const listener of [...entry.listeners]) {
      listener(event);
      if (terminal) listener(null);
    }
    if (terminal) entry.listeners.clear();
  }
}

function sameJob(current: NodeJob, next: Omit<NodeJob, 'lastSeq'>): boolean {
  const { lastSeq: _lastSeq, ...rest } = current;
  return canonicalJson(rest) === canonicalJson(next);
}

/**
 * Task error handed to the initiator: the node's local diagnostics are stripped (the Worker's stderr tail may contain local paths); everything else is kept as is.
 * The diagnostics remain in the node's own `jobs` topic and ledger.
 */
function remoteError(error: JobRecord['error']): NodeJob['error'] {
  if (!error) return null;
  const { code, message, details } = error;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const { stderrTail: _stderrTail, ...rest } = details as Record<string, unknown>;
    return { code, message, details: rest };
  }
  return details === undefined ? { code, message } : { code, message, details };
}

async function diskFreeBytes(dir: string): Promise<number> {
  const stats = await fs.statfs(dir);
  return Number(stats.bavail) * Number(stats.bsize);
}
