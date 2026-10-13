//! whisper.cpp (ggml) cross-platform Whisper backend, ported unchanged from v2 `ccut-speech`'s `ggml_backend`.
//!
//! Alongside `candle`: candle handles Qwen3 / MOSS / VAD / aligner, and this only handles Whisper. ggml's CPU kernels are available on all platforms; GPU backends are compiled into ggml by feature:
//! `whisper-ggml-cuda` builds the CUDA backend (NVIDIA; the build needs the CUDA Toolkit),
//! `whisper-ggml-vulkan` builds the Vulkan backend (AMD / Intel / NVIDIA graphics cards and integrated GPUs; at runtime it depends only on the Vulkan runtime bundled with the graphics driver).
//! Both can be built in together. CUDA and Vulkan have not yet been run on real hardware (untested). `whisper-ggml-metal` builds the macOS Metal backend, measured on an AMD Radeon Pro 5500M with Whisper large-v3 Turbo q8_0; Intel Workers disable ggml's concurrent Metal scheduling to avoid compute errors on the discrete GPU.
//!
//! Device selection follows a single rule: `CUCCUT_GPU=off` forces CPU; otherwise take the first GPU device ggml enumerates (the same device as whisper.cpp's `gpu_device = 0`). If there is none, use CPU and print a visible fallback notice once (the same form as candle's CUDA fallback notice: a silent degradation that reports no error and is only an order of magnitude slower is the hardest to locate). ggml's registry registers CUDA first and Vulkan second, so when both are built in, an NVIDIA machine selects CUDA. Without an NVIDIA driver, the CUDA backend reports 0 devices (it only logs, without aborting the process), and Vulkan is selected.
//!
//! v3 boundary: the model pack's `asr` component (family `whisper-ggml`) lists one `.bin` (a single-file GGML weight with an embedded vocabulary; there is no `tokenizer` component). The Silero VAD that splits audio into segments and the optional forced aligner are candle's ([`super::candle`]), so `whisper-ggml` also requires `backend-candle`.
//! `worker.hello` reports `devices`: when a GPU is usable, `[<所选 GPU 的设备名>, "cpu"]` (`cuda`, `vulkan` or `metal`, see [`GgmlDevice::protocol_label`]), otherwise `["cpu"]`; when the model pack's `device` is `cpu`, CPU is always used.

pub mod whisper;

pub use whisper::WhisperGgml;

use std::ffi::CStr;
use std::sync::Once;

use serde_json::json;

use super::candle::{self, DiarizerSlot, ForcedAligner, SileroVad};
use super::{Backend, LoadedModel, ModelPhase, PhaseCallback, RunMode};
use crate::bundle::{FAMILY_WHISPER_GGML, VerifiedBundle};
use crate::protocol::{BackendStatus, ErrorBody, MemorySnapshot, codes, transcription_not_wired};
use crate::speech::{ForcedAlignment, SpeakerDiarization};

pub use crate::gpu_env::{GPU_ENV, gpu_disabled_by_env};

/// Device names ggml recognizes (the protocol's device labels).
pub const DEVICE_CPU: &str = "cpu";
pub const DEVICE_CUDA: &str = "cuda";
pub const DEVICE_VULKAN: &str = "vulkan";
pub const DEVICE_METAL: &str = "metal";

/// A compute device as seen by ggml.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GgmlDevice {
    /// Backend registration name (`CPU` / `Vulkan` / `CUDA` …), from ggml's backend registry.
    pub backend: String,
    /// Device description (graphics card model or CPU name).
    pub description: String,
    /// Whether it is a GPU (discrete or integrated).
    pub is_gpu: bool,
}

impl GgmlDevice {
    fn cpu_fallback() -> Self {
        Self {
            backend: "CPU".to_owned(),
            description: "cpu".to_owned(),
            is_gpu: false,
        }
    }

    /// Short label for logs and diagnostics: `ggml-cuda` / `ggml-vulkan` / `ggml-cpu`.
    pub fn label(&self) -> String {
        format!("ggml-{}", self.backend.to_ascii_lowercase())
    }

    /// The protocol device label, mapped from the backend registration name: `CUDA` is `cuda`, `Vulkan` is `vulkan`; other GPU backends (HIP builds register as `ROCm`,
    /// SYCL, etc., none of which CucCut's builds compile in) use the lowercase registration name; anything that is not a GPU (CPU, and on macOS the BLAS whose type is accelerator) is always `cpu`.
    pub fn protocol_label(&self) -> String {
        if !self.is_gpu {
            return DEVICE_CPU.to_owned();
        }
        match self.backend.as_str() {
            "CUDA" => DEVICE_CUDA.to_owned(),
            "Vulkan" => DEVICE_VULKAN.to_owned(),
            "Metal" => DEVICE_METAL.to_owned(),
            other => other.to_ascii_lowercase(),
        }
    }
}

/// Registers the ggml dynamic backends (such as `ggml-vulkan.dll`) located in the same directory as the exe into the registry.
///
/// Statically linked backends are already in the registry, so this step is a no-op for them; it actually loads something only when built with `GGML_BACKEND_DL=ON` and the backends ship as separate dynamic libraries. A missing file is not an error.
pub fn load_sidecar_backends() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        let Some(dir) = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.canonicalize().ok().or(Some(exe)))
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
        else {
            return;
        };
        let Ok(path) = std::ffi::CString::new(dir.to_string_lossy().as_bytes()) else {
            return;
        };
        // SAFETY: the argument is a valid NUL-terminated string; ggml only looks for ggml-*.{dll,so,dylib} in the directory.
        unsafe { whisper_rs::whisper_rs_sys::ggml_backend_load_all_from_path(path.as_ptr()) };
    });
}

/// Enumerates all devices in ggml's current registry (GPUs first, matching ggml's internal order).
pub fn devices() -> Vec<GgmlDevice> {
    use whisper_rs::whisper_rs_sys as sys;
    load_sidecar_backends();
    let mut out = Vec::new();
    // SAFETY: a read-only query of the registry; the returned C string is owned by ggml and lives as long as the process.
    unsafe {
        let count = sys::ggml_backend_dev_count();
        for index in 0..count {
            let device = sys::ggml_backend_dev_get(index);
            if device.is_null() {
                continue;
            }
            let kind = sys::ggml_backend_dev_type(device);
            let is_gpu = kind == sys::ggml_backend_dev_type_GGML_BACKEND_DEVICE_TYPE_GPU
                || kind == sys::ggml_backend_dev_type_GGML_BACKEND_DEVICE_TYPE_IGPU;
            let reg = sys::ggml_backend_dev_backend_reg(device);
            let backend = if reg.is_null() {
                String::new()
            } else {
                c_string(sys::ggml_backend_reg_name(reg))
            };
            out.push(GgmlDevice {
                backend,
                description: c_string(sys::ggml_backend_dev_description(device)),
                is_gpu,
            });
        }
    }
    out
}

unsafe fn c_string(ptr: *const std::os::raw::c_char) -> String {
    if ptr.is_null() {
        String::new()
    } else {
        // SAFETY: the caller guarantees that ptr points to a NUL-terminated string.
        unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned()
    }
}

/// Pure-function version of device selection: given the enumeration result and the switches, determines which device is actually used.
pub fn choose_device(devices: &[GgmlDevice], gpu_disabled: bool) -> GgmlDevice {
    if !gpu_disabled && let Some(gpu) = devices.iter().find(|d| d.is_gpu) {
        return gpu.clone();
    }
    devices.iter().find(|d| !d.is_gpu).cloned().unwrap_or_else(GgmlDevice::cpu_fallback)
}

/// The ggml GPU backends built into this binary (protocol device names), with CUDA first (matching the ggml registry's registration order).
pub fn gpu_backends_built() -> &'static [&'static str] {
    const BUILT: &[&str] = &[
        #[cfg(feature = "whisper-ggml-cuda")]
        DEVICE_CUDA,
        #[cfg(feature = "whisper-ggml-vulkan")]
        DEVICE_VULKAN,
        #[cfg(all(feature = "whisper-ggml-metal", target_os = "macos"))]
        DEVICE_METAL,
    ];
    BUILT
}

/// The device Whisper will use in this run. When a GPU backend (CUDA or Vulkan) is built in but no GPU is enumerated, a warning is printed once, naming the built-in backend.
pub fn default_device() -> GgmlDevice {
    let disabled = gpu_disabled_by_env();
    if disabled {
        return GgmlDevice::cpu_fallback();
    }
    let device = choose_device(&devices(), false);
    let built = gpu_backends_built();
    if !built.is_empty() && !device.is_gpu && !disabled {
        static WARNED: Once = Once::new();
        WARNED.call_once(|| eprintln!("{}", no_gpu_warning(built)));
    }
    device
}

/// The notice when a GPU backend is built in but no usable GPU is present: names the built-in backend and gives one common cause for each.
fn no_gpu_warning(built: &[&str]) -> String {
    let (names, reasons): (Vec<&str>, Vec<&str>) = built
        .iter()
        .map(|backend| match *backend {
            DEVICE_CUDA => ("CUDA", "CUDA: no NVIDIA GPU or driver was found"),
            DEVICE_VULKAN => ("Vulkan", "Vulkan: the driver has no Vulkan runtime or no device was enumerated"),
            DEVICE_METAL => ("Metal", "Metal: no compatible GPU was enumerated"),
            other => (other, other),
        })
        .unzip();
    format!(
        "[model-worker] no {} GPU is available ({}), Whisper falls back to the CPU",
        names.join(" or "),
        reasons.join("; ")
    )
}

/// Runtime snapshot for diagnostics.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WhisperRuntime {
    /// `ggml-cuda` / `ggml-vulkan` / `ggml-cpu` …: the backend actually used this time.
    pub backend: String,
    /// Device description.
    pub device: String,
    /// Which GPU backends are built in (`cuda`, `vulkan`; see [`gpu_backends_built`]).
    pub gpu_backends_built: &'static [&'static str],
    /// Whether at least one GPU was enumerated (not affected by `CUCCUT_GPU`).
    pub gpu_available: bool,
    /// Whether `CUCCUT_GPU` explicitly turned the GPU off.
    pub gpu_disabled: bool,
}

pub fn runtime_probe() -> WhisperRuntime {
    let devices = devices();
    let disabled = gpu_disabled_by_env();
    let chosen = choose_device(&devices, disabled);
    WhisperRuntime {
        backend: chosen.label(),
        device: chosen.description,
        gpu_backends_built: gpu_backends_built(),
        gpu_available: devices.iter().any(|d| d.is_gpu),
        gpu_disabled: disabled,
    }
}

/// Compile-time backend identifier (performs no enumeration): `ggml-cuda+vulkan`, `ggml-cuda`, `ggml-vulkan`, `ggml-metal` or `ggml-cpu`.
pub const fn built_backend() -> &'static str {
    match (cfg!(feature = "whisper-ggml-cuda"), cfg!(feature = "whisper-ggml-vulkan")) {
        (true, true) => "ggml-cuda+vulkan",
        (true, false) => "ggml-cuda",
        (false, true) => "ggml-vulkan",
        (false, false) if cfg!(all(feature = "whisper-ggml-metal", target_os = "macos")) => "ggml-metal",
        (false, false) => "ggml-cpu",
    }
}

pub struct GgmlBackend;

impl Backend for GgmlBackend {
    fn id(&self) -> &'static str {
        "ggml"
    }

    fn status(&self) -> BackendStatus {
        let device = default_device();
        let devices = if device.is_gpu {
            vec![device.protocol_label(), DEVICE_CPU.into()]
        } else {
            vec![DEVICE_CPU.into()]
        };
        BackendStatus {
            id: "ggml",
            available: true,
            reason: None,
            devices,
        }
    }

    fn load(&self, bundle: &VerifiedBundle, phase: &mut PhaseCallback<'_>) -> Result<Box<dyn LoadedModel>, ErrorBody> {
        let device = check_device(bundle)?;
        let (Some(asr_files), Some(vad_files)) = (&bundle.asr, &bundle.vad) else {
            // backend::load has already checked this; this is only for the type.
            return Err(ErrorBody::new(codes::MODEL_UNSUPPORTED, "the bundle needs asr and vad components"));
        };
        if asr_files.family != FAMILY_WHISPER_GGML {
            return Err(transcription_not_wired(Some(&asr_files.family)));
        }

        // Gather all files from the manifest first: a missing file is MODEL_NOT_INSTALLED, so there is no need to load weights that are several GB first.
        let weights = asr_files.require_extension_in("", "bin")?[0].to_path_buf();
        let vad_weights = vad_files.require_extension("safetensors")?;
        // The aligner is an optional component (shared with the other recognition model packs): it loads only if present, and a missing file likewise reports MODEL_NOT_INSTALLED.
        candle::check_aligner_files(bundle)?;
        // Speaker diarization is also optional (candle's Pyannote and WeSpeaker): only the files are checked, and the models load when a job needs them.
        let diarizer = DiarizerSlot::new(bundle, &candle::default_device())?;

        phase(ModelPhase::LoadingWeights, Some("vad"));
        let vad = SileroVad::load(&vad_weights).map_err(|error| candle::load_failed("vad", &error))?;
        phase(ModelPhase::LoadingWeights, Some("asr"));
        let asr = WhisperGgml::load_on(&weights, Some(device)).map_err(|error| candle::load_failed("asr", &error))?;
        let aligner = match &bundle.aligner {
            Some(aligner_files) => {
                phase(ModelPhase::LoadingWeights, Some("aligner"));
                Some(
                    ForcedAligner::load(aligner_files, &candle::default_device())
                        .map_err(|error| candle::load_failed("aligner", &error))?,
                )
            }
            None => None,
        };
        Ok(Box::new(GgmlModel {
            vad,
            asr,
            aligner,
            diarizer,
            resident_bytes: candle::process_resident_bytes(),
        }))
    }
}

/// The model pack's device: `cpu` always runs (it does not touch the GPU); `cuda` / `vulkan` / `metal` require that the GPU selected by this process (the preferred device reported by `worker.hello`) is exactly that device —
/// the corresponding backend is built in, a device was enumerated, and `CUCCUT_GPU` is not off. A process with both CUDA and Vulkan built in that selected CUDA likewise does not accept `vulkan`.
fn check_device(bundle: &VerifiedBundle) -> Result<GgmlDevice, ErrorBody> {
    let unsupported = |message: String| {
        ErrorBody::new(codes::MODEL_UNSUPPORTED, message)
            .with_details(json!({ "backend": "ggml", "device": bundle.device, "reason": "unsupported-device" }))
    };
    match bundle.device.as_str() {
        DEVICE_CPU => Ok(GgmlDevice::cpu_fallback()),
        requested @ (DEVICE_CUDA | DEVICE_VULKAN | DEVICE_METAL) => {
            let device = default_device();
            let label = device.protocol_label();
            if device.is_gpu && label == requested {
                Ok(device)
            } else if device.is_gpu {
                Err(unsupported(format!(
                    "this worker runs Whisper on the {label} device, not {requested}"
                )))
            } else {
                Err(unsupported(format!("no {requested} device is available")))
            }
        }
        _ => Err(unsupported("the ggml backend runs on the cpu, cuda or vulkan device".to_owned())),
    }
}

/// The loaded VAD (candle) + Whisper (whisper.cpp) + optional forced aligner (candle) + on-demand speaker diarization (candle).
pub struct GgmlModel {
    vad: SileroVad,
    asr: WhisperGgml,
    aligner: Option<ForcedAligner>,
    diarizer: DiarizerSlot,
    resident_bytes: Option<u64>,
}

impl LoadedModel for GgmlModel {
    fn run_mode(&mut self) -> RunMode<'_> {
        RunMode::Pipeline {
            vad: &mut self.vad,
            recognizer: &mut self.asr,
        }
    }

    /// Same as candle: the resident memory of the whole Worker process; CUDA / Vulkan VRAM is not included.
    fn memory(&self) -> Option<MemorySnapshot> {
        candle::memory()
    }

    /// whisper.cpp has no separate warm-up (v2 likewise does not warm up).
    fn warmup_ms(&self) -> u64 {
        0
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

#[cfg(test)]
mod tests {
    use super::*;

    fn gpu(backend: &str, name: &str) -> GgmlDevice {
        GgmlDevice {
            backend: backend.into(),
            description: name.into(),
            is_gpu: true,
        }
    }

    fn cpu() -> GgmlDevice {
        GgmlDevice {
            backend: "CPU".into(),
            description: "Apple M2".into(),
            is_gpu: false,
        }
    }

    #[test]
    fn prefers_first_gpu_unless_disabled() {
        let devices = vec![gpu("Vulkan", "AMD Radeon RX 7800 XT"), gpu("Vulkan", "Intel Arc"), cpu()];
        assert_eq!(choose_device(&devices, false), devices[0]);
        assert_eq!(choose_device(&devices, true), devices[2]);
        assert_eq!(choose_device(&devices, false).label(), "ggml-vulkan");
        assert_eq!(choose_device(&devices, true).label(), "ggml-cpu");
        assert_eq!(choose_device(&devices, false).protocol_label(), DEVICE_VULKAN);
        assert_eq!(choose_device(&devices, true).protocol_label(), DEVICE_CPU);
    }

    /// When both CUDA and Vulkan are built in (ggml registers CUDA first), on an NVIDIA machine the enumeration puts the CUDA device first and the Vulkan device for the same card after it:
    /// CUDA is selected, and the protocol label is `cuda`.
    #[test]
    fn prefers_cuda_over_vulkan_when_both_are_enumerated() {
        let devices = vec![
            gpu("CUDA", "NVIDIA GeForce RTX 4070"),
            gpu("Vulkan", "NVIDIA GeForce RTX 4070"),
            cpu(),
        ];
        let chosen = choose_device(&devices, false);
        assert_eq!(chosen, devices[0]);
        assert_eq!(chosen.label(), "ggml-cuda");
        assert_eq!(chosen.protocol_label(), DEVICE_CUDA);
        assert_eq!(choose_device(&devices, true).protocol_label(), DEVICE_CPU);
    }

    /// Without an NVIDIA driver, the CUDA backend reports 0 devices, leaving only Vulkan's: labeled `vulkan`.
    #[test]
    fn labels_a_vulkan_only_gpu_as_vulkan() {
        let devices = vec![gpu("Vulkan", "Intel(R) Arc(TM) Graphics"), cpu()];
        let chosen = choose_device(&devices, false);
        assert_eq!(chosen.label(), "ggml-vulkan");
        assert_eq!(chosen.protocol_label(), DEVICE_VULKAN);
    }

    /// The protocol label depends only on whether the device is a GPU and on the backend registration name: other GPU backends use the lowercase registration name; devices that are not GPUs (including accelerators such as BLAS) are all `cpu`.
    #[test]
    fn protocol_label_maps_backend_names() {
        assert_eq!(gpu("Metal", "AMD Radeon Pro 5500M").protocol_label(), DEVICE_METAL);
        assert_eq!(gpu("ROCm", "AMD Radeon").protocol_label(), "rocm");
        assert_eq!(gpu("SYCL", "Intel Arc").protocol_label(), "sycl");
        let blas = GgmlDevice {
            backend: "BLAS".into(),
            description: "Accelerate".into(),
            is_gpu: false,
        };
        assert_eq!(blas.protocol_label(), DEVICE_CPU);
        assert_eq!(cpu().protocol_label(), DEVICE_CPU);
    }

    #[test]
    fn no_gpu_warning_names_the_built_backends() {
        let both = no_gpu_warning(&[DEVICE_CUDA, DEVICE_VULKAN]);
        assert!(both.contains("no CUDA or Vulkan GPU"), "{both}");
        assert!(both.contains("NVIDIA"), "{both}");
        let vulkan = no_gpu_warning(&[DEVICE_VULKAN]);
        assert!(vulkan.contains("no Vulkan GPU"), "{vulkan}");
        assert!(!vulkan.contains("CUDA"), "{vulkan}");
        let metal = no_gpu_warning(&[DEVICE_METAL]);
        assert!(metal.contains("no Metal GPU"), "{metal}");
    }

    #[test]
    fn built_backends_follow_the_features() {
        assert_eq!(gpu_backends_built().contains(&DEVICE_CUDA), cfg!(feature = "whisper-ggml-cuda"));
        assert_eq!(gpu_backends_built().contains(&DEVICE_VULKAN), cfg!(feature = "whisper-ggml-vulkan"));
        assert_eq!(
            gpu_backends_built().contains(&DEVICE_METAL),
            cfg!(all(feature = "whisper-ggml-metal", target_os = "macos"))
        );
        if gpu_backends_built().is_empty() {
            assert_eq!(built_backend(), "ggml-cpu");
        } else if gpu_backends_built() == [DEVICE_METAL] {
            assert_eq!(built_backend(), "ggml-metal");
        }
    }

    #[test]
    fn falls_back_to_cpu_without_any_device() {
        let chosen = choose_device(&[], false);
        assert!(!chosen.is_gpu);
        assert_eq!(chosen.label(), "ggml-cpu");
    }

    #[test]
    fn registry_enumeration_reports_a_cpu_device() {
        // Real registry: the statically linked CPU backend is always present; GPUs depend on the machine.
        let devices = devices();
        assert!(devices.iter().any(|d| !d.is_gpu), "{devices:?}");
        let probe = runtime_probe();
        assert!(probe.backend.starts_with("ggml-"));
        assert_eq!(probe.gpu_backends_built, gpu_backends_built());
    }

    #[test]
    fn status_lists_the_cpu_last() {
        let status = GgmlBackend.status();
        assert!(status.available);
        assert_eq!(status.devices.last().map(String::as_str), Some(DEVICE_CPU));
        if gpu_backends_built().is_empty() {
            assert_eq!(status.devices, [DEVICE_CPU]);
        } else if status.devices.len() > 1 {
            // The preferred device can only be one of the GPU backends built in.
            assert_eq!(status.devices.len(), 2, "{:?}", status.devices);
            assert!(gpu_backends_built().contains(&status.devices[0].as_str()), "{:?}", status.devices);
        }
    }
}
