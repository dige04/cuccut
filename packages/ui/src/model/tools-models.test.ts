import { describe, expect, it } from 'vitest';
import { fixtureView, withLocalSpeech } from './models-test-fixtures.ts';
import {
  localModelOptions,
  localNotDownloaded,
  modelOptions,
  cloudModelOptions,
  codePoints,
  detectLang,
  findOption,
  initialModelKey,
  installedAlternative,
  langName,
  languageOptions,
  languagesShort,
  parseModelKey,
  parseSeed,
  providerName,
  speaks,
} from './tools-models.ts';

describe('model options on the tools page', () => {
  it('cloud: connected providers list all their models, unconnected ones list only the first and are marked not connected; agent provider is not included', () => {
    const options = cloudModelOptions(fixtureView(), 'synthesizeSpeech');
    expect(options.map((o) => [o.key, o.usable, o.why])).toEqual([
      ['openai/gpt-4o-mini-tts', true, null],
      ['custom:tts-box/tts-1', true, null],
      ['elevenlabs/eleven_multilingual_v2', false, '未连接'],
    ]);
    expect(options[1]!.label).toBe('中文女声');
    expect(options[1]!.provider).toBe('TTS Box');
    expect(cloudModelOptions(fixtureView(), 'generateImage').map((o) => o.providerId)).toEqual(['openai', 'google']);
  });

  it('`all` lists unconnected providers too', () => {
    const view = fixtureView();
    view.transcribe.providers[2]!.models.push({ ...view.transcribe.providers[2]!.models[0]!, modelId: 'gemini-2.5-pro', label: 'gemini-2.5-pro' });
    expect(cloudModelOptions(view, 'transcribe').filter((o) => o.providerId === 'google')).toHaveLength(1);
    expect(cloudModelOptions(view, 'transcribe', true).filter((o) => o.providerId === 'google')).toHaveLength(2);
  });

  it('on page open: last selected, then effective default (must be usable), then first usable, then first', () => {
    const options = cloudModelOptions(fixtureView(), 'synthesizeSpeech');
    expect(initialModelKey(options, 'elevenlabs/eleven_multilingual_v2', null)).toBe('elevenlabs/eleven_multilingual_v2');
    expect(initialModelKey(options, 'gone/x', { providerId: 'custom:tts-box', modelId: 'tts-1' })).toBe('custom:tts-box/tts-1');
    expect(initialModelKey(options, null, { providerId: 'elevenlabs', modelId: 'eleven_multilingual_v2' })).toBe('openai/gpt-4o-mini-tts');
    expect(initialModelKey(options.slice(2), null, null)).toBe('elevenlabs/eleven_multilingual_v2');
    expect(initialModelKey([], null, null)).toBeNull();
    expect(findOption(options, 'custom:tts-box/tts-1')?.modelId).toBe('tts-1');
    expect(parseModelKey('custom:tts-box/models/tts-1')).toEqual({ providerId: 'custom:tts-box', modelId: 'models/tts-1' });
  });
});

describe('local models', () => {
  it('all local provider models are listed: installed ones are usable, uninstalled ones say \'not downloaded\'; listed after cloud', () => {
    const view = withLocalSpeech();
    const local = localModelOptions(view, 'synthesizeSpeech');
    expect(local.map((o) => [o.key, o.local, o.usable, o.why])).toEqual([
      ['local/kokoro-82m', true, true, null],
      ['local/index-tts2', true, false, localNotDownloaded()],
    ]);
    const all = modelOptions(view, 'synthesizeSpeech');
    expect(all.slice(-2).map((o) => o.key)).toEqual(['local/kokoro-82m', 'local/index-tts2']);
    expect(all.filter((o) => !o.local).length).toBeGreaterThan(0);
    // Text generation has no local provider.
    expect(localModelOptions(view, 'generateText')).toEqual([]);
  });

  it('selected local model not installed: switches to the first installed local model in the menu (cloud does not count); null if none', () => {
    const options = modelOptions(withLocalSpeech(), 'synthesizeSpeech');
    const missing = findOption(options, 'local/index-tts2');
    expect(installedAlternative(options, missing)?.key).toBe('local/kokoro-82m');
    expect(installedAlternative(options, findOption(options, 'local/kokoro-82m'))).toBeNull();
    expect(installedAlternative(options.filter((o) => o.key !== 'local/kokoro-82m'), missing)).toBeNull();
  });
});

describe('language', () => {
  it('Chinese names; unrestricted lists common languages; primary-language subtag matching', () => {
    expect(langName('zh')).toBe('中文');
    expect(languageOptions('any')[0]).toEqual({ key: '', label: '自动' });
    expect(languageOptions('any').map((o) => o.key)).toContain('ja');
    expect(languageOptions(['en', 'fr']).map((o) => o.key)).toEqual(['', 'en', 'fr']);
    expect(speaks(['en', 'zh-CN'], 'zh')).toBe(true);
    expect(speaks(['en'], 'zh-TW')).toBe(false);
    expect(speaks('any', 'xx')).toBe(true);
  });

  it('roughly detects the language by characters', () => {
    expect(detectLang('こんにちは')).toBe('ja');
    expect(detectLang('안녕하세요')).toBe('ko');
    expect(detectLang('你好 CucCut')).toBe('zh');
    expect(detectLang('Hello')).toBe('en');
    expect(detectLang('123 !')).toBeNull();
  });

  it('short language names and provider names in the language list', () => {
    expect(languagesShort('any')).toBe('多种语言');
    expect(languagesShort(['zh', 'en'])).toBe('中文、英语');
    expect(languagesShort(['zh', 'en', 'ja', 'ko'])).toBe('中文、英语等 4 种');
    expect(providerName(fixtureView(), 'synthesizeSpeech', 'custom:tts-box')).toBe('TTS Box');
    expect(providerName(fixtureView(), 'synthesizeSpeech', 'custom:gone')).toBe('custom:gone');
    expect(providerName(null, 'generateImage', 'openai')).toBe('openai');
  });

  it('code point count and seed', () => {
    expect(codePoints('a😀中')).toBe(3);
    expect(parseSeed('')).toEqual({ ok: true, seed: null });
    expect(parseSeed(' 42 ')).toEqual({ ok: true, seed: 42 });
    expect(parseSeed('4.2').ok).toBe(false);
    expect(parseSeed('-1').ok).toBe(false);
    expect(parseSeed('99999999999999999999').ok).toBe(false);
  });
});
