//! Partly implemented by rewriting speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/Qwen3TTS/Talker.swift / Sources/Qwen3TTS/CodePredictor.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! Talker: 28-layer Qwen3 decoder. Its input is the sum of the text and codec embeddings. It outputs the first
//! codebook's logits and the last hidden state (fed to the Code Predictor).

use crate::synthesize::tensor::Array;
use crate::synthesize::tensor::nn::silu;
use anyhow::Result;

use super::config::TalkerConfig;
use super::layers::{AttentionDims, DecoderLayer, Embedding, KvCache, Linear, RmsNorm};
use super::weights::Weights;

/// `Linear(textHidden, textHidden) -> SiLU -> Linear(textHidden, hidden)`。
struct TextProjection {
    fc1: Linear,
    fc2: Linear,
}

impl TextProjection {
    fn forward(&self, x: &Array) -> Result<Array> {
        let h = silu(self.fc1.forward(x)?)?;
        self.fc2.forward(&h)
    }
}

pub struct Talker {
    codec_embedding: Embedding,
    text_embedding: Embedding,
    text_projection: TextProjection,
    layers: Vec<DecoderLayer>,
    norm: RmsNorm,
    codec_head: Linear,
    pub hidden_size: usize,
}

impl Talker {
    /// `weights` already has the `talker.` prefix stripped (and excludes `code_predictor.`).
    pub fn load(weights: &mut Weights, config: &TalkerConfig) -> Result<Self> {
        let dims = AttentionDims {
            num_heads: config.num_heads,
            num_kv_heads: config.num_kv_heads,
            head_dim: config.head_dim,
            rope_theta: config.rope_theta,
            rms_norm_eps: config.rms_norm_eps,
        };
        let group_size = config.group_size;
        let bits = config.bits;
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
        Ok(Self {
            codec_embedding: Embedding::load(weights, "model.codec_embedding")?,
            text_embedding: Embedding::load(weights, "model.text_embedding")?,
            text_projection: TextProjection {
                fc1: Linear::load(weights, "text_projection.linear_fc1", group_size, bits)?,
                fc2: Linear::load(weights, "text_projection.linear_fc2", group_size, bits)?,
            },
            layers,
            norm: RmsNorm::load(weights, "model.norm", config.rms_norm_eps)?,
            codec_head: Linear::load(weights, "codec_head", group_size, bits)?,
            hidden_size: config.hidden_size,
        })
    }

    /// Text tokens `[B, S]` → projected embeddings `[B, S, hidden]`.
    pub fn embed_text(&self, ids: &Array) -> Result<Array> {
        let embeds = self.text_embedding.forward(ids);
        self.text_projection.forward(&embeds)
    }

    /// codec token `[B, S]` → `[B, S, hidden]`。
    pub fn embed_codec(&self, ids: &Array) -> Array {
        self.codec_embedding.forward(ids)
    }

    /// Forward pass: returns `(logits [B,S,codec_vocab], hidden [B,S,H], cache)`.
    /// `offset` is the RoPE position offset. When `mask` is empty, S>1 uses a causal mask.
    pub fn forward(
        &self,
        inputs_embeds: &Array,
        offset: i32,
        mask: Option<&Array>,
        cache: Option<&[KvCache]>,
    ) -> Result<(Array, Array, Vec<KvCache>)> {
        let mut hidden = inputs_embeds.clone();
        let mut new_cache = Vec::with_capacity(self.layers.len());
        for (index, layer) in self.layers.iter().enumerate() {
            let layer_cache = cache.map(|cache| &cache[index]);
            let (output, updated) = layer.forward(&hidden, offset, mask, layer_cache)?;
            hidden = output;
            new_cache.push(updated);
        }
        let hidden = self.norm.forward(&hidden)?;
        let logits = self.codec_head.forward(&hidden)?;
        Ok((logits, hidden, new_cache))
    }
}
