import path from 'node:path';
import { JobsLocalProvider as L } from '@cuccut/protocol/messages/jobs/local-provider.ts';
import { errorText, jobWarning, type JobText } from './job-text.ts';

import {
  BUILTIN_REFERENCE_LABEL,
  CRASH_CODES,
  IMAGE_OUTPUT_FILE,
  IMAGE_PNG_CONTRACT,
  OUTPUT_WRITE_FAILED,
  ProviderFailure,
  appFileMissing,
  referenceUnreadableMessage,
  SPEAKERS_CONTRACT,
  SPEAKERS_OUTPUT_FILE,
  SPEECH_COMPONENTS,
  SPEECH_OUTPUT_FILE,
  SPEECH_WAV_CONTRACT,
  STEM_OUTPUT_FILES,
  STEMS_WAV_CONTRACT,
  WORKER_CONTRACT_VERSION,
  ASR_RESULT_SCHEMA,
  imageRunOf,
  sha256File,
  synthesizeRunOf,
  type DroppedReading,
  type GenerationAttempt,
  type GenerationProvider,
  type GenerationRun,
  type GenerationSink,
  type DiarizeRunResult,
  type ImageRunResult,
  type JobOutput,
  type JobRunParams,
  type JobRunResult,
  type ModelCatalog,
  type ModelLoadResult,
  type SeparateRunResult,
  type SynthesizeRunResult,
  type TranscribeAttempt,
  type TranscribeJobPhase,
  type TranscribeProvider,
  type TranscribeRun,
  type TranscribeSink,
  type WorkerEventParams,
  type WorkerHello,
} from '@cuccut/models';
import {
  JsonLineWorker,
  WorkerExitedError,
  WorkerRequestError,
  WorkerSpawnError,
  WorkerTimeoutError,
  type WorkerEvent,
  type WorkerExit,
} from '@cuccut/process-host';
import type { JobWarning } from '@cuccut/protocol';
import { silentLog, type JobsLogger } from './jobs-logger.ts';
import { modelWorkerHolder } from './resource-profiles.ts';

/**
 * Local Provider: manages Model Worker processes per model package (architecture design §6.5).
 *
 * - At most one process per model package, started on demand: `worker.hello` (5 seconds) → `model.load` (no time limit) → `job.run`;
 *   one process runs one job at a time (queued in JobManager).
 * - After `idleMs` (default 10 minutes) of idleness, `model.unload`, then stdin is closed; the next job waits for the process to actually exit before starting a new one.
 * - Cancellation: `job.cancel`; if `job.run` has not returned `cancelled` within the deadline (default 5 seconds), the process is ended. It is started again on demand next time.
 * - Crash: the process exits while a job is in progress, or `job.run` returns `WORKER_PANIC` / `INFERENCE_FAILED` / `DECODE_FAILED`; this counts as one crash. Reaching `crashLimit` crashes within `crashWindowMs` disables the model package (`error` / `resource`) until `enable`.
 *   Output that cannot be written to staging (`OUTPUT_WRITE_FAILED`) is a disk problem: `output-unwritable`, not counted as a crash.
 * - Load failures (`MODEL_NOT_INSTALLED` / `MODEL_UNSUPPORTED` / `MODEL_RESOURCE`) are recorded in the model catalog and not retried.
 * - Resources (§7.7): the process holds one share of the model package's holder in scheduling from start, returned only after the process actually exits; when asked to yield while idle, the model package is unloaded.
 * - Recognition (`transcribe`), local speech synthesis (`synthesize`, via `speechGenerator()`) and local text-to-image (`image`, via `imageGenerator()`) share the same process management. A recognition model package requires `worker.hello` to report `transcribe` and `transcribeFamilies` to list its `asr` family; a synthesis package requires reporting `synthesize` and `synthesizeFamilies` listing its `tts` family; an image package requires reporting `image` and `imageFamilies` listing its `image` family. Otherwise it is `load-failed` (`unsupported` / `capability-missing`): no `model.load` is sent, and the model package is not disabled (a different Worker can use it).
 * - Vocal separation (`separate`, via `separate()`, called directly by the separation step of translation dubbing) shares the same process management: a separation package (carrying only the `separator` component) requires reporting `separate` and `separateFamilies` listing its family; the same rules apply.
 * - Speaker diarization of an existing transcript (`diarize`, via `diarize()`, called directly by the speaker-identification flow) shares it too: the “speaker diarization” package is loaded separately (carrying only the `segmentation` and `speaker` components); it requires reporting `diarize`; the same rules apply.
 * - The `readingsDropped` of a synthesis result (pronunciation annotations that cannot be read) is turned one by one into the job's `reading-dropped` warning, not silently dropped.
 */

/** The holder the process holds in the resource scheduling (`ResourceScheduler.retain`). */
export interface ProcessResources {
  retain(holder: string, evict?: () => void): (() => void) | null;
}

export interface LocalProviderOptions {
  catalog: ModelCatalog;
  /** The Worker executable; null means local inference is unavailable. */
  command: () => { command: string; args?: readonly string[] } | null;
  /** The environment that starts the Worker (the login shell's PATH, same as the Engine Host). */
  env: () => Promise<NodeJS.ProcessEnv>;
  log?: JobsLogger;
  idleMs?: number;
  cancelGraceMs?: number;
  /** The first Metal kernel compile on an Intel Mac can exceed 5 seconds; by default it waits 60 seconds, and 5 seconds on other platforms. */
  helloTimeoutMs?: number;
  closeGraceMs?: number;
  crashLimit?: number;
  crashWindowMs?: number;
  /** Resource scheduling: when not given, processes are not counted (standalone use, tests). */
  resources?: ProcessResources;
}

interface Loaded {
  worker: JsonLineWorker;
  hello: WorkerHello;
}

interface ActiveJob {
  jobId: string;
  /** The Worker events (`job.*`) for this job. */
  route(event: WorkerEventParams): void;
}

/** One `job.run`: the Worker returns `cancelled` or is cancelled in flight, or it completes (output checked to be non-empty). */
type RunOutcome<R, O = JobOutput> =
  { outcome: 'cancelled'; workerVersion: string | null } | { outcome: 'completed'; result: R; output: O; workerVersion: string };

/** One local vocal separation call (`job.run` `separate`, Model Worker protocol spec §2.5.4). */
export interface LocalSeparateRun {
  bundleId: string;
  jobId: string;
  /** The whole input: the absolute path of the file and its content digest; `track` is the audio track number. */
  input: { file: string; contentHash: string; track: number };
  /** The sample rate of the output; null means the model's working sample rate. */
  sampleRate: number | null;
  /** The output is written here (absolute path, an existing directory). */
  staging: string;
}

export type LocalSeparateOutcome =
  { outcome: 'cancelled' } | { outcome: 'completed'; vocals: string; background: string; result: SeparateRunResult; workerVersion: string };

/** One call of speaker diarization on an existing transcript (`job.run` `diarize`, Model Worker protocol spec §2.5.5). */
export interface LocalDiarizeRun {
  bundleId: string;
  jobId: string;
  input: { file: string; contentHash: string; track: number };
  /** The start and end of the transcript's words in source time (in ticks of `timescale`), in transcript order. */
  timescale: number;
  words: Array<[number, number]>;
  staging: string;
}

export type LocalDiarizeOutcome =
  { outcome: 'cancelled' } | { outcome: 'completed'; file: string; sha256: string; result: DiarizeRunResult; workerVersion: string };

interface RunSpec {
  bundleId: string | null;
  jobId: string;
  route(event: WorkerEventParams): void;
  loading(): void;
  expectedWorkerVersion?: string | undefined;
  params: JobRunParams;
  /** The explanation for `INPUT_UNREADABLE` (the recognized source, the synthesis reference recording). */
  inputLabel: JobText;
  /** Content merged into `details` on `INPUT_UNREADABLE` (when a built-in voice's recording cannot be read, it carries `code: 'APP_FILE_MISSING'`). */
  inputDetails?: Record<string, unknown>;
}

interface Slot {
  bundleId: string;
  loaded: Loaded | null;
  acquiring: Promise<Loaded> | null;
  /** A process ended on idle unload or cancellation: a new process waits for it to actually exit. */
  retiring: Promise<unknown> | null;
  job: ActiveJob | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  crashes: number[];
}

const LOAD_REASON: Record<string, { state: 'not-installed' | 'error'; reason: 'load-failed' | 'unsupported' | 'resource'; label: string }> =
  {
    MODEL_NOT_INSTALLED: { state: 'not-installed', reason: 'load-failed', label: 'not-installed' },
    MODEL_UNSUPPORTED: { state: 'error', reason: 'unsupported', label: 'unsupported' },
    MODEL_RESOURCE: { state: 'error', reason: 'resource', label: 'resource' },
  };

export class LocalTranscribeProvider implements TranscribeProvider {
  readonly id = 'local';
  readonly #options: LocalProviderOptions;
  readonly #catalog: ModelCatalog;
  readonly #log: JobsLogger;
  readonly #slots = new Map<string, Slot>();
  readonly #idleMs: number;
  readonly #cancelGraceMs: number;
  readonly #helloTimeoutMs: number;
  readonly #closeGraceMs: number;
  readonly #crashLimit: number;
  readonly #crashWindowMs: number;
  #closed = false;

  constructor(options: LocalProviderOptions) {
    this.#options = options;
    this.#catalog = options.catalog;
    this.#log = options.log ?? silentLog;
    this.#idleMs = options.idleMs ?? 10 * 60_000;
    this.#cancelGraceMs = options.cancelGraceMs ?? 5_000;
    this.#helloTimeoutMs = options.helloTimeoutMs ?? (process.platform === 'darwin' && process.arch === 'x64' ? 60_000 : 5_000);
    this.#closeGraceMs = options.closeGraceMs ?? 5_000;
    this.#crashLimit = options.crashLimit ?? 3;
    this.#crashWindowMs = options.crashWindowMs ?? 5 * 60_000;
  }

  /** For tests and diagnostics: the process ID of a model package's Worker. */
  workerPid(bundleId: string): number | null {
    return this.#slots.get(bundleId)?.loaded?.worker.pid ?? null;
  }

  enable(bundleId: string): void {
    const slot = this.#slots.get(bundleId);
    if (slot) slot.crashes = [];
  }

  /**
   * Unloads a model package (before deleting the model package, architecture design §6.3): an idle Worker exits normally via `model.unload`, and it is waited on until it actually exits.
   * When a job is executing, it is left alone and the method returns false. When there is no job but it is still loading (the job was cancelled during loading), it waits for loading to finish and then unloads.
   */
  async unload(bundleId: string): Promise<boolean> {
    const slot = this.#slots.get(bundleId);
    if (!slot) return true;
    if (slot.job) return false;
    if (slot.acquiring) await slot.acquiring.catch(() => {});
    if (slot.job) return false;
    this.#clearIdle(slot);
    const loaded = slot.loaded;
    if (loaded) await this.#retire(slot, loaded.worker, 'unload');
    await slot.retiring;
    return true;
  }

  async transcribe(run: TranscribeRun, sink: TranscribeSink, signal: AbortSignal): Promise<TranscribeAttempt> {
    const outcome = await this.#run<JobRunResult>(
      {
        bundleId: run.bundleId,
        jobId: run.jobId,
        loading: () => sink.loading(),
        route: (event) => routeTranscribe(sink, event),
        expectedWorkerVersion: run.expectedWorkerVersion,
        params: {
          jobId: run.jobId,
          runGeneration: run.runGeneration,
          capability: 'transcribe',
          input: run.input,
          options: run.options,
          staging: run.staging,
          outputContract: ASR_RESULT_SCHEMA,
        },
        inputLabel: L.assetUnreadable(),
      },
      signal,
    );
    if (outcome.outcome === 'cancelled') return outcome;
    return { outcome: 'completed', output: outcome.output, workerVersion: outcome.workerVersion };
  }

  /**
   * One attempt of local speech synthesis (architecture design §6.1, §6.5): frozen parameters become `job.run` (`synthesize`); the output is the WAV in staging,
   * validated and published by JobManager under the rules for generation jobs. The reference recording is checked again against the digest from submission right before execution; if it changed, nothing is synthesized (no voice substitution).
   */
  async synthesize(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt> {
    const parameters = run.parameters;
    if (parameters.capability !== 'synthesizeSpeech') {
      throw new ProviderFailure('protocol', L.notHandled({ capability: parameters.capability }));
    }
    if (signal.aborted) return { outcome: 'cancelled' };
    const { input, options } = synthesizeRunOf(parameters);
    // When it cannot be read: a built-in voice's recording means the installation is incomplete (`APP_FILE_MISSING`); a requested file names its filename.
    const unreadable = input
      ? parameters.reference?.source === 'builtin'
        ? builtinUnreadable(input.file)
        : { message: referenceUnreadableMessage(input.file), details: { file: input.file } }
      : null;
    if (input && unreadable) {
      const actual = await sha256File(input.file).catch(() => null);
      if (actual === null) throw new ProviderFailure('input-unreadable', unreadable.message, unreadable.details);
      if (`sha256:${actual}` !== input.contentHash) {
        throw new ProviderFailure('input-unreadable', L.referenceChanged(), { file: input.file, expected: input.contentHash });
      }
    }
    const outcome = await this.#run<SynthesizeRunResult>(
      {
        bundleId: run.modelId,
        jobId: run.jobId,
        loading: () => {},
        route: (event) => routeSynthesize(sink, event),
        params: {
          jobId: run.jobId,
          runGeneration: run.attempt,
          capability: 'synthesize',
          input,
          options,
          staging: run.staging,
          outputContract: SPEECH_WAV_CONTRACT,
        },
        inputLabel: unreadable?.message ?? L.referenceUnreadable(),
        ...(unreadable ? { inputDetails: unreadable.details } : {}),
      },
      signal,
    );
    if (outcome.outcome === 'cancelled') return { outcome: 'cancelled' };
    for (const dropped of outcome.result.readingsDropped ?? []) sink.warning?.(readingDropped(dropped));
    const output = outcome.output;
    // The Worker reports absolute paths (same as recognition); the output of a generation job is a path relative to staging, and it can only be `speech.wav`.
    const relative = path.relative(run.staging, path.resolve(run.staging, output.path));
    if (relative !== SPEECH_OUTPUT_FILE) {
      throw new ProviderFailure('protocol', L.speechOutputWrong({ file: SPEECH_OUTPUT_FILE }), { path: output.path });
    }
    return {
      outcome: 'completed',
      outputs: [{ path: relative, sha256: output.sha256.replace(/^sha256:/, ''), byteLength: output.byteLength, mediaType: 'audio/wav' }],
      workerVersion: outcome.workerVersion,
    };
  }

  /**
   * Local vocal separation (architecture design §6.1 `separateAudio`): the whole input is split into vocals and background, and the two WAVs are written into `run.staging`.
   * The output must be exactly `vocals.wav` and `background.wav` in staging; otherwise it is a protocol error.
   */
  async separate(
    run: LocalSeparateRun,
    signal: AbortSignal,
    onProgress?: (done: number, total: number) => void,
  ): Promise<LocalSeparateOutcome> {
    const outcome = await this.#runWith<SeparateRunResult, NonNullable<SeparateRunResult['stems']>>(
      {
        bundleId: run.bundleId,
        jobId: run.jobId,
        loading: () => {},
        route: (event) => {
          if (event.event === 'job.progress' && event.params.phase === 'separating' && event.params.total !== null) {
            onProgress?.(event.params.done, event.params.total);
          }
        },
        params: {
          jobId: run.jobId,
          runGeneration: 1,
          capability: 'separate',
          input: run.input,
          options: { sampleRate: run.sampleRate },
          staging: run.staging,
          outputContract: STEMS_WAV_CONTRACT,
        },
        inputLabel: L.assetUnreadable(),
        inputDetails: { file: run.input.file },
      },
      signal,
      (result) => result.stems,
    );
    if (outcome.outcome === 'cancelled') return { outcome: 'cancelled' };
    const files = { vocals: '', background: '' };
    for (const name of ['vocals', 'background'] as const) {
      const file = path.resolve(run.staging, outcome.output[name].path);
      if (path.relative(run.staging, file) !== STEM_OUTPUT_FILES[name]) {
        throw new ProviderFailure('protocol', L.stemOutputWrong({ file: STEM_OUTPUT_FILES[name] }), {
          path: outcome.output[name].path,
        });
      }
      files[name] = file;
    }
    return { outcome: 'completed', ...files, result: outcome.result, workerVersion: outcome.workerVersion };
  }

  /**
   * Speaker diarization of an existing transcript (architecture design §6.6): loads the “speaker diarization” model package itself, word timings are handed to the Worker, and the result is `speakers.json` in staging;
   * anything else is a protocol error. `onProgress` reports the diarization window progress.
   */
  async diarize(
    run: LocalDiarizeRun,
    signal: AbortSignal,
    onProgress?: (done: number, total: number | null, phase: 'decoding' | 'diarizing' | 'finalizing') => void,
  ): Promise<LocalDiarizeOutcome> {
    const outcome = await this.#runWith<DiarizeRunResult, JobOutput>(
      {
        bundleId: run.bundleId,
        jobId: run.jobId,
        loading: () => {},
        route: (event) => {
          if (event.event === 'job.phase' && isDiarizePhase(event.params.phase)) onProgress?.(0, null, event.params.phase);
          if (event.event === 'job.progress' && isDiarizePhase(event.params.phase)) {
            onProgress?.(event.params.done, event.params.total, event.params.phase);
          }
        },
        params: {
          jobId: run.jobId,
          runGeneration: 1,
          capability: 'diarize',
          input: run.input,
          options: { timescale: run.timescale, words: run.words },
          staging: run.staging,
          outputContract: SPEAKERS_CONTRACT,
        },
        inputLabel: L.assetUnreadable(),
        inputDetails: { file: run.input.file },
      },
      signal,
      (result) => result.output,
    );
    if (outcome.outcome === 'cancelled') return { outcome: 'cancelled' };
    const file = path.resolve(run.staging, outcome.output.path);
    if (path.relative(run.staging, file) !== SPEAKERS_OUTPUT_FILE) {
      throw new ProviderFailure('protocol', L.speakersOutputWrong({ file: SPEAKERS_OUTPUT_FILE }), { path: outcome.output.path });
    }
    return {
      outcome: 'completed',
      file,
      sha256: outcome.output.sha256.replace(/^sha256:/, ''),
      result: outcome.result,
      workerVersion: outcome.workerVersion,
    };
  }

  /** The facade of the generation capabilities: the `local` Provider's `synthesizeSpeech`. The process is closed together with the recognition Provider. */
  speechGenerator(): GenerationProvider {
    return {
      id: this.id,
      generate: (run, sink, signal) => this.synthesize(run, sink, signal),
      close: async () => {},
    };
  }

  /**
   * One attempt of local text-to-image (architecture design §6.1, §6.5): frozen parameters (size and seed are decided at submission) become `job.run` (`image`), and the output is
   * `image.png` in staging, validated and published by JobManager under the rules for generation jobs. `steps` is only given by the model package self-check.
   */
  async generateImage(
    run: GenerationRun,
    sink: GenerationSink,
    signal: AbortSignal,
    options: { steps?: number | null } = {},
  ): Promise<GenerationAttempt> {
    const parameters = run.parameters;
    if (parameters.capability !== 'generateImage') {
      throw new ProviderFailure('protocol', L.notHandled({ capability: parameters.capability }));
    }
    if (signal.aborted) return { outcome: 'cancelled' };
    const outcome = await this.#run<ImageRunResult>(
      {
        bundleId: run.modelId,
        jobId: run.jobId,
        loading: () => {},
        route: (event) => routeImage(sink, event),
        params: {
          jobId: run.jobId,
          runGeneration: run.attempt,
          capability: 'image',
          options: imageRunOf(parameters, options.steps ?? null),
          staging: run.staging,
          outputContract: IMAGE_PNG_CONTRACT,
        },
        inputLabel: L.imageNoInput(),
      },
      signal,
    );
    if (outcome.outcome === 'cancelled') return { outcome: 'cancelled' };
    const output = outcome.output;
    const relative = path.relative(run.staging, path.resolve(run.staging, output.path));
    if (relative !== IMAGE_OUTPUT_FILE) {
      throw new ProviderFailure('protocol', L.imageOutputWrong({ file: IMAGE_OUTPUT_FILE }), { path: output.path });
    }
    return {
      outcome: 'completed',
      outputs: [{ path: relative, sha256: output.sha256.replace(/^sha256:/, ''), byteLength: output.byteLength, mediaType: 'image/png' }],
      workerVersion: outcome.workerVersion,
    };
  }

  /** The facade of the generation capabilities: the `local` Provider's `generateImage`. The process is closed together with the recognition Provider. */
  imageGenerator(): GenerationProvider {
    return {
      id: this.id,
      generate: (run, sink, signal) => this.generateImage(run, sink, signal),
      close: async () => {},
    };
  }

  async #run<R extends { outcome: 'completed' | 'cancelled'; output: JobOutput | null }>(
    spec: RunSpec,
    signal: AbortSignal,
  ): Promise<RunOutcome<R>> {
    return this.#runWith<R, JobOutput>(spec, signal, (result) => result.output);
  }

  /** The general form of `#run`: `outputOf` extracts the output from a completed result; when it is null, it is a protocol error. */
  async #runWith<R extends { outcome: 'completed' | 'cancelled' }, O>(
    spec: RunSpec,
    signal: AbortSignal,
    outputOf: (result: R) => O | null,
  ): Promise<RunOutcome<R, O>> {
    if (signal.aborted) return { outcome: 'cancelled', workerVersion: null };
    if (this.#closed) throw new ProviderFailure('unavailable', L.runtimeStopping());
    const bundleId = spec.bundleId;
    if (bundleId === null) throw new ProviderFailure('unavailable', L.bundleRequired());
    if (this.#catalog.blocked(bundleId)) {
      const status = await this.#catalog.status(bundleId);
      throw new ProviderFailure('unavailable', L.bundleDisabled(), { reason: status?.reason ?? 'resource', state: status?.state });
    }
    const slot = this.#slot(bundleId);
    if (slot.job) throw new ProviderFailure('crashed', L.workerBusy(), { reason: 'worker-busy' });
    this.#clearIdle(slot);
    slot.job = { jobId: spec.jobId, route: spec.route };

    let loaded: Loaded;
    try {
      const acquiring = this.#acquire(slot, spec.loading);
      const raced = await raceAbort(acquiring, signal);
      if (raced === ABORTED) {
        // Loading continues in the background: the model stays in memory, and the next job uses it directly.
        slot.job = null;
        acquiring.then(
          () => this.#scheduleIdle(slot),
          () => {},
        );
        return { outcome: 'cancelled', workerVersion: null };
      }
      loaded = raced;
    } catch (error) {
      slot.job = null;
      throw error;
    }

    const { worker, hello } = loaded;
    if (spec.expectedWorkerVersion && hello.workerVersion !== spec.expectedWorkerVersion) {
      slot.job = null;
      this.#scheduleIdle(slot);
      throw new ProviderFailure('version-changed', L.workerVersionChanged(), {
        expected: spec.expectedWorkerVersion,
        actual: hello.workerVersion,
      });
    }

    this.#catalog.setRuntimeState(slot.bundleId, 'busy');
    let killedForCancel = false;
    let cancelTimer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      worker.request('job.cancel', { jobId: spec.jobId }, { timeoutMs: this.#cancelGraceMs }).catch(() => {});
      cancelTimer = setTimeout(() => {
        killedForCancel = true;
        this.#log.warn('Cancellation timed out; killing Model Worker', { bundleId: slot.bundleId, jobId: spec.jobId });
        this.#retire(slot, worker, 'kill');
      }, this.#cancelGraceMs);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await worker.request<R>('job.run', spec.params);
      if (result.outcome === 'cancelled') return { outcome: 'cancelled', workerVersion: hello.workerVersion };
      const output = outputOf(result);
      if (!output) throw new ProviderFailure('protocol', L.noOutput());
      return { outcome: 'completed', result, output, workerVersion: hello.workerVersion };
    } catch (error) {
      if (error instanceof ProviderFailure) throw error;
      if (killedForCancel || (signal.aborted && error instanceof WorkerExitedError)) {
        return { outcome: 'cancelled', workerVersion: hello.workerVersion };
      }
      if (error instanceof WorkerExitedError) {
        this.#recordCrash(slot);
        throw new ProviderFailure('crashed', L.workerExitedDuringJob(), {
          exitCode: error.exit?.code ?? null,
          signal: error.exit?.signal ?? null,
          stderrTail: worker.stderrTail(),
          workerVersion: hello.workerVersion,
        });
      }
      if (error instanceof WorkerRequestError) {
        const details = { workerCode: error.code, workerMessage: error.body.message, workerVersion: hello.workerVersion };
        if ((CRASH_CODES as readonly string[]).includes(error.code)) {
          this.#recordCrash(slot);
          throw new ProviderFailure('crashed', L.inferenceFailed({ code: error.code }), { ...details, stderrTail: worker.stderrTail() });
        }
        if (error.code === 'INPUT_UNREADABLE') {
          throw new ProviderFailure('input-unreadable', spec.inputLabel, { ...details, ...spec.inputDetails });
        }
        if (error.code === OUTPUT_WRITE_FAILED) {
          const file = (error.body.details as { file?: unknown } | undefined)?.file;
          throw new ProviderFailure('output-unwritable', L.stagingUnwritable(), {
            ...details,
            ...(typeof file === 'string' ? { file } : {}),
          });
        }
        const workerDetails = error.body.details !== undefined ? { workerDetails: error.body.details } : {};
        // A model package that has been loaded but does not support this job (e.g. synthesis not yet wired to inference) is in the same class as a load failure: not retried, and the model package is not disabled.
        if (error.code === 'MODEL_UNSUPPORTED') {
          throw new ProviderFailure('load-failed', L.workerUnsupported({ message: error.body.message }), {
            reason: 'unsupported',
            ...details,
            ...workerDetails,
          });
        }
        throw new ProviderFailure('protocol', L.jobRunReturned({ code: error.code }), { ...details, ...workerDetails });
      }
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      if (cancelTimer) clearTimeout(cancelTimer);
      slot.job = null;
      if (slot.loaded?.worker === worker && worker.alive) {
        this.#catalog.setRuntimeState(slot.bundleId, 'ready');
        this.#scheduleIdle(slot);
      }
    }
  }

  async close(): Promise<void> {
    this.#closed = true;
    await Promise.all(
      [...this.#slots.values()].map(async (slot) => {
        this.#clearIdle(slot);
        const loaded = slot.loaded ?? (await slot.acquiring?.catch(() => null)) ?? null;
        if (loaded) await this.#retire(slot, loaded.worker, 'close');
        await slot.retiring;
      }),
    );
  }

  // ---- Processes ----

  #slot(bundleId: string): Slot {
    let slot = this.#slots.get(bundleId);
    if (!slot) {
      slot = { bundleId, loaded: null, acquiring: null, retiring: null, job: null, idleTimer: null, crashes: [] };
      this.#slots.set(bundleId, slot);
    }
    return slot;
  }

  #acquire(slot: Slot, loading: () => void): Promise<Loaded> {
    if (slot.loaded?.worker.alive) return Promise.resolve(slot.loaded);
    loading();
    slot.acquiring ??= this.#spawnAndLoad(slot).finally(() => {
      slot.acquiring = null;
    });
    return slot.acquiring;
  }

  async #spawnAndLoad(slot: Slot): Promise<Loaded> {
    // Holds one share of the holder before any await, while the job still holds the lease: if the job is cancelled during loading and returns the lease first, the process being started still counts.
    const share = this.#options.resources?.retain(modelWorkerHolder(slot.bundleId), () => void this.unload(slot.bundleId)) ?? null;
    let started = false;
    try {
      const loaded = await this.#startAndLoad(slot, (worker) => {
        started = true;
        // Returned only after the process actually exits (`close`).
        void worker.exited.then(() => share?.());
      });
      return loaded;
    } finally {
      if (!started) share?.();
    }
  }

  async #startAndLoad(slot: Slot, onStarted: (worker: JsonLineWorker) => void): Promise<Loaded> {
    await slot.retiring;
    const resolved = this.#options.command();
    if (!resolved) {
      throw new ProviderFailure('load-failed', L.workerNotFound(), { reason: 'worker-missing' });
    }
    this.#catalog.setRuntimeState(slot.bundleId, 'loading');
    let worker: JsonLineWorker;
    try {
      worker = await JsonLineWorker.start({
        command: resolved.command,
        args: [...(resolved.args ?? []), '--parent-pid', String(process.pid)],
        env: await this.#options.env(),
      });
    } catch (error) {
      this.#catalog.setRuntimeState(slot.bundleId, null);
      throw new ProviderFailure('load-failed', error instanceof WorkerSpawnError ? error.message : L.workerCannotStart(), {
        reason: 'worker-missing',
      });
    }
    onStarted(worker);
    const log = this.#log;
    worker.onEvent((event) => this.#onEvent(slot, event));
    worker.onExit((exit) => this.#onExit(slot, worker, exit));

    const fail = async (failure: ProviderFailure): Promise<never> => {
      await worker.kill().catch(() => {});
      if (!this.#catalog.blocked(slot.bundleId)) this.#catalog.setRuntimeState(slot.bundleId, null);
      throw failure;
    };

    let hello: WorkerHello;
    try {
      hello = await worker.request<WorkerHello>(
        'worker.hello',
        { contractVersion: WORKER_CONTRACT_VERSION },
        { timeoutMs: this.#helloTimeoutMs },
      );
    } catch (error) {
      if (error instanceof WorkerExitedError) {
        return fail(new ProviderFailure('crashed', L.workerExitedOnStart(), { stderrTail: worker.stderrTail() }));
      }
      const detail =
        error instanceof WorkerTimeoutError ? 'hello-timeout' : error instanceof WorkerRequestError ? error.code : 'hello-failed';
      return fail(new ProviderFailure('load-failed', L.handshakeFailed(), { reason: 'unsupported', detail }));
    }
    if (hello.contractVersion !== WORKER_CONTRACT_VERSION) {
      return fail(
        new ProviderFailure('load-failed', L.contractMismatch(), {
          reason: 'unsupported',
          detail: 'CONTRACT_MISMATCH',
          workerContract: hello.contractVersion,
        }),
      );
    }

    // The backend and device follow the handshake (architecture design §6.5): when the Worker was not built with this backend or cannot use it, do not load (and do not disable the model package; a different Worker can use it);
    // candle and GGML use the device the Worker reports as preferred (`cuda` when CUDA is available; GGML may also be `vulkan`), recorded in the model catalog for status display.
    const def = this.#catalog.definition(slot.bundleId);
    const backend = def ? hello.backends?.find((b) => b.id === def.backend) : undefined;
    if (def && backend) this.#catalog.setWorkerDevice(def.backend, backend.available ? (backend.devices[0] ?? null) : null);
    if (def && backend && !backend.available) {
      return fail(
        new ProviderFailure('load-failed', L.backendUnavailable({ backend: def.backend }), {
          reason: 'unsupported',
          detail: 'backend-unavailable',
          backend: def.backend,
          ...(backend.reason ? { backendReason: backend.reason } : {}),
        }),
      );
    }
    const device = backend?.available ? backend.devices[0] : undefined;

    try {
      const bundle = await this.#catalog.bundleFor(
        slot.bundleId,
        device && (def?.backend === 'candle' || def?.backend === 'ggml') ? { device } : {},
      );
      // A synthesis package requires the Worker to declare `synthesize` and list this family; separation requires declaring `separate` and listing the `separator` family; image requires declaring `image` and listing the `image` family; recognition requires declaring `transcribe` and listing the `asr` family. An unrecognized Worker is not tried
      // (`MODEL_UNSUPPORTED` from `model.load` would disable the model package), and the model package is not disabled (a different Worker can use it).
      if (bundle.components.separator) {
        const family = bundle.components.separator.family;
        const families = hello.separateFamilies ?? [];
        if (!hello.capabilities.includes('separate') || !families.includes(family)) {
          return fail(
            new ProviderFailure('load-failed', L.cannotSeparate(), {
              reason: 'unsupported',
              detail: 'capability-missing',
              family,
              capabilities: hello.capabilities,
              separateFamilies: families,
            }),
          );
        }
      } else if (bundle.components.image) {
        const family = bundle.components.image.family;
        const families = hello.imageFamilies ?? [];
        if (!hello.capabilities.includes('image') || !families.includes(family)) {
          return fail(
            new ProviderFailure('load-failed', L.cannotGenerateImage(), {
              reason: 'unsupported',
              detail: 'capability-missing',
              family,
              capabilities: hello.capabilities,
              imageFamilies: families,
            }),
          );
        }
      } else if (!bundle.components.asr && bundle.components.segmentation) {
        // The “speaker diarization” model package is loaded separately (for diarizing speakers of an existing transcript, §2.5.5).
        if (!hello.capabilities.includes('diarize')) {
          return fail(
            new ProviderFailure('load-failed', L.cannotDiarize(), {
              reason: 'unsupported',
              detail: 'capability-missing',
              family: bundle.components.segmentation.family,
              capabilities: hello.capabilities,
            }),
          );
        }
      } else if (!SPEECH_COMPONENTS.some((c) => bundle.components[c])) {
        const family = bundle.components.asr?.family ?? null;
        const families = hello.transcribeFamilies ?? [];
        if (!hello.capabilities.includes('transcribe') || family === null || !families.includes(family)) {
          return fail(
            new ProviderFailure('load-failed', L.cannotTranscribe(), {
              reason: 'unsupported',
              detail: 'capability-missing',
              family,
              capabilities: hello.capabilities,
              transcribeFamilies: families,
            }),
          );
        }
      } else {
        const family = bundle.components.tts?.family ?? null;
        const families = hello.synthesizeFamilies ?? [];
        if (!hello.capabilities.includes('synthesize') || family === null || !families.includes(family)) {
          return fail(
            new ProviderFailure('load-failed', L.cannotSynthesize(), {
              reason: 'unsupported',
              detail: 'capability-missing',
              family,
              capabilities: hello.capabilities,
              synthesizeFamilies: families,
            }),
          );
        }
      }
      const loadResult = await worker.request<ModelLoadResult>('model.load', { bundle });
      log.info('Model Worker loaded model bundle', {
        bundleId: slot.bundleId,
        pid: worker.pid,
        workerVersion: hello.workerVersion,
        ...loadResult,
      });
    } catch (error) {
      if (error instanceof WorkerRequestError) {
        const mapped = LOAD_REASON[error.code];
        if (mapped) this.#catalog.block(slot.bundleId, mapped.state, mapped.reason, error.body.message);
        return fail(
          new ProviderFailure('load-failed', L.loadFailed({ reason: error.code }), {
            reason: mapped?.label ?? 'error',
            workerCode: error.code,
            ...(error.body.details !== undefined ? { workerDetails: error.body.details } : {}),
          }),
        );
      }
      if (error instanceof WorkerExitedError) {
        this.#recordCrash(slot);
        return fail(new ProviderFailure('crashed', L.workerExitedOnLoad(), { stderrTail: worker.stderrTail() }));
      }
      return fail(new ProviderFailure('load-failed', L.loadFailed({ reason: errorText(error) }), { reason: 'not-installed' }));
    }

    this.#catalog.setRuntimeState(slot.bundleId, 'ready');
    const loaded = { worker, hello };
    slot.loaded = loaded;
    return loaded;
  }

  #onEvent(slot: Slot, event: WorkerEvent): void {
    const typed = event as WorkerEventParams;
    if (typed.event === 'model.phase') return;
    const job = slot.job;
    const params = typed.params as { jobId?: unknown };
    if (!job || params.jobId !== job.jobId) return;
    job.route(typed);
  }

  #onExit(slot: Slot, worker: JsonLineWorker, exit: WorkerExit): void {
    if (slot.loaded?.worker !== worker) return;
    slot.loaded = null;
    this.#clearIdle(slot);
    if (!this.#catalog.blocked(slot.bundleId)) this.#catalog.setRuntimeState(slot.bundleId, null);
    if (!exit.expected && !slot.job) this.#log.warn('Idle Model Worker exited', { bundleId: slot.bundleId, ...exit });
  }

  /** Ends a process: it is first removed from the slot, and a new job waits for it to actually exit before a new process starts (architecture design §6.5 “before loading a new model package”). */
  #retire(slot: Slot, worker: JsonLineWorker, how: 'kill' | 'unload' | 'close'): Promise<unknown> {
    if (slot.loaded?.worker === worker) slot.loaded = null;
    this.#clearIdle(slot);
    const done = (async () => {
      if (how === 'kill') return worker.kill();
      if (how === 'unload') {
        this.#catalog.setRuntimeState(slot.bundleId, 'unloading');
        await worker.request('model.unload', {}, { timeoutMs: this.#closeGraceMs }).catch(() => {});
      }
      return worker.close(this.#closeGraceMs);
    })().finally(() => {
      if (slot.retiring === done) slot.retiring = null;
      if (!slot.loaded && !slot.acquiring && !this.#catalog.blocked(slot.bundleId)) this.#catalog.setRuntimeState(slot.bundleId, null);
    });
    slot.retiring = done;
    return done;
  }

  #scheduleIdle(slot: Slot): void {
    this.#clearIdle(slot);
    if (this.#closed || slot.job || !slot.loaded) return;
    const worker = slot.loaded.worker;
    slot.idleTimer = setTimeout(() => {
      slot.idleTimer = null;
      if (slot.job || slot.loaded?.worker !== worker) return;
      this.#log.info('Model Worker idle; unloading model bundle', { bundleId: slot.bundleId, pid: worker.pid });
      void this.#retire(slot, worker, 'unload');
    }, this.#idleMs);
    slot.idleTimer.unref?.();
  }

  #clearIdle(slot: Slot): void {
    if (slot.idleTimer) clearTimeout(slot.idleTimer);
    slot.idleTimer = null;
  }

  #recordCrash(slot: Slot): void {
    const now = Date.now();
    slot.crashes = slot.crashes.filter((t) => now - t < this.#crashWindowMs);
    slot.crashes.push(now);
    this.#log.warn('Model Worker crashed', { bundleId: slot.bundleId, recent: slot.crashes.length });
    if (slot.crashes.length >= this.#crashLimit) {
      this.#log.error('Model Worker crashed repeatedly; disabling model bundle', { bundleId: slot.bundleId });
      this.#catalog.block(
        slot.bundleId,
        'error',
        'resource',
        L.crashedRepeatedly({ minutes: Math.round(this.#crashWindowMs / 60_000), count: slot.crashes.length }),
      );
      const loaded = slot.loaded;
      if (loaded) void this.#retire(slot, loaded.worker, 'kill');
    }
  }
}

const TRANSCRIBE_PHASES = new Set<string>(['decoding', 'vad', 'transcribing', 'aligning', 'diarizing', 'finalizing']);

function routeTranscribe(sink: TranscribeSink, event: WorkerEventParams): void {
  switch (event.event) {
    case 'job.phase':
      if (TRANSCRIBE_PHASES.has(event.params.phase)) sink.phase(event.params.phase as TranscribeJobPhase);
      return;
    case 'job.progress': {
      const { phase, done, total, unit } = event.params;
      if (TRANSCRIBE_PHASES.has(phase) && unit !== 'steps') sink.progress({ phase: phase as TranscribeJobPhase, done, total, unit });
      return;
    }
    case 'job.segment':
      return sink.segment(event.params.segment);
    case 'job.warning':
      return sink.warning(event.params.warning);
    case 'job.language':
      return sink.language(event.params.tag, event.params.confidence);
  }
}

/** A pronunciation annotation that cannot be read → a job warning. `detail` says only the position and the pronunciation, not the text itself. */
function readingDropped(dropped: DroppedReading): JobWarning {
  const { reading, origin } = dropped;
  const detail =
    dropped.start + 1 === dropped.end
      ? L.readingDroppedOne({ at: dropped.end, reading, origin })
      : L.readingDroppedRange({ from: dropped.start + 1, to: dropped.end, reading, origin });
  return jobWarning('reading-dropped', detail);
}

/** Synthesis events: entering `synthesizing` is the generation stage; progress with a total (steps) during the synthesis stage is passed to the generation job. */
function routeSynthesize(sink: GenerationSink, event: WorkerEventParams): void {
  if (event.event === 'job.phase' && event.params.phase === 'synthesizing') sink.generating();
  else if (
    event.event === 'job.progress' &&
    event.params.phase === 'synthesizing' &&
    event.params.unit === 'steps' &&
    event.params.total !== null
  ) {
    sink.progress(event.params.done, event.params.total, 'steps');
  }
}

function routeImage(sink: GenerationSink, event: WorkerEventParams): void {
  if (event.event === 'job.phase' && event.params.phase === 'encoding-prompt') sink.generating();
  else if (
    event.event === 'job.progress' &&
    event.params.phase === 'denoising' &&
    event.params.unit === 'steps' &&
    event.params.total !== null
  ) {
    sink.progress(event.params.done, event.params.total, 'steps');
  }
}

const ABORTED = Symbol('aborted');

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** A built-in voice's recording cannot be read (deleted after submission, or in a location the Worker cannot read): the same message and error code as at submission (`APP_FILE_MISSING`). */
function builtinUnreadable(file: string): { message: JobText; details: Record<string, unknown> } {
  const error = appFileMissing(BUILTIN_REFERENCE_LABEL, null, file);
  return { message: errorText(error), details: error.details as Record<string, unknown> };
}

function isDiarizePhase(phase: string): phase is 'decoding' | 'diarizing' | 'finalizing' {
  return phase === 'decoding' || phase === 'diarizing' || phase === 'finalizing';
}
