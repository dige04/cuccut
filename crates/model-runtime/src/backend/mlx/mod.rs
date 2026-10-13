//! MLX backend (Apple Silicon + Metal): Silero VAD, Qwen3-ASR, Whisper, MOSS-Transcribe-Diarize, Qwen3-ForcedAligner, WeSpeaker, Pyannote,
//! plus the local speech synthesis engine ([`crate::synthesize`]) and the local text-to-image engine ([`crate::image`]).
//!
//! MLX arrays are not `Send`: a loaded [`MlxModel`] and the synthesis engine can only stay on the thread that loaded them. Before entering MLX, always go through
//! [`runtime::ensure_metal_device`]; otherwise, without a Metal device, MLX throws an exception in C++ and aborts the whole process.

pub mod aligner;
pub mod moss;
pub mod pyannote;
pub mod qwen3;
pub mod runtime;
pub mod silero;
pub mod wespeaker;
pub mod whisper;

use std::path::Path;
use std::time::Instant;

use serde_json::{Value, json};

use super::{
    Backend, LoadedDiarization, LoadedImage, LoadedModel, LoadedSeparation, LoadedSynthesis, ModelPhase, PhaseCallback,
    REASON_NO_METAL_DEVICE, RunMode,
};
use crate::bundle::{FAMILY_MOSS_TRANSCRIBE_DIARIZE, FAMILY_QWEN3_ASR, FAMILY_WHISPER_MLX, VerifiedBundle, VerifiedFiles};
use crate::pressure::{self, MemoryPressure};
use crate::protocol::{BackendStatus, ErrorBody, MemorySnapshot, codes, transcription_not_wired};
use crate::separate;
use crate::speech::{
    ForcedAlignment, SegmentedTranscription, SegmentingCallbacks, SegmentingRecognizer, SpeakerDiarization, SpeakerEmbedding,
    SpeechRecognizer,
};
use crate::synthesize::{self, EngineFiles, TtsEngineKind};
use aligner::ForcedAligner;
use moss::MossTranscribeDiarize;
use pyannote::DiarizerSlot;
use qwen3::{Qwen3Asr, Qwen3Config, TokenizerFiles};
use silero::SileroVad;
use wespeaker::WeSpeakerEmbedder;
use whisper::{WhisperFiles, WhisperMlx};

/// Device name that MLX accepts.
pub const DEVICE: &str = "metal";

pub struct MlxBackend;

impl Backend for MlxBackend {
    fn id(&self) -> &'static str {
        "mlx"
    }

    fn status(&self) -> BackendStatus {
        match runtime::ensure_metal_device() {
            Ok(()) => BackendStatus {
                id: "mlx",
                available: true,
                reason: None,
                devices: vec![DEVICE.into()],
            },
            Err(_) => BackendStatus {
                id: "mlx",
                available: false,
                reason: Some(REASON_NO_METAL_DEVICE.into()),
                devices: Vec::new(),
            },
        }
    }

    fn load_synthesis(
        &self,
        bundle: &VerifiedBundle,
        kind: TtsEngineKind,
        phase: &mut PhaseCallback<'_>,
    ) -> Result<LoadedSynthesis, ErrorBody> {
        check_device(bundle)?;
        let Some(model) = &bundle.tts else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs a tts component"));
        };
        let files = EngineFiles {
            model,
            codec: bundle.codec.as_ref(),
            aux: bundle.aux.as_ref(),
        };
        phase(ModelPhase::LoadingWeights, Some(kind.family()));
        let started = Instant::now();
        // The engine checks the manifest itself first (a missing file is MODEL_NOT_INSTALLED), then confirms Metal, the config cache, and reads the weights.
        let engine = synthesize::load(kind, files).map_err(|error| load_failed("tts", &error))?;
        let load_ms = started.elapsed().as_millis() as u64;
        Ok(LoadedSynthesis {
            kind,
            engine,
            load_ms,
            resident_bytes: Some(runtime::memory_snapshot().0 as u64),
            memory,
        })
    }

    fn load_separation(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<LoadedSeparation, ErrorBody> {
        check_device(bundle)?;
        let Some(files) = &bundle.separator else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs a separator component"));
        };
        phase(ModelPhase::LoadingWeights, Some(files.family.as_str()));
        let started = Instant::now();
        let separator = separate::load_separator(files).map_err(|error| load_failed("separator", &error))?;
        let load_ms = started.elapsed().as_millis() as u64;
        Ok(LoadedSeparation {
            separator,
            load_ms,
            resident_bytes: Some(runtime::memory_snapshot().0 as u64),
            memory,
        })
    }

    /// Speaker diarization is loaded separately (protocol spec §2.5.5): the Pyannote segmentation and the WeSpeaker voice embedding are read in together here and stay resident until unload.
    fn load_diarization(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<LoadedDiarization, ErrorBody> {
        check_device(bundle)?;
        let (Some(segmentation), Some(speaker)) = (&bundle.segmentation, &bundle.speaker) else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(
                codes::MODEL_UNSUPPORTED,
                "the bundle needs segmentation and speaker components",
            ));
        };
        segmentation.require_extension_in("", "safetensors")?;
        speaker.require_extension_in("", "safetensors")?;
        phase(ModelPhase::LoadingWeights, Some("segmentation"));
        let started = Instant::now();
        let diarizer =
            pyannote::PyannoteDiarizer::load_with_embedding(segmentation, speaker).map_err(|error| load_failed("segmentation", &error))?;
        Ok(LoadedDiarization {
            diarizer: Box::new(diarizer),
            load_ms: started.elapsed().as_millis() as u64,
            resident_bytes: Some(runtime::memory_snapshot().0 as u64),
            memory,
        })
    }

    fn load_image(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<LoadedImage, ErrorBody> {
        check_device(bundle)?;
        let Some(files) = &bundle.image else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs an image component"));
        };
        phase(ModelPhase::LoadingWeights, Some(files.family.as_str()));
        let started = Instant::now();
        // The engine checks the manifest first (a missing file is MODEL_NOT_INSTALLED), then confirms Metal; the three weight sets are read per stage at generation time.
        let engine = crate::image::load(files).map_err(|error| load_failed("image", &error))?;
        Ok(LoadedImage {
            engine,
            load_ms: started.elapsed().as_millis() as u64,
            resident_bytes: Some(runtime::memory_snapshot().0 as u64),
            memory,
        })
    }

    fn load(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        check_device(bundle)?;
        if let Some(asr_files) = &bundle.asr
            && asr_files.family == FAMILY_MOSS_TRANSCRIBE_DIARIZE
        {
            return load_moss(bundle, asr_files, phase);
        }
        let (Some(asr_files), Some(vad_files)) = (&bundle.asr, &bundle.vad) else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs asr and vad components"));
        };
        if asr_files.family == FAMILY_WHISPER_MLX {
            return load_whisper(bundle, asr_files, vad_files, phase);
        }
        if asr_files.family != FAMILY_QWEN3_ASR {
            return Err(transcription_not_wired(Some(&asr_files.family)));
        }

        // Read and check the files other than the weights first: if the config is wrong, there is no need to read hundreds of MB of weights.
        let config = read_json(asr_files, "config.json")?;
        let config = Qwen3Config::parse(&config).map_err(|message| {
            eprintln!("[model-worker] {message}");
            ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported Qwen3-ASR configuration")
                .with_details(json!({ "component": "asr", "file": "config.json", "reason": "unsupported-config" }))
        })?;
        let tokenizer = TokenizerFiles {
            vocabulary: asr_files.require("vocab.json")?,
            merges: Some(asr_files.require("merges.txt")?),
            config: asr_files.path("tokenizer_config.json"),
        };
        let asr_weights = asr_files.require_extension("safetensors")?;
        let vad_weights = vad_files.require_extension("safetensors")?;
        // The aligner is an optional component: it is loaded only if the model pack includes it. A missing file likewise reports MODEL_NOT_INSTALLED (no silent fallback to estimated word timings).
        check_aligner_files(bundle)?;
        // Speaker diarization is also optional: only its files are checked here; it is loaded when a task needs it.
        let diarizer = DiarizerSlot::new(bundle)?;

        runtime::configure_memory_cache().map_err(|error| load_failed("asr", &error))?;
        phase(ModelPhase::LoadingWeights, Some("vad"));
        let vad = SileroVad::load(&vad_weights).map_err(|error| load_failed("vad", &error))?;
        phase(ModelPhase::LoadingWeights, Some("asr"));
        let mut asr = Qwen3Asr::load(config, &asr_weights, tokenizer).map_err(|error| load_failed("asr", &error))?;
        let aligner = load_aligner(bundle, phase)?;

        phase(ModelPhase::WarmingUp, None);
        let started = Instant::now();
        asr.warmup().map_err(|error| load_failed("asr", &error))?;
        let warmup_ms = started.elapsed().as_millis() as u64;
        let resident_bytes = runtime::memory_snapshot().0 as u64;
        Ok(Box::new(MlxModel {
            vad,
            asr: Box::new(asr),
            aligner,
            diarizer,
            warmup_ms,
            resident_bytes,
        }))
    }
}

/// Whisper (MLX) model pack: `asr` is mlx-community's fp16 conversion (`config.json` + safetensors); the `tokenizer` component provides
/// `tokenizer.json` and `generation_config.json`. VAD, the optional aligner and speaker diarization are the same as for Qwen3-ASR.
fn load_whisper(
    bundle: &VerifiedBundle,
    asr_files: &VerifiedFiles,
    vad_files: &VerifiedFiles,
    phase: &mut PhaseCallback<'_>,
) -> Result<Box<dyn LoadedModel>, ErrorBody> {
    let Some(tokenizer_files) = &bundle.tokenizer else {
        // backend::load has already checked this; this is only for the type.
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs a tokenizer component"));
    };
    // Check the non-weight files first: if the config is wrong, there is no need to read the 1.6–3 GB of weights.
    let config = read_json(asr_files, "config.json")?;
    whisper::WhisperConfig::parse(&config).map_err(|message| {
        eprintln!("[model-worker] {message}");
        ErrorBody::new(codes::MODEL_UNSUPPORTED, "unsupported Whisper configuration")
            .with_details(json!({ "component": "asr", "file": "config.json", "reason": "unsupported-config" }))
    })?;
    let files = WhisperFiles {
        config: asr_files.require("config.json")?.to_path_buf(),
        weights: asr_files
            .require_extension("safetensors")?
            .into_iter()
            .map(Path::to_path_buf)
            .collect(),
        tokenizer: tokenizer_files.require("tokenizer.json")?.to_path_buf(),
        generation_config: tokenizer_files.require("generation_config.json")?.to_path_buf(),
    };
    let vad_weights = vad_files.require_extension("safetensors")?;
    check_aligner_files(bundle)?;
    let diarizer = DiarizerSlot::new(bundle)?;

    runtime::configure_memory_cache().map_err(|error| load_failed("asr", &error))?;
    phase(ModelPhase::LoadingWeights, Some("vad"));
    let vad = SileroVad::load(&vad_weights).map_err(|error| load_failed("vad", &error))?;
    phase(ModelPhase::LoadingWeights, Some("asr"));
    let mut asr = WhisperMlx::load(&files).map_err(|error| load_failed("asr", &error))?;
    let aligner = load_aligner(bundle, phase)?;

    phase(ModelPhase::WarmingUp, None);
    let started = Instant::now();
    asr.warmup().map_err(|error| load_failed("asr", &error))?;
    let warmup_ms = started.elapsed().as_millis() as u64;
    let resident_bytes = runtime::memory_snapshot().0 as u64;
    Ok(Box::new(MlxModel {
        vad,
        asr: Box::new(asr),
        aligner,
        diarizer,
        warmup_ms,
        resident_bytes,
    }))
}

/// Optional aligner: loaded only if the model pack includes it.
fn load_aligner(bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Option<ForcedAligner>, ErrorBody> {
    match &bundle.aligner {
        Some(aligner_files) => {
            phase(ModelPhase::LoadingWeights, Some("aligner"));
            Ok(Some(
                ForcedAligner::load(aligner_files).map_err(|error| load_failed("aligner", &error))?,
            ))
        }
        None => Ok(None),
    }
}

/// MOSS model pack: the MOSS engine is loaded here. The optional aligner and speaker models only have their files checked; they are loaded when a task needs them and released when the task ends (as in v2,
/// the three weight sets are not resident together). MOSS has no warm-up (v2 had none either), so `warmupMs` is 0.
fn load_moss(bundle: &VerifiedBundle, asr_files: &VerifiedFiles, phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
    // A missing file in an optional component is likewise MODEL_NOT_INSTALLED: no silent fallback to estimated word timings or to unmerged speakers.
    check_aligner_files(bundle)?;
    if let Some(speaker_files) = &bundle.speaker {
        speaker_files.require_extension_in("", "safetensors")?;
    }
    runtime::configure_memory_cache().map_err(|error| load_failed("asr", &error))?;
    phase(ModelPhase::LoadingWeights, Some("asr"));
    let engine = MossTranscribeDiarize::load(asr_files).map_err(|error| load_failed("asr", &error))?;
    let resident_bytes = runtime::memory_snapshot().0 as u64;
    Ok(Box::new(MossModel {
        engine: Some(engine),
        asr_files: asr_files.clone(),
        aligner_files: bundle.aligner.clone(),
        speaker_files: bundle.speaker.clone(),
        aligner: None,
        speaker: None,
        helper_failed: (false, false),
        resident_bytes,
    }))
}

fn check_aligner_files(bundle: &VerifiedBundle) -> Result<(), ErrorBody> {
    if let Some(aligner_files) = &bundle.aligner {
        aligner_files.require_extension_in("", "safetensors")?;
        aligner_files.require("vocab.json")?;
    }
    Ok(())
}

/// The device must be `metal`, and this machine must actually have a Metal device (otherwise MLX throws an exception in C++ and aborts the whole process).
fn check_device(bundle: &VerifiedBundle) -> Result<(), ErrorBody> {
    if bundle.device != DEVICE {
        return Err(
            ErrorBody::new(codes::MODEL_UNSUPPORTED, "the mlx backend only runs on the metal device")
                .with_details(json!({ "backend": "mlx", "device": bundle.device, "reason": "unsupported-device" })),
        );
    }
    if runtime::ensure_metal_device().is_err() {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "no Metal device is available")
            .with_details(json!({ "backend": "mlx", "reason": REASON_NO_METAL_DEVICE })));
    }
    Ok(())
}

fn memory() -> Option<MemorySnapshot> {
    let (active, cache, peak) = runtime::memory_snapshot();
    Some(MemorySnapshot {
        active: active as u64,
        cache: cache as u64,
        peak: peak as u64,
    })
}

fn read_json(files: &VerifiedFiles, relative: &str) -> Result<Value, ErrorBody> {
    let path = files.require(relative)?;
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .ok_or_else(|| {
            ErrorBody::new(
                codes::MODEL_UNSUPPORTED,
                format!("unreadable {relative} in the {} component", files.component),
            )
            .with_details(json!({ "component": files.component, "file": relative, "reason": "unreadable" }))
        })
}

/// Load failures such as wrong weight shapes or corrupt files. Details (which may include paths) are written to stderr only.
fn load_failed(component: &str, error: &anyhow::Error) -> ErrorBody {
    eprintln!("[model-worker] loading {component} failed: {error:#}");
    // Errors the engine returns when fetching files from the manifest (a missing file is MODEL_NOT_INSTALLED) are passed through unchanged, not rewrapped as load failures.
    if let Some(body) = error.downcast_ref::<ErrorBody>() {
        return body.clone();
    }
    ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the {component} model could not be loaded"))
        .with_details(json!({ "component": component, "reason": "load-failed" }))
}

/// A loaded VAD + ASR (Qwen3-ASR or Whisper, plus the optional aligner and speaker diarization loaded on demand). Fields are dropped in declaration order; each guard clears the cache
/// after its weights are released.
pub struct MlxModel {
    vad: SileroVad,
    asr: Box<dyn SpeechRecognizer>,
    aligner: Option<ForcedAligner>,
    diarizer: DiarizerSlot,
    warmup_ms: u64,
    resident_bytes: u64,
}

impl LoadedModel for MlxModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::Pipeline {
            vad: &mut self.vad,
            recognizer: self.asr.as_mut(),
        }
    }

    fn memory(&self) -> Option<MemorySnapshot> {
        memory()
    }

    fn warmup_ms(&self) -> u64 {
        self.warmup_ms
    }

    fn resident_bytes(&self) -> Option<u64> {
        Some(self.resident_bytes)
    }

    fn aligner(&mut self) -> Option<&mut dyn ForcedAlignment> {
        self.aligner.as_mut().map(|aligner| aligner as &mut dyn ForcedAlignment)
    }

    fn has_diarizer(&self) -> bool {
        self.diarizer.available()
    }

    fn diarizer(&mut self) -> Option<&mut dyn SpeakerDiarization> {
        self.diarizer.get()
    }

    fn finish_job(&mut self) {
        if self.diarizer.release() {
            let _ = runtime::clear_memory_cache();
        }
    }
}

/// A loaded MOSS model pack. The MOSS engine stays resident; the aligner and speaker models are loaded on demand ([`LoadedModel::aligner`],
/// [`LoadedModel::speaker_embedder`]), only one at a time, and released when the task ends ([`LoadedModel::finish_job`]). If the system is under memory pressure before they are loaded,
/// the MOSS engine is unloaded first (as with v2's resident executor) and reloaded when the next task starts.
pub struct MossModel {
    engine: Option<MossTranscribeDiarize>,
    asr_files: VerifiedFiles,
    aligner_files: Option<VerifiedFiles>,
    speaker_files: Option<VerifiedFiles>,
    aligner: Option<ForcedAligner>,
    speaker: Option<WeSpeakerEmbedder>,
    /// In this task, loading the aligner or the speaker model has failed before: no retry within the same task.
    helper_failed: (bool, bool),
    resident_bytes: u64,
}

impl MossModel {
    /// About to load the auxiliary models: if the system is under memory pressure, unload the MOSS engine first.
    fn yield_engine_under_pressure(&mut self) {
        if self.engine.is_none() {
            return;
        }
        let level = pressure::system_memory_pressure();
        if level != MemoryPressure::Normal {
            eprintln!("[model-worker] memory pressure {level:?}: unloading MOSS before loading the speaker model or aligner");
            self.engine = None;
            let _ = runtime::clear_memory_cache();
        }
    }
}

impl SegmentingRecognizer for MossModel {
    fn transcribe(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut SegmentingCallbacks<'_>,
    ) -> anyhow::Result<SegmentedTranscription> {
        if self.engine.is_none() {
            // The previous task unloaded it under memory pressure.
            self.engine = Some(MossTranscribeDiarize::load(&self.asr_files)?);
        }
        let Some(engine) = self.engine.as_mut() else {
            anyhow::bail!("the MOSS engine is not loaded");
        };
        engine.transcribe(audio, language, callbacks)
    }
}

impl LoadedModel for MossModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::SelfSegmenting(self)
    }

    fn memory(&self) -> Option<MemorySnapshot> {
        memory()
    }

    fn warmup_ms(&self) -> u64 {
        0
    }

    fn resident_bytes(&self) -> Option<u64> {
        Some(self.resident_bytes)
    }

    fn has_aligner(&mut self) -> bool {
        self.aligner_files.is_some()
    }

    fn aligner(&mut self) -> Option<&mut dyn ForcedAlignment> {
        if self.aligner.is_none() && !self.helper_failed.0 {
            let files = self.aligner_files.clone()?;
            self.speaker = None;
            self.yield_engine_under_pressure();
            match ForcedAligner::load(&files) {
                Ok(aligner) => self.aligner = Some(aligner),
                Err(error) => {
                    eprintln!("[model-worker] loading the aligner failed: {error:#}");
                    self.helper_failed.0 = true;
                }
            }
        }
        self.aligner.as_mut().map(|aligner| aligner as &mut dyn ForcedAlignment)
    }

    fn speaker_embedder(&mut self) -> Option<&mut dyn SpeakerEmbedding> {
        if self.speaker.is_none() && !self.helper_failed.1 {
            let files = self.speaker_files.clone()?;
            self.aligner = None;
            self.yield_engine_under_pressure();
            match WeSpeakerEmbedder::load(&files) {
                Ok(speaker) => self.speaker = Some(speaker),
                Err(error) => {
                    eprintln!("[model-worker] loading the speaker model failed: {error:#}");
                    self.helper_failed.1 = true;
                }
            }
        }
        self.speaker.as_mut().map(|speaker| speaker as &mut dyn SpeakerEmbedding)
    }

    fn finish_job(&mut self) {
        let loaded = self.aligner.is_some() || self.speaker.is_some();
        self.aligner = None;
        self.speaker = None;
        self.helper_failed = (false, false);
        if loaded {
            let _ = runtime::clear_memory_cache();
        }
    }
}
