//! The carrier encoding/decoding layer of the file-contract subtitle AI pipeline (`file-v1`).
//!
//! See `docs/design/subtitle/ccut-file-contract-subtitle-ai-design.md`. Each stage's four beats are
//! `render (code) → edit (LLM/Agent) → parse + lint (code) → apply (code writes the truth)`;
//! this module handles only the first and third beats, and all of it is pure functions with zero I/O, zero clock, and zero randomness.
//!
//! Five carriers:
//! - [`polish_txt`]: plain text with sentinel fences, used for sentence breaking and reading-order revision.
//! - [`translate_html`]: bare `<article>` root HTML, used for sentence-level translation (may carry block-alignment edge drafts).
//! - [`align_edges`]: HTML table; the model only annotates "translation semantic block → source word index" (default alignment carrier `align-edges/1`) and monotonic display rewriting (`align-rewrite/1`).
//! - [`align_table`]: HTML table, used for line-splitting translations and aligning source spans (review/repair carrier).
//! - [`context_md`]: Markdown, used for the global summary and glossary.
//! - [`chapters_html`]: paragraph-level HTML in; `<h2>` + summary + first paragraph anchored out, used for the per-chapter Map pages and the Reduce outline.
//!
//! Parsing always "locates by id/data attribute"; tag names are not part of the protocol. Parsed problems come in two kinds:
//! [`common::Problem`] (closed set from §10, feeds the retry ledger) and [`common::Warning`] (observability only).

pub mod align_edges;
pub mod align_table;
pub mod chapters_html;
pub mod common;
pub mod context_md;
pub mod html;
/// Experimental `lines/1` codec; production carriers remain versioned separately.
pub mod lines;
pub mod lines_translation;
pub mod manifest;
pub mod polish_txt;
pub mod translate_html;

pub use align_edges::{
    AlignChunk, AlignEdgesGroup, AlignEdgesInput, AlignEdgesParsed, AlignEdgesSentenceInput,
    CHUNK_EDGE_WEIGHT, chunk_char_ranges, chunks_to_edges, parse_align_edges,
    parse_align_edges_input, parse_ordinal_words, parse_ordinals, render_align_edges,
    render_ordinal_words,
};
pub use align_table::{
    AlignContextRow, AlignParsed, AlignParsedGroup, AlignParsedRow, AlignSentenceInput,
    AlignTableInput, parse_align_table, parse_align_table_input, render_align_table,
};
pub use chapters_html::{
    CHAPTERS_OUTLINE_FORMAT, CHAPTERS_SOURCE_FORMAT, ChapterAnchor, ChaptersPageInput,
    ChaptersParsed, OutlineUnit, ParsedChapterRow, lint_chapters_answer, max_rows_for_aim,
    outline_row_limit, parse_chapters_output, parse_chapters_output_with_limit,
    parse_chapters_source, render_chapters_outline, render_chapters_source, snippet,
};
pub use common::{
    ALIGN_EDGES_FORMAT, ALIGN_REWRITE_FORMAT, ALIGN_TABLE_FORMAT, CONTEXT_DOC_FORMAT, Diagnostics,
    DocumentArtifact, DocumentFormat, DocumentRequest, POLISH_TEXT_FORMAT, PROTOCOL_VERSION,
    PROTOCOL_VERSION_JSON, PageAttempt, Problem, ProblemCode, ProblemScope,
    TRANSLATION_SOURCE_FORMAT, Warning, WarningCode, max_output_chars, normalize_llm_output,
    sanitize_inline_text, sanitize_payload_text, uses_file_contract,
};
pub use context_md::{
    ANALYSIS_MAX_TERMS, ANALYSIS_MAX_TERMS_PER_PAGE, BilingualTerm, CanonicalTerm, ContextParsed,
    ParseMode, SourceContext, TargetContext, TermCategory, TermOrigin, is_junk_term_source,
    merge_bilingual_terms, merge_canonical_terms, parse_model_source_context,
    parse_model_target_context, parse_source_context, parse_source_context_with_mode,
    parse_target_context, parse_target_context_with_mode, render_source_context,
    render_target_context, term_merge_key,
};
pub use lines_translation::TranslateLinesDraft;
pub use manifest::{Manifest, PageRecord, RunRecord, RunStatus};
pub use polish_txt::{
    PolishBudget, PolishPagePlan, PolishParsed, PolishRendered, lint_polish_page,
    parse_polish_page, plan_polish_pages, render_polish_page,
};
pub use translate_html::{
    TranslateAlignmentDraft, TranslateAlignmentInput, TranslatePage, TranslateParsed,
    TranslateSection, TranslateSentence, is_row_partition, parse_align_groups,
    parse_translate_page, parse_translate_source, render_align_groups, render_translate_page,
    rows_on_group_boundaries,
};
