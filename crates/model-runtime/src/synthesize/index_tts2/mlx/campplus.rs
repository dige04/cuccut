//! Parts of the implementation are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/ChatterboxTTS/CAMPPlus.swift / Sources/IndexTTS2TTS/IndexTTS2CAMPPlusAdapter.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources see `THIRD_PARTY_NOTICES.md` at the root.
//!
//! CAM++ speaker encoder (corresponds to speech-swift `ChatterboxTTS/CAMPPlus.swift` and
//! `IndexTTS2CAMPPlusAdapter.swift`).
//!
//! Loads directly with the original checkpoint's keys (`head.*` / `xvector.*`), without Swift's module-name remapping. Inter-layer tensors
//! uniformly use the channel-last `[B, T, C]` layout (Swift uses `(B, C, T)` and swaps axes around each layer); mathematically fully equivalent. The FCM head runs in NHWC.

use super::layers::{BatchNorm, Conv1d, Conv2d};
use super::weights::WeightMap;
use crate::synthesize::index_tts2::dsp;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, ops};
use anyhow::Result;

const BN_EPS: f32 = 1e-5;
const FEAT_DIM: i32 = 80;
const GROWTH_RATE: i32 = 32;
const INIT_CHANNELS: i32 = 128;
const SEG_LEN: i32 = 100;
/// Three dense blocks: (number of layers, kernel size, dilation).
const BLOCK_SPECS: [(usize, i32, i32); 3] = [(12, 3, 1), (24, 3, 2), (16, 3, 2)];

fn relu(x: &Array) -> Result<Array> {
    Ok(ops::maximum(x, &Array::from_f32(0.0))?)
}

/// `BatchNorm(+ReLU)`, channel in the last dimension.
struct NonLinear {
    bn: BatchNorm,
    relu: bool,
}

impl NonLinear {
    fn load(w: &mut WeightMap, prefix: &str, relu: bool) -> Result<Self> {
        Ok(Self {
            bn: BatchNorm::load(w, prefix, BN_EPS)?,
            relu,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let y = self.bn.forward_channels_last(x)?;
        if self.relu { relu(&y) } else { Ok(y) }
    }
}

struct BasicResBlock {
    conv1: Conv2d,
    bn1: BatchNorm,
    conv2: Conv2d,
    bn2: BatchNorm,
    shortcut: Option<(Conv2d, BatchNorm)>,
}

impl BasicResBlock {
    fn load(w: &mut WeightMap, prefix: &str, stride: i32) -> Result<Self> {
        let shortcut = if w.contains(&format!("{prefix}.shortcut.0.weight")) {
            Some((
                Conv2d::load(w, &format!("{prefix}.shortcut.0"))?.with_stride((stride, 1)),
                BatchNorm::load(w, &format!("{prefix}.shortcut.1"), BN_EPS)?,
            ))
        } else {
            None
        };
        Ok(Self {
            conv1: Conv2d::load(w, &format!("{prefix}.conv1"))?
                .with_stride((stride, 1))
                .with_padding((1, 1)),
            bn1: BatchNorm::load(w, &format!("{prefix}.bn1"), BN_EPS)?,
            conv2: Conv2d::load(w, &format!("{prefix}.conv2"))?.with_padding((1, 1)),
            bn2: BatchNorm::load(w, &format!("{prefix}.bn2"), BN_EPS)?,
            shortcut,
        })
    }

    /// NHWC。
    fn forward(&self, x: &Array) -> Result<Array> {
        let mut out = relu(&self.bn1.forward_channels_last(&self.conv1.forward_nhwc(x)?)?)?;
        out = self.bn2.forward_channels_last(&self.conv2.forward_nhwc(&out)?)?;
        let sc = match &self.shortcut {
            Some((conv, bn)) => bn.forward_channels_last(&conv.forward_nhwc(x)?)?,
            None => x.clone(),
        };
        relu(&(out + sc))
    }
}

/// FCM front end: a small 2D ResNet that turns `(B, F, T)` into `(B, C·H, T)`.
struct Fcm {
    conv1: Conv2d,
    bn1: BatchNorm,
    layer1: Vec<BasicResBlock>,
    layer2: Vec<BasicResBlock>,
    conv2: Conv2d,
    bn2: BatchNorm,
}

impl Fcm {
    fn load(w: &mut WeightMap) -> Result<Self> {
        let load_layer = |w: &mut WeightMap, name: &str| -> Result<Vec<BasicResBlock>> {
            Ok(vec![
                BasicResBlock::load(w, &format!("head.{name}.0"), 2)?,
                BasicResBlock::load(w, &format!("head.{name}.1"), 1)?,
            ])
        };
        Ok(Self {
            conv1: Conv2d::load(w, "head.conv1")?.with_padding((1, 1)),
            bn1: BatchNorm::load(w, "head.bn1", BN_EPS)?,
            layer1: load_layer(w, "layer1")?,
            layer2: load_layer(w, "layer2")?,
            conv2: Conv2d::load(w, "head.conv2")?.with_stride((2, 1)).with_padding((1, 1)),
            bn2: BatchNorm::load(w, "head.bn2", BN_EPS)?,
        })
    }

    /// Input `[B, T, F]`, output channel-last `[B, T, C·H]` (the channel order matches Swift's
    /// `transposed(0, 3, 1, 2).reshaped([b, c*h, w])`).
    fn forward(&self, features: &Array) -> Result<Array> {
        // (B, T, F) -> (B, F, T) -> NHWC (B, H=F, W=T, C=1)
        let mut out = features.swap_axes(1, 2)?.expand_dims(-1)?;
        out = relu(&self.bn1.forward_channels_last(&self.conv1.forward_nhwc(&out)?)?)?;
        for blk in &self.layer1 {
            out = blk.forward(&out)?;
        }
        for blk in &self.layer2 {
            out = blk.forward(&out)?;
        }
        out = relu(&self.bn2.forward_channels_last(&self.conv2.forward_nhwc(&out)?)?)?;
        let (b, h, wd, c) = (out.dim(0), out.dim(1), out.dim(2), out.dim(3));
        // NHWC -> (B, C, H, W) -> (B, C*H, W) -> (B, W, C*H)
        let out = out.transpose_axes(&[0, 3, 1, 2])?.reshape(&[b, c * h, wd])?;
        Ok(out.swap_axes(1, 2)?)
    }
}

struct TdnnLayer {
    linear: Conv1d,
    nonlinear: NonLinear,
}

impl TdnnLayer {
    fn load(w: &mut WeightMap, prefix: &str, kernel: i32, stride: i32, dilation: i32) -> Result<Self> {
        let padding = (kernel - 1) / 2 * dilation;
        Ok(Self {
            linear: Conv1d::load(w, &format!("{prefix}.linear"))?
                .with_stride(stride)
                .with_padding(padding)
                .with_dilation(dilation),
            nonlinear: NonLinear::load(w, &format!("{prefix}.nonlinear.batchnorm"), true)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        self.nonlinear.forward(&self.linear.forward_nlc(x)?)
    }
}

struct CamLayer {
    linear_local: Conv1d,
    linear1: Conv1d,
    linear2: Conv1d,
}

impl CamLayer {
    fn load(w: &mut WeightMap, prefix: &str, kernel: i32, dilation: i32) -> Result<Self> {
        let padding = (kernel - 1) / 2 * dilation;
        Ok(Self {
            linear_local: Conv1d::load(w, &format!("{prefix}.linear_local"))?
                .with_padding(padding)
                .with_dilation(dilation),
            linear1: Conv1d::load(w, &format!("{prefix}.linear1"))?,
            linear2: Conv1d::load(w, &format!("{prefix}.linear2"))?,
        })
    }

    /// `[B, T, C]`。
    fn forward(&self, x: &Array) -> Result<Array> {
        let y = self.linear_local.forward_nlc(x)?;
        let context = x.mean_axis(1, true)? + Self::seg_pooling(x)?;
        let context = relu(&self.linear1.forward_nlc(&context)?)?;
        let m = ops::sigmoid(&self.linear2.forward_nlc(&context)?)?;
        Ok(y * m)
    }

    /// Segment-wise average pooling broadcast back to T, corresponding to the official `F.avg_pool1d(ceil_mode=True)`:
    /// when the last segment is shorter than [`SEG_LEN`], average only over the actual frame count (zero padding is not counted in the denominator).
    fn seg_pooling(x: &Array) -> Result<Array> {
        let (b, t, c) = (x.dim(0), x.dim(1), x.dim(2));
        let n_segs = (t + SEG_LEN - 1) / SEG_LEN;
        let pad_len = n_segs * SEG_LEN - t;
        let xp = if pad_len > 0 {
            ops::pad(x, &[(0, 0), (0, pad_len), (0, 0)], None, None)?
        } else {
            x.clone()
        };
        let counts: Vec<f32> = seg_frame_counts(t, SEG_LEN).into_iter().map(|n| n as f32).collect();
        let counts = Array::from_slice(&counts, &[1, n_segs, 1, 1]);
        let seg = xp.reshape(&[b, n_segs, SEG_LEN, c])?.sum_axis(2, true)? / counts; // [B, nSegs, 1, C]
        let seg = ops::broadcast_to(&seg, &[b, n_segs, SEG_LEN, c])?.reshape(&[b, n_segs * SEG_LEN, c])?;
        Ok(seg.index((.., ..t, ..)))
    }
}

/// Actual frame count of each segment after `ceil_mode` segmentation (the last segment may be shorter than `seg_len`).
fn seg_frame_counts(t: i32, seg_len: i32) -> Vec<i32> {
    (0..(t + seg_len - 1) / seg_len).map(|i| (t - i * seg_len).min(seg_len)).collect()
}

struct CamDenseTdnnLayer {
    nonlinear1: NonLinear,
    linear1: Conv1d,
    nonlinear2: NonLinear,
    cam_layer: CamLayer,
}

impl CamDenseTdnnLayer {
    fn load(w: &mut WeightMap, prefix: &str, kernel: i32, dilation: i32) -> Result<Self> {
        Ok(Self {
            nonlinear1: NonLinear::load(w, &format!("{prefix}.nonlinear1.batchnorm"), true)?,
            linear1: Conv1d::load(w, &format!("{prefix}.linear1"))?,
            nonlinear2: NonLinear::load(w, &format!("{prefix}.nonlinear2.batchnorm"), true)?,
            cam_layer: CamLayer::load(w, &format!("{prefix}.cam_layer"), kernel, dilation)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let y = self.nonlinear1.forward(x)?;
        let y = self.linear1.forward_nlc(&y)?;
        let y = self.nonlinear2.forward(&y)?;
        self.cam_layer.forward(&y)
    }
}

struct CamDenseTdnnBlock {
    layers: Vec<CamDenseTdnnLayer>,
}

impl CamDenseTdnnBlock {
    fn load(w: &mut WeightMap, block_index: usize, spec: (usize, i32, i32)) -> Result<Self> {
        let (num_layers, kernel, dilation) = spec;
        let mut layers = Vec::with_capacity(num_layers);
        for i in 0..num_layers {
            let prefix = format!("xvector.block{}.tdnnd{}", block_index + 1, i + 1);
            layers.push(CamDenseTdnnLayer::load(w, &prefix, kernel, dilation)?);
        }
        Ok(Self { layers })
    }

    /// Concatenate each layer's output along the channel axis.
    fn forward(&self, x: &Array) -> Result<Array> {
        let mut out = x.clone();
        for layer in &self.layers {
            let y = layer.forward(&out)?;
            out = ops::concatenate_axis(&[&out, &y], 2)?;
        }
        Ok(out)
    }
}

struct TransitLayer {
    nonlinear: NonLinear,
    linear: Conv1d,
}

impl TransitLayer {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            nonlinear: NonLinear::load(w, &format!("{prefix}.nonlinear.batchnorm"), true)?,
            linear: Conv1d::load(w, &format!("{prefix}.linear"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        self.linear.forward_nlc(&self.nonlinear.forward(x)?)
    }
}

struct DenseLayer {
    linear: Conv1d,
    nonlinear: NonLinear,
}

impl DenseLayer {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            linear: Conv1d::load(w, &format!("{prefix}.linear"))?,
            // config_str="batchnorm_": no affine transform, no ReLU.
            nonlinear: NonLinear::load(w, &format!("{prefix}.nonlinear.batchnorm"), false)?,
        })
    }

    /// `[B, C]` → `[B, C']`。
    fn forward(&self, x: &Array) -> Result<Array> {
        let y = self.linear.forward_nlc(&x.expand_dims(1)?)?;
        let y = self.nonlinear.forward(&y)?;
        Ok(y.squeeze_axes(&[1])?)
    }
}

/// CAM++: 16 kHz waveform → 192-dim x-vector.
pub struct CampPlus {
    head: Fcm,
    tdnn: TdnnLayer,
    blocks: Vec<CamDenseTdnnBlock>,
    transits: Vec<TransitLayer>,
    out_nonlinear: NonLinear,
    dense: DenseLayer,
}

impl CampPlus {
    pub fn load(mut w: WeightMap) -> Result<Self> {
        let head = Fcm::load(&mut w)?;
        let tdnn = TdnnLayer::load(&mut w, "xvector.tdnn", 5, 2, 1)?;
        let mut channels = INIT_CHANNELS;
        let mut blocks = Vec::with_capacity(BLOCK_SPECS.len());
        let mut transits = Vec::with_capacity(BLOCK_SPECS.len());
        for (i, spec) in BLOCK_SPECS.iter().enumerate() {
            blocks.push(CamDenseTdnnBlock::load(&mut w, i, *spec)?);
            channels += spec.0 as i32 * GROWTH_RATE;
            transits.push(TransitLayer::load(&mut w, &format!("xvector.transit{}", i + 1))?);
            channels /= 2;
        }
        debug_assert_eq!(channels, 512);
        Ok(Self {
            head,
            tdnn,
            blocks,
            transits,
            out_nonlinear: NonLinear::load(&mut w, "xvector.out_nonlinear.batchnorm", true)?,
            dense: DenseLayer::load(&mut w, "xvector.dense")?,
        })
    }

    /// Features `[B, T, 80]` → embedding `[B, 192]`.
    pub fn forward(&self, features: &Array) -> Result<Array> {
        let mut x = self.head.forward(features)?;
        x = self.tdnn.forward(&x)?;
        for (block, transit) in self.blocks.iter().zip(&self.transits) {
            x = block.forward(&x)?;
            x = transit.forward(&x)?;
        }
        x = self.out_nonlinear.forward(&x)?;
        let pooled = Self::statistics_pooling(&x)?;
        self.dense.forward(&pooled)
    }

    /// Same as Swift `inference`: Kaldi fbank → subtract time mean → network.
    pub fn inference(&self, wav_16k: &[f32]) -> Result<Array> {
        let (feat, frames) = dsp::campplus_fbank(wav_16k);
        let feat = Array::from_slice(&feat, &[1, frames as i32, FEAT_DIM]);
        let feat = &feat - feat.mean_axis(1, true)?;
        let emb = self.forward(&feat)?;
        emb.eval()?;
        Ok(emb)
    }

    /// Statistics pooling: `concat(mean, std)` along the time axis, `[B, T, C]` → `[B, 2C]`;
    /// std matches the official `x.std(unbiased=True)`, using unbiased variance and no eps.
    fn statistics_pooling(x: &Array) -> Result<Array> {
        let mean = x.mean_axis(1, false)?;
        let var = x.var_axis(1, false, 1)?;
        let std = var.sqrt()?;
        Ok(ops::concatenate_axis(&[&mean, &std], -1)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seg_frame_counts_keep_partial_tail() {
        assert_eq!(seg_frame_counts(335, 100), vec![100, 100, 100, 35]);
        assert_eq!(seg_frame_counts(200, 100), vec![100, 100]);
        assert_eq!(seg_frame_counts(7, 100), vec![7]);
    }

    /// Official `F.avg_pool1d(ones(135), 100, 100, ceil_mode=True)` = `[1, 1]`:
    /// the average of the last 35 frames is still 1, not diluted to 0.35 by zero padding.
    #[test]
    fn seg_pooling_tail_mean_ignores_padding() {
        let x = Array::from_slice(&[1.0f32; 135 * 2], &[1, 135, 2]);
        let pooled = CamLayer::seg_pooling(&x).unwrap();
        assert_eq!((pooled.dim(0), pooled.dim(1), pooled.dim(2)), (1, 135, 2));
        let values: Vec<f32> = pooled.as_slice::<f32>().to_vec();
        assert!(values.iter().all(|v| (v - 1.0).abs() < 1e-6), "{values:?}");
    }

    /// Official `x.std(unbiased=True)`: the std of `[1, 2, 3, 4]` is sqrt(5/3).
    #[test]
    fn statistics_pooling_uses_unbiased_std() {
        let x = Array::from_slice(&[1.0f32, 2.0, 3.0, 4.0], &[1, 4, 1]);
        let pooled = CampPlus::statistics_pooling(&x).unwrap();
        let values: Vec<f32> = pooled.as_slice::<f32>().to_vec();
        assert!((values[0] - 2.5).abs() < 1e-6);
        assert!((values[1] - (5.0f32 / 3.0).sqrt()).abs() < 1e-6, "{values:?}");
    }
}
