//! Partly implemented by rewriting speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/Qwen3TTS/Talker.swift / Sources/Qwen3TTS/CodePredictor.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! Shared Qwen3-TTS layers: linear / quantized linear, RMSNorm, LayerNorm, Embedding,
//! GQA attention (RoPE + KV cache), SwiGLU MLP, and causal convolution helpers.

use crate::synthesize::tensor::fast::{self, ScaledDotProductAttentionMask};
use crate::synthesize::tensor::nn::silu;
use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Result, bail};

use super::weights::Weights;

/// Plain or quantized linear layer, chosen automatically by whether `{prefix}.scales` exists (corresponds to `makeMaybeQuantizedLinear`
/// plus `applyQuantizedLinearWeights`).
pub enum Linear {
    Float {
        weight: Array,
        bias: Option<Array>,
    },
    #[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
    Quantized {
        weight: Array,
        scales: Array,
        biases: Array,
        bias: Option<Array>,
        group_size: i32,
        bits: i32,
    },
}

impl Linear {
    pub fn load(weights: &mut Weights, prefix: &str, group_size: usize, bits: u32) -> Result<Self> {
        let weight = weights.take(&format!("{prefix}.weight"))?;
        let bias = weights.take_optional(&format!("{prefix}.bias"));
        if let Some(scales) = weights.take_optional(&format!("{prefix}.scales")) {
            if bits == 0 {
                bail!("weight {prefix} has scales but the config does not declare quantization bits");
            }
            let biases = weights.take(&format!("{prefix}.biases"))?;
            #[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
            {
                let weight = crate::synthesize::tensor::dequantize(&weight, &scales, &biases, group_size, bits)?;
                return Ok(Self::Float { weight, bias });
            }
            #[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
            return Ok(Self::Quantized {
                weight,
                scales,
                biases,
                bias,
                group_size: group_size as i32,
                bits: bits as i32,
            });
        }
        if weight.dtype() == Dtype::Uint32 {
            bail!("weight {prefix} is U32 but has no scales");
        }
        Ok(Self::Float { weight, bias })
    }

    pub fn forward(&self, input: &Array) -> Result<Array> {
        match self {
            Self::Float { weight, bias } => {
                let output = ops::matmul(input, weight.t())?;
                Ok(match bias {
                    Some(bias) => output.add(bias)?,
                    None => output,
                })
            }
            #[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
            Self::Quantized {
                weight,
                scales,
                biases,
                bias,
                group_size,
                bits,
            } => {
                let output = ops::quantized_matmul(input, weight, scales, biases, true, *group_size, *bits)?;
                Ok(match bias {
                    Some(bias) => output.add(bias)?,
                    None => output,
                })
            }
        }
    }
}

pub struct RmsNorm {
    weight: Array,
    eps: f32,
}

impl RmsNorm {
    pub fn load(weights: &mut Weights, prefix: &str, eps: f32) -> Result<Self> {
        Ok(Self {
            weight: weights.take(&format!("{prefix}.weight"))?,
            eps,
        })
    }

    pub fn forward(&self, input: &Array) -> Result<Array> {
        Ok(fast::rms_norm(input, &self.weight, self.eps)?)
    }
}

pub struct LayerNorm {
    weight: Option<Array>,
    bias: Option<Array>,
    eps: f32,
}

impl LayerNorm {
    pub fn load(weights: &mut Weights, prefix: &str, eps: f32) -> Result<Self> {
        let weight = weights.take_optional(&format!("{prefix}.weight"));
        let bias = weights.take_optional(&format!("{prefix}.bias"));
        if weight.is_none() && bias.is_none() {
            bail!("missing LayerNorm weight: {prefix}");
        }
        Ok(Self { weight, bias, eps })
    }

    pub fn forward(&self, input: &Array) -> Result<Array> {
        Ok(fast::layer_norm(input, self.weight.as_ref(), self.bias.as_ref(), self.eps)?)
    }
}

pub struct Embedding {
    weight: Array,
}

impl Embedding {
    pub fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        Ok(Self {
            weight: weights.take(&format!("{prefix}.weight"))?,
        })
    }

    /// `ids` of shape `[B, S]` (Int32) → `[B, S, D]`.
    pub fn forward(&self, ids: &Array) -> Array {
        self.weight.index(ids)
    }
}

/// SwiGLU MLP：`down(silu(gate(x)) * up(x))`。
pub struct SwigluMlp {
    gate_proj: Linear,
    up_proj: Linear,
    down_proj: Linear,
}

impl SwigluMlp {
    pub fn load(weights: &mut Weights, prefix: &str, group_size: usize, bits: u32) -> Result<Self> {
        Ok(Self {
            gate_proj: Linear::load(weights, &format!("{prefix}.gate_proj"), group_size, bits)?,
            up_proj: Linear::load(weights, &format!("{prefix}.up_proj"), group_size, bits)?,
            down_proj: Linear::load(weights, &format!("{prefix}.down_proj"), group_size, bits)?,
        })
    }

    pub fn forward(&self, x: &Array) -> Result<Array> {
        let gate = silu(self.gate_proj.forward(x)?)?;
        let up = self.up_proj.forward(x)?;
        self.down_proj.forward(&gate.multiply(&up)?)
    }
}

/// KV cache of a single layer: `[B, KV, T, D]`.
#[derive(Clone)]
pub struct KvCache {
    pub keys: Array,
    pub values: Array,
}

impl KvCache {
    pub fn len(&self) -> i32 {
        self.keys.dim(2)
    }
}

/// Qwen3-style GQA attention: q/k RMSNorm → RoPE (non-traditional) → KV cache concatenation → SDPA.
pub struct Attention {
    num_heads: i32,
    num_kv_heads: i32,
    head_dim: i32,
    rope_theta: f32,
    scale: f32,
    q_proj: Linear,
    k_proj: Linear,
    v_proj: Linear,
    o_proj: Linear,
    q_norm: RmsNorm,
    k_norm: RmsNorm,
}

pub struct AttentionDims {
    pub num_heads: usize,
    pub num_kv_heads: usize,
    pub head_dim: usize,
    pub rope_theta: f32,
    pub rms_norm_eps: f32,
}

impl Attention {
    pub fn load(weights: &mut Weights, prefix: &str, dims: &AttentionDims, group_size: usize, bits: u32) -> Result<Self> {
        Ok(Self {
            num_heads: dims.num_heads as i32,
            num_kv_heads: dims.num_kv_heads as i32,
            head_dim: dims.head_dim as i32,
            rope_theta: dims.rope_theta,
            scale: (dims.head_dim as f32).sqrt().recip(),
            q_proj: Linear::load(weights, &format!("{prefix}.q_proj"), group_size, bits)?,
            k_proj: Linear::load(weights, &format!("{prefix}.k_proj"), group_size, bits)?,
            v_proj: Linear::load(weights, &format!("{prefix}.v_proj"), group_size, bits)?,
            o_proj: Linear::load(weights, &format!("{prefix}.o_proj"), group_size, bits)?,
            q_norm: RmsNorm::load(weights, &format!("{prefix}.q_norm"), dims.rms_norm_eps)?,
            k_norm: RmsNorm::load(weights, &format!("{prefix}.k_norm"), dims.rms_norm_eps)?,
        })
    }

    /// `offset` is the RoPE position offset; `mask` is an explicit additive mask (`[1,1,S,T]`). When empty, S>1 uses a causal mask and
    /// S==1 uses no mask (equivalent to a hand-built `-1e9` mask).
    pub fn forward(&self, hidden: &Array, offset: i32, mask: Option<&Array>, cache: Option<&KvCache>) -> Result<(Array, KvCache)> {
        let batch = hidden.dim(0);
        let seq_len = hidden.dim(1);
        let queries = self
            .q_proj
            .forward(hidden)?
            .reshape(&[batch, seq_len, self.num_heads, self.head_dim])?;
        let keys = self
            .k_proj
            .forward(hidden)?
            .reshape(&[batch, seq_len, self.num_kv_heads, self.head_dim])?;
        let values = self
            .v_proj
            .forward(hidden)?
            .reshape(&[batch, seq_len, self.num_kv_heads, self.head_dim])?
            .transpose_axes(&[0, 2, 1, 3])?;
        let queries = self.q_norm.forward(&queries)?.transpose_axes(&[0, 2, 1, 3])?;
        let keys = self.k_norm.forward(&keys)?.transpose_axes(&[0, 2, 1, 3])?;
        let queries = fast::rope(&queries, self.head_dim, false, self.rope_theta, 1.0, offset, None)?;
        let keys = fast::rope(&keys, self.head_dim, false, self.rope_theta, 1.0, offset, None)?;
        let (cached_keys, cached_values) = match cache {
            Some(cache) => (
                ops::concatenate_axis(&[&cache.keys, &keys], 2)?,
                ops::concatenate_axis(&[&cache.values, &values], 2)?,
            ),
            None => (keys, values),
        };
        let mask_mode = match mask {
            Some(mask) => Some(ScaledDotProductAttentionMask::Array(mask)),
            None if seq_len > 1 => Some(ScaledDotProductAttentionMask::Causal),
            None => None,
        };
        let attended = fast::scaled_dot_product_attention(&queries, &cached_keys, &cached_values, self.scale, mask_mode, None)?;
        let merged = attended
            .transpose_axes(&[0, 2, 1, 3])?
            .reshape(&[batch, seq_len, self.num_heads * self.head_dim])?;
        Ok((
            self.o_proj.forward(&merged)?,
            KvCache {
                keys: cached_keys,
                values: cached_values,
            },
        ))
    }
}

/// Qwen3 pre-norm decoder layer (structure shared by the Talker and the Code Predictor).
pub struct DecoderLayer {
    self_attn: Attention,
    mlp: SwigluMlp,
    input_layernorm: RmsNorm,
    post_attention_layernorm: RmsNorm,
}

impl DecoderLayer {
    pub fn load(weights: &mut Weights, prefix: &str, dims: &AttentionDims, group_size: usize, bits: u32) -> Result<Self> {
        Ok(Self {
            self_attn: Attention::load(weights, &format!("{prefix}.self_attn"), dims, group_size, bits)?,
            mlp: SwigluMlp::load(weights, &format!("{prefix}.mlp"), group_size, bits)?,
            input_layernorm: RmsNorm::load(weights, &format!("{prefix}.input_layernorm"), dims.rms_norm_eps)?,
            post_attention_layernorm: RmsNorm::load(weights, &format!("{prefix}.post_attention_layernorm"), dims.rms_norm_eps)?,
        })
    }

    pub fn forward(&self, hidden: &Array, offset: i32, mask: Option<&Array>, cache: Option<&KvCache>) -> Result<(Array, KvCache)> {
        let normed = self.input_layernorm.forward(hidden)?;
        let (attn, new_cache) = self.self_attn.forward(&normed, offset, mask, cache)?;
        let hidden = hidden.add(&attn)?;
        let normed = self.post_attention_layernorm.forward(&hidden)?;
        let mlp = self.mlp.forward(&normed)?;
        Ok((hidden.add(&mlp)?, new_cache))
    }
}

/// Causal Conv1d (left-pads with `(k-1)*dilation`); input `[B, T, C]`, weight in MLX layout `[out, k, in]`.
pub struct CausalConv1d {
    weight: Array,
    bias: Option<Array>,
    stride: i32,
    dilation: i32,
    groups: i32,
}

impl CausalConv1d {
    pub fn new(weight: Array, bias: Option<Array>, stride: i32, dilation: i32, groups: i32) -> Self {
        Self {
            weight,
            bias,
            stride,
            dilation,
            groups,
        }
    }

    pub fn kernel_size(&self) -> i32 {
        self.weight.dim(1)
    }

    /// Causal convolution that left-pads with `(k-1)*dilation` zeros.
    pub fn forward(&self, x: &Array) -> Result<Array> {
        let pad_total = (self.kernel_size() - 1) * self.dilation;
        if pad_total == 0 {
            return self.forward_padded(x);
        }
        let padded = ops::pad(x, &[(0, 0), (pad_total, 0), (0, 0)], Array::from_f32(0.0), None)?;
        self.forward_padded(&padded)
    }

    /// No padding; convolves directly (the caller has already padded the input).
    pub fn forward_padded(&self, x: &Array) -> Result<Array> {
        let out = ops::conv1d(x, &self.weight, self.stride, 0, self.dilation, self.groups)?;
        Ok(match &self.bias {
            Some(bias) => out.add(bias)?,
            None => out,
        })
    }
}

/// Causal ConvTranspose1d: full transposed convolution, then trims the rightmost `k - stride` samples.
pub struct CausalConvTranspose1d {
    weight: Array,
    bias: Option<Array>,
    stride: i32,
}

impl CausalConvTranspose1d {
    pub fn new(weight: Array, bias: Option<Array>, stride: i32) -> Self {
        Self { weight, bias, stride }
    }

    pub fn forward(&self, x: &Array) -> Result<Array> {
        let kernel = self.weight.dim(1);
        let out = ops::conv_transpose1d(x, &self.weight, self.stride, 0, 1, 0, 1)?;
        let out = match &self.bias {
            Some(bias) => out.add(bias)?,
            None => out,
        };
        let trim = kernel - self.stride;
        if trim > 0 {
            let length = out.dim(1);
            Ok(out.index((.., ..(length - trim), ..)))
        } else {
            Ok(out)
        }
    }
}

/// Converts a host-side i32 sequence into a `[1, S]` Int32 array.
pub fn token_array(tokens: &[i32]) -> Array {
    Array::from_slice(tokens, &[1, tokens.len() as i32])
}
