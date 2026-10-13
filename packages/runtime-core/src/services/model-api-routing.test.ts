import { describe, expect, it } from 'vitest';
import type { ModelApiAlias, ModelApiRouting, ModelCapabilitiesView, ProviderKind } from '@cuccut/protocol';
import { ApiError } from './model-api-errors.ts';
import { chatRequest } from './model-api-openai.ts';
import { listModels, resolveModel } from './model-api-routing.ts';

/** Routing and parameter mapping of the model API service (does not need the Runtime): node and agent switches, the three ways of writing a name, chat parameters. */

function provider(providerId: string, kind: ProviderKind, models: string[], available = true) {
  return { providerId, kind, label: providerId, config: null, available, models: models.map((modelId) => ({ modelId, available: true })) };
}

const VIEW = {
  transcribe: {
    default: null,
    effective: null,
    providers: [provider('local', 'local', ['qwen3-asr']), provider('node:studio', 'node', ['qwen3-asr'])],
  },
  synthesizeSpeech: { default: null, effective: null, providers: [provider('openai', 'online', ['tts-1'])] },
  generateImage: { default: null, effective: null, providers: [provider('openai', 'online', ['gpt-image-1'], false)] },
  generateText: {
    default: null,
    effective: null,
    providers: [provider('codex', 'agent', ['gpt-6']), provider('openai', 'online', ['gpt-6'])],
  },
} as unknown as ModelCapabilitiesView;

const ALIASES: ModelApiAlias[] = [{ alias: 'whisper-1', capability: 'transcribe', providerId: 'local', modelId: null }];
const OFF: ModelApiRouting = { online: false, nodes: false, agent: false };

function failure(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('应当失败');
}

describe('model API service routing', () => {
  it('each switch only enables its own category; unavailable providers are not listed', () => {
    expect(listModels(VIEW, OFF, ALIASES).map((m) => m.id)).toEqual(['whisper-1', 'local/qwen3-asr']);
    expect(listModels(VIEW, { ...OFF, nodes: true }, ALIASES).map((m) => m.id)).toEqual([
      'whisper-1',
      'local/qwen3-asr',
      'node:studio/qwen3-asr',
    ]);
    expect(listModels(VIEW, { ...OFF, agent: true }, ALIASES).map((m) => m.id)).toEqual(['whisper-1', 'local/qwen3-asr', 'codex/gpt-6']);
    expect(listModels(VIEW, { ...OFF, online: true }, ALIASES).map((m) => m.id)).toEqual([
      'whisper-1',
      'local/qwen3-asr',
      'openai/tts-1',
      'openai/gpt-6',
    ]);
  });

  it('names: aliases, `<providerId>/<modelId>`, bare model name (takes first routable in view order)', () => {
    const all = { online: true, nodes: true, agent: true };
    expect(resolveModel('whisper-1', 'transcribe', VIEW, OFF, ALIASES)).toEqual({ providerId: 'local', modelId: null });
    expect(resolveModel('node:studio/qwen3-asr', 'transcribe', VIEW, all, ALIASES)).toEqual({
      providerId: 'node:studio',
      modelId: 'qwen3-asr',
    });
    expect(resolveModel('gpt-6', 'generateText', VIEW, all, ALIASES)).toEqual({ providerId: 'codex', modelId: 'gpt-6' });
    expect(resolveModel('gpt-6', 'generateText', VIEW, { ...OFF, online: true }, ALIASES)).toEqual({
      providerId: 'openai',
      modelId: 'gpt-6',
    });

    // Switch off: a request by name for a model of that kind is 404; when the capability has no routable model at all, 503.
    expect(failure(() => resolveModel('node:studio/qwen3-asr', 'transcribe', VIEW, OFF, ALIASES))).toMatchObject({
      status: 404,
      code: 'MODEL_NOT_FOUND',
    });
    expect(failure(() => resolveModel('codex/gpt-6', 'generateText', VIEW, OFF, ALIASES))).toMatchObject({
      status: 503,
      code: 'CAPABILITY_NOT_CONFIGURED',
    });
    // Alias with the wrong capability, or provider unavailable: 404 / 503.
    expect(failure(() => resolveModel('whisper-1', 'generateText', VIEW, all, ALIASES))).toMatchObject({ status: 404 });
    expect(failure(() => resolveModel('openai/gpt-image-1', 'generateImage', VIEW, all, ALIASES))).toMatchObject({ status: 503 });
  });
});

describe('chat parameter mapping', () => {
  it('developer → system, text fragments joined; max_completion_tokens takes precedence; temperature, seed, reasoning_effort and json_object', () => {
    const { request, stream, includeUsage } = chatRequest({
      model: 'x',
      messages: [
        { role: 'developer', content: '简短' },
        {
          role: 'user',
          content: [
            { type: 'text', text: '你' },
            { type: 'text', text: '好' },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
      max_completion_tokens: 20,
      seed: 7,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      user: 'ignored',
    });
    expect(request).toEqual({
      messages: [
        { role: 'system', content: '简短' },
        { role: 'user', content: '你好' },
      ],
      responseFormat: { type: 'json', schema: { type: 'object' } },
      maxOutputTokens: 20,
      temperature: 0.3,
      effort: 'low',
      seed: 7,
    });
    expect({ stream, includeUsage }).toEqual({ stream: false, includeUsage: false });
    expect(chatRequest({ messages: [{ role: 'user', content: 'a' }], max_tokens: 5 }).request.maxOutputTokens).toBe(5);
    expect(failure(() => chatRequest({ messages: [{ role: 'tool', content: 'a' }] }))).toMatchObject({ code: 'UNSUPPORTED_PARAMETER' });
    expect(failure(() => chatRequest({ messages: [{ role: 'user', content: [{ type: 'image_url' }] }] }))).toMatchObject({
      code: 'UNSUPPORTED_PARAMETER',
    });
  });
});
