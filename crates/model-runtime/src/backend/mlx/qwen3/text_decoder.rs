//! Parts of this file's implementation are based on speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/QuantizedTextDecoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model packs and transcription interface; the original upstream attribution is retained.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Qwen3 text decoder: GQA attention + Q/K RMSNorm + RoPE + SwiGLU, with a KV cache that grows in 256-step increments.
//!
//! Besides `decode`, which is used for transcription, `large`, `load_with_prefix`, `forward_hidden*`, `final_norm`, `into_hidden_prenorm`,
//! and `forward_fused_hidden` were ported from v2. The 1.7B config goes to Qwen3-ASR 1.7B, and the rest go to the local speech synthesis batch (Thinker layer fusion)
//! and the local text-to-image batch (Qwen text encoder).

use super::WeightStore;
use super::layers::{Projection, RmsNorm, TokenEmbedding};
use anyhow::{Result, bail};
use mlx_rs::Array;
use mlx_rs::fast;
use mlx_rs::fast::ScaledDotProductAttentionMask;
use mlx_rs::nn::silu;
use mlx_rs::ops;
use mlx_rs::ops::indexing::{IndexOp, TryIndexMutOp};
use mlx_rs::transforms;

const KV_CACHE_STEP: i32 = 256;

/// KV cache that grows in fixed steps, so autoregressive generation does not copy the whole cache for every token.
pub struct KvCache {
    keys: Option<Array>,
    values: Option<Array>,
    offset: i32,
}

impl KvCache {
    pub(crate) fn new() -> Self {
        Self {
            keys: None,
            values: None,
            offset: 0,
        }
    }

    pub fn offset(&self) -> i32 {
        self.offset
    }

    pub(crate) fn update(&mut self, keys: Array, values: Array) -> Result<(Array, Array)> {
        let previous = self.offset;
        let incoming = keys.dim(2);
        if keys.dim(0) != 1 || values.dim(0) != 1 {
            bail!("the KV cache only supports batch size 1");
        }
        let required = previous + incoming;
        let needs_growth = self.keys.as_ref().is_none_or(|current| required > current.dim(2));
        if needs_growth {
            let batch = keys.dim(0);
            let heads = keys.dim(1);
            let key_width = keys.dim(3);
            let value_width = values.dim(3);
            let growth = ((KV_CACHE_STEP + incoming - 1) / KV_CACHE_STEP) * KV_CACHE_STEP;
            let new_keys = ops::zeros_dtype(&[batch, heads, growth, key_width], keys.dtype())?;
            let new_values = ops::zeros_dtype(&[batch, heads, growth, value_width], values.dtype())?;
            match (self.keys.take(), self.values.take()) {
                (Some(current_keys), Some(current_values)) => {
                    let current_keys = if previous % KV_CACHE_STEP == 0 {
                        current_keys
                    } else {
                        current_keys.index((.., .., ..previous, ..))
                    };
                    let current_values = if previous % KV_CACHE_STEP == 0 {
                        current_values
                    } else {
                        current_values.index((.., .., ..previous, ..))
                    };
                    self.keys = Some(ops::concatenate_axis(&[current_keys, new_keys], 2)?);
                    self.values = Some(ops::concatenate_axis(&[current_values, new_values], 2)?);
                }
                (None, None) => {
                    self.keys = Some(new_keys);
                    self.values = Some(new_values);
                }
                _ => bail!("inconsistent KV cache key/value state"),
            }
        }

        self.offset = required;
        let key_update = keys.squeeze_axes(&[0])?;
        let value_update = values.squeeze_axes(&[0])?;
        self.keys
            .as_mut()
            .expect("KV cache keys are initialized")
            .try_index_mut((0, .., previous..required, ..), &key_update)?;
        self.values
            .as_mut()
            .expect("KV cache values are initialized")
            .try_index_mut((0, .., previous..required, ..), &value_update)?;
        Ok((
            self.keys.as_ref().expect("KV cache keys are initialized").index((.., .., ..required, ..)),
            self.values
                .as_ref()
                .expect("KV cache values are initialized")
                .index((.., .., ..required, ..)),
        ))
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TextDecoderConfig {
    pub hidden_size: usize,
    pub layers: usize,
    pub heads: usize,
    pub kv_heads: usize,
    pub head_dim: usize,
    pub intermediate_size: usize,
    pub group_size: i32,
    pub bits: i32,
    pub rope_theta: f32,
    pub rms_eps: f32,
    /// Qwen3/MOSS apply Q/K RMSNorm before RoPE; Qwen2.5-Omni does not.
    pub qk_norm: bool,
}

impl TextDecoderConfig {
    pub fn small(bits: i32) -> Self {
        Self {
            hidden_size: 1024,
            layers: 28,
            heads: 16,
            kv_heads: 8,
            head_dim: 128,
            intermediate_size: 3072,
            group_size: 64,
            bits,
            rope_theta: 1_000_000.0,
            rms_eps: 1e-6,
            qk_norm: true,
        }
    }

    pub fn large(bits: i32) -> Self {
        Self {
            hidden_size: 2048,
            intermediate_size: 6144,
            ..Self::small(bits)
        }
    }
}

struct TextAttention {
    q_proj: Projection,
    k_proj: Projection,
    v_proj: Projection,
    o_proj: Projection,
    q_norm: Option<RmsNorm>,
    k_norm: Option<RmsNorm>,
    config: TextDecoderConfig,
}

impl TextAttention {
    fn load(store: &mut WeightStore, prefix: &str, config: TextDecoderConfig) -> Result<Self> {
        Ok(Self {
            q_proj: Projection::load(store, &format!("{prefix}.q_proj"), config.group_size, config.bits)?,
            k_proj: Projection::load(store, &format!("{prefix}.k_proj"), config.group_size, config.bits)?,
            v_proj: Projection::load(store, &format!("{prefix}.v_proj"), config.group_size, config.bits)?,
            o_proj: Projection::load(store, &format!("{prefix}.o_proj"), config.group_size, config.bits)?,
            q_norm: config
                .qk_norm
                .then(|| RmsNorm::load(store, &format!("{prefix}.q_norm"), config.rms_eps))
                .transpose()?,
            k_norm: config
                .qk_norm
                .then(|| RmsNorm::load(store, &format!("{prefix}.k_norm"), config.rms_eps))
                .transpose()?,
            config,
        })
    }

    fn forward(&self, input: &Array, mask: Option<&Array>, causal: bool, cache: Option<&mut KvCache>) -> Result<Array> {
        let batch = input.dim(0);
        let sequence = input.dim(1);
        let mut query = self
            .q_proj
            .forward(input)?
            .reshape(&[batch, sequence, self.config.heads as i32, self.config.head_dim as i32])?;
        let mut key = self
            .k_proj
            .forward(input)?
            .reshape(&[batch, sequence, self.config.kv_heads as i32, self.config.head_dim as i32])?;
        let mut value =
            self.v_proj
                .forward(input)?
                .reshape(&[batch, sequence, self.config.kv_heads as i32, self.config.head_dim as i32])?;
        if let Some(norm) = &self.q_norm {
            query = norm.forward(&query)?;
        }
        if let Some(norm) = &self.k_norm {
            key = norm.forward(&key)?;
        }
        query = query.transpose_axes(&[0, 2, 1, 3])?;
        key = key.transpose_axes(&[0, 2, 1, 3])?;
        value = value.transpose_axes(&[0, 2, 1, 3])?;
        let offset = cache.as_ref().map(|cache| cache.offset()).unwrap_or(0);
        query = fast::rope(
            &query,
            self.config.head_dim as i32,
            false,
            self.config.rope_theta,
            1.0,
            offset,
            None,
        )?;
        key = fast::rope(&key, self.config.head_dim as i32, false, self.config.rope_theta, 1.0, offset, None)?;
        let (cached_key, cached_value) = if let Some(cache) = cache {
            cache.update(key, value)?
        } else {
            (key, value)
        };
        let scale = (self.config.head_dim as f32).sqrt().recip();
        // In causal mode the MLX kernel derives by itself the offset of the query relative to the end of the keys, so no mask needs to be materialized on the host side.
        let mask_mode = match (mask, causal) {
            (Some(mask), _) => Some(ScaledDotProductAttentionMask::Array(mask)),
            (None, true) => Some(ScaledDotProductAttentionMask::Causal),
            (None, false) => None,
        };
        let attended = fast::scaled_dot_product_attention(&query, &cached_key, &cached_value, scale, mask_mode, None)?;
        let merged =
            attended
                .transpose_axes(&[0, 2, 1, 3])?
                .reshape(&[batch, sequence, (self.config.heads * self.config.head_dim) as i32])?;
        self.o_proj.forward(&merged)
    }

    fn append_quantized_arrays<'a>(&'a self, arrays: &mut Vec<&'a Array>) {
        self.q_proj.append_quantized_arrays(arrays);
        self.k_proj.append_quantized_arrays(arrays);
        self.v_proj.append_quantized_arrays(arrays);
        self.o_proj.append_quantized_arrays(arrays);
    }
}

struct TextMlp {
    gate: Projection,
    up: Projection,
    down: Projection,
}

impl TextMlp {
    fn load(store: &mut WeightStore, prefix: &str, config: TextDecoderConfig) -> Result<Self> {
        Ok(Self {
            gate: Projection::load(store, &format!("{prefix}.gate_proj"), config.group_size, config.bits)?,
            up: Projection::load(store, &format!("{prefix}.up_proj"), config.group_size, config.bits)?,
            down: Projection::load(store, &format!("{prefix}.down_proj"), config.group_size, config.bits)?,
        })
    }

    fn forward(&self, input: &Array) -> Result<Array> {
        let gate = silu(self.gate.forward(input)?)?;
        self.down.forward(&(&gate * &self.up.forward(input)?))
    }

    fn append_quantized_arrays<'a>(&'a self, arrays: &mut Vec<&'a Array>) {
        self.gate.append_quantized_arrays(arrays);
        self.up.append_quantized_arrays(arrays);
        self.down.append_quantized_arrays(arrays);
    }
}

struct TextLayer {
    attention: TextAttention,
    mlp: TextMlp,
    input_norm: RmsNorm,
    post_attention_norm: RmsNorm,
}

impl TextLayer {
    fn load(store: &mut WeightStore, prefix: &str, config: TextDecoderConfig) -> Result<Self> {
        Ok(Self {
            attention: TextAttention::load(store, &format!("{prefix}.self_attn"), config)?,
            mlp: TextMlp::load(store, &format!("{prefix}.mlp"), config)?,
            input_norm: RmsNorm::load(store, &format!("{prefix}.input_layernorm"), config.rms_eps)?,
            post_attention_norm: RmsNorm::load(store, &format!("{prefix}.post_attention_layernorm"), config.rms_eps)?,
        })
    }

    fn forward(&self, input: &Array, mask: Option<&Array>, causal: bool, cache: Option<&mut KvCache>) -> Result<Array> {
        let normalized = self.input_norm.forward(input)?;
        let attention = self.attention.forward(&normalized, mask, causal, cache)?;
        let mut hidden = input + &attention;
        let residual = hidden.clone();
        hidden = self.post_attention_norm.forward(&hidden)?;
        hidden = self.mlp.forward(&hidden)?;
        Ok(&residual + &hidden)
    }

    fn append_quantized_arrays<'a>(&'a self, arrays: &mut Vec<&'a Array>) {
        self.attention.append_quantized_arrays(arrays);
        self.mlp.append_quantized_arrays(arrays);
    }

    /// Starts async evaluation of this layer's quantized weights (lazy weights begin reading in from the file).
    fn prefetch(&self) -> Result<()> {
        let mut arrays = Vec::new();
        self.append_quantized_arrays(&mut arrays);
        mlx_rs::transforms::async_eval(arrays)?;
        Ok(())
    }
}

pub struct TextDecoder {
    pub embedding: TokenEmbedding,
    layers: Vec<TextLayer>,
    norm: RmsNorm,
}

impl TextDecoder {
    pub fn load(store: &mut WeightStore, config: TextDecoderConfig) -> Result<Self> {
        Self::load_with_prefix(store, config, "model")
    }

    pub fn load_with_prefix(store: &mut WeightStore, config: TextDecoderConfig, prefix: &str) -> Result<Self> {
        if config.hidden_size == 0
            || config.intermediate_size == 0
            || config.heads == 0
            || config.kv_heads == 0
            || !config.heads.is_multiple_of(config.kv_heads)
        {
            bail!("invalid Qwen3 text decoder config");
        }
        let embedding = TokenEmbedding::load(store, &format!("{prefix}.embed_tokens"), config.group_size, config.bits)?;
        let mut layers = Vec::with_capacity(config.layers);
        for index in 0..config.layers {
            layers.push(TextLayer::load(store, &format!("{prefix}.layers.{index}"), config)?);
        }
        Ok(Self {
            embedding,
            layers,
            norm: RmsNorm::load(store, &format!("{prefix}.norm"), config.rms_eps)?,
        })
    }

    pub fn decode(
        &self,
        input_embeddings: &Array,
        attention_mask: Option<&Array>,
        cache: Option<Vec<KvCache>>,
    ) -> Result<(Array, Vec<KvCache>)> {
        let sequence = input_embeddings.dim(1);
        let mut cache = cache.unwrap_or_else(|| (0..self.layers.len()).map(|_| KvCache::new()).collect::<Vec<_>>());
        if cache.len() != self.layers.len() {
            bail!(
                "Qwen3 KV cache layer count mismatch: expected {}, got {}",
                self.layers.len(),
                cache.len()
            );
        }
        // Single-token decoding naturally needs no mask; multi-token prefill hands off to MLX's causal mode and no longer materializes a mask array.
        let causal = attention_mask.is_none() && sequence > 1;
        let mut hidden = input_embeddings.clone();
        for (layer, layer_cache) in self.layers.iter().zip(cache.iter_mut()) {
            hidden = layer.forward(&hidden, attention_mask, causal, Some(layer_cache))?;
        }
        Ok((self.norm.forward(&hidden)?, cache))
    }

    /// One-shot prefill without a KV cache. Returns the hidden states after the final normalization (**without** passing through lm_head).
    ///
    /// For uses like embedding or reranker that "forward once and read only one position": `decode`
    /// goes through [`KvCache`], and the KV cache only supports batch size 1, so it cannot batch with left padding.
    /// `attention_mask` is an **additive** mask broadcastable to `[batch, heads, sequence, sequence]` (it carries the causal and padding semantics itself); when it is `None`, MLX's causal mode is used.
    pub fn forward_hidden(&self, input_embeddings: &Array, attention_mask: Option<&Array>) -> Result<Array> {
        let sequence = input_embeddings.dim(1);
        let causal = attention_mask.is_none() && sequence > 1;
        let mut hidden = input_embeddings.clone();
        for layer in &self.layers {
            hidden = layer.forward(&hidden, attention_mask, causal, None)?;
        }
        self.norm.forward(&hidden)
    }

    /// Same as [`Self::forward_hidden`], but returns the raw output of the last decoder layer, **without** the final RMSNorm.
    /// Qwen-Image's text conditioning takes exactly this layer.
    pub fn forward_hidden_prenorm(&self, input_embeddings: &Array) -> Result<Array> {
        let causal = input_embeddings.dim(1) > 1;
        let mut hidden = input_embeddings.clone();
        for layer in &self.layers {
            hidden = layer.forward(&hidden, None, causal, None)?;
        }
        Ok(hidden)
    }

    pub fn final_norm(&self, hidden: &Array) -> Result<Array> {
        self.norm.forward(hidden)
    }

    /// Streaming version of [`Self::forward_hidden_prenorm`]: consumes the decoder, drops the embedding table after embedding, then evaluates
    /// layer by layer, dropping each layer immediately after. Combined with the not-yet-evaluated lazy safetensors weights, only two adjacent layers are resident at a time;
    /// the next layer's quantized weights are read in asynchronously on the CPU stream while the current layer computes.
    pub fn into_hidden_prenorm(self, input_ids: &Array) -> Result<Array> {
        let Self { embedding, layers, .. } = self;
        let mut hidden = embedding.forward(input_ids)?;
        hidden.eval()?;
        drop(embedding);
        let causal = hidden.dim(1) > 1;
        let mut layers = layers.into_iter().peekable();
        if let Some(first) = layers.peek() {
            first.prefetch()?;
        }
        while let Some(layer) = layers.next() {
            if let Some(next) = layers.peek() {
                next.prefetch()?;
            }
            hidden = layer.forward(&hidden, None, causal, None)?;
            hidden.eval()?;
        }
        Ok(hidden)
    }

    /// Qwen2.5-Omni Thinker's ELMo-style layer fusion: the 36 decoder hidden states
    /// each get a non-affine LayerNorm, then are summed with the softmax weights from the checkpoint.
    /// For text-only input the position triples are identical, so ordinary Qwen RoPE and MRoPE are numerically equivalent.
    pub fn forward_fused_hidden(&self, input_embeddings: &Array, layer_weights: &Array, layer_scale: &Array) -> Result<Array> {
        if layer_weights.dim(0) != self.layers.len() as i32 {
            bail!(
                "Qwen layer-fusion weight count mismatch: expected {}, got {}",
                self.layers.len(),
                layer_weights.dim(0)
            );
        }
        let weights = mlx_rs::ops::softmax_axis(layer_weights, 0, true)?;
        let sequence = input_embeddings.dim(1);
        let mut hidden = input_embeddings.clone();
        let mut fused: Option<Array> = None;
        for (index, layer) in self.layers.iter().enumerate() {
            hidden = layer.forward(&hidden, None, sequence > 1, None)?;
            let state = if index + 1 == self.layers.len() {
                self.norm.forward(&hidden)?
            } else {
                hidden.clone()
            };
            let normalized = fast::layer_norm(&state, None, None, 1e-5)?;
            let weighted = normalized.multiply(&weights.index(index as i32))?;
            fused = Some(match fused {
                Some(sum) => sum.add(&weighted)?,
                None => weighted,
            });
        }
        fused.expect("TextDecoder needs at least one layer").multiply(layer_scale).map_err(Into::into)
    }

    pub fn embed(&self, ids: &Array) -> Result<Array> {
        self.embedding.forward(ids)
    }

    pub fn logits(&self, hidden: &Array) -> Result<Array> {
        self.embedding.as_linear(hidden)
    }

    /// Materializes runtime-quantized weights early, so the original bf16 weights can be released before the first prefill round.
    pub fn eval_quantized(&self) -> Result<()> {
        let mut arrays = Vec::new();
        self.embedding.append_quantized_arrays(&mut arrays);
        for layer in &self.layers {
            layer.append_quantized_arrays(&mut arrays);
        }
        if !arrays.is_empty() {
            transforms::eval(arrays)?;
        }
        Ok(())
    }
}

/// The old host-side mask construction, kept only for the numerical comparison tests of causal mode.
#[cfg(test)]
fn causal_mask(sequence: i32, cache_length: i32) -> Result<Array> {
    let total = sequence + cache_length;
    let mut values = vec![0.0_f32; (sequence * total) as usize];
    for row in 0..sequence {
        for column in 0..total {
            if column > row + cache_length {
                values[(row * total + column) as usize] = -1e9;
            }
        }
    }
    Ok(Array::from_slice(&values, &[1, 1, sequence, total]))
}

#[cfg(test)]
mod tests {
    use super::{KV_CACHE_STEP, KvCache, causal_mask};
    use mlx_rs::fast::{self, ScaledDotProductAttentionMask};
    use mlx_rs::ops::indexing::IndexOp;
    use mlx_rs::{Array, Dtype, ops};

    #[test]
    fn kv_cache_grows_in_steps_without_changing_values() {
        let _mlx_test_guard = crate::backend::mlx::runtime::MLX_TEST_LOCK
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let mut cache = KvCache::new();
        let keys = Array::from_iter(0..24, &[1, 2, 3, 4]);
        let values = Array::from_iter(24..48, &[1, 2, 3, 4]);
        let (returned_keys, returned_values) = cache.update(keys, values).unwrap();
        returned_keys.eval().unwrap();
        returned_values.eval().unwrap();

        assert_eq!(cache.offset(), 3);
        assert_eq!(cache.keys.as_ref().unwrap().dim(2), KV_CACHE_STEP);
        assert_eq!(returned_keys.shape(), &[1, 2, 3, 4]);
        assert_eq!(returned_keys.index((0, 0, .., ..)).as_slice::<i32>(), &(0..12).collect::<Vec<_>>());
        assert_eq!(returned_keys.index((0, 1, .., ..)).as_slice::<i32>(), &(12..24).collect::<Vec<_>>());
        assert_eq!(
            returned_values.index((0, 0, .., ..)).as_slice::<i32>(),
            &(24..36).collect::<Vec<_>>()
        );
        assert_eq!(
            returned_values.index((0, 1, .., ..)).as_slice::<i32>(),
            &(36..48).collect::<Vec<_>>()
        );

        let next_keys = Array::from_iter(48..56, &[1, 2, 1, 4]);
        let next_values = Array::from_iter(56..64, &[1, 2, 1, 4]);
        let (returned_keys, returned_values) = cache.update(next_keys, next_values).unwrap();
        returned_keys.eval().unwrap();
        returned_values.eval().unwrap();

        assert_eq!(cache.offset(), 4);
        assert_eq!(cache.keys.as_ref().unwrap().dim(2), KV_CACHE_STEP);
        assert_eq!(returned_keys.shape(), &[1, 2, 4, 4]);
        assert_eq!(
            returned_keys.index((0, 0, 3..4, ..)).as_slice::<i32>(),
            &(48..52).collect::<Vec<_>>()
        );
        assert_eq!(
            returned_keys.index((0, 1, 3..4, ..)).as_slice::<i32>(),
            &(52..56).collect::<Vec<_>>()
        );
        assert_eq!(
            returned_values.index((0, 0, 3..4, ..)).as_slice::<i32>(),
            &(56..60).collect::<Vec<_>>()
        );
        assert_eq!(
            returned_values.index((0, 1, 3..4, ..)).as_slice::<i32>(),
            &(60..64).collect::<Vec<_>>()
        );
    }

    /// Causal mode and the host-side mask must match element by element when there is a cache offset (query aligned to the end of the keys).
    /// The dtype must cover production's bf16: MLX's SDPA dispatches kernels by dtype, so passing in f32 does not imply passing in bf16.
    fn assert_causal_matches_array_mask(
        heads: i32,
        kv_heads: i32,
        sequence: i32,
        cache_length: i32,
        head_dim: i32,
        dtype: Dtype,
        tolerance: f32,
    ) {
        let total = sequence + cache_length;
        let query = mlx_rs::random::normal::<f32>(&[1, heads, sequence, head_dim], None, None, None)
            .unwrap()
            .as_dtype(dtype)
            .unwrap();
        let key = mlx_rs::random::normal::<f32>(&[1, kv_heads, total, head_dim], None, None, None)
            .unwrap()
            .as_dtype(dtype)
            .unwrap();
        let value = mlx_rs::random::normal::<f32>(&[1, kv_heads, total, head_dim], None, None, None)
            .unwrap()
            .as_dtype(dtype)
            .unwrap();
        let scale = (head_dim as f32).sqrt().recip();
        let mask = causal_mask(sequence, cache_length).unwrap().as_dtype(dtype).unwrap();
        let reference =
            fast::scaled_dot_product_attention(&query, &key, &value, scale, ScaledDotProductAttentionMask::Array(&mask), None).unwrap();
        let actual = fast::scaled_dot_product_attention(&query, &key, &value, scale, ScaledDotProductAttentionMask::Causal, None).unwrap();
        assert_eq!(reference.shape(), actual.shape());
        // Upcast everything to f32 before comparing, so that bf16 reduction and item-read precision loss do not mask a real deviation.
        let reference = reference.as_dtype(Dtype::Float32).unwrap();
        let actual = actual.as_dtype(Dtype::Float32).unwrap();
        let deviation = ops::abs(ops::subtract(&reference, &actual).unwrap())
            .unwrap()
            .max(None)
            .unwrap()
            .item::<f32>();
        assert!(
            deviation < tolerance,
            "causal mode and mask array deviate by {deviation} at heads={heads} sequence={sequence} cache={cache_length} dtype={dtype:?}"
        );
    }

    #[test]
    fn causal_mask_mode_matches_materialized_mask() {
        let _mlx_test_guard = crate::backend::mlx::runtime::MLX_TEST_LOCK
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        // Small sizes: two offset cases, without cache and with cache.
        assert_causal_matches_array_mask(4, 2, 5, 0, 8, Dtype::Float32, 1e-4);
        assert_causal_matches_array_mask(4, 2, 5, 7, 8, Dtype::Float32, 1e-4);
        // Production geometry: GQA 16/8, head_dim 128, prefill 512 with a non-zero cache.
        assert_causal_matches_array_mask(16, 8, 512, 1_024, 128, Dtype::Float32, 1e-4);
        // Production dtype: bf16 has only 8 mantissa bits, so the tolerance is set to 2e-2. If causal aligned to the start of the keys instead of the end, the deviation would be on the order of 1, far above this threshold, which is enough to catch a semantic error.
        assert_causal_matches_array_mask(4, 2, 5, 7, 8, Dtype::Bfloat16, 2e-2);
        assert_causal_matches_array_mask(16, 8, 512, 1_024, 128, Dtype::Bfloat16, 2e-2);
    }
}
