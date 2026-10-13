import type { SpeechModelInfo } from '@cuccut/protocol';
import { describe, expect, it } from 'vitest';
import {
  addModelRequest,
  capabilityCategory,
  categoryCapability,
  cloudDefaultPicker,
  cloudProviders,
  connectRequest,
  customDraftReady,
  customProviderId,
  customProviderRequest,
  declaredModels,
  defaultKey,
  disconnectRequest,
  endpointOwner,
  isEndpointUrl,
  modelIdTaken,
  newDeclaredModel,
  parseDefaultKey,
  parseVoiceIds,
  providerConnected,
  refreshAfterKey,
  refreshKind,
  refreshLine,
  voiceCount,
  type CloudProviderCard,
} from './models-cloud.ts';
import { fixtureView, speechModel } from './models-test-fixtures.ts';

const COPY = { none: '每次选择', noneDesc: '不设默认', codex: 'Codex CLI · 画图', codexDesc: '用你的 Codex 订阅', unavailable: '不可用' };

describe('categoryCapability', () => {
  it('only speech recognition, speech synthesis and image generation have model service capability', () => {
    expect(categoryCapability('asr')).toBe('transcribe');
    expect(categoryCapability('tts')).toBe('synthesizeSpeech');
    expect(categoryCapability('image')).toBe('generateImage');
    expect(categoryCapability('llm')).toBe('generateText');
    expect(categoryCapability('sep')).toBeNull();
    expect(categoryCapability('vision')).toBeNull();
    for (const category of ['asr', 'tts', 'llm', 'image'] as const) expect(capabilityCategory(categoryCapability(category)!)).toBe(category);
  });
});

describe('providerConnected', () => {
  it('built-in ones must be enabled and have a key; self-hosted ones must be enabled and have an address', () => {
    expect(providerConnected('openai', { enabled: true, enabledAt: null, credential: 'set' })).toBe(true);
    expect(providerConnected('openai', { enabled: true, enabledAt: null, credential: 'missing' })).toBe(false);
    expect(providerConnected('openai', { enabled: false, enabledAt: null, credential: 'set' })).toBe(false);
    expect(providerConnected('custom:a', { enabled: true, enabledAt: null, credential: 'missing', endpoint: 'http://x' })).toBe(true);
    expect(providerConnected('custom:a', { enabled: true, enabledAt: null, credential: 'set' })).toBe(false);
    expect(providerConnected('openai', null)).toBe(false);
  });
});

describe('cloudProviders', () => {
  it('built-in ones appear only in tiers with that capability; agents and local are not providers; connected ones come first', () => {
    const cards = cloudProviders(fixtureView(), 'generateImage');
    expect(cards.map((c) => c.providerId)).toEqual(['openai', 'custom:asr-box', 'custom:tts-box', 'google']);
    expect(cards.find((c) => c.providerId === 'openai')!.models.map((m) => m.modelId)).toEqual(['gpt-image-1']);
  });

  it('self-hosted providers appear in every tier: when a tier is not declared, the model is empty and the tier is unavailable', () => {
    const cards = cloudProviders(fixtureView(), 'synthesizeSpeech');
    const asr = cards.find((c) => c.providerId === 'custom:asr-box')!;
    expect(asr).toMatchObject({ custom: true, connected: true, models: [], available: false, capabilities: ['transcribe'] });
    expect(asr.endpoint).toBe('https://api.example.com/v1');
    const tts = cards.find((c) => c.providerId === 'custom:tts-box')!;
    expect(tts).toMatchObject({ available: true, capabilities: ['synthesizeSpeech'] });
    expect(cards.some((c) => c.providerId === 'google')).toBe(false);
  });

  it('capability list for the key dialog: built-in ones follow the tiers that appear in the view', () => {
    const openai = cloudProviders(fixtureView(), 'transcribe').find((c) => c.providerId === 'openai')!;
    expect(openai.capabilities).toEqual(['transcribe', 'synthesizeSpeech', 'generateImage']);
    const google = cloudProviders(fixtureView(), 'transcribe').find((c) => c.providerId === 'google')!;
    expect(google).toMatchObject({ connected: false, capabilities: ['transcribe', 'generateImage'], unavailableReason: 'not-configured' });
  });
});

describe('self-hosted provider model declarations', () => {
  it('restore declarations from the view: include limit and voice; not written when label and ID are the same', () => {
    expect(declaredModels(fixtureView(), 'custom:tts-box')).toEqual([
      { modelId: 'tts-1', label: '中文女声', capability: 'synthesizeSpeech', voices: ['zh-female'], maxInputChars: 4096, formats: ['mp3'] },
    ]);
    expect(declaredModels(fixtureView(), 'custom:asr-box')).toEqual([
      {
        modelId: 'whisper-large',
        capability: 'transcribe',
        maxInputBytes: 25 * 1024 * 1024,
        maxDurationSec: null,
        wordTimestamps: 'native',
        acceptsHint: true,
      },
    ]);
  });

  it('when adding a model, the existing declarations are carried over as a whole (models is replaced as a whole)', () => {
    const request = addModelRequest(fixtureView(), 'custom:tts-box', newDeclaredModel(' flux-dev ', 'generateImage'));
    expect(request.providerId).toBe('custom:tts-box');
    expect(request.models!.map((m) => [m.modelId, m.capability])).toEqual([
      ['tts-1', 'synthesizeSpeech'],
      ['flux-dev', 'generateImage'],
    ]);
    expect(request).not.toHaveProperty('enabled');
  });

  it('model IDs are deduplicated regardless of purpose', () => {
    expect(modelIdTaken(fixtureView(), 'custom:tts-box', 'tts-1')).toBe(true);
    expect(modelIdTaken(fixtureView(), 'custom:tts-box', ' tts-1 ')).toBe(true);
    expect(modelIdTaken(fixtureView(), 'custom:tts-box', 'tts-2')).toBe(false);
  });

  it('voice IDs separated by commas, enumeration commas or whitespace, deduplicated; only speech synthesis has voices', () => {
    expect(parseVoiceIds('zh-female, zh-male，en、zh-female  x')).toEqual(['zh-female', 'zh-male', 'en', 'x']);
    expect(newDeclaredModel('tts-2', 'synthesizeSpeech', 'a, b')).toEqual({ modelId: 'tts-2', capability: 'synthesizeSpeech', voices: ['a', 'b'] });
    expect(newDeclaredModel('tts-2', 'synthesizeSpeech', '')).toEqual({ modelId: 'tts-2', capability: 'synthesizeSpeech' });
    expect(newDeclaredModel('w', 'transcribe', 'a')).toEqual({ modelId: 'w', capability: 'transcribe' });
  });
});

describe('add self-hosted provider', () => {
  it('ID uses the name first; if none can be derived, uses the hostname; a collision gets a number', () => {
    expect(customProviderId('My Box', 'https://x.dev/v1', new Set())).toBe('custom:my-box');
    expect(customProviderId('硅基流动', 'https://api.siliconflow.cn/v1', new Set())).toBe('custom:siliconflow');
    expect(customProviderId('本机', 'http://localhost:8000/v1', new Set())).toBe('custom:localhost-8000');
    expect(customProviderId('本机', 'http://192.168.1.5:8080', new Set())).toBe('custom:192-168-1-5-8080');
    expect(customProviderId('TTS Box', '', new Set(['custom:tts-box', 'custom:tts-box-2']))).toBe('custom:tts-box-3');
    expect(customProviderId('', 'not a url', new Set())).toBe('custom:provider');
    expect(customProviderId('x'.repeat(90), '', new Set())).toMatch(/^custom:[a-z0-9][a-z0-9-]{0,62}$/);
  });

  it('address duplicate check is case-insensitive and ignores a trailing slash', () => {
    expect(endpointOwner(fixtureView(), ' https://API.example.com/v1/ ')).toEqual({ providerId: 'custom:asr-box', label: 'ASR Box' });
    expect(endpointOwner(fixtureView(), 'https://api.example.com/v2')).toBeNull();
    expect(endpointOwner(fixtureView(), '')).toBeNull();
  });

  it('name, http(s) address and first model are required before submitting', () => {
    const draft = { name: 'Box', url: 'https://box.local/v1', modelId: 'm', capability: 'transcribe' as const, voiceIds: '' };
    expect(customDraftReady(draft)).toBe(true);
    expect(customDraftReady({ ...draft, url: 'box.local' })).toBe(false);
    expect(customDraftReady({ ...draft, name: ' ' })).toBe(false);
    expect(customDraftReady({ ...draft, modelId: '' })).toBe(false);
    expect(isEndpointUrl('ftp://x')).toBe(false);
  });

  it('only registers name, address and first model, does not enable (enabled on connection)', () => {
    const request = customProviderRequest(fixtureView(), {
      name: ' 语音盒子 ',
      url: 'https://voice.example.com/v1/ ',
      modelId: 'tts-x',
      capability: 'synthesizeSpeech',
      voiceIds: 'v1, v2',
    });
    expect(request).toEqual({
      providerId: 'custom:voice-example',
      label: '语音盒子',
      endpoint: 'https://voice.example.com/v1',
      models: [{ modelId: 'tts-x', capability: 'synthesizeSpeech', voices: ['v1', 'v2'] }],
    });
  });
});

describe('key', () => {
  it('save = enable and verify; self-hosted may leave the key empty', () => {
    expect(connectRequest('openai', ' sk-test ')).toEqual({ providerId: 'openai', enabled: true, verify: true, credential: 'sk-test' });
    expect(connectRequest('custom:box', '  ')).toEqual({ providerId: 'custom:box', enabled: true, verify: true });
  });

  it('removing the key of a built-in = clear it and disable', () => {
    expect(disconnectRequest('openai')).toEqual({ providerId: 'openai', enabled: false, credential: null });
  });
});

describe('default model menu', () => {
  it('key is providerId/modelId; modelId may contain slashes', () => {
    expect(defaultKey(null)).toBe('none');
    expect(defaultKey({ providerId: 'custom:or', modelId: 'openai/gpt-4o' })).toBe('custom:or/openai/gpt-4o');
    expect(parseDefaultKey('custom:or/openai/gpt-4o')).toEqual({ providerId: 'custom:or', modelId: 'openai/gpt-4o' });
    expect(parseDefaultKey('none')).toBeNull();
    expect(parseDefaultKey('broken')).toBeNull();
  });

  it('lists models of usable online providers; when no default is set, check "choose each time"', () => {
    const picker = cloudDefaultPicker(fixtureView(), 'synthesizeSpeech', null, COPY);
    expect(picker.selectedKey).toBe('none');
    expect(picker.empty).toBe(false);
    expect(picker.sections.map((s) => [s.title, s.items.map((i) => i.key)])).toEqual([
      [undefined, ['none']],
      ['OpenAI', ['openai/gpt-4o-mini-tts']],
      ['TTS Box', ['custom:tts-box/tts-1']],
    ]);
  });

  it('group keys and option keys must not collide (a collision in an S2 set crashes)', () => {
    const view = fixtureView();
    view.synthesizeSpeech.default = { providerId: 'custom:gone', modelId: 'tts-9' };
    const pickers = [
      cloudDefaultPicker(view, 'transcribe', null, COPY),
      cloudDefaultPicker(view, 'synthesizeSpeech', null, COPY),
      cloudDefaultPicker(view, 'generateImage', { ready: true, why: null }, COPY),
    ];
    for (const picker of pickers) {
      const itemKeys = new Set(picker.sections.flatMap((s) => s.items.map((i) => i.key)));
      expect(picker.sections.filter((s) => itemKeys.has(s.key))).toEqual([]);
    }
  });

  it('image tier: when Codex can draw, one extra item; if already default but cannot draw, still checked with the reason written', () => {
    const view = fixtureView();
    let picker = cloudDefaultPicker(view, 'generateImage', { ready: true, why: null }, COPY);
    expect(picker.sections.at(-1)!.items).toEqual([{ key: 'agent:codex/image-gen', label: 'Codex CLI · 画图', description: '用你的 Codex 订阅' }]);

    picker = cloudDefaultPicker(view, 'generateImage', { ready: false, why: 'Codex 还没有登录' }, COPY);
    expect(picker.sections.some((s) => s.key === 'codex')).toBe(false);

    view.generateImage.default = { providerId: 'agent:codex', modelId: 'image-gen' };
    picker = cloudDefaultPicker(view, 'generateImage', { ready: false, why: 'Codex 还没有登录' }, COPY);
    expect(picker.selectedKey).toBe('agent:codex/image-gen');
    expect(picker.sections.at(-1)!.items[0]).toMatchObject({ label: 'Codex CLI · 画图（不可用）', description: 'Codex 还没有登录' });
  });

  it('when the default points to an unavailable provider (e.g. a deleted self-hosted one), still listed and checked, not cleared on the user\'s behalf', () => {
    const view = fixtureView();
    view.synthesizeSpeech.default = { providerId: 'custom:gone', modelId: 'tts-9' };
    const picker = cloudDefaultPicker(view, 'synthesizeSpeech', null, COPY);
    expect(picker.selectedKey).toBe('custom:gone/tts-9');
    expect(picker.sections.at(-1)!.items).toEqual([{ key: 'custom:gone/tts-9', label: 'custom:gone · tts-9（不可用）' }]);
  });

  it('when the speech-recognition default is a local model, the cloud page checks the "no cloud default" item', () => {
    const view = fixtureView();
    view.transcribe.default = { providerId: 'local', modelId: 'qwen3-asr-0.6b@mlx-4bit' };
    expect(cloudDefaultPicker(view, 'transcribe', null, COPY).selectedKey).toBe('none');
    view.transcribe.default = { providerId: 'openai', modelId: 'whisper-1' };
    expect(cloudDefaultPicker(view, 'transcribe', null, COPY).selectedKey).toBe('openai/whisper-1');
  });

  it('when the speech-synthesis default is a local model, a separate item is checked; only "choose each time" clears the default', () => {
    const view = fixtureView();
    view.synthesizeSpeech.providers.unshift({
      providerId: 'local',
      kind: 'local',
      label: '本机',
      config: null,
      models: [speechModel('qwen3-tts-0.6b-base@mlx-8bit', [], { label: 'Qwen3-TTS 0.6B Base' })],
      available: true,
    });
    view.synthesizeSpeech.default = { providerId: 'local', modelId: 'qwen3-tts-0.6b-base@mlx-8bit' };
    const picker = cloudDefaultPicker(view, 'synthesizeSpeech', null, { ...COPY, localDesc: '在本地模型页设的' });
    expect(picker.selectedKey).toBe('local/qwen3-tts-0.6b-base@mlx-8bit');
    expect(picker.sections[1]).toEqual({
      key: 'local-default',
      items: [{ key: 'local/qwen3-tts-0.6b-base@mlx-8bit', label: '本机 · Qwen3-TTS 0.6B Base', description: '在本地模型页设的' }],
    });
    expect(picker.sections.some((s) => s.key === 'current')).toBe(false);
  });

  it('when nothing is connected, only "choose each time" remains', () => {
    const view = fixtureView();
    for (const p of view.generateImage.providers) p.available = false;
    expect(cloudDefaultPicker(view, 'generateImage', { ready: false, why: null }, COPY).empty).toBe(true);
    expect(cloudDefaultPicker(view, 'generateImage', { ready: true, why: null }, COPY).empty).toBe(false);
  });
});

describe('refresh model and voice catalog', () => {
  const voice = (voiceId: string) => ({ voiceId, label: voiceId });
  const speech = [
    { modelId: 'eleven_v3', label: 'v3', voices: [voice('rachel'), voice('adam')] },
    { modelId: 'eleven_flash', label: 'Flash', voices: [voice('adam')] },
  ] as Partial<SpeechModelInfo>[] as SpeechModelInfo[];
  const card = (patch: Partial<CloudProviderCard> = {}): CloudProviderCard => ({
    providerId: 'elevenlabs',
    label: 'ElevenLabs',
    custom: false,
    connected: true,
    endpoint: null,
    models: speech,
    capabilities: ['synthesizeSpeech'],
    available: true,
    ...patch,
  });

  it('text-generation tier refreshes models; speech-synthesis tier refreshes the voice catalog (not shown for OpenAI); recognition and image tiers have none', () => {
    expect(refreshKind(card({ providerId: 'openai' }), 'generateText')).toBe('models');
    expect(refreshKind(card({ providerId: 'custom:box', custom: true, models: [] }), 'generateText')).toBe('models');
    expect(refreshKind(card(), 'synthesizeSpeech')).toBe('voices');
    expect(refreshKind(card({ providerId: 'openai' }), 'synthesizeSpeech')).toBeNull();
    expect(refreshKind(card(), 'transcribe')).toBeNull();
    expect(refreshKind(card(), 'generateImage')).toBeNull();
  });

  it('voices deduplicated by ID', () => {
    expect(voiceCount(card().models)).toBe(2);
    expect(voiceCount([{ modelId: 'x', label: 'x' }])).toBe(0);
  });

  it('note line: ignored when not connected or no models; refreshing takes priority', () => {
    expect(refreshLine(card({ connected: false }), 'synthesizeSpeech', false)).toBeNull();
    expect(refreshLine(card({ models: [] }), 'synthesizeSpeech', false)).toBeNull();
    expect(refreshLine(card({ providerId: 'openai' }), 'synthesizeSpeech', false)).toBeNull();
    expect(refreshLine(card({ refreshed: { at: '2026-10-03T00:00:00Z', ok: false, error: '401' } }), 'synthesizeSpeech', true)).toEqual({
      state: 'refreshing',
      kind: 'voices',
    });
  });

  it('never refreshed means the built-in catalog; failures write the reason; after a refresh, count built-in models that cannot be found', () => {
    expect(refreshLine(card(), 'synthesizeSpeech', false)).toEqual({ state: 'builtin', kind: 'voices', models: 2, voices: 2 });
    expect(refreshLine(card({ refreshed: { at: '2026-10-03T00:00:00Z', ok: false, error: '401 · 密钥无效' } }), 'synthesizeSpeech', false)).toEqual({
      state: 'failed',
      kind: 'voices',
      error: '401 · 密钥无效',
    });
    const models = [
      { modelId: 'gpt-5', label: 'GPT-5', available: true },
      { modelId: 'gpt-4o', label: 'GPT-4o', available: false, detail: '这把密钥列不到' },
    ] as CloudProviderCard['models'];
    expect(refreshLine(card({ providerId: 'openai', models, refreshed: { at: '2026-10-03T00:00:00Z', ok: true, models: 40 } }), 'generateText', false)).toEqual(
      {
        state: 'fresh',
        kind: 'models',
        models: 2,
        voices: 0,
        unusable: 1,
        at: '2026-10-03T00:00:00Z',
      },
    );
  });

  it('after saving a key, refresh in passing: self-hosted or those with text generation', () => {
    expect(refreshAfterKey({ custom: true, capabilities: [] })).toBe(true);
    expect(refreshAfterKey({ custom: false, capabilities: ['transcribe', 'generateText'] })).toBe(true);
    expect(refreshAfterKey({ custom: false, capabilities: ['synthesizeSpeech'] })).toBe(false);
  });
});
