//! This file's partial implementation references speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/Configuration.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model packages and transcription interface; the original upstream source attribution is retained.
//! Full text of the original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` at the repository root.
//!
//! The backend-independent parts of Qwen3-ASR and Qwen3-ForcedAligner: checking `config.json`, the tokenizer files, the prompt template tokens, the audio tower structure and the language prefix in the model output. The MLX (`backend::mlx::qwen3`) and candle (`backend::candle`) backends share this one; each backend's own text decoder configuration (its quantization parameter types differ) stays in the backend.

use std::path::Path;

use serde_json::Value;

use super::decoding::AsrModelSize;

// Prompt template and the special tokens used in generation.
pub(crate) const EOS_TOKEN: i32 = 151_645;
pub(crate) const IM_START: i32 = 151_644;
pub(crate) const AUDIO_START: i32 = 151_669;
pub(crate) const AUDIO_END: i32 = 151_670;
pub(crate) const AUDIO_PAD: i32 = 151_676;
pub(crate) const ASR_TEXT: i32 = 151_704;
pub(crate) const NEWLINE: i32 = 198;
pub(crate) const SYSTEM: i32 = 8_948;
pub(crate) const USER: i32 = 872;
pub(crate) const ASSISTANT: i32 = 77_091;

/// Structure of the audio tower (the two Qwen3-ASR sizes and the forced aligner).
#[derive(Debug, Clone, Copy)]
pub struct AudioEncoderConfig {
    pub d_model: usize,
    pub heads: usize,
    pub ffn_dim: usize,
    pub layers: usize,
    pub output_dim: usize,
    pub transpose_pytorch_conv: bool,
}

impl AudioEncoderConfig {
    pub const SMALL: Self = Self {
        d_model: 896,
        heads: 14,
        ffn_dim: 3584,
        layers: 18,
        output_dim: 1024,
        transpose_pytorch_conv: false,
    };

    pub const LARGE: Self = Self {
        d_model: 1024,
        heads: 16,
        ffn_dim: 4096,
        layers: 24,
        output_dim: 2048,
        transpose_pytorch_conv: false,
    };

    pub const FORCED_ALIGNER: Self = Self {
        d_model: 1024,
        heads: 16,
        ffn_dim: 4096,
        layers: 24,
        output_dim: 1024,
        transpose_pytorch_conv: true,
    };

    /// Audio tower for each size tier.
    pub fn for_size(size: AsrModelSize) -> Self {
        match size {
            AsrModelSize::Small => Self::SMALL,
            AsrModelSize::Large => Self::LARGE,
        }
    }
}

/// Hidden width of the text decoder for each size tier (`TextDecoderConfig::small` / `large` in both backends match this).
pub fn text_hidden_size(size: AsrModelSize) -> usize {
    match size {
        AsrModelSize::Small => 1024,
        AsrModelSize::Large => 2048,
    }
}

/// Shape and quantization parameters read from `config.json`, checked before loading.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Qwen3Config {
    pub size: AsrModelSize,
    pub bits: i32,
    pub group_size: i32,
}

impl Qwen3Config {
    /// The size is identified from the audio tower d_model and the text hidden width: 0.6B is 896 / 1024, 1.7B is 1024 / 2048; other combinations are rejected.
    /// The quantization bit width is taken from `quantization.bits`; without quantization, float weights are used.
    pub fn parse(config: &Value) -> Result<Self, String> {
        let thinker = config.get("thinker_config").ok_or("config.json has no thinker_config")?;
        let audio_width = thinker.pointer("/audio_config/d_model").and_then(Value::as_u64);
        let text_width = thinker.pointer("/text_config/hidden_size").and_then(Value::as_u64);
        let size = [AsrModelSize::Small, AsrModelSize::Large]
            .into_iter()
            .find(|size| {
                audio_width == Some(AudioEncoderConfig::for_size(*size).d_model as u64)
                    && text_width == Some(text_hidden_size(*size) as u64)
            })
            .ok_or_else(|| format!("unsupported Qwen3-ASR size (audio d_model {audio_width:?}, text hidden_size {text_width:?})"))?;
        let quantization = config.get("quantization");
        let bits = match quantization.and_then(|value| value.get("bits")).and_then(Value::as_i64) {
            None => 16,
            Some(bits @ (4 | 8)) => bits as i32,
            Some(other) => return Err(format!("unsupported quantization: {other} bits")),
        };
        let group_size = quantization
            .and_then(|value| value.get("group_size"))
            .and_then(Value::as_i64)
            .unwrap_or(64);
        if !matches!(group_size, 32 | 64 | 128) {
            return Err(format!("unsupported quantization group size {group_size}"));
        }
        Ok(Self {
            size,
            bits,
            group_size: group_size as i32,
        })
    }
}

/// The three tokenizer files.
pub struct TokenizerFiles<'a> {
    pub vocabulary: &'a Path,
    pub merges: Option<&'a Path>,
    pub config: Option<&'a Path>,
}

/// Quantization bit width when the aligner manifest has no `quantize_config.json` (if v2 cannot recognize the bit width from the repo name, it also uses 4).
pub const ALIGNER_DEFAULT_BITS: i32 = 4;

/// `quantization.bits` from the aligner's `quantize_config.json`; when this file is not listed (`None`), uses [`ALIGNER_DEFAULT_BITS`].
/// Bit widths other than those v2 accepts (4, 5, 8) are rejected.
pub fn aligner_quantization_bits(quantize_config: Option<&Path>) -> anyhow::Result<i32> {
    use anyhow::Context;
    let Some(path) = quantize_config else {
        return Ok(ALIGNER_DEFAULT_BITS);
    };
    let config: Value = serde_json::from_slice(&std::fs::read(path).context("read aligner quantize_config.json")?)
        .context("aligner quantize_config.json is not valid JSON")?;
    match config.pointer("/quantization/bits").and_then(Value::as_i64) {
        None => Ok(ALIGNER_DEFAULT_BITS),
        Some(bits @ (4 | 5 | 8)) => Ok(bits as i32),
        Some(other) => anyhow::bail!("aligner quantization bit width {other} is not supported"),
    }
}

/// `language English<asr_text>Hello.` → (`Hello.`, `English`). Without `<asr_text>`, the whole string is the text.
pub fn split_language_prefix(raw: &str) -> (String, Option<String>) {
    match raw.split_once("<asr_text>") {
        Some((prefix, text)) => {
            let name = prefix
                .trim()
                .strip_prefix("language")
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .map(str::to_owned);
            (text.trim().to_owned(), name)
        }
        None => (raw.trim().to_owned(), None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn splits_the_language_prefix() {
        assert_eq!(
            split_language_prefix("language English<asr_text> Hello. "),
            ("Hello.".into(), Some("English".into()))
        );
        assert_eq!(
            split_language_prefix("language None<asr_text>"),
            (String::new(), Some("None".into()))
        );
        assert_eq!(split_language_prefix(" plain text "), ("plain text".into(), None));
    }

    #[test]
    fn parses_the_small_and_large_configs_only() {
        let config = |audio: u64, text: u64, quantization: Value| {
            json!({
                "quantization": quantization,
                "thinker_config": { "audio_config": { "d_model": audio }, "text_config": { "hidden_size": text } }
            })
        };
        assert_eq!(
            Qwen3Config::parse(&config(896, 1024, json!({ "bits": 4, "group_size": 64 }))),
            Ok(Qwen3Config {
                size: AsrModelSize::Small,
                bits: 4,
                group_size: 64
            })
        );
        assert_eq!(
            Qwen3Config::parse(&config(896, 1024, Value::Null)),
            Ok(Qwen3Config {
                size: AsrModelSize::Small,
                bits: 16,
                group_size: 64
            })
        );
        assert_eq!(
            Qwen3Config::parse(&config(1024, 2048, json!({ "bits": 8, "group_size": 64 }))),
            Ok(Qwen3Config {
                size: AsrModelSize::Large,
                bits: 8,
                group_size: 64
            })
        );
        // The two tiers' widths must not be combined across each other.
        assert!(Qwen3Config::parse(&config(896, 2048, json!({ "bits": 4 }))).is_err());
        assert!(Qwen3Config::parse(&config(1024, 1024, json!({ "bits": 4 }))).is_err());
        assert!(Qwen3Config::parse(&config(896, 1024, json!({ "bits": 3 }))).is_err());
        assert!(Qwen3Config::parse(&json!({})).is_err());
    }
}
