//! Lazy weights: `Array::load_safetensors` only parses the file header, and each array is read from the file on first evaluation
//! (MLX's `Load` is only implemented on the CPU stream; GPU ops wait for it via events).
//!
//! This does not go through the loader in [`crate::backend::mlx::runtime`]. That path (`load_safetensors_impl`) calls `configure_memory_cache()` on every entry, resetting the MLX cache limit to min(2 GiB, physical memory / 8).
//! Local image generation sets the limit per stage (DiT 256 MB, VAE 0; see [`super::engine::CacheLimit`]), and the text encoder and DiT reopen the lazy table for every layer.
//! Going through that loader would quietly reset the stage limit to 2 GiB at every layer, adding a full 2 GB to the footprint. `qwen3`'s `WeightStore::from_arrays` / `TextDecoder::load_with_prefix` do not touch the cache limit.
//!
//! The only difference from v2: v2 scans `*.safetensors` in a directory, whereas here the files are the ones the caller takes from the manifest ([`crate::bundle::VerifiedFiles::require_extension_in`]).

use anyhow::{Context, Result, bail};
use mlx_rs::Array;
use std::collections::HashMap;
use std::path::PathBuf;

use crate::backend::mlx::qwen3::WeightStore;

/// Opens the given safetensors shards, keeping only the tensors selected by `keep`, and evaluates none of them.
pub fn lazy(files: &[PathBuf], keep: impl Fn(&str) -> bool) -> Result<HashMap<String, Array>> {
    if files.is_empty() {
        bail!("no safetensors files");
    }
    let mut map = HashMap::new();
    for (index, f) in files.iter().enumerate() {
        let arrays = Array::load_safetensors(f).with_context(|| format!("read safetensors file {index}"))?;
        for (k, v) in arrays {
            if keep(&k) && map.insert(k.clone(), v).is_some() {
                bail!("duplicate weight key: {k}");
            }
        }
    }
    Ok(map)
}

/// Resident load: evaluates tensor by tensor (each command buffer is kept short to avoid the GPU watchdog).
pub fn resident(files: &[PathBuf], keep: impl Fn(&str) -> bool) -> Result<WeightStore> {
    into_resident(lazy(files, keep)?)
}

/// Evaluates the table opened by [`lazy`] tensor by tensor, then packs it into a `WeightStore`.
pub fn into_resident(map: HashMap<String, Array>) -> Result<WeightStore> {
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    for k in keys {
        map[k].eval()?;
    }
    WeightStore::from_arrays(map)
}
