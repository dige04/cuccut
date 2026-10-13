import { describe, expect, it } from 'vitest';
import type { AssetRecord, AudioItem, MediaTime, VideoItem } from '@cuccut/protocol';
import { audioItem, captionItem, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { bandRestore, bandWordMarks, cutBands, cutText, dragBandEdge, retimeOperations, type CutBand } from './cut-bands.ts';
import type { SpeechWord } from './speech-cues.ts';

const fps = { num: 30, den: 1 };
const TRACKS = [track('v1', 'visual', 0), track('a1', 'audio', 1), track('s1', 'subtitle', 2), track('v2', 'visual', 3), track('a2', 'audio', 4)];
const src = (seconds: number, timescale = 1000): MediaTime => ({ ticks: String(Math.round(seconds * timescale)), timescale });
const linear = (sourceIn: number, timescale = 1000) => ({ kind: 'linear' as const, sourceIn: src(sourceIn, timescale), rate: { num: 1, den: 1 } });
const ref = (id = 'asset_a') => ({ id, revision: '1' });

const video = (id: string, fromFrame: number, durationFrames: number, sourceIn: number, extra: Partial<VideoItem> = {}) =>
  videoItem(id, 'v1', fromFrame, durationFrames, { assetRef: ref(), timeMap: linear(sourceIn), ...extra });
const audio = (id: string, fromFrame: number, seconds: number, sourceIn: number, extra: Partial<AudioItem> = {}) =>
  audioItem(id, 'a1', fromFrame, seconds, { assetRef: ref(), timeMap: linear(sourceIn, 48000), ...extra });

const ASSETS: Record<string, AssetRecord> = {
  asset_a: {
    id: 'asset_a',
    kind: 'video',
    name: '口播.mp4',
    currentRevision: '1',
    revisions: {
      '1': {
        revision: '1',
        contentHash: 'h',
        byteLength: 1,
        mediaType: 'video/mp4',
        storage: { mode: 'managed' },
        duration: src(12),
        provenance: { origin: 'import' },
      },
    },
  },
};

/** What a transcript looks like after one cut (S03): media [0, 4) at [0, 120), [6, 12) at [120, 300); the video and its linked audio, plus one instance pointing at their captions. */
function afterCut(extra: Parameters<typeof sequence>[1] = []) {
  return sequence(TRACKS, [
    video('va', 0, 120, 0, { linkGroupId: 'g1' }),
    video('vb', 120, 180, 6, { linkGroupId: 'g2' }),
    audio('aa', 0, 4, 0, { linkGroupId: 'g1' }),
    audio('ab', 120, 6, 6, { linkGroupId: 'g2' }),
    captionItem('c1', 's1', 'doc_cap', 0, 300, { scopeItemIds: ['va', 'aa', 'vb', 'ab'] }),
    audioItem('bgm', 'a2', 0, 20, { assetRef: ref('asset_music') }),
    ...extra,
  ]);
}

/** 12 seconds of media with one word per second: `词i` (word i) spans [i, i + 0.8). */
const WORDS: SpeechWord[] = Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, start: i, end: i + 0.8, text: `词${i}`, paragraphStart: false }));

const band = (s = afterCut()): CutBand => cutBands(s)[0]!;
const marks = (b: CutBand, words: SpeechWord[] = WORDS) => bandWordMarks(b, words, fps);

describe('cutBands', () => {
  it('cut points at the same place in video and linked audio are merged into one band: representative cut point taken from video, length by restored frame count; both edges clamped within adjacent instances, each leaving one frame', () => {
    expect(cutBands(afterCut())).toEqual([
      {
        key: 'asset_a@120',
        assetId: 'asset_a',
        leftId: 'va',
        rightId: 'vb',
        trackIds: ['v1', 'a1'],
        frame: 120,
        from: 4,
        to: 6,
        rate: 1,
        frames: 60,
        lo: -119,
        hi: 239,
      },
    ]);
  });

  it('when the other end of an adjacent instance is also a cut point, it can be dragged to the end (two cut points merged into one)', () => {
    const s = sequence(TRACKS, [video('a', 0, 60, 0), video('b', 60, 60, 4), video('c', 120, 60, 8)]);
    expect(cutBands(s).map((b) => [b.leftId, b.rightId, b.frames, b.lo, b.hi])).toEqual([
      ['a', 'b', 60, -59, 120],
      ['b', 'c', 60, -60, 119],
    ]);
  });

  it('no cut points, no band', () => {
    expect(cutBands(sequence(TRACKS, [video('a', 0, 120, 0), video('b', 120, 60, 4)]))).toEqual([]);
  });
});

describe('cutText', () => {
  it('words at least half inside the cut range joined in order; Chinese without spaces', () => {
    expect(cutText(WORDS, 4, 6)).toBe('词4词5');
    expect(cutText(WORDS, 4.5, 6)).toBe('词5');
    expect(cutText(WORDS, 4.4, 4.6)).toBe('');
  });

  it('Western words with a leading space get one space', () => {
    const w = (text: string, start: number, end: number): SpeechWord => ({ id: text, start, end, text, paragraphStart: false });
    const words = [w(' know', 5, 5.4), w(' well', 3, 3.8), w(' um', 3.8, 4.4), w(' you', 4.5, 4.9), w(' right', 6, 6.5)];
    expect(cutText(words, 4, 6)).toBe('um you know');
  });
});

describe('bandWordMarks', () => {
  it('left of cut uses left instance, right uses right instance, the cut segment converted proportionally to drag coordinates (frames, relative to cut point)', () => {
    const m = marks(band());
    const at = (id: string) => m.find((x) => x.word.id === id);
    const round = (id: string) => [at(id)?.t0, at(id)?.t1].map((t) => Math.round((t ?? NaN) * 1e6) / 1e6);
    expect(round('w3')).toEqual([-30, -6]);
    expect(round('w4')).toEqual([0, 24]);
    expect(round('w6')).toEqual([60, 84]);
    expect(m[0]?.word.id).toBe('w0');
    expect(bandWordMarks({ ...band(), lo: -40, hi: 100 }, WORDS, fps).map((x) => x.word.id)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8']);
  });
});

describe('dragBandEdge', () => {
  it('default snaps to word boundaries: left edge snaps to nearest word start (keeps margin, rounded down to frame), right edge snaps to nearest word end', () => {
    const b = band();
    const left = dragBandEdge(b, marks(b), 'start', -25, false, fps);
    expect([left.start, left.end, left.word?.id, left.changed]).toEqual([-32, 60, 'w3', true]);
    const near = dragBandEdge(b, marks(b), 'start', -10, false, fps);
    expect([near.start, near.word?.id]).toEqual([-2, 'w4']);
    const right = dragBandEdge(b, marks(b), 'end', 20, false, fps);
    expect([right.start, right.end, right.word?.id]).toEqual([0, 86, 'w6']);
  });

  it('holding Alt drops freely, aligned to frames; falls back to free when there are no words', () => {
    const b = band();
    const free = dragBandEdge(b, marks(b), 'start', -25.4, true, fps);
    expect([free.start, free.word]).toEqual([-25, null]);
    expect(dragBandEdge(b, [], 'start', -25.4, false, fps).start).toBe(-25);
  });

  it('clamping: beyond limit sticks at limit; dragging past the other edge is zero-width', () => {
    const b = band();
    expect(dragBandEdge(b, marks(b), 'start', -500, false, fps).start).toBe(-119);
    expect(dragBandEdge(b, marks(b), 'end', 1000, false, fps).end).toBe(239);
    const shut = dragBandEdge(b, marks(b), 'start', 100, false, fps);
    expect([shut.start, shut.end, shut.changed]).toEqual([60, 60, true]);
    const shutRight = dragBandEdge(b, marks(b), 'end', -100, false, fps);
    expect([shutRight.start, shutRight.end]).toEqual([0, 0]);
  });

  it('no movement on press returns the original', () => {
    const b = band();
    expect(dragBandEdge(b, marks(b), 'end', 0, false, fps)).toEqual({ edge: 'end', start: 0, end: 60, word: null, changed: false });
  });
});

describe('retimeOperations', () => {
  /** The cut from `afterCut()`: media [4, 6). */
  const CUTS = [{ id: 'cut-1', from: 4, to: 6 }];
  const restoreCut = { type: 'restoreCut', sequenceId: 'seq', assetId: 'asset_a', cutId: 'cut-1' };

  it('one transaction: first restoreCut to put this one back, then addCuts to cut the new media range', () => {
    const s = afterCut();
    const plan = retimeOperations(s, ASSETS, band(s), CUTS, { start: -32, end: 60 });
    expect(plan?.ok).toBe(true);
    if (!plan?.ok) return;
    expect(plan.frames).toBe(92);
    // Left edge dragged earlier by 32 frames: media 4 - 32/30 s.
    expect(plan.operations).toEqual([
      restoreCut,
      { type: 'addCuts', sequenceId: 'seq', assetId: 'asset_a', cuts: [{ from: '2.933333', to: '6' }] },
    ]);
  });

  it('right edge dragged later: one more section cut after the cut point', () => {
    const s = afterCut();
    const plan = retimeOperations(s, ASSETS, band(s), CUTS, { start: 0, end: 86 });
    const add = plan?.ok ? plan.operations.at(-1) : null;
    expect(add?.type === 'addCuts' && add.cuts).toEqual([{ from: '4', to: '6.866667' }]);
  });

  it('dragged to zero width only restores; range unchanged, nothing written', () => {
    const s = afterCut();
    const plan = retimeOperations(s, ASSETS, band(s), CUTS, { start: 60, end: 60 });
    expect(plan?.ok && [plan.frames, plan.operations]).toEqual([0, [restoreCut]]);
    expect(retimeOperations(s, ASSETS, band(s), CUTS, { start: 0, end: 60 })).toBeNull();
  });

  it('within half a frame of the cut counts as a matched seam; no cut point is untracked, partially covered is partial', () => {
    const s = afterCut();
    const near = [{ id: 'cut-1', from: 4.01, to: 6 }];
    expect(retimeOperations(s, ASSETS, band(s), near, { start: 0, end: 30 })?.ok).toBe(true);
    expect(retimeOperations(s, ASSETS, band(s), [], { start: -10, end: 60 })).toEqual({ ok: false, reason: 'untracked' });
    const part = [{ id: 'cut-1', from: 5, to: 6 }];
    expect(retimeOperations(s, ASSETS, band(s), part, { start: -10, end: 60 })).toEqual({ ok: false, reason: 'partial' });
    // Restore-only does not require the whole cut to be covered: a single click on the band restores the part it covers.
    expect(bandRestore(s, band(s), part)).toMatchObject({ ok: true, cutIds: ['cut-1'], seconds: 1 });
  });
});
