//! Evaluation metrics (alignment block design §8 / M5): the SubER subtitle edit rate and alignment-structure metrics.
//!
//! Pure functions, zero I/O. The host (`ccut check`, and the offline evaluation step of `verify.sh`) is responsible for reading subtitles/transcripts and serializing the [`AlignMetrics`] / [`SuberBreakdown`] output.
//!
//! # SubER
//!
//! Wilken et al., *SubER: A Metric for Subtitle Quality* (IWSLT 2022). This implementation is cross-checked against the AppTek reference implementation `subtitle-edit-rate` 0.4.0 (`suber/metrics/suber.py` + `lib_ter.py`, the latter being a modified version of sacrebleu TER), reproducing its definitions one by one:
//!
//! - Tokens: each line is split on whitespace; after the last word of a line, `<eol>` is appended, and after the last word of a block, `<eob>` (which covers `<eol>`). Empty lines are ignored. The default convention ([`suber`]) lowercases each word and strips ASCII punctuation and `…`; if nothing is left, the original word is kept (pure-punctuation tokens are still counted). No further tokenization is done.
//! - The character-level convention ([`suber_chars`]) reproduces the reference implementation's `--language zh` path: lowercase, strip Unicode punctuation (`\p{P}`), then split each CJK character into its own token following sacrebleu `TokenizerZh`, while the non-CJK parts are split on punctuation in 13a style. **Known deviation** from the reference implementation: kana and hangul are also split character by character. The reference uses MeCab word segmentation for ja/ko, which is unavailable on the Rust side.
//! - TER: Levenshtein (insertion, deletion and substitution each cost 1), plus tercom-style greedy shifts. Each step takes the shift that reduces the edit distance the most; ties go to the longest first, then the earliest position. The shift window is ≤ 50, segments are ≤ 10 words, and at most 1000 candidates are evaluated per independent segment. The diagonal beam width is 100, the same as the reference implementation.
//! - SubER constraint: only words whose subtitle time windows overlap may be matched or substituted (`(a.start < b.end) == (b.start < a.end)`, the same formula as the reference). Newline tokens align only with newline tokens.
//! - Normalization: edit count / number of reference tokens (including newline tokens) × 100. If the reference is empty, any edit counts as 100, and no edits count as 0. The reference implementation rounds to 3 decimal places on output; here the raw value is returned.
//! - As in the reference, the document is first split into independent segments at time points where neither the hypothesis nor the reference has a subtitle, and the score is computed per segment. Splitting does not change the score but shortens the sequences considerably. The reference's row cache (which affects speed only) is not reproduced.
//! - Input blocks are stably sorted by start time (the reference implementation errors on out-of-order SRT). Tags such as `<i>` are not stripped, so callers should pass plain text.
//!
//! # Alignment structure metrics
//!
//! [`align_metrics`] reads the persisted [`TransAlign`] overlay directly. Alignment edges are not persisted, so coverage is approximated by whether a source word or target character falls inside some `blocks[]` block (no blocks = 0). See the field documentation of [`AlignMetrics`] for each convention.

use std::collections::{BTreeSet, HashMap};
use std::sync::OnceLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use unicode_general_category::{GeneralCategory, get_general_category};

use crate::atomize::{atomize, seam_backed_by_whitespace};
use crate::cue::derive_cues;
use crate::doc::{AlignMode, Correspondence, TextBasis, TransAlign, TranscriptDoc};
use crate::engines::align::{RowDeficitStats, row_deficit_stats};
use crate::seam::{ends_clause_punct, ends_sentence_final};
use crate::sentence::derive_sentences;

// ---------------------------------------------------------------------------
// SubER
// ---------------------------------------------------------------------------

/// Line-end newline token (MuST-Cinema notation).
pub const END_OF_LINE_SYMBOL: &str = "<eol>";
/// Block-end newline token.
pub const END_OF_BLOCK_SYMBOL: &str = "<eob>";

const COST_INS: i64 = 1;
const COST_DEL: i64 = 1;
const COST_SUB: i64 = 1;
/// tercom limits: the maximum word count of a single shift segment / the maximum shift distance / the edit-distance beam width.
const MAX_SHIFT_SIZE: usize = 10;
const MAX_SHIFT_DIST: usize = 50;
const BEAM_WIDTH: usize = 100;
/// A limit added by the reference implementation itself: each independent segment evaluates at most this many shift candidates.
const MAX_SHIFT_CANDIDATES: usize = 1000;
const INT_INFINITY: i64 = 10_000_000_000_000_000;

/// One subtitle block: a time window plus several display lines.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SubtitleBlock {
    pub start: f64,
    pub end: f64,
    pub lines: Vec<String>,
}

/// SubER token convention.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SuberTokenization {
    /// Whitespace tokenization (the reference implementation's default path).
    Words,
    /// CJK per character (the reference implementation's `--language zh` path; see the module docs).
    Chars,
}

/// The breakdown of SubER edit operations. The direction follows the reference implementation's statistical convention, from reference to hypothesis: tokens that the hypothesis has extra are counted as insertions, and missing tokens as deletions.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuberBreakdown {
    /// The SubER percentage (not rounded).
    pub score: f64,
    /// Total edits = shifts + word and newline insertions, deletions and substitutions.
    pub edits: usize,
    /// Total reference tokens (words + newlines).
    pub reference_tokens: usize,
    pub reference_words: usize,
    pub reference_breaks: usize,
    pub shifts: usize,
    pub word_insertions: usize,
    pub word_deletions: usize,
    pub word_substitutions: usize,
    pub break_insertions: usize,
    pub break_deletions: usize,
    pub break_substitutions: usize,
}

/// The word-level SubER percentage.
pub fn suber(hyp: &[SubtitleBlock], reference: &[SubtitleBlock]) -> f64 {
    suber_breakdown(hyp, reference, SuberTokenization::Words).score
}

/// The character-level SubER percentage (CJK target languages such as zh and ja).
pub fn suber_chars(hyp: &[SubtitleBlock], reference: &[SubtitleBlock]) -> f64 {
    suber_breakdown(hyp, reference, SuberTokenization::Chars).score
}

/// The SubER score and the per-category edit counts.
pub fn suber_breakdown(
    hyp: &[SubtitleBlock],
    reference: &[SubtitleBlock],
    tokenization: SuberTokenization,
) -> SuberBreakdown {
    let mut interner = Interner::default();
    let hyp_blocks = tokenize_blocks(hyp, tokenization, &mut interner);
    let ref_blocks = tokenize_blocks(reference, tokenization, &mut interner);
    let mut stats = SuberBreakdown::default();
    let mut total_edits = 0usize;
    let mut total_reference = 0usize;
    for (hyp_part, ref_part) in independent_parts(&hyp_blocks, &ref_blocks) {
        let hyp_tokens: Vec<Tok> = hyp_part
            .iter()
            .flat_map(|&index| hyp_blocks[index].tokens.iter().copied())
            .collect();
        let ref_tokens: Vec<Tok> = ref_part
            .iter()
            .flat_map(|&index| ref_blocks[index].tokens.iter().copied())
            .collect();
        let (edits, reference_len) = translation_edit_rate(&hyp_tokens, &ref_tokens, &mut stats);
        total_edits += edits;
        total_reference += reference_len;
    }
    stats.edits = total_edits;
    stats.reference_tokens = total_reference;
    stats.score = if total_reference > 0 {
        total_edits as f64 / total_reference as f64 * 100.0
    } else if total_edits == 0 {
        0.0
    } else {
        100.0
    };
    stats
}

/// Token: after string interning, compared by symbol id. Newline tokens are marked separately.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Tok {
    sym: u32,
    is_break: bool,
    start: f64,
    end: f64,
}

#[derive(Default)]
struct Interner {
    symbols: HashMap<String, u32>,
}

impl Interner {
    fn intern(&mut self, text: &str) -> u32 {
        if let Some(&id) = self.symbols.get(text) {
            return id;
        }
        let id = self.symbols.len() as u32;
        self.symbols.insert(text.to_owned(), id);
        id
    }
}

struct TokBlock {
    start: f64,
    end: f64,
    tokens: Vec<Tok>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LineBreak {
    None,
    EndOfLine,
    EndOfBlock,
}

/// Block → token sequence: tokenize, attach newlines, normalize, re-split (at character level), and expand newlines into tokens.
fn tokenize_blocks(
    blocks: &[SubtitleBlock],
    tokenization: SuberTokenization,
    interner: &mut Interner,
) -> Vec<TokBlock> {
    let mut sorted: Vec<&SubtitleBlock> = blocks.iter().collect();
    sorted.sort_by(|a, b| a.start.total_cmp(&b.start));
    sorted
        .into_iter()
        .map(|block| {
            let mut words: Vec<(String, LineBreak)> = Vec::new();
            for line in &block.lines {
                let line_start = words.len();
                words.extend(
                    line.split_whitespace()
                        .map(|word| (word.to_owned(), LineBreak::None)),
                );
                if words.len() > line_start {
                    words.last_mut().expect("non-empty").1 = LineBreak::EndOfLine;
                }
            }
            if let Some(last) = words.last_mut() {
                last.1 = LineBreak::EndOfBlock;
            }
            let mut tokens = Vec::with_capacity(words.len() * 2);
            for (word, line_break) in words {
                let normalized = match tokenization {
                    SuberTokenization::Words => normalize_word_ascii(&word),
                    SuberTokenization::Chars => normalize_word_unicode(&word),
                };
                let pieces = match tokenization {
                    SuberTokenization::Words => vec![normalized],
                    SuberTokenization::Chars => tokenize_zh(&normalized),
                };
                let last_index = pieces.len().saturating_sub(1);
                for (index, piece) in pieces.into_iter().enumerate() {
                    tokens.push(Tok {
                        sym: interner.intern(&piece),
                        is_break: piece == END_OF_LINE_SYMBOL || piece == END_OF_BLOCK_SYMBOL,
                        start: block.start,
                        end: block.end,
                    });
                    if index == last_index && line_break != LineBreak::None {
                        let symbol = if line_break == LineBreak::EndOfLine {
                            END_OF_LINE_SYMBOL
                        } else {
                            END_OF_BLOCK_SYMBOL
                        };
                        tokens.push(Tok {
                            sym: interner.intern(symbol),
                            is_break: true,
                            start: block.start,
                            end: block.end,
                        });
                    }
                }
            }
            TokBlock {
                start: block.start,
                end: block.end,
                tokens,
            }
        })
        .collect()
}

/// Python `string.punctuation`。
const ASCII_PUNCTUATION: &str = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/// Word normalization for the default convention: lowercase, strip ASCII punctuation and `…`. If that leaves nothing, keep the (lowercased) original word.
fn normalize_word_ascii(word: &str) -> String {
    let lowered = word.to_lowercase();
    let stripped: String = lowered
        .chars()
        .filter(|ch| !ASCII_PUNCTUATION.contains(*ch) && *ch != '…')
        .collect();
    if stripped.is_empty() {
        lowered
    } else {
        stripped
    }
}

/// Word normalization for the character-level convention: lowercase, strip Unicode punctuation (`\p{P}`). If that leaves nothing, keep the original word.
fn normalize_word_unicode(word: &str) -> String {
    let lowered = word.to_lowercase();
    let stripped: String = lowered
        .chars()
        .filter(|ch| !is_unicode_punctuation(*ch))
        .collect();
    if stripped.is_empty() {
        lowered
    } else {
        stripped
    }
}

fn is_unicode_punctuation(ch: char) -> bool {
    matches!(
        get_general_category(ch),
        GeneralCategory::ConnectorPunctuation
            | GeneralCategory::DashPunctuation
            | GeneralCategory::OpenPunctuation
            | GeneralCategory::ClosePunctuation
            | GeneralCategory::InitialPunctuation
            | GeneralCategory::FinalPunctuation
            | GeneralCategory::OtherPunctuation
    )
}

/// The "Chinese character" ranges of sacrebleu `TokenizerZh` (including the fullwidth range, the CJK punctuation range, etc.), plus the kana and hangul ranges extended by this implementation itself (see the deviation note in the module docs).
///
/// sacrebleu writes two auxiliary plane ranges as `' 0'` / `'⾀0'` (in Python, `' ' + '0'`, two characters). After string comparison, the ranges that actually take effect are U+2001–U+2A6D and U+2F81–U+2FA1, while CJK Extension B and the Compatibility Supplement are not split character by character. To keep the numbers identical to the reference implementation, the effective ranges are preserved here (they cover general punctuation, arrows, mathematical symbols, etc.; punctuation was already stripped during normalization, so this only affects residual symbols). The genuine CJK Extension B and Compatibility Supplement ranges are added on top.
fn is_char_token(ch: char) -> bool {
    matches!(ch as u32,
        0x3400..=0x4DB5 | 0x4E00..=0x9FA5 | 0x9FA6..=0x9FBB | 0xF900..=0xFA2D
        | 0xFA30..=0xFA6A | 0xFA70..=0xFAD9
        | 0xFF00..=0xFFEF | 0x2E80..=0x2EFF | 0x3000..=0x303F | 0x31C0..=0x31EF
        | 0x2F00..=0x2FDF | 0x2FF0..=0x2FFF | 0x3100..=0x312F | 0x31A0..=0x31BF
        | 0xFE10..=0xFE1F | 0xFE30..=0xFE4F | 0x2600..=0x26FF | 0x2700..=0x27BF
        | 0x3200..=0x32FF | 0x3300..=0x33FF
        // The mis-encoded ranges that actually take effect in sacrebleu (see the function docs). U+2F81–U+2FA1 is already included in the Kangxi Radicals range U+2F00–U+2FDF above, so it is not listed again.
        | 0x2001..=0x2A6D
        // The genuine CJK Extension B and Compatibility Supplement ranges.
        | 0x20000..=0x2A6D6 | 0x2F800..=0x2FA1D
        // Extended by this implementation itself: Hiragana, Katakana, Katakana Phonetic Extensions, and Hangul syllables.
        | 0x3040..=0x30FF | 0x31F0..=0x31FF | 0xAC00..=0xD7AF)
}

/// sacrebleu `TokenizerZh`: add spaces on both sides of each CJK character, then run `TokenizerRegexp` (the language-independent part of 13a), and finally split on whitespace. A single word that yields only one token is kept as is.
fn tokenize_zh(word: &str) -> Vec<String> {
    let mut spaced = String::with_capacity(word.len() * 2);
    for ch in word.trim().chars() {
        if is_char_token(ch) {
            spaced.push(' ');
            spaced.push(ch);
            spaced.push(' ');
        } else {
            spaced.push(ch);
        }
    }
    let tokens: Vec<String> = tokenizer_regexp(&spaced)
        .split_whitespace()
        .map(str::to_owned)
        .collect();
    if tokens.len() <= 1 {
        vec![word.to_owned()]
    } else {
        tokens
    }
}

/// sacrebleu `TokenizerRegexp` (the post-processing shared by `13a` and `zh`).
fn tokenizer_regexp(line: &str) -> String {
    static RULES: OnceLock<[(Regex, &'static str); 4]> = OnceLock::new();
    let rules = RULES.get_or_init(|| {
        [
            (
                Regex::new(r"([\{-\~\[-\` -\&\(-\+\:-\@/])").expect("valid regex"),
                " $1 ",
            ),
            (
                Regex::new(r"([^0-9])([\.,])").expect("valid regex"),
                "$1 $2 ",
            ),
            (
                Regex::new(r"([\.,])([^0-9])").expect("valid regex"),
                " $1 $2",
            ),
            (Regex::new(r"([0-9])(-)").expect("valid regex"), "$1 $2 "),
        ]
    });
    let mut text = line.to_owned();
    for (rule, replacement) in rules {
        text = rule.replace_all(&text, *replacement).into_owned();
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The reference implementation's `_get_independent_parts`: scan along the time axis and cut at time points where neither the hypothesis nor the reference has a subtitle. Returns, for each segment, the (hypothesis block index, reference block index).
fn independent_parts(hyp: &[TokBlock], reference: &[TokBlock]) -> Vec<(Vec<usize>, Vec<usize>)> {
    let mut parts = Vec::new();
    let mut hyp_part = Vec::new();
    let mut ref_part = Vec::new();
    let mut hyp_index = 0usize;
    let mut ref_index = 0usize;
    let mut latest = f64::NEG_INFINITY;
    while hyp_index < hyp.len() || ref_index < reference.len() {
        let take_hyp = hyp_index < hyp.len()
            && (ref_index == reference.len() || hyp[hyp_index].start < reference[ref_index].start);
        let block = if take_hyp {
            &hyp[hyp_index]
        } else {
            &reference[ref_index]
        };
        if (!hyp_part.is_empty() || !ref_part.is_empty()) && block.start >= latest {
            parts.push((std::mem::take(&mut hyp_part), std::mem::take(&mut ref_part)));
        }
        if take_hyp {
            hyp_part.push(hyp_index);
            hyp_index += 1;
        } else {
            ref_part.push(ref_index);
            ref_index += 1;
        }
        latest = latest.max(block.end);
    }
    if !hyp_part.is_empty() || !ref_part.is_empty() {
        parts.push((hyp_part, ref_part));
    }
    parts
}

/// SubER alignment permission: newline tokens align only with newline tokens, and the blocks' time windows must overlap (the same formula as the reference; zero-length blocks also count as overlapping at the same instant).
fn is_allowed_alignment(a: Tok, b: Tok) -> bool {
    if a.is_break != b.is_break {
        return false;
    }
    (a.start < b.end) == (b.start < a.end)
}

fn is_word_match(a: Tok, b: Tok) -> bool {
    a.sym == b.sym && is_allowed_alignment(a, b)
}

/// Edit-distance backtrace operations. `HypOnly` and `RefOnly` correspond to the `i` and `d` of the reference implementation's flipped trace (tokens the hypothesis has extra / tokens the reference is missing).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Op {
    Keep,
    Sub,
    HypOnly,
    RefOnly,
    Undef,
}

/// The TER for a single independent segment: greedy shifts until the edit distance no longer decreases. Returns (edit count, reference length) and accumulates the per-category counts into `stats`.
fn translation_edit_rate(
    hyp: &[Tok],
    reference: &[Tok],
    stats: &mut SuberBreakdown,
) -> (usize, usize) {
    if reference.is_empty() {
        let trace = vec![Op::HypOnly; hyp.len()];
        collect_stats(&trace, reference, hyp, 0, stats);
        return (hyp.len(), 0);
    }
    let mut shifts = 0usize;
    let mut checked = 0usize;
    let mut current: Vec<Tok> = hyp.to_vec();
    loop {
        let (delta, shifted) = best_shift(&current, reference, &mut checked);
        if checked >= MAX_SHIFT_CANDIDATES {
            break;
        }
        if delta <= 0 {
            break;
        }
        shifts += 1;
        current = shifted;
    }
    let (distance, trace) = edit_distance(&current, reference);
    collect_stats(&trace, reference, &current, shifts, stats);
    (shifts + distance as usize, reference.len())
}

fn collect_stats(
    trace: &[Op],
    reference: &[Tok],
    hyp: &[Tok],
    shifts: usize,
    stats: &mut SuberBreakdown,
) {
    let mut ref_pos = 0usize;
    let mut hyp_pos = 0usize;
    for &op in trace {
        match op {
            Op::HypOnly => {
                if hyp[hyp_pos].is_break {
                    stats.break_insertions += 1;
                } else {
                    stats.word_insertions += 1;
                }
                hyp_pos += 1;
            }
            _ => {
                let is_break = reference[ref_pos].is_break;
                if is_break {
                    stats.reference_breaks += 1;
                } else {
                    stats.reference_words += 1;
                }
                match op {
                    Op::RefOnly => {
                        if is_break {
                            stats.break_deletions += 1;
                        } else {
                            stats.word_deletions += 1;
                        }
                    }
                    Op::Sub => {
                        if is_break {
                            stats.break_substitutions += 1;
                        } else {
                            stats.word_substitutions += 1;
                        }
                        hyp_pos += 1;
                    }
                    _ => hyp_pos += 1,
                }
                ref_pos += 1;
            }
        }
    }
    stats.shifts += shifts;
}

/// The reference implementation's `_shift`: enumerates the tercom candidate shifts and returns (the reduction in edit distance, the shifted hypothesis). If there are no candidates, the reduction is 0 and the input is returned unchanged.
fn best_shift(hyp: &[Tok], reference: &[Tok], checked: &mut usize) -> (i64, Vec<Tok>) {
    let (pre_score, trace) = edit_distance(hyp, reference);
    let (align, ref_err, hyp_err) = trace_to_alignment(&trace);
    let n_h = hyp.len();
    let n_r = reference.len();
    // The candidate with the lexicographically largest (reduction, length, -start_h, -idx) wins; ties keep the one that appeared first.
    let mut best: Option<((i64, usize, i64, i64), Vec<Tok>)> = None;

    'outer: for start_h in 0..n_h {
        for start_r in 0..n_r {
            if start_r.abs_diff(start_h) > MAX_SHIFT_DIST {
                continue;
            }
            let mut length = 0usize;
            while is_word_match(hyp[start_h + length], reference[start_r + length])
                && length < MAX_SHIFT_SIZE
            {
                length += 1;
                // Candidate (start_h, start_r, length)
                let hyp_wrong = hyp_err[start_h..start_h + length].iter().any(|&e| e);
                let ref_wrong = ref_err[start_r..start_r + length].iter().any(|&e| e);
                let aligned_inside =
                    align[start_r] >= start_h as i64 && align[start_r] < (start_h + length) as i64;
                if hyp_wrong && ref_wrong && !aligned_inside {
                    let mut prev_idx: i64 = -1;
                    for offset in -1..length as i64 {
                        let ref_pos = start_r as i64 + offset;
                        let idx = if ref_pos == -1 {
                            0
                        } else if (ref_pos as usize) < n_r {
                            align[ref_pos as usize] + 1
                        } else {
                            break;
                        };
                        if idx == prev_idx {
                            continue;
                        }
                        prev_idx = idx;
                        let shifted = perform_shift(hyp, start_h, length, idx as usize);
                        debug_assert_eq!(shifted.len(), n_h);
                        let score = pre_score - edit_distance(&shifted, reference).0;
                        *checked += 1;
                        let key = (score, length, -(start_h as i64), -idx);
                        if best.as_ref().is_none_or(|(best_key, _)| key > *best_key) {
                            best = Some((key, shifted));
                        }
                    }
                    // The reference implementation checks the upper limit only after candidates have passed the filter.
                    if *checked >= MAX_SHIFT_CANDIDATES {
                        break 'outer;
                    }
                }
                if n_h == start_h + length || n_r == start_r + length {
                    break;
                }
            }
        }
    }
    match best {
        Some(((score, _, _, _), shifted)) => (score, shifted),
        None => (0, hyp.to_vec()),
    }
}

/// The reference implementation's `_perform_shift`: moves `words[start..start+length]` to just before `target`.
fn perform_shift(words: &[Tok], start: usize, length: usize, target: usize) -> Vec<Tok> {
    let n = words.len();
    let mut out = Vec::with_capacity(n);
    if target < start {
        out.extend_from_slice(&words[..target]);
        out.extend_from_slice(&words[start..start + length]);
        out.extend_from_slice(&words[target..start]);
        out.extend_from_slice(&words[start + length..]);
    } else if target > start + length {
        out.extend_from_slice(&words[..start]);
        out.extend_from_slice(&words[start + length..target]);
        out.extend_from_slice(&words[start..start + length]);
        out.extend_from_slice(&words[target..]);
    } else {
        let cut = (length + target).min(n);
        out.extend_from_slice(&words[..start]);
        out.extend_from_slice(&words[start + length..cut]);
        out.extend_from_slice(&words[start..start + length]);
        out.extend_from_slice(&words[cut..]);
    }
    out
}

/// trace → (reference position → aligned hypothesis position, reference error position, hypothesis error position).
fn trace_to_alignment(trace: &[Op]) -> (Vec<i64>, Vec<bool>, Vec<bool>) {
    let mut pos_hyp: i64 = -1;
    let mut align = Vec::new();
    let mut ref_err = Vec::new();
    let mut hyp_err = Vec::new();
    for &op in trace {
        match op {
            Op::Keep => {
                pos_hyp += 1;
                align.push(pos_hyp);
                hyp_err.push(false);
                ref_err.push(false);
            }
            Op::Sub => {
                pos_hyp += 1;
                align.push(pos_hyp);
                hyp_err.push(true);
                ref_err.push(true);
            }
            Op::HypOnly => {
                pos_hyp += 1;
                hyp_err.push(true);
            }
            Op::RefOnly => {
                align.push(pos_hyp);
                ref_err.push(true);
            }
            Op::Undef => unreachable!("undefined edit operation in trace"),
        }
    }
    (align, ref_err, hyp_err)
}

/// Beam-limited Levenshtein (the reference implementation's `BeamEditDistance._edit_distance`, uncached): rows = hypothesis, columns = reference. Words whose times do not overlap may not be substituted. Returns (distance, trace).
fn edit_distance(hyp: &[Tok], reference: &[Tok]) -> (i64, Vec<Op>) {
    let n_h = hyp.len();
    let n_r = reference.len();
    let width = n_r + 1;
    let mut cost = vec![INT_INFINITY; (n_h + 1) * width];
    let mut ops = vec![Op::Undef; (n_h + 1) * width];
    for j in 0..=n_r {
        cost[j] = j as i64 * COST_INS;
        ops[j] = Op::RefOnly;
    }
    let length_ratio = if n_h > 0 {
        n_r as f64 / n_h as f64
    } else {
        1.0
    };
    let beam_width: i64 = if (BEAM_WIDTH as f64) < length_ratio / 2.0 {
        (length_ratio / 2.0 + BEAM_WIDTH as f64).ceil() as i64
    } else {
        BEAM_WIDTH as i64
    };
    for i in 1..=n_h {
        let pseudo_diag = (i as f64 * length_ratio).floor() as i64;
        let min_j = (pseudo_diag - beam_width).max(0) as usize;
        let mut max_j = ((pseudo_diag + beam_width).max(0) as usize).min(n_r + 1);
        if i == n_h {
            max_j = n_r + 1;
        }
        for j in min_j..max_j {
            let index = i * width + j;
            if j == 0 {
                cost[index] = cost[index - width] + COST_DEL;
                ops[index] = Op::HypOnly;
                continue;
            }
            let (sub_cost, sub_op) = if is_word_match(hyp[i - 1], reference[j - 1]) {
                (0, Op::Keep)
            } else if is_allowed_alignment(hyp[i - 1], reference[j - 1]) {
                (COST_SUB, Op::Sub)
            } else {
                (INT_INFINITY, Op::Sub)
            };
            // tercom preference: match/substitute > extra hypothesis word > extra reference word (updated only on a strict less-than).
            let candidates = [
                (cost[index - width - 1] + sub_cost, sub_op),
                (cost[index - width] + COST_DEL, Op::HypOnly),
                (cost[index - 1] + COST_INS, Op::RefOnly),
            ];
            for (candidate_cost, op) in candidates {
                if cost[index] > candidate_cost {
                    cost[index] = candidate_cost;
                    ops[index] = op;
                }
            }
        }
    }
    let mut trace = Vec::with_capacity(n_h + n_r);
    let (mut i, mut j) = (n_h, n_r);
    while i > 0 || j > 0 {
        let op = match ops[i * width + j] {
            // Cells outside the beam should theoretically not appear on the backtrace path. As a fallback, pick an operation that makes progress.
            Op::Undef => {
                if i > 0 {
                    Op::HypOnly
                } else {
                    Op::RefOnly
                }
            }
            op => op,
        };
        trace.push(op);
        match op {
            Op::Keep | Op::Sub => {
                i -= 1;
                j -= 1;
            }
            Op::RefOnly => j -= 1,
            Op::HypOnly | Op::Undef => i -= 1,
        }
    }
    trace.reverse();
    (cost[n_h * width + n_r], trace)
}

// ---------------------------------------------------------------------------
// Alignment structure metrics (design §8)
// ---------------------------------------------------------------------------

/// Per-sentence alignment detail.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentenceAlignMetrics {
    /// Sentence id (`s-<first word id>`).
    pub id: String,
    /// Whether a `transAlign` entry exists for this language.
    pub aligned: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<AlignMode>,
    /// The effective correspondence granularity ([`TransAlign::correspondence`]).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub correspondence: Option<Correspondence>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_basis: Option<TextBasis>,
    /// Source word count: if the entry's `words` is non-empty, take its length; otherwise take the number of words in the sentence.
    pub source_words: usize,
    /// The character count of `concat(pieces.text)`.
    pub target_chars: usize,
    pub blocks: usize,
    pub local_reorder_blocks: usize,
    pub weak_blocks: usize,
    /// The number of source words that fall within some block's `src` range (no block = 0).
    pub covered_source_words: usize,
    /// The number of target-text characters that fall within some block's `tgt` range (no block = 0).
    pub covered_target_chars: usize,
    /// The number of boundaries between blocks = `blocks - 1` (when blocks exist).
    pub block_boundaries: usize,
    /// The number of legal target-side seams inside blocks (not at block boundaries): those where the source text backs the atomic boundary of the piece with whitespace, or where the preceding atom ends with clause or sentence-end punctuation.
    pub inner_candidate_seams: usize,
    /// The `aligner` source string of the entry (`TransAlign::aligner`), used by the scorer's convention and by `align-scorer-stale`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligner: Option<String>,
    /// The number of source sub-lines actually visible for this sentence, after it is split by source Cue and fragments of ≤ 2 words are absorbed.
    pub source_rows: usize,
    /// The number of target Cues currently derived for this sentence.
    pub trans_cues: usize,
    /// The dwell time, in seconds, of the longest target Cue of this sentence.
    pub max_dwell_sec: f64,
}

/// Alignment structure metrics aggregated per language (design §8). When the denominator of any ratio is 0, the ratio is recorded as 0.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignMetrics {
    /// The target-language key.
    pub lang: String,
    /// The number of sentences currently derived.
    pub sentences: usize,
    /// The number of sentences that have a `transAlign` entry.
    pub aligned: usize,
    /// The number of `transAlign[lang]` entries that correspond to no current sentence (stale leftovers).
    pub orphan_entries: usize,
    /// `align-coverage` (source side): the share of source words that fall within a block, among manyToOne entries. Entries without blocks count as 0 coverage in the denominator.
    pub coverage_src: f64,
    /// `align-coverage` (target side): the share of target-text characters that fall within a block, among manyToOne entries.
    pub coverage_tgt: f64,
    /// `align-crossing-rate`: the proportion of aligned sentences that contain a `local-reorder` block.
    pub crossing_rate: f64,
    /// The total number of `local-reorder` blocks.
    pub local_reorder_blocks: usize,
    /// `align-safe-boundary-ratio`: block boundary count / (block boundary count + in-block legal seam candidates). Only entries that have blocks are counted.
    pub safe_boundary_ratio: f64,
    /// `align-sentence-degrade-rate`: the share of manyToOne entries where `correspondence == sentence` (persistence does not distinguish the reason for degradation; `independent` is shown separately as `independent_rate`).
    pub sentence_degrade_rate: f64,
    /// `align-rewrite-rate`: the proportion of aligned sentences whose `textBasis == display`.
    pub rewrite_rate: f64,
    /// The proportion of aligned sentences whose `mode == independent`.
    pub independent_rate: f64,
    /// The proportion of all blocks that carry a `weak` mark.
    pub weak_block_rate: f64,
    /// `align-row-deficit` hits / translated sentences.
    pub row_deficit_rate: f64,
    pub per_sentence: Vec<SentenceAlignMetrics>,
}

/// Computes the alignment structure metrics for `lang`. Sentences are derived on the fly by [`derive_sentences`] (source Cues do not take part), and `doc.trans_align[lang]` is looked up for each sentence.
pub fn align_metrics(doc: &TranscriptDoc, lang: &str) -> AlignMetrics {
    let source_cues = derive_cues(doc, &crate::layout_profile::cue_params_for_doc(doc));
    let sentences = derive_sentences(doc, &source_cues);
    let trans_cues = crate::split::derive_trans_cues(doc, &sentences, lang);
    let row_stats = row_deficit_stats(doc, &sentences, lang, &source_cues, &trans_cues)
        .into_iter()
        .map(|stats| (stats.sentence.clone(), stats))
        .collect::<std::collections::BTreeMap<_, _>>();
    let entries = doc.trans_align.get(lang);
    let mut per_sentence = Vec::with_capacity(sentences.len());
    let mut seen_ids = BTreeSet::new();
    for sentence in &sentences {
        seen_ids.insert(sentence.id.as_str());
        let entry = entries.and_then(|table| table.get(&sentence.id));
        per_sentence.push(sentence_align_metrics(
            &sentence.id,
            sentence.word_indices.len(),
            entry,
            row_stats.get(&sentence.id),
        ));
    }
    let orphan_entries = entries
        .map(|table| {
            table
                .keys()
                .filter(|id| !seen_ids.contains(id.as_str()))
                .count()
        })
        .unwrap_or(0);

    let ratio = |numerator: usize, denominator: usize| -> f64 {
        if denominator == 0 {
            0.0
        } else {
            numerator as f64 / denominator as f64
        }
    };
    let aligned_rows: Vec<&SentenceAlignMetrics> =
        per_sentence.iter().filter(|row| row.aligned).collect();
    let aligned = aligned_rows.len();
    let many_to_one: Vec<&SentenceAlignMetrics> = aligned_rows
        .iter()
        .copied()
        .filter(|row| row.mode == Some(AlignMode::ManyToOne))
        .collect();
    let (src_total, src_covered, tgt_total, tgt_covered) =
        many_to_one
            .iter()
            .fold((0usize, 0usize, 0usize, 0usize), |(st, sc, tt, tc), row| {
                (
                    st + row.source_words,
                    sc + row.covered_source_words,
                    tt + row.target_chars,
                    tc + row.covered_target_chars,
                )
            });
    let crossing_sentences = aligned_rows
        .iter()
        .filter(|row| row.local_reorder_blocks > 0)
        .count();
    let local_reorder_blocks: usize = aligned_rows
        .iter()
        .map(|row| row.local_reorder_blocks)
        .sum();
    let boundaries: usize = aligned_rows.iter().map(|row| row.block_boundaries).sum();
    let inner_seams: usize = aligned_rows
        .iter()
        .filter(|row| row.blocks > 0)
        .map(|row| row.inner_candidate_seams)
        .sum();
    let degraded = many_to_one
        .iter()
        .filter(|row| row.correspondence == Some(Correspondence::Sentence))
        .count();
    let rewritten = aligned_rows
        .iter()
        .filter(|row| row.text_basis == Some(TextBasis::Display))
        .count();
    let independent = aligned_rows
        .iter()
        .filter(|row| row.mode == Some(AlignMode::Independent))
        .count();
    let total_blocks: usize = aligned_rows.iter().map(|row| row.blocks).sum();
    let weak_blocks: usize = aligned_rows.iter().map(|row| row.weak_blocks).sum();
    let translated = row_stats.len();
    let row_deficits = row_stats
        .values()
        .filter(|stats| stats.reason.is_some())
        .count();
    AlignMetrics {
        lang: lang.to_owned(),
        sentences: sentences.len(),
        aligned,
        orphan_entries,
        coverage_src: ratio(src_covered, src_total),
        coverage_tgt: ratio(tgt_covered, tgt_total),
        crossing_rate: ratio(crossing_sentences, aligned),
        local_reorder_blocks,
        safe_boundary_ratio: ratio(boundaries, boundaries + inner_seams),
        sentence_degrade_rate: ratio(degraded, many_to_one.len()),
        rewrite_rate: ratio(rewritten, aligned),
        independent_rate: ratio(independent, aligned),
        weak_block_rate: ratio(weak_blocks, total_blocks),
        row_deficit_rate: ratio(row_deficits, translated),
        per_sentence,
    }
}

fn sentence_align_metrics(
    id: &str,
    sentence_words: usize,
    entry: Option<&TransAlign>,
    row_stats: Option<&RowDeficitStats>,
) -> SentenceAlignMetrics {
    let source_rows = row_stats.map_or(0, |stats| stats.source_rows);
    let trans_cues = row_stats.map_or(0, |stats| stats.trans_cues);
    let max_dwell_sec = row_stats.map_or(0.0, |stats| stats.max_dwell_sec);
    let Some(entry) = entry else {
        return SentenceAlignMetrics {
            id: id.to_owned(),
            aligned: false,
            mode: None,
            correspondence: None,
            text_basis: None,
            source_words: sentence_words,
            target_chars: 0,
            blocks: 0,
            local_reorder_blocks: 0,
            weak_blocks: 0,
            covered_source_words: 0,
            covered_target_chars: 0,
            block_boundaries: 0,
            inner_candidate_seams: 0,
            aligner: None,
            source_rows,
            trans_cues,
            max_dwell_sec,
        };
    };
    let source_words = if entry.words.is_empty() {
        sentence_words
    } else {
        entry.words.len()
    };
    let piece_lens: Vec<usize> = entry
        .pieces
        .iter()
        .map(|piece| piece.text.chars().count())
        .collect();
    let target_chars: usize = piece_lens.iter().sum();

    let mut covered_source_words = 0usize;
    let mut covered_target_chars = 0usize;
    let mut boundaries = BTreeSet::new();
    if !entry.blocks.is_empty() {
        let mut src_covered = vec![false; source_words];
        let mut tgt_covered = vec![false; target_chars];
        for block in &entry.blocks {
            let (from, to) = block.src;
            for slot in src_covered.iter_mut().take(to + 1).skip(from) {
                *slot = true;
            }
            let (start, end) = block.tgt;
            for slot in tgt_covered.iter_mut().take(end).skip(start) {
                *slot = true;
            }
        }
        covered_source_words = src_covered.iter().filter(|&&covered| covered).count();
        covered_target_chars = tgt_covered.iter().filter(|&&covered| covered).count();
        for block in &entry.blocks[..entry.blocks.len() - 1] {
            boundaries.insert(block.tgt.1);
        }
    }

    // Candidate legal seams: atomize each piece, and convert seam positions to character indices in concat(pieces.text).
    let mut inner_candidate_seams = 0usize;
    let mut offset = 0usize;
    for (piece, &len) in entry.pieces.iter().zip(&piece_lens) {
        let atoms = atomize(&piece.text);
        let starts = atom_char_starts(&piece.text, &atoms);
        for cut in 1..atoms.len() {
            let previous = &atoms[cut - 1];
            let legal = seam_backed_by_whitespace(&piece.text, &atoms, cut)
                || ends_clause_punct(previous)
                || ends_sentence_final(previous);
            if !legal {
                continue;
            }
            let pos = offset + starts[cut];
            if !boundaries.contains(&pos) {
                inner_candidate_seams += 1;
            }
        }
        offset += len;
    }

    SentenceAlignMetrics {
        id: id.to_owned(),
        aligned: true,
        mode: Some(entry.mode),
        correspondence: Some(entry.correspondence()),
        text_basis: Some(entry.text_basis),
        source_words,
        target_chars,
        blocks: entry.blocks.len(),
        local_reorder_blocks: entry
            .blocks
            .iter()
            .filter(|block| block.flags.iter().any(|flag| flag == "local-reorder"))
            .count(),
        weak_blocks: entry
            .blocks
            .iter()
            .filter(|block| block.flags.iter().any(|flag| flag == "weak"))
            .count(),
        covered_source_words,
        covered_target_chars,
        block_boundaries: boundaries.len(),
        inner_candidate_seams,
        aligner: entry.aligner.clone(),
        source_rows,
        trans_cues,
        max_dwell_sec,
    }
}

// ---------------------------------------------------------------------------
// Golden alignment metrics (semantic scorer plan §11.3; strict / lax conventions)
// ---------------------------------------------------------------------------

/// A bead: a half-open source-word index range ↔ a half-open target `chars()` range.
///
/// It has the same meaning as a Vecalign or Bertalign bead, except that the units here are in-sentence words and target characters rather than sentences in a document. Both the golden side and the predicted side must be **contiguous, fully covering and monotonic** partitions ([`beads_contiguous`] can check this).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bead {
    pub src: std::ops::Range<usize>,
    pub tgt: std::ops::Range<usize>,
}

impl Bead {
    pub fn new(src: std::ops::Range<usize>, tgt: std::ops::Range<usize>) -> Self {
        Self { src, tgt }
    }

    fn is_empty(&self) -> bool {
        self.src.start >= self.src.end || self.tgt.start >= self.tgt.end
    }

    fn overlaps(&self, other: &Bead) -> bool {
        self.src.start < other.src.end
            && other.src.start < self.src.end
            && self.tgt.start < other.tgt.end
            && other.tgt.start < self.tgt.end
    }
}

/// Bead matching conventions (design §11.3 / §16.2 adopts the two conventions of Vecalign).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BeadMatch {
    /// Strict: a hit requires both sides' ranges to be **exactly equal** to some reference bead.
    Strict,
    /// Lax: a hit requires a **non-empty intersection** with some reference bead on both the source side and the target side.
    Lax,
}

/// Precision, recall and F1, with their counts. When a denominator is 0: record 1.0 if both sides are empty, otherwise 0.0.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prf {
    pub precision: f64,
    pub recall: f64,
    pub f1: f64,
    /// The number of hits on the predicted side (the precision numerator).
    pub matched_predicted: usize,
    /// The number of hits on the golden side (the recall numerator).
    pub matched_golden: usize,
    /// The number of predicted items counted (the precision denominator).
    pub predicted: usize,
    /// The number of golden items counted (the recall denominator).
    pub golden: usize,
}

impl Prf {
    fn new(
        matched_predicted: usize,
        predicted: usize,
        matched_golden: usize,
        golden: usize,
    ) -> Self {
        let rate = |numerator: usize, denominator: usize, other: usize| -> f64 {
            if denominator > 0 {
                numerator as f64 / denominator as f64
            } else if other == 0 {
                1.0
            } else {
                0.0
            }
        };
        let precision = rate(matched_predicted, predicted, golden);
        let recall = rate(matched_golden, golden, predicted);
        let f1 = if precision + recall > 0.0 {
            2.0 * precision * recall / (precision + recall)
        } else {
            0.0
        };
        Self {
            precision,
            recall,
            f1,
            matched_predicted,
            matched_golden,
            predicted,
            golden,
        }
    }
}

/// One-sided hit count: how many items in `probe` can find a match in `against` under `mode`.
fn bead_hits(probe: &[Bead], against: &[Bead], mode: BeadMatch) -> usize {
    probe
        .iter()
        .filter(|bead| !bead.is_empty())
        .filter(|bead| match mode {
            BeadMatch::Strict => against.iter().any(|other| *bead == other),
            BeadMatch::Lax => against.iter().any(|other| bead.overlaps(other)),
        })
        .count()
}

/// Bead P/R/F1 (design §11.3).
///
/// - `Strict`: a predicted bead counts as a hit only when both sides' ranges exactly match a golden bead. This is the strict convention of Vecalign and Bertalign.
/// - `Lax`: a hit counts as soon as both sides intersect. A prediction still scores when the local segmentation granularity differs but the correspondence is correct.
///
/// Empty beads (an empty range on either side) take no part in the statistics on either side. Precision uses the predictions as its denominator and recall uses the golden beads, each judged independently (the same as the reference implementation; under lax the two need not be equal).
pub fn bead_prf(golden: &[Bead], predicted: &[Bead], mode: BeadMatch) -> Prf {
    let predicted_total = predicted.iter().filter(|bead| !bead.is_empty()).count();
    let golden_total = golden.iter().filter(|bead| !bead.is_empty()).count();
    Prf::new(
        bead_hits(predicted, golden, mode),
        predicted_total,
        bead_hits(golden, predicted, mode),
        golden_total,
    )
}

/// Boundary F1 (design §11.3): the precision, recall and F1 of the set of boundary positions.
///
/// The source side passes source word indices and the target side passes target character indices. Duplicate values are deduplicated first. Whether to include the trivial boundaries at the two ends (0 and the full length) is up to the caller; [`beads_boundaries`] does not include them by default.
pub fn boundary_f1(golden_boundaries: &[usize], predicted_boundaries: &[usize]) -> Prf {
    let golden: BTreeSet<usize> = golden_boundaries.iter().copied().collect();
    let predicted: BTreeSet<usize> = predicted_boundaries.iter().copied().collect();
    let hit = golden.intersection(&predicted).count();
    Prf::new(hit, predicted.len(), hit, golden.len())
}

/// Path EM (design §11.3): the entire bead path is equal item by item.
pub fn path_exact_match(golden: &[Bead], predicted: &[Bead]) -> bool {
    golden == predicted
}

/// The internal boundaries of a bead sequence (source side, target side), excluding 0 and the ends. Used by [`boundary_f1`].
pub fn beads_boundaries(beads: &[Bead]) -> (Vec<usize>, Vec<usize>) {
    let src = beads
        .iter()
        .skip(1)
        .map(|bead| bead.src.start)
        .collect::<Vec<_>>();
    let tgt = beads
        .iter()
        .skip(1)
        .map(|bead| bead.tgt.start)
        .collect::<Vec<_>>();
    (src, tgt)
}

/// Whether a bead sequence satisfies "contiguous, fully covering and monotonic on both sides": starting from 0, each item connects to the next; the last item reaches `src_len` / `tgt_len` respectively; and each item has a non-empty range on both sides. An empty sequence holds only when both lengths are 0.
pub fn beads_contiguous(beads: &[Bead], src_len: usize, tgt_len: usize) -> bool {
    if beads.is_empty() {
        return src_len == 0 && tgt_len == 0;
    }
    let mut src_cursor = 0usize;
    let mut tgt_cursor = 0usize;
    for bead in beads {
        if bead.src.start != src_cursor || bead.tgt.start != tgt_cursor || bead.is_empty() {
            return false;
        }
        src_cursor = bead.src.end;
        tgt_cursor = bead.tgt.end;
    }
    src_cursor == src_len && tgt_cursor == tgt_len
}

/// Atom → its starting character index in `text` ([`atomize`] is lossless for non-whitespace characters). Returns `atoms.len() + 1` items; the last item is the character count of the text.
fn atom_char_starts(text: &str, atoms: &[String]) -> Vec<usize> {
    let mut want = Vec::with_capacity(atoms.len());
    let mut acc = 0usize;
    for atom in atoms {
        want.push(acc);
        acc += atom.chars().count();
    }
    let mut starts = Vec::with_capacity(atoms.len() + 1);
    let mut seen = 0usize;
    let mut next = 0usize;
    let mut total = 0usize;
    for (index, ch) in text.chars().enumerate() {
        total = index + 1;
        if ch.is_whitespace() {
            continue;
        }
        while next < want.len() && want[next] == seen {
            starts.push(index);
            next += 1;
        }
        seen += 1;
    }
    while starts.len() < atoms.len() {
        starts.push(total);
    }
    starts.push(total);
    starts
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::doc::{AlignBlock, DocEngine, DocMedia, Speaker, TransPiece, Word};
    use serde_json::Value;

    // ----- SubER -----

    fn block(start: f64, end: f64, lines: &[&str]) -> SubtitleBlock {
        SubtitleBlock {
            start,
            end,
            lines: lines.iter().map(|line| (*line).to_owned()).collect(),
        }
    }

    fn reference_en() -> Vec<SubtitleBlock> {
        vec![
            block(0.0, 2.0, &["Hello there,", "how are you?"]),
            block(2.5, 4.0, &["I am fine."]),
            block(4.5, 7.0, &["The plan we discussed", "yesterday is ready."]),
        ]
    }

    #[test]
    fn suber_identical_is_zero_and_pure_substitution_counts_words() {
        let reference = reference_en();
        assert_eq!(suber(&reference, &reference), 0.0);
        let hyp = vec![
            block(0.0, 2.0, &["Hello there,", "how are YOU?"]),
            block(2.5, 4.0, &["I am great."]),
            block(4.5, 7.0, &["The plan we discussed", "today is ready."]),
        ];
        // 20 reference tokens (15 words + 5 newlines). `YOU?` normalizes to the same token as `you?`, leaving only 2 substitutions.
        let breakdown = suber_breakdown(&hyp, &reference, SuberTokenization::Words);
        assert_eq!(breakdown.reference_tokens, 20);
        assert_eq!(breakdown.word_substitutions, 2);
        assert_eq!(breakdown.edits, 2);
        assert!((breakdown.score - 10.0).abs() < 1e-9);
    }

    #[test]
    fn suber_line_break_difference_costs_break_shifts_only() {
        let reference = reference_en();
        let hyp = vec![
            block(0.0, 2.0, &["Hello there, how", "are you?"]),
            block(2.5, 4.0, &["I am fine."]),
            block(4.5, 7.0, &["The plan we", "discussed yesterday is ready."]),
        ];
        let breakdown = suber_breakdown(&hyp, &reference, SuberTokenization::Words);
        assert_eq!(breakdown.shifts, 2);
        assert_eq!(breakdown.edits, 2);
        assert_eq!(
            breakdown.word_substitutions + breakdown.word_insertions + breakdown.word_deletions,
            0
        );
    }

    #[test]
    fn suber_time_shifted_block_without_overlap_cannot_match() {
        let reference = reference_en();
        let mut hyp = reference_en();
        hyp[1].start = 4.0;
        hyp[1].end = 4.4;
        let breakdown = suber_breakdown(&hyp, &reference, SuberTokenization::Words);
        // The middle block (3 words + `<eob>`) is counted once on each side: 4 deletions + 4 insertions.
        assert_eq!(breakdown.word_deletions + breakdown.break_deletions, 4);
        assert_eq!(breakdown.word_insertions + breakdown.break_insertions, 4);
        assert!((breakdown.score - 40.0).abs() < 1e-9);
    }

    #[test]
    fn suber_empty_inputs_follow_reference_conventions() {
        assert_eq!(suber(&[], &[]), 0.0);
        assert_eq!(suber(&[block(0.0, 1.0, &["x y"])], &[]), 100.0);
        assert_eq!(suber(&[], &reference_en()), 100.0);
    }

    #[test]
    fn suber_chars_splits_cjk_and_strips_unicode_punctuation() {
        let reference = vec![block(0.0, 2.0, &["我没去，", "因为我病了。"])];
        let hyp = vec![block(0.0, 2.0, &["我没走", "因为我病了"])];
        let breakdown = suber_breakdown(&hyp, &reference, SuberTokenization::Chars);
        // 8 characters + 2 newlines; only one substitution, 去→走 (go → walk).
        assert_eq!(breakdown.reference_tokens, 10);
        assert_eq!(breakdown.word_substitutions, 1);
        assert_eq!(breakdown.edits, 1);
        assert_eq!(
            tokenize_zh("已经ready了3.5天"),
            vec!["已", "经", "ready", "了", "3.5", "天"]
        );
        assert_eq!(tokenize_zh("价格$100"), vec!["价", "格", "$", "100"]);
    }

    /// Cross-checked case by case against the AppTek reference implementation (subtitle-edit-rate 0.4.0): hand-written cases plus random cases, with edit counts equal item by item and a score error < 1e-6.
    ///
    /// By default only cases with ≤ 6 subtitles run. In debug builds, the tercom shift search takes minutes on a case of 30 subtitles × 200 words. The full cross-check is in [`suber_matches_reference_implementation_fixture_full`] (`cargo test -p ccut-flow-core --release -- --ignored`).
    #[test]
    fn suber_matches_reference_implementation_fixture() {
        check_suber_fixture(Some(6));
    }

    #[test]
    #[ignore = "full set of 102 cases including large documents; takes minutes in debug, run with --release -- --ignored"]
    fn suber_matches_reference_implementation_fixture_full() {
        check_suber_fixture(None);
    }

    fn check_suber_fixture(max_blocks: Option<usize>) {
        let fixture: Value =
            serde_json::from_str(include_str!("../tests/fixtures/align/suber-cases.json")).unwrap();
        let cases = fixture["cases"].as_array().unwrap();
        assert!(cases.len() >= 36);
        let mut checked = 0usize;
        for case in cases {
            if let Some(max_blocks) = max_blocks {
                let blocks = case["hyp"]
                    .as_array()
                    .map_or(0, Vec::len)
                    .max(case["ref"].as_array().map_or(0, Vec::len));
                if blocks > max_blocks {
                    continue;
                }
            }
            checked += 1;
            let name = case["name"].as_str().unwrap();
            let hyp: Vec<SubtitleBlock> = serde_json::from_value(case["hyp"].clone()).unwrap();
            let reference: Vec<SubtitleBlock> =
                serde_json::from_value(case["ref"].clone()).unwrap();
            let tokenization = match case["tokenization"].as_str().unwrap() {
                "words" => SuberTokenization::Words,
                "chars" => SuberTokenization::Chars,
                other => panic!("unknown tokenization {other}"),
            };
            let expected: SuberBreakdown =
                serde_json::from_value(case["expected"].clone()).unwrap();
            let actual = suber_breakdown(&hyp, &reference, tokenization);
            assert!(
                (actual.score - expected.score).abs() < 1e-6,
                "{name}: score {} != {}",
                actual.score,
                expected.score
            );
            let mut actual_counts = actual.clone();
            actual_counts.score = expected.score;
            assert_eq!(actual_counts, expected, "{name}: edit counts differ");
            let plain = match tokenization {
                SuberTokenization::Words => suber(&hyp, &reference),
                SuberTokenization::Chars => suber_chars(&hyp, &reference),
            };
            assert!(
                (plain - expected.score).abs() < 1e-6,
                "{name}: wrapper score"
            );
        }
        assert!(checked >= 20, "fixture subset is too small: {checked}");
    }

    // ----- Alignment structure metrics -----

    fn word(id: &str, t0: f64, t1: f64, text: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    fn doc_with_three_sentences() -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 100.0,
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
        // Sentence 1 (8 words): I didn't go because I was sick.
        // Sentence 2 (4 words): It is very late.
        // Sentence 3 (3 words): See you tomorrow.
        let texts: [&[&str]; 3] = [
            &["I", "didn't", "go", "because", "I", "was", "sick."],
            &["It", "is", "very", "late."],
            &["See", "you", "tomorrow."],
        ];
        let mut t = 0.0;
        let mut index = 0;
        for sentence in texts {
            for text in sentence {
                doc.words
                    .push(word(&format!("g1.{index}"), t, t + 0.4, text));
                t += 0.5;
                index += 1;
            }
            t += 0.5;
        }
        doc
    }

    #[test]
    fn align_metrics_reports_each_rate_on_hand_built_doc() {
        let mut doc = doc_with_three_sentences();
        let sentences = derive_sentences(&doc, &[]);
        assert_eq!(sentences.len(), 3);
        let ids: Vec<String> = sentences.iter().map(|s| s.id.clone()).collect();
        let words_of = |sentence: &crate::sentence::Sentence| -> Vec<String> {
            sentence
                .word_indices
                .iter()
                .map(|&i| doc.words[i].id.clone())
                .collect()
        };

        // Sentence 1: block-level correspondence with two blocks; the second block is local-reorder. Block 1 covers 0..=2, and block 2 covers 3..=6.
        let mut entry1 = TransAlign::new(
            AlignMode::ManyToOne,
            words_of(&sentences[0]),
            vec![
                TransPiece {
                    from: Some(0),
                    to: Some(2),
                    text: "我没去，".to_owned(),
                },
                TransPiece {
                    from: Some(3),
                    to: Some(6),
                    text: "因为我病了。".to_owned(),
                },
            ],
        );
        entry1.correspondence = Some(Correspondence::Block);
        entry1.text_basis = TextBasis::Display;
        entry1.blocks = vec![
            AlignBlock {
                src: (0, 2),
                tgt: (0, 4),
                confidence: Some(0.9),
                flags: vec![],
            },
            AlignBlock {
                src: (3, 6),
                tgt: (4, 10),
                confidence: Some(0.4),
                flags: vec!["local-reorder".to_owned(), "weak".to_owned()],
            },
        ];
        // Sentence 2: whole-sentence correspondence; one block covers the whole sentence. The translation has one in-block candidate seam (after “，”).
        let mut entry2 = TransAlign::new(
            AlignMode::ManyToOne,
            words_of(&sentences[1]),
            vec![TransPiece {
                from: Some(0),
                to: Some(3),
                text: "已经，很晚了。".to_owned(),
            }],
        );
        entry2.correspondence = Some(Correspondence::Sentence);
        entry2.blocks = vec![AlignBlock {
            src: (0, 3),
            tgt: (0, 7),
            confidence: Some(0.2),
            flags: vec![],
        }];
        // Sentence 3: independent, with no blocks.
        let entry3 = TransAlign::new(
            AlignMode::Independent,
            Vec::new(),
            vec![TransPiece {
                from: None,
                to: None,
                text: "明天见。".to_owned(),
            }],
        );
        let mut table = std::collections::BTreeMap::new();
        table.insert(ids[0].clone(), entry1);
        table.insert(ids[1].clone(), entry2);
        table.insert(ids[2].clone(), entry3);
        table.insert(
            "s-stale".to_owned(),
            TransAlign::new(AlignMode::Independent, Vec::new(), Vec::new()),
        );
        doc.trans_align.insert("zh".to_owned(), table);

        let metrics = align_metrics(&doc, "zh");
        assert_eq!(metrics.lang, "zh");
        assert_eq!(metrics.sentences, 3);
        assert_eq!(metrics.aligned, 3);
        assert_eq!(metrics.orphan_entries, 1);
        // Coverage counts only manyToOne: sentence 1 has 7/7 words and 10/10 characters; sentence 2 has 4/4 and 7/7.
        assert!((metrics.coverage_src - 1.0).abs() < 1e-9);
        assert!((metrics.coverage_tgt - 1.0).abs() < 1e-9);
        assert!((metrics.crossing_rate - 1.0 / 3.0).abs() < 1e-9);
        assert_eq!(metrics.local_reorder_blocks, 1);
        // Block boundary 1 (sentence 1, position 4); in-block candidate seam 1 (after “已经，” in sentence 2) → 1/2.
        assert!((metrics.safe_boundary_ratio - 0.5).abs() < 1e-9);
        assert!((metrics.sentence_degrade_rate - 0.5).abs() < 1e-9);
        assert!((metrics.rewrite_rate - 1.0 / 3.0).abs() < 1e-9);
        assert!((metrics.independent_rate - 1.0 / 3.0).abs() < 1e-9);
        assert!((metrics.weak_block_rate - 1.0 / 3.0).abs() < 1e-9);

        let row1 = &metrics.per_sentence[0];
        assert_eq!(row1.blocks, 2);
        assert_eq!(row1.block_boundaries, 1);
        assert_eq!(row1.inner_candidate_seams, 0);
        assert_eq!(row1.covered_source_words, 7);
        assert_eq!(row1.covered_target_chars, 10);
        assert_eq!(row1.text_basis, Some(TextBasis::Display));
        let row2 = &metrics.per_sentence[1];
        assert_eq!(row2.correspondence, Some(Correspondence::Sentence));
        assert_eq!(row2.inner_candidate_seams, 1);
        let row3 = &metrics.per_sentence[2];
        assert_eq!(row3.mode, Some(AlignMode::Independent));
        assert_eq!(row3.blocks, 0);
        assert_eq!(row3.covered_source_words, 0);
        assert_eq!(row3.source_words, 3);

        // camelCase serialization, for direct output by `ccut check`.
        let json = serde_json::to_value(&metrics).unwrap();
        assert!(json.get("coverageSrc").is_some());
        assert!(json.get("safeBoundaryRatio").is_some());
        // M8.2: the two scorer conventions were retired along with the local alignment scorer.
        assert!(json.get("scorerDirectRate").is_none());
        assert!(json.get("llmFallbackRate").is_none());
        // `corridorPruned` exists only in the `--align-audit` artifact. The transcript has no corridor-pruning count, so omitting the field is more honest than giving 0.
        assert!(json.get("corridorPruned").is_none());
        assert_eq!(json["perSentence"][0]["localReorderBlocks"], 1);
    }

    /// After M8.2, `semantic-span-dp/1:…` entries are no longer produced, but ones already in old projects must stay readable: `aligner` appears as-is in the per-sentence rows, and the metrics neither error on it nor rewrite it.
    #[test]
    fn legacy_semantic_span_dp_entries_stay_readable() {
        let mut doc = doc_with_three_sentences();
        let ids: Vec<String> = derive_sentences(&doc, &[])
            .iter()
            .map(|sentence| sentence.id.clone())
            .collect();
        let mut table = std::collections::BTreeMap::new();
        for (id, aligner) in [
            (
                &ids[0],
                "semantic-span-dp/1:qwen3-embedding-0.6b@r1+qwen3-reranker-0.6b@r2#identity-v1",
            ),
            (
                &ids[1],
                "llm-chunk+anchor/1+semantic-span-dp/1:qwen3-embedding-0.6b@r1#identity-v1",
            ),
            (&ids[2], "llm-chunk+anchor/1"),
        ] {
            let mut entry = TransAlign::new(
                AlignMode::ManyToOne,
                Vec::new(),
                vec![TransPiece {
                    from: None,
                    to: None,
                    text: "译文。".to_owned(),
                }],
            );
            entry.aligner = Some(aligner.to_owned());
            table.insert(id.clone(), entry);
        }
        doc.trans_align.insert("zh".to_owned(), table);

        let metrics = align_metrics(&doc, "zh");
        assert_eq!(metrics.aligned, 3);
        assert_eq!(
            metrics.per_sentence[0].aligner.as_deref(),
            Some("semantic-span-dp/1:qwen3-embedding-0.6b@r1+qwen3-reranker-0.6b@r2#identity-v1")
        );
    }

    #[test]
    fn align_metrics_partial_coverage_and_no_alignment() {
        let mut doc = doc_with_three_sentences();
        assert_eq!(align_metrics(&doc, "zh").aligned, 0);
        let sentences = derive_sentences(&doc, &[]);
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            sentences[0]
                .word_indices
                .iter()
                .map(|&i| doc.words[i].id.clone())
                .collect(),
            vec![TransPiece {
                from: Some(0),
                to: Some(6),
                text: "我没去因为我病了".to_owned(),
            }],
        );
        // The block covers only the first 3 words and the first 3 characters.
        entry.blocks = vec![AlignBlock {
            src: (0, 2),
            tgt: (0, 3),
            confidence: None,
            flags: vec![],
        }];
        let mut table = std::collections::BTreeMap::new();
        table.insert(sentences[0].id.clone(), entry);
        doc.trans_align.insert("zh".to_owned(), table);
        let metrics = align_metrics(&doc, "zh");
        assert_eq!(metrics.aligned, 1);
        assert!((metrics.coverage_src - 3.0 / 7.0).abs() < 1e-9);
        assert!((metrics.coverage_tgt - 3.0 / 8.0).abs() < 1e-9);
        assert_eq!(metrics.safe_boundary_ratio, 0.0);
        assert_eq!(metrics.per_sentence[1].aligned, false);
    }

    // ----- Golden alignment metrics -----

    fn bead(src: (usize, usize), tgt: (usize, usize)) -> Bead {
        Bead::new(src.0..src.1, tgt.0..tgt.1)
    }

    /// Golden: three blocks; prediction: exactly identical.
    fn golden_three() -> Vec<Bead> {
        vec![
            bead((0, 2), (0, 4)),
            bead((2, 5), (4, 9)),
            bead((5, 7), (9, 13)),
        ]
    }

    #[test]
    fn bead_prf_perfect_match_scores_one() {
        let golden = golden_three();
        let strict = bead_prf(&golden, &golden, BeadMatch::Strict);
        assert_eq!(strict.precision, 1.0);
        assert_eq!(strict.recall, 1.0);
        assert_eq!(strict.f1, 1.0);
        assert_eq!(strict.predicted, 3);
        assert_eq!(strict.golden, 3);
        let lax = bead_prf(&golden, &golden, BeadMatch::Lax);
        assert_eq!(lax.f1, 1.0);
    }

    /// The prediction splits golden's middle block into two halves. Strict accepts only the first and last blocks; lax accepts all of them.
    #[test]
    fn bead_prf_strict_and_lax_differ_on_split_block() {
        let golden = golden_three();
        let predicted = vec![
            bead((0, 2), (0, 4)),
            bead((2, 4), (4, 7)),
            bead((4, 5), (7, 9)),
            bead((5, 7), (9, 13)),
        ];
        let strict = bead_prf(&golden, &predicted, BeadMatch::Strict);
        assert_eq!(strict.matched_predicted, 2);
        assert_eq!(strict.matched_golden, 2);
        assert!((strict.precision - 0.5).abs() < 1e-9);
        assert!((strict.recall - 2.0 / 3.0).abs() < 1e-9);
        let lax = bead_prf(&golden, &predicted, BeadMatch::Lax);
        assert_eq!(lax.matched_predicted, 4);
        assert_eq!(lax.matched_golden, 3);
        assert_eq!(lax.precision, 1.0);
        assert_eq!(lax.recall, 1.0);
        assert_eq!(lax.f1, 1.0);
        assert!(lax.f1 > strict.f1);
    }

    /// Out-of-order correspondence: the predicted block and the golden block have no intersection on either side ⇒ strict and lax are both 0.
    #[test]
    fn bead_prf_lax_still_zero_without_overlap() {
        let golden = vec![bead((0, 2), (0, 4)), bead((2, 4), (4, 8))];
        let predicted = vec![bead((0, 2), (4, 8)), bead((2, 4), (0, 4))];
        for mode in [BeadMatch::Strict, BeadMatch::Lax] {
            let prf = bead_prf(&golden, &predicted, mode);
            assert_eq!(prf.matched_predicted, 0, "{mode:?}");
            assert_eq!(prf.f1, 0.0, "{mode:?}");
        }
    }

    /// Whole-sentence degradation (a single block) against a multi-block golden: lax reaches full recall, but precision remains limited.
    #[test]
    fn bead_prf_sentence_level_prediction() {
        let golden = golden_three();
        let predicted = vec![bead((0, 7), (0, 13))];
        let strict = bead_prf(&golden, &predicted, BeadMatch::Strict);
        assert_eq!(strict.f1, 0.0);
        let lax = bead_prf(&golden, &predicted, BeadMatch::Lax);
        assert_eq!(lax.precision, 1.0);
        assert_eq!(lax.recall, 1.0);
    }

    #[test]
    fn bead_prf_empty_sides() {
        let both_empty = bead_prf(&[], &[], BeadMatch::Strict);
        assert_eq!(both_empty.precision, 1.0);
        assert_eq!(both_empty.recall, 1.0);
        let no_prediction = bead_prf(&golden_three(), &[], BeadMatch::Lax);
        assert_eq!(no_prediction.precision, 0.0);
        assert_eq!(no_prediction.recall, 0.0);
    }

    #[test]
    fn boundary_f1_counts_shared_positions() {
        let prf = boundary_f1(&[2, 5], &[2, 4, 5]);
        assert_eq!(prf.golden, 2);
        assert_eq!(prf.predicted, 3);
        assert_eq!(prf.recall, 1.0);
        assert!((prf.precision - 2.0 / 3.0).abs() < 1e-9);
        assert!((prf.f1 - 0.8).abs() < 1e-9);
    }

    #[test]
    fn boundary_f1_dedups_and_handles_empty() {
        let deduped = boundary_f1(&[2, 2, 5], &[5, 2]);
        assert_eq!(deduped.golden, 2);
        assert_eq!(deduped.predicted, 2);
        assert_eq!(deduped.f1, 1.0);
        // Whole-sentence degradation: the prediction has no internal boundaries.
        let none = boundary_f1(&[2, 5], &[]);
        assert_eq!(none.precision, 0.0);
        assert_eq!(none.recall, 0.0);
        assert_eq!(none.f1, 0.0);
        assert_eq!(boundary_f1(&[], &[]).f1, 1.0);
    }

    #[test]
    fn boundary_f1_uses_bead_boundaries() {
        let (src, tgt) = beads_boundaries(&golden_three());
        assert_eq!(src, vec![2, 5]);
        assert_eq!(tgt, vec![4, 9]);
        assert_eq!(boundary_f1(&src, &src).f1, 1.0);
        assert_eq!(beads_boundaries(&[]).0, Vec::<usize>::new());
    }

    #[test]
    fn path_exact_match_requires_identical_sequence() {
        let golden = golden_three();
        assert!(path_exact_match(&golden, &golden.clone()));
        let mut shifted = golden.clone();
        shifted[1] = bead((2, 4), (4, 9));
        shifted.insert(2, bead((4, 5), (9, 9)));
        assert!(!path_exact_match(&golden, &shifted));
    }

    #[test]
    fn path_exact_match_is_order_sensitive() {
        let golden = golden_three();
        let mut reversed = golden.clone();
        reversed.reverse();
        assert!(!path_exact_match(&golden, &reversed));
        assert!(path_exact_match(&[], &[]));
    }

    #[test]
    fn beads_contiguous_checks_full_coverage() {
        assert!(beads_contiguous(&golden_three(), 7, 13));
        assert!(!beads_contiguous(&golden_three(), 8, 13));
        assert!(!beads_contiguous(&golden_three(), 7, 14));
        assert!(!beads_contiguous(
            &[bead((0, 2), (0, 4)), bead((3, 5), (4, 9))],
            5,
            9
        ));
        assert!(beads_contiguous(&[], 0, 0));
        assert!(!beads_contiguous(&[], 1, 0));
    }
}
