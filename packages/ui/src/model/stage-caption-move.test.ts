import { describe, expect, it } from 'vitest';
import type { CaptionHit } from '../render/render-planner.ts';
import { captionBox, lineMoveStart, movedCaptionStyle, movedLineStyle, restackedRootY, stepCaptionMove } from './stage-caption-move.ts';

const canvas = { width: 1920, height: 1080 };
const env = { canvas, others: [], pxScale: 1 };
const free = { shift: false, alt: false };
const loose = { shift: false, alt: true };
const hit = (cy: number, h: number, w = 800): CaptionHit => ({ layerId: 'l', itemId: 'c', documentId: 'd', cueId: 'q', cx: 960, cy, w, h, rotation: 0 });

describe('captionBox', () => {
  it('two bilingual lines combine into one bounding box; no lines gives null', () => {
    expect(captionBox([hit(860, 40), hit(910, 60, 1000)])).toEqual({ x: 460, y: 840, w: 1000, h: 100 });
    expect(captionBox([])).toBeNull();
  });
});

describe('stepCaptionMove', () => {
  // Horizontally centered, bottom edge pinned to the 86% anchor line: box 560–1360 × 868.8–928.8, center (960, 898.8).
  const move = { box: { x: 560, y: 868.8, w: 800, h: 60 }, x0: 50, y0: 86, p0: { x: 960, y: 900 } };

  it('moving up, down, left and right together: the offset folds into increments of horizontal center and anchor line', () => {
    const r = stepCaptionMove(move, { x: 960 + 192, y: 900 - 108 }, free, env);
    expect(r).toMatchObject({ x: 60, y: 76, guides: [] });
    expect(r.dx).toBeCloseTo(192, 6);
    expect(r.dy).toBeCloseTo(-108, 6);
  });

  it('dragging only up or down keeps x as is, without rounding it', () => {
    const r = stepCaptionMove({ ...move, x0: 50.04 }, { x: 960, y: 800 }, loose, env);
    expect(r.x).toBe(50.04);
    expect(r.dx).toBe(0);
  });

  it('the box center snaps to the frame\'s center line (±1.5%), with one guide per direction; ⌥ disables snapping', () => {
    // Center moved to (965, 548.8): 5px from the vertical midline (< 1920 × 1.5%), 8.8px from the horizontal midline (< 1080 × 1.5%).
    const p = { x: 965, y: 900 - 350 };
    const r = stepCaptionMove(move, p, free, env);
    expect(r.x).toBe(50);
    expect(r.y).toBe(52.8);
    expect(r.guides).toContainEqual({ axis: 'x', at: 960 });
    expect(r.guides).toContainEqual({ axis: 'y', at: 540 });
    const off = stepCaptionMove(move, p, loose, env);
    expect(off).toMatchObject({ x: 50.3, y: 53.6, guides: [] });
  });

  it('box edges snap to other objects\' edges (6px)', () => {
    // The box top would have landed at 703.8; it snaps to the object's bottom edge at 700.
    const below = stepCaptionMove(move, { x: 960, y: 900 - 165 }, free, { ...env, others: [{ x: 100, y: 600, w: 200, h: 100 }] });
    expect(below.dy).toBeCloseTo(700 - 868.8, 0);
    expect(below.guides).toContainEqual({ axis: 'y', at: 700 });
    // The box's right edge would have landed at 1397; it snaps to the object's left edge at 1400.
    const beside = stepCaptionMove(move, { x: 960 + 37, y: 900 }, free, { ...env, others: [{ x: 1400, y: 100, w: 100, h: 100 }] });
    expect(beside.x).toBe(52.1);
    expect(beside.guides).toContainEqual({ axis: 'x', at: 1400 });
  });

  it('left and right clamp by the drawn text: the box edges stay in frame, and rounding goes inward when snapped to an edge', () => {
    const right = stepCaptionMove(move, { x: 960 + 2000, y: 900 }, free, env);
    expect(right.x).toBe(79.1);
    expect(1360 + right.dx).toBeLessThanOrEqual(1920);
    const left = stepCaptionMove(move, { x: 960 - 2000, y: 900 }, free, env);
    expect(left.x).toBe(20.9);
    expect(560 + left.dx).toBeGreaterThanOrEqual(0);
  });

  it('a box wider than the frame does not move left or right; one already outside the frame at the start does not jump and can only be dragged back', () => {
    const wide = { ...move, box: { x: -40, y: 868.8, w: 2000, h: 60 }, x0: 50.04 };
    expect(stepCaptionMove(wide, { x: 960 + 300, y: 900 }, loose, env).x).toBe(50.04);
    // Box 1300–2100; the right edge is already 180px off the frame.
    const out = { ...move, box: { x: 1300, y: 868.8, w: 800, h: 60 }, x0: 88.5 };
    expect(stepCaptionMove(out, { x: 960 + 100, y: 900 }, loose, env).x).toBe(88.5);
    expect(stepCaptionMove(out, { x: 960 - 192, y: 900 }, loose, env).x).toBe(78.5);
  });

  it('anchor line is clamped to 4–96%; one already outside the limits at the start does not jump', () => {
    expect(stepCaptionMove(move, { x: 960, y: 900 + 500 }, free, env).y).toBe(96);
    expect(stepCaptionMove(move, { x: 960, y: 900 - 2000 }, free, env).y).toBe(4);
    const low = { ...move, y0: 99 };
    expect(stepCaptionMove(low, { x: 960, y: 901 }, loose, env).y).toBe(99);
    expect(stepCaptionMove(low, { x: 960, y: 900 - 54 }, loose, env).y).toBe(94);
  });
});

describe('movedCaptionStyle', () => {
  it('switches horizontal center and anchor line; a line with its own position moves along, and an override with only y stays put', () => {
    const root = { y: 86, verticalAlign: 'bottom', origStyle: { x: 50, y: 70, fontSize: 20 }, transStyle: { y: 40 } };
    expect(movedCaptionStyle(root, { x: 60, y: 76 })).toEqual({
      x: 60,
      y: 76,
      verticalAlign: 'bottom',
      origStyle: { x: 60, y: 60, fontSize: 20 },
      transStyle: { y: 40 },
    });
  });

  it('unset values use 50 / 86 for the offset; an unchanged item is not written to the document', () => {
    expect(movedCaptionStyle({ origStyle: { x: 50, y: 90 } }, { x: 50, y: 80 })).toEqual({ y: 80, origStyle: { x: 50, y: 84 } });
    expect(movedCaptionStyle({ y: 86.04 }, { x: 40, y: 86.04 })).toEqual({ x: 40, y: 86.04 });
  });
});

describe('lineMoveStart', () => {
  it('a line still in the stack is measured by its drawn box: the box center folds into a percentage (one decimal), without reading x from the root style', () => {
    // Box 560–1360 × 868.8–928.8: center (960, 898.8) → (50, 83.2).
    const box = { x: 560, y: 868.8, w: 800, h: 60 };
    expect(lineMoveStart({ x: 30, y: 86 }, 'translation', box, canvas)).toEqual({ x0: 50, y0: 83.2, detached: false });
    // An override that only has y (or only a font size) does not count as positioned separately.
    expect(lineMoveStart({ transStyle: { y: 40, fontSize: 20 } }, 'translation', box, canvas).detached).toBe(false);
  });

  it('a line already positioned on its own starts from its override values', () => {
    const root = { origStyle: { x: 30.25, y: 20, verticalAlign: 'bottom' } };
    expect(lineMoveStart(root, 'original', { x: 0, y: 0, w: 10, h: 10 }, canvas)).toEqual({ x0: 30.25, y0: 20, detached: true });
  });
});

describe('movedLineStyle', () => {
  it('leaving the stack for the first time: this line\'s override writes x, y and center alignment; other overrides and the other line stay put', () => {
    const root = { y: 86, verticalAlign: 'bottom', transStyle: { fontSize: 20, verticalAlign: 'top' }, origStyle: { color: '#fff' } };
    expect(movedLineStyle(root, 'translation', { x: 40, y: 70 }, false)).toEqual({
      y: 86,
      verticalAlign: 'bottom',
      transStyle: { fontSize: 20, verticalAlign: 'center', x: 40, y: 70 },
      origStyle: { color: '#fff' },
    });
    expect(movedLineStyle({}, 'original', { x: 50, y: 83.2 }, false)).toEqual({ origStyle: { x: 50, y: 83.2, verticalAlign: 'center' } });
  });

  it('a line already positioned on its own only changes position and keeps its own alignment', () => {
    const root = { origStyle: { x: 30, y: 20, verticalAlign: 'bottom' } };
    expect(movedLineStyle(root, 'original', { x: 35, y: 25 }, true)).toEqual({ origStyle: { x: 35, y: 25, verticalAlign: 'bottom' } });
  });

  it('with the root-style anchor line, the root style\'s y also changes; not written when it equals the original value', () => {
    expect(movedLineStyle({ y: 86 }, 'translation', { x: 40, y: 70 }, false, 80.4)).toEqual({
      y: 80.4,
      transStyle: { x: 40, y: 70, verticalAlign: 'center' },
    });
    expect(movedLineStyle({}, 'translation', { x: 40, y: 70 }, false, 86)).toEqual({ transStyle: { x: 40, y: 70, verticalAlign: 'center' } });
  });

  it('a line dragged alone moves along when the whole group is dragged', () => {
    const detached = movedLineStyle({ y: 86 }, 'translation', { x: 40, y: 70 }, false);
    expect(movedCaptionStyle(detached, { x: 55, y: 80 })).toEqual({
      x: 55,
      y: 80,
      transStyle: { x: 45, y: 64, verticalAlign: 'center' },
    });
  });
});

describe('restackedRootY', () => {
  // The other line (the original text) is currently drawn at 838.8–898.8: center 868.8 → 80.4%.
  const rest = [{ ...hit(868.8, 60), itemId: 'o' }];

  it('when the block anchor is center (or unset), the root-style anchor line becomes the other line\'s current center', () => {
    expect(restackedRootY({ y: 86 }, 'translation', rest, canvas)).toBe(80.4);
    expect(restackedRootY({ y: 50, verticalAlign: 'center' }, 'translation', rest, canvas)).toBe(80.4);
  });

  it('top and bottom alignment, an undrawn other line or more than one item, or the other line already positioned on its own: nothing moves', () => {
    expect(restackedRootY({ verticalAlign: 'bottom' }, 'translation', rest, canvas)).toBeNull();
    expect(restackedRootY({ verticalAlign: 'top' }, 'translation', rest, canvas)).toBeNull();
    expect(restackedRootY({}, 'translation', [], canvas)).toBeNull();
    expect(restackedRootY({}, 'translation', [...rest, { ...hit(500, 60), itemId: 'p' }], canvas)).toBeNull();
    expect(restackedRootY({ origStyle: { x: 50, y: 30 } }, 'translation', rest, canvas)).toBeNull();
    // The override that only has y is still in the stack.
    expect(restackedRootY({ origStyle: { y: 30 } }, 'translation', rest, canvas)).toBe(80.4);
  });
});

describe('the whole process of dragging one line alone', () => {
  it('starting from the box, holding without moving or dragging back to the start gives a final value equal to the start (releasing writes no document, and the line does not leave the stack)', () => {
    const box = { x: 560, y: 868.8, w: 800, h: 60 };
    const { x0, y0 } = lineMoveStart({}, 'translation', box, canvas);
    const move = { box, x0, y0, p0: { x: 960, y: 900 } };
    expect(stepCaptionMove(move, { x: 960, y: 900 }, loose, env)).toMatchObject({ x: x0, y: y0 });
    const moved = stepCaptionMove(move, { x: 960, y: 900 - 108 }, loose, env);
    expect(moved).toMatchObject({ x: 50, y: 73.2 });
  });
});
