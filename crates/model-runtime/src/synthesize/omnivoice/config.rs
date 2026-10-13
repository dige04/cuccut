//! Some implementations are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/OmniVoiceTTS/Configuration.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-bundle interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! OmniVoice's two configs: the main model `config.json` (aufklarer MLX int8 export, Qwen3 base + 8-codebook audio head) and `audio_tokenizer/config.json` (Higgs Audio v2 tokenizer). Only the fields needed for inference are read; the rest are ignored.

use std::path::Path;

use anyhow::{Context, Result, ensure};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct OmniVoiceConfig {
    pub llm_config: LlmConfig,
    #[serde(default = "default_codebooks")]
    pub num_audio_codebook: usize,
    #[serde(default = "default_audio_vocab")]
    pub audio_vocab_size: usize,
    #[serde(default = "default_mask_id")]
    pub audio_mask_id: usize,
    #[serde(default)]
    pub quantization: Option<Quantization>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LlmConfig {
    pub hidden_size: usize,
    pub intermediate_size: usize,
    pub num_attention_heads: usize,
    pub num_hidden_layers: usize,
    pub num_key_value_heads: usize,
    #[serde(default)]
    pub head_dim: Option<usize>,
    pub rms_norm_eps: f32,
    /// transformers 5 moved `rope_theta` into `rope_parameters`; both places are accepted.
    #[serde(default)]
    pub rope_theta: Option<f32>,
    #[serde(default)]
    pub rope_parameters: Option<RopeParameters>,
    pub vocab_size: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RopeParameters {
    #[serde(default)]
    pub rope_theta: Option<f32>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Quantization {
    pub group_size: usize,
    pub bits: u32,
}

fn default_codebooks() -> usize {
    8
}
fn default_audio_vocab() -> usize {
    1025
}
fn default_mask_id() -> usize {
    1024
}

impl LlmConfig {
    pub fn head_dim(&self) -> usize {
        self.head_dim.unwrap_or(self.hidden_size / self.num_attention_heads)
    }

    pub fn rope_theta(&self) -> f32 {
        self.rope_parameters
            .as_ref()
            .and_then(|p| p.rope_theta)
            .or(self.rope_theta)
            .unwrap_or(1_000_000.0)
    }
}

impl OmniVoiceConfig {
    /// Reads the `config.json` listed in the manifest.
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path).with_context(|| format!("无法读取 OmniVoice 配置 {}", path.display()))?;
        Self::parse(&text).with_context(|| format!("解析 OmniVoice 配置 {} 失败", path.display()))
    }

    pub fn parse(text: &str) -> Result<Self> {
        let config: Self = serde_json::from_str(text)?;
        ensure!(
            config.audio_mask_id < config.audio_vocab_size,
            "OmniVoice audio_mask_id {} 超出音频词表 {}",
            config.audio_mask_id,
            config.audio_vocab_size
        );
        Ok(config)
    }

    /// `(group_size, bits)`; `bits = 0` when not quantized.
    pub fn quant(&self) -> (usize, u32) {
        self.quantization.map_or((64, 0), |q| (q.group_size, q.bits))
    }
}

/// Higgs Audio v2 tokenizer config.
#[derive(Debug, Clone, Deserialize)]
pub struct CodecConfig {
    pub sample_rate: u32,
    pub semantic_sample_rate: u32,
    #[serde(default = "default_downsample")]
    pub downsample_factor: usize,
    pub codebook_size: usize,
    pub codebook_dim: usize,
    #[serde(default = "default_kernel")]
    pub kernel_size: usize,
    #[serde(default = "default_kernel")]
    pub unit_kernel_size: usize,
    pub strides: Vec<usize>,
    pub block_dilations: Vec<usize>,
    pub channel_ratios: Vec<f64>,
    pub target_bandwidths: Vec<f64>,
    pub acoustic_model_config: AcousticConfig,
    pub semantic_model_config: SemanticConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AcousticConfig {
    pub encoder_hidden_size: usize,
    pub decoder_hidden_size: usize,
    pub hidden_size: usize,
    /// Redundant field present in the export; HF actually uses the product of `downsampling_ratios`, and the two must match.
    #[serde(default)]
    pub hop_length: Option<usize>,
    pub downsampling_ratios: Vec<usize>,
    pub upsampling_ratios: Vec<usize>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SemanticConfig {
    pub hidden_size: usize,
    pub num_attention_heads: usize,
    pub num_hidden_layers: usize,
    pub conv_dim: Vec<usize>,
    pub conv_kernel: Vec<usize>,
    pub conv_stride: Vec<usize>,
    pub num_conv_pos_embeddings: usize,
    pub num_conv_pos_embedding_groups: usize,
    pub layer_norm_eps: f32,
    #[serde(default)]
    pub conv_bias: bool,
    #[serde(default = "default_feat_norm")]
    pub feat_extract_norm: String,
    #[serde(default)]
    pub do_stable_layer_norm: bool,
}

fn default_downsample() -> usize {
    320
}
fn default_kernel() -> usize {
    3
}
fn default_feat_norm() -> String {
    "group".to_string()
}

impl CodecConfig {
    /// Reads the `audio_tokenizer/config.json` listed in the manifest.
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path).with_context(|| format!("无法读取 OmniVoice 音频分词器配置 {}", path.display()))?;
        Self::parse(&text).with_context(|| format!("解析 OmniVoice 音频分词器配置 {} 失败", path.display()))
    }

    pub fn parse(text: &str) -> Result<Self> {
        let config: Self = serde_json::from_str(text)?;
        let semantic = &config.semantic_model_config;
        ensure!(
            semantic.feat_extract_norm == "group" && !semantic.do_stable_layer_norm,
            "OmniVoice 音频分词器只支持 HuBERT group-norm / post-norm 结构"
        );
        ensure!(
            semantic.conv_dim.len() == semantic.conv_kernel.len() && semantic.conv_kernel.len() == semantic.conv_stride.len(),
            "OmniVoice HuBERT 卷积层配置长度不一致"
        );
        ensure!(
            config.strides.len() == config.channel_ratios.len() && config.channel_ratios.iter().all(|r| *r == 1.0),
            "OmniVoice 语义编码器只支持 channel_ratios 全为 1"
        );
        let hop = config.hop_length();
        ensure!(hop > 0 && hop % 2 == 0, "OmniVoice 声学 hop_length 必须是正偶数，收到 {hop}");
        ensure!(
            config.acoustic_model_config.hop_length.is_none_or(|h| h == hop),
            "OmniVoice 声学 hop_length 与 downsampling_ratios 之积 {hop} 不符"
        );
        ensure!(
            config.acoustic_model_config.upsampling_ratios.iter().product::<usize>() == hop,
            "OmniVoice 声学 upsampling_ratios 之积与 hop_length {hop} 不符"
        );
        ensure!(
            config.num_quantizers() > 0,
            "OmniVoice 音频分词器的 target_bandwidths 不足一个量化器"
        );
        Ok(config)
    }

    /// Number of 24 kHz samples per encoded token frame (960): HF `prod(downsampling_ratios)`.
    pub fn hop_length(&self) -> usize {
        self.acoustic_model_config.downsampling_ratios.iter().product()
    }

    /// Token frame rate (25 Hz): HF `ceil(sample_rate / hop_length)`.
    pub fn frame_rate(&self) -> usize {
        (self.sample_rate as usize).div_ceil(self.hop_length())
    }

    /// HF `semantic_downsample_factor`：`hop / (sr / semantic_sr) / downsample_factor`。
    pub fn semantic_downsample_factor(&self) -> usize {
        let ratio = f64::from(self.sample_rate) / f64::from(self.semantic_sample_rate);
        ((self.hop_length() as f64 / ratio) / self.downsample_factor as f64) as usize
    }

    /// Number of quantizers (HF `num_quantizers`: `1000·highest bandwidth // (frame rate · ceil(log2 codebook size))`).
    /// Encoding uses the highest bandwidth by default, i.e. all quantizers.
    pub fn num_quantizers(&self) -> usize {
        let bandwidth = self.target_bandwidths.last().copied().unwrap_or(0.0);
        let nbits = (self.codebook_size as f64).log2().ceil();
        (1000.0 * bandwidth / (self.frame_rate() as f64 * nbits)).floor() as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAIN: &str = r#"{
        "audio_mask_id": 1024, "audio_vocab_size": 1025, "num_audio_codebook": 8,
        "llm_config": {
            "hidden_size": 1024, "intermediate_size": 3072, "num_attention_heads": 16,
            "num_hidden_layers": 28, "num_key_value_heads": 8, "head_dim": 128,
            "rms_norm_eps": 1e-06, "rope_parameters": {"rope_theta": 1000000, "rope_type": "default"},
            "vocab_size": 151676
        },
        "quantization": {"group_size": 64, "bits": 8}
    }"#;

    const CODEC: &str = r#"{
        "acoustic_model_config": {
            "decoder_hidden_size": 1024, "downsampling_ratios": [8, 5, 4, 2, 3],
            "encoder_hidden_size": 64, "hidden_size": 256, "hop_length": 960,
            "upsampling_ratios": [8, 5, 4, 2, 3]
        },
        "block_dilations": [1, 1], "channel_ratios": [1, 1], "codebook_dim": 64,
        "codebook_size": 1024, "downsample_factor": 320, "kernel_size": 3,
        "sample_rate": 24000,
        "semantic_model_config": {
            "conv_bias": false, "conv_dim": [512, 512, 512, 512, 512, 512, 512],
            "conv_kernel": [10, 3, 3, 3, 3, 2, 2], "conv_stride": [5, 2, 2, 2, 2, 2, 2],
            "do_stable_layer_norm": false, "feat_extract_norm": "group", "hidden_size": 768,
            "layer_norm_eps": 1e-05, "num_attention_heads": 12, "num_conv_pos_embedding_groups": 16,
            "num_conv_pos_embeddings": 128, "num_hidden_layers": 12
        },
        "semantic_sample_rate": 16000, "strides": [1, 1],
        "target_bandwidths": [0.5, 1, 1.5, 2], "unit_kernel_size": 3
    }"#;

    #[test]
    fn main_config_reads_rope_from_parameters_and_quantization() {
        let config = OmniVoiceConfig::parse(MAIN).unwrap();
        assert_eq!(config.llm_config.head_dim(), 128);
        assert_eq!(config.llm_config.rope_theta(), 1_000_000.0);
        assert_eq!(config.quant(), (64, 8));
        assert_eq!(config.audio_mask_id, 1024);
    }

    #[test]
    fn codec_config_derives_rates_like_hf() {
        let config = CodecConfig::parse(CODEC).unwrap();
        assert_eq!(config.hop_length(), 960);
        assert_eq!(config.frame_rate(), 25);
        assert_eq!(config.semantic_downsample_factor(), 2);
        // 2 kbps / (log2(1024) · 25 / 1000) = 8 quantizers.
        assert_eq!(config.num_quantizers(), 8);
    }
}
