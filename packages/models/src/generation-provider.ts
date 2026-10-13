import type { GenerationParameters, JobWarning } from '@cuccut/protocol';
import type { TextResult } from './text-generation.ts';

/**
 * The Provider interface for generation capabilities (`synthesizeSpeech`, `generateImage`, `generateText`) (architecture design §6.1, §6.6). Input is frozen text and parameters. Output is files written into staging: media, or the full text from a text model. Validation (ffprobe decoding), publishing and importing into video all happen in JobManager, not in the Provider.
 *
 * One `generate` call is one attempt. Online Providers retry connection failures and 5xx responses themselves, with bounded retries per §6.4. JobManager does not retry again, and does not switch Provider, model or voice.
 */

export type GenerationCapability = GenerationParameters['capability'];

export interface GenerationRun {
  jobId: string;
  attempt: number;
  providerId: string;
  modelId: string;
  /** Parameters frozen at submission. */
  parameters: GenerationParameters;
  /** The staging directory for this attempt (absolute path). The Provider may only write its output here. */
  staging: string;
}

export interface GenerationSink {
  /** Entered the generation stage (the request has been sent). */
  generating(): void;
  /** For multiple outputs, how many have been obtained so far (`outputs`, the default). For local synthesis, reports the number of diffusion or decoding steps (`steps`). */
  progress(done: number, total: number, unit?: 'outputs' | 'steps'): void;
  /** Warnings that do not affect the output (pronunciation annotations that local synthesis cannot read), recorded in the job's `warnings`. */
  warning?(warning: JobWarning): void;
}

/** One output file in staging. `mediaType` is declared by the Provider according to the requested format. JobManager checks it against the file header. */
export interface GenerationOutputFile {
  /** Path relative to staging. */
  path: string;
  /** Lowercase hex, no prefix. */
  sha256: string;
  byteLength: number;
  mediaType: string;
}

export type GenerationAttempt =
  | {
      outcome: 'completed';
      outputs: GenerationOutputFile[];
      /** Adapter version, recorded in logs and diagnostics. */
      workerVersion: string;
      /** Usage as reported by the vendor, unchanged. */
      usage?: unknown;
      /** `generateText`: the checked result (finish reason, usage, model version and notes). The job's result summary uses it. */
      text?: TextResult;
    }
  | { outcome: 'cancelled' };

export interface GenerationProvider {
  readonly id: string;
  /** Performs one attempt. When `signal` aborts, it cancels the in-flight request and settles as `cancelled`. Throws `ProviderFailure` on failure. */
  generate(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt>;
  /** Normal stop: cancels the in-flight request. */
  close(): Promise<void>;
}
