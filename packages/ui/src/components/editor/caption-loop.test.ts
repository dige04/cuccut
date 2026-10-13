import { describe, expect, it, vi } from 'vitest';
import { CAPTION_FPS, CaptionLoop } from './caption-loop.ts';

// Node has no ImageData, so add one that holds the pixels.
vi.stubGlobal('ImageData', function (data: Uint8ClampedArray, width: number, height: number) {
  return { data, width, height };
});

/** A transparent 4×2 frame; the x-th pixel of the first row is opaque. */
function image(x: number): ImageData {
  const data = new Uint8ClampedArray(4 * 2 * 4);
  data.set([255, 0, 0, 255], x * 4);
  return new ImageData(data, 4, 2);
}

describe('frames for one cycle of the subtitle style card', () => {
  it('sample cells on the shared clock: one cycle loops, and times before the origin also fall within the cycle', () => {
    const loop = new CaptionLoop(2);
    expect(loop.count).toBe(2 * CAPTION_FPS);
    expect(new CaptionLoop(4 / CAPTION_FPS).count).toBe(4);
    expect(loop.index(0)).toBe(0);
    expect(loop.index(2.01)).toBe(0);
    expect(loop.index(1.99)).toBe(loop.count - 1);
    expect(loop.index(-0.01)).toBe(loop.count - 1);
    expect(loop.time(3)).toBeCloseTo(3 / CAPTION_FPS);
  });

  it('crop to the opaque area before storing; cells with identical images share one copy', () => {
    const loop = new CaptionLoop(1);
    const first = loop.put(0, image(1));
    expect(first.at).toEqual({ x: 1, y: 0, width: 1, height: 1 });
    expect(first.image!.data).toEqual(new Uint8ClampedArray([255, 0, 0, 255]));
    expect(loop.put(1, image(1))).toBe(first);
    expect(loop.get(1)).toBe(first);
    expect(loop.put(2, image(2))).not.toBe(first);
    // Cells that are not adjacent are still recognized (cells skipped in the first lap because of the clock budget, drawn later).
    expect(loop.put(9, image(1))).toBe(first);
    // Cells already drawn are not collected again.
    expect(loop.put(0, image(3))).toBe(first);
  });

  it('a cycle counts as static only when every cell has been drawn and all show the same image; after clearing, counting starts over', () => {
    const loop = new CaptionLoop(4 / CAPTION_FPS);
    // Drawn out of order: a full lap of the same frame is still recognized.
    for (const index of [0, 2, 1]) loop.put(index, image(1));
    expect(loop.still).toBe(false);
    loop.put(3, image(1));
    expect(loop.still).toBe(true);
    loop.clear();
    expect(loop.get(0)).toBeUndefined();
    expect(loop.still).toBe(false);
  });

  it('once full, nothing more is stored and that cell is still drawn; cells identical to a neighbor still share', () => {
    const loop = new CaptionLoop(1, 8);
    loop.put(0, image(0));
    loop.put(2, image(1));
    const over = loop.put(4, image(2));
    expect(over.at).toEqual({ x: 2, y: 0, width: 1, height: 1 });
    expect(loop.get(4)).toBeUndefined();
    expect(loop.put(1, image(0))).toBe(loop.get(0));
  });
});
