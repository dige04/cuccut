//! Shared parts of the MLX runtime: Metal device detection, cache limits, cache-clearing guards, weight reading, and memory snapshots.

use std::collections::HashMap;
use std::ffi::{c_char, c_int, c_void};
use std::path::Path;

use anyhow::{Context, Result, bail};
use mlx_rs::Array;
use mlx_rs::ops::indexing::IndexOp;

const MAX_CACHE_BYTES: usize = 2 << 30;
const PHYSICAL_MEMORY_CACHE_DIVISOR: usize = 8;

#[cfg(test)]
pub(crate) static MLX_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

unsafe extern "C" {
    fn sysctlbyname(
        name: *const c_char,
        old_value: *mut c_void,
        old_length: *mut usize,
        new_value: *mut c_void,
        new_length: usize,
    ) -> c_int;
}

#[link(name = "Metal", kind = "framework")]
unsafe extern "C" {
    fn MTLCreateSystemDefaultDevice() -> *mut c_void;
}

#[link(name = "objc")]
unsafe extern "C" {
    fn objc_release(object: *mut c_void);
}

/// Before entering MLX, first confirm that the system default Metal device exists.
///
/// In the sandbox, `MTLCreateSystemDefaultDevice()` returns nil, and MLX then throws a `metal::Device` initialization exception in C++.
/// That exception crossing mlx-c into Rust becomes `Rust cannot catch foreign exceptions`, which aborts the whole process.
/// Here we first probe with Metal's C entry point; if there is no device, return an ordinary error.
pub fn ensure_metal_device() -> Result<()> {
    // SAFETY: pure C entry point with no arguments; returns a +1 ObjC object or nil.
    let device = unsafe { MTLCreateSystemDefaultDevice() };
    if device.is_null() {
        bail!("no Metal device available (MTLCreateSystemDefaultDevice returned nil)");
    }
    // SAFETY: `device` is non-null and holds one reference from the create call above; release it here.
    unsafe { objc_release(device) };
    Ok(())
}

/// Caps the cache of MLX-freed buffers at the smaller of 2 GiB and 1/8 of physical memory.
///
/// By default MLX sets the cache based on the GPU's recommended working set, which is close to 10 GiB on a 16 GiB Mac. During transcription, many temporary
/// Metal buffers of different shapes are continually created. Without a cap, these freed-but-still-cached buffers push the process footprint above 11 GiB.
pub fn configure_memory_cache() -> Result<usize> {
    ensure_metal_device()?;
    let physical_memory = physical_memory_bytes().context("reading physical memory size")?;
    let limit = cache_limit_for_physical_memory(physical_memory);
    let mut previous_limit = 0;
    // SAFETY: `previous_limit` is a valid writable size_t pointer.
    let status = unsafe { mlx_sys::mlx_set_cache_limit(&mut previous_limit, limit) };
    if status != 0 {
        bail!("mlx_set_cache_limit failed (status {status})");
    }
    Ok(limit)
}

/// Immediately returns MLX's freed Metal buffers to the system.
pub fn clear_memory_cache() -> Result<()> {
    // SAFETY: no arguments; active buffers still in use by the model are not freed.
    let status = unsafe { mlx_sys::mlx_clear_cache() };
    if status != 0 {
        bail!("mlx_clear_cache failed (status {status})");
    }
    Ok(())
}

/// When the scope ends (success, failure or early return), releases the MLX temporary cache left by this round of inference.
#[derive(Default)]
pub struct MemoryCacheGuard;

impl MemoryCacheGuard {
    pub fn new() -> Self {
        Self
    }
}

impl Drop for MemoryCacheGuard {
    fn drop(&mut self) {
        let _ = clear_memory_cache();
    }
}

/// Model lifecycle cleanup; placed as the last field of the model struct so the weights are dropped first. Metal availability must be confirmed before construction.
/// Unlike the per-segment [`MemoryCacheGuard`], unloading must also wait for the GPU to finish: commands submitted by eval may still hold arrays,
/// otherwise they would return to the cache after clear.
pub struct ModelMemoryCacheGuard;

impl Drop for ModelMemoryCacheGuard {
    fn drop(&mut self) {
        let stream = mlx_rs::Stream::task_local_or_default();
        // SAFETY: the stream lives for the duration of this call; it waits only for work already submitted on that stream.
        unsafe {
            let _ = mlx_sys::mlx_synchronize(stream.as_ptr());
        }
        let _ = clear_memory_cache();
    }
}

fn cache_limit_for_physical_memory(physical_memory: usize) -> usize {
    MAX_CACHE_BYTES.min(physical_memory / PHYSICAL_MEMORY_CACHE_DIVISOR)
}

/// Physical memory of this machine (bytes).
pub fn physical_memory_bytes() -> Result<usize> {
    let mut value = 0_u64;
    let mut length = size_of::<u64>();
    // SAFETY: `hw.memsize` is a NUL-terminated constant; the output buffer and length are valid, and no write-value argument is passed.
    let status = unsafe {
        sysctlbyname(
            c"hw.memsize".as_ptr(),
            (&mut value as *mut u64).cast(),
            &mut length,
            std::ptr::null_mut(),
            0,
        )
    };
    if status != 0 || length != size_of::<u64>() {
        bail!("sysctl hw.memsize failed (status {status}, length {length})");
    }
    usize::try_from(value).context("physical memory size overflows usize")
}

/// Reads and merges the given safetensors files (reads only these files, does not scan the directory). A duplicate key is an error.
pub fn load_safetensors(files: &[&Path]) -> Result<HashMap<String, Array>> {
    load_safetensors_impl(files, |_| true, WeightEvaluation::Batch)
}

/// Reads the given safetensors but keeps only the matching tensors. MLX's safetensors reading is lazy;
/// dropping unmatched arrays before `eval` prevents multimodal snapshots like Qwen2.5-Omni from moving the vision tower,
/// audio tower, Talker and LM head into unified memory.
pub fn load_safetensors_filtered(files: &[&Path], keep: impl Fn(&str) -> bool) -> Result<HashMap<String, Array>> {
    load_safetensors_impl(files, keep, WeightEvaluation::PerTensor)
}

/// Internal streaming conversion entry point. The caller must evaluate bounded
/// groups before returning a model, rather than one graph spanning the checkpoint.
pub(crate) fn load_safetensors_filtered_deferred(files: &[&Path], keep: impl Fn(&str) -> bool) -> Result<HashMap<String, Array>> {
    load_safetensors_impl(files, keep, WeightEvaluation::Deferred)
}

enum WeightEvaluation {
    Batch,
    PerTensor,
    Deferred,
}

fn load_safetensors_impl(files: &[&Path], keep: impl Fn(&str) -> bool, evaluation: WeightEvaluation) -> Result<HashMap<String, Array>> {
    configure_memory_cache()?;
    if files.is_empty() {
        bail!("no safetensors files listed");
    }
    let mut weights = HashMap::new();
    for (index, path) in files.iter().enumerate() {
        let loaded = Array::load_safetensors(path).with_context(|| format!("loading safetensors file #{index}"))?;
        for (key, value) in loaded {
            if !keep(&key) {
                continue;
            }
            if weights.insert(key.clone(), value).is_some() {
                bail!("duplicate weight key: {key}");
            }
        }
    }
    if matches!(evaluation, WeightEvaluation::PerTensor) {
        // Don't stuff several GB of the Omni text backbone into a single Metal command buffer. On a 16 GiB M2,
        // evaluating the whole batch occasionally trips macOS's GPU watchdog. Materializing tensor by tensor gives the same peak, but each
        // command buffer is short enough, so model loading is repeatable.
        let mut keys = weights.keys().collect::<Vec<_>>();
        keys.sort();
        for key in keys {
            weights[key].eval()?;
        }
    } else if matches!(evaluation, WeightEvaluation::Batch) {
        mlx_rs::transforms::eval(weights.values())?;
    }
    Ok(weights)
}

/// MLX-side memory snapshot (active / cache / peak, bytes).
pub fn memory_snapshot() -> (usize, usize, usize) {
    let mut active = 0_usize;
    let mut cache = 0_usize;
    let mut peak = 0_usize;
    // SAFETY: all three pointers point to valid size_t values; on query failure they stay 0.
    unsafe {
        let _ = mlx_sys::mlx_get_active_memory(&mut active);
        let _ = mlx_sys::mlx_get_cache_memory(&mut cache);
        let _ = mlx_sys::mlx_get_peak_memory(&mut peak);
    }
    (active, cache, peak)
}

/// When `CCUT_SPEECH_TIMING=1`, prints per-stage timings to stderr (for benchmarking and diagnostics).
pub use crate::backend::speech_timing_enabled;

/// Triggers a minimal Metal computation to verify the MLX runtime (v2's `ccut doctor` used it; v3 has no caller until the diagnostic entry point is wired in).
///
/// Passes [`ensure_metal_device`] first: without a device it returns an error instead of letting MLX abort the process.
pub fn metal_probe() -> Result<()> {
    ensure_metal_device()?;
    let values = Array::from_slice(&[1.0_f32, 2.0, 3.0, 4.0], &[2, 2]);
    let output = mlx_rs::ops::matmul(&values, values.t())?;
    output.eval()?;
    let item = output.index((0, 0)).try_item::<f32>()?;
    if (item - 5.0).abs() > 1e-5 {
        bail!("MLX Metal probe returned an unexpected value: {item}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use mlx_rs::builder::Builder;
    use mlx_rs::fast;
    use mlx_rs::module::Module;
    use mlx_rs::nn::{Conv1dBuilder, Conv2dBuilder, QuantizedLinearBuilder};
    use mlx_rs::ops;
    use mlx_rs::transforms;

    #[test]
    fn metal_device_probe_is_a_plain_result() {
        // On a machine with a GPU this must return Ok; in the sandbox (no device) it must be an ordinary Err, not an abort.
        match ensure_metal_device() {
            Ok(()) => {}
            Err(error) => assert!(format!("{error:#}").contains("Metal"), "{error:#}"),
        }
    }

    #[test]
    fn cache_limit_is_the_smaller_of_2_gib_and_an_eighth_of_ram() {
        assert_eq!(cache_limit_for_physical_memory(16 << 30), 2 << 30);
        assert_eq!(cache_limit_for_physical_memory(8 << 30), 1 << 30);
        assert_eq!(cache_limit_for_physical_memory(64 << 30), MAX_CACHE_BYTES);
    }

    #[test]
    fn model_guard_flushes_weights_after_fields_drop() {
        let _lock = MLX_TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
        if ensure_metal_device().is_err() {
            return;
        }
        configure_memory_cache().unwrap();
        clear_memory_cache().unwrap();
        struct Model {
            weights: Array,
            _cache_guard: ModelMemoryCacheGuard,
        }
        let baseline = memory_snapshot().0;
        let model = Model {
            weights: Array::ones::<f32>(&[4 * 1024 * 1024]).unwrap(),
            _cache_guard: ModelMemoryCacheGuard,
        };
        model.weights.eval().unwrap();
        assert!(memory_snapshot().0 >= baseline + 16 * 1024 * 1024);
        drop(model);
        let (active, cache, _) = memory_snapshot();
        assert!(active <= baseline + 1024 * 1024, "active={active}");
        assert_eq!(cache, 0, "unloaded weights must not remain cached");
    }

    #[test]
    fn loads_only_the_listed_files_and_rejects_duplicate_keys() {
        let _lock = MLX_TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
        if ensure_metal_device().is_err() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let one = dir.path().join("one.safetensors");
        let two = dir.path().join("two.safetensors");
        let value = Array::from_slice(&[1.0_f32, 2.0], &[2]);
        Array::save_safetensors([("a", &value)], None, &one).unwrap();
        Array::save_safetensors([("a", &value)], None, &two).unwrap();
        let loaded = load_safetensors(&[one.as_path()]).unwrap();
        assert_eq!(loaded.keys().collect::<Vec<_>>(), ["a"]);
        assert!(load_safetensors(&[one.as_path(), two.as_path()]).is_err());
        assert!(load_safetensors(&[]).is_err());
    }

    #[test]
    fn filtered_loading_keeps_only_matching_keys_and_the_probe_runs() {
        let _lock = MLX_TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
        if ensure_metal_device().is_err() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("weights.safetensors");
        let value = Array::from_slice(&[1.0_f32, 2.0], &[2]);
        Array::save_safetensors([("keep.weight", &value), ("drop.weight", &value)], None, &file).unwrap();
        let filtered = load_safetensors_filtered(&[file.as_path()], |key| key.starts_with("keep.")).unwrap();
        assert_eq!(filtered.keys().collect::<Vec<_>>(), ["keep.weight"]);
        let deferred = load_safetensors_filtered_deferred(&[file.as_path()], |key| key.starts_with("drop.")).unwrap();
        assert_eq!(deferred.keys().collect::<Vec<_>>(), ["drop.weight"]);
        assert!(load_safetensors_filtered(&[], |_| true).is_err());
        metal_probe().unwrap();
    }

    #[test]
    fn mlx_operator_spike_covers_required_graph() {
        let _lock = MLX_TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
        if ensure_metal_device().is_err() {
            return;
        }
        let input = Array::from_slice(&[0.0_f32; 64], &[1, 1, 64]);
        let mut quantized = QuantizedLinearBuilder::new(64, 64).group_size(64).bits(4).build().unwrap();
        let linear = quantized.forward(&input).unwrap();

        let mut conv1d = Conv1dBuilder::new(1, 2, 3).padding(1).build().unwrap();
        let one_d = conv1d.forward(&Array::from_slice(&[0.0_f32; 8], &[1, 8, 1])).unwrap();
        let mut conv2d = Conv2dBuilder::new(1, 2, (3, 3)).padding((1, 1)).build().unwrap();
        let two_d = conv2d.forward(&Array::from_slice(&[0.0_f32; 16], &[1, 4, 4, 1])).unwrap();

        let gates = ops::split(&linear, 4, -1).unwrap();
        let recurrent = ops::tanh(ops::sigmoid(&gates[0]).unwrap()).unwrap();
        let query = Array::zeros::<f32>(&[1, 1, 2, 8]).unwrap();
        let attention = fast::scaled_dot_product_attention(&query, &query, &query, 8.0_f32.sqrt().recip(), None, None).unwrap();
        transforms::async_eval([&one_d, &two_d, &recurrent, &attention]).unwrap();
        transforms::eval([&one_d, &two_d, &recurrent, &attention]).unwrap();

        assert_eq!(one_d.shape(), vec![1, 8, 2]);
        assert_eq!(two_d.shape(), vec![1, 4, 4, 2]);
        assert_eq!(attention.shape(), vec![1, 1, 2, 8]);
    }
}
