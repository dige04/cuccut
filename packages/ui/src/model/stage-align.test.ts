import { describe, expect, it } from 'vitest';
import type { Place } from '@cuccut/protocol';
import { alignOperations, distributeOperations } from './stage-align.ts';
import type { Assets, PlacedItem } from './stage-pose.ts';

const canvas = { width: 1920, height: 1080 };
/** Rectangle shape whose top-left corner is at (`left`%, `top`%) on the canvas, with width `w`% and height `h`% (percentages of the frame); `place.x` and `place.y` are the box center. */
const at = (id: string, left: number, top: number, w = 5, h = 5, patch: Partial<Place> = {}) =>
  ({
    id,
    type: 'shape',
    shape: { shape: 'rect', h },
    place: { x: left + w / 2, y: top + h / 2, w, ...patch },
  }) as unknown as PlacedItem;

describe('alignment', () => {
  it('align left to selection: all align to the left edge of the leftmost item, writing only x', () => {
    const items = [at('a', 5, 10), at('b', 15, 20), at('c', 12, 40, 10)];
    expect(alignOperations('s', items, 'left', 'selection', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'b', x: 7.5 },
      { type: 'setTransform', sequenceId: 's', itemId: 'c', x: 10 },
    ]);
  });

  it('align left to canvas: snaps to the canvas\'s left edge', () => {
    const items = [at('a', 5, 10), at('b', 15, 20)];
    expect(alignOperations('s', items, 'left', 'canvas', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', x: 2.5 },
      { type: 'setTransform', sequenceId: 's', itemId: 'b', x: 2.5 },
    ]);
  });

  it('align right, horizontal center, bottom align', () => {
    const items = [at('a', 5, 10), at('b', 15, 20, 10)];
    expect(alignOperations('s', items, 'right', 'selection', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', x: 22.5 },
    ]);
    // Selection 5–25, midline 15.
    expect(alignOperations('s', items, 'hcenter', 'selection', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', x: 15 },
      { type: 'setTransform', sequenceId: 's', itemId: 'b', x: 15 },
    ]);
    expect(alignOperations('s', items, 'vcenter', 'canvas', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', y: 50 },
      { type: 'setTransform', sequenceId: 's', itemId: 'b', y: 50 },
    ]);
    expect(alignOperations('s', items, 'bottom', 'selection', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', y: 22.5 },
    ]);
  });

  it('measured by the rotated bounding box: a box rotated 90° aligns by its vertical width and height', () => {
    const items = [at('a', 5, 10), at('b', 20, 30, 10, 5, { rot: 90 })];
    // b is 192 wide and 54 high, centered at 480: the bounding box's left edge is at 453; aligned to 96, the center moves to 123 (6.4%).
    expect(alignOperations('s', items, 'left', 'selection', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'b', x: 6.4 },
    ]);
  });

  it('already aligned items produce no operation; changing y never writes x', () => {
    const items = [at('a', 5, 10), at('b', 5, 30)];
    expect(alignOperations('s', items, 'left', 'selection', canvas)).toEqual([]);
    for (const op of alignOperations('s', [at('a', 5, 10), at('b', 15, 30)], 'top', 'selection', canvas)) {
      expect(op).not.toHaveProperty('x');
      expect(op).not.toHaveProperty('w');
    }
  });

  it('picture-in-picture video frame height is measured by the source aspect ratio (must be given to the media table)', () => {
    const video = {
      id: 'v',
      type: 'video',
      mode: 'pip',
      assetRef: { id: 'tall', revision: 1 },
      place: { x: 50, y: 50, w: 10 },
    } as unknown as PlacedItem;
    const assets = {
      tall: {
        id: 'tall',
        kind: 'video',
        revisions: { 1: { video: { displayWidth: 1080, displayHeight: 1920, pixelAspectRatio: { num: 1, den: 1 } } } },
      },
    } as unknown as Assets;
    // Portrait shot: width 192, height 341.3; with the bottom edge at 1080 the center is at 909.3 (84.2%). Without an asset table, the canvas aspect ratio is used (height 108).
    expect(alignOperations('s', [video], 'bottom', 'canvas', canvas, assets)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'v', y: 84.2 },
    ]);
    expect(alignOperations('s', [video], 'bottom', 'canvas', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'v', y: 95 },
    ]);
  });
});

describe('distribution', () => {
  it('relative to selection: first and last stay put, the middle item makes the gaps on both sides equal', () => {
    const items = [at('a', 0, 0), at('c', 50, 0), at('b', 10, 0)];
    // 0–5, b is 5 wide, 50–55: gap (55 − 15) / 2 = 20, b lands at 25.
    expect(distributeOperations('s', items, 'x', 'selection', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'b', x: 27.5 },
    ]);
  });

  it('relative to canvas: first item snaps to the start edge, last to the end edge, vertical writes only y', () => {
    const items = [at('a', 0, 10), at('b', 0, 30), at('c', 0, 50)];
    // Height 5 × 3, gap (100 − 15) / 2 = 42.5: 0, 47.5, 95.
    expect(distributeOperations('s', items, 'y', 'canvas', canvas)).toEqual([
      { type: 'setTransform', sequenceId: 's', itemId: 'a', y: 2.5 },
      { type: 'setTransform', sequenceId: 's', itemId: 'b', y: 50 },
      { type: 'setTransform', sequenceId: 's', itemId: 'c', y: 97.5 },
    ]);
  });

  it('fewer than three items are not distributed; already evenly spaced items produce no operation', () => {
    expect(distributeOperations('s', [at('a', 0, 0), at('b', 25, 0)], 'x', 'selection', canvas)).toEqual([]);
    expect(distributeOperations('s', [at('a', 0, 0), at('b', 20, 0), at('c', 40, 0)], 'x', 'selection', canvas)).toEqual([]);
  });
});
