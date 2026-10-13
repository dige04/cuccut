//! The MLX engine for Qwen-Image-2.1: loading (it only checks the manifest and reads the tokenizer vocabulary and scheduler config; it does not read the weights) and the orchestration of the three stages of one generation.
//!
//! MLX is a process-level singleton. The only process-level state a generation touches is the cache limit, which is set on entry via [`CacheLimit`] and restored on exit. After the engine is dropped, active memory falls back below [`UNLOADED_ACTIVE_MAX`] (checked by the real-run test). Differences from v2: weight files are fetched by manifest via [`VerifiedFiles`]. The mixed-precision development self-check option (which takes separate text-encoder and DiT directories) is not ported.

use std::path::PathBuf;
use std::time::Instant;

use anyhow::{Result, anyhow};
use mlx_rs::{Array, Dtype, memory, ops, random};

use super::dit::{Dit, Overflow, Precision};
use super::prompt::Prompter;
use super::scheduler::SchedulerConfig;
use super::{text_encoder, vae};
use crate::backend::mlx::runtime::{clear_memory_cache, ensure_metal_device, memory_snapshot};
use crate::bundle::{FAMILY_QWEN_IMAGE, VerifiedFiles};
use crate::image::{Cancelled, ImageEngine, ImageProgress, ImageRequest, RawImage};
use crate::protocol::{ErrorBody, codes};

/// The MLX free-buffer cap for the DiT stage (including text encoding). footprint = active + cache. The runtime default (physical memory / 8, which is 2 GB on a 16 GB machine) would make the footprint 2 GB higher than active memory. Each layer's weights and activations repeat layer by layer in the same sizes, so 256 MB is enough for the allocator to reuse them.
pub const DIT_CACHE_LIMIT: usize = 256 << 20;

/// The VAE stage keeps no free buffers. Each block's and strip's tensor sizes differ, so the cache is almost never reused and would only push the footprint up (v2 measured at 512²: 0.99 → 0.71 GB, with decoding time unchanged). DiT does not use 0: it would be about 5% slower per step, and the footprint peak is not in the DiT stage anyway.
pub const VAE_CACHE_LIMIT: usize = 0;

#[cfg(test)]
/// The upper bound on MLX active memory after the engine is dropped. The three weight sets, the conditions and the latents have all been dropped, leaving only MLX's own small residue. The threshold is 64 MB to tolerate jitter.
pub const UNLOADED_ACTIVE_MAX: usize = 64 << 20;

/// RAII for the cache limit. On entry it records the process's current limit and replaces it with this stage's. On exit (normal return, early return via `?`, and panic unwinding all count) it waits for the GPU to finish the work already submitted, then restores the original limit and clears the cache. Restoring is required: a later task on the same Worker must not inherit the VAE stage's 0.
pub struct CacheLimit {
    previous: usize,
}

impl CacheLimit {
    pub fn enter(limit: usize) -> Self {
        let previous = memory::set_cache_limit(limit);
        Self { previous }
    }

    /// Switches stage: sets the new limit and returns the free buffers left by the old stage to the system.
    pub fn phase(&self, limit: usize) -> Result<()> {
        memory::set_cache_limit(limit);
        clear_memory_cache()
    }

    /// The limit before entry (restored to this value on exit).
    #[cfg(test)]
    pub fn previous(&self) -> usize {
        self.previous
    }
}

impl Drop for CacheLimit {
    fn drop(&mut self) {
        synchronize();
        memory::set_cache_limit(self.previous);
        let _ = clear_memory_cache();
    }
}

/// Waits for the work already submitted on the default stream to finish. Commands submitted by eval may still hold arrays; without waiting, they would return to the cache only after the clear.
fn synchronize() {
    let stream = mlx_rs::Stream::task_local_or_default();
    // SAFETY: the stream lives for the duration of this call; it waits only for work already submitted on that stream.
    unsafe {
        let _ = mlx_sys::mlx_synchronize(stream.as_ptr());
    }
}

/// The process's current and lifetime-maximum phys_footprint (the basis of the “Memory” column in Activity Monitor, including Metal buffers).
pub fn footprint() -> (u64, u64) {
    // SAFETY: rusage_info_v4 is a plain data structure, so zero-initialization is valid; proc_pid_rusage fills it in for the flavor.
    unsafe {
        let mut info: libc::rusage_info_v4 = std::mem::zeroed();
        let rc = libc::proc_pid_rusage(
            libc::getpid(),
            libc::RUSAGE_INFO_V4,
            (&mut info as *mut libc::rusage_info_v4).cast(),
        );
        if rc != 0 {
            return (0, 0);
        }
        (info.ri_phys_footprint, info.ri_lifetime_max_phys_footprint)
    }
}

/// A new stage begins: the MLX peak is measured afresh from here, so the peak reported by [`mem`] is this stage's.
fn phase_start() {
    memory::reset_peak_memory();
}

/// When the timing switch is on, prints one line of memory snapshot.
fn mem(tag: &str) {
    if !super::timing() {
        return;
    }
    let (active, cache, peak) = memory_snapshot();
    let (fp, fp_max) = footprint();
    let gb = |v: u64| v as f64 / 1e9;
    eprintln!(
        "[mem] {tag}: active {:.2} GB, cache {:.2} GB, 阶段峰值 {:.2} GB｜footprint {:.2} GB，进程最大 {:.2} GB",
        gb(active as u64),
        gb(cache as u64),
        gb(peak as u64),
        gb(fp),
        gb(fp_max)
    );
}

/// `[1,H,W,4]`, range [-1,1] VAE output → 8-bit RGBA.
fn to_rgba(x: &Array) -> Result<RawImage> {
    if x.ndim() != 4 || x.dim(3) != 4 {
        return Err(anyhow!("VAE 输出形状不是 [1,H,W,4]：{:?}", x.shape()));
    }
    let (h, w) = (x.dim(1) as u32, x.dim(2) as u32);
    let y = x
        .as_dtype(Dtype::Float32)?
        .add(&Array::from_f32(1.0))?
        .multiply(&Array::from_f32(127.5))?;
    let y = ops::clip(&y, (0.0f32, 255.0f32))?.round(None)?;
    y.eval()?;
    let pixels: Vec<u8> = y.as_slice::<f32>().iter().map(|&v| v as u8).collect();
    Ok(RawImage {
        width: w,
        height: h,
        pixels,
    })
}

/// Production configuration (the default values of v2's `QwenOptions`; the development self-check comparison items are not ported).
#[derive(Debug, Clone)]
struct Options {
    /// `None` = auto: picks between f16 and bf16 based on measurements on this machine ([`Precision::probe`], measured once per engine).
    dit_dtype: Option<Dtype>,
    /// Quantized layers are fully dequantized and then multiplied as dense. Off by default.
    dit_dequant: bool,
    /// The number of image tokens per block in DiT's per-layer computation.
    dit_chunk: usize,
    /// The round-trip PSNR matches f32 and it is faster than bf16 (the M2 has no native bf16 arithmetic). If f16 decoding produces non-finite values, it is automatically re-decoded in bf16.
    vae_dtype: Dtype,
    /// Number of rows per strip in the VAE tail; `None` = chosen automatically.
    vae_tail_rows: Option<usize>,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            dit_dtype: None,
            dit_dequant: false,
            dit_chunk: 1024,
            vae_dtype: Dtype::Float16,
            vae_tail_rows: None,
        }
    }
}

/// Files fetched by manifest.
struct Files {
    text_encoder: Vec<PathBuf>,
    transformer: Vec<PathBuf>,
    vae: Vec<PathBuf>,
    vae_config: PathBuf,
}

/// Qwen-Image-2.1 engine. Loading does not read the weights: the three weight sets are opened per stage during each generation and dropped after use.
pub struct QwenImage {
    options: Options,
    files: Files,
    prompter: Prompter,
    scheduler: SchedulerConfig,
    /// The result of auto precision probing; measured once per engine.
    picked: Option<Dtype>,
}

fn check(cancel: &dyn Fn() -> bool) -> Result<()> {
    if cancel() {
        return Err(Cancelled.into());
    }
    Ok(())
}

fn owned(files: Vec<&std::path::Path>) -> Vec<PathBuf> {
    files.into_iter().map(PathBuf::from).collect()
}

impl QwenImage {
    /// Checks the manifest first (a missing file is `MODEL_NOT_INSTALLED`), then confirms the Metal device, and finally reads the tokenizer vocabulary and scheduler config.
    pub fn load(files: &VerifiedFiles) -> Result<Self> {
        let tokenizer = files.require("processor/tokenizer.json")?.to_path_buf();
        let scheduler = files.require("scheduler/scheduler_config.json")?.to_path_buf();
        let files = Files {
            text_encoder: owned(files.require_extension_in("text_encoder", "safetensors")?),
            transformer: owned(files.require_extension_in("transformer", "safetensors")?),
            vae: owned(files.require_extension_in("vae", "safetensors")?),
            vae_config: files.require("vae/config.json")?.to_path_buf(),
        };
        ensure_metal_device()?;
        let corrupt = |what: &str, e: anyhow::Error| {
            ErrorBody::new(codes::MODEL_NOT_INSTALLED, format!("{what} 读不出来：{e:#}"))
                .with_details(serde_json::json!({ "component": "image", "reason": "unreadable" }))
        };
        let prompter = Prompter::load(&tokenizer).map_err(|e| corrupt("processor/tokenizer.json", e))?;
        let scheduler = SchedulerConfig::load(&scheduler).map_err(|e| corrupt("scheduler/scheduler_config.json", e))?;
        Ok(Self {
            options: Options::default(),
            files,
            prompter,
            scheduler,
            picked: None,
        })
    }

    fn compute_dtype(&mut self) -> Result<Dtype> {
        if let Some(d) = self.options.dit_dtype.or(self.picked) {
            return Ok(d);
        }
        let t = Instant::now();
        let p = Precision::probe()?;
        let d = p.pick();
        trace!(
            "[dit] 精度探测 {:.2}s：4-bit 矩阵乘 f16 {:.1} ms、bf16 {:.1} ms → {d:?}",
            t.elapsed().as_secs_f64(),
            p.f16_ms,
            p.bf16_ms
        );
        clear_memory_cache()?;
        self.picked = Some(d);
        Ok(d)
    }

    fn run(&mut self, request: &ImageRequest, progress: &mut dyn FnMut(ImageProgress), cancel: &dyn Fn() -> bool) -> Result<RawImage> {
        let total = Instant::now();
        let (w, h, steps) = (request.width as usize, request.height as usize, request.steps as usize);
        let (gh, gw) = (h / 16, w / 16);
        let guard = CacheLimit::enter(DIT_CACHE_LIMIT);
        check(cancel)?;
        let compute = self.compute_dtype()?;

        // 1. Text encoding
        progress(ImageProgress::EncodingPrompt);
        let t0 = Instant::now();
        phase_start();
        let ids = self.prompter.t2i_ids(&request.prompt);
        let cond = text_encoder::encode_streaming(&self.files.text_encoder, &ids, self.prompter.drop_idx())?;
        clear_memory_cache()?;
        trace!(
            "[text] {} tokens（丢弃系统前缀 {}）→ {:?}，{:.1}s",
            ids.len(),
            self.prompter.drop_idx(),
            cond.shape(),
            t0.elapsed().as_secs_f64()
        );
        mem("after text");
        check(cancel)?;

        // 2. DiT denoising
        phase_start();
        let sigmas = self.scheduler.sigmas(steps, gh * gw);
        let prec = Precision {
            compute,
            dequant: self.options.dit_dequant,
        };
        let latents = match self.denoise(&cond, &sigmas, prec, request, progress, cancel) {
            // f16 has only a 5-bit exponent. If it overflows, rerun from scratch in bf16, which matches the reference pipeline (same seed).
            Err(e) if e.downcast_ref::<Overflow>().is_some() => {
                trace!("[dit] {e}，改用 bf16 重跑");
                clear_memory_cache()?;
                let prec = Precision {
                    compute: Dtype::Bfloat16,
                    ..prec
                };
                self.denoise(&cond, &sigmas, prec, request, progress, cancel)?
            }
            r => r?,
        };
        drop(cond);
        check(cancel)?;
        guard.phase(VAE_CACHE_LIMIT)?;

        // 3. VAE decoding
        progress(ImageProgress::Decoding);
        let t2 = Instant::now();
        phase_start();
        let lat = latents.reshape(&[1, gh as i32, gw as i32, vae::Z_DIM])?;
        drop(latents);
        let tail_rows = self.options.vae_tail_rows;
        let decode = |dtype| -> Result<RawImage> {
            let dec = vae::Decoder::load(&self.files.vae, &self.files.vae_config, dtype)?;
            to_rgba(&dec.decode_normalized(&lat, tail_rows)?)
        };
        let vae_dtype = self.options.vae_dtype;
        let image = match decode(vae_dtype) {
            // f16 has only a 5-bit exponent. If it overflows upward, re-decode in bf16, which has the same exponent range as f32.
            Err(e) if vae_dtype == Dtype::Float16 => {
                trace!("[vae] {e:#}，改用 bf16 重解");
                clear_memory_cache()?;
                decode(Dtype::Bfloat16)?
            }
            r => r?,
        };
        trace!("[vae] 解码 {:.1}s", t2.elapsed().as_secs_f64());
        mem("vae done");
        drop(lat);
        drop(guard);
        trace!(
            "{w}x{h} {steps} steps seed {}（总计 {:.1}s）",
            request.seed,
            total.elapsed().as_secs_f64()
        );
        Ok(image)
    }

    fn denoise(
        &self,
        cond: &Array,
        sigmas: &[f64],
        prec: Precision,
        request: &ImageRequest,
        progress: &mut dyn FnMut(ImageProgress),
        cancel: &dyn Fn() -> bool,
    ) -> Result<Array> {
        let (gh, gw) = (request.height as usize / 16, request.width as usize / 16);
        let t1 = Instant::now();
        let dit = Dit::load(&self.files.transformer, prec)?;
        trace!(
            "[dit] 加载 {:.1}s（{:?}{}）",
            t1.elapsed().as_secs_f64(),
            prec.compute,
            if prec.dequant { "，整层解量化" } else { "" }
        );
        mem("dit loaded");
        let mut cache = dit.prepare_text(cond, gh, gw)?;
        let key = random::key(request.seed)?;
        let mut x = random::normal::<f32>(&[1, (gh * gw) as i32, vae::Z_DIM], None, None, &key)?;
        let total = request.steps;
        progress(ImageProgress::Denoising { done: 0, total });
        for i in 0..total as usize {
            check(cancel)?;
            let ts = Instant::now();
            let v = dit.step(&mut cache, &x, sigmas[i], gh, gw, self.options.dit_chunk)?;
            let dt = (sigmas[i + 1] - sigmas[i]) as f32;
            x = x.add(&v.multiply(&Array::from_f32(dt))?)?;
            x.eval()?;
            trace!(
                "[dit] step {}/{total} sigma {:.4} {:.2}s",
                i + 1,
                sigmas[i],
                ts.elapsed().as_secs_f64()
            );
            progress(ImageProgress::Denoising { done: i as u32 + 1, total });
        }
        mem("dit done");
        Ok(x)
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
        let image = self.run(request, progress, cancel)?;
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

impl Drop for QwenImage {
    fn drop(&mut self) {
        synchronize();
        let _ = clear_memory_cache();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::mlx::runtime::MLX_TEST_LOCK;
    use crate::bundle::{FileEntry, ModelFiles};

    fn lock() -> std::sync::MutexGuard<'static, ()> {
        MLX_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn cache_limit_guard_restores_the_previous_limit_even_on_panic() {
        let _lock = lock();
        if ensure_metal_device().is_err() {
            return;
        }
        let base = memory::set_cache_limit(123 << 20);
        {
            let g = CacheLimit::enter(DIT_CACHE_LIMIT);
            assert_eq!(g.previous(), 123 << 20);
            g.phase(VAE_CACHE_LIMIT).unwrap();
        }
        assert_eq!(memory::set_cache_limit(123 << 20), 123 << 20);
        let r = std::panic::catch_unwind(|| {
            let _g = CacheLimit::enter(0);
            panic!("boom");
        });
        assert!(r.is_err());
        assert_eq!(memory::set_cache_limit(base), 123 << 20);
    }

    #[test]
    fn load_reports_files_missing_from_the_manifest_as_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("processor")).unwrap();
        std::fs::write(dir.path().join("processor/tokenizer.json"), b"{}").unwrap();
        let files = ModelFiles {
            family: FAMILY_QWEN_IMAGE.into(),
            revision: "r".into(),
            dir: dir.path().to_string_lossy().into_owned(),
            files: vec![FileEntry {
                path: "processor/tokenizer.json".into(),
                sha256: "0".repeat(64),
                byte_length: 2,
            }],
        }
        .verify("image")
        .unwrap();
        let error = match QwenImage::load(&files) {
            Ok(_) => panic!("不该加载成功"),
            Err(error) => error.downcast_ref::<ErrorBody>().expect("ErrorBody").clone(),
        };
        assert_eq!(error.code, codes::MODEL_NOT_INSTALLED);
        assert!(error.message.contains("scheduler/scheduler_config.json"), "{}", error.message);
    }

    /// Assembles the `image` component from `.ccut-manifest.json` (read-only; does not write install records).
    fn installed(root: &std::path::Path) -> VerifiedFiles {
        let dir = root.join("mlx-community/Qwen-Image-2.1-MLX-4bit");
        let manifest: serde_json::Value =
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

    /// Real run (needs installed weights; about 1 minute): generates one 256² image with 2 steps, and checks the size, the stages, that the cache limit was restored, and that active memory falls back after the engine is dropped.
    ///
    /// ```sh
    /// CUCCUT_TEST_MODELS_DIR=/path/to/models cargo test -p model-runtime --lib -- --ignored \
    ///   engine_releases_memory_and_restores_the_cache_limit --test-threads=1 --nocapture
    /// ```
    #[test]
    #[ignore = "需要 CUCCUT_TEST_MODELS_DIR 下装好的 Qwen-Image-2.1 与 Metal"]
    fn engine_releases_memory_and_restores_the_cache_limit() {
        let _lock = lock();
        let root = std::env::var("CUCCUT_TEST_MODELS_DIR").expect("CUCCUT_TEST_MODELS_DIR");
        let files = installed(std::path::Path::new(&root));
        // To measure peak memory, the size can be changed: `CUCCUT_TEST_IMAGE_EDGE=1024` (square, 2 steps; the peak is independent of the step count).
        let edge: u32 = std::env::var("CUCCUT_TEST_IMAGE_EDGE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(256);
        let before = memory::set_cache_limit(77 << 20);
        let mut engine = QwenImage::load(&files).unwrap();
        let request = ImageRequest {
            prompt: "a red apple on a wooden table".into(),
            width: edge,
            height: edge,
            steps: 2,
            seed: 7,
        };
        let mut phases = Vec::new();
        let image = engine.generate(&request, &mut |p| phases.push(p), &|| false).unwrap();
        assert_eq!((image.width, image.height), (edge, edge));
        assert_eq!(image.pixels.len(), (edge * edge * 4) as usize);
        assert_eq!(phases.first(), Some(&ImageProgress::EncodingPrompt));
        assert_eq!(phases.last(), Some(&ImageProgress::Decoding));
        assert!(phases.contains(&ImageProgress::Denoising { done: 0, total: 2 }));
        assert!(phases.contains(&ImageProgress::Denoising { done: 2, total: 2 }));
        drop(engine);
        let (active, cache, peak) = memory_snapshot();
        let (_, footprint_max) = footprint();
        eprintln!("析构后 MLX active {active} B、cache {cache} B、峰值 {peak} B；进程 footprint 最大 {footprint_max} B");
        assert!(active < UNLOADED_ACTIVE_MAX, "析构后活跃内存 {active} B");
        assert_eq!(cache, 0, "析构后缓存应已清空");
        assert_eq!(memory::set_cache_limit(before), 77 << 20, "缓存上限没还原");
    }
}
