//! Request / result / progress types for speech synthesis. The engine and the upper layer (the Worker's task orchestration) communicate only through here.
//!
//! Ported from v2 `ccut-tts-core::types`; only the parts the local engines need are kept. Cloud engines, engines the product no longer supports, synthesis receipts, “My voice” (the voice library is resolved in the Runtime into reference audio + original text, so the engine only sees [`VoiceSpec::Clone`]), and knobs used only by the cloud are not brought over. The request family keeps v2's serde shape (the `kind` tag, field casing); the on-wire shape is decided by the protocol at wiring time.

use super::readings::Reading;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Kinds of local speech synthesis engines; each is wired in as its porting batch lands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TtsEngineKind {
    /// Qwen3-TTS 12 Hz (Base: cloning; CustomVoice: preset speakers + instructions; VoiceDesign: generates a voice from a one-sentence description).
    Qwen3Tts,
    /// IndexTTS2 (reference-audio cloning + emotion control, 22.05 kHz).
    IndexTts2,
    /// IndexTTS 2.5 (tiktoken multilingual zh/en/ja/es/ar, reference-audio cloning + emotion control, 22.05 kHz).
    #[serde(rename = "index-tts2.5")]
    IndexTts25,
    /// GPT-SoVITS v2 (reference-audio cloning; reference text optional; 32 kHz).
    GptSovits,
    /// VoxCPM2 (MiniCPM4 backbone + local diffusion + AudioVAE, continuous representation without a tokenizer; cloning + style instructions, 48 kHz).
    #[serde(rename = "voxcpm2")]
    VoxCpm2,
    /// OmniVoice (masked discrete diffusion on a Qwen3 backbone; voice description / cloning / duration and speaking-rate control, 24 kHz).
    #[serde(rename = "omnivoice")]
    OmniVoice,
}

impl TtsEngineKind {
    /// All local engines, in declaration order.
    pub const ALL: [TtsEngineKind; 6] = [
        Self::Qwen3Tts,
        Self::IndexTts2,
        Self::IndexTts25,
        Self::GptSovits,
        Self::VoxCpm2,
        Self::OmniVoice,
    ];

    /// Inverse of [`Self::as_str`]; returns `None` for unrecognized names.
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.as_str() == value)
    }

    /// The family of the `tts` component in a model package (Model Worker protocol spec §4.1). Not entirely the same as [`Self::as_str`] (`indextts2` vs `index-tts2`).
    pub const fn family(self) -> &'static str {
        use crate::bundle::{FAMILY_GPT_SOVITS, FAMILY_INDEXTTS2, FAMILY_INDEXTTS25, FAMILY_OMNIVOICE, FAMILY_QWEN3_TTS, FAMILY_VOXCPM2};
        match self {
            Self::Qwen3Tts => FAMILY_QWEN3_TTS,
            Self::IndexTts2 => FAMILY_INDEXTTS2,
            Self::IndexTts25 => FAMILY_INDEXTTS25,
            Self::GptSovits => FAMILY_GPT_SOVITS,
            Self::VoxCpm2 => FAMILY_VOXCPM2,
            Self::OmniVoice => FAMILY_OMNIVOICE,
        }
    }

    /// Inverse of [`Self::family`]; returns `None` for a family that is not the main synthesis model's family.
    pub fn from_family(family: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.family() == family)
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Qwen3Tts => "qwen3-tts",
            Self::IndexTts2 => "index-tts2",
            Self::IndexTts25 => "index-tts2.5",
            Self::GptSovits => "gpt-sovits",
            Self::VoxCpm2 => "voxcpm2",
            Self::OmniVoice => "omnivoice",
        }
    }

    /// Output-semantics version: incremented when the same request (text / voice / sampling / seed) may produce different audio in the new version.
    ///
    /// - Qwen3-TTS 2: the lower bound of the token cap goes from 75 to 125 frames; segments that were previously truncated must be re-synthesized.
    /// - Qwen3-TTS 3: annotations are rendered as a homophone representative character; previously `<字|读音>` was passed to the tokenizer as-is.
    /// - IndexTTS2 2: annotations are rendered as the vocabulary's pinyin pieces, and number normalization protects the pinyin pieces.
    /// - Qwen3-TTS 4, VoxCPM2 2: in multi-chunk synthesis, chunk boundaries have leading and trailing silence removed, fixed pauses inserted, and loudness aligned to the first chunk (`synthesize::stitch`).
    pub const fn output_revision(self) -> u32 {
        match self {
            Self::Qwen3Tts => 4,
            Self::IndexTts2 | Self::VoxCpm2 => 2,
            Self::IndexTts25 | Self::GptSovits | Self::OmniVoice => 1,
        }
    }

    /// How this engine consumes `<字|读音>` annotations (architecture design §6.1: the adapter converts them into each model's own notation; when unsupported, report it honestly).
    /// A newly added engine must give a value here and add a line to `readings::tests::DOC_TABLE`.
    pub const fn readings_support(self) -> ReadingsSupport {
        match self {
            Self::Qwen3Tts => ReadingsSupport::Homophone,
            Self::IndexTts2 => ReadingsSupport::InlinePinyin,
            Self::IndexTts25 => ReadingsSupport::Annotated,
            Self::GptSovits => ReadingsSupport::Unsupported,
            // None of the official releases has a reading channel (upstream README); the surface text is sent as-is.
            Self::VoxCpm2 | Self::OmniVoice => ReadingsSupport::Unsupported,
        }
    }

    /// The engine's native output sample rate (Hz).
    pub const fn native_sample_rate(self) -> u32 {
        match self {
            Self::Qwen3Tts => 24_000,
            Self::IndexTts2 | Self::IndexTts25 => 22_050,
            Self::GptSovits => 32_000,
            Self::VoxCpm2 => 48_000,
            Self::OmniVoice => 24_000,
        }
    }
}

/// How an engine consumes readings (a newly added engine must give a value in [`TtsEngineKind::readings_support`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReadingsSupport {
    /// Sends `<表面|读音>` as-is: the IndexTTS 2.5 front end accepts this syntax.
    Annotated,
    /// Replaces the character with the uppercase pinyin piece from the vocabulary (`XING2`): IndexTTS2, upstream “Pinyin control”.
    InlinePinyin,
    /// Replaces with a common character that has the same reading and is not itself a polyphone: Qwen3-TTS (the official release has no reading channel;
    /// comparing v2 real weights + ASR beat writing pinyin in the body text). Annotations from the phrase table are not replaced.
    Homophone,
    /// Does not recognize readings: sends the surface text, and all annotations are reported as `dropped`. Its on-wire name is `none` (`unsupported` is an error kind and is not used as a capability value).
    #[serde(rename = "none")]
    Unsupported,
}

impl ReadingsSupport {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Annotated => "annotated",
            Self::InlinePinyin => "inline-pinyin",
            Self::Homophone => "homophone",
            Self::Unsupported => "none",
        }
    }
}

/// What voice to speak with.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum VoiceSpec {
    /// The engine's default voice (CustomVoice picks a speaker by language; engines that can only clone pick a built-in voice by language).
    Default,
    /// A preset speaker (such as `Vivian` or `Ryan` for Qwen3-TTS CustomVoice) or a built-in voice id (such as `zh-female`).
    Preset { speaker: String },
    /// Clones the voice from reference audio; `reference_text` is the transcript of the reference audio. Qwen3-TTS ICL
    /// mode needs it (when absent, only the x-vector is used); IndexTTS2 ignores it.
    Clone {
        reference_audio: PathBuf,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reference_text: Option<String>,
    },
}

/// Sampling parameters; `None` uses each engine's recommended defaults.
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamplingOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_k: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repetition_penalty: Option<f32>,
    /// Maximum number of speech tokens generated per text chunk; `None` uses the engine default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<usize>,
    /// Random seed; `None` means a different result each time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    /// Classifier-free guidance strength (VoxCPM2 / OmniVoice; the official default for both is 2.0); `None` uses the engine default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cfg: Option<f32>,
    /// Number of diffusion / iterative decoding steps (VoxCPM2 default 10, OmniVoice default 32); `None` uses the engine default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steps: Option<usize>,
}

/// Default value of the “emotion weight” on IndexTTS's official web page (the `emo_weight` slider in `webui.py`): both the mixing coefficient of the emotion reference audio
/// and the scaling of the emotion vector use it (official `infer(emo_alpha=…)`).
pub const DEFAULT_EMOTION_ALPHA: f32 = 0.65;

fn default_emotion_alpha() -> f32 {
    DEFAULT_EMOTION_ALPHA
}

/// IndexTTS2 / IndexTTS 2.5 emotion control. Parameter semantics follow the official web page (`webui.py`):
/// the emotion reference audio is mixed with the voice reference by `alpha`; the emotion vector is eight 0–1 sliders, and the engine first adds a bias per the official
/// `normalize_emo_vec`, scales the total to within 0.8, and then multiplies by `alpha`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum EmotionSpec {
    /// Takes the emotion from another reference audio clip.
    Audio { reference_audio: PathBuf, alpha: f32 },
    /// Eight-dimensional emotion sliders (happy, angry, sad, afraid, disgusted, melancholic, surprised, calm),
    /// each 0–1; `alpha` is the emotion weight; when omitted, [`DEFAULT_EMOTION_ALPHA`] is used.
    Vector {
        weights: [f32; 8],
        #[serde(default = "default_emotion_alpha")]
        alpha: f32,
    },
}

/// One synthesis request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsRequest {
    pub text: String,
    /// BCP-47-style language code (`zh`, `en`, `ja`, …); `None` lets the engine detect it automatically.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub voice: VoiceSpec,
    /// Natural-language instruction: for Qwen3-TTS CustomVoice / VoxCPM2 it is a style (such as “用兴奋的语气”, “in an excited tone”),
    /// for Qwen3-TTS VoiceDesign / OmniVoice it is a voice description.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruct: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emotion: Option<EmotionSpec>,
    /// Target audio duration (seconds). OmniVoice uses it to determine the target token count; dubbing for translation should pass the length of the time slot.
    /// Other autoregressive engines currently ignore this field.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_duration_seconds: Option<f64>,
    #[serde(default)]
    pub sampling: SamplingOptions,
    /// Speaking-rate multiplier (IndexTTS 2.5 and OmniVoice); other local engines do not accept it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>,
}

impl TtsRequest {
    pub fn new(text: impl Into<String>, voice: VoiceSpec) -> Self {
        Self {
            text: text.into(),
            language: None,
            voice,
            instruct: None,
            emotion: None,
            target_duration_seconds: None,
            sampling: SamplingOptions::default(),
            speed: None,
        }
    }
}

/// Synthesis result: mono f32 PCM, range [-1, 1].
#[derive(Debug, Clone, Default, PartialEq)]
pub struct TtsAudio {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    /// Readings in the request text that could not be spoken as annotated (the engine does not recognize them, the vocabulary has no such piece, there is no representative character, or the annotation is malformed).
    /// The offset falls on the surface text with annotations removed. Filled in by the wrapper layer of [`crate::synthesize::load`]
    /// ([`crate::synthesize::readings::Annotating`]); left empty when an engine constructs it itself.
    pub readings_dropped: Vec<Reading>,
}

impl TtsAudio {
    pub fn duration_seconds(&self) -> f64 {
        self.samples.len() as f64 / f64::from(self.sample_rate)
    }

    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }
}

/// Synthesis progress event. A callback returning `false` means cancel.
#[derive(Debug, Clone, PartialEq)]
pub enum TtsProgress {
    /// Loading weights or reference audio.
    Loading { stage: String },
    /// Starting text chunk `index` (0-based, out of `count` total).
    ChunkStarted { index: usize, count: usize },
    /// Number of speech tokens generated so far for the current chunk.
    Tokens { index: usize, generated: usize },
    /// The current chunk has finished decoding to a waveform; cumulative generated audio seconds.
    ChunkFinished { index: usize, seconds: f64 },
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// The serde shape of the request family is carried over from v2: changing serde attributes (the `kind` tag, field casing, the rename of `index-tts2.5`) will turn red here first.
    #[test]
    fn request_wire_shape_is_pinned() {
        let request = TtsRequest {
            text: "你好".to_owned(),
            language: Some("zh".to_owned()),
            voice: VoiceSpec::Clone {
                reference_audio: PathBuf::from("/r.wav"),
                reference_text: Some("参考".to_owned()),
            },
            instruct: Some("calm".to_owned()),
            emotion: Some(EmotionSpec::Vector {
                weights: [0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                alpha: 0.25,
            }),
            target_duration_seconds: Some(2.5),
            sampling: SamplingOptions {
                temperature: Some(0.5),
                top_k: Some(20),
                seed: Some(7),
                ..SamplingOptions::default()
            },
            speed: None,
        };
        let wire = json!({
            "text": "你好",
            "language": "zh",
            "voice": {"kind": "clone", "reference_audio": "/r.wav", "reference_text": "参考"},
            "instruct": "calm",
            "emotion": {"kind": "vector", "weights": [0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "alpha": 0.25},
            "targetDurationSeconds": 2.5,
            "sampling": {"temperature": 0.5, "topK": 20, "seed": 7},
        });
        assert_eq!(serde_json::to_value(&request).unwrap(), wire);
        assert_eq!(serde_json::from_value::<TtsRequest>(wire).unwrap(), request);

        let minimal = TtsRequest::new(
            "hi",
            VoiceSpec::Preset {
                speaker: "zh-female".to_owned(),
            },
        );
        assert_eq!(
            serde_json::to_value(&minimal).unwrap(),
            json!({"text": "hi", "voice": {"kind": "preset", "speaker": "zh-female"}, "sampling": {}})
        );
        assert_eq!(serde_json::to_value(VoiceSpec::Default).unwrap(), json!({"kind": "default"}));
        assert_eq!(
            serde_json::to_value(EmotionSpec::Audio {
                reference_audio: PathBuf::from("/e.wav"),
                alpha: 1.0
            })
            .unwrap(),
            json!({"kind": "audio", "reference_audio": "/e.wav", "alpha": 1.0})
        );
        let kinds = [
            (TtsEngineKind::Qwen3Tts, "qwen3-tts"),
            (TtsEngineKind::IndexTts2, "index-tts2"),
            (TtsEngineKind::IndexTts25, "index-tts2.5"),
            (TtsEngineKind::GptSovits, "gpt-sovits"),
            (TtsEngineKind::VoxCpm2, "voxcpm2"),
            (TtsEngineKind::OmniVoice, "omnivoice"),
        ];
        for (kind, wire) in kinds {
            assert_eq!(serde_json::to_value(kind).unwrap(), json!(wire));
            assert_eq!(kind.as_str(), wire);
            assert_eq!(TtsEngineKind::from_str(wire), Some(kind));
        }
        assert_eq!(TtsEngineKind::from_str("unknown-engine"), None);
        // Each family in a model package corresponds one-to-one with an engine (the family list in protocol spec §4.1).
        let families = ["qwen3-tts", "indextts2", "indextts2.5", "gpt-sovits", "voxcpm2", "omnivoice"];
        for (kind, family) in TtsEngineKind::ALL.into_iter().zip(families) {
            assert_eq!(kind.family(), family);
            assert_eq!(TtsEngineKind::from_family(family), Some(kind));
        }
        assert_eq!(TtsEngineKind::from_family("qwen3-tts-tokenizer"), None);
        assert_eq!(TtsEngineKind::from_family("index-tts2"), None);
        assert_eq!(TtsEngineKind::Qwen3Tts.native_sample_rate(), 24_000);
        assert_eq!(serde_json::to_value(ReadingsSupport::Unsupported).unwrap(), json!("none"));
        assert_eq!(serde_json::to_value(ReadingsSupport::InlinePinyin).unwrap(), json!("inline-pinyin"));
        for support in [
            ReadingsSupport::Annotated,
            ReadingsSupport::InlinePinyin,
            ReadingsSupport::Homophone,
            ReadingsSupport::Unsupported,
        ] {
            assert_eq!(serde_json::to_value(support).unwrap(), json!(support.as_str()));
        }
    }
}
