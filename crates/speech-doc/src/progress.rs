//! Progress state for resumable runs (cross-checked against voice-ink `ProgressTracker` / `PipelineStatus`).
//!
//! Discipline: page boundaries are not persisted (they are deterministically re-derived from the fingerprinted word stream); progress stores only the minimal state of what has completed; a fingerprint mismatch invalidates everything; a stage must delete its status file on completion (the host handles I/O).

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStatus<T> {
    /// Fingerprint of the input word stream; on mismatch, the state is discarded outright.
    pub fingerprint: String,
    pub total_pages: u32,
    pub processed_pages: u32,
    /// Per-stage custom state: committed paragraphs / map of translated sentence ids……
    pub custom: T,
}

impl<T: Serialize + DeserializeOwned> PipelineStatus<T> {
    pub fn new(fingerprint: impl Into<String>, total_pages: u32, custom: T) -> Self {
        Self {
            fingerprint: fingerprint.into(),
            total_pages,
            processed_pages: 0,
            custom,
        }
    }

    /// Restore from bytes; returns `None` on fingerprint mismatch (partial or stale state is never used silently).
    /// Page-count validation varies by stage: organize/segment require `total_pages` to match, while translate uses sentence ids as its persistent unit, so a change in paging is harmless. The caller adds its own check.
    pub fn resume(bytes: &[u8], fingerprint: &str) -> Option<Self> {
        let status: Self = serde_json::from_slice(bytes).ok()?;
        (status.fingerprint == fingerprint && status.processed_pages <= status.total_pages)
            .then_some(status)
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec_pretty(self).expect("progress status serializes")
    }
}

/// Custom progress for the translate stage: **the sentence id is the persistent unit** (resumed runs remain valid even when the paging parameters change).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateProgress {
    /// Sentence id → translation.
    pub translated_sentences: std::collections::BTreeMap<String, String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resume_rejects_fingerprint_mismatch() {
        let status = PipelineStatus::new("fp-1", 3, TranslateProgress::default());
        let bytes = status.to_bytes();
        assert!(PipelineStatus::<TranslateProgress>::resume(&bytes, "fp-1").is_some());
        assert!(PipelineStatus::<TranslateProgress>::resume(&bytes, "fp-2").is_none());
    }
}
