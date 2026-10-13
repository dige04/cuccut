//! The pure logic core of the ccut post-transcription AI pipeline (zero I/O, zero network).
//!
//! The layering principle matches the speech side: this crate contains only deterministic algorithms and engine logic. The LLM is injected through the [`llm::LlmJson`] trait, and the host (CLI) provides two kinds of executor: provider and agent.

pub mod align_block;
pub mod asr_rows;
pub mod atomize;
pub mod autocorrect;
pub mod bilingual_replace;
pub mod build;
pub mod check;
pub mod cue;
pub mod doc;
pub mod dubbing_source;
pub mod engines;
pub mod export;
pub mod filepipe;
pub mod fingerprint;
pub mod golden;
pub mod initial_segment;
pub mod language_quality;
pub mod layout;
pub mod layout_profile;
pub mod lcs;
pub mod llm;
pub mod metrics;
pub mod paging;
pub mod patch;
pub mod progress;
pub mod provenance;
pub mod rebind;
pub mod row_mapping;
pub mod script;
pub mod script_cut;
pub mod seam;
pub mod sentence;
pub mod slice;
pub mod source_boundary;
pub mod source_chapters;
pub mod source_cue_edit;
pub mod source_paragraph;
pub mod speaker;
pub mod speaker_apply;
pub mod split;
pub mod timing;
pub mod translate_flow;
pub mod translation_paragraph;
pub mod word_breaks;

pub use doc::{TranscriptDoc, Word};
