import type { JobRecord } from '@cuccut/protocol';

/**
 * Export speed and estimated time remaining (product design §8.3): the Runtime does not report speed, so the UI works it out from the job record. Each `job.updated` carries the progress number and the moment the Runtime recorded it
 * (`updatedAt`, in milliseconds); speed is computed from the earliest and latest of the samples within the last few seconds, and dividing the remaining amount by the speed gives the remaining time.
 *
 * - Only progress with a total during the rendering stage (`generating`: frame rendering for a final video, audio mixing, ...) is counted; nothing is written while fonts download or files are saved. When the unit or total changes,
 *   or the number goes backwards (a retry starts over), samples start over.
 * - With less than a second of samples, or no progress in that span, speed cannot be computed: it returns null and the UI writes nothing — nothing is fabricated.
 */

/** One progress sample: the moment the Runtime recorded it (milliseconds) and the amount completed. */
export interface SpeedSample {
  at: number;
  done: number;
}

/** Samples for one export during the rendering stage; `key` is the progress unit and total; when either changes, samples start over. */
export interface SpeedTrack {
  key: string;
  samples: readonly SpeedSample[];
}

export interface ExportSpeed {
  /** Amount completed per second (in the progress unit: frames, seconds, bytes, ...). */
  rate: number;
  /** fps when the progress unit is frames; null for other units. */
  fps: number | null;
  /** Estimated seconds still to go. */
  secondsLeft: number;
}

/** The speed is measured over this recent window (milliseconds): long enough to smooth out jitter in single samples, yet still tracking changes in encoding speed. */
export const SPEED_WINDOW_MS = 5000;
/** Speed is not computed while the samples span less than this long (milliseconds). */
const MIN_SPAN_MS = 1000;

function trackKey(job: Pick<JobRecord, 'kind' | 'state' | 'phase' | 'progress'>): string | null {
  const p = job.progress;
  if (job.kind !== 'export' || job.state !== 'running' || job.phase !== 'generating' || !p || p.total == null || p.total <= 0) return null;
  return `${p.unit}|${p.total}`;
}

/** Updates its samples with a new job record; for an export that is not rendering or has no total, returns undefined (old samples are dropped). */
export function trackSpeed(prev: SpeedTrack | undefined, job: Pick<JobRecord, 'kind' | 'state' | 'phase' | 'progress' | 'updatedAt'>): SpeedTrack | undefined {
  const key = trackKey(job);
  const at = Date.parse(job.updatedAt);
  if (!key || !Number.isFinite(at)) return undefined;
  const sample = { at, done: job.progress!.done };
  const last = prev?.key === key ? prev.samples[prev.samples.length - 1] : undefined;
  if (!last || sample.done < last.done || sample.at < last.at) return { key, samples: [sample] };
  if (sample.at === last.at && sample.done === last.done) return prev;
  const samples = [...prev!.samples, sample];
  // Keep the last sample before the window's start, so the speed is always computed over the full window.
  while (samples.length > 2 && samples[1]!.at <= at - SPEED_WINDOW_MS) samples.shift();
  return { key, samples };
}

/** Computes speed and remaining time from the samples; null when it cannot be computed. */
export function exportSpeed(track: SpeedTrack | undefined, job: Pick<JobRecord, 'kind' | 'state' | 'phase' | 'progress'>): ExportSpeed | null {
  const key = trackKey(job);
  if (!track || !key || track.key !== key) return null;
  const first = track.samples[0]!;
  const last = track.samples[track.samples.length - 1]!;
  const span = last.at - first.at;
  if (span < MIN_SPAN_MS || last.done <= first.done) return null;
  const rate = ((last.done - first.done) * 1000) / span;
  const p = job.progress!;
  return {
    rate,
    fps: p.unit === 'frames' ? rate : null,
    secondsLeft: Math.max(0, (p.total! - p.done) / rate),
  };
}
