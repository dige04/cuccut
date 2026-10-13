import { formatRef, localizeText, setLocale } from '@cuccut/protocol';
import { ModelsTextGeneration } from '@cuccut/protocol/messages/models/text-generation.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPABILITY_LABELS, capabilityLabel } from './model-selection.ts';
import { modelDetail } from './model-text.ts';
import { TextGenerationError } from './text-generation.ts';

/** Switches to Chinese mid-test: `CUCCUT_LOCALE` takes precedence over `setLocale`, so both are switched together. */
function toChinese(): void {
  vi.stubEnv('CUCCUT_LOCALE', 'zh-Hans');
  setLocale('zh-Hans');
}

describe('模型文字的多语言', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('错误按当前语言生成，并记下引用', () => {
    const error = new TextGenerationError('PROVIDER_REJECTED', ModelsTextGeneration.contentFiltered({ provider: 'OpenAI' }));
    expect(error.message).toBe("OpenAI's content filter blocked this output");
    expect(error.messageRef?.key).toBe('modelsTextGeneration.contentFiltered');
    expect(formatRef(error.messageRef!, error.message, 'zh-Hans')).toBe('OpenAI 的内容过滤拦下了这次输出');
    // Third-party original wording is not quoted.
    expect(new TextGenerationError('PROVIDER_UNAVAILABLE', 'upstream said no').messageRef).toBeUndefined();
  });

  it('detail 与 detailRef 一起存，读的人换语言时重新生成', () => {
    const stored = modelDetail(ModelsTextGeneration.cancelled());
    expect(stored.detail).toBe('Call cancelled');
    toChinese();
    expect(localizeText(stored.detail, stored.detailRef)).toBe('调用已取消');
    expect(modelDetail('raw worker text')).toEqual({ detail: 'raw worker text' });
  });

  it('能力名每次读都按当前语言生成', () => {
    expect(CAPABILITY_LABELS.transcribe).toBe('Transcription');
    expect(capabilityLabel('generateText').text).toBe('Text generation');
    toChinese();
    expect(CAPABILITY_LABELS.transcribe).toBe('转写');
  });
});
