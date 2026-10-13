import type { Id } from './domain.ts';
import { ProtocolLabels } from './messages/protocol/protocol-labels.ts';
import type { MessageRef } from './message-ref.ts';

/**
 * Status of a local model bundle (architecture design §6.3, §6.5). `models.list` returns it.
 *
 * A model bundle is one build of a main model and its fixed dependencies (VAD, etc.) on a given backend, e.g. `qwen3-asr-0.6b@mlx-4bit`.
 */

/**
 * What a model bundle can do: `transcribe` / `align` are speech-recognition bundles, `synthesize` is a local speech-synthesis bundle (exposed as `synthesizeSpeech`),
 * `separate` is a vocal/accompaniment separation bundle (dubbing's `separateAudio` runs on it), `image` is a local text-to-image bundle (exposed as `generateImage`).
 * `diarize` is a "speaker diarization" bundle (Pyannote segmentation + WeSpeaker voiceprints, architecture design §6.6): it runs no tasks by itself. Once installed, recognition bundles that do not diarize on their own (Qwen3-ASR, Whisper) carry its components when transcribing, and attach speaker labels to segments and words.
 */
export type ModelCapability = 'transcribe' | 'align' | 'synthesize' | 'separate' | 'image' | 'diarize' | 'music';
/**
 * `mlx` and `coreml` (Whisper's CoreML bundle) are available only on macOS with Apple Silicon; `candle` is available on all platforms; `ggml` (Whisper's whisper.cpp bundle)
 * is available on all platforms, and is not listed on Apple Silicon. `audio-cpp` is the local music-generation bundle (GGUF weights, run by the `audiocpp_cli` of audio.cpp,
 * architecture design §6.5): available on all platforms; the device depends on how the engine was built (Metal, CUDA, Vulkan or CPU).
 */
export type ModelBackend = 'mlx' | 'coreml' | 'candle' | 'ggml' | 'audio-cpp';

/**
 * - `not-installed`: manifest missing, files missing or size mismatch, sha256 verification fails, or loading reports wrong files; when some components are installed and others are not,
 *   `reason: 'incomplete'`, and `components` lists which ones are missing (install only fills in the missing components, it does not re-download the whole bundle);
 * - `downloading`: an install or repair task is queued or in progress; `install` carries the bytes received so far;
 * - `installed`: files complete, Worker has not loaded it;
 * - `loading` / `ready` / `busy` / `unloading`: Worker states;
 * - `error`: unavailable, `reason` explains why (`unsupported`: this machine's platform or backend is not supported; `resource`: insufficient resources, or disabled after repeated crashes, re-enable with
 *   `models.enable`; `worker-missing`: no Model Worker executable was found). The engine of a music bundle (`audio-cpp`) is its component
 *   `audiocpp-engine`: if the weights are present but the engine is not, it is `not-installed` / `incomplete`; if the host platform has no engine package (and no `CUCCUT_AUDIOCPP_CLI`), it is
 *   `error` / `unsupported`.
 *
 * When the progress is unknown, do not fabricate a percentage: `install.totalBytes` is null when the total size is unknown.
 */
export type ModelBundleState = 'not-installed' | 'downloading' | 'installed' | 'loading' | 'ready' | 'busy' | 'unloading' | 'error';

export type ModelBundleReason =
  | 'unsupported'
  | 'resource'
  | 'worker-missing'
  | 'missing-manifest'
  | 'missing-file'
  | 'size-mismatch'
  | 'hash-mismatch'
  | 'load-failed'
  | 'incomplete'
  /** The model is being moved to a new model directory (`move` in `models.setDir`): it cannot be used until the move finishes. */
  | 'relocating';

export interface ModelBundleStatus {
  bundleId: string;
  capability: ModelCapability;
  /** Human-readable name (every registered model bundle has one; older snapshots may not, in which case use `bundleId`). */
  label?: string;
  /** Weight license: a bundle with `commercialUse: false` may only be used non-commercially, and the user must see this before installing. */
  license?: ModelLicense;
  backend: ModelBackend;
  device: string;
  /** Download size (bytes) of the required components, from the built-in manifest; null when a component has no registered manifest. Given whether or not the bundle is installed, so the size can be shown before downloading (Runtime always provides it; older snapshots may not). */
  estimatedBytes?: number | null;
  state: ModelBundleState;
  reason?: ModelBundleReason;
  /** Supplementary note for people (which file is missing, which platform). Contains no absolute local paths. */
  detail?: string;
  /** Message reference for `detail` (message-ref.ts). */
  detailRef?: MessageRef;
  /** The components that make up the bundle (the main model's weights, plus the shared VAD, aligner, ...), and whether each one is installed. */
  components?: ModelComponentStatus[];
  /** Install progress: downloading, or the partial data left in the staging area when it last stopped (`paused`; another `models.install` resumes from here). */
  install?: ModelInstallProgress;
  /** Result of the most recent check (`models.test`). */
  selfTest?: ModelSelfTestResult;
}

/**
 * A component of a model bundle: one pinned version of an upstream repo, installed at `<models-root>/<owner>/<repo>/`. Components shared by several bundles (VAD, etc.) are installed once and
 * kept by reference: deleting a bundle reclaims only the components that no other bundle is using. Components from GitHub release pages (`origin: 'github-release'`, the audio.cpp engine of music bundles) are
 * platform-specific: one archive is fetched for the host the Runtime runs on and installed at `tools/<name>/<version>/` under the Runtime Home.
 */
export interface ModelComponentStatus {
  /** `asr`、`vad`、`aligner`、`audiocpp-engine`…… */
  component: string;
  /** `<owner>/<repo>` (for release-page components, the upstream GitHub repo name) */
  repo: string;
  /** Upstream commit (for release-page components, the release tag, e.g. `v0.9.1`). */
  revision: string;
  /**
   * Where the component is downloaded from. Absent means the model repository (Hugging Face or the configured mirror). `github-release` is a precompiled package from a GitHub release page (chosen by host platform,
   * and can be replaced by a download mirror tool), installed under `tools/` in the Runtime Home rather than in the model directory.
   */
  origin?: 'github-release';
  /** `installed`: manifest and files complete; `missing`: not installed or incomplete (missing files, size mismatch, wrong version). */
  state: 'installed' | 'missing';
  /**
   * Bytes the component occupies once installed (the sum of sizes in the manifest); null when not installed. For release-page components, it counts as installed when `CUCCUT_AUDIOCPP_CLI` points to an engine built locally,
   * and is null in that case too.
   */
  bytes: number | null;
  /**
   * Download size (bytes) of this component, from the built-in manifest; null when no manifest is registered. Given whether or not it is installed, so the UI can show how much will be downloaded when a component is missing (Runtime always provides it; older snapshots
   * may not).
   */
  estimatedBytes?: number | null;
  /** Other model bundles that also use this component (same repo and version). */
  sharedWith: string[];
  /** Optional components (aligner, speaker model): installs and repairs still download them, but when one is missing the model bundle still counts as installed and works normally. */
  optional?: boolean;
  /**
   * The component's own license (only when registered; aligner, speaker model). Licenses such as `CC-BY` that require attribution have the attribution written in `summary`. Lets the UI list, in the model's detail license rows, components whose license differs from the weight license or requires attribution.
   */
  license?: ModelLicense;
}

export interface ModelInstallProgress {
  /** The install or repair task in progress; null when `paused` (no task is running). */
  jobId: Id | null;
  state: 'queued' | 'downloading' | 'verifying' | 'paused';
  /** Bytes already received and kept in the staging area (including any partial left from before an earlier resume). */
  receivedBytes: number;
  /** Total bytes to download this time; null when upstream did not give a size (no fabricated percentage). */
  totalBytes: number | null;
}

/** Conclusion of the most recent check (`models.test`). The field name `selfTest` is kept. */
export interface ModelSelfTestResult {
  state: 'passed' | 'failed';
  jobId: Id;
  /** End time. */
  at: string;
  /** Reason for failure, or the recognized text when it passed (a fixed sample, no user content). */
  detail?: string;
  /** Message reference when `detail` is Runtime copy (message-ref.ts): the UI regenerates it in its own language. Recognized text and old records do not have it. */
  detailRef?: MessageRef;
  /** Reason the check did not pass (only present when `failed`). Old records lack this item and are treated as an unrecognized reason. */
  code?: ModelCheckCode;
  /** Technical details when the check did not pass (one `key: value` per line: the Worker's error code and description, component, file, actual result), for filing issue reports. Contains no absolute local paths. */
  facts?: string[];
}

/**
 * Reasons a check did not pass (command and protocol spec §11.3). `selfTest.code` on a model bundle and `error.details.check` on a failed `modelTest` task use the same set of values;
 * the task's `error.code` remains `MODEL_SELF_TEST_FAILED` (except for `APP_FILE_MISSING`).
 * - `APP_FILE_MISSING`: a file shipped with the app (samples, recordings for built-in voices) is missing; the installation is incomplete, not a problem with the model (not recorded in `selfTest`);
 * - `MODEL_FILES_DAMAGED`: the model's files are missing or corrupt, so the Worker cannot load it;
 * - `MODEL_OUTPUT_WRONG`: the model loads and runs, but its output is wrong (does not meet the contract, fails to recognize the sample, synthesis is silent...);
 * - `MODEL_OUT_OF_MEMORY`: not enough memory, the model could not be loaded;
 * - `MODEL_WORKER_FAILED`: the Model Worker fails to start, exits midway, does not support this model, or has been disabled.
 */
export const MODEL_CHECK_CODES = [
  'APP_FILE_MISSING',
  'MODEL_FILES_DAMAGED',
  'MODEL_OUTPUT_WRONG',
  'MODEL_OUT_OF_MEMORY',
  'MODEL_WORKER_FAILED',
] as const;
export type ModelCheckCode = (typeof MODEL_CHECK_CODES)[number];

/**
 * Whether repair (`models.repair`, which only re-downloads the broken files) helps with this reason: `yes` the files are broken, and repair fixes it; `maybe` the output is wrong, which may come from broken files, so repair is worth trying first;
 * `no` it is not a model-file problem (app-bundled files, memory, the Worker). An unrecognized code is `no`.
 */
export function modelCheckRepair(code: string | null | undefined): 'yes' | 'maybe' | 'no' {
  if (code === 'MODEL_FILES_DAMAGED') return 'yes';
  if (code === 'MODEL_OUTPUT_WRONG') return 'maybe';
  return 'no';
}

/** A recognized check code; null for others (including those absent from older records). */
export function modelCheckCode(value: unknown): ModelCheckCode | null {
  return typeof value === 'string' && (MODEL_CHECK_CODES as readonly string[]).includes(value) ? (value as ModelCheckCode) : null;
}

/**
 * What installing (or repairing) a model bundle will do (returned by the first step of `models.install` / `models.repair`, architecture design §6.3):
 * the caller returns `confirmBytes` unchanged to start the download.
 */
export interface ModelInstallPlan {
  bundleId: string;
  /** Per component: `installed` is left alone; `missing` downloads the missing files; `damaged` (sha256 check fails during repair) re-downloads only the broken files. */
  components: Array<{
    component: string;
    repo: string;
    revision: string;
    /** Same as `ModelComponentStatus.origin`: a `github-release` component downloads one archive, verifies it, then extracts it to `tools/<name>/<version>/`. */
    origin?: 'github-release';
    action: 'keep' | 'download';
    /** Files to download (relative to the repo directory; for release-page components, the archive file name). */
    files: string[];
    /** Bytes this component will download; null when some file size is unknown. */
    bytes: number | null;
  }>;
  /** Total bytes to download this time (excluding parts already received in the staging area); null when some file size is unknown. */
  downloadBytes: number | null;
  /** Bytes given by the registered estimate when a size is unknown (for reference only). */
  estimatedBytes: number;
  /** Bytes used for confirmation: `downloadBytes`, or `estimatedBytes` when unknown. */
  confirmBytes: number;
  /** Bytes already received in the staging area that will not be downloaded again this time. */
  resumedBytes: number;
  /** Free space on the disk holding the model directory; null if it cannot be determined. */
  availableBytes: number | null;
  /** Base URL of the download source (no credentials). */
  source: string;
  /** Nothing to download (everything is already installed). */
  upToDate: boolean;
}

export interface ModelInstallResult {
  plan: ModelInstallPlan;
  /** The install task that was started; null when not yet confirmed or when there is nothing to download. If the same bundle is already installing, this is that task. */
  jobId: Id | null;
}

export interface ModelRemoveResult {
  /** Removed repos (`<owner>/<repo>`). */
  removed: string[];
  /** Repos kept because other model bundles are still using them. */
  kept: Array<{ repo: string; usedBy: string[] }>;
  bundle: ModelBundleStatus;
}

// ---- Download source (architecture design §6.3 "Source", §5.10 `models.downloadEndpoint`): used by Runtime downloads; the settings page uses it to recognize which one is selected ----

/** Download source when set to null: the public model repository. */
export const DEFAULT_MODELS_ENDPOINT = 'https://huggingface.co';
/** Base URL saved when ModelScope is selected. */
export const MODELSCOPE_ENDPOINT = 'https://www.modelscope.cn';

const MODELSCOPE_HOSTS: ReadonlySet<string> = new Set(['modelscope.cn', 'www.modelscope.cn']);

/** The base URL points to ModelScope (recognized by host). */
export function isModelScopeEndpoint(endpoint: string): boolean {
  try {
    return MODELSCOPE_HOSTS.has(new URL(endpoint).hostname);
  } catch {
    return false;
  }
}

// ---- Model directory (architecture design §6.3, §5.10): which folder local models are stored in ----

/**
 * Where the effective model directory comes from: the environment variable `CUCCUT_MODELS_DIR` (read-only; to change it, change the environment variable and restart), the setting `models.dir`,
 * or the default `<runtime-home>/models`.
 */
export type ModelsDirSource = 'env' | 'setting' | 'default';

/** Result of `models.getDir`: the effective model directory and its usage. */
export interface ModelsDirInfo {
  /** The effective model directory (absolute path). */
  path: string;
  source: ModelsDirSource;
  /** Default location (`<runtime-home>/models`); "Restore default" switches back to this. */
  defaultPath: string;
  /** Whether the directory exists (false when an external drive is not connected: models show as not installed, and installation is refused). */
  exists: boolean;
  writable: boolean;
  /** Sum of sizes of the model repos recognized in the directory (those with `.ccut-manifest.json`); a repo shared by several bundles counts once. */
  usedBytes: number;
  /** Free space on the disk it is on; null when it cannot be read. */
  freeBytes: number | null;
  /** Number of model bundles whose components are all in this directory (regardless of whether the platform supports them). */
  modelCount: number;
  /** The task moving models to the new directory (`kind: 'modelsMove'`); null when there is none. */
  moveJobId: Id | null;
  /** The target directory of that move; null when there is none. */
  moveTo: string | null;
}

/** A model repo recognized in a folder: a `<owner>/<repo>` directory that contains a valid `.ccut-manifest.json`. */
export interface ModelsDirRepo {
  repo: string;
  revision: string;
  /** Sum of the file sizes in the manifest. */
  bytes: number;
  /** Whether it is a repo and version used by a registered model bundle (if not, it is not moved and not counted in the model count). */
  known: boolean;
}

/**
 * Result of `models.inspectDir`: what to know before changing to this folder. Read-only; it writes nothing in the folder.
 * `problem`: `missing` means it does not exist or is not a folder; `not-writable` means no write permission; `nested` means it contains, or is contained by, the current directory (cannot move or switch);
 * `same` means it is the current directory itself; null means it can be changed.
 */
export interface ModelsDirInspection {
  path: string;
  exists: boolean;
  writable: boolean;
  freeBytes: number | null;
  problem: 'missing' | 'not-writable' | 'nested' | 'same' | null;
  /** Models already in this folder. */
  found: { repos: ModelsDirRepo[]; bundleIds: string[]; bytes: number };
  /** Models in the current directory to be moved over (only registered repos are counted). */
  current: { repos: ModelsDirRepo[]; bundleIds: string[]; bytes: number };
  /**
   * When "move" is chosen: the bytes to carry (a repo and version already present in the target is not carried again), whether it is on the same disk (a rename, no new space) or a different disk (copy, verify, then delete the source), and
   * whether it fits. `requiredBytes` is 0 when the current directory has no models.
   */
  move: { requiredBytes: number; sameVolume: boolean; fits: boolean };
}

/**
 * How the model directory is changed (`models.setDir`):
 * - `move`: move the registered model repos and install records in the current directory to the new one, then switch to it (one `modelsMove` task);
 * - `switch`: only change the location. The files in the original directory are kept as they are; models already in the new directory are usable right away, and the rest show as not installed.
 * When the current directory has no models, the two are the same.
 */
export type ModelsDirMode = 'move' | 'switch';

export interface ModelsDirChangeResult {
  /** Directory info after `switch` (or when `move` is submitted); `move` only switches over after the task completes. */
  dir: ModelsDirInfo;
  /** The `move` task; null for `switch`. */
  jobId: Id | null;
}

// ---- Model services (architecture design §6.1, §6.2, §6.8): capability × Provider ----

/**
 * Capabilities of model services. These are a different vocabulary from the `ModelCapability` of model bundles above (what a local bundle can do): here it is what a Provider offers externally.
 * `transcribe` is available from local, node and online Providers; `synthesizeSpeech` from local (installed speech-synthesis bundles) and online Providers; `generateImage` from local (installed
 * text-to-image bundles), online and agent Providers;
 * `generateText` only from online Providers (LAN nodes do not share it); `separateAudio` (vocal and background separation) only from local Providers (installed separation bundles),
 * and is used by dubbing; `generateMusic` (songs and background music) only from local Providers (installed music-generation bundles). `transcribe` and `separateAudio`
 * have factory defaults; the others do not.
 */
export type ModelServiceCapability = 'transcribe' | 'synthesizeSpeech' | 'generateImage' | 'generateText' | 'separateAudio' | 'generateMusic';
export const MODEL_SERVICE_CAPABILITIES: readonly ModelServiceCapability[] = [
  'transcribe',
  'synthesizeSpeech',
  'generateImage',
  'generateText',
  'separateAudio',
  'generateMusic',
];

/**
 * Capabilities that have online Providers: the cloud page, the models declared by self-hosted providers, and the external model API (`/v1/*`) involve only these. `separateAudio` and `generateMusic`
 * are local-only and are not in this list.
 */
export type OnlineCapability = Exclude<ModelServiceCapability, 'separateAudio' | 'generateMusic'>;
export const ONLINE_CAPABILITIES: readonly OnlineCapability[] = ['transcribe', 'synthesizeSpeech', 'generateImage', 'generateText'];

/**
 * Provider sources: `local` (this machine's Model Worker), `node` (a paired LAN node, `node:<nodeId>`),
 * `online` (`openai`, `google`, `elevenlabs`, and user-defined compatible endpoints `custom:<slug>`),
 * `agent` (an agent runtime installed and signed in on this machine, `agent:<driverId>`; the first release has only `agent:codex`, architecture design §6.9).
 */
export type ProviderKind = 'local' | 'node' | 'online' | 'agent';

/**
 * Reasons a Provider or model is unavailable right now:
 * - `not-configured`: an online or agent Provider is not enabled (never configured, or disabled);
 * - `missing-credential`: enabled, but no key;
 * - `not-installed`: local model bundle not installed, or its files are wrong; agent Provider: the agent runtime is not installed;
 * - `signed-out`: the agent runtime is not signed in (sign in in its own interface; CucCut does not handle the account);
 * - `outdated`: the agent runtime's version is below the minimum this Provider requires;
 * - `not-paired` / `not-connected`: the node is not paired or cannot be reached;
 * - `unsupported`: this machine, this node or this version does not support it;
 * - `resource`: disabled after repeated crashes or insufficient resources (re-enable with `models.enable`).
 */
export type ProviderUnavailableReason =
  | 'not-configured'
  | 'missing-credential'
  | 'not-installed'
  | 'signed-out'
  | 'outdated'
  | 'not-paired'
  | 'not-connected'
  | 'unsupported'
  | 'resource';

/** Fields that the model descriptions of every capability have. For local and node, `modelId` is the model bundle ID; for online, it is the vendor's model name. */
export interface ModelInfoBase {
  modelId: string;
  label: string;
  /** The default model of this Provider under this capability. */
  default?: boolean;
  /** User-declared models (custom endpoints): the limits and features are given by the user and treated at the `declared` tier (§3.6). */
  declared?: boolean;
  /** Local and node report availability per model bundle; when not given, it is the same as their Provider. */
  available?: boolean;
  unavailableReason?: ProviderUnavailableReason;
  detail?: string;
  /** Message reference for `detail` (message-ref.ts). */
  detailRef?: MessageRef;
  /** Limits that the structured fields cannot express, as one sentence for people (and agents), e.g. an agent Provider's serialization and duration (§6.9). */
  notes?: string;
  /**
   * Unit price (optional): present only when the vendor publishes a trustworthy unit price and the description gives it. It is used to estimate an upper bound on the cost of one call (architecture design §7.8).
   * When absent, the cost is unknown (`cost: 'unknown'`), and an authorization with a cost cap cannot guarantee the cap. Do not write pseudo-precise prices; the built-in models currently have none.
   */
  price?: ModelPrice;
}

/** Unit price: how much each request, each image, or each thousand characters (of text for synthesized speech) costs. The amount is a decimal string. */
export interface ModelPrice {
  currency: string;
  amount: string;
  unit: 'request' | 'image' | '1k-chars';
}

/**
 * Cost status: local is free (`free-local`); online with a trustworthy unit price is `estimate`, and without one `unknown`; agent Providers use the user's existing subscription, and `subscription` means "within the subscription, quota unknown". Do not write pseudo-precise amounts.
 */
export type ModelCost = 'free-local' | 'estimate' | 'unknown' | 'subscription';

/** Model description for `transcribe`. */
export interface TranscribeModelInfo extends ModelInfoBase {
  /** Upper limit on the input size of one request (bytes); null means no limit. When exceeded, the adapter submits in slices. */
  maxInputBytes: number | null;
  /** Upper limit on the audio duration of one request (seconds); null means no limit. */
  maxDurationSec: number | null;
  /** `native`: returns word-level timestamps; `none`: only segment-level timestamps or no timestamps, with word timing interpolated by character length and marked `estimated`. */
  wordTimestamps: 'native' | 'none';
  /** Supported languages (BCP 47 primary language subtags); `any` means no limit. */
  languages: 'any' | string[];
  /** Whether term hints (`hint`) are accepted. */
  acceptsHint: boolean;
  /**
   * Whether speakers can be told apart (`diarize`): `native` means the model tells them apart itself (MOSS); `pack` means the speaker-diarization bundle is installed and diarization happens after transcription
   * (Qwen3-ASR, Whisper; architecture design §6.6); `none` means no diarization (`diarize` only reports `diarization-unavailable`). When absent, it is treated as `none`.
   */
  speakers?: 'native' | 'pack' | 'none';
  /**
   * The speaker-diarization bundle (`bundleId`) used to tell speakers apart after transcription: the local bundles for Qwen3-ASR and Whisper register it, whether or not it is installed,
   * so the UI knows that installing it lets diarization work (`speakers` only says whether it can be used right now). Models that diarize on their own (MOSS) and online models do not provide it.
   */
  diarizationPack?: string;
  cost: ModelCost;
}

/** A vocal-separation model (a local separation bundle): it outputs two audio tracks, vocals and background, each with the same length and sample rate as the input (architecture design §6.1). */
export interface SeparateModelInfo extends ModelInfoBase {
  cost: ModelCost;
}

/** Output formats of synthesized speech (all carry their own container header and are recognized by ffprobe; no raw PCM is offered). */
export type SpeechFormat = 'mp3' | 'wav' | 'flac';
export const SPEECH_FORMATS: readonly SpeechFormat[] = ['mp3', 'wav', 'flac'];

/** Output format of generated images. */
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export const IMAGE_FORMATS: readonly ImageFormat[] = ['png', 'jpeg', 'webp'];

/**
 * How a voice is specified: `preset` is a voice built into the model (listed in `voices`); `custom` is a voice ID in the vendor account (cloned, or from the voice library), passed to the vendor unchanged, which validates it. Local models have two more: `clone` is a reference recording plus its transcript (the request's `reference`, or the reference recording of a voice-library entry `library:<id>`), and `describe` is one sentence describing the voice (the request's `voiceDescription`). A method the model does not support is rejected at submission, not replaced with a different voice.
 */
export type VoiceMode = 'preset' | 'custom' | 'clone' | 'describe';

export interface SpeechVoice {
  voiceId: string;
  label: string;
  /**
   * A built-in voice of the local cloning model: the voice is in fact a reference recording shipped with the app (`builtin`); choosing it means cloning from that recording.
   * The model's own speakers (`model`) and online voices do not provide it.
   */
  source?: 'model' | 'builtin';
  /** The language of the voice (BCP 47 primary language subtag); omitted when there is no limit. */
  language?: string;
}

/** The range (inclusive at both ends) and default value of one numeric knob of local speech synthesis. */
export interface SpeechKnobRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * What a one-sentence voice description (`describe`) accepts: `free` is any sentence; `vocabulary` is a closed vocabulary, at most one item per category, with terms separated by commas.
 * The keys of `terms` are the language of the terms (BCP 47 primary language subtag); terms of the same category in each language correspond by index. A category given in only one language lists only that language.
 */
export type SpeechVoiceDescription =
  { kind: 'free' } | { kind: 'vocabulary'; categories: Array<{ category: string; terms: Record<string, string[]> }> };

/** The license of the model weights: shown to people before download and use. Models with `commercialUse: false` are for non-commercial use only. */
export interface ModelLicense {
  name: string;
  url: string;
  commercialUse: boolean;
  /** A one-sentence note for people. */
  summary: string;
}

/**
 * How pronunciation annotations (for polyphonic characters) are passed to the model: the annotation is part of the input text, the Runtime passes it unchanged to the Worker, and the engine converts it to its own notation.
 * `homophone`: replaced with a homophone; `inline-pinyin`: inline pinyin; `annotated`: the model's native annotation notation; `unsupported`: the model has no pronunciation channel, so
 * it synthesizes the surface text (reported honestly, not silently rewritten).
 */
export type SpeechReadings = 'homophone' | 'inline-pinyin' | 'annotated' | 'unsupported';

/** Description specific to local speech-synthesis models (the `synthesizeSpeech` models of the `local` Provider). */
export interface LocalSpeechTraits {
  /** Engine family (`qwen3-tts`, `indextts2`, ...), used by the UI for grouping. */
  family: string;
  /** Output sample rate (Hz). The output is always WAV. */
  sampleRate: number;
  /** Clearly slower than other local models (large models); the UI shows a hint for this. */
  slow: boolean;
  /**
   * How built-in voices (those with `source: 'builtin'` in `voices`) are used: `reference` clones using their reference recording and transcript; `description` passes their English voice description to a model that creates voices from descriptions. null when there are no built-in voices.
   */
  builtinVoices: 'reference' | 'description' | null;
  /** Reference recording for `clone`: suggested duration (seconds); also the suggested duration when a transcript is given (some models want a shorter reference when a transcript is given). */
  reference: { recommendedSeconds: [number, number]; withTranscriptSeconds: [number, number] | null; acceptsTranscript: boolean } | null;
  /** What `describe` accepts; null when `describe` is not supported. */
  voiceDescription: SpeechVoiceDescription | null;
  /** Meaning of `instructions`: `style` is tone and style guidance (unrelated to the voice); null when not accepted. */
  instructions: 'style' | null;
  /** Emotion control (emotion reference audio, emotion vectors): the engine supports it, but this version's requests do not yet carry it. */
  emotion: boolean;
  /** Numeric knobs: `speed` (same as `speedRange`), `cfg` (guidance strength), `steps` (diffusion steps). Not given when not accepted. */
  knobs: Partial<Record<'speed' | 'cfg' | 'steps', SpeechKnobRange>>;
  /** Upper limit (seconds) for synthesizing to a target duration; null when not supported. */
  maxDurationSec: number | null;
  readings: SpeechReadings;
  license: ModelLicense;
}

/** Model description for `synthesizeSpeech`. */
export interface SpeechModelInfo extends ModelInfoBase {
  /** Preset voices. May be empty when the vendor's voices vary by account (then only `custom` is accepted). */
  voices: SpeechVoice[];
  /** The voice used when none is specified; null means a voice must be specified. */
  defaultVoice: string | null;
  voiceModes: VoiceMode[];
  /** Supported languages (BCP 47 primary language subtags); `any` means no limit, or the vendor gave no list. */
  languages: 'any' | string[];
  /** Text limit per request (counted in Unicode code points). Exceeding it is rejected at submission: not truncated, not split into chunks. */
  maxInputChars: number;
  formats: SpeechFormat[];
  defaultFormat: SpeechFormat;
  /** Whether tone and style instructions (`instructions`) are accepted. */
  acceptsInstructions: boolean;
  /** Range of the speaking-rate multiplier; null means `speed` is not accepted. */
  speedRange: { min: number; max: number } | null;
  /** Whether `seed` is accepted (the vendor reproduces it on a best-effort basis, not guaranteed). */
  acceptsSeed: boolean;
  cost: ModelCost;
  /** Description specific to local speech-synthesis models; not given for online models. */
  local?: LocalSpeechTraits;
}

/** An aspect ratio and its default pixel size. */
export interface ImageAspectRatio {
  /** `W:H`, e.g. `16:9`. */
  ratio: string;
  /** The size `WIDTHxHEIGHT` used when only an aspect ratio is given. */
  size: string;
}

/** Model description for `generateImage`. */
export interface ImageModelInfo extends ModelInfoBase {
  /** Accepted sizes `WIDTHxHEIGHT`. */
  sizes: string[];
  aspectRatios: ImageAspectRatio[];
  /** The size used when none is specified; null means the vendor decides (`auto`). */
  defaultSize: string | null;
  /** Maximum number of images in one task. */
  maxCount: number;
  /** Upper limit on the prompt (counted in Unicode code points). Exceeding it is rejected at submission. */
  maxPromptChars: number;
  formats: ImageFormat[];
  defaultFormat: ImageFormat;
  /** Whether the model accepts reference images (and at most how many). This version of `models.generateImage` does not yet take reference images; this only describes the model. */
  referenceImages: { max: number } | null;
  acceptsSeed: boolean;
  cost: ModelCost;
  /** Description specific to local text-to-image models; not given for online models. */
  local?: LocalImageTraits;
}

/** Knobs of the local text-to-image model: the range and default of the denoising steps (the request's `steps`). */
export interface LocalImageTraits {
  steps: SpeechKnobRange;
}

/** Music generation mode: `song` generates a song with vocals from a style and lyrics; `instrumental` generates an instrumental track without vocals from a style. */
export type MusicMode = 'song' | 'instrumental';
export const MUSIC_MODES: readonly MusicMode[] = ['song', 'instrumental'];
/**
 * Music generation planning: `off` generates directly from the style and lyrics; `melody` first generates, or accepts, a melody score and then generates; `full` first generates a complete score.
 * When not given, the default registered by the model bundle is used (YuE2 is `melody`).
 */
export type MusicPlanning = 'off' | 'melody' | 'full';
export const MUSIC_PLANNINGS: readonly MusicPlanning[] = ['off', 'melody', 'full'];

/** Description specific to local music-generation models (the `generateMusic` models of the `local` Provider). */
export interface LocalMusicTraits {
  /** Engine family (`yue2`). */
  family: string;
  /**
   * The execution engine (`audiocpp_cli`) and the executable it has found at this moment; null when not found (the model cannot generate). The engine is the bundle's `audiocpp-engine` component: when it is not installed,
   * the bundle is `not-installed` / `incomplete`, with `unavailableReason: 'not-installed'`.
   */
  engine: { id: string; executable: string | null };
  /** Output sample rate (Hz). The output is always WAV. */
  sampleRate: number;
  /** Languages supported for lyrics (BCP 47 primary language subtags); `unverified` means the list has not been checked upstream. */
  lyricLanguages: string[] | 'unverified';
  /** Accepted planning modes and their default. */
  planning: { options: MusicPlanning[]; default: MusicPlanning };
  /** Range of diffusion steps (the request's `steps`). */
  steps: SpeechKnobRange;
  /** Clearly slow (a whole song takes several minutes or more); the UI shows a hint for this. */
  slow: boolean;
  license: ModelLicense;
}

/** Model description for `generateMusic`. */
export interface MusicModelInfo extends ModelInfoBase {
  modes: MusicMode[];
  /** Upper limit on the style description (counted in Unicode code points). Exceeding it is rejected at submission. */
  maxStyleChars: number;
  /** Upper limit on lyrics (counted in Unicode code points). */
  maxLyricsChars: number;
  /** Maximum duration (seconds) that can be generated at once: the request's `maxDurationSec` cannot exceed it. */
  maxDurationSec: number;
  /** The budget (seconds) when `maxDurationSec` is not given. */
  defaultDurationSec: number;
  formats: SpeechFormat[];
  defaultFormat: SpeechFormat;
  acceptsSeed: boolean;
  cost: ModelCost;
  /** Description specific to local music-generation models; currently only local models exist. */
  local?: LocalMusicTraits;
}

/**
 * Reasoning effort of text models (architecture design §6.8). Each vendor's syntax is converted by its adapter (OpenAI's `reasoning_effort`, Gemini's
 * `thinkingLevel`). When the model does not support the requested level, the nearest level is used (on a tie, the higher one); models that do not support reasoning effort ignore it;
 * both cases are noted in the result.
 */
export type TextEffort = 'minimal' | 'low' | 'medium' | 'high';
export const TEXT_EFFORTS: readonly TextEffort[] = ['minimal', 'low', 'medium', 'high'];

/** Model description for `generateText`. */
export interface TextModelInfo extends ModelInfoBase {
  /** Context window (input plus output, counted in tokens). */
  contextTokens: number;
  /** Upper limit on output tokens per call; the request's `maxOutputTokens` cannot exceed it. */
  maxOutputTokens: number;
  /** Accepted reasoning effort levels; empty means it cannot be adjusted (the request's `effort` is ignored and this is noted). */
  efforts: TextEffort[];
  /** The level the vendor uses when no reasoning effort is specified; null when it cannot be adjusted. */
  defaultEffort: TextEffort | null;
  /** Whether structured output following a JSON Schema (`responseFormat.type: 'json'`) is accepted. */
  structuredOutput: boolean;
  acceptsTemperature: boolean;
  /** Whether `seed` is accepted (the vendor reproduces it on a best-effort basis, not guaranteed). */
  acceptsSeed: boolean;
  cost: ModelCost;
}

/** Model description for each capability. */
export interface ModelInfoByCapability {
  transcribe: TranscribeModelInfo;
  synthesizeSpeech: SpeechModelInfo;
  generateImage: ImageModelInfo;
  generateText: TextModelInfo;
  separateAudio: SeparateModelInfo;
  generateMusic: MusicModelInfo;
}

/**
 * Default values of call parameters that belong to only one capability (architecture design §6.8). The first release has only `generateText`:
 * - `effort`: the level used when the request gives no reasoning effort; null means defer to the model's own default;
 * - `concurrency`: the number of text requests each Provider runs at once (tasks and in-process calls share this limit), default 4.
 */
export interface TextCapabilityParameters {
  effort: TextEffort | null;
  concurrency: number;
}
export const DEFAULT_TEXT_CONCURRENCY = 4;
export const MAX_TEXT_CONCURRENCY = 32;

/** Parameters of `models.setCapabilityParameters`: given fields replace the current values; null restores the default; omitted fields stay unchanged. */
export interface SetCapabilityParametersRequest {
  capability: 'generateText';
  effort?: TextEffort | null;
  concurrency?: number | null;
}

/** The models and availability of one Provider under one capability. */
export interface ProviderCapability<M extends ModelInfoBase = ModelInfoBase> {
  models: M[];
  available: boolean;
  unavailableReason?: ProviderUnavailableReason;
  /** Supplementary note for people. Contains no keys and no absolute local paths. */
  detail?: string;
  /** Message reference for `detail` (message-ref.ts). */
  detailRef?: MessageRef;
}

export type ProviderCapabilities = { [C in ModelServiceCapability]?: ProviderCapability<ModelInfoByCapability[C]> };

/** Provider description (§6.1): the registry entry, which is also the wire shape. */
export interface ProviderDescriptor {
  providerId: string;
  kind: ProviderKind;
  label: string;
  capabilities: ProviderCapabilities;
  /** Vendor catalog entry (online and agent Providers have one, architecture design §6.4): the UI uses it to group providers, draw icons, and show the official site and region. */
  vendor?: ProviderVendorInfo;
}

/**
 * An item in the vendor catalog (architecture design §6.4): `vendor` is a model vendor, `relay` is a relay platform, `custom` is a user-added OpenAI-compatible endpoint,
 * and `agent` is an agent Provider (§6.9). `regions` are the regions with preset base URLs (the first is the default); the account's `region` is chosen from them.
 * `icon` is the icon ID for the UI (not a file path); when absent, the UI uses an avatar with the initial letter.
 */
export interface ProviderVendorInfo {
  kind: ProviderVendorKind;
  regions?: string[];
  website?: string;
  icon?: string;
}
export type ProviderVendorKind = 'vendor' | 'relay' | 'custom' | 'agent';

/** Result of the account's most recent call (recorded only; no automatic switch to another account is based on it, §6.2). */
export type ProviderAccountState = 'ok' | 'invalid-key' | 'rate-limited' | 'quota-exhausted' | 'unknown';

export interface ProviderAccountStatus {
  state: ProviderAccountState;
  /** The time this state was recorded (ISO 8601). */
  at?: string;
  /** `rate-limited`: the recovery time derived from the `Retry-After` given by the vendor. */
  until?: string;
  /** Supplementary note for people (no keys). */
  detail?: string;
  /** Message reference for `detail` (message-ref.ts). */
  detailRef?: MessageRef;
}

/**
 * One account under one online Provider (one key, architecture design §6.8). Keys are never echoed back; only a mask computed at write time is kept (first 3 + … + last 4;
 * all • when there are 8 characters or fewer). Accounts are ordered: a call uses the first enabled account that has a key, and a failure does not switch to another account (§6.2).
 */
export interface ProviderAccountView {
  accountId: string;
  /** The name given by the user; when null, the UI shows the mask. */
  label: string | null;
  masked: string;
  enabled: boolean;
  /** For Providers with region presets: which region's base URL the account uses (one of the catalog's `regions`). */
  region?: string;
  /** This account's own base URL override (rare): takes precedence over the Provider-level `endpoint` and the catalog presets (§6.4). */
  endpoint?: string;
  addedAt: string;
  lastUsedAt?: string;
  /** Whether this account has a key (found in the credential store). */
  credential: 'set' | 'missing';
  status: ProviderAccountStatus;
}

/** Configuration of online and agent Providers (read-only view): keys are only reported as present or absent, never echoed. */
export interface ProviderConfigView {
  enabled: boolean;
  /** Time of the most recent enablement: enabling is an ongoing authorization (§6.2). null after disabling. */
  enabledAt: string | null;
  /**
   * `set`: at least one enabled account has a key; `missing`: none; `none`: this Provider uses no key (agent Providers use the agent runtime's own sign-in).
   */
  credential: 'set' | 'missing' | 'none';
  /** Accounts (ordered, §6.8). Always given for online Providers (may be empty); agent Providers have none, so the type makes it optional. */
  accounts?: ProviderAccountView[];
  /** The address of a custom endpoint, or a rewritten base URL of an online Provider; when not given, the vendor's default address is used. */
  endpoint?: string;
  /** Result of the most recent `models.refreshProvider`; absent if it has never been refreshed. */
  refreshed?: ProviderRefreshStatus;
}

/**
 * Result of fetching the model (and voice) list from the vendor (`models.refreshProvider`, architecture design §6.8). The list is used only to annotate the built-in models: a built-in model that is not in the fetched list is reported as unavailable (`unsupported`);
 * voices from the vendor account are added to models that have no preset voices. When fetching fails, `ok: false`, the built-in list is used as before, and `error` explains the cause (without keys).
 */
export interface ProviderRefreshStatus {
  /** ISO 8601。 */
  at: string;
  ok: boolean;
  /** Number of models fetched; absent on failure. */
  models?: number;
  /** Number of voices fetched (for vendors that have a voice list); absent on failure. */
  voices?: number;
  error?: string;
}

/** The full view of one Provider, returned by `models.configure`. */
export interface ProviderView extends ProviderDescriptor {
  /** Only online and agent Providers have configuration; null for local and node. */
  config: ProviderConfigView | null;
}

/** A Provider in the capability view. */
export interface ProviderCapabilityView<M extends ModelInfoBase = ModelInfoBase> extends ProviderCapability<M> {
  providerId: string;
  kind: ProviderKind;
  label: string;
  config: ProviderConfigView | null;
}

export interface ModelRef {
  providerId: string;
  modelId: string;
}

/** The view of one capability: the user's default, the Provider and model actually used when none is specified explicitly, and each Provider. */
export interface CapabilityView<C extends ModelServiceCapability = ModelServiceCapability> {
  /** The default set by the user; it is kept even when the Provider it points to is unavailable (§6.8). Exception: when a local model bundle is deleted, defaults that point to it are cleared for capabilities that have no factory default. */
  default: ModelRef | null;
  /** Which one is used when none is specified explicitly (§6.2, items 2 and 3); null when the user default is unavailable or nothing is set, in which case calls are rejected with `CAPABILITY_NOT_CONFIGURED`. */
  effective: (ModelRef & { source: 'user-default' | 'factory-default' }) | null;
  providers: ProviderCapabilityView<ModelInfoByCapability[C]>[];
  /** Parameter defaults for this capability (only `generateText` has them), with the factory values already filled in. */
  parameters?: TextCapabilityParameters;
}

export type ModelCapabilitiesView = { [C in ModelServiceCapability]: CapabilityView<C> };

/** `reason` of `CAPABILITY_NOT_CONFIGURED`. `signed-out` and `outdated` come only from agent Providers (§6.9). */
export type CapabilityNotConfiguredReason =
  | 'no-default'
  | 'missing-credential'
  | 'not-installed'
  | 'signed-out'
  | 'outdated'
  | 'not-paired'
  | 'not-connected'
  | 'unsupported'
  | 'disabled';

/**
 * When a capability has no available Provider (§6.2): the `code` of the `RpcError` is `conflict`, and `details` has this shape. It is rejected at submission and no task is created.
 * `remedy.hint` is one sentence for people (in the Runtime's language), and `hintRef` is its message reference.
 */
export interface CapabilityNotConfiguredDetails {
  code: 'CAPABILITY_NOT_CONFIGURED';
  capability: ModelServiceCapability;
  reason: CapabilityNotConfiguredReason;
  providerId?: string;
  remedy: {
    /** `setup-agent`: install, sign in to, or upgrade the agent runtime in its own interface (`reason` says which one); CucCut does not do it for the user. */
    action: 'configure-provider' | 'set-default' | 'install-model' | 'pair-node' | 'enable-provider' | 'setup-agent';
    providerId?: string;
    capability: ModelServiceCapability;
    hint: string;
    hintRef?: MessageRef;
  };
}

/** The settings deep link used when an agent prompts the user to configure a capability (product design §3.2.2), consistent with in-app routing. */
export function capabilitySettingsHref(capability: ModelServiceCapability): string {
  const category: Record<ModelServiceCapability, string> = {
    transcribe: 'asr', synthesizeSpeech: 'tts', generateText: 'llm', generateImage: 'image', separateAudio: 'sep', generateMusic: 'music',
  };
  return `/settings/models/${category[capability]}`;
}

/** The online Providers each capability can be configured with (placeholders in the remedy commands). */
function configurableProviders(capability: ModelServiceCapability): string {
  const custom = ProtocolLabels.customProviderPlaceholder().text;
  switch (capability) {
    case 'transcribe':
    case 'generateImage':
    case 'generateText':
      return `openai|google|${custom}`;
    case 'synthesizeSpeech':
      return `openai|elevenlabs|${custom}`;
    case 'separateAudio':
    case 'generateMusic':
      // No online Provider: the remedy is only to install a local model bundle or set a default.
      return 'local';
  }
}

/** The `providerId` prefix of agent Providers (`agent:<driverId>`). */
export const AGENT_PROVIDER_PREFIX = 'agent:';

/**
 * The remedy for `CAPABILITY_NOT_CONFIGURED` expressed as CLI commands (one per line, possibly empty). The CLI prints them; agent tools pass them to the agent along with
 * `remedy.hint`, and the agent tells the user. Keys are read only from standard input and never appear in a command.
 */
export function capabilityRemedyCommands(details: CapabilityNotConfiguredDetails): string[] {
  const providerId = details.remedy.providerId ?? details.providerId;
  const configure = `cuccut models configure <${configurableProviders(details.capability)}> --enable --key-stdin --verify < key.txt`;
  const install = [`cuccut models list  ${ProtocolLabels.bundlesCommandNote().text}`, 'cuccut models install <bundleId>'];
  // Vocal separation and music generation exist only as local model bundles: there is no online Provider to configure, so the remedy is only to install (or set a default).
  if (
    (details.capability === 'separateAudio' || details.capability === 'generateMusic') &&
    (details.remedy.action === 'configure-provider' || details.remedy.action === 'install-model')
  ) {
    return install;
  }
  switch (details.remedy.action) {
    case 'configure-provider':
      // Agent Providers have no keys: configuring one means enabling it.
      if (providerId?.startsWith(AGENT_PROVIDER_PREFIX)) return [`cuccut models configure ${providerId} --enable`];
      return [providerId ? `cuccut models configure ${providerId} --enable --key-stdin --verify < key.txt` : configure];
    case 'enable-provider':
      return providerId ? [`cuccut models configure ${providerId} --enable`] : [];
    case 'set-default':
      return [`cuccut models default ${details.capability} ${providerId ?? '<providerId>'}`];
    case 'pair-node':
      return [`cuccut nodes pair ${ProtocolLabels.pairCommandArgs().text}`];
    case 'install-model':
      // Local model bundle: first see which one to install; its size is shown and confirmation is required before installing. Alternatively, use an online service.
      return [...install, configure];
    case 'setup-agent':
      // Installing, signing in and upgrading are all done in the agent runtime's own interface (architecture design §3.11); `hint` explains how.
      return [];
  }
}

/**
 * Models declared by a custom endpoint; fields that are not given take conservative defaults. `capability` defaults to `transcribe` when absent.
 * - `transcribe`: 25 MB, unlimited duration, tries to get word-level timestamps, accepts hints;
 * - `synthesizeSpeech`: the first of `voices` is the default voice (when there are none, a voice must be specified, and any voice ID is accepted), text 4096 characters, `mp3`;
 * - `generateImage`: the first of `sizes` is the default size (when there are none, `1024x1024`), 1 image at a time, prompt 4000 characters, `png`;
 * - `generateText`: context 32768 tokens, 4096 output tokens per call, reasoning effort cannot be adjusted (sent only when `efforts` is declared), accepts structured output and
 *   `temperature`, does not accept seed.
 */
export interface DeclaredModel {
  modelId: string;
  label?: string;
  capability?: OnlineCapability;
  maxInputBytes?: number;
  maxDurationSec?: number | null;
  wordTimestamps?: 'native' | 'none';
  acceptsHint?: boolean;
  voices?: string[];
  maxInputChars?: number;
  formats?: SpeechFormat[];
  sizes?: string[];
  maxCount?: number;
  maxPromptChars?: number;
  contextTokens?: number;
  maxOutputTokens?: number;
  efforts?: TextEffort[];
  structuredOutput?: boolean;
}

/** Parameters of `models.configure`. `credential` is write-only: a string sets it, null clears it, and omitting it leaves it unchanged. */
export interface ConfigureProviderRequest {
  providerId: string;
  enabled?: boolean;
  credential?: string | null;
  /** Required when a custom endpoint is first configured. Built-in online Providers may have their base URL rewritten (proxy, self-hosted gateway); null restores the default. */
  endpoint?: string | null;
  /** Models declared by the custom endpoint (replaces the whole list). */
  models?: DeclaredModel[];
  /** The display name of the custom endpoint. */
  label?: string;
  /** Before saving, verify once with the vendor using the new key and endpoint (a read-only request); not saved if it fails. */
  verify?: boolean;
}

/** `models.addAccount`: adds one account to an online Provider (appended at the end). With `verify`, first send a read-only request to the vendor with this key. */
export interface AddProviderAccountRequest {
  providerId: string;
  credential: string;
  label?: string;
  region?: string;
  endpoint?: string;
  verify?: boolean;
}

/** `models.updateAccount`: the fields given replace the current ones; `label`, `region` and `endpoint` are cleared when null. */
export interface UpdateProviderAccountRequest {
  providerId: string;
  accountId: string;
  label?: string | null;
  credential?: string;
  enabled?: boolean;
  region?: string | null;
  endpoint?: string | null;
  /** When the key is changed, verify the new key first (list the models); not saved if it fails (`conflict`, with `details.code` as `PROVIDER_*`). */
  verify?: boolean;
}

/** `models.arrangeAccounts`: the new order of accounts; it must be exactly a permutation of the existing accounts. */
export interface ArrangeProviderAccountsRequest {
  providerId: string;
  order: string[];
}

export interface ModelsSnapshot {
  capabilities: ModelCapabilitiesView;
  /** Status of local model bundles (same as `models.list`). */
  bundles: ModelBundleStatus[];
}

/**
 * `capabilities.updated`: sent when configuration, defaults, model bundles or nodes change, carrying the full new view.
 * `bundle.updated`: the state of one local model bundle changed (download progress, install, delete, check, Worker load and unload), carrying its full state.
 */
export type ModelsEvent =
  { type: 'capabilities.updated'; capabilities: ModelCapabilitiesView } | { type: 'bundle.updated'; bundle: ModelBundleStatus };
