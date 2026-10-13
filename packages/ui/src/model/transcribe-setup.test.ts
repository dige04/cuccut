import { describe, expect, it } from 'vitest';
import type { ModelCapabilitiesView, TranscriptionGlossary } from '@cuccut/protocol';
import { fixtureView, transcribeModel } from './models-test-fixtures.ts';
import {
  budgetLine,
  DEFAULT_TRANSCRIBE_SETUP,
  effectiveLanguage,
  hintBlock,
  hintBudget,
  languageChoices,
  modelFacts,
  pickModel,
  setupSummary,
  transcribeGlossaryRows,
  transcribeModelOptions,
  transcribeRequestOptions,
  type TranscribeSetup,
} from './transcribe-setup.ts';

const setup = (patch: Partial<TranscribeSetup> = {}): TranscribeSetup => ({ ...DEFAULT_TRANSCRIBE_SETUP, ...patch });

function withNode(view: ModelCapabilitiesView, available = true): ModelCapabilitiesView {
  view.transcribe.providers.push({
    providerId: 'node:studio',
    kind: 'node',
    label: '节点 studio',
    config: null,
    models: [transcribeModel('whisper-large-v3', { label: 'Whisper large v3', languages: ['zh', 'en'], acceptsHint: false })],
    available,
    ...(available ? {} : { detail: '节点没有连上' }),
  });
  return view;
}

const glossary = (terms: string[], language: string | null = null): TranscriptionGlossary => ({
  name: 'g',
  kind: 'transcription',
  language,
  defaultEnabled: false,
  terms: terms.map((canonical) => ({ canonical, misheard: [] })),
});

describe('transcription settings for generating subtitles', () => {
  it('selectable models: local, remote node, cloud; unconnected nodes are listed with the reason', () => {
    const options = transcribeModelOptions(withNode(fixtureView(), false));
    expect(options.map((o) => o.key)).toEqual([
      'local/qwen3-asr-0.6b@mlx-4bit',
      'node:studio/whisper-large-v3',
      'openai/gpt-4o-transcribe',
      'openai/whisper-1',
      'custom:asr-box/whisper-large',
      'google/gemini-2.5-flash',
    ]);
    const node = options[1]!;
    expect([node.provider, node.label, node.usable, node.why]).toEqual(['节点 studio', 'Whisper large v3', false, '节点没有连上']);
    expect(transcribeModelOptions(withNode(fixtureView()))[1]!.usable).toBe(true);
  });

  it('with settings untouched nothing is sent: model and language follow the default, the glossary is read by the Runtime from the video\'s enabled ones', () => {
    const view = fixtureView();
    const options = transcribeModelOptions(view);
    const picked = pickModel(options, null, view.transcribe.effective);
    expect(picked.explicit).toBe(false);
    expect(picked.option?.key).toBe('local/qwen3-asr-0.6b@mlx-4bit');
    expect(transcribeRequestOptions(DEFAULT_TRANSCRIBE_SETUP, picked)).toEqual({});
    // Same when there is no default: the Runtime still rejects it as “not configured” and gives a next step.
    expect(transcribeRequestOptions(DEFAULT_TRANSCRIBE_SETUP, pickModel(options, null, null))).toEqual({});
  });

  it('provider and model are sent only after a model is picked; a pick not in the list reverts to default', () => {
    const view = fixtureView();
    const options = transcribeModelOptions(view);
    const picked = pickModel(options, 'openai/whisper-1', view.transcribe.effective);
    expect(picked.explicit).toBe(true);
    expect(transcribeRequestOptions(setup({ model: 'openai/whisper-1' }), picked)).toEqual({ provider: 'openai', model: 'whisper-1' });
    const gone = pickModel(options, 'openai/retired', view.transcribe.effective);
    expect([gone.explicit, gone.option?.key]).toEqual([false, 'local/qwen3-asr-0.6b@mlx-4bit']);
  });

  it('a specified language is sent as asserted; a language this model does not recognize reverts to auto and is not sent', () => {
    const view = withNode(fixtureView());
    const options = transcribeModelOptions(view);
    const local = pickModel(options, null, view.transcribe.effective);
    expect(transcribeRequestOptions(setup({ language: 'ja' }), local)).toEqual({ language: 'ja' });
    const node = pickModel(options, 'node:studio/whisper-large-v3', view.transcribe.effective);
    expect(languageChoices(node.option).map((l) => l.key)).toEqual(['', 'zh', 'en']);
    expect(effectiveLanguage('ja', node.option)).toBe('');
    expect(transcribeRequestOptions(setup({ model: node.option!.key, language: 'ja' }), node)).toEqual({
      provider: 'node:studio',
      model: 'whisper-large-v3',
    });
  });

  it('prompt: sent only to models that accept prompts, trimmed and cut to 1200; not sent to others (the Runtime rejects it)', () => {
    const view = withNode(fixtureView());
    const options = transcribeModelOptions(view);
    const local = pickModel(options, null, view.transcribe.effective);
    expect(transcribeRequestOptions(setup({ prompt: '  主持人林澈  ' }), local)).toEqual({ hint: '主持人林澈' });
    expect(transcribeRequestOptions(setup({ prompt: '   ' }), local)).toEqual({});
    const long = transcribeRequestOptions(setup({ prompt: `${'字'.repeat(1199)}😀` }), local).hint!;
    expect(long.length).toBe(1199);
    const node = pickModel(options, 'node:studio/whisper-large-v3', view.transcribe.effective);
    expect(transcribeRequestOptions(setup({ model: node.option!.key, prompt: '林澈' }), node)).not.toHaveProperty('hint');
  });

  it('when the recognition prompt is unusable, writes the reason; when there is a model accepting prompts, names one', () => {
    const view = withNode(fixtureView());
    const options = transcribeModelOptions(view);
    const node = pickModel(options, 'node:studio/whisper-large-v3', view.transcribe.effective).option;
    expect(hintBlock(node, options)).toBe(
      'Whisper large v3 不接受识别提示：术语表和提示词在这一步都用不上，转录时会略过。想在转录时就用上，换 Qwen3-ASR 0.6B。',
    );
    expect(hintBlock(options[0]!, options)).toBeNull();
    expect(hintBlock(null)).toContain('先在上面挑一只');
  });

  it('prompt length follows the Runtime\'s assembly: deduplicated, first item joined with a line break, later ones with a 、; items that do not fit are counted', () => {
    expect(hintBudget('播客', [glossary(['林澈', '周远']), glossary(['周远', 'CucCut'])])).toEqual({ custom: 2, terms: 3, dropped: 0, chars: 15 });
    expect(hintBudget('', [glossary(['林澈', '周远'])])).toEqual({ custom: 0, terms: 2, dropped: 0, chars: 5 });
    // Limit 6: 「ab\nccc」 is exactly 6 characters, 「、dd」 does not fit.
    expect(hintBudget('ab', [glossary(['ccc', 'dd'])], 6)).toEqual({ custom: 2, terms: 1, dropped: 1, chars: 6 });
    expect(budgetLine('Whisper', { custom: 0, terms: 3, dropped: 2, chars: 40 })).toBe(
      '送给 Whisper：没有提示词 + 3 个写法 · 约 40 / 1200 字 · 还有 2 条放不下，排在前面的表先进',
    );
  });

  it('glossary rows: enabled ones first in order, then the other transcription glossaries in the library; unusable ones state the reason', () => {
    const library = [
      { id: 'g-a', name: '产品名', kind: 'transcription' as const, termCount: 3 },
      { id: 'g-b', name: '嘉宾', kind: 'transcription' as const, termCount: 2 },
      { id: 'g-t', name: '英译', kind: 'translation' as const, termCount: 9 },
    ];
    const rows = transcribeGlossaryRows(library, { 'g-b': glossary(['林澈'], 'zh'), 'g-a': undefined }, ['g-b', 'g-gone', 'g-t']);
    expect(rows.map((r) => [r.id, r.enabled, r.used, r.meta])).toEqual([
      ['g-b', true, true, '中文 · 1 条'],
      ['g-gone', true, false, '已经不在术语表库里 · 这次不用'],
      ['g-t', true, false, '是翻译术语表，转录用不上 · 这次不用'],
      ['g-a', false, false, '3 条'],
    ]);
    expect(transcribeGlossaryRows(library, { 'g-a': glossary([]) }, [])[0]!.meta).toBe('不限语言 · 0 条');
  });

  it('collapsed summary and model row', () => {
    const view = fixtureView();
    const options = transcribeModelOptions(view);
    const local = pickModel(options, null, view.transcribe.effective);
    expect(setupSummary(DEFAULT_TRANSCRIBE_SETUP, local, 0, false)).toBe('自动检测语言 · Qwen3-ASR 0.6B（默认）');
    const whisper = pickModel(options, 'openai/whisper-1', view.transcribe.effective);
    expect(setupSummary(setup({ language: 'en', prompt: '播客' }), whisper, 2, false)).toBe('英语 · whisper-1 · 2 张术语表 · 有提示词');
    expect(setupSummary(setup({ prompt: '播客' }), whisper, 2, true)).toBe('自动检测语言 · whisper-1');
    expect(setupSummary(DEFAULT_TRANSCRIBE_SETUP, pickModel(options, null, null), 0, true)).toBe('自动检测语言 · 还没有默认的语音模型');
    expect(modelFacts(local)).toBe('跟随默认 · 多种语言 · 收识别提示');
    expect(modelFacts(whisper)).toBe('多种语言 · 收识别提示');
    expect(modelFacts(pickModel(options, 'google/gemini-2.5-flash', null))).toBe(options.find((o) => o.providerId === 'google')!.why);
  });
});
