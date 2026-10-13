import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, type Locale } from '@cuccut/protocol';
import {
  contextItems,
  contextLine,
  directBlocked,
  directCta,
  directHasScope,
  directHint,
  directParams,
  directRefresh,
  directTool,
  needsStructuredOutput,
  pickTranslation,
  refreshableTranslations,
  refreshCounts,
  scopedParagraphs,
} from './ai-tool-direct.ts';
import type { DocumentRecord } from '@cuccut/protocol';
import type { PairRow } from '../../model/translation-doc.ts';

const initial = getLocale();
// The test process pins `CUCCUT_LOCALE` to Chinese: changing the language means changing it too.
const use = (locale: Locale) => {
  vi.stubEnv('CUCCUT_LOCALE', locale);
  setLocale(locale);
};
beforeEach(() => use('en'));
afterEach(() => {
  vi.unstubAllEnvs();
  setLocale(initial);
});

const para = (...spans: [number, number][]) => ({ words: spans.map(([start, end]) => ({ placements: [{ start, end }] })) });

describe('direct model calls: which tools can work', () => {
  it('polish, chapters and writing-publish tools can call the model directly; re-transcription, finding cuttable spots and cover are greyed out, each with its reason', () => {
    for (const tool of ['polish', 'chapters', 'summary', 'blog', 'title', 'desc'] as const) {
      expect(directTool(tool)).toBe(tool);
      expect(directRefresh(tool)).toBe(false);
      expect(directBlocked(tool)).toBeNull();
    }
    const reasons = (['retranscribe', 'cleanup', 'cover'] as const).map((tool) => {
      expect(directTool(tool)).toBeNull();
      expect(directRefresh(tool)).toBe(false);
      return directBlocked(tool);
    });
    expect(new Set(reasons).size).toBe(3);
    expect(reasons.every((r) => r && r.length > 0)).toBe(true);
    expect(reasons[2]).toMatch(/images/);
  });

  it('refreshing stale translations can also call the model directly: not via ai-tool, but via translate\'s in-place refresh', () => {
    expect(directTool('stale')).toBeNull();
    expect(directRefresh('stale')).toBe(true);
    expect(directBlocked('stale')).toBeNull();
  });

  it('polish and chapters require structured output; chapters always cover the whole piece', () => {
    expect(needsStructuredOutput('polish')).toBe(true);
    expect(needsStructuredOutput('chapters')).toBe(true);
    expect(needsStructuredOutput('summary')).toBe(false);
    expect(directHasScope('chapters')).toBe(false);
    expect(directHasScope('polish')).toBe(true);
  });

  it('primary button runs this tool\'s own action', () => {
    expect(directCta('polish')).toBe('Polish');
    expect(directCta('title')).toBe('Suggest titles');
    use('zh-Hans');
    expect(directCta('summary')).toBe('写总结');
  });
});

describe('the line sent to the model', () => {
  it('with nothing attached, only the prompt', () => {
    expect(contextLine(contextItems({ tool: 'summary', paragraphs: 0, scope: null, chapters: 3, attachments: 0, skills: [] }))).toBe(
      'Sent to the model: only the prompt above',
    );
  });

  it('script, chapters, attachments, skill written in order; polish doesn\'t include chapters', () => {
    const c = { paragraphs: 12, scope: null, chapters: 3, attachments: 2, skills: ['Summary', 'House style'] };
    expect(contextLine(contextItems({ tool: 'summary', ...c }))).toBe(
      'Sent to the model: prompt + transcript 12 paragraphs · chapters 3 · attachments 2 · Skill Summary, House style',
    );
    expect(contextItems({ tool: 'polish', ...c })).toEqual(['transcript 12 paragraphs', 'attachments 2', 'Skill Summary, House style']);
  });

  it('when a chapter is selected its title is written; singular; Chinese', () => {
    expect(contextItems({ tool: 'blog', paragraphs: 1, scope: 'Chapter 2 · Intro', chapters: 0, attachments: 0, skills: [] })).toEqual([
      'transcript · Chapter 2 · Intro 1 paragraph',
    ]);
    use('zh-Hans');
    expect(contextLine(contextItems({ tool: 'summary', paragraphs: 5, scope: null, chapters: 2, attachments: 0, skills: [] }))).toBe(
      '发给模型的：提示词 + 文稿 5 段 · 章节 2 章',
    );
  });

  it('skill names use each language\'s own list style: Chinese and Japanese use 、, not the 和 of a sentence', () => {
    const c = { tool: 'summary' as const, paragraphs: 0, scope: null, chapters: 0, attachments: 0, skills: ['总结', '我的风格', '三点'] };
    use('zh-Hans');
    expect(contextItems(c)).toEqual(['Skill 总结、我的风格、三点']);
    use('ja');
    expect(contextItems(c)).toEqual(['Skill 总结、我的风格、三点']);
    use('de');
    expect(contextItems(c)).toEqual(['Skill 总结, 我的风格, 三点']);
  });
});

describe('line under the primary button', () => {
  it('tools that write into the video: applied on completion, one-click undo; cloud billed by usage', () => {
    expect(directHint({ tool: 'polish', model: 'gpt-5-mini', local: false })).toBe(
      'Calls gpt-5-mini directly, no conversation; applies when done, one-step undo. Cloud models bill by usage.',
    );
  });

  it('result-only tools: for you to read or copy, not written into the video; local models don\'t leave the machine', () => {
    expect(directHint({ tool: 'summary', model: 'Qwen3 4B', local: true })).toBe(
      'Calls Qwen3 4B directly, no conversation; the result is for you to read and copy, nothing is written to the video. Local model, stays on this computer.',
    );
    expect(directHint({ tool: 'desc', model: null, local: false })).toMatch(/^Calls a model directly/);
    use('zh-Hans');
    expect(directHint({ tool: 'chapters', model: 'gpt-5-mini', local: false })).toBe(
      '直接调 gpt-5-mini，不经过对话；完成即应用，可一键撤销。云端模型按用量计费。',
    );
  });
});

describe('segment count and workflow parameters within range', () => {
  it('a segment counts if a word falls within the range; segments cut entirely don\'t count', () => {
    const paragraphs = [para([0, 1], [1, 2]), para([5, 6]), { words: [{ placements: [] }] }, para([9, 10])];
    expect(scopedParagraphs(paragraphs, null)).toBe(3);
    expect(scopedParagraphs(paragraphs, { start: 1.5, end: 9 })).toBe(2);
    expect(scopedParagraphs(paragraphs, { start: 20, end: 30 })).toBe(0);
  });

  it('only items provided; chapters have no range', () => {
    expect(
      directParams({
        videoId: 'vid',
        tool: 'summary',
        prompt: 'Summarize',
        range: { start: 10, end: 20 },
        documentId: 'speech',
        attachments: ['att_1'],
        skills: ['summarize', 'house-style'],
        model: { providerId: 'openai', modelId: 'gpt-5-mini' },
        uiLanguage: 'zh-Hans',
      }),
    ).toEqual({
      videoId: 'vid',
      tool: 'summary',
      prompt: 'Summarize',
      range: { start: 10, end: 20 },
      documentId: 'speech',
      attachments: ['att_1'],
      skills: [{ id: 'summarize' }, { id: 'house-style' }],
      provider: 'openai',
      model: 'gpt-5-mini',
      uiLanguage: 'zh-Hans',
    });
    expect(
      directParams({ videoId: 'vid', tool: 'chapters', prompt: 'x', range: { start: 1, end: 2 }, documentId: null, attachments: [], skills: [], model: null, uiLanguage: 'en' }),
    ).toEqual({ videoId: 'vid', tool: 'chapters', prompt: 'x', uiLanguage: 'en' });
  });
});

describe('refresh stale translations: direct model call', () => {
  const doc = (id: string, kind: string, extra: Partial<DocumentRecord> = {}): DocumentRecord => ({
    id,
    kind,
    name: id,
    currentRevision: '1',
    revisions: {},
    ...extra,
  });
  const documents = {
    speech: doc('speech', 'speech', { sourceAssetId: 'asset' }),
    en: doc('en', 'translation', { language: 'en', sourceDocumentId: 'speech' }),
    ja: doc('ja', 'translation', { language: 'ja', sourceDocumentId: 'speech' }),
    stray: doc('stray', 'translation', { language: 'fr' }),
    cap: doc('cap', 'caption', { sourceDocumentId: 'en' }),
  };

  it('lists only translations derived from transcription', () => {
    expect(refreshableTranslations(documents).map((d) => d.id)).toEqual(['en', 'ja']);
  });

  it('which one to refresh: the selected one, the ID the entry point provides, the language name the entry point provides (`languageName`, self-named in each language), the first one', () => {
    const list = refreshableTranslations(documents);
    expect(pickTranslation(list, { picked: null })?.id).toBe('en');
    expect(pickTranslation(list, { picked: null, presetLanguage: '日本語' })?.id).toBe('ja');
    expect(pickTranslation(list, { picked: null, presetId: 'ja', presetLanguage: 'English' })?.id).toBe('ja');
    expect(pickTranslation(list, { picked: 'en', presetId: 'ja' })?.id).toBe('en');
    // The chosen one is gone: fall back to the one the entry point brought.
    expect(pickTranslation(list, { picked: 'gone', presetId: 'ja' })?.id).toBe('ja');
    expect(pickTranslation([], { picked: null, presetId: 'ja' })).toBeNull();
  });

  it('sentences to retranslate: stale (marked, source edited) plus those with no translation yet; source sentences removed don\'t count', () => {
    const row = (state: PairRow['state']) => ({ state }) as PairRow;
    const rows = ['ok', 'marked-stale', 'source-changed', 'untranslated', 'empty', 'sentence-gone', 'ok'].map((s) => row(s as PairRow['state']));
    expect(refreshCounts(rows)).toEqual({ todo: 4, stale: 2, untranslated: 2 });
    expect(refreshCounts([row('ok' as PairRow['state'])])).toEqual({ todo: 0, stale: 0, untranslated: 0 });
  });
});
