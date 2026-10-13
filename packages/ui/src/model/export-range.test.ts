import { describe, expect, it } from 'vitest';
import { chapter, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { chapterPieces, clampCustom, clipPieces, initialRange, mergeSegments, parseRangeTime, rangePlan, rangeScope, type RangeState } from './export-range.ts';

// A 60-second film: three video segments (0–20, 20–40, 45–60) with a 5-second gap in the middle; three chapters (0, 20, 45 seconds).
const seq = sequence(
  [track('v1', 'visual', 1), track('v2', 'visual', 2, { visible: false })],
  [
    videoItem('c3', 'v1', 1350, 450),
    videoItem('c1', 'v1', 0, 600),
    videoItem('c2', 'v1', 600, 600),
    videoItem('off', 'v1', 1200, 150, { enabled: false }),
    videoItem('hidden', 'v2', 0, 300),
  ],
  { markers: [chapter('m1', 0, '开场'), chapter('m2', 600, '正文'), chapter('m3', 1350, '  ')] },
);
const assets = { asset_v: { id: 'asset_v', kind: 'video' as const, name: 'clip.mp4', currentRevision: '1', revisions: {} } };
const chapters = chapterPieces(seq);
const clips = clipPieces(seq, assets, {});
const state = (patch: Partial<RangeState>): RangeState => ({ mode: 'all', chapterIds: [], clipIds: [], custom: { start: 0, end: 60 }, ...patch });

describe('export range: chapters and clips', () => {
  it('a chapter runs to the next chapter, the last to the end; unnamed ones are written as \'Chapter N\'', () => {
    expect(chapters.map((c) => [c.id, c.label, c.start, c.end])).toEqual([
      ['m1', '开场', 0, 20],
      ['m2', '正文', 20, 45],
      ['m3', '第 3 章', 45, 60],
    ]);
  });

  it('when a chapter marker carries its own duration, it runs for that duration', () => {
    const own = chapterPieces(sequence([track('v1', 'visual', 1)], [videoItem('c', 'v1', 0, 1800)], { markers: [chapter('m', 300, '高光', { durationFrames: 150 })] }));
    expect(own.map((c) => [c.start, c.end])).toEqual([[10, 15]]);
  });

  it('clips count only enabled video instances on tracks that are not hidden, numbered by start', () => {
    expect(clips.map((c) => [c.id, c.label, c.name, c.start, c.end])).toEqual([
      ['c1', '片段 1', 'clip.mp4', 0, 20],
      ['c2', '片段 2', 'clip.mp4', 20, 40],
      ['c3', '片段 3', 'clip.mp4', 45, 60],
    ]);
  });
});

describe('export range: turned into a request', () => {
  it('the whole film does not carry a range', () => {
    const plan = rangePlan(state({}), chapters, clips, 60);
    expect(plan.whole).toBe(true);
    expect(plan.label).toBe('整片 1:00');
    expect(rangeScope(plan)).toEqual({});
  });

  it('adjacent segments are joined into one segment and send one range', () => {
    const plan = rangePlan(state({ mode: 'clips', clipIds: ['c2', 'c1'] }), chapters, clips, 60);
    expect(plan.segments).toEqual([{ start: 0, end: 40 }]);
    expect(plan.label).toBe('2 段连成一段 · 0:40');
    expect(rangeScope(plan)).toEqual({ range: { start: 0, end: 40 } });
  });

  it('non-adjacent segments are each exported and send ranges', () => {
    const plan = rangePlan(state({ mode: 'clips', clipIds: ['c1', 'c3'] }), chapters, clips, 60);
    expect(plan.label).toBe('2 段 · 共 0:35');
    expect(rangeScope(plan)).toEqual({ ranges: [{ start: 0, end: 20 }, { start: 45, end: 60 }] });
  });

  it('a single chapter segment uses the chapter name', () => {
    const plan = rangePlan(state({ mode: 'chapters', chapterIds: ['m2'] }), chapters, clips, 60);
    expect(plan.label).toBe('正文 · 0:25');
    expect(rangeScope(plan)).toEqual({ range: { start: 20, end: 45 } });
  });

  it('empty when no segment is checked, without a range', () => {
    const plan = rangePlan(state({ mode: 'chapters' }), chapters, clips, 60);
    expect(plan.empty).toBe(true);
    expect(rangeScope(plan)).toEqual({});
  });

  it('custom range is clamped to the film length, at least half a second', () => {
    expect(clampCustom(-3, 80, 60)).toEqual({ start: 0, end: 60 });
    expect(clampCustom(30, 30.1, 60)).toEqual({ start: 30, end: 30.5 });
    expect(clampCustom(59.9, 60, 60)).toEqual({ start: 59.5, end: 60 });
    const plan = rangePlan(state({ mode: 'custom', custom: { start: 45, end: 78.25 } }), chapters, clips, 60);
    expect(plan.label).toBe('0:45.0–1:00.0');
    expect(rangeScope(plan)).toEqual({ range: { start: 45, end: 60 } });
  });

  it('when merging, sorted by start, and overlapping ones are also merged', () => {
    expect(mergeSegments([{ start: 10, end: 20 }, { start: 0, end: 12 }, { start: 30, end: 31 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 31 },
    ]);
  });

  it('timecode input: seconds or m:ss.d', () => {
    expect(parseRangeTime('1:05.3')).toBeCloseTo(65.3);
    expect(parseRangeTime('12')).toBe(12);
    expect(parseRangeTime('abc')).toBeNull();
  });

  it('on open, the chapter at the playhead is pre-checked; clips prefer the selected one', () => {
    const init = initialRange(chapters, clips, 25, ['c3'], 60);
    expect(init).toEqual({ mode: 'all', chapterIds: ['m2'], clipIds: ['c3'], custom: { start: 0, end: 60 } });
    expect(initialRange(chapters, clips, 25, [], 60).clipIds).toEqual(['c2']);
    expect(initialRange([], [], 42, [], 60).clipIds).toEqual([]);
  });
});
