//! candle cross-platform inference backend (CPU on all platforms, optional CUDA), ported from the `candle_backend` of v2 `ccut-speech`.
//!
//! Loads the same model repositories as the `mlx` backend: MLX affine-quantized weights are dequantized at load time (numerically identical to the weights used by MLX `quantized_matmul`). On CPU, everything computes in f32; on CUDA, the checkpoint's own half precision (bf16/f16) is used. The models implement the trait of [`crate::speech`], and the recognition pipeline ([`crate::transcribe`]) is unaware of the backend.
//!
//! Device: when the `cuda` feature is compiled in and `CUCCUT_GPU` has not turned off the GPU, CUDA device 0 is used; if initialization fails, it falls back to CPU and prints a notice to stderr once; otherwise CPU. `worker.hello` reports `devices`: `["cuda", "cpu"]` when CUDA is usable, otherwise `["cpu"]`. When a model pack's `device` is `cpu`, it always runs on CPU. Silero VAD always runs on CPU (in 32 ms chunks, moving it to the GPU would only be slower).

pub mod aligner;
pub mod audio_encoder;
pub mod layers;
pub mod moss;
pub mod pyannote;
pub mod qwen3;
pub mod silero;
pub mod text_decoder;
pub mod thinker_weights;
pub mod weights;
pub mod wespeaker;

use std::sync::OnceLock;
use std::time::Instant;

use anyhow::bail;
use candle_core::{Device, IndexOp, Tensor};
use serde_json::{Value, json};

use super::{Backend, LoadedDiarization, LoadedImage, LoadedModel, LoadedSeparation, LoadedSynthesis, ModelPhase, PhaseCallback, RunMode};
use crate::bundle::{FAMILY_MOSS_TRANSCRIBE_DIARIZE, FAMILY_QWEN3_ASR, VerifiedBundle, VerifiedFiles};
use crate::pressure::{self, MemoryPressure};
use crate::protocol::{BackendStatus, ErrorBody, MemorySnapshot, codes, transcription_not_wired};
use crate::speech::qwen3_asr::{Qwen3Config, TokenizerFiles};
use crate::speech::{
    ForcedAlignment, SegmentedTranscription, SegmentingCallbacks, SegmentingRecognizer, SpeakerDiarization, SpeakerEmbedding,
};
use crate::synthesize::TtsEngineKind;
pub use aligner::ForcedAligner;
pub use moss::MossTranscribeDiarize;
pub use pyannote::{DiarizerSlot, PyannoteDiarizer};
pub use qwen3::Qwen3Asr;
pub use silero::SileroVad;
pub use wespeaker::WeSpeakerEmbedder;

/// Device names recognized by candle.
pub const DEVICE_CPU: &str = "cpu";
pub const DEVICE_CUDA: &str = "cuda";

/// The default inference device of this process, resolved only once: CUDA device 0 when the `cuda` feature is enabled, `CUCCUT_GPU` has not turned off the GPU, and CUDA initialization succeeds; otherwise CPU. If CUDA was compiled in but initialization fails, a notice is printed once to stderr, to avoid silently degrading to CPU, which would be hard to diagnose.
pub fn default_device() -> Device {
    static DEVICE: OnceLock<Device> = OnceLock::new();
    DEVICE.get_or_init(resolve_device).clone()
}

#[cfg(feature = "cuda")]
fn resolve_device() -> Device {
    if crate::gpu_env::gpu_disabled_by_env() {
        return Device::Cpu;
    }
    match Device::new_cuda(0) {
        Ok(device) => device,
        Err(error) => {
            eprintln!("[model-worker] CUDA initialisation failed, falling back to the CPU: {error}");
            Device::Cpu
        }
    }
}

#[cfg(not(feature = "cuda"))]
fn resolve_device() -> Device {
    Device::Cpu
}

/// The protocol name of the device (`cpu` / `cuda`).
pub fn device_label(device: &Device) -> &'static str {
    if device.is_cuda() { DEVICE_CUDA } else { DEVICE_CPU }
}

/// Adds an actionable hint to the underlying CUDA out-of-memory error.
pub(crate) fn annotate_out_of_memory(error: anyhow::Error) -> anyhow::Error {
    let text = format!("{error:#}");
    if text.contains("OUT_OF_MEMORY") || text.contains("out of memory") {
        error.context("CUDA ran out of GPU memory: close other programs using the GPU and retry, or set CUCCUT_GPU=off to run on the CPU")
    } else {
        error
    }
}

/// Triggers a minimal computation to verify that the candle runtime can compute on the default device; returns the device's protocol name.
pub fn compute_probe() -> anyhow::Result<&'static str> {
    let device = default_device();
    let values = Tensor::from_slice(&[1.0_f32, 2.0, 3.0, 4.0], (2, 2), &device)?;
    let output = values.matmul(&values.t()?)?;
    let item = output.i((0, 0))?.to_scalar::<f32>()?;
    if (item - 5.0).abs() > 1e-5 {
        bail!("candle compute probe returned {item}");
    }
    Ok(device_label(&device))
}

pub struct CandleBackend;

impl Backend for CandleBackend {
    fn id(&self) -> &'static str {
        "candle"
    }

    fn status(&self) -> BackendStatus {
        let devices = if default_device().is_cuda() {
            vec![DEVICE_CUDA.into(), DEVICE_CPU.into()]
        } else {
            vec![DEVICE_CPU.into()]
        };
        BackendStatus {
            id: "candle",
            available: true,
            reason: None,
            devices,
        }
    }

    fn load(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        let device = check_device(bundle)?;
        if let Some(asr_files) = &bundle.asr
            && asr_files.family == FAMILY_MOSS_TRANSCRIBE_DIARIZE
        {
            return load_moss(bundle, asr_files, device, phase);
        }
        let (Some(asr_files), Some(vad_files)) = (&bundle.asr, &bundle.vad) else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs asr and vad components"));
        };
        if asr_files.family != FAMILY_QWEN3_ASR {
            return Err(transcription_not_wired(Some(&asr_files.family)));
        }

        // Files other than the weights are read and verified first: if the configuration is wrong, there is no need to read hundreds of MB of weights.
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
        // The aligner is an optional component: it is loaded only when the model pack includes it; missing files likewise report MODEL_NOT_INSTALLED (rather than silently falling back to estimated word timing).
        check_aligner_files(bundle)?;
        // Speaker diarization is likewise optional: only its files are verified, and it is loaded when a task needs it.
        let diarizer = DiarizerSlot::new(bundle, &device)?;

        phase(ModelPhase::LoadingWeights, Some("vad"));
        let vad = SileroVad::load(&vad_weights).map_err(|error| load_failed("vad", &error))?;
        phase(ModelPhase::LoadingWeights, Some("asr"));
        let mut asr = Qwen3Asr::load(config, &asr_weights, tokenizer, &device).map_err(|error| load_failed("asr", &error))?;
        let aligner = match &bundle.aligner {
            Some(aligner_files) => {
                phase(ModelPhase::LoadingWeights, Some("aligner"));
                Some(ForcedAligner::load(aligner_files, &device).map_err(|error| load_failed("aligner", &error))?)
            }
            None => None,
        };

        phase(ModelPhase::WarmingUp, None);
        let started = Instant::now();
        asr.warmup().map_err(|error| load_failed("asr", &error))?;
        let warmup_ms = started.elapsed().as_millis() as u64;
        Ok(Box::new(CandleModel {
            vad,
            asr,
            aligner,
            diarizer,
            warmup_ms,
            resident_bytes: process_resident_bytes(),
        }))
    }

    /// Text-to-image (Qwen-Image): the engine first verifies the manifest and configuration, and reads the tokenizer and scheduler configuration; the three weight segments are deferred and read stage by stage at generation time (same as the MLX backend).
    fn load_image(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<LoadedImage, ErrorBody> {
        let device = check_device(bundle)?;
        let Some(files) = &bundle.image else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs an image component"));
        };
        phase(ModelPhase::LoadingWeights, Some(files.family.as_str()));
        let started = Instant::now();
        let engine = crate::image::qwen_image::candle::QwenImage::load(files, device).map_err(|error| load_failed("image", &error))?;
        Ok(LoadedImage {
            engine: Box::new(engine),
            load_ms: started.elapsed().as_millis() as u64,
            resident_bytes: process_resident_bytes(),
            memory,
        })
    }

    /// Local speech synthesis: the engine runs on candle through the `synthesize::tensor` facade (the same adaptation layer as v2); tensors are pinned to this process's default device, so a model pack's device must be the default device (the Runtime dispatches according to the preferred device reported by `worker.hello`, so normally they do not differ).
    /// On Apple Silicon, when MLX is also compiled in, the facade is MLX, and candle's synthesis model packs are rejected here.
    fn load_synthesis(
        &self,
        bundle: &VerifiedBundle,
        kind: TtsEngineKind,
        phase: &mut PhaseCallback<'_>,
    ) -> Result<LoadedSynthesis, ErrorBody> {
        #[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
        {
            let _ = (bundle, kind, phase);
            Err(
                ErrorBody::new(codes::MODEL_UNSUPPORTED, "local synthesis runs on the mlx backend in this build")
                    .with_details(json!({ "backend": "candle", "reason": "engine-unavailable" })),
            )
        }
        #[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
        {
            let device = check_device(bundle)?;
            let default = default_device();
            if device_label(&device) != device_label(&default) {
                return Err(ErrorBody::new(
                    codes::MODEL_UNSUPPORTED,
                    format!("local synthesis runs on this worker's {} device", device_label(&default)),
                )
                .with_details(json!({ "backend": "candle", "device": bundle.device, "reason": "unsupported-device" })));
            }
            let Some(model) = &bundle.tts else {
                // backend::load has already checked this; this is only for the type.
                return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs a tts component"));
            };
            let files = crate::synthesize::EngineFiles {
                model,
                codec: bundle.codec.as_ref(),
                aux: bundle.aux.as_ref(),
            };
            phase(ModelPhase::LoadingWeights, Some(kind.family()));
            let started = Instant::now();
            let engine = crate::synthesize::load(kind, files).map_err(|error| load_failed("tts", &annotate_out_of_memory(error)))?;
            Ok(LoadedSynthesis {
                kind,
                engine,
                load_ms: started.elapsed().as_millis() as u64,
                resident_bytes: process_resident_bytes(),
                memory,
            })
        }
    }

    /// Speaker diarization is loaded separately (protocol spec §2.5.5): it reads the same Pyannote segmentation and WeSpeaker weights as MLX, and stays resident until unloaded.
    fn load_diarization(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<LoadedDiarization, ErrorBody> {
        let device = check_device(bundle)?;
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
        let diarizer = PyannoteDiarizer::load_with_embedding(segmentation, speaker, &device)
            .map_err(|error| load_failed("segmentation", &annotate_out_of_memory(error)))?;
        Ok(LoadedDiarization {
            diarizer: Box::new(diarizer),
            load_ms: started.elapsed().as_millis() as u64,
            resident_bytes: process_resident_bytes(),
            memory,
        })
    }

    /// Vocal separation (HTDemucs-FT): reads the same repository as MLX; the weights of its four sub-models are upcast to f32 and kept resident at load time (on both CPU and CUDA, as in v2).
    fn load_separation(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<LoadedSeparation, ErrorBody> {
        let device = check_device(bundle)?;
        let Some(files) = &bundle.separator else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs a separator component"));
        };
        phase(ModelPhase::LoadingWeights, Some(files.family.as_str()));
        let started = Instant::now();
        let separator = crate::separate::load_candle_separator(files, device)
            .map_err(|error| load_failed("separator", &annotate_out_of_memory(error)))?;
        Ok(LoadedSeparation {
            separator,
            load_ms: started.elapsed().as_millis() as u64,
            resident_bytes: process_resident_bytes(),
            memory,
        })
    }
}

/// MOSS model pack: the MOSS engine is loaded here; the optional aligner and speaker model only have their files verified, and are loaded when a task needs them and released when the task ends (as in the MLX backend and v2: the three sets of weights are not kept resident together). MOSS has no warmup, so `warmupMs` is 0.
fn load_moss(
    bundle: &VerifiedBundle,
    asr_files: &VerifiedFiles,
    device: Device,
    phase: &mut PhaseCallback<'_>,
) -> Result<Box<dyn LoadedModel>, ErrorBody> {
    check_aligner_files(bundle)?;
    if let Some(speaker_files) = &bundle.speaker {
        speaker_files.require_extension_in("", "safetensors")?;
    }
    phase(ModelPhase::LoadingWeights, Some("asr"));
    let engine = MossTranscribeDiarize::load(asr_files, &device).map_err(|error| load_failed("asr", &error))?;
    Ok(Box::new(CandleMossModel {
        engine: Some(engine),
        asr_files: asr_files.clone(),
        aligner_files: bundle.aligner.clone(),
        speaker_files: bundle.speaker.clone(),
        aligner: None,
        speaker: None,
        helper_failed: (false, false),
        resident_bytes: process_resident_bytes(),
        device,
    }))
}

pub(crate) fn check_aligner_files(bundle: &VerifiedBundle) -> Result<(), ErrorBody> {
    if let Some(aligner_files) = &bundle.aligner {
        aligner_files.require_extension_in("", "safetensors")?;
        aligner_files.require("vocab.json")?;
    }
    Ok(())
}

/// The model pack's device: `cpu` can always run; `cuda` requires that this process actually obtained a CUDA device (the `cuda` feature, `CUCCUT_GPU` not turned off, and successful initialization).
fn check_device(bundle: &VerifiedBundle) -> Result<Device, ErrorBody> {
    match bundle.device.as_str() {
        DEVICE_CPU => Ok(Device::Cpu),
        DEVICE_CUDA if default_device().is_cuda() => Ok(default_device()),
        DEVICE_CUDA => Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "no CUDA device is available")
            .with_details(json!({ "backend": "candle", "device": bundle.device, "reason": "unsupported-device" }))),
        _ => Err(
            ErrorBody::new(codes::MODEL_UNSUPPORTED, "the candle backend runs on the cpu or cuda device")
                .with_details(json!({ "backend": "candle", "device": bundle.device, "reason": "unsupported-device" })),
        ),
    }
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

/// Load failures such as wrong weight shapes or corrupted files. Details (which may include paths) are written only to stderr; errors from fetching files per the manifest are passed through unchanged.
pub(crate) fn load_failed(component: &str, error: &anyhow::Error) -> ErrorBody {
    eprintln!("[model-worker] loading {component} failed: {error:#}");
    if let Some(body) = error.downcast_ref::<ErrorBody>() {
        return body.clone();
    }
    ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("the {component} model could not be loaded"))
        .with_details(json!({ "component": component, "reason": "load-failed" }))
}

/// candle has no allocator statistics like MLX's: `active` reports the resident memory of the whole Worker process at this moment, `peak` reports the process's peak resident memory, and `cache` is 0.
/// CUDA device memory is not included. On platforms where process memory cannot be obtained (Windows), `None` is reported.
pub(crate) fn memory() -> Option<MemorySnapshot> {
    let active = process_resident_bytes()?;
    Some(MemorySnapshot {
        active,
        cache: 0,
        peak: process_peak_resident_bytes().unwrap_or(active).max(active),
    })
}

/// The process's resident memory at this moment (bytes).
#[cfg(target_os = "macos")]
pub(crate) fn process_resident_bytes() -> Option<u64> {
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

/// The process's resident memory at this moment (bytes): the second column of `/proc/self/statm` is the number of resident pages.
#[cfg(target_os = "linux")]
pub(crate) fn process_resident_bytes() -> Option<u64> {
    let statm = std::fs::read_to_string("/proc/self/statm").ok()?;
    let pages = statm.split_whitespace().nth(1)?.parse::<u64>().ok()?;
    // SAFETY: sysconf only reads a system constant.
    let page_size = unsafe { libc::sysconf(libc::_SC_PAGESIZE) };
    (page_size > 0).then(|| pages * page_size as u64)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub(crate) fn process_resident_bytes() -> Option<u64> {
    None
}

/// The process's peak resident memory (bytes). `ru_maxrss` is in bytes on macOS and in KiB on Linux.
#[cfg(unix)]
fn process_peak_resident_bytes() -> Option<u64> {
    let mut usage: libc::rusage = unsafe { std::mem::zeroed() };
    // SAFETY: `usage` is an output buffer with C layout.
    if unsafe { libc::getrusage(libc::RUSAGE_SELF, &mut usage) } != 0 {
        return None;
    }
    let raw = u64::try_from(usage.ru_maxrss).ok()?;
    Some(if cfg!(target_os = "macos") { raw } else { raw * 1024 })
}

#[cfg(not(unix))]
fn process_peak_resident_bytes() -> Option<u64> {
    None
}

/// The loaded VAD + ASR (plus the optional aligner and on-demand speaker diarization).
pub struct CandleModel {
    vad: SileroVad,
    asr: Qwen3Asr,
    aligner: Option<ForcedAligner>,
    diarizer: DiarizerSlot,
    warmup_ms: u64,
    resident_bytes: Option<u64>,
}

impl LoadedModel for CandleModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::Pipeline {
            vad: &mut self.vad,
            recognizer: &mut self.asr,
        }
    }

    fn memory(&self) -> Option<MemorySnapshot> {
        memory()
    }

    fn warmup_ms(&self) -> u64 {
        self.warmup_ms
    }

    fn resident_bytes(&self) -> Option<u64> {
        self.resident_bytes
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
        self.diarizer.release();
    }
}

/// The loaded MOSS model pack, following the same rules as `MossModel` in the MLX backend: the MOSS engine stays resident; the aligner and speaker model are loaded on demand, keeping only one at a time, and released when the task ends; if the system is under memory pressure before loading them, the MOSS engine is unloaded first and reloaded when the next task starts.
pub struct CandleMossModel {
    engine: Option<MossTranscribeDiarize>,
    asr_files: VerifiedFiles,
    aligner_files: Option<VerifiedFiles>,
    speaker_files: Option<VerifiedFiles>,
    aligner: Option<ForcedAligner>,
    speaker: Option<WeSpeakerEmbedder>,
    /// The aligner or speaker model failed to load during this task: it is not retried within the same task.
    helper_failed: (bool, bool),
    resident_bytes: Option<u64>,
    device: Device,
}

impl CandleMossModel {
    fn yield_engine_under_pressure(&mut self) {
        if self.engine.is_none() {
            return;
        }
        let level = pressure::system_memory_pressure();
        if level != MemoryPressure::Normal {
            eprintln!("[model-worker] memory pressure {level:?}: unloading MOSS before loading the speaker model or aligner");
            self.engine = None;
        }
    }
}

impl SegmentingRecognizer for CandleMossModel {
    fn transcribe(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut SegmentingCallbacks<'_>,
    ) -> anyhow::Result<SegmentedTranscription> {
        if self.engine.is_none() {
            // The previous task unloaded it under memory pressure.
            self.engine = Some(MossTranscribeDiarize::load(&self.asr_files, &self.device)?);
        }
        let Some(engine) = self.engine.as_mut() else {
            bail!("the MOSS engine is not loaded");
        };
        engine.transcribe(audio, language, callbacks)
    }
}

impl LoadedModel for CandleMossModel {
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
        self.resident_bytes
    }

    fn has_aligner(&mut self) -> bool {
        self.aligner_files.is_some()
    }

    fn aligner(&mut self) -> Option<&mut dyn ForcedAlignment> {
        if self.aligner.is_none() && !self.helper_failed.0 {
            let files = self.aligner_files.clone()?;
            self.speaker = None;
            self.yield_engine_under_pressure();
            match ForcedAligner::load(&files, &self.device) {
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
            match WeSpeakerEmbedder::load(&files, &self.device) {
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
        self.aligner = None;
        self.speaker = None;
        self.helper_failed = (false, false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_device_computes() {
        let label = compute_probe().unwrap();
        assert_eq!(label, device_label(&default_device()));
        if !cfg!(feature = "cuda") {
            assert_eq!(label, DEVICE_CPU);
        }
    }

    #[test]
    fn status_lists_the_cpu_last() {
        let status = CandleBackend.status();
        assert!(status.available);
        assert_eq!(status.devices.last().map(String::as_str), Some(DEVICE_CPU));
    }

    #[test]
    fn out_of_memory_errors_get_a_hint() {
        let annotated = annotate_out_of_memory(anyhow::anyhow!("CUDA_ERROR_OUT_OF_MEMORY"));
        assert!(format!("{annotated:#}").contains("CUCCUT_GPU=off"));
        let plain = annotate_out_of_memory(anyhow::anyhow!("shape mismatch"));
        assert_eq!(format!("{plain:#}"), "shape mismatch");
    }

    #[test]
    fn reports_process_memory_where_the_platform_allows() {
        if cfg!(any(target_os = "macos", target_os = "linux")) {
            let snapshot = memory().unwrap();
            assert!(snapshot.active > 0);
            assert!(snapshot.peak >= snapshot.active);
        }
    }
}
