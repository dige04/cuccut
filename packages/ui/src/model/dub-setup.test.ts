import { describe, expect, it } from 'vitest';
import { RpcError, type DocumentRecord, type LibraryEntrySummary, type SpeechModelInfo } from '@cuccut/protocol';
import {
  clampDuckDb,
  defaultDubLanguage,
  dubLanguageOptions,
  dubParams,
  grantFacts,
  grantPurpose,
  grantRefusal,
  grantRequest,
  refusalKey,
  speakerRows,
  speechSpeakers,
  voiceChoices,
  withBinding,
  type DubSetup,
} from './dub-setup.ts';

const doc = (id: string, kind: string, extra: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id,
  kind,
  name: id,
  currentRevision: '1',
  revisions: {},
  ...extra,
});

const info = (extra: Partial<SpeechModelInfo> = {}): SpeechModelInfo =>
  ({
    modelId: 'tts-1',
    voices: [
      { voiceId: 'alloy', label: 'Alloy' },
      { voiceId: 'nova', label: 'Nova' },
    ],
    defaultVoice: 'alloy',
    voiceModes: ['preset'],
    languages: 'any',
    maxInputChars: 4096,
    formats: ['mp3'],
    defaultFormat: 'mp3',
    acceptsInstructions: false,
    speedRange: null,
    acceptsSeed: false,
    ...extra,
  }) as unknown as SpeechModelInfo;

const entry = (id: string, extra: Partial<LibraryEntrySummary> = {}): LibraryEntrySummary => ({
  library: 'voices',
  id,
  version: 1,
  contentHash: 'h',
  name: `声音 ${id}`,
  kind: 'voice',
  updatedAt: '2026-01-01T00:00:00Z',
  consentDeclared: true,
  clones: [{ providerId: 'elevenlabs', state: 'valid' }],
  ...extra,
});

describe('which language to set up', () => {
  it('lists existing translations first, then languages to translate first; languages with existing translations are not listed again, and the same language as the source cannot be selected', () => {
    const options = dubLanguageOptions('zh', [doc('t-en', 'translation', { language: 'en', name: '英文译文' })]);
    expect(options[0]).toMatchObject({ key: 'doc:t-en', language: 'en', translationId: 't-en', disabled: null });
    expect(options.some((o) => o.key === 'lang:en')).toBe(false);
    expect(options.find((o) => o.key === 'lang:zh-Hans')?.disabled).toBe('和原文同一种语言');
    expect(options.find((o) => o.key === 'lang:ja')).toMatchObject({ translationId: null, disabled: null });
  });

  it('defaults to the first existing translation; otherwise Chinese pairs with English, and others pair with Simplified Chinese', () => {
    expect(defaultDubLanguage(dubLanguageOptions('zh', [doc('t-ja', 'translation', { language: 'ja' })]), 'zh')).toBe('doc:t-ja');
    expect(defaultDubLanguage(dubLanguageOptions('zh-CN', []), 'zh-CN')).toBe('lang:en');
    expect(defaultDubLanguage(dubLanguageOptions('en', []), 'en')).toBe('lang:zh-Hans');
  });
});

describe('dubParams', () => {
  const setup: DubSetup = {
    videoId: 'v1',
    speechDocumentId: 'speech',
    translationId: null,
    targetLanguage: 'en',
    voiceModel: { providerId: 'openai', modelId: 'tts-1' },
    voice: null,
    textModel: { providerId: 'anthropic', modelId: 'claude' },
    style: '  口语化  ',
    originalAudio: 'duck',
    duckDb: 12.4,
    separateBackground: false,
  };

  it('translate first: passes source, target language, style and text model; duck includes the rounded duckDb; not passed when separation is off', () => {
    expect(dubParams(setup)).toEqual({
      videoId: 'v1',
      provider: 'openai',
      model: 'tts-1',
      originalAudio: 'duck',
      duckDb: 12,
      documentId: 'speech',
      targetLanguage: 'en',
      style: '口语化',
      textProvider: 'anthropic',
      textModel: 'claude',
    });
  });

  it('use existing translation: only translationId is passed, not target language, source, style or text model', () => {
    const params = dubParams({ ...setup, translationId: 't-en', voice: ' nova ', originalAudio: 'mute' });
    expect(params).toEqual({ videoId: 'v1', provider: 'openai', model: 'tts-1', voice: 'nova', originalAudio: 'mute', translationId: 't-en' });
    expect(params).not.toHaveProperty('separateBackground');
    expect(params).not.toHaveProperty('duckDb');
  });

  it('passes separateBackground: true when separation is on (same as the CLI\'s --separate-background)', () => {
    expect(dubParams({ ...setup, separateBackground: true, originalAudio: 'mute' })).toMatchObject({
      originalAudio: 'mute',
      separateBackground: true,
    });
    expect(dubParams({ ...setup, separateBackground: true })).toMatchObject({ originalAudio: 'duck', separateBackground: true });
  });

  it('provider/model are not passed for the default model; duckDb is clamped to 1–60', () => {
    const params = dubParams({ ...setup, voiceModel: null, textModel: null, style: '', duckDb: 99 });
    expect(params).toEqual({ videoId: 'v1', originalAudio: 'duck', duckDb: 60, documentId: 'speech', targetLanguage: 'en' });
    expect(clampDuckDb(0)).toBe(1);
    expect(clampDuckDb(Number.NaN)).toBe(18);
  });
});

describe('speakers and voices', () => {
  const body = {
    schema: 'cuccut.speech/1',
    speakers: [
      { id: 'S1', name: '主持人' },
      { id: 'S2', name: '嘉宾' },
      { id: 'S3', name: '没说话的' },
    ],
    words: [
      { id: 'w1', start: 0, end: 1, text: '你好。', speaker: 'S1' },
      { id: 'w2', start: 1, end: 2, text: '欢迎。', speaker: 'S2' },
      { id: 'w3', start: 2, end: 3, text: '谢谢。', speaker: 'S2' },
      { id: 'w4', start: 3, end: 4, text: '再见。', speaker: 'S9' },
    ],
  };

  it('lists speakers and their sentence counts in transcript order; unregistered names are shown as IDs', () => {
    expect(speechSpeakers(body)).toEqual([
      { speakerId: 'S1', name: '主持人', sentences: 1 },
      { speakerId: 'S2', name: '嘉宾', sentences: 2 },
      { speakerId: 'S9', name: 'S9', sentences: 1 },
    ]);
    expect(speechSpeakers({ schema: 'cuccut.caption/1' })).toEqual([]);
  });

  it('effective voice: binding → voice parameter → model default; another provider\'s preset binding is not used; when a library voice cannot be used, the reason is given', () => {
    const library = [entry('a'), entry('b', { consentDeclared: false })];
    const rows = speakerRows({
      speakers: speechSpeakers(body),
      bindings: [
        { documentId: 'speech', speakerId: 'S1', voice: 'nova', providerId: 'openai' },
        { documentId: 'speech', speakerId: 'S2', voice: 'x', providerId: 'elevenlabs' },
        { documentId: 'speech', speakerId: 'S9', voice: 'library:b' },
        { documentId: 'other', speakerId: 'S2', voice: 'library:a' },
      ],
      documentId: 'speech',
      providerId: 'openai',
      providerLabel: 'OpenAI',
      voice: null,
      info: info(),
      library,
    });
    expect(rows.map((r) => [r.speakerId, r.effective, r.bindingIgnored, r.warning])).toEqual([
      ['S1', { label: 'Nova', source: 'video' }, false, null],
      ['S2', { label: '模型默认 · Alloy', source: 'default' }, true, null],
      ['S9', { label: '声音 b', source: 'video' }, false, '没有本人声明，不会上传给服务商'],
    ]);
    const withVoice = speakerRows({
      speakers: [{ speakerId: 'S2', name: '嘉宾', sentences: 2 }],
      bindings: [],
      documentId: 'speech',
      providerId: 'openai',
      providerLabel: 'OpenAI',
      voice: 'library:a',
      info: info(),
      library,
    });
    expect(withVoice[0]).toMatchObject({ effective: { label: '声音 a', source: 'params' }, warning: '还没在 OpenAI 上克隆' });
  });

  it('in the voice parameter dropdown, library voices that cannot be used cannot be selected; the binding dropdown can bind first', () => {
    const library = [entry('a'), entry('c', { clones: [{ providerId: 'elevenlabs', state: 'stale' }] })];
    const params = voiceChoices({ info: info(), providerId: 'elevenlabs', providerLabel: 'ElevenLabs', library, defaultLabel: '模型默认', forParams: true });
    expect(params.map((c) => [c.key, c.disabled])).toEqual([
      ['default', null],
      ['preset:alloy', null],
      ['preset:nova', null],
      ['library:a', null],
      ['library:c', 'ElevenLabs 上的克隆已过期，要重新克隆'],
    ]);
    const binding = voiceChoices({ info: info(), providerId: 'elevenlabs', providerLabel: 'ElevenLabs', library, defaultLabel: '不绑定', forParams: false });
    expect(binding.find((c) => c.key === 'library:c')?.disabled).toBeNull();
    expect(binding.find((c) => c.key === 'preset:nova')).toMatchObject({ voice: 'nova', providerId: 'elevenlabs' });
  });

  it('editing a binding: replace in place, remove, or append; library voices do not carry providerId', () => {
    const bindings = [
      { documentId: 'speech', speakerId: 'S1', voice: 'nova', providerId: 'openai' },
      { documentId: 'other', speakerId: 'S1', voice: 'alloy' },
    ];
    expect(withBinding(bindings, 'speech', 'S1', { voice: 'library:a', providerId: 'openai' })).toEqual([
      { documentId: 'speech', speakerId: 'S1', voice: 'library:a' },
      { documentId: 'other', speakerId: 'S1', voice: 'alloy' },
    ]);
    expect(withBinding(bindings, 'speech', 'S1', null)).toEqual([{ documentId: 'other', speakerId: 'S1', voice: 'alloy' }]);
    expect(withBinding(bindings, 'speech', 'S2', { voice: 'alloy', providerId: 'openai' })).toEqual([
      ...bindings,
      { documentId: 'speech', speakerId: 'S2', voice: 'alloy', providerId: 'openai' },
    ]);
  });
});

describe('grants', () => {
  const refusal = new RpcError('forbidden', '没有授权把文稿与译文交给 OpenAI', {
    code: 'GRANT_REQUIRED',
    recipient: 'openai',
    dataKinds: ['transcript'],
    videoId: 'v1',
    remedy: { action: 'create-grant', hint: '发放一条外发授权后重试', commands: ['cuccut grants create --recipient openai'] },
  });

  it('reads the recipient, data kind, video and remedy from GRANT_REQUIRED; other rejections do not count', () => {
    expect(grantRefusal(refusal)).toEqual({
      code: 'GRANT_REQUIRED',
      message: '没有授权把文稿与译文交给 OpenAI',
      recipient: 'openai',
      dataKinds: ['transcript'],
      videoId: 'v1',
      hint: '发放一条外发授权后重试',
      commands: ['cuccut grants create --recipient openai'],
    });
    expect(grantRefusal(new RpcError('forbidden', 'x', { code: 'BUDGET_EXCEEDED' }))).toBeNull();
    expect(grantRefusal(new RpcError('forbidden', 'x', { code: 'GRANT_REQUIRED', recipient: 'openai', remedy: { action: 'other' } }))).toBeNull();
    expect(grantRefusal(new Error('boom'))).toBeNull();
    // A failure in the task record (not an RpcError) also counts.
    expect(grantRefusal({ message: 'x', details: { code: 'GRANT_REVOKED', recipient: 'p', dataKinds: [], remedy: { action: 'create-grant' } } })).toMatchObject(
      {
        code: 'GRANT_REVOKED',
        dataKinds: ['transcript'],
      },
    );
  });

  it('the issued grant: transcript, the recipient as rejected, limited to this video, the purpose, counted per use with no amount cap', () => {
    const parsed = grantRefusal(refusal)!;
    const purpose = grantPurpose('en', '访谈');
    expect(purpose).toBe('翻译配音：把「访谈」配成英语');
    const request = grantRequest(parsed, 'v-fallback', purpose);
    expect(request).toEqual({
      dataKinds: ['transcript'],
      recipient: 'openai',
      scope: { videoId: 'v1' },
      purpose: '翻译配音：把「访谈」配成英语',
      budgetMode: 'per-call-unknown-cost',
    });
    expect(request).not.toHaveProperty('budgetCap');
    expect(grantRequest({ ...parsed, videoId: null }, 'v2', ` ${'长'.repeat(300)} `).purpose).toHaveLength(200);
    expect(grantRequest({ ...parsed, videoId: null }, 'v2', 'x').scope).toEqual({ videoId: 'v2' });
  });

  it('the confirmation dialog states what is sent, to whom, for which video and the purpose; the same recipient with the same data set counts as one rejection', () => {
    const facts = grantFacts(grantRefusal(refusal)!, new Map([['openai', 'OpenAI']]), '访谈', '翻译配音');
    expect(facts.map(([label]) => label)).toEqual(['外发什么', '交给谁', '范围', '用途', '预算', '撤销']);
    expect(facts[2]![1]).toBe('只限视频「访谈」');
    expect(facts[3]![1]).toBe('翻译配音');
    expect(refusalKey({ recipient: 'p', dataKinds: ['transcript', 'audio'] })).toBe(refusalKey({ recipient: 'p', dataKinds: ['audio', 'transcript'] }));
  });
});
