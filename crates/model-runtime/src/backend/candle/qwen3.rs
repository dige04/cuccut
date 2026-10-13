//! Parts of this file's implementation draw on speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/Qwen3ASR.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model pack and transcription interface; the original upstream source attribution is retained.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the source, see the root `THIRD_PARTY_NOTICES.md`.
//!
//! Qwen3-ASR (candle), mirroring the mlx backend `qwen3/model.rs`.
//!
//! candle runs synchronously, and greedy decoding does not need mlx's async_eval double buffering. The prompt template, the `config.json` check and the language prefix are shared with MLX via [`crate::speech::qwen3_asr`], and the repetition penalty and degeneration detection are shared via [`crate::speech::decoding`].

use std::collections::HashSet;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use candle_core::{D, DType, Device, IndexOp, Tensor};

use super::audio_encoder::{AudioEncoderConfig, Qwen3AudioEncoder};
use super::text_decoder::{KvCache, TextDecoder, TextDecoderConfig};
use super::weights::WeightStore;
use crate::speech::decoding::{AsrModelSize, Qwen3DecodingOptions, apply_deterministic_penalties, forbidden_next_tokens, looks_degenerate};
use crate::speech::language::qwen_name;
use crate::speech::mel::WhisperFeaturePipeline;
use crate::speech::qwen3_asr::{
    ASR_TEXT, ASSISTANT, AUDIO_END, AUDIO_PAD, AUDIO_START, EOS_TOKEN, IM_START, NEWLINE, Qwen3Config, SYSTEM, TokenizerFiles, USER,
    split_language_prefix,
};
use crate::speech::tokenizer::Qwen3Tokenizer;
use crate::speech::{Recognition, RecognitionRequest, SpeechRecognizer};

/// Audio tower and text decoder structure for each size tier.
fn configs_for(size: AsrModelSize, bits: usize) -> (AudioEncoderConfig, TextDecoderConfig) {
    match size {
        AsrModelSize::Small => (AudioEncoderConfig::SMALL, TextDecoderConfig::small(bits)),
        AsrModelSize::Large => (AudioEncoderConfig::LARGE, TextDecoderConfig::large(bits)),
    }
}

pub struct Qwen3Asr {
    audio_encoder: Qwen3AudioEncoder,
    text_decoder: TextDecoder,
    tokenizer: Qwen3Tokenizer,
    feature_pipeline: WhisperFeaturePipeline,
    default_options: Qwen3DecodingOptions,
    device: Device,
}

impl Qwen3Asr {
    pub fn load(config: Qwen3Config, weights: &[&Path], tokenizer: TokenizerFiles<'_>, device: &Device) -> Result<Self> {
        Self::load_inner(config, weights, tokenizer, device).map_err(super::annotate_out_of_memory)
    }

    fn load_inner(config: Qwen3Config, weights: &[&Path], tokenizer: TokenizerFiles<'_>, device: &Device) -> Result<Self> {
        let mut store = WeightStore::load(weights, device)?;
        // Floating-point weights (`bits` 16) have no `scales` and skip dequantization; the bit width is only used when `scales` is present.
        let (audio_config, text_config) = configs_for(config.size, config.bits as usize);
        let text_config = TextDecoderConfig {
            group_size: config.group_size as usize,
            ..text_config
        };
        let audio_encoder = Qwen3AudioEncoder::load(&mut store, audio_config)?;
        let text_decoder = TextDecoder::load(&mut store, text_config)?;
        let tokenizer =
            Qwen3Tokenizer::load(tokenizer.vocabulary, tokenizer.merges, tokenizer.config).context("loading the Qwen3 tokenizer")?;
        // Some repos include non-inference tensors kept by the conversion script; all required tensors have already been checked key by key above.
        let _unused_checkpoint_metadata = store.remaining();
        Ok(Self {
            audio_encoder,
            text_decoder,
            tokenizer,
            feature_pipeline: WhisperFeaturePipeline::new(128),
            default_options: Qwen3DecodingOptions::default(),
            device: device.clone(),
        })
    }

    /// Warm-up: one second of silence and at most a few tokens (on CUDA it gets the kernels ready before the first job; on CPU it spreads out the first allocations).
    pub fn warmup(&mut self) -> Result<()> {
        let options = Qwen3DecodingOptions {
            max_tokens: 4,
            ..self.default_options.clone()
        };
        self.transcribe_with_options(&vec![0.0; 16_000], &options)?;
        Ok(())
    }

    pub fn set_default_options(&mut self, options: Qwen3DecodingOptions) {
        self.default_options = options;
    }

    pub fn transcribe_with_options(&mut self, audio: &[f32], options: &Qwen3DecodingOptions) -> Result<Recognition> {
        self.transcribe_with_options_inner(audio, options)
            .map_err(super::annotate_out_of_memory)
    }

    fn transcribe_with_options_inner(&mut self, audio: &[f32], options: &Qwen3DecodingOptions) -> Result<Recognition> {
        if audio.is_empty() {
            return Ok(Recognition::default());
        }
        let options = options.adapted_for(audio.len() as f64 / 16_000.0);
        let mel = self.feature_pipeline.extract(audio)?;
        let audio_embeddings = self.audio_encoder.encode(&mel)?.unsqueeze(0)?;
        let (mut text, mut language_name) = self.generate(&audio_embeddings, &options)?;
        let mut degenerate = false;
        if looks_degenerate(&text) {
            let mut guarded = options.clone();
            guarded.repetition_penalty = guarded.repetition_penalty.max(1.15);
            (text, language_name) = self.generate(&audio_embeddings, &guarded)?;
            degenerate = looks_degenerate(&text);
        }
        Ok(Recognition {
            text,
            language_name,
            degenerate,
        })
    }

    /// Returns the recognized text and the language name the model reports itself (on auto-detection the output looks like `language English<asr_text>…`).
    fn generate(&self, audio_embeddings: &Tensor, options: &Qwen3DecodingOptions) -> Result<(String, Option<String>)> {
        let audio_tokens = audio_embeddings.dim(1)?;
        let mut ids = vec![IM_START, SYSTEM, NEWLINE];
        if let Some(context) = options.context.as_deref().filter(|text| !text.is_empty()) {
            ids.extend(self.tokenizer.encode(context));
        }
        ids.extend([EOS_TOKEN, NEWLINE, IM_START, USER, NEWLINE, AUDIO_START]);
        let audio_begin = ids.len();
        ids.extend(std::iter::repeat_n(AUDIO_PAD, audio_tokens));
        let audio_end = ids.len();
        ids.extend([AUDIO_END, EOS_TOKEN, NEWLINE, IM_START, ASSISTANT, NEWLINE]);
        if let Some(language) = options.language.as_deref() {
            let name = qwen_name(language).ok_or_else(|| anyhow::anyhow!("Qwen3-ASR does not support language {language}"))?;
            ids.extend(self.tokenizer.encode(&format!("language {name}")));
            ids.push(ASR_TEXT);
        }

        let input_ids = ids_tensor(&ids, &self.device)?;
        let input_embeddings = self.text_decoder.embed(&input_ids)?;
        let before = input_embeddings.i((.., 0..audio_begin, ..))?;
        let after = input_embeddings.i((.., audio_end.., ..))?;
        let input_embeddings = Tensor::cat(&[&before, audio_embeddings, &after], 1)?;
        let (hidden, cache) = self.text_decoder.decode(&input_embeddings, None, None)?;
        let sequence = hidden.dim(1)?;
        let last_hidden = hidden.i((.., sequence - 1..sequence, ..))?;
        let logits = self.text_decoder.logits(&last_hidden)?;
        let tokens = if options.is_greedy_fast_path() {
            self.generate_greedy(logits, cache, options.max_tokens)?
        } else {
            self.generate_slow(logits, cache, options)?
        };
        let raw = self.tokenizer.decode(&tokens);
        Ok(split_language_prefix(&raw))
    }

    fn generate_greedy(&self, initial_logits: Tensor, mut cache: Vec<KvCache>, maximum_tokens: usize) -> Result<Vec<i32>> {
        let mut output = Vec::with_capacity(maximum_tokens.min(128));
        let mut logits = initial_logits;
        for _ in 0..maximum_tokens {
            let token = argmax_token(&logits)?;
            output.push(token);
            if token == EOS_TOKEN {
                break;
            }
            let ids = ids_tensor(&[token], &self.device)?;
            let embedding = self.text_decoder.embed(&ids)?;
            let (hidden, next_cache) = self.text_decoder.decode(&embedding, None, Some(cache))?;
            cache = next_cache;
            let sequence = hidden.dim(1)?;
            logits = self.text_decoder.logits(&hidden.i((.., sequence - 1..sequence, ..))?)?;
        }
        Ok(output)
    }

    fn generate_slow(&self, mut logits: Tensor, mut cache: Vec<KvCache>, options: &Qwen3DecodingOptions) -> Result<Vec<i32>> {
        let mut output = Vec::with_capacity(options.max_tokens.min(128));
        let mut random = XorShift64::new();
        for _ in 0..options.max_tokens {
            let token = pick_next_token(&logits, &output, options, &mut random)?;
            output.push(token);
            if token == EOS_TOKEN {
                break;
            }
            let ids = ids_tensor(&[token], &self.device)?;
            let embedding = self.text_decoder.embed(&ids)?;
            let (hidden, next_cache) = self.text_decoder.decode(&embedding, None, Some(cache))?;
            cache = next_cache;
            let sequence = hidden.dim(1)?;
            logits = self.text_decoder.logits(&hidden.i((.., sequence - 1..sequence, ..))?)?;
        }
        Ok(output)
    }
}

impl SpeechRecognizer for Qwen3Asr {
    /// The hint goes into the system segment (`Qwen3DecodingOptions::context`); when a language is specified, it is forced with the `language X<asr_text>` prefix.
    fn recognize(&mut self, audio: &[f32], request: &RecognitionRequest<'_>) -> Result<Recognition> {
        let mut options = self.default_options.clone();
        options.context = request
            .context
            .map(str::trim)
            .filter(|context| !context.is_empty())
            .map(str::to_owned);
        options.language = request.language.map(str::to_owned);
        self.transcribe_with_options(audio, &options)
    }
}

/// Token sequence → u32 [1, n] (candle's index_select needs u32 indices).
pub(crate) fn ids_tensor(ids: &[i32], device: &Device) -> Result<Tensor> {
    let ids = ids.iter().map(|id| *id as u32).collect::<Vec<_>>();
    let length = ids.len();
    Ok(Tensor::from_vec(ids, (1, length), device)?)
}

pub(crate) fn argmax_token(logits: &Tensor) -> Result<i32> {
    Ok(logits.argmax(D::Minus1)?.flatten_all()?.to_vec1::<u32>()?[0] as i32)
}

fn pick_next_token(logits: &Tensor, generated: &[i32], options: &Qwen3DecodingOptions, random: &mut XorShift64) -> Result<i32> {
    if options.is_greedy_fast_path() {
        return argmax_token(logits);
    }
    if options.temperature <= 0.0 {
        // The penalty only rewrites the few tokens that are “already generated” or “banned by n-gram”, and rewrites them in place on the device before argmax, so the whole vocabulary is not copied back to the host at every step.
        return argmax_with_penalties_on_device(logits, generated, options);
    }
    let mut scores = logits.to_dtype(DType::F32)?.flatten_all()?.to_vec1::<f32>()?;
    apply_deterministic_penalties(&mut scores, generated, options);
    for score in &mut scores {
        let uniform = random.next_f32().clamp(1e-6, 1.0 - f32::EPSILON);
        *score = *score / options.temperature - (-uniform.ln()).ln();
    }
    scores
        .iter()
        .enumerate()
        .max_by(|left, right| left.1.total_cmp(right.1))
        .map(|(index, _)| index as i32)
        .context("empty Qwen3 logits")
}

fn argmax_with_penalties_on_device(logits: &Tensor, generated: &[i32], options: &Qwen3DecodingOptions) -> Result<i32> {
    let flat = logits.flatten_all()?;
    let vocabulary = flat.dim(0)?;
    let forbidden = forbidden_next_tokens(generated, options.no_repeat_ngram_size)
        .into_iter()
        .collect::<HashSet<_>>();
    let penalized = if options.repetition_penalty > 1.0 {
        generated.iter().copied().collect::<HashSet<_>>()
    } else {
        HashSet::new()
    };
    let mut affected = penalized
        .union(&forbidden)
        .copied()
        .filter_map(|token| u32::try_from(token).ok())
        .filter(|token| (*token as usize) < vocabulary)
        .collect::<Vec<_>>();
    if affected.is_empty() {
        return argmax_token(logits);
    }
    affected.sort_unstable();
    let count = affected.len();
    let index = Tensor::from_vec(affected.clone(), (count,), logits.device())?;
    let current = flat.index_select(&index, 0)?.to_dtype(DType::F32)?.to_vec1::<f32>()?;
    let mut delta = Vec::with_capacity(count);
    for (position, token) in affected.iter().copied().enumerate() {
        let original = current[position];
        let mut value = original;
        if penalized.contains(&(token as i32)) {
            value = if value > 0.0 {
                value / options.repetition_penalty
            } else {
                value * options.repetition_penalty
            };
        }
        if forbidden.contains(&(token as i32)) {
            value = f32::NEG_INFINITY;
        }
        delta.push(value - original);
    }
    let delta = Tensor::from_vec(delta, (count,), logits.device())?.to_dtype(flat.dtype())?;
    let updated = flat.index_add(&index, &delta, 0)?;
    argmax_token(&updated)
}

struct XorShift64(u64);

impl XorShift64 {
    fn new() -> Self {
        let seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos() as u64)
            .unwrap_or(0x9e3779b97f4a7c15);
        Self(seed | 1)
    }

    fn next_f32(&mut self) -> f32 {
        let mut value = self.0;
        value ^= value << 13;
        value ^= value >> 7;
        value ^= value << 17;
        self.0 = value;
        (value as f64 / u64::MAX as f64) as f32
    }
}
