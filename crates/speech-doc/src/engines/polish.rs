//! Polish (polish/organize stage, cross-checked against the voice-ink Organize domain).
//!
//! Contract: plain text in (⏸/⏹ soft markers), sentence strings out (M28 conclusion: abandon the sparse mapping with word indices); atom-LCS deterministically rebuilds word ranges; similarity check + single-sentence retry + fallback ladder; applying uses rebind: word id/t0/t1 for every word matched by LCS are left untouched.
//!
//! Deliberate deviations from voice-ink: the “aligned interval recovery” layer (SubAlign anchor mechanism) is omitted; once page retries and single-sentence retries are exhausted, it falls straight back to a split at 30 words/sentence end. Text degrades back to the original words, while boundaries and the timeline always stay valid.

use std::collections::{BTreeMap, BTreeSet};
use std::ops::Range;

use serde::{Deserialize, Serialize};

use crate::atomize::{
    atom_key, atomize_like, atomize_syllables, atomize_word_like, comparison_atoms, edit_distance,
    is_cjk_text, is_script_glued, is_unspaced_cjk_char, join_word_texts, needs_fine_comparison,
    normalize_chars, sentence_end, similarity, word_count,
};
use crate::autocorrect::{Options as AutocorrectOptions, format_with_options, source_is_cjk};
use crate::doc::{TranscriptDoc, Word};
use crate::engines::brief::{
    Analysis, format_for_prompt, instructions_block, reference_context_block,
};
use crate::engines::markers::{collapse_cjk_spaces_like, pause_marks, sanitize_corrected};
use crate::filepipe::polish_txt::{
    FENCE_BLOCK_END, FENCE_BLOCK_PREFIX, FENCE_CONTEXT_AFTER, FENCE_CONTEXT_BEFORE,
    FENCE_EDIT_BEGIN, FENCE_EDIT_END, FENCE_SENTENCE_BEGIN_PREFIX, FENCE_SENTENCE_END_PREFIX,
    MARKER_HARD_CUT, MAX_PARAGRAPH_WORDS_CJK, MAX_PARAGRAPH_WORDS_LATIN, PunctRepairItem,
    paragraph_word_limit, parse_punct_repair_page, parse_segment_repair_page,
    render_punct_repair_page, render_seam_repair_page, render_segment_repair_page,
};
use crate::filepipe::{
    PolishBudget, PolishPagePlan, PolishParsed, Problem, ProblemCode, ProblemScope,
    lint_polish_page, parse_polish_page, plan_polish_pages, render_polish_page,
};
use crate::fingerprint::{fingerprint, id_fingerprint};
use crate::lcs::{AtomInterner, LCS_CELL_CAP, lcs_matches};
use crate::llm::{LlmError, LlmJson, LlmRequest, RetryPolicy, complete_batch_retry_report, decode};
use crate::paging::budgets;
use crate::rebind::{IdSource, rebind_corrected};
use crate::sentence::SENTENCE_MAX_WORDS;
use crate::timing::word_timing_repair;

const MIN_TEXT_MATCH_RATIO: f64 = 0.7;
const SIMILARITY_THRESHOLD_LATIN: f64 = 0.7;
const SIMILARITY_THRESHOLD_CJK: f64 = 0.75;
const MAX_TAIL_GAP: usize = 10;
const MAX_FALLBACK_SENTENCE_WORDS: usize = 30;
/// Per-sentence upper limit (character count of the source word span, `span_chars` = Σ word surface + 1). About 10% of the page budget (budgets::ORGANIZE=12000); in real corpora the longest per-sentence source span is about 412 characters, leaving a 3× margin.
/// Exceeding it **does not reject the page**: the body is accepted on the first round, and over-long sentences only receive sentence-end punctuation through a targeted repair by [`punct_repair_wave`] after the wave; if the rounds run out, they are split deterministically along the source timeline as a fallback.
const MAX_SENTENCE_SOURCE_CHARS: usize = 1200;
/// Per-sentence upper limit (duration measure), catching sparse-word and silence spans. Real-corpus sentences run at most about 27s, while pathological samples reach 2615s; the two differ by two orders of magnitude, so a loose value is chosen that only catches the pathological cases.
const MAX_SENTENCE_SPAN_SECONDS: f64 = 300.0;
const LOW_SIMILARITY_CONTEXT_WORDS: usize = 24;
const HEAL_EPSILON: f64 = 1e-6;
/// **Structural cap** on the atoms in one page's core region. The atom-LCS table of the reattachment check ([`map_corrected_page`]) counts cells as `source atoms × answer atoms` and is bounded by [`LCS_CELL_CAP`]; the answer may be up to twice as long as the source, so the source-side cap is `√cap / 2`. The paginator and the validator use the same yardstick ([`word_count`] is the atom count); under the default budget the worst-case page is about 2800 atoms, still a factor of two below this line. A real overrun can only be a paginator mismatch, not a model error: such a page **cannot pass with any answer**, so retrying it just burns tokens. It therefore terminates before the LLM is called, and the page number, atom count and cap are written into the error. (The 12000-character paging of 1.0.9 cut a Chinese page into 10111 atoms, and this is exactly what happened: after all three whole-page retries failed, 78% of the sentences silently fell back.)
pub fn polish_page_atom_capacity() -> usize {
    (LCS_CELL_CAP as f64).sqrt() as usize / 2
}

#[derive(Clone)]
pub struct PolishOptions {
    pub language: String,
    pub instructions: Option<String>,
    pub reference_context: Option<String>,
    pub analysis: Option<Analysis>,
    pub page_budget: usize,
    pub cue_max_chars: usize,
    /// Apply the default CJK punctuation/spacing/casing normalization.
    pub autocorrect: bool,
    /// UI-selected checks. Empty means the conservative typo+punctuation pair.
    pub enabled_checks: BTreeSet<String>,
    /// Word-index ranges to process. Empty means the full transcript.
    pub scope_ranges: Vec<Range<usize>>,
    /// Number of worker slots that can claim this request in parallel (Decision 6: page-wave alignment). `None` means the slot count is unknown or concurrency is unlimited; in that case no alignment is done. The budget is always an **upper bound** and is lowered only when there are not enough pages to fill the slots. The shape matches the same-named field in translate/align, and it takes the return value of `batch_worker_slots` directly rather than using 0 as a sentinel.
    pub worker_slots: Option<usize>,
    /// Run the speaker-repair wave before paging (only multi-speaker documents actually make calls; targeted re-polish always skips). See [`crate::engines::speaker_repair`].
    pub speaker_repair: bool,
    /// Run the speaker-names wave at the end: infer the real names of placeholder speakers from context (targeted re-polish always skips; zero calls when there are no placeholder speakers). See [`crate::engines::speaker_names`].
    pub speaker_names: bool,
}

impl Default for PolishOptions {
    fn default() -> Self {
        Self {
            language: "en".to_owned(),
            instructions: None,
            reference_context: None,
            analysis: None,
            page_budget: budgets::ORGANIZE,
            cue_max_chars: 42,
            autocorrect: true,
            enabled_checks: BTreeSet::from(["typo".to_owned(), "punct".to_owned()]),
            scope_ranges: Vec::new(),
            worker_slots: None,
            speaker_repair: true,
            speaker_names: true,
        }
    }
}

/// Sentence record (written to `ai/polish.json`; the anchor for review and incremental re-translation).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentenceRecord {
    pub first_word_id: String,
    pub last_word_id: String,
    pub t0: f64,
    pub t1: f64,
    pub text: String,
    pub fallback: bool,
}

/// Per-edit suggestion: whether or not it is applied, the timeline is unaffected.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    /// "typo" | "punct" (equal after normalization ⇒ punct).
    pub cat: String,
    pub find: String,
    pub replace: String,
    pub first_word_id: String,
    pub last_word_id: String,
}

#[derive(Debug, Default)]
pub struct PolishOutcome {
    pub sentences: Vec<SentenceRecord>,
    pub suggestions: Vec<Suggestion>,
    /// Paragraph = grouping by sentence index (feeds `paraBreaks` and the output).
    pub paragraphs: Vec<Vec<usize>>,
    /// The count of **pages or half-pages** that fell back to the original words after both the whole-page attempts ([`RetryPolicy::MAX_PAGE_ATTEMPTS`]) and the halving-and-narrowing retry had failed. After halving, a single failure falls back only a half-page, so under the same incident this number may be larger than in the old implementation while `fallback_sentences` may be smaller.
    pub fallback_pages: u32,
    /// The number of **half-pages** that were re-planned by halving after a page-fatal failure and each sent once more (retry-strategy redesign R3, “reject means narrow”). A value above 0 means some page failed three times over the whole page, but after narrowing at least half of it may have been recovered.
    pub split_retry_pages: u32,
    /// The number of sentences that still carry surface-level defects (dangling false sentence-end, glued Latin strings) after the `polish-retry` wave is exhausted, but that **keep the model text**. They are not degraded: the text is still the polished result, and only the `polish-false-sentence-end` / `polish-surface-artifact` warnings of `ccut check` will keep reporting them.
    pub surface_artifact_sentences: u32,
    /// The number of sentences reverted to the original text: single sentences that failed the similarity gate in both rounds, **plus** every sentence split by punctuation or the 30-word cap within a whole-page fallback page (their [`SentenceRecord::fallback`] is likewise `true`). So when `fallback_pages > 0` this is usually large: in the 1.0.9 Chinese incident, one fallback page corresponded to 491 sentences. `ccut check` reports the `polish-fallback` blocker from the per-sentence `fallback` flag.
    pub fallback_sentences: u32,
    pub low_similarity_retries: u32,
    /// The number of times, on the file-contract path, that “a ⏹ forced paragraph boundary could not land exactly inside a sentence and degraded to snapping to the sentence start” (the degradation channel of Decision 3). A value above 0 means some speaker-change point was moved to the nearest sentence start.
    pub forced_boundary_snapped: u32,
    /// The number of paragraphs successfully split by targeted segmentation repair: after the main wave accepted them they still exceeded the limit, and segment-repair split them round by round. A paragraph split in the first round and the remaining groups split in the second round each count once.
    pub repaired_paragraphs: u32,
    /// The number of over-long sentences successfully split by targeted punctuation repair: after the main wave accepted them they still exceeded the single-sentence span limit ([`oversized_span`]), and punct-repair split them round by round by only adding sentence-end punctuation. A sentence split in the first round and the remaining pieces split in the second round each count once.
    pub punct_repaired_sentences: u32,
    /// The number of over-long sentences deterministically split by the engine along the source timeline (speaker change > existing sentence end > long pause > pause plus comma > length fallback) after the punct-repair rounds ran out. A value above 0 means the model failed to break the sentence in all three rounds, and the split points were chosen by the machine.
    pub punct_split_sentences: u32,
    /// Final tally: the number of sentences that **still** exceed the single-sentence span limit after targeted punctuation repair and deterministic sentence splitting. It should normally be 0; a value above 0 can only mean that LCS could not project any split point back onto the corrected text.
    pub oversized_sentences: u32,
    /// The number of paragraphs deterministically split by pause level after the segment-repair rounds ran out (the original paragraph counts once). A value above 0 means the model failed in all three rounds to split these paragraphs down to the limit, and the split points were chosen by the machine from inter-sentence pauses. Paragraph pins are still stamped as usual, and these paragraph pins are “legal but not semantic.”
    pub fallback_paragraphs: u32,
    /// Paragraph-segmentation degradation tally: the number of multi-sentence paragraphs that **still** exceed the per-paragraph word limit after targeted segmentation repair and deterministic close-out. The close-out guarantees that any paragraph with a sentence seam can be split, so this is normally always 0. When it is above 0, this run does **not** stamp `stages.segment` and does not fabricate `segment: fresh`.
    pub degenerate_paragraphs: u32,
    /// Page-seam tally (on first segmentation): the number of seams where a hard-cut page seam (the page boundary falls mid-sentence with no break point) had the paragraphs on both sides unconditionally merged by the engine.
    pub hard_cut_seams_merged: u32,
    /// Page-seam tally: the number of page seams where the next page starts its core region with a blank line, explicitly declaring “start a new paragraph.” The paragraph pin is kept directly and does not go through seam-repair.
    pub seam_signaled_paragraphs: u32,
    /// Page-seam tally: the number of page seams where, in the seam-repair wave, the model judged “continues the same paragraph” and the engine merged the paragraphs on both sides.
    pub seam_merged_paragraphs: u32,
    /// Page-seam tally: the number of page seams kept because, in the seam-repair wave, the model judged “this really is a paragraph boundary.” Seams whose judgment was rejected or failed also keep their paragraph pins, but are not counted here.
    pub seam_kept_paragraphs: u32,
    /// Exit layout check: the number of Cues after layout, the longest width, and the number of cues over the single-line budget. `over_width > 0` means the pipeline itself emitted an over-wide line, which greedy layout never produces.
    pub cue_layout: crate::layout::CueLayoutStats,
    /// Ledger of the speaker-repair wave before paging (skip reason, candidate/window/call counts, number of words whose speaker was changed, and so on).
    pub speaker_repair: crate::engines::speaker_repair::SpeakerRepairReport,
    /// Ledger of the speaker-names wave at the end (skip reason, number of speakers to name, real names written to disk).
    pub speaker_names: crate::engines::speaker_names::SpeakerNamesReport,
}

#[derive(Debug, Deserialize)]
struct RetryResponse {
    sentences: Vec<RetrySentence>,
}

#[derive(Debug, Deserialize)]
struct RetrySentence {
    #[serde(rename = "startWordIndex")]
    start_word_index: usize,
    #[serde(rename = "correctedText")]
    corrected_text: String,
}

/// Mapped sentence (word indices are **global**, inclusive of the start).
#[derive(Debug, Clone)]
struct MappedSentence {
    start: usize,
    end: usize,
    corrected: String,
    fallback: bool,
}

/// UI checkbox options → the list of operations in the prompt.
fn enabled_operations(checks: &BTreeSet<String>) -> Vec<&'static str> {
    let mut operations = Vec::new();
    if checks.contains("typo") {
        operations.push(
            "Fix obvious recognition errors, spelling, homophones, and mistaken word boundaries.",
        );
    }
    if checks.contains("term") {
        operations.push("Correct product, brand, person, and technical terminology when the context makes the intended term clear.");
    }
    if checks.contains("punct") {
        operations.push("Add or correct punctuation.");
    }
    if checks.contains("grammar") {
        operations.push("Fix clear agreement, article, and tense errors without changing the speaker's meaning or tone.");
    }
    if checks.contains("filler") {
        operations.push("Remove only unmistakable verbal fillers such as isolated 'um', 'uh', or 'you know'; never remove content words.");
    }
    if checks.contains("wordy") {
        operations.push("Tighten clearly redundant phrasing while preserving every fact, qualification, and the speaker's tone.");
    }
    operations
}

/// Normalizing checkbox options: an empty set is equivalent to the conservative typo + punct.
fn effective_checks(checks: &BTreeSet<String>) -> BTreeSet<String> {
    if checks.is_empty() {
        BTreeSet::from(["typo".to_owned(), "punct".to_owned()])
    } else {
        checks.clone()
    }
}

fn numbered_operations(checks: &BTreeSet<String>) -> String {
    enabled_operations(checks)
        .iter()
        .enumerate()
        .map(|(index, value)| format!("{}. {value}", index + 1))
        .collect::<Vec<_>>()
        .join("\n")
}

fn retry_system_prompt(options: &PolishOptions) -> String {
    let mut prompt = r#"You are an expert in post-processing ASR (automatic speech recognition) transcripts.

A previous correction of each supplied sentence crossed the conservative surface-similarity threshold. That is a safety signal, NOT proof that the correction is wrong. Re-evaluate the original words and previous attempt against the supplied local and recording context.

Return a "correctedText" that ONLY fixes recognition errors (spelling, homophones, names, and mistaken word boundaries) and adds punctuation. One ASR token may legitimately become several spoken words, or several ASR tokens may become one word. If the previous attempt is a genuine correction, reproduce it exactly; never copy the original merely to raise similarity. Do NOT rephrase, reorder, summarize, add or remove spoken content, and NEVER translate — corrections stay in the same language as the original words.

"contextBefore" and "contextAfter" are read-only neighboring transcript text. Use them only to disambiguate the supplied sentence; never copy them into "correctedText".

Never reintroduce a false sentence end on a dangling connector, preposition, or incomplete lead-in (`because.`, `of.`, `当。`, `让。`, `和。`, `向。`). If the previous attempt joined that lead-in to its following clause, preserve the repaired boundary.

Never leave conflicting adjacent punctuation such as `。，`, `，。`, `，，`, `,,`, or `.,`; keep the single mark that expresses the intended boundary. In Chinese/Japanese/Korean speech, split obviously run-together spoken English phrases back into words (`purereinforcementlearning` → `pure reinforcement learning`) without translating them.

Return each sentence with its original "startWordIndex" unchanged.
Awkward spoken grammar alone is not evidence of an ASR error. Preserve it unless the supplied context supports a recognition correction; returning the original words after review is valid. Never replace pronouns or tense merely to make a short sentence sound more polished.
Respond with a single JSON object: {"sentences": [{"startWordIndex": number, "correctedText": string}]}"#
        .to_owned();
    prompt.push_str(&reference_context_block(
        options.reference_context.as_deref(),
    ));
    if let Some(analysis) = &options.analysis {
        prompt.push_str(&format!(
            "\n\n\nContent overview: {}\n\nKnown correct spellings — use them only when the local sentence actually refers to the same term:\n{}",
            analysis.summary,
            format_for_prompt(analysis)
        ));
    }
    prompt.push_str(&instructions_block(options.instructions.as_deref()));
    prompt
}

/// Replace terminology variants with opaque tokens, so that “correcting a misspelling to the right term” is not judged as tampering by the similarity check.
fn similarity_text(text: &str, analysis: Option<&Analysis>) -> String {
    let Some(analysis) = analysis else {
        return text.to_owned();
    };
    let mut patterns: Vec<(String, String)> = Vec::new();
    for (index, term) in analysis.terms.iter().enumerate() {
        let token = format!("⟦TERM{index}⟧");
        patterns.push((term.term.clone(), token.clone()));
        for variant in &term.observed_variants {
            patterns.push((variant.clone(), token.clone()));
        }
    }
    // Longest first (same length: lexicographic order), so that a substring is not replaced first.
    patterns.sort_by(|a, b| b.0.len().cmp(&a.0.len()).then(a.0.cmp(&b.0)));
    let mut output = text.to_owned();
    for (pattern, token) in patterns {
        if pattern.is_empty() {
            continue;
        }
        output = replace_case_insensitive(&output, &pattern, &token);
    }
    output
}

fn replace_case_insensitive(haystack: &str, needle: &str, replacement: &str) -> String {
    let lower_haystack = haystack.to_lowercase();
    let lower_needle = needle.to_lowercase();
    if lower_needle.is_empty() || lower_haystack.len() != haystack.len() {
        // Rare scripts whose lowercasing changes the byte length: fall back to case-sensitive replacement to avoid offset misalignment.
        return haystack.replace(needle, replacement);
    }
    let mut output = String::with_capacity(haystack.len());
    let mut cursor = 0;
    while let Some(found) = lower_haystack[cursor..].find(&lower_needle) {
        let start = cursor + found;
        output.push_str(&haystack[cursor..start]);
        output.push_str(replacement);
        cursor = start + lower_needle.len();
    }
    output.push_str(&haystack[cursor..]);
    output
}

/// Similarity gate (the threshold depends on the script of corrected: CJK 0.75 / Latin 0.7).
pub fn is_low_similarity(original: &str, corrected: &str, analysis: Option<&Analysis>) -> bool {
    let threshold = if is_cjk_text(corrected) {
        SIMILARITY_THRESHOLD_CJK
    } else {
        SIMILARITY_THRESHOLD_LATIN
    };
    similarity(
        &similarity_text(original, analysis),
        &similarity_text(corrected, analysis),
    ) < threshold
}

/// Second acceptance condition for single-sentence retry: the retry confirmed the previous correction, and the extent of the change is within the conservative bound.
///
/// The extent is measured with two yardsticks, characters and words, and passing either one accepts. The character yardstick suits long sentences, but in a short sentence a single word replacement can consume half the characters: in the p1222 benchmark, the character edit distance of `Thanks, Foss.` → `Thanks, Vasuman.` was 6, crossing the `n/2 = 5` bound. The model gave the same correct answer in two rounds in a row, yet it was discarded, the whole sentence reverted to the original text, and the defect was carried through to alignment. The word yardstick directly measures “how many words were changed” and is not diluted by length in short sentences. Both require the number of added or removed words to be limited, so whole-sentence rewrites are still kept out.
fn confirmed_local_correction(original: &str, previous: &str, retried: &str) -> bool {
    if normalize_chars(previous) != normalize_chars(retried) {
        return false;
    }
    let source: Vec<char> = normalize_chars(original).chars().collect();
    let target: Vec<char> = normalize_chars(retried).chars().collect();
    let n = source.len();
    if edit_distance(&source, &target) <= (n / 2).max(2)
        && source.len().abs_diff(target.len()) <= (n / 3).max(2)
    {
        return true;
    }
    local_word_correction(original, retried)
}

/// Decision json-v0: the single-sentence confirmation result, and at the same time it prevents the old retry path from rolling back sentence-boundary repairs that file-v1 has already passed.
fn validated_retry_correction(
    original: &str,
    previous: &str,
    retried: &str,
    analysis: Option<&Analysis>,
) -> Option<String> {
    // There is only one surface-level criterion ([`has_surface_artifact`]). Conflicting punctuation is already normalized in code at the carrier layer, so it is not judged again here.
    let retry_regressed_surface = has_surface_artifact(retried) && !has_surface_artifact(previous);
    if retry_regressed_surface && confirmed_local_correction(original, previous, previous) {
        return Some(previous.to_owned());
    }
    (!retried.is_empty()
        && !has_surface_artifact(retried)
        && (!is_low_similarity(original, retried, analysis)
            || confirmed_local_correction(original, previous, retried)
            || local_atom_restoration(original, retried)))
    .then(|| retried.to_owned())
}

/// Atom-level locality (retry-confirmation path): the edit distance of the atom sequence (CJK one character per atom, Latin one word per atom, punctuation not counted) must not exceed `max(1, atoms / 3)`, and the number of atoms added or removed must not exceed 2.
///
/// Earlier, the check split on whitespace, so a whole Chinese sentence counted as only one “word.” In short sentences such as `有样在` → `有 Yann LeCun 在`, a restored person's name made the word-count difference exceed 1, and the sentence was rejected outright. The model gave the same correct answer in both rounds and it was still discarded, so the whole sentence reverted to the original and went into the separate `--paragraphs` round. The atom yardstick treats CJK and Latin alike.
fn local_word_correction(original: &str, retried: &str) -> bool {
    let source = atom_keys(original);
    let target = atom_keys(retried);
    if source.is_empty() || target.is_empty() {
        return false;
    }
    if source.len().abs_diff(target.len()) > 2 {
        return false;
    }
    let budget = (source.len() / 3).max(1);
    word_edit_distance(&source, &target) <= budget
}

/// Atom-level local restoration (no prior-round confirmation needed): the change must not exceed `max(1, atoms / 4)` atoms, and there must be **no net word deletion** (the atom count does not decrease, and grows by at most 2).
///
/// The shape it covers is “the previous round dropped a word, and the retry restored it”: `reputation。嗯。` became `嗯。` in the previous round, and the retry returned `representation。嗯。`. The two rounds' answers differ, and character similarity is dragged below 0.75 by the long English word, so the old criterion could only reject, carrying the original text with the dropped word through to alignment. A one-atom replacement that loses no content is the most conservative acceptable shape; whole-sentence rewrites are blocked at the atom budget.
fn local_atom_restoration(original: &str, retried: &str) -> bool {
    let source = atom_keys(original);
    let target = atom_keys(retried);
    if source.is_empty() || target.len() < source.len() || target.len() - source.len() > 2 {
        return false;
    }
    let budget = (source.len() / 4).max(1);
    word_edit_distance(&source, &target) <= budget
}

/// Normalized key of the atom sequence (punctuation removed, lowercased; pure-punctuation atoms discarded). The comparison key uses the finest granularity (Korean, syllable by syllable).
fn atom_keys(text: &str) -> Vec<String> {
    atomize_syllables(text)
        .iter()
        .filter_map(|atom| atom_key(atom))
        .collect()
}

fn word_edit_distance(source: &[String], target: &[String]) -> usize {
    let mut previous: Vec<usize> = (0..=target.len()).collect();
    let mut current = vec![0_usize; target.len() + 1];
    for (i, source_word) in source.iter().enumerate() {
        current[0] = i + 1;
        for (j, target_word) in target.iter().enumerate() {
            let substitute = previous[j] + usize::from(source_word != target_word);
            current[j + 1] = substitute.min(previous[j + 1] + 1).min(current[j] + 1);
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous[target.len()]
}

fn span_text(words: &[Word], start: usize, end: usize) -> String {
    join_word_texts(words[start..=end].iter())
}

/// atom-LCS mapping: sentence string → global word range (0.7 threshold; each sentence is anchored to its last matched source word).
fn map_corrected_page(
    words: &[Word],
    range: std::ops::Range<usize>,
    paragraphs: &[Vec<String>],
) -> Result<Vec<Vec<MappedSentence>>, LlmError> {
    let mut interner = AtomInterner::default();
    let mut src_keys: Vec<u32> = Vec::new();
    let mut src_words: Vec<usize> = Vec::new();
    // For Thai-like scripts whose ranges are built word by word: both sides must be cut to grapheme clusters before they match (see comparison_atoms). Matches still map back to word indices, and sentence boundaries fall only on word boundaries.
    let fine = needs_fine_comparison(&words[range.clone()]);
    for index in range.clone() {
        for atom in comparison_atoms(&words[index].text, fine) {
            if let Some(key) = atom_key(&atom) {
                src_keys.push(interner.intern(&key));
                src_words.push(index);
            }
        }
    }
    let flat: Vec<&String> = paragraphs.iter().flatten().collect();
    let mut out_keys: Vec<u32> = Vec::new();
    let mut out_sentence: Vec<usize> = Vec::new();
    for (sentence_index, sentence) in flat.iter().enumerate() {
        for atom in comparison_atoms(sentence, fine) {
            if let Some(key) = atom_key(&atom) {
                out_keys.push(interner.intern(&key));
                out_sentence.push(sentence_index);
            }
        }
    }
    // The page was already reconciled against [`polish_page_atom_capacity`] during pagination, so the source side cannot exceed the line. If it still does here, it can only be that the answer side is far longer than the source (the whole page repeated several times): a model problem, and retryable. The message carries the size of both sides, so the event stream can tell it apart from “the answer was written wrong.”
    let matches = lcs_matches(&src_keys, &out_keys, LCS_CELL_CAP).ok_or_else(|| {
        LlmError::Malformed(format!(
            "atom-LCS table too large: {} source atoms × {} answer atoms exceed {} cells — \
             the answer is far longer than the page; reproduce the page once, without repeats",
            src_keys.len(),
            out_keys.len(),
            LCS_CELL_CAP
        ))
    })?;
    let ratio = matches.len() as f64 / src_keys.len().max(out_keys.len()).max(1) as f64;
    if ratio < MIN_TEXT_MATCH_RATIO {
        return Err(LlmError::Malformed(
            "Correction drifted too far from the source words".to_owned(),
        ));
    }
    let mut last_word: Vec<Option<usize>> = vec![None; flat.len()];
    for (si, oi) in matches {
        let sentence = out_sentence[oi];
        let word = src_words[si];
        if last_word[sentence].is_none_or(|current| word > current) {
            last_word[sentence] = Some(word);
        }
    }
    // Sequential split: start = previous sentence end + 1; sentences with no matching word are skipped; the last sentence absorbs the tail.
    let mut mapped: Vec<Vec<MappedSentence>> = Vec::with_capacity(paragraphs.len());
    let mut cursor = range.start;
    let mut flat_index = 0;
    let total = flat.len();
    for paragraph in paragraphs {
        let mut group = Vec::new();
        for sentence in paragraph {
            let is_last = flat_index == total - 1;
            let end = if is_last {
                Some(range.end - 1)
            } else {
                last_word[flat_index].filter(|&word| word >= cursor)
            };
            if let Some(end) = end
                && cursor <= end
            {
                group.push(MappedSentence {
                    start: cursor,
                    end,
                    corrected: sentence.clone(),
                    fallback: false,
                });
                cursor = end + 1;
            }
            flat_index += 1;
        }
        if !group.is_empty() {
            mapped.push(group);
        }
    }
    // Unmatched source words at the tail are merged into the last sentence.
    if cursor < range.end
        && let Some(last) = mapped.last_mut().and_then(|group| group.last_mut())
    {
        last.end = range.end - 1;
    }
    if mapped.is_empty() {
        return Err(LlmError::Malformed(
            "LLM returned no valid sentences".to_owned(),
        ));
    }
    Ok(mapped)
}

/// Boundary polishing: adjacent boundaries are probed within a ±10-word window. A change is accepted only when “neither side gets worse and at least one side gets better,” and it must not break speaker consistency.
fn heal_boundaries(words: &[Word], flat: &mut [MappedSentence], analysis: Option<&Analysis>) {
    for index in 1..flat.len() {
        let (left, right) = {
            let (a, b) = flat.split_at_mut(index);
            (&mut a[index - 1], &mut b[0])
        };
        if left.corrected.is_empty() || right.corrected.is_empty() {
            continue;
        }
        let old_boundary = right.start;
        let lo = (old_boundary.saturating_sub(MAX_TAIL_GAP)).max(left.start + 1);
        let hi = (old_boundary + MAX_TAIL_GAP).min(right.end);
        let old_left = similarity(
            &similarity_text(&span_text(words, left.start, left.end), analysis),
            &similarity_text(&left.corrected, analysis),
        );
        let old_right = similarity(
            &similarity_text(&span_text(words, right.start, right.end), analysis),
            &similarity_text(&right.corrected, analysis),
        );
        let mut best: Option<(usize, f64, f64)> = None;
        for candidate in lo..=hi {
            if candidate == old_boundary {
                continue;
            }
            let moved = if candidate < old_boundary {
                candidate..old_boundary
            } else {
                old_boundary..candidate
            };
            let sp = &words[moved.start].sp;
            if words[moved.clone()].iter().any(|word| &word.sp != sp) {
                continue;
            }
            let candidate_left = similarity(
                &similarity_text(&span_text(words, left.start, candidate - 1), analysis),
                &similarity_text(&left.corrected, analysis),
            );
            let candidate_right = similarity(
                &similarity_text(&span_text(words, candidate, right.end), analysis),
                &similarity_text(&right.corrected, analysis),
            );
            let non_worse = candidate_left + HEAL_EPSILON >= old_left
                && candidate_right + HEAL_EPSILON >= old_right;
            let improves = candidate_left > old_left + HEAL_EPSILON
                || candidate_right > old_right + HEAL_EPSILON;
            if !(non_worse && improves) {
                continue;
            }
            let better = match best {
                None => true,
                Some((_, best_left, best_right)) => {
                    let key = (
                        candidate_left.min(candidate_right),
                        candidate_left + candidate_right,
                    );
                    let best_key = (best_left.min(best_right), best_left + best_right);
                    key.0 > best_key.0 + HEAL_EPSILON
                        || ((key.0 - best_key.0).abs() <= HEAL_EPSILON
                            && key.1 > best_key.1 + HEAL_EPSILON)
                }
            };
            if better {
                best = Some((candidate, candidate_left, candidate_right));
            }
        }
        if let Some((candidate, _, _)) = best {
            left.end = candidate - 1;
            right.start = candidate;
        }
    }
}

/// Fallback split (never fails): sentence-end punctuation or a 30-word cap; the original words are kept, and the whole page is one paragraph.
fn fallback_sentences(words: &[Word], range: std::ops::Range<usize>) -> Vec<MappedSentence> {
    let mut sentences = Vec::new();
    let mut start = range.start;
    let mut count = 0;
    for index in range.clone() {
        count += 1;
        // A cap that falls on a word seam inside a Thai-like phrase (the next word is attached to this one) is pushed forward to the end of the phrase, where the original text has a space or newline. If the phrase is absurdly long, it is hard-cut at twice the cap. Korean words built syllable by syllable before 0.5 are not in this set; their behaviour is unchanged.
        let capped = count >= MAX_FALLBACK_SENTENCE_WORDS
            && (count >= 2 * MAX_FALLBACK_SENTENCE_WORDS
                || !words.get(index + 1).is_some_and(is_script_glued));
        let boundary = sentence_end(&words[index].text) || capped;
        if boundary || index == range.end - 1 {
            sentences.push(MappedSentence {
                start,
                end: index,
                corrected: String::new(),
                fallback: true,
            });
            start = index + 1;
            count = 0;
        }
    }
    sentences
}

/// Sentence-final terminal punctuation and right-closing characters (consistent with the judgment in `atomize::sentence_end`; the specific abbreviation and decimal rules are still decided by `sentence_end`).
const RESPLIT_TERMINAL: &[char] = &['。', '．', '.', '？', '?', '！', '!', '…'];
const RESPLIT_CLOSERS: &[char] = &['”', '"', '’', '\'', '」', '』', '）', ')', ']', '》'];

/// Deterministically re-split an over-long corrected string at its sentence-end punctuation. The split decision reuses `sentence_end` (abbreviation, decimal and right-quote rules are consistent). Without any internal sentence-end punctuation, it is returned unchanged.
fn split_sentence_text(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut pieces: Vec<String> = Vec::new();
    let mut piece_start = 0usize;
    let mut index = 0usize;
    while index < chars.len() {
        if !RESPLIT_TERMINAL.contains(&chars[index]) {
            index += 1;
            continue;
        }
        // Skip at most one right-closing character, aligned with sentence_end's closers_skipped < 1.
        let mut cut = index + 1;
        if cut < chars.len() && RESPLIT_CLOSERS.contains(&chars[cut]) {
            cut += 1;
        }
        // Take the complete whitespace-delimited token containing the split point and pass it to sentence_end for judgment. The split point must fall exactly at the end of the token, otherwise “2.14” would be split at the decimal point. Full-width sentence-end punctuation does not depend on whitespace tokenization (CJK has no spaces), so it is allowed through separately.
        let token_start = chars[piece_start..cut]
            .iter()
            .rposition(|ch| ch.is_whitespace())
            .map_or(piece_start, |offset| piece_start + offset + 1);
        let token_end = chars[index..]
            .iter()
            .position(|ch| ch.is_whitespace())
            .map_or(chars.len(), |offset| index + offset);
        let token: String = chars[token_start..token_end].iter().collect();
        let wide_terminal = matches!(chars[index], '。' | '．' | '？' | '！');
        let rest_is_empty = chars[cut..].iter().all(|ch| ch.is_whitespace());
        if (wide_terminal || (cut == token_end && sentence_end(&token))) && !rest_is_empty {
            let piece: String = chars[piece_start..cut].iter().collect();
            let piece = piece.trim();
            if !piece.is_empty() {
                pieces.push(piece.to_owned());
            }
            piece_start = cut;
        }
        index = cut;
    }
    let tail: String = chars[piece_start..].iter().collect();
    let tail = tail.trim();
    if !tail.is_empty() {
        pieces.push(tail.to_owned());
    }
    if pieces.is_empty() {
        vec![text.to_owned()]
    } else {
        pieces
    }
}

/// Single-sentence span limit (dual measure: characters and duration). Exceeding it means this sentence swallowed a source-word span far beyond that of a normal sentence. The existing LCS ratio and similarity gate both give high scores to “the whole page echoed back unchanged.”
fn oversized_span(words: &[Word], sentence: &MappedSentence) -> Option<String> {
    let corrected_units = word_count(&sentence.corrected);
    let corrected_limit = paragraph_word_limit(&sentence.corrected);
    if corrected_units > corrected_limit {
        return Some(format!(
            "a single corrected sentence contains {corrected_units} display units (limit {corrected_limit}); add sentence-ending punctuation at semantic completions"
        ));
    }
    if is_cjk_text(&sentence.corrected)
        && corrected_units >= SENTENCE_MAX_WORDS
        && !sentence_end(&sentence.corrected)
    {
        return Some(format!(
            "a punctuation-starved CJK sentence contains {corrected_units} display units without terminal punctuation (semantic sentence cap {SENTENCE_MAX_WORDS}); add sentence-ending punctuation at complete thoughts"
        ));
    }
    let chars = span_chars(words, std::slice::from_ref(sentence));
    if chars > MAX_SENTENCE_SOURCE_CHARS {
        return Some(format!(
            "a single sentence covers {chars} source chars (limit {MAX_SENTENCE_SOURCE_CHARS})"
        ));
    }
    let seconds = words[sentence.end].t1 - words[sentence.start].t0;
    if seconds > MAX_SENTENCE_SPAN_SECONDS {
        return Some(format!(
            "a single sentence covers {seconds:.1}s of source audio (limit {MAX_SENTENCE_SPAN_SECONDS:.0}s)"
        ));
    }
    None
}

fn span_chars(words: &[Word], sentences: &[MappedSentence]) -> usize {
    sentences
        .iter()
        .map(|sentence| {
            words[sentence.start..=sentence.end]
                .iter()
                .map(|word| word.text.chars().count() + 1)
                .sum::<usize>()
        })
        .sum()
}

// ---- File contract (file-v1) path ----------------------------------------------

/// The material of one page-level attempt, for the host to write `ai/polish/vNNN/` (§4/§11). The shape is shared with translate via [`crate::filepipe::PageAttempt`].
pub type PolishPageAttempt<'a> = crate::filepipe::PageAttempt<'a>;

/// Lower bound on the core-region word count for worker-slot wave alignment (Decision 6). Below it, the pages are no longer split finer: pages that are too small lose the model's sequential reading context, which is not worth it.
pub const POLISH_FILE_MIN_CORE_WORDS: usize = 400;

/// The polish system prompt of the file contract (§6.3).
///
/// The output is plain text inside sentinel fences; paragraphs are separated by blank lines, and sentences are deterministically derived from sentence-end punctuation. The three injection points are: the permitted edits (checkbox options), language discipline, and the glossary, plus the user's extra instructions.
fn file_system_prompt(options: &PolishOptions) -> String {
    let checks = effective_checks(&options.enabled_checks);
    let operations = numbered_operations(&checks);
    let allows_removal = checks.contains("filler") || checks.contains("wordy");
    let coverage = if allows_removal {
        "Your output must cover the entire editable region in order and preserve all intended meaning. The only permitted omissions are unmistakable fillers or redundant words covered by the enabled checks."
    } else {
        "Your output must cover the ENTIRE editable region exactly once, in order — never drop, reorder, summarize, or add content."
    };
    let language = &options.language;
    let mut prompt = format!(
        r#"You are an expert in post-processing ASR (automatic speech recognition) transcripts.

You receive ONE page of a transcript as PLAIN TEXT delimited by sentinel fence lines:

{FENCE_CONTEXT_BEFORE}
…preceding transcript — READ-ONLY…
{FENCE_EDIT_BEGIN}
…the region you must revise…
{FENCE_EDIT_END}
…following transcript — READ-ONLY…
{FENCE_CONTEXT_AFTER}

Work by SEQUENTIAL READING REVISION: read the editable region from beginning to end and fix it as you go. This is a revision pass, never a rewrite or a summary.
Spoken grammatical awkwardness alone is not evidence of a recognition error. Unless grammar editing is enabled, preserve pronouns, tense and informal grammar; use context to correct misrecognition, not to improve the speaker's prose.

Enabled checks — perform ONLY these edits:
{operations}

Output contract — violating any of these makes the whole page unusable:
- Reproduce all four fence lines VERBATIM, each exactly once, in the order shown.
- Reproduce both read-only regions CHARACTER FOR CHARACTER — including their ⏸/⏹ markers, recognition errors, duplicated words, and awkward phrasing. They exist only to give you context; any "fix" there is discarded and gets the page rejected.
- Emit NOTHING outside the fences: no preamble, no closing remarks, no explanations.
- Never wrap the answer in a markdown code block (``` or ~~~) and never add headings, bullets, or numbering.
- Only the text between {FENCE_EDIT_BEGIN} and {FENCE_EDIT_END} may change.
- {coverage}

Line-break semantics inside the editable region:
- A SINGLE newline is a soft wrap only — no boundary meaning. Use it freely, or not at all.
- A BLANK LINE is a PARAGRAPH boundary. Insert one wherever the topic turns.
- Paragraphing is MANDATORY, not optional. Spoken-language paragraphs are short — usually 2 to 6 sentences. Any paragraph longer than {MAX_PARAGRAPH_WORDS_LATIN} words ({MAX_PARAGRAPH_WORDS_CJK} characters for Chinese/Japanese/Korean) FAILS segmentation validation and forces an extra repair round.
- An editable region of any real length therefore ALWAYS contains multiple paragraphs. Returning the whole region as one paragraph — or with no blank line at all — is a contract violation, exactly like dropping a fence line.
- Never use three or more consecutive newlines.
- PAGE SEAM: the editable region starts where the previous page ended, so its first sentence may simply continue the LAST paragraph shown in the read-only context above. If that first sentence starts a NEW paragraph (a different topic from the last paragraph of {FENCE_CONTEXT_BEFORE}), put exactly ONE blank line immediately after {FENCE_EDIT_BEGIN}, before the first sentence. If it continues that paragraph, start the text right after the fence. This leading blank line is the only place where a blank line at the very start of the region means anything; do not add one when the context region is empty.
- Sentences are derived deterministically from sentence-ending punctuation — a newline or blank line NEVER ends a sentence. Do NOT put one sentence per line and expect it to mean anything; punctuate properly instead.
- Close each complete thought with natural sentence-ending punctuation (`.?!` / `。？！`) AS YOU GO, especially in long pause-rich speech. A single derived sentence must stay far below {MAX_SENTENCE_SOURCE_CHARS} source characters or {MAX_SENTENCE_SPAN_SECONDS:.0} seconds of source audio; a page-sized run-on is accepted for its wording but is sent back for an extra punctuation-repair round, so punctuating properly the first time saves that round.
- A paragraph can split only BETWEEN sentences, so no individual sentence may itself exceed {MAX_PARAGRAPH_WORDS_LATIN} words ({MAX_PARAGRAPH_WORDS_CJK} characters for Chinese/Japanese/Korean). An over-limit sentence cannot be paragraphed until a later repair round has added punctuation to it. Extra newlines, blank lines, commas, or pause markers never substitute for real sentence-ending punctuation.
- Never end a sentence on a dangling connector, preposition, or incomplete lead-in (`because.`, `of.`, `当。`, `让。`, `和。`, `向。`). Join it to the following clause and end only after the thought is complete. A retry problem containing `dangling connector/preposition` names the exact false sentence end that must be removed.
- Never leave conflicting adjacent punctuation such as `。，`, `，。`, `，，`, `,,`, or `.,`; keep exactly one mark that expresses the intended boundary.
- In Chinese/Japanese/Korean speech, restore spaces inside obviously run-together spoken English phrases (`purereinforcementlearning` → `pure reinforcement learning`, book titles and job titles likewise). This is a mistaken word-boundary correction, not a translation; do not guess new content.

Markers in the source text:
- "⏸" / "⏸⏸" / "⏸⏸⏸" mark a short / medium / long pause. They are a soft hint only — a pause often falls mid-sentence, so split by MEANING, never solely because of a pause.
- "⏹" means the SPEAKER CHANGES right after that word. A sentence must NEVER span it, and it is ALWAYS a paragraph boundary — put a blank line there.
- A "⏹" may carry the incoming speaker's stable label, as in "⏹S2": everything after it is spoken by S2 until the next "⏹". Use the labels to follow who answers whom and which side a short "yeah" / "对" belongs to; the label is part of the marker, never a word.
- Both markers are metadata. NEVER copy "⏸", "⏹", or a speaker label such as "S2" into the EDITABLE region of your answer; inside the read-only regions keep them exactly as given.
- "{MARKER_HARD_CUT}" (outside the editable fences) means the page seam falls mid-sentence: it is NOT a paragraph boundary; keep reading across it.

Never translate, invent facts, reorder speech, or change the speaker's intended meaning. For Chinese and Japanese recognition/terminology checks, pay special attention to homophones and near-homophones.
The source language is "{language}". The text stays in the source language; words from OTHER languages appear only where the speaker actually used them (code-switching) — never as replacements for source-language words.
Follow the source script's spacing conventions: NEVER insert spaces between Chinese/Japanese/Korean characters."#
    );
    prompt.push_str(&reference_context_block(
        options.reference_context.as_deref(),
    ));
    if let Some(analysis) = &options.analysis {
        prompt.push_str(&format!(
            "\n\n\nContent overview: {}\n\nKnown correct spellings — when a similar-sounding or misspelled token refers to one of these, correct it to EXACTLY this form:\n{}",
            analysis.summary,
            format_for_prompt(analysis)
        ));
    }
    if let Some(instructions) = options.instructions.as_deref().filter(|s| !s.is_empty()) {
        prompt.push_str(&format!(
            "\n\nExtra instructions from the user: {instructions}"
        ));
    }
    prompt
}

/// `options.scope_ranges` → valid processing ranges, clamped to the word-stream length, with **adjacent or overlapping ones merged** (sorted by start).
///
/// The reason for merging: each scope is paginated independently ([`plan_scoped_pages`]). If `--paragraphs` passes dozens of consecutive paragraphs (the typical case: after `ccut check` reports `polish-fallback`, `fix` re-polishes a whole fallback page in a targeted way), without merging they would become dozens of single-paragraph small pages. The number of LLM calls would multiply several times, and every page would lack real context at its head and tail. After merging, consecutive paragraphs are paginated under the normal budget.
fn resolve_scopes(words: &[Word], options: &PolishOptions) -> Vec<Range<usize>> {
    if options.scope_ranges.is_empty() {
        return vec![0..words.len()];
    }
    let mut ranges: Vec<Range<usize>> = options
        .scope_ranges
        .iter()
        .filter_map(|range| {
            let start = range.start.min(words.len());
            let end = range.end.min(words.len());
            (start < end).then_some(start..end)
        })
        .collect();
    ranges.sort_by_key(|range| (range.start, range.end));
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.start <= last.end => {
                last.end = last.end.max(range.end);
            }
            _ => merged.push(range),
        }
    }
    merged
}

/// Capacity reconciliation between the paginator and the reattachment validator: if any page's core-region atom count exceeds [`polish_page_atom_capacity`], that is a paginator mismatch (see the comment on that function). It returns a terminal error, and the caller must not call the LLM or retry for it.
fn check_page_capacity(words: &[Word], plans: &[PolishPagePlan]) -> Result<(), LlmError> {
    let capacity = polish_page_atom_capacity();
    for plan in plans {
        let atoms: usize = words[plan.core.clone()]
            .iter()
            .map(|word| word_count(&word.text))
            .sum();
        if atoms > capacity {
            return Err(LlmError::Terminal(format!(
                "polish page {} too large: {atoms} source atoms exceed the validator capacity \
                 ({capacity}); the pager and the atom-LCS validator disagree — no answer could \
                 pass, so the page is not sent (words {}..{}). Narrow the run with --paragraphs \
                 and report this as a bug.",
                plan.id, plan.core.start, plan.core.end
            )));
        }
    }
    Ok(())
}

/// Paginate each scope separately and shift in-page indices back to global ones; page ids are numbered consecutively across the whole document.
fn plan_scoped_pages(
    words: &[Word],
    scopes: &[Range<usize>],
    budget: &PolishBudget,
) -> Vec<PolishPagePlan> {
    let shift = |range: &Range<usize>, delta: usize| (range.start + delta)..(range.end + delta);
    let mut plans: Vec<PolishPagePlan> = Vec::new();
    for scope in scopes {
        for plan in plan_polish_pages(&words[scope.clone()], budget) {
            plans.push(PolishPagePlan {
                id: String::new(),
                before: shift(&plan.before, scope.start),
                core: shift(&plan.core, scope.start),
                after: shift(&plan.after, scope.start),
                hard_cut_start: plan.hard_cut_start,
                hard_cut_end: plan.hard_cut_end,
                para_starts: plan
                    .para_starts
                    .iter()
                    .map(|index| index + scope.start)
                    .collect(),
            });
        }
    }
    for (index, plan) in plans.iter_mut().enumerate() {
        plan.id = format!("p{:03}", index + 1);
    }
    plans
}

/// Decision 6: the page budget is an **upper bound**, not a target. First paginate once with the default budget. Only if the page count cannot fill the worker slots, and the total word count spread across the slots still stays at or above [`POLISH_FILE_MIN_CORE_WORDS`], is the core-region budget lowered to `ceil(total core words / slot count)` and re-paginated once. The re-paginated result is adopted only if it actually yields more pages.
fn plan_polish_file_pages(
    words: &[Word],
    scopes: &[Range<usize>],
    worker_slots: Option<usize>,
) -> Vec<PolishPagePlan> {
    let budget = PolishBudget::default();
    let plans = plan_scoped_pages(words, scopes, &budget);
    // When the slot count is unknown (`None`) or concurrency is unlimited (`usize::MAX`), the wave cannot be computed, so the page count follows the budget. The shape matches translate's same-named criterion, but the lower bound is `>1` rather than `>0`: translate also uses the slot count to choose a row-count tier, where one slot is meaningful. Here it only means “split finer if the pages cannot fill the slots,” and one slot triggers no re-pagination, the same as no slots.
    let Some(slots) = worker_slots.filter(|slots| *slots > 1 && *slots < usize::MAX) else {
        return plans;
    };
    if plans.len() >= slots || plans.is_empty() {
        return plans;
    }
    let total: usize = scopes
        .iter()
        .flat_map(|scope| words[scope.clone()].iter())
        .map(|word| word_count(&word.text).max(1))
        .sum();
    let target = total.div_ceil(slots);
    if target < POLISH_FILE_MIN_CORE_WORDS || target >= budget.core_words {
        return plans;
    }
    let tuned = plan_scoped_pages(
        words,
        scopes,
        &PolishBudget {
            core_words: target,
            ..budget
        },
    );
    if tuned.len() > plans.len() {
        tuned
    } else {
        plans
    }
}

/// Paragraph text → sentence list: sentence-end punctuation is deterministically derived (§6.1).
///
/// Deliberately **not re-chunked**: re-packing paragraphs would create paragraph boundaries that come neither from blank lines nor from ⏹, violating Decision 4 (“paragraph grouping is the truth of blank lines”). An over-long sentence without sentence-end punctuation is kept here as one sentence. [`split_sentence_text`] only recognizes punctuation, so splitting it again would add no boundaries (an earlier 900-character “re-cut” was exactly such a no-op). Those sentences are handed to [`punct_repair_wave`] to receive punctuation.
fn file_page_sentences(paragraphs: &[String]) -> Vec<Vec<String>> {
    let mut out: Vec<Vec<String>> = Vec::with_capacity(paragraphs.len());
    for paragraph in paragraphs {
        let sentences: Vec<String> = split_sentence_text(paragraph)
            .into_iter()
            .map(|sentence| sanitize_corrected(&sentence))
            .filter(|sentence| !sentence.is_empty())
            .collect();
        if !sentences.is_empty() {
            out.push(sentences);
        }
    }
    out
}

/// The byte index of the next non-whitespace character after skipping `target` non-whitespace characters.
///
/// [`atomize`] preserves order and is lossless apart from whitespace (the atoms concatenated equal the text minus whitespace), so an atom index can be deterministically converted into a character offset, with no atom-to-offset table to fabricate.
fn nonspace_char_index(text: &str, target: usize) -> Option<usize> {
    let mut seen = 0usize;
    for (index, ch) in text.char_indices() {
        if ch.is_whitespace() {
            continue;
        }
        if seen == target {
            return Some(index);
        }
        seen += 1;
    }
    None
}

/// atom-LCS alignment of one corrected sentence with its source word range.
///
/// The LCS uses normalized keys ([`atom_key`] drops pure-punctuation atoms), while character offsets use the character counts of the original atoms. The two yardsticks are kept separate, so `matches` has already been converted into strictly increasing pairs of (global source word index, `atoms` index), where `atoms` are the original atoms of corrected (including trailing punctuation).
struct SentenceAlignment {
    atoms: Vec<String>,
    matches: Vec<(usize, usize)>,
}

fn sentence_alignment(words: &[Word], sentence: &MappedSentence) -> Option<SentenceAlignment> {
    let mut interner = AtomInterner::default();
    let mut src_keys: Vec<u32> = Vec::new();
    let mut src_words: Vec<usize> = Vec::new();
    // The atoms here are more than comparison keys: sentence splitting and the search for clause punctuation both land on atom boundaries, so the word-level unit is used (a Korean eojeol is one atom, so cut points never fall inside a word). The older syllable-by-syllable ranges kept per-syllable granularity, so the two sides matched. For ranges split word by word, such as Thai, the source words are themselves atoms (fed alone to a word-segmentation model, they might be split into two pieces), so the rewritten side is cut anchored at those words.
    let span = &words[sentence.start..=sentence.end];
    for index in sentence.start..=sentence.end {
        for atom in atomize_word_like(span, &words[index].text) {
            if let Some(key) = atom_key(&atom) {
                src_keys.push(interner.intern(&key));
                src_words.push(index);
            }
        }
    }
    let atoms = atomize_like(span, &sentence.corrected);
    let mut out_keys: Vec<u32> = Vec::new();
    let mut out_atom: Vec<usize> = Vec::new();
    for (position, atom) in atoms.iter().enumerate() {
        if let Some(key) = atom_key(atom) {
            out_keys.push(interner.intern(&key));
            out_atom.push(position);
        }
    }
    if src_keys.is_empty() || out_keys.is_empty() {
        return None;
    }
    let matches = lcs_matches(&src_keys, &out_keys, LCS_CELL_CAP)?
        .into_iter()
        .map(|(si, oi)| (src_words[si], out_atom[oi]))
        .collect();
    Some(SentenceAlignment { atoms, matches })
}

/// Use atom-LCS to find the position in corrected where “source word `boundary` starts,” and cut there.
fn split_corrected_at_word(
    words: &[Word],
    sentence: &MappedSentence,
    boundary: usize,
) -> Option<(String, String)> {
    let alignment = sentence_alignment(words, sentence)?;
    let split_atom = alignment
        .matches
        .iter()
        .find(|(word, _)| *word >= boundary)
        .map(|(_, atom)| *atom)?;
    if split_atom == 0 {
        return None;
    }
    let target: usize = alignment.atoms[..split_atom]
        .iter()
        .map(|atom| atom.chars().count())
        .sum();
    let index = nonspace_char_index(&sentence.corrected, target)?;
    let left = sentence.corrected[..index].trim_end().to_owned();
    let right = sentence.corrected[index..].trim_start().to_owned();
    if left.is_empty() || right.is_empty() {
        return None;
    }
    Some((left, right))
}

/// Split a sentence into two at source word `boundary` (`boundary` is the first word of the right half).
fn split_sentence_at_word(
    words: &[Word],
    sentence: &MappedSentence,
    boundary: usize,
) -> Option<(MappedSentence, MappedSentence)> {
    if boundary <= sentence.start || boundary > sentence.end {
        return None;
    }
    // The fallback sentence's corrected text is empty (the text equals the original words), so cutting the range is enough.
    let (left_text, right_text) = if sentence.corrected.is_empty() {
        (String::new(), String::new())
    } else {
        split_corrected_at_word(words, sentence, boundary)?
    };
    Some((
        MappedSentence {
            start: sentence.start,
            end: boundary - 1,
            corrected: left_text,
            fallback: sentence.fallback,
        },
        MappedSentence {
            start: boundary,
            end: sentence.end,
            corrected: right_text,
            fallback: sentence.fallback,
        },
    ))
}

/// Decision 3: the ⏹ hard guarantee on the non-verbatim path.
///
/// **Ordering invariant**: must be called after [`heal_boundaries`]. Heal moves sentence boundaries within a ±10-word window, so a forced boundary placed earlier would be moved away by it; no heal may run after this.
/// [`low_similarity_retry`] only rewrites `corrected`/`fallback` and never touches `start`/`end`, so forced boundaries survive single-sentence retries.
///
/// For each speaker-change word index W: if it hits a sentence start, it is pinned directly as a paragraph start. If it falls mid-sentence, atom-LCS is first used to split the sentence precisely; only if that cannot cut does it degrade to snapping to that sentence's start, counting one `snapped`.
fn enforce_forced_boundaries(
    words: &[Word],
    groups: Vec<Vec<MappedSentence>>,
    forced: &[usize],
    snapped: &mut u32,
) -> Vec<Vec<MappedSentence>> {
    let mut flat: Vec<MappedSentence> = Vec::new();
    let mut starts: BTreeSet<usize> = BTreeSet::new();
    for group in groups {
        if group.is_empty() {
            continue;
        }
        starts.insert(flat.len());
        flat.extend(group);
    }
    if flat.is_empty() {
        return Vec::new();
    }
    for &boundary in forced {
        // The first page's start is already a new paragraph (pages are naturally separated in `committed`).
        if boundary <= flat[0].start {
            continue;
        }
        let Some(index) = flat
            .iter()
            .position(|sentence| sentence.start <= boundary && boundary <= sentence.end)
        else {
            continue;
        };
        if flat[index].start == boundary {
            starts.insert(index);
            continue;
        }
        match split_sentence_at_word(words, &flat[index], boundary) {
            Some((left, right)) => {
                flat[index] = left;
                flat.insert(index + 1, right);
                starts = starts
                    .iter()
                    .map(|&slot| if slot > index { slot + 1 } else { slot })
                    .collect();
                starts.insert(index + 1);
            }
            None => {
                *snapped += 1;
                starts.insert(index);
            }
        }
    }
    let mut out: Vec<Vec<MappedSentence>> = Vec::new();
    for (index, sentence) in flat.into_iter().enumerate() {
        if out.is_empty() || starts.contains(&index) {
            out.push(Vec::new());
        }
        out.last_mut().expect("group just pushed").push(sentence);
    }
    out
}

fn summarize_problems(problems: &[Problem]) -> String {
    if problems.is_empty() {
        return "unspecified".to_owned();
    }
    problems
        .iter()
        .map(|problem| format!("{}: {}", problem.code, problem.detail))
        .collect::<Vec<_>>()
        .join("; ")
}

fn malformed_detail(error: &LlmError) -> String {
    match error {
        LlmError::Malformed(detail) => detail.clone(),
        other => other.to_string(),
    }
}

/// The half of the check that needs **the word stream as ground truth** (the other half is in [`lint_polish_page`]).
///
/// Returning `None` rejects the whole page. When it does, at least one §10 problem must have been added to `problems`, otherwise the rejection artifact the host writes would be an empty ledger with no reason.
///
/// Paragraph-segmentation degradation (a single paragraph over the limit) does not appear here: the main polish lint does not produce ParagraphOversize, the body is accepted on the first round, and degraded paragraphs are targeted by [`segment_repair_wave`] after the wave. A single over-long sentence ([`oversized_span`]) likewise **does not reject the page**: the body is accepted first, and the over-long sentence is handled by a targeted, sentence-end-only repair in [`punct_repair_wave`]. Re-rolling the whole page would only re-roll every sentence, while the words of an over-long sentence are usually not wrong.
fn validate_polish_file_page(
    words: &[Word],
    plan: &PolishPagePlan,
    parsed: &PolishParsed,
    analysis: Option<&Analysis>,
    problems: &mut Vec<Problem>,
    snapped: &mut u32,
) -> Option<Vec<Vec<MappedSentence>>> {
    if !problems.is_empty() {
        return None;
    }
    let core = plan.core.clone();
    if core.is_empty() {
        return Some(Vec::new());
    }
    let paragraphs = file_page_sentences(&parsed.paragraphs);
    if paragraphs.is_empty() {
        problems.push(Problem::page(
            ProblemCode::DocumentTruncated,
            &plan.id,
            "No usable sentences in the core region",
        ));
        return None;
    }
    let mut mapped = match map_corrected_page(words, core.clone(), &paragraphs) {
        Ok(mapped) => mapped,
        Err(error) => {
            problems.push(Problem::page(
                ProblemCode::SourceDrift,
                &plan.id,
                malformed_detail(&error),
            ));
            return None;
        }
    };
    let mut flat: Vec<MappedSentence> = mapped.iter().flatten().cloned().collect();
    heal_boundaries(words, &mut flat, analysis);
    let mut cursor = 0;
    for group in &mut mapped {
        for slot in group.iter_mut() {
            *slot = flat[cursor].clone();
            cursor += 1;
        }
    }
    let mapped = enforce_forced_boundaries(words, mapped, &parsed.forced_boundaries, snapped);
    let flat: Vec<MappedSentence> = mapped.iter().flatten().cloned().collect();
    if flat.is_empty() {
        problems.push(Problem::page(
            ProblemCode::DocumentTruncated,
            &plan.id,
            "No usable sentences in the core region",
        ));
        return None;
    }
    // The similarity gate **no longer rejects the page** (retry-strategy redesign §2.2). A low-similarity sentence is a unit-level failure and goes directly into the sentence-level retry queue of `polish-retry` ([`low_similarity_retry`]); when that is exhausted, it reverts to the original words sentence by sentence. The old rule “more than 30% of sentences failing the gate ⇒ whole-page SourceDrift” would reject an entire page for re-roll because one of two sentences failed. Page-level SourceDrift now remains only for atom-LCS mapping failures (coverage below 0.7, no mappable sentence, LCS table too large), which are the genuine whole-page rewrites.
    Some(mapped)
}

/// Full polish under the file contract (`file-v1`) (§6).
///
/// **Whole pages in parallel, no carry-over** (Decision 1): each page is one independent `LlmRequest`. There is no serial data dependency between pages; sequential reading context is kept by read-only context fences.
///
/// Ladder (§6.4): retry the whole page up to [`MAX_RETRIES`] times → if it still fails, fall back to the page's original text (counted in `fallback_pages`) → after all pages finish, run [`low_similarity_retry`] uniformly (still the single-round JSON contract of `polish-retry`, Decision 5) → if a single sentence still fails, revert it to the original text (counted in `fallback_sentences`).
///
/// `paraBreaks` / `stages.segment` are derived from “blank lines + ⏹ forced boundaries” (Decision 4). All other semantics fully reuse [`apply`]: paragraph pins are written only when `doc.stages.segment.is_none()`, still go through `ensure_balanced_cue_layout` (the results enter `autoBreaks`), and still stamp `stages.polish` / `stages.asr_layout`.
pub fn run_polish_file_contract(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &PolishOptions,
    ids: &mut dyn IdSource,
    sleep: &mut dyn FnMut(f64),
    on_attempt: &mut dyn FnMut(&PolishPageAttempt<'_>),
) -> Result<PolishOutcome, LlmError> {
    let mut outcome = PolishOutcome::default();
    if doc.words.is_empty() {
        return Ok(outcome);
    }
    // Speaker-attribution semantic repair runs before paging. ⏹ is a hard guarantee below (sentences must not cross it, and it must start a paragraph), so fragments with wrong attribution would be forced into standalone sentences. What is changed here is only `words[].sp`.
    crate::engines::speaker_repair::speaker_repair_wave(
        doc,
        llm,
        options.speaker_repair,
        !options.scope_ranges.is_empty(),
        &mut outcome.speaker_repair,
        on_attempt,
    )?;
    let words = doc.words.clone();
    let scopes = resolve_scopes(&words, options);
    let plans = plan_polish_file_pages(&words, &scopes, options.worker_slots);
    if plans.is_empty() {
        return Ok(outcome);
    }
    check_page_capacity(&words, &plans)?;
    let system = file_system_prompt(options);
    let analysis = options.analysis.as_ref();
    let prepared: Vec<(PolishPagePlan, String)> = plans
        .into_iter()
        .map(|plan| {
            let rendered = render_polish_page(&words, &plan).text;
            (plan, rendered)
        })
        .collect();
    let requests: Vec<LlmRequest> = prepared
        .iter()
        .map(|(_, input)| LlmRequest {
            kind: "polish",
            system: system.clone(),
            user: input.clone(),
            temperature: 0.2,
            attempt: 1,
            retry_reason: None,
        })
        .collect();

    let mut accepted: Vec<Option<Vec<Vec<MappedSentence>>>> =
        (0..prepared.len()).map(|_| None).collect();
    let mut tries = vec![0_u32; prepared.len()];
    let mut snapped = 0_u32;
    // Explicit page-seam signal (§6.2): the next page starts its core region with a blank line, meaning its first paragraph begins a new one. The first page has no preceding context, and a hard-cut page seam is the continuation of a broken sentence; neither counts as a signal.
    let mut seam_signals = vec![false; prepared.len()];
    // Paragraph-segmentation degradation is only worth repairing when this polish run is responsible for producing the paragraph pins. A re-polish of a `stages.segment`-stamped document writes no `paraBreaks`, so the restored blank lines would have nowhere to go; let it pass directly.
    let enforce_paragraphs = doc.stages.segment.is_none();
    let wave = complete_batch_retry_report(
        llm,
        &requests,
        RetryPolicy::MAX_PAGE_ATTEMPTS,
        sleep,
        &mut |index, raw| {
            tries[index] += 1;
            let (plan, input) = &prepared[index];
            let parsed = parse_polish_page(&words, plan, input, raw);
            seam_signals[index] = parsed.starts_new_paragraph
                && index > 0
                && !plan.hard_cut_start
                && !plan.before.is_empty();
            let mut problems = parsed.diagnostics.problems.clone();
            let mapped = validate_polish_file_page(
                &words,
                plan,
                &parsed,
                analysis,
                &mut problems,
                &mut snapped,
            );
            debug_assert!(
                mapped.is_some() || !problems.is_empty(),
                "rejected polish page must carry at least one problem"
            );
            // Accept on the first round: once mapping succeeds, accept the body and do not burn whole-page retries for paragraph degradation, since that would only re-roll every sentence. Degraded paragraphs are targeted by segment-repair after the wave.
            let pass = mapped.is_some();
            on_attempt(&PolishPageAttempt {
                page_id: &plan.id,
                attempt: tries[index],
                input,
                output: raw,
                problems: &problems,
                accepted: pass,
            });
            match (pass, mapped) {
                (true, Some(mapped)) => Ok(mapped),
                _ => Err(LlmError::Malformed(format!(
                    "polish page {} rejected — {}",
                    plan.id,
                    summarize_problems(&problems)
                ))),
            }
        },
        &mut |_, error| error.to_string(),
        &mut |index, mapped: Vec<Vec<MappedSentence>>| {
            accepted[index] = Some(mapped);
        },
    )?;

    // R3, reject means narrow: a page whose whole-page attempts are exhausted is first re-planned by halving (same paginator, same context budget), and each half is sent once. Only half-pages that still fail fall back to the original words. Total call volume is the same order of magnitude as the old three whole-page retries, and the fallback granularity is halved.
    let failed_pages: Vec<usize> = wave.failed.into_iter().map(|(index, _)| index).collect();
    let mut split_groups: BTreeMap<usize, Vec<Vec<Vec<MappedSentence>>>> = BTreeMap::new();
    if RetryPolicy::SPLIT_THEN && !failed_pages.is_empty() {
        split_polish_pages(
            &words,
            &prepared,
            &failed_pages,
            llm,
            &system,
            analysis,
            sleep,
            &mut snapped,
            &mut outcome,
            &mut split_groups,
            on_attempt,
        )?;
    }

    let mut per_page: Vec<Vec<Vec<MappedSentence>>> = Vec::with_capacity(prepared.len());
    for (index, (plan, _)) in prepared.iter().enumerate() {
        let groups = match accepted[index].take() {
            Some(groups) => groups,
            None => match split_groups.remove(&index) {
                Some(halves) => halves.into_iter().flatten().collect(),
                None => {
                    outcome.fallback_pages += 1;
                    let forced = crate::filepipe::polish_txt::forced_boundaries(&words, plan);
                    enforce_forced_boundaries(
                        &words,
                        vec![fallback_sentences(&words, plan.core.clone())],
                        &forced,
                        &mut snapped,
                    )
                }
            },
        };
        per_page.push(groups);
    }
    let plans: Vec<&PolishPagePlan> = prepared.iter().map(|(plan, _)| plan).collect();
    // Hard-cut page seam: the page boundary falls mid-sentence with no usable break point, and the two sides are two halves of the same sentence. The contract already tells the model that “HARD-CUT is not a paragraph boundary,” and the engine likewise must not pin a paragraph here: it unconditionally merges the next page's first paragraph into the previous page's last paragraph.
    if enforce_paragraphs {
        outcome.hard_cut_seams_merged = merge_hard_cut_seams(&plans, &mut per_page);
    }
    // Map per-page groups to global groups, recording each page's group range in `committed`, for addressing by the seam wave.
    let mut committed: Vec<Vec<MappedSentence>> = Vec::new();
    let mut page_spans: Vec<std::ops::Range<usize>> = Vec::with_capacity(per_page.len());
    for groups in per_page {
        let start = committed.len();
        committed.extend(groups);
        page_spans.push(start..committed.len());
    }
    // Page-seam candidates: seams that are not hard cuts, not speaker changes, and whose next page does not explicitly declare “start a new paragraph.” Pagination only cuts start points, so a page seam is not paragraph evidence. These seams are judged by the seam-repair wave after punct-repair has finalized the sentences: if the model says continuation they are merged; if it says boundary (or rejects), they are kept.
    let seams: Vec<usize> = if enforce_paragraphs {
        seam_candidates(&words, &plans, &page_spans, &seam_signals, &mut outcome)
    } else {
        Vec::new()
    };

    // Targeted punctuation repair: after the main wave accepts the body on the first round, the sentences that still exceed the single-sentence span limit are gathered together and paginated again, asking only for sentence-end punctuation (the punct-repair carrier). When the rounds run out, they are split deterministically along the source timeline, guaranteeing no over-long sentence at the exit. This must run before the single-sentence similarity retry and the paragraph-splitting repair: paragraph splitting can only insert seams between sentences, and an over-long sentence cannot be inserted into seamlessly until it has been cut.
    punct_repair_wave(
        &words,
        &mut committed,
        llm,
        options,
        &mut outcome,
        on_attempt,
    )?;

    low_similarity_retry(&words, &mut committed, llm, options, analysis, &mut outcome)?;
    if options.autocorrect {
        autocorrect_mapped_sentences(&words, &mut committed);
    }
    // Seam judgment: the tail window of page k's last paragraph and the head window of page k+1's first paragraph are concatenated into one block and sent back; the answer returns only line ranges (the seam-repair index carrier, the same as segment-repair). It must run before paragraph-splitting repair, because paragraph splitting re-groups and changes group indices, while page seams are addressed by group index.
    if enforce_paragraphs && !seams.is_empty() {
        seam_repair_wave(&words, &mut committed, seams, llm, &mut outcome, on_attempt)?;
    }
    // Targeted paragraph splitting: after the main wave accepts the body on the first round, paragraphs still over the limit are sent back chunk by chunk, asking only for line-range answers (the segment-repair index carrier). When the rounds run out, they are closed out deterministically by pause level. Single large blocks from whole-page fallback pages and large paragraphs merged across page seams are also split here.
    if enforce_paragraphs {
        segment_repair_wave(&words, &mut committed, llm, &mut outcome, on_attempt)?;
    }
    // Paragraph-segmentation quality check: paragraphs still over the limit after targeted splitting and deterministic close-out count as paragraph-segmentation degradation. The close-out guarantees that a multi-sentence paragraph can always be split, so this is normally always 0. If any remain, the polished text is applied as usual, but `stages.segment` is not stamped; never fabricate `segment: fresh`. A re-polish that has already been stamped produces no paragraph pins, so there is no “degradation” to speak of; it always records 0, so the CLI does not raise false warnings.
    outcome.degenerate_paragraphs = if enforce_paragraphs {
        committed
            .iter()
            .filter(|group| paragraph_group_oversized(&words, group))
            .count() as u32
    } else {
        0
    };
    apply(
        doc,
        &words,
        committed,
        ids,
        options.cue_max_chars,
        &options.enabled_checks,
        outcome.degenerate_paragraphs == 0,
        &mut outcome,
    );
    // The real-name inference for speakers runs at the end. It must come after speaker-repair (that wave may absorb an entire false cluster) and after the body is written to disk (polished text has punctuation, which makes third-party introductions much easier to read). It writes only `speakers[].name`, does not enter the fingerprint, and does not affect any stage stamp.
    crate::engines::speaker_names::speaker_names_wave(
        doc,
        llm,
        options.speaker_names,
        !options.scope_ranges.is_empty(),
        options.reference_context.as_deref(),
        options
            .analysis
            .as_ref()
            .map(|analysis| analysis.summary.as_str()),
        options
            .analysis
            .as_ref()
            .map(|analysis| analysis.named_entities.as_slice())
            .unwrap_or_default(),
        &mut outcome.speaker_names,
        on_attempt,
    )?;
    outcome.forced_boundary_snapped = snapped;
    Ok(outcome)
}

/// Re-plan one page's core-region word range into sub-pages by halving (R3, “reject means narrow”).
///
/// It reuses the same paginator, [`plan_polish_pages`]: the core budget is half the original core-region word cost, so the cut points still land on sentence boundaries, pauses and speaker boundaries rather than at a blind midpoint. The outer read-only context ends reuse the original page (the first sub-page's `before` and the last sub-page's `after`), and the inner ones are chosen by the paginator. When it cannot cut at least two pages (too short, or no break point at all), it returns an empty Vec, and the caller goes straight to the original whole-page fallback.
fn split_page_plan(words: &[Word], plan: &PolishPagePlan) -> Vec<PolishPagePlan> {
    let core = plan.core.clone();
    if core.len() < 2 {
        return Vec::new();
    }
    let cost: usize = words[core.clone()]
        .iter()
        .map(|word| word_count(&word.text).max(1))
        .sum();
    let budget = PolishBudget {
        core_words: (cost / 2).max(1),
        ..PolishBudget::default()
    };
    let sub = plan_polish_pages(&words[core.clone()], &budget);
    if sub.len() < 2 {
        return Vec::new();
    }
    let shift = |range: &Range<usize>| (range.start + core.start)..(range.end + core.start);
    let last = sub.len() - 1;
    sub.iter()
        .enumerate()
        .map(|(index, part)| PolishPagePlan {
            id: format!("{}-h{}", plan.id, index + 1),
            before: if index == 0 {
                plan.before.clone()
            } else {
                shift(&part.before)
            },
            core: shift(&part.core),
            after: if index == last {
                plan.after.clone()
            } else {
                shift(&part.after)
            },
            hard_cut_start: if index == 0 {
                plan.hard_cut_start
            } else {
                part.hard_cut_start
            },
            hard_cut_end: if index == last {
                plan.hard_cut_end
            } else {
                part.hard_cut_end
            },
            para_starts: plan.para_starts.clone(),
        })
        .collect()
}

/// The halving-and-narrowing retry wave: each failed page is cut into several half-pages, and all the half-pages are sent out **as one batch** (one attempt each). Succeeding half-pages are stored as usual, and failing half-pages fall back only their own half.
///
/// `split_groups[page]` is the sequence of groups for that page, arranged in half-page order. A page that cannot be cut as a whole is not entered into the table, and the caller falls back to the whole-page fallback.
#[allow(clippy::too_many_arguments)]
fn split_polish_pages(
    words: &[Word],
    prepared: &[(PolishPagePlan, String)],
    failed_pages: &[usize],
    llm: &mut dyn LlmJson,
    system: &str,
    analysis: Option<&Analysis>,
    sleep: &mut dyn FnMut(f64),
    snapped: &mut u32,
    outcome: &mut PolishOutcome,
    split_groups: &mut BTreeMap<usize, Vec<Vec<Vec<MappedSentence>>>>,
    on_attempt: &mut dyn FnMut(&PolishPageAttempt<'_>),
) -> Result<(), LlmError> {
    // (original page index, half-page sequence number, plan, rendered text)
    let mut halves: Vec<(usize, usize, PolishPagePlan, String)> = Vec::new();
    for &page in failed_pages {
        let parts = split_page_plan(words, &prepared[page].0);
        if parts.is_empty() {
            continue;
        }
        for (slot, part) in parts.into_iter().enumerate() {
            let rendered = render_polish_page(words, &part).text;
            halves.push((page, slot, part, rendered));
        }
    }
    if halves.is_empty() {
        return Ok(());
    }
    outcome.split_retry_pages += halves.len() as u32;
    let requests: Vec<LlmRequest> = halves
        .iter()
        .map(|(_, _, _, input)| LlmRequest {
            kind: "polish",
            system: system.to_owned(),
            user: input.clone(),
            temperature: 0.2,
            attempt: RetryPolicy::MAX_PAGE_ATTEMPTS + 1,
            retry_reason: Some(
                "the full page failed validation twice; this request covers only half of it — \
                 reproduce every spoken word of the editable core between the fences"
                    .to_owned(),
            ),
        })
        .collect();
    let mut accepted: Vec<Option<Vec<Vec<MappedSentence>>>> =
        (0..halves.len()).map(|_| None).collect();
    complete_batch_retry_report(
        llm,
        &requests,
        1,
        sleep,
        &mut |index, raw| {
            let (_, _, plan, input) = &halves[index];
            let parsed = parse_polish_page(words, plan, input, raw);
            let mut problems = parsed.diagnostics.problems.clone();
            let mapped =
                validate_polish_file_page(words, plan, &parsed, analysis, &mut problems, snapped);
            on_attempt(&PolishPageAttempt {
                page_id: &plan.id,
                attempt: RetryPolicy::MAX_PAGE_ATTEMPTS + 1,
                input,
                output: raw,
                problems: &problems,
                accepted: mapped.is_some(),
            });
            mapped.ok_or_else(|| {
                LlmError::Malformed(format!(
                    "polish page {} rejected — {}",
                    plan.id,
                    summarize_problems(&problems)
                ))
            })
        },
        &mut |_, error| error.to_string(),
        &mut |index, mapped: Vec<Vec<MappedSentence>>| accepted[index] = Some(mapped),
    )?;

    for (index, (page, slot, plan, _)) in halves.iter().enumerate() {
        let groups = match accepted[index].take() {
            Some(groups) => groups,
            None => {
                outcome.fallback_pages += 1;
                let forced = crate::filepipe::polish_txt::forced_boundaries(words, plan);
                enforce_forced_boundaries(
                    words,
                    vec![fallback_sentences(words, plan.core.clone())],
                    &forced,
                    snapped,
                )
            }
        };
        let slots = split_groups.entry(*page).or_default();
        debug_assert_eq!(
            slots.len(),
            *slot,
            "half-page results must be placed in order"
        );
        slots.push(groups);
    }
    Ok(())
}

/// The final-standard text of a sentence: the polished text if available, otherwise the original words.
fn final_sentence_text(words: &[Word], sentence: &MappedSentence) -> String {
    if sentence.corrected.is_empty() {
        span_text(words, sentence.start, sentence.end)
    } else {
        sentence.corrected.clone()
    }
}

/// Whether the word count of a paragraph group (final-standard text) exceeds the single-paragraph limit.
/// Same yardstick as [`parse_segment_repair_page`]: `word_count` plus the language-tier threshold.
fn paragraph_group_oversized(words: &[Word], group: &[MappedSentence]) -> bool {
    let text = group
        .iter()
        .map(|sentence| final_sentence_text(words, sentence))
        .collect::<Vec<_>>()
        .join(" ");
    word_count(&text) > paragraph_word_limit(&text)
}

/// System prompt of segment-repair (index contract).
///
/// Deliberately independent of batch composition (it does not embed the language or word count of particular paragraphs): the agent executor stores contract files by (kind, attempt), so requests in the same wave must share the same system prompt. Both tier thresholds are stated together, and the model takes whichever yardstick the block header gives it.
fn segment_repair_system_prompt() -> String {
    format!(
        r#"You are fixing paragraph segmentation in a transcript that has already been copy-edited.

You receive ONE OR MORE over-long paragraphs as PLAIN TEXT. Each paragraph is a block between a header fence and an end fence, ONE SENTENCE PER LINE, every line prefixed with its 1-based line number:

{FENCE_BLOCK_PREFIX} 1 | 63 sentences | 1832 characters | at least 4 paragraphs>>>
1| first sentence…
2| second sentence…
…
63| last sentence…
{FENCE_BLOCK_END}

Split EVERY block into several paragraphs. Answer with LINE-NUMBER RANGES ONLY — do NOT copy any sentence text back:

{FENCE_BLOCK_PREFIX} 1>>>
1-14
15-30
31-47
48-63
{FENCE_BLOCK_END}

Rules:
- One range `a-b` per line, in reading order. Ranges must start at 1, be contiguous (each starts right after the previous one ends), and end at the block's last line — no gaps, no overlaps, no numbers outside the block.
- Each range is one paragraph. Break at every topic or semantic turn: a new question, a new example, a shift in time/place/subject, the end of a story or argument.
- Spoken-language paragraphs are short — usually 2 to 6 sentences.
- Every resulting paragraph must stay at or under {MAX_PARAGRAPH_WORDS_LATIN} words ({MAX_PARAGRAPH_WORDS_CJK} characters for Chinese/Japanese/Korean). The header of each block tells you its size and the MINIMUM number of paragraphs it needs; give at least that many ranges — more is fine when the topics justify it. Blocks are validated one by one; a block that still has an over-long range is sent back to you again.
- Answer for every block, in the same order, each with its own `{FENCE_BLOCK_PREFIX} k>>>` … `{FENCE_BLOCK_END}` fences, and emit NOTHING else: no sentence text, no preamble, no explanations, no code block wrapper."#
    )
}

/// Overflow tolerance: if the sub-groups cut from the model's boundaries exceed the single-paragraph limit by less than this proportion, no further LLM round is spent. The engine deterministically re-cuts within the sub-group by pause level (pure capacity convergence, such as 584→526). If it exceeds the tolerance, the next round carries targeted feedback so the model splits by meaning.
const SEGMENT_OVERFLOW_TOLERANCE: f64 = 0.15;

/// The pause level of a sentence seam (used for deterministic re-cutting): the source-audio pause between `sentences[i]` and `sentences[i+1]`. ≥1.2s → 3, ≥0.6s → 2, otherwise 1 (all are sentence ends, so at least 1).
fn sentence_gap_rank(words: &[Word], left: &MappedSentence, right: &MappedSentence) -> u8 {
    let gap = words
        .get(right.start)
        .zip(words.get(left.end))
        .map(|(next, prev)| next.t0 - prev.t1)
        .unwrap_or(0.0);
    if gap >= 1.2 {
        3
    } else if gap >= 0.6 {
        2
    } else {
        1
    }
}

/// Deterministically split one over-limit sentence group, by pause level, into pieces within the single-paragraph limit. Accumulate from the start; when adding a sentence would exceed the limit, cut back at the sentence seam with the highest pause level in the last 40% of the current window (ties go to the latest). If there is no other seam in the window, cut just before the current sentence. A single sentence that exceeds the limit by itself can only occupy its own group (over-long sentences are handled earlier by punct-repair). Each returned group is a set of indices into `group`.
///
/// The same yardstick is used in two places: the immediate re-cut of model-answer sub-groups whose overflow is below [`SEGMENT_OVERFLOW_TOLERANCE`], and the close-out of paragraphs still over the limit after [`SEGMENT_REPAIR_MAX_ROUNDS`] rounds.
fn split_by_rank(words: &[Word], group: &[MappedSentence]) -> Vec<Vec<usize>> {
    let texts: Vec<String> = group
        .iter()
        .map(|sentence| final_sentence_text(words, sentence))
        .collect();
    let counts: Vec<usize> = texts.iter().map(|text| word_count(text)).collect();
    let limit = paragraph_word_limit(&texts.join(" "));
    let mut result: Vec<Vec<usize>> = Vec::new();
    let mut start = 0usize;
    let mut used = 0usize;
    for index in 0..group.len() {
        // Invariant: on entering the loop, used = Σcounts[start..index] ≤ limit (except for a single over-limit sentence group, which will necessarily be cut out alone in the next round). If it does not fit, cut; after cutting, if it still does not fit, keep cutting within the shrunken window until it fits or the window holds only the current sentence.
        while index > start && used + counts[index] > limit {
            let span = index - start;
            let floor = (start + 1 + (span as f64 * 0.6).floor() as usize).clamp(start + 1, index);
            let mut best = index;
            let mut best_rank = 0u8;
            for k in floor..=index {
                let rank = sentence_gap_rank(words, &group[k - 1], &group[k]);
                if rank >= best_rank {
                    best_rank = rank;
                    best = k;
                }
            }
            result.push((start..best).collect());
            start = best;
            used = counts[start..index].iter().sum();
        }
        used += counts[index];
    }
    if start < group.len() {
        result.push((start..group.len()).collect());
    }
    result
}

/// The maximum number of rounds for targeted paragraph-splitting repair (each round = gather the paragraphs still over the limit into several payloads and send each once). This is the retry cap of the “until no over-long paragraph remains” loop. Paragraphs that are rejected (invalid range, or not split), and groups that remain clearly over the limit after splitting, simply “go to the next round.” When the rounds run out, the remaining over-limit paragraphs are closed out deterministically by pause level ([`split_by_rank`]), so no multi-sentence over-limit paragraph remains at the exit.
pub const SEGMENT_REPAIR_MAX_ROUNDS: u32 = 3;

/// The targeted paragraph-splitting wave (`kind = "segment-repair"`, the second stage of §6.4, index contract).
///
/// After the main wave accepts the body on the first round, the paragraphs still over the limit in the final accepted set (including single large blocks from whole-page fallback pages and large paragraphs merged across page seams, from whichever page they came) are **gathered together**, re-paginated with the main polish's core-region word budget, and each payload holds one block per paragraph (with numbered sentence lines; the block header states the word count and the minimum paragraph count). Each block is checked individually: the answer returns only line ranges. Accepted blocks are cut into several groups along their ranges, so paragraph pins arise naturally at the group boundaries. Groups that still exceed the limit are re-cut immediately by pause level if the overflow is below [`SEGMENT_OVERFLOW_TOLERANCE`]; otherwise they go into the next round, together with the paragraphs rejected in this round, with the request carrying a `retry_reason` targeted instruction. This continues until no over-long paragraph remains or [`SEGMENT_REPAIR_MAX_ROUNDS`] is reached. When the rounds run out, the remaining over-limit paragraphs are closed out deterministically (`fallback_paragraphs`).
///
/// There is no carrier-level retry inside a round: the round is the retry. A retryable transport error likewise only means “no answer this round”; the paragraph keeps its original group and goes to the next round. Terminal and Cancelled errors propagate as usual. A single-sentence group has no seam to insert into, so it is skipped.
fn segment_repair_wave(
    words: &[Word],
    committed: &mut Vec<Vec<MappedSentence>>,
    llm: &mut dyn LlmJson,
    outcome: &mut PolishOutcome,
    on_attempt: &mut dyn FnMut(&PolishPageAttempt<'_>),
) -> Result<(), LlmError> {
    let system = segment_repair_system_prompt();
    let budget = PolishBudget::default().core_words;
    // The targeted feedback of the previous round for a paragraph, addressed by the word index of its first sentence. After splitting, the first sentences of the sub-groups all differ, which naturally distinguishes “a rejected paragraph left as it was” from “a sub-group still over the limit after splitting.”
    let mut verdicts: BTreeMap<usize, String> = BTreeMap::new();
    let mut page_serial = 0usize;
    for round in 1..=SEGMENT_REPAIR_MAX_ROUNDS {
        // The working set of this round: paragraphs that are still over the limit and eligible for seam insertion (committed index, sentence lines and targeted feedback).
        let mut items: Vec<(usize, Vec<String>, Option<String>)> = Vec::new();
        for (group_index, group) in committed.iter().enumerate() {
            if group.len() < 2 || !paragraph_group_oversized(words, group) {
                continue;
            }
            let lines: Vec<String> = group
                .iter()
                .map(|sentence| final_sentence_text(words, sentence))
                .collect();
            let reason = (round > 1).then(|| {
                verdicts.remove(&group[0].start).unwrap_or_else(|| {
                    let text = lines.join(" ");
                    let count = word_count(&text);
                    let limit = paragraph_word_limit(&text);
                    format!(
                        "上一轮拆分后仍有 {count} 词，超过单段上限 {limit}：请把该块至少拆成 {} 个区间",
                        count.div_ceil(limit.max(1)).max(2)
                    )
                })
            });
            items.push((group_index, lines, reason));
        }
        verdicts.clear();
        if items.is_empty() {
            break;
        }
        // Second pagination: pack by paragraph word count into the core-region budget; an over-long paragraph gets a page to itself.
        let costs: Vec<usize> = items
            .iter()
            .map(|(_, lines, _)| word_count(&lines.join(" ")).max(1))
            .collect();
        let mut pages: Vec<(String, Vec<usize>, String)> = Vec::new();
        let mut cursor = 0usize;
        for size in crate::paging::balanced_page_sizes(&costs, budget) {
            let members: Vec<usize> = (cursor..cursor + size).collect();
            cursor += size;
            let paragraphs: Vec<Vec<String>> =
                members.iter().map(|&item| items[item].1.clone()).collect();
            page_serial += 1;
            pages.push((
                format!("sr{round}-{page_serial:03}"),
                members,
                render_segment_repair_page(&paragraphs),
            ));
        }
        let requests: Vec<LlmRequest> = pages
            .iter()
            .map(|(_, members, payload)| {
                let reasons: Vec<String> = members
                    .iter()
                    .enumerate()
                    .filter_map(|(position, &item)| {
                        items[item]
                            .2
                            .as_ref()
                            .map(|reason| format!("第 {} 块：{reason}", position + 1))
                    })
                    .collect();
                LlmRequest {
                    kind: "segment-repair",
                    system: system.clone(),
                    user: payload.clone(),
                    temperature: 0.2,
                    attempt: round,
                    retry_reason: (!reasons.is_empty())
                        .then(|| format!("[paragraph-oversize] {}", reasons.join("；"))),
                }
            })
            .collect();
        // The acceptance result of each item: Some(groups) means this paragraph passed in this round.
        let mut splits: Vec<Option<Vec<Vec<usize>>>> = (0..items.len()).map(|_| None).collect();
        let results = llm.complete_batch(&requests);
        debug_assert_eq!(results.len(), pages.len());
        for ((page_id, members, payload), result) in pages.iter().zip(results) {
            let raw = match result {
                Ok(raw) => raw,
                // A retryable error ⇒ the paragraphs of this page keep their original groups and go to the next round, or to deterministic close-out.
                Err(error) if error.is_retryable() => continue,
                Err(error) => return Err(error),
            };
            let parsed = parse_segment_repair_page(payload, &raw);
            debug_assert_eq!(parsed.paragraphs.len(), members.len());
            let problems = parsed.diagnostics.problems;
            on_attempt(&PolishPageAttempt {
                page_id,
                attempt: round,
                input: payload,
                output: &raw,
                problems: &problems,
                accepted: parsed.paragraphs.iter().any(Option::is_some),
            });
            for (position, (&item, groups)) in members.iter().zip(parsed.paragraphs).enumerate() {
                if groups.is_none() {
                    // The targeted feedback for rejected paragraphs is carried into the next round. A document-level problem (the volume guardrail) has no paragraph number, so it is treated as “not split.”
                    let detail = problems
                        .iter()
                        .find(|problem| {
                            problem.scope == ProblemScope::Paragraph { index: position }
                        })
                        .map(|problem| format!("[{}] {}", problem.code, problem.detail))
                        .unwrap_or_else(|| {
                            "上一轮答案不可用，请按契约只回行号区间重新分段".to_owned()
                        });
                    let head = committed[items[item].0][0].start;
                    verdicts.insert(head, detail);
                }
                splits[item] = groups;
            }
        }

        // Replace from back to front, so that the group indices not yet processed stay valid. Sub-groups whose overflow is within tolerance are re-cut immediately by pause level. Clearly over-limit sub-groups stay as they are and go into the next round (their first-word index differs from the original paragraph's, so the next round will give them the default feedback “still N words”).
        let mut ordered: Vec<(usize, Vec<Vec<usize>>)> = items
            .iter()
            .enumerate()
            .filter_map(|(index, (group_index, _, _))| {
                splits[index].take().map(|groups| (*group_index, groups))
            })
            .collect();
        ordered.sort_by(|a, b| b.0.cmp(&a.0));
        for (group_index, groups) in ordered {
            let original = committed.remove(group_index);
            debug_assert_eq!(
                groups.iter().map(Vec::len).sum::<usize>(),
                original.len(),
                "segment repair groups must cover every sentence exactly once"
            );
            if groups.len() > 1 {
                outcome.repaired_paragraphs += 1;
            }
            let mut offset = 0usize;
            for line_indexes in groups {
                let sub: Vec<MappedSentence> = line_indexes
                    .iter()
                    .map(|&line| original[line].clone())
                    .collect();
                for piece in split_within_tolerance(words, sub) {
                    committed.insert(group_index + offset, piece);
                    offset += 1;
                }
            }
        }
    }
    // Close-out: after the rounds run out (or if this round had no paragraph to send), multi-sentence paragraphs still over the limit are split deterministically by pause level. The exit guarantees that no multi-sentence over-limit paragraph remains.
    let mut index = 0usize;
    while index < committed.len() {
        if committed[index].len() >= 2 && paragraph_group_oversized(words, &committed[index]) {
            let original = committed.remove(index);
            let pieces = split_by_rank(words, &original);
            outcome.fallback_paragraphs += 1;
            let count = pieces.len();
            for (offset, line_indexes) in pieces.into_iter().enumerate() {
                let sub: Vec<MappedSentence> = line_indexes
                    .iter()
                    .map(|&line| original[line].clone())
                    .collect();
                committed.insert(index + offset, sub);
            }
            index += count;
        } else {
            index += 1;
        }
    }
    Ok(())
}

/// Sub-groups cut from the model's answer: if they are not over the limit, or the overflow is below [`SEGMENT_OVERFLOW_TOLERANCE`], they converge immediately (over-limit ones are re-cut by pause level). Otherwise they are returned as they are (going into the next round).
fn split_within_tolerance(words: &[Word], group: Vec<MappedSentence>) -> Vec<Vec<MappedSentence>> {
    if group.len() < 2 || !paragraph_group_oversized(words, &group) {
        return vec![group];
    }
    let text = group
        .iter()
        .map(|sentence| final_sentence_text(words, sentence))
        .collect::<Vec<_>>()
        .join(" ");
    let count = word_count(&text) as f64;
    let limit = paragraph_word_limit(&text) as f64;
    if count > limit * (1.0 + SEGMENT_OVERFLOW_TOLERANCE) {
        return vec![group];
    }
    split_by_rank(words, &group)
        .into_iter()
        .map(|line_indexes| {
            line_indexes
                .iter()
                .map(|&line| group[line].clone())
                .collect()
        })
        .collect()
}

// ---- Page-seam judgment (seam-repair) ------------------------------------------------

/// Unconditionally merge hard-cut page seams: when `plans[k].hard_cut_end`, merge page k+1's first paragraph into the last paragraph of the nearest preceding non-empty page. Returns the number of merges.
///
/// Chain case: if page k+1 has only one paragraph and is followed by another hard cut, it is emptied, and the next hard-cut page seam still finds “the nearest preceding non-empty page” and merges again. Page-seam merging only makes paragraphs longer; it never drops sentences.
fn merge_hard_cut_seams(
    plans: &[&PolishPagePlan],
    per_page: &mut [Vec<Vec<MappedSentence>>],
) -> u32 {
    let mut merged = 0_u32;
    for right in 1..per_page.len() {
        if !plans[right - 1].hard_cut_end || per_page[right].is_empty() {
            continue;
        }
        let Some(left) = (0..right).rev().find(|page| !per_page[*page].is_empty()) else {
            continue;
        };
        let head = per_page[right].remove(0);
        per_page[left]
            .last_mut()
            .expect("non-empty page has a last group")
            .extend(head);
        merged += 1;
    }
    merged
}

/// Page-seam candidates: returns the indices in `committed` of “page k+1's first group” (the seam lies between that group and the one before it), in ascending order. It skips hard-cut page seams (already merged), speaker-change points (a ⏹ hard guarantee, so the paragraph pin certainly holds), page seams where the next page explicitly declares “start a new paragraph” (recorded as `seam_signaled_paragraphs`), and pages emptied by merging.
fn seam_candidates(
    words: &[Word],
    plans: &[&PolishPagePlan],
    page_spans: &[std::ops::Range<usize>],
    seam_signals: &[bool],
    outcome: &mut PolishOutcome,
) -> Vec<usize> {
    let mut seams = Vec::new();
    for right in 1..plans.len() {
        let plan = plans[right];
        if plans[right - 1].hard_cut_end || page_spans[right].is_empty() {
            continue;
        }
        let start = plan.core.start;
        if start == 0 || start >= words.len() || words[start - 1].sp != words[start].sp {
            continue;
        }
        let boundary = page_spans[right].start;
        // The previous group must exist (there must be at least one non-empty page before it).
        if boundary == 0 {
            continue;
        }
        if seam_signals[right] {
            outcome.seam_signaled_paragraphs += 1;
            continue;
        }
        seams.push(boundary);
    }
    seams
}

/// System prompt of seam-repair (index contract; independent of batch composition, one copy shared across the wave).
fn seam_repair_system_prompt() -> String {
    format!(
        r#"You are checking paragraph boundaries at PAGE SEAMS in a transcript that has already been copy-edited and paragraphed.

The transcript was processed in pages. Where one page ends and the next begins, the text was cut mechanically, so the paragraph break at that point may or may not be real. You receive ONE OR MORE blocks as PLAIN TEXT. Each block is a window around one seam (occasionally several): the last sentences before the seam followed by the first sentences after it, ONE SENTENCE PER LINE, every line prefixed with its 1-based line number. The header names the seam: `page seam before line N` means the previous page ended with line N-1 and the next page started with line N.

{FENCE_BLOCK_PREFIX} 1 | 30 sentences | 410 characters | page seam before line 17>>>
1| …
…
30| …
{FENCE_BLOCK_END}

Answer with LINE-NUMBER RANGES ONLY — one paragraph per range, do NOT copy any sentence text back:

{FENCE_BLOCK_PREFIX} 1>>>
1-16
17-30
{FENCE_BLOCK_END}

Rules:
- Ranges must start at 1, be contiguous (each starts right after the previous one ends) and end at the block's last line — no gaps, no overlaps, no numbers outside the block.
- The window may begin and end in the middle of a paragraph; that is expected. What matters is where the paragraph boundaries fall INSIDE the window.
- If the sentence at the seam continues the thought of the sentences before it, do NOT start a range there — let one range span the seam. A single range covering the whole block (`1-30`) is a valid answer when the window is one paragraph.
- Start a range at the seam only when a new topic, question, example or story really begins there.
- A boundary elsewhere in the window is welcome when the topic actually turns there — for example when the paragraph that continues across the seam really started a few sentences before it.
- Never break just to keep paragraphs short. Paragraphs of spoken language stay under {MAX_PARAGRAPH_WORDS_LATIN} words ({MAX_PARAGRAPH_WORDS_CJK} characters for Chinese/Japanese/Korean), but a window this size is often a single paragraph.
- Answer for every block, in the same order, each with its own `{FENCE_BLOCK_PREFIX} k>>>` … `{FENCE_BLOCK_END}` fences, and emit NOTHING else: no sentence text, no preamble, no explanations, no code block wrapper."#
    )
}

/// The maximum number of rounds for seam judgment. Round one sends all candidates; round two resends only the rejected blocks (with `retry_reason`). When the rounds run out, page seams still rejected keep their paragraph pins, exactly as if no judgment had been made.
pub const SEAM_REPAIR_MAX_ROUNDS: u32 = 2;

/// Seam window: a block takes only the sentences from roughly the last this-many words of page k's last paragraph, and the sentences from roughly the first this-many words of page k+1's first paragraph (the sentence that reaches the threshold is included; at least one sentence per side). The window decouples block size from paragraph length on both sides: even a whole-page single paragraph (2200 words) sends only a ~500-word window, so the model judges just the local page seam and does not have to re-read the whole page.
const SEAM_WINDOW_WORDS: usize = 250;

/// The number of sentences needed at the end of `group` to accumulate [`SEAM_WINDOW_WORDS`] (≥1, ≤ len).
fn seam_tail_take(words: &[Word], group: &[MappedSentence]) -> usize {
    let mut acc = 0usize;
    let mut take = 0usize;
    for sentence in group.iter().rev() {
        if take > 0 && acc >= SEAM_WINDOW_WORDS {
            break;
        }
        acc += word_count(&final_sentence_text(words, sentence));
        take += 1;
    }
    take
}

/// The number of sentences needed at the start of `group` to accumulate [`SEAM_WINDOW_WORDS`] (≥1, ≤ len).
fn seam_head_take(words: &[Word], group: &[MappedSentence]) -> usize {
    let mut acc = 0usize;
    let mut take = 0usize;
    for sentence in group {
        if take > 0 && acc >= SEAM_WINDOW_WORDS {
            break;
        }
        acc += word_count(&final_sentence_text(words, sentence));
        take += 1;
    }
    take
}

/// The page-seam judgment wave (`kind = "seam-repair"`, index contract).
///
/// `seams` are the indices in `committed` of page k+1's first group, in ascending order. The wave first flattens `committed` into a sentence sequence plus a set of paragraph starts (global sentence indices); the page seams are the paragraph starts within it. Each page seam's block is the left paragraph's tail window plus the right paragraph's head window ([`SEAM_WINDOW_WORDS`]). When a head window covers the whole right paragraph and the next page seam follows immediately, the two chain into one block (several page seams within a block). The answer is split into groups by range, and only the **endpoints of groups that span a seam** are adopted: if a range containing the seam line starts at that line, it is kept (`seam_kept_paragraphs`); otherwise the seam's paragraph start is removed (`seam_merged_paragraphs`), and the range's internal start and end points within the window are made paragraph starts (the true start and end of the seam paragraph). Window edges and ranges that do not span a seam are always ignored, since the window is truncated and its edge boundaries are not trustworthy. All edits are set operations on the paragraph-start set, so blocks do not interfere with one another. A rejected block or a transport failure ⇒ the next round; when the rounds run out, the original paragraph pins are kept. Paragraphs still over the limit after merging are handed to the immediately following segment-repair to split by meaning.
fn seam_repair_wave(
    words: &[Word],
    committed: &mut Vec<Vec<MappedSentence>>,
    seams: Vec<usize>,
    llm: &mut dyn LlmJson,
    outcome: &mut PolishOutcome,
    on_attempt: &mut dyn FnMut(&PolishPageAttempt<'_>),
) -> Result<(), LlmError> {
    let system = seam_repair_system_prompt();
    let budget = PolishBudget::default().core_words;
    // Flatten: flat sentences plus the paragraph-start set; page seams → global sentence indices.
    let mut group_starts: Vec<usize> = Vec::with_capacity(committed.len());
    let mut flat: Vec<MappedSentence> = Vec::new();
    for group in committed.iter() {
        group_starts.push(flat.len());
        flat.extend(group.iter().cloned());
    }
    let mut starts: BTreeSet<usize> = group_starts.iter().copied().collect();
    starts.insert(0);
    let mut pending: Vec<usize> = seams
        .into_iter()
        .filter(|&b| b > 0 && b < group_starts.len())
        .map(|b| group_starts[b])
        .collect();
    let mut verdicts: BTreeMap<usize, String> = BTreeMap::new();
    let mut page_serial = 0usize;
    for round in 1..=SEAM_REPAIR_MAX_ROUNDS {
        pending.sort_unstable();
        pending.dedup();
        pending.retain(|g| starts.contains(g) && *g > 0);
        if pending.is_empty() {
            break;
        }
        // Block: lines starting at global sentence index `base`; `seam_offsets` are offsets within the block.
        struct Block {
            base: usize,
            lines: Vec<String>,
            seam_offsets: Vec<usize>,
            reason: Option<String>,
        }
        let mut blocks: Vec<Block> = Vec::new();
        for &seam in &pending {
            let left_start = starts.range(..seam).next_back().copied().unwrap_or(0);
            let right_end = starts
                .range(seam + 1..)
                .next()
                .copied()
                .unwrap_or(flat.len());
            let head = seam_head_take(words, &flat[seam..right_end]);
            if let Some(block) = blocks.last_mut()
                && block.base + block.lines.len() == seam
            {
                // If the previous block's head window exactly covers the left paragraph (that paragraph is the right paragraph of the previous page seam) ⇒ chain them.
                block.seam_offsets.push(block.lines.len());
                block.lines.extend(
                    flat[seam..seam + head]
                        .iter()
                        .map(|s| final_sentence_text(words, s)),
                );
                continue;
            }
            let tail = seam_tail_take(words, &flat[left_start..seam]);
            let base = seam - tail;
            let mut lines: Vec<String> = flat[base..seam]
                .iter()
                .map(|s| final_sentence_text(words, s))
                .collect();
            lines.extend(
                flat[seam..seam + head]
                    .iter()
                    .map(|s| final_sentence_text(words, s)),
            );
            blocks.push(Block {
                base,
                lines,
                seam_offsets: vec![tail],
                reason: None,
            });
        }
        // Empty sentence lines break the line↔sentence correspondence, so the whole block is skipped (the paragraph pins are kept).
        blocks.retain(|block| {
            block
                .lines
                .iter()
                .all(|line| line.split_whitespace().next().is_some())
        });
        if round > 1 {
            for block in &mut blocks {
                block.reason = Some(
                    verdicts
                        .remove(&flat[block.base].start)
                        .unwrap_or_else(|| "上一轮答案不可用，请按契约只回行号区间".to_owned()),
                );
            }
        }
        verdicts.clear();
        if blocks.is_empty() {
            break;
        }
        let costs: Vec<usize> = blocks
            .iter()
            .map(|block| word_count(&block.lines.join(" ")).max(1))
            .collect();
        let mut pages: Vec<(String, Vec<usize>, String)> = Vec::new();
        let mut cursor = 0usize;
        for size in crate::paging::balanced_page_sizes(&costs, budget) {
            let members: Vec<usize> = (cursor..cursor + size).collect();
            cursor += size;
            let rendered: Vec<(Vec<String>, Vec<usize>)> = members
                .iter()
                .map(|&item| {
                    (
                        blocks[item].lines.clone(),
                        blocks[item].seam_offsets.clone(),
                    )
                })
                .collect();
            page_serial += 1;
            pages.push((
                format!("sm{round}-{page_serial:03}"),
                members,
                render_seam_repair_page(&rendered),
            ));
        }
        let requests: Vec<LlmRequest> = pages
            .iter()
            .map(|(_, members, payload)| {
                let reasons: Vec<String> = members
                    .iter()
                    .enumerate()
                    .filter_map(|(position, &item)| {
                        blocks[item]
                            .reason
                            .as_ref()
                            .map(|reason| format!("第 {} 块：{reason}", position + 1))
                    })
                    .collect();
                LlmRequest {
                    kind: "seam-repair",
                    system: system.clone(),
                    user: payload.clone(),
                    temperature: 0.2,
                    attempt: round,
                    retry_reason: (!reasons.is_empty())
                        .then(|| format!("[range-invalid] {}", reasons.join("；"))),
                }
            })
            .collect();
        let mut splits: Vec<Option<Vec<Vec<usize>>>> = (0..blocks.len()).map(|_| None).collect();
        let results = llm.complete_batch(&requests);
        debug_assert_eq!(results.len(), pages.len());
        for ((page_id, members, payload), result) in pages.iter().zip(results) {
            let raw = match result {
                Ok(raw) => raw,
                Err(error) if error.is_retryable() => continue,
                Err(error) => return Err(error),
            };
            let parsed = parse_segment_repair_page(payload, &raw);
            debug_assert_eq!(parsed.paragraphs.len(), members.len());
            let problems = parsed.diagnostics.problems;
            on_attempt(&PolishPageAttempt {
                page_id,
                attempt: round,
                input: payload,
                output: &raw,
                problems: &problems,
                accepted: parsed.paragraphs.iter().any(Option::is_some),
            });
            for (position, (&item, groups)) in members.iter().zip(parsed.paragraphs).enumerate() {
                match groups {
                    // For a page-seam block, “one range covering the whole block” is a legitimate answer (the whole block continues the same paragraph), but the carrier flags it as paragraph-oversize because it is over the limit. Here only an invalid range counts as a rejection; anything else is treated as “one whole group.”
                    None => {
                        let problem = problems.iter().find(|problem| {
                            problem.scope == ProblemScope::Paragraph { index: position }
                        });
                        match problem {
                            Some(problem) if problem.code == ProblemCode::ParagraphOversize => {
                                splits[item] = Some(vec![(0..blocks[item].lines.len()).collect()]);
                            }
                            Some(problem) => {
                                verdicts.insert(
                                    flat[blocks[item].base].start,
                                    format!("[{}] {}", problem.code, problem.detail),
                                );
                            }
                            None => {
                                verdicts.insert(
                                    flat[blocks[item].base].start,
                                    "上一轮答案不可用，请按契约只回行号区间".to_owned(),
                                );
                            }
                        }
                    }
                    Some(groups) => splits[item] = Some(groups),
                }
            }
        }

        // Apply: only the endpoints of groups spanning a seam are adopted. Page seams in blocks that did not pass go into the next round.
        let mut next_pending: Vec<usize> = Vec::new();
        for (index, block) in blocks.iter().enumerate() {
            let Some(groups) = splits[index].take() else {
                next_pending.extend(block.seam_offsets.iter().map(|offset| block.base + offset));
                continue;
            };
            let len = block.lines.len();
            for &offset in &block.seam_offsets {
                let Some(group) = groups.iter().find(|group| group.contains(&offset)) else {
                    continue;
                };
                let (gs, ge) = (group[0], group[group.len() - 1] + 1);
                if gs == offset {
                    outcome.seam_kept_paragraphs += 1;
                    continue;
                }
                starts.remove(&(block.base + offset));
                outcome.seam_merged_paragraphs += 1;
                if gs > 0 {
                    starts.insert(block.base + gs);
                }
                if ge < len {
                    starts.insert(block.base + ge);
                }
            }
        }
        pending = next_pending;
    }
    // Write back: regroup by the paragraph-start set.
    let mut rebuilt: Vec<Vec<MappedSentence>> = Vec::new();
    for sentence in flat.into_iter().enumerate() {
        if starts.contains(&sentence.0) || rebuilt.is_empty() {
            rebuilt.push(Vec::new());
        }
        rebuilt.last_mut().expect("pushed above").push(sentence.1);
    }
    *committed = rebuilt;
    Ok(())
}

/// Mirror lint of the agent-side `task submit` for seam-repair answers: the same index carrier and the same parser as segment-repair. “One range covering the whole block” is a legitimate answer in a page-seam block (the whole block continues the same paragraph), so `paragraph-oversize` is removed from the problems.
pub fn lint_agent_answer_seam_repair(payload: &str, answer: &str) -> Vec<String> {
    parse_segment_repair_page(payload, answer)
        .diagnostics
        .problems
        .iter()
        .filter(|problem| problem.code != ProblemCode::ParagraphOversize)
        .map(|problem| format!("[{}] {}", problem.code, problem.detail))
        .collect()
}

// ---- Targeted punctuation repair (punct-repair) -------------------------------------

/// System prompt of punct-repair.
///
/// Independent of batch composition (one copy is shared across the wave; the agent executor stores contract files by (kind, attempt)). The emphasis has shifted from “correcting errors” to “only adding sentence-end punctuation”: non-punctuation characters must be reproduced verbatim, and entries are separated by ID-bearing fences so they do not interfere with one another.
fn punct_repair_system_prompt() -> String {
    format!(
        r#"You are adding sentence-ending punctuation to over-long run-on sentences in a transcript that has already been copy-edited.

You receive ONE OR MORE items as PLAIN TEXT. Each item is one derived "sentence" that never closes, and sits between its own pair of fence lines carrying an id:

{FENCE_SENTENCE_BEGIN_PREFIX} id=s01 min-sentences=3>>>
…the text of item s01…
{FENCE_SENTENCE_END_PREFIX} id=s01>>>

{FENCE_SENTENCE_BEGIN_PREFIX} id=s02 min-sentences=2>>>
…the text of item s02…
{FENCE_SENTENCE_END_PREFIX} id=s02>>>

Your ONLY job is to split every item into several real sentences by ADDING sentence-ending punctuation:

- Add `.` `?` `!` (Latin scripts) or `。` `？` `！` (Chinese/Japanese/Korean) at every semantic completion. Spoken sentences are short; close each complete thought.
- `min-sentences=N` is the minimum number of sentences that item must become. Items are validated one by one; an item that comes back without any new sentence end is sent back to you again.
- You may turn an existing comma into a sentence end, but never leave conflicting adjacent marks such as `。，`, `，。`, `，，`, `,,`, `..` or `.,`, and never end a sentence on a dangling connector, preposition, or incomplete lead-in (`because.`, `of.`, `当。`, `让。`, `和。`, `向。`).
- Do NOT fix typos, wording, spacing inside words, capitalization, or anything else — every character that is not punctuation must be reproduced EXACTLY, in order. An item whose non-punctuation content changes is rejected.
- Items are independent. Never move text between items, never merge, reorder, or drop items.
- "⏸" / "⏸⏸" / "⏸⏸⏸" mark a short / medium / long pause in the original audio. They are a soft hint only — a pause often falls mid-sentence, so split by MEANING. NEVER copy them into your answer.
- Reproduce every item between its own fence lines with the SAME id, in the same order, and emit NOTHING outside the fences: no preamble, no explanations, no headings, no markdown code block wrapper."#
    )
}

/// The maximum number of rounds for targeted punctuation repair (each round = gather the sentences still over-long into several payloads and send each once). A rejected sentence (rewritten, no sentence-end punctuation added, or a split point that does not project back onto the source words), or a fragment still over-long after splitting, simply “goes to the next round.” When the rounds run out, the remaining over-long sentences are split deterministically by [`split_oversized_sentence`].
pub const PUNCT_REPAIR_MAX_ROUNDS: u32 = 3;

/// The body of an over-long sentence carried into the punct-repair carrier: the corrected text plus the ⏸ pause soft hints projected back from the source timeline. In the main polish page the model already sees these markers, so targeted repair should not be blinder than the first round. Projection uses atom-LCS (a marker is inserted after the last matching atom of each source word); if it cannot align, it falls back to the bare text.
fn punct_repair_hinted_text(words: &[Word], sentence: &MappedSentence) -> String {
    let Some(alignment) = sentence_alignment(words, sentence) else {
        return sentence.corrected.clone();
    };
    let mut inserts: Vec<(usize, String)> = Vec::new();
    for (position, &(word, atom)) in alignment.matches.iter().enumerate() {
        if word >= sentence.end
            || alignment
                .matches
                .get(position + 1)
                .is_some_and(|(next_word, _)| *next_word == word)
        {
            continue;
        }
        let marks = pause_marks(words[word + 1].t0 - words[word].t1);
        if !marks.is_empty() {
            inserts.push((atom, marks));
        }
    }
    if inserts.is_empty() {
        return sentence.corrected.clone();
    }
    let mut prefix: Vec<usize> = Vec::with_capacity(alignment.atoms.len());
    let mut sum = 0usize;
    for atom in &alignment.atoms {
        sum += atom.chars().count();
        prefix.push(sum);
    }
    // Insert from back to front: the non-whitespace count before each insertion point is not affected by markers inserted after it.
    let mut text = sentence.corrected.clone();
    for (atom, marks) in inserts.into_iter().rev() {
        if let Some(index) = after_nonspace_char_index(&text, prefix[atom]) {
            text.insert_str(index, &format!(" {marks} "));
        }
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The byte index after the `count`-th non-whitespace character (1-based).
fn after_nonspace_char_index(text: &str, count: usize) -> Option<usize> {
    let mut seen = 0usize;
    for (index, ch) in text.char_indices() {
        if ch.is_whitespace() {
            continue;
        }
        seen += 1;
        if seen == count {
            return Some(index + ch.len_utf8());
        }
    }
    None
}

/// Split the sentence accepted by punct-repair into sentences, and map each back to the source word range of the original sentence.
///
/// The carrier layer has already proven that the non-punctuation atoms are identical and that at least one sentence-end punctuation mark was added. Here it is further required that each split-out sentence can be anchored to source words (`None` means the split point cannot be projected, so the sentence stays as it was and goes into the next round).
fn repunctuated_pieces(
    words: &[Word],
    sentence: &MappedSentence,
    text: &str,
    analysis: Option<&Analysis>,
) -> Option<Vec<MappedSentence>> {
    let pieces: Vec<String> = split_sentence_text(text)
        .into_iter()
        .map(|piece| sanitize_corrected(&piece))
        .filter(|piece| !piece.is_empty())
        .collect();
    if pieces.len() < 2 {
        return None;
    }
    let mapped = map_corrected_page(words, sentence.start..sentence.end + 1, &[pieces]).ok()?;
    let mut flat: Vec<MappedSentence> = mapped.into_iter().flatten().collect();
    if flat.len() < 2 {
        return None;
    }
    heal_boundaries(words, &mut flat, analysis);
    Some(flat)
}

/// The targeted punctuation-repair wave (`kind = "punct-repair"`).
///
/// After the main wave accepts the body on the first round, the sentences in the final accepted set that still exceed the single-sentence span limit ([`oversized_span`]) are **gathered together** and re-paginated with the main polish's core-region word budget (and, when the worker slot count is known, split further to fill the slots). Each payload holds one ID-bearing fence pair per sentence, and each sentence is checked individually: the payload is the corrected text plus the projected ⏸ hints, and the answer may only add or change punctuation. Accepted sentences are split at their new sentence-end punctuation and re-mapped to source words. Pieces still over-long after splitting, together with the sentences rejected in this round, go into the next round (the request carries a per-sentence `retry_reason` targeted instruction), until no over-long sentence remains or [`PUNCT_REPAIR_MAX_ROUNDS`] is reached. There is no carrier-level retry inside a round: the round is the retry. A retryable transport error likewise only means “no answer this round”; Terminal and Cancelled errors propagate as usual. Sentences still over-long when the rounds run out are split deterministically along the source timeline via [`split_oversized_sentence`], so no over-long sentence remains at the exit.
fn punct_repair_wave(
    words: &[Word],
    committed: &mut [Vec<MappedSentence>],
    llm: &mut dyn LlmJson,
    options: &PolishOptions,
    outcome: &mut PolishOutcome,
    on_attempt: &mut dyn FnMut(&PolishPageAttempt<'_>),
) -> Result<(), LlmError> {
    let system = punct_repair_system_prompt();
    let analysis = options.analysis.as_ref();
    let budget = PolishBudget::default().core_words;
    // The targeted feedback of the previous round for a sentence, addressed by the word index of its first word. After splitting, the first words of the pieces all differ, which naturally distinguishes “a rejected sentence left as it was” from “a piece still over-long after splitting.”
    let mut verdicts: BTreeMap<usize, String> = BTreeMap::new();
    let mut page_serial = 0usize;
    for round in 1..=PUNCT_REPAIR_MAX_ROUNDS {
        // The working set of this round: sentences that are still over-long and have corrected text (committed coordinates, carrier entry and targeted feedback).
        let mut targets: Vec<(usize, usize)> = Vec::new();
        let mut items: Vec<PunctRepairItem> = Vec::new();
        let mut costs: Vec<usize> = Vec::new();
        let mut reasons: Vec<Option<String>> = Vec::new();
        for (group_index, group) in committed.iter().enumerate() {
            for (sentence_index, sentence) in group.iter().enumerate() {
                if sentence.corrected.is_empty() {
                    continue;
                }
                let Some(reason) = oversized_span(words, sentence) else {
                    continue;
                };
                let units = word_count(&sentence.corrected);
                let limit = paragraph_word_limit(&sentence.corrected);
                items.push(PunctRepairItem {
                    id: format!("s{:02}", items.len() + 1),
                    text: punct_repair_hinted_text(words, sentence),
                    min_sentences: units.div_ceil((limit / 2).max(1)).max(2),
                });
                costs.push(units.max(1));
                reasons.push((round > 1).then(|| {
                    verdicts.remove(&sentence.start).unwrap_or_else(|| {
                        format!("上一轮拆分后仍超长（{reason}）：请继续在语义完成处补句末标点")
                    })
                }));
                targets.push((group_index, sentence_index));
            }
        }
        verdicts.clear();
        if items.is_empty() {
            break;
        }
        // Second pagination: pack by sentence count into the core-region budget. When the slot count is known and the pages cannot fill the slots, split finer so every concurrent worker has work (at least one sentence per page).
        let mut sizes = crate::paging::balanced_page_sizes(&costs, budget);
        if let Some(slots) = options.worker_slots.filter(|&slots| slots > 1)
            && sizes.len() < slots
            && items.len() > sizes.len()
        {
            sizes = crate::paging::balanced_page_sizes_for_count(
                &costs,
                slots.min(items.len()),
                items.len(),
            );
        }
        let mut pages: Vec<(String, Vec<usize>, String)> = Vec::new();
        let mut cursor = 0usize;
        for size in sizes {
            let members: Vec<usize> = (cursor..cursor + size).collect();
            cursor += size;
            let batch: Vec<PunctRepairItem> =
                members.iter().map(|&item| items[item].clone()).collect();
            page_serial += 1;
            pages.push((
                format!("pr{round}-{page_serial:03}"),
                members,
                render_punct_repair_page(&batch),
            ));
        }
        let requests: Vec<LlmRequest> = pages
            .iter()
            .map(|(_, members, payload)| {
                let notes: Vec<String> = members
                    .iter()
                    .filter_map(|&item| {
                        reasons[item]
                            .as_ref()
                            .map(|reason| format!("{}: {reason}", items[item].id))
                    })
                    .collect();
                LlmRequest {
                    kind: "punct-repair",
                    system: system.clone(),
                    user: payload.clone(),
                    temperature: 0.2,
                    attempt: round,
                    retry_reason: (!notes.is_empty())
                        .then(|| format!("[sentence-oversize] {}", notes.join("；"))),
                }
            })
            .collect();
        let results = llm.complete_batch(&requests);
        debug_assert_eq!(results.len(), pages.len());
        // The acceptance result of each sentence: Some(pieces) means this sentence was split in this round.
        let mut replacements: Vec<(usize, usize, Vec<MappedSentence>)> = Vec::new();
        for ((page_id, members, payload), result) in pages.iter().zip(results) {
            let raw = match result {
                Ok(raw) => raw,
                // A retryable error ⇒ the sentences of this page keep their original form and go to the next round, or to the deterministic fallback.
                Err(error) if error.is_retryable() => continue,
                Err(error) => return Err(error),
            };
            let parsed = parse_punct_repair_page(payload, &raw);
            debug_assert_eq!(parsed.sentences.len(), members.len());
            let mut problems = parsed.diagnostics.problems;
            let mut accepted_any = false;
            for (&item, answer) in members.iter().zip(parsed.sentences) {
                let (group_index, sentence_index) = targets[item];
                let sentence = &committed[group_index][sentence_index];
                let id = items[item].id.as_str();
                let pieces = match answer {
                    Some(text) => {
                        let pieces = repunctuated_pieces(words, sentence, &text, analysis);
                        if pieces.is_none() {
                            problems.push(Problem::sentence(
                                ProblemCode::SentenceOversize,
                                id,
                                "新加的句末标点无法投影回源词，句保持原样",
                            ));
                        }
                        pieces
                    }
                    None => None,
                };
                match pieces {
                    Some(pieces) => {
                        accepted_any = true;
                        replacements.push((group_index, sentence_index, pieces));
                    }
                    None => {
                        let detail = problems
                            .iter()
                            .find(|problem| {
                                problem.scope == ProblemScope::Sentence { id: id.to_owned() }
                            })
                            .or_else(|| {
                                problems
                                    .iter()
                                    .find(|problem| problem.scope == ProblemScope::Document)
                            })
                            .map(|problem| format!("[{}] {}", problem.code, problem.detail))
                            .unwrap_or_else(|| {
                                "上一轮答案不可用，请按契约只在语义完成处补句末标点".to_owned()
                            });
                        verdicts.insert(sentence.start, detail);
                    }
                }
            }
            on_attempt(&PolishPageAttempt {
                page_id,
                attempt: round,
                input: payload,
                output: &raw,
                problems: &problems,
                accepted: accepted_any,
            });
        }
        // Replace from back to front, so that the sentence indices not yet processed stay valid.
        replacements.sort_by(|a, b| (b.0, b.1).cmp(&(a.0, a.1)));
        for (group_index, sentence_index, pieces) in replacements {
            outcome.punct_repaired_sentences += 1;
            committed[group_index].splice(sentence_index..=sentence_index, pieces);
        }
    }
    // Rounds exhausted: the remaining over-long sentences are split deterministically along the source timeline; those that still cannot be cut are counted in the tally.
    for group in committed.iter_mut() {
        let mut index = 0usize;
        while index < group.len() {
            let sentence = &group[index];
            if sentence.corrected.is_empty() || oversized_span(words, sentence).is_none() {
                index += 1;
                continue;
            }
            let pieces = split_oversized_sentence(words, sentence);
            if pieces.len() > 1 {
                outcome.punct_split_sentences += 1;
            }
            outcome.oversized_sentences += pieces
                .iter()
                .filter(|piece| oversized_span(words, piece).is_some())
                .count() as u32;
            let advance = pieces.len();
            group.splice(index..=index, pieces);
            index += advance;
        }
    }
    Ok(())
}

/// Clause-level pause punctuation: the criterion for a “pause at a comma” in sentence-split candidate scoring (the source word or corrected atom at the tail).
const CLAUSE_PUNCT: &[char] = &['，', ',', '；', ';', '、', '：', ':'];

fn ends_with_clause_punct(text: &str) -> bool {
    text.trim_end()
        .chars()
        .next_back()
        .is_some_and(|ch| CLAUSE_PUNCT.contains(&ch))
}

/// The score of a deterministic sentence-split candidate (higher is preferred): speaker change 5 > source word with its own sentence-end punctuation 4 > long pause (≥1.8s) 3 > pause plus comma 2 > pause only or comma only 1 > 0 (length fallback). `clause_words` are the source words onto which the comma-type punctuation in corrected projects back.
fn deterministic_split_score(
    words: &[Word],
    boundary: usize,
    clause_words: &BTreeSet<usize>,
) -> u8 {
    let prev = &words[boundary - 1];
    let next = &words[boundary];
    if prev.sp != next.sp {
        return 5;
    }
    if sentence_end(&prev.text) {
        return 4;
    }
    let pause = pause_marks(next.t0 - prev.t1).chars().count();
    let clause = clause_words.contains(&(boundary - 1)) || ends_with_clause_punct(&prev.text);
    if pause >= 3 {
        3
    } else if pause >= 1 && clause {
        2
    } else if pause >= 1 || clause {
        1
    } else {
        0
    }
}

/// Make the left half of a deterministic split end with sentence-end punctuation: remove trailing comma-type punctuation, then add `。`/`.` according to the script of the text. If it already ends with sentence-end punctuation (including right-closing characters), leave it alone.
fn close_sentence(text: &mut String) {
    let trimmed = text.trim_end();
    let mut end = trimmed.len();
    while let Some(ch) = trimmed[..end].chars().next_back() {
        if CLAUSE_PUNCT.contains(&ch) || ch.is_whitespace() {
            end -= ch.len_utf8();
        } else {
            break;
        }
    }
    text.truncate(end);
    let already_closed = text
        .chars()
        .rev()
        .find(|ch| !RESPLIT_CLOSERS.contains(ch))
        .is_some_and(|ch| RESPLIT_TERMINAL.contains(&ch));
    if !already_closed && !text.is_empty() {
        // The full stop follows the text: Chinese characters and kana use `。`; everything else (including Korean) uses `.`.
        text.push(if text.chars().any(is_unspaced_cjk_char) {
            '。'
        } else {
            '.'
        });
    }
}

/// Cut one over-long sentence at a point chosen along the source timeline.
///
/// The source atom count of the left half must fall within the window [limit/5, limit×4/5] (also constrained by both the source character and duration limits). Inside the window, the candidate with the highest [`deterministic_split_score`] is chosen; ties go to the later one (fewer pieces). If there is no candidate in the window (sparse words, or an excessive duration), it falls back to any boundary before the window. The cut point must be projectable into corrected via atom-LCS; if it cannot be projected, the next candidate is tried.
fn split_once_deterministically(
    words: &[Word],
    sentence: &MappedSentence,
) -> Option<(MappedSentence, MappedSentence)> {
    let alignment = sentence_alignment(words, sentence)?;
    let mut clause_words: BTreeSet<usize> = BTreeSet::new();
    for (position, &(word, atom)) in alignment.matches.iter().enumerate() {
        let last_of_word = alignment
            .matches
            .get(position + 1)
            .is_none_or(|(next_word, _)| *next_word != word);
        if last_of_word && ends_with_clause_punct(&alignment.atoms[atom]) {
            clause_words.insert(word);
        }
    }
    let limit = paragraph_word_limit(&sentence.corrected);
    let max_units = limit * 4 / 5;
    let min_units = limit / 5;
    let mut in_window: Vec<(u8, usize)> = Vec::new();
    let mut short: Vec<(u8, usize)> = Vec::new();
    let mut units = 0usize;
    let mut chars = 0usize;
    for index in sentence.start..sentence.end {
        units += word_count(&words[index].text).max(1);
        chars += words[index].text.chars().count() + 1;
        let seconds = words[index].t1 - words[sentence.start].t0;
        if units > max_units
            || chars > MAX_SENTENCE_SOURCE_CHARS
            || seconds > MAX_SENTENCE_SPAN_SECONDS
        {
            break;
        }
        let boundary = index + 1;
        let score = deterministic_split_score(words, boundary, &clause_words);
        if units < min_units {
            short.push((score, boundary));
        } else {
            in_window.push((score, boundary));
        }
    }
    let mut candidates = if in_window.is_empty() {
        short
    } else {
        in_window
    };
    candidates.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
    for (_, boundary) in candidates {
        if let Some((mut left, right)) = split_sentence_at_word(words, sentence, boundary) {
            close_sentence(&mut left.corrected);
            return Some((left, right));
        }
    }
    None
}

/// The deterministic fallback after the punct-repair rounds are exhausted: cut repeatedly, once at a time, until no piece is over-long. If it cannot cut (atom-LCS projects no split point), it returns the input unchanged, and the caller counts it in `oversized_sentences`.
fn split_oversized_sentence(words: &[Word], sentence: &MappedSentence) -> Vec<MappedSentence> {
    let mut out: Vec<MappedSentence> = Vec::new();
    let mut current = sentence.clone();
    while oversized_span(words, &current).is_some() {
        let Some((left, right)) = split_once_deterministically(words, &current) else {
            break;
        };
        out.push(left);
        current = right;
    }
    out.push(current);
    out
}

/// The mirror lint of the file contract's (`file-v1`) `task submit`.
///
/// There is only **one** validation: here we directly call the same engine-internal [`lint_polish_page`]. The agent side does not have the word stream, so it can only run the half of the checks that needs nothing but the string. The whole-page LCS ratio, per-sentence similarity and single-sentence span limit, which need the ground truth, are backstopped by engine-side validation (see [`validate_polish_file_page`]).
pub fn lint_agent_answer_file(payload: &str, answer: &str) -> Vec<String> {
    lint_polish_page(payload, answer)
        .problems
        .iter()
        .map(|problem| match &problem.scope {
            ProblemScope::Sentence { id } => {
                format!("[{}] {id}: {}", problem.code, problem.detail)
            }
            _ => format!("[{}] {}", problem.code, problem.detail),
        })
        .collect()
}

/// The mirror lint of segment-repair `task submit`.
///
/// It shares the one implementation, [`parse_segment_repair_page`], with the engine. All checks for this carrier are **string-level** (ranges start at 1, are contiguous, and cover through the last line, and whether a single range covers an over-limit whole block), so on the agent side this is complete validation, with no ground-truth gate for the engine to backstop. Groups still over the limit after cutting are not blocked here: the engine either re-cuts them immediately by overflow size or asks again in the next round with targeted feedback.
pub fn lint_agent_answer_segment_repair(payload: &str, answer: &str) -> Vec<String> {
    parse_segment_repair_page(payload, answer)
        .diagnostics
        .problems
        .iter()
        .map(|problem| format!("[{}] {}", problem.code, problem.detail))
        .collect()
}

/// The mirror lint of punct-repair `task submit`.
///
/// It shares the one implementation, [`parse_punct_repair_page`], with the engine: per sentence, the non-punctuation atoms are identical, at least one sentence-end punctuation mark is added, and there are no conflicting or dangling punctuation marks. All of these are string-level checks, so on the agent side this is complete validation. Whether the split sentences can be mapped back to source words is backstopped on the engine side. Failing to map them back just means “this sentence comes again next round,” not a submission error.
pub fn lint_agent_answer_punct_repair(payload: &str, answer: &str) -> Vec<String> {
    parse_punct_repair_page(payload, answer)
        .diagnostics
        .problems
        .iter()
        .map(|problem| match &problem.scope {
            ProblemScope::Sentence { id } => {
                format!("[{}] {id}: {}", problem.code, problem.detail)
            }
            _ => format!("[{}] {}", problem.code, problem.detail),
        })
        .collect()
}

/// VoiceInk's AutoCorrect hook sits between the polish apply and stage stamping. Here too, formatting runs before the final rebind, so that word text, paragraph pins and the polish fingerprint are all based on the final CJK typesetting. LLM-degraded sentences also pass through rule-based formatting, but keep their fallback diagnostic marker. Formatting uses the source text's typesetting ([`AutocorrectOptions::source`]): whitespace in Korean sentences marks word boundaries, so it is not touched.
fn autocorrect_mapped_sentences(words: &[Word], paragraphs: &mut [Vec<MappedSentence>]) {
    if !source_is_cjk(words) {
        return;
    }
    for sentence in paragraphs.iter_mut().flatten() {
        let current = if sentence.corrected.is_empty() {
            span_text(words, sentence.start, sentence.end)
        } else {
            sentence.corrected.clone()
        };
        let formatted = format_with_options(&current, AutocorrectOptions::source());
        if formatted != current {
            sentence.corrected = formatted;
        }
    }
}

/// The reason for a sentence-level retry candidate (the `reason` field added to each item of `polish-retry` json-v0).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RetryReasonKind {
    /// The similarity gate was not passed: the extent of the rewrite is out of bounds. It may be hallucination, or it may be a correct restoration of a term.
    LowSimilarity,
    /// A surface-level defect: a dangling false sentence-end, or glued Latin strings (conflicting punctuation is already normalized in code at the carrier layer).
    SurfaceArtifact,
}

impl RetryReasonKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::LowSimilarity => "low-similarity",
            Self::SurfaceArtifact => "surface-artifact",
        }
    }

    /// The targeted instruction fed back to the model.
    ///
    /// `surface-artifact` names the criterion that `text` actually hits, rather than throwing a disjunction of “a dangling sentence-end or glued Latin strings.” Given a disjunction, the model can only guess. In practice it either returned the text unchanged, or changed the final `.` to `...`, so two rounds produced zero real fixes.
    fn instruction(self, text: &str) -> String {
        match self {
            Self::LowSimilarity => {
                "the previous correction crossed the conservative similarity threshold — keep every spoken word and only fix recognition errors and punctuation"
                    .to_owned()
            }
            Self::SurfaceArtifact => {
                let mut defects: Vec<&str> = Vec::new();
                if crate::seam::contains_dangling_sentence_end(text) {
                    defects.push(
                        "a sentence ends on a dangling connector/preposition — join it with the sentence that completes the clause, or restore the spoken words that finish it; changing or appending final punctuation (including \"...\") does not fix this",
                    );
                }
                if crate::seam::contains_conflicting_punctuation(text) {
                    defects.push("two conflicting punctuation marks sit next to each other");
                }
                if is_cjk_text(text) && crate::seam::contains_likely_collapsed_latin_atom(text, 20) {
                    defects
                        .push("a run-together Latin phrase needs its spoken word boundaries restored");
                }
                if defects.is_empty() {
                    "the previous correction still contains a surface defect".to_owned()
                } else {
                    format!(
                        "the previous correction still contains a surface defect: {}",
                        defects.join("; ")
                    )
                }
            }
        }
    }
}

/// Whether there has been **no substantive progress** between two rewrites: identical character for character, or only the sentence-final punctuation changed.
///
/// Measured runs of `surface-artifact` retries show exactly these two shapes: in one round 4 of 6 were identical, and in another 4 of 5 only changed the final `.` to `...`. Neither can turn [`has_surface_artifact`] negative, so asking another round is pure waiting. On a hit, the sentence is therefore removed from the subsequent rounds.
fn retry_made_no_progress(before: &str, after: &str) -> bool {
    if before == after {
        return true;
    }
    fn strip(text: &str) -> &str {
        text.trim_end_matches(|ch: char| {
            crate::seam::is_sentence_final_punct(ch) || ch.is_whitespace()
        })
    }
    strip(before) == strip(after)
}

/// Whether a sentence carries a surface-level defect (same criterion as [`crate::filepipe::lint_polish_page`]).
///
/// Conflicting adjacent punctuation is already normalized in code by [`crate::seam::normalize_conflicting_punctuation`] at the carrier layer, so this normally does not fire on the regular path. It is kept as a guard for entry points that bypass the carrier layer (direct calls to `validated_retry_correction`).
fn has_surface_artifact(text: &str) -> bool {
    crate::seam::contains_dangling_sentence_end(text)
        || crate::seam::contains_conflicting_punctuation(text)
        || (is_cjk_text(text) && crate::seam::contains_likely_collapsed_latin_atom(text, 20))
}

/// The maximum number of sentences per `polish-retry` payload (paging counts only sentences; the payload itself is small).
const POLISH_RETRY_MAX_SENTENCES: usize = 40;

/// The sentence-level retry wave (`kind = "polish-retry"`; the json-v0 contract is unchanged, with a new `reason` per item).
///
/// Candidates = sentences that failed the similarity gate ∪ sentences with surface-level defects (retry-strategy redesign §2.2). They are split by [`crate::paging::balanced_page_sizes`] into pages of at most [`POLISH_RETRY_MAX_SENTENCES`] sentences, and each is checked individually. Failed sentences are asked again in round two with `retry_reason` ([`RetryPolicy::UNIT_ROUNDS`] rounds in total). When exhausted, there are two kinds of close-out:
///
/// - `low-similarity` → revert to the original words (`fallback = true`, the same as the old implementation, counted in `fallback_sentences`);
/// - `surface-artifact` → **keep the model text** and count in [`PolishOutcome::surface_artifact_sentences`]. The words of these sentences are themselves right; reverting them to the original words would only trade a surface defect for an entire unpolished sentence. The `polish-false-sentence-end` / `polish-surface-artifact` warnings of `ccut check` continue to act as the backstop.
///
/// There is no carrier-level retry inside a round: the round is the retry. A retryable transport error only means “no answer this round.” Terminal and Cancelled errors propagate as usual.
fn low_similarity_retry(
    words: &[Word],
    paragraphs: &mut [Vec<MappedSentence>],
    llm: &mut dyn LlmJson,
    options: &PolishOptions,
    analysis: Option<&Analysis>,
    outcome: &mut PolishOutcome,
) -> Result<(), LlmError> {
    let system = retry_system_prompt(options);
    // The targeted feedback of the previous round for a sentence, addressed by the word index of its first word.
    let mut verdicts: BTreeMap<usize, String> = BTreeMap::new();
    // Sentences already asked: once the rounds are exhausted, they are closed out according to their reason.
    let mut seen: BTreeMap<usize, RetryReasonKind> = BTreeMap::new();
    // Confirmed local corrections may remain below the surface threshold.
    // Their accepted verdict must survive both re-queueing and finalization.
    let mut confirmed = std::collections::BTreeSet::new();
    // Sentences whose answer from the previous round is substantively no different from the original: asking again would give no different result, so they are closed out directly.
    let mut no_progress: std::collections::BTreeSet<usize> = std::collections::BTreeSet::new();
    for round in 1..=RetryPolicy::UNIT_ROUNDS {
        let mut targets: Vec<(usize, RetryReasonKind)> = Vec::new();
        for sentence in paragraphs.iter().flatten() {
            if sentence.fallback || sentence.corrected.is_empty() {
                continue;
            }
            if no_progress.contains(&sentence.start) || confirmed.contains(&sentence.start) {
                continue;
            }
            let original = span_text(words, sentence.start, sentence.end);
            let reason = if is_low_similarity(&original, &sentence.corrected, analysis) {
                RetryReasonKind::LowSimilarity
            } else if has_surface_artifact(&sentence.corrected) {
                RetryReasonKind::SurfaceArtifact
            } else {
                continue;
            };
            targets.push((sentence.start, reason));
        }
        if targets.is_empty() {
            break;
        }
        for (start, reason) in &targets {
            seen.insert(*start, *reason);
        }
        if round == 1 {
            outcome.low_similarity_retries += targets.len() as u32;
        }
        let sizes = crate::paging::balanced_page_sizes(
            &vec![1usize; targets.len()],
            POLISH_RETRY_MAX_SENTENCES,
        );
        let mut cursor = 0usize;
        let mut answers: std::collections::HashMap<usize, String> =
            std::collections::HashMap::new();
        for size in sizes {
            let batch = &targets[cursor..cursor + size];
            cursor += size;
            let index: BTreeMap<usize, &MappedSentence> = paragraphs
                .iter()
                .flatten()
                .map(|sentence| (sentence.start, sentence))
                .collect();
            let payload_sentences: Vec<serde_json::Value> = batch
                .iter()
                .filter_map(|(start, reason)| {
                    let sentence = index.get(start)?;
                    let before_start = sentence.start.saturating_sub(LOW_SIMILARITY_CONTEXT_WORDS);
                    let after_end =
                        (sentence.end + 1 + LOW_SIMILARITY_CONTEXT_WORDS).min(words.len());
                    Some(serde_json::json!({
                        "startWordIndex": sentence.start,
                        "reason": reason.as_str(),
                        "originalWords": span_text(words, sentence.start, sentence.end),
                        "previousAttempt": sentence.corrected,
                        "contextBefore": if before_start < sentence.start {
                            span_text(words, before_start, sentence.start - 1)
                        } else { String::new() },
                        "contextAfter": if sentence.end + 1 < after_end {
                            span_text(words, sentence.end + 1, after_end - 1)
                        } else { String::new() },
                    }))
                })
                .collect();
            if payload_sentences.is_empty() {
                continue;
            }
            let payload = serde_json::json!({
                "language": options.language,
                "sentences": payload_sentences,
            })
            .to_string();
            let notes: Vec<String> = batch
                .iter()
                .filter_map(|(start, reason)| {
                    verdicts
                        .get(start)
                        .cloned()
                        .or_else(|| {
                            let sentence = index.get(start)?;
                            (round > 1).then(|| reason.instruction(&sentence.corrected))
                        })
                        .map(|note| format!("startWordIndex {start}: {note}"))
                })
                .collect();
            let response = llm.complete(&LlmRequest {
                kind: "polish-retry",
                system: system.clone(),
                user: payload,
                temperature: 0.2,
                attempt: round,
                retry_reason: (!notes.is_empty()).then(|| notes.join("；")),
            });
            let parsed: Option<RetryResponse> = match response {
                Ok(raw) => decode(&raw).ok(),
                Err(error @ LlmError::Terminal(_)) | Err(error @ LlmError::Cancelled) => {
                    return Err(error);
                }
                // A retryable error ⇒ this round has no answer for these sentences of the page; they go to the next round, or to deterministic close-out.
                Err(_) => None,
            };
            if let Some(parsed) = parsed {
                for sentence in parsed.sentences {
                    answers.insert(sentence.start_word_index, sentence.corrected_text);
                }
            }
        }
        verdicts.clear();
        for sentence in paragraphs.iter_mut().flatten() {
            let Some(&reason) = targets
                .iter()
                .find(|(start, _)| *start == sentence.start)
                .map(|(_, reason)| reason)
                .as_ref()
            else {
                continue;
            };
            let original = span_text(words, sentence.start, sentence.end);
            match answers.get(&sentence.start) {
                Some(retried) => {
                    let retried = sanitize_corrected(retried);
                    let retried = crate::seam::normalize_conflicting_punctuation(&retried);
                    match validated_retry_correction(
                        &original,
                        &sentence.corrected,
                        &retried,
                        analysis,
                    ) {
                        Some(validated) => {
                            if !has_surface_artifact(&validated) {
                                confirmed.insert(sentence.start);
                            }
                            if retry_made_no_progress(&sentence.corrected, &validated) {
                                no_progress.insert(sentence.start);
                            }
                            sentence.corrected = validated;
                        }
                        None => {
                            if retry_made_no_progress(&sentence.corrected, &retried) {
                                no_progress.insert(sentence.start);
                            }
                            verdicts.insert(
                                sentence.start,
                                format!(
                                    "[{}] {}",
                                    reason.as_str(),
                                    reason.instruction(&sentence.corrected)
                                ),
                            );
                        }
                    }
                }
                None => {
                    verdicts.insert(
                        sentence.start,
                        format!(
                            "[{}] {}",
                            reason.as_str(),
                            reason.instruction(&sentence.corrected)
                        ),
                    );
                }
            }
        }
    }
    // Deterministic close-out when the rounds are exhausted: low-similarity reverts to the original words; surface-artifact keeps the model text.
    for sentence in paragraphs.iter_mut().flatten() {
        if sentence.fallback || sentence.corrected.is_empty() {
            continue;
        }
        let Some(&reason) = seen.get(&sentence.start) else {
            continue;
        };
        let original = span_text(words, sentence.start, sentence.end);
        if !confirmed.contains(&sentence.start)
            && is_low_similarity(&original, &sentence.corrected, analysis)
        {
            sentence.corrected = String::new();
            sentence.fallback = true;
            continue;
        }
        if reason == RetryReasonKind::SurfaceArtifact && has_surface_artifact(&sentence.corrected) {
            outcome.surface_artifact_sentences += 1;
        }
    }
    Ok(())
}

fn classify_suggestion(original: &str, corrected: &str, enabled: &BTreeSet<String>) -> String {
    if normalize_chars(original) == normalize_chars(corrected) && enabled.contains("punct") {
        return "punct".to_owned();
    }
    let non_punctuation = enabled
        .iter()
        .filter(|value| value.as_str() != "punct")
        .collect::<Vec<_>>();
    if non_punctuation.len() == 1 {
        return non_punctuation[0].clone();
    }
    let original_lower = original.to_lowercase();
    let corrected_lower = corrected.to_lowercase();
    if enabled.contains("term") && original_lower == corrected_lower && original != corrected {
        return "term".to_owned();
    }
    let shortened = corrected.chars().count() < original.chars().count();
    if enabled.contains("filler")
        && shortened
        && [" um ", " uh ", " you know ", " i mean ", " 呃 ", " 额 "]
            .iter()
            .any(|needle| format!(" {original_lower} ").contains(needle))
    {
        return "filler".to_owned();
    }
    if enabled.contains("wordy") && shortened {
        return "wordy".to_owned();
    }
    if enabled.contains("grammar") {
        return "grammar".to_owned();
    }
    if enabled.contains("term") {
        return "term".to_owned();
    }
    if enabled.contains("typo") {
        return "typo".to_owned();
    }
    enabled
        .iter()
        .next()
        .cloned()
        .unwrap_or_else(|| "typo".to_owned())
}

/// Migrate layout keys displaced by a text rebind to the new word closest in time.
///
/// `breaks` are pinned after a word and migrate by t1; `paraBreaks` are pinned before a word and migrate by t0. `hidden` is a property of the word itself, and migrates only when the old and new word time windows overlap, so a deleted filler does not hide a different word far away. Keys that still find no target are handed to [`TranscriptDoc::prune_orphan_overrides`].
pub(crate) fn rebase_orphan_layout_overrides(
    doc: &mut TranscriptDoc,
    previous_words: &[Word],
) -> usize {
    let current_ids: BTreeSet<String> = doc.words.iter().map(|word| word.id.clone()).collect();
    let previous_by_id: BTreeMap<&str, &Word> = previous_words
        .iter()
        .map(|word| (word.id.as_str(), word))
        .collect();
    let nearest = |old: &Word, after: bool, require_overlap: bool| {
        doc.words
            .iter()
            .filter(|word| {
                word.sp == old.sp && (!require_overlap || (word.t0 <= old.t1 && word.t1 >= old.t0))
            })
            .min_by(|left, right| {
                let old_edge = if after { old.t1 } else { old.t0 };
                let left_edge = if after { left.t1 } else { left.t0 };
                let right_edge = if after { right.t1 } else { right.t0 };
                (left_edge - old_edge)
                    .abs()
                    .total_cmp(&(right_edge - old_edge).abs())
                    .then_with(|| left.id.cmp(&right.id))
            })
            .map(|word| word.id.clone())
    };

    let break_moves = doc
        .breaks
        .iter()
        .filter(|(id, _)| !current_ids.contains(*id))
        .filter_map(|(id, value)| {
            previous_by_id
                .get(id.as_str())
                .and_then(|old| nearest(old, true, false))
                .map(|target| (id.clone(), target, *value))
        })
        .collect::<Vec<_>>();
    let para_moves = doc
        .para_breaks
        .iter()
        .filter(|(id, _)| !current_ids.contains(*id))
        .filter_map(|(id, value)| {
            previous_by_id
                .get(id.as_str())
                .and_then(|old| nearest(old, false, false))
                .map(|target| (id.clone(), target, *value))
        })
        .collect::<Vec<_>>();
    let hidden_moves = doc
        .hidden
        .iter()
        .filter(|(id, _)| !current_ids.contains(*id))
        .filter_map(|(id, value)| {
            previous_by_id
                .get(id.as_str())
                .and_then(|old| nearest(old, false, true))
                .map(|target| (id.clone(), target, *value))
        })
        .collect::<Vec<_>>();

    let moved = break_moves.len() + para_moves.len() + hidden_moves.len();
    for (old, target, value) in break_moves {
        doc.breaks.remove(&old);
        doc.breaks.entry(target).or_insert(value);
    }
    for (old, target, value) in para_moves {
        doc.para_breaks.remove(&old);
        doc.para_breaks.entry(target).or_insert(value);
    }
    for (old, target, value) in hidden_moves {
        doc.hidden.remove(&old);
        doc.hidden.entry(target).or_insert(value);
    }
    moved
}

#[allow(clippy::too_many_arguments)]
fn apply(
    doc: &mut TranscriptDoc,
    words: &[Word],
    paragraphs: Vec<Vec<MappedSentence>>,
    ids: &mut dyn IdSource,
    cue_max_chars: usize,
    enabled_checks: &BTreeSet<String>,
    stamp_segment: bool,
    outcome: &mut PolishOutcome,
) {
    let mut new_words: Vec<Word> = Vec::with_capacity(words.len());
    // Korean ranges built syllable by syllable before 0.5: after the rebind, the “sticks to previous” marker is recomputed by the old rules.
    let mut legacy_spans: Vec<std::ops::Range<usize>> = Vec::new();
    let mut cursor = 0;
    let mut paragraph_first_ids: Vec<String> = Vec::new();

    for group in &paragraphs {
        let mut sentence_indices = Vec::with_capacity(group.len());
        let mut first_id_of_paragraph: Option<String> = None;
        for sentence in group {
            // Coverage gaps (the words left behind by skipped sentences) are copied over as they are.
            while cursor < sentence.start {
                new_words.push(words[cursor].clone());
                cursor += 1;
            }
            let span = &words[sentence.start..=sentence.end];
            let original_text = join_word_texts(span.iter());
            let new_start = new_words.len();
            if sentence.corrected.is_empty() {
                new_words.extend_from_slice(span);
            } else {
                // Suggestions (differences in CJK boundary spacing are no-ops in the display layer, so they produce no suggestion).
                if collapse_cjk_spaces_like(span, &sentence.corrected)
                    != collapse_cjk_spaces_like(span, &original_text)
                {
                    let cat =
                        classify_suggestion(&original_text, &sentence.corrected, enabled_checks);
                    outcome.suggestions.push(Suggestion {
                        cat: cat.to_owned(),
                        find: original_text.clone(),
                        replace: sentence.corrected.clone(),
                        first_word_id: span[0].id.clone(),
                        last_word_id: span[span.len() - 1].id.clone(),
                    });
                }
                let rebound = rebind_corrected(span, &sentence.corrected, ids);
                if rebound.is_empty() {
                    new_words.extend_from_slice(span);
                } else {
                    if crate::rebind::is_legacy_span(span) {
                        legacy_spans.push(new_start..new_start + rebound.len());
                    }
                    new_words.extend(rebound);
                }
            }
            cursor = sentence.end + 1;
            let slice = &new_words[new_start..];
            if slice.is_empty() {
                continue;
            }
            if first_id_of_paragraph.is_none() {
                first_id_of_paragraph = Some(slice[0].id.clone());
            }
            sentence_indices.push(outcome.sentences.len());
            outcome.sentences.push(SentenceRecord {
                first_word_id: slice[0].id.clone(),
                last_word_id: slice[slice.len() - 1].id.clone(),
                t0: slice[0].t0,
                t1: slice[slice.len() - 1].t1,
                text: if sentence.corrected.is_empty() {
                    original_text
                } else {
                    sentence.corrected.clone()
                },
                fallback: sentence.fallback,
            });
            if sentence.fallback {
                outcome.fallback_sentences += 1;
            }
        }
        if !sentence_indices.is_empty() {
            outcome.paragraphs.push(sentence_indices);
            paragraph_first_ids
                .push(first_id_of_paragraph.expect("non-empty paragraph has first id"));
        }
    }
    while cursor < words.len() {
        new_words.push(words[cursor].clone());
        cursor += 1;
    }
    for range in legacy_spans {
        crate::rebind::reglue_legacy_span(&mut new_words, range, &doc.hidden);
    }
    doc.words = new_words;
    // When a rebind turns one word into several tokens inside an extremely narrow original word window, the per-token centisecond minimum can push the new word past the healthy anchor on the right. A document-wide repair then expands into adjacent word windows that have slack, so that a legitimate text revision does not fail atomically with a t0 rollback only at the final write.
    let timing_report = word_timing_repair(&mut doc.words);
    debug_assert!(
        timing_report.unrepairable.is_empty(),
        "polish produced unrepairable word timings: {:?}",
        timing_report.unrepairable
    );
    if !timing_report.repaired.is_empty() {
        let timings: BTreeMap<&str, (f64, f64)> = doc
            .words
            .iter()
            .map(|word| (word.id.as_str(), (word.t0, word.t1)))
            .collect();
        for sentence in &mut outcome.sentences {
            if let Some((t0, _)) = timings.get(sentence.first_word_id.as_str()) {
                sentence.t0 = *t0;
            }
            if let Some((_, t1)) = timings.get(sentence.last_word_id.as_str()) {
                sentence.t1 = *t1;
            }
        }
    }
    let rebased_overrides = rebase_orphan_layout_overrides(doc, words);
    let pruned_overrides = doc.prune_orphan_overrides();
    doc.stages.polish = Some(fingerprint(&doc.words));
    // First segmentation: derive paragraph pins from the polished paragraph groups (one LLM call feeds both stages). When paragraph segmentation degrades (`stamp_segment=false`), the healthy page's paragraph pins still land, but the stage stamp is withheld: `segment` stays pending, and the dedicated segmentation flow re-segments the whole document.
    let mut layout_touched = rebased_overrides > 0 || pruned_overrides > 0;
    if doc.stages.segment.is_none() {
        for id in paragraph_first_ids.iter().skip(1) {
            doc.para_breaks.insert(id.clone(), true);
        }
        if stamp_segment {
            doc.stages.segment = Some(id_fingerprint(&doc.words));
        }
        layout_touched = true;
    }
    // After punctuation is finalized, lay out balanced break points. The optimizer always runs; the user's pinned set is a hard constraint, and the result goes only into `autoBreaks[layoutProfile]`. Layout changes made by the pipeline itself refresh the asrLayout stamp (computed only from user breaks, paraBreaks and hidden), and must not count as manual edits. The §18.5 parameters take the document profile's `source` (`--layout-profile`); `--cue-line-length` overrides only the line width.
    let cue_params = crate::cue::CueParams {
        max_chars: cue_max_chars,
        ..crate::layout_profile::cue_params_for_doc(doc)
    };
    if crate::layout::ensure_balanced_cue_layout(doc, &cue_params) {
        layout_touched = true;
    }
    if layout_touched {
        doc.stages.asr_layout = Some(crate::layout::layout_fingerprint(doc));
    }
    outcome.cue_layout = crate::layout::cue_layout_stats(doc, &cue_params);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr_rows::RowIn;
    use crate::build::build_doc;
    use crate::doc::{DocEngine, DocMedia};
    use crate::rebind::SeqIds;

    /// p-fb353b44 measured: two rounds of `surface-artifact` retries produced 0 real fixes. In one round 4/6 were identical; in another 4/5 only changed the final `.` to `...`. Both shapes are judged as no progress.
    #[test]
    fn punctuation_only_and_identical_retry_answers_count_as_no_progress() {
        assert!(retry_made_no_progress("but.", "but."));
        assert!(retry_made_no_progress("but.", "but..."));
        assert!(retry_made_no_progress("就是说当。", "就是说当…"));
        assert!(retry_made_no_progress("done!", "done?"));
        assert!(retry_made_no_progress("done.", "done. "));
        // Actually changing words is not no progress.
        assert!(!retry_made_no_progress("but.", "but we moved on."));
        assert!(!retry_made_no_progress("就是说当。", "就是说当时。"));
    }

    /// The `surface-artifact` instruction must name the criterion actually hit, not throw a disjunction.
    #[test]
    fn surface_artifact_instruction_names_the_defect_it_found() {
        let dangling = RetryReasonKind::SurfaceArtifact.instruction("It's a good example of.");
        assert!(dangling.contains("dangling connector"), "{dangling}");
        assert!(!dangling.contains("run-together"), "{dangling}");
        let collapsed = RetryReasonKind::SurfaceArtifact
            .instruction("反 purereinforcementlearning，至少这样。");
        assert!(collapsed.contains("run-together"), "{collapsed}");
        assert!(!collapsed.contains("dangling connector"), "{collapsed}");
    }

    fn doc(text: &str) -> TranscriptDoc {
        build_doc(
            &[RowIn::new(0.0, 10.0, text)],
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 100.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    /// A real regression in the p1222 benchmark: term masking recognized only the literal `Vasuman Moza` and its variants. The short form `Vasuman` written back by the retry was not in the mask table, so similarity dropped to 0.538 and the gate blocked it. The model gave the same answer in both rounds, changing only one word; the word-level yardstick should let it through.
    #[test]
    fn retry_confirming_one_word_term_fix_survives_the_similarity_gate() {
        let analysis = Analysis {
            terms: vec![crate::engines::brief::AnalysisTerm {
                term: "Vasuman Moza".to_owned(),
                note: None,
                observed_variants: vec!["Voss".to_owned(), "Foss".to_owned(), "Paul".to_owned()],
            }],
            ..Analysis::default()
        };
        // The gate still judges the similarity as low. The fix is to the retry-confirmation path, not to the gate's threshold.
        assert!(is_low_similarity(
            "Thanks, Foss.",
            "Thanks, Vasuman.",
            Some(&analysis)
        ));
        assert!(confirmed_local_correction(
            "Thanks, Foss.",
            "Thanks, Vasuman.",
            "Thanks, Vasuman."
        ));
    }

    #[test]
    fn retry_rejects_rewrites_that_are_not_local() {
        // Whole-sentence rewrite: the word count was added or removed beyond the bound.
        assert!(!confirmed_local_correction(
            "Thanks, Foss.",
            "The speaker thanks the audience for coming today.",
            "The speaker thanks the audience for coming today."
        ));
        // Same word count, but nearly everything changed.
        assert!(!confirmed_local_correction(
            "Thanks, Foss.",
            "Goodbye, everyone.",
            "Goodbye, everyone."
        ));
        // The two rounds' answers disagree, so this is not a confirmation.
        assert!(!confirmed_local_correction(
            "Thanks, Foss.",
            "Thanks, Voss.",
            "Thanks, Vasuman."
        ));
    }

    /// The 5 sentences from the full polish benchmark (c0065) where the model gave the correct answer in both rounds and was still rejected: restoring a person's name or term in a short Chinese sentence is a local change under the atom yardstick.
    #[test]
    fn retry_accepts_confirmed_cjk_name_restorations_by_atom_locality() {
        let confirmed = [
            (
                "谁也不能这个对呃移动它啊啊，然后让让说",
                "谁也不能这个，对呃，移动它啊啊，然后 Yann LeCun 说……",
            ),
            (
                "让说我作为一个科学家的正直，对吗？",
                "Yann LeCun 说，我作为一个科学家的正直，对吗？",
            ),
            (
                "呃呃有样在这确实不难对啊",
                "呃呃，有 Yann LeCun 在，这确实不难，对啊。",
            ),
            (
                "嗯，因为在老师的心中，亚元院是一个更好的选择。",
                "嗯，因为在老师的心中，MSRA 是一个更好的选择。",
            ),
        ];
        for (original, retried) in confirmed {
            assert!(
                confirmed_local_correction(original, retried, retried),
                "{original} → {retried}"
            );
            assert_eq!(
                validated_retry_correction(original, retried, retried, None),
                Some(retried.to_owned()),
                "{original}"
            );
        }
        // The previous round dropped a word and the retry restored it: the two rounds' answers differ, and character similarity is dragged down by a long English word, so it takes the “atom-local, no net word deletion” path.
        for (original, previous, retried) in [
            ("reputation。嗯。", "嗯。", "representation。嗯。"),
            ("INFRACTOR. 对。", "对。", "infrastructure。对。"),
        ] {
            assert!(is_low_similarity(original, retried, None), "{original}");
            assert!(!confirmed_local_correction(original, previous, retried));
            assert!(local_atom_restoration(original, retried), "{original}");
            assert_eq!(
                validated_retry_correction(original, previous, retried, None),
                Some(retried.to_owned()),
                "{original}"
            );
        }
        // The restoration path does not let through word-dropping or whole-sentence rewrites.
        assert!(!local_atom_restoration("reputation。嗯。", "嗯。"));
        assert!(!local_atom_restoration(
            "呃呃有样在这确实不难对啊",
            "有他在当然容易，对吧。"
        ));
        assert!(!local_atom_restoration(
            "Thanks, Foss.",
            "Goodbye, everyone."
        ));
        assert_eq!(
            validated_retry_correction(
                "呃呃有样在这确实不难对啊",
                "有他在当然容易，对吧。",
                "有他在当然容易，对吧。",
                None
            ),
            None
        );
    }

    #[test]
    fn retry_boundary_regression_keeps_the_locally_confirmed_page_correction() {
        let original = "就是说当。你的 group 数目越多，效果越明显。";
        let previous = "就是说当你的 group 数目越多，效果越明显。";
        let retried = "就是说当。你的 group 数目越多，效果越明显。";

        assert_eq!(
            validated_retry_correction(original, previous, retried, None),
            Some(previous.to_owned())
        );

        let punctuation_previous = "所以他说，呃，继续。";
        assert_eq!(
            validated_retry_correction(
                "所以他说。，呃，继续。",
                punctuation_previous,
                "所以他说。，呃，继续。",
                None,
            ),
            Some(punctuation_previous.to_owned())
        );

        let latin_previous = "我反对 pure reinforcement learning。";
        assert_eq!(
            validated_retry_correction(
                "我反对 purereinforcementlearning。",
                latin_previous,
                "我反对 purereinforcementlearning。",
                None,
            ),
            Some(latin_previous.to_owned())
        );
    }

    /// Generate the source text of `count` short words (unique word forms, so they are easy to locate in the payload).
    fn numbered_words(count: usize) -> String {
        (0..count)
            .map(|index| format!("w{index:03}"))
            .collect::<Vec<_>>()
            .join(" ")
    }

    #[test]
    fn split_sentence_text_respects_abbreviations_and_decimals() {
        assert_eq!(
            split_sentence_text("Dr. Smith spoke. Then we ate. Done."),
            vec!["Dr. Smith spoke.", "Then we ate.", "Done."]
        );
        assert_eq!(
            split_sentence_text("The rate is 2.14 percent overall."),
            vec!["The rate is 2.14 percent overall."]
        );
        assert_eq!(
            split_sentence_text("你好。这是第二句。"),
            vec!["你好。", "这是第二句。"]
        );
        // No internal clause punctuation: return it as is, and leave it to the span-limit handling.
        assert_eq!(
            split_sentence_text("no terminal punctuation here"),
            vec!["no terminal punctuation here"]
        );
    }

    // ---- File contract (file-v1) path --------------------------------------------

    /// One step of a fake provider: receives the rendered page text and returns one response.
    type PolishStep = Box<dyn Fn(&str) -> Result<String, LlmError>>;

    /// A fake provider that replays in order: each step receives the rendered page text and returns one response.
    ///
    /// It goes through the default serial `complete_batch_with` of [`LlmJson`], so the order within a round of [`complete_batch_retry_with`] is “all pending pages of this round, in page order.”
    struct PolishFileLlm {
        steps: std::collections::VecDeque<PolishStep>,
        calls: Vec<(String, String, Option<String>)>,
    }

    impl PolishFileLlm {
        fn new(steps: Vec<PolishStep>) -> Self {
            Self {
                steps: steps.into(),
                calls: Vec::new(),
            }
        }

        fn kinds(&self) -> Vec<&str> {
            self.calls
                .iter()
                .map(|(kind, _, _)| kind.as_str())
                .collect()
        }
    }

    impl LlmJson for PolishFileLlm {
        fn complete(&mut self, request: &LlmRequest) -> Result<String, LlmError> {
            self.calls.push((
                request.kind.to_owned(),
                request.user.clone(),
                request.retry_reason.clone(),
            ));
            match self.steps.pop_front() {
                Some(step) => step(&request.user),
                None => Err(LlmError::Terminal("script exhausted".to_owned())),
            }
        }
    }

    fn echo() -> PolishStep {
        Box::new(|input: &str| Ok(input.to_owned()))
    }

    fn constant(answer: &'static str) -> PolishStep {
        Box::new(move |_: &str| Ok(answer.to_owned()))
    }

    /// Replace the core region of a rendered page text with `core`; the rest (the fences and the read-only regions) is kept verbatim.
    fn answer_with_core(input: &str, core: &str) -> String {
        let lines: Vec<&str> = input.lines().collect();
        let begin = lines
            .iter()
            .position(|line| *line == FENCE_EDIT_BEGIN)
            .expect("edit-begin");
        let end = lines
            .iter()
            .position(|line| *line == FENCE_EDIT_END)
            .expect("edit-end");
        let mut out: Vec<String> = lines[..=begin].iter().map(|l| (*l).to_owned()).collect();
        out.extend(core.lines().map(|l| l.to_owned()));
        out.extend(lines[end..].iter().map(|l| (*l).to_owned()));
        let mut text = out.join("\n");
        text.push('\n');
        text
    }

    fn core_of(input: &str) -> String {
        let lines: Vec<&str> = input.lines().collect();
        let begin = lines
            .iter()
            .position(|line| *line == FENCE_EDIT_BEGIN)
            .expect("edit-begin");
        let end = lines
            .iter()
            .position(|line| *line == FENCE_EDIT_END)
            .expect("edit-end");
        lines[begin + 1..end].join("\n")
    }

    fn rewrite_core(rewrite: impl Fn(&str) -> String + 'static) -> PolishStep {
        Box::new(move |input: &str| Ok(answer_with_core(input, &rewrite(&core_of(input)))))
    }

    /// Cut the core region at a paragraph boundary every 20 sentences (200 words under the `long_text` measure), keeping the word stream verbatim. Once the paragraph-quality gate was introduced, pages exceeding the single-paragraph word limit are judged as paragraph-degraded, so echo-style long-page tests must, like a real model, return an answer with legal paragraph segmentation.
    fn segment_core(core: &str) -> String {
        let mut out = String::new();
        for (index, chunk) in core.split_inclusive('.').enumerate() {
            if index > 0 {
                out.push_str(if index % 20 == 0 { "\n\n" } else { " " });
            }
            out.push_str(chunk.trim_start());
        }
        out
    }

    /// Verbatim echo with legal segmentation (see [`segment_core`]).
    fn segmented_echo() -> PolishStep {
        rewrite_core(|core| segment_core(core))
    }

    /// The main polish tests turn off the speaker-repair wave in front and the speaker-names wave at the end. The fake LLM here recognizes only polish payloads; in multi-speaker fixtures, sentences that sit right against a change point would be sent out as candidates by the former, and placeholder speaker names would make the latter send a real-name inference call. Each of those two waves has its own tests ([`crate::engines::speaker_repair`] / [`crate::engines::speaker_names`]).
    fn file_options() -> PolishOptions {
        PolishOptions {
            speaker_repair: false,
            speaker_names: false,
            ..PolishOptions::default()
        }
    }

    /// A synthetic word stream with one sentence-end punctuation mark every 10 words (to avoid tripping the single-sentence span limit in long-page tests).
    fn long_text(words: usize) -> String {
        let mut text = String::new();
        for index in 0..words {
            if index > 0 {
                text.push(' ');
            }
            text.push_str(&format!("word{index}"));
            if (index + 1) % 10 == 0 {
                text.push('.');
            }
        }
        text
    }

    #[test]
    fn polish_joins_the_file_contract_whitelist_but_polish_retry_does_not() {
        assert!(crate::filepipe::uses_file_contract("polish"));
        assert!(!crate::filepipe::uses_file_contract("polish-retry"));
        assert_eq!(PolishOptions::default().worker_slots, None);
    }

    #[test]
    fn terminal_error_aborts_the_run() {
        let mut doc = doc("hello world");
        let mut llm = PolishFileLlm::new(vec![Box::new(|_: &str| {
            Err(LlmError::Terminal("401".to_owned()))
        })]);
        let mut ids = SeqIds::default();
        let result = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        );
        assert!(matches!(result, Err(LlmError::Terminal(_))));
        assert!(doc.stages.polish.is_none());
    }

    #[test]
    fn cjk_polish_runs_autocorrect_before_stamping() {
        let mut doc = doc("你好,这是ios应用.");
        doc.lang = "zh".to_owned();
        let mut llm = PolishFileLlm::new(vec![echo()]);
        let mut ids = SeqIds::default();
        let mut options = file_options();
        options.language = "zh".to_owned();

        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let text = join_word_texts(doc.words.iter());
        assert_eq!(text, "你好，这是 iOS 应用。");
        assert_eq!(outcome.sentences[0].text, text);
        assert_eq!(doc.stages.polish, Some(fingerprint(&doc.words)));
        assert_eq!(crate::autocorrect::format(&text), text);
    }

    #[test]
    fn cjk_polish_respects_disabled_autocorrect() {
        let mut doc = doc("你好,这是ios应用.");
        doc.lang = "zh".to_owned();
        let mut llm = PolishFileLlm::new(vec![echo()]);
        let mut ids = SeqIds::default();
        let mut options = file_options();
        options.language = "zh".to_owned();
        options.autocorrect = false;

        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let text = join_word_texts(doc.words.iter());
        // The word mapper still emits canonical atom boundaries; disabling
        // AutoCorrect specifically preserves ASCII punctuation and casing.
        assert_eq!(text, "你好, 这是 ios 应用.");
        assert_eq!(outcome.sentences[0].text, text);
    }

    /// Korean is split on spaces, and a word often contains digits or Latin letters. Typesetting must not insert spaces inside a word, nor merge the words on either side of a quotation mark: the word list is identical, word for word, before and after polishing.
    #[test]
    fn korean_polish_autocorrect_keeps_words_whole() {
        let source = "오늘은 2박 3일 일정에 600원이라는 AI가 “좋아” 하고 말했어요.";
        let mut doc = doc(source);
        doc.lang = "ko".to_owned();
        let before: Vec<String> = doc.words.iter().map(|word| word.text.clone()).collect();
        assert_eq!(before.len(), source.split(' ').count());
        let mut llm = PolishFileLlm::new(vec![echo()]);
        let mut ids = SeqIds::default();
        let mut options = file_options();
        options.language = "ko".to_owned();

        run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let after: Vec<String> = doc.words.iter().map(|word| word.text.clone()).collect();
        assert_eq!(after, before);
        assert_eq!(join_word_texts(doc.words.iter()), source);
    }

    #[test]
    fn file_contract_page_round_trips_end_to_end() {
        let mut doc = doc("hello world this is a test we are done now");
        let mut llm = PolishFileLlm::new(vec![rewrite_core(|core| {
            assert!(core.contains("hello world"));
            "Hello world, this is a test.\n\nWe are done now.".to_owned()
        })]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool, usize)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.len(),
                ));
            },
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish"]);
        assert_eq!(attempts, vec![("p001".to_owned(), 1, true, 0)]);
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(outcome.fallback_sentences, 0);
        assert_eq!(outcome.sentences.len(), 2);
        // Blank line → paragraph boundary (Decision 4).
        assert_eq!(outcome.paragraphs.len(), 2);
        assert!(!outcome.suggestions.is_empty());
        assert!(doc.stages.polish.is_some());
        assert!(doc.stages.segment.is_some());
        assert_eq!(doc.para_breaks.len(), 1);
        assert!(outcome.cue_layout.cues > 0);
        doc.validate().unwrap();
    }

    #[test]
    fn broken_fences_are_rejected_then_accepted_on_retry() {
        let mut doc = doc("hello world this is a test we are done now");
        let mut llm = PolishFileLlm::new(vec![constant("Sure! Here you go: hello world."), echo()]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(u32, bool, Vec<ProblemCode>)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.iter().map(|p| p.code).collect(),
                ));
            },
        )
        .unwrap();
        assert_eq!(attempts.len(), 2);
        assert_eq!(attempts[0].0, 1);
        assert!(!attempts[0].1);
        assert!(attempts[0].2.contains(&ProblemCode::DocumentTruncated));
        assert_eq!(attempts[1], (2, true, Vec::new()));
        // Invariant: a rejected attempt must carry at least one §10 problem.
        assert!(
            attempts
                .iter()
                .all(|(_, accepted, problems)| *accepted || !problems.is_empty())
        );
        // retry_reason is injected only when a semantic check fails.
        assert!(llm.calls[0].2.is_none());
        assert!(llm.calls[1].2.is_some());
        assert_eq!(outcome.fallback_pages, 0);
        doc.validate().unwrap();
    }

    #[test]
    /// §2.2: a read-only context region being rewritten wholesale **no longer rejects the page**. The read-only region never writes back to the ground truth, so this page's body is accepted as usual and no retry call is made.
    fn readonly_context_drift_no_longer_rejects_the_page() {
        let mut doc = doc(&long_text(900));
        let options = PolishOptions {
            worker_slots: Some(2),
            ..file_options()
        };
        // The second page replaces its read-only preceding text wholesale (far below READONLY_DRIFT_MIN_SIMILARITY), yet its core region still echoes back with legal segmentation.
        let mut llm = PolishFileLlm::new(vec![
            segmented_echo(),
            Box::new(|input: &str| {
                let answer = answer_with_core(input, &segment_core(&core_of(input)));
                let lines: Vec<&str> = answer.lines().collect();
                let before = lines
                    .iter()
                    .position(|line| *line == FENCE_CONTEXT_BEFORE)
                    .expect("context-before");
                let begin = lines
                    .iter()
                    .position(|line| *line == FENCE_EDIT_BEGIN)
                    .expect("edit-begin");
                let mut out: Vec<String> =
                    lines[..=before].iter().map(|l| (*l).to_owned()).collect();
                out.push("totally different context sentence written by the model.".to_owned());
                out.extend(lines[begin..].iter().map(|l| (*l).to_owned()));
                let mut text = out.join("\n");
                text.push('\n');
                Ok(text)
            }),
            // Page-seam judgment: a verbatim echo ⇒ the page seam is merged.
            echo(),
        ]);
        let mut ids = SeqIds::default();
        let mut codes: Vec<ProblemCode> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |attempt| codes.extend(attempt.problems.iter().map(|p| p.code)),
        )
        .unwrap();
        assert_eq!(
            llm.calls.len(),
            3,
            "two pages once each + the seam judgment is one payload, no retry"
        );
        assert_eq!(llm.calls[2].0, "seam-repair");
        assert!(!codes.contains(&ProblemCode::SourceDrift), "{codes:?}");
        assert_eq!(outcome.fallback_pages, 0);
        doc.validate().unwrap();
    }

    #[test]
    fn speaker_change_forces_a_paragraph_break_even_when_the_model_merges_both_sides() {
        let mut doc = doc("alpha bravo charlie delta echo foxtrot golf hotel");
        doc.speakers.insert(
            "s2".to_owned(),
            crate::doc::Speaker {
                name: "S2".to_owned(),
                hue: None,
            },
        );
        for word in doc.words.iter_mut().skip(4) {
            word.sp = "s2".to_owned();
        }
        assert!(
            doc.stages.segment.is_none(),
            "fixture must be unsegmented, otherwise the assertion falls through"
        );
        // The model merged the two sides of ⏹ into one sentence inside a paragraph and changed the text (the non-verbatim path).
        let mut llm = PolishFileLlm::new(vec![rewrite_core(|_| {
            "Alpha bravo charlee delta echo foxtrot golf hotel.".to_owned()
        })]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            outcome.paragraphs.len(),
            2,
            "⏹ must split into two paragraphs"
        );
        assert_eq!(outcome.sentences.len(), 2);
        assert!(outcome.sentences[1].text.starts_with("echo"));
        assert_eq!(
            outcome.forced_boundary_snapped, 0,
            "must take the exact split, not the snap fallback"
        );
        assert_eq!(doc.para_breaks.len(), 1);
        doc.validate().unwrap();
    }

    /// Soft markers with speaker labels exist only in the payload: even if the model copies them back, they cannot enter `words`.
    #[test]
    fn labelled_speaker_marker_reaches_the_payload_but_never_the_words() {
        let mut doc = doc("alpha bravo charlie delta echo foxtrot golf hotel");
        doc.speakers.insert(
            "s2".to_owned(),
            crate::doc::Speaker {
                name: "S2".to_owned(),
                hue: None,
            },
        );
        for word in doc.words.iter_mut().skip(4) {
            word.sp = "s2".to_owned();
        }
        let mut llm = PolishFileLlm::new(vec![Box::new(|input: &str| {
            assert!(
                input.contains("delta ⏹S2"),
                "payload lacks the labeled soft marker: {input}"
            );
            // The model copied labeled soft markers into the editable region.
            Ok(answer_with_core(
                input,
                "Alpha bravo charlie delta. ⏹S2\n\nEcho foxtrot golf hotel.",
            ))
        })]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        let text = join_word_texts(doc.words.iter());
        assert!(
            !text.contains('⏹') && !text.contains("S2"),
            "soft marker or label leaked into the word stream: {text}"
        );
        assert!(
            outcome
                .sentences
                .iter()
                .all(|sentence| !sentence.text.contains("S2")),
            "label leaked into the sentence records: {:?}",
            outcome.sentences
        );
        assert_eq!(
            outcome.paragraphs.len(),
            2,
            "⏹ still splits into two paragraphs"
        );
        doc.validate().unwrap();
    }

    #[test]
    fn low_similarity_sentence_triggers_the_json_retry_from_the_file_path() {
        let mut doc = doc(
            "one two three four. five six seven eight. nine ten eleven twelve. thirteen fourteen fifteen sixteen.",
        );
        let mut llm = PolishFileLlm::new(vec![
            rewrite_core(|_| {
                "one two three four. five six seven eight. nine ten eleven twelve. Completely alternative phrasing overall.".to_owned()
            }),
            constant(
                r#"{"sentences":[{"startWordIndex":12,"correctedText":"Thirteen fourteen fifteen sixteen."}]}"#,
            ),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        // Single-sentence retry still uses the json-v0 polish-retry (Decision 5).
        assert_eq!(llm.kinds(), vec!["polish", "polish-retry"]);
        assert_eq!(outcome.low_similarity_retries, 1);
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(outcome.fallback_sentences, 0);
        doc.validate().unwrap();
    }

    #[test]
    fn confirmed_short_name_correction_survives_the_whole_retry_wave() {
        let mut doc = doc("one two three four. five six seven eight. Thanks, Foss.");
        let mut llm = PolishFileLlm::new(vec![
            rewrite_core(|_| {
                "one two three four. five six seven eight. Thanks, Vasuman.".to_owned()
            }),
            constant(r#"{"sentences":[{"startWordIndex":8,"correctedText":"Thanks, Vasuman."}]}"#),
        ]);
        assert!(is_low_similarity("Thanks, Foss.", "Thanks, Vasuman.", None));
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut SeqIds::default(),
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "polish-retry"]);
        assert_eq!(outcome.fallback_sentences, 0);
        assert!(join_word_texts(doc.words.iter()).contains("Vasuman"));
        doc.validate().unwrap();
    }

    /// §2.2 sentence-level retry wave: low-similarity sentences that are not recovered in both rounds revert to the original words. The wave is bounded ([`RetryPolicy::UNIT_ROUNDS`] rounds); it is no longer a “single call with no retry.”
    #[test]
    fn low_similarity_wave_runs_two_rounds_before_falling_back_to_the_source() {
        let mut doc = doc(
            "one two three four. five six seven eight. nine ten eleven twelve. thirteen fourteen fifteen sixteen.",
        );
        let mut llm = PolishFileLlm::new(vec![
            rewrite_core(|_| {
                "one two three four. five six seven eight. nine ten eleven twelve. Completely alternative phrasing overall.".to_owned()
            }),
            // Both rounds returned the same out-of-bounds rewrite ⇒ both rounds fail.
            constant(
                r#"{"sentences":[{"startWordIndex":12,"correctedText":"Yet another entirely different sentence."}]}"#,
            ),
            constant(
                r#"{"sentences":[{"startWordIndex":12,"correctedText":"Yet another entirely different sentence."}]}"#,
            ),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "polish-retry", "polish-retry"]);
        // The second round carries targeted feedback (the instruction of `reason`).
        assert!(
            llm.calls[2]
                .2
                .as_deref()
                .is_some_and(|reason| reason.contains("startWordIndex 12")),
            "{:?}",
            llm.calls[2].2
        );
        // The payload carries `reason` per item (the new field of the json-v0 contract).
        assert!(llm.calls[1].1.contains("\"reason\":\"low-similarity\""));
        assert_eq!(outcome.low_similarity_retries, 1);
        assert_eq!(outcome.fallback_sentences, 1);
        assert_eq!(outcome.surface_artifact_sentences, 0);
        doc.validate().unwrap();
    }

    /// §2.2 close-out split: after exhaustion, `surface-artifact` sentences **keep the model text**. The words themselves are right, and reverting them to the original words would only trade a surface defect for an entire unpolished sentence; they are only counted.
    #[test]
    fn surface_artifact_sentences_keep_the_model_text_after_the_wave() {
        let mut doc = doc("就是说当 你的 group 数目 越多 效果 越明显");
        let mut llm = PolishFileLlm::new(vec![
            // The main wave returned a dangling false sentence-end. The carrier layer only logs a warning, and the body is accepted as usual.
            rewrite_core(|_| "就是说当。你的 group 数目越多效果越明显。".to_owned()),
            // Both retry rounds failed to fix that false sentence-end.
            constant(r#"{"sentences":[]}"#),
            constant(r#"{"sentences":[]}"#),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert!(llm.calls[1].1.contains("\"reason\":\"surface-artifact\""));
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(outcome.surface_artifact_sentences, 1);
        // Key point: the model text is kept; the sentence is not reverted wholesale to the original words.
        assert!(
            outcome.sentences.iter().all(|sentence| !sentence.fallback),
            "{:?}",
            outcome.sentences
        );
        doc.validate().unwrap();
    }

    /// The R3 ladder: the whole page up to [`RetryPolicy::MAX_PAGE_ATTEMPTS`] times → halve and narrow, once each for the two halves → half-pages that still fail fall back to the original words. Total call volume is the same order of magnitude as the old three whole-page retries, and the fallback granularity is halved.
    #[test]
    fn page_fatal_ladder_splits_before_falling_back_to_the_source() {
        let mut doc = doc("one two three four five six seven eight nine ten");
        let garbage =
            || rewrite_core(|_| "completely unrelated words entirely different content".to_owned());
        let mut llm = PolishFileLlm::new(vec![
            garbage(),
            garbage(),
            garbage(),
            garbage(),
            garbage(),
            garbage(),
        ]);
        let mut ids = SeqIds::default();
        let before = doc.words.clone();
        let mut page_ids: Vec<String> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                if !attempt.accepted {
                    assert!(!attempt.problems.is_empty());
                    page_ids.push(attempt.page_id.to_owned());
                }
            },
        )
        .unwrap();
        assert_eq!(
            page_ids[..2],
            ["p001".to_owned(), "p001".to_owned()],
            "whole page twice first"
        );
        assert!(
            page_ids[2..].iter().all(|id| id.starts_with("p001-h")),
            "afterwards only the half-page is retried: {page_ids:?}"
        );
        assert_eq!(outcome.split_retry_pages, (page_ids.len() - 2) as u32);
        assert_eq!(outcome.fallback_pages, outcome.split_retry_pages);
        // Consistent with the json-v0 accounting: the sentences of a fallen-back half-page are likewise counted in fallback_sentences.
        assert!(outcome.fallback_sentences > 0);
        assert!(outcome.sentences.iter().all(|s| s.fallback));
        assert_eq!(doc.words, before, "fallback keeps the original words");
        assert!(doc.stages.polish.is_some());
        doc.validate().unwrap();
    }

    /// When, after narrowing, at least a half is recovered, only the failed half falls back.
    #[test]
    fn split_retry_saves_the_half_that_the_model_can_handle() {
        let mut doc = doc(&long_text(600));
        let garbage =
            || rewrite_core(|_| "completely unrelated words entirely different content".to_owned());
        let mut llm = PolishFileLlm::new(vec![
            garbage(),
            garbage(),
            // The first half-page echoes normally; the second half-page keeps answering off-topic.
            segmented_echo(),
            garbage(),
            // The page-seam judgment payload (after the half-pages are stitched back, it is still the same page, so no page-seam candidate arises).
            echo(),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(outcome.split_retry_pages, 2);
        assert_eq!(
            outcome.fallback_pages, 1,
            "only the failed half-page falls back"
        );
        assert!(
            outcome.sentences.iter().any(|s| !s.fallback),
            "the recovered half is not a degraded sentence"
        );
        doc.validate().unwrap();
    }

    #[test]
    fn multi_page_run_keeps_each_page_to_its_own_words() {
        let mut doc = doc(&long_text(1500));
        let options = PolishOptions {
            worker_slots: Some(3),
            ..file_options()
        };
        let before = doc.words.clone();
        let mut llm = PolishFileLlm::new(vec![
            segmented_echo(),
            segmented_echo(),
            segmented_echo(),
            // Two page seams combined into one seam-repair payload: a verbatim echo ⇒ both page seams are merged.
            echo(),
        ]);
        let mut ids = SeqIds::default();
        let mut pages: Vec<String> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |attempt| pages.push(attempt.page_id.to_owned()),
        )
        .unwrap();
        assert_eq!(pages, vec!["p001", "p002", "p003", "sm1-001"]);
        assert_eq!(outcome.seam_merged_paragraphs, 2);
        assert_eq!(outcome.seam_kept_paragraphs, 0);
        // No bleed between pages: each core region contains none of the other's words.
        let cores: Vec<String> = llm
            .calls
            .iter()
            .filter(|(kind, _, _)| kind == "polish")
            .map(|(_, user, _)| core_of(user))
            .collect();
        assert!(cores[0].contains("word0 ") && !cores[0].contains("word1400"));
        assert!(cores[2].contains("word1400") && !cores[2].contains(" word0 "));
        assert_eq!(outcome.fallback_pages, 0);
        // Verbatim echo ⇒ the word stream is unchanged.
        assert_eq!(doc.words, before);
        doc.validate().unwrap();
    }

    #[test]
    fn worker_slots_lower_the_page_budget_until_the_wave_is_full() {
        let doc = doc(&long_text(2000));
        let scopes = vec![0..doc.words.len()];
        // The budget is an upper bound: with a default of 2200 words, 2000 words give only 1 page.
        assert_eq!(
            plan_polish_file_pages(&doc.words, &scopes, Some(1)).len(),
            1
        );
        // An unknown slot count is equivalent to “1 slot”: neither does wave alignment.
        assert_eq!(plan_polish_file_pages(&doc.words, &scopes, None).len(), 1);
        // Unlimited concurrency (`usize::MAX`) likewise falls back to the budget and is not chopped up by div_ceil.
        assert_eq!(
            plan_polish_file_pages(&doc.words, &scopes, Some(usize::MAX)).len(),
            1
        );
        // Slot-wave alignment: 4 slots ⇒ re-laid out as 4 pages.
        assert_eq!(
            plan_polish_file_pages(&doc.words, &scopes, Some(4)).len(),
            4
        );
        // Lower-bound guard: with so many slots that each page would hold fewer than 400 words, do not split any finer.
        assert_eq!(
            plan_polish_file_pages(&doc.words, &scopes, Some(16)).len(),
            1
        );
    }

    /// The paginator and the reattachment validator use the same yardstick. Under the default budget, the worst-case page (budget + 10% slack, with a further 15% overflow fully used) must still be well within the atom-LCS capacity. A Chinese character is one atom, and under this yardstick a CJK page and a Latin page have the same atom count, so there is no language difference.
    #[test]
    fn default_page_budget_stays_well_inside_the_validator_capacity() {
        let budget = PolishBudget::default();
        let worst_page = (budget.core_words + crate::paging::page_slack(budget.core_words)) as f64
            * (1.0 + budget.overflow_ratio);
        let capacity = polish_page_atom_capacity();
        assert!(capacity >= 7_000, "capacity {capacity}");
        assert!(
            (worst_page as usize) * 2 <= capacity,
            "worst page {worst_page} atoms must leave ≥2× headroom under {capacity}"
        );

        // The 1.0.9 incident shape: 13506 CJK atoms. Now paginated at 2200 words ⇒ about 6 pages, each within capacity, and walked through check_page_capacity with actual CJK text.
        let text: String = (0..13_506)
            .map(|index| {
                let ch = char::from_u32(0x4E00 + (index % 2000) as u32).unwrap();
                if index % 17 == 16 {
                    format!("{ch}。")
                } else {
                    ch.to_string()
                }
            })
            .collect();
        let doc = doc(&text);
        let plans = plan_polish_file_pages(&doc.words, &[0..doc.words.len()], None);
        assert!(plans.len() >= 5, "pages {}", plans.len());
        for plan in &plans {
            let atoms: usize = doc.words[plan.core.clone()]
                .iter()
                .map(|word| word_count(&word.text))
                .sum();
            assert!(atoms <= capacity, "{} has {atoms} atoms", plan.id);
        }
        check_page_capacity(&doc.words, &plans).unwrap();
    }

    /// A paginator mismatch (a page's atom count exceeds the validator's capacity) terminates before the LLM is called, with an error that states the page number and atom count clearly, rather than sending out a page that is structurally incapable of passing and retrying it three times.
    #[test]
    fn oversized_page_is_rejected_before_any_llm_call() {
        let capacity = polish_page_atom_capacity();
        let doc = doc(&long_text(capacity + 1));
        let plans = vec![PolishPagePlan {
            id: "p001".to_owned(),
            before: 0..0,
            core: 0..doc.words.len(),
            after: doc.words.len()..doc.words.len(),
            hard_cut_start: false,
            hard_cut_end: false,
            para_starts: Vec::new(),
        }];
        let error = check_page_capacity(&doc.words, &plans).unwrap_err();
        assert!(!error.is_retryable(), "{error}");
        let message = error.to_string();
        assert!(message.contains("polish page p001 too large"), "{message}");
        assert!(
            message.contains(&format!("{} source atoms", capacity + 1)),
            "{message}"
        );
        assert!(message.contains(&format!("({capacity})")), "{message}");
    }

    /// Adjacent or overlapping paragraph ranges passed by `--paragraphs` are merged into one scope before pagination. A 2000-word fallback page split into 20 consecutive paragraphs for a targeted re-polish should still be one page, not 20 single-paragraph small pages; non-adjacent ranges stay independent.
    #[test]
    fn adjacent_scope_ranges_are_coalesced_before_paging() {
        let doc = doc(&long_text(2000));
        let ranges: Vec<Range<usize>> = (0..20).rev().map(|i| i * 100..(i + 1) * 100).collect();
        let options = PolishOptions {
            scope_ranges: ranges,
            ..PolishOptions::default()
        };
        assert_eq!(resolve_scopes(&doc.words, &options), vec![0..2000]);
        let plans = plan_polish_file_pages(&doc.words, &[0..2000], None);
        assert_eq!(plans.len(), 1);

        let options = PolishOptions {
            scope_ranges: vec![500..600, 100..250, 0..100, 240..300, 5000..6000],
            ..PolishOptions::default()
        };
        assert_eq!(resolve_scopes(&doc.words, &options), vec![0..300, 500..600]);
    }

    #[test]
    fn agent_lint_and_engine_validate_agree_on_the_same_bad_answer() {
        let words = doc("hello world this is a test we are done now").words;
        let plan = plan_polish_file_pages(&words, &[0..words.len()], None)
            .pop()
            .expect("one page");
        let input = render_polish_page(&words, &plan).text;

        // A good answer: both sides pass.
        assert!(lint_agent_answer_file(&input, &input).is_empty());
        let clean = parse_polish_page(&words, &plan, &input, &input);
        assert!(clean.diagnostics.problems.is_empty());

        // A bad answer: the fence was eaten.
        let broken = "Sure! Here you go: hello world.";
        let agent = lint_agent_answer_file(&input, broken);
        assert_eq!(agent.len(), 1);
        assert!(agent[0].starts_with("[document-truncated]"));
        let engine = parse_polish_page(&words, &plan, &input, broken);
        assert_eq!(
            engine.diagnostics.codes(),
            vec![ProblemCode::DocumentTruncated]
        );
        // The engine's scope is the page, while the agent side's scope is the document. The criteria share one source; only the granularity of location differs.
        assert!(matches!(
            engine.diagnostics.problems[0].scope,
            ProblemScope::Page { .. }
        ));

        // The core region was emptied: both sides judge the empty core per §10, rather than each judging on its own.
        let emptied = answer_with_core(&input, "");
        let agent_empty = lint_agent_answer_file(&input, &emptied);
        let engine_empty = parse_polish_page(&words, &plan, &input, &emptied);
        assert_eq!(agent_empty.len(), engine_empty.diagnostics.problems.len());
        assert!(!agent_empty.is_empty());
    }

    #[test]
    fn file_path_never_overwrites_an_existing_segmentation_or_manual_layout() {
        let mut doc = doc("hello world this is a test we are done now");
        // Already segmented, with existing manual layout pins.
        doc.stages.segment = Some("seg-fp".to_owned());
        let pinned = doc.words[3].id.clone();
        doc.para_breaks.insert(pinned.clone(), true);
        doc.breaks
            .insert(doc.words[5].id.clone(), crate::doc::BreakOverride::Break);
        let mut llm = PolishFileLlm::new(vec![rewrite_core(|_| {
            "Hello world, this is a test.\n\nWe are done now.".to_owned()
        })]);
        let mut ids = SeqIds::default();
        run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(doc.stages.segment.as_deref(), Some("seg-fp"));
        assert_eq!(doc.para_breaks.len(), 1);
        assert!(doc.para_breaks.contains_key(&pinned));
        // When a word replacement replaces the original id, a manual break migrates to the new word at the same time position, instead of being lost and then overwritten by auto-layout.
        assert_eq!(doc.breaks.len(), 1);
        let (break_id, value) = doc.breaks.iter().next().unwrap();
        assert_eq!(*value, crate::doc::BreakOverride::Break);
        assert_eq!(
            doc.words
                .iter()
                .find(|word| &word.id == break_id)
                .map(|word| word.text.as_str()),
            Some("test.")
        );
        doc.validate().unwrap();
    }

    /// Strip the ⏸ hints from the punct-repair payload and hand each entry body to `repunct` for rewriting; fence lines and blank lines are kept as they are.
    fn punct_repair_answer(repunct: impl Fn(&str) -> String + 'static) -> PolishStep {
        Box::new(move |input: &str| {
            let out: Vec<String> = input
                .lines()
                .map(|line| {
                    let trimmed = line.trim();
                    if trimmed.starts_with(FENCE_SENTENCE_BEGIN_PREFIX)
                        || trimmed.starts_with(FENCE_SENTENCE_END_PREFIX)
                        || trimmed.is_empty()
                    {
                        line.to_owned()
                    } else {
                        repunct(&crate::engines::markers::strip_markers(line))
                    }
                })
                .collect();
            Ok(out.join("\n"))
        })
    }

    /// Add one full stop every `every` whitespace-separated words (only punctuation is added; the words are kept verbatim).
    fn period_every_words(every: usize) -> impl Fn(&str) -> String {
        move |body: &str| {
            let words: Vec<&str> = body.split_whitespace().collect();
            words
                .chunks(every)
                .map(|chunk| format!("{}.", chunk.join(" ")))
                .collect::<Vec<_>>()
                .join(" ")
        }
    }

    /// An over-long single sentence **no longer rejects the page**. A page echoed back verbatim with no clause punctuation is accepted on the first round (it does not enter the fallback), and the over-long sentences go to the punct-repair wave. If the model echoes back unchanged in all [`PUNCT_REPAIR_MAX_ROUNDS`] rounds (adding not a single sentence-end punctuation mark), each round is rejected by SentenceOversize, and from the second round a per-sentence targeted instruction is carried. When the rounds are exhausted, the engine cuts deterministically by length as a fallback, and no over-long sentence remains at the exit.
    #[test]
    fn oversized_run_on_is_accepted_then_split_deterministically_after_punct_repair_rounds() {
        let mut doc = doc(&numbered_words(300));
        // The main-page echo (accepted on the first round), plus the punct-repair echo unchanged in every round.
        let mut llm = PolishFileLlm::new(vec![echo(), echo(), echo(), echo()]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool, Vec<ProblemCode>)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.iter().map(|p| p.code).collect(),
                ));
            },
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec!["polish", "punct-repair", "punct-repair", "punct-repair"],
            "main page passes in one round, over-long sentences run all targeted punctuation rounds"
        );
        assert_eq!(attempts.len(), 4);
        assert!(attempts[0].2 && attempts[0].3.is_empty(), "{attempts:?}");
        for (round, attempt) in attempts[1..].iter().enumerate() {
            assert_eq!(attempt.0, format!("pr{}-{:03}", round + 1, round + 1));
            assert_eq!(attempt.1, round as u32 + 1);
            assert!(!attempt.2 && attempt.3 == vec![ProblemCode::SentenceOversize]);
        }
        // From the second round on, a per-sentence targeted instruction is carried; there is none in the first round.
        assert!(llm.calls[1].2.is_none());
        for call in &llm.calls[2..] {
            assert!(
                call.2.as_deref().is_some_and(|reason| {
                    reason.starts_with("[sentence-oversize] s01: [sentence-oversize]")
                        && reason.contains("未新增任何句末标点")
                }),
                "{:?}",
                call.2
            );
        }
        // The payload is single-sentence entries with ID fences.
        assert!(
            llm.calls[1]
                .1
                .contains("<<<SENTENCE-BEGIN id=s01 min-sentences=")
        );
        assert!(llm.calls[1].1.contains("<<<SENTENCE-END id=s01>>>"));
        assert_eq!(outcome.fallback_pages, 0, "润色文本被接受，不是原文兜底");
        assert_eq!(outcome.punct_repaired_sentences, 0);
        assert_eq!(outcome.punct_split_sentences, 1);
        assert_eq!(outcome.oversized_sentences, 0);
        // Length fallback: the left piece takes 1200 source characters (240 words × 5) and closes with a full stop.
        assert_eq!(outcome.sentences.len(), 2, "{:?}", outcome.sentences);
        assert!(
            outcome.sentences[0].text.ends_with("w239."),
            "{}",
            outcome.sentences[0].text
        );
        assert!(
            outcome.sentences[1].text.starts_with("w240"),
            "{}",
            outcome.sentences[1].text
        );
        assert_eq!(doc.words.len(), 300);
        doc.validate().unwrap();
    }

    /// The main punct-repair path: the main page accepts over-long sentences on the first round, and punct-repair's first round adds only a full stop and passes ⇒ the sentence is cut at the new sentence-end punctuation and re-mapped to source words, with no retry_reason, no second round, and no deterministic fallback.
    #[test]
    fn punct_repair_splits_the_run_on_when_the_model_only_adds_periods() {
        let mut doc = doc(&numbered_words(300));
        let mut llm = PolishFileLlm::new(vec![echo(), punct_repair_answer(period_every_words(50))]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool, Vec<ProblemCode>)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.iter().map(|p| p.code).collect(),
                ));
            },
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "punct-repair"]);
        assert_eq!(attempts.len(), 2, "{attempts:?}");
        assert!(attempts[1].2 && attempts[1].3.is_empty(), "{attempts:?}");
        assert!(llm.calls[1].2.is_none());
        assert_eq!(outcome.punct_repaired_sentences, 1);
        assert_eq!(outcome.punct_split_sentences, 0);
        assert_eq!(outcome.oversized_sentences, 0);
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(outcome.sentences.len(), 6, "{:?}", outcome.sentences);
        for (index, sentence) in outcome.sentences.iter().enumerate() {
            assert!(sentence.text.ends_with('.'), "{}", sentence.text);
            assert!(
                sentence.text.starts_with(&format!("w{:03}", index * 50)),
                "{}",
                sentence.text
            );
            assert!(!sentence.fallback);
        }
        assert_eq!(doc.words.len(), 300);
        doc.validate().unwrap();
    }

    /// A real incident regression: when the main polish page is echoed back unchanged, sentence derivation falls back to cutting at the 80-word/character semantic cap. The old logic sent only sentences over 300/500 units or 1200 characters to punctuation repair, so these 80-unit sentences were stored without punctuation. Now they must enter punct-repair.
    #[test]
    fn punctuation_starved_semantic_cap_enters_punct_repair() {
        let text = "字".repeat(SENTENCE_MAX_WORDS);
        let mut doc = doc(&text);
        let mut llm = PolishFileLlm::new(vec![
            echo(),
            punct_repair_answer(|body| {
                let chars: Vec<char> = body.chars().collect();
                format!(
                    "{}。{}。",
                    chars[..SENTENCE_MAX_WORDS / 2].iter().collect::<String>(),
                    chars[SENTENCE_MAX_WORDS / 2..].iter().collect::<String>()
                )
            }),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "punct-repair"]);
        assert_eq!(outcome.punct_repaired_sentences, 1);
        assert_eq!(outcome.sentences.len(), 2, "{:?}", outcome.sentences);
        assert!(
            outcome
                .sentences
                .iter()
                .all(|sentence| sentence.text.ends_with('。'))
        );
        doc.validate().unwrap();
    }

    /// The first round's echo is rejected ⇒ the second round's request carries that sentence's targeted instruction. The second round adds the full stop and converges, without a third round.
    #[test]
    fn punct_repair_second_round_carries_the_verdict_and_converges() {
        let mut doc = doc(&numbered_words(300));
        let mut llm = PolishFileLlm::new(vec![
            echo(),
            echo(),
            punct_repair_answer(period_every_words(100)),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "punct-repair", "punct-repair"]);
        assert!(
            llm.calls[2]
                .2
                .as_deref()
                .is_some_and(|reason| reason.contains("s01: [sentence-oversize]")),
            "{:?}",
            llm.calls[2].2
        );
        assert_eq!(outcome.punct_repaired_sentences, 1);
        assert_eq!(outcome.punct_split_sentences, 0);
        assert_eq!(outcome.sentences.len(), 3, "{:?}", outcome.sentences);
        doc.validate().unwrap();
    }

    /// The real incident shape (p014 at 1652 characters, p042 at 1822 characters: the same speaker, no full stops, pause-rich long Chinese sentences). The payload carries ⏸ hints projected from the source pauses. If the model fails to break the sentence in all three rounds, the engine cuts deterministically at long pauses along the source timeline: each piece is ≤ the single-sentence limit, closes with `。`, and contains no `。。` or `。，`.
    #[test]
    fn cjk_pause_rich_run_on_gets_hints_and_splits_at_long_pauses() {
        let base =
            "这个模型在训练的时候没有见过这样的数据所以它的表现会差一些然后我们再看第二个问题";
        let row_text: String = base.chars().cycle().take(140).collect();
        // 12 lines × 140 characters = 1680 characters, with a 2s pause between lines, same speaker.
        let rows: Vec<RowIn> = (0..12)
            .map(|index| {
                RowIn::new(
                    index as f64 * 12.0,
                    index as f64 * 12.0 + 10.0,
                    row_text.clone(),
                )
            })
            .collect();
        let mut doc = build_doc(
            &rows,
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 200.0,
                sample_rate: None,
            },
            "zh",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        );
        assert_eq!(doc.words.len(), 1680);
        // The main-page echo, plus three rounds of punct-repair echo, plus one round of segment-repair for the paragraph still over the limit after sentence cutting (one sentence per paragraph, verifying that the cut sentences can now be inserted into by paragraph splitting).
        let mut llm = PolishFileLlm::new(vec![
            echo(),
            echo(),
            echo(),
            echo(),
            segment_repair_answer(1),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &PolishOptions {
                language: "zh".to_owned(),
                ..file_options()
            },
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec![
                "polish",
                "punct-repair",
                "punct-repair",
                "punct-repair",
                "segment-repair"
            ]
        );
        // The payload body carries 11 long-pause hints, and the hints are not part of the answer check (once the echo is stripped clean, it still judges no sentence-end).
        let payload = &llm.calls[1].1;
        assert_eq!(payload.matches("⏸⏸⏸").count(), 11, "{payload}");
        assert_eq!(outcome.punct_split_sentences, 1);
        assert_eq!(outcome.oversized_sentences, 0);
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(
            outcome.degenerate_paragraphs, 0,
            "split sentences can get paragraph breaks"
        );
        // Sentences are cut first at long pauses, then by the semantic sentence cap. Every piece except the original sentence end closes with a full stop, and no piece exceeds the CJK single-sentence or paragraph hard cap.
        assert!(outcome.sentences.len() >= 6, "{:?}", outcome.sentences);
        let last = outcome.sentences.len() - 1;
        for (index, sentence) in outcome.sentences.iter().enumerate() {
            let chars = sentence.text.chars().count();
            assert!(
                chars <= MAX_PARAGRAPH_WORDS_CJK,
                "{chars}: {}",
                sentence.text
            );
            assert_eq!(
                index == last,
                !sentence.text.ends_with('。'),
                "{}",
                sentence.text
            );
            assert!(!sentence.text.contains("。。") && !sentence.text.contains("。，"));
        }
        assert_eq!(doc.words.len(), 1680);
        doc.validate().unwrap();
    }

    /// Batching several over-long sentences together: two over-long sentences in one page ⇒ in round one they are packed into one payload (one ID fence pair per sentence). With a known worker slot count they are split across two pages to fill the slots. Each sentence is checked individually, so one rewritten sentence does not drag down the other; only the rejected sentence goes into round two.
    #[test]
    fn punct_repair_batches_sentences_across_pages_and_accepts_per_sentence() {
        // 600 words with one full stop in the middle ⇒ two over-long sentences of 300 words each (1500 source characters).
        let mut doc = doc(&numbered_words(600).replacen("w299 ", "w299. ", 1));
        let words = doc.words.len();
        let mut options = file_options();
        options.worker_slots = Some(2);
        // The main-page echo; punct-repair across two pages: the first page adds the full stops normally, the second page rewrites one word; round two has only the rejected second sentence left; finally the 600-word single paragraph goes through one round of segment-repair as usual.
        let mut llm = PolishFileLlm::new(vec![
            echo(),
            punct_repair_answer(period_every_words(50)),
            punct_repair_answer(|body| {
                let fixed = period_every_words(50)(body);
                fixed.replacen("w", "x", 1)
            }),
            punct_repair_answer(period_every_words(50)),
            segment_repair_answer(3),
        ]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool, Vec<ProblemCode>)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.iter().map(|p| p.code).collect(),
                ));
            },
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec![
                "polish",
                "punct-repair",
                "punct-repair",
                "punct-repair",
                "segment-repair"
            ]
        );
        let ids: Vec<&str> = attempts.iter().map(|(id, ..)| id.as_str()).collect();
        assert_eq!(
            ids,
            vec!["p001", "pr1-001", "pr1-002", "pr2-003", "sr1-001"],
            "{attempts:?}"
        );
        assert!(attempts[1].2 && attempts[1].3.is_empty(), "{attempts:?}");
        assert!(
            !attempts[2].2 && attempts[2].3 == vec![ProblemCode::SourceDrift],
            "{attempts:?}"
        );
        assert!(attempts[3].2 && attempts[3].3.is_empty(), "{attempts:?}");
        // Round one: one sentence per page. Round two has only the rejected second sentence left, carrying its targeted instruction.
        assert!(llm.calls[1].1.contains("id=s01") && !llm.calls[1].1.contains("id=s02"));
        assert!(llm.calls[2].1.contains("id=s02") && !llm.calls[2].1.contains("id=s01"));
        assert!(llm.calls[3].1.contains("w300") && !llm.calls[3].1.contains("w000"));
        assert!(
            llm.calls[3]
                .2
                .as_deref()
                .is_some_and(|reason| reason.contains("[source-drift]")),
            "{:?}",
            llm.calls[3].2
        );
        assert_eq!(outcome.punct_repaired_sentences, 2);
        assert_eq!(outcome.punct_split_sentences, 0);
        assert_eq!(outcome.oversized_sentences, 0);
        assert_eq!(outcome.sentences.len(), 12, "{:?}", outcome.sentences);
        assert_eq!(doc.words.len(), words);
        doc.validate().unwrap();
    }

    #[test]
    fn deterministic_split_prefers_speaker_change_then_pause_and_closes_the_left_piece() {
        let mut doc = doc(&numbered_words(300));
        // A speaker change after word 120, a 2s pause after word 200; everything else is uniform with no pauses.
        doc.speakers.insert(
            "s2".to_owned(),
            crate::doc::Speaker {
                name: "S2".to_owned(),
                hue: None,
            },
        );
        for word in doc.words.iter_mut().skip(120) {
            word.sp = "s2".to_owned();
        }
        let shift = 2.0;
        for word in doc.words.iter_mut().skip(200) {
            word.t0 += shift;
            word.t1 += shift;
        }
        let words = doc.words.clone();
        let sentence = MappedSentence {
            start: 0,
            end: 299,
            corrected: numbered_words(300),
            fallback: false,
        };
        let pieces = split_oversized_sentence(&words, &sentence);
        // First cut: within the window [60, 240], the speaker change (5 points) beats the long pause at 200 (3 points).
        assert_eq!(pieces[0].end, 119);
        assert!(
            pieces[0].corrected.ends_with("w119."),
            "{}",
            pieces[0].corrected
        );
        assert_eq!(pieces[1].start, 120);
        assert!(
            pieces[1].corrected.starts_with("w120"),
            "{}",
            pieces[1].corrected
        );
        // The remaining 180 words × 5 = 900 characters no longer exceed the limit, so no further cutting.
        assert_eq!(pieces.len(), 2);
        assert!(
            pieces
                .iter()
                .all(|piece| oversized_span(&words, piece).is_none())
        );

        // At a pause, the cut point carries the comma from corrected: drop the comma and add a full stop, so that `,.` is not left behind.
        let mut corrected = numbered_words(300);
        corrected = corrected.replacen("w199 ", "w199, ", 1);
        for word in doc.words.iter_mut().skip(120) {
            word.sp = "s1".to_owned();
        }
        let words = doc.words.clone();
        let sentence = MappedSentence {
            start: 0,
            end: 299,
            corrected,
            fallback: false,
        };
        let pieces = split_oversized_sentence(&words, &sentence);
        assert_eq!(
            pieces[0].end,
            199,
            "{:?}",
            pieces.iter().map(|p| (p.start, p.end)).collect::<Vec<_>>()
        );
        assert!(
            pieces[0].corrected.ends_with("w199."),
            "{}",
            pieces[0].corrected
        );
        assert!(!pieces[0].corrected.contains(",."));
    }

    #[test]
    fn punct_repair_hints_project_source_pauses_into_the_corrected_text() {
        let mut doc = doc("alpha bravo charlie delta echo");
        for word in doc.words.iter_mut().skip(2) {
            word.t0 += 1.0;
            word.t1 += 1.0;
        }
        let sentence = MappedSentence {
            start: 0,
            end: 4,
            corrected: "Alpha, bravo charlie delta echo".to_owned(),
            fallback: false,
        };
        assert_eq!(
            punct_repair_hinted_text(&doc.words, &sentence),
            "Alpha, bravo ⏸⏸ charlie delta echo"
        );
    }

    #[test]
    fn one_sentence_cannot_exceed_the_paragraph_capacity() {
        let doc = doc("原文");
        let sentence = MappedSentence {
            start: 0,
            end: 0,
            corrected: "字".repeat(MAX_PARAGRAPH_WORDS_CJK + 1),
            fallback: false,
        };

        let problem = oversized_span(&doc.words, &sentence).unwrap();

        assert!(
            problem.contains("corrected sentence contains 501"),
            "{problem}"
        );
        assert!(problem.contains("limit 500"), "{problem}");
    }

    #[test]
    fn rebind_in_a_tight_window_repairs_timings_and_prunes_stale_overrides() {
        let mut doc = doc("bestpaper next.");
        doc.words[0].t0 = 0.0;
        doc.words[0].t1 = 0.01;
        doc.words[1].t0 = 0.01;
        doc.words[1].t1 = 1.0;
        let replaced = doc.words[0].id.clone();
        doc.breaks
            .insert(replaced.clone(), crate::doc::BreakOverride::Break);
        doc.para_breaks.insert(replaced.clone(), true);
        let words = doc.words.clone();
        let mut ids = SeqIds::default();
        let options = file_options();
        let mut outcome = PolishOutcome::default();
        apply(
            &mut doc,
            &words,
            vec![vec![MappedSentence {
                start: 0,
                end: 1,
                corrected: "best paper next.".to_owned(),
                fallback: false,
            }]],
            &mut ids,
            options.cue_max_chars,
            &options.enabled_checks,
            true,
            &mut outcome,
        );

        doc.validate().unwrap();
        assert!(doc.orphan_overrides().is_empty());
        assert!(!doc.breaks.contains_key(&replaced));
        assert!(!doc.para_breaks.contains_key(&replaced));
        assert!(doc.words.windows(2).all(|pair| pair[1].t0 >= pair[0].t1));
        let sentence = &outcome.sentences[0];
        assert_eq!(sentence.t0, doc.words[0].t0);
        assert_eq!(sentence.t1, doc.words.last().unwrap().t1);
    }

    /// ⏹ is a hard guarantee: even the whole-page fallback (where there is no `PolishParsed` to take) must still land paragraph boundaries.
    #[test]
    fn speaker_change_still_breaks_paragraphs_on_the_whole_page_fallback() {
        let mut doc = doc("alpha bravo charlie delta echo foxtrot golf hotel");
        doc.speakers.insert(
            "s2".to_owned(),
            crate::doc::Speaker {
                name: "S2".to_owned(),
                hue: None,
            },
        );
        for word in doc.words.iter_mut().skip(4) {
            word.sp = "s2".to_owned();
        }
        let garbage = || rewrite_core(|_| "totally unrelated replacement content".to_owned());
        // Two whole-page attempts, then each half-page once after halving: all answered off-topic.
        let mut llm = PolishFileLlm::new(vec![
            garbage(),
            garbage(),
            garbage(),
            garbage(),
            garbage(),
            garbage(),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert!(outcome.fallback_pages >= 1);
        assert_eq!(
            outcome.paragraphs.len(),
            2,
            "the fallback path also breaks the ⏹ count"
        );
        assert!(outcome.sentences[1].text.starts_with("echo"));
        assert_eq!(doc.para_breaks.len(), 1);
        assert!(doc.para_breaks.contains_key(&doc.words[4].id));
        doc.validate().unwrap();
    }

    /// The index-contract answer: for each `<<<BLOCK k | n sentences …>>>` block in the payload, reply with `<<<BLOCK k>>>`, one range every `every` lines (recounted per block), and `<<<BLOCK-END>>>`.
    fn index_answer_every(every: usize) -> PolishStep {
        Box::new(move |input: &str| {
            let mut out: Vec<String> = Vec::new();
            for line in input.lines() {
                let trimmed = line.trim();
                let Some(rest) = trimmed.strip_prefix("<<<BLOCK ") else {
                    continue;
                };
                if rest.starts_with("END") {
                    continue;
                }
                let mut fields = rest.trim_end_matches(">>>").split('|');
                let index: usize = fields.next().unwrap().trim().parse().unwrap();
                let total: usize = fields
                    .next()
                    .unwrap()
                    .trim()
                    .split(' ')
                    .next()
                    .unwrap()
                    .parse()
                    .unwrap();
                out.push(format!("<<<BLOCK {index}>>>"));
                let mut start = 1usize;
                while start <= total {
                    let end = (start + every - 1).min(total);
                    out.push(format!("{start}-{end}"));
                    start = end + 1;
                }
                out.push("<<<BLOCK-END>>>".to_owned());
            }
            Ok(out.join("\n"))
        })
    }

    /// Kept for backward compatibility: the old name for the segment-repair answer.
    fn segment_repair_answer(every: usize) -> PolishStep {
        index_answer_every(every)
    }

    /// The paragraph-segmentation degradation main path (real incident regression: deepseek-v4-flash collapsed a 9-minute transcript page into a single paragraph and still stamped `segment: fresh`). The main page **accepts the body on the first round** (it no longer burns whole-page retries for segmentation), and after the wave segment-repair adds paragraphs in a targeted way. If the model returns only one range in all [`SEGMENT_REPAIR_MAX_ROUNDS`] rounds, then when the rounds run out the engine closes out deterministically by pause level: the paragraph pins land, each paragraph is ≤ the limit, the `segment` stamp is applied as usual, and `fallback_paragraphs` is recorded. Requests from the second round on must carry the paragraph-oversize targeted instruction (including the minimum paragraph count).
    #[test]
    fn oversized_paragraphs_are_split_deterministically_after_rounds_run_out() {
        let mut doc = doc(&long_text(500));
        let before = doc.words.clone();
        // The main-page echo (accepted on the first round), plus the segment-repair echo unchanged in every round (with numbered sentence lines and no blank lines ⇒ a single range).
        let mut llm = PolishFileLlm::new(vec![echo(), echo(), echo(), echo()]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool, Vec<ProblemCode>)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.iter().map(|p| p.code).collect(),
                ));
            },
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec![
                "polish",
                "segment-repair",
                "segment-repair",
                "segment-repair"
            ],
            "main page passes in one round, degenerate paragraphs run all targeted re-segmentation rounds"
        );
        // The main page is accepted on the first round with no problems; the paragraph-splitting repair is rejected by ParagraphOversize in every round.
        assert_eq!(attempts.len(), 4);
        assert!(attempts[0].2 && attempts[0].3.is_empty());
        for (round, attempt) in attempts[1..].iter().enumerate() {
            assert_eq!(attempt.0, format!("sr{}-{:03}", round + 1, round + 1));
            assert_eq!(attempt.1, round as u32 + 1);
            assert!(!attempt.2 && attempt.3.contains(&ProblemCode::ParagraphOversize));
        }
        // The payload is a numbered block; from the second round on it carries the targeted instruction (including the minimum paragraph count); there is none in the first round.
        assert!(
            llm.calls[1]
                .1
                .contains("<<<BLOCK 1 | 50 sentences | 500 words | at least 2 paragraphs>>>")
        );
        assert!(llm.calls[1].1.contains("\n50| word490 word491"));
        assert!(llm.calls[1].2.is_none());
        for call in &llm.calls[2..] {
            assert!(
                call.2
                    .as_deref()
                    .is_some_and(|reason| reason.contains("paragraph-oversize")
                        && reason.contains("第 1 块")
                        && reason.contains("至少拆成 2 个区间")),
                "{:?}",
                call.2
            );
        }
        assert_eq!(
            outcome.fallback_pages, 0,
            "polished text was accepted, not the source fallback"
        );
        assert_eq!(outcome.repaired_paragraphs, 0);
        assert_eq!(outcome.fallback_paragraphs, 1);
        assert_eq!(outcome.degenerate_paragraphs, 0);
        assert_eq!(doc.words, before);
        assert!(doc.stages.polish.is_some());
        assert!(
            doc.stages.segment.is_some(),
            "the deterministic close-out still stamps the stage"
        );
        // 500 words closed at a 300 cap: 300 + 200 ⇒ one pin, landing at word 300 (the start of sentence 31).
        assert_eq!(doc.para_breaks.len(), 1, "{:?}", doc.para_breaks);
        assert!(doc.para_breaks.contains_key(&doc.words[300].id));
        doc.validate().unwrap();
    }

    /// The main page's first-round single-paragraph output is accepted as usual, and segment-repair inserts blank lines ⇒ the paragraph pins land and the segment stamp is applied as usual. The main page is never retried for paragraph degradation.
    #[test]
    fn degenerate_first_round_recovers_after_targeted_segment_repair() {
        let mut doc = doc(&long_text(500));
        // 500 words / one sentence every 10 words = 50 sentence lines; one range every 20 lines ⇒ three paragraphs of 200, 200 and 100 words.
        let mut llm = PolishFileLlm::new(vec![echo(), segment_repair_answer(20)]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "segment-repair"]);
        assert_eq!(outcome.repaired_paragraphs, 1);
        assert_eq!(outcome.degenerate_paragraphs, 0);
        assert_eq!(outcome.fallback_pages, 0);
        // 3 paragraphs ⇒ 2 pins.
        assert_eq!(doc.para_breaks.len(), 2);
        assert!(doc.stages.segment.is_some());
        doc.validate().unwrap();
    }

    /// Multi-page, multi-paragraph batching with per-block acceptance, second pagination and per-round convergence. The main polish splits into two pages, and each page's every 50 sentences (500 words) form one paragraph, so all six paragraphs exceed the limit (Latin cap 300). Round one packs them into payloads (each within the core-region budget). The answer gives each block ranges of 100, 180 and 220 words, but the last block of each payload is returned as a range with a gap, so that block fails with `range-invalid` and is re-sent in round two, while the other blocks in the same payload land as usual. `stages.segment` is stamped as usual; it converges in two rounds and never reaches a third.
    #[test]
    fn segment_repair_batches_paragraphs_across_pages_and_converges_over_rounds() {
        let mut doc = doc(&long_text(3000));
        let main = || {
            rewrite_core(|core| {
                let mut out = String::new();
                for (index, chunk) in core.split_inclusive('.').enumerate() {
                    if index > 0 {
                        out.push_str(if index % 50 == 0 { "\n\n" } else { " " });
                    }
                    out.push_str(chunk.trim_start());
                }
                out
            })
        };
        let round1 = || -> PolishStep {
            Box::new(|input: &str| {
                let total = input.matches("<<<BLOCK-END>>>").count();
                let mut out: Vec<String> = Vec::new();
                for index in 1..=total {
                    out.push(format!("<<<BLOCK {index}>>>"));
                    if index == total {
                        out.push("1-10".to_owned());
                        out.push("12-50".to_owned());
                    } else {
                        out.push("1-10".to_owned());
                        out.push("11-28".to_owned());
                        out.push("29-50".to_owned());
                    }
                    out.push("<<<BLOCK-END>>>".to_owned());
                }
                Ok(out.join("\n"))
            })
        };
        let mut llm = PolishFileLlm::new(vec![
            main(),
            main(),
            // Page-seam judgment: the block is page 1's last paragraph tail window (25 sentences) plus page 2's first paragraph head window (25 sentences), with ranges 1-25 and 26-50 ⇒ the page seam is kept, and the group structure is exactly as it was before judgment.
            index_answer_every(25),
            round1(),
            round1(),
            index_answer_every(10),
            index_answer_every(10),
        ]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool, Vec<ProblemCode>)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                    attempt.problems.iter().map(|p| p.code).collect(),
                ));
            },
        )
        .unwrap();
        assert_eq!(outcome.degenerate_paragraphs, 0, "{attempts:?}");
        assert_eq!(outcome.fallback_paragraphs, 0, "{attempts:?}");
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(outcome.seam_kept_paragraphs, 1, "{attempts:?}");
        assert_eq!(outcome.seam_merged_paragraphs, 0);
        assert_eq!(outcome.repaired_paragraphs, 6, "{attempts:?}");
        assert!(doc.stages.segment.is_some());
        doc.validate().unwrap();

        // The page-seam payload is a window rather than the whole paragraph: 50 lines, with the page seam before line 26.
        let seam_call = llm
            .calls
            .iter()
            .find(|(kind, _, _)| kind == "seam-repair")
            .expect("seam-repair call");
        assert!(
            seam_call
                .1
                .contains("<<<BLOCK 1 | 50 sentences | 500 words | page seam before line 26>>>"),
            "{}",
            seam_call.1
        );

        // The main polish has two pages; round one packs six 3000-word paragraphs into two payloads (budget 2200 + 10%).
        let main_pages = attempts
            .iter()
            .filter(|(id, ..)| id.starts_with('p'))
            .count();
        assert_eq!(main_pages, 2, "{attempts:?}");
        let round1_pages: Vec<_> = attempts
            .iter()
            .filter(|(id, ..)| id.starts_with("sr1-"))
            .collect();
        assert_eq!(round1_pages.len(), 2, "{attempts:?}");
        for (_, round, accepted, codes) in &round1_pages {
            assert_eq!(*round, 1);
            assert!(
                *accepted,
                "other blocks in the same payload are accepted; one block's invalid range does not reject the page"
            );
            assert_eq!(codes, &vec![ProblemCode::RangeInvalid]);
        }
        assert!(
            attempts
                .iter()
                .any(|(id, round, ..)| id.starts_with("sr2-") && *round == 2)
        );
        assert!(
            !attempts.iter().any(|(id, ..)| id.starts_with("sr3-")),
            "converges in two rounds: {attempts:?}"
        );
        // Round two carries only the per-block targeted feedback for the blocks whose ranges were invalid in round one.
        let round2_reasons: Vec<&str> = llm
            .calls
            .iter()
            .filter(|(kind, _, reason)| kind == "segment-repair" && reason.is_some())
            .filter_map(|(_, _, reason)| reason.as_deref())
            .collect();
        assert!(
            !round2_reasons.is_empty(),
            "{:?}",
            llm.calls.iter().map(|c| &c.2).collect::<Vec<_>>()
        );
        assert!(
            round2_reasons
                .iter()
                .all(|reason| reason.contains("range-invalid")
                    && reason.contains("第 11 行没有被任何区间覆盖")),
            "{round2_reasons:?}"
        );
        assert!(
            !round2_reasons
                .iter()
                .any(|reason| reason.contains("上一轮拆分后仍有")),
            "already accepted blocks do not enter round two: {round2_reasons:?}"
        );
        // The round-one request carries no retry_reason.
        assert!(
            llm.calls
                .iter()
                .filter(|(kind, _, _)| kind == "segment-repair")
                .take(2)
                .all(|(_, _, reason)| reason.is_none())
        );
    }

    /// Overflow tolerance: if the sub-groups cut from the model's boundaries exceed the limit by less than 15%, the engine re-cuts immediately by pause level without spending a second round. If the overflow exceeds 15%, it carries “still N words” feedback into round two so the model splits by meaning.
    #[test]
    fn slightly_oversized_subgroups_are_capped_but_big_ones_go_another_round() {
        let mut doc = doc(&long_text(1000));
        let main = || {
            rewrite_core(|core| {
                let mut out = String::new();
                for (index, chunk) in core.split_inclusive('.').enumerate() {
                    if index > 0 {
                        out.push_str(if index % 50 == 0 { "\n\n" } else { " " });
                    }
                    out.push_str(chunk.trim_start());
                }
                out
            })
        };
        // Two blocks of 50 sentences each. Block 1 returns 1-18 and 19-50 (180 and 320 words: 320 ≤ 345, so it is re-cut immediately into 300 + 20). Block 2 returns 1-10 and 11-50 (100 and 400 words: 400 > 345, so it goes to round two).
        let round1 = || -> PolishStep {
            Box::new(|_: &str| {
                Ok("<<<BLOCK 1>>>\n1-18\n19-50\n<<<BLOCK-END>>>\n<<<BLOCK 2>>>\n1-10\n11-50\n<<<BLOCK-END>>>\n".to_owned())
            })
        };
        let mut llm = PolishFileLlm::new(vec![main(), round1(), index_answer_every(20)]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec!["polish", "segment-repair", "segment-repair"]
        );
        // Round two sends only block 2's 400-word sub-group, with the default feedback “still N words.”
        assert!(
            llm.calls[2]
                .1
                .contains("<<<BLOCK 1 | 40 sentences | 400 words | at least 2 paragraphs>>>"),
            "{}",
            llm.calls[2].1
        );
        assert!(
            !llm.calls[2].1.contains("<<<BLOCK 2 "),
            "{}",
            llm.calls[2].1
        );
        assert!(
            llm.calls[2]
                .2
                .as_deref()
                .is_some_and(|reason| reason.contains("上一轮拆分后仍有 400 词")),
            "{:?}",
            llm.calls[2].2
        );
        assert_eq!(outcome.fallback_paragraphs, 0);
        assert_eq!(outcome.degenerate_paragraphs, 0);
        // Block 1: 180 / 300 / 20; block 2: 100 / 200 / 200 ⇒ 6 groups ⇒ 5 pins.
        assert_eq!(doc.para_breaks.len(), 5, "{:?}", doc.para_breaks);
        assert!(doc.stages.segment.is_some());
        doc.validate().unwrap();
    }

    /// Re-polish of an already segmented document: the restored blank lines have nowhere to go (`paraBreaks` is not rewritten), so no segment-repair wave is run and no degradation warning is raised. A single over-long paragraph is accepted in one round.
    #[test]
    fn re_polish_with_existing_segmentation_skips_paragraph_enforcement() {
        let mut doc = doc(&long_text(500));
        doc.stages.segment = Some("seg-fp".to_owned());
        let mut llm = PolishFileLlm::new(vec![echo()]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &file_options(),
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.calls.len(),
            1,
            "the re-polish path passes in one round, no targeted re-segmentation"
        );
        assert_eq!(outcome.repaired_paragraphs, 0);
        assert_eq!(outcome.degenerate_paragraphs, 0);
        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(doc.stages.segment.as_deref(), Some("seg-fp"));
        doc.validate().unwrap();
    }
    // ---- Page seams (seam) ----------------------------------------------------------

    /// A multi-page baseline of three pages, each segmented by [`segment_core`] (20 / 20 / 10 sentences). The page seams fall before the first paragraph of page 2 and page 3, and the two page seams are not adjacent (page 2 has 3 groups).
    fn three_page_doc() -> (TranscriptDoc, PolishOptions) {
        let doc = doc(&long_text(1500));
        let options = PolishOptions {
            worker_slots: Some(3),
            ..file_options()
        };
        (doc, options)
    }

    /// Page-seam judgment: the block is page k's last paragraph tail window (10 sentences, 100 words, the whole paragraph) plus page k+1's first paragraph head window (20 sentences, 200 words, the whole paragraph). The model returns 1-10 / 11-20 / 21-30 ⇒ ranges containing a seam line start at that line ⇒ both page seams are kept. Other boundaries inside the window are not adopted, since the window is truncated.
    #[test]
    fn seam_repair_keeps_seams_the_model_confirms() {
        let (mut doc, options) = three_page_doc();
        let mut llm = PolishFileLlm::new(vec![
            segmented_echo(),
            segmented_echo(),
            segmented_echo(),
            index_answer_every(10),
        ]);
        let mut ids = SeqIds::default();
        let mut pages: Vec<String> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |attempt| pages.push(attempt.page_id.to_owned()),
        )
        .unwrap();
        assert_eq!(pages, vec!["p001", "p002", "p003", "sm1-001"]);
        assert_eq!(
            llm.kinds(),
            vec!["polish", "polish", "polish", "seam-repair"]
        );
        assert_eq!(outcome.seam_kept_paragraphs, 2);
        assert_eq!(outcome.seam_merged_paragraphs, 0);
        assert_eq!(outcome.seam_signaled_paragraphs, 0);
        // Two blocks of 30 lines each, with the page seam before line 11.
        assert!(
            llm.calls[3]
                .1
                .contains("<<<BLOCK 1 | 30 sentences | 300 words | page seam before line 11>>>"),
            "{}",
            llm.calls[3].1
        );
        assert!(
            llm.calls[3]
                .1
                .contains("<<<BLOCK 2 | 30 sentences | 300 words | page seam before line 11>>>")
        );
        // 9 groups unchanged ⇒ 8 pins.
        assert_eq!(doc.para_breaks.len(), 8);
        assert!(doc.stages.segment.is_some());
        doc.validate().unwrap();
    }

    /// Page-seam judgment rejected in both rounds (the answer has no ranges at all) ⇒ the original paragraph pins are kept, exactly as if no judgment had been made. Round two's request carries the `[range-invalid]` targeted instruction.
    #[test]
    fn seam_repair_rejections_keep_the_forced_breaks() {
        let (mut doc, options) = three_page_doc();
        let garbage =
            || -> PolishStep { Box::new(|_: &str| Ok("I cannot decide this.".to_owned())) };
        let mut llm = PolishFileLlm::new(vec![
            segmented_echo(),
            segmented_echo(),
            segmented_echo(),
            garbage(),
            garbage(),
        ]);
        let mut ids = SeqIds::default();
        let mut attempts: Vec<(String, u32, bool)> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |attempt| {
                attempts.push((
                    attempt.page_id.to_owned(),
                    attempt.attempt,
                    attempt.accepted,
                ))
            },
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec!["polish", "polish", "polish", "seam-repair", "seam-repair"]
        );
        assert_eq!(
            &attempts[3..],
            &[
                ("sm1-001".to_owned(), 1, false),
                ("sm2-002".to_owned(), 2, false)
            ]
        );
        assert!(
            llm.calls[4]
                .2
                .as_deref()
                .is_some_and(|reason| reason.contains("range-invalid")),
            "{:?}",
            llm.calls[4].2
        );
        assert_eq!(outcome.seam_kept_paragraphs, 0);
        assert_eq!(outcome.seam_merged_paragraphs, 0);
        // 9 groups unchanged ⇒ 8 pins.
        assert_eq!(doc.para_breaks.len(), 8);
        doc.validate().unwrap();
    }

    /// Explicit page-seam signal: the next page starts its core region with a blank line ⇒ the paragraph pin is kept directly and does not enter seam-repair. A leading blank line on the first page does not count as a signal.
    #[test]
    fn leading_blank_line_signals_a_new_paragraph_and_skips_seam_repair() {
        let (mut doc, options) = three_page_doc();
        let signaled = || rewrite_core(|core| format!("\n{}", segment_core(core)));
        let mut llm = PolishFileLlm::new(vec![signaled(), signaled(), signaled()]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["polish", "polish", "polish"]);
        assert_eq!(outcome.seam_signaled_paragraphs, 2);
        assert_eq!(outcome.seam_kept_paragraphs, 0);
        assert_eq!(outcome.seam_merged_paragraphs, 0);
        assert_eq!(doc.para_breaks.len(), 8);
        doc.validate().unwrap();
    }

    /// Page 2 entirely collapsed into one paragraph (50 sentences, 500 words). Each of the two page seams opens its own window: block 1 = page 1's last paragraph whole (10 sentences) + page 2's head window (25 sentences); block 2 = page 2's tail window (25 sentences) + page 3's first paragraph whole (20 sentences). The whole 500 words of the page are not stuffed into one block. The model returns a single range for both blocks ⇒ both page seams are merged (80 sentences, 800 words, one paragraph), and then segment-repair splits it by meaning (seam-repair does no capacity re-cutting).
    #[test]
    fn seams_around_a_one_paragraph_page_use_windows_not_the_whole_page() {
        let (mut doc, options) = three_page_doc();
        let mut llm = PolishFileLlm::new(vec![
            segmented_echo(),
            echo(),
            segmented_echo(),
            index_answer_every(1000),
            index_answer_every(20),
        ]);
        let mut ids = SeqIds::default();
        let mut pages: Vec<String> = Vec::new();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |attempt| pages.push(attempt.page_id.to_owned()),
        )
        .unwrap();
        assert_eq!(pages, vec!["p001", "p002", "p003", "sm1-001", "sr1-001"]);
        let seam_payload = &llm.calls[3].1;
        assert!(
            seam_payload
                .contains("<<<BLOCK 1 | 35 sentences | 350 words | page seam before line 11>>>"),
            "{seam_payload}"
        );
        assert!(
            seam_payload
                .contains("<<<BLOCK 2 | 45 sentences | 450 words | page seam before line 26>>>"),
            "{seam_payload}"
        );
        assert_eq!(outcome.seam_merged_paragraphs, 2);
        assert_eq!(outcome.seam_kept_paragraphs, 0);
        // The merged block = 10 + 50 + 20 = 80 sentences, 800 words; segment-repair cuts every 20 sentences ⇒ 4 groups; plus 2 remaining groups on page 1 and 2 remaining on page 3 ⇒ 8 groups ⇒ 7 pins.
        assert!(
            llm.calls[4]
                .1
                .contains("<<<BLOCK 1 | 80 sentences | 800 words | at least 3 paragraphs>>>"),
            "{}",
            llm.calls[4].1
        );
        assert_eq!(outcome.repaired_paragraphs, 1);
        assert_eq!(doc.para_breaks.len(), 7);
        assert_eq!(outcome.degenerate_paragraphs, 0);
        assert_eq!(outcome.fallback_paragraphs, 0);
        doc.validate().unwrap();
    }

    /// An adjacent page-seam chain block (driving the wave directly): groups A (20 sentences), B (3 sentences), C (20 sentences, 200 words), D (20 sentences), E (5 sentences), with page seams before C and D. C does not exceed the window ⇒ the head window covers all of C, and the next page seam follows immediately ⇒ they chain into one block (B's tail, C whole, and D's head window), with the block header giving the positions of both page seams. The model returns a single range ⇒ both page seams are merged: A | B+C+D | E.
    #[test]
    fn adjacent_seams_chain_when_the_middle_group_fits_the_window() {
        let doc = doc(&long_text(680));
        let sentence = |index: usize| MappedSentence {
            start: index * 10,
            end: index * 10 + 9,
            corrected: String::new(),
            fallback: false,
        };
        let group = |range: std::ops::Range<usize>| range.map(sentence).collect::<Vec<_>>();
        let mut committed = vec![
            group(0..20),
            group(20..23),
            group(23..43),
            group(43..63),
            group(63..68),
        ];
        let mut llm = PolishFileLlm::new(vec![index_answer_every(1000)]);
        let mut outcome = PolishOutcome::default();
        seam_repair_wave(
            &doc.words,
            &mut committed,
            vec![2, 3],
            &mut llm,
            &mut outcome,
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(llm.kinds(), vec!["seam-repair"]);
        let payload = &llm.calls[0].1;
        assert!(
            payload.contains(
                "<<<BLOCK 1 | 43 sentences | 430 words | page seams before lines 4, 24>>>"
            ),
            "{payload}"
        );
        assert_eq!(payload.matches("<<<BLOCK-END>>>").count(), 1, "{payload}");
        assert_eq!(outcome.seam_merged_paragraphs, 2);
        assert_eq!(outcome.seam_kept_paragraphs, 0);
        let sizes: Vec<usize> = committed.iter().map(Vec::len).collect();
        assert_eq!(sizes, vec![20, 43, 5]);
        assert_eq!(committed[1][0].start, 200);
    }

    /// The page-seam block answer places the true start of the seam paragraph a few sentences before the page seam: a range containing the seam line that starts from inside the window ⇒ the seam paragraph's start is removed, and the range's start is filled in as a paragraph start. Page k's last paragraph is split into two, and the latter part joins page k+1's first paragraph.
    #[test]
    fn seam_repair_moves_the_paragraph_start_when_the_model_says_so() {
        let (mut doc, options) = three_page_doc();
        // A block of 30 lines with the page seam before line 11: the answer 1-7 / 8-30 ⇒ the page seam is merged, and line 8 becomes a paragraph start.
        let answer = || -> PolishStep {
            Box::new(|input: &str| {
                let total = input.matches("<<<BLOCK-END>>>").count();
                let mut out = String::new();
                for index in 1..=total {
                    out.push_str(&format!(
                        "<<<BLOCK {index}>>>\n1-7\n8-30\n<<<BLOCK-END>>>\n"
                    ));
                }
                Ok(out)
            })
        };
        let mut llm = PolishFileLlm::new(vec![
            segmented_echo(),
            segmented_echo(),
            segmented_echo(),
            answer(),
        ]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec!["polish", "polish", "polish", "seam-repair"]
        );
        assert_eq!(outcome.seam_merged_paragraphs, 2);
        assert_eq!(outcome.seam_kept_paragraphs, 0);
        // 9 groups: each page seam loses one paragraph start and gains one ⇒ still 9 groups, 8 pins. Page 2's first paragraph pin moves from the start of sentence 50 (word 500) to the start of sentence 47 (word 470).
        assert_eq!(doc.para_breaks.len(), 8, "{:?}", doc.para_breaks);
        assert!(!doc.para_breaks.contains_key(&doc.words[500].id));
        assert!(doc.para_breaks.contains_key(&doc.words[470].id));
        assert!(!doc.para_breaks.contains_key(&doc.words[1000].id));
        assert!(doc.para_breaks.contains_key(&doc.words[970].id));
        doc.validate().unwrap();
    }

    /// A hard-cut page seam (the page boundary falls mid-sentence, with no break point in the window or the overflow zone): the two adjacent paragraphs are unconditionally merged by the engine and do not enter seam-repair. With 2 slots ⇒ 2 pages of 400 words each; the page boundary falls mid-second-sentence, with no break in the window or the overflow zone.
    #[test]
    fn hard_cut_seams_are_merged_without_asking_the_model() {
        // Single-letter words (to stay clear of the 1200 source-character cap for one sentence); sentence ends fall after words 200, 470 and 740; page 1 (400 words): the window [320, 400) and the overflow zone [400, 460) contain no break point.
        let mut text = String::new();
        for index in 0..800 {
            if index > 0 {
                text.push(' ');
            }
            text.push((b'a' + (index % 26) as u8) as char);
            if index == 199 || index == 469 || index == 739 {
                text.push('.');
            }
        }
        let mut doc = doc(&text);
        let options = PolishOptions {
            worker_slots: Some(2),
            ..file_options()
        };
        let plans = plan_polish_file_pages(&doc.words, &[0..doc.words.len()], Some(2));
        assert_eq!(plans.len(), 2, "{plans:?}");
        assert!(plans[0].hard_cut_end, "{plans:?}");
        let mut llm = PolishFileLlm::new(vec![echo(), echo(), segment_repair_answer(1)]);
        let mut ids = SeqIds::default();
        let outcome = run_polish_file_contract(
            &mut doc,
            &mut llm,
            &options,
            &mut ids,
            &mut |_| {},
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            llm.kinds(),
            vec!["polish", "polish", "segment-repair"],
            "hard-cut page seams do not enter seam-repair"
        );
        assert_eq!(outcome.hard_cut_seams_merged, 1);
        assert_eq!(
            outcome.seam_kept_paragraphs + outcome.seam_merged_paragraphs,
            0
        );
        // The two pages merged into one group are split sentence by sentence by segment-repair (page 1's fragment and page 2's fragment each become a sentence).
        assert_eq!(outcome.repaired_paragraphs, 1);
        assert_eq!(doc.para_breaks.len(), outcome.sentences.len() - 1);
        doc.validate().unwrap();
    }

    /// A Thai line: the nine lines run in the sandbox (eight acceptance-fixture sentences plus one line with two phrases).
    const THAI_ROWS: [&str; 9] = [
        "ลลิตาไม่ได้ยกเลิกการประชุมแต่เลื่อนไปเป็นวันพฤหัสบดีเวลา14:30น.",
        "ถ้าอุณหภูมิลดลงต่ำกว่า5องศาให้ปิดหน้าต่างก่อนเปิดเครื่องทำความร้อน",
        "นนท์จ่ายเงิน120บาทสำหรับตั๋วสามใบแต่ราคานี้ไม่รวมอาหารเย็น",
        "หนังสือที่มาลีให้ก้องยืมเมื่อวานเป็นของพี่สาวของมาลี",
        "รหัสF-07ปรากฏข้างคำว่า“ยืนยันแล้ว”แต่ยังไม่ได้ส่งพัสดุ",
        "แม้พลอยจะออกเดินทางก่อนนัทแต่เธอก็มาถึงหลังเขาสิบนาที",
        "อย่าส่งไฟล์ให้นิดาจนกว่าผู้จัดการจะอนุมัติฉบับที่สอง",
        "เราซื้อข้าวสาร2.5กิโลกรัมและหลังอาหารเย็นยังเหลืออยู่ครึ่งหนึ่ง",
        "วันนี้อากาศดีมาก เราจะไปเที่ยวทะเลกัน",
    ];

    /// A newly created Thai document (cut word by word, with “sticks to previous” markers inside phrases), and an old document of the same few lines (one word per phrase).
    fn thai_docs() -> (TranscriptDoc, Vec<Word>) {
        let rows: Vec<RowIn> = THAI_ROWS
            .iter()
            .enumerate()
            .map(|(index, text)| RowIn::new(index as f64 * 6.0, index as f64 * 6.0 + 5.0, *text))
            .collect();
        let fresh = build_doc(
            &rows,
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 60.0,
                sample_rate: None,
            },
            "th",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        );
        let mut legacy = Vec::new();
        for (row, text) in THAI_ROWS.iter().enumerate() {
            for (column, atom) in crate::atomize::atomize(text).into_iter().enumerate() {
                let mut word = fresh.words[0].clone();
                word.id = format!("g{}.{column}", row + 1);
                word.text = atom;
                word.glue = false;
                legacy.push(word);
            }
        }
        (fresh, legacy)
    }

    /// The answer actually returned in the sandbox: the model added spaces on either side of the digits and quotation marks, and two lines merged into one sentence.
    fn thai_answer() -> Vec<Vec<String>> {
        [
            "ลลิตาไม่ได้ยกเลิกการประชุมแต่เลื่อนไปเป็นวันพฤหัสบดีเวลา 14:30 น. ถ้าอุณหภูมิลดลงต่ำกว่า 5 องศาให้ปิดหน้าต่างก่อนเปิดเครื่องทำความร้อน",
            "นนท์จ่ายเงิน 120 บาทสำหรับตั๋วสามใบแต่ราคานี้ไม่รวมอาหารเย็น หนังสือที่มาลีให้ก้องยืมเมื่อวานเป็นของพี่สาวของมาลี",
            "รหัส F-07 ปรากฏข้างคำว่า “ยืนยันแล้ว” แต่ยังไม่ได้ส่งพัสดุ แม้พลอยจะออกเดินทางก่อนนัทแต่เธอก็มาถึงหลังเขาสิบนาที",
            "อย่าส่งไฟล์ให้นิดาจนกว่าผู้จัดการจะอนุมัติฉบับที่สอง เราซื้อข้าวสาร 2.5 กิโลกรัมและหลังอาหารเย็นยังเหลืออยู่ครึ่งหนึ่ง",
            "วันนี้อากาศดีมาก เราจะไปเที่ยวทะเลกัน",
        ]
        .iter()
        .map(|line| vec![(*line).to_owned()])
        .collect()
    }

    /// Thai built word by word: an answer split by whitespace reaches only phrases, while the document is individual words. The two sides are therefore cut to grapheme clusters before comparison, so they match. Sentence boundaries still fall on word boundaries (here, at the end of the line).
    #[test]
    fn a_thai_answer_maps_onto_a_word_split_transcript() {
        let (fresh, _) = thai_docs();
        let words = &fresh.words;
        let row_last: Vec<usize> = (1..=THAI_ROWS.len())
            .map(|row| {
                words
                    .iter()
                    .rposition(|word| word.id.starts_with(&format!("g{row}.")))
                    .unwrap()
            })
            .collect();
        let mapped = map_corrected_page(words, 0..words.len(), &thai_answer()).unwrap();
        let ends: Vec<usize> = mapped
            .iter()
            .flatten()
            .map(|sentence| sentence.end)
            .collect();
        assert_eq!(
            ends,
            [
                row_last[1],
                row_last[3],
                row_last[5],
                row_last[7],
                row_last[8]
            ]
        );
    }

    /// An existing Thai document (one word per phrase) keeps its granularity: a phrase to which the model added spaces fails to match as a whole, so this page is still judged as drift. This was so before this round and has not been fixed (see the tokenization design doc §8).
    #[test]
    fn a_legacy_thai_transcript_keeps_phrase_level_comparison() {
        let (_, legacy) = thai_docs();
        assert!(!needs_fine_comparison(&legacy));
        let error = map_corrected_page(&legacy, 0..legacy.len(), &thai_answer()).unwrap_err();
        assert!(error.to_string().contains("drifted"), "{error}");
    }

    /// The 30-word cap fallback does not cut inside a Thai phrase: it is deferred to the end of the phrase (here, the end of the line).
    #[test]
    fn fallback_sentences_do_not_cut_inside_a_thai_phrase() {
        let (fresh, _) = thai_docs();
        let words = &fresh.words;
        let sentences = fallback_sentences(words, 0..words.len());
        assert!(sentences.len() > 1);
        for sentence in &sentences {
            assert!(
                !words.get(sentence.end + 1).is_some_and(|next| next.glue),
                "cut before glued word {:?}",
                words[sentence.end + 1].text
            );
        }
    }
}
