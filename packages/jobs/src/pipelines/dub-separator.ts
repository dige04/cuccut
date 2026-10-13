import path from 'node:path';
import { ProviderFailure, sha256File } from '@cuccut/models';
import { JobsDubSeparator as J } from '@cuccut/protocol/messages/jobs/dub-separator.ts';
import type { LocalSeparateOutcome, LocalSeparateRun } from '../local-provider.ts';
import type { DubSeparator } from './dub.ts';
import { probeMedia, runFfmpeg, type MediaToolResolver } from './ffmpeg.ts';
import { errorText } from '../job-text.ts';
import { PipelineStepError } from './pipeline.ts';

/** Tolerance between the separation output's duration and the input's (same as `stemProblems`: one audio frame, 20 ms). */
const DURATION_TOLERANCE_SEC = 0.02;
/** Output sample rate accepted by the Model Worker (Model Worker protocol spec §2.5.4). */
const MIN_SAMPLE_RATE = 8_000;
const MAX_SAMPLE_RATE = 192_000;

export interface LocalDubSeparatorOptions {
  provider: { separate(run: LocalSeparateRun, signal: AbortSignal): Promise<LocalSeparateOutcome> };
  /** The local model pack that runs the separation. */
  bundleId: string;
  /** Weight file size (bytes) that its Model Worker loads; null if unknown. */
  workerWeightBytes?: number | null;
  ffmpeg: MediaToolResolver;
  ffprobe: MediaToolResolver;
}

/**
 * Separating vocals from background for a dubbed translation (architecture design §6.1 `separateAudio`, §7.9) is run by the local separation model pack. The first audio track of the asset is passed whole to the Model Worker (`separate` in `job.run`), and the output sample rate is taken from the input track. The Worker writes its output to the track's length. When the container duration (ffprobe's `format.duration`, which `stemProblems` compares against) differs from the track by more than the tolerance, both outputs are padded with silence or truncated to the container duration with ffmpeg.
 */
export function localDubSeparator(options: LocalDubSeparatorOptions): DubSeparator {
  const { provider, bundleId, ffmpeg, ffprobe } = options;
  return {
    providerId: 'local',
    modelId: bundleId,
    workerWeightBytes: options.workerWeightBytes ?? null,
    async separate({ file, staging, jobId, signal }) {
      const input = await probeMedia(ffprobe, file, signal);
      if (!input.audio) throw new PipelineStepError('INPUT_UNREADABLE', J.noAudio(), { file });
      const rate = input.audio.sampleRate;
      const sampleRate = rate >= MIN_SAMPLE_RATE && rate <= MAX_SAMPLE_RATE ? rate : null;
      const hex = await sha256File(file).catch(() => null);
      if (hex === null) throw new PipelineStepError('INPUT_UNREADABLE', J.unreadable(), { file });
      let outcome: LocalSeparateOutcome;
      try {
        outcome = await provider.separate(
          { bundleId, jobId, input: { file, contentHash: `sha256:${hex}`, track: 0 }, sampleRate, staging },
          signal,
        );
      } catch (error) {
        throw providerStepError(error);
      }
      if (outcome.outcome === 'cancelled') throw signal.reason ?? new DOMException('aborted', 'AbortError');
      const stems = { vocals: outcome.vocals, background: outcome.background };
      const durationSec = outcome.result.audio?.durationSec ?? null;
      if (durationSec === null || Math.abs(durationSec - input.durationSec) <= DURATION_TOLERANCE_SEC) return stems;
      return {
        vocals: await fitDuration(ffmpeg, stems.vocals, input.durationSec, signal),
        background: await fitDuration(ffmpeg, stems.background, input.durationSec, signal),
      };
    },
  };
}

/** Pads with silence or truncates to `seconds` seconds, written next to the original file (`<name>.fit.wav`). The format is unchanged (16-bit PCM WAV). */
async function fitDuration(ffmpeg: MediaToolResolver, file: string, seconds: number, signal: AbortSignal): Promise<string> {
  const out = path.join(path.dirname(file), `${path.basename(file, '.wav')}.fit.wav`);
  const args = ['-y', '-v', 'error', '-progress', 'pipe:1', '-nostats', '-i', `file:${file}`];
  args.push('-af', 'apad', '-t', seconds.toFixed(6), '-c:a', 'pcm_s16le', `file:${out}`);
  await runFfmpeg(ffmpeg, args, { signal });
  return out;
}

/** Provider failure → this step's error code (same mapping as for the transcription and generation tasks; the speaker-distinguishing step uses it too). */
export function providerStepError(error: unknown): unknown {
  if (!(error instanceof ProviderFailure)) return error;
  const details = { ...error.details, providerId: 'local' };
  // When the vendor error carries a message reference, record it too.
  const message = errorText(error);
  switch (error.kind) {
    case 'crashed':
    case 'version-changed':
      return new PipelineStepError('MODEL_WORKER_CRASHED', message, details);
    case 'load-failed':
    case 'unavailable':
      return new PipelineStepError('MODEL_LOAD_FAILED', message, details);
    case 'input-unreadable':
      return new PipelineStepError('INPUT_UNREADABLE', message, details);
    case 'output-unwritable':
      return new PipelineStepError('STAGING_WRITE_FAILED', message, details);
    case 'protocol':
      return new PipelineStepError('MODEL_OUTPUT_INVALID', message, details);
    default:
      return new PipelineStepError('INTERNAL', message, details);
  }
}
