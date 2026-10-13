// i18n-ignore-file: test fixtures mimicking data sent by the Runtime; tests assert these sample values
import type {
  ImageModelInfo,
  ModelBundleStatus,
  ModelCapabilitiesView,
  ProviderCapabilityView,
  ProviderConfigView,
  SpeechModelInfo,
  TextCapabilityParameters,
  TextModelInfo,
  TranscribeModelInfo,
} from '@cuccut/protocol';

/** Capability view shared by the models page unit tests: shaped like the Runtime's real views (providers/online-source.ts, agent-source.ts, models/local-source.ts). */

const off: ProviderConfigView = { enabled: false, enabledAt: null, credential: 'missing' };
const keyed: ProviderConfigView = { enabled: true, enabledAt: '2026-10-01T00:00:00.000Z', credential: 'set' };

export function transcribeModel(modelId: string, patch: Partial<TranscribeModelInfo> = {}): TranscribeModelInfo {
  return {
    modelId,
    label: modelId,
    maxInputBytes: 25 * 1024 * 1024,
    maxDurationSec: null,
    wordTimestamps: 'native',
    languages: 'any',
    acceptsHint: true,
    cost: 'unknown',
    ...patch,
  };
}

export function speechModel(modelId: string, voices: string[], patch: Partial<SpeechModelInfo> = {}): SpeechModelInfo {
  return {
    modelId,
    label: modelId,
    voices: voices.map((voiceId) => ({ voiceId, label: voiceId })),
    defaultVoice: voices[0] ?? null,
    voiceModes: voices.length ? ['preset', 'custom'] : ['custom'],
    languages: 'any',
    maxInputChars: 4096,
    formats: ['mp3'],
    defaultFormat: 'mp3',
    acceptsInstructions: false,
    speedRange: null,
    acceptsSeed: false,
    cost: 'unknown',
    ...patch,
  };
}

export function imageModel(modelId: string, patch: Partial<ImageModelInfo> = {}): ImageModelInfo {
  return {
    modelId,
    label: modelId,
    sizes: ['1024x1024'],
    aspectRatios: [],
    defaultSize: '1024x1024',
    maxCount: 1,
    maxPromptChars: 4000,
    formats: ['png'],
    defaultFormat: 'png',
    referenceImages: null,
    acceptsSeed: false,
    cost: 'unknown',
    ...patch,
  };
}

export function textModel(modelId: string, patch: Partial<TextModelInfo> = {}): TextModelInfo {
  return {
    modelId,
    label: modelId,
    contextTokens: 128_000,
    maxOutputTokens: 16_384,
    efforts: [],
    defaultEffort: null,
    structuredOutput: true,
    acceptsTemperature: true,
    acceptsSeed: false,
    cost: 'unknown',
    ...patch,
  };
}

function online<M extends ProviderCapabilityView['models'][number]>(
  providerId: string,
  label: string,
  config: ProviderConfigView,
  models: M[],
  available = false,
): ProviderCapabilityView<M> {
  const custom = providerId.startsWith('custom:');
  const reason = available
    ? {}
    : !config.enabled
      ? { unavailableReason: 'not-configured' as const, detail: '没有启用' }
      : custom
        ? { unavailableReason: 'not-configured' as const, detail: '没有声明模型' }
        : { unavailableReason: 'missing-credential' as const, detail: '没有设置密钥' };
  return { providerId, kind: 'online', label, config, models, available, ...reason };
}

const asrBox: ProviderConfigView = { enabled: true, enabledAt: '2026-10-01T00:00:00.000Z', credential: 'missing', endpoint: 'https://api.example.com/v1' };
const ttsBox: ProviderConfigView = { enabled: true, enabledAt: '2026-10-01T00:00:00.000Z', credential: 'set', endpoint: 'http://localhost:8000/v1' };

/** OpenAI connected (speech synthesis and images available); Google and ElevenLabs not connected; two self-hosted: one declares a transcription model, the other a speech synthesis model. */
export function fixtureView(): ModelCapabilitiesView {
  return {
    transcribe: {
      default: null,
      effective: { providerId: 'local', modelId: 'qwen3-asr-0.6b@mlx-4bit', source: 'factory-default' },
      providers: [
        {
          providerId: 'local',
          kind: 'local',
          label: '本机',
          config: null,
          models: [transcribeModel('qwen3-asr-0.6b@mlx-4bit', { label: 'Qwen3-ASR 0.6B', cost: 'free-local' })],
          available: true,
        },
        online('openai', 'OpenAI', keyed, [transcribeModel('gpt-4o-transcribe'), transcribeModel('whisper-1', { wordTimestamps: 'native' })], true),
        online('google', 'Google Gemini', off, [transcribeModel('gemini-2.5-flash')]),
        online('custom:asr-box', 'ASR Box', asrBox, [transcribeModel('whisper-large', { declared: true, default: true })], true),
      ],
    },
    synthesizeSpeech: {
      default: null,
      effective: null,
      providers: [
        online('openai', 'OpenAI', keyed, [speechModel('gpt-4o-mini-tts', ['alloy', 'echo'])], true),
        online('elevenlabs', 'ElevenLabs', off, [speechModel('eleven_multilingual_v2', [])]),
        online('custom:tts-box', 'TTS Box', ttsBox, [speechModel('tts-1', ['zh-female'], { declared: true, default: true, label: '中文女声' })], true),
      ],
    },
    generateImage: {
      default: null,
      effective: null,
      providers: [
        online('openai', 'OpenAI', keyed, [imageModel('gpt-image-1', { sizes: ['1024x1024', '1536x1024'], maxCount: 4 })], true),
        online('google', 'Google Gemini', off, [imageModel('imagen-4')]),
        {
          providerId: 'agent:codex',
          kind: 'agent',
          label: 'Codex',
          config: { enabled: false, enabledAt: null, credential: 'none' },
          models: [imageModel('image-gen', { label: 'Codex 图片生成（模型由 Codex 与账号决定）', sizes: [], defaultSize: null, cost: 'subscription' })],
          available: false,
          unavailableReason: 'not-configured',
          detail: '没有启用',
        },
      ],
    },
    generateText: { default: null, effective: null, providers: [], parameters: { effort: null, concurrency: 4 } },
    separateAudio: { default: null, effective: null, providers: [] },
    generateMusic: { default: null, effective: null, providers: [] },
  };
}

/**
 * Adds text generation on top of `fixtureView()`: OpenAI connected (two models, one with adjustable reasoning effort), Google not connected.
 * Not added to `fixtureView()` directly, since that would change existing assertions such as OpenAI's "which kinds this key is used for". With `parameters` null the view carries no parameters.
 */
export function textView(parameters: TextCapabilityParameters | null = { effort: null, concurrency: 4 }): ModelCapabilitiesView {
  const view = fixtureView();
  return {
    ...view,
    generateText: {
      default: null,
      effective: null,
      providers: [
        online(
          'openai',
          'OpenAI',
          keyed,
          [
            textModel('gpt-5-mini', { efforts: ['minimal', 'low', 'medium', 'high'], defaultEffort: 'medium', contextTokens: 400_000, maxOutputTokens: 128_000 }),
            textModel('gpt-4.1'),
          ],
          true,
        ),
        online('google', 'Google Gemini', off, [textModel('gemini-2.5-flash')]),
      ],
      ...(parameters ? { parameters } : {}),
    },
  };
}

export function bundle(bundleId: string, patch: Partial<ModelBundleStatus> = {}): ModelBundleStatus {
  return { bundleId, capability: 'transcribe', backend: 'mlx', device: 'metal', state: 'installed', ...patch };
}

/** Adds a local speech synthesis Provider to the fixture: one model installed, one not. */
export function withLocalSpeech(view: ModelCapabilitiesView = fixtureView()): ModelCapabilitiesView {
  return {
    ...view,
    synthesizeSpeech: {
      ...view.synthesizeSpeech,
      providers: [
        ...view.synthesizeSpeech.providers,
        {
          providerId: 'local',
          kind: 'local',
          label: '本机',
          config: null,
          available: true,
          models: [
            speechModel('kokoro-82m', ['af_heart'], { label: 'Kokoro 82M' }),
            speechModel('index-tts2', [], { label: 'IndexTTS2', available: false, unavailableReason: 'not-installed' }),
          ],
        },
      ],
    },
  };
}
