import { describe, expect, it } from 'vitest';
import type { CaptionItem, Sequence, VideoItem } from '@cuccut/protocol';
import { placeCues, placedCues } from './caption-cues.ts';

const fps = { num: 30, den: 1 };
const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };

function clip(id: string, fromFrame: number, durationFrames: number, sourceInFrames: number): VideoItem {
  return {
    ...base,
    id,
    trackId: 'v1',
    type: 'video',
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'asset_main', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(sourceInFrames), timescale: 30 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

function sequence(items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps,
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks: [],
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  };
}

const cues = [
  { id: 'a', start: 1, end: 2, text: '一' },
  { id: 'b', start: 4, end: 6, text: '二' },
  { id: 'c', start: 11, end: 12, text: '三' },
  { id: 'd', start: 13, end: 14, text: ' ' },
];

describe('caption sentences projected onto the timeline', () => {
  it('projected through the time mapping of the acting instance: cut-out source ranges do not appear, and sentences crossing a cut point are split', () => {
    // The first segment takes source 0–5 s and places it at 0–5 s; the second takes source 10–13 s and places it at 5–8 s.
    const first = clip('v_a', 0, 150, 0);
    const second = clip('v_b', 150, 90, 300);
    const caption: CaptionItem = {
      ...base,
      id: 'cap',
      trackId: 's1',
      type: 'caption',
      span: { fromFrame: 0, durationFrames: 240 },
      documentId: 'doc',
      scopeItemIds: ['v_a', 'v_b'],
    };
    const placed = placeCues(caption, sequence([first, second, caption]), { clock: 'source-asset', cues });
    expect(placed).toEqual([
      { key: 'v_a:a', cueId: 'a', start: 1, end: 2, text: '一' },
      { key: 'v_a:b', cueId: 'b', start: 4, end: 5, text: '二' },
      { key: 'v_b:c', cueId: 'c', start: 6, end: 7, text: '三' },
    ]);
  });

  it('for a document on the sequence clock, use document time directly, clipped to the caption instance\'s range', () => {
    const caption: CaptionItem = {
      ...base,
      id: 'cap',
      trackId: 's1',
      type: 'caption',
      span: { fromFrame: 45, durationFrames: 300 },
      documentId: 'doc',
    };
    const placed = placeCues(caption, sequence([caption]), { clock: 'sequence', cues });
    expect(placed.map((cue) => [cue.key, cue.start, cue.end])).toEqual([
      ['a', 1.5, 2],
      ['b', 4, 6],
      ['c', 11, 11.5],
    ]);
  });

  it('when all acting instances are deleted, nothing appears (does not fall back to sequence time); for a sequence-clock document with acting instances, it only appears within the ranges the instances cover', () => {
    const caption: CaptionItem = {
      ...base,
      id: 'cap',
      trackId: 's1',
      type: 'caption',
      span: { fromFrame: 0, durationFrames: 450 },
      documentId: 'doc',
      scopeItemIds: ['gone'],
    };
    expect(placeCues(caption, sequence([caption]), { clock: 'source-asset', cues })).toEqual([]);
    // The instance occupies sequence 3–5 s: sentences on the sequence clock are trimmed to this range.
    const scoped = { ...caption, scopeItemIds: ['gone', 'v_a'] };
    const placed = placeCues(scoped, sequence([clip('v_a', 90, 60, 0), scoped]), { clock: 'sequence', cues });
    expect(placed).toEqual([{ key: 'v_a:b', cueId: 'b', start: 4, end: 5, text: '二' }]);
  });

  it('overlapping acting instances (linked audio and video): the later-listed one only takes unoccupied ranges, no duplicates', () => {
    const caption: CaptionItem = {
      ...base,
      id: 'cap',
      trackId: 's1',
      type: 'caption',
      span: { fromFrame: 0, durationFrames: 450 },
      documentId: 'doc',
      scopeItemIds: ['v_a', 'v_b'],
    };
    // Both instances take source from 0 s and place it at 0 s; the later one is longer, so only its 5–8 s part extends beyond.
    const placed = placeCues(caption, sequence([clip('v_a', 0, 150, 0), clip('v_b', 0, 240, 0), caption]), { clock: 'source-asset', cues });
    expect(placed.map((cue) => [cue.key, cue.start, cue.end])).toEqual([
      ['v_a:a', 1, 2],
      ['v_a:b', 4, 5],
      ['v_b:b', 5, 6],
    ]);
  });

  it('cached version keyed by caption document, sequence and instance: same inputs return the same result, a changed sequence version recomputes', () => {
    const caption: CaptionItem = {
      ...base,
      id: 'cap',
      trackId: 's1',
      type: 'caption',
      span: { fromFrame: 45, durationFrames: 300 },
      documentId: 'doc',
    };
    const track = { clock: 'sequence' as const, cues };
    const first = sequence([caption]);
    const placed = placedCues(caption, first, track);
    expect(placed).toEqual(placeCues(caption, first, track));
    expect(placedCues(caption, first, track)).toBe(placed);
    const next = { ...first, revision: '2' };
    expect(placedCues(caption, next, track)).not.toBe(placed);
    expect(placedCues(caption, next, track)).toEqual(placed);
    expect(placedCues(caption, first, { ...track })).not.toBe(placed);
  });
});
