import { describe, expect, it } from 'vitest';
import type { ImageModelInfo, ProviderView, SpeechModelInfo } from '@cuccut/protocol';
import { codePointLength, imageParameters, speechParameters } from './generation-options.ts';
import { selectModel, type ModelChoice } from './model-selection.ts';

/** Submission-time checks and selection for generation requests (architecture design §6.2, §6.6). Incompatible requests are rejected, and parameters are not silently changed. These two capabilities have no factory defaults. */

const speechModel = (extra: Partial<SpeechModelInfo> = {}): SpeechModelInfo => ({
  modelId: 'tts',
  label: 'tts',
  default: true,
  voices: [{ voiceId: 'alloy', label: 'Alloy' }],
  defaultVoice: 'alloy',
  voiceModes: ['preset'],
  languages: ['en', 'zh'],
  maxInputChars: 5,
  formats: ['mp3', 'wav'],
  defaultFormat: 'mp3',
  acceptsInstructions: false,
  speedRange: { min: 0.5, max: 2 },
  acceptsSeed: false,
  cost: 'unknown',
  ...extra,
});

const imageModel = (extra: Partial<ImageModelInfo> = {}): ImageModelInfo => ({
  modelId: 'img',
  label: 'img',
  default: true,
  sizes: ['1024x1024', '1536x1024'],
  aspectRatios: [
    { ratio: '1:1', size: '1024x1024' },
    { ratio: '3:2', size: '1536x1024' },
  ],
  defaultSize: null,
  maxCount: 2,
  maxPromptChars: 10,
  formats: ['png'],
  defaultFormat: 'png',
  referenceImages: null,
  acceptsSeed: true,
  cost: 'unknown',
  ...extra,
});

const choice = <C extends 'synthesizeSpeech' | 'generateImage'>(capability: C, model: ModelChoice<C>['model']): ModelChoice<C> => ({
  capability,
  providerId: 'openai',
  modelId: model.modelId,
  kind: 'online',
  label: 'OpenAI',
  source: 'explicit',
  model,
});

const invalid = (details?: Record<string, unknown>) =>
  expect.objectContaining({ code: 'invalid-request', ...(details ? { details: expect.objectContaining(details) } : {}) });

describe('speechParameters', () => {
  const speech = choice('synthesizeSpeech', speechModel());

  it('fills in default voice and format, freezing them into complete parameters', () => {
    expect(speechParameters(speech, { text: 'hi', language: 'zh-Hans-CN', speed: 1.5 })).toEqual({
      capability: 'synthesizeSpeech',
      text: 'hi',
      voice: 'alloy',
      language: 'zh-Hans-CN',
      format: 'mp3',
      instructions: null,
      speed: 1.5,
      seed: null,
    });
  });

  it('text length limit counts code points, and text over the limit is rejected (not truncated); empty text is rejected', () => {
    expect(codePointLength('😀😀😀')).toBe(3);
    expect(speechParameters(speech, { text: '😀😀😀😀😀' }).text).toBe('😀😀😀😀😀');
    expect(() => speechParameters(speech, { text: '123456' })).toThrow(invalid({ length: 6, limit: 5 }));
    expect(() => speechParameters(speech, { text: '  ' })).toThrow(invalid());
  });

  it('voice, language, format, style instructions, speed and seed that the model does not support are rejected', () => {
    expect(() => speechParameters(speech, { text: 'hi', voice: 'nova' })).toThrow(invalid({ voices: ['alloy'] }));
    expect(() => speechParameters(speech, { text: 'hi', language: 'ja' })).toThrow(invalid({ languages: ['en', 'zh'] }));
    expect(() => speechParameters(speech, { text: 'hi', language: 'not a tag!' })).toThrow(invalid());
    expect(() => speechParameters(speech, { text: 'hi', format: 'flac' })).toThrow(invalid({ formats: ['mp3', 'wav'] }));
    expect(() => speechParameters(speech, { text: 'hi', instructions: 'calm' })).toThrow(invalid());
    expect(() => speechParameters(speech, { text: 'hi', speed: 3 })).toThrow(invalid({ speedRange: { min: 0.5, max: 2 } }));
    expect(() => speechParameters(speech, { text: 'hi', seed: 1 })).toThrow(invalid());
    // A tone note that is only whitespace is treated as not given.
    expect(speechParameters(speech, { text: 'hi', instructions: '  ' }).instructions).toBeNull();
  });

  it('a voice must be specified when there is no default; when custom voices are accepted, any ID is passed through unchanged', () => {
    const custom = choice('synthesizeSpeech', speechModel({ voices: [], defaultVoice: null, voiceModes: ['custom'], languages: 'any' }));
    expect(() => speechParameters(custom, { text: 'hi' })).toThrow(invalid({ voices: [] }));
    expect(speechParameters(custom, { text: 'hi', voice: 'JBFqnCBsd6RMkjVDRZzb', language: 'ja' })).toMatchObject({
      voice: 'JBFqnCBsd6RMkjVDRZzb',
      language: 'ja',
    });
  });
});

describe('imageParameters', () => {
  const image = choice('generateImage', imageModel());

  it('without a size the model\'s default is used (null defers to the provider); an aspect ratio is converted to the matching size', () => {
    expect(imageParameters(image, { prompt: 'a fox' })).toEqual({
      capability: 'generateImage',
      prompt: 'a fox',
      size: null,
      aspectRatio: null,
      count: 1,
      format: 'png',
      seed: null,
    });
    expect(imageParameters(image, { prompt: 'a fox', size: '3:2', count: 2, seed: 9 })).toMatchObject({
      size: '1536x1024',
      aspectRatio: '3:2',
      count: 2,
      seed: 9,
    });
    expect(imageParameters(image, { prompt: 'a fox', size: '1536x1024' })).toMatchObject({ size: '1536x1024', aspectRatio: null });
  });

  it('size, aspect ratio, count, format and prompt length that the model does not support are rejected', () => {
    expect(() => imageParameters(image, { prompt: 'a fox', size: '512x512' })).toThrow(invalid({ sizes: ['1024x1024', '1536x1024'] }));
    expect(() => imageParameters(image, { prompt: 'a fox', size: '16:9' })).toThrow(invalid({ aspectRatios: ['1:1', '3:2'] }));
    expect(() => imageParameters(image, { prompt: 'a fox', count: 3 })).toThrow(invalid({ maxCount: 2 }));
    expect(() => imageParameters(image, { prompt: 'a fox', count: 0 })).toThrow(invalid());
    expect(() => imageParameters(image, { prompt: 'a fox', format: 'webp' })).toThrow(invalid({ formats: ['png'] }));
    expect(() => imageParameters(image, { prompt: 'a fox in the snow' })).toThrow(invalid({ limit: 10 }));
    expect(() => imageParameters(image, { prompt: '' })).toThrow(invalid());
  });

  it('steps are accepted only by local models: online models reject them; local ones are checked against the local.steps range and frozen only when given', () => {
    expect(() => imageParameters(image, { prompt: 'a fox', steps: 20 })).toThrow(invalid());
    const local = choice('generateImage', { ...imageModel(), local: { steps: { min: 8, max: 40, step: 4, default: 20 } } });
    expect(imageParameters(local, { prompt: 'a fox', steps: 8 })).toMatchObject({ steps: 8 });
    expect(imageParameters(local, { prompt: 'a fox' })).not.toHaveProperty('steps');
    for (const steps of [4, 41, 8.5]) expect(() => imageParameters(local, { prompt: 'a fox', steps })).toThrow(invalid());
  });
});

describe('choosing a generation capability', () => {
  const view = (providerId: string, kind: ProviderView['kind'], available = true): ProviderView => ({
    providerId,
    kind,
    label: providerId,
    config: null,
    capabilities: { synthesizeSpeech: { models: [speechModel()], available } },
  });

  it('no factory default: local is not auto-selected even if offered; it must be specified explicitly or set as the default', () => {
    const select = (input: { provider?: string; userDefault?: { providerId: string; modelId: string } }) =>
      selectModel({
        capability: 'synthesizeSpeech',
        userDefault: null,
        providers: [view('local', 'local'), view('openai', 'online')],
        ...input,
      });
    expect(() => select({})).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({
          code: 'CAPABILITY_NOT_CONFIGURED',
          capability: 'synthesizeSpeech',
          reason: 'no-default',
          remedy: expect.objectContaining({ action: 'set-default' }),
        }),
      }),
    );
    expect(select({ provider: 'local' })).toMatchObject({ providerId: 'local', modelId: 'tts', source: 'explicit' });
    expect(select({ userDefault: { providerId: 'openai', modelId: 'tts' } })).toMatchObject({
      providerId: 'openai',
      source: 'user-default',
    });
  });

  it('nothing available: the remedy is to configure a service', () => {
    expect(() => selectModel({ capability: 'synthesizeSpeech', userDefault: null, providers: [view('openai', 'online', false)] })).toThrow(
      expect.objectContaining({ details: expect.objectContaining({ remedy: expect.objectContaining({ action: 'configure-provider' }) }) }),
    );
  });
});
