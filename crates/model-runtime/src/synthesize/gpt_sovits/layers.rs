//! Base layers used by GPT-SoVITS: linear, LayerNorm, Conv1d (NLC layout) and activation functions.
//!
//! Ported from v2 `ccut-tts::index_tts2::mlx::layers` (the copy shared by IndexTTS2 and GPT-SoVITS). It carries only the parts GPT-SoVITS uses and drops the Candle branch. It shares its origin with the same-named layers in IndexTTS2; once both are ported they can be merged into one.
//!
//! Linear weights stay resident in safetensors' f16 form as-is, and are converted to the input dtype on the forward pass (matching MLX matmul type promotion);
//! convolution and normalization parameters are converted to f32 at load time.

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
}

/// Activation functions: the compiled versions in mlx-rs `nn::*` are not used (they recompile for every shape); the formulas are expanded directly instead.
pub mod act {
    use crate::synthesize::tensor::{Array, ops};
    use anyhow::Result;

    /// Exact GELU: `x · (1 + erf(x/√2)) / 2`.
    pub fn gelu(x: &Array) -> Result<Array> {
        let erf = ops::erf(x * std::f32::consts::FRAC_1_SQRT_2)?;
        Ok(x * (erf + 1.0f32) * 0.5f32)
    }

    pub fn softplus(x: &Array) -> Result<Array> {
        Ok(ops::logaddexp(x, &Array::from_f32(0.0))?)
    }

    pub fn mish(x: &Array) -> Result<Array> {
        Ok(x * ops::tanh(softplus(x)?)?)
    }
}
