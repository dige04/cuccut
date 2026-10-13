//! Whisper large-v3 / large-v3 Turbo on MLX (mlx-community fp16 safetensors).
//!
//! The network structure and math follow ml-explore/mlx-examples' `whisper/mlx_whisper/` (MIT license): the encoder is two convolution layers (the second with stride 2) + sinusoidal positional encoding + pre-LN Transformer; the decoder is learned positional embeddings + self-attention (KV cache) + cross-attention + MLP, with logits sharing weights with the token embedding. This is Rust written with mlx-rs following that structure; the code is not copied.
//!
//! The decoding rules match the Core ML version ([`crate::backend::coreml`]) and the whisper.cpp version ([`crate::backend::ggml`]); the rules are all in [`crate::speech::whisper_decoding`]: each 30 s window is decoded independently. If a language hint is given, its language token is used; otherwise the language token with the largest logit from one forward step at `<|startoftranscript|>` is taken. The prefix is an optional `<|startofprev|>` plus the hint, followed by `<|startoftranscript|><|lang|><|transcribe|><|notimestamps|>`, prefilled in one forward pass. After that, greedy decoding, suppressed per `should_suppress`, stops at `<|endoftext|>` or on a repetition; each window's "hint + prefix + generation" stays within [`DECODER_TOKEN_BUDGET`]. Word-level timing is filled in by the shared forced aligner.
//!
//! The device is Metal, with weights kept resident as f16. The mel is computed on the CPU ([`WhisperFeaturePipeline::moss`], standard 400-point FFT), and each window is zero-padded to 30 s, exactly 3000 frames.

use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::{Context, Result, bail, ensure};
use mlx_rs::fast::{self, ScaledDotProductAttentionMask};
use mlx_rs::ops::indexing::{IndexOp, argmax_axis};
use mlx_rs::{Array, Dtype, ops, transforms};
use serde_json::Value;

use super::qwen3::{Dense, KvCache, LayerNorm, WeightStore, gelu_same_dtype};
use super::runtime::{MemoryCacheGuard, ModelMemoryCacheGuard, ensure_metal_device, load_safetensors_filtered, speech_timing_enabled};
use crate::speech::mel::WhisperFeaturePipeline;
use crate::speech::whisper_decoding::{
    DECODER_TOKEN_BUDGET, GenerationConfig, WINDOW_SAMPLES, WhisperTokenizer, argmax_where, prompt_tokens, should_stop_for_repeated_words,
};
use crate::speech::{Recognition, RecognitionRequest, SpeechRecognizer};

const SAMPLE_RATE: usize = 16_000;
/// Number of mel frames in a 30 s window (hop 160): the encoder's two convolution layers halve it to 1500 positions.
const WINDOW_FRAMES: i32 = 3_000;
/// Whisper's LayerNorm uses PyTorch's default eps.
const LAYER_NORM_EPS: f32 = 1e-5;
/// The value added to tokens that must not be emitted in the suppression mask: in f16 it is enough to push them below all normal logits without overflowing to NaN.
const SUPPRESSED_LOGIT: f32 = -60_000.0;
/// The alignment-heads table that mlx-community's conversion stores in the weights (for word-level timestamps); not used here.
const UNUSED_WEIGHT_KEYS: [&str; 1] = ["alignment_heads"];

/// Network shape from `config.json` (mlx-community's Whisper conversion).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WhisperConfig {
    pub n_mels: usize,
    pub n_audio_ctx: usize,
    pub n_audio_state: usize,
    pub n_audio_head: usize,
    pub n_audio_layer: usize,
    pub n_vocab: usize,
    pub n_text_ctx: usize,
    pub n_text_state: usize,
    pub n_text_head: usize,
    pub n_text_layer: usize,
}

impl WhisperConfig {
    /// Reads `config.json`. If the shape does not fit (e.g. not a 30 s window → 1500 positions, or the head count does not divide the width), returns an explanation.
    pub fn parse(raw: &Value) -> std::result::Result<Self, String> {
        let field = |name: &str| -> std::result::Result<usize, String> {
            raw.get(name)
                .and_then(Value::as_u64)
                .filter(|value| *value > 0)
                .map(|value| value as usize)
                .ok_or_else(|| format!("Whisper config.json is missing positive integer field {name}"))
        };
        let config = Self {
            n_mels: field("n_mels")?,
            n_audio_ctx: field("n_audio_ctx")?,
            n_audio_state: field("n_audio_state")?,
            n_audio_head: field("n_audio_head")?,
            n_audio_layer: field("n_audio_layer")?,
            n_vocab: field("n_vocab")?,
            n_text_ctx: field("n_text_ctx")?,
            n_text_state: field("n_text_state")?,
            n_text_head: field("n_text_head")?,
            n_text_layer: field("n_text_layer")?,
        };
        if config.n_audio_ctx * 2 != WINDOW_FRAMES as usize {
            return Err(format!("Whisper n_audio_ctx must be 1500 (30 s window), found {}", config.n_audio_ctx));
        }
        if !config.n_audio_state.is_multiple_of(config.n_audio_head) || !config.n_text_state.is_multiple_of(config.n_text_head) {
            return Err("Whisper attention head count does not divide the hidden width".into());
        }
        if config.n_text_ctx < DECODER_TOKEN_BUDGET {
            return Err(format!(
                "Whisper n_text_ctx {} is smaller than the decoder token budget {DECODER_TOKEN_BUDGET}",
                config.n_text_ctx
            ));
        }
        Ok(config)
    }
}

/// Files a MLX Whisper model bundle needs: the `config.json` and safetensors of the `asr` component, and the `tokenizer.json` and `generation_config.json` of the `tokenizer` component (taken from `openai/whisper-large-v3`).
#[derive(Debug, Clone)]
pub struct WhisperFiles {
    pub config: PathBuf,
    pub weights: Vec<PathBuf>,
    pub tokenizer: PathBuf,
    pub generation_config: PathBuf,
}

/// The four projections of multi-head attention (`key` has no bias).
struct Attention {
    query: Dense,
    key: Dense,
    value: Dense,
    out: Dense,
    heads: i32,
}

impl Attention {
    fn load(store: &mut WeightStore, prefix: &str, heads: usize) -> Result<Self> {
        Ok(Self {
            query: Dense::load(store, &format!("{prefix}.query"))?,
            key: Dense::load(store, &format!("{prefix}.key"))?,
            value: Dense::load(store, &format!("{prefix}.value"))?,
            out: Dense::load(store, &format!("{prefix}.out"))?,
            heads: heads as i32,
        })
    }

    /// `[1, T, D]` → `[1, heads, T, D / heads]`。
    fn split_heads(&self, input: &Array) -> Result<Array> {
        let (batch, sequence, width) = (input.dim(0), input.dim(1), input.dim(2));
        Ok(input
            .reshape(&[batch, sequence, self.heads, width / self.heads])?
            .transpose_axes(&[0, 2, 1, 3])?)
    }

    /// Computes K and V from `source` (already split into heads).
    fn keys_values(&self, source: &Array) -> Result<(Array, Array)> {
        Ok((
            self.split_heads(&self.key.forward(source)?)?,
            self.split_heads(&self.value.forward(source)?)?,
        ))
    }

    /// Uses `input` as the query, runs scaled dot-product attention against the given K and V, merges the heads, then applies the output projection.
    fn attend(&self, input: &Array, keys: &Array, values: &Array, mask: Option<ScaledDotProductAttentionMask<'_>>) -> Result<Array> {
        let (batch, sequence, width) = (input.dim(0), input.dim(1), input.dim(2));
        let query = self.split_heads(&self.query.forward(input)?)?;
        let scale = ((width / self.heads) as f32).sqrt().recip();
        let attended = fast::scaled_dot_product_attention(&query, keys, values, scale, mask, None)?;
        let merged = attended.transpose_axes(&[0, 2, 1, 3])?.reshape(&[batch, sequence, width])?;
        self.out.forward(&merged)
    }
}

/// Two-layer MLP (GELU).
struct Mlp {
    up: Dense,
    down: Dense,
}

impl Mlp {
    fn load(store: &mut WeightStore, prefix: &str) -> Result<Self> {
        Ok(Self {
            up: Dense::load(store, &format!("{prefix}.mlp1"))?,
            down: Dense::load(store, &format!("{prefix}.mlp2"))?,
        })
    }

    fn forward(&self, input: &Array) -> Result<Array> {
        // The constant in `nn::gelu` is f32, which would promote the whole f16 activation to f32; use the dtype-preserving version.
        self.down.forward(&gelu_same_dtype(&self.up.forward(input)?)?)
    }
}

/// One encoder layer: pre-LN self-attention (no mask) + pre-LN MLP.
struct EncoderBlock {
    attention: Attention,
    attention_norm: LayerNorm,
    mlp: Mlp,
    mlp_norm: LayerNorm,
}

impl EncoderBlock {
    fn load(store: &mut WeightStore, prefix: &str, heads: usize) -> Result<Self> {
        Ok(Self {
            attention: Attention::load(store, &format!("{prefix}.attn"), heads)?,
            attention_norm: LayerNorm::load(store, &format!("{prefix}.attn_ln"), LAYER_NORM_EPS)?,
            mlp: Mlp::load(store, prefix)?,
            mlp_norm: LayerNorm::load(store, &format!("{prefix}.mlp_ln"), LAYER_NORM_EPS)?,
        })
    }

    fn forward(&self, input: &Array) -> Result<Array> {
        let normalized = self.attention_norm.forward(input)?;
        let (keys, values) = self.attention.keys_values(&normalized)?;
        let hidden = input + &self.attention.attend(&normalized, &keys, &values, None)?;
        Ok(&hidden + &self.mlp.forward(&self.mlp_norm.forward(&hidden)?)?)
    }
}

/// Audio encoder: mel `[1, 3000, n_mels]` → `[1, 1500, n_audio_state]`.
struct AudioEncoder {
    conv1_weight: Array,
    conv1_bias: Array,
    conv2_weight: Array,
    conv2_bias: Array,
    positional: Array,
    blocks: Vec<EncoderBlock>,
    final_norm: LayerNorm,
}

impl AudioEncoder {
    fn load(store: &mut WeightStore, config: &WhisperConfig) -> Result<Self> {
        let conv1_weight = store.take("encoder.conv1.weight")?;
        ensure!(
            conv1_weight.shape() == [config.n_audio_state as i32, 3, config.n_mels as i32],
            "encoder.conv1.weight shape {:?} is not the [out, 3, n_mels] layout",
            conv1_weight.shape()
        );
        let dtype = conv1_weight.dtype();
        let mut blocks = Vec::with_capacity(config.n_audio_layer);
        for index in 0..config.n_audio_layer {
            blocks.push(EncoderBlock::load(store, &format!("encoder.blocks.{index}"), config.n_audio_head)?);
        }
        Ok(Self {
            conv1_weight,
            conv1_bias: store.take("encoder.conv1.bias")?,
            conv2_weight: store.take("encoder.conv2.weight")?,
            conv2_bias: store.take("encoder.conv2.bias")?,
            positional: sinusoids(config.n_audio_ctx, config.n_audio_state).as_dtype(dtype)?,
            blocks,
            final_norm: LayerNorm::load(store, "encoder.ln_post", LAYER_NORM_EPS)?,
        })
    }

    fn forward(&self, mel: &Array) -> Result<Array> {
        // The conv weights are `[out, kernel, in]`, exactly MLX conv1d's native layout (input `[N, L, C_in]`), so no transpose is needed.
        let hidden = ops::conv1d(mel, &self.conv1_weight, 1, 1, None, None)?;
        let hidden = gelu_same_dtype(&(&hidden + &self.conv1_bias))?;
        let hidden = ops::conv1d(&hidden, &self.conv2_weight, 2, 1, None, None)?;
        let mut hidden = &gelu_same_dtype(&(&hidden + &self.conv2_bias))? + &self.positional;
        for block in &self.blocks {
            hidden = block.forward(&hidden)?;
        }
        self.final_norm.forward(&hidden)
    }
}

/// Whisper encoder's sinusoidal positional encoding: the first half is sin, the second half is cos, with time scales spread geometrically from 1 to 10000.
fn sinusoids(length: usize, channels: usize) -> Array {
    let half = channels / 2;
    let increment = 10_000_f32.ln() / (half as f32 - 1.0);
    let mut values = vec![0.0_f32; length * channels];
    for position in 0..length {
        let row = &mut values[position * channels..(position + 1) * channels];
        for index in 0..half {
            let angle = position as f32 * (-increment * index as f32).exp();
            row[index] = angle.sin();
            row[half + index] = angle.cos();
        }
    }
    Array::from_slice(&values, &[length as i32, channels as i32])
}

/// One decoder layer: pre-LN self-attention (with KV cache) + pre-LN cross-attention + pre-LN MLP.
struct DecoderBlock {
    attention: Attention,
    attention_norm: LayerNorm,
    cross_attention: Attention,
    cross_attention_norm: LayerNorm,
    mlp: Mlp,
    mlp_norm: LayerNorm,
}

impl DecoderBlock {
    fn load(store: &mut WeightStore, prefix: &str, heads: usize) -> Result<Self> {
        Ok(Self {
            attention: Attention::load(store, &format!("{prefix}.attn"), heads)?,
            attention_norm: LayerNorm::load(store, &format!("{prefix}.attn_ln"), LAYER_NORM_EPS)?,
            cross_attention: Attention::load(store, &format!("{prefix}.cross_attn"), heads)?,
            cross_attention_norm: LayerNorm::load(store, &format!("{prefix}.cross_attn_ln"), LAYER_NORM_EPS)?,
            mlp: Mlp::load(store, prefix)?,
            mlp_norm: LayerNorm::load(store, &format!("{prefix}.mlp_ln"), LAYER_NORM_EPS)?,
        })
    }

    fn forward(&self, input: &Array, cache: &mut KvCache, cross: &(Array, Array)) -> Result<Array> {
        let normalized = self.attention_norm.forward(input)?;
        let (keys, values) = self.attention.keys_values(&normalized)?;
        let (keys, values) = cache.update(keys, values)?;
        // Multi-token prefill needs a causal mask (MLX aligns the query to the end of the keys, which also works with a cache offset); single-step decoding does not.
        let mask = (input.dim(1) > 1).then_some(ScaledDotProductAttentionMask::Causal);
        let hidden = input + &self.attention.attend(&normalized, &keys, &values, mask)?;
        let normalized = self.cross_attention_norm.forward(&hidden)?;
        let hidden = &hidden + &self.cross_attention.attend(&normalized, &cross.0, &cross.1, None)?;
        Ok(&hidden + &self.mlp.forward(&self.mlp_norm.forward(&hidden)?)?)
    }
}

/// Text decoder.
struct TextDecoder {
    token_embedding: Array,
    positional: Array,
    blocks: Vec<DecoderBlock>,
    final_norm: LayerNorm,
}

impl TextDecoder {
    fn load(store: &mut WeightStore, config: &WhisperConfig) -> Result<Self> {
        let token_embedding = store.take("decoder.token_embedding.weight")?;
        ensure!(
            token_embedding.shape() == [config.n_vocab as i32, config.n_text_state as i32],
            "decoder.token_embedding.weight shape {:?} does not match config.json",
            token_embedding.shape()
        );
        let mut blocks = Vec::with_capacity(config.n_text_layer);
        for index in 0..config.n_text_layer {
            blocks.push(DecoderBlock::load(store, &format!("decoder.blocks.{index}"), config.n_text_head)?);
        }
        Ok(Self {
            token_embedding,
            positional: store.take("decoder.positional_embedding")?,
            blocks,
            final_norm: LayerNorm::load(store, "decoder.ln", LAYER_NORM_EPS)?,
        })
    }

    fn new_cache(&self) -> Vec<KvCache> {
        self.blocks.iter().map(|_| KvCache::new()).collect()
    }

    /// Cross-attention K and V for each layer: computed once per window.
    fn cross_keys_values(&self, audio: &Array) -> Result<Vec<(Array, Array)>> {
        let pairs = self
            .blocks
            .iter()
            .map(|block| block.cross_attention.keys_values(audio))
            .collect::<Result<Vec<_>>>()?;
        transforms::eval(pairs.iter().flat_map(|(keys, values)| [keys, values]))?;
        Ok(pairs)
    }

    /// Feeds `tokens` (placed after the positions already in the cache) and returns the logits `[n_vocab]` at the last position (weights shared with the token embedding).
    fn forward(&self, tokens: &[i32], cache: &mut [KvCache], cross: &[(Array, Array)]) -> Result<Array> {
        let offset = cache.first().map(KvCache::offset).unwrap_or(0);
        let count = tokens.len() as i32;
        let ids = Array::from_slice(tokens, &[1, count]);
        let positions = self.positional.index(offset..offset + count);
        let mut hidden = &self.token_embedding.index(&ids) + &positions;
        for ((block, layer_cache), layer_cross) in self.blocks.iter().zip(cache.iter_mut()).zip(cross) {
            hidden = block.forward(&hidden, layer_cache, layer_cross)?;
        }
        let last = self.final_norm.forward(&hidden.index((0, count - 1)))?;
        Ok(ops::matmul(&last, self.token_embedding.t())?)
    }
}

/// Sentence-level transcriber on MLX. Word-level timing is filled in by the shared forced aligner.
pub struct WhisperMlx {
    config: WhisperConfig,
    encoder: AudioEncoder,
    decoder: TextDecoder,
    tokenizer: WhisperTokenizer,
    generation: GenerationConfig,
    features: WhisperFeaturePipeline,
    /// Suppression mask for the first generated token (added to the logits); it also includes begin_suppress.
    first_step_mask: Array,
    /// Suppression masks for the steps after the first.
    step_mask: Array,
    // Fields are dropped in declaration order: weights are released first, then the cache is cleared.
    _memory_cache_guard: ModelMemoryCacheGuard,
}

impl WhisperMlx {
    pub fn load(files: &WhisperFiles) -> Result<Self> {
        ensure_metal_device()?;
        // If loading fails partway through, the weights already read in must also be cleared.
        let memory_cache_guard = ModelMemoryCacheGuard;
        let raw: Value = serde_json::from_slice(&std::fs::read(&files.config).with_context(|| format!("read {}", files.config.display()))?)
            .context("parse Whisper config.json")?;
        let config = WhisperConfig::parse(&raw).map_err(anyhow::Error::msg)?;
        let tokenizer = WhisperTokenizer::load(&files.tokenizer)?;
        let generation = GenerationConfig::load(&files.generation_config)?;

        let weights = files.weights.iter().map(PathBuf::as_path).collect::<Vec<_>>();
        // Materialize tensor by tensor, so that 1.6–3 GB of weights are not put into the same Metal command buffer.
        let raw_weights = load_safetensors_filtered(&weights, |key| !UNUSED_WEIGHT_KEYS.contains(&key))?;
        let mut store = WeightStore::from_arrays(raw_weights)?;
        let encoder = AudioEncoder::load(&mut store, &config)?;
        let decoder = TextDecoder::load(&mut store, &config)?;
        let remaining = store.remaining();
        if !remaining.is_empty() {
            bail!("Whisper weights contain unrecognized tensors: {}", remaining.join(", "));
        }
        transforms::eval([&encoder.positional])?;

        let dtype = decoder.token_embedding.dtype();
        let first_step_mask = suppression_mask(&generation, config.n_vocab, 0, dtype)?;
        let step_mask = suppression_mask(&generation, config.n_vocab, 1, dtype)?;
        Ok(Self {
            config,
            encoder,
            decoder,
            tokenizer,
            generation,
            features: WhisperFeaturePipeline::moss(config.n_mels),
            first_step_mask,
            step_mask,
            _memory_cache_guard: memory_cache_guard,
        })
    }

    /// Warm-up: one second of silence goes through the mel, the encoder, language detection and one decoding step, so the Metal kernels are compiled before the first recognition. The encoder shapes are exactly the same as in real recognition (every window is padded to 30 s).
    pub fn warmup(&mut self) -> Result<()> {
        let _memory_cache_guard = MemoryCacheGuard::new();
        let audio = self.encode_window(&vec![0.0; SAMPLE_RATE])?;
        let cross = self.decoder.cross_keys_values(&audio)?;
        let language = self.detect_language(&cross)?;
        let mut cache = self.decoder.new_cache();
        let mut prefix = self.generation.task_tokens(language).to_vec();
        prefix.push(self.generation.no_timestamps());
        let logits = self.decoder.forward(&prefix, &mut cache, &cross)?;
        let first = self.pick(&logits, &self.first_step_mask)?;
        let logits = self.decoder.forward(&[first], &mut cache, &cross)?;
        self.pick(&logits, &self.step_mask)?;
        Ok(())
    }

    /// Whole audio → text and language code: split into 30 s windows, decode each window independently, and join with spaces. The language is the one detected in the first window; later windows reuse it.
    pub fn transcribe(&self, audio: &[f32], language_hint: Option<&str>, prompt: Option<&str>) -> Result<(String, Option<String>)> {
        if audio.is_empty() {
            return Ok((String::new(), language_hint.map(str::to_owned)));
        }
        let prompt_tokens = prompt_tokens(&self.tokenizer, &self.generation, prompt, DECODER_TOKEN_BUDGET);
        let mut texts = Vec::new();
        let mut resolved_language = None;
        for window in audio.chunks(WINDOW_SAMPLES) {
            let hint = language_hint.or(resolved_language.as_deref());
            let (text, language) = self.transcribe_window(window, hint, &prompt_tokens)?;
            if !text.is_empty() {
                texts.push(text);
            }
            if resolved_language.is_none() {
                resolved_language = language;
            }
        }
        Ok((
            texts.join(" ").trim().to_owned(),
            resolved_language.or_else(|| language_hint.map(str::to_owned)),
        ))
    }

    fn transcribe_window(&self, audio: &[f32], language_hint: Option<&str>, prompt_tokens: &[i32]) -> Result<(String, Option<String>)> {
        // Each window's mel, encoder output and KV cache are temporary Metal buffers; they are returned when the window ends.
        let _memory_cache_guard = MemoryCacheGuard::new();
        let timing = speech_timing_enabled();
        let started = Instant::now();
        let audio_features = self.encode_window(audio)?;
        let cross = self.decoder.cross_keys_values(&audio_features)?;
        let encoded = started.elapsed();

        let language_token = match language_hint.and_then(|hint| self.generation.language_token(hint)) {
            Some(token) => token,
            None => self.detect_language(&cross)?,
        };
        let language = self.generation.language_code(language_token);
        let generated = self.decode_greedy(&cross, language_token, prompt_tokens)?;
        if timing {
            eprintln!(
                "[whisper-mlx] window {:.1}s: encode {:.0} ms, decode {} tokens {:.0} ms",
                audio.len() as f64 / SAMPLE_RATE as f64,
                encoded.as_secs_f64() * 1000.0,
                generated.len(),
                (started.elapsed() - encoded).as_secs_f64() * 1000.0,
            );
        }
        Ok((self.tokenizer.decode(&generated).trim().to_owned(), language))
    }

    /// One window (≤ 30 s) → encoder output `[1, 1500, n_audio_state]` (already evaluated). Input shorter than 30 s is zero-padded to 30 s before feature extraction.
    fn encode_window(&self, audio: &[f32]) -> Result<Array> {
        let mut padded = vec![0.0_f32; WINDOW_SAMPLES];
        let count = audio.len().min(WINDOW_SAMPLES);
        padded[..count].copy_from_slice(&audio[..count]);
        let mel = self.features.extract(&padded)?;
        ensure!(
            mel.time_frames == WINDOW_FRAMES as usize,
            "mel for a 30 s window should have {WINDOW_FRAMES} frames, found {}",
            mel.time_frames
        );
        let dtype = self.decoder.token_embedding.dtype();
        let mel = Array::from_slice(&mel.data, &[1, WINDOW_FRAMES, self.config.n_mels as i32]).as_dtype(dtype)?;
        let output = self.encoder.forward(&mel)?;
        output.eval()?;
        Ok(output)
    }

    /// One forward step at `<|startoftranscript|>`, taking the language token with the largest logit; if none can be taken, assume English.
    fn detect_language(&self, cross: &[(Array, Array)]) -> Result<i32> {
        let mut cache = self.decoder.new_cache();
        let logits = self
            .decoder
            .forward(&[self.generation.start_of_transcript()], &mut cache, cross)?
            .as_dtype(Dtype::Float32)?;
        logits.eval()?;
        Ok(
            argmax_where(logits.as_slice::<f32>(), |token| !self.generation.is_language_token(token as i32))
                .unwrap_or(self.generation.english_token()),
        )
    }

    /// Greedy decoding. The prefix is prefilled in one forward pass; afterwards each step feeds the previous step's token. The semantics match the earlier Core ML version item by item: the first generated token uses a separate suppression mask, `<|endoftext|>` stops decoding, special tokens are not included in the result, and repetition stops decoding. Positions run up to one before the full budget.
    fn decode_greedy(&self, cross: &[(Array, Array)], language_token: i32, prompt_tokens: &[i32]) -> Result<Vec<i32>> {
        let mut prefix = prompt_tokens.to_vec();
        prefix.extend(self.generation.task_tokens(language_token));
        // `<|notimestamps|>` is the input to the first decoding step, so its position is the position of the first generated token.
        let mut position = prefix.len();
        prefix.push(self.generation.no_timestamps());
        let last_position = DECODER_TOKEN_BUDGET.saturating_sub(1);
        let mut generated = Vec::new();
        if position >= last_position {
            return Ok(generated);
        }

        let mut cache = self.decoder.new_cache();
        let mut logits = self.decoder.forward(&prefix, &mut cache, cross)?;
        loop {
            let mask = if generated.is_empty() {
                &self.first_step_mask
            } else {
                &self.step_mask
            };
            let sampled = self.pick(&logits, mask)?;
            if sampled == self.generation.end_token() {
                break;
            }
            if sampled < self.generation.special_token_begin() {
                generated.push(sampled);
                if should_stop_for_repeated_words(&self.tokenizer, &generated) {
                    generated.pop();
                    break;
                }
            }
            position += 1;
            if position >= last_position {
                break;
            }
            logits = self.decoder.forward(&[sampled], &mut cache, cross)?;
        }
        Ok(generated)
    }

    /// After the suppression mask is added to the logits, the max is taken on the device, so only one token is pulled back to the host.
    fn pick(&self, logits: &Array, mask: &Array) -> Result<i32> {
        let token = argmax_axis(&(logits + mask), -1, false)?;
        Ok(token.try_item::<u32>()? as i32)
    }
}

/// Suppression mask for step `generated_count`: tokens that [`GenerationConfig::should_suppress`] says must not appear get a very large negative value added.
/// Suppression only comes in two kinds, "first generated token" and "after", so two masks are enough.
fn suppression_mask(generation: &GenerationConfig, vocabulary: usize, generated_count: usize, dtype: Dtype) -> Result<Array> {
    let values = (0..vocabulary)
        .map(|token| {
            if generation.should_suppress(token as i32, generated_count) {
                SUPPRESSED_LOGIT
            } else {
                0.0
            }
        })
        .collect::<Vec<_>>();
    let mask = Array::from_slice(&values, &[vocabulary as i32]).as_dtype(dtype)?;
    mask.eval()?;
    Ok(mask)
}

/// A segment of the transcription pipeline: the asserted language is used as the language token, and the recognition hint is used as the initial prompt. Whisper reports language codes (`en`, `yue`), not language names like Qwen3-ASR does.
impl SpeechRecognizer for WhisperMlx {
    fn recognize(&mut self, audio: &[f32], request: &RecognitionRequest<'_>) -> Result<Recognition> {
        let (text, language) = self.transcribe(audio, request.language, request.context)?;
        Ok(Recognition {
            text,
            language_name: language,
            degenerate: false,
        })
    }
}

/// Reads files from a path (for tests and benchmarks): `config.json` and `*.safetensors` in `dir`, plus the two JSON files in the tokenizer directory.
pub fn files_in(weights_dir: &Path, tokenizer_dir: &Path) -> Result<WhisperFiles> {
    let mut weights = std::fs::read_dir(weights_dir)
        .with_context(|| format!("read {}", weights_dir.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|extension| extension == "safetensors"))
        .collect::<Vec<_>>();
    weights.sort();
    ensure!(!weights.is_empty(), "no safetensors in {}", weights_dir.display());
    Ok(WhisperFiles {
        config: weights_dir.join("config.json"),
        weights,
        tokenizer: tokenizer_dir.join("tokenizer.json"),
        generation_config: tokenizer_dir.join("generation_config.json"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::mlx::runtime::MLX_TEST_LOCK;

    #[test]
    fn config_reads_the_mlx_community_shape() {
        let turbo = serde_json::json!({
            "n_mels": 128, "n_audio_ctx": 1500, "n_audio_state": 1280, "n_audio_head": 20, "n_audio_layer": 32,
            "n_vocab": 51866, "n_text_ctx": 448, "n_text_state": 1280, "n_text_head": 20, "n_text_layer": 4,
        });
        let config = WhisperConfig::parse(&turbo).unwrap();
        assert_eq!((config.n_text_layer, config.n_audio_layer, config.n_vocab), (4, 32, 51_866));
        let mut wrong = turbo.clone();
        wrong["n_audio_ctx"] = 750.into();
        assert!(WhisperConfig::parse(&wrong).unwrap_err().contains("n_audio_ctx"));
        let mut missing = turbo;
        missing.as_object_mut().unwrap().remove("n_text_layer");
        assert!(WhisperConfig::parse(&missing).unwrap_err().contains("n_text_layer"));
    }

    #[test]
    fn sinusoids_are_sin_then_cos() {
        let _lock = MLX_TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
        if ensure_metal_device().is_err() {
            return;
        }
        let table = sinusoids(3, 8);
        table.eval().unwrap();
        let values = table.as_slice::<f32>();
        // Position 0: sin all 0, cos all 1.
        assert_eq!(&values[..8], &[0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0]);
        // Position 1, frequency 0 (time scale 1): sin(1), cos(1); the last frequency has time scale 10000.
        assert!((values[8] - 1_f32.sin()).abs() < 1e-6);
        assert!((values[12] - 1_f32.cos()).abs() < 1e-6);
        assert!((values[11] - (1.0e-4_f32).sin()).abs() < 1e-6);
    }

    /// End-to-end recognition and timing with real weights (run with `--release`): `CUCCUT_WHISPER_MLX_DIR` is the directory of mlx-community's fp16 repo (`config.json` + safetensors), `CUCCUT_WHISPER_TOKENIZER_DIR` is the tokenizer directory of `openai/whisper-large-v3` (`tokenizer.json` + `generation_config.json`), and `CUCCUT_WHISPER_AUDIO` is a 16 kHz mono WAV.
    /// If `CUCCUT_WHISPER_EXPECT` is given, the start of the text is checked against it.
    #[test]
    #[ignore = "needs CUCCUT_WHISPER_MLX_DIR, CUCCUT_WHISPER_TOKENIZER_DIR and CUCCUT_WHISPER_AUDIO"]
    fn transcribes_a_real_recording() {
        let _lock = MLX_TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
        let env = |name: &str| PathBuf::from(std::env::var(name).unwrap_or_else(|_| panic!("set {name}")));
        let files = files_in(&env("CUCCUT_WHISPER_MLX_DIR"), &env("CUCCUT_WHISPER_TOKENIZER_DIR")).unwrap();
        let audio = crate::audio::decode_mono(&env("CUCCUT_WHISPER_AUDIO"), SAMPLE_RATE as u32).unwrap();
        super::super::runtime::configure_memory_cache().unwrap();

        let started = Instant::now();
        let mut model = WhisperMlx::load(&files).unwrap();
        let load = started.elapsed();
        let started = Instant::now();
        model.warmup().unwrap();
        let warmup = started.elapsed();
        let (language, prompt) = (
            std::env::var("CUCCUT_WHISPER_LANGUAGE").ok(),
            std::env::var("CUCCUT_WHISPER_PROMPT").ok(),
        );
        let request = RecognitionRequest {
            language: language.as_deref(),
            context: prompt.as_deref(),
        };
        let mut runs = Vec::new();
        for _ in 0..2 {
            let started = Instant::now();
            let recognition = model.recognize(&audio, &request).unwrap();
            runs.push((started.elapsed(), recognition));
        }
        let (first, ref recognition) = runs[0];
        let second = runs[1].0;
        let preview = recognition.text.chars().take(200).collect::<String>();
        println!(
            "whisper-mlx: audio {:.1}s, load {:.2}s, warmup {:.2}s, recognize {:.2}s / {:.2}s, language {:?}\n{preview}",
            audio.len() as f64 / SAMPLE_RATE as f64,
            load.as_secs_f64(),
            warmup.as_secs_f64(),
            first.as_secs_f64(),
            second.as_secs_f64(),
            recognition.language_name,
        );
        assert_eq!(runs[1].1.text, recognition.text, "two greedy decodes should match exactly");
        if let Ok(expected) = std::env::var("CUCCUT_WHISPER_EXPECT") {
            assert!(recognition.text.starts_with(&expected), "{preview}");
        }
    }
}
