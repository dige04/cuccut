// Google Gemini transcription adapter (architecture design §6.4). Documentation read on 2026-10-03:
//   https://ai.google.dev/gemini-api/docs/audio
//   https://ai.google.dev/gemini-api/docs/transcribe
//   https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe
//   https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026
//   https://ai.google.dev/gemini-api/docs/interactions/structured-output.md.txt
//   https://discuss.ai.google.dev/t/gemini-3-5-transcribe-documented-custom-vocabulary-diarization-timestamps-configuration-is-rejected-by-the-interactions-api/180240
// Confirmed by the docs: `POST {base}/interactions`, with the `x-goog-api-key` and `Api-Revision: 2026-05-20` request headers (the key goes in the header, not the query string);
// input `{ type: 'audio', data (base64), mime_type }`; the whole request is ≤ 20 MB; `response_format` (top level) `{ type: 'text',
// mime_type: 'application/json', schema }`, with the result in `output_text`; for gemini-3.5-transcribe's
// `generation_config.transcription_config`: `language_codes`, `mode: { type: 'verbatim', timestamp_granularities: ['word'] }`,
// word timings are in `word_info` under `steps[].content[].annotations[]` (`start_offset`/`end_offset` look like "0.100s"); with timestamps, a single request is ≤ 30 minutes;
// `custom_vocabulary` cannot be used together with timestamps (so gemini-3.5-transcribe does not accept a prompt).
// Not confirmed: whether gemini-3.5-transcribe accepts inline `data` (the docs' example uses `uri`); the exact nesting of `content` inside `steps[]`;
// whether the detected language is returned; the shape of the error body for a 400 `API_KEY_INVALID`; whether `GET {base}/models` can be used to verify the key.
import fs from 'node:fs/promises';
import { ProviderFailure } from '@cuccut/models';
import type { TranscribeModelInfo } from '@cuccut/protocol';
import { CHUNK_FORMATS, type ChunkFormat } from '../audio/audio-prep.ts';
import {
  requestTimeoutMs,
  type AdapterConfig,
  type AdapterHttp,
  type ChunkRequest,
  type ChunkTranscript,
  type TranscribeAdapter,
} from '../adapter.ts';
import { providerFetch, type ProviderHttpOptions, type RejectionCode } from '../http/provider-fetch.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export const GOOGLE_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const GOOGLE_API_REVISION = '2026-05-20';
const LABEL = 'Google Gemini';
/** Inline audio grows by 4/3 when base64-encoded, so some headroom is left for the rest of the request: if the raw bytes do not exceed this number, the whole request stays within 20 MB. */
const MAX_INLINE_BYTES = 12_000_000;
const TIMELESS_CHUNK_SEC = 120;

export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';
export const GENERAL_MODEL = 'gemini-3.8-flash';

const MODELS: TranscribeModelInfo[] = [
  {
    modelId: TRANSCRIBE_MODEL,
    label: 'Gemini 3.5 Transcribe',
    default: true,
    maxInputBytes: MAX_INLINE_BYTES,
    maxDurationSec: 1800,
    wordTimestamps: 'native',
    languages: 'any',
    acceptsHint: false,
    cost: 'unknown',
  },
  {
    modelId: GENERAL_MODEL,
    label: 'Gemini 3.8 Flash',
    maxInputBytes: MAX_INLINE_BYTES,
    maxDurationSec: null,
    wordTimestamps: 'none',
    languages: 'any',
    acceptsHint: true,
    cost: 'unknown',
  },
];

/** Structured output of the general-purpose model: the language and the segments with start and end seconds. */
const SEGMENTS_SCHEMA = {
  type: 'object',
  properties: {
    language: { type: 'string', description: 'BCP 47 tag of the spoken language' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'number', description: 'seconds from the beginning of the audio' },
          end: { type: 'number', description: 'seconds from the beginning of the audio' },
          text: { type: 'string' },
        },
        required: ['start', 'end', 'text'],
      },
    },
  },
  required: ['segments'],
};

export class GoogleAdapter implements TranscribeAdapter {
  readonly version = 'cuccut-providers/google@1';

  models(_config: AdapterConfig): TranscribeModelInfo[] {
    return MODELS.map((m) => ({ ...m }));
  }

  chunkFormat(_model: TranscribeModelInfo): ChunkFormat {
    return 'flac';
  }

  preferredChunkSec(model: TranscribeModelInfo): number | null {
    return model.wordTimestamps === 'native' ? null : TIMELESS_CHUNK_SEC;
  }

  async transcribeChunk(request: ChunkRequest): Promise<ChunkTranscript> {
    const { config, model } = request;
    const audio = async () => ({
      type: 'audio',
      // Inline audio has to be read into memory in one piece: the chunk size cap (about 12 MB) keeps it small.
      data: (await fs.readFile(request.file)).toString('base64'),
      mime_type: CHUNK_FORMATS[request.format].mimeType,
    });
    const body =
      model.modelId === TRANSCRIBE_MODEL
        ? async () =>
            JSON.stringify({
              model: model.modelId,
              input: [await audio()],
              generation_config: {
                transcription_config: {
                  ...(request.language.mode === 'assert' ? { language_codes: [request.language.tag] } : {}),
                  mode: { type: 'verbatim', timestamp_granularities: ['word'] },
                },
              },
            })
        : async () =>
            JSON.stringify({
              model: model.modelId,
              input: [{ type: 'text', text: generalPrompt(request) }, await audio()],
              response_format: { type: 'text', mime_type: 'application/json', schema: SEGMENTS_SCHEMA },
            });
    const response = await providerFetch(googleHttpOptions(config, request.http), {
      method: 'POST',
      url: `${config.baseUrl}/interactions`,
      headers: { 'content-type': 'application/json', 'api-revision': GOOGLE_API_REVISION },
      auth: googleAuthOf(config),
      body,
      timeoutMs: requestTimeoutMs(request.durationSec, request.http),
      signal: request.signal,
      classify: classifyGoogle,
    });
    const value = response.json();
    return model.modelId === TRANSCRIBE_MODEL ? parseTranscribeInteraction(value) : parseGeneralInteraction(value);
  }

  async validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void> {
    await providerFetch(googleHttpOptions(config, { ...http, attempts: 1 }), {
      method: 'GET',
      url: `${config.baseUrl}/models`,
      auth: googleAuthOf(config),
      timeoutMs: http.timeoutMs ?? 15_000,
      signal,
      classify: classifyGoogle,
    });
  }
}

function generalPrompt(request: ChunkRequest): string {
  const lines = [
    'Transcribe all speech in this audio verbatim, in the language that is spoken.',
    'Split the transcript into short segments (one sentence or phrase each) in order.',
    'For each segment give start and end in seconds from the beginning of this audio, and the text.',
    'Also give the BCP 47 tag of the spoken language. If there is no speech, return an empty segments array.',
  ];
  if (request.language.mode === 'assert') lines.push(`The audio is in ${request.language.tag}.`);
  if (request.hint) lines.push(`Terms and names that may appear: ${request.hint}`);
  return lines.join('\n');
}

/** gemini-3.5-transcribe: word timings come from the `word_info` annotations; without annotations, the whole block is one segment (assembly interpolates by character length). */
export function parseTranscribeInteraction(value: unknown): ChunkTranscript {
  const interaction = interactionOf(value);
  const words: NonNullable<ChunkTranscript['words']> = [];
  const texts: string[] = [];
  for (const content of contentsOf(interaction)) {
    if (typeof content.text === 'string') texts.push(content.text);
    for (const annotation of arrayOf(content.annotations)) {
      if (annotation.type !== 'word_info' || typeof annotation.text !== 'string') continue;
      const start = offsetSec(annotation.start_offset);
      const end = offsetSec(annotation.end_offset);
      if (start === null || end === null) continue;
      words.push({ start, end, text: annotation.text });
    }
  }
  const text = typeof interaction.output_text === 'string' ? interaction.output_text : texts.join('');
  return {
    text,
    ...(words.length > 0 ? { words } : {}),
    ...(interaction.usage !== undefined ? { usage: interaction.usage } : {}),
  };
}

/** General-purpose model: `output_text` is structured JSON; if no segments can be read, the whole block becomes one segment (single-segment fallback). */
export function parseGeneralInteraction(value: unknown): ChunkTranscript {
  const interaction = interactionOf(value);
  const raw =
    typeof interaction.output_text === 'string'
      ? interaction.output_text
      : contentsOf(interaction)
          .map((c) => (typeof c.text === 'string' ? c.text : ''))
          .join('');
  const usage = interaction.usage !== undefined ? { usage: interaction.usage } : {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { text: raw.trim(), ...usage };
  }
  if (!isObject(parsed)) return { text: '', ...usage };
  const segments = arrayOf(parsed.segments).flatMap((s) =>
    typeof s.start === 'number' && typeof s.end === 'number' && typeof s.text === 'string'
      ? [{ start: s.start, end: s.end, text: s.text }]
      : [],
  );
  const language = typeof parsed.language === 'string' && parsed.language.trim() ? parsed.language.trim() : null;
  return {
    text: segments.map((s) => s.text.trim()).join(' '),
    ...(segments.length > 0 ? { segments } : {}),
    ...(language ? { language } : {}),
    ...usage,
  };
}

function interactionOf(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new ProviderFailure('protocol', PH.notObject({ label: LABEL }).text);
  if (value.status === 'failed' || value.status === 'cancelled') {
    throw new ProviderFailure('rejected', PH.transcribeIncomplete({ label: LABEL, status: String(value.status) }).text, { code: 'PROVIDER_REJECTED' });
  }
  if (typeof value.output_text !== 'string' && !Array.isArray(value.steps)) {
    throw new ProviderFailure('protocol', PH.missingTranscript({ label: LABEL }).text);
  }
  return value;
}

/** Content items from all steps. */
function contentsOf(interaction: Record<string, unknown>): Array<Record<string, unknown>> {
  return arrayOf(interaction.steps).flatMap((step) => arrayOf(step.content));
}

/** "1.250s" → 1.25。 */
export function offsetSec(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = /^(-?\d+(?:\.\d+)?)s$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

/** 400 with `API_KEY_INVALID` in the error body: the key is wrong, so it is treated as an authentication failure. */
export function classifyGoogle(status: number, body: string): RejectionCode | null {
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) return 'PROVIDER_AUTH_FAILED';
  return null;
}

export function googleAuthOf(config: AdapterConfig): { header: string; value: string } | null {
  return config.credential ? { header: 'x-goog-api-key', value: config.credential } : null;
}

export function googleHttpOptions(config: AdapterConfig, http: AdapterHttp): ProviderHttpOptions {
  return {
    label: LABEL,
    secrets: config.credential ? [config.credential] : [],
    ...(http.backoffMs ? { backoffMs: http.backoffMs } : {}),
    ...(http.attempts ? { attempts: http.attempts } : {}),
  };
}

function arrayOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
