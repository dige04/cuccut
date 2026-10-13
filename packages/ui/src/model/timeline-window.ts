/**
 * The timeline draws only the visible part (horizontal clipping). There are few tracks but the time span is long, and one track can hold thousands of items (clips from talking-head cuts, one dub block per sentence); drawing everything would stall opening and zooming for seconds. This only computes which items on a track intersect the time window, and which ticks of the ruler fall inside the time window. It does not touch React or the DOM.
 *
 * The time window can use any unit (frames or seconds), as long as it matches what `span` gives.
 */

/** The start and end of an item on the timeline (`start ≤ end`). */
export interface Span {
  start: number;
  end: number;
}

/**
 * A track sorted by start: `starts` is ascending; `reach[k]` is the latest end among the first k+1 items after sorting (non-decreasing). It is used to skip the long run to the left of the window that has already ended, and a long clip that starts left of the window but extends into it is not missed.
 */
export interface SpanIndex<T> {
  /** Sort by start (items with the same start keep their original order). */
  sorted: readonly T[];
  starts: Float64Array;
  ends: Float64Array;
  reach: Float64Array;
  /** Each item’s index in the original list. Results are sorted back by it: for overlapping items on the same track, DOM order decides which one is on top. */
  order: ReadonlyMap<T, number>;
}

export function spanIndex<T>(items: readonly T[], span: (item: T) => Span): SpanIndex<T> {
  const entries = items.map((item, k) => ({ item, k, ...span(item) }));
  entries.sort((a, b) => a.start - b.start || a.k - b.k);
  const n = entries.length;
  const starts = new Float64Array(n);
  const ends = new Float64Array(n);
  const reach = new Float64Array(n);
  let far = -Infinity;
  entries.forEach((entry, i) => {
    starts[i] = entry.start;
    ends[i] = entry.end;
    far = Math.max(far, entry.end);
    reach[i] = far;
  });
  return { sorted: entries.map((e) => e.item), starts, ends, reach, order: new Map(entries.map((e) => [e.item, e.k])) };
}

/** The first index that satisfies `pred` (`pred` is false then true across the array); the length if none does. */
function firstWhere(values: Float64Array, pred: (value: number) => boolean): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pred(values[mid]!)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/**
 * Items that intersect the time window `[from, to]` (touching the edge counts: `start ≤ to` and `end ≥ from`), plus the items on this track from `extra` (the ones being dragged, the one whose menu is open, …), which must be drawn whether or not they are in the window. Deduplicated, returned in original order.
 */
export function spansIn<T>(index: SpanIndex<T>, from: number, to: number, extra: Iterable<T> = []): T[] {
  const { sorted, starts, ends, reach, order } = index;
  const hi = firstWhere(starts, (start) => start > to);
  const lo = firstWhere(reach, (end) => end >= from);
  const picked = new Set<T>();
  for (let i = lo; i < hi; i++) if (ends[i]! >= from) picked.add(sorted[i]!);
  for (const item of extra) if (order.has(item)) picked.add(item);
  return [...picked].sort((a, b) => order.get(a)! - order.get(b)!);
}

export interface RulerTick {
  seconds: number;
  major: boolean;
}

/**
 * The ticks of the ruler within `[from, to]` seconds. The left side also includes one tick before `from`; at most `limit` ticks, none past `end` seconds. Tick i is always at `i × minor` seconds, identical to the same tick on the whole ruler drawn from 0 (keys and labels unchanged); while scrolling, ticks are only added or removed at the two ends.
 */
export function rulerTicks({
  minor,
  major,
  from,
  to,
  end,
  limit = 4000,
}: {
  minor: number;
  major: number;
  from: number;
  to: number;
  end: number;
  limit?: number;
}): RulerTick[] {
  const ticks: RulerTick[] = [];
  if (!(minor > 0)) return ticks;
  const last = Math.min(to, end);
  for (let i = Math.max(0, Math.floor(from / minor)); i * minor <= last && ticks.length < limit; i++) {
    const seconds = i * minor;
    ticks.push({ seconds, major: Math.abs(seconds / major - Math.round(seconds / major)) < 1e-6 });
  }
  return ticks;
}
