//! Lossless mapping between v2's `TranscriptDoc` (the transcript document model ported unchanged from `speech-doc`) and v3's transcript and translation documents (video format spec §5.2, §5.3; architecture design §7.9).
//!
//! - [`to_transcript_doc`]: v3 transcript body + each language's translation body + asset facts → `TranscriptDoc`, handed to the subtitle and translation core for computation;
//! - [`from_transcript_doc`]: the computed `TranscriptDoc` + the v3 body before writing (the base) → new v3 body;
//! - [`sentences::source_sentences`]: transcript body → sentences and source fingerprints under the core rules (shared by translation, review and the UI).
//!
//! Both directions are pure functions that do not read or write storage. Anything in the base that `TranscriptDoc` cannot hold (unknown fields, markers that exist only in v3) is carried back from the base by ID; so writes always pass in the same body that was read.

pub mod sentences;
mod speech;
pub mod time;
mod translation;

use std::fmt;

use editor_semantics::MediaTime;
use speech_doc::TranscriptDoc;
use video_model::Id;
use video_model::speech::SpeechBody;
use video_model::translation::{SourceBasis, TranslationBody};

/// Facts about the asset the transcript belongs to (video format spec §4.1), taken by the caller from `AssetRecord`.
#[derive(Clone, Debug, PartialEq)]
pub struct MediaFacts {
    /// The `sourceAssetId` in the transcript document header.
    pub asset_id: Option<Id>,
    /// The asset's local path (`storage.locator.path`); omitted when absent.
    pub path: Option<String>,
    pub content_hash: String,
    pub duration: MediaTime,
    pub sample_rate: Option<u32>,
}

/// A v3 document as read: one transcript and its per-language translations.
#[derive(Clone, Copy, Debug)]
pub struct V3Documents<'a> {
    pub media: &'a MediaFacts,
    /// The `language` in the transcript document header.
    pub language: Option<&'a str>,
    pub speech: &'a SpeechBody,
    pub translations: &'a [TranslationBody],
}

/// The base used for writing back: the bodies as they were when read. A transcript or translation with no base is written as a new document.
#[derive(Clone, Copy, Debug, Default)]
pub struct WriteBase<'a> {
    pub speech: Option<&'a SpeechBody>,
    pub translations: &'a [TranslationBody],
    /// The `sourceBasis` for a translation in a new language; existing translations keep their own.
    pub source_basis: Option<&'a SourceBasis>,
}

/// The result of a write-back. Whether to save, and which document versions to save, is up to the caller.
#[derive(Clone, Debug, PartialEq)]
pub struct V3Write {
    /// The `language` in the transcript document header; `und` is written as absent.
    pub language: Option<String>,
    pub speech: SpeechBody,
    /// In base order; new languages come after.
    pub translations: Vec<TranslationBody>,
    /// Translation languages present in the base but no longer in `TranscriptDoc`. Whether to delete those documents is up to the caller.
    pub removed_languages: Vec<String>,
    pub report: WriteReport,
}

/// Rounding and dropping that occurred during write-back.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct WriteReport {
    /// Number of times, during conversion to ticks, that a time was rounded (§2.10).
    pub rounded_times: usize,
    /// Maximum rounding error (seconds).
    pub max_rounding_error_seconds: f64,
    /// Content that the v3 format cannot hold and that was dropped, one entry per item.
    pub dropped: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BridgeError {
    pub message: String,
}

impl BridgeError {
    pub(crate) fn new(message: impl Into<String>) -> Self {
        Self { message: message.into() }
    }
}

impl fmt::Display for BridgeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for BridgeError {}

/// v3 → `TranscriptDoc`。
pub fn to_transcript_doc(docs: &V3Documents<'_>) -> Result<TranscriptDoc, BridgeError> {
    let mut doc = speech::to_doc(docs.media, docs.language, docs.speech)?;
    translation::to_doc(&mut doc, docs.translations)?;
    Ok(doc)
}

/// `TranscriptDoc` → v3. `doc.media` is not written back: asset facts belong to `AssetRecord`.
pub fn from_transcript_doc(doc: &TranscriptDoc, base: &WriteBase<'_>) -> Result<V3Write, BridgeError> {
    let mut report = WriteReport::default();
    let (language, speech) = speech::from_doc(doc, base.speech, &mut report)?;
    let (translations, removed_languages) = translation::from_doc(doc, base)?;
    Ok(V3Write {
        language,
        speech,
        translations,
        removed_languages,
        report,
    })
}
