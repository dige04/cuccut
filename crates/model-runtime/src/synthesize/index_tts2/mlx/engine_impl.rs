//! Parts of the implementation are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/IndexTTS2TTS/IndexTTS2NativeRuntime.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources see `THIRD_PARTY_NOTICES.md` at the root.
//!
//! The `IndexTts2` engine: connects weight loading (corresponds to speech-swift `IndexTTS2NativeRuntime.swift`), reference conditioning
//! (`IndexTTS2ReferenceConditioning.swift`), and segment-by-segment synthesis (`IndexTTS2Synthesis.swift` / `IndexTTS2TTSModel.swift`) to `TtsEngine`.
//!
//! The inference flow follows the official `infer()` in `indextts/infer_v2.py` (2.0) / `infer_v2_5.py` (2.5); the parameter layer follows the official web page `webui.py`.
//! Differences from Swift have all been aligned with the official code:
//! - The `qwen0.6bemo4-merge` text-emotion model (text emotion model) is not loaded: the local directory does not contain this weight, so `EmotionSpec`
//!   supports only the two sources of a reference audio and an 8-dimensional vector.
//! - The voice latent and the emotion vector are computed once per synthesis and reused across segments (the official code caches them too).
//! - Emotion: the official `merge_emovec` is `base + alpha × (emo − base)` (base is the voice reference's emotion vector); the explicit vector first passes
//!   through the web page's `normalize_emo_vec` and the `alpha` scaling of `infer()` ([`crate::synthesize::index_tts2::emotion`]), then `mat + (1 − Σw) × emovec`.
//! - S2Mel flow matching uses the official 25 steps for both generations (Swift 2.0 uses 15 steps).
//! - No PauseCompressor (Swift enables it only when `maxInternalPauseDuration` is given).
//!
//! The w2v-BERT / CAM++ / BigVGAN / statistics (`SharedAux`), together with request parsing, emotion synthesis, and per-segment concatenation,
//! are reused unchanged by IndexTTS 2.5 (`engine_v25`).
//!
//! VRAM: w2v-BERT (the first 17 layers, about 0.8 GB) is used only when computing reference conditioning and is not kept resident by the engine. On a cache miss
//! it is loaded on demand and unloaded right after use, with the MLX cache cleared. Reference conditioning is cached per voice / emotion reference file
//! ([`ConditioningCache`]), so batch synthesis of the same voice runs w2v-BERT only once.
//!
//! All files are fetched through [`VerifiedFiles`] against the manifest: every required file is checked before Metal is touched; a missing one is
//! `MODEL_NOT_INSTALLED`. For 2.0, when `config.yaml` does not list something, the built-in default config (same as v2) is used.

use super::bigvgan::BigVgan;
use super::campplus::CampPlus;
use super::conditioning::{
    CONDITIONING_CACHE_CAPACITY, ConditioningCache, ConditioningKey, ConditioningModels, ReferenceConditioning, emotion_source,
    explicit_emotion,
};
use super::gpt::{ABORT_MESSAGE, SemanticGpt};
use super::s2mel::S2Mel;
use super::semantic_codec::SemanticCodec;
use super::w2v_bert::Wav2Vec2Bert;
use super::weights::WeightMap;
use crate::bundle::VerifiedFiles;
use crate::synthesize::index_tts2::config::RuntimeConfig;
use crate::synthesize::index_tts2::emotion::EmotionControl;
use crate::synthesize::index_tts2::sampling::GenerationOptions;
use crate::synthesize::index_tts2::segmenter::TextSegmenter;
use crate::synthesize::index_tts2::tokenizer::Tokenizer;
use crate::synthesize::tensor::host::ModelMemoryCacheGuard;
use crate::synthesize::tensor::host::{clear_memory_cache, configure_memory_cache};
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, ops};
use crate::synthesize::types::{EmotionSpec, SamplingOptions, TtsAudio, TtsEngineKind, TtsProgress, TtsRequest};
use crate::synthesize::voices::{self, ReferenceAudio};
use crate::synthesize::{ProgressSink, TtsEngine};
use anyhow::{Context, Result, bail, ensure};
use std::path::PathBuf;

/// Expansion factor from semantic codes to mel frame count (Swift `frameExpansion = 1.72 / speakingRate`).
const FRAME_EXPANSION: f32 = 1.72;
/// S2Mel flow-matching step count / CFG scale / temperature (official `infer()`'s `diffusion_steps = 25`,
/// `inference_cfg_rate = 0.7`; same for both generations).
pub(super) const S2MEL_STEPS: usize = 25;
const S2MEL_CFG_RATE: f32 = 0.7;
const S2MEL_TEMPERATURE: f32 = 1.0;
/// Silence in seconds between segments (Swift `segmentIntervalSilence`).
const SEGMENT_INTERVAL_SILENCE: f32 = 0.2;
const ENGINE_NAME: &str = "IndexTTS2";

/// Relative path of w2v-BERT within the shared auxiliary weights; also used to tell whether a directory has the complete auxiliary weights.
pub(super) const W2V_BERT_FILE: &str = "aux/w2v-bert-2.0/model.safetensors";

pub struct IndexTts2 {
    config: RuntimeConfig,
    tokenizer: Tokenizer,
    gpt: SemanticGpt,
    s2mel: S2Mel,
    semantic_codec: SemanticCodec,
    aux: SharedAux,
    /// Last field: the weights are dropped first, then wait for the GPU and clear the cache.
    _cache_guard: ModelMemoryCacheGuard,
}

/// Copies an evaluated 1D / 2D tensor to host.
fn to_host_f32(array: &Array) -> Result<Vec<f32>> {
    let array = array.as_dtype(crate::synthesize::tensor::Dtype::Float32)?;
    array.eval()?;
    Ok(array.as_slice::<f32>().to_vec())
}

/// `N` 25 Hz content frames → mel frame count. `speaking_rate` only scales the target frame count of length normalization: the semantic codes are unchanged,
/// and the same code sequence is spread over fewer (faster) or more (slower) mel frames, so the pitch is unchanged.
pub(super) fn target_frames(content_frames: usize, speaking_rate: f32) -> i32 {
    ((content_frames as f32) * FRAME_EXPANSION / speaking_rate).floor().max(1.0) as i32
}

/// Speaking-rate multiplier from the request: defaults to `1.0` when omitted; out-of-range values raise an error
/// (the parameter gate has already checked it against the capability table; this guards remote or direct calls).
pub(super) fn speaking_rate(speed: Option<f32>, engine: &str) -> Result<f32> {
    let rate = speed.unwrap_or(1.0);
    let (min, max) = crate::synthesize::index_tts2::SPEAKING_RATE_RANGE;
    ensure!(
        rate.is_finite() && (min..=max).contains(&rate),
        "{engine} 语速倍率须在 {min}–{max}，收到 {rate}"
    );
    Ok(rate)
}

/// Files that [`SharedAux`] reads, checked against the manifest before Metal is touched.
pub(super) struct SharedAuxFiles {
    w2v_bert: PathBuf,
    campplus: PathBuf,
    bigvgan: PathBuf,
    stats: PathBuf,
    feat1: PathBuf,
    feat2: PathBuf,
}

impl SharedAuxFiles {
    /// File layout is the same as `aufklarer/IndexTTS2-MLX-fp16` (2.0's main-model components, 2.5's `aux` component); any missing one is `MODEL_NOT_INSTALLED`.
    pub(super) fn resolve(files: &VerifiedFiles) -> Result<Self> {
        let path = |relative: &str| -> Result<PathBuf> { Ok(files.require(relative)?.to_path_buf()) };
        Ok(Self {
            w2v_bert: path(W2V_BERT_FILE)?,
            campplus: path("aux/campplus/campplus_cn_common.safetensors")?,
            bigvgan: path("aux/bigvgan/bigvgan_generator.safetensors")?,
            stats: path("wav2vec2bert_stats.safetensors")?,
            feat1: path("feat1.safetensors")?,
            feat2: path("feat2.safetensors")?,
        })
    }
}

/// Reference encoder, vocoder and statistics shared by both IndexTTS generations (file layout same as
/// `aufklarer/IndexTTS2-MLX-fp16`). w2v-BERT is not kept resident here; see the module docs.
pub(super) struct SharedAux {
    /// w2v-BERT weight file; loaded on demand on a cache miss.
    w2v_bert_file: PathBuf,
    conditioning_cache: ConditioningCache<ReferenceConditioning>,
    campplus: CampPlus,
    vocoder: BigVgan,
    w2v_mean: Vec<f32>,
    w2v_var: Vec<f32>,
    speaker_rows: Vec<f32>,
    emotion_rows: Vec<f32>,
}

impl SharedAux {
    /// CAM++ → BigVGAN → statistics / emotion feature tables; `stage` reports progress and can be cancelled. w2v-BERT only
    /// has its file checked for presence; it is not loaded.
    pub(super) fn load(files: SharedAuxFiles, config: &RuntimeConfig, stage: &mut dyn FnMut(&str) -> Result<()>) -> Result<Self> {
        let w2v_bert_file = files.w2v_bert;

        stage("campplus")?;
        let campplus = CampPlus::load(WeightMap::load_file(&files.campplus)?).context("加载 CAM++")?;
        stage("bigvgan")?;
        let vocoder = BigVgan::load(WeightMap::load_file(&files.bigvgan)?).context("加载 BigVGAN")?;

        stage("stats")?;
        let mut stats = WeightMap::load_file(&files.stats)?;
        let w2v_mean = to_host_f32(&stats.take_f32("mean")?)?;
        let w2v_var = to_host_f32(&stats.take_f32("var")?)?;
        ensure!(
            w2v_mean.len() == 1024 && w2v_var.len() == 1024,
            "wav2vec2bert_stats 形状不符：mean {} / var {}",
            w2v_mean.len(),
            w2v_var.len()
        );
        let mut feat1 = WeightMap::load_file(&files.feat1)?;
        let speaker_table = feat1.take_f32("tensor")?;
        let mut feat2 = WeightMap::load_file(&files.feat2)?;
        let emotion_table = feat2.take_f32("tensor")?;
        let bucket_total: usize = config.emo_num.iter().sum();
        ensure!(
            speaker_table.ndim() == 2 && speaker_table.dim(0) as usize == bucket_total && speaker_table.dim(1) == 192,
            "feat1.safetensors 期望 [{bucket_total}, 192]，收到 {:?}",
            speaker_table.shape()
        );
        ensure!(
            emotion_table.ndim() == 2
                && emotion_table.dim(0) as usize == bucket_total
                && emotion_table.dim(1) as usize == config.gpt.model_dim,
            "feat2.safetensors 期望 [{bucket_total}, {}]，收到 {:?}",
            config.gpt.model_dim,
            emotion_table.shape()
        );
        Ok(Self {
            w2v_bert_file,
            conditioning_cache: ConditioningCache::new(CONDITIONING_CACHE_CAPACITY),
            campplus,
            vocoder,
            w2v_mean,
            w2v_var,
            speaker_rows: to_host_f32(&speaker_table)?,
            emotion_rows: to_host_f32(&emotion_table)?,
        })
    }

    /// Reference conditioning (voice / emotion / prompt mel / style), with the stage reported as `Loading` progress. Checks the cache first;
    /// on a miss, loads w2v-BERT, computes, then unloads it and returns its Metal buffers to the system.
    pub(super) fn prepare_conditioning(
        &mut self,
        config: &RuntimeConfig,
        s2mel: &S2Mel,
        semantic_codec: Option<&SemanticCodec>,
        reference_audio: &ReferenceAudio,
        plan: &EmotionPlan,
        progress: &mut dyn FnMut(TtsProgress) -> bool,
    ) -> Result<ReferenceConditioning> {
        let mut loading = |stage: &str| -> Result<()> {
            if !progress(TtsProgress::Loading { stage: stage.to_string() }) {
                bail!(ABORT_MESSAGE);
            }
            Ok(())
        };
        let control = plan.control.as_ref();
        let key = ConditioningKey::new(reference_audio, emotion_source(reference_audio, plan.audio.as_ref(), control));
        if let Some(mut cached) = key.as_ref().and_then(|key| self.conditioning_cache.get(key)) {
            cached.explicit_emotion = explicit_emotion(config, &self.speaker_rows, &self.emotion_rows, control, &cached.style)?;
            loading("参考条件就绪（缓存）")?;
            return Ok(cached);
        }

        loading("w2v-bert")?;
        let w2v_bert = Wav2Vec2Bert::load(WeightMap::load_file(&self.w2v_bert_file)?).context("加载 w2v-BERT 2.0")?;
        let models = ConditioningModels {
            config,
            w2v_bert: &w2v_bert,
            semantic_codec,
            campplus: &self.campplus,
            s2mel,
            w2v_mean: &self.w2v_mean,
            w2v_var: &self.w2v_var,
            speaker_rows: &self.speaker_rows,
            emotion_rows: &self.emotion_rows,
        };
        let prepared = models.prepare(reference_audio, plan.audio.as_ref(), control, &mut |_fraction, stage| {
            progress(TtsProgress::Loading { stage: stage.to_string() })
        });
        // All arrays in the conditioning have been evaluated (eval waits synchronously for GPU completion) and no longer reference the w2v-BERT weights.
        drop(w2v_bert);
        clear_memory_cache()?;
        let conditioning = prepared?;
        if let Some(key) = key {
            let mut entry = conditioning.clone();
            entry.explicit_emotion = None;
            self.conditioning_cache.insert(key, entry);
        }
        Ok(conditioning)
    }

    /// Generated segment conditioning `[1, T, 512]` is appended after the prompt conditioning → flow-matched mel (prompt segment removed) → BigVGAN waveform.
    pub(super) fn render(
        &self,
        s2mel: &S2Mel,
        generated_condition: &Array,
        conditioning: &ReferenceConditioning,
        steps: usize,
    ) -> Result<Vec<f32>> {
        let condition = ops::concatenate_axis(&[&conditioning.prompt_condition, generated_condition], 1)?;
        let mel = s2mel.inference(
            &condition,
            &conditioning.prompt_mel,
            &conditioning.style,
            steps,
            S2MEL_CFG_RATE,
            S2MEL_TEMPERATURE,
        )?;
        let prompt_frames = conditioning.prompt_mel.dim(2);
        let generated_mel = mel.index((.., .., prompt_frames..)); // [1, 80, T]
        let waveform = self.vocoder.forward(&generated_mel.swap_axes(1, 2)?)?; // [1, T·256]
        to_host_f32(&waveform)
    }
}

impl IndexTts2 {
    /// Corresponds to Swift `IndexTTS2NativeRuntime.load`: GPT → S2Mel → semantic codebook → w2v-BERT → CAM++ + BigVGAN → statistics / emotion feature tables;
    /// the Qwen text-emotion model is skipped.
    ///
    /// `model` is the model package's only components (`config.yaml`, `bpe.model`, `gpt.safetensors`, `s2mel.safetensors`, `aux/…`, the statistics and the two
    /// emotion feature tables). A missing file is `MODEL_NOT_INSTALLED`, reported before Metal is touched.
    pub fn load(model: &VerifiedFiles) -> Result<Self> {
        Self::load_with_progress(model, &mut |_| true)
    }

    pub fn load_with_progress(model: &VerifiedFiles, progress: &mut dyn FnMut(TtsProgress) -> bool) -> Result<Self> {
        let config = RuntimeConfig::load(model.path("config.yaml"))?;
        ensure!(!config.is_v25(), "这是 IndexTTS 2.5 权重，请用 index-tts2.5 引擎加载");
        let bpe_model = model.require(&config.bpe_model)?;
        let gpt_file = model.require("gpt.safetensors")?;
        let s2mel_file = model.require("s2mel.safetensors")?;
        let semantic_codec_file = model.require("aux/maskgct/semantic_codec/model.safetensors")?;
        let aux_files = SharedAuxFiles::resolve(model)?;

        configure_memory_cache()?;
        // Create the guard first: if any later step fails to load, unwinding will also wait for the GPU and clear the cache already allocated.
        let cache_guard = ModelMemoryCacheGuard;
        let tokenizer = Tokenizer::load(bpe_model).with_context(|| format!("加载 IndexTTS2 分词器 {}", config.bpe_model))?;

        let mut stage = |name: &str| -> Result<()> {
            if !progress(TtsProgress::Loading { stage: name.to_string() }) {
                bail!(ABORT_MESSAGE);
            }
            Ok(())
        };

        stage("gpt")?;
        let gpt = SemanticGpt::load(WeightMap::load_file(gpt_file)?, &config.gpt, config.semantic_codec.codebook_size)
            .context("加载 IndexTTS2 GPT")?;

        stage("s2mel")?;
        let s2mel = S2Mel::load(WeightMap::load_file(s2mel_file)?, config.s2mel.n_mels as i32).context("加载 IndexTTS2 S2Mel")?;

        stage("semantic-codec")?;
        let semantic_codec = SemanticCodec::load(WeightMap::load_file(semantic_codec_file)?).context("加载 MaskGCT 语义码本")?;

        let aux = SharedAux::load(aux_files, &config, &mut stage)?;
        clear_memory_cache()?;

        Ok(Self {
            config,
            tokenizer,
            gpt,
            s2mel,
            semantic_codec,
            aux,
            _cache_guard: cache_guard,
        })
    }

    /// Corresponds to Swift's per-segment `synthesize`: GPT generates semantic codes → S2Mel latent → length normalization →
    /// flow-matched mel → BigVGAN waveform.
    fn synthesize_segment(
        &self,
        text_tokens: &[i32],
        conditioning: &ReferenceConditioning,
        speaker_latent: &Array,
        emotion: &Array,
        options: &GenerationOptions,
        token_progress: &mut dyn FnMut(usize) -> bool,
    ) -> Result<Vec<f32>> {
        let codes = self
            .gpt
            .generate_semantic_codes(text_tokens, speaker_latent, emotion, options, token_progress)?;
        if codes.is_empty() {
            bail!("IndexTTS2 语义 GPT 没有生成任何语音 token");
        }
        let latent = self.gpt.latent_for_s2mel(text_tokens, &codes, speaker_latent, emotion)?;
        let latent = self.s2mel.gpt_latent(&latent)?; // [1, N, 1024]

        let code_tensor = Array::from_slice(&codes, &[1, codes.len() as i32]);
        let semantic_prompt = self.semantic_codec.quantizer.vq2emb(&code_tensor)?.swap_axes(1, 2)?; // [1, N, 1024]
        let semantic_prompt = semantic_prompt + latent;

        let generated_condition = self
            .s2mel
            .length_regulator
            .forward(&semantic_prompt, target_frames(codes.len(), 1.0))?; // [1, target, 512]
        self.aux.render(&self.s2mel, &generated_condition, conditioning, S2MEL_STEPS)
    }
}

/// Which reference audio to use for this synthesis: a file supplied by the caller, or a built-in voice (`Preset` by id,
/// `Default` by language). Neither IndexTTS generation has a speaker embedding table, and choosing a built-in voice also goes through cloning;
/// all of these decisions live in `crate::synthesize::voices` and are not branched on again here.
pub(super) fn clone_reference(request: &TtsRequest, engine: &str) -> Result<ReferenceAudio> {
    Ok(voices::reference_for(request, engine)?.audio)
}

/// Maps `SamplingOptions` to the GPT sampling parameters: `None` always takes the speech-swift default.
pub(super) fn generation_options(sampling: &SamplingOptions, engine: &str) -> Result<GenerationOptions> {
    let mut options = GenerationOptions::default();
    if let Some(t) = sampling.temperature {
        ensure!(t.is_finite() && t > 0.0, "{engine} temperature 必须为正有限值，收到 {t}");
        options.temperature = t;
    }
    if let Some(k) = sampling.top_k {
        options.top_k = k;
    }
    if let Some(p) = sampling.top_p {
        ensure!(p.is_finite() && p > 0.0 && p <= 1.0, "{engine} top_p 必须在 (0, 1]，收到 {p}");
        options.top_p = p;
    }
    if let Some(r) = sampling.repetition_penalty {
        ensure!(r.is_finite() && r > 0.0, "{engine} repetition_penalty 必须为正有限值，收到 {r}");
        options.repetition_penalty = r;
    }
    if let Some(n) = sampling.max_tokens {
        ensure!(n > 0, "{engine} max_tokens 必须大于 0");
        options.max_semantic_tokens = n;
    }
    if let Some(seed) = sampling.seed {
        options.seed = seed;
    }
    Ok(options)
}

/// Splits the emotion spec in the request into an emotion reference audio (and its mixing coefficient) and an explicit vector control.
/// Corresponds to the official `infer()`: if a vector is given, the emotion reference audio is not used; without an external emotion reference,
/// the voice reference serves as the emotion reference and `emo_alpha` is fixed at 1.
pub(super) struct EmotionPlan {
    audio: Option<ReferenceAudio>,
    alpha: f32,
    control: Option<EmotionControl>,
}

pub(super) fn emotion_plan(spec: Option<&EmotionSpec>, engine: &str) -> Result<EmotionPlan> {
    match spec {
        None => Ok(EmotionPlan {
            audio: None,
            alpha: 1.0,
            control: None,
        }),
        Some(EmotionSpec::Audio { reference_audio, alpha }) => {
            ensure!(
                alpha.is_finite() && (0.0..=1.0).contains(alpha),
                "{engine} 情感音频混合系数 alpha 必须在 [0, 1]，收到 {alpha}"
            );
            ensure!(
                reference_audio.is_file(),
                "{engine} 情感参考音频不存在：{}",
                reference_audio.display()
            );
            Ok(EmotionPlan {
                audio: Some(ReferenceAudio::File(reference_audio.clone())),
                alpha: *alpha,
                control: None,
            })
        }
        Some(EmotionSpec::Vector { weights, alpha }) => Ok(EmotionPlan {
            audio: None,
            alpha: 1.0,
            control: Some(EmotionControl::from_sliders(*weights, *alpha).with_context(|| format!("{engine} 情感向量无效"))?),
        }),
    }
}

/// Emotion vector `[1, 1280]`, corresponding to the official `infer()`:
/// `emovec = merge_emovec(voice, emotion reference, alpha)`; if an explicit vector is given, then `emovec = mat + (1 − Σw) × emovec`.
pub(super) fn resolve_emotion(gpt: &SemanticGpt, conditioning: &ReferenceConditioning, plan: &EmotionPlan) -> Result<Array> {
    let emotion_from_audio = gpt.emotion_vector(&conditioning.emotion_hidden)?;
    // `merge_emovec`: `base + alpha × (emo − base)`; when alpha is 1 it is just `emo`.
    let merged = if plan.alpha == 1.0 {
        emotion_from_audio
    } else {
        let base = gpt.emotion_vector(&conditioning.speaker_hidden)?;
        &base + (&emotion_from_audio - &base) * plan.alpha
    };
    let emotion = match &conditioning.explicit_emotion {
        Some((vector, weight_sum)) => SemanticGpt::resolved_emotion_vector(&merged, Some(vector), *weight_sum)?,
        None => merged,
    };
    emotion.eval()?;
    Ok(emotion)
}

/// Synthesizes segment by segment and joins them with 200 ms of silence; releases the MLX buffer cache after each segment so memory stays bounded for long texts.
pub(super) fn run_segments(
    count: usize,
    sample_rate: u32,
    progress: &mut dyn FnMut(TtsProgress) -> bool,
    mut segment: impl FnMut(usize, &mut dyn FnMut(usize) -> bool) -> Result<Vec<f32>>,
) -> Result<TtsAudio> {
    let silence_len = (sample_rate as f32 * SEGMENT_INTERVAL_SILENCE) as usize;
    let mut output: Vec<f32> = Vec::new();
    for index in 0..count {
        if !progress(TtsProgress::ChunkStarted { index, count }) {
            bail!(ABORT_MESSAGE);
        }
        let mut token_progress = |generated: usize| -> bool { progress(TtsProgress::Tokens { index, generated }) };
        let audio = segment(index, &mut token_progress)?;
        if index > 0 {
            output.extend(std::iter::repeat_n(0.0f32, silence_len));
        }
        output.extend_from_slice(&audio);
        clear_memory_cache()?;
        let seconds = output.len() as f64 / sample_rate as f64;
        if !progress(TtsProgress::ChunkFinished { index, seconds }) {
            bail!(ABORT_MESSAGE);
        }
    }
    Ok(TtsAudio {
        samples: output,
        sample_rate,
        readings_dropped: Vec::new(),
    })
}

impl TtsEngine for IndexTts2 {
    fn kind(&self) -> TtsEngineKind {
        TtsEngineKind::IndexTts2
    }

    /// Replaces 注音 (phonetic annotation) with the uppercase pinyin pieces in the vocabulary (wrapped in sentinels so each piece stays whole during tokenization);
    /// pieces not in the vocabulary are passed through as-is and reported as dropped.
    fn render_readings(&self, annotated: &crate::synthesize::readings::Annotated) -> crate::synthesize::readings::Rendered {
        crate::synthesize::readings::render_inline_pinyin(annotated, Some(self.tokenizer.pinyin_pieces()))
    }

    fn sample_rate(&self) -> u32 {
        self.config.output_sample_rate()
    }

    /// The model itself has no speaker table; what is exposed is the built-in voices bundled with the package (the values of `VoiceSpec::Preset`).
    fn preset_speakers(&self) -> Vec<String> {
        voices::ids()
    }

    fn synthesize(&mut self, request: &TtsRequest, progress: ProgressSink<'_>) -> Result<TtsAudio> {
        let reference_audio = clone_reference(request, ENGINE_NAME)?;
        let plan = emotion_plan(request.emotion.as_ref(), ENGINE_NAME)?;
        let options = generation_options(&request.sampling, ENGINE_NAME)?;

        // Tokenize (text normalization is done internally) → split into segments of ≤120 tokens.
        let tokens = self.tokenizer.tokenize(&request.text)?;
        let segments = TextSegmenter::split(&tokens, TextSegmenter::DEFAULT_MAX_TOKENS);
        if segments.is_empty() {
            bail!("IndexTTS2 文本没有产生任何 token：{:?}", request.text);
        }

        let conditioning = self.aux.prepare_conditioning(
            &self.config,
            &self.s2mel,
            Some(&self.semantic_codec),
            &reference_audio,
            &plan,
            &mut *progress,
        )?;
        let engine = &*self;

        // Voice latent and emotion vector: computed once per synthesis.
        let speaker_latent = engine.gpt.speaker_conditioning(&conditioning.speaker_hidden)?;
        speaker_latent.eval()?;
        let emotion = resolve_emotion(&engine.gpt, &conditioning, &plan)?;

        run_segments(
            segments.len(),
            engine.config.output_sample_rate(),
            progress,
            |index, token_progress| {
                let text_tokens: Vec<i32> = segments[index].iter().map(|t| t.id as i32).collect();
                engine.synthesize_segment(&text_tokens, &conditioning, &speaker_latent, &emotion, &options, token_progress)
            },
        )
    }
}
