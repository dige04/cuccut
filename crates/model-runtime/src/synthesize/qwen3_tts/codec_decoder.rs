//! Parts rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3TTS/SpeechTokenizerDecoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model package interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; scope of the sources is in the root `THIRD_PARTY_NOTICES.md`.
//!
//! Speech tokenizer decoder (Mimi structure): 16 codebook groups → 24 kHz waveform.
//! Weights are the `decoder.*` entries in Qwen3-TTS-Tokenizer-12Hz `model.safetensors` (F32, PyTorch layout).

use crate::synthesize::tensor::fast::{self, ScaledDotProductAttentionMask};
use crate::synthesize::tensor::nn::silu;
use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Context, Result, bail};

use crate::synthesize::tensor::gelu_same_dtype;

use super::layers::{CausalConv1d, CausalConvTranspose1d, LayerNorm, Linear, RmsNorm};
use super::tokens::{NUM_CODEBOOKS, SAMPLES_PER_FRAME};
use super::weights::Weights;

/// Decoder transformer dimensions: hidden size 512, 16 heads × 64 (`SpeechTokenizerDecoderConfig`).
const NUM_HEADS: i32 = 16;
const HEAD_DIM: i32 = 64;
const NUM_LAYERS: usize = 8;
const ROPE_THETA: f32 = 10_000.0;
const RMS_NORM_EPS: f32 = 1e-8;
const LAYER_NORM_EPS: f32 = 1e-5;
const UPSAMPLE_RATES: [i32; 4] = [8, 5, 4, 3];
/// Chunked decoding: 25 frames per chunk, with 10 frames of left context.
const CHUNK_SIZE: i32 = 25;
const LEFT_CONTEXT: i32 = 10;

fn take_vector_1x1c(weights: &mut Weights, key: &str) -> Result<Array> {
    let value = weights.take(key)?;
    Ok(value.reshape(&[1, 1, -1])?)
}

/// SnakeBeta：`x + (1/exp(beta)) * sin(exp(alpha) * x)^2`。
struct SnakeBeta {
    alpha: Array,
    beta: Array,
}

impl SnakeBeta {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        Ok(Self {
            alpha: take_vector_1x1c(weights, &format!("{prefix}.alpha"))?,
            beta: take_vector_1x1c(weights, &format!("{prefix}.beta"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let alpha = ops::exp(&self.alpha)?;
        let beta = ops::exp(&self.beta)?;
        let sin = ops::sin(&x.multiply(&alpha)?)?;
        let term = ops::square(&sin)?.divide(&beta)?;
        Ok(x.add(&term)?)
    }
}

fn load_causal_conv(weights: &mut Weights, prefix: &str, stride: i32, dilation: i32, groups: i32) -> Result<CausalConv1d> {
    let weight = weights.take_conv1d(&format!("{prefix}.weight"), false)?;
    let bias = weights.take_optional(&format!("{prefix}.bias"));
    Ok(CausalConv1d::new(weight, bias, stride, dilation, groups))
}

fn load_causal_conv_transpose(weights: &mut Weights, prefix: &str, stride: i32) -> Result<CausalConvTranspose1d> {
    let weight = weights.take_conv_transpose1d(&format!("{prefix}.weight"))?;
    let bias = weights.take_optional(&format!("{prefix}.bias"));
    Ok(CausalConvTranspose1d::new(weight, bias, stride))
}

/// ConvNeXt block: depthwise conv → LayerNorm → Linear → GELU → Linear → gamma scaling + residual.
struct ConvNeXtBlock {
    dwconv: CausalConv1d,
    norm: LayerNorm,
    pwconv1: Linear,
    pwconv2: Linear,
    gamma: Array,
}

impl ConvNeXtBlock {
    fn load(weights: &mut Weights, prefix: &str, dim: i32) -> Result<Self> {
        Ok(Self {
            dwconv: load_causal_conv(weights, &format!("{prefix}.dwconv.conv"), 1, 1, dim)?,
            norm: LayerNorm::load(weights, &format!("{prefix}.norm"), LAYER_NORM_EPS)?,
            pwconv1: Linear::load(weights, &format!("{prefix}.pwconv1"), 0, 0)?,
            pwconv2: Linear::load(weights, &format!("{prefix}.pwconv2"), 0, 0)?,
            gamma: take_vector_1x1c(weights, &format!("{prefix}.gamma"))?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = self.dwconv.forward(x)?;
        let h = self.norm.forward(&h)?;
        let h = self.pwconv1.forward(&h)?;
        let h = gelu_same_dtype(&h)?;
        let h = self.pwconv2.forward(&h)?;
        let h = h.multiply(&self.gamma)?;
        Ok(h.add(x)?)
    }
}

/// Residual unit: Snake → dilated conv (k7) → Snake → 1×1 conv + residual.
struct ResidualUnit {
    act1: SnakeBeta,
    conv1: CausalConv1d,
    act2: SnakeBeta,
    conv2: CausalConv1d,
}

impl ResidualUnit {
    fn load(weights: &mut Weights, prefix: &str, dilation: i32) -> Result<Self> {
        Ok(Self {
            act1: SnakeBeta::load(weights, &format!("{prefix}.act1"))?,
            conv1: load_causal_conv(weights, &format!("{prefix}.conv1.conv"), 1, dilation, 1)?,
            act2: SnakeBeta::load(weights, &format!("{prefix}.act2"))?,
            conv2: load_causal_conv(weights, &format!("{prefix}.conv2.conv"), 1, 1, 1)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let h = self.act1.forward(x)?;
        let h = self.conv1.forward(&h)?;
        let h = self.act2.forward(&h)?;
        let h = self.conv2.forward(&h)?;
        Ok(h.add(x)?)
    }
}

/// Upsampling block: Snake → transposed conv (k=2·stride) → 3 residual units (dilation 1/3/9).
struct DecoderBlock {
    snake: SnakeBeta,
    upsample: CausalConvTranspose1d,
    units: Vec<ResidualUnit>,
}

impl DecoderBlock {
    fn load(weights: &mut Weights, prefix: &str, stride: i32) -> Result<Self> {
        let mut units = Vec::with_capacity(3);
        for (index, dilation) in [1, 3, 9].into_iter().enumerate() {
            units.push(ResidualUnit::load(weights, &format!("{prefix}.block.{}", index + 2), dilation)?);
        }
        Ok(Self {
            snake: SnakeBeta::load(weights, &format!("{prefix}.block.0"))?,
            upsample: load_causal_conv_transpose(weights, &format!("{prefix}.block.1.conv"), stride)?,
            units,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let mut h = self.snake.forward(x)?;
        h = self.upsample.forward(&h)?;
        for unit in &self.units {
            h = unit.forward(&h)?;
        }
        Ok(h)
    }
}

/// Attention in the decoder transformer: 16 heads × 64, no bias, RoPE θ=10000.
struct TransformerAttention {
    q_proj: Linear,
    k_proj: Linear,
    v_proj: Linear,
    o_proj: Linear,
}

impl TransformerAttention {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        Ok(Self {
            q_proj: Linear::load(weights, &format!("{prefix}.q_proj"), 0, 0)?,
            k_proj: Linear::load(weights, &format!("{prefix}.k_proj"), 0, 0)?,
            v_proj: Linear::load(weights, &format!("{prefix}.v_proj"), 0, 0)?,
            o_proj: Linear::load(weights, &format!("{prefix}.o_proj"), 0, 0)?,
        })
    }

    fn forward(&self, x: &Array, mask: Option<&Array>) -> Result<Array> {
        let batch = x.dim(0);
        let seq_len = x.dim(1);
        let split = |proj: &Linear| -> Result<Array> {
            let projected = proj.forward(x)?;
            Ok(projected
                .reshape(&[batch, seq_len, NUM_HEADS, HEAD_DIM])?
                .transpose_axes(&[0, 2, 1, 3])?)
        };
        let q = split(&self.q_proj)?;
        let k = split(&self.k_proj)?;
        let v = split(&self.v_proj)?;
        let q = fast::rope(&q, HEAD_DIM, false, ROPE_THETA, 1.0, 0, None)?;
        let k = fast::rope(&k, HEAD_DIM, false, ROPE_THETA, 1.0, 0, None)?;
        let scale = 1.0 / (HEAD_DIM as f32).sqrt();
        let mask = mask.map(ScaledDotProductAttentionMask::Array);
        let attended = fast::scaled_dot_product_attention(&q, &k, &v, scale, mask, None)?;
        let merged = attended
            .transpose_axes(&[0, 2, 1, 3])?
            .reshape(&[batch, seq_len, NUM_HEADS * HEAD_DIM])?;
        self.o_proj.forward(&merged)
    }
}

struct TransformerLayer {
    attention: TransformerAttention,
    gate_proj: Linear,
    up_proj: Linear,
    down_proj: Linear,
    norm1: RmsNorm,
    norm2: RmsNorm,
    attn_scale: Array,
    mlp_scale: Array,
}

impl TransformerLayer {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        Ok(Self {
            attention: TransformerAttention::load(weights, &format!("{prefix}.self_attn"))?,
            gate_proj: Linear::load(weights, &format!("{prefix}.mlp.gate_proj"), 0, 0)?,
            up_proj: Linear::load(weights, &format!("{prefix}.mlp.up_proj"), 0, 0)?,
            down_proj: Linear::load(weights, &format!("{prefix}.mlp.down_proj"), 0, 0)?,
            norm1: RmsNorm::load(weights, &format!("{prefix}.input_layernorm"), RMS_NORM_EPS)?,
            norm2: RmsNorm::load(weights, &format!("{prefix}.post_attention_layernorm"), RMS_NORM_EPS)?,
            attn_scale: take_vector_1x1c(weights, &format!("{prefix}.self_attn_layer_scale.scale"))?,
            mlp_scale: take_vector_1x1c(weights, &format!("{prefix}.mlp_layer_scale.scale"))?,
        })
    }

    fn forward(&self, x: &Array, mask: Option<&Array>) -> Result<Array> {
        let normed = self.norm1.forward(x)?;
        let attn = self.attention.forward(&normed, mask)?;
        let h = x.add(&attn.multiply(&self.attn_scale)?)?;
        let normed = self.norm2.forward(&h)?;
        let gate = silu(self.gate_proj.forward(&normed)?)?;
        let mlp = self.down_proj.forward(&gate.multiply(&self.up_proj.forward(&normed)?)?)?;
        Ok(h.add(&mlp.multiply(&self.mlp_scale)?)?)
    }
}

/// `input_proj(1024→512) → 8 layers → RMSNorm → output_proj(512→1024)`.
struct DecoderTransformer {
    input_proj: Linear,
    layers: Vec<TransformerLayer>,
    norm: RmsNorm,
    output_proj: Linear,
}

impl DecoderTransformer {
    fn load(weights: &mut Weights, prefix: &str) -> Result<Self> {
        let mut layers = Vec::with_capacity(NUM_LAYERS);
        for index in 0..NUM_LAYERS {
            layers.push(TransformerLayer::load(weights, &format!("{prefix}.layers.{index}"))?);
        }
        Ok(Self {
            input_proj: Linear::load(weights, &format!("{prefix}.input_proj"), 0, 0)?,
            layers,
            norm: RmsNorm::load(weights, &format!("{prefix}.norm"), RMS_NORM_EPS)?,
            output_proj: Linear::load(weights, &format!("{prefix}.output_proj"), 0, 0)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let mut h = self.input_proj.forward(x)?;
        let seq_len = h.dim(1);
        let mask = if seq_len > 1 {
            Some(additive_causal_mask(seq_len, h.dtype())?)
        } else {
            None
        };
        for layer in &self.layers {
            h = layer.forward(&h, mask.as_ref())?;
        }
        h = self.norm.forward(&h)?;
        self.output_proj.forward(&h)
    }
}

/// `where(cols > rows, -1e9, 0)`, shape `[1, 1, S, S]`.
pub(super) fn additive_causal_mask(seq_len: i32, dtype: Dtype) -> Result<Array> {
    let rows = ops::arange::<i32, i32>(None, seq_len, None)?.reshape(&[seq_len, 1])?;
    let cols = ops::arange::<i32, i32>(None, seq_len, None)?.reshape(&[1, seq_len])?;
    let mask = ops::which(&cols.gt(&rows)?, &Array::from_f32(-1e9), &Array::from_f32(0.0))?;
    Ok(mask.reshape(&[1, 1, seq_len, seq_len])?.as_dtype(dtype)?)
}

/// One codebook: `codebook = embedding_sum / max(cluster_usage, 1e-7)` (or use `embed` directly).
fn load_codebook(weights: &mut Weights, prefix: &str) -> Result<Array> {
    if let Some(embed) = weights.take_optional(&format!("{prefix}.embed")) {
        return Ok(embed);
    }
    let usage = weights.take(&format!("{prefix}.cluster_usage"))?;
    let sum = weights.take(&format!("{prefix}.embedding_sum"))?;
    let clamped = ops::maximum(&usage, &Array::from_f32(1e-7))?.reshape(&[-1, 1])?;
    Ok(sum.divide(&clamped)?)
}

/// Decoding side of residual vector quantization: each codebook is looked up and summed, then passed through a 1×1 output projection.
struct ResidualVectorQuantizer {
    codebooks: Vec<Array>,
    /// `[out, in]`, obtained by squeezing the kernel dimension from a Conv1d `[out, in, 1]` weight.
    output_proj: Array,
}

impl ResidualVectorQuantizer {
    fn load(weights: &mut Weights, prefix: &str, count: usize) -> Result<Self> {
        let mut codebooks = Vec::with_capacity(count);
        for index in 0..count {
            codebooks.push(load_codebook(weights, &format!("{prefix}.vq.layers.{index}._codebook"))?);
        }
        let output_proj = weights.take(&format!("{prefix}.output_proj.weight"))?;
        let output_proj = if output_proj.ndim() == 3 {
            output_proj.squeeze_axes(&[2])?
        } else {
            output_proj
        };
        Ok(Self { codebooks, output_proj })
    }

    /// `codes [B, n, T]` → `[B, T, 512]`。
    fn decode(&self, codes: &Array) -> Result<Array> {
        let mut sum: Option<Array> = None;
        for (index, codebook) in self.codebooks.iter().enumerate() {
            let ids = codes.index((.., index as i32, ..));
            let embed = codebook.index(ids);
            sum = Some(match sum {
                Some(acc) => acc.add(&embed)?,
                None => embed,
            });
        }
        let sum = sum.context("RVQ 没有码本")?;
        Ok(ops::matmul(&sum, &self.output_proj.t())?)
    }
}

/// The full decoder.
pub struct CodecDecoder {
    rvq_first: ResidualVectorQuantizer,
    rvq_rest: ResidualVectorQuantizer,
    pre_conv: CausalConv1d,
    transformer: DecoderTransformer,
    pre_upsample1: CausalConvTranspose1d,
    pre_convnext1: ConvNeXtBlock,
    pre_upsample2: CausalConvTranspose1d,
    pre_convnext2: ConvNeXtBlock,
    input_conv: CausalConv1d,
    blocks: Vec<DecoderBlock>,
    final_snake: SnakeBeta,
    final_conv: CausalConv1d,
}

impl CodecDecoder {
    /// `weights` already has the `decoder.` prefix stripped.
    pub fn load(weights: &mut Weights) -> Result<Self> {
        let mut blocks = Vec::with_capacity(UPSAMPLE_RATES.len());
        for (index, stride) in UPSAMPLE_RATES.into_iter().enumerate() {
            blocks.push(DecoderBlock::load(weights, &format!("decoder.{}", index + 1), stride)?);
        }
        Ok(Self {
            rvq_first: ResidualVectorQuantizer::load(weights, "quantizer.rvq_first", 1)?,
            rvq_rest: ResidualVectorQuantizer::load(weights, "quantizer.rvq_rest", NUM_CODEBOOKS - 1)?,
            pre_conv: load_causal_conv(weights, "pre_conv.conv", 1, 1, 1)?,
            transformer: DecoderTransformer::load(weights, "pre_transformer")?,
            pre_upsample1: load_causal_conv_transpose(weights, "upsample.0.0.conv", 2)?,
            pre_convnext1: ConvNeXtBlock::load(weights, "upsample.0.1", 1024)?,
            pre_upsample2: load_causal_conv_transpose(weights, "upsample.1.0.conv", 2)?,
            pre_convnext2: ConvNeXtBlock::load(weights, "upsample.1.1", 1024)?,
            input_conv: load_causal_conv(weights, "decoder.0.conv", 1, 1, 1)?,
            blocks,
            final_snake: SnakeBeta::load(weights, "decoder.5")?,
            final_conv: load_causal_conv(weights, "decoder.6.conv", 1, 1, 1)?,
        })
    }

    /// `codes [B, 16, T]` → `[B, T*1920, 1]`. Not clamped to [-1, 1]: Base output often exceeds full scale, and hard clipping would flatten the waveform;
    /// [`crate::synthesize::loudness`] scales the whole segment down proportionally by its peak.
    fn forward(&self, codes: &Array) -> Result<Array> {
        if codes.dim(1) != NUM_CODEBOOKS as i32 {
            bail!("解码器需要 {} 组 codebook，实际 {}", NUM_CODEBOOKS, codes.dim(1));
        }
        let first = self.rvq_first.decode(&codes.index((.., ..1, ..)))?;
        let rest = self.rvq_rest.decode(&codes.index((.., 1.., ..)))?;
        let mut h = first.add(&rest)?;
        h = self.pre_conv.forward(&h)?;
        h = self.transformer.forward(&h)?;
        h = self.pre_upsample1.forward(&h)?;
        h = self.pre_convnext1.forward(&h)?;
        h = self.pre_upsample2.forward(&h)?;
        h = self.pre_convnext2.forward(&h)?;
        h = self.input_conv.forward(&h)?;
        for block in &self.blocks {
            h = block.forward(&h)?;
        }
        h = self.final_snake.forward(&h)?;
        h = self.final_conv.forward(&h)?;
        Ok(h)
    }

    /// Chunked decoding: each chunk carries 10 frames of left context, and the samples corresponding to that context are trimmed.
    pub fn chunked_decode(&self, codes: &Array) -> Result<Array> {
        let num_frames = codes.dim(2);
        if num_frames <= CHUNK_SIZE + LEFT_CONTEXT {
            let waveform = self.forward(codes)?;
            waveform.eval()?;
            return Ok(waveform);
        }
        let mut chunks = Vec::new();
        let mut offset = 0;
        while offset < num_frames {
            let chunk_end = (offset + CHUNK_SIZE).min(num_frames);
            let context_start = (offset - LEFT_CONTEXT).max(0);
            let actual_context = offset - context_start;
            let chunk_codes = codes.index((.., .., context_start..chunk_end));
            let waveform = self.forward(&chunk_codes)?;
            let total = waveform.dim(1);
            let trim = (actual_context * SAMPLES_PER_FRAME as i32).min(total);
            if trim < total {
                let kept = waveform.index((.., trim.., ..));
                kept.eval()?;
                chunks.push(kept);
            }
            offset = chunk_end;
        }
        let refs: Vec<&Array> = chunks.iter().collect();
        Ok(ops::concatenate_axis(&refs, 1)?)
    }

    /// Decodes codes into host-side f32 samples (24 kHz mono).
    pub fn decode_to_samples(&self, codes: &Array) -> Result<Vec<f32>> {
        let waveform = self.chunked_decode(codes)?;
        let flat = waveform.reshape(&[-1])?.as_dtype(Dtype::Float32)?;
        flat.eval()?;
        Ok(flat.as_slice::<f32>().to_vec())
    }
}
