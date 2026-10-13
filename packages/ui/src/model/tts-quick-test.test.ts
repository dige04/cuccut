import { describe, expect, it } from 'vitest';
import type { JobRecord } from '@cuccut/protocol';
import { bundle } from './models-test-fixtures.ts';
import {
  auditionBundle,
  chooseFile,
  chooseLang,
  chooseSample,
  chooseVoice,
  moreVoices,
  quickDefaults,
  quickForm,
  quickPhase,
  quickSummary,
  quickTones,
  quickVoices,
  sampleKinds,
  sampleLangs,
  sampleLine,
  SAMPLE_LINES,
  type QuickPick,
} from './tts-quick-test.ts';
import { GPT_SOVITS, INDEX_TTS2, OMNIVOICE, QWEN_BASE, QWEN_CUSTOM, QWEN_DESIGN, VOXCPM2 } from './tts-test-fixtures.ts';

const mine = [{ id: 'v1', name: '我自己' }];
const exclusive = (r: object) => ['voice', 'reference', 'voiceDescription'].filter((k) => k in r).length;

describe('sample lines and languages', () => {
  it('eleven languages, three lines each', () => {
    const codes = [...new Set(SAMPLE_LINES.map((l) => l.code))];
    expect(codes).toEqual(['zh', 'en', 'ja', 'ko', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ar']);
    for (const code of codes) expect(sampleKinds(code).map((k) => k.k)).toEqual(['intro', 'numbers', 'mood']);
  });

  it('language chips come from the languages the model declares: all when unrestricted; with a list, those that have examples, in example table order; languages without examples are not given', () => {
    expect(sampleLangs(INDEX_TTS2)).toHaveLength(11);
    expect(sampleLangs(GPT_SOVITS).map((l) => l.code)).toEqual(['zh', 'en']);
    expect(sampleLangs({ languages: ['es', 'ar', 'sw', 'ja'] }).map((l) => l.code)).toEqual(['ja', 'es', 'ar']);
    expect(sampleLangs({ languages: ['sw'] })).toEqual([]);
    expect(sampleLangs({ languages: ['zh-CN'] }).map((l) => l.code)).toEqual(['zh']);
  });

  it('when this kind of line is missing, falls back to the language\'s first line, then to the header', () => {
    expect(sampleLine('en', 'mood').text).toMatch(/^Fast/);
    expect(sampleLine('xx', 'mood')).toBe(SAMPLE_LINES[0]);
  });
});

describe('quick voices', () => {
  it('preset model: four speakers (labels describe how they sound), the other five are under \'More voices\'', () => {
    expect(quickVoices(QWEN_CUSTOM, mine).map((v) => [v.key, v.label])).toEqual([
      ['Vivian', '女声 · 明亮'],
      ['Serena', '女声 · 沉稳'],
      ['Eric', '男声 · 播音'],
      ['Uncle_Fu', '男声 · 低沉'],
    ]);
    expect(moreVoices(QWEN_CUSTOM).map((v) => v.key)).toEqual(['Dylan', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee']);
  });

  it('clone model: default voice, my voice, the four built-in quick voices, one-off clip; the other four are under \'More voices\'', () => {
    expect(quickVoices(QWEN_BASE, mine).map((v) => v.key)).toEqual([
      'default',
      'my:v1',
      'zh-female',
      'zh-male',
      'en-female',
      'en-male',
      'file',
    ]);
    expect(moreVoices(QWEN_BASE).map((v) => v.label)).toEqual(['日语女声', '日语男声', '西班牙语女声', '西班牙语男声']);
  });

  it('description model: built-in voices, three ready-made descriptions and a custom description', () => {
    expect(quickVoices(QWEN_DESIGN, mine).map((v) => v.key)).toEqual([
      'zh-female',
      'zh-male',
      'en-female',
      'en-male',
      'warm',
      'anchor',
      'bright',
      'describe',
    ]);
  });

  it('tone is only offered for preset speakers on models that accept style instructions (the emotion tier is not supported in this version)', () => {
    expect(quickTones(QWEN_CUSTOM).map((t) => t.k)).toEqual(['upbeat', 'natural', 'anchor', 'soft']);
    expect(quickTones(VOXCPM2)).toEqual([]);
    expect(quickTones(INDEX_TTS2)).toEqual([]);
  });
});

describe('quickForm', () => {
  it('initial values: first sample language + introduction; preset model Vivian + enthusiastic; clone model uses a female voice in this language', () => {
    expect(quickForm(QWEN_CUSTOM, quickDefaults(QWEN_CUSTOM), mine).request).toEqual({
      text: sampleLine('zh', 'intro').text,
      provider: 'local',
      model: QWEN_CUSTOM.modelId,
      language: 'zh',
      instructions: '用热情洋溢、充满活力的语气，语速略快',
      voice: 'Vivian',
    });
    expect(quickForm(QWEN_BASE, quickDefaults(QWEN_BASE), mine).request).toMatchObject({ voice: 'zh-female', language: 'zh' });
  });

  it('changing language: if no voice was picked, built-in voices follow the language and the line kind stays; if one was picked, nothing changes', () => {
    let pick = quickDefaults(INDEX_TTS2);
    pick = { ...pick, kind: 'numbers' };
    let next = chooseLang(INDEX_TTS2, pick, 'ja');
    expect(next).toMatchObject({ lang: 'ja', kind: 'numbers', voice: 'ja-female' });
    // No built-in voice for this language: fall back to the first one
    expect(chooseLang(INDEX_TTS2, pick, 'ko').voice).toBe('zh-female');
    next = chooseLang(INDEX_TTS2, chooseVoice(pick, 'en-male'), 'ja');
    expect(next.voice).toBe('en-male');
  });

  it('natural tone has no instructions; a self-written line has no language', () => {
    const pick: QuickPick = { ...quickDefaults(QWEN_CUSTOM), tone: 'natural', editing: true, draft: 'Bonjour à tous' };
    const request = quickForm(QWEN_CUSTOM, pick, mine).request!;
    expect(request).toEqual({ text: 'Bonjour à tous', provider: 'local', model: QWEN_CUSTOM.modelId, voice: 'Vivian' });
  });

  it('default voice does not pass voice (Runtime picks by language); my voice passes library:<id>', () => {
    const pick = quickDefaults(QWEN_BASE);
    expect(quickForm(QWEN_BASE, chooseVoice(pick, 'default'), mine).request).not.toHaveProperty('voice');
    expect(quickForm(QWEN_BASE, chooseVoice(pick, 'my:v1'), mine).request).toMatchObject({ voice: 'library:v1' });
    expect(quickForm(QWEN_BASE, chooseVoice(pick, 'my:gone'), mine)).toMatchObject({
      request: null,
      problem: expect.stringContaining('我的声音'),
    });
  });

  it('one-off clip: says clearly when no recording is chosen; when chosen, passes reference (the model includes the source text when reading); sample recording uses a built-in voice', () => {
    const pick = chooseVoice(quickDefaults(GPT_SOVITS), 'file');
    expect(quickForm(GPT_SOVITS, pick, mine)).toMatchObject({ request: null, problem: '先选一段参考录音，或换回内置音色' });
    const withFile = { ...chooseFile(pick, '/Users/me/rec/我的录音.wav'), transcript: ' 你好 ' };
    expect(withFile.file).toEqual({ path: '/Users/me/rec/我的录音.wav', name: '我的录音.wav' });
    expect(quickForm(GPT_SOVITS, withFile, mine).request).toMatchObject({
      reference: { file: '/Users/me/rec/我的录音.wav', transcript: '你好' },
    });
    // IndexTTS does not read the source text: it is not sent even if written
    expect(quickForm(INDEX_TTS2, { ...withFile }, mine).request!.reference).toEqual({ file: '/Users/me/rec/我的录音.wav' });
    const sample = chooseSample(GPT_SOVITS, { ...pick, lang: 'en' });
    expect(quickForm(GPT_SOVITS, sample, mine).request).toMatchObject({ voice: 'en-female' });
  });

  it('description model: ready-made and custom descriptions go through voiceDescription, built-in voices go through voice; custom description cannot be empty', () => {
    const pick = quickDefaults(QWEN_DESIGN);
    expect(quickForm(QWEN_DESIGN, pick, mine).request).toMatchObject({ voice: 'zh-female' });
    expect(quickForm(QWEN_DESIGN, chooseVoice(pick, 'warm'), mine).request).toMatchObject({
      voiceDescription: '温暖、亲切的成年女声，语速适中，像在和朋友聊天',
    });
    expect(quickForm(QWEN_DESIGN, chooseVoice(pick, 'describe'), mine).problem).toBe('先用一句话描述想要的声音');
    expect(quickForm(QWEN_DESIGN, { ...chooseVoice(pick, 'describe'), describe: '低沉的老年男声' }, mine).request).toMatchObject({
      voiceDescription: '低沉的老年男声',
    });
  });

  it('at most one of voice, reference and voiceDescription', () => {
    const picks: [typeof QWEN_BASE, QuickPick][] = [
      [QWEN_CUSTOM, quickDefaults(QWEN_CUSTOM)],
      [QWEN_DESIGN, chooseVoice(quickDefaults(QWEN_DESIGN), 'anchor')],
      [OMNIVOICE, chooseFile(quickDefaults(OMNIVOICE), '/a.wav')],
      [OMNIVOICE, chooseVoice(quickDefaults(OMNIVOICE), 'my:v1')],
      [VOXCPM2, chooseVoice(quickDefaults(VOXCPM2), 'default')],
    ];
    for (const [model, pick] of picks) expect(exclusive(quickForm(model, pick, mine).request!)).toBeLessThanOrEqual(1);
  });

  it('empty and overlong text are explained; identity changes with the selection', () => {
    const pick = quickDefaults(QWEN_BASE);
    expect(quickForm(QWEN_BASE, { ...pick, editing: true, draft: '  ' }, mine).problem).toBe('先输入要合成的文本');
    expect(quickForm({ ...QWEN_BASE, maxInputChars: 5 }, { ...pick, editing: true, draft: '一二三四五六' }, mine).problem).toContain(
      '最多 5 字',
    );
    expect(quickForm(QWEN_BASE, pick, mine).key).not.toBe(quickForm(QWEN_BASE, chooseLang(QWEN_BASE, pick, 'en'), mine).key);
    expect(quickForm(QWEN_BASE, pick, mine).key).toBe(quickForm(QWEN_BASE, { ...pick, draft: '写了没开' }, mine).key);
  });
});

describe('progress and result', () => {
  const job = (patch: Partial<JobRecord>) => ({ phase: 'queued', progress: null, ...patch }) as JobRecord;

  it('task stage → one sentence; a percentage when synthesis reports steps', () => {
    expect(quickPhase(undefined)).toEqual({ label: '提交中', percent: null });
    expect(quickPhase(job({ phase: 'loading' })).label).toBe('加载模型');
    expect(quickPhase(job({ phase: 'generating', progress: { done: 1, total: 4, unit: 'steps' } }))).toEqual({
      label: '生成音频 · 第 2/4 步',
      percent: 25,
    });
    expect(quickPhase(job({ phase: 'generating' }))).toEqual({ label: '生成音频', percent: null });
    expect(quickPhase(job({ phase: 'publishing' })).label).toBe('写出音频');
  });

  it('result line: voice · tone · language[· line] · elapsed time · audio duration', () => {
    const pick = quickDefaults(QWEN_CUSTOM);
    expect(quickSummary(QWEN_CUSTOM, pick, mine, { seconds: 1.64, audioSec: 3.92 })).toBe(
      'Vivian · 热情洋溢 · 中文 · 用时 1.6 秒 · 音频 3.9 秒',
    );
    const other = { ...chooseLang(QWEN_BASE, chooseVoice(quickDefaults(QWEN_BASE), 'my:v1'), 'en'), kind: 'numbers' as const };
    expect(quickSummary(QWEN_BASE, other, mine, { seconds: null, audioSec: null })).toBe('我自己 · English · 数字');
    const sample = chooseSample(QWEN_BASE, quickDefaults(QWEN_BASE));
    expect(quickSummary(QWEN_BASE, { ...sample, editing: true }, mine, { seconds: 2, audioSec: null })).toBe(
      '示例 · 中文女声 · 自定义文本 · 用时 2.0 秒',
    );
  });
});

describe('auditionBundle', () => {
  const models = new Map([QWEN_BASE, QWEN_CUSTOM, INDEX_TTS2, OMNIVOICE].map((m) => [m.modelId, m]));
  const synth = (id: string, patch = {}) => bundle(id, { capability: 'synthesize', ...patch });

  it('picks installed, cloneable voices in design order; those outside the table (OmniVoice) go last; null when there are none', () => {
    expect(auditionBundle([synth(QWEN_BASE.modelId), synth(INDEX_TTS2.modelId), synth(QWEN_CUSTOM.modelId)], models)).toBe(
      INDEX_TTS2.modelId,
    );
    expect(auditionBundle([synth(OMNIVOICE.modelId), synth(QWEN_BASE.modelId)], models)).toBe(QWEN_BASE.modelId);
    expect(auditionBundle([synth(OMNIVOICE.modelId)], models)).toBe(OMNIVOICE.modelId);
    expect(auditionBundle([synth(QWEN_CUSTOM.modelId), synth(INDEX_TTS2.modelId, { state: 'not-installed' })], models)).toBeNull();
  });
});
