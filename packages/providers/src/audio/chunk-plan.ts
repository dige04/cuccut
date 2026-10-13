/**
 * Chunk plan (architecture design §6.4): audio longer than the single-request cap is cut into several chunks that are submitted in turn, with boundaries falling at silence where possible. It is a pure function, and the units are seconds.
 *
 * Rule: from the current position, look for silence in the window [position + cap·50%, position + cap]. For silence that intersects the window, take its midpoint (clamped into the window), and choose the latest one as the cut point. If there is no silence in the window, hard cut at the window's end. The window's end must also leave at least `minChunkSec` for the remainder, so that the last chunk is not just a fraction of a second. When the remainder is not over the cap, it is the last chunk.
 */

export interface Silence {
  start: number;
  end: number;
}

export interface PlannedChunk {
  start: number;
  end: number;
}

export interface ChunkPlanInput {
  durationSec: number;
  /** The cap per chunk (already including the margin). */
  maxChunkSec: number;
  silences: readonly Silence[];
  /** The minimum length of the last chunk. Default min(1 second, 1/4 of the cap). */
  minChunkSec?: number;
}

/** The window starts at this proportion of the cap. */
const WINDOW_FROM = 0.5;

export function planChunks(input: ChunkPlanInput): PlannedChunk[] {
  const duration = Math.max(0, input.durationSec);
  const max = input.maxChunkSec;
  if (!(max > 0) || !Number.isFinite(max)) throw new Error('maxChunkSec must be a positive number');
  if (duration <= max) return [{ start: 0, end: duration }];
  const minTail = Math.min(input.minChunkSec ?? Math.min(1, max / 4), max / 2);
  const silences = input.silences
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const chunks: PlannedChunk[] = [];
  let cursor = 0;
  while (duration - cursor > max) {
    const windowEnd = Math.min(cursor + max, duration - minTail);
    const windowStart = Math.min(cursor + max * WINDOW_FROM, windowEnd);
    let cut = windowEnd;
    let found = -1;
    for (const silence of silences) {
      if (silence.end < windowStart || silence.start > windowEnd) continue;
      const point = clamp((silence.start + silence.end) / 2, windowStart, windowEnd);
      if (point > found) found = point;
    }
    if (found > cursor) cut = found;
    chunks.push({ start: cursor, end: cut });
    cursor = cut;
  }
  chunks.push({ start: cursor, end: duration });
  return chunks;
}

/**
 * The duration cap per chunk: the smaller of the single request's duration cap and its byte cap (converted from the worst-case bytes per second of this encoding), multiplied by a margin.
 * A shorter preferred length may also be given. For example, models that do not return times get shorter chunks, so that interpolated word times are not too coarse.
 */
export function chunkLimitSec(input: {
  maxDurationSec: number | null;
  maxInputBytes: number | null;
  bytesPerSec: number;
  /** Fixed overhead such as the container header. */
  overheadBytes?: number;
  preferredSec?: number | null;
  margin?: number;
}): number {
  const margin = input.margin ?? 0.9;
  const limits: number[] = [];
  if (input.maxDurationSec !== null && input.maxDurationSec > 0) limits.push(input.maxDurationSec * margin);
  if (input.maxInputBytes !== null && input.maxInputBytes > 0) {
    limits.push(Math.max(1, (input.maxInputBytes - (input.overheadBytes ?? 0)) / input.bytesPerSec) * margin);
  }
  if (input.preferredSec) limits.push(input.preferredSec);
  return limits.length > 0 ? Math.min(...limits) : Number.POSITIVE_INFINITY;
}

/** Parses the lines that ffmpeg `silencedetect` writes to stderr. A silence that is never closed extends to `durationSec`. */
export function parseSilences(stderr: string, durationSec: number): Silence[] {
  const silences: Silence[] = [];
  let open: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (start) {
      open = Math.max(0, Number(start[1]));
      continue;
    }
    const end = /silence_end:\s*([\d.]+)/.exec(line);
    if (end && open !== null) {
      silences.push({ start: open, end: Number(end[1]) });
      open = null;
    }
  }
  if (open !== null && open < durationSec) silences.push({ start: open, end: durationSec });
  return silences.filter((s) => s.end > s.start);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
