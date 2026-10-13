import { editorWasmAvailable } from '@cuccut/editor-wasm';
import { describe, expect, it } from 'vitest';
import {
  editUnit,
  markUnit,
  needsTranslation,
  pairRows,
  pairStats,
  readTranslation,
  sha256Hex,
  speechSentences,
  unitState,
  type SourceSentence,
  type TranslationBody,
  type TranslationUnit,
} from './translation-doc.ts';
import workerSample from './fixtures/worker-translation.json';

/**
 * Transcript: sentences split at sentence-ending punctuation, semicolons do not split; a 1.5-second pause does not split, a 1.9-second pause does; a speaker change splits; hidden words are kept out of the text and the fingerprint.
 */
const speech = {
  schema: 'cuccut.speech/1',
  timescale: 1000,
  words: [
    { id: 'w1', start: 0, end: 400, text: 'Hello', speaker: 'A' },
    { id: 'w2', start: 400, end: 800, text: 'world;', speaker: 'A' },
    { id: 'w3', start: 800, end: 1100, text: 'again.', speaker: 'A' },
    { id: 'w4', start: 1200, end: 1500, text: 'This', speaker: 'A' },
    { id: 'w5', start: 1500, end: 1700, text: 'um', speaker: 'A', hidden: true },
    { id: 'w6', start: 1700, end: 2000, text: 'works', speaker: 'A' },
    { id: 'w7', start: 3500, end: 3800, text: 'fine', speaker: 'A' },
    { id: 'w8', start: 5700, end: 6000, text: 'later', speaker: 'A' },
    { id: 'w9', start: 6000, end: 6400, text: '你好', speaker: 'B' },
    { id: 'w10', start: 6400, end: 6800, text: '世界', speaker: 'B' },
  ],
};

describe.skipIf(!editorWasmAvailable())('source sentences and fingerprints (subtitle and translation core rules, via editor-wasm)', () => {
  // The fingerprint is computed by the core over the same body; if the rules change, this test goes red.
  it('splits sentences at pauses of ≥ 1.8 seconds, speaker changes, and sentence-final punctuation; semicolons do not split', () => {
    const expected = [
      { id: 's-w1', wordIds: ['w1', 'w2', 'w3'], text: 'Hello world; again.', fingerprint: '3:w1:w3:2lr52qv73aau9' },
      { id: 's-w4', wordIds: ['w4', 'w6', 'w7'], text: 'This works fine', fingerprint: '3:w4:w7:3dwdwn9n9zq56' },
      { id: 's-w8', wordIds: ['w8'], text: 'later', fingerprint: '1:w8:w8:ucpsrxvtapoi' },
      { id: 's-w9', wordIds: ['w9', 'w10'], text: '你好世界', fingerprint: '2:w9:w10:2qbxjbuvi5uj7' },
    ];
    expect(speechSentences(speech)).toEqual(expected);
  });

  it('sentences stored in the body do not take part', () => {
    const stored = { ...speech, sentences: [{ id: 'S1', first: 'w1', last: 'w10' }] };
    expect(speechSentences(stored)!.map((s) => s.id)).toEqual(['s-w1', 's-w4', 's-w8', 's-w9']);
  });

  it('fingerprint changes when text is edited, not when hidden words change', () => {
    const edit = (id: string, patch: object) => ({ ...speech, words: speech.words.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
    const fingerprint = (body: unknown) => speechSentences(body)!.find((s) => s.id === 's-w4')!.fingerprint;
    expect(fingerprint(edit('w6', { text: 'worked' }))).not.toBe('3:w4:w7:3dwdwn9n9zq56');
    expect(fingerprint(edit('w5', { text: 'uh' }))).toBe('3:w4:w7:3dwdwn9n9zq56');
  });

  it('null when not a transcription, or the transcription is malformed (words lack source times)', () => {
    expect(speechSentences({ schema: 'cuccut.caption/1', cues: [] })).toBeNull();
    expect(speechSentences(null)).toBeNull();
    expect(speechSentences({ schema: 'cuccut.speech/1', words: [{ id: 'x', text: 'a' }] })).toBeNull();
  });

  it('translation textHash is SHA-256', async () => {
    expect(await sha256Hex('Bonjour le monde.')).toBe('4178c4d4c2fd95163ebbe7eca64d886ca5e6f69a9c1f51d0760ac80207a343e6');
  });
});

const sentence = (id: string, text: string, fingerprint = `fp-${id}`, wordIds = [id]): SourceSentence => ({
  id,
  wordIds,
  text,
  fingerprint,
});

function unit(sentenceId: string, text: string, extra: Partial<TranslationUnit> = {}): TranslationUnit {
  return {
    id: `t-${sentenceId}`,
    sourceSentenceId: sentenceId,
    sourceFingerprint: `fp-${sentenceId}`,
    naturalText: text,
    alignment: { basis: 'natural', correspondence: 'sentence', blocks: [], sourceWordIds: [sentenceId], textHash: 'sha256:old' },
    status: 'draft',
    ...extra,
  };
}

function translation(units: TranslationUnit[]): TranslationBody {
  return {
    schema: 'cuccut.translation/2',
    language: 'en',
    sourceBasis: { speechRef: { id: 'speech', revision: '1' }, sequenceId: 'seq', scopeLineage: [], editViewHash: 'sha256:x' },
    units,
  };
}

describe('source and translation are paired sentence by sentence', () => {
  it('in transcription sentence order; units whose source sentence is gone are placed after the previous unit; newly appearing sentences are listed as untranslated', () => {
    const sentences = [sentence('s1', '一'), sentence('s3', '三'), sentence('s4', '四', 'fp-new')];
    const body = translation([
      unit('s0', 'zero'),
      unit('s1', 'one'),
      unit('s2', 'two'),
      unit('s4', 'four'),
      unit('s5', 'five', { status: 'stale' }),
    ]);
    const rows = pairRows(sentences, body);
    expect(rows.map((r) => [r.key, r.state])).toEqual([
      ['t-s0', 'sentence-gone'],
      ['t-s1', 'ok'],
      ['t-s2', 'sentence-gone'],
      ['s:s3', 'untranslated'],
      ['t-s4', 'source-changed'],
      ['t-s5', 'marked-stale'],
    ]);
    expect(pairStats(rows)).toEqual({ sentences: 3, untranslated: 1, stale: 2, gone: 2 });
  });

  it('status precedence matches dub.ts: marked stale > source gone > source edited > no translation', () => {
    expect(unitState(unit('s1', 'x', { status: 'stale' }), null)).toBe('marked-stale');
    expect(unitState(unit('s1', 'x'), null)).toBe('sentence-gone');
    expect(unitState(unit('s1', ''), sentence('s1', '一', 'other'))).toBe('source-changed');
    expect(unitState(unit('s1', '  '), sentence('s1', '一'))).toBe('empty');
    expect(unitState(unit('s1', 'x', { displayRewrite: { text: 'X!', reason: 'width', reviewed: false } }), sentence('s1', '一'))).toBe(
      'ok',
    );
    expect(unitState(null, sentence('s1', '一'))).toBe('untranslated');
  });

  it('only counts the /2 body', () => {
    expect(readTranslation(translation([unit('s1', 'one')]))?.units).toHaveLength(1);
    expect(readTranslation({ schema: 'cuccut.translation/1', units: [] })).toBeNull();
    expect(readTranslation({ ...translation([]), units: [{ id: 'x' }] })).toBeNull();
  });
});

describe('edits one translation sentence in place', () => {
  const sentences = [sentence('s1', '一'), sentence('s2', '二', 'fp-new', ['s2', 's2b']), sentence('s3', '三')];

  it('updates naturalText, recomputes textHash, marks as reviewed; not written when the text is unchanged', async () => {
    const body = translation([unit('s1', 'one'), unit('s2', 'two'), unit('s3', 'three')]);
    const rows = pairRows(sentences, body);
    expect(await editUnit(body, sentences, rows[0]!, ' one ')).toBeNull();
    const result = await editUnit(body, sentences, rows[0]!, 'One!');
    expect(result!.unit).toMatchObject({ id: 't-s1', naturalText: 'One!', status: 'reviewed', sourceFingerprint: 'fp-s1' });
    expect(result!.unit.alignment!.textHash).toBe(`sha256:${await sha256Hex('One!')}`);
    expect(result!.body.units.map((u) => u.naturalText)).toEqual(['One!', 'two', 'three']);
    // Other fields are kept as they are.
    expect(result!.body.sourceBasis).toBe(body.sourceBasis);
  });

  it('source edited: edits against the current source, and fingerprint and word members are replaced with those of the current sentence', async () => {
    const body = translation([unit('s1', 'one'), unit('s2', 'two'), unit('s3', 'three')]);
    const rows = pairRows(sentences, body);
    expect(rows[1]!.state).toBe('source-changed');
    const result = await editUnit(body, sentences, rows[1]!, 'Two, revised');
    expect(result!.unit).toMatchObject({ sourceFingerprint: 'fp-new', status: 'reviewed' });
    expect(result!.unit.alignment!.sourceWordIds).toEqual(['s2', 's2b']);
    expect(unitState(result!.unit, sentences[1]!)).toBe('ok');
  });

  it('with subtitle display, the rewritten text is edited; natural translation is untouched', async () => {
    const body = translation([unit('s1', 'one', { displayRewrite: { text: 'One', reason: 'width', reviewed: false } })]);
    const rows = pairRows([sentences[0]!], body);
    const result = await editUnit(body, [sentences[0]!], rows[0]!, 'Uno');
    expect(result!.unit.naturalText).toBe('one');
    expect(result!.unit.displayRewrite).toEqual({ text: 'Uno', reason: 'width', reviewed: true });
    expect(result!.unit.alignment!.textHash).toBe('sha256:old');
  });

  it('a sentence with no translation yet gets a new unit inserted after the nearest preceding sentence; sentences whose source is gone cannot be edited', async () => {
    const body = translation([unit('s1', 'one'), unit('s0', 'gone'), unit('s3', 'three')]);
    const rows = pairRows(sentences, body);
    const fresh = rows.find((r) => r.key === 's:s2')!;
    expect(await editUnit(body, sentences, fresh, '  ')).toBeNull();
    const result = await editUnit(body, sentences, fresh, 'two');
    expect(result!.body.units.map((u) => u.id)).toEqual(['t-s1', 't-s2', 't-s0', 't-s3']);
    expect(result!.unit).toMatchObject({ sourceSentenceId: 's2', sourceFingerprint: 'fp-new', status: 'reviewed' });
    expect(result!.unit.alignment).toMatchObject({ basis: 'natural', correspondence: 'sentence', sourceWordIds: ['s2', 's2b'] });
    const gone = rows.find((r) => r.key === 't-s0')!;
    expect(await editUnit(body, sentences, gone, 'nope')).toBeNull();
  });
});

describe('marking as stale and clearing the stale mark', () => {
  const sentences = [sentence('s1', '一'), sentence('s2', '二', 'fp-new', ['s2', 's2b']), sentence('s3', '三')];

  it('marking as stale only changes the status; units already marked, with no unit, or whose source is gone are not written', () => {
    const body = translation([unit('s1', 'one'), unit('s0', 'gone'), unit('s3', 'three', { status: 'stale' })]);
    const rows = pairRows(sentences, body);
    const result = markUnit(body, rows[0]!, true);
    expect(result!.unit).toMatchObject({ id: 't-s1', naturalText: 'one', status: 'stale', sourceFingerprint: 'fp-s1' });
    expect(result!.rebound).toBe(false);
    expect(pairRows(sentences, result!.body)[0]!.state).toBe('marked-stale');
    expect(markUnit(body, rows.find((r) => r.key === 't-s3')!, true)).toBeNull();
    expect(markUnit(body, rows.find((r) => r.key === 's:s2')!, true)).toBeNull();
    expect(markUnit(body, rows.find((r) => r.key === 't-s0')!, true)).toBeNull();
  });

  it('clearing the mark accepts the current translation: marked as reviewed; if the source was edited, fingerprint and words are replaced with the current sentence\'s, and it no longer counts as stale', () => {
    const body = translation([unit('s1', 'one', { status: 'stale' }), unit('s2', 'two', { status: 'stale' }), unit('s3', 'three')]);
    const rows = pairRows(sentences, body);
    const marked = markUnit(body, rows[0]!, false)!;
    expect(marked.unit).toMatchObject({ status: 'reviewed', sourceFingerprint: 'fp-s1' });
    expect(marked.rebound).toBe(false);
    // Marked stale and the source sentence also changed: both are removed together.
    const changed = markUnit(body, rows[1]!, false)!;
    expect(changed.rebound).toBe(true);
    expect(changed.unit).toMatchObject({ status: 'reviewed', sourceFingerprint: 'fp-new', naturalText: 'two' });
    expect(changed.unit.alignment!.sourceWordIds).toEqual(['s2', 's2b']);
    expect(unitState(changed.unit, sentences[1]!)).toBe('ok');
    // Ones that are not stale are not written.
    expect(markUnit(body, rows[2]!, false)).toBeNull();
  });

  it('batch retranslation scope: stale ones and ones with no translation yet', () => {
    const body = translation([unit('s1', ' '), unit('s3', 'three')]);
    const rows = pairRows([...sentences, sentence('s4', '四')], translation([...body.units, unit('s4', 'four', { status: 'stale' })]));
    expect(rows.filter(needsTranslation).map((r) => r.key)).toEqual(['t-s1', 's:s2', 't-s4']);
  });
});

/**
 * End to end: `fixtures/worker-translation.json` is the translation written by a real Speech Worker from the same transcript (the model is a fake), together with that transcript.
 * The UI checks each sentence against the sentences and fingerprints it derives itself, and every one should come out normal, since both sides use the same core rules. The transcript contains a semicolon, pauses of 1.5 and 1.9 seconds,
 * hidden words and a speaker change. The sample is verified by speech-worker.test.ts in packages/jobs against a real Worker (rewritten when `CUCCUT_WRITE_FIXTURES=1`).
 */
describe.skipIf(!editorWasmAvailable())('translations written by the Speech Worker are checked in the UI', () => {
  const translation = readTranslation(workerSample.translation)!;
  const sentences = speechSentences(workerSample.speech)!;

  it('every sentence has a translation, status is normal', () => {
    expect(translation).not.toBeNull();
    expect(sentences.map((s) => s.id)).toEqual(['s-w1', 's-w11', 's-w17', 's-w21', 's-w25', 's-w28']);
    const rows = pairRows(sentences, translation);
    expect(rows.map((r) => [r.key, r.state])).toEqual(translation.units.map((u) => [u.id, 'ok']));
    expect(pairStats(rows)).toEqual({ sentences: 6, untranslated: 0, stale: 0, gone: 0 });
  });

  it('a source sentence\'s text is changed: only that sentence becomes stale; after editing its translation in place it is normal again', async () => {
    const speech = {
      ...workerSample.speech,
      words: workerSample.speech.words.map((w) => (w.id === 'w19' ? { ...w, text: ' mix' } : w)),
    };
    const changed = speechSentences(speech)!;
    const rows = pairRows(changed, translation);
    expect(rows.filter((r) => r.state !== 'ok').map((r) => [r.sentence!.id, r.state])).toEqual([['s-w17', 'source-changed']]);
    const result = await editUnit(
      translation,
      changed,
      rows.find((r) => r.state === 'source-changed')!,
      '然后我们混音。',
    );
    expect(pairRows(changed, result!.body).every((r) => r.state === 'ok')).toBe(true);
  });
});
