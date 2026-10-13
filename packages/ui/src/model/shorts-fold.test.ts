import { describe, expect, it } from 'vitest';
import type { CaptionItem, Sequence, VideoItem } from '@cuccut/protocol';
import { foldOutside, openingSentence, reclaimOperations, reclaimRange, visibleParagraphs } from './shorts-fold.ts';
import type { TranscriptParagraph, TranscriptWord, WordState } from './transcript-cut.ts';

/** One sentence per second, two words per sentence (the second with a period); `kept` is the period that stays on the timeline (from 0). */
function transcript(sentences: number, kept: [number, number], perParagraph = 4) {
  const words: TranscriptWord[] = [];
  for (let s = 0; s < sentences; s++) {
    const state: WordState = s >= kept[0] && s <= kept[1] ? 'kept' : 'cut';
    for (const [k, text] of ['a', 'b.'].entries()) {
      const index = words.length;
      words.push({
        id: `w${index}`,
        index,
        start: s + k * 0.5,
        end: s + k * 0.5 + 0.5,
        text,
        paragraphStart: false,
        placements: [],
        state,
        spaced: true,
      });
    }
  }
  const paragraphs: TranscriptParagraph[] = [];
  for (let i = 0; i < words.length; i += perParagraph * 2) {
    const chunk = words.slice(i, i + perParagraph * 2);
    paragraphs.push({ key: chunk[0]!.id, words: chunk });
  }
  return { words, paragraphs };
}

describe('openingSentence', () => {
  it('is the kept part of the sentence holding the first kept word', () => {
    const { words, paragraphs } = transcript(6, [2, 4]);
    words[4]!.text = 'Here';
    words[5]!.text = 'goes.';
    expect(openingSentence(words, paragraphs)).toBe('Here goes.');
    // The clip starts mid-sentence: only the words kept are taken.
    words[4]!.state = 'cut';
    expect(openingSentence(words, paragraphs)).toBe('goes.');
  });

  it('is null when everything is cut', () => {
    const { words, paragraphs } = transcript(4, [9, 9]);
    expect(openingSentence(words, paragraphs)).toBeNull();
  });
});

describe('foldOutside', () => {
  it('keeps the 3 nearest struck sentences on each side and folds the rest', () => {
    const { words, paragraphs } = transcript(30, [10, 14]);
    const plan = foldOutside(words, paragraphs, { before: 0, after: 0 })!;
    // 10 sentences before: the 3 nearest are shown, 7 are collapsed; 15 after: 3 are shown, 12 are collapsed.
    expect(plan.before).toMatchObject({ side: 'before', total: 7, count: 7, shown: 0, next: 7 });
    expect(plan.before!.seconds).toBe(7);
    expect(plan.after).toMatchObject({ side: 'after', total: 12, count: 12, next: 10 });
    expect(plan.hidden.has(0)).toBe(true);
    expect(plan.hidden.has(13)).toBe(true); // Sentence 6
    expect(plan.hidden.has(14)).toBe(false); // Sentence 7: 3rd nearest to the clip
    expect(plan.hidden.has(35)).toBe(false); // Sentence 17: 3rd nearest after the clip
    expect(plan.hidden.has(36)).toBe(true);
  });

  it('expands in batches starting next to the clip', () => {
    const { words, paragraphs } = transcript(30, [10, 14]);
    const plan = foldOutside(words, paragraphs, { before: 0, after: 10 })!;
    expect(plan.after).toMatchObject({ count: 2, shown: 10, next: 2 });
    expect(plan.hidden.has(36)).toBe(false); // Sentence 18 is spread out
    expect(plan.hidden.has(56)).toBe(true); // Sentence 28 is still collapsed
    const all = foldOutside(words, paragraphs, { before: 99, after: 99 })!;
    expect(all.hidden.size).toBe(0);
    expect(all.before).toMatchObject({ count: 0, shown: 7, next: 0 });
  });

  it('does not fold when the clip is near the ends or everything is cut', () => {
    const { words, paragraphs } = transcript(8, [2, 5]);
    const plan = foldOutside(words, paragraphs, { before: 0, after: 0 })!;
    expect(plan.before).toBeNull();
    expect(plan.after).toBeNull();
    expect(plan.hidden.size).toBe(0);
    const none = transcript(4, [9, 9]);
    expect(foldOutside(none.words, none.paragraphs, { before: 0, after: 0 })).toBeNull();
  });

  it('leaves cuts inside the clip alone', () => {
    const { words, paragraphs } = transcript(20, [5, 14]);
    for (const w of words) if (w.start >= 9 && w.start < 11) w.state = 'cut';
    const plan = foldOutside(words, paragraphs, { before: 0, after: 0 })!;
    expect([...plan.hidden].every((i) => words[i]!.start < 2 || words[i]!.start >= 18)).toBe(true);
    expect(reclaimRange(words, plan, 18)).toBeNull(); // Sentence 9 is in the middle of the clip
  });
});

describe('visibleParagraphs', () => {
  it('drops hidden paragraphs and trims split ones', () => {
    const { words, paragraphs } = transcript(30, [10, 14]);
    const plan = foldOutside(words, paragraphs, { before: 0, after: 0 })!;
    const shown = visibleParagraphs(paragraphs, plan.hidden);
    // Sentences 0–7 collapsed (4 sentences per paragraph: paragraph 0 entirely collapsed, paragraph 1 shows only sentence 7).
    expect(shown[0]!.words.map((w) => w.index)).toEqual([14, 15]);
    expect(shown[0]!.key).toBe('w14');
    expect(shown.at(-1)!.words.at(-1)!.index).toBe(35);
    expect(visibleParagraphs(paragraphs, new Set())).toBe(paragraphs);
  });
});

describe('reclaim', () => {
  it('restores from the clicked sentence to the clip edge without leaving a hole', () => {
    const { words, paragraphs } = transcript(30, [10, 14]);
    const plan = foldOutside(words, paragraphs, { before: 0, after: 0 })!;
    expect(reclaimRange(words, plan, 15)).toEqual({ from: 7, to: 10, side: 'before' }); // The second word of sentence 7
    expect(reclaimRange(words, plan, 34)).toEqual({ from: 15, to: 18, side: 'after' }); // Sentence 17
    expect(reclaimRange(words, plan, 20)).toBeNull(); // Words kept
  });

  it('restores the covering cut and cuts the rest back in one transaction', () => {
    const sequence = { id: 'seq', items: [], fps: { num: 30, den: 1 } } as unknown as Sequence;
    const cuts = [
      { id: 'head', from: 0, to: 10 },
      { id: 'tail', from: 15, to: 30 },
    ];
    const head = reclaimOperations(sequence, 'asset', cuts, { from: 7, to: 10 });
    expect(head).toEqual({
      ok: true,
      operations: [
        { type: 'restoreCut', sequenceId: 'seq', assetId: 'asset', cutId: 'head' },
        { type: 'addCuts', sequenceId: 'seq', assetId: 'asset', cuts: [{ from: '0', to: '7' }] },
      ],
      cutIds: ['head'],
      seconds: 3,
    });
    const tail = reclaimOperations(sequence, 'asset', cuts, { from: 15, to: 30 });
    expect(tail.ok && tail.operations).toEqual([{ type: 'restoreCut', sequenceId: 'seq', assetId: 'asset', cutId: 'tail' }]);
    expect(reclaimOperations(sequence, 'asset', [], { from: 1, to: 2 })).toEqual({ ok: false, reason: 'untracked' });
  });
});

/**
 * The shape of a real child video (e2e: after the parent video was cut into a short video): 23.976 fps; one video instance spanning 0–1334 frames with source start 569.235; one caption instance projected through it, of the same length; two cut points outside the clip, `[0, 569.235)` and `[624.874, 3991.237)`.
 */
describe('reclaim in a derived clip', () => {
  const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'follow-cuts' as const } };
  const clip: VideoItem = {
    ...base,
    id: 'v',
    trackId: 'V1',
    type: 'video',
    span: { fromFrame: 0, durationFrames: 1334 },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'asset', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: '13661648', timescale: 24000 }, rate: { num: 1, den: 1 } },
    fit: 'cover',
    embeddedAudio: { enabled: true, volume: 1 },
  };
  const caption = (id: string, fromFrame: number, durationFrames: number, trackId = 'S1'): CaptionItem => ({
    ...base,
    id,
    trackId,
    type: 'caption',
    span: { fromFrame, durationFrames },
    documentId: 'doc_cap',
    scopeItemIds: ['v'],
  });
  const sequence = (captions: CaptionItem[]) =>
    ({ id: 'seq', fps: { num: 24000, den: 1001 }, items: [clip, ...captions] }) as unknown as Sequence;
  const cuts = [
    { id: 'head', from: 0, to: 569.2353333333333 },
    { id: 'tail', from: 624.87425, to: 3991.23725 },
  ];
  // Frames the engine puts back at the seam: the cut length, rounded down at 23.976 fps.
  const TAIL_FRAMES = 80712;

  it('restores the tail from the clip edge, extends the caption and cuts only the far side back', () => {
    // The last kept word straddles the cut point (ending at 625.041): the old approach cut back to [624.874, 625.041), leaving a 166 ms hole and splitting the instance in two.
    const plan = reclaimOperations(sequence([caption('cap', 0, 1334)]), 'asset', cuts, { from: 625.041, to: 629.754, side: 'after' });
    expect(plan.ok && plan.operations).toEqual([
      { type: 'restoreCut', sequenceId: 'seq', assetId: 'asset', cutId: 'tail' },
      { type: 'trimItem', sequenceId: 'seq', itemId: 'cap', edge: 'end', at: { unit: 'frames', value: 1334 + TAIL_FRAMES }, alignment: 'exact-frame' },
      { type: 'addCuts', sequenceId: 'seq', assetId: 'asset', cuts: [{ from: '629.754', to: '3991.23725' }] },
    ]);
    expect(plan.ok && plan.seconds).toBeCloseTo(629.754 - 624.87425, 6);
  });

  it('restores the head up to the clip edge and pulls the caption start back to the clip start', () => {
    // The first kept word starts a little before the cut's end (it is split by the cut): on the clip's side, nothing is cut back.
    const plan = reclaimOperations(sequence([caption('cap', 0, 1334)]), 'asset', cuts, { from: 565.899, to: 569.1, side: 'before' });
    expect(plan.ok && plan.operations).toEqual([
      { type: 'restoreCut', sequenceId: 'seq', assetId: 'asset', cutId: 'head' },
      { type: 'addCuts', sequenceId: 'seq', assetId: 'asset', cuts: [{ from: '0', to: '565.899' }] },
      { type: 'trimItem', sequenceId: 'seq', itemId: 'cap', edge: 'start', at: { unit: 'frames', value: 0 }, alignment: 'exact-frame' },
    ]);
    expect(plan.ok && plan.seconds).toBeCloseTo(569.2353333333333 - 565.899, 6);
  });

  it('extends the nearest caption on each subtitle track when none touches the seam', () => {
    const plan = reclaimOperations(
      sequence([caption('early', 0, 600), caption('late', 600, 700), caption('other', 0, 1334, 'S2')]),
      'asset',
      cuts,
      { from: 625.041, to: 3991.23725, side: 'after' },
    );
    // Cut to the end of the material: there is no far end to cut back; on S1, the one nearest the seam (ending at 1300) is extended to the end after restoration, and on S2, those touching the seam are extended as usual.
    expect(plan.ok && plan.operations).toEqual([
      { type: 'restoreCut', sequenceId: 'seq', assetId: 'asset', cutId: 'tail' },
      { type: 'trimItem', sequenceId: 'seq', itemId: 'late', edge: 'end', at: { unit: 'frames', value: 1334 + TAIL_FRAMES }, alignment: 'exact-frame' },
      { type: 'trimItem', sequenceId: 'seq', itemId: 'other', edge: 'end', at: { unit: 'frames', value: 1334 + TAIL_FRAMES }, alignment: 'exact-frame' },
    ]);
  });

  it('leaves captions that do not project through the clip alone', () => {
    const loose = { ...caption('loose', 0, 1334), scopeItemIds: [] };
    const plan = reclaimOperations(sequence([loose]), 'asset', cuts, { from: 625.041, to: 629.754, side: 'after' });
    expect(plan.ok && plan.operations.map((op) => op.type)).toEqual(['restoreCut', 'addCuts']);
  });
});
