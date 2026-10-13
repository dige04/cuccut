//! Parts of this file's implementation are based on speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/ForcedAligner.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model packs and transcription interface; the original upstream attribution is retained.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Qwen3-ForcedAligner (0.6B, MLX quantized): known text + audio → word timings. Ported from v2 `ccut-speech`'s `aligner.rs`.
//!
//! One non-autoregressive forward pass: the audio tower encodes, two timestamp slots follow each word in the text, and a classification head gives times on those slots in 0.08 s steps, which are then made monotonic.
//! The segmented driver for long audio (> 240 s) is in [`crate::speech::align_common`].
//!
//! v3 changes only the boundary: files are taken from the model pack manifest ([`VerifiedFiles`]), and the quantization bit width is read from `quantize_config.json` instead of being inferred from the repo name.

use anyhow::{Context, Result};
use mlx_rs::Array;
use mlx_rs::ops::indexing::{IndexOp, argmax_axis};

use super::qwen3::{AudioEncoderConfig, Qwen3AudioEncoder, TextDecoder, TextDecoderConfig, WeightStore};
use super::runtime::{self, MemoryCacheGuard, ModelMemoryCacheGuard};
use crate::bundle::VerifiedFiles;
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
    classify_weight: Array,
    classify_bias: Option<Array>,
    tokenizer: Qwen3Tokenizer,
    feature_pipeline: WhisperFeaturePipeline,
    // Fields drop in declaration order: release weights before flushing their buffers.
    _memory_cache_guard: ModelMemoryCacheGuard,
}

impl ForcedAligner {
    /// Loads from the files of the `aligner` component: the top-level `*.safetensors` and `vocab.json` in the directory (required), plus `merges.txt`,
    /// `tokenizer_config.json` and `quantize_config.json` (read only if listed).
    pub fn load(files: &VerifiedFiles) -> Result<Self> {
        runtime::ensure_metal_device()?;
        let bits = aligner_quantization_bits(files.path("quantize_config.json"))?;
        let weights = files.require_extension_in("", "safetensors")?;
        let vocabulary = files.require("vocab.json")?;
        // Also flush partially loaded weights on an early error.
        let memory_cache_guard = ModelMemoryCacheGuard;
        let mut store = WeightStore::load(&weights)?;
        let audio_encoder = Qwen3AudioEncoder::load(&mut store, AudioEncoderConfig::FORCED_ALIGNER)?;
        let text_decoder = TextDecoder::load(&mut store, TextDecoderConfig::small(bits))?;
        let classify_weight = store.take("lm_head.weight")?;
        let classify_bias = store.take_optional("lm_head.bias");
        let tokenizer = Qwen3Tokenizer::load(vocabulary, files.path("merges.txt"), files.path("tokenizer_config.json"))
            .context("cannot load aligner tokenizer")?;
        let _unused_checkpoint_metadata = store.remaining();
        Ok(Self {
            audio_encoder,
            text_decoder,
            classify_weight,
            classify_bias,
            tokenizer,
            feature_pipeline: WhisperFeaturePipeline::new(128),
            _memory_cache_guard: memory_cache_guard,
        })
    }

    fn align_once(&mut self, audio: &[f32], text: &str, language: &str) -> Result<Vec<AlignedWord>> {
        // As with Qwen3 ASR, the aligner runs repeatedly over VAD segments. Release only the Metal temporary buffers that this round no longer uses;
        // the weights stay in `self`, which bounds peak memory without sacrificing load time for later segments.
        let _memory_cache_guard = MemoryCacheGuard::new();
        if audio.is_empty() || text.trim().is_empty() {
            return Ok(Vec::new());
        }
        let mel = self.feature_pipeline.extract(audio)?;
        let audio_embeddings = self.audio_encoder.encode(&mel)?.expand_dims(0)?;
        let slotted = prepare_for_alignment(text, &self.tokenizer, language);
        if slotted.words.is_empty() {
            return Ok(Vec::new());
        }
        let audio_tokens = audio_embeddings.dim(1) as usize;
        let input = alignment_input(&slotted, audio_tokens);
        let audio_begin = input.audio_range.start;
        let audio_end = input.audio_range.end;
        let ids = input.token_ids;

        let input_ids = Array::from_slice(&ids, &[1, ids.len() as i32]);
        let input_embeddings = self.text_decoder.embed(&input_ids)?;
        let typed_audio = audio_embeddings.as_dtype(input_embeddings.dtype())?;
        let before = input_embeddings.index((.., 0..audio_begin as i32, ..));
        let after = input_embeddings.index((.., audio_end as i32.., ..));
        let input_embeddings = mlx_rs::ops::concatenate_axis(&[before, typed_audio, after], 1)?;
        let (hidden, _) = self.text_decoder.decode(&input_embeddings, None, None)?;
        // Compute classification logits only at the timestamp positions: gather the hidden states at those positions first, then project,
        // avoiding a large matmul over the whole sequence × vocabulary, and avoiding a GPU sync per position.
        let positions = input
            .timestamp_positions
            .iter()
            .map(|position| *position as i32)
            .collect::<Vec<_>>();
        let position_index = Array::from_slice(&positions, &[positions.len() as i32]);
        let position_hidden = mlx_rs::ops::indexing::take_axis(hidden.index((0, .., ..)), &position_index, 0)?;
        let mut position_logits = mlx_rs::ops::matmul(&position_hidden, self.classify_weight.t())?;
        if let Some(bias) = &self.classify_bias {
            position_logits = &position_logits + bias;
        }
        let best = argmax_axis(&position_logits, -1, false)?.as_dtype(mlx_rs::Dtype::Uint32)?;
        best.eval()?;
        let raw = best.as_slice::<u32>().iter().map(|value| *value as usize).collect::<Vec<_>>();
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
        crate::speech::align_common::align_long_with(
            |audio, text, language| self.align_once(audio, text, language),
            audio,
            text,
            language,
        )
    }
}

pub use crate::speech::align_common::trailing_plateau_start;
