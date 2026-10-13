import type { ModelBackend, ModelCapability } from '@cuccut/protocol';

/**
 * The contract between the Runtime and the Model Worker (Model Worker protocol spec): message shapes, model package descriptions, and `cuccut.asr-result/v1`.
 * This is a private executor channel and is not part of the public protocol package; field names match the spec word for word.
 */

export const WORKER_CONTRACT_VERSION = 1;
export const ASR_RESULT_SCHEMA = 'cuccut.asr-result/v1';
export const DEFAULT_TIMESCALE = 1_000_000;

// ---- §4 Model package descriptions ----

export type ModelFamily =
  // Main recognition model (`components.asr.family`): Qwen3-ASR, Whisper's MLX package, CoreML package and GGML (whisper.cpp) package, MOSS-Transcribe-Diarize
  // (does its own segmentation, no VAD needed).
  | 'qwen3-asr'
  | 'whisper-mlx'
  | 'whisper-coreml'
  | 'whisper-ggml'
  | 'moss-transcribe-diarize'
  /** Whisper's tokenizer (`tokenizer` component, taken from `openai/whisper-large-v3`; the MLX package's `generation_config.json` is also here). */
  | 'whisper-tokenizer'
  | 'qwen3-forced-aligner'
  | 'silero-vad'
  | 'wespeaker'
  /** The Pyannote segmentation model of the “speaker diarization” model package (`segmentation` component, used together with WeSpeaker from `speaker`, §4). */
  | 'pyannote-segmentation'
  // Local speech synthesis (§4.1): the main model, the shared speech codec, and the IndexTTS 2.5 auxiliary weights are taken from the IndexTTS2 repo.
  | 'qwen3-tts'
  | 'qwen3-tts-tokenizer'
  | 'indextts2'
  | 'indextts2.5'
  | 'indextts2-aux'
  | 'gpt-sovits'
  | 'voxcpm2'
  | 'omnivoice'
  /** Vocal and accompaniment separation (`separator` component, §4.2): HTDemucs-FT, with its four sub-models all in one weights file. */
  | 'htdemucs-ft'
  // Local text-to-image (§4.2): Qwen-Image-2.1 (the text encoder, DiT, VAE and tokenizer tables are all in one `image` component).
  | 'qwen-image'
  /** Local music generation (§4.4): YuE2's GGUF weights (the main model, VAE and tokenizer tables are all in one `music` component), run by the audio.cpp engine and not handed to the Model Worker. */
  | 'yue2'
  /**
   * The audio.cpp engine (`audiocpp-engine` component, §4.4): a prebuilt package from the upstream GitHub release page. One archive is picked for the host platform and extracted. It is not handed to the Model Worker;
   * the local music-generation Provider runs it directly.
   */
  | 'audio-cpp-engine';
/**
 * `asr` / `vad` / `aligner` / `speaker` / `segmentation` / `tokenizer` are the recognition components; `tts` / `codec` / `aux` are the speech synthesis components (§4.1);
 * `separator` is the vocal and accompaniment separation component, and `image` is the text-to-image component (§4.2). Neither shares a model package with other components.
 */
export type BundleComponent =
  | 'asr'
  | 'vad'
  | 'aligner'
  | 'speaker'
  | 'segmentation'
  | 'tokenizer'
  | 'tts'
  | 'codec'
  | 'aux'
  | 'separator'
  | 'image'
  /** The music-generation component (§4.4): does not share a model package with other components, and is not handed to the Model Worker (the audio.cpp engine reads its directory directly). */
  | 'music'
  /**
   * The audio.cpp engine for the music-generation model package (§4.4): a platform-specific shared component, taken from the GitHub release page rather than the model repo. It is installed in the Runtime Home's
   * `tools/audiocpp/<版本>/`, not in the model directory, and is not handed to the Model Worker.
   */
  | 'audiocpp-engine';
export const SPEECH_COMPONENTS: readonly BundleComponent[] = ['tts', 'codec', 'aux'];

export interface ModelFiles {
  family: ModelFamily;
  revision: string;
  /** Absolute path. */
  dir: string;
  /** Relative to `dir`. */
  files: Array<{ path: string; sha256: string; byteLength: number }>;
}

export interface ModelBundle {
  bundleId: string;
  backend: ModelBackend;
  device: string;
  components: Partial<Record<BundleComponent, ModelFiles>>;
  threads: number;
  memoryBudgetBytes: number | null;
}

// ---- §2 Methods ----

export interface WorkerHello {
  workerVersion: string;
  contractVersion: number;
  pid: number;
  backends: Array<{ id: ModelBackend; available: boolean; reason?: string; devices: string[] }>;
  capabilities: ModelCapability[];
  /**
   * The main recognition model family this Worker can load (`components.asr.family`). `capabilities` includes `transcribe` only when there is one;
   * recognition model packages are handed only to Workers that list their family (§2.1).
   */
  transcribeFamilies: ModelFamily[];
  /**
   * The main synthesis model family this Worker can load (`components.tts.family`). `capabilities` includes `synthesize` only when there is one;
   * synthesis model packages are handed only to Workers that list their family (§2.1).
   */
  synthesizeFamilies: ModelFamily[];
  /**
   * The separation model family this Worker can load (`components.separator.family`). `capabilities` includes `separate` only when there is one;
   * separation model packages are handed only to Workers that list their family (§2.1).
   */
  separateFamilies: ModelFamily[];
  /**
   * The text-to-image family this Worker can load (`components.image.family`). `capabilities` includes `image` only when there is one;
   * text-to-image model packages are handed only to Workers that list their family (§2.1).
   */
  imageFamilies: ModelFamily[];
}

export interface ModelLoadResult {
  loaded: true;
  residentBytes: number | null;
  warmupMs: number;
}

export interface WorkerStatus {
  state: 'empty' | 'loading' | 'ready' | 'busy' | 'unloading';
  bundleId: string | null;
  job: { jobId: string; phase: string; startedAt: string } | null;
  memory: { active: number; cache: number; peak: number } | null;
}

export type LanguageOption = { mode: 'assert'; tag: string } | { mode: 'prefer'; tag: string | null };

export interface TranscribeOptions {
  language: LanguageOption;
  diarize: boolean;
  hint?: string;
  timescale: number;
}

export interface TickRange {
  start: number;
  end: number;
  timescale: number;
}

export interface JobInput {
  file: string;
  contentHash: string;
  track: number;
  range?: TickRange;
}

export interface TranscribeRunParams {
  jobId: string;
  runGeneration: number;
  capability: 'transcribe';
  input: JobInput;
  options: TranscribeOptions;
  staging: string;
  outputContract: typeof ASR_RESULT_SCHEMA;
}

/** Output contract for synthesis: one WAV in staging (PCM, mono or stereo; the sample rate is the model's native sample rate). */
export const SPEECH_WAV_CONTRACT = 'cuccut.speech-wav/v1';
/** File name of the synthesis result in staging. */
export const SPEECH_OUTPUT_FILE = 'speech.wav';

/**
 * The synthesized voice (§2.5.2): `preset` is the model's speaker; `clone` uses the reference recording in `input`, and `transcript` is its original text;
 * `describe` is a one-sentence description. The Worker does not swap in another voice: if the model cannot do it, the error is `INVALID_PARAMS`.
 */
export type SynthesizeVoice =
  { mode: 'preset'; id: string } | { mode: 'clone'; transcript: string | null } | { mode: 'describe'; description: string };

/** Frozen parameters for `job.run` (capability `synthesize`). The text is handed to the Worker as-is; pronunciation annotations are converted by the engine into its own notation. */
export interface SynthesizeOptions {
  text: string;
  /** BCP 47; null means the engine decides from the text. */
  language: string | null;
  voice: SynthesizeVoice;
  /** Description of tone and style (when the model accepts it). */
  instructions: string | null;
  speed: number | null;
  cfg: number | null;
  steps: number | null;
  seed: number | null;
}

export interface SynthesizeRunParams {
  jobId: string;
  runGeneration: number;
  capability: 'synthesize';
  /** Reference recording for `clone` (read-only, whole, track 0); null for other voice modes. */
  input: JobInput | null;
  options: SynthesizeOptions;
  staging: string;
  outputContract: typeof SPEECH_WAV_CONTRACT;
}

/** Output contract for separation: two 16-bit PCM stereo WAVs in staging, vocals and background. The sample rate is the requested `sampleRate`, and the length is the same as the input. */
export const STEMS_WAV_CONTRACT = 'cuccut.stems-wav/v1';
/** File names of the separation results in staging. */
export const STEM_OUTPUT_FILES = { vocals: 'vocals.wav', background: 'background.wav' } as const;

/** Parameters for `job.run` (capability `separate`) (§2.5.4): whole-input only; `range` is not accepted. */
export interface SeparateRunParams {
  jobId: string;
  runGeneration: number;
  capability: 'separate';
  input: Omit<JobInput, 'range'>;
  /** `sampleRate`: output sample rate (8000–192000); null means the model's working sample rate (44100 for HTDemucs). The Runtime passes the input track's sample rate. */
  options: { sampleRate: number | null };
  staging: string;
  outputContract: typeof STEMS_WAV_CONTRACT;
}

/** Output contract for text-to-image: one 8-bit RGBA PNG in staging. */
export const IMAGE_PNG_CONTRACT = 'cuccut.image-png/v1';
/** File name of the text-to-image result in staging. */
export const IMAGE_OUTPUT_FILE = 'image.png';

/** Output convention for music generation (§4.4): one WAV in staging (the model's sample rate; mono or stereo; 16-bit or 32-bit float). */
export const MUSIC_WAV_CONTRACT = 'cuccut.music-wav/v1';
/** File name of the music-generation result in staging. */
export const MUSIC_OUTPUT_FILE = 'music.wav';

/** Frozen parameters for `job.run` (capability `image`) (§2.5.3). Width and height are in pixels. `seed` is always given (the Runtime freezes it at submission), and the same seed produces the same image. */
export interface ImageRunOptions {
  prompt: string;
  width: number;
  height: number;
  /** Number of denoising steps; null means the model's default. */
  steps: number | null;
  seed: number;
}

export interface ImageRunParams {
  jobId: string;
  runGeneration: number;
  capability: 'image';
  options: ImageRunOptions;
  staging: string;
  outputContract: typeof IMAGE_PNG_CONTRACT;
}

/** Output contract for speaker diarization of an existing transcript: `speakers.json` in staging (§2.5.5). */
export const SPEAKERS_CONTRACT = 'cuccut.speakers/v1';
/** File name of the speaker-diarization result in staging. */
export const SPEAKERS_OUTPUT_FILE = 'speakers.json';

/**
 * Parameters for `job.run` (capability `diarize`) (§2.5.5): what is loaded is the “speaker diarization” model package itself (only `segmentation` and `speaker`).
 * `words` are the start and end of the transcript's words on the media timeline (ticks under `timescale`), in transcript order.
 */
export interface DiarizeRunParams {
  jobId: string;
  runGeneration: number;
  capability: 'diarize';
  input: JobInput;
  options: { timescale: number; words: Array<[number, number]> };
  staging: string;
  outputContract: typeof SPEAKERS_CONTRACT;
}

/** Result of `job.run` (`diarize`): `output` is `speakers.json` in staging; null when cancelled. */
export interface DiarizeRunResult {
  outcome: 'completed' | 'cancelled';
  output: JobOutput | null;
  speakers: number;
  stats: { decodeMs: number; diarizeMs: number };
}

/** `speakers.json`（`cuccut.speakers/v1`）。 */
export interface SpeakersFile {
  schema: typeof SPEAKERS_CONTRACT;
  clock: 'source-asset';
  timescale: number;
  speakers: Array<{ id: string; words: number; seconds: number }>;
  ranges: Array<{ start: number; end: number; speaker: string }>;
  /** One-to-one with the `words` parameter: the speaker each word is projected onto; null for words with no supporting evidence. */
  words: Array<string | null>;
  provenance: Record<string, unknown>;
}

export type JobRunParams = TranscribeRunParams | SynthesizeRunParams | SeparateRunParams | ImageRunParams | DiarizeRunParams;

export interface JobOutput {
  path: string;
  sha256: string;
  byteLength: number;
}

export interface JobRunResult {
  outcome: 'completed' | 'cancelled';
  output: JobOutput | null;
  segmentsFile: string | null;
  stats: { decodeMs: number; vadMs: number; asrMs: number; alignMs: number; speechSeconds: number };
}

/** Result of `job.run` (`synthesize`): `output` is `speech.wav` in staging. */
export interface SynthesizeRunResult {
  outcome: 'completed' | 'cancelled';
  output: JobOutput | null;
  audio: { sampleRate: number; channels: number; durationSec: number } | null;
  stats: { referenceMs: number; synthesisMs: number; encodeMs: number };
  /** Pronunciations that could not be read as annotated (the engine does not recognize the reading, the annotation is malformed, etc.): a warning, not a failure; empty when cancelled (§2.5.2). */
  readingsDropped: DroppedReading[];
}

/** Result of `job.run` (`separate`): `stems` are `vocals.wav` and `background.wav` in staging (the background is the sum of drums, bass, and the rest); null when cancelled. */
export interface SeparateRunResult {
  outcome: 'completed' | 'cancelled';
  stems: { vocals: JobOutput; background: JobOutput } | null;
  audio: { sampleRate: number; channels: number; durationSec: number } | null;
  stats: { decodeMs: number; separationMs: number; encodeMs: number };
}

/** One pronunciation annotation that was not read out: in the text with annotations removed, the range `[start, end)` (Unicode code-point offsets) was meant to be read as `reading`. */
export interface DroppedReading {
  start: number;
  end: number;
  /** Normalized pinyin reading, with multiple syllables separated by spaces (`yin2 hang2`); malformed annotations are kept as the original text. */
  reading: string;
  /** Source of the annotation: hand-written, phrase table, dictionary default, or decided by an LLM. */
  origin: 'user' | 'phrase' | 'dict' | 'llm';
}

/** Result of `job.run` (`image`): `output` is `image.png` in staging. */
export interface ImageRunResult {
  outcome: 'completed' | 'cancelled';
  output: JobOutput | null;
  image: { width: number; height: number; format: 'png'; seed: number; steps: number } | null;
  stats: { generationMs: number; encodeMs: number };
}

// ---- §3 Events ----

/** Recognition stages. */
export type TranscribeJobPhase = 'decoding' | 'vad' | 'transcribing' | 'aligning' | 'diarizing' | 'finalizing';
/** Synthesis stages: `preparing-reference` → `synthesizing` → `encoding`. */
export type SynthesizeJobPhase = 'preparing-reference' | 'synthesizing' | 'encoding';
export const SYNTHESIZE_JOB_PHASES: readonly SynthesizeJobPhase[] = ['preparing-reference', 'synthesizing', 'encoding'];
/** Separation stages: `decoding` → `separating` (progress unit `steps` = windows × sub-models) → `encoding`. */
export type SeparateJobPhase = 'decoding' | 'separating' | 'encoding';
/** Text-to-image stages: `encoding-prompt` → `denoising` (reports progress per step, starting at `0/n`) → `decoding`. */
export type ImageJobPhase = 'encoding-prompt' | 'denoising' | 'decoding';
export const IMAGE_JOB_PHASES: readonly ImageJobPhase[] = ['encoding-prompt', 'denoising', 'decoding'];
export type WorkerJobPhase = TranscribeJobPhase | SynthesizeJobPhase | SeparateJobPhase | ImageJobPhase;

export type WorkerEventParams =
  | { event: 'model.phase'; params: { phase: 'loading-weights' | 'compiling' | 'warming-up'; detail?: string } }
  | { event: 'job.phase'; params: { jobId: string; phase: WorkerJobPhase } }
  | {
      event: 'job.progress';
      params: { jobId: string; phase: WorkerJobPhase; done: number; total: number | null; unit: 'seconds' | 'segments' | 'steps' };
    }
  | { event: 'job.segment'; params: { jobId: string; segment: Segment } }
  | { event: 'job.warning'; params: { jobId: string; warning: AsrWarning } }
  | { event: 'job.language'; params: { jobId: string; tag: string; confidence: number | null } };

// ---- §6 Output contract ----

export type AsrOutcome = 'transcribed' | 'no-audio-track' | 'no-speech';
export type TimingQuality = 'aligned' | 'provider' | 'estimated' | 'missing';
export const TIMING_QUALITIES: readonly TimingQuality[] = ['aligned', 'provider', 'estimated', 'missing'];

/** `hint-ignored`: the model has no channel for recognition hints (MOSS), so `hint` was not passed to the model. `segment-incomplete`: the model left a segment unfinished, so words may be missing later. */
export type AsrWarningCode =
  | 'alignment-failed'
  | 'timing-adjusted'
  | 'backend-degraded'
  | 'diarization-unavailable'
  | 'segment-degenerate'
  | 'range-clamped'
  | 'hint-ignored'
  | 'segment-incomplete';
export const ASR_WARNING_CODES: readonly AsrWarningCode[] = [
  'alignment-failed',
  'timing-adjusted',
  'backend-degraded',
  'diarization-unavailable',
  'segment-degenerate',
  'range-clamped',
  'hint-ignored',
  'segment-incomplete',
];

export interface AsrWarning {
  code: AsrWarningCode;
  segmentId?: string;
  detail?: string;
}

export interface Word {
  start: number;
  end: number;
  text: string;
  confidence: number | null;
  timingQuality: TimingQuality;
  /** The speaker that speaker diarization (Pyannote, §6.6) projected onto this word, in `speakers`. This entry is absent when there is no diarization or no evidence. */
  speakerId?: string;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
  speakerId: string | null;
  words: Word[];
}

export interface ModelRef {
  family: string;
  revision: string;
}

export interface AsrProvenance {
  provider: string;
  bundleId: string | null;
  models: Partial<Record<BundleComponent, ModelRef>>;
  backend: string;
  device: string;
  workerVersion: string;
  inputHash: string;
  runGeneration: number;
  /**
   * Cost status (architecture design §6.4): given only by the online Provider. When `reported`, `usage` is the usage object exactly as the vendor reported it;
   * when there is no trustworthy report, it is `unknown`. It is not converted into an amount.
   */
  cost?: AsrCost;
}

export interface AsrCost {
  status: 'unknown' | 'reported';
  usage?: unknown;
}

export interface AsrResult {
  schema: typeof ASR_RESULT_SCHEMA;
  outcome: AsrOutcome;
  timescale: number;
  clock: 'source-asset';
  duration: number;
  language: { tag: string | null; source: 'asserted' | 'detected' | 'unknown'; confidence: number | null };
  segments: Segment[];
  speakers: Array<{ id: string; label: string | null }>;
  coverage: Array<{ start: number; end: number }>;
  warnings: AsrWarning[];
  provenance: AsrProvenance;
}

/** First line of `segments.jsonl` (§5). */
export interface SegmentsHeader {
  header: true;
  jobId: string;
  contentHash: string;
  bundleId: string;
  workerVersion: string;
  timescale: number;
}

// ---- §7 Errors ----

/** `model.load` can return only these three kinds of failure. */
export const LOAD_FAILURE_CODES = ['MODEL_NOT_INSTALLED', 'MODEL_UNSUPPORTED', 'MODEL_RESOURCE'] as const;
/** A failure during inference that can be retried. It counts toward the crash count, the same as a process crash (architecture design §6.5). */
export const CRASH_CODES = ['WORKER_PANIC', 'INFERENCE_FAILED', 'DECODE_FAILED'] as const;
/** Output cannot be written to staging (disk full, permissions): can be retried, but it is unrelated to the model, so it is not counted in the crash count. */
export const OUTPUT_WRITE_FAILED = 'OUTPUT_WRITE_FAILED';
