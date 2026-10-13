//! Parts of this file are implemented with reference to speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/QuantizedTextDecoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model packs and transcription interface; the original upstream attribution is retained.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; scope of sources: see `THIRD_PARTY_NOTICES.md` in the root directory.
//!
//! Base layers of the candle backend, mirroring the numerical semantics of the mlx backend `qwen3/layers.rs`.
//!
//! Compute precision is determined by `WeightStore::compute_dtype`: always f32 on CPU; on CUDA, the checkpoint's own half precision (bf16/f16) is used. Reductions that need stable accumulation (LayerNorm's mean and variance, softmax, RmsNorm) are still done in f32.

use super::weights::WeightStore;
use anyhow::{Result, anyhow, bail};
use candle_core::{D, DType, Device, Tensor};
use std::sync::Mutex;

/// Growth step for the RoPE cos/sin tables; grows on demand to avoid rebuilding them repeatedly during decoding.
const ROPE_TABLE_STEP: usize = 1_024;

/// Exact GELU: `x * (1 + erf(x / √2)) / 2`, matching `gelu_same_dtype` on the mlx side.
pub fn gelu(x: &Tensor) -> Result<Tensor> {
    Ok(x.gelu_erf()?)
}

pub struct Dense {
    /// Only one [in, out] layout is stored: this is the shape gemm can use directly, so there is no need to keep an extra [out, in] copy as before (for large projection layers, that is a difference of several GB), and it also avoids triggering cuBLAS's inefficient `OP_T` GEMV path by using a transposed view during decoding.
    weight_t: Tensor,
    bias: Option<Tensor>,
}

impl Dense {
    pub fn load(store: &mut WeightStore, prefix: &str) -> Result<Self> {
        let weight = store.take_compute(&format!("{prefix}.weight"))?;
        let bias = store.take_optional_compute(&format!("{prefix}.bias"))?;
        Self::from_weight(weight, bias)
    }

    /// When the checkpoint has `scales`, loads by dequantizing (corresponding to mlx's `Projection`).
    pub fn load_dequantized(store: &mut WeightStore, prefix: &str, group_size: usize, bits: usize) -> Result<Self> {
        let weight = store.take_dequantized(prefix, group_size, bits)?;
        let bias = store.take_optional_compute(&format!("{prefix}.bias"))?;
        Self::from_weight(weight, bias)
    }

    /// `weight` is the checkpoint's [out, in]; the original tensor is released immediately after transposing.
    pub fn from_weight(weight: Tensor, bias: Option<Tensor>) -> Result<Self> {
        let weight_t = weight.t()?.contiguous()?;
        drop(weight);
        Ok(Self { weight_t, bias })
    }

    pub fn device(&self) -> &Device {
        self.weight_t.device()
    }

    pub fn dtype(&self) -> DType {
        self.weight_t.dtype()
    }

    pub fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let output = input.broadcast_matmul(&self.weight_t)?;
        Ok(match &self.bias {
            Some(bias) => output.broadcast_add(bias)?,
            None => output,
        })
    }
}

pub struct LayerNorm {
    weight: Option<Tensor>,
    bias: Option<Tensor>,
    eps: f64,
}

impl LayerNorm {
    pub fn load(store: &mut WeightStore, prefix: &str, eps: f32) -> Result<Self> {
        // Normalization parameters are small, so they are always stored as f32: forward also accumulates mean/variance in f32.
        let weight = store.take_optional_f32(&format!("{prefix}.weight"))?;
        let bias = store.take_optional_f32(&format!("{prefix}.bias"))?;
        if weight.is_none() && bias.is_none() {
            bail!("missing LayerNorm weights: {prefix}");
        }
        Ok(Self {
            weight,
            bias,
            eps: eps as f64,
        })
    }

    pub fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let dtype = input.dtype();
        let working = if dtype == DType::F32 {
            input.clone()
        } else {
            input.to_dtype(DType::F32)?
        };
        let mean = working.mean_keepdim(D::Minus1)?;
        let centered = working.broadcast_sub(&mean)?;
        let variance = centered.sqr()?.mean_keepdim(D::Minus1)?;
        let mut output = centered.broadcast_div(&(variance + self.eps)?.sqrt()?)?;
        if let Some(weight) = &self.weight {
            output = output.broadcast_mul(weight)?;
        }
        if let Some(bias) = &self.bias {
            output = output.broadcast_add(bias)?;
        }
        Ok(if dtype == DType::F32 { output } else { output.to_dtype(dtype)? })
    }
}

pub struct RmsNorm {
    weight: Tensor,
    eps: f32,
}

impl RmsNorm {
    pub fn load(store: &mut WeightStore, prefix: &str, eps: f32) -> Result<Self> {
        Ok(Self {
            // candle's rms_norm accumulates internally in f32, so the weights only need to match the input precision.
            weight: store.take_compute(&format!("{prefix}.weight"))?,
            eps,
        })
    }

    pub fn forward(&self, input: &Tensor) -> Result<Tensor> {
        Ok(candle_nn::ops::rms_norm(&input.contiguous()?, &self.weight, self.eps)?)
    }
}

pub struct TokenEmbedding {
    /// Likewise, only one [hidden, vocab] copy is stored: the tied output layer is a hot path that runs every step and needs this layout; lookups instead use `index_select` along the vocab dimension followed by a transpose, so the cost is only the rows fetched.
    weight_t: Tensor,
}

impl TokenEmbedding {
    pub fn load(store: &mut WeightStore, prefix: &str, group_size: usize, bits: usize) -> Result<Self> {
        let weight = store.take_dequantized(prefix, group_size, bits)?;
        let weight_t = weight.t()?.contiguous()?;
        drop(weight);
        Ok(Self { weight_t })
    }

    /// `ids` is u32 [batch, sequence].
    pub fn forward(&self, ids: &Tensor) -> Result<Tensor> {
        let (batch, sequence) = ids.dims2()?;
        let flat = ids.flatten_all()?;
        let columns = self.weight_t.index_select(&flat, 1)?;
        Ok(columns.t()?.contiguous()?.reshape((batch, sequence, ()))?)
    }

    /// Tied embedding used as the output layer: `hidden × Wᵀ`.
    pub fn as_linear(&self, hidden: &Tensor) -> Result<Tensor> {
        Ok(hidden.broadcast_matmul(&self.weight_t)?)
    }
}

/// Standard SDPA: `softmax(q·kᵀ·scale + mask)·v`. Supports GQA (when the number of kv heads is fewer than q heads, the repeated q heads are folded into the sequence dimension rather than materializing kv to the q head count). All inputs are [batch, heads, sequence, head_dim], and must be layouts gemm can consume directly (contiguous tensors, or `narrow` views of the KV cache).
pub fn scaled_dot_product_attention(query: &Tensor, key: &Tensor, value: &Tensor, scale: f64, mask: Option<&Tensor>) -> Result<Tensor> {
    let (batch, heads, sequence, head_dim) = query.dims4()?;
    let kv_heads = key.dim(1)?;
    if kv_heads == 0 || !heads.is_multiple_of(kv_heads) {
        bail!("GQA head count mismatch: {heads} vs {kv_heads}");
    }
    let repeats = heads / kv_heads;
    let grouped_query = if repeats == 1 {
        query.clone()
    } else {
        // The memory order of [b, kv*rep, seq, d] is the same as [b, kv, rep, seq, d], so this reshape is zero-copy and exactly equivalent to copying kv group by group.
        query.reshape((batch, kv_heads, repeats * sequence, head_dim))?
    };
    let scores = (grouped_query.matmul(&key.transpose(2, 3)?)? * scale)?;
    let total = scores.dim(D::Minus1)?;
    let scores = match mask {
        Some(mask) => {
            let per_head = if repeats == 1 {
                scores
            } else {
                scores.reshape((batch, heads, sequence, total))?
            };
            let masked = per_head.broadcast_add(mask)?;
            if repeats == 1 {
                masked
            } else {
                masked.reshape((batch, kv_heads, repeats * sequence, total))?
            }
        }
        None => scores,
    };
    let probabilities = candle_nn::ops::softmax_last_dim(&scores)?;
    let attended = probabilities.matmul(value)?;
    Ok(if repeats == 1 {
        attended
    } else {
        attended.reshape((batch, heads, sequence, head_dim))?
    })
}

/// Half-split RoPE (llama style), matching mlx `fast::rope(traditional=false)`.
/// `x` is [batch, heads, sequence, head_dim]; `offset` is the KV cache length.
pub fn rope(x: &Tensor, theta: f32, offset: usize) -> Result<Tensor> {
    let (_batch, _heads, sequence, head_dim) = x.dims4()?;
    let (cos, sin) = rope_tables(theta, head_dim, offset, sequence, x.dtype(), x.device())?;
    Ok(candle_nn::rotary_emb::rope(&x.contiguous()?, &cos, &sin)?)
}

/// RoPE cos/sin tables kept resident on the device. During autoregressive decoding each step only does one `narrow`, replacing the earlier “rebuild on host + upload”.
pub struct RopeCache {
    theta: f32,
    head_dim: usize,
    dtype: DType,
    device: Device,
    tables: Mutex<Option<RopeTables>>,
}

struct RopeTables {
    length: usize,
    cos: Tensor,
    sin: Tensor,
}

impl RopeCache {
    pub fn new(theta: f32, head_dim: usize, dtype: DType, device: &Device) -> Self {
        Self {
            theta,
            head_dim,
            dtype,
            device: device.clone(),
            tables: Mutex::new(None),
        }
    }

    pub fn apply(&self, x: &Tensor, offset: usize) -> Result<Tensor> {
        let (_batch, _heads, sequence, head_dim) = x.dims4()?;
        if head_dim != self.head_dim || x.dtype() != self.dtype {
            return rope(x, self.theta, offset);
        }
        let required = offset + sequence;
        let mut guard = self.tables.lock().map_err(|_| anyhow!("the RoPE table lock is poisoned"))?;
        if guard.as_ref().is_none_or(|tables| tables.length < required) {
            let length = required.next_multiple_of(ROPE_TABLE_STEP).max(ROPE_TABLE_STEP);
            let (cos, sin) = rope_tables(self.theta, self.head_dim, 0, length, self.dtype, &self.device)?;
            *guard = Some(RopeTables { length, cos, sin });
        }
        let tables = guard.as_ref().expect("the RoPE tables are initialized");
        let cos = tables.cos.narrow(0, offset, sequence)?;
        let sin = tables.sin.narrow(0, offset, sequence)?;
        drop(guard);
        Ok(candle_nn::rotary_emb::rope(&x.contiguous()?, &cos, &sin)?)
    }
}

fn rope_tables(theta: f32, head_dim: usize, offset: usize, length: usize, dtype: DType, device: &Device) -> Result<(Tensor, Tensor)> {
    let half = head_dim / 2;
    let mut cos = Vec::with_capacity(length * half);
    let mut sin = Vec::with_capacity(length * half);
    for position in offset..offset + length {
        for index in 0..half {
            let frequency = (position as f64) * (theta as f64).powf(-2.0 * index as f64 / head_dim as f64);
            cos.push(frequency.cos() as f32);
            sin.push(frequency.sin() as f32);
        }
    }
    let cos = Tensor::from_vec(cos, (length, half), device)?.to_dtype(dtype)?;
    let sin = Tensor::from_vec(sin, (length, half), device)?.to_dtype(dtype)?;
    Ok((cos, sin))
}

/// The negative bias used by the attention mask. It must lie within the representable range of the target precision: under f16, `-1e9` overflows to `-inf`, and multiplying it by the 0 at “unmasked” positions then produces NaN, ruining the whole layer's output.
pub fn mask_bias(dtype: DType) -> f64 {
    match dtype {
        DType::F16 => -6.0e4,
        _ => -1e9,
    }
}

/// Causal attention mask: allows attending to the entire cache and to itself and earlier tokens.
/// Generated directly on the device by comparing arange values, avoiding laying out O(seq×total) on the host during prefill.
pub fn causal_mask(sequence: usize, cache_length: usize, device: &Device, dtype: DType) -> Result<Tensor> {
    let total = sequence + cache_length;
    let rows = Tensor::arange(cache_length as u32, (cache_length + sequence) as u32, device)?.reshape((sequence, 1))?;
    let columns = Tensor::arange(0_u32, total as u32, device)?.reshape((1, total))?;
    let blocked = columns.broadcast_gt(&rows)?;
    Ok(blocked
        .to_dtype(DType::F32)?
        .affine(mask_bias(dtype), 0.0)?
        .to_dtype(dtype)?
        .reshape((1, 1, sequence, total))?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candle_core::IndexOp;

    /// GQA now folds the repeated q heads into the sequence dimension; the result must match the naive implementation that copies kv group by group.
    #[test]
    fn grouped_query_attention_matches_repeated_kv() {
        let device = Device::Cpu;
        let (batch, heads, kv_heads, sequence, total, width) = (1, 4, 2, 3, 5, 8);
        let query = Tensor::arange(0.0_f32, (heads * sequence * width) as f32, &device)
            .unwrap()
            .affine(0.01, -0.3)
            .unwrap()
            .reshape((batch, heads, sequence, width))
            .unwrap();
        let key = Tensor::arange(0.0_f32, (kv_heads * total * width) as f32, &device)
            .unwrap()
            .affine(0.013, -0.2)
            .unwrap()
            .reshape((batch, kv_heads, total, width))
            .unwrap();
        let value = Tensor::arange(0.0_f32, (kv_heads * total * width) as f32, &device)
            .unwrap()
            .affine(-0.017, 0.4)
            .unwrap()
            .reshape((batch, kv_heads, total, width))
            .unwrap();
        let mask = causal_mask(sequence, total - sequence, &device, DType::F32).unwrap();

        let repeats = heads / kv_heads;
        let repeated = |tensor: &Tensor| {
            tensor
                .unsqueeze(2)
                .unwrap()
                .expand((batch, kv_heads, repeats, total, width))
                .unwrap()
                .reshape((batch, heads, total, width))
                .unwrap()
        };
        let scores = (query.matmul(&repeated(&key).transpose(2, 3).unwrap()).unwrap() * 0.35)
            .unwrap()
            .broadcast_add(&mask)
            .unwrap();
        let expected = candle_nn::ops::softmax_last_dim(&scores)
            .unwrap()
            .matmul(&repeated(&value))
            .unwrap();

        let actual = scaled_dot_product_attention(&query, &key, &value, 0.35, Some(&mask)).unwrap();
        assert_eq!(actual.dims(), expected.dims());
        let actual = actual.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        let expected = expected.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        for (left, right) in actual.iter().zip(expected.iter()) {
            assert!((left - right).abs() < 1e-5, "{left} vs {right}");
        }
    }

    /// After the cache table crosses a growth boundary, the sliced result must still match RoPE rebuilt from scratch each time exactly.
    #[test]
    fn rope_cache_matches_uncached_rope_across_growth() {
        let device = Device::Cpu;
        let cache = RopeCache::new(1_000_000.0, 8, DType::F32, &device);
        for offset in [0_usize, 7, ROPE_TABLE_STEP - 1, ROPE_TABLE_STEP + 5] {
            let input = Tensor::arange(0.0_f32, 16.0, &device).unwrap().reshape((1, 2, 1, 8)).unwrap();
            let cached = cache.apply(&input, offset).unwrap();
            let direct = rope(&input, 1_000_000.0, offset).unwrap();
            let cached = cached.flatten_all().unwrap().to_vec1::<f32>().unwrap();
            let direct = direct.flatten_all().unwrap().to_vec1::<f32>().unwrap();
            assert_eq!(cached, direct, "offset={offset}");
        }
    }

    /// The mask bias must stay finite at the target precision; otherwise unmasked positions would produce 0 × -inf = NaN.
    #[test]
    fn causal_mask_stays_finite_in_every_dtype() {
        let device = Device::Cpu;
        for dtype in [DType::F32, DType::BF16, DType::F16] {
            let mask = causal_mask(2, 1, &device, dtype).unwrap();
            assert_eq!(mask.dims(), &[1, 1, 2, 3]);
            let values = mask.to_dtype(DType::F32).unwrap().flatten_all().unwrap().to_vec1::<f32>().unwrap();
            assert!(
                values.iter().all(|value| value.is_finite()),
                "{dtype:?} mask has non-finite values: {values:?}"
            );
            // Row 0 can only see the cache and itself; row 1 can see one more position.
            assert_eq!(values[1], 0.0);
            assert!(values[2] < -1.0e3);
            assert_eq!(values[5], 0.0);
        }
    }

    /// LayerNorm switches to f32 reductions for half-precision input; the output precision must be close to the f32 path.
    #[test]
    fn layer_norm_half_precision_tracks_f32() {
        let device = Device::Cpu;
        let input = Tensor::arange(0.0_f32, 12.0, &device).unwrap().reshape((1, 2, 6)).unwrap();
        let norm = LayerNorm {
            weight: None,
            bias: None,
            eps: 1e-5,
        };
        let reference = norm.forward(&input).unwrap();
        let half = norm
            .forward(&input.to_dtype(DType::BF16).unwrap())
            .unwrap()
            .to_dtype(DType::F32)
            .unwrap();
        assert_eq!(half.dims(), reference.dims());
        let reference = reference.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        let half = half.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        for (left, right) in half.iter().zip(reference.iter()) {
            assert!((left - right).abs() < 0.05, "{left} vs {right}");
        }
    }

    /// Dense only stores the transposed layout; the forward result must still equal `x · Wᵀ + b`.
    #[test]
    fn dense_forward_matches_row_major_weight() {
        let device = Device::Cpu;
        let weight = Tensor::arange(0.0_f32, 6.0, &device).unwrap().reshape((3, 2)).unwrap();
        let bias = Tensor::from_vec(vec![0.5_f32, -0.5, 1.0], (3,), &device).unwrap();
        let dense = Dense::from_weight(weight, Some(bias)).unwrap();
        let input = Tensor::from_vec(vec![1.0_f32, 2.0], (1, 1, 2), &device).unwrap();
        let output = dense.forward(&input).unwrap().flatten_all().unwrap().to_vec1::<f32>().unwrap();
        // W = [[0,1],[2,3],[4,5]], x = [1,2] → [2, 8, 14], then add bias.
        assert_eq!(output, vec![2.5, 7.5, 15.0]);
    }

    /// Tied embedding stores only [hidden, vocab]; both the lookup and the output projection must preserve their original semantics.
    #[test]
    fn token_embedding_lookup_and_projection_agree() {
        let device = Device::Cpu;
        let weight = Tensor::arange(0.0_f32, 12.0, &device).unwrap().reshape((4, 3)).unwrap();
        let embedding = TokenEmbedding {
            weight_t: weight.t().unwrap().contiguous().unwrap(),
        };
        let ids = Tensor::from_vec(vec![2_u32, 0], (1, 2), &device).unwrap();
        let rows = embedding.forward(&ids).unwrap();
        assert_eq!(rows.dims(), &[1, 2, 3]);
        assert_eq!(
            rows.flatten_all().unwrap().to_vec1::<f32>().unwrap(),
            vec![6.0, 7.0, 8.0, 0.0, 1.0, 2.0]
        );
        let logits = embedding.as_linear(&rows.i((.., 0..1, ..)).unwrap()).unwrap();
        assert_eq!(logits.dims(), &[1, 1, 4]);
        // Dot products of [6,7,8] with each row of the vocabulary.
        assert_eq!(
            logits.flatten_all().unwrap().to_vec1::<f32>().unwrap(),
            vec![23.0, 86.0, 149.0, 212.0]
        );
    }
}
