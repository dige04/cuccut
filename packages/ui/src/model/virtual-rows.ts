/**
 * A vertical virtual list with variable row heights (subtitles and translation lists with thousands of entries). Row heights are estimated first and replaced by measured heights once measured. Only dozens of rows around the viewport are mounted, plus pinned rows
 * (the one being edited, the focused one, search matches). The rest are folded into blank spacers. All of this is pure functions; the React layer is in components/editor/use-virtual-rows.ts.
 * The precedent for fixed heights is font-list-window.ts, the font-list dropdown.
 */

export type Align = 'start' | 'center' | 'end' | 'nearest';

/** `offsets[i]` is the top edge of row i; `offsets[n]` is `total` (so the length is the row count plus 1). */
export interface RowLayout {
  offsets: Float64Array;
  total: number;
}

/** A segment: a blank segment gives a height (for a run of rows not mounted); a row segment gives indices. DOM order = index order. */
export type RowSegment = { gap: number } | { index: number };

/** Lays out once: measured rows use their measured heights; unmeasured rows use the estimate. */
export function layoutRows(keys: readonly string[], measured: ReadonlyMap<string, number>, estimate: (index: number) => number): RowLayout {
  const offsets = new Float64Array(keys.length + 1);
  let top = 0;
  for (let i = 0; i < keys.length; i++) {
    offsets[i] = top;
    top += measured.get(keys[i]!) ?? estimate(i);
  }
  offsets[keys.length] = top;
  return { offsets, total: top };
}

export const rowCount = (layout: RowLayout) => layout.offsets.length - 1;
export const rowHeight = (layout: RowLayout, index: number) => layout.offsets[index + 1]! - layout.offsets[index]!;

/** Which row `y` falls in (binary search; the top edge belongs to that row; out-of-range values are clamped to the ends). An empty list gives -1. */
export function rowAt(layout: RowLayout, y: number): number {
  const n = rowCount(layout);
  if (n <= 0) return -1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (layout.offsets[mid]! <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The rows to mount, [start, end): the rows that intersect [scrollTop − overscan, scrollTop + viewport + overscan). */
export function rowRange(layout: RowLayout, scrollTop: number, viewport: number, overscanPx: number): [number, number] {
  const n = rowCount(layout);
  if (n <= 0) return [0, 0];
  const top = Math.max(0, scrollTop - overscanPx);
  const bottom = scrollTop + Math.max(0, viewport) + overscanPx;
  let start = rowAt(layout, top);
  // The top edge falls exactly on the bottom edge of the previous row: that row no longer intersects.
  if (start < n - 1 && layout.offsets[start + 1]! <= top) start++;
  let end = start;
  while (end < n && (end === start || layout.offsets[end]! < bottom)) end++;
  return [start, end];
}

/** Window ∪ pinned rows → segments sorted by index. Adjacent rows have no blank segment between them. The blank segment heights plus the mounted row heights add up to `total`. */
export function rowSegments(layout: RowLayout, range: readonly [number, number], pinned: readonly number[]): RowSegment[] {
  const n = rowCount(layout);
  const [start, end] = [Math.max(0, range[0]), Math.min(n, range[1])];
  const outside = [...new Set(pinned)]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < n && (i < start || i >= end))
    .sort((a, b) => a - b);
  const indexes: number[] = [];
  let k = 0;
  while (k < outside.length && outside[k]! < start) indexes.push(outside[k++]!);
  for (let i = start; i < end; i++) indexes.push(i);
  while (k < outside.length) indexes.push(outside[k++]!);
  const segments: RowSegment[] = [];
  let at = 0;
  for (const index of indexes) {
    const gap = layout.offsets[index]! - layout.offsets[at]!;
    if (index > at && gap > 0) segments.push({ gap });
    segments.push({ index });
    at = index + 1;
  }
  const tail = layout.total - layout.offsets[Math.min(at, n)]!;
  if (at < n && tail > 0) segments.push({ gap: tail });
  return segments;
}

/**
 * Brings row `index` into view as a scrollTop: `start` puts its top edge at the top, `end` puts its bottom edge at the bottom, `center` centers it, and `nearest` leaves it alone if it is fully visible,
 * moves it to the top if it is above, and to the bottom if it is below (taller than the viewport: top). The result is clamped to [0, total − viewport].
 */
export function alignedScrollTop(layout: RowLayout, index: number, viewport: number, scrollTop: number, align: Align): number {
  const n = rowCount(layout);
  if (n <= 0) return 0;
  const i = Math.min(Math.max(0, index), n - 1);
  const top = layout.offsets[i]!;
  const height = rowHeight(layout, i);
  let target: number;
  if (align === 'start') target = top;
  else if (align === 'end') target = top + height - viewport;
  else if (align === 'center') target = top + (height - viewport) / 2;
  else if (top < scrollTop) target = top;
  else if (top + height > scrollTop + viewport) target = height > viewport ? top : top + height - viewport;
  else target = scrollTop;
  return Math.min(Math.max(0, target), Math.max(0, layout.total - viewport));
}

/**
 * Anchor preservation: when the layout changes from `before` to `after` (rows above the viewport measure differently from the estimate, and row heights change), this is how much scrollTop must be adjusted
 * so that the anchor row (usually the row at the top of the viewport) stays put on screen. The anchor itself and the rows below it need no compensation, however they change.
 */
export function anchorShift(before: RowLayout, after: RowLayout, anchorIndex: number): number {
  const last = Math.min(rowCount(before), rowCount(after));
  if (anchorIndex <= 0 || last <= 0) return 0;
  const i = Math.min(anchorIndex, last);
  return after.offsets[i]! - before.offsets[i]!;
}

/**
 * Rough estimate of how many lines a piece of text wraps to (used for row height estimates until the real height is measured). CJK, full-width characters and emoji count as 1em each; everything else counts as 0.5em.
 * That is the average character width measured on body text that is mostly lowercase English in the CucCut UI font, leaning slightly wide. Explicit line breaks each start a new line. At least one line.
 */
export function estimateLines(text: string, width: number, fontSize: number): number {
  if (width <= 0 || fontSize <= 0) return 1;
  const perLine = width / fontSize;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let em = 0;
    for (const char of paragraph) em += wide(char.codePointAt(0)!) ? 1 : 0.5;
    lines += Math.max(1, Math.ceil(em / perLine));
  }
  return Math.max(1, lines);
}

/** East Asian wide characters (CJK, kana, Hangul, full-width punctuation) and characters from supplementary planes (emoji, extended CJK ideographs). */
function wide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    code >= 0x1f000
  );
}
