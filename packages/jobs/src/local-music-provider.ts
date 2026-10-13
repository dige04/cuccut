import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  MUSIC_OUTPUT_FILE,
  ProviderFailure,
  inspectWav,
  musicEngineRunOf,
  sha256File,
  type GenerationAttempt,
  type GenerationProvider,
  type GenerationRun,
  type GenerationSink,
  type ModelCatalog,
} from '@cuccut/models';
import { killProcessTree } from '@cuccut/process-host';
import { JobsLocalProvider as L } from '@cuccut/protocol/messages/jobs/local-provider.ts';
import { jobWarning } from './job-text.ts';
import { silentLog, type JobsLogger } from './jobs-logger.ts';

/**
 * Provider for local music generation (architecture design §6.1, §6.3): the `local` executor of `generateMusic`. Each job starts one audio.cpp engine process
 * (`audiocpp_cli`), reads the GGUF in the model package directory, and writes the WAV into this attempt's staging. No Model Worker takes part, and it is not resident.
 *
 * - When the engine is not found: `unavailable`, reason `not-installed`. The engine is a required component of the model package (`audiocpp-engine`); when it is not installed, the model catalog likewise marks the model package as `not-installed` / `incomplete`, and downloading or repairing the model package is enough.
 * - Progress: the engine does not report steps; once in the generation stage there is only indeterminate progress; on completion it reports 1/1.
 * - Cancellation: first SIGTERM the whole process group (on Windows, taskkill the whole tree), then SIGKILL after a grace period; after the process exits, it settles as `cancelled`.
 * - When the output hits the token limit converted from `maxDurationSec` (WAV duration reaches 98% of the limit), an `output-truncated` warning is recorded, and the job still completes.
 * - Failure: a process that cannot start is `unavailable`; a non-zero exit is `crashed`, with the tail of stderr; exiting without a WAV is `protocol`.
 */

export interface LocalMusicProviderOptions {
  catalog: ModelCatalog;
  /** The path to the engine executable for a model package; null means not found. Re-resolved for each job (no restart needed after the model package is installed). */
  engine: (bundleId: string) => string | null;
  /** The environment that starts the engine (the login shell's PATH, same as the Model Worker). */
  env: () => Promise<NodeJS.ProcessEnv>;
  /** The engine backend (`metal` / `cuda` / `vulkan` / `cpu`); when null, the engine chooses based on its build. */
  backend?: string | null;
  threads?: number;
  log?: JobsLogger;
  cancelGraceMs?: number;
  /** For tests: replaces `spawn`. */
  spawn?: typeof spawn;
}

/** A WAV duration reaching this proportion of the limit counts as hitting the limit. */
const TRUNCATED_RATIO = 0.98;
/** Length of the stderr tail kept for the failure explanation. */
const STDERR_TAIL = 2000;

export class LocalMusicProvider implements GenerationProvider {
  readonly id = 'local';
  readonly #catalog: ModelCatalog;
  readonly #engine: (bundleId: string) => string | null;
  readonly #env: () => Promise<NodeJS.ProcessEnv>;
  readonly #backend: string | null;
  readonly #threads: number;
  readonly #log: JobsLogger;
  readonly #cancelGraceMs: number;
  readonly #spawn: typeof spawn;
  readonly #active = new Set<ChildProcess>();
  #closed = false;

  constructor(options: LocalMusicProviderOptions) {
    this.#catalog = options.catalog;
    this.#engine = options.engine;
    this.#env = options.env;
    this.#backend = options.backend ?? null;
    this.#threads = options.threads ?? Math.max(1, Math.min(8, os.availableParallelism() - 2));
    this.#log = options.log ?? silentLog;
    this.#cancelGraceMs = options.cancelGraceMs ?? 5000;
    this.#spawn = options.spawn ?? spawn;
  }

  generate(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt> {
    return this.generateMusic(run, sink, signal);
  }

  /** One generation; `options.steps` is the reduced step count given by the self-check (formal submission is decided by frozen parameters). */
  async generateMusic(
    run: GenerationRun,
    sink: GenerationSink,
    signal: AbortSignal,
    options: { steps?: number | null } = {},
  ): Promise<GenerationAttempt> {
    const parameters = run.parameters;
    if (parameters.capability !== 'generateMusic') throw new ProviderFailure('protocol', L.notHandled({ capability: parameters.capability }));
    if (signal.aborted) return { outcome: 'cancelled' };
    if (this.#closed) throw new ProviderFailure('unavailable', L.runtimeStopping());
    const bundleId = run.modelId;
    const def = this.#catalog.definition(bundleId);
    if (!def?.music) throw new ProviderFailure('unavailable', L.musicNotMusicBundle({ bundleId }), { bundleId });
    const engine = this.#engine(bundleId);
    if (engine === null) throw new ProviderFailure('unavailable', L.musicEngineMissing(), { reason: 'not-installed', bundleId });
    if (this.#catalog.blocked(bundleId)) {
      const status = await this.#catalog.status(bundleId);
      throw new ProviderFailure('unavailable', L.bundleDisabled(), { reason: status?.reason ?? 'resource', state: status?.state });
    }
    const bundle = await this.#catalog.bundleFor(bundleId);
    const modelDir = bundle.components.music?.dir;
    if (!modelDir) throw new ProviderFailure('load-failed', L.musicNotMusicBundle({ bundleId }), { bundleId });
    const plan = musicEngineRunOf(parameters, def.music, {
      modelDir,
      staging: run.staging,
      threads: this.#threads,
      backend: this.#backend,
      steps: options.steps ?? null,
    });

    sink.generating();
    const exit = await this.#runEngine(engine, plan.args, run, signal);
    if (exit.cancelled) return { outcome: 'cancelled' };
    if (exit.code !== 0) {
      throw new ProviderFailure('crashed', L.musicEngineFailed({ code: exit.code === null ? String(exit.signal) : String(exit.code), tail: exit.tail }), {
        exitCode: exit.code,
        signal: exit.signal,
      });
    }
    const output = await this.#findOutput(run.staging, plan.output);
    if (output === null) throw new ProviderFailure('protocol', L.musicNoOutput(), { tail: exit.tail });
    const bytes = await fs.readFile(output);
    const wav = inspectWav(bytes);
    if (wav.ok && wav.wav.durationSec >= parameters.maxDurationSec * TRUNCATED_RATIO) {
      sink.warning?.(jobWarning('output-truncated', L.musicTruncated({ seconds: parameters.maxDurationSec })));
    }
    sink.progress(1, 1);
    return {
      outcome: 'completed',
      outputs: [{ path: path.relative(run.staging, output), sha256: await sha256File(output), byteLength: bytes.length, mediaType: 'audio/wav' }],
      workerVersion: `audiocpp_cli@${path.basename(engine)}`,
    };
  }

  async close(): Promise<void> {
    this.#closed = true;
    for (const child of this.#active) killProcessTree(child, 'SIGTERM');
  }

  /** The engine process: waits for it to exit; on a signal abort, ends the whole process group and waits for it to exit. */
  #runEngine(
    engine: string,
    args: string[],
    run: GenerationRun,
    signal: AbortSignal,
  ): Promise<{ cancelled: boolean; code: number | null; signal: NodeJS.Signals | null; tail: string }> {
    return new Promise(async (resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.#spawn(engine, args, {
          cwd: run.staging,
          env: await this.#env(),
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32',
          windowsHide: true,
        });
      } catch (error) {
        reject(new ProviderFailure('unavailable', L.musicEngineSpawnFailed({ reason: String(error) })));
        return;
      }
      this.#active.add(child);
      let tail = '';
      const collect = (chunk: Buffer) => {
        tail = (tail + chunk.toString('utf8')).slice(-STDERR_TAIL);
      };
      child.stderr?.on('data', collect);
      child.stdout?.on('data', collect);
      let cancelled = false;
      let killTimer: NodeJS.Timeout | null = null;
      const onAbort = () => {
        cancelled = true;
        killProcessTree(child, 'SIGTERM');
        killTimer = setTimeout(() => killProcessTree(child, 'SIGKILL'), this.#cancelGraceMs);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
      const done = () => {
        signal.removeEventListener('abort', onAbort);
        if (killTimer) clearTimeout(killTimer);
        this.#active.delete(child);
      };
      child.once('error', (error) => {
        done();
        reject(new ProviderFailure('unavailable', L.musicEngineSpawnFailed({ reason: error.message })));
      });
      child.once('exit', (code, sig) => {
        done();
        if (!cancelled && code !== 0) this.#log.warn('audio.cpp engine failed', { jobId: run.jobId, code, signal: sig, tail });
        resolve({ cancelled, code, signal: sig, tail: tail.trim() });
      });
    });
  }

  /** The agreed output file; if the engine renamed it by its own rules, falls back to any WAV in staging. */
  async #findOutput(staging: string, expected: string): Promise<string | null> {
    if (await exists(expected)) return expected;
    const entries = await fs.readdir(staging).catch(() => []);
    const wav = entries.filter((name) => name.toLowerCase().endsWith('.wav')).sort();
    if (wav.length === 0) return null;
    const found = path.join(staging, wav[0]!);
    const target = path.join(staging, MUSIC_OUTPUT_FILE);
    if (found !== target) {
      await fs.rename(found, target).catch(() => {});
      return (await exists(target)) ? target : found;
    }
    return found;
  }
}

async function exists(file: string): Promise<boolean> {
  return fs
    .stat(file)
    .then((s) => s.isFile())
    .catch(() => false);
}
