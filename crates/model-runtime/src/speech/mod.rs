//! Pure logic for speech recognition: no I/O, no dependency on an inference framework. Backends plug in via [`StreamingVad`] and [`SpeechRecognizer`] (models that segment audio themselves plug in via [`SegmentingRecognizer`]).
//!
//! `hint`, `moss_parse`, `refine`, `speaker_cluster`, `timestamp`, `vad_binarize` and the data contracts at the end of this file are ported verbatim from v2 `ccut-speech-core`; `moss_common` (MOSS chunked generation and repetition detection) and `moss_speakers` (cross-chunk speaker merging) are ported verbatim from v2 `ccut-speech` and `ccut-transcribe` (architecture design §6.5, §14). `pyannote_common` (Pyannote segment decoding and voiceprint clustering) is ported verbatim from v2 `ccut-speech`, and `speaker_projection` (speaker intervals → words) is ported verbatim from v2 `ccut-kernel` (§6.6).

pub mod align_common;
pub mod autolang;
pub mod decoding;
pub mod hint;
pub mod language;
pub mod mel;
pub mod moss_common;
pub mod moss_parse;
pub mod moss_speakers;
pub mod pyannote_common;
pub mod qwen3_asr;
pub mod refine;
pub mod segmenter;
pub mod speaker_cluster;
pub mod speaker_projection;
pub mod text_prep;
pub mod timestamp;
pub mod tokenizer;
pub mod vad_binarize;
pub mod vad_stream;
pub mod wespeaker_fbank;
pub mod whisper_decoding;
pub mod word_timing;

use serde::{Deserialize, Serialize};

pub use moss_parse::SpeakerRange;
pub use segmenter::SpeechSpan;
pub use vad_stream::{StreamingVad, VadConfig};

/// Parameters for one recognition.
#[derive(Debug, Clone, Copy, Default)]
pub struct RecognitionRequest<'a> {
    /// Canonical language code (`en`, `zh`, `yue`…); `None` leaves detection to the model.
    pub language: Option<&'a str>,
    /// Terminology and context hints, passed into the model's system segment.
    pub context: Option<&'a str>,
}

/// Result of one recognition.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Recognition {
    pub text: String,
    /// Language name reported by the model itself (Qwen3-ASR outputs `language English` when auto-detecting).
    pub language_name: Option<String>,
    /// Still looks like repetition after retrying with a repetition penalty.
    pub degenerate: bool,
}

/// One audio segment (16 kHz mono) → text.
pub trait SpeechRecognizer {
    fn recognize(&mut self, audio: &[f32], request: &RecognitionRequest<'_>) -> anyhow::Result<Recognition>;
}

/// Recognizer that segments audio itself (MOSS-Transcribe-Diarize): the whole audio (16 kHz mono) goes in, and rows with absolute times and possibly speaker labels come out. There is no VAD; chunking and sentence breaking are done by the model itself.
pub trait SegmentingRecognizer {
    /// `language` is the asserted canonical language code; `None` leaves the judgment to the model. The error returned on cancellation can be identified with `downcast_ref` as [`SegmentingCancelled`].
    fn transcribe(
        &mut self,
        audio: &[f32],
        language: Option<&str>,
        callbacks: &mut SegmentingCallbacks<'_>,
    ) -> anyhow::Result<SegmentedTranscription>;
}

/// Structured output of a self-segmenting recognizer; `rows` already carry absolute times (relative to the start of the audio passed in) and speaker labels.
#[derive(Debug, Clone, Default)]
pub struct SegmentedTranscription {
    pub text: String,
    pub rows: Vec<RowIn>,
    pub speaker_ranges: Vec<SpeakerRange>,
    pub generation_tokens: usize,
    /// Hint that transcription succeeded but a segment was not fully written, and similar.
    pub warnings: Vec<String>,
}

/// Observation and abort hooks for the self-segmenting recognition process.
#[derive(Default)]
pub struct SegmentingCallbacks<'a> {
    /// (covered audio seconds, total audio seconds), monotonically non-decreasing.
    pub on_progress: Option<&'a mut dyn FnMut(f64, f64)>,
    /// A full sentence parsed from streaming (timestamps already include the chunk offset; this is the global timeline).
    pub on_segment: Option<&'a mut dyn FnMut(&LiveSegment)>,
    /// Returns true to request abort.
    pub should_cancel: Option<&'a mut dyn FnMut() -> bool>,
}

impl SegmentingCallbacks<'_> {
    pub fn none() -> Self {
        Self::default()
    }

    pub fn cancelled(&mut self) -> bool {
        self.should_cancel.as_deref_mut().is_some_and(|callback| callback())
    }
}

/// Payload of the error on cancellation; callers can identify it with anyhow's `downcast_ref`.
#[derive(Debug, Clone, Copy)]
pub struct SegmentingCancelled;

impl std::fmt::Display for SegmentingCancelled {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("transcription cancelled")
    }
}

impl std::error::Error for SegmentingCancelled {}

// ---- The following is ported from v2 `ccut-speech-core`'s `types.rs` and `traits.rs` ----------------------------

/// Relative word times (f32 seconds) returned by the inference layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AlignedWord {
    pub text: String,
    pub start: f32,
    pub end: f32,
}

/// Relative speech intervals (f32 seconds) returned by the VAD inference layer.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SpeechSegment {
    pub start: f32,
    pub end: f32,
}

impl SpeechSegment {
    pub fn duration(self) -> f32 {
        self.end - self.start
    }
}

/// Word times at the application layer (absolute f64 seconds).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WordIn {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

/// Unified transcript row. `words` is `None` when there are no real word times.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RowIn {
    pub start: f64,
    pub end: f64,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<WordIn>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
}

impl RowIn {
    pub fn new(start: f64, end: f64, text: impl Into<String>) -> Self {
        Self {
            start,
            end,
            text: text.into(),
            words: None,
            speaker: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LiveSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

pub trait ForcedAlignment {
    fn align(&mut self, audio: &[f32], text: &str, language: Option<&str>) -> anyhow::Result<Vec<AlignedWord>>;

    fn align_long(&mut self, audio: &[f32], text: &str, language: Option<&str>) -> anyhow::Result<Vec<AlignedWord>> {
        self.align(audio, text, language)
    }
}

/// Speaker embedding (16 kHz mono → L2-normalized vector). WeSpeaker's MLX implementation lives in `backend::mlx::wespeaker`; the callers that extract per-segment embeddings and cluster them ([`speaker_cluster`]) are the speaker merging for self-segmenting models (MOSS).
pub trait SpeakerEmbedding {
    /// Input too short (WeSpeaker needs at least 0.5 seconds) is an error; callers filter it out first.
    fn embed(&mut self, samples: &[f32]) -> anyhow::Result<Vec<f32>>;
}

/// Speaker diarization (Pyannote segmentation + WeSpeaker voiceprint clustering): whole 16 kHz mono audio → global speaker intervals. There is one implementation each for MLX and candle (`backend::mlx::pyannote`, `backend::candle::pyannote`); decoding and clustering both live in [`pyannote_common`].
/// When the transcription model does not diarize speakers itself (Qwen3-ASR, Whisper), the transcription job calls this after recognition finishes (architecture design §6.6).
pub trait SpeakerDiarization {
    /// The error returned on cancellation can be retrieved with `downcast_ref::<pyannote_common::PyannoteCancelled>()`.
    fn diarize(
        &mut self,
        samples: &[f32],
        options: &pyannote_common::PyannoteOptions,
        callbacks: &mut pyannote_common::PyannoteCallbacks<'_>,
    ) -> anyhow::Result<Vec<pyannote_common::DiarizedSegment>>;
}

pub trait VoiceActivityDetection {
    fn input_sample_rate(&self) -> u32 {
        16_000
    }

    fn detect_speech(&mut self, audio: &[f32]) -> anyhow::Result<Vec<SpeechSegment>>;
}
