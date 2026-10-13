//! Parts rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream files: `Sources/Qwen3TTS/Qwen3TTS.swift / Sources/Qwen3TTS/Qwen3TTS+ICL.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model package interface.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; scope of the sources is in the root `THIRD_PARTY_NOTICES.md`.
//!
//! `Qwen3Tts`: chains the Talker / Code Predictor / codec decoder / voice cloning into
//! [`TtsEngine`]: preset speakers / voice description / x-vector cloning use the ordinary prefill; cloning with reference text uses the ICL prefill.

use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::synthesize::tensor::ops;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype};
use anyhow::{Context, Result, bail};

use crate::bundle::VerifiedFiles;
use crate::speech::tokenizer::Qwen3Tokenizer;
use crate::synthesize::tensor::host::{ModelMemoryCacheGuard, configure_memory_cache, ensure_device};

use crate::synthesize::types::{TtsAudio, TtsEngineKind, TtsProgress, TtsRequest, VoiceSpec};
use crate::synthesize::{ProgressSink, TtsEngine};

use super::code_predictor::CodePredictor;
use super::codec_decoder::CodecDecoder;
use super::codec_encoder::CodecEncoder;
use super::config::{ModelVariant, Qwen3TtsConfig};
use super::layers::token_array;
use super::mel;
use super::prompt::{self, IclTrailing};
use super::sampling::{Rng, SamplingConfig, sample_token};
use super::speaker_encoder::SpeakerEncoder;
use super::talker::Talker;
use super::tokens::{
    CODEC_BOS, CODEC_EOS, NUM_CODEBOOKS, SAMPLE_RATE, SUPPRESS_END, SUPPRESS_START, TTS_BOS, TTS_EOS, TTS_PAD, language_id,
    normalize_language,
};
use super::weights::Weights;
use crate::synthesize::resample::resample;
use crate::synthesize::stitch::Stitcher;

/// Intermediate sample rate for decoding reference audio: first decoded to 48 kHz, then downsampled to 24 kHz with [`resample`] (same path as v2).
const REFERENCE_DECODE_RATE: u32 = 48_000;

/// A loaded Qwen3-TTS 12 Hz model (Base / CustomVoice / VoiceDesign).
pub struct Qwen3Tts {
    config: Qwen3TtsConfig,
    tokenizer: Qwen3Tokenizer,
    talker: Talker,
    code_predictor: CodePredictor,
    codec_decoder: CodecDecoder,
    /// Present only in the Base model (x-vector for cloning).
    speaker_encoder: Option<SpeakerEncoder>,
    /// Loaded only for ICL cloning (Base + reference text).
    codec_encoder: Option<CodecEncoder>,
    /// Weight file of the speech tokenizer (codec component); for ICL cloning, the encoder part is read again on demand.
    codec_files: Vec<PathBuf>,
    /// The last field: weights are dropped first, then it waits for the GPU and clears the cache.
    _cache_guard: ModelMemoryCacheGuard,
}

/// Prefill output for one generation.
struct Prefill {
    embeds: Array,
    trailing: Array,
    tts_pad: Array,
}

/// Result of one generation.
struct Generated {
    /// `[1, 16, frames]` Int32; empty when `frames == 0`.
    codes: Option<Array>,
    frames: usize,
}

impl Qwen3Tts {
    /// Loads per manifest. `model` is the main model component (`config.json` + `*.safetensors` + `vocab.json`;
    /// `merges.txt` / `tokenizer_config.json` are used if listed); `codec` is the speech tokenizer component
    /// (`*.safetensors` of `Qwen/Qwen3-TTS-Tokenizer-12Hz`). A missing file is `MODEL_NOT_INSTALLED`, reported before touching Metal.
    pub fn load(model: &VerifiedFiles, codec: &VerifiedFiles) -> Result<Self> {
        let config_path = model.require("config.json")?;
        let vocabulary = model.require("vocab.json")?;
        let model_weights = model.require_extension_in("", "safetensors")?;
        let codec_files: Vec<PathBuf> = codec
            .require_extension_in("", "safetensors")?
            .into_iter()
            .map(Path::to_path_buf)
            .collect();

        ensure_device()?;
        configure_memory_cache()?;
        // Create the guard first: if any later loading step fails, the guard on unwind also waits for the GPU and clears any cache already allocated.
        let cache_guard = ModelMemoryCacheGuard;

        let config_text = std::fs::read_to_string(config_path).with_context(|| format!("failed to read {}", config_path.display()))?;
        let config = Qwen3TtsConfig::parse(&config_text)?;
        let tokenizer = Qwen3Tokenizer::load(vocabulary, model.path("merges.txt"), model.path("tokenizer_config.json"))?;

        let mut weights = Weights::load(&model_weights, !config.is_quantized())?;
        let mut cp_weights = weights.split_prefix("talker.code_predictor.");
        let mut talker_weights = weights.split_prefix("talker.");
        let code_predictor = CodePredictor::load(&mut cp_weights, &config.code_predictor)?;
        let talker = Talker::load(&mut talker_weights, &config.talker)?;
        let speaker_encoder = if weights.contains("speaker_encoder.blocks.0.conv.weight") {
            let mut spk_weights = weights.split_prefix("speaker_encoder.");
            Some(SpeakerEncoder::load(&mut spk_weights)?)
        } else {
            None
        };

        let mut codec_weights = Weights::load(&path_refs(&codec_files), false)?;
        let mut decoder_weights = codec_weights.split_prefix("decoder.");
        let codec_decoder = CodecDecoder::load(&mut decoder_weights)?;

        Ok(Self {
            config,
            tokenizer,
            talker,
            code_predictor,
            codec_decoder,
            speaker_encoder,
            codec_encoder: None,
            codec_files,
            _cache_guard: cache_guard,
        })
    }

    /// Model configuration (including the speaker table).
    pub fn config(&self) -> &Qwen3TtsConfig {
        &self.config
    }

    /// Whether cloning is supported (the Base variant carries a speaker_encoder).
    pub fn supports_cloning(&self) -> bool {
        self.speaker_encoder.is_some()
    }

    fn ensure_codec_encoder(&mut self) -> Result<&CodecEncoder> {
        if self.codec_encoder.is_none() {
            let mut codec_weights = Weights::load(&path_refs(&self.codec_files), false)?;
            let mut encoder_weights = codec_weights.split_prefix("encoder.");
            self.codec_encoder = Some(CodecEncoder::load(&mut encoder_weights)?);
        }
        Ok(self.codec_encoder.as_ref().expect("just loaded"))
    }

    // ---- Embedding helpers ----

    fn hidden(&self) -> i32 {
        self.talker.hidden_size as i32
    }

    fn embed_text_tokens(&self, tokens: &[i32]) -> Result<Array> {
        self.talker.embed_text(&token_array(tokens))
    }

    fn embed_codec_tokens(&self, tokens: &[i32]) -> Array {
        self.talker.embed_codec(&token_array(tokens))
    }

    /// tts_pad repeated to `[1, n, D]`.
    fn pad_block(&self, tts_pad: &Array, count: usize) -> Result<Array> {
        Ok(ops::broadcast_to(tts_pad, &[1, count as i32, self.hidden()])?)
    }

    /// Inserts the speaker vector `[1, 1024]` at position `insert_at` of the codec prefix embedding.
    fn inject_speaker(&self, codec_embeds: &Array, speaker: &Array, insert_at: usize) -> Result<Array> {
        let spk = speaker.reshape(&[1, 1, self.hidden()])?.as_dtype(codec_embeds.dtype())?;
        let at = insert_at as i32;
        let part0 = codec_embeds.index((.., ..at, ..));
        let part1 = codec_embeds.index((.., at.., ..));
        Ok(ops::concatenate_axis(&[&part0, &spk, &part1], 1)?)
    }

    /// Prefill for the ordinary / x-vector path.
    fn build_prefill(
        &self,
        text_tokens: &[i32],
        codec_prefix: &[i32],
        instruct_tokens: Option<&[i32]>,
        speaker_embedding: Option<&Array>,
    ) -> Result<Prefill> {
        let text_embeds = self.embed_text_tokens(text_tokens)?;
        let mut codec_embeds = self.embed_codec_tokens(codec_prefix);
        if let Some(spk) = speaker_embedding {
            codec_embeds = self.inject_speaker(&codec_embeds, spk, 4)?;
        }
        let tts_pad = self.embed_text_tokens(&[TTS_PAD])?;
        let tts_bos = self.embed_text_tokens(&[TTS_BOS])?;
        let tts_eos = self.embed_text_tokens(&[TTS_EOS])?;

        let codec_len = codec_embeds.dim(1);
        let pad_count = (codec_len - 2) as usize;
        let text_overlay = ops::concatenate_axis(&[&self.pad_block(&tts_pad, pad_count)?, &tts_bos], 1)?;
        let combined = text_overlay.add(&codec_embeds.index((.., ..codec_len - 1, ..)))?;
        let role_embed = text_embeds.index((.., ..3, ..));
        let first_text_plus_codec = text_embeds
            .index((.., 3..4, ..))
            .add(&codec_embeds.index((.., codec_len - 1.., ..)))?;

        let embeds = match instruct_tokens {
            Some(instruct) => {
                let instruct_embeds = self.embed_text_tokens(instruct)?;
                ops::concatenate_axis(&[&instruct_embeds, &role_embed, &combined, &first_text_plus_codec], 1)?
            }
            None => ops::concatenate_axis(&[&role_embed, &combined, &first_text_plus_codec], 1)?,
        };

        let trailing = match prompt::trailing_text_range(text_tokens.len()) {
            Some(range) => {
                let slice = text_embeds.index((.., range.start as i32..range.end as i32, ..));
                ops::concatenate_axis(&[&slice, &tts_eos], 1)?
            }
            None => tts_eos,
        };
        crate::synthesize::tensor::transforms::eval([&embeds, &trailing, &tts_pad])?;
        Ok(Prefill { embeds, trailing, tts_pad })
    }

    /// Prefill for the ICL path.
    fn build_icl_prefill(
        &self,
        ref_codes: &Array,
        reference_text: &str,
        target_text: &str,
        language: Option<i32>,
        speaker_embedding: &Array,
    ) -> Result<Prefill> {
        let hidden = self.hidden();
        let mut combined_ids = self.tokenizer.encode(reference_text);
        combined_ids.extend(self.tokenizer.encode(target_text));

        let tts_pad = self.embed_text_tokens(&[TTS_PAD])?;
        let tts_bos = self.embed_text_tokens(&[TTS_BOS])?;
        let tts_eos = self.embed_text_tokens(&[TTS_EOS])?;

        let text_embed = self.embed_text_tokens(&combined_ids)?;
        let text_with_eos = ops::concatenate_axis(&[&text_embed, &tts_eos], 1)?;
        let text_len = text_with_eos.dim(1) as usize;

        // codec_bos + Σ each codebook's embedding(ref_codes)
        let mut ref_codec_embed = self.talker.embed_codec(&ref_codes.index((.., 0, ..)));
        for group in 0..self.code_predictor.num_groups() {
            let ids = ref_codes.index((.., (group + 1) as i32, ..));
            ref_codec_embed = ref_codec_embed.add(&self.code_predictor.embed_group(&ids, group))?;
        }
        let codec_bos = self.embed_codec_tokens(&[CODEC_BOS]);
        let codec_icl = ops::concatenate_axis(&[&codec_bos, &ref_codec_embed], 1)?;
        let codec_len = codec_icl.dim(1) as usize;

        let (icl_input, trailing) = match prompt::icl_alignment(text_len, codec_len) {
            IclTrailing::TextFrom(from) => (
                text_with_eos.index((.., ..from as i32, ..)).add(&codec_icl)?,
                text_with_eos.index((.., from as i32.., ..)),
            ),
            IclTrailing::Padded { pad_count } => {
                let padded = if pad_count > 0 {
                    ops::concatenate_axis(&[&text_with_eos, &self.pad_block(&tts_pad, pad_count)?], 1)?
                } else {
                    text_with_eos
                };
                (padded.add(&codec_icl)?, tts_pad.clone())
            }
        };

        let (prefix_tokens, insert_at) = prompt::icl_codec_prefix(language);
        let codec_prefix = self.embed_codec_tokens(&prefix_tokens);
        let codec_prefix = self.inject_speaker(&codec_prefix, speaker_embedding, insert_at)?;
        let prefix_len = codec_prefix.dim(1);
        let pad_count = (prefix_len - 2) as usize;
        let combined_prefix = ops::concatenate_axis(&[&self.pad_block(&tts_pad, pad_count)?, &tts_bos], 1)?.add(&codec_prefix.index((
            ..,
            ..prefix_len - 1,
            ..,
        )))?;

        let role_embed = self.embed_text_tokens(&prompt::role_tokens())?;
        let embeds = ops::concatenate_axis(&[&role_embed, &combined_prefix, &icl_input], 1)?;
        debug_assert_eq!(embeds.dim(2), hidden);
        crate::synthesize::tensor::transforms::eval([&embeds, &trailing, &tts_pad])?;
        Ok(Prefill { embeds, trailing, tts_pad })
    }

    /// Autoregressive generation.
    fn generate(
        &self,
        prefill: &Prefill,
        sampling: &SamplingConfig,
        rng: &mut Rng,
        chunk_index: usize,
        progress: &mut ProgressSink<'_>,
    ) -> Result<Generated> {
        let safe_max_tokens = sampling.max_tokens.min(prompt::SAFE_MAX_TOKENS);
        // Code Predictor only inherits temperature and top-k.
        let cp_sampling = SamplingConfig {
            temperature: sampling.temperature,
            top_k: sampling.top_k,
            ..SamplingConfig::default()
        };
        let num_groups = self.code_predictor.num_groups();
        let mut first_codebook: Vec<i32> = Vec::new();
        let mut all_codebooks: Vec<Vec<i32>> = vec![Vec::new(); num_groups + 1];

        let prefill_len = prefill.embeds.dim(1);
        let (logits, hidden, mut cache) = self.talker.forward(&prefill.embeds, 0, None, None)?;
        let last_logits = logits.index((.., prefill_len - 1..prefill_len, ..));
        let mut next = self.sample_first_codebook(&last_logits, sampling, &first_codebook, rng)?;
        if next == CODEC_EOS {
            return Ok(Generated { codes: None, frames: 0 });
        }
        first_codebook.push(next);
        all_codebooks[0].push(next);
        let last_hidden = hidden.index((.., prefill_len - 1..prefill_len, ..));
        let mut code_tokens = self.predict_frame(&last_hidden, next, &cp_sampling, rng)?;
        for (group, &token) in code_tokens.iter().enumerate() {
            all_codebooks[group + 1].push(token);
        }

        let trailing_len = prefill.trailing.dim(1);
        let mut trailing_idx = 0i32;
        let mut step = prefill_len;
        let mut hit_eos = false;
        for _ in 1..safe_max_tokens {
            if !progress(TtsProgress::Tokens {
                index: chunk_index,
                generated: first_codebook.len(),
            }) {
                bail!("synthesis cancelled");
            }
            let text_embed = if trailing_idx < trailing_len {
                let embed = prefill.trailing.index((.., trailing_idx..trailing_idx + 1, ..));
                trailing_idx += 1;
                embed
            } else {
                prefill.tts_pad.clone()
            };
            let codec_embed = self
                .embed_codec_tokens(&[next])
                .add(&self.code_predictor.batch_embed_all_groups(&code_tokens)?)?;
            let step_embeds = text_embed.add(&codec_embed)?;

            let (logits, hidden, new_cache) = self.talker.forward(&step_embeds, step, None, Some(&cache))?;
            cache = new_cache;
            next = self.sample_first_codebook(&logits, sampling, &first_codebook, rng)?;
            if next == CODEC_EOS {
                hit_eos = true;
                break;
            }
            first_codebook.push(next);
            all_codebooks[0].push(next);
            code_tokens = self.predict_frame(&hidden, next, &cp_sampling, rng)?;
            for (group, &token) in code_tokens.iter().enumerate() {
                all_codebooks[group + 1].push(token);
            }
            step += 1;
        }
        drop(cache);

        let frames = first_codebook.len();
        if frames >= safe_max_tokens && !hit_eos {
            eprintln!(
                "[qwen3-tts] reached the safety limit of {safe_max_tokens} tokens (about {:.1}s); output may be truncated",
                frames as f64 / 12.5
            );
        }
        let codes = stack_codebooks(&all_codebooks, frames);
        Ok(Generated {
            codes: Some(codes),
            frames,
        })
    }

    fn sample_first_codebook(&self, logits: &Array, sampling: &SamplingConfig, generated: &[i32], rng: &mut Rng) -> Result<i32> {
        let flat = logits.as_dtype(Dtype::Float32)?;
        flat.eval()?;
        let mut scores = flat.as_slice::<f32>().to_vec();
        Ok(sample_token(
            &mut scores,
            sampling,
            generated,
            Some((SUPPRESS_START, SUPPRESS_END)),
            CODEC_EOS,
            rng,
        ))
    }

    fn predict_frame(&self, hidden: &Array, first_token: i32, cp_sampling: &SamplingConfig, rng: &mut Rng) -> Result<Vec<i32>> {
        let code0 = self.embed_codec_tokens(&[first_token]);
        self.code_predictor.predict_frame(hidden, &code0, cp_sampling, rng)
    }

    // ---- Reference audio ----

    /// Decodes reference audio to 24 kHz mono.
    fn load_reference_audio(path: &Path) -> Result<Vec<f32>> {
        let samples = crate::audio::decode_mono(path, REFERENCE_DECODE_RATE).with_context(|| format!("failed to decode reference audio {}", path.display()))?;
        if samples.is_empty() {
            bail!("reference audio {} has no usable samples", path.display());
        }
        Ok(resample(&samples, REFERENCE_DECODE_RATE, SAMPLE_RATE))
    }

    /// Reference audio → x-vector `[1, 1024]`.
    fn speaker_embedding(&self, audio_24k: &[f32]) -> Result<Array> {
        let Some(encoder) = &self.speaker_encoder else {
            bail!("the current model has no speaker_encoder; cannot clone a voice (needs the Qwen3-TTS Base variant)");
        };
        let mel = mel::compute(audio_24k);
        if mel.frames == 0 {
            bail!("reference audio is too short to extract speaker features");
        }
        let mels = Array::from_slice(&mel.data, &[1, mel.frames as i32, mel::N_MELS as i32]);
        let embed = encoder.forward(&mels)?;
        embed.eval()?;
        Ok(embed)
    }

    /// Decodes codes into a 24 kHz waveform.
    fn decode(&self, codes: &Array) -> Result<Vec<f32>> {
        self.codec_decoder.decode_to_samples(codes)
    }

    // ---- Single-chunk synthesis ----

    fn synthesize_chunk(
        &mut self,
        text: &str,
        plan: &VoicePlan,
        sampling: &SamplingConfig,
        rng: &mut Rng,
        chunk_index: usize,
        progress: &mut ProgressSink<'_>,
    ) -> Result<Vec<f32>> {
        let started = Instant::now();
        let samples = match plan {
            VoicePlan::Prompt {
                speaker_token,
                language,
                instruct,
                speaker_embedding,
            } => {
                let text_ids = self.tokenizer.encode(text);
                let text_tokens = prompt::text_tokens(&text_ids);
                let codec_prefix = prompt::codec_prefix(*language, *speaker_token);
                let instruct_tokens = instruct.as_deref().map(|s| prompt::instruct_tokens(&self.tokenizer.encode(s)));
                let prefill = self.build_prefill(&text_tokens, &codec_prefix, instruct_tokens.as_deref(), speaker_embedding.as_ref())?;
                let mut capped = sampling.clone();
                capped.max_tokens = prompt::max_token_cap(text_ids.len(), sampling.max_tokens);
                let generated = self.generate(&prefill, &capped, rng, chunk_index, progress)?;
                match generated.codes {
                    Some(codes) if generated.frames > 0 => self.decode(&codes)?,
                    _ => Vec::new(),
                }
            }
            VoicePlan::Icl {
                ref_codes,
                reference_text,
                language,
                speaker_embedding,
            } => {
                let prefill = self.build_icl_prefill(ref_codes, reference_text, text, *language, speaker_embedding)?;
                let mut icl_sampling = sampling.clone();
                if icl_sampling.temperature > 0.0 && icl_sampling.repetition_penalty < 1.5 {
                    icl_sampling.repetition_penalty = 1.5;
                }
                let target_count = self.tokenizer.encode(text).len();
                icl_sampling.max_tokens = prompt::icl_max_token_cap(target_count, sampling.max_tokens);
                let generated = self.generate(&prefill, &icl_sampling, rng, chunk_index, progress)?;
                match generated.codes {
                    Some(codes) if generated.frames > 0 => {
                        let ref_frames = ref_codes.dim(2) as usize;
                        let for_decode = ops::concatenate_axis(&[ref_codes, &codes], 2)?;
                        let total_frames = ref_frames + generated.frames;
                        let full = self.decode(&for_decode)?;
                        let cut = prompt::icl_reference_cut(ref_frames, total_frames, full.len());
                        full[cut..].to_vec()
                    }
                    _ => Vec::new(),
                }
            }
        };
        let elapsed = started.elapsed().as_secs_f64();
        let audio_seconds = samples.len() as f64 / SAMPLE_RATE as f64;
        eprintln!(
            "[qwen3-tts] chunk {chunk_index}: {} characters → {:.2}s of audio, took {elapsed:.2}s (RTF {:.2})",
            text.chars().count(),
            audio_seconds,
            if audio_seconds > 0.0 { elapsed / audio_seconds } else { 0.0 }
        );
        Ok(samples)
    }

    /// Resolves the requested voice into a generation plan (reference audio is processed only once per request).
    fn plan_voice(&mut self, request: &TtsRequest, progress: &mut ProgressSink<'_>) -> Result<VoicePlan> {
        let (language_name, language_explicit) = match request.language.as_deref() {
            Some(tag) if !tag.trim().is_empty() && tag.trim() != "auto" => (normalize_language(tag), true),
            _ => (normalize_language(crate::synthesize::text::guess_language(&request.text)), false),
        };

        // VoiceDesign only produces speech from one description sentence: `--instruct` is that sentence; when it is not given, a built-in voice acts on it as that sentence's **description** (`voices::style_for`); when a built-in voice is named and `--instruct` is given, both sentences are used.
        if self.config.variant == ModelVariant::VoiceDesign {
            let described = match &request.voice {
                VoiceSpec::Clone { .. } => bail!("Qwen3-TTS VoiceDesign does not accept reference audio; the voice is set only by a description (--instruct)"),
                VoiceSpec::Default if request.instruct.as_deref().is_some_and(|text| !text.trim().is_empty()) => request.clone(),
                _ => {
                    let style = crate::synthesize::voices::style_for(request, "Qwen3-TTS VoiceDesign")?;
                    let mut described = request.clone();
                    described.instruct = style.instruct;
                    described
                }
            };
            return self.plan_prompt(None, &described, &language_name, language_explicit);
        }

        // Base has no speaker table: `Preset` / `Default` both fall back to the built-in voice bundled with the package, and use its recording to compute the x-vector (`crate::voices`, same table and same ids as IndexTTS / GPT-SoVITS).
        // CustomVoice has its own 9 speakers; the bundled recordings are of no use to it.
        let voice = if self.config.speaker.is_none() && self.speaker_encoder.is_some() {
            match &request.voice {
                VoiceSpec::Clone { .. } => None,
                _ => Some(crate::synthesize::voices::builtin_for(request, "Qwen3-TTS Base")?.expect("not Clone")),
            }
        } else {
            None
        };
        if let Some(voice) = voice {
            if !progress(TtsProgress::Loading {
                stage: format!("built-in voice {}", voice.id),
            }) {
                bail!("synthesis cancelled");
            }
            // Bundled recordings are decoded in memory and resampled to 24 kHz, not written to disk.
            let audio = crate::synthesize::voices::builtin(voice).audio.samples(SAMPLE_RATE)?;
            let speaker_embedding = self.speaker_embedding(&audio)?;
            return Ok(VoicePlan::Prompt {
                speaker_token: None,
                language: language_id(&language_name).unwrap_or_else(|| {
                    eprintln!("[qwen3-tts] unknown language {language_name:?}, falling back to English");
                    super::tokens::LANGUAGE_ENGLISH
                }),
                instruct: None,
                speaker_embedding: Some(speaker_embedding),
            });
        }

        match &request.voice {
            VoiceSpec::Clone {
                reference_audio,
                reference_text,
            } => {
                if self.speaker_encoder.is_none() {
                    bail!(
                        "the current model ({}) does not support voice cloning; use the Qwen3-TTS Base variant, or switch to a preset speaker or voice description",
                        self.config.variant.label()
                    );
                }
                if !progress(TtsProgress::Loading {
                    stage: "decode reference audio".into(),
                }) {
                    bail!("synthesis cancelled");
                }
                let audio = Self::load_reference_audio(reference_audio)?;
                let speaker_embedding = self.speaker_embedding(&audio)?;
                let language = language_id(&language_name);
                match reference_text.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                    Some(reference_text) => {
                        if !progress(TtsProgress::Loading {
                            stage: "encode reference audio".into(),
                        }) {
                            bail!("synthesis cancelled");
                        }
                        let ref_codes = self.ensure_codec_encoder()?.encode(&audio)?;
                        // ICL includes a language token only when the caller explicitly specifies a language (otherwise it is "auto").
                        let language = if language_explicit { language } else { None };
                        Ok(VoicePlan::Icl {
                            ref_codes,
                            reference_text: reference_text.to_string(),
                            language,
                            speaker_embedding,
                        })
                    }
                    None => Ok(VoicePlan::Prompt {
                        speaker_token: None,
                        language: language.unwrap_or_else(|| {
                            eprintln!("[qwen3-tts] unknown language {language_name:?}, falling back to English");
                            super::tokens::LANGUAGE_ENGLISH
                        }),
                        instruct: None,
                        speaker_embedding: Some(speaker_embedding),
                    }),
                }
            }
            VoiceSpec::Preset { speaker } => self.plan_prompt(Some(speaker), request, &language_name, language_explicit),
            VoiceSpec::Default => {
                // CustomVoice: picks the default speaker for the language (Ono_Anna for Japanese, Sohee for Korean…),
                // rather than always taking the first one in the alphabetically sorted speaker table.
                let pick = prompt::default_speaker(&language_name, self.config.speaker.as_ref());
                self.plan_prompt(pick.as_deref(), request, &language_name, language_explicit)
            }
        }
    }

    fn plan_prompt(&self, speaker: Option<&str>, request: &TtsRequest, language_name: &str, language_explicit: bool) -> Result<VoicePlan> {
        let resolved = prompt::resolve_speaker(speaker, self.config.speaker.as_ref(), language_name, language_explicit);
        if let Some(warning) = &resolved.warning {
            if speaker.is_some() && self.config.speaker.is_some() {
                bail!("{warning}");
            }
            eprintln!("[qwen3-tts] {warning}");
        }
        let language = match language_id(&resolved.language) {
            Some(id) => id,
            None => {
                eprintln!("[qwen3-tts] unknown language {:?}, falling back to English", resolved.language);
                super::tokens::LANGUAGE_ENGLISH
            }
        };
        // CustomVoice fills in a default instruction when no instruct is given.
        let instruct = match request.instruct.as_deref().map(str::trim) {
            Some(s) if !s.is_empty() => Some(s.to_string()),
            _ => self.config.speaker.as_ref().map(|_| prompt::DEFAULT_INSTRUCT.to_string()),
        };
        Ok(VoicePlan::Prompt {
            speaker_token: resolved.token,
            language,
            instruct,
            speaker_embedding: None,
        })
    }
}

/// The generation mode resolved for one request.
enum VoicePlan {
    /// Preset speaker / default / x-vector cloning: codec prefix + optional speaker vector.
    Prompt {
        speaker_token: Option<i32>,
        language: i32,
        instruct: Option<String>,
        speaker_embedding: Option<Array>,
    },
    /// ICL cloning: reference codec + reference text enter the context.
    Icl {
        ref_codes: Array,
        reference_text: String,
        language: Option<i32>,
        speaker_embedding: Array,
    },
}

impl TtsEngine for Qwen3Tts {
    fn kind(&self) -> TtsEngineKind {
        TtsEngineKind::Qwen3Tts
    }

    fn sample_rate(&self) -> u32 {
        SAMPLE_RATE
    }

    fn preset_speakers(&self) -> Vec<String> {
        // CustomVoice reports its model's own 9; Base has no speaker table, so it reports the built-in voices bundled with the package.
        self.config
            .speaker
            .as_ref()
            .map(SpeakerConfigExt::display_names)
            .unwrap_or_else(crate::synthesize::voices::ids)
    }

    fn synthesize(&mut self, request: &TtsRequest, mut progress: ProgressSink<'_>) -> Result<TtsAudio> {
        let text = request.text.trim();
        if text.is_empty() {
            bail!("text to synthesize is empty");
        }
        let chunks = crate::synthesize::text::chunk_with_breaks(text, crate::synthesize::text::DEFAULT_MAX_UNITS);
        if chunks.is_empty() {
            bail!("text to synthesize is empty after chunking");
        }
        let sampling = SamplingConfig::from_options(&request.sampling);
        let mut rng = Rng::from_optional_seed(request.sampling.seed);
        let plan = self.plan_voice(request, &mut progress)?;

        // Pauses and loudness between chunks are set uniformly by stitching (`synthesize::stitch`), not by silence the model adds at the chunk edges.
        let count = chunks.len();
        let mut stitcher = Stitcher::new(SAMPLE_RATE, count);
        for (index, chunk) in chunks.iter().enumerate() {
            if !progress(TtsProgress::ChunkStarted { index, count }) {
                bail!("synthesis cancelled");
            }
            let chunk_samples = self.synthesize_chunk(&chunk.text, &plan, &sampling, &mut rng, index, &mut progress)?;
            stitcher.push(&chunk_samples, chunk.after);
            let seconds = stitcher.seconds();
            if !progress(TtsProgress::ChunkFinished { index, seconds }) {
                bail!("synthesis cancelled");
            }
        }
        Ok(TtsAudio {
            samples: stitcher.finish(),
            sample_rate: SAMPLE_RATE,
            readings_dropped: Vec::new(),
        })
    }
}

/// Speaker display name: the config has lowercase keys, so here the first letter is capitalized (`vivian` → `Vivian`).
trait SpeakerConfigExt {
    fn display_names(&self) -> Vec<String>;
}

impl SpeakerConfigExt for super::config::SpeakerConfig {
    fn display_names(&self) -> Vec<String> {
        self.available_speakers()
            .into_iter()
            .map(|name| {
                let mut chars = name.chars();
                match chars.next() {
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    None => name,
                }
            })
            .collect()
    }
}

/// `Vec<PathBuf>` → `&[&Path]`, as required by `Weights::load`.
fn path_refs(paths: &[PathBuf]) -> Vec<&Path> {
    paths.iter().map(PathBuf::as_path).collect()
}

/// `[[codebook0...], [codebook1...], ...]` → `[1, 16, frames]` Int32。
fn stack_codebooks(all: &[Vec<i32>], frames: usize) -> Array {
    let mut flat = Vec::with_capacity(NUM_CODEBOOKS * frames);
    for codebook in all {
        flat.extend_from_slice(&codebook[..frames]);
    }
    Array::from_slice(&flat, &[1, all.len() as i32, frames as i32])
}
