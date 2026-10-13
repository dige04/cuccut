/**
 * Time alignment for dubbing (video format spec §7.3 `fit-fixed-slot`; architecture design §7.9): fits one dubbed sentence into the sentence's time window on the sequence. Pure function: the same input always gives the same result. All seconds are sequence time.
 *
 * Rules, in order:
 * 1. Not longer than the window: placed from the original sentence's start, no speed change.
 * 2. Longer than the window: speed up as needed (ffmpeg `atempo`, which keeps the pitch). The factor is rounded up to the thousandth and is at most `maxTempo` (default 1.25).
 * 3. Still does not fit after speeding up to the limit: it may use the silence after this sentence, before the next one.
 * 4. Still does not fit: `overlong`. It is not placed on the timeline, and the overflow is reported honestly. It is never truncated, and never pressed into the next sentence.
 *
 * When the start of the next sentence (`limit`) is earlier than this sentence's end (the two sentences overlap), the window only runs to the start of the next sentence.
 */

export const MAX_DUB_TEMPO = 1.25;
/** Comparison tolerance (seconds): floating-point error must not turn a sentence that just fits into one that does not. */
const EPSILON = 1e-6;

export type DubFit = 'fit' | 'tempo' | 'extended' | 'overlong';

export interface DubSlot {
  /** Start and end of the original sentence on the sequence. */
  start: number;
  end: number;
  /** The position that may not be crossed: the start of the next sentence, or the end of the sequence if there is no next sentence (not earlier than this sentence's end). */
  limit: number;
}

export interface DubAlignment {
  fit: DubFit;
  /** Where it is placed (always the start of the original sentence). */
  start: number;
  /** Speed factor; 1 means no speed change. */
  tempo: number;
  /** Duration after the speed change. */
  duration: number;
  end: number;
  /** For `overlong`, how many seconds it exceeds `limit` by; otherwise 0. */
  overflow: number;
}

/** Fits one dubbed sentence (the real synthesized duration `duration` in seconds) into the time window `slot`. */
export function alignDub(slot: DubSlot, duration: number, maxTempo: number = MAX_DUB_TEMPO): DubAlignment {
  if (!(duration > 0) || !Number.isFinite(duration)) throw new RangeError('The voice-over duration must be positive');
  if (!(maxTempo >= 1) || !Number.isFinite(maxTempo)) throw new RangeError('maxTempo must be at least 1');
  if (!(slot.end >= slot.start)) throw new RangeError('The slot end must not be before its start');
  const start = slot.start;
  const end = Math.min(slot.end, Math.max(slot.limit, start));
  const limit = Math.max(slot.limit, start);
  const window = end - start;
  const placed = (fit: DubFit, tempo: number): DubAlignment => {
    const length = tempo === 1 ? duration : duration / tempo;
    return { fit, start, tempo, duration: length, end: start + length, overflow: 0 };
  };

  if (duration <= window + EPSILON) return placed('fit', 1);
  if (window > 0) {
    const tempo = Math.min(maxTempo, ceilTo(duration / window, 3));
    if (duration / tempo <= window + EPSILON) return placed('tempo', tempo);
  }
  const fastest = duration / maxTempo;
  if (start + fastest <= limit + EPSILON) return placed('extended', maxTempo);
  return { fit: 'overlong', start, tempo: maxTempo, duration: fastest, end: start + fastest, overflow: start + fastest - limit };
}

function ceilTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  // Strip floating-point noise before rounding up: 1.2 / 1 must not become 1.201.
  return Math.ceil(Math.round(value * scale * 1e6) / 1e6) / scale;
}

/** Writes the `atempo` factor as an ffmpeg filter argument (a single atempo accepts 0.5–100; here it is always 1–1.25). */
export function atempoFilter(tempo: number): string {
  return `atempo=${tempo.toFixed(3)}`;
}
