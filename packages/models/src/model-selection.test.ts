import { describe, expect, it } from 'vitest';
import type { ProviderUnavailableReason, ProviderView, SeparateModelInfo, TranscribeModelInfo } from '@cuccut/protocol';
import { checkTranscribeOptions, effectiveChoice, selectModel, type SelectionInput } from './model-selection.ts';

/** Order of selection (architecture design §6.2): explicit → user default → factory default → `CAPABILITY_NOT_CONFIGURED`. */

const model = (modelId: string, extra: Partial<TranscribeModelInfo> = {}): TranscribeModelInfo => ({
  modelId,
  label: modelId,
  maxInputBytes: null,
  maxDurationSec: null,
  wordTimestamps: 'native',
  languages: 'any',
  acceptsHint: true,
  cost: 'free-local',
  ...extra,
});

const provider = (
  providerId: string,
  kind: ProviderView['kind'],
  models: TranscribeModelInfo[],
  unavailable?: ProviderUnavailableReason,
  config: ProviderView['config'] = null,
): ProviderView => ({
  providerId,
  kind,
  label: providerId,
  config,
  capabilities: { transcribe: { models, available: !unavailable, ...(unavailable ? { unavailableReason: unavailable } : {}) } },
});

// Consistent with LocalProviderSource: when no usable model package exists at all, the capability itself is unavailable (not-installed).
const local = (installed = true) =>
  provider(
    'local',
    'local',
    [
      model('asr-small', { default: true, ...(installed ? {} : { available: false, unavailableReason: 'not-installed' as const }) }),
      model('asr-large', { available: false, unavailableReason: 'not-installed' }),
    ],
    installed ? undefined : 'not-installed',
  );
const openai = (unavailable?: ProviderUnavailableReason, credential: 'set' | 'missing' = 'set') =>
  provider(
    'openai',
    'online',
    [model('whisper-1', { default: true, cost: 'unknown' }), model('gpt-4o-transcribe', { wordTimestamps: 'none' })],
    unavailable,
    { enabled: unavailable !== 'not-configured', enabledAt: null, credential },
  );
const custom = () => provider('custom:box', 'online', [model('whisper-1', { declared: true, default: true })]);
const node = (unavailable?: ProviderUnavailableReason) =>
  provider('node:studio', 'node', [model('asr-small', { default: true })], unavailable);

const select = (input: Partial<SelectionInput<'transcribe'>>) =>
  selectModel({ capability: 'transcribe', userDefault: null, providers: [local(), openai()], ...input });
const cnc = (reason: string, action: string, providerId?: string) => ({
  code: 'conflict',
  details: expect.objectContaining({
    code: 'CAPABILITY_NOT_CONFIGURED',
    capability: 'transcribe',
    reason,
    ...(providerId ? { providerId } : {}),
    remedy: expect.objectContaining({ action }),
  }),
});

describe('selectModel', () => {
  it('explicit provider: uses its default model; when the user default points to it, uses the default\'s model', () => {
    expect(select({ provider: 'openai' })).toMatchObject({
      providerId: 'openai',
      modelId: 'whisper-1',
      source: 'explicit',
      kind: 'online',
    });
    expect(select({ provider: 'openai', userDefault: { providerId: 'openai', modelId: 'gpt-4o-transcribe' } })).toMatchObject({
      modelId: 'gpt-4o-transcribe',
    });
    expect(select({ provider: 'openai', model: 'gpt-4o-transcribe' })).toMatchObject({ modelId: 'gpt-4o-transcribe' });
  });

  it('model only: looks for the default provider first, then local, then the only provider that lists it; several matches is invalid-request, none is not-found', () => {
    const providers = [local(), openai(), custom()];
    expect(select({ providers, model: 'whisper-1', userDefault: { providerId: 'custom:box', modelId: 'whisper-1' } })).toMatchObject({
      providerId: 'custom:box',
    });
    expect(() => select({ providers, model: 'whisper-1' })).toThrow(
      expect.objectContaining({ code: 'invalid-request', details: { providers: ['openai', 'custom:box'] } }),
    );
    expect(select({ model: 'gpt-4o-transcribe' })).toMatchObject({ providerId: 'openai' });
    expect(() => select({ model: 'nope' })).toThrow(expect.objectContaining({ code: 'not-found' }));
    expect(() => select({ model: 'asr-large' })).toThrow(expect.objectContaining(cnc('not-installed', 'install-model', 'local')));
  });

  it('the user default takes precedence over the factory default; when neither exists, the factory default is the default bundle installed on this machine', () => {
    expect(select({ userDefault: { providerId: 'openai', modelId: 'whisper-1' } })).toMatchObject({
      providerId: 'openai',
      source: 'user-default',
    });
    expect(select({})).toMatchObject({ providerId: 'local', modelId: 'asr-small', source: 'factory-default' });
  });

  it('a selected unavailable choice is rejected without switching provider: missing key, disabled, not installed, node unreachable', () => {
    const missing = [local(), openai('missing-credential', 'missing')];
    expect(() => select({ providers: missing, userDefault: { providerId: 'openai', modelId: 'whisper-1' } })).toThrow(
      expect.objectContaining(cnc('missing-credential', 'configure-provider', 'openai')),
    );
    const disabled = [local(), openai('not-configured', 'set')];
    expect(() => select({ providers: disabled, provider: 'openai' })).toThrow(
      expect.objectContaining(cnc('disabled', 'enable-provider', 'openai')),
    );
    const neverConfigured = [local(), openai('not-configured', 'missing')];
    expect(() => select({ providers: neverConfigured, provider: 'openai' })).toThrow(
      expect.objectContaining(cnc('disabled', 'configure-provider', 'openai')),
    );
    expect(() => select({ provider: 'local', model: 'asr-large' })).toThrow(
      expect.objectContaining(cnc('not-installed', 'install-model', 'local')),
    );
    expect(() => select({ providers: [local(), node('not-connected')], provider: 'node:studio' })).toThrow(
      expect.objectContaining(cnc('not-connected', 'pair-node', 'node:studio')),
    );
  });

  it('default pointing to a deleted provider or a model that no longer exists: rejected with an explanation', () => {
    expect(() => select({ userDefault: { providerId: 'custom:gone', modelId: 'm' } })).toThrow(
      expect.objectContaining(cnc('disabled', 'configure-provider', 'custom:gone')),
    );
    expect(() => select({ userDefault: { providerId: 'node:old', modelId: 'm' } })).toThrow(
      expect.objectContaining(cnc('not-paired', 'pair-node', 'node:old')),
    );
    expect(() => select({ userDefault: { providerId: 'openai', modelId: 'retired' } })).toThrow(
      expect.objectContaining(cnc('unsupported', 'set-default', 'openai')),
    );
    expect(() => select({ provider: 'openai', model: 'retired' })).toThrow(expect.objectContaining({ code: 'not-found' }));
    expect(() => select({ provider: 'nobody' })).toThrow(expect.objectContaining({ code: 'not-found' }));
  });

  it('nothing available: no-default; the hint points to an available provider, installing a bundle, or configuring one', () => {
    const remedy = (action: string, providerId?: string) =>
      expect.objectContaining({
        details: expect.objectContaining({
          reason: 'no-default',
          remedy: expect.objectContaining({ action, ...(providerId ? { providerId } : {}) }),
        }),
      });
    expect(() => select({ providers: [local(false), openai()] })).toThrow(remedy('set-default', 'openai'));
    expect(() => select({ providers: [local(false), openai('missing-credential', 'missing')] })).toThrow(remedy('install-model', 'local'));
    expect(() => select({ providers: [openai('not-configured', 'missing')] })).toThrow(remedy('configure-provider'));
  });

  it('a bundle the node does not list is still allowed through, leaving the node to check it', () => {
    expect(select({ providers: [node()], provider: 'node:studio', model: 'asr-xl' })).toMatchObject({
      providerId: 'node:studio',
      modelId: 'asr-xl',
      kind: 'node',
    });
  });

  it('effectiveChoice: reports the source when available, null when not', () => {
    expect(effectiveChoice({ capability: 'transcribe', userDefault: null, providers: [local()] })).toEqual({
      providerId: 'local',
      modelId: 'asr-small',
      source: 'factory-default',
    });
    expect(
      effectiveChoice({ capability: 'transcribe', userDefault: { providerId: 'custom:gone', modelId: 'x' }, providers: [local()] }),
    ).toBeNull();
    expect(effectiveChoice({ capability: 'synthesizeSpeech', userDefault: null, providers: [local()] })).toBeNull();
  });

  it('vocal separation has a factory default: the separation bundle available on this machine; the user default takes precedence; when none is available the remedy is to install a bundle', () => {
    const sepModel = (modelId: string, extra: Partial<SeparateModelInfo> = {}): SeparateModelInfo => ({
      modelId,
      label: modelId,
      cost: 'free-local',
      ...extra,
    });
    const sepLocal = (models: SeparateModelInfo[]): ProviderView => ({
      providerId: 'local',
      kind: 'local',
      label: '本机',
      config: null,
      capabilities: {
        transcribe: { models: [model('asr-small', { default: true })], available: true },
        separateAudio: {
          models,
          available: models.some((m) => m.available !== false),
          ...(models.some((m) => m.available !== false) ? {} : { unavailableReason: 'not-installed' as const }),
        },
      },
    });
    const two = sepLocal([sepModel('sep-a', { default: true }), sepModel('sep-b')]);
    expect(effectiveChoice({ capability: 'separateAudio', userDefault: null, providers: [two, openai()] })).toEqual({
      providerId: 'local',
      modelId: 'sep-a',
      source: 'factory-default',
    });
    expect(
      effectiveChoice({ capability: 'separateAudio', userDefault: { providerId: 'local', modelId: 'sep-b' }, providers: [two] }),
    ).toEqual({ providerId: 'local', modelId: 'sep-b', source: 'user-default' });
    const missing = sepLocal([sepModel('sep-a', { default: true, available: false, unavailableReason: 'not-installed' })]);
    expect(() => selectModel({ capability: 'separateAudio', userDefault: null, providers: [missing, openai()] })).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({
          capability: 'separateAudio',
          reason: 'no-default',
          remedy: expect.objectContaining({ action: 'install-model', providerId: 'local' }),
        }),
      }),
    );
    // No separate model package is registered (other platforms): likewise points to installation, not to configuring an online service.
    expect(() => selectModel({ capability: 'separateAudio', userDefault: null, providers: [local(), openai()] })).toThrow(
      expect.objectContaining({ details: expect.objectContaining({ remedy: expect.objectContaining({ action: 'install-model' }) }) }),
    );
  });

  it('checkTranscribeOptions: invalid-request when the model does not support the asserted language; prompts it does not accept are not rejected here', () => {
    const choice = select({ provider: 'openai' });
    const strict = { ...choice, model: model('m', { acceptsHint: false, languages: ['en', 'zh'] }) };
    expect(() => checkTranscribeOptions(strict, { assertedLanguage: 'ja' })).toThrow(expect.objectContaining({ code: 'invalid-request' }));
    expect(() => checkTranscribeOptions(strict, { assertedLanguage: 'zh-Hans' })).not.toThrow();
    expect(() => checkTranscribeOptions(strict, { assertedLanguage: null })).not.toThrow();
    expect(() => checkTranscribeOptions(choice, { assertedLanguage: 'ja' })).not.toThrow();
  });
});
