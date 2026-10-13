# CucCut Model Worker Protocol Specification

> The stdio protocol between the Runtime and the local inference process (Model Worker). It covers the output contract for speech recognition `cuccut.asr-result/v1`, for local speech synthesis `cuccut.speech-wav/v1`, and for vocal separation `cuccut.stems-wav/v1`. This spec defines message shapes and semantics. For process granularity, startup, recovery and cleanup rules, see [System Architecture Design](../architecture/architecture-design.md) §6.5–§6.6.

Contract version: `workerContractVersion: 1`.

For terms, see [Document conventions](../README.md#conventions-for-this-document) and the [Glossary](../glossary.md).

## Contents

- [1. Transport and envelope](#1-transport-and-envelope)
- [2. Methods](#2-methods)
- [3. Events](#3-events)
- [4. Model bundle description](#4-model-bundle-description)
- [5. Jobs and the staging directory](#5-tasks-and-the-staging-directory)
- [6. Output contract cuccut.asr-result/v1](#6-output-contract-cuccutasr-resultv1)
- [7. Errors](#7-errors)
- [8. Items pending review](#8-items-for-review)

---

## 1. Transport and envelope

The Worker is a child process started by the Runtime. Its stdin and stdout are each a UTF-8 JSON-lines stream: one message per line, with no unescaped newlines. stderr is used only for logs. Consistent with the Engine Host:

| Direction | Shape |
| --- | --- |
| Runtime → Worker request | `{ "id": number, "method": string, "params": object }` |
| Worker → Runtime response | `{ "id": number, "result": object }` or `{ "id": number, "error": ErrorBody }` |
| Worker → Runtime event | `{ "event": string, "params": object }` |

- `id` is assigned by the Runtime, incrementing; each request gets exactly one response.
- Events may appear at any time, and always come before the `job.run` response they belong to.
- The Worker exits when stdin closes (EOF) or a write to stdout fails. It also checks every 2 seconds that the parent PID still exists and equals the `--parent-pid` passed at startup, and exits otherwise. Beyond PID reuse, the Worker handles no “claim” logic at all.
- A line longer than 16 MiB is treated as a protocol error, and the Worker exits.
- An unknown method returns `UNKNOWN_METHOD`. Params with the wrong shape return `INVALID_PARAMS`. An internal panic in the Worker becomes a `WORKER_PANIC` response to that request, and the Worker exits afterwards.

Command line: `model-worker --parent-pid <pid>`. All business parameters are passed through stdin, not environment variables. External tools the Worker needs (ffmpeg) are looked up on the `PATH` passed in by the Runtime, and `CUCCUT_FFMPEG` can point to the executable. `CUCCUT_GPU` is an operations switch that turns the GPU off (§2.1); it is not a business parameter. The Runtime starts the Worker with the same environment it uses to start the Engine Host.

## 2. Methods

### 2.1 `worker.hello`

The first request the Runtime sends after starting the Worker.

```ts
params: { contractVersion: 1 }
result: {
  workerVersion: string;            // crate version
  contractVersion: 1;
  pid: number;
  backends: Array<{ id: 'mlx' | 'coreml' | 'candle' | 'ggml'; available: boolean; reason?: string; devices: string[] }>;
  capabilities: Array<'transcribe' | 'align' | 'synthesize' | 'separate' | 'image' | 'diarize'>;
  transcribeFamilies: string[];     // recognition model families this build can load (family of the `asr` component, §4.1); [] if none
  synthesizeFamilies: string[];     // main synthesis model families this build can load (family of the `tts` component, §4.1); [] if none
  separateFamilies: string[];       // separation model families this build can load (family of the `separator` component, §4.1); [] if none
  imageFamilies: string[];          // text-to-image model families this build can load (family of the `image` component, §4.1); [] if none
}
```

If `contractVersion` does not match, the Worker returns `CONTRACT_MISMATCH` and the Runtime closes it. A backend with `available: false` carries a `reason` (such as `no-metal-device` or `not-compiled`).

`devices` lists the devices this backend can use right now, preferred first. `mlx` is `['metal']`, `coreml` is `['ane']`, `candle` is `['cuda', 'cpu']` (compiled with `cuda` and CUDA initialization succeeded) or `['cpu']`, and `ggml` (whisper.cpp) is `[<GPU>, 'cpu']` or `['cpu']`. `<GPU>` is the backend that owns the first GPU device ggml enumerates: `'cuda'` for CUDA (compiled with `whisper-ggml-cuda` and an NVIDIA GPU found), `'vulkan'` for Vulkan (compiled with `whisper-ggml-vulkan` and a Vulkan GPU found), or `'metal'` for Metal (macOS, compiled with `whisper-ggml-metal` and a compatible GPU found). When both the CUDA and Vulkan backends are compiled in, CUDA comes before Vulkan (ggml's registration order), so there is at most one GPU. Device names are limited to `metal`, `ane`, `cuda`, `vulkan` and `cpu`. CucCut's builds compile the ggml CUDA, Vulkan or Metal GPU backends; other ggml GPU backends report their lowercase registry name, which is outside this contract. When the environment variable `CUCCUT_GPU` is set to `off`, `0`, `false`, `cpu` or `no` (case-insensitive), the Worker does not initialize the GPU, and `candle` and `ggml` report only `cpu`. When CUDA or Vulkan initialization fails, the same applies: only `cpu` is reported, and stderr explains this once. A backend that is not compiled in (for example `ggml` in a build without `whisper-ggml`) reports `available: false` and `reason: 'not-compiled'`. For `candle` and `ggml` model bundles passed to `model.load`, the Runtime uses the preferred device reported here. The candle synthesis engine pins its tensors to the process's preferred device, so when a synthesis bundle's `device` is not the preferred device (for example, CUDA is available but `cpu` is passed), `model.load` returns `MODEL_UNSUPPORTED` (`details: { backend: 'candle', device, reason: 'unsupported-device' }`). When the backend is `available: false`, `model.load` is not sent. The job fails with `MODEL_LOAD_FAILED` (`details.reason: 'unsupported'`, `detail: 'backend-unavailable'`), and the model bundle is not deactivated.

`capabilities` lists only the capabilities this Worker can actually execute. Recognition is also declared per model family. `transcribeFamilies` lists the `asr` families this build can load: builds with MLX or candle get `qwen3-asr` and `moss-transcribe-diarize`; Apple Silicon builds with MLX add `whisper-mlx`; builds with Core ML add `whisper-coreml`; builds with `whisper-ggml` add `whisper-ggml`. `capabilities` includes `transcribe` only when there is at least one. When the build can load the forced aligner (`qwen3-forced-aligner`, builds with MLX or candle), `capabilities` includes `align`. Actually running it also requires the loaded model bundle to carry an `aligner` component (§2.5.1). When the build is wired to speaker diarization (Pyannote segmentation plus WeSpeaker voice embeddings; builds with MLX or candle, where MLX and Core ML Whisper use the MLX version and GGML Whisper borrows candle's), `capabilities` includes `diarize`. For recognition with speakers, the recognition bundle also needs a `segmentation` component (§2.5.1). When the speaker-diarization bundle is loaded alone, it is also a `job.run` capability that assigns speakers to words of an existing transcript (§2.5.5). A recognition bundle requires `transcribe`, and its `asr` family must be in `transcribeFamilies`. If that is not met, the Runtime does not send `model.load`, and the job fails with `MODEL_LOAD_FAILED` (`details.reason: 'unsupported'`, `detail: 'capability-missing'`, with `family`, `capabilities` and `transcribeFamilies`); the model bundle is not deactivated. Synthesis is declared per model family. `synthesizeFamilies` lists the `tts` families this build can load (Apple Silicon builds with MLX and builds with candle both have `qwen3-tts`, `indextts2`, `indextts2.5`, `gpt-sovits`, `voxcpm2` and `omnivoice`), and `capabilities` includes `synthesize` only when there is at least one. On Apple Silicon, when both MLX and candle are compiled in, synthesis goes through MLX: a `candle` synthesis bundle returns `MODEL_UNSUPPORTED` from `model.load` (`details: { backend: 'candle', reason: 'engine-unavailable' }`), and the Runtime does not register them on this platform. Model bundles with synthesis components (`tts`, `codec`, `aux` in §4.1) require `synthesize`, and their `tts` family must be in `synthesizeFamilies`. If not, the Runtime does not send `model.load`, and the job fails with `MODEL_LOAD_FAILED` (`details.reason: 'unsupported'`, `detail: 'capability-missing'`, with `family` and `synthesizeFamilies`); the model bundle is not deactivated. Use a Worker that declares it instead. Text-to-image works the same way: `imageFamilies` lists the `image` families this build can load (builds with MLX or candle: `qwen-image`), and `capabilities` includes `image` only when there is at least one. Bundles with an `image` component require `image`, and their family must be in `imageFamilies`; otherwise they fail the same way with `capability-missing` (with `family` and `imageFamilies`), and the bundle is not deactivated. Separation works the same way: `separateFamilies` lists the `separator` families this build can load (builds with MLX or candle: `htdemucs-ft`), and `capabilities` includes `separate` only when there is at least one. Bundles with a `separator` component require both, otherwise they fail with `MODEL_LOAD_FAILED` (`detail: 'capability-missing'`, with `family`, `capabilities` and `separateFamilies`), and the bundle is not deactivated.

### 2.2 `model.load`

One Worker process loads only one model bundle (§4). A repeated call returns `ALREADY_LOADED`.

```ts
params: { bundle: ModelBundle }
result: { loaded: true; residentBytes: number | null; warmupMs: number }
```

While loading, the Worker pushes `model.phase` events. On failure, `ErrorBody.code` is one of only three values: `MODEL_NOT_INSTALLED` (file missing or hash mismatch), `MODEL_UNSUPPORTED` (backend, device or model family not supported), or `MODEL_RESOURCE` (out of memory). `details` gives the specific file or resource. When the component combination is invalid (for example, a `codec` without a `tts`), it is `MODEL_UNSUPPORTED` with `details: { component, reason: 'missing-component' }`. A synthesis model family that is not in `synthesizeFamilies` (this build has no engine for it) returns `MODEL_UNSUPPORTED` after file validation, with `details: { capability: 'synthesize', reason: 'not-wired', family }`, and leaves no loaded state. Recognition is the same: an `asr` family not in `transcribeFamilies` returns `details: { capability: 'transcribe', reason: 'not-wired', family }` after the component check. An `image` family not in `imageFamilies` likewise returns `details: { capability: 'image', reason: 'not-wired', family }`. Separation is `details: { capability: 'separate', reason: 'not-wired', family }`. The Runtime does not send such requests per §2.1, so this is only a fallback. After loading, synthesis, separation and text-to-image model bundles stay resident on the inference thread, the same as recognition.

### 2.3 `model.unload`

```ts
params: {}
result: { unloaded: true }
```

After unloading, the Worker stays alive and waits for the Runtime to close stdin.

### 2.4 `worker.status`

```ts
params: {}
result: {
  state: 'empty' | 'loading' | 'ready' | 'busy' | 'unloading';
  bundleId: string | null;
  job: { jobId: string; phase: string; startedAt: string } | null;
  memory: { active: number; cache: number; peak: number } | null;   // when the backend can report it
}
```

### 2.5 `job.run`

The Worker executes one job at a time. When `state !== 'ready'` (including when no model bundle is loaded yet), it returns `WORKER_BUSY`, with `details.state` giving the current state. The response is returned only when the job terminates. `params.capability` determines the shape of parameters and results: `transcribe` and `align` are in §2.5.1, `synthesize` in §2.5.2, `image` in §2.5.3, `separate` in §2.5.4, and `diarize` in §2.5.5. Parameters are checked for shape first (`INVALID_PARAMS`), then state.

#### 2.5.1 Recognition and alignment

```ts
params: {
  jobId: string;
  runGeneration: number;
  capability: 'transcribe' | 'align';
  input: {
    file: string;                     // absolute path; Runtime has already checked it is inside an allowed root
    contentHash: string;              // 'sha256:<hex>'; Worker does not re-verify
    track: number;                    // track index, default 0
    range?: { start: number; end: number; timescale: number }; // process only this range
  };
  options: TranscribeOptions | AlignOptions;
  staging: string;                    // absolute path; Worker may only write to this directory
  outputContract: 'cuccut.asr-result/v1';
}

interface TranscribeOptions {
  language: { mode: 'assert'; tag: string } | { mode: 'prefer'; tag: string | null };  // BCP 47
  diarize: boolean;                   // identify speakers (§2.5.1); if not possible, transcribe as usual and report warning 'diarization-unavailable'
  hint?: string;                      // terms and context, ≤ 1200 characters
  timescale: number;                  // tick unit of the output, default 1_000_000
}

interface AlignOptions {
  language: { mode: 'assert'; tag: string };
  text: string;
  timescale: number;
}

result: {
  outcome: 'completed' | 'cancelled';
  output: { path: string; sha256: string; byteLength: number } | null;   // sha256 is lowercase hex without a prefix; null when cancelled
  segmentsFile: string | null;        // path of the segment-result JSONL; still given when the job is cancelled
  stats: { decodeMs: number; vadMs: number; asrMs: number; alignMs: number; speechSeconds: number };
}
```

`runGeneration` is echoed back unchanged into `provenance.runGeneration` in the result; the Worker does not interpret it further. `capability: 'align'` on a model bundle without a loaded aligner returns `MODEL_UNSUPPORTED` (`details.reason: 'aligner-not-loaded'`). A language that is not asserted, or an empty `text`, is `INVALID_PARAMS`. When the asserted language is not supported by the model, it likewise returns `MODEL_UNSUPPORTED` (`details.reason: 'unsupported-language'`). Which languages are supported is looked up in each `asr` family's own table (`qwen3-asr` 30, `whisper-mlx` and `whisper-coreml` 100, `moss-transcribe-diarize` 101). The Runtime's `local` Provider reports the same tables.

A `hint` over 1200 characters is `INVALID_PARAMS`. Within that limit, the Worker does not rewrite the caller's text. How it is given to the model depends on the `asr` family (same as v2): `qwen3-asr` puts the whole text into the system context. `whisper-coreml` is BPE-encoded and placed after `<|startofprev|>` as a prefix prompt, using at most half of the decoder's KV cache (minus the task prefix); when it overflows, it is truncated from the front, keeping the part closest to the audio, which is about 220 tokens for large-v3 and about 108 for large-v3-turbo. `whisper-mlx` is also a prefix prompt, with a budget of half of the 224 tokens of "prompt plus generation" per 30-second window; both models get about 108 tokens. `whisper-ggml` is used as whisper.cpp's initial prompt (with embedded NULs removed) and is re-supplied before decoding each speech segment; later 30-second windows within the same segment roll it forward as preceding context together with the text already decoded. When it exceeds half of the text context (224 tokens), whisper.cpp keeps the part closest to the audio. `moss-transcribe-diarize` does not pass the hint to the model and reports `hint-ignored`. When the pipeline auto-detects the language (`prefer`), the job's language (`job.language` and the result's `language`) is fixed on the first segment that recognizes text. The model's self-reported language name is preferred; otherwise it is inferred from the accumulated text. Segments with empty recognition results do not count, and a language the model self-reports on such a segment is not trusted. Only an asserted language is passed to the model. A fixed language is not imposed on later segments; each segment is judged by the model itself. The aligner and word-timing estimation use the language the model self-reports for that segment, or the job's language when none is reported (architecture design §6.6, step 4). Local models give no language confidence, so `confidence` in `job.language` and in the result is null.

Recognition runs in one of two modes, determined by the `asr` family. **Pipeline** (`qwen3-asr`, `whisper-mlx`, `whisper-coreml`, `whisper-ggml`): VAD first cuts out speech segments, then each segment is recognized in turn. The three Whisper variants pass `hint` to the decoder as a prefix prompt, and they only output segment-level text. When the model bundle includes an aligner (several model families share the same `qwen3-forced-aligner`), the text recognized for each segment is force-aligned against that segment's audio, and its word timings are marked `aligned` (provenance `models.aligner` names it). Word start times are expanded to be strictly increasing. Words whose start and end collapse to one point are padded to one alignment cell (0.08 s, at most up to the next word's start or the segment end). If alignment errors out or cannot align the words, that segment falls back to character-length estimation (`estimated`) and carries an `alignment-failed` warning (`segmentId` pointing at this segment); the job does not fail. Without an aligner, word timings are always estimated from character length. When `diarize: true` and the model bundle includes a `segmentation` component (`pyannote-segmentation`, which comes from the speaker-diarization bundle together with `wespeaker` for `speaker`; architecture design §6.3), then after recognition and alignment finish, the job enters the `diarizing` phase (`unit` of `job.progress` is `steps`). Pyannote segmentation judges up to 3 local speakers per window across the whole audio, using 10-second windows at a 5-second step. WeSpeaker extracts a voice embedding for each local speaker. Constrained agglomerative clustering (merge threshold 0.715) synthesizes global speakers, and speaker intervals are then projected onto words (architecture design §6.6, step 7). A word's `speakerId` is the speaker projected onto it. A segment's `speakerId` is the speaker with the most speaking time among its words. Speakers are numbered `spk-1`, `spk-2`, … by first appearance in time (`label` is null), and speakers who were not assigned any words are listed last. The provenance `models.segmentation` and `models.speaker` name the two models. Without `speaker`, local speakers are chained together by window overlap, a degraded path with poorer separation. The two models load on first need for speakers and are unloaded when the job ends; the recognition model stays resident (same as v2). Time spent is counted in `stats.asrMs`. When the model bundle has no `segmentation`, when either model cannot be loaded, or when inference errors, diarization is skipped and `diarization-unavailable` is reported (`detail` says which case), and transcription still completes. `job.segment` and `segmentsFile` are written before diarization: segments' `speakerId` is null, words carry no `speakerId`, and speakers appear only in the result. With `diarize: false`, no speakers are output. **Self-segmenting** (`moss-transcribe-diarize`): the whole audio goes to the model in one pass. The model itself chunks the audio, splits segments and assigns speakers within each chunk. There is no VAD stage, so `stats.vadMs` is 0. Phases run in order: `decoding`, `transcribing`, then `diarizing` when speakers are requested, `aligning` when there are lines to align, and finally `finalizing`. Language is passed to the model only when asserted. When not asserted, the language is guessed once from the full text after recognition: if a guess is made, `job.language` is pushed once and `detected` is used as the result's language (`confidence` null); if no guess can be made, it is `unknown`. The model has no hint channel, so when `hint` is non-empty it is not passed to the model and `hint-ignored` is reported. When a chunk hits the generation limit or falls into repetition and cannot be split, the already-recognized part is kept and `segment-incomplete` is reported (`detail` says which chunk). When `diarize: true` and the model bundle includes a speaker model (`wespeaker`), the chunk-level labels are merged into global speakers using each chunk's speaker embeddings (provenance `models.speaker` names it). Without a speaker model, or when lines and speaker intervals do not match while the model split into more than one chunk, the in-chunk labels are kept and `diarization-unavailable` is reported (same-named labels in different chunks may not be the same person). Speakers are numbered `spk-1`, `spk-2`… in order of appearance (`label` is null). With `diarize: false`, no speakers are output. When the model bundle has an aligner, lines longer than 5 seconds without word timings are force-aligned within the line's audio window (language is the asserted one, or the language guessed from the full text, or `en` if neither); words are marked `aligned`. When alignment fails for a line, it falls back to estimation and carries `alignment-failed` (`segmentId` pointing to it). If the aligner cannot be loaded, a single `alignment-failed` without `segmentId` is reported. The provenance `models.aligner` is filled only when the aligner was actually used in this job. Other lines' word timings are estimated from character length (`estimated`). Segments are sorted by time, clipped to the input range, and de-overlapped. The aligner and speaker model are loaded only when needed and unloaded when the job ends, and the two are not resident at the same time. When system memory is tight, MOSS is unloaded before loading them, and the next job reloads MOSS. MOSS has no warmup, so `warmupMs` is 0. `capability: 'align'` is also available on MOSS model bundles that include an aligner (the aligner is loaded on demand).

**Alignment** (`capability: 'align'`): decodes the selected track (and range), skips VAD and recognition, and force-aligns the whole `text` to the audio (long audio is chunked by the aligner itself). Words are split into segments by pauses (> 0.8 s), sentence-final punctuation, and segment length (> 30 s), using the same rule as online Providers that return only word timings. A segment's text is reassembled from its words (no space is inserted between characters that are written without spaces). Zero-duration segments are padded to one alignment cell (0.08 s), and words whose start is past the end of the audio are dropped. Phases run in order: `decoding`, `aligning`, `finalizing`. `stats.vadMs` and `asrMs` are 0, and time is recorded in `alignMs`. An alignment error is `INFERENCE_FAILED`, since there is no estimate to fall back to here. The result's language source is `asserted`, and all word timings are `aligned`.

#### 2.5.2 Synthesis

Local speech synthesis (architecture design §6.1, §6.5). The parameters are frozen by the Runtime at submission time (`JobRecord.generation`). The Worker follows them: it does not switch voice or change parameters. If it cannot do so, it fails.

```ts
params: {
  jobId: string;
  runGeneration: number;
  capability: 'synthesize';
  input: {                            // Reference recording: given only when voice.mode is 'clone', otherwise null
    file: string;                     // absolute path
    contentHash: string;              // 'sha256:<hex>'; the Runtime has already checked the file against it before dispatch
    track: number;                    // 0
  } | null;                           // no range accepted: the whole reference recording is used
  options: SynthesizeOptions;
  staging: string;
  outputContract: 'cuccut.speech-wav/v1';
}

interface SynthesizeOptions {
  text: string;                       // verbatim; the engine replaces reading annotations with its own notation
  language: string | null;            // BCP 47; when null, the engine judges from the text
  voice:
    | { mode: 'preset'; id: string }                     // the model's own speaker
    | { mode: 'clone'; transcript: string | null }       // uses the reference recording in input; transcript is its original text
    | { mode: 'describe'; description: string };         // one-sentence voice description
  instructions: string | null;        // tone instruction; if the model does not accept it, the Runtime already rejected it at submission
  speed: number | null;               // null always uses the model's default
  cfg: number | null;
  steps: number | null;
  seed: number | null;
}

result: {
  outcome: 'completed' | 'cancelled';
  output: { path: string; sha256: string; byteLength: number } | null;   // speech.wav in staging (§5.1), absolute path
  audio: { sampleRate: number; channels: number; durationSec: number } | null;
  stats: { referenceMs: number; synthesisMs: number; encodeMs: number };
  readingsDropped: Array<{                                                 // readings that could not be spoken as annotated; [] when cancelled
    start: number; end: number;       // [start, end) offsets in the text after annotations are removed, Unicode code point offsets
    reading: string;                  // normalized pinyin reading (`yin2 hang2`; tone-marked pinyin is also converted to numbers); a malformed annotation is kept as the original text
    origin: 'user' | 'phrase' | 'dict' | 'llm';
  }>;
}
```

A reading annotation in `text` is written as `<char|reading>`: the surface contains Chinese characters, the reading is pinyin, and multi-character readings are split into syllables by spaces, with the syllable count equal to the surface character count (`<银行|yin2 hang2>`, "bank"). Each syllable is written either as a tone number (`hang2`; neutral tone `5`; ü written as `v` or `ü`) or as tone-marked pinyin (`háng`, `lǜ`; no tone mark means neutral tone, `<了|le>`). Both forms may be mixed within one annotation (`<银行|yín hang2>`), case-insensitively. When the Worker parses it, it always normalizes to lowercase tone-number form (after j / q / x / y, ü is written `u`). The engine and the `readingsDropped` entries see only the normalized form for valid annotations. After removing the tone, a syllable must be 1–6 letters and contain a vowel (syllabic `m n ng hm hng` excepted). Only precomposed tone-marked letters are recognized; mixing a tone number with a tone mark, or having two tone marks on one syllable, is invalid. An annotation whose reading contains a number or tone mark but is invalid is malformed, and is kept as plain text. An annotation with neither a number nor a tone mark that is also invalid (`<中文|Chinese>`) does not count as an annotation. The Worker converts reading annotations into a form the engine can take (homophone character, inline pinyin, or the annotation kept as is). Readings the engine cannot speak (unrecognized reading, not in the lexicon, or malformed annotation) are synthesized as the surface text and honestly listed in `readingsDropped`. They are not dropped silently, and they do not fail the task. The Runtime turns each one into a `reading-dropped` warning on the task (`detail` gives only the position and reading).

When the text is longer than the model can reliably generate in one pass, the engine splits `text` into chunks at sentence boundaries, synthesizes each chunk, and joins them in the original order. For Qwen3-TTS and VoxCPM2, each chunk has a budget of 60 units, where one Chinese character or one space-separated word counts as one unit. A short tail of fewer than 8 units merged back into the previous chunk may slightly exceed the budget. A paragraph break (newline) is always a chunk boundary. If a paragraph does not fit in one chunk, the engine falls back to clause punctuation, and failing that, hard-cuts by length. The Worker sets the pauses and loudness between chunks itself, and does not use the silence the model adds at the start and end of each chunk. On each side of a chunk boundary, leading and trailing silence (a 10 ms window with RMS below −45 dBFS) is removed, keeping at most 50 ms per side. A fixed pause is inserted between chunks: 0.35 s if the previous chunk ends with a sentence-final punctuation mark, 0.6 s at a paragraph boundary, and 0.2 s when the break falls mid-sentence. The pause is measured from the last voiced part of the previous chunk to the first voiced part of the next chunk. The RMS of each chunk's voiced part is aligned to the first chunk, with gain limited to ±6 dB, and after gain the peak does not exceed −1 dBFS. The start and end of the whole piece are left untouched. If only one chunk is produced, no processing is applied. Chunking and joining happen only inside the engine. They do not change the content or order of `text`, and they do not relax the length check the Runtime performs at submission against the model's limit. The `job.progress` for the `synthesizing` stage (`unit: 'steps'`) counts per chunk. Cancellation takes effect between chunks and between generation steps. OmniVoice, GPT-SoVITS and IndexTTS2 / 2.5 split and join using their own official methods (crossfade or fixed silence) and do not go through this step.

Checks beyond the shape all return `INVALID_PARAMS`. `outputContract` must be `cuccut.speech-wav/v1`. `staging` and `input.file` must be absolute paths. `text` must be non-empty after trimming whitespace. `input` is given if and only if `voice.mode === 'clone'`. A built-in voice (a reference recording shipped with the app) is already converted by the Runtime into `clone` plus a recording file, so the Worker does not distinguish it. If the model cannot do the requested voice mode, language or knob, it returns `MODEL_UNSUPPORTED`, and `details.reason` says which item it is. For `preset`, the speaker name is case-insensitive (the catalog writes `Uncle_Fu`, the model's speaker table has `uncle_fu`). A built-in voice id (`zh-male` etc.) is mapped on models that only have their own speakers to the closest one. Neither of these counts as "cannot do". Some checks come from the engine: for VoxCPM2, `cfg` must be greater than 0. For OmniVoice, `describe` accepts only its closed vocabulary. Failing this is `INVALID_PARAMS`, and a description outside the vocabulary carries `details.reason: 'description-vocabulary'`. For GPT-SoVITS, when `transcript` is given the reference recording must be 3–10 seconds long. After `preparing-reference` measures the duration and before synthesis, it reports `MODEL_UNSUPPORTED` (`details.reason: 'reference-duration'`, with `seconds` and `range`). If the reference recording cannot be read, it is `INPUT_UNREADABLE` (`details.input: 'reference'`). If a recognition model pack is loaded, `MODEL_UNSUPPORTED` is returned after the parameter and state checks (`details: { capability: 'synthesize', reason: 'capability-not-loaded' }`), and the reverse case is the same. Engine failure during inference is `INFERENCE_FAILED` (the message does not contain a path). Producing no audio is also `INFERENCE_FAILED` (`details.reason: 'empty-audio'`). If `speech.wav` cannot be written to staging, it is `OUTPUT_WRITE_FAILED` (`details.file`).

#### 2.5.3 Text-to-image

Local text-to-image (architecture design §6.1, §6.5). There is no input file; the prompt is the entire input. The parameters are frozen by the Runtime at submission time (`JobRecord.generation`). The Worker follows them: it does not change the size and does not swap the seed.

```ts
params: {
  jobId: string;
  runGeneration: number;
  capability: 'image';
  options: {
    prompt: string;                   // verbatim
    width: number;                    // pixels
    height: number;
    steps: number | null;             // denoising steps; null uses the model default (20 for Qwen-Image). Given when the request supplies `steps` or the model pack check (§4.3) requires it
    seed: number;                     // 0..2^32-1; if the request gives none, the Runtime draws one at submission and freezes it; retries and re-runs use the same one
  };
  staging: string;
  outputContract: 'cuccut.image-png/v1';
}

result: {
  outcome: 'completed' | 'cancelled';
  output: { path: string; sha256: string; byteLength: number } | null;   // image.png in staging (§5.1), absolute path
  image: { width: number; height: number; format: 'png'; seed: number; steps: number } | null;
  stats: { generationMs: number; encodeMs: number };
}
```

The stages run in order: `encoding-prompt` (text encoding), `denoising` (`job.progress` with `unit: 'steps'`, reporting `0/n` at start and once after each completed step), and `decoding` (VAE decoding and PNG writing). Cancellation takes effect between steps, after which `outcome: 'cancelled'` is returned and no output is written. On the same machine with the same backend, the same parameters (including seed) produce a byte-identical image. The initial noise is determined by the seed, but MLX and candle each use their own random number generator (candle uses ChaCha20 on the host, same as v2), so the same seed produces different images on the two backends.

Checks beyond the shape all return `INVALID_PARAMS`. `outputContract` must be `cuccut.image-png/v1`. `staging` must be an absolute path. `prompt` must be non-empty after trimming whitespace. Width and height must be positive. `steps` must not be 0. Extra fields in `options`, or a missing `seed`, are shape errors. A size the model cannot produce is rejected before running with `MODEL_UNSUPPORTED` (`details: { family, reason: 'unsupported-size', width, height, rule }`). For Qwen-Image, both width and height must be multiples of 32, the long side must not exceed 1536, and the ratio of long side to short side must not exceed 3. The Runtime already rejected sizes against the list in the model description at submission, so this is a fallback. If a non-text-to-image model pack is loaded, `MODEL_UNSUPPORTED` is returned (`details: { capability: 'image', reason: 'capability-not-loaded' }`), and the reverse case is the same. Engine failure during inference is `INFERENCE_FAILED` (`details.reason: 'generation-failed'`, message without a path). If the output size differs from the request, it is `reason: 'size-mismatch'`. If the file cannot be written, it is `reason: 'write-failed'`.

#### 2.5.4 Separation

Local vocal separation (architecture design §6.1 `separateAudio`): splits one audio track, as a whole, into two streams, vocals and background.

```ts
params: {
  jobId: string;
  runGeneration: number;
  capability: 'separate';
  input: { file: string; contentHash: string; track: number };   // same as §2.5.1; no range accepted: the whole thing is processed
  options: { sampleRate: number | null };   // output sample rate, 8000–192000; null uses the model's working sample rate (44.1 kHz for HTDemucs)
  staging: string;
  outputContract: 'cuccut.stems-wav/v1';
}

result: {
  outcome: 'completed' | 'cancelled';
  stems: {                            // vocals.wav and background.wav in staging (§5), absolute paths; null when cancelled
    vocals: { path: string; sha256: string; byteLength: number };
    background: { path: string; sha256: string; byteLength: number };
  } | null;
  audio: { sampleRate: number; channels: 2; durationSec: number } | null;   // facts common to both streams
  stats: { decodeMs: number; separationMs: number; encodeMs: number };
}
```

The stages run in order: `decoding`, `separating`, `encoding`. The input is decoded into memory as a whole. For track 0, a mono or stereo WAV keeps its original sample rate. Other formats are decoded by ffmpeg into stereo at the model's working sample rate (mono is duplicated into two streams, and multichannel is downmixed into two streams). `htdemucs-ft` is a combination of four sub-models, each handling one stem. It runs at 44.1 kHz with 7.8-second windows and 0.25 overlap. The `steps` in `job.progress` is "windows × sub-models", reporting `0/n` at start. The background stream is the sum of drums, bass and the other three stems. `mlx` and `candle` read the same weights and compute the same result, so the two streams for the same input differ only in floating-point accumulation order. The two streams are resampled to `options.sampleRate`, aligned to the input's length at that sample rate, and written as 16-bit PCM stereo WAV (clipped to [−1, 1], with no loudness processing). The file is written to a temporary file first and then renamed.

Checks beyond the shape all return `INVALID_PARAMS`. `outputContract` must be `cuccut.stems-wav/v1`. `staging` must be an existing absolute directory. `input.file` must be an absolute path. `sampleRate` must be in range. If the input cannot be read or does not have that track, it is `INPUT_UNREADABLE`. If decoding fails, it is `DECODE_FAILED`. Inference failure is `INFERENCE_FAILED` (`details.reason: 'separation-failed'`; producing no output is `'empty-audio'`). If the output cannot be written, it is `OUTPUT_WRITE_FAILED` (`details.file`). If a non-separation model pack is loaded, `MODEL_UNSUPPORTED` is returned (`details: { capability: 'separate', reason: 'capability-not-loaded' }`), and the reverse case is the same.

#### 2.5.5 Speaker diarization of an existing transcript

Diarizes speakers in an existing transcript without re-recognizing it (the UI's "Identify speakers", architecture design §6.6). What is loaded is the "speaker diarization" model bundle itself (only `segmentation` and `speaker`, §4.1). The Runtime passes in the word times of the transcript; the Worker only diarizes and projects, and does not change the text.

```ts
params: {
  jobId: string;
  runGeneration: number;
  capability: 'diarize';
  input: { file: string; contentHash: string; track: number; range?: TickRange };   // Same as §2.5.1; range is the segment to decode; if omitted, the whole track
  options: {
    timescale?: number;               // Tick scale for words and the times in the result; default 1_000_000
    words: Array<[start: number, end: number]>;   // Start and end of each transcript word in source-asset time (ticks), in transcript order; may be empty
  };
  staging: string;
  outputContract: 'cuccut.speakers/v1';
}

result: {
  outcome: 'completed' | 'cancelled';
  output: { path: string; sha256: string; byteLength: number } | null;   // speakers.json in staging; null when cancelled
  speakers: number;                   // Number of speakers found; 0 when cancelled
  stats: { decodeMs: number; diarizeMs: number };
}
```

`speakers.json`:

```ts
{
  schema: 'cuccut.speakers/v1';
  clock: 'source-asset';
  timescale: number;
  speakers: Array<{ id: string; words: number; seconds: number }>;   // id is 'spk-1', 'spk-2', …; seconds is the total duration of the speaker's ranges
  ranges: Array<{ start: number; end: number; speaker: string }>;    // Speaker ranges, in source-asset ticks
  words: Array<string | null>;        // One-to-one with options.words: the projected speaker; null for words with no evidence
  provenance: {
    provider: 'local'; bundleId: string; backend: string; device: string; workerVersion: string;
    inputHash: string; runGeneration: number;
    models: { segmentation: ModelRef; speaker: ModelRef };
    threshold: number; sampleRate: 16000;
  };
}
```

The phases run in order: `decoding` (this segment is decoded to 16 kHz mono; `job.progress` is in seconds), `diarizing` (`steps`), `finalizing`. Diarization is the same as the speaker diarization done during recognition (§2.5.1): Pyannote segmentation with 10-second windows and a 5-second step, WeSpeaker extracts speaker embeddings, constrained agglomerative clustering (merge threshold 0.715, no limit on the number of speakers), and then the ranges are projected onto the words by word time. Speakers are numbered in the order they first appear on a word, and speakers with no words come last. Both models are read in at `model.load` and stay resident until unload. Cancellation takes effect at the next window, with `outcome: 'cancelled'` and no output written.

Any check beyond the shape is `INVALID_PARAMS`: `outputContract` must be `cuccut.speakers/v1`, `staging` must be an existing absolute directory, `input.file` must be an absolute path, `timescale` must be positive, `range`'s `end` must be greater than `start`, a word's `end` must not be earlier than its `start`, and the word count must not exceed 2 million. Input that cannot be read or has no such track is `INPUT_UNREADABLE`; a failure while decoding is `DECODE_FAILED`; a model error is `INFERENCE_FAILED` (`details.reason: 'diarization-failed'`). This differs from recognition, where it degrades to a warning, because here diarization is the task itself. A failure to write the output is `OUTPUT_WRITE_FAILED` (`details.file`). If the loaded bundle is not a speaker diarization bundle, `MODEL_UNSUPPORTED` is returned (`details: { capability: 'diarize', reason: 'capability-not-loaded' }`), and the reverse also applies.

### 2.6 `job.cancel`

```ts
params: { jobId: string }
result: { acknowledged: true }
```

The Worker responds immediately, then stops the job at the next segment boundary (for synthesis, the next generation step or sentence; for image generation, the next denoising step; for separation and speaker diarization, the next window). `job.run` then returns with `outcome: 'cancelled'`. An unknown `jobId` returns `NOT_FOUND`.

## 3. Events

| Event | params | Meaning |
| --- | --- | --- |
| `model.phase` | `{ phase: 'loading-weights' \| 'compiling' \| 'warming-up', detail?: string }` | Loading phase; no percentage |
| `job.phase` | Recognition: `{ jobId, phase: 'decoding' \| 'vad' \| 'transcribing' \| 'aligning' \| 'diarizing' \| 'finalizing' }`; synthesis: `{ jobId, phase: 'preparing-reference' \| 'synthesizing' \| 'encoding' }` (the first is skipped when there is no reference recording); image generation: `{ jobId, phase: 'encoding-prompt' \| 'denoising' \| 'decoding' }`; separation: `{ jobId, phase: 'decoding' \| 'separating' \| 'encoding' }`; speaker diarization: `{ jobId, phase: 'decoding' \| 'diarizing' \| 'finalizing' }` | Phase change; before the first event, `worker.status` reports `starting` |
| `job.progress` | `{ jobId, phase, done: number, total: number \| null, unit: 'seconds' \| 'segments' \| 'steps' }` | `total` is null when unknown, not made up; `steps` are synthesis generation steps or sentences and image denoising steps; for separation it is "windows × sub-models"; for speaker diarization it is windows |
| `job.segment` | `{ jobId, segment: Segment }` | One recognition segment completed; the same as one line in `segmentsFile` |
| `job.warning` | `{ jobId, warning: Warning }` | A structured recognition warning; it also appears in the result's `warnings[]` |
| `job.language` | `{ jobId, tag: string, confidence: number \| null }` | Language auto-detected by recognition |

Events only describe facts; the Runtime updates the `jobs` topic from them.

## 4. Model bundle description

### 4.1 Model bundles and files

The Runtime hands every file path of the model bundle to the Worker explicitly; the Worker does not scan directories and does not access the network.

```ts
interface ModelBundle {
  bundleId: string;                   // e.g. 'qwen3-asr-0.6b@mlx-4bit', 'qwen3-asr-0.6b@candle'
  backend: 'mlx' | 'coreml' | 'candle' | 'ggml' | 'audio-cpp';   // mlx and coreml only on macOS on Apple Silicon; audio-cpp is not handed to the Worker (§4.4)
  device: string;                     // 'metal' for mlx, 'ane' for coreml, 'cuda' or 'cpu' for candle, 'cuda', 'vulkan', 'metal' or 'cpu' for ggml (§2.1); 'auto' for audio-cpp (the engine chooses, §4.4)
  components: {
    asr?: ModelFiles;
    vad?: ModelFiles;
    tokenizer?: ModelFiles;           // Tokenizer from a separate repo for the recognition model (Whisper)
    aligner?: ModelFiles;
    speaker?: ModelFiles;
    segmentation?: ModelFiles;        // Speaker segmentation (Pyannote; comes with speaker from the “speaker diarization” bundle, §2.5.1)
    tts?: ModelFiles;                 // Main model for synthesis
    codec?: ModelFiles;               // Speech codec (the 12 Hz tokenizer of Qwen3-TTS)
    aux?: ModelFiles;                 // Auxiliary weights (IndexTTS 2.5 uses the speaker and vocoder weights of IndexTTS2)
    separator?: ModelFiles;           // Vocal separation model (HTDemucs-FT)
    image?: ModelFiles;               // Text-to-image model (Qwen-Image: tokenizer, scheduler config, text encoder, DiT and VAE in one repo)
    music?: ModelFiles;               // Music generation model (YuE2 GGUF: main model, VAE and token table in one repo); not in the same bundle as other components, and the Worker does not load it (§4.4)
  };
  threads: number;                    // Upper limit on CPU threads
  memoryBudgetBytes: number | null;   // Budget given by admission; null means unlimited
}

interface ModelFiles {
  family:
    | 'qwen3-asr' | 'whisper-mlx' | 'whisper-coreml' | 'whisper-ggml' | 'moss-transcribe-diarize' | 'whisper-tokenizer'
    | 'qwen3-forced-aligner' | 'silero-vad' | 'wespeaker' | 'pyannote-segmentation'
    | 'qwen3-tts' | 'qwen3-tts-tokenizer' | 'indextts2' | 'indextts2.5' | 'indextts2-aux'
    | 'gpt-sovits' | 'voxcpm2' | 'omnivoice' | 'qwen-image'
    | 'htdemucs-ft'
    | 'yue2';                         // Music generation (§4.4); read only by the audio.cpp engine
  revision: string;                   // Revision of the upstream repo
  dir: string;                        // Absolute path
  files: Array<{ path: string; sha256: string; byteLength: number }>;   // Relative to dir
}
```

The layout of the model directory is `<models-root>/<owner>/<repo>/`. `<models-root>` defaults to `<runtime-home>/models` and can be changed in settings (`models.dir`, via `models.setDir`); `CUCCUT_MODELS_DIR` takes precedence (architecture design §6.3). The Worker only reads files at the paths given by `load_bundle` and does not care where the model directory is; before changing directories, the Runtime unloads all Workers. Each repo directory carries `.ccut-manifest.json` (`format_version: 1`, with `repo`, `revision`, `files[{path,size,sha256}]`), compatible with downloaders from older CucCut versions. The Runtime takes its `files` source from this manifest for the model directory; a missing manifest, or one that disagrees with disk, means `not-installed`. The Worker checks the size of each entry in `files` before loading; the sha256 check is done by the Runtime at install and registration time, and the Worker reads no file beyond those listed in `files`. `family` decides the loader; an unknown `family` returns `MODEL_UNSUPPORTED`. A model bundle is exactly one of: recognition (`asr` is required, and the other components follow `asr`'s family); synthesis (`tts` is required, and `codec` and `aux` follow the model family); image generation (only `image`; with any other component it is `MODEL_UNSUPPORTED`); separation (only `separator`; with any other component it is `unexpected-component`); or speaker diarization (`segmentation` and `speaker` are both required, with families `pyannote-segmentation` and `wespeaker`, no `asr`; with any other component it is `unexpected-component`; §2.5.5). They are not mixed. Image generation does not check weight size against `memoryBudgetBytes`: the three weight groups are streamed in layer by layer and never resident together, so peak process memory is far below the total weight size. Admission is done by the Runtime, using the measured peak recorded for the model bundle (architecture design §6.5). Recognition components:

| `asr` family | `vad` | `tokenizer` | `aligner`, `speaker` | `segmentation` |
| --- | --- | --- | --- | --- |
| `qwen3-asr` | Required (`silero-vad`) | Must not be present | Optional | Optional (`pyannote-segmentation`) |
| `whisper-mlx` | Required (`silero-vad`) | Required (`whisper-tokenizer`) | Optional | Optional (`pyannote-segmentation`) |
| `whisper-coreml` | Required (`silero-vad`) | Required (`whisper-tokenizer`) | Optional | Optional (`pyannote-segmentation`) |
| `whisper-ggml` | Required (`silero-vad`) | Must not be present (the vocabulary is in the GGML file) | Optional | Optional (`pyannote-segmentation`) |
| `moss-transcribe-diarize` | Must not be present (it segments itself) | Must not be present | Optional | Must not be present (it diarizes speakers itself) |

A missing required component is `MODEL_UNSUPPORTED` (`details: { component, reason: 'missing-component' }`). An extra component that should not be there gives `reason: 'unexpected-component'`, and a component with the wrong family gives `reason: 'unknown-family'`. The Runtime may mark shared components (the aligner and the speaker model) as optional in a registered model bundle. Install and repair still download them; when one is missing, the model bundle still counts as installed, and it is left out of the `components` handed to the Worker. `segmentation` and `speaker` may also come from the “speaker diarization” bundle registered by a recognition bundle: when that bundle is installed, the Runtime adds its two components to the `components` handed to the Worker, and when it is not installed, neither is added (architecture design §6.3). Core ML models are directories (`.mlmodelc`): the manifest and `files` must list every file in the directory one by one (sizes are still checked per file). The Worker hands the directory to the framework as a whole and does not scan it. If no file under that directory is listed in `files`, it is `MODEL_NOT_INSTALLED` (`details: { component, file: '<directory>/', reason: 'not-listed' }`). The device for the `coreml` backend is `ane` (the encoder and decoder run on the Neural Engine, mel on CPU and GPU); any other device is `MODEL_UNSUPPORTED` (`reason: 'unsupported-device'`). VAD runs on MLX, and without a Metal device the backend is unavailable. The `candle` backend reads the same repo as MLX (MLX's affine-quantized weights are dequantized at load time: computed in f32 on CPU, and in the weights' half precision on CUDA; `qwen-image` dequantizes layer by layer when used, and computes in bf16 on CUDA). The device is `cpu` or `cuda`; `cuda` requires the Worker to have reported it in §2.1, otherwise it is `MODEL_UNSUPPORTED` (`reason: 'unsupported-device'`), like any other device. Silero VAD always runs on CPU under `candle`. The `ggml` backend loads `whisper-ggml`'s `asr` as-is at its quantization, using whisper.cpp: there must be one `.bin` (a single-file GGML weight); if none is listed, it is `MODEL_NOT_INSTALLED` (`details: { component: 'asr', file: '*.bin', reason: 'not-listed' }`). VAD and the aligner borrow `candle`'s and run on CPU, so `ggml` is only available in builds that also compile in `candle`. The device is `cpu`, `cuda`, `vulkan` or `metal`. GPU devices require the Worker to report it as the preferred device in §2.1 (a Worker compiled with both GPU backends that selects CUDA does not accept `vulkan`); any other device is `MODEL_UNSUPPORTED` (`reason: 'unsupported-device'`). A `cpu` model bundle does not submit GPU compute. On Intel Macs, the Metal Worker sets `GGML_METAL_CONCURRENCY_DISABLE=1` automatically before starting threads (re-executing the same PID), to avoid compute errors in the current ggml concurrency scheduling on AMD discrete GPUs; this does not change the protocol or the device labels. The `asr` for `whisper-coreml` must have `MelSpectrogram.mlmodelc/`, `AudioEncoder.mlmodelc/`, `TextDecoder.mlmodelc/` and `generation_config.json`; if `TextDecoderContextPrefill.mlmodelc/` is present (large-v3-turbo), it is used to prefill the prefix; the `tokenizer` must have `tokenizer.json`. The `asr` for `whisper-mlx` (`mlx` backend, device `metal`) is mlx-community's fp16 conversion: it must have `config.json` (the structural fields of the original OpenAI format: `n_mels`, `n_audio_*`, `n_text_*`, `n_vocab`) and `.safetensors` weights. If the config structure does not match (for example, not a 30-second window, or a text context shorter than 224), it is `MODEL_UNSUPPORTED` (`details: { component: 'asr', file: 'config.json', reason: 'unsupported-config' }`), reported before the weights are read. The `tokenizer` must have `tokenizer.json` and `generation_config.json` (for Core ML, `generation_config.json` is in `asr`; the MLX conversion repo does not have it, so the same file is taken from the tokenizer repo). The `htdemucs-ft` `separator` must have `htdemucs_ft.safetensors` and `htdemucs_ft_config.json` (fp16 weights are upcast to f32 after loading, and resident size is about twice the file; `candle` computes in f32 on both CPU and CUDA, not in half precision). Several model bundles using the same repo version share one repo directory, and deletion keeps it while it is still referenced (architecture design §6.3).

### 4.2 Built-in manifest and download

Architecture design §6.3. The Worker does not download. For each registered component (one pinned `revision` of an upstream repo), the Runtime ships a built-in manifest: the files to download, each file's sha256 and size (size is null when it cannot be confirmed offline; when building an install plan, send a HEAD request to the source and use `x-linked-size` or `Content-Length`). The manifest also notes where the estimated value and the hash come from, for use when the size is unknown and must be confirmed. Rules:

- Download only the files the manifest lists, from `<base>/<owner>/<repo>/resolve/<revision>/<file path>` (base URL: see architecture design §6.3; URL-encode each segment, keep `/`).
- First write into `<models-root>/.ccut-staging/<owner>/<repo>@<revision>/`. An unfinished file is `<path>.part`; when resuming, send `Range: bytes=<bytes already present>-`. A `206` response's `Content-Range` must start at that position. A `200` means the source does not support resume, so write from the beginning. Check each file's size and sha256 against the manifest; only when both match is it renamed to `<path>`. Files already verified in staging are not downloaded again.
- When all files of a repo are present, write `.ccut-manifest.json` (`files` holds the actual sizes and sha256, `source_verified: true`, `source` is the base URL used for the download), then rename the whole staging directory to the repo directory (move the old directory aside first, and delete it after the swap). Staging and the model directory are on the same volume, so the rename is atomic.
- If any file in the manifest lacks a trustworthy sha256, the whole component is refused (`MODEL_MANIFEST_INCOMPLETE`); the hash is not computed after downloading. The origin and verification status of hashes are recorded in the manifest notes; hashes not yet re-verified are listed in architecture design §14.
- Repair reads every file in the repo directory and computes its sha256. Good files are hard-linked into staging (copied if linking fails); only the bad and missing files are downloaded, and then the repo is published as above.

### 4.3 Checks

**Recognition.** A fixed sample ships with the Runtime (the transcript is English reading, `packages/models/assets/self-test-sample.wav`, 16 kHz mono; after packaging it is at `<resources>/model-assets/`; for how to locate it, see `CUCCUT_MODEL_ASSETS_DIR` in the root README). The check uses it as input through `model.load` → `job.run`, validates the output per §6, then checks that the recognized text (lowercased, punctuation removed; for English, single-digit number words and Arabic numerals count as equal) contains a fixed phrase.

**Synthesis.** Synthesize one fixed short sentence with the model's default voice (the one submission picks when no voice is specified; built-in voices still come with their reference recordings). Use the first language the model lists that has a sentence; if the model accepts any language, or none of its listed languages has a sentence, use the English sentence. The sentence table is in `packages/models/src/speech-self-test.ts`. Check the output's length and digest per §5.1, then judge:

- Decodable: RIFF/WAVE, PCM 16/24/32-bit or 32-bit float (including `WAVE_FORMAT_EXTENSIBLE`), 1–2 channels, sample rate 8–192 kHz;
- Duration between 0.3 and 30 seconds;
- Not silent: the RMS of all samples (full scale = 1) is not below 0.001 (about −60 dBFS);
- No clipping: samples at full scale (|x| ≥ 0.999) are no more than 0.1% of all samples. The local engine's output is limited to −1 dBFS (§5.1), so a ratio above this means that step failed.

The check does not judge whether the speech is read correctly (that would need a separate recognition model); it only proves that the whole synthesis path produces sound. On pass, record the duration and sample rate and keep the WAV as an artifact; on failure, record the reason.

**Text-to-image.** Generate one image with a fixed prompt, 256×256, 4 steps, seed 7 (parameters in `packages/models/src/image-self-test.ts`). Check the output's length and digest per §5.1, then judge:

- Decodable: 8-bit PNG (grayscale, RGB, grayscale with alpha, or RGBA), not interlaced;
- Width and height equal the requested 256×256;
- Not a single solid color: at least 16 distinct colors (counting alpha).

The check does not judge whether the image looks good; it only proves that the whole image generation path produces an image. On pass, record the size and step count and keep the PNG as an artifact; on failure, record the reason.

**Music.** Does not go through the Worker (§4.4). Start one engine with a fixed style description (`calm solo piano, slow tempo`), `instrumental`, no arrangement (`planning: 'off'`), an 8-second cap, seed 7, and 4 steps (parameters in `packages/models/src/music-self-test.ts`). Check the output's length and digest per §5.1; the judgment is the same as for synthesis (decodable, 0.3–30 seconds, not silent, no clipping). The check does not judge whether the music sounds good; it only proves that the engine and weights produce sound. On pass, record the duration, sample rate and step count and keep the WAV as an artifact; on failure, record the reason. If the engine component is missing, the model pack is incomplete (`not-installed` / `incomplete`, with `detail` naming `audiocpp-engine`). `models.test` refuses it with `MODEL_UNAVAILABLE`, as it does for other incompletely installed model packs, and the check can run only after the install is repaired.

**Separation.** Separate the same sample used for recognition (vocals only) per §2.5.4, with `sampleRate` null. Check both outputs' length and digest per §5, then judge:

- Both decodable (as above), stereo, same sample rate, and duration and sample count differ by no more than 0.02 seconds;
- Vocals not silent: RMS not below 0.001;
- Vocals separated from the background: the vocal RMS is at least 2 times the background RMS (about 6 dB). HTDemucs-FT is about 40 dB higher on this sample.

On pass, record the duration, sample rate and how many dB the vocals exceed the background, and keep the vocal WAV as an artifact; on failure, record the reason (`MODEL_OUTPUT_WRONG`).

### 4.4 Music generation model pack and the audio.cpp engine

The model pack for music generation (`generateMusic`, architecture design §6.1) is the GGUF weights for the `music` capability on the `audio-cpp` backend. Currently this is `yue2-3b@audio-cpp-q8`: from the `audio-cpp/Yue2-3B-GGUF` repo, the Q8 main model `yue2-3b-q8_0.gguf`, the F16 VAE `yue2-vae-f16.gguf`, and four config files, about 4.6 GB in total; `yue2` family; license CC-BY-NC-4.0. It has two parts: the weights, and the audio.cpp engine, a shared component (next paragraph). It **is not handed to the Model Worker**. The Runtime's local Provider starts one audio.cpp engine process per task (`audiocpp_cli`); the engine reads the GGUF files directly from the model pack directory, writes the WAV into this attempt's staging, and exits when done. It does not stay resident, and there is no `model.load` and no `job.cancel`. (Cancel ends the whole process group: SIGTERM first, then SIGKILL after a 5-second grace period; on Windows, the whole process tree is ended.) Installing, manifesting and verifying the model pack follow §4.1–4.2 (`.ccut-manifest.json`, download only the files the manifest lists); the engine component is downloaded along with it.

**Engine.** audio.cpp is not distributed with the app, and it is not a managed external tool. It is the shared component `audiocpp-engine` of the music model pack (architecture design §6.3; download, reference counting and reclamation work as for other components). The upstream prebuilt package version, per-platform filenames, sizes and sha256 are registered in `music-engine.ts` in `@cuccut/models` (currently 0.9.1; macOS arm64 / x64 use the Metal build, Windows / Linux x64 use the Vulkan portable build, and other platforms have no package; license Apache-2.0). It is downloaded with the model pack, verified, and unpacked to `<runtime-home>/tools/audiocpp/<version>/`. After unpacking, the version directory gets a `.ccut-manifest.json` (path, size and sha256 of each file), and check, verify and repair all use it. If an executable exists without a manifest (installed by the old external-tool path), it counts as installed and verification passes directly; repair re-downloads the archive. Staging is at `<runtime-home>/tools/.ccut-staging/audiocpp@<version>/` (archive, `.part`, `unpacked/`); cancel keeps the parts already downloaded. The archive URL follows the tool download source (`tools.downloadEndpoint` / `CUCCUT_TOOLS_ENDPOINT`: `<base>/audiocpp/<version>/<filename>`, otherwise the registered official release address). The size uses the registered value, with no HEAD probe. After publishing, run `audiocpp_cli --version`; if the first line is not `audio.cpp <version>`, delete the published directory and archive and fail with `MODEL_DOWNLOAD_INTEGRITY`. When the last model pack that uses it is deleted, remove `tools/audiocpp/<version>/` (and `tools/audiocpp/` too if it is then empty), without touching `tools/`. The executable is found in this order, re-resolved for each task (no restart is needed after installing): the environment variable `CUCCUT_AUDIOCPP_CLI` (if set, only it is used; a file that does not exist counts as not found) → the installed component (`<runtime-home>/tools/audiocpp/<registered version>/audiocpp_cli`) → `PATH`. `PATH` is only a fallback at task execution time. Model pack status and the capability view recognize only the override variable and the installed component, so with an engine only on `PATH` the model pack stays `incomplete` and is not routed to. When the override variable points to an existing file, the `audiocpp-engine` component reports `installed` (`bytes: null`), the install plan says `keep`, nothing is downloaded, and it no longer reports `unsupported` for lacking a platform package. If the variable is set but the file does not exist, the component counts as missing (model pack `incomplete`). Status never looks at `PATH`. The first line of `audiocpp_cli --version` is `audio.cpp <version>` (self-built binaries print `audio.cpp dev`), and probing reads the version from it. When the weights are present but the engine component is not installed, model pack status is `not-installed` / `reason: 'incomplete'`, with `detail` naming `audiocpp-engine`. The capability view also reports `not-installed` for this item, with an install remedy (repair downloads only the missing component). A missing model pack and a missing engine component are both `not-installed`, but their `detail` differs. When the current host platform has no engine package and `CUCCUT_AUDIOCPP_CLI` is not set, the status is `error` / `unsupported`. The engine picks its device at build time (Metal, CUDA, Vulkan or CPU); `--backend` is passed only when `CUCCUT_AUDIOCPP_BACKEND` (`metal` / `cuda` / `vulkan` / `cpu`) is set.

**Command line.** The frozen parameters (`JobRecord.generation`, `capability: 'generateMusic'`) are converted into engine arguments. `cwd` is staging. The tails of stdout and stderr (2000 characters) are kept for failure explanations:

```text
audiocpp_cli --task gen --family yue2 --model <model pack directory> --threads <n>
  --lyrics <lyrics; empty string when instrumental>
  --request-option style=<style>
  --request-option cot=<planning: off | melody | full>
  --request-option seed=<seed>
  --request-option semantic_max_tokens=<round(maxDurationSec × 25), at least 1>
  [--request-option num_inference_steps=<steps>]        # passed only when steps is pinned (or the self-test's reduced step count); otherwise the engine default is used
  --session-option yue2.model_gguf=yue2-3b-q8_0.gguf      # relative to the --model root; the engine rejects absolute paths
  --session-option yue2.vae_gguf=yue2-vae-f16.gguf
  --out-dir <staging> --out music.wav --log
  [--backend <metal | cuda | vulkan | cpu>]
```

- There is no direct duration parameter. `maxDurationSec` is converted to `semantic_max_tokens` using the semantic frame rate registered for the model pack (YuE2 produces 25 semantic tokens per second), so it is a compute budget, not a promised duration. `targetDurationSec` is written only in the task record and is not passed to the engine.
- The thread count defaults to `min(8, available parallelism − 2)`, and is at least 1.
- The engine does not report step counts. Once in `generating`, progress is indeterminate; on completion it reports 1/1.

**Result.** Success requires exit code 0 and a `music.wav` in staging. If the engine renamed the file by its own rules, take the first `.wav` in staging and rename it to `music.wav`. If the engine cannot be found or the process fails to start, the status is `unavailable` (task error `MODEL_LOAD_FAILED`; in that case the failure text is the `musicEngineMissing` copy, `details.reason` is `not-installed`, and `details.bundleId` is the model pack). A non-zero exit is `crashed` (`MODEL_WORKER_CRASHED`, with the stderr tail attached). Exiting without a WAV is `protocol` (`MODEL_OUTPUT_INVALID`). The command and protocol spec are in §11.3. The output contract is `cuccut.music-wav/v1` (§5.1). If the WAV's duration reaches 98% of `maxDurationSec`, it is treated as hitting the cap: the task completes with an `output-truncated` warning. `workerVersion` is recorded as `audiocpp_cli@<executable file name>`.

**Resources.** There is no resident process and no holder. Each task charges the model pack's registered estimated peak directly to the task (YuE2 Q8 plus F16 VAE is about 10 GiB, `peakEstimated`; upstream measured about 8.9 GB on a 32 GB NVIDIA card, and this leaves a margin). Apple Silicon counts GPU memory, and other platforms count system memory. Add 256 MiB for staging (a five-minute 44.1 kHz stereo WAV is about 50 MiB plus logs); architecture design §7.7.

## 5. Tasks and the staging directory

- For each task, the Runtime creates `<runtime-home>/staging/jobs/<jobId>/` and passes it in as `staging`. All of the Worker's intermediate files and outputs are written here, under fixed file names: recognition uses `audio.f32` (optional, decoded cache), `segments.jsonl` and `result.json`; synthesis uses `speech.wav`, image generation uses `image.png`, and music uses `music.wav` (§5.1, written by the audio.cpp engine, §4.4); separation uses `vocals.wav` and `background.wav` (§2.5.4); speaker diarization uses `speakers.json` (§2.5.5).
- `segments.jsonl` is append-only. Each line is one `Segment` (§6), written in increasing `start` order, and each line is flushed once it is written. The first line is the header: `{ "header": true, "jobId", "contentHash", "bundleId", "workerVersion", "timescale" }`. When the Runtime resumes a run (P1), it checks the header and the existing lines before deciding which segment to start from.
- `result.json` is written in one go when the task completes: first to a temporary file, then renamed into place. Its content is the object defined in §6. The `output.sha256` of `job.run` is the digest of this file's bytes.
- The Worker does not delete the staging directory. Cleanup belongs to the Runtime.

### 5.1 Output of generation tasks

The executors of `synthesizeSpeech`, `generateImage` and `generateMusic` (online providers, the local Worker, the local audio.cpp engine, and later nodes) follow the same output convention. The Runtime validates against it before publishing (architecture design §6.4):

- The input is the set of parameters frozen at submission (`JobRecord.generation`). Executors do not change parameters, swap models or change voices. If they cannot comply, they fail.
- Each output is written to staging as `output-<n>.<extension>` (`n` starts at 1; extensions `mp3`, `wav`, `flac`, `png`, `jpg`, `webp`). On completion, the executor reports the relative path, the sha256 (lowercase hex), the length and the media type (`audio/mpeg`, `audio/wav`, `audio/flac`, `image/png`, `image/jpeg`, `image/webp`).
- The output contract for local Worker synthesis (§2.5.2) is `cuccut.speech-wav/v1`: one PCM WAV (16/24/32-bit integer or 32-bit float, mono or stereo, sample rate is the model's native sample rate), with the fixed file name `speech.wav`, written to a temporary file and then renamed. If the peak of the whole clip is above −1 dBFS (about 0.891 when full scale is 1), the Worker scales the whole clip proportionally down to −1 dBFS before writing (non-finite samples are first set to zero). It does not boost quiet output and does no compression. The Worker reports an absolute path. The local Provider converts it to a path relative to staging. If the file is not `speech.wav`, it is treated as a protocol error.
- The output contract for local Worker image generation (§2.5.3) is `cuccut.image-png/v1`: one 8-bit RGBA PNG whose width and height are the requested width and height, with the fixed file name `image.png`, written to a temporary file and then renamed. The fourth channel is the alpha that the model (the Qwen-Image VAE) produces itself, and it is written through unchanged. The local Provider likewise converts the path to a relative one. If the file is not `image.png`, it is treated as a protocol error.
- The output contract for local music generation (§4.4) is `cuccut.music-wav/v1`: one PCM WAV (16/24/32-bit integer or 32-bit float, mono or stereo, sample rate is the model's sample rate, 44.1 kHz for YuE2), with the fixed file name `music.wav`, written directly by the engine (no −1 dBFS limiting in the Worker). Media type `audio/wav`. The local Provider reports the path relative to staging. If the process exits without producing a WAV, it is treated as a protocol error.
- The number of outputs equals the number of requested items (1 for speech and music). The media type equals the requested format.
- The Runtime checks the length and digest, and the file header against the declared type. It then fully decodes the file with ffprobe using that format's demuxer: audio must have a positive duration, sample rate and channel count; images must have a positive width and height. Failures map to `MODEL_OUTPUT_INVALID` (command and protocol spec §11.3), and the original file is moved to `logs/diagnostics/<jobId>/`.

## 6. Output contract `cuccut.asr-result/v1`

All times are integer ticks, and `clock` is fixed to `source-asset`. Tick 0 corresponds to time 0 of the asset, even when `input.range` processed only one part of it.

```ts
interface AsrResult {
  schema: 'cuccut.asr-result/v1';
  outcome: 'transcribed' | 'no-audio-track' | 'no-speech';
  timescale: number;
  clock: 'source-asset';
  duration: number;                   // end of the processed region on the asset clock, in ticks; the asset duration when there is no range, 0 when there is no audio track
  language: { tag: string | null; source: 'asserted' | 'detected' | 'unknown'; confidence: number | null };
  segments: Segment[];
  speakers: Array<{ id: string; label: string | null }>;
  coverage: Array<{ start: number; end: number }>;      // ranges actually processed, in ticks
  warnings: Warning[];
  provenance: Provenance;
}

interface Segment {
  id: string;                         // 'seg-0001', unique within the task and increasing
  start: number; end: number;         // ticks
  text: string;
  speakerId: string | null;
  words: Word[];
}

interface Word {
  start: number; end: number;         // ticks
  text: string;
  confidence: number | null;
  timingQuality: 'aligned' | 'provider' | 'estimated' | 'missing';
  speakerId?: string;                 // speaker that diarization assigned to this word (§2.5.1); absent when there is no diarization
}

interface Warning {
  code:
    | 'alignment-failed' | 'timing-adjusted' | 'backend-degraded' | 'diarization-unavailable' | 'segment-degenerate' | 'range-clamped'
    | 'hint-ignored'                    // the model has no prompt channel, so `hint` was not passed to it (§2.5.1); for models that do not accept prompts the Runtime does not send `hint`, and records this warning itself at submission
    | 'segment-incomplete';             // the model left one block unfinished; the recognized part is kept, and words may be missing later
  segmentId?: string;
  detail?: string;
}

interface Provenance {
  provider: 'local' | string;         // cloud providers fill in their id
  bundleId: string | null;
  models: { asr?: ModelRef; vad?: ModelRef; aligner?: ModelRef; speaker?: ModelRef; segmentation?: ModelRef };
  backend: string; device: string;
  workerVersion: string;
  inputHash: string;                  // equals `input.contentHash`; the job spec's input hash is recorded by the Runtime in the application result
  runGeneration: number;
  cost?: { status: 'reported' | 'unknown'; usage?: unknown };  // only given by online providers; not written by the local Worker
}
interface ModelRef { family: string; revision: string }
```

Validation rules (the Runtime enforces them before publishing, and the Worker self-checks before writing):

- `segments` are in increasing `start` order and do not overlap. Each satisfies `0 ≤ start < end ≤ duration`. Within a segment, `words` are monotonic and lie inside the segment. `word.text` and `segment.text` must be non-empty. Whitespace-only text is allowed only when `outcome !== 'transcribed'`, in which case the text is empty as a whole.
- Words with `timingQuality` `aligned` require either `provenance.models.aligner` or the ASR's own word-level timing capability. Cloud providers without an aligner can only use `provider`, `estimated` or `missing`.
- Words with `missing` have `start === end`, taking the `start` of their segment.
- `language.tag` is a valid BCP 47 tag. With `source: 'asserted'`, it must equal the requested assertion.
- When `outcome !== 'transcribed'`, `segments` is empty, while `coverage` still gives the ranges actually checked.
- When a segment's `speakerId` is non-empty, and when a word has a `speakerId`, that ID must appear in `speakers[]`.
- `provenance.cost` (architecture design §6.4): it is `reported` when the online provider reported usage for every request. `usage` is the usage object exactly as the vendor reported it (for chunked submissions, the chunks' usage objects are collected into an array). If any chunk did not report usage, the status is `unknown`. Partial usage is not used to stand in for the total, and it is not converted into an amount. For online results, `bundleId` is null, `backend: 'online'`, `device: 'remote'`, and `models.asr` is `{ family: providerId, revision: modelId }`.

## 7. Errors

```ts
interface ErrorBody {
  code: string;
  message: string;                    // must not contain local absolute paths
  retryable: boolean;
  details?: object;
}
```

| code | Meaning | retryable |
| --- | --- | --- |
| `CONTRACT_MISMATCH` | `contractVersion` mismatch | false |
| `INVALID_PARAMS` / `UNKNOWN_METHOD` | protocol error | false |
| `ALREADY_LOADED` / `WORKER_BUSY` / `NOT_FOUND` | state error | false |
| `MODEL_NOT_INSTALLED` / `MODEL_UNSUPPORTED` / `MODEL_RESOURCE` | load failure, see §2.2 | false |
| `INPUT_UNREADABLE` | input file (the asset being recognized, or the reference recording for synthesis) does not exist, cannot be demuxed, or its demuxer is not on the allowlist | false |
| `DECODE_FAILED` | decoding failed partway through | true |
| `INFERENCE_FAILED` | model forward pass failed (not a crash) | true |
| `WORKER_PANIC` | Rust panic | true |
| `OUTPUT_WRITE_FAILED` | output cannot be written to staging (disk full, directory not writable; `details.file`) | true |

The Runtime maps these to `MODEL_LOAD_FAILED` / `MODEL_WORKER_CRASHED` / `MODEL_OUTPUT_INVALID` of the command and protocol spec §11.3. `OUTPUT_WRITE_FAILED` becomes `STAGING_WRITE_FAILED`. It is not counted as a crash and does not disable the model package (`DECODE_FAILED`, `INFERENCE_FAILED` and `WORKER_PANIC` do). `MODEL_UNSUPPORTED` returned by `job.run` also maps to `MODEL_LOAD_FAILED` (`details.reason: 'unsupported'`, with the Worker's `details` placed as-is in `details.workerDetails`), and it does not disable the model package. When the reference recording for synthesis does not match the digest recorded at submission before execution, or cannot be read, the Runtime does not send `job.run`, and the task fails with `ASSET_MISSING`.

## 8. Items for review

| Item | What needs to be decided | Current document's assumption |
| --- | --- | --- |
| Where decoding happens | Whether the Worker decodes itself (this document) or the Runtime decodes with ffmpeg and passes PCM | Worker decodes: ffmpeg pipeline as the main path, PCM WAV via a pure Rust path; the demuxer allowlist matches the Runtime's media analysis |
| `threads` and scheduling priority | The MLX backend does not use a CPU thread cap; how to set the priority of inference threads | `threads` is currently ignored; inference threads run at utility QoS on macOS, and are not adjusted on other platforms |
| Text input shape for `align` | Plain text or a structure with sentence boundaries | Plain text; the Worker segments words itself |
| Whether speaker embeddings go into the result | Whether `speakers[].embedding` is output for cross-task merging | Not output |
| Per-call text limit for synthesis | How many characters a local synthesis task accepts at once (the engine splits by sentence internally) | 2000 code points; beyond that, reject at submission rather than truncate; calibrate against measured memory and duration once each engine is connected |
| Hash and size of the built-in manifest | Who re-verifies the sha256 of the Qwen3-ASR 0.6B and Silero VAD repositories, and where; whether sizes are written into the manifest | sha256 carries over the values fixed in the old CucCut version and has not been re-verified in this repository (architecture design §14); sizes were obtained via HEAD at planning time. The sizes and sha256 of the recognition repositories registered later (Qwen3-ASR 1.7B, aligners, speaker models, Whisper, MOSS) have been checked one by one against the same versions installed on this machine |
| Integration of Whisper and MOSS | When the Core ML backend and the loaders for the two model families are connected; where speaker and word timing come from | Contracts and component shapes are settled (§2.1, §4.1). Whisper is integrated: the `coreml` backend, `transcribeFamilies` includes `whisper-coreml`, and two model packages are registered, large-v3 and large-v3-turbo. MLX Whisper (`whisper-mlx`) is also integrated, with `whisper-large-v3@mlx` and `whisper-large-v3-turbo@mlx` registered; the Runtime does not list them for now (whether they replace Core ML is pending, see architecture design §6.5). Word timing comes from the optional aligner (shared with Qwen3-ASR; the aligner runs on MLX), and when no aligner is installed it is estimated from character length. MOSS is integrated: builds with MLX list it in `transcribeFamilies`, with `moss-transcribe-diarize@mlx-8bit` registered (8-bit quantization). The optional aligner only aligns lines longer than 5 seconds, and the optional speaker model merges speakers across chunks (§2.5.1). Qwen3-ASR and Whisper distinguish speakers via the “speaker diarization” model package (Pyannote segmentation + WeSpeaker) (§2.5.1). On non-macOS, Qwen3-ASR and MOSS use candle, and Whisper uses `ggml` (whisper.cpp, on CPU, CUDA or Vulkan; architecture design §6.5), with `whisper-large-v3@ggml` and `whisper-large-v3-turbo@ggml` registered, also with the optional aligner (running on candle's CPU). Metal has been run successfully on an Intel Mac's Radeon Pro 5500M with Whisper large-v3 Turbo q8_0 on Chinese and English samples. CUDA and Vulkan have not yet been tested |
