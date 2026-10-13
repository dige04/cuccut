import { describe, expect, it } from 'vitest';
import { methodParamSchemas } from './schemas.ts';

describe('models.synthesizeSpeech requests', () => {
  const schema = methodParamSchemas['models.synthesizeSpeech'];
  const ok = (extra: object) => schema.safeParse({ text: '你好', ...extra }).success;

  it('local model voice modes: reference recording (absolute path, optionally with transcript), one-sentence description, diffusion knob', () => {
    expect(ok({})).toBe(true);
    expect(ok({ voice: 'library:vce_1' })).toBe(true);
    expect(ok({ reference: { file: '/Users/me/ref.wav' } })).toBe(true);
    expect(ok({ reference: { file: '/Users/me/ref.wav', transcript: '参考录音的原文' } })).toBe(true);
    expect(ok({ voiceDescription: 'female, low pitch' })).toBe(true);
    expect(ok({ cfg: 2.5, steps: 16 })).toBe(true);
  });

  it('rejects invalid input: relative path, extra fields, empty description, non-integer steps; only one of voice, reference and voiceDescription may be given', () => {
    expect(ok({ reference: { file: 'ref.wav' } })).toBe(false);
    expect(ok({ reference: { file: '/ref.wav', speaker: 'a' } })).toBe(false);
    expect(ok({ voiceDescription: '   ' })).toBe(false);
    expect(ok({ steps: 1.5 })).toBe(false);
    expect(ok({ steps: 0 })).toBe(false);
    expect(ok({ cfg: -1 })).toBe(false);
    expect(ok({ voice: 'alloy', reference: { file: '/ref.wav' } })).toBe(false);
    expect(ok({ voice: 'alloy', voiceDescription: 'calm' })).toBe(false);
    expect(ok({ reference: { file: '/ref.wav' }, voiceDescription: 'calm' })).toBe(false);
  });

  it('a local model pack can be set as the default for synthesis', () => {
    const setDefault = methodParamSchemas['models.setDefault'];
    expect(
      setDefault.safeParse({ capability: 'synthesizeSpeech', providerId: 'local', modelId: 'qwen3-tts-0.6b-base@mlx-8bit' }).success,
    ).toBe(true);
    expect(methodParamSchemas['models.test'].safeParse({ bundleId: 'omnivoice@mlx-int8' }).success).toBe(true);
  });
});
