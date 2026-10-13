//! The stdio protocol of the Model Worker (protocol specification §1–§3, §7): request parameters, responses, events and errors.
//!
//! Parameters are always `camelCase` and unknown fields are rejected; a wrong shape is `INVALID_PARAMS`.

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::bundle::ModelBundle;
use crate::synthesize::readings::Reading;

/// A line longer than this many bytes is a protocol error, and the Worker exits (§1).
pub const MAX_LINE_BYTES: usize = 16 * 1024 * 1024;
/// The only output contract.
pub const OUTPUT_CONTRACT: &str = "cuccut.asr-result/v1";
/// Upper limit (in characters) for `TranscribeOptions.hint`.
pub const HINT_MAX_CHARS: usize = 1_200;
/// Default value of `TranscribeOptions.timescale`.
pub const DEFAULT_TIMESCALE: u64 = 1_000_000;

/// Error codes (§7).
pub mod codes {
    pub const CONTRACT_MISMATCH: &str = "CONTRACT_MISMATCH";
    pub const INVALID_PARAMS: &str = "INVALID_PARAMS";
    pub const UNKNOWN_METHOD: &str = "UNKNOWN_METHOD";
    pub const ALREADY_LOADED: &str = "ALREADY_LOADED";
    pub const WORKER_BUSY: &str = "WORKER_BUSY";
    pub const NOT_FOUND: &str = "NOT_FOUND";
    pub const MODEL_NOT_INSTALLED: &str = "MODEL_NOT_INSTALLED";
    pub const MODEL_UNSUPPORTED: &str = "MODEL_UNSUPPORTED";
    pub const MODEL_RESOURCE: &str = "MODEL_RESOURCE";
    pub const INPUT_UNREADABLE: &str = "INPUT_UNREADABLE";
    pub const DECODE_FAILED: &str = "DECODE_FAILED";
    pub const INFERENCE_FAILED: &str = "INFERENCE_FAILED";
    /// The output file cannot be written to staging (disk full, permissions). This is unrelated to the model, so it does not count as a failure of the model bundle.
    pub const OUTPUT_WRITE_FAILED: &str = "OUTPUT_WRITE_FAILED";
    pub const WORKER_PANIC: &str = "WORKER_PANIC";
}

/// `ErrorBody` (§7). `message` does not contain absolute local paths.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl ErrorBody {
    /// `retryable` is determined by the error code (the table in §7).
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        let retryable = matches!(
            code,
            codes::DECODE_FAILED | codes::INFERENCE_FAILED | codes::OUTPUT_WRITE_FAILED | codes::WORKER_PANIC
        );
        Self {
            code: code.to_owned(),
            message: message.into(),
            retryable,
            details: None,
        }
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn invalid_params(message: impl Into<String>) -> Self {
        Self::new(codes::INVALID_PARAMS, message)
    }
}

/// Lets `ErrorBody` pass through `?` into `anyhow::Error` (used when ported engine code fetches files from a file list), and then gets it back unchanged at the backend boundary.
impl std::fmt::Display for ErrorBody {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ErrorBody {}

/// Parses `params` into `T`; a wrong shape is `INVALID_PARAMS`.
pub fn parse_params<T: DeserializeOwned>(params: Value) -> Result<T, ErrorBody> {
    serde_json::from_value(params).map_err(|e| ErrorBody::invalid_params(format!("参数不合法：{e}")))
}

/// A push message: `{ "event", "params" }`.
pub fn event(name: &str, params: Value) -> Value {
    json!({ "event": name, "params": params })
}

// ---- Request parameters -------------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HelloParams {
    pub contract_version: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LoadParams {
    pub bundle: ModelBundle,
}

/// Empty parameters for `model.unload` / `worker.status`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EmptyParams {}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CancelParams {
    pub job_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Capability {
    Transcribe,
    Align,
    /// Local speech synthesis (§2.5.2): the parameters are [`SynthesizeRunParams`], not [`JobRunParams`].
    Synthesize,
    /// Vocal and accompaniment separation (§2.5.4): the parameters are [`SeparateRunParams`], not [`JobRunParams`].
    Separate,
    /// Local text-to-image (§2.5.3): the parameters are [`ImageRunParams`], not [`JobRunParams`].
    Image,
    /// Speaker diarization of the words of an existing transcript (§2.5.5): the parameters are [`DiarizeRunParams`], not [`JobRunParams`].
    Diarize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JobRunParams {
    pub job_id: String,
    pub run_generation: u64,
    pub capability: Capability,
    pub input: JobInput,
    /// Further parsed by `capability`: `transcribe` is [`TranscribeOptions`], `align` is [`AlignOptions`].
    pub options: Value,
    pub staging: String,
    pub output_contract: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JobInput {
    pub file: String,
    pub content_hash: String,
    #[serde(default)]
    pub track: u32,
    #[serde(default)]
    pub range: Option<TickRange>,
}

/// A segment `[start, end)` on the source-material timeline, in ticks of `timescale`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TickRange {
    pub start: u64,
    pub end: u64,
    pub timescale: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TranscribeOptions {
    pub language: LanguageRequest,
    #[serde(default)]
    pub diarize: bool,
    #[serde(default)]
    pub hint: Option<String>,
    #[serde(default = "default_timescale")]
    pub timescale: u64,
}

/// Options for `capability: 'align'` (§2.5.1): known text plus an asserted language. The Worker itself tokenizes, aligns and segments.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AlignOptions {
    /// Only accepts an assertion (`mode: 'assert'`).
    pub language: LanguageRequest,
    pub text: String,
    #[serde(default = "default_timescale")]
    pub timescale: u64,
}

fn default_timescale() -> u64 {
    DEFAULT_TIMESCALE
}

/// Assert: specified by the user, and the model must not change it. Prefer: auto-detect, where `tag` is the result language only when detection fails.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase", deny_unknown_fields)]
pub enum LanguageRequest {
    Assert { tag: String },
    Prefer { tag: Option<String> },
}

// ---- Responses -----------------------------------------------------------------------------------

/// A backend in `worker.hello`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendStatus {
    pub id: &'static str,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub devices: Vec<String>,
}

/// Memory reported by the backend (bytes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemorySnapshot {
    pub active: u64,
    pub cache: u64,
    pub peak: u64,
}

/// A result file written to staging. `sha256` is lowercase hex, without the `sha256:` prefix.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputFile {
    pub path: String,
    pub sha256: String,
    pub byte_length: u64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStats {
    pub decode_ms: u64,
    pub vad_ms: u64,
    pub asr_ms: u64,
    pub align_ms: u64,
    pub speech_seconds: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobOutcome {
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRunResult {
    pub outcome: JobOutcome,
    pub output: Option<OutputFile>,
    pub segments_file: Option<String>,
    pub stats: JobStats,
}

// ---- Local speech synthesis (§2.5.2) ----------------------------------------------------------------

/// Output contract of synthesis: one PCM WAV in staging (mono or stereo; the sample rate is the model's native sample rate).
pub const SPEECH_OUTPUT_CONTRACT: &str = "cuccut.speech-wav/v1";
/// File name of the synthesis result in staging.
pub const SPEECH_OUTPUT_FILE: &str = "speech.wav";

/// The `capability` field of `job.run`: decides whether the parameters are parsed as [`JobRunParams`] or [`SynthesizeRunParams`].
pub fn run_capability(params: &Value) -> Option<&str> {
    params.get("capability").and_then(Value::as_str)
}

/// Parameters of `job.run` (`capability: "synthesize"`). `input` is given only for `clone` (the reference recording, whole, track 0).
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SynthesizeRunParams {
    pub job_id: String,
    pub run_generation: u64,
    pub capability: Capability,
    #[serde(default)]
    pub input: Option<SpeechReference>,
    pub options: SynthesizeOptions,
    pub staging: String,
    pub output_contract: String,
}

/// The reference recording for cloning: a field with the same name as in [`JobInput`], which does not accept `range` (the reference recording is used whole).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpeechReference {
    pub file: String,
    pub content_hash: String,
    #[serde(default)]
    pub track: u32,
}

/// Frozen synthesis parameters. The text is passed in as is; pronunciation annotations are converted by the engine into its own notation. Knobs that are `null` use the model's default values.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SynthesizeOptions {
    pub text: String,
    /// BCP 47; when `null`, the engine determines it from the text.
    #[serde(default)]
    pub language: Option<String>,
    pub voice: SynthesizeVoice,
    #[serde(default)]
    pub instructions: Option<String>,
    #[serde(default)]
    pub speed: Option<f64>,
    #[serde(default)]
    pub cfg: Option<f64>,
    #[serde(default)]
    pub steps: Option<u32>,
    #[serde(default)]
    pub seed: Option<u64>,
}

/// Voice: `preset` is the model's speaker; `clone` uses the reference recording in `input` (`transcript` is its original text); `describe` is a one-sentence description.
/// If the model cannot do it, it reports an error rather than substituting another voice.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(tag = "mode", rename_all = "lowercase", deny_unknown_fields)]
pub enum SynthesizeVoice {
    Preset { id: String },
    Clone { transcript: Option<String> },
    Describe { description: String },
}

impl SynthesizeRunParams {
    /// Checks beyond shape (all `INVALID_PARAMS`): capability and contract, absolute paths, non-empty text, and a reference recording only together with `clone`.
    pub fn validate(&self) -> Result<(), ErrorBody> {
        if self.capability != Capability::Synthesize {
            return Err(ErrorBody::invalid_params("capability must be synthesize"));
        }
        if self.output_contract != SPEECH_OUTPUT_CONTRACT {
            return Err(ErrorBody::invalid_params(format!(
                "outputContract must be {SPEECH_OUTPUT_CONTRACT}"
            )));
        }
        if !std::path::Path::new(&self.staging).is_absolute() {
            return Err(ErrorBody::invalid_params("staging must be an absolute path"));
        }
        if self.options.text.trim().is_empty() {
            return Err(ErrorBody::invalid_params("options.text must not be empty"));
        }
        match (&self.options.voice, &self.input) {
            (SynthesizeVoice::Clone { .. }, None) => Err(ErrorBody::invalid_params("voice mode clone needs input (the reference audio)")),
            (SynthesizeVoice::Clone { .. }, Some(input)) if !std::path::Path::new(&input.file).is_absolute() => {
                Err(ErrorBody::invalid_params("input.file must be an absolute path"))
            }
            (SynthesizeVoice::Preset { .. } | SynthesizeVoice::Describe { .. }, Some(_)) => {
                Err(ErrorBody::invalid_params("input is only for voice mode clone"))
            }
            _ => Ok(()),
        }
    }
}

/// Facts about the synthesized audio.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthesizedAudio {
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_sec: f64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthesizeStats {
    pub reference_ms: u64,
    pub synthesis_ms: u64,
    pub encode_ms: u64,
}

/// Result of `job.run` (`synthesize`): `output` is [`SPEECH_OUTPUT_FILE`] in staging.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthesizeRunResult {
    pub outcome: JobOutcome,
    pub output: Option<OutputFile>,
    pub audio: Option<SynthesizedAudio>,
    pub stats: SynthesizeStats,
    /// Text that could not be spoken with its pronunciation annotation (the engine does not recognize the pronunciation, the annotation is malformed, etc.). Offsets fall on the text after annotations are stripped.
    /// This is a warning, not a failure: the audio is still produced, and the Runtime passes it on to the caller faithfully rather than silently dropping it. Empty when cancelled.
    #[serde(default)]
    pub readings_dropped: Vec<Reading>,
}

// ---- Vocal and accompaniment separation (§2.5.4) -----------------------------------------------------

/// Output contract of separation: in staging, a vocal and a background 16-bit PCM stereo WAV. The sample rate is the requested `sampleRate`, and the length is the same as the input.
pub const STEMS_OUTPUT_CONTRACT: &str = "cuccut.stems-wav/v1";
/// File name of the vocals in staging.
pub const VOCALS_OUTPUT_FILE: &str = "vocals.wav";
/// File name of the background (drums, bass and the others, summed) in staging.
pub const BACKGROUND_OUTPUT_FILE: &str = "background.wav";
/// Lower and upper bounds of `options.sampleRate` (Hz).
pub const SEPARATE_MIN_SAMPLE_RATE: u32 = 8_000;
pub const SEPARATE_MAX_SAMPLE_RATE: u32 = 192_000;

/// Parameters of `job.run` (`capability: "separate"`): the whole input (does not accept `range`).
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeparateRunParams {
    pub job_id: String,
    pub run_generation: u64,
    pub capability: Capability,
    pub input: SeparateInput,
    pub options: SeparateOptions,
    pub staging: String,
    pub output_contract: String,
}

/// Input of separation: a field with the same name as in [`JobInput`], which does not accept `range`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeparateInput {
    pub file: String,
    pub content_hash: String,
    #[serde(default)]
    pub track: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeparateOptions {
    /// Output sample rate. When `null`, the model's working sample rate is used (44.1 kHz for HTDemucs). The Runtime passes the input track's sample rate so that both outputs match the input sample rate
    /// (the output convention in architecture design §6.1).
    #[serde(default)]
    pub sample_rate: Option<u32>,
}

impl SeparateRunParams {
    /// Checks beyond shape (all `INVALID_PARAMS`): capability and contract, absolute paths, sample-rate range.
    pub fn validate(&self) -> Result<(), ErrorBody> {
        if self.capability != Capability::Separate {
            return Err(ErrorBody::invalid_params("capability must be separate"));
        }
        if self.output_contract != STEMS_OUTPUT_CONTRACT {
            return Err(ErrorBody::invalid_params(format!("outputContract must be {STEMS_OUTPUT_CONTRACT}")));
        }
        if !std::path::Path::new(&self.staging).is_absolute() {
            return Err(ErrorBody::invalid_params("staging must be an absolute path"));
        }
        if !std::path::Path::new(&self.input.file).is_absolute() {
            return Err(ErrorBody::invalid_params("input.file must be an absolute path"));
        }
        if let Some(rate) = self.options.sample_rate
            && !(SEPARATE_MIN_SAMPLE_RATE..=SEPARATE_MAX_SAMPLE_RATE).contains(&rate)
        {
            return Err(ErrorBody::invalid_params(format!(
                "options.sampleRate must be within {SEPARATE_MIN_SAMPLE_RATE}..={SEPARATE_MAX_SAMPLE_RATE}"
            )));
        }
        Ok(())
    }
}

/// Files for the two outputs.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeparatedFiles {
    pub vocals: OutputFile,
    pub background: OutputFile,
}

/// Audio facts common to both outputs.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeparatedAudio {
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_sec: f64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeparateStats {
    pub decode_ms: u64,
    pub separation_ms: u64,
    pub encode_ms: u64,
}

/// Result of `job.run` (`separate`): `stems` are [`VOCALS_OUTPUT_FILE`] and [`BACKGROUND_OUTPUT_FILE`] in staging; `null` when cancelled.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeparateRunResult {
    pub outcome: JobOutcome,
    pub stems: Option<SeparatedFiles>,
    pub audio: Option<SeparatedAudio>,
    pub stats: SeparateStats,
}

// ---- Speaker diarization of existing transcripts (§2.5.5) --------------------------------------------

/// Output contract of diarization: [`SPEAKERS_OUTPUT_FILE`] in staging (JSON); the shape is in protocol specification §2.5.5.
pub const SPEAKERS_OUTPUT_CONTRACT: &str = "cuccut.speakers/v1";
/// File name of the diarization result in staging.
pub const SPEAKERS_OUTPUT_FILE: &str = "speakers.json";
/// Upper limit on `options.words` (the number of words in a transcript is far below it).
pub const DIARIZE_MAX_WORDS: usize = 2_000_000;

/// Parameters of `job.run` (`capability: "diarize"`): one piece of source audio and the words that fall within it (ticks on the source timeline).
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiarizeRunParams {
    pub job_id: String,
    pub run_generation: u64,
    pub capability: Capability,
    pub input: DiarizeInput,
    pub options: DiarizeOptions,
    pub staging: String,
    pub output_contract: String,
}

/// Input of diarization: a field with the same name as in [`JobInput`]. `range` is the segment to decode (the whole track when not given).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiarizeInput {
    pub file: String,
    pub content_hash: String,
    #[serde(default)]
    pub track: u32,
    #[serde(default)]
    pub range: Option<DiarizeRange>,
}

/// Same shape as [`TickRange`] (serializable).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiarizeRange {
    pub start: u64,
    pub end: u64,
    pub timescale: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiarizeOptions {
    /// The tick scale of `words` and of the times in the result.
    #[serde(default = "default_timescale")]
    pub timescale: u64,
    /// Transcript words: `[start, end]`, ticks on the source timeline, in transcript order. The result's `words` correspond to them one to one.
    pub words: Vec<[u64; 2]>,
}

impl DiarizeRunParams {
    /// Checks beyond shape (all `INVALID_PARAMS`): capability and contract, absolute paths, tick scale, range, and word start/end.
    pub fn validate(&self) -> Result<(), ErrorBody> {
        if self.capability != Capability::Diarize {
            return Err(ErrorBody::invalid_params("capability must be diarize"));
        }
        if self.output_contract != SPEAKERS_OUTPUT_CONTRACT {
            return Err(ErrorBody::invalid_params(format!(
                "outputContract must be {SPEAKERS_OUTPUT_CONTRACT}"
            )));
        }
        if !std::path::Path::new(&self.staging).is_absolute() {
            return Err(ErrorBody::invalid_params("staging must be an absolute path"));
        }
        if !std::path::Path::new(&self.input.file).is_absolute() {
            return Err(ErrorBody::invalid_params("input.file must be an absolute path"));
        }
        if self.options.timescale == 0 {
            return Err(ErrorBody::invalid_params("options.timescale must be positive"));
        }
        if let Some(range) = self.input.range
            && (range.timescale == 0 || range.end <= range.start)
        {
            return Err(ErrorBody::invalid_params(
                "input.range must have a positive timescale and end > start",
            ));
        }
        if self.options.words.len() > DIARIZE_MAX_WORDS {
            return Err(ErrorBody::invalid_params(format!(
                "options.words must have at most {DIARIZE_MAX_WORDS} entries"
            )));
        }
        if let Some(index) = self.options.words.iter().position(|[start, end]| end < start) {
            return Err(ErrorBody::invalid_params(format!("options.words[{index}] ends before it starts")));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiarizeStats {
    pub decode_ms: u64,
    pub diarize_ms: u64,
}

/// Result of `job.run` (`diarize`): `output` is [`SPEAKERS_OUTPUT_FILE`] in staging; `null` when cancelled.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiarizeRunResult {
    pub outcome: JobOutcome,
    pub output: Option<OutputFile>,
    /// Number of speakers identified (0 when cancelled).
    pub speakers: usize,
    pub stats: DiarizeStats,
}

/// The answer of `model.load` when this build has no engine for a given speech-synthesis model family: `MODEL_UNSUPPORTED`, with `details.reason` set to `not-wired`.
pub fn synthesis_not_wired(family: Option<&str>) -> ErrorBody {
    let mut details = json!({ "capability": "synthesize", "reason": "not-wired" });
    if let Some(family) = family {
        details["family"] = json!(family);
    }
    ErrorBody::new(
        codes::MODEL_UNSUPPORTED,
        "local speech synthesis is not available in this worker yet",
    )
    .with_details(details)
}

/// The answer of `model.load` when this build has no separation backend: `MODEL_UNSUPPORTED`, with `details.reason` set to `not-wired`. The Runtime would not send this in the first place, based on `separateFamilies` in `worker.hello`.
pub fn separation_not_wired(family: Option<&str>) -> ErrorBody {
    let mut details = json!({ "capability": "separate", "reason": "not-wired" });
    if let Some(family) = family {
        details["family"] = json!(family);
    }
    ErrorBody::new(codes::MODEL_UNSUPPORTED, "local audio separation is not available in this worker").with_details(details)
}

/// The answer of `model.load` when this build has no loader for a given transcription main model family: `MODEL_UNSUPPORTED`, with `details.reason` set to
/// `not-wired`. The Runtime would not send this in the first place, based on `transcribeFamilies` in `worker.hello`.
pub fn transcription_not_wired(family: Option<&str>) -> ErrorBody {
    let mut details = json!({ "capability": "transcribe", "reason": "not-wired" });
    if let Some(family) = family {
        details["family"] = json!(family);
    }
    ErrorBody::new(
        codes::MODEL_UNSUPPORTED,
        "this speech recognition model is not available in this worker yet",
    )
    .with_details(details)
}

// ---- Local text-to-image (§2.5.3) ---------------------------------------------------------------------

/// Output contract of text-to-image: one 8-bit RGBA PNG in staging, whose width and height are the requested ones.
pub const IMAGE_OUTPUT_CONTRACT: &str = "cuccut.image-png/v1";
/// File name of the text-to-image result in staging.
pub const IMAGE_OUTPUT_FILE: &str = "image.png";

/// Parameters of `job.run` (`capability: "image"`). There is no input file: the prompt is the entire input.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImageRunParams {
    pub job_id: String,
    pub run_generation: u64,
    pub capability: Capability,
    pub options: ImageOptions,
    pub staging: String,
    pub output_contract: String,
}

/// Frozen text-to-image parameters. `seed` is fixed by the Runtime at submission (a random one is drawn if the request does not give one), so rerunning produces the same image.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImageOptions {
    pub prompt: String,
    pub width: u32,
    pub height: u32,
    /// Number of denoising steps; `null` uses the model's default.
    #[serde(default)]
    pub steps: Option<u32>,
    pub seed: u64,
}

impl ImageRunParams {
    /// Checks beyond shape (all `INVALID_PARAMS`): capability and contract, absolute paths, non-empty prompt, positive width/height and steps. The model's own size rules
    /// (Qwen-Image requires multiples of 32) are checked by the engine before it starts.
    pub fn validate(&self) -> Result<(), ErrorBody> {
        if self.capability != Capability::Image {
            return Err(ErrorBody::invalid_params("capability must be image"));
        }
        if self.output_contract != IMAGE_OUTPUT_CONTRACT {
            return Err(ErrorBody::invalid_params(format!("outputContract must be {IMAGE_OUTPUT_CONTRACT}")));
        }
        if !std::path::Path::new(&self.staging).is_absolute() {
            return Err(ErrorBody::invalid_params("staging must be an absolute path"));
        }
        if self.options.prompt.trim().is_empty() {
            return Err(ErrorBody::invalid_params("options.prompt must not be empty"));
        }
        if self.options.width == 0 || self.options.height == 0 {
            return Err(ErrorBody::invalid_params("options.width and options.height must be positive"));
        }
        if self.options.steps == Some(0) {
            return Err(ErrorBody::invalid_params("options.steps must be positive"));
        }
        Ok(())
    }
}

/// Facts about the generated image.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedImage {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub seed: u64,
    pub steps: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageStats {
    pub generation_ms: u64,
    pub encode_ms: u64,
}

/// Result of `job.run` (`image`): `output` is [`IMAGE_OUTPUT_FILE`] in staging.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRunResult {
    pub outcome: JobOutcome,
    pub output: Option<OutputFile>,
    pub image: Option<GeneratedImage>,
    pub stats: ImageStats,
}

/// The answer of `model.load` when this build has no speaker diarization: `MODEL_UNSUPPORTED`, with `details.reason` set to `not-wired`. The Runtime would not send this in the first place,
/// based on `capabilities` in `worker.hello`.
pub fn diarization_not_wired() -> ErrorBody {
    ErrorBody::new(
        codes::MODEL_UNSUPPORTED,
        "local speaker diarization is not available in this worker",
    )
    .with_details(json!({ "capability": "diarize", "reason": "not-wired" }))
}

/// The answer of `model.load` when this build has no engine for a given text-to-image model family: `MODEL_UNSUPPORTED`, with `details.reason` set to `not-wired`.
pub fn image_not_wired(family: Option<&str>) -> ErrorBody {
    let mut details = json!({ "capability": "image", "reason": "not-wired" });
    if let Some(family) = family {
        details["family"] = json!(family);
    }
    ErrorBody::new(codes::MODEL_UNSUPPORTED, "local image generation is not available in this worker").with_details(details)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One request, identical word for word to the TS-side `SynthesizeRunParams` (packages/models/src/worker-contract.ts).
    fn synthesize_params(voice: Value, input: Value) -> Value {
        json!({
            "jobId": "job_1",
            "runGeneration": 2,
            "capability": "synthesize",
            "input": input,
            "options": {
                "text": "你好，世界。",
                "language": "zh-CN",
                "voice": voice,
                "instructions": null,
                "speed": 1.1,
                "cfg": null,
                "steps": 10,
                "seed": 7,
            },
            "staging": "/tmp/staging",
            "outputContract": SPEECH_OUTPUT_CONTRACT,
        })
    }

    #[test]
    fn synthesize_params_round_trip_every_voice_mode() {
        let reference = json!({ "file": "/tmp/ref.wav", "contentHash": "sha256:ab", "track": 0 });
        for (voice, input) in [
            (json!({ "mode": "preset", "id": "Vivian" }), Value::Null),
            (json!({ "mode": "clone", "transcript": "参考录音的原文" }), reference.clone()),
            (json!({ "mode": "clone", "transcript": null }), reference.clone()),
            (json!({ "mode": "describe", "description": "female, low pitch" }), Value::Null),
        ] {
            let value = synthesize_params(voice, input);
            assert_eq!(run_capability(&value), Some("synthesize"));
            let parsed: SynthesizeRunParams = serde_json::from_value(value.clone()).unwrap();
            parsed.validate().unwrap();
            assert_eq!(serde_json::to_value(&parsed).unwrap(), value, "serializes back to the same JSON");
        }
        // Optional fields (input and knobs) default to null.
        let minimal: SynthesizeRunParams = serde_json::from_value(json!({
            "jobId": "j", "runGeneration": 1, "capability": "synthesize",
            "options": { "text": "hi", "voice": { "mode": "preset", "id": "a" } },
            "staging": "/s", "outputContract": SPEECH_OUTPUT_CONTRACT,
        }))
        .unwrap();
        assert_eq!(minimal.input, None);
        assert_eq!(minimal.options.steps, None);
    }

    #[test]
    fn synthesize_params_reject_bad_shapes() {
        let preset = json!({ "mode": "preset", "id": "a" });
        let clone = json!({ "mode": "clone", "transcript": null });
        let mut extra = synthesize_params(preset.clone(), Value::Null);
        extra["options"]["emotion"] = json!("happy");
        assert!(serde_json::from_value::<SynthesizeRunParams>(extra).is_err(), "unknown option");
        let custom = synthesize_params(json!({ "mode": "custom", "id": "a" }), Value::Null);
        assert!(serde_json::from_value::<SynthesizeRunParams>(custom).is_err(), "unknown voice mode");
        let ranged = json!({ "file": "/r.wav", "contentHash": "sha256:ab", "track": 0, "range": { "start": 0, "end": 1, "timescale": 1 } });
        assert!(
            serde_json::from_value::<SynthesizeRunParams>(synthesize_params(clone.clone(), ranged)).is_err(),
            "no range"
        );

        let invalid = |value: Value| {
            serde_json::from_value::<SynthesizeRunParams>(value)
                .unwrap()
                .validate()
                .unwrap_err()
                .code
        };
        assert_eq!(invalid(synthesize_params(clone.clone(), Value::Null)), codes::INVALID_PARAMS);
        let reference = json!({ "file": "/r.wav", "contentHash": "sha256:ab", "track": 0 });
        assert_eq!(invalid(synthesize_params(preset.clone(), reference)), codes::INVALID_PARAMS);
        let relative = json!({ "file": "r.wav", "contentHash": "sha256:ab", "track": 0 });
        assert_eq!(invalid(synthesize_params(clone, relative)), codes::INVALID_PARAMS);
        let mut contract = synthesize_params(preset.clone(), Value::Null);
        contract["outputContract"] = json!(OUTPUT_CONTRACT);
        assert_eq!(invalid(contract), codes::INVALID_PARAMS);
        let mut empty = synthesize_params(preset.clone(), Value::Null);
        empty["options"]["text"] = json!("  ");
        assert_eq!(invalid(empty), codes::INVALID_PARAMS);
        let mut transcribe = synthesize_params(preset, Value::Null);
        transcribe["capability"] = json!("transcribe");
        assert_eq!(invalid(transcribe), codes::INVALID_PARAMS);
    }

    #[test]
    fn synthesize_result_round_trips() {
        let value = json!({
            "outcome": "completed",
            "output": { "path": SPEECH_OUTPUT_FILE, "sha256": "ab".repeat(32), "byteLength": 48_044 },
            "audio": { "sampleRate": 24_000, "channels": 1, "durationSec": 1.0 },
            "stats": { "referenceMs": 12, "synthesisMs": 900, "encodeMs": 3 },
            "readingsDropped": [{ "start": 2, "end": 3, "reading": "xing2", "origin": "user" }],
        });
        let parsed: SynthesizeRunResult = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(parsed.outcome, JobOutcome::Completed);
        assert_eq!(serde_json::to_value(&parsed).unwrap(), value);
        let cancelled = json!({
            "outcome": "cancelled", "output": null, "audio": null,
            "stats": { "referenceMs": 0, "synthesisMs": 0, "encodeMs": 0 },
            "readingsDropped": [],
        });
        let parsed: SynthesizeRunResult = serde_json::from_value(cancelled.clone()).unwrap();
        assert_eq!(serde_json::to_value(&parsed).unwrap(), cancelled);
    }

    #[test]
    fn not_wired_is_a_structured_unsupported_error() {
        let error = synthesis_not_wired(Some("qwen3-tts"));
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert!(!error.retryable);
        assert_eq!(
            error.details.unwrap(),
            json!({ "capability": "synthesize", "reason": "not-wired", "family": "qwen3-tts" })
        );
        assert_eq!(
            serde_json::from_value::<Capability>(json!("synthesize")).unwrap(),
            Capability::Synthesize
        );
        let error = transcription_not_wired(Some("moss-transcribe-diarize"));
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert_eq!(
            error.details.unwrap(),
            json!({ "capability": "transcribe", "reason": "not-wired", "family": "moss-transcribe-diarize" })
        );
    }

    #[test]
    fn language_request_is_tagged_and_closed() {
        let assert: LanguageRequest = serde_json::from_value(json!({"mode": "assert", "tag": "en"})).unwrap();
        assert_eq!(assert, LanguageRequest::Assert { tag: "en".into() });
        let prefer: LanguageRequest = serde_json::from_value(json!({"mode": "prefer", "tag": null})).unwrap();
        assert_eq!(prefer, LanguageRequest::Prefer { tag: None });
        assert!(serde_json::from_value::<LanguageRequest>(json!({"mode": "prefer", "tag": null, "x": 1})).is_err());
        assert!(serde_json::from_value::<LanguageRequest>(json!({"mode": "assert"})).is_err());
        assert!(serde_json::from_value::<LanguageRequest>(json!({"mode": "auto"})).is_err());
    }

    #[test]
    fn transcribe_options_default_timescale_and_reject_unknown_fields() {
        let options: TranscribeOptions =
            serde_json::from_value(json!({"language": {"mode": "prefer", "tag": null}, "diarize": false})).unwrap();
        assert_eq!(options.timescale, DEFAULT_TIMESCALE);
        assert!(
            serde_json::from_value::<TranscribeOptions>(json!({"language": {"mode": "prefer", "tag": null}, "diarize": false, "x": 1}))
                .is_err()
        );
    }

    /// One request, identical word for word to the TS-side `SeparateRunParams` (packages/models/src/worker-contract.ts).
    fn separate_params() -> Value {
        json!({
            "jobId": "job_s",
            "runGeneration": 1,
            "capability": "separate",
            "input": { "file": "/media/a.mp4", "contentHash": "sha256:ab", "track": 0 },
            "options": { "sampleRate": 48_000 },
            "staging": "/tmp/staging",
            "outputContract": STEMS_OUTPUT_CONTRACT,
        })
    }

    #[test]
    fn separate_params_round_trip_and_reject_bad_shapes() {
        let value = separate_params();
        assert_eq!(run_capability(&value), Some("separate"));
        let parsed: SeparateRunParams = serde_json::from_value(value.clone()).unwrap();
        parsed.validate().unwrap();
        assert_eq!(serde_json::to_value(&parsed).unwrap(), value);

        let mut defaulted = separate_params();
        defaulted["options"] = json!({});
        let parsed: SeparateRunParams = serde_json::from_value(defaulted).unwrap();
        assert_eq!(parsed.options.sample_rate, None);

        let mut ranged = separate_params();
        ranged["input"]["range"] = json!({ "start": 0, "end": 1, "timescale": 1 });
        assert!(serde_json::from_value::<SeparateRunParams>(ranged).is_err(), "no range");
        let mut extra = separate_params();
        extra["options"]["stems"] = json!(["drums"]);
        assert!(serde_json::from_value::<SeparateRunParams>(extra).is_err(), "unknown option");

        let invalid = |edit: &dyn Fn(&mut Value)| {
            let mut value = separate_params();
            edit(&mut value);
            serde_json::from_value::<SeparateRunParams>(value)
                .unwrap()
                .validate()
                .unwrap_err()
                .code
        };
        assert_eq!(invalid(&|v| v["capability"] = json!("synthesize")), codes::INVALID_PARAMS);
        assert_eq!(
            invalid(&|v| v["outputContract"] = json!(SPEECH_OUTPUT_CONTRACT)),
            codes::INVALID_PARAMS
        );
        assert_eq!(invalid(&|v| v["staging"] = json!("relative")), codes::INVALID_PARAMS);
        assert_eq!(invalid(&|v| v["input"]["file"] = json!("a.mp4")), codes::INVALID_PARAMS);
        assert_eq!(invalid(&|v| v["options"]["sampleRate"] = json!(4_000)), codes::INVALID_PARAMS);
    }

    #[test]
    fn retryable_follows_the_code_table() {
        assert!(ErrorBody::new(codes::DECODE_FAILED, "x").retryable);
        assert!(ErrorBody::new(codes::WORKER_PANIC, "x").retryable);
        assert!(!ErrorBody::new(codes::MODEL_NOT_INSTALLED, "x").retryable);
        assert!(!ErrorBody::new(codes::INVALID_PARAMS, "x").retryable);
    }

    /// One request, identical word for word to the TS-side `ImageRunParams` (packages/models/src/worker-contract.ts).
    #[test]
    fn image_params_round_trip_and_validate() {
        let value = json!({
            "jobId": "job_1",
            "runGeneration": 2,
            "capability": "image",
            "options": { "prompt": "a red apple", "width": 1024, "height": 576, "steps": null, "seed": 4_294_967_295u64 },
            "staging": "/tmp/staging",
            "outputContract": IMAGE_OUTPUT_CONTRACT,
        });
        assert_eq!(run_capability(&value), Some("image"));
        let parsed: ImageRunParams = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(parsed.capability, Capability::Image);
        assert_eq!(
            (parsed.options.width, parsed.options.height, parsed.options.steps),
            (1024, 576, None)
        );
        assert_eq!(parsed.options.seed, 4_294_967_295);
        parsed.validate().unwrap();
        assert_eq!(serde_json::to_value(&parsed).unwrap(), value);

        let invalid = |edit: &dyn Fn(&mut ImageRunParams)| {
            let mut params = parsed.clone();
            edit(&mut params);
            params.validate().unwrap_err().code
        };
        assert_eq!(invalid(&|p| p.options.prompt = "  ".into()), codes::INVALID_PARAMS);
        assert_eq!(invalid(&|p| p.options.width = 0), codes::INVALID_PARAMS);
        assert_eq!(invalid(&|p| p.options.steps = Some(0)), codes::INVALID_PARAMS);
        assert_eq!(invalid(&|p| p.staging = "relative".into()), codes::INVALID_PARAMS);
        assert_eq!(
            invalid(&|p| p.output_contract = SPEECH_OUTPUT_CONTRACT.into()),
            codes::INVALID_PARAMS
        );
        assert_eq!(invalid(&|p| p.capability = Capability::Synthesize), codes::INVALID_PARAMS);

        // No seed, and extra fields: shape error.
        let mut missing_seed = value.clone();
        missing_seed["options"].as_object_mut().unwrap().remove("seed");
        assert!(serde_json::from_value::<ImageRunParams>(missing_seed).is_err());
        let mut extra = value;
        extra["options"]["negativePrompt"] = json!("blurry");
        assert!(serde_json::from_value::<ImageRunParams>(extra).is_err());
    }
}
