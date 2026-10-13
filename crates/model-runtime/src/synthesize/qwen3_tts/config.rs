//! Parts rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3TTS/Configuration.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model package interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; scope of the sources is in the root `THIRD_PARTY_NOTICES.md`.
//!
//! Qwen3-TTS model configuration: parses from the model package's `config.json`
//! the Talker / Code Predictor dimensions, the quantization bit width, and CustomVoice's speaker table.
//!
//! Pure logic, compiled on all platforms; weight shapes are still determined by safetensors, and this only decides the modules'
//! construction parameters.

use anyhow::{Context, Result, bail};
use serde::Deserialize;
use std::collections::BTreeMap;

/// Model size: 0.6B (hidden size 1024) or 1.7B (hidden size 2048).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelSize {
    Small,
    Large,
}

/// Talker (28-layer Qwen3 backbone) configuration; the defaults are those of 0.6B.
#[derive(Debug, Clone, PartialEq)]
pub struct TalkerConfig {
    pub hidden_size: usize,
    pub num_layers: usize,
    pub num_heads: usize,
    pub num_kv_heads: usize,
    pub head_dim: usize,
    pub intermediate_size: usize,
    pub rope_theta: f32,
    pub rms_norm_eps: f32,
    pub text_vocab_size: usize,
    pub text_hidden_size: usize,
    pub codec_vocab_size: usize,
    /// 0 means bf16 unquantized; 4 / 8 mean MLX affine quantization bit width.
    pub bits: u32,
    pub group_size: usize,
}

impl Default for TalkerConfig {
    fn default() -> Self {
        Self {
            hidden_size: 1024,
            num_layers: 28,
            num_heads: 16,
            num_kv_heads: 8,
            head_dim: 128,
            intermediate_size: 3072,
            rope_theta: 1_000_000.0,
            rms_norm_eps: 1e-6,
            text_vocab_size: 151_936,
            text_hidden_size: 2048,
            codec_vocab_size: 3072,
            bits: 8,
            group_size: 64,
        }
    }
}

impl TalkerConfig {
    /// 1.7B: hidden size 2048, FFN 6144; otherwise the same as 0.6B.
    pub fn large() -> Self {
        Self {
            hidden_size: 2048,
            intermediate_size: 6144,
            ..Self::default()
        }
    }
}

/// Code Predictor configuration (5-layer small transformer, 15 lm heads).
#[derive(Debug, Clone, PartialEq)]
pub struct CodePredictorConfig {
    pub hidden_size: usize,
    /// Input embedding dimension (equal to the Talker hidden size; 2048 for 1.7B, requires `small_to_mtp_projection`).
    pub embedding_dim: usize,
    pub num_layers: usize,
    pub num_heads: usize,
    pub num_kv_heads: usize,
    pub head_dim: usize,
    pub intermediate_size: usize,
    pub rope_theta: f32,
    pub rms_norm_eps: f32,
    pub vocab_size: usize,
    pub num_code_groups: usize,
    pub bits: u32,
    pub group_size: usize,
}

impl Default for CodePredictorConfig {
    fn default() -> Self {
        Self {
            hidden_size: 1024,
            embedding_dim: 1024,
            num_layers: 5,
            num_heads: 16,
            num_kv_heads: 8,
            head_dim: 128,
            intermediate_size: 3072,
            rope_theta: 1_000_000.0,
            rms_norm_eps: 1e-6,
            vocab_size: 2048,
            num_code_groups: 16,
            bits: 8,
            group_size: 64,
        }
    }
}

impl CodePredictorConfig {
    pub fn large() -> Self {
        Self {
            embedding_dim: 2048,
            ..Self::default()
        }
    }

    /// Whether a projection from embedding_dim → hidden_size is needed.
    pub fn needs_projection(&self) -> bool {
        self.embedding_dim != self.hidden_size
    }
}

/// The three variants of the official 12 Hz series (matched against `tts_model_type` in `config.json`):
/// Base does reference-audio cloning, CustomVoice uses 9 preset speakers, and VoiceDesign takes only a sentence
/// describing the voice. Older slimmed exports (aufklarer's Base) lack this field and fall back to the speaker table.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelVariant {
    Base,
    CustomVoice,
    VoiceDesign,
}

impl ModelVariant {
    /// Variant name used in error messages, matching the official repository name.
    pub fn label(self) -> &'static str {
        match self {
            Self::Base => "Base",
            Self::CustomVoice => "CustomVoice",
            Self::VoiceDesign => "VoiceDesign",
        }
    }
}

/// Speaker table of the CustomVoice variant (absent in the Base model, `None`).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SpeakerConfig {
    /// Lowercase speaker name → codec token id.
    pub speaker_ids: BTreeMap<String, i32>,
    /// Lowercase speaker name → dialect language name (e.g. `sichuan_dialect`).
    pub speaker_dialects: BTreeMap<String, String>,
    /// Language id table declared in config.json (lowercase language name → id).
    pub codec_language_ids: BTreeMap<String, i32>,
}

impl SpeakerConfig {
    /// Speaker names in alphabetical order.
    pub fn available_speakers(&self) -> Vec<String> {
        self.speaker_ids.keys().cloned().collect()
    }
}

/// The complete configuration parsed from one model directory.
#[derive(Debug, Clone, PartialEq)]
pub struct Qwen3TtsConfig {
    pub model_size: ModelSize,
    pub variant: ModelVariant,
    pub talker: TalkerConfig,
    pub code_predictor: CodePredictorConfig,
    pub speaker: Option<SpeakerConfig>,
}

impl Qwen3TtsConfig {
    /// Builds the default configuration from size and bit width.
    pub fn for_size(size: ModelSize, bits: u32) -> Self {
        let mut talker = match size {
            ModelSize::Small => TalkerConfig::default(),
            ModelSize::Large => TalkerConfig::large(),
        };
        let mut code_predictor = match size {
            ModelSize::Small => CodePredictorConfig::default(),
            ModelSize::Large => CodePredictorConfig::large(),
        };
        talker.bits = bits;
        code_predictor.bits = bits;
        Self {
            model_size: size,
            variant: ModelVariant::Base,
            talker,
            code_predictor,
            speaker: None,
        }
    }

    /// Whether the weights are quantized (decides whether linear layers use `QuantizedDense` or `Dense`).
    pub fn is_quantized(&self) -> bool {
        self.talker.bits != 0
    }

    /// Parses the text of `config.json` in the model directory.
    pub fn parse(json: &str) -> Result<Self> {
        let raw: RawConfig = serde_json::from_str(json).context("failed to parse Qwen3-TTS config.json")?;

        let declared = raw.model_size.as_deref().map(size_from_model_size).transpose()?;
        let by_dim = raw
            .talker_config
            .as_ref()
            .and_then(|t| t.hidden_size)
            .map(size_from_hidden)
            .transpose()?;
        if let (Some(a), Some(b)) = (declared, by_dim)
            && a != b
        {
            bail!("config.json model_size conflicts with talker_config.hidden_size");
        }
        let Some(size) = declared.or(by_dim) else {
            bail!("config.json is missing model_size or talker_config.hidden_size");
        };

        let bits = match &raw.quantization_config {
            Some(q) => {
                if q.bits != 4 && q.bits != 8 {
                    bail!("quantization_config.bits must be 4 or 8, got {}", q.bits);
                }
                q.bits
            }
            None => 0,
        };

        let mut config = Self::for_size(size, bits);
        if let Some(group) = raw.quantization_config.as_ref().and_then(|q| q.group_size) {
            if group == 0 {
                bail!("quantization_config.group_size must be positive");
            }
            config.talker.group_size = group;
            config.code_predictor.group_size = group;
        }

        if let Some(talker) = &raw.talker_config {
            talker.apply(&mut config.talker)?;
            if let Some(cp) = &talker.code_predictor_config {
                cp.apply(&mut config.code_predictor)?;
            }
            config.speaker = talker.speaker_config();
        }
        config.variant = match raw.tts_model_type.as_deref().map(str::trim) {
            Some("custom_voice") => ModelVariant::CustomVoice,
            Some("voice_design") => ModelVariant::VoiceDesign,
            Some("base") | Some("") | None => {
                // Slimmed exports lack this field: if there is a speaker table it is CustomVoice, otherwise Base.
                if config.speaker.is_some() {
                    ModelVariant::CustomVoice
                } else {
                    ModelVariant::Base
                }
            }
            Some(other) => bail!("unsupported tts_model_type: {other}"),
        };
        Ok(config)
    }
}

fn size_from_model_size(value: &str) -> Result<ModelSize> {
    match value.trim().to_ascii_lowercase().as_str() {
        "0.6b" => Ok(ModelSize::Small),
        "1.7b" => Ok(ModelSize::Large),
        other => bail!("unsupported model_size: {other}"),
    }
}

fn size_from_hidden(hidden: usize) -> Result<ModelSize> {
    match hidden {
        1024 => Ok(ModelSize::Small),
        2048 => Ok(ModelSize::Large),
        other => bail!("unsupported talker_config.hidden_size: {other}"),
    }
}

#[derive(Deserialize)]
struct RawConfig {
    model_size: Option<String>,
    tts_model_type: Option<String>,
    quantization_config: Option<RawQuantization>,
    talker_config: Option<RawTalker>,
}

#[derive(Deserialize)]
struct RawQuantization {
    bits: u32,
    group_size: Option<usize>,
}

#[derive(Deserialize)]
struct RawTalker {
    hidden_size: Option<usize>,
    num_hidden_layers: Option<usize>,
    num_attention_heads: Option<usize>,
    num_key_value_heads: Option<usize>,
    head_dim: Option<usize>,
    intermediate_size: Option<usize>,
    rope_theta: Option<f64>,
    rms_norm_eps: Option<f64>,
    text_vocab_size: Option<usize>,
    text_hidden_size: Option<usize>,
    vocab_size: Option<usize>,
    code_predictor_config: Option<RawCodePredictor>,
    #[serde(default)]
    spk_id: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    spk_is_dialect: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    codec_language_id: BTreeMap<String, serde_json::Value>,
}

fn positive(name: &str, value: Option<usize>) -> Result<()> {
    if value == Some(0) {
        bail!("{name} must be positive");
    }
    Ok(())
}

impl RawTalker {
    fn apply(&self, config: &mut TalkerConfig) -> Result<()> {
        positive("talker_config.hidden_size", self.hidden_size)?;
        positive("talker_config.num_hidden_layers", self.num_hidden_layers)?;
        positive("talker_config.num_attention_heads", self.num_attention_heads)?;
        positive("talker_config.num_key_value_heads", self.num_key_value_heads)?;
        positive("talker_config.head_dim", self.head_dim)?;
        positive("talker_config.intermediate_size", self.intermediate_size)?;
        positive("talker_config.text_vocab_size", self.text_vocab_size)?;
        positive("talker_config.text_hidden_size", self.text_hidden_size)?;
        positive("talker_config.vocab_size", self.vocab_size)?;
        if let Some(v) = self.hidden_size {
            config.hidden_size = v;
        }
        if let Some(v) = self.num_hidden_layers {
            config.num_layers = v;
        }
        if let Some(v) = self.num_attention_heads {
            config.num_heads = v;
        }
        if let Some(v) = self.num_key_value_heads {
            config.num_kv_heads = v;
        }
        if let Some(v) = self.head_dim {
            config.head_dim = v;
        }
        if let Some(v) = self.intermediate_size {
            config.intermediate_size = v;
        }
        if let Some(v) = self.rope_theta {
            config.rope_theta = v as f32;
        }
        if let Some(v) = self.rms_norm_eps {
            config.rms_norm_eps = v as f32;
        }
        if let Some(v) = self.text_vocab_size {
            config.text_vocab_size = v;
        }
        if let Some(v) = self.text_hidden_size {
            config.text_hidden_size = v;
        }
        if let Some(v) = self.vocab_size {
            config.codec_vocab_size = v;
        }
        Ok(())
    }

    /// An empty spk_id means the Base model and returns `None`;
    /// in `spk_is_dialect`, only string values count as dialects (a boolean false is ignored).
    fn speaker_config(&self) -> Option<SpeakerConfig> {
        let mut speaker_ids = BTreeMap::new();
        for (name, value) in &self.spk_id {
            if let Some(id) = value.as_i64() {
                speaker_ids.insert(name.to_lowercase(), id as i32);
            }
        }
        if speaker_ids.is_empty() {
            return None;
        }
        let mut speaker_dialects = BTreeMap::new();
        for (name, value) in &self.spk_is_dialect {
            if let Some(dialect) = value.as_str() {
                speaker_dialects.insert(name.to_lowercase(), dialect.to_lowercase());
            }
        }
        let mut codec_language_ids = BTreeMap::new();
        for (name, value) in &self.codec_language_id {
            if let Some(id) = value.as_i64() {
                codec_language_ids.insert(name.to_lowercase(), id as i32);
            }
        }
        Some(SpeakerConfig {
            speaker_ids,
            speaker_dialects,
            codec_language_ids,
        })
    }
}

/// Speaker names of CustomVoice in `config.json` (the keys of `talker_config.spk_id`). Those in the official list
/// ([`super::prompt::CUSTOM_VOICE_SPEAKERS`]) use the list's spelling and come first, in list order (the keys in
/// the official weights are lowercase); names outside the list are kept as written and follow in alphabetical order. Keys with the same name differing only in case keep just one: the engine
/// builds its table in lowercase ([`SpeakerConfig::speaker_ids`]), so they are in fact the same speaker. Gives `None` when there is no speaker table (Base) or it cannot be parsed.
pub fn declared_speakers(json: &str) -> Option<Vec<String>> {
    let raw: RawConfig = serde_json::from_str(json).ok()?;
    let known = &super::prompt::CUSTOM_VOICE_SPEAKERS;
    let mut names: Vec<(usize, String)> = raw
        .talker_config?
        .spk_id
        .into_iter()
        .filter(|(_, id)| id.as_i64().is_some())
        .map(|(name, _)| match known.iter().position(|k| k.eq_ignore_ascii_case(&name)) {
            Some(rank) => (rank, known[rank].to_owned()),
            None => (usize::MAX, name),
        })
        .collect();
    names.sort_by_cached_key(|(rank, name)| (*rank, name.to_lowercase(), name.clone()));
    names.dedup_by(|a, b| a.1.to_lowercase() == b.1.to_lowercase());
    (!names.is_empty()).then(|| names.into_iter().map(|(_, name)| name).collect())
}

/// Same as above, but reads the `config.json` listed in the model package manifest; gives `None` if it is not listed or cannot be read.
pub fn declared_speakers_in(model: &crate::bundle::VerifiedFiles) -> Option<Vec<String>> {
    declared_speakers(&std::fs::read_to_string(model.path("config.json")?).ok()?)
}

#[derive(Deserialize)]
struct RawCodePredictor {
    hidden_size: Option<usize>,
    num_hidden_layers: Option<usize>,
    num_attention_heads: Option<usize>,
    num_key_value_heads: Option<usize>,
    head_dim: Option<usize>,
    intermediate_size: Option<usize>,
    rope_theta: Option<f64>,
    rms_norm_eps: Option<f64>,
    vocab_size: Option<usize>,
    num_code_groups: Option<usize>,
}

impl RawCodePredictor {
    fn apply(&self, config: &mut CodePredictorConfig) -> Result<()> {
        positive("code_predictor_config.hidden_size", self.hidden_size)?;
        positive("code_predictor_config.num_hidden_layers", self.num_hidden_layers)?;
        positive("code_predictor_config.num_attention_heads", self.num_attention_heads)?;
        positive("code_predictor_config.num_key_value_heads", self.num_key_value_heads)?;
        positive("code_predictor_config.head_dim", self.head_dim)?;
        positive("code_predictor_config.intermediate_size", self.intermediate_size)?;
        positive("code_predictor_config.vocab_size", self.vocab_size)?;
        positive("code_predictor_config.num_code_groups", self.num_code_groups)?;
        if let Some(v) = self.hidden_size {
            config.hidden_size = v;
        }
        if let Some(v) = self.num_hidden_layers {
            config.num_layers = v;
        }
        if let Some(v) = self.num_attention_heads {
            config.num_heads = v;
        }
        if let Some(v) = self.num_key_value_heads {
            config.num_kv_heads = v;
        }
        if let Some(v) = self.head_dim {
            config.head_dim = v;
        }
        if let Some(v) = self.intermediate_size {
            config.intermediate_size = v;
        }
        if let Some(v) = self.rope_theta {
            config.rope_theta = v as f32;
        }
        if let Some(v) = self.rms_norm_eps {
            config.rms_norm_eps = v as f32;
        }
        if let Some(v) = self.vocab_size {
            config.vocab_size = v;
        }
        if let Some(v) = self.num_code_groups {
            config.num_code_groups = v;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_base_8bit_config() {
        let json = r#"{
            "model_size": "0.6B",
            "quantization_config": {"bits": 8, "group_size": 64},
            "talker_config": {
                "hidden_size": 1024, "num_hidden_layers": 28, "num_attention_heads": 16,
                "num_key_value_heads": 8, "head_dim": 128, "intermediate_size": 3072,
                "rope_theta": 1000000.0, "rms_norm_eps": 1e-6, "text_hidden_size": 2048,
                "spk_id": {}
            }
        }"#;
        let config = Qwen3TtsConfig::parse(json).unwrap();
        assert_eq!(config.model_size, ModelSize::Small);
        assert_eq!(config.talker.bits, 8);
        assert_eq!(config.code_predictor.bits, 8);
        assert!(config.is_quantized());
        assert!(config.speaker.is_none());
        assert_eq!(config.talker, TalkerConfig::default());
    }

    #[test]
    fn declares_variant_from_tts_model_type() {
        // 1.7B CustomVoice (mlx-community 8bit export): the speaker table comes from the same source as 0.6B.
        let custom = Qwen3TtsConfig::parse(
            r#"{
            "tts_model_type": "custom_voice",
            "quantization_config": {"bits": 8, "group_size": 64},
            "talker_config": {"hidden_size": 2048, "intermediate_size": 6144,
                "spk_id": {"Vivian": 3065, "Dylan": 2878},
                "spk_is_dialect": {"dylan": "beijing_dialect"},
                "code_predictor_config": {"hidden_size": 1024}}
        }"#,
        )
        .unwrap();
        assert_eq!(custom.model_size, ModelSize::Large);
        assert_eq!(custom.variant, ModelVariant::CustomVoice);
        assert_eq!(custom.speaker.unwrap().speaker_ids["vivian"], 3065);
        assert!(custom.code_predictor.needs_projection());

        // 1.7B VoiceDesign: spk_id is an empty table; it takes only the voice description.
        let design = Qwen3TtsConfig::parse(
            r#"{
            "tts_model_type": "voice_design",
            "quantization_config": {"bits": 8, "group_size": 64},
            "talker_config": {"hidden_size": 2048, "intermediate_size": 6144,
                "spk_id": {}, "codec_language_id": {"chinese": 2055}}
        }"#,
        )
        .unwrap();
        assert_eq!(design.variant, ModelVariant::VoiceDesign);
        assert!(design.speaker.is_none());

        // Slimmed exports (aufklarer Base) lack this field and fall back to the speaker table.
        let base = Qwen3TtsConfig::parse(r#"{"model_size": "1.7B", "quantization_config": {"bits": 8, "group_size": 64}}"#).unwrap();
        assert_eq!(base.variant, ModelVariant::Base);

        assert!(Qwen3TtsConfig::parse(r#"{"model_size": "0.6B", "tts_model_type": "ictl"}"#).is_err());
    }

    /// Speakers on the official list use the list's spelling and come first, in list order (the keys in official weights are lowercase); names outside the list are kept as written and
    /// follow in alphabetical order; keys with the same name differing only in case keep just one; Base (empty `spk_id`), non-integer ids, and unparseable input do not count as a speaker table.
    #[test]
    fn declared_speakers_use_published_names_and_order() {
        let json = r#"{"talker_config": {"spk_id": {
            "zed": 3100, "Zed": 3100, "eric": 2875, "uncle_fu": 3010, "vivian": 3065,
            "Ada": 3200, "broken": "x"
        }}}"#;
        assert_eq!(declared_speakers(json).unwrap(), ["Vivian", "Uncle_Fu", "Eric", "Ada", "Zed"]);
        assert_eq!(declared_speakers(r#"{"talker_config": {"spk_id": {}}}"#), None);
        assert_eq!(declared_speakers(r#"{"model_size": "0.6B"}"#), None);
        assert_eq!(declared_speakers("not json"), None);
        let dir = tempfile::tempdir().unwrap();
        let not_listed = crate::bundle::ModelFiles {
            family: crate::bundle::FAMILY_QWEN3_TTS.into(),
            revision: "r".into(),
            dir: dir.path().to_string_lossy().into_owned(),
            files: Vec::new(),
        }
        .verify("tts")
        .unwrap();
        assert_eq!(declared_speakers_in(&not_listed), None);
    }

    #[test]
    fn parses_custom_voice_bf16_config() {
        let json = r#"{
            "model_size": "0.6B",
            "talker_config": {
                "hidden_size": 1024,
                "codec_language_id": {"chinese": 2055, "english": 2050},
                "spk_id": {"Vivian": 3065, "eric": 2875},
                "spk_is_dialect": {"vivian": false, "eric": "sichuan_dialect"},
                "text_vocab_size": 151936, "vocab_size": 3072,
                "code_predictor_config": {"hidden_size": 1024, "num_hidden_layers": 5, "vocab_size": 2048, "num_code_groups": 16}
            }
        }"#;
        let config = Qwen3TtsConfig::parse(json).unwrap();
        assert_eq!(config.talker.bits, 0);
        assert!(!config.is_quantized());
        let speaker = config.speaker.unwrap();
        assert_eq!(speaker.speaker_ids["vivian"], 3065);
        assert_eq!(speaker.speaker_dialects.get("eric").map(String::as_str), Some("sichuan_dialect"));
        assert!(!speaker.speaker_dialects.contains_key("vivian"));
        assert_eq!(speaker.available_speakers(), vec!["eric".to_string(), "vivian".to_string()]);
        assert_eq!(speaker.codec_language_ids["chinese"], 2055);
        assert!(!config.code_predictor.needs_projection());
    }

    #[test]
    fn large_by_hidden_size_needs_projection() {
        let json = r#"{"talker_config": {"hidden_size": 2048}}"#;
        let config = Qwen3TtsConfig::parse(json).unwrap();
        assert_eq!(config.model_size, ModelSize::Large);
        assert_eq!(config.talker.intermediate_size, 6144);
        assert!(config.code_predictor.needs_projection());
    }

    #[test]
    fn rejects_conflicts_and_bad_bits() {
        assert!(Qwen3TtsConfig::parse(r#"{"model_size": "0.6B", "talker_config": {"hidden_size": 2048}}"#).is_err());
        assert!(Qwen3TtsConfig::parse(r#"{"model_size": "0.6B", "quantization_config": {"bits": 3}}"#).is_err());
        assert!(Qwen3TtsConfig::parse(r#"{"quantization_config": {"bits": 8}}"#).is_err());
        assert!(Qwen3TtsConfig::parse(r#"{"model_size": "0.6B", "talker_config": {"num_hidden_layers": 0}}"#).is_err());
    }
}
