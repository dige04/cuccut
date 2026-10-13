import { describe, expect, it } from 'vitest';
import { MAX_SELECTED_GLOSSARIES, type DocumentRecord, type TranslationGlossary } from '@cuccut/protocol';
import {
  defaultTarget,
  existingTranslations,
  glossaryFits,
  glossaryHits,
  glossaryRows,
  sameLanguage,
  targetOptions,
  toggleGlossary,
  translateParams,
} from './translate-setup.ts';

const doc = (id: string, kind: string, extra: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id,
  kind,
  name: id,
  currentRevision: '1',
  revisions: {},
  ...extra,
});

describe('target language', () => {
  it('same language is judged by its primary language, Chinese is further split into simplified and traditional', () => {
    expect(sameLanguage('en-US', 'en')).toBe(true);
    expect(sameLanguage('zh', 'zh-Hans')).toBe(true);
    expect(sameLanguage('zh-CN', 'zh-Hant')).toBe(false);
    expect(sameLanguage('zh-TW', 'zh-Hant')).toBe(true);
    expect(sameLanguage('ja', 'ko')).toBe(false);
  });

  it('the source language, and any language this transcription already has a translation for, cannot be chosen; by default Chinese translates to English, others to Simplified Chinese', () => {
    const documents = {
      speech: doc('speech', 'speech', { language: 'zh' }),
      en: doc('en', 'translation', { sourceDocumentId: 'speech', language: 'en' }),
      other: doc('other', 'translation', { sourceDocumentId: 'elsewhere', language: 'ja' }),
    };
    const existing = existingTranslations(documents, 'speech');
    expect(existing.map((d) => d.id)).toEqual(['en']);
    const options = targetOptions('zh', existing);
    const of = (tag: string) => options.find((o) => o.tag === tag)!;
    expect(of('zh-Hans').disabled).toBe('和原文同一种语言');
    expect(of('zh-Hant').disabled).toBeNull();
    expect(of('en').disabled).toBe('已经有这门语言的译文');
    expect(of('ja')).toMatchObject({ label: '日本語', description: '日语', disabled: null });
    // English already exists: fall back to the first language that can be chosen.
    expect(defaultTarget(options, 'zh')).toBe('zh-Hant');
    expect(defaultTarget(targetOptions('en', []), 'en')).toBe('zh-Hans');
    expect(defaultTarget(targetOptions(null, []), null)).toBe('zh-Hans');
  });
});

describe('glossary', () => {
  it('direction: target matches, source is unrestricted or matches; follows the Runtime prefix rule (zh-CN does not match zh-Hans)', () => {
    expect(glossaryFits({ sourceLanguage: null, targetLanguage: 'en' }, 'zh', 'en')).toBe(true);
    expect(glossaryFits({ sourceLanguage: 'zh', targetLanguage: 'en-US' }, 'zh-CN', 'en')).toBe(true);
    expect(glossaryFits({ sourceLanguage: 'ja', targetLanguage: 'en' }, 'zh', 'en')).toBe(false);
    expect(glossaryFits({ sourceLanguage: 'zh', targetLanguage: 'ja' }, 'zh', 'en')).toBe(false);
    expect(glossaryFits({ sourceLanguage: 'zh', targetLanguage: 'en' }, null, 'en')).toBe(true);
    expect(glossaryFits({ sourceLanguage: null, targetLanguage: 'zh-CN' }, 'en', 'zh-Hans')).toBe(false);
    expect(glossaryFits({ sourceLanguage: null, targetLanguage: 'zh' }, 'en', 'zh-Hant')).toBe(true);
  });

  it('entries hit in this piece (case-insensitive), the first entry wins for the same source term', () => {
    const terms = [
      { source: '宝玉', target: 'Baoyu', note: '人名' },
      { source: 'cuccut', target: 'CucCut', note: null },
      { source: '宝玉', target: 'Bao Yu', note: null },
      { source: '没出现', target: 'absent', note: null },
      { source: ' ', target: 'blank', note: null },
    ];
    expect(glossaryHits(terms, '今天宝玉用 CucCut 剪视频')).toEqual([
      { source: '宝玉', target: 'Baoyu', note: '人名' },
      { source: 'cuccut', target: 'CucCut' },
    ]);
  });
});

const glossary = (targetLanguage: string, sources: string[], sourceLanguage: string | null = null): TranslationGlossary => ({
  name: 'x',
  kind: 'translation',
  sourceLanguage,
  targetLanguage,
  defaultEnabled: false,
  terms: sources.map((source) => ({ source, target: source.toUpperCase(), note: null })),
});

describe('glossaries enabled for the video', () => {
  const candidates = [
    { id: 'product', name: '产品名', content: glossary('en', ['宝玉', 'cuccut', '没出现']) },
    { id: 'people', name: '人名', content: glossary('en-US', ['小明']) },
    { id: 'japanese', name: '日语', content: glossary('ja', ['宝玉']) },
    { id: 'loading', name: '还在读', content: undefined },
    { id: 'broken', name: '读不出', content: null },
  ];
  const text = '今天宝玉用 CucCut 剪视频';

  it('lists direction-matching ones (enabled ones first, in order), also lists enabled ones that cannot be used and gives the reason; disabled ones with a mismatched direction are not listed', () => {
    const rows = glossaryRows(candidates, ['japanese', 'product', 'gone', 'broken'], 'zh', 'en', text);
    expect(rows.map((r) => [r.id, r.enabled, r.used])).toEqual([
      ['japanese', true, false],
      ['product', true, true],
      ['gone', true, false],
      ['broken', true, false],
      ['people', false, false],
      ['loading', false, false],
    ]);
    expect(rows[0]!.note).toBe('方向是任意语言 → 日语 · 这次不用');
    expect(rows[1]).toMatchObject({ terms: 3, hits: 2, note: null });
    expect(rows[2]).toMatchObject({ name: 'gone', note: '已经不在术语表库里 · 这次不用' });
    expect(rows[3]!.note).toBe('没读出来 · 这次不用');
    expect(rows[4]).toMatchObject({ terms: 1, hits: 0, note: null });
    expect(rows[5]!.note).toBe('正在读取…');
  });

  it('checking moves it to the end, unchecking removes it; null when duplicate, unchanged, or over the limit', () => {
    expect(toggleGlossary(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleGlossary(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(toggleGlossary(['a'], 'a', true)).toBeNull();
    expect(toggleGlossary(['a'], 'b', false)).toBeNull();
    const full = Array.from({ length: MAX_SELECTED_GLOSSARIES }, (_, i) => `g${i}`);
    expect(toggleGlossary(full, 'more', true)).toBeNull();
  });
});

describe('pipelines.start arguments', () => {
  it('only passes keys the pipeline recognizes; empty style and default model are not passed; glossary is not passed (Runtime uses the video\'s enabled ones)', () => {
    expect(
      translateParams({ videoId: 'v', speechDocumentId: 'speech', targetLanguage: 'en', style: '  ', model: null }),
    ).toEqual({ videoId: 'v', documentId: 'speech', targetLanguage: 'en' });
    const full = translateParams({
      videoId: 'v',
      speechDocumentId: 'speech',
      targetLanguage: 'ja',
      style: ' 口语、简洁 ',
      model: { providerId: 'openai', modelId: 'gpt-5' },
    });
    expect(full).toEqual({
      videoId: 'v',
      documentId: 'speech',
      targetLanguage: 'ja',
      style: '口语、简洁',
      provider: 'openai',
      model: 'gpt-5',
    });
  });
});
