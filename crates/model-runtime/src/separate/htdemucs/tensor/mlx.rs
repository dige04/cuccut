//! The tensor vocabulary used by the HTDemucs graph: MLX arrays and operators, plus this crate's Metal device, cache and weight reading.
//! This layer keeps `layers` / `transformer` / `model` written the same way as in v2.

pub use crate::backend::mlx::qwen3::gelu_same_dtype;
pub use crate::backend::mlx::runtime::{MemoryCacheGuard, configure_memory_cache, ensure_metal_device as ensure_device};
pub use mlx_rs::*;

use anyhow::Result;
use std::collections::HashMap;
use std::path::Path;

/// Reads safetensors without evaluating them immediately (as in v2: weights are only materialized on the first forward pass, and the fp16 → f32 upcast also happens then).
pub fn load_safetensors_deferred(files: &[&Path], keep: impl Fn(&str) -> bool) -> Result<HashMap<String, Array>> {
    crate::backend::mlx::runtime::load_safetensors_filtered_deferred(files, keep)
}
