import { describe, expect, it } from 'vitest';
import type { ModelApiAlias } from '@cuccut/protocol';
import { fixtureView } from './models-test-fixtures.ts';
import {
  aliasNameError,
  aliasTargets,
  aliasView,
  API_ENDPOINTS,
  capabilityLine,
  formatBytes,
  routable,
  routableModelCount,
  targetKey,
  withToken,
} from './services-api.ts';

const LOCAL_ONLY = { online: false, nodes: false, agent: false };
const ONLINE = { online: true, nodes: false, agent: false };
const whisper: ModelApiAlias = { alias: 'whisper-1', capability: 'transcribe', providerId: 'local', modelId: null };

describe('endpoint catalog', () => {
  it('the three query entries come first, and each of the four capabilities generates one endpoint', () => {
    expect(API_ENDPOINTS.filter((e) => e.capability === null).map((e) => e.path)).toEqual(['/models', '/models/{model}', '/cuccut/info']);
    expect(API_ENDPOINTS.filter((e) => e.capability).map((e) => `${e.method} ${e.path}`)).toEqual([
      'POST /audio/transcriptions',
      'POST /audio/speech',
      'POST /images/generations',
      'POST /chat/completions',
    ]);
  });
});

describe('routing', () => {
  it('this machine is always listed; online, nodes and agents must each be turned on separately', () => {
    expect(routable('local', LOCAL_ONLY)).toBe(true);
    expect(routable('online', LOCAL_ONLY)).toBe(false);
    expect(routable('online', ONLINE)).toBe(true);
    expect(routable('node', { ...LOCAL_ONLY, nodes: true })).toBe(true);
    expect(routable('agent', ONLINE)).toBe(false);
  });

  it('how many models each capability can route to: counts only available models with routing turned on', () => {
    const view = fixtureView();
    expect(routableModelCount(view, 'transcribe', LOCAL_ONLY)).toBe(1);
    // Two OpenAI + one ASR Box; Google being unavailable doesn't count.
    expect(routableModelCount(view, 'transcribe', ONLINE)).toBe(4);
    expect(capabilityLine(view, 'transcribe', LOCAL_ONLY)).toBe('1 个模型可用');
  });

  it('when no model can be routed, say whether routing is off or there are none at all', () => {
    const view = fixtureView();
    expect(capabilityLine(view, 'synthesizeSpeech', LOCAL_ONLY)).toBe('有可用的模型，但它们所在的那一类还没有打开路由；现在请求会得到 503');
    expect(capabilityLine(view, 'generateText', ONLINE)).toBe('还没有可用的模型；现在请求会得到 503');
  });
});

describe('alias table', () => {
  it('one row: capability → provider · model; the default model is written as "default model"', () => {
    expect(aliasView(whisper, fixtureView(), LOCAL_ONLY)).toEqual({
      alias: 'whisper-1',
      capability: '转录',
      target: '本机 · 默认模型',
      usable: true,
      why: null,
    });
  });

  it('when the target has routing off, is not found, or the model is missing, says what the request will get', () => {
    const view = fixtureView();
    const tts: ModelApiAlias = { alias: 'tts-1', capability: 'synthesizeSpeech', providerId: 'openai', modelId: 'gpt-4o-mini-tts' };
    expect(aliasView(tts, view, LOCAL_ONLY)).toMatchObject({ target: 'OpenAI · gpt-4o-mini-tts', usable: false, why: '这一类还没有打开路由，请求会得到 404' });
    expect(aliasView(tts, view, ONLINE)).toMatchObject({ usable: true, why: null });
    expect(aliasView({ ...tts, providerId: 'gone' }, view, ONLINE)).toMatchObject({ target: 'gone · gpt-4o-mini-tts', usable: false });
    expect(aliasView({ ...tts, modelId: 'nope' }, view, ONLINE)).toMatchObject({ usable: false, why: '这个模型现在不可用' });
    expect(aliasView({ ...tts, capability: 'synthesizeSpeech', providerId: 'elevenlabs', modelId: null }, view, ONLINE)).toMatchObject({
      usable: false,
      why: '这个服务商现在不可用',
    });
  });

  it('while the model view has not loaded yet, writes the target as-is and draws no conclusion', () => {
    expect(aliasView(whisper, null, LOCAL_ONLY)).toEqual({ alias: 'whisper-1', capability: '转录', target: 'local · 默认模型', usable: true, why: null });
  });

  it('targets when adding: each provider lists a \'default model\' entry first, then each model; models that cannot be routed carry a note', () => {
    const targets = aliasTargets(fixtureView(), 'transcribe', LOCAL_ONLY);
    expect(targets[0]).toEqual({ key: targetKey('local', null), providerId: 'local', modelId: null, label: '本机 · 默认模型', note: null });
    expect(targets[1]?.modelId).toBe('qwen3-asr-0.6b@mlx-4bit');
    expect(targets.find((t) => t.providerId === 'openai')?.note).toBe('没打开路由');
    expect(aliasTargets(fixtureView(), 'transcribe', ONLINE).find((t) => t.providerId === 'google')?.note).toBe('现在不可用');
  });

  it('name validation follows the same rules as the protocol; duplicate names are reported directly', () => {
    expect(aliasNameError('', [])).toBe('填一个名字，比如 whisper-1');
    expect(aliasNameError('openai/whisper-1', [])).toBe('名字里不能有「/」：<服务商>/<模型> 是规范写法，别名不能和它撞');
    expect(aliasNameError('-x', [])).toBe('名字只能用字母、数字与 . _ : -，并且以字母或数字开头');
    expect(aliasNameError('中文', [])).toBe('名字只能用字母、数字与 . _ : -，并且以字母或数字开头');
    expect(aliasNameError('a'.repeat(101), [])).toBe('名字只能用字母、数字与 . _ : -，并且以字母或数字开头');
    expect(aliasNameError(' gpt-4o:mini_1.0 ', [])).toBeNull();
    expect(aliasNameError('whisper-1', [whisper])).toBe('已经有「whisper-1」了；要改目标，先删掉那一行');
  });
});

describe('tokens and fragments', () => {
  it('replaces only placeholders without a client name; every occurrence in the fragment is replaced', () => {
    const snippet = `OPENAI_API_KEY=<令牌>\nAuthorization: Bearer <令牌>`;
    expect(withToken(snippet, 'tok')).toBe('OPENAI_API_KEY=tok\nAuthorization: Bearer tok');
    // Runtime writes its placeholders in its own language, regardless of the UI language.
    expect(withToken('OPENAI_API_KEY=<token>', 'tok')).toBe('OPENAI_API_KEY=tok');
    expect(withToken('<Claude 的令牌>', 'tok')).toBe('<Claude 的令牌>');
  });

  it('byte counts are rounded to a suitable unit', () => {
    expect(formatBytes(256 * 1024 * 1024)).toBe('256 MB');
    expect(formatBytes(8 * 1024 * 1024)).toBe('8 MB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(12)).toBe('12 B');
  });
});
