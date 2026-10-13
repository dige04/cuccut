//! Reference audio conditioning (corresponds to `infer()` in the official `infer_v2.py` / `infer_v2_5.py`).
//!
//! Before a synthesis, compute from the voice reference (and the optional emotion reference) audio all the conditioning that GPT / S2Mel needs:
//! the layer-17 hidden states of w2v-BERT (voice / emotion), semantic codebook quantized embeddings, prompt mel spectrogram, length-normalized prompt conditioning,
//! the CAM++ style vector, and the optional explicit 8-dimensional emotion vector.
//!
//! Audio is read as in the official code: the voice reference is loaded at 22050 Hz and trimmed to 15 seconds (the `librosa.load` default; decoded at its native
//! sample rate, then resampled with [`dsp::librosa_resample`], which is fitted to soxr_hq); the mel spectrogram uses this. w2v-BERT and CAM++ use a version
//! downsampled to 16 kHz via [`dsp::torchaudio_resample`]. The emotion reference (when absent, it is the voice reference file itself) is loaded separately at 16 kHz
//! and passed through w2v-BERT on its own.
//! When an explicit emotion vector is given, the emotion reference audio is not used.
//!
//! The reference audio is a [`ReferenceAudio`]: either a file supplied by the caller, or a built-in voice's bundled recording (decoded in memory, never written to disk).

use super::campplus::CampPlus;
use super::s2mel::S2Mel;
use super::semantic_codec::SemanticCodec;
use super::w2v_bert::Wav2Vec2Bert;
use crate::synthesize::index_tts2::config::RuntimeConfig;
use crate::synthesize::index_tts2::dsp::{self, SEAMLESS_FEATURE_DIM, SEAMLESS_FRAME_LENGTH, SlaneyMelConfig};
use crate::synthesize::index_tts2::emotion::{self, EmotionControl};
use crate::synthesize::tensor::Array;
use crate::synthesize::voices::{self, ReferenceAudio};
use crate::synthesize::wav::decode_wav_pcm16;
use anyhow::{Context, Result, bail};
use std::path::PathBuf;
use std::time::SystemTime;

/// Reference audio is capped at 15 seconds (official `_load_and_cut_audio(…, 15)`).
pub const MAX_REFERENCE_SECONDS: usize = 15;

/// Reference conditioning shared by one synthesis. The parts derived from audio are cached across syntheses by [`ConditioningKey`]
/// ([`ConditioningCache`]); `explicit_emotion` is computed per request.
#[derive(Clone)]
pub struct ReferenceConditioning {
    /// Voice reference w2v-BERT hidden states `[1, T, 1024]` (f32), the official `spk_cond_emb`.
    pub speaker_hidden: Array,
    /// Emotion reference hidden states `[1, T', 1024]`, the official `emo_cond_emb` (read directly at 16 kHz; computed separately even when it is the same file as the voice reference).
    pub emotion_hidden: Array,
    /// Prompt mel spectrogram `[1, 80, Tp]`.
    pub prompt_mel: Array,
    /// Length-normalized prompt conditioning `[1, Tp, 512]`.
    pub prompt_condition: Array,
    /// CAM++ style vector `[1, 192]`.
    pub style: Array,
    /// Explicit emotion vector `[1, 1280]` and its weight sum (present only when an `EmotionControl` is given).
    pub explicit_emotion: Option<(Array, f32)>,
}

/// Models and statistics needed to compute the conditioning (held by the engine, borrowed by reference).
pub struct ConditioningModels<'a> {
    pub config: &'a RuntimeConfig,
    pub w2v_bert: &'a Wav2Vec2Bert,
    /// MaskGCT semantic codebook (2.0); `None` for IndexTTS 2.5, where the prompt conditioning is normalized directly from the hidden states.
    pub semantic_codec: Option<&'a SemanticCodec>,
    pub campplus: &'a CampPlus,
    pub s2mel: &'a S2Mel,
    /// w2v-BERT hidden-state statistics `[1024]` (host f32).
    pub w2v_mean: &'a [f32],
    pub w2v_var: &'a [f32],
    /// Row-major data of `feat1.safetensors`, `[73, 192]`.
    pub speaker_rows: &'a [f32],
    /// Row-major data of `feat2.safetensors`, `[73, 1280]`.
    pub emotion_rows: &'a [f32],
}

/// Explicit emotion vector `[1, 1280]` and its weight sum; `None` when no `control` is given. Depends only on the style vector and the two feature tables,
/// so it is still computed on a cache hit.
pub fn explicit_emotion(
    config: &RuntimeConfig,
    speaker_rows: &[f32],
    emotion_rows: &[f32],
    control: Option<&EmotionControl>,
    style: &Array,
) -> Result<Option<(Array, f32)>> {
    let Some(control) = control else {
        return Ok(None);
    };
    let style_host: Vec<f32> = style.as_slice::<f32>().to_vec();
    let (vector, weight_sum) = emotion::explicit_emotion_vector(
        control,
        &style_host,
        speaker_rows,
        emotion_rows,
        &config.emo_num,
        style_host.len(),
        config.gpt.model_dim,
    )?;
    let dim = vector.len() as i32;
    Ok(Some((Array::from_slice(&vector, &[1, dim]), weight_sum)))
}

/// The actual source of the emotion reference during conditioning preparation: when an explicit emotion vector is given, the voice reference is used;
/// otherwise the emotion reference audio is used, and by default it is also the voice reference.
pub fn emotion_source<'p>(
    reference_audio: &'p ReferenceAudio,
    emotion_audio: Option<&'p ReferenceAudio>,
    emotion_control: Option<&EmotionControl>,
) -> &'p ReferenceAudio {
    if emotion_control.is_some() {
        reference_audio
    } else {
        emotion_audio.unwrap_or(reference_audio)
    }
}

/// Identity of one reference audio. File: path + length + modification time; a file at the same path that is rewritten counts as a new file.
/// Built-in voice: the voice id (the recording is compiled into the package and never changes).
#[derive(Clone, Debug, PartialEq, Eq)]
enum AudioIdentity {
    File {
        path: PathBuf,
        len: u64,
        modified: Option<SystemTime>,
    },
    Builtin(&'static str),
}

impl AudioIdentity {
    fn of(audio: &ReferenceAudio) -> Option<Self> {
        match audio {
            ReferenceAudio::File(path) => {
                let meta = std::fs::metadata(path).ok()?;
                Some(Self::File {
                    path: path.clone(),
                    len: meta.len(),
                    modified: meta.modified().ok(),
                })
            }
            ReferenceAudio::Builtin(id) => Some(Self::Builtin(id)),
        }
    }
}

/// Cache key of the reference conditioning: voice reference + emotion source. The explicit emotion vector is not part of the key (computed per request).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConditioningKey {
    reference: AudioIdentity,
    emotion: AudioIdentity,
}

impl ConditioningKey {
    /// If the metadata of any file cannot be read, returns `None`: nothing is cached, so conditioning preparation reports its errors as usual.
    pub fn new(reference_audio: &ReferenceAudio, emotion_source: &ReferenceAudio) -> Option<Self> {
        Some(Self {
            reference: AudioIdentity::of(reference_audio)?,
            emotion: AudioIdentity::of(emotion_source)?,
        })
    }
}

/// Maximum number of reference conditionings to keep. Each holds two `[1, ≤750, 1024]` f32 hidden-state segments plus the prompt mel / conditioning,
/// about 10 MB; dubbing fetches references per speaker, so 8 entries are enough to switch back and forth in a multi-speaker film.
pub const CONDITIONING_CACHE_CAPACITY: usize = 8;

/// Recently used reference conditionings (LRU). In batch synthesis of the same voice, w2v-BERT runs only once and need not stay resident.
pub struct ConditioningCache<V> {
    entries: Vec<(ConditioningKey, V)>,
    capacity: usize,
}

impl<V: Clone> ConditioningCache<V> {
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: Vec::new(),
            capacity: capacity.max(1),
        }
    }

    /// On a hit, move this entry to the most-recent end and return a copy.
    pub fn get(&mut self, key: &ConditioningKey) -> Option<V> {
        let index = self.entries.iter().position(|(k, _)| k == key)?;
        let entry = self.entries.remove(index);
        let value = entry.1.clone();
        self.entries.push(entry);
        Some(value)
    }

    /// Insert (overwriting the same key); when over capacity, evict the least recently used entry.
    pub fn insert(&mut self, key: ConditioningKey, value: V) {
        self.entries.retain(|(k, _)| k != &key);
        if self.entries.len() >= self.capacity {
            self.entries.remove(0);
        }
        self.entries.push((key, value));
    }
}

/// Default sample rate of the official `librosa.load(path)` when `sr` is not given.
const LIBROSA_DEFAULT_SAMPLE_RATE: u32 = 22_050;

/// Reads mono reference audio and trims it to 15 seconds.
pub fn load_clipped_audio(audio: &ReferenceAudio, sample_rate: u32) -> Result<Vec<f32>> {
    // As with `librosa.load(path, sr=…)`: decode to mono at the native sample rate, then resample to the target rate with a resampler fitted to soxr_hq.
    // If the native rate cannot be detected, decode at 48 kHz first and then resample. Only the first 16 seconds are read: the extra second gives the
    // resampling kernel real samples on both sides at the 15-second truncation point.
    let (mut decoded, native) = decode_native(audio)?;
    decoded.truncate(native as usize * (MAX_REFERENCE_SECONDS + 1));
    let mut samples = dsp::librosa_resample(&decoded, native, sample_rate);
    let max_samples = sample_rate as usize * MAX_REFERENCE_SECONDS;
    if samples.len() > max_samples {
        samples.truncate(max_samples);
    }
    Ok(samples)
}

/// Intermediate decode sample rate used when the native rate cannot be detected.
const FALLBACK_DECODE_RATE: u32 = 48_000;

/// Decodes to mono at the native sample rate, returning samples and rate. File: WAV reads the rate from the file header; other formats are not probed
/// and are decoded via ffmpeg to [`FALLBACK_DECODE_RATE`]. Built-in voice: the bundled recording (16 kHz) is decoded in memory.
fn decode_native(audio: &ReferenceAudio) -> Result<(Vec<f32>, u32)> {
    match audio {
        ReferenceAudio::File(path) => {
            let native = hound::WavReader::open(path)
                .ok()
                .map(|reader| reader.spec().sample_rate)
                .filter(|rate| *rate > 0)
                .unwrap_or(FALLBACK_DECODE_RATE);
            let decoded = crate::audio::decode_mono(path, native).with_context(|| format!("解码参考音频 {} 失败", path.display()))?;
            Ok((decoded, native))
        }
        ReferenceAudio::Builtin(id) => {
            let voice = voices::find(id).with_context(|| format!("没有内置音色 {id}"))?;
            decode_wav_pcm16(voices::wav(voice))
        }
    }
}

/// How a reference audio is referred to in error messages.
fn describe(audio: &ReferenceAudio) -> String {
    match audio {
        ReferenceAudio::File(path) => path.display().to_string(),
        ReferenceAudio::Builtin(id) => format!("内置音色 {id}"),
    }
}

/// SeamlessM4T front-end features `[1, frames, 160]`; if there is less than one frame, reports “参考太短” (reference too short).
fn semantic_front_end_features(audio_16k: &[f32], source: &ReferenceAudio) -> Result<Array> {
    if audio_16k.len() < SEAMLESS_FRAME_LENGTH {
        bail!(
            "参考音频 {} 太短（{} 个采样，至少需要 {} 个）",
            describe(source),
            audio_16k.len(),
            SEAMLESS_FRAME_LENGTH
        );
    }
    let (features, frames) = dsp::seamless_input_features(audio_16k);
    if frames == 0 {
        bail!("参考音频 {} 太短，无法提取前端特征", describe(source));
    }
    Ok(Array::from_slice(&features, &[1, frames as i32, SEAMLESS_FEATURE_DIM as i32]))
}

impl<'a> ConditioningModels<'a> {
    /// `(hidden − mean) / sqrt(var)`, same as Swift `normalizeSemanticHidden`.
    fn normalize_semantic_hidden(&self, hidden: &Array) -> Result<Array> {
        let dim = self.w2v_mean.len() as i32;
        let mean = Array::from_slice(self.w2v_mean, &[1, 1, dim]);
        let std = Array::from_slice(self.w2v_var, &[1, 1, dim]).sqrt()?;
        Ok((hidden - mean) / std)
    }

    /// 16 kHz audio → normalized layer-17 w2v-BERT hidden states `[1, T, 1024]`.
    fn semantic_hidden(&self, audio_16k: &[f32], source: &ReferenceAudio) -> Result<Array> {
        let features = semantic_front_end_features(audio_16k, source)?;
        let hidden = self.w2v_bert.hidden_state_17(&features)?;
        let normalized = self.normalize_semantic_hidden(&hidden)?;
        normalized.eval()?;
        Ok(normalized)
    }

    /// Prompt mel spectrogram `[1, 80, Tp]`: first a custom reflection padding of `(n_fft − hop)/2`, then the Slaney log-mel
    /// (fmin 0, fmax sr/2, magnitude spectrum, floor 1e-5, no center, periodic Hann).
    fn prompt_mel(&self, audio_22k: &[f32]) -> Result<Array> {
        let s2mel = &self.config.s2mel;
        let pad = (s2mel.n_fft - s2mel.hop_length) / 2;
        let padded = dsp::prompt_reflect_pad(audio_22k, pad);
        let cfg = SlaneyMelConfig {
            sample_rate: s2mel.sample_rate,
            n_fft: s2mel.n_fft,
            hop: s2mel.hop_length,
            win: s2mel.win_length,
            n_mels: s2mel.n_mels,
            fmin: 0.0,
            fmax: s2mel.sample_rate as f32 / 2.0,
            power: 1.0,
            log_mel: true,
            log_floor: 1e-5,
            center_pad: false,
            periodic_hann: true,
        };
        let (mel, frames) = dsp::slaney_mel(&padded, &cfg);
        if frames == 0 {
            bail!("参考音频太短，无法提取提示梅尔谱");
        }
        let mel = Array::from_slice(&mel, &[frames as i32, s2mel.n_mels as i32]);
        Ok(mel.t().expand_dims(0)?)
    }

    /// Corresponds to the conditioning-preparation section of the official `infer()`.
    ///
    /// `emotion_audio`: emotion reference audio; ignored when `emotion_control` is given. By default the voice reference file also serves as the emotion reference.
    /// `progress` returning false means cancel.
    pub fn prepare(
        &self,
        reference_audio: &ReferenceAudio,
        emotion_audio: Option<&ReferenceAudio>,
        emotion_control: Option<&EmotionControl>,
        progress: &mut dyn FnMut(f32, &str) -> bool,
    ) -> Result<ReferenceConditioning> {
        if !progress(0.05, "读取参考音频") {
            bail!(super::gpt::ABORT_MESSAGE);
        }
        let loaded = load_clipped_audio(reference_audio, LIBROSA_DEFAULT_SAMPLE_RATE)?;
        let reference_16k = dsp::torchaudio_resample(&loaded, LIBROSA_DEFAULT_SAMPLE_RATE, dsp::SEAMLESS_SAMPLE_RATE);
        let reference_22k = dsp::torchaudio_resample(&loaded, LIBROSA_DEFAULT_SAMPLE_RATE, self.config.s2mel.sample_rate);

        if !progress(0.25, "提取音色语义特征") {
            bail!(super::gpt::ABORT_MESSAGE);
        }
        let speaker_hidden = self.semantic_hidden(&reference_16k, reference_audio)?;
        // 2.0 quantizes the hidden states into MaskGCT embeddings before building the prompt conditioning; the official `infer_v2_5` uses the hidden states directly.
        let prompt_content = match self.semantic_codec {
            Some(codec) => {
                let encoded = codec.encoder.forward(&speaker_hidden)?;
                codec.quantizer.quantize(&encoded)?.1
            }
            None => speaker_hidden.clone(),
        };

        if !progress(0.55, "提取情感特征") {
            bail!(super::gpt::ABORT_MESSAGE);
        }
        let emotion_source = emotion_source(reference_audio, emotion_audio, emotion_control);
        let emotion_16k = load_clipped_audio(emotion_source, dsp::SEAMLESS_SAMPLE_RATE)?;
        let emotion_hidden = self.semantic_hidden(&emotion_16k, emotion_source)?;

        if !progress(0.75, "计算提示梅尔谱与风格向量") {
            bail!(super::gpt::ABORT_MESSAGE);
        }
        let prompt_mel = self.prompt_mel(&reference_22k)?;
        let prompt_frames = prompt_mel.dim(2);
        let prompt_condition = self.s2mel.length_regulator.forward(&prompt_content, prompt_frames)?;
        let style = self.campplus.inference(&reference_16k)?;

        style.eval()?;
        let explicit_emotion = explicit_emotion(self.config, self.speaker_rows, self.emotion_rows, emotion_control, &style)?;

        prompt_mel.eval()?;
        prompt_condition.eval()?;
        if !progress(1.0, "参考条件就绪") {
            bail!(super::gpt::ABORT_MESSAGE);
        }
        Ok(ReferenceConditioning {
            speaker_hidden,
            emotion_hidden,
            prompt_mel,
            prompt_condition,
            style,
            explicit_emotion,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::path::Path;

    fn file(dir: &Path, name: &str, bytes: &[u8]) -> ReferenceAudio {
        let path = dir.join(name);
        std::fs::write(&path, bytes).unwrap();
        ReferenceAudio::File(path)
    }

    #[test]
    fn conditioning_cache_evicts_the_least_recently_used_entry() {
        let dir = tempfile::tempdir().unwrap();
        let a = file(dir.path(), "a.wav", b"a");
        let b = file(dir.path(), "b.wav", b"b");
        let c = file(dir.path(), "c.wav", b"c");
        let key = |audio: &ReferenceAudio| ConditioningKey::new(audio, audio).unwrap();
        let mut cache = ConditioningCache::new(2);
        cache.insert(key(&a), 1);
        cache.insert(key(&b), 2);
        assert_eq!(cache.get(&key(&a)), Some(1), "命中后 a 变成最近用过");
        cache.insert(key(&c), 3);
        assert_eq!(cache.get(&key(&b)), None, "淘汰最久没用的 b");
        assert_eq!(cache.get(&key(&a)), Some(1));
        assert_eq!(cache.get(&key(&c)), Some(3));
        cache.insert(key(&c), 4);
        assert_eq!(cache.entries.len(), 2, "同键覆盖不占新位");
        assert_eq!(cache.get(&key(&c)), Some(4));
    }

    #[test]
    fn conditioning_key_tracks_the_emotion_source_and_file_contents() {
        let dir = tempfile::tempdir().unwrap();
        let voice = file(dir.path(), "voice.wav", b"voice");
        let mood = file(dir.path(), "mood.wav", b"mood");
        assert_ne!(
            ConditioningKey::new(&voice, &voice),
            ConditioningKey::new(&voice, &mood),
            "情感参考不同就是不同的条件"
        );
        let before = ConditioningKey::new(&voice, &voice).unwrap();
        let ReferenceAudio::File(path) = &voice else { unreachable!() };
        std::fs::write(path, b"re-recorded voice").unwrap();
        assert_ne!(ConditioningKey::new(&voice, &voice), Some(before), "同一路径改写后不能命中旧条件");
        assert_eq!(
            ConditioningKey::new(&ReferenceAudio::File(dir.path().join("missing.wav")), &voice),
            None,
            "读不到文件就不缓存"
        );
        // Built-in voices are identified by id and do not touch the file system.
        let builtin = ReferenceAudio::Builtin("zh-female");
        assert_eq!(ConditioningKey::new(&builtin, &builtin), ConditioningKey::new(&builtin, &builtin));
        assert!(ConditioningKey::new(&builtin, &builtin).is_some());
        assert_ne!(
            ConditioningKey::new(&builtin, &builtin),
            ConditioningKey::new(&ReferenceAudio::Builtin("en-male"), &ReferenceAudio::Builtin("en-male"))
        );
    }

    #[test]
    fn explicit_emotion_uses_the_speaker_reference_as_emotion_source() {
        let voice = &ReferenceAudio::File("voice.wav".into());
        let mood = &ReferenceAudio::File("mood.wav".into());
        let control = EmotionControl::from_sliders([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8], 1.0).unwrap();
        assert_eq!(emotion_source(voice, Some(mood), None), mood);
        assert_eq!(emotion_source(voice, None, None), voice);
        assert_eq!(emotion_source(voice, Some(mood), Some(&control)), voice);
    }
}
