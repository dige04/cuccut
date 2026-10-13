//! Some implementations are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/OmniVoiceTTS/OmniVoiceCodec.swift / Sources/OmniVoiceTTS/OmniVoiceCodecEncoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-bundle interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Higgs Audio v2 audio tokenizer (OmniVoice's `audio_tokenizer/`): 24 kHz waveform ↔ 8-codebook 25 Hz tokens. Checked against transformers' `HiggsAudioV2TokenizerModel` (`encode` / `decode`), `DacEncoder` / `DacDecoder` (modified: transposed convolution with `output_padding = stride % 2`, tanh removed), and `HubertModel` (group-norm feature extraction + post-norm encoder layers).
//!
//! All computation uses channels-last (`[B, T, C]`) layout. The weights are F16 in PyTorch layout; at load time they are all converted to F32, and convolution kernels are converted to `[out, k, in]`; HuBERT's positional-convolution weight-norm is synthesized at load time.
//! Transposed convolution is implemented as "compute the full length, then slice `[ceil(s/2), +L·s)`", which is sample-for-sample equivalent to PyTorch's `padding = ceil(s/2)`, `output_padding = s % 2`, and does not depend on whether the two backends' `padding` semantics agree.
//!
//! `decoder_semantic.*` and `fc1.*` are only used in training; the codebook's `cluster_size` / `embed_avg` / `inited` are EMA statistics: they are taken and discarded at load time, so they are not counted as unused weights.

use crate::synthesize::qwen3_tts::layers::Linear;
use crate::synthesize::qwen3_tts::weights::Weights;
use crate::synthesize::tensor::fast;
use crate::synthesize::tensor::gelu_same_dtype;
use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::{IndexOp, argmax_axis};
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Result, ensure};

use super::config::CodecConfig;

fn f32_weight(weights: &mut Weights, key: &str) -> Result<Array> {
    Ok(weights.take(key)?.as_dtype(Dtype::Float32)?)
}

fn f32_optional(weights: &mut Weights, key: &str) -> Result<Option<Array>> {
    weights
        .take_optional(key)
        .map(|w| w.as_dtype(Dtype::Float32))
        .transpose()
        .map_err(Into::into)
}

fn dense(weights: &mut Weights, prefix: &str) -> Result<Linear> {
    Ok(Linear::Float {
        weight: f32_weight(weights, &format!("{prefix}.weight"))?,
        bias: f32_optional(weights, &format!("{prefix}.bias"))?,
    })
}

/// `x > 0 ? x : exp(x) − 1`（`nn.ELU`，α = 1）。
fn elu(x: &Array) -> Result<Array> {
    let negative = x.exp()?.subtract(Array::from_f32(1.0))?;
    Ok(ops::which(&x.gt(&Array::from_f32(0.0))?, x, &negative)?)
}

/// Conv1d with symmetric zero-padding (PyTorch `nn.Conv1d(padding=p)`).
struct Conv {
    weight: Array,
    bias: Option<Array>,
    stride: i32,
    padding: i32,
    dilation: i32,
    groups: i32,
}

impl Conv {
    fn load(weights: &mut Weights, prefix: &str, stride: usize, padding: usize, dilation: usize) -> Result<Self> {
        let weight = weights.take_conv1d(&format!("{prefix}.weight"), false)?.as_dtype(Dtype::Float32)?;
        Ok(Self {
            weight,
            bias: f32_optional(weights, &format!("{prefix}.bias"))?,
            stride: stride as i32,
            padding: padding as i32,
            dilation: dilation as i32,
            groups: 1,
        })
    }

    fn kernel(&self) -> i32 {
        self.weight.dim(1)
    }

    fn out_len(&self, len: i32) -> i32 {
        (len + 2 * self.padding - self.dilation * (self.kernel() - 1) - 1) / self.stride + 1
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let out = ops::conv1d(x, &self.weight, self.stride, self.padding, self.dilation, self.groups)?;
        Ok(match &self.bias {
            Some(bias) => out.add(bias)?,
            None => out,
        })
    }
}

/// `Snake1d`: `x + 1/(α+1e-9) · sin²(αx)`; `α` is reshaped from `[1, C, 1]` to `[1, 1, C]`.
struct Snake {
    alpha: Array,
    inv_alpha: Array,
}

impl Snake {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        let alpha = f32_weight(weights, &format!("{prefix}.alpha"))?.reshape(&[1, 1, -1])?;
        let inv_alpha = Array::from_f32(1.0).divide(&alpha.add(Array::from_f32(1e-9))?)?;
        Ok(Self { alpha, inv_alpha })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let s = x.multiply(&self.alpha)?.sin()?;
        Ok(x.add(&s.square()?.multiply(&self.inv_alpha)?)?)
    }
}

/// DAC `DacResidualUnit`: snake → k7 dilated convolution → snake → 1×1 convolution, residual added (length unchanged).
struct DacResidual {
    snake1: Snake,
    conv1: Conv,
    snake2: Snake,
    conv2: Conv,
}

impl DacResidual {
    fn load(weights: &mut Weights, prefix: &str, dilation: usize) -> Result<Self> {
        Ok(Self {
            snake1: Snake::load(weights, &format!("{prefix}.snake1"))?,
            conv1: Conv::load(weights, &format!("{prefix}.conv1"), 1, 3 * dilation, dilation)?,
            snake2: Snake::load(weights, &format!("{prefix}.snake2"))?,
            conv2: Conv::load(weights, &format!("{prefix}.conv2"), 1, 0, 1)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = self.conv1.forward(&self.snake1.forward(x)?)?;
        let h = self.conv2.forward(&self.snake2.forward(&h)?)?;
        Ok(x.add(&h)?)
    }
}

fn dac_residuals(weights: &mut Weights, prefix: &str) -> Result<[DacResidual; 3]> {
    Ok([
        DacResidual::load(weights, &format!("{prefix}.res_unit1"), 1)?,
        DacResidual::load(weights, &format!("{prefix}.res_unit2"), 3)?,
        DacResidual::load(weights, &format!("{prefix}.res_unit3"), 9)?,
    ])
}

struct DacEncoderBlock {
    res: [DacResidual; 3],
    snake: Snake,
    conv: Conv,
}

struct DacEncoder {
    conv1: Conv,
    blocks: Vec<DacEncoderBlock>,
    snake: Snake,
    conv2: Conv,
}

impl DacEncoder {
    fn load(weights: &mut Weights, ratios: &[usize]) -> Result<Self> {
        let conv1 = Conv::load(weights, "acoustic_encoder.conv1", 1, 3, 1)?;
        let mut blocks = Vec::new();
        for (i, &stride) in ratios.iter().enumerate() {
            let p = format!("acoustic_encoder.block.{i}");
            blocks.push(DacEncoderBlock {
                res: dac_residuals(weights, &p)?,
                snake: Snake::load(weights, &format!("{p}.snake1"))?,
                conv: Conv::load(weights, &format!("{p}.conv1"), stride, stride.div_ceil(2), 1)?,
            });
        }
        Ok(Self {
            conv1,
            blocks,
            snake: Snake::load(weights, "acoustic_encoder.snake1")?,
            conv2: Conv::load(weights, "acoustic_encoder.conv2", 1, 1, 1)?,
        })
    }

    /// HF `_get_conv1d_output_lengths`: the convolutions in the residual units all preserve length, so only the few layers that change the length are counted.
    fn out_len(&self, len: i32) -> i32 {
        let mut len = self.conv1.out_len(len);
        for block in &self.blocks {
            len = block.conv.out_len(len);
        }
        self.conv2.out_len(len)
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let mut h = self.conv1.forward(x)?;
        for block in &self.blocks {
            for unit in &block.res {
                h = unit.forward(&h)?;
            }
            h = block.conv.forward(&block.snake.forward(&h)?)?;
        }
        self.conv2.forward(&self.snake.forward(&h)?)
    }
}

/// DAC decoder block: snake → transposed convolution (×stride) → three residual units.
struct DacDecoderBlock {
    snake: Snake,
    weight: Array,
    bias: Array,
    stride: i32,
    res: [DacResidual; 3],
}

impl DacDecoderBlock {
    fn upsample(&self, x: &Array) -> Result<Array> {
        let len = x.dim(1);
        let full = ops::conv_transpose1d(x, &self.weight, self.stride, 0, 1, 0, 1)?;
        let start = (self.stride + 1) / 2;
        Ok(full.index((.., start..start + len * self.stride, ..)).add(&self.bias)?)
    }
}

struct DacDecoder {
    conv1: Conv,
    blocks: Vec<DacDecoderBlock>,
    snake: Snake,
    conv2: Conv,
}

impl DacDecoder {
    fn load(weights: &mut Weights, ratios: &[usize]) -> Result<Self> {
        let conv1 = Conv::load(weights, "acoustic_decoder.conv1", 1, 3, 1)?;
        let mut blocks = Vec::new();
        for (i, &stride) in ratios.iter().enumerate() {
            let p = format!("acoustic_decoder.block.{i}");
            let weight = weights
                .take_conv_transpose1d(&format!("{p}.conv_t1.weight"))?
                .as_dtype(Dtype::Float32)?;
            ensure!(
                weight.dim(1) == 2 * stride as i32,
                "OmniVoice decoder block {i} transposed-conv kernel length {} is not 2×stride",
                weight.dim(1)
            );
            blocks.push(DacDecoderBlock {
                snake: Snake::load(weights, &format!("{p}.snake1"))?,
                weight,
                bias: f32_weight(weights, &format!("{p}.conv_t1.bias"))?,
                stride: stride as i32,
                res: dac_residuals(weights, &p)?,
            });
        }
        Ok(Self {
            conv1,
            blocks,
            snake: Snake::load(weights, "acoustic_decoder.snake1")?,
            conv2: Conv::load(weights, "acoustic_decoder.conv2", 1, 3, 1)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let mut h = self.conv1.forward(x)?;
        for block in &self.blocks {
            h = block.upsample(&block.snake.forward(&h)?)?;
            for unit in &block.res {
                h = unit.forward(&h)?;
            }
        }
        self.conv2.forward(&self.snake.forward(&h)?)
    }
}

fn layer_norm(x: &Array, weight: &Array, bias: &Array, eps: f32) -> Result<Array> {
    Ok(fast::layer_norm(x, Some(weight), Some(bias), eps)?)
}

struct Norm {
    weight: Array,
    bias: Array,
}

impl Norm {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        Ok(Self {
            weight: f32_weight(weights, &format!("{prefix}.weight"))?,
            bias: f32_weight(weights, &format!("{prefix}.bias"))?,
        })
    }
}

struct HubertLayer {
    q: Linear,
    k: Linear,
    v: Linear,
    out: Linear,
    norm: Norm,
    ff_in: Linear,
    ff_out: Linear,
    final_norm: Norm,
}

/// HuBERT base: group-norm feature extraction, weight-norm positional convolution, 12 post-norm encoder layers.
struct Hubert {
    convs: Vec<Conv>,
    group_norm: Norm,
    projection_norm: Norm,
    projection: Linear,
    pos_conv: Conv,
    encoder_norm: Norm,
    layers: Vec<HubertLayer>,
    heads: i32,
    eps: f32,
}

impl Hubert {
    fn load(weights: &mut Weights, config: &CodecConfig) -> Result<Self> {
        let c = &config.semantic_model_config;
        let mut convs = Vec::new();
        for (i, (&kernel, &stride)) in c.conv_kernel.iter().zip(&c.conv_stride).enumerate() {
            let conv = Conv::load(
                weights,
                &format!("semantic_model.feature_extractor.conv_layers.{i}.conv"),
                stride,
                0,
                1,
            )?;
            ensure!(
                conv.kernel() == kernel as i32,
                "OmniVoice HuBERT layer {i} kernel length {} does not match config {kernel}",
                conv.kernel()
            );
            convs.push(conv);
        }
        let group_norm = Norm::load(weights, "semantic_model.feature_extractor.conv_layers.0.layer_norm")?;
        // weight-norm (dim = 2): at each kernel position k, `w = g · v / ‖v[:, :, k]‖`.
        let prefix = "semantic_model.encoder.pos_conv_embed.conv";
        let g = f32_weight(weights, &format!("{prefix}.parametrizations.weight.original0"))?;
        let v = f32_weight(weights, &format!("{prefix}.parametrizations.weight.original1"))?;
        let norm = v.square()?.sum_axis(0, true)?.sum_axis(1, true)?.sqrt()?;
        let weight = g.multiply(&v)?.divide(&norm)?.transpose_axes(&[0, 2, 1])?;
        let kernel = c.num_conv_pos_embeddings as i32;
        ensure!(
            weight.dim(1) == kernel,
            "OmniVoice HuBERT positional-conv kernel length {} does not match config {kernel}",
            weight.dim(1)
        );
        let pos_conv = Conv {
            weight,
            bias: f32_optional(weights, &format!("{prefix}.bias"))?,
            stride: 1,
            padding: kernel / 2,
            dilation: 1,
            groups: c.num_conv_pos_embedding_groups as i32,
        };
        let mut layers = Vec::new();
        for i in 0..c.num_hidden_layers {
            let p = format!("semantic_model.encoder.layers.{i}");
            layers.push(HubertLayer {
                q: dense(weights, &format!("{p}.attention.q_proj"))?,
                k: dense(weights, &format!("{p}.attention.k_proj"))?,
                v: dense(weights, &format!("{p}.attention.v_proj"))?,
                out: dense(weights, &format!("{p}.attention.out_proj"))?,
                norm: Norm::load(weights, &format!("{p}.layer_norm"))?,
                ff_in: dense(weights, &format!("{p}.feed_forward.intermediate_dense"))?,
                ff_out: dense(weights, &format!("{p}.feed_forward.output_dense"))?,
                final_norm: Norm::load(weights, &format!("{p}.final_layer_norm"))?,
            });
        }
        Ok(Self {
            convs,
            group_norm,
            projection_norm: Norm::load(weights, "semantic_model.feature_projection.layer_norm")?,
            projection: dense(weights, "semantic_model.feature_projection.projection")?,
            pos_conv,
            encoder_norm: Norm::load(weights, "semantic_model.encoder.layer_norm")?,
            layers,
            heads: c.num_attention_heads as i32,
            eps: c.layer_norm_eps,
        })
    }

    fn attention(&self, layer: &HubertLayer, x: &Array) -> Result<Array> {
        let t = x.dim(1);
        let hidden = x.dim(2);
        let head_dim = hidden / self.heads;
        let split = |h: Array| -> Result<Array> { Ok(h.reshape(&[1, t, self.heads, head_dim])?.transpose_axes(&[0, 2, 1, 3])?) };
        let q = split(layer.q.forward(x)?)?;
        let k = split(layer.k.forward(x)?)?;
        let v = split(layer.v.forward(x)?)?;
        let attended = fast::scaled_dot_product_attention(&q, &k, &v, (head_dim as f32).powf(-0.5), None, None)?;
        let merged = attended.transpose_axes(&[0, 2, 1, 3])?.reshape(&[1, t, hidden])?;
        layer.out.forward(&merged)
    }

    /// `[1, N, 1]` 16 kHz waveform → the mean of all 13 hidden states `[1, T, 768]`.
    fn forward(&self, wave: &Array) -> Result<Array> {
        let mut h = wave.clone();
        for (i, conv) in self.convs.iter().enumerate() {
            h = conv.forward(&h)?;
            if i == 0 {
                // GroupNorm(512 groups, 512 channels): each channel is normalized along time, then made affine.
                let mean = h.mean_axis(1, true)?;
                let centered = h.subtract(&mean)?;
                let var = centered.square()?.mean_axis(1, true)?;
                h = centered
                    .multiply(&var.add(Array::from_f32(1e-5))?.rsqrt()?)?
                    .multiply(&self.group_norm.weight)?
                    .add(&self.group_norm.bias)?;
            }
            h = gelu_same_dtype(&h)?;
        }
        let h = layer_norm(&h, &self.projection_norm.weight, &self.projection_norm.bias, self.eps)?;
        let h = self.projection.forward(&h)?;
        // The extra last frame that the positional convolution (even kernel length) adds is removed (`HubertSamePadLayer`), then GELU.
        let t = h.dim(1);
        let pos = self.pos_conv.forward(&h)?;
        let pos = gelu_same_dtype(&pos.index((.., ..t, ..)))?;
        let mut h = layer_norm(&h.add(&pos)?, &self.encoder_norm.weight, &self.encoder_norm.bias, self.eps)?;
        let mut sum = h.clone();
        for layer in &self.layers {
            let attn = self.attention(layer, &h)?;
            h = layer_norm(&h.add(&attn)?, &layer.norm.weight, &layer.norm.bias, self.eps)?;
            let ff = layer.ff_out.forward(&gelu_same_dtype(&layer.ff_in.forward(&h)?)?)?;
            h = layer_norm(&h.add(&ff)?, &layer.final_norm.weight, &layer.final_norm.bias, self.eps)?;
            sum = sum.add(&h)?;
        }
        Ok(sum.divide(Array::from_f32((self.layers.len() + 1) as f32))?)
    }
}

/// `HiggsAudioV2TokenizerResidualUnit`: ELU → convolution (no bias) → ELU → 1×1 convolution, residual added.
struct SemanticResidual {
    conv1: Conv,
    conv2: Conv,
}

struct SemanticBlock {
    res: Vec<SemanticResidual>,
    conv: Conv,
}

struct SemanticEncoder {
    conv: Conv,
    blocks: Vec<SemanticBlock>,
}

impl SemanticEncoder {
    fn load(weights: &mut Weights, config: &CodecConfig) -> Result<Self> {
        let conv = Conv::load(weights, "encoder_semantic.conv", 1, config.kernel_size / 2, 1)?;
        let mut blocks = Vec::new();
        for (i, &stride) in config.strides.iter().enumerate() {
            let p = format!("encoder_semantic.conv_blocks.{i}");
            let mut res = Vec::new();
            for (j, &dilation) in config.block_dilations.iter().enumerate() {
                let r = format!("{p}.res_units.{j}");
                res.push(SemanticResidual {
                    conv1: Conv::load(
                        weights,
                        &format!("{r}.conv1"),
                        1,
                        (config.unit_kernel_size - 1) / 2 * dilation,
                        dilation,
                    )?,
                    conv2: Conv::load(weights, &format!("{r}.conv2"), 1, 0, 1)?,
                });
            }
            let kernel = if stride == 1 { 3 } else { 2 * stride };
            blocks.push(SemanticBlock {
                res,
                conv: Conv::load(weights, &format!("{p}.conv"), stride, (kernel - 1) / 2, 1)?,
            });
        }
        Ok(Self { conv, blocks })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let mut h = self.conv.forward(x)?;
        for block in &self.blocks {
            for unit in &block.res {
                let y = unit.conv1.forward(&elu(&h)?)?;
                let y = unit.conv2.forward(&elu(&y)?)?;
                h = h.add(&y)?;
            }
            h = block.conv.forward(&h)?;
        }
        Ok(h)
    }
}

struct Quantizer {
    /// `[codebook_size, codebook_dim]`。
    embed: Array,
    /// `|e|²`，`[1, codebook_size]`。
    embed_sq: Array,
    project_in: Linear,
    project_out: Linear,
}

impl Quantizer {
    fn decode(&self, codes: &Array) -> Result<Array> {
        self.project_out.forward(&self.embed.take_axis(codes, 0)?)
    }
}

pub struct Codec {
    hubert: Hubert,
    semantic: SemanticEncoder,
    acoustic_encoder: DacEncoder,
    acoustic_decoder: DacDecoder,
    fc: Linear,
    fc2: Linear,
    quantizers: Vec<Quantizer>,
    downsample: usize,
    /// Zero-padding on each side of the HuBERT input. HF hardcodes 160; it equals `downsample_factor / 2` (half of HuBERT's total stride of 320), so it is computed from the latter here, which lets unit tests of a small synthetic model use a small stride.
    semantic_pad: usize,
    hop: usize,
    pub sample_rate: u32,
    semantic_rate: u32,
}

impl Codec {
    pub fn load(weights: &mut Weights, config: &CodecConfig) -> Result<Self> {
        let acoustic = &config.acoustic_model_config;
        let hubert = Hubert::load(weights, config)?;
        let semantic = SemanticEncoder::load(weights, config)?;
        let acoustic_encoder = DacEncoder::load(weights, &acoustic.downsampling_ratios)?;
        let acoustic_decoder = DacDecoder::load(weights, &acoustic.upsampling_ratios)?;
        let fc = dense(weights, "fc")?;
        let fc2 = dense(weights, "fc2")?;
        let mut quantizers = Vec::new();
        for i in 0..config.num_quantizers() {
            let p = format!("quantizer.quantizers.{i}");
            let embed = f32_weight(weights, &format!("{p}.codebook.embed"))?;
            let embed_sq = embed.square()?.sum_axis(1, false)?.reshape(&[1, -1])?;
            quantizers.push(Quantizer {
                embed,
                embed_sq,
                project_in: dense(weights, &format!("{p}.project_in"))?,
                project_out: dense(weights, &format!("{p}.project_out"))?,
            });
        }
        // The training-only semantic decoding branch and EMA statistics: taken and discarded.
        for key in weights.keys() {
            if key.starts_with("decoder_semantic.")
                || key.starts_with("fc1.")
                || key.ends_with(".codebook.cluster_size")
                || key.ends_with(".codebook.embed_avg")
                || key.ends_with(".codebook.inited")
            {
                weights.take(&key)?;
            }
        }
        Ok(Self {
            hubert,
            semantic,
            acoustic_encoder,
            acoustic_decoder,
            fc,
            fc2,
            quantizers,
            downsample: config.semantic_downsample_factor(),
            semantic_pad: config.downsample_factor / 2,
            hop: config.hop_length(),
            sample_rate: config.sample_rate,
            semantic_rate: config.semantic_sample_rate,
        })
    }

    pub fn num_codebooks(&self) -> usize {
        self.quantizers.len()
    }

    /// Number of 24 kHz samples per token frame.
    pub fn hop(&self) -> usize {
        self.hop
    }

    /// 24 kHz waveform (length must be an integer multiple of `hop`) → `[num_codebooks, frames]` tokens, expanded in row-major order with codebooks first.
    pub fn encode(&self, wave: &[f32]) -> Result<Vec<i32>> {
        ensure!(
            !wave.is_empty() && wave.len().is_multiple_of(self.hop),
            "OmniVoice encoder input length {} is not a positive multiple of {}",
            wave.len(),
            self.hop
        );
        // Semantic branch: resample to 16 kHz, pad 160 zeros on each side, average HuBERT's 13 layers, take every other frame.
        let semantic_wave = super::audio::resample(wave, self.sample_rate, self.semantic_rate);
        let mut padded = vec![0.0f32; self.semantic_pad];
        padded.extend_from_slice(&semantic_wave);
        padded.resize(padded.len() + self.semantic_pad, 0.0);
        let input = Array::from_slice(&padded, &[1, padded.len() as i32, 1]);
        let features = self.hubert.forward(&input)?;
        let frames = features.dim(1);
        let keep: Vec<i32> = (0..frames).step_by(self.downsample.max(1)).collect();
        let features = features.take_axis(&Array::from_slice(&keep, &[keep.len() as i32]), 1)?;
        let semantic = self.semantic.forward(&features)?;
        let frames = semantic.dim(1);

        // Acoustic branch: if the output frame count does not match the semantic frame count, pad hop/2 on each side (HF `encode`'s rule).
        let mut acoustic_input = wave.to_vec();
        if self.acoustic_encoder.out_len(wave.len() as i32) != frames {
            let pad = self.hop / 2;
            let mut v = vec![0.0f32; pad];
            v.extend_from_slice(wave);
            v.resize(v.len() + pad, 0.0);
            acoustic_input = v;
        }
        let acoustic = self
            .acoustic_encoder
            .forward(&Array::from_slice(&acoustic_input, &[1, acoustic_input.len() as i32, 1]))?;
        ensure!(
            acoustic.dim(1) == frames,
            "OmniVoice acoustic frame count {} does not match semantic frame count {frames}",
            acoustic.dim(1)
        );
        let embeddings = self
            .fc
            .forward(&ops::concatenate_axis(&[&acoustic, &semantic], -1)?)?
            .reshape(&[frames, -1])?;

        // Residual vector quantization: `argmax(2·h·eᵀ − |e|²)` is the Euclidean nearest neighbor (`|h|²` is constant per row).
        let mut residual = embeddings;
        let mut codes = Vec::with_capacity(self.quantizers.len() * frames as usize);
        for quantizer in &self.quantizers {
            let h = quantizer.project_in.forward(&residual)?;
            let score = ops::matmul(&h, quantizer.embed.t())?
                .multiply(Array::from_f32(2.0))?
                .subtract(&quantizer.embed_sq)?;
            let index = argmax_axis(&score, -1, false)?.as_dtype(Dtype::Uint32)?;
            residual = residual.subtract(&quantizer.decode(&index)?)?;
            crate::synthesize::tensor::transforms::eval([&residual, &index])?;
            codes.extend(index.as_slice::<u32>().iter().map(|&c| c as i32));
        }
        Ok(codes)
    }

    /// `[num_codebooks, frames]` tokens (row-major) → 24 kHz waveform.
    pub fn decode(&self, codes: &[i32], frames: usize) -> Result<Vec<f32>> {
        let n = self.quantizers.len();
        ensure!(
            frames > 0 && codes.len() == n * frames,
            "OmniVoice decoder input has the wrong shape: {} tokens, {frames} frames",
            codes.len()
        );
        let mut quantized: Option<Array> = None;
        for (i, quantizer) in self.quantizers.iter().enumerate() {
            let row: Vec<u32> = codes[i * frames..(i + 1) * frames].iter().map(|&c| c as u32).collect();
            let part = quantizer.decode(&Array::from_slice(&row, &[frames as i32]))?;
            quantized = Some(match quantized {
                Some(sum) => sum.add(&part)?,
                None => part,
            });
        }
        let quantized = quantized.expect("at least one quantizer").reshape(&[1, frames as i32, -1])?;
        let audio = self.acoustic_decoder.forward(&self.fc2.forward(&quantized)?)?;
        crate::synthesize::tensor::transforms::eval([&audio])?;
        Ok(audio.as_dtype(Dtype::Float32)?.as_slice::<f32>().to_vec())
    }
}
