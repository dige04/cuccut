import { describe, expect, it } from 'vitest';
import { localDefaultChoice, localDefaultPicker } from './models-local.ts';
import { bundle, fixtureView } from './models-test-fixtures.ts';
import {
  familyDesc,
  installedBytes,
  languagesFact,
  licenseBrief,
  localSpeechModels,
  quickKind,
  quickNote,
  ttsBrief,
  ttsChips,
} from './models-tts-local.ts';
import { CC_BY_NC, GPT_SOVITS, INDEX_TTS2, OMNIVOICE, QWEN_BASE, QWEN_CUSTOM, QWEN_DESIGN, VOXCPM2 } from './tts-test-fixtures.ts';

const BASE = QWEN_BASE.modelId;
const CUSTOM = QWEN_CUSTOM.modelId;

describe('localDefaultPicker (speech synthesis)', () => {
  const synth = (id: string, label: string, patch = {}) => bundle(id, { capability: 'synthesize', label, ...patch });
  const bundles = [
    synth(BASE, 'Qwen3-TTS 0.6B Base'),
    synth(CUSTOM, 'Qwen3-TTS 0.6B CustomVoice'),
    synth('omnivoice@mlx-int8', 'OmniVoice', { state: 'not-installed' }),
    synth('voxcpm2@mlx-int8', 'VoxCPM2', { state: 'downloading', components: [{ component: 'tts', repo: 'a/b', revision: 'r', state: 'missing', bytes: null, sharedWith: [] }] }),
    bundle('qwen3-asr-0.6b@mlx-4bit'),
  ];

  it('no factory default: no "auto select", nothing checked; only installed synthesis model packs listed, named by label', () => {
    const picker = localDefaultPicker(fixtureView(), bundles, 'synthesize');
    expect(picker).toMatchObject({ selectedKey: null, other: null, autoUses: null, hasAuto: false });
    expect(picker.items).toEqual([
      { key: BASE, label: 'Qwen3-TTS 0.6B Base' },
      { key: CUSTOM, label: 'Qwen3-TTS 0.6B CustomVoice' },
    ]);
  });

  it('default is a local synthesis model pack: check it; one already not selectable (deleted or missing components) counts as "unset" and is not listed', () => {
    const view = fixtureView();
    view.synthesizeSpeech.default = { providerId: 'local', modelId: CUSTOM };
    expect(localDefaultPicker(view, bundles, 'synthesize').selectedKey).toBe(CUSTOM);
    for (const stale of ['omnivoice@mlx-int8', 'voxcpm2@mlx-int8']) {
      view.synthesizeSpeech.default = { providerId: 'local', modelId: stale };
      const picker = localDefaultPicker(view, bundles, 'synthesize');
      expect(picker).toMatchObject({ selectedKey: null, other: null, hasAuto: false });
      expect(picker.items.map((i) => i.key)).toEqual([BASE, CUSTOM]);
    }
  });

  it('when Runtime deletes the default synthesis model pack, the default is cleared: nothing checked, shows "unset"', () => {
    const view = fixtureView();
    view.synthesizeSpeech.default = null;
    const removed = bundles.map((b) => (b.bundleId === CUSTOM ? { ...b, state: 'not-installed' as const } : b));
    expect(localDefaultPicker(view, removed, 'synthesize')).toMatchObject({ selectedKey: null, other: null });
  });

  it('default is a cloud model: no item checked, state honestly which one; choosing a local item switches to local', () => {
    const view = fixtureView();
    view.synthesizeSpeech.default = { providerId: 'openai', modelId: 'gpt-4o-mini-tts' };
    expect(localDefaultPicker(view, bundles, 'synthesize')).toMatchObject({ selectedKey: null, other: 'OpenAI · gpt-4o-mini-tts' });
    expect(localDefaultChoice(BASE)).toEqual({ providerId: 'local', modelId: BASE });
  });

  it('speech-recognition menu is unaffected: it still has "auto select"', () => {
    expect(localDefaultPicker(fixtureView(), bundles).hasAuto).toBe(true);
  });
});

describe('ttsBrief', () => {
  it('clone model: built-in voice / clone, supported languages; style instructions only for those that accept a style description', () => {
    expect(ttsBrief(QWEN_BASE)).toEqual({
      summary: '八只内置音色，或用一段录音克隆声音',
      facts: ['内置音色 / 克隆', '中 / 英 / 日 / 韩 等 10 种语言', '24 kHz'],
    });
    expect(ttsBrief(VOXCPM2).facts).toEqual(['内置音色 / 克隆', '风格指令', '语言不限', '48 kHz']);
    expect(ttsBrief(GPT_SOVITS).facts[1]).toBe('中 / 英');
  });

  it('emotion control not supported in this version: IndexTTS row does not write "emotion adjustable"', () => {
    expect(ttsBrief(INDEX_TTS2).summary).not.toContain('情绪');
    expect(ttsBrief(INDEX_TTS2).facts).not.toContain('情绪可调');
  });

  it('preset, description, and those with all three each written separately; large model labeled "slower"', () => {
    expect(ttsBrief(QWEN_CUSTOM).summary).toBe('9 个预设音色，选一个就能念；可用一句话指定语气');
    expect(ttsBrief(QWEN_DESIGN)).toEqual({
      summary: '用一句话描述想要的声音，模型现造一个；也可以直接用八只内置音色',
      facts: ['按描述造声音', '中 / 英 / 日 / 韩 等 10 种语言', '24 kHz', '较慢'],
    });
    expect(ttsBrief(OMNIVOICE)).toMatchObject({
      summary: '八只内置音色、用一段录音克隆，或挑性别、年龄、音高造一个新声音；能按目标时长念',
      facts: ['内置音色 / 克隆 / 描述', '语言不限', '24 kHz'],
    });
  });

  it('languages: up to five all written; more writes the first four and the total', () => {
    expect(languagesFact(['zh', 'en', 'ja', 'es', 'ar'])).toBe('中 / 英 / 日 / 西 / 阿');
    expect(languagesFact(['zh', 'xx'])).toBe('中 / xx');
  });
});

describe('license, note and size', () => {
  it('not allowed for commercial use is marked "non-commercial only", license summary states whom to apply to', () => {
    const omni = bundle('omnivoice@mlx-int8', { capability: 'synthesize', license: CC_BY_NC });
    expect(ttsChips(omni, true)).toEqual([
      { label: '默认', tone: 'accent' },
      { label: '仅限非商用', tone: 'notice' },
    ]);
    expect(licenseBrief(CC_BY_NC)).toBe('CC-BY-NC-4.0 · 只许非商业用途 · 商用要向 k2-fsa 另行申请');
    expect(ttsChips(bundle(BASE, { capability: 'synthesize' }), false)).toEqual([]);
  });

  it('one line before preview: description model, VoxCPM2, not for commercial use, large model each have their own wording, others none', () => {
    expect(quickNote(QWEN_DESIGN)).toContain('描述决定');
    expect(quickNote(VOXCPM2)).toContain('一倍实时');
    expect(quickNote(OMNIVOICE)).toBe('仅限非商用（CC-BY-NC-4.0）：做要商用的内容请换别的模型');
    expect(quickNote({ ...QWEN_CUSTOM, local: { ...QWEN_CUSTOM.local!, slow: true } })).toContain('大模型');
    expect(quickNote(QWEN_BASE)).toBeNull();
  });

  it('when the model description has notes (candle\'s CPU timing), say it before preview', () => {
    const notes = '在本机的 CPU 上合成，只用到一两个核，比实时慢约 55 倍';
    expect(quickNote({ ...VOXCPM2, notes })).toBe(notes);
    expect(quickNote({ ...QWEN_DESIGN, notes })).toBe(notes);
    expect(quickNote({ ...QWEN_BASE, notes })).toBe(notes);
  });

  it('engine family note taken by family; unrecognized ones not written', () => {
    expect(familyDesc(INDEX_TTS2)).toMatch(/^IndexTTS：/);
    expect(familyDesc({ local: { ...QWEN_BASE.local!, family: 'unknown' } })).toBeNull();
    expect(familyDesc({})).toBeNull();
  });

  it('preview method: those that can clone count as clone (OmniVoice too), those only describing count as description, the rest are presets', () => {
    expect([QWEN_BASE, QWEN_CUSTOM, QWEN_DESIGN, OMNIVOICE].map(quickKind)).toEqual(['clone', 'preset', 'describe', 'clone']);
  });

  it('installed size is the sum of components; not written when a component has no reported size', () => {
    const comp = (bytes: number | null) => ({ component: 'tts', repo: 'a/b', revision: 'r', state: 'installed' as const, bytes, sharedWith: [] });
    expect(installedBytes({ components: [comp(100), comp(20)] })).toBe(120);
    expect(installedBytes({ components: [comp(100), comp(null)] })).toBeNull();
    expect(installedBytes({})).toBeNull();
  });

  it('local synthesis model is looked up by model pack ID', () => {
    const view = fixtureView();
    view.synthesizeSpeech.providers.unshift({ providerId: 'local', kind: 'local', label: '本机', config: null, models: [QWEN_BASE], available: true });
    expect([...localSpeechModels(view).keys()]).toEqual([BASE]);
    expect(localSpeechModels(null).size).toBe(0);
  });
});
