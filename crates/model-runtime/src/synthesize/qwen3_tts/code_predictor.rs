//! Parts rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3TTS/CodePredictor.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model package interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; scope of the sources is in the root `THIRD_PARTY_NOTICES.md`.
//!
//! Code Predictor: 5-layer Qwen3 decoder + 15 codec embedding tables + 15 lm_heads,
//! which predicts the remaining 15 codebooks group by group from the Talker's hidden state and the first codebook.

use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Result, bail};

use super::config::CodePredictorConfig;
use super::layers::{AttentionDims, DecoderLayer, Embedding, KvCache, Linear, RmsNorm, token_array};
use super::sampling::{Rng, SamplingConfig, sample_frame_token};
use super::weights::Weights;

pub struct CodePredictor {
    codec_embeddings: Vec<Embedding>,
    layers: Vec<DecoderLayer>,
    norm: RmsNorm,
    lm_heads: Vec<Linear>,
    small_to_mtp_projection: Option<Linear>,
    num_groups: usize,
}

impl CodePredictor {
    /// `weights` already has the `talker.code_predictor.` prefix stripped.
    pub fn load(weights: &mut Weights, config: &CodePredictorConfig) -> Result<Self> {
        let dims = AttentionDims {
            num_heads: config.num_heads,
            num_kv_heads: config.num_kv_heads,
            head_dim: config.head_dim,
            rope_theta: config.rope_theta,
            rms_norm_eps: config.rms_norm_eps,
        };
        let group_size = config.group_size;
        let bits = config.bits;
        let num_groups = config.num_code_groups - 1;
        let mut codec_embeddings = Vec::with_capacity(num_groups);
        let mut lm_heads = Vec::with_capacity(num_groups);
        for index in 0..num_groups {
            codec_embeddings.push(Embedding::load(weights, &format!("model.codec_embedding.{index}"))?);
            lm_heads.push(Linear::load(weights, &format!("lm_head.{index}"), group_size, bits)?);
        }
        let mut layers = Vec::with_capacity(config.num_layers);
        for index in 0..config.num_layers {
            layers.push(DecoderLayer::load(
                weights,
                &format!("model.layers.{index}"),
                &dims,
                group_size,
                bits,
            )?);
        }
        let small_to_mtp_projection = if config.needs_projection() {
            Some(Linear::load(weights, "small_to_mtp_projection", group_size, bits)?)
        } else {
            None
        };
        Ok(Self {
            codec_embeddings,
            layers,
            norm: RmsNorm::load(weights, "model.norm", config.rms_norm_eps)?,
            lm_heads,
            small_to_mtp_projection,
            num_groups,
        })
    }

    pub fn num_groups(&self) -> usize {
        self.num_groups
    }

    /// Embedding of group `group` (0 = codebook 2): `ids [B, S]` → `[B, S, D]`.
    pub fn embed_group(&self, ids: &Array, group: usize) -> Array {
        self.codec_embeddings[group].forward(ids)
    }

    /// Sum of the embeddings of the 15 tokens (one per group): `[1, 1, D]`.
    pub fn batch_embed_all_groups(&self, tokens: &[i32]) -> Result<Array> {
        if tokens.len() != self.num_groups {
            bail!("Code Predictor 需要 {} 个 token，实际 {}", self.num_groups, tokens.len());
        }
        let mut sum = self.embed_group(&token_array(&tokens[..1]), 0);
        for (group, &token) in tokens.iter().enumerate().skip(1) {
            sum = sum.add(&self.embed_group(&token_array(&[token]), group))?;
        }
        Ok(sum)
    }

    /// Single-group forward pass: returns `(logits [B,S,vocab], cache)`.
    fn forward(&self, inputs_embeds: &Array, group: usize, cache: Option<&[KvCache]>) -> Result<(Array, Vec<KvCache>)> {
        let mut hidden = match &self.small_to_mtp_projection {
            Some(proj) => proj.forward(inputs_embeds)?,
            None => inputs_embeds.clone(),
        };
        let offset = cache.and_then(|cache| cache.first()).map_or(0, KvCache::len);
        let mut new_cache = Vec::with_capacity(self.layers.len());
        for (index, layer) in self.layers.iter().enumerate() {
            let layer_cache = cache.map(|cache| &cache[index]);
            let (output, updated) = layer.forward(&hidden, offset, None, layer_cache)?;
            hidden = output;
            new_cache.push(updated);
        }
        let hidden = self.norm.forward(&hidden)?;
        let logits = self.lm_heads[group].forward(&hidden)?;
        Ok((logits, new_cache))
    }

    /// Takes the Talker's last hidden state `[1,1,D]` and the first codebook's embedding `[1,1,D]`, and autoregressively samples 15 tokens, one group at a time.
    pub fn predict_frame(
        &self,
        hidden_state: &Array,
        first_code_embed: &Array,
        sampling: &SamplingConfig,
        rng: &mut Rng,
    ) -> Result<Vec<i32>> {
        let prefill = ops::concatenate_axis(&[hidden_state, first_code_embed], 1)?;
        let (logits, mut cache) = self.forward(&prefill, 0, None)?;
        let last = logits.dim(1) - 1;
        let mut token = sample_group(&logits.index((.., last..last + 1, ..)), sampling, rng)?;
        let mut tokens = Vec::with_capacity(self.num_groups);
        tokens.push(token);
        for group in 1..self.num_groups {
            let embedding = self.embed_group(&token_array(&[token]), group - 1);
            let (logits, new_cache) = self.forward(&embedding, group, Some(&cache))?;
            cache = new_cache;
            token = sample_group(&logits, sampling, rng)?;
            tokens.push(token);
        }
        Ok(tokens)
    }
}

/// Samples on the host side from one group's logits (`[1,1,vocab]` → token).
fn sample_group(logits: &Array, sampling: &SamplingConfig, rng: &mut Rng) -> Result<i32> {
    let flat = logits.as_dtype(Dtype::Float32)?;
    flat.eval()?;
    let mut scores = flat.as_slice::<f32>().to_vec();
    Ok(sample_frame_token(&mut scores, sampling, rng))
}
