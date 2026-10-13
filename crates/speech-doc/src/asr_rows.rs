//! Input contract for transcript rows and words: the ASR rows that the word builder ([`crate::build`]), the speaker and initial-segmentation modules, and others read.
//!
//! Ported from CucCut v2 `ccut-speech-core`: `RowIn` / `WordIn` come from `types.rs`,
//! `RowSegmentation` comes from `transcript.rs`, content unchanged.

use serde::{Deserialize, Serialize};

/// Application-layer word time (absolute f64 seconds).
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

/// Source of the row boundaries in `ai/asr-rows.json`.
///
/// This is not paragraph semantics. It only lets the first production reader judge whether these rows are suitable for generating the initial soft segmentation after transcription completes. The field is optional, so older audit artifacts remain readable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RowSegmentation {
    Model,
    Provider,
    Host,
    Vad,
    Synthetic,
}
