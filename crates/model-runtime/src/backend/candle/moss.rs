//! MOSS-Transcribe-Diarize (candle). Mirrors the mlx backend `moss.rs` and is ported unchanged from v2 `ccut-speech`.
//!
//! The model produces `[start][Sxx]text[end]` timestamps and speaker labels itself, so this backend bypasses the external VAD. Merging speakers across chunks and refining word timing on long lines are done in the orchestration of `job.run` ([`crate::transcribe`]). Differences from the mlx backend: no quantization at load time, and the weights keep the checkpoint precision as-is (upcast to f32 on CPU, kept in half precision on CUDA). On CPU, autoregressive decoding is much slower than on Apple Silicon/Metal, so NVIDIA users should use the `cuda` feature. v3 only changes the boundary: files are always taken from the `asr` component's manifest, and the directory is not scanned.

use std::collections::HashMap;
use std::time::Instant;

use anyhow::{Context, Result, bail};
use candle_core::{DType, Device, IndexOp, Tensor};

use super::layers::{Dense, LayerNorm, gelu, scaled_dot_product_attention};
use super::qwen3::{argmax_token, ids_tensor};
use super::text_decoder::{KvCache, TextDecoder, TextDecoderConfig};
use super::weights::WeightStore;
use crate::backend::speech_timing_enabled;
use crate::bundle::VerifiedFiles;
use crate::speech::mel::WhisperFeaturePipeline;
use crate::speech::moss_common::{
    ASSISTANT, AUDIO_END, AUDIO_START, ChunkGeneration, GenerationStopReason, HOP_LENGTH, IM_END, IM_START, MossConfig,
    MossProcessorConfig, NEWLINE, PAD_EOS, PREFILL_STEP, SAMPLE_RATE, STREAM_FLUSH_INTERVAL, SYSTEM, StreamState, USER,
    WHISPER_ENCODER_STRIDE, WHISPER_WINDOW_SAMPLES, moss_instruction, repetitive_token_tail, split_audio_at_low_energy, transcribe_chunks,
};
pub use crate::speech::moss_common::{MossCallbacks, MossCancelled, MossTranscription};
use crate::speech::moss_parse::{MossGenerationPlan, MossStreamDecoder};
use crate::speech::tokenizer::Qwen3Tokenizer;
use crate::speech::{SegmentedTranscription, SegmentingCallbacks, SegmentingRecognizer};

pub struct MossTranscribeDiarize {
    config: MossConfig,
    whisper_encoder: WhisperEncoder,
    adaptor: VqAdaptor,
    decoder: TextDecoder,
    tokenizer: Qwen3Tokenizer,
    mel: WhisperFeaturePipeline,
    audio_tokens_per_second: f32,
    time_marker_every_seconds: usize,
    enable_time_marker: bool,
    digit_token_ids: HashMap<char, i32>,
    device: Device,
    dtype: DType,
}

impl MossTranscribeDiarize {
    /// Loads from the `asr` component's files (`config.json`, `vocab.json` and `*.safetensors` are required; `processor_config.json`, `merges.txt` and `tokenizer_config.json` are read only if listed). A missing file is `MODEL_NOT_INSTALLED`.
    pub fn load(files: &VerifiedFiles, device: &Device) -> Result<Self> {
        Self::load_inner(files, device).map_err(super::annotate_out_of_memory)
    }

    fn load_inner(files: &VerifiedFiles, device: &Device) -> Result<Self> {
        let config_path = files.require("config.json")?;
        let vocabulary = files.require("vocab.json")?;
        let weights = files.require_extension_in("", "safetensors")?;
        let load_started = Instant::now();
        let config = MossConfig::load(config_path)?;
        let mut store = WeightStore::load(&weights, device)?;
        let dtype = store.compute_dtype();
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
                bits: 0,
                rope_theta: config.rope_theta,
                rms_eps: config.rms_eps,
                qk_norm: true,
            },
            "model.language_model",
        )?;
        let tokenizer = Qwen3Tokenizer::load(vocabulary, files.path("merges.txt"), files.path("tokenizer_config.json"))
            .context("load MOSS tokenizer")?;
        let processor = MossProcessorConfig::load(files.path("processor_config.json"))?;
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
        // lm_head (in tied-embedding mode) and the index metadata do not take part in inference.
        let _unused_checkpoint_metadata = store.remaining();
        if speech_timing_enabled() {
            eprintln!(
                "[ccut-timing] moss-load seconds={:.2} backend=candle device={} dtype={dtype:?}",
                load_started.elapsed().as_secs_f64(),
                super::device_label(device),
            );
        }
        Ok(Self {
            config,
            whisper_encoder,
            adaptor,
            decoder,
            tokenizer,
            mel: WhisperFeaturePipeline::moss(80),
            audio_tokens_per_second: processor.audio_tokens_per_second,
            time_marker_every_seconds: processor.time_marker_every_seconds,
            enable_time_marker: processor.enable_time_marker,
            digit_token_ids,
            device: device.clone(),
            dtype,
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
        self.transcribe_diarized_inner(audio, language, callbacks)
            .map_err(super::annotate_out_of_memory)
    }

    fn transcribe_diarized_inner(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut MossCallbacks<'_>,
    ) -> Result<MossTranscription> {
        let instruction = moss_instruction(language);
        if audio.is_empty() {
            return Ok(MossTranscription::default());
        }
        let total_duration = audio.len() as f64 / SAMPLE_RATE as f64;
        // Experimental knob, same as the mlx backend: shorter chunks trade for a shorter attention context.
        let chunk_seconds = MossGenerationPlan::chunk_duration_from_env(std::env::var("CCUT_MOSS_CHUNK_SECONDS").ok().as_deref());
        let plan = MossGenerationPlan::make_with_chunk_duration(total_duration, chunk_seconds);
        let chunks = split_audio_at_low_energy(audio, plan.chunk_duration, 5.0, 0.1);
        transcribe_chunks(audio, &chunks, chunk_seconds, callbacks, |request, stream| {
            self.generate_chunk(request.samples, &instruction, request.max_tokens, stream)
        })
    }

    fn generate_chunk(
        &mut self,
        audio: &[f32],
        instruction: &str,
        maximum_tokens: usize,
        stream: &mut StreamState<'_, '_>,
    ) -> Result<ChunkGeneration> {
        let inputs_started = Instant::now();
        let (prompt_ids, input_embeddings) = self.prepare_generation_inputs(audio, instruction)?;
        let inputs_seconds = inputs_started.elapsed().as_secs_f64();
        let total_tokens = prompt_ids.len();
        if total_tokens == 0 {
            bail!("MOSS prompt is empty");
        }
        let prefill_started = Instant::now();
        let mut cache: Option<Vec<KvCache>> = None;
        let mut processed = 0;
        while total_tokens - processed > 1 {
            let count = PREFILL_STEP.min(total_tokens - processed - 1);
            let embeddings = input_embeddings.narrow(1, processed, count)?;
            let (_hidden, updated) = self.decoder.decode(&embeddings, None, cache.take())?;
            cache = Some(updated);
            processed += count;
        }
        let last = input_embeddings.narrow(1, processed, total_tokens - processed)?;
        let (hidden, updated) = self.decoder.decode(&last, None, cache.take())?;
        let mut cache = Some(updated);
        let sequence = hidden.dim(1)?;
        let mut logits = self.decoder.logits(&hidden.i((.., sequence - 1..sequence, ..))?)?;
        let prefill_seconds = prefill_started.elapsed().as_secs_f64();

        let generation_started = Instant::now();
        let mut generated = Vec::with_capacity(maximum_tokens.min(4_096));
        // Incremental parsing feeds live preview and loop detection; the final text is still decoded from the full token sequence.
        let mut decoder = MossStreamDecoder::default();
        let mut streamed = 0_usize;
        let mut stop_reason = GenerationStopReason::TokenLimit;
        for index in 0..maximum_tokens {
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
            let token = argmax_token(&logits)?;
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
            let ids = ids_tensor(&[token], &self.device)?;
            let embeddings = self.decoder.embed(&ids)?;
            let (hidden, updated) = self.decoder.decode(&embeddings, None, cache.take())?;
            cache = Some(updated);
            let sequence = hidden.dim(1)?;
            logits = self.decoder.logits(&hidden.i((.., sequence - 1..sequence, ..))?)?;
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
        if speech_timing_enabled() {
            let generation_seconds = generation_started.elapsed().as_secs_f64();
            eprintln!(
                "[ccut-timing] moss-chunk inputs={inputs_seconds:.2}s prefill={prefill_seconds:.2}s ({total_tokens} tok, {:.1} tok/s) generate={generation_seconds:.2}s ({} tok, {:.1} tok/s) backend=candle",
                total_tokens as f64 / prefill_seconds.max(1e-9),
                generated.len(),
                generated.len() as f64 / generation_seconds.max(1e-9),
            );
        }
        Ok(ChunkGeneration {
            text: self.tokenizer.decode(&generated).trim().to_owned(),
            token_count: generated.len(),
            stop_reason,
        })
    }

    fn prepare_generation_inputs(&mut self, audio: &[f32], instruction: &str) -> Result<(Vec<i32>, Tensor)> {
        let chunks = audio.chunks(WHISPER_WINDOW_SAMPLES).collect::<Vec<_>>();
        let mut mel_values = Vec::with_capacity(chunks.len() * 3_000 * self.config.mel_bins);
        let mut feature_lengths = Vec::with_capacity(chunks.len());
        for chunk in &chunks {
            let mut padded = vec![0.0_f32; WHISPER_WINDOW_SAMPLES];
            padded[..chunk.len()].copy_from_slice(chunk);
            let features = self.mel.extract(&padded)?;
            if features.time_frames != 3_000 || features.mel_bins != self.config.mel_bins {
                bail!("MOSS Whisper mel shape is wrong: {}×{}", features.time_frames, features.mel_bins);
            }
            mel_values.extend(features.data);
            feature_lengths.push(self.compute_audio_token_length(chunk.len().max(1)));
        }
        // Time-major [chunks, 3000, mel] → candle convolution needs NCL [chunks, mel, 3000].
        let input_features = Tensor::from_vec(mel_values, (chunks.len(), 3_000, self.config.mel_bins), &self.device)?
            .to_dtype(self.dtype)?
            .transpose(1, 2)?
            .contiguous()?;
        let encoded = self.whisper_encoder.forward(&input_features)?;
        let audio_embeddings = self.audio_embeddings(&encoded, &feature_lengths)?;
        let audio_token_count = feature_lengths.iter().sum();
        let prompt_ids = self.build_prompt(audio_token_count, instruction)?;
        let token_array = ids_tensor(&prompt_ids, &self.device)?;
        let text_embeddings = self.decoder.embed(&token_array)?;
        let input_embeddings = inject_audio_embeddings(&prompt_ids, &text_embeddings, &audio_embeddings, self.config.audio_token_id)?;
        Ok((prompt_ids, input_embeddings))
    }

    fn audio_embeddings(&self, encoded: &Tensor, feature_lengths: &[usize]) -> Result<Tensor> {
        let mut pieces = Vec::with_capacity(feature_lengths.len());
        for (index, token_length) in feature_lengths.iter().copied().enumerate() {
            let frame_length = token_length * self.config.audio_merge_size;
            pieces.push(encoded.i((index..index + 1, 0..frame_length, ..))?);
        }
        let merged = Tensor::cat(&pieces, 1)?;
        let (batch, sequence, hidden) = merged.dims3()?;
        let trim = sequence / self.config.audio_merge_size * self.config.audio_merge_size;
        let time_merged =
            merged
                .narrow(1, 0, trim)?
                .reshape((batch, trim / self.config.audio_merge_size, hidden * self.config.audio_merge_size))?;
        self.adaptor.forward(&time_merged)
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

/// The resident Worker keeps the whole model, so the next job reuses it directly.
impl SegmentingRecognizer for MossTranscribeDiarize {
    fn transcribe(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut SegmentingCallbacks<'_>,
    ) -> Result<SegmentedTranscription> {
        self.transcribe_diarized_with(audio, language, callbacks)
    }
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

    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let hidden = candle_nn::ops::silu(&self.input.forward(input)?)?;
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

    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let (batch, sequence, hidden) = input.dims3()?;
        let head_dim = hidden / self.heads;
        let shape = (batch, sequence, self.heads, head_dim);
        // SDPA hands the tensor straight to gemm, and the encoder has no KV-cache view here, so it has to make the tensor contiguous itself.
        let query = self.q.forward(input)?.reshape(shape)?.transpose(1, 2)?.contiguous()?;
        let key = self.k.forward(input)?.reshape(shape)?.transpose(1, 2)?.contiguous()?;
        let value = self.v.forward(input)?.reshape(shape)?.transpose(1, 2)?.contiguous()?;
        let attended = scaled_dot_product_attention(&query, &key, &value, (head_dim as f64).sqrt().recip(), None)?;
        self.output.forward(&attended.transpose(1, 2)?.reshape((batch, sequence, hidden))?)
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

    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let normalized = self.attention_norm.forward(input)?;
        let hidden = (input + self.attention.forward(&normalized)?)?;
        let residual = hidden.clone();
        let hidden = self.final_norm.forward(&hidden)?;
        let hidden = gelu(&self.fc1.forward(&hidden)?)?;
        Ok((residual + self.fc2.forward(&hidden)?)?)
    }
}

struct Conv1d {
    weight: Tensor,
    bias: Option<Tensor>,
    stride: usize,
}

impl Conv1d {
    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let output = input.conv1d(&self.weight, 1, self.stride, 1, 1)?;
        Ok(match &self.bias {
            Some(bias) => {
                let channels = bias.dim(0)?;
                output.broadcast_add(&bias.reshape((1, channels, 1))?)?
            }
            None => output,
        })
    }
}

struct WhisperEncoder {
    conv1: Conv1d,
    conv2: Conv1d,
    positions: Tensor,
    layers: Vec<WhisperLayer>,
    norm: LayerNorm,
}

impl WhisperEncoder {
    fn load(store: &mut WeightStore, config: &MossConfig) -> Result<Self> {
        let prefix = "model.whisper_encoder";
        let conv1 = load_conv1d(store, &format!("{prefix}.conv1"), 1)?;
        let conv2 = load_conv1d(store, &format!("{prefix}.conv2"), 2)?;
        let positions = store.take_compute(&format!("{prefix}.embed_positions.weight"))?;
        if positions.dim(0)? < config.maximum_source_positions {
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

    /// Input NCL [chunks, mel, 3000], output [chunks, 1500, d_model].
    fn forward(&self, input: &Tensor) -> Result<Tensor> {
        let mut hidden = gelu(&self.conv1.forward(input)?)?;
        hidden = gelu(&self.conv2.forward(&hidden)?)?;
        // NCL → NLC; afterwards the sequence stays in the middle layout, matching positional encoding and attention.
        hidden = hidden.transpose(1, 2)?.contiguous()?;
        let sequence = hidden.dim(1)?;
        hidden = hidden.broadcast_add(&self.positions.narrow(0, 0, sequence)?)?;
        for layer in &self.layers {
            hidden = layer.forward(&hidden)?;
        }
        self.norm.forward(&hidden)
    }
}

fn load_conv1d(store: &mut WeightStore, prefix: &str, stride: usize) -> Result<Conv1d> {
    // The official checkpoint is PyTorch [out, in, kernel], which matches the candle layout.
    let weight = store.take_compute(&format!("{prefix}.weight"))?;
    Ok(Conv1d {
        weight,
        bias: store.take_optional_compute(&format!("{prefix}.bias"))?,
        stride,
    })
}

fn inject_audio_embeddings(prompt_ids: &[i32], text_embeddings: &Tensor, audio_embeddings: &Tensor, audio_token_id: i32) -> Result<Tensor> {
    let positions = prompt_ids
        .iter()
        .enumerate()
        .filter_map(|(index, token)| (*token == audio_token_id).then_some(index))
        .collect::<Vec<_>>();
    if positions.len() != audio_embeddings.dim(1)? {
        bail!(
            "MOSS audio token count does not match feature count: {} vs {}",
            positions.len(),
            audio_embeddings.dim(1)?
        );
    }
    // Audio tokens usually appear in runs (interrupted only by timestamp-marker numbers). Concatenating contiguous runs rather than slicing token by token cuts the number of `cat` pieces from thousands to a few dozen.
    let mut pieces = Vec::new();
    let mut cursor = 0;
    let mut audio_index = 0;
    let mut scan = 0;
    while scan < positions.len() {
        let start = positions[scan];
        let mut length = 1;
        while scan + length < positions.len() && positions[scan + length] == start + length {
            length += 1;
        }
        if start > cursor {
            pieces.push(text_embeddings.narrow(1, cursor, start - cursor)?);
        }
        pieces.push(audio_embeddings.narrow(1, audio_index, length)?);
        cursor = start + length;
        audio_index += length;
        scan += length;
    }
    if cursor < prompt_ids.len() {
        pieces.push(text_embeddings.narrow(1, cursor, prompt_ids.len() - cursor)?);
    }
    Ok(Tensor::cat(&pieces, 1)?)
}
