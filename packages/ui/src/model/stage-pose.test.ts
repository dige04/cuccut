import { describe, expect, it } from 'vitest';
import {
  aabbOf,
  cornerScale,
  cornerScales,
  dragMove,
  dragRotation,
  edgeResize,
  groupScale,
  groupShift,
  guidesFor,
  handlesFor,
  marqueeRect,
  moveLimits,
  nudgeDelta,
  oppositeCorner,
  pivotOf,
  placeFields,
  posable,
  poseContains,
  poseOf,
  rectsCross,
  resizeCursor,
  resizeKindOf,
  sizeRange,
  smallHandles,
  snapMove,
  snapRotation,
  type Assets,
  type PlacedItem,
  type Pose,
} from './stage-pose.ts';

const canvas = { width: 1920, height: 1080 };
const range = sizeRange(canvas);
const box: Pose = { cx: 500, cy: 300, w: 200, h: 100, rotation: 0 };
const textLimits = { x: [57.6, 1862.4] as [number, number], y: [43.2, 1036.8] as [number, number] };
const item = (type: PlacedItem['type']) => ({ type }) as PlacedItem;
const placed = (fields: Record<string, unknown>) => ({ place: {}, ...fields }) as unknown as PlacedItem;
/** Portrait source (1080 × 1920), version 1. */
const assets = {
  tall: {
    id: 'tall',
    kind: 'video',
    name: '竖拍',
    currentRevision: 1,
    revisions: { 1: { video: { displayWidth: 1080, displayHeight: 1920, pixelAspectRatio: { num: 1, den: 1 } } } },
  },
} as unknown as Assets;
const tallRef = { id: 'tall', revision: 1 };
/** The result of `placeFields` applied on top of `place` (as it looks after the engine writes it to disk). */
const applied = (it: PlacedItem, fields: Record<string, unknown>) => ({ ...it, place: { ...it.place, ...fields } }) as PlacedItem;

describe('place ↔ box', () => {
  it('full-canvas video: the box is the whole canvas, and it can only rotate', () => {
    const video = placed({ type: 'video', mode: 'fullscreen', place: { x: 10, w: 50, rot: 30 } });
    expect(poseOf(video, canvas)).toEqual({ cx: 960, cy: 540, w: 1920, h: 1080, rotation: 30 });
    expect(posable(video, canvas)).toBe(false);
    expect(placeFields(video, { cx: 100, cy: 100, w: 300, h: 300, rotation: 45 }, canvas)).toEqual({ rot: 45 });
    expect(pivotOf(video, canvas)).toEqual({ x: 960, y: 540 });
  });

  it('picture-in-picture video (portrait source): width is w% × scale, height follows the source\'s display aspect ratio; moving and scaling back do not drift', () => {
    const video = placed({ type: 'video', mode: 'pip', assetRef: tallRef, place: { x: 25, y: 50, w: 30 } });
    expect(posable(video, canvas, assets)).toBe(true);
    const pose = poseOf(video, canvas, assets);
    expect(pose).toMatchObject({ cx: 480, cy: 540, w: 576, rotation: 0 });
    expect(pose.h).toBeCloseTo(1024);
    // When the asset cannot be found, the canvas aspect ratio is used.
    expect(poseOf(video, canvas).h).toBeCloseTo(324);
    const target: Pose = { cx: 576, cy: 432, w: 384, h: (384 * 1920) / 1080, rotation: 0 };
    const fields = placeFields(video, target, canvas, assets);
    expect(fields).toEqual({ x: 30, y: 40, w: 20 });
    const back = poseOf(applied(video, fields), canvas, assets);
    expect(back.cx).toBeCloseTo(target.cx);
    expect(back.cy).toBeCloseTo(target.cy);
    expect(back.w).toBeCloseTo(target.w);
    expect(back.h).toBeCloseTo(target.h);
    // Only the height is squashed: written to scaleY, width and position unchanged.
    expect(placeFields(video, { ...pose, h: pose.h / 2 }, canvas, assets)).toEqual({ scaleY: 0.5 });
  });

  it('a shape with h set: box height is h% of the frame height, also multiplied by scale; scale unchanged, box width folds into w', () => {
    const shape = placed({ type: 'shape', shape: { shape: 'rect', h: 10 }, place: { w: 20, scale: 2 } });
    const pose = poseOf(shape, canvas);
    expect(pose).toEqual({ cx: 960, cy: 540, w: 768, h: 216, rotation: 0 });
    expect(placeFields(shape, { ...pose, w: 384 }, canvas)).toEqual({ w: 10 });
    const taller = placeFields(shape, { ...pose, w: 384, h: 432 }, canvas);
    expect(taller).toEqual({ w: 10, scaleY: 2 });
    const back = poseOf(applied(shape, taller), canvas);
    expect(back.w).toBeCloseTo(384);
    expect(back.h).toBeCloseTo(432);
  });

  it('box sticker: height is 0.62 of width; an unchanged box produces no fields', () => {
    const sticker = placed({ type: 'sticker', sticker: { source: 'template', templateId: 'box' } });
    const pose = poseOf(sticker, canvas);
    expect(pose).toMatchObject({ cx: 960, cy: 540, w: 384 });
    expect(pose.h).toBeCloseTo(238.08);
    expect(placeFields(sticker, pose, canvas)).toEqual({});
    const moved = placeFields(sticker, { ...pose, cx: 480, w: 192, h: 119.04 }, canvas);
    expect(moved).toEqual({ x: 25, w: 10 });
    expect(poseOf(applied(sticker, moved), canvas).h).toBeCloseTo(119.04);
  });

  it('sticker and placeholder frames whose media is video are placed by the media; the area left by cropping sets the frame height, matching the frame plan\'s box', () => {
    const sticker = placed({ type: 'sticker', sticker: { source: 'asset' }, assetRef: tallRef });
    expect(poseOf(sticker, canvas, assets)).toMatchObject({ cx: 960, cy: 540, w: 384 });
    expect(poseOf(sticker, canvas, assets).h).toBeCloseTo(682.67, 2);
    const holder = placed({ type: 'placeholder', placeholder: {}, assetRef: tallRef });
    expect(poseOf(holder, canvas, assets)).toEqual({ cx: 960, cy: 540, w: 806.4, h: 259.2, rotation: 0 });
    const cropped = placed({ type: 'video', assetRef: tallRef, crop: { left: 0, top: 0.5, right: 0, bottom: 0 }, place: { w: 30 } });
    expect(poseOf(cropped, canvas, assets).h).toBeCloseTo(512);
  });

  it('text edge drag left and right: only the box width changes, height goes into scaleY; switching back keeps the height unchanged (within three decimal places)', () => {
    const text = placed({ type: 'text', text: '标题', place: { x: 50, y: 50, w: 20 } });
    const pose = poseOf(text, canvas);
    expect(pose).toEqual({ cx: 960, cy: 540, w: 384, h: 384, rotation: 0 });
    const wider = placeFields(text, { ...pose, w: 576 }, canvas);
    expect(wider).toEqual({ w: 30, scaleY: 0.667 });
    const back = poseOf(applied(text, wider), canvas);
    expect(back.w).toBeCloseTo(576);
    expect(back.h).toBeCloseTo(384, 0);
  });

  it('default values per kind: waveform sits at the bottom and fills the width, progress bar 80% × 5%; angles wrap to ±180', () => {
    expect(poseOf(placed({ type: 'visualizer' }), canvas)).toEqual({ cx: 960, cy: 918, w: 1920, h: 216, rotation: 0 });
    expect(poseOf(placed({ type: 'progress' }), canvas)).toEqual({ cx: 960, cy: 540, w: 1536, h: 54, rotation: 0 });
    const wave = placed({ type: 'visualizer' });
    expect(placeFields(wave, poseOf(wave, canvas), canvas)).toEqual({});
    expect(placeFields(wave, { ...poseOf(wave, canvas), rotation: 370 }, canvas)).toEqual({ rot: 10 });
  });

  it('whether a point is inside a rotated box; the bounding box is computed after rotation', () => {
    const tall = { cx: 500, cy: 300, w: 200, h: 20, rotation: 90 };
    expect(poseContains(tall, { x: 500, y: 390 })).toBe(true);
    expect(poseContains(tall, { x: 590, y: 300 })).toBe(false);
    const r = aabbOf(tall);
    expect(r.w).toBeCloseTo(20);
    expect(r.h).toBeCloseTo(200);
  });
});
describe('capability table and handles', () => {
  it('three tiers: video and composition are free, text gets left/right plus corners, images and shapes get only corners', () => {
    expect(resizeKindOf(item('video'))).toBe('free');
    expect(resizeKindOf(item('composition'))).toBe('free');
    expect(resizeKindOf(item('text'))).toBe('text');
    expect(resizeKindOf(item('image'))).toBe('corner');
    expect(resizeKindOf(item('shape'))).toBe('corner');
  });

  it('if any side is < 24, it falls back to the set with fewer handles', () => {
    expect(handlesFor('free', 100, 100)).toHaveLength(8);
    expect(handlesFor('free', 20, 100)).toEqual(['nw', 's', 'e']);
    expect(handlesFor('text', 100, 100)).toEqual(['w', 'e', 'nw', 'ne', 'sw', 'se']);
    expect(handlesFor('text', 100, 10)).toEqual(['se', 'e']);
    expect(handlesFor('corner', 30, 23)).toEqual(['nw']);
    expect(smallHandles(49, 100)).toBe(true);
    expect(smallHandles(50, 40)).toBe(false);
  });

  it('corners: the free tier changes width and height, the others scale proportionally', () => {
    expect(cornerScales('free', 'se')).toBe(false);
    expect(cornerScales('text', 'se')).toBe(true);
    expect(cornerScales('text', 'e')).toBe(false);
  });

  it('cursor turns with the rotation angle (30° steps)', () => {
    expect(resizeCursor('e', 0)).toBe('e-resize');
    expect(resizeCursor('n', 45)).toBe('ne-resize');
    expect(resizeCursor('n', 90)).toBe('e-resize');
    expect(resizeCursor('n', -90)).toBe('w-resize');
  });
});

describe('move', () => {
  const snap = { canvas, others: [], threshold: 10 };

  it('center within ±1.5% snaps to the canvas center line; with ⌥ (no snapping) it stays as is', () => {
    expect(dragMove(box, 450, 0, textLimits, snap)).toMatchObject({ cx: 960, cy: 300 });
    expect(dragMove(box, 450, 0, textLimits, null)).toMatchObject({ cx: 950, cy: 300 });
  });

  it('clamped to limits', () => {
    expect(dragMove(box, -1000, 0, textLimits, null).cx).toBeCloseTo(57.6);
  });

  it('multi-line snapping: an edge snaps to another object\'s edge and reports that line', () => {
    const others = [{ x: 1200, y: 0, w: 100, h: 100 }];
    const moved = dragMove(box, 593, 0, textLimits, { canvas, others, threshold: 10 });
    expect(moved.cx).toBe(1100);
    expect(snapMove({ x: 993, y: 250, w: 200, h: 100 }, { canvas, others, threshold: 10 })).toEqual({
      dx: 7,
      dy: 0,
      guides: [{ axis: 'x', at: 1200 }],
    });
  });

  it('guide lines: the lines currently snapped to', () => {
    expect(guidesFor({ x: 860, y: 0, w: 200, h: 100 }, canvas, [], 1)).toEqual([
      { axis: 'x', at: 960 },
      { axis: 'y', at: 0 },
    ]);
  });

  it('limits: a video keeps only one visible band; a start outside the limits is relaxed to the starting position', () => {
    const big = { cx: 960, cy: 540, w: 3840, h: 2160, rotation: 0 };
    expect(moveLimits(item('video'), big, canvas).x).toEqual([-1728, 3648]);
    expect(moveLimits(item('text'), box, canvas).x).toEqual(textLimits.x);
    expect(moveLimits(item('text'), { ...box, cx: 10 }, canvas).x).toEqual([10, 1862.4]);
  });
});

describe('edge resize', () => {
  const base = { start: box, alt: false, shift: false, ratio: null, range };

  it('right edge: only grows width, left edge stays put', () => {
    const r = edgeResize({ ...base, handle: 'e', dx: 50, dy: 30 });
    expect(r).toMatchObject({ w: 250, h: 100, cx: 525, cy: 300 });
  });

  it('left edge rotated 90°: the offset projects onto its own axis', () => {
    const r = edgeResize({ ...base, start: { ...box, rotation: 90 }, handle: 'w', dx: 0, dy: 50 });
    expect(r.w).toBeCloseTo(150);
    expect(r.cx).toBeCloseTo(500);
    expect(r.cy).toBeCloseTo(325);
  });

  it('corners lock proportions by default with the opposite corner fixed; ⇧ unlocks', () => {
    const locked = edgeResize({ ...base, handle: 'se', dx: 40, dy: 0 });
    expect(locked.w / locked.h).toBeCloseTo(2);
    expect(locked.cx - locked.w / 2).toBeCloseTo(400);
    expect(locked.cy - locked.h / 2).toBeCloseTo(250);
    expect(edgeResize({ ...base, handle: 'se', dx: 40, dy: 0, shift: true })).toMatchObject({ w: 240, h: 100 });
  });

  it('⌥ scales symmetrically around the center, with the offset counted twice', () => {
    expect(edgeResize({ ...base, handle: 'e', dx: 50, dy: 0, alt: true })).toMatchObject({ w: 300, cx: 500 });
  });

  it('not narrower than 2% of the canvas; the opposite edge still stays put', () => {
    const r = edgeResize({ ...base, handle: 'e', dx: -500, dy: 0 });
    expect(r.w).toBeCloseTo(38.4);
    expect(r.cx - r.w / 2).toBeCloseTo(400);
  });
});

describe('corner proportional scaling', () => {
  it('anchored at the diagonal: the scale factor is the ratio of distances to the diagonal corner, which stays put', () => {
    const { pose, factor } = cornerScale(box, 'se', { x: 600, y: 350 }, { x: 700, y: 400 }, false);
    expect(factor).toBeCloseTo(1.5);
    expect(pose.w).toBeCloseTo(300);
    expect(pose.cx - pose.w / 2).toBeCloseTo(400);
    expect(pose.cy - pose.h / 2).toBeCloseTo(250);
  });

  it('⌥ anchors at the center', () => {
    const { pose, factor } = cornerScale(box, 'se', { x: 600, y: 350 }, { x: 700, y: 400 }, true);
    expect(factor).toBeCloseTo(2);
    expect(pose).toMatchObject({ cx: 500, cy: 300 });
  });

  it('scale factor clamped to at least 0.1', () => {
    expect(cornerScale(box, 'se', { x: 600, y: 350 }, { x: 400.5, y: 250.2 }, false).factor).toBe(0.1);
  });

  it('the diagonal follows the rotation', () => {
    const p = oppositeCorner({ ...box, rotation: 90 }, 'se');
    expect(p.x).toBeCloseTo(550);
    expect(p.y).toBeCloseTo(200);
  });
});

describe('rotation', () => {
  it('15° grid; ⇧ free with one decimal place', () => {
    expect(snapRotation(7.4, false)).toBe(0);
    expect(snapRotation(7.6, false)).toBe(15);
    expect(snapRotation(-172, false)).toBe(-165);
    expect(snapRotation(-173, false)).toBe(180);
    expect(snapRotation(370, false)).toBe(15);
    expect(snapRotation(33.33, true)).toBe(33.3);
  });

  it('the angle the pointer turns around the pivot', () => {
    expect(dragRotation(0, { x: 500, y: 300 }, { x: 500, y: 200 }, { x: 600, y: 300 }, false)).toBe(90);
    expect(dragRotation(30, { x: 500, y: 300 }, { x: 500, y: 200 }, { x: 400, y: 300 }, false)).toBe(-60);
  });
});

describe('multi-select', () => {
  it('whole move: the offset is clamped so the whole group stays valid', () => {
    const starts = [
      { ...box, cx: 100 },
      { ...box, cx: 1800 },
    ];
    const d = groupShift(starts, [textLimits, textLimits], -100, 0);
    expect(d.x).toBeCloseTo(-42.4);
    expect(d.y).toBe(0);
  });

  it('whole scale: around the shared box center, handles follow the pointer', () => {
    const starts = [
      { cx: 400, cy: 300, w: 100, h: 100, rotation: 0 },
      { cx: 600, cy: 300, w: 100, h: 100, rotation: 15 },
    ];
    const { poses, factor } = groupScale(starts, { x: 350, y: 250, w: 300, h: 100 }, { x: 650, y: 350 }, { x: 800, y: 400 });
    expect(factor).toBeCloseTo(2);
    expect(poses.map((p) => [p.cx, p.w, p.rotation])).toEqual([
      [300, 200, 0],
      [700, 200, 15],
    ]);
  });
});

describe('keyboard and marquee selection', () => {
  it('arrow keys move 1%, ⇧ 5%, ⌥↑/↓ 0.1%; ⌥←/→ is left to time', () => {
    expect(nudgeDelta('ArrowLeft', false, false, canvas)).toEqual({ x: -19.2, y: 0 });
    expect(nudgeDelta('ArrowRight', true, false, canvas)).toEqual({ x: 96, y: 0 });
    expect(nudgeDelta('ArrowUp', false, true, canvas)?.y).toBeCloseTo(-1.08);
    expect(nudgeDelta('ArrowLeft', false, true, canvas)).toBeNull();
    expect(nudgeDelta('a', false, false, canvas)).toBeNull();
  });

  it('marquee within 4px is still a click; intersecting does not count as edge-touching', () => {
    expect(marqueeRect({ x: 10, y: 10 }, { x: 12, y: 13 }).on).toBe(false);
    expect(marqueeRect({ x: 10, y: 10 }, { x: 6, y: 20 })).toEqual({ x: 6, y: 10, w: 4, h: 10, on: true });
    expect(rectsCross({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(rectsCross({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
});
