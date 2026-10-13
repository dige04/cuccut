import { describe, expect, it } from 'vitest';
import type { AssetRecord } from '@cuccut/protocol';
import { audioItem, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { assetOnTimeline, LOOP, loopLayout, loopSummary, MUSIC_ROLE, musicBedOperations, placedSoundtrackJobs, SOUNDTRACK_EXTENSION, type LoopPiece } from './music-bed.ts';

const music = (seconds: number, extra: Partial<AssetRecord> = {}): AssetRecord =>
  ({
    id: 'asset_m',
    kind: 'audio',
    name: 'calm piano.wav',
    currentRevision: '2',
    revisions: { '2': { revision: '2', duration: { ticks: String(seconds * 44100), timescale: 44100 } } },
    ...extra,
  }) as unknown as AssetRecord;

/** Sound at every moment: two adjacent segments overlap by exactly one crossfade, alternating across two tracks, and the last segment ends at the end of the video (design draft model-music.test.js `assertCovers`). */
function expectCovers(layout: LoopPiece[], total: number) {
  expect(layout[0]!.start).toBe(0);
  layout.forEach((s, i) => {
    expect(s.lane).toBe(i % 2);
    expect(s.fadeIn + s.fadeOut).toBeLessThanOrEqual(s.dur + 1e-9);
    if (i > 0) {
      const prev = layout[i - 1]!;
      expect(prev.start + prev.dur - s.start).toBeCloseTo(s.fadeIn, 3);
      expect(s.fadeIn).toBe(prev.fadeOut);
    }
  });
  const last = layout[layout.length - 1]!;
  expect(last.start + last.dur).toBeCloseTo(total, 3);
}

describe('music bed fills the timeline (design draft model-music.js loopLayout)', () => {
  it('music longer than the video is one segment, trimmed to the end with a fade-out at the end', () => {
    const l = loopLayout(300, 206);
    expect(l).toEqual([{ start: 0, dur: 206, lane: 0, fadeIn: 0, fadeOut: 3 }]);
    expect(loopSummary(l, 206)).toBe('片尾淡出 3 秒');
  });

  it('segments joined end to end, seam cross-faded over 2 seconds, alternating two tracks, last segment fades out at the end', () => {
    const l = loopLayout(300, 742);
    expectCovers(l, 742);
    expect(l.map((s) => s.start)).toEqual([0, 298, 596]);
    expect(l.map((s) => s.dur)).toEqual([300, 300, 146]);
    expect(l.map((s) => [s.fadeIn, s.fadeOut])).toEqual([
      [0, 2],
      [2, 2],
      [2, 3],
    ]);
    expect(loopSummary(l, 742)).toBe('循环 3 段铺满 742 秒 · 接缝交叉淡化 2 秒 · 片尾淡出 3 秒');
  });

  it('exact whole segments, or a small remainder where the last segment is still longer than the cross-fade; music written too long fills by actual duration; very long videos', () => {
    const exact = loopLayout(300, 598); // 300 + 298: the second segment finishes exactly
    expectCovers(exact, 598);
    expect(exact).toHaveLength(2);
    expect(exact[1]!.dur).toBe(300);
    const sliver = loopLayout(300, 299); // Only 1 second extra: the second segment comes in as the previous one ends
    expectCovers(sliver, 299);
    expect(sliver).toHaveLength(1);
    const tiny = loopLayout(300, 301);
    expectCovers(tiny, 301);
    expect(tiny).toHaveLength(2);
    expect(tiny[1]!.dur).toBeGreaterThan(tiny[1]!.fadeIn);
    expect(tiny[1]!.fadeOut).toBeLessThanOrEqual(tiny[1]!.dur - tiny[1]!.fadeIn);
    expectCovers(loopLayout(360, 3120), 3120);
    expect(loopLayout(0, 100)).toEqual([]);
    expect(loopLayout(30, 0)).toEqual([]);
  });

  it('very short music: cross-fade does not exceed a quarter of a segment, fade-in plus fade-out sum does not exceed the clip length', () => {
    const l = loopLayout(4, 10);
    expectCovers(l, 10);
    expect(l[1]!.fadeIn).toBe(1);
    expect(l.every((s) => s.fadeIn <= 5 && s.fadeOut <= 5)).toBe(true);
    expect(LOOP).toEqual({ crossfade: 2, tailFade: 3 });
  });
});

describe('musicBedOperations: in one transaction create a new music track, one audio instance per segment', () => {
  // 742 s = 22260 frames @30fps
  const long = sequence([track('t1', 'visual', 0)], [videoItem('v1', 't1', 0, 742 * 30)]);

  it('video longer than music: two music tracks alternate, start split into frame and in-frame offset, length and fades per the fill method', () => {
    const r = musicBedOperations(long, music(300), 'job_1');
    expect(r).not.toBeNull();
    const { operations, layout, totalSec } = r!;
    expect(totalSec).toBe(742);
    expect(layout).toHaveLength(3);
    expect(operations[0]).toEqual({ type: 'addTrack', sequenceId: 'seq', kind: 'audio', ref: 'music-bed-0', name: '音乐' });
    expect(operations[1]).toEqual({ type: 'addTrack', sequenceId: 'seq', kind: 'audio', ref: 'music-bed-1', name: '音乐 2' });
    const insert = operations[2]!;
    if (insert.type !== 'insertItems') throw new Error(insert.type);
    expect(insert.items.map((i) => (i as { trackRef: string }).trackRef)).toEqual(['music-bed-0', 'music-bed-1', 'music-bed-0']);
    const second = insert.items[1] as Extract<(typeof insert.items)[number], { type: 'audio' }>;
    expect(second).toMatchObject({
      type: 'audio',
      assetRef: { id: 'asset_m', revision: '2' },
      fromFrame: 298 * 30,
      subframeOffset: { ticks: '0', timescale: 30000 },
      playDuration: { ticks: '300000', timescale: 1000 },
      timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } },
      mix: { volume: 1, fadeIn: { ticks: '2000', timescale: 1000 }, fadeOut: { ticks: '2000', timescale: 1000 } },
      name: 'calm piano.wav',
      role: MUSIC_ROLE,
      extensions: { [SOUNDTRACK_EXTENSION]: { jobId: 'job_1' } },
    });
    const first = insert.items[0] as typeof second;
    expect(first.mix).toEqual({ volume: 1, fadeOut: { ticks: '2000', timescale: 1000 } });
    const last = insert.items[2] as typeof second;
    expect(last.playDuration).toEqual({ ticks: '146000', timescale: 1000 });
    expect(last.mix.fadeOut).toEqual({ ticks: '3000', timescale: 1000 });
  });

  it('non-integer frame rate: in-frame offset stays within one frame, computed in whole milliseconds', () => {
    const ntsc = sequence([track('t1', 'visual', 0)], [videoItem('v1', 't1', 0, 20000)], { fps: { num: 30000, den: 1001 } });
    const r = musicBedOperations(ntsc, music(300), 'job_1')!;
    const insert = r.operations.find((op) => op.type === 'insertItems')!;
    if (insert.type !== 'insertItems') throw new Error(insert.type);
    const second = insert.items[1] as Extract<(typeof insert.items)[number], { type: 'audio' }>;
    // 298 s = 298000 ms; frames = floor(298000 × 30000 / (1000 × 1001)) = 8931; the remaining ticks are less than one frame (1001 × 1000)
    expect(second.fromFrame).toBe(8931);
    expect(second.subframeOffset.timescale).toBe(30_000_000);
    const ticks = Number(second.subframeOffset.ticks);
    expect(ticks).toBeGreaterThanOrEqual(0);
    expect(ticks).toBeLessThan(1001 * 1000);
    expect(ticks).toBe(298000 * 30000 - 8931 * 1001 * 1000);
  });

  it('video not longer than music: one music track, one segment trimmed to the end', () => {
    const short = sequence([track('t1', 'visual', 0)], [videoItem('v1', 't1', 0, 206 * 30)]);
    const r = musicBedOperations(short, music(300), 'job_1')!;
    expect(r.operations.filter((op) => op.type === 'addTrack')).toHaveLength(1);
    const insert = r.operations[1]!;
    if (insert.type !== 'insertItems') throw new Error(insert.type);
    expect(insert.items).toHaveLength(1);
    expect(insert.items[0]).toMatchObject({ fromFrame: 0, playDuration: { ticks: '206000', timescale: 1000 }, mix: { volume: 1, fadeOut: { ticks: '3000', timescale: 1000 } } });
  });

  it('empty timeline, material with no duration, and non-audio material are not filled', () => {
    expect(musicBedOperations(sequence([track('t1', 'visual', 0)], []), music(300), 'job_1')).toBeNull();
    expect(musicBedOperations(long, music(300, { revisions: { '2': { revision: '2' } } } as unknown as Partial<AssetRecord>), 'job_1')).toBeNull();
    expect(musicBedOperations(long, music(300, { kind: 'video' } as Partial<AssetRecord>), 'job_1')).toBeNull();
  });

  it('material duration not in whole milliseconds: fill length rounded down, not longer than the material; last segment does not cross the sequence end', () => {
    // 299.99977… s @44.1 kHz
    const odd = music(300, { revisions: { '2': { revision: '2', duration: { ticks: '13229990', timescale: 44100 } } } } as unknown as Partial<AssetRecord>);
    const r = musicBedOperations(long, odd, 'job_1')!;
    const insert = r.operations.find((op) => op.type === 'insertItems')!;
    if (insert.type !== 'insertItems') throw new Error(insert.type);
    for (const item of insert.items as Extract<(typeof insert.items)[number], { type: 'audio' }>[]) {
      // playDuration ≤ source duration, as a rational ratio: ticks/1000 ≤ 13229990/44100
      expect(Number(item.playDuration.ticks) * 44100).toBeLessThanOrEqual(13229990 * 1000);
    }
    expect(insert.items[0]).toMatchObject({ playDuration: { ticks: '299999', timescale: 1000 } });
    const last = r.layout[r.layout.length - 1]!;
    expect(last.start + last.dur).toBeLessThanOrEqual(742 + 1e-9);
    // Sequence duration is not a whole number of milliseconds (NTSC 20000 frames = 667.333… s): the total length is rounded down, and the last segment's end does not go past the end of the sequence
    const ntsc = sequence([track('t1', 'visual', 0)], [videoItem('v1', 't1', 0, 20000)], { fps: { num: 30000, den: 1001 } });
    const n = musicBedOperations(ntsc, music(300), 'job_1')!;
    expect(n.totalSec).toBe(667.333);
    const tail = n.layout[n.layout.length - 1]!;
    expect(tail.start + tail.dur).toBeLessThanOrEqual((20000 * 1001) / 30000 + 1e-9);
  });

  it('laying a new bed replaces the previous one: in the same transaction, first delete the previous bed\'s instances and the music tracks holding only them', () => {
    const mark = { [SOUNDTRACK_EXTENSION]: { jobId: 'job_0' } };
    const withBed = sequence(
      [track('t1', 'visual', 0), track('m1', 'audio', 1), track('m2', 'audio', 2), track('a3', 'audio', 3)],
      [
        videoItem('v1', 't1', 0, 742 * 30),
        audioItem('b1', 'm1', 0, 300, { extensions: mark }),
        audioItem('b2', 'm2', 298 * 30, 300, { extensions: mark }),
        audioItem('b3', 'm1', 596 * 30, 146, { extensions: mark }),
        // The user had other sounds on the third music track: the track is kept
        audioItem('b4', 'a3', 0, 10, { extensions: mark }),
        audioItem('x1', 'a3', 400 * 30, 5, { assetRef: { id: 'asset_x', revision: '1' } }),
      ],
    );
    expect(placedSoundtrackJobs(withBed)).toEqual(new Set(['job_0']));
    const r = musicBedOperations(withBed, music(300), 'job_1')!;
    expect(r.operations.slice(0, 3)).toEqual([
      { type: 'deleteItems', sequenceId: 'seq', itemIds: ['b1', 'b2', 'b3', 'b4'] },
      { type: 'deleteTrack', sequenceId: 'seq', trackId: 'm1' },
      { type: 'deleteTrack', sequenceId: 'seq', trackId: 'm2' },
    ]);
    expect(r.operations.filter((op) => op.type === 'addTrack')).toHaveLength(2);
  });

  it('material already on the timeline is not filled again', () => {
    const placed = sequence([track('t1', 'visual', 0), track('a1', 'audio', 1)], [videoItem('v1', 't1', 0, 300), audioItem('m1', 'a1', 0, 10, { assetRef: { id: 'asset_m', revision: '2' } })]);
    expect(assetOnTimeline(placed, 'asset_m')).toBe(true);
    expect(assetOnTimeline(placed, 'asset_x')).toBe(false);
  });
});
