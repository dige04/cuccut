import { describe, expect, it } from 'vitest';
import type { Sequence, SequenceItem } from '@cuccut/protocol';
import type { VisualLayer } from '../render/frame-plan.ts';
import { hitAt, isMainVideo, layerContains, marqueeHits, marqueeSelection, unitPoint, visibleItems } from './stage-hit.ts';
import { poseContains } from './stage-pose.ts';

type Matrix = VisualLayer['matrix'];

/** Same formula as `placement` in render-graph: a box with a center anchor rotates clockwise around the anchor. */
function placed(cx: number, cy: number, w: number, h: number, deg = 0): Matrix {
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const qx = -w / 2;
  const qy = -h / 2;
  return [w * cos, w * sin, -h * sin, h * cos, cx + qx * cos - qy * sin, cy + qx * sin + qy * cos];
}

const layer = (itemId: string, kind: VisualLayer['kind'], matrix: Matrix) => ({ itemId, kind, matrix, opacity: 1 }) as VisualLayer;

describe('inverse transform of a layer', () => {
  it('a point maps back to the unit square; a degenerate matrix gives null', () => {
    expect(unitPoint([200, 0, 0, 100, 100, 50], { x: 200, y: 100 })).toEqual({ x: 0.5, y: 0.5 });
    expect(unitPoint([0, 0, 0, 0, 10, 10], { x: 10, y: 10 })).toBeNull();
  });

  it('rotated layer: judged along its own axes', () => {
    const tall = layer('a', 'text', placed(500, 300, 200, 100, 90));
    expect(layerContains(tall, { x: 500, y: 300 })).toBe(true);
    expect(layerContains(tall, { x: 500, y: 390 })).toBe(true);
    expect(layerContains(tall, { x: 590, y: 300 })).toBe(false);
  });
});

describe('point selection', () => {
  const layers = [
    layer('main', 'video', placed(960, 540, 1920, 1080)),
    layer('pip', 'video', placed(400, 300, 200, 100)),
    layer('logo', 'image', placed(420, 300, 100, 100)),
    layer('subs', 'caption', placed(960, 540, 1920, 1080)),
  ];

  it('top to bottom, the first item covering the point wins; subtitle layers are skipped', () => {
    expect(hitAt(layers, { x: 420, y: 300 })).toBe('logo');
    expect(hitAt(layers, { x: 330, y: 300 })).toBe('pip');
    expect(hitAt(layers, { x: 1500, y: 900 })).toBe('main');
  });

  it('a skipped item (an unselected main video) does not take part', () => {
    expect(hitAt(layers, { x: 1500, y: 900 }, { skip: (id) => id === 'main' })).toBeNull();
  });

  it('a selected item is measured by its layout box (a "fit" picture only fills part of the box)', () => {
    const boxes = new Map([['pip', { cx: 400, cy: 300, w: 300, h: 200, rotation: 0 }]]);
    const at = { x: 280, y: 250 };
    expect(hitAt(layers, at, { skip: (id) => id === 'main' })).toBeNull();
    expect(hitAt(layers, at, { skip: (id) => id === 'main', boxes, contains: poseContains })).toBe('pip');
  });

  it('instances on this frame: bottom to top, no duplicates, no subtitles', () => {
    expect(visibleItems([...layers, layer('pip', 'video', placed(0, 0, 1, 1))])).toEqual(['main', 'pip', 'logo']);
  });
});

describe('main video and marquee selection', () => {
  const sequence = {
    tracks: [
      { id: 'v2', order: 1, kind: 'visual' },
      { id: 'a1', order: 0, kind: 'audio' },
      { id: 'v1', order: 0, kind: 'visual' },
    ],
  } as unknown as Sequence;
  const item = (type: string, trackId: string, role?: string) => ({ type, trackId, role }) as SequenceItem;

  it('the video on the bottom picture track, or a video marked a-roll', () => {
    expect(isMainVideo(item('video', 'v1'), sequence)).toBe(true);
    expect(isMainVideo(item('video', 'v2'), sequence)).toBe(false);
    expect(isMainVideo(item('video', 'v2', 'a-roll'), sequence)).toBe(true);
    expect(isMainVideo(item('image', 'v1'), sequence)).toBe(false);
  });

  it('marquee selection picks up the items that intersect', () => {
    const candidates = [
      { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 } },
      { id: 'b', rect: { x: 200, y: 0, w: 100, h: 100 } },
      { id: 'c', rect: { x: 100, y: 100, w: 10, h: 10 } },
    ];
    expect(marqueeHits(candidates, { x: 50, y: 50, w: 100, h: 20 })).toEqual(['a']);
    expect(marqueeHits(candidates, { x: 50, y: 50, w: 200, h: 100 })).toEqual(['a', 'b', 'c']);
  });

  it('marquee result: if only subtitles are framed, the subtitles (both bilingual lines) are selected; if subtitles and elements are both framed, only the elements remain; appending merges with the original selection', () => {
    const isCaption = (id: string) => id === 'orig' || id === 'trans';
    expect(marqueeSelection([], ['orig', 'trans'], isCaption)).toEqual(['orig', 'trans']);
    expect(marqueeSelection([], ['logo', 'orig'], isCaption)).toEqual(['logo']);
    expect(marqueeSelection(['orig'], ['trans', 'orig'], isCaption)).toEqual(['orig', 'trans']);
    expect(marqueeSelection(['logo'], ['orig'], isCaption)).toEqual(['logo']);
    expect(marqueeSelection([], [], isCaption)).toEqual([]);
  });
});

describe('subtitles\' real line boxes', () => {
  const layers = [
    layer('main', 'video', placed(960, 540, 1920, 1080)),
    layer('orig', 'caption', placed(960, 540, 1920, 1080)),
    layer('trans', 'caption', placed(960, 540, 1920, 1080)),
  ];
  const original = { layerId: 'orig', itemId: 'orig', documentId: 'doc_orig', cueId: 'c1', cx: 960, cy: 900, w: 800, h: 50, rotation: 0 };
  const translation = { ...original, itemId: 'trans', documentId: 'doc_trans', cy: 960 };
  const captionHits = [original, translation];

  it('with the video already selected, the source and translation still hit their own instances; outside the line still selects the video', () => {
    const boxes = new Map([['main', { cx: 960, cy: 540, w: 1920, h: 1080, rotation: 0 }]]);
    const options = { captionHits, boxes, contains: poseContains };
    expect(hitAt(layers, { x: 960, y: 900 }, options)).toBe('orig');
    expect(hitAt(layers, { x: 960, y: 960 }, options)).toBe('trans');
    expect(hitAt(layers, { x: 960, y: 800 }, options)).toBe('main');
  });

  it('no subtitles are wrongly selected when there is no visible sentence, the subtitle layer is hidden, or an element above covers it', () => {
    expect(hitAt(layers, { x: 960, y: 900 }, { captionHits: [] })).toBe('main');
    expect(hitAt(layers.slice(0, 1), { x: 960, y: 900 }, { captionHits })).toBe('main');
    expect(hitAt([...layers, layer('logo', 'image', placed(960, 900, 100, 100))], { x: 960, y: 900 }, { captionHits })).toBe('logo');
    expect(hitAt(layers, { x: 960, y: 900 }, { captionHits, skip: (id) => id === 'orig' })).toBe('main');
  });

  it('rotated lines are judged by their real angle, not by an axis-aligned bounding box', () => {
    const rotated = [{ ...original, rotation: 90 }];
    expect(hitAt(layers, { x: 960, y: 600 }, { captionHits: rotated })).toBe('orig');
    expect(hitAt(layers, { x: 1200, y: 900 }, { captionHits: rotated })).toBe('main');
  });
});
