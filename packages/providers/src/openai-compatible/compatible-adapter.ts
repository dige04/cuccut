// Transcription adapter for OpenAI-compatible endpoints (architecture design §6.4): the user supplies the base URL and model, and the request shape matches OpenAI. Documentation read on 2026-10-03:
//   https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
// Compatible endpoints differ from one implementation to another (vLLM, LocalAI, faster-whisper-server, etc.), so here we only assume `POST {base}/audio/transcriptions`
// accepts multipart `file`/`model`/`response_format`/`language`/`prompt`, and with `verbose_json` it may include `segments` and `words`;
// all of this is assumed, not confirmed for each implementation. Models declaring `wordTimestamps: 'native'` request `verbose_json` with word and segment timestamps; the rest request `json`.
// The key is optional; slices use WAV (the format most widely accepted by compatible endpoints).
import type { DeclaredModel, ModelServiceCapability, TranscribeModelInfo } from '@cuccut/protocol';
import type { ChunkFormat } from '../audio/audio-prep.ts';
import type { AdapterConfig, AdapterHttp, ChunkRequest, ChunkTranscript, TranscribeAdapter } from '../adapter.ts';
import { openAiTranscribeChunk, openAiValidate } from '../openai/openai-transcription.ts';

const DEFAULT_MAX_BYTES = 25_000_000;
const TIMELESS_CHUNK_SEC = 120;

export class CompatibleAdapter implements TranscribeAdapter {
  readonly version = 'cuccut-providers/openai-compatible@1';
  /** The display name may change with configuration: it is read each time it is used. */
  readonly #label: () => string;

  constructor(label: () => string) {
    this.#label = label;
  }

  models(config: AdapterConfig): TranscribeModelInfo[] {
    return declaredOf(config, 'transcribe').map((m, i) => declaredModelInfo(m, i === 0));
  }

  chunkFormat(_model: TranscribeModelInfo): ChunkFormat {
    return 'wav';
  }

  preferredChunkSec(model: TranscribeModelInfo): number | null {
    return model.wordTimestamps === 'native' ? null : TIMELESS_CHUNK_SEC;
  }

  transcribeChunk(request: ChunkRequest): Promise<ChunkTranscript> {
    return openAiTranscribeChunk(request, { label: this.#label(), verbose: request.model.wordTimestamps === 'native' });
  }

  validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void> {
    return openAiValidate(config, signal, http, this.#label());
  }
}

/** Models declared for a capability (`transcribe` when `capability` is not given), in declaration order; the first is the default model for that capability. */
export function declaredOf(config: AdapterConfig, capability: ModelServiceCapability): DeclaredModel[] {
  return config.declared.filter((m) => (m.capability ?? 'transcribe') === capability);
}

/** Fills in conservative defaults for declared models. */
export function declaredModelInfo(model: DeclaredModel, isDefault: boolean): TranscribeModelInfo {
  return {
    modelId: model.modelId,
    label: model.label ?? model.modelId,
    ...(isDefault ? { default: true } : {}),
    declared: true,
    maxInputBytes: model.maxInputBytes ?? DEFAULT_MAX_BYTES,
    maxDurationSec: model.maxDurationSec ?? null,
    wordTimestamps: model.wordTimestamps ?? 'native',
    languages: 'any',
    acceptsHint: model.acceptsHint ?? true,
    cost: 'unknown',
  };
}
