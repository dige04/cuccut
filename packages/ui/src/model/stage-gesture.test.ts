import { describe, expect, it } from 'vitest';
import type { Place } from '@cuccut/protocol';
import { gestureOperations, gesturePatch, memberOf, nudgeOperations, resetRotation, scaledFontSize, stepGesture } from './stage-gesture.ts';
import { aabbOf, boundsOf, pivotOf, type PlacedItem } from './stage-pose.ts';

const canvas = { width: 1920, height: 1080 };
const env = { canvas, others: [], pxScale: 2 };
const free = { shift: false, alt: false };
/** A box centered at (480, 270) with width 192; the image's height follows the canvas aspect ratio (108), the text is square. */
const box = (patch: Partial<Place> = {}): Place => ({ x: 25, y: 25, w: 10, ...patch });
const text = (patch: Partial<Place> = {}, style: Record<string, unknown> = { fontSize: 40 }) =>
  ({ id: 't', type: 'text', text: '标题', place: box(patch), style }) as unknown as PlacedItem;
const image = (id: string, patch: Partial<Place> = {}) => ({ id, type: 'image', mode: 'pip', place: box(patch) }) as unknown as PlacedItem;

describe('single-item gestures', () => {
  it('move: snaps to the canvas center line; ⌥ disables snapping', () => {
    const member = memberOf(image('a'), canvas);
    const g = { kind: 'move' as const, member, p0: { x: 480, y: 270 } };
    const snapped = stepGesture(g, { x: 955, y: 270 }, free, env);
    expect(snapped.poses[0]).toMatchObject({ cx: 960, cy: 270 });
    expect(snapped.guides).toContainEqual({ axis: 'x', at: 960 });
    expect(stepGesture(g, { x: 955, y: 270 }, { shift: false, alt: true }, env).poses[0]).toMatchObject({ cx: 955 });
  });

  it('rotate around center: turns 90°, center stays put, only the angle is written', () => {
    const item = image('a');
    const member = memberOf(item, canvas);
    const pivot = pivotOf(item, canvas);
    expect(pivot).toEqual({ x: 480, y: 270 });
    const g = { kind: 'rotate' as const, member, pivot, p0: { x: 480, y: 170 } };
    const { poses } = stepGesture(g, { x: 580, y: 270 }, free, env);
    expect(poses[0]).toMatchObject({ cx: 480, cy: 270, rotation: 90 });
    expect(gestureOperations('s', [member], poses, 1, canvas)).toEqual([{ type: 'setTransform', sequenceId: 's', itemId: 'a', rot: 90 }]);
  });

  it('proportional corner scaling: text font size scales with it, and the draft and commit are the same', () => {
    const item = text();
    const member = memberOf(item, canvas);
    const g = { kind: 'corner' as const, member, handle: 'se' as const, p0: { x: 576, y: 366 } };
    const frame = stepGesture(g, { x: 672, y: 462 }, free, env);
    expect(frame.factor).toBeCloseTo(1.5);
    const patch = gesturePatch(item, frame.poses[0]!, frame.factor, canvas);
    expect(patch.style).toMatchObject({ fontSize: 60 });
    const ops = gestureOperations('s', [member], frame.poses, frame.factor, canvas);
    expect(ops.map((op) => op.type)).toEqual(['setTransform', 'setStyle']);
    // The diagonal corner (top-left) stays fixed: width 15%, the center moves toward the bottom-right; a square box does not write scaleY.
    expect(ops[0]).toEqual({ type: 'setTransform', sequenceId: 's', itemId: 't', x: 27.5, y: 29.4, w: 15 });
    expect(patch.place).toEqual({ x: 27.5, y: 29.4, w: 15 });
  });

  it('edge resize: text\'s right edge changes only the box width (height goes into scaleY), font size stays', () => {
    const member = memberOf(text(), canvas);
    const g = { kind: 'edge' as const, member, handle: 'e' as const, p0: { x: 576, y: 270 } };
    const frame = stepGesture(g, { x: 626, y: 300 }, free, env);
    const ops = gestureOperations('s', [member], frame.poses, frame.factor, canvas);
    expect(ops).toEqual([{ type: 'setTransform', sequenceId: 's', itemId: 't', x: 26.3, w: 12.6, scaleY: 0.794 }]);
  });

  it('untouched: no operation', () => {
    const member = memberOf(image('a'), canvas);
    expect(gestureOperations('s', [member], [member.start], 1, canvas)).toEqual([]);
  });
});

describe('multi-select gestures', () => {
  it('whole move: the offset is clamped for the whole group', () => {
    const members = [memberOf(image('a', { x: 3.125 }), canvas), memberOf(image('b'), canvas)];
    const g = { kind: 'group-move' as const, members, p0: { x: 0, y: 0 } };
    const { poses } = stepGesture(g, { x: -200, y: 0 }, free, env);
    // a's center is at 60, the limit's left end is 57.6: the group can only move 2.4 further left.
    expect(poses.map((p) => p.cx)).toEqual([57.6, 477.6]);
  });

  it('whole scale: one entry per item in a single stroke, text font size changed separately', () => {
    const members = [memberOf(image('a', { x: 20 }), canvas), memberOf(text({ x: 30 }), canvas)];
    const bounds = boundsOf(members.map((m) => aabbOf(m.start)))!;
    const g = { kind: 'group-scale' as const, members, bounds, p0: { x: bounds.x + bounds.w, y: bounds.y + bounds.h } };
    // Scale around the center of the bounding box: drag until the pointer is twice as far from the center.
    const frame = stepGesture(g, { x: bounds.x + 1.5 * bounds.w, y: bounds.y + 1.5 * bounds.h }, free, env);
    expect(frame.factor).toBeCloseTo(2);
    const ops = gestureOperations('s', members, frame.poses, frame.factor, canvas);
    expect(ops.map((op) => `${op.type}:${'itemId' in op ? op.itemId : ''}`)).toEqual(['setTransform:a', 'setTransform:t', 'setStyle:t']);
  });
});

describe('keyboard and reset', () => {
  it('nudge: same offset, only position is written', () => {
    const ops = nudgeOperations('s', [image('a'), image('b', { y: 50 })], { x: 19.2, y: 0 }, canvas);
    expect(ops).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', x: 26 },
      { type: 'setTransform', sequenceId: 's', itemId: 'b', x: 26 },
    ]);
  });

  it('rotation reset: a 0° change is not committed', () => {
    expect(resetRotation('s', image('a'))).toEqual([]);
    expect(resetRotation('s', image('a', { rot: 30 }))).toEqual([{ type: 'setTransform', sequenceId: 's', itemId: 'a', rot: 0 }]);
  });

  it('font size: clamped to 1–400; unrecognized styles stay as they are', () => {
    expect(scaledFontSize(text({}, { fontSize: 300 }), 2)).toBe(400);
    expect(scaledFontSize(text({}, {}), 0.5)).toBe(15);
    expect(scaledFontSize(text({}, { schema: 'other/1' }), 2)).toBeNull();
    expect(scaledFontSize(image('a'), 2)).toBeNull();
  });
});
