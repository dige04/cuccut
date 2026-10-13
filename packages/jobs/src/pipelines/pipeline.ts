import type { FrozenLibraryEntry, Id, JobCallCounts, JobPhase, JobProgress, JobRecord, JobSubmitter, JobWarning } from '@cuccut/protocol';
import type { ArtifactStore } from '../artifact-store.ts';
import { LocalizedError, type JobText, type LazyText } from '../job-text.ts';
import type { TaskResources } from '../job-manager.ts';
import type { PipelineTargetSupport, VideoLease } from './video-target.ts';

/**
 * Definition of a fixed pipeline (architecture design §7.9): the steps are fixed, and the parameters are validated and frozen at start. `PipelineRunner` records one execution as a parent task (`kind: 'pipeline'`) and each step as one of its subtasks (`kind: 'pipeline-step'`). Between steps, results pass only through outputs (`output`): artifact IDs, files in staging or the output directory, and document references written into the video. Outputs are recorded on the parent task and persisted, and are reused on retry.
 */

/** One step's output. It can be serialized as JSON (recorded in the task ledger). */
export type StepOutput = Record<string, unknown>;

/** The outputs of the earlier steps (by step name; null for skipped steps). */
export type StepOutputs = Readonly<Record<string, StepOutput | null>>;

/** The output when a step completes, and the result handed to the subtask (same shape as `JobRecord.result`; not given when there is no artifact). */
export interface StepResult {
  output: StepOutput;
  result?: NonNullable<JobRecord['result']>;
}

/** Reports progress and stage. */
export type ProgressReporter = (progress: JobProgress | null, phase?: JobPhase) => void;

export interface PipelineStepContext<P> {
  /** The frozen parameters. */
  readonly params: P;
  readonly parentJobId: Id;
  /** This step's subtask. */
  readonly jobId: Id;
  /** Which execution of this step this is (counting from 1). */
  readonly attempt: number;
  /**
   * This execution (architecture design §7.4): `runId` is the parent task, and `runGeneration` is the parent task's `attempt`. When video is written, it is passed to the engine with `apply`: after the pipeline is cancelled, the engine rejects commits from this generation (the stop barrier).
   */
  readonly run: { runId: Id; runGeneration: string };
  /** Aborted on cancellation or when the Runtime stops. A step that receives the abort should end with an exception as soon as possible, leaving no half-finished output. */
  readonly signal: AbortSignal;
  readonly outputs: StepOutputs;
  /** The staging directory dedicated to this execution (`<staging>/pipelines/<parent task>`, already created): kept for retry on failure and interruption, deleted on completion and cancellation. */
  readonly staging: string;
  readonly artifacts: ArtifactStore;
  /** Subtasks are written as usual; the parent task's stage and call count are updated along with them. */
  progress: ProgressReporter;
  /** The `detail` of a warning is produced with `jobWarning(code, J.x(...))`; its reference is recorded along with it. */
  warn(warning: JobWarning): void;
  /**
   * Opens one more subtask under this step (one step producing several sub-jobs, for example synthesizing speech segment by segment). Its record has the same shape as this step's subtask (the same `parentJobId` and `step`), and it is finished when `fn` ends. `signal` is aborted when the parent task is cancelled.
   */
  spawn<T>(label: JobText, fn: (job: { jobId: Id; progress: ProgressReporter }) => Promise<T>): Promise<T>;
  /**
   * The video newly created in this step is handed to the pipeline to hold (for steps that use `holdsVideo`). The lease is held until the pipeline ends, is cancelled or fails, and then it is released. The parent task and the later subtasks record this video.
   */
  hold(lease: VideoLease): void;
}

export interface PipelineStep<P> {
  name: string;
  /** The step name shown to people: a catalog entry (`() => J.stepX()`, generated in the current language when it is used) or a string. */
  label: LazyText;
  /** An optional step: when it returns false, it is recorded as `skipped` and no subtask is opened. */
  when?: (params: P, outputs: StepOutputs) => boolean;
  run(context: PipelineStepContext<P>): Promise<StepResult>;
  /**
   * This step's peak demand (architecture design §7.7; estimated in `resource-profiles.ts`). When given, it goes through resource-scheduling admission before it runs; the subtask records what it is waiting for.
   * It is released after this step ends (including on cancellation and failure). When not given, the step runs directly (for steps that only call online services or write small files).
   */
  resources?: (params: P, outputs: StepOutputs) => TaskResources;
  /** Whether the outputs completed earlier are still usable on retry (for example, the file in staging still exists); when they are not, the step reruns from this point. When not given, they are always usable. */
  reusable?: (output: StepOutput, context: { params: P; staging: string; artifacts: ArtifactStore }) => Promise<boolean>;
  /**
   * This step's output `{ videoId, place }` is a video that the pipeline holds a lease on (target resolution, video creation). On retry, the lease is first re-acquired by `place`, and then the pre-start checks run. If the video that is open is no longer that video, the retry is refused (`STALE_JOB_INPUT`).
   */
  holdsVideo?: boolean;
}

/** The result of the checks at start (and at retry): the frozen parameters and the executor recorded on the record. */
export interface PipelinePlan<P> {
  /** The frozen parameters (for example, with the chosen Provider and model filled in, used by every later call). */
  params: P;
  /** The executor recorded on the record: for model pipelines, the chosen Provider and model; for file transcoding, `ffmpeg`. */
  providerId: string;
  modelId: string;
  /** The video to write (its lease is held for the duration of the task); null when the pipeline does not touch a video. */
  videoId: Id | null;
  /** The content digest of the input, `sha256:<hex>`. */
  contentHash: string;
  /**
   * The user library entries used and their frozen versions (for example, the glossary used for translation). They are pinned at start with the parent task as holder and released when the pipeline ends (architecture design §5.9). They are recorded on the parent task's `library`. On retry, they are pinned again where possible (the earlier pins are gone after a Runtime restart).
   */
  library?: FrozenLibraryEntry[];
}

export interface PipelinePrepareOptions {
  retry: boolean;
  /** The party that started the pipeline (on retry, the one the parent task recorded). Authorization and the task budget are judged by the task it belongs to. Clients of the external service cannot use the user library (§5.9). */
  submitter?: JobSubmitter;
}

/** `P` is the frozen parameters (execution and retry read only these); `R` is validated parameters that are not yet frozen (when frozen, defaults and the chosen executor are filled in). */
export interface PipelineDefinition<P, R = P> {
  name: string;
  /** The pipeline name and description shown to people: a catalog entry (generated in the current language when it is used) or a string. */
  label: LazyText;
  description: LazyText;
  /** The JSON Schema of the parameters (`pipelines.list` returns it as it is). */
  paramsSchema: Record<string, unknown>;
  /** Validates the parameters: throws `RpcError('invalid-request')` when they are not valid. */
  parse(raw: Record<string, unknown>): R;
  /**
   * Accepts a video target (`target`, §7.9). `PipelineRunner` first reads `target` and `videoId`. An `entryId` is resolved to a video and opened with a lease, and what is handed to `parse` is the `videoId` (when a video is being created, `target` is passed as it is). The first step must be `targetStep()`.
   */
  target?: PipelineTargetSupport;
  /**
   * Pre-start checks (the video is open, the capabilities are configured, and so on) and freezing of the parameters; throws `RpcError` when they fail. On retry, the checks run again with the frozen parameters (`retry: true`).
   * `submitter` is the party that started it (on retry, the original submitter). Authorization and the task budget are judged by the task it belongs to.
   */
  prepare(params: R | P, options: PipelinePrepareOptions): Promise<PipelinePlan<P>>;
  steps: Array<PipelineStep<P>>;
  /** After all steps complete: the parent task's result and summary. */
  complete(context: { params: P; outputs: StepOutputs; artifacts: ArtifactStore }): Promise<{
    summary: Record<string, unknown>;
    result: NonNullable<JobRecord['result']>;
  }>;
}

/** A step failed with a definite error code (command and protocol spec §11.3). */
export class PipelineStepError extends LocalizedError {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  /** When `message` is catalog text (`Localized`), its reference is recorded in the task along with the error. */
  constructor(code: string, message: JobText, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PipelineStepError';
    this.code = code;
    this.details = details;
  }
}

/** A step that calls the model in batches counts its own calls, retries and failures. */
export class CallCounter implements JobCallCounts {
  calls = 0;
  retries = 0;
  failures = 0;

  snapshot(): JobCallCounts {
    return { calls: this.calls, retries: this.retries, failures: this.failures };
  }
}
