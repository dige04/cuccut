//! MOSS-Transcribe-Diarize's MLX engine, ported unchanged from v2 `ccut-speech`.
//!
//! The model itself produces `[start][Sxx]text[end]` timestamps and speaker labels, so no external VAD is used. Cross-chunk speaker merging (WeSpeaker)
//! and word-timing refinement for long lines (forced aligner) are done in the orchestration of `job.run` ([`crate::transcribe`]), using the model pack's optional components.
//! Files are always taken from the manifest of the `asr` component (`config.json`, `processor_config.json`, `vocab.json`, `merges.txt`,
//! `tokenizer_config.json`, `*.safetensors`), not by scanning the directory.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use mlx_rs::module::{Module, Param};
use mlx_rs::nn::{Conv1d, silu};
use mlx_rs::ops::indexing::{IndexOp, argmax_axis};
use mlx_rs::{Array, Dtype, fast, ops, transforms};

use std::time::Instant;

use super::qwen3::{Dense, KvCache, LayerNorm, TextDecoder, TextDecoderConfig, WeightStore, gelu_same_dtype};
use super::runtime::{self, MemoryCacheGuard, clear_memory_cache, memory_snapshot};
use crate::backend::speech_timing_enabled;
use crate::bundle::VerifiedFiles;
use crate::speech::mel::WhisperFeaturePipeline;
use crate::speech::moss_common::{
    ASSISTANT, AUDIO_END, AUDIO_START, ChunkGeneration, GenerationStopReason, HOP_LENGTH, IM_END, IM_START, MossConfig,
    MossProcessorConfig, NEWLINE, PAD_EOS, PREFILL_STEP, SAMPLE_RATE, STREAM_FLUSH_INTERVAL, SYSTEM, StreamState, USER,
    WHISPER_ENCODER_STRIDE, WHISPER_WINDOW_SAMPLES, moss_instruction, repetitive_token_tail, split_audio_at_low_energy, transcribe_chunks,
};
pub use crate::speech::moss_common::{MossCallbacks, MossCancelled, MossTranscription};
use crate::speech::moss_parse::{MossGenerationPlan, MossStreamDecoder, moss_quantization_bits};
use crate::speech::tokenizer::Qwen3Tokenizer;
use crate::speech::{SegmentedTranscription, SegmentingCallbacks, SegmentingRecognizer};

/// The quantization preference is fixed to v2's `speed`: decoder at 8 bit (`CCUT_MOSS_QUANT` can still change it to 4 or 8, for diagnostics).
pub const QUANTIZATION_PREFERENCE: &str = "speed";

const GENERATION_CACHE_CLEAR_INTERVAL: usize = 256;

pub struct MossTranscribeDiarize {
    config: MossConfig,
    /// After the audio front end is released, reloading the weight shards is needed when a failed chunk is re-split.
    weights: Vec<PathBuf>,
    // A one-shot CLI can release these two BF16 blocks, about 615 MB, after generating the audio embeddings;
    // a resident worker keeps them to reuse the model.
    whisper_encoder: Option<WhisperEncoder>,
    adaptor: Option<VqAdaptor>,
    decoder: TextDecoder,
    tokenizer: Qwen3Tokenizer,
    mel: WhisperFeaturePipeline,
    audio_tokens_per_second: f32,
    time_marker_every_seconds: usize,
    enable_time_marker: bool,
    digit_token_ids: HashMap<char, i32>,
    // Fields drop in declaration order: release weights before flushing their buffers.
    _memory_cache_guard: runtime::ModelMemoryCacheGuard,
}

struct PreparedChunk {
    prompt_ids: Vec<i32>,
    input_embeddings: Array,
    inputs_seconds: f64,
}

impl MossTranscribeDiarize {
    /// Loads from the files of the `asr` component; the quantization preference is fixed to [`QUANTIZATION_PREFERENCE`]. A missing file is `MODEL_NOT_INSTALLED`
    /// (the error can be `downcast_ref`'d to [`crate::protocol::ErrorBody`]).
    pub fn load(files: &VerifiedFiles) -> Result<Self> {
        Self::load_with_preference(files, QUANTIZATION_PREFERENCE)
    }

    pub fn load_with_preference(files: &VerifiedFiles, preference: &str) -> Result<Self> {
        // Check that all files are present per the manifest first; if any is missing, don't touch Metal or the weights.
        let config_path = files.require("config.json")?;
        let vocabulary = files.require("vocab.json")?;
        let weights = files
            .require_extension_in("", "safetensors")?
            .into_iter()
            .map(Path::to_path_buf)
            .collect::<Vec<_>>();
        runtime::ensure_metal_device()?;
        // Also flush partially loaded weights on an early error.
        let memory_cache_guard = runtime::ModelMemoryCacheGuard;
        let load_started = Instant::now();
        let config = MossConfig::load(config_path)?;
        let environment = std::env::vars().collect::<HashMap<_, _>>();
        let quantization_bits = moss_quantization_bits(&environment, preference).unwrap_or(0) as i32;
        let mut store = WeightStore::load(&weight_refs(&weights))?;
        let whisper_encoder = WhisperEncoder::load(&mut store, &config)?;
        let adaptor = VqAdaptor::load(&mut store, &config)?;
        let decoder = TextDecoder::load_with_prefix(
            &mut store,
            TextDecoderConfig {
                hidden_size: config.hidden_size,
                layers: config.text_layers,
                heads: config.text_heads,
                kv_heads: config.text_kv_heads,
                head_dim: config.head_dim,
                intermediate_size: config.intermediate_size,
                group_size: 64,
                bits: quantization_bits,
                rope_theta: config.rope_theta,
                rms_eps: config.rms_eps,
                qk_norm: true,
            },
            "model.language_model",
        )?;
        if quantization_bits > 0 {
            decoder.eval_quantized().context("materialize MOSS quantized decoder weights")?;
            clear_memory_cache()?;
        }
        let tokenizer = Qwen3Tokenizer::load(vocabulary, files.path("merges.txt"), files.path("tokenizer_config.json"))
            .context("load MOSS tokenizer")?;
        let processor = MossProcessorConfig::load(files.path("processor_config.json"))?;
        let (audio_tokens_per_second, time_marker_every_seconds, enable_time_marker) = (
            processor.audio_tokens_per_second,
            processor.time_marker_every_seconds,
            processor.enable_time_marker,
        );
        let digit_token_ids = "0123456789"
            .chars()
            .map(|digit| {
                let encoded = tokenizer.encode(&digit.to_string());
                if encoded.len() != 1 {
                    bail!("MOSS digit {digit} is not a single token: {encoded:?}");
                }
                Ok((digit, encoded[0]))
            })
            .collect::<Result<HashMap<_, _>>>()?;
        // lm_head (tied embedding mode) and the index metadata do not take part in inference.
        let _unused_checkpoint_metadata = store.remaining();
        if speech_timing_enabled() {
            let (active, cache, peak) = memory_snapshot();
            eprintln!(
                "[ccut-timing] moss-load seconds={:.2} bits={} mlx_active={:.2}GB mlx_cache={:.2}GB mlx_peak={:.2}GB",
                load_started.elapsed().as_secs_f64(),
                quantization_bits,
                active as f64 / 1e9,
                cache as f64 / 1e9,
                peak as f64 / 1e9,
            );
        }
        Ok(Self {
            config,
            weights,
            whisper_encoder: Some(whisper_encoder),
            adaptor: Some(adaptor),
            decoder,
            tokenizer,
            mel: WhisperFeaturePipeline::moss(80),
            audio_tokens_per_second,
            time_marker_every_seconds,
            enable_time_marker,
            digit_token_ids,
            _memory_cache_guard: memory_cache_guard,
        })
    }

    pub fn transcribe_diarized(&mut self, audio: &[f32], language: Option<&str>) -> Result<MossTranscription> {
        self.transcribe_diarized_with(audio, language, &mut MossCallbacks::none())
    }

    pub fn transcribe_diarized_with(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut MossCallbacks<'_>,
    ) -> Result<MossTranscription> {
        self.transcribe_diarized_with_release(audio, language, false, callbacks)
    }

    /// A one-shot transcription can release the audio front end after generating the input embeddings for all chunks, before entering the
    /// longer text-generation stage. The pre-materialized inputs are value-for-value identical to the original path. A resident worker passes `false`
    /// and keeps the front end to serve the next task.
    pub fn transcribe_diarized_with_release(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        release_audio_frontend: bool,
        callbacks: &mut MossCallbacks<'_>,
    ) -> Result<MossTranscription> {
        let _memory_cache_guard = MemoryCacheGuard::new();
        let instruction = moss_instruction(language);
        if audio.is_empty() {
            return Ok(MossTranscription::default());
        }
        let total_duration = audio.len() as f64 / SAMPLE_RATE as f64;
        // Experimental knob: shorter chunks trade for a shorter attention context; by default it matches the fixed CHUNK_DURATION exactly.
        let chunk_seconds = MossGenerationPlan::chunk_duration_from_env(std::env::var("CCUT_MOSS_CHUNK_SECONDS").ok().as_deref());
        let plan = MossGenerationPlan::make_with_chunk_duration(total_duration, chunk_seconds);
        let chunks = split_audio_at_low_energy(audio, plan.chunk_duration, 5.0, 0.1);
        let mut prepared_chunks: Vec<Option<PreparedChunk>> = Vec::new();
        if release_audio_frontend {
            prepared_chunks.reserve(chunks.len());
            for chunk in &chunks {
                if callbacks.cancelled() {
                    return Err(anyhow::Error::from(MossCancelled));
                }
                prepared_chunks.push(Some(self.prepare_chunk(chunk.samples, &instruction)?));
                clear_memory_cache()?;
            }
            self.whisper_encoder = None;
            self.adaptor = None;
            clear_memory_cache()?;
        }
        transcribe_chunks(audio, &chunks, chunk_seconds, callbacks, |request, stream| {
            let prepared = request
                .planned
                .and_then(|index| prepared_chunks.get_mut(index))
                .and_then(Option::take);
            if prepared.is_none() {
                // Sub-chunks produced by re-splitting have no pre-materialized inputs. In a one-shot transcription the audio front end has already been released at this point,
                // so it is loaded back on demand (this costs a few extra seconds only on this rare re-split-after-failure path).
                self.ensure_audio_frontend()?;
            }
            let output = self.generate_chunk(request.samples, &instruction, prepared, request.max_tokens, stream);
            clear_memory_cache()?;
            output
        })
    }

    /// Reloads the audio front end after `release_audio_frontend` has released it.
    fn ensure_audio_frontend(&mut self) -> Result<()> {
        if self.whisper_encoder.is_some() && self.adaptor.is_some() {
            return Ok(());
        }
        let mut store = WeightStore::load(&weight_refs(&self.weights))?;
        self.whisper_encoder = Some(WhisperEncoder::load(&mut store, &self.config)?);
        self.adaptor = Some(VqAdaptor::load(&mut store, &self.config)?);
        Ok(())
    }

    fn generate_chunk(
        &mut self,
        audio: &[f32],
        instruction: &str,
        prepared: Option<PreparedChunk>,
        maximum_tokens: usize,
        stream: &mut StreamState<'_, '_>,
    ) -> Result<ChunkGeneration> {
        let _memory_cache_guard = MemoryCacheGuard::new();
        let PreparedChunk {
            prompt_ids,
            input_embeddings,
            inputs_seconds,
        } = match prepared {
            Some(prepared) => prepared,
            None => self.prepare_chunk(audio, instruction)?,
        };
        let total_tokens = prompt_ids.len();
        if total_tokens == 0 {
            bail!("MOSS prompt is empty");
        }
        let prefill_started = Instant::now();
        let mut cache: Option<Vec<KvCache>> = None;
        let mut processed = 0;
        while total_tokens - processed > 1 {
            let count = PREFILL_STEP.min(total_tokens - processed - 1);
            let updated = {
                let embeddings = input_embeddings.index((.., processed as i32..(processed + count) as i32, ..));
                let (hidden, updated) = self.decoder.decode(&embeddings, None, cache.take())?;
                hidden.eval()?;
                updated
            };
            cache = Some(updated);
            processed += count;
            clear_memory_cache()?;
        }
        let last = input_embeddings.index((.., processed as i32..total_tokens as i32, ..));
        let (hidden, updated) = self.decoder.decode(&last, None, cache.take())?;
        cache = Some(updated);
        let sequence = hidden.dim(1);
        let mut logits = self.decoder.logits(&hidden.index((.., sequence - 1..sequence, ..)))?;
        let mut next = argmax_axis(&logits, -1, false)?.squeeze()?.as_dtype(Dtype::Int32)?;
        evaluate_token(&next)?;
        let prefill_seconds = prefill_started.elapsed().as_secs_f64();

        let generation_started = Instant::now();
        let detail = std::env::var("CCUT_SPEECH_TIMING").is_ok_and(|value| value == "2");
        let (mut item_seconds, mut build_seconds, mut dispatch_seconds) = (0.0_f64, 0.0, 0.0);
        let mut generated = Vec::with_capacity(maximum_tokens.min(4_096));
        // Incremental parsing serves live preview and loop detection; the final text is still decoded from the complete token sequence.
        let mut decoder = MossStreamDecoder::default();
        let mut streamed = 0_usize;
        let mut stop_reason = GenerationStopReason::TokenLimit;
        for index in 0..maximum_tokens {
            if index > 0 && index.is_multiple_of(GENERATION_CACHE_CLEAR_INTERVAL) {
                clear_memory_cache()?;
            }
            if generated.len() - streamed >= STREAM_FLUSH_INTERVAL {
                let segments = decoder.push(&self.tokenizer.decode_bytes(&generated[streamed..]));
                streamed = generated.len();
                let repeating = stream.observe(&segments);
                if stream.callbacks.cancelled() {
                    return Err(anyhow::Error::from(MossCancelled));
                }
                if repeating {
                    stop_reason = GenerationStopReason::Repetition;
                    break;
                }
            }
            let phase_started = Instant::now();
            let token = next.try_item::<i32>()?;
            item_seconds += phase_started.elapsed().as_secs_f64();
            if matches!(token, PAD_EOS | IM_END) {
                stop_reason = GenerationStopReason::Eos;
                break;
            }
            generated.push(token);
            if repetitive_token_tail(&generated) {
                stop_reason = GenerationStopReason::Repetition;
                break;
            }
            if index + 1 == maximum_tokens {
                break;
            }
            let phase_started = Instant::now();
            let ids = Array::from_slice(&[token], &[1, 1]);
            let embeddings = self.decoder.embed(&ids)?;
            let (hidden, updated) = self.decoder.decode(&embeddings, None, cache.take())?;
            cache = Some(updated);
            let sequence = hidden.dim(1);
            logits = self.decoder.logits(&hidden.index((.., sequence - 1..sequence, ..)))?;
            next = argmax_axis(&logits, -1, false)?.squeeze()?.as_dtype(Dtype::Int32)?;
            build_seconds += phase_started.elapsed().as_secs_f64();
            let phase_started = Instant::now();
            evaluate_token(&next)?;
            dispatch_seconds += phase_started.elapsed().as_secs_f64();
        }
        if streamed < generated.len() {
            let segments = decoder.push(&self.tokenizer.decode_bytes(&generated[streamed..]));
            if stream.observe(&segments) {
                stop_reason = GenerationStopReason::Repetition;
            }
        }
        let segments = decoder.finish();
        if stream.observe(&segments) {
            stop_reason = GenerationStopReason::Repetition;
        }
        if detail {
            eprintln!(
                "[ccut-timing] moss-generate-detail item={item_seconds:.2}s build={build_seconds:.2}s dispatch={dispatch_seconds:.2}s tokens={}",
                generated.len()
            );
        }
        if speech_timing_enabled() {
            let generation_seconds = generation_started.elapsed().as_secs_f64();
            let (active, cache_bytes, peak) = memory_snapshot();
            eprintln!(
                "[ccut-timing] moss-chunk inputs={inputs_seconds:.2}s prefill={prefill_seconds:.2}s ({total_tokens} tok, {:.1} tok/s) generate={generation_seconds:.2}s ({} tok, {:.1} tok/s) mlx_active={:.2}GB mlx_cache={:.2}GB mlx_peak={:.2}GB",
                total_tokens as f64 / prefill_seconds.max(1e-9),
                generated.len(),
                generated.len() as f64 / generation_seconds.max(1e-9),
                active as f64 / 1e9,
                cache_bytes as f64 / 1e9,
                peak as f64 / 1e9,
            );
        }
        Ok(ChunkGeneration {
            text: self.tokenizer.decode(&generated).trim().to_owned(),
            token_count: generated.len(),
            stop_reason,
        })
    }

    fn prepare_chunk(&mut self, audio: &[f32], instruction: &str) -> Result<PreparedChunk> {
        let started = Instant::now();
        let (prompt_ids, input_embeddings) = self.prepare_generation_inputs(audio, instruction)?;
        Ok(PreparedChunk {
            prompt_ids,
            input_embeddings,
            inputs_seconds: started.elapsed().as_secs_f64(),
        })
    }

    fn prepare_generation_inputs(&mut self, audio: &[f32], instruction: &str) -> Result<(Vec<i32>, Array)> {
        let timing = speech_timing_enabled();
        let chunks = audio.chunks(WHISPER_WINDOW_SAMPLES).collect::<Vec<_>>();
        // The token length depends only on the window sample count; computing it serially means the mel thread does not need to borrow self.
        let feature_lengths = chunks
            .iter()
            .map(|chunk| self.compute_audio_token_length(chunk.len().max(1)))
            .collect::<Vec<_>>();

        let phase_started = Instant::now();
        let mel_values = extract_mel_windows(&self.mel, &chunks, self.config.mel_bins)?;
        let mel_seconds = phase_started.elapsed().as_secs_f64();

        let phase_started = Instant::now();
        let input_features = Array::from_slice(&mel_values, &[chunks.len() as i32, 3_000, self.config.mel_bins as i32])
            .as_dtype(self.whisper_encoder.as_ref().context("MOSS audio encoder has been released")?.dtype())?;
        let encoded = self
            .whisper_encoder
            .as_mut()
            .context("MOSS audio encoder has been released")?
            .forward(&input_features)?;
        let audio_embeddings = self.audio_embeddings(&encoded, &feature_lengths)?;
        // MLX is lazily evaluated: without forcing materialization here, the time spent in encode and inject cannot be separated.
        // This extra eval runs only under the timing switch; the production scheduling is entirely unchanged.
        if timing {
            audio_embeddings.eval()?;
        }
        let encode_seconds = phase_started.elapsed().as_secs_f64();

        let phase_started = Instant::now();
        let audio_token_count = feature_lengths.iter().sum();
        let prompt_ids = self.build_prompt(audio_token_count, instruction)?;
        let token_array = Array::from_slice(&prompt_ids, &[1, prompt_ids.len() as i32]);
        let text_embeddings = self.decoder.embed(&token_array)?;
        let input_embeddings = inject_audio_embeddings(&prompt_ids, &text_embeddings, &audio_embeddings, self.config.audio_token_id)?;
        input_embeddings.eval()?;
        let inject_seconds = phase_started.elapsed().as_secs_f64();

        if timing {
            eprintln!(
                "[ccut-timing] moss-audio-embeddings dtype={:?} windows={} mel={mel_seconds:.2}s encode={encode_seconds:.2}s inject={inject_seconds:.2}s",
                audio_embeddings.dtype(),
                chunks.len()
            );
        }
        Ok((prompt_ids, input_embeddings))
    }

    fn audio_embeddings(&self, encoded: &Array, feature_lengths: &[usize]) -> Result<Array> {
        let mut pieces = Vec::with_capacity(feature_lengths.len());
        for (index, token_length) in feature_lengths.iter().copied().enumerate() {
            let frame_length = token_length * self.config.audio_merge_size;
            pieces.push(encoded.index((index as i32..index as i32 + 1, 0..frame_length as i32, ..)));
        }
        let merged = ops::concatenate_axis(&pieces, 1)?;
        let batch = merged.dim(0);
        let sequence = merged.dim(1);
        let hidden = merged.dim(2);
        let trim = sequence / self.config.audio_merge_size as i32 * self.config.audio_merge_size as i32;
        let time_merged = merged.index((.., 0..trim, ..)).reshape(&[
            batch,
            trim / self.config.audio_merge_size as i32,
            hidden * self.config.audio_merge_size as i32,
        ])?;
        self.adaptor.as_ref().context("MOSS audio adaptor has been released")?.forward(&time_merged)
    }

    fn compute_audio_token_length(&self, samples: usize) -> usize {
        let stride = HOP_LENGTH * WHISPER_ENCODER_STRIDE * self.config.audio_merge_size;
        (samples - 1) / stride + 1
    }

    fn audio_span_ids(&self, audio_token_count: usize) -> Result<Vec<i32>> {
        if !self.enable_time_marker || audio_token_count == 0 || self.time_marker_every_seconds == 0 {
            return Ok(vec![self.config.audio_token_id; audio_token_count]);
        }
        let tokens_per_marker = (self.audio_tokens_per_second * self.time_marker_every_seconds as f32) as usize;
        if tokens_per_marker == 0 {
            return Ok(vec![self.config.audio_token_id; audio_token_count]);
        }
        let duration = audio_token_count as f32 / self.audio_tokens_per_second;
        let mut output = Vec::with_capacity(audio_token_count + 32);
        let mut consumed = 0;
        let mut seconds = self.time_marker_every_seconds;
        while seconds <= duration as usize {
            let position = seconds / self.time_marker_every_seconds * tokens_per_marker;
            let segment_length = position.saturating_sub(consumed);
            output.extend(std::iter::repeat_n(self.config.audio_token_id, segment_length));
            consumed += segment_length;
            for digit in seconds.to_string().chars() {
                output.push(
                    *self
                        .digit_token_ids
                        .get(&digit)
                        .with_context(|| format!("MOSS is missing digit {digit} token"))?,
                );
            }
            seconds += self.time_marker_every_seconds;
        }
        output.extend(std::iter::repeat_n(
            self.config.audio_token_id,
            audio_token_count.saturating_sub(consumed),
        ));
        Ok(output)
    }

    fn build_prompt(&self, audio_token_count: usize, instruction: &str) -> Result<Vec<i32>> {
        let mut ids = vec![IM_START, SYSTEM, NEWLINE];
        ids.extend(self.tokenizer.encode("You are a helpful assistant."));
        ids.extend([IM_END, NEWLINE, IM_START, USER, NEWLINE, AUDIO_START]);
        ids.extend(self.audio_span_ids(audio_token_count)?);
        ids.extend([AUDIO_END, NEWLINE]);
        ids.extend(self.tokenizer.encode(instruction));
        ids.extend([IM_END, NEWLINE, IM_START, ASSISTANT, NEWLINE]);
        Ok(ids)
    }
}

/// A resident worker keeps the audio front end, which the next task reuses directly (v2's resident node also passes `false`).
impl SegmentingRecognizer for MossTranscribeDiarize {
    fn transcribe(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut SegmentingCallbacks<'_>,
    ) -> Result<SegmentedTranscription> {
        self.transcribe_diarized_with_release(audio, language, false, callbacks)
    }
}

fn weight_refs(weights: &[PathBuf]) -> Vec<&Path> {
    weights.iter().map(PathBuf::as_path).collect()
}

struct VqAdaptor {
    input: Dense,
    output: Dense,
    norm: LayerNorm,
}

impl VqAdaptor {
    fn load(store: &mut WeightStore, config: &MossConfig) -> Result<Self> {
        if config.adaptor_input_dim != config.audio_model_size * config.audio_merge_size {
            bail!("MOSS adaptor_input_dim does not match the audio dimension");
        }
        let prefix = "model.vq_adaptor.layers";
        Ok(Self {
            input: Dense::load(store, &format!("{prefix}.0"))?,
            output: Dense::load(store, &format!("{prefix}.2"))?,
            norm: LayerNorm::load(store, &format!("{prefix}.3"), config.rms_eps)?,
        })
    }

    fn forward(&self, input: &Array) -> Result<Array> {
        let hidden = silu(self.input.forward(input)?)?;
        self.norm.forward(&self.output.forward(&hidden)?)
    }
}

struct WhisperAttention {
    q: Dense,
    k: Dense,
    v: Dense,
    output: Dense,
    heads: usize,
}

impl WhisperAttention {
    fn load(store: &mut WeightStore, prefix: &str, heads: usize) -> Result<Self> {
        Ok(Self {
            q: Dense::load(store, &format!("{prefix}.q_proj"))?,
            k: Dense::load(store, &format!("{prefix}.k_proj"))?,
            v: Dense::load(store, &format!("{prefix}.v_proj"))?,
            output: Dense::load(store, &format!("{prefix}.out_proj"))?,
            heads,
        })
    }

    fn forward(&self, input: &Array) -> Result<Array> {
        let batch = input.dim(0);
        let sequence = input.dim(1);
        let hidden = input.dim(2);
        let head_dim = hidden / self.heads as i32;
        let shape = [batch, sequence, self.heads as i32, head_dim];
        let query = self.q.forward(input)?.reshape(&shape)?.transpose_axes(&[0, 2, 1, 3])?;
        let key = self.k.forward(input)?.reshape(&shape)?.transpose_axes(&[0, 2, 1, 3])?;
        let value = self.v.forward(input)?.reshape(&shape)?.transpose_axes(&[0, 2, 1, 3])?;
        let attended = fast::scaled_dot_product_attention(&query, &key, &value, (head_dim as f32).sqrt().recip(), None, None)?;
        self.output
            .forward(&attended.transpose_axes(&[0, 2, 1, 3])?.reshape(&[batch, sequence, hidden])?)
    }
}

struct WhisperLayer {
    attention: WhisperAttention,
    attention_norm: LayerNorm,
    fc1: Dense,
    fc2: Dense,
    final_norm: LayerNorm,
}

impl WhisperLayer {
    fn load(store: &mut WeightStore, prefix: &str, heads: usize) -> Result<Self> {
        Ok(Self {
            attention: WhisperAttention::load(store, &format!("{prefix}.self_attn"), heads)?,
            attention_norm: LayerNorm::load(store, &format!("{prefix}.self_attn_layer_norm"), 1e-5)?,
            fc1: Dense::load(store, &format!("{prefix}.fc1"))?,
            fc2: Dense::load(store, &format!("{prefix}.fc2"))?,
            final_norm: LayerNorm::load(store, &format!("{prefix}.final_layer_norm"), 1e-5)?,
        })
    }

    fn forward(&self, input: &Array) -> Result<Array> {
        let normalized = self.attention_norm.forward(input)?;
        let hidden = input + &self.attention.forward(&normalized)?;
        let residual = hidden.clone();
        let hidden = self.final_norm.forward(&hidden)?;
        let hidden = gelu_same_dtype(&self.fc1.forward(&hidden)?)?;
        Ok(&residual + &self.fc2.forward(&hidden)?)
    }
}

struct WhisperEncoder {
    conv1: Conv1d,
    conv2: Conv1d,
    positions: Array,
    layers: Vec<WhisperLayer>,
    norm: LayerNorm,
}

impl WhisperEncoder {
    fn load(store: &mut WeightStore, config: &MossConfig) -> Result<Self> {
        let prefix = "model.whisper_encoder";
        let conv1 = load_conv1d(store, &format!("{prefix}.conv1"), 1)?;
        let conv2 = load_conv1d(store, &format!("{prefix}.conv2"), 2)?;
        let positions = store.take(&format!("{prefix}.embed_positions.weight"))?;
        if positions.dim(0) < config.maximum_source_positions as i32 {
            bail!("MOSS Whisper position embedding is too short");
        }
        let mut layers = Vec::with_capacity(config.audio_layers);
        for index in 0..config.audio_layers {
            layers.push(WhisperLayer::load(store, &format!("{prefix}.layers.{index}"), config.audio_heads)?);
        }
        Ok(Self {
            conv1,
            conv2,
            positions,
            layers,
            norm: LayerNorm::load(store, &format!("{prefix}.layer_norm"), 1e-5)?,
        })
    }

    fn dtype(&self) -> Dtype {
        self.conv1.weight.as_ref().dtype()
    }

    fn forward(&mut self, input: &Array) -> Result<Array> {
        let mut hidden = gelu_same_dtype(&self.conv1.forward(input)?)?;
        hidden = gelu_same_dtype(&self.conv2.forward(&hidden)?)?;
        let sequence = hidden.dim(1);
        hidden = &hidden + &self.positions.index((0..sequence, ..));
        for layer in &self.layers {
            hidden = layer.forward(&hidden)?;
        }
        self.norm.forward(&hidden)
    }
}

fn load_conv1d(store: &mut WeightStore, prefix: &str, stride: i32) -> Result<Conv1d> {
    // The official checkpoint is PyTorch [out, in, kernel]; MLX Conv1d needs [out, kernel, in].
    let weight = store.take(&format!("{prefix}.weight"))?.transpose_axes(&[0, 2, 1])?;
    Ok(Conv1d {
        weight: Param::new(weight),
        bias: Param::new(store.take_optional(&format!("{prefix}.bias"))),
        stride,
        padding: 1,
        dilation: 1,
        groups: 1,
    })
}

/// Extracts the Whisper mel per 30 s window. Each window's result depends only on that window's own samples, and `extract` borrows only `&self`,
/// so it can be split across threads directly. The output is written back into contiguous slices cut by window index, byte-for-byte identical to the serial version.
fn extract_mel_windows(mel: &WhisperFeaturePipeline, windows: &[&[f32]], mel_bins: usize) -> Result<Vec<f32>> {
    const TIME_FRAMES: usize = 3_000;
    let stride = TIME_FRAMES * mel_bins;
    let mut values = vec![0.0_f32; windows.len() * stride];
    if windows.is_empty() {
        return Ok(values);
    }
    let extract_one = |window: &[f32], padded: &mut [f32], out: &mut [f32]| -> Result<()> {
        padded.fill(0.0);
        padded[..window.len()].copy_from_slice(window);
        let features = mel.extract(padded)?;
        if features.time_frames != TIME_FRAMES || features.mel_bins != mel_bins {
            bail!("MOSS Whisper mel shape is wrong: {}×{}", features.time_frames, features.mel_bins);
        }
        out.copy_from_slice(&features.data);
        Ok(())
    };
    let threads = std::thread::available_parallelism()
        .map(std::num::NonZeroUsize::get)
        .unwrap_or(1)
        .min(windows.len());
    let mut work = windows.iter().copied().zip(values.chunks_mut(stride)).collect::<Vec<_>>();
    if threads <= 1 {
        let mut padded = vec![0.0_f32; WHISPER_WINDOW_SAMPLES];
        for (window, out) in &mut work {
            extract_one(window, &mut padded, out)?;
        }
    } else {
        let per_thread = work.len().div_ceil(threads);
        let mut outcomes = Vec::new();
        std::thread::scope(|scope| {
            let handles = work
                .chunks_mut(per_thread)
                .map(|slot| {
                    let extract_one = &extract_one;
                    scope.spawn(move || -> Result<()> {
                        let mut padded = vec![0.0_f32; WHISPER_WINDOW_SAMPLES];
                        for (window, out) in slot {
                            extract_one(window, &mut padded, out)?;
                        }
                        Ok(())
                    })
                })
                .collect::<Vec<_>>();
            outcomes = handles
                .into_iter()
                .map(|handle| handle.join().unwrap_or_else(|_| bail!("MOSS mel thread terminated abnormally")))
                .collect::<Vec<_>>();
        });
        for outcome in outcomes {
            outcome?;
        }
    }
    drop(work);
    Ok(values)
}

fn inject_audio_embeddings(prompt_ids: &[i32], text_embeddings: &Array, audio_embeddings: &Array, audio_token_id: i32) -> Result<Array> {
    // Defensive: the audio embeddings must have the same dtype as the text embeddings; otherwise concat would promote the whole prompt
    // (and with it the KV cache and the entire autoregressive decode) to the wider precision.
    let audio_embeddings = &audio_embeddings.as_dtype(text_embeddings.dtype())?;
    let positions = prompt_ids
        .iter()
        .enumerate()
        .filter_map(|(index, token)| (*token == audio_token_id).then_some(index))
        .collect::<Vec<_>>();
    if positions.len() != audio_embeddings.dim(1) as usize {
        bail!("MOSS audio token count does not match feature count: {} vs {}", positions.len(), audio_embeddings.dim(1));
    }
    let mut pieces = Vec::with_capacity(positions.len() * 2 + 1);
    let mut cursor = 0;
    for (audio_index, position) in positions.into_iter().enumerate() {
        if position > cursor {
            pieces.push(text_embeddings.index((.., cursor as i32..position as i32, ..)));
        }
        pieces.push(audio_embeddings.index((.., audio_index as i32..audio_index as i32 + 1, ..)));
        cursor = position + 1;
    }
    if cursor < prompt_ids.len() {
        pieces.push(text_embeddings.index((.., cursor as i32.., ..)));
    }
    Ok(ops::concatenate_axis(&pieces, 1)?)
}

fn evaluate_token(token: &Array) -> Result<()> {
    transforms::async_eval(std::iter::once(token))?;
    Ok(())
}
