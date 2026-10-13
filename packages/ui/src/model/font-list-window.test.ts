import { describe, expect, it } from 'vitest';
import {
  FONT_HEAD_HEIGHT,
  FONT_LIST_HEIGHT,
  FONT_ROW_HEIGHT,
  fontListLayout,
  samplesToLoad,
  scrollToRow,
  visibleRange,
} from './font-list-window.ts';

const rows = (n: number, prefix = 'Family') => Array.from({ length: n }, (_, i) => ({ family: `${prefix} ${i}` }));

describe('font picker virtual list', () => {
  it('sections flattened into fixed-height items: section header 26px, row 33px; empty sections do not appear', () => {
    const layout = fontListLayout([
      { key: 'video', title: '这个视频里用到', rows: rows(2, 'Used') },
      { key: 'recent', title: '最近用过', rows: [] },
      { key: 'all', title: '全部字体', rows: rows(3) },
    ]);
    expect(layout.items.map((i) => [i.kind, i.top])).toEqual([
      ['head', 0],
      ['row', 26],
      ['row', 59],
      ['head', 92],
      ['row', 118],
      ['row', 151],
      ['row', 184],
    ]);
    expect(layout.height).toBe(2 * FONT_HEAD_HEIGHT + 5 * FONT_ROW_HEIGHT);
  });

  it('1944 rows: only the few dozen items in view are drawn, drawing as you scroll', () => {
    const layout = fontListLayout([{ key: 'all', title: '全部字体', rows: rows(1944) }]);
    const [start, end] = visibleRange(layout.items, 0, FONT_LIST_HEIGHT);
    expect(start).toBe(0);
    expect(end - start).toBeLessThan(20);
    const top = 1000 * FONT_ROW_HEIGHT;
    const [s2, e2] = visibleRange(layout.items, top, FONT_LIST_HEIGHT, 0);
    expect(layout.items[s2]!.top).toBeLessThanOrEqual(top);
    expect(layout.items[e2 - 1]!.top).toBeLessThan(top + FONT_LIST_HEIGHT);
    expect(e2 - s2).toBeLessThanOrEqual(Math.ceil(FONT_LIST_HEIGHT / FONT_ROW_HEIGHT) + 1);
    const [s3, e3] = visibleRange(layout.items, layout.height, FONT_LIST_HEIGHT);
    expect(e3).toBe(layout.items.length);
    expect(s3).toBeGreaterThan(1900);
  });

  it('sample fetches only rows in view not yet fetched (excluding section headers and the extra rows drawn before and after)', () => {
    const layout = fontListLayout([{ key: 'all', title: '全部字体', rows: rows(100) }]);
    const known = new Set(['Family 1']);
    const want = samplesToLoad(layout.items, 0, FONT_LIST_HEIGHT, (f) => known.has(f));
    expect(want[0]).toBe('Family 0');
    expect(want).not.toContain('Family 1');
    expect(want.length).toBeLessThanOrEqual(7);
  });

  it('on open, scrolls the selected row into view; does not scroll on the first screen', () => {
    const layout = fontListLayout([{ key: 'all', title: '全部字体', rows: rows(500) }]);
    expect(scrollToRow(layout.items, 'Family 2', FONT_LIST_HEIGHT)).toBe(0);
    const top = scrollToRow(layout.items, 'family 300', FONT_LIST_HEIGHT);
    const row = layout.items.find((i) => i.kind === 'row' && i.row.family === 'Family 300')!;
    expect(row.top).toBeGreaterThanOrEqual(top);
    expect(row.top + FONT_ROW_HEIGHT).toBeLessThanOrEqual(top + FONT_LIST_HEIGHT);
    expect(scrollToRow(layout.items, 'Nope', FONT_LIST_HEIGHT)).toBe(0);
  });
});
