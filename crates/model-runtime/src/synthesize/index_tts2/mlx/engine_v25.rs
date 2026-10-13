//! `IndexTts25` engine: connects IndexTTS 2.5 (`mlx-community/IndexTTS-2.5-fp16`) to `TtsEngine`.
//!
//! Corresponds to the official `IndexTTS2.infer_v2_5`; differences from 2.0:
//! - Text: a 60,509-entry tiktoken multilingual vocabulary (zh / en / ja / es / ar); each segment carries a `<|lang|> `
//!   prefix, and the language id is added to the text positions via `lang_embedding` ([`crate::synthesize::index_tts2::v25::frontend`]).
//! - GPT conditioning: `[spk_emb_proj(CAM++ style) + emotion vector, 0, 0]`; there is no voice conformer / perceiver or speed embedding, and the GPT latent is no longer
//!   added to the S2Mel content features.
//! - The semantic codes go through `codec.decode` (codebook → Vocos backbone → ×2 upsampling) to give 50 Hz content features, length-normalized to
//!   `floor(2N × 1.72 / speaking rate)` frames (`--speed`, default 1). The prompt conditioning is normalized directly from the reference audio's w2v-BERT
//!   hidden states, without MaskGCT quantization.
//!
//! w2v-BERT / CAM++ / BigVGAN / statistics and the emotion feature tables are byte-for-byte identical to 2.0 and are not in the 2.5 repository: the model package
//! has an extra `aux` component (the whole `aufklarer/IndexTTS2-MLX-fp16` repository, shared with the IndexTTS2 model package), from whose manifest the weights under
//! `aux/` and the three statistics files are taken.

use super::conditioning::ReferenceConditioning;
use super::engine_impl::{
    S2MEL_STEPS, SharedAux, SharedAuxFiles, clone_reference, emotion_plan, generation_options, resolve_emotion, run_segments,
    speaking_rate, target_frames,
};
use super::gpt::{ABORT_MESSAGE, SemanticGpt};
use super::s2mel::S2Mel;
use super::semantic_codec::CodecDecoderV25;
use super::v25_weights;
use super::weights::WeightMap;
use crate::bundle::VerifiedFiles;
use crate::synthesize::index_tts2::config::RuntimeConfig;
use crate::synthesize::index_tts2::sampling::GenerationOptions;
use crate::synthesize::index_tts2::v25::frontend::{self, DEFAULT_MAX_SEGMENT_TOKENS};
use crate::synthesize::index_tts2::v25::tiktoken::TiktokenTokenizer;
use crate::synthesize::tensor::host::ModelMemoryCacheGuard;
use crate::synthesize::tensor::host::{clear_memory_cache, configure_memory_cache};
use crate::synthesize::tensor::{Array, Dtype};
use crate::synthesize::types::{TtsAudio, TtsEngineKind, TtsProgress, TtsRequest};
use crate::synthesize::{ProgressSink, TtsEngine};
use anyhow::{Context, Result, bail, ensure};

const ENGINE_NAME: &str = "IndexTTS 2.5";

pub struct IndexTts25 {
    config: RuntimeConfig,
    tokenizer: TiktokenTokenizer,
    gpt: SemanticGpt,
    s2mel: S2Mel,
    codec: CodecDecoderV25,
    aux: SharedAux,
    /// Last field: the weights are dropped first, then wait for the GPU and clear the cache.
    _cache_guard: ModelMemoryCacheGuard,
}

impl IndexTts25 {
    /// GPT → S2Mel → semantic codebook decoder → w2v-BERT → CAM++ → BigVGAN → statistics / emotion feature tables.
    ///
    /// `model` is 2.5's main model component and must include `config.yaml` (without it the tiktoken tokenizer cannot be identified); `aux` is the auxiliary weights
    /// component (from the IndexTTS2 repository). A missing file is `MODEL_NOT_INSTALLED`, reported before Metal is touched.
    pub fn load(model: &VerifiedFiles, aux: &VerifiedFiles) -> Result<Self> {
        Self::load_with_progress(model, aux, &mut |_| true)
    }

    pub fn load_with_progress(model: &VerifiedFiles, aux: &VerifiedFiles, progress: &mut dyn FnMut(TtsProgress) -> bool) -> Result<Self> {
        let config = RuntimeConfig::load(Some(model.require("config.yaml")?))?;
        ensure!(
            config.is_v25(),
            "not IndexTTS 2.5 weights (config.yaml has no tiktoken tokenizer); load them with the index-tts2 engine"
        );
        let vocabulary = model.require(&config.bpe_model)?;
        let gpt_file = model.require("gpt.safetensors")?;
        let s2mel_file = model.require("s2mel.safetensors")?;
        let codec_file = model.require("codec.safetensors")?;
        let aux_files = SharedAuxFiles::resolve(aux)?;

        configure_memory_cache()?;
        // Create the guard first: if any later step fails to load, unwinding will also wait for the GPU and clear the cache already allocated.
        let cache_guard = ModelMemoryCacheGuard;
        let tokenizer = TiktokenTokenizer::load(vocabulary).with_context(|| format!("failed to load {ENGINE_NAME} tokenizer {}", config.bpe_model))?;

        let mut stage = |name: &str| -> Result<()> {
            if !progress(TtsProgress::Loading { stage: name.to_string() }) {
                bail!(ABORT_MESSAGE);
            }
            Ok(())
        };

        stage("gpt")?;
        let gpt = SemanticGpt::load_v25(WeightMap::load_file(gpt_file)?, &config.gpt, config.semantic_codec.codebook_size)
            .with_context(|| format!("failed to load {ENGINE_NAME} GPT"))?;

        stage("s2mel")?;
        let mut s2mel_weights = WeightMap::load_file(s2mel_file)?;
        v25_weights::remap_s2mel(&mut s2mel_weights)?;
        let s2mel = S2Mel::load(s2mel_weights, config.s2mel.n_mels as i32).with_context(|| format!("failed to load {ENGINE_NAME} S2Mel"))?;

        stage("codec")?;
        let codec =
            CodecDecoderV25::load(WeightMap::load_file(codec_file)?).with_context(|| format!("failed to load {ENGINE_NAME} semantic codebook decoder"))?;

        let aux = SharedAux::load(aux_files, &config, &mut stage)?;
        clear_memory_cache()?;

        Ok(Self {
            config,
            tokenizer,
            gpt,
            s2mel,
            codec,
            aux,
            _cache_guard: cache_guard,
        })
    }

    /// Per segment: GPT generates semantic codes → the codebook decodes them into 50 Hz content features → length normalization → flow-matched mel → BigVGAN.
    fn synthesize_segment(
        &self,
        text_tokens: &[i32],
        language_id: usize,
        conditioning: &ReferenceConditioning,
        emotion: &Array,
        options: &GenerationOptions,
        rate: f32,
        token_progress: &mut dyn FnMut(usize) -> bool,
    ) -> Result<Vec<f32>> {
        let codes =
            self.gpt
                .generate_semantic_codes_v25(text_tokens, language_id, &conditioning.style, emotion, options, token_progress)?;
        if codes.is_empty() {
            bail!("{ENGINE_NAME} semantic GPT generated no speech tokens");
        }
        let content = self.codec.decode(&codes)?.as_dtype(Dtype::Float32)?; // [1, 2N, 1024]
        let generated_condition = self
            .s2mel
            .length_regulator
            .forward(&content, target_frames(content.dim(1) as usize, rate))?; // [1, target, 512]
        self.aux.render(&self.s2mel, &generated_condition, conditioning, S2MEL_STEPS)
    }
}

impl TtsEngine for IndexTts25 {
    fn kind(&self) -> TtsEngineKind {
        TtsEngineKind::IndexTts25
    }

    fn sample_rate(&self) -> u32 {
        self.config.output_sample_rate()
    }

    /// The model itself has no speaker table; what is exposed is the built-in voices bundled with the package (the values of `VoiceSpec::Preset`).
    fn preset_speakers(&self) -> Vec<String> {
        crate::synthesize::voices::ids()
    }

    fn synthesize(&mut self, request: &TtsRequest, progress: ProgressSink<'_>) -> Result<TtsAudio> {
        let reference_audio = clone_reference(request, ENGINE_NAME)?;
        let plan = emotion_plan(request.emotion.as_ref(), ENGINE_NAME)?;
        let options = generation_options(&request.sampling, ENGINE_NAME)?;
        let rate = speaking_rate(request.speed, ENGINE_NAME)?;
        let prepared = frontend::prepare(
            &request.text,
            request.language.as_deref(),
            &self.tokenizer,
            DEFAULT_MAX_SEGMENT_TOKENS,
        )
        .with_context(|| format!("{ENGINE_NAME} text frontend"))?;

        let conditioning = self
            .aux
            .prepare_conditioning(&self.config, &self.s2mel, None, &reference_audio, &plan, &mut *progress)?;
        let engine = &*self;
        let emotion = resolve_emotion(&engine.gpt, &conditioning, &plan)?;

        run_segments(
            prepared.token_ids.len(),
            engine.config.output_sample_rate(),
            progress,
            |index, token_progress| {
                let text_tokens: Vec<i32> = prepared.token_ids[index].iter().map(|&id| id as i32).collect();
                engine.synthesize_segment(
                    &text_tokens,
                    prepared.language_id,
                    &conditioning,
                    &emotion,
                    &options,
                    rate,
                    token_progress,
                )
            },
        )
    }
}
