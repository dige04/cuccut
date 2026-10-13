//! Segmentation engine (parity with voice-ink `SegmentEngine` segmentOnly path, M27/M51).
//!
//! LLM contract: keep the source text verbatim, only add or fix punctuation, then split into 1–4 sentence paragraphs. "Only add punctuation" is not a plea but a decidable proposition: the text is kept only when it strictly equals the source word range after `normalize_chars`; otherwise the text is downgraded to the original words and the boundaries are used as-is. **Boundaries tolerate drift, text never lies.**
//!
//! Five-tier mapping ladder (tiers 1–2 are tried in order within each attempt; tiers 4–5 are escalations):
//! - tier 1 exact: page-level normalized characters equal, O(n) character offset mapping
//! - tier 2 diff: atom-LCS (the model fixed a typo in passing), match ratio ≥ 0.75
//! - tier 3 align: **deliberately omitted** (see below)
//! - tier 4 json: one index-contract call after 3 failed attempts (returns only range indices)
//! - tier 5 split: deterministic fallback (speaker, pause, sentence end, hard break), never fails
//!
//! Deliberate deviations from voice-ink:
//! - tier 3 (`SubAlign.recoverWordRange` per-segment cursor scan) is omitted. It only takes effect in the narrow gap where exact and diff both fail but the text still roughly matches, and there the text is always discarded, keeping only the boundaries. The tier 4 index contract covers the same case. A failed attempt escalates directly to tier 4/5.
//! - The width review after line breaking (the repunct second call) is not in this engine; the caller runs it separately if needed.
//! - The 1s delay between pages runs through an injected `sleep` (core has no clock).

use serde::{Deserialize, Serialize};

use crate::atomize::{
    atom_key, atomize_like, comparison_atoms, join_word_texts, needs_fine_comparison,
    normalize_chars, sentence_end, visual_width, word_sep,
};
use crate::doc::{TranscriptDoc, Word};
use crate::engines::markers::{boundary_marker_suffix, marked_text, sanitize_corrected};
use crate::fingerprint::{fingerprint, id_fingerprint};
use crate::lcs::{AtomInterner, LCS_CELL_CAP, lcs_matches};
use crate::llm::{LlmError, LlmJson, LlmRequest, MAX_RETRIES, decode, should_retry, with_retry};
use crate::paging::{budgets, paginate_word_ranges};
use crate::rebind::{IdSource, rebind_corrected};
use crate::timing::normalize_doc_words;

// Constants (parity with SegmentEngine).
const TEMPERATURE: f32 = 0.2;
const PAGE_DELAY_SECONDS: f64 = 1.0;
/// tier-2 acceptance threshold: matches / max(srcKeys, outKeys).
const MIN_DIFF_MATCH_RATIO: f64 = 0.75;
/// carry-over snowball guard: a pending segment longer than this is forced to commit and split.
const MAX_CARRY_CHARS: usize = 600;
/// M51: hard cap on segment length after commit; over-long segments are greedily re-split (the text of re-split pieces is discarded).
const MAX_PARA_CHARS: usize = 600;
/// tier-5 rule: pauses deliberately above 0.6s among Cue pauses (paragraph scale).
const FALLBACK_PAUSE_SEC: f64 = 1.2;
const FALLBACK_SOFT_CHARS: usize = 200;
const FALLBACK_HARD_CHARS: usize = 400;
/// tier-4 continuity self-heal: gaps of ≤10 words are snapped; a larger gap is a failure.
const MAX_TAIL_GAP: i64 = 10;
/// Sentence-end and pause boundaries for force-commit use the Cue-scale pause (Rules.pauseSec).
const RULES_PAUSE_SEC: f64 = 0.6;

#[derive(Debug, Clone)]
pub struct SegmentOptions {
    /// BCP-47 source language, included in the prompt.
    pub language: String,
    pub page_budget: usize,
    pub instructions: Option<String>,
    /// Balanced cue layout target used when this stage creates the first
    /// durable line-break overlay.
    pub cue_max_chars: usize,
}

impl Default for SegmentOptions {
    fn default() -> Self {
        Self {
            language: "en".to_owned(),
            page_budget: budgets::SEGMENT,
            instructions: None,
            cue_max_chars: 42,
        }
    }
}

/// Persisted segment record (id plus time anchoring, robust to later edits).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentRecord {
    pub first_word_id: String,
    pub last_word_id: String,
    pub t0: f64,
    pub t1: f64,
    pub text: String,
    /// "exact" | "diff" | "json" | "split"
    pub source: String,
}

#[derive(Debug)]
pub struct SegmentOutcome {
    pub records: Vec<SegmentRecord>,
    /// Number of pages that reach the tier-5 deterministic fallback.
    pub fallback_pages: u32,
    /// Exit layout check: Cue count, longest width, and the count of lines over the single-line budget, after layout is applied.
    /// `over_width > 0` means the pipeline itself produced an over-wide line, which greedy layout never would.
    pub cue_layout: crate::layout::CueLayoutStats,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Source {
    Exact,
    Diff,
    Json,
    Split,
}

impl Source {
    fn as_str(self) -> &'static str {
        match self {
            Self::Exact => "exact",
            Self::Diff => "diff",
            Self::Json => "json",
            Self::Split => "split",
        }
    }
}

/// Runtime segment (word indices, inclusive range; volatile. The persisted form is [`SegmentRecord`]).
#[derive(Debug, Clone)]
struct SegPara {
    start: usize,
    end: usize,
    text: String,
    source: Source,
}

// ---------- prompts (verbatim parity with SegmentPrompts.swift) ----------

fn system_prompt(language: &str, instructions: Option<&str>) -> String {
    let mut prompt = format!(
        r#"You are an expert at structuring raw ASR (speech recognition) transcripts. The downstream subtitle splitter cuts cues at YOUR punctuation, so accurate punctuation matters more than anything else in this task.

The user gives you one continuous transcript chunk. It may have NO punctuation. A word may be followed by PAUSE marks — "⏸" a short pause, "⏸⏸" a medium pause, "⏸⏸⏸" a long pause; the MORE marks, the stronger the hint that a boundary is natural there (still only a hint, never a command to split). A "⏹" marker means the SPEAKER changes there — a paragraph must NEVER continue across it. Markers are metadata: never copy them into your output.

Work through these steps in order:
Step 1 — Read the whole chunk and understand its meaning before writing anything.
Step 2 — Punctuate. Reproduce the words VERBATIM (do not rephrase, correct, add, remove, reorder, or translate any word — same words, same order, same language) and add natural punctuation:
  • Put a comma (，/,) at EVERY clause boundary — clauses are the primary place the subtitle breaks, so never omit them.
  • End each sentence with 。/./?/! (。，？！ for Chinese; . , ? ! for English).
  • A period is NOT a sentence end when it belongs to an abbreviation, decimal, version, or file name — "agents.md", "2.14", "e.g.", "U.S." keep their internal dots intact and do not terminate a sentence.
  • Follow the source script's spacing: never insert spaces between Chinese/Japanese/Korean characters.
Step 3 — Split the punctuated text into paragraphs: one topic or beat per paragraph, typically 1–4 sentences. Start a new paragraph at topic shifts, and ALWAYS at speaker changes (⏹). Treat pause marks (⏸ / ⏸⏸ / ⏸⏸⏸) as a soft reference whose weight grows with the count — do NOT start a new paragraph solely because of a pause; a pause often falls mid-sentence.

Respond with a single JSON object: {{"paragraphs": ["...", "...", ...]}} — an array of paragraph strings in order, together covering the entire input exactly once.
The source language is "{language}"."#
    );
    if let Some(instructions) = instructions.filter(|text| !text.is_empty()) {
        prompt.push_str(&format!(
            "\n\nExtra instructions from the user: {instructions}"
        ));
    }
    prompt
}

fn index_system_prompt(language: &str) -> String {
    format!(
        r#"You are an expert at structuring raw ASR (speech recognition) transcripts.

The user gives you a JSON object mapping word indexes to raw transcribed tokens, in speaking order. Some tokens are followed by pause marks — "⏸" short, "⏸⏸" medium, "⏸⏸⏸" long (a stronger boundary hint) — or a "⏹" marker (the speaker changes after that word — a paragraph must NEVER span across it).

Split the stream into coherent paragraphs by topic (typically 1–4 sentences each), using pauses as boundary hints.

Respond with a single JSON object: {{"paragraphs": [{{"startWordIndex": number, "endWordIndex": number}}]}}
- The indexes are INCLUSIVE and refer to the input word indexes.
- Ranges must be sequential, non-overlapping, and together cover EVERY input word index exactly once.
The source language is "{language}"."#
    )
}

// ---------- normalized character mapping utilities ----------

/// Normalized character stream of a word range, plus the word index each character belongs to (parity with `SubAlign.buildWordCharMap`).
fn span_norm_chars(span: &[Word]) -> (Vec<char>, Vec<usize>) {
    let mut chars = Vec::new();
    let mut char_to_word = Vec::new();
    for (word_index, word) in span.iter().enumerate() {
        for ch in normalize_chars(&word.text).chars() {
            chars.push(ch);
            char_to_word.push(word_index);
        }
    }
    (chars, char_to_word)
}

/// Normalized character stream of the text, plus each character's original char offset (parity with the origIndex of `SubAlign.normalizeChars`: multi-character lowercase expansions share the same original offset).
fn normalize_with_orig(text: &str) -> (Vec<char>, Vec<usize>) {
    let mut chars = Vec::new();
    let mut orig = Vec::new();
    for (offset, ch) in text.chars().enumerate() {
        for low in normalize_chars(&ch.to_string()).chars() {
            chars.push(low);
            orig.push(offset);
        }
    }
    (chars, orig)
}

/// Text gate: the decidable form of "kept verbatim, modulo punctuation, whitespace and case".
fn text_matches_range(text: &str, span: &[Word]) -> bool {
    let norm: Vec<char> = normalize_chars(text).chars().collect();
    norm == span_norm_chars(span).0
}

// ---------- tier 1: exact normalized mapping ----------

fn map_paragraphs_exact(paras: &[String], span: &[Word], base: usize) -> Option<Vec<SegPara>> {
    let (chars, char_to_word) = span_norm_chars(span);
    let out_norm: Vec<Vec<char>> = paras
        .iter()
        .map(|p| normalize_chars(p).chars().collect())
        .collect();
    let flat: Vec<char> = out_norm.iter().flatten().copied().collect();
    if chars.is_empty() || flat != chars {
        return None;
    }

    let mut out: Vec<SegPara> = Vec::new();
    let mut texts: Vec<&str> = Vec::new();
    let mut offset = 0_usize;
    let mut prev_end: isize = -1;
    for (k, pn) in out_norm.iter().enumerate() {
        if pn.is_empty() {
            continue; // Pure-punctuation "segment": no range, no text
        }
        let start_char = offset;
        offset += pn.len();
        let end_char = offset - 1;
        // When a boundary falls in the middle of a word, snap it forward to the word end. A segment boundary never splits a word. Ranges consumed entirely by the snap are skipped. Their neighbor's text gate then fails, and its text is downgraded to the original words.
        let start = (char_to_word[start_char] as isize).max(prev_end + 1);
        let end = (char_to_word[end_char] as isize).max(start - 1);
        if end < start {
            continue;
        }
        out.push(SegPara {
            start: base + start as usize,
            end: base + end as usize,
            text: String::new(),
            source: Source::Exact,
        });
        texts.push(&paras[k]);
        prev_end = end;
    }
    if out.is_empty() {
        return None;
    }
    let last = out.len() - 1;
    out[last].end = base + span.len() - 1;

    // Text gate (per segment): text is kept only when the slice matches.
    for (index, para) in out.iter_mut().enumerate() {
        let a = para.start - base;
        let b = para.end - base;
        if text_matches_range(texts[index], &span[a..=b]) {
            para.text = texts[index].to_owned();
        }
    }
    Some(out)
}

// ---------- tier 2: atom-LCS boundary recovery ----------

fn map_paragraphs_by_diff(paras: &[String], span: &[Word], base: usize) -> Option<Vec<SegPara>> {
    // Both sides go through the same atomizer. A shared algorithm is what makes the diff meaningful. The comparison key uses the finest granularity (Korean, per syllable): the model adding one space or changing one particle should not break the match of a whole eojeol.
    let mut intern = AtomInterner::default();
    let mut src_keys: Vec<u32> = Vec::new();
    let mut src_word: Vec<usize> = Vec::new();
    // For Thai and similar scripts whose ranges are built per word, both sides are cut down to grapheme clusters (see comparison_atoms), and segment boundaries are still mapped back to word indices.
    let fine = needs_fine_comparison(span);
    for (wi, word) in span.iter().enumerate() {
        for atom in comparison_atoms(&word.text, fine) {
            let Some(key) = atom_key(&atom) else { continue };
            src_keys.push(intern.intern(&key));
            src_word.push(wi);
        }
    }
    let mut out_keys: Vec<u32> = Vec::new();
    let mut out_para: Vec<usize> = Vec::new();
    for (pi, para) in paras.iter().enumerate() {
        for atom in comparison_atoms(para, fine) {
            let Some(key) = atom_key(&atom) else { continue };
            out_keys.push(intern.intern(&key));
            out_para.push(pi);
        }
    }
    if src_keys.is_empty() || out_keys.is_empty() {
        return None;
    }
    let matches = lcs_matches(&src_keys, &out_keys, LCS_CELL_CAP)?;
    let ratio = matches.len() as f64 / src_keys.len().max(out_keys.len()) as f64;
    if ratio < MIN_DIFF_MATCH_RATIO {
        return None;
    }

    // The boundary after segment p is the last source word matched by p. Frontier words with no match are merged into the previous segment.
    let mut last_word = vec![-1_isize; paras.len()];
    for (si, oi) in matches {
        let p = out_para[oi];
        last_word[p] = last_word[p].max(src_word[si] as isize);
    }
    let mut out: Vec<SegPara> = Vec::new();
    let mut texts: Vec<&str> = Vec::new();
    let mut start = 0_isize;
    for (pi, para) in paras.iter().enumerate() {
        if start >= span.len() as isize {
            break;
        }
        let is_last = out.len() == paras.len() - 1 || pi == paras.len() - 1;
        let mut end = if is_last {
            span.len() as isize - 1
        } else {
            last_word[pi]
        };
        if end < start {
            continue; // No match: merge forward
        }
        end = end.min(span.len() as isize - 1);
        out.push(SegPara {
            start: base + start as usize,
            end: base + end as usize,
            text: String::new(),
            source: Source::Diff,
        });
        texts.push(para);
        start = end + 1;
    }
    if out.is_empty() {
        return None;
    }
    let last = out.len() - 1;
    out[last].end = base + span.len() - 1;

    for (index, para) in out.iter_mut().enumerate() {
        let a = para.start - base;
        let b = para.end - base;
        if text_matches_range(texts[index], &span[a..=b]) {
            para.text = texts[index].to_owned();
        }
    }
    Some(out)
}

// tier 3 (align, the SubAlign.recoverWordRange cursor scan) is deliberately omitted. It only covers the narrow gap where exact and diff both fail but the text roughly matches, and there the text is always discarded. The tier 4 index contract covers the same case, so a failed attempt escalates directly to tier 4/5.

// ---------- one attempt: LLM call + tier 1–2 ----------

#[derive(Debug, Deserialize)]
struct PageResponse {
    #[serde(default)]
    paragraphs: Vec<String>,
}

fn segment_page(
    range: std::ops::Range<usize>,
    words: &[Word],
    system: &str,
    llm: &mut dyn LlmJson,
    attempt: u32,
    retry_reason: Option<String>,
) -> Result<Vec<SegPara>, LlmError> {
    let raw = llm.complete(&LlmRequest {
        kind: "segment",
        system: system.to_owned(),
        user: marked_text(&words[range.clone()]),
        temperature: TEMPERATURE,
        attempt,
        retry_reason,
    })?;
    let response: PageResponse = decode(&raw)?;
    // Sanitize on receipt: strip echoed markers and collapse the CJK spaces the model inserted.
    let cleaned: Vec<String> = response
        .paragraphs
        .iter()
        .map(|p| sanitize_corrected(p))
        .filter(|p| !p.is_empty())
        .collect();
    if cleaned.is_empty() {
        return Err(LlmError::Malformed("LLM returned no paragraphs".to_owned()));
    }

    let span = &words[range.clone()];
    let base = range.start;
    map_paragraphs_exact(&cleaned, span, base)
        .or_else(|| map_paragraphs_by_diff(&cleaned, span, base))
        .ok_or_else(|| {
            LlmError::Malformed(
                "Paragraph mapping failed — response text does not align with the word stream"
                    .to_owned(),
            )
        })
}

// ---------- tier 4: index contract (returns ranges only; punctuation is sacrificed) ----------

#[derive(Debug, Deserialize)]
struct RangesResponse {
    #[serde(default)]
    paragraphs: Vec<RangeRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RangeRow {
    #[serde(default)]
    start_word_index: serde_json::Value,
    #[serde(default)]
    end_word_index: serde_json::Value,
}

/// Lenient numeric field decoding: accepts `12`, `12.0` and `"12"`.
fn lenient_index(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::Number(number) => number
            .as_i64()
            .or_else(|| number.as_f64().map(|f| f as i64)),
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            trimmed
                .parse::<i64>()
                .ok()
                .or_else(|| trimmed.parse::<f64>().ok().map(|f| f as i64))
        }
        _ => None,
    }
}

/// tier 4 payload: `{"words":{"<idx>":"<marked word>"}}`. Keys are assembled by hand in ascending numeric order, because the prompt says "in speaking order" and map iteration order cannot be relied on.
fn index_payload(range: &std::ops::Range<usize>, words: &[Word]) -> String {
    let mut entries: Vec<String> = Vec::with_capacity(range.len());
    for index in range.clone() {
        let mut value = words[index].text.clone();
        if index + 1 < words.len() {
            value.push_str(&boundary_marker_suffix(&words[index], &words[index + 1]));
        }
        entries.push(format!(
            "{}:{}",
            serde_json::to_string(&index.to_string()).expect("string to JSON"),
            serde_json::to_string(&value).expect("string to JSON"),
        ));
    }
    format!("{{\"words\":{{{}}}}}", entries.join(","))
}

fn segment_page_by_indexes(
    range: std::ops::Range<usize>,
    words: &[Word],
    language: &str,
    llm: &mut dyn LlmJson,
    retry_reason: Option<String>,
) -> Result<Vec<SegPara>, LlmError> {
    let raw = llm.complete(&LlmRequest {
        kind: "segment-index",
        system: index_system_prompt(language),
        user: index_payload(&range, words),
        temperature: TEMPERATURE,
        attempt: 1,
        retry_reason,
    })?;
    let response: RangesResponse = decode(&raw)?;

    // Clamp and continuity self-heal: gaps of ≤10 words are snapped; a larger gap is a failure.
    let lo = range.start as i64;
    let hi = range.end as i64 - 1;
    let mut out: Vec<SegPara> = Vec::new();
    let mut expected = lo;
    for row in &response.paragraphs {
        let raw_start = lenient_index(&row.start_word_index).ok_or_else(|| {
            LlmError::Malformed("LLM returned invalid paragraph range".to_owned())
        })?;
        let raw_end = lenient_index(&row.end_word_index).ok_or_else(|| {
            LlmError::Malformed("LLM returned invalid paragraph range".to_owned())
        })?;
        if raw_start > raw_end {
            return Err(LlmError::Malformed(
                "LLM returned invalid paragraph range".to_owned(),
            ));
        }
        let end = raw_end.min(hi);
        let mut start = raw_start.max(expected);
        if start > end {
            continue;
        }
        if start > expected {
            if start - expected > MAX_TAIL_GAP {
                return Err(LlmError::Malformed(format!(
                    "LLM left a gap of {} words",
                    start - expected
                )));
            }
            start = expected;
        }
        out.push(SegPara {
            start: start as usize,
            end: end as usize,
            text: String::new(),
            source: Source::Json,
        });
        expected = end + 1;
    }
    if out.is_empty() {
        return Err(LlmError::Malformed(
            "LLM returned no valid paragraph ranges".to_owned(),
        ));
    }
    if expected <= hi {
        if hi - expected + 1 > MAX_TAIL_GAP {
            return Err(LlmError::Malformed(format!(
                "LLM left {} words unassigned",
                hi - expected + 1
            )));
        }
        let last = out.len() - 1;
        out[last].end = hi as usize;
    }
    Ok(out)
}

// ---------- tier 5: deterministic fallback (never fails) ----------

fn fallback_segment(range: &std::ops::Range<usize>, words: &[Word]) -> Vec<SegPara> {
    let mut out: Vec<SegPara> = Vec::new();
    let mut start = range.start;
    let mut chars = 0_usize;
    for index in range.clone() {
        let word = &words[index];
        chars += if index > start {
            word_sep(&words[index - 1].text, word)
        } else {
            0
        } + word.text.chars().count();
        let is_last = index == range.end - 1;
        let boundary = if is_last {
            true
        } else {
            let next = &words[index + 1];
            next.sp != word.sp
                || next.t0 - word.t1 >= FALLBACK_PAUSE_SEC
                || (chars >= FALLBACK_SOFT_CHARS && sentence_end(&word.text))
                || chars >= FALLBACK_HARD_CHARS
        };
        if boundary {
            out.push(SegPara {
                start,
                end: index,
                text: String::new(),
                source: Source::Split,
            });
            start = index + 1;
            chars = 0;
        }
    }
    out
}

// ---------- post-processing ----------

/// Display character count of a word range (including Latin inter-word spaces). Returns early once `limit` is hit.
fn range_chars(words: &[Word], a: usize, b: usize, limit: Option<usize>) -> usize {
    if a > b || b >= words.len() {
        return 0;
    }
    let mut chars = 0_usize;
    for index in a..=b {
        chars += if index > a {
            word_sep(&words[index - 1].text, &words[index])
        } else {
            0
        } + words[index].text.chars().count();
        if let Some(limit) = limit
            && chars > limit
        {
            return chars;
        }
    }
    chars
}

/// Cuts a segment at `boundary_after(i)` (between word i and word i+1). The text is cut along the normalized alignment at word boundaries and each piece is re-run through the text gate. Pieces that cannot be cut or do not match get empty text.
fn split_at_boundaries(
    p: &SegPara,
    words: &[Word],
    boundary_after: &dyn Fn(usize) -> bool,
) -> Vec<SegPara> {
    if p.start > p.end || p.end >= words.len() {
        return vec![p.clone()];
    }
    let bounds: Vec<usize> = (p.start..p.end).filter(|&i| boundary_after(i)).collect();
    if bounds.is_empty() {
        return vec![p.clone()];
    }
    let mut ranges: Vec<(usize, usize)> = Vec::with_capacity(bounds.len() + 1);
    let mut start = p.start;
    for &b in &bounds {
        ranges.push((start, b));
        start = b + 1;
    }
    ranges.push((start, p.end));

    let fallback_pieces = || -> Vec<SegPara> {
        ranges
            .iter()
            .map(|&(a, b)| SegPara {
                start: a,
                end: b,
                text: String::new(),
                source: p.source,
            })
            .collect()
    };
    if p.text.is_empty() {
        return fallback_pieces();
    }

    // Non-empty text means it passed the text gate, so it maps 1:1 to the word range after normalization and can be cut precisely.
    let span = &words[p.start..=p.end];
    let (span_chars, char_to_word) = span_norm_chars(span);
    let (norm, orig_index) = normalize_with_orig(&p.text);
    if norm != span_chars {
        return fallback_pieces();
    }
    let chars: Vec<char> = p.text.chars().collect();
    let mut cuts: Vec<usize> = vec![0];
    let mut alignment_index = 0_usize;
    for &b in &bounds {
        let local_next = b - p.start + 1; // First word of the next piece (index within the span)
        while alignment_index < char_to_word.len() && char_to_word[alignment_index] < local_next {
            alignment_index += 1;
        }
        let offset = if alignment_index < orig_index.len() {
            orig_index[alignment_index]
        } else {
            chars.len()
        };
        cuts.push(
            offset
                .max(*cuts.last().expect("non-empty"))
                .min(chars.len()),
        );
    }
    cuts.push(chars.len());

    ranges
        .iter()
        .enumerate()
        .map(|(index, &(a, b))| {
            let piece: String = if cuts[index] < cuts[index + 1] {
                chars[cuts[index]..cuts[index + 1]]
                    .iter()
                    .collect::<String>()
                    .trim()
                    .to_owned()
            } else {
                String::new()
            };
            let text = if !piece.is_empty() && text_matches_range(&piece, &words[a..=b]) {
                piece
            } else {
                String::new()
            };
            SegPara {
                start: a,
                end: b,
                text,
                source: p.source,
            }
        })
        .collect()
}

/// Hard guarantee: ⏹ is only a hint in the prompt. Speaker changes force a segment break deterministically.
fn split_at_speaker_changes(p: &SegPara, words: &[Word]) -> Vec<SegPara> {
    split_at_boundaries(p, words, &|i| words[i].sp != words[i + 1].sp)
}

/// carry-over snowball guard: commit the head of the pending segment up to its **last** sentence-end or pause boundary. Only the remainder continues to be carried. If there is no boundary at all, or the remainder still exceeds the limit after the boundary, hard-cut to ≤600 characters.
fn force_commit_split(p: &SegPara, words: &[Word]) -> (Vec<SegPara>, SegPara) {
    let mut cut: isize = -1;
    for index in p.start..p.end {
        let is_boundary = sentence_end(&words[index].text)
            || words[index + 1].t0 - words[index].t1 >= RULES_PAUSE_SEC;
        if is_boundary {
            cut = index as isize;
        }
    }
    // The boundary may be far back at the segment start and the carry still over the limit, so take the hard-cut path.
    if cut >= p.start as isize
        && range_chars(words, cut as usize + 1, p.end, Some(MAX_CARRY_CHARS)) > MAX_CARRY_CHARS
    {
        cut = -1;
    }
    if cut < 0 {
        // Hard cut: walk back from the segment end until the carry fits.
        let mut chars = 0_usize;
        let mut index = p.end;
        while index > p.start {
            chars +=
                words[index].text.chars().count() + word_sep(&words[index - 1].text, &words[index]);
            if chars > MAX_CARRY_CHARS {
                break;
            }
            index -= 1;
        }
        cut = index.max(p.start) as isize;
    }
    if cut < p.start as isize || cut >= p.end as isize {
        return (Vec::new(), p.clone());
    }
    let cut = cut as usize;
    let pieces = split_at_boundaries(p, words, &|i| i == cut);
    if pieces.len() == 2 {
        (vec![pieces[0].clone()], pieces[1].clone())
    } else {
        (
            vec![SegPara {
                start: p.start,
                end: cut,
                text: String::new(),
                source: p.source,
            }],
            SegPara {
                start: cut + 1,
                end: p.end,
                text: String::new(),
                source: p.source,
            },
        )
    }
}

/// M51: programmatic segment-length guard. Segments over 600 characters are greedily re-split. The cut point is the last sentence-end or pause boundary seen in this scan; only if there is none is it hard-cut at the budget. The text of the cut-off pieces is discarded.
fn enforce_paragraph_length(paras: Vec<SegPara>, words: &[Word]) -> Vec<SegPara> {
    let mut out: Vec<SegPara> = Vec::new();
    for p in paras {
        if range_chars(words, p.start, p.end, Some(MAX_PARA_CHARS)) <= MAX_PARA_CHARS
            || p.end >= words.len()
            || p.start >= p.end
        {
            out.push(p);
            continue;
        }
        let mut seg_start = p.start;
        let mut chars = 0_usize;
        let mut last_boundary: isize = -1;
        let mut index = p.start;
        while index <= p.end {
            chars += if index > seg_start {
                word_sep(&words[index - 1].text, &words[index])
            } else {
                0
            } + words[index].text.chars().count();
            if index < p.end
                && (sentence_end(&words[index].text)
                    || words[index + 1].t0 - words[index].t1 >= RULES_PAUSE_SEC)
            {
                last_boundary = index as isize;
            }
            if chars > MAX_PARA_CHARS && index < p.end {
                let cut = if last_boundary >= seg_start as isize {
                    last_boundary as usize
                } else {
                    index
                };
                out.push(SegPara {
                    start: seg_start,
                    end: cut,
                    text: String::new(),
                    source: Source::Split,
                });
                seg_start = cut + 1;
                index = cut + 1;
                chars = 0;
                last_boundary = -1;
                continue;
            }
            index += 1;
        }
        out.push(SegPara {
            start: seg_start,
            end: p.end,
            text: String::new(),
            source: Source::Split,
        });
    }
    out
}

// ---------- page loop and write-back ----------

/// Whether the model swallowed the spaces between several normal source words, welding them into one unbreakable over-wide Latin atom.
///
/// `normalize_chars` deliberately ignores whitespace, so such an answer passes the exact text gate. Rebind then turns the whole string into one Word, and the Cue has no internal word seam left to break at. The text is downgraded only when the corrected new atom exceeds the single-line hard budget and is clearly wider than either source-side atom. Real long identifiers are kept as they are.
fn introduces_overwide_atom(span: &[Word], corrected: &str, max_width: usize) -> bool {
    let corrected_max = atomize_like(span, corrected)
        .iter()
        .map(|atom| visual_width(atom))
        .max()
        .unwrap_or(0);
    if corrected_max <= max_width {
        return false;
    }
    let source = join_word_texts(span.iter());
    let source_max = atomize_like(span, &source)
        .iter()
        .map(|atom| visual_width(atom))
        .max()
        .unwrap_or(0);
    corrected_max > source_max
}

/// Main segmentation entry point: paginate, run the five-tier ladder per page, carry-over, hard speaker guarantee, segment-length guard. Punctuation lands on words via rebind, paragraph breaks are pinned as `paraBreaks`, and `stages.segment` is stamped.
pub fn run_segment(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    options: &SegmentOptions,
    ids: &mut dyn IdSource,
    sleep: &mut dyn FnMut(f64),
) -> Result<SegmentOutcome, LlmError> {
    if doc.words.is_empty() {
        return Ok(SegmentOutcome {
            records: Vec::new(),
            fallback_pages: 0,
            cue_layout: crate::layout::CueLayoutStats::default(),
        });
    }
    let previous_words = doc.words.clone();
    let refresh_polish = doc.stages.polish.is_some();
    let system = system_prompt(&options.language, options.instructions.as_deref());
    let pages = paginate_word_ranges(&doc.words, options.page_budget, budgets::SEGMENT_MIN_LAST);

    let mut committed: Vec<SegPara> = Vec::new();
    let mut pending: Option<SegPara> = None;
    let mut fallback_pages = 0_u32;

    for (page_index, page) in pages.iter().enumerate() {
        if page_index > 0 {
            sleep(PAGE_DELAY_SECONDS);
        }
        // carry-over: the previous page's pending segment is re-sent with the new right-hand context. The LLM re-decides its boundary, so a paragraph is never split at a page seam.
        let payload_start = pending
            .as_ref()
            .map_or(page.start, |p| p.start.min(page.start));
        let range = payload_start..page.end;

        let words = &doc.words;
        // attempt ×3 (2s backoff; each retry carries the reason for the previous failure), then one tier-4 index-contract call, then the tier-5 deterministic fallback. Non-retryable errors such as auth failure or a missing model abort the whole run.
        let mut retry_reason: Option<String> = None;
        let attempts = with_retry(MAX_RETRIES, &mut *sleep, |attempt| {
            let result = segment_page(
                range.clone(),
                words,
                &system,
                llm,
                attempt + 1,
                retry_reason.take(),
            );
            if let Err(error) = &result {
                retry_reason = Some(error.to_string());
            }
            result
        });
        let paras = match attempts {
            Ok(paras) => paras,
            Err(error) if !should_retry(&error) => return Err(error),
            Err(last) => match segment_page_by_indexes(
                range.clone(),
                words,
                &options.language,
                llm,
                Some(last.to_string()),
            ) {
                Ok(paras) => paras,
                Err(error) if !should_retry(&error) => return Err(error),
                Err(_) => {
                    fallback_pages += 1;
                    fallback_segment(&range, words)
                }
            },
        };

        // Hard speaker guarantee (the prompt's ⏹ is only a hint).
        let mut paras: Vec<SegPara> = paras
            .iter()
            .flat_map(|p| split_at_speaker_changes(p, words))
            .collect();

        if page_index == pages.len() - 1 {
            committed.append(&mut paras);
            pending = None;
        } else if !paras.is_empty() {
            let mut tail = paras.pop().expect("non-empty");
            committed.append(&mut paras);
            if range_chars(words, tail.start, tail.end, Some(MAX_CARRY_CHARS)) > MAX_CARRY_CHARS {
                let (mut head, rest) = force_commit_split(&tail, words);
                committed.append(&mut head);
                tail = rest;
            }
            pending = Some(tail);
        }
    }
    if let Some(pending) = pending {
        committed.push(pending);
    }
    let paras = enforce_paragraph_length(committed, &doc.words);

    // Write-back: punctuation lands on words via rebind (LCS keeps ids and times), then normalize to finish. Paragraph pins are written to paraBreaks, conservatively: only additions, and manual pins are never cleared. Finally the structure fingerprint is stamped.
    let mut new_words: Vec<Word> = Vec::with_capacity(doc.words.len());
    let mut records: Vec<SegmentRecord> = Vec::with_capacity(paras.len());
    let mut pins: Vec<String> = Vec::new();
    // Korean ranges built per syllable before 0.5: after rebinding, the "attach to previous" marks are re-derived by the old rules.
    let mut legacy_spans: Vec<std::ops::Range<usize>> = Vec::new();
    let mut cursor = 0_usize;
    let atom_width_limit =
        options.cue_max_chars + crate::layout_profile::cue_params_for_doc(doc).overflow_slack;
    for p in &paras {
        // Defensive: the ladder guarantees full, contiguous coverage. Even if there is a gap, never drop words.
        if p.start > cursor {
            new_words.extend_from_slice(&doc.words[cursor..p.start]);
        }
        let start = p.start.max(cursor);
        let end = p.end.min(doc.words.len() - 1).max(start);
        cursor = end + 1;
        let span = &doc.words[start..=end];
        let applied_text =
            if p.text.is_empty() || introduces_overwide_atom(span, &p.text, atom_width_limit) {
                ""
            } else {
                p.text.as_str()
            };
        let mut rebound: Vec<Word> = if applied_text.is_empty() {
            span.to_vec()
        } else {
            let range_start = span[0].t0;
            let range_end = span[span.len() - 1].t1;
            let mut rebound = rebind_corrected(span, applied_text, ids);
            if rebound.is_empty() {
                rebound = span.to_vec();
            } else if crate::rebind::is_legacy_span(span) {
                legacy_spans.push(new_words.len()..new_words.len() + rebound.len());
            }
            normalize_doc_words(&mut rebound, range_start, range_end);
            rebound
        };
        let first = rebound.first().expect("non-empty span");
        let last = rebound.last().expect("non-empty span");
        records.push(SegmentRecord {
            first_word_id: first.id.clone(),
            last_word_id: last.id.clone(),
            t0: first.t0,
            t1: last.t1,
            text: applied_text.to_owned(),
            source: p.source.as_str().to_owned(),
        });
        if !new_words.is_empty() {
            pins.push(first.id.clone());
        }
        new_words.append(&mut rebound);
    }
    if cursor < doc.words.len() {
        let len = doc.words.len();
        new_words.extend_from_slice(&doc.words[cursor..len]);
    }
    for range in legacy_spans {
        crate::rebind::reglue_legacy_span(&mut new_words, range, &doc.hidden);
    }
    doc.words = new_words;
    super::polish::rebase_orphan_layout_overrides(doc, &previous_words);
    doc.prune_orphan_overrides();
    for id in pins {
        doc.para_breaks.insert(id, true);
    }
    if refresh_polish {
        // segment only permits punctuation and segmentation revisions. When it runs after polish, these revisions are legitimate post-processing for that stage and must not flag the just-finished polish as stale.
        doc.stages.polish = Some(fingerprint(&doc.words));
    }
    doc.stages.segment = Some(id_fingerprint(&doc.words));
    // After the paragraph pins are settled, the balanced break layout is laid out. The optimizer always runs. User `breaks` and paragraph pins are hard constraints. The result goes only to `autoBreaks[layoutProfile]`. Layout changes made by the pipeline itself refresh the asrLayout stamp (which counts only user breaks, paraBreaks and hidden), so they are not mistaken for manual edits. The §18.5 parameters take the document profile's `source`; `--cue-line-length` only overrides the line width.
    let cue_params = crate::cue::CueParams {
        max_chars: options.cue_max_chars,
        ..crate::layout_profile::cue_params_for_doc(doc)
    };
    crate::layout::remove_overwide_nobreaks(doc, &cue_params);
    // Rebase and prune, paragraph pins, and over-wide nobreak fixes are all legitimate layout write-backs of this stage. The layout fingerprint must be refreshed with the final set of user pins (auto pins do not take part in the fingerprint).
    crate::layout::ensure_balanced_cue_layout(doc, &cue_params);
    doc.stages.asr_layout = Some(crate::layout::layout_fingerprint(doc));
    let cue_layout = crate::layout::cue_layout_stats(doc, &cue_params);
    Ok(SegmentOutcome {
        records,
        fallback_pages,
        cue_layout,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::doc::{DocEngine, DocMedia, Speaker};
    use crate::llm::FakeLlm;
    use crate::rebind::SeqIds;

    fn make_doc(words: Vec<(&str, f64, f64, &str, &str)>) -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: Some("talk.wav".to_owned()),
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
        for sp in ["s1", "s2"] {
            doc.speakers.insert(
                sp.to_owned(),
                Speaker {
                    name: sp.to_uppercase(),
                    hue: None,
                },
            );
        }
        doc.words = words
            .into_iter()
            .map(|(id, t0, t1, text, sp)| Word {
                id: id.to_owned(),
                t0,
                t1,
                text: text.to_owned(),
                sp: sp.to_owned(),
                glue: false,
            })
            .collect();
        doc
    }

    fn five_words() -> TranscriptDoc {
        make_doc(vec![
            ("g1.0", 0.0, 0.4, "hello", "s1"),
            ("g1.1", 0.4, 0.8, "world.", "s1"),
            ("g1.2", 0.8, 1.2, "how", "s1"),
            ("g1.3", 1.2, 1.6, "are", "s1"),
            ("g1.4", 1.6, 2.0, "you?", "s1"),
        ])
    }

    #[test]
    fn options_default_matches_contract() {
        let options = SegmentOptions::default();
        assert_eq!(options.language, "en");
        assert_eq!(options.page_budget, budgets::SEGMENT);
        assert!(options.instructions.is_none());
    }

    #[test]
    fn tier1_exact_keeps_word_ids_and_pins_para_breaks() {
        let mut doc = five_words();
        let original_ids: Vec<String> = doc.words.iter().map(|w| w.id.clone()).collect();
        let mut llm = FakeLlm::ok([r#"{"paragraphs":["hello world.","how are you?"]}"#]);
        let mut ids = SeqIds::default();
        let outcome = run_segment(
            &mut doc,
            &mut llm,
            &SegmentOptions::default(),
            &mut ids,
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(outcome.fallback_pages, 0);
        assert_eq!(outcome.records.len(), 2);
        assert_eq!(outcome.records[0].source, "exact");
        assert_eq!(outcome.records[0].text, "hello world.");
        assert_eq!(outcome.records[1].text, "how are you?");
        // The model only added paragraph structure. No word id changed.
        let ids_after: Vec<String> = doc.words.iter().map(|w| w.id.clone()).collect();
        assert_eq!(ids_after, original_ids);
        // The first word of the second segment is pinned into paraBreaks. The first segment is not pinned.
        assert_eq!(doc.para_breaks.get("g1.2"), Some(&true));
        assert_eq!(doc.para_breaks.len(), 1);
        assert_eq!(doc.stages.segment, Some(id_fingerprint(&doc.words)));
        assert_eq!(llm.calls.len(), 1);
        assert_eq!(llm.calls[0].0, "segment");
        // The page payload is text with inline markers (there are no pauses or speaker switches here, so it is plain text).
        assert_eq!(llm.calls[0].2, "hello world. how are you?");
        // The prompt contains the contract sentence and the language trailer line verbatim.
        assert!(
            llm.calls[0]
                .1
                .contains("The downstream subtitle splitter cuts cues at YOUR punctuation")
        );
        assert!(llm.calls[0].1.ends_with("The source language is \"en\"."));
    }

    #[test]
    fn garbage_answers_escalate_to_tier5_full_coverage() {
        // P3 acceptance: even when the fake LLM returns entirely wrong answers, a legal, fully covering set of boundaries is still produced.
        let mut doc = five_words();
        let garbage = r#"{"paragraphs":["completely unrelated nonsense entirely"]}"#;
        let mut llm = FakeLlm::ok([garbage, garbage, garbage, r#"{}"#]);
        let mut ids = SeqIds::default();
        let mut sleeps = Vec::new();
        let outcome = run_segment(
            &mut doc,
            &mut llm,
            &SegmentOptions::default(),
            &mut ids,
            &mut |s| sleeps.push(s),
        )
        .unwrap();

        assert_eq!(outcome.fallback_pages, 1);
        assert!(!outcome.records.is_empty());
        for record in &outcome.records {
            assert_eq!(record.source, "split");
            assert!(record.text.is_empty());
        }
        // Full coverage: closed at both ends, ranges contiguous.
        assert_eq!(outcome.records[0].first_word_id, "g1.0");
        assert_eq!(outcome.records.last().unwrap().last_word_id, "g1.4");
        // 3 main-contract calls plus 1 tier-4 index-contract call. Retries carry the failure reason.
        let kinds: Vec<&str> = llm.calls.iter().map(|c| c.0.as_str()).collect();
        assert_eq!(
            kinds,
            vec!["segment", "segment", "segment", "segment-index"]
        );
        assert!(llm.calls[1].3.is_some());
        assert!(llm.calls[2].3.is_some());
        assert!(llm.calls[3].3.is_some());
        // The tier-4 payload is in the index-contract shape.
        assert!(llm.calls[3].2.starts_with("{\"words\":{\"0\":"));
        // 2 retry backoffs.
        assert_eq!(sleeps, vec![2.0, 2.0]);
        // The fallback does not touch words.
        assert_eq!(doc.words.len(), 5);
        assert_eq!(doc.stages.segment, Some(id_fingerprint(&doc.words)));
    }

    #[test]
    fn speaker_change_is_a_hard_split_even_when_llm_merges() {
        let mut doc = make_doc(vec![
            ("g1.0", 0.0, 0.4, "hi", "s1"),
            ("g1.1", 0.4, 0.8, "there", "s1"),
            ("g2.0", 0.8, 1.2, "yes", "s2"),
            ("g2.1", 1.2, 1.6, "sir", "s2"),
        ]);
        // The model ignored ⏹ and merged everything into one segment.
        let mut llm = FakeLlm::ok([r#"{"paragraphs":["hi there yes sir"]}"#]);
        let mut ids = SeqIds::default();
        let outcome = run_segment(
            &mut doc,
            &mut llm,
            &SegmentOptions::default(),
            &mut ids,
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(outcome.records.len(), 2);
        assert_eq!(outcome.records[0].text, "hi there");
        assert_eq!(outcome.records[1].text, "yes sir");
        assert_eq!(outcome.records[0].last_word_id, "g1.1");
        assert_eq!(outcome.records[1].first_word_id, "g2.0");
        assert_eq!(doc.para_breaks.get("g2.0"), Some(&true));
        // ⏹ was injected into the payload.
        assert!(llm.calls[0].2.contains('⏹'));
    }

    #[test]
    fn text_gate_drops_rewritten_text_but_keeps_boundary() {
        let mut doc = make_doc(vec![
            ("g1.0", 0.0, 0.4, "one", "s1"),
            ("g1.1", 0.4, 0.8, "two", "s1"),
            ("g1.2", 0.8, 1.2, "three", "s1"),
            ("g1.3", 1.2, 1.6, "four", "s1"),
            ("g1.4", 1.6, 2.0, "five", "s1"),
            ("g1.5", 2.0, 2.4, "six", "s1"),
            ("g1.6", 2.4, 2.8, "seven", "s1"),
            ("g1.7", 2.8, 3.2, "eight", "s1"),
        ]);
        doc.stages.polish = Some(fingerprint(&doc.words));
        doc.breaks
            .insert("g1.3".to_owned(), crate::doc::BreakOverride::Nobreak);
        doc.para_breaks.insert("orphan".to_owned(), true);
        // The second segment rewrote one word: tier 1 fails, tier 2 ratio 7/8 ≥ 0.75 passes. The first segment passes the text gate and keeps its punctuation. The second segment's text is emptied, and its boundaries are used as-is.
        let mut llm =
            FakeLlm::ok([r#"{"paragraphs":["one two three four,","five six SEVENX eight"]}"#]);
        let mut ids = SeqIds::default();
        let outcome = run_segment(
            &mut doc,
            &mut llm,
            &SegmentOptions::default(),
            &mut ids,
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(outcome.records.len(), 2);
        assert_eq!(outcome.records[0].source, "diff");
        assert_eq!(outcome.records[0].text, "one two three four,");
        assert_eq!(outcome.records[1].text, "");
        assert_eq!(outcome.records[1].first_word_id, "g1.4");
        assert_eq!(outcome.records[1].last_word_id, "g1.7");
        // A text-downgraded segment keeps its words as they are.
        let texts: Vec<&str> = doc.words[4..].iter().map(|w| w.text.as_str()).collect();
        assert_eq!(texts, vec!["five", "six", "seven", "eight"]);
        // Punctuation-only segment: rebind keeps the ids of unchanged words, and "four," gets a new id.
        assert_eq!(doc.words[0].id, "g1.0");
        assert_eq!(doc.words[3].text, "four,");
        assert_ne!(doc.words[3].id, "g1.3");
        let current_ids: std::collections::BTreeSet<&str> =
            doc.words.iter().map(|word| word.id.as_str()).collect();
        assert!(
            doc.breaks
                .keys()
                .all(|id| current_ids.contains(id.as_str()))
        );
        assert!(
            doc.para_breaks
                .keys()
                .all(|id| current_ids.contains(id.as_str()))
        );
        assert_eq!(doc.stages.polish, Some(fingerprint(&doc.words)));
        assert_eq!(
            doc.stages.asr_layout,
            Some(crate::layout::layout_fingerprint(&doc))
        );
    }

    #[test]
    fn segment_drops_space_collapsed_overwide_latin_atom_but_keeps_boundary() {
        let mut doc = make_doc(vec![
            ("g1.0", 0.0, 0.3, "what", "s1"),
            ("g1.1", 0.3, 0.6, "is", "s1"),
            ("g1.2", 0.6, 0.9, "reinforcement", "s1"),
            ("g1.3", 0.9, 1.2, "learning", "s1"),
            ("g1.4", 1.2, 1.5, "reinforcement", "s1"),
            ("g1.5", 1.5, 1.8, "learning", "s1"),
        ]);
        let original = doc.words.clone();
        let mut llm = FakeLlm::ok([
            r#"{"paragraphs":["whatisreinforcementlearningreinforcementlearning。，"]}"#,
        ]);
        let mut ids = SeqIds::default();

        let outcome = run_segment(
            &mut doc,
            &mut llm,
            &SegmentOptions::default(),
            &mut ids,
            &mut |_| {},
        )
        .unwrap();

        assert_eq!(
            doc.words, original,
            "over-wide welded text must fall back to source words"
        );
        assert_eq!(outcome.records.len(), 1);
        assert!(outcome.records[0].text.is_empty());
        assert_eq!(outcome.cue_layout.over_width, 0);
    }

    #[test]
    fn terminal_errors_abort_instead_of_degrading() {
        let mut doc = five_words();
        let mut llm = FakeLlm::new([Err(LlmError::Http {
            status: 401,
            message: "unauthorized".to_owned(),
        })]);
        let mut ids = SeqIds::default();
        let result = run_segment(
            &mut doc,
            &mut llm,
            &SegmentOptions::default(),
            &mut ids,
            &mut |_| {},
        );
        assert!(matches!(result, Err(LlmError::Http { status: 401, .. })));
        // Never mask a configuration problem with a downgraded result. The document was not touched.
        assert!(doc.stages.segment.is_none());
        assert!(doc.para_breaks.is_empty());
    }

    #[test]
    fn fallback_segment_splits_on_pause_boundary() {
        let mut words: Vec<Word> = (0..6)
            .map(|i| Word {
                id: format!("g1.{i}"),
                t0: i as f64,
                t1: i as f64 + 0.5,
                text: "word".to_owned(),
                sp: "s1".to_owned(),
                glue: false,
            })
            .collect();
        // A pause of ≥1.2s between word 2 and word 3.
        for word in &mut words[3..] {
            word.t0 += 2.0;
            word.t1 += 2.0;
        }
        let paras = fallback_segment(&(0..6), &words);
        assert_eq!(paras.len(), 2);
        assert_eq!((paras[0].start, paras[0].end), (0, 2));
        assert_eq!((paras[1].start, paras[1].end), (3, 5));
    }

    #[test]
    fn tier4_healing_snaps_small_gaps_and_rejects_big_ones() {
        let words = five_words().words;
        // ≤10-word gap snapping: {1..2}{4..4} means the 3 gap words are absorbed into the second segment.
        let mut llm = FakeLlm::ok([
            r#"{"paragraphs":[{"startWordIndex":"0","endWordIndex":1.0},{"startWordIndex":3,"endWordIndex":9}]}"#,
        ]);
        let paras = segment_page_by_indexes(0..5, &words, "en", &mut llm, None).unwrap();
        assert_eq!(paras.len(), 2);
        assert_eq!((paras[0].start, paras[0].end), (0, 1));
        assert_eq!((paras[1].start, paras[1].end), (2, 4));

        // Empty response → Malformed.
        let mut llm = FakeLlm::ok([r#"{"paragraphs":[]}"#]);
        assert!(matches!(
            segment_page_by_indexes(0..5, &words, "en", &mut llm, None),
            Err(LlmError::Malformed(_))
        ));
    }

    /// Thai text built per word: segment text split on whitespace can only reach phrases, so both sides are cut to grapheme clusters to match. The segment boundary falls back on a word boundary (here, the line end). Spaces the model adds around numbers do not affect this.
    #[test]
    fn thai_paragraphs_map_onto_a_word_split_transcript() {
        let rows = [
            "ลลิตาไม่ได้ยกเลิกการประชุมแต่เลื่อนไปเป็นวันพฤหัสบดีเวลา14:30น.",
            "ถ้าอุณหภูมิลดลงต่ำกว่า5องศาให้ปิดหน้าต่างก่อนเปิดเครื่องทำความร้อน",
            "วันนี้อากาศดีมาก เราจะไปเที่ยวทะเลกัน",
        ];
        let doc = crate::build::build_doc(
            &rows
                .iter()
                .enumerate()
                .map(|(index, text)| {
                    crate::asr_rows::RowIn::new(index as f64 * 6.0, index as f64 * 6.0 + 5.0, *text)
                })
                .collect::<Vec<_>>(),
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
        let words = &doc.words;
        assert!(words.iter().any(|word| word.glue));
        let paras = vec![
            "ลลิตาไม่ได้ยกเลิกการประชุมแต่เลื่อนไปเป็นวันพฤหัสบดีเวลา 14:30 น. ถ้าอุณหภูมิลดลงต่ำกว่า 5 องศาให้ปิดหน้าต่างก่อนเปิดเครื่องทำความร้อน".to_owned(),
            "วันนี้อากาศดีมาก เราจะไปเที่ยวทะเลกัน".to_owned(),
        ];
        let mapped = map_paragraphs_by_diff(&paras, words, 0).expect("maps");
        let second_row_last = words
            .iter()
            .rposition(|word| word.id.starts_with("g2."))
            .unwrap();
        assert_eq!(mapped.len(), 2);
        assert_eq!(mapped[0].end, second_row_last);
        assert_eq!(mapped[1].end, words.len() - 1);
    }
}
