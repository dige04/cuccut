//! Parts of this file's implementation are based on speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/Qwen3ASR.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model packs and transcription interface; the original upstream attribution is retained.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Qwen3-ASR's full pipeline: mel → audio tower → text decoder (greedy decoding + async_eval speculation; the slow path carries a repetition penalty).

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use mlx_rs::ops::indexing::{IndexOp, argmax_axis};
use mlx_rs::{Array, Dtype, transforms};

use super::{AudioEncoderConfig, KvCache, Qwen3AudioEncoder, TextDecoder, TextDecoderConfig, WeightStore};
use crate::backend::mlx::runtime::{MemoryCacheGuard, ModelMemoryCacheGuard, ensure_metal_device};
use crate::speech::decoding::{AsrModelSize, Qwen3DecodingOptions, apply_deterministic_penalties, looks_degenerate};
use crate::speech::language::qwen_name;
use crate::speech::mel::WhisperFeaturePipeline;
use crate::speech::qwen3_asr::{
    ASR_TEXT, ASSISTANT, AUDIO_END, AUDIO_PAD, AUDIO_START, EOS_TOKEN, IM_START, NEWLINE, SYSTEM, USER, split_language_prefix,
};
pub use crate::speech::qwen3_asr::{Qwen3Config, TokenizerFiles};
use crate::speech::tokenizer::Qwen3Tokenizer;
use crate::speech::{Recognition, RecognitionRequest, SpeechRecognizer};

/// Audio tower and text decoder structure for each size tier.
fn configs_for(size: AsrModelSize, bits: i32) -> (AudioEncoderConfig, TextDecoderConfig) {
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
    // Fields are dropped in declaration order: release the weights first, then clear the cache.
    _memory_cache_guard: ModelMemoryCacheGuard,
}

impl Qwen3Asr {
    pub fn load(config: Qwen3Config, weights: &[&Path], tokenizer: TokenizerFiles<'_>) -> Result<Self> {
        ensure_metal_device()?;
        // If loading fails midway, also clear the weights that were already read in.
        let memory_cache_guard = ModelMemoryCacheGuard;
        let mut store = WeightStore::load(weights)?;
        let (audio_config, text_config) = configs_for(config.size, config.bits);
        let text_config = TextDecoderConfig {
            group_size: config.group_size,
            ..text_config
        };
        let audio_encoder = Qwen3AudioEncoder::load(&mut store, audio_config)?;
        let text_decoder = TextDecoder::load(&mut store, text_config)?;
        text_decoder.eval_quantized()?;
        let tokenizer =
            Qwen3Tokenizer::load(tokenizer.vocabulary, tokenizer.merges, tokenizer.config).context("loading the Qwen3 tokenizer")?;
        // Some repos carry non-inference tensors left over from the conversion script; all required tensors have already been checked key by key above.
        let _unused_checkpoint_metadata = store.remaining();
        Ok(Self {
            audio_encoder,
            text_decoder,
            tokenizer,
            feature_pipeline: WhisperFeaturePipeline::new(128),
            default_options: Qwen3DecodingOptions::default(),
            _memory_cache_guard: memory_cache_guard,
        })
    }

    /// Warm-up: one second of silence and at most a few tokens, so the Metal kernels are compiled before the first task.
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
        // VAD cuts a media file into many short segments of different shapes. The model weights are still kept by `self`,
        // but each segment's mel, KV cache and logits are temporary Metal buffers. Return them at the end of each segment
        // so the MLX cache does not compete with ASR/VAD/the forced aligner for unified memory at the same time.
        let _memory_cache_guard = MemoryCacheGuard::new();
        if audio.is_empty() {
            return Ok(Recognition::default());
        }
        let options = options.adapted_for(audio.len() as f64 / 16_000.0);
        let mel = self.feature_pipeline.extract(audio)?;
        let audio_embeddings = self.audio_encoder.encode(&mel)?.expand_dims(0)?;
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

    /// Returns the recognized text and the language name the model reports (when auto-detecting, the output looks like `language English<asr_text>…`).
    fn generate(&self, audio_embeddings: &Array, options: &Qwen3DecodingOptions) -> Result<(String, Option<String>)> {
        let audio_tokens = audio_embeddings.dim(1) as usize;
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

        let input_ids = Array::from_slice(&ids, &[1, ids.len() as i32]);
        let input_embeddings = self.text_decoder.embed(&input_ids)?;
        let audio_embeddings = audio_embeddings.as_dtype(input_embeddings.dtype())?;
        let before = input_embeddings.index((.., 0..audio_begin as i32, ..));
        let after = input_embeddings.index((.., audio_end as i32.., ..));
        let input_embeddings = mlx_rs::ops::concatenate_axis(&[before, audio_embeddings, after], 1)?;
        let (hidden, cache) = self.text_decoder.decode(&input_embeddings, None, None)?;
        let sequence = hidden.dim(1);
        let last_hidden = hidden.index((.., sequence - 1..sequence, ..));
        let logits = self.text_decoder.logits(&last_hidden)?;
        let tokens = if options.is_greedy_fast_path() {
            self.generate_greedy(logits, cache, options.max_tokens)?
        } else {
            self.generate_slow(logits, cache, options)?
        };
        let raw = self.tokenizer.decode(&tokens);
        Ok(split_language_prefix(&raw))
    }

    fn generate_greedy(&self, initial_logits: Array, mut cache: Vec<KvCache>, maximum_tokens: usize) -> Result<Vec<i32>> {
        if maximum_tokens == 0 {
            return Ok(Vec::new());
        }
        let mut output = Vec::with_capacity(maximum_tokens.min(128));
        let mut next = argmax_axis(&initial_logits, -1, false)?.squeeze()?.as_dtype(Dtype::Int32)?;
        async_eval_token(&next)?;
        for step in 0..maximum_tokens {
            let mut speculative = None;
            if step + 1 < maximum_tokens {
                let ids = next.expand_dims(0)?.expand_dims(0)?;
                let embedding = self.text_decoder.embed(&ids)?;
                let (hidden, next_cache) = self.text_decoder.decode(&embedding, None, Some(cache))?;
                let sequence = hidden.dim(1);
                let last = hidden.index((.., sequence - 1..sequence, ..));
                let logits = self.text_decoder.logits(&last)?;
                let next_token = argmax_axis(&logits, -1, false)?.squeeze()?.as_dtype(Dtype::Int32)?;
                async_eval_token(&next_token)?;
                speculative = Some((next_token, next_cache));
            }
            let token = next.try_item::<i32>()?;
            output.push(token);
            if token == EOS_TOKEN {
                break;
            }
            let Some((advanced, advanced_cache)) = speculative else {
                break;
            };
            next = advanced;
            cache = advanced_cache;
        }
        Ok(output)
    }

    fn generate_slow(&self, mut logits: Array, mut cache: Vec<KvCache>, options: &Qwen3DecodingOptions) -> Result<Vec<i32>> {
        let mut output = Vec::with_capacity(options.max_tokens.min(128));
        let mut random = XorShift64::new();
        for _ in 0..options.max_tokens {
            let token = pick_next_token(&logits, &output, options, &mut random)?;
            output.push(token);
            if token == EOS_TOKEN {
                break;
            }
            let ids = Array::from_slice(&[token], &[1, 1]);
            let embedding = self.text_decoder.embed(&ids)?;
            let (hidden, next_cache) = self.text_decoder.decode(&embedding, None, Some(cache))?;
            cache = next_cache;
            let sequence = hidden.dim(1);
            logits = self.text_decoder.logits(&hidden.index((.., sequence - 1..sequence, ..)))?;
        }
        Ok(output)
    }
}

impl SpeechRecognizer for Qwen3Asr {
    /// The hint goes into the system segment (`Qwen3DecodingOptions::context`); when a language is specified, it is forced with a `language X<asr_text>` prefix.
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

fn async_eval_token(token: &Array) -> Result<()> {
    transforms::async_eval(std::iter::once(token))?;
    Ok(())
}

fn pick_next_token(logits: &Array, generated: &[i32], options: &Qwen3DecodingOptions, random: &mut XorShift64) -> Result<i32> {
    if options.is_greedy_fast_path() {
        return Ok(argmax_axis(logits, -1, false)?.squeeze()?.try_item::<u32>()? as i32);
    }
    let flat = logits.squeeze()?.as_dtype(Dtype::Float32)?;
    flat.eval()?;
    let mut scores = flat.as_slice::<f32>().to_vec();
    apply_deterministic_penalties(&mut scores, generated, options);
    if options.temperature > 0.0 {
        for score in &mut scores {
            let uniform = random.next_f32().clamp(1e-6, 1.0 - f32::EPSILON);
            *score = *score / options.temperature - (-uniform.ln()).ln();
        }
    }
    scores
        .iter()
        .enumerate()
        .max_by(|left, right| left.1.total_cmp(right.1))
        .map(|(index, _)| index as i32)
        .context("empty Qwen3 logits")
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::speech::qwen3_asr::text_hidden_size;

    /// The shared size check (`Qwen3Config::parse`) matches the structure here.
    #[test]
    fn shared_widths_match_the_mlx_configs() {
        for size in [AsrModelSize::Small, AsrModelSize::Large] {
            let (audio, text) = configs_for(size, 4);
            assert_eq!(audio.d_model, AudioEncoderConfig::for_size(size).d_model);
            assert_eq!(text.hidden_size, text_hidden_size(size));
        }
    }
}
