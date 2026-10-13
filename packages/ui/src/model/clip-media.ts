import { mediaTimeToSeconds, type TimeMap } from '@cuccut/protocol';

/**
 * The filmstrip and waveform inside video clips on the timeline (same as `ElementMedia` / `WaveCanvas` in the older web timeline):
 * x-coordinate in the clip → sequence time → source time in the media via the instance's `timeMap`, then the frame and audio peak at that time are fetched.
 */

/** Width of one filmstrip cell (px). Cells are laid out starting from the clip's left edge. */
export const TILE_WIDTH = 64;

/**
 * Conversion from sequence time to source time. Linear mapping: `sourceIn + (t − contentStart) × rate`, where `contentStart` is the sequence time at which the instance's content starts
 * (it moves with the clip when dragged, and stays put when the start is trimmed). Freeze frame: always `sourceAt`.
 */
export type SourceClock = { kind: 'linear'; contentStart: number; sourceIn: number; rate: number } | { kind: 'hold'; sourceAt: number };

export function sourceClock(timeMap: TimeMap, contentStart: number): SourceClock {
  if (timeMap.kind === 'hold') return { kind: 'hold', sourceAt: mediaTimeToSeconds(timeMap.sourceAt) };
  return { kind: 'linear', contentStart, sourceIn: mediaTimeToSeconds(timeMap.sourceIn), rate: timeMap.rate.num / timeMap.rate.den };
}

/** Source time (seconds) in the media for a sequence time (seconds). */
export function sourceSecondsAt(clock: SourceClock, seconds: number): number {
  return clock.kind === 'hold' ? clock.sourceAt : clock.sourceIn + (seconds - clock.contentStart) * clock.rate;
}

/** Visible cells in the clip `[first, end)`. `clipLeft` and `view` are both x-coordinates within the track content. */
export function visibleTiles(
  clipLeft: number,
  clipWidth: number,
  view: { left: number; right: number },
  tileWidth = TILE_WIDTH,
): [number, number] {
  const count = Math.ceil(clipWidth / tileWidth);
  const first = Math.min(count, Math.max(0, Math.floor((view.left - clipLeft) / tileWidth)));
  const end = Math.min(count, Math.ceil((view.right - clipLeft) / tileWidth));
  return [first, Math.max(first, end)];
}

const GRID = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/**
 * Granularity of frame lookup: the largest step that does not exceed the source duration one cell covers. Adjacent cells get different frames; after zooming, times that land on the same step can still reuse the cache.
 */
export function thumbnailGrid(tileSourceSeconds: number): number {
  let step = GRID[0]!;
  for (const value of GRID) if (value <= tileSourceSeconds) step = value;
  return tileSourceSeconds >= 1200 ? Math.floor(tileSourceSeconds / 600) * 600 : step;
}

export interface FilmstripTile {
  index: number;
  /** Relative to the clip's left edge. */
  left: number;
  width: number;
  /** Source time (seconds) for the frame lookup, already rounded to the granularity. */
  at: number;
}

/** Filmstrip cells to draw: only visible ones are computed. Each cell takes the frame at its left edge. */
export function filmstripTiles(options: {
  clipLeft: number;
  clipWidth: number;
  /** Sequence time (seconds) at the clip's left edge. */
  clipStart: number;
  pxPerSecond: number;
  clock: SourceClock;
  /** Media duration (seconds); unlimited when unknown. */
  sourceDuration: number | null;
  view: { left: number; right: number };
  tileWidth?: number;
}): FilmstripTile[] {
  const { clipLeft, clipWidth, clipStart, pxPerSecond, clock, sourceDuration, view } = options;
  const tileWidth = options.tileWidth ?? TILE_WIDTH;
  const [first, end] = visibleTiles(clipLeft, clipWidth, view, tileWidth);
  // Every cell of a freeze frame is the same frame, so no rounding is needed.
  const grid = clock.kind === 'linear' ? thumbnailGrid((tileWidth / pxPerSecond) * clock.rate) : 0;
  const tiles: FilmstripTile[] = [];
  for (let index = first; index < end; index++) {
    const left = index * tileWidth;
    const source = sourceSecondsAt(clock, clipStart + left / pxPerSecond);
    let at = grid ? Math.round(source / grid) * grid : source;
    if (sourceDuration !== null) at = Math.min(at, sourceDuration);
    tiles.push({ index, left, width: Math.min(tileWidth, clipWidth - left), at: Math.max(0, Math.round(at * 1000) / 1000) });
  }
  return tiles;
}

/** base64 of `media.peaks` → one byte per cell. */
export function decodePeaks(base64: string): Uint8Array {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

/** When normalising, the 98th percentile is taken as at least this large (about −24 dBFS), so near-silent media does not amplify the noise floor to full scale. */
const SCALE_FLOOR = 16;

/**
 * Display gain: normalised to the 98th percentile, so individual loud spikes do not flatten the whole envelope (same as the older BCW1).
 * The peak values themselves are not normalised, so quiet media does not render too flat.
 */
export function peakScale(peaks: Uint8Array): number {
  if (peaks.length === 0) return 1;
  const counts = new Uint32Array(256);
  for (const level of peaks) counts[level]!++;
  const rank = Math.floor((peaks.length - 1) * 0.98);
  let seen = 0;
  for (let level = 0; level < 256; level++) {
    seen += counts[level]!;
    if (seen > rank) return 255 / Math.max(level, SCALE_FLOOR);
  }
  return 1;
}

/** Largest peak (0–255) within a source time range `[s0, s1)`. */
export function peakIn(peaks: Uint8Array, binsPerSecond: number, s0: number, s1: number): number {
  const from = Math.max(0, Math.floor(Math.min(s0, s1) * binsPerSecond));
  const to = Math.min(peaks.length, Math.max(from + 1, Math.ceil(Math.max(s0, s1) * binsPerSecond)));
  let max = 0;
  for (let i = from; i < to; i++) if (peaks[i]! > max) max = peaks[i]!;
  return max;
}

/**
 * Waveform envelope: the canvas starts at `canvasLeft` in the track content and is `width` wide, with one point every `step` pixels; returns the amplitude of each point (0–1, already multiplied by `scale`).
 * A freeze frame has no sound, so it returns empty.
 */
export function waveEnvelope(options: {
  canvasLeft: number;
  width: number;
  step: number;
  clipLeft: number;
  clipStart: number;
  pxPerSecond: number;
  clock: SourceClock;
  peaks: Uint8Array;
  binsPerSecond: number;
  scale: number;
}): number[] {
  const { canvasLeft, width, step, clipLeft, clipStart, pxPerSecond, clock, peaks, binsPerSecond, scale } = options;
  if (clock.kind === 'hold' || width <= 0) return [];
  const points: number[] = [];
  for (let k = 0, n = Math.ceil(width / step); k <= n; k++) {
    const x = canvasLeft + Math.min(width, k * step);
    const t0 = clipStart + (x - clipLeft) / pxPerSecond;
    const s0 = sourceSecondsAt(clock, t0);
    const s1 = sourceSecondsAt(clock, t0 + step / pxPerSecond);
    points.push(Math.min(1, (peakIn(peaks, binsPerSecond, s0, s1) / 255) * scale));
  }
  return points;
}
