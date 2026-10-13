/**
 * Virtual list for the font picker (the prototype's .flist in panel-font-picker.jsx; all fonts are about two thousand rows): sections are flattened into fixed-height items, and only the few dozen items in the viewport are drawn according to the scroll position.
 * Geometry matches the prototype: section header 26px, each row 33px, list maximum height 240px.
 */

export const FONT_HEAD_HEIGHT = 26;
export const FONT_ROW_HEIGHT = 33;
export const FONT_LIST_HEIGHT = 240;

export type FontListItem<T> =
  | { kind: 'head'; key: string; section: string; title: string; top: number }
  | { kind: 'row'; key: string; section: string; row: T; top: number };

export interface FontListLayout<T> {
  items: FontListItem<T>[];
  height: number;
}

/** Flatten sections: each section has a header followed by its rows; empty sections are omitted. */
export function fontListLayout<T extends { family: string }>(
  sections: readonly { key: string; title: string; rows: readonly T[] }[],
): FontListLayout<T> {
  const items: FontListItem<T>[] = [];
  let top = 0;
  for (const s of sections) {
    if (!s.rows.length) continue;
    items.push({ kind: 'head', key: `head:${s.key}`, section: s.key, title: s.title, top });
    top += FONT_HEAD_HEIGHT;
    for (const row of s.rows) {
      items.push({ kind: 'row', key: `${s.key}:${row.family}`, section: s.key, row, top });
      top += FONT_ROW_HEIGHT;
    }
  }
  return { items, height: top };
}

const itemHeight = (item: FontListItem<unknown>) => (item.kind === 'head' ? FONT_HEAD_HEIGHT : FONT_ROW_HEIGHT);

/** Items in the viewport (plus `overscan` extra items drawn before and after): binary-searches by `top` for the first item and returns [start, end). */
export function visibleRange(items: readonly FontListItem<unknown>[], scrollTop: number, viewport: number, overscan = 6): [number, number] {
  if (!items.length) return [0, 0];
  let lo = 0;
  let hi = items.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (items[mid]!.top <= scrollTop) lo = mid;
    else hi = mid - 1;
  }
  let end = lo;
  while (end < items.length && items[end]!.top < scrollTop + viewport) end++;
  return [Math.max(0, lo - overscan), Math.min(items.length, end + overscan)];
}

/** Families in the viewport (excluding the extra items drawn before and after) that need sample fetching: only rows, de-duplicated, skipping ones that already have a sample status. */
export function samplesToLoad<T extends { family: string }>(
  items: readonly FontListItem<T>[],
  scrollTop: number,
  viewport: number,
  known: (family: string) => boolean,
): string[] {
  const [start, end] = visibleRange(items, scrollTop, viewport, 0);
  const out = new Set<string>();
  for (let i = start; i < end; i++) {
    const item = items[i]!;
    if (item.kind === 'row' && !known(item.row.family)) out.add(item.row.family);
  }
  return [...out];
}

/** On open, scrolls the currently selected row into view (no scrolling if it is already on the first screen), placing it in the middle where possible. */
export function scrollToRow<T extends { family: string }>(items: readonly FontListItem<T>[], family: string, viewport: number): number {
  const key = family.trim().toLowerCase();
  const hit = items.find((i) => i.kind === 'row' && i.row.family.trim().toLowerCase() === key);
  if (!hit || hit.top + itemHeight(hit) <= viewport) return 0;
  return Math.max(0, hit.top - (viewport - FONT_ROW_HEIGHT) / 2);
}
