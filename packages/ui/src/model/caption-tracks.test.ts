import { describe, expect, it } from 'vitest';
import type { CaptionItem, DocumentRecord, Sequence, Track } from '@cuccut/protocol';
import { captionChips, dropOperations, flipTarget, languageName, onScreen, putBackOperations } from './caption-tracks.ts';

const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };

const track = (id: string, order: number, extra: Partial<Track> = {}): Track => ({
  id,
  order,
  kind: 'subtitle',
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: 'visual' },
  ...extra,
});

function caption(id: string, trackId: string, documentId: string, fromFrame = 0, extra: Partial<CaptionItem> = {}): CaptionItem {
  return { ...base, id, trackId, type: 'caption', span: { fromFrame, durationFrames: 30 }, documentId, ...extra };
}

function doc(id: string, kind: string, name: string, extra: Partial<DocumentRecord> = {}): DocumentRecord {
  return { id, kind, name, currentRevision: '1', revisions: {}, ...extra };
}

function sequence(tracks: Track[], items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps: { num: 30, den: 1 },
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

const documents: Record<string, DocumentRecord> = {
  speech: doc('speech', 'speech', '转写'),
  trans: doc('trans', 'translation', '英文译文', { language: 'en' }),
  orig: doc('orig', 'caption', '访谈', { sourceDocumentId: 'speech', language: 'zh' }),
  en: doc('en', 'caption', '访谈 English', { sourceDocumentId: 'trans', language: 'en' }),
  other: doc('other', 'caption', '旁白'),
};

describe('caption track strips', () => {
  it('one chip per caption on each track: original written as \'original\', translation written as language name; several segments from a cut count as one chip', () => {
    const seq = sequence(
      [track('s2', 2), track('s1', 1)],
      [caption('c3', 's2', 'en'), caption('c2', 's1', 'orig', 60), caption('c1', 's1', 'orig', 0)],
    );
    const chips = captionChips(seq, documents);
    expect(chips.map((chip) => [chip.label, chip.itemIds, chip.kind, chip.state])).toEqual([
      ['原文', ['c1', 'c2'], 'original', 'on'],
      ['English', ['c3'], 'translation', 'on'],
    ]);
  });

  it('same-named ones get the document name added; removed, track-disabled, and locked each have a status', () => {
    const seq = sequence(
      [track('s1', 1), track('s2', 2, { visible: false }), track('s3', 3, { locked: true })],
      [caption('a', 's1', 'orig'), caption('b', 's2', 'other'), caption('c', 's3', 'en', 0, { enabled: false })],
    );
    const chips = captionChips(seq, documents);
    expect(chips.map((chip) => [chip.label, chip.state, chip.locked])).toEqual([
      ['原文（访谈）', 'on', false],
      ['原文（旁白）', 'off', false],
      ['English', 'shelved', true],
    ]);
    expect(onScreen(chips).map((chip) => chip.documentId)).toEqual(['orig', 'other']);
  });

  it('instances whose document is missing are not listed; when the language name is not recognized, shown as-is', () => {
    expect(captionChips(sequence([track('s1', 1)], [caption('x', 's1', 'missing')]), documents)).toEqual([]);
    expect(languageName('ja')).toBe('日本語');
    expect(languageName('!!')).toBe('!!');
  });

  it('remove: the last one is refused; otherwise disable every segment of this chip', () => {
    const one = sequence([track('s1', 1)], [caption('a', 's1', 'orig'), caption('b', 's1', 'other', 60, { enabled: false })]);
    const chips = captionChips(one, documents);
    expect(dropOperations(one, chips, chips[0]!)).toEqual({ refused: 'last' });
    const two = sequence([track('s1', 1), track('s2', 2)], [caption('a', 's1', 'orig'), caption('a2', 's1', 'orig', 60), caption('b', 's2', 'en')]);
    const both = captionChips(two, documents);
    expect(dropOperations(two, both, both[0]!)).toEqual({
      operations: [
        { type: 'updateItem', sequenceId: 'seq', itemId: 'a', enabled: false },
        { type: 'updateItem', sequenceId: 'seq', itemId: 'a2', enabled: false },
      ],
    });
  });

  it('put back: asked once when two tracks are already on screen (three after putting back)', () => {
    const seq = sequence(
      [track('s1', 1), track('s2', 2), track('s3', 3)],
      [caption('a', 's1', 'orig'), caption('b', 's2', 'en', 0, { enabled: false }), caption('c', 's3', 'other', 0, { enabled: false })],
    );
    const chips = captionChips(seq, documents);
    expect(putBackOperations(seq, chips, chips[1]!)).toEqual({
      confirm: null,
      operations: [{ type: 'updateItem', sequenceId: 'seq', itemId: 'b', enabled: true }],
    });
    const after = captionChips(
      sequence(seq.tracks, [caption('a', 's1', 'orig'), caption('b', 's2', 'en'), caption('c', 's3', 'other', 0, { enabled: false })]),
      documents,
    );
    expect(putBackOperations(seq, after, after[2]!).confirm).toBe(3);
  });

  it('swap: target only exists when original and translation share one style and both are on screen', () => {
    const shared = sequence(
      [track('s1', 1), track('s2', 2)],
      [caption('a', 's1', 'orig', 0, { styleDocumentId: 'st' }), caption('b', 's2', 'en', 0, { styleDocumentId: 'st' })],
    );
    expect(flipTarget(captionChips(shared, documents))).toBe('st');
    const apart = sequence(
      [track('s1', 1), track('s2', 2)],
      [caption('a', 's1', 'orig', 0, { styleDocumentId: 'st' }), caption('b', 's2', 'en', 0, { styleDocumentId: 'st2' })],
    );
    expect(flipTarget(captionChips(apart, documents))).toBeNull();
    const originals = sequence(
      [track('s1', 1), track('s2', 2)],
      [caption('a', 's1', 'orig', 0, { styleDocumentId: 'st' }), caption('b', 's2', 'other', 0, { styleDocumentId: 'st' })],
    );
    expect(flipTarget(captionChips(originals, documents))).toBeNull();
  });
});
