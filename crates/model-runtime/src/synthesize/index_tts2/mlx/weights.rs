//! Partly rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/MLXCommon/WeightLoading.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Weight table: reads safetensors per file or directory, takes tensors out by name, and provides
//! weight-norm fusion (matching the `fuseWeightNorm` semantics of speech-swift `MLXCommon/WeightLoading.swift`).

use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Result, bail};
use std::collections::HashMap;
use std::path::Path;

pub struct WeightMap {
    map: HashMap<String, Array>,
    name: String,
}

impl WeightMap {
    /// Reads a single safetensors file.
    pub fn load_file(path: &Path) -> Result<Self> {
        let map = Array::load_safetensors(path).map_err(|e| anyhow::anyhow!("读取 {} 失败：{e}", path.display()))?;
        Ok(Self {
            map,
            name: path.display().to_string(),
        })
    }

    /// Builds from in-memory tensors (for tests).
    #[cfg(test)]
    pub fn from_arrays(name: &str, arrays: impl IntoIterator<Item = (String, Array)>) -> Self {
        Self {
            map: arrays.into_iter().collect(),
            name: name.to_string(),
        }
    }

    pub fn contains(&self, key: &str) -> bool {
        self.map.contains_key(key)
    }

    /// Borrows a tensor (without removing it).
    pub fn get(&self, key: &str) -> Option<&Array> {
        self.map.get(key)
    }

    /// Takes a tensor out (original dtype).
    pub fn take(&mut self, key: &str) -> Result<Array> {
        match self.map.remove(key) {
            Some(array) => Ok(array),
            None => bail!("{} 缺少权重 {key}", self.name),
        }
    }

    pub fn take_optional(&mut self, key: &str) -> Option<Array> {
        self.map.remove(key)
    }

    /// Takes a tensor out and converts it to f32.
    pub fn take_f32(&mut self, key: &str) -> Result<Array> {
        let array = self.take(key)?;
        Ok(array.as_dtype(Dtype::Float32)?)
    }

    pub fn take_optional_f32(&mut self, key: &str) -> Result<Option<Array>> {
        if self.map.contains_key(key) {
            Ok(Some(self.take(key)?.as_dtype(Dtype::Float32)?))
        } else {
            Ok(None)
        }
    }

    /// Keeps only keys starting with `prefix` and strips the prefix.
    pub fn retain_prefix(&mut self, prefix: &str) {
        let old = std::mem::take(&mut self.map);
        for (key, value) in old {
            if let Some(rest) = key.strip_prefix(prefix) {
                self.map.insert(rest.to_string(), value);
            }
        }
    }

    /// Takes the weight-norm (g, v) pair and fuses it into an f32 weight; checkpoints that are already fused
    /// (only `{prefix}.weight`) take that weight directly.
    pub fn take_weight_norm(&mut self, prefix: &str) -> Result<Array> {
        let v_key = format!("{prefix}.weight_v");
        if !self.map.contains_key(&v_key) {
            let fused = format!("{prefix}.weight");
            if self.map.contains_key(&fused) {
                return self.take_f32(&fused);
            }
        }
        let g = self.take(&format!("{prefix}.weight_g"))?;
        let v = self.take(&v_key)?;
        fuse_weight_norm(&g, &v)
    }

    pub fn insert(&mut self, key: impl Into<String>, array: Array) {
        self.map.insert(key.into(), array);
    }

    /// All current keys (returned sorted, for deterministic iteration).
    pub fn keys(&self) -> Vec<String> {
        let mut keys: Vec<String> = self.map.keys().cloned().collect();
        keys.sort();
        keys
    }

    /// Renames a key; does nothing if the source key does not exist.
    pub fn rename(&mut self, from: &str, to: impl Into<String>) {
        if let Some(array) = self.map.remove(from) {
            self.map.insert(to.into(), array);
        }
    }

    /// Applies one renaming map to all keys (keys for which it returns `None` stay unchanged).
    pub fn rename_all(&mut self, mut rename: impl FnMut(&str) -> Option<String>) {
        let old = std::mem::take(&mut self.map);
        for (key, value) in old {
            let key = rename(&key).unwrap_or(key);
            self.map.insert(key, value);
        }
    }

    /// Calls `f` on every key and replaces the tensor with the returned value.
    pub fn map_arrays(&mut self, mut f: impl FnMut(&str, Array) -> Result<Array>) -> Result<()> {
        let old = std::mem::take(&mut self.map);
        for (key, value) in old {
            let value = f(&key, value)?;
            self.map.insert(key, value);
        }
        Ok(())
    }
}

/// `w = g * v / ||v||`, with the norm computed over all dimensions except dimension 0 (PyTorch `weight_norm(dim=0)`).
pub fn fuse_weight_norm(g: &Array, v: &Array) -> Result<Array> {
    let v32 = v.as_dtype(Dtype::Float32)?;
    let g32 = g.as_dtype(Dtype::Float32)?;
    let out = v32.dim(0);
    let flat = v32.reshape(&[out, -1])?;
    let norm = flat.square()?.sum_axis(1, true)?.sqrt()?;
    let mut shape = vec![1i32; v32.ndim()];
    shape[0] = out;
    let norm = norm.reshape(&shape)?;
    let g32 = g32.reshape(&shape)?;
    Ok(&v32 * (g32 / (norm + 1e-9f32)))
}
