import { describe, expect, it } from 'vitest';
import { applyPanel, boxOf, defaultPin, fieldsOf, fitCanvas, project, quick, wrapRotation, type Pin } from './geometry-panel.ts';
import type { Pose } from './stage-pose.ts';

const canvas = { width: 1920, height: 1080 };

/** Box: center and size (canvas pixels). */
function pose(cx: number, cy: number, w: number, h: number, rotation = 0): Pose {
  return { cx, cy, w, h, rotation };
}

describe('geometry section: box and canvas box', () => {
  it('box is center and size: converted to top-left and width/height as canvas percentages', () => {
    expect(boxOf(pose(960, 540, 1920, 1080), canvas)).toEqual({ l: 0, t: 0, w: 100, h: 100 });
    expect(boxOf(pose(480, 270, 960, 540), canvas)).toEqual({ l: 0, t: 0, w: 50, h: 50 });
  });

  it('canvas box converted back to center and size', () => {
    expect(fieldsOf({ l: 0, t: 0, w: 50, h: 50 }, canvas)).toEqual({ cx: 480, cy: 270, w: 960, h: 540 });
    expect(fieldsOf({ l: 25, t: 50, w: 50, h: 25 }, canvas)).toEqual({ cx: 960, cy: 675, w: 960, h: 270 });
  });

  it('pin projection: left pin measures to the left edge, center pin measures the midline offset, right pin measures to the right edge', () => {
    const box = boxOf(pose(1440, 540, 480, 270), canvas);
    expect(project(box, { x: 'left', y: 'top' })).toEqual({ x: 62.5, y: 37.5, w: 25, h: 25 });
    expect(project(box, { x: 'center', y: 'middle' })).toEqual({ x: 25, y: 0, w: 25, h: 25 });
    expect(project(box, { x: 'right', y: 'bottom' })).toEqual({ x: 12.5, y: 37.5, w: 25, h: 25 });
  });

  it('default pin uses the nearest line; ties go to left / top', () => {
    expect(defaultPin({ l: 2, t: 80, w: 20, h: 10 })).toEqual({ x: 'left', y: 'bottom' });
    expect(defaultPin({ l: 40, t: 45, w: 20, h: 10 })).toEqual({ x: 'center', y: 'middle' });
    expect(defaultPin({ l: 0, t: 0, w: 100, h: 100 })).toEqual({ x: 'left', y: 'top' });
  });
});

describe('geometry section: commit', () => {
  const pin: Pin = { x: 'right', y: 'bottom' };

  it('a right-pinned box that widens grows to the left, right margin unchanged; the unchanged dimension is kept as is', () => {
    const t = pose(1440, 540, 480, 270);
    const values = project(boxOf(t, canvas), pin);
    const next = applyPanel(t, canvas, pin, { ...values, w: 50 }, false);
    expect(next).toEqual({ cx: 1200, cy: 540, w: 960, h: 270 });
    expect(project(boxOf({ ...t, ...next }, canvas), pin).x).toBe(values.x);
  });

  it('locked aspect ratio: changing only the width scales the height proportionally', () => {
    const t = pose(960, 540, 960, 540);
    const center: Pin = { x: 'center', y: 'middle' };
    const values = project(boxOf(t, canvas), center);
    expect(applyPanel(t, canvas, center, { ...values, w: 25 }, true)).toEqual({ cx: 960, cy: 540, w: 480, h: 270 });
  });

  it('width is at least 2% of the canvas', () => {
    const t = pose(960, 540, 960, 540);
    const center: Pin = { x: 'center', y: 'middle' };
    expect(applyPanel(t, canvas, center, { ...project(boxOf(t, canvas), center), w: 0 }, false).w).toBe(38.4);
  });

  it('change position: with a center-pinned X of 0 the box returns to horizontal center', () => {
    const t = pose(1260, 640, 480, 270);
    const center: Pin = { x: 'center', y: 'middle' };
    const values = project(boxOf(t, canvas), center);
    expect(applyPanel(t, canvas, center, { ...values, x: 0 }, false)).toEqual({ cx: 960, cy: 640, w: 480, h: 270 });
  });

  it('full width: pin moves to the left, box fills the canvas width', () => {
    const t = pose(1260, 640, 480, 270);
    const q = quick({ x: 'center', y: 'middle' }, project(boxOf(t, canvas), { x: 'center', y: 'middle' }), 'fullWidth');
    expect(q.pin).toEqual({ x: 'left', y: 'middle' });
    expect(applyPanel(t, canvas, q.pin, q.values, false)).toEqual({ cx: 960, cy: 640, w: 1920, h: 270 });
  });
});

describe('fit / fill canvas and rotation', () => {
  it('scale proportionally and recenter', () => {
    const t = pose(1260, 640, 400, 400);
    expect(fitCanvas(t, canvas, false)).toEqual({ cx: 960, cy: 540, w: 1080, h: 1080 });
    expect(fitCanvas(t, canvas, true)).toEqual({ cx: 960, cy: 540, w: 1920, h: 1920 });
  });

  it('a rotated box scales by its unrotated width and height, center returned to canvas center', () => {
    expect(fitCanvas(pose(0, 0, 400, 200, 90), canvas, false)).toEqual({ cx: 960, cy: 540, w: 1920, h: 960 });
  });

  it('rotation angle wrapped to (−180, 180]', () => {
    expect(wrapRotation(190)).toBe(-170);
    expect(wrapRotation(-180)).toBe(180);
    expect(wrapRotation(540)).toBe(180);
    expect(wrapRotation(-30)).toBe(-30);
  });
});
