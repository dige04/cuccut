import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_TEXT_CONCURRENCY,
  RpcError,
  TEXT_PREVIEW_CHARS,
  newId,
  nowIso,
  type ApplicationRecord,
  type EditOperation,
  type GenerateImageRequest,
  type GenerateMusicRequest,
  type GenerateTextRequest,
  type GeneratedOutput,
  type FrozenSpeechReference,
  type GenerationParameters,
  type JobLibraryUse,
  type Id,
  type JobCancellation,
  type JobError,
  type JobCommandRun,
  type JobGrantUse,
  type JobPhase,
  type JobProgress,
  type JobReconcileDecision,
  type JobRecord,
  type JobState,
  type JobSubmitter,
  type JobWarning,
  type JobLiveSegment,
  type JobsSnapshot,
  type LanguageRequest,
  type ModelInfoBase,
  type ModelServiceCapability,
  type ProviderKind,
  type SynthesizeSpeechRequest,
  type TextJobResult,
  type TranscribeRequest,
  type TranscriptReplace,
  type DocumentRecord,
} from '@cuccut/protocol';
import { compileJsonSchema } from '@cuccut/protocol/json-schema';
import {
  ASR_RESULT_SCHEMA,
  DEFAULT_TIMESCALE,
  ProviderFailure,
  builtinReferenceFile,
  bundleUsable,
  canonicalLanguageTag,
  capabilityNotConfiguredError,
  checkTranscribeOptions,
  imageParameters,
  freezeReferenceFile,
  localImageSeed,
  localMusicSeed,
  musicParameters,
  planLocalVoice,
  speechParameters,
  textParameters,
  validateAsrResult,
  type AsrResult,
  type GenerationCapability,
  type GenerationOutputFile,
  type GenerationProvider,
  type GenerationSelection,
  type GenerationSink,
  type GenerationTarget,
  type JobOutput,
  type ModelCatalog,
  type ProviderQueue,
  type TextParameters,
  type TextResult,
  type TickRange,
  type TranscribeProvider,
  type TranscribeSelection,
  type TranscribeSink,
  type TranscribeTarget,
  type WorkerFootprint,
} from '@cuccut/models';
import { ApplicationLedger, type StoredApplication, type VideoPlace } from './application-ledger.ts';
import { ArtifactStore, artifactIdOf, collectArtifactIds, type ArtifactExtension } from './artifact-store.ts';
import { generatedImportOperation } from './generated-import.ts';
import { JobsManager as J } from '@cuccut/protocol/messages/jobs/job-manager.ts';
import { LocalizedError, asLocalized, errorText, jobError, jobWarning, withCause, type JobText } from './job-text.ts';
import {
  canonicalJson,
  generationInputHash,
  sha256Hex,
  transcribeInputHash,
  type GenerationInputSpec,
  type TaskInputSpec,
  type TranscribeInputSpec,
} from './input-hash.ts';
import { JobLedger, isTerminal, type HostedJobSpec, type PublishIntent, type StoredJob } from './job-ledger.ts';
import { isJobError, type JobAdmission, type JobGrantHint } from './job-admission.ts';
import {
  ApplicationRunner,
  SimulatedCrash,
  StaleInput,
  applicationOpen,
  type AppliedReceipt,
  type ApplicationRun,
  type ApplicationTarget,
  type JobFaultPoint,
  type JobFaults,
} from './job-application.ts';
import { reconcileChoices, reconcileNotAllowed } from './job-reconcile.ts';
import {
  cancellationFacts,
  isExternalProvider,
  recoveryAction,
  retryable,
  type RecoveryAction,
  type RemoteTaskQuery,
} from './job-recovery.ts';
import { libraryVoice, localLibraryVoice, transcribeGlossaries, type JobLibrary } from './job-library.ts';
import { silentLog, type JobsLogger } from './jobs-logger.ts';
import { localImageResources, localMusicResources, localTranscribeResources } from './resource-profiles.ts';
import {
  ResourceExceedsCapacity,
  ResourceScheduler,
  type ResourceLease,
  type ResourceRequest,
  type ResourceTicket,
} from './resource-scheduler.ts';
import { unavailableProbe, type MediaFacts, type MediaProbe } from './media-probe.ts';
import { speechDocumentOperation } from './speech-document.ts';
import { contentFingerprint, nextRevision, planTranscriptSwitch } from './transcript-switch.ts';
import { JobsTranscribe } from '@cuccut/protocol/messages/jobs/transcribe.ts';
import { EditorWasmError } from '@cuccut/editor-wasm';
import { ensureSaveDirectory, readableStem } from './pipelines/save-location.ts';
import { publishFile } from './pipelines/transcode.ts';

/**
 * JobManager (architecture design §7): the ledger, queueing, execution, validation, publishing and applying of speech-recognition jobs.
 *
 * A transcription: choose the provider and model (§6.2, via `TranscribeRouter`) → freeze the inputs (asset version, content digest, language, provider and model)
 * → queue (FIFO per queue) → provider execution
 * → read `result.json` from staging, check the digest and length, validate against the contract → publish as a content-addressed artifact → apply: confirm the asset has not changed,
 * then write a `speech` document as the `system` identity (§7.3). Staging is deleted when the job ends; raw results that fail validation are moved to the diagnostics directory.
 *
 * While a job runs, it holds a lease on the video, so the video is not closed when the UI disconnects. If a worker crashes, it is retried once (§6.5). When the Runtime restarts, unfinished jobs are handled by the recovery matrix
 * (§7.5, `job-recovery.ts`): execution is not resumed; jobs that never started are re-validated and queued; outbound calls with unknown outcome wait for the user to reconcile.
 *
 * Execution and apply are separate (§7.1–§7.3): after an artifact is published, “apply to video” is a separate record (`ApplicationRecord`, in the application ledger `applications.jsonl`). It is written to the ledger before the transaction is committed, and the receipt is recorded after the commit; after a restart, the receipt is first looked up by the recorded `commandId`, so nothing is written twice.
 * The budget for outbound calls is settled when the artifact is published: whether the apply later succeeds does not affect the budget, and a deferred apply does not call again or bill twice.
 *
 * Providers are decided by the registry (`ModelServices`): local (`local`) has one queue per model package, one job at a time; paired LAN nodes
 * (`node:<nodeId>`, §6.7) each have one queue, one job at a time (the node queues on its own), and the local model catalog is not checked; online providers
 * (`openai`, `google`, `custom:<slug>`, §6.4) have one queue per provider, with a concurrency limit given by the provider (default 2), and do not touch the local
 * model-package queues or the model catalog. Results always come back to be validated, published and applied. Node rejections and disconnections are not retried (`REMOTE_NODE_REJECTED` /
 * `REMOTE_NODE_LOST`); a job failure on a node keeps the error code the node gives, and `details.node` records the node. Online provider rejections
 * (`PROVIDER_AUTH_FAILED`, `PROVIDER_QUOTA_EXCEEDED`, `PROVIDER_REJECTED`) and unavailability (`PROVIDER_UNAVAILABLE`, after the adapter has already retried with backoff) are not retried here.
 *
 * Generation jobs (`synthesizeSpeech`, `generateImage`, §6.6): at submission, choose the provider and model, check the parameters against the model's capabilities and freeze them
 * (text over the limit is rejected at submission, not truncated or split) → queue on the provider → the provider writes the output into staging → check the digest and length, check the format by file header, decode with ffprobe (audio reports duration, sample rate and channels; images report width and height) → publish as an artifact → if a video is given, import it as a candidate asset in one transaction under the `system:jobs` identity (not placed on the timeline). Text generation (`generateText`) goes through the same submission and queuing; its executor is the `TextJobGenerator`, which shares the concurrency limit. The result is UTF-8 text (structured output is validated against its schema once more), published as a `.txt` / `.json` artifact, and not imported into a video.
 * Deduplication is by `commandId` only: two submissions with the same parameters are two jobs. There is no automatic retry,
 * and no model or voice is swapped.
 *
 * Jobs that do not go through a model (`submitTask`, the first being export, §9.11): the caller freezes the inputs and does the preflight before submitting, and hands over an execution function; this code only manages the ledger, queuing, staging, cancellation and terminal states. A normal return from the execution function means completion (the file is already published, and it is not rewritten to “cancelled” because of a cancel); throwing `TaskFailure` is a failure; after the signal aborts, a cancellation or interruption is thrown. The execution function lives only in memory: after a Runtime restart the job is marked `interrupted`.
 *
 * Another kind of job target is a “file” (`submitFile`, a remote job that a LAN node runs for another machine, §6.7): the input is a file given by the caller plus its content digest. It is queued in the same queue, goes through the same provider, with the same crash retry and output validation. Once validation passes, the result file is handed back to the caller and the job ends: no artifact is published, and no video is touched. The record has no video or asset, and `result` is null; neither the result nor the transcript text enters the ledger, the logs or the diagnostics directory.
 */

/** Input for an asset version: the absolute path of the file and the version record. */
export interface JobAssetSource {
  file: string;
  revision: string;
  contentHash: string;
  mediaType: string;
}

/** Video capabilities JobManager needs; implemented by the Runtime with VideoService. */
export interface JobVideos {
  /** Keeps the video open while a job is running. */
  retain(videoId: Id): void;
  release(videoId: Id): void;
  /** The file and record of an asset version; throws `RpcError` when the video is not open, or the asset or version does not exist. */
  source(videoId: Id, assetId: Id, revision?: string): Promise<JobAssetSource>;
  /** The video's current version and the asset's current version; null when the video is not open, and `asset` is null when the asset is missing. */
  current(videoId: Id, assetId: Id): { videoRevision: string; asset: { revision: string; contentHash: string } | null } | null;
  /** The video's current version; null when it is not open. */
  videoRevision(videoId: Id): string | null;
  /** Submits an edit as the Runtime itself (`system`); `run` is this execution (the engine-side stop barrier, §7.4). */
  apply(
    videoId: Id,
    request: { commandId: Id; expectedRevision: string; operations: EditOperation[]; label: string; run?: ApplicationRun },
  ): Promise<{ refs?: Record<string, Id>; transactionId?: Id; videoRevision?: string }>;
  /** Position of the open video (recorded in the ledger, used to reopen after a restart); null when not open. */
  place?(videoId: Id): VideoPlace | null;
  /**
   * Reopens the video at the recorded position and holds a lease (released later with `release`). If the directory is gone it is `missing`; if a different video is there it is `mismatch`
   * (neither holds a lease). Throws when it cannot be opened (locked by another process, engine unavailable).
   */
  reopen?(videoId: Id, place: VideoPlace): Promise<'opened' | 'missing' | 'mismatch'>;
  /** Looks up the receipt of an already committed transaction from the engine by `commandId`; null if there is none. The video must already be open. */
  receipt?(videoId: Id, commandId: Id): Promise<AppliedReceipt | null>;
  /**
   * Engine-side stop barrier (§7.4): the request is sent synchronously at call time; after that, any commit of this execution generation that reaches the engine is rejected (`TASK_STOPPED`).
   * When it is fulfilled, every commit previously handed to the engine has a result. If the video is not open or the engine is absent, it fulfills with false (only the Node-side barrier remains).
   */
  invalidateRun?(videoId: Id, run: ApplicationRun): Promise<boolean>;
  /** The video's current version and document record; null when not open. Replacing the transcript (`TranscribeRequest.replace`) needs it; without it the replacement is rejected. */
  state?(videoId: Id): { revision: string; documents: Record<Id, DocumentRecord> } | null;
  /** The body of one version of a document (the current version if not given). Needed for replacing the transcript. */
  document?(videoId: Id, documentId: Id, revision?: string): Promise<{ revision: string; body: unknown }>;
}

/** A file-target transcription job (remote job). */
export interface FileTranscribeRequest {
  /** A job ID given by the caller (the node service uses its own job ID, the same on both sides); a new one is generated if not given. */
  jobId?: Id;
  /** Absolute path of the input file. */
  file: string;
  /** The content digest `sha256:<hex>` the caller has verified. */
  contentHash: string;
  bundleId: string;
  /** Defaults to `{ mode: 'prefer', tag: null }`. */
  language?: LanguageRequest;
  track?: number;
  /** Process only this segment, in ticks (`timescale`). */
  range?: { start: number; end: number } | null;
  diarize?: boolean;
  hint?: string | null;
  /** Tick unit of the output, default 1_000_000. */
  timescale?: number;
  /** The `result.json` that passed validation is moved here (absolute path; the caller is responsible for deleting it). */
  resultFile: string;
}

/**
 * Transcription without a video (§7.9, for example one request through the model API service): the input is a file, the provider and model are chosen per §6.2,
 * and the raw result is published as an artifact (generation record); it is not applied to any video. The content digest is computed from the file here, and the caller's value is not trusted.
 * The file must remain until the job reaches a terminal state (the caller deletes it after `settled`).
 */
export interface StandaloneTranscribeRequest {
  /** Absolute path of the input file. */
  file: string;
  /** The media type of the file (audio or video); omitted if unknown. */
  mediaType?: string | null;
  provider?: string;
  model?: string;
  /** Defaults to `{ mode: 'prefer', tag: null }`. */
  language?: LanguageRequest;
  /** Terms and context, ≤ 1200 characters. */
  hint?: string;
  track?: number;
}

export interface FileJobOutput {
  file: string;
  /** Lowercase hex, no prefix. */
  sha256: string;
  byteLength: number;
}

/** Observer of a file-target job: facts the caller needs beyond the records on the `jobs` topic. None carries transcript text. */
export interface FileJobObserver {
  warning?(warning: JobWarning): void;
  language?(tag: string, confidence: number | null): void;
  /** Worker crash, automatic retry: called before the record is marked `interrupted`; `attempt` is the new attempt number. */
  retrying?(attempt: number): void;
  /** Result validated and moved to `resultFile`: called before the terminal record is emitted. */
  output?(output: FileJobOutput): void;
}

type JobTarget = { kind: 'video' } | { kind: 'file'; resultFile: string; observer: FileJobObserver };

export interface JobManagerPaths {
  /** `<home>/store/jobs.jsonl`; the application ledger is `applications.jsonl` in the same directory. */
  jobsFile: string;
  /** `<home>/staging`; each job is in `jobs/<jobId>/` */
  stagingDir: string;
  /** `<home>/artifacts` */
  artifactsDir: string;
  /** `<home>/logs/diagnostics` */
  diagnosticsDir: string;
}

/** One execution of a job that does not go through a model: the staging directory (already created, deleted when the job ends), the cancellation signal and progress reporting. */
export interface TaskRun {
  jobId: Id;
  staging: string;
  signal: AbortSignal;
  phase(phase: JobPhase, progress?: JobProgress | null): void;
  warn(warning: JobWarning): void;
  /** The command run on the user's behalf and its output so far (`JobRecord.command`). */
  command(run: JobCommandRun): void;
}

/** Submission of a job that does not go through a model: the frozen spec, the fields of the public record, the queue and the execution function. */
export interface TaskSubmission {
  kind: JobRecord['kind'];
  spec: TaskInputSpec;
  videoId: Id | null;
  contentHash: string;
  inputHash: string;
  providerId: string;
  modelId: string;
  /** Local model packages the job uses (installation and self-check of model packages); `models.remove` uses it to tell whether a model package is in use. */
  bundleId?: string;
  /** Extra information on the record (export settings and snapshot; library entries used, unpinned when the job ends). */
  extra?: Pick<JobRecord, 'export' | 'library'>;
  commandId?: Id;
  queue: { key: string; concurrency: number };
  /**
   * Peak demand (architecture design §7.7; estimates are centralized in `resource-profiles.ts`): execution starts only after admission. If not given, only the queue's concurrency applies.
   * If it exceeds this machine's capacity, the submission is rejected (`RESOURCE_ADMISSION_UNSATISFIABLE`).
   */
  resources?: TaskResources;
  run(run: TaskRun): Promise<NonNullable<JobRecord['result']>>;
}

/** The job's peak demand: its own amount, a shared holder (for example the Model Worker of a model package), and its priority. */
export type TaskResources = Pick<ResourceRequest, 'demand' | 'holder' | 'priority'>;

/** Job failure: the error code, description and details go into `JobRecord.error`; `result` is the output already published before the failure (for partial failures). */
export class TaskFailure extends LocalizedError {
  readonly code: string;
  readonly details: unknown;
  readonly result: JobRecord['result'];

  constructor(code: string, message: JobText, details?: unknown, result: JobRecord['result'] = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.result = result;
  }
}

/** Provider selection and executor (implemented by `ModelServices`). */
export interface TranscribeRouter {
  /** Chooses the provider and model at submission; throws `CAPABILITY_NOT_CONFIGURED` when unavailable, and `not-found` for an unknown provider or model. */
  selectTranscribe(target: TranscribeTarget): Promise<TranscribeSelection>;
  /** The executor for one `providerId` (file-target jobs use only `local`). */
  transcriber(providerId: string): TranscribeProvider | null;
  /** All executors: closed on stop, notified when a model package is re-enabled. */
  executors(): TranscribeProvider[];
  /** Chooses the provider and model for the generation capability at submission; there is no factory default, and if nothing is configured it throws `CAPABILITY_NOT_CONFIGURED`. */
  selectGeneration?<C extends GenerationCapability>(capability: C, target: GenerationTarget): Promise<GenerationSelection<C>>;
  /** All generation executors: closed on stop. */
  generators?(): GenerationProvider[];
}

export interface JobManagerOptions {
  paths: JobManagerPaths;
  catalog: ModelCatalog;
  router: TranscribeRouter;
  videos: JobVideos;
  log?: JobsLogger;
  /** How many finished top-level jobs to keep (default 200). Steps of a fixed pipeline (subjobs with `parentJobId`) are kept and evicted together with their parent, and are not counted. */
  maxRetainedJobs?: number;
  /**
   * How many failed, cancelled or interrupted fixed pipelines that can still be retried are kept separately (default 50, not counted against `maxRetainedJobs`): the newest of these are not evicted,
   * and older ones are evicted like ordinary jobs.
   */
  maxRetainedRetryablePipelines?: number;
  /** Decode validation of generated output (ffprobe). If not given, the output of generation jobs always fails validation. */
  probe?: MediaProbe;
  /** User library (architecture design §5.9): the glossary goes into the recognition prompt, and `library:<id>` voices. Without it, these two kinds of request are rejected. */
  library?: JobLibrary;
  /** Authorization and budget for outbound calls (architecture design §12.5, §7.8). Without it nothing is checked (tests, standalone use). */
  admission?: JobAdmission;
  /** Queryable remote jobs (§7.5). None of the existing providers supports this; the interface is kept. */
  remoteTasks?: RemoteTaskQuery;
  /** Fault injection (for tests): simulates a crash at points in the apply loop. */
  faults?: JobFaults;
  /** Resource scheduling (architecture design §7.6, §7.7): shared with the provider process. If not given, a new one is created based on this machine's capacity. */
  resources?: ResourceScheduler;
}

/**
 * Host of a managed job (the parent job and steps of a fixed pipeline, §7.9): JobManager only keeps the books, emits events and persists; the host runs the execution.
 * `cancel` is the request forwarded from `jobs.cancel`, and `interrupt` is a Runtime stop; both ask the host to end the job with `finish` as soon as possible.
 */
export interface HostedJobControl {
  cancel(): void;
  interrupt(): void;
}

/** The host rewrites a handle of a managed job. */
export interface HostedJob {
  readonly jobId: Id;
  /** A copy of the record. */
  record(): JobRecord;
  /** Changes the record and emits an event; with `persist`, also writes the ledger (state and step changes). High-frequency changes such as progress are not written. */
  update(patch: Partial<JobRecord>, options?: { persist?: boolean }): void;
  /** Ends it: writes the terminal state, persists, and wakes `settled`. Does nothing if already ended. */
  finish(state: Exclude<JobState, 'queued' | 'running'>, patch?: { error?: JobError; result?: JobRecord['result'] }): Promise<void>;
}

interface Entry extends StoredJob {
  /** The frozen execution parameters (not part of the public record). */
  input: { file: string; mediaType: string | null; track: number; hint: string | null; range: TickRange | null; timescale: number };
  target: JobTarget;
  commandId: Id | null;
  /**
   * The executor and queue (only present for in-flight jobs; terminal jobs read back from the ledger have null). Transcription jobs have `transcriber`, generation jobs have `generator`,
   * and jobs that do not go through a model have `task`.
   */
  executor: {
    transcriber?: TranscribeProvider;
    generator?: GenerationProvider;
    task?: TaskSubmission['run'];
    queue: ProviderQueue;
    /** The peak demand declared by a job that does not go through a model. */
    resources?: TaskResources;
    /** For local recognition: roughly how much the Model Worker of this model package stays resident after loading, and in which pool (computed at submission from the installed components), used to estimate its demand; null when unknown. */
    workerFootprint?: WorkerFootprint | null;
  } | null;
  /** The pending admission request (null once admitted or finished). */
  ticket: ResourceTicket | null;
  controller: AbortController | null;
  cancelRequested: boolean;
  /** When cancellation was requested (the three cancellation facts, §7.4). */
  cancelRequestedAt: string | null;
  leased: boolean;
  /** The host of a managed job (present only while in flight). */
  hosted: HostedJobControl | null;
  settled: Promise<JobState>;
  settle: (state: JobState) => void;
  /**
   * The segments recognized so far in this attempt of the transcription (architecture design §6.6, “live transcript”), in seconds. Has content only while `running`; cleared when it leaves `running`.
   * Not persisted: after a restart the job reruns from the beginning (staging is cleared on every attempt), so the segments start over too.
   */
  liveSegments: JobLiveSegment[];
}

/** The `providerId` prefix of a paired node: `node:<nodeId>`. */
const NODE_PREFIX = 'node:';
/** Rejection by an online provider: the error code given by the adapter; unrecognized codes map to `PROVIDER_REJECTED`. */
const PROVIDER_REJECTION_CODES = new Set(['PROVIDER_AUTH_FAILED', 'PROVIDER_QUOTA_EXCEEDED', 'PROVIDER_REJECTED', 'INPUT_TOO_LONG']);
/** Generated output format → media type and artifact extension. */
const GENERATED_MEDIA: Record<string, { mediaType: string; extension: ArtifactExtension }> = {
  mp3: { mediaType: 'audio/mpeg', extension: 'mp3' },
  wav: { mediaType: 'audio/wav', extension: 'wav' },
  flac: { mediaType: 'audio/flac', extension: 'flac' },
  png: { mediaType: 'image/png', extension: 'png' },
  jpeg: { mediaType: 'image/jpeg', extension: 'jpg' },
  webp: { mediaType: 'image/webp', extension: 'webp' },
};
const NO_INPUT: Entry['input'] = { file: '', mediaType: null, track: 0, hint: null, range: null, timescale: DEFAULT_TIMESCALE };

export class JobManager {
  readonly #options: JobManagerOptions;
  readonly #catalog: ModelCatalog;
  readonly #videos: JobVideos;
  readonly #log: JobsLogger;
  readonly #ledger: JobLedger;
  readonly #artifacts: ArtifactStore;
  readonly #router: TranscribeRouter;
  readonly #entries = new Map<Id, Entry>();
  readonly #resources: ResourceScheduler;
  /** The job currently running (holding the lease). */
  readonly #running = new Set<Promise<void>>();
  readonly #listeners = new Set<(job: JobRecord) => void>();
  readonly #segmentListeners = new Set<(update: LiveSegmentsUpdate) => void>();
  readonly #pruneListeners = new Set<(evicted: ReadonlySet<Id>) => void>();
  readonly #maxRetained: number;
  readonly #maxRetainedRetryable: number;
  readonly #probe: MediaProbe;
  readonly #applications: ApplicationLedger;
  readonly #runner: ApplicationRunner;
  /** Jobs judged at startup that are to be handled by `recover()` (re-queued, apply completed, remote queried). */
  readonly #awaitingRecovery = new Map<Id, RecoveryAction>();
  /** Jobs being reconciled: two `jobs.reconcile` calls for the same job do not run in parallel. */
  readonly #reconciling = new Set<Id>();
  #recovering: Promise<void> | null = null;
  #closing = false;
  /** Fault injection simulated a crash: nothing is written to disk after this. */
  #crashed = false;

  constructor(options: JobManagerOptions) {
    this.#options = options;
    this.#catalog = options.catalog;
    this.#videos = options.videos;
    this.#log = options.log ?? silentLog;
    this.#ledger = new JobLedger(options.paths.jobsFile, { log: this.#log });
    this.#artifacts = new ArtifactStore(options.paths.artifactsDir);
    this.#router = options.router;
    this.#maxRetained = options.maxRetainedJobs ?? 200;
    this.#maxRetainedRetryable = options.maxRetainedRetryablePipelines ?? 50;
    this.#probe = options.probe ?? unavailableProbe;
    this.#resources = options.resources ?? new ResourceScheduler({ log: this.#log });
    this.#applications = new ApplicationLedger(path.join(path.dirname(options.paths.jobsFile), 'applications.jsonl'), { log: this.#log });
    this.#runner = new ApplicationRunner({
      ledger: this.#applications,
      videos: this.#videos,
      ...(options.faults ? { faults: options.faults } : {}),
    });
  }

  get artifacts(): ArtifactStore {
    return this.#artifacts;
  }

  /**
   * Reads the ledger and reconciles against the recovery matrix (§7.5, `job-recovery.ts`): local jobs and jobs without recovery capability are marked `interrupted`; outbound calls with unknown outcome
   * are marked `needs-reconciliation` (the budget is settled by the conservative rule). Jobs to be re-queued, to complete their apply, or to query a remote are left for `recover()`.
   * Reservations not settled last time are settled here; staging directories that do not belong to in-flight jobs are deleted.
   */
  async open(): Promise<void> {
    const stored = await this.#ledger.load();
    await this.#applications.load();
    const now = nowIso();
    const counts = { interrupted: 0, reconcile: 0, recover: 0 };
    for (const job of stored) {
      // Records from the old ledger (before model services) have no `modelId`: use the model package.
      job.record.modelId ??= job.record.bundleId ?? '';
      if (job.publishing) await this.#claimPublished(job, now);
      const latest = this.#applications.latest(job.record.jobId)?.record;
      let action = recoveryAction(job, latest, this.#options.remoteTasks);
      // A queued job whose reservation was already recorded as started: it stopped between starting execution and recording `running`, so the request may already have been sent (§7.8). Do not resend.
      const grant = job.record.grant;
      if (action.kind === 'requeue' && grant && !grant.settled && this.#options.admission?.begun?.(grant)) action = { kind: 'reconcile' };
      if (action.kind === 'interrupt') {
        counts.interrupted++;
        Object.assign(job.record, {
          state: 'interrupted',
          phase: 'done',
          endedAt: now,
          updatedAt: now,
          error: stoppedError(),
        } satisfies Partial<JobRecord>);
      } else if (action.kind === 'reconcile') {
        counts.reconcile++;
        Object.assign(job.record, {
          state: 'needs-reconciliation',
          phase: 'done',
          endedAt: now,
          updatedAt: now,
          error: reconciliationError(),
        } satisfies Partial<JobRecord>);
      } else if (action.kind !== 'keep') {
        counts.recover++;
        this.#awaitingRecovery.set(job.record.jobId, action);
      }
      // A reservation not settled last time (§7.8): jobs to be re-queued that have not started are released (admitted again when queued); those that already have a result and are waiting for the apply to complete are settled as completed;
      // the rest are settled by whether they started (a job that started is conservatively charged).
      if (job.record.grant && !job.record.grant.settled && this.#options.admission) {
        const state = action.kind === 'resume-application' ? 'completed' : action.kind === 'requeue' ? 'interrupted' : job.record.state;
        job.record.grant = this.#options.admission.settle(job.record.grant, {
          state: state === 'running' ? 'needs-reconciliation' : state,
        });
      }
      this.#project(job);
      const spec = job.spec;
      const input = isTranscribeSpec(spec) ? { ...NO_INPUT, track: spec.track, hint: spec.hint, range: spec.range } : NO_INPUT;
      const entry = this.#entry(job, input, null, { kind: 'video' }, null);
      // Jobs awaiting recovery have not finished yet: `settled` has to wait until they really end.
      this.#entries.set(job.record.jobId, entry);
    }
    const jobsStaging = path.join(this.#options.paths.stagingDir, 'jobs');
    await fs.mkdir(jobsStaging, { recursive: true });
    for (const name of await fs.readdir(jobsStaging)) {
      const entry = this.#entries.get(name);
      if (entry && !isTerminal(entry.record.state)) continue;
      await fs.rm(path.join(jobsStaging, name), { recursive: true, force: true });
    }
    if (counts.interrupted > 0) this.#log.warn('Unfinished tasks from last run marked interrupted', { count: counts.interrupted });
    if (counts.reconcile > 0) this.#log.warn('Outgoing calls from last run have unknown results; awaiting reconciliation', { count: counts.reconcile });
    await this.#save();
  }

  /**
   * Claims an artifact whose publication was interrupted halfway (§7.3, “artifact published, apply not finished”): the publish intent is recorded in the ledger before the artifact is written, with the artifact ID and the result.
   * If the artifact is all there and its content and digest match, the result is written back to the job: a job with a video gets a `pending` apply added (the recovery matrix then completes the apply, and the budget is settled once as completed); a job without a video is completed directly. No re-inference, no request resent.
   * If an artifact is missing or does not match, the intent is discarded and the job is handled by the original matrix.
   */
  async #claimPublished(job: StoredJob, now: string): Promise<void> {
    const intent = job.publishing!;
    delete job.publishing;
    const record = job.record;
    if (isTerminal(record.state)) return;
    const latest = this.#applications.latest(record.jobId);
    if (latest && applicationOpen(latest.record.state)) {
      // The apply was created but the job ledger has not recorded the result: fill in the result, and the apply completes as usual.
      record.result ??= intent.result;
      record.warnings = intent.warnings;
      return;
    }
    const present = await Promise.all(intent.artifactIds.map((artifactId) => this.#artifacts.verify(artifactId)));
    if (!present.every(Boolean)) {
      this.#log.warn('Outputs half-published last run are incomplete; handling by the original matrix', { jobId: record.jobId });
      return;
    }
    Object.assign(record, { result: intent.result, warnings: intent.warnings, updatedAt: now } satisfies Partial<JobRecord>);
    if (intent.targetRefs && record.videoId !== null) {
      record.phase = 'applying';
      await this.#runner.create({
        jobId: record.jobId,
        videoId: record.videoId,
        artifactIds: intent.artifactIds,
        targetRefs: intent.targetRefs,
        place: job.videoPlace ?? null,
      });
    } else {
      Object.assign(record, { state: 'completed', phase: 'done', endedAt: now, error: null } satisfies Partial<JobRecord>);
    }
    this.#log.info('Claiming outputs published last run', { jobId: record.jobId, artifacts: intent.artifactIds.length });
  }

  /**
   * The parts of the recovery matrix that must wait until the rest of the Runtime is ready (§7.5): before re-queuing, validate the video, provider, authorization and budget; complete the apply for artifacts already published
   * (first look up the receipt by the recorded `commandId`); query remote jobs. Called once after `open()`, after authorization and model services are ready;
   * the returned Promise fulfills when everything has been handled. Jobs submitted by agents do not get their apply completed: their Run has already ended with the restart (stop barrier).
   */
  recover(): Promise<void> {
    this.#recovering ??= this.#recover();
    return this.#recovering;
  }

  async #recover(): Promise<void> {
    for (const [jobId, action] of [...this.#awaitingRecovery]) {
      if (this.#closing || this.#crashed) return;
      const entry = this.#entries.get(jobId);
      this.#awaitingRecovery.delete(jobId);
      if (!entry) continue;
      try {
        if (action.kind === 'requeue') await this.#requeue(entry);
        else if (action.kind === 'resume-application') await this.#resumeApplication(entry);
        else if (action.kind === 'query-remote') await this.#queryRemote(entry, action.remoteTaskId);
      } catch (error) {
        if (error instanceof SimulatedCrash) return this.#crash(entry);
        this.#log.error('Recovering task failed', { jobId, action: action.kind, error: String(error) });
        if (!isTerminal(entry.record.state)) await this.#finish(entry, 'failed', { error: jobError('INTERNAL', J.recoverFailed()) });
      }
    }
  }

  onChange(listener: (job: JobRecord) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Newly recognized segments of a transcription job (`job.segments` on the `jobs` topic). They are in the same synchronous section as the segments entering the snapshot; `from` is the index of the first segment among all live segments of the job's current attempt.
   */
  onSegments(listener: (update: LiveSegmentsUpdate) => void): () => void {
    this.#segmentListeners.add(listener);
    return () => this.#segmentListeners.delete(listener);
  }

  /** After the ledger's cap evicts a job (`evicted` is the evicted top-level job; its subjobs are deleted too). The artifact library's sweep runs another round based on this. */
  onPruned(listener: (evicted: ReadonlySet<Id>) => void): () => void {
    this.#pruneListeners.add(listener);
    return () => this.#pruneListeners.delete(listener);
  }

  /**
   * Artifacts referenced by all jobs in the ledger (any state, including pipeline steps): public records (result, outputs, step products, apply), frozen specs and execution parameters,
   * and every `sha256:<hex>` appearing in publish intents not yet cleared. Found by searching the text. Err on the side of keeping: an extra file is harmless, but a missing one loses a result.
   */
  referencedArtifactIds(): Set<string> {
    const ids = new Set<string>();
    for (const entry of this.#entries.values()) {
      collectArtifactIds(
        { record: entry.record, spec: entry.spec, publishing: entry.publishing ?? null, input: entry.input, videoPlace: entry.videoPlace ?? null },
        ids,
      );
    }
    for (const application of this.#applications.all()) collectArtifactIds(application, ids);
    return ids;
  }

  snapshot(): JobsSnapshot {
    const liveSegments: Record<Id, JobLiveSegment[]> = {};
    for (const entry of this.#entries.values()) {
      if (entry.record.state === 'running' && entry.liveSegments.length > 0)
        liveSegments[entry.record.jobId] = entry.liveSegments.map((s) => ({ ...s }));
    }
    return Object.keys(liveSegments).length > 0 ? { jobs: this.list(), liveSegments } : { jobs: this.list() };
  }

  list(videoId?: Id): JobRecord[] {
    return [...this.#entries.values()]
      .filter((e) => videoId === undefined || e.record.videoId === videoId)
      .reverse()
      .map((e) => structuredClone(e.record));
  }

  inspect(jobId: Id): JobRecord {
    const entry = this.#entries.get(jobId);
    if (!entry) throw new RpcError('not-found', J.jobNotFound());
    return structuredClone(entry.record);
  }

  /** Waits for a job to finish (for tests and diagnostics). */
  settled(jobId: Id): Promise<JobState> {
    const entry = this.#entries.get(jobId);
    if (!entry) return Promise.reject(new RpcError('not-found', J.jobNotFound()));
    return entry.settled;
  }

  /** Re-enables a model package: clears the load-failure, disable and crash counters. */
  enable(bundleId: string): void {
    if (!this.#catalog.definition(bundleId)) throw new RpcError('not-found', J.noBundle());
    this.#catalog.enable(bundleId);
    for (const provider of this.#router.executors()) provider.enable?.(bundleId);
  }

  // ---- Managed jobs (fixed pipeline, §7.9) ----

  /**
   * Registers a job that the host runs: the record is given by the host (usually `state` is `running`); it is not queued or executed. `busy` while the Runtime is stopping.
   * If a video is given, its lease is held for the duration of the job.
   */
  host(record: JobRecord, options: { hosted: string; control: HostedJobControl; commandId?: Id | null; leaseVideo?: boolean }): HostedJob {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    if (this.#entries.has(record.jobId)) throw new RpcError('conflict', J.jobIdExists());
    const entry = this.#entry(
      { record: structuredClone(record), spec: { hosted: options.hosted }, workerVersion: null },
      NO_INPUT,
      options.commandId ?? null,
      { kind: 'video' },
      null,
    );
    entry.hosted = options.control;
    this.#entries.set(record.jobId, entry);
    if (options.leaseVideo && record.videoId) {
      this.#videos.retain(record.videoId);
      entry.leased = true;
    }
    this.#changed(entry, true);
    return this.#handle(entry);
  }

  /**
   * Re-executes a finished managed job (a retry of the pipeline): the same `jobId` goes back to `running`, `attempt` goes up by one, the error and result are cleared,
   * and a new `settled` is issued. `conflict` if it is still in progress.
   */
  reopen(jobId: Id, options: { control: HostedJobControl; patch?: Partial<JobRecord>; leaseVideo?: boolean }): HostedJob {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    const entry = this.#entries.get(jobId);
    if (!entry) throw new RpcError('not-found', J.jobNotFound());
    if (!isHostedSpec(entry.spec)) throw new RpcError('conflict', J.onlyHostedRerun());
    if (!isTerminal(entry.record.state)) throw new RpcError('conflict', J.notEnded());
    let settle!: (state: JobState) => void;
    entry.settled = new Promise<JobState>((resolve) => {
      settle = resolve;
    });
    entry.settle = settle;
    entry.cancelRequested = false;
    entry.hosted = options.control;
    Object.assign(entry.record, {
      state: 'running',
      phase: 'starting',
      attempt: entry.record.attempt + 1,
      endedAt: null,
      error: null,
      result: null,
      ...options.patch,
    } satisfies Partial<JobRecord>);
    if (options.leaseVideo && entry.record.videoId && !entry.leased) {
      this.#videos.retain(entry.record.videoId);
      entry.leased = true;
    }
    this.#changed(entry, true);
    return this.#handle(entry);
  }

  /** Changes the record of a finished managed job (used by the host's reconciliation at startup), and persists it. */
  async amend(jobId: Id, patch: Partial<JobRecord>): Promise<void> {
    const entry = this.#entries.get(jobId);
    if (!entry || !isHostedSpec(entry.spec) || !isTerminal(entry.record.state)) return;
    Object.assign(entry.record, patch);
    this.#changed(entry, false);
    await this.#save();
  }

  #handle(entry: Entry): HostedJob {
    return {
      jobId: entry.record.jobId,
      record: () => structuredClone(entry.record),
      update: (patch, options) => {
        if (isTerminal(entry.record.state)) return;
        Object.assign(entry.record, patch);
        // No longer waiting for admission: remove this field rather than leaving undefined.
        if ('wait' in patch && patch.wait === undefined) delete entry.record.wait;
        this.#changed(entry, options?.persist ?? false);
      },
      finish: async (state, patch = {}) => {
        if (isTerminal(entry.record.state)) return;
        entry.hosted = null;
        await this.#finish(entry, state, patch);
      },
    };
  }

  // ---- Submission ----

  async submitTranscribe(request: TranscribeRequest, submitter: JobSubmitter, grant?: JobGrantHint): Promise<{ jobId: Id }> {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    if (request.commandId) {
      const existing = this.#byCommand(request.commandId);
      if (existing) return { jobId: existing };
    }
    // Choose the provider and model (§6.2). The node's model packages are checked by the node (node protocol spec §9), not against the local model catalog.
    const selection = await this.#router.selectTranscribe({
      ...(request.provider !== undefined ? { provider: request.provider } : {}),
      ...(request.model !== undefined ? { model: request.model } : {}),
      ...(request.node !== undefined ? { node: request.node } : {}),
      ...(request.bundleId !== undefined ? { bundleId: request.bundleId } : {}),
    });

    const language = normalizeLanguage(request.language);
    const given = request.hint?.trim() ? request.hint.trim() : null;
    if (given && given.length > 1200) throw new RpcError('invalid-request', J.hintTooLong());
    checkTranscribeOptions(selection, { assertedLanguage: language.mode === 'assert' ? language.tag : null });
    const { hint: userHint, warnings } = hintFor(selection, given);
    // The glossary is read at submission and its version frozen; the canonical spelling is put into the prompt (when the model accepts prompts).
    const glossaries = request.glossaries?.length
      ? transcribeGlossaries(this.#options.library, request.glossaries, userHint, selection.model.acceptsHint, submitter)
      : null;
    const hint = glossaries ? glossaries.hint : userHint;
    const track = request.track ?? 0;
    const source = await this.#videos.source(request.videoId, request.assetId, request.revision);
    if (!/^(audio|video)\//.test(source.mediaType)) throw new RpcError('invalid-request', J.onlyAudioVideo());
    // Replace transcript (§6.6): the transcript of this asset is the one being replaced; the fingerprint is computed by the caller (the transcription flow) at submission and checked again before applying.
    const replace = request.replace ? checkReplace(request.replace, request.assetId, this.#videos.state?.(request.videoId) ?? null) : null;

    const spec: TranscribeInputSpec = {
      contentHash: source.contentHash,
      track,
      range: null,
      language,
      providerId: selection.providerId,
      modelId: selection.modelId,
      bundleId: selection.bundleId,
      // If not given, decided by the model: a model that can tell speakers apart (by itself, or with the “speaker diarization” model package installed) does so (§6.6).
      diarize: request.diarize ?? (selection.model.speakers === 'native' || selection.model.speakers === 'pack'),
      hint,
      outputContract: ASR_RESULT_SCHEMA,
    };
    const inputHash = transcribeInputHash(spec);
    const workerFootprint = await this.#workerFootprint(selection.providerId, selection.bundleId);

    // Between two awaits an identical submission may occur, so deduplication happens in the synchronous section.
    if (request.commandId) {
      const existing = this.#byCommand(request.commandId);
      if (existing) return { jobId: existing };
    }
    for (const entry of this.#entries.values()) {
      const r = entry.record;
      if (
        (r.state === 'queued' || r.state === 'running') &&
        r.inputHash === inputHash &&
        r.videoId === request.videoId &&
        canonicalJson(r.transcribe?.replace ?? null) === canonicalJson(replace)
      ) {
        return { jobId: r.jobId };
      }
    }

    const jobId = newId('job');
    const grantUse = this.#admit(jobId, 'transcribe', selection, request.videoId, submitter, grant, {});
    const now = nowIso();
    const record: JobRecord = {
      jobId,
      kind: 'transcribe',
      state: 'queued',
      phase: 'queued',
      progress: null,
      videoId: request.videoId,
      assetId: request.assetId,
      assetRevision: source.revision,
      contentHash: source.contentHash,
      providerId: selection.providerId,
      modelId: selection.modelId,
      bundleId: selection.bundleId,
      inputHash,
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
      warnings,
      // The language and speaker diarization that were settled (`diarize` is the effective value). The row on the video card shows the model and parameters from this (product design §3.2.2).
      transcribe: { language: spec.language, diarize: spec.diarize, ...(replace ? { replace } : {}) },
      ...(glossaries ? { library: glossaries.use } : {}),
      ...(grantUse ? { grant: grantUse } : {}),
    };
    // The versions used during the job are pinned for its duration (unpinned at the end).
    if (glossaries) this.#options.library!.pin(record.jobId, glossaries.use.entries);
    const entry = this.#entry(
      { record, spec, workerVersion: null, videoPlace: this.#videos.place?.(request.videoId) ?? null },
      { file: source.file, mediaType: source.mediaType, track, hint, range: null, timescale: DEFAULT_TIMESCALE },
      request.commandId ?? null,
      { kind: 'video' },
      { transcriber: selection.transcriber, queue: selection.queue, workerFootprint },
    );
    this.#entries.set(record.jobId, entry);
    this.#videos.retain(request.videoId);
    entry.leased = true;
    this.#log.info('Transcription task queued', {
      jobId: record.jobId,
      providerId: selection.providerId,
      modelId: selection.modelId,
      source: selection.source,
      videoId: record.videoId,
      assetId: record.assetId,
    });
    this.#enqueue(entry);
    return { jobId: record.jobId };
  }

  /**
   * Transcription without a video (§7.9): selection and checks are the same as `submitTranscribe`; the input is a file given by the caller. On completion the raw result is published
   * (`result.documentId` is null), and no video is written. No deduplication of in-flight jobs: each submission is its own job, and cancellations do not affect each other.
   */
  async submitTranscribeWithoutVideo(
    request: StandaloneTranscribeRequest,
    submitter: JobSubmitter,
    grant?: JobGrantHint,
  ): Promise<{ jobId: Id }> {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    if (!path.isAbsolute(request.file)) throw new RpcError('invalid-request', J.pathNotAbsolute());
    const selection = await this.#router.selectTranscribe({
      ...(request.provider !== undefined ? { provider: request.provider } : {}),
      ...(request.model !== undefined ? { model: request.model } : {}),
    });
    const language = normalizeLanguage(request.language);
    const given = request.hint?.trim() ? request.hint.trim() : null;
    if (given && given.length > 1200) throw new RpcError('invalid-request', J.hintTooLong());
    checkTranscribeOptions(selection, { assertedLanguage: language.mode === 'assert' ? language.tag : null });
    const { hint, warnings } = hintFor(selection, given);
    const track = request.track ?? 0;
    if (!Number.isSafeInteger(track) || track < 0) throw new RpcError('invalid-request', J.trackInvalid());
    const contentHash = `sha256:${await fileSha256(request.file)}`;
    const workerFootprint = await this.#workerFootprint(selection.providerId, selection.bundleId);
    const spec: TranscribeInputSpec = {
      contentHash,
      track,
      range: null,
      language,
      providerId: selection.providerId,
      modelId: selection.modelId,
      bundleId: selection.bundleId,
      diarize: false,
      hint,
      outputContract: ASR_RESULT_SCHEMA,
    };
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    const jobId = newId('job');
    const grantUse = this.#admit(jobId, 'transcribe', selection, null, submitter, grant, {});
    const now = nowIso();
    const record: JobRecord = {
      jobId,
      kind: 'transcribe',
      state: 'queued',
      phase: 'queued',
      progress: null,
      videoId: null,
      assetId: null,
      assetRevision: null,
      contentHash,
      providerId: selection.providerId,
      modelId: selection.modelId,
      bundleId: selection.bundleId,
      inputHash: transcribeInputHash(spec),
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
      warnings,
      ...(grantUse ? { grant: grantUse } : {}),
    };
    const mediaType = request.mediaType && /^(audio|video)\//.test(request.mediaType) ? request.mediaType : null;
    const entry = this.#entry(
      { record, spec, workerVersion: null },
      { file: request.file, mediaType, track, hint, range: null, timescale: DEFAULT_TIMESCALE },
      null,
      { kind: 'video' },
      { transcriber: selection.transcriber, queue: selection.queue, workerFootprint },
    );
    this.#entries.set(record.jobId, entry);
    this.#log.info('Transcription task queued (no video)', {
      jobId: record.jobId,
      providerId: selection.providerId,
      modelId: selection.modelId,
      source: selection.source,
      submitter: submitter.kind,
    });
    this.#enqueue(entry);
    return { jobId: record.jobId };
  }

  /** Speech synthesis (§6.6): text over the model's limit is rejected at submission. */
  submitSynthesizeSpeech(request: SynthesizeSpeechRequest, submitter: JobSubmitter, grant?: JobGrantHint): Promise<{ jobId: Id }> {
    return this.#submitGeneration(
      'synthesizeSpeech',
      request,
      submitter,
      async (choice) => {
        if (choice.model.local) return this.#freezeLocalSpeech(choice, request, submitter);
        // `library:<id>`: uses the effective clone on this provider (§5.9).
        const voice = libraryVoice(this.#options.library, request.voice, choice.providerId, submitter);
        if (!voice) return { parameters: speechParameters(choice, request) };
        return { parameters: speechParameters(choice, { ...request, voice: voice.voiceId }), library: voice.use };
      },
      request.text,
      grant,
      { chars: [...request.text].length },
      readableStem(request.text, 'speech'),
    );
  }

  /**
   * The voice for local synthesis is decided and frozen at submission (§6.1, §6.6). Voice library entries use their reference recording directly (fixed version); the file given in the request and the recordings of built-in voices
   * are read here for their digests, and the request is rejected if they cannot be read. The original text is not included when the model does not read it.
   */
  async #freezeLocalSpeech(
    choice: GenerationSelection<'synthesizeSpeech'>,
    request: SynthesizeSpeechRequest,
    submitter: JobSubmitter,
  ): Promise<{ parameters: GenerationParameters; library?: JobLibraryUse }> {
    const plan = planLocalVoice(choice, request);
    const withTranscript = choice.model.local?.reference?.acceptsTranscript ?? false;
    let reference: FrozenSpeechReference | null = null;
    let library: JobLibraryUse | undefined;
    if (plan.mode === 'clone' && plan.source === 'library') {
      const voice = localLibraryVoice(this.#options.library, plan.libraryId, withTranscript, submitter);
      reference = voice.reference;
      library = voice.use;
    } else if (plan.mode === 'clone') {
      reference = await freezeReferenceFile({ source: 'file', path: plan.path, transcript: plan.transcript });
    } else {
      const builtin = builtinReferenceFile(choice.model, plan);
      if (builtin) reference = await freezeReferenceFile({ ...builtin, transcript: withTranscript ? builtin.transcript : null });
    }
    return { parameters: speechParameters(choice, request, { plan, reference }), ...(library ? { library } : {}) };
  }

  /** Image generation (§6.6). The seed for local image generation is frozen at submission (drawn if not given), so retries and re-executions produce the same image. */
  submitGenerateImage(request: GenerateImageRequest, submitter: JobSubmitter, grant?: JobGrantHint): Promise<{ jobId: Id }> {
    return this.#submitGeneration(
      'generateImage',
      request,
      submitter,
      (choice) => {
        const parameters = imageParameters(choice, request);
        return { parameters: choice.providerId === 'local' ? { ...parameters, seed: localImageSeed(parameters.seed) } : parameters };
      },
      request.prompt,
      grant,
      { count: request.count ?? 1 },
      readableStem(request.prompt, 'image'),
    );
  }

  /**
   * Music generation (§6.6): local provider only. The seed is frozen at submission (drawn if not given), so retries and re-executions produce the same piece. The source is the style description and the lyrics,
   * and the artifact is named after the start of the style.
   */
  submitGenerateMusic(request: GenerateMusicRequest, submitter: JobSubmitter, grant?: JobGrantHint): Promise<{ jobId: Id }> {
    return this.#submitGeneration(
      'generateMusic',
      request,
      submitter,
      (choice) => ({ parameters: musicParameters(choice, request, choice.providerId === 'local' ? localMusicSeed(request.seed) : (request.seed ?? 0)) }),
      request.lyrics ? `${request.style}\n${request.lyrics}` : request.style,
      grant,
      {},
      readableStem(request.style, 'music'),
    );
  }

  /**
   * Text generation (§6.1, §6.4): at submission, the messages, the output format (the JSON Schema is compiled here), the output limit and the reasoning effort are checked and frozen.
   * No video is imported; the full text is published as an artifact (`.txt`; structured output is `.json`).
   */
  submitGenerateText(request: GenerateTextRequest, submitter: JobSubmitter, grant?: JobGrantHint): Promise<{ jobId: Id }> {
    return this.#submitGeneration(
      'generateText',
      request,
      submitter,
      (selection) => ({
        parameters: textParameters(selection, request, selection.textDefaults ?? { effort: null, concurrency: DEFAULT_TEXT_CONCURRENCY }),
      }),
      canonicalJson({ messages: request.messages, responseFormat: request.responseFormat ?? { type: 'text' } }),
      grant,
      {},
      readableStem(request.messages.findLast((m) => m.role === 'user')?.content ?? '', 'text'),
    );
  }

  async #submitGeneration<C extends GenerationCapability>(
    capability: C,
    request: { provider?: string; model?: string; videoId?: Id; name?: string; saveDir?: string; commandId?: Id },
    submitter: JobSubmitter,
    freeze: (
      selection: GenerationSelection<C>,
    ) =>
      | { parameters: GenerationParameters; library?: JobLibraryUse }
      | Promise<{ parameters: GenerationParameters; library?: JobLibraryUse }>,
    source: string,
    grant: JobGrantHint | undefined,
    quantity: { count?: number; chars?: number },
    saveStem: string,
  ): Promise<{ jobId: Id }> {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    if (request.commandId) {
      const existing = this.#byCommand(request.commandId);
      if (existing) return { jobId: existing };
    }
    if (!this.#router.selectGeneration) {
      throw capabilityNotConfiguredError(capability, 'unsupported', undefined, 'configure-provider', J.noGeneration());
    }
    // Choose the provider and model (§6.2), check the parameters against the model's capabilities and freeze them: execution and retries all use this one set.
    const selection = await this.#router.selectGeneration(capability, {
      ...(request.provider !== undefined ? { provider: request.provider } : {}),
      ...(request.model !== undefined ? { model: request.model } : {}),
    });
    const { parameters, library } = await freeze(selection);
    const videoId = request.videoId ?? null;
    if (videoId !== null && this.#videos.videoRevision(videoId) === null) throw new RpcError('not-found', J.videoNotOpen());
    // Save location (§7.9): if given, the directory is created before submission and writability is confirmed; if that fails, the job is not created.
    if (request.saveDir !== undefined) await ensureSaveDirectory(request.saveDir);

    const spec: GenerationInputSpec = {
      capability,
      providerId: selection.providerId,
      modelId: selection.modelId,
      parameters,
      videoId,
      name: request.name?.trim() ? request.name.trim() : null,
      ...(request.saveDir !== undefined ? { save: { dir: request.saveDir, stem: saveStem } } : {}),
    };
    // Between two awaits an identical submission may occur, and stopping may begin.
    if (request.commandId) {
      const existing = this.#byCommand(request.commandId);
      if (existing) return { jobId: existing };
    }
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());

    const jobId = newId('job');
    const grantUse = this.#admit(jobId, capability, selection, videoId, submitter, grant, quantity);
    // Local synthesis with the candle model package estimates the Model Worker from its resident amount (MLX gives null, so fixed demand is used).
    const workerFootprint = capability === 'synthesizeSpeech' ? await this.#workerFootprint(selection.providerId, selection.modelId) : null;
    const now = nowIso();
    const record: JobRecord = {
      jobId,
      kind: capability,
      state: 'queued',
      phase: 'queued',
      progress: null,
      videoId,
      assetId: null,
      assetRevision: null,
      contentHash: `sha256:${sha256Hex(source)}`,
      providerId: selection.providerId,
      modelId: selection.modelId,
      // Local synthesis, local image generation and local music are the model packages themselves: resource scheduling counts them by their Model Worker or engine (§7.7).
      bundleId:
        selection.providerId === 'local' && (capability === 'synthesizeSpeech' || capability === 'generateImage' || capability === 'generateMusic')
          ? selection.modelId
          : null,
      inputHash: generationInputHash(spec),
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
      generation: parameters,
      ...(library ? { library } : {}),
      ...(grantUse ? { grant: grantUse } : {}),
    };
    if (library) this.#options.library!.pin(record.jobId, library.entries);
    const entry = this.#entry(
      { record, spec, workerVersion: null, videoPlace: videoId !== null ? (this.#videos.place?.(videoId) ?? null) : null },
      NO_INPUT,
      request.commandId ?? null,
      { kind: 'video' },
      { generator: selection.generator, queue: selection.queue, workerFootprint },
    );
    this.#entries.set(record.jobId, entry);
    if (videoId !== null) {
      this.#videos.retain(videoId);
      entry.leased = true;
    }
    // Original text and prompts are not written to logs.
    this.#log.info('Generation task queued', {
      jobId: record.jobId,
      kind: capability,
      providerId: selection.providerId,
      modelId: selection.modelId,
      source: selection.source,
      videoId,
    });
    this.#enqueue(entry);
    return { jobId: record.jobId };
  }

  /** Jobs submitted with this `commandId` (a resent command checks here first, to avoid freezing and preflighting again). */
  jobForCommand(commandId: Id): Id | null {
    return this.#byCommand(commandId);
  }

  /** Job that does not go through a model (export): the caller has already frozen the inputs and done the preflight. The same `commandId` returns the original job. */
  submitTask(submission: TaskSubmission, submitter: JobSubmitter): { jobId: Id } {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    if (submission.commandId) {
      const existing = this.#byCommand(submission.commandId);
      if (existing) return { jobId: existing };
    }
    if (submission.resources) {
      const exceeded = this.#resources.check({ owner: '', label: submission.kind, ...submission.resources });
      if (exceeded) {
        throw new RpcError('conflict', exceeded.message, { code: exceeded.code, dimensions: exceeded.dimensions }, exceeded.messageRef);
      }
    }
    const now = nowIso();
    const record: JobRecord = {
      jobId: newId('job'),
      kind: submission.kind,
      state: 'queued',
      phase: 'queued',
      progress: null,
      videoId: submission.videoId,
      assetId: null,
      assetRevision: null,
      contentHash: submission.contentHash,
      providerId: submission.providerId,
      modelId: submission.modelId,
      bundleId: submission.bundleId ?? null,
      inputHash: submission.inputHash,
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
      ...submission.extra,
    };
    const entry = this.#entry(
      { record, spec: submission.spec, workerVersion: null },
      NO_INPUT,
      submission.commandId ?? null,
      { kind: 'video' },
      { task: submission.run, queue: submission.queue, ...(submission.resources ? { resources: submission.resources } : {}) },
    );
    this.#entries.set(record.jobId, entry);
    this.#log.info('Task queued', { jobId: record.jobId, kind: record.kind, videoId: record.videoId });
    this.#enqueue(entry);
    return { jobId: record.jobId };
  }

  /**
   * File-target transcription (remote job, §6.7): the caller has already verified the digest of the input file. It is queued in the same model-package queue as video jobs;
   * there is no deduplication of in-flight jobs (idempotency is the caller's job). Uses only the local machine (`local`), not the §6.2 selection; if the model package is unavailable, throws `conflict` (`MODEL_UNAVAILABLE`).
   */
  async submitFile(request: FileTranscribeRequest, submitter: JobSubmitter, observer: FileJobObserver = {}): Promise<{ jobId: Id }> {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    if (request.jobId !== undefined && this.#entries.has(request.jobId)) throw new RpcError('conflict', J.jobIdExists());
    if (!path.isAbsolute(request.file) || !path.isAbsolute(request.resultFile)) throw new RpcError('invalid-request', J.pathNotAbsolute());
    if (!/^sha256:[0-9a-f]{64}$/.test(request.contentHash)) throw new RpcError('invalid-request', J.contentHashInvalid());
    const provider = await this.#usableProvider(request.bundleId);
    const language = normalizeLanguage(request.language);
    const hint = request.hint?.trim() ? request.hint.trim() : null;
    if (hint && hint.length > 1200) throw new RpcError('invalid-request', J.hintTooLong());
    const timescale = request.timescale ?? DEFAULT_TIMESCALE;
    if (!Number.isSafeInteger(timescale) || timescale <= 0) throw new RpcError('invalid-request', J.timescaleInvalid());
    const range = request.range ? { start: request.range.start, end: request.range.end, timescale } : null;
    if (range && !(Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && 0 <= range.start && range.start < range.end)) {
      throw new RpcError('invalid-request', J.rangeInvalid());
    }
    const track = request.track ?? 0;
    const diarize = request.diarize ?? false;
    const spec: TranscribeInputSpec = {
      contentHash: request.contentHash,
      track,
      range,
      language,
      providerId: 'local',
      modelId: request.bundleId,
      bundleId: request.bundleId,
      diarize,
      hint,
      outputContract: ASR_RESULT_SCHEMA,
    };
    const workerFootprint = await this.#workerFootprint('local', request.bundleId);
    const jobId = request.jobId ?? newId('job');
    // Between two awaits a submission with the same ID may occur, and stopping may begin.
    if (this.#entries.has(jobId)) throw new RpcError('conflict', J.jobIdExists());
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    const now = nowIso();
    const record: JobRecord = {
      jobId,
      kind: 'transcribe',
      state: 'queued',
      phase: 'queued',
      progress: null,
      videoId: null,
      assetId: null,
      assetRevision: null,
      contentHash: request.contentHash,
      providerId: 'local',
      modelId: request.bundleId,
      bundleId: request.bundleId,
      inputHash: transcribeInputHash(spec),
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
    };
    const entry = this.#entry(
      { record, spec, workerVersion: null },
      { file: request.file, mediaType: null, track, hint, range, timescale },
      null,
      {
        kind: 'file',
        resultFile: request.resultFile,
        observer,
      },
      { transcriber: provider, queue: { key: request.bundleId, concurrency: 1 }, workerFootprint },
    );
    this.#entries.set(jobId, entry);
    this.#log.info('Remote transcription task queued', { jobId, bundleId: request.bundleId, submitter: submitter.kind });
    this.#enqueue(entry);
    return { jobId };
  }

  /** The model package exists, can transcribe, and is available now; returns the provider that runs it. */
  async #usableProvider(bundleId: string): Promise<TranscribeProvider> {
    const def = this.#catalog.definition(bundleId);
    if (!def) throw new RpcError('not-found', J.noBundleId({ bundleId }));
    if (def.capability !== 'transcribe') throw new RpcError('invalid-request', J.bundleCannotTranscribe());
    const status = await this.#catalog.status(bundleId);
    if (!status || !bundleUsable(status)) {
      throw new RpcError('conflict', J.bundleUnavailable(), { code: 'MODEL_UNAVAILABLE', bundle: status });
    }
    const provider = this.#router.transcriber('local');
    if (!provider) throw new RpcError('conflict', J.localInferenceUnavailable(), { code: 'MODEL_UNAVAILABLE', bundle: status });
    return provider;
  }

  /**
   * The queue is given by the provider: locally, one per model package (video jobs and jobs a node runs for others share the same queue, in order of entering `queued`);
   * for remote nodes, one per node; for online providers, one per provider (each with its own concurrency limit).
   *
   * The record that enters `queued` is emitted only after the scheduler has looked at it. A job that has to wait carries `wait` on its first record; a job admitted immediately does not,
   * so subscribers never see a `queued` without `wait` that is immediately followed by a waiting state.
   */
  #enqueue(entry: Entry): void {
    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      this.#changed(entry, true);
    };
    if (this.#closing) return announce();
    const record = entry.record;
    entry.ticket = this.#resources.request(this.#resourceRequest(entry), {
      admit: (lease) => {
        announce();
        this.#admitted(entry, lease);
      },
      reject: (error) => {
        announce();
        entry.ticket = null;
        void this.#finish(entry, 'failed', { error: exceededError(error) });
      },
      wait: (wait) => {
        if (record.state !== 'queued') return;
        if (wait) record.wait = wait;
        else delete record.wait;
        if (announced) this.#changed(entry, false);
      },
    });
    announce();
  }

  /**
   * Admission request: the queue comes from the provider. Local transcription and local synthesis also need the Model Worker of their model package (the shared holder); other jobs, such as export, use the demand they declare.
   */
  #resourceRequest(entry: Entry): ResourceRequest {
    const record = entry.record;
    const executor = entry.executor!;
    const base: ResourceRequest = { owner: record.jobId, label: record.kind, queue: executor.queue };
    if (executor.resources) return { ...base, ...executor.resources };
    if (executor.generator && record.kind === 'generateImage' && record.providerId === 'local' && record.bundleId) {
      // Local image generation uses the peak measured and registered for the model package (candle takes the value from the device the Worker reports, and the pool).
      return { ...base, ...localImageResources(record.bundleId, this.#catalog.imagePeak(record.bundleId)) };
    }
    if (executor.generator && record.kind === 'generateMusic' && record.providerId === 'local' && record.bundleId) {
      // Local music uses the estimated peak registered for the model package (the engine runs one process per job and does not share a holder).
      return { ...base, ...localMusicResources(record.bundleId, this.#catalog.musicPeak(record.bundleId)) };
    }
    const localModel = executor.transcriber || (executor.generator && record.kind === 'synthesizeSpeech');
    if (localModel && record.providerId === 'local' && record.bundleId) {
      // Recognition and candle local synthesis use the resident estimate computed at submission; MLX local synthesis uses fixed demand.
      return { ...base, ...localTranscribeResources(record.bundleId, executor.workerFootprint ?? null) };
    }
    return base;
  }

  /** How much the local recognition and synthesis model package stays resident after loading (`ModelCatalog.workerFootprint`); null when the model package is not local. */
  #workerFootprint(providerId: string, bundleId: string | null): Promise<WorkerFootprint | null> {
    return providerId === 'local' && bundleId ? this.#catalog.workerFootprint(bundleId) : Promise.resolve(null);
  }

  /** Obtains the lease: starts execution; the lease is returned after execution finishes (including after the provider stops). */
  #admitted(entry: Entry, lease: ResourceLease): void {
    entry.ticket = null;
    if (this.#closing || entry.record.state !== 'queued') return lease.release();
    delete entry.record.wait;
    const run: Promise<void> = this.#execute(entry)
      .catch((error: unknown) => {
        if (error instanceof SimulatedCrash) return this.#crash(entry);
        this.#log.error('Task execution failed', { jobId: entry.record.jobId, error: String(error) });
        return this.#finish(entry, 'failed', { error: jobError('INTERNAL', J.executeFailed()) });
      })
      .finally(() => {
        this.#running.delete(run);
        lease.release();
      });
    this.#running.add(run);
  }

  /** Resource scheduling (used by `jobs.resources` and by the steps of fixed pipelines). */
  get resources(): ResourceScheduler {
    return this.#resources;
  }

  // ---- Cancel and stop ----

  /**
   * Cancels a computation (§7.4). A queued job is cancelled immediately. A running one waits for the provider to stop (local providers take up to about 5 seconds). If a result has already been obtained but not yet committed to the video,
   * it is not committed (stop barrier), and the result is kept as a candidate. The three cancellation facts are recorded in `cancellation`.
   */
  async cancel(jobId: Id): Promise<{ state: JobState }> {
    const entry = this.#entries.get(jobId);
    if (!entry) throw new RpcError('not-found', J.jobNotFound());
    const state = entry.record.state;
    if (isTerminal(state)) return { state };
    const barrier = this.#requestCancel(entry);
    const [settled] = await Promise.all([entry.settled, barrier]);
    return { state: settled };
  }

  /**
   * Cancellation used by the main stop (§7.4): it issues the cancel and waits only for the engine-side stop barrier to be confirmed, not for the provider to stop. Once it is fulfilled, any commit for this job that reaches the engine afterwards is rejected;
   * when it fulfills false (no video, engine absent), only the Node-side barrier exists.
   */
  cancelWrites(jobId: Id): Promise<boolean> {
    const entry = this.#entries.get(jobId);
    if (!entry || isTerminal(entry.record.state)) return Promise.resolve(false);
    return this.#requestCancel(entry);
  }

  /** Records the cancellation and issues it: the barrier is sent to the engine synchronously, before any await. Returns the barrier's confirmation. */
  #requestCancel(entry: Entry): Promise<boolean> {
    const state = entry.record.state;
    entry.cancelRequested = true;
    entry.cancelRequestedAt ??= nowIso();
    if (state === 'queued' && !entry.hosted) {
      // A queued job has not been written yet, so it does not use the engine-side barrier; a failure to persist the terminal state is left to the caller.
      const cancellation = cancellationFacts(entry.record, 'queued', entry.cancelRequestedAt);
      return this.#finish(entry, 'cancelled', { cancellation }).then(() => false);
    }
    // Engine-side stop barrier: commits for this execution that reach the engine after this point are rejected.
    const barrier = this.#invalidate(entry);
    if (entry.hosted) entry.hosted.cancel();
    else entry.controller?.abort();
    return barrier;
  }

  /**
   * The execution of this job (§7.4): Task/Run is not implemented yet, so the job is its own execution. `runGeneration` is its `attempt` (a retry changes the generation). The steps of a fixed pipeline belong to the parent job's execution (consistent with `PipelineStepContext.run`).
   */
  #runOf(entry: Entry): ApplicationRun {
    const parentId = entry.record.parentJobId;
    const owner = (parentId != null ? this.#entries.get(parentId) : undefined) ?? entry;
    return { runId: owner.record.jobId, runGeneration: String(owner.record.attempt) };
  }

  /** Makes the engine reject commits for this job's generation that arrive after this point. Sent synchronously; fulfills false when there is no video or the engine does not support it. */
  #invalidate(entry: Entry): Promise<boolean> {
    const videoId = entry.record.videoId;
    if (videoId === null || !this.#videos.invalidateRun) return Promise.resolve(false);
    return this.#videos.invalidateRun(videoId, this.#runOf(entry)).catch(() => false);
  }

  /** Normal stop (architecture design §2.4): rejects new jobs, aborts in-flight jobs and marks them `interrupted`, and closes the provider's processes. */
  async shutdown(): Promise<void> {
    if (this.#closing) return;
    this.#closing = true;
    await this.#recovering?.catch(() => {});
    const pending: Promise<unknown>[] = [];
    for (const entry of this.#entries.values()) {
      // Jobs not yet reached by recovery stay in the ledger unchanged and are handled at the next startup.
      if (this.#awaitingRecovery.has(entry.record.jobId)) continue;
      if (entry.hosted && !isTerminal(entry.record.state)) {
        entry.hosted.interrupt();
        pending.push(entry.settled);
      } else if (entry.record.state === 'queued') pending.push(this.#finish(entry, 'interrupted', { error: stoppedError() }));
      else if (entry.record.state === 'running') {
        entry.controller?.abort();
        pending.push(entry.settled);
      }
    }
    await Promise.allSettled(pending);
    await Promise.allSettled([...this.#running]);
    await Promise.allSettled([
      ...this.#router.executors().map((p) => p.close()),
      ...(this.#router.generators?.() ?? []).map((g) => g.close()),
    ]);
    await this.#ledger.flush();
    await this.#applications.flush();
  }

  // ---- Recovery and reconciliation (§7.5) ----

  /**
   * Handles a job that, after a restart, has an unknown result, has not finished applying, or was interrupted (`jobs.reconcile`; the decisions and legal states are in `job-reconcile.ts`).
   * `conflict` (`RECONCILE_NOT_ALLOWED`) if the action is not legal. Returns the record after handling.
   */
  async reconcile(jobId: Id, decision: JobReconcileDecision): Promise<JobRecord> {
    if (this.#closing) throw new RpcError('busy', J.runtimeStopping());
    const entry = this.#entries.get(jobId);
    if (!entry) throw new RpcError('not-found', J.jobNotFound());
    if (this.#reconciling.has(jobId) || this.#awaitingRecovery.has(jobId)) {
      throw new RpcError('conflict', J.jobReconciling(), { code: 'RECONCILE_NOT_ALLOWED', state: entry.record.state, allowed: [] });
    }
    const latest = this.#applications.latest(jobId);
    const allowed = reconcileChoices(entry, latest?.record);
    if (!allowed.includes(decision)) throw reconcileNotAllowed(entry, decision, allowed);
    this.#reconciling.add(jobId);
    try {
      if (decision === 'retry') await this.#retry(entry);
      else if (decision === 'discard') await this.#discard(entry);
      else await this.#reapply(entry, latest!);
    } finally {
      this.#reconciling.delete(jobId);
    }
    this.#log.info('Task reconciled', { jobId, decision, state: entry.record.state });
    return structuredClone(entry.record);
  }

  /** `retry`: the same job goes back to `queued`, `attempt` goes up by one, and it is admitted again. The video must already be open (it is not opened on the user's behalf). */
  async #retry(entry: Entry): Promise<void> {
    const record = entry.record;
    if (record.videoId !== null && this.#videos.videoRevision(record.videoId) === null) {
      throw new RpcError('not-found', J.openVideoToRetry(), { code: 'VIDEO_NOT_OPEN' });
    }
    const prepared = await this.#prepare(entry);
    if (record.videoId !== null) {
      this.#videos.retain(record.videoId);
      entry.leased = true;
    }
    this.#restart(entry, prepared);
  }

  /** `discard`: abandons an outbound call whose result is unknown. The budget charged by the conservative rule is not refunded. */
  async #discard(entry: Entry): Promise<void> {
    const record = entry.record;
    const now = nowIso();
    Object.assign(record, {
      state: 'cancelled',
      error: null,
      endedAt: now,
      cancellation: cancellationFacts(record, 'unknown', now, { now }),
    } satisfies Partial<JobRecord>);
    this.#changed(entry, false);
    await this.#save();
  }

  /** `apply`: first looks up the receipt by the old `commandId` (it may have been committed), then creates a new apply, validates it again, and commits. The video must already be open. */
  async #reapply(entry: Entry, latest: StoredApplication): Promise<void> {
    const videoId = entry.record.videoId!;
    if (this.#videos.videoRevision(videoId) === null) {
      throw new RpcError('not-found', J.openVideoToApply(), { code: 'VIDEO_NOT_OPEN' });
    }
    this.#videos.retain(videoId);
    entry.leased = true;
    try {
      // If the receipt cannot be looked up, we do not know whether it was committed last time: do not rewrite under a new command; leave it for the next reconciliation.
      const found = await this.#runner.lookup(latest).catch((error: unknown) => {
        throw new RpcError('busy', J.receiptUnknownLater(), {
          code: 'RECEIPT_UNKNOWN',
          cause: error instanceof Error ? error.message : String(error),
        });
      });
      if (found) return await this.#concludeApplication(entry, await this.#runner.commit(latest, found));
      const item = await this.#runner.create({
        jobId: entry.record.jobId,
        videoId,
        artifactIds: latest.record.artifactIds,
        targetRefs: latest.record.targetRefs,
        place: this.#videos.place?.(videoId) ?? latest.place,
      });
      this.#project(entry);
      await this.#save();
      const app = await this.#runApplication(entry, item, this.#targetFor(entry, item), () => false);
      await this.#concludeApplication(entry, app);
    } finally {
      if (entry.leased) {
        entry.leased = false;
        this.#videos.release(videoId);
      }
    }
  }

  /** A job not claimed at restart: validated again (video and asset, provider, authorization and budget), then queued; fails if the validation does not pass. */
  async #requeue(entry: Entry): Promise<void> {
    const record = entry.record;
    try {
      if (record.videoId !== null) {
        await this.#retainVideo(record.videoId, entry.videoPlace ?? null);
        entry.leased = true;
      }
      const prepared = await this.#prepare(entry);
      this.#log.info('Re-queuing task queued last run', { jobId: record.jobId, kind: record.kind });
      this.#restart(entry, { ...prepared, attempt: record.attempt });
    } catch (error) {
      if (error instanceof SimulatedCrash) throw error;
      // Missing input is a failure; a provider, authorization or budget that does not hold right now is an interruption (`jobs.reconcile retry` can be used later).
      if (error instanceof StaleInput) {
        await this.#finish(entry, 'failed', {
          error: jobError('STALE_JOB_INPUT', withCause(J.requeueCheckFailed(), error)),
        });
      } else {
        await this.#finish(entry, 'interrupted', { error: rpcJobError(error, J.requeueCheckFailed(), 'JOB_INTERRUPTED') });
      }
    }
  }

  /**
   * Preparation before re-execution: re-select the provider (the frozen provider and model), read the asset and check its content, and admit again.
   * The record is not changed. Throws when it does not pass (`StaleInput` or `RpcError`).
   */
  async #prepare(entry: Entry): Promise<Prepared> {
    const record = entry.record;
    const spec = entry.spec;
    const choice = { provider: record.providerId, model: record.modelId };
    const hint = record.grant ? { grantId: record.grant.grantId, dataKinds: record.grant.dataKinds } : undefined;
    if (isTranscribeSpec(spec)) {
      const source = await this.#videos
        .source(record.videoId!, record.assetId!, record.assetRevision ?? undefined)
        .catch((error: unknown) => {
          throw error instanceof RpcError && error.code === 'not-found' ? new StaleInput(J.assetVersionGone()) : error;
        });
      if (source.contentHash !== record.contentHash) throw new StaleInput(J.assetChanged());
      const selection = await this.#router.selectTranscribe(choice);
      const grant = this.#admit(record.jobId, 'transcribe', selection, record.videoId, record.submitter, hint, {});
      const workerFootprint = await this.#workerFootprint(selection.providerId, selection.bundleId);
      return {
        input: {
          file: source.file,
          mediaType: source.mediaType,
          track: spec.track,
          hint: spec.hint,
          range: spec.range,
          timescale: DEFAULT_TIMESCALE,
        },
        executor: { transcriber: selection.transcriber, queue: selection.queue, workerFootprint },
        grant: grant ?? null,
      };
    }
    if (!('capability' in spec) || !this.#router.selectGeneration) throw new RpcError('conflict', J.cannotRerun());
    const selection = await this.#router.selectGeneration(spec.capability, choice);
    const parameters = spec.parameters;
    const quantity =
      parameters.capability === 'synthesizeSpeech'
        ? { chars: [...parameters.text].length }
        : parameters.capability === 'generateImage'
          ? { count: parameters.count }
          : {};
    const grant = this.#admit(record.jobId, spec.capability, selection, record.videoId, record.submitter, hint, quantity);
    const workerFootprint =
      spec.capability === 'synthesizeSpeech' ? await this.#workerFootprint(selection.providerId, selection.modelId) : null;
    return { input: NO_INPUT, executor: { generator: selection.generator, queue: selection.queue, workerFootprint }, grant: grant ?? null };
  }

  /** Returns a prepared job to `queued`: a new `settled` is issued, and the old settlement is recorded in `grant.retries`. */
  #restart(entry: Entry, prepared: Prepared & { attempt?: number }): void {
    const record = entry.record;
    const previous = record.grant;
    let settle!: (state: JobState) => void;
    entry.settled = new Promise<JobState>((resolve) => {
      settle = resolve;
    });
    entry.settle = settle;
    entry.cancelRequested = false;
    entry.cancelRequestedAt = null;
    entry.input = prepared.input;
    entry.executor = prepared.executor;
    if (record.library) {
      try {
        this.#options.library?.pin(record.jobId, record.library.entries);
      } catch (error) {
        this.#log.warn('Could not pin library versions on re-run', { jobId: record.jobId, error: String(error) });
      }
    }
    delete record.cancellation;
    Object.assign(record, {
      state: 'queued',
      phase: 'queued',
      progress: null,
      attempt: prepared.attempt ?? record.attempt + 1,
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
    } satisfies Partial<JobRecord>);
    if (prepared.grant) {
      const history = [...(previous?.retries ?? []), ...(previous?.settled ? [previous.settled] : [])];
      record.grant = { ...prepared.grant, ...(history.length > 0 ? { retries: history } : {}) };
    } else if (previous) {
      delete record.grant;
    }
    this.#enqueue(entry);
  }

  /** After a restart, completes the apply: first looks up the receipt by the recorded `commandId`; only if it was never committed is the apply validated again and applied (agent-submitted jobs are no longer applied automatically). */
  async #resumeApplication(entry: Entry): Promise<void> {
    const item = this.#applications.latest(entry.record.jobId)!;
    const videoId = item.record.videoId;
    try {
      await this.#retainVideo(videoId, item.place);
      entry.leased = true;
    } catch (error) {
      const app =
        error instanceof StaleInput
          ? await this.#runner.end(item, 'stale-input', jobError('STALE_JOB_INPUT', errorText(error)))
          : await this.#runner.end(item, 'rejected', rpcJobError(error, J.cannotOpenVideoAfterRestart(), 'APPLY_FAILED'));
      return this.#concludeApplication(entry, app);
    }
    let found: AppliedReceipt | null;
    try {
      found = await this.#runner.lookup(item);
    } catch (error) {
      // Receipt cannot be looked up: we do not know whether it was committed last time, and cannot rewrite under a new command. Left to the user (`jobs.reconcile apply` looks it up once more first).
      const app = await this.#runner.end(item, 'rejected', rpcJobError(error, J.receiptUnknown(), 'RECEIPT_UNKNOWN', true));
      return this.#concludeApplication(entry, app);
    }
    if (found) {
      this.#log.info('Last application was committed; recording its receipt', { jobId: entry.record.jobId, applicationId: item.record.applicationId });
      return this.#concludeApplication(entry, await this.#runner.commit(item, found));
    }
    const agent = entry.record.submitter.kind === 'agent';
    const stopped = () => agent || entry.cancelRequested;
    const app = await this.#runApplication(entry, item, this.#targetFor(entry, item), stopped, this.#runOf(entry));
    return this.#concludeApplication(entry, app);
  }

  /** Queries a remote job (§7.5). What happens when it is found still running or already succeeded is not defined: it always waits for the user to reconcile, and is never resubmitted. */
  async #queryRemote(entry: Entry, remoteTaskId: string): Promise<void> {
    const record = entry.record;
    const status = await this.#options
      .remoteTasks!.query({ jobId: record.jobId, providerId: record.providerId, modelId: record.modelId, remoteTaskId })
      .catch(() => null);
    if (status?.status === 'failed') {
      return this.#finish(entry, 'failed', { error: { code: 'PROVIDER_REJECTED', message: status.message, details: { remoteTaskId } } });
    }
    if (status?.status === 'not-found') return this.#finish(entry, 'interrupted', { error: stoppedError() });
    return this.#finish(entry, 'needs-reconciliation', {
      error: { ...reconciliationError(), details: { remoteTaskId, remote: status?.status ?? 'unknown' } },
    });
  }

  /** Keeps the video open: if it is already open, adds a lease; if it is not open after a restart, reopens it at the recorded position. Throws `StaleInput` if the conditions do not hold. */
  async #retainVideo(videoId: Id, place: VideoPlace | null): Promise<void> {
    if (this.#videos.videoRevision(videoId) !== null) {
      this.#videos.retain(videoId);
      return;
    }
    if (!place || !this.#videos.reopen) throw new StaleInput(J.videoNotOpenNoPlace());
    const outcome = await this.#videos.reopen(videoId, place);
    if (outcome === 'missing') throw new StaleInput(J.videoFolderGone());
    if (outcome === 'mismatch') throw new StaleInput(J.videoReplaced());
  }

  /** The apply on the job record (a projection; the authority is the application ledger). */
  #project(job: StoredJob): void {
    const items = this.#applications.forJob(job.record.jobId);
    if (items.length > 0) job.record.applications = items.map((item) => structuredClone(item.record));
    else delete job.record.applications;
  }

  /** Fault injection simulated a crash: freezes both ledgers and leaves this job behind (no settlement, no record change), as if the process had died. */
  #crash(entry: Entry): void {
    this.#crashed = true;
    this.#applications.freeze();
    this.#log.warn('Simulated crash', { jobId: entry.record.jobId });
    entry.controller = null;
    if (entry.leased) {
      entry.leased = false;
      if (entry.record.videoId) this.#videos.release(entry.record.videoId);
    }
    entry.settle(entry.record.state);
  }

  #fault(point: JobFaultPoint, entry: Entry): void {
    if (this.#options.faults?.(point, { jobId: entry.record.jobId }) === 'crash') throw new SimulatedCrash(point);
  }

  // ---- Execution ----

  async #execute(entry: Entry): Promise<void> {
    if (isHostedSpec(entry.spec)) throw new Error('Hosted tasks are not queued');
    if (isTaskSpec(entry.spec)) return this.#executeTask(entry);
    if (!isTranscribeSpec(entry.spec)) return this.#executeGeneration(entry, entry.spec);
    const spec = entry.spec;
    const record = entry.record;
    const provider = entry.executor?.transcriber;
    if (!provider) return this.#finish(entry, 'failed', { error: jobError('MODEL_LOAD_FAILED', J.providerUnavailable()) });
    const staging = this.#stagingOf(record.jobId);
    for (;;) {
      const refused = await this.#grantStart(entry);
      if (refused) return this.#finish(entry, 'failed', { error: refused });
      const now = nowIso();
      Object.assign(record, { state: 'running', phase: 'starting', progress: null, error: null, startedAt: record.startedAt ?? now });
      // Each attempt recognizes from the beginning (staging is cleared, not continued from the previous segments.jsonl), and live segments also start again from index 0.
      entry.liveSegments = [];
      this.#changed(entry, true);
      await fs.rm(staging, { recursive: true, force: true });
      await fs.mkdir(staging, { recursive: true });
      const controller = new AbortController();
      entry.controller = controller;
      if (entry.cancelRequested || this.#closing) controller.abort();

      let failure: ProviderFailure;
      try {
        const attempt = await provider.transcribe(
          {
            jobId: record.jobId,
            runGeneration: record.attempt,
            providerId: record.providerId,
            modelId: record.modelId,
            bundleId: record.bundleId,
            input: {
              file: entry.input.file,
              contentHash: record.contentHash,
              track: entry.input.track,
              ...(entry.input.range ? { range: entry.input.range } : {}),
            },
            options: {
              language: spec.language,
              diarize: spec.diarize,
              ...(entry.input.hint ? { hint: entry.input.hint } : {}),
              timescale: entry.input.timescale,
            },
            staging,
            ...(entry.workerVersion ? { expectedWorkerVersion: entry.workerVersion } : {}),
            ...(entry.input.mediaType ? { mediaType: entry.input.mediaType } : {}),
            ...(record.providerId.startsWith(NODE_PREFIX) ? { node: record.providerId.slice(NODE_PREFIX.length) } : {}),
          },
          this.#sink(entry),
          controller.signal,
        );
        entry.controller = null;
        if (attempt.outcome === 'cancelled' && attempt.warnings?.length) record.warnings = [...record.warnings, ...attempt.warnings];
        if (attempt.outcome === 'cancelled' || entry.cancelRequested || this.#closing)
          return this.#stopped(entry, attempt.outcome === 'cancelled');
        entry.workerVersion ??= attempt.workerVersion;
        return await this.#complete(entry, attempt.output, staging, attempt.runGeneration ?? record.attempt);
      } catch (error) {
        entry.controller = null;
        if (entry.cancelRequested || this.#closing) return this.#stopped(entry);
        if (!(error instanceof ProviderFailure)) throw error;
        failure = error;
      }

      const details = failure.details;
      switch (failure.kind) {
        case 'crashed': {
          if (typeof details.workerVersion === 'string') entry.workerVersion ??= details.workerVersion;
          const error = jobError('MODEL_WORKER_CRASHED', errorText(failure), { ...details, attempt: record.attempt });
          if (record.attempt === 1 && (record.bundleId === null || !this.#catalog.blocked(record.bundleId))) {
            // This run did not finish: mark it interrupted, and try again with the same model package, the same input and the same Worker version (§6.5).
            this.#log.warn('Model Worker crashed; retrying once', { jobId: record.jobId });
            if (entry.target.kind === 'file') entry.target.observer.retrying?.(record.attempt + 1);
            Object.assign(record, { state: 'interrupted', error });
            this.#changed(entry, true);
            const budget = this.#grantRetry(entry);
            if (budget) return this.#finish(entry, 'failed', { error: budget });
            record.attempt++;
            continue;
          }
          const message = record.providerId === 'local' ? J.localCrashedAfterRetry() : J.transcribeFailedAfterRetry();
          return this.#finish(entry, 'failed', { error: jobError(error.code, message, error.details) });
        }
        default:
          return this.#finish(entry, 'failed', { error: failureError(failure, record.providerId) });
      }
    }
  }

  /** One execution of a job that does not go through a model. A normal return means completion; a failure after the signal aborts counts as a cancellation or interruption. */
  async #executeTask(entry: Entry): Promise<void> {
    const record = entry.record;
    const run = entry.executor?.task;
    if (!run) return this.#finish(entry, 'failed', { error: jobError('INTERNAL', J.executorGone()) });
    const staging = this.#stagingOf(record.jobId);
    Object.assign(record, { state: 'running', phase: 'starting', progress: null, error: null, startedAt: record.startedAt ?? nowIso() });
    this.#changed(entry, true);
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });
    const controller = new AbortController();
    entry.controller = controller;
    if (entry.cancelRequested || this.#closing) controller.abort();
    const update = (patch: Partial<JobRecord>) => {
      if (record.state !== 'running') return;
      Object.assign(record, patch);
      this.#changed(entry, false);
    };
    try {
      const result = await run({
        jobId: record.jobId,
        staging,
        signal: controller.signal,
        phase: (phase, progress = null) => update({ phase, progress }),
        warn: (warning) => update({ warnings: [...record.warnings, warning] }),
        command: (command) => update({ command }),
      });
      entry.controller = null;
      return await this.#finish(entry, 'completed', { result });
    } catch (error) {
      entry.controller = null;
      if (controller.signal.aborted) return this.#stopped(entry);
      if (!(error instanceof TaskFailure)) throw error;
      const failed = jobError(error.code, errorText(error), error.details);
      return this.#finish(entry, 'failed', { error: failed, ...(error.result ? { result: error.result } : {}) });
    }
  }

  /** One execution of a generation job. Online providers retry connection failures and 5xx themselves, with bounded retries; no retry here, and no model or voice swap. */
  async #executeGeneration(entry: Entry, spec: GenerationInputSpec): Promise<void> {
    const record = entry.record;
    const generator = entry.executor?.generator;
    if (!generator) return this.#finish(entry, 'failed', { error: jobError('MODEL_LOAD_FAILED', J.providerUnavailable()) });
    const refused = await this.#grantStart(entry);
    if (refused) return this.#finish(entry, 'failed', { error: refused });
    const staging = this.#stagingOf(record.jobId);
    Object.assign(record, { state: 'running', phase: 'starting', progress: null, error: null, startedAt: record.startedAt ?? nowIso() });
    this.#changed(entry, true);
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });
    const controller = new AbortController();
    entry.controller = controller;
    if (entry.cancelRequested || this.#closing) controller.abort();
    try {
      const attempt = await generator.generate(
        {
          jobId: record.jobId,
          attempt: record.attempt,
          providerId: record.providerId,
          modelId: record.modelId,
          parameters: spec.parameters,
          staging,
        },
        this.#generationSink(entry),
        controller.signal,
      );
      entry.controller = null;
      if (attempt.outcome === 'cancelled' || entry.cancelRequested || this.#closing)
        return this.#stopped(entry, attempt.outcome === 'cancelled');
      entry.workerVersion ??= attempt.workerVersion;
      return await this.#completeGeneration(entry, spec, attempt.outputs, staging, attempt.text);
    } catch (error) {
      entry.controller = null;
      if (entry.cancelRequested || this.#closing) return this.#stopped(entry);
      if (!(error instanceof ProviderFailure)) throw error;
      return this.#finish(entry, 'failed', { error: failureError(error, record.providerId) });
    }
  }

  #generationSink(entry: Entry): GenerationSink {
    const record = entry.record;
    const update = (patch: Partial<JobRecord>) => {
      if (record.state !== 'running') return;
      Object.assign(record, patch);
      this.#changed(entry, false);
    };
    return {
      generating: () => update({ phase: 'generating' }),
      progress: (done, total, unit = 'outputs') => update({ phase: 'generating', progress: { done, total, unit } }),
      warning: (warning) => update({ warnings: [...record.warnings, warning] }),
    };
  }

  /** Validation (digest, length, file header, ffprobe decode) → publish → if a video is given, import as an asset (§7.3). */
  async #completeGeneration(
    entry: Entry,
    spec: GenerationInputSpec,
    outputs: GenerationOutputFile[],
    staging: string,
    text?: TextResult,
  ): Promise<void> {
    const record = entry.record;
    const parameters = spec.parameters;
    if (parameters.capability === 'generateText') return this.#completeText(entry, parameters, outputs, staging, text);
    this.#phase(entry, 'validating');
    const expected = GENERATED_MEDIA[parameters.format]!;
    const count = parameters.capability === 'generateImage' ? parameters.count : 1;
    const files: string[] = [];
    const checked: Array<{ bytes: Buffer; media: MediaFacts }> = [];
    const problems: string[] = [];
    if (outputs.length !== count) problems.push(J.outputCountMismatch({ actual: outputs.length, expected: count }).text);
    for (const [index, output] of outputs.entries()) {
      const n = index + 1;
      const file = path.resolve(staging, output.path);
      const relative = path.relative(staging, file);
      if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        problems.push(J.outputNotInStaging({ n }).text);
        continue;
      }
      files.push(file);
      const bytes = await fs.readFile(file).catch(() => null);
      if (!bytes) {
        problems.push(J.outputMissing({ n }).text);
        continue;
      }
      if (bytes.length !== output.byteLength) problems.push(J.outputLengthMismatch({ n, actual: bytes.length, declared: output.byteLength }).text);
      if (sha256Hex(bytes) !== output.sha256.replace(/^sha256:/, '')) problems.push(J.outputShaMismatch({ n }).text);
      if (output.mediaType !== expected.mediaType) problems.push(J.outputTypeMismatch({ n, actual: output.mediaType, expected: expected.mediaType }).text);
      const probed = await this.#probe(file, expected.mediaType);
      if (!probed.ok) {
        problems.push(...probed.problems.map((problem) => J.outputProblem({ n, problem }).text));
        continue;
      }
      checked.push({ bytes, media: probed.media });
    }
    if (problems.length > 0) return this.#rejectGenerated(entry, files, problems);

    this.#phase(entry, 'publishing');
    // The artifact ID is the content digest, so it is known before writing: record the publish intent first (§7.3).
    const published: GeneratedOutput[] = checked.map(({ bytes, media }) => ({
      artifactId: artifactIdOf(bytes),
      mediaType: expected.mediaType,
      byteLength: bytes.length,
      assetId: null,
      media,
    }));
    const result = { documentId: null, artifactId: published[0]!.artifactId, outputs: published };
    const artifactIds = published.map((o) => o.artifactId);
    const targetRefs = record.videoId === null ? null : published.map((_, i) => `output${i + 1}`);
    await this.#publish(entry, { artifactIds, result, targetRefs, warnings: record.warnings }, async () => {
      for (const { bytes } of checked) await this.#artifacts.put(bytes, expected.extension);
    });
    const paths = await this.#saveCopies(entry, spec, published.map((o) => ({ artifactId: o.artifactId, extension: expected.extension })));
    paths.forEach((p, i) => {
      if (p !== null) published[i]!.path = p;
    });
    if (targetRefs === null) return this.#finish(entry, 'completed', { result });
    return this.#applyPublished(entry, result, { artifactIds, targetRefs });
  }

  /**
   * Result of text generation: checks the path, digest and length, and decodes as UTF-8. Structured output is parsed again and validated against the frozen schema (the executor has already validated it, but it is not trusted here) → published as an artifact → the result carries the artifact ID and a preview of the opening paragraph.
   * Plain text cut off by the output limit still completes, with an `output-truncated` warning (§6.4: `length` is not a full success).
   */
  async #completeText(
    entry: Entry,
    parameters: TextParameters,
    outputs: GenerationOutputFile[],
    staging: string,
    text: TextResult | undefined,
  ): Promise<void> {
    const record = entry.record;
    this.#phase(entry, 'validating');
    const json = parameters.responseFormat.type === 'json';
    const mediaType = json ? 'application/json' : 'text/plain';
    const problems: string[] = [];
    const files: string[] = [];
    let content: string | null = null;
    let bytes: Buffer | null = null;
    if (!text) problems.push(J.noTextResult().text);
    if (outputs.length !== 1) problems.push(J.textOutputCount({ actual: outputs.length }).text);
    const output = outputs[0];
    if (output) {
      const file = path.resolve(staging, output.path);
      const relative = path.relative(staging, file);
      if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        problems.push(J.textNotInStaging().text);
      } else {
        files.push(file);
        bytes = await fs.readFile(file).catch(() => null);
        if (!bytes) problems.push(J.textMissing().text);
      }
      if (bytes) {
        if (bytes.length !== output.byteLength) problems.push(J.textLengthMismatch({ actual: bytes.length, declared: output.byteLength }).text);
        if (sha256Hex(bytes) !== output.sha256.replace(/^sha256:/, '')) problems.push(J.textShaMismatch().text);
        if (output.mediaType !== mediaType) problems.push(J.textTypeMismatch({ actual: output.mediaType, expected: mediaType }).text);
        try {
          content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          problems.push(J.notUtf8().text);
        }
      }
    }
    if (content !== null && parameters.responseFormat.type === 'json') {
      try {
        problems.push(...compileJsonSchema(parameters.responseFormat.schema).validate(JSON.parse(content)));
      } catch {
        problems.push(J.notJson().text);
      }
    }
    if (content !== null && content.trim().length === 0) problems.push(J.emptyOutput().text);
    if (problems.length > 0 || !text || !bytes || content === null) return this.#rejectGenerated(entry, files, problems);

    this.#phase(entry, 'publishing');
    const artifactId = artifactIdOf(bytes);
    const chars = [...content];
    const summary: TextJobResult = {
      mediaType,
      byteLength: bytes.length,
      length: chars.length,
      preview: chars.slice(0, TEXT_PREVIEW_CHARS).join(''),
      previewTruncated: chars.length > TEXT_PREVIEW_CHARS,
      finishReason: text.finishReason,
      usage: text.usage,
      modelVersion: text.modelVersion,
      notes: text.notes,
    };
    if (text.finishReason === 'length') {
      record.warnings = [
        ...record.warnings,
        jobWarning('output-truncated', J.outputTruncated({ limit: parameters.maxOutputTokens })),
      ];
    }
    const result: NonNullable<JobRecord['result']> = { documentId: null, artifactId, text: summary };
    await this.#publish(entry, { artifactIds: [artifactId], result, targetRefs: null, warnings: record.warnings }, async () => {
      await this.#artifacts.put(bytes, json ? 'json' : 'txt');
    });
    // Copy at the save location (§7.9): when written, the result has one more text output with `path`; everything else is unchanged.
    const [saved] = await this.#saveCopies(entry, entry.spec as GenerationInputSpec, [{ artifactId, extension: json ? 'json' : 'txt' }]);
    if (saved) {
      result.outputs = [
        { artifactId, mediaType, byteLength: bytes.length, assetId: null, media: { kind: 'text', entries: 0, durationSec: 0 }, path: saved },
      ];
    }
    return this.#finish(entry, 'completed', { result });
  }

  /**
   * Copy to the save location (architecture design §7.9, “save location”): after the artifact is published, a copy is made under a readable name in the directory frozen at submission. It is not hard-linked into the artifact library,
   * so user edits to the copy do not affect the artifact. On a name clash a sequence number is added and nothing is overwritten. Multiple outputs get sequence numbers in turn. A failed write does not fail the job: that output has no path, and the result carries a `save-copy-failed` warning. Everything is null when there is no save location.
   */
  async #saveCopies(
    entry: Entry,
    spec: GenerationInputSpec,
    items: Array<{ artifactId: string; extension: string }>,
  ): Promise<Array<string | null>> {
    const save = spec.save;
    if (!save) return items.map(() => null);
    const record = entry.record;
    const paths: Array<string | null> = [];
    for (const [index, item] of items.entries()) {
      const stem = items.length > 1 ? `${save.stem}-${index + 1}` : save.stem;
      try {
        const source = await this.#artifacts.locate(item.artifactId);
        if (!source) throw new Error('Output not found in the output store');
        await fs.mkdir(save.dir, { recursive: true });
        paths.push(await publishFile(source, save.dir, stem, `.${item.extension}`, record.jobId, false));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.#log.warn('Copy to save location was not written', { jobId: record.jobId, reason });
        record.warnings = [...record.warnings, jobWarning('save-copy-failed', J.saveCopyFailed({ dir: save.dir, reason: errorText(error) }))];
        paths.push(null);
      }
    }
    return paths;
  }

  /** Generated output fails validation: it is not published and not retried; the raw file is moved to the diagnostics directory (§6.5). */
  async #rejectGenerated(entry: Entry, files: string[], problems: string[]): Promise<void> {
    const record = entry.record;
    const dir = path.join(this.#options.paths.diagnosticsDir, record.jobId);
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) {
      const kept = path.join(dir, path.basename(file));
      await fs.rename(file, kept).catch(() => {});
    }
    await fs.writeFile(path.join(dir, 'job.json'), `${JSON.stringify({ record, problems }, null, 2)}\n`).catch(() => {});
    this.#log.warn('Generated output failed validation', { jobId: record.jobId, problems: problems.slice(0, 5) });
    return this.#finish(entry, 'failed', {
      error: jobError('MODEL_OUTPUT_INVALID', J.generatedInvalid(), { problems }),
    });
  }

  // ---- Apply to video (§7.1–§7.3) ----

  /**
   * Publishes an artifact (§7.3): first records the publish intent in the ledger (artifact ID, result, apply target), then writes to the artifact library. If it crashes in between or after, the restart claims the artifact already written, using the intent (`#claimPublished`), with no re-inference and no resent request. The intent is cleared when the result and apply are recorded (or the job ends).
   */
  async #publish(entry: Entry, intent: PublishIntent, write: () => Promise<void>): Promise<void> {
    entry.publishing = structuredClone(intent);
    await this.#save();
    await write();
    this.#fault('artifact-stored', entry);
  }

  /**
   * The artifact is published: settles the budget (as completed; whether the apply later succeeds or fails does not affect the budget), records the result and a `pending` apply (until it is persisted),
   * then validates and commits. `asr`: the transcription result just validated (not read back from the artifact).
   */
  async #applyPublished(
    entry: Entry,
    result: NonNullable<JobRecord['result']>,
    target: { artifactIds: string[]; targetRefs: string[] },
    asr?: AsrResult,
  ): Promise<void> {
    const record = entry.record;
    const videoId = record.videoId!;
    record.result = result;
    if (record.grant && !record.grant.settled && this.#options.admission) {
      record.grant = this.#options.admission.settle(record.grant, { state: 'completed' });
    }
    const item = await this.#runner.create({ jobId: record.jobId, videoId, ...target, place: this.#videos.place?.(videoId) ?? null });
    // Both the result and the apply are recorded: the publish intent is cleared with this write.
    delete entry.publishing;
    this.#project(entry);
    this.#phase(entry, 'applying');
    await this.#save();
    this.#fault('artifact-published', entry);
    const applyTarget = this.#targetFor(entry, item, asr);
    const app = await this.#runApplication(entry, item, applyTarget, () => entry.cancelRequested, this.#runOf(entry));
    return this.#concludeApplication(entry, app);
  }

  /** Runs one apply. An unexpected error is recorded as `rejected`; a simulated crash still throws. */
  async #runApplication(
    entry: Entry,
    item: StoredApplication,
    target: ApplicationTarget,
    stopped: () => boolean,
    run?: ApplicationRun,
  ): Promise<ApplicationRecord> {
    try {
      return await this.#runner.run(item, target, stopped, run);
    } catch (error) {
      if (error instanceof SimulatedCrash) throw error;
      this.#log.error('Applying to video failed', { jobId: entry.record.jobId, error: String(error) });
      return this.#runner.end(
        item,
        'rejected',
        jobError('INTERNAL', J.applyError(), { cause: error instanceof Error ? error.message : String(error) }),
      );
    }
  }

  /**
   * What the apply writes and how it is validated. It is rebuilt from the record and the artifact, so after a restart it is exactly the same as the first time. A transcription is a `speech` document on the asset (the asset's current content
   * must still be the input of this transcription). A generation is one transaction that imports all outputs as candidate assets (the video only needs to be open).
   */
  #targetFor(entry: Entry, item: StoredApplication, asr?: AsrResult): ApplicationTarget {
    const record = entry.record;
    const app = item.record;
    const videoId = app.videoId;
    if (record.kind === 'transcribe') {
      const assetId = record.assetId!;
      const artifactId = app.artifactIds[0]!;
      return {
        label: J.transcribeLabel().text,
        check: () => {
          const current = this.#videos.current(videoId, assetId);
          if (!current) throw new StaleInput(J.videoClosed());
          if (!current.asset) throw new StaleInput(J.assetGone());
          if (current.asset.contentHash !== record.contentHash) throw new StaleInput(J.assetChangedDuringTranscribe());
          return current.videoRevision;
        },
        operations: async () => {
          const result = asr ?? (await this.#readAsrResult(artifactId));
          const replace = record.transcribe?.replace;
          const document = this.#videos.state?.(videoId)?.documents[replace?.documentId ?? ''];
          const operation = speechDocumentOperation(result, {
            assetId,
            jobId: record.jobId,
            providerId: record.providerId,
            inputHash: record.inputHash,
            rawResultArtifactId: artifactId,
            createdAt: app.createdAt,
            // Replacing the transcript: the new word IDs differ from those of the old transcript (they start with the new version number). Otherwise, line breaks and paragraph entries that were not re-anchored would not take effect.
            ...(replace && document ? { wordIdPrefix: `w-${nextRevision(document)}-` } : {}),
          });
          if (!replace) return [withAsrStage(operation)];
          const { operations } = await planTranscriptSwitch(this.#videos, { videoId, replace, speech: operation, jobId: record.jobId });
          return operations;
        },
      };
    }
    const spec = entry.spec as GenerationInputSpec;
    return {
      label: (spec.capability === 'synthesizeSpeech' ? J.voiceOverLabel() : spec.capability === 'generateMusic' ? J.musicLabel() : J.imageLabel()).text,
      check: () => {
        const revision = this.#videos.videoRevision(videoId);
        if (revision === null) throw new StaleInput(J.videoClosed());
        return revision;
      },
      operations: async () =>
        Promise.all(
          app.artifactIds.map(async (artifactId, index) => {
            const file = await this.#artifacts.locate(artifactId);
            if (!file) throw new StaleInput(J.generatedGone());
            return generatedImportOperation(
              record,
              { artifactId, file, index, total: app.artifactIds.length },
              { name: spec.name, ref: app.targetRefs[index]! },
            );
          }),
        ),
    };
  }

  async #readAsrResult(artifactId: string): Promise<AsrResult> {
    const bytes = await this.#artifacts.read(artifactId);
    if (!bytes) throw new StaleInput(J.asrGone());
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new StaleInput(J.asrNotJson());
    }
    const validation = validateAsrResult(parsed);
    if (!validation.ok) throw new StaleInput(J.asrInvalid());
    return validation.result;
  }

  /**
   * The job state after the apply ends. Committed means `completed` (the result is filled in with the document and asset IDs). `stale-input` is `STALE_JOB_INPUT`,
   * and `rejected` is `APPLY_FAILED` (both `failed`, result kept). `cancelled` is job `cancelled`, with the result kept as a candidate.
   * Jobs that have already ended (completed after a restart, or `jobs.reconcile apply`) are changed in place.
   */
  async #concludeApplication(entry: Entry, app: ApplicationRecord): Promise<void> {
    const record = entry.record;
    this.#project(entry);
    const result = withApplied(record, app);
    const artifacts = record.kind === 'transcribe' ? { artifactId: app.artifactIds[0] } : { artifactIds: app.artifactIds };
    const generated = record.kind !== 'transcribe';
    let state: JobState;
    let error: JobError | null = null;
    let cancellation: JobCancellation | undefined;
    switch (app.state) {
      case 'committed':
        state = 'completed';
        break;
      case 'cancelled': {
        state = 'cancelled';
        const requestedAt = entry.cancelRequestedAt ?? app.updatedAt;
        cancellation = cancellationFacts(record, 'after-result', requestedAt);
        break;
      }
      case 'stale-input':
        state = 'failed';
        {
          const reason = app.error ? asLocalized(app.error.message, app.error.messageRef) : J.targetGone();
          error = jobError('STALE_JOB_INPUT', generated ? J.staleGeneratedKept({ reason }) : reason, {
            ...artifacts,
            applicationId: app.applicationId,
          });
        }
        break;
      default: {
        state = 'failed';
        if (app.error?.code === 'TRANSCRIPT_EDITED') {
          // If, while replacing the transcript, the document was edited after submission (§6.6), this error code is reported as is, and the `transcribe` step of the transcription flow fails on it.
          error = jobError('TRANSCRIPT_EDITED', asLocalized(app.error.message, app.error.messageRef), {
            ...(app.error.details as Record<string, unknown> | undefined),
            ...artifacts,
            applicationId: app.applicationId,
          });
          break;
        }
        if (app.error?.code === 'TASK_PROTECTED') {
          // The job's protected range (§3.2) was touched: the result is kept as a candidate, and the user decides whether to apply it (`jobs.reconcile apply` is not restricted by job protection).
          const { protections } = app.error.details as { protections?: unknown };
          error = jobError('APPLY_FAILED', J.protectedKept({ generated }), {
            ...artifacts,
            applicationId: app.applicationId,
            reason: 'TASK_PROTECTED',
            protections,
          });
          break;
        }
        const cause = (app.error?.details as { cause?: unknown } | undefined)?.cause ?? app.error?.message;
        error = jobError(app.error?.code === 'INTERNAL' ? 'INTERNAL' : 'APPLY_FAILED', J.applyFailedKept({ generated }), {
          ...artifacts,
          applicationId: app.applicationId,
          reason: app.error?.code,
          ...(cause !== undefined ? { cause } : {}),
        });
      }
    }
    if (!isTerminal(record.state)) {
      return this.#finish(entry, state, { result, ...(error ? { error } : {}), ...(cancellation ? { cancellation } : {}) });
    }
    // A job that has already ended: changed in place, and the budget is not settled again (it was settled at publish).
    Object.assign(record, { state, error, result, endedAt: nowIso() } satisfies Partial<JobRecord>);
    if (cancellation) record.cancellation = cancellation;
    else if (state === 'completed') delete record.cancellation;
    if (entry.leased) {
      entry.leased = false;
      this.#videos.release(app.videoId);
    }
    this.#changed(entry, false);
    await this.#save();
  }

  /**
   * Execution was stopped: a cancel records three facts (§7.4). When the Runtime stops, the outcome of an outbound call is unknown (dropping the request does not mean the provider stopped),
   * so it is marked `needs-reconciliation`; others are marked `interrupted`. `confirmed`: the executor has confirmed that it stopped.
   */
  #stopped(entry: Entry, confirmed = false): Promise<void> {
    const record = entry.record;
    if (entry.cancelRequested) {
      const cancellation = cancellationFacts(record, 'running', entry.cancelRequestedAt ?? nowIso(), { confirmed });
      return this.#finish(entry, 'cancelled', { cancellation });
    }
    // Outbound calls with unknown outcome wait for the user to reconcile. Those the user cannot retry (steps of fixed pipelines, transcription without a video) are only interrupted, as with open().
    if (retryable(entry) && isExternalProvider(record.providerId)) {
      return this.#finish(entry, 'needs-reconciliation', { error: reconciliationError() });
    }
    return this.#finish(entry, 'interrupted', { error: stoppedError() });
  }

  #sink(entry: Entry): TranscribeSink {
    const record = entry.record;
    const attempt = record.attempt;
    const update = (patch: Partial<JobRecord>) => {
      if (record.state !== 'running') return;
      Object.assign(record, patch);
      this.#changed(entry, false);
    };
    return {
      loading: () => update({ phase: 'loading' }),
      // Progress belongs to the stage it is in: cleared when the stage changes, so a new stage does not carry the previous stage's numbers.
      phase: (phase) => update(phase === record.phase ? { phase } : { phase, progress: null }),
      progress: (p) => update({ phase: p.phase, progress: { done: p.done, total: p.total, unit: p.unit } }),
      segment: (segment) => {
        // Only collects the segments of this attempt while it is still running. Times are converted from ticks (the asset clock, with the `range` offset already included) to seconds.
        if (record.state !== 'running' || record.attempt !== attempt) return;
        const live = liveSegment(segment, entry.input.timescale);
        if (!live) return;
        const from = entry.liveSegments.length;
        entry.liveSegments.push(live);
        const notice = { jobId: record.jobId, from, segments: [{ ...live }] };
        for (const listener of this.#segmentListeners) {
          try {
            listener(notice);
          } catch (error) {
            this.#log.error('Task segment listener failed', { error: String(error) });
          }
        }
      },
      warning: (warning) => {
        if (record.state !== 'running') return;
        update({ warnings: [...record.warnings, warning] });
        if (entry.target.kind === 'file') entry.target.observer.warning?.(warning);
      },
      language: (tag, confidence) => {
        if (record.state === 'running' && entry.target.kind === 'file') entry.target.observer.language?.(tag, confidence);
      },
    };
  }

  /** Validate → publish → apply (§7.3). `runGeneration`: the result's `provenance.runGeneration` should equal this value (see `TranscribeAttempt`). */
  async #complete(entry: Entry, output: JobOutput, staging: string, runGeneration: number): Promise<void> {
    const record = entry.record;
    this.#phase(entry, 'validating');
    const file = path.resolve(staging, output.path);
    const invalid = (problems: string[]) => this.#rejectOutput(entry, file, problems);
    const relative = path.relative(staging, file);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return invalid([J.asrFileNotInStaging().text]);
    const bytes = await fs.readFile(file).catch(() => null);
    if (!bytes) return invalid([J.asrFileMissing().text]);
    if (bytes.length !== output.byteLength) return invalid([J.asrLengthMismatch({ actual: bytes.length, declared: output.byteLength }).text]);
    if (sha256Hex(bytes) !== output.sha256.replace(/^sha256:/, '')) return invalid([J.asrShaMismatch().text]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
      return invalid([J.notJson().text]);
    }
    const language = (entry.spec as TranscribeInputSpec).language;
    const validation = validateAsrResult(parsed, {
      runGeneration,
      ...(language.mode === 'assert' ? { assertedLanguage: language.tag } : {}),
    });
    if (!validation.ok) return invalid(validation.problems);
    const result = validation.result;
    if (entry.target.kind === 'file') return this.#deliver(entry, entry.target, file, bytes, result);

    this.#phase(entry, 'publishing');
    const artifactId = artifactIdOf(bytes);
    const warnings: JobWarning[] = [...submitWarnings(record.warnings), ...result.warnings];
    if (result.outcome !== 'transcribed') warnings.push({ code: result.outcome });
    record.warnings = warnings;
    // Transcription without a video (§7.9) only publishes the raw result.
    const onlyPublish = result.outcome !== 'transcribed' || record.videoId === null;
    const targetRefs = onlyPublish ? null : [record.assetId!];
    await this.#publish(entry, { artifactIds: [artifactId], result: { documentId: null, artifactId }, targetRefs, warnings }, async () => {
      await this.#artifacts.put(bytes);
    });

    if (onlyPublish) {
      return this.#finish(entry, 'completed', { result: { documentId: null, artifactId } });
    }
    return this.#applyPublished(
      entry,
      { documentId: null, artifactId },
      { artifactIds: [artifactId], targetRefs: [record.assetId!] },
      result,
    );
  }

  /** File target: the validated result is moved to the location the caller specifies, and then it ends. No artifact is published and no video is written. */
  async #deliver(
    entry: Entry,
    target: Extract<JobTarget, { kind: 'file' }>,
    file: string,
    bytes: Buffer,
    result: AsrResult,
  ): Promise<void> {
    const record = entry.record;
    const warnings: JobWarning[] = [...submitWarnings(record.warnings), ...result.warnings];
    if (result.outcome !== 'transcribed') warnings.push({ code: result.outcome });
    record.warnings = warnings;
    await fs.mkdir(path.dirname(target.resultFile), { recursive: true });
    await fs.rename(file, target.resultFile).catch(() => fs.writeFile(target.resultFile, bytes));
    target.observer.output?.({ file: target.resultFile, sha256: sha256Hex(bytes), byteLength: bytes.length });
    return this.#finish(entry, 'completed', {});
  }

  /**
   * The output does not match the contract: not retried; the raw file is moved to the diagnostics directory (§6.5). The raw result of a remote job contains someone else's transcript text, which the node does not keep (§6.7);
   * only the job record and the list of problems are kept.
   */
  async #rejectOutput(entry: Entry, file: string, problems: string[]): Promise<void> {
    const record = entry.record;
    const dir = path.join(this.#options.paths.diagnosticsDir, record.jobId);
    await fs.mkdir(dir, { recursive: true });
    if (entry.target.kind === 'video') {
      const kept = path.join(dir, 'result.json');
      await fs.rename(file, kept).catch(() => fs.copyFile(file, kept).catch(() => {}));
    }
    await fs.writeFile(path.join(dir, 'job.json'), `${JSON.stringify({ record, problems }, null, 2)}\n`).catch(() => {});
    this.#log.warn('Model output does not match the contract', { jobId: record.jobId, problems: problems.slice(0, 5) });
    return this.#finish(entry, 'failed', {
      error: jobError('MODEL_OUTPUT_INVALID', J.asrContractInvalid(), { problems }),
    });
  }

  async #finish(
    entry: Entry,
    state: JobState,
    patch: { error?: JobError; result?: JobRecord['result']; cancellation?: JobCancellation },
  ): Promise<void> {
    const record = entry.record;
    if (isTerminal(record.state) && record.state !== 'interrupted') return;
    const now = nowIso();
    Object.assign(record, {
      state,
      phase: 'done',
      endedAt: now,
      error: patch.error ?? null,
      result: patch.result ?? null,
    } satisfies Partial<JobRecord>);
    if (patch.cancellation) record.cancellation = patch.cancellation;
    entry.controller = null;
    // Withdraw the admission requests still in the queue.
    entry.ticket?.withdraw();
    entry.ticket = null;
    delete record.wait;
    delete entry.publishing;
    await fs.rm(this.#stagingOf(record.jobId), { recursive: true, force: true }).catch(() => {});
    if (entry.leased) {
      entry.leased = false;
      if (record.videoId) this.#videos.release(record.videoId);
    }
    if (record.library) void this.#options.library?.unpin(record.jobId).catch(() => {});
    if (record.grant && !record.grant.settled && this.#options.admission) {
      record.grant = this.#options.admission.settle(record.grant, { state });
    }
    this.#log.info('Task ended', { jobId: record.jobId, state, code: patch.error?.code });
    this.#changed(entry, false);
    this.#prune();
    // Persist the terminal state before counting the job as finished: after `settled`, reading the ledger always sees it.
    await this.#save();
    entry.settle(state);
  }

  // ---- Outbound authorization and budget (§12.5, §7.8) ----

  /** Admission before a record is created: judge and reserve (synchronous). Local and node jobs do not go through it. */
  #admit(
    jobId: Id,
    capability: ModelServiceCapability,
    selection: { providerId: string; modelId: string; kind: ProviderKind; label: string; model: ModelInfoBase },
    videoId: Id | null,
    submitter: JobSubmitter,
    hint: JobGrantHint | undefined,
    quantity: { count?: number; chars?: number },
  ): JobRecord['grant'] | null {
    const admission = this.#options.admission;
    if (!admission || selection.kind === 'local' || selection.kind === 'node') return null;
    return admission.admit({
      jobId,
      capability,
      providerId: selection.providerId,
      providerKind: selection.kind,
      label: selection.label,
      model: selection.model,
      modelId: selection.modelId,
      videoId,
      submitter,
      ...(hint ? { hint } : {}),
      quantity,
    });
  }

  /**
   * Before starting execution: released only after “started” is persisted (§7.8). If the authorization is revoked or tightened, the job ends with `GRANT_REVOKED` (the reservation is released at the end).
   * If it crashes between persisting and recording `running`, after a restart it is treated as “queued but started” (see `open()`), and it is not resent.
   */
  async #grantStart(entry: Entry): Promise<JobError | null> {
    const use = entry.record.grant;
    if (!use || use.settled || !this.#options.admission) return null;
    return this.#options.admission.start(use);
  }

  /** An automatic retry is also a call: it settles the previous one and reserves again. If the quota is insufficient, it ends with its error. */
  #grantRetry(entry: Entry): JobError | null {
    const use = entry.record.grant;
    if (!use || !this.#options.admission) return null;
    const next = this.#options.admission.retry(use, {
      providerId: entry.record.providerId,
      videoId: entry.record.videoId,
      submitter: entry.record.submitter,
    });
    if (isJobError(next)) return next;
    entry.record.grant = next;
    return null;
  }

  #phase(entry: Entry, phase: JobPhase): void {
    entry.record.phase = phase;
    this.#changed(entry, false);
  }

  /** Changing the record and emitting events happen in the same synchronous section (the topic's snapshot and events share one watermark). */
  #changed(entry: Entry, persist: boolean): void {
    // Live segments belong only to a running attempt: when the job leaves `running` (terminal, interrupted, awaiting reconciliation, interrupted before a retry), they are dropped, at the same watermark as the emitted `job.updated`.
    if (entry.record.state !== 'running' && entry.liveSegments.length > 0) entry.liveSegments = [];
    entry.record.updatedAt = nowIso();
    const copy = structuredClone(entry.record);
    for (const listener of this.#listeners) {
      try {
        listener(copy);
      } catch (error) {
        this.#log.error('Task event listener failed', { error: String(error) });
      }
    }
    if (persist) void this.#save();
  }

  #save(): Promise<void> {
    if (this.#crashed) return Promise.resolve();
    const jobs = [...this.#entries.values()].map(({ record, spec, workerVersion, videoPlace, remoteTaskId, publishing }) => ({
      record,
      spec,
      workerVersion,
      ...(videoPlace ? { videoPlace } : {}),
      ...(remoteTaskId ? { remoteTaskId } : {}),
      ...(publishing ? { publishing } : {}),
    }));
    return this.#ledger.save(jobs).catch((error: unknown) => this.#log.error('Writing the task ledger failed', { error: String(error) }));
  }

  /**
   * The ledger cap (§7.5): only finished top-level jobs are counted, and they are evicted from oldest to newest by finish time. Subjobs are deleted together with their parent; the subjobs of an unfinished parent are left alone. The newest `maxRetainedRetryablePipelines` retryable pipelines (failed, cancelled, interrupted) are not evicted and do not take up a slot.
   * Jobs awaiting reconciliation (`needs-reconciliation`) are not evicted: they stay until the user decides. The apply of an evicted job is deleted as well.
   */
  #prune(): void {
    const top = (e: Entry) => e.record.parentJobId == null || !this.#entries.has(e.record.parentJobId);
    const endedAt = (e: Entry) => e.record.endedAt ?? e.record.createdAt;
    const terminal = [...this.#entries.values()]
      .filter((e) => top(e) && isTerminal(e.record.state) && e.record.state !== 'needs-reconciliation')
      .sort((a, b) => (endedAt(a) < endedAt(b) ? -1 : endedAt(a) > endedAt(b) ? 1 : 0));
    const retryable = terminal.filter((e) => e.record.kind === 'pipeline' && e.record.state !== 'completed');
    const kept = new Set(retryable.slice(Math.max(0, retryable.length - this.#maxRetainedRetryable)));
    const pool = terminal.filter((e) => !kept.has(e));
    const evicted = new Set(pool.slice(0, Math.max(0, pool.length - this.#maxRetained)).map((e) => e.record.jobId));
    if (evicted.size === 0) return;
    for (const [jobId, entry] of this.#entries) {
      if (evicted.has(jobId) || (entry.record.parentJobId != null && evicted.has(entry.record.parentJobId))) this.#entries.delete(jobId);
    }
    if (!this.#crashed) {
      void this.#applications.remove(evicted).catch((error: unknown) => this.#log.error('Writing the application ledger failed', { error: String(error) }));
    }
    for (const listener of this.#pruneListeners) {
      try {
        listener(evicted);
      } catch (error) {
        this.#log.warn('A prune listener failed', { error: String(error) });
      }
    }
  }

  #byCommand(commandId: Id): Id | null {
    for (const entry of this.#entries.values()) if (entry.commandId === commandId) return entry.record.jobId;
    return null;
  }

  #stagingOf(jobId: Id): string {
    return path.join(this.#options.paths.stagingDir, 'jobs', jobId);
  }

  #entry(stored: StoredJob, input: Entry['input'], commandId: Id | null, target: JobTarget, executor: Entry['executor']): Entry {
    let settle!: (state: JobState) => void;
    const settled = new Promise<JobState>((resolve) => {
      settle = resolve;
    });
    if (isTerminal(stored.record.state)) settle(stored.record.state);
    return {
      ...stored,
      input,
      target,
      commandId,
      executor,
      controller: null,
      ticket: null,
      cancelRequested: false,
      cancelRequestedAt: null,
      leased: false,
      hosted: null,
      settled,
      settle,
      liveSegments: [],
    };
  }
}

/** One notification from `JobManager.onSegments`: `from` is the index of `segments[0]` among all the live segments of this job. */
export interface LiveSegmentsUpdate {
  jobId: Id;
  from: number;
  segments: JobLiveSegment[];
}

/** Converts a Worker segment (tick) into a live segment (seconds). Blank text, non-finite or inverted times are dropped; segments whose start and end are the same (`segment-degenerate`) are kept. */
function liveSegment(segment: { start: number; end: number; text: string }, timescale: number): JobLiveSegment | null {
  const text = typeof segment.text === 'string' ? segment.text.trim() : '';
  if (!text || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)) return null;
  if (segment.start < 0 || segment.end < segment.start || !(timescale > 0)) return null;
  return { start: segment.start / timescale, end: segment.end / timescale, text };
}

/** Job error for a job whose demand exceeds the machine's capacity (command and protocol spec §11.3). */
function exceededError(error: ResourceExceedsCapacity): JobError {
  return jobError(error.code, errorText(error), { dimensions: error.dimensions });
}

function isTranscribeSpec(spec: StoredJob['spec']): spec is TranscribeInputSpec {
  return !('capability' in spec) && !('task' in spec) && !('hosted' in spec);
}

function isTaskSpec(spec: StoredJob['spec']): spec is TaskInputSpec {
  return 'task' in spec;
}

function isHostedSpec(spec: StoredJob['spec']): spec is HostedJobSpec {
  return 'hosted' in spec;
}

/** Provider failure → job error (§11.3). Automatic crash retries are handled by the transcription path itself. */
function failureError(failure: ProviderFailure, providerId: string): JobError {
  const { details } = failure;
  const message = errorText(failure);
  switch (failure.kind) {
    case 'crashed':
    case 'version-changed':
      return jobError('MODEL_WORKER_CRASHED', message, details);
    case 'load-failed':
    case 'unavailable':
      return jobError('MODEL_LOAD_FAILED', message, details);
    case 'output-unwritable':
      return jobError('STAGING_WRITE_FAILED', message, details);
    case 'input-unreadable':
      // A file shipped with the app (the recordings of built-in voices) that cannot be read means the installation is incomplete: `details.code` is `APP_FILE_MISSING`.
      return jobError(details.code === 'APP_FILE_MISSING' ? 'APP_FILE_MISSING' : 'ASSET_MISSING', message, details);
    case 'protocol':
      return jobError('MODEL_OUTPUT_INVALID', message, details);
    case 'node-rejected':
      return jobError('REMOTE_NODE_REJECTED', message, details);
    case 'node-lost':
      return jobError('REMOTE_NODE_LOST', message, details);
    case 'remote-failed': {
      // A job failure on a node: the error code and description are kept as is, and the node is added to the details.
      const { code, node, details: remote } = details;
      const extra = remote && typeof remote === 'object' && !Array.isArray(remote) ? (remote as Record<string, unknown>) : {};
      return jobError(typeof code === 'string' ? code : 'INTERNAL', message, { ...extra, node });
    }
    case 'rejected': {
      const { code, ...rest } = details;
      const errorCode = typeof code === 'string' && PROVIDER_REJECTION_CODES.has(code) ? code : 'PROVIDER_REJECTED';
      return jobError(errorCode, message, { ...rest, providerId });
    }
    case 'unavailable-remote':
      return jobError('PROVIDER_UNAVAILABLE', message, { ...details, providerId });
  }
}

function stoppedError(): JobError {
  return jobError('JOB_INTERRUPTED', J.interrupted());
}

function reconciliationError(): JobError {
  return jobError('JOB_NEEDS_RECONCILIATION', J.needsReconciliation());
}

/** The input, executor and new reservation prepared before re-execution. */
interface Prepared {
  input: Entry['input'];
  executor: NonNullable<Entry['executor']>;
  grant: JobGrantUse | null;
}

/**
 * Failure of validation, admission or opening the video → job error: `details.code` of the `RpcError` (`GRANT_REQUIRED`, `CAPABILITY_NOT_CONFIGURED`, …) takes priority; otherwise `fallback` is used (`fallback` is always used when `force` is set).
 */
function rpcJobError(error: unknown, message: JobText, fallback: string, force = false): JobError {
  const cause = error instanceof Error ? error.message : String(error);
  if (error instanceof RpcError) {
    const details = error.details as { code?: unknown } | undefined;
    const code = !force && typeof details?.code === 'string' ? details.code : fallback;
    return jobError(code, withCause(message, error), { ...(details ?? {}), cause });
  }
  return jobError(force ? fallback : 'INTERNAL', message, { cause });
}

/** The result after the apply is submitted: transcription adds the `speech` document; generation adds the assets imported for each output. */
function withApplied(record: JobRecord, app: ApplicationRecord): JobRecord['result'] {
  const result = record.result;
  if (!result || app.state !== 'committed' || !app.receipt) return result;
  const refs = app.receipt.refs;
  if (record.kind === 'transcribe') return { ...result, documentId: refs.speech ?? null };
  return {
    ...result,
    ...(result.outputs ? { outputs: result.outputs.map((o, i) => ({ ...o, assetId: refs[app.targetRefs[i]!] ?? null })) } : {}),
  };
}

/** A transcript replacement request: the document exists and is the transcript of this asset, and the fingerprint and version are strings. `invalid-request` if these do not hold. */
function checkReplace(replace: TranscriptReplace, assetId: Id, state: { documents: Record<Id, DocumentRecord> } | null): TranscriptReplace {
  const record = state?.documents[replace.documentId];
  if (!state || !record || record.kind !== 'speech' || record.sourceAssetId !== assetId) {
    throw new RpcError('invalid-request', JobsTranscribe.replaceDocumentGone(), { documentId: replace.documentId });
  }
  if (typeof replace.fingerprint !== 'string' || !replace.fingerprint || typeof replace.revision !== 'string') {
    throw new RpcError('invalid-request', JobsTranscribe.transcriptUnreadable());
  }
  return {
    documentId: replace.documentId,
    revision: replace.revision,
    fingerprint: replace.fingerprint,
    translations: replace.translations === 'discard' ? 'discard' : 'carry',
  };
}

/**
 * The body of a new transcript records `stages.asr` (video format spec §5.5: a content fingerprint of the full text when transcription completes), which is later used to tell whether anyone has edited the original. If the WASM for sentences and fingerprints has not been built, it is not recorded (as with earlier transcriptions, it is treated as unedited).
 */
function withAsrStage(operation: EditOperation): EditOperation {
  if (operation.type !== 'putDocument' || !operation.body || typeof operation.body !== 'object') return operation;
  try {
    const body = operation.body as Record<string, unknown>;
    return { ...operation, body: { ...body, stages: { asr: contentFingerprint(body) } } };
  } catch (error) {
    if (error instanceof EditorWasmError) return operation;
    throw error;
  }
}

function normalizeLanguage(language: TranscribeRequest['language']): TranscribeInputSpec['language'] {
  if (!language) return { mode: 'prefer', tag: null };
  if (language.tag === null) return { mode: 'prefer', tag: null };
  const tag = canonicalLanguageTag(language.tag);
  if (!tag) throw new RpcError('invalid-request', J.invalidLanguageTag({ tag: language.tag }));
  return language.mode === 'assert' ? { mode: 'assert', tag } : { mode: 'prefer', tag };
}

/**
 * When a model does not accept a recognition prompt (such as MOSS), the submission is not rejected: the prompt is not passed to the model (and not included in the input digest), and a `hint-ignored` notice is recorded on the job.
 */
function hintFor(selection: TranscribeSelection, hint: string | null): { hint: string | null; warnings: JobWarning[] } {
  if (!hint || selection.model.acceptsHint) return { hint, warnings: [] };
  return { hint: null, warnings: [jobWarning('hint-ignored', J.hintIgnored({ model: selection.model.label }))] };
}

/** Notices recorded at submission. When the result's notices replace those received during execution, these are kept. */
function submitWarnings(warnings: readonly JobWarning[]): JobWarning[] {
  return warnings.filter((w) => w.code === 'hint-ignored');
}

/** Computes a file's sha256 (lowercase hex) by streaming. `invalid-request` if it cannot be read. */
async function fileSha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  try {
    for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  } catch {
    throw new RpcError('invalid-request', J.cannotReadInput());
  }
  return hash.digest('hex');
}
