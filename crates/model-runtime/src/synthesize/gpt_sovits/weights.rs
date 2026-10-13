//! Weight table: reads the safetensors files listed in the manifest, takes tensors out by name, and provides weight-norm fusion.
//!
//! Ported from v2 `ccut-tts::index_tts2::mlx::weights` (the copy shared by IndexTTS2 and GPT-SoVITS). Only the parts GPT-SoVITS uses are kept, and the Candle branch is removed. File reading now goes through [`crate::synthesize::tensor::host::load_safetensors`].
//! It has the same origin as the same-named weight table in IndexTTS2; once both are ported, they can be merged into one.

use crate::synthesize::tensor::host::load_safetensors;
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
        let map = load_safetensors(&[path]).map_err(|e| anyhow::anyhow!("failed to read {}: {e}", path.display()))?;
        Ok(Self {
            map,
            name: path.display().to_string(),
        })
    }

    /// Takes one tensor out (in its original dtype).
    pub fn take(&mut self, key: &str) -> Result<Array> {
        match self.map.remove(key) {
            Some(array) => Ok(array),
            None => bail!("{} is missing weight {key}", self.name),
        }
    }

    /// Takes one tensor out and converts it to f32.
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

    /// Takes the (g, v) pair of a weight-norm layer and fuses it into an f32 weight. For a checkpoint that is already fused
    /// (it only has `{prefix}.weight`), that weight is taken directly.
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
