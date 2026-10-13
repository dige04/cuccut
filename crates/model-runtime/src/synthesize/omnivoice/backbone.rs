//! Some implementations are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/OmniVoiceTTS/OmniVoiceBackbone.swift / Sources/OmniVoiceTTS/OmniVoiceDiffusion.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-bundle interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! OmniVoice backbone: Qwen3 bidirectional attention (no causal mask) + two embedding tables (text / 8-codebook audio) + audio output head. Checked against the official `OmniVoice._prepare_embed_inputs` / `forward` and `_predict_tokens_with_scoring`.
//!
//! On the MLX side, the embedding tables stay quantized: rows are fetched by id first, and only the fetched rows are dequantized (dequantizing the whole 151676×1024 table to F32 would take 600 MB); on the Candle side, rows are likewise fetched and then dequantized (`ops::dequantize` implements MLX semantics).

use crate::synthesize::qwen3_tts::layers::{Linear, RmsNorm, SwigluMlp};
use crate::synthesize::qwen3_tts::weights::Weights;
use crate::synthesize::tensor::fast;
use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::{IndexOp, argmax_axis};
use crate::synthesize::tensor::transforms::eval;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Result, bail, ensure};

use super::config::OmniVoiceConfig;

/// Embedding table: plain float, or MLX affine quantization (U32-packed + scales / biases).
enum Embedding {
    Float(Array),
    Quantized {
        weight: Array,
        scales: Array,
        biases: Array,
        group_size: i32,
        bits: i32,
    },
}

impl Embedding {
    fn load(weights: &mut Weights, prefix: &str, group_size: usize, bits: u32) -> Result<Self> {
        let weight = weights.take(&format!("{prefix}.weight"))?;
        match weights.take_optional(&format!("{prefix}.scales")) {
            Some(scales) => {
                ensure!(bits > 0, "weight {prefix} has scales but the config does not declare quantization bits");
                Ok(Self::Quantized {
                    weight,
                    scales,
                    biases: weights.take(&format!("{prefix}.biases"))?,
                    group_size: group_size as i32,
                    bits: bits as i32,
                })
            }
            None if weight.dtype() == Dtype::Uint32 => bail!("weight {prefix} is U32 but has no scales"),
            None => Ok(Self::Float(weight)),
        }
    }

    /// `ids` (1-D) → `[N, D]`, F32.
    fn forward(&self, ids: &Array) -> Result<Array> {
        Ok(match self {
            Self::Float(weight) => weight.take_axis(ids, 0)?.as_dtype(Dtype::Float32)?,
            Self::Quantized {
                weight,
                scales,
                biases,
                group_size,
                bits,
            } => ops::dequantize(
                weight.take_axis(ids, 0)?,
                scales.take_axis(ids, 0)?,
                &biases.take_axis(ids, 0)?,
                *group_size,
                *bits,
            )?
            .as_dtype(Dtype::Float32)?,
        })
    }
}

struct Layer {
    q: Linear,
    k: Linear,
    v: Linear,
    o: Linear,
    q_norm: RmsNorm,
    k_norm: RmsNorm,
    mlp: SwigluMlp,
    input_norm: RmsNorm,
    post_norm: RmsNorm,
}

pub struct Backbone {
    embed_tokens: Embedding,
    audio_embeddings: Embedding,
    layers: Vec<Layer>,
    norm: RmsNorm,
    audio_heads: Linear,
    heads: i32,
    kv_heads: i32,
    head_dim: i32,
    rope_theta: f32,
    pub codebooks: usize,
    pub audio_vocab: usize,
    pub mask_id: usize,
}

impl Backbone {
    pub fn load(weights: &mut Weights, config: &OmniVoiceConfig) -> Result<Self> {
        let (group, bits) = config.quant();
        let llm = &config.llm_config;
        ensure!(
            config.audio_mask_id + 1 == config.audio_vocab_size,
            "OmniVoice audio_mask_id must be the last audio vocabulary entry ({} / {})",
            config.audio_mask_id,
            config.audio_vocab_size
        );
        let eps = llm.rms_norm_eps;
        let mut layers = Vec::with_capacity(llm.num_hidden_layers);
        for i in 0..llm.num_hidden_layers {
            let p = format!("llm.layers.{i}");
            let a = format!("{p}.self_attn");
            layers.push(Layer {
                q: Linear::load(weights, &format!("{a}.q_proj"), group, bits)?,
                k: Linear::load(weights, &format!("{a}.k_proj"), group, bits)?,
                v: Linear::load(weights, &format!("{a}.v_proj"), group, bits)?,
                o: Linear::load(weights, &format!("{a}.o_proj"), group, bits)?,
                q_norm: RmsNorm::load(weights, &format!("{a}.q_norm"), eps)?,
                k_norm: RmsNorm::load(weights, &format!("{a}.k_norm"), eps)?,
                mlp: SwigluMlp::load(weights, &format!("{p}.mlp"), group, bits)?,
                input_norm: RmsNorm::load(weights, &format!("{p}.input_layernorm"), eps)?,
                post_norm: RmsNorm::load(weights, &format!("{p}.post_attention_layernorm"), eps)?,
            });
        }
        Ok(Self {
            embed_tokens: Embedding::load(weights, "llm.embed_tokens", group, bits)?,
            audio_embeddings: Embedding::load(weights, "audio_embeddings", group, bits)?,
            layers,
            norm: RmsNorm::load(weights, "llm.norm", eps)?,
            audio_heads: Linear::load(weights, "audio_heads", group, bits)?,
            heads: llm.num_attention_heads as i32,
            kv_heads: llm.num_key_value_heads as i32,
            head_dim: llm.head_dim() as i32,
            rope_theta: llm.rope_theta(),
            codebooks: config.num_audio_codebook,
            audio_vocab: config.audio_vocab_size,
            mask_id: config.audio_mask_id,
        })
    }

    /// Text positions: `embed_tokens(ids)` → `[1, N, D]`.
    pub fn embed_text(&self, ids: &[u32]) -> Result<Array> {
        let n = ids.len() as i32;
        Ok(self.embed_tokens.forward(&Array::from_slice(ids, &[n]))?.reshape(&[1, n, -1])?)
    }

    /// Audio positions: each of the 8 codebooks is offset by `i·audio_vocab`, looked up, and summed → `[1, frames, D]`.
    /// `codes` is `[codebooks, frames]` in row-major order (masked positions use `mask_id`, which has its own embedding).
    pub fn embed_audio(&self, codes: &[u32], frames: usize) -> Result<Array> {
        ensure!(
            codes.len() == self.codebooks * frames && frames > 0,
            "OmniVoice audio token count {} does not match {} codebooks × {frames} frames",
            codes.len(),
            self.codebooks
        );
        let shifted: Vec<u32> = codes
            .iter()
            .enumerate()
            .map(|(i, &c)| c + (i / frames * self.audio_vocab) as u32)
            .collect();
        let rows = self
            .audio_embeddings
            .forward(&Array::from_slice(&shifted, &[shifted.len() as i32]))?;
        Ok(rows.reshape(&[self.codebooks as i32, frames as i32, -1])?.sum_axis(0, true)?)
    }

    fn attention(&self, layer: &Layer, x: &Array) -> Result<Array> {
        let len = x.dim(1);
        let heads = |h: Array, n: i32| -> Result<Array> { Ok(h.reshape(&[1, len, n, self.head_dim])?) };
        let q = layer
            .q_norm
            .forward(&heads(layer.q.forward(x)?, self.heads)?)?
            .transpose_axes(&[0, 2, 1, 3])?;
        let k = layer
            .k_norm
            .forward(&heads(layer.k.forward(x)?, self.kv_heads)?)?
            .transpose_axes(&[0, 2, 1, 3])?;
        let v = heads(layer.v.forward(x)?, self.kv_heads)?.transpose_axes(&[0, 2, 1, 3])?;
        let q = fast::rope(&q, self.head_dim, false, self.rope_theta, 1.0, 0, None)?;
        let k = fast::rope(&k, self.head_dim, false, self.rope_theta, 1.0, 0, None)?;
        let scale = (self.head_dim as f32).sqrt().recip();
        // Official inference passes an attention mask that is all True: bidirectional, no causality.
        let out = fast::scaled_dot_product_attention(&q, &k, &v, scale, None, None)?;
        let merged = out.transpose_axes(&[0, 2, 1, 3])?.reshape(&[1, len, self.heads * self.head_dim])?;
        layer.o.forward(&merged)
    }

    /// Passes the full embedding sequence `[1, L, D]` through the backbone, and produces audio logits only for the last `tail` positions:
    /// `[codebooks, tail, audio_vocab]` (F32). Position ids start from 0.
    pub fn logits(&self, embeds: &Array, tail: usize) -> Result<Array> {
        let mut h = embeds.clone();
        for layer in &self.layers {
            let attn = self.attention(layer, &layer.input_norm.forward(&h)?)?;
            h = h.add(&attn)?;
            let mlp = layer.mlp.forward(&layer.post_norm.forward(&h)?)?;
            h = h.add(&mlp)?;
        }
        let len = h.dim(1);
        let tail = tail as i32;
        ensure!(tail > 0 && tail <= len, "OmniVoice target length {tail} exceeds sequence {len}");
        let h = self.norm.forward(&h.index((.., len - tail.., ..)))?;
        Ok(self
            .audio_heads
            .forward(&h)?
            .reshape(&[tail, self.codebooks as i32, self.audio_vocab as i32])?
            .transpose_axes(&[1, 0, 2])?
            .as_dtype(Dtype::Float32)?)
    }
}

/// Official `_predict_tokens_with_scoring` (`class_temperature = 0`, greedy): with guidance, `log_softmax(lp_c + g·(lp_c − lp_u))`, otherwise `lp_c`; after masking the mask id, takes argmax as the prediction and the maximum log-probability as the confidence. Returns two sets of values expanded in row-major order of `[codebooks, T]`.
pub fn predict(cond: &Array, uncond: Option<&Array>, guidance: f32, mask_id: usize) -> Result<(Vec<u32>, Vec<f32>)> {
    let log_softmax = |x: &Array| -> Result<Array> { Ok(x.subtract(&x.logsumexp_axis(-1, true)?)?) };
    let lp_c = log_softmax(cond)?;
    let lp = match uncond {
        Some(uncond) if guidance != 0.0 => {
            let lp_u = log_softmax(uncond)?;
            let guided = lp_c.add(&lp_c.subtract(&lp_u)?.multiply(Array::from_f32(guidance))?)?;
            log_softmax(&guided)?
        }
        _ => lp_c,
    };
    // The mask id is the last item: slicing it off is equivalent to setting it to −inf.
    let lp = lp.index((.., .., ..mask_id as i32));
    let pred = argmax_axis(&lp, -1, false)?.as_dtype(Dtype::Uint32)?;
    let score = lp.max_axis(-1, false)?;
    eval([&pred, &score])?;
    Ok((pred.as_slice::<u32>().to_vec(), score.as_slice::<f32>().to_vec()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 8-bit, group size 32 (the smallest group size MLX supports): the quantized embedding table fetches rows by id and then dequantizes them, which matches looking up the float table directly.
    #[test]
    fn quantized_embedding_matches_float_rows() {
        let _mlx = super::super::tests::mlx_lock();
        let rows = 3usize;
        let dim = 64usize;
        let q: Vec<u32> = (0..rows * dim).map(|i| ((i * 37) % 256) as u32).collect();
        let scales: Vec<f32> = (0..rows * 2).map(|i| 0.01 * (i + 1) as f32).collect();
        let biases: Vec<f32> = (0..rows * 2).map(|i| -0.5 + 0.1 * i as f32).collect();
        let packed: Vec<u32> = q
            .chunks(4)
            .map(|c| c.iter().enumerate().fold(0u32, |acc, (j, &v)| acc | (v << (8 * j))))
            .collect();
        let float: Vec<f32> = (0..rows * dim)
            .map(|i| {
                let g = i / 32;
                q[i] as f32 * scales[g] + biases[g]
            })
            .collect();
        let quantized = Embedding::Quantized {
            weight: Array::from_slice(&packed, &[rows as i32, 16]),
            scales: Array::from_slice(&scales, &[rows as i32, 2]),
            biases: Array::from_slice(&biases, &[rows as i32, 2]),
            group_size: 32,
            bits: 8,
        };
        let plain = Embedding::Float(Array::from_slice(&float, &[rows as i32, dim as i32]));
        let ids = Array::from_slice(&[2u32, 0, 2], &[3]);
        let a = quantized.forward(&ids).unwrap();
        let b = plain.forward(&ids).unwrap();
        assert_eq!(a.shape(), vec![3, 64]);
        let (a, b) = (a.as_slice::<f32>().to_vec(), b.as_slice::<f32>().to_vec());
        for (x, y) in a.iter().zip(&b) {
            assert!((x - y).abs() < 1e-5, "{a:?} vs {b:?}");
        }
    }
}
