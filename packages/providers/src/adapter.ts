import type { ImageParameters, LanguageOption, SpeechParameters, TextParameters, TextReply } from '@cuccut/models';
import type {
  DeclaredModel,
  ImageFormat,
  ImageModelInfo,
  SpeechFormat,
  SpeechModelInfo,
  SpeechVoice,
  TextModelInfo,
  TranscribeModelInfo,
} from '@cuccut/protocol';
import type { ChunkFormat } from './audio/audio-prep.ts';
import type { ProviderHttpOptions } from './http/provider-fetch.ts';

/**
 * Online transcription adapter (architecture design §6.4): one provider's request and response shapes. Audio preparation, chunking, concatenation and result assembly are all in `OnlineTranscriber`. The adapter only sends one chunk of audio out and reads the response into a `ChunkTranscript`.
 *
 * The adapters for `synthesizeSpeech` / `generateImage` (`SpeechAdapter`, `ImageAdapter`) likewise only handle request and response shapes: one synthesis or one generation, with the response read into bytes. Writing files and computing digests are in `OnlineGenerator`. Validation and publishing are in JobManager.
 */

/** The current configuration of an online provider (from the config store). The key is handed to the adapter only so it can be put into request headers. */
export interface AdapterConfig {
  providerId: string;
  /** Base URL without a trailing slash. */
  baseUrl: string;
  credential: string | null;
  /** Which account the key belongs to (§6.8; determined when the key is fetched at execution time). Not given when there is no account or it is only a description. Usage records and account status use it. */
  accountId?: string | null;
  /** Models declared by a custom endpoint. */
  declared: readonly DeclaredModel[];
}

/** Tuning options for the adapter's requests (tests inject shorter backoff and deadlines). */
export interface AdapterHttp {
  backoffMs?: ProviderHttpOptions['backoffMs'];
  /** Deadline for a single request (milliseconds). When not given, it is estimated from the audio duration. */
  timeoutMs?: number;
  /** Total number of attempts (default 3). */
  attempts?: number;
}

export interface ChunkRequest {
  config: AdapterConfig;
  model: TranscribeModelInfo;
  /** One encoded chunk of audio (absolute path in staging). */
  file: string;
  byteLength: number;
  format: ChunkFormat;
  durationSec: number;
  language: LanguageOption;
  hint?: string;
  signal: AbortSignal;
  http: AdapterHttp;
}

/** The transcription of one chunk of audio. Times are seconds relative to the start of this chunk. */
export interface ChunkTranscript {
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  /** Word-level timing given by the provider. */
  words?: Array<{ start: number; end: number; text: string; confidence?: number | null }>;
  /** Language recognized by the provider (BCP 47; null when it is not recognized). */
  language?: string | null;
  /** Usage as reported verbatim by the provider. */
  usage?: unknown;
}

export interface TranscribeAdapter {
  /** Version written into the result's `provenance.workerVersion`. */
  readonly version: string;
  /** The model of this provider. Custom endpoints give it as declared. */
  models(config: AdapterConfig): TranscribeModelInfo[];
  /** The encoding used for chunks. */
  chunkFormat(model: TranscribeModelInfo): ChunkFormat;
  /** Preferred chunk length (seconds), shorter than the limit. For example, models that do not return times get shorter chunks so that interpolation is not too coarse. null means cut at the limit. */
  preferredChunkSec(model: TranscribeModelInfo): number | null;
  transcribeChunk(request: ChunkRequest): Promise<ChunkTranscript>;
  /** Sends one read-only request to the provider with this configuration, to verify the key and endpoint. Called only when `models.configure` carries `verify: true`. */
  validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void>;
}

/** Estimates the deadline for a single request from the audio duration: at least 2 minutes, plus 1 minute per minute of audio, at most 30 minutes. */
export function requestTimeoutMs(durationSec: number, http: AdapterHttp): number {
  if (http.timeoutMs !== undefined) return http.timeoutMs;
  return Math.min(30 * 60_000, 120_000 + Math.ceil(durationSec / 60) * 60_000);
}

/** When the asserted language is given to the provider, only its primary language subtag is used (`zh-Hans` → `zh`). */
export function primaryLanguage(tag: string): string {
  return tag.split('-')[0]!.toLowerCase();
}

// ---- Generation capabilities ----

/** Extensions and media types of media formats. */
export const SPEECH_MEDIA: Record<SpeechFormat, { extension: string; mediaType: string }> = {
  mp3: { extension: 'mp3', mediaType: 'audio/mpeg' },
  wav: { extension: 'wav', mediaType: 'audio/wav' },
  flac: { extension: 'flac', mediaType: 'audio/flac' },
};
export const IMAGE_MEDIA: Record<ImageFormat, { extension: string; mediaType: string }> = {
  png: { extension: 'png', mediaType: 'image/png' },
  jpeg: { extension: 'jpg', mediaType: 'image/jpeg' },
  webp: { extension: 'webp', mediaType: 'image/webp' },
};

/** Deadline for generation requests: both speech synthesis and image generation can take tens of seconds to several minutes. Tests inject shorter ones. */
export function generationTimeoutMs(http: AdapterHttp): number {
  return http.timeoutMs ?? 5 * 60_000;
}

export interface SpeechRequest {
  config: AdapterConfig;
  model: SpeechModelInfo;
  parameters: SpeechParameters;
  signal: AbortSignal;
  http: AdapterHttp;
}

export interface SpeechOutput {
  bytes: Buffer;
  /** Usage (as reported verbatim by the provider; pure-audio responses have none). */
  usage?: unknown;
}

export interface SpeechAdapter {
  readonly version: string;
  models(config: AdapterConfig): SpeechModelInfo[];
  /** One synthesis: returns audio bytes in the requested format (`parameters.format`). */
  synthesize(request: SpeechRequest): Promise<SpeechOutput>;
}

export interface ImageRequest {
  config: AdapterConfig;
  model: ImageModelInfo;
  parameters: ImageParameters;
  signal: AbortSignal;
  http: AdapterHttp;
  /** How many images have been received so far (used by adapters that gather the count over several requests to report progress). */
  progress(done: number): void;
}

export interface ImageOutput {
  /** Exactly `parameters.count` images, in the format `parameters.format`. */
  images: Buffer[];
  usage?: unknown;
}

export interface ImageAdapter {
  readonly version: string;
  models(config: AdapterConfig): ImageModelInfo[];
  generate(request: ImageRequest): Promise<ImageOutput>;
}

// ---- Text models ----

/** Deadline for text requests: long outputs and high reasoning effort can take minutes. Tests inject shorter ones. */
export function textTimeoutMs(http: AdapterHttp): number {
  return http.timeoutMs ?? 10 * 60_000;
}

export interface TextRequest {
  config: AdapterConfig;
  model: TextModelInfo;
  parameters: TextParameters;
  signal: AbortSignal;
  http: AdapterHttp;
  /** The HTTP layer makes one call per backoff retry. */
  onRetry(): void;
}

export interface TextAdapter {
  readonly version: string;
  models(config: AdapterConfig): TextModelInfo[];
  /** One call: converts the frozen parameters into the provider's format, and reads out the text, the finish reason, the usage and the model version. The checks are in `finishText`. */
  generate(request: TextRequest): Promise<TextReply>;
}

// ---- Model list ----

/** The list fetched from the provider: model IDs and, if any, the voices in the account. */
export interface ProviderListing {
  models: string[];
  voices?: SpeechVoice[];
}

export interface ModelLister {
  /** Read-only request. On failure it throws `ProviderFailure` (the text does not contain the key). */
  listModels(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<ProviderListing>;
}

// ---- Voice cloning ----

/** Deadline for cloning requests: uploading a reference recording and waiting for the provider to build the voice. Tests inject shorter ones. */
export function voiceCloneTimeoutMs(http: AdapterHttp): number {
  return http.timeoutMs ?? 2 * 60_000;
}

export interface VoiceCloneRequest {
  config: AdapterConfig;
  /** The clone's name on the provider's side. */
  name: string;
  /** Reference recording (absolute path), uploaded in full. */
  file: string;
  fileName: string;
  mediaType: string;
  /** Note attached to the clone (when the provider accepts it). null when there is none. */
  description: string | null;
  signal: AbortSignal;
  http: AdapterHttp;
}

export interface VoiceCloneDeleteRequest {
  config: AdapterConfig;
  voiceId: string;
  signal: AbortSignal;
  http: AdapterHttp;
}

/**
 * Voice cloning (architecture design §5.9): only providers that actually offer a cloning interface have this adapter. Create uploads the reference recording and returns the provider's voice ID. Delete removes the remote clone, and returns `not-found` when the provider no longer has it (not counted as a failure).
 */
export interface VoiceCloneAdapter {
  readonly version: string;
  createVoiceClone(request: VoiceCloneRequest): Promise<{ voiceId: string }>;
  deleteVoiceClone(request: VoiceCloneDeleteRequest): Promise<'deleted' | 'not-found'>;
}
