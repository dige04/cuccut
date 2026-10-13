// OpenAI transcription adapter (architecture design §6.4). Docs read on 2026-10-03:
//   https://developers.openai.com/api/docs/guides/speech-to-text
//   https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
// Confirmed by the docs: whisper-1 supports `verbose_json` and `timestamp_granularities[]` (words, segments); gpt-4o-transcribe and gpt-4o-mini-transcribe support only `json`/`text`, have no timestamps, and bill by token; files are ≤ 25 MB; m4a is accepted; `prompt` is used for terminology hints.
// Not confirmed: the per-request duration limit of the gpt-4o series. Here audio is sliced into 120-second chunks, which avoids a possible limit and keeps interpolated word times from being too coarse. `gpt-transcribe` from the guide has no parameters in the reference docs, so it is not listed.
import type { TranscribeModelInfo } from '@cuccut/protocol';
import type { ChunkFormat } from '../audio/audio-prep.ts';
import type { AdapterConfig, AdapterHttp, ChunkRequest, ChunkTranscript, TranscribeAdapter } from '../adapter.ts';
import { openAiTranscribeChunk, openAiValidate } from './openai-transcription.ts';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const LABEL = 'OpenAI';
const MAX_BYTES = 25_000_000;
/** Models that do not return timing are sliced to this length. */
const TIMELESS_CHUNK_SEC = 120;

const MODELS: TranscribeModelInfo[] = [
  {
    modelId: 'whisper-1',
    label: 'Whisper',
    default: true,
    maxInputBytes: MAX_BYTES,
    maxDurationSec: null,
    wordTimestamps: 'native',
    languages: 'any',
    acceptsHint: true,
    cost: 'unknown',
  },
  {
    modelId: 'gpt-4o-transcribe',
    label: 'GPT-4o Transcribe',
    maxInputBytes: MAX_BYTES,
    maxDurationSec: null,
    wordTimestamps: 'none',
    languages: 'any',
    acceptsHint: true,
    cost: 'unknown',
  },
  {
    modelId: 'gpt-4o-mini-transcribe',
    label: 'GPT-4o mini Transcribe',
    maxInputBytes: MAX_BYTES,
    maxDurationSec: null,
    wordTimestamps: 'none',
    languages: 'any',
    acceptsHint: true,
    cost: 'unknown',
  },
];

export class OpenAiAdapter implements TranscribeAdapter {
  readonly version = 'cuccut-providers/openai@1';

  models(_config: AdapterConfig): TranscribeModelInfo[] {
    return MODELS.map((m) => ({ ...m }));
  }

  chunkFormat(_model: TranscribeModelInfo): ChunkFormat {
    return 'm4a';
  }

  preferredChunkSec(model: TranscribeModelInfo): number | null {
    return model.wordTimestamps === 'native' ? null : TIMELESS_CHUNK_SEC;
  }

  transcribeChunk(request: ChunkRequest): Promise<ChunkTranscript> {
    return openAiTranscribeChunk(request, { label: LABEL, verbose: request.model.wordTimestamps === 'native' });
  }

  validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void> {
    return openAiValidate(config, signal, http, LABEL);
  }
}
