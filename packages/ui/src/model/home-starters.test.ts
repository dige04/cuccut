import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import { homeStarters, starterOf, starterTarget } from './home-starters.ts';
import { slotLabels } from './prompt-slots.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

describe('homeStarters', () => {
  it('four entries, ordered: add subtitles, transcribe and translate, cut talking head, audio to video', () => {
    expect(homeStarters().map((s) => [s.key, s.title])).toEqual([
      ['sub', '加字幕'],
      ['trans', '转录并翻译'],
      ['clean', '剪口播'],
      ['a2v', '音频转视频'],
    ]);
  });

  it('cards are told apart by color family; the four cards do not clash', () => {
    const tones = homeStarters().map((s) => s.tone);
    expect(new Set(tones).size).toBe(tones.length);
  });

  it('each has a complete prompt; the prompt says whether to drag in a video or audio, and a link can also be pasted', () => {
    for (const s of homeStarters()) expect(s.prompt).toMatch(/。$/);
    expect(starterOf('sub').tip).toBe('填入提示词，再把视频拖进输入框，或贴上视频链接');
    expect(starterOf('a2v').tip).toBe('填入提示词，再把音频拖进输入框，或贴上链接');
  });

  it('"transcribe and translate" has no default language: without a remembered one it leaves a field to fill; with one, the last value is used', () => {
    expect(starterOf('trans').prompt).toBe('转录这个视频，并翻译成{{目标语言}}，做成双语字幕。');
    expect(slotLabels(starterOf('trans').prompt)).toEqual(['目标语言']);
    expect(starterOf('trans', '日文').prompt).toBe('转录这个视频，并翻译成日文，做成双语字幕。');
    expect(homeStarters('日文').find((s) => s.key === 'trans')?.prompt).toBe('转录这个视频，并翻译成日文，做成双语字幕。');
    // The other entries have no unfilled slots, so they are unaffected.
    expect(starterOf('sub', '日文').prompt).toBe('给这个视频加上字幕。');
  });

  it('recognizes the target language filled in on send; does not remember when it is not this sentence or not yet filled', () => {
    expect(starterTarget('转录这个视频，并翻译成英文，做成双语字幕。')).toBe('英文');
    expect(starterTarget('转录这个视频，并翻译成{{目标语言}}，做成双语字幕。')).toBeNull();
    expect(starterTarget('给这个视频加上字幕。')).toBeNull();
  });

  it('each UI language\'s "transcribe and translate" has exactly one fill-in field, and it is recognized after being filled', () => {
    for (const locale of ['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pl', 'pt-BR', 'ru', 'tr', 'vi', 'zh-Hans', 'zh-Hant'] as const) {
      vi.stubEnv('CUCCUT_LOCALE', locale);
      setLocale(locale);
      const template = starterOf('trans').prompt;
      expect(slotLabels(template), locale).toHaveLength(1);
      expect(starterTarget(starterOf('trans', 'Klingon').prompt), locale).toBe('Klingon');
      expect(starterOf('sub').tip, locale).not.toBe(starterOf('a2v').tip);
    }
  });

  it('prompt text is not mistaken for a production category', () => {
    for (const s of homeStarters()) expect(s.prompt).not.toMatch(/动画|讲解|图表/);
  });
});
