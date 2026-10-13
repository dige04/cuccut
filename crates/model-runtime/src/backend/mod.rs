//! Inference backends: device context and model loaders.
//!
//! Each backend is a [`Backend`]: it reports whether it is available on this machine, and loads a validated model bundle into a [`Loaded`] (a recognition [`LoadedModel`], a synthesis [`LoadedSynthesis`], or a text-to-image [`LoadedImage`]). A loaded model holds device handles (MLX arrays are not `Send`), so it can only be used on the thread that created it.
//!
//! - `mlx`: Apple Silicon + Metal. Compiled in when the `backend-mlx` feature is on and the target is macOS aarch64; otherwise reports `not-compiled`.
//! - `coreml`: CoreML on Apple Silicon (Whisper's `.mlmodelc` bundle; VAD still runs on MLX). Compiled in when the `backend-coreml` feature (which also enables `backend-mlx`) is on and the target is macOS aarch64; otherwise reports `not-compiled`.
//! - `candle`: all-platform backend (CPU, plus NVIDIA CUDA with the `cuda` feature); loads the same Qwen3-ASR, MOSS, aligner and WeSpeaker weights as MLX. Compiled in with the `backend-candle` feature; otherwise reports `not-compiled`.
//! - `ggml`: all-platform Whisper (whisper.cpp single-file GGML weights; CPU; `whisper-ggml-cuda` adds NVIDIA CUDA and `whisper-ggml-vulkan` adds Vulkan GPU; when both are compiled in, CUDA takes priority). VAD and the optional aligner borrow candle's. Compiled in with the `whisper-ggml` feature (which also enables `backend-candle`); otherwise reports `not-compiled`.
//!
//! The loader for a recognition bundle is picked by the family of its `asr` component, and each family has its own required components ([`load`]). Which families this build can load is reported to `worker.hello` by [`transcribe_families`]. A bundle with an `image` component is a text-to-image model bundle ([`crate::image`]).

use serde_json::json;

use crate::bundle::{
    FAMILY_HTDEMUCS_FT, FAMILY_INDEX_TTS2_AUX, FAMILY_MOSS_TRANSCRIBE_DIARIZE, FAMILY_PYANNOTE_SEGMENTATION, FAMILY_QWEN3_ALIGNER,
    FAMILY_QWEN3_ASR, FAMILY_QWEN3_TTS_CODEC, FAMILY_SILERO_VAD, FAMILY_WESPEAKER, FAMILY_WHISPER_COREML, FAMILY_WHISPER_GGML,
    FAMILY_WHISPER_MLX, FAMILY_WHISPER_TOKENIZER, VerifiedBundle, VerifiedFiles,
};
use crate::image::{self, ImageEngine};
use crate::protocol::{
    BackendStatus, ErrorBody, MemorySnapshot, codes, diarization_not_wired, image_not_wired, separation_not_wired, synthesis_not_wired,
    transcription_not_wired,
};
use crate::separate::{self, Separator};
use crate::speech::{ForcedAlignment, SegmentingRecognizer, SpeakerDiarization, SpeakerEmbedding, SpeechRecognizer, StreamingVad};
use crate::synthesize::{self, TtsEngine, TtsEngineKind};

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
pub mod mlx;

#[cfg(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64"))]
pub mod coreml;

#[cfg(feature = "backend-candle")]
pub mod candle;

#[cfg(feature = "whisper-ggml")]
pub mod ggml;

/// Reasons a backend is unavailable.
pub const REASON_NOT_COMPILED: &str = "not-compiled";
pub const REASON_NO_METAL_DEVICE: &str = "no-metal-device";

/// Stages of the `model.phase` event.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelPhase {
    LoadingWeights,
    Compiling,
    WarmingUp,
}

impl ModelPhase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::LoadingWeights => "loading-weights",
            Self::Compiling => "compiling",
            Self::WarmingUp => "warming-up",
        }
    }
}

/// Load-stage callback: the stage and an optional description (component name).
pub type PhaseCallback<'a> = dyn FnMut(ModelPhase, Option<&str>) + 'a;

/// How a transcription model runs.
pub enum RunMode<'a> {
    /// VAD segmentation and segment-by-segment recognition (Qwen3-ASR, Whisper). Both are borrowed together, since the pipeline uses them alternately.
    Pipeline {
        vad: &'a mut dyn StreamingVad,
        recognizer: &'a mut dyn SpeechRecognizer,
    },
    /// The model segments the audio itself, and the whole audio is handed to it once (MOSS-Transcribe-Diarize).
    SelfSegmenting(&'a mut dyn SegmentingRecognizer),
}

/// A loaded transcription model. It can only be used on the thread that loaded it.
pub trait LoadedModel {
    /// Borrows this model's run mode; a model is always of one kind.
    fn run_mode(&mut self) -> RunMode<'_>;

    /// Memory snapshot, when the backend can report one.
    fn memory(&self) -> Option<MemorySnapshot>;

    /// Warm-up time in milliseconds.
    fn warmup_ms(&self) -> u64;

    /// Resident bytes; `None` when the backend cannot report them.
    fn resident_bytes(&self) -> Option<u64>;

    /// The loaded forced aligner (present when the model bundle includes the optional `aligner` component). Step 5 of recognition uses it to assign timing to word pairs; the `align` capability depends only on it.
    /// Self-segmenting models (MOSS) load it on first call; it is `None` if loading fails.
    fn aligner(&mut self) -> Option<&mut dyn ForcedAlignment> {
        None
    }

    /// The bundle includes an aligner: the `align` capability and the result's `provenance.models.aligner` are determined from this. Models that load the aligner on demand do not need to load it first for this check.
    fn has_aligner(&mut self) -> bool {
        self.aligner().is_some()
    }

    /// Speaker embedding model (`speaker` component). Self-segmenting models (MOSS) use it to merge speakers across chunks; it is loaded on first call and is `None` if loading fails. Qwen3-ASR and Whisper do not go through here: their `speaker` component is loaded together with speaker diarization ([`Self::diarizer`]).
    fn speaker_embedder(&mut self) -> Option<&mut dyn SpeakerEmbedding> {
        None
    }

    /// The bundle includes speaker diarization (`segmentation` component, architecture design §6.6): `diarize` is determined from this without loading it first.
    fn has_diarizer(&self) -> bool {
        false
    }

    /// Speaker diarization (Pyannote segmentation + WeSpeaker speaker-embedding clustering), for models that do not diarize speakers themselves (Qwen3-ASR, Whisper). Loaded on first call after recognition finishes (same as v2: recognition models are not unloaded); `None` if loading fails; released at the end of the job ([`Self::finish_job`]).
    fn diarizer(&mut self) -> Option<&mut dyn SpeakerDiarization> {
        None
    }

    /// Called when a `job.run` ends (success, failure or cancel): on-demand auxiliary models (MOSS's aligner and speaker model, and speaker diarization) are released here.
    fn finish_job(&mut self) {}
}

/// A loaded synthesis model: one TTS engine. Like [`LoadedModel`], it can only be used on the thread that loaded it.
pub struct LoadedSynthesis {
    pub kind: TtsEngineKind,
    pub engine: Box<dyn TtsEngine>,
    /// Load time in milliseconds. Synthesis has no separate warm-up, so `warmupMs` in `model.load` reports this.
    pub load_ms: u64,
    /// Resident bytes after loading; `None` when the backend cannot report them.
    pub resident_bytes: Option<u64>,
    /// Memory snapshot from the backend (refreshes `worker.status` after a job).
    pub memory: fn() -> Option<MemorySnapshot>,
}

/// A loaded separation model (HTDemucs-FT). Like [`LoadedModel`], it can only be used on the thread that loaded it.
pub struct LoadedSeparation {
    pub separator: Box<dyn Separator>,
    /// Load time in milliseconds. Separation has no separate warm-up, so `warmupMs` in `model.load` reports this.
    pub load_ms: u64,
    /// Resident bytes after loading; `None` when the backend cannot report them.
    pub resident_bytes: Option<u64>,
    /// Memory snapshot from the backend (refreshes `worker.status` after a job).
    pub memory: fn() -> Option<MemorySnapshot>,
}

/// A loaded speaker diarization model. It is loaded separately from the "speaker diarization" bundle: Pyannote segmentation + WeSpeaker voiceprints, used to assign speakers to the words of an existing transcript (protocol spec §2.5.5). Like [`LoadedModel`], it can only be used on the thread that loaded it.
pub struct LoadedDiarization {
    pub diarizer: Box<dyn SpeakerDiarization>,
    /// Load time in milliseconds. Speaker diarization has no separate warm-up, so `warmupMs` in `model.load` reports this.
    pub load_ms: u64,
    /// Resident bytes after loading; `None` when the backend cannot report them.
    pub resident_bytes: Option<u64>,
    /// Memory snapshot from the backend (refreshes `worker.status` after a job).
    pub memory: fn() -> Option<MemorySnapshot>,
}

/// A loaded text-to-image model: one image engine. Like [`LoadedModel`], it can only be used on the thread that loaded it.
///
/// Loading only checks the manifest and reads the tokenizer and scheduler config. The three weight blocks are streamed in per stage during each generation and dropped after use, so resident memory after loading is small. The peak during generation is admitted by the Runtime based on the bundle's measured peak (model worker protocol spec §4.2).
pub struct LoadedImage {
    pub engine: Box<dyn ImageEngine>,
    /// Load time in milliseconds: `model.load` reports this as `warmupMs`.
    pub load_ms: u64,
    /// Resident bytes after loading; `None` when the backend cannot report them.
    pub resident_bytes: Option<u64>,
    /// Memory snapshot from the backend (refreshes `worker.status` after a job).
    pub memory: fn() -> Option<MemorySnapshot>,
}

/// What one model bundle loads into: recognition (VAD + ASR), synthesis (TTS engine), separation, text-to-image (image engine), or speaker diarization.
pub enum Loaded {
    Transcription(Box<dyn LoadedModel>),
    Synthesis(LoadedSynthesis),
    Separation(LoadedSeparation),
    Image(LoadedImage),
    Diarization(LoadedDiarization),
}

impl Loaded {
    pub fn memory(&self) -> Option<MemorySnapshot> {
        match self {
            Self::Transcription(model) => model.memory(),
            Self::Synthesis(synthesis) => (synthesis.memory)(),
            Self::Separation(separation) => (separation.memory)(),
            Self::Image(image) => (image.memory)(),
            Self::Diarization(diarization) => (diarization.memory)(),
        }
    }

    pub fn resident_bytes(&self) -> Option<u64> {
        match self {
            Self::Transcription(model) => model.resident_bytes(),
            Self::Synthesis(synthesis) => synthesis.resident_bytes,
            Self::Separation(separation) => separation.resident_bytes,
            Self::Image(image) => image.resident_bytes,
            Self::Diarization(diarization) => diarization.resident_bytes,
        }
    }

    pub fn warmup_ms(&self) -> u64 {
        match self {
            Self::Transcription(model) => model.warmup_ms(),
            Self::Synthesis(synthesis) => synthesis.load_ms,
            Self::Separation(separation) => separation.load_ms,
            Self::Image(image) => image.load_ms,
            Self::Diarization(diarization) => diarization.load_ms,
        }
    }
}

/// An inference backend.
pub trait Backend: Sync {
    fn id(&self) -> &'static str;

    /// Backend entry in `worker.hello`.
    fn status(&self) -> BackendStatus;

    /// Loads a model bundle. The component families and memory budget have already been checked by [`load`].
    fn load(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody>;

    /// Loads a synthesis model bundle (`kind` is determined by the family of the `tts` component). Components, family and budget have already been checked by [`load`].
    fn load_synthesis(
        &self,
        _bundle: &VerifiedBundle,
        _kind: TtsEngineKind,
        _phase: &mut PhaseCallback<'_>,
    ) -> Result<LoadedSynthesis, ErrorBody> {
        Err(not_compiled(self.id()))
    }

    /// Loads a separation model bundle (`separator` component). Components, family and budget have already been checked by [`load`].
    fn load_separation(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<LoadedSeparation, ErrorBody> {
        Err(not_compiled(self.id()))
    }

    /// Loads a speaker diarization model bundle (`segmentation` + `speaker`). Components, family and budget have already been checked by [`load`].
    fn load_diarization(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<LoadedDiarization, ErrorBody> {
        Err(not_compiled(self.id()))
    }

    /// Loads a text-to-image model bundle. Components and family have already been checked by [`load`].
    fn load_image(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<LoadedImage, ErrorBody> {
        Err(not_compiled(self.id()))
    }
}

/// All backends this build knows about.
pub fn all() -> [&'static dyn Backend; 4] {
    [mlx_backend(), coreml_backend(), candle_backend(), ggml_backend()]
}

/// Recognition main-model families this build knows about (`components.asr.family`).
pub const TRANSCRIBE_FAMILIES: [&str; 5] = [
    FAMILY_QWEN3_ASR,
    FAMILY_WHISPER_MLX,
    FAMILY_WHISPER_COREML,
    FAMILY_WHISPER_GGML,
    FAMILY_MOSS_TRANSCRIBE_DIARIZE,
];

/// Whether this recognition main-model family can be loaded in this build. Families whose loader is not yet wired report `false`.
pub fn transcribe_family_available(family: &str) -> bool {
    match family {
        FAMILY_QWEN3_ASR | FAMILY_MOSS_TRANSCRIBE_DIARIZE => cfg!(any(
            all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"),
            feature = "backend-candle"
        )),
        FAMILY_WHISPER_MLX => cfg!(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")),
        FAMILY_WHISPER_COREML => cfg!(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64")),
        FAMILY_WHISPER_GGML => cfg!(feature = "whisper-ggml"),
        _ => false,
    }
}

/// Whether this build can load the forced aligner (`qwen3-forced-aligner`). `worker.hello` declares `align` based on this. Both MLX and candle have it.
pub fn aligner_available() -> bool {
    cfg!(any(
        all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"),
        feature = "backend-candle"
    ))
}

/// Whether this build can do speaker diarization (Pyannote segmentation + WeSpeaker). `worker.hello` declares `diarize` based on this. Both MLX and candle have it (CoreML's Whisper borrows MLX's, and GGML's Whisper borrows candle's); the model bundle must also include the `segmentation` component.
pub fn diarizer_available() -> bool {
    aligner_available()
}

/// The recognition main-model families this build can load, in the order of [`TRANSCRIBE_FAMILIES`]. This is `worker.hello`'s `transcribeFamilies`; the Runtime does not hand this Worker any family that is not listed (protocol spec §2.1).
pub fn transcribe_families() -> Vec<&'static str> {
    TRANSCRIBE_FAMILIES
        .into_iter()
        .filter(|family| transcribe_family_available(family))
        .collect()
}

/// A component's requirement in a recognition model bundle.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Need {
    /// Must be present, and must be this family.
    Required(&'static str),
    /// May be present; if present, must be this family.
    Optional(&'static str),
    /// Must not be present.
    Rejected,
}

/// Requirements each recognition main-model family places on the other components: `vad`, `tokenizer`, `aligner`, `speaker`, `segmentation`.
/// `segmentation` (which comes from the "speaker diarization" bundle together with `speaker`) is only for models that do not diarize speakers themselves; MOSS diarizes speakers itself and does not take it.
fn transcribe_needs(family: &str) -> Option<[(&'static str, Need); 5]> {
    let aligner = ("aligner", Need::Optional(FAMILY_QWEN3_ALIGNER));
    let speaker = ("speaker", Need::Optional(FAMILY_WESPEAKER));
    let segmentation = ("segmentation", Need::Optional(FAMILY_PYANNOTE_SEGMENTATION));
    match family {
        FAMILY_QWEN3_ASR => Some([
            ("vad", Need::Required(FAMILY_SILERO_VAD)),
            ("tokenizer", Need::Rejected),
            aligner,
            speaker,
            segmentation,
        ]),
        FAMILY_WHISPER_MLX | FAMILY_WHISPER_COREML => Some([
            ("vad", Need::Required(FAMILY_SILERO_VAD)),
            ("tokenizer", Need::Required(FAMILY_WHISPER_TOKENIZER)),
            aligner,
            speaker,
            segmentation,
        ]),
        // GGML weights carry their own vocabulary: a bundle with a tokenizer is a broken bundle.
        FAMILY_WHISPER_GGML => Some([
            ("vad", Need::Required(FAMILY_SILERO_VAD)),
            ("tokenizer", Need::Rejected),
            aligner,
            speaker,
            segmentation,
        ]),
        // MOSS segments and diarizes speakers by itself: a bundle with VAD or speaker segmentation is a broken bundle.
        FAMILY_MOSS_TRANSCRIBE_DIARIZE => Some([
            ("vad", Need::Rejected),
            ("tokenizer", Need::Rejected),
            aligner,
            speaker,
            ("segmentation", Need::Rejected),
        ]),
        _ => None,
    }
}

/// Finds a backend by id.
pub fn by_id(id: &str) -> Option<&'static dyn Backend> {
    all().into_iter().find(|backend| backend.id() == id)
}

/// `worker.hello`'s `backends`.
pub fn statuses() -> Vec<BackendStatus> {
    all().iter().map(|backend| backend.status()).collect()
}

/// Checks components and memory budget, then hands off to the matching backend's loader. A bundle with `separator` is a separation bundle; one with `image` is a text-to-image bundle; one with `tts` is a synthesis bundle, and its engine is loaded by its family; one with `segmentation` but no `asr` is a speaker diarization bundle; anything else is recognition.
///
/// Text-to-image does not check the total `memoryBudgetBytes`: the three weight blocks are streamed in layer by layer and never reside at the same time, so the total weight size (about 10 GB) is not the peak. The peak is admitted by the Runtime based on the bundle's measured values.
pub fn load(bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Loaded, ErrorBody> {
    let backend = by_id(&bundle.backend).ok_or_else(|| {
        ErrorBody::new(codes::MODEL_UNSUPPORTED, "unknown backend")
            .with_details(json!({ "backend": bundle.backend, "reason": "unknown-backend" }))
    })?;
    if let Some(separator) = bundle.separator.as_ref() {
        check_separation(bundle, separator)?;
        check_budget(bundle)?;
        return backend.load_separation(bundle, phase).map(Loaded::Separation);
    }
    if let Some(files) = bundle.image.as_ref() {
        check_image(bundle, files)?;
        return backend.load_image(bundle, phase).map(Loaded::Image);
    }
    if let Some(tts) = bundle.tts.as_ref() {
        let kind = synthesis_kind(bundle, tts)?;
        check_budget(bundle)?;
        return backend.load_synthesis(bundle, kind, phase).map(Loaded::Synthesis);
    }
    if bundle.asr.is_none() && bundle.segmentation.is_some() {
        check_diarization(bundle)?;
        check_budget(bundle)?;
        return backend.load_diarization(bundle, phase).map(Loaded::Diarization);
    }
    if bundle.codec.is_some() || bundle.aux.is_some() {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle has no tts component")
            .with_details(json!({ "component": "tts", "reason": "missing-component" })));
    }
    let family = transcription_family(bundle)?;
    if !transcribe_family_available(family) {
        return Err(transcription_not_wired(Some(family)));
    }
    check_budget(bundle)?;
    backend.load(bundle, phase).map(Loaded::Transcription)
}

/// Component check for a recognition bundle: the family of `asr` must be recognized, and the other components must meet its requirements ([`transcribe_needs`]). A bundled aligner is loaded by the backend together with the model (MOSS loads it on demand). The speaker model is used by MOSS to merge speakers across chunks; on Qwen3-ASR and Whisper it does speaker diarization together with `segmentation` ([`LoadedModel::diarizer`], loaded on demand). Returns the family of `asr`.
fn transcription_family(bundle: &VerifiedBundle) -> Result<&str, ErrorBody> {
    let Some(asr) = bundle.asr.as_ref() else {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle has no asr component")
            .with_details(json!({ "component": "asr", "reason": "missing-component" })));
    };
    let Some(needs) = transcribe_needs(&asr.family) else {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported asr model family")
            .with_details(json!({ "component": "asr", "family": asr.family, "reason": "unknown-family" })));
    };
    for (component, need) in needs {
        let files = match component {
            "vad" => bundle.vad.as_ref(),
            "tokenizer" => bundle.tokenizer.as_ref(),
            "aligner" => bundle.aligner.as_ref(),
            "segmentation" => bundle.segmentation.as_ref(),
            _ => bundle.speaker.as_ref(),
        };
        check_component(component, files, need)?;
    }
    Ok(&asr.family)
}

/// Component check for a synthesis bundle: the family of `tts` must be recognized, and this build must have its engine wired. An unwired family is `not-wired`; the Runtime would not send it per `worker.hello`'s `synthesizeFamilies`. Recognition components are not mixed in. `codec` is only for Qwen3-TTS, and `aux` is only for IndexTTS 2.5 (a missing `aux` is reported as `MODEL_UNSUPPORTED` by the engine).
fn synthesis_kind(bundle: &VerifiedBundle, tts: &VerifiedFiles) -> Result<TtsEngineKind, ErrorBody> {
    let Some(kind) = TtsEngineKind::from_family(&tts.family) else {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported tts model family")
            .with_details(json!({ "component": "tts", "family": tts.family, "reason": "unknown-family" })));
    };
    if !synthesize::engine_available(kind) {
        return Err(synthesis_not_wired(Some(&tts.family)));
    }
    for (component, files) in [
        ("asr", &bundle.asr),
        ("vad", &bundle.vad),
        ("aligner", &bundle.aligner),
        ("speaker", &bundle.speaker),
        ("segmentation", &bundle.segmentation),
        ("tokenizer", &bundle.tokenizer),
    ] {
        if files.is_some() {
            return Err(
                ErrorBody::new(codes::MODEL_UNSUPPORTED, "a synthesis bundle cannot carry recognition components")
                    .with_details(json!({ "component": component, "reason": "unexpected-component" })),
            );
        }
    }
    if let Some(codec) = bundle.codec.as_ref()
        && (kind != TtsEngineKind::Qwen3Tts || codec.family != FAMILY_QWEN3_TTS_CODEC)
    {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported codec model family")
            .with_details(json!({ "component": "codec", "family": codec.family, "reason": "unknown-family" })));
    }
    if let Some(aux) = bundle.aux.as_ref()
        && (kind != TtsEngineKind::IndexTts25 || aux.family != FAMILY_INDEX_TTS2_AUX)
    {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported aux model family")
            .with_details(json!({ "component": "aux", "family": aux.family, "reason": "unknown-family" })));
    }
    Ok(kind)
}

/// Component check for a separation bundle: the family of `separator` must be recognized, and this build must have a separation backend (if not, `not-wired`; the Runtime would not send it per `worker.hello`'s `separateFamilies`). No other components.
fn check_separation(bundle: &VerifiedBundle, separator: &VerifiedFiles) -> Result<(), ErrorBody> {
    if separator.family != FAMILY_HTDEMUCS_FT {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported separator model family")
            .with_details(json!({ "component": "separator", "family": separator.family, "reason": "unknown-family" })));
    }
    if !separate::available_families().contains(&FAMILY_HTDEMUCS_FT) {
        return Err(separation_not_wired(Some(&separator.family)));
    }
    for (component, files) in [
        ("asr", &bundle.asr),
        ("vad", &bundle.vad),
        ("aligner", &bundle.aligner),
        ("speaker", &bundle.speaker),
        ("segmentation", &bundle.segmentation),
        ("tokenizer", &bundle.tokenizer),
        ("tts", &bundle.tts),
        ("codec", &bundle.codec),
        ("aux", &bundle.aux),
        ("image", &bundle.image),
    ] {
        if files.is_some() {
            return Err(
                ErrorBody::new(codes::MODEL_UNSUPPORTED, "a separation bundle cannot carry other components")
                    .with_details(json!({ "component": component, "reason": "unexpected-component" })),
            );
        }
    }
    Ok(())
}

/// Component check for a speaker diarization bundle: both `segmentation` and `speaker` must be present, and the family must be recognized. This build must have speaker diarization (if not, `not-wired`; the Runtime would not send it per `worker.hello`'s `capabilities`). No other components.
fn check_diarization(bundle: &VerifiedBundle) -> Result<(), ErrorBody> {
    check_component(
        "segmentation",
        bundle.segmentation.as_ref(),
        Need::Required(FAMILY_PYANNOTE_SEGMENTATION),
    )?;
    check_component("speaker", bundle.speaker.as_ref(), Need::Required(FAMILY_WESPEAKER))?;
    if !diarizer_available() {
        return Err(diarization_not_wired());
    }
    for (component, files) in [
        ("vad", &bundle.vad),
        ("aligner", &bundle.aligner),
        ("tokenizer", &bundle.tokenizer),
        ("tts", &bundle.tts),
        ("codec", &bundle.codec),
        ("aux", &bundle.aux),
        ("separator", &bundle.separator),
        ("image", &bundle.image),
    ] {
        if files.is_some() {
            return Err(ErrorBody::new(
                codes::MODEL_UNSUPPORTED,
                "a speaker diarization bundle cannot carry other components",
            )
            .with_details(json!({ "component": component, "reason": "unexpected-component" })));
        }
    }
    Ok(())
}

/// Component check for a text-to-image bundle: the family of `image` must be recognized, and this build must have it wired (if not, `not-wired`; the Runtime would not send it per `worker.hello`'s `imageFamilies`). No other components are mixed in.
fn check_image(bundle: &VerifiedBundle, files: &VerifiedFiles) -> Result<(), ErrorBody> {
    if !image::IMAGE_FAMILIES.contains(&files.family.as_str()) {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported image model family")
            .with_details(json!({ "component": "image", "family": files.family, "reason": "unknown-family" })));
    }
    if !image::family_available(&files.family) {
        return Err(image_not_wired(Some(&files.family)));
    }
    for (component, files) in [
        ("asr", &bundle.asr),
        ("vad", &bundle.vad),
        ("aligner", &bundle.aligner),
        ("speaker", &bundle.speaker),
        ("segmentation", &bundle.segmentation),
        ("tokenizer", &bundle.tokenizer),
        ("tts", &bundle.tts),
        ("codec", &bundle.codec),
        ("aux", &bundle.aux),
        ("separator", &bundle.separator),
    ] {
        if files.is_some() {
            return Err(
                ErrorBody::new(codes::MODEL_UNSUPPORTED, "an image bundle cannot carry other components")
                    .with_details(json!({ "component": component, "reason": "unexpected-component" })),
            );
        }
    }
    Ok(())
}

fn check_budget(bundle: &VerifiedBundle) -> Result<(), ErrorBody> {
    if let Some(budget) = bundle.memory_budget_bytes {
        let required = bundle.total_bytes();
        if required > budget {
            return Err(
                ErrorBody::new(codes::MODEL_RESOURCE, "model weights exceed the memory budget").with_details(json!({
                    "resource": "memory",
                    "requiredBytes": required,
                    "budgetBytes": budget,
                })),
            );
        }
    }
    Ok(())
}

fn check_component(component: &str, files: Option<&VerifiedFiles>, need: Need) -> Result<(), ErrorBody> {
    match (files, need) {
        (Some(_), Need::Rejected) => Err(ErrorBody::new(
            codes::MODEL_UNSUPPORTED,
            format!("this asr model family does not take a {component} component"),
        )
        .with_details(json!({ "component": component, "reason": "unexpected-component" }))),
        (Some(files), Need::Required(family) | Need::Optional(family)) if files.family != family => Err(ErrorBody::new(
            codes::MODEL_UNSUPPORTED,
            format!("unsupported {component} model family"),
        )
        .with_details(json!({ "component": component, "family": files.family, "reason": "unknown-family" }))),
        (None, Need::Required(_)) => Err(
            ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the bundle has no {component} component"))
                .with_details(json!({ "component": component, "reason": "missing-component" })),
        ),
        _ => Ok(()),
    }
}

/// With `CCUT_SPEECH_TIMING=1`, writes per-stage timing to stderr (for benchmarks and diagnostics). Independent of the inference backend; read once per process.
///
/// Ported from v2. The engines for MOSS, local speech synthesis and later batches use it to decide whether to print per-stage timings; there are no callers until they are wired in.
pub fn speech_timing_enabled() -> bool {
    static ENABLED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ENABLED.get_or_init(|| std::env::var_os("CCUT_SPEECH_TIMING").as_deref() == Some(std::ffi::OsStr::new("1")))
}

/// Unified error for a backend that was not compiled in.
pub fn not_compiled(id: &str) -> ErrorBody {
    ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("backend {id} is not available in this build"))
        .with_details(json!({ "backend": id, "reason": REASON_NOT_COMPILED }))
}

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
fn mlx_backend() -> &'static dyn Backend {
    &mlx::MlxBackend
}

#[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
fn mlx_backend() -> &'static dyn Backend {
    &MlxUnavailable
}

/// Placeholder when MLX is not compiled in (another platform, or `backend-mlx` turned off).
#[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
struct MlxUnavailable;

#[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
impl Backend for MlxUnavailable {
    fn id(&self) -> &'static str {
        "mlx"
    }

    fn status(&self) -> BackendStatus {
        BackendStatus {
            id: "mlx",
            available: false,
            reason: Some(REASON_NOT_COMPILED.into()),
            devices: Vec::new(),
        }
    }

    fn load(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        Err(not_compiled("mlx"))
    }
}

#[cfg(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64"))]
fn coreml_backend() -> &'static dyn Backend {
    &coreml::CoreMlBackend
}

#[cfg(not(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64")))]
fn coreml_backend() -> &'static dyn Backend {
    &CoreMlUnavailable
}

/// Placeholder when CoreML is not compiled in (another platform, or `backend-coreml` turned off).
#[cfg(not(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64")))]
struct CoreMlUnavailable;

#[cfg(not(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64")))]
impl Backend for CoreMlUnavailable {
    fn id(&self) -> &'static str {
        "coreml"
    }

    fn status(&self) -> BackendStatus {
        BackendStatus {
            id: "coreml",
            available: false,
            reason: Some(REASON_NOT_COMPILED.into()),
            devices: Vec::new(),
        }
    }

    fn load(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        Err(not_compiled("coreml"))
    }
}

#[cfg(feature = "backend-candle")]
fn candle_backend() -> &'static dyn Backend {
    &candle::CandleBackend
}

#[cfg(not(feature = "backend-candle"))]
fn candle_backend() -> &'static dyn Backend {
    &CandleUnavailable
}

/// Placeholder when candle is not compiled in (`backend-candle` turned off).
#[cfg(not(feature = "backend-candle"))]
struct CandleUnavailable;

#[cfg(not(feature = "backend-candle"))]
impl Backend for CandleUnavailable {
    fn id(&self) -> &'static str {
        "candle"
    }

    fn status(&self) -> BackendStatus {
        BackendStatus {
            id: "candle",
            available: false,
            reason: Some(REASON_NOT_COMPILED.into()),
            devices: Vec::new(),
        }
    }

    fn load(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        Err(not_compiled("candle"))
    }
}

#[cfg(feature = "whisper-ggml")]
fn ggml_backend() -> &'static dyn Backend {
    &ggml::GgmlBackend
}

#[cfg(not(feature = "whisper-ggml"))]
fn ggml_backend() -> &'static dyn Backend {
    &GgmlUnavailable
}

/// Placeholder when whisper.cpp is not compiled in (`whisper-ggml` turned off).
#[cfg(not(feature = "whisper-ggml"))]
struct GgmlUnavailable;

#[cfg(not(feature = "whisper-ggml"))]
impl Backend for GgmlUnavailable {
    fn id(&self) -> &'static str {
        "ggml"
    }

    fn status(&self) -> BackendStatus {
        BackendStatus {
            id: "ggml",
            available: false,
            reason: Some(REASON_NOT_COMPILED.into()),
            devices: Vec::new(),
        }
    }

    fn load(&self, _bundle: &VerifiedBundle, _phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        Err(not_compiled("ggml"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_every_backend() {
        let statuses = statuses();
        assert_eq!(
            statuses.iter().map(|status| status.id).collect::<Vec<_>>(),
            ["mlx", "coreml", "candle", "ggml"]
        );
        let candle = &statuses[2];
        if cfg!(feature = "backend-candle") {
            // candle does not depend on the machine: if it is compiled in, it is available; the CPU is always last in the device list.
            assert!(candle.available);
            assert_eq!(candle.devices.last().map(String::as_str), Some("cpu"));
        } else {
            assert!(!candle.available);
            assert_eq!(candle.reason.as_deref(), Some(REASON_NOT_COMPILED));
        }
        for status in &statuses[..2] {
            if !status.available {
                assert!(matches!(
                    status.reason.as_deref(),
                    Some(REASON_NOT_COMPILED | REASON_NO_METAL_DEVICE)
                ));
            }
        }
        let ggml = &statuses[3];
        if cfg!(feature = "whisper-ggml") {
            // ggml also does not depend on the machine: the CPU is always last in the device list (CUDA or Vulkan GPUs, when present, come before it).
            assert!(ggml.available);
            assert_eq!(ggml.devices.last().map(String::as_str), Some("cpu"));
        } else {
            assert!(!ggml.available);
            assert_eq!(ggml.reason.as_deref(), Some(REASON_NOT_COMPILED));
        }
        let coreml = &statuses[1];
        if cfg!(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64")) {
            // VAD on MLX: looks at Metal devices the same way MLX does.
            assert_eq!(coreml.available, statuses[0].available);
        } else {
            assert_eq!(coreml.reason.as_deref(), Some(REASON_NOT_COMPILED));
        }
    }

    /// Builds a recognition model bundle from component names and family, with one 1-byte file per component.
    fn transcription_bundle(dir: &std::path::Path, components: &[(&str, &str)]) -> VerifiedBundle {
        std::fs::write(dir.join("weights.bin"), b"1").unwrap();
        let mut map = serde_json::Map::new();
        for (component, family) in components {
            map.insert(
                (*component).into(),
                json!({
                    "family": family,
                    "revision": "r",
                    "dir": dir.to_string_lossy(),
                    "files": [{ "path": "weights.bin", "sha256": "", "byteLength": 1 }],
                }),
            );
        }
        let bundle: crate::bundle::ModelBundle = serde_json::from_value(json!({
            "bundleId": "b",
            "backend": "mlx",
            "device": "metal",
            "components": map,
            "threads": 1,
        }))
        .unwrap();
        crate::bundle::verify(&bundle).unwrap()
    }

    fn load_error(components: &[(&str, &str)]) -> serde_json::Value {
        let dir = tempfile::tempdir().unwrap();
        let bundle = transcription_bundle(dir.path(), components);
        let error = match load(&bundle, &mut |_, _| {}) {
            Ok(_) => panic!("the bundle should not load"),
            Err(error) => error,
        };
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        error.details.unwrap()
    }

    #[test]
    fn a_separation_bundle_carries_only_its_separator() {
        let separator = ("separator", FAMILY_HTDEMUCS_FT);
        let reason = |details: serde_json::Value| (details["component"].clone(), details["reason"].clone());
        assert_eq!(
            reason(load_error(&[("separator", "demucs-v3")])),
            (json!("separator"), json!("unknown-family"))
        );
        for other in [
            ("asr", FAMILY_QWEN3_ASR),
            ("vad", FAMILY_SILERO_VAD),
            ("tts", crate::bundle::FAMILY_QWEN3_TTS),
            ("codec", FAMILY_QWEN3_TTS_CODEC),
        ] {
            if separate::local_separation_available() {
                assert_eq!(
                    reason(load_error(&[separator, other])),
                    (json!(other.0), json!("unexpected-component"))
                );
            }
        }
        if !separate::local_separation_available() {
            assert_eq!(
                load_error(&[separator]),
                json!({ "capability": "separate", "reason": "not-wired", "family": FAMILY_HTDEMUCS_FT })
            );
        }
        // A 1-byte "weight" that passed the component check goes to the backend. With Metal, reading the config fails (missing files); otherwise the backend is unavailable. Neither is a success.
        let dir = tempfile::tempdir().unwrap();
        let bundle = transcription_bundle(dir.path(), &[separator]);
        assert!(load(&bundle, &mut |_, _| {}).is_err());
    }

    #[test]
    fn a_diarization_bundle_carries_segmentation_and_speaker_only() {
        let segmentation = ("segmentation", FAMILY_PYANNOTE_SEGMENTATION);
        let speaker = ("speaker", FAMILY_WESPEAKER);
        let reason = |details: serde_json::Value| (details["component"].clone(), details["reason"].clone());
        assert_eq!(reason(load_error(&[segmentation])), (json!("speaker"), json!("missing-component")));
        assert_eq!(
            reason(load_error(&[segmentation, ("speaker", "ecapa")])),
            (json!("speaker"), json!("unknown-family"))
        );
        if diarizer_available() {
            for other in [("vad", FAMILY_SILERO_VAD), ("aligner", FAMILY_QWEN3_ALIGNER)] {
                assert_eq!(
                    reason(load_error(&[segmentation, speaker, other])),
                    (json!(other.0), json!("unexpected-component"))
                );
            }
        } else {
            assert_eq!(
                load_error(&[segmentation, speaker]),
                json!({ "capability": "diarize", "reason": "not-wired" })
            );
        }
        // A 1-byte "weight" that is not safetensors: it passes the component check but still cannot be loaded.
        let dir = tempfile::tempdir().unwrap();
        let bundle = transcription_bundle(dir.path(), &[segmentation, speaker]);
        assert!(load(&bundle, &mut |_, _| {}).is_err());
    }

    #[test]
    fn each_asr_family_has_its_own_required_components() {
        let qwen = ("asr", FAMILY_QWEN3_ASR);
        let whisper = ("asr", FAMILY_WHISPER_MLX);
        let moss = ("asr", FAMILY_MOSS_TRANSCRIBE_DIARIZE);
        let vad = ("vad", FAMILY_SILERO_VAD);
        let tokenizer = ("tokenizer", FAMILY_WHISPER_TOKENIZER);
        let aligner = ("aligner", FAMILY_QWEN3_ALIGNER);
        let speaker = ("speaker", FAMILY_WESPEAKER);
        let segmentation = ("segmentation", FAMILY_PYANNOTE_SEGMENTATION);

        // A family whose shape is valid but whose loader is not yet wired: not-wired, naming the family.
        let not_wired = |family: &str| json!({ "capability": "transcribe", "reason": "not-wired", "family": family });
        if !transcribe_family_available(FAMILY_WHISPER_MLX) {
            assert_eq!(load_error(&[whisper, vad, tokenizer]), not_wired(FAMILY_WHISPER_MLX));
            assert_eq!(
                load_error(&[whisper, vad, tokenizer, aligner, speaker]),
                not_wired(FAMILY_WHISPER_MLX)
            );
        }
        let ggml = ("asr", FAMILY_WHISPER_GGML);
        if !transcribe_family_available(FAMILY_WHISPER_GGML) {
            assert_eq!(load_error(&[ggml, vad]), not_wired(FAMILY_WHISPER_GGML));
            assert_eq!(load_error(&[ggml, vad, aligner, speaker]), not_wired(FAMILY_WHISPER_GGML));
        }
        if !transcribe_family_available(FAMILY_MOSS_TRANSCRIBE_DIARIZE) {
            assert_eq!(load_error(&[moss]), not_wired(FAMILY_MOSS_TRANSCRIBE_DIARIZE));
            assert_eq!(load_error(&[moss, aligner, speaker]), not_wired(FAMILY_MOSS_TRANSCRIBE_DIARIZE));
        }

        // Bad shape: a required component is missing, a component is present that should not be, or the family is wrong.
        let reason = |details: serde_json::Value| (details["component"].clone(), details["reason"].clone());
        assert_eq!(
            reason(load_error(&[whisper, vad])),
            (json!("tokenizer"), json!("missing-component"))
        );
        assert_eq!(
            reason(load_error(&[whisper, tokenizer])),
            (json!("vad"), json!("missing-component"))
        );
        // GGML weights carry their own vocabulary: no tokenizer, but VAD is needed.
        assert_eq!(
            reason(load_error(&[ggml, vad, tokenizer])),
            (json!("tokenizer"), json!("unexpected-component"))
        );
        assert_eq!(reason(load_error(&[ggml])), (json!("vad"), json!("missing-component")));
        assert_eq!(reason(load_error(&[moss, vad])), (json!("vad"), json!("unexpected-component")));
        // MOSS diarizes speakers by itself: it must not carry the segmentation model from the "speaker diarization" bundle. Other recognition models that do carry it must have the right family.
        assert_eq!(
            reason(load_error(&[moss, speaker, segmentation])),
            (json!("segmentation"), json!("unexpected-component"))
        );
        assert_eq!(
            reason(load_error(&[qwen, vad, speaker, ("segmentation", FAMILY_WESPEAKER)])),
            (json!("segmentation"), json!("unknown-family"))
        );
        assert_eq!(
            reason(load_error(&[moss, tokenizer])),
            (json!("tokenizer"), json!("unexpected-component"))
        );
        assert_eq!(
            reason(load_error(&[qwen, vad, tokenizer])),
            (json!("tokenizer"), json!("unexpected-component"))
        );
        assert_eq!(reason(load_error(&[qwen])), (json!("vad"), json!("missing-component")));
        assert_eq!(reason(load_error(&[vad])), (json!("asr"), json!("missing-component")));
        assert_eq!(
            reason(load_error(&[("asr", "whisper"), vad])),
            (json!("asr"), json!("unknown-family"))
        );
        assert_eq!(
            reason(load_error(&[whisper, vad, ("tokenizer", FAMILY_QWEN3_ASR)])),
            (json!("tokenizer"), json!("unknown-family"))
        );
    }

    #[test]
    fn only_wired_families_are_reported() {
        let families = transcribe_families();
        for family in &families {
            assert!(TRANSCRIBE_FAMILIES.contains(family));
        }
        let mut expected = Vec::new();
        let qwen_and_moss = cfg!(any(
            all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"),
            feature = "backend-candle"
        ));
        if qwen_and_moss {
            expected.push(FAMILY_QWEN3_ASR);
        }
        if cfg!(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")) {
            expected.push(FAMILY_WHISPER_MLX);
        }
        if cfg!(all(feature = "backend-coreml", target_os = "macos", target_arch = "aarch64")) {
            expected.push(FAMILY_WHISPER_COREML);
        }
        if cfg!(feature = "whisper-ggml") {
            expected.push(FAMILY_WHISPER_GGML);
        }
        if qwen_and_moss {
            expected.push(FAMILY_MOSS_TRANSCRIBE_DIARIZE);
        }
        assert_eq!(aligner_available(), qwen_and_moss);
        assert_eq!(diarizer_available(), qwen_and_moss);
        assert_eq!(families, expected);
    }

    #[test]
    fn phases_use_protocol_names() {
        assert_eq!(ModelPhase::LoadingWeights.as_str(), "loading-weights");
        assert_eq!(ModelPhase::Compiling.as_str(), "compiling");
        assert_eq!(ModelPhase::WarmingUp.as_str(), "warming-up");
    }
}
