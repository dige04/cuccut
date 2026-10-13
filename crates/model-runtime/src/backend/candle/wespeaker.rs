//! WeSpeaker ResNet34-LM speaker embedding (cross-platform candle backend).
//!
//! The fbank front end, shape constants and cosine distance are shared with [`crate::speech::wespeaker_fbank`], matching the MLX backend value for value; this is only the candle implementation of the same ResNet34 backbone. v3 changes only the boundary (same as MLX): weights are taken from the model pack's manifest ([`VerifiedFiles`]), and the directory is not scanned.
//!
//! The layout differences are the whole difficulty of the port: the model repository stores convolution weights in mlx-rs Conv2d's native NHWC layout `[O, kH, kW, Cin]`, while candle needs `[O, Cin, kH, kW]`; activations also change from MLX's `[B, H, W, C]` to candle's `[B, C, H, W]`. The flattening order before statistics pooling must remain C·F (see `forward`); otherwise the embedding would still be 256-dimensional and still normalized, but all the values would be wrong.

use anyhow::{Result, bail};
use candle_core::{D, Device, Tensor};

use super::weights::WeightStore;
use crate::bundle::VerifiedFiles;
use crate::speech::SpeakerEmbedding;
pub use crate::speech::wespeaker_fbank::{
    EMBEDDING_DIM, HOP_LENGTH, MINIMUM_SAMPLES, N_FFT, N_MELS, POOLED_FREQUENCY, POOLING_OUTPUT_DIM, RESNET_PLAN, SAMPLE_RATE,
    WeSpeakerFbank, cosine_distance,
};

struct Conv2d {
    weight: Tensor,
    bias: Tensor,
    stride: usize,
    padding: usize,
}

impl Conv2d {
    fn load(
        store: &mut WeightStore,
        prefix: &str,
        input_channels: usize,
        output_channels: usize,
        kernel: usize,
        stride: usize,
        padding: usize,
    ) -> Result<Self> {
        let weight = store.take_f32(&format!("{prefix}.weight"))?;
        let bias = store.take_f32(&format!("{prefix}.bias"))?;
        expect_shape(
            &format!("{prefix}.weight"),
            &weight,
            &[output_channels, kernel, kernel, input_channels],
        )?;
        expect_shape(&format!("{prefix}.bias"), &bias, &[output_channels])?;
        Ok(Self {
            // NHWC `[O, kH, kW, Cin]` → candle NCHW `[O, Cin, kH, kW]`.
            // `contiguous()` is both a performance and a correctness requirement here: when candle 0.11's CPU convolution takes the im2col path, a non-contiguous kernel is read as the target layout using its raw bytes (the contiguous copy that was prepared is not used), so the results are silently read wrong.
            weight: weight.permute((0, 3, 1, 2))?.contiguous()?,
            bias,
            stride,
            padding,
        })
    }

    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let output = input.conv2d(&self.weight, self.padding, self.stride, 1, 1)?;
        Ok(output.broadcast_add(&self.bias.reshape((1, self.bias.elem_count(), 1, 1))?)?)
    }
}

/// ResNet BasicBlock with BN already folded into the convolutions: two 3×3 convolutions with bias;
/// when stride≠1 or the channel count changes, the residual goes through a 1×1 shortcut convolution (also with bias).
struct BasicBlock {
    conv1: Conv2d,
    conv2: Conv2d,
    shortcut: Option<Conv2d>,
}

impl BasicBlock {
    fn load(store: &mut WeightStore, prefix: &str, input_channels: usize, output_channels: usize, stride: usize) -> Result<Self> {
        Ok(Self {
            conv1: Conv2d::load(store, &format!("{prefix}.conv1"), input_channels, output_channels, 3, stride, 1)?,
            conv2: Conv2d::load(store, &format!("{prefix}.conv2"), output_channels, output_channels, 3, 1, 1)?,
            shortcut: if stride != 1 || input_channels != output_channels {
                Some(Conv2d::load(
                    store,
                    &format!("{prefix}.shortcut"),
                    input_channels,
                    output_channels,
                    1,
                    stride,
                    0,
                )?)
            } else {
                None
            },
        })
    }

    fn forward(&self, x: &Tensor) -> Result<Tensor> {
        let mut out = self.conv1.forward(x)?.relu()?;
        out = self.conv2.forward(&out)?;
        let residual = match &self.shortcut {
            Some(shortcut) => shortcut.forward(x)?,
            None => x.clone(),
        };
        Ok((out + residual)?.relu()?)
    }
}

struct Linear {
    weight: Tensor,
    bias: Tensor,
}

impl Linear {
    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        Ok(input.matmul(&self.weight.t()?.contiguous()?)?.broadcast_add(&self.bias)?)
    }
}

struct WeSpeakerNetwork {
    conv1: Conv2d,
    layers: Vec<Vec<BasicBlock>>,
    embedding: Linear,
}

impl WeSpeakerNetwork {
    fn load(store: &mut WeightStore) -> Result<Self> {
        let conv1 = Conv2d::load(store, "conv1", 1, 32, 3, 1, 1)?;
        let mut layers = Vec::with_capacity(RESNET_PLAN.len());
        for (index, input_channels, output_channels, block_count) in RESNET_PLAN {
            let mut blocks = Vec::with_capacity(block_count);
            for block in 0..block_count {
                let first = block == 0;
                blocks.push(BasicBlock::load(
                    store,
                    &format!("layer{index}.{block}"),
                    if first { input_channels } else { output_channels },
                    output_channels,
                    if first && input_channels != output_channels { 2 } else { 1 },
                )?);
            }
            layers.push(blocks);
        }
        let weight = store.take_f32("embedding.weight")?;
        let bias = store.take_f32("embedding.bias")?;
        expect_shape("embedding.weight", &weight, &[EMBEDDING_DIM, POOLING_OUTPUT_DIM])?;
        expect_shape("embedding.bias", &bias, &[EMBEDDING_DIM])?;
        Ok(Self {
            conv1,
            layers,
            embedding: Linear { weight, bias },
        })
    }

    /// `mel`: `[1, T, 80]`; returns an L2-normalized embedding of `[1, 256]`.
    fn forward(&self, mel: &Tensor) -> Result<Tensor> {
        // The Python WeSpeaker input arrangement is (B,T,F) → (B,F,T) → (B,1,F,T):
        // frequency goes into H, time into W, and the channel count is 1. candle is already NCHW, so just unsqueeze.
        let mut x = mel.transpose(1, 2)?.unsqueeze(1)?.contiguous()?;
        x = self.conv1.forward(&x)?.relu()?;
        for layer in &self.layers {
            for block in layer {
                x = block.forward(&x)?;
            }
        }
        // x: [B, C=256, F'=10, T'=T/8], exactly matching the Python tensor layout.
        let shape = x.dims().to_vec();
        if shape.len() != 4 || shape[2] != POOLED_FREQUENCY {
            bail!("WeSpeaker 主干输出形状异常：{shape:?}");
        }
        let (batch, time) = (shape[0], shape[3]);
        if time < 1 {
            bail!("WeSpeaker 池化前时间轴为空");
        }
        // The flatten order must be C·F (Python reshape [B,256,10,T'] → [B,2560,T']),
        // then switch to time-major [B, T', 2560] so statistics pooling can run along the time axis.
        x = x
            .contiguous()?
            .reshape((batch, POOLING_OUTPUT_DIM / 2, time))?
            .transpose(1, 2)?
            .contiguous()?;

        // Statistics pooling (along the time axis): computes E[x²]-E[x]² by hand and clamps it to ≥0, using the same formula as the MLX side.
        let mean = x.mean(1)?;
        let mean_square = x.sqr()?.mean(1)?;
        let variance = (mean_square - mean.sqr()?)?.maximum(0.0_f64)?;
        let deviation = (variance + 1e-10)?.sqrt()?;
        let pooled = Tensor::cat(&[&mean, &deviation], D::Minus1)?;

        let embedding = self.embedding.forward(&pooled)?;
        let norm = (embedding.sqr()?.sum_keepdim(D::Minus1)? + 1e-10)?.sqrt()?;
        Ok(embedding.broadcast_div(&norm)?)
    }
}

/// WeSpeaker ResNet34-LM speaker embedder.
pub struct WeSpeakerEmbedder {
    fbank: WeSpeakerFbank,
    network: WeSpeakerNetwork,
    device: Device,
}

impl WeSpeakerEmbedder {
    /// Loads from the `speaker` component's files: all safetensors shards at the top level of the directory.
    pub fn load(files: &VerifiedFiles, device: &Device) -> Result<Self> {
        let shards = files.require_extension_in("", "safetensors")?;
        let mut store = WeightStore::load(&shards, device)?;
        let network = WeSpeakerNetwork::load(&mut store)?;
        let unused = store.remaining();
        if !unused.is_empty() {
            bail!("WeSpeaker 存在未使用权重：{}", unused.join("、"));
        }
        Ok(Self {
            fbank: WeSpeakerFbank::new(),
            network,
            device: device.clone(),
        })
    }

    /// fbank front end (for tests and diagnostics).
    pub fn fbank(&self) -> &WeSpeakerFbank {
        &self.fbank
    }

    /// Computes a 256-dimensional L2-normalized embedding for 16 kHz mono samples.
    ///
    /// Anything shorter than 0.5 seconds is an immediate error: statistics pooling is meaningless at that length, so the caller should filter first.
    pub fn embed(&mut self, samples: &[f32]) -> Result<Vec<f32>> {
        if samples.len() < MINIMUM_SAMPLES {
            bail!("WeSpeaker 需要至少 {MINIMUM_SAMPLES} 个样本（0.5 秒），实际 {}", samples.len());
        }
        let features = self.fbank.extract(samples)?;
        let mel = Tensor::from_slice(&features.data, (1, features.time_frames, N_MELS), &self.device)?;
        let embedding = self.network.forward(&mel)?;
        let values = embedding.flatten_all()?.to_vec1::<f32>()?;
        if values.len() != EMBEDDING_DIM {
            bail!("WeSpeaker 嵌入维度异常：{}", values.len());
        }
        Ok(values)
    }
}

impl SpeakerEmbedding for WeSpeakerEmbedder {
    fn embed(&mut self, samples: &[f32]) -> Result<Vec<f32>> {
        WeSpeakerEmbedder::embed(self, samples)
    }
}

fn expect_shape(key: &str, tensor: &Tensor, expected: &[usize]) -> Result<()> {
    if tensor.dims() != expected {
        bail!("WeSpeaker 权重 {key} 形状为 {:?}，期望 {expected:?}", tensor.dims());
    }
    Ok(())
}
