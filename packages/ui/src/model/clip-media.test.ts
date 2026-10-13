import { describe, expect, it } from 'vitest';
import type { TimeMap } from '@cuccut/protocol';
import {
  TILE_WIDTH,
  decodePeaks,
  filmstripTiles,
  peakIn,
  peakScale,
  sourceClock,
  sourceSecondsAt,
  thumbnailGrid,
  visibleTiles,
  waveEnvelope,
} from './clip-media.ts';

const linear = (sourceIn: number, num = 1, den = 1): TimeMap => ({
  kind: 'linear',
  sourceIn: { ticks: String(sourceIn * 1000), timescale: 1000 },
  rate: { num, den },
});

describe('source time within a clip', () => {
  it('linear mapping: sourceIn plus the time relative to content start times speed', () => {
    const clock = sourceClock(linear(10, 2), 4);
    expect(sourceSecondsAt(clock, 4)).toBe(10);
    expect(sourceSecondsAt(clock, 5.5)).toBe(13);
  });

  it('freeze: always the same source time', () => {
    const clock = sourceClock({ kind: 'hold', sourceAt: { ticks: '7', timescale: 2 } }, 4);
    expect(sourceSecondsAt(clock, 0)).toBe(3.5);
    expect(sourceSecondsAt(clock, 100)).toBe(3.5);
  });
});

describe('filmstrip', () => {
  it('only visible cells are computed', () => {
    expect(visibleTiles(100, 640, { left: 0, right: 2000 })).toEqual([0, 10]);
    expect(visibleTiles(100, 640, { left: 300, right: 500 })).toEqual([3, 7]);
    expect(visibleTiles(100, 640, { left: 2000, right: 3000 })).toEqual([10, 10]);
    expect(visibleTiles(100, 640, { left: -500, right: 50 })).toEqual([0, 0]);
  });

  it('frame sampling granularity does not exceed the source duration one cell covers', () => {
    expect(thumbnailGrid(0.05)).toBe(0.1);
    expect(thumbnailGrid(0.64)).toBe(0.5);
    expect(thumbnailGrid(1.6)).toBe(1);
    expect(thumbnailGrid(16)).toBe(15);
    expect(thumbnailGrid(4000)).toBe(3600);
  });

  it('each cell takes the frame at its left: converted to source time via timeMap, rounded to granularity, not beyond the media', () => {
    // 32 px per second: one cell is 2 s wide; at 2x speed one cell covers 4 s of source time, so the granularity is 2 s.
    const tiles = filmstripTiles({
      clipLeft: 64,
      clipWidth: 160,
      clipStart: 2,
      pxPerSecond: 32,
      clock: sourceClock(linear(1, 2), 2),
      sourceDuration: 8.5,
      view: { left: 0, right: 1000 },
    });
    expect(tiles).toEqual([
      { index: 0, left: 0, width: TILE_WIDTH, at: 2 },
      { index: 1, left: 64, width: TILE_WIDTH, at: 6 },
      { index: 2, left: 128, width: 32, at: 8.5 },
    ]);
  });

  it('trimming the start leaves content unchanged: when the clip\'s left edge is later than the content start, begins from a later source time', () => {
    const tiles = filmstripTiles({
      clipLeft: 64,
      clipWidth: 64,
      clipStart: 3,
      pxPerSecond: 64,
      clock: sourceClock(linear(0), 2),
      sourceDuration: null,
      view: { left: 0, right: 1000 },
    });
    expect(tiles[0]!.at).toBe(1);
  });
});

describe('waveform', () => {
  it('base64 decoded to bytes', () => {
    expect([...decodePeaks(btoa(String.fromCharCode(0, 128, 255)))]).toEqual([0, 128, 255]);
  });

  it('takes the maximum peak in a source time range; if the range is smaller than one cell, takes that cell', () => {
    const peaks = Uint8Array.from([10, 50, 20, 200, 0]);
    expect(peakIn(peaks, 10, 0, 0.3)).toBe(50);
    expect(peakIn(peaks, 10, 0.31, 0.32)).toBe(200);
    expect(peakIn(peaks, 10, 0.9, 1.2)).toBe(0);
  });

  it('scaled to the 98th percentile, near-silent media has a floor', () => {
    const peaks = new Uint8Array(100).fill(64);
    peaks[99] = 255;
    expect(peakScale(peaks)).toBeCloseTo(255 / 64);
    expect(peakScale(new Uint8Array(100).fill(2))).toBeCloseTo(255 / 16);
    expect(peakScale(new Uint8Array(0))).toBe(1);
  });

  it('envelope takes peaks point by point along the canvas; freeze has no waveform', () => {
    const peaks = Uint8Array.from([255, 0, 128, 0]);
    const common = { width: 4, step: 2, clipLeft: 0, clipStart: 0, pxPerSecond: 2, peaks, binsPerSecond: 1, scale: 1 };
    expect(waveEnvelope({ ...common, canvasLeft: 0, clock: sourceClock(linear(0), 0) })).toEqual([1, 0, 128 / 255]);
    expect(
      waveEnvelope({ ...common, canvasLeft: 0, clock: sourceClock({ kind: 'hold', sourceAt: { ticks: '0', timescale: 1 } }, 0) }),
    ).toEqual([]);
  });
});
