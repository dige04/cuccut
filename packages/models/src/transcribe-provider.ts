import type { AsrWarning, JobInput, JobOutput, Segment, TranscribeJobPhase, TranscribeOptions } from './worker-contract.ts';
import type { MessageRef } from '@cuccut/protocol';
import { modelTextRef, type ModelText } from './model-text.ts';

/**
 * Provider interface for speech recognition (architecture design §6.1, §6.6): one capability is not tied to a single source. The local Provider (Model Worker, implemented in
 * `@cuccut/jobs`), the remote node Provider (§6.7, implemented in `@cuccut/nodes`), and the online Provider (§6.4, implemented in `@cuccut/providers`)
 * implement the same interface, and all output the same `cuccut.asr-result/v1`, which JobManager validates, publishes, and applies uniformly.
 *
 * One `transcribe` call is one attempt: retry, validation, and publishing are not done in the Provider.
 */

export interface TranscribeRun {
  jobId: string;
  /** Which attempt this is; the Worker echoes it back unchanged into the result's `provenance.runGeneration`. */
  runGeneration: number;
  /** The selected Provider and model (§6.2). The online Provider uses this to decide whom to send to and which model to use. */
  providerId?: string;
  modelId?: string;
  /** Model packages for local and node use; null for the online Provider. */
  bundleId: string | null;
  input: JobInput;
  options: TranscribeOptions;
  /** The staging directory for this attempt (absolute path); the Provider may write its result only here. */
  staging: string;
  /** On retry, requires the same Worker version as the first attempt (architecture design §6.5). */
  expectedWorkerVersion?: string;
  /** Media type of the input (from the asset record); the remote node needs it, the local Worker does not. */
  mediaType?: string;
  /** Target node (`nodeId`) for the remote node Provider; when not given, uses `node:<nodeId>` from `providerId`. The local Provider has none. */
  node?: string;
}

/** Facts reported by the Provider. JobManager uses them to update the `jobs` topic. */
export interface TranscribeSink {
  /** Starting the Worker or loading the model. */
  loading(): void;
  phase(phase: TranscribeJobPhase): void;
  progress(progress: { phase: TranscribeJobPhase; done: number; total: number | null; unit: 'seconds' | 'segments' }): void;
  segment(segment: Segment): void;
  warning(warning: AsrWarning): void;
  language(tag: string, confidence: number | null): void;
}

export type TranscribeAttempt =
  | {
      outcome: 'completed';
      output: JobOutput;
      workerVersion: string;
      /**
       * The value that the result's `provenance.runGeneration` should equal. When not given, it is this attempt's number (the local Worker echoes it back unchanged); a result from a remote node
       * echoes back the node's own attempt number (2 after a Worker crash and retry on the node), which the Provider supplies from the task record reported by the node.
       */
      runGeneration?: number;
    }
  | {
      outcome: 'cancelled';
      workerVersion: string | null;
      /** Warnings about the cancellation itself, for example when a remote node has not confirmed that it stopped (`remote-cancel-unconfirmed`). */
      warnings?: Array<{ code: string; detail?: string }>;
    };

/**
 * Failure of one attempt, classified by how it is recovered:
 * - `load-failed`: the model package cannot be loaded (not installed, unsupported, insufficient resources, contract mismatch); not retried;
 * - `crashed`: the inference process crashed or inference failed; may be retried once per §6.5;
 * - `version-changed`: the Worker version changed on retry; not retried;
 * - `input-unreadable`: the input file cannot be read; not retried;
 * - `output-unwritable`: the Worker's output cannot be written to staging (disk full, permissions); unrelated to the model: not counted as a crash, does not disable the model package, not retried;
 * - `unavailable`: the Provider is unavailable right now (model package disabled, no Worker executable); not retried;
 * - `protocol`: the response violates the protocol (for example `completed` with no output); handled as output that breaks the contract; not retried;
 * - `node-rejected`: the remote node rejected the request (not paired, version, capability turned off, model not ready...); `details.reason` and `details.node`; not retried;
 * - `node-lost`: the remote node cannot be reached or was lost (`details.reason`: `unreachable`, `stream-lost`, `node-restarted`); not retried;
 * - `remote-failed`: the task failed on the remote node: `details.code` is the error code given by the node (as is), `details.details` is the node's details; not retried
 *   (the node has already retried the Worker crash itself per §6.5);
 * - `rejected`: the online Provider rejected the request (authentication, quota, parameters); `details.code` is `PROVIDER_AUTH_FAILED`,
 *   `PROVIDER_QUOTA_EXCEEDED`, or `PROVIDER_REJECTED`; not retried;
 * - `unavailable-remote`: the online Provider cannot be reached or keeps returning 5xx (the adapter has already retried with backoff itself); `PROVIDER_UNAVAILABLE`; JobManager does not retry again.
 *
 * The online Provider's `message` and `details` must not contain secrets (§6.4).
 */
export type ProviderFailureKind =
  | 'load-failed'
  | 'crashed'
  | 'version-changed'
  | 'input-unreadable'
  | 'output-unwritable'
  | 'unavailable'
  | 'protocol'
  | 'node-rejected'
  | 'node-lost'
  | 'remote-failed'
  | 'rejected'
  | 'unavailable-remote';

export class ProviderFailure extends Error {
  readonly kind: ProviderFailureKind;
  readonly details: Record<string, unknown>;
  /** Message reference, used when constructed from catalog text. */
  readonly messageRef: MessageRef | undefined;

  constructor(kind: ProviderFailureKind, message: ModelText, details: Record<string, unknown> = {}) {
    super(String(message));
    this.messageRef = modelTextRef(message);
    this.name = 'ProviderFailure';
    this.kind = kind;
    this.details = details;
  }
}

export interface TranscribeProvider {
  readonly id: string;
  /**
   * Runs one attempt. When `signal` aborts, the Provider stops as soon as it can and settles as `cancelled` (local Provider: `job.cancel`,
   * and ends the process if the deadline passes). If it is still starting or loading, it settles immediately, and loading continues in the background.
   */
  transcribe(run: TranscribeRun, sink: TranscribeSink, signal: AbortSignal): Promise<TranscribeAttempt>;
  /** The user re-enables a model package: clears the failures the Provider recorded itself (for example the crash count). */
  enable?(bundleId: string): void;
  /** Normal stop: closes the held processes or connections. */
  close(): Promise<void>;
}
