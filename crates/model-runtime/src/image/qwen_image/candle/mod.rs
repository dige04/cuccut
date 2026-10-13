//! Qwen-Image-2.1 candle engine (CPU; NVIDIA CUDA with the `cuda` feature), ported from v2 `ccut-image-local::candle`.
//!
//! Reads the installed MLX 4-bit safetensors directly (the same model package repository as the MLX path); there is no second checkpoint. The three parts run in sequence and never reside together: the text encoder layer by layer, the DiT layer by layer (each step dequantizes this layer's matrices again), and the VAE convolution by convolution. Each is read from the mapped files and dropped after use. Compute precision depends on the device: f32 on CPU, bf16 on CUDA (same as v2). The initial noise is drawn on the host with ChaCha20 from the seed, because candle's CPU device cannot take a seed and the process-wide CUDA RNG should not be touched. So the same seed gives different images on candle and MLX, but reproduces byte for byte on the same backend and device.
//!
//! The only differences from v2 are at the boundary: files are fetched by manifest via [`VerifiedFiles`] (a missing file gives `MODEL_NOT_INSTALLED`); tokenization uses [`super::prompt::Prompter`], shared with the MLX path; cancellation and progress go through [`Cancelled`] and [`ImageProgress`] from [`crate::image`]. v2 compiles this path only on Windows and Linux x86_64. Here it compiles on any platform with `backend-candle` (the Runtime decides per platform whether the candle model package is listed), so its tests can run with real weights on a development machine.

mod dit;
mod text_encoder;
mod vae;
mod weights;

use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::{Result, anyhow, bail};
use candle_core::{DType, Device, Tensor};
use rand_chacha::ChaCha20Rng;
use rand_chacha::rand_core::SeedableRng;
use rand_distr::{Distribution, StandardNormal};
use serde_json::{Value, json};

use super::prompt::Prompter;
use super::scheduler::SchedulerConfig;
use crate::backend::candle::annotate_out_of_memory;
use crate::bundle::{FAMILY_QWEN_IMAGE, VerifiedFiles};
use crate::image::{Cancelled, ImageEngine, ImageProgress, ImageRequest, RawImage};
use crate::protocol::{ErrorBody, codes};

/// The number of image tokens per block over which each DiT layer computes q and the output (same value as v2).
const DIT_CHUNK: usize = 1024;

/// Files fetched by manifest.
struct Files {
    text_encoder: Vec<PathBuf>,
    transformer: Vec<PathBuf>,
    vae: Vec<PathBuf>,
    vae_config: PathBuf,
}

fn refs(paths: &[PathBuf]) -> Vec<&Path> {
    paths.iter().map(PathBuf::as_path).collect()
}

fn owned(files: Vec<&Path>) -> Vec<PathBuf> {
    files.into_iter().map(PathBuf::from).collect()
}

/// Qwen-Image-2.1 candle engine. Loading does not read the weights: the three weight sets are opened per stage during each generation and dropped after use.
pub struct QwenImage {
    device: Device,
    files: Files,
    prompter: Prompter,
    scheduler: SchedulerConfig,
}

fn seeded_noise(seed: u64, count: usize) -> Vec<f32> {
    let mut rng = ChaCha20Rng::seed_from_u64(seed);
    (0..count).map(|_| StandardNormal.sample(&mut rng)).collect()
}

/// `[1,H,W,4]`, range [-1,1] VAE output → 8-bit RGBA.
fn to_rgba(image: &Tensor) -> Result<RawImage> {
    let (batch, height, width, channels) = image.dims4()?;
    if batch != 1 || channels != 4 {
        bail!("VAE 输出需要 [1,H,W,4] RGBA 布局");
    }
    let pixels = image
        .to_dtype(DType::F32)?
        .flatten_all()?
        .to_vec1::<f32>()?
        .into_iter()
        .map(|value| {
            if !value.is_finite() {
                bail!("VAE 输出包含非有限像素值");
            }
            Ok(((value + 1.0) * 127.5).clamp(0.0, 255.0).round() as u8)
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(RawImage {
        width: width as u32,
        height: height as u32,
        pixels,
    })
}

/// Checks that the three configs are the Qwen-Image-2.1 MLX affine 4-bit package (the same checks as v2). The candle implementation hard-codes these shapes.
fn verify_model_config(model_index: &Value, transformer: &Value, text: &Value) -> Result<()> {
    let expected = [
        ("_class_name", json!("QwenImage21Transformer2DModel")),
        ("attention_head_dim", json!(128)),
        ("context_in_dim", json!(4096)),
        ("in_channels", json!(64)),
        ("num_attention_heads", json!(32)),
        ("num_layers", json!(32)),
        ("out_channels", json!(64)),
        ("patch_size", json!(1)),
        ("mlx_format", json!(true)),
    ];
    if model_index["_class_name"] != "QwenImage21Pipeline" {
        bail!("需要 QwenImage21Pipeline 模型包");
    }
    for (key, value) in expected {
        if transformer[key] != value {
            bail!("transformer/config.json 的 {key} 与 Qwen-Image-2.1 MLX 权重不符");
        }
    }
    let quant = &transformer["quantization"];
    if quant["bits"] != 4 || quant["group_size"] != 64 || quant["mode"] != "affine" {
        bail!("需要 MLX affine 4-bit transformer 权重");
    }
    let text_config = &text["text_config"];
    let text_expected = [
        ("hidden_size", json!(4096)),
        ("intermediate_size", json!(12288)),
        ("num_hidden_layers", json!(36)),
        ("num_attention_heads", json!(32)),
        ("num_key_value_heads", json!(8)),
        ("head_dim", json!(128)),
        ("rope_theta", json!(5_000_000)),
    ];
    for (key, value) in text_expected {
        if text_config[key] != value {
            bail!("text_encoder/config.json 的 {key} 与 Qwen3-VL 文本模型不符");
        }
    }
    let text_quant = &text["quantization"];
    if text["mlx_format"] != true || text_quant["bits"] != 4 || text_quant["group_size"] != 64 || text_quant["mode"] != "affine" {
        bail!("需要 MLX affine 4-bit Qwen3-VL 文本权重");
    }
    Ok(())
}

fn check(cancel: &dyn Fn() -> bool) -> Result<()> {
    if cancel() {
        return Err(Cancelled.into());
    }
    Ok(())
}

impl QwenImage {
    /// Checks the manifest first (a missing file is `MODEL_NOT_INSTALLED`), then the config (a package that is not this model's MLX 4-bit package is `MODEL_UNSUPPORTED`), and finally reads the tokenizer vocabulary and scheduler config. `device` is set by the backend according to the model package's `device`.
    pub fn load(files: &VerifiedFiles, device: Device) -> Result<Self> {
        let tokenizer = files.require("processor/tokenizer.json")?.to_path_buf();
        let scheduler = files.require("scheduler/scheduler_config.json")?.to_path_buf();
        let configs = [
            files.require("model_index.json")?,
            files.require("transformer/config.json")?,
            files.require("text_encoder/config.json")?,
        ];
        let paths = Files {
            text_encoder: owned(files.require_extension_in("text_encoder", "safetensors")?),
            transformer: owned(files.require_extension_in("transformer", "safetensors")?),
            vae: owned(files.require_extension_in("vae", "safetensors")?),
            vae_config: files.require("vae/config.json")?.to_path_buf(),
        };
        let unreadable = |what: &str, e: anyhow::Error| {
            ErrorBody::new(codes::MODEL_NOT_INSTALLED, format!("{what} 读不出来：{e:#}"))
                .with_details(json!({ "component": "image", "reason": "unreadable" }))
        };
        let mut values = Vec::with_capacity(configs.len());
        for path in configs {
            let value = std::fs::read(path)
                .map_err(anyhow::Error::from)
                .and_then(|bytes| Ok(serde_json::from_slice::<Value>(&bytes)?))
                .map_err(|e| unreadable(&path.display().to_string(), e))?;
            values.push(value);
        }
        verify_model_config(&values[0], &values[1], &values[2]).map_err(|e| {
            ErrorBody::new(codes::MODEL_UNSUPPORTED, format!("{e:#}"))
                .with_details(json!({ "component": "image", "reason": "unsupported-config" }))
        })?;
        let prompter = Prompter::load(&tokenizer).map_err(|e| unreadable("processor/tokenizer.json", e))?;
        let scheduler = SchedulerConfig::load(&scheduler).map_err(|e| unreadable("scheduler/scheduler_config.json", e))?;
        Ok(Self {
            device,
            files: paths,
            prompter,
            scheduler,
        })
    }

    /// Compute precision: bf16 on CUDA, f32 on CPU (same as v2).
    fn compute_dtype(&self) -> DType {
        if self.device.is_cuda() { DType::BF16 } else { DType::F32 }
    }

    fn run(&self, request: &ImageRequest, progress: &mut dyn FnMut(ImageProgress), cancel: &dyn Fn() -> bool) -> Result<RawImage> {
        let total = Instant::now();
        let (gh, gw) = (request.height as usize / 16, request.width as usize / 16);
        let steps = request.steps as usize;
        let compute = self.compute_dtype();
        check(cancel)?;

        // 1. Text encoding
        progress(ImageProgress::EncodingPrompt);
        let t0 = Instant::now();
        let condition = text_encoder::encode(
            &refs(&self.files.text_encoder),
            &self.prompter,
            &request.prompt,
            &self.device,
            compute,
            cancel,
        )?;
        trace!("[text] {:?}，{:.1}s", condition.dims(), t0.elapsed().as_secs_f64());
        mem("after text");
        check(cancel)?;

        // 2. DiT denoising
        let t1 = Instant::now();
        let dit = dit::Dit::load(&refs(&self.files.transformer), &self.device, compute)?;
        let mut cache = dit.prepare_text(&condition, gh, gw)?;
        let sigmas = self.scheduler.sigmas(steps, gh * gw);
        let noise = seeded_noise(request.seed, gh * gw * vae::Z_DIM);
        let mut latent = Tensor::from_vec(noise, (1, gh * gw, vae::Z_DIM), &self.device)?;
        trace!("[dit] 准备 {:.1}s（{compute:?}）", t1.elapsed().as_secs_f64());
        progress(ImageProgress::Denoising {
            done: 0,
            total: request.steps,
        });
        for step in 0..steps {
            check(cancel)?;
            let ts = Instant::now();
            let velocity = dit.step(&mut cache, &latent, sigmas[step], gh, gw, DIT_CHUNK, cancel)?;
            let delta = sigmas[step + 1] - sigmas[step];
            latent = latent.broadcast_add(&(velocity * delta)?)?;
            trace!(
                "[dit] step {}/{steps} sigma {:.4} {:.2}s",
                step + 1,
                sigmas[step],
                ts.elapsed().as_secs_f64()
            );
            progress(ImageProgress::Denoising {
                done: step as u32 + 1,
                total: request.steps,
            });
        }
        mem("dit done");
        drop((condition, cache, dit));
        check(cancel)?;

        // 3. VAE decoding
        progress(ImageProgress::Decoding);
        let t2 = Instant::now();
        let decoder = vae::Decoder::load(&refs(&self.files.vae), &self.files.vae_config, &self.device, compute)?;
        let image = decoder.decode(&latent.reshape((1, gh, gw, vae::Z_DIM))?, cancel)?;
        let image = to_rgba(&image)?;
        trace!("[vae] 解码 {:.1}s", t2.elapsed().as_secs_f64());
        mem("vae done");
        trace!(
            "{}x{} {steps} steps seed {}（总计 {:.1}s）",
            request.width,
            request.height,
            request.seed,
            total.elapsed().as_secs_f64()
        );
        Ok(image)
    }
}

impl ImageEngine for QwenImage {
    fn family(&self) -> &'static str {
        FAMILY_QWEN_IMAGE
    }

    fn default_steps(&self) -> u32 {
        super::DEFAULT_STEPS
    }

    fn check_size(&self, width: u32, height: u32) -> Result<(), ErrorBody> {
        super::check_size(width, height)
    }

    fn generate(&mut self, request: &ImageRequest, progress: &mut dyn FnMut(ImageProgress), cancel: &dyn Fn() -> bool) -> Result<RawImage> {
        super::check_size(request.width, request.height)?;
        if request.steps == 0 {
            return Err(ErrorBody::invalid_params("steps 至少 1").into());
        }
        let image = self.run(request, progress, cancel).map_err(|error| {
            if error.is::<Cancelled>() {
                error
            } else {
                annotate_out_of_memory(error)
            }
        })?;
        if (image.width, image.height) != (request.width, request.height) {
            return Err(anyhow!(
                "解码尺寸 {}x{} 与请求 {}x{} 不符",
                image.width,
                image.height,
                request.width,
                request.height
            ));
        }
        Ok(image)
    }
}

/// When the timing switch is on, prints one line of process memory: resident (including the mapped weight-file pages, which can be reclaimed) and its peak. On macOS it also reports phys_footprint (which excludes clean file pages, and is the amount actually competing with other processes for memory).
fn mem(tag: &str) {
    if !super::timing() {
        return;
    }
    let gb = |v: Option<u64>| v.map_or_else(|| "?".to_owned(), |v| format!("{:.2} GB", v as f64 / 1e9));
    let (footprint, footprint_max) = footprint();
    eprintln!(
        "[mem] {tag}: 常驻峰值 {}｜footprint {}，进程最大 {}",
        gb(peak_resident_bytes()),
        gb(footprint),
        gb(footprint_max)
    );
}

/// The process's resident peak, in bytes. `ru_maxrss` is in bytes on macOS and in KiB on Linux.
#[cfg(unix)]
fn peak_resident_bytes() -> Option<u64> {
    let mut usage: libc::rusage = unsafe { std::mem::zeroed() };
    // SAFETY: `usage` is an output buffer with C layout.
    if unsafe { libc::getrusage(libc::RUSAGE_SELF, &mut usage) } != 0 {
        return None;
    }
    let raw = u64::try_from(usage.ru_maxrss).ok()?;
    Some(if cfg!(target_os = "macos") { raw } else { raw * 1024 })
}

#[cfg(not(unix))]
fn peak_resident_bytes() -> Option<u64> {
    None
}

/// The process's current and lifetime-maximum phys_footprint (macOS only).
#[cfg(target_os = "macos")]
fn footprint() -> (Option<u64>, Option<u64>) {
    // SAFETY: rusage_info_v4 is a plain data structure, so zero-initialization is valid; proc_pid_rusage fills it in for the flavor.
    unsafe {
        let mut info: libc::rusage_info_v4 = std::mem::zeroed();
        let rc = libc::proc_pid_rusage(
            libc::getpid(),
            libc::RUSAGE_INFO_V4,
            (&mut info as *mut libc::rusage_info_v4).cast(),
        );
        if rc != 0 {
            return (None, None);
        }
        (Some(info.ri_phys_footprint), Some(info.ri_lifetime_max_phys_footprint))
    }
}

#[cfg(not(target_os = "macos"))]
fn footprint() -> (Option<u64>, Option<u64>) {
    (None, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bundle::{FileEntry, ModelFiles};

    #[test]
    fn latent_noise_is_seeded_without_device_rng() {
        let a = seeded_noise(42, 256);
        assert_eq!(a, seeded_noise(42, 256));
        assert_ne!(a, seeded_noise(43, 256));
        assert!(a.iter().all(|value| value.is_finite()));
    }

    #[test]
    fn rgba_conversion_keeps_alpha_as_fourth_channel() {
        let image = Tensor::from_vec(vec![-1.0_f32, 0.0, 1.0, 1.0], (1, 1, 1, 4), &Device::Cpu).unwrap();
        let raw = to_rgba(&image).unwrap();
        assert_eq!((raw.width, raw.height), (1, 1));
        assert_eq!(raw.pixels, vec![0, 128, 255, 255]);
        let invalid = Tensor::from_vec(vec![0.0_f32, 0.0, 0.0, f32::NAN], (1, 1, 1, 4), &Device::Cpu).unwrap();
        assert!(to_rgba(&invalid).is_err());
    }

    /// An `image` component made of a few small files only (no weights).
    fn component(dir: &Path, files: &[(&str, &[u8])]) -> VerifiedFiles {
        let mut entries = Vec::new();
        for (path, body) in files {
            let full = dir.join(path);
            std::fs::create_dir_all(full.parent().unwrap()).unwrap();
            std::fs::write(&full, body).unwrap();
            entries.push(FileEntry {
                path: (*path).into(),
                sha256: "0".repeat(64),
                byte_length: body.len() as u64,
            });
        }
        ModelFiles {
            family: FAMILY_QWEN_IMAGE.into(),
            revision: "r".into(),
            dir: dir.to_string_lossy().into_owned(),
            files: entries,
        }
        .verify("image")
        .unwrap()
    }

    fn load_error(files: &VerifiedFiles) -> ErrorBody {
        match QwenImage::load(files, Device::Cpu) {
            Ok(_) => panic!("不该加载成功"),
            Err(error) => error.downcast_ref::<ErrorBody>().expect("ErrorBody").clone(),
        }
    }

    #[test]
    fn load_reports_files_missing_from_the_manifest_as_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        let files = component(dir.path(), &[("processor/tokenizer.json", b"{}")]);
        let error = load_error(&files);
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert!(error.message.contains("scheduler/scheduler_config.json"), "{}", error.message);
    }

    #[test]
    fn load_rejects_a_bundle_that_is_not_the_mlx_four_bit_layout() {
        let dir = tempfile::tempdir().unwrap();
        let files = component(
            dir.path(),
            &[
                ("processor/tokenizer.json", b"{}"),
                ("scheduler/scheduler_config.json", b"{}"),
                ("model_index.json", br#"{"_class_name":"QwenImagePipeline"}"#),
                ("transformer/config.json", b"{}"),
                ("text_encoder/config.json", b"{}"),
                ("text_encoder/model.safetensors", b"x"),
                ("transformer/model.safetensors", b"x"),
                ("vae/model.safetensors", b"x"),
                ("vae/config.json", b"{}"),
            ],
        );
        let error = load_error(&files);
        assert_eq!(error.code, codes::MODEL_UNSUPPORTED);
        assert_eq!(error.details.unwrap()["reason"], "unsupported-config");
    }

    #[test]
    fn config_check_accepts_the_published_layout() {
        let model_index = json!({ "_class_name": "QwenImage21Pipeline" });
        let transformer = json!({
            "_class_name": "QwenImage21Transformer2DModel",
            "attention_head_dim": 128,
            "context_in_dim": 4096,
            "in_channels": 64,
            "num_attention_heads": 32,
            "num_layers": 32,
            "out_channels": 64,
            "patch_size": 1,
            "mlx_format": true,
            "quantization": { "bits": 4, "group_size": 64, "mode": "affine" },
        });
        let text = json!({
            "mlx_format": true,
            "quantization": { "bits": 4, "group_size": 64, "mode": "affine" },
            "text_config": {
                "hidden_size": 4096,
                "intermediate_size": 12288,
                "num_hidden_layers": 36,
                "num_attention_heads": 32,
                "num_key_value_heads": 8,
                "head_dim": 128,
                "rope_theta": 5_000_000,
            },
        });
        verify_model_config(&model_index, &transformer, &text).unwrap();
        let mut eight_bit = transformer.clone();
        eight_bit["quantization"]["bits"] = json!(8);
        assert!(verify_model_config(&model_index, &eight_bit, &text).is_err());
    }

    /// Assembles the `image` component from `.ccut-manifest.json` (read-only; does not write install records).
    fn installed(root: &Path) -> VerifiedFiles {
        let dir = root.join("mlx-community/Qwen-Image-2.1-MLX-4bit");
        let manifest: Value =
            serde_json::from_slice(&std::fs::read(dir.join(".ccut-manifest.json")).expect("read .ccut-manifest.json")).unwrap();
        let files = manifest["files"]
            .as_array()
            .unwrap()
            .iter()
            .map(|file| FileEntry {
                path: file["path"].as_str().unwrap().into(),
                sha256: file["sha256"].as_str().unwrap_or_default().into(),
                byte_length: file["size"].as_u64().unwrap(),
            })
            .collect();
        ModelFiles {
            family: FAMILY_QWEN_IMAGE.into(),
            revision: manifest["revision"].as_str().unwrap().into(),
            dir: dir.to_string_lossy().into_owned(),
            files,
        }
        .verify("image")
        .unwrap()
    }

    /// Real run (needs installed weights; a few minutes on CPU): generates one image on candle's default device, and checks the size, the stages and reproduction with the same seed.
    /// To measure peak memory, the size and step count can be changed: `CUCCUT_TEST_IMAGE_EDGE=512`, `CUCCUT_TEST_IMAGE_STEPS=1` (the peak is independent of the step count).
    /// With `CUCCUT_TEST_IMAGE_REPEAT=0` the second image is skipped. `CCUT_IMAGE_TIMING=1` prints the time and memory of each stage.
    ///
    /// ```sh
    /// CUCCUT_TEST_MODELS_DIR=/path/to/models CCUT_IMAGE_TIMING=1 cargo test -p model-runtime --release \
    ///   --features backend-candle --lib -- --ignored candle_engine_generates --test-threads=1 --nocapture
    /// ```
    #[test]
    #[ignore = "需要 CUCCUT_TEST_MODELS_DIR 下装好的 Qwen-Image-2.1"]
    fn candle_engine_generates_and_reproduces_a_seed() {
        let root = std::env::var("CUCCUT_TEST_MODELS_DIR").expect("CUCCUT_TEST_MODELS_DIR");
        let files = installed(Path::new(&root));
        let env = |name: &str, default: u32| std::env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(default);
        let edge = env("CUCCUT_TEST_IMAGE_EDGE", 256);
        let steps = env("CUCCUT_TEST_IMAGE_STEPS", 2);
        let device = crate::backend::candle::default_device();
        let mut engine = QwenImage::load(&files, device).unwrap();
        let request = ImageRequest {
            prompt: "a red apple on a wooden table".into(),
            width: edge,
            height: edge,
            steps,
            seed: 7,
        };
        let mut phases = Vec::new();
        let started = Instant::now();
        let image = engine.generate(&request, &mut |p| phases.push(p), &|| false).unwrap();
        eprintln!("{edge}² {steps} 步：{:.1}s", started.elapsed().as_secs_f64());
        assert_eq!((image.width, image.height), (edge, edge));
        assert_eq!(image.pixels.len(), (edge * edge * 4) as usize);
        assert!(
            image.pixels.chunks_exact(4).any(|px| px[..3] != image.pixels[..3]),
            "不该是一种颜色"
        );
        assert_eq!(phases.first(), Some(&ImageProgress::EncodingPrompt));
        assert_eq!(phases.last(), Some(&ImageProgress::Decoding));
        assert!(phases.contains(&ImageProgress::Denoising { done: 0, total: steps }));
        assert!(phases.contains(&ImageProgress::Denoising { done: steps, total: steps }));
        if let Some(dir) = std::env::var_os("CUCCUT_TEST_OUTPUT_DIR") {
            let png = crate::image::png::encode_rgba(&image).unwrap();
            std::fs::write(Path::new(&dir).join(format!("qwen-image-candle-{edge}-seed7.png")), png).unwrap();
        }
        if env("CUCCUT_TEST_IMAGE_REPEAT", 1) != 0 {
            let again = engine.generate(&request, &mut |_| {}, &|| false).unwrap();
            assert_eq!(again.pixels, image.pixels, "同一 seed、同一设备应出同一张图");
        }
    }
}
