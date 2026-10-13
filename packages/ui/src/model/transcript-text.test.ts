import { describe, expect, it } from 'vitest';
import { compileFind, findRanges } from './text-find.ts';
import type { TranscriptWord } from './transcript-cut.ts';
import {
  chapterSections,
  copyReceipt,
  lengthReceipt,
  copyText,
  paragraphText,
  paragraphTranslations,
  replaceInParagraph,
  timeStamp,
  wordHighlights,
  writeTranscript,
  type CopyParagraph,
} from './transcript-text.ts';

/** Words in the transcript: only fill the fields the text assembly needs. */
function w(index: number, id: string, text: string, spaced: boolean, state: TranscriptWord['state'] = 'kept'): TranscriptWord {
  return { id, index, text, spaced, state, start: index, end: index + 1, placements: [], paragraphStart: false };
}

const speech = (words: Array<{ id: string; text: string; start?: number; end?: number; hidden?: boolean }>, extra: Record<string, unknown> = {}) => ({
  schema: 'cuccut.speech/1',
  clock: 'source-asset',
  timescale: 1_000_000,
  speakers: [],
  words: words.map((word, n) => ({ start: n * 1_000_000, end: (n + 1) * 1_000_000, ...word })),
  sentences: null,
  ...extra,
});

const texts = (body: Record<string, unknown> | undefined) => (body?.words as Array<{ text: string; hidden?: boolean }>).map((x) => (x.hidden ? null : x.text));

function replaceAll(body: unknown, words: TranscriptWord[], query: string, replacement: string) {
  const para = paragraphText(words);
  const { re } = compileFind(query, { matchCase: false, wholeWord: false, regex: false });
  return replaceInParagraph(body, para, findRanges(para.text, re!, false), replacement);
}

describe('timecode', () => {
  it('mm:ss rounded down, hh:mm:ss for an hour or more (same format as the exported transcript)', () => {
    expect([timeStamp(0), timeStamp(65.9), timeStamp(599.99), timeStamp(3723), timeStamp(-2)]).toEqual([
      '00:00',
      '01:05',
      '09:59',
      '01:02:03',
      '00:00',
    ]);
  });
});

describe('segment text', () => {
  it('words trimmed of leading and trailing whitespace; spaced words get a leading space; fully cut words do not count, but count when copying a selection', () => {
    const words = [w(0, 'a', ' Hello', false), w(1, 'b', ' big', true, 'cut'), w(2, 'c', ' world', true), w(3, 'd', '.', false)];
    expect(paragraphText(words)).toEqual({
      text: 'Hello world.',
      words: [
        { id: 'a', index: 0, start: 0, end: 5 },
        { id: 'c', index: 2, start: 6, end: 11 },
        { id: 'd', index: 3, start: 11, end: 12 },
      ],
    });
    expect(paragraphText(words, true).text).toBe('Hello big world.');
    expect(paragraphText([w(0, 'x', '你好', false), w(1, 'y', '世界', false)]).text).toBe('你好世界');
  });
});

describe('distributes the match across words', () => {
  it('within a word, given by the word\'s offset; when covering a space between words, marked before the following word; the current one is marked separately', () => {
    const para = paragraphText([w(0, 'a', ' Hello', false), w(1, 'b', ' big', true, 'cut'), w(2, 'c', ' world', true), w(3, 'd', '.', false)]);
    const marks = wordHighlights(para, [
      { start: 4, end: 7, current: true },
      { start: 11, end: 12 },
    ]);
    expect(marks.get(0)).toEqual({ ranges: [{ start: 4, end: 5, current: true }], gap: 0 });
    expect(marks.get(1)).toBeUndefined();
    expect(marks.get(2)).toEqual({ ranges: [{ start: 0, end: 1, current: true }], gap: 2 });
    expect(marks.get(3)).toEqual({ ranges: [{ start: 0, end: 1, current: false }], gap: 0 });
  });
});

describe('replace', () => {
  it('a match within one word changes only that word; multiple matches in one word change together; leading whitespace kept', () => {
    const body = speech([
      { id: 'a', text: ' banana' },
      { id: 'b', text: ' split' },
    ]);
    const words = [w(0, 'a', ' banana', false), w(1, 'b', ' split', true)];
    const result = replaceAll(body, words, 'an', 'AN');
    expect(result?.changed).toBe(2);
    expect(texts(result?.body)).toEqual([' bANANa', ' split']);
  });

  it('across words: when block counts match, they map one-to-one onto words; when they do not, all go to the first word and the rest are hidden', () => {
    const body = speech([
      { id: 'a', text: ' Jim' },
      { id: 'b', text: ' Lu' },
      { id: 'c', text: ' said' },
    ]);
    const words = [w(0, 'a', ' Jim', false), w(1, 'b', ' Lu', true), w(2, 'c', ' said', true)];
    expect(texts(replaceAll(body, words, 'jim lu', 'Jim Liu')?.body)).toEqual([' Jim', ' Liu', ' said']);
    expect(texts(replaceAll(body, words, 'm l', 'X')?.body)).toEqual([' JiXu', null, ' said']);
    expect(texts(replaceAll(body, words, 'jim lu', '')?.body)).toEqual([null, null, ' said']);
  });

  it('a match covering the space between words merges the words on both sides; Chinese cross-word matches land on the first word', () => {
    const body = speech([
      { id: 'a', text: ' open' },
      { id: 'b', text: ' AI' },
    ]);
    const words = [w(0, 'a', ' open', false), w(1, 'b', ' AI', true)];
    expect(texts(replaceAll(body, words, ' ', '')?.body)).toEqual([' openAI', null]);
    expect(texts(replaceAll(body, words, 'n ', 'n-')?.body)).toEqual([' open-AI', null]);

    const zh = speech([
      { id: 'x', text: '你' },
      { id: 'y', text: '好' },
      { id: 'z', text: '吗' },
    ]);
    const zhWords = [w(0, 'x', '你', false), w(1, 'y', '好', false), w(2, 'z', '吗', false)];
    expect(texts(replaceAll(zh, zhWords, '你好', '您好')?.body)).toEqual(['您好', null, '吗']);
  });

  it('replacing with identical text or with no match writes nothing (null); cut words do not participate', () => {
    const body = speech([
      { id: 'a', text: '一' },
      { id: 'b', text: '二' },
    ]);
    const words = [w(0, 'a', '一', false), w(1, 'b', '二', false, 'cut')];
    expect(replaceAll(body, words, '一', '一')).toBeNull();
    expect(replaceAll(body, words, '二', '三')).toBeNull();
    expect(replaceAll(body, words, '一', '壹')?.changed).toBe(1);
  });
});

describe('copy', () => {
  const paras: CopyParagraph[] = [
    { start: 12.6, speaker: '主持人', text: '大家好，欢迎收看。', translation: 'Hello everyone.' },
    { start: 65, speaker: null, text: 'Then we start.', translation: '然后我们开始。' },
  ];

  it('plain text: a blank line between segments', () => {
    expect(copyText(paras, { view: 'source' })).toBe('大家好，欢迎收看。\n\nThen we start.');
  });

  it('translation and bilingual: bilingual is one line of original, one line of translation', () => {
    expect(copyText(paras, { view: 'translation' })).toBe('Hello everyone.\n\n然后我们开始。');
    expect(copyText(paras.slice(0, 1), { view: 'both' })).toBe('大家好，欢迎收看。\nHello everyone.');
  });

  it('laid out per the exported transcript format (§4.4): Markdown speaker in bold, timestamp at segment end, markup characters escaped', () => {
    const md = { format: 'md', view: 'source', speakers: true, timestamps: true } as const;
    expect(writeTranscript([{ chapter: null, paras }], md)).toBe('**主持人:** 大家好，欢迎收看。 [00:12]\n\nThen we start. [01:05]');
    expect(writeTranscript([{ chapter: null, paras: [{ ...paras[1]!, text: 'a*b_c #1' }] }], { ...md, timestamps: false })).toBe('a\\*b\\_c \\#1');
    // A bilingual translation is quoted in its own block; in translation-only view, the translation is written as body text.
    expect(writeTranscript([{ chapter: null, paras: paras.slice(0, 1) }], { ...md, view: 'both', timestamps: false })).toBe(
      '**主持人:** 大家好，欢迎收看。\n\n> Hello everyone.',
    );
    expect(writeTranscript([{ chapter: null, paras }], { ...md, view: 'translation', speakers: false, timestamps: false })).toBe(
      'Hello everyone.\n\n然后我们开始。',
    );
  });

  it('plain text: speaker followed by a colon, bilingual translation right on the next line; headings written only in Markdown', () => {
    const txt = { format: 'txt', view: 'both', speakers: true, timestamps: false, title: '访谈' } as const;
    expect(writeTranscript([{ chapter: null, paras }], txt)).toBe('主持人: 大家好，欢迎收看。\nHello everyone.\n\nThen we start.\n然后我们开始。');
    expect(writeTranscript([{ chapter: null, paras: paras.slice(1) }], { ...txt, format: 'md', view: 'source' })).toBe('# 访谈\n\nThen we start.');
  });

  it('chapters: Markdown uses a level-two heading (with · mm:ss when there is a timestamp), plain text uses — name —; empty-body segments and chapters with no segments are not written', () => {
    const sections = [
      { chapter: { title: '开场', start: 0 }, paras: paras.slice(0, 1) },
      { chapter: { title: '空章', start: 30 }, paras: [{ ...paras[1]!, text: ' ' }] },
      { chapter: { title: '正题\n第一部分', start: 60 }, paras: paras.slice(1) },
    ];
    expect(writeTranscript(sections, { format: 'md', view: 'source', speakers: false, timestamps: true })).toBe(
      '## 开场 · 00:00\n\n大家好，欢迎收看。 [00:12]\n\n## 正题 第一部分 · 01:00\n\nThen we start. [01:05]',
    );
    expect(writeTranscript(sections, { format: 'txt', view: 'source', speakers: false, timestamps: false })).toBe(
      '— 开场 —\n\n大家好，欢迎收看。\n\n— 正题 第一部分 —\n\nThen we start.',
    );
  });

  it('sectioning by chapter: a segment belongs to the last chapter started by its start time; segments before the first chapter have no heading; consecutive segments in the same chapter do not repeat the heading', () => {
    const chapters = [
      { title: '一', start: 10 },
      { title: '二', start: 60 },
    ];
    const at = (start: number): CopyParagraph => ({ start, speaker: null, text: String(start), translation: '' });
    const sections = chapterSections([at(0), at(10), at(30), at(65), at(5)], chapters);
    expect(sections.map((s) => [s.chapter?.title ?? null, s.paras.map((p) => p.start)])).toEqual([
      [null, [0]],
      ['一', [10, 30]],
      ['二', [65, 5]],
    ]);
  });

  it('receipt: segment count plus word count, Chinese counted by character, Latin by word, whichever script is the majority counts', () => {
    expect(copyReceipt(paras, 'source')).toBe('2 段 · 7 字');
    expect(copyReceipt(paras.slice(1), 'source')).toBe('1 段 · 3 词');
    // Length figures in the export panel: paragraph count, Han character count and word count, counted by the Runtime, using the same terms.
    expect(lengthReceipt(2, 7, 1)).toBe('2 段 · 7 字');
    expect(lengthReceipt(1, 0, 3)).toBe('1 段 · 3 词');
    expect(copyReceipt(paras, 'translation')).toBe('2 段 · 6 字');
  });
});

describe('translation by segment', () => {
  const body = speech([
    { id: 'w1', text: '第一句。' },
    { id: 'w2', text: '第二' },
    { id: 'w3', text: '句。' },
    { id: 'w4', text: '第三句。', start: 9_000_000, end: 10_000_000 },
  ]);
  const translation = (units: Array<[string, string]>, language = 'en') => ({
    schema: 'cuccut.translation/2',
    language,
    sourceBasis: {},
    units: units.map(([sourceSentenceId, naturalText], n) => ({
      id: `u${n}`,
      sourceSentenceId,
      sourceFingerprint: 'f',
      naturalText,
      alignment: null,
      status: 'draft',
    })),
  });

  it('a sentence belongs to the segment containing its first word; sentences in a segment are joined; Latin text separated by a space, Chinese joined directly', () => {
    const paras = [{ words: [{ id: 'w1' }, { id: 'w2' }] }, { words: [{ id: 'w3' }, { id: 'w4' }] }];
    expect(
      paragraphTranslations(
        body,
        translation([
          ['s-w1', 'One.'],
          ['s-w2', 'Two.'],
          ['s-w4', 'Three.'],
        ]),
        paras,
      ),
    ).toEqual(['One. Two.', 'Three.']);
    expect(
      paragraphTranslations(
        body,
        translation(
          [
            ['s-w1', '一。'],
            ['s-w2', '二。'],
          ],
          'zh',
        ),
        paras,
      ),
    ).toEqual(['一。二。', '']);
  });

  it('split untimed segments are matched by original words; body text that cannot be recognized returns null', () => {
    expect(paragraphTranslations(body, translation([['s-w4', 'Three.']]), [{ words: [{ id: 'w4~2' }] }])).toEqual(['Three.']);
    expect(paragraphTranslations(body, { schema: 'cuccut.translation/1' }, [])).toBeNull();
  });
});
