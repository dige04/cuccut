import type {
  ModelBackend,
  ModelCapability,
  ModelLicense,
  MusicMode,
  MusicPlanning,
  SpeechKnobRange,
  SpeechReadings,
  SpeechVoiceDescription,
  VoiceMode,
} from '@cuccut/protocol';
import { ModelsBundleRegistry as M } from '@cuccut/protocol/messages/models/bundle-registry.ts';
import { IMAGE_BUNDLES } from './image-bundles.ts';
import { MUSIC_BUNDLES } from './music-bundles.ts';
import { SPEECH_BUNDLES } from './speech-bundles.ts';
import type { BundleComponent, ModelFamily } from './worker-contract.ts';

/**
 * Model bundle registry (architecture design §6.3, §6.5). Hardcoded here in P0. Once the downloader and multi-backend selection (P1) are wired in, it switches to reading from the catalog.
 *
 * Each component points at one upstream repository in the model catalog: `<models-root>/<owner>/<repo>/`, with `revision` pinned to the upstream commit.
 */

export interface BundleComponentSource {
  family: ModelFamily;
  /** `<owner>/<repo>` */
  repo: string;
  revision: string;
  /**
   * Optional component. Installation and repair still download it, but when it is missing the model bundle still counts as installed (not `incomplete`), and it is omitted when handed to the Worker.
   * Used for components that several bundles share and that were added later (the aligner, the speaker model), so that already-installed bundles do not become incomplete because of them.
   */
  optional?: true;
  /** The component's own license, when it differs from the main model's license (the aligner, the speaker model). */
  license?: ModelLicense;
  /**
   * The component's subdirectory in the repository (`/`-separated, no leading or trailing slash). Installation, verification and the installed check are still done for the whole repository. When handed to the Worker, the component's directory is this subdirectory, carrying only the files beneath it, with paths relative to it (`argmaxinc/whisperkit-coreml` holds several Whisper variants in one repository).
   */
  subdir?: string;
  /**
   * Storage bit width of the weight bodies: 4 or 8 for MLX affine quantization, 16 for bf16, 32 for f32. Quantized bundles often have unquantized parts (the audio tower and norms, stored as bf16 / f16), so this is only used to estimate candle's resident size (`candleResidentBytes`) when `parameters` is unknown.
   */
  weightBits?: 4 | 8 | 16 | 32;
  /**
   * Parameter count after dequantization (counted from the shape of each tensor in the safetensors header; quantized tensors are expanded by bit width, not counting `scales` / `biases`). The candle backend converts all weights to the compute precision when it loads, so the resident size is roughly parameter count × bytes per parameter (f32 on CPU is 4, half precision on CUDA is 2).
   */
  parameters?: number;
  /**
   * A component that comes from a GitHub release page rather than a model repository (the audio.cpp engine, architecture design §6.3). It is platform-specific: the model catalog takes one archive keyed by the Runtime host's platform key (`<process.platform>-<process.arch>`), downloads and verifies it, and extracts it to `<toolsDir>/<name>/<version>/`. It does not live in the model catalog.
   * `repo` and `revision` must still be filled in (a synthetic `<owner>/<repo>` and the upstream tag). The owner, sharing and install records are still computed as `repo@revision`.
   */
  release?: ComponentRelease;
}

/** One platform's archive on a GitHub release page (`BundleComponentSource.release`). */
export interface ComponentReleaseAsset {
  fileName: string;
  size: number;
  sha256: string;
  /** Archive format, and the files skipped on extraction (other tools of the same package at the archive root). Only regular files at the archive root are extracted. */
  archive: { format: 'tar.gz' | 'zip'; skip: readonly string[] };
  /** Executables that must exist after extraction (relative to the component directory). */
  executable: string;
}

/** Registration of a release-page component: pinned version, one archive per platform. */
export interface ComponentRelease {
  /** The name used in the component directory and mirror paths: `<toolsDir>/<name>/<version>/`, `<mirror>/<name>/<version>/<filename>`. */
  name: string;
  version: string;
  /** Template for the official download URL: `{version}` and `{file}` are replaced with the version and the file name. */
  urlTemplate: string;
  /** Platform key (`darwin-arm64`, `darwin-x64`, `linux-x64`, `win32-x64`, …) → archive. Platforms not listed are unsupported. */
  assets: Readonly<Partial<Record<string, ComponentReleaseAsset>>>;
}

export interface BundleDefinition {
  bundleId: string;
  capability: ModelCapability;
  backend: ModelBackend;
  device: string;
  components: Partial<Record<BundleComponent, BundleComponentSource>>;
  /** Human-readable name (required). The same model keeps its name when the backend is swapped (MLX / candle, Core ML / GGML) (architecture design §6.5). */
  label: string;
  /** The weights' license (shown to the user before download). */
  license?: ModelLicense;
  /** Features of a `synthesize` model bundle. The `local` Provider uses them to describe the `synthesizeSpeech` model and to check requests at submission. */
  speech?: SpeechBundleProfile;
  /** Features of an `image` model bundle. The `local` Provider uses them to describe the `generateImage` model, and resource scheduling uses them to compute the Model Worker's peak. */
  image?: ImageBundleProfile;
  /** Features of a `music` model bundle. The `local` Provider uses them to describe the `generateMusic` model and to check requests at submission. Resource scheduling uses them to compute the engine process's peak. */
  music?: MusicBundleProfile;
  /**
   * The “speaker diarization” bundle (`capability: 'diarize'`, architecture design §6.6) that a recognition bundle uses. When it is installed, the bundle handed to the Worker carries its components (`segmentation` and `speaker`), and diarization runs after recognition when speakers are requested. If it is not installed, it is not carried, and requesting speakers only reports `diarization-unavailable`.
   */
  diarization?: string;
}

/** What a local text-to-image model bundle can do (architecture design §6.1, §6.3). One image at a time, PNG output only, no reference images, accepts a seed. */
export interface ImageBundleProfile {
  family: string;
  /** Aspect ratios and their pixel sizes. The first is the default size. */
  aspects: ReadonlyArray<{ ratio: string; size: string }>;
  /** Other accepted sizes that are not in the aspect ratio menu (`WIDTHxHEIGHT`): the small images for the settings page's trial render. */
  extraSizes: readonly string[];
  /** Prompt length limit (Unicode code points). */
  maxPromptChars: number;
  /** Denoising step counts a request may use. `default` is the step count when none is given (the Worker uses the same default). */
  steps: SpeechKnobRange;
  /**
   * Peak memory of the Model Worker process (bytes, rounded up after measurement with headroom). The three weight segments are streamed in layer by layer and are never resident at the same time, so the peak is independent of the total weight size. Resource scheduling uses it to compute the Model Worker's needs. This is the value for the registered device. For a candle bundle, when the device the Worker reports differs from the registered one (CUDA), use the value for that device in `devicePeakBytes`.
   */
  peakBytes: number;
  /** For candle bundles, overrides `peakBytes` by the device the Worker reports (keys are devices, such as `cuda`). Devices not listed use `peakBytes`. */
  devicePeakBytes?: Readonly<Record<string, number>>;
  /** On this machine one image takes several to over ten minutes. The UI shows the time cost. */
  slow: boolean;
}

/**
 * What a local music generation model bundle can do (architecture design §6.1, §6.3). The weights are read directly by the audio.cpp engine (`engine`: the bundle's `audiocpp-engine` component, or the path given by `CUCCUT_AUDIOCPP_CLI`) and do not go through the Model Worker. One clip at a time, WAV output only, accepts a seed.
 */
export interface MusicBundleProfile {
  family: string;
  /** Engine executable name (without suffix). */
  engine: string;
  /** Whether it can make songs (with lyrics), instrumentals, or both. */
  modes: MusicMode[];
  /** Limits on the style description and the lyrics (Unicode code points). */
  maxStyleChars: number;
  maxLyricsChars: number;
  /** Maximum length of one clip in seconds (the engine converts this to a token cap using its semantic frame rate), and the duration used when none is given. */
  maxDurationSec: number;
  defaultDurationSec: number;
  /** The engine's semantic token frame rate (tokens per second). `maxDurationSec` × this = the engine's `semantic_max_tokens`. */
  semanticTokensPerSec: number;
  /** Output sample rate. */
  sampleRate: number;
  /** Orchestration (the engine's `cot`): think about the overall structure before writing (`full`), only think about the melody (`melody`), or do not think (`off`). */
  planning: { options: MusicPlanning[]; default: MusicPlanning };
  /** Diffusion step counts a request may use. `default` is the step count when none is given (the engine uses the same default). */
  steps: SpeechKnobRange;
  /** Languages the lyrics support (BCP 47 primary language). `unverified` when upstream has not checked each one. */
  lyricLanguages: string[] | 'unverified';
  /** Weight files the engine needs (relative to the repository directory): the GGUF files for the main model and the VAE. */
  files: { model: string; vae: string };
  /**
   * Peak memory of the engine process (bytes). Upstream measured it only once, on a 32 GB NVIDIA card (Q8 main model plus F16 VAE, about 8.9 GB of VRAM). It was not re-measured in this repository. Resource scheduling uses it, and `peakEstimated` marks it as an estimate.
   */
  peakBytes: number;
  peakEstimated: true;
  /** On this machine one clip takes several minutes. The UI shows the time cost. */
  slow: boolean;
}

/**
 * What a local speech synthesis model bundle can do (architecture design §6.1, §6.3).
 *
 * - `presets`: where the preset voices come from. `model` means the model's own speakers (`speakers`). `builtin-reference` means built-in voices: reference recordings shipped with the app, where choosing one clones from that recording. `builtin-description` means the built-in voices' English voice descriptions, for models that generate a voice from a description.
 * - `voiceModes` lists only `preset` / `clone` / `describe`. Local models have no provider-account voices (`custom`).
 */
export interface SpeechBundleProfile {
  family: string;
  languages: 'any' | string[];
  voiceModes: Exclude<VoiceMode, 'custom'>[];
  presets: 'model' | 'builtin-reference' | 'builtin-description' | 'none';
  /** When `presets: 'model'`, the model's own speakers. */
  speakers?: string[];
  reference: { recommendedSeconds: [number, number]; withTranscriptSeconds: [number, number] | null; acceptsTranscript: boolean } | null;
  voiceDescription: SpeechVoiceDescription | null;
  instructions: 'style' | null;
  emotion: boolean;
  knobs: Partial<Record<'speed' | 'cfg' | 'steps', SpeechKnobRange>>;
  maxDurationSec: number | null;
  acceptsSeed: boolean;
  readings: SpeechReadings;
  sampleRate: number;
  slow: boolean;
}

/** Default transcription bundle on Apple Silicon (MOSS Transcribe). Use `defaultTranscribeBundle` to get the platform default. */
export const DEFAULT_TRANSCRIBE_BUNDLE = 'moss-transcribe-diarize@mlx-8bit';
/** Default transcription bundle on other platforms (Windows, Linux, Intel Mac): the same weights, candle backend. */
export const DEFAULT_CANDLE_TRANSCRIBE_BUNDLE = 'moss-transcribe-diarize@candle';
/** Qwen3-ASR 0.6B's MLX bundle (the smallest recognition bundle to download). */
export const QWEN3_ASR_0_6B_BUNDLE = 'qwen3-asr-0.6b@mlx-4bit';
/** Default transcription bundles per platform. When the other side's platform is unknown (for example, a remote node that has not reported its bundles), look in this order. */
export const DEFAULT_TRANSCRIBE_BUNDLES: readonly string[] = [DEFAULT_TRANSCRIBE_BUNDLE, DEFAULT_CANDLE_TRANSCRIBE_BUNDLE];

/** Silero VAD, shared by the recognition bundles. */
const SILERO_VAD: BundleComponentSource = {
  family: 'silero-vad',
  repo: 'aufklarer/Silero-VAD-v6.2.1-MLX',
  revision: '0046cea48b26401909b24292b688fbc9b6322bc5',
  weightBits: 32,
  parameters: 309_121,
};

const QWEN3_ASR_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://huggingface.co/Qwen/Qwen3-ASR-1.7B',
  commercialUse: true,
  // The license summary is for display. It is a getter, so it is generated in the current language when read (when listing status, or when serialized over the wire).
  get summary() {
    return M.qwen3AsrLicense().text;
  },
};

/**
 * The forced aligner shared by the recognition bundles (Qwen3-ASR, Whisper, MOSS), optional. When installed, the word timings of local recognition are aligned (`aligned`; MOSS aligns only lines longer than 5 seconds), and it provides the `align` capability. When not installed, timings are estimated from character length (architecture design §6.6).
 */
export const QWEN3_FORCED_ALIGNER: BundleComponentSource = {
  family: 'qwen3-forced-aligner',
  repo: 'aufklarer/Qwen3-ForcedAligner-0.6B-4bit',
  revision: 'f0e9f12a0ddbcb5f1e1b7f0339090628f1cede1d',
  optional: true,
  weightBits: 4,
  parameters: 917_728_896,
  license: {
    name: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B',
    commercialUse: true,
    get summary() {
      return M.qwen3AlignerLicense().text;
    },
  },
};

/**
 * WeSpeaker ResNet34-LM speaker embedding, optional. It is used to merge speakers across chunks for the self-segmenting model (MOSS). The Qwen3-ASR and Whisper bundles do not carry it; the “speaker diarization” bundle carries it (required, used together with Pyannote segmentation).
 * The MLX conversion bundle's model card says MIT, but the weights come from pyannote's WeSpeaker conversion, which upstream publishes under CC-BY-4.0, and the upstream license governs. CC-BY-4.0 requires attribution. The attribution (work, author, license and modifications) is written in the license's `summary`. The model bundle status's component carries this license so the UI can list it in the model details' license row (architecture design §6.3).
 */
export const WESPEAKER: BundleComponentSource = {
  family: 'wespeaker',
  repo: 'aufklarer/WeSpeaker-ResNet34-LM-MLX',
  revision: '26499ce11ad1b48ac96aacc8d6fa433f941bdc96',
  optional: true,
  weightBits: 32,
  parameters: 6_630_080,
  license: {
    name: 'CC-BY-4.0',
    url: 'https://huggingface.co/pyannote/wespeaker-voxceleb-resnet34-LM',
    commercialUse: true,
    get summary() {
      return M.wespeakerLicense().text;
    },
  },
};

/**
 * The MLX conversion bundle of Pyannote segmentation-3.0: the segmentation model of the “speaker diarization” bundle (it judges frame by frame who is speaking over sliding windows). candle reads the same repository.
 */
const PYANNOTE_SEGMENTATION: BundleComponentSource = {
  family: 'pyannote-segmentation',
  repo: 'aufklarer/Pyannote-Segmentation-MLX',
  revision: 'abef0110277063f0ea117a802832a3eba22af84c',
  weightBits: 32,
  parameters: 1_489_169,
};

const { optional: _optional, ...WESPEAKER_REQUIRED } = WESPEAKER;

/** The “speaker diarization” bundle on Apple Silicon (MLX). Core ML Whisper also uses it (in the Worker it is MLX's Pyannote and WeSpeaker). */
export const SPEAKER_DIARIZATION_BUNDLE = 'speaker-diarization@mlx';
/** The “speaker diarization” bundle on other platforms (candle, same set of repositories). GGML Whisper also uses it. */
export const SPEAKER_DIARIZATION_CANDLE_BUNDLE = 'speaker-diarization@candle';

/**
 * The “speaker diarization” bundle (architecture design §6.6): Pyannote segmentation plus WeSpeaker voiceprint clustering. It labels speakers after transcription for recognition bundles that do not diarize themselves (Qwen3-ASR, Whisper). When the AI tool “identify speakers” re-diarizes an existing transcript, it is loaded separately into the Model Worker (`diarize` in `job.run`).
 * MOSS diarizes on its own and does not use it. WeSpeaker and MOSS's speaker model are in the same repository; one copy is installed and shared.
 */
const SPEAKER_DIARIZATION: BundleDefinition = {
  bundleId: SPEAKER_DIARIZATION_BUNDLE,
  capability: 'diarize',
  backend: 'mlx',
  device: 'metal',
  get label() {
    return M.speakerDiarizationLabel().text;
  },
  components: { segmentation: PYANNOTE_SEGMENTATION, speaker: WESPEAKER_REQUIRED },
  license: {
    name: 'MIT',
    url: 'https://huggingface.co/pyannote/segmentation-3.0',
    commercialUse: true,
    get summary() {
      return M.pyannoteLicense().text;
    },
  },
};

/**
 * Whisper's tokenizer (`tokenizer.json` and so on), shared by large-v3 and turbo, taken from `openai/whisper-large-v3`, as a separate component. The old layout stacked only `tokenizer.json` into the weights repository directory. That does not count as installed: installs upgraded from the old layout need to download about 4 MB more. The MLX bundle's `generation_config.json` is also taken from here (mlx-community's repository does not have it). It was added to the manifest later, so the installed check follows the manifest on disk: a tokenizer component installed earlier still counts as installed (Core ML is unaffected), but without this file, handing it to an MLX bundle makes the Worker report `MODEL_NOT_INSTALLED`. Before the MLX bundles are listed, an old install must be made to download it.
 */
const WHISPER_TOKENIZER: BundleComponentSource = {
  family: 'whisper-tokenizer',
  repo: 'openai/whisper-large-v3',
  revision: '06f233fe06e710322aca913c1bc4249a0d71fce1',
};

const WHISPER_LARGE_V3_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://huggingface.co/openai/whisper-large-v3',
  commercialUse: true,
  get summary() {
    return M.whisperV3CoremlLicense().text;
  },
};

const WHISPER_TURBO_LICENSE: ModelLicense = {
  name: 'MIT',
  url: 'https://huggingface.co/openai/whisper-large-v3-turbo',
  commercialUse: true,
  get summary() {
    return M.whisperTurboCoremlLicense().text;
  },
};

/** The MLX conversion of the same weights (mlx-community's fp16 repository) is separately marked Apache-2.0. */
const WHISPER_LARGE_V3_MLX_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://huggingface.co/openai/whisper-large-v3',
  commercialUse: true,
  get summary() {
    return M.whisperV3MlxLicense().text;
  },
};

const WHISPER_TURBO_MLX_LICENSE: ModelLicense = {
  name: 'MIT',
  url: 'https://huggingface.co/openai/whisper-large-v3-turbo',
  commercialUse: true,
  get summary() {
    return M.whisperTurboMlxLicense().text;
  },
};

/** Vocal separation: the MLX conversion bundle of HTDemucs-FT (architecture design §6.1 `separateAudio`). candle reads the same repository (fp16 weights are upcast to f32 on load). */
const HTDEMUCS_FT_LICENSE: ModelLicense = {
  name: 'MIT',
  url: 'https://github.com/facebookresearch/demucs/blob/main/LICENSE',
  commercialUse: true,
  get summary() {
    return M.htdemucsLicense().text;
  },
};

/** The GGML conversion of the same weights (whisper.cpp repository) is separately marked MIT. */
const WHISPER_LARGE_V3_GGML_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://huggingface.co/openai/whisper-large-v3',
  commercialUse: true,
  get summary() {
    return M.whisperV3GgmlLicense().text;
  },
};

const WHISPER_TURBO_GGML_LICENSE: ModelLicense = {
  name: 'MIT',
  url: 'https://huggingface.co/openai/whisper-large-v3-turbo',
  commercialUse: true,
  get summary() {
    return M.whisperTurboGgmlLicense().text;
  },
};

/**
 * whisper.cpp's single-file GGML weights (vocabulary embedded, so no tokenizer component is needed). The files of the two bundles are in the same version of the same upstream repository. large-v3 is registered under the sibling directory `ggerganov/whisper.cpp-large-v3` (downloads still come from `ggerganov/whisper.cpp`; see the repository manifest's `sourceRepo`). Each of the two bundles is installed and removed separately; installing one does not pull down the other.
 */
const WHISPER_GGML_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1';

// Whisper's MLX, Core ML and GGML backends share one name (architecture design §6.5), and the UI does not expose bundleId.
const WHISPER_LARGE_V3_LABEL = 'Whisper large-v3';
const WHISPER_TURBO_LABEL = 'Whisper large-v3 turbo';

const QWEN3_ASR_0_6B: BundleDefinition = {
  bundleId: QWEN3_ASR_0_6B_BUNDLE,
  capability: 'transcribe',
  backend: 'mlx',
  device: 'metal',
  label: 'Qwen3-ASR 0.6B',
  components: {
    asr: {
      family: 'qwen3-asr',
      repo: 'aufklarer/Qwen3-ASR-0.6B-MLX-4bit',
      revision: 'bc441bd1e4295c1f42d9879f056049a925b6e013',
      weightBits: 4,
      parameters: 782_426_112,
    },
    vad: SILERO_VAD,
    aligner: QWEN3_FORCED_ALIGNER,
  },
  license: {
    name: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen3-ASR-0.6B',
    commercialUse: true,
    get summary() {
      return M.qwen3AsrLicense().text;
    },
  },
  diarization: SPEAKER_DIARIZATION_BUNDLE,
};

const QWEN3_ASR_1_7B: BundleDefinition = {
  bundleId: 'qwen3-asr-1.7b@mlx-8bit',
  capability: 'transcribe',
  backend: 'mlx',
  device: 'metal',
  label: 'Qwen3-ASR 1.7B',
  components: {
    asr: {
      family: 'qwen3-asr',
      repo: 'aufklarer/Qwen3-ASR-1.7B-MLX-8bit',
      revision: 'e5450a26d1fd417c45fc9c405651ddc3180a27a6',
      weightBits: 8,
      parameters: 2_038_052_480,
    },
    vad: SILERO_VAD,
    aligner: QWEN3_FORCED_ALIGNER,
  },
  license: QWEN3_ASR_LICENSE,
  diarization: SPEAKER_DIARIZATION_BUNDLE,
};

// Segments itself and carries speakers (no VAD). When the speaker model is installed, it is used to merge speakers across chunks. When the aligner is installed, word timing for long lines is aligned.
const MOSS_TRANSCRIBE_DIARIZE: BundleDefinition = {
  bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
  capability: 'transcribe',
  backend: 'mlx',
  device: 'metal',
  label: 'MOSS Transcribe',
  components: {
    asr: {
      family: 'moss-transcribe-diarize',
      repo: 'OpenMOSS-Team/MOSS-Transcribe-Diarize',
      revision: 'e5118b411bf5a77d7a90c4941066bec93c967312',
      weightBits: 16,
      parameters: 908_513_280,
    },
    aligner: QWEN3_FORCED_ALIGNER,
    speaker: WESPEAKER,
  },
  license: {
    name: 'Apache-2.0',
    url: 'https://huggingface.co/OpenMOSS-Team/MOSS-Transcribe-Diarize',
    commercialUse: true,
    get summary() {
      return M.mossLicense().text;
    },
  },
};

/**
 * The candle backend's version of the same model bundle. Repository, components, license and name are unchanged; only the backend changes (architecture design §6.5). The registered device is `cpu`. When the Worker handshake reports CUDA, the Runtime uses the device the Worker reports. The “speaker diarization” bundle used alongside is also swapped for candle's.
 */
function onCandle(def: BundleDefinition, bundleId: string): BundleDefinition {
  // Copied by property descriptors. A name that is a getter (“speaker diarization”) is still generated in the current language when read. A spread expression would evaluate it here and freeze it.
  const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(def)) as BundleDefinition;
  return Object.assign(copy, {
    bundleId,
    backend: 'candle' as const,
    device: 'cpu',
    ...(def.diarization ? { diarization: SPEAKER_DIARIZATION_CANDLE_BUNDLE } : {}),
  });
}

const HTDEMUCS_FT: BundleDefinition = {
  bundleId: 'htdemucs-ft@mlx',
  capability: 'separate',
  backend: 'mlx',
  device: 'metal',
  components: {
    separator: { family: 'htdemucs-ft', repo: 'aufklarer/HTDemucs-FT-MLX', revision: '39820e356306479d81dacb9f1042e5de86d49e29' },
  },
  label: 'HTDemucs-FT',
  license: HTDEMUCS_FT_LICENSE,
};

export const BUNDLES: readonly BundleDefinition[] = [
  QWEN3_ASR_0_6B,
  QWEN3_ASR_1_7B,
  {
    bundleId: 'whisper-large-v3@coreml',
    capability: 'transcribe',
    backend: 'coreml',
    device: 'ane',
    label: WHISPER_LARGE_V3_LABEL,
    components: {
      asr: {
        family: 'whisper-coreml',
        repo: 'argmaxinc/whisperkit-coreml',
        revision: '97a5bf9bbc74c7d9c12c755d04dea59e672e3808',
        subdir: 'openai_whisper-large-v3_947MB',
      },
      vad: SILERO_VAD,
      tokenizer: WHISPER_TOKENIZER,
      aligner: QWEN3_FORCED_ALIGNER,
    },
    license: WHISPER_LARGE_V3_LICENSE,
    diarization: SPEAKER_DIARIZATION_BUNDLE,
  },
  {
    bundleId: 'whisper-large-v3-turbo@coreml',
    capability: 'transcribe',
    backend: 'coreml',
    device: 'ane',
    label: WHISPER_TURBO_LABEL,
    components: {
      asr: {
        family: 'whisper-coreml',
        repo: 'aufklarer/Whisper-Large-v3-Turbo-CoreML',
        revision: 'a8e93b2084b3d0a09765b2e3a5602a3d2b8f8d25',
      },
      vad: SILERO_VAD,
      tokenizer: WHISPER_TOKENIZER,
      aligner: QWEN3_FORCED_ALIGNER,
    },
    license: WHISPER_TURBO_LICENSE,
    diarization: SPEAKER_DIARIZATION_BUNDLE,
  },
  // MLX Whisper (mlx-community's fp16 conversion): the decoding config and the tokenizer are in the tokenizer component from openai/whisper-large-v3.
  {
    bundleId: 'whisper-large-v3@mlx',
    capability: 'transcribe',
    backend: 'mlx',
    device: 'metal',
    label: WHISPER_LARGE_V3_LABEL,
    components: {
      asr: { family: 'whisper-mlx', repo: 'mlx-community/whisper-large-v3-fp16', revision: '5467ef1f82cf0e110f521092acb434d9c82b5d5a' },
      vad: SILERO_VAD,
      tokenizer: WHISPER_TOKENIZER,
      aligner: QWEN3_FORCED_ALIGNER,
    },
    license: WHISPER_LARGE_V3_MLX_LICENSE,
    diarization: SPEAKER_DIARIZATION_BUNDLE,
  },
  {
    bundleId: 'whisper-large-v3-turbo@mlx',
    capability: 'transcribe',
    backend: 'mlx',
    device: 'metal',
    label: WHISPER_TURBO_LABEL,
    components: {
      asr: {
        family: 'whisper-mlx',
        repo: 'mlx-community/whisper-large-v3-turbo-fp16',
        revision: '258e98b1f53da60a0a51c1e45e480ffa3ec71e23',
      },
      vad: SILERO_VAD,
      tokenizer: WHISPER_TOKENIZER,
      aligner: QWEN3_FORCED_ALIGNER,
    },
    license: WHISPER_TURBO_MLX_LICENSE,
    diarization: SPEAKER_DIARIZATION_BUNDLE,
  },
  MOSS_TRANSCRIBE_DIARIZE,
  onCandle(QWEN3_ASR_0_6B, 'qwen3-asr-0.6b@candle'),
  onCandle(QWEN3_ASR_1_7B, 'qwen3-asr-1.7b@candle'),
  onCandle(MOSS_TRANSCRIBE_DIARIZE, DEFAULT_CANDLE_TRANSCRIBE_BUNDLE),
  SPEAKER_DIARIZATION,
  onCandle(SPEAKER_DIARIZATION, SPEAKER_DIARIZATION_CANDLE_BUNDLE),
  // whisper.cpp Whisper: the registered device is `cpu`. When the Worker handshake reports a GPU, the Runtime switches to it (`cuda` or `vulkan`, same approach as candle).
  {
    bundleId: 'whisper-large-v3@ggml',
    capability: 'transcribe',
    backend: 'ggml',
    device: 'cpu',
    label: WHISPER_LARGE_V3_LABEL,
    components: {
      asr: { family: 'whisper-ggml', repo: 'ggerganov/whisper.cpp-large-v3', revision: WHISPER_GGML_REVISION },
      vad: SILERO_VAD,
      aligner: QWEN3_FORCED_ALIGNER,
    },
    license: WHISPER_LARGE_V3_GGML_LICENSE,
    diarization: SPEAKER_DIARIZATION_CANDLE_BUNDLE,
  },
  {
    bundleId: 'whisper-large-v3-turbo@ggml',
    capability: 'transcribe',
    backend: 'ggml',
    device: 'cpu',
    label: WHISPER_TURBO_LABEL,
    components: {
      asr: { family: 'whisper-ggml', repo: 'ggerganov/whisper.cpp', revision: WHISPER_GGML_REVISION },
      vad: SILERO_VAD,
      aligner: QWEN3_FORCED_ALIGNER,
    },
    license: WHISPER_TURBO_GGML_LICENSE,
    diarization: SPEAKER_DIARIZATION_CANDLE_BUNDLE,
  },
  ...SPEECH_BUNDLES,
  ...IMAGE_BUNDLES,
  ...MUSIC_BUNDLES,
  HTDEMUCS_FT,
  onCandle(HTDEMUCS_FT, 'htdemucs-ft@candle'),
];

/**
 * Whether a backend can be used on this machine. `mlx` and `coreml` only on Apple Silicon macOS; `candle` and `ggml` on all platforms (CPU); `audio-cpp` on all platforms (the engine is built with Metal, CUDA, Vulkan or CPU. The engine is the bundle's `audiocpp-engine` component. When the host platform has no archive for it, the model catalog separately reports `unsupported`).
 */
export function backendSupported(backend: ModelBackend, platform: NodeJS.Platform, arch: string): boolean {
  if (backend === 'mlx' || backend === 'coreml') return platform === 'darwin' && arch === 'arm64';
  return true;
}

function appleSilicon(platform: NodeJS.Platform, arch: string): boolean {
  return platform === 'darwin' && arch === 'arm64';
}

/**
 * Registered and loadable, but not listed. Only one variant of a model is listed per platform (architecture design §6.5). On Apple Silicon, Whisper lists the Core ML one. MLX's (`whisper-mlx`) recognizes a whole long audio as fast as Core ML does, but when VAD cuts it into short segments, each segment runs the 30-second encoder to completion, making the transcription pipeline about 1.3 times slower. Whether to switch is decided by the open review item in §14.
 */
const UNLISTED_BUNDLES: ReadonlySet<string> = new Set(['whisper-large-v3@mlx', 'whisper-large-v3-turbo@mlx']);

/**
 * Bundles listed on this machine (architecture design §6.5). Apple Silicon lists only the MLX and Core ML ones (the same models are slower on candle and GGML, so they are not offered). Other platforms list only the candle and GGML ones (MLX and Core ML cannot run there). [`UNLISTED_BUNDLES`] is listed nowhere.
 */
export function platformBundles(
  platform: NodeJS.Platform,
  arch: string,
  bundles: readonly BundleDefinition[] = BUNDLES,
): BundleDefinition[] {
  return bundles.filter(
    (b) =>
      !UNLISTED_BUNDLES.has(b.bundleId) &&
      (appleSilicon(platform, arch) ? b.backend !== 'candle' && b.backend !== 'ggml' : backendSupported(b.backend, platform, arch)),
  );
}

/** The default transcription bundle on this machine: MLX on Apple Silicon, candle on other platforms. */
export function defaultTranscribeBundle(platform: NodeJS.Platform, arch: string): string {
  return appleSilicon(platform, arch) ? DEFAULT_TRANSCRIBE_BUNDLE : DEFAULT_CANDLE_TRANSCRIBE_BUNDLE;
}

/**
 * Approximate resident size (bytes) of a candle bundle's Model Worker after loading (architecture design §6.5). candle converts weights to the compute precision: f32 on CPU, half precision on CUDA. Each component is parameter count × 4 (CPU) or × 2 (CUDA). Without `parameters`, it is stored bytes × compute bit width / `weightBits` (for fully quantized weights, about 8× at 4 bits and 4× at 8 bits; larger when some parts are unquantized). With neither, it is stored bytes.
 */
export function candleResidentBytes(
  device: string,
  components: ReadonlyArray<{ bytes: number; weightBits?: number; parameters?: number }>,
): number {
  const computeBits = device === 'cuda' ? 16 : 32;
  const resident = (c: { bytes: number; weightBits?: number; parameters?: number }) =>
    c.parameters ? (c.parameters * computeBits) / 8 : c.weightBits ? (c.bytes * computeBits) / c.weightBits : c.bytes;
  return Math.round(components.reduce((sum, c) => sum + resident(c), 0));
}

/** A bundle's required components (excluding `optional` ones). When all of them are installed, the bundle counts as installed. */
export function requiredSources(def: Pick<BundleDefinition, 'components'>): BundleComponentSource[] {
  return Object.values(def.components).filter((s): s is BundleComponentSource => s !== undefined && !s.optional);
}
