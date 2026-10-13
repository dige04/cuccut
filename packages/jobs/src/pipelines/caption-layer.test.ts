import { describe, expect, it } from 'vitest';
import type { CaptionItem, DocumentRecord, EditOperation, Sequence, Track, VideoItem } from '@cuccut/protocol';
import {
  CUE_PARAMS,
  captionBody,
  cueOfUnit,
  displayWidth,
  readSpeechWords,
  retextCaption,
  translationCues,
  workerUnitCues,
  type CueTranslationUnit,
} from './caption-cues.ts';
import {
  DEFAULT_CAPTION_STYLE_BODY,
  TRANSLATION_CAPTION_EXTENSION,
  planCaptionLayer,
  type CaptionDocumentReader,
  type CaptionLayerPlan,
} from './caption-layer.ts';
import { PipelineStepError } from './pipeline.ts';

/**
 * For a translation with no Worker caption cues (written by the agent itself), build the caption layer: `translationCues` splits cues the same way as the editor's function of the same name (expected values follow `packages/ui/src/model/translation-cues.test.ts`), and the transaction computed by `planCaptionLayer` is the same as the editor's “put on screen”. An existing caption layer does not stop a new one from being built (§7.9 “no overwrite”).
 */

const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };

function video(id: string, fromFrame: number, durationFrames: number): VideoItem {
  return {
    ...base,
    id,
    trackId: 'v1',
    type: 'video',
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'asset', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1000 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

function caption(id: string, trackId: string, documentId: string, extra: Partial<CaptionItem> = {}): CaptionItem {
  return { ...base, id, trackId, type: 'caption', span: { fromFrame: 0, durationFrames: 90 }, documentId, ...extra };
}

const track = (id: string, order: number, kind: Track['kind']): Track => ({
  id,
  order,
  kind,
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: 'visual' },
});

function sequence(items: Sequence['items'], tracks: Track[] = [track('v1', 0, 'visual')]): Sequence {
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

const speechBody = {
  schema: 'cuccut.speech/1',
  timescale: 1000,
  sentences: null,
  speakers: [{ id: 'A', name: '主持人' }],
  words: [
    { id: 'w1', start: 0, end: 500, text: '今天', speaker: 'A' },
    { id: 'w2', start: 500, end: 1000, text: '很好。', speaker: 'A' },
    { id: 'w3', start: 2000, end: 2600, text: '我们', speaker: 'A' },
    { id: 'w4', start: 2600, end: 3000, text: '开始。', speaker: 'A' },
  ],
};
const speech = readSpeechWords(speechBody)!;

function unit(id: string, words: string[], text: string, extra: Partial<CueTranslationUnit> = {}): CueTranslationUnit {
  return { id, naturalText: text, alignment: { sourceWordIds: words }, status: 'draft', ...extra };
}

describe('translation → caption cues (same as the editor\'s translationCues)', () => {
  it('timing taken from the member words of the source sentence (media clock); stale and empty units produce no subtitles', () => {
    const cues = translationCues(speech, [
      unit('t-s-w1', ['w1', 'w2'], 'It is fine today.'),
      unit('t-s-w3', ['w3', 'w4'], "Let's begin."),
      unit('t-s-x', ['w1'], 'stale', { status: 'stale' }),
      unit('t-s-y', ['w3'], '  '),
    ]);
    expect(cues.map((c) => [c.id, c.text, c.start, c.end, c.speaker])).toEqual([
      ['q-t-s-w1', 'It is fine today.', 0, 1, 'A'],
      ['q-t-s-w3', "Let's begin.", 2, 3, 'A'],
    ]);
  });

  it('a rewritten display text takes priority; a unit with no alignment and no word found produces nothing', () => {
    const cues = translationCues(speech, [
      unit('t-s-w1', ['w1', 'w2'], 'It is fine today.', { displayRewrite: { text: 'Fine today.' } }),
      unit('t-s-w3', ['w3', 'w4'], "Let's begin.", { alignment: null }),
      unit('t-s-z', ['nope'], 'Gone.'),
    ]);
    expect(cues.map((c) => [c.id, c.text])).toEqual([['q-t-s-w1', 'Fine today.']]);
  });

  it('a long translation is split into several cues by display width, times interpolated by width, never crossing the source sentence', () => {
    const long = 'This is a rather long translated sentence, which certainly needs to wrap onto more than one caption line.';
    const cues = translationCues(speech, [unit('t-s-w1', ['w1', 'w2'], long)]);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]!.id).toBe('q-t-s-w1');
    expect(cues.slice(1).every((c) => /^q-t-s-w1~\d+$/.test(c.id))).toBe(true);
    expect(cues[0]!.start).toBe(0);
    expect(cues.at(-1)!.end).toBe(1);
    expect(cues.map((c) => c.text).join(' ')).toBe(long);
  });

  it('CJK translations break after fullwidth punctuation, measured in fullwidth width; joining back yields the same as the source', () => {
    for (const text of [
      '今天天气非常好，我们一起去公园散步吧，然后在湖边的小餐馆里吃一顿简单的午饭，下午再慢慢走回家休息。',
      '今日はとても良い天気なので、みんなで公園を散歩して、湖のそばの小さなお店で昼ごはんを食べましょう。',
      '오늘은 날씨가 아주 좋아서 우리 모두 함께 공원을 산책하고 호숫가의 작은 식당에서 점심을 먹읍시다.',
    ]) {
      const cues = translationCues(speech, [unit('t-s-w1', ['w1', 'w2'], text)]);
      expect(cues.length).toBeGreaterThan(1);
      expect(cues.every((c) => c.start >= 0 && c.end <= 1 && c.start < c.end)).toBe(true);
      expect(cues.every((c) => displayWidth(c.text) <= CUE_PARAMS.maxChars + CUE_PARAMS.overflowSlack)).toBe(true);
      expect(cues.map((c) => c.text).join(text.includes(' ') ? ' ' : '')).toBe(text);
    }
  });

  it('text with no spaces and no punctuation (Thai) is hard-split by display width', () => {
    const text = 'สวัสดีครับวันนี้อากาศดีมากเราจะไปเที่ยวทะเลด้วยกันแล้วกินข้าวเที่ยงที่ร้านริมหาดก่อนกลับบ้านตอนเย็น';
    const cues = translationCues(speech, [unit('t-s-w1', ['w1', 'w2'], text)]);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues.every((c) => displayWidth(c.text) <= CUE_PARAMS.maxChars + CUE_PARAMS.overflowSlack)).toBe(true);
    expect(cues.map((c) => c.text).join('')).toBe(text);
  });
});

describe('editing one sentence\'s translation → only that sentence\'s cues in the subtitles are replaced (same as the editor\'s retextCaption)', () => {
  const units = [unit('t-s-w1', ['w1', 'w2'], 'Fine.'), unit('t-s-w10', ['w3', 'w4'], 'Go.')];
  const body = captionBody(translationCues(speech, units), speech.speakers);

  it('cue ownership is decided by boundaries: t-s-w1 does not swallow t-s-w10', () => {
    expect(cueOfUnit('q-t-s-w1', 't-s-w1')).toBe(true);
    expect(cueOfUnit('q-t-s-w1~3', 't-s-w1')).toBe(true);
    expect(cueOfUnit('q-t-s-w10', 't-s-w1')).toBe(false);
    expect(cueOfUnit('q-t-s-w1-2', 't-s-w1')).toBe(false);
  });

  it('replaced in place; other cues (including hand-edited text) are untouched', () => {
    const edited = { ...body, cues: (body.cues as Array<Record<string, unknown>>).map((c) => (c.id === 'q-t-s-w10' ? { ...c, text: 'Go!!' } : c)) };
    const fresh = translationCues(speech, [unit('t-s-w1', ['w1', 'w2'], 'It is a very fine day today, my friends, a truly lovely one.')]);
    const next = retextCaption(edited, 't-s-w1', fresh, speech.speakers);
    const cues = next.cues as Array<{ id: string; text: string; start: number; end: number }>;
    expect(cues.at(-1)).toMatchObject({ id: 'q-t-s-w10', text: 'Go!!', start: 2000, end: 3000 });
    expect(cues.slice(0, -1).every((c) => c.id.startsWith('q-t-s-w1') && c.end <= 1000)).toBe(true);
    expect(cues.length).toBeGreaterThan(2);
    expect(next.schema).toBe('cuccut.caption/1');
  });

  it('cleared to empty removes that sentence; a sentence that had none is inserted at its time', () => {
    const removed = retextCaption(body, 't-s-w1', [], speech.speakers);
    expect((removed.cues as Array<{ id: string }>).map((c) => c.id)).toEqual(['q-t-s-w10']);
    const back = retextCaption(removed, 't-s-w1', translationCues(speech, [units[0]!]), speech.speakers);
    expect((back.cues as Array<{ id: string }>).map((c) => c.id)).toEqual(['q-t-s-w1', 'q-t-s-w10']);
  });

  it('Worker caption cues are taken per unit and converted to seconds, numbering same as workerCaptionBody; the caption body is converted back to its own scale', () => {
    const worker = {
      timescale: 48_000,
      cues: [
        { unitId: 't-s-w1', sentenceId: 's-w1', text: 'It is', start: 0, end: 24_000 },
        { unitId: 't-s-w1', sentenceId: 's-w1', text: 'fine.', start: 24_000, end: 48_000 },
        { unitId: 't-s-w10', sentenceId: 's-w3', text: 'Go.', start: 96_000, end: 144_000 },
      ],
    };
    const fresh = workerUnitCues(worker, 't-s-w1', new Map([['s-w1', 'A']]));
    expect(fresh).toEqual([
      { id: 'q-t-s-w1', start: 0, end: 0.5, text: 'It is', speaker: 'A' },
      { id: 'q-t-s-w1~2', start: 0.5, end: 1, text: 'fine.', speaker: 'A' },
    ]);
    const next = retextCaption(body, 't-s-w1', fresh, speech.speakers);
    expect((next.cues as Array<{ id: string; start: number; end: number }>).map((c) => [c.id, c.start, c.end])).toEqual([
      ['q-t-s-w1', 0, 500],
      ['q-t-s-w1~2', 500, 1000],
      ['q-t-s-w10', 2000, 3000],
    ]);
  });
});

const doc = (id: string, kind: string, extra: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id,
  kind,
  name: id,
  currentRevision: '1',
  revisions: {},
  ...extra,
});

describe('planCaptionLayer: the agent\'s captions_create', () => {
  const translationBody = (units: unknown[]) => ({
    schema: 'cuccut.translation/2',
    language: 'en',
    sourceBasis: { speechRef: { id: 'speech', revision: '1' }, sequenceId: 'seq', scopeLineage: [], editViewHash: 'h' },
    units,
  });
  const aligned = (id: string, words: string[], text: string) => ({
    id,
    sourceSentenceId: id.slice(2),
    sourceFingerprint: 'fp',
    naturalText: text,
    alignment: { basis: 'natural', correspondence: 'sentence', blocks: [], sourceWordIds: words, textHash: 'sha256:x' },
    status: 'draft',
  });
  const documents: Record<string, DocumentRecord> = {
    speech: doc('speech', 'speech', { sourceAssetId: 'asset', language: 'zh-Hans' }),
    trans: doc('trans', 'translation', { sourceDocumentId: 'speech', language: 'en' }),
    orig: doc('orig', 'caption', { sourceDocumentId: 'speech', sourceAssetId: 'asset' }),
    tcap: doc('tcap', 'caption', { sourceDocumentId: 'trans', sourceAssetId: 'asset' }),
  };
  const bodies: Record<string, unknown> = {
    speech: speechBody,
    trans: translationBody([aligned('t-s-w1', ['w1', 'w2'], 'It is fine today.'), aligned('t-s-w3', ['w3', 'w4'], "Let's begin.")]),
  };
  const reader = (overrides: Record<string, unknown> = {}): CaptionDocumentReader => ({
    document: async (_videoId, documentId) => ({ revision: '1', body: { ...bodies, ...overrides }[documentId] }),
  });
  const tracks = [track('v1', 0, 'visual'), track('s1', 1, 'subtitle')];
  const translation = (bilingual: boolean) => ({
    kind: 'translation' as const,
    documentId: 'trans',
    bilingual,
    cues: 'sentence-alignment' as const,
  });
  const types = (plan: CaptionLayerPlan) => plan.operations.map((op: EditOperation) => op.type);

  async function plan(seq: Sequence, source: Parameters<typeof planCaptionLayer>[1]['source'], overrides?: Record<string, unknown>) {
    const result = await planCaptionLayer(reader(overrides), { videoId: 'v', sequence: seq, documents, source });
    if ('reason' in result) throw new Error(`没有算出事务：${result.reason}`);
    return result;
  }

  it('transcription: the source caption layer goes into an empty subtitle track; if none, a new one is created', async () => {
    const created = await plan(sequence([video('a', 0, 90)]), { kind: 'speech', documentId: 'speech' });
    expect(types(created)).toEqual(['addTrack', 'putDocument', 'insertItems']);
    expect(created).toMatchObject({ cueCount: 2, enabled: true, existing: null });
    expect(created.operations[1]).toMatchObject({ kind: 'caption', sourceDocument: { documentId: 'speech' }, summary: { cueCount: 2 } });
    expect(created.operations[1]).not.toHaveProperty('extensions.pipeline');

    const free = await plan(sequence([video('a', 0, 90)], tracks), { kind: 'speech', documentId: 'speech' });
    expect(types(free)).toEqual(['putDocument', 'insertItems']);
    expect(free.operations[1]).toMatchObject({ items: [{ trackId: 's1', scopeItemIds: ['a'] }] });
  });

  it('transcription with an existing caption layer: no overwrite, the new layer is placed disabled, existing points to the existing layer', async () => {
    const seq = sequence([video('a', 0, 90), caption('o1', 's1', 'orig')], tracks);
    const again = await plan(seq, { kind: 'speech', documentId: 'speech' });
    expect(again).toMatchObject({ enabled: false, existing: { documentId: 'orig', itemIds: ['o1'] } });
    expect(again.operations.at(-1)).toMatchObject({ items: [{ enabled: false }] });
  });

  it('translation: cut cues by sentence-level alignment, creating a new subtitle track for this language; when viewing translation only, the paired source is removed', async () => {
    const seq = sequence([video('a', 0, 90), caption('o1', 's1', 'orig')], tracks);
    const created = await plan(seq, translation(false));
    expect(types(created)).toEqual(['addTrack', 'putDocument', 'updateItem', 'insertItems']);
    expect(created).toMatchObject({ cueCount: 2, enabled: true, existing: null, paired: { documentId: 'orig', itemIds: ['o1'] } });
    expect(created.operations[0]).toMatchObject({ kind: 'subtitle', name: 'English' });
    expect(created.operations[1]).toMatchObject({
      kind: 'caption',
      language: 'en',
      sourceDocument: { documentId: 'trans' },
      extensions: { [TRANSLATION_CAPTION_EXTENSION]: { translationDocumentId: 'trans', speechDocumentId: 'speech', speechRevision: '1' } },
    });
    const cues = (created.operations[1] as { body: { cues: Array<{ id: string; text: string; start: number; end: number }> } }).body.cues;
    expect(cues.map((c) => [c.id, c.text, c.start, c.end])).toEqual([
      ['q-t-s-w1', 'It is fine today.', 0, 1000],
      ['q-t-s-w3', "Let's begin.", 2000, 3000],
    ]);
    expect(created.operations[2]).toMatchObject({ type: 'updateItem', itemId: 'o1', enabled: false });
  });

  it('bilingual: translation and source share a newly created style, the source stays on screen', async () => {
    const seq = sequence([video('a', 0, 90), caption('o1', 's1', 'orig')], tracks);
    const created = await plan(seq, translation(true));
    expect(types(created)).toEqual(['addTrack', 'putDocument', 'putDocument', 'setCaptionStyle', 'insertItems']);
    // The new style is the default preset (spec §5.6): the classic look (black outline, drop shadow), with ordinary commas and periods replaced by spaces.
    expect(created.operations[2]).toMatchObject({ kind: 'caption-style', body: DEFAULT_CAPTION_STYLE_BODY });
    expect(DEFAULT_CAPTION_STYLE_BODY.style).toMatchObject({
      fontColor: '#FFFFFF',
      textOutline: { on: true, color: '#000000', width: 14 },
      background: false,
      wordAnimation: { catalogId: 'colourHighlight', active: { color: '#18E1D6' } },
      punct: true,
    });
    expect(created.operations.at(-1)).toMatchObject({ items: [{ styleDocumentRef: 'caption-style' }] });
    expect(created.operations.some((op) => op.type === 'updateItem')).toBe(false);
  });

  it('bilingual without a source caption layer: with pairOriginal, the source\'s layer is created first in the same transaction, both layers share the new style; without it, only the translation is created', async () => {
    const seq = sequence([video('a', 0, 90)], tracks);
    const both = await planCaptionLayer(reader(), {
      videoId: 'v',
      sequence: seq,
      documents,
      source: translation(true),
      pairOriginal: true,
    });
    if ('reason' in both) throw new Error(both.reason);
    expect(types(both)).toEqual(['putDocument', 'putDocument', 'insertItems', 'addTrack', 'putDocument', 'insertItems']);
    expect(both).toMatchObject({
      cueCount: 2,
      enabled: true,
      existing: null,
      paired: null,
      original: { documentRef: 'original-caption', cueCount: 2 },
    });
    expect(both.operations[0]).toMatchObject({ kind: 'caption-style', ref: 'caption-style', body: DEFAULT_CAPTION_STYLE_BODY });
    expect(both.operations[1]).toMatchObject({ kind: 'caption', ref: 'original-caption', sourceDocument: { documentId: 'speech' } });
    expect(both.operations[2]).toMatchObject({
      items: [{ documentRef: 'original-caption', trackId: 's1', styleDocumentRef: 'caption-style' }],
    });
    expect(both.operations[3]).toMatchObject({ type: 'addTrack', ref: 'caption-track', name: 'English' });
    expect(both.operations[4]).toMatchObject({ kind: 'caption', ref: 'caption', sourceDocument: { documentId: 'trans' } });
    expect(both.operations[5]).toMatchObject({
      items: [{ documentRef: 'caption', trackRef: 'caption-track', styleDocumentRef: 'caption-style' }],
    });
    expect(both.operations.some((op) => op.type === 'updateItem' || op.type === 'setCaptionStyle')).toBe(false);

    // No free caption track: the original-text track is created new and placed before the style.
    const noTrack = await planCaptionLayer(reader(), {
      videoId: 'v',
      sequence: sequence([video('a', 0, 90)]),
      documents,
      source: translation(true),
      pairOriginal: true,
    });
    if ('reason' in noTrack) throw new Error(noTrack.reason);
    expect(types(noTrack)).toEqual(['addTrack', 'putDocument', 'putDocument', 'insertItems', 'addTrack', 'putDocument', 'insertItems']);
    expect(noTrack.operations[0]).toMatchObject({ ref: 'original-caption-track' });
    expect(noTrack.operations[3]).toMatchObject({ items: [{ trackRef: 'original-caption-track' }] });

    // Without pairOriginal (fixed pipeline): only the translation's layer is created; paired is null.
    const only = await plan(seq, translation(true));
    expect(types(only)).toEqual(['addTrack', 'putDocument', 'insertItems']);
    expect(only).toMatchObject({ paired: null });
    expect(only).not.toHaveProperty('original');

    // The same translation already has a layer showing: the new layer is placed disabled, and the original is not created along with it.
    const shown = sequence([video('a', 0, 90), caption('t1', 's2', 'tcap')], [...tracks, track('s2', 2, 'subtitle')]);
    const dup = await planCaptionLayer(reader(), {
      videoId: 'v',
      sequence: shown,
      documents,
      source: translation(true),
      pairOriginal: true,
    });
    if ('reason' in dup) throw new Error(dup.reason);
    expect(types(dup)).toEqual(['addTrack', 'putDocument', 'insertItems']);
    expect(dup).toMatchObject({ enabled: false, paired: null });
    expect(dup).not.toHaveProperty('original');
  });

  it('the same translation already has a layer shown: the new layer is placed disabled, the paired source is untouched', async () => {
    const seq = sequence(
      [video('a', 0, 90), caption('o1', 's1', 'orig', { enabled: false }), caption('t1', 's2', 'tcap')],
      [...tracks, track('s2', 2, 'subtitle')],
    );
    const again = await plan(seq, translation(true));
    expect(again).toMatchObject({ enabled: false, existing: { documentId: 'tcap', itemIds: ['t1'] } });
    expect(types(again)).toEqual(['addTrack', 'putDocument', 'insertItems']);
    expect(again.operations.at(-1)).toMatchObject({ items: [{ enabled: false }] });
  });

  it('rejected when there are unaligned units (TRANSLATION_UNALIGNED); not created when the media is not on the timeline or there are no displayable cues', async () => {
    const seq = sequence([video('a', 0, 90)], tracks);
    const unaligned = translationBody([aligned('t-s-w1', ['w1', 'w2'], 'Fine.'), { ...aligned('t-s-w3', [], 'Go.'), alignment: null }]);
    const error = await planCaptionLayer(reader({ trans: unaligned }), {
      videoId: 'v',
      sequence: seq,
      documents,
      source: translation(false),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PipelineStepError);
    expect(error).toMatchObject({ code: 'TRANSLATION_UNALIGNED', details: { documentId: 'trans', unitIds: ['t-s-w3'] } });

    const offline = await planCaptionLayer(reader(), {
      videoId: 'v',
      sequence: sequence([], tracks),
      documents,
      source: translation(false),
    });
    expect(offline).toEqual({ reason: 'not-on-timeline' });

    const stale = translationBody([{ ...aligned('t-s-w1', ['w1'], 'Fine.'), status: 'stale', alignment: null }]);
    const empty = await planCaptionLayer(reader({ trans: stale }), { videoId: 'v', sequence: seq, documents, source: translation(false) });
    expect(empty).toEqual({ reason: 'empty' });
  });

  it('source and style committed together; a translation sharing an existing style does not overwrite it', async () => {
    const style = { ...DEFAULT_CAPTION_STYLE_BODY, style: { ...(DEFAULT_CAPTION_STYLE_BODY.style as Record<string, unknown>), punct: false, y: 74, width: 65 } };
    const seq = sequence([video('a', 0, 90)], tracks);
    const made = await planCaptionLayer(reader(), { videoId: 'v', sequence: seq, documents, source: { kind: 'speech', documentId: 'speech' }, captionStyle: style });
    expect(made).not.toHaveProperty('reason');
    if ('reason' in made) return;
    expect(made.operations[0]).toMatchObject({ kind: 'caption-style', body: style });
    expect(made.operations.at(-1)).toMatchObject({ items: [{ styleDocumentRef: 'caption-preferences-style' }] });
    const paired = sequence([video('a', 0, 90), caption('o1', 's1', 'orig', { styleDocumentId: 'saved-style' })], tracks);
    const translated = await planCaptionLayer(reader(), { videoId: 'v', sequence: paired, documents, source: translation(true), captionStyle: style });
    if ('reason' in translated) throw new Error(translated.reason);
    expect(translated.operations.some((op) => op.type === 'putDocument' && op.kind === 'caption-style')).toBe(false);
    expect(translated.operations.at(-1)).toMatchObject({ items: [{ styleDocumentId: 'saved-style' }] });
  });
});
