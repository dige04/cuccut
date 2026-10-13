import { describe, expect, it } from 'vitest';
import type { AudioItem, CaptionItem, Sequence, Track, VideoItem } from '@cuccut/protocol';
import { itemBox, marqueeItems, marqueeSelection, type MarqueeLayout } from './timeline-marquee.ts';

const fps = { num: 30, den: 1 };

function track(id: string, order: number, kind: Track['kind'], locked = false): Track {
  return { id, order, kind, locked, visible: true, muted: false, solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' } };
}

function video(id: string, trackId: string, fromFrame: number, durationFrames: number, locked = false): VideoItem {
  return {
    id,
    trackId,
    type: 'video',
    enabled: true,
    locked,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'asset_v', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 30 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

/** Audio is placed by seconds (the start point may fall between frames). */
function audio(id: string, trackId: string, startSeconds: number, seconds: number): AudioItem {
  const fromFrame = Math.floor(startSeconds * 30);
  return {
    id,
    trackId,
    type: 'audio',
    enabled: true,
    locked: false,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    assetRef: { id: 'asset_a', revision: '1' },
    fromFrame,
    subframeOffset: { ticks: String(Math.round((startSeconds - fromFrame / 30) * 1000)), timescale: 1000 },
    playDuration: { ticks: String(Math.round(seconds * 1000)), timescale: 1000 },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } },
    mix: { volume: 1 },
  };
}

function sequence(tracks: Track[], items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps,
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks,
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  };
}

// Row header 144, left margin 12, 10 pixels per second; ruler 24 high, visual row 64, audio row 48.
const layout: MarqueeLayout = {
  head: 144,
  pad: 12,
  pxPerSecond: 10,
  lanes: [
    { trackId: 'v1', top: 24, height: 64 },
    { trackId: 'a1', top: 88, height: 48 },
    { trackId: 'a2', top: 136, height: 48 },
  ],
};

const seq = sequence(
  [track('v1', 0, 'visual'), track('a1', 0, 'audio'), track('a2', 1, 'audio', true)],
  [video('clip1', 'v1', 0, 300), video('clip2', 'v1', 300, 150), audio('voice', 'a1', 2.5, 4), audio('music', 'a2', 0, 20)],
);

describe('timeline marquee selection', () => {
  it('instance box: time range × full row, converted to content coordinates in seconds (audio start can fall between frames)', () => {
    expect(itemBox(seq, 'clip2', layout)).toEqual({ x: 144 + 12 + 100, y: 24, w: 50, h: 64 });
    const voice = itemBox(seq, 'voice', layout)!;
    expect(voice.x).toBeCloseTo(144 + 12 + 25);
    expect(voice.w).toBeCloseTo(40);
    expect(voice.y).toBe(88);
    expect(itemBox(seq, 'missing', layout)).toBeNull();
  });

  it('marquee across tracks selects everything it covers, except on locked tracks', () => {
    // Spans 8–12 seconds horizontally, and the visual row and two audio rows vertically
    const rect = { x: 156 + 80, y: 30, w: 40, h: 140 };
    expect(marqueeItems(seq, layout, rect)).toEqual(['clip1', 'clip2']);
    // Only frames 3–4 seconds on the dubbing row
    expect(marqueeItems(seq, layout, { x: 156 + 30, y: 100, w: 10, h: 10 })).toEqual(['voice']);
  });

  it('touching an edge doesn\'t count; locked instances are not selected', () => {
    // The right edge sits exactly against clip2's left edge (10 seconds)
    expect(marqueeItems(seq, layout, { x: 156 + 95, y: 30, w: 5, h: 10 })).toEqual(['clip1']);
    const locked = sequence(seq.tracks, [video('clip1', 'v1', 0, 300, true), video('clip2', 'v1', 300, 150)]);
    expect(marqueeItems(locked, layout, { x: 156, y: 30, w: 200, h: 10 })).toEqual(['clip2']);
  });

  it('subtitle instances are not selected: marqueeing over a subtitle row only selects clips on other tracks', () => {
    const caption: CaptionItem = {
      id: 'cap',
      trackId: 's1',
      type: 'caption',
      enabled: true,
      locked: false,
      paintOrder: 0,
      followPolicy: { kind: 'sequence-fixed' },
      span: { fromFrame: 0, durationFrames: 450 },
      documentId: 'doc',
      scopeItemIds: ['clip1', 'clip2'],
    };
    const withCaption = sequence([track('s1', 1, 'subtitle'), ...seq.tracks], [...seq.items, caption]);
    const lanes = [{ trackId: 's1', top: 24, height: 40 }, ...layout.lanes.map((lane) => ({ ...lane, top: lane.top + 40 }))];
    expect(marqueeItems(withCaption, { ...layout, lanes }, { x: 156, y: 30, w: 40, h: 60 })).toEqual(['clip1']);
    expect(marqueeItems(withCaption, { ...layout, lanes }, { x: 156, y: 30, w: 40, h: 10 })).toEqual([]);
  });

  it('the rectangle can be dragged from bottom-right to top-left', () => {
    expect(marqueeItems(seq, layout, { x: 156 + 120, y: 110, w: -40, h: -90 })).toEqual(['clip1', 'clip2']);
  });

  it('after changing zoom and scroll: content coordinates follow the zoom, and the rectangle still hits', () => {
    const zoomed = { ...layout, pxPerSecond: 40 };
    // The same rectangle: at 10 px/s it is 30–35 seconds, with nothing there; at 40 px/s it is 7.5–8.75 seconds, landing on clip1
    const rect = { x: 156 + 300, y: 30, w: 50, h: 100 };
    expect(marqueeItems(seq, layout, rect)).toEqual([]);
    expect(marqueeItems(seq, zoomed, rect)).toEqual(['clip1']);
    // At 40 px/s, clip2 is at 400–600 and voice is at 100–260
    expect(marqueeItems(seq, zoomed, { x: 156 + 420, y: 30, w: 10, h: 10 })).toEqual(['clip2']);
    expect(marqueeItems(seq, zoomed, { x: 156 + 250, y: 90, w: 20, h: 10 })).toEqual(['voice']);
  });

  it('⇧ / ⌘ merges into the existing selection (deduplicated), otherwise replaces it with the marqueed items', () => {
    expect(marqueeSelection(['a', 'b'], ['b', 'c'], true)).toEqual(['a', 'b', 'c']);
    expect(marqueeSelection(['a', 'b'], ['b', 'c'], false)).toEqual(['b', 'c']);
    expect(marqueeSelection(['a'], [], false)).toEqual([]);
  });
});
