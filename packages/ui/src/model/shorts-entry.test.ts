import { describe, expect, it } from 'vitest';
import { cutEntryAction, entryAnchor, landingPanel } from './shorts-entry.ts';
import { foldOutside } from './shorts-fold.ts';
import type { TranscriptParagraph, TranscriptWord, WordState } from './transcript-cut.ts';

type Tab = 'transcript' | 'aitools' | 'video' | 'elements' | 'subtitle';

describe('cutEntryAction', () => {
  it('offers adjust whenever the pane is not on the transcript (or is hidden)', () => {
    for (const tab of ['aitools', 'video', 'elements', 'subtitle', null] as const) {
      expect(cutEntryAction<Tab>(tab, null, { hasResult: true, ai: true })).toEqual({ kind: 'adjust', to: 'transcript', railLabel: null });
    }
    // Remembers its origin but has already left the script: ignore the origin.
    expect(cutEntryAction<Tab>('video', { tab: 'aitools' }, { hasResult: true, ai: true }).kind).toBe('adjust');
  });

  it('goes back to the results page when it came from AI tools and this short has one', () => {
    expect(cutEntryAction<Tab>('transcript', { tab: 'aitools' }, { hasResult: true, ai: true, railLabel: 'AI tools' })).toEqual({
      kind: 'backResult',
      to: 'aitools',
      railLabel: null,
    });
  });

  it('goes back to the panel it came from by its rail label otherwise', () => {
    expect(cutEntryAction<Tab>('transcript', { tab: 'video' }, { hasResult: true, ai: true, railLabel: 'Video' })).toEqual({
      kind: 'back',
      to: 'video',
      railLabel: 'Video',
    });
    expect(cutEntryAction<Tab>('transcript', { tab: 'elements' }, { railLabel: 'Elements' })).toMatchObject({ kind: 'back', to: 'elements' });
    // Came from an AI tool but has no result page, or this surface has no AI tool: go back by the toolbar name.
    expect(cutEntryAction<Tab>('transcript', { tab: 'aitools' }, { hasResult: false, ai: true, railLabel: 'AI tools' })).toEqual({
      kind: 'back',
      to: 'aitools',
      railLabel: 'AI tools',
    });
    expect(cutEntryAction<Tab>('transcript', { tab: 'aitools' }, { hasResult: true, ai: false, railLabel: 'AI tools' }).kind).toBe('back');
    // When no name is given, fall back to the panel identifier.
    expect(cutEntryAction<Tab>('transcript', { tab: 'subtitle' }).railLabel).toBe('subtitle');
  });

  it('offers the results page on a direct landing when there is one and AI tools exist, else nothing', () => {
    expect(cutEntryAction<Tab>('transcript', null, { hasResult: true, ai: true })).toEqual({ kind: 'result', to: 'aitools', railLabel: null });
    expect(cutEntryAction<Tab>('transcript', null, { hasResult: false, ai: true }).kind).toBeNull();
    expect(cutEntryAction<Tab>('transcript', null, { hasResult: true, ai: false }).kind).toBeNull();
    expect(cutEntryAction<Tab>('transcript', undefined).kind).toBeNull();
    // The origin is the script itself (never recorded; defensive): treat as having no origin.
    expect(cutEntryAction<Tab>('transcript', { tab: 'transcript' }, { hasResult: true, ai: true }).kind).toBe('result');
  });
});

describe('landingPanel', () => {
  it('follows an explicit handoff and leaves the transcript mode alone', () => {
    expect(landingPanel<Tab>({ handoff: 'aitools', child: true, hasItems: true })).toEqual({ tab: 'aitools', cut: false });
    expect(landingPanel<Tab>({ handoff: 'aitools', child: false, hasItems: undefined })).toEqual({ tab: 'aitools', cut: false });
  });

  it('lands a short opened without a handoff on the transcript with cuts shown', () => {
    expect(landingPanel<Tab>({ handoff: undefined, child: true, hasItems: true })).toEqual({ tab: 'transcript', cut: true });
    expect(landingPanel<Tab>({ handoff: null, child: true, hasItems: false })).toEqual({ tab: 'transcript', cut: true });
  });

  it('keeps the usual landing for other videos and waits for the snapshot', () => {
    expect(landingPanel<Tab>({ handoff: undefined, child: false, hasItems: true })).toEqual({ tab: 'transcript', cut: false });
    expect(landingPanel<Tab>({ handoff: undefined, child: false, hasItems: false })).toEqual({ tab: 'video', cut: false });
    expect(landingPanel<Tab>({ handoff: undefined, child: true, hasItems: undefined })).toEqual({ tab: undefined, cut: false });
  });
});

/** One sentence per second, two words per sentence (the second with a period); `kept` is the period that stays on the timeline (from 0). Same as shorts-fold.test.ts. */
function transcript(sentences: number, kept: [number, number], perParagraph = 4) {
  const words: TranscriptWord[] = [];
  for (let s = 0; s < sentences; s++) {
    const state: WordState = s >= kept[0] && s <= kept[1] ? 'kept' : 'cut';
    for (const [k, text] of ['a', 'b.'].entries()) {
      const index = words.length;
      words.push({ id: `w${index}`, index, start: s + k * 0.5, end: s + k * 0.5 + 0.5, text, paragraphStart: false, placements: [], state, spaced: true });
    }
  }
  const paragraphs: TranscriptParagraph[] = [];
  for (let i = 0; i < words.length; i += perParagraph * 2) {
    const chunk = words.slice(i, i + perParagraph * 2);
    paragraphs.push({ key: chunk[0]!.id, words: chunk });
  }
  return { words, paragraphs };
}

describe('entryAnchor', () => {
  it('lands on the seam before the clip when sentences before it are folded', () => {
    const { words, paragraphs } = transcript(30, [20, 25]);
    const plan = foldOutside(words, paragraphs, { before: 0, after: 0 });
    expect(entryAnchor(plan, words, paragraphs)).toEqual({ fold: 'before' });
    // Cut seams already spread out are still on that line.
    const open = foldOutside(words, paragraphs, { before: 99, after: 0 });
    expect(entryAnchor(open, words, paragraphs)).toEqual({ fold: 'before' });
  });

  it('lands on the paragraph holding the first kept word when nothing before is folded', () => {
    // The clip starts at sentence 1: it falls in the first paragraph.
    const a = transcript(30, [0, 9]);
    expect(entryAnchor(foldOutside(a.words, a.paragraphs, { before: 0, after: 0 }), a.words, a.paragraphs)).toEqual({ paragraph: 0 });
    // Only 3 sentences before the clip (cut seams not counted); the clip's first sentence is in the second paragraph (4 sentences per paragraph).
    const b = transcript(30, [3, 9]);
    expect(entryAnchor(foldOutside(b.words, b.paragraphs, { before: 0, after: 0 }), b.words, b.paragraphs)).toEqual({ paragraph: 0 });
    const c = transcript(30, [3, 9], 2);
    expect(entryAnchor(foldOutside(c.words, c.paragraphs, { before: 0, after: 0 }), c.words, c.paragraphs)).toEqual({ paragraph: 1 });
  });

  it('is null when there is no fold plan (everything cut)', () => {
    const { words, paragraphs } = transcript(4, [9, 9]);
    expect(entryAnchor(foldOutside(words, paragraphs, { before: 0, after: 0 }), words, paragraphs)).toBeNull();
    expect(entryAnchor(null, words, paragraphs)).toBeNull();
  });
});
