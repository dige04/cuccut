//! Partly rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/IndexTTS2TTS/IndexTTS2SemanticCodec.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! MaskGCT semantic codebook (cross-checked against speech-swift `IndexTTS2SemanticCodec.swift`).
//!
//! Encoder: Vocos ConvNeXt backbone (1024 → 384, 12 blocks, LN eps 1e-6, exact GELU,
//! `gamma` scaling) + 384 → 1024 projection; quantizer: weight-norm in/out_project
//! (k=1 convolutions) and an `[8192, 8]` codebook; codes are picked by nearest neighbour after L2 normalization.

use super::layers::{Conv1d, LayerNorm, Linear, act};
use super::v25_weights;
use super::weights::WeightMap;
use crate::synthesize::tensor::ops::indexing::{IndexOp, argmax_axis};
use crate::synthesize::tensor::{Array, Dtype, ops};
use anyhow::{Result, ensure};

const DIM: i32 = 384;
const LN_EPS: f32 = 1e-6;
const NUM_BLOCKS: usize = 12;

struct ConvNeXtBlock {
    dwconv: Conv1d,
    norm: LayerNorm,
    pwconv1: Linear,
    pwconv2: Linear,
    gamma: Array,
}

impl ConvNeXtBlock {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            dwconv: Conv1d::load(w, &format!("{prefix}.dwconv"))?.with_padding(3).with_groups(DIM),
            norm: LayerNorm::load(w, &format!("{prefix}.norm"), LN_EPS)?,
            pwconv1: Linear::load(w, &format!("{prefix}.pwconv1"))?,
            pwconv2: Linear::load(w, &format!("{prefix}.pwconv2"))?,
            gamma: w.take_f32(&format!("{prefix}.gamma"))?,
        })
    }

    /// Input / output `[B, T, C]` (internally equivalent to a round trip through Swift's NCL layout).
    fn forward(&self, x: &Array) -> Result<Array> {
        let h = self.dwconv.forward_nlc(x)?;
        let h = self.norm.forward(&h)?;
        let h = self.pwconv1.forward(&h)?;
        let h = act::gelu(&h)?;
        let h = self.pwconv2.forward(&h)?;
        Ok(x + &self.gamma * h)
    }
}

pub struct SemanticEncoder {
    embed: Conv1d,
    norm: LayerNorm,
    blocks: Vec<ConvNeXtBlock>,
    final_layer_norm: LayerNorm,
    projection: Linear,
}

impl SemanticEncoder {
    /// `{prefix}.0` is the Vocos backbone and `{prefix}.1` is the 384 → 1024 projection (the encoder and the 2.5 decoder share this structure).
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        let mut blocks = Vec::with_capacity(NUM_BLOCKS);
        for i in 0..NUM_BLOCKS {
            blocks.push(ConvNeXtBlock::load(w, &format!("{prefix}.0.convnext.{i}"))?);
        }
        Ok(Self {
            embed: Conv1d::load(w, &format!("{prefix}.0.embed"))?.with_padding(3),
            norm: LayerNorm::load(w, &format!("{prefix}.0.norm"), LN_EPS)?,
            blocks,
            final_layer_norm: LayerNorm::load(w, &format!("{prefix}.0.final_layer_norm"), LN_EPS)?,
            projection: Linear::load(w, &format!("{prefix}.1"))?,
        })
    }

    /// Input `[B, T, 1024]`, output `[B, T, 1024]`.
    pub fn forward(&self, hidden: &Array) -> Result<Array> {
        let mut h = self.embed.forward_nlc(hidden)?;
        h = self.norm.forward(&h)?;
        for block in &self.blocks {
            h = block.forward(&h)?;
        }
        let h = self.final_layer_norm.forward(&h)?;
        self.projection.forward(&h)
    }
}

pub struct SemanticQuantizer {
    in_project: Conv1d,
    out_project: Conv1d,
    codebook: Array,
}

impl SemanticQuantizer {
    fn load(w: &mut WeightMap) -> Result<Self> {
        let prefix = "quantizer.quantizers.0";
        Ok(Self {
            in_project: Conv1d::load_weight_norm(w, &format!("{prefix}.in_project"))?,
            out_project: Conv1d::load_weight_norm(w, &format!("{prefix}.out_project"))?,
            codebook: w.take_f32(&format!("{prefix}.codebook.weight"))?,
        })
    }

    /// Codes `[B, T]` → embedding `[B, 1024, T]`.
    pub fn vq2emb(&self, codes: &Array) -> Result<Array> {
        let emb = self.codebook.index(codes); // [B, T, 8]
        Ok(self.out_project.forward_nlc(&emb)?.swap_axes(1, 2)?)
    }

    /// Encoder hidden states `[B, T, 1024]` → (codes `[B, T]` i32, prompt embedding `[B, T, 1024]`).
    pub fn quantize(&self, encoded: &Array) -> Result<(Array, Array)> {
        let b = encoded.dim(0);
        let t = encoded.dim(1);
        let projected = self.in_project.forward_nlc(encoded)?; // [B, T, 8]
        let flat = projected.reshape(&[-1, projected.dim(2)])?;
        let encodings = l2_normalize(&flat, 1)?;
        let table = l2_normalize(&self.codebook, 1)?;
        let table_t = table.t();
        let scaled = (&encodings * &encodings).sum_axis(1, true)?;
        let cross = ops::matmul(&encodings, &table_t)?;
        let table_sq = (&table_t * &table_t).sum_axis(0, true)?;
        let dist = -(scaled - cross * 2.0f32 + table_sq);
        let codes = argmax_axis(&dist, -1, None)?.as_dtype(Dtype::Int32)?.reshape(&[b, t])?;
        let quantized = self.out_project.forward_nlc(&self.codebook.index(&codes))?; // [B, T, 1024]
        codes.eval()?;
        quantized.eval()?;
        Ok((codes, quantized))
    }
}

fn l2_normalize(x: &Array, axis: i32) -> Result<Array> {
    Ok(x / ((x * x).sum_axis(axis, true)? + 1e-12f32).sqrt()?)
}

pub struct SemanticCodec {
    pub encoder: SemanticEncoder,
    pub quantizer: SemanticQuantizer,
}

impl SemanticCodec {
    pub fn load(mut w: WeightMap) -> Result<Self> {
        Ok(Self {
            encoder: SemanticEncoder::load(&mut w, "encoder")?,
            quantizer: SemanticQuantizer::load(&mut w)?,
        })
    }
}

/// IndexTTS 2.5 semantic codebook decoder (official `EnhancedCodec.decode`): codes → codebook embedding →
/// Vocos decoder backbone → time-axis ×2 repeat → k=3 convolution, producing 50 Hz S2Mel content features.
pub struct CodecDecoderV25 {
    backbone: SemanticEncoder,
    quantizer: SemanticQuantizer,
    up: Conv1d,
}

impl CodecDecoderV25 {
    /// Reads `codec.safetensors` from `mlx-community/IndexTTS-2.5-fp16` (MLX layout, remapped internally).
    pub fn load(mut w: WeightMap) -> Result<Self> {
        v25_weights::remap_codec(&mut w)?;
        Ok(Self {
            backbone: SemanticEncoder::load(&mut w, "decoder")?,
            quantizer: SemanticQuantizer::load(&mut w)?,
            up: Conv1d::load(&mut w, "up")?.with_padding(1),
        })
    }

    /// `N` semantic codes → content features `[1, 2N, 1024]`.
    pub fn decode(&self, codes: &[i32]) -> Result<Array> {
        ensure!(!codes.is_empty(), "IndexTTS 2.5 semantic codes are empty");
        let n = codes.len() as i32;
        let code_tensor = Array::from_slice(codes, &[1, n]);
        let embedded = self.quantizer.vq2emb(&code_tensor)?.swap_axes(1, 2)?; // [1, N, 1024]
        let hidden = self.backbone.forward(&embedded)?;
        let channels = hidden.dim(2);
        let repeated = ops::broadcast_to(&hidden.expand_dims(2)?, &[1, n, 2, channels])?.reshape(&[1, 2 * n, channels])?;
        let content = self.up.forward_nlc(&repeated)?;
        content.eval()?;
        Ok(content)
    }
}
