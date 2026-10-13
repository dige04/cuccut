import { describe, expect, it } from 'vitest';
import type { TranslationGlossary } from '@cuccut/protocol';
import {
  addTranscriptionTerms,
  addTranslationTerms,
  addedText,
  canonicalLanguage,
  exportFileName,
  glossaryNameProblem,
  languageOptions,
  newTranslationGlossary,
  normKey,
  pairLabel,
  parseTranscriptionLines,
  parseTranslationLines,
  reverseTranslation,
  sameLanguage,
  searchTerms,
  splitMisheard,
  tidyTranscriptionTerm,
  tidyTranslationTerm,
  transcriptionTermProblems,
  translationTermProblems,
} from './library-glossary.ts';

describe('merge key and misspellings', () => {
  it('case, whitespace and ASCII punctuation are not treated as differences', () => {
    expect(normKey('KV cache')).toBe(normKey('kv-cache'));
    expect(normKey(' KV Cache ')).toBe('kvcache');
    expect(normKey('……')).toBe('……');
    expect(normKey('--')).toBe('');
  });

  it('misspellings split on commas, enumeration commas and semicolons, then deduplicated', () => {
    expect(splitMisheard('开维缓存、KV 换成, 开维缓存；凯威')).toEqual(['开维缓存', 'KV 换成', '凯威']);
    expect(splitMisheard('  ')).toEqual([]);
  });
});

describe('language', () => {
  it('canonical BCP 47 form; null when invalid', () => {
    expect(canonicalLanguage('zh-hans')).toBe('zh-Hans');
    expect(canonicalLanguage('not a tag')).toBeNull();
    expect(canonicalLanguage('')).toBeNull();
  });

  it('dropdown adds a language from the current value that is not in the standard list', () => {
    const options = languageOptions(['zh', 'nl', null]);
    expect(options.filter((tag) => tag === 'zh')).toHaveLength(1);
    expect(options.at(-1)).toBe('nl');
  });

  it('the same language is compared by primary language subtag', () => {
    expect(sameLanguage('zh-Hans', 'zh')).toBe(true);
    expect(sameLanguage('en', 'zh')).toBe(false);
    expect(sameLanguage(null, 'zh')).toBe(false);
  });

  it('direction label: unrestricted source language is written as "任意语言"', () => {
    const table = newTranslationGlossary(null, 'en');
    expect(table.name).toBe('任意语言 → English');
    expect(pairLabel({ ...table, sourceLanguage: 'zh' })).toBe('中文 → English');
    expect(pairLabel({ name: 'x', kind: 'transcription', language: null, defaultEnabled: true, terms: [] })).toBe('任意语言');
  });
});

describe('validation', () => {
  it('transcription terms: canonical form required, the same word cannot appear twice, a misspelling cannot equal the canonical form', () => {
    expect(transcriptionTermProblems({ canonical: ' ', misheard: [] }, [])).toEqual(['规范写法不能为空']);
    expect(transcriptionTermProblems({ canonical: 'KV cache', misheard: [] }, [{ canonical: 'kv-cache', misheard: [] }])).toEqual([
      '表里已经有「kv-cache」',
    ]);
    expect(transcriptionTermProblems({ canonical: 'LoRA', misheard: ['lora'] }, [])).toEqual(['常听错成的写法不能和规范写法相同']);
    expect(transcriptionTermProblems({ canonical: 'a'.repeat(201), misheard: [] }, [])).toEqual(['规范写法不能超过 200 个字']);
    expect(transcriptionTermProblems({ canonical: 'LoRA', misheard: Array.from({ length: 51 }, (_, i) => `x${i}`) }, [])).toEqual([
      '常听错成的写法最多 50 个',
    ]);
  });

  it('translation terms: source and target both required, notes have a length limit', () => {
    expect(translationTermProblems({ source: 'commit', target: '', note: null }, [])).toEqual(['译文不能为空']);
    expect(translationTermProblems({ source: 'Commit', target: '提交', note: null }, [{ source: 'commit', target: 'x', note: null }])).toEqual([
      '表里已经有「commit」',
    ]);
    expect(translationTermProblems({ source: 'a', target: 'b', note: 'n'.repeat(1001) }, [])).toEqual(['备注不能超过 1000 个字']);
  });

  it('sheet name', () => {
    expect(glossaryNameProblem('  ')).toBe('表名不能为空');
    expect(glossaryNameProblem('产品术语')).toBeNull();
  });

  it('tidy before saving: deduplicate misspellings, remove those equal to the canonical form; empty notes are written as null', () => {
    expect(tidyTranscriptionTerm({ canonical: ' LoRA ', misheard: ['罗拉', ' 罗拉', 'LoRA', ''] })).toEqual({ canonical: 'LoRA', misheard: ['罗拉'] });
    expect(tidyTranslationTerm({ source: ' a ', target: ' b ', note: '  ' })).toEqual({ source: 'a', target: 'b', note: null });
  });
});

describe('paste a batch at once', () => {
  it('transcription sheet: one entry per row, misspellings optional; repeated words in the same batch merge into one', () => {
    const { terms, skipped } = parseTranscriptionLines('KV cache = 开维缓存、KV 换成\nLoRA → 罗拉\n推理框架\nkv-cache = 凯威\n---\n');
    expect(terms).toEqual([
      { canonical: 'KV cache', misheard: ['开维缓存', 'KV 换成', '凯威'] },
      { canonical: 'LoRA', misheard: ['罗拉'] },
      { canonical: '推理框架', misheard: [] },
    ]);
    expect(skipped).toEqual([{ line: 'kv-cache = 凯威', why: '和前面的行是同一个词，已合并' }]);
  });

  it('translation sheet: third column is the note; rows without a translation are returned', () => {
    const { terms, skipped } = parseTranslationLines('commit = 突破确认\nspring = 弹簧效应 = 不要译成「泉水」\nWyckoff\nsign,标志');
    expect(terms).toEqual([
      { source: 'commit', target: '突破确认', note: null },
      { source: 'spring', target: '弹簧效应', note: '不要译成「泉水」' },
      { source: 'sign', target: '标志', note: null },
    ]);
    expect(skipped).toEqual([{ line: 'Wyckoff', why: '没有译文' }]);
  });

  it('Markdown tables map columns by header; front matter and separator rows are skipped (an exported file can be pasted back directly)', () => {
    const markdown = [
      '---',
      'format: cuccut.glossary',
      'name: "产品术语"',
      '---',
      '',
      '| Source | Target | Note |',
      '| --- | --- | --- |',
      '| a\\|b | 甲 | |',
      '| commit | 提交 | 版本库里 |',
    ].join('\n');
    expect(parseTranslationLines(markdown).terms).toEqual([
      { source: 'a|b', target: '甲', note: null },
      { source: 'commit', target: '提交', note: '版本库里' },
    ]);
    const asr = parseTranscriptionLines('| Term | Misheard |\n| --- | --- |\n| CucCut | 宝卡特, 包cut |');
    expect(asr.terms).toEqual([{ canonical: 'CucCut', misheard: ['宝卡特', '包cut'] }]);
  });
});

describe('add terms', () => {
  it('transcription sheet: existing words only merge in new misspellings', () => {
    const result = addTranscriptionTerms(
      [{ canonical: 'LoRA', misheard: ['罗拉'] }],
      [
        { canonical: 'lora', misheard: ['洛拉'] },
        { canonical: 'KV cache', misheard: [] },
      ],
    );
    expect(result.terms).toEqual([
      { canonical: 'LoRA', misheard: ['罗拉', '洛拉'] },
      { canonical: 'KV cache', misheard: [] },
    ]);
    expect([result.added, result.merged, result.overflow]).toEqual([1, 1, 0]);
    expect(addedText(result)).toBe('已加 1 条 · 1 条表里已经有了');
  });

  it('translation sheet: existing words keep their original translation', () => {
    const result = addTranslationTerms([{ source: 'commit', target: '提交', note: null }], [{ source: 'Commit', target: '突破确认', note: null }]);
    expect(result.terms).toEqual([{ source: 'commit', target: '提交', note: null }]);
    expect(addedText(result)).toBe('这几条表里已经有了');
  });
});

describe('search and reverse', () => {
  const table: TranslationGlossary = {
    name: 'English → 中文',
    kind: 'translation',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    defaultEnabled: true,
    terms: [
      { source: 'commit', target: '突破确认', note: '这一派里不是「提交」' },
      { source: 'spring', target: '弹簧效应', note: null },
      { source: 'Spring', target: '弹簧效应', note: null },
    ],
  };

  it('searches source, target and notes', () => {
    expect(searchTerms(table, '提交')).toEqual([0]);
    expect(searchTerms(table, 'SPR')).toEqual([1, 2]);
    expect(searchTerms(table, ' ')).toEqual([0, 1, 2]);
  });

  it('flipping generates the reverse sheet, keeping only the first of entries with the same translation; cannot generate when the source language is unrestricted', () => {
    const reversed = reverseTranslation(table)!;
    expect(reversed.sourceLanguage).toBe('zh');
    expect(reversed.targetLanguage).toBe('en');
    expect(reversed.defaultEnabled).toBe(false);
    expect(reversed.terms.map((t) => [t.source, t.target])).toEqual([
      ['突破确认', 'commit'],
      ['弹簧效应', 'spring'],
    ]);
    expect(reverseTranslation({ ...table, sourceLanguage: null })).toBeNull();
  });

  it('exported file name', () => {
    expect(exportFileName('产品/术语')).toBe('产品 术语.md');
    expect(exportFileName('  ')).toBe('术语表.md');
  });
});
