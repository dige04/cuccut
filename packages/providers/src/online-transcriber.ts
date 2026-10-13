import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ProviderFailure,
  type AsrResult,
  type AsrWarning,
  type TranscribeAttempt,
  type TranscribeProvider,
  type TranscribeRun,
  type TranscribeSink,
} from '@cuccut/models';
import type { AdapterConfig, AdapterHttp, TranscribeAdapter } from './adapter.ts';
import {
  CHUNK_FORMATS,
  RANGE_CLAMP_TOLERANCE_SEC,
  detectSilences,
  encodeChunk,
  extractAudio,
  type FfmpegResolver,
} from './audio/audio-prep.ts';
import { chunkLimitSec, planChunks } from './audio/chunk-plan.ts';
import { ProviderAborted, redact } from './http/provider-fetch.ts';
import type { CallReporter } from './usage-reporter.ts';
import { buildAsrResult, noAudioResult, type ChunkResult, type ResultContext } from './transcript.ts';
import { ProvidersConfig as PC, ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

/**
 * Transcription executor for online providers (architecture design §6.4): one instance per `providerId`.
 *
 * Decode (ffmpeg → the master in staging) → when over the single-request limit, slice at silences → submit chunks in order (progress by seconds) → map times back to the media clock,
 * and assemble `cuccut.asr-result/v1` and write it to staging. On cancel, in-flight HTTP requests and ffmpeg are aborted, and it resolves as `cancelled`.
 * Intermediate files (the master and the slices) are deleted when this attempt ends; staging itself is deleted by JobManager when the task finishes.
 */

export interface OnlineTranscriberOptions {
  providerId: string;
  label: string;
  adapter: TranscribeAdapter;
  /** Current configuration (including the key retrieved from the credential store); null when disabled or the key is missing; throws `ProviderFailure` when the credential store is unavailable. */
  config: () => Promise<AdapterConfig | null>;
  ffmpeg: FfmpegResolver;
  http?: AdapterHttp;
  /** Report at the end of a call (usage ledger and account status, §6.10): one entry per attempt, with the slices combined; usage is the number of seconds transcribed. */
  report?: CallReporter;
}

interface CallState {
  sent: { accountId: string | null; startedAt: number } | null;
  audioSeconds: number;
}

const WORK_DIR = 'online';
const RESULT_FILE = 'result.json';
/** Decoded audio shorter than this length is not submitted; the result is directly `no-speech`. */
const MIN_AUDIO_SEC = 0.05;

export class OnlineTranscriber implements TranscribeProvider {
  readonly id: string;
  readonly #options: OnlineTranscriberOptions;
  readonly #inflight = new Set<AbortController>();

  constructor(options: OnlineTranscriberOptions) {
    this.#options = options;
    this.id = options.providerId;
  }

  async transcribe(run: TranscribeRun, sink: TranscribeSink, signal: AbortSignal): Promise<TranscribeAttempt> {
    const { adapter } = this.#options;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) controller.abort();
    this.#inflight.add(controller);
    const work = path.join(run.staging, WORK_DIR);
    // The key used for this attempt: on error, it is used to strip the key from the error text, rather than fetching it again in the error handling.
    let secret: string | null = null;
    const call: CallState = { sent: null, audioSeconds: 0 };
    const report = (error?: unknown) => {
      if (!call.sent || !this.#options.report || !run.modelId) return;
      this.#options.report({
        capability: 'transcribe',
        modelId: run.modelId,
        source: 'job',
        ref: { jobId: run.jobId },
        accountId: call.sent.accountId,
        startedAt: call.sent.startedAt,
        units: { audioSeconds: Math.round(call.audioSeconds * 1000) / 1000 },
        ...(error !== undefined ? { error } : {}),
      });
    };
    try {
      const config = await this.#options.config();
      if (!config) throw new ProviderFailure('unavailable', PC.notEnabledOrNoKey({ label: this.#options.label }).text, { providerId: this.id });
      secret = config.credential;
      const result = await this.#run(run, sink, controller.signal, work, config, call);
      report();
      const bytes = Buffer.from(`${JSON.stringify(result)}\n`, 'utf8');
      await fs.writeFile(path.join(run.staging, RESULT_FILE), bytes);
      return {
        outcome: 'completed',
        output: { path: RESULT_FILE, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length },
        workerVersion: adapter.version,
      };
    } catch (error) {
      if (controller.signal.aborted || error instanceof ProviderAborted) return { outcome: 'cancelled', workerVersion: adapter.version };
      if (error instanceof ProviderFailure) {
        report(error);
        throw error;
      }
      // Unexpected error: the text may come from the provider's response, so strip the key before reporting.
      const message = error instanceof Error ? error.message : String(error);
      const failure = new ProviderFailure('protocol', redact(PC.transcribeFailed({ label: this.#options.label, message }).text, secret ? [secret] : []));
      report(failure);
      throw failure;
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.#inflight.delete(controller);
      await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    }
  }

  async #run(
    run: TranscribeRun,
    sink: TranscribeSink,
    signal: AbortSignal,
    work: string,
    config: AdapterConfig,
    call: CallState,
  ): Promise<AsrResult> {
    const { adapter, label, ffmpeg } = this.#options;
    const modelId = run.modelId;
    const model = adapter.models(config).find((m) => m.modelId === modelId);
    if (!modelId || !model)
      throw new ProviderFailure('unavailable', PC.noModel({ label, model: modelId ?? PC.modelUnspecified() }).text, { providerId: this.id });

    const timescale = run.options.timescale;
    const range = run.input.range;
    const offsetSec = range ? range.start / range.timescale : 0;
    const requestedSec = range ? (range.end - range.start) / range.timescale : null;
    const context: ResultContext = {
      providerId: this.id,
      modelId,
      workerVersion: adapter.version,
      contentHash: run.input.contentHash,
      runGeneration: run.runGeneration,
      timescale,
      language: run.options.language,
      offsetSec,
    };

    sink.phase('decoding');
    const master = path.join(work, 'master.wav');
    const extracted = await extractAudio({
      ffmpeg,
      file: run.input.file,
      track: run.input.track,
      ...(range ? { range: { startSec: offsetSec, durationSec: requestedSec } } : {}),
      out: master,
      signal,
    });
    if (extracted === 'no-audio-track') {
      sink.phase('finalizing');
      return noAudioResult(context);
    }
    const decodedSec = extracted.durationSec;
    const warnings: AsrWarning[] = [];
    if (requestedSec !== null && requestedSec - decodedSec > RANGE_CLAMP_TOLERANCE_SEC) {
      const warning: AsrWarning = {
        code: 'range-clamped',
        detail: PH.rangeClamped({ decoded: decodedSec.toFixed(3), requested: requestedSec.toFixed(3) }).text,
      };
      warnings.push(warning);
      sink.warning(warning);
    }
    if (decodedSec < MIN_AUDIO_SEC) {
      sink.phase('finalizing');
      return buildAsrResult({ chunks: [], context, decodedSec, warnings });
    }

    const format = adapter.chunkFormat(model);
    const spec = CHUNK_FORMATS[format];
    const maxChunkSec = chunkLimitSec({
      maxDurationSec: model.maxDurationSec,
      maxInputBytes: model.maxInputBytes,
      bytesPerSec: spec.bytesPerSec,
      overheadBytes: spec.overheadBytes,
      preferredSec: adapter.preferredChunkSec(model),
    });
    const silences = decodedSec > maxChunkSec ? await detectSilences({ ffmpeg, master, durationSec: decodedSec, signal }) : [];
    const plan = Number.isFinite(maxChunkSec)
      ? planChunks({ durationSec: decodedSec, maxChunkSec, silences })
      : [{ start: 0, end: decodedSec }];

    sink.phase('transcribing');
    sink.progress({ phase: 'transcribing', done: 0, total: round(decodedSec), unit: 'seconds' });
    const chunks: ChunkResult[] = [];
    let languageReported = false;
    for (const [index, planned] of plan.entries()) {
      const encoded = await encodeChunk({
        ffmpeg,
        master,
        startSec: planned.start,
        endSec: planned.end,
        format,
        out: path.join(work, `chunk-${String(index).padStart(4, '0')}.${spec.extension}`),
        signal,
      });
      call.sent ??= { accountId: config.accountId ?? null, startedAt: Date.now() };
      const transcript = await adapter.transcribeChunk({
        config,
        model,
        file: encoded.path,
        byteLength: encoded.byteLength,
        format,
        durationSec: planned.end - planned.start,
        language: run.options.language,
        ...(run.options.hint ? { hint: run.options.hint } : {}),
        signal,
        http: this.#options.http ?? {},
      });
      call.audioSeconds += planned.end - planned.start;
      await fs.rm(encoded.path, { force: true });
      chunks.push({ startSec: planned.start, endSec: planned.end, transcript });
      if (!languageReported && transcript.language && run.options.language.mode !== 'assert') {
        languageReported = true;
        sink.language(transcript.language, null);
      }
      sink.progress({ phase: 'transcribing', done: round(planned.end), total: round(decodedSec), unit: 'seconds' });
    }

    sink.phase('finalizing');
    const result = buildAsrResult({ chunks, context, decodedSec, warnings });
    for (const segment of result.segments) sink.segment(segment);
    return result;
  }

  /** Stop: aborts all in-flight requests. */
  async close(): Promise<void> {
    for (const controller of this.#inflight) controller.abort();
  }
}

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}
