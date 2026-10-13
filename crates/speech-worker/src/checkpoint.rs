//! Checkpoint: `checkpoint.json` in staging. The envelope is the core's [`PipelineStatus`] (a fingerprint mismatch voids the whole file).
//!
//! The translation engine is itself incremental: sentences that already have a translation and a fresh `transSrc` are skipped on non-force rounds, and it calls back once after each page (v2's “the doc is the resume point”).
//! So the checkpoint stores only the tables for the target language. On resume they are put back into the `TranscriptDoc` before calling the engine, and finished pages send no requests again:
//!
//! - `translating`: the brief is settled (`brief`); `trans` / `transSrc` are written once after each page;
//! - `aligned`: main alignment is done; `transDisplay` / `transAlign` are saved separately. Resume skips translation and main alignment, and starts from the row-repair tail round;
//! - `finished`: the tail round is also done; resume only rewrites the outputs.
//!
//! Sentence IDs are the persistence unit (the same basis as the core's `TranslateProgress`), so resume still works when the paging parameters change. `totalPages` / `processedPages`
//! count sentences. The fused draft is not persisted: if interrupted between `translating` and `aligned`, the main alignment on resume sends a dedicated alignment request for those sentences instead.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use speech_doc::TranscriptDoc;
use speech_doc::doc::{TransAlign, TransDisplay};
use speech_doc::engines::brief::DocumentBrief;
use speech_doc::progress::PipelineStatus;

use crate::Failure;

pub const CHECKPOINT_FILE: &str = "checkpoint.json";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Phase {
    /// The brief has not been settled yet.
    #[default]
    Brief,
    Translating,
    Aligned,
    Finished,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateCheckpoint {
    pub phase: Phase,
    /// The settled brief. Null when generation failed, or was skipped with no terms.
    pub brief: Option<DocumentBrief>,
    /// Number of translation pages already sent (including earlier attempts).
    pub pages: u32,
    pub trans: BTreeMap<String, String>,
    pub trans_src: BTreeMap<String, String>,
    pub trans_display: BTreeMap<String, TransDisplay>,
    pub trans_align: BTreeMap<String, TransAlign>,
}

pub struct Checkpoints {
    path: PathBuf,
    key: String,
}

impl Checkpoints {
    pub fn new(staging: &Path, key: String) -> Checkpoints {
        Checkpoints {
            path: staging.join(CHECKPOINT_FILE),
            key,
        }
    }

    /// Reads the checkpoint left by the last run. Returns None when there is none, it cannot be parsed, or the fingerprint does not match (a mismatched file is kept and overwritten on the next save).
    pub fn load(&self) -> Option<TranslateCheckpoint> {
        let bytes = std::fs::read(&self.path).ok()?;
        PipelineStatus::<TranslateCheckpoint>::resume(&bytes, &self.key).map(|status| status.custom)
    }

    /// Writes atomically: writes a temp file first, then renames it, so being killed midway leaves no half-written file.
    pub fn save(&self, checkpoint: &TranslateCheckpoint, total_sentences: usize) -> Result<(), Failure> {
        let mut status = PipelineStatus::new(self.key.clone(), total_sentences as u32, checkpoint.clone());
        status.processed_pages = (checkpoint.trans.len() as u32).min(status.total_pages);
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, status.to_bytes())
            .and_then(|()| std::fs::rename(&tmp, &self.path))
            .map_err(|error| Failure::new("STAGING_WRITE_FAILED", format!("检查点写不进 staging：{error}")))
    }
}

impl TranslateCheckpoint {
    /// Puts the tables from the checkpoint back into the document (the target language's slot).
    pub fn restore(&self, doc: &mut TranscriptDoc, lang: &str) {
        if !self.trans.is_empty() {
            doc.trans.insert(lang.to_owned(), self.trans.clone());
            doc.trans_src.insert(lang.to_owned(), self.trans_src.clone());
        }
        if matches!(self.phase, Phase::Aligned | Phase::Finished) {
            if !self.trans_display.is_empty() {
                doc.trans_display.insert(lang.to_owned(), self.trans_display.clone());
            }
            if !self.trans_align.is_empty() {
                doc.trans_align.insert(lang.to_owned(), self.trans_align.clone());
            }
        }
    }

    /// Takes the target language's tables from the document.
    pub fn capture(&mut self, doc: &TranscriptDoc, lang: &str, with_alignment: bool) {
        self.trans = doc.trans.get(lang).cloned().unwrap_or_default();
        self.trans_src = doc.trans_src.get(lang).cloned().unwrap_or_default();
        if with_alignment {
            self.trans_display = doc.trans_display.get(lang).cloned().unwrap_or_default();
            self.trans_align = doc.trans_align.get(lang).cloned().unwrap_or_default();
        }
    }
}
