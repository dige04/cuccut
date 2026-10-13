import { describe, expect, it } from 'vitest';
import {
  alignedScrollTop,
  anchorShift,
  estimateLines,
  layoutRows,
  rowAt,
  rowCount,
  rowRange,
  rowSegments,
  type RowSegment,
} from './virtual-rows.ts';

const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`);
const NONE = new Map<string, number>();
/** Estimate of 50px per row, plus a few rows measured. */
const layoutOf = (n: number, measured: Record<string, number> = {}) => layoutRows(keys(n), new Map(Object.entries(measured)), () => 50);
const gaps = (segments: RowSegment[]) => segments.flatMap((s) => ('gap' in s ? [s.gap] : []));
const rows = (segments: RowSegment[]) => segments.flatMap((s) => ('index' in s ? [s.index] : []));

describe('variable-height virtual list: layout', () => {
  it('measured rows use their measured height, unmeasured ones use the estimate; offsets has one more entry than rows, the last being the total height', () => {
    const layout = layoutRows(keys(4), new Map([['k1', 80]]), (i) => 40 + i);
    expect([...layout.offsets]).toEqual([0, 40, 120, 162, 205]);
    expect(layout.total).toBe(205);
    expect(rowCount(layout)).toBe(4);
  });

  it('empty list and single row', () => {
    const empty = layoutRows([], NONE, () => 50);
    expect(empty.total).toBe(0);
    expect(rowAt(empty, 10)).toBe(-1);
    expect(rowRange(empty, 0, 600, 600)).toEqual([0, 0]);
    expect(rowSegments(empty, [0, 0], [3])).toEqual([]);
    expect(alignedScrollTop(empty, 0, 600, 0, 'center')).toBe(0);
    const one = layoutOf(1);
    expect(rowRange(one, 0, 600, 600)).toEqual([0, 1]);
    expect(rowSegments(one, [0, 1], [0])).toEqual([{ index: 0 }]);
    expect(alignedScrollTop(one, 0, 600, 0, 'end')).toBe(0);
  });

  it('binary search for the row by y: the top edge counts as that row; out-of-range is clamped to both ends', () => {
    const layout = layoutOf(1000);
    expect(rowAt(layout, 0)).toBe(0);
    expect(rowAt(layout, 49.9)).toBe(0);
    expect(rowAt(layout, 50)).toBe(1);
    expect(rowAt(layout, 25_010)).toBe(500);
    expect(rowAt(layout, -5)).toBe(0);
    expect(rowAt(layout, 1e9)).toBe(999);
  });

  it('the window is the rows intersecting the viewport plus overscan before and after; only a few dozen rows are mounted', () => {
    const layout = layoutOf(5000);
    expect(rowRange(layout, 0, 600, 0)).toEqual([0, 12]);
    // The top edge is exactly at the bottom edge of a row: that row does not count.
    expect(rowRange(layout, 100, 600, 0)).toEqual([2, 14]);
    expect(rowRange(layout, 125, 600, 0)).toEqual([2, 15]);
    const [start, end] = rowRange(layout, 100_000, 600, 600);
    expect(start).toBe((100_000 - 600) / 50);
    expect(end).toBe((100_000 + 1200) / 50);
    expect(end - start).toBe(36);
    // Even when scrolled past, there is at least one row.
    expect(rowRange(layout, 1e9, 600, 0)).toEqual([4999, 5000]);
  });
});

describe('variable-height virtual list: segments', () => {
  it('no pinned rows outside the window: a blank segment before and after', () => {
    const layout = layoutOf(100);
    const segments = rowSegments(layout, [10, 13], []);
    expect(segments).toEqual([{ gap: 500 }, { index: 10 }, { index: 11 }, { index: 12 }, { gap: 87 * 50 }]);
  });

  it('pinned rows outside the window: inserted by index, with the blank segments split around them; pinned rows inside the window are not duplicated', () => {
    const layout = layoutOf(100, { k3: 120 });
    const segments = rowSegments(layout, [50, 52], [3, 51, 90, 3]);
    expect(rows(segments)).toEqual([3, 50, 51, 90]);
    expect(segments[0]).toEqual({ gap: 150 });
    expect(segments[1]).toEqual({ index: 3 });
    expect(segments[2]).toEqual({ gap: layout.offsets[50]! - layout.offsets[4]! });
  });

  it('pinned rows adjacent to the window and to each other: no blank segment between them; out-of-range pins do not count', () => {
    const layout = layoutOf(100);
    const segments = rowSegments(layout, [20, 22], [19, 22, 23, 60, 61, -1, 100, 1.5]);
    expect(rows(segments)).toEqual([19, 20, 21, 22, 23, 60, 61]);
    expect(segments).toEqual([
      { gap: 19 * 50 },
      { index: 19 },
      { index: 20 },
      { index: 21 },
      { index: 22 },
      { index: 23 },
      { gap: 36 * 50 },
      { index: 60 },
      { index: 61 },
      { gap: 38 * 50 },
    ]);
  });

  it('pinned on the first and last rows: no zero-height blank segments', () => {
    const layout = layoutOf(10);
    const segments = rowSegments(layout, [4, 6], [0, 9]);
    expect(segments).toEqual([{ index: 0 }, { gap: 150 }, { index: 4 }, { index: 5 }, { gap: 150 }, { index: 9 }]);
  });

  it('blank segment heights plus the mounted row heights always equal the total height', () => {
    const measured: Record<string, number> = {};
    for (let i = 0; i < 300; i += 7) measured[`k${i}`] = 30 + ((i * 13) % 90);
    const layout = layoutRows(keys(300), new Map(Object.entries(measured)), (i) => 40 + (i % 5) * 11.2);
    for (const [range, pinned] of [
      [[0, 0], []],
      [[0, 300], []],
      [
        [120, 140],
        [3, 4, 299, 141, 119],
      ],
      [
        [290, 300],
        [0, 150],
      ],
    ] as const) {
      const segments = rowSegments(layout, range, pinned);
      const mounted = rows(segments).reduce((sum, i) => sum + layout.offsets[i + 1]! - layout.offsets[i]!, 0);
      const blank = gaps(segments).reduce((a, b) => a + b, 0);
      expect(mounted + blank).toBeCloseTo(layout.total, 6);
    }
  });
});

describe('variable-height virtual list: alignment', () => {
  const layout = layoutRows(keys(100), new Map([['k40', 900]]), () => 50);
  const viewport = 600;

  it('start, end, center', () => {
    expect(alignedScrollTop(layout, 20, viewport, 0, 'start')).toBe(1000);
    expect(alignedScrollTop(layout, 20, viewport, 0, 'end')).toBe(1050 - 600);
    expect(alignedScrollTop(layout, 20, viewport, 0, 'center')).toBe(1000 - 275);
  });

  it('nearest: a fully visible row does not move; above the viewport snaps to top, below snaps to bottom; a row taller than the viewport snaps to top', () => {
    expect(alignedScrollTop(layout, 20, viewport, 800, 'nearest')).toBe(800);
    expect(alignedScrollTop(layout, 20, viewport, 1010, 'nearest')).toBe(1000);
    expect(alignedScrollTop(layout, 20, viewport, 300, 'nearest')).toBe(1050 - 600);
    expect(alignedScrollTop(layout, 40, viewport, 0, 'nearest')).toBe(2000);
    expect(alignedScrollTop(layout, 40, viewport, 2100, 'nearest')).toBe(2000);
  });

  it('clamped to [0, total − viewport]', () => {
    expect(alignedScrollTop(layout, 0, viewport, 500, 'center')).toBe(0);
    expect(alignedScrollTop(layout, 99, viewport, 0, 'start')).toBe(layout.total - viewport);
    expect(alignedScrollTop(layout, 500, viewport, 0, 'start')).toBe(layout.total - viewport);
    expect(alignedScrollTop(layoutOf(3), 2, viewport, 0, 'end')).toBe(0);
  });
});

describe('variable-height virtual list: anchor compensation', () => {
  it('only compensates changes above the anchor', () => {
    const before = layoutOf(100);
    const after = layoutOf(100, { k5: 80, k30: 20, k60: 200 });
    // The anchor is row 50: row 5 above is +30 and row 30 is −30, so they cancel out.
    expect(anchorShift(before, after, 50)).toBe(0);
    expect(anchorShift(before, after, 10)).toBe(30);
    expect(anchorShift(before, after, 31)).toBe(0);
    // The anchor itself and the rows below it changing height: no compensation.
    expect(anchorShift(before, after, 60)).toBe(0);
    expect(anchorShift(before, after, 5)).toBe(0);
    expect(anchorShift(before, after, 6)).toBe(30);
  });

  it('scrolled to the top (anchor is row 0) and empty list: no compensation', () => {
    const before = layoutOf(10);
    const after = layoutOf(10, { k0: 300 });
    expect(anchorShift(before, after, 0)).toBe(0);
    expect(anchorShift(layoutOf(0), layoutOf(0), 3)).toBe(0);
  });

  it('after compensating, the anchor row\'s position in the viewport is unchanged', () => {
    const before = layoutOf(200);
    const scrollTop = 4321;
    const anchor = rowAt(before, scrollTop);
    const within = scrollTop - before.offsets[anchor]!;
    const after = layoutOf(200, { k3: 75.5, k10: 12.25, k90: 77, k150: 10 });
    const next = scrollTop + anchorShift(before, after, anchor);
    expect(next - after.offsets[anchor]!).toBeCloseTo(within, 9);
  });
});

describe('rough row count estimate', () => {
  it('Latin counts as half a character width, CJK as one, and explicit line breaks each start a new line', () => {
    expect(estimateLines('', 300, 14)).toBe(1);
    // 300px / 14px ≈ 21.4em: 42 Latin letters fit on one line, 43 wrap to two lines.
    expect(estimateLines('a'.repeat(42), 300, 14)).toBe(1);
    expect(estimateLines('a'.repeat(43), 300, 14)).toBe(2);
    expect(estimateLines('字'.repeat(21), 300, 14)).toBe(1);
    expect(estimateLines('字'.repeat(22), 300, 14)).toBe(2);
    expect(estimateLines('한'.repeat(22), 300, 14)).toBe(2);
    expect(estimateLines('一\n二\n\n三', 300, 14)).toBe(4);
    expect(estimateLines('😀'.repeat(22), 300, 14)).toBe(2);
    expect(estimateLines('anything', 0, 14)).toBe(1);
  });
});
