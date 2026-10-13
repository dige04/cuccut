import { describe, expect, it } from 'vitest';
import { MAX_DUB_TEMPO, alignDub, atempoFilter } from './dub-alignment.ts';

describe('alignDub', () => {
  it('not longer than the window: placed from the source sentence start, no speed change', () => {
    const a = alignDub({ start: 2, end: 5, limit: 6 }, 2.5);
    expect(a).toEqual({ fit: 'fit', start: 2, tempo: 1, duration: 2.5, end: 4.5, overflow: 0 });
    // Exactly the same length also means no speed change.
    expect(alignDub({ start: 2, end: 5, limit: 5 }, 3).fit).toBe('fit');
  });

  it('longer than the window: speed up as needed, the factor rounded up to the thousandth', () => {
    const a = alignDub({ start: 0, end: 3, limit: 10 }, 3.3);
    expect(a.fit).toBe('tempo');
    expect(a.tempo).toBe(1.1);
    expect(a.end <= 3 + 1e-9).toBe(true);
    const b = alignDub({ start: 0, end: 3, limit: 10 }, 3.31);
    expect(b.tempo).toBe(1.104);
    expect(b.duration <= 3).toBe(true);
  });

  it('speeding up to the limit that just fits still counts as speeding up', () => {
    const a = alignDub({ start: 1, end: 3, limit: 3 }, 2.5);
    expect(a.fit).toBe('tempo');
    expect(a.tempo).toBe(MAX_DUB_TEMPO);
    expect(Math.abs(a.end - 3) < 1e-9).toBe(true);
  });

  it('even at the speed limit it doesn\'t fit: occupies the following silence, does not cross the next sentence', () => {
    const a = alignDub({ start: 1, end: 3, limit: 4 }, 3.5);
    expect(a.fit).toBe('extended');
    expect(a.tempo).toBe(MAX_DUB_TEMPO);
    expect(Math.abs(a.duration - 2.8) < 1e-9).toBe(true);
    expect(a.end <= 4).toBe(true);
  });

  it('still doesn\'t fit: overlong, reports by how much, does not truncate', () => {
    const a = alignDub({ start: 1, end: 3, limit: 3.5 }, 5);
    expect(a.fit).toBe('overlong');
    expect(a.tempo).toBe(MAX_DUB_TEMPO);
    expect(Math.abs(a.duration - 4) < 1e-9).toBe(true);
    expect(Math.abs(a.overflow - 1.5) < 1e-9).toBe(true);
  });

  it('the next sentence starts before this one ends: the window only extends to the next sentence', () => {
    const a = alignDub({ start: 0, end: 4, limit: 2 }, 3);
    expect(a.fit).toBe('overlong');
    expect(Math.abs(a.overflow - 0.4) < 1e-9).toBe(true);
    const b = alignDub({ start: 0, end: 4, limit: 2 }, 1.9);
    expect(b.fit).toBe('fit');
  });

  it('zero-length window looks straight at silence', () => {
    expect(alignDub({ start: 2, end: 2, limit: 4 }, 2).fit).toBe('extended');
    expect(alignDub({ start: 2, end: 2, limit: 2 }, 1).fit).toBe('overlong');
  });

  it('same input always gives the same result; invalid input throws', () => {
    expect(alignDub({ start: 0, end: 1, limit: 2 }, 1.2)).toEqual(alignDub({ start: 0, end: 1, limit: 2 }, 1.2));
    expect(() => alignDub({ start: 0, end: 1, limit: 2 }, 0)).toThrow(RangeError);
    expect(() => alignDub({ start: 2, end: 1, limit: 3 }, 1)).toThrow(RangeError);
    expect(() => alignDub({ start: 0, end: 1, limit: 2 }, 1, 0.9)).toThrow(RangeError);
  });

  it('atempo\'s parameters', () => {
    expect(atempoFilter(1.1)).toBe('atempo=1.100');
  });
});
