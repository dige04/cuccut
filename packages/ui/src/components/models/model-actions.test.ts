import { describe, expect, it, vi } from 'vitest';
import { RpcError } from '@cuccut/protocol';
import type { HostBridge } from '../../host.ts';
import { RuntimeSession } from '../../runtime/session.ts';
import { bundle, fixtureView, imageModel, speechModel, textModel } from '../../model/models-test-fixtures.ts';
import {
  addCustomProvider,
  addProviderModel,
  chooseCloudDefault,
  chooseLocalDefault,
  disconnectProvider,
  probeMediaUrl,
  saveProviderKey,
  setTextConcurrency,
  setTextEffort,
  startProbe,
} from './model-actions.ts';

/**
 * The model page commands run through a real `RuntimeSession` (with added thin methods); only `client.request` is replaced with a fake: it records the method and arguments, and returns a result by method.
 * No network and no Runtime connection: keys and verification both stop at this layer.
 */
function fakeSession(fail?: { method: string; error: Error }) {
  const session = new RuntimeSession({} as HostBridge);
  const calls: [string, unknown][] = [];
  vi.spyOn(session.client, 'request').mockImplementation((async (method: string, params: unknown) => {
    calls.push([method, params]);
    if (fail?.method === method) throw fail.error;
    switch (method) {
      case 'models.setDefault':
        return { default: (params as { providerId: string | null }).providerId ? { providerId: 'x', modelId: 'y' } : null };
      case 'models.configure':
        return { provider: { providerId: (params as { providerId: string }).providerId } };
      case 'models.removeProvider':
        return { removed: true };
      case 'models.enable':
        return { bundle: bundle((params as { bundleId: string }).bundleId) };
      case 'models.synthesizeSpeech':
      case 'models.generateImage':
      case 'models.generateText':
        return { jobId: 'job_9' };
      case 'models.setCapabilityParameters': {
        const p = params as { effort?: string | null; concurrency?: number | null };
        return { parameters: { effort: p.effort ?? null, concurrency: p.concurrency ?? 4 } };
      }
      case 'artifacts.openHandle':
        return { url: 'http://127.0.0.1:1/a/x', mimeType: 'audio/mpeg', size: 1, fileName: 'x.mp3', expiresAt: '' };
      default:
        throw new Error(`没有料到的调用 ${method}`);
    }
  }) as never);
  return { session, calls };
}

describe('key dialog', () => {
  it('save: enable with the key and verify once', async () => {
    const { session, calls } = fakeSession();
    await saveProviderKey(session, 'openai', ' sk-test-123 ');
    expect(calls).toEqual([['models.configure', { providerId: 'openai', enabled: true, verify: true, credential: 'sk-test-123' }]]);
  });

  it('a self-hosted one can be saved without a key: only enable and verify the address', async () => {
    const { session, calls } = fakeSession();
    await saveProviderKey(session, 'custom:box', '');
    expect(calls).toEqual([['models.configure', { providerId: 'custom:box', enabled: true, verify: true }]]);
  });

  it('verification fails: the error is rethrown as is, the dialog stays open and writes the reason', async () => {
    const error = new RpcError('conflict', '验证没有通过：401 · 密钥无效', { code: 'PROVIDER_AUTH', providerId: 'openai' });
    const { session } = fakeSession({ method: 'models.configure', error });
    await expect(saveProviderKey(session, 'openai', 'sk-bad')).rejects.toThrow('验证没有通过');
  });

  it('remove: built-in ones have the key cleared and are disabled, self-hosted ones are deleted', async () => {
    const { session, calls } = fakeSession();
    await disconnectProvider(session, 'openai');
    await disconnectProvider(session, 'custom:box');
    expect(calls).toEqual([
      ['models.configure', { providerId: 'openai', enabled: false, credential: null }],
      ['models.removeProvider', { providerId: 'custom:box' }],
    ]);
  });
});

describe('self-hosted providers and models', () => {
  it('add provider: register name, address and first model, return new ID', async () => {
    const { session, calls } = fakeSession();
    const id = await addCustomProvider(session, fixtureView(), {
      name: 'Image Box',
      url: 'https://img.example.com/v1',
      modelId: 'flux',
      capability: 'generateImage',
      voiceIds: '',
    });
    expect(id).toBe('custom:image-box');
    expect(calls).toEqual([
      [
        'models.configure',
        { providerId: 'custom:image-box', label: 'Image Box', endpoint: 'https://img.example.com/v1', models: [{ modelId: 'flux', capability: 'generateImage' }] },
      ],
    ]);
  });

  it('add model: existing declarations carried along', async () => {
    const { session, calls } = fakeSession();
    await addProviderModel(session, fixtureView(), 'custom:asr-box', { modelId: 'tts-x', capability: 'synthesizeSpeech', voices: ['a'] });
    const [, params] = calls[0] as [string, { models: { modelId: string }[] }];
    expect(params.models.map((m) => m.modelId)).toEqual(['whisper-large', 'tts-x']);
  });
});

describe('default model', () => {
  it('cloud: choosing a model = set as default; "choose each time" = clear', async () => {
    const { session, calls } = fakeSession();
    await chooseCloudDefault(session, 'generateImage', 'agent:codex/image-gen');
    await chooseCloudDefault(session, 'synthesizeSpeech', 'none');
    expect(calls).toEqual([
      ['models.setDefault', { capability: 'generateImage', providerId: 'agent:codex', modelId: 'image-gen' }],
      ['models.setDefault', { capability: 'synthesizeSpeech', providerId: null }],
    ]);
  });

  it('local: a previously disabled model pack is re-enabled before being set as default; a healthy one does not call enable', async () => {
    const { session, calls } = fakeSession();
    const bundles = [bundle('a@mlx', { state: 'error', reason: 'resource' }), bundle('b@mlx')];
    await chooseLocalDefault(session, 'a@mlx', bundles);
    await chooseLocalDefault(session, 'b@mlx', bundles);
    await chooseLocalDefault(session, 'auto', bundles);
    expect(calls).toEqual([
      ['models.enable', { bundleId: 'a@mlx' }],
      ['models.setDefault', { capability: 'transcribe', providerId: 'local', modelId: 'a@mlx' }],
      ['models.setDefault', { capability: 'transcribe', providerId: 'local', modelId: 'b@mlx' }],
      ['models.setDefault', { capability: 'transcribe', providerId: null }],
    ]);
  });
});

describe('text generation parameters', () => {
  it('reasoning effort: choosing a level passes that level; "auto" passes null', async () => {
    const { session, calls } = fakeSession();
    await setTextEffort(session, 'high');
    await setTextEffort(session, 'auto');
    expect(calls).toEqual([
      ['models.setCapabilityParameters', { capability: 'generateText', effort: 'high' }],
      ['models.setCapabilityParameters', { capability: 'generateText', effort: null }],
    ]);
  });

  it('concurrent requests: clamped to 1–32; not submitted when not a number', async () => {
    const { session, calls } = fakeSession();
    expect(await setTextConcurrency(session, 40)).toBe(true);
    expect(await setTextConcurrency(session, Number.NaN)).toBe(false);
    expect(calls).toEqual([['models.setCapabilityParameters', { capability: 'generateText', concurrency: 32 }]]);
  });

  it('rethrown as is when Runtime rejects', async () => {
    const { session } = fakeSession({ method: 'models.setCapabilityParameters', error: new Error('写不进去') });
    await expect(setTextEffort(session, 'low')).rejects.toThrow('写不进去');
  });
});

describe('test dialog', () => {
  it('synthesis and image generation each submit one task (with commandId), no video imported', async () => {
    const { session, calls } = fakeSession();
    expect(await startProbe(session, 'synthesizeSpeech', 'openai', speechModel('gpt-4o-mini-tts', ['alloy']))).toBe('job_9');
    expect(await startProbe(session, 'generateImage', 'openai', imageModel('gpt-image-1'))).toBe('job_9');
    expect(calls.map(([m]) => m)).toEqual(['models.synthesizeSpeech', 'models.generateImage']);
    for (const [, params] of calls) {
      expect(params).toHaveProperty('commandId');
      expect(params).not.toHaveProperty('videoId');
    }
    expect(calls[0]![1]).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini-tts', voice: 'alloy' });
    expect(calls[1]![1]).toMatchObject({ provider: 'openai', model: 'gpt-image-1', count: 1 });
  });

  it('text generation: one "Reply with OK.", with commandId, no output limit or reasoning effort given', async () => {
    const { session, calls } = fakeSession();
    expect(await startProbe(session, 'generateText', 'openai', textModel('gpt-5-mini'))).toBe('job_9');
    expect(calls).toHaveLength(1);
    const [method, params] = calls[0]!;
    expect(method).toBe('models.generateText');
    expect(params).toMatchObject({ messages: [{ role: 'user', content: 'Reply with OK.' }], provider: 'openai', model: 'gpt-5-mini' });
    expect(params).toHaveProperty('commandId');
    expect(params).not.toHaveProperty('effort');
    expect(params).not.toHaveProperty('maxOutputTokens');
  });

  it('speech recognition submits no task', async () => {
    const { session, calls } = fakeSession();
    await expect(startProbe(session, 'transcribe', 'openai', imageModel('whisper-1'))).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('restricted addresses for results', async () => {
    const { session, calls } = fakeSession();
    const url = await probeMediaUrl(session, {
      artifactId: 'sha256:aa',
      mediaType: 'audio/mpeg',
      byteLength: 1,
      assetId: null,
      media: { kind: 'audio', durationSec: 1, sampleRate: 24000, channels: 1 },
    });
    expect(url).toBe('http://127.0.0.1:1/a/x');
    expect(calls).toEqual([['artifacts.openHandle', { artifactId: 'sha256:aa' }]]);
  });
});
