//! Part of the implementation is adapted from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/Qwen3TTS/TTSWeightLoading.swift / Sources/Qwen3TTS/TTSWeightLoading+Encoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources see `THIRD_PARTY_NOTICES.md` at the repository root.
//!
//! Qwen3-TTS weight store: on top of `crate::synthesize::tensor::host::load_safetensors`, provides lookup by prefix, F16→BF16 promotion, and layout correction.
//!
//! It does not directly reuse `crate::backend::mlx::qwen3::WeightStore`: that store cannot promote dtypes before the loading layer (the CustomVoice-bf16 export actually stores F16, which must be promoted to BF16 at load time to decode incrementally in a stable way), and it cannot transpose convolution layouts (Speech Tokenizer weights use PyTorch layout).

use std::collections::HashMap;
use std::path::Path;

use crate::synthesize::tensor::host::load_safetensors;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Context, Result, bail};

/// Loaded weight set; keys are taken out and removed from the map, so that unconsumed keys can be checked at the end.
pub struct Weights {
    tensors: HashMap<String, Array>,
}

impl Weights {
    /// Loads the safetensors files listed in the manifest; when `promote_f16` is true, F16 tensors are promoted to BF16.
    pub fn load(files: &[&Path], promote_f16: bool) -> Result<Self> {
        let mut tensors = load_safetensors(files)?;
        if promote_f16 {
            let mut promoted = Vec::new();
            for (key, value) in tensors.iter() {
                if value.dtype() == Dtype::Float16 {
                    promoted.push((key.clone(), value.as_dtype(Dtype::Bfloat16)?));
                }
            }
            for (key, value) in promoted {
                tensors.insert(key, value);
            }
            crate::synthesize::tensor::transforms::eval(tensors.values())?;
        }
        Ok(Self { tensors })
    }

    /// Builds directly from a tensor map (for unit tests of synthesized weights; the VoxCPM2 / OmniVoice unit tests use it).
    #[cfg(test)]
    #[allow(dead_code)]
    pub fn from_tensors(tensors: HashMap<String, Array>) -> Self {
        Self { tensors }
    }

    /// Keys not yet taken (sorted); used after loading to check for weights that were not wired up (VoxCPM2).
    #[allow(dead_code)]
    pub fn keys(&self) -> Vec<String> {
        let mut keys: Vec<String> = self.tensors.keys().cloned().collect();
        keys.sort();
        keys
    }

    pub fn contains(&self, key: &str) -> bool {
        self.tensors.contains_key(key)
    }

    pub fn take(&mut self, key: &str) -> Result<Array> {
        self.tensors.remove(key).with_context(|| format!("缺少权重：{key}"))
    }

    pub fn take_optional(&mut self, key: &str) -> Option<Array> {
        self.tensors.remove(key)
    }

    /// Takes a Conv1d weight in PyTorch layout `[out, in, k]` and converts it to MLX layout `[out, k, in]`.
    /// Rule: transpose only when the shape is 3-D and `k != in`; `k == in` is treated as already in MLX layout
    /// (the speaker encoder's weights are exported already in MLX layout).
    pub fn take_conv1d(&mut self, key: &str, already_mlx: bool) -> Result<Array> {
        let weight = self.take(key)?;
        if already_mlx || weight.ndim() != 3 {
            return Ok(weight);
        }
        Ok(weight.transpose_axes(&[0, 2, 1])?)
    }

    /// Takes a ConvTranspose1d weight in PyTorch layout `[in, out, k]` and converts it to MLX layout `[out, k, in]`.
    pub fn take_conv_transpose1d(&mut self, key: &str) -> Result<Array> {
        let weight = self.take(key)?;
        if weight.ndim() != 3 {
            bail!("ConvTranspose1d 权重维度错误：{key} {:?}", weight.shape());
        }
        Ok(weight.transpose_axes(&[1, 2, 0])?)
    }

    /// Splits out a subset by prefix (the prefix is removed), used to separate talker / code_predictor / speaker_encoder.
    pub fn split_prefix(&mut self, prefix: &str) -> Weights {
        let mut taken = HashMap::new();
        let keys: Vec<String> = self.tensors.keys().filter(|key| key.starts_with(prefix)).cloned().collect();
        for key in keys {
            if let Some(value) = self.tensors.remove(&key) {
                taken.insert(key[prefix.len()..].to_string(), value);
            }
        }
        Weights { tensors: taken }
    }
}
