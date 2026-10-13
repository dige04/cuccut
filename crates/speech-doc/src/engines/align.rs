//! Stage 5: display segmentation and subtitle alignment (§9 / v0.3 §5). Splits sentence-level translations into display pieces and writes the `transAlign` overlay. The translated sentence itself (`trans`) is owned by the translate engine; this engine only decides how to split it.
//!
//! Three strategies (v0.3 §5; the project-level default is manyToOne, overridable per sentence):
//! - `independent`: target-language splitter (`split::split_independent`), no LLM;
//! - `manyToOne`: every long sentence that exceeds single-line capacity goes to the LLM. The default carrier is block-alignment edges ([`AlignCarrier::Edges`], block-alignment design §4/§6). Either the translate fused draft or the dedicated `align-edges/1` call only supplies "translation semantic block → source word index". Block merging, safe boundaries and the bilingual DP all live in [`crate::align_block`]. If a block is still over hard, it is rewritten monotonically via `align-rewrite/1` and written to `transDisplay`; if that fails too, the whole sentence is aligned as one piece. When the dedicated call fails, one global repair is shared; if that still fails, try pure-anchor block alignment first, and finally fall back to target-language splitting with word anchoring. The review/repair carrier [`AlignCarrier::Table`] (`align-table/1`) keeps the original two-column split-table protocol (continuous full coverage, deterministic reconciliation, bilingual length plan, seam lint);
//! - `oneToOne`: legacy source-Cue alignment mode, read-only for compatibility, no longer generated.
//!
//! Incremental semantics: a sentence that already has a valid entry in the same mode is skipped; `force` re-splits. Sentences that need no entry (short translations that are ≤ fit and ≤ hard) have any existing entry cleared.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

pub use crate::align_block::AlignDensity;
use crate::source_boundary::normalized_source_lexemes;
pub use crate::source_boundary::source_boundary_issue;

use crate::align_block::{
    ANCHOR_ALIGNER_TAG, AlignCtx, AlignEdge, AnchorAligner, AnchorWord, BilingualPlanInput,
    PlanOutcome, TermPair, WordAligner, merge_edges, plan_sentence, plan_sentence_rows,
    purge_stale_display, sentence_level_entry, trans_text_fingerprint,
};
use crate::atomize::{JoinWord, join_word_texts, normalize_chars, word_count};
use crate::autocorrect::{
    Options as AutocorrectOptions, format_translation_map, format_translation_with_options,
};
use crate::cue::{Cue, derive_cues};
use crate::doc::{
    AlignMode, Correspondence, TextBasis, TransAlign, TransDisplay, TransPiece, TranscriptDoc, Word,
};
use crate::engines::markers;
use crate::filepipe::{
    AlignChunk, AlignEdgesInput, AlignEdgesSentenceInput, AlignParsed, AlignSentenceInput,
    AlignTableInput, PageAttempt, ProblemCode, ProblemScope, chunk_char_ranges, chunks_to_edges,
    parse_align_edges, parse_align_edges_input, parse_align_table, parse_align_table_input,
    render_align_edges, render_align_table,
};
use crate::layout_profile::LayoutProfile;
use crate::llm::{LlmError, LlmJson, LlmRequest};
use crate::seam::{
    SeamLintClass, SeamLintKind, cjk_midword_boundary, ends_dangling, free_seam,
    is_objective_blocking, lint_pieces, reanchor_texts, repair_flash_pieces_with_ranges,
    repair_lint_pieces, source_boundary_strength,
};
use crate::sentence::{Sentence, derive_sentences};
use crate::split::{
    TransCue, TransParams, align_entry_valid_for_lang, exceeds_one_line_fit, primary_subtag,
    reordered_rewrite_exceeds, split_independent_for_lang_protected, target_cps_chars,
    target_required_seconds,
};

/// Source identifier for LLM block alignment plus deterministic anchor merging (written to `TransAlign.aligner`).
pub const LLM_CHUNK_ALIGNER_TAG: &str = "llm-chunk+anchor/1";
/// Source identifier for entries written directly from a translate-fused **row-partition** draft. The display-row boundaries the model gave are frozen as block boundaries (blocks and pieces map one to one); source word ranges and time allocation are still computed deterministically.
pub const LLM_ROWS_ALIGNER_TAG: &str = "llm-rows+anchor/1";
/// Source identifier for entries written directly from a translate line-text carrier (`lines/1`) draft. Each block is located as a source interval by jointly anchoring its first and last source-word references, then enters block checking together with the deterministic anchors.
pub const LLM_LINES_ALIGNER_TAG: &str = "llm-lines+anchor/1";
/// Entries produced when every cut point of a line-text draft is accepted, a block is still over hard, and one more cut is made inside the block at a target seam that is clean under lint ([`crate::align_block::plan_sentence_splitting_over_hard`]). Source times inside the split block are apportioned proportionally; the other blocks remain model evidence. This has its own identifier so that statistics do not mix it with entries backed by full evidence.
pub const LLM_LINES_SPLIT_ALIGNER_TAG: &str = "llm-lines+split/1";
/// Source identifier for entries from the table carrier (`align-table/1`).
pub const TABLE_ALIGNER_TAG: &str = "llm-table/1";
/// Identifier written to `transDisplay.basis` by monotonic display rewriting.
pub const MONOTONIC_REWRITE_BASIS: &str = "monotonic-rewrite";
/// Identifier written to `transDisplay.basis` by a table-carrier `data-reordered` rewrite.
pub const TABLE_REORDER_BASIS: &str = "table-reorder";

/// Repair-call budget shared by all first-round batches. Failed sentences are aggregated and resent only once; if they still fail, the verified deterministic draft is used, so that one stubborn sentence cannot drive an unbounded chain of calls.
const GLOBAL_REPAIR_CALLS: usize = 1;
/// Hard cap of 40 sentences per page for agent/provider alignment pages. Source word count cannot express the cost of semantic per-sentence splitting: the fCHe benchmark has only 1567 source words, yet one page carried 55 HTML groups and kept a single worker busy for over 8 minutes. A 40-sentence cap splits such pages (few words, many sentences) into two pages that run in parallel, while still keeping enough cross-sentence context.
const ALIGN_MAX_ITEMS_PER_PAGE: usize = 40;
/// Estimated complexity budget for an alignment carrier. Unlike the source word count used by `page_budget`, it approximates HTML input size, target-language splitting volume, terminology/anchor constraints and the suggested piece count; whichever gives the stricter page count wins. The budget only determines page shape and plays no part in acceptance.
const ALIGN_PAGE_COMPLEXITY_BUDGET: usize = 16_000;
/// Width-balancing tolerance between pieces (reading units): when exceeded and the widest piece still has an internal minor clause seam, re-split it.
const BALANCE_SPREAD: usize = 8;
/// Guardrail for how long a whole translated sentence stays on screen (seconds). When the translation fits on one line, do not force a split just because the source is long (many-to-one is the default shape: several short source phrases share one translation). Only queue for LLM splitting when the whole-sentence time window is long enough that a single subtitle would stay pinned on screen.
pub(crate) const LONG_DWELL_SECONDS: f64 = 7.0;
/// When one translation line covers several source subtitles, reaching this dwell duration counts as sticking.
pub const ROW_DEFICIT_DWELL_SECONDS: f64 = 5.0;
/// When sentence-level correspondence covers at least this many source rows, send it to review even if the dwell threshold is not reached.
pub const ROW_DEFICIT_SENTENCE_SOURCE_ROWS: usize = 3;
/// Threshold in words for merging source Cue "fragments": a segment shorter than this must be merged into a neighbouring segment before it counts as one user-visible source row. The only call site of [`source_cue_runs`] + [`merge_short_runs`]; the `mergeShortRuns` mirrors on the three product surfaces must use the same number.
pub const ROW_RUN_MERGE_MIN_WORDS: usize = 3;
/// Trigger gap (seconds) for the per-piece time-budget advisory: when the reading time a piece needs exceeds its source speech window by this much, and adjacent pieces have an equal surplus, suggest moving the boundary.
const TIME_DEFICIT_SECONDS: f64 = 1.0;
/// In bilingual paired review, when a source-row span exceeds this duration and the corresponding target piece already has a complete clause or parallel-action seam of its own, require re-splitting at a natural target-language seam. The length of the source alone does not create a target cut point.
pub(crate) const PAIRED_SOURCE_MAX_SECONDS: f64 = 4.0;
/// Hard cap on source-row duration (seconds) in bilingual paired review. The soft tier requires the target piece to have a natural seam of its own. The hard tier targets the shape where a source row is too long to read and the target piece has no seam at all; such rows must settle for a second-best boundary.
pub(crate) const PAIRED_SOURCE_HARD_SECONDS: f64 = 6.0;
/// The hard tier fires only when the target piece itself has enough reading volume. If the target piece is shorter than this many reading units, cutting it further would only produce flashing fragments, so it is better to leave the source row long.
const PAIRED_TARGET_MIN_UNITS: usize = 10;
/// The hard tier requires a source row to have at least this many words before a "second-best boundary" is meaningful. Source rows of three words or fewer have no usable cut point.
const PAIRED_MIN_SOURCE_WORDS: usize = 4;
/// Degenerate paired row: lower bound on source-span word count. Below this word count, and attached to a sufficiently wide translation piece, word-by-word highlighting stalls on one or two source words while the subtitle line advances as a whole (R2 benchmark `s-g29.0`: `have`, 1 word, attached to 9 units of Chinese).
///
/// Deliberately **not** reusing `PAIRED_MIN_SOURCE_WORDS = 4`. That is the **suppression** threshold of `source_ceiling_issues` (no report even if the source row is wider), and it already appears in contract text as `paired_min_words`. This one is a **rejection** threshold. The two numbers have opposite meanings and must not be merged.
const DEGENERATE_MIN_SOURCE_WORDS: usize = 3;
/// Degenerate paired row: lower bound on target-piece width. A narrow translation piece paired with a few source words is a normal many-to-one shape.
const DEGENERATE_TARGET_MIN_UNITS: usize = 8;
/// Fragment paired row: upper bound on source-side word count. Only a piece attached to this many source words or fewer (inclusive) can be a "fragment".
///
/// Like the two thresholds above, this must **not** be merged. `PAIRED_MIN_SOURCE_WORDS` is the suppression threshold for the source-row **too wide** channel, `DEGENERATE_MIN_SOURCE_WORDS` is the rejection threshold for "narrow source paired with wide translation", and this is the trigger threshold for the source-row **too narrow** channel. The three belong to three different quadrants.
const FRAGMENT_MAX_SOURCE_WORDS: usize = 2;
/// Fragment paired row: whole-sentence scale gate. If the sentence has fewer source words than `pieces × this value`, do not report it. The sentence simply does not have enough words for every piece to reach the minimum width, and reporting it would only send an unsatisfiable requirement back to the worker. It uses the same arithmetic exemption as `degenerate_paired_row`.
const FRAGMENT_MIN_SENTENCE_WORDS: usize = 3;

/// Consecutive runs with the same source-Cue attribution form one segment. Words with no Cue are merged into the previous segment, keeping the degradation monotonic.
pub fn source_cue_runs(
    words: &[&Word],
    cue_id_by_word: &BTreeMap<String, String>,
) -> Vec<std::ops::Range<usize>> {
    source_cue_runs_by(words.iter().map(|word| word.id.as_str()), |id| {
        cue_id_by_word.get(id).map(String::as_str)
    })
}

/// Same rule as [`source_cue_runs`], but operating only on word ids and one attribution lookup. Callers that hold only ids, or whose attribution table is a borrowed index (the editor's whole-document derivation), use this, so they need not build a batch of words for each sentence or copy the ids of the whole word table into an ordered tree.
pub fn source_cue_runs_by<'a, K: PartialEq>(
    word_ids: impl IntoIterator<Item = &'a str>,
    cue_of: impl Fn(&str) -> Option<K>,
) -> Vec<std::ops::Range<usize>> {
    source_cue_runs_by_keys(word_ids.into_iter().map(cue_of))
}

/// Same rule as [`source_cue_runs`], operating directly on per-word source-Cue attribution (`None` = no Cue found, merged into the previous segment). The bilingual DP only has word order within the sentence, so it goes through here.
pub fn source_cue_runs_by_keys<K: PartialEq>(
    keys: impl IntoIterator<Item = Option<K>>,
) -> Vec<std::ops::Range<usize>> {
    let mut runs: Vec<std::ops::Range<usize>> = Vec::new();
    let mut run_cue: Option<K> = None;
    for (index, cue) in keys.into_iter().enumerate() {
        if runs.is_empty() {
            runs.push(index..index + 1);
            run_cue = cue;
        } else if cue.is_none() || cue == run_cue {
            let start = runs.last().expect("non-empty").start;
            *runs.last_mut().expect("non-empty") = start..index + 1;
        } else {
            runs.push(index..index + 1);
            run_cue = cue;
        }
    }
    runs
}

/// Absorbs orphan source-Cue segments shorter than `min_words`. The first segment merges forward, the last merges backward, and middle segments merge into the shorter neighbour (ties go forward). After a merge, the result is re-checked in place, so merges cascade.
pub fn merge_short_runs(
    mut runs: Vec<std::ops::Range<usize>>,
    min_words: usize,
) -> Vec<std::ops::Range<usize>> {
    if runs.len() <= 1 {
        return runs;
    }
    let mut index = 0;
    while runs.len() > 1 && index < runs.len() {
        if runs[index].len() >= min_words {
            index += 1;
            continue;
        }
        let target = if index == 0 {
            1
        } else if index + 1 == runs.len() || runs[index - 1].len() <= runs[index + 1].len() {
            index - 1
        } else {
            index + 1
        };
        let keep = index.min(target);
        let drop = index.max(target);
        runs[keep] = runs[keep].start..runs[drop].end;
        runs.remove(drop);
        index = keep;
    }
    runs
}

/// Number of user-visible source rows covered by the closed in-sentence word-order interval `[from, to]`. It uses the same counting basis as `covered_rows` per cue in [`row_deficit_stats`] (re-segment within the interval, then absorb short fragments). `keys` is each word's source-Cue attribution within the sentence; an out-of-range interval returns 0.
pub fn covered_source_rows<K: PartialEq>(keys: &[Option<K>], from: usize, to: usize) -> usize {
    if from > to {
        return 0;
    }
    let Some(slice) = keys.get(from..=to) else {
        return 0;
    };
    merge_short_runs(
        source_cue_runs_by_keys(slice.iter().map(Option::as_ref)),
        ROW_RUN_MERGE_MIN_WORDS,
    )
    .len()
}

/// Dwell predicate for `align-row-deficit`: a translation row dwells for ≥ [`ROW_DEFICIT_DWELL_SECONDS`] and covers ≥2 source rows. The check's criterion, the alignment engine's row planning and the paired acceptance all share this one place rather than each copying the thresholds.
pub fn row_dwell_deficit(dwell_sec: f64, covered_rows: usize) -> bool {
    dwell_sec >= ROW_DEFICIT_DWELL_SECONDS && covered_rows >= 2
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RowDeficitReason {
    Dwell,
    SentenceLevel,
}

/// Per-sentence source/translation row dwell statistics. `reason == Some` means `align-row-deficit` is hit.
#[derive(Debug, Clone, PartialEq)]
pub struct RowDeficitStats {
    pub sentence: String,
    pub source_rows: usize,
    pub trans_cues: usize,
    pub max_dwell_sec: f64,
    pub target_units: usize,
    pub reason: Option<RowDeficitReason>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowDeficitIssue {
    pub sentence: String,
    pub key: String,
    pub source_rows: usize,
    pub trans_cues: usize,
    pub max_dwell_sec: f64,
    pub target_units: usize,
    pub reason: RowDeficitReason,
}

fn source_rows_for_indices(
    doc: &TranscriptDoc,
    indices: &[usize],
    cue_ids_by_index: &BTreeMap<usize, String>,
) -> usize {
    let words = indices
        .iter()
        .map(|&index| &doc.words[index])
        .collect::<Vec<_>>();
    let by_id = indices
        .iter()
        .filter_map(|&index| {
            cue_ids_by_index
                .get(&index)
                .map(|cue| (doc.words[index].id.clone(), cue.clone()))
        })
        .collect::<BTreeMap<_, _>>();
    merge_short_runs(source_cue_runs(&words, &by_id), ROW_RUN_MERGE_MIN_WORDS).len()
}

/// Computes source/translation row dwell statistics for all translated sentences. The source-row segmentation rule matches the `mergeShortRuns` mirrors on the three product surfaces entry for entry; the thresholds exist only in this module.
pub fn row_deficit_stats(
    doc: &TranscriptDoc,
    sentences: &[Sentence],
    lang: &str,
    source_cues: &[Cue],
    trans_cues: &[TransCue],
) -> Vec<RowDeficitStats> {
    let cue_ids_by_index = source_cues
        .iter()
        .flat_map(|cue| {
            cue.word_indices
                .iter()
                .copied()
                .map(|word_index| (word_index, cue.id.clone()))
        })
        .collect::<BTreeMap<_, _>>();
    let alignments = doc.trans_align.get(lang);
    sentences
        .iter()
        .filter(|sentence| {
            // Same basis as `align_sentences`: an empty or whitespace-only translation is explicitly skipped on the alignment side ("empty translation — skipped"). This criterion must not count it as a translated sentence either, otherwise it would report sticking for a sentence that has no translation at all.
            doc.trans
                .get(lang)
                .and_then(|table| table.get(&sentence.id))
                .is_some_and(|text| !text.trim().is_empty())
        })
        .map(|sentence| {
            let sentence_cues = trans_cues
                .iter()
                .filter(|cue| cue.sentence_id == sentence.id)
                .collect::<Vec<_>>();
            let source_rows =
                source_rows_for_indices(doc, &sentence.word_indices, &cue_ids_by_index);
            let trans_count = sentence_cues.len();
            let stale = sentence_cues.iter().any(|cue| cue.fallback);
            let entry = alignments
                .and_then(|table| table.get(&sentence.id))
                .filter(|entry| align_entry_valid_for_lang(doc, sentence, lang, entry));
            let independent = entry.is_some_and(|entry| entry.mode == AlignMode::Independent);
            let sentence_level = entry.is_some_and(|entry| {
                entry.mode == AlignMode::ManyToOne
                    && entry.correspondence() == Correspondence::Sentence
            });
            let mut max_dwell_sec = 0.0_f64;
            let mut target_units = 0usize;
            let mut dwell_deficit = false;
            for cue in &sentence_cues {
                let dwell = (cue.end - cue.start).max(0.0);
                if dwell >= max_dwell_sec {
                    max_dwell_sec = dwell;
                    target_units = crate::split::piece_display_units(&cue.text, lang);
                }
                let covered_rows = if independent {
                    0
                } else if let Some((from, to)) = cue.word_span {
                    sentence
                        .word_indices
                        .get(from..=to)
                        .map(|indices| source_rows_for_indices(doc, indices, &cue_ids_by_index))
                        .unwrap_or(0)
                } else {
                    source_rows
                };
                dwell_deficit |= row_dwell_deficit(dwell, covered_rows);
            }
            let deficit_shape = source_rows >= 2 && trans_count < source_rows;
            let reason = if stale || independent || !deficit_shape {
                None
            } else if dwell_deficit {
                Some(RowDeficitReason::Dwell)
            } else if sentence_level && source_rows >= ROW_DEFICIT_SENTENCE_SOURCE_ROWS {
                Some(RowDeficitReason::SentenceLevel)
            } else {
                None
            };
            RowDeficitStats {
                sentence: sentence.id.clone(),
                source_rows,
                trans_cues: trans_count,
                max_dwell_sec,
                target_units,
                reason,
            }
        })
        .collect()
}

/// The sole predicate entry point for `align-row-deficit`.
pub fn row_deficit_issues(
    doc: &TranscriptDoc,
    sentences: &[Sentence],
    lang: &str,
    source_cues: &[Cue],
    trans_cues: &[TransCue],
) -> Vec<RowDeficitIssue> {
    row_deficit_stats(doc, sentences, lang, source_cues, trans_cues)
        .into_iter()
        .filter_map(|stats| {
            let reason = stats.reason?;
            Some(RowDeficitIssue {
                key: stats.sentence.clone(),
                sentence: stats.sentence,
                source_rows: stats.source_rows,
                trans_cues: stats.trans_cues,
                max_dwell_sec: stats.max_dwell_sec,
                target_units: stats.target_units,
                reason,
            })
        })
        .collect()
}

/// Pure-arithmetic minimum piece count for a paired result. It must not exceed the number of source rows the user actually sees, and must not require a short translation to be cut into unreadable fragments. An accepted sentence is attempted with at least two pieces.
pub fn paired_min_piece_count(source_rows: usize, target_units: usize) -> usize {
    source_rows.min(2usize.max(target_units.div_ceil(crate::align_block::ROW_MIN_UNITS)))
}

/// The piece-count requirement for a paired candidate sentence, kept together with the two metrics it was computed from. When a candidate is rejected, it must be possible to answer whether the sentence cannot be cut, or simply does not have that many words to cut.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PairedRequirement {
    pub source_rows: usize,
    pub target_units: usize,
    pub required: usize,
}

impl PairedRequirement {
    fn new(source_rows: usize, target_units: usize) -> Self {
        Self {
            source_rows,
            target_units,
            required: paired_min_piece_count(source_rows, target_units),
        }
    }

    fn rejection(
        &self,
        sentence: &str,
        reason: &'static str,
        delivered: usize,
    ) -> RowRepairRejection {
        let units_per_row = if self.source_rows == 0 {
            0.0
        } else {
            (self.target_units as f64 / self.source_rows as f64 * 100.0).round() / 100.0
        };
        RowRepairRejection {
            sentence: sentence.to_owned(),
            reason,
            source_rows: self.source_rows,
            target_units: self.target_units,
            required: self.required,
            delivered,
            units_per_row,
        }
    }
}

/// The dwell shape of a sentence's translation rows, computed with the same predicate as `align-row-deficit`. Paired acceptance uses it to compare the new split with the original: accept if sticking is eliminated; also accept if it still sticks but is strictly better.
#[derive(Debug, Clone, Copy, PartialEq)]
struct DwellShape {
    /// Hits `align-row-deficit` (fewer pieces than source rows, and at least one sticking row).
    deficit: bool,
    /// Number of sticking rows.
    offending: usize,
    /// Longest dwell (seconds) among sticking rows; 0 when there are none.
    worst_dwell: f64,
    /// Largest number of source rows covered by a sticking row; 0 when there are none.
    worst_rows: usize,
}

impl DwellShape {
    /// `pieces` is a closed in-sentence word-order interval (relative to `anchor_indices`). `sentence_level` marks a whole-sentence correspondence entry (with 3 or more source rows, it counts as sticking even if the dwell is insufficient, the same basis as check).
    fn of(
        doc: &TranscriptDoc,
        anchor_indices: &[usize],
        keys: &[Option<String>],
        pieces: &[(usize, usize)],
        sentence_level: bool,
    ) -> Self {
        let source_rows = match anchor_indices.len() {
            0 => 0,
            n => covered_source_rows(keys, 0, n - 1),
        };
        let mut shape = Self {
            deficit: false,
            offending: 0,
            worst_dwell: 0.0,
            worst_rows: 0,
        };
        for &(from, to) in pieces {
            let (Some(&first), Some(&last)) = (anchor_indices.get(from), anchor_indices.get(to))
            else {
                continue;
            };
            let dwell = (doc.words[last].t1 - doc.words[first].t0).max(0.0);
            let rows = covered_source_rows(keys, from, to);
            let offending = row_dwell_deficit(dwell, rows)
                || (sentence_level && rows >= ROW_DEFICIT_SENTENCE_SOURCE_ROWS);
            if offending {
                shape.offending += 1;
                shape.worst_dwell = shape.worst_dwell.max(dwell);
                shape.worst_rows = shape.worst_rows.max(rows);
            }
        }
        shape.deficit = source_rows >= 2 && pieces.len() < source_rows && shape.offending > 0;
        if !shape.deficit {
            shape.offending = 0;
            shape.worst_dwell = 0.0;
            shape.worst_rows = 0;
        }
        shape
    }

    fn of_entry(
        doc: &TranscriptDoc,
        anchor_indices: &[usize],
        keys: &[Option<String>],
        entry: &TransAlign,
    ) -> Self {
        let whole = [(0, anchor_indices.len().saturating_sub(1))];
        if entry.mode != AlignMode::ManyToOne {
            return Self::of(doc, anchor_indices, keys, &whole, false);
        }
        let pieces: Vec<(usize, usize)> = entry
            .pieces
            .iter()
            .filter_map(|piece| Some((piece.from?, piece.to?)))
            .collect();
        Self::of(
            doc,
            anchor_indices,
            keys,
            &pieces,
            entry.correspondence() == Correspondence::Sentence,
        )
    }

    /// Every item is no worse than `before`.
    fn not_worse_than(&self, before: &Self) -> bool {
        self.offending <= before.offending
            && self.worst_rows <= before.worst_rows
            && self.worst_dwell <= before.worst_dwell + 1e-6
    }

    /// No worse than `before`, and at least one of these strictly improves: fewer sticking rows, a shorter dwell, or fewer covered source rows.
    fn strictly_better_than(&self, before: &Self) -> bool {
        self.not_worse_than(before)
            && (self.offending < before.offending
                || self.worst_rows < before.worst_rows
                || self.worst_dwell < before.worst_dwell - 1e-6)
    }
}

/// Dwell baseline of a paired candidate sentence at the start of this round.
struct PairedBaseline {
    anchor_indices: Vec<usize>,
    source_cue_keys: Vec<Option<String>>,
    before: DwellShape,
    /// The original entry is missing or no longer valid (for example, the translation has changed). Keeping the original would only leave a whole-sentence fallback cue, so the new result is accepted as long as it is not worse.
    stale: bool,
    /// The original entry's `aligner` (recorded only for valid entries). Paired means "ask the model to re-split." Model-absent splits left by a repair call that got no usable answer (`deterministic/1` equal-width splitting, `anchor/1` pure anchoring) must not replace an alignment the model had given. See [`model_backed_aligner`].
    previous_aligner: Option<String>,
}

/// Whether an `aligner` tag came from a model answer (`llm-*`). `deterministic/1`, `anchor/1` and old entries with no tag all count as model-absent.
fn model_backed_aligner(aligner: Option<&str>) -> bool {
    aligner.is_some_and(|tag| tag.starts_with("llm-"))
}

fn paired_prompt_instructions(
    base: Option<&str>,
    requirements: &BTreeMap<String, PairedRequirement>,
) -> Option<String> {
    if requirements.is_empty() {
        return base.map(str::to_owned);
    }
    let mut parts = base
        .filter(|text| !text.trim().is_empty())
        .map(|text| vec![text.trim().to_owned()])
        .unwrap_or_default();
    let rows = requirements
        .iter()
        .map(|(id, requirement)| format!("{id}: aim for about {} blocks", requirement.required))
        .collect::<Vec<_>>()
        .join("; ");
    // The carrier is block-alignment edges (`align-edges/1`). The model labels **blocks**; the number of display rows is decided by the deterministic DP, which the model cannot control. So requirements can only be imposed at block granularity. "At least N target rows" is an instruction the model cannot follow.
    parts.push(format!(
        "Paired row repair applies ONLY to these sentences ({rows}). For each of them, annotate MORE and FINER alignment blocks: walk the adjacent source ranges in order and give each one its own block whenever the translation has a matching stretch, instead of collapsing the whole sentence into a single block. Short blocks are fine — the engine decides the final row count and merges anything that would read too fast. The block counts above are guidance, not a quota: the result is accepted once no translation row would stay on screen for {dwell} seconds or more while spanning two or more source rows. Keep the translation text exactly as it is: never rewrite, retranslate, reorder or drop any of it; you are only marking where the existing translation lines up with the source.",
        dwell = ROW_DEFICIT_DWELL_SECONDS,
    ));
    Some(parts.join("\n\n"))
}

/// Finds a minor clause seam inside the piece text where neither side produces a flashing piece, and returns the fragment ending the left side as a hint.
fn internal_clause_seam(text: &str, lang: &str) -> Option<String> {
    let chars: Vec<char> = text.chars().collect();
    for (index, ch) in chars.iter().enumerate() {
        // The enumeration comma (、) usually joins an inseparable parallel structure (“persuade, win”). It must not be treated as safely re-splittable evidence merely to balance numbers. The dash (——) is a legitimate clause seam: in G1 verification, “entirely yours — this means…” passed the fit round in one go only because the dash was recognised as a seam.
        if !matches!(ch, '，' | '；' | '：' | '—' | ',' | ';' | ':') {
            continue;
        }
        // For consecutive dashes (——), the seam goes after the last —, never between two dashes.
        if *ch == '—' && chars.get(index + 1) == Some(&'—') {
            continue;
        }
        let left: String = chars[..=index].iter().collect();
        let right: String = chars[index + 1..].iter().collect();
        if crate::split::piece_display_units(&left, lang) >= 4
            && crate::split::piece_display_units(&right, lang) >= 4
        {
            let tail_start = index.saturating_sub(5);
            return Some(chars[tail_start..=index].iter().collect());
        }
    }
    None
}

#[derive(Debug, Clone)]
pub struct AlignOptions {
    /// Target language (the key of `doc.trans` / `doc.transAlign`).
    pub lang: String,
    pub mode: AlignMode,
    /// Threshold override. `None` derives the thresholds from the target language ([`TransParams::for_lang`]).
    pub params: Option<TransParams>,
    /// `Some`: process only the specified sentences (`--align-only --sentences …`).
    pub sentences: Option<BTreeSet<String>>,
    /// User-directed re-split (sentences named explicitly with `--sentences`). Kept as a run mode for audit artifacts. The first round and targeted repair now share the same triple-constraint paging algorithm and budget.
    pub targeted: bool,
    /// Re-split even when a valid entry already exists.
    pub force: bool,
    /// Explicit user instruction, appended to the end of the align contract. It is the key channel for targeted refine: check only describes "which sentences", while this describes "why and how to split". (The G3 baseline measured that without this channel, workers keep the faulty splits as they are.)
    pub instructions: Option<String>,
    /// A glossary target that must be shown word-for-word and must not be cut in the middle.
    pub protected_terms: Vec<String>,
    /// Semantic anchor of a bilingual glossary. When the source and target each have a unique hit in this sentence, they must fall in the same paired piece. This is a separate invariant from protected_terms' "must not be cut inside a word".
    pub bilingual_anchors: Vec<BilingualAnchor>,
    /// Concurrency slot count on the execution side (agent worker count / provider lane count). Reserved for the host to plan workers. Paging looks at the source word count, the sentence count and the deterministic carrier complexity, and does not change with the slot count.
    pub worker_slots: Option<usize>,
    /// Source-word-count dimension of the page budget (counted per [`word_count`]). Shared by the first round, the `--sentences` targeted repair and the global repair rounds. The engine applies a hard cap of 40 items plus the deterministic complexity budget, but worker slots do not change the page shape. The host takes [`crate::paging::PageExecutor::align_words`] from its executor.
    pub page_budget: usize,
    /// Number of global repair rounds this engine call may consume. Ordinary translate/align uses 1. The auto closing refine uses 0, because the main alignment already owns the one repair budget for the whole stage, and no `align-only` sub-call may regain a round.
    pub repair_calls: usize,
    /// LLM carrier for manyToOne (block-alignment edges by default).
    pub carrier: AlignCarrier,
    /// Display-row density. The default `Auto` keeps the existing many-to-one behaviour entirely.
    pub density: AlignDensity,
    /// When `density == Paired`, paired is applied only to these sentences. Empty means all targeted sentences in this round. Used by `refine-align` to fix only sticking sentences within a mixed hot-spot batch.
    pub density_sentences: BTreeSet<String>,
}

impl Default for AlignOptions {
    /// `lang` and `mode` have no meaningful default, so callers must supply them explicitly. The other fields are today's production defaults, so `..AlignOptions::default()` can safely fill in newly added fields.
    fn default() -> Self {
        Self {
            lang: String::new(),
            mode: AlignMode::ManyToOne,
            params: None,
            sentences: None,
            targeted: false,
            force: false,
            instructions: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            worker_slots: None,
            page_budget: crate::paging::budgets::ALIGN_PROVIDER_WORDS,
            repair_calls: GLOBAL_REPAIR_CALLS,
            carrier: AlignCarrier::default(),
            density: AlignDensity::Auto,
            density_sentences: BTreeSet::new(),
        }
    }
}

impl AlignOptions {
    fn density_for(&self, sentence_id: &str) -> AlignDensity {
        if self.density == AlignDensity::Paired
            && (self.density_sentences.is_empty() || self.density_sentences.contains(sentence_id))
        {
            AlignDensity::Paired
        } else {
            AlignDensity::Auto
        }
    }
}

/// LLM alignment carrier for manyToOne (block-alignment design §6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AlignCarrier {
    /// Block-alignment edges: `align-edges/1` + `align-rewrite/1` (default).
    #[default]
    Edges,
    /// Two-column split table `align-table/1`: the carrier for review and targeted repair.
    Table,
}

impl AlignCarrier {
    /// CLI values (`edges` / `table`).
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "edges" | "edge" | "align-edges" => Some(Self::Edges),
            "table" | "align-table" => Some(Self::Table),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Edges => "edges",
            Self::Table => "table",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilingualAnchor {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AlignOutcome {
    /// Number of sentences written to `transAlign` in this run.
    pub aligned_sentences: usize,
    /// Of those, the number stored without consuming any align LLM call: translate-fused drafts accepted directly.
    pub prealigned_sentences: usize,
    /// Number of sentences skipped because they need no entry or already have a valid entry.
    pub skipped_sentences: usize,
    /// Number of sentences that, after the manyToOne global repair budget ran out, fell back to deterministic target-language splitting with source-word-proportional anchoring.
    pub fallback_sentences: usize,
    /// Deprecated compatibility field. Long sentences now all go through batched LLM calls, so this is always 0.
    pub local_sentences: usize,
    /// Number of sentences stored after monotonic display rewriting (`transDisplay`, `text_basis: display`).
    pub rewritten_sentences: usize,
    /// Number of sentences degraded to sentence-level correspondence (`correspondence: sentence`).
    pub sentence_level_sentences: usize,
    /// Number of display rows merged away by deterministic post-processing on the rows pass-through path (see the criterion in [`crate::align_block::merge_short_rows`]). In practice the model mostly splits rows one-to-one along source groupings; this number is what the engine consolidates on its behalf.
    pub rows_merged: usize,
    /// Bookkeeping for the paired secondary correction.
    pub row_repair: RowRepairOutcome,
    /// Advisory violation; does not block.
    pub violations: Vec<String>,
}

impl Default for AlignOutcome {
    fn default() -> Self {
        Self {
            aligned_sentences: 0,
            prealigned_sentences: 0,
            skipped_sentences: 0,
            fallback_sentences: 0,
            local_sentences: 0,
            rewritten_sentences: 0,
            sentence_level_sentences: 0,
            rows_merged: 0,
            row_repair: RowRepairOutcome::default(),
            violations: Vec::new(),
        }
    }
}

/// A single round's `--json` expands at most this many rejected sentences one by one. A targeted round's sentence set is supplied by the caller and can be very long, but a JSONL line must not grow without bound with the sentence count, so beyond the cap only the count is recorded.
pub const ROW_REPAIR_REJECTION_DETAILS: usize = 40;

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowRepairOutcome {
    pub candidates: usize,
    pub repaired: usize,
    pub rejected: usize,
    pub capped: usize,
    /// Itemised details of rejected sentences, at most [`ROW_REPAIR_REJECTION_DETAILS`]. Counts alone cannot tell "38 candidates → 38 rejected → 0 repaired" apart: either acceptance was overly strict, or the batch simply cannot be cut into that many pieces in the target language. Recording the two metrics that give the lower bound makes it possible to assign responsibility afterwards.
    pub rejections: Vec<RowRepairRejection>,
    /// Number of rejected sentences omitted because of the cap (the part beyond `rejections`).
    pub rejections_truncated: usize,
}

/// Rejection details for one paired supplementary-row round.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowRepairRejection {
    pub sentence: String,
    /// Closed set: `no-write` (this round produced no write) | `rewritten-basis` (the result is based on the rewritten `transDisplay`) | `model-free` (the repair call got no usable answer, so the model-absent split in the budget tail would displace the model's alignment) | `not-improved` (the new split still hits the dwell predicate of `align-row-deficit`, and is not strictly better than the original).
    pub reason: &'static str,
    /// Number of source subtitle rows this sentence currently occupies.
    pub source_rows: usize,
    /// Display-unit count of the translation (CJK counted as full-width).
    pub target_units: usize,
    /// Suggested piece count in the contract hint, see [`paired_min_piece_count`]. This is guidance only: acceptance looks at the dwell predicate, not the piece count.
    pub required: usize,
    /// Number of pieces actually delivered in this round; 0 when no output was written.
    pub delivered: usize,
    /// `targetUnits / sourceRows`, two decimals. A value clearly below [`crate::align_block::ROW_MIN_UNITS`] means the translation does not have enough characters to fill the source rows. Such sentences cannot be repaired into rows however the hint is worded.
    pub units_per_row: f64,
}

/// Which counters a `transAlign` write is recorded on. Writing and bookkeeping must happen in pairs ([`push_write`] is the only entry point). Otherwise, when a write is discarded, there is no way to know which counter to roll back. An early version unconditionally did `aligned_sentences -= rejected`, which stole another sentence's count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WriteCredit {
    /// Regular storage: records only `aligned_sentences`.
    Aligned,
    /// Fused draft stored directly: `aligned_sentences` + `prealigned_sentences`.
    Prealigned,
    /// Monotonic display rewrite: `aligned_sentences` + `rewritten_sentences`.
    Rewritten,
    /// Degraded sentence-level correspondence: `aligned_sentences` + `sentence_level_sentences`.
    SentenceLevel,
    /// Deterministic fallback after the repair budget is exhausted: records only `fallback_sentences`.
    Fallback,
}

impl WriteCredit {
    fn apply(self, outcome: &mut AlignOutcome) {
        match self {
            Self::Aligned => outcome.aligned_sentences += 1,
            Self::Prealigned => {
                outcome.aligned_sentences += 1;
                outcome.prealigned_sentences += 1;
            }
            Self::Rewritten => {
                outcome.aligned_sentences += 1;
                outcome.rewritten_sentences += 1;
            }
            Self::SentenceLevel => {
                outcome.aligned_sentences += 1;
                outcome.sentence_level_sentences += 1;
            }
            Self::Fallback => outcome.fallback_sentences += 1,
        }
    }

    /// Rolls back the counters a write itself added when the write is discarded. `saturating_sub` is only defensive: every revert corresponds to one [`WriteCredit::apply`], so counters never go negative.
    fn revert(self, outcome: &mut AlignOutcome) {
        match self {
            Self::Aligned => {
                outcome.aligned_sentences = outcome.aligned_sentences.saturating_sub(1)
            }
            Self::Prealigned => {
                outcome.aligned_sentences = outcome.aligned_sentences.saturating_sub(1);
                outcome.prealigned_sentences = outcome.prealigned_sentences.saturating_sub(1);
            }
            Self::Rewritten => {
                outcome.aligned_sentences = outcome.aligned_sentences.saturating_sub(1);
                outcome.rewritten_sentences = outcome.rewritten_sentences.saturating_sub(1);
            }
            Self::SentenceLevel => {
                outcome.aligned_sentences = outcome.aligned_sentences.saturating_sub(1);
                outcome.sentence_level_sentences =
                    outcome.sentence_level_sentences.saturating_sub(1);
            }
            Self::Fallback => {
                outcome.fallback_sentences = outcome.fallback_sentences.saturating_sub(1)
            }
        }
    }
}

/// One `transAlign` write produced for a sentence in this round. The same sentence may be written more than once; a later write overrides an earlier one, consistent with `table.insert` semantics.
#[derive(Debug, Clone)]
struct AlignWrite {
    id: String,
    entry: TransAlign,
    credit: WriteCredit,
}

/// The sole entry point for a write plus its bookkeeping.
fn push_write(
    writes: &mut Vec<AlignWrite>,
    outcome: &mut AlignOutcome,
    id: String,
    entry: TransAlign,
    credit: WriteCredit,
) {
    credit.apply(outcome);
    writes.push(AlignWrite { id, entry, credit });
}

struct Pending<'a> {
    sentence: &'a Sentence,
    /// Source word indices participating in this delivery sentence. Normally
    /// this is the complete sentence; a final-timeline route may supply an
    /// ordered visible-word subset after cuts.
    anchor_indices: Vec<usize>,
    /// Source-word atoms within a sentence. The file carrier derives pause hints directly from timestamps.
    words: Vec<PendingWord>,
    translation: String,
    /// The currently accepted manyToOne split (non-empty during refine or force re-split). It serves as the baseline for the payload draft, so that a recomputed deterministic draft does not revert an already-fixed sentence to a bad split.
    existing: Option<ExistingAlign>,
    /// Kept when a fused draft's target pieces have passed target-side acceptance but the source anchor failed. The subsequent dedicated align may only re-choose source cut points and must not change these piece boundaries or text.
    frozen_target: Option<Vec<String>>,
    protected_terms: Vec<String>,
    bilingual_anchors: Vec<BilingualAnchor>,
    /// Source-Cue attribution (Cue id) at each position matching `anchor_indices`. The bilingual DP uses it to judge, with the same dwell predicate as `align-row-deficit`, whether a piece would stick. Empty means unknown, and the predicate is off (Pending constructed directly in unit tests).
    source_cue_keys: Vec<Option<String>>,
}

/// Payload seed for an accepted split: piece text + in-sentence word-order interval.
struct ExistingAlign {
    texts: Vec<String>,
    ranges: Vec<(usize, usize)>,
}

struct PendingWord {
    text: String,
    /// "Attach to previous" marker in the script: no space is inserted between this word and the preceding word when the source text is concatenated.
    glue: bool,
    // The file carrier re-derives pause hints from timestamps. This cache tier is used only by unit tests for source rendering and boundary diagnostics; it does not take part in paging and does not enter any carrier.
    #[cfg_attr(not(test), allow(dead_code))]
    pause_before: u8,
    /// Speech start and end (seconds). The per-piece time budget (draft seconds, duration advisory) depends on these.
    t0: f64,
    t1: f64,
}

/// The "attach to previous" markers for anchored words in a sentence; an empty table when there are none.
fn source_glue(words: &[PendingWord]) -> Vec<bool> {
    if words.iter().any(|word| word.glue) {
        words.iter().map(|word| word.glue).collect()
    } else {
        Vec::new()
    }
}

impl JoinWord for PendingWord {
    fn join_text(&self) -> &str {
        &self.text
    }
    fn glued(&self) -> bool {
        self.glue
    }
}

/// Block-alignment draft produced alongside the translate call (block-alignment design §6.1): translation semantic block → source word index (0-based, same indices as `TransAlign.words`). The engine expands it into alignment edges and then follows exactly the same deterministic block merging and bilingual DP as the dedicated `align-edges`. Any failure merely makes this sentence fall back to the dedicated call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FusionDraft {
    pub chunks: Vec<AlignChunk>,
    /// A draft that forms a qualifying **row partition** (each block's ordinals are consecutive and increasing, blocks abut head to tail, and together they cover `1..N`). The engine can store it directly as display rows, skipping the align call.
    pub rows: bool,
    /// All row boundaries fall on the deterministic group boundaries supplied by the carrier. Failing this does **not** affect acceptance; it is used only for counting observations, since grouping is a hint, not a hard contract.
    pub on_groups: bool,
    /// Draft for the line-text carrier (`lines/1`): blocks are marked by first and last source-word references, which the engine jointly locates via [`crate::filepipe::lines::evidence_with_pieces`]. When `Some`, `chunks` is empty and `rows` is false.
    pub lines: Option<crate::filepipe::TranslateLinesDraft>,
}

pub type FusionDrafts = BTreeMap<String, FusionDraft>;

/// A deterministic source-side group: a closed 0-based in-sentence word-index interval plus a time window relative to the sentence start.
///
/// Times are stored as **tenths of a second** (0.1 s) rather than `f64`. The carrier attribute renders only one decimal place, so integer storage keeps rendering, parsing and structural equality all on the same source.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FusionGroup {
    pub from: usize,
    pub to: usize,
    /// Offset of the group start relative to the sentence start, in units of 0.1 s.
    pub t0_ds: u32,
    /// Offset of the group end relative to the sentence start, in units of 0.1 s.
    pub t1_ds: u32,
}

/// A fusion hint for the translation carrier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FusionLineInfo {
    /// Anchored words within the sentence. Order is the index: one word per index, on the same basis as `TransAlign.words`.
    pub source_words: Vec<String>,
    /// "Attach to previous" markers at the same indices as `source_words`; empty means none.
    pub source_glue: Vec<bool>,
    pub needs_split: bool,
    /// Deterministic source-side groups (rendered only in rows mode). Empty means no grouping hint is included.
    pub groups: Vec<FusionGroup>,
}

/// Duration upper bound (seconds) for re-splitting a group.
const FUSION_GROUP_MAX_SECONDS: f64 = 5.0;
/// Word-count upper bound for re-splitting a group.
const FUSION_GROUP_MAX_WORDS: usize = 14;
/// Word-count threshold (words) below which a small group merges into an adjacent group.
const FUSION_GROUP_MIN_WORDS: usize = 3;
/// Duration threshold (seconds) below which a small group merges into an adjacent group.
const FUSION_GROUP_MIN_SECONDS: f64 = 0.8;
/// Minimum silence between words (seconds) for a group cut point.
const FUSION_GROUP_GAP_SEC: f64 = 0.35;

/// A word that ends a clause with punctuation: cutting after this word is a natural source-side group seam.
fn ends_group_punctuation(text: &str) -> bool {
    matches!(
        text.trim_end().chars().last(),
        Some(',' | ';' | ':' | '—' | '–' | '，' | '；' | '：' | '、' | '…')
    )
}

/// Deterministic source-side grouping (the carrier hint for rows mode). Zero LLM, zero randomness.
///
/// - Seed boundaries preferentially reuse the **source-side line splits that already exist** (`seeds` are the start word indices of each source subtitle Cue within the sentence, derived from `breaks`/`autoBreaks` by [`crate::cue::derive_cues`]).
/// - Two local rules are added on top: the preceding word ends with a clause-level punctuation mark, or the silence between words is ≥ [`FUSION_GROUP_GAP_SEC`].
/// - Small groups (< [`FUSION_GROUP_MIN_WORDS`] words and < [`FUSION_GROUP_MIN_SECONDS`] seconds) merge into adjacent groups.
/// - Large groups (> [`FUSION_GROUP_MAX_SECONDS`] seconds or > [`FUSION_GROUP_MAX_WORDS`] words) are re-split recursively at the largest internal pause, keeping at least 2 words on each side.
fn fusion_groups(words: &[PendingWord], seeds: &BTreeSet<usize>) -> Vec<FusionGroup> {
    if words.is_empty() {
        return Vec::new();
    }
    let mut starts: Vec<usize> = vec![0];
    for index in 1..words.len() {
        let seeded = seeds.contains(&index);
        let punctuated = ends_group_punctuation(&words[index - 1].text);
        let paused = words[index].t0 - words[index - 1].t1 >= FUSION_GROUP_GAP_SEC;
        if seeded || punctuated || paused {
            starts.push(index);
        }
    }
    let mut spans: Vec<(usize, usize)> = Vec::with_capacity(starts.len());
    for (position, &start) in starts.iter().enumerate() {
        let end = starts.get(position + 1).copied().unwrap_or(words.len()) - 1;
        spans.push((start, end));
    }

    // Small-group merging: prefer merging into the left neighbour; a group at the start of the sentence merges into the right neighbour. Merging only ever reduces the number of groups, so it always converges.
    let small = |span: &(usize, usize)| -> bool {
        let count = span.1 - span.0 + 1;
        let seconds = words[span.1].t1 - words[span.0].t0;
        count < FUSION_GROUP_MIN_WORDS && seconds < FUSION_GROUP_MIN_SECONDS
    };
    while spans.len() > 1 {
        let Some(index) = spans.iter().position(small) else {
            break;
        };
        if index > 0 {
            spans[index - 1].1 = spans[index].1;
            spans.remove(index);
        } else {
            spans[1].0 = spans[0].0;
            spans.remove(0);
        }
    }

    // Large-group re-split: cut at the largest internal pause, keeping at least 2 words on each side.
    let mut queue = spans;
    let mut out: Vec<(usize, usize)> = Vec::with_capacity(queue.len());
    while !queue.is_empty() {
        let span = queue.remove(0);
        let count = span.1 - span.0 + 1;
        let seconds = words[span.1].t1 - words[span.0].t0;
        let oversized = seconds > FUSION_GROUP_MAX_SECONDS || count > FUSION_GROUP_MAX_WORDS;
        let cut = (oversized && count >= 4)
            .then(|| {
                (span.0 + 2..=span.1 - 1)
                    .map(|index| (words[index].t0 - words[index - 1].t1, index))
                    .max_by(|a, b| a.0.total_cmp(&b.0).then(b.1.cmp(&a.1)))
                    .map(|(_, index)| index)
            })
            .flatten();
        match cut {
            Some(index) => {
                queue.insert(0, (index, span.1));
                queue.insert(0, (span.0, index - 1));
            }
            None => out.push(span),
        }
    }

    let origin = words[0].t0;
    let deciseconds = |value: f64| -> u32 { ((value - origin).max(0.0) * 10.0).round() as u32 };
    out.into_iter()
        .map(|(from, to)| FusionGroup {
            from,
            to,
            t0_ds: deciseconds(words[from].t0),
            t1_ds: deciseconds(words[to].t1),
        })
        .collect()
}

/// Builds the fusion hint for the translate `file-v1` carrier: the ordinal word list, the "source side already needs splitting" criterion, and (when `with_groups`) the deterministic source-side grouping.
pub fn fusion_line_info(
    doc: &TranscriptDoc,
    cues: &[crate::cue::Cue],
    sentence: &Sentence,
    with_groups: bool,
) -> FusionLineInfo {
    let words = sentence
        .word_indices
        .iter()
        .map(|&index| PendingWord {
            text: doc.words[index].text.clone(),
            glue: doc.words[index].glue,
            pause_before: 0,
            t0: doc.words[index].t0,
            t1: doc.words[index].t1,
        })
        .collect::<Vec<_>>();
    let (source_fit, _) = source_piece_budgets(&doc.lang);
    // Source-side row boundaries: the in-sentence index of the first word of each source subtitle Cue.
    let seeds: BTreeSet<usize> = if with_groups {
        let position: BTreeMap<usize, usize> = sentence
            .word_indices
            .iter()
            .enumerate()
            .map(|(ordinal, &index)| (index, ordinal))
            .collect();
        sentence
            .cue_indices
            .iter()
            .filter_map(|&cue| cues.get(cue))
            .filter_map(|cue| cue.word_indices.first())
            .filter_map(|index| position.get(index).copied())
            .filter(|&ordinal| ordinal > 0)
            .collect()
    } else {
        BTreeSet::new()
    };
    FusionLineInfo {
        source_words: words.iter().map(|word| word.text.clone()).collect(),
        source_glue: source_glue(&words),
        needs_split: source_length_units(&words, &doc.lang) > source_fit
            || words_dwell_seconds(&words) > LONG_DWELL_SECONDS,
        groups: if with_groups {
            fusion_groups(&words, &seeds)
        } else {
            Vec::new()
        },
    }
}

/// Speech dwell duration of a sentence (or of its visible word subset): end of the last word minus start of the first word.
fn words_dwell_seconds(words: &[PendingWord]) -> f64 {
    match (words.first(), words.last()) {
        (Some(first), Some(last)) => (last.t1 - first.t0).max(0.0),
        _ => 0.0,
    }
}

fn words_dwell_seconds_for_indices(doc: &TranscriptDoc, indices: &[usize]) -> f64 {
    match (indices.first(), indices.last()) {
        (Some(&first), Some(&last)) => (doc.words[last].t1 - doc.words[first].t0).max(0.0),
        _ => 0.0,
    }
}

/// Inter-word pause tiers: ≥1.2s → 3, ≥0.6s → 2, ≥0.25s → 1, otherwise 0.
fn pause_tier(gap: f64) -> u8 {
    if gap >= 1.2 {
        3
    } else if gap >= 0.6 {
        2
    } else if gap >= 0.25 {
        1
    } else {
        0
    }
}

/// Display segmentation and alignment. Deterministic mode uses zero LLM; manyToOne uses the batched pieces protocol.
pub fn run_align(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    sleep: &mut dyn FnMut(f64),
) -> Result<AlignOutcome, LlmError> {
    run_align_with_projection(
        doc,
        llm,
        options,
        None,
        &FusionDrafts::new(),
        &mut |_| {},
        sleep,
    )
}

/// Batch-level attempt (`ai/align/<lang>/vNNN/`, §4/§11). `page_id` is the batch number (`b001`…; repair rounds use `r001`…).
pub type AlignBatchAttempt<'a> = PageAttempt<'a>;

/// Same as [`run_align`], but also hands the batch-level attempts to the host for persisting (`ai/align/<lang>/vNNN/`, §4/§11).
pub fn run_align_with_artifacts(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
    sleep: &mut dyn FnMut(f64),
) -> Result<AlignOutcome, LlmError> {
    run_align_with_projection(
        doc,
        llm,
        options,
        None,
        &FusionDrafts::new(),
        on_attempt,
        sleep,
    )
}

/// Same as [`run_align_with_artifacts`], but first checks the fused drafts that translate provided, using exactly the same acceptance check. Sentences that pass generate no dedicated align call.
pub fn run_align_with_drafts_and_artifacts(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    drafts: &FusionDrafts,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
    sleep: &mut dyn FnMut(f64),
) -> Result<AlignOutcome, LlmError> {
    run_align_with_projection(doc, llm, options, None, drafts, on_attempt, sleep)
}

/// Align translations against the ordered word subset visible in the final
/// timeline. Keys absent from `visible_words` retain normal whole-sentence
/// behavior. The persisted sentence id remains source-owned while
/// `TransAlign.words` snapshots the exact delivery anchors.
pub fn run_align_projected(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    visible_words: &BTreeMap<String, Vec<String>>,
    sleep: &mut dyn FnMut(f64),
) -> Result<AlignOutcome, LlmError> {
    run_align_with_projection(
        doc,
        llm,
        options,
        Some(visible_words),
        &FusionDrafts::new(),
        &mut |_| {},
        sleep,
    )
}

fn run_align_with_projection(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    visible_words: Option<&BTreeMap<String, Vec<String>>>,
    drafts: &FusionDrafts,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
    _sleep: &mut dyn FnMut(f64),
) -> Result<AlignOutcome, LlmError> {
    // The normal translate path already formats the text when each page is persisted. align-only may also read older, unformatted translations, so the same idempotent hook is applied before pieces are derived; this guarantees the final sentence and the aligned pieces share exactly the same character stream.
    if let Some(table) = doc.trans.get_mut(&options.lang) {
        format_translation_map(
            table,
            &options.lang,
            options.sentences.as_ref(),
            &options.protected_terms,
        );
    }
    let cue_params = crate::layout_profile::cue_params_for_doc(doc);
    let cues = derive_cues(doc, &cue_params);
    let sentences = derive_sentences(doc, &cues);
    let cue_ids_by_index = cues
        .iter()
        .flat_map(|cue| {
            cue.word_indices
                .iter()
                .copied()
                .map(|word_index| (word_index, cue.id.clone()))
        })
        .collect::<BTreeMap<_, _>>();
    let params = options
        .params
        .unwrap_or_else(|| TransParams::for_lang(&options.lang));

    let mut outcome = AlignOutcome::default();
    let mut paired_requirements: BTreeMap<String, PairedRequirement> = BTreeMap::new();
    let mut paired_baselines: BTreeMap<String, PairedBaseline> = BTreeMap::new();

    // display-stale: for sentences whose `trans` has changed, first delete the stale `transDisplay` and its display-basis entry (block-alignment design §5), then enter the normal incremental decision.
    purge_stale_display(doc, &options.lang, &sentences);

    // Orphan cleanup: if an entry's sentence id is no longer in the current derivation, remove the entry. The translated truth `trans` is kept, and check reports orphans. A split has no meaning for the host, and keeping it would only mislead the display side.
    let valid_ids: BTreeSet<&str> = sentences.iter().map(|s| s.id.as_str()).collect();
    if let Some(table) = doc.trans_align.get_mut(&options.lang) {
        table.retain(|id, _| valid_ids.contains(id.as_str()));
    }

    let mut pending: Vec<Pending> = Vec::new();
    let mut writes: Vec<AlignWrite> = Vec::new();
    // Display-rewrite write-back: sentence id → `transDisplay`. The natural translation `trans` is left untouched; the entry declares its basis as `text_basis: display`, and is committed atomically in the same batch as the alignment entries.
    let mut display_writes: Vec<(String, TransDisplay)> = Vec::new();
    let mut removals: Vec<String> = Vec::new();

    for sentence in &sentences {
        if let Some(filter) = &options.sentences
            && !filter.contains(&sentence.id)
        {
            continue;
        }
        let Some(translation) = doc
            .trans
            .get(&options.lang)
            .and_then(|table| table.get(&sentence.id))
            .map(|text| text.trim().to_owned())
        else {
            continue; // Untranslated sentences are not aligned.
        };
        if translation.is_empty() {
            outcome
                .violations
                .push(format!("{}: empty translation — skipped", sentence.id));
            continue;
        }
        let anchor_indices = match visible_words.and_then(|rows| rows.get(&sentence.id)) {
            Some(ids) => projected_word_indices(doc, sentence, ids)?,
            None => sentence.word_indices.clone(),
        };
        let projected = anchor_indices != sentence.word_indices;
        let anchor_ids = anchor_indices
            .iter()
            .map(|&index| doc.words[index].id.clone())
            .collect::<Vec<_>>();
        let density = options.density_for(&sentence.id);
        if density == AlignDensity::Paired {
            let source_rows = source_rows_for_indices(doc, &anchor_indices, &cue_ids_by_index);
            let target_units = crate::split::piece_display_units(&translation, &options.lang);
            paired_requirements.insert(
                sentence.id.clone(),
                PairedRequirement::new(source_rows, target_units),
            );
            let source_cue_keys: Vec<Option<String>> = anchor_indices
                .iter()
                .map(|index| cue_ids_by_index.get(index).cloned())
                .collect();
            let previous = doc
                .trans_align
                .get(&options.lang)
                .and_then(|table| table.get(&sentence.id))
                .filter(|entry| {
                    align_entry_valid_for_lang(doc, sentence, &options.lang, entry)
                        && alignment_anchors_match(entry, &anchor_ids, projected)
                });
            let before = match previous {
                Some(entry) => DwellShape::of_entry(doc, &anchor_indices, &source_cue_keys, entry),
                None => DwellShape::of(
                    doc,
                    &anchor_indices,
                    &source_cue_keys,
                    &[(0, anchor_indices.len().saturating_sub(1))],
                    false,
                ),
            };
            // The original state is "invalid", not "no entry needed": either an entry exists but is no longer valid, or there is no entry and the whole sentence cannot fit on one row (the display side can then only place a single align-stale fallback cue).
            let had_entry = doc
                .trans_align
                .get(&options.lang)
                .is_some_and(|table| table.contains_key(&sentence.id));
            let stale = previous.is_none()
                && (had_entry
                    || exceeds_one_line_fit(&translation, &options.lang, params.fit)
                    || target_units > params.hard);
            paired_baselines.insert(
                sentence.id.clone(),
                PairedBaseline {
                    anchor_indices: anchor_indices.clone(),
                    source_cue_keys,
                    before,
                    stale,
                    previous_aligner: previous.and_then(|entry| entry.aligner.clone()),
                },
            );
            outcome.row_repair.candidates += 1;
        }

        // Whether this sentence needs no entry at all under the current mode.
        // CucCut's two-phase model: Phase 1 always translates the whole sentence; Phase 2 handles translations that exceed one-line fit or hard. Many-to-one is the default shape: when the translation fits on one line, several short source phrases can share that one translation, and the translation is not forced to split just because the source is long.
        // The only exception is the time guardrail: when the whole-sentence time window exceeds LONG_DWELL_SECONDS, a single subtitle would stay pinned on screen, so the sentence is still queued for LLM splitting.
        // fit is the visual one-line trigger; hard is the delivery hard cap. hard must still be checked explicitly, so that even when parameters are overridden, no sentence over the limit is skipped.
        // The second exception is the source-side guardrail: displaying the whole sentence is itself a paired row. When a source row exceeds the paired hard cap, the bilingual row cannot be read in full, so even if the translation fits on one line, it must be queued for LLM splitting at a natural target-language seam. The criterion shares one predicate with `ccut check`'s align-source-ceiling; the threshold is not copied here.
        let dwell = words_dwell_seconds_for_indices(doc, &anchor_indices);
        let source_ceiling = {
            let anchor_words = anchor_indices
                .iter()
                .map(|&index| &doc.words[index])
                .collect::<Vec<_>>();
            whole_sentence_source_ceiling_issue(
                &anchor_words,
                &translation,
                &doc.lang,
                &options.lang,
            )
        };
        let no_entry_needed = density != AlignDensity::Paired
            && !exceeds_one_line_fit(&translation, &options.lang, params.fit)
            && crate::split::piece_display_units(&translation, &options.lang) <= params.hard
            && dwell <= LONG_DWELL_SECONDS
            && source_ceiling.is_none();
        if no_entry_needed {
            if projected {
                let (mode, words, from, to) = match options.mode {
                    AlignMode::ManyToOne => (
                        AlignMode::ManyToOne,
                        anchor_ids,
                        Some(0),
                        Some(anchor_indices.len() - 1),
                    ),
                    AlignMode::Independent => (AlignMode::Independent, anchor_ids, None, None),
                    AlignMode::OneToOne => {
                        return Err(LlmError::Malformed(
                            "oneToOne is a legacy source-Cue mode; use manyToOne or independent so translation cues derive only from sentences"
                                .to_owned(),
                        ));
                    }
                };
                push_write(
                    &mut writes,
                    &mut outcome,
                    sentence.id.clone(),
                    TransAlign::new(
                        mode,
                        words,
                        vec![TransPiece {
                            from,
                            to,
                            text: translation,
                        }],
                    ),
                    WriteCredit::Aligned,
                );
            } else {
                removals.push(sentence.id.clone());
                outcome.skipped_sentences += 1;
            }
            continue;
        }

        // A valid entry in the same mode already exists: skip unless `force`.
        if !options.force
            && let Some(entry) = doc
                .trans_align
                .get(&options.lang)
                .and_then(|table| table.get(&sentence.id))
            && entry.mode == options.mode
            && align_entry_valid_for_lang(doc, sentence, &options.lang, entry)
            && alignment_anchors_match(entry, &anchor_ids, projected)
        {
            outcome.skipped_sentences += 1;
            continue;
        }

        match options.mode {
            AlignMode::OneToOne => {
                return Err(LlmError::Malformed(
                    "oneToOne is a legacy source-Cue mode; use manyToOne or independent so translation cues derive only from sentences"
                        .to_owned(),
                ));
            }
            AlignMode::Independent => {
                let pieces = split_independent_for_lang_protected(
                    &translation,
                    &params,
                    anchor_indices.len(),
                    &options.lang,
                    &options.protected_terms,
                );
                if pieces.len() <= 1 {
                    if projected {
                        push_write(
                            &mut writes,
                            &mut outcome,
                            sentence.id.clone(),
                            TransAlign::new(
                                AlignMode::Independent,
                                anchor_ids,
                                vec![TransPiece {
                                    from: None,
                                    to: None,
                                    text: translation,
                                }],
                            ),
                            WriteCredit::Aligned,
                        );
                    } else {
                        // The splitter decided to keep the whole sentence (for example, a soft..hard interval with no safe seam).
                        removals.push(sentence.id.clone());
                        outcome.skipped_sentences += 1;
                    }
                    continue;
                }
                push_write(
                    &mut writes,
                    &mut outcome,
                    sentence.id.clone(),
                    TransAlign::new(
                        AlignMode::Independent,
                        if projected { anchor_ids } else { Vec::new() },
                        pieces
                            .into_iter()
                            .map(|text| TransPiece {
                                from: None,
                                to: None,
                                text,
                            })
                            .collect(),
                    ),
                    WriteCredit::Aligned,
                );
            }
            AlignMode::ManyToOne => {
                // Short sentences already finished in the no_entry_needed branch. Every long sentence that needs display splitting must go into the batched LLM below, and must not use local proportional anchoring to pass as semantic alignment.
                let words: Vec<PendingWord> = sentence
                    .word_indices
                    .iter()
                    .filter(|index| anchor_indices.contains(index))
                    .enumerate()
                    .map(|(ordinal, &index)| PendingWord {
                        text: doc.words[index].text.clone(),
                        glue: doc.words[index].glue,
                        pause_before: if ordinal == 0 {
                            0
                        } else {
                            let prev = anchor_indices[ordinal - 1];
                            pause_tier(doc.words[index].t0 - doc.words[prev].t1)
                        },
                        t0: doc.words[index].t0,
                        t1: doc.words[index].t1,
                    })
                    .collect();
                // On a force re-split (refine path), the current valid split is used as the baseline for the payload draft. Piece intervals are in-sentence word-order indices.
                let existing = doc
                    .trans_align
                    .get(&options.lang)
                    .and_then(|table| table.get(&sentence.id))
                    .filter(|entry| {
                        entry.mode == AlignMode::ManyToOne
                            && entry.text_basis == TextBasis::Trans
                            && align_entry_valid_for_lang(doc, sentence, &options.lang, entry)
                    })
                    .and_then(|entry| {
                        if !alignment_anchors_match(entry, &anchor_ids, projected) {
                            return None;
                        }
                        let mut ranges = Vec::with_capacity(entry.pieces.len());
                        let mut texts = Vec::with_capacity(entry.pieces.len());
                        for piece in &entry.pieces {
                            let (Some(from), Some(to)) = (piece.from, piece.to) else {
                                return None;
                            };
                            ranges.push((from, to));
                            texts.push(piece.text.clone());
                        }
                        Some(ExistingAlign { texts, ranges })
                    });
                let protected_terms = options
                    .protected_terms
                    .iter()
                    .filter(|term| {
                        translation.contains(term.as_str())
                            && target_cps_chars(term, &options.lang) <= params.fit
                    })
                    .cloned()
                    .collect();
                let word_refs = words
                    .iter()
                    .map(|word: &PendingWord| word.text.as_str())
                    .collect::<Vec<_>>();
                let bilingual_anchors = options
                    .bilingual_anchors
                    .iter()
                    .filter(|anchor| {
                        !anchor.source.trim().is_empty()
                            && !anchor.target.trim().is_empty()
                            && !source_anchor_matches(&word_refs, &anchor.source).is_empty()
                            && translation.contains(&anchor.target)
                    })
                    .cloned()
                    .collect();
                let source_cue_keys = anchor_indices
                    .iter()
                    .map(|index| cue_ids_by_index.get(index).cloned())
                    .collect();
                pending.push(Pending {
                    sentence,
                    anchor_indices,
                    words,
                    translation,
                    existing,
                    frozen_target: None,
                    protected_terms,
                    bilingual_anchors,
                    source_cue_keys,
                });
            }
        }
    }

    let mut execution_options = options.clone();
    execution_options.instructions =
        paired_prompt_instructions(options.instructions.as_deref(), &paired_requirements);
    // Only paired rounds have the concept of "cut off by this round's cap, left for the next round". The auto round's `density_sentences` does not take part in per-sentence judgment, so `capped` must always be 0.
    outcome.row_repair.capped = if options.density == AlignDensity::Paired {
        options
            .density_sentences
            .len()
            .saturating_sub(outcome.row_repair.candidates)
    } else {
        0
    };

    // Fused draft (carrier-agnostic): block-alignment edges annotated by translate go through the deterministic block check first.
    let verdicts = accept_fused_drafts(
        doc,
        &execution_options,
        &params,
        pending,
        drafts,
        &mut writes,
        &mut outcome,
    );
    let mut remaining = Vec::new();
    let mut rewrites = Vec::new();
    for verdict in verdicts {
        match verdict {
            FusedVerdict::Pending(item) => remaining.push(item),
            FusedVerdict::NeedsRewrite(item, hint) => rewrites.push((item, hint)),
        }
    }

    match options.carrier {
        AlignCarrier::Edges => {
            run_edges_carrier(
                doc,
                llm,
                &execution_options,
                &params,
                remaining,
                rewrites,
                LLM_CHUNK_ALIGNER_TAG,
                on_attempt,
                &mut writes,
                &mut display_writes,
                &mut outcome,
            )?;
        }
        AlignCarrier::Table => {
            // The table carrier has its own reorder/crossing policy: sentences that need rewriting go into the table round together.
            let pending: Vec<Pending> = remaining
                .into_iter()
                .chain(rewrites.into_iter().map(|(item, _)| item))
                .collect();
            run_table_carrier(
                doc,
                llm,
                &execution_options,
                &params,
                pending,
                &paired_requirements,
                on_attempt,
                &mut writes,
                &mut display_writes,
                &mut outcome,
            )?;
        }
    }

    // Paired is a display-level re-split and is not allowed to write `transDisplay` as a side effect. Results are accepted against the dwell predicate of `align-row-deficit` (see the per-sentence judgment below). If rejected, this round's writes are discarded and the original entry or state is kept.
    //
    // The judgment is made on **each sentence's last write**. The same sentence may be written several times (a rewrite round may be followed by a fallback round that overrides it), and since `table.insert` on storage lets a later write override an earlier one, acceptance must use the same basis.
    let mut paired_last_write: BTreeMap<&str, usize> = BTreeMap::new();
    for (index, write) in writes.iter().enumerate() {
        if paired_requirements.contains_key(&write.id) {
            paired_last_write.insert(write.id.as_str(), index);
        }
    }
    // The actual shape of each rejected sentence (no write produced / rewritten basis / not improved), plus the "partial repair accepted" hint. The violation text must describe what actually happened.
    let mut rejection_reasons: Vec<(String, String)> = Vec::new();
    let mut rejections: Vec<RowRepairRejection> = Vec::new();
    let mut paired_accepted: BTreeSet<String> = BTreeSet::new();
    let mut kept_write_indices: BTreeSet<usize> = BTreeSet::new();
    for (id, requirement) in &paired_requirements {
        let Some(&index) = paired_last_write.get(id.as_str()) else {
            rejections.push(requirement.rejection(id, "no-write", 0));
            rejection_reasons.push((
                id.clone(),
                "paired row repair produced no alignment this round (the sentence was skipped or its LLM call did not yield an acceptable result); kept the previous alignment".to_owned(),
            ));
            continue;
        };
        let entry = &writes[index].entry;
        if entry.text_basis != TextBasis::Trans {
            rejections.push(requirement.rejection(id, "rewritten-basis", entry.pieces.len()));
            rejection_reasons.push((
                id.clone(),
                "paired row repair rejected — the result is based on rewritten `transDisplay` text instead of the natural `trans` text; kept the previous alignment".to_owned(),
            ));
            continue;
        }
        // Acceptance is judged by the dwell predicate of `align-row-deficit`, not by piece count. The piece-count floor is only guidance in the contract ("aim for N"). Accept if sticking is eliminated. Also accept if it still sticks but is strictly better (fewer sticking rows, shorter dwell, or fewer covered source rows), keeping a warning. If the original entry is already invalid, accept as long as it is no worse than the whole-sentence fallback.
        let baseline = &paired_baselines[id];
        // When the repair call gets no usable answer, the budget tail falls back to model-absent splits (equal-width or pure anchoring). Clearing sticking rows only because the split got finer is not a more correct correspondence. If the original entry came from the model, keep it as it is, the same treatment as "this round produced no write". (Scene: in one stanford batch, `align-edge-ordinal` rejections replaced the `llm-lines` alignments of 4 sentences from the same batch with `deterministic/1` / `anchor/1`, and one sentence's dwell only shrank from 6.8s to 6.5s.)
        if !baseline.stale
            && model_backed_aligner(baseline.previous_aligner.as_deref())
            && !model_backed_aligner(entry.aligner.as_deref())
        {
            rejections.push(requirement.rejection(id, "model-free", entry.pieces.len()));
            rejection_reasons.push((
                id.clone(),
                format!(
                    "paired row repair rejected — the repair call did not yield an acceptable answer and the model-free `{}` split would replace the `{}` alignment; kept the previous alignment",
                    entry.aligner.as_deref().unwrap_or("-"),
                    baseline.previous_aligner.as_deref().unwrap_or("-"),
                ),
            ));
            continue;
        }
        let after = DwellShape::of_entry(
            doc,
            &baseline.anchor_indices,
            &baseline.source_cue_keys,
            entry,
        );
        let before = baseline.before;
        if after.deficit {
            let improved = after.strictly_better_than(&before)
                || (baseline.stale && after.not_worse_than(&before));
            if !improved {
                rejections.push(requirement.rejection(id, "not-improved", entry.pieces.len()));
                rejection_reasons.push((
                    id.clone(),
                    format!(
                        "paired row repair rejected — the new alignment ({} piece(s)) still has {} stuck row(s) (longest {:.1}s over {} source rows) and is not better than before ({} stuck row(s), longest {:.1}s over {} source rows); kept the previous alignment",
                        entry.pieces.len(),
                        after.offending,
                        after.worst_dwell,
                        after.worst_rows,
                        before.offending,
                        before.worst_dwell,
                        before.worst_rows,
                    ),
                ));
                continue;
            }
            rejection_reasons.push((
                id.clone(),
                format!(
                    "paired row repair accepted a partial fix — {} stuck row(s) remain (longest {:.1}s over {} source rows; before: {} stuck row(s), longest {:.1}s over {} source rows); align-row-deficit still applies",
                    after.offending,
                    after.worst_dwell,
                    after.worst_rows,
                    before.offending,
                    before.worst_dwell,
                    before.worst_rows,
                ),
            ));
        }
        paired_accepted.insert(id.clone());
        kept_write_indices.insert(index);
    }
    drop(paired_last_write);

    display_writes.retain(|(id, _)| !paired_requirements.contains_key(id));
    removals.retain(|id| !paired_requirements.contains_key(id));
    // When a write is discarded, roll back **only** the counters it itself added (see [`WriteCredit`]). A rejected sentence may have taken the fallback path or not written at all, and unconditionally subtracting `aligned_sentences` would steal another sentence's count.
    let mut write_index = 0usize;
    writes.retain(|write| {
        let index = write_index;
        write_index += 1;
        if !paired_requirements.contains_key(&write.id) || kept_write_indices.contains(&index) {
            return true;
        }
        write.credit.revert(&mut outcome);
        false
    });
    outcome.row_repair.repaired = paired_accepted.len();
    outcome.row_repair.rejected = outcome
        .row_repair
        .candidates
        .saturating_sub(outcome.row_repair.repaired);
    outcome.row_repair.rejections_truncated = rejections
        .len()
        .saturating_sub(ROW_REPAIR_REJECTION_DETAILS);
    rejections.truncate(ROW_REPAIR_REJECTION_DETAILS);
    outcome.row_repair.rejections = rejections;
    for (id, reason) in rejection_reasons {
        outcome.violations.push(format!("{id}: {reason}"));
    }

    // The display rewrite is stored before the alignment entries: an entry with `text_basis: display` uses it as its basis text. The two must be updated in the same batch to keep the invariant "piece concatenation == basis translation". `trans` is untouched.
    if !display_writes.is_empty() {
        let table = doc.trans_display.entry(options.lang.clone()).or_default();
        for (id, display) in display_writes {
            table.insert(id, display);
        }
    }
    // Entries newly accepted by paired always use `trans` as the basis (the validator guarantees this). If the sentence still holds a `transDisplay` entry from the previous round, it becomes an orphan that no entry refers to, and downstream would render by display text rather than the natural translation, so it is cleared together with the new entry.
    if !paired_accepted.is_empty()
        && let Some(table) = doc.trans_display.get_mut(&options.lang)
    {
        for id in &paired_accepted {
            table.remove(id);
        }
        if table.is_empty() {
            doc.trans_display.remove(&options.lang);
        }
    }
    let table = doc.trans_align.entry(options.lang.clone()).or_default();
    for id in removals {
        table.remove(&id);
    }
    for write in writes {
        table.insert(write.id, write.entry);
    }
    if table.is_empty() {
        doc.trans_align.remove(&options.lang);
    }
    Ok(outcome)
}

// ---- Block-alignment-edges carrier (block-alignment design §4 / §6) -----------------------------------

/// Per-sentence verdict for a fused draft.
enum FusedVerdict<'a> {
    /// No draft, the draft has no evidence, or the evidence only supports sentence-level correspondence: goes to the dedicated round.
    Pending(Pending<'a>),
    /// After draft alignment, a block is over hard: goes to the monotonic rewrite round (or the table round for the table carrier). Carries the `data-over-hard` hint text.
    NeedsRewrite(Pending<'a>, String),
}

/// Translate fused drafts go through the deterministic block check sentence by sentence (block-alignment design §4.5). `Aligned` is stored directly, consuming no align call. `NeedsRewrite` goes to the rewrite round. A `SentenceLevel` from a fused draft is **not** accepted directly: it only means "the draft evidence is insufficient", so it goes to the dedicated round to get a second block annotation.
fn accept_fused_drafts<'a>(
    doc: &TranscriptDoc,
    options: &AlignOptions,
    params: &TransParams,
    pending: Vec<Pending<'a>>,
    drafts: &FusionDrafts,
    writes: &mut Vec<AlignWrite>,
    outcome: &mut AlignOutcome,
) -> Vec<FusedVerdict<'a>> {
    let mut verdicts = Vec::with_capacity(pending.len());
    for item in pending {
        let Some(draft) = drafts
            .get(&item.sentence.id)
            .filter(|draft| !draft.chunks.is_empty() || draft.lines.is_some())
        else {
            verdicts.push(FusedVerdict::Pending(item));
            continue;
        };
        // Draft for the line-text carrier: each block's source interval is located jointly from its first and last references (shard boundaries take priority). Target cut points are taken only from those the evidence allows, then enter the block check together with the anchor edges. Insufficient evidence sends the whole sentence to the dedicated round. A block over hard goes to the rewrite round, the same verdict as for HTML block drafts.
        if let Some(lines) = &draft.lines {
            let source_words: Vec<&str> =
                item.words.iter().map(|word| word.text.as_str()).collect();
            if lines
                .source_words
                .iter()
                .map(String::as_str)
                .ne(source_words.iter().copied())
            {
                // The word table the carrier sees differs from this round's anchored words (the visible subset after final timeline trimming). References cannot be located, so this is treated as no draft.
                outcome.violations.push(format!(
                    "{}: lines draft dropped — its {} source words differ from the {} anchoring words; dedicated align",
                    item.sentence.id,
                    lines.source_words.len(),
                    source_words.len()
                ));
                verdicts.push(FusedVerdict::Pending(item));
                continue;
            }
            let input = plan_input(
                doc,
                options,
                &item,
                params,
                &item.translation,
                &options.lang,
                TextBasis::Trans,
                LLM_LINES_ALIGNER_TAG,
            );
            // The word table has been verified identical word-for-word to `item.words`; pass the version carrying the "attach to previous" markers.
            let evidence = crate::filepipe::lines::evidence_with_pieces(
                &lines.record,
                &item.words,
                &align_ctx(&item, &doc.lang, &options.lang),
                &lines.pieces,
            );
            if evidence.text != item.translation {
                outcome.violations.push(format!(
                    "{}: lines draft dropped — its chunk text no longer matches the committed translation; dedicated align",
                    item.sentence.id
                ));
                verdicts.push(FusedVerdict::Pending(item));
                continue;
            }
            let candidates = crate::align_block::target_cut_candidates(
                &input.target,
                &input.lang,
                &input.params,
                &input.protected_terms,
            );
            let allowed: Vec<usize> = candidates
                .iter()
                .map(|candidate| candidate.pos)
                .filter(|position| evidence.cuts.contains(position))
                .collect();
            let strict =
                crate::align_block::plan_sentence_at_cuts(&evidence.edges, &input, &allowed);
            // The model's own cut-point hints: block boundaries rejected by lint, and piece markers copied into the translation.
            let hints = crate::filepipe::lines::cut_hints(&lines.record);
            let hinted = crate::align_block::hinted_cut_candidates(
                &input.target,
                &input.lang,
                &input.params,
                &input.protected_terms,
                &hints,
            );
            // Every cut point is allowed, but a block is still over hard: first make one more cut inside the block at a target seam. Clean seams with anchors are preferred, then dangling-tail hints, then hints rejected by lint, then character-level seams. Other model cut points are kept as they are, and the source breakpoint inside the block snaps to the nearest source-side breakpoint near the proportional position. This yields `llm-lines+split/1`. If one cut is not enough, there are no candidates, or the result is still unsafe after splitting (crossed word order), the sentence goes to the rewrite round. If the model gave a hint, the ladder is used (a hint rejected by lint is still used; clean seams remain usable, just not the unallowed seams: rejected hints and character-level seams). A sentence with no allowed cut point and no model hint has no evidence to keep, and still follows the original path.
            let strict = match strict {
                PlanOutcome::NeedsRewrite { .. } if !allowed.is_empty() || !hints.is_empty() => {
                    match crate::align_block::plan_sentence_splitting_over_hard(
                        &evidence.edges,
                        &input,
                        &allowed,
                        &candidates,
                        &hinted,
                    ) {
                        (PlanOutcome::Aligned(mut entry), extra) if !extra.is_empty() => {
                            entry.aligner = Some(LLM_LINES_SPLIT_ALIGNER_TAG.to_owned());
                            push_write(
                                writes,
                                outcome,
                                item.sentence.id.clone(),
                                entry,
                                WriteCredit::Prealigned,
                            );
                            outcome.violations.push(format!(
                                "{}: accepted from the translate lines draft with {} over-hard block(s) split in place at {} ({} of {} chunks located, {} evidence cut(s) kept, {} cut hint(s); the source break inside a split block snaps to the nearest source punctuation, pause or legal seam around the proportional point)",
                                item.sentence.id,
                                extra.len(),
                                crate::align_block::describe_split_cuts(&extra),
                                evidence.located,
                                evidence.chunks,
                                allowed.len(),
                                hints.len()
                            ));
                            continue;
                        }
                        (other, _) => other,
                    }
                }
                other => other,
            };
            match strict {
                PlanOutcome::Aligned(entry) => {
                    push_write(
                        writes,
                        outcome,
                        item.sentence.id.clone(),
                        entry,
                        WriteCredit::Prealigned,
                    );
                    outcome.violations.push(format!(
                        "{}: accepted from the translate lines draft ({} of {} chunks located{})",
                        item.sentence.id,
                        evidence.located,
                        evidence.chunks,
                        if evidence.overlapping > 0 {
                            format!(
                                ", {} overlapping quote hull pair(s) kept as crossing evidence",
                                evidence.overlapping
                            )
                        } else {
                            String::new()
                        }
                    ));
                }
                PlanOutcome::NeedsRewrite {
                    over_hard_block,
                    units,
                    blocks,
                } => {
                    outcome.violations.push(format!(
                        "{}: lines draft leaves a {units}-unit block over hard {} ({} of {} chunks located, {} evidence cut(s)); rewrite turn",
                        item.sentence.id,
                        params.hard,
                        evidence.located,
                        evidence.chunks,
                        allowed.len()
                    ));
                    let hint = over_hard_hint(&blocks, over_hard_block, units, params);
                    verdicts.push(FusedVerdict::NeedsRewrite(item, hint));
                }
                PlanOutcome::SentenceLevel(_) => {
                    outcome.violations.push(format!(
                        "{}: lines draft gave no usable block evidence ({} of {} chunks located, {} evidence cut(s), issues {:?}); dedicated align",
                        item.sentence.id,
                        evidence.located,
                        evidence.chunks,
                        allowed.len(),
                        evidence.issues
                    ));
                    verdicts.push(FusedVerdict::Pending(item));
                }
            }
            continue;
        }
        // Row-partition draft: the model has already given display rows in source-word order, so row boundaries are frozen directly as block boundaries, and `align-edges` / `align-rewrite` are no longer dispatched. If any step does not hold, fall back to the regular path.
        if draft.rows {
            let input = plan_input(
                doc,
                options,
                &item,
                params,
                &item.translation,
                &options.lang,
                TextBasis::Trans,
                LLM_ROWS_ALIGNER_TAG,
            );
            let edges = merge_edges(vec![
                anchor_edges(&item, &doc.lang, &options.lang, &item.translation),
                chunks_to_edges(&draft.chunks, &item.translation),
            ]);
            let plan = chunk_char_ranges(&draft.chunks, &item.translation)
                .and_then(|ranges| plan_sentence_rows(&edges, &ranges, &input));
            if let Some(plan) = plan {
                push_write(
                    writes,
                    outcome,
                    item.sentence.id.clone(),
                    plan.entry,
                    WriteCredit::Prealigned,
                );
                outcome.rows_merged += plan.merged_rows;
                outcome.violations.push(format!(
                    "{}: accepted from the translate fused display-row draft{}",
                    item.sentence.id,
                    if plan.merged_rows > 0 {
                        format!(" ({} short row(s) merged)", plan.merged_rows)
                    } else {
                        String::new()
                    }
                ));
                continue;
            }
        }
        let input = plan_input(
            doc,
            options,
            &item,
            params,
            &item.translation,
            &options.lang,
            TextBasis::Trans,
            LLM_CHUNK_ALIGNER_TAG,
        );
        let edges = merge_edges(vec![
            anchor_edges(&item, &doc.lang, &options.lang, &item.translation),
            chunks_to_edges(&draft.chunks, &item.translation),
        ]);
        match plan_sentence(&edges, &input) {
            PlanOutcome::Aligned(entry) => {
                push_write(
                    writes,
                    outcome,
                    item.sentence.id.clone(),
                    entry,
                    WriteCredit::Prealigned,
                );
                outcome.violations.push(format!(
                    "{}: accepted from the translate fused block-alignment draft",
                    item.sentence.id
                ));
            }
            PlanOutcome::NeedsRewrite {
                over_hard_block,
                units,
                blocks,
            } => {
                let hint = over_hard_hint(&blocks, over_hard_block, units, params);
                verdicts.push(FusedVerdict::NeedsRewrite(item, hint));
            }
            PlanOutcome::SentenceLevel(_) => verdicts.push(FusedVerdict::Pending(item)),
        }
    }
    verdicts
}

/// `data-over-hard` hint: carries only relative budgets (block order, source word index range, reading units), not seconds.
fn over_hard_hint(
    blocks: &[crate::doc::AlignBlock],
    over_hard_block: usize,
    units: usize,
    params: &TransParams,
) -> String {
    let (from, to) = blocks
        .get(over_hard_block)
        .map(|block| block.src)
        .unwrap_or((0, 0));
    format!(
        "chunk {} (words {}-{}): {} units > hard {}",
        over_hard_block + 1,
        from + 1,
        to + 1,
        units,
        params.hard
    )
}

/// Input to the bilingual DP for one sentence: in-sentence anchored words, the target text, thresholds, locked terms, and the duration bounds from the default [`LayoutProfile`].
fn plan_input(
    doc: &TranscriptDoc,
    options: &AlignOptions,
    item: &Pending,
    params: &TransParams,
    target: &str,
    target_lang: &str,
    text_basis: TextBasis,
    aligner: &str,
) -> BilingualPlanInput {
    let words = anchor_words(doc, item);
    let profile = LayoutProfile::default_profile();
    let mut input = BilingualPlanInput::new(words, target, &doc.lang, target_lang);
    input.params = *params;
    input.protected_terms = item.protected_terms.clone();
    input.min_duration_sec = profile.min_duration_sec;
    input.max_duration_sec = profile.max_duration_sec;
    input.text_basis = text_basis;
    input.aligner = aligner.to_owned();
    input.density = options.density_for(&item.sentence.id);
    input.source_cue_keys = item.source_cue_keys.clone();
    input
}

/// In-sentence anchored words (id + text + time). The bilingual DP and the local semantic scorer share this same basis.
fn anchor_words(doc: &TranscriptDoc, item: &Pending) -> Vec<AnchorWord> {
    item.anchor_indices
        .iter()
        .map(|&index| AnchorWord {
            id: doc.words[index].id.clone(),
            text: doc.words[index].text.clone(),
            t0: doc.words[index].t0,
            t1: doc.words[index].t1,
            glue: doc.words[index].glue,
        })
        .collect()
}

fn align_ctx(item: &Pending, source_lang: &str, target_lang: &str) -> AlignCtx {
    AlignCtx {
        source_lang: source_lang.to_owned(),
        lang: target_lang.to_owned(),
        protected_terms: item
            .bilingual_anchors
            .iter()
            .map(|anchor| TermPair {
                source: anchor.source.clone(),
                target: anchor.target.clone(),
            })
            .collect(),
    }
}

/// Deterministic anchor edges (digits, URLs, verbatim Latin, bilingual terms).
fn anchor_edges(
    item: &Pending,
    source_lang: &str,
    target_lang: &str,
    target: &str,
) -> Vec<AlignEdge> {
    let refs: Vec<&str> = item.words.iter().map(|word| word.text.as_str()).collect();
    AnchorAligner.align(&refs, target, &align_ctx(item, source_lang, target_lang))
}

/// Fingerprint of the natural translation currently stored (`transDisplay.transFingerprint`).
fn trans_fingerprint_for(doc: &TranscriptDoc, lang: &str, id: &str, fallback: &str) -> String {
    let text = doc
        .trans
        .get(lang)
        .and_then(|table| table.get(id))
        .map(String::as_str)
        .unwrap_or(fallback);
    trans_text_fingerprint(text)
}

/// Table input for `align-edges/1` / `align-rewrite/1` from one batch of `Pending` sentences.
fn edges_input(
    batch: &[(&Pending, Option<&str>)],
    params: &TransParams,
    target_lang: &str,
    rewrite: bool,
) -> AlignEdgesInput {
    AlignEdgesInput {
        lang: target_lang.to_owned(),
        params: *params,
        rewrite,
        sentences: batch
            .iter()
            .map(|(item, hint)| AlignEdgesSentenceInput {
                id: item.sentence.id.clone(),
                source_words: item.words.iter().map(|word| word.text.clone()).collect(),
                translation: item.translation.clone(),
                over_hard: hint.map(str::to_owned),
            })
            .collect(),
    }
}

/// Pages are cut under the same triple constraint as the first round (word count / sentence count / complexity).
fn edges_batches<'b, 'a>(
    items: &[(&'b Pending<'a>, Option<&'b str>)],
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    page_budget: usize,
) -> Vec<Vec<(&'b Pending<'a>, Option<&'b str>)>> {
    let refs: Vec<&Pending> = items.iter().map(|(item, _)| *item).collect();
    let mut batches = Vec::new();
    let mut cursor = 0usize;
    for size in align_page_sizes(&refs, params, source_lang, target_lang, page_budget) {
        batches.push(items[cursor..cursor + size].to_vec());
        cursor += size;
    }
    batches
}

/// `align-edges/1` contract (block-alignment design §6.1). The model only labels which block each word belongs to. It does not cut the source, cut the translation, or resolve crossings.
fn align_edges_system_prompt(
    params: &TransParams,
    instructions: Option<&str>,
    protected_terms: &[String],
) -> String {
    let mut prompt = format!(
        r#"You are an expert bilingual subtitle aligner. The input is ONE HTML table. Each `<tbody data-sid="…">` is one sentence with a single row: the `td.src` cell holds the spoken source words, each prefixed with its 1-based ordinal like `[1]I [2]didn't [3]go`; the `td.tgt` cell holds the complete natural translation.

Your ONLY job is to annotate which source words each part of the translation renders. You do not cut subtitles, you do not decide row boundaries, and you never rewrite the translation — deterministic code merges your chunks into monotonic alignment blocks and cuts the rows afterwards.

Output protocol — return the SAME table and nothing else (no markdown fences, no prose, no `<style>`, no commentary):
- Keep `<table>` and every `<tbody>` in the input order, keep every `data-sid` byte for byte, emit every sentence exactly once, and leave `td.src` untouched. Do not invent ids.
- Rewrite ONLY the contents of `td.tgt`: replace the plain translation with a sequence of `<span data-src="…">chunk</span>` elements. The span texts concatenated MUST reproduce the translation EXACTLY — never add, drop, reorder, translate, or normalize any character; punctuation stays with the chunk it ends. Text left outside a span counts as an unattributed chunk.
- Chunk the translation into the SMALLEST natural semantic chunks — a clause, a phrase, a term; never below a word, never inside a name, number, or protected term. Chunks follow the translation's own order; you never move or merge chunks to imitate the source order.
- `data-src` lists the ordinals of the source words that chunk translates: whitespace or comma separated, ranges allowed (`4-7`, `1 2 3`, `1-3,9`), any order, non-contiguous ok. Use `data-src=""` for particles, connectives, or additions with no source word. Every ordinal may appear at most once in a sentence; leaving a function word unassigned is fine. Crossings are expected — record them faithfully through the ordinals, do not hide them.
- Numbers, dates, names, URLs, and glossary terms MUST sit in the chunk whose `data-src` contains their source ordinal.
- Prefer finer chunks: two short chunks with clear ordinals beat one large chunk. Row width guidance for the eventual subtitle: fit {fit}, soft {soft}, hard {hard} display units — chunks smaller than that give the cutter room to work.

Before emitting the table, silently verify: every sentence present, every `td.tgt` fully covered by spans whose concatenation is byte-identical to the input translation, no ordinal used twice, no ordinal beyond the source word count."#,
        fit = params.fit,
        soft = params.soft,
        hard = params.hard,
    );
    if !protected_terms.is_empty() {
        prompt.push_str(&format!(
            "\n\nProtected target terms — each is an indivisible unit; never let a chunk boundary fall inside one of these literal strings: {}",
            protected_terms.join(" · ")
        ));
    }
    if let Some(instructions) = instructions.filter(|text| !text.is_empty()) {
        prompt.push_str(&format!(
            "\n\nExplicit reviewer instructions for THIS batch (highest priority within the output protocol): {instructions}"
        ));
    }
    prompt
}

/// `align-rewrite/1` contract (block-alignment design §6.3): monotonic display rewrite and block labels, given in one pass.
fn align_rewrite_system_prompt(
    params: &TransParams,
    instructions: Option<&str>,
    protected_terms: &[String],
) -> String {
    let mut prompt = format!(
        r#"You are an expert bilingual subtitle rewriter. The input is ONE HTML table. Each `<tbody data-sid="…">` is one sentence: the `td.src` cell holds the spoken source words, each prefixed with its 1-based ordinal like `[1]I [2]didn't [3]go`; the `td.tgt` cell holds the natural translation; `data-over-hard` names the aligned chunk (with its source ordinal range and reading-unit width) that cannot fit into one subtitle row because the translation's clause order crosses the source order.

Task: rewrite the translation so that its clause order follows the SOURCE clause order and every chunk fits the hard budget of {hard} display units (aim for ≤{fit}, {soft} or less reads best). Keep every fact, negation, number, name, date, URL, and locked term; keep the register; only reorder clauses and adjust connectives, particles, and punctuation as the new order requires. Never compress, expand, summarize, or retranslate — a rewrite whose length drifts beyond about 25% is rejected, and so is one that drops a number or a term. If the sentence genuinely cannot be reordered naturally, return the translation unchanged and annotate it anyway.

Output protocol — return the SAME table and nothing else (no markdown fences, no prose, no `<style>`, no commentary):
- Keep `<table>` and every `<tbody>` in the input order, keep every `data-sid` byte for byte, emit every sentence exactly once, and leave `td.src` untouched.
- Replace the contents of `td.tgt` with the REWRITTEN sentence, already annotated as a sequence of `<span data-src="…">chunk</span>` elements whose texts concatenate to the whole rewritten sentence (nothing outside spans). Chunk it into the smallest natural semantic chunks; `data-src` lists the 1-based source ordinals each chunk renders (whitespace or comma separated, ranges like `4-7` allowed, `data-src=""` for a chunk with no source word). Every ordinal at most once per sentence. Numbers, names, and terms sit in the chunk of their source ordinal.

Before emitting the table, silently verify: every sentence present, the rewritten sentence complete and natural, chunk order following the source order, no ordinal used twice or beyond the source word count."#,
        fit = params.fit,
        soft = params.soft,
        hard = params.hard,
    );
    if !protected_terms.is_empty() {
        prompt.push_str(&format!(
            "\n\nProtected target terms — each must appear verbatim in the rewrite and never be split by a chunk boundary: {}",
            protected_terms.join(" · ")
        ));
    }
    if let Some(instructions) = instructions.filter(|text| !text.is_empty()) {
        prompt.push_str(&format!(
            "\n\nExplicit reviewer instructions for THIS batch (highest priority within the output protocol): {instructions}"
        ));
    }
    prompt
}

fn edges_request(
    table: &AlignEdgesInput,
    params: &TransParams,
    instructions: Option<&str>,
    protected_terms: &[String],
    retry_reason: Option<String>,
) -> LlmRequest {
    let (kind, system) = if table.rewrite {
        (
            "align-rewrite",
            align_rewrite_system_prompt(params, instructions, protected_terms),
        )
    } else {
        (
            "align-edges",
            align_edges_system_prompt(params, instructions, protected_terms),
        )
    };
    LlmRequest {
        kind,
        system,
        user: render_align_edges(table),
        temperature: 0.1,
        attempt: if retry_reason.is_some() { 2 } else { 1 },
        retry_reason,
    }
}

/// Decision-tree handling of one sentence's block labels (block-alignment design §4.5). `Aligned` and `SentenceLevel` are stored directly. `NeedsRewrite` is handed back to the caller (the rewrite round) together with the `data-over-hard` hint.
#[allow(clippy::too_many_arguments)]
fn settle_edges_plan(
    doc: &TranscriptDoc,
    options: &AlignOptions,
    params: &TransParams,
    item: &Pending,
    chunks: &[AlignChunk],
    llm_aligner: &str,
    writes: &mut Vec<AlignWrite>,
    outcome: &mut AlignOutcome,
) -> Option<String> {
    let id = item.sentence.id.as_str();
    let input = plan_input(
        doc,
        options,
        item,
        params,
        &item.translation,
        &options.lang,
        TextBasis::Trans,
        llm_aligner,
    );
    let edges = merge_edges(vec![
        anchor_edges(item, &doc.lang, &options.lang, &item.translation),
        chunks_to_edges(chunks, &item.translation),
    ]);
    match plan_sentence(&edges, &input) {
        PlanOutcome::Aligned(entry) => {
            push_write(writes, outcome, id.to_owned(), entry, WriteCredit::Aligned);
            None
        }
        PlanOutcome::NeedsRewrite {
            over_hard_block,
            units,
            blocks,
        } => Some(over_hard_hint(&blocks, over_hard_block, units, params)),
        PlanOutcome::SentenceLevel(entry) => {
            write_sentence_level(
                doc,
                item,
                &options.lang,
                params,
                entry,
                "block evidence too weak or no block-safe cut",
                writes,
                outcome,
            );
            None
        }
    }
}

/// Hard guardrail on the degraded path: a single-piece whole sentence whose text exceeds hard must not be stored as is, since it would be an unshowable single row. First split it into two pieces at the seam chosen by the same seam splitter as `align-overfit` ([`crate::seam::preferred_target_split`]), using them only if both are ≤ hard. Otherwise use the deterministic target split (same as [`fallback_word_entry`]). Source times are apportioned by piece length. Returns `None` when the text is already ≤ hard and needs no split.
fn split_over_hard_degrade(
    doc: &TranscriptDoc,
    item: &Pending,
    text: &str,
    lang: &str,
    params: &TransParams,
) -> Option<TransAlign> {
    if crate::split::piece_display_units(text, lang) <= params.hard {
        return None;
    }
    let seam = crate::seam::preferred_target_split(text, lang, params.soft, Some(params.hard))
        .filter(|split| {
            crate::split::piece_display_units(&split.left, lang) <= params.hard
                && crate::split::piece_display_units(&split.right, lang) <= params.hard
        });
    let mut entry = match seam {
        Some(split) => word_entry_from_texts(
            doc,
            item,
            vec![split.left.trim().to_owned(), split.right.trim().to_owned()],
            lang,
        ),
        None => fallback_word_entry(doc, item, text, lang, params),
    };
    entry.aligner = Some("deterministic/1".to_owned());
    Some(entry)
}

#[allow(clippy::too_many_arguments)]
fn write_sentence_level(
    doc: &TranscriptDoc,
    item: &Pending,
    lang: &str,
    params: &TransParams,
    entry: TransAlign,
    reason: &str,
    writes: &mut Vec<AlignWrite>,
    outcome: &mut AlignOutcome,
) {
    let id = item.sentence.id.as_str();
    let whole = entry
        .pieces
        .first()
        .map(|piece| piece.text.clone())
        .unwrap_or_default();
    if entry.text_basis == TextBasis::Trans
        && let Some(split) = split_over_hard_degrade(doc, item, &whole, lang, params)
    {
        push_write(writes, outcome, id.to_owned(), split, WriteCredit::Fallback);
        outcome.violations.push(format!(
            "{id}: sentence-level correspondence — {reason}; the whole translation exceeds hard, so it was cut at a deterministic target seam with proportional source timing instead"
        ));
        return;
    }
    push_write(
        writes,
        outcome,
        id.to_owned(),
        entry,
        WriteCredit::SentenceLevel,
    );
    outcome
        .violations
        .push(format!("{id}: sentence-level correspondence — {reason}"));
}

/// Acceptance of one `align-edges/1` batch call: sentences with string-level problems, missing sentences, or sentences without annotation go into `failed` (with reasons). The rest go through the block check one by one. The artifact is written regardless of the outcome.
#[allow(clippy::too_many_arguments)]
fn edges_attempt<'b, 'a>(
    doc: &TranscriptDoc,
    options: &AlignOptions,
    params: &TransParams,
    batch: &[(&'b Pending<'a>, Option<&'b str>)],
    table: &AlignEdgesInput,
    payload: &str,
    raw: &str,
    page_id: &str,
    attempt_index: u32,
    llm_aligner: &str,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
    writes: &mut Vec<AlignWrite>,
    outcome: &mut AlignOutcome,
    rewrite_hints: &mut Vec<(&'b Pending<'a>, String)>,
    failed: &mut Vec<&'b Pending<'a>>,
    reasons: &mut Vec<String>,
) {
    let parsed = parse_align_edges(table, Some(payload), raw);
    let mut blocked: BTreeSet<String> = BTreeSet::new();
    for problem in &parsed.diagnostics.problems {
        match &problem.scope {
            ProblemScope::Sentence { id } => {
                blocked.insert(id.clone());
                reasons.push(format!("{id}: [{}] {}", problem.code, problem.detail));
            }
            _ => reasons.push(format!("[{}] {}", problem.code, problem.detail)),
        }
    }
    let mut batch_failed = false;
    for (item, _) in batch {
        let id = item.sentence.id.as_str();
        if blocked.contains(id) {
            failed.push(item);
            batch_failed = true;
            continue;
        }
        let Some(group) = parsed.group(id) else {
            failed.push(item);
            batch_failed = true;
            if !reasons.iter().any(|reason| problem_mentions_id(reason, id)) {
                reasons.push(format!("{id}: missing from the answer"));
            }
            continue;
        };
        if group.chunks.is_empty() {
            failed.push(item);
            batch_failed = true;
            reasons.push(format!(
                "{id}: td.tgt carries no <span data-src> chunk annotation — wrap the whole translation in spans"
            ));
            continue;
        }
        if let Some(hint) = settle_edges_plan(
            doc,
            options,
            params,
            item,
            &group.chunks,
            llm_aligner,
            writes,
            outcome,
        ) {
            rewrite_hints.push((item, hint));
        }
    }
    on_attempt(&PageAttempt {
        page_id,
        attempt: attempt_index,
        input: payload,
        output: raw,
        problems: &parsed.diagnostics.problems,
        accepted: !batch_failed,
    });
}

/// Acceptance of a monotonic rewrite (block-alignment design §6.3): AutoCorrect on the target → locked terms and bilingual anchor targets must still be present → hard anchors (digits, URLs, verbatim Latin, terms) must not be lost → re-run edges → blocks → DP on the rewritten text. Only `Aligned` counts as a pass. When the rewritten text is identical to the stored translation (the model only split the blocks finer), no `transDisplay` is produced, because a rewrite that changed nothing is not recorded.
fn accept_rewrite(
    doc: &TranscriptDoc,
    options: &AlignOptions,
    params: &TransParams,
    item: &Pending,
    rewritten: &str,
    chunks: &[AlignChunk],
    llm_aligner: &str,
) -> Result<(Option<TransDisplay>, TransAlign), String> {
    let text = format_translation_with_options(
        rewritten,
        &options.lang,
        &item.protected_terms,
        AutocorrectOptions::default(),
    );
    let text = text.trim().to_owned();
    if text.is_empty() {
        return Err("rewrite is empty".to_owned());
    }
    if let Some(term) = item
        .protected_terms
        .iter()
        .find(|term| !text.contains(term.as_str()))
    {
        return Err(format!("rewrite dropped protected term \"{term}\""));
    }
    if let Some(anchor) = item
        .bilingual_anchors
        .iter()
        .find(|anchor| !text.contains(anchor.target.as_str()))
    {
        return Err(format!(
            "rewrite dropped glossary target \"{}\"",
            anchor.target
        ));
    }
    let hard_src = |target: &str| -> BTreeSet<usize> {
        anchor_edges(item, &doc.lang, &options.lang, target)
            .into_iter()
            .filter(|edge| edge.hard)
            .map(|edge| edge.src)
            .collect()
    };
    let before = hard_src(&item.translation);
    let after = hard_src(&text);
    if let Some(&index) = before.difference(&after).next() {
        return Err(format!(
            "rewrite lost the anchor \"{}\" (source word {})",
            item.words
                .get(index)
                .map(|word| word.text.as_str())
                .unwrap_or("?"),
            index + 1
        ));
    }
    let unchanged = text == item.translation;
    let input = plan_input(
        doc,
        options,
        item,
        params,
        &text,
        &options.lang,
        if unchanged {
            TextBasis::Trans
        } else {
            TextBasis::Display
        },
        llm_aligner,
    );
    let edges = merge_edges(vec![
        anchor_edges(item, &doc.lang, &options.lang, &text),
        chunks_to_edges(chunks, &text),
    ]);
    match plan_sentence(&edges, &input) {
        PlanOutcome::Aligned(entry) if unchanged => Ok((None, entry)),
        PlanOutcome::Aligned(entry) => Ok((
            Some(TransDisplay {
                text,
                basis: MONOTONIC_REWRITE_BASIS.to_owned(),
                trans_fingerprint: trans_fingerprint_for(
                    doc,
                    &options.lang,
                    &item.sentence.id,
                    &item.translation,
                ),
            }),
            entry,
        )),
        PlanOutcome::NeedsRewrite { units, .. } => Err(format!(
            "rewrite still leaves a {units}-unit chunk over hard {}",
            params.hard
        )),
        PlanOutcome::SentenceLevel(_) => Err("rewrite carries no usable block evidence".to_owned()),
    }
}

/// Main flow of the block-alignment-edges carrier: dedicated `align-edges/1` first round → one global repair → rewrite round (`align-rewrite/1`, no repair) → pure-anchor block alignment → deterministic fallback.
#[allow(clippy::too_many_arguments)]
fn run_edges_carrier<'a>(
    doc: &TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    params: &TransParams,
    pending: Vec<Pending<'a>>,
    fused_rewrites: Vec<(Pending<'a>, String)>,
    llm_aligner: &str,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
    writes: &mut Vec<AlignWrite>,
    display_writes: &mut Vec<(String, TransDisplay)>,
    outcome: &mut AlignOutcome,
) -> Result<(), LlmError> {
    let lang = options.lang.as_str();
    let page_budget = options.page_budget.max(1);
    let protected_terms = {
        let mut terms: Vec<String> = pending
            .iter()
            .chain(fused_rewrites.iter().map(|(item, _)| item))
            .flat_map(|item| item.protected_terms.iter().cloned())
            .collect();
        terms.sort();
        terms.dedup();
        terms
    };

    // Rewrite queue: sentences flagged by fused drafts plus those flagged by the dedicated round.
    let mut rewrite_hints: Vec<(&Pending, String)> = fused_rewrites
        .iter()
        .map(|(item, hint)| (item, hint.clone()))
        .collect();
    let mut failed: Vec<&Pending> = Vec::new();
    let mut repair_reasons: Vec<String> = Vec::new();

    if !pending.is_empty() {
        let items: Vec<(&Pending, Option<&str>)> =
            pending.iter().map(|item| (item, None)).collect();
        let batches = edges_batches(&items, params, &doc.lang, lang, page_budget);
        let tables: Vec<AlignEdgesInput> = batches
            .iter()
            .map(|batch| edges_input(batch, params, lang, false))
            .collect();
        let requests: Vec<LlmRequest> = tables
            .iter()
            .map(|table| {
                edges_request(
                    table,
                    params,
                    options.instructions.as_deref(),
                    &protected_terms,
                    None,
                )
            })
            .collect();
        let results = llm.complete_batch(&requests);
        debug_assert_eq!(results.len(), batches.len());
        for (index, (batch, result)) in batches.iter().zip(results).enumerate() {
            match result {
                Ok(raw) => edges_attempt(
                    doc,
                    options,
                    params,
                    batch,
                    &tables[index],
                    &requests[index].user,
                    &raw,
                    &format!("b{:03}", index + 1),
                    1,
                    llm_aligner,
                    on_attempt,
                    writes,
                    outcome,
                    &mut rewrite_hints,
                    &mut failed,
                    &mut repair_reasons,
                ),
                Err(error) if error.is_retryable() => {
                    failed.extend(batch.iter().map(|(item, _)| *item));
                    repair_reasons.push(error.to_string());
                }
                Err(error) => return Err(error),
            }
        }
    }

    for _ in 0..options.repair_calls.min(GLOBAL_REPAIR_CALLS) {
        if failed.is_empty() {
            break;
        }
        let repair_batch = std::mem::take(&mut failed);
        let items: Vec<(&Pending, Option<&str>)> =
            repair_batch.iter().map(|item| (*item, None)).collect();
        let batches = edges_batches(&items, params, &doc.lang, lang, page_budget);
        let tables: Vec<AlignEdgesInput> = batches
            .iter()
            .map(|batch| edges_input(batch, params, lang, false))
            .collect();
        let round_ids: Vec<&str> = repair_batch
            .iter()
            .map(|item| item.sentence.id.as_str())
            .collect();
        let requests: Vec<LlmRequest> = batches
            .iter()
            .enumerate()
            .map(|(index, batch)| {
                let batch_ids: BTreeSet<&str> = batch
                    .iter()
                    .map(|(item, _)| item.sentence.id.as_str())
                    .collect();
                let mut batch_problems: Vec<String> = Vec::new();
                let mut omitted = 0usize;
                for problem in &repair_reasons {
                    if batch_ids.iter().any(|id| problem_mentions_id(problem, id)) {
                        batch_problems.push(problem.clone());
                    } else if round_ids.iter().any(|id| problem_mentions_id(problem, id)) {
                        omitted += 1;
                    } else {
                        batch_problems.push(problem.clone());
                    }
                }
                let mut reason = format!(
                    "Previous answer was rejected for the sentences below. Return the same table with ONLY td.tgt rewritten as <span data-src> chunks whose concatenation equals the translation exactly, ordinals within 1..word count and each used at most once.\nProblems:\n{}",
                    batch_problems
                        .iter()
                        .map(|problem| format!("- {problem}"))
                        .collect::<Vec<_>>()
                        .join("\n")
                );
                if omitted > 0 {
                    reason.push_str(&format!(
                        "\n({omitted} more problem(s) belong to sentences handled by parallel repair calls)"
                    ));
                }
                edges_request(
                    &tables[index],
                    params,
                    options.instructions.as_deref(),
                    &protected_terms,
                    Some(reason),
                )
            })
            .collect();
        let results = llm.complete_batch(&requests);
        debug_assert_eq!(results.len(), batches.len());
        let mut next_reasons: Vec<String> = Vec::new();
        for (index, (batch, result)) in batches.iter().zip(results).enumerate() {
            match result {
                Ok(raw) => edges_attempt(
                    doc,
                    options,
                    params,
                    batch,
                    &tables[index],
                    &requests[index].user,
                    &raw,
                    &format!("r{:03}", index + 1),
                    2,
                    llm_aligner,
                    on_attempt,
                    writes,
                    outcome,
                    &mut rewrite_hints,
                    &mut failed,
                    &mut next_reasons,
                ),
                Err(error) if error.is_retryable() => {
                    failed.extend(batch.iter().map(|(item, _)| *item));
                    next_reasons.push(error.to_string());
                }
                Err(error) => return Err(error),
            }
        }
        repair_reasons = next_reasons;
    }

    // Rewrite round: one batch call, no repair. Anything that does not pass becomes sentence-level correspondence (the natural translation).
    if !rewrite_hints.is_empty() {
        let items: Vec<(&Pending, Option<&str>)> = rewrite_hints
            .iter()
            .map(|(item, hint)| (*item, Some(hint.as_str())))
            .collect();
        let batches = edges_batches(&items, params, &doc.lang, lang, page_budget);
        let tables: Vec<AlignEdgesInput> = batches
            .iter()
            .map(|batch| edges_input(batch, params, lang, true))
            .collect();
        let requests: Vec<LlmRequest> = tables
            .iter()
            .map(|table| {
                edges_request(
                    table,
                    params,
                    options.instructions.as_deref(),
                    &protected_terms,
                    None,
                )
            })
            .collect();
        let results = llm.complete_batch(&requests);
        debug_assert_eq!(results.len(), batches.len());
        for (index, (batch, result)) in batches.iter().zip(results).enumerate() {
            let raw = match result {
                Ok(raw) => raw,
                Err(error) if error.is_retryable() => {
                    for (item, _) in batch {
                        let input = plan_input(
                            doc,
                            options,
                            item,
                            params,
                            &item.translation,
                            lang,
                            TextBasis::Trans,
                            llm_aligner,
                        );
                        write_sentence_level(
                            doc,
                            item,
                            lang,
                            params,
                            sentence_level_entry(&input, None),
                            &format!("rewrite call failed ({error})"),
                            writes,
                            outcome,
                        );
                    }
                    continue;
                }
                Err(error) => return Err(error),
            };
            let parsed = parse_align_edges(&tables[index], Some(&requests[index].user), &raw);
            let mut blocked: BTreeMap<String, String> = BTreeMap::new();
            for problem in &parsed.diagnostics.problems {
                if let ProblemScope::Sentence { id } = &problem.scope {
                    blocked
                        .entry(id.clone())
                        .or_insert_with(|| format!("[{}] {}", problem.code, problem.detail));
                }
            }
            let mut batch_accepted = true;
            for (item, _) in batch {
                let id = item.sentence.id.as_str();
                let verdict = match (blocked.get(id), parsed.group(id)) {
                    (Some(problem), _) => Err(problem.clone()),
                    (None, None) => Err("missing from the rewrite answer".to_owned()),
                    (None, Some(group)) if group.chunks.is_empty() => {
                        Err("rewrite carries no <span data-src> chunk annotation".to_owned())
                    }
                    (None, Some(group)) => accept_rewrite(
                        doc,
                        options,
                        params,
                        item,
                        &group.text,
                        &group.chunks,
                        llm_aligner,
                    ),
                };
                match verdict {
                    Ok((Some(display), entry)) => {
                        display_writes.push((id.to_owned(), display));
                        push_write(
                            writes,
                            outcome,
                            id.to_owned(),
                            entry,
                            WriteCredit::Rewritten,
                        );
                        outcome.violations.push(format!(
                            "{id}: display text rewritten into source clause order (transDisplay, {MONOTONIC_REWRITE_BASIS}) — verify no meaning shifted"
                        ));
                    }
                    Ok((None, entry)) => {
                        // The text is unchanged at all; only the blocks got finer, enough to enter the DP. Store as a regular alignment, do not write transDisplay, and do not ask the user to check a rewrite that does not exist.
                        push_write(writes, outcome, id.to_owned(), entry, WriteCredit::Aligned);
                        outcome.violations.push(format!(
                            "{id}: rewrite turn kept the text unchanged; accepted from its finer chunks"
                        ));
                    }
                    Err(reason) => {
                        batch_accepted = false;
                        let input = plan_input(
                            doc,
                            options,
                            item,
                            params,
                            &item.translation,
                            lang,
                            TextBasis::Trans,
                            llm_aligner,
                        );
                        write_sentence_level(
                            doc,
                            item,
                            lang,
                            params,
                            sentence_level_entry(&input, None),
                            &format!("monotonic rewrite rejected: {reason}"),
                            writes,
                            outcome,
                        );
                    }
                }
            }
            on_attempt(&PageAttempt {
                page_id: &format!("w{:03}", index + 1),
                attempt: 1,
                input: &requests[index].user,
                output: &raw,
                problems: &parsed.diagnostics.problems,
                accepted: batch_accepted,
            });
        }
    }

    // Repair budget exhausted: try pure-anchor block alignment first, then fall back to deterministic target-language splitting.
    if !failed.is_empty() {
        let detail = repair_reasons.join("; ");
        for item in failed {
            let id = item.sentence.id.as_str();
            let input = plan_input(
                doc,
                options,
                item,
                params,
                &item.translation,
                lang,
                TextBasis::Trans,
                ANCHOR_ALIGNER_TAG,
            );
            let edges = anchor_edges(item, &doc.lang, lang, &item.translation);
            if let PlanOutcome::Aligned(entry) = plan_sentence(&edges, &input) {
                push_write(writes, outcome, id.to_owned(), entry, WriteCredit::Aligned);
                outcome.violations.push(format!(
                    "{id}: aligned from deterministic anchors only after the global repair budget — {detail}"
                ));
                continue;
            }
            push_write(
                writes,
                outcome,
                id.to_owned(),
                fallback_word_entry(doc, item, &item.translation, lang, params),
                WriteCredit::Fallback,
            );
            outcome.violations.push(format!(
                "{id}: fell back to deterministic target split after the global repair budget — {detail}"
            ));
        }
    }
    Ok(())
}

// ---- Table carrier (`align-table/1`, review/repair) ---------------------------------

/// Put the same paired constraint into both the payload and final acceptance.
/// Previously the prompt could demand 8 rows while the table advertised max=4.
fn prepare_table_constraints(
    table: &mut AlignTableInput,
    paired: &BTreeMap<String, PairedRequirement>,
) -> Result<(), LlmError> {
    for sentence in &mut table.sentences {
        if let Some(requirement) = paired.get(&sentence.id) {
            sentence.suggested_pieces.0 = sentence.suggested_pieces.0.max(requirement.required);
            sentence.suggested_pieces.1 =
                sentence.suggested_pieces.1.max(sentence.suggested_pieces.0);
            sentence.no_rewrite = true;
        }
    }
    crate::filepipe::align_table::validate_input_constraints(table).map_err(LlmError::Terminal)
}

/// Main flow of the two-column split-table carrier: batched first round → one global repair → rescue the answer, or fall back deterministically.
#[allow(clippy::too_many_arguments)]
fn run_table_carrier<'a>(
    doc: &TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &AlignOptions,
    params: &TransParams,
    pending: Vec<Pending<'a>>,
    paired_requirements: &BTreeMap<String, PairedRequirement>,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
    writes: &mut Vec<AlignWrite>,
    display_writes: &mut Vec<(String, TransDisplay)>,
    outcome: &mut AlignOutcome,
) -> Result<(), LlmError> {
    let params = *params;
    // manyToOne: all first-round batches are emitted at once through `complete_batch` (the agent executor writes out every request together so several workers can claim them in parallel). Failed sentences are aggregated across batches and share one repair call, avoiding the multiplicative blow-up of "retries per batch × bisection".
    // Task-level union of terminology: see `task_protected_terms`. The contract file is shared by (kind, attempt), so the system prompt must not depend on batch composition.
    let protected_terms = task_protected_terms(&pending);
    // Candidate sentences of a paired supplementary-row round: the whole job of this round is to re-choose source cut points, and rewriting the translation cannot help. If it is not written into the carrier, `data-reordered="true"` becomes a fork that validation accepts but acceptance rejects. Validation passes it under the wider reordering threshold, while paired acceptance counts rows only against the original `trans`, so the whole batch of answers was rejected sentence by sentence after submission (measured: 38 candidates → 38 rejected → 0 repaired).
    let no_rewrite: BTreeSet<String> = pending
        .iter()
        .filter(|item| options.density_for(&item.sentence.id) == AlignDensity::Paired)
        .map(|item| item.sentence.id.clone())
        .collect();
    let mut batches: Vec<Vec<&Pending>> = Vec::new();
    let mut cursor = 0_usize;
    let page_budget = options.page_budget.max(1);
    let pending_refs = pending.iter().collect::<Vec<_>>();
    for size in align_page_sizes(
        &pending_refs,
        &params,
        &doc.lang,
        &options.lang,
        page_budget,
    ) {
        batches.push(pending_refs[cursor..cursor + size].to_vec());
        cursor += size;
    }
    // file-v1: the rendering input must be kept. `parse_align_table` uses it as the baseline for reconciliation and for the §16 size guardrail, and the artifact must record this exact text that was actually sent.
    let mut declared_unsplittable: BTreeSet<String> = BTreeSet::new();
    let mut file_tables: Vec<AlignTableInput> = batches
        .iter()
        .map(|batch| {
            align_table_input(
                batch,
                &params,
                &doc.lang,
                &options.lang,
                &BTreeSet::new(),
                &no_rewrite,
            )
        })
        .collect();
    for table in &mut file_tables {
        prepare_table_constraints(table, paired_requirements)?;
    }
    let requests: Vec<LlmRequest> = batches
        .iter()
        .enumerate()
        .map(|(index, _batch)| {
            align_request_file(
                &file_tables[index],
                &params,
                &doc.lang,
                options.instructions.as_deref(),
                &protected_terms,
                None,
            )
        })
        .collect();
    let mut failed: Vec<&Pending> = Vec::new();
    let mut repair_reasons: Vec<String> = Vec::new();
    // Answers aggregated across batches and rounds that are structurally sound but failed acceptance. A later round's answer with the same id overrides an earlier one (`extend` semantics; the traversal order of batches and sentences is deterministic). They are consumed only just before storage.
    let mut salvage: std::collections::BTreeMap<String, AcceptedPieces> =
        std::collections::BTreeMap::new();
    let results = llm.complete_batch(&requests);
    debug_assert_eq!(results.len(), batches.len());
    for (index, (batch, result)) in batches.iter().zip(results).enumerate() {
        let attempt = match result {
            Ok(raw) => align_attempt_from_file(
                batch,
                &params,
                &doc.lang,
                &options.lang,
                &file_tables[index],
                &requests[index].user,
                &raw,
                &format!("b{:03}", index + 1),
                1,
                &mut declared_unsplittable,
                on_attempt,
            ),
            Err(error) => Err(error),
        };
        match attempt {
            Ok(attempt) => {
                let (accepted, salvaged, failed_keys, problems) = attempt.into_parts(batch);
                salvage.extend(salvaged);
                accept_resolved(
                    doc,
                    &options.lang,
                    batch,
                    &accepted,
                    writes,
                    display_writes,
                    outcome,
                );
                if !failed_keys.is_empty() {
                    failed.extend(
                        batch
                            .iter()
                            .copied()
                            .filter(|item| failed_keys.contains(&item.sentence.id)),
                    );
                    repair_reasons.extend(problems);
                }
            }
            Err(error) if error.is_retryable() => {
                failed.extend(batch.iter().copied());
                repair_reasons.push(error.to_string());
            }
            Err(error) => return Err(error),
        }
    }

    for _ in 0..options.repair_calls.min(GLOBAL_REPAIR_CALLS) {
        if failed.is_empty() {
            break;
        }
        let repair_batch = std::mem::take(&mut failed);
        // Repair rounds are split into batches on the same basis as the first round. `GLOBAL_REPAIR_CALLS` limits "how many rounds are re-sent", not "how many calls per round". Aggregating across batches avoids the multiplicative blow-up of "retries per batch × bisection". The failure set is still split into parallel calls under the same word-count, sentence-count and complexity constraints, so the number of rounds and the final deterministic-draft fallback do not change.
        let mut repair_batches: Vec<Vec<&Pending>> = Vec::new();
        let mut repair_cursor = 0_usize;
        for size in align_page_sizes(
            &repair_batch,
            &params,
            &doc.lang,
            &options.lang,
            page_budget,
        ) {
            repair_batches.push(repair_batch[repair_cursor..repair_cursor + size].to_vec());
            repair_cursor += size;
        }
        let carried_unsplittable = declared_unsplittable.clone();
        let mut repair_tables: Vec<AlignTableInput> = repair_batches
            .iter()
            .map(|batch| {
                align_table_input(
                    batch,
                    &params,
                    &doc.lang,
                    &options.lang,
                    &carried_unsplittable,
                    &no_rewrite,
                )
            })
            .collect();
        for table in &mut repair_tables {
            prepare_table_constraints(table, paired_requirements)?;
        }
        // `problems` is the aggregated list of all failed sentences in this round, while each repair call's carrier contains only the sentences of its own batch. Filter per batch: include the problems for this carrier's sentences plus global problems that name no sentence. The rest is noted in retryReason as a count, handled by the parallel repair calls.
        let round_ids: Vec<&str> = repair_batch
            .iter()
            .map(|item| item.sentence.id.as_str())
            .collect();
        let repair_requests: Vec<LlmRequest> = repair_batches
            .iter()
            .enumerate()
            .map(|(index, batch)| {
                let batch_ids: BTreeSet<&str> =
                    batch.iter().map(|item| item.sentence.id.as_str()).collect();
                let mut batch_problems: Vec<String> = Vec::new();
                let mut omitted = 0usize;
                for problem in &repair_reasons {
                    if batch_ids.iter().any(|id| problem_mentions_id(problem, id)) {
                        batch_problems.push(problem.clone());
                    } else if round_ids.iter().any(|id| problem_mentions_id(problem, id)) {
                        omitted += 1;
                    } else {
                        batch_problems.push(problem.clone());
                    }
                }
                let reason = repair_reason_file(
                    batch,
                    &params,
                    &doc.lang,
                    &options.lang,
                    &batch_problems,
                    omitted,
                );
                align_request_file(
                    &repair_tables[index],
                    &params,
                    &doc.lang,
                    options.instructions.as_deref(),
                    &protected_terms,
                    Some(reason),
                )
            })
            .collect();
        let repair_results = llm.complete_batch(&repair_requests);
        debug_assert_eq!(repair_results.len(), repair_batches.len());
        let mut next_reasons: Vec<String> = Vec::new();
        for (index, (batch, result)) in repair_batches.iter().zip(repair_results).enumerate() {
            let attempt = match result {
                Ok(raw) => align_attempt_from_file(
                    batch,
                    &params,
                    &doc.lang,
                    &options.lang,
                    &repair_tables[index],
                    &repair_requests[index].user,
                    &raw,
                    &format!("r{:03}", index + 1),
                    2,
                    &mut declared_unsplittable,
                    on_attempt,
                ),
                Err(error) => Err(error),
            };
            match attempt {
                Ok(attempt) => {
                    let (accepted, salvaged, failed_keys, problems) = attempt.into_parts(batch);
                    salvage.extend(salvaged);
                    accept_resolved(
                        doc,
                        &options.lang,
                        batch,
                        &accepted,
                        writes,
                        display_writes,
                        outcome,
                    );
                    if !failed_keys.is_empty() {
                        failed.extend(
                            batch
                                .iter()
                                .copied()
                                .filter(|item| failed_keys.contains(&item.sentence.id)),
                        );
                        next_reasons.extend(problems);
                    }
                }
                Err(error) if error.is_retryable() => {
                    failed.extend(batch.iter().copied());
                    next_reasons.push(error.to_string());
                }
                Err(error) => return Err(error),
            }
        }
        repair_reasons = next_reasons;
    }

    if !failed.is_empty() {
        let detail = repair_reasons.join("; ");
        for item in failed {
            // Repair budget exhausted. Before falling back to the purely length-based deterministic split of `fallback_word_entry`, check whether any rescued worker answer exists. It is a structurally sound split produced by the model itself, and is strictly better than the equal-width split of `reanchor_texts`. (Scene: the fallback split was byte-for-byte identical to the draftTarget in the payload, so the entire LLM round was wasted.)
            if let Some(pieces) = salvage.remove(&item.sentence.id) {
                if let Some(text) = &pieces.revised_target {
                    display_writes.push((
                        item.sentence.id.clone(),
                        table_reorder_display(doc, &options.lang, item, text),
                    ));
                }
                push_write(
                    writes,
                    outcome,
                    item.sentence.id.clone(),
                    many_to_one_entry(doc, item, &pieces),
                    WriteCredit::Aligned,
                );
                note_declared_crossing(item, &pieces, outcome);
                for advisory in &pieces.advisories {
                    outcome
                        .violations
                        .push(format!("{}: {advisory}", item.sentence.id));
                }
                continue;
            }
            push_write(
                writes,
                outcome,
                item.sentence.id.clone(),
                fallback_word_entry(doc, item, &item.translation, &options.lang, &params),
                WriteCredit::Fallback,
            );
            outcome.violations.push(format!(
                "{}: fell back to deterministic target split after the global repair budget — {detail}",
                item.sentence.id
            ));
        }
    }

    Ok(())
}

/// Table-carrier `data-reordered` rewrite → `transDisplay` (the natural translation `trans` is untouched).
fn table_reorder_display(
    doc: &TranscriptDoc,
    lang: &str,
    item: &Pending,
    text: &str,
) -> TransDisplay {
    TransDisplay {
        text: text.to_owned(),
        basis: TABLE_REORDER_BASIS.to_owned(),
        trans_fingerprint: trans_fingerprint_for(doc, lang, &item.sentence.id, &item.translation),
    }
}

fn projected_word_indices(
    doc: &TranscriptDoc,
    sentence: &Sentence,
    ids: &[String],
) -> Result<Vec<usize>, LlmError> {
    if ids.is_empty() {
        return Err(LlmError::Malformed(format!(
            "{} has an empty visible-word projection",
            sentence.id
        )));
    }
    let mut output = Vec::with_capacity(ids.len());
    let mut cursor = 0_usize;
    for id in ids {
        let Some(offset) = sentence.word_indices[cursor..]
            .iter()
            .position(|&index| doc.words[index].id == *id)
        else {
            return Err(LlmError::Malformed(format!(
                "{} visible words are not an ordered subset of its source sentence",
                sentence.id
            )));
        };
        cursor += offset;
        output.push(sentence.word_indices[cursor]);
        cursor += 1;
    }
    Ok(output)
}

fn alignment_anchors_match(entry: &TransAlign, anchor_ids: &[String], projected: bool) -> bool {
    match entry.mode {
        AlignMode::ManyToOne => entry.words == anchor_ids,
        AlignMode::Independent => {
            if projected {
                entry.words == anchor_ids
            } else {
                entry.words.is_empty()
            }
        }
        AlignMode::OneToOne => false,
    }
}

/// Final fallback for manyToOne: first split the target language deterministically, fix seam lint, then anchor to consecutive source words in proportion to piece length. It does not reuse source Cue boundaries, so the fallback does not re-create a "one Cue per piece" misalignment.
fn fallback_word_entry(
    doc: &TranscriptDoc,
    item: &Pending,
    translation: &str,
    lang: &str,
    params: &TransParams,
) -> TransAlign {
    let texts = split_independent_for_lang_protected(
        translation,
        params,
        usize::MAX,
        lang,
        &item.protected_terms,
    );
    let texts = repair_lint_pieces(texts, lang, params);
    word_entry_from_texts(doc, item, texts, lang)
}

/// Target pieces are fixed; anchor to consecutive source words in proportion to piece length (when there are more pieces than source words, fall back to independent).
fn word_entry_from_texts(
    doc: &TranscriptDoc,
    item: &Pending,
    texts: Vec<String>,
    lang: &str,
) -> TransAlign {
    if texts.len() > item.anchor_indices.len() {
        return TransAlign::new(
            AlignMode::Independent,
            (item.anchor_indices != item.sentence.word_indices)
                .then(|| {
                    item.anchor_indices
                        .iter()
                        .map(|&index| doc.words[index].id.clone())
                        .collect()
                })
                .unwrap_or_default(),
            texts
                .into_iter()
                .map(|text| TransPiece {
                    from: None,
                    to: None,
                    text,
                })
                .collect(),
        );
    }
    let word_texts: Vec<&str> = item
        .anchor_indices
        .iter()
        .map(|&index| doc.words[index].text.as_str())
        .collect();
    let pieces = reanchor_texts(texts, &word_texts, lang);
    let mut entry = TransAlign::new(
        AlignMode::ManyToOne,
        item.anchor_indices
            .iter()
            .map(|&index| doc.words[index].id.clone())
            .collect(),
        pieces,
    );
    entry.aligner = Some("deterministic/1".to_owned());
    entry
}

fn many_to_one_entry(doc: &TranscriptDoc, item: &Pending, pieces: &AcceptedPieces) -> TransAlign {
    if matches!(&pieces.anchor, AcceptedAnchor::Independent) {
        let mut entry = TransAlign::new(
            AlignMode::Independent,
            (item.anchor_indices != item.sentence.word_indices)
                .then(|| {
                    item.anchor_indices
                        .iter()
                        .map(|&index| doc.words[index].id.clone())
                        .collect()
                })
                .unwrap_or_default(),
            pieces
                .texts
                .iter()
                .map(|text| TransPiece {
                    from: None,
                    to: None,
                    text: text.trim().to_owned(),
                })
                .collect(),
        );
        entry.text_basis = if pieces.revised_target.is_some() {
            TextBasis::Display
        } else {
            TextBasis::Trans
        };
        return entry;
    }
    let AcceptedAnchor::WordRanges(ranges) = &pieces.anchor else {
        unreachable!("independent alignment returned above")
    };
    let words: Vec<String> = item
        .anchor_indices
        .iter()
        .map(|&index| doc.words[index].id.clone())
        .collect();
    // Crossings self-reported by the model (`data-crossing`) are accepted on a best-effort basis: keep the line splits and source cut points the worker gave, and store block-level entries as usual. Earlier this degraded to sentence-level correspondence (one block per piece), so the paired repair round rejected a four-row answer that had been flattened into one piece. On screen, only the whole-sentence fallback row remained, which appears after the old entry becomes invalid and exceeds hard. Per the revision of block-alignment design §4.5, a crossing only makes row-level correspondence approximate; it no longer degrades the sentence to sentence level. The entry does not write the old read-only field `crossing`.
    let mut entry = TransAlign::new(
        AlignMode::ManyToOne,
        words,
        pieces
            .texts
            .iter()
            .zip(ranges)
            .map(|(text, &(from, to))| TransPiece {
                from: Some(from),
                to: Some(to),
                text: text.trim().to_owned(),
            })
            .collect(),
    );
    // `data-reordered` rewrites go only into `transDisplay`, and the entry takes display as its basis.
    entry.text_basis = if pieces.revised_target.is_some() {
        TextBasis::Display
    } else {
        TextBasis::Trans
    };
    entry.aligner = Some(TABLE_ALIGNER_TAG.to_owned());
    entry
}

/// A sentence that self-reports a crossing and got best-effort row-level entries: leave a visible note that row-level correspondence is only approximate.
fn note_declared_crossing(item: &Pending, pieces: &AcceptedPieces, outcome: &mut AlignOutcome) {
    if pieces.crossing && pieces.texts.len() > 1 {
        outcome.violations.push(format!(
            "{}: declared word-order crossing — kept the worker's {} rows and source cuts best-effort; row-level correspondence is approximate",
            item.sentence.id,
            pieces.texts.len()
        ));
    }
}

fn accept_resolved(
    doc: &TranscriptDoc,
    lang: &str,
    batch: &[&Pending],
    accepted: &std::collections::BTreeMap<String, AcceptedPieces>,
    writes: &mut Vec<AlignWrite>,
    display_writes: &mut Vec<(String, TransDisplay)>,
    outcome: &mut AlignOutcome,
) {
    for item in batch {
        let Some(pieces) = accepted.get(&item.sentence.id) else {
            continue;
        };
        if let Some(text) = &pieces.revised_target {
            display_writes.push((
                item.sentence.id.clone(),
                table_reorder_display(doc, lang, item, text),
            ));
        }
        push_write(
            writes,
            outcome,
            item.sentence.id.clone(),
            many_to_one_entry(doc, item, pieces),
            WriteCredit::Aligned,
        );
        note_declared_crossing(item, pieces, outcome);
        for advisory in &pieces.advisories {
            outcome
                .violations
                .push(format!("{}: {advisory}", item.sentence.id));
        }
    }
}

#[derive(Debug, Clone)]
struct AcceptedPieces {
    texts: Vec<String>,
    anchor: AcceptedAnchor,
    /// Crossings self-reported by the model. Only ManyToOne word-anchored entries are stored.
    crossing: bool,
    /// The full translated sentence after reorder validation (already formatted). When non-None, it is written back as the sentence-level translation truth.
    revised_target: Option<String>,
    advisories: Vec<String>,
}

#[derive(Debug, Clone)]
enum AcceptedAnchor {
    WordRanges(Vec<(usize, usize)>),
    /// When there are more target pieces than source words, do not fabricate per-piece bilingual correspondence. Display times are apportioned by length within the whole-sentence time window.
    Independent,
}

enum BatchAttempt {
    Accepted(std::collections::BTreeMap<String, AcceptedPieces>),
    Partial {
        accepted: std::collections::BTreeMap<String, AcceptedPieces>,
        /// An answer that failed acceptance but is structurally sound enough to be better than the deterministic fallback split. It is not stored directly (the repair round still gets its chance). It replaces `fallback_word_entry` only when the repair budget is exhausted.
        salvaged: std::collections::BTreeMap<String, AcceptedPieces>,
        failed_keys: Vec<String>,
        /// Kept entry by entry (not pre-joined). The repair round must restate **each** failure to the worker verbatim. Joining them into one line would make it impossible to attribute failures to individual sentences, or to tell how many more need to change together.
        problems: Vec<String>,
    },
    AllFailed {
        salvaged: std::collections::BTreeMap<String, AcceptedPieces>,
        problems: Vec<String>,
    },
}

impl BatchAttempt {
    fn into_parts(
        self,
        batch: &[&Pending],
    ) -> (
        std::collections::BTreeMap<String, AcceptedPieces>,
        std::collections::BTreeMap<String, AcceptedPieces>,
        Vec<String>,
        Vec<String>,
    ) {
        match self {
            Self::Accepted(accepted) => (
                accepted,
                std::collections::BTreeMap::new(),
                Vec::new(),
                Vec::new(),
            ),
            Self::Partial {
                accepted,
                salvaged,
                failed_keys,
                problems,
            } => (accepted, salvaged, failed_keys, problems),
            Self::AllFailed { salvaged, problems } => (
                std::collections::BTreeMap::new(),
                salvaged,
                batch.iter().map(|item| item.sentence.id.clone()).collect(),
                problems,
            ),
        }
    }
}

/// Whether a problem text names sentence `id`.
///
/// Failure texts have no uniform structure (`"{id}: …"`, `"Alignment missing sentence: {id}"`, transport error strings…), so this can only match by substring. Sentence ids contain dots and can be prefixes of one another (`s-g6.1` is a prefix of `s-g6.18`), so the character after a match must not be a letter, digit or dot for it to count as a word boundary.
fn problem_mentions_id(problem: &str, id: &str) -> bool {
    let mut start = 0usize;
    while let Some(pos) = problem[start..].find(id) {
        let hit = start + pos;
        let end = hit + id.len();
        let boundary_after = problem[end..]
            .chars()
            .next()
            .is_none_or(|c| !c.is_ascii_alphanumeric() && c != '.');
        let boundary_before = problem[..hit]
            .chars()
            .next_back()
            .is_none_or(|c| !c.is_ascii_alphanumeric() && c != '-' && c != '.');
        if boundary_after && boundary_before {
            return true;
        }
        start = end;
    }
    false
}

/// The repair-round retryReason. Two things must be included together, otherwise the worker fixes only the last failure, then hits another criterion and needs another round (and there is only [`GLOBAL_REPAIR_CALLS`] round in total). These are: the per-entry validation failures of the previous round (problems not in this table are counted by number, so the worker does not spin on sentences it cannot find), and a restatement of the budget and the suggested piece count. The repair-round payload is a re-rendered table, so the constraints are restated on the `data-budget` basis (per-row thresholds plus suggested piece count).
fn repair_reason_file(
    batch: &[&Pending],
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    problems: &[String],
    omitted_problems: usize,
) -> String {
    let mut reason = format!(
        "Repair only the remaining {} sentences. The table below is freshly rendered; re-segment each group from scratch.",
        batch.len()
    );
    if !problems.is_empty() {
        reason.push_str(
            "\nEvery validation problem from the previous round — fix all of them, not only the last one:",
        );
        for problem in problems {
            reason.push_str("\n- ");
            reason.push_str(problem);
        }
    }
    if omitted_problems > 0 {
        reason.push_str(&format!(
            "\n({omitted_problems} further problem(s) from the previous round concern sentences repaired in parallel calls and are not in this table.)"
        ));
    }
    reason.push_str(&format!(
        "\nConstraints restated for these sentences (unchanged from the first round and still binding; budgets fit={} soft={} hard={}):",
        params.fit, params.soft, params.hard
    ));
    for item in batch {
        let plan = length_plan(item, params, source_lang, target_lang);
        reason.push_str(&format!(
            "\n- {}: rows min={} max={} recommended={}",
            item.sentence.id,
            plan.piece_count.min,
            plan.piece_count.max,
            plan.piece_count.recommended
        ));
    }
    reason
}

/// Task-level union of protected terms. The system prompt (the `contracts/align*.md` written in agent mode) must be byte-for-byte identical across all batches and all rounds of the same task. The contract file is shared per `(kind, attempt)`. Deriving terms per batch would let a later batch overwrite an earlier batch's list, so the worker would read a contract missing its own batch's terms. The failing-sentence subset of a repair round would also make the whole `align-2.md` section disappear. A term is a harmless no-op for sentences that do not contain it, so the full set is worth the stability.
fn task_protected_terms(pending: &[Pending]) -> Vec<String> {
    let mut protected_terms = pending
        .iter()
        .flat_map(|item| item.protected_terms.iter().cloned())
        .collect::<Vec<_>>();
    protected_terms.sort();
    protected_terms.dedup();
    protected_terms
}

// ---- file-v1 carrier (HTML table, design §8) -----------------------------------

/// Source-text marker string in the file-contract carrier.
///
/// Pause tiers follow [`crate::engines::markers::pause_marks`] (0.6 / 1.0 / 1.8 seconds), the same thresholds as the polish and translate carriers. The private [`pause_tier`] in align.rs (1.2 / 0.6 / 0.25) serves the deterministic draft and boundary hints, and **must not** cross into the file carrier. Mixing the two threshold sets would make the same audio show different pause hints in documents at different stages.
fn file_source_marked(words: &[PendingWord]) -> String {
    let mut out = String::new();
    for (index, word) in words.iter().enumerate() {
        if index > 0 {
            let marks = markers::pause_marks(word.t0 - words[index - 1].t1);
            if !marks.is_empty() {
                out.push(' ');
                out.push_str(&marks);
                out.push(' ');
            } else if needs_space_between(
                words[index - 1].text.chars().next_back(),
                word.text.chars().next(),
            ) {
                out.push(' ');
            }
        }
        out.push_str(&word.text);
    }
    out
}

/// Rendering input for the align table, one batch of `Pending` sentences (§8.2).
///
/// The suggested piece count uses `min..max` from [`length_plan`].
/// Seconds, word ids, source Cue boundaries and absolute timestamps never enter the carrier.
/// `unsplittable` is a **returned** field. When the first-round worker self-reports that a sentence has no legal cut point, the repair round must carry that self-report back for review rather than treating it as never said (§8.2). The first round passes an empty set.
fn align_table_input(
    batch: &[&Pending],
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    unsplittable: &BTreeSet<String>,
    no_rewrite: &BTreeSet<String>,
) -> AlignTableInput {
    let sentences = batch
        .iter()
        .map(|item| {
            let plan = length_plan(item, params, source_lang, target_lang);
            AlignSentenceInput {
                id: item.sentence.id.clone(),
                source: file_source_marked(&item.words),
                translation: item.translation.clone(),
                max_lines: 2,
                suggested_pieces: item
                    .frozen_target
                    .as_ref()
                    .filter(|pieces| !pieces.is_empty())
                    .map(|pieces| (pieces.len(), pieces.len()))
                    .unwrap_or((plan.piece_count.min, plan.piece_count.max)),
                unsplittable: unsplittable.contains(&item.sentence.id),
                no_rewrite: no_rewrite.contains(&item.sentence.id),
                frozen_target: item.frozen_target.clone().unwrap_or_default(),
            }
        })
        .collect();
    AlignTableInput {
        lang: target_lang.to_owned(),
        params: params.clone(),
        source_lang: source_lang.to_owned(),
        context_before: Vec::new(),
        sentences,
        context_after: Vec::new(),
    }
}

/// One batch-call request for the file contract (shared by the first round and repair).
fn align_request_file(
    table: &AlignTableInput,
    params: &TransParams,
    source_lang: &str,
    instructions: Option<&str>,
    protected_terms: &[String],
    retry_reason: Option<String>,
) -> LlmRequest {
    LlmRequest {
        kind: "align",
        system: align_system_prompt_file(params, source_lang, instructions, protected_terms),
        user: render_align_table(table),
        temperature: 0.1,
        attempt: if retry_reason.is_some() { 2 } else { 1 },
        retry_reason,
    }
}

/// Table response → batch result, and reports this attempt to the host (`ai/align/<lang>/vNNN`).
///
/// Three strictly layered steps. `parse_align_table` performs only string and structure-level checks (the **only** copy; the submission-time lint goes through the same function). [`file_answers_from_parsed`] maps row pieces to in-sentence word intervals. [`accept_answers`] is the single acceptance core, shared with json-v0.
#[allow(clippy::too_many_arguments)]
fn align_attempt_from_file(
    batch: &[&Pending],
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    table: &AlignTableInput,
    payload: &str,
    raw: &str,
    page_id: &str,
    attempt_index: u32,
    unsplittable: &mut BTreeSet<String>,
    on_attempt: &mut dyn FnMut(&AlignBatchAttempt<'_>),
) -> Result<BatchAttempt, LlmError> {
    let parsed = parse_align_table(table, Some(payload), raw);
    // The worker's data-unsplittable self-report is carried back to the repair round for review (§8.2).
    unsplittable.extend(
        parsed
            .groups
            .iter()
            .filter(|group| group.unsplittable)
            .map(|group| group.id.clone()),
    );
    let (answers, pre_failures) = file_answers_from_parsed(batch, &parsed);
    let verdict = accept_answers(
        batch,
        params,
        source_lang,
        target_lang,
        answers,
        pre_failures,
    );
    let attempt = verdict.map(|(accepted, salvaged, failures)| {
        let failed_keys: Vec<String> = batch
            .iter()
            .filter(|item| !accepted.contains_key(&item.sentence.id))
            .map(|item| item.sentence.id.clone())
            .collect();
        if failed_keys.is_empty() {
            BatchAttempt::Accepted(accepted)
        } else if accepted.is_empty() {
            BatchAttempt::AllFailed {
                salvaged,
                problems: failures,
            }
        } else {
            BatchAttempt::Partial {
                accepted,
                salvaged,
                failed_keys,
                problems: failures,
            }
        }
    });
    // Artifacts are produced regardless of the acceptance outcome. The forensic value of auditing and of "what exactly was sent this round" is highest precisely when a round fails.
    on_attempt(&PageAttempt {
        page_id,
        attempt: attempt_index,
        input: payload,
        output: raw,
        problems: &parsed.diagnostics.problems,
        accepted: matches!(attempt, Ok(BatchAttempt::Accepted(_))),
    });
    attempt
}

/// Whether a sentence-level Problem should block that sentence from entering the acceptance core.
///
/// The string-level lint of [`crate::filepipe::align_table`] reports two classes of codes. **Structural unusability** (the source was altered, the translation is empty, ids are missing or duplicated, concatenation drift…): such an answer cannot be read as a valid split, so it must be kept out of acceptance. **Quality problems** ([`ProblemCode::AlignOverHard`], [`ProblemCode::AlignIllegalSeam`]): in json-v0 these two codes were never grounds for rejection. Over-hard pieces go through `build_recut_candidate` → `enforce_target_hard_limit` → `repair_over_fit_pieces` for deterministic re-splitting, and bad seams go through the Recut / KeepWhole / Salvage tiers. If file-v1 also blocked them, the new carrier would be stricter than json-v0, would burn the only [`GLOBAL_REPAIR_CALLS`] round, and would fall back to length-only splitting. So only the structural codes block here, and the quality codes are demoted to advisories that enter the same acceptance core with the answer.
fn problem_blocks_acceptance(code: ProblemCode) -> bool {
    !matches!(
        code,
        ProblemCode::AlignOverHard | ProblemCode::AlignIllegalSeam
    )
}

/// Parsed result → carrier-agnostic answer IR, plus per-sentence failure details.
///
/// Sentences with structural unusability ([`problem_blocks_acceptance`]) are judged failed directly and do not enter acceptance. `parse_align_table` has already judged them once, and sending them into [`accept_answers`] would only yield a second failure text describing the same thing. Quality codes are demoted to advisories for that sentence and handled by the Recut / KeepWhole / Salvage tiers of the acceptance core, on the same basis as json-v0.
fn file_answers_from_parsed(
    batch: &[&Pending],
    parsed: &AlignParsed,
) -> (Vec<SentenceAnswer>, Vec<String>) {
    let mut failures: Vec<String> = Vec::new();
    let mut blocked: BTreeSet<String> = BTreeSet::new();
    let mut quality: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for problem in &parsed.diagnostics.problems {
        match &problem.scope {
            crate::filepipe::ProblemScope::Sentence { id }
                if !problem_blocks_acceptance(problem.code) =>
            {
                quality
                    .entry(id.clone())
                    .or_default()
                    .push(format!("[{}] {}", problem.code, problem.detail));
            }
            crate::filepipe::ProblemScope::Sentence { id } => {
                blocked.insert(id.clone());
                failures.push(format!("{id}: [{}] {}", problem.code, problem.detail));
            }
            _ => failures.push(format!("[{}] {}", problem.code, problem.detail)),
        }
    }
    let inputs: std::collections::BTreeMap<&str, &&Pending> = batch
        .iter()
        .map(|item| (item.sentence.id.as_str(), item))
        .collect();
    let mut answers = Vec::with_capacity(parsed.groups.len());
    for group in &parsed.groups {
        if blocked.contains(&group.id) {
            continue;
        }
        let Some(input) = inputs.get(group.id.as_str()) else {
            continue;
        };
        let sources: Vec<String> = group
            .rows
            .iter()
            .map(|row| row.source.clone())
            .collect::<Vec<_>>();
        let (ranges, mut advisories) = match file_source_ranges(&group.id, &sources, &input.words) {
            Ok(mapped) => mapped,
            Err(detail) => {
                failures.push(detail);
                continue;
            }
        };
        if let Some(notes) = quality.get(&group.id) {
            advisories.extend(notes.iter().cloned());
        }
        if group.unsplittable {
            advisories.push(
                "worker marked the source as having no legal cut (data-unsplittable) — any over-ceiling row stays whole and `ccut check` reports it as translation-unsplittable"
                    .to_owned(),
            );
        }
        answers.push(SentenceAnswer {
            key: group.id.clone(),
            ranges,
            target_segments: group.rows.iter().map(|row| row.target.clone()).collect(),
            reordered: group.reordered,
            crossing: group.crossing,
            unsplittable: group.unsplittable,
            advisories,
        });
    }
    (answers, failures)
}

/// Table source column → in-sentence word-order interval.
///
/// First try exact character matching ([`source_segments_to_ranges`]). On failure, fall back to normalized-prefix snapping. [`normalize_chars`] strips punctuation, whitespace and ⏸ pause markers (the Unicode category of `⏸` is `OtherSymbol`, which falls under `is_punctuation_or_symbol`), so punctuation the model adds by habit does not make the whole sentence fail, and no separate `strip_markers` is needed. Cut points snap to the nearest word boundary and leave an advisory. Segment text is always rebuilt from word truth (the `AnswerSource::Ranges` branch); a string the model retyped is never used as an anchor.
fn file_source_ranges(
    key: &str,
    segments: &[String],
    words: &[PendingWord],
) -> Result<(Vec<(usize, usize)>, Vec<String>), String> {
    if let Ok(ranges) = source_segments_to_ranges(key, segments, words) {
        return Ok((ranges, Vec::new()));
    }
    if words.is_empty() {
        return Err(format!("{key}: source has no words"));
    }
    if segments.is_empty() {
        return Err(format!("{key}: no rows to map onto the source words"));
    }
    if segments.len() > words.len() {
        return Err(format!(
            "{key}: {} rows cannot map onto {} source words — merge the short rows",
            segments.len(),
            words.len()
        ));
    }
    // Cumulative normalized character length at word boundary i (bounds[0] == 0, bounds[n] == total length).
    let mut bounds = Vec::with_capacity(words.len() + 1);
    let mut total = 0usize;
    bounds.push(0usize);
    for word in words {
        total += normalize_chars(&word.text).chars().count();
        bounds.push(total);
    }
    if total == 0 {
        return Err(format!(
            "{key}: source words normalize to an empty string — cannot map rows onto them"
        ));
    }
    let mut ranges = Vec::with_capacity(segments.len());
    let mut cursor = 0usize;
    let mut consumed = 0usize;
    let mut snapped = 0usize;
    for (index, segment) in segments.iter().enumerate() {
        let seg_len = normalize_chars(segment).chars().count();
        if seg_len == 0 {
            return Err(format!(
                "{key}: row {} has an empty source cell — every row must map to at least one source word",
                index + 1
            ));
        }
        let end_word = if index + 1 == segments.len() {
            words.len()
        } else {
            // `remaining` more rows follow, and each of them must keep at least one word.
            let remaining = segments.len() - index - 1;
            nearest_word_boundary(
                &bounds,
                consumed + seg_len,
                cursor + 1,
                words.len() - remaining,
            )
        };
        if bounds[end_word] != consumed + seg_len {
            snapped += 1;
        }
        ranges.push((cursor, end_word - 1));
        cursor = end_word;
        consumed = bounds[end_word];
    }
    let advisories = if snapped > 0 {
        vec![format!(
            "{snapped} source cut(s) were snapped to the nearest word boundary — the src cells did not reproduce the source words verbatim"
        )]
    } else {
        Vec::new()
    };
    Ok((ranges, advisories))
}

/// Within the boundary indices `[low, high]`, pick the one whose cumulative length is closest to `target`. On a tie, take the earlier one, so the mapping is deterministic.
fn nearest_word_boundary(bounds: &[usize], target: usize, low: usize, high: usize) -> usize {
    let mut best = low;
    let mut best_delta = bounds[low].abs_diff(target);
    for candidate in (low + 1)..=high {
        let delta = bounds[candidate].abs_diff(target);
        if delta < best_delta {
            best = candidate;
            best_delta = delta;
        }
    }
    best
}

// ---- Request construction -------------------------------------------------------------

/// align contract (`file-v1`): the carrier is an HTML table, and the input contains no drafts at all.
///
/// The split evidence is "cutting the source text into src cells". There are no protocol fields such as `useDraft` or `sourceBreaks` to reference. There is no second copy of the criteria: every rejection rule is enforced by the one chain `parse_align_table` + [`accept_answers`].
fn align_system_prompt_file(
    params: &TransParams,
    source_lang: &str,
    instructions: Option<&str>,
    protected_terms: &[String],
) -> String {
    let (source_fit, _) = source_piece_budgets(source_lang);
    let mut prompt = format!(
        r#"You are an expert bilingual subtitle segmenter. The input is ONE HTML table. Each `<tbody data-sid="…">` is one sentence with a single row: the `td.src` cell holds the exact spoken source, the `td.tgt` cell holds its complete translation. "⏸" marks an audio pause ("⏸⏸" longer, "⏸⏸⏸" longest); ⏸ marks are not words. `data-budget` restates the per-row width budget and the suggested piece count; `data-max-lines` is the display-row cap. `<tbody class="ctx">` groups carry no `data-sid` — they are read-only neighbouring context, never edit or emit them.

Work each sentence in two strictly ordered phases. First decide the target-language display pieces from the complete natural translation alone: readability, target-language syntax, protected terms, and the fit/hard limits determine these pieces. Freeze their text and boundaries. Only then split the source cell so that each target piece sits next to the consecutive source words expressing it. Never move, add, or remove a target cut merely to follow source timing, source wording, or an original subtitle cue. Exception: when a group carries `data-target-frozen`, that JSON array already contains target pieces validated during translation. Emit those exact pieces, one per row and in order; change only the source row boundaries. `data-reordered="true"` is forbidden for a frozen group, while `data-crossing="true"` remains available for genuine residual word-order crossing. A group carrying `data-no-rewrite="true"` is a re-cut round: its translation is already accepted, so `data-reordered="true"` is likewise forbidden there — keep every target character as given and only choose different cut points (use `data-crossing="true"` if the mapping genuinely crosses).

Original subtitle cue ids and cue boundaries are deliberately absent from the input. They are not evidence and must never be reconstructed or followed. The ⏸ pause marks are mapping aids only; they may choose where the source is cut after the target pieces are frozen, but must not decide the target pieces. If a faithful monotonic mapping is difficult, use the reorder/crossing policy below instead of distorting the target-language segmentation.

Output protocol — return the SAME table and nothing else (no markdown fences, no prose, no `<style>`, no commentary):
- Keep `<table>` and every `<tbody>` in the input order, keep every `data-sid` byte for byte, and emit every sentence exactly once. Do not invent ids.
- Replace each sentence's single row with ONE `<tr>` per display piece, in reading order: `<tr><td class="src">…</td><td class="tgt">…</td></tr>`. The first row of a group may keep the id `<th>`; set its `rowspan` to the number of rows (it is a redundancy check only).
- CRITICAL cell-role invariant: every output `td.src` must be a consecutive slice copied from the input `td.src`. Never translate, paraphrase, summarize, or copy any `td.tgt` text into `td.src`. If the source is English and the target is Chinese, every output `td.src` remains English. When a fine-grained mapping is uncertain, keep a larger consecutive source slice instead of inventing source text.
- The src cells of a group, concatenated, must reproduce that group's source EXACTLY (⏸ marks and punctuation may be dropped, nothing else may change): the source column is read-only, you only choose where to cut it.
- The tgt cells of a group, concatenated, must reproduce that group's translation EXACTLY — never normalize dashes or quotes, change punctuation, add, drop, translate, or reorder any character. The ONLY exception is a declared reorder (`data-reordered="true"`, below).
- Both columns therefore always have the same number of rows, and every sentence gets at least two rows unless its source genuinely has no legal cut.
- `data-reordered="true"` on the `<tbody>` declares that you rewrote the translation into the source clause order; `data-crossing="true"` declares residual crossing. They are mutually exclusive — never set both. `data-unsplittable="true"` declares that the source really has no legal cut, in which case emit the single whole row.
- Many-to-one is the DEFAULT shape: several consecutive short source phrases sharing ONE target piece is normal and good. Never add a target cut merely to mirror source rhythm, pauses, wording, or historical cue boundaries — cut the target only where its own length or readability requires it.

Length policy (this round is the only segmentation round — do not leave fixable long rows behind):
- Ceiling {hard}: every target piece should come in at ≤ {hard} display characters. An over-{hard} piece is NOT sent back for another attempt — the pipeline deterministically re-splits it at length-based cuts that ignore meaning. Add the cut yourself at the least-bad source boundary instead; a mismatched row is acceptable, a mechanical re-split reads worse. Only when that deterministic re-split would itself break bilingual anchoring does the pipeline keep the piece whole, and the leftover over-{hard} piece is then reported as an alignment defect — never treat that as a licence to leave a cuttable piece over the ceiling.
- Aim every target piece at ≤ {fit} display characters; {soft} or less reads best. {fit} is a hard constraint, not a preference: a piece wider than {fit} that has a FREE seam MUST be cut there now. A seam is free only when all four hold — both sides land at ≤ {fit}, neither side becomes a flash fragment, the seam breaks none of the Boundary-quality bans below, and the seam is backed by punctuation (，；：——、) or by whitespace that really exists in the target text. A space that only appears where CJK meets Latin is NOT a seam: never "担心 | AI 会抢走…". A piece with no free seam may stay in the {fit}..{hard} band — keep it whole rather than trading an over-wide row for a dangling tail. If you leave a free seam uncut, the pipeline cuts it there deterministically.
- The suggested piece count in `data-budget` is advice: you may exceed it when the target genuinely needs it, and you must not pad a balanced sentence to reach it.
- Display characters are measured with each CJK character counting 1, Latin letters and digits about half, whitespace and the trailing punctuation of a piece free.
- Keep pieces reasonably even: avoid a tiny fragment (≤3 target characters) beside a wide one, and avoid one-word source rows unless genuinely standalone. A target piece of {degenerate_units} display characters or more must map to at least {degenerate_words} source words — word-level highlighting otherwise stalls on one word while the row moves on. When the sentence has too few source words for that, let the neighbouring short phrases share one piece instead of slicing the source into crumbs. The source side also has a FLOOR, not just the ceiling below: in a sentence of two or more rows, no row may map to {fragment_words} or fewer source words whose combined width is under {fragment_units} source characters (same source-side counting as {source_fit}). Such a crumb — "So,", "and then", "I mean," — must be merged into the neighbouring row that continues its clause: forward into the following row when the crumb is a leading connective, adverbial or conditional opener, backward into the preceding row when it is a trailing tail; move the target cut together with it rather than leaving a target piece stranded on two words. As with the rule above, this floor is waived when the sentence simply has too few source words to give every row that much.
- Time budget: a viewer must be able to read each target piece within roughly the speech span of its source row. A wordy target piece over a couple of source words is unreadable — move the cut so that piece spans more source words, or let the short phrases share one row with a neighbour.
- Paired-row balance: source length alone never creates a target cut, with one exception below. When one source row exceeds its single-line budget ({source_fit} source characters, whitespace free — this budget is counted on the source side, not in target display units) AND its target piece already contains a complete target-language clause or parallel-action seam, use that target-natural seam so the bilingual row stays scannable. A Chinese 、 may be used only between complete parallel actions under this condition — both pieces must carry their own action verb ("更新技能、 | 检出分支"); never split a mere noun list for symmetry. This 、 cut is checked conservatively: the two source rows around it together must exceed {source_fit} source characters and both target pieces must contain a verb the checker recognizes as an action. If the answer is still reported for ending on the list separator 、, merge those two pieces instead of resubmitting the same cut.
- Paired-row ceiling (the exception): a source row wider than {source_hard} source characters is unreadable next to its target row and MUST be cut once, even when the target has no seam — unless the target piece is under {paired_target_min} target display characters or spans fewer than {paired_min_words} source words, in which case leave it alone. Choose the least-bad target boundary in this order: an existing clause seam; the end of a leading adverbial, conditional or prepositional phrase; before a connective (但/而且/所以/因为/以及) or between subject and predicate; any other word boundary that breaks none of the Boundary-quality bans. You MAY insert a target comma at the cut — punctuation is free, wording is not. Every resulting target piece must still be ≥4 display characters; if no boundary satisfies both that floor and the Boundary-quality bans, keep the row whole rather than producing a bad Chinese piece. One cut is enough: do not chase the source row down to {source_fit}, and never trade a readable target for a narrow source row.

Boundary quality (judgment, in priority order, only AFTER target pieces are frozen):
- Map target piece k to the closest consecutive source-word range expressing the same idea; prefer a natural monotonic mapping, not word-level symmetry. Source boundaries cannot revise the already-fixed target pieces.
- When target order crosses source order, first look for cuts that still keep rows aligned (the closest monotonic mapping often exists). If none exists, PREFER repairing the order: rewrite the target sentence so its clauses follow the source clause order, set `data-reordered="true"`, and put the rewritten sentence into the tgt cells. Adjust only what the new order requires (connectives, particles, punctuation); keep every meaning element, negation, number, name, term, and the register; never compress, expand, or re-translate — a reordered target whose length drifts beyond ~25% is rejected. Only when even reordering cannot produce a natural sentence: set `data-crossing="true"`, cut the TARGET at its own natural seams, and choose best-effort monotonic source cuts whose speech spans are roughly proportional to the paired target widths, so each row's display time matches its reading load; rows may then express different sub-ideas.
- Never cut inside a word or fixed expression, between a verb and its object, inside a name/number/product term, after a dangling connective, before a bound particle, or between an incomplete classifier/determiner and its head noun. In Chinese that means never "我们有一个 | 想改变的系统", "类似 | 于…", "…拆分给 | 各自…", "…转移到了 | …", or "…生成的 | 工作流"; such a row is rejected. Never cut inside a pair of quotes or brackets either — a piece must not end on an unclosed “ ‘ 「 《 （ 【 ( or [ and the next piece must not open with its orphaned closer; never "…包含名为“ | PluginDataJSON”的清单", keep the whole quoted or bracketed span in one piece unless the span itself reaches the hard ceiling (at or above it, splitting inside becomes unavoidable). Keep parallel constructions together (哪些…、哪些没有; both … and …). Prefer ；/。 seams over ，; treat 、 as a list separator except for the paired-row complete-action rule above, and never separate a unit/measure word from its number (never "1000 | 美元"). A Chinese piece that ends without punctuation must not end on a form that still requires what follows. The test is morphological, not a fixed word list: a 把/将 disposal phrase with no predicate yet, a transitive verb plus a directional or resultative complement (到/掉/出/成) with no object, an unclosed locative frame (在/从/对… plus 上/里/中/下/内/间), a pivotal 让/使/叫 phrase with no second predicate, a light verb missing its object, a copula 是 missing its complement — plus the particle 得, an adverb (如何/只是/同时/预先), the modal 可以, a quantifier still awaiting its head noun (一系列/一块), and a light verb plus 了 (采用了/内置了/提供了). Never "剩余的 35% 得 | 支撑每个活跃请求的…" or "输出质量在数学上 | 与…完全相同"; move that cut one or two words later, or keep the piece whole. Words that merely end in one of these characters (心得, 以上, 即将, 把握) are fine. Never cut before the coordinators 和/及/与/或 (including 或者/或是) either — never "它们是 KV 缓存 | 和 PagedAttention"; coordinated items stay in one piece, and a coordinator may open a piece only when the previous piece ends on punctuation. The mirror image is banned too: never cut after the second coordinated item and strand its head noun in the next piece (never "Key 和 Value | 矩阵").
- Keep every core predicate, negation, number, name, and main object in the row whose source words express it.

Before emitting the table, silently verify the output protocol, then improve seams and balance without unnecessary rows."#,
        fit = params.fit,
        soft = params.soft,
        hard = params.hard,
        source_fit = source_fit,
        source_hard = source_piece_hard(source_fit),
        paired_target_min = PAIRED_TARGET_MIN_UNITS,
        paired_min_words = PAIRED_MIN_SOURCE_WORDS,
        degenerate_units = DEGENERATE_TARGET_MIN_UNITS,
        degenerate_words = DEGENERATE_MIN_SOURCE_WORDS,
        fragment_words = FRAGMENT_MAX_SOURCE_WORDS,
        fragment_units = source_fragment_floor(source_fit),
    );
    if !protected_terms.is_empty() {
        prompt.push_str(&format!(
            "\n\nProtected target terms — each is an indivisible display atom. Never let a target row boundary fall inside one of these literal strings: {}",
            protected_terms.join(" · ")
        ));
    }
    if let Some(instructions) = instructions.filter(|text| !text.is_empty()) {
        prompt.push_str(&format!(
            "\n\nExplicit reviewer instructions for THIS batch (highest priority within the output protocol): {instructions}"
        ));
    }
    prompt
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PieceCountPlanJson {
    min: usize,
    max: usize,
    recommended: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SideLengthPlanJson {
    lang: String,
    unit: &'static str,
    total: usize,
    preferred_per_piece: [usize; 2],
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LengthPlanJson {
    piece_count: PieceCountPlanJson,
    source: SideLengthPlanJson,
    target: SideLengthPlanJson,
    target_display_units: usize,
    target_hard_display_units: usize,
}

/// All languages measure length uniformly in characters. zh uses reading units (CJK = 1, two half-width characters ≈ 1, i.e. half-width cell width ÷ 2); other languages count non-whitespace characters. The word-count (and eojeol-count) basis has been abandoned: word counts underestimate visual width (13 long English words can be wider than 100 half-width cells), which was the direct reason long pieces slipped through. The atomicity of splitting is unaffected by the measure: the cut-point protocol is still word boundaries (bN).
fn length_unit_name(lang: &str) -> &'static str {
    if matches!(primary_subtag(lang).as_str(), "zh" | "ja" | "th") {
        "readingCharacter"
    } else {
        "character"
    }
}

fn text_length_units(text: &str, lang: &str) -> usize {
    target_cps_chars(text, lang)
}

fn source_length_units(words: &[PendingWord], lang: &str) -> usize {
    let joined = join_word_texts(words.iter());
    target_cps_chars(&joined, lang)
}

/// The threshold for "exceeds one line" on the source side, and the suggested piece width, in character units on the same basis as the target language. Used only for long-sentence judgment (fusion needs_split) and payload suggestions. It does not take part in the piece-count floor, which is driven by the translation's reading needs (the many-to-one default shape). 42 matches the single-line limit derived from source Cues.
pub(crate) fn source_piece_budgets(lang: &str) -> (usize, usize) {
    match primary_subtag(lang).as_str() {
        "zh" | "ja" | "th" => (16, 14),
        "ko" => (18, 15),
        _ => (42, 32),
    }
}

fn source_word_units(words: &[PendingWord], lang: &str) -> Vec<usize> {
    words
        .iter()
        .map(|word| target_cps_chars(&word.text, lang))
        .collect()
}

fn source_range_seconds(ends_sec: &[f64], from: usize, to: usize) -> f64 {
    let Some(&end) = ends_sec.get(to) else {
        return 0.0;
    };
    let start = from
        .checked_sub(1)
        .and_then(|index| ends_sec.get(index))
        .copied()
        .unwrap_or(0.0);
    (end - start).max(0.0)
}

fn source_range_is_dense(
    units: &[usize],
    ends_sec: &[f64],
    source_fit: usize,
    from: usize,
    to: usize,
) -> bool {
    if from > to || to >= units.len() {
        return false;
    }
    units[from..=to].iter().sum::<usize>() > source_fit
        || source_range_seconds(ends_sec, from, to) > PAIRED_SOURCE_MAX_SECONDS
}

/// Both sides of an enumeration comma (、) must each carry a high-confidence action predicate to be considered independently displayable parallel actions. This lexical guard is deliberately conservative: it is better to keep an uncertain structure as an ordinary list than to wrongly split noun enumerations such as `GitLab、CircleCI` or `控制器、执行器` (controller, actuator).
fn contains_parallel_action(text: &str) -> bool {
    const ACTION_MARKERS: &[&str] = &[
        "关闭",
        "更新",
        "检出",
        "找出",
        "清理",
        "运行",
        "安装",
        "审阅",
        "创建",
        "切换",
        "检查",
        "获取",
        "生成",
        "打开",
        "保存",
        "添加",
        "删除",
        "修复",
        "发布",
        "部署",
        "编译",
        "测试",
        "处理",
        "设置",
        "使用",
        "发送",
        "返回",
        "纳入",
        "跟踪",
        "记录",
        "调用",
        "读取",
        "提交",
        "推送",
        "改代码",
        "改技能",
    ];
    ACTION_MARKERS.iter().any(|marker| text.contains(marker))
}

fn contains_cjk_clause_predicate(text: &str) -> bool {
    const PREDICATE_MARKERS: &[&str] = &[
        "有",
        "是",
        "会",
        "能",
        "要",
        "需",
        "可以",
        "能够",
        "应该",
        "属于",
        "意味着",
        "变得",
        "完成",
        "适用",
        "包含",
        "支持",
        "保持",
        "需要",
        "知道",
        "认为",
        "发现",
        "希望",
        "想要",
    ];
    contains_parallel_action(text) || PREDICATE_MARKERS.iter().any(|marker| text.contains(marker))
}

/// The paired-density guard is more conservative than general fit splitting. The left side of a Chinese comma must carry a high-confidence predicate, to avoid mistaking an adverbial fronted fragment such as“in actual operation, | because…” for a complete clause. Colons, semicolons and dashes remain self-sufficient, strong semantic seams.
fn paired_clause_seam(text: &str, lang: &str) -> Option<String> {
    let chars: Vec<char> = text.chars().collect();
    for (index, ch) in chars.iter().enumerate() {
        if !matches!(ch, '，' | '；' | '：' | '—' | ',' | ';' | ':') {
            continue;
        }
        if *ch == '—' && chars.get(index + 1) == Some(&'—') {
            continue;
        }
        let left: String = chars[..=index].iter().collect();
        let right: String = chars[index + 1..].iter().collect();
        if crate::split::piece_display_units(&left, lang) < 4
            || crate::split::piece_display_units(&right, lang) < 4
        {
            continue;
        }
        if primary_subtag(lang) == "zh"
            && matches!(ch, '，' | ',')
            && !contains_cjk_clause_predicate(&left)
        {
            continue;
        }
        let tail_start = index.saturating_sub(5);
        return Some(chars[tail_start..=index].iter().collect());
    }
    None
}

/// Natural target-language seams allowed in bilingual pairing mode. Ordinary clause punctuation follows the existing rules. An enumeration comma is a candidate only when both sides are complete, independently readable parallel actions. Whether the cut point is actually kept is still decided by the source-span guard.
fn paired_balance_seam(text: &str, lang: &str) -> Option<String> {
    if let Some(seam) = paired_clause_seam(text, lang) {
        return Some(seam);
    }
    let chars: Vec<char> = text.chars().collect();
    for (index, ch) in chars.iter().enumerate() {
        if *ch != '、' || index + 1 >= chars.len() {
            continue;
        }
        let left: String = chars[..=index].iter().collect();
        let right: String = chars[index + 1..].iter().collect();
        if crate::split::piece_display_units(&left, lang) >= 4
            && crate::split::piece_display_units(&right, lang) >= 4
            && contains_parallel_action(&left)
            && contains_parallel_action(&right)
        {
            return Some(
                left.chars()
                    .rev()
                    .take(6)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect(),
            );
        }
    }
    None
}

fn allowed_balanced_list_seams(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_units: &[usize],
    source_ends_sec: &[f64],
    source_fit: usize,
) -> BTreeSet<usize> {
    let mut allowed = BTreeSet::new();
    for index in 0..texts.len().saturating_sub(1) {
        if !is_parallel_action_list_seam(&texts[index], &texts[index + 1])
            || index + 1 >= ranges.len()
        {
            continue;
        }
        let from = ranges[index].0;
        let to = ranges[index + 1].1;
        if source_range_is_dense(source_units, source_ends_sec, source_fit, from, to) {
            allowed.insert(index);
        }
    }
    allowed
}

/// The lexical half of the "parallel-action enumeration-comma seam": the left piece ends with `、` and both pieces carry high-confidence action words. Each caller supplies the source-span half from whatever basis it holds (word interval or source row text).
fn is_parallel_action_list_seam(left: &str, right: &str) -> bool {
    left.trim_end().ends_with('、')
        && contains_parallel_action(left)
        && contains_parallel_action(right)
}

/// The same exemption for the align-table carrier (file-v1): the payload carries no word times, only the source text of each row, so the source span is taken only from the width half. The combined source text of two adjacent rows (pause markers removed, whitespace not counted) exceeds the single-row source budget `source_fit`. It shares its lexical rules and thresholds with [`allowed_balanced_list_seams`], and returns left-piece indices (same base as `SeamLintIssue::piece_index`).
pub(crate) fn allowed_list_seam_indices_for_source_rows(
    targets: &[&str],
    sources: &[&str],
    source_lang: &str,
) -> BTreeSet<usize> {
    let (source_fit, _) = source_piece_budgets(source_lang);
    let width = |text: &str| text_length_units(&markers::strip_markers(text), source_lang);
    (0..targets.len().saturating_sub(1))
        .filter(|&index| index + 1 < sources.len())
        .filter(|&index| is_parallel_action_list_seam(targets[index], targets[index + 1]))
        .filter(|&index| width(sources[index]) + width(sources[index + 1]) > source_fit)
        .collect()
}

/// Enumeration-comma "parallel-action seams" that may be kept among stored manyToOne entries. `ccut check` and the provider/Agent acceptance share the same action lexicon and source-span conditions. Ordinary noun lists return an empty set.
pub fn allowed_list_seam_indices_for_ranges(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_word_units: &[usize],
    source_word_ends_sec: &[f64],
    source_lang: &str,
) -> BTreeSet<usize> {
    let (source_fit, _) = source_piece_budgets(source_lang);
    allowed_balanced_list_seams(
        texts,
        ranges,
        source_word_units,
        source_word_ends_sec,
        source_fit,
    )
}

/// Hard cap on source-row width (reading units): 1.5 times the single-row budget. The soft tier (`source_fit`) leaves an extra half row above it, so that the normal many-to-one shape, which slightly exceeds the row while the target has no seam, is not dragged into re-splitting.
fn source_piece_hard(source_fit: usize) -> usize {
    source_fit * 3 / 2
}

/// Diagnostic result for a source row over the hard cap. `index` is the target-piece index. The other fields let the CLI give a readable reason; they take no part in judgment.
#[derive(Debug, Clone, PartialEq)]
pub struct SourceCeilingIssue {
    pub index: usize,
    pub units: usize,
    pub seconds: f64,
    pub target_units: usize,
    pub words: usize,
}

fn source_ceiling_issues(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_units: &[usize],
    source_ends_sec: &[f64],
    source_fit: usize,
    target_lang: &str,
) -> Vec<SourceCeilingIssue> {
    let hard = source_piece_hard(source_fit);
    texts
        .iter()
        .zip(ranges)
        .enumerate()
        .filter_map(|(index, (text, &(from, to)))| {
            if from > to || to >= source_units.len() {
                return None;
            }
            let words = to - from + 1;
            if words < PAIRED_MIN_SOURCE_WORDS {
                return None;
            }
            let target_units = target_cps_chars(text, target_lang);
            if target_units < PAIRED_TARGET_MIN_UNITS {
                return None;
            }
            let units = source_units[from..=to].iter().sum::<usize>();
            let seconds = source_range_seconds(source_ends_sec, from, to);
            (units > hard || seconds > PAIRED_SOURCE_HARD_SECONDS).then_some(SourceCeilingIssue {
                index,
                units,
                seconds,
                target_units,
                words,
            })
        })
        .collect()
}

/// Lower bound on source-row width (reading units): a quarter of the single-row budget. en 42→10, zh/ja/th 16→4, ko 18→4. It is derived from `source_piece_budgets` together with [`source_piece_hard`], not from a separate basis.
fn source_fragment_floor(source_fit: usize) -> usize {
    source_fit / 4
}

/// Diagnostic result for a source row that is too narrow (a fragment paired row). `index` is the target-piece index. The other fields let the CLI give a readable reason; they take no part in judgment.
#[derive(Debug, Clone, PartialEq)]
pub struct SourceFragmentIssue {
    pub index: usize,
    pub units: usize,
    pub words: usize,
    pub target_units: usize,
}

/// Fragment paired row: a piece is attached to ≤ [`FRAGMENT_MAX_SOURCE_WORDS`] source words, and their display width is below [`source_fragment_floor`]. It fills the **double-exemption blind spot** of `source_ceiling_issues`. There, `words < PAIRED_MIN_SOURCE_WORDS` or `target_units < PAIRED_TARGET_MIN_UNITS` directly returns None. So the source side has an upper bound but no lower bound, and fragments such as "of a" / "then." / "and the" were never claimed by anyone.
///
/// Three exemptions (existing exemptions are narrowed, not removed; short sentences are still not reported):
/// 1. A single-piece sentence is not reported: when the sentence is one piece, that piece is the whole sentence, so there is no fragment.
/// 2. Not reported when the sentence has fewer source words than `pieces × FRAGMENT_MIN_SENTENCE_WORDS` (the same arithmetic exemption as `degenerate_paired_row`).
/// 3. Not reported when the target piece width is ≥ [`DEGENERATE_TARGET_MIN_UNITS`]. That is the territory of `degenerate_paired_row` (a wide translation paired with a narrow source is rejected outright, and it has an audited 40% width exemption for intervals of two or more words). The two channels must not both fire on the same piece, or the exemption there would be quietly overturned.
fn source_fragment_issues(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_units: &[usize],
    source_fit: usize,
    target_lang: &str,
) -> Vec<SourceFragmentIssue> {
    if texts.len() != ranges.len() || texts.len() < 2 {
        return Vec::new();
    }
    if source_units.len() < ranges.len() * FRAGMENT_MIN_SENTENCE_WORDS {
        return Vec::new();
    }
    let floor = source_fragment_floor(source_fit);
    texts
        .iter()
        .zip(ranges)
        .enumerate()
        .filter_map(|(index, (text, &(from, to)))| {
            if from > to || to >= source_units.len() {
                return None;
            }
            let words = to - from + 1;
            if words > FRAGMENT_MAX_SOURCE_WORDS {
                return None;
            }
            let target_units = target_cps_chars(text, target_lang);
            if target_units >= DEGENERATE_TARGET_MIN_UNITS {
                return None;
            }
            let units = source_units[from..=to].iter().sum::<usize>();
            (units < floor).then_some(SourceFragmentIssue {
                index,
                units,
                words,
                target_units,
            })
        })
        .collect()
}

/// Raw geometry of the worst paired source row: `(largest source row in reading units, largest source row time window in seconds)`.
///
/// Deliberately does **not** apply `source_ceiling_issues`' eligibility filter (`PAIRED_MIN_SOURCE_WORDS` / `PAIRED_TARGET_MIN_UNITS`). This is the incumbent baseline for the guardrail comparison, and a looser value means fewer false rejections; the direction is always to lean toward accepting.
fn worst_source_row(
    ranges: &[(usize, usize)],
    source_units: &[usize],
    source_ends_sec: &[f64],
) -> (usize, f64) {
    ranges
        .iter()
        .filter(|&&(from, to)| from <= to && to < source_units.len())
        .fold((0usize, 0.0f64), |(units, seconds), &(from, to)| {
            (
                units.max(source_units[from..=to].iter().sum::<usize>()),
                seconds.max(source_range_seconds(source_ends_sec, from, to)),
            )
        })
}

/// Tolerance for comparing time windows. Source word end times are rounded to 0.1 s, so floating-point equality must not use a bare `>`.
const SOURCE_SECONDS_EPS: f64 = 1e-6;

/// Non-regression guardrail: an answer returned by a targeted repair round must not make the worst row that exceeds the paired source-row cap worse than the incumbent draft.
///
/// Scene (Jeff Dean project t-msr6a4xn / s-g123.0): to meet `pieceCount.min`, the worker added the cheapest cut at the start of the sentence, which worsened the worst source row from the draft's 70 units / 5.6s to 110 units / 8.6s. Neither the engine's acceptance nor the submit lint had any incumbent comparison, so this net regression was silently stored.
///
/// Three restraints ensure that it only prevents regression and does not forbid leaving things as they are:
/// 1. Only rows in the answer that **still exceed the limit** are examined. When the answer does not exceed the limit at all, the guardrail is structurally not triggered (this preserves every ordinary answer other than the one covered by `source_ceiling_blocks_the_draft_but_never_rejects_the_answer`).
/// 2. It applies only on dimensions where the incumbent itself already exceeds the limit. If the draft is clean on that dimension, this round was not dispatched for that dimension, and there is no authority to reject on that basis.
/// 3. Reject only when strictly greater. Equal width (including an idle answer whose `sourceBreaks` match the draft exactly) and improvements both pass. Idling is the job of `refine-align`'s follow-up rounds, not of the acceptance gate.
fn source_ceiling_regression(
    issues: &[SourceCeilingIssue],
    draft_worst_units: usize,
    draft_worst_seconds: f64,
    source_fit: usize,
    piece_total: usize,
) -> Option<String> {
    let hard = source_piece_hard(source_fit);
    let units_eligible = draft_worst_units > hard;
    let seconds_eligible = draft_worst_seconds > PAIRED_SOURCE_HARD_SECONDS;
    if !units_eligible && !seconds_eligible {
        return None;
    }
    issues.iter().find_map(|issue| {
        let worse_units = units_eligible && issue.units > draft_worst_units;
        let worse_seconds =
            seconds_eligible && issue.seconds > draft_worst_seconds + SOURCE_SECONDS_EPS;
        (worse_units || worse_seconds).then(|| {
            format!(
                "piece {}/{piece_total} maps to a source row of {} display units / {:.1}s, worse than the incoming draft's worst row ({draft_worst_units} units / {draft_worst_seconds:.1}s) and still past the paired-row ceiling ({hard} units / {PAIRED_SOURCE_HARD_SECONDS:.1}s) — a targeted repair must hold or improve that worst row: cut the widest row instead of adding a cheap cut elsewhere, or keep the draft's boundaries",
                issue.index + 1,
                issue.units,
                issue.seconds
            )
        })
    })
}

/// Degenerate paired row: a target piece with width ≥ [`DEGENERATE_TARGET_MIN_UNITS`] is paired with fewer than [`DEGENERATE_MIN_SOURCE_WORDS`] source words. Returns the first violating row as `(1-based piece number, source word count, target width)`.
///
/// Two exemptions, so that unsatisfiable requirements are not sent back to the worker over and over:
/// 1. Not reported when the sentence's source word count is not enough for every piece to reach the word-count floor. (The sentence's piece count is already frozen, and rejecting again would only fall back to the proportional anchoring of `fallback_word_entry`.)
/// 2. When the source interval has ≥2 words and its own display width has reached 40% of the target piece (long identifiers or long words), the paired row is not visually unbalanced. This is the second of the two criteria the audit gave. The width exemption does not cover single-word intervals: highlighting advances word by word, and a single word takes one step however wide it is.
pub fn degenerate_paired_row(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_units: &[usize],
    target_lang: &str,
) -> Option<(usize, usize, usize)> {
    if texts.len() != ranges.len() || texts.len() < 2 {
        return None;
    }
    if source_units.len() < ranges.len() * DEGENERATE_MIN_SOURCE_WORDS {
        return None;
    }
    texts
        .iter()
        .zip(ranges)
        .enumerate()
        .find_map(|(index, (text, &(from, to)))| {
            if from > to || to >= source_units.len() {
                return None;
            }
            let words = to - from + 1;
            if words >= DEGENERATE_MIN_SOURCE_WORDS {
                return None;
            }
            let target_units = target_cps_chars(text, target_lang);
            if target_units < DEGENERATE_TARGET_MIN_UNITS {
                return None;
            }
            // The width exemption applies only to intervals of two or more words. Word-by-word highlighting advances per word, so a single-word interval is one step however wide it renders. That is exactly the visual break the audit describes.
            let units = source_units[from..=to].iter().sum::<usize>();
            (words < 2 || units * 5 < target_units * 2).then_some((index + 1, words, target_units))
        })
}

/// Diagnostic for the source-row hard cap on stored manyToOne entries. Shared by `ccut check` and the draft gate, so the CLI does not copy the thresholds. The hard tier only reports the problem and drives targeted re-alignment; it does not take part in rejection by engine acceptance (see the note at `evaluate_candidate`).
pub fn source_ceiling_issues_for_ranges(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_word_units: &[usize],
    source_word_ends_sec: &[f64],
    source_lang: &str,
    target_lang: &str,
) -> Vec<SourceCeilingIssue> {
    let (source_fit, _) = source_piece_budgets(source_lang);
    source_ceiling_issues(
        texts,
        ranges,
        source_word_units,
        source_word_ends_sec,
        source_fit,
        target_lang,
    )
}

/// Diagnostic for the source-row width floor on stored manyToOne entries. Shared by `ccut check` and the draft gate, so the CLI does not copy the thresholds. Like the hard cap, it only reports the problem and drives targeted re-alignment; it does not take part in rejection by engine acceptance (see the note at `evaluate_candidate`).
///
/// The whole-sentence-display degraded path does **not** call this function. A whole sentence is a single piece, and is exempt by definition.
pub fn source_fragment_issues_for_ranges(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_word_units: &[usize],
    source_lang: &str,
    target_lang: &str,
) -> Vec<SourceFragmentIssue> {
    let (source_fit, _) = source_piece_budgets(source_lang);
    source_fragment_issues(texts, ranges, source_word_units, source_fit, target_lang)
}

/// Hard source-row cap diagnostic for the whole-sentence display shape. Displaying the whole sentence is itself a paired row (source = the whole sentence's word interval, target = the whole sentence's translation), so it must obey the same hard cap as a single manyToOne piece. It therefore reuses `source_ceiling_issues` directly: the whole sentence is treated as the only target piece, and the whole word interval as the only source span. The align engine's `no_entry_needed` gate and the degraded path of `ccut check` both use this function, and neither side may copy the threshold.
///
/// Source-side units are computed word by word with exactly the same basis as `ccut check`, and `ends_sec` is zeroed relative to the first word's `t0`, keeping centisecond precision.
pub fn whole_sentence_source_ceiling_issue(
    source_words: &[&Word],
    translation: &str,
    source_lang: &str,
    target_lang: &str,
) -> Option<SourceCeilingIssue> {
    let first = source_words.first()?;
    let source_units = source_words
        .iter()
        .map(|word| target_cps_chars(&word.text, source_lang))
        .collect::<Vec<_>>();
    let source_ends_sec = source_words
        .iter()
        .map(|word| ((word.t1 - first.t0) * 10.0).round() / 10.0)
        .collect::<Vec<_>>();
    source_ceiling_issues_for_ranges(
        &[translation.to_owned()],
        &[(0, source_words.len() - 1)],
        &source_units,
        &source_ends_sec,
        source_lang,
        target_lang,
    )
    .into_iter()
    .next()
}

fn paired_density_issue(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_units: &[usize],
    source_ends_sec: &[f64],
    source_fit: usize,
    target_lang: &str,
) -> Option<(usize, String)> {
    texts
        .iter()
        .zip(ranges)
        .enumerate()
        .find_map(|(index, (text, &(from, to)))| {
            if !source_range_is_dense(source_units, source_ends_sec, source_fit, from, to) {
                return None;
            }
            paired_balance_seam(text, target_lang).map(|seam| (index, seam))
        })
}

/// Diagnostic of bilingual paired density for stored manyToOne entries. Shared by `ccut check` and the engine's acceptance, so the CLI does not copy thresholds or the target-seam algorithm. Returns the first target piece that needs targeted re-alignment, together with its seam hint.
pub fn paired_density_issue_for_ranges(
    texts: &[String],
    ranges: &[(usize, usize)],
    source_word_units: &[usize],
    source_word_ends_sec: &[f64],
    source_lang: &str,
    target_lang: &str,
) -> Option<(usize, String)> {
    let (source_fit, _) = source_piece_budgets(source_lang);
    paired_density_issue(
        texts,
        ranges,
        source_word_units,
        source_word_ends_sec,
        source_fit,
        target_lang,
    )
}

fn preferred_piece_units(total: usize, pieces: usize) -> [usize; 2] {
    let pieces = pieces.max(1);
    // Keep 25% above and below the target mean. This is an advisory range for shifting semantic cut points, not a hard cutting line.
    let min = (total.saturating_mul(3) / pieces.saturating_mul(4)).max(1);
    let max = total
        .saturating_mul(5)
        .div_ceil(pieces.saturating_mul(4))
        .max(min);
    [min, max]
}

fn length_plan(
    item: &Pending,
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
) -> LengthPlanJson {
    let target_display_units = target_cps_chars(&item.translation, target_lang);
    let source_piece_capacity = item.words.len().max(1);
    let source_total = source_length_units(&item.words, source_lang);
    // Piece count is driven entirely by the translation's reading needs (the many-to-one default shape). Source length no longer raises min or recommended; otherwise a compact translation for a long source would be chopped into flashing fragments. min..max continues the feasible range of fit..soft. recommended uses rounding rather than always ceil, so that sentences near 4 pieces, such as 57/14, are not mechanically pushed to 5.
    let target_min = target_display_units.div_ceil(params.fit.max(1)).max(1);
    let target_max = target_display_units
        .div_ceil(params.soft.max(1))
        .max(target_min);
    // Validation requires ≥2 pieces for every queued long sentence (a compact translation queued by the duration guardrail would otherwise compute target_min = 1). The payload must not claim min=1, which would conflict with the contract.
    let min = target_min.min(source_piece_capacity).max(2);
    let max = target_max.max(min).min(source_piece_capacity).max(min);
    let target_recommended = (target_display_units + params.soft.max(1) / 2) / params.soft.max(1);
    let recommended = target_recommended.clamp(min, max);
    let target_total = text_length_units(&item.translation, target_lang);
    LengthPlanJson {
        piece_count: PieceCountPlanJson {
            min,
            max,
            recommended,
        },
        source: SideLengthPlanJson {
            lang: source_lang.to_owned(),
            unit: length_unit_name(source_lang),
            total: source_total,
            preferred_per_piece: preferred_piece_units(source_total, recommended),
        },
        target: SideLengthPlanJson {
            lang: target_lang.to_owned(),
            unit: length_unit_name(target_lang),
            total: target_total,
            preferred_per_piece: preferred_piece_units(target_total, recommended),
        },
        target_display_units,
        target_hard_display_units: params.hard,
    }
}

/// Unit-test helper: renders source words as a whole-sentence text with pause markers (no spaces between CJK words).
#[cfg(test)]
fn render_source(words: &[PendingWord]) -> String {
    let mut out = String::new();
    for (index, word) in words.iter().enumerate() {
        if index > 0 {
            if word.pause_before > 0 {
                out.push(' ');
                for _ in 0..word.pause_before {
                    out.push('⏸');
                }
                out.push(' ');
            } else if needs_space_between(
                words[index - 1].text.chars().next_back(),
                word.text.chars().next(),
            ) {
                out.push(' ');
            }
        }
        out.push_str(&word.text);
    }
    out
}

fn needs_space_between(left: Option<char>, right: Option<char>) -> bool {
    let cjk = |ch: char| {
        matches!(ch,
            '\u{4E00}'..='\u{9FFF}' | '\u{3040}'..='\u{30FF}' | '\u{AC00}'..='\u{D7AF}'
                | '\u{3000}'..='\u{303F}' | '\u{FF00}'..='\u{FFEF}')
    };
    !(left.is_some_and(cjk) && right.is_some_and(cjk))
}

struct DraftMarked {
    // The next three fields are kept for regression-test observation of draft acceptance. The runtime guardrail needs only the worst source-row geometry below, and no longer serialises the draft itself as a paging-cost projection.
    #[allow(dead_code)]
    widths: Vec<usize>,
    #[allow(dead_code)]
    ready: bool,
    /// The per-item reason for `ready == false`, so the draft-acceptance regression tests can pinpoint the failing seam.
    #[allow(dead_code)]
    blockers: Vec<String>,
    /// Raw geometry (reading units) of the worst paired source row. This is the incumbent baseline of the guardrail; together with `worst_source_seconds` it serves as the non-regression baseline at submission time.
    worst_source_units: usize,
    /// Time window (seconds) of the worst paired source row. It must use the same `source_range_seconds` basis as the hard tier.
    worst_source_seconds: f64,
}

fn source_boundary_issue_is_blocking(reason: &str) -> bool {
    reason.starts_with("source infinitive complement ")
}

/// Before acceptance, repair over-fit pieces on the text side only (independent rows have no source interval to keep in sync): if a piece exceeds one row and has a free seam, cut it along that seam. Pieces without a free seam stay whole. They belong to the translation-unsplittable channel, and forcing a cut would only create dangling tails.
fn repair_over_fit_pieces(texts: Vec<String>, lang: &str, params: &TransParams) -> Vec<String> {
    let mut repaired = Vec::with_capacity(texts.len() + 1);
    for text in texts {
        match free_seam_for_over_fit(&text, lang, params) {
            Some((left, right)) => {
                repaired.push(left);
                repaired.push(right);
            }
            None => repaired.push(text),
        }
    }
    repaired
}

/// Before acceptance, repair over-fit pieces in paired rows, keeping text and source interval in sync. This is the same reasoning as flash-fragment repair: this kind of mechanical repair should not consume the single global repair call (`GLOBAL_REPAIR_CALLS=1`, which other sentences also need), and `free_seam` has already computed the cut point together with the text on both sides. If the source interval cannot be cut cleanly (only one word, or no non-risky word boundary can be found), keep the piece whole and fall back to an advisory. In that case what needs changing is the source-side mapping, not the translation split.
fn repair_over_fit_pieces_with_ranges(
    pieces: Vec<(String, (usize, usize))>,
    source_words: &[&str],
    lang: &str,
    params: &TransParams,
) -> Vec<(String, (usize, usize))> {
    let mut repaired = Vec::with_capacity(pieces.len() + 1);
    for (text, (from, to)) in pieces {
        let Some((left, right)) = free_seam_for_over_fit(&text, lang, params) else {
            repaired.push((text, (from, to)));
            continue;
        };
        let Some(boundary) = clean_source_cut(source_words, from, to, &left, &right, lang) else {
            repaired.push((text, (from, to)));
            continue;
        };
        repaired.push((left, (from, boundary - 1)));
        repaired.push((right, (boundary, to)));
    }
    repaired
}

fn free_seam_for_over_fit(
    text: &str,
    lang: &str,
    params: &TransParams,
) -> Option<(String, String)> {
    exceeds_one_line_fit(text, lang, params.fit)
        .then(|| free_seam(text, lang, params))
        .flatten()
}

/// Within `from..=to`, picks the source word boundary whose ratio is closest to the translation's width ratio and which is not itself a risky boundary.
fn clean_source_cut(
    source_words: &[&str],
    from: usize,
    to: usize,
    left: &str,
    right: &str,
    lang: &str,
) -> Option<usize> {
    if to <= from {
        return None;
    }
    let left_units = target_cps_chars(left, lang);
    let total = left_units + target_cps_chars(right, lang);
    if total == 0 {
        return None;
    }
    let span = to - from + 1;
    let offset = ((span * left_units).div_ceil(total)).clamp(1, span - 1);
    let ideal = from + offset;
    (from + 1..=to)
        .filter(|boundary| {
            source_boundary_strength(source_words, *boundary) > 0
                && source_boundary_issue(source_words, *boundary).is_none()
        })
        .min_by_key(|boundary| (boundary.abs_diff(ideal), *boundary))
}

// The sole definition of CJK intra-word cut detection lives in [`crate::seam`]. The deterministic draft gate and the `free_seam` free-seam criterion must share one source; otherwise the two would reach opposite conclusions about the same seam.

/// Offers the model a zero-LLM candidate that is complete and can always be anchored back. Most sentences only need to return `useDraft:true`. `draftReady` blocks four classes of problems: delivery hard constraints, blocking seams and source-side fragments; suspected CJK intra-word cuts; and "over fit with a clause seam inside the piece" (fit is achieved in one round, removing the second check→refine round). Over-fit pieces with no seam, and the preferred range, are still review hints and do not force a re-transcription.
fn deterministic_draft(
    item: &Pending,
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
) -> DraftMarked {
    debug_assert!(!item.words.is_empty());
    let source_words_all: Vec<&str> = item.words.iter().map(|word| word.text.as_str()).collect();
    // refine / force re-split: the currently accepted split is the best baseline for the draft. A recomputed deterministic draft would revert already-fixed sentences to the bad split (a trap measured in G1).
    if let Some(existing) = &item.existing
        && existing
            .ranges
            .iter()
            .all(|&(from, to)| from <= to && to < item.words.len())
    {
        return draft_from_pieces(
            item,
            existing
                .texts
                .iter()
                .cloned()
                .zip(existing.ranges.iter().copied())
                .collect(),
            params,
            source_lang,
            target_lang,
            &source_words_all,
        );
    }
    let texts = split_independent_for_lang_protected(
        &item.translation,
        params,
        item.words.len(),
        target_lang,
        &item.protected_terms,
    );
    let texts = repair_lint_pieces(texts, target_lang, params);
    let source_words: Vec<&str> = item.words.iter().map(|word| word.text.as_str()).collect();
    let pieces = reanchor_texts(texts, &source_words, target_lang);
    let last = item.words.len() - 1;
    let anchored: Vec<(String, (usize, usize))> = pieces
        .into_iter()
        .map(|piece| {
            let from = piece.from.unwrap_or(0).min(last);
            let to = piece.to.unwrap_or(last).min(last).max(from);
            (piece.text, (from, to))
        })
        .collect();
    draft_from_pieces(
        item,
        anchored,
        params,
        source_lang,
        target_lang,
        &source_words_all,
    )
}

/// Piece list (text + in-sentence word-order interval) → marker-string draft and the ready judgment.
fn draft_from_pieces(
    item: &Pending,
    pieces: Vec<(String, (usize, usize))>,
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    source_words: &[&str],
) -> DraftMarked {
    let widths: Vec<usize> = pieces
        .iter()
        .map(|(text, _)| crate::split::piece_display_units(text, target_lang))
        .collect();
    // The reasons for each component of ready are collected one by one. p850's second-round measurements showed that when a worker faces draftReady=false with no reason, its only option is to re-transcribe the whole sentence explicitly (five sentences resubmitted unchanged passed). Giving the blockers lets the model fix only the seams it is told about.
    let mut blockers: Vec<String> = Vec::new();
    for (index, width) in widths.iter().enumerate() {
        if *width > params.hard {
            blockers.push(format!(
                "piece {}/{} is {width} chars, over the {} hard ceiling",
                index + 1,
                widths.len(),
                params.hard
            ));
        }
    }
    if pieces.len() < 2 {
        blockers.push("draft has a single piece — the sentence needs at least two".to_owned());
    }
    let plan = length_plan(item, params, source_lang, target_lang);
    if pieces.len() < plan.piece_count.min && widths.iter().any(|width| *width >= params.fit) {
        blockers.push(format!(
            "draft has {} pieces, below pieceCount.min={} while a piece is at/above fit {} — add a target-natural cut",
            pieces.len(), plan.piece_count.min, params.fit
        ));
    }
    // The single-source-word piece check is by word position, not by character. On the character basis, >1 is always true, which would let through a draft that isolates one word in its own piece (unless that word is itself wide enough to stand as a piece).
    for (index, (_, (from, to))) in pieces.iter().enumerate() {
        if to - from + 1 < 2 && source_length_units(&item.words[*from..=*to], source_lang) < 4 {
            blockers.push(format!(
                "piece {}/{} strands a single narrow source word",
                index + 1,
                pieces.len()
            ));
        }
    }
    let refs: Vec<&str> = pieces.iter().map(|(text, _)| text.as_str()).collect();
    for (index, (_, (_, to))) in pieces
        .iter()
        .take(pieces.len().saturating_sub(1))
        .enumerate()
    {
        if let Some(reason) = source_boundary_issue(source_words, to + 1) {
            blockers.push(format!(
                "source boundary after piece {}/{} is risky ({reason})",
                index + 1,
                pieces.len()
            ));
        }
    }
    let piece_texts: Vec<String> = refs.iter().map(|text| (*text).to_owned()).collect();
    if let Some(reason) = bilingual_anchor_issue_for_ranges(
        source_words,
        &piece_texts,
        &pieces.iter().map(|(_, range)| *range).collect::<Vec<_>>(),
        &item.bilingual_anchors,
    ) {
        blockers.push(reason);
    }
    // Suspected CJK intra-word cut: both sides of the seam between adjacent pieces are ideographic characters, with no punctuation.
    for (index, pair) in refs.windows(2).enumerate() {
        if cjk_midword_boundary(pair[0], pair[1]) {
            blockers.push(format!(
                "boundary between pieces {}/{total} and {}/{total} may cut inside a CJK word",
                index + 1,
                index + 2,
                total = refs.len()
            ));
        }
    }
    // Fit in one round: a piece over fit that has a **free seam** inside it (after cutting, neither side is over fit, neither is a flashing fragment, and no objective blocking-seam lint is triggered) is fixed in this round, not left to refine. It must use the same visual one-line basis as check (exceeds_one_line_fit). The projection replaces hidden commas and full stops with spaces, so a piece with an in-sentence comma that is exactly fit characters long still visually exceeds one line. If it were judged by target_cps_chars here, such pieces would bounce between align and check forever. (The G1 baseline's "unsolvable residue" was actually a measurement mismatch.) The criterion uses free_seam rather than internal_clause_seam. The latter only asks "is there a clause seam", and would demand a seam even when cutting still leaves a piece over fit or leaves a dangling piece, so no worker answer could ever pass. Over-fit pieces with no free seam stay as they are and fall into the translation-unsplittable channel.
    for (index, text) in refs.iter().enumerate() {
        if !exceeds_one_line_fit(text, target_lang, params.fit) {
            continue;
        }
        if let Some((left, right)) = free_seam(text, target_lang, params) {
            blockers.push(format!(
                "piece {}/{} exceeds one display line and has a free seam — cut it into \"{left}\" | \"{right}\"",
                index + 1,
                refs.len()
            ));
        }
    }
    blockers.extend(
        lint_pieces(&refs, target_lang, params)
            .into_iter()
            .filter(|issue| issue.kind == SeamLintKind::Blocking)
            .map(|issue| issue.message),
    );
    let source_units = source_word_units(&item.words, source_lang);
    let source_ends_sec = source_word_ends_sec(&item.words);
    let (source_fit, _) = source_piece_budgets(source_lang);
    let ranges = pieces.iter().map(|(_, range)| *range).collect::<Vec<_>>();
    let target_texts = pieces
        .iter()
        .map(|(text, _)| text.clone())
        .collect::<Vec<_>>();
    if let Some((index, seam)) = paired_density_issue(
        &target_texts,
        &ranges,
        &source_units,
        &source_ends_sec,
        source_fit,
        target_lang,
    ) {
        blockers.push(format!(
            "piece {}/{} maps to an over-dense source row and contains a complete target-language seam near \"{}\" — split there for paired bilingual readability",
            index + 1,
            target_texts.len(),
            seam
        ));
    }
    // Hard tier: the source row exceeds 1.5 times the single-row budget (or 6s), and the target piece itself has no seam. Here it only disqualifies useDraft and hands the piece number to the model. It does not enter engine acceptance rejection: if the model judges there is no legal cut point, keeping the row whole is an answer the contract allows, and rejecting it would only lead to a deterministic fallback, which is worse.
    for issue in source_ceiling_issues(
        &target_texts,
        &ranges,
        &source_units,
        &source_ends_sec,
        source_fit,
        target_lang,
    ) {
        blockers.push(format!(
            "piece {}/{} maps to a source row of {} display units / {:.1}s, past the paired-row ceiling ({} units / {:.1}s) — cut it once at the least-bad target boundary, or keep it whole if no legal boundary exists",
            issue.index + 1,
            target_texts.len(),
            issue.units,
            issue.seconds,
            source_piece_hard(source_fit),
            PAIRED_SOURCE_HARD_SECONDS
        ));
    }
    // Lower bound: a source row narrowed to a fragment of only one or two words. It has the same shape as the hard cap (it only disqualifies useDraft and names the piece number, without entering engine acceptance rejection), and fills the blind spot that the double exemption of source_ceiling_issues leaves. It complements the "single-source-word piece" blocker above rather than duplicating it: that one covers only one word and fewer than 4 units, without looking at translation width, while this one covers at most two words where the translation itself is also short.
    for issue in source_fragment_issues(
        &target_texts,
        &ranges,
        &source_units,
        source_fit,
        target_lang,
    ) {
        blockers.push(format!(
            "piece {}/{} maps to only {} source word(s) / {} display units, under the paired-row floor ({} units) — merge this crumb into the neighbouring piece that continues its clause instead of slicing the source",
            issue.index + 1,
            target_texts.len(),
            issue.words,
            issue.units,
            source_fragment_floor(source_fit)
        ));
    }
    let (worst_source_units, worst_source_seconds) =
        worst_source_row(&ranges, &source_units, &source_ends_sec);
    DraftMarked {
        widths,
        ready: blockers.is_empty(),
        blockers,
        worst_source_units,
        worst_source_seconds,
    }
}

/// The end time of each source word (cumulative seconds relative to the sentence start, rounded to 0.1 s). Returns an empty table when there are no timestamps (all zeros), and serialisation omits it.
fn source_word_ends_sec(words: &[PendingWord]) -> Vec<f64> {
    let start = words.first().map(|word| word.t0).unwrap_or_default();
    let ends: Vec<f64> = words
        .iter()
        .map(|word| ((word.t1 - start) * 10.0).round() / 10.0)
        .collect();
    if ends.iter().all(|end| *end <= 0.0) {
        return Vec::new();
    }
    ends
}

/// Source-word-count dimension for alignment paging. One `Word` in a transcript may still contain CJK run-together text or several Latin tokens, so [`word_count`] is applied per item. `words.len()` is not treated as a cross-language equivalent.
fn align_item_word_count(item: &Pending) -> usize {
    item.words
        .iter()
        .map(|word| word_count(&word.text).max(1))
        .sum()
}

/// Approximate workload of one alignment request. A fixed HTML and inference overhead ensures that "many short sentences" cannot pass as one cheap long sentence. The source and target bodies, suggested piece count, protected terms and bilingual anchors are then added on top by their actual character counts. The value is used only to balance contiguous pages; it is deterministic and independent of the worker count.
fn align_item_complexity_cost(
    item: &Pending,
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
) -> usize {
    let plan = length_plan(item, params, source_lang, target_lang);
    let text = file_source_marked(&item.words).chars().count() + item.translation.chars().count();
    let constraints = item
        .protected_terms
        .iter()
        .map(|term| term.chars().count().saturating_add(24))
        .chain(item.bilingual_anchors.iter().map(|anchor| {
            anchor
                .source
                .chars()
                .count()
                .saturating_add(anchor.target.chars().count())
                .saturating_add(48)
        }))
        .sum::<usize>();
    192_usize
        .saturating_add(text)
        .saturating_add(plan.piece_count.recommended.saturating_mul(96))
        .saturating_add(constraints)
}

/// Alignment paging is constrained by source word count, sentence count and carrier complexity at once. The page count is the maximum of the three, and then the heaviest contiguous page is minimised by complexity cost. So adding workers only consumes pages that already exist, and the same input never gets different paging when the machine's concurrency slots change.
fn align_page_sizes(
    items: &[&Pending<'_>],
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    word_budget: usize,
) -> Vec<usize> {
    if items.is_empty() {
        return Vec::new();
    }
    let word_total = items
        .iter()
        .map(|item| align_item_word_count(item))
        .fold(0_usize, usize::saturating_add);
    let costs = items
        .iter()
        .map(|item| align_item_complexity_cost(item, params, source_lang, target_lang))
        .collect::<Vec<_>>();
    let complexity_total = costs.iter().copied().fold(0_usize, usize::saturating_add);
    let pages = crate::paging::page_count_for_total(word_total, word_budget.max(1))
        .max(items.len().div_ceil(ALIGN_MAX_ITEMS_PER_PAGE))
        .max(complexity_total.div_ceil(ALIGN_PAGE_COMPLEXITY_BUDGET))
        .clamp(1, items.len());
    crate::paging::balanced_page_sizes_for_count(&costs, pages, ALIGN_MAX_ITEMS_PER_PAGE)
}

// ---- Response validation ----

#[derive(Debug, Clone, Deserialize)]
struct PieceJson {
    from: i64,
    to: i64,
    text: String,
}

fn source_segments_from_ranges(ranges: &[(usize, usize)], words: &[PendingWord]) -> Vec<String> {
    ranges
        .iter()
        .map(|&(from, to)| join_word_texts(words[from..=to].iter()))
        .collect()
}

enum HardLimitEnforcement {
    WordRanges {
        source_segments: Vec<String>,
        ranges: Vec<(usize, usize)>,
        target_segments: Vec<String>,
    },
    Independent {
        target_segments: Vec<String>,
    },
}

/// The LLM handles the first-round semantic split. If it still leaves a piece over hard, then within the same response the piece is split deterministically at the target language's natural seams, and all source words are re-anchored by length as far as possible. When there are more target pieces than source words, or when proportional anchoring would cut through a source-bound short phrase, the pieces are displayed independently instead, without fabricating per-piece bilingual correspondence. Hard therefore stays an absolute delivery cap, while crossings and very short source text do not cost an extra LLM repair call.
fn enforce_target_hard_limit(
    target_segments: &[String],
    input: &Pending,
    params: &TransParams,
    target_lang: &str,
) -> Result<Option<HardLimitEnforcement>, String> {
    if target_segments
        .iter()
        .all(|text| crate::split::piece_display_units(text, target_lang) <= params.hard)
    {
        return Ok(None);
    }

    let mut refined = Vec::new();
    for text in target_segments {
        if crate::split::piece_display_units(&text, target_lang) <= params.hard {
            refined.push(text.clone());
            continue;
        }
        refined.extend(split_independent_for_lang_protected(
            &text,
            params,
            usize::MAX,
            target_lang,
            &input.protected_terms,
        ));
    }
    if refined.is_empty()
        || refined
            .iter()
            .any(|text| crate::split::piece_display_units(text, target_lang) > params.hard)
    {
        return Err(format!(
            "{}: target cannot be represented under the absolute hard ceiling {}",
            input.sentence.id, params.hard
        ));
    }

    if refined.len() > input.words.len() {
        return Ok(Some(HardLimitEnforcement::Independent {
            target_segments: refined,
        }));
    }

    let source_words: Vec<&str> = input.words.iter().map(|word| word.text.as_str()).collect();
    let anchored = reanchor_texts(refined.clone(), &source_words, target_lang);
    debug_assert_eq!(anchored.len(), refined.len());
    let ranges: Vec<(usize, usize)> = anchored
        .iter()
        .map(|piece| {
            (
                piece.from.expect("reanchored piece has from"),
                piece.to.expect("reanchored piece has to"),
            )
        })
        .collect();
    let source_segments = source_segments_from_ranges(&ranges, &input.words);
    let unsafe_source_seam = ranges
        .iter()
        .take(ranges.len().saturating_sub(1))
        .enumerate()
        .any(|(index, &(_, to))| {
            source_boundary_issue(&source_words, to + 1).is_some()
                || ends_dangling(&source_segments[index])
        });
    if unsafe_source_seam {
        return Ok(Some(HardLimitEnforcement::Independent {
            target_segments: refined,
        }));
    }
    Ok(Some(HardLimitEnforcement::WordRanges {
        source_segments,
        ranges,
        target_segments: refined,
    }))
}

/// Marker string → segment list: split on `|` / `｜` and trim. Strips ⏸ inside segments (only for the test shim of the legacy json-shape answer).
#[cfg(test)]
fn split_marked(text: &str) -> Vec<String> {
    text.split(['|', '｜'])
        .map(|seg| seg.replace('⏸', " ").trim().to_owned())
        .collect()
}

/// Same-segment check for anchor words. Latin and digit tokens that appear on both the source and target sides (product names, abbreviations, numbers, identifiers) must have a non-empty intersection of their segment-number sets on the two sides. Completely disjoint sets mean the cut point went into a crossing zone, so anchoring is bound to be misaligned (measured on TeachFX / ELD samples).
///
/// Two relaxations of the basis (R2 benchmark §4.4: the crossings at `s-g33.0` `KV`, `s-g96.0` `AI`, and the repeated `token` in `s-g3.0` were all missed by the old basis):
/// 1. A token no longer has to contain Latin letters; pure digits (`2048`, `999`) also count as anchors.
/// 2. It no longer requires each token to appear exactly once on each side. The criterion is whether the segment-number sets are disjoint, so repeated tokens can also be hit.
///
/// It remains an advisory: a hit goes only into advisories, does not block, and does not rewrite the model's self-reported `crossing`. (Setting `crossing` would switch off the blocking check of [`bilingual_anchor_issue_for_ranges`], and automatic setting would permanently suppress real terminology-misalignment rejections.)
fn anchor_token_colocation(
    key: &str,
    source_segments: &[String],
    target_segments: &[String],
) -> Result<(), String> {
    // `.`, `-` and `_` are **internal** characters of a token. Cutting on them would break `0.8` or `v0.3` into `0` / `8`, which are then removed by `len >= 2`, and in configuration-type content such numbers are exactly the most reliable anchors. Leading and trailing hyphens or periods are still stripped (`--speculative-model` → `speculative-model`, and the final period in `tokens.` → `tokens`).
    fn tokens(text: &str) -> Vec<String> {
        text.split(|ch: char| !(ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_')))
            .map(|tok| tok.trim_matches(['.', '-', '_']))
            .filter(|tok| tok.len() >= 2 && tok.chars().any(|ch| ch.is_ascii_alphanumeric()))
            .map(|tok| tok.to_ascii_lowercase())
            .collect()
    }
    use std::collections::BTreeMap;
    let mut src_seen: BTreeMap<String, Vec<usize>> = BTreeMap::new();
    for (index, segment) in source_segments.iter().enumerate() {
        for tok in tokens(segment) {
            src_seen.entry(tok).or_default().push(index);
        }
    }
    let mut tgt_seen: BTreeMap<String, Vec<usize>> = BTreeMap::new();
    for (index, segment) in target_segments.iter().enumerate() {
        for tok in tokens(segment) {
            tgt_seen.entry(tok).or_default().push(index);
        }
    }
    // BTreeMap guarantees a deterministic traversal order, so when the same sentence has several hits, the reported tokens are stable.
    for (tok, src_at) in &src_seen {
        let Some(tgt_at) = tgt_seen.get(tok) else {
            continue;
        };
        if src_at.iter().any(|at| tgt_at.contains(at)) {
            continue;
        }
        return Err(format!(
            "{key}: anchor \"{tok}\" sits in target segment {} but its source word is in segment {} — the cut crosses a reordered region; move the cut or merge so the anchor travels with its source",
            tgt_at[0] + 1,
            src_at[0] + 1
        ));
    }
    Ok(())
}

/// Word-interval entry point for [`anchor_token_colocation`]. It lets `ccut check` recompute the same criterion on a stored `transAlign` (the engine side is advisory, but it is still worth making visible after storage). Sentences with `crossing=true` are skipped by the caller.
pub fn anchor_colocation_issue_for_ranges<W: JoinWord>(
    source_words: &[W],
    target_segments: &[String],
    ranges: &[(usize, usize)],
) -> Option<String> {
    if target_segments.len() != ranges.len() || target_segments.len() < 2 {
        return None;
    }
    if ranges
        .iter()
        .any(|&(from, to)| from > to || to >= source_words.len())
    {
        return None;
    }
    let source_segments = ranges
        .iter()
        .map(|&(from, to)| join_word_texts(&source_words[from..=to]))
        .collect::<Vec<_>>();
    anchor_token_colocation("", &source_segments, target_segments)
        .err()
        .map(|detail| detail.trim_start_matches(": ").to_owned())
}

fn source_anchor_matches(words: &[&str], phrase: &str) -> Vec<(usize, usize)> {
    let phrase_tokens = normalized_source_lexemes(phrase);
    if phrase_tokens.is_empty() {
        return Vec::new();
    }
    let flattened = words
        .iter()
        .enumerate()
        .flat_map(|(word_index, word)| {
            normalized_source_lexemes(word)
                .into_iter()
                .map(move |token| (word_index, token))
        })
        .collect::<Vec<_>>();
    if phrase_tokens.len() > flattened.len() {
        return Vec::new();
    }
    flattened
        .windows(phrase_tokens.len())
        .filter_map(|window| {
            if window
                .iter()
                .map(|(_, token)| token)
                .eq(phrase_tokens.iter())
            {
                Some((window[0].0, window[window.len() - 1].0))
            } else {
                None
            }
        })
        .collect()
}

struct AnchorBinding<'a> {
    anchor: &'a BilingualAnchor,
    source_span: (usize, usize),
    target_piece: usize,
}

/// Collects the anchor bindings whose source word groups and target literal strings each have a unique hit across the whole sentence, and disambiguates overlapping source intervals. Unique as a literal is not unique semantically: "skills" may uniquely match the "Skills" inside "Agent Skills", while the "skill" it actually corresponds to appears elsewhere in the sentence (the false-positive shape measured on skills-video s-g72.16). When they overlap, the longer word group wins and the shorter one abstains. Equal-length overlapping groups with different constraints both abstain and are left for LLM semantic review.
fn unique_anchor_bindings<'a>(
    source_words: &[&str],
    target_segments: &[String],
    anchors: &'a [BilingualAnchor],
) -> Vec<AnchorBinding<'a>> {
    let mut bindings: Vec<AnchorBinding<'a>> = Vec::new();
    for anchor in anchors {
        let source_matches = source_anchor_matches(source_words, &anchor.source);
        if source_matches.len() != 1 {
            continue;
        }
        let target_matches = target_segments
            .iter()
            .enumerate()
            .flat_map(|(index, text)| text.match_indices(&anchor.target).map(move |_| index))
            .collect::<Vec<_>>();
        if target_matches.len() != 1 {
            continue;
        }
        let source_span = source_matches[0];
        let target_piece = target_matches[0];
        // Fully equivalent bindings (same interval, same target piece) are only duplicate entries; keeping one is enough.
        if bindings.iter().any(|existing| {
            existing.source_span == source_span && existing.target_piece == target_piece
        }) {
            continue;
        }
        bindings.push(AnchorBinding {
            anchor,
            source_span,
            target_piece,
        });
    }
    let mut keep = vec![true; bindings.len()];
    for first in 0..bindings.len() {
        for second in first + 1..bindings.len() {
            let a = bindings[first].source_span;
            let b = bindings[second].source_span;
            if a.0 <= b.1 && b.0 <= a.1 {
                let a_len = a.1 - a.0;
                let b_len = b.1 - b.0;
                if a_len > b_len {
                    keep[second] = false;
                } else if b_len > a_len {
                    keep[first] = false;
                } else {
                    keep[first] = false;
                    keep[second] = false;
                }
            }
        }
    }
    let mut kept = keep.into_iter();
    bindings.retain(|_| kept.next().unwrap());
    bindings
}

/// Same-segment check for explicit bilingual glossary anchors. A conclusion is drawn only when the source word group and the target literal string each have a unique hit across the whole sentence. With several occurrences, or overlapping source intervals, the correspondence cannot be determined, so it is left for LLM semantic review, which avoids false positives from the deterministic lint.
pub fn bilingual_anchor_issue_for_ranges(
    source_words: &[&str],
    target_segments: &[String],
    ranges: &[(usize, usize)],
    anchors: &[BilingualAnchor],
) -> Option<String> {
    if target_segments.len() != ranges.len() || target_segments.len() < 2 {
        return None;
    }
    for binding in unique_anchor_bindings(source_words, target_segments, anchors) {
        let (source_from, source_to) = binding.source_span;
        let source_piece = ranges
            .iter()
            .position(|&(from, to)| from <= source_from && source_to <= to);
        let Some(source_piece) = source_piece else {
            return Some(format!(
                "source glossary anchor \"{}\" is split across source segments — keep the complete source term in one paired row",
                binding.anchor.source
            ));
        };
        if source_piece != binding.target_piece {
            return Some(format!(
                "bilingual anchor \"{}\" ↔ \"{}\" is mispaired: target segment {} maps to source segment {} — move the source boundary so both terms share one row",
                binding.anchor.source,
                binding.anchor.target,
                binding.target_piece + 1,
                source_piece + 1,
            ));
        }
    }
    None
}

/// Maps source segments back to word intervals: matches character by character while ignoring whitespace, and segment boundaries must fall exactly on word boundaries.
fn source_segments_to_ranges(
    key: &str,
    segments: &[String],
    words: &[PendingWord],
) -> Result<Vec<(usize, usize)>, String> {
    let mut ranges = Vec::with_capacity(segments.len());
    let mut word_idx = 0usize;
    for (seg_index, segment) in segments.iter().enumerate() {
        let seg_chars: Vec<char> = segment.chars().filter(|ch| !ch.is_whitespace()).collect();
        let start = word_idx;
        let mut pos = 0usize;
        while pos < seg_chars.len() {
            if word_idx >= words.len() {
                return Err(format!(
                    "{key}: source segment {seg_index} continues past the last source word — copy the source verbatim and only insert separators"
                ));
            }
            let word_chars: Vec<char> = words[word_idx]
                .text
                .chars()
                .filter(|ch| !ch.is_whitespace())
                .collect();
            if pos + word_chars.len() > seg_chars.len()
                || seg_chars[pos..pos + word_chars.len()] != word_chars[..]
            {
                return Err(format!(
                    "{key}: source segment {seg_index} does not match the source words verbatim around \"{}\" — copy the source exactly and cut only between words",
                    words[word_idx].text
                ));
            }
            pos += word_chars.len();
            word_idx += 1;
        }
        if word_idx == start {
            return Err(format!("{key}: source segment {seg_index} is empty"));
        }
        ranges.push((start, word_idx - 1));
    }
    if word_idx != words.len() {
        return Err(format!(
            "{key}: source segments cover {word_idx} of {} source words — include every word exactly once",
            words.len()
        ));
    }
    Ok(ranges)
}

/// Shape check on the source side. Dangling articles or modifiers and dangling conjunctions are objective bad seams and must enter the global repair. Length imbalance may come from natural word-order crossing or from translation compression, so it is still recorded only as an advisory.
fn validate_source_shape(
    key: &str,
    source_segments: &[String],
    ranges: &[(usize, usize)],
    words: &[PendingWord],
    source_lang: &str,
    plan: &LengthPlanJson,
) -> Result<Vec<String>, String> {
    let mut advisories = Vec::new();
    let mut blocking = Vec::new();
    let word_refs: Vec<&str> = words.iter().map(|word| word.text.as_str()).collect();
    for (index, &(_, to)) in ranges
        .iter()
        .take(ranges.len().saturating_sub(1))
        .enumerate()
    {
        let boundary = to + 1;
        // A risky boundary that shares its position with a clause seam is allowed. The bound-phrase detection on such a seam is mostly a false positive, and the submission-time lint allows it under the same rule. If the engine rejected it, the answer would be pushed into the aggregated repair batch.
        if let Some(reason) = source_boundary_issue(&word_refs, boundary)
            && (source_boundary_issue_is_blocking(&reason)
                || source_boundary_strength(&word_refs, boundary) == 0)
        {
            blocking.push(format!(
                "source boundary {} is not a complete phrase ({reason}) — keep the bound noun phrase together and move the paired target cut",
                index + 1
            ));
        } else if ends_dangling(&source_segments[index]) {
            blocking.push(format!(
                "source segment {} ends on a dangling connective or function word — move the boundary after its phrase",
                index + 1
            ));
        }
    }
    if !blocking.is_empty() {
        return Err(format!("{key}: {}", blocking.join("; ")));
    }
    if ranges.len() <= 1 {
        return Ok(advisories);
    }
    let units: Vec<usize> = ranges
        .iter()
        .map(|&(from, to)| source_length_units(&words[from..=to], source_lang))
        .collect();
    let max_units = *units.iter().max().expect("non-empty source units");
    let min_units = *units.iter().min().expect("non-empty source units");
    let widest = units
        .iter()
        .position(|units| *units == max_units)
        .expect("non-empty source units");
    let average = plan.source.total.div_ceil(ranges.len().max(1)).max(1);
    let allowed_spread = average.saturating_mul(3).div_ceil(4).max(4);
    if max_units.saturating_sub(min_units) <= allowed_spread {
        return Ok(advisories);
    }
    let (from, to) = ranges[widest];
    let internal = ((from + 1)..=to).find(|&boundary| {
        source_boundary_strength(&word_refs, boundary) >= 2
            && source_boundary_issue(&word_refs, boundary).is_none()
    });
    if let Some(boundary) = internal {
        let shape = units
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join("/");
        advisories.push(format!(
            "source {unit} counts {shape} are uneven; segment {} has a possible seam before \"{}\", but it may reflect target reordering or compressed translation — review against the suggested {:?} range",
            widest + 1,
            words[boundary].text,
            plan.source.preferred_per_piece,
            unit = plan.source.unit,
        ));
    }
    Ok(advisories)
}

/// One answer awaiting acceptance (source segmentation / source word intervals / target pieces). The same sentence may have two of these: the version after the engine's re-split, and the version the worker submitted unchanged.
#[derive(Clone)]
struct CandidateAnswer {
    source_segments: Vec<String>,
    ranges: Vec<(usize, usize)>,
    target_segments: Vec<String>,
    independent: bool,
    forced_hard_split: bool,
}

impl CandidateAnswer {
    /// Whether the re-split actually changed the answer. If it did not, there is no "failure caused by the engine itself", and there is no need to validate the same content twice.
    fn differs_from(&self, other: &Self) -> bool {
        self.independent != other.independent
            || self.target_segments != other.target_segments
            || self.ranges != other.ranges
    }
}

/// Acceptance strictness levels. The three levels differ in only two respects: whether over-hard pieces are tolerated, and whether source-row shape problems block. Every other criterion (concatenation consistency, interval coverage, protected terms, objective seam defects, degenerate paired rows, anchor crossings, density) is the same across all three. Loosening them would decouple the submit lint from engine acceptance.
#[derive(Clone, Copy, PartialEq, Eq)]
enum AcceptanceMode {
    /// Regular acceptance after an engine re-split: over-hard pieces must already have been eliminated.
    Recut,
    /// The re-split was abandoned and the worker's original answer is validated instead. Over-hard pieces may remain (when over_hard is set, the `< 2 pieces` check is waived, the same judgment as the submit-time lint).
    KeepWhole,
    /// Rescue at the fallback: as lenient as `KeepWhole`, and source-row shape problems are demoted to advisories. The rival it competes with is the purely length-based deterministic split of `fallback_word_entry`, which passes no source-shape check at all, so a worker answer that passed the submit lint is strictly better.
    Salvage,
}

impl AcceptanceMode {
    fn allows_over_hard(self) -> bool {
        !matches!(self, Self::Recut)
    }

    fn source_shape_blocks(self) -> bool {
        !matches!(self, Self::Salvage)
    }
}

/// Candidate A: apply to the worker's answer, in order, the hard-cap enforcement, flash-fragment repair, and over-fit repair.
fn build_recut_candidate(
    input: &Pending,
    params: &TransParams,
    target_lang: &str,
    mut source_segments: Vec<String>,
    mut ranges: Vec<(usize, usize)>,
    mut target_segments: Vec<String>,
) -> Result<CandidateAnswer, String> {
    let mut independent = false;
    let forced_hard_split =
        match enforce_target_hard_limit(&target_segments, input, params, target_lang)? {
            Some(HardLimitEnforcement::WordRanges {
                source_segments: refined_source,
                ranges: refined_ranges,
                target_segments: refined_target,
            }) => {
                source_segments = refined_source;
                ranges = refined_ranges;
                target_segments = refined_target;
                true
            }
            Some(HardLimitEnforcement::Independent {
                target_segments: refined_target,
            }) => {
                target_segments = refined_target;
                independent = true;
                true
            }
            None => false,
        };
    // Pre-acceptance repair of flash fragments: a worker-submitted piece of ≤3 characters that can safely merge into a neighbouring piece is merged deterministically at once, keeping text and source interval in sync, on the same basis as repair_lint_pieces on the draft side. Sending it back for another round would waste a round on a mechanical fix. Those that cannot be merged safely still go out as advisories.
    if !independent && target_segments.len() == ranges.len() {
        let repaired = repair_flash_pieces_with_ranges(
            target_segments
                .iter()
                .cloned()
                .zip(ranges.iter().copied())
                .collect(),
            target_lang,
            params,
        );
        if repaired.len() != target_segments.len() {
            ranges = repaired.iter().map(|(_, range)| *range).collect();
            target_segments = repaired.into_iter().map(|(text, _)| text).collect();
            source_segments = source_segments_from_ranges(&ranges, &input.words);
        }
    }
    // Pre-acceptance repair of over-fit pieces: a piece that exceeds one row and has a free seam is cut along that seam. The reasoning is the same as for flash-fragment repair: the cut point and the text on both sides are deterministic, so sending it back for a round would be slow and would compete with other sentences for repair slots.
    if independent {
        target_segments = repair_over_fit_pieces(target_segments, target_lang, params);
    } else if target_segments.len() == ranges.len() {
        let source_refs: Vec<&str> = input.words.iter().map(|word| word.text.as_str()).collect();
        let repaired = repair_over_fit_pieces_with_ranges(
            target_segments
                .iter()
                .cloned()
                .zip(ranges.iter().copied())
                .collect(),
            &source_refs,
            target_lang,
            params,
        );
        if repaired.len() != target_segments.len() {
            ranges = repaired.iter().map(|(_, range)| *range).collect();
            target_segments = repaired.into_iter().map(|(text, _)| text).collect();
            source_segments = source_segments_from_ranges(&ranges, &input.words);
        }
    }
    Ok(CandidateAnswer {
        source_segments,
        ranges,
        target_segments,
        independent,
        forced_hard_split,
    })
}

/// All acceptance criteria for a single candidate answer. Extracted so that one sentence can be evaluated twice (the engine re-split version and the worker's original version) without the failure reasons getting mixed up.
#[allow(clippy::too_many_arguments)]
fn evaluate_candidate(
    key: &str,
    candidate: &CandidateAnswer,
    input: &Pending,
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    reference_translation: &str,
    declared_crossing: bool,
    mode: AcceptanceMode,
    // The worst paired source row `(units, seconds)` of the incumbent draft, taken once by the caller from `deterministic_draft` (same source and value as the payload's `draftWorstSource*`).
    draft_worst_source: (usize, f64),
) -> Result<(Vec<String>, AcceptedAnchor), LlmError> {
    let CandidateAnswer {
        source_segments,
        ranges,
        target_segments,
        independent,
        forced_hard_split,
    } = candidate;
    let (independent, forced_hard_split) = (*independent, *forced_hard_split);
    let over_hard = target_segments
        .iter()
        .any(|text| crate::split::piece_display_units(text, target_lang) > params.hard);
    let keep_over_hard = mode.allows_over_hard() && over_hard;
    // Consistent with the submit-time lint: when over-hard pieces remain, `<2 pieces` is not an error (the piece will either be re-split further, or kept whole under KeepWhole). Only when every piece is ≤ hard is ≥2 pieces required. Under the `Recut` tier, `keep_over_hard` is false, which is equivalent to the old behaviour.
    if target_segments.len() < 2 && !keep_over_hard {
        return Err(LlmError::Malformed(format!(
            "{key}: every requested long sentence must be split into at least two paired segments"
        )));
    }
    let plan = length_plan(input, params, source_lang, target_lang);
    // An answer that contains over-hard pieces is exempt from pieceCount.min (the `all(<= hard)` condition is equivalent to `!over_hard`), the same judgment as the `!over_hard` gate of the submit lint.
    if target_segments.len() < plan.piece_count.min
        && target_segments
            .iter()
            .all(|text| crate::split::piece_display_units(text, target_lang) <= params.hard)
        && target_segments
            .iter()
            .any(|text| crate::split::piece_display_units(text, target_lang) >= params.fit)
    {
        return Err(LlmError::Malformed(format!(
            "{key}: {} target pieces are below pieceCount.min={} while a piece reaches fit {} — add a target-natural cut",
            target_segments.len(),
            plan.piece_count.min,
            params.fit
        )));
    }
    let source_units = source_word_units(&input.words, source_lang);
    let source_ends_sec = source_word_ends_sec(&input.words);
    let (source_fit, _) = source_piece_budgets(source_lang);
    let allowed_list_seams = allowed_balanced_list_seams(
        target_segments,
        ranges,
        &source_units,
        &source_ends_sec,
        source_fit,
    );
    // Note: the source-row hard cap (`source_ceiling_issues`) is deliberately **not** rejected here, to stay consistent with the submit-time lint. The two sites rising and falling together is what keeps the submit lint and engine acceptance from fighting. Reason: the contract allows the model to keep a row whole when there is no legal cut point. Rejecting it here would consume the globally shared, only repair call (GLOBAL_REPAIR_CALLS=1, which other sentences also need), and would end in the deterministic length-based split of `fallback_word_entry` (reanchor_texts, which ignores semantics), which is worse than the model's answer. The hard tier is instead carried by the draft gate (draftBlockers) plus `ccut check` → the `refine-align` targeted round.
    if !independent
        && !forced_hard_split
        && let Some((index, seam)) = paired_density_issue(
            target_segments,
            ranges,
            &source_units,
            &source_ends_sec,
            source_fit,
            target_lang,
        )
    {
        return Err(LlmError::Malformed(format!(
            "{key}: source span paired with target piece {}/{} is over-dense and the target has a complete seam near \"{}\" — split there for paired bilingual readability",
            index + 1,
            target_segments.len(),
            seam
        )));
    }
    // The hard tier itself still does not reject (see above), but **net regression** must be rejected. A targeted repair round that makes the worst over-limit source row worse must not be let through, since that would mean refine-align working in reverse. The order is deliberately placed after the density check, so that existing criteria such as density still give their reasons first. The `Salvage` exemption (same as `source_shape_blocks`): that tier competes only with the purely length-based split of `fallback_word_entry`, and rejecting it here would only widen the exposure of the deterministic fallback.
    if mode.source_shape_blocks()
        && let Some(detail) = source_ceiling_regression(
            &source_ceiling_issues(
                target_segments,
                ranges,
                &source_units,
                &source_ends_sec,
                source_fit,
                target_lang,
            ),
            draft_worst_source.0,
            draft_worst_source.1,
            source_fit,
            target_segments.len(),
        )
    {
        return Err(LlmError::Malformed(format!("{key}: {detail}")));
    }
    if independent {
        return validate_target_texts_with_allowed_list_seams(
            key,
            target_segments,
            reference_translation,
            target_lang,
            params,
            &input.protected_terms,
            &BTreeSet::new(),
            keep_over_hard,
        )
        .map(|mut advisories| {
            advisories.push(format!(
                "target pieces were deterministically split to enforce the absolute hard ceiling {}; there were fewer source words than target pieces, so display timing is independent and semantic row correspondence is intentionally omitted",
                params.hard
            ));
            (advisories, AcceptedAnchor::Independent)
        });
    }
    // Degenerate paired row: a wide translation piece attached to only one or two source words, so word-by-word highlighting falls out of step with the subtitle advancing. Same judgment as the submit lint (the submit lint and engine acceptance must rise and fall together).
    if let Some((piece, words, units)) =
        degenerate_paired_row(target_segments, ranges, &source_units, target_lang)
    {
        return Err(LlmError::Malformed(format!(
            "{key}: piece {piece} maps {units} display characters onto only {words} source word(s) — give it at least {DEGENERATE_MIN_SOURCE_WORDS} source words, or let the neighbouring short phrases share one piece"
        )));
    }
    // When the model has self-reported a crossing, the same-segment anchor check will necessarily warn (the cut point sits in the crossing zone), so it is not output again.
    if !declared_crossing {
        let source_refs = input
            .words
            .iter()
            .map(|word| word.text.as_str())
            .collect::<Vec<_>>();
        if let Some(reason) = bilingual_anchor_issue_for_ranges(
            &source_refs,
            target_segments,
            ranges,
            &input.bilingual_anchors,
        ) {
            return Err(LlmError::Malformed(format!("{key}: {reason}")));
        }
    }
    let anchor_advisory = if declared_crossing {
        None
    } else {
        anchor_token_colocation(key, source_segments, target_segments)
            .err()
            .map(|detail| {
                detail
                    .strip_prefix(&format!("{key}: "))
                    .unwrap_or(&detail)
                    .to_owned()
            })
    };
    let mut source_advisories = match validate_source_shape(
        key,
        source_segments,
        ranges,
        &input.words,
        source_lang,
        &plan,
    ) {
        Ok(advisories) => advisories,
        Err(detail) if mode.source_shape_blocks() => return Err(LlmError::Malformed(detail)),
        Err(detail) => vec![detail],
    };
    source_advisories.extend(anchor_advisory);
    if forced_hard_split {
        source_advisories.push(format!(
            "target pieces were deterministically split to enforce the absolute hard ceiling {}; source ranges were reanchored by length because semantic correspondence is secondary to delivery length",
            params.hard
        ));
    }
    let time_advisories = time_budget_advisories(input, target_segments, ranges, target_lang);
    let pieces: Vec<PieceJson> = target_segments
        .iter()
        .zip(ranges)
        .map(|(text, &(from, to))| PieceJson {
            from: from as i64,
            to: to as i64,
            text: text.clone(),
        })
        .collect();
    validate_pieces_protected_with_allowed_list_seams(
        key,
        &pieces,
        input.words.len(),
        reference_translation,
        target_lang,
        params,
        &input.protected_terms,
        &allowed_list_seams,
        keep_over_hard,
    )
    .map(|mut advisories| {
        advisories.extend(source_advisories);
        advisories.extend(time_advisories);
        (advisories, AcceptedAnchor::WordRanges(ranges.clone()))
    })
}

/// The acceptance output of one batch: `(accepted, salvaged, failed_keys)`. `salvaged` is an answer whose "translation pieces are legal but the source-side mapping does not meet the bar". It replaces the deterministic fallback split only after the repair budget is exhausted.
type BatchVerdict = (
    std::collections::BTreeMap<String, AcceptedPieces>,
    std::collections::BTreeMap<String, AcceptedPieces>,
    Vec<String>,
);

/// Carrier-agnostic intermediate representation of a single-sentence answer.
///
/// This is where the dual validation is merged (file-contract design §2). After [`file_answers_from_parsed`] extracts the answer, **only one** [`accept_answers`] performs acceptance, so there is no second copy of the criteria that could drift.
struct SentenceAnswer {
    key: String,
    /// In-sentence word-order interval: the source column of a table row, obtained through tolerant snapping.
    ranges: Vec<(usize, usize)>,
    /// Target piece.
    target_segments: Vec<String>,
    reordered: bool,
    crossing: bool,
    /// The worker self-reports that the source text "has no legal cut point" (`data-unsplittable`). In this case keeping an over-hard piece whole is the contract being fulfilled, and it is no longer sent back for a targeted supplementary split.
    unsplittable: bool,
    /// Advisories already produced during decoding (word-boundary snapping warnings, etc.).
    advisories: Vec<String>,
}

/// **The only** acceptance core. `pre_failures` are the per-sentence failures already produced during decoding (structure-level diagnostics). They are merged with acceptance failures into a single problems list.
fn accept_answers(
    batch: &[&Pending],
    params: &TransParams,
    source_lang: &str,
    target_lang: &str,
    answers: Vec<SentenceAnswer>,
    pre_failures: Vec<String>,
) -> Result<BatchVerdict, LlmError> {
    let inputs: std::collections::BTreeMap<&str, &&Pending> = batch
        .iter()
        .map(|item| (item.sentence.id.as_str(), item))
        .collect();
    let mut accepted = std::collections::BTreeMap::new();
    let mut salvaged = std::collections::BTreeMap::new();
    let mut failures = pre_failures;
    for answer in answers {
        let SentenceAnswer {
            key,
            ranges,
            target_segments: answer_targets,
            reordered,
            crossing: declared_crossing,
            unsplittable,
            advisories: decode_advisories,
        } = answer;
        let Some(input) = inputs.get(key.as_str()) else {
            // The decoder has already guaranteed that the keys are within the batch. Skip defensively rather than fabricating a failure.
            continue;
        };
        // The trustworthy part of the source column is only "where to cut". Segment text is rebuilt from word truth, and a string the model retyped is never used as an anchor.
        let source_segments = source_segments_from_ranges(&ranges, &input.words);
        let mut target_segments = answer_targets;
        if target_segments.len() != source_segments.len() {
            failures.push(format!(
                "{key}: source has {} segments but target has {} — separators must pair up",
                source_segments.len(),
                target_segments.len()
            ));
            continue;
        }
        if let Some(frozen) = input.frozen_target.as_ref() {
            if reordered {
                failures.push(format!(
                    "{key}: data-target-frozen forbids reordered=true — keep the validated target pieces exactly and change only source boundaries"
                ));
                continue;
            }
            if target_segments != *frozen {
                failures.push(format!(
                    "{key}: target pieces must equal data-target-frozen exactly — change only source boundaries"
                ));
                continue;
            }
        }
        // Reorder acceptance: the worker has its own language ability, so it may reorder the clauses of the translation to remove crossings, provided the meaning does not change. Character-by-character reconciliation does not work for reordering, so two deterministic guardrails are used instead. The first runs each piece through the target-language formatter (same character-stream basis as `trans`). The second is a length band: reordering should only adjust word order and necessary connectives or particles, so reading units should not drift much. Excessive drift is rejected as a rewrite, which prevents content being quietly compressed or dropped. After it passes, the sentence-level translation truth is written back.
        let revised_target = if reordered {
            target_segments = target_segments
                .iter()
                .map(|segment| {
                    format_translation_with_options(
                        segment,
                        target_lang,
                        &input.protected_terms,
                        AutocorrectOptions::default(),
                    )
                })
                .collect();
            let new_text = join_word_texts(target_segments.iter().map(String::as_str));
            let old_units = target_cps_chars(&input.translation, target_lang);
            let new_units = target_cps_chars(&new_text, target_lang);
            // Shares the same guardrail arithmetic as `filepipe::align_table::check_rows` (the design §2 rule that validation exists in only one place; this guardrail used to be three character-for-character copies).
            if reordered_rewrite_exceeds(old_units, new_units) {
                failures.push(format!(
                    "{key}: reordered target rewrites too much ({old_units} → {new_units} reading units) — reorder clauses without adding, dropping, or compressing content, or use crossing instead"
                ));
                continue;
            }
            Some(new_text)
        } else {
            None
        };
        let reference_translation = revised_target
            .clone()
            .unwrap_or_else(|| input.translation.clone());
        // Two candidates: A is the engine's re-split (hard-cap enforcement → flash-fragment repair → over-fit repair), B is the worker's original answer. The re-split is a one-sided rewrite by the engine, and failures it introduces itself (anchors, seams, density) should not be charged to the worker. (Scene: the worker submitted 3 pieces, the engine re-split them into 4, and then sent them back for "segment 4 anchor misaligned", a problem pointing at a piece the worker never submitted.) If A fails acceptance and the re-split really changed the answer, B is validated instead. If B passes, the over-hard piece is kept whole. This is the engine side of the contract's "if there is no legal cut point, keep the row whole". The piece is then exposed by the `translation-unsplittable` / `align-source-ceiling` channels of `ccut check`, rather than burning the single global repair call to land on a worse mechanical split. The incumbent baseline is computed once and reuses `deterministic_draft` directly, so the engine and the submit-time lint get the same number, with no room for two independently computed copies to drift.
        let draft_worst_source = {
            let draft = deterministic_draft(input, params, source_lang, target_lang);
            (draft.worst_source_units, draft.worst_source_seconds)
        };
        let recut = build_recut_candidate(
            input,
            params,
            target_lang,
            source_segments.clone(),
            ranges.clone(),
            target_segments.clone(),
        );
        let original = CandidateAnswer {
            source_segments,
            ranges,
            target_segments,
            independent: false,
            forced_hard_split: false,
        };
        let recut_changed = match &recut {
            Ok(candidate) => candidate.differs_from(&original),
            Err(_) => true,
        };
        let mut outcome: Option<(CandidateAnswer, Vec<String>, AcceptedAnchor)> = None;
        let mut failure_detail: Option<String> = None;
        let mut via_keep_whole = false;
        match recut {
            Ok(candidate) => match evaluate_candidate(
                &key,
                &candidate,
                input,
                params,
                source_lang,
                target_lang,
                &reference_translation,
                declared_crossing,
                AcceptanceMode::Recut,
                draft_worst_source,
            ) {
                Ok((advisories, anchor)) => outcome = Some((candidate, advisories, anchor)),
                Err(LlmError::Malformed(detail)) => failure_detail = Some(detail),
                Err(error) => return Err(error),
            },
            Err(detail) => failure_detail = Some(detail),
        }
        if outcome.is_none()
            && recut_changed
            && let Ok((mut advisories, anchor)) = evaluate_candidate(
                &key,
                &original,
                input,
                params,
                source_lang,
                target_lang,
                &reference_translation,
                declared_crossing,
                AcceptanceMode::KeepWhole,
                draft_worst_source,
            )
        {
            advisories.push(format!(
                "the deterministic re-split under the absolute hard ceiling {} was abandoned because it broke paired readability; the submitted segmentation was kept as-is and any over-ceiling piece stays whole — `ccut check` reports it as an alignment defect",
                params.hard
            ));
            outcome = Some((original.clone(), advisories, anchor));
            failure_detail = None;
            via_keep_whole = true;
        }
        let Some((candidate, mut advisories, anchor)) = outcome else {
            // Neither candidate passed acceptance. Try once more with the most lenient `Salvage` tier. If it passes, store it in `salvaged`, to stand in for the purely length-based split of `fallback_word_entry` once the repair budget is exhausted. Reordered answers are not rescued: rescue would mean skipping the consistency premise of the `trans` write-back path, so it is better to take the deterministic fallback.
            if revised_target.is_none()
                && let Ok((mut salvage_advisories, salvage_anchor)) = evaluate_candidate(
                    &key,
                    &original,
                    input,
                    params,
                    source_lang,
                    target_lang,
                    &reference_translation,
                    declared_crossing,
                    AcceptanceMode::Salvage,
                    draft_worst_source,
                )
            {
                salvage_advisories.extend(decode_advisories.iter().cloned());
                salvage_advisories.push(
                    "kept the submitted segmentation instead of the deterministic target split: it failed acceptance but is structurally sound and strictly better than a length-only re-split — `ccut check` reports the remaining defect"
                        .to_owned(),
                );
                let salvage_crossing =
                    declared_crossing && matches!(salvage_anchor, AcceptedAnchor::WordRanges(_));
                salvaged.insert(
                    key.clone(),
                    AcceptedPieces {
                        texts: original.target_segments,
                        anchor: salvage_anchor,
                        crossing: salvage_crossing,
                        revised_target: None,
                        advisories: salvage_advisories,
                    },
                );
            }
            failures.push(
                failure_detail
                    .unwrap_or_else(|| format!("{key}: alignment answer failed validation")),
            );
            continue;
        };
        let crossing = declared_crossing && matches!(anchor, AcceptedAnchor::WordRanges(_));
        // Decoding-stage advisories (the file-v1 word-boundary snapping and the data-unsplittable self-report) go through the same channel as acceptance advisories, and both end up in `AlignOutcome.violations`.
        advisories.extend(decode_advisories);
        // If an answer accepted under KeepWhole still contains over-hard pieces, the defect was not caused by the engine. The worker's pieces were over the limit to begin with, and the engine could not find a legal re-split. Following "accept first, then targeted supplement", it is not stored on the spot. Instead it goes into `salvaged` (used as-is when the repair budget runs out, so the result is no worse than direct acceptance), and only **this one sentence**, with targeted instructions, is sent into the repair round so the worker can move its own cut points. Answers the worker has already self-reported as data-unsplittable, or that were reordered and written back, are not sent back. The former is the contract being fulfilled. Rescuing the latter would mean skipping the consistency premise of the `trans` write-back.
        if via_keep_whole && revised_target.is_none() && !unsplittable {
            let over_hard: Vec<(usize, usize)> = candidate
                .target_segments
                .iter()
                .enumerate()
                .filter_map(|(index, text)| {
                    let units = crate::split::piece_display_units(text, target_lang);
                    (units > params.hard).then_some((index + 1, units))
                })
                .collect();
            if let Some(&(segment, units)) = over_hard.first() {
                advisories.push(
                    "kept as salvage: the over-ceiling piece was sent back once for a targeted re-segmentation; this answer lands unchanged only if the repair round does not do better"
                        .to_owned(),
                );
                salvaged.insert(
                    key.clone(),
                    AcceptedPieces {
                        texts: candidate.target_segments,
                        anchor,
                        crossing,
                        revised_target: None,
                        advisories,
                    },
                );
                failures.push(format!(
                    "{key}: target segment {segment} is {units} display units — over the absolute hard ceiling {} and the engine found no legal re-split; move a boundary so every target segment stays within {} display units, or declare data-unsplittable=\"true\" if the source truly has no legal cut ({} more over-ceiling segment(s) in this answer)",
                    params.hard,
                    params.hard,
                    over_hard.len() - 1
                ));
                continue;
            }
        }
        if revised_target.is_some() {
            advisories.push(
                "target reordered to follow the source clause order — verify no meaning shifted"
                    .to_owned(),
            );
        }
        accepted.insert(
            key,
            AcceptedPieces {
                texts: candidate.target_segments,
                anchor,
                crossing,
                revised_target,
                advisories,
            },
        );
    }
    for item in batch {
        if !accepted.contains_key(&item.sentence.id)
            && !failures
                .iter()
                .any(|detail| detail.contains(&item.sentence.id))
        {
            failures.push(format!("Alignment missing sentence: {}", item.sentence.id));
        }
    }
    Ok((accepted, salvaged, failures))
}

/// Deterministic validation (§9.2 plus the v0.3 hard cap). Only structural invariants such as coverage, empty pieces, intervals and the hard ceiling trigger retries. Seam quality and balance problems return advisories, so that no extra LLM call is spent on subjective stylistic preferences.
///
/// `allow_over_hard`: true only when the engine has abandoned its own re-split and is validating the worker's original answer. At that point "over hard must be re-split" has been shown to produce a worse result, and the contract permits keeping the piece whole. That piece is then exposed by the over-limit channel of `ccut check`. On the regular path it is always false.
#[allow(clippy::too_many_arguments)]
fn validate_target_texts_with_allowed_list_seams(
    key: &str,
    texts: &[String],
    translation: &str,
    lang: &str,
    params: &TransParams,
    protected_terms: &[String],
    allowed_list_seams: &BTreeSet<usize>,
    allow_over_hard: bool,
) -> Result<Vec<String>, LlmError> {
    if texts.is_empty() {
        return Err(LlmError::Malformed(format!(
            "{key}: pieces must not be empty"
        )));
    }
    for (index, text) in texts.iter().enumerate() {
        // Piece index is 1-based (same basis as the seam lint and validate_source_shape).
        let ordinal = index + 1;
        let total = texts.len();
        if text.trim().is_empty() {
            return Err(LlmError::Malformed(format!(
                "{key}: piece {ordinal}/{total} has empty text"
            )));
        }
        let chars = crate::split::piece_display_units(text, lang);
        if chars > params.hard && !allow_over_hard {
            return Err(LlmError::Malformed(format!(
                "{key}: piece {ordinal}/{total} has {chars} characters, over the absolute hard ceiling {} — cut it further",
                params.hard
            )));
        }
    }
    let concatenated: String = texts.iter().map(String::as_str).collect();
    if normalize_chars(&concatenated) != normalize_chars(translation) {
        return Err(LlmError::Malformed(format!(
            "{key}: concatenated piece texts do not equal the full translation"
        )));
    }
    if let Some(term) = split_protected_term(texts, protected_terms) {
        return Err(LlmError::Malformed(format!(
            "{key}: target boundary splits protected glossary term \"{term}\" — keep it in one piece"
        )));
    }
    let text_refs: Vec<&str> = texts.iter().map(String::as_str).collect();
    let lint = lint_pieces(&text_refs, lang, params);
    // Dangling tails and clinging heads are objective defects (“split off to |”, “similar to | …”). The G3 baseline measured that weak workers reliably produce them and that they get stored, so they are upgraded to a send-back, with the concrete piece text in the problems. Flashing fragments, aim-band and balance remain hints only, because trade-offs in length often have no objective unique solution.
    let allowed_balanced_list = |issue: &&crate::seam::SeamLintIssue| {
        issue.class == SeamLintClass::ListSeparator
            && allowed_list_seams.contains(&issue.piece_index)
    };
    if let Some(issue) = lint
        .iter()
        .find(|issue| is_objective_blocking(issue) && !allowed_balanced_list(issue))
    {
        return Err(LlmError::Malformed(format!(
            "{key}: {} (piece text: \"{}\") — move the boundary so the bound phrase stays whole",
            issue.message, texts[issue.piece_index]
        )));
    }
    let mut advisories: Vec<String> = lint
        .iter()
        .filter(|issue| !allowed_balanced_list(issue))
        .map(|issue| issue.message.clone())
        .collect();
    if text_refs.len() > 1 {
        let widths: Vec<usize> = text_refs
            .iter()
            .map(|text| crate::split::piece_display_units(text, lang))
            .collect();
        let max_w = *widths.iter().max().expect("non-empty pieces");
        let min_w = *widths.iter().min().expect("non-empty pieces");
        if max_w.saturating_sub(min_w) > BALANCE_SPREAD {
            let widest = widths
                .iter()
                .position(|width| *width == max_w)
                .expect("non-empty pieces");
            if let Some(seam) = internal_clause_seam(text_refs[widest], lang) {
                let shape = widths
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join("/");
                advisories.push(format!(
                    "{key}: piece widths {shape} are uneven — consider cutting piece {widest} after \"{seam}\" (or moving a boundary) when semantics allow"
                ));
            }
        }
    }
    Ok(advisories)
}

/// Per-piece time-budget advisory (non-blocking). Display scheduling can shift time within a sentence (smoothing), so it is not hard-capped against each piece's speech window. It hints only on two actionable signals: the reading requirement of the whole sentence exceeds the sentence's time window (solvable only by reducing the piece count or compressing the translation, since the more pieces, the more the 1-second display minimum accumulates), and a piece whose shortfall is large enough that the surplus of adjacent pieces can fill it (solvable by moving a boundary; the typical shape of a short source with a long translation).
fn time_budget_advisories(
    item: &Pending,
    texts: &[String],
    ranges: &[(usize, usize)],
    target_lang: &str,
) -> Vec<String> {
    let mut advisories = Vec::new();
    if texts.len() != ranges.len() || texts.len() < 2 {
        return advisories;
    }
    let required: Vec<f64> = texts
        .iter()
        .map(|text| target_required_seconds(text, target_lang))
        .collect();
    let spans: Vec<f64> = ranges
        .iter()
        .map(|&(from, to)| words_dwell_seconds(&item.words[from..=to]))
        .collect();
    let available = words_dwell_seconds(&item.words);
    if available <= f64::EPSILON {
        return advisories; // Without usable time information (such as a synthetic word table), no time judgment is made.
    }
    let total_required: f64 = required.iter().sum();
    if total_required > available + 0.25 {
        advisories.push(format!(
            "pieces need {total_required:.1}s of reading time but the sentence speech lasts {available:.1}s — fewer pieces (each has a ~1s display floor) or a tighter translation would fit better"
        ));
        return advisories; // Under global overload, per-piece hints are just noise.
    }
    for index in 0..required.len() {
        let deficit = required[index] - spans[index];
        if deficit <= TIME_DEFICIT_SECONDS {
            continue;
        }
        let previous_surplus = index
            .checked_sub(1)
            .map(|prev| spans[prev] - required[prev])
            .unwrap_or(0.0);
        let next_surplus = (index + 1 < required.len())
            .then(|| spans[index + 1] - required[index + 1])
            .unwrap_or(0.0);
        if previous_surplus.max(next_surplus) >= deficit {
            let side = if next_surplus > previous_surplus {
                "next"
            } else {
                "previous"
            };
            advisories.push(format!(
                "piece {}/{} (\"{}\") needs {:.1}s to read but its speech span is {:.1}s — move the cut to give it words from the {side} piece",
                index + 1,
                required.len(),
                texts[index],
                required[index],
                spans[index],
            ));
        }
    }
    advisories
}

#[cfg(test)]
fn validate_pieces(
    key: &str,
    pieces: &[PieceJson],
    word_count: usize,
    translation: &str,
    lang: &str,
    params: &TransParams,
) -> Result<Vec<String>, LlmError> {
    validate_pieces_protected(key, pieces, word_count, translation, lang, params, &[])
}

#[cfg(test)]
fn validate_pieces_protected(
    key: &str,
    pieces: &[PieceJson],
    word_count: usize,
    translation: &str,
    lang: &str,
    params: &TransParams,
    protected_terms: &[String],
) -> Result<Vec<String>, LlmError> {
    validate_pieces_protected_with_allowed_list_seams(
        key,
        pieces,
        word_count,
        translation,
        lang,
        params,
        protected_terms,
        &BTreeSet::new(),
        false,
    )
}

#[allow(clippy::too_many_arguments)]
fn validate_pieces_protected_with_allowed_list_seams(
    key: &str,
    pieces: &[PieceJson],
    word_count: usize,
    translation: &str,
    lang: &str,
    params: &TransParams,
    protected_terms: &[String],
    allowed_list_seams: &BTreeSet<usize>,
    allow_over_hard: bool,
) -> Result<Vec<String>, LlmError> {
    if pieces.is_empty() {
        return Err(LlmError::Malformed(format!(
            "{key}: pieces must not be empty"
        )));
    }
    let mut expected_from = 0_i64;
    for (index, piece) in pieces.iter().enumerate() {
        let ordinal = index + 1;
        let total = pieces.len();
        if piece.from != expected_from {
            return Err(LlmError::Malformed(format!(
                "{key}: piece ranges must be contiguous from 0 — piece {ordinal}/{total} starts at {}, expected {expected_from}",
                piece.from
            )));
        }
        if piece.to < piece.from || piece.to >= word_count as i64 {
            return Err(LlmError::Malformed(format!(
                "{key}: piece {ordinal}/{total} range {}..{} is invalid for {word_count} words",
                piece.from, piece.to
            )));
        }
        expected_from = piece.to + 1;
    }
    if expected_from != word_count as i64 {
        return Err(LlmError::Malformed(format!(
            "{key}: piece ranges cover words 0..{expected_from} but the sentence has {word_count} words"
        )));
    }
    let texts: Vec<String> = pieces.iter().map(|piece| piece.text.clone()).collect();
    validate_target_texts_with_allowed_list_seams(
        key,
        &texts,
        translation,
        lang,
        params,
        protected_terms,
        allowed_list_seams,
        allow_over_hard,
    )
}

fn split_protected_term(texts: &[String], protected_terms: &[String]) -> Option<String> {
    if texts.len() < 2 || protected_terms.is_empty() {
        return None;
    }
    let joined = texts.concat();
    let boundaries = texts
        .iter()
        .take(texts.len() - 1)
        .scan(0usize, |cursor, text| {
            *cursor += text.len();
            Some(*cursor)
        })
        .collect::<Vec<_>>();
    protected_terms.iter().find_map(|term| {
        joined.match_indices(term).find_map(|(start, matched)| {
            let end = start + matched.len();
            boundaries
                .iter()
                .any(|boundary| start < *boundary && *boundary < end)
                .then(|| term.clone())
        })
    })
}

// ---- agent submit lint ----------------------------------------------------

/// Submission-time semantic lint for file-v1 align responses (§10.3).
///
/// It shares **one copy** of the string-level validation with the engine's provider path: both only call [`parse_align_table`]. The criteria (id reconciliation, truncation, source drift, the concatenation invariant, the hard cap, objective bad seams, the ±25% magnitude check on reordered text) all live in filepipe. Here the diagnostics are only formatted as human-readable text. This is how the design §2 rule "validation exists in only one place" holds structurally on file-v1; there is no second copy that could drift.
///
/// Criteria that need the `words[]` truth (source word-interval mapping, paired density, degenerate and fragment rows, bilingual anchors, source-row non-regression) stay inside the engine closure. The submitting process has no `TranscriptDoc`, so recomputation is impossible, and copying an approximation would create a second standard.
///
/// If the payload cannot be read (an old task directory, or a different kind), return empty: do not block answers the engine can accept.
pub fn lint_agent_answer_file(payload: &str, answer: &str) -> Vec<String> {
    let Some(table) = parse_align_table_input(payload) else {
        return Vec::new();
    };
    let parsed = parse_align_table(&table, Some(payload), answer);
    format_lint_problems(&parsed.diagnostics.problems)
}

/// `align-edges/1` submission-time lint. It shares with the engine the single string-level validation in [`parse_align_edges`] (ordinal legality, duplicates across blocks, the span concatenation invariant, truncation and missing sentences). The block merging and DP that need the `words[]` truth stay in the engine. If the payload cannot be read, return empty (do not block).
pub fn lint_agent_answer_edges(payload: &str, answer: &str) -> Vec<String> {
    let Some(table) = parse_align_edges_input(payload) else {
        return Vec::new();
    };
    let parsed = parse_align_edges(&table, Some(payload), answer);
    format_lint_problems(&parsed.diagnostics.problems)
}

/// `align-rewrite/1` submission-time lint. The same parser is used (the table's `data-ccut-format` decides the rewrite mode, along with the magnitude guardrail and the hard-anchor retention check).
pub fn lint_agent_answer_rewrite(payload: &str, answer: &str) -> Vec<String> {
    lint_agent_answer_edges(payload, answer)
}

fn format_lint_problems(problems: &[crate::filepipe::Problem]) -> Vec<String> {
    problems
        .iter()
        .map(|problem| match &problem.scope {
            ProblemScope::Sentence { id } => {
                format!("[{}] {id}: {}", problem.code, problem.detail)
            }
            _ => format!("[{}] {}", problem.code, problem.detail),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cue::CueParams;
    use crate::split::align_entry_valid;

    #[test]
    fn paired_budget_survives_the_payload_roundtrip_and_conflicts_fail_early() {
        let mut table = AlignTableInput {
            lang: "zh".into(),
            params: TransParams::for_lang("zh"),
            source_lang: String::new(),
            context_before: vec![],
            context_after: vec![],
            sentences: vec![AlignSentenceInput::new(
                "s1",
                "one two three four",
                "第一部分第二部分",
            )],
        };
        let requirements = BTreeMap::from([(
            "s1".into(),
            PairedRequirement {
                source_rows: 8,
                target_units: 48,
                required: 8,
            },
        )]);
        prepare_table_constraints(&mut table, &requirements).unwrap();
        let decoded =
            crate::filepipe::align_table::parse_align_table_input(&render_align_table(&table))
                .unwrap();
        assert_eq!(decoded.sentences[0].suggested_pieces, (8, 8));
        assert!(decoded.sentences[0].no_rewrite);
        table.sentences[0].frozen_target = vec!["第一部分".into(), "第二部分".into()];
        assert!(matches!(
            prepare_table_constraints(&mut table, &requirements),
            Err(LlmError::Terminal(_))
        ));
    }

    #[test]
    fn problem_mentions_id_requires_token_boundaries() {
        assert!(problem_mentions_id(
            "s-g6.18: piece 2/3 is over hard",
            "s-g6.18"
        ));
        assert!(problem_mentions_id(
            "Alignment missing sentence: s-g61.11",
            "s-g61.11"
        ));
        // IDs that are prefixes of one another must not be matched by mistake.
        assert!(!problem_mentions_id(
            "s-g6.18: piece 2/3 is over hard",
            "s-g6.1"
        ));
        assert!(!problem_mentions_id("s-g61.11: must be split", "s-g61.1"));
        assert!(!problem_mentions_id(
            "the answer carries no sentences",
            "s-g6.18"
        ));
    }

    /// The contract file is shared per `(kind, attempt)`. The system prompt must be determined solely by task-level input, byte-for-byte identical across the first round and repair rounds, and the protected-terms section must not disappear depending on batch composition.
    #[test]
    fn align_file_contract_is_stable_across_rounds() {
        let params = TransParams::for_lang("zh-Hans");
        let table = AlignTableInput {
            lang: "zh-Hans".to_owned(),
            params: params.clone(),
            source_lang: "en".to_owned(),
            context_before: Vec::new(),
            sentences: vec![AlignSentenceInput {
                id: "s-1".to_owned(),
                source: "hello world again".to_owned(),
                translation: "你好，世界，再一次。".to_owned(),
                max_lines: 2,
                suggested_pieces: (2, 3),
                unsplittable: false,
                frozen_target: Vec::new(),
                no_rewrite: false,
            }],
            context_after: Vec::new(),
        };
        let terms = vec!["PagedAttention".to_owned()];
        let first = align_request_file(&table, &params, "en", None, &terms, None);
        let repair = align_request_file(
            &table,
            &params,
            "en",
            None,
            &terms,
            Some("Repair only the remaining 1 sentences.".to_owned()),
        );
        assert!(first.system.contains("Protected target terms"));
        assert!(first.system.contains("PagedAttention"));
        assert_eq!(first.system, repair.system);
    }

    #[test]
    fn repair_reason_notes_problems_omitted_from_this_carrier() {
        let params = TransParams::for_lang("zh-Hans");
        let reason = repair_reason_file(
            &[],
            &params,
            "en",
            "zh-Hans",
            &["s-1: piece 1/2 ends on a dangling connective".to_owned()],
            2,
        );
        assert!(reason.contains("s-1: piece 1/2"));
        assert!(reason.contains(
            "(2 further problem(s) from the previous round concern sentences repaired in parallel calls and are not in this table.)"
        ));
    }
    use crate::doc::{BreakOverride, DocEngine, DocMedia, Speaker, Word};
    use crate::engines::translate::{TranslateOptions, run_translate};
    use crate::llm::FakeLlm;
    use crate::split::derive_trans_cues;

    fn doc_with_words(words: Vec<Word>) -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 1000.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        doc.speakers.insert(
            "s1".to_owned(),
            Speaker {
                name: "S1".to_owned(),
                hue: None,
            },
        );
        doc.words = words;
        doc
    }

    fn w(id: &str, t0: f64, t1: f64, text: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    fn row_repair_doc() -> TranscriptDoc {
        let mut doc = doc_with_words(
            (0..9)
                .map(|index| {
                    w(
                        &format!("g1.{index}"),
                        index as f64,
                        index as f64 + 1.0,
                        if index == 8 { "nine." } else { "word" },
                    )
                })
                .collect(),
        );
        doc.breaks.insert("g1.2".to_owned(), BreakOverride::Break);
        doc.breaks.insert("g1.5".to_owned(), BreakOverride::Break);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), "短译文".to_owned());
        doc
    }

    fn row_repair_inputs(doc: &TranscriptDoc) -> (Vec<Cue>, Vec<Sentence>, Vec<TransCue>) {
        let cues = derive_cues(doc, &crate::layout_profile::cue_params_for_doc(doc));
        let sentences = derive_sentences(doc, &cues);
        let trans = derive_trans_cues(doc, &sentences, "zh");
        (cues, sentences, trans)
    }

    #[test]
    fn source_run_merge_matches_product_mirrors() {
        let ranges = |lengths: &[usize]| {
            let mut cursor = 0usize;
            lengths
                .iter()
                .map(|length| {
                    let range = cursor..cursor + length;
                    cursor += length;
                    range
                })
                .collect::<Vec<_>>()
        };
        let lengths = |runs: Vec<std::ops::Range<usize>>| {
            runs.into_iter().map(|run| run.len()).collect::<Vec<_>>()
        };
        assert_eq!(lengths(merge_short_runs(ranges(&[2, 5]), 3)), [7]);
        assert_eq!(lengths(merge_short_runs(ranges(&[5, 2]), 3)), [7]);
        assert_eq!(lengths(merge_short_runs(ranges(&[1, 4, 3]), 3)), [5, 3]);
        assert_eq!(lengths(merge_short_runs(ranges(&[5, 1, 3]), 3)), [5, 4]);
        assert_eq!(lengths(merge_short_runs(ranges(&[3, 1, 5]), 3)), [4, 5]);
        assert_eq!(lengths(merge_short_runs(ranges(&[3, 1, 3]), 3)), [4, 3]);
        assert_eq!(lengths(merge_short_runs(ranges(&[1, 1, 1, 4]), 3)), [3, 4]);
        assert_eq!(lengths(merge_short_runs(ranges(&[2, 2, 2]), 3)), [6]);
    }

    #[test]
    fn row_deficit_f1_missing_entry_is_reported_by_dwell() {
        let doc = row_repair_doc();
        let (cues, sentences, trans) = row_repair_inputs(&doc);
        let issues = row_deficit_issues(&doc, &sentences, "zh", &cues, &trans);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].source_rows, 3);
        assert_eq!(issues[0].trans_cues, 1);
        assert_eq!(issues[0].reason, RowDeficitReason::Dwell);
    }

    #[test]
    fn row_deficit_f2_sentence_level_is_reported_with_three_source_rows() {
        let mut doc = row_repair_doc();
        // Keep the whole row below the dwell threshold so the sentence-level arm is exercised.
        for (index, word) in doc.words.iter_mut().enumerate() {
            word.t0 = index as f64 * 0.4;
            word.t1 = word.t0 + 0.4;
        }
        let ids = doc.words.iter().map(|word| word.id.clone()).collect();
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            ids,
            vec![TransPiece {
                from: Some(0),
                to: Some(8),
                text: "短译文".to_owned(),
            }],
        );
        entry.correspondence = Some(Correspondence::Sentence);
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), entry);
        let (cues, sentences, trans) = row_repair_inputs(&doc);
        let issues = row_deficit_issues(&doc, &sentences, "zh", &cues, &trans);
        assert_eq!(issues[0].reason, RowDeficitReason::SentenceLevel);
    }

    #[test]
    fn row_deficit_f3_sparse_valid_pieces_are_reported() {
        let mut doc = row_repair_doc();
        let ids = doc.words.iter().map(|word| word.id.clone()).collect();
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            TransAlign::new(
                AlignMode::ManyToOne,
                ids,
                vec![
                    TransPiece {
                        from: Some(0),
                        to: Some(5),
                        text: "短".to_owned(),
                    },
                    TransPiece {
                        from: Some(6),
                        to: Some(8),
                        text: "译文".to_owned(),
                    },
                ],
            ),
        );
        let (cues, sentences, trans) = row_repair_inputs(&doc);
        let issues = row_deficit_issues(&doc, &sentences, "zh", &cues, &trans);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].trans_cues, 2);
    }

    #[test]
    fn row_deficit_f4_stale_fallback_is_exclusive() {
        let mut doc = row_repair_doc();
        doc.trans.get_mut("zh").unwrap().insert(
            "s-g1.0".to_owned(),
            "这是一条明显超过单行容量并且必须重新对齐的长译文。".to_owned(),
        );
        let ids = doc.words.iter().map(|word| word.id.clone()).collect();
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            TransAlign::new(
                AlignMode::ManyToOne,
                ids,
                vec![TransPiece {
                    from: Some(0),
                    to: Some(7),
                    text: "失效".to_owned(),
                }],
            ),
        );
        let (cues, sentences, trans) = row_repair_inputs(&doc);
        assert!(trans.iter().any(|cue| cue.fallback));
        assert!(row_deficit_issues(&doc, &sentences, "zh", &cues, &trans).is_empty());
    }

    #[test]
    fn row_deficit_f5_independent_without_anchors_is_not_reported() {
        let mut doc = row_repair_doc();
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            TransAlign::new(
                AlignMode::Independent,
                Vec::new(),
                vec![
                    TransPiece {
                        from: None,
                        to: None,
                        text: "短".to_owned(),
                    },
                    TransPiece {
                        from: None,
                        to: None,
                        text: "译文".to_owned(),
                    },
                ],
            ),
        );
        let (cues, sentences, trans) = row_repair_inputs(&doc);
        assert!(row_deficit_issues(&doc, &sentences, "zh", &cues, &trans).is_empty());
    }

    #[test]
    fn legal_many_to_one_below_dwell_threshold_is_not_reported() {
        let mut doc = row_repair_doc();
        for (index, word) in doc.words.iter_mut().enumerate() {
            word.t0 = index as f64 * 0.35;
            word.t1 = word.t0 + 0.35;
        }
        let (cues, sentences, trans) = row_repair_inputs(&doc);
        assert!(row_deficit_issues(&doc, &sentences, "zh", &cues, &trans).is_empty());
    }

    #[test]
    fn paired_minimum_clamps_short_translation_to_two_pieces() {
        assert_eq!(paired_min_piece_count(3, 6), 2);
        assert_eq!(paired_min_piece_count(3, 20), 3);
    }

    #[test]
    fn row_deficit_skips_sentences_whose_translation_is_blank() {
        for text in ["", "   ", "\n\t "] {
            let mut doc = row_repair_doc();
            doc.trans
                .get_mut("zh")
                .expect("zh")
                .insert("s-g1.0".to_owned(), text.to_owned());
            let (cues, sentences, trans) = row_repair_inputs(&doc);
            // The criterion uses the same basis as "empty translation — skipped" on the align side: an empty translation produces neither a statistics row nor a sticking report.
            assert!(row_deficit_stats(&doc, &sentences, "zh", &cues, &trans).is_empty());
            assert!(row_deficit_issues(&doc, &sentences, "zh", &cues, &trans).is_empty());
        }
    }

    /// Counters for the four-count `rowRepair` of a mixed round, and the basis for rolling counters back.
    ///
    /// A call that returns only an empty table sends every sentence to the deterministic fallback (`fallback_sentences`). So which counter a rejected sentence should roll back must be decided per sentence. An early version unconditionally did `aligned_sentences -= rejected`, which, when `aligned_sentences == 0`, would subtract another sentence's count and leave the counts inconsistent.
    struct EmptyTableLlm {
        calls: usize,
    }

    impl LlmJson for EmptyTableLlm {
        fn complete(&mut self, _request: &LlmRequest) -> Result<String, LlmError> {
            self.calls += 1;
            Ok("<table>\n</table>\n".to_owned())
        }
    }

    fn short_translation_doc() -> TranscriptDoc {
        let mut doc = two_sentence_doc();
        let table = doc.trans.entry("zh".to_owned()).or_default();
        // Sentence 1: two source rows (broken at `echo,`) plus a short translation ⇒ minimum piece count 2, but the fallback gives only 1 piece ⇒ rejected. Sentence 2: a single source row ⇒ minimum piece count 1 ⇒ accepted.
        table.insert("s-g1.0".to_owned(), "短译文。".to_owned());
        table.insert("s-g2.0".to_owned(), "完成。".to_owned());
        doc
    }

    fn paired_counter_options(density_sentences: &[&str]) -> AlignOptions {
        let mut options = opts(AlignMode::ManyToOne);
        options.density = AlignDensity::Paired;
        options.density_sentences = density_sentences
            .iter()
            .map(|id| (*id).to_owned())
            .collect();
        options.sentences = Some(
            density_sentences
                .iter()
                .map(|id| (*id).to_owned())
                .collect(),
        );
        options.repair_calls = 0;
        options
    }

    /// The slow version of [`short_translation_doc`]: sentence 1's 8 words are stretched to 6.4s, so as a whole-sentence single piece it would hit the dwell predicate of `align-row-deficit` (≥5s and covering 2 source rows).
    fn slow_short_translation_doc() -> TranscriptDoc {
        let mut doc = short_translation_doc();
        for word in &mut doc.words {
            word.t0 *= 2.0;
            word.t1 *= 2.0;
        }
        doc
    }

    #[test]
    fn row_repair_counts_candidates_repaired_rejected_and_capped_in_one_round() {
        let mut doc = slow_short_translation_doc();
        // The third key does not exist in the document either, and lies outside this round's `sentences` ⇒ recorded as capped.
        let mut options = paired_counter_options(&["s-g1.0", "s-g2.0"]);
        options.density_sentences.insert("s-g9.9".to_owned());
        let mut llm = EmptyTableLlm { calls: 0 };
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();

        assert_eq!(outcome.row_repair.candidates, 2);
        assert_eq!(outcome.row_repair.repaired, 1);
        assert_eq!(outcome.row_repair.rejected, 1);
        assert_eq!(outcome.row_repair.capped, 1);
        // A rejected sentence rolls back its own `fallback_sentences`, not someone else's `aligned_sentences`.
        assert_eq!(outcome.aligned_sentences, 0);
        assert_eq!(outcome.fallback_sentences, 1);
        // Rejected sentences keep their original state (they had no entry to begin with). Accepted sentences are stored.
        assert_eq!(
            doc.trans_align["zh"].keys().collect::<Vec<_>>(),
            vec!["s-g2.0"]
        );
        assert!(
            outcome.violations.iter().any(|line| line
                .starts_with("s-g1.0: paired row repair rejected")
                && line.contains("stuck row(s)")),
            "{:?}",
            outcome.violations
        );
        // Itemised detail. Looking only at "1 candidate → 1 rejected" cannot tell whether acceptance was overly strict or the sentence simply does not have that many words to cut. The metrics must be output together with the rejection.
        assert_eq!(outcome.row_repair.rejections_truncated, 0);
        assert_eq!(outcome.row_repair.rejections.len(), 1);
        let rejection = &outcome.row_repair.rejections[0];
        assert_eq!(rejection.sentence, "s-g1.0");
        assert_eq!(rejection.reason, "not-improved");
        assert_eq!(rejection.source_rows, 2);
        assert_eq!(rejection.required, 2);
        assert_eq!(rejection.delivered, 1);
        assert!(rejection.target_units > 0, "{rejection:?}");
        assert_eq!(
            rejection.units_per_row,
            (rejection.target_units as f64 / 2.0 * 100.0).round() / 100.0
        );
    }

    #[test]
    fn row_repair_counters_are_all_zero_on_an_auto_round() {
        let mut doc = short_translation_doc();
        let mut options = opts(AlignMode::ManyToOne);
        // Even if an auto round carries sticking keys (refine's old behaviour), `capped` must always be 0.
        options.density_sentences = ["s-g1.0", "s-g2.0", "s-g9.9"]
            .into_iter()
            .map(str::to_owned)
            .collect();
        options.repair_calls = 0;
        let mut llm = EmptyTableLlm { calls: 0 };
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert_eq!(outcome.row_repair, RowRepairOutcome::default());
        assert_eq!(outcome.row_repair.capped, 0);
        // Two short translations under auto do not need entries.
        assert_eq!(llm.calls, 0);
    }

    /// After paired acceptance, any `transDisplay` entry this sentence left from the previous round must be cleared along with it. The new entry uses `trans` as its basis, so the old display text would become an orphan that nothing refers to.
    #[test]
    fn accepted_paired_repair_clears_the_stale_trans_display_entry() {
        let mut doc = short_translation_doc();
        doc.trans_display
            .entry("zh".to_owned())
            .or_default()
            .insert(
                "s-g2.0".to_owned(),
                TransDisplay {
                    text: "旧的显示改写。".to_owned(),
                    basis: MONOTONIC_REWRITE_BASIS.to_owned(),
                    trans_fingerprint: String::new(),
                },
            );
        let options = paired_counter_options(&["s-g2.0"]);
        let mut llm = EmptyTableLlm { calls: 0 };
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert_eq!(outcome.row_repair.repaired, 1);
        assert!(
            doc.trans_display.get("zh").is_none(),
            "{:?}",
            doc.trans_display
        );
    }

    /// Sentence 1 = two Cues (q-g1.0 / q-g1.5); sentence 2 = a single Cue (q-g2.0).
    fn two_sentence_doc() -> TranscriptDoc {
        doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha"),
            w("g1.1", 0.4, 0.8, "bravo"),
            w("g1.2", 0.8, 1.2, "charlie"),
            w("g1.3", 1.2, 1.6, "delta"),
            w("g1.4", 1.6, 2.0, "echo,"),
            w("g1.5", 2.0, 2.4, "foxtrot"),
            w("g1.6", 2.4, 2.8, "golf"),
            w("g1.7", 2.8, 3.2, "hotel."),
            w("g2.0", 3.4, 3.8, "Done."),
        ])
    }

    fn with_translations(mut doc: TranscriptDoc) -> TranscriptDoc {
        let table = doc.trans.entry("zh".to_owned()).or_default();
        table.insert(
            "s-g1.0".to_owned(),
            "第一段译文需要自然对应，第二段译文负责完整收尾。".to_owned(),
        );
        table.insert("s-g2.0".to_owned(), "完成。".to_owned());
        doc
    }

    fn talk_alignment_doc(sentence_count: usize) -> TranscriptDoc {
        let mut words = Vec::new();
        for sentence in 0..sentence_count {
            let base = sentence as f64 * 10.0;
            for (word, text) in [
                "This", "source", "sentence", "contains", "enough", "spoken", "words", "to",
                "become", "one", "complete", "semantic", "subtitle", "unit", "for", "testing.",
            ]
            .into_iter()
            .enumerate()
            {
                let mut token = w(
                    &format!("g{sentence}.{word}"),
                    base + word as f64 * 0.4,
                    base + (word + 1) as f64 * 0.4,
                    text,
                );
                if sentence % 2 == 1 {
                    token.sp = "s2".to_owned();
                }
                words.push(token);
            }
        }
        let mut doc = doc_with_words(words);
        doc.speakers.insert(
            "s2".to_owned(),
            Speaker {
                name: "S2".to_owned(),
                hue: None,
            },
        );
        let cues = derive_cues(&doc, &CueParams::default());
        let derived = derive_sentences(&doc, &cues);
        assert_eq!(derived.len(), sentence_count);
        let table = doc.trans.entry("zh".to_owned()).or_default();
        for sentence in &derived {
            table.insert(
                sentence.id.clone(),
                "这是一条需要自然切分的字幕，后半部分也保持完整。".to_owned(),
            );
        }
        doc
    }

    fn opts(mode: AlignMode) -> AlignOptions {
        AlignOptions {
            lang: "zh".to_owned(),
            mode,
            params: None,
            sentences: None,
            targeted: false,
            force: false,
            instructions: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            worker_slots: None,
            page_budget: crate::paging::budgets::ALIGN_PROVIDER_WORDS,
            repair_calls: GLOBAL_REPAIR_CALLS,
            // Existing table-protocol tests use the review carrier; block-alignment-edges tests use [`opts_edges`].
            carrier: AlignCarrier::Table,
            ..AlignOptions::default()
        }
    }

    fn opts_edges(mode: AlignMode) -> AlignOptions {
        AlignOptions {
            carrier: AlignCarrier::Edges,
            ..opts(mode)
        }
    }

    /// Test-side shim: translates a legacy json-shaped answer script into carrier-agnostic [`SentenceAnswer`]s, then feeds them into the single acceptance core [`accept_answers`].
    fn validate_batch_partial(
        batch: &[&Pending],
        params: &TransParams,
        source_lang: &str,
        target_lang: &str,
        raw: &str,
    ) -> Result<BatchVerdict, LlmError> {
        let value: serde_json::Value =
            serde_json::from_str(raw).map_err(|error| LlmError::Malformed(error.to_string()))?;
        let inputs: std::collections::BTreeMap<&str, &&Pending> = batch
            .iter()
            .map(|item| (item.sentence.id.as_str(), item))
            .collect();
        let mut answers = Vec::new();
        for sentence in value["sentences"].as_array().into_iter().flatten() {
            let key = sentence["key"]
                .as_str()
                .expect("test answer key")
                .to_owned();
            let input = inputs
                .get(key.as_str())
                .unwrap_or_else(|| panic!("unknown test key {key}"));
            let reordered = sentence["reordered"].as_bool().unwrap_or(false);
            let crossing = sentence["crossing"].as_bool().unwrap_or(false) && !reordered;
            let breaks: Vec<&str> = sentence["sourceBreaks"]
                .as_array()
                .expect("test answers use sourceBreaks")
                .iter()
                .map(|id| id.as_str().expect("break id"))
                .collect();
            let ranges = test_breaks_to_ranges(&breaks, input.words.len());
            answers.push(SentenceAnswer {
                key,
                ranges,
                target_segments: split_marked(sentence["target"].as_str().unwrap_or_default()),
                reordered,
                crossing,
                unsplittable: sentence["unsplittable"].as_bool().unwrap_or(false),
                advisories: Vec::new(),
            });
        }
        accept_answers(batch, params, source_lang, target_lang, answers, Vec::new())
    }

    fn test_breaks_to_ranges(breaks: &[&str], word_count: usize) -> Vec<(usize, usize)> {
        let mut ranges = Vec::with_capacity(breaks.len() + 1);
        let mut from = 0usize;
        for id in breaks {
            let boundary: usize = id.strip_prefix('b').expect("bN id").parse().expect("bN id");
            assert!(
                boundary > from && boundary < word_count,
                "bad test break {id}"
            );
            ranges.push((from, boundary - 1));
            from = boundary;
        }
        ranges.push((from, word_count - 1));
        ranges
    }

    /// Static version identical to [`good_align_table`], for use by `FakeLlm::ok`.
    const GOOD_ALIGN_RESPONSE: &str = "<table>\n  <tbody data-sid=\"s-g1.0\">\n    <tr><td class=\"src\">alpha bravo charlie delta echo,</td><td class=\"tgt\">第一段译文需要自然对应，</td></tr>\n    <tr><td class=\"src\">foxtrot golf hotel.</td><td class=\"tgt\">第二段译文负责完整收尾。</td></tr>\n  </tbody>\n</table>\n";

    struct DraftReviewLlm {
        calls: usize,
        fail_first: bool,
        request_item_counts: Vec<usize>,
    }

    impl LlmJson for DraftReviewLlm {
        fn complete(&mut self, request: &LlmRequest) -> Result<String, LlmError> {
            let call = self.calls;
            self.calls += 1;
            if self.fail_first && call == 0 {
                return Ok("<table>\n</table>\n".to_owned());
            }
            let input = parse_align_table_input(&request.user).expect("align table input");
            self.request_item_counts.push(input.sentences.len());
            let groups: Vec<String> = input
                .sentences
                .iter()
                .map(|sentence| {
                    tgroup(
                        &sentence.id,
                        "",
                        &[
                            (
                                "This source sentence contains enough spoken words",
                                "这是一条需要自然切分的字幕，",
                            ),
                            (
                                "to become one complete semantic subtitle unit for testing.",
                                "后半部分也保持完整。",
                            ),
                        ],
                    )
                })
                .collect();
            Ok(ttable(&groups))
        }
    }

    #[test]
    fn single_cue_sentence_needs_no_entry_and_no_llm() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = FakeLlm::ok([GOOD_ALIGN_RESPONSE]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        // Sentence 2: a single Cue, zero entries; sentence 1 goes to the LLM.
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.skipped_sentences, 1);
        assert!(!doc.trans_align["zh"].contains_key("s-g2.0"));
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        assert!(entry.cues.is_empty());
        assert_eq!(entry.pieces.len(), 2);
        assert_eq!(entry.pieces[0].text, "第一段译文需要自然对应，");
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.words.first().map(String::as_str), Some("g1.0"));
        assert_eq!(entry.words.last().map(String::as_str), Some("g1.7"));

        let (kind, system, user, _) = &llm.calls[0];
        assert_eq!(kind, "align");
        assert!(system.contains("expert bilingual subtitle segmenter"));
        assert!(system.contains('⏸'));
        assert!(!user.contains("s-g2.0"));

        // Idempotent: running again makes zero calls and zero changes.
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert!(llm.calls.is_empty());
        assert_eq!(outcome.aligned_sentences, 0);
        assert_eq!(outcome.skipped_sentences, 2);
    }

    /// The source row is over-long but the translation fits on one row. Displaying the whole sentence is also a paired row, so it must be queued for LLM splitting. Sentences in the same doc whose source rows are compliant still get zero entries and are skipped (a negative assertion, to prevent a flood of false positives).
    fn one_line_translation_doc() -> TranscriptDoc {
        let long = [
            "Everyone",
            "working",
            "alongside",
            "the",
            "platform",
            "engineering",
            "group",
            "always",
            "retains",
            "their",
            "entirely",
            "separate",
            "working",
            "context.",
        ];
        let short = ["Nothing", "else", "really", "happens", "right", "here."];
        let mut words = Vec::new();
        for (index, text) in long.iter().enumerate() {
            words.push(w(
                &format!("g1.{index}"),
                index as f64 * 0.3,
                (index + 1) as f64 * 0.3,
                text,
            ));
        }
        for (index, text) in short.iter().enumerate() {
            words.push(w(
                &format!("g2.{index}"),
                6.0 + index as f64 * 0.3,
                6.0 + (index + 1) as f64 * 0.3,
                text,
            ));
        }
        let mut doc = doc_with_words(words);
        let table = doc.trans.entry("zh".to_owned()).or_default();
        // Both translations are ≤ fit (16) and ≥ PAIRED_TARGET_MIN_UNITS (10). The target-side pre-filter of the hard tier lets both sentences through equally, so the only difference is the source-row width.
        table.insert("s-g1.0".to_owned(), "他们保留上下文，互不干扰。".to_owned());
        table.insert("s-g2.0".to_owned(), "这里不会再发生别的事。".to_owned());
        doc
    }

    #[test]
    fn overlong_source_row_enters_the_llm_even_when_the_translation_fits_one_line() {
        let mut doc = one_line_translation_doc();
        let mut llm = file_llm([ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                (
                    "Everyone working alongside the platform engineering group",
                    "他们保留上下文，",
                ),
                (
                    "always retains their entirely separate working context.",
                    "互不干扰。",
                ),
            ],
        )])]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        // A source row of 100 reading units exceeds source_piece_hard (42) = 63, so it is no longer skipped by no_entry_needed and must appear in the LLM payload.
        assert_eq!(llm.calls.len(), 1, "{:?}", llm.calls);
        let user = &llm.calls[0].2;
        assert!(user.contains("data-sid=\"s-g1.0\""), "{user}");
        // The reverse: short sentences whose source rows are compliant still get zero entries and take the skipped branch.
        assert!(!user.contains("s-g2.0"), "{user}");
        assert!(!doc.trans_align["zh"].contains_key("s-g2.0"));
        assert_eq!(outcome.skipped_sentences, 1);
    }

    #[test]
    fn whole_sentence_ceiling_predicate_ignores_compliant_source_rows() {
        let doc = one_line_translation_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let issue_for = |sentence: &Sentence| {
            let words = sentence
                .word_indices
                .iter()
                .map(|&index| &doc.words[index])
                .collect::<Vec<_>>();
            whole_sentence_source_ceiling_issue(
                &words,
                &doc.trans["zh"][&sentence.id],
                &doc.lang,
                "zh",
            )
        };
        let long = issue_for(&sentences[0]).expect("over-long source line must hit the hard tier");
        assert_eq!(long.index, 0);
        assert_eq!(long.words, 14);
        assert!(long.units > 63, "{long:?}");
        assert!(
            issue_for(&sentences[1]).is_none(),
            "a sentence with a compliant source line must not produce hard-tier diagnostics"
        );
    }

    #[test]
    fn align_only_formats_existing_translation_before_deriving_pieces() {
        let mut doc = two_sentence_doc();
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), "在Claude Code中使用,很好.".to_owned());
        let mut options = opts(AlignMode::ManyToOne);
        options.sentences = Some(BTreeSet::from(["s-g1.0".to_owned()]));
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());

        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();

        assert!(llm.calls.is_empty());
        assert_eq!(outcome.skipped_sentences, 1);
        assert_eq!(doc.trans["zh"]["s-g1.0"], "在 Claude Code 中使用，很好。");
        assert!(!doc.trans_align.contains_key("zh"));
    }

    #[test]
    fn draft_ready_treats_soft_length_plan_as_advisory() {
        let source = "Maybe use an AI tool, or become AI-native.";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        let sentence = Sentence {
            id: "s-soft-plan".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: format!("{}，{}。", "甲".repeat(17), "乙".repeat(13)),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let draft = deterministic_draft(&pending, &params, "en", "zh");

        assert!(draft.widths.len() >= 2, "{:?}", draft.widths);
        assert!(draft.widths.iter().all(|width| *width <= params.hard));
        assert!(
            draft.widths.iter().any(|width| *width > params.fit),
            "the fixture must exercise a soft-only length miss: {:?}",
            draft.widths
        );
        assert!(
            draft.ready,
            "soft length guidance must not force a rewrite: {:?}",
            draft.blockers
        );
    }

    #[test]
    fn time_budget_advisories_flag_dense_rows_and_movable_boundaries() {
        let source =
            "becomes useful because it emphasizes there is still engineering happening now";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        let sentence = Sentence {
            id: "s-time".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        // The first two words are spoken within 0.8s (a short source piece), and the remaining words fill about 4.5s.
        let timed_words = |scale: f64| -> Vec<PendingWord> {
            source_words
                .iter()
                .enumerate()
                .map(|(index, text)| {
                    let (t0, t1) = if index < 2 {
                        (index as f64 * 0.4, (index + 1) as f64 * 0.4)
                    } else {
                        (
                            0.8 + (index - 2) as f64 * 0.5,
                            0.8 + (index - 1) as f64 * 0.5,
                        )
                    };
                    PendingWord {
                        text: (*text).to_owned(),
                        pause_before: 0,
                        t0: t0 * scale,
                        t1: t1 * scale,
                        glue: false,
                    }
                })
                .collect()
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: timed_words(1.0),
            translation: String::new(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let texts = vec![
            "这个说法之所以真的非常之有用而且重要，".to_owned(),
            "是因为它强调了工程仍然存在。".to_owned(),
        ];
        let ranges = vec![(0usize, 1usize), (2usize, source_words.len() - 1)];

        // The shape of Figure 2: a short source piece paired with a long translation piece, and adjacent pieces have surplus ⇒ hint to move the boundary.
        let advisories = time_budget_advisories(&pending, &texts, &ranges, "zh");
        assert_eq!(advisories.len(), 1, "{advisories:?}");
        assert!(advisories[0].contains("move the cut"), "{advisories:?}");
        assert!(advisories[0].contains("next"), "{advisories:?}");

        // The whole sentence is too dense (window compressed to 1/4): only a sentence-level hint to reduce pieces or compress is reported, not a per-piece flood.
        let dense = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: timed_words(0.25),
            translation: String::new(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let advisories = time_budget_advisories(&dense, &texts, &ranges, "zh");
        assert_eq!(advisories.len(), 1, "{advisories:?}");
        assert!(advisories[0].contains("fewer pieces"), "{advisories:?}");

        // No time information (all zeros), so no time judgment.
        let untimed = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: String::new(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        assert!(time_budget_advisories(&untimed, &texts, &ranges, "zh").is_empty());
    }

    #[test]
    fn draft_ready_rejects_cjk_midword_and_seam_bearing_overfit_pieces() {
        // Intra-word cut: both sides of the seam are ideographic characters, with no punctuation.
        assert!(cjk_midword_boundary(
            "而在于欧拉如何把这个问题简",
            "化成了简单概念。"
        ));
        assert!(!cjk_midword_boundary(
            "采用新的编程工具，",
            "或被告知转型。"
        ));
        assert!(!cjk_midword_boundary(
            "可以把 Claude Code",
            "为我之前的研究"
        ));

        // Fit in one round: a piece over fit with a clause seam inside ⇒ ready=false; the LLM fixes it in this round.
        let source_words: Vec<&str> =
            "Euler agreed but the key point is not that this was impossible at all here"
                .split_whitespace()
                .collect();
        let sentence = Sentence {
            id: "s-fit-seam".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source_words.join(" "),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: "欧拉也认同这一点，但关键不仅在于这不可能，而在于问题的简化方式。"
                .to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let pieces = vec![
            (
                "欧拉也认同这一点，但关键不仅在于这不可能，".to_owned(),
                (0usize, 10usize),
            ),
            ("而在于问题的简化方式。".to_owned(), (11usize, 14usize)),
        ];
        let words_ref: Vec<&str> = source_words.clone();
        let draft = draft_from_pieces(&pending, pieces, &params, "en", "zh", &words_ref);
        assert!(draft.widths[0] > params.fit, "{:?}", draft.widths);
        assert!(
            !draft.ready,
            "an over-fit piece with an internal clause seam must force revision"
        );

        // Measurement basis: a piece that is exactly fit reading characters but contains an in-sentence comma becomes visually over one line once the comma turns into a space in the projection. It must be judged fixable on the same basis as check (the root cause of the G1 "unsolvable residue").
        let visual_pieces = vec![
            (
                "也许你可以从这里出发，试着这样过桥，".to_owned(),
                (0usize, 10usize),
            ),
            ("而在于问题的简化方式。".to_owned(), (11usize, 14usize)),
        ];
        let draft = draft_from_pieces(&pending, visual_pieces, &params, "en", "zh", &words_ref);
        assert_eq!(
            draft.widths[0], params.fit,
            "fixture must sit exactly at fit"
        );
        assert!(
            !draft.ready,
            "a visually over-fit piece with an internal seam must force revision"
        );
    }

    #[test]
    fn draft_ready_rejects_single_source_unit_fragments() {
        let source_words = ["out,", "release,", "other."];
        let sentence = Sentence {
            id: "s-single-unit".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source_words.join(" "),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: "这是一段需要分成多个自然展示片并且不能留下孤立源词的中文译文。"
                .to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let draft = deterministic_draft(&pending, &TransParams::for_lang("zh"), "en", "zh");

        // Three source words cut into two or more pieces must produce a single-word source row, so ready has to block it.
        assert!(!draft.ready);
        // When not ready there must be a reason for each item, and it must enter the payload's draftBlockers (p850 second-round measurement: without a reason, the worker can only re-transcribe the whole sentence explicitly). The component this fixture actually triggers is intra-word cut (the single-source-word piece was not triggered because of the anchor fallback), so the assertion only requires the reason to be non-empty.
        assert!(!draft.blockers.is_empty());
    }

    #[test]
    fn talk_length_alignment_keeps_a_bounded_call_budget() {
        let sentence_count = 127usize;
        let mut doc = talk_alignment_doc(sentence_count);
        let mut llm = DraftReviewLlm {
            calls: 0,
            fail_first: true,
            request_item_counts: Vec::new(),
        };
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        // This fixture's total source is far below the word budget, but 127 complex alignment items split steadily into 5 first-round pages under the 40-items-per-page and complexity budgets. Only the first failing page enters the single repair round.
        assert_eq!(llm.calls, 6);
        assert_eq!(outcome.aligned_sentences, sentence_count);
        assert_eq!(outcome.fallback_sentences, 0);
        assert_eq!(doc.trans_align["zh"].len(), sentence_count);
    }

    #[test]
    fn global_repair_round_uses_the_same_word_budget() {
        let sentence_count = 127usize;
        let mut doc = talk_alignment_doc(sentence_count);
        let mut llm = DraftReviewLlm {
            calls: 0,
            fail_first: true,
            request_item_counts: Vec::new(),
        };
        run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        // request_item_counts does not record the first batch (it was returned early by fail_first). The other four first-round pages plus one repair page still obey the same 40-item cap. The totals of accepted and repair pages exactly cover all 127 sentences, proving the failure set was not resent for the whole document.
        assert_eq!(llm.request_item_counts.len(), 5);
        assert_eq!(
            llm.request_item_counts.iter().sum::<usize>(),
            sentence_count
        );
        assert!(
            llm.request_item_counts
                .iter()
                .all(|count| *count <= ALIGN_MAX_ITEMS_PER_PAGE)
        );
    }

    #[test]
    fn zero_repair_budget_does_not_dispatch_a_hidden_second_call() {
        let mut doc = talk_alignment_doc(1);
        let mut options = opts(AlignMode::ManyToOne);
        options.repair_calls = 0;
        let mut llm = DraftReviewLlm {
            calls: 0,
            fail_first: true,
            request_item_counts: Vec::new(),
        };
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert_eq!(llm.calls, 1);
        assert_eq!(outcome.fallback_sentences, 1);
        assert_eq!(doc.trans_align["zh"].len(), 1);
    }

    #[test]
    fn targeted_alignment_uses_the_same_word_budget() {
        let sentence_count = 9usize;
        let mut doc = talk_alignment_doc(sentence_count);
        let sentence_ids = derive_sentences(&doc, &derive_cues(&doc, &CueParams::default()))
            .into_iter()
            .map(|sentence| sentence.id)
            .collect();
        let mut options = opts(AlignMode::ManyToOne);
        options.sentences = Some(sentence_ids);
        options.targeted = true;
        let mut llm = DraftReviewLlm {
            calls: 0,
            fail_first: false,
            request_item_counts: Vec::new(),
        };

        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();

        assert_eq!(llm.calls, 1);
        assert_eq!(llm.request_item_counts, vec![sentence_count]);
        assert_eq!(outcome.aligned_sentences, sentence_count);
        assert_eq!(outcome.fallback_sentences, 0);
    }

    #[test]
    fn one_to_one_is_rejected_as_legacy_source_cue_mode() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let error =
            run_align(&mut doc, &mut llm, &opts(AlignMode::OneToOne), &mut |_| {}).unwrap_err();
        assert!(llm.calls.is_empty());
        assert!(error.to_string().contains("legacy source-Cue"));
        assert!(doc.trans_align.is_empty());
    }

    #[test]
    fn long_dwell_sentence_uses_llm_even_when_target_fits() {
        // The translation fits on one row, but the whole-sentence time window of 8s exceeds the dwell guardrail. A single subtitle would stay pinned on screen, so it must still be queued for splitting. (The source width alone no longer triggers splitting, because many-to-one is the default shape.)
        let mut words = Vec::new();
        for index in 0..16 {
            words.push(w(
                &format!("g1.{index}"),
                index as f64 * 0.5,
                (index + 1) as f64 * 0.5,
                if index == 15 { "ending." } else { "word" },
            ));
        }
        let mut doc = doc_with_words(words);
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            "这是第一部分，也是第二部分。".to_owned(),
        );
        let response = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                ("word word word word word word word word", "这是第一部分，"),
                (
                    "word word word word word word word ending.",
                    "也是第二部分。",
                ),
            ],
        )]);
        let mut llm = file_llm([response]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.local_sentences, 0);
        assert_eq!(outcome.fallback_sentences, 0);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        assert_eq!(entry.words.first().map(String::as_str), Some("g1.0"));
        assert_eq!(entry.words.last().map(String::as_str), Some("g1.15"));
        assert_eq!(entry.pieces.first().unwrap().from, Some(0));
        assert_eq!(entry.pieces.last().unwrap().to, Some(15));
        assert_eq!(entry.pieces.len(), 2);
        assert_eq!(entry.pieces[0].text, "这是第一部分，");
        assert_eq!(entry.pieces[1].text, "也是第二部分。");
        // The model did not self-report a crossing ⇒ crossing stays false.
        assert!(!entry.crossing);
    }

    #[test]
    fn declared_crossing_keeps_worker_rows_best_effort() {
        let mut words = Vec::new();
        for index in 0..16 {
            words.push(w(
                &format!("g1.{index}"),
                index as f64 * 0.5,
                (index + 1) as f64 * 0.5,
                if index == 15 { "ending." } else { "word" },
            ));
        }
        let mut doc = doc_with_words(words);
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            "这是第一部分，也是第二部分。".to_owned(),
        );
        let response = ttable(&[tgroup(
            "s-g1.0",
            " data-crossing=\"true\"",
            &[
                ("word word word word word word word word", "这是第一部分，"),
                (
                    "word word word word word word word ending.",
                    "也是第二部分。",
                ),
            ],
        )]);
        let mut llm = file_llm([response]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        assert_eq!(outcome.aligned_sentences, 1);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        // The legacy `crossing` field is read-only. A crossing self-reported by the model is accepted on a best-effort basis: keep the worker's two rows and source cut points, and do not degrade to one whole-sentence piece (block-alignment design §4.5 revision).
        assert!(!entry.crossing, "crossing is a legacy read-only field");
        assert_ne!(entry.correspondence(), Correspondence::Sentence);
        assert_eq!(entry.aligner.as_deref(), Some(TABLE_ALIGNER_TAG));
        let texts: Vec<&str> = entry
            .pieces
            .iter()
            .map(|piece| piece.text.as_str())
            .collect();
        assert_eq!(texts, ["这是第一部分，", "也是第二部分。"]);
        assert_eq!(
            entry
                .pieces
                .iter()
                .map(|piece| (piece.from, piece.to))
                .collect::<Vec<_>>(),
            [(Some(0), Some(7)), (Some(8), Some(15))]
        );
        assert!(
            outcome
                .violations
                .iter()
                .any(|violation| violation.contains("declared word-order crossing")),
            "{:?}",
            outcome.violations
        );
        // A best-effort entry is a legal word-anchored entry.
        assert!(
            crate::split::align_entry_valid(
                &doc,
                &derive_sentences(&doc, &derive_cues(&doc, &CueParams::default()))[0],
                &doc.trans["zh"]["s-g1.0"],
                entry
            ),
            "best-effort crossing entry stays valid"
        );
    }

    #[test]
    fn reordered_target_is_accepted_and_written_to_trans_display() {
        // The original translation's word order crosses the source (the second half is fronted). The worker has its own language ability, so it reorders the translation directly to remove the crossing. After validation the result is written to `transDisplay`, and the natural translation `trans` is untouched.
        let mut words = Vec::new();
        for index in 0..16 {
            words.push(w(
                &format!("g1.{index}"),
                index as f64 * 0.5,
                (index + 1) as f64 * 0.5,
                if index == 15 { "ending." } else { "word" },
            ));
        }
        let mut doc = doc_with_words(words);
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            "也是第二部分，这是第一部分。".to_owned(),
        );
        let response = ttable(&[tgroup(
            "s-g1.0",
            " data-reordered=\"true\"",
            &[
                ("word word word word word word word word", "这是第一部分，"),
                (
                    "word word word word word word word ending.",
                    "也是第二部分。",
                ),
            ],
        )]);
        let mut llm = file_llm([response]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 0);
        // The natural translation truth is untouched. The reordered result goes into `transDisplay` (block-alignment design §6.2).
        assert_eq!(doc.trans["zh"]["s-g1.0"], "也是第二部分，这是第一部分。");
        let display = &doc.trans_display["zh"]["s-g1.0"];
        assert_eq!(display.text, "这是第一部分，也是第二部分。");
        assert_eq!(display.basis, TABLE_REORDER_BASIS);
        assert_eq!(
            display.trans_fingerprint,
            trans_text_fingerprint("也是第二部分，这是第一部分。")
        );
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        assert!(!entry.crossing, "a successful reorder removes the crossing");
        assert_eq!(entry.correspondence, None);
        assert_eq!(entry.text_basis, TextBasis::Display);
        assert_eq!(entry.pieces[0].text, "这是第一部分，");
        assert_eq!(entry.pieces[1].text, "也是第二部分。");
        // The entry takes display as its basis: valid for `transDisplay`, invalid for the natural translation.
        let sentences = derive_sentences(&doc, &derive_cues(&doc, &CueParams::default()));
        assert!(align_entry_valid_for_lang(&doc, &sentences[0], "zh", entry));
        assert!(!crate::split::align_entry_valid(
            &doc,
            &sentences[0],
            &doc.trans["zh"]["s-g1.0"],
            entry
        ));
        assert_eq!(
            crate::split::basis_text(&doc, "zh", "s-g1.0", entry),
            Some("这是第一部分，也是第二部分。")
        );
        assert!(
            outcome
                .violations
                .iter()
                .any(|violation| violation.contains("reordered")),
            "reorder must surface as a review advisory: {:?}",
            outcome.violations
        );
    }

    #[test]
    fn reordered_target_guards_reject_rewrites() {
        let source = "one two three four five six seven eight nine ten";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        let sentence = Sentence {
            id: "s-reorder".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: "也是第二部分内容，这是第一部分的内容。".to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");

        // A "reordering" that compresses heavily is rejected as a rewrite.
        let drift = r#"{"sentences":[{"key":"s-reorder","sourceBreaks":["b5"],"target":"第一部分。 | 完。","reordered":true}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", drift).unwrap();
        assert!(accepted.is_empty());
        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("rewrites too much")),
            "{failures:?}"
        );
    }

    #[test]
    fn style_advisories_do_not_trigger_global_repair() {
        let mut doc = with_translations(two_sentence_doc());
        let response = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                (
                    "alpha bravo charlie delta echo,",
                    "第一段译文需要自然对应，第二段译文",
                ),
                ("foxtrot golf hotel.", "负责完整收尾。"),
            ],
        )]);
        let mut llm = file_llm([response]);

        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 0);
        assert!(
            outcome
                .violations
                .iter()
                .any(|item| item.contains("uneven")),
            "{:?}",
            outcome.violations
        );
    }

    #[test]
    fn independent_splits_by_target_language_without_llm() {
        let mut doc = two_sentence_doc();
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            "这一句的译文很长需要按目标语言自己的habits来切开展示。".to_owned(),
        );
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &opts(AlignMode::Independent),
            &mut |_| {},
        )
        .unwrap();
        assert!(llm.calls.is_empty());
        assert_eq!(outcome.aligned_sentences, 1);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::Independent);
        assert!(entry.pieces.len() >= 2);
        assert!(entry.pieces.iter().all(|piece| piece.from.is_none()));

        // Short sentences ≤ fit: clear the entries and do not split.
        doc.trans
            .get_mut("zh")
            .unwrap()
            .insert("s-g1.0".to_owned(), "短句译文。".to_owned());
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &opts(AlignMode::Independent),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.aligned_sentences, 0);
        assert!(!doc.trans_align.contains_key("zh"));
    }

    #[test]
    fn mixed_product_names_within_visual_units_need_no_entry() {
        let mut doc = two_sentence_doc();
        let translation = "Claude Code、Antigravity，";
        assert!(!exceeds_one_line_fit(translation, "zh", 16));
        assert!(target_cps_chars(translation, "zh") <= 20);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), translation.to_owned());
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert!(llm.calls.is_empty());
        assert_eq!(outcome.aligned_sentences, 0);
        assert_eq!(outcome.skipped_sentences, 1);
        assert!(doc.trans_align.is_empty());
    }

    #[test]
    fn bad_answers_use_one_global_repair_then_fall_back() {
        let mut doc = with_translations(two_sentence_doc());
        let bad = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                ("alpha bravo charlie delta echo,", "改写过的文本"),
                ("foxtrot golf hotel.", "第二段译文负责完整收尾。"),
            ],
        )]);
        let mut llm = file_llm([bad.clone(), bad]);
        let mut sleeps = Vec::new();
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &opts(AlignMode::ManyToOne),
            &mut |seconds| sleeps.push(seconds),
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 2);
        assert!(sleeps.is_empty());
        let reason = llm.calls[1].3.as_deref().unwrap();
        assert!(
            reason.contains("Every validation problem from the previous round"),
            "{reason}"
        );
        assert_eq!(outcome.aligned_sentences, 0);
        assert_eq!(outcome.fallback_sentences, 1);
        assert!(outcome.violations.iter().any(|v| v.contains("fell back")));
        // The fallback is still target-language-first with source-word anchoring, and the concatenation invariant holds.
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        assert_eq!(entry.words.len(), 8);
        let concatenated: String = entry
            .pieces
            .iter()
            .map(|piece| piece.text.as_str())
            .collect();
        assert_eq!(
            normalize_chars(&concatenated),
            normalize_chars("第一段译文需要自然对应，第二段译文负责完整收尾。")
        );
    }

    #[test]
    fn partial_batch_keeps_good_sentence_and_falls_back_bad_one() {
        // Both sentences exceed fit, returned in one batch: sentence 1 is acceptable, sentence 2 has a concatenation error ⇒ only sentence 2 falls back.
        let mut doc = doc_with_words(vec![
            w("a0", 0.0, 0.3, "one"),
            w("a1", 0.3, 0.6, "two"),
            w("a2", 0.6, 0.9, "three"),
            w("a3", 0.9, 1.2, "four"),
            w("a4", 1.2, 1.5, "five,"),
            w("a5", 1.5, 1.8, "six"),
            w("a6", 1.8, 2.1, "seven"),
            w("a7", 2.1, 2.4, "eight."),
            w("b0", 2.6, 2.9, "alpha"),
            w("b1", 2.9, 3.2, "bravo"),
            w("b2", 3.2, 3.5, "charlie"),
            w("b3", 3.5, 3.8, "delta"),
            w("b4", 3.8, 4.1, "echo,"),
            w("b5", 4.1, 4.4, "foxtrot"),
            w("b6", 4.4, 4.7, "golf"),
            w("b7", 4.7, 5.0, "hotel."),
        ]);
        let zh = doc.trans.entry("zh".to_owned()).or_default();
        zh.insert(
            "s-a0".to_owned(),
            "第一段译文需要自然对应，第二段译文负责完整收尾。".to_owned(),
        );
        zh.insert(
            "s-b0".to_owned(),
            "另一句也需要切分展示，否则会超过单行容量。".to_owned(),
        );
        let good = ttable(&[
            tgroup(
                "s-a0",
                "",
                &[
                    ("one two three four five,", "第一段译文需要自然对应，"),
                    ("six seven eight.", "第二段译文负责完整收尾。"),
                ],
            ),
            tgroup(
                "s-b0",
                "",
                &[
                    ("alpha bravo charlie delta", "改写过的文本"),
                    ("echo, foxtrot golf hotel.", "否则会超过单行容量。"),
                ],
            ),
        ]);
        let retry_bad = ttable(&[tgroup(
            "s-b0",
            "",
            &[
                ("alpha bravo charlie delta", "还是错的"),
                ("echo, foxtrot golf hotel.", "否则会超过单行容量。"),
            ],
        )]);
        let mut llm = file_llm([good, retry_bad]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 2);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 1);
        assert_eq!(
            doc.trans_align["zh"]["s-a0"].pieces[0].text,
            "第一段译文需要自然对应，"
        );
        let fallback = &doc.trans_align["zh"]["s-b0"];
        let concatenated: String = fallback.pieces.iter().map(|p| p.text.as_str()).collect();
        assert_eq!(
            normalize_chars(&concatenated),
            normalize_chars("另一句也需要切分展示，否则会超过单行容量。")
        );
    }

    /// E2: a fallback hard cut must snap to a punctuation seam within the window, rather than cutting at equal widths. The old implementation cut bare at per=13, producing “…needs to show, then” + “is the second…”.
    #[test]
    fn oversize_hard_cut_snaps_to_a_punctuation_seam() {
        let params = TransParams::for_lang("zh");
        let text = "这是第一小句需要展示，接着是第二小句继续展示内容。";
        assert!(target_cps_chars(text, "zh") > params.hard);
        // max_pieces=1 goes straight through `oversize_hard_cut` (the real entry point when there are fewer source words than target pieces).
        let pieces = crate::split::split_independent_for_lang(text, &params, 1, "zh");
        assert_eq!(
            pieces,
            vec![
                "这是第一小句需要展示，".to_owned(),
                "接着是第二小句继续展示内容。".to_owned()
            ],
            "{pieces:?}"
        );
    }

    /// E2: even when there is no seam within the window, it must not cut inside a CJK word. As long as a legal word boundary still exists (here, between Latin words on either side), the window must be widened to snap to it.
    #[test]
    fn oversize_hard_cut_avoids_cjk_midword_when_a_word_boundary_exists() {
        let params = TransParams::for_lang("zh");
        let text = "这段中文完全没有标点符号里面夹着 API 这个拉丁词继续延伸下去到结尾";
        assert!(target_cps_chars(text, "zh") > params.hard);
        let pieces = crate::split::split_independent_for_lang(text, &params, 1, "zh");
        assert!(pieces.len() >= 2, "{pieces:?}");
        for pair in pieces.windows(2) {
            assert!(
                !crate::seam::cjk_midword_boundary(pair[0].trim_end(), pair[1].trim_start()),
                "cut inside a CJK word: {pair:?}"
            );
        }
    }

    /// E2's guardrail: seam snapping must not push any piece over hard. `enforce_target_hard_limit` would judge "a piece still over hard" as unrepresentable and reject the whole sentence.
    #[test]
    fn oversize_hard_cut_keeps_every_piece_under_hard() {
        let params = TransParams::for_lang("zh");
        for text in [
            "这段很长的中文需要被切成很多片才能放得下每一行都必须严格遵守二十字的交付上限否则会被引擎判成不可表示",
            "混合文本里有 tokenizer 和 scheduler 这样的英文词还有 2048 这种数字并且整体长度远远超过一行的容量",
            "这是第一小句需要展示，接着是第二小句继续展示内容，最后还有第三小句负责收尾。",
        ] {
            let pieces = crate::split::split_independent_for_lang(text, &params, 1, "zh");
            for piece in &pieces {
                assert!(
                    target_cps_chars(piece, "zh") <= params.hard,
                    "piece over hard: {piece:?} in {pieces:?}"
                );
            }
            assert_eq!(
                normalize_chars(&pieces.concat()),
                normalize_chars(text),
                "{pieces:?}"
            );
        }
    }

    fn g79_pending<'a>(sentence: &'a Sentence, words: &[&str]) -> Pending<'a> {
        Pending {
            sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: words
                .iter()
                .enumerate()
                .map(|(index, text)| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: index as f64 * 0.4,
                    t1: index as f64 * 0.4 + 0.4,
                    glue: false,
                })
                .collect(),
            translation:
                "生产部署已观察到 50% 的吞吐量提升，同时还可以将 max_num_batched_tokens 设置为大于 2048。"
                    .to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: vec!["max_num_batched_tokens".to_owned()],
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        }
    }

    /// E1(a): in the worker's two-piece answer the tail piece exceeds hard, and the engine's own deterministic re-split cuts “can” in the middle, colliding with an objective seam defect. The engine must not record this failure against the worker: the re-split is discarded and the original answer is kept whole (KeepWhole). But keeping the whole piece still exceeds hard, meaning the worker's piece was over the limit to begin with. Following "accept first, then targeted supplement", it is not stored on the first round. It goes into salvage, and only this one sentence, with targeted instructions, is sent back to the repair round. When the repair budget runs out, salvage is used as-is (the result is no worse than direct acceptance). If the worker self-reports unsplittable, that is taken as the contract being fulfilled and it is accepted directly.
    #[test]
    fn engine_keeps_worker_segmentation_when_its_own_recut_breaks_acceptance() {
        let params = TransParams::for_lang("zh");
        let source_words = [
            "Production",
            "deployments",
            "have",
            "seen",
            "fifty",
            "percent",
            "throughput",
            "improvement,",
            "and",
            "you",
            "can",
            "also",
            "set",
            "max_num_batched_tokens",
            "to",
            "greater",
            "than",
            "two",
            "thousand",
            "and",
            "forty",
            "eight",
            "alongside",
            "it.",
        ];
        let sentence = Sentence {
            id: "s-g79.0".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source_words.join(" "),
            src_fingerprint: "test".to_owned(),
        };
        let pending = g79_pending(&sentence, &source_words);
        let batch = vec![&pending];
        let raw = r#"{"sentences":[{"key":"s-g79.0","sourceBreaks":["b8"],"target":"生产部署已观察到 50% 的吞吐量提升， | 同时还可以将 max_num_batched_tokens 设置为大于 2048。"}]}"#;
        let (accepted, salvaged, failures) =
            validate_batch_partial(&batch, &params, "en", "zh", raw).unwrap();
        assert!(
            accepted.is_empty(),
            "the first round does not commit on the spot: {accepted:?}"
        );
        assert_eq!(failures.len(), 1, "{failures:?}");
        assert!(
            failures[0].contains("s-g79.0")
                && failures[0].contains("over the absolute hard ceiling")
                && failures[0].contains("data-unsplittable"),
            "targeted instructions must name the sentence, state the over-limit piece and give a way out: {}",
            failures[0]
        );
        let result = &salvaged["s-g79.0"];
        assert_eq!(result.texts.len(), 2, "{:?}", result.texts);
        assert!(
            result.texts[0].ends_with("提升，"),
            "boundary must stay at the natural comma seam: {:?}",
            result.texts
        );
        // “can” must fall wholly within the same piece and must never be cut apart.
        assert!(
            result.texts.iter().any(|text| text.contains("可以")),
            "{:?}",
            result.texts
        );
        for pair in result.texts.windows(2) {
            assert!(
                !crate::seam::cjk_midword_boundary(pair[0].trim_end(), pair[1].trim_start()),
                "cut inside a CJK word: {pair:?}"
            );
        }
        assert!(
            result
                .advisories
                .iter()
                .any(|item| item.contains("re-split") && item.contains("abandoned")),
            "{:?}",
            result.advisories
        );
        assert!(
            result
                .advisories
                .iter()
                .any(|item| item.contains("kept as salvage")),
            "{:?}",
            result.advisories
        );

        // The same answer self-reports unsplittable ⇒ the contract is fulfilled; accept directly, no send-back.
        let declared = raw.replace(r#""sourceBreaks""#, r#""unsplittable":true,"sourceBreaks""#);
        let (accepted, salvaged, failures) =
            validate_batch_partial(&batch, &params, "en", "zh", &declared).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        assert!(salvaged.is_empty());
        assert_eq!(accepted["s-g79.0"].texts.len(), 2);
    }

    fn dangling_source_doc() -> TranscriptDoc {
        let mut doc = doc_with_words(vec![
            w("a0", 0.0, 0.4, "alpha"),
            w("a1", 0.4, 0.8, "bravo"),
            w("a2", 0.8, 1.2, "charlie"),
            w("a3", 1.2, 1.6, "and"),
            w("a4", 1.6, 2.0, "delta,"),
            w("a5", 2.0, 2.4, "echo"),
            w("a6", 2.4, 2.8, "foxtrot"),
            w("a7", 2.8, 3.2, "golf."),
        ]);
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-a0".to_owned(),
            "第一段译文需要自然对应，第二段译文负责完整收尾。".to_owned(),
        );
        doc
    }

    /// E1(b): after the repair budget is exhausted, a structurally sound worker answer stands in for the purely length-based deterministic split of `fallback_word_entry`. Here both rounds were rejected for source-side shape (cut after the dangling conjunction "and"), yet the translation pieces themselves are fully legal.
    #[test]
    fn salvaged_worker_answer_replaces_the_deterministic_fallback() {
        let mut doc = dangling_source_doc();
        let answer = ttable(&[tgroup(
            "s-a0",
            "",
            &[
                ("alpha bravo charlie and", "第一段译文需要自然对应，"),
                ("delta, echo foxtrot golf.", "第二段译文负责完整收尾。"),
            ],
        )]);
        let mut llm = file_llm([answer.clone(), answer]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 2);
        assert_eq!(outcome.fallback_sentences, 0);
        assert_eq!(outcome.aligned_sentences, 1);
        assert!(
            outcome
                .violations
                .iter()
                .any(|item| item.contains("kept the submitted segmentation")),
            "{:?}",
            outcome.violations
        );
        assert!(
            !outcome
                .violations
                .iter()
                .any(|item| item.contains("fell back")),
            "{:?}",
            outcome.violations
        );
        let entry = &doc.trans_align["zh"]["s-a0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        let texts: Vec<&str> = entry
            .pieces
            .iter()
            .map(|piece| piece.text.as_str())
            .collect();
        assert_eq!(
            texts,
            vec!["第一段译文需要自然对应，", "第二段译文负责完整收尾。"],
            "{texts:?}"
        );
    }

    /// E3: the repair round's retryReason must restate **all** failures (not just the last one), plus the pieceCount constraint and the budget. Otherwise the worker fixes only one item, and the next round hits another criterion.
    #[test]
    fn repair_round_reason_carries_every_problem_and_the_piece_count_plan() {
        let mut doc = doc_with_words(vec![
            w("a0", 0.0, 0.3, "one"),
            w("a1", 0.3, 0.6, "two"),
            w("a2", 0.6, 0.9, "three"),
            w("a3", 0.9, 1.2, "four"),
            w("a4", 1.2, 1.5, "five,"),
            w("a5", 1.5, 1.8, "six"),
            w("a6", 1.8, 2.1, "seven"),
            w("a7", 2.1, 2.4, "eight."),
            w("b0", 2.6, 2.9, "alpha"),
            w("b1", 2.9, 3.2, "bravo"),
            w("b2", 3.2, 3.5, "charlie"),
            w("b3", 3.5, 3.8, "delta"),
            w("b4", 3.8, 4.1, "echo,"),
            w("b5", 4.1, 4.4, "foxtrot"),
            w("b6", 4.4, 4.7, "golf"),
            w("b7", 4.7, 5.0, "hotel."),
        ]);
        let zh = doc.trans.entry("zh".to_owned()).or_default();
        zh.insert(
            "s-a0".to_owned(),
            "第一段译文需要自然对应，第二段译文负责完整收尾。".to_owned(),
        );
        zh.insert(
            "s-b0".to_owned(),
            "另一句也需要切分展示，否则会超过单行容量。".to_owned(),
        );
        // Both sentences had their translations rewritten (concatenation mismatch).
        let bad = ttable(&[
            tgroup(
                "s-a0",
                "",
                &[
                    ("one two three four five,", "完全改写过的第一段文本，"),
                    ("six seven eight.", "第二段译文负责完整收尾。"),
                ],
            ),
            tgroup(
                "s-b0",
                "",
                &[
                    ("alpha bravo charlie delta echo,", "改写内容，"),
                    ("foxtrot golf hotel.", "否则会超过单行容量。"),
                ],
            ),
        ]);
        let mut llm = file_llm([bad.clone(), bad]);
        let _ = run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 2);
        let reason = llm.calls[1].3.as_deref().unwrap();
        assert!(
            reason.contains("Every validation problem from the previous round"),
            "{reason}"
        );
        // The failures of both sentences must both be present, not just the last one.
        assert!(reason.contains("s-a0"), "{reason}");
        assert!(reason.contains("s-b0"), "{reason}");
        assert!(reason.contains("[align-content-drift]"), "{reason}");
        // Restatement of pieceCount and the budget.
        assert!(reason.contains("rows min="), "{reason}");
        assert!(reason.contains("recommended="), "{reason}");
        assert!(reason.contains("budgets fit="), "{reason}");
    }

    #[test]
    fn over_hard_target_piece_is_force_split_without_retry() {
        let long = "超".repeat(21);
        let source_words: Vec<String> = (0..10).map(|index| format!("word{index}")).collect();
        let sentence = Sentence {
            id: "s-hard".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source_words.join(" "),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: text.clone(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: format!("{long}尾。"),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let batch = vec![&pending];
        let raw = format!(
            r#"{{"sentences":[{{"key":"s-hard","sourceBreaks":["b5"],"target":"{long} | 尾。"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &TransParams::for_lang("zh"), "en", "zh", &raw).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let result = &accepted["s-hard"];
        // The "tail。" fragment forcibly split off is later merged into its neighbouring piece by flash-fragment repair: 3 → 2.
        assert_eq!(result.texts.len(), 2);
        assert!(
            result
                .texts
                .iter()
                .all(|text| target_cps_chars(text, "zh") <= 20),
            "{:?}",
            result.texts
        );
        assert!(
            result
                .advisories
                .iter()
                .any(|item| item.contains("deterministically split")),
            "{:?}",
            result.advisories
        );
    }

    #[test]
    fn more_target_pieces_than_source_words_stay_under_hard_without_retry() {
        let mut doc = doc_with_words(vec![w("g1.0", 0.0, 3.0, "source.")]);
        doc.media.duration = 3.0;
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 1);
        let sentence_id = sentences[0].id.clone();
        let translation = "这是一段极端扩写的中文译文没有足够的英文词可以逐片对应但每个展示片仍然必须严格遵守二十字的交付上限。";

        let pending = Pending {
            sentence: &sentences[0],
            anchor_indices: sentences[0].word_indices.clone(),
            words: vec![PendingWord {
                text: "source.".to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            }],
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let fallback = fallback_word_entry(
            &doc,
            &pending,
            translation,
            "zh",
            &TransParams::for_lang("zh"),
        );
        assert_eq!(fallback.mode, AlignMode::Independent);
        assert!(fallback.pieces.len() > 1);
        assert!(
            fallback
                .pieces
                .iter()
                .all(|piece| target_cps_chars(&piece.text, "zh") <= 20),
            "{:?}",
            fallback.pieces
        );

        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentence_id.clone(), translation.to_owned());
        let response = ttable(&[tgroup(&sentence_id, "", &[("source.", translation)])]);
        let mut llm = file_llm([response]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.fallback_sentences, 0);
        let entry = &doc.trans_align["zh"][&sentence_id];
        assert_eq!(entry.mode, AlignMode::Independent);
        assert!(entry.pieces.len() > doc.words.len());
        assert!(
            entry
                .pieces
                .iter()
                .all(|piece| piece.from.is_none() && piece.to.is_none())
        );
        assert!(
            entry
                .pieces
                .iter()
                .all(|piece| target_cps_chars(&piece.text, "zh") <= 20)
        );

        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), entry.pieces.len());
        assert!(stream.iter().all(|cue| cue.word_span.is_none()));
        assert_eq!(stream.first().unwrap().start, 0.0);
        assert_eq!(stream.last().unwrap().end, 3.0);
        assert!(stream.windows(2).all(|pair| pair[0].end == pair[1].start));
    }

    #[test]
    fn reordered_cause_and_result_is_force_split_under_hard() {
        let source = "Now, it turns out they were actually 20 percent less productive and slower because of these new tools that were introduced.";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        assert_eq!(source_words.len(), 21);
        let sentence = Sentence {
            id: "s-cross".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let translation =
            "结果却发现，引入这些新工具后，他们的生产力实际上降低了 20%，工作速度也更慢。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let batch = vec![&pending];
        let target =
            "结果却发现， | 引入这些新工具后，他们的生产力实际上降低了 20%，工作速度也更慢。";

        let response = format!(
            r#"{{"sentences":[{{"key":"s-cross","sourceBreaks":["b4"],"target":"{target}"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &TransParams::for_lang("zh"), "en", "zh", &response)
                .unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let result = &accepted["s-cross"];
        assert!(result.texts.len() >= 3, "{:?}", result.texts);
        assert!(
            matches!(result.anchor, AcceptedAnchor::Independent),
            "unsafe proportional source seams must not be persisted"
        );
        assert!(
            result
                .texts
                .iter()
                .all(|text| { target_cps_chars(text, "zh") <= TransParams::for_lang("zh").hard }),
            "{:?}",
            result.texts
        );
        let concatenated: String = result.texts.iter().map(String::as_str).collect();
        assert_eq!(normalize_chars(&concatenated), normalize_chars(translation));
    }

    #[test]
    fn validate_pieces_never_accepts_legacy_crossing_overflow() {
        let too_long = "长".repeat(21);
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 0,
                text: "短".to_owned(),
            },
            PieceJson {
                from: 1,
                to: 1,
                text: too_long.clone(),
            },
        ];
        let result = validate_pieces(
            "s-cross",
            &pieces,
            2,
            &format!("短{too_long}"),
            "zh",
            &TransParams::for_lang("zh"),
        );
        assert!(
            matches!(result, Err(LlmError::Malformed(ref detail)) if detail.contains("absolute hard ceiling")),
            "{result:?}"
        );
    }

    #[test]
    fn whole_over_hard_sentence_is_force_split_even_without_source_breaks() {
        let source = "Well, this is how we've delivered high-quality software for decades.";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        let sentence = Sentence {
            id: "s-whole-cross".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let translation = "几十年来，我们一直这样交付高质量软件，并且还会继续改进整个流程。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let batch = vec![&pending];
        let response = format!(
            r#"{{"sentences":[{{"key":"s-whole-cross","sourceBreaks":[],"target":"{translation}"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &TransParams::for_lang("zh"), "en", "zh", &response)
                .unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let result = &accepted["s-whole-cross"];
        assert!(result.texts.len() >= 2, "{:?}", result.texts);
        assert!(
            result
                .texts
                .iter()
                .all(|text| target_cps_chars(text, "zh") <= 20),
            "{:?}",
            result.texts
        );
    }

    #[test]
    fn relation_break_candidates_explain_why_thanks_to_must_stay_together() {
        let words: Vec<&str> = "developers who thought that they were faster thanks to the tools"
            .split_whitespace()
            .collect();
        assert_eq!(source_boundary_issue(&words, 4), None);
        assert!(
            source_boundary_issue(&words, 8).is_some_and(|reason| reason.contains("thanks to")),
            "{:?}",
            source_boundary_issue(&words, 8)
        );
    }

    #[test]
    fn required_infinitive_complement_is_a_blocking_source_boundary() {
        let words = "Which means when I find a need to write prompts in order to improve"
            .split_whitespace()
            .collect::<Vec<_>>();
        let reason = source_boundary_issue(&words, 7).expect("need | to must be rejected");
        assert!(reason.contains("infinitive complement"), "{reason}");
        assert!(source_boundary_issue_is_blocking(&reason), "{reason}");
    }

    #[test]
    fn fused_em_dash_atom_still_exposes_dangling_article_boundary() {
        assert!(
            source_boundary_issue(&["matters—the", "part"], 1)
                .is_some_and(|reason| reason.contains("dangling source tail")),
        );
    }

    #[test]
    fn reciprocal_phrase_may_end_before_the_next_preposition() {
        let words: Vec<&str> = "teams are waiting for each other across fragmented tools"
            .split_whitespace()
            .collect();
        assert!(
            source_boundary_issue(&words, 5).is_some(),
            "each | other must remain a risky split"
        );
        assert_eq!(
            source_boundary_issue(&words, 6),
            None,
            "each other | across closes a complete reciprocal phrase"
        );
    }

    #[test]
    fn source_boundary_keeps_do_it_this_way_together() {
        let words: Vec<&str> = "the benefit of doing it this way is clear"
            .split_whitespace()
            .collect();
        assert!(
            source_boundary_issue(&words, 5)
                .is_some_and(|reason| reason.contains("do it this way"))
        );
        assert_eq!(
            source_boundary_issue(&["We", "fixed", "it.", "This", "way", "works."], 3),
            None,
            "a new sentence after a sentence end must not be falsely flagged by fixed-phrase rules"
        );
    }

    /// `doing this |`, `reach for this |`: "this" is the object pronoun of a transitive verb or preposition, not a dangling determiner. Boundaries like this were once falsely reported in full by BOUND_MODIFIERS.
    #[test]
    fn source_boundary_allows_pronoun_object_this() {
        let words: Vec<&str> = "the reason for doing this is that it scales"
            .split_whitespace()
            .collect();
        assert_eq!(
            source_boundary_issue(&words, 5),
            None,
            "object pronoun 'this' after a transitive verb is not a dangling modifier"
        );
        let words: Vec<&str> = "the tools you reach for this instead of that"
            .split_whitespace()
            .collect();
        assert_eq!(
            source_boundary_issue(&words, 6),
            None,
            "object pronoun 'this' after a preposition is not a dangling modifier"
        );
        // A genuine determiner usage must still be hinted: the next piece starts with a noun head.
        let words: Vec<&str> = "we are going to use this model for everything"
            .split_whitespace()
            .collect();
        assert!(
            source_boundary_issue(&words, 6)
                .is_some_and(|reason| reason.contains("detached from its noun phrase")),
            "determiner 'this' followed by a noun should still be reported as a dangling modifier"
        );
    }

    #[test]
    fn render_source_marks_pauses_and_spacing() {
        let words = vec![
            PendingWord {
                text: "Hello".to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            },
            PendingWord {
                text: "world,".to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            },
            PendingWord {
                text: "again.".to_owned(),
                pause_before: 2,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            },
        ];
        assert_eq!(render_source(&words), "Hello world, ⏸⏸ again.");
        let cjk = vec![
            PendingWord {
                text: "你".to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            },
            PendingWord {
                text: "好".to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            },
            PendingWord {
                text: "吗".to_owned(),
                pause_before: 3,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            },
        ];
        assert_eq!(render_source(&cjk), "你好 ⏸⏸⏸ 吗");
    }

    #[test]
    fn source_segments_reanchor_ignores_pause_marks_and_rejects_midword_cuts() {
        let words: Vec<PendingWord> = ["alpha", "bravo,", "charlie", "delta."]
            .iter()
            .map(|text| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let good = split_marked("alpha bravo, ⏸ | charlie delta.");
        assert_eq!(
            source_segments_to_ranges("s-x", &good, &words).unwrap(),
            vec![(0, 1), (2, 3)]
        );
        let midword = split_marked("alpha bra | vo, charlie delta.");
        assert!(
            source_segments_to_ranges("s-x", &midword, &words)
                .unwrap_err()
                .contains("verbatim")
        );
        let incomplete = split_marked("alpha bravo, | charlie");
        assert!(
            source_segments_to_ranges("s-x", &incomplete, &words)
                .unwrap_err()
                .contains("include every word")
        );
    }

    #[test]
    fn real_ai_tool_sentence_rejects_detached_bound_noun_phrase() {
        let source = "When I talk to developers, a lot of folks are worried about how AI might take their job. Maybe they've been pressured to pick up a new AI-assisted coding tool, or they're being told to become AI-native.";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        assert_eq!(source_words.len(), 37);
        let sentence = Sentence {
            id: "s-g1.0".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words = source_words
            .iter()
            .map(|text| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let translation = "和开发者交流时，我发现很多人担心AI会抢走自己的工作。他们可能被要求使用新的AI辅助编程工具，或被告知要成为“AI原生”开发者。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let batch = vec![&pending];
        let target = "和开发者交流时， | 我发现很多人担心AI会抢走自己的工作。 | 他们可能被要求使用新的AI辅助编程工具， | 或被告知要成为“AI原生”开发者。";

        let good = format!(
            r#"{{"sentences":[{{"key":"s-g1.0","sourceBreaks":["b5","b18","b30"],"target":"{target}"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &TransParams::for_lang("zh"), "en", "zh", &good)
                .unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let AcceptedAnchor::WordRanges(ranges) = &accepted["s-g1.0"].anchor else {
            panic!("expected word-anchored alignment")
        };
        assert_eq!(
            ranges
                .iter()
                .map(|(from, to)| to - from + 1)
                .collect::<Vec<_>>(),
            vec![5, 13, 12, 7]
        );

        // The poor cut point b27 from the old proportional anchoring falls exactly on `a new | AI-assisted...`. This is an objective bad seam, and it must enter the global repair rather than wait until done to be refined.
        let bad = format!(
            r#"{{"sentences":[{{"key":"s-g1.0","sourceBreaks":["b5","b18","b27"],"target":"{target}"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &TransParams::for_lang("zh"), "en", "zh", &bad).unwrap();
        assert!(accepted.is_empty(), "{accepted:?}");
        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("detached from its noun phrase")),
            "{failures:?}"
        );
    }

    /// P0-a regression: a piece that exceeds one row and has a free seam is cut in place at acceptance time, keeping text and source interval in sync, and is not sent back. Sending it back would consume the single global repair call (which other sentences need), while `free_seam` has already computed the cut point together with the text on both sides. The reasoning is the same as for flash-fragment repair.
    #[test]
    fn over_fit_answer_piece_is_repaired_at_its_free_seam() {
        let source = "Your GPU has idle compute between memory reads, so speculative decoding gives you free tokens.";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        let sentence = Sentence {
            id: "s-fit1".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words = source_words
            .iter()
            .enumerate()
            .map(|(index, text)| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: index as f64 * 0.5,
                t1: (index + 1) as f64 * 0.5,
                glue: false,
            })
            .collect();
        let translation = "你的 GPU 在显存读取之间会有空闲算力——所以推测解码能白送你 token。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let batch = vec![&pending];
        let params = TransParams::for_lang("zh");
        assert!(exceeds_one_line_fit(
            "你的 GPU 在显存读取之间会有空闲算力——",
            "zh",
            params.fit
        ));
        let answer = r#"{"sentences":[{"key":"s-fit1","sourceBreaks":["b8"],"target":"你的 GPU 在显存读取之间会有空闲算力—— | 所以推测解码能白送你 token。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &params, "en", "zh", answer).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let entry = &accepted["s-fit1"];
        assert_eq!(
            entry.texts,
            vec![
                "你的 GPU".to_owned(),
                "在显存读取之间会有空闲算力——".to_owned(),
                "所以推测解码能白送你 token。".to_owned(),
            ]
        );
        let AcceptedAnchor::WordRanges(ranges) = &entry.anchor else {
            panic!("expected word-anchored alignment")
        };
        assert_eq!(ranges.len(), 3);
        assert_eq!(ranges[0].0, 0);
        assert_eq!(ranges[2].1, source_words.len() - 1);
        for text in &entry.texts {
            assert!(
                !exceeds_one_line_fit(text, "zh", params.fit),
                "repaired pieces must fit one line: {:?}",
                entry.texts
            );
        }
    }

    #[test]
    fn seam_backed_risky_boundary_is_accepted() {
        // A clause seam (comma) coinciding with a risky annotation: bound-phrase detection on a seam is mostly a false positive, and both the engine and the submit-time lint allow it (all three rejections in the p850 benchmark were of this kind).
        let source = "You can find value in that, but the rest is noise.";
        let source_words: Vec<&str> = source.split_whitespace().collect();
        let sentence = Sentence {
            id: "s-r1".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words = source_words
            .iter()
            .enumerate()
            .map(|(index, text)| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: index as f64 * 0.5,
                t1: (index + 1) as f64 * 0.5,
                glue: false,
            })
            .collect();
        let translation = "你能在其中找到不少价值，但其余的部分都是噪音。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let batch = vec![&pending];
        // b6 = after "that,": ends_clause_punct ⇒ seam3, and the tail "that" also hits BOUND_MODIFIERS ⇒ risky.
        let answer = r#"{"sentences":[{"key":"s-r1","sourceBreaks":["b6"],"target":"你能在其中找到不少价值， | 但其余的部分都是噪音。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&batch, &TransParams::for_lang("zh"), "en", "zh", answer)
                .unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        assert!(accepted.contains_key("s-r1"));
    }

    #[test]
    fn full_rerun_splits_the_observed_55_item_workload_into_two_pages() {
        let sentence_count = 55usize;
        let mut doc = talk_alignment_doc(sentence_count);
        let sentence_ids = derive_sentences(&doc, &derive_cues(&doc, &CueParams::default()))
            .into_iter()
            .map(|sentence| sentence.id)
            .collect();
        let mut options = opts(AlignMode::ManyToOne);
        options.sentences = Some(sentence_ids);
        let mut llm = DraftReviewLlm {
            calls: 0,
            fail_first: false,
            request_item_counts: Vec::new(),
        };
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert_eq!(llm.calls, 2);
        assert_eq!(llm.request_item_counts.len(), 2);
        assert_eq!(
            llm.request_item_counts.iter().sum::<usize>(),
            sentence_count
        );
        assert!(
            llm.request_item_counts
                .iter()
                .all(|count| *count <= ALIGN_MAX_ITEMS_PER_PAGE)
        );
        assert_eq!(outcome.aligned_sentences, sentence_count);
    }

    #[test]
    fn targeted_mode_and_worker_slots_do_not_change_paging() {
        let sentence_count = 17usize;
        let mut doc = talk_alignment_doc(sentence_count);
        let mut options = opts(AlignMode::ManyToOne);
        options.targeted = true;
        options.worker_slots = Some(6);
        let mut llm = DraftReviewLlm {
            calls: 0,
            fail_first: false,
            request_item_counts: Vec::new(),
        };
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert_eq!(llm.calls, 1);
        assert_eq!(llm.request_item_counts, vec![sentence_count]);
        assert_eq!(outcome.aligned_sentences, sentence_count);
    }

    #[test]
    fn align_item_cost_counts_latin_words_and_cjk_characters() {
        let sentence = Sentence {
            id: "s-test".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: vec![0, 1],
            source_text: "one two 三四".to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: vec![0, 1],
            words: vec![
                PendingWord {
                    text: "one two".to_owned(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 1.0,
                    glue: false,
                },
                PendingWord {
                    text: "三四".to_owned(),
                    pause_before: 0,
                    t0: 1.0,
                    t1: 2.0,
                    glue: false,
                },
            ],
            translation: "测试译文。".to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        assert_eq!(align_item_word_count(&pending), 4);
        assert_eq!(crate::paging::PageExecutor::Agent.align_words(), 2000);
        assert_eq!(crate::paging::PageExecutor::Provider.align_words(), 2000);
    }

    #[test]
    fn pause_tier_thresholds() {
        assert_eq!(pause_tier(0.1), 0);
        assert_eq!(pause_tier(0.3), 1);
        assert_eq!(pause_tier(0.7), 2);
        assert_eq!(pause_tier(1.5), 3);
    }

    #[test]
    fn anchor_token_must_share_segment_index() {
        // Measured sample: "from TeachFX" is fronted in Chinese as "TeachFX 里…". Once the cut point falls into the crossing zone, TeachFX's segment numbers on the two sides disagree ⇒ it must be sent back.
        let src =
            split_marked("\"Pull | my latest second-grade ELA lesson from TeachFX, tell me more.");
        let tgt = split_marked("“调取 TeachFX | 里我最新的二年级 ELA 课,再多告诉我一些。");
        let err = anchor_token_colocation("s-x", &src, &tgt).unwrap_err();
        assert!(err.contains("teachfx"), "{err}");
        // Same segment ⇒ passes (the crossing zone is kept whole).
        let src_ok =
            split_marked("\"Pull my latest second-grade ELA lesson from TeachFX, | tell me more.");
        let tgt_ok = split_marked("“调取 TeachFX 里我最新的二年级 ELA 课, | 再多告诉我一些。");
        assert!(anchor_token_colocation("s-x", &src_ok, &tgt_ok).is_ok());
    }

    /// Degenerate paired row (R2 benchmark `s-g29.0`: `have`, 1 word, attached to 9 units of Chinese).
    #[test]
    fn degenerate_paired_row_rejects_crumb_source_ranges() {
        let texts = vec![
            "但每一步都得".to_owned(),
            "对之前所有的 token".to_owned(),
            "重新计算一遍注意力。".to_owned(),
        ];
        // The source side has 12 words: the first two pieces have 2 and 1 words, and the third piece takes the rest.
        let units = vec![2; 12];
        let ranges = [(0, 1), (2, 2), (3, 11)];
        let (piece, words, target_units) =
            degenerate_paired_row(&texts, &ranges, &units, "zh-Hans").unwrap();
        assert_eq!((piece, words), (2, 1), "{target_units}");

        // Not reported when every piece gets at least 3 words.
        let even = [(0, 2), (3, 6), (7, 11)];
        assert!(degenerate_paired_row(&texts, &even, &units, "zh-Hans").is_none());

        // Exempt when the sentence's total word count is insufficient to allocate (otherwise the requirement cannot be met, and it would only loop).
        let scarce = vec![2; 5];
        let tight = [(0, 1), (2, 2), (3, 4)];
        assert!(degenerate_paired_row(&texts, &tight, &scarce, "zh-Hans").is_none());

        // When the source interval is itself wide enough (long identifiers) and has two words, it is not treated as unbalanced: the 40% criterion lets it pass.
        let mut wide = vec![2; 12];
        wide[1] = 12;
        wide[2] = 12;
        let wide_pair = [(0, 0), (1, 2), (3, 11)];
        assert!(degenerate_paired_row(&texts, &wide_pair, &wide, "zh-Hans").is_none());

        // But single-word intervals get no width exemption: word-by-word highlighting takes only one step, so the visual break remains.
        let mut lone = vec![2; 12];
        lone[2] = 24;
        let (piece, words, _) = degenerate_paired_row(&texts, &ranges, &lone, "zh-Hans").unwrap();
        assert_eq!((piece, words), (2, 1));
    }

    /// Crossing detection with an expanded basis: pure-digit tokens and repeated tokens both take part, and the criterion is "the segment-number sets are disjoint" (the two patterns that R2 benchmark §4.4 showed were not detected by advisories).
    #[test]
    fn anchor_colocation_detects_numeric_and_repeated_tokens() {
        // Pure-digit anchors (the old basis required Latin letters, so this whole class was missed).
        let src = split_marked("Set it to 2048 | and the scheduler stops thrashing.");
        let tgt = split_marked("调度器就不再抖动， | 只要把它设为 2048。");
        let err = anchor_token_colocation("s-n", &src, &tgt).unwrap_err();
        assert!(err.contains("2048"), "{err}");

        // Repeated tokens: each side appears twice, but the segment-number sets are disjoint.
        let repeated_src = split_marked("token by token | we store each token.");
        let repeated_tgt = split_marked("我们逐 token 存储 | 每一个 token。");
        assert!(anchor_token_colocation("s-r", &repeated_src, &repeated_tgt).is_ok());
        // Repeated within the same segment (the old basis skipped anything with len != 1), while the translation lands in another segment.
        let crossed_src = split_marked("token by token we store | it in the paged cache.");
        let crossed_tgt = split_marked("我们把它放进分页缓存里， | 逐 token 地存。");
        let err = anchor_token_colocation("s-c", &crossed_src, &crossed_tgt).unwrap_err();
        assert!(err.contains("token"), "{err}");

        // The word-interval entry point (used by check's recomputation) applies the same criterion as direct calls.
        let words = ["Set", "it", "to", "2048", "and", "it", "stops"];
        let targets = vec![
            "调度器就不再抖动，".to_owned(),
            "只要把它设为 2048。".to_owned(),
        ];
        let issue = anchor_colocation_issue_for_ranges(&words, &targets, &[(0, 3), (4, 6)]);
        assert!(issue.is_some_and(|reason| reason.contains("2048")));
        // Nothing is reported beyond segment-number misalignment; out-of-range intervals safely return None.
        assert!(anchor_colocation_issue_for_ranges(&words, &targets, &[(0, 3), (4, 99)]).is_none());
    }

    /// P1-a fix two: decimals, version numbers and hyphenated identifiers must keep their shape intact.
    ///
    /// The old splitting cut on `[^0-9A-Za-z]+`, so `0.8` was broken into `0` and `8`, which `len >= 2` then removed. In configuration-type content such values are exactly the most reliable anchors, and this whole class went undetected.
    #[test]
    fn anchor_colocation_keeps_decimal_and_flag_token_shapes() {
        let src = split_marked("Set gpu_memory_utilization to 0.8 | before you serve the model.");
        let tgt = split_marked("在开始服务模型之前， | 把 gpu_memory_utilization 设为 0.8。");
        let err = anchor_token_colocation("s-d", &src, &tgt).unwrap_err();
        assert!(err.contains("0.8"), "{err}");

        // CLI flags work the same way: leading hyphens are stripped, and the identifier itself is not broken apart.
        let flag_src = split_marked("Pass --speculative-model v0.3 | to the server.");
        let flag_tgt = split_marked("传给服务端， | 用 --speculative-model v0.3。");
        let err = anchor_token_colocation("s-f", &flag_src, &flag_tgt).unwrap_err();
        assert!(
            err.contains("speculative-model") || err.contains("v0.3"),
            "{err}"
        );

        // A match within the same segment is still not reported (a sentence-final period should not turn one token into another token).
        let same_src = split_marked("We set it to 0.8 | and moved on.");
        let same_tgt = split_marked("我们把它设为 0.8 | 然后继续。");
        assert!(anchor_token_colocation("s-s", &same_src, &same_tgt).is_ok());
    }

    #[test]
    fn translated_glossary_anchor_is_a_provider_and_agent_hard_gate() {
        let source = "We write prompts every day to improve agent performance.";
        let source_words = source.split_whitespace().collect::<Vec<_>>();
        let sentence = Sentence {
            id: "s-anchor".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .enumerate()
                .map(|(index, text)| PendingWord {
                    text: (*text).to_owned(),
                    pause_before: 0,
                    t0: index as f64 * 0.3,
                    t1: (index + 1) as f64 * 0.3,
                    glue: false,
                })
                .collect(),
            translation: "我们每天编写提示词，来提升智能体性能。".to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: vec!["提示词".to_owned()],
            bilingual_anchors: vec![BilingualAnchor {
                source: "prompts".to_owned(),
                target: "提示词".to_owned(),
            }],
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let bad = r#"{"sentences":[{"key":"s-anchor","sourceBreaks":["b2"],"target":"我们每天编写提示词， | 来提升智能体性能。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", bad).unwrap();
        assert!(accepted.is_empty());
        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("bilingual anchor")),
            "{failures:?}"
        );

        let good = r#"{"sentences":[{"key":"s-anchor","sourceBreaks":["b3"],"target":"我们每天编写提示词， | 来提升智能体性能。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", good).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        assert!(accepted.contains_key("s-anchor"));
    }

    #[test]
    fn length_plan_uses_character_units_and_target_driven_counts() {
        let doc = doc_with_words(
            (0..37)
                .map(|index| {
                    w(
                        &format!("g1.{index}"),
                        index as f64 * 0.2,
                        (index + 1) as f64 * 0.2,
                        if index == 36 { "ending." } else { "word" },
                    )
                })
                .collect(),
        );
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 1);
        let words = sentences[0]
            .word_indices
            .iter()
            .map(|&index| PendingWord {
                text: doc.words[index].text.clone(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let item = Pending {
            sentence: &sentences[0],
            anchor_indices: sentences[0].word_indices.clone(),
            words,
            translation: "中".repeat(57),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let plan = length_plan(&item, &TransParams::for_lang("zh"), "en", "zh");
        // The piece count is driven by translation reading needs: 57 reading units with fit 16 to soft 14 ⇒ 4 to 5 pieces.
        assert_eq!(plan.piece_count.min, 4);
        assert_eq!(plan.piece_count.max, 5);
        assert_eq!(plan.piece_count.recommended, 4);
        // Unified character basis on the source side: 36 × "word" plus "ending" (the delivery projection strips the final punctuation) = 150 non-whitespace characters.
        assert_eq!(plan.source.unit, "character");
        assert_eq!(plan.source.total, 150);
        assert_eq!(plan.source.preferred_per_piece, [28, 47]);
        assert_eq!(plan.target.unit, "readingCharacter");
        assert_eq!(plan.target.total, 57);
        assert_eq!(plan.target.preferred_per_piece, [10, 18]);
        assert_eq!(length_unit_name("ja"), "readingCharacter");
        assert_eq!(length_unit_name("ko"), "character");
        assert_eq!(length_unit_name("en-US"), "character");

        // Many-to-one default shape: however long the source is, a compact translation still requires only at least 2 pieces by its own needs. The source length no longer raises the piece-count floor.
        let compact = Pending {
            sentence: item.sentence,
            anchor_indices: item.anchor_indices.clone(),
            words: item
                .words
                .iter()
                .map(|word| PendingWord {
                    text: word.text.clone(),
                    pause_before: word.pause_before,
                    t0: word.t0,
                    t1: word.t1,
                    glue: false,
                })
                .collect(),
            translation: "中".repeat(12),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let compact_plan = length_plan(&compact, &TransParams::for_lang("zh"), "en", "zh");
        assert_eq!(compact_plan.piece_count.min, 2);
        assert_eq!(compact_plan.piece_count.max, 2);
        assert_eq!(compact_plan.piece_count.recommended, 2);
    }

    fn pending_doc(word_count: usize) -> TranscriptDoc {
        doc_with_words(
            (0..word_count)
                .map(|index| {
                    w(
                        &format!("g1.{index}"),
                        index as f64 * 0.2,
                        (index + 1) as f64 * 0.2,
                        if index == word_count - 1 {
                            "ending."
                        } else {
                            "word"
                        },
                    )
                })
                .collect(),
        )
    }

    #[test]
    fn length_plan_never_advertises_fewer_than_two_pieces() {
        // Validation requires at least 2 pieces for every queued long sentence. The old algorithm gave min=1 for sentences that "visually exceed one line but whose reading units are ≤ fit", so the payload conflicted with the contract's hard rules.
        let doc = pending_doc(5);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let words = sentences[0]
            .word_indices
            .iter()
            .map(|&index| PendingWord {
                text: doc.words[index].text.clone(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let item = Pending {
            sentence: &sentences[0],
            anchor_indices: sentences[0].word_indices.clone(),
            words,
            translation: "很短的译句。".to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let plan = length_plan(&item, &TransParams::for_lang("zh"), "en", "zh");
        assert_eq!(plan.piece_count.min, 2);
        assert!(plan.piece_count.max >= 2);
        assert!(
            (plan.piece_count.min..=plan.piece_count.max).contains(&plan.piece_count.recommended)
        );
    }

    /// Engine rejection rules (AI pipeline design §10.3): a compliant two-piece answer is accepted; a single piece, or a translation that has drifted, is rejected.
    #[test]
    fn engine_rejection_rules_accept_shape_and_reject_drift() {
        let doc = pending_doc(8);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let words = sentences[0]
            .word_indices
            .iter()
            .map(|&index| PendingWord {
                text: doc.words[index].text.clone(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let item = Pending {
            sentence: &sentences[0],
            anchor_indices: sentences[0].word_indices.clone(),
            words,
            translation: "中".repeat(12),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let key = sentences[0].id.as_str();

        let engine_accepts = |answer: &str| {
            let (accepted, _salvaged, failures) =
                validate_batch_partial(&[&item], &params, "en", "zh", answer).unwrap();
            failures.is_empty() && accepted.contains_key(key)
        };

        // Compliant two pieces: the lint passes and the engine accepts.
        let good = format!(
            r#"{{"sentences":[{{"key":"{key}","sourceBreaks":["b4"],"target":"{} | {}"}}]}}"#,
            "中".repeat(6),
            "中".repeat(6)
        );
        assert!(engine_accepts(&good));

        // A single piece where all pieces are ≤ hard: the contract's hard rule is "at least two pieces", so both the lint and the engine reject it.
        let one_piece = format!(
            r#"{{"sentences":[{{"key":"{key}","sourceBreaks":[],"target":"{}"}}]}}"#,
            "中".repeat(12)
        );
        assert!(!engine_accepts(&one_piece));

        // Translation drift: rejected.
        let drifted = format!(
            r#"{{"sentences":[{{"key":"{key}","sourceBreaks":["b4"],"target":"改 | 写"}}]}}"#
        );
        assert!(!engine_accepts(&drifted));
    }

    /// Design §9.2 degradation: over-hard target pieces left by the LLM are split deterministically again within the same response, without triggering a repair call.
    #[test]
    fn over_hard_pieces_are_deterministically_resplit_on_acceptance() {
        let doc = pending_doc(8);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let words = sentences[0]
            .word_indices
            .iter()
            .map(|&index| PendingWord {
                text: doc.words[index].text.clone(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let item = Pending {
            sentence: &sentences[0],
            anchor_indices: sentences[0].word_indices.clone(),
            words,
            translation: format!("{}，{}。", "中".repeat(11), "文".repeat(11)),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        assert!(target_cps_chars(&item.translation, "zh") > params.hard);
        let key = sentences[0].id.as_str();
        let over_hard = format!(
            r#"{{"sentences":[{{"key":"{key}","sourceBreaks":[],"target":"{}"}}]}}"#,
            item.translation
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&item], &params, "en", "zh", &over_hard).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let entry = accepted.get(key).expect("over-hard answer is repaired");
        assert!(entry.texts.len() >= 2);
        assert!(
            entry
                .texts
                .iter()
                .all(|text| target_cps_chars(text, "zh") <= params.hard)
        );
    }

    #[test]
    fn dedicated_align_cannot_rewrite_a_frozen_fused_target() {
        let doc = two_sentence_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let sentence = &sentences[0];
        let item = Pending {
            sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: sentence
                .word_indices
                .iter()
                .map(|&index| PendingWord {
                    text: doc.words[index].text.clone(),
                    pause_before: 0,
                    t0: doc.words[index].t0,
                    t1: doc.words[index].t1,
                    glue: false,
                })
                .collect(),
            translation: "第一段译文需要自然对应，第二段译文负责完整收尾。".to_owned(),
            existing: None,
            frozen_target: Some(vec![
                "第一段译文需要自然对应，".to_owned(),
                "第二段译文负责完整收尾。".to_owned(),
            ]),
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let changed = r#"{"sentences":[{"key":"s-g1.0","sourceBreaks":["b5"],"target":"第一段译文需要自然对应，第二段 | 译文负责完整收尾。"}]}"#;
        let (_, _, failures) =
            validate_batch_partial(&[&item], &params, "en", "zh", changed).unwrap();
        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("data-target-frozen")),
            "{failures:?}"
        );

        let unchanged = r#"{"sentences":[{"key":"s-g1.0","sourceBreaks":["b5"],"target":"第一段译文需要自然对应， | 第二段译文负责完整收尾。"}]}"#;
        let (accepted, _, failures) =
            validate_batch_partial(&[&item], &params, "en", "zh", unchanged).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        assert!(accepted.contains_key("s-g1.0"));
    }

    #[test]
    fn protected_glossary_target_cannot_be_split_by_engine() {
        let doc = pending_doc(8);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let words = sentences[0]
            .word_indices
            .iter()
            .map(|&index| PendingWord {
                text: doc.words[index].text.clone(),
                pause_before: 0,
                t0: 0.0,
                t1: 0.0,
                glue: false,
            })
            .collect();
        let item = Pending {
            sentence: &sentences[0],
            anchor_indices: sentences[0].word_indices.clone(),
            words,
            translation: "这段自然对应内容需要完整保留。".to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: vec!["自然对应".to_owned()],
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let key = sentences[0].id.as_str();
        let bad = format!(
            r#"{{"sentences":[{{"key":"{key}","sourceBreaks":["b4"],"target":"这段自然 | 对应内容需要完整保留。"}}]}}"#
        );

        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&item], &params, "en", "zh", &bad).unwrap();
        assert!(!accepted.contains_key(key));
        assert!(
            failures.iter().any(|failure| failure.contains("自然对应")),
            "{failures:?}"
        );
    }

    #[test]
    fn seam_lint_rejects_cut_inside_paired_delimiter() {
        // s-g4.16 regression: a piece ending in an unclosed opening quote must go back for repair, not be treated as a mere advisory.
        let translation = "包含名为“PluginDataJSON”的清单。";
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 3,
                text: "包含名为“".to_owned(),
            },
            PieceJson {
                from: 4,
                to: 7,
                text: "PluginDataJSON”的清单。".to_owned(),
            },
        ];
        let error = validate_pieces(
            "s-g4.16",
            &pieces,
            8,
            translation,
            "zh",
            &TransParams::for_lang("zh"),
        )
        .unwrap_err();
        let LlmError::Malformed(detail) = error else {
            panic!("expected Malformed, got {error:?}");
        };
        assert!(detail.contains("paired delimiter"), "{detail}");
        assert!(detail.contains("包含名为“"), "{detail}");

        // An answer whose quotes are complete within one piece must pass.
        let good = vec![
            PieceJson {
                from: 0,
                to: 1,
                text: "包含".to_owned(),
            },
            PieceJson {
                from: 2,
                to: 7,
                text: "名为“PluginDataJSON”的清单。".to_owned(),
            },
        ];
        validate_pieces(
            "s-g4.16",
            &good,
            8,
            translation,
            "zh",
            &TransParams::for_lang("zh"),
        )
        .expect("intact quoted span must be accepted");
    }

    #[test]
    fn seam_lint_rejects_dangling_connective_with_piece_text() {
        // G3 baseline lesson: dangling tails and clinging heads are objective defects. As advisories, weak workers would reliably store them, so they must go back for repair, with the concrete piece text in the problems.
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 3,
                text: "这一段工具和".to_owned(),
            },
            PieceJson {
                from: 4,
                to: 7,
                text: "方法需要完整收尾。".to_owned(),
            },
        ];
        let error = validate_pieces(
            "s-x",
            &pieces,
            8,
            "这一段工具和方法需要完整收尾。",
            "zh",
            &TransParams::for_lang("zh"),
        )
        .unwrap_err();
        let LlmError::Malformed(detail) = error else {
            panic!("expected Malformed, got {error:?}");
        };
        assert!(detail.contains("dangling"), "{detail}");
        assert!(detail.contains("这一段工具和"), "{detail}");
    }

    #[test]
    fn worker_flash_fragment_is_merged_deterministically_with_ranges() {
        // A two-character fragment "really" can safely merge into a neighbour: a deterministic merge (3 → 2 pieces), with the source intervals synchronised by union. No further merging when there are ≤2 pieces, to keep the split commitment.
        let pieces = vec![
            ("真的".to_owned(), (0_usize, 1_usize)),
            ("我们的交互经常".to_owned(), (2, 4)),
            ("分散在不同工具之间。".to_owned(), (5, 7)),
        ];
        let repaired = repair_flash_pieces_with_ranges(pieces, "zh", &TransParams::for_lang("zh"));
        assert_eq!(repaired.len(), 2);
        assert_eq!(repaired[0].0, "真的我们的交互经常");
        assert_eq!(repaired[0].1, (0, 4));
        assert_eq!(repaired[1].1, (5, 7));

        let two = vec![
            ("真的".to_owned(), (0_usize, 1_usize)),
            ("我们的交互经常分散在不同工具之间。".to_owned(), (2, 7)),
        ];
        let kept = repair_flash_pieces_with_ranges(two, "zh", &TransParams::for_lang("zh"));
        assert_eq!(kept.len(), 2);
    }

    #[test]
    fn batch_partial_merges_worker_flash_fragment() {
        let source_words: Vec<String> = (0..8).map(|index| format!("word{index}")).collect();
        let sentence = Sentence {
            id: "s-flash".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source_words.join(" "),
            src_fingerprint: "test".to_owned(),
        };
        let item = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words: source_words
                .iter()
                .map(|text| PendingWord {
                    text: text.clone(),
                    pause_before: 0,
                    t0: 0.0,
                    t1: 0.0,
                    glue: false,
                })
                .collect(),
            translation: "而且我们的交互经常分散在不同工具之间。".to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let answer = r#"{"sentences":[{"key":"s-flash","sourceBreaks":["b2","b5"],"target":"而且 | 我们的交互经常 | 分散在不同工具之间。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&item], &params, "en", "zh", answer).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        let entry = accepted.get("s-flash").expect("accepted");
        assert_eq!(entry.texts.len(), 2, "{:?}", entry.texts);
        assert_eq!(entry.texts[0], "而且我们的交互经常");
        assert!(
            entry
                .advisories
                .iter()
                .all(|advisory| !advisory.contains("flash")),
            "{:?}",
            entry.advisories
        );
        let AcceptedAnchor::WordRanges(ranges) = &entry.anchor else {
            panic!("expected word ranges");
        };
        assert_eq!(ranges.len(), 2);
        assert_eq!(ranges[0], (0, 4));
    }

    #[test]
    fn seam_lint_rejects_bound_head_and_bigram_tail() {
        // “similar to | …” matches in both directions: the bigram tail of the front piece plus the clinging head of the back piece.
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 3,
                text: "并行化，与前文类似".to_owned(),
            },
            PieceJson {
                from: 4,
                to: 7,
                text: "于我们的深度研究工作流；".to_owned(),
            },
        ];
        let error = validate_pieces(
            "s-y",
            &pieces,
            8,
            "并行化，与前文类似于我们的深度研究工作流；",
            "zh",
            &TransParams::for_lang("zh"),
        )
        .unwrap_err();
        assert!(matches!(error, LlmError::Malformed(_)), "{error:?}");
        // “so, therefore” at the start is a legal conjunction and must not be falsely flagged.
        let ok = vec![
            PieceJson {
                from: 0,
                to: 3,
                text: "我们先跑通了流程，".to_owned(),
            },
            PieceJson {
                from: 4,
                to: 7,
                text: "于是决定继续推进。".to_owned(),
            },
        ];
        validate_pieces(
            "s-z",
            &ok,
            8,
            "我们先跑通了流程，于是决定继续推进。",
            "zh",
            &TransParams::for_lang("zh"),
        )
        .expect("于是 opening is a legal connective");
    }

    #[test]
    fn balance_lint_does_not_split_parallel_items_at_list_separator() {
        // 7/16: the widest piece only has enumeration-comma parallel items that can be cut. “persuade, win” is a complete parallel structure, and `说服、|取胜` must not be manufactured just to balance numbers.
        let translation = "我们常常被教导，要带着说服、取胜的心态去对话，真的。";
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 3,
                text: "我们常常被教导，".to_owned(),
            },
            PieceJson {
                from: 4,
                to: 19,
                text: "要带着说服、取胜的心态去对话，真的。".to_owned(),
            },
        ];
        let result = validate_pieces(
            "s-x",
            &pieces,
            20,
            translation,
            "zh",
            &TransParams::for_lang("zh"),
        );
        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn balance_lint_passes_when_wide_piece_has_no_internal_seam() {
        // A wide piece with no internal minor clause seam (word-order crossing or a whole block phrase) is not forcibly split.
        let translation = "你想想看，这相当于每天抽十五支烟对健康的损害总和。";
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 1,
                text: "你想想看，".to_owned(),
            },
            PieceJson {
                from: 2,
                to: 19,
                text: "这相当于每天抽十五支烟对健康的损害总和。".to_owned(),
            },
        ];
        validate_pieces(
            "s-x",
            &pieces,
            20,
            translation,
            "zh",
            &TransParams::for_lang("zh"),
        )
        .unwrap();
    }

    #[test]
    fn claude_code_intro_keeps_bound_phrase_and_uses_word_ranges() {
        let translation =
            "我是 Claude Code 的创始工程师之一，今天很高兴和大家聊聊如何不再时刻盯着你的智能体。";
        let pieces = vec![
            PieceJson {
                from: 0,
                to: 8,
                text: "我是 Claude Code 的创始工程师之一，".to_owned(),
            },
            PieceJson {
                from: 9,
                to: 20,
                text: "今天很高兴和大家聊聊".to_owned(),
            },
            PieceJson {
                from: 21,
                to: 28,
                text: "如何不再时刻盯着你的智能体。".to_owned(),
            },
        ];
        validate_pieces(
            "s-g1.7",
            &pieces,
            29,
            translation,
            "zh",
            &TransParams::for_lang("zh"),
        )
        .unwrap();
        assert_eq!(target_cps_chars(&pieces[0].text, "zh"), 15);
        assert!(!pieces.iter().any(|piece| piece.text == "智能体。"));
    }

    #[test]
    fn transport_errors_propagate_instead_of_falling_back() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = FakeLlm::new([Err(LlmError::Terminal("401".to_owned()))]);
        let result = run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {});
        assert!(matches!(result, Err(LlmError::Terminal(_))));
        assert!(doc.trans_align.is_empty());
    }

    #[test]
    fn sentence_filter_and_force_are_respected() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let mut options = opts(AlignMode::ManyToOne);
        options.sentences = Some(BTreeSet::from(["s-g2.0".to_owned()]));
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert!(llm.calls.is_empty());
        assert_eq!(outcome.aligned_sentences, 0);
        assert_eq!(outcome.skipped_sentences, 1); // Single-Cue sentence

        // force: re-split even when a valid entry exists; independent depends on neither source Cues nor the LLM.
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());
        let mut options = opts(AlignMode::Independent);
        run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        options.force = true;
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
    }

    #[test]
    fn projected_alignment_persists_and_refreshes_visible_word_anchors() {
        let mut doc = two_sentence_doc();
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), "首尾。".to_owned());
        let mut visible = BTreeMap::from([(
            "s-g1.0".to_owned(),
            vec!["g1.0".to_owned(), "g1.7".to_owned()],
        )]);
        let mut options = opts(AlignMode::ManyToOne);
        options.sentences = Some(BTreeSet::from(["s-g1.0".to_owned()]));
        let mut llm = FakeLlm::ok(std::iter::empty::<&'static str>());

        let outcome =
            run_align_projected(&mut doc, &mut llm, &options, &visible, &mut |_| {}).unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.words, ["g1.0", "g1.7"]);
        assert_eq!(entry.pieces[0].from, Some(0));
        assert_eq!(entry.pieces[0].to, Some(1));

        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream[0].word_span, Some((0, 7)));

        visible.insert(
            "s-g1.0".to_owned(),
            vec!["g1.0".to_owned(), "g1.6".to_owned(), "g1.7".to_owned()],
        );
        let outcome =
            run_align_projected(&mut doc, &mut llm, &options, &visible, &mut |_| {}).unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(
            doc.trans_align["zh"]["s-g1.0"].words,
            ["g1.0", "g1.6", "g1.7"]
        );
        assert!(llm.calls.is_empty());
    }

    /// Full translate → align chain: sentence-level truth is persisted, the split overlay covers it, the projection can be expanded, and after an edit only the edited sentence becomes dirty.
    #[test]
    fn translate_then_align_round_trip() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::ok([
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">第一段译文需要自然对应，第二段译文负责完整收尾。</p><p id=\"s-g2.0\">完成。</p></section></article>",
            GOOD_ALIGN_RESPONSE,
        ]);
        let translate_options = TranslateOptions {
            source_lang: "en".to_owned(),
            lang: "zh".to_owned(),
            force: false,
            sentences: None,
            page_budget: crate::paging::budgets::TRANSLATE_PROVIDER_WORDS,
            instructions: None,
            analysis: None,
            brief: None,
            tone: None,
            autocorrect: true,
            align: None,
            align_rows: false,
            align_lines: false,
            worker_slots: None,
            provenance_stale: BTreeSet::new(),
        };
        run_translate(
            &mut doc,
            &mut llm,
            &translate_options,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.skipped_sentences, 1);

        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 3); // Sentence 1 has two pieces; sentence 2 is a whole sentence.
        assert!(stream.iter().all(|cue| !cue.fallback));
        assert!(crate::sentence::stale_sentences(&doc, "zh", &sentences).is_empty());

        // Editing one word in sentence 1 ⇒ only sentence 1 becomes stale. The transAlign entry stays valid, because the structure snapshot is unchanged and the concatenation invariant still holds (staleness of the translation is guarded by transSrc).
        doc.words[2].text = "charlee".to_owned();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let stale = crate::sentence::stale_sentences(&doc, "zh", &sentences);
        assert_eq!(stale.into_iter().collect::<Vec<_>>(), vec!["s-g1.0"]);
    }

    #[test]
    fn paired_density_requires_target_natural_split_and_matches_agent_lint() {
        let source = "And we'd turn the loop off, and because we had to constantly update the skill, we had to constantly check out the branch, change the skill, change the code, commit, and push.";
        let source_words = source.split_whitespace().collect::<Vec<_>>();
        let sentence = Sentence {
            id: "s-loop".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words = source_words
            .iter()
            .enumerate()
            .map(|(index, text)| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: index as f64 * 0.3,
                t1: (index + 1) as f64 * 0.3,
                glue: false,
            })
            .collect();
        let translation =
            "我们会关闭循环，因为得不断更新技能、检出分支、改技能、改代码、提交再推送。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let bad = r#"{"sentences":[{"key":"s-loop","sourceBreaks":["b6","b23"],"target":"我们会关闭循环， | 因为得不断更新技能、检出分支、 | 改技能、改代码、提交再推送。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", bad).unwrap();
        assert!(accepted.is_empty());
        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("over-dense")),
            "{failures:?}"
        );

        let good = r#"{"sentences":[{"key":"s-loop","sourceBreaks":["b6","b15","b23"],"target":"我们会关闭循环， | 因为得不断更新技能、 | 检出分支、 | 改技能、改代码、提交再推送。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", good).unwrap();
        assert!(failures.is_empty(), "{failures:?}");
        assert!(accepted.contains_key("s-loop"));

        assert_eq!(
            paired_balance_seam("GitLab、CircleCI 或其他工具", "zh"),
            None,
            "ordinary product-name lists must not be split by the coordinated-action rule"
        );
        assert_eq!(
            paired_balance_seam("控制器、执行器", "zh"),
            None,
            "device-name lists must not be split just because a name contains a verb"
        );
        assert_eq!(
            paired_balance_seam("实际操作中，因为我们用的是智能体，", "zh"),
            None,
            "a fronted adverbial must not be treated as a full clause"
        );
        assert!(
            paired_balance_seam("你有一个控制器，它读取测得的误差，", "zh").is_some(),
            "a full clause with a predicate should still keep the paired-density cut point"
        );
    }

    /// Constructs a single-piece scenario: `words` source words each take `per_word_units` units, and the row spans a fixed `span` seconds, so that the width tier and the duration tier can be pinned separately.
    fn ceiling_case(
        target: &str,
        words: usize,
        per_word_units: usize,
        span: f64,
    ) -> Vec<SourceCeilingIssue> {
        let source_units = vec![per_word_units; words];
        let step = span / words as f64;
        let ends: Vec<f64> = (1..=words).map(|index| index as f64 * step).collect();
        source_ceiling_issues(
            &[target.to_owned()],
            &[(0, words - 1)],
            &source_units,
            &ends,
            42,
            "zh",
        )
    }

    #[test]
    fn source_ceiling_fires_only_past_one_and_a_half_lines() {
        let target = "这条译文足够长可以再切一刀";
        // An unseamed, over-wide source row (95 units) must be reported.
        let issues = ceiling_case(target, 95, 1, 5.0);
        assert_eq!(issues.len(), 1, "{issues:?}");
        assert_eq!(issues[0].index, 0);
        assert_eq!(issues[0].units, 95);
        // Boundary check: source_piece_hard(42) = 63. 64 is reported, 63 is not. The coefficient is pinned down.
        assert_eq!(
            ceiling_case(target, 64, 1, 5.0).len(),
            1,
            "64 units should hit the hard tier"
        );
        assert!(
            ceiling_case(target, 63, 1, 5.0).is_empty(),
            "63 units just miss the hard tier"
        );
        // The duration tier is independent of width: 40 units (compliant) spanning 8s is still reported, but spanning 5s is not.
        assert!(
            ceiling_case(target, 40, 1, 5.0).is_empty(),
            "40 units at 5.0s should not be reported"
        );
        let slow = ceiling_case(target, 40, 1, 8.0);
        assert_eq!(
            slow.len(),
            1,
            "40 units at 8.0s should hit the duration hard tier"
        );
        // The target piece is too short (9 units): further splitting would only produce fragmented lines, so nothing is reported.
        assert!(
            ceiling_case("这条译文偏短了一点", 95, 1, 5.0).is_empty(),
            "target piece < 10 units must not trigger the hard tier"
        );
        // Fewer than 4 source words: no usable cut point, so nothing is reported.
        assert!(
            ceiling_case(target, 3, 30, 5.0).is_empty(),
            "source words < 4 must not trigger the hard tier"
        );
    }

    #[test]
    fn source_ceiling_blocks_the_draft_but_never_rejects_the_answer() {
        let source = "Every engineer on the platform team keeps their own separate working context around all week and nobody ever ends up stepping on anyone else's ongoing work at all";
        let source_words = source.split_whitespace().collect::<Vec<_>>();
        let sentence = Sentence {
            id: "s-wide".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words: Vec<PendingWord> = source_words
            .iter()
            .enumerate()
            .map(|(index, text)| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: index as f64 * 0.5,
                t1: (index + 1) as f64 * 0.5,
                glue: false,
            })
            .collect();
        // Neither of the two translation pieces has an internal minor clause seam: the soft tier (paired_density_issue) necessarily does not hit. Only the newly added hard tier can.
        let translation = "每个工程师整周都保留自己的独立上下文，谁也不会碰到别人正在做的工作。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        // b15: the natural seam after the source word "week" and before the conjunction "and". The left piece has 15 words × 0.5s = 7.5s, crossing the 6.0s hard tier (its width is over the line too).
        let cut = 15usize;
        let pieces = vec![
            (
                "每个工程师整周都保留自己的独立上下文，".to_owned(),
                (0usize, cut - 1),
            ),
            (
                "谁也不会碰到别人正在做的工作。".to_owned(),
                (cut, source_words.len() - 1),
            ),
        ];
        let draft = draft_from_pieces(&pending, pieces, &params, "en", "zh", &source_words);
        assert!(
            draft
                .blockers
                .iter()
                .any(|blocker| blocker.contains("past the paired-row ceiling")),
            "the draft gate must report the source-line hard ceiling: {:?}",
            draft.blockers
        );
        assert!(!draft.ready);

        // When the same split is submitted as a model answer, the engine acceptance and the submit-time lint must both pass it. The contract allows "keep the row whole if there is no legal cut point", and rejecting it at either place would only trade for a deterministic fallback.
        let answer = format!(
            r#"{{"sentences":[{{"key":"s-wide","sourceBreaks":["b{cut}"],"target":"每个工程师整周都保留自己的独立上下文， | 谁也不会碰到别人正在做的工作。"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", &answer).unwrap();
        assert!(
            failures.is_empty(),
            "engine acceptance must not reject on hard tiers: {failures:?}"
        );
        assert!(accepted.contains_key("s-wide"));
        // The public wrapper used by the post-hoc check: the same entry should still be reported, so that refine-align can fix it in a targeted way.
        let units = source_word_units(&pending.words, "en");
        let ends = source_word_ends_sec(&pending.words);
        let issues = source_ceiling_issues_for_ranges(
            &[
                "每个工程师整周都保留自己的独立上下文，".to_owned(),
                "谁也不会碰到别人正在做的工作。".to_owned(),
            ],
            &[(0, cut - 1), (cut, source_words.len() - 1)],
            &units,
            &ends,
            "en",
            "zh",
        );
        assert!(
            !issues.is_empty(),
            "the public check-side wrapper must report the same item"
        );
    }

    /// Fragment trap test: source rows that are **too narrow** rise and fall together with those that are too wide. The draft gate reports them, the public check wrapper reports them, and engine acceptance and the submit-time lint let them pass. The material comes from the measured Jeff Dean shape (a translation piece attached to two-word fragments such as "batch jobs").
    #[test]
    fn source_fragment_blocks_the_draft_but_never_rejects_the_answer() {
        let source = "I mean, we ended up building a completely separate scheduler";
        let source_words = source.split_whitespace().collect::<Vec<_>>();
        let sentence = Sentence {
            id: "s-crumb".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words: Vec<PendingWord> = source_words
            .iter()
            .enumerate()
            .map(|(index, text)| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: index as f64 * 0.5,
                t1: (index + 1) as f64 * 0.5,
                glue: false,
            })
            .collect();
        let translation = "我的意思是，我们最终单独搭了一套调度器。";
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        // The first piece is attached only to the two source words "I mean," (5 display units, below the en floor of 10), and the translation piece itself has only 5 units. It falls exactly into the double-exemption blind spot of source_ceiling_issues (fewer than 4 source words, fewer than 10 target units), where the hard-cap channel can never see it.
        let cut = 2usize;
        let texts = [
            "我的意思是，".to_owned(),
            "我们最终单独搭了一套调度器。".to_owned(),
        ];
        let ranges = [(0usize, cut - 1), (cut, source_words.len() - 1)];
        let pieces = vec![(texts[0].clone(), ranges[0]), (texts[1].clone(), ranges[1])];
        let draft = draft_from_pieces(&pending, pieces, &params, "en", "zh", &source_words);
        assert!(
            draft
                .blockers
                .iter()
                .any(|blocker| blocker.contains("under the paired-row floor")),
            "the draft gate must report the source-line floor: {:?}",
            draft.blockers
        );
        assert!(!draft.ready);

        // When the same split is submitted as a model answer, the engine acceptance and the submit-time lint must both pass it. Fragments share the same nature as the hard cap, "report and drive targeted re-alignment". Rejecting them at either place would only burn the single global repair call and trade it for a semantically blind deterministic fallback.
        let answer = format!(
            r#"{{"sentences":[{{"key":"s-crumb","sourceBreaks":["b{cut}"],"target":"我的意思是， | 我们最终单独搭了一套调度器。"}}]}}"#
        );
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", &answer).unwrap();
        assert!(
            failures.is_empty(),
            "engine acceptance must not reject on fragments: {failures:?}"
        );
        assert!(accepted.contains_key("s-crumb"));
        // The public wrapper used by the post-hoc check: the same entry should still be reported, so that refine-align can fix it in a targeted way.
        let units = source_word_units(&pending.words, "en");
        let issues = source_fragment_issues_for_ranges(&texts, &ranges, &units, "en", "zh");
        assert_eq!(
            issues.len(),
            1,
            "the public check-side wrapper must report the same item"
        );
        assert_eq!(issues[0].index, 0);
        assert_eq!(issues[0].words, 2);
    }

    /// Exemptions are narrowed, never deleted: single-piece sentences, sentences whose word count is too small for allocation, source pieces that are wide enough in themselves, and pieces within the territory of the degenerate channel (wide translation paired with narrow source) must not be reported.
    #[test]
    fn source_fragment_exemptions_stay_narrow_but_present() {
        let units_of = |words: &[&str]| -> Vec<usize> {
            words
                .iter()
                .map(|text| target_cps_chars(text, "en"))
                .collect()
        };
        let (source_fit, _) = source_piece_budgets("en");
        assert_eq!(source_fragment_floor(source_fit), 10);

        // 1. A single-piece sentence: that piece is the whole sentence, so there is no fragment.
        let words = ["We", "ended", "up", "here"];
        assert!(
            source_fragment_issues(
                &["我们到此为止。".to_owned()],
                &[(0, 3)],
                &units_of(&words),
                source_fit,
                "zh",
            )
            .is_empty()
        );

        // 2. Sentence source word count below pieces × 3: reporting it would only fall back to the deterministic fallback.
        let short = ["So", "we", "left", "it"];
        assert!(
            source_fragment_issues(
                &["所以，".to_owned(), "我们就放着了。".to_owned()],
                &[(0, 1), (2, 3)],
                &units_of(&short),
                source_fit,
                "zh",
            )
            .is_empty(),
            "a whole sentence with only 4 words in 2 pieces must not be reported"
        );

        // 3. A wide enough source piece: "high performance." (two words, 15 units) is a normal many-to-one.
        let wide = [
            "It",
            "was",
            "built",
            "from",
            "scratch",
            "for",
            "very",
            "high",
            "performance.",
        ];
        assert!(
            source_fragment_issues(
                &["它是为了".to_owned(), "极高性能".to_owned()],
                &[(0, 6), (7, 8)],
                &units_of(&wide),
                source_fit,
                "zh",
            )
            .is_empty(),
            "a two-word source piece whose display width meets the target is not a fragment"
        );

        // 4. Target piece ≥ DEGENERATE_TARGET_MIN_UNITS: that is the territory of degenerate_paired_row (including its audited 40% width exemption), and the two channels must not both report the same piece.
        let crumb = [
            "And", "again", "thanks", "so", "much", "for", "coming", "in", "today",
        ];
        let texts = [
            "再次非常感谢你今天过来。".to_owned(),
            "非常感谢。".to_owned(),
        ];
        assert!(
            source_fragment_issues(
                &texts,
                &[(0, 1), (2, 8)],
                &units_of(&crumb),
                source_fit,
                "zh"
            )
            .is_empty(),
            "a wide translation piece paired with a narrow source is the degenerate channel; the fragment channel must not take its territory"
        );
        // With the same material but a narrow translation piece, the fragment channel must claim it.
        let owned = ["再来一次，".to_owned(), "非常感谢你今天过来。".to_owned()];
        let issues = source_fragment_issues(
            &owned,
            &[(0, 1), (2, 8)],
            &units_of(&crumb),
            source_fit,
            "zh",
        );
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].index, 0);
    }

    /// The contract text must share a source with the detection threshold: the source-side floor in `align_system_prompt_file` is rendered directly from `source_fragment_floor` and must not be hard-coded.
    #[test]
    fn align_prompt_states_source_role_and_floor() {
        let params = TransParams::for_lang("zh");
        let prompt = align_system_prompt_file(&params, "en", None, &[]);
        assert!(
            prompt.contains(
                "Never translate, paraphrase, summarize, or copy any `td.tgt` text into `td.src`"
            ),
            "{prompt}"
        );
        assert!(
            prompt.contains("The source side also has a FLOOR"),
            "{prompt}"
        );
        assert!(
            prompt.contains(
                "2 or fewer source words whose combined width is under 10 source characters"
            ),
            "{prompt}"
        );
        // For zh source, use a quarter of 16. The threshold follows the language budget.
        let zh = align_system_prompt_file(&params, "zh", None, &[]);
        assert!(zh.contains("under 4 source characters"), "{zh}");
    }

    /// Same material as `source_ceiling_blocks_the_draft_but_never_rejects_the_answer`: the source-row hard cap itself does not reject, but making the worst over-limit row worse must be rejected. The deterministic draft constructed for `Pending` is b15 (worst source row 78 units / 7.5s), consistent with the payload of that pinning test.
    fn ceiling_regression_pending() -> (Sentence, Vec<PendingWord>, &'static str) {
        let source = "Every engineer on the platform team keeps their own separate working context around all week and nobody ever ends up stepping on anyone else's ongoing work at all";
        let source_words = source.split_whitespace().collect::<Vec<_>>();
        let sentence = Sentence {
            id: "s-wide".to_owned(),
            cue_ids: Vec::new(),
            cue_indices: Vec::new(),
            word_indices: (0..source_words.len()).collect(),
            source_text: source.to_owned(),
            src_fingerprint: "test".to_owned(),
        };
        let words: Vec<PendingWord> = source_words
            .iter()
            .enumerate()
            .map(|(index, text)| PendingWord {
                text: (*text).to_owned(),
                pause_before: 0,
                t0: index as f64 * 0.5,
                t1: (index + 1) as f64 * 0.5,
                glue: false,
            })
            .collect();
        (
            sentence,
            words,
            "每个工程师整周都保留自己的独立上下文，谁也不会碰到别人正在做的工作。",
        )
    }

    /// The live case s-g123.0: the worker adds a cut at the start of the sentence to meet the piece count, worsening the worst paired source row from the draft's 78 units / 7.5s to 122 units / 13.0s. Engine acceptance must reject it.
    #[test]
    fn source_ceiling_net_regression_is_rejected_by_the_engine() {
        let (sentence, words, translation) = ceiling_regression_pending();
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        // b2 is a legal cut point labelled seam1 in the payload. The only possible reason for rejection is net regression, and it will not be pre-empted by a risky cut point or the density soft tier.
        let answer = r#"{"sentences":[{"key":"s-wide","sourceBreaks":["b2"],"target":"每个工程师整周都保留自己的独立上下文， | 谁也不会碰到别人正在做的工作。"}]}"#;
        let (accepted, salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", answer).unwrap();
        assert!(
            accepted.is_empty(),
            "a net-regressing answer must not be accepted: {accepted:?}"
        );
        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("worse than the incoming draft's worst row")),
            "{failures:?}"
        );
        // Salvage tier exemption: the rescue channel can still stand in for `fallback_word_entry`, and the guardrail must not widen the exposure of the deterministic fallback.
        assert!(
            salvaged.contains_key("s-wide"),
            "the salvage tier must still accept this answer: {salvaged:?}"
        );
    }

    /// The guardrail prevents regression only, not idling: an answer that is equal in width to the draft (here `sourceBreaks` identical to the draft) must pass.
    #[test]
    fn source_ceiling_guardrail_passes_equal_width_answers() {
        let (sentence, words, translation) = ceiling_regression_pending();
        let pending = Pending {
            sentence: &sentence,
            anchor_indices: sentence.word_indices.clone(),
            words,
            translation: translation.to_owned(),
            existing: None,
            frozen_target: None,
            protected_terms: Vec::new(),
            bilingual_anchors: Vec::new(),
            source_cue_keys: Vec::new(),
        };
        let params = TransParams::for_lang("zh");
        let same = r#"{"sentences":[{"key":"s-wide","sourceBreaks":["b15"],"target":"每个工程师整周都保留自己的独立上下文， | 谁也不会碰到别人正在做的工作。"}]}"#;
        let (accepted, _salvaged, failures) =
            validate_batch_partial(&[&pending], &params, "en", "zh", same).unwrap();
        assert!(
            failures.is_empty(),
            "an equal-width answer must not be rejected by the guardrail: {failures:?}"
        );
        assert!(accepted.contains_key("s-wide"));
    }

    /// The boundary of the criterion itself: it takes effect only on the dimension where the incumbent already exceeds the limit, and rejects only when strictly greater.
    #[test]
    fn source_ceiling_regression_only_fires_on_dimensions_the_draft_already_broke() {
        let issue = |units: usize, seconds: f64| SourceCeilingIssue {
            index: 0,
            units,
            seconds,
            target_units: 20,
            words: 10,
        };
        // Draft width already over the limit (70 > 63), answer wider ⇒ rejected.
        assert!(source_ceiling_regression(&[issue(110, 8.6)], 70, 5.6, 42, 3).is_some());
        // Equal width ⇒ passes.
        assert!(source_ceiling_regression(&[issue(70, 5.6)], 70, 5.6, 42, 3).is_none());
        // Draft width is clean (60 < 63): this round was not dispatched for the width dimension, so even a wider answer is not rejected.
        assert!(source_ceiling_regression(&[issue(120, 5.0)], 60, 5.0, 42, 3).is_none());
        // The duration dimension is independent: the draft's 7.0s already exceeds 6.0s, and an answer of 9.0s ⇒ rejected.
        assert!(source_ceiling_regression(&[issue(50, 9.0)], 50, 7.0, 42, 3).is_some());
        // When the answer does not exceed the limit, `source_ceiling_issues` is empty ⇒ structurally not triggered.
        assert!(source_ceiling_regression(&[], 70, 5.6, 42, 3).is_none());
    }

    // -----------------------------------------------------------------
    // file-v1 (HTML table carrier) end to end
    // -----------------------------------------------------------------

    /// One `<tbody data-sid>` group; `attrs` are concatenated directly onto the opening tag.
    fn tgroup(sid: &str, attrs: &str, rows: &[(&str, &str)]) -> String {
        let mut out = format!("  <tbody data-sid=\"{sid}\"{attrs}>\n");
        for (source, target) in rows {
            out.push_str(&format!(
                "    <tr><td class=\"src\">{source}</td><td class=\"tgt\">{target}</td></tr>\n"
            ));
        }
        out.push_str("  </tbody>\n");
        out
    }

    fn ttable(groups: &[String]) -> String {
        format!("<table>\n{}</table>\n", groups.concat())
    }

    /// s-g1.0's "good answer": two rows, with the source side falling exactly on the echo,^foxtrot seam.
    fn good_align_table() -> String {
        ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                (
                    "alpha bravo charlie delta echo,",
                    "第一段译文需要自然对应，",
                ),
                ("foxtrot golf hotel.", "第二段译文负责完整收尾。"),
            ],
        )])
    }

    fn file_llm<I: IntoIterator<Item = String>>(script: I) -> FakeLlm {
        FakeLlm::new(script.into_iter().map(Ok))
    }

    /// Collects (page_id, attempt, accepted, number of problem codes) from the `on_attempt` artifacts.
    #[derive(Debug, Default)]
    struct Artifacts {
        pages: Vec<(String, u32, bool, usize)>,
        inputs: Vec<String>,
        outputs: Vec<String>,
    }

    #[test]
    fn file_contract_maps_table_rows_to_source_word_ranges() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = file_llm([good_align_table()]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 0);

        // The carrier is an HTML table, not a JSON payload.
        let (kind, system, user, _) = &llm.calls[0];
        assert_eq!(kind, "align");
        assert!(user.starts_with("<table data-lang=\"zh\""), "{user}");
        assert!(user.contains("data-ccut-format=\"align-table/1\""));
        assert!(user.contains("data-sid=\"s-g1.0\""));
        assert!(user.contains(
            "<td class=\"src\">alpha bravo charlie delta echo, foxtrot golf hotel.</td>"
        ));
        // Seconds, source Cue boundaries and absolute timestamps do not enter the carrier (§8.2). Apart from the sentence id there are no word ids at all (the source column is plain visible text).
        assert!(!user.contains("q-g1."), "{user}");
        assert!(!user.contains("sourceWords"), "{user}");
        assert!(!user.contains("seconds"), "{user}");
        assert!(!user.contains("\"sentences\""));
        assert!(!user.contains("sourceBreaks"));
        assert!(system.contains("return the SAME table"));
        assert!(!system.contains("sourceBreaks"));

        // Semantically equivalent to json-v0: the same two pieces and the same word intervals.
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.mode, AlignMode::ManyToOne);
        assert_eq!(entry.pieces.len(), 2);
        assert_eq!(entry.pieces[0].text, "第一段译文需要自然对应，");
        assert_eq!(entry.pieces[0].from, Some(0));
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].text, "第二段译文负责完整收尾。");
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.pieces[1].to, Some(7));
        assert_eq!(entry.words.first().map(String::as_str), Some("g1.0"));
        assert_eq!(entry.words.last().map(String::as_str), Some("g1.7"));

        // Final invariant (§2): concatenation equals the sentence-level translation truth, and the intervals cover continuously.
        let cues = derive_cues(&doc, &CueParams::default());
        let sentence = derive_sentences(&doc, &cues)
            .into_iter()
            .find(|item| item.id == "s-g1.0")
            .expect("sentence");
        assert!(align_entry_valid(
            &doc,
            &sentence,
            &doc.trans["zh"]["s-g1.0"],
            entry
        ));
    }

    #[test]
    fn file_contract_emits_one_artifact_per_batch_attempt() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = file_llm([good_align_table()]);
        let mut artifacts = Artifacts::default();
        run_align_with_artifacts(
            &mut doc,
            &mut llm,
            &opts(AlignMode::ManyToOne),
            &mut |attempt| {
                artifacts.pages.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.len(),
                ));
                artifacts.inputs.push(attempt.input.to_owned());
                artifacts.outputs.push(attempt.output.to_owned());
            },
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(artifacts.pages, vec![("b001".to_owned(), 1, true, 0)]);
        // The input in the artifact is exactly the payload text that was actually sent.
        assert_eq!(artifacts.inputs[0], llm.calls[0].2);
        assert_eq!(artifacts.outputs[0], good_align_table());
    }

    #[test]
    fn file_contract_repairs_source_drift_and_emits_a_repair_artifact() {
        let mut doc = with_translations(two_sentence_doc());
        // The source column is read-only: changing a word ⇒ source-drift ⇒ the whole sentence does not enter acceptance and goes to a repair round.
        let drifted = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                (
                    "alpha bravo charlie whiskey echo,",
                    "第一段译文需要自然对应，",
                ),
                ("foxtrot golf hotel.", "第二段译文负责完整收尾。"),
            ],
        )]);
        let mut llm = file_llm([drifted, good_align_table()]);
        let mut pages: Vec<(String, u32, bool)> = Vec::new();
        let outcome = run_align_with_artifacts(
            &mut doc,
            &mut llm,
            &opts(AlignMode::ManyToOne),
            &mut |attempt| {
                pages.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                ));
            },
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(llm.calls.len(), 2);
        assert_eq!(
            pages,
            vec![("b001".to_owned(), 1, false), ("r001".to_owned(), 2, true)]
        );
        // The repair round's retry_reason restates the problems in table vocabulary, without mentioning JSON fields.
        let reason = llm.calls[1].3.as_deref().expect("retry reason");
        assert!(reason.contains("source-drift"), "{reason}");
        assert!(reason.contains("rows min="), "{reason}");
        assert!(!reason.contains("sourceBreaks"), "{reason}");
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 0);
        assert_eq!(doc.trans_align["zh"]["s-g1.0"].pieces.len(), 2);
    }

    #[test]
    fn file_contract_missing_group_is_rejected_before_acceptance() {
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = file_llm(["<table>\n</table>\n".to_owned(), good_align_table()]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 2);
        assert_eq!(outcome.aligned_sentences, 1);
    }

    #[test]
    fn file_contract_over_hard_row_is_recut_instead_of_rejected() {
        // Key contract: over-hard pieces and bad seams are **quality codes**, not rejection codes. In json-v0 they go through deterministic re-splitting and the Recut / KeepWhole / Salvage tiers. file-v1 must follow the same basis. Otherwise the new carrier would be stricter than the old one and would also burn the only global repair round.
        let mut doc = with_translations(two_sentence_doc());
        let whole = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[(
                "alpha bravo charlie delta echo, foxtrot golf hotel.",
                "第一段译文需要自然对应，第二段译文负责完整收尾。",
            )],
        )]);
        let mut llm = file_llm([whole]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();

        // Only that first-round call: no repair round was triggered.
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 0);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert!(entry.pieces.len() >= 2, "{:?}", entry.pieces);
        let params = TransParams::for_lang("zh");
        for piece in &entry.pieces {
            assert!(
                target_cps_chars(&piece.text, "zh") <= params.hard,
                "{:?}",
                piece.text
            );
        }
    }

    #[test]
    fn file_contract_illegal_seam_is_judged_by_the_shared_acceptance_core() {
        // The other half of `problem_blocks_acceptance`: at the carrier level, a bad seam is a **quality code** and is not rejected at parse time. The verdict belongs to the single shared acceptance core `accept_answers`, which gives the rejection reason for the dangling conjunction “and”. The carrier level does not re-judge it.
        fn dangling_doc() -> TranscriptDoc {
            let mut doc = two_sentence_doc();
            doc.trans.entry("zh".to_owned()).or_default().insert(
                "s-g1.0".to_owned(),
                "我们砍掉了付费营销和自建的渠道团队。".to_owned(),
            );
            doc
        }
        const SEAM_VERDICT: &str = "ends on a dangling connective";

        let table = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                ("alpha bravo charlie delta echo,", "我们砍掉了付费营销和"),
                ("foxtrot golf hotel.", "自建的渠道团队。"),
            ],
        )]);
        let mut file_llm_calls = file_llm([table.clone(), table]);
        run_align(
            &mut dangling_doc(),
            &mut file_llm_calls,
            &opts(AlignMode::ManyToOne),
            &mut |_| {},
        )
        .unwrap();

        // The repair-round reason comes from the shared acceptance core.
        assert_eq!(file_llm_calls.calls.len(), 2);
        let file_reason = file_llm_calls.calls[1].3.as_deref().expect("file reason");
        assert!(file_reason.contains(SEAM_VERDICT), "{file_reason}");
        // The carrier level did not report align-illegal-seam a second time.
        assert_eq!(
            file_reason.matches(SEAM_VERDICT).count(),
            1,
            "{file_reason}"
        );
        assert!(!file_reason.contains("align-illegal-seam"), "{file_reason}");
    }

    #[test]
    fn file_contract_rejects_reordered_rewrite_beyond_the_drift_guard() {
        let mut doc = with_translations(two_sentence_doc());
        // data-reordered allows the translation to be rewritten, but the rewrite magnitude is constrained by the ±max(25%, 4) unit guardrail (the same arithmetic as `split::reordered_rewrite_exceeds`).
        let bloated = ttable(&[tgroup(
            "s-g1.0",
            " data-reordered=\"true\"",
            &[
                (
                    "alpha bravo charlie delta echo,",
                    "第一段译文需要自然对应，",
                ),
                (
                    "foxtrot golf hotel.",
                    "第二段译文负责完整收尾，并且额外补上了一大段原文里根本不存在的解释性内容。",
                ),
            ],
        )]);
        let mut llm = file_llm([bloated, good_align_table()]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 2);
        let reason = llm.calls[1].3.as_deref().expect("retry reason");
        assert!(reason.contains("align-content-drift"), "{reason}");
        assert_eq!(outcome.aligned_sentences, 1);
        // What is stored is the unrewritten translation from the repair round.
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.pieces[1].text, "第二段译文负责完整收尾。");
    }

    #[test]
    fn file_contract_accepts_a_declared_crossing_group() {
        let mut doc = with_translations(two_sentence_doc());
        let crossing = ttable(&[tgroup(
            "s-g1.0",
            " data-crossing=\"true\"",
            &[
                (
                    "alpha bravo charlie delta echo,",
                    "第一段译文需要自然对应，",
                ),
                ("foxtrot golf hotel.", "第二段译文负责完整收尾。"),
            ],
        )]);
        let mut llm = file_llm([crossing]);
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        // A self-reported crossing ⇒ best-effort: keep the model's two rows and source cut points (block-alignment design §4.5 revision), and do not degrade to one whole-sentence piece.
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.pieces.len(), 2);
        assert_ne!(entry.correspondence(), Correspondence::Sentence);
    }

    #[test]
    fn file_contract_carries_unsplittable_back_into_the_repair_round() {
        let mut doc = with_translations(two_sentence_doc());
        // First round: self-reports unsplittable but also changed the source text ⇒ judged a failure, goes into the repair round.
        let declared = ttable(&[tgroup(
            "s-g1.0",
            " data-unsplittable=\"true\"",
            &[(
                "alpha bravo charlie whiskey echo, foxtrot golf hotel.",
                "第一段译文需要自然对应，第二段译文负责完整收尾。",
            )],
        )]);
        let mut llm = file_llm([declared, good_align_table()]);
        run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(llm.calls.len(), 2);
        assert!(
            !llm.calls[0].2.contains("data-unsplittable"),
            "the first round does not carry it back"
        );
        assert!(
            llm.calls[1].2.contains("data-unsplittable=\"true\""),
            "{}",
            llm.calls[1].2
        );
    }

    #[test]
    fn file_contract_shares_the_bilingual_anchor_gate() {
        // The P1 root-cause fix (overlapping-anchor disambiguation) and the bilingual anchor same-segment check both live in the single acceptance core, so file-v1 uses the same criteria: a source cut in the middle of an anchor word ⇒ rejected.
        let mut doc = with_translations(two_sentence_doc());
        let mut options = opts(AlignMode::ManyToOne);
        options.bilingual_anchors = vec![
            BilingualAnchor {
                source: "delta echo,".to_owned(),
                target: "自然对应".to_owned(),
            },
            // An overlapping short anchor: intersects the source interval above and is shorter ⇒ disambiguated and abstains, so it does not take part in judgment.
            BilingualAnchor {
                source: "echo,".to_owned(),
                target: "完整收尾".to_owned(),
            },
        ];
        let mut llm = file_llm([good_align_table()]);
        let outcome = run_align(&mut doc, &mut llm, &options, &mut |_| {}).unwrap();
        // If the short anchor had not abstained, it would pin the "complete ending" (piece 2) onto source piece 1 and falsely report a mispair. Once disambiguation takes effect, this answer passes cleanly in one call.
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(doc.trans_align["zh"]["s-g1.0"].pieces.len(), 2);
    }

    #[test]
    fn file_contract_pins_the_piece_count_budget_from_the_length_plan() {
        // P2: the piece count of frozen sentences is pinned by `length_plan`, and both carriers share the same source. The file carrier writes it into `data-budget`, and does **not** carry seconds or the fused draft.
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = file_llm([good_align_table()]);
        run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        let user = &llm.calls[0].2;
        assert!(
            user.contains("data-budget=\"每行≤16字，建议2片\""),
            "{user}"
        );
        assert!(!user.contains("draft"), "{user}");
    }

    #[test]
    fn file_contract_source_column_uses_the_shared_marker_thresholds() {
        // Pause tiers must come from `engines::markers` (0.6 / 1.0 / 1.8), not from the private thresholds in align.rs that serve the json-v0 payload.
        let mut doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha"),
            w("g1.1", 0.4, 0.8, "bravo"),
            w("g1.2", 0.8, 1.2, "charlie"),
            w("g1.3", 1.2, 1.6, "delta"),
            w("g1.4", 1.6, 2.0, "echo,"),
            // A 0.7s pause ⇒ tier one; the tier-one threshold in markers is 0.6.
            w("g1.5", 2.7, 3.1, "foxtrot"),
            w("g1.6", 3.1, 3.5, "golf"),
            w("g1.7", 3.5, 3.9, "hotel."),
            w("g2.0", 4.1, 4.5, "Done."),
        ]);
        doc = with_translations(doc);
        let mut llm = file_llm([good_align_table()]);
        run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        let user = &llm.calls[0].2;
        assert!(user.contains("echo, ⏸ foxtrot"), "{user}");
        assert!(!user.contains("⏸⏸"), "{user}");
        // The Unicode category of ⏸ is OtherSymbol, and `normalize_chars` strips it. So source segments the model returns without markers still match, and strip_markers is not needed.
        assert_eq!(doc.trans_align["zh"]["s-g1.0"].pieces.len(), 2);
    }

    #[test]
    fn file_contract_lint_and_engine_share_one_string_level_checker() {
        // §2 "validation exists in only one place": the submit-time lint parses AlignTableInput back out of the payload HTML, then calls exactly the same `parse_align_table` as the engine.
        let mut doc = with_translations(two_sentence_doc());
        let mut llm = file_llm([good_align_table()]);
        run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        let payload = &llm.calls[0].2;
        assert!(lint_agent_answer_file(payload, &good_align_table()).is_empty());
        let drifted = ttable(&[tgroup(
            "s-g1.0",
            "",
            &[
                (
                    "alpha bravo charlie whiskey echo,",
                    "第一段译文需要自然对应，",
                ),
                ("foxtrot golf hotel.", "第二段译文负责完整收尾。"),
            ],
        )]);
        let problems = lint_agent_answer_file(payload, &drifted);
        assert!(
            problems.iter().any(|item| item.contains("source-drift")),
            "{problems:?}"
        );
        // Payloads that are not align tables (old task directories, or a different kind) are never blocked.
        assert!(lint_agent_answer_file("{\"sentences\":[]}", &drifted).is_empty());
    }

    /// file-v1 end to end: translate (HTML `section>p`) → align (HTML table). The `trans` truth, the `transAlign` split and word intervals, and the derived projection all hold together.
    #[test]
    fn file_contract_translate_then_align_end_to_end() {
        let mut doc = two_sentence_doc();
        let mut llm = FakeLlm::ok([
            "<article><section id=\"p-g1.0\"><p id=\"s-g1.0\">第一段译文需要自然对应，第二段译文负责完整收尾。</p><p id=\"s-g2.0\">完成。</p></section></article>",
            GOOD_ALIGN_RESPONSE,
        ]);
        let translate_options = TranslateOptions {
            source_lang: "en".to_owned(),
            lang: "zh".to_owned(),
            force: false,
            sentences: None,
            page_budget: crate::paging::budgets::TRANSLATE_PROVIDER_WORDS,
            instructions: None,
            analysis: None,
            brief: None,
            tone: None,
            autocorrect: true,
            align: None,
            align_rows: false,
            align_lines: false,
            worker_slots: None,
            provenance_stale: BTreeSet::new(),
        };
        run_translate(
            &mut doc,
            &mut llm,
            &translate_options,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let outcome =
            run_align(&mut doc, &mut llm, &opts(AlignMode::ManyToOne), &mut |_| {}).unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.skipped_sentences, 1);
        assert_eq!(outcome.fallback_sentences, 0);
        assert!(!doc.trans_align["zh"].contains_key("s-g2.0"));

        // The derived projection holds (`transAlign` is an overlay, and Cues are expanded from it).
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 3);
        assert!(stream.iter().all(|cue| !cue.fallback));
        let sentence = sentences
            .iter()
            .find(|item| item.id == "s-g1.0")
            .expect("sentence");
        assert!(align_entry_valid(
            &doc,
            sentence,
            &doc.trans["zh"]["s-g1.0"],
            &doc.trans_align["zh"]["s-g1.0"]
        ));
    }

    #[test]
    fn file_contract_fused_translate_draft_skips_the_align_call() {
        let mut doc = two_sentence_doc();
        doc.words[7].t1 = 8.0;
        doc.words[8].t0 = 8.2;
        doc.words[8].t1 = 8.6;
        let mut llm = FakeLlm::ok([concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\"><span data-src=\"1-5\">第一段译文需要自然对应，</span><span data-src=\"6-8\">第二段译文负责完整收尾。</span></p>",
            "<p id=\"s-g2.0\">完成。</p>",
            "</section></article>",
        )]);
        let translate_options = TranslateOptions {
            source_lang: "en".to_owned(),
            lang: "zh".to_owned(),
            force: false,
            sentences: None,
            page_budget: crate::paging::budgets::TRANSLATE_PROVIDER_WORDS,
            instructions: None,
            analysis: None,
            brief: None,
            tone: None,
            autocorrect: true,
            align: Some(TransParams::for_lang("zh")),
            align_rows: false,
            align_lines: false,
            worker_slots: None,
            provenance_stale: BTreeSet::new(),
        };
        let translated = run_translate(
            &mut doc,
            &mut llm,
            &translate_options,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(translated.alignment_drafts.len(), 1);
        let (_, system, user, _) = &llm.calls[0];
        assert!(system.contains("Fused block alignment"), "{system}");
        assert!(
            user.contains("data-align-words=\"[1]alpha [2]bravo"),
            "{user}"
        );
        // Span is transparent to the translation: what is stored is the complete natural translated sentence.
        assert_eq!(
            doc.trans["zh"]["s-g1.0"],
            "第一段译文需要自然对应，第二段译文负责完整收尾。"
        );

        let outcome = run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &translated.alignment_drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.prealigned_sentences, 1);
        assert_eq!(
            llm.calls.len(),
            1,
            "after the fused draft is accepted, the align worker must not be called again"
        );
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.pieces.len(), 2);
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.correspondence, Some(Correspondence::Block));
        assert_eq!(entry.aligner.as_deref(), Some(LLM_CHUNK_ALIGNER_TAG));
        assert!(entry.blocks.len() >= 2, "{entry:#?}");
    }

    // ---- Fused row partition (`--align-fusion rows`) -------------------------------

    /// Deterministic grouping: source-side Cue row boundaries, plus clause punctuation, plus cuts at pauses of ≥ 0.35s. Small groups merge into adjacent groups. Groups of more than 5s or more than 14 words are re-split at their largest internal pause. Zero LLM, zero randomness.
    #[test]
    fn fusion_groups_reuse_source_rows_then_apply_local_rules() {
        // A 16-word sentence: index 4 ends with a comma, and index 8 is preceded by a 0.6s pause.
        let mut words = Vec::new();
        let mut clock = 0.0f64;
        for index in 0..16 {
            if index == 8 {
                clock += 0.6;
            }
            let text = match index {
                4 => "data,".to_owned(),
                15 => "service.".to_owned(),
                _ => format!("w{index}"),
            };
            words.push(w(&format!("g1.{index}"), clock, clock + 0.4, &text));
            clock += 0.4;
        }
        let doc = doc_with_words(words);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let sentence = &sentences[0];

        let info = fusion_line_info(&doc, &cues, sentence, true);
        assert_eq!(info.source_words.len(), 16);
        // The groups are contiguous, seamless, and cover the whole sentence exactly.
        let mut expected = 0usize;
        for group in &info.groups {
            assert_eq!(group.from, expected, "{:?}", info.groups);
            assert!(group.to >= group.from);
            assert!(group.t1_ds >= group.t0_ds);
            expected = group.to + 1;
        }
        assert_eq!(expected, 16);
        // Comma seams and pause seams both become group boundaries.
        let starts: Vec<usize> = info.groups.iter().map(|group| group.from).collect();
        assert!(starts.contains(&5), "{starts:?}");
        assert!(starts.contains(&8), "{starts:?}");
        // The first group starts at the sentence head, and its times are zeroed relative to the sentence start.
        assert_eq!(info.groups[0].t0_ds, 0);

        // With `with_groups=false` (`on` mode), no grouping is computed at all.
        assert!(
            fusion_line_info(&doc, &cues, sentence, false)
                .groups
                .is_empty()
        );
    }

    fn rows_translate_options() -> TranslateOptions {
        TranslateOptions {
            source_lang: "en".to_owned(),
            lang: "zh".to_owned(),
            force: false,
            sentences: None,
            page_budget: crate::paging::budgets::TRANSLATE_PROVIDER_WORDS,
            instructions: None,
            analysis: None,
            brief: None,
            tone: None,
            autocorrect: true,
            align: Some(TransParams::for_lang("zh")),
            align_rows: true,
            align_lines: false,
            worker_slots: None,
            provenance_stale: BTreeSet::new(),
        }
    }

    fn rows_doc() -> TranscriptDoc {
        let mut doc = two_sentence_doc();
        doc.words[7].t1 = 8.0;
        doc.words[8].t0 = 8.2;
        doc.words[8].t1 = 8.6;
        doc
    }

    /// rows end to end: the translate hint carries the row-partition contract plus `data-align-groups`. When the answer gives a qualifying row partition, no align call is dispatched at all. Entries take `llm-rows+anchor/1`, and each piece's text equals its span text row by row.
    #[test]
    fn file_contract_fused_row_draft_skips_the_align_call() {
        let mut doc = rows_doc();
        let mut llm = FakeLlm::ok([concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\"><span data-src=\"1-5\">第一段译文需要自然对应，</span>",
            "<span data-src=\"6-8\">第二段译文负责完整收尾。</span></p>",
            "<p id=\"s-g2.0\">完成。</p>",
            "</section></article>",
        )]);
        let translated = run_translate(
            &mut doc,
            &mut llm,
            &rows_translate_options(),
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();

        let (_, system, user, _) = &llm.calls[0];
        assert!(system.contains("Fused display rows"), "{system}");
        assert!(!system.contains("Fused block alignment"), "{system}");
        // Tuning from the second round of A/B testing: favour merging, since rows cut too finely push the cps>6 ratio up. Reading speed is quantified. The zh TransParams are fit 16 / hard 20.
        assert!(
            system.contains("AIM FOR 10 to 16 display units per row"),
            "{system}"
        );
        assert!(system.contains("under 6 display units"), "{system}");
        assert!(
            system.contains("at most 6, and the row must last at least 1s"),
            "{system}"
        );
        assert!(system.contains("NEVER above 20"), "{system}");
        assert!(user.contains("data-align-groups=\""), "{user}");
        // A reminder at the end of the payload: on long documents the system contract gets diluted (measured: of 59 sentences, only 3 were annotated).
        assert!(user.contains("Reminder: answer with"), "{user}");
        assert!(user.trim_end().ends_with("display rows."), "{user}");
        assert_eq!(translated.alignment_drafts.len(), 1);
        assert!(translated.alignment_drafts["s-g1.0"].rows);
        assert_eq!(translated.rows_off_group_sentences, 0);
        assert_eq!(
            doc.trans["zh"]["s-g1.0"],
            "第一段译文需要自然对应，第二段译文负责完整收尾。"
        );

        let outcome = run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &translated.alignment_drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.prealigned_sentences, 1);
        assert_eq!(
            llm.calls.len(),
            1,
            "after row-partition acceptance, the align worker must not be called again"
        );

        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.aligner.as_deref(), Some(LLM_ROWS_ALIGNER_TAG));
        assert_eq!(entry.correspondence, Some(Correspondence::Block));
        assert_eq!(entry.text_basis, TextBasis::Trans);
        assert_eq!(
            entry
                .pieces
                .iter()
                .map(|piece| piece.text.as_str())
                .collect::<Vec<_>>(),
            ["第一段译文需要自然对应，", "第二段译文负责完整收尾。"]
        );
        assert_eq!(entry.pieces[0].from, Some(0));
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.pieces[1].to, Some(7));
        let sentences = derive_sentences(&doc, &derive_cues(&doc, &CueParams::default()));
        let sentence = sentences.iter().find(|item| item.id == "s-g1.0").unwrap();
        assert!(crate::align_block::validate_blocks(
            entry,
            sentence.word_indices.len()
        ));
    }

    /// The second block of a lines draft is 30 characters, over hard 20, while its cut points are allowed ⇒ no rewrite round is dispatched. Instead, one more cut is made inside the block at a seam that is clean under lint, producing `llm-lines+split/1`: three pieces, with the first piece and the model's cut points kept as they are, and no align call at all.
    #[test]
    fn file_contract_lines_draft_splits_an_over_hard_block_in_place() {
        let mut doc = rows_doc();
        let long = "第二段译文负责完整收尾这一块写得太长超过了二十个字。";
        let mut llm = FakeLlm::new([Ok(format!(
            "1 |alpha..echo,|第一段译文需要自然对应，|foxtrot..hotel.|{long}\n2 |Done.|完成。\n"
        ))]);
        let mut options = rows_translate_options();
        options.align_rows = false;
        options.align_lines = true;
        let translated =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();
        assert_eq!(
            doc.trans["zh"]["s-g1.0"],
            format!("第一段译文需要自然对应，{long}")
        );
        let outcome = run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &translated.alignment_drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.calls.len(),
            1,
            "in-block splits do not dispatch a rewrite round: {:#?}",
            outcome.violations
        );
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(
            entry.aligner.as_deref(),
            Some(LLM_LINES_SPLIT_ALIGNER_TAG),
            "{:#?}",
            outcome.violations
        );
        assert_eq!(entry.pieces.len(), 3, "{entry:#?}");
        assert_eq!(entry.pieces[0].text, "第一段译文需要自然对应，");
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(
            entry
                .pieces
                .iter()
                .map(|piece| piece.text.as_str())
                .collect::<String>(),
            doc.trans["zh"]["s-g1.0"]
        );
        assert!(
            outcome.violations.iter().any(|line| line
                .contains("1 over-hard block(s) split in place at 1 character-level seam(s)")),
            "{:#?}",
            outcome.violations
        );
    }

    /// lines end to end: the translation page is `lines/1` plain text (kind `translate-lines`), and the end of the system prompt carries the carrier syntax rather than the HTML fusion section. The first and last references of the answer are jointly located as block evidence ⇒ no align call is dispatched, entries take `llm-lines+anchor/1`, and each piece's text equals the answer's block text block by block.
    #[test]
    fn file_contract_lines_draft_skips_the_align_call() {
        let mut doc = rows_doc();
        let mut llm = FakeLlm::ok([concat!(
            "1 |alpha..echo,|第一段译文需要自然对应，|foxtrot..hotel.|第二段译文负责完整收尾。\n",
            "2 |Done.|完成。\n",
        )]);
        let mut options = rows_translate_options();
        options.align_rows = false;
        options.align_lines = true;
        let translated =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();

        let (kind, system, user, _) = &llm.calls[0];
        assert_eq!(kind, "translate-lines");
        assert!(system.contains("lines/1, mode=blocks"), "{system}");
        assert!(
            system.contains("plain-text page in the lines/1 format"),
            "{system}"
        );
        assert!(!system.contains("Fused display rows"), "{system}");
        assert!(!system.contains("<span data-src>"), "{system}");
        assert!(
            user.starts_with("! format=lines/1 mode=blocks row=16 target=zh\n"),
            "{user}"
        );
        assert!(user.contains("\n1 ≤"), "{user}");
        assert!(
            user.contains("alpha bravo charlie delta echo, foxtrot golf hotel."),
            "{user}"
        );
        assert!(!user.contains("<article"), "{user}");
        assert_eq!(translated.alignment_drafts.len(), 2);
        let draft = &translated.alignment_drafts["s-g1.0"];
        assert!(draft.chunks.is_empty() && !draft.rows);
        let lines = draft.lines.as_ref().expect("lines draft");
        assert_eq!(lines.record.text(), doc.trans["zh"]["s-g1.0"]);
        assert_eq!(lines.source_words.len(), 8);
        assert_eq!(
            doc.trans["zh"]["s-g1.0"],
            "第一段译文需要自然对应，第二段译文负责完整收尾。"
        );

        let outcome = run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &translated.alignment_drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.prealigned_sentences, 1);
        assert_eq!(
            llm.calls.len(),
            1,
            "after the row-text draft is accepted, the align worker must not be called again"
        );

        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.aligner.as_deref(), Some(LLM_LINES_ALIGNER_TAG));
        assert_eq!(entry.correspondence, Some(Correspondence::Block));
        assert_eq!(
            entry
                .pieces
                .iter()
                .map(|piece| piece.text.as_str())
                .collect::<Vec<_>>(),
            ["第一段译文需要自然对应，", "第二段译文负责完整收尾。"]
        );
        assert_eq!(entry.pieces[0].from, Some(0));
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.pieces[1].to, Some(7));
    }

    /// A lines draft takes effect only when the word table the carrier sees matches this round's anchored words. If they differ (the final timeline trimmed words), it is treated as no draft, and the sentence goes to a dedicated round as usual.
    #[test]
    fn a_lines_draft_whose_words_do_not_match_falls_back_to_pending() {
        let mut doc = rows_doc();
        let mut llm = FakeLlm::ok([
            "1 |alpha..echo,|第一段译文需要自然对应，|foxtrot..hotel.|第二段译文负责完整收尾。\n2 |Done.|完成。\n",
        ]);
        let mut options = rows_translate_options();
        options.align_rows = false;
        options.align_lines = true;
        let translated =
            run_translate(&mut doc, &mut llm, &options, &mut |_| {}, &mut |_| {}).unwrap();
        let mut drafts = translated.alignment_drafts.clone();
        drafts
            .get_mut("s-g1.0")
            .unwrap()
            .lines
            .as_mut()
            .unwrap()
            .source_words
            .pop();

        let outcome = run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &drafts,
            &mut |_| {},
            &mut |_| {},
        );
        // The FakeLlm script is exhausted: the dedicated round was actually dispatched (and failed as a result).
        assert!(outcome.is_err());
        assert_eq!(llm.calls.len(), 2);
    }

    /// Merging happens only within a sentence. Two sentences each carry the same three-row draft, and each merges only its own short rows. Piece source intervals never cross sentences (`plan_sentence_rows` is called per sentence, with no shared state between sentences).
    #[test]
    fn short_row_merging_never_crosses_a_sentence_boundary() {
        // Each sentence has 6 words and a translation of 17 units (> fit 16, so it is necessarily queued). Rows are [2 / 0.5s], [5 / 1.0s], [10 / 2.0s]. The first row triggers a merge, and 7 units / 1.5s after merging is legal.
        let spans = [
            (0.0, 0.5),
            (0.5, 1.0),
            (1.0, 1.5),
            (1.5, 2.5),
            (2.5, 3.0),
            (3.0, 3.5),
        ];
        let mut words = Vec::new();
        for (sentence, base) in [(1usize, 0.0f64), (2, 20.0)] {
            for (index, &(t0, t1)) in spans.iter().enumerate() {
                let text = if index + 1 == spans.len() {
                    "end.".to_owned()
                } else {
                    format!("word{index}")
                };
                words.push(w(
                    &format!("g{sentence}.{index}"),
                    base + t0,
                    base + t1,
                    &text,
                ));
            }
        }
        let mut doc = doc_with_words(words);
        let rows = ["甲乙", "丙丁戊己庚", "辛壬癸子丑寅卯辰巳午"];
        let translation: String = rows.concat();
        let table = doc.trans.entry("zh".to_owned()).or_default();
        for id in ["s-g1.0", "s-g2.0"] {
            table.insert(id.to_owned(), translation.clone());
        }

        let draft = FusionDraft {
            chunks: [
                (rows[0], vec![0]),
                (rows[1], vec![1, 2]),
                (rows[2], vec![3, 4, 5]),
            ]
            .into_iter()
            .map(|(text, ordinals)| AlignChunk {
                text: text.to_owned(),
                ordinals,
            })
            .collect(),
            rows: true,
            on_groups: true,
            lines: None,
        };
        let drafts: FusionDrafts = ["s-g1.0", "s-g2.0"]
            .into_iter()
            .map(|id| (id.to_owned(), draft.clone()))
            .collect();

        let mut llm = file_llm([]);
        let outcome = run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.calls.len(),
            0,
            "both sentences take the row pass-through; no align call should be dispatched"
        );
        assert_eq!(outcome.prealigned_sentences, 2);
        // The first row of each sentence is merged once, and the merge count accumulates per sentence.
        assert_eq!(outcome.rows_merged, 2);

        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 2);
        for sentence in &sentences {
            let entry = &doc.trans_align["zh"][&sentence.id];
            assert_eq!(entry.aligner.as_deref(), Some(LLM_ROWS_ALIGNER_TAG));
            // Three rows merge into two pieces, and the piece source intervals cover only this sentence's 6 words.
            assert_eq!(
                entry
                    .pieces
                    .iter()
                    .map(|piece| piece.text.as_str())
                    .collect::<Vec<_>>(),
                ["甲乙丙丁戊己庚", "辛壬癸子丑寅卯辰巳午"],
                "{}",
                sentence.id
            );
            assert_eq!(entry.pieces[0].from, Some(0));
            assert_eq!(entry.pieces[0].to, Some(2));
            assert_eq!(entry.pieces[1].from, Some(3));
            assert_eq!(entry.pieces[1].to, Some(5));
            assert_eq!(entry.words.len(), sentence.word_indices.len());
            // At the block level it is still the model's three-row correspondence.
            assert_eq!(entry.blocks.len(), 3);
            assert!(crate::align_block::validate_blocks(
                entry,
                sentence.word_indices.len()
            ));
        }
    }

    /// If the row partition does not qualify (gaps in the ordinals), there is no direct row pass-through. The draft is downgraded to an ordinary block draft, still accepted by the deterministic check of `on` mode, and the entry takes `llm-chunk+anchor/1`.
    #[test]
    fn a_malformed_row_draft_falls_back_to_the_plain_chunk_path() {
        let mut doc = rows_doc();
        let mut llm = FakeLlm::ok([concat!(
            "<article><section id=\"p-g1.0\">",
            "<p id=\"s-g1.0\"><span data-src=\"1-4\">第一段译文需要自然对应，</span>",
            "<span data-src=\"6-8\">第二段译文负责完整收尾。</span></p>",
            "<p id=\"s-g2.0\">完成。</p>",
            "</section></article>",
        )]);
        let translated = run_translate(
            &mut doc,
            &mut llm,
            &rows_translate_options(),
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(translated.alignment_drafts.len(), 1);
        assert!(
            !translated.alignment_drafts["s-g1.0"].rows,
            "index 5 is not covered"
        );

        run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &translated.alignment_drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            doc.trans_align["zh"]["s-g1.0"].aligner.as_deref(),
            Some(LLM_CHUNK_ALIGNER_TAG),
            "a failing row partition must not write row labels"
        );
    }

    /// In rows mode, if the model gave no row annotation at all, there is no draft, and that sentence dispatches an `align-edges` round as usual.
    #[test]
    fn a_rows_answer_without_spans_still_dispatches_the_align_call() {
        let mut doc = rows_doc();
        let mut llm = file_llm([
            concat!(
                "<article><section id=\"p-g1.0\">",
                "<p id=\"s-g1.0\">第一段译文需要自然对应，第二段译文负责完整收尾。</p>",
                "<p id=\"s-g2.0\">完成。</p>",
                "</section></article>",
            )
            .to_owned(),
            ttable(&[egroup(
                "s-g1.0",
                &[
                    ("1-5", "第一段译文需要自然对应，"),
                    ("6-8", "第二段译文负责完整收尾。"),
                ],
            )]),
        ]);
        let translated = run_translate(
            &mut doc,
            &mut llm,
            &rows_translate_options(),
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert!(translated.alignment_drafts.is_empty());

        run_align_with_drafts_and_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &translated.alignment_drafts,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.calls.len(),
            2,
            "without a draft, must fall back to the align-edges round"
        );
        assert_ne!(
            doc.trans_align["zh"]["s-g1.0"].aligner.as_deref(),
            Some(LLM_ROWS_ALIGNER_TAG)
        );
    }

    // ---- Block-alignment-edges carrier (align-edges/1 / align-rewrite/1) --------------------

    /// Two sentences: sentence 1 has a causal inversion (translation word order crosses; dwell over 7s forces it into the queue). Sentence 2 is monotonic with three clauses (translation over fit).
    fn edges_doc() -> TranscriptDoc {
        let mut words = Vec::new();
        for (index, text) in ["I", "didn't", "go", "because", "I", "was", "sick."]
            .into_iter()
            .enumerate()
        {
            words.push(w(
                &format!("g1.{index}"),
                index as f64 * 1.2,
                index as f64 * 1.2 + 1.0,
                text,
            ));
        }
        for (index, text) in [
            "We", "first", "analyze", "the", "data,", "then", "train", "the", "model,", "and",
            "finally", "deploy", "the", "service.",
        ]
        .into_iter()
        .enumerate()
        {
            words.push(w(
                &format!("g2.{index}"),
                10.0 + index as f64 * 0.4,
                10.0 + index as f64 * 0.4 + 0.4,
                text,
            ));
        }
        let mut doc = doc_with_words(words);
        let table = doc.trans.entry("zh".to_owned()).or_default();
        table.insert("s-g1.0".to_owned(), "因为我病了，所以没去。".to_owned());
        table.insert(
            "s-g2.0".to_owned(),
            "我们先分析数据，然后训练模型，最后部署服务。".to_owned(),
        );
        doc
    }

    fn egroup(sid: &str, spans: &[(&str, &str)]) -> String {
        let mut out = format!(
            "  <tbody data-sid=\"{sid}\"><tr><th scope=\"rowgroup\">{sid}</th><td class=\"src\">x</td><td class=\"tgt\">"
        );
        for (src, text) in spans {
            out.push_str(&format!("<span data-src=\"{src}\">{text}</span>"));
        }
        out.push_str("</td></tr></tbody>\n");
        out
    }

    #[test]
    fn edges_carrier_dedicated_round_collapses_crossing_and_splits_monotone() {
        let mut doc = edges_doc();
        let answer = ttable(&[
            egroup(
                "s-g1.0",
                &[("4-7", "因为我病了，"), ("1 2 3", "所以没去。")],
            ),
            egroup(
                "s-g2.0",
                &[
                    ("1-5", "我们先分析数据，"),
                    ("6-9", "然后训练模型，"),
                    ("10-14", "最后部署服务。"),
                ],
            ),
        ]);
        let mut llm = file_llm([answer]);
        let mut artifacts = Artifacts::default();
        let outcome = run_align_with_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &mut |attempt| {
                artifacts.pages.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.len(),
                ));
            },
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 1, "{:?}", outcome.violations);
        let (kind, system, user, _) = &llm.calls[0];
        assert_eq!(kind, "align-edges");
        assert!(system.contains("<span data-src="), "{system}");
        assert!(
            user.contains("data-ccut-format=\"align-edges/1\""),
            "{user}"
        );
        assert!(
            user.contains("[1]I [2]didn't [3]go [4]because [5]I [6]was [7]sick."),
            "{user}"
        );
        assert_eq!(artifacts.pages, vec![("b001".to_owned(), 1, true, 0)]);
        assert_eq!(outcome.aligned_sentences, 2, "{:?}", outcome.violations);
        assert_eq!(outcome.fallback_sentences, 0);
        assert_eq!(outcome.sentence_level_sentences, 0);
        assert_eq!(outcome.rewritten_sentences, 0);

        // A crossed sentence: the whole sentence is one block and one piece, still a block-level correspondence (no fabricated row-level correspondence).
        let crossing = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(crossing.mode, AlignMode::ManyToOne);
        assert_eq!(crossing.pieces.len(), 1);
        assert_eq!(crossing.blocks.len(), 1);
        assert_eq!(crossing.correspondence, Some(Correspondence::Block));
        assert!(
            crossing.blocks[0]
                .flags
                .contains(&"local-reorder".to_owned()),
            "{crossing:#?}"
        );
        assert_eq!(crossing.aligner.as_deref(), Some(LLM_CHUNK_ALIGNER_TAG));
        assert!(!crossing.crossing);

        // A monotonic sentence: several blocks and several pieces, with piece boundaries falling only on block boundaries.
        let monotone = &doc.trans_align["zh"]["s-g2.0"];
        assert!(monotone.pieces.len() >= 2, "{monotone:#?}");
        assert!(monotone.blocks.len() >= 3, "{monotone:#?}");
        assert_eq!(monotone.correspondence, Some(Correspondence::Block));
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        for sentence in &sentences {
            assert!(align_entry_valid_for_lang(
                &doc,
                sentence,
                "zh",
                &doc.trans_align["zh"][&sentence.id]
            ));
        }
    }

    #[test]
    fn edges_carrier_bad_answers_get_one_repair_round_then_anchor_or_fallback() {
        let mut doc = edges_doc();
        // First round: sentence 1's ordinal is out of range ([align-edge-ordinal]), and sentence 2 has no span annotation. Repair round: sentence 1 is fixed, sentence 2 is still missing ⇒ pure anchoring has no evidence ⇒ deterministic fallback.
        let bad = ttable(&[
            egroup("s-g1.0", &[("4-9", "因为我病了，"), ("1 2 3", "所以没去。")]),
            "  <tbody data-sid=\"s-g2.0\"><tr><td class=\"src\">x</td><td class=\"tgt\">我们先分析数据，然后训练模型，最后部署服务。</td></tr></tbody>\n".to_owned(),
        ]);
        let repaired = ttable(&[egroup(
            "s-g1.0",
            &[("4-7", "因为我病了，"), ("1 2 3", "所以没去。")],
        )]);
        let mut llm = file_llm([bad, repaired]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 2);
        let (kind, _, user, retry) = &llm.calls[1];
        assert_eq!(kind, "align-edges");
        let retry = retry.as_deref().unwrap();
        assert!(retry.contains("align-edge-ordinal"), "{retry}");
        assert!(retry.contains("s-g2.0"), "{retry}");
        assert!(user.contains("data-sid=\"s-g1.0\""), "{user}");
        assert!(user.contains("data-sid=\"s-g2.0\""), "{user}");
        assert_eq!(outcome.aligned_sentences, 1, "{:?}", outcome.violations);
        assert_eq!(outcome.fallback_sentences, 1);
        assert_eq!(doc.trans_align["zh"]["s-g1.0"].blocks.len(), 1);
        assert!(doc.trans_align["zh"]["s-g2.0"].blocks.is_empty());
        assert!(
            outcome
                .violations
                .iter()
                .any(|violation| violation.starts_with("s-g2.0: fell back")),
            "{:?}",
            outcome.violations
        );
    }

    /// A causal-inversion sentence where a single block exceeds hard (block-alignment design §4.5, third branch).
    fn rewrite_doc() -> TranscriptDoc {
        let mut words = Vec::new();
        for (index, text) in [
            "I", "didn't", "go", "because", "I", "was", "sick", "and", "tired.",
        ]
        .into_iter()
        .enumerate()
        {
            words.push(w(
                &format!("g1.{index}"),
                index as f64 * 0.5,
                index as f64 * 0.5 + 0.5,
                text,
            ));
        }
        let mut doc = doc_with_words(words);
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            "因为我当时既生病又非常疲惫不堪，所以最终没有去成。".to_owned(),
        );
        doc
    }

    fn rewrite_llm(rewrite_answer: String) -> FakeLlm {
        let dedicated = ttable(&[egroup(
            "s-g1.0",
            &[
                ("4-9", "因为我当时既生病又非常疲惫不堪，"),
                ("1-3", "所以最终没有去成。"),
            ],
        )]);
        file_llm([dedicated, rewrite_answer])
    }

    #[test]
    fn edges_carrier_rewrite_round_writes_trans_display_with_display_basis() {
        let mut doc = rewrite_doc();
        let natural = doc.trans["zh"]["s-g1.0"].clone();
        let mut llm = rewrite_llm(ttable(&[egroup(
            "s-g1.0",
            &[
                ("1-3", "我最终没有去成，"),
                ("4-9", "因为当时既生病又非常疲惫不堪。"),
            ],
        )]));
        let mut artifacts = Artifacts::default();
        let outcome = run_align_with_artifacts(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &mut |attempt| {
                artifacts.pages.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    0,
                ));
            },
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 2, "{:?}", outcome.violations);
        let (kind, system, user, _) = &llm.calls[1];
        assert_eq!(kind, "align-rewrite");
        assert!(
            system.contains("follows the SOURCE clause order"),
            "{system}"
        );
        assert!(
            user.contains("data-ccut-format=\"align-rewrite/1\""),
            "{user}"
        );
        assert!(
            user.contains("data-over-hard=\"chunk 1 (words 1-9): "),
            "{user}"
        );
        assert!(user.contains("&gt; hard 20\""), "{user}");
        assert_eq!(
            artifacts.pages,
            vec![("b001".to_owned(), 1, true), ("w001".to_owned(), 1, true)]
                .into_iter()
                .map(|(page, attempt, accepted)| (page, attempt, accepted, 0))
                .collect::<Vec<_>>()
        );
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.rewritten_sentences, 1);
        assert_eq!(outcome.sentence_level_sentences, 0);
        // The natural translation is untouched; the rewrite goes into transDisplay; the entry takes display as its basis.
        assert_eq!(doc.trans["zh"]["s-g1.0"], natural);
        let display = &doc.trans_display["zh"]["s-g1.0"];
        assert_eq!(
            display.text,
            "我最终没有去成，因为当时既生病又非常疲惫不堪。"
        );
        assert_eq!(display.basis, MONOTONIC_REWRITE_BASIS);
        assert_eq!(display.trans_fingerprint, trans_text_fingerprint(&natural));
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.text_basis, TextBasis::Display);
        assert_eq!(entry.correspondence, Some(Correspondence::Block));
        assert_eq!(entry.pieces.len(), 2, "{entry:#?}");
        assert_eq!(entry.pieces[0].to, Some(2));
        assert_eq!(entry.pieces[1].from, Some(3));
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert!(align_entry_valid_for_lang(&doc, &sentences[0], "zh", entry));
        assert!(
            outcome
                .violations
                .iter()
                .any(|violation| violation.contains(MONOTONIC_REWRITE_BASIS)),
            "{:?}",
            outcome.violations
        );

        // Incremental: if the display-basis entry is valid, running again makes no call. If the translation changes, display-stale removes it together, and it is queued again.
        let mut idle = file_llm([]);
        let again = run_align(
            &mut doc,
            &mut idle,
            &opts_edges(AlignMode::ManyToOne),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(again.skipped_sentences, 1);
        assert!(idle.calls.is_empty());
        doc.trans.get_mut("zh").unwrap().insert(
            "s-g1.0".to_owned(),
            "因为我当时既生病又非常疲惫不堪，所以最终没能成行。".to_owned(),
        );
        let mut relaunch = file_llm([ttable(&[egroup(
            "s-g1.0",
            &[
                ("4-9", "因为我当时既生病又非常疲惫不堪，"),
                ("1-3", "所以最终没能成行。"),
            ],
        )])]);
        let _ = run_align(
            &mut doc,
            &mut relaunch,
            &opts_edges(AlignMode::ManyToOne),
            &mut |_| {},
        );
        assert!(
            !relaunch.calls.is_empty(),
            "stale display must re-enter the queue"
        );
        assert!(!doc.trans_display.contains_key("zh"));
    }

    /// A text returned by the rewrite round that is identical to the stored translation, merely with the blocks split finely enough to enter the DP. It is stored as an ordinary alignment, does not write transDisplay, does not record a rewrite, and does not ask the user to check a rewrite that does not exist.
    #[test]
    fn edges_carrier_rewrite_with_unchanged_text_is_plain_aligned() {
        let mut doc = rewrite_doc();
        let natural = "我最终没有去成，因为当时既生病又非常疲惫不堪。".to_owned();
        doc.trans
            .get_mut("zh")
            .unwrap()
            .insert("s-g1.0".to_owned(), natural.clone());
        // The dedicated round labelled the ordinals backwards ⇒ crossing ⇒ a single block over hard for the whole sentence ⇒ rewrite round.
        let dedicated = ttable(&[egroup(
            "s-g1.0",
            &[
                ("4-9", "我最终没有去成，"),
                ("1-3", "因为当时既生病又非常疲惫不堪。"),
            ],
        )]);
        let rewrite = ttable(&[egroup(
            "s-g1.0",
            &[
                ("1-3", "我最终没有去成，"),
                ("4-9", "因为当时既生病又非常疲惫不堪。"),
            ],
        )]);
        let mut llm = file_llm([dedicated, rewrite]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 2, "{:?}", outcome.violations);
        assert_eq!(llm.calls[1].0, "align-rewrite");
        assert_eq!(outcome.aligned_sentences, 1);
        assert_eq!(outcome.rewritten_sentences, 0);
        assert_eq!(outcome.fallback_sentences, 0);
        assert!(!doc.trans_display.contains_key("zh"));
        assert_eq!(doc.trans["zh"]["s-g1.0"], natural);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_eq!(entry.text_basis, TextBasis::Trans);
        assert_eq!(entry.pieces.len(), 2, "{entry:#?}");
        assert!(
            outcome
                .violations
                .iter()
                .any(|violation| violation.contains("kept the text unchanged")),
            "{:?}",
            outcome.violations
        );
        assert!(
            !outcome
                .violations
                .iter()
                .any(|violation| violation.contains("verify no meaning shifted")),
            "{:?}",
            outcome.violations
        );
    }

    #[test]
    fn edges_carrier_rejected_rewrite_degrades_without_an_over_hard_row() {
        let mut doc = rewrite_doc();
        let natural = doc.trans["zh"]["s-g1.0"].clone();
        // The rewrite compressed content (24 → 8 units) ⇒ the magnitude guardrail rejects it ⇒ downgrade. The natural translation is over hard, and a whole sentence as one piece would be an unshowable single row ⇒ split at deterministic target-language seams, with source times apportioned proportionally.
        let mut llm = rewrite_llm(ttable(&[egroup(
            "s-g1.0",
            &[("1-3", "我没去，"), ("4-9", "因为病了。")],
        )]));
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &opts_edges(AlignMode::ManyToOne),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 2);
        assert_eq!(outcome.aligned_sentences, 0);
        assert_eq!(outcome.rewritten_sentences, 0);
        assert_eq!(outcome.sentence_level_sentences, 0);
        assert_eq!(outcome.fallback_sentences, 1);
        assert!(!doc.trans_display.contains_key("zh"));
        assert_eq!(doc.trans["zh"]["s-g1.0"], natural);
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert_ne!(entry.correspondence(), Correspondence::Sentence);
        assert_eq!(entry.text_basis, TextBasis::Trans);
        assert!(entry.pieces.len() >= 2, "{entry:?}");
        let params = TransParams::for_lang("zh");
        for piece in &entry.pieces {
            assert!(
                crate::split::piece_display_units(&piece.text, "zh") <= params.hard,
                "{entry:?}"
            );
        }
        assert_eq!(
            entry
                .pieces
                .iter()
                .map(|piece| piece.text.as_str())
                .collect::<String>(),
            natural
        );
        assert!(
            outcome
                .violations
                .iter()
                .any(|violation| violation.contains("monotonic rewrite rejected")
                    && violation.contains("deterministic target seam")),
            "{:?}",
            outcome.violations
        );
    }

    #[test]
    fn edges_lint_shares_the_engine_string_checker() {
        // The submit-time lint and the engine parse the same payload: same problem codes, same sentence ids.
        let doc = edges_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let words: Vec<String> = sentences[0]
            .word_indices
            .iter()
            .map(|&index| doc.words[index].text.clone())
            .collect();
        let table = AlignEdgesInput::new(
            "zh",
            vec![crate::filepipe::AlignEdgesSentenceInput::new(
                "s-g1.0",
                words,
                "因为我病了，所以没去。",
            )],
        );
        let payload = render_align_edges(&table);
        let drifted = ttable(&[egroup(
            "s-g1.0",
            &[("4-7", "因为我生病了，"), ("1 2 3", "所以没去。")],
        )]);
        let lint = lint_agent_answer_edges(&payload, &drifted);
        assert_eq!(lint.len(), 1, "{lint:?}");
        assert!(lint[0].starts_with("[align-edge-text] s-g1.0:"), "{lint:?}");
        let engine = parse_align_edges(&table, Some(&payload), &drifted);
        assert_eq!(engine.diagnostics.problems.len(), 1);
        assert_eq!(
            engine.diagnostics.problems[0].code,
            ProblemCode::AlignEdgeText
        );
        // The payload is not an edges table ⇒ not blocked.
        assert!(lint_agent_answer_edges("<p>nope</p>", &drifted).is_empty());

        // rewrite payloads go through the same entry point: the format attribute decides the rewrite mode, and the magnitude guardrail takes effect.
        let mut rewrite = table.clone();
        rewrite.rewrite = true;
        let payload = render_align_edges(&rewrite);
        let squeezed = ttable(&[egroup("s-g1.0", &[("1-7", "没去。")])]);
        let lint = lint_agent_answer_rewrite(&payload, &squeezed);
        assert!(
            lint.iter()
                .any(|line| line.starts_with("[align-content-drift] s-g1.0:")),
            "{lint:?}"
        );
        let natural = ttable(&[egroup(
            "s-g1.0",
            &[("1-3", "我没去，"), ("4-7", "因为我病了。")],
        )]);
        assert!(lint_agent_answer_rewrite(&payload, &natural).is_empty());
    }

    // ---- s-g9.0 regression (Sundar Pichai project, fr → zh-Hans, four rounds of alignment evidence) ----

    /// The 25 source words of the real project s-g9.0 (including `à` inserted by polish) with their real word times. An automatic break before `faire` derives four user-visible source rows.
    fn sg9_doc(translation: &str) -> TranscriptDoc {
        let raw: [(&str, f64, f64, &str); 25] = [
            ("g9.0", 36.32, 36.64, "Mais"),
            ("g9.1", 36.64, 36.85, "si"),
            ("g9.2", 36.85, 37.18, "vous"),
            ("g9.3", 37.18, 37.51, "êtes"),
            ("g9.4", 37.51, 37.71, "un"),
            ("g9.5", 37.71, 38.5, "scientifique,"),
            ("g9.6", 38.5, 38.83, "vous"),
            ("g9.7", 38.83, 39.16, "êtes"),
            ("g9.8", 39.16, 39.48, "prêt"),
            ("g9.9", 39.48, 39.69, "à"),
            ("g9.10", 39.69, 40.08, "faire"),
            ("g9.11", 40.08, 40.4, "face"),
            ("g9.12", 40.4, 40.61, "à"),
            ("g9.13", 40.61, 40.82, "ce"),
            ("g9.14", 40.82, 41.14, "défi"),
            ("g10.0", 41.14, 41.31, "et"),
            ("wmug0k8vt-18", 41.31, 41.32, "à"),
            ("g10.1", 41.32, 41.76, "résoudre"),
            ("g10.2", 41.76, 41.97, "les"),
            ("g10.3", 41.97, 42.45, "problèmes"),
            ("g10.4", 42.45, 42.67, "qui"),
            ("g10.5", 42.67, 43.11, "viennent"),
            ("g10.6", 43.11, 43.36, "avec"),
            ("g10.7", 43.36, 43.53, "le"),
            ("g10.8", 43.53, 43.88, "chemin."),
        ];
        let mut doc = doc_with_words(
            raw.iter()
                .map(|&(id, t0, t1, text)| w(id, t0, t1, text))
                .collect(),
        );
        doc.lang = "fr".to_owned();
        doc.breaks.insert("g9.10".to_owned(), BreakOverride::Break);
        doc.trans
            .entry("zh-Hans".to_owned())
            .or_default()
            .insert("s-g9.0".to_owned(), translation.to_owned());
        doc
    }

    const SG9_R1: &str = "但如果你是科学家，就愿迎接挑战，解决沿途难题。";

    fn sg9_stats(doc: &TranscriptDoc) -> Vec<RowDeficitStats> {
        let cues = derive_cues(doc, &crate::layout_profile::cue_params_for_doc(doc));
        let sentences = derive_sentences(doc, &cues);
        let trans = derive_trans_cues(doc, &sentences, "zh-Hans");
        row_deficit_stats(doc, &sentences, "zh-Hans", &cues, &trans)
    }

    /// The two pieces produced by the translate fused rows draft in the user's project (the second piece is 5.38s, spanning 3 source rows ⇒ `align-row-deficit`).
    fn sg9_rows_entry(doc: &TranscriptDoc) -> TransAlign {
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            doc.words.iter().map(|word| word.id.clone()).collect(),
            vec![
                TransPiece {
                    from: Some(0),
                    to: Some(5),
                    text: "但如果你是科学家，".to_owned(),
                },
                TransPiece {
                    from: Some(6),
                    to: Some(24),
                    text: "就愿迎接挑战，解决沿途难题。".to_owned(),
                },
            ],
        );
        entry.aligner = Some("llm-rows+anchor/1".to_owned());
        entry
    }

    fn sg9_with_entry(translation: &str, entry: fn(&TranscriptDoc) -> TransAlign) -> TranscriptDoc {
        let mut doc = sg9_doc(translation);
        let entry = entry(&doc);
        doc.trans_align
            .entry("zh-Hans".to_owned())
            .or_default()
            .insert("s-g9.0".to_owned(), entry);
        doc
    }

    /// Paired tail round (same set of options as `run_row_repair_tail`).
    fn sg9_paired_options(carrier: AlignCarrier) -> AlignOptions {
        let mut options = opts(AlignMode::ManyToOne);
        options.carrier = carrier;
        options.lang = "zh-Hans".to_owned();
        options.density = AlignDensity::Paired;
        options.density_sentences = ["s-g9.0".to_owned()].into_iter().collect();
        options.sentences = Some(["s-g9.0".to_owned()].into_iter().collect());
        options.targeted = true;
        options.force = true;
        options.repair_calls = 0;
        options
    }

    /// Round 1 worker answer (c0002): 7 semantic blocks, with the tail crossings 16-18 / 21-25 / 19-20.
    fn sg9_c0002_answer() -> String {
        ttable(&[egroup(
            "s-g9.0",
            &[
                ("1", "但"),
                ("2-6", "如果你是科学家，"),
                ("7-10", "就愿"),
                ("11-15", "迎接挑战，"),
                ("16-18", "解决"),
                ("21-25", "沿途"),
                ("19-20", "难题。"),
            ],
        )])
    }

    fn sg9_assert_no_deficit(doc: &TranscriptDoc) {
        let stats = sg9_stats(doc);
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].reason, None, "{stats:?}");
        assert!(stats[0].trans_cues >= 3, "{stats:?}");
        assert!(
            stats[0].max_dwell_sec < ROW_DEFICIT_DWELL_SECONDS,
            "{stats:?}"
        );
        let entry = &doc.trans_align["zh-Hans"]["s-g9.0"];
        let hard = TransParams::for_lang("zh-Hans").hard;
        for piece in &entry.pieces {
            assert!(
                crate::split::piece_display_units(&piece.text, "zh-Hans") <= hard,
                "{entry:?}"
            );
        }
    }

    #[test]
    fn sg9_block_dp_cuts_a_stuck_row_at_block_boundaries() {
        use crate::align_block::{
            AlignDensity as Density, AnchorWord, BilingualPlanInput, PlanOutcome, plan_sentence,
        };
        let doc = sg9_doc(SG9_R1);
        let cues = derive_cues(&doc, &crate::layout_profile::cue_params_for_doc(&doc));
        let keys: Vec<Option<String>> = (0..doc.words.len())
            .map(|index| {
                cues.iter()
                    .find(|cue| cue.word_indices.contains(&index))
                    .map(|cue| cue.id.clone())
            })
            .collect();
        assert_eq!(covered_source_rows(&keys, 0, keys.len() - 1), 4);
        let words: Vec<AnchorWord> = doc
            .words
            .iter()
            .map(|word| AnchorWord {
                id: word.id.clone(),
                text: word.text.clone(),
                t0: word.t0,
                t1: word.t1,
                glue: false,
            })
            .collect();
        // c0002's 7 blocks (0-based ordinals, consistent with the 1-based `sg9_c0002_answer`).
        let chunks: Vec<AlignChunk> = [
            (0..=0, "但"),
            (1..=5, "如果你是科学家，"),
            (6..=9, "就愿"),
            (10..=14, "迎接挑战，"),
            (15..=17, "解决"),
            (20..=24, "沿途"),
            (18..=19, "难题。"),
        ]
        .into_iter()
        .map(|(ordinals, text)| AlignChunk {
            text: text.to_owned(),
            ordinals: ordinals.collect(),
        })
        .collect();
        let edges = crate::filepipe::align_edges::chunks_to_edges(&chunks, SG9_R1);
        let mut input = BilingualPlanInput::new(words, SG9_R1, "fr", "zh-Hans");
        input.density = Density::Paired;
        let pieces = |input: &BilingualPlanInput| match plan_sentence(&edges, input) {
            PlanOutcome::Aligned(entry) => entry
                .pieces
                .iter()
                .map(|piece| (piece.from.unwrap(), piece.to.unwrap()))
                .collect::<Vec<_>>(),
            other => panic!("{other:?}"),
        };
        // When source rows are unknown and only the width fit is considered, the 7 blocks are compressed by the DP into two pieces, the second piece 5.38s and spanning 3 source rows. This is exactly the shape of c0002's rejection in the user's project.
        let blind = pieces(&input);
        assert_eq!(blind, [(0, 5), (6, 24)]);
        input.source_cue_keys = keys.clone();
        let aware = pieces(&input);
        assert!(aware.len() >= 3, "{aware:?}");
        for &(from, to) in &aware {
            let dwell = doc.words[to].t1 - doc.words[from].t0;
            assert!(
                !row_dwell_deficit(dwell, covered_source_rows(&keys, from, to)),
                "{aware:?}"
            );
        }
    }

    #[test]
    fn sg9_paired_edges_round_repairs_the_stuck_row() {
        let mut doc = sg9_with_entry(SG9_R1, sg9_rows_entry);
        let before = sg9_stats(&doc);
        assert_eq!(
            before[0].reason,
            Some(RowDeficitReason::Dwell),
            "{before:?}"
        );
        let mut llm = file_llm([sg9_c0002_answer()]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Edges),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.row_repair.repaired, 1, "{outcome:#?}");
        assert_eq!(outcome.row_repair.rejected, 0, "{outcome:#?}");
        let entry = &doc.trans_align["zh-Hans"]["s-g9.0"];
        assert!(entry.pieces.len() >= 3, "{entry:?}");
        sg9_assert_no_deficit(&doc);
    }

    #[test]
    fn sg9_paired_accepts_a_deficit_free_answer_below_the_hinted_count() {
        // Round 2 shape: 3 rows, fewer than the 4 hinted blocks, but no single row is sticking ⇒ accepted.
        let mut doc = sg9_with_entry(SG9_R1, sg9_rows_entry);
        let answer = ttable(&[tgroup(
            "s-g9.0",
            "",
            &[
                ("Mais si vous êtes un scientifique,", "但如果你是科学家，"),
                ("vous êtes prêt à faire face à ce défi", "就愿迎接挑战，"),
                (
                    "et à résoudre les problèmes qui viennent avec le chemin.",
                    "解决沿途难题。",
                ),
            ],
        )]);
        let mut llm = file_llm([answer]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Table),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.row_repair.repaired, 1, "{outcome:#?}");
        assert!(outcome.row_repair.rejections.is_empty(), "{outcome:#?}");
        assert_eq!(doc.trans_align["zh-Hans"]["s-g9.0"].pieces.len(), 3);
        sg9_assert_no_deficit(&doc);
    }

    #[test]
    fn sg9_paired_accepts_a_strictly_better_partial_fix_with_a_warning() {
        // The original state: the whole sentence as one piece (7.56s, 4 source rows). The new answer has two rows; the second is still sticking but shorter, covering fewer source rows ⇒ accepted, with the warning kept.
        let whole = |doc: &TranscriptDoc| {
            TransAlign::new(
                AlignMode::ManyToOne,
                doc.words.iter().map(|word| word.id.clone()).collect(),
                vec![TransPiece {
                    from: Some(0),
                    to: Some(24),
                    text: SG9_R1.to_owned(),
                }],
            )
        };
        let mut doc = sg9_with_entry(SG9_R1, whole);
        let answer = ttable(&[tgroup(
            "s-g9.0",
            "",
            &[
                ("Mais si vous êtes un scientifique,", "但如果你是科学家，"),
                (
                    "vous êtes prêt à faire face à ce défi et à résoudre les problèmes qui viennent avec le chemin.",
                    "就愿迎接挑战，解决沿途难题。",
                ),
            ],
        )]);
        let mut llm = file_llm([answer]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Table),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.row_repair.repaired, 1, "{outcome:#?}");
        assert!(
            outcome
                .violations
                .iter()
                .any(|line| line.starts_with("s-g9.0: paired row repair accepted a partial fix")),
            "{:?}",
            outcome.violations
        );
        assert_eq!(doc.trans_align["zh-Hans"]["s-g9.0"].pieces.len(), 2);
        assert_eq!(sg9_stats(&doc)[0].reason, Some(RowDeficitReason::Dwell));
    }

    /// The whole repair call batch failed (retryable error, budget 0) ⇒ the budget tail has only the model-absent equal-width split left. The original entry came from the model ⇒ keep the original (`model-free`), even if equal-width splitting could clear the sticking rows. If the original entry is itself `deterministic/1` ⇒ equal-width splitting is validated as usual by the dwell predicate.
    #[test]
    fn sg9_paired_model_free_fallback_never_replaces_a_model_backed_entry() {
        let mut doc = sg9_with_entry(SG9_R1, sg9_rows_entry);
        let previous = doc.trans_align["zh-Hans"]["s-g9.0"].clone();
        let mut llm = FakeLlm::new([Err(LlmError::Malformed("repair batch failed".into()))]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Table),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(outcome.row_repair.repaired, 0, "{outcome:#?}");
        assert_eq!(outcome.row_repair.rejected, 1, "{outcome:#?}");
        assert_eq!(outcome.row_repair.rejections[0].reason, "model-free");
        assert_eq!(outcome.fallback_sentences, 0, "{outcome:#?}");
        assert!(
            outcome.violations.iter().any(|line| {
                line.starts_with(
                    "s-g9.0: paired row repair rejected — the repair call did not yield",
                ) && line.contains(
                    "`deterministic/1` split would replace the `llm-rows+anchor/1` alignment",
                )
            }),
            "{:?}",
            outcome.violations
        );
        assert_eq!(doc.trans_align["zh-Hans"]["s-g9.0"], previous);

        // The original entry is a model-absent equal-width split: the new equal-width split from the same failure is validated by the dwell predicate.
        let deterministic = |doc: &TranscriptDoc| {
            let mut entry = sg9_rows_entry(doc);
            entry.aligner = Some("deterministic/1".to_owned());
            entry
        };
        let mut doc = sg9_with_entry(SG9_R1, deterministic);
        let mut llm = FakeLlm::new([Err(LlmError::Malformed("repair batch failed".into()))]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Table),
            &mut |_| {},
        )
        .unwrap();
        assert!(
            outcome
                .row_repair
                .rejections
                .iter()
                .all(|rejection| rejection.reason != "model-free"),
            "{outcome:#?}"
        );
    }

    #[test]
    fn sg9_paired_rejects_an_answer_that_does_not_improve_the_stuck_row() {
        let mut doc = sg9_with_entry(SG9_R1, sg9_rows_entry);
        let previous = doc.trans_align["zh-Hans"]["s-g9.0"].clone();
        let answer = ttable(&[tgroup(
            "s-g9.0",
            "",
            &[
                ("Mais si vous êtes un scientifique,", "但如果你是科学家，"),
                (
                    "vous êtes prêt à faire face à ce défi et à résoudre les problèmes qui viennent avec le chemin.",
                    "就愿迎接挑战，解决沿途难题。",
                ),
            ],
        )]);
        let mut llm = file_llm([answer]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Table),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.row_repair.repaired, 0, "{outcome:#?}");
        assert_eq!(outcome.row_repair.rejections[0].reason, "not-improved");
        assert_eq!(doc.trans_align["zh-Hans"]["s-g9.0"], previous);
    }

    #[test]
    fn sg9_round3_crossing_answer_keeps_the_four_worker_rows() {
        // Round 3: the translation has changed (the old entry becomes invalid), and the worker submitted 4 rows and self-reported a crossing. Earlier the whole sentence was degraded to a single 28-unit over-hard row; now the best-effort retention keeps the 4 rows.
        const R3: &str = "但如果你是科学家，你就愿意直面挑战；沿途遇到问题，也愿意解决。";
        let mut doc = sg9_with_entry(R3, sg9_rows_entry);
        let answer = ttable(&[tgroup(
            "s-g9.0",
            " data-no-rewrite=\"true\" data-crossing=\"true\"",
            &[
                ("Mais si vous êtes un scientifique,", "但如果你是科学家，"),
                (
                    "vous êtes prêt à faire face à ce défi",
                    "你就愿意直面挑战；",
                ),
                ("et à résoudre les problèmes", "沿途遇到问题，"),
                ("qui viennent avec le chemin.", "也愿意解决。"),
            ],
        )]);
        let mut llm = file_llm([answer]);
        let outcome = run_align(
            &mut doc,
            &mut llm,
            &sg9_paired_options(AlignCarrier::Table),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.row_repair.repaired, 1, "{outcome:#?}");
        let entry = &doc.trans_align["zh-Hans"]["s-g9.0"];
        assert_ne!(entry.correspondence(), Correspondence::Sentence);
        let texts: Vec<&str> = entry
            .pieces
            .iter()
            .map(|piece| piece.text.as_str())
            .collect();
        assert_eq!(
            texts,
            [
                "但如果你是科学家，",
                "你就愿意直面挑战；",
                "沿途遇到问题，",
                "也愿意解决。"
            ]
        );
        sg9_assert_no_deficit(&doc);
    }
}
