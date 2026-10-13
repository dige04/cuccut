import { describe, expect, it } from 'vitest';
import type { LibraryEntrySummary, SpeechModelInfo } from '@cuccut/protocol';
import { fixtureView, speechModel } from './models-test-fixtures.ts';
import { cloudModelOptions } from './tools-models.ts';
import { AUDIO_OUT, toolJob } from './tools-test-fixtures.ts';
import {
  BLANK_TTS,
  emptyText,
  TTS_SAMPLES,
  VIBES,
  audioFileName,
  draftFromJob,
  estimateDuration,
  headerChip,
  pickVibe,
  rollVibe,
  sampleText,
  segments,
  speechMeta,
  speechModelLine,
  speechRetry,
  speechRequest,
  switchModel,
  textStats,
  ttsProblems,
  ttsStatus,
  libraryIdOf,
  libraryVoiceBlock,
  voiceKeyFor,
  voiceLabel,
  voiceOptions,
  voiceToSend,
  type SpeechOption,
  type TtsDraft,
} from './tools-tts.ts';

function option(info: SpeechModelInfo, patch: Partial<SpeechOption> = {}): SpeechOption {
  return {
    key: `openai/${info.modelId}`,
    providerId: 'openai',
    provider: 'OpenAI',
    modelId: info.modelId,
    label: info.label,
    connected: true,
    usable: true,
    why: null,
    info,
    ...patch,
  };
}

const rich = speechModel('gpt-4o-mini-tts', ['alloy', 'echo'], {
  acceptsInstructions: true,
  speedRange: { min: 0.25, max: 4 },
  acceptsSeed: true,
  formats: ['mp3', 'wav'],
  maxInputChars: 20,
  languages: ['en', 'zh'],
});
const draft = (patch: Partial<TtsDraft> = {}): TtsDraft => ({ ...BLANK_TTS, model: 'openai/gpt-4o-mini-tts', ...patch });

describe('text', () => {
  it('segmentation and estimated duration (per design spec model-tts.js)', () => {
    expect(segments('第一句。第二句！\nThird one. Fourth?')).toEqual(['第一句。', '第二句！', 'Third one.', 'Fourth?']);
    // 8 Chinese characters / 4.2 + 1 pause × 0.18 = 2.08…
    expect(estimateDuration('欢迎使用宝玉剪辑。')).toBe(2.1);
    expect(estimateDuration('  ')).toBe(0);
  });

  it('character count line', () => {
    expect(textStats('', 4096)).toBe('0 / 4096 字');
    expect(textStats('你好。再见。', 4096)).toBe('6 / 4096 字 · 2 段 · 约 1.3 秒');
  });

  it('sample sentence by language; on auto, depends on whether the model can speak Chinese', () => {
    expect(sampleText({ language: '' }, rich)).toBe(TTS_SAMPLES.zh);
    expect(sampleText({ language: 'en' }, rich)).toBe(TTS_SAMPLES.en);
    expect(sampleText({ language: '' }, { languages: ['en'] })).toBe(TTS_SAMPLES.en);
  });
});

describe('delivery', () => {
  it('clicking a card fills in the style; text left empty is filled with the sample; clicking the same card again clears it', () => {
    const v = VIBES[0];
    expect(pickVibe(draft(), v.key, rich)).toEqual({ instructions: v.style, text: TTS_SAMPLES.zh });
    expect(pickVibe(draft({ text: 'hi' }), v.key, rich)).toEqual({ instructions: v.style });
    expect(pickVibe(draft({ instructions: v.style }), v.key, rich)).toEqual({ instructions: '' });
  });

  it('change sentence: picks a different one from the current', () => {
    const now = draft({ text: 'hi', instructions: VIBES[0].style });
    expect(rollVibe(now, rich, () => 0)).toEqual({ instructions: VIBES[1].style });
  });
});

describe('voice', () => {
  it('default, preset, custom (when the model accepts custom)', () => {
    expect(voiceOptions(rich).map((o) => o.key)).toEqual(['default', 'preset:alloy', 'preset:echo', 'custom']);
    expect(voiceOptions(rich)[0]!.label).toBe('默认 · alloy');
    const presetOnly = speechModel('tts-1', ['nova'], { voiceModes: ['preset'] });
    expect(voiceOptions(presetOnly).map((o) => o.key)).toEqual(['default', 'preset:nova']);
  });

  it('model row: voice, style, speed, language, character limit', () => {
    expect(speechModelLine(rich)).toBe('2 个预置音色 · 收风格说明 · 语速 0.25–4× · 英语、中文 · 一次最多 20 字');
    expect(speechModelLine(speechModel('v', [], { voiceModes: ['custom'], languages: 'any', maxInputChars: 5000 }))).toBe(
      '手填音色 ID · 多种语言 · 一次最多 5000 字',
    );
    // The model description's notes (local candle timing on CPU) are written first.
    expect(speechModelLine({ ...rich, notes: '在本机的 CPU 上合成' })).toMatch(/^在本机的 CPU 上合成 · 2 个预置音色/);
  });

  it('a draft\'s voice that does not hold on the new model falls back to the first item', () => {
    const noDefault = speechModel('x', ['v1'], { defaultVoice: null, voiceModes: ['preset'] });
    expect(voiceKeyFor({ voice: 'preset:alloy' }, noDefault)).toBe('preset:v1');
    expect(voiceKeyFor({ voice: 'custom' }, rich)).toBe('custom');
    expect(voiceLabel({ voice: 'default', customVoice: '' }, rich)).toBe('alloy');
    expect(voiceLabel({ voice: 'custom', customVoice: ' my-voice ' }, rich)).toBe('my-voice');
  });

  it('switching models: voice, speed, format return to default; unsupported languages revert to auto', () => {
    const eleven = option(speechModel('eleven', [], { languages: ['en'] }), { key: 'elevenlabs/eleven' });
    expect(switchModel(draft({ voice: 'preset:alloy', speed: 1.5, format: 'wav', language: 'zh', text: 't' }), eleven)).toEqual({
      model: 'elevenlabs/eleven',
      voice: 'default',
      customVoice: '',
      speed: null,
      format: null,
      language: '',
    });
    // My voice follows the person: it is kept when switching models; whether it can be used is explained by the picker and validation.
    expect(switchModel(draft({ voice: 'library:v1' }), eleven).voice).toBe('library:v1');
  });
});

describe('validation', () => {
  it('missing text, over the limit, custom voice not filled in, unsupported language, seed not an integer', () => {
    expect(ttsProblems(draft(), option(rich))).toEqual([emptyText()]);
    expect(ttsProblems(draft({ text: '一'.repeat(21) }), option(rich))).toEqual(['gpt-4o-mini-tts 一次最多 20 字，先删短一些']);
    expect(ttsProblems(draft({ text: 'hi', voice: 'custom' }), option(rich))).toEqual(['先填音色 ID']);
    expect(ttsProblems(draft({ text: 'こんにちは' }), option(rich))).toEqual(['gpt-4o-mini-tts 不会念日语']);
    expect(ttsProblems(draft({ text: 'hi', language: 'fr' }), option(rich))).toEqual(['gpt-4o-mini-tts 不会念法语']);
    expect(ttsProblems(draft({ text: 'hi', seed: 'x' }), option(rich))).toEqual(['种子要是整数']);
  });

  it('model with no selectable voices', () => {
    const none = speechModel('x', [], { defaultVoice: null, voiceModes: ['preset'] });
    expect(ttsProblems(draft({ text: 'hi' }), option(none))).toEqual(['这只模型没有可用的音色']);
    const customOnly = speechModel('y', [], { defaultVoice: null, voiceModes: ['custom'] });
    expect(ttsProblems(draft({ text: 'hi' }), option(customOnly))).toEqual(['先填音色 ID']);
  });

  it('models that do not accept a seed do not validate the seed', () => {
    expect(ttsProblems(draft({ text: 'hi', seed: 'x' }), option(speechModel('m', ['a'])))).toEqual([]);
  });
});

describe('request', () => {
  it('only includes fields the model accepts; default voice not sent; speed not adjusted is not sent', () => {
    expect(speechRequest(draft({ text: ' 你好 ' }), option(rich))).toEqual({
      text: '你好',
      provider: 'openai',
      model: 'gpt-4o-mini-tts',
      format: 'mp3',
    });
    expect(
      speechRequest(
        draft({ text: 'hi', voice: 'preset:echo', language: 'en', instructions: ' 慢一点 ', speed: 9, seed: '7', format: 'wav' }),
        option(rich),
      ),
    ).toEqual({ text: 'hi', provider: 'openai', model: 'gpt-4o-mini-tts', voice: 'echo', language: 'en', format: 'wav', instructions: '慢一点', speed: 4, seed: 7 });
  });

  it('not sent when the model does not accept style, speed or seed; custom voice passed to the provider as is', () => {
    const plain = speechModel('tts-1', ['nova']);
    expect(speechRequest(draft({ text: 'hi', voice: 'custom', customVoice: ' v-123 ', instructions: 'x', speed: 2, seed: '1', format: 'wav' }), option(plain))).toEqual({
      text: 'hi',
      provider: 'openai',
      model: 'tts-1',
      voice: 'v-123',
      format: 'mp3',
    });
  });
});

describe('status beside the primary button', () => {
  const options = cloudModelOptions(fixtureView(), 'synthesizeSpeech');

  it('gate: no model, not connected', () => {
    expect(ttsStatus(draft(), null, false)).toEqual({ text: '还没有可用的语音合成模型', bad: true });
    expect(ttsStatus(draft(), options[2]!, false)).toEqual({ text: '先连接 ElevenLabs', bad: true });
  });

  it('the missing-text item is only mentioned after one attempt; when all is well, says model, voice, duration and character count', () => {
    expect(ttsStatus(draft(), options[0]!, false)).toEqual({ text: 'gpt-4o-mini-tts · alloy', bad: false });
    expect(ttsStatus(draft(), options[0]!, true)).toEqual({ text: emptyText(), bad: true });
    expect(ttsStatus(draft({ text: '你好。' }), options[0]!, false)).toEqual({ text: 'gpt-4o-mini-tts · alloy · 约 0.7 秒 · 约 3 字', bad: false });
    expect(headerChip(options[0]!)).toBe('联网 · OpenAI · 按用量计费');
  });

  it('speaking a Space entry: no text required, the request\'s text is an empty string with material; status says the entry name', () => {
    const material = { entryId: 'ent_doc', name: '旁白.md' };
    expect(ttsStatus(draft(), options[0]!, true, null, material)).toEqual({ text: 'gpt-4o-mini-tts · alloy · 念「旁白.md」的文字', bad: false });
    expect(ttsProblems(draft({ text: '写过的字不算' }), options[0]!, null, material)).toEqual([]);
    expect(speechRequest(draft({ text: '写过的字不算' }), options[0]!, material)).toEqual({
      text: '',
      material: { entryId: 'ent_doc' },
      provider: 'openai',
      model: 'gpt-4o-mini-tts',
      format: 'mp3',
    });
  });
});

describe('records', () => {
  it('metadata row: output duration and sample rate, provider and model, voice, language, character count', () => {
    expect(speechMeta(toolJob({ state: 'completed', result: { documentId: null, artifactId: AUDIO_OUT.artifactId, outputs: [AUDIO_OUT] } }), 'OpenAI')).toBe(
      '00:07 · 24 kHz · OpenAI · gpt-4o-mini-tts · alloy · 中文 · 12 字',
    );
    expect(speechMeta(toolJob(), 'OpenAI')).toBe('OpenAI · gpt-4o-mini-tts · alloy · 中文 · 12 字');
  });

  it('download file name: text start plus extension, invalid characters removed', () => {
    expect(audioFileName(toolJob(), AUDIO_OUT)).toBe('欢迎使用 CucCut！.mp3');
    const slashy = toolJob({ generation: { ...toolJob().generation!, text: 'a/b:c\nd' } as never });
    expect(audioFileName(slashy, { mediaType: 'audio/wav' })).toBe('a b c d.wav');
  });

  it('retry: resubmits the frozen parameters as they were', () => {
    expect(speechRetry(toolJob({ state: 'failed' }))).toEqual({
      text: '欢迎使用 CucCut！',
      provider: 'openai',
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      language: 'zh',
      format: 'mp3',
    });
    const styled = toolJob({ generation: { ...toolJob().generation!, instructions: '慢一点', speed: 1.2, seed: 0 } as never });
    expect(speechRetry(styled)).toMatchObject({ instructions: '慢一点', speed: 1.2, seed: 0 });
    expect(speechRetry(toolJob({ generation: undefined }))).toBeNull();
  });

  it('carry back to left: voice is matched to default, preset or custom per the model\'s list', () => {
    expect(draftFromJob(toolJob(), rich)).toMatchObject({ text: '欢迎使用 CucCut！', model: 'openai/gpt-4o-mini-tts', voice: 'default', language: 'zh' });
    const echo = toolJob({ generation: { ...toolJob().generation!, voice: 'echo', seed: 3 } as never });
    expect(draftFromJob(echo, rich)).toMatchObject({ voice: 'preset:echo', seed: '3' });
    const mine = toolJob({ generation: { ...toolJob().generation!, voice: 'cloned-1' } as never });
    expect(draftFromJob(mine, rich)).toMatchObject({ voice: 'custom', customVoice: 'cloned-1' });
    expect(draftFromJob(toolJob({ generation: undefined }), rich)).toBeNull();
  });
});

describe('my voice', () => {
  const voice = (id: string, patch: Partial<LibraryEntrySummary> = {}): LibraryEntrySummary => ({
    library: 'voices',
    id,
    version: 1,
    name: `声音 ${id}`,
    contentHash: 'sha256:v',
    kind: 'voice',
    updatedAt: '2026-10-01T00:00:00.000Z',
    consentDeclared: true,
    clones: [],
    ...patch,
  });
  const eleven = option(speechModel('eleven_multilingual_v2', [], { voiceModes: ['custom'] }), {
    key: 'elevenlabs/eleven_multilingual_v2',
    providerId: 'elevenlabs',
    provider: 'ElevenLabs',
  });
  const cloned = voice('v1', { clones: [{ providerId: 'elevenlabs', state: 'valid' }] });
  const mine = draft({ text: 'hi', model: eleven.key, voice: 'library:v1' });

  it('`library:<id>` is kept as is and passed to the Runtime as is', () => {
    expect(libraryIdOf('library:v1')).toBe('v1');
    expect(libraryIdOf('preset:alloy')).toBeNull();
    expect(voiceKeyFor({ voice: 'library:v1' }, eleven.info)).toBe('library:v1');
    expect(voiceToSend(mine, eleven.info)).toBe('library:v1');
  });

  it('whether usable on the selected provider: needs a valid clone, a self-declaration, and the model must accept non-preset voices', () => {
    expect(libraryVoiceBlock(cloned, eleven)).toBeNull();
    expect(libraryVoiceBlock(voice('v2'), eleven)).toBe('还没在 ElevenLabs 上克隆 · 去我的声音里上传一次');
    expect(libraryVoiceBlock(voice('v3', { clones: [{ providerId: 'elevenlabs', state: 'stale' }] }), eleven)).toBe(
      '在 ElevenLabs 上的克隆已过期（参考录音改过） · 去我的声音里重新上传',
    );
    expect(libraryVoiceBlock({ ...cloned, consentDeclared: false }, eleven)).toBe('没有说明是本人的声音或已获许可，不上传到第三方 · 去我的声音里补上声明');
    expect(libraryVoiceBlock(cloned, option(rich))).toBe('OpenAI 不能克隆 · 用它的预置音色');
    const presetOnly = option(speechModel('tts-1', ['nova'], { voiceModes: ['preset'] }));
    expect(libraryVoiceBlock(cloned, presetOnly)).toBe('tts-1 只收预置音色，用不了我的声音');
  });

  it('validation and status sentence: clearly state deleted or unusable; does not block before my voice has loaded', () => {
    expect(ttsProblems(mine, eleven, [cloned])).toEqual([]);
    expect(ttsProblems(mine, eleven, [])).toEqual(['选中的音色已经删了，换一只']);
    expect(ttsProblems(mine, eleven, [voice('v1')])).toEqual(['还没在 ElevenLabs 上克隆 · 去我的声音里上传一次']);
    expect(ttsProblems(mine, eleven, null)).toEqual([]);
    expect(ttsStatus(mine, eleven, false, [cloned]).text).toBe('eleven_multilingual_v2 · 声音 v1 · 约 0.4 秒 · 约 2 字');
    expect(voiceLabel(mine, eleven.info, [])).toBe('已删除的音色');
    expect(voiceLabel(mine, eleven.info)).toBe('我的声音');
  });

  it('carry back to form and retry: matches my voice, retry still gives `library:<id>`', () => {
    const job = toolJob({
      providerId: 'elevenlabs',
      modelId: 'eleven_multilingual_v2',
      state: 'failed',
      generation: { capability: 'synthesizeSpeech', text: 'hi', voice: 'clone-123', language: null, format: 'mp3', instructions: null, speed: null, seed: null },
      library: { entries: [{ library: 'voices', id: 'v1', version: 2, contentHash: 'sha256:11' }] },
    });
    expect(draftFromJob(job, eleven.info)).toMatchObject({ voice: 'library:v1', customVoice: '' });
    expect(speechRetry(job)).toMatchObject({ voice: 'library:v1', provider: 'elevenlabs' });
  });
});
