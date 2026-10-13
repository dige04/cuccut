//! Partly rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/IndexTTS2TTS/IndexTTS2Wav2Vec2Bert.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! w2v-BERT 2.0 encoder (cross-checked against speech-swift `IndexTTS2Wav2Vec2Bert.swift`).
//!
//! Only the hidden states of the first 17 layers are used. Relative position attention follows the `relative_key` approach of HF `Wav2Vec2BertSelfAttention`:
//! `ids = clamp(j - i, -64, 8) + 64`. The Swift version broadcasts `q[..., None, :] * pos` and sums it, which allocates ~2 GB of intermediate data at T≈750; here it is replaced by an
//! equivalent batched matrix multiply (`rel[b,h,i,j] = Σ_d q[b,h,i,d]·pos[i,j,d]`), with identical results.

use super::layers::{Conv1d, LayerNorm, Linear, act};
use super::weights::WeightMap;
use crate::synthesize::tensor::fast::{self, ScaledDotProductAttentionMask};
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype, ops};
use anyhow::Result;

const HIDDEN: i32 = 1024;
const HEADS: i32 = 16;
const HEAD_SIZE: i32 = 64;
const CONV_KERNEL: i32 = 31;
const LN_EPS: f32 = 1e-5;
const LEFT_MAX: i32 = 64;
const RIGHT_MAX: i32 = 8;
pub const USED_LAYERS: usize = 17;

struct FeedForward {
    intermediate: Linear,
    output: Linear,
}

impl FeedForward {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            intermediate: Linear::load(w, &format!("{prefix}.intermediate_dense"))?,
            output: Linear::load(w, &format!("{prefix}.output_dense"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = act::silu(&self.intermediate.forward(x)?)?;
        self.output.forward(&h)
    }
}

struct ConvModule {
    layer_norm: LayerNorm,
    pointwise_conv1: Conv1d,
    depthwise_conv: Conv1d,
    depthwise_layer_norm: LayerNorm,
    pointwise_conv2: Conv1d,
}

impl ConvModule {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            layer_norm: LayerNorm::load(w, &format!("{prefix}.layer_norm"), LN_EPS)?,
            pointwise_conv1: Conv1d::load(w, &format!("{prefix}.pointwise_conv1"))?,
            depthwise_conv: Conv1d::load(w, &format!("{prefix}.depthwise_conv"))?.with_groups(HIDDEN),
            depthwise_layer_norm: LayerNorm::load(w, &format!("{prefix}.depthwise_layer_norm"), LN_EPS)?,
            pointwise_conv2: Conv1d::load(w, &format!("{prefix}.pointwise_conv2"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = self.layer_norm.forward(x)?;
        let h = self.pointwise_conv1.forward_nlc(&h)?;
        // GLU: the first half is multiplied by sigmoid(second half).
        let gate = h.index((.., .., 0..HIDDEN)) * ops::sigmoid(h.index((.., .., HIDDEN..(HIDDEN * 2))))?;
        let h = ops::pad(&gate, &[(0, 0), (CONV_KERNEL - 1, 0), (0, 0)], None, None)?;
        let h = self.depthwise_conv.forward_nlc(&h)?;
        let h = self.depthwise_layer_norm.forward(&h)?;
        let h = act::silu(&h)?;
        self.pointwise_conv2.forward_nlc(&h)
    }
}

struct SelfAttention {
    linear_q: Linear,
    linear_k: Linear,
    linear_v: Linear,
    linear_out: Linear,
    distance_embedding: Array,
}

impl SelfAttention {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            linear_q: Linear::load(w, &format!("{prefix}.linear_q"))?,
            linear_k: Linear::load(w, &format!("{prefix}.linear_k"))?,
            linear_v: Linear::load(w, &format!("{prefix}.linear_v"))?,
            linear_out: Linear::load(w, &format!("{prefix}.linear_out"))?,
            distance_embedding: w.take_f32(&format!("{prefix}.distance_embedding.weight"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let b = x.dim(0);
        let t = x.dim(1);
        let scale = 1.0 / (HEAD_SIZE as f32).sqrt();
        let q = self
            .linear_q
            .forward(x)?
            .reshape(&[b, t, HEADS, HEAD_SIZE])?
            .transpose_axes(&[0, 2, 1, 3])?;
        let k = self
            .linear_k
            .forward(x)?
            .reshape(&[b, t, HEADS, HEAD_SIZE])?
            .transpose_axes(&[0, 2, 1, 3])?;
        let v = self
            .linear_v
            .forward(x)?
            .reshape(&[b, t, HEADS, HEAD_SIZE])?
            .transpose_axes(&[0, 2, 1, 3])?;

        let rel = self.relative_key_scores(&q, b, t)? * scale;
        // The softmax inside SDPA is computed in f32, and the float mask is an additive bias: equivalent to
        // softmax(q·kᵀ·scale + rel·scale).
        let out = fast::scaled_dot_product_attention(&q, &k, &v, scale, ScaledDotProductAttentionMask::Array(&rel), None)?;
        let out = out.transpose_axes(&[0, 2, 1, 3])?.reshape(&[b, t, HIDDEN])?;
        self.linear_out.forward(&out)
    }

    /// `rel[b,h,i,j] = Σ_d q[b,h,i,d] · pos[i,j,d]`，`pos = distance_embedding[ids]`。
    fn relative_key_scores(&self, q: &Array, b: i32, t: i32) -> Result<Array> {
        let mut ids = Vec::with_capacity((t * t) as usize);
        for i in 0..t {
            for j in 0..t {
                ids.push((j - i).clamp(-LEFT_MAX, RIGHT_MAX) + LEFT_MAX);
            }
        }
        let distance = Array::from_slice(&ids, &[t, t]);
        let positional = self.distance_embedding.index(&distance).as_dtype(q.dtype())?; // [T, T, D]
        let q_t = q.transpose_axes(&[2, 0, 1, 3])?.reshape(&[t, b * HEADS, HEAD_SIZE])?; // [T, B*H, D]
        let pos_t = positional.transpose_axes(&[0, 2, 1])?; // [T, D, T]
        let rel = ops::matmul(&q_t, &pos_t)?; // [T, B*H, T]
        Ok(rel.reshape(&[t, b, HEADS, t])?.transpose_axes(&[1, 2, 0, 3])?)
    }
}

struct EncoderLayer {
    ffn1_layer_norm: LayerNorm,
    ffn1: FeedForward,
    self_attn_layer_norm: LayerNorm,
    self_attn: SelfAttention,
    conv_module: ConvModule,
    ffn2_layer_norm: LayerNorm,
    ffn2: FeedForward,
    final_layer_norm: LayerNorm,
}

impl EncoderLayer {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            ffn1_layer_norm: LayerNorm::load(w, &format!("{prefix}.ffn1_layer_norm"), LN_EPS)?,
            ffn1: FeedForward::load(w, &format!("{prefix}.ffn1"))?,
            self_attn_layer_norm: LayerNorm::load(w, &format!("{prefix}.self_attn_layer_norm"), LN_EPS)?,
            self_attn: SelfAttention::load(w, &format!("{prefix}.self_attn"))?,
            conv_module: ConvModule::load(w, &format!("{prefix}.conv_module"))?,
            ffn2_layer_norm: LayerNorm::load(w, &format!("{prefix}.ffn2_layer_norm"), LN_EPS)?,
            ffn2: FeedForward::load(w, &format!("{prefix}.ffn2"))?,
            final_layer_norm: LayerNorm::load(w, &format!("{prefix}.final_layer_norm"), LN_EPS)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = self.ffn1.forward(&self.ffn1_layer_norm.forward(x)?)? * 0.5f32 + x;
        let h = self.self_attn.forward(&self.self_attn_layer_norm.forward(&h)?)? + &h;
        let h = self.conv_module.forward(&h)? + &h;
        let h = self.ffn2.forward(&self.ffn2_layer_norm.forward(&h)?)? * 0.5f32 + &h;
        self.final_layer_norm.forward(&h)
    }
}

pub struct Wav2Vec2Bert {
    feature_layer_norm: LayerNorm,
    feature_projection: Linear,
    layers: Vec<EncoderLayer>,
}

impl Wav2Vec2Bert {
    pub fn load(mut w: WeightMap) -> Result<Self> {
        let feature_layer_norm = LayerNorm::load(&mut w, "feature_projection.layer_norm", LN_EPS)?;
        let feature_projection = Linear::load(&mut w, "feature_projection.projection")?;
        let mut layers = Vec::with_capacity(USED_LAYERS);
        for i in 0..USED_LAYERS {
            layers.push(EncoderLayer::load(&mut w, &format!("encoder.layers.{i}"))?);
        }
        Ok(Self {
            feature_layer_norm,
            feature_projection,
            layers,
        })
    }

    /// Takes SeamlessM4T features `[B, T, 160]` and returns the layer-17 hidden states `[B, T, 1024]` (f32).
    pub fn hidden_state_17(&self, features: &Array) -> Result<Array> {
        let mut h = self
            .feature_projection
            .forward(&self.feature_layer_norm.forward(&features.as_dtype(Dtype::Float32)?)?)?;
        for layer in &self.layers {
            h = layer.forward(&h)?;
        }
        h.eval()?;
        Ok(h)
    }
}
