//! Partly rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/IndexTTS2TTS/IndexTTS2SemanticGPT.swift / Sources/IndexTTS2TTS/IndexTTS2BigVGAN.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Base layers: Linear, LayerNorm, Conv1d (NLC / NCL layouts), Conv2d (NHWC),
//! BatchNorm (inference), GroupNorm (PyTorch-compatible), embedding lookup.
//!
//! Linear weights stay in their safetensors f16 form and are cast to the input dtype in the forward pass (matching speech-swift
//! `weight.asType(x.dtype)` / MLX matmul type promotion); convolution and normalization parameters are converted to f32 at load time.

use super::weights::WeightMap;
use crate::synthesize::tensor::{Array, Dtype, fast, ops};
use anyhow::Result;

/// `y = x @ Wᵀ + b`, with weight shape `[out, in]` (PyTorch layout).
pub struct Linear {
    pub weight: Array,
    pub bias: Option<Array>,
}

impl Linear {
    pub fn load(weights: &mut WeightMap, prefix: &str) -> Result<Self> {
        let weight = weights.take(&format!("{prefix}.weight"))?;
        let bias = weights.take_optional_f32(&format!("{prefix}.bias"))?;
        Ok(Self { weight, bias })
    }

    pub fn load_no_bias(weights: &mut WeightMap, prefix: &str) -> Result<Self> {
        let weight = weights.take(&format!("{prefix}.weight"))?;
        Ok(Self { weight, bias: None })
    }

    /// Constructs from f32 weights fused from weight-norm (g, v).
    pub fn load_weight_norm(weights: &mut WeightMap, prefix: &str) -> Result<Self> {
        let weight = weights.take_weight_norm(prefix)?;
        let bias = weights.take_optional_f32(&format!("{prefix}.bias"))?;
        Ok(Self { weight, bias })
    }

    pub fn forward(&self, x: &Array) -> Result<Array> {
        #[cfg(not(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")))]
        return crate::synthesize::tensor::linear(x, &self.weight, self.bias.as_ref());
        #[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
        {
            let weight = self.weight.as_dtype(x.dtype())?;
            let mut y = ops::matmul(x, weight.t())?;
            if let Some(bias) = &self.bias {
                y = y + bias.as_dtype(x.dtype())?;
            }
            Ok(y)
        }
    }
}

/// LayerNorm over the last dimension (optional affine).
pub struct LayerNorm {
    pub weight: Option<Array>,
    pub bias: Option<Array>,
    pub eps: f32,
}

impl LayerNorm {
    pub fn load(weights: &mut WeightMap, prefix: &str, eps: f32) -> Result<Self> {
        Ok(Self {
            weight: Some(weights.take_f32(&format!("{prefix}.weight"))?),
            bias: weights.take_optional_f32(&format!("{prefix}.bias"))?,
            eps,
        })
    }

    pub fn forward(&self, x: &Array) -> Result<Array> {
        let x32 = x.as_dtype(Dtype::Float32)?;
        Ok(fast::layer_norm(&x32, self.weight.as_ref(), self.bias.as_ref(), self.eps)?)
    }
}

/// `x * rsqrt(mean(x²) + eps) * weight`。
pub struct RmsNorm {
    pub weight: Array,
    pub eps: f32,
}

impl RmsNorm {
    pub fn load(weights: &mut WeightMap, key: &str, eps: f32) -> Result<Self> {
        Ok(Self {
            weight: weights.take_f32(key)?,
            eps,
        })
    }

    pub fn forward(&self, x: &Array) -> Result<Array> {
        let x32 = x.as_dtype(Dtype::Float32)?;
        Ok(fast::rms_norm(&x32, &self.weight, self.eps)?)
    }
}

/// 1D convolution. Weights are stored internally in MLX layout `[Cout, K, Cin/groups]` (f32).
pub struct Conv1d {
    pub weight: Array,
    pub bias: Option<Array>,
    pub stride: i32,
    pub padding: i32,
    pub dilation: i32,
    pub groups: i32,
}

impl Conv1d {
    /// Constructs from weights in PyTorch layout `[Cout, Cin/groups, K]`.
    pub fn from_torch(weight: Array, bias: Option<Array>) -> Result<Self> {
        let weight = weight.as_dtype(Dtype::Float32)?.transpose_axes(&[0, 2, 1])?;
        Ok(Self {
            weight,
            bias,
            stride: 1,
            padding: 0,
            dilation: 1,
            groups: 1,
        })
    }

    pub fn load(weights: &mut WeightMap, prefix: &str) -> Result<Self> {
        let weight = weights.take(&format!("{prefix}.weight"))?;
        let bias = weights.take_optional_f32(&format!("{prefix}.bias"))?;
        Self::from_torch(weight, bias)
    }

    pub fn load_weight_norm(weights: &mut WeightMap, prefix: &str) -> Result<Self> {
        let weight = weights.take_weight_norm(prefix)?;
        let bias = weights.take_optional_f32(&format!("{prefix}.bias"))?;
        Self::from_torch(weight, bias)
    }

    pub fn with_stride(mut self, stride: i32) -> Self {
        self.stride = stride;
        self
    }

    pub fn with_padding(mut self, padding: i32) -> Self {
        self.padding = padding;
        self
    }

    pub fn with_dilation(mut self, dilation: i32) -> Self {
        self.dilation = dilation;
        self
    }

    pub fn with_groups(mut self, groups: i32) -> Self {
        self.groups = groups;
        self
    }

    /// Input `[N, L, Cin]`, output `[N, L', Cout]`.
    pub fn forward_nlc(&self, x: &Array) -> Result<Array> {
        let mut y = ops::conv1d(x, &self.weight, self.stride, self.padding, self.dilation, self.groups)?;
        if let Some(bias) = &self.bias {
            y = y + bias;
        }
        Ok(y)
    }

    /// Input `[N, Cin, L]`, output `[N, Cout, L']`.
    pub fn forward_ncl(&self, x: &Array) -> Result<Array> {
        let x = x.swap_axes(1, 2)?;
        let y = self.forward_nlc(&x)?;
        Ok(y.swap_axes(1, 2)?)
    }
}

/// 2D convolution (NHWC). Weights are stored internally as `[Cout, H, W, Cin]` (f32).
pub struct Conv2d {
    pub weight: Array,
    pub bias: Option<Array>,
    pub stride: (i32, i32),
    pub padding: (i32, i32),
}

impl Conv2d {
    /// Constructs from PyTorch layout `[Cout, Cin, H, W]`.
    pub fn from_torch(weight: Array, bias: Option<Array>) -> Result<Self> {
        let weight = weight.as_dtype(Dtype::Float32)?.transpose_axes(&[0, 2, 3, 1])?;
        Ok(Self {
            weight,
            bias,
            stride: (1, 1),
            padding: (0, 0),
        })
    }

    pub fn load(weights: &mut WeightMap, prefix: &str) -> Result<Self> {
        let weight = weights.take(&format!("{prefix}.weight"))?;
        let bias = weights.take_optional_f32(&format!("{prefix}.bias"))?;
        Self::from_torch(weight, bias)
    }

    pub fn with_stride(mut self, stride: (i32, i32)) -> Self {
        self.stride = stride;
        self
    }

    pub fn with_padding(mut self, padding: (i32, i32)) -> Self {
        self.padding = padding;
        self
    }

    /// Input `[N, H, W, Cin]`.
    pub fn forward_nhwc(&self, x: &Array) -> Result<Array> {
        let mut y = ops::conv2d(x, &self.weight, self.stride, self.padding, None, None)?;
        if let Some(bias) = &self.bias {
            y = y + bias;
        }
        Ok(y)
    }
}

/// Inference-mode BatchNorm: pre-folded into `scale` / `shift`, applied over the last dimension.
pub struct BatchNorm {
    pub scale: Array,
    pub shift: Array,
}

impl BatchNorm {
    pub fn load(weights: &mut WeightMap, prefix: &str, eps: f32) -> Result<Self> {
        let mean = weights.take_f32(&format!("{prefix}.running_mean"))?;
        let var = weights.take_f32(&format!("{prefix}.running_var"))?;
        let gamma = weights.take_optional_f32(&format!("{prefix}.weight"))?;
        let beta = weights.take_optional_f32(&format!("{prefix}.bias"))?;
        let _ = weights.take_optional(&format!("{prefix}.num_batches_tracked"));
        let inv = (var + eps).rsqrt()?;
        let scale = match &gamma {
            Some(g) => g * &inv,
            None => inv,
        };
        let mut shift = -(&mean * &scale);
        if let Some(b) = &beta {
            shift = shift + b;
        }
        Ok(Self { scale, shift })
    }

    /// Channels are in the last dimension.
    pub fn forward_channels_last(&self, x: &Array) -> Result<Array> {
        Ok(x * &self.scale + &self.shift)
    }
}

/// `GroupNorm(num_groups=1)` (PyTorch semantics: statistics over all elements of [C, L], then a per-channel affine transform).
/// Input `[N, C, L]`.
pub struct GroupNorm1 {
    pub weight: Array,
    pub bias: Array,
    pub eps: f32,
}

impl GroupNorm1 {
    pub fn load(weights: &mut WeightMap, prefix: &str, eps: f32) -> Result<Self> {
        Ok(Self {
            weight: weights.take_f32(&format!("{prefix}.weight"))?,
            bias: weights.take_f32(&format!("{prefix}.bias"))?,
            eps,
        })
    }

    pub fn forward_ncl(&self, x: &Array) -> Result<Array> {
        let n = x.dim(0);
        let c = x.dim(1);
        let flat = x.reshape(&[n, -1])?;
        let mean = flat.mean_axis(-1, true)?;
        let var = flat.var_axis(-1, true, 0)?;
        let normalized = ((flat - mean) / (var + self.eps).sqrt()?).reshape(x.shape())?;
        let weight = self.weight.reshape(&[1, c, 1])?;
        let bias = self.bias.reshape(&[1, c, 1])?;
        Ok(normalized * weight + bias)
    }
}

/// Activation functions: not using the compiled versions from mlx-rs `nn::*` (each shape would be recompiled); the formulas are expanded directly.
pub mod act {
    use crate::synthesize::tensor::{Array, ops};
    use anyhow::Result;

    pub fn silu(x: &Array) -> Result<Array> {
        Ok(x * ops::sigmoid(x)?)
    }

    /// Exact GELU: `x · (1 + erf(x/√2)) / 2`.
    pub fn gelu(x: &Array) -> Result<Array> {
        let erf = ops::erf(x * std::f32::consts::FRAC_1_SQRT_2)?;
        Ok(x * (erf + 1.0f32) * 0.5f32)
    }

    /// tanh-approximated GELU (GPT-2 `gelu_new`).
    pub fn gelu_tanh(x: &Array) -> Result<Array> {
        let inner = (x + x.square()?.multiply(x)? * 0.044_715f32) * (2.0f32 / std::f32::consts::PI).sqrt();
        Ok(x * 0.5f32 * (ops::tanh(inner)? + 1.0f32))
    }

    pub fn softplus(x: &Array) -> Result<Array> {
        Ok(ops::logaddexp(x, &Array::from_f32(0.0))?)
    }

    pub fn mish(x: &Array) -> Result<Array> {
        Ok(x * ops::tanh(softplus(x)?)?)
    }
}

pub fn ids_1d(ids: &[i32]) -> Array {
    Array::from_slice(ids, &[ids.len() as i32])
}
