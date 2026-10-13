//! CoreML backend (Apple Silicon): `.mlmodelc` packs for Whisper large-v3 / large-v3-turbo.
//!
//! The recognition model runs on CoreML (for the device choice of mel and the decoder, see [`whisper`]). The segmentation Silero VAD and the optional forced aligner are still MLX's ([`super::mlx::silero`], [`super::mlx::aligner`]), so this backend also requires `backend-mlx` and a Metal device. CoreML model handles, like MLX arrays, stay only on the thread that loaded them.

pub mod whisper;

use std::time::Instant;

use serde_json::json;

use super::mlx::{aligner::ForcedAligner, pyannote::DiarizerSlot, runtime, silero::SileroVad};
use super::{Backend, LoadedModel, ModelPhase, PhaseCallback, REASON_NO_METAL_DEVICE, RunMode};
use crate::bundle::{FAMILY_WHISPER_COREML, VerifiedBundle, VerifiedFiles};
use crate::protocol::{BackendStatus, ErrorBody, MemorySnapshot, codes, transcription_not_wired};
use crate::speech::{ForcedAlignment, SpeakerDiarization};
use whisper::{WhisperCoreMl, WhisperFiles};

/// The device name CoreML recognizes: the model pack registers `ane` (the encoder and decoder prefer the Neural Engine, and mel runs on CPU/GPU).
pub const DEVICE: &str = "ane";

pub struct CoreMlBackend;

impl Backend for CoreMlBackend {
    fn id(&self) -> &'static str {
        "coreml"
    }

    /// Recognition model packs all bring MLX's VAD: without a Metal device, it reports unavailable, for the same reason as the `mlx` backend.
    fn status(&self) -> BackendStatus {
        match runtime::ensure_metal_device() {
            Ok(()) => BackendStatus {
                id: "coreml",
                available: true,
                reason: None,
                devices: vec![DEVICE.into()],
            },
            Err(_) => BackendStatus {
                id: "coreml",
                available: false,
                reason: Some(REASON_NO_METAL_DEVICE.into()),
                devices: Vec::new(),
            },
        }
    }

    fn load(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        check_device(bundle)?;
        let (Some(asr_files), Some(vad_files), Some(tokenizer_files)) = (&bundle.asr, &bundle.vad, &bundle.tokenizer) else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(
                codes::MODEL_UNSUPPORTED,
                "the bundle needs asr, vad and tokenizer components",
            ));
        };
        if asr_files.family != FAMILY_WHISPER_COREML {
            return Err(transcription_not_wired(Some(&asr_files.family)));
        }

        // Gather all files from the manifest first: a missing file is MODEL_NOT_INSTALLED, so there is no need to load a model of several hundred MB first.
        let files = whisper_files(asr_files, tokenizer_files)?;
        let vad_weights = vad_files.require_extension("safetensors")?;
        // The aligner is an optional component (shared with the MLX model pack): it loads only if present, and a missing file likewise reports MODEL_NOT_INSTALLED.
        if let Some(aligner_files) = &bundle.aligner {
            aligner_files.require_extension_in("", "safetensors")?;
            aligner_files.require("vocab.json")?;
        }
        // Speaker diarization is also optional (MLX's Pyannote and WeSpeaker): only the files are checked, and the models load when a job needs them.
        let diarizer = DiarizerSlot::new(bundle)?;

        runtime::configure_memory_cache().map_err(|error| load_failed("vad", &error))?;
        phase(ModelPhase::LoadingWeights, Some("vad"));
        let vad = SileroVad::load(&vad_weights).map_err(|error| load_failed("vad", &error))?;
        phase(ModelPhase::LoadingWeights, Some("asr"));
        let asr = WhisperCoreMl::load(&files).map_err(|error| load_failed("asr", &error))?;
        let aligner = match &bundle.aligner {
            Some(aligner_files) => {
                phase(ModelPhase::LoadingWeights, Some("aligner"));
                Some(ForcedAligner::load(aligner_files).map_err(|error| load_failed("aligner", &error))?)
            }
            None => None,
        };

        phase(ModelPhase::WarmingUp, None);
        let started = Instant::now();
        asr.warmup().map_err(|error| load_failed("asr", &error))?;
        let warmup_ms = started.elapsed().as_millis() as u64;
        Ok(Box::new(CoreMlModel {
            vad,
            asr,
            aligner,
            diarizer,
            warmup_ms,
            resident_bytes: resident_bytes(),
        }))
    }
}

/// Takes the files Whisper needs from the manifest. `.mlmodelc` is a directory, handed to CoreML as a whole ([`VerifiedFiles::require_directory`]);
/// the context prefill model is optional (v2: used when present).
pub fn whisper_files(asr: &VerifiedFiles, tokenizer: &VerifiedFiles) -> Result<WhisperFiles, ErrorBody> {
    Ok(WhisperFiles {
        mel: asr.require_directory("MelSpectrogram.mlmodelc")?,
        encoder: asr.require_directory("AudioEncoder.mlmodelc")?,
        decoder: asr.require_directory("TextDecoder.mlmodelc")?,
        decoder_prefill: asr.directory("TextDecoderContextPrefill.mlmodelc"),
        generation_config: asr.require("generation_config.json")?.to_path_buf(),
        tokenizer: tokenizer.require("tokenizer.json")?.to_path_buf(),
    })
}

/// The device must be `ane`, and the machine must have a Metal device (the VAD runs on MLX).
fn check_device(bundle: &VerifiedBundle) -> Result<(), ErrorBody> {
    if bundle.device != DEVICE {
        return Err(
            ErrorBody::new(codes::MODEL_UNSUPPORTED, "the coreml backend only runs on the ane device")
                .with_details(json!({ "backend": "coreml", "device": bundle.device, "reason": "unsupported-device" })),
        );
    }
    if runtime::ensure_metal_device().is_err() {
        return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "no Metal device is available")
            .with_details(json!({ "backend": "coreml", "reason": REASON_NO_METAL_DEVICE })));
    }
    Ok(())
}

/// Failures such as wrong model files or CoreML refusing to load. Details (which may include paths) are written only to stderr; errors from fetching files from the manifest are passed through unchanged.
fn load_failed(component: &str, error: &anyhow::Error) -> ErrorBody {
    eprintln!("[model-worker] loading {component} failed: {error:#}");
    if let Some(body) = error.downcast_ref::<ErrorBody>() {
        return body.clone();
    }
    ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the {component} model could not be loaded"))
        .with_details(json!({ "component": component, "reason": "load-failed" }))
}

/// The process's current resident memory (bytes). CoreML does not report model usage, so `residentBytes` reports the RSS of the whole Worker process.
fn resident_bytes() -> Option<u64> {
    let mut info: libc::proc_taskinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int;
    // SAFETY: `info` is a sufficiently large buffer with C layout; proc_pidinfo writes only `size` bytes into it.
    let written = unsafe {
        libc::proc_pidinfo(
            libc::getpid(),
            libc::PROC_PIDTASKINFO,
            0,
            (&mut info as *mut libc::proc_taskinfo).cast(),
            size,
        )
    };
    (written == size).then_some(info.pti_resident_size)
}

/// The loaded VAD (MLX) + Whisper (CoreML) + optional forced aligner (MLX) + on-demand speaker diarization (MLX).
pub struct CoreMlModel {
    vad: SileroVad,
    asr: WhisperCoreMl,
    aligner: Option<ForcedAligner>,
    diarizer: DiarizerSlot,
    warmup_ms: u64,
    resident_bytes: Option<u64>,
}

impl LoadedModel for CoreMlModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::Pipeline {
            vad: &mut self.vad,
            recognizer: &mut self.asr,
        }
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

    /// CoreML has no active / cache / peak statistics like MLX's; MLX's snapshot only covers the VAD and aligner, and reporting them would be misleading.
    fn memory(&self) -> Option<MemorySnapshot> {
        None
    }

    fn warmup_ms(&self) -> u64 {
        self.warmup_ms
    }

    fn resident_bytes(&self) -> Option<u64> {
        self.resident_bytes
    }
}
