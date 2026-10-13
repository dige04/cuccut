import { describe, expect, it } from 'vitest';
import type {
  AssetRecord,
  AudioItem,
  CaptionItem,
  CutSetBody,
  DocumentRecord,
  EditOperation,
  Sequence,
  Track,
  VideoItem,
} from '@cuccut/protocol';
import { readSpeechWords, type SpeechWord } from './speech-cues.ts';
import {
  centerScrollTop,
  cutOperations,
  cutSeams,
  cutTrackIds,
  editWordText,
  hideWords,
  paragraphPlayed,
  paragraphPlayedSpan,
  placementIndex,
  playedIndex,
  playedUntil,
  rawWordId,
  readCutSet,
  restoreOperations,
  restoreRanges,
  staleCaptions,
  transcriptParagraphs,
  transcriptWords,
  wordAt,
} from './transcript-cut.ts';

const fps = { num: 30, den: 1 };
const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };

function video(id: string, fromFrame: number, durationFrames: number, sourceIn: number, extra: Partial<VideoItem> = {}): VideoItem {
  return {
    ...base,
    id,
    trackId: 'v1',
    type: 'video',
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'asset_a', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(Math.round(sourceIn * 1000)), timescale: 1000 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
    ...extra,
  };
}

/** Audio on the frame grid (starting at frame `fromFrame`, `seconds` long); a sub-frame offset (in 48 kHz samples) can be given. */
function audio(
  id: string,
  fromFrame: number,
  seconds: number,
  sourceIn: number,
  extra: Partial<AudioItem> & { subSamples?: number } = {},
): AudioItem {
  const { subSamples = 0, ...rest } = extra;
  return {
    ...base,
    id,
    trackId: 'a1',
    type: 'audio',
    assetRef: { id: 'asset_a', revision: '1' },
    fromFrame,
    subframeOffset: { ticks: String(subSamples), timescale: 48000 },
    playDuration: { ticks: String(Math.round(seconds * 48000)), timescale: 48000 },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(Math.round(sourceIn * 48000)), timescale: 48000 }, rate: { num: 1, den: 1 } },
    mix: { volume: 1 },
    ...rest,
  };
}

function caption(
  id: string,
  fromFrame: number,
  durationFrames: number,
  scopeItemIds?: string[],
  extra: Partial<CaptionItem> = {},
): CaptionItem {
  return {
    ...base,
    id,
    trackId: 's1',
    type: 'caption',
    span: { fromFrame, durationFrames },
    documentId: 'doc_cap',
    ...(scopeItemIds ? { scopeItemIds } : {}),
    ...extra,
  };
}

const track = (id: string, order: number, kind: Track['kind'], extra: Partial<Track> = {}): Track => ({
  id,
  order,
  kind,
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' },
  ...extra,
});

const TRACKS = [
  track('v1', 0, 'visual'),
  track('a1', 1, 'audio'),
  track('s1', 2, 'subtitle'),
  track('v2', 3, 'visual'),
  track('a2', 4, 'audio'),
];

function seq(items: Sequence['items'], tracks: Track[] = TRACKS): Sequence {
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
  } as Sequence;
}

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
        duration: { ticks: '12000', timescale: 1000 },
        provenance: { origin: 'import' },
      },
    },
  },
};

/** A 12-second clip with one word per second: `词0` (word 0) is at [0, len), `词1` (word 1) at [1, 1 + len), and so on (the example from product design S03). */
function words(len = 1, count = 12): SpeechWord[] {
  return Array.from({ length: count }, (_, i) => ({ id: `w${i}`, start: i, end: i + len, text: `词${i}`, paragraphStart: false }));
}

/** S03: the whole clip is placed on the timeline with its linked audio, plus an effect instance that points to their subtitles. */
function whole(): Sequence {
  return seq([
    video('va', 0, 360, 0, { linkGroupId: 'g1' }),
    audio('aa', 0, 12, 0, { linkGroupId: 'g1' }),
    caption('c1', 0, 360, ['va', 'aa']),
    audio('bgm', 0, 20, 0, { trackId: 'a2', assetRef: { id: 'asset_music', revision: '1' } }),
  ]);
}

/** S03 after cutting: source [0, 4) at [0, 120), source [6, 12) at [120, 300). */
function afterCut(extra: Sequence['items'] = []): Sequence {
  return seq([
    video('va', 0, 120, 0, { linkGroupId: 'g1' }),
    video('vb', 120, 180, 6, { linkGroupId: 'g2' }),
    audio('aa', 0, 4, 0, { linkGroupId: 'g1' }),
    audio('ab', 120, 6, 6, { linkGroupId: 'g2' }),
    caption('c1', 0, 300, ['va', 'aa', 'vb', 'ab']),
    audio('bgm', 0, 20, 0, { trackId: 'a2', assetRef: { id: 'asset_music', revision: '1' } }),
    ...extra,
  ]);
}

/** The cut set corresponding to `afterCut()`: one cut for clip [4, 6), on a 1000 scale. */
const CUT_SET: CutSetBody = {
  schema: 'cuccut.cut-set/1',
  timescale: 1000,
  clock: 'source-asset',
  scopeItemIds: [],
  cuts: [{ id: 'cut-1', t0: '4000', t1: '6000', ref: 'sug-1' }],
};

const cutsOf = (ops: EditOperation[]) => ops.map((op) => (op.type === 'addCuts' ? [op.sequenceId, op.assetId, op.cuts] : op.type));

describe('transcriptWords', () => {
  it('derives cut state from the timeline: words that do not map are cut, a cut point falling inside a word leaves only part of it', () => {
    const list = words(0.8);
    list[3] = { ...list[3]!, start: 3.5, end: 4.5 };
    const result = transcriptWords(afterCut(), 'asset_a', list);
    expect(result.map((w) => w.state)).toEqual([
      'kept',
      'kept',
      'kept',
      'partial',
      'cut',
      'cut',
      'kept',
      'kept',
      'kept',
      'kept',
      'kept',
      'kept',
    ]);
    // Linked video and audio use the same clip: sort by start, then by ID; the audio takes the window first (same as text_plan.rs).
    expect(result[6]!.placements.map((p) => [p.scopeItemId, p.start])).toEqual([['ab', 4]]);
    expect(result.map((w) => w.index)).toEqual([...Array(12).keys()]);
  });

  it('after rounding, a word with only a sliver left (under 10%) counts as fully cut, and the sliver is not a cut point', () => {
    const list = words(0.8);
    list[3] = { ...list[3]!, start: 3.98, end: 4.9 };
    const result = transcriptWords(afterCut(), 'asset_a', list);
    expect(result[3]!.state).toBe('cut');
    expect(result[3]!.placements).toEqual([]);
  });

  it('words sorted by start time; Western words separated by a space, Chinese without', () => {
    const list: SpeechWord[] = [
      { id: 'b', start: 1, end: 1.5, text: 'world', paragraphStart: false },
      { id: 'a', start: 0, end: 0.5, text: 'hello', paragraphStart: false },
      { id: 'c', start: 2, end: 2.5, text: '你好', paragraphStart: false },
      { id: 'd', start: 3, end: 3.5, text: '，', paragraphStart: false },
    ];
    const result = transcriptWords(whole(), 'asset_a', list);
    expect(result.map((w) => [w.id, w.spaced])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
      ['d', false],
    ]);
  });

  it('playhead finds the word: index if inside a word, none if in a pause', () => {
    const result = transcriptWords(afterCut(), 'asset_a', words(0.8));
    const index = placementIndex(result);
    expect(wordAt(index, 0.5)).toBe(0);
    expect(wordAt(index, 0.9)).toBeNull();
    // Sequence 4.2 s maps to clip 6.2 s: 词6 (word 6).
    expect(wordAt(index, 4.2)).toBe(6);
  });
});

describe('read words (playback follow)', () => {
  it('cursor changes only when the playhead passes a word\'s end; cut words do not count', () => {
    // afterCut: 词0–3 (words 0–3) at sequence [i, i + 0.8), 词4, 词5 (words 4, 5) cut, 词6–11 (words 6–11) at [i - 2, i - 1.2).
    const result = transcriptWords(afterCut(), 'asset_a', words(0.8));
    const ends = playedIndex(result);
    expect(ends).toHaveLength(10);
    expect(playedUntil(ends, 0.5)).toBe(-Infinity);
    expect(playedUntil(ends, 0.8)).toBeCloseTo(0.8);
    // Unchanged within the pause and within the next word.
    expect(playedUntil(ends, 0.95)).toBeCloseTo(0.8);
    expect(playedUntil(ends, 1.5)).toBeCloseTo(0.8);
    expect(playedUntil(ends, 1.8)).toBeCloseTo(1.8);
    // Sequence 4.9 s: 词6 (word 6), at [4, 4.8), has been read through.
    expect(playedUntil(ends, 4.9)).toBeCloseTo(4.8);
    expect(playedUntil(ends, 100)).toBeCloseTo(9.8);
  });

  it('same media used twice: finishing the first occurrence counts as read', () => {
    const twice = seq([video('va', 0, 120, 0), video('vb', 120, 120, 0)]);
    const result = transcriptWords(twice, 'asset_a', words(0.8, 4));
    expect(result[0]!.placements).toHaveLength(2);
    const ends = playedIndex(result);
    expect(ends).toHaveLength(4);
    expect(playedUntil(ends, 0.9)).toBeCloseTo(0.8);
    // Sequence 4.5 s is within the second placement of 词0 (word 0): it was already read (the cursor stopped at the first placement of 词3 (word 3)).
    expect(playedUntil(ends, 4.5)).toBeCloseTo(3.8);
  });

  it('segment threshold: -Infinity when unread, Infinity when read, cursor when partway; a fully cut segment is never read', () => {
    const result = transcriptWords(afterCut(), 'asset_a', words(0.8));
    const head = paragraphPlayedSpan(result.slice(0, 4));
    expect(head?.[0]).toBeCloseTo(0.8);
    expect(head?.[1]).toBeCloseTo(3.8);
    expect(paragraphPlayed(head, -Infinity)).toBe(-Infinity);
    expect(paragraphPlayed(head, 1.8)).toBe(1.8);
    expect(paragraphPlayed(head, 3.8)).toBe(Infinity);
    const gone = paragraphPlayedSpan(result.slice(4, 6));
    expect(gone).toBeNull();
    expect(paragraphPlayed(gone, 100)).toBe(-Infinity);
  });

  it('centered position clamped to the scrollable range', () => {
    // Viewport 400, content 2000: a 20-high word at pixel 1000 → 810.
    expect(centerScrollTop(2000, 400, 1000, 20)).toBe(810);
    expect(centerScrollTop(2000, 400, 50, 20)).toBe(0);
    expect(centerScrollTop(2000, 400, 1990, 20)).toBe(1600);
    expect(centerScrollTop(300, 400, 200, 20)).toBe(0);
  });
});

describe('transcriptParagraphs', () => {
  it('splits into segments on a speaker change, a marked segment start, or a pause of two seconds or more', () => {
    const list: SpeechWord[] = [
      { id: 'a', start: 0, end: 0.5, text: '一', speaker: 's1', paragraphStart: false },
      { id: 'b', start: 0.6, end: 1, text: '二', speaker: 's1', paragraphStart: false },
      { id: 'c', start: 1.1, end: 1.5, text: '三', speaker: 's2', paragraphStart: false },
      { id: 'd', start: 4, end: 4.5, text: '四', speaker: 's2', paragraphStart: false },
      { id: 'e', start: 4.6, end: 5, text: '五', speaker: 's2', paragraphStart: true },
    ];
    const paragraphs = transcriptParagraphs(transcriptWords(whole(), 'asset_a', list));
    expect(paragraphs.map((p) => [p.key, p.speaker, p.words.map((w) => w.id).join('')])).toEqual([
      ['a', 's1', 'ab'],
      ['c', 's2', 'c'],
      ['d', 's2', 'd'],
      ['e', 's2', 'e'],
    ]);
  });
});

describe('cutTrackIds', () => {
  it('source media tracks, linked instance tracks, and subtitle tracks whose effect instances point to them; background music and subtitles without an effect instance do not count', () => {
    const sequence = seq(
      [
        video('va', 0, 360, 0, { linkGroupId: 'g1' }),
        audio('linked', 0, 12, 0, { linkGroupId: 'g1', trackId: 'a2', assetRef: { id: 'asset_other', revision: '1' } }),
        caption('c1', 0, 360, ['va']),
        caption('c2', 0, 360, undefined, { trackId: 's2' }),
        audio('bgm', 0, 20, 0, { trackId: 'a1', assetRef: { id: 'asset_music', revision: '1' } }),
      ],
      [...TRACKS, track('s2', 5, 'subtitle')],
    );
    expect(cutTrackIds(sequence, 'asset_a')).toEqual(['v1', 's1', 'a2']);
  });
});

describe('cutOperations', () => {
  it('S03: deleting media [4, 6) is encoded as one addCuts, the range in media seconds; deleting 60 frames on the sequence', () => {
    const sequence = whole();
    const list = transcriptWords(sequence, 'asset_a', words());
    const plan = cutOperations(sequence, ASSETS, 'asset_a', list, new Set([4, 5]));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(cutsOf(plan.operations)).toEqual([['seq', 'asset_a', [{ from: '4', to: '6' }]]]);
    expect(plan.frames).toBe(60);
    expect(plan.words).toBe(2);
  });

  it('a selected run of words is cut together with the pauses between them; multiple segments are encoded in order into the same addCuts', () => {
    const sequence = whole();
    const list = transcriptWords(sequence, 'asset_a', words(0.8));
    const plan = cutOperations(sequence, ASSETS, 'asset_a', list, new Set([2, 3, 8]));
    expect(plan.ok && cutsOf(plan.operations)).toEqual([
      [
        'seq',
        'asset_a',
        [
          { from: '2', to: '3.8' },
          { from: '8', to: '8.8' },
        ],
      ],
    ]);
    expect(plan.ok && plan.frames).toBe(78);
  });

  it('unselected cut words do not break a run; two segments across a cut point merge into one', () => {
    const sequence = afterCut();
    const list = transcriptWords(sequence, 'asset_a', words());
    // 词3 (word 3, the last word of va), 词4 and 词5 (words 4 and 5) already cut, 词6 (word 6, the first word of vb): one clip segment [3, 7), merged by the engine with the existing cuts.
    const plan = cutOperations(sequence, ASSETS, 'asset_a', list, new Set([3, 6]));
    expect(plan.ok && [plan.ranges, plan.frames]).toEqual([[{ from: 3, to: 7 }], 60]);
    // The selected ones are all already cut.
    expect(cutOperations(sequence, ASSETS, 'asset_a', list, new Set([4, 5]))).toEqual({ ok: false, reason: 'nothing' });
  });

  it('unselected kept words break the run', () => {
    const sequence = whole();
    const list = transcriptWords(sequence, 'asset_a', words());
    const plan = cutOperations(sequence, ASSETS, 'asset_a', list, new Set([2, 4]));
    expect(plan.ok && plan.ranges).toEqual([
      { from: 2, to: 3 },
      { from: 4, to: 5 },
    ]);
  });

  it('same media used twice: only one media range is encoded, and the engine cuts both occurrences', () => {
    const sequence = seq([video('va', 0, 120, 0), video('vb', 150, 120, 0)]);
    const list = transcriptWords(sequence, 'asset_a', words());
    const plan = cutOperations(sequence, ASSETS, 'asset_a', list, new Set([1]));
    expect(plan.ok && [plan.ranges, plan.frames]).toEqual([[{ from: 1, to: 2 }], 60]);
  });

  it('cut points do not exceed the media duration; cuts under one frame are not encoded, and if all are under one frame it rejects honestly', () => {
    const sequence = whole();
    const long = transcriptWords(sequence, 'asset_a', [{ id: 'x', start: 11.5, end: 12.4, text: '尾', paragraphStart: false }]);
    const plan = cutOperations(sequence, ASSETS, 'asset_a', long, new Set([0]));
    expect(plan.ok && cutsOf(plan.operations)).toEqual([['seq', 'asset_a', [{ from: '11.5', to: '12' }]]]);
    const list = transcriptWords(sequence, 'asset_a', [{ id: 'x', start: 1, end: 1.01, text: '嗯', paragraphStart: false }]);
    expect(cutOperations(sequence, ASSETS, 'asset_a', list, new Set([0]))).toEqual({ ok: false, reason: 'too-short' });
  });
});

describe('restoreOperations', () => {
  const cuts = readCutSet(CUT_SET)!;

  it('reads the cut-point set: ticks converted to media seconds, origin kept; returns null when it is not a cut-point set', () => {
    expect(cuts).toEqual([{ id: 'cut-1', from: 4, to: 6, ref: 'sug-1' }]);
    expect(readCutSet({ schema: 'cuccut.speech/1' })).toBeNull();
  });

  it('selected cut words: the cut that covers them is fully restored, as one restoreCut', () => {
    const sequence = afterCut();
    const list = transcriptWords(sequence, 'asset_a', words());
    const ranges = restoreRanges(list, new Set([3, 5, 6]));
    expect(ranges).toEqual([{ from: 5, to: 6 }]);
    const plan = restoreOperations(sequence, 'asset_a', cuts, ranges);
    expect(plan).toEqual({
      ok: true,
      operations: [{ type: 'restoreCut', sequenceId: 'seq', assetId: 'asset_a', cutId: 'cut-1' }],
      cutIds: ['cut-1'],
      seconds: 2,
    });
  });

  it('merely touching a cut edge does not count; with no cut covering it, rejects honestly (untracked)', () => {
    const sequence = afterCut();
    expect(restoreOperations(sequence, 'asset_a', cuts, [{ from: 6, to: 7 }])).toEqual({ ok: false, reason: 'untracked' });
    expect(restoreOperations(sequence, 'asset_a', [], [{ from: 4, to: 5 }])).toEqual({ ok: false, reason: 'untracked' });
  });
});

describe('cutSeams', () => {
  it('two instances on the same track that abut, use the same media, and have a gap in the media are a cut point', () => {
    const seams = cutSeams(afterCut());
    expect(seams.map((s) => [s.trackId, s.leftId, s.rightId, s.frame, s.gap, s.to])).toEqual([
      ['v1', 'va', 'vb', 120, 2, 6],
      ['a1', 'aa', 'ab', 120, 2, 6],
    ]);
  });

  it('gaps on the timeline, different media, or continuous media (just split apart) are not cut points', () => {
    const sequence = seq([
      video('a', 0, 120, 0),
      video('b', 150, 60, 6),
      video('c', 210, 30, 8, { assetRef: { id: 'asset_x', revision: '1' } }),
      video('d', 240, 30, 1, { assetRef: { id: 'asset_x', revision: '1' } }),
      video('e', 270, 30, 2, { assetRef: { id: 'asset_x', revision: '1' } }),
    ]);
    expect(cutSeams(sequence)).toEqual([]);
  });
});

describe('edit original text', () => {
  const body = {
    schema: 'cuccut.speech/1',
    clock: 'source-asset',
    timescale: 1_000_000,
    speakers: [],
    words: [
      { id: 'w1', start: 0, end: 500_000, text: ' Hello', speaker: 's1', timingQuality: 'aligned' },
      { id: 'w2', start: 500_000, end: 900_000, text: ' world', hidden: false },
      { id: 'w3', start: 1_000_000, end: 9_000_000, text: '第一句话。第二句话，接着说。', timingQuality: 'missing' },
    ],
    sentences: null,
  };

  it('editing a timed word keeps leading whitespace and other fields; setting it empty equals deleting; returns null when unchanged', () => {
    const next = editWordText(body, 'w1', 'Hi');
    expect((next!.words as unknown[])[0]).toEqual({
      id: 'w1',
      start: 0,
      end: 500_000,
      text: ' Hi',
      speaker: 's1',
      timingQuality: 'aligned',
    });
    expect((next!.words as unknown[])[1]).toEqual(body.words[1]);
    expect(body.words[0]!.text).toBe(' Hello');
    expect(editWordText(body, 'w1', 'Hello')).toBeNull();
    expect((editWordText(body, 'w2', '  ')!.words as Array<{ hidden?: boolean }>)[1]!.hidden).toBe(true);
  });

  it('an untimed segment split into pieces: editing one piece changes only its own segment; word IDs remain the same when read back', () => {
    const pieces = readSpeechWords(body)!.words.filter((w) => rawWordId(w.id) === 'w3');
    expect(pieces.map((w) => [w.id, w.text])).toEqual([
      ['w3', '第一句话。'],
      ['w3~2', '第二句话，'],
      ['w3~3', '接着说。'],
    ]);
    const next = editWordText(body, 'w3~2', '第2句话，');
    expect((next!.words as Array<{ text: string }>)[2]!.text).toBe('第一句话。第2句话，接着说。');
    expect(
      readSpeechWords(next)!
        .words.filter((w) => rawWordId(w.id) === 'w3')
        .map((w) => w.id),
    ).toEqual(['w3', 'w3~2', 'w3~3']);
  });

  it('deleting text: timed words are marked hidden; untimed segments delete only the selected block, and are marked hidden only when the whole segment is deleted', () => {
    const next = hideWords(body, ['w1', 'w3~2'])!;
    const list = next.words as Array<{ id: string; text: string; hidden?: boolean }>;
    expect(list[0]!.hidden).toBe(true);
    expect(list[2]).toMatchObject({ text: '第一句话。接着说。' });
    expect(list[2]!.hidden).toBeUndefined();
    const all = hideWords(body, ['w3', 'w3~2', 'w3~3'])!;
    expect((all.words as Array<{ hidden?: boolean; text: string }>)[2]).toMatchObject({ hidden: true, text: body.words[2]!.text });
    expect(hideWords({ schema: 'cuccut.caption/1' }, ['w1'])).toBeNull();
  });
});

describe('staleCaptions', () => {
  it('subtitles generated from an older version of this transcription that are still on the timeline count as stale', () => {
    const speech: DocumentRecord = { id: 'doc_speech', kind: 'speech', name: '转写', currentRevision: '3', revisions: {} };
    const cap = (id: string, revision: string): DocumentRecord => ({
      id,
      kind: 'caption',
      name: id,
      currentRevision: '1',
      revisions: {},
      extensions: { 'cuccut.speechCues': { speechDocumentId: 'doc_speech', speechRevision: revision, assetId: 'asset_a' } },
    });
    const documents = { old: cap('old', '2'), fresh: cap('fresh', '3'), unused: cap('unused', '1') };
    const sequence = seq([
      caption('c1', 0, 30, undefined, { documentId: 'old' }),
      caption('c2', 30, 30, undefined, { documentId: 'fresh' }),
    ]);
    expect(staleCaptions(sequence, documents, speech).map((d) => d.id)).toEqual(['old']);
  });
});
