// ElevenLabs speech synthesis adapter (architecture design §6.4). Documents read on 2026-10-03:
//   https://elevenlabs.io/docs/api-reference/text-to-speech/convert
//   https://elevenlabs.io/docs/overview/models
//   https://elevenlabs.io/docs/api-reference/models/list
//   https://elevenlabs.io/docs/api-reference/voices/search
// Confirmed by the docs: `POST {base}/text-to-speech/{voice_id}?output_format=…`, with the request header `xi-api-key`. JSON `text`, `model_id` (default eleven_multilingual_v2), `language_code` (ISO 639-1; not supported by multilingual_v2), `seed` (0–4294967295, best effort). The body of a 200 response is the audio file. `output_format` takes `codec_sampleRate_bitrate`, default `mp3_44100_128`. 44.1 kHz WAV requires the Pro tier, so WAV uses `wav_24000`. Per-request character limits: eleven_v4 10,000, eleven_v3 5,000, eleven_multilingual_v2 10,000, eleven_flash_v2_5 40,000. multilingual_v2 supports 29 languages, and flash_v2_5 adds hu, no and vi. v3 / v4 support 70+ / 90+ languages.
// Voices belong to the account (listed by `GET /v1/voices`). There is no built-in voice table that is available to all accounts. `GET /v1/models` lists the models.
// Not confirmed: the value range of `voice_settings.speed` (speed is not exposed). The status code and error body when quota is exhausted (by default classified as 401/429; when the error body contains `quota_exceeded`, it is treated as quota exhausted). The character limit of eleven_v4_turbo (not listed in the docs, so this model is not offered).
import { ProviderFailure } from '@cuccut/models';
import type { SpeechFormat, SpeechModelInfo } from '@cuccut/protocol';
import {
  generationTimeoutMs,
  primaryLanguage,
  type AdapterConfig,
  type AdapterHttp,
  type ModelLister,
  type ProviderListing,
  type SpeechAdapter,
  type SpeechOutput,
  type SpeechRequest,
} from '../adapter.ts';
import { providerFetch, type ProviderHttpOptions, type RejectionCode } from '../http/provider-fetch.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export const ELEVENLABS_DEFAULT_BASE_URL = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_LABEL = 'ElevenLabs';
const LABEL = ELEVENLABS_LABEL;

/** Our format → `output_format`. */
const OUTPUT_FORMATS: Partial<Record<SpeechFormat, string>> = { mp3: 'mp3_44100_128', wav: 'wav_24000' };

const V2_LANGUAGES = [
  'en',
  'ja',
  'zh',
  'de',
  'hi',
  'fr',
  'ko',
  'pt',
  'it',
  'es',
  'id',
  'nl',
  'tr',
  'fil',
  'pl',
  'sv',
  'bg',
  'ro',
  'ar',
  'cs',
  'el',
  'fi',
  'hr',
  'ms',
  'sk',
  'da',
  'ta',
  'uk',
  'ru',
];

/** Models that do not support `language_code`: language is checked only at submission, and is not sent to the provider. */
const NO_LANGUAGE_CODE = new Set(['eleven_multilingual_v2']);

const BASE = {
  // Voices belong to the account, so no preset voices are listed. A voice must be specified (the voice_id of a voice in the account).
  voices: [],
  defaultVoice: null,
  voiceModes: ['custom'],
  formats: ['mp3', 'wav'],
  defaultFormat: 'mp3',
  acceptsInstructions: false,
  speedRange: null,
  acceptsSeed: true,
  cost: 'unknown',
} satisfies Partial<SpeechModelInfo>;

const MODELS: SpeechModelInfo[] = [
  {
    ...BASE,
    modelId: 'eleven_multilingual_v2',
    label: 'Eleven Multilingual v2',
    default: true,
    languages: V2_LANGUAGES,
    maxInputChars: 10_000,
  },
  { ...BASE, modelId: 'eleven_v4', label: 'Eleven v4', languages: 'any', maxInputChars: 10_000 },
  { ...BASE, modelId: 'eleven_v3', label: 'Eleven v3', languages: 'any', maxInputChars: 5_000 },
  {
    ...BASE,
    modelId: 'eleven_flash_v2_5',
    label: 'Eleven Flash v2.5',
    languages: [...V2_LANGUAGES, 'hu', 'no', 'vi'],
    maxInputChars: 40_000,
  },
];

export class ElevenLabsAdapter implements SpeechAdapter, ModelLister {
  readonly version = 'cuccut-providers/elevenlabs@1';

  models(_config: AdapterConfig): SpeechModelInfo[] {
    return structuredClone(MODELS);
  }

  async synthesize(request: SpeechRequest): Promise<SpeechOutput> {
    const { config, model, parameters } = request;
    const outputFormat = OUTPUT_FORMATS[parameters.format];
    if (!outputFormat) throw new ProviderFailure('rejected', PH.formatUnsupported({ label: LABEL, format: parameters.format }).text, { code: 'PROVIDER_REJECTED' });
    const body = {
      text: parameters.text,
      model_id: model.modelId,
      ...(parameters.language && !NO_LANGUAGE_CODE.has(model.modelId) ? { language_code: primaryLanguage(parameters.language) } : {}),
      ...(parameters.seed !== null ? { seed: parameters.seed } : {}),
    };
    const response = await providerFetch(httpOptions(config, request.http), {
      method: 'POST',
      url: `${config.baseUrl}/text-to-speech/${encodeURIComponent(parameters.voice)}?output_format=${outputFormat}`,
      headers: { 'content-type': 'application/json' },
      auth: authOf(config),
      body: () => JSON.stringify(body),
      timeoutMs: generationTimeoutMs(request.http),
      signal: request.signal,
      classify: classifyElevenLabs,
    });
    if (response.contentType?.startsWith('application/json')) {
      throw new ProviderFailure('protocol', PH.jsonNotAudio({ label: LABEL }).text);
    }
    if (response.bytes.length === 0) throw new ProviderFailure('protocol', PH.emptyAudio({ label: LABEL }).text);
    return { bytes: response.bytes };
  }

  async validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void> {
    await providerFetch(httpOptions(config, { ...http, attempts: 1 }), {
      method: 'GET',
      url: `${config.baseUrl}/models`,
      auth: authOf(config),
      timeoutMs: http.timeoutMs ?? 15_000,
      signal,
      classify: classifyElevenLabs,
    });
  }

  /**
   * `GET {base}/models` (`[{ model_id }]`) and `GET {base}/voices` (`{ voices: [{ voice_id, name }] }`). Voices belong to the account, so the ones fetched are added to the model's preset voices. There is still no default voice, so one must be specified.
   */
  async listModels(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<ProviderListing> {
    const get = (resource: string) =>
      providerFetch(httpOptions(config, { ...http, attempts: 1 }), {
        method: 'GET',
        url: `${config.baseUrl}/${resource}`,
        auth: authOf(config),
        timeoutMs: http.timeoutMs ?? 15_000,
        signal,
        classify: classifyElevenLabs,
      });
    const models = (await get('models')).json<unknown>();
    if (!Array.isArray(models)) throw new ProviderFailure('protocol', PH.listNotArray({ label: LABEL }).text);
    const voices = (await get('voices')).json<{ voices?: unknown }>();
    if (!voices || !Array.isArray(voices.voices)) throw new ProviderFailure('protocol', PH.voicesShape({ label: LABEL }).text);
    return {
      models: [...new Set(models.flatMap((m) => (isRecord(m) && typeof m.model_id === 'string' && m.model_id ? [m.model_id] : [])))].sort(),
      voices: voices.voices.flatMap((v) =>
        isRecord(v) && typeof v.voice_id === 'string' && v.voice_id
          ? [{ voiceId: v.voice_id, label: typeof v.name === 'string' && v.name ? v.name : v.voice_id }]
          : [],
      ),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The error body is `quota_exceeded`: quota exhausted (regardless of the specific 4xx status code). */
export function classifyElevenLabs(status: number, body: string): RejectionCode | null {
  if (status >= 400 && status < 500 && /quota_exceeded/i.test(body)) return 'PROVIDER_QUOTA_EXCEEDED';
  return null;
}

export function authOf(config: AdapterConfig): { header: string; value: string } | null {
  return config.credential ? { header: 'xi-api-key', value: config.credential } : null;
}

export function httpOptions(config: AdapterConfig, http: AdapterHttp): ProviderHttpOptions {
  return {
    label: LABEL,
    secrets: config.credential ? [config.credential] : [],
    ...(http.backoffMs ? { backoffMs: http.backoffMs } : {}),
    ...(http.attempts ? { attempts: http.attempts } : {}),
  };
}
