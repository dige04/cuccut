import { describe, expect, it } from 'vitest';
import { rulerTicks, spanIndex, spansIn, type Span } from './timeline-window.ts';

interface Item extends Span {
  id: string;
}

const item = (id: string, start: number, end: number): Item => ({ id, start, end });
const ids = (items: readonly Item[]) => items.map((i) => i.id);
const index = (items: Item[]) => spanIndex(items, (i) => i);

/** No index; compare item by item. Items that intersect the window (touching the edge counts) are kept, in their original order. */
const brute = (items: Item[], from: number, to: number) => items.filter((i) => i.start <= to && i.end >= from);

describe('spansIn', () => {
  it('a long chain of end-to-end items only takes the few within the window', () => {
    const items = Array.from({ length: 1000 }, (_, k) => item(`c${k}`, k * 10, k * 10 + 10));
    expect(ids(spansIn(index(items), 205, 231))).toEqual(['c20', 'c21', 'c22', 'c23']);
  });

  it('a long clip starting left of the window but extending into it is not missed', () => {
    const items = [item('long', 0, 1000), ...Array.from({ length: 100 }, (_, k) => item(`s${k}`, k * 10, k * 10 + 5))];
    expect(ids(spansIn(index(items), 600, 612))).toEqual(['long', 's60', 's61']);
  });

  it('touching an edge counts as intersecting; items entirely outside the window don\'t', () => {
    const items = [item('a', 0, 10), item('b', 10, 20), item('c', 21, 30)];
    expect(ids(spansIn(index(items), 20, 20.5))).toEqual(['b']);
    expect(ids(spansIn(index(items), 31, 40))).toEqual([]);
    expect(ids(spansIn(index(items), -10, -1))).toEqual([]);
  });

  it('results keep the original order (overlapping items are stacked by DOM order)', () => {
    const items = [item('late', 50, 60), item('early', 0, 100), item('mid', 40, 55)];
    expect(ids(spansIn(index(items), 45, 52))).toEqual(['late', 'early', 'mid']);
  });

  it('items in extra are included whether or not they\'re in the window, deduplicated; items not on this track are not included', () => {
    const items = Array.from({ length: 100 }, (_, k) => item(`c${k}`, k, k + 1));
    const stranger = item('other', 0, 1);
    const got = spansIn(index(items), 50.5, 51.5, [items[90]!, items[51]!, stranger]);
    expect(ids(got)).toEqual(['c50', 'c51', 'c90']);
  });

  it('empty tracks and zero-length items', () => {
    expect(spansIn(index([]), 0, 100)).toEqual([]);
    expect(ids(spansIn(index([item('dot', 5, 5)]), 5, 6))).toEqual(['dot']);
  });

  it('randomized unordered and overlapping data matches a per-item comparison', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const items = Array.from({ length: 400 }, (_, k) => {
      const start = rand() * 1000;
      return item(`r${k}`, start, start + (rand() < 0.05 ? rand() * 600 : rand() * 8));
    });
    const built = index(items);
    for (let n = 0; n < 200; n++) {
      const from = rand() * 1100 - 50;
      const to = from + rand() * 120;
      expect(ids(spansIn(built, from, to))).toEqual(ids(brute(items, from, to)));
    }
  });
});

describe('rulerTicks', () => {
  const full = (minor: number, major: number, end: number) => rulerTicks({ minor, major, from: 0, to: end, end, limit: 1e6 });

  it('ticks within the window are a slice of the full ruler; seconds and major/minor steps match exactly', () => {
    for (const [minor, major] of [
      [0.05, 0.1],
      [0.2, 1],
      [2, 10],
      [20, 120],
    ] as const) {
      const all = full(minor, major, 2700);
      const part = rulerTicks({ minor, major, from: 1234.5, to: 1300, end: 2700 });
      const at = all.findIndex((t) => t.seconds === part[0]!.seconds);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(all.slice(at, at + part.length)).toEqual(part);
      expect(part[0]!.seconds).toBeLessThanOrEqual(1234.5);
      expect(part.at(-1)!.seconds).toBeLessThanOrEqual(1300);
    }
  });

  it('not beyond the end of the video, not before 0; at most limit ticks', () => {
    expect(rulerTicks({ minor: 1, major: 5, from: -30, to: 3, end: 100 }).map((t) => t.seconds)).toEqual([0, 1, 2, 3]);
    expect(rulerTicks({ minor: 1, major: 5, from: 98, to: 200, end: 100 }).map((t) => t.seconds)).toEqual([98, 99, 100]);
    expect(rulerTicks({ minor: 1, major: 5, from: 0, to: 1e6, end: 1e6, limit: 10 })).toHaveLength(10);
    expect(rulerTicks({ minor: 0, major: 5, from: 0, to: 10, end: 10 })).toEqual([]);
  });
});
