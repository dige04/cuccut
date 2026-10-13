//! Partly implemented by rewriting speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3TTS/SpeakerEncoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! ECAPA-TDNN speaker encoder (for voice cloning with the Base model): 128-dim log-mel → 1024-dim voice vector.

use crate::synthesize::tensor::nn::{relu, sigmoid};
use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Result, bail};

use super::weights::Weights;

const MEL_BINS: i32 = 128;
const CHANNELS: i32 = 512;
const RES2NET_SCALE: i32 = 8;
const SE_BOTTLENECK: i32 = 128;
const ASP_ATTENTION: i32 = 128;

/// Ordinary (symmetric zero-padded) Conv1d, input `[B, T, C]`, weight in MLX layout `[out, k, in]`.
struct Conv1d {
    weight: Array,
    bias: Option<Array>,
    padding: i32,
    dilation: i32,
}

impl Conv1d {
    /// The exported layouts of the speaker encoder are not uniform (some are MLX `[out,k,in]`, others PyTorch
    /// `[out,in,k]`). The layout is determined by `in_channels`, and only the PyTorch layout is transposed.
    fn load(weights: &mut Weights, prefix: &str, in_channels: i32, padding: i32, dilation: i32) -> Result<Self> {
        let raw = weights.take(&format!("{prefix}.weight"))?;
        if raw.ndim() != 3 {
            bail!("{prefix}.weight is not a 3-D convolution kernel: {:?}", raw.shape());
        }
        let weight = if raw.dim(2) == in_channels {
            raw
        } else if raw.dim(1) == in_channels {
            raw.transpose_axes(&[0, 2, 1])?
        } else {
            bail!("{prefix}.weight shape {:?} does not match input channels {in_channels}", raw.shape());
        };
        let weight = weight.as_dtype(Dtype::Float32)?;
        let bias = weights
            .take_optional(&format!("{prefix}.bias"))
            .map(|bias| bias.as_dtype(Dtype::Float32))
            .transpose()?;
        Ok(Self {
            weight,
            bias,
            padding,
            dilation,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let out = ops::conv1d(x, &self.weight, 1, self.padding, self.dilation, 1)?;
        Ok(match &self.bias {
            Some(bias) => out.add(bias)?,
            None => out,
        })
    }
}

/// Squeeze-Excitation: temporal mean → conv1 → relu → conv2 → sigmoid → scale per channel.
struct SeBlock {
    conv1: Conv1d,
    conv2: Conv1d,
}

impl SeBlock {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        Ok(Self {
            conv1: Conv1d::load(weights, &format!("{prefix}.conv1"), CHANNELS, 0, 1)?,
            conv2: Conv1d::load(weights, &format!("{prefix}.conv2"), SE_BOTTLENECK, 0, 1)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let s = ops::mean_axis(x, 1, true)?;
        let h = sigmoid(self.conv2.forward(&relu(self.conv1.forward(&s)?)?)?)?;
        Ok(x.multiply(&h)?)
    }
}

/// Res2Net: channels are split into 8 chunks. Chunk i (i≥1) goes through `relu(conv[i-1](chunk (+ previous output)))`.
struct Res2NetBlock {
    convs: Vec<Conv1d>,
}

impl Res2NetBlock {
    fn load(weights: &mut Weights, prefix: &str, dilation: i32) -> Result<Self> {
        let width = CHANNELS / RES2NET_SCALE;
        let padding = ((3 - 1) * dilation) / 2;
        let mut convs = Vec::with_capacity((RES2NET_SCALE - 1) as usize);
        for index in 0..(RES2NET_SCALE - 1) {
            convs.push(Conv1d::load(
                weights,
                &format!("{prefix}.blocks.{index}.conv"),
                width,
                padding,
                dilation,
            )?);
        }
        Ok(Self { convs })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let width = x.dim(2) / RES2NET_SCALE;
        let mut outputs: Vec<Array> = Vec::with_capacity(RES2NET_SCALE as usize);
        for index in 0..RES2NET_SCALE {
            let chunk = x.index((.., .., (index * width)..((index + 1) * width)));
            if index == 0 {
                outputs.push(chunk);
                continue;
            }
            let input = if index == 1 {
                chunk
            } else {
                chunk.add(&outputs[(index - 1) as usize])?
            };
            outputs.push(relu(self.convs[(index - 1) as usize].forward(&input)?)?);
        }
        let refs: Vec<&Array> = outputs.iter().collect();
        Ok(ops::concatenate_axis(&refs, 2)?)
    }
}

struct EcapaBlock {
    tdnn1: Conv1d,
    res2net: Res2NetBlock,
    tdnn2: Conv1d,
    se_block: SeBlock,
}

impl EcapaBlock {
    fn load(weights: &mut Weights, prefix: &str, dilation: i32) -> Result<Self> {
        Ok(Self {
            tdnn1: Conv1d::load(weights, &format!("{prefix}.tdnn1.conv"), CHANNELS, 0, 1)?,
            res2net: Res2NetBlock::load(weights, &format!("{prefix}.res2net_block"), dilation)?,
            tdnn2: Conv1d::load(weights, &format!("{prefix}.tdnn2.conv"), CHANNELS, 0, 1)?,
            se_block: SeBlock::load(weights, &format!("{prefix}.se_block"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = relu(self.tdnn1.forward(x)?)?;
        let h = self.res2net.forward(&h)?;
        let h = relu(self.tdnn2.forward(&h)?)?;
        let h = self.se_block.forward(&h)?;
        Ok(h.add(x)?)
    }
}

/// Attentive statistics pooling: concatenates the global mean and standard deviation, computes attention, and outputs the attention-weighted mean ‖ attention-weighted standard deviation `[B, 2C]`.
struct AttentiveStatisticsPooling {
    tdnn: Conv1d,
    conv: Conv1d,
}

impl AttentiveStatisticsPooling {
    fn load(weights: &mut Weights, prefix: &str, channels: i32) -> Result<Self> {
        Ok(Self {
            tdnn: Conv1d::load(weights, &format!("{prefix}.tdnn.conv"), channels * 3, 0, 1)?,
            conv: Conv1d::load(weights, &format!("{prefix}.conv"), ASP_ATTENTION, 0, 1)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let floor = Array::from_f32(1e-12);
        let global_mean = ops::mean_axis(x, 1, true)?;
        let centered = x.subtract(&global_mean)?;
        let global_var = ops::mean_axis(&centered.multiply(&centered)?, 1, true)?;
        let global_std = ops::sqrt(&ops::maximum(&global_var, &floor)?)?;
        let mean_expanded = ops::broadcast_to(&global_mean, x.shape())?;
        let std_expanded = ops::broadcast_to(&global_std, x.shape())?;
        let attn_input = ops::concatenate_axis(&[x, &mean_expanded, &std_expanded], 2)?;
        let scores = self.conv.forward(&ops::tanh(&self.tdnn.forward(&attn_input)?)?)?;
        let alpha = ops::softmax_axis(&scores, 1, None)?;
        let weighted_mean = ops::sum_axis(&alpha.multiply(x)?, 1, false)?;
        let diff = x.subtract(&ops::expand_dims(&weighted_mean, 1)?)?;
        let weighted_var = ops::sum_axis(&alpha.multiply(&diff)?.multiply(&diff)?, 1, false)?;
        let weighted_std = ops::sqrt(&ops::maximum(&weighted_var, &floor)?)?;
        Ok(ops::concatenate_axis(&[&weighted_mean, &weighted_std], 1)?)
    }
}

pub struct SpeakerEncoder {
    initial_conv: Conv1d,
    blocks: Vec<EcapaBlock>,
    mfa: Conv1d,
    asp: AttentiveStatisticsPooling,
    fc: Conv1d,
}

impl SpeakerEncoder {
    /// `weights` already has the `speaker_encoder.` prefix stripped.
    pub fn load(weights: &mut Weights) -> Result<Self> {
        let mut blocks = Vec::with_capacity(3);
        for (index, dilation) in [2, 3, 4].into_iter().enumerate() {
            blocks.push(EcapaBlock::load(weights, &format!("blocks.{}", index + 1), dilation)?);
        }
        let cat_channels = CHANNELS * 3;
        Ok(Self {
            initial_conv: Conv1d::load(weights, "blocks.0.conv", MEL_BINS, 2, 1)?,
            blocks,
            mfa: Conv1d::load(weights, "mfa.conv", cat_channels, 0, 1)?,
            asp: AttentiveStatisticsPooling::load(weights, "asp", cat_channels)?,
            fc: Conv1d::load(weights, "fc", cat_channels * 2, 0, 1)?,
        })
    }

    /// `mels [B, T, 128]`（F32）→ `[B, 1024]`（F32）。
    pub fn forward(&self, mels: &Array) -> Result<Array> {
        let h0 = relu(self.initial_conv.forward(mels)?)?;
        let out1 = self.blocks[0].forward(&h0)?;
        let out2 = self.blocks[1].forward(&out1)?;
        let out3 = self.blocks[2].forward(&out2)?;
        let h = ops::concatenate_axis(&[&out1, &out2, &out3], 2)?;
        let h = relu(self.mfa.forward(&h)?)?;
        let h = self.asp.forward(&h)?;
        let h = ops::expand_dims(&h, 1)?;
        let h = self.fc.forward(&h)?;
        Ok(h.squeeze_axes(&[1])?)
    }
}
