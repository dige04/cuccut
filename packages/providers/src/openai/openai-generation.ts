// Shape of OpenAI's speech synthesis and image generation endpoints (shared by `openai` and `openai-compatible`). Docs read on 2026-10-03:
//   https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
//   https://developers.openai.com/api/docs/guides/text-to-speech
//   https://developers.openai.com/api/reference/resources/images/methods/generate
//   https://developers.openai.com/api/docs/guides/image-generation
// Confirmed by the docs: `POST {base}/audio/speech`, JSON `model`, `input` (≤ 4096 characters), `voice` (a built-in voice name, or a custom voice `{ id }`), `instructions` (not accepted by tts-1 / tts-1-hd), `response_format` (mp3, opus, aac, flac, wav, pcm), `speed` (0.25–4.0); the response body is the audio bytes. `POST {base}/images/generations`, JSON `model`, `prompt` (≤ 32000 characters), `n` (1–10), `size`, `output_format` (png, jpeg, webp); GPT image models always return `data[].b64_json` (`response_format` is deprecated), and the response includes `usage`. Auth is `Authorization: Bearer`.
// Not confirmed: whether compatible endpoints accept these fields and whether they return `b64_json`. Here compatible endpoints get `response_format: 'b64_json'` as an extra field. Endpoints that return only `url` are not supported; the arbitrary address in the response is not downloaded.
import { ProviderFailure } from '@cuccut/models';
import { generationTimeoutMs, type ImageOutput, type ImageRequest, type SpeechOutput, type SpeechRequest } from '../adapter.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { authOf, httpOptions } from './openai-transcription.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export interface OpenAiGenerationStyle {
  label: string;
  /** Compatible endpoints: request `b64_json` (GPT image models do not need it, and no longer accept other values for this parameter). */
  compatible: boolean;
}

export async function openAiSynthesize(request: SpeechRequest, style: OpenAiGenerationStyle): Promise<SpeechOutput> {
  const { config, model, parameters } = request;
  const preset = model.voices.some((v) => v.voiceId === parameters.voice);
  const body = {
    model: model.modelId,
    input: parameters.text,
    // Voices not in the preset list are the account's custom voices: passed as `{ id }`, per the docs.
    voice: preset || style.compatible ? parameters.voice : { id: parameters.voice },
    response_format: parameters.format,
    ...(parameters.instructions ? { instructions: parameters.instructions } : {}),
    ...(parameters.speed !== null ? { speed: parameters.speed } : {}),
  };
  const response = await providerFetch(httpOptions(style.label, config, request.http), {
    method: 'POST',
    url: `${config.baseUrl}/audio/speech`,
    headers: { 'content-type': 'application/json' },
    auth: authOf(config),
    body: () => JSON.stringify(body),
    timeoutMs: generationTimeoutMs(request.http),
    signal: request.signal,
  });
  if (response.contentType?.startsWith('application/json')) {
    throw new ProviderFailure('protocol', PH.jsonNotAudio({ label: style.label }).text);
  }
  if (response.bytes.length === 0) throw new ProviderFailure('protocol', PH.emptyAudio({ label: style.label }).text);
  return { bytes: response.bytes };
}

export async function openAiGenerateImages(request: ImageRequest, style: OpenAiGenerationStyle): Promise<ImageOutput> {
  const { config, model, parameters } = request;
  const body = {
    model: model.modelId,
    prompt: parameters.prompt,
    n: parameters.count,
    ...(parameters.size ? { size: parameters.size } : {}),
    output_format: parameters.format,
    ...(style.compatible ? { response_format: 'b64_json' } : {}),
  };
  const response = await providerFetch(httpOptions(style.label, config, request.http), {
    method: 'POST',
    url: `${config.baseUrl}/images/generations`,
    headers: { 'content-type': 'application/json' },
    auth: authOf(config),
    body: () => JSON.stringify(body),
    timeoutMs: generationTimeoutMs(request.http),
    signal: request.signal,
  });
  const value = response.json<{ data?: unknown; usage?: unknown }>();
  const data = Array.isArray(value?.data) ? value.data : [];
  const images: Buffer[] = [];
  for (const item of data) {
    const b64 = typeof item === 'object' && item !== null ? (item as { b64_json?: unknown }).b64_json : undefined;
    if (typeof b64 !== 'string' || !b64) {
      throw new ProviderFailure('protocol', PH.noB64({ label: style.label }).text);
    }
    images.push(Buffer.from(b64, 'base64'));
  }
  if (images.length !== parameters.count) {
    throw new ProviderFailure('protocol', PH.imageCount({ label: style.label, got: images.length, want: parameters.count }).text);
  }
  request.progress(images.length);
  return { images, ...(value.usage !== undefined ? { usage: value.usage } : {}) };
}
