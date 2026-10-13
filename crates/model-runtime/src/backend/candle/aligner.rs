//! Parts of this file are implemented with reference to speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/ForcedAligner.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model packs and transcription interface; the original upstream attribution is retained.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; scope of sources: see `THIRD_PARTY_NOTICES.md` in the root directory.
//!
//! Qwen3 forced aligner (candle), mirroring the mlx backend `aligner.rs`.
//! Non-autoregressive: a single forward pass, then argmax over the timestamp slots.
//!
//! v3 only changes the boundary (same as MLX): files are taken per the model pack manifest ([`VerifiedFiles`]), and the quantization bit width is read from `quantize_config.json`.

use anyhow::{Context, Result};
use candle_core::{D, Device, IndexOp, Tensor};

use super::audio_encoder::{AudioEncoderConfig, Qwen3AudioEncoder};
use super::qwen3::ids_tensor;
use super::text_decoder::{TextDecoder, TextDecoderConfig};
use super::weights::WeightStore;
use crate::bundle::VerifiedFiles;
use crate::speech::align_common::align_long_with;
use crate::speech::mel::WhisperFeaturePipeline;
use crate::speech::qwen3_asr::aligner_quantization_bits;
use crate::speech::text_prep::{alignment_input, prepare_for_alignment};
use crate::speech::timestamp::enforce_monotonicity;
use crate::speech::tokenizer::Qwen3Tokenizer;
use crate::speech::{AlignedWord, ForcedAlignment};

const TIMESTAMP_SECONDS: f32 = 0.08;

pub struct ForcedAligner {
    audio_encoder: Qwen3AudioEncoder,
    text_decoder: TextDecoder,
    classify_weight_t: Tensor,
    classify_bias: Option<Tensor>,
    tokenizer: Qwen3Tokenizer,
    feature_pipeline: WhisperFeaturePipeline,
    device: Device,
}

impl ForcedAligner {
    /// Loads from the files of the `aligner` component: top-level `*.safetensors` and `vocab.json` in the directory (required), plus `merges.txt`, `tokenizer_config.json`, and `quantize_config.json` (read only if listed).
    pub fn load(files: &VerifiedFiles, device: &Device) -> Result<Self> {
        Self::load_inner(files, device).map_err(super::annotate_out_of_memory)
    }

    fn load_inner(files: &VerifiedFiles, device: &Device) -> Result<Self> {
        let bits = aligner_quantization_bits(files.path("quantize_config.json"))? as usize;
        let weights = files.require_extension_in("", "safetensors")?;
        let vocabulary = files.require("vocab.json")?;
        let mut store = WeightStore::load(&weights, device)?;
        let audio_encoder = Qwen3AudioEncoder::load(&mut store, AudioEncoderConfig::FORCED_ALIGNER)?;
        let text_decoder = TextDecoder::load(&mut store, TextDecoderConfig::small(bits))?;
        let classify_weight = store.take_dequantized("lm_head", 64, bits)?;
        let classify_bias = store.take_optional_compute("lm_head.bias")?;
        let tokenizer = Qwen3Tokenizer::load(vocabulary, files.path("merges.txt"), files.path("tokenizer_config.json"))
            .context("loading the aligner tokenizer")?;
        let _unused_checkpoint_metadata = store.remaining();
        Ok(Self {
            audio_encoder,
            text_decoder,
            // Only one copy of [hidden, classes] is stored (the layout gemm can use directly).
            classify_weight_t: classify_weight.t()?.contiguous()?,
            classify_bias,
            tokenizer,
            feature_pipeline: WhisperFeaturePipeline::new(128),
            device: device.clone(),
        })
    }

    fn align_once(&mut self, audio: &[f32], text: &str, language: &str) -> Result<Vec<AlignedWord>> {
        if audio.is_empty() || text.trim().is_empty() {
            return Ok(Vec::new());
        }
        let mel = self.feature_pipeline.extract(audio)?;
        let audio_embeddings = self.audio_encoder.encode(&mel)?.unsqueeze(0)?;
        let slotted = prepare_for_alignment(text, &self.tokenizer, language);
        if slotted.words.is_empty() {
            return Ok(Vec::new());
        }
        let audio_tokens = audio_embeddings.dim(1)?;
        let input = alignment_input(&slotted, audio_tokens);
        let audio_begin = input.audio_range.start;
        let audio_end = input.audio_range.end;
        let ids = input.token_ids;

        let input_ids = ids_tensor(&ids, &self.device)?;
        let input_embeddings = self.text_decoder.embed(&input_ids)?;
        let before = input_embeddings.i((.., 0..audio_begin, ..))?;
        let after = input_embeddings.i((.., audio_end.., ..))?;
        let input_embeddings = Tensor::cat(&[&before, &audio_embeddings, &after], 1)?;
        let (hidden, _) = self.text_decoder.decode(&input_embeddings, None, None)?;
        // Classification logits are computed only at the timestamp positions: hidden states are gathered by position first and then projected, avoiding a large matmul of the whole sequence × vocabulary.
        let positions = input
            .timestamp_positions
            .iter()
            .map(|position| *position as u32)
            .collect::<Vec<_>>();
        let count = positions.len();
        let position_index = Tensor::from_vec(positions, (count,), &self.device)?;
        let position_hidden = hidden.i((0, .., ..))?.contiguous()?.index_select(&position_index, 0)?;
        let mut position_logits = position_hidden.matmul(&self.classify_weight_t)?;
        if let Some(bias) = &self.classify_bias {
            position_logits = position_logits.broadcast_add(bias)?;
        }
        let raw = position_logits
            .argmax(D::Minus1)?
            .to_vec1::<u32>()?
            .iter()
            .map(|value| *value as usize)
            .collect::<Vec<_>>();
        let corrected = enforce_monotonicity(&raw);
        if std::env::var_os("ALIGN_DEBUG").as_deref() == Some(std::ffi::OsStr::new("1")) {
            eprintln!("[align-debug] indices={} audio_tokens={audio_tokens}", raw.len());
            eprintln!("[align-debug] first raw={:?}", &raw[..raw.len().min(10)]);
            eprintln!("[align-debug] first corrected={:?}", &corrected[..corrected.len().min(10)]);
        }
        Ok(slotted
            .words
            .into_iter()
            .zip(corrected.chunks_exact(2))
            .map(|(text, pair)| {
                let start = pair[0] as f32 * TIMESTAMP_SECONDS;
                let end = (pair[1] as f32 * TIMESTAMP_SECONDS).max(start);
                AlignedWord { text, start, end }
            })
            .collect())
    }
}

impl ForcedAlignment for ForcedAligner {
    fn align(&mut self, audio: &[f32], text: &str, language: Option<&str>) -> Result<Vec<AlignedWord>> {
        self.align_once(audio, text, language.unwrap_or("English"))
    }

    fn align_long(&mut self, audio: &[f32], text: &str, language: Option<&str>) -> Result<Vec<AlignedWord>> {
        let language = language.unwrap_or("English");
        align_long_with(
            |audio, text, language| self.align_once(audio, text, language),
            audio,
            text,
            language,
        )
    }
}
