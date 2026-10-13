//! Minimal monotonic alignment blocks (align block design §4.2–§4.6; pure functions, zero I/O, zero LLM).
//!
//! The display segmentation of a translated sentence is split into four deterministic steps:
//!
//! 1. **Alignment edges** ([`AlignEdge`]): source word index ↔ translation character range, produced by layering the [`WordAligner`]
//!    implementations. [`AnchorAligner`] only produces `hard` edges for numbers, dates, URLs, verbatim Latin words and locked terms; LLM block-level alignment (M3) and model aligners (M5) are injected separately, and [`merge_edges`] handles merging with hard-edge priority.
//! 2. **Safe boundaries and minimal monotonic blocks** ([`safe_boundaries`] / [`minimal_monotonic_blocks`]): bilingual boundaries are set only at legal target-language seams that no high-confidence alignment edge crosses (`leftMax(k) < rightMin(k)`); the span between adjacent safe boundaries is one block, and crossed word order falls automatically within the same block.
//! 3. **Bilingual DP** ([`bilingual_dp`]): blocks are atoms; `pieces` = unions of consecutive blocks, constrained at once by target-language layout, source-language layout, the shared time window, and the seam quality on both sides.
//! 4. **Decision tree** ([`plan_sentence`]): all blocks ≤ hard and the DP has a solution ⇒ block-level correspondence; some block > hard ⇒ [`PlanOutcome::NeedsRewrite`] (monotonizing rewrite is up to the caller); confidence insufficient or no solution ⇒ sentence-level correspondence ([`sentence_level_entry`]).
//!
//! Time allocation is not in this module: after `pieces.from/to` is stored, [`crate::split::derive_trans_cues`] derives, smooths and fills it from word times; this module does not repeat that.
//!
//! Coordinate convention: all target-side positions inside this module are **character indices into the `target` text passed in** (counted by `chars()`, not bytes). Only when writing to [`TransAlign`] are they converted, per the [`AlignBlock`] contract, into character ranges over `concat(pieces.text)`.

use std::collections::{BTreeMap, BTreeSet};
use std::ops::Range;

use crate::atomize::{
    atomize, clause_end_char, join_word_texts, seam_backed_by_whitespace, sentence_end,
};
use crate::doc::{
    AlignBlock, AlignMode, Correspondence, TextBasis, TransAlign, TransPiece, TranscriptDoc,
};
use crate::fingerprint::fingerprint_strings;
use crate::seam::{
    MIN_CUE_DISPLAY_SEC, SeamLintClass, SeamLintKind, cjk_midword_boundary, ends_dangling,
    ends_list_separator, is_objective_blocking, lint_pieces, source_boundary_strength,
};
use crate::sentence::Sentence;
use crate::split::{
    BLOCKING_SEAM_PENALTY, OVER_FIT_PENALTY, TransParams, exceeds_one_line_fit, primary_subtag,
    seam_penalty, target_cps_chars, target_required_seconds,
};

/// Default soft-edge confidence threshold τ: soft edges below it do not take part in safe-boundary decisions (design §4.3).
pub const DEFAULT_EDGE_TAU: f32 = 0.5;
/// Default sentence-level fallback threshold τ_s: when the confidence of the whole plan is below it, the plan switches to sentence-level correspondence (design §4.5).
pub const DEFAULT_SENTENCE_TAU: f32 = 0.35;
/// Minimum inter-word silence (seconds) that counts as a "pause" when choosing source-side break points; same threshold as the ⏸ pause marker.
pub const SOURCE_PAUSE_SEC: f64 = 0.6;
/// When the unaligned source words between safe boundaries reach this many, the break is chosen proportionally rather than by "merging into the previous block": one or two unaligned words are articles or omissions, while a long run of unaligned words is missing evidence.
const LONG_UNALIGNED_RUN: usize = 3;
/// Source identifier of [`AnchorAligner`].
pub const ANCHOR_ALIGNER_TAG: &str = "anchor/1";

/// One alignment edge: the `src`-th anchored word in the sentence ↔ character range `tgt` in the target text.
#[derive(Debug, Clone, PartialEq)]
pub struct AlignEdge {
    pub src: usize,
    pub tgt: Range<usize>,
    /// Confidence 0..=1; `hard` edges always count as 1.0 in decisions.
    pub weight: f32,
    /// Hard anchor (deterministic evidence such as numbers, terms, verbatim Latin).
    pub hard: bool,
}

impl AlignEdge {
    pub fn hard(src: usize, tgt: Range<usize>) -> Self {
        Self {
            src,
            tgt,
            weight: 1.0,
            hard: true,
        }
    }

    pub fn soft(src: usize, tgt: Range<usize>, weight: f32) -> Self {
        Self {
            src,
            tgt,
            weight,
            hard: false,
        }
    }

    /// Whether this edge takes part in safe-boundary decisions: hard edges always do; soft edges need `weight >= tau`.
    pub fn counted(&self, tau: f32) -> bool {
        self.hard || self.weight >= tau
    }

    fn effective_weight(&self) -> f32 {
        if self.hard { 1.0 } else { self.weight }
    }
}

/// Bilingual locked term pair (brief glossary / locked terms).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TermPair {
    pub source: String,
    pub target: String,
}

/// Aligner context.
#[derive(Debug, Clone, Default)]
pub struct AlignCtx {
    /// Source language (BCP-47).
    pub source_lang: String,
    /// Target language (BCP-47).
    pub lang: String,
    /// Locked term pair: source word group ↔ target literal string.
    pub protected_terms: Vec<TermPair>,
}

/// Abstraction over alignment-edge sources (design §4.2). Implementations layer by confidence; hard edges take priority.
pub trait WordAligner {
    fn align(&self, src_words: &[&str], target: &str, ctx: &AlignCtx) -> Vec<AlignEdge>;
}

/// Deterministic anchor aligner: numbers (including `2028` / `50%` / `3.5` / `1,000`), dates, URLs and emails, Latin words appearing verbatim in the translation, and locked term pairs ⇒ `hard` edges.
///
/// Matching discipline mirrors `engines::align::unique_anchor_bindings`: a conclusion is drawn only when a token has exactly one hit on the source side **and** exactly one on the target side. Repeated tokens cannot determine their correspondence and are left to the upper-level aligner. When term source spans overlap, the longer phrase wins; on equal length both abstain.
#[derive(Debug, Clone, Copy, Default)]
pub struct AnchorAligner;

impl WordAligner for AnchorAligner {
    fn align(&self, src_words: &[&str], target: &str, ctx: &AlignCtx) -> Vec<AlignEdge> {
        let target_chars: Vec<char> = target.chars().collect();
        let mut edges = term_edges(src_words, target, &ctx.protected_terms);
        let target_cjk = is_cjk_target(&ctx.lang);
        // Each source word produces at most one token anchor; collect candidates first, then filter by uniqueness.
        let mut candidates: Vec<(usize, String)> = Vec::new();
        for (index, word) in src_words.iter().enumerate() {
            let token = anchor_token(word);
            if token.is_empty() {
                continue;
            }
            if is_numeric_anchor(&token)
                || is_url_anchor(&token)
                || is_latin_anchor(&token, target_cjk, index == 0)
            {
                candidates.push((index, token));
            }
        }
        for (index, token) in &candidates {
            if candidates
                .iter()
                .filter(|(_, other)| other == token)
                .count()
                != 1
            {
                continue;
            }
            let hits = whole_token_occurrences(&target_chars, token);
            if hits.len() != 1 {
                continue;
            }
            let start = hits[0];
            let range = start..start + token.chars().count();
            // Source words already covered by a term edge do not emit edges again (the term edge is longer and more precise).
            if edges.iter().any(|edge| edge.src == *index) {
                continue;
            }
            edges.push(AlignEdge::hard(*index, range));
        }
        edges.sort_by_key(|edge| (edge.src, edge.tgt.start, edge.tgt.end));
        edges
    }
}

fn is_cjk_target(lang: &str) -> bool {
    matches!(primary_subtag(lang).as_str(), "zh" | "ja" | "ko" | "th")
}

/// Anchor token after stripping leading and trailing non-content punctuation from a source word (`2028,` → `2028`, `(GPU)` → `GPU`, `50%.` → `50%`). Internal characters are kept as-is (`3.5`, `1,000`, `https://a.b/c`).
fn anchor_token(word: &str) -> String {
    let keep = |ch: char| ch.is_alphanumeric() || matches!(ch, '%' | '$' | '€' | '£' | '¥');
    word.trim()
        .trim_start_matches(|ch: char| !keep(ch))
        .trim_end_matches(|ch: char| !keep(ch))
        .to_owned()
}

fn is_numeric_anchor(token: &str) -> bool {
    token.chars().any(|ch| ch.is_ascii_digit())
        && token.chars().all(|ch| {
            ch.is_ascii_digit()
                || matches!(
                    ch,
                    '.' | ',' | '%' | ':' | '/' | '-' | '+' | '$' | '€' | '£' | '¥'
                )
        })
}

fn is_url_anchor(token: &str) -> bool {
    if token.contains("://") || token.starts_with("www.") {
        return true;
    }
    if token.contains('@') && token.contains('.') {
        return true;
    }
    let segments: Vec<&str> = token.split('.').filter(|seg| !seg.is_empty()).collect();
    segments.len() >= 2
        && segments.iter().all(|seg| {
            seg.chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '/'))
        })
        && segments.last().is_some_and(|seg| {
            (2..=6).contains(&seg.len()) && seg.chars().all(|c| c.is_ascii_alphabetic())
        })
        && segments[0].chars().any(|ch| ch.is_ascii_alphabetic())
        && segments[0].len() >= 2
}

/// Test for verbatim Latin fragments. In a CJK target language, any Latin word is a foreign verbatim fragment. A Latin target language only accepts proper-noun forms (containing digits, a non-initial capital, all caps, or a mid-sentence capitalized initial), to avoid treating homographic function words (`In` / `no`) as hard anchors.
fn is_latin_anchor(token: &str, target_cjk: bool, sentence_initial: bool) -> bool {
    let chars: Vec<char> = token.chars().collect();
    if chars.len() < 2
        || !chars
            .iter()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '\''))
        || !chars.iter().any(|ch| ch.is_ascii_alphabetic())
    {
        return false;
    }
    if target_cjk {
        return true;
    }
    let has_digit = chars.iter().any(|ch| ch.is_ascii_digit());
    let inner_upper = chars[1..].iter().any(|ch| ch.is_ascii_uppercase());
    let all_upper = chars.iter().all(|ch| !ch.is_ascii_lowercase());
    let capitalized = chars[0].is_ascii_uppercase();
    has_digit || inner_upper || all_upper || (capitalized && !sentence_initial)
}

/// Whole-word hit position of `token` in the target character stream: the characters before and after must not be adjacent alphanumerics, nor a decimal point or thousands separator adjacent to digits (`2028` does not match in `2028.5` or `12,028`).
fn whole_token_occurrences(target: &[char], token: &str) -> Vec<usize> {
    let needle: Vec<char> = token.chars().collect();
    if needle.is_empty() || needle.len() > target.len() {
        return Vec::new();
    }
    let boundary = |at: usize, next: Option<usize>| -> bool {
        let Some(&ch) = target.get(at) else {
            return true;
        };
        if ch.is_ascii_alphanumeric() {
            return false;
        }
        !(matches!(ch, '.' | ',')
            && next
                .and_then(|index| target.get(index))
                .is_some_and(|ch| ch.is_ascii_digit()))
    };
    (0..=target.len() - needle.len())
        .filter(|&start| {
            let end = start + needle.len();
            target[start..end] == needle[..]
                && start
                    .checked_sub(1)
                    .is_none_or(|before| boundary(before, before.checked_sub(1)))
                && boundary(end, Some(end + 1))
        })
        .collect()
}

fn lexemes(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|ch: char| !ch.is_alphanumeric() && ch != '\'' && ch != '-')
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Unique hit window of a source word group in the word sequence (matched on the normalized lexeme sequence).
fn source_phrase_matches(words: &[&str], phrase: &str) -> Vec<(usize, usize)> {
    let phrase_tokens = lexemes(phrase);
    if phrase_tokens.is_empty() {
        return Vec::new();
    }
    let flattened: Vec<(usize, String)> = words
        .iter()
        .enumerate()
        .flat_map(|(index, word)| lexemes(word).into_iter().map(move |token| (index, token)))
        .collect();
    if phrase_tokens.len() > flattened.len() {
        return Vec::new();
    }
    flattened
        .windows(phrase_tokens.len())
        .filter(|window| window.iter().map(|(_, t)| t).eq(phrase_tokens.iter()))
        .map(|window| (window[0].0, window[window.len() - 1].0))
        .collect()
}

/// Locked term pair ⇒ hard edges (each word in the source window → the target literal's character range).
fn term_edges(src_words: &[&str], target: &str, terms: &[TermPair]) -> Vec<AlignEdge> {
    struct Binding {
        span: (usize, usize),
        tgt: Range<usize>,
    }
    let mut bindings: Vec<Binding> = Vec::new();
    for term in terms {
        if term.source.trim().is_empty() || term.target.is_empty() {
            continue;
        }
        let sources = source_phrase_matches(src_words, &term.source);
        if sources.len() != 1 {
            continue;
        }
        let targets: Vec<usize> = target
            .match_indices(term.target.as_str())
            .map(|(byte, _)| target[..byte].chars().count())
            .collect();
        if targets.len() != 1 {
            continue;
        }
        let tgt = targets[0]..targets[0] + term.target.chars().count();
        if bindings
            .iter()
            .any(|existing| existing.span == sources[0] && existing.tgt == tgt)
        {
            continue;
        }
        bindings.push(Binding {
            span: sources[0],
            tgt,
        });
    }
    // Source-span overlap disambiguation: the longer phrase wins; on equal length both abstain (mirrors unique_anchor_bindings).
    let mut keep = vec![true; bindings.len()];
    for first in 0..bindings.len() {
        for second in first + 1..bindings.len() {
            let a = bindings[first].span;
            let b = bindings[second].span;
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
    bindings
        .into_iter()
        .zip(keep)
        .filter(|(_, kept)| *kept)
        .flat_map(|(binding, _)| {
            (binding.span.0..=binding.span.1)
                .map(move |src| AlignEdge::hard(src, binding.tgt.clone()))
        })
        .collect()
}

/// Merging of multi-layer alignment edges: empty ranges are dropped; on the same source word or the same target range, hard edges beat soft edges; identical edges keep only the highest-weight one. Output is sorted by `(src, tgt)`, so the result is deterministic.
pub fn merge_edges(layers: Vec<Vec<AlignEdge>>) -> Vec<AlignEdge> {
    let mut all: Vec<AlignEdge> = layers
        .into_iter()
        .flatten()
        .filter(|edge| edge.tgt.start < edge.tgt.end)
        .collect();
    all.sort_by(|a, b| {
        b.hard
            .cmp(&a.hard)
            .then(b.weight.total_cmp(&a.weight))
            .then(a.src.cmp(&b.src))
            .then(a.tgt.start.cmp(&b.tgt.start))
            .then(a.tgt.end.cmp(&b.tgt.end))
    });
    let mut merged: Vec<AlignEdge> = Vec::with_capacity(all.len());
    for edge in all {
        let duplicate = merged
            .iter()
            .any(|kept| kept.src == edge.src && kept.tgt == edge.tgt);
        if duplicate {
            continue;
        }
        let dominated = !edge.hard
            && merged
                .iter()
                .any(|kept| kept.hard && (kept.src == edge.src || kept.tgt == edge.tgt));
        if dominated {
            continue;
        }
        merged.push(edge);
    }
    merged.sort_by_key(|edge| (edge.src, edge.tgt.start, edge.tgt.end, !edge.hard));
    merged
}

/// Anchored word within a sentence (an item of [`TransAlign::words`]): the id is stored, the text is used for source-seam judgment, and the time is used for pause and time-window costs.
#[derive(Debug, Clone, PartialEq)]
pub struct AnchorWord {
    pub id: String,
    pub text: String,
    pub t0: f64,
    pub t1: f64,
    /// The "glue to previous" marker in the script ([`crate::doc::Word::glue`]).
    pub glue: bool,
}

impl crate::atomize::JoinWord for AnchorWord {
    fn join_text(&self) -> &str {
        &self.text
    }
    fn glued(&self) -> bool {
        self.glue
    }
}

/// Candidate target-language cut point: character position `pos` (cut before that position; whitespace goes to the left side) and seam penalty (following the `split.rs` scale: sentence end 0 < clause punctuation 0.3 < inter-word space 0.8 < no seam [`crate::split::NO_SEAM_PENALTY`]; CJK intra-word boundaries and blocking-level fragments get an extra [`BLOCKING_SEAM_PENALTY`]). Seams with objective defects and the interior of locked terms **do not enter candidates**.
#[derive(Debug, Clone, PartialEq)]
pub struct CutCandidate {
    pub pos: usize,
    pub seam_cost: f64,
}

/// The two piles of candidates after snapping model cut hints ([`hinted_cut_candidates`]): `admitted` are those the lint lets through (clean, or carrying only a dangling tail); `refused` are those rejected by the objective-defect lint (weak tail / sticky head / incomplete noun phrase / list separator / unclosed delimiter). The latter are used only within block splitting, as the [`SplitSeam::HintedRefused`] tier, ranked before character-level seams (§8.9). Hints inside locked terms go into neither pile.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct HintedCuts {
    pub admitted: Vec<CutCandidate>,
    pub refused: Vec<CutCandidate>,
}

/// Starting character index in `target` of each atom (lossless for non-whitespace characters in [`atomize`], so filling them back one by one suffices). Returns `n + 1` items; the last item is the number of characters in the text.
fn atom_start_positions(target: &str, atoms: &[String]) -> Vec<usize> {
    let mut starts = Vec::with_capacity(atoms.len() + 1);
    let mut want: Vec<usize> = Vec::with_capacity(atoms.len());
    let mut acc = 0usize;
    for atom in atoms {
        want.push(acc);
        acc += atom.chars().count();
    }
    let mut seen = 0usize;
    let mut next = 0usize;
    let mut total = 0usize;
    for (index, ch) in target.chars().enumerate() {
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

/// Target-language candidate cut point (design §4.3).
pub fn target_cut_candidates(
    target: &str,
    lang: &str,
    params: &TransParams,
    protected_terms: &[String],
) -> Vec<CutCandidate> {
    let atoms = atomize(target);
    if atoms.len() < 2 {
        return Vec::new();
    }
    let starts = atom_start_positions(target, &atoms);
    let protected = protected_spans(target, lang, params, protected_terms);
    (1..atoms.len())
        .filter_map(|j| cut_verdict(target, &atoms, &starts, j, lang, params, &protected))
        .filter(|verdict| !verdict.refused && !verdict.dangling)
        .map(|verdict| verdict.candidate)
        .collect()
}

/// Cut points the model itself gave (block boundaries, segment markers copied into the translation; see [`crate::filepipe::lines::cut_hints`]) serve as second-choice candidates for splitting within a block. `hints` are target character indices, snapped forward to the nearest atom start (only whitespace and punctuation may lie in between); hints that cannot be snapped are dropped. Among objective-defect results, only dangling tails are kept in `admitted`, which is better than cutting character by character; they fall into the [`SplitSeam::HintedFlagged`] tier. Hints with weak tails, sticky heads, incomplete noun phrases, list separators or unclosed delimiters go into `refused` (§8.8 user decision: weak tails and sticky heads were originally admitted too, which raised `align-target-seam` from 9 to 33 across four projects; §8.9 then made rejected hints a tier of their own, ranked before character-level seams). Hints inside locked terms go into neither pile. The cost uses the same scale as [`target_cut_candidates`]. Deduplicated and sorted by position.
pub fn hinted_cut_candidates(
    target: &str,
    lang: &str,
    params: &TransParams,
    protected_terms: &[String],
    hints: &[usize],
) -> HintedCuts {
    let atoms = atomize(target);
    if atoms.len() < 2 || hints.is_empty() {
        return HintedCuts::default();
    }
    let starts = atom_start_positions(target, &atoms);
    let protected = protected_spans(target, lang, params, protected_terms);
    let chars: Vec<char> = target.chars().collect();
    let mut out = HintedCuts::default();
    let mut seen: BTreeSet<usize> = BTreeSet::new();
    for &hint in hints {
        let Some(j) = (1..atoms.len()).find(|&j| starts[j] >= hint) else {
            continue;
        };
        let bridge_only_noise = chars[hint.min(chars.len())..starts[j].min(chars.len())]
            .iter()
            .all(|ch| ch.is_whitespace() || crate::atomize::is_punctuation_or_symbol(*ch));
        if !bridge_only_noise || !seen.insert(starts[j]) {
            continue;
        }
        if let Some(verdict) = cut_verdict(target, &atoms, &starts, j, lang, params, &protected) {
            if verdict.refused {
                out.refused.push(verdict.candidate);
            } else {
                out.admitted.push(verdict.candidate);
            }
        }
    }
    out.admitted.sort_by_key(|candidate| candidate.pos);
    out.refused.sort_by_key(|candidate| candidate.pos);
    out
}

/// Character range of a locked term in `target` (only terms that fit on one line are locked).
fn protected_spans(
    target: &str,
    lang: &str,
    params: &TransParams,
    protected_terms: &[String],
) -> Vec<(usize, usize)> {
    protected_terms
        .iter()
        .filter(|term| !term.is_empty() && target_cps_chars(term, lang) <= params.fit)
        .flat_map(|term| {
            target.match_indices(term.as_str()).map(|(byte, matched)| {
                let start = target[..byte].chars().count();
                (start, start + matched.chars().count())
            })
        })
        .collect()
}

/// Verdict of the objective-defect lint on the seam before atom `j`: `dangling` means the only defect is a dangling tail (evidence candidates do not accept it, model hints do admit it); `refused` means some other objective defect (neither evidence candidates nor hints admit it into the accepted pile). When both are false it is a clean seam. The within-word heuristic and blocking-level defects are already counted in the cost as [`BLOCKING_SEAM_PENALTY`].
struct CutVerdict {
    candidate: CutCandidate,
    dangling: bool,
    refused: bool,
}

/// Seam before atom `j`: an interior of a locked term gives no candidate (`None`); otherwise gives a [`CutVerdict`].
fn cut_verdict(
    target: &str,
    atoms: &[String],
    starts: &[usize],
    j: usize,
    lang: &str,
    params: &TransParams,
    protected: &[(usize, usize)],
) -> Option<CutVerdict> {
    let pos = starts[j];
    if protected.iter().any(|(s, e)| *s < pos && pos < *e) {
        return None;
    }
    let left = join_word_texts(atoms[..j].iter().map(String::as_str));
    let right = join_word_texts(atoms[j..].iter().map(String::as_str));
    let issues = lint_pieces(&[left.as_str(), right.as_str()], lang, params);
    let dangling = issues
        .iter()
        .any(|issue| is_objective_blocking(issue) && issue.class == SeamLintClass::DanglingTail);
    let refused = issues
        .iter()
        .any(|issue| is_objective_blocking(issue) && issue.class != SeamLintClass::DanglingTail);
    let mut cost = seam_penalty(
        &atoms[j - 1],
        &atoms[j],
        seam_backed_by_whitespace(target, &atoms, j),
    );
    if cjk_midword_boundary(left.trim_end(), right.trim_start())
        || issues
            .iter()
            .any(|issue| issue.kind == SeamLintKind::Blocking)
    {
        cost += BLOCKING_SEAM_PENALTY;
    }
    Some(CutVerdict {
        candidate: CutCandidate {
            pos,
            seam_cost: cost,
        },
        dangling,
        refused,
    })
}

/// Alignment statistics at one target cut point.
struct BoundaryStat {
    /// Maximum source word index aligned by the translation to the left of the cut (none ⇒ None).
    left_max: Option<usize>,
    /// Minimum source word index aligned by the translation to the right of the cut (none ⇒ None).
    right_min: Option<usize>,
    /// An edge that takes part in the decision crosses the cut.
    straddled: bool,
    /// Minimum weight of the edges supporting this cut (those that achieve leftMax / rightMin).
    confidence: f32,
}

impl BoundaryStat {
    fn safe(&self) -> bool {
        if self.straddled {
            return false;
        }
        match (self.left_max, self.right_min) {
            (Some(left), Some(right)) => left < right,
            _ => true,
        }
    }
}

fn boundary_stat(edges: &[AlignEdge], k: usize, tau: f32) -> BoundaryStat {
    let mut left: Option<(usize, f32)> = None;
    let mut right: Option<(usize, f32)> = None;
    let mut straddled = false;
    for edge in edges.iter().filter(|edge| edge.counted(tau)) {
        let weight = edge.effective_weight();
        if edge.tgt.start < k && k < edge.tgt.end {
            straddled = true;
            continue;
        }
        if edge.tgt.end <= k {
            left = Some(match left {
                Some((src, w)) if edge.src == src => (src, w.min(weight)),
                Some((src, w)) if edge.src < src => (src, w),
                _ => (edge.src, weight),
            });
        }
        if edge.tgt.start >= k {
            right = Some(match right {
                Some((src, w)) if edge.src == src => (src, w.min(weight)),
                Some((src, w)) if edge.src > src => (src, w),
                _ => (edge.src, weight),
            });
        }
    }
    let confidence = left
        .map(|(_, w)| w)
        .unwrap_or(1.0)
        .min(right.map(|(_, w)| w).unwrap_or(1.0));
    BoundaryStat {
        left_max: left.map(|(src, _)| src),
        right_min: right.map(|(src, _)| src),
        straddled,
        confidence,
    }
}

/// Safe boundary (design §4.3): candidate cut `k` satisfies `leftMax(k) < rightMin(k)`, and no edge taking part in decisions crosses it. Only `hard` edges and soft edges with `weight >= tau` are counted.
pub fn safe_boundaries(edges: &[AlignEdge], candidates: &[usize], tau: f32) -> Vec<usize> {
    let mut sorted: Vec<usize> = candidates.iter().copied().filter(|&k| k > 0).collect();
    sorted.sort_unstable();
    sorted.dedup();
    sorted
        .into_iter()
        .filter(|&k| boundary_stat(edges, k, tau).safe())
        .collect()
}

/// Whether a source-side break is a strong seam (the word on the left carries a clause or sentence-end punctuation).
fn source_punct_break(words: &[AnchorWord], b: usize) -> bool {
    let left = words[b - 1].text.trim();
    sentence_end(left) || clause_end_char(left).is_some()
}

fn source_pause_break(words: &[AnchorWord], b: usize) -> bool {
    words[b].t0 - words[b - 1].t1 >= SOURCE_PAUSE_SEC
}

/// Cutting **after** these words would separate them from the following constituents they attach to (articles, auxiliaries, negation, prepositions, conjunctions, determiners). A small English rule set; CJK dangling is handled as a fallback by [`ends_dangling`].
const FORWARD_CLINGING_EN: &[&str] = &[
    // Articles / determiners
    "a",
    "an",
    "the",
    "this",
    "that",
    "these",
    "those",
    "my",
    "your",
    "his",
    "her",
    "its",
    "our",
    "their",
    "some",
    "any",
    "no",
    "every",
    "each",
    "another",
    "such",
    // Auxiliaries / copulas / negation
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "have",
    "has",
    "had",
    "having",
    "be",
    "been",
    "being",
    "am",
    "is",
    "are",
    "was",
    "were",
    "not",
    "don't",
    "doesn't",
    "didn't",
    "won't",
    "wouldn't",
    "can't",
    "cannot",
    "couldn't",
    "shouldn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "hasn't",
    "haven't",
    "hadn't",
    "never",
    // Prepositions / infinitive markers
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "with",
    "from",
    "by",
    "about",
    "into",
    "onto",
    "as",
    "than",
    "through",
    "over",
    "under",
    "between",
    "without",
    "via",
    "per",
    "toward",
    "towards",
    // Conjunctions / relative words
    "and",
    "or",
    "but",
    "because",
    "if",
    "when",
    "while",
    "that",
    "which",
    "who",
    "whom",
    "whose",
    "where",
    "so",
    "then",
    "although",
    "though",
    "unless",
    "until",
    "whether",
    "nor",
    "yet",
];

/// Cutting **before** these words would move a clinging particle to the start of a segment (Japanese particles).
const BACKWARD_CLINGING_JA: &[&str] = &[
    "は",
    "が",
    "を",
    "に",
    "で",
    "と",
    "の",
    "へ",
    "も",
    "や",
    "から",
    "まで",
    "より",
    "ので",
    "のに",
    "けど",
    "けれど",
];

/// Whether a source-side break `b` (the index of the first word of the right block) is legal.
fn source_seam_legal(words: &[AnchorWord], b: usize) -> bool {
    if b == 0 || b >= words.len() {
        return false;
    }
    let left_text = join_word_texts(words[..b].iter());
    if ends_dangling(&left_text) {
        return false;
    }
    // A seam closed by clause punctuation is legal: in `Generally speaking, though, | the smarter …` the lemma `though,` is in the prefix list, but the comma has already closed it as a complete parenthetical, so the line end here is not dangling. The prefix is judged by lemma only when there is no closing punctuation.
    let sealed = crate::seam::ends_clause_punct(&words[b - 1].text);
    let tail = lexemes(&words[b - 1].text).pop().unwrap_or_default();
    if !sealed && FORWARD_CLINGING_EN.contains(&tail.as_str()) {
        return false;
    }
    let head = lexemes(&words[b].text)
        .into_iter()
        .next()
        .unwrap_or_default();
    !BACKWARD_CLINGING_JA.contains(&head.as_str())
}

/// Source-side seam penalty (for the DP): sentence punctuation 0 < before a conjunction 0.3 < before a preposition 0.5 < ordinary inter-word 0.8. Illegal seams (dangling articles, conjunctions, etc.) additionally get [`BLOCKING_SEAM_PENALTY`]. Block boundaries are decided by alignment edges and may be forced onto bad seams, so this is a heavy penalty rather than an infinite one.
fn source_seam_cost(words: &[AnchorWord], b: usize) -> f64 {
    let texts: Vec<&str> = words.iter().map(|word| word.text.as_str()).collect();
    let base = match source_boundary_strength(&texts, b) {
        3 => 0.0,
        2 => 0.3,
        1 => 0.5,
        _ => 0.8,
    };
    if source_seam_legal(words, b) {
        base
    } else {
        base + BLOCKING_SEAM_PENALTY
    }
}

/// Chooses the source-side break within `(leftMax, rightMin]` (already narrowed to `lo..=hi`) (design §4.3): sentence-end or clause punctuation > pause > legal ordinary seam > illegal seam. Within the punctuation and pause tiers, take the one closest to the ideal proportional position. Within the ordinary-seam tier, the default is to merge into the previous block (take the largest `b`), but when an unaligned word run is too long, take the legal seam closest to the ideal position instead. Illegal seams are used only as a last resort.
fn choose_source_break(
    words: &[AnchorWord],
    lo: usize,
    hi: usize,
    k: usize,
    target_len: usize,
) -> usize {
    if lo >= hi {
        return lo;
    }
    let n = words.len();
    let ideal = ((k as f64 / target_len.max(1) as f64) * n as f64).round() as usize;
    let ideal = ideal.clamp(lo, hi);
    let class = |b: usize| -> u8 {
        if source_punct_break(words, b) {
            3
        } else if source_pause_break(words, b) {
            2
        } else if source_seam_legal(words, b) {
            1
        } else {
            0
        }
    };
    let best_class = (lo..=hi).map(class).max().unwrap_or(0);
    let candidates: Vec<usize> = (lo..=hi).filter(|&b| class(b) == best_class).collect();
    let closest = |set: &[usize]| {
        set.iter()
            .copied()
            .min_by_key(|&b| (b.abs_diff(ideal), std::cmp::Reverse(b)))
            .unwrap_or(hi)
    };
    match best_class {
        3 | 2 => closest(&candidates),
        1 if hi - lo + 1 > LONG_UNALIGNED_RUN => closest(&candidates),
        1 => *candidates.last().unwrap_or(&hi),
        _ => hi,
    }
}

/// Whether there are crossing edges inside the block (local reordering).
fn has_local_reorder(edges: &[AlignEdge]) -> bool {
    for (index, a) in edges.iter().enumerate() {
        for b in &edges[index + 1..] {
            if (a.src < b.src && a.tgt.start > b.tgt.start)
                || (a.src > b.src && a.tgt.start < b.tgt.start)
            {
                return true;
            }
        }
    }
    false
}

/// Minimal monotonic alignment block (design §4.3). Returns blocks whose target spans are in **`target` character coordinates** ([`plan_entry`] converts them to `concat(pieces.text)` later).
///
/// - Only edges taking part in decisions (`hard` or `weight >= tau`) affect boundaries;
/// - the source break for each safe boundary is chosen by [`choose_source_break`] within `(leftMax, rightMin]`, and must leave at least 1 source word on each side, otherwise that boundary is dropped (merged into the adjacent block);
/// - source words not covered by any edge merge into the previous block; leading ones at the start of the sentence merge into the next block;
/// - `confidence` = the minimum edge weight of the edges supporting the block's two boundaries, further capped by the minimum weight of edges inside the block that take part in decisions (a whole-sentence block with no boundaries is decided by the in-block edge weights);
/// - `flags`: `local-reorder` (crossing edges inside the block), `anchor` (contains hard edges), `weak` (no hard edges).
pub fn minimal_monotonic_blocks(
    edges: &[AlignEdge],
    words: &[AnchorWord],
    target: &str,
    candidates: &[usize],
    tau: f32,
) -> Vec<AlignBlock> {
    let n = words.len();
    let target_len = target.chars().count();
    if n == 0 || target_len == 0 {
        return Vec::new();
    }
    let mut sorted: Vec<usize> = candidates
        .iter()
        .copied()
        .filter(|&k| k > 0 && k < target_len)
        .collect();
    sorted.sort_unstable();
    sorted.dedup();

    // (target cut, source break, boundary confidence)
    let mut cuts: Vec<(usize, usize, f32)> = Vec::new();
    let mut prev_b = 0usize;
    for k in sorted {
        let stat = boundary_stat(edges, k, tau);
        if !stat.safe() {
            continue;
        }
        let lo = stat
            .left_max
            .map_or(0, |left| left + 1)
            .max(prev_b + 1)
            .max(1);
        let hi = stat.right_min.unwrap_or(n - 1).min(n - 1);
        if lo > hi {
            continue;
        }
        let b = choose_source_break(words, lo, hi, k, target_len);
        cuts.push((k, b, stat.confidence));
        prev_b = b;
    }

    let mut blocks = Vec::with_capacity(cuts.len() + 1);
    let mut src_from = 0usize;
    let mut tgt_from = 0usize;
    let mut left_conf = 1.0f32;
    for index in 0..=cuts.len() {
        let (tgt_to, next_src, right_conf) = cuts
            .get(index)
            .map(|&(k, b, conf)| (k, b, conf))
            .unwrap_or((target_len, n, 1.0));
        let src_to = next_src - 1;
        let inside: Vec<AlignEdge> = edges
            .iter()
            .filter(|edge| {
                edge.counted(tau)
                    && (src_from..=src_to).contains(&edge.src)
                    && edge.tgt.start >= tgt_from
                    && edge.tgt.end <= tgt_to
            })
            .cloned()
            .collect();
        let mut confidence = left_conf.min(right_conf);
        for edge in &inside {
            confidence = confidence.min(edge.effective_weight());
        }
        let mut flags = Vec::new();
        if has_local_reorder(&inside) {
            flags.push("local-reorder".to_owned());
        }
        if inside.iter().any(|edge| edge.hard) {
            flags.push("anchor".to_owned());
        } else {
            flags.push("weak".to_owned());
        }
        blocks.push(AlignBlock {
            src: (src_from, src_to),
            tgt: (tgt_from, tgt_to),
            confidence: Some(confidence),
            flags,
        });
        src_from = next_src;
        tgt_from = tgt_to;
        left_conf = right_conf;
    }
    blocks
}

/// Bilingual DP input (design §4.4).
#[derive(Debug, Clone, PartialEq)]
pub struct BilingualPlanInput {
    /// Anchored words within the sentence (order is the `src` index).
    pub words: Vec<AnchorWord>,
    /// Target text (`trans` or `transDisplay.text`, as declared by `text_basis`).
    pub target: String,
    /// Target language.
    pub lang: String,
    /// Source language.
    pub source_lang: String,
    pub params: TransParams,
    /// Target-language locked terms (must not be split in the middle).
    pub protected_terms: Vec<String>,
    /// Minimum on-screen duration of one subtitle (seconds), default 1.0.
    pub min_duration_sec: f64,
    /// Maximum dwell duration of one subtitle (seconds), default 7.0.
    pub max_duration_sec: f64,
    /// Per-line reading-unit budget on the source side (default taken per source language from `source_piece_budgets`).
    pub source_fit: usize,
    /// Confidence threshold τ for soft edges to take part in decisions.
    pub tau: f32,
    /// Sentence-level fallback threshold τ_s.
    pub sentence_tau: f32,
    pub text_basis: TextBasis,
    /// Source identifier written to `TransAlign.aligner`.
    pub aligner: String,
    /// Display line density. `Paired` only relaxes the "target line too narrow" merge preference; reading-speed and duration hard guardrails stay unchanged.
    pub density: AlignDensity,
    /// Source-cue attribution for each word, aligned position by position with `words`. When non-empty (and of the same length as `words`), row planning uses the same dwell predicate as `align-row-deficit` ([`crate::engines::align::row_dwell_deficit`]) to avoid producing sticky rows. Empty means source rows are unknown and the predicate is off.
    pub source_cue_keys: Vec<Option<String>>,
}

/// Translation display-line density. The default `Auto` keeps the existing many-to-one behaviour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AlignDensity {
    #[default]
    Auto,
    Paired,
}

impl AlignDensity {
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "auto" => Some(Self::Auto),
            "paired" => Some(Self::Paired),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Paired => "paired",
        }
    }
}

impl BilingualPlanInput {
    /// Default parameters: `TransParams::for_lang`, 1.0s / 7.0s, source-side budget per language, τ 0.5, τ_s 0.35, `trans` as basis, [`ANCHOR_ALIGNER_TAG`].
    pub fn new(
        words: Vec<AnchorWord>,
        target: impl Into<String>,
        source_lang: &str,
        lang: &str,
    ) -> Self {
        Self {
            words,
            target: target.into(),
            lang: lang.to_owned(),
            source_lang: source_lang.to_owned(),
            params: TransParams::for_lang(lang),
            protected_terms: Vec::new(),
            min_duration_sec: MIN_CUE_DISPLAY_SEC,
            max_duration_sec: crate::engines::align::LONG_DWELL_SECONDS,
            source_fit: crate::engines::align::source_piece_budgets(source_lang).0,
            tau: DEFAULT_EDGE_TAU,
            sentence_tau: DEFAULT_SENTENCE_TAU,
            text_basis: TextBasis::Trans,
            aligner: ANCHOR_ALIGNER_TAG.to_owned(),
            density: AlignDensity::Auto,
            source_cue_keys: Vec::new(),
        }
    }

    /// Source-row information is available (per-word attribution is complete).
    fn knows_source_rows(&self) -> bool {
        !self.words.is_empty() && self.source_cue_keys.len() == self.words.len()
    }

    /// Number of user-visible source rows in the whole sentence; 0 when source-row information is unavailable.
    fn sentence_source_rows(&self) -> usize {
        if !self.knows_source_rows() {
            return 0;
        }
        crate::engines::align::covered_source_rows(&self.source_cue_keys, 0, self.words.len() - 1)
    }

    /// Whether the word-order range `[from, to]` within the sentence, taken as one translation row, hits the dwell predicate of `align-row-deficit`. Always false when source-row information is unavailable.
    fn piece_dwell_deficit(&self, from: usize, to: usize) -> bool {
        if !self.knows_source_rows() || from > to || to >= self.words.len() {
            return false;
        }
        let dwell = (self.words[to].t1 - self.words[from].t0).max(0.0);
        crate::engines::align::row_dwell_deficit(
            dwell,
            crate::engines::align::covered_source_rows(&self.source_cue_keys, from, to),
        )
    }

    fn word_units(&self) -> Vec<usize> {
        self.words
            .iter()
            .map(|word| target_cps_chars(&word.text, &self.source_lang))
            .collect()
    }
}

/// Light penalty per block merged when several blocks are merged, encouraging fine-grained correspondence.
const BLOCK_MERGE_PENALTY: f64 = 0.05;
/// Penalty for a source-side span width exceeding the single-line budget.
const SOURCE_OVER_FIT_PENALTY: f64 = 1.0;
/// Time window shorter than the target language's minimum reading time: penalty per second of shortfall.
const DURATION_DEFICIT_WEIGHT: f64 = 1.0;
/// Time window longer than the maximum dwell: penalty per second.
const DURATION_EXCESS_WEIGHT: f64 = 0.5;

fn char_slice(chars: &[char], range: Range<usize>) -> String {
    chars[range.start.min(chars.len())..range.end.min(chars.len())]
        .iter()
        .collect()
}

/// Pairing cost of one piece (`blocks[i..j)`); `None` means a hard constraint is violated. `left_piece_start` is the first block index of the predecessor piece that the DP has already chosen for block `i` (meaningless when `i == 0`); it is used only for the same-basis judgment of the enumeration-comma seam.
#[allow(clippy::too_many_arguments)]
fn pair_cost(
    blocks: &[AlignBlock],
    i: usize,
    j: usize,
    left_piece_start: Option<usize>,
    input: &BilingualPlanInput,
    target_chars: &[char],
    word_units: &[usize],
    seam_costs: &BTreeMap<usize, f64>,
) -> Option<f64> {
    let first = &blocks[i];
    let last = &blocks[j - 1];
    let text = char_slice(target_chars, first.tgt.0..last.tgt.1);
    let text = text.trim();
    let units = target_cps_chars(text, &input.lang);
    let params = &input.params;
    if units > params.hard {
        return None;
    }
    let soft = params.soft.max(1) as f64;
    // Target width term. `Auto` penalises in both directions: the further from soft, the more expensive, so a narrow piece almost always gets merged back in the DP (zh soft=14: a translation of 8 units split into two pieces, each paying ((4-14)/14)² ≈ 0.51, whereas merged into one it pays ((8-14)/14)² ≈ 0.18).
    //
    // `Paired` removes the penalty for the **narrower than soft** direction (that term becomes 0), because the definition of paired is "allow lines shorter than soft, in exchange for one translation line per source line". The real upper bound on narrow pieces is taken over by the `required` (reading time / reading speed) shortfall penalty below and by `min_duration_sec`; those are physiological guardrails, not layout preferences. The direction wider than soft is still penalised as before; the `units > hard` hard constraint, the quadratic increase past fit, the source-side width and time window, seam penalties, merge penalties and the confidence penalty are all untouched.
    //
    // This branch is the only relaxation point for paired on the `--align-only` path (check's fix runs, refine, client-directed reruns). That path goes `plan_sentence` → [`bilingual_dp`] → this function, and cannot reach [`merge_short_rows`].
    let mut cost = if input.density == AlignDensity::Paired && (units as f64) < soft {
        0.0
    } else {
        ((units as f64 - soft) / soft).powi(2)
    };
    if exceeds_one_line_fit(text, &input.lang, params.fit) {
        // Beyond fit, the penalty grows quadratically with the overshoot: just past fit still pays [`OVER_FIT_PENALTY`] (so the low end of the grey band does not change existing trade-offs), and reaching hard pays three times as much. With a flat penalty, "a whole line pinned at hard" (1.5) would always be lighter than a bad source seam left by a dangling copula ([`BLOCKING_SEAM_PENALTY`] + 0.8), so the DP would rather keep an over-fit whole line. Yet check's paired-density requires cutting exactly at that translation seam, and a refine rerun would only produce the same blocks. Hard is a ceiling, not a target: a line pressed against the ceiling must weigh more than a bad source seam.
        let span = params.hard.saturating_sub(params.fit).max(1) as f64;
        let over = (units.saturating_sub(params.fit) as f64 / span).min(1.0);
        cost += OVER_FIT_PENALTY * (1.0 + 2.0 * over * over);
    }
    // Source-side layout: span width and time window (following the 4s / 6s criteria of bilingual paired review).
    let (from, to) = (first.src.0, last.src.1);
    let source_width: usize = word_units[from..=to].iter().sum();
    if source_width > input.source_fit {
        cost += SOURCE_OVER_FIT_PENALTY;
    }
    let span = (input.words[to].t1 - input.words[from].t0).max(0.0);
    let soft_s = crate::engines::align::PAIRED_SOURCE_MAX_SECONDS;
    let hard_s = crate::engines::align::PAIRED_SOURCE_HARD_SECONDS;
    if span > hard_s {
        cost += 1.5 + 0.5 * (span - hard_s);
    } else if span > soft_s {
        cost += 0.5 * (span - soft_s) / (hard_s - soft_s);
    }
    // Shared time window: shorter than the target language's minimum reading time, or longer than the maximum dwell.
    let required = target_required_seconds(text, &input.lang).max(input.min_duration_sec);
    if span < required {
        cost += (required - span) * DURATION_DEFICIT_WEIGHT;
    }
    if span > input.max_duration_sec {
        cost += (span - input.max_duration_sec) * DURATION_EXCESS_WEIGHT;
    }
    cost += BLOCK_MERGE_PENALTY * (j - i - 1) as f64;
    // Left-boundary seam penalty (the start of a piece is not counted).
    if i > 0 {
        cost += seam_costs
            .get(&first.tgt.0)
            .copied()
            .unwrap_or(BLOCKING_SEAM_PENALTY);
        // An enumeration comma is judged on the same basis as `seam::lint_pieces`: when parallel items are split apart and the merged left and right pieces still do not exceed hard, the enumeration comma is not a seam (Blocking). The candidate seam table prices "left piece | the entire remainder", and the remainder almost always exceeds hard, so the enumeration comma gets priced cheaply as a clause punctuation. Here the DP knows the true width of the right piece, and the left piece takes the predecessor piece the DP chose for block i. If their sum is ≤ hard, it counts as a blocking seam; otherwise check would report this cut as align-target-seam, while rerunning align would only produce the same blocks.
        let left_start = left_piece_start.unwrap_or(i - 1);
        let prev = char_slice(target_chars, blocks[left_start].tgt.0..blocks[i - 1].tgt.1);
        if ends_list_separator(&prev)
            && target_cps_chars(prev.trim(), &input.lang) + units <= params.hard
        {
            cost += BLOCKING_SEAM_PENALTY;
        }
        cost += source_seam_cost(&input.words, first.src.0);
        let confidence = blocks[i - 1]
            .confidence
            .unwrap_or(1.0)
            .min(first.confidence.unwrap_or(1.0));
        cost += (1.0 - f64::from(confidence)).max(0.0);
    }
    Some(cost)
}

/// Bilingual DP (design §4.4): `dp[j] = min_i dp[i] + pairCost(blocks[i..j))`. Returns the consecutive block indices contained in each piece. If a single block by itself violates a hard constraint (target > hard), there is no solution.
/// `blocks`' target spans must be in `input.target` character coordinates (the direct output of [`minimal_monotonic_blocks`]).
///
/// Dwell predicate (when source-row information is available): if a piece of the regular DP plan hits `align-row-deficit` (dwell ≥5s and covering ≥2 source rows, with fewer pieces than source rows), run a second DP that is "sticky-first". Pieces that hit the predicate add [`ROW_DEFICIT_SPLIT_PENALTY`], and only readable new pieces are allowed (see [`readable_piece`]). Pieces already in the regular plan are not restricted, which guarantees the second pass has at least the regular solution to fall back on. The second-pass plan is adopted only if its number of sticky pieces is strictly smaller; otherwise the regular plan is kept. Width fit is no longer the sole criterion, but nothing is forcibly split when no readable split exists.
pub fn bilingual_dp(blocks: &[AlignBlock], input: &BilingualPlanInput) -> Option<Vec<Vec<usize>>> {
    let m = blocks.len();
    if m == 0 || input.words.is_empty() {
        return None;
    }
    let target_chars: Vec<char> = input.target.chars().collect();
    let word_units = input.word_units();
    let seam_costs: BTreeMap<usize, f64> = target_cut_candidates(
        &input.target,
        &input.lang,
        &input.params,
        &input.protected_terms,
    )
    .into_iter()
    .map(|candidate| (candidate.pos, candidate.seam_cost))
    .collect();
    let base = |i: usize, j: usize, left: Option<usize>| {
        pair_cost(
            blocks,
            i,
            j,
            left,
            input,
            &target_chars,
            &word_units,
            &seam_costs,
        )
    };
    let groups = run_bilingual_dp(m, &base)?;
    let source_rows = input.sentence_source_rows();
    let deficits = |groups: &[Vec<usize>]| -> usize {
        if groups.len() >= source_rows {
            return 0;
        }
        groups
            .iter()
            .filter(|group| {
                input.piece_dwell_deficit(
                    blocks[group[0]].src.0,
                    blocks[group[group.len() - 1]].src.1,
                )
            })
            .count()
    };
    let before = deficits(&groups);
    if before == 0 {
        return Some(groups);
    }
    let original: BTreeSet<(usize, usize)> = groups
        .iter()
        .map(|group| (group[0], group[group.len() - 1] + 1))
        .collect();
    let dwell_aware = |i: usize, j: usize, left: Option<usize>| {
        let cost = base(i, j, left)?;
        let (from, to) = (blocks[i].src.0, blocks[j - 1].src.1);
        if input.piece_dwell_deficit(from, to) {
            return Some(cost + ROW_DEFICIT_SPLIT_PENALTY);
        }
        if !original.contains(&(i, j)) && !readable_piece(blocks, i, j, input, &target_chars) {
            return None;
        }
        Some(cost)
    };
    match run_bilingual_dp(m, &dwell_aware) {
        Some(split) if deficits(&split) < before => Some(split),
        _ => Some(groups),
    }
}

/// Additional penalty, in the sticky-first DP, for a piece that hits the dwell predicate. It is on the order of more than the sum of all soft penalties (seam, confidence, width, time window), so that "one fewer sticky row" takes priority over layout preferences. Hard constraints (exceeding hard) and the readability thresholds are unaffected by it.
const ROW_DEFICIT_SPLIT_PENALTY: f64 = 10.0;

/// Newly cut pieces in the sticky-first DP must be readable: width ≥ [`ROW_MIN_UNITS`], time window ≥ `min_duration_sec`, reading speed ≤ [`ROW_MAX_CPS`]. These are the same thresholds as "too small / too fast" in [`merge_short_rows`], so pieces cut here will not be glued back together by post-processing.
fn readable_piece(
    blocks: &[AlignBlock],
    i: usize,
    j: usize,
    input: &BilingualPlanInput,
    target_chars: &[char],
) -> bool {
    let group: Vec<usize> = (i..j).collect();
    let (units, seconds) = row_metrics(blocks, &group, input, target_chars);
    units >= ROW_MIN_UNITS
        && seconds >= input.min_duration_sec
        && seconds > 0.0
        && units as f64 / seconds <= ROW_MAX_CPS
}

/// `dp[j] = min_i dp[i] + cost(i, j, first block of the predecessor piece)`; returns `None` when there is no solution.
fn run_bilingual_dp(
    m: usize,
    cost_of: &dyn Fn(usize, usize, Option<usize>) -> Option<f64>,
) -> Option<Vec<Vec<usize>>> {
    const INF: f64 = f64::INFINITY;
    let mut dp = vec![INF; m + 1];
    let mut back = vec![0usize; m + 1];
    dp[0] = 0.0;
    for j in 1..=m {
        for i in 0..j {
            if dp[i] == INF {
                continue;
            }
            let left_piece_start = (i > 0).then(|| back[i]);
            let Some(cost) = cost_of(i, j, left_piece_start) else {
                continue;
            };
            let candidate = dp[i] + cost;
            if candidate < dp[j] {
                dp[j] = candidate;
                back[j] = i;
            }
        }
    }
    if dp[m] == INF {
        return None;
    }
    let mut groups = Vec::new();
    let mut j = m;
    while j > 0 {
        let i = back[j];
        groups.push((i..j).collect::<Vec<usize>>());
        j = i;
    }
    groups.reverse();
    Some(groups)
}

/// Blocks + DP grouping ⇒ [`TransAlign`] (manyToOne, block-level correspondence). Block target spans are converted from `target` coordinates to `concat(pieces.text)` coordinates. When a piece's leading and trailing whitespace is trimmed, this only affects the start of the piece's first block and the end of its last block.
pub fn plan_entry(
    blocks: &[AlignBlock],
    groups: &[Vec<usize>],
    input: &BilingualPlanInput,
) -> TransAlign {
    let target_chars: Vec<char> = input.target.chars().collect();
    let mut pieces = Vec::with_capacity(groups.len());
    let mut out_blocks = Vec::with_capacity(blocks.len());
    let mut concat_len = 0usize;
    for group in groups {
        let (Some(&first), Some(&last)) = (group.first(), group.last()) else {
            continue;
        };
        let g_start = blocks[first].tgt.0;
        let g_end = blocks[last].tgt.1;
        let raw = char_slice(&target_chars, g_start..g_end);
        let leading = raw.chars().take_while(|ch| ch.is_whitespace()).count();
        let text = raw.trim().to_owned();
        let text_len = text.chars().count();
        // The position of the piece text's first non-whitespace character in target; the start of the piece's first block is clamped to 0, and the end of its last block is clamped to the trimmed length.
        let base = g_start + leading;
        for &index in group {
            let block = &blocks[index];
            let start = block.tgt.0.saturating_sub(base).min(text_len);
            let end = block.tgt.1.saturating_sub(base).min(text_len).max(start);
            out_blocks.push(AlignBlock {
                src: block.src,
                tgt: (concat_len + start, concat_len + end),
                confidence: block.confidence,
                flags: block.flags.clone(),
            });
        }
        pieces.push(TransPiece {
            from: Some(blocks[first].src.0),
            to: Some(blocks[last].src.1),
            text,
        });
        concat_len += text_len;
    }
    let mut entry = TransAlign::new(
        AlignMode::ManyToOne,
        input.words.iter().map(|word| word.id.clone()).collect(),
        pieces,
    );
    entry.correspondence = Some(Correspondence::Block);
    entry.text_basis = input.text_basis;
    entry.aligner = Some(input.aligner.clone());
    entry.blocks = out_blocks;
    entry
}

/// Whole-sentence correspondence entry (design §4.5 fallback): one block, one piece, `correspondence: sentence`.
pub fn sentence_level_entry(input: &BilingualPlanInput, confidence: Option<f32>) -> TransAlign {
    let text = input.target.trim().to_owned();
    let text_len = text.chars().count();
    let last = input.words.len().saturating_sub(1);
    let mut entry = TransAlign::new(
        AlignMode::ManyToOne,
        input.words.iter().map(|word| word.id.clone()).collect(),
        vec![TransPiece {
            from: Some(0),
            to: Some(last),
            text,
        }],
    );
    entry.correspondence = Some(Correspondence::Sentence);
    entry.text_basis = input.text_basis;
    entry.aligner = Some(input.aligner.clone());
    entry.blocks = vec![AlignBlock {
        src: (0, last),
        tgt: (0, text_len),
        confidence,
        flags: Vec::new(),
    }];
    entry
}

/// Result of [`plan_sentence`].
#[derive(Debug, Clone, PartialEq)]
pub enum PlanOutcome {
    /// The block-level correspondence plan has been formed.
    Aligned(TransAlign),
    /// The target text of some (merged) block exceeds hard and cannot fit into one subtitle: a monotonizing display rewrite is needed (design §6.3). After the caller rewrites it, rerun edges → blocks → DP.
    NeedsRewrite {
        /// Index of the over-limit block (within `blocks`).
        over_hard_block: usize,
        /// Number of target reading units of that block.
        units: usize,
        /// All blocks (`target` character coordinates), so the rewrite task can describe the over-limit blocks and their source spans.
        blocks: Vec<AlignBlock>,
    },
    /// Sentence-level correspondence: no alignment evidence, plan confidence below τ_s, or the DP has no solution.
    SentenceLevel(TransAlign),
}

fn block_units(block: &AlignBlock, target_chars: &[char], lang: &str) -> usize {
    let text = char_slice(target_chars, block.tgt.0..block.tgt.1);
    target_cps_chars(text.trim(), lang)
}

/// Decision tree (design §4.5, excluding the LLM rewrite step).
pub fn plan_sentence(edges: &[AlignEdge], input: &BilingualPlanInput) -> PlanOutcome {
    let candidates: Vec<usize> = target_cut_candidates(
        &input.target,
        &input.lang,
        &input.params,
        &input.protected_terms,
    )
    .into_iter()
    .map(|candidate| candidate.pos)
    .collect();
    plan_sentence_at_cuts(edges, input, &candidates)
}

/// Plan using an explicit, already validated candidate set. Evidence-aware
/// carriers must use this entry so missing evidence cannot recreate cuts via
/// the legacy one-sided/no-edge safety rule.
pub fn plan_sentence_at_cuts(
    edges: &[AlignEdge],
    input: &BilingualPlanInput,
    candidates: &[usize],
) -> PlanOutcome {
    let n = input.words.len();
    let target_chars: Vec<char> = input.target.chars().collect();
    let target_len = target_chars.len();
    let edges: Vec<AlignEdge> = edges
        .iter()
        .filter(|edge| edge.src < n && edge.tgt.start < edge.tgt.end && edge.tgt.end <= target_len)
        .cloned()
        .collect();
    let counted = edges.iter().filter(|edge| edge.counted(input.tau)).count();
    if n == 0 || input.target.trim().is_empty() || counted == 0 {
        return PlanOutcome::SentenceLevel(sentence_level_entry(input, None));
    }
    let blocks =
        minimal_monotonic_blocks(&edges, &input.words, &input.target, candidates, input.tau);
    if blocks.is_empty() {
        return PlanOutcome::SentenceLevel(sentence_level_entry(input, None));
    }
    let confidence = blocks
        .iter()
        .filter_map(|block| block.confidence)
        .fold(1.0f32, f32::min);
    if confidence < input.sentence_tau {
        return PlanOutcome::SentenceLevel(sentence_level_entry(input, Some(confidence)));
    }
    if let Some((index, units)) = blocks
        .iter()
        .enumerate()
        .map(|(index, block)| (index, block_units(block, &target_chars, &input.lang)))
        .filter(|&(_, units)| units > input.params.hard)
        .max_by_key(|&(index, units)| (units, std::cmp::Reverse(index)))
    {
        return PlanOutcome::NeedsRewrite {
            over_hard_block: index,
            units,
            blocks,
        };
    }
    match bilingual_dp(&blocks, input) {
        Some(groups) => PlanOutcome::Aligned(plan_entry(&blocks, &groups, input)),
        None => PlanOutcome::SentenceLevel(sentence_level_entry(input, Some(confidence))),
    }
}

/// Seams used for splitting within a block are tiered by origin and cleanliness; tier order takes precedence over fit and seam cost (design §8.7–§8.9).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SplitSeam {
    /// A target seam backed by punctuation or inter-word whitespace, clean under the lint.
    Backed,
    /// A cut point the model gave itself (a block boundary, or a segment marker copied into the translation, [`hinted_cut_candidates`]), clean under the lint and not inside a word.
    Hinted,
    /// A cut point the model gave, but with a lint-admitted dangling tail, or on a seam the within-word heuristic places inside a word (`ccut check` reports the former as `align-target-seam`).
    HintedFlagged,
    /// A cut point the model gave, but rejected by the objective-defect lint (weak tail / sticky head / incomplete noun phrase / list separator / unclosed delimiter). It is not counted as admitted. It only substitutes for a character-level seam in a ladder that has evidence cut points (§8.9 user decision: even a poor model cut point is still a word boundary).
    HintedRefused,
    /// A character-level seam with neither backing nor hints, merely not rejected by the lint (CJK intra-word risk).
    Character,
}

impl SplitSeam {
    /// Sort tiers: clean seams (backed, or clean hints) always come before hint seams with defects, then rejected hint seams, with character-level seams last; regardless of fit.
    fn rank(self) -> u8 {
        match self {
            Self::Backed | Self::Hinted => 0,
            Self::HintedFlagged => 1,
            Self::HintedRefused => 2,
            Self::Character => 3,
        }
    }

    /// Seams not admitted: a ladder that relies only on hints does not use them (such sentences originally went to the rewrite round).
    fn unadmitted(self) -> bool {
        matches!(self, Self::HintedRefused | Self::Character)
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Backed => "backed",
            Self::Hinted => "model-hinted",
            Self::HintedFlagged => "model-hinted-flagged",
            Self::HintedRefused => "model-hinted-refused",
            Self::Character => "character-level",
        }
    }
}

/// An extra cut point used by splitting within a block.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SplitCut {
    pub pos: usize,
    pub seam: SplitSeam,
}

/// English phrase counting the `cuts` by tier (for advisory use), e.g. `1 backed, 1 model-hinted seam(s)`.
pub fn describe_split_cuts(cuts: &[SplitCut]) -> String {
    let parts: Vec<String> = [
        SplitSeam::Backed,
        SplitSeam::Hinted,
        SplitSeam::HintedFlagged,
        SplitSeam::HintedRefused,
        SplitSeam::Character,
    ]
    .into_iter()
    .filter_map(|seam| {
        let count = cuts.iter().filter(|cut| cut.seam == seam).count();
        (count > 0).then(|| format!("{count} {}", seam.label()))
    })
    .collect();
    format!("{} seam(s)", parts.join(", "))
}

/// Splitting within a block after [`plan_sentence_at_cuts`]: when the model's cut points are all admitted (or the model gave cut hints) and some block still exceeds hard (either the model wrote a block too coarse, or one of its cut points falls on a seam rejected by the lint), take one target seam **inside that block** to split it into two. The other blocks and the model's cut points are kept unchanged. When a cut point falls inside a target range referenced by some block, that block's two soft edges are split at the cut point (the left half goes to the block's first word, the right half to its last word), so the new cut is no longer crossed. The source break within the block is snapped by [`choose_source_break`], near the proportional landing point, to source punctuation, pauses or legal seams; evidence outside the block is left untouched.
///
/// Only blocks that can be split with "one cut" are considered: both sides must be ≤ hard, the candidate must not be crossed by a hard anchor, and the block being split has at least two source words (a one-word block has only one edge, so after splitting there is no way to judge safety; a block already split once has only one edge per half, so blocks needing two cuts cannot be split here). Equally eligible candidates are first ordered by tier ([`SplitSeam`]: clean backed seams and clean hint seams share a tier, then defective hint seams, then rejected hint seams, with character-level seams last), then those where both sides fit within fit are preferred, and then they are compared by seam cost and distance from the block midpoint. Tier comes first, because otherwise an intra-word seam where both sides fit would beat a punctuation seam where one side slightly exceeds fit (`看到什|么机会`), and a hint seam where both sides fit but which ends in “的” would beat a comma seam where one side slightly exceeds fit. When `cuts` is empty (no evidence cut point was admitted and only the hint-based ladder is used), unadmitted seams (rejected hints, character-level) are not used: such sentences originally went to the rewrite round, and when a hint cannot be snapped, an intra-word seam would not save the call it avoids. Blocks needing two cuts, having no candidates, or still unsafe after splitting remain `NeedsRewrite` (a job for the rewrite round: crossed word order and heavy block merging). Returns the plan and the extra cut points used.
pub fn plan_sentence_splitting_over_hard(
    edges: &[AlignEdge],
    input: &BilingualPlanInput,
    cuts: &[usize],
    candidates: &[CutCandidate],
    hinted: &HintedCuts,
) -> (PlanOutcome, Vec<SplitCut>) {
    let target_chars: Vec<char> = input.target.chars().collect();
    let mut edges = edges.to_vec();
    let mut cuts = cuts.to_vec();
    let unadmitted_allowed = !cuts.is_empty();
    let mut extra = Vec::new();
    let mut tried: BTreeSet<usize> = BTreeSet::new();
    // A position counts once, at its highest tier.
    let mut tiered: BTreeMap<usize, (SplitSeam, &CutCandidate)> = BTreeMap::new();
    for candidate in candidates {
        let seam = if candidate.seam_cost < BLOCKING_SEAM_PENALTY {
            SplitSeam::Backed
        } else {
            SplitSeam::Character
        };
        tiered.insert(candidate.pos, (seam, candidate));
    }
    let hinted_tiers = hinted
        .admitted
        .iter()
        .map(|candidate| {
            let seam = if candidate.seam_cost < BLOCKING_SEAM_PENALTY {
                SplitSeam::Hinted
            } else {
                SplitSeam::HintedFlagged
            };
            (seam, candidate)
        })
        .chain(
            hinted
                .refused
                .iter()
                .map(|candidate| (SplitSeam::HintedRefused, candidate)),
        );
    for (seam, candidate) in hinted_tiers {
        tiered
            .entry(candidate.pos)
            .and_modify(|entry| {
                if entry.0 > seam {
                    *entry = (seam, candidate);
                }
            })
            .or_insert((seam, candidate));
    }
    loop {
        let (over_hard_block, units, blocks) = match plan_sentence_at_cuts(&edges, input, &cuts) {
            PlanOutcome::NeedsRewrite {
                over_hard_block,
                units,
                blocks,
            } => (over_hard_block, units, blocks),
            done => return (done, extra),
        };
        let stuck = PlanOutcome::NeedsRewrite {
            over_hard_block,
            units,
            blocks: blocks.clone(),
        };
        let (from, to) = blocks[over_hard_block].tgt;
        let mid = (from + to) / 2;
        let width = |range: Range<usize>| {
            target_cps_chars(char_slice(&target_chars, range).trim(), &input.lang)
        };
        // Candidate ordering: first by seam tier; then candidates where both sides fit within one line's fit are preferred (otherwise after splitting it still reports `align-overfit`, just not exceeding hard); then seam cost; and finally closeness to the block midpoint.
        let mut options: Vec<(SplitSeam, usize, &CutCandidate, Vec<AlignEdge>)> = tiered
            .values()
            .filter(|(seam, candidate)| {
                (unadmitted_allowed || !seam.unadmitted())
                    && from < candidate.pos
                    && candidate.pos < to
                    && !cuts.contains(&candidate.pos)
                    && tried.insert(candidate.pos)
            })
            .filter_map(|&(seam, candidate)| {
                let left = width(from..candidate.pos);
                let right = width(candidate.pos..to);
                if left > input.params.hard || right > input.params.hard {
                    return None;
                }
                let over_fit =
                    usize::from(left > input.params.fit) + usize::from(right > input.params.fit);
                let split = split_edges_at(&edges, candidate.pos)?;
                boundary_stat(&split, candidate.pos, input.tau)
                    .safe()
                    .then_some((seam, over_fit, candidate, split))
            })
            .collect();
        options.sort_by(|a, b| {
            a.0.rank()
                .cmp(&b.0.rank())
                .then_with(|| a.1.cmp(&b.1))
                .then_with(|| a.2.seam_cost.total_cmp(&b.2.seam_cost))
                .then_with(|| a.2.pos.abs_diff(mid).cmp(&b.2.pos.abs_diff(mid)))
        });
        let Some((seam, _, candidate, split)) = options.into_iter().next() else {
            return (stuck, extra);
        };
        edges = split;
        cuts.push(candidate.pos);
        extra.push(SplitCut {
            pos: candidate.pos,
            seam,
        });
    }
}

/// Splits a soft edge that crosses target position `k` into two. A group of edges sharing one target range (a block's first-word edge and last-word edge) is split into "block first word ↔ left half" and "block last word ↔ right half". Returns `None` when a hard anchor crosses `k`, or when a group has only one edge (a one-word block).
fn split_edges_at(edges: &[AlignEdge], k: usize) -> Option<Vec<AlignEdge>> {
    let straddles = |edge: &AlignEdge| edge.tgt.start < k && k < edge.tgt.end;
    if edges.iter().any(|edge| edge.hard && straddles(edge)) {
        return None;
    }
    let mut out: Vec<AlignEdge> = edges
        .iter()
        .filter(|edge| !straddles(edge))
        .cloned()
        .collect();
    let mut groups: BTreeMap<(usize, usize), Vec<&AlignEdge>> = BTreeMap::new();
    for edge in edges.iter().filter(|edge| straddles(edge)) {
        groups
            .entry((edge.tgt.start, edge.tgt.end))
            .or_default()
            .push(edge);
    }
    for ((start, end), group) in groups {
        let lo = group.iter().map(|edge| edge.src).min()?;
        let hi = group.iter().map(|edge| edge.src).max()?;
        if lo >= hi {
            return None;
        }
        let weight = group.iter().map(|edge| edge.weight).fold(1.0f32, f32::min);
        out.push(AlignEdge::soft(lo, start..k, weight));
        out.push(AlignEdge::soft(hi, k..end, weight));
    }
    Some(out)
}

/// Line partition plan (fused rows mode): the model has already split the translation into display lines in source-word order. The engine only **fixes the line boundaries** and adds fine-grained sub-blocks within each line.
///
/// `row_ranges` are the character ranges of each line on `input.target` (the output of [`crate::filepipe::align_edges::chunk_char_ranges`]), ascending in line order and not overlapping. Flow:
///
/// 1. Candidate cut points = regular target-language candidates ∪ each line start; run [`minimal_monotonic_blocks`];
/// 2. Every line start must actually become a block boundary (when it is crossed by an anchor edge, or the source break conflicts with an anchor, it will not become a block boundary). Otherwise the whole sentence returns `None`, and the caller falls back to the regular path;
/// 3. Only when a line exceeds hard is [`bilingual_dp`] run on that line's block sub-sequence to split it. This step **never crosses lines** (fragments can only fall inside the original line). If a line has no solution, the whole sentence returns `None`;
/// 4. [`merge_short_rows`]: deterministic post-processing that merges adjacent lines that are too short or too fast into one piece.
///
/// Block granularity: a line edge covers the whole line's target range with one edge, so cut points inside a line are necessarily crossed by it (unsafe). Therefore the blocks produced in steps 1–3 correspond one-to-one to the model's lines: `blocks` is at line level, not phrase level. Likewise, a line that exceeds hard has no independent evidence to cut within the line, so step 3 in practice always ends in `None` (fall back to the regular path) rather than forcing a cut by proportional anchoring.
///
/// Step 4 merges only **pieces** (`groups`), not `blocks`. A piece, being a union of consecutive blocks, is already the regular shape of [`plan_entry`], so I3/I4 hold automatically. The block layer still records, line by line, the model's source-word ↔ translation correspondence, so downstream bilingual highlighting does not get coarser through merging.
///
/// On success, `aligner` and `text_basis` are taken from `input`, and `correspondence` is [`Correspondence::Block`] (handled by [`plan_entry`]).
///
/// **This function is not the main path for `density == Paired`.** It is reachable only when translate carries fused rows drafts. The real paired entry points (`--align-only`: check's fix runs, `refine-align`, client-directed reruns) pass empty `FusionDrafts` and go through [`plan_sentence`] → [`bilingual_dp`] → `pair_cost`. The paired branch in [`merge_short_rows`] therefore serves only the rows-draft path; paired width relaxation lives in `pair_cost`.
pub fn plan_sentence_rows(
    edges: &[AlignEdge],
    row_ranges: &[Range<usize>],
    input: &BilingualPlanInput,
) -> Option<RowPlan> {
    let n = input.words.len();
    let target_chars: Vec<char> = input.target.chars().collect();
    let target_len = target_chars.len();
    if n == 0 || target_len == 0 || row_ranges.is_empty() {
        return None;
    }
    let edges: Vec<AlignEdge> = edges
        .iter()
        .filter(|edge| edge.src < n && edge.tgt.start < edge.tgt.end && edge.tgt.end <= target_len)
        .cloned()
        .collect();
    if edges.iter().filter(|edge| edge.counted(input.tau)).count() == 0 {
        return None;
    }

    // A line start (except the first line) is a position that must fall on a block boundary; whitespace and punctuation between lines go to the left line.
    let mut row_starts: Vec<usize> = Vec::with_capacity(row_ranges.len());
    let mut previous_end = 0usize;
    for (index, range) in row_ranges.iter().enumerate() {
        if range.start < previous_end || range.end > target_len || range.start >= range.end {
            return None;
        }
        row_starts.push(if index == 0 { 0 } else { range.start });
        previous_end = range.end;
    }

    let mut candidates: Vec<usize> = target_cut_candidates(
        &input.target,
        &input.lang,
        &input.params,
        &input.protected_terms,
    )
    .into_iter()
    .map(|candidate| candidate.pos)
    .collect();
    candidates.extend(row_starts.iter().skip(1).copied());
    candidates.sort_unstable();
    candidates.dedup();

    let blocks =
        minimal_monotonic_blocks(&edges, &input.words, &input.target, &candidates, input.tau);
    if blocks.is_empty() {
        return None;
    }

    // Every line start must be the start of some block; also record that block's index so lines can be grouped.
    let mut row_block_starts = Vec::with_capacity(row_starts.len());
    for &start in &row_starts {
        row_block_starts.push(blocks.iter().position(|block| block.tgt.0 == start)?);
    }
    if row_block_starts.windows(2).any(|pair| pair[0] >= pair[1]) {
        return None;
    }

    let mut groups: Vec<Vec<usize>> = Vec::with_capacity(blocks.len());
    for (row, &first) in row_block_starts.iter().enumerate() {
        let last = row_block_starts
            .get(row + 1)
            .copied()
            .unwrap_or(blocks.len());
        let text = char_slice(&target_chars, blocks[first].tgt.0..blocks[last - 1].tgt.1);
        if target_cps_chars(text.trim(), &input.lang) <= input.params.hard {
            groups.push((first..last).collect());
            continue;
        }
        // If a line itself exceeds hard, cut only within that line's block sub-sequence; line boundaries stay fixed.
        let inner = bilingual_dp(&blocks[first..last], input)?;
        for group in inner {
            groups.push(group.into_iter().map(|index| index + first).collect());
        }
    }
    let rows = groups.len();
    let groups = merge_short_rows(&blocks, groups, input, &target_chars);
    Some(RowPlan {
        merged_rows: rows - groups.len(),
        entry: plan_entry(&blocks, &groups, input),
    })
}

/// Result of [`plan_sentence_rows`]: the entry, plus the number of rows merged away by deterministic post-processing.
#[derive(Debug, Clone, PartialEq)]
pub struct RowPlan {
    pub entry: TransAlign,
    /// Number of model-given rows minus the final number of pieces. `0` means the model's split was adopted as-is.
    pub merged_rows: usize,
}

/// Reading-speed ceiling for a line that is "too short" (reading units per second): exceeding it means it flashes past.
const ROW_MAX_CPS: f64 = 6.0;
/// Width floor for a line that is "too short" (reading units).
pub const ROW_MIN_UNITS: usize = 6;

/// A piece's (union of consecutive blocks') target text, reading units, and shared time window in seconds.
fn row_metrics(
    blocks: &[AlignBlock],
    group: &[usize],
    input: &BilingualPlanInput,
    target_chars: &[char],
) -> (usize, f64) {
    let (Some(&first), Some(&last)) = (group.first(), group.last()) else {
        return (0, 0.0);
    };
    let text = char_slice(target_chars, blocks[first].tgt.0..blocks[last].tgt.1);
    let units = target_cps_chars(text.trim(), &input.lang);
    let from = blocks[first].src.0;
    let to = blocks[last].src.1;
    let seconds = (input.words[to].t1 - input.words[from].t0).max(0.0);
    (units, seconds)
}

/// Deterministic line merging (rows-mode post-processing).
///
/// Measurements show the model basically splits lines one-to-one according to source-side grouping (third comparison round: 4.3 lines per sentence against 2.3 lines for the regular fused path, median 10.7% at cps>6). The "prefer merging" wording in the contract is nearly ineffective. Width, reading speed and duration are all computable, so the engine now closes them out deterministically, instead of spending one more call persuading the model.
///
/// Criteria (for two adjacent pieces `i` / `i+1` in the same sentence; either one being "too short" triggers it):
///
/// - **Too fast** = reading speed > [`ROW_MAX_CPS`];
/// - **Too small** = duration < `min_duration_sec` (default 1.0s), or width < [`ROW_MIN_UNITS`];
/// - The merge guard is **tiered**: a merge triggered by "too fast" is allowed up to `params.hard` (20), while one triggered only by "too small" still respects `params.fit` (16). This matches the trade-off in the `on` DP: in [`pair_cost`], exceeding fit is only a penalty, and only exceeding hard is a hard constraint, whereas reading speed has no cheap remedy. In the fourth comparison round, rows' overFit had already dropped to 1–2%, while cps>6 still stood at 12–13% (`on` median 7.9%). Yielding width to reading speed is exactly the missing step;
/// - Both tiers must still satisfy merged duration ≤ `max_duration_sec` (default 7s);
/// - When a piece can merge with either neighbour, take the side whose **merged reading speed is lower** (ties go left, which guarantees determinism);
/// - Iterate until no legal merge remains (each merge reduces the piece count by one, so it necessarily converges).
///
/// Fragments that the DP re-split out of an over-hard line are not glued back here: both tier guards are ≤ hard, and those fragments were split apart precisely because together they exceed hard.
fn merge_short_rows(
    blocks: &[AlignBlock],
    mut groups: Vec<Vec<usize>>,
    input: &BilingualPlanInput,
    target_chars: &[char],
) -> Vec<Vec<usize>> {
    if input.words.is_empty() {
        return groups;
    }
    let metrics = |group: &[usize]| row_metrics(blocks, group, input, target_chars);
    // Too fast: reading speed exceeds the ceiling, and only a longer time window can remedy it ⇒ the merge guard is relaxed to hard.
    let too_fast = |group: &[usize]| {
        let (units, seconds) = metrics(group);
        seconds > 0.0 && units as f64 / seconds > ROW_MAX_CPS
    };
    // Too small: a flashing fragment line ⇒ the merge guard still respects fit.
    let too_small = |group: &[usize]| {
        let (units, seconds) = metrics(group);
        seconds < input.min_duration_sec
            || (input.density == AlignDensity::Auto && units < ROW_MIN_UNITS)
    };
    // Whether merging `groups[index]` with `groups[index + 1]` is legal; if legal, return the merged reading speed.
    let joined_cps = |groups: &[Vec<usize>], index: usize| -> Option<f64> {
        let mut joined = groups[index].clone();
        joined.extend_from_slice(&groups[index + 1]);
        let (units, seconds) = metrics(&joined);
        // Guard tiering: if either piece in the pair is "too fast", the width limit is raised to hard.
        let ceiling = if too_fast(&groups[index]) || too_fast(&groups[index + 1]) {
            input.params.hard
        } else {
            input.params.fit
        };
        if units > ceiling || seconds > input.max_duration_sec {
            return None;
        }
        // A merge triggered only by "width too narrow" must not produce a sticky row (the `align-row-deficit` dwell predicate): narrowness is a layout preference, while stickiness is a user-visible defect. Reading speed being too fast or duration being too short are physiological guardrails and may still be merged.
        let physiological =
            |group: &[usize]| too_fast(group) || metrics(group).1 < input.min_duration_sec;
        if !physiological(&groups[index])
            && !physiological(&groups[index + 1])
            && groups.len() <= input.sentence_source_rows()
            && input.piece_dwell_deficit(
                blocks[joined[0]].src.0,
                blocks[joined[joined.len() - 1]].src.1,
            )
        {
            return None;
        }
        Some(if seconds > 0.0 {
            units as f64 / seconds
        } else {
            f64::INFINITY
        })
    };
    while groups.len() > 1 {
        let mut chosen: Option<usize> = None;
        for index in 0..groups.len() {
            if !too_fast(&groups[index]) && !too_small(&groups[index]) {
                continue;
            }
            let left = (index > 0)
                .then(|| joined_cps(&groups, index - 1))
                .flatten();
            let right = (index + 1 < groups.len())
                .then(|| joined_cps(&groups, index))
                .flatten();
            chosen = match (left, right) {
                // Ties go left, so the merge result is independent of traversal order.
                (Some(left_cps), Some(right_cps)) => Some(if right_cps < left_cps {
                    index
                } else {
                    index - 1
                }),
                (Some(_), None) => Some(index - 1),
                (None, Some(_)) => Some(index),
                (None, None) => continue,
            };
            break;
        }
        let Some(index) = chosen else {
            break;
        };
        let tail = groups.remove(index + 1);
        groups[index].extend(tail);
    }
    groups
}

/// Block-layer invariants I3 / I4 (design §2, §5). An empty `blocks` is always valid (legacy entries / independent). When non-empty:
///
/// - Only manyToOne is allowed; with `correspondence: sentence` there must be exactly one block;
/// - I3: source spans cover `0..anchor_count` contiguously and in order; target spans cover `0..concat(pieces.text).chars().count()` contiguously and in order; each block's target span is non-empty;
/// - I4: each piece's `from` and the starting character offset of its `text` fall on the start of **the same** block (a piece is a union of consecutive blocks; both sides agree).
///
/// The caller ([`crate::split::align_entry_valid`]) has already guaranteed that pieces are contiguous and fully covering.
pub fn validate_blocks(entry: &TransAlign, anchor_count: usize) -> bool {
    if entry.blocks.is_empty() {
        return true;
    }
    if entry.mode != AlignMode::ManyToOne || anchor_count == 0 {
        return false;
    }
    if entry.correspondence() == Correspondence::Sentence && entry.blocks.len() != 1 {
        return false;
    }
    let concat_len: usize = entry
        .pieces
        .iter()
        .map(|piece| piece.text.chars().count())
        .sum();
    let mut expected_src = 0usize;
    let mut expected_tgt = 0usize;
    for block in &entry.blocks {
        if block.src.0 != expected_src || block.src.1 < block.src.0 {
            return false;
        }
        if block.tgt.0 != expected_tgt || block.tgt.1 <= block.tgt.0 {
            return false;
        }
        expected_src = block.src.1 + 1;
        expected_tgt = block.tgt.1;
    }
    if expected_src != anchor_count || expected_tgt != concat_len {
        return false;
    }
    let mut offset = 0usize;
    let mut previous_index: Option<usize> = None;
    for piece in &entry.pieces {
        let Some(from) = piece.from else {
            return false;
        };
        let by_src = entry.blocks.iter().position(|block| block.src.0 == from);
        let by_tgt = entry.blocks.iter().position(|block| block.tgt.0 == offset);
        match (by_src, by_tgt) {
            (Some(a), Some(b)) if a == b => {
                if previous_index.is_some_and(|prev| a <= prev) {
                    return false;
                }
                previous_index = Some(a);
            }
            _ => return false,
        }
        offset += piece.text.chars().count();
    }
    true
}

/// Text fingerprint of the translation, used for `transDisplay.transFingerprint`.
pub fn trans_text_fingerprint(text: &str) -> String {
    fingerprint_strings([text])
}

/// display-stale (design §5): the sentence ids whose `transDisplay[lang][sid].transFingerprint` does not match the current text fingerprint of `trans[lang][sid]` (or where `trans` no longer exists), in the order of the sentences passed in.
pub fn stale_display_sentences(
    doc: &TranscriptDoc,
    lang: &str,
    sentences: &[Sentence],
) -> Vec<String> {
    let Some(displays) = doc.trans_display.get(lang) else {
        return Vec::new();
    };
    let translations = doc.trans.get(lang);
    sentences
        .iter()
        .filter(|sentence| {
            displays.get(&sentence.id).is_some_and(|display| {
                translations
                    .and_then(|table| table.get(&sentence.id))
                    .is_none_or(|text| trans_text_fingerprint(text) != display.trans_fingerprint)
            })
        })
        .map(|sentence| sentence.id.clone())
        .collect()
}

/// Deletes display-stale `transDisplay` entries, along with the `transAlign` of those sentences whose `text_basis == display` (reverting to the natural translated sentence shown as a whole). Returns the number of `transDisplay` entries deleted.
pub fn purge_stale_display(doc: &mut TranscriptDoc, lang: &str, sentences: &[Sentence]) -> usize {
    let stale = stale_display_sentences(doc, lang, sentences);
    if stale.is_empty() {
        return 0;
    }
    let mut removed = 0usize;
    if let Some(displays) = doc.trans_display.get_mut(lang) {
        for sid in &stale {
            if displays.remove(sid).is_some() {
                removed += 1;
            }
        }
        if displays.is_empty() {
            doc.trans_display.remove(lang);
        }
    }
    if let Some(aligns) = doc.trans_align.get_mut(lang) {
        for sid in &stale {
            if aligns
                .get(sid)
                .is_some_and(|entry| entry.text_basis == TextBasis::Display)
            {
                aligns.remove(sid);
            }
        }
        if aligns.is_empty() {
            doc.trans_align.remove(lang);
        }
    }
    removed
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atomize::is_cjk_char;
    use crate::cue::{CueParams, derive_cues};
    use crate::doc::{DocEngine, DocMedia, Speaker, TransDisplay, Word};
    use crate::sentence::derive_sentences;
    use crate::split::{align_entry_valid, align_entry_valid_for_lang, derive_trans_cues};

    /// Anchored words spaced evenly at 0.4s.
    fn words(texts: &[&str]) -> Vec<AnchorWord> {
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| AnchorWord {
                id: format!("g1.{index}"),
                text: (*text).to_owned(),
                t0: index as f64 * 0.4,
                t1: index as f64 * 0.4 + 0.4,
                glue: false,
            })
            .collect()
    }

    /// Character range of `needle` in `haystack` (first hit).
    fn span(haystack: &str, needle: &str) -> Range<usize> {
        let byte = haystack
            .find(needle)
            .unwrap_or_else(|| panic!("{needle} in {haystack}"));
        let start = haystack[..byte].chars().count();
        start..start + needle.chars().count()
    }

    fn soft(src: usize, target: &str, needle: &str) -> AlignEdge {
        AlignEdge::soft(src, span(target, needle), 0.8)
    }

    fn concat(entry: &TransAlign) -> String {
        entry.pieces.iter().map(|p| p.text.as_str()).collect()
    }

    fn assert_invariants(entry: &TransAlign, word_count: usize) {
        assert!(validate_blocks(entry, word_count), "I3/I4: {entry:#?}");
        let mut expected = 0usize;
        for piece in &entry.pieces {
            assert_eq!(piece.from, Some(expected), "{entry:#?}");
            expected = piece.to.unwrap() + 1;
        }
        assert_eq!(expected, word_count);
    }

    /// Splitting within a block: the model's cut is admitted, and the second block has 30 characters, exceeding hard 20 ⇒ find one lint-clean seam inside the block and cut once more. The first block and the model's cut point are kept as they are; the two edges of the split block are halved at the cut point, and the new cut is then judged safe. A one-word block, or a position crossed by a hard anchor, cannot be split.
    #[test]
    fn over_hard_block_is_split_in_place_at_a_clean_target_seam() {
        let src = words(&[
            "alpha", "bravo", "charlie", "delta", "echo,", "foxtrot", "golf", "hotel.",
        ]);
        let target = "第一段译文需要自然对应，第二段译文负责完整收尾这一块写得太长超过了二十个字。";
        let first = "第一段译文需要自然对应，".chars().count();
        let total = target.chars().count();
        let edges = vec![
            AlignEdge::soft(0, 0..first, 0.8),
            AlignEdge::soft(4, 0..first, 0.8),
            AlignEdge::soft(5, first..total, 0.8),
            AlignEdge::soft(7, first..total, 0.8),
        ];
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        assert!(matches!(
            plan_sentence_at_cuts(&edges, &input, &[first]),
            PlanOutcome::NeedsRewrite {
                over_hard_block: 1,
                ..
            }
        ));
        let candidates = target_cut_candidates(target, "zh", &input.params, &[]);
        let (outcome, extra) = plan_sentence_splitting_over_hard(
            &edges,
            &input,
            &[first],
            &candidates,
            &HintedCuts::default(),
        );
        let PlanOutcome::Aligned(entry) = outcome else {
            panic!("{outcome:?}");
        };
        assert_eq!(extra.len(), 1, "{extra:?}");
        assert_eq!(extra[0].seam, SplitSeam::Character, "{extra:?}");
        let k = extra[0].pos;
        assert!(first < k && k < total);
        assert!(k - first <= input.params.hard && total - k <= input.params.hard);
        assert_eq!(entry.pieces.len(), 3, "{entry:#?}");
        assert_eq!(entry.pieces[0].text, "第一段译文需要自然对应，");
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.pieces[2].to, Some(7));
        assert_eq!(concat(&entry), target);
        assert_invariants(&entry, src.len());

        // A one-word block has only one edge and cannot be split, so it stays NeedsRewrite for the rewrite round.
        let single = vec![
            AlignEdge::soft(0, 0..first, 0.8),
            AlignEdge::soft(6, 0..first, 0.8),
            AlignEdge::soft(7, first..total, 0.8),
        ];
        let (outcome, extra) = plan_sentence_splitting_over_hard(
            &single,
            &input,
            &[first],
            &candidates,
            &HintedCuts::default(),
        );
        assert!(extra.is_empty());
        assert!(
            matches!(outcome, PlanOutcome::NeedsRewrite { .. }),
            "{outcome:?}"
        );
        // Positions crossed by a hard anchor cannot be split.
        let mut anchored = edges.clone();
        anchored.push(AlignEdge::hard(6, first + 2..total - 2));
        assert!(split_edges_at(&anchored, first + 10).is_none());
        assert!(split_edges_at(&edges, first + 10).is_some());
    }

    /// Seam tier comes before fit: a punctuation seam with one side slightly over fit beats a character-level seam where both sides fit (cases like the intra-word cut `看到什|么机会`). Blocks that need two cuts, where only character-level seams exist, are still handed to the rewrite round.
    #[test]
    fn a_backed_seam_outranks_a_character_seam_that_fits_both_sides() {
        let src = words(&[
            "alpha", "bravo", "charlie", "delta", "echo,", "foxtrot", "golf", "hotel.",
        ]);
        let head = "第一段译文需要自然对应，";
        let body = "我们在这个项目里面讨论过的所有细节，今天都需要重新确认一遍。";
        let target = format!("{head}{body}");
        let first = head.chars().count();
        let total = target.chars().count();
        let punct = first + "我们在这个项目里面讨论过的所有细节，".chars().count();
        let edges = vec![
            AlignEdge::soft(0, 0..first, 0.8),
            AlignEdge::soft(4, 0..first, 0.8),
            AlignEdge::soft(5, first..total, 0.8),
            AlignEdge::soft(7, first..total, 0.8),
        ];
        let input = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        assert!(punct - first > input.params.fit && punct - first <= input.params.hard);
        let candidates = target_cut_candidates(&target, "zh", &input.params, &[]);
        let both_fit = |pos: usize| {
            pos > first && pos - first <= input.params.fit && total - pos <= input.params.fit
        };
        assert!(
            candidates
                .iter()
                .any(|c| c.seam_cost >= BLOCKING_SEAM_PENALTY && both_fit(c.pos)),
            "the probe needs a character seam that fits both sides: {candidates:?}"
        );
        let (outcome, extra) = plan_sentence_splitting_over_hard(
            &edges,
            &input,
            &[first],
            &candidates,
            &HintedCuts::default(),
        );
        assert!(matches!(outcome, PlanOutcome::Aligned(_)), "{outcome:?}");
        assert_eq!(
            extra,
            vec![SplitCut {
                pos: punct,
                seam: SplitSeam::Backed
            }]
        );

        // Two cuts needed and only character-level seams: do not cut.
        let long =
            "这一块译文没有任何标点可以依托一直写到超过两行的长度才算把话说完整了结束为止才行的";
        let target = format!("{head}{long}");
        let total = target.chars().count();
        assert!(total - first > 2 * input.params.hard);
        let edges = vec![
            AlignEdge::soft(0, 0..first, 0.8),
            AlignEdge::soft(4, 0..first, 0.8),
            AlignEdge::soft(5, first..total, 0.8),
            AlignEdge::soft(7, first..total, 0.8),
        ];
        let input = BilingualPlanInput::new(src, &target, "en", "zh");
        let candidates = target_cut_candidates(&target, "zh", &input.params, &[]);
        let (outcome, extra) = plan_sentence_splitting_over_hard(
            &edges,
            &input,
            &[first],
            &candidates,
            &HintedCuts::default(),
        );
        assert!(extra.is_empty(), "{extra:?}");
        assert!(
            matches!(outcome, PlanOutcome::NeedsRewrite { .. }),
            "{outcome:?}"
        );
    }

    /// A block reached only through model hints (none of the evidence cut points were admitted): if the hint cannot be snapped, it stays `NeedsRewrite` and is not filled with a character-level seam (like the `软|件产品` case in how-claude `s-g33.0`); if the hint can be snapped, cut by `Hinted`.
    #[test]
    fn a_hint_only_ladder_never_falls_through_to_a_character_seam() {
        let src = words(&["alpha", "bravo", "charlie", "delta", "echo", "foxtrot."]);
        let target = "这一块译文没有任何标点可以依托一直写到超过一行的长度";
        let total = target.chars().count();
        let edges = vec![
            AlignEdge::soft(0, 0..total, 0.8),
            AlignEdge::soft(5, 0..total, 0.8),
        ];
        let input = BilingualPlanInput::new(src, target, "en", "zh");
        assert!(total > input.params.hard && total <= 2 * input.params.hard);
        let candidates = target_cut_candidates(target, "zh", &input.params, &[]);
        assert!(
            candidates
                .iter()
                .any(|c| c.seam_cost >= BLOCKING_SEAM_PENALTY
                    && c.pos <= input.params.hard
                    && total - c.pos <= input.params.hard),
            "the probe needs a character seam that fits: {candidates:?}"
        );
        let (outcome, extra) = plan_sentence_splitting_over_hard(
            &edges,
            &input,
            &[],
            &candidates,
            &HintedCuts::default(),
        );
        assert!(extra.is_empty(), "{extra:?}");
        assert!(
            matches!(outcome, PlanOutcome::NeedsRewrite { .. }),
            "{outcome:?}"
        );

        let hint = "这一块译文没有任何标点可以依托".chars().count();
        let hinted = hinted_cut_candidates(target, "zh", &input.params, &[], &[hint]);
        assert_eq!(hinted.admitted.len(), 1, "{hinted:?}");
        assert!(hinted.refused.is_empty(), "{hinted:?}");
        let (outcome, extra) =
            plan_sentence_splitting_over_hard(&edges, &input, &[], &candidates, &hinted);
        assert!(matches!(outcome, PlanOutcome::Aligned(_)), "{outcome:?}");
        // This hint seam carries a lint-admitted dangling tail and falls into the `HintedFlagged` tier. The hint-only ladder uses it too, but it ranks after clean seams when any exist.
        assert_eq!(
            extra,
            vec![SplitCut {
                pos: hinted.admitted[0].pos,
                seam: SplitSeam::HintedFlagged
            }]
        );
    }

    /// A model hint rejected by the lint (here a weak tail ending in “得”) forms a tier of its own. In a ladder with evidence cut points it substitutes for a character-level seam (§8.9); in a hint-only ladder it is still not used, and the block stays `NeedsRewrite`.
    #[test]
    fn a_refused_hint_outranks_a_character_seam_but_never_carries_a_hint_only_ladder() {
        let src = words(&[
            "alpha", "bravo", "charlie", "delta", "echo,", "foxtrot", "golf", "hotel.",
        ]);
        let target = "第一段译文需要自然对应，第二段译文负责完整收尾这一块写得太长超过了二十个字。";
        let first = "第一段译文需要自然对应，".chars().count();
        let hint = first + "第二段译文负责完整收尾这一块写得".chars().count();
        let total = target.chars().count();
        let edges = vec![
            AlignEdge::soft(0, 0..first, 0.8),
            AlignEdge::soft(4, 0..first, 0.8),
            AlignEdge::soft(5, first..total, 0.8),
            AlignEdge::soft(7, first..total, 0.8),
        ];
        let input = BilingualPlanInput::new(src, target, "en", "zh");
        let candidates = target_cut_candidates(target, "zh", &input.params, &[]);
        assert!(
            candidates.iter().all(|c| c.pos != hint),
            "the probe hint must not be a strict candidate: {candidates:?}"
        );
        let hinted = hinted_cut_candidates(target, "zh", &input.params, &[], &[hint]);
        assert!(hinted.admitted.is_empty(), "{hinted:?}");
        assert_eq!(hinted.refused.len(), 1, "{hinted:?}");
        assert_eq!(hinted.refused[0].pos, hint);

        // With evidence cut points: a rejected hint beats the character-level seam that would otherwise have been chosen.
        let (outcome, extra) =
            plan_sentence_splitting_over_hard(&edges, &input, &[first], &candidates, &hinted);
        let PlanOutcome::Aligned(entry) = outcome else {
            panic!("{outcome:?}");
        };
        assert_eq!(
            extra,
            vec![SplitCut {
                pos: hint,
                seam: SplitSeam::HintedRefused
            }]
        );
        assert_eq!(entry.pieces.len(), 3, "{entry:#?}");
        assert_eq!(entry.pieces[1].text, "第二段译文负责完整收尾这一块写得");
        assert_eq!(concat(&entry), target);

        // Hint-only: neither the rejected hint nor the character-level seam is used.
        let (outcome, extra) =
            plan_sentence_splitting_over_hard(&edges, &input, &[], &candidates, &hinted);
        assert!(extra.is_empty(), "{extra:?}");
        assert!(
            matches!(outcome, PlanOutcome::NeedsRewrite { .. }),
            "{outcome:?}"
        );
    }

    #[test]
    fn causal_inversion_collapses_into_one_local_reorder_block() {
        // (a) I didn't go because I was sick. ↔ “因为我病了，所以没去。” (Chinese: “I was sick, so I didn't go.”)
        let src = words(&["I", "didn't", "go", "because", "I", "was", "sick."]);
        let target = "因为我病了，所以没去。";
        let edges = vec![
            soft(0, target, "我"),
            soft(1, target, "没"),
            soft(2, target, "去"),
            soft(3, target, "因为"),
            soft(6, target, "病了"),
        ];
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        let candidates: Vec<usize> = target_cut_candidates(target, "zh", &input.params, &[])
            .into_iter()
            .map(|c| c.pos)
            .collect();
        assert!(
            candidates.contains(&span(target, "所以").start),
            "{candidates:?}"
        );
        assert!(safe_boundaries(&edges, &candidates, DEFAULT_EDGE_TAU).is_empty());
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks.len(), 1, "{blocks:?}");
        assert_eq!(blocks[0].src, (0, 6));
        assert_eq!(blocks[0].tgt, (0, target.chars().count()));
        assert!(blocks[0].flags.contains(&"local-reorder".to_owned()));
        assert!(blocks[0].flags.contains(&"weak".to_owned()));
        match plan_sentence(&edges, &input) {
            PlanOutcome::Aligned(entry) => {
                assert_eq!(entry.pieces.len(), 1);
                assert_eq!(entry.blocks.len(), 1);
                assert_eq!(entry.correspondence, Some(Correspondence::Block));
                assert_eq!(concat(&entry), target);
                assert_invariants(&entry, src.len());
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn relative_clause_noun_phrase_is_one_block_while_the_rest_still_splits() {
        // (b) Only “the plan we discussed yesterday” ↔ “the plan we discussed yesterday” cross over.
        let src = words(&[
            "We",
            "should",
            "finalize",
            "the",
            "plan",
            "we",
            "discussed",
            "yesterday,",
            "and",
            "then",
            "notify",
            "the",
            "team.",
        ]);
        let target = "我们应该敲定我们昨天讨论的计划，然后通知团队。";
        let mut edges = vec![
            soft(0, target, "我们"),
            soft(1, target, "应该"),
            soft(2, target, "敲定"),
            soft(9, target, "然后"),
            soft(10, target, "通知"),
            soft(12, target, "团队"),
        ];
        // Inside the noun phrase: plan ↔ 计划, we ↔ 我们 (second one), discussed ↔ 讨论,
        // yesterday ↔ 昨天.
        let np_start = span(target, "敲定").end;
        let second_we = np_start..np_start + 2;
        edges.push(AlignEdge::soft(5, second_we.clone(), 0.8));
        edges.push(soft(7, target, "昨天"));
        edges.push(soft(6, target, "讨论"));
        edges.push(soft(4, target, "计划"));
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        let candidates: Vec<usize> = target_cut_candidates(target, "zh", &input.params, &[])
            .into_iter()
            .map(|c| c.pos)
            .collect();
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        // Noun-phrase block: source the..yesterday (3..7), target 我们昨天讨论的计划 (the plan we discussed yesterday),
        let np = blocks
            .iter()
            .find(|block| block.flags.contains(&"local-reorder".to_owned()))
            .unwrap_or_else(|| panic!("{blocks:#?}"));
        assert_eq!(np.src, (3, 7), "{blocks:#?}");
        let np_text: String = target
            .chars()
            .skip(np.tgt.0)
            .take(np.tgt.1 - np.tgt.0)
            .collect();
        assert!(np_text.starts_with("我们昨天讨论的计划"), "{np_text}");
        // The rest of the sentence is still split: there are blocks both before and after the noun phrase.
        assert!(blocks.len() >= 3, "{blocks:#?}");
        assert!(blocks.iter().any(|b| b.src.1 < 3));
        assert!(blocks.iter().any(|b| b.src.0 > 7));
        // The article `the` does not dangle at the end of the previous block (the source seam legality folds it into the noun phrase).
        assert!(!blocks.iter().any(|b| b.src.1 == 3), "{blocks:#?}");
        match plan_sentence(&edges, &input) {
            PlanOutcome::Aligned(entry) => {
                assert!(entry.pieces.len() >= 2, "{entry:#?}");
                assert_invariants(&entry, src.len());
                for piece in &entry.pieces {
                    assert!(target_cps_chars(&piece.text, "zh") <= input.params.hard);
                }
                assert_eq!(
                    crate::atomize::normalize_chars(&concat(&entry)),
                    crate::atomize::normalize_chars(target)
                );
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn monotone_three_clause_sentence_yields_many_blocks_and_hard_safe_pieces() {
        // (c)
        let src = words(&[
            "We", "first", "analyze", "the", "data,", "then", "train", "the", "model,", "and",
            "finally", "deploy", "the", "service.",
        ]);
        let target = "我们先分析数据，然后训练模型，最后部署服务。";
        let edges = vec![
            soft(0, target, "我们"),
            soft(1, target, "先"),
            soft(2, target, "分析"),
            soft(4, target, "数据"),
            soft(5, target, "然后"),
            soft(6, target, "训练"),
            soft(8, target, "模型"),
            soft(10, target, "最后"),
            soft(11, target, "部署"),
            soft(13, target, "服务"),
        ];
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        let candidates: Vec<usize> = target_cut_candidates(target, "zh", &input.params, &[])
            .into_iter()
            .map(|c| c.pos)
            .collect();
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert!(blocks.len() >= 3, "{blocks:#?}");
        // An unaligned article `the` goes with the noun that follows, rather than dangling at the end of a block.
        for block in &blocks {
            let tail = src[block.src.1].text.to_ascii_lowercase();
            assert_ne!(tail, "the", "{blocks:#?}");
        }
        assert!(
            blocks
                .iter()
                .all(|b| !b.flags.contains(&"local-reorder".to_owned()))
        );
        match plan_sentence(&edges, &input) {
            PlanOutcome::Aligned(entry) => {
                assert!(entry.pieces.len() >= 2, "{entry:#?}");
                assert!(entry.blocks.len() >= 3);
                assert_invariants(&entry, src.len());
                for piece in &entry.pieces {
                    assert!(target_cps_chars(&piece.text, "zh") <= input.params.hard);
                    // Cut only at the comma seam.
                    assert!(
                        piece.text.ends_with('，') || piece.text.ends_with('。'),
                        "{entry:#?}"
                    );
                }
                assert!(entry.pieces.iter().all(|p| p.text.chars().count() > 3));
                assert_eq!(concat(&entry), target);
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn numbers_are_hard_anchors_that_travel_with_their_source_word() {
        // (d)
        let src = words(&[
            "By", "2028,", "sales", "will", "grow", "by", "50%", "or", "more.",
        ]);
        let refs: Vec<&str> = src.iter().map(|w| w.text.as_str()).collect();
        let target = "到 2028 年，销售额将增长 50% 或更多。";
        let ctx = AlignCtx {
            source_lang: "en".to_owned(),
            lang: "zh".to_owned(),
            protected_terms: Vec::new(),
        };
        let anchors = AnchorAligner.align(&refs, target, &ctx);
        assert_eq!(
            anchors,
            vec![
                AlignEdge::hard(1, span(target, "2028")),
                AlignEdge::hard(6, span(target, "50%")),
            ]
        );
        // Monotonic blocks can be obtained from hard anchors alone, and numbers stay in the same block as their source words.
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        let candidates: Vec<usize> = target_cut_candidates(target, "zh", &input.params, &[])
            .into_iter()
            .map(|c| c.pos)
            .collect();
        // The interior of a digit token is never a candidate cut point.
        let year = span(target, "2028");
        assert!(!candidates.iter().any(|&k| year.start < k && k < year.end));
        let blocks =
            minimal_monotonic_blocks(&anchors, &src, target, &candidates, DEFAULT_EDGE_TAU);
        for (needle, word) in [("2028", 1usize), ("50%", 6usize)] {
            let pos = span(target, needle).start;
            let block = blocks
                .iter()
                .find(|b| b.tgt.0 <= pos && pos < b.tgt.1)
                .unwrap();
            assert!(block.src.0 <= word && word <= block.src.1, "{blocks:#?}");
            assert!(block.flags.contains(&"anchor".to_owned()));
            assert_eq!(block.confidence, Some(1.0));
        }
        // Merged with soft edges: soft edges on the same source word are suppressed by the hard edge.
        let merged = merge_edges(vec![
            vec![
                AlignEdge::soft(1, 0..4, 0.7),
                AlignEdge::soft(2, span(target, "销售额"), 0.7),
            ],
            anchors.clone(),
        ]);
        assert!(merged.contains(&AlignEdge::hard(1, span(target, "2028"))));
        assert!(!merged.contains(&AlignEdge::soft(1, 0..4, 0.7)));
        assert!(merged.contains(&AlignEdge::soft(2, span(target, "销售额"), 0.7)));
        assert!(
            merged
                .windows(2)
                .all(|w| (w[0].src, w[0].tgt.start) <= (w[1].src, w[1].tgt.start))
        );
    }

    #[test]
    fn anchor_aligner_recognizes_urls_terms_and_verbatim_latin_but_needs_uniqueness() {
        let src = [
            "Open",
            "agentskills.io",
            "and",
            "run",
            "vLLM",
            "with",
            "the",
            "KV",
            "cache",
            "and",
            "the",
            "KV",
            "store.",
        ];
        let target = "打开 agentskills.io 并用 KV 缓存运行 vLLM，再用 KV 存储。";
        let ctx = AlignCtx {
            source_lang: "en".to_owned(),
            lang: "zh".to_owned(),
            protected_terms: vec![TermPair {
                source: "KV cache".to_owned(),
                target: "KV 缓存".to_owned(),
            }],
        };
        let edges = AnchorAligner.align(&src, target, &ctx);
        // Term pair → one hard edge per source-window word, over the same target range.
        let cache = span(target, "KV 缓存");
        assert!(edges.contains(&AlignEdge::hard(7, cache.clone())));
        assert!(edges.contains(&AlignEdge::hard(8, cache)));
        assert!(edges.contains(&AlignEdge::hard(1, span(target, "agentskills.io"))));
        assert!(edges.contains(&AlignEdge::hard(4, span(target, "vLLM"))));
        // KV appears twice on the source side and twice on the target side: the token anchor is abandoned (the term edge already covers the first occurrence).
        assert!(!edges.iter().any(|e| e.src == 11));
        // For a Latin target language only proper-noun forms count: sentence-initial `In` and lowercase function words produce no edges.
        let ctx_en = AlignCtx {
            source_lang: "de".to_owned(),
            lang: "en".to_owned(),
            protected_terms: Vec::new(),
        };
        let edges = AnchorAligner.align(
            &["In", "OpenAI", "no", "GPT-4"],
            "In OpenAI no GPT-4",
            &ctx_en,
        );
        assert_eq!(edges.iter().map(|e| e.src).collect::<Vec<_>>(), vec![1, 3]);
        // Whole-word numerals: `2028` does not match `2028.5` or `12,028`, but a sentence-final `2028.` still matches.
        let chars: Vec<char> = "in 2028.5 or 12,028 by 2028.".chars().collect();
        assert_eq!(whole_token_occurrences(&chars, "2028"), vec![23]);
    }

    #[test]
    fn unaligned_source_words_attach_to_previous_block_unless_the_seam_is_illegal() {
        // (e) "it" unaligned → merged into the previous block: "Read it | then sleep".
        let src = words(&["Read", "it", "then", "sleep."]);
        let target = "读吧，然后睡觉。";
        let edges = vec![
            soft(0, target, "读"),
            soft(2, target, "然后"),
            soft(3, target, "睡觉"),
        ];
        let candidates = vec![span(target, "然后").start];
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks.len(), 2, "{blocks:#?}");
        assert_eq!(blocks[0].src, (0, 1));
        assert_eq!(blocks[1].src, (2, 3));
        // A dangling conjunction `and` that is unaligned cannot merge into the previous block; it merges into the next one instead.
        let src = words(&["Read", "the", "book", "and", "sleep."]);
        let target = "读书，睡觉。";
        let edges = vec![
            soft(0, target, "读"),
            soft(2, target, "书"),
            soft(4, target, "睡觉"),
        ];
        let candidates = vec![span(target, "睡觉").start];
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks.len(), 2, "{blocks:#?}");
        assert_eq!(blocks[0].src, (0, 2));
        assert_eq!(blocks[1].src, (3, 4));
        // Leading unaligned words at the start of the sentence merge into the next block (the first block starts at 0).
        let src = words(&["Well,", "read", "then", "sleep."]);
        let target = "读吧，然后睡觉。";
        let edges = vec![
            soft(1, target, "读"),
            soft(2, target, "然后"),
            soft(3, target, "睡觉"),
        ];
        let candidates = vec![span(target, "然后").start];
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks[0].src, (0, 1), "{blocks:#?}");
    }

    #[test]
    fn source_break_prefers_punctuation_then_pause_inside_the_interval() {
        // (leftMax, rightMin] = (1, 3]: b ∈ {2, 3}; there is punctuation after "home," ⇒ b = 2.
        let src = words(&["Go", "home,", "and", "then", "sleep."]);
        let target = "回家，然后睡觉。";
        let edges = vec![
            soft(0, target, "回"),
            soft(1, target, "家"),
            soft(3, target, "然后"),
            soft(4, target, "睡觉"),
        ];
        let candidates = vec![span(target, "然后").start];
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks.len(), 2, "{blocks:#?}");
        assert_eq!(blocks[0].src, (0, 1));
        // Without punctuation, the pause decides: leave 1s of silence between "home" and "quickly".
        let mut src = words(&["Go", "home", "quickly", "then", "sleep."]);
        for word in &mut src[2..] {
            word.t0 += 1.0;
            word.t1 += 1.0;
        }
        let edges = vec![
            soft(0, target, "回"),
            soft(1, target, "家"),
            soft(3, target, "然后"),
            soft(4, target, "睡觉"),
        ];
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks[0].src, (0, 1), "{blocks:#?}");
        // Neither punctuation nor pause: merge into the previous block (quickly belongs to the preceding block).
        let src = words(&["Go", "home", "quickly", "then", "sleep."]);
        let blocks = minimal_monotonic_blocks(&edges, &src, target, &candidates, DEFAULT_EDGE_TAU);
        assert_eq!(blocks[0].src, (0, 2), "{blocks:#?}");
    }

    #[test]
    fn over_hard_block_requests_a_monotonic_rewrite() {
        // (f) The whole sentence is one block with target > hard (20 units).
        let src = words(&[
            "I", "didn't", "go", "because", "I", "was", "sick", "and", "tired.",
        ]);
        let target = "因为我当时既生病又非常疲惫不堪，所以最终没有去成。";
        assert!(target_cps_chars(target, "zh") > 20);
        let edges = vec![
            soft(0, target, "我"),
            soft(3, target, "因为"),
            soft(6, target, "生病"),
            soft(8, target, "疲惫"),
            soft(1, target, "没有"),
            soft(2, target, "去"),
        ];
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        match plan_sentence(&edges, &input) {
            PlanOutcome::NeedsRewrite {
                over_hard_block,
                units,
                blocks,
            } => {
                assert_eq!(over_hard_block, 0);
                assert!(units > 20);
                assert_eq!(blocks.len(), 1);
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn low_confidence_or_missing_evidence_degrades_to_sentence_level() {
        // (g)
        let src = words(&["We", "ship", "today."]);
        let target = "我们今天发货。";
        let edges = vec![
            AlignEdge::soft(0, span(target, "我们"), 0.3),
            AlignEdge::soft(2, span(target, "今天"), 0.3),
            AlignEdge::soft(1, span(target, "发货"), 0.3),
        ];
        let mut input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        input.tau = 0.2;
        match plan_sentence(&edges, &input) {
            PlanOutcome::SentenceLevel(entry) => {
                assert_eq!(entry.correspondence, Some(Correspondence::Sentence));
                assert_eq!(entry.correspondence(), Correspondence::Sentence);
                assert_eq!(entry.pieces.len(), 1);
                assert_eq!(entry.pieces[0].from, Some(0));
                assert_eq!(entry.pieces[0].to, Some(2));
                assert_eq!(entry.blocks.len(), 1);
                assert_eq!(entry.blocks[0].confidence, Some(0.3));
                assert_invariants(&entry, 3);
            }
            other => panic!("{other:?}"),
        }
        // No evidence at all ⇒ sentence-level correspondence; a group of edges with weight ≥ τ_s ⇒ block-level correspondence.
        assert!(matches!(
            plan_sentence(&[], &input),
            PlanOutcome::SentenceLevel(_)
        ));
        input.tau = DEFAULT_EDGE_TAU;
        let strong: Vec<AlignEdge> = edges
            .iter()
            .map(|e| AlignEdge::soft(e.src, e.tgt.clone(), 0.9))
            .collect();
        assert!(matches!(
            plan_sentence(&strong, &input),
            PlanOutcome::Aligned(_)
        ));
    }

    #[test]
    fn validate_blocks_rejects_piece_cuts_inside_a_block() {
        // (h)
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            vec!["g1.0".into(), "g1.1".into(), "g1.2".into(), "g1.3".into()],
            vec![
                TransPiece {
                    from: Some(0),
                    to: Some(1),
                    text: "甲乙，".to_owned(),
                },
                TransPiece {
                    from: Some(2),
                    to: Some(3),
                    text: "丙丁。".to_owned(),
                },
            ],
        );
        entry.correspondence = Some(Correspondence::Block);
        entry.blocks = vec![
            AlignBlock {
                src: (0, 1),
                tgt: (0, 3),
                confidence: Some(0.9),
                flags: Vec::new(),
            },
            AlignBlock {
                src: (2, 3),
                tgt: (3, 6),
                confidence: Some(0.9),
                flags: Vec::new(),
            },
        ];
        assert!(validate_blocks(&entry, 4));
        // The piece is cut inside a block: source-side from=1 is not a block start.
        let mut inside = entry.clone();
        inside.pieces[0].to = Some(0);
        inside.pieces[1].from = Some(1);
        assert!(!validate_blocks(&inside, 4));
        // Target side: the piece text's cut point does not fall on a block boundary.
        let mut inside = entry.clone();
        inside.pieces[0].text = "甲乙".to_owned();
        inside.pieces[1].text = "，丙丁。".to_owned();
        assert!(!validate_blocks(&inside, 4));
        // Source and target sides correspond to different blocks.
        let mut skew = entry.clone();
        skew.blocks[0].src = (0, 0);
        skew.blocks[1].src = (1, 3);
        assert!(!validate_blocks(&skew, 4));
        // I3: not contiguous / incomplete coverage / empty target span.
        let mut gap = entry.clone();
        gap.blocks[1].src = (3, 3);
        assert!(!validate_blocks(&gap, 4));
        let mut short = entry.clone();
        short.blocks[1].tgt = (3, 5);
        assert!(!validate_blocks(&short, 4));
        let mut empty = entry.clone();
        empty.blocks[0].tgt = (0, 0);
        empty.blocks[1].tgt = (0, 6);
        assert!(!validate_blocks(&empty, 4));
        // A sentence correspondence allows only one block; independent contains no blocks.
        let mut sentence = entry.clone();
        sentence.correspondence = Some(Correspondence::Sentence);
        assert!(!validate_blocks(&sentence, 4));
        let mut independent = entry.clone();
        independent.mode = AlignMode::Independent;
        assert!(!validate_blocks(&independent, 4));
        // No block layer is always valid (legacy entries).
        let mut legacy = entry.clone();
        legacy.blocks.clear();
        assert!(validate_blocks(&legacy, 4));
    }

    fn doc_with_sentence(texts: &[&str]) -> (TranscriptDoc, Vec<Sentence>) {
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
        doc.words = texts
            .iter()
            .enumerate()
            .map(|(index, text)| Word {
                id: format!("g1.{index}"),
                t0: index as f64 * 0.5,
                t1: index as f64 * 0.5 + 0.5,
                text: (*text).to_owned(),
                sp: "s1".to_owned(),
                glue: false,
            })
            .collect();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        (doc, sentences)
    }

    #[test]
    fn display_basis_entries_validate_and_project_against_trans_display() {
        // (i)
        let (mut doc, sentences) = doc_with_sentence(&["I", "didn't", "go", "because", "sick."]);
        let sid = sentences[0].id.clone();
        let natural = "因为我病了，所以没去。";
        let display = "我没有去，因为我生病了。";
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sid.clone(), natural.to_owned());
        doc.trans_display
            .entry("zh".to_owned())
            .or_default()
            .insert(
                sid.clone(),
                TransDisplay {
                    text: display.to_owned(),
                    basis: "monotonic-rewrite".to_owned(),
                    trans_fingerprint: trans_text_fingerprint(natural),
                },
            );
        let src: Vec<AnchorWord> = doc
            .words
            .iter()
            .map(|w| AnchorWord {
                id: w.id.clone(),
                text: w.text.clone(),
                t0: w.t0,
                t1: w.t1,
                glue: false,
            })
            .collect();
        let edges = vec![
            soft(0, display, "我"),
            soft(1, display, "没有"),
            soft(2, display, "去"),
            soft(3, display, "因为"),
            soft(4, display, "生病"),
        ];
        let mut input = BilingualPlanInput::new(src, display, "en", "zh");
        input.text_basis = TextBasis::Display;
        input.aligner = "llm-chunk+anchor/1".to_owned();
        // With the default fit=16 the whole sentence fits on one line, so the DP correctly does not split. Tighten the threshold to cover the two-piece path: the whole sentence is 10 units > hard 8, but each block is ≤ hard, so it must be split into two pieces.
        input.params = TransParams {
            fit: 6,
            soft: 5,
            hard: 8,
        };
        let PlanOutcome::Aligned(entry) = plan_sentence(&edges, &input) else {
            panic!("expected aligned");
        };
        assert_eq!(entry.text_basis, TextBasis::Display);
        assert_eq!(entry.aligner.as_deref(), Some("llm-chunk+anchor/1"));
        assert_eq!(entry.pieces.len(), 2, "{entry:#?}");
        assert_eq!(concat(&entry), display);
        // Base text parsing and validation: passes validation against display, fails against trans.
        assert_eq!(
            crate::split::basis_text(&doc, "zh", &sid, &entry),
            Some(display)
        );
        assert!(align_entry_valid(&doc, &sentences[0], display, &entry));
        assert!(!align_entry_valid(&doc, &sentences[0], natural, &entry));
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert(sid.clone(), entry);
        assert!(align_entry_valid_for_lang(
            &doc,
            &sentences[0],
            "zh",
            &doc.trans_align["zh"][&sid]
        ));
        let cues = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(cues.len(), 2, "{cues:#?}");
        assert_eq!(cues[0].text, "我没有去，");
        assert_eq!(cues[1].text, "因为我生病了。");
        assert!(cues.iter().all(|c| !c.fallback));
        assert_eq!(cues[0].word_span, Some((0, 2)));
        // Deleting transDisplay ⇒ base text missing ⇒ entry invalid ⇒ the natural translated sentence is shown as a whole.
        doc.trans_display.clear();
        assert!(!align_entry_valid_for_lang(
            &doc,
            &sentences[0],
            "zh",
            &doc.trans_align["zh"][&sid]
        ));
        let cues = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text, natural);
    }

    #[test]
    fn sentence_level_entry_projects_as_one_whole_sentence_cue() {
        let (mut doc, sentences) = doc_with_sentence(&["We", "ship", "today."]);
        let sid = sentences[0].id.clone();
        let target = "我们今天发货。";
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sid.clone(), target.to_owned());
        let src: Vec<AnchorWord> = doc
            .words
            .iter()
            .map(|w| AnchorWord {
                id: w.id.clone(),
                text: w.text.clone(),
                t0: w.t0,
                t1: w.t1,
                glue: false,
            })
            .collect();
        let input = BilingualPlanInput::new(src, target, "en", "zh");
        let entry = sentence_level_entry(&input, Some(0.2));
        assert!(align_entry_valid(&doc, &sentences[0], target, &entry));
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert(sid, entry);
        let cues = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].text, target);
        assert_eq!(cues[0].start, 0.0);
        assert_eq!(cues[0].end, 1.5);
        assert_eq!(cues[0].word_span, Some((0, 2)));
        // Fits on one line: not counted as a downgrade.
        assert!(!cues[0].fallback);
    }

    #[test]
    fn stale_display_is_detected_and_purged_with_its_display_alignment() {
        // (j)
        let (mut doc, sentences) = doc_with_sentence(&["We", "ship", "today."]);
        let sid = sentences[0].id.clone();
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sid.clone(), "我们今天发货。".to_owned());
        doc.trans_display
            .entry("zh".to_owned())
            .or_default()
            .insert(
                sid.clone(),
                TransDisplay {
                    text: "今天我们发货。".to_owned(),
                    basis: "monotonic-rewrite".to_owned(),
                    trans_fingerprint: trans_text_fingerprint("我们今天发货。"),
                },
            );
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            doc.words.iter().map(|w| w.id.clone()).collect(),
            vec![TransPiece {
                from: Some(0),
                to: Some(2),
                text: "今天我们发货。".to_owned(),
            }],
        );
        entry.text_basis = TextBasis::Display;
        entry.correspondence = Some(Correspondence::Block);
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert(sid.clone(), entry);
        assert!(stale_display_sentences(&doc, "zh", &sentences).is_empty());
        assert_eq!(purge_stale_display(&mut doc, "zh", &sentences), 0);
        // Changing the whole translated sentence ⇒ fingerprint mismatch ⇒ display-stale.
        doc.trans
            .get_mut("zh")
            .unwrap()
            .insert(sid.clone(), "我们今日发货。".to_owned());
        assert_eq!(
            stale_display_sentences(&doc, "zh", &sentences),
            vec![sid.clone()]
        );
        assert!(stale_display_sentences(&doc, "ja", &sentences).is_empty());
        assert_eq!(purge_stale_display(&mut doc, "zh", &sentences), 1);
        assert!(doc.trans_display.is_empty());
        assert!(
            doc.trans_align.is_empty(),
            "display-basis alignment must go too"
        );
        // Alignment on the trans basis is not affected by a stale display.
        doc.trans_display
            .entry("zh".to_owned())
            .or_default()
            .insert(
                sid.clone(),
                TransDisplay {
                    text: "x".to_owned(),
                    basis: "monotonic-rewrite".to_owned(),
                    trans_fingerprint: "stale".to_owned(),
                },
            );
        let mut trans_based = TransAlign::new(
            AlignMode::ManyToOne,
            doc.words.iter().map(|w| w.id.clone()).collect(),
            vec![TransPiece {
                from: Some(0),
                to: Some(2),
                text: "我们今日发货。".to_owned(),
            }],
        );
        trans_based.text_basis = TextBasis::Trans;
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert(sid.clone(), trans_based);
        assert_eq!(purge_stale_display(&mut doc, "zh", &sentences), 1);
        assert!(doc.trans_align["zh"].contains_key(&sid));
    }

    #[test]
    fn candidates_skip_protected_terms_and_objective_seams() {
        let params = TransParams::for_lang("zh");
        let target = "我们用 Claude Code 写字幕，稳定的流程很重要。";
        let candidates = target_cut_candidates(target, "zh", &params, &["Claude Code".to_owned()]);
        let term = span(target, "Claude Code");
        assert!(
            !candidates
                .iter()
                .any(|c| term.start < c.pos && c.pos < term.end)
        );
        // Model hints that fall inside a locked term are excluded from both piles: not admitted, and not counted as "rejected hints".
        let inside = term.start + "Claude ".chars().count();
        let hinted = hinted_cut_candidates(
            target,
            "zh",
            &params,
            &["Claude Code".to_owned()],
            &[inside],
        );
        assert!(
            hinted.admitted.is_empty() && hinted.refused.is_empty(),
            "{hinted:?}"
        );
        // A seam after “的” is an objective-defect seam: not a candidate.
        let de = span(target, "稳定的").end;
        assert!(!candidates.iter().any(|c| c.pos == de), "{candidates:?}");
        // The penalty for an inter-word whitespace seam is lower than for a CJK character-boundary seam; the whitespace goes to the left, and the cut lands on the first character of the right side.
        let after_code = candidates.iter().find(|c| c.pos == term.end + 1).unwrap();
        let cjk_seam = candidates
            .iter()
            .find(|c| c.pos == span(target, "字幕").start)
            .unwrap();
        assert!(after_code.seam_cost < cjk_seam.seam_cost);
        let chars: Vec<char> = target.chars().collect();
        assert!(is_cjk_char(chars[cjk_seam.pos]));
        // Positions are original-text character coordinates: the characters on either side of the cut match up.
        assert_eq!(chars[after_code.pos], '写');
        assert_eq!(chars[after_code.pos - 1], ' ');
        // Clause-punctuation seams are the cheapest.
        let comma = candidates
            .iter()
            .find(|c| c.pos == span(target, "稳定").start)
            .unwrap();
        assert!(comma.seam_cost < after_code.seam_cost);
    }

    /// Real case (IBM “AI safety trilemma”, s-g40.34): source line of 19 words / 5.8 s / 78 units; translation 20 units (over fit, exactly at hard). The block boundary already falls after “是，”, but the paired source seam `… two of is | we could …` ends with a copula and is judged illegal by its prefix lemma. The flat over-fit penalty (1.5) is always lighter than this bad source seam (BLOCKING + 0.8), so the DP would rather keep a whole line pinned at hard. check then reports `align-paired-density`, requiring a cut at the same seam, while rerunning align would produce the same blocks. So the over-fit cost must grow with width enough to outweigh a bad source seam, so that this cut is adopted here.
    fn dense_source_fixture() -> (Vec<AnchorWord>, &'static str, Vec<AlignBlock>) {
        let raw: [(&str, f64, f64); 19] = [
            ("And", 407.65, 408.2),
            ("then", 408.2, 408.36),
            ("ultimately,", 408.36, 408.45),
            ("the", 408.6, 408.77),
            ("other", 409.39, 409.56),
            ("thing", 409.56, 409.8),
            ("that", 409.8, 409.96),
            ("we", 409.96, 410.05),
            ("could", 410.05, 410.21),
            ("pick", 410.21, 410.38),
            ("two", 410.38, 410.62),
            ("of", 410.62, 410.78),
            ("is", 410.78, 410.95),
            ("we", 410.95, 411.11),
            ("could", 411.11, 411.2),
            ("pick", 411.2, 411.36),
            ("secure", 411.36, 412.18),
            ("and", 412.18, 412.59),
            ("speedy.", 412.59, 413.41),
        ];
        let words: Vec<AnchorWord> = raw
            .iter()
            .enumerate()
            .map(|(index, (text, t0, t1))| AnchorWord {
                id: format!("g40.{index}"),
                text: (*text).to_owned(),
                t0: *t0,
                t1: *t1,
                glue: false,
            })
            .collect();
        let target = "最后，还有一种二选法是，我们可以选安全和快速。";
        let block = |src: (usize, usize), tgt: (usize, usize)| AlignBlock {
            src,
            tgt,
            confidence: Some(0.75),
            flags: vec!["weak".to_owned()],
        };
        let blocks = vec![
            block((0, 2), (0, 3)),
            block((3, 12), (3, 12)),
            block((13, 15), (12, 17)),
            block((16, 18), (17, 23)),
        ];
        (words, target, blocks)
    }

    #[test]
    fn dense_source_row_is_split_at_the_clause_seam() {
        let (words, target, blocks) = dense_source_fixture();
        let input = BilingualPlanInput::new(words.clone(), target, "en", "zh");
        let groups = bilingual_dp(&blocks, &input).expect("feasible");
        assert!(
            groups.len() >= 2,
            "a 78-unit / 5.8 s source row paired with a 20-unit target must split: {groups:?}"
        );
        // The cut falls at the clause seam after “是，”, rather than leaving “我们可以选” stranded.
        let target_chars: Vec<char> = target.chars().collect();
        let first_piece_end = blocks[groups[0][groups[0].len() - 1]].tgt.1;
        assert_eq!(
            char_slice(&target_chars, 0..first_piece_end),
            "最后，还有一种二选法是，"
        );
        // Each line's source side is narrower than the whole line, and no translation line exceeds fit any longer.
        for group in &groups {
            let text = char_slice(
                &target_chars,
                blocks[group[0]].tgt.0..blocks[group[group.len() - 1]].tgt.1,
            );
            assert!(
                !exceeds_one_line_fit(text.trim(), "zh", input.params.fit),
                "{text}"
            );
        }
    }

    /// Same project, s-g7.0: `Generally speaking, though, | the smarter models …`.
    /// `though` is in the prefix lemma table, but the comma has already closed the parenthetical, so the line end here is not dangling. The old judgement treated this seam as illegal and penalised it heavily, so a 19-unit translation line was not cut.
    #[test]
    fn clause_punctuation_seals_a_source_seam_even_after_a_clinging_lexeme() {
        let raw: [(&str, f64, f64); 10] = [
            ("Generally", 64.95, 65.43),
            ("speaking,", 65.43, 66.06),
            ("though,", 66.06, 66.14),
            ("the", 66.14, 66.23),
            ("smarter", 66.31, 66.4),
            ("models", 66.4, 67.43),
            ("also", 67.43, 67.76),
            ("require", 67.76, 68.16),
            ("other", 68.94, 69.11),
            ("capabilities.", 69.11, 69.43),
        ];
        let words: Vec<AnchorWord> = raw
            .iter()
            .enumerate()
            .map(|(index, (text, t0, t1))| AnchorWord {
                id: format!("g7.{index}"),
                text: (*text).to_owned(),
                t0: *t0,
                t1: *t1,
                glue: false,
            })
            .collect();
        assert!(source_seam_legal(&words, 3), "though, | the");
        // Without punctuation closing it, a prefix lemma is still illegal: `the | smarter`.
        assert!(!source_seam_legal(&words, 4), "the | smarter");
        let target = "不过一般来说，越聪明的模型也需要其他能力。";
        let block = |src: (usize, usize), tgt: (usize, usize)| AlignBlock {
            src,
            tgt,
            confidence: Some(0.75),
            flags: vec!["weak".to_owned()],
        };
        let blocks = vec![
            block((0, 2), (0, 7)),
            block((3, 5), (7, 13)),
            block((6, 7), (13, 16)),
            block((8, 9), (16, 21)),
        ];
        let input = BilingualPlanInput::new(words, target, "en", "zh");
        let groups = bilingual_dp(&blocks, &input).expect("feasible");
        assert_eq!(groups.len(), 2, "{groups:?}");
        assert_eq!(groups[0], vec![0]);
    }

    /// Same project, s-g38.25 (the 52-word enumeration sentence): the pricing of enumeration-comma seams must be on the same basis as `seam::lint_pieces`. An enumeration comma is not a seam when the parallel items are split apart and the merged left and right pieces still do not exceed hard. When the candidate seam table prices by "left piece | entire remainder", the enumeration comma always looks cheap, so the DP split `它做的处理、` out into a line of its own. check then reported align-target-seam, while rerunning align only produced the same blocks.
    #[test]
    fn list_separator_is_not_a_seam_when_the_neighbours_fit_together() {
        let raw: [(&str, f64, f64); 52] = [
            ("Or", 379.83, 380.30),
            ("if", 380.38, 380.47),
            ("the", 380.47, 380.56),
            ("information", 380.56, 380.72),
            ("it", 380.72, 381.27),
            ("has,", 381.27, 381.44),
            ("or", 381.44, 382.15),
            ("the", 382.38, 382.39),
            ("processing", 382.54, 382.55),
            ("that", 382.55, 383.18),
            ("it's", 383.18, 383.27),
            ("doing,", 383.27, 383.51),
            ("the", 383.51, 384.15),
            ("output", 384.15, 385.42),
            ("that", 385.42, 385.51),
            ("we're", 385.51, 385.60),
            ("going", 386.21, 386.22),
            ("to", 386.30, 386.31),
            ("take,", 386.31, 386.39),
            ("and", 386.39, 386.71),
            ("the", 386.71, 386.80),
            ("decisions", 386.80, 386.81),
            ("we're", 386.88, 386.89),
            ("going", 386.97, 386.98),
            ("to", 386.98, 387.07),
            ("make,", 387.07, 387.15),
            ("and", 387.15, 387.47),
            ("the", 387.47, 387.56),
            ("actions", 387.56, 387.72),
            ("we'll", 387.72, 388.11),
            ("take", 388.11, 388.20),
            ("based", 388.20, 388.52),
            ("upon", 388.52, 388.76),
            ("that,", 388.76, 389.07),
            ("end", 389.30, 389.70),
            ("up", 389.70, 389.94),
            ("being", 389.94, 390.10),
            ("low", 390.10, 390.34),
            ("risk,", 390.34, 390.73),
            ("well,", 390.73, 391.12),
            ("then", 391.12, 391.36),
            ("it", 391.36, 391.53),
            ("doesn't", 391.53, 391.69),
            ("matter", 391.69, 391.93),
            ("if", 392.01, 392.09),
            ("the", 392.17, 392.33),
            ("AI", 392.33, 392.57),
            ("is", 392.57, 392.89),
            ("a", 392.89, 392.98),
            ("little", 392.98, 393.06),
            ("bit", 393.06, 393.23),
            ("off.", 393.23, 393.39),
        ];
        let block = |src: (usize, usize), tgt: (usize, usize)| AlignBlock {
            src,
            tgt,
            confidence: Some(0.75),
            flags: vec!["weak".to_owned()],
        };
        let blocks = vec![
            block((0, 0), (0, 3)),
            block((1, 1), (3, 5)),
            block((2, 5), (5, 12)),
            block((6, 11), (12, 18)),
            block((12, 18), (18, 27)),
            block((19, 25), (27, 35)),
            block((26, 33), (35, 47)),
            block((34, 38), (47, 56)),
            block((39, 40), (56, 58)),
            block((41, 51), (58, 72)),
        ];
        let target = "或者，如果它掌握的信息、它做的处理、我们要采用的输出、我们要做的决定，以及基于此要采取的行动，最终都是低风险的，那 AI 稍微有点偏差也无所谓。";
        let words: Vec<AnchorWord> = raw
            .iter()
            .enumerate()
            .map(|(index, (text, t0, t1))| AnchorWord {
                id: format!("g38.{index}"),
                text: (*text).to_owned(),
                t0: *t0,
                t1: *t1,
                glue: false,
            })
            .collect();
        let input = BilingualPlanInput::new(words, target, "en", "zh");
        let groups = bilingual_dp(&blocks, &input).expect("feasible");
        let target_chars: Vec<char> = target.chars().collect();
        let pieces: Vec<String> = groups
            .iter()
            .map(|group| {
                char_slice(
                    &target_chars,
                    blocks[group[0]].tgt.0..blocks[group[group.len() - 1]].tgt.1,
                )
            })
            .collect();
        for pair in pieces.windows(2) {
            let (left, right) = (pair[0].trim(), pair[1].trim());
            let merged = target_cps_chars(left, "zh") + target_cps_chars(right, "zh");
            assert!(
                !(ends_list_separator(left) && merged <= input.params.hard),
                "顿号后不该有一刀（合并后 {merged} ≤ hard）：{pieces:?}"
            );
        }
        // The cut check pointed at (after “采取的行动，”) is already made, so the 20-unit line no longer appears.
        assert!(
            pieces.iter().any(|piece| piece.ends_with("采取的行动，")),
            "{pieces:?}"
        );
        for piece in &pieces {
            assert!(
                target_cps_chars(piece.trim(), "zh") < input.params.hard,
                "{piece}"
            );
        }
    }

    // ---- Probe for paired density on the real `--align-only` path ----------------------

    /// The real `--align-only` path for the R1 shape (short translation + long source time window): `plan_sentence` → [`bilingual_dp`] → `pair_cost`, **not going through** [`plan_sentence_rows`] (that route is reachable only when translate carries fused rows drafts; `--align-only` passes empty drafts).
    ///
    /// This fixture is the acceptance anchor for paired semantics:
    /// - `Auto` must still converge to one piece (zero drift): the narrow-piece width penalty `((units-soft)/soft)²` outweighs the source-side time-window penalty;
    /// - `Paired` must split into ≥2 pieces. Once the width penalty for narrower-than-soft is zeroed, only the source-side width and time-window penalties for "whole sentence as one piece" dominate, and the DP cuts along the clause seam within the translation.
    fn r1_short_translation_fixture() -> (Vec<AnchorWord>, String, Vec<AlignEdge>) {
        // 14 words × 0.4s = 5.6s source time window: it falls in the soft band between PAIRED_SOURCE_MAX_SECONDS (4s) and PAIRED_SOURCE_HARD_SECONDS (6s). The whole-sentence source width also exceeds en's `source_fit` (42). Both terms penalise only "whole sentence as one piece", not the two pieces after splitting.
        let src = words(&[
            "And", "so", "I", "made", "up", "my", "mind", "then", "I", "started", "all", "over",
            "again", "there.",
        ]);
        // A translation well shorter than soft(14), with one clause seam in the middle (`seam_penalty` records 0.3). Both sides are longer than `seam::MIN_PIECE_CHARS`, so the seam carries no extra fragment penalty.
        let target = "我下定决心，重新来过。".to_owned();
        // Weight 1.0: zeroes the confidence penalty, so this fixture diverges only on the width term.
        let edge = |src: usize, needle: &str| AlignEdge::soft(src, span(&target, needle), 1.0);
        let edges = vec![
            edge(2, "我"),
            edge(3, "下定"),
            edge(6, "决心"),
            edge(9, "重新"),
            edge(11, "来过"),
        ];
        (src, target, edges)
    }

    #[test]
    fn align_only_paired_splits_a_short_translation_that_auto_keeps_whole() {
        let (src, target, edges) = r1_short_translation_fixture();
        assert!(target_cps_chars(&target, "zh") < TransParams::for_lang("zh").soft);
        let auto = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        let auto_pieces = match plan_sentence(&edges, &auto) {
            PlanOutcome::Aligned(entry) => {
                assert_invariants(&entry, src.len());
                assert_eq!(concat(&entry), target);
                entry.pieces.len()
            }
            other => panic!("auto: {other:?}"),
        };
        // Zero drift: `Auto`'s cost function is unchanged, and this sentence is still one piece.
        assert_eq!(auto_pieces, 1, "auto must not drift");

        let mut paired = auto;
        paired.density = AlignDensity::Paired;
        match plan_sentence(&edges, &paired) {
            PlanOutcome::Aligned(entry) => {
                assert!(
                    entry.pieces.len() >= 2,
                    "paired must re-split: {:?}",
                    entry.pieces
                );
                assert_eq!(concat(&entry), target, "paired 不得改写译文");
                assert_invariants(&entry, src.len());
            }
            other => panic!("paired: {other:?}"),
        }
    }

    /// `Paired` removes only the width penalty in the "narrower than soft" direction. When `units >= soft` the cost is byte-for-byte identical to `Auto`, and `units > hard` remains a hard constraint (`None`).
    #[test]
    fn paired_only_waives_the_narrow_side_of_the_width_term() {
        let (src, target, edges) = r1_short_translation_fixture();
        let auto = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        let mut paired = auto.clone();
        paired.density = AlignDensity::Paired;
        let target_chars: Vec<char> = target.chars().collect();
        let candidates: Vec<usize> = target_cut_candidates(&target, "zh", &auto.params, &[])
            .into_iter()
            .map(|candidate| candidate.pos)
            .collect();
        let blocks = minimal_monotonic_blocks(&edges, &src, &target, &candidates, DEFAULT_EDGE_TAU);
        assert!(blocks.len() >= 2, "{blocks:?}");
        let word_units = auto.word_units();
        let seam_costs: BTreeMap<usize, f64> =
            target_cut_candidates(&target, &auto.lang, &auto.params, &auto.protected_terms)
                .into_iter()
                .map(|candidate| (candidate.pos, candidate.seam_cost))
                .collect();
        let whole = |input: &BilingualPlanInput| {
            pair_cost(
                &blocks,
                0,
                blocks.len(),
                None,
                input,
                &target_chars,
                &word_units,
                &seam_costs,
            )
            .expect("whole-sentence piece is feasible")
        };
        // Whole-sentence width < soft(14): this is exactly the term paired waives; the other terms are byte-for-byte identical.
        let soft = auto.params.soft as f64;
        let width = ((target_cps_chars(&target, "zh") as f64 - soft) / soft).powi(2);
        assert!(width > 0.0);
        assert!((whole(&auto) - whole(&paired) - width).abs() < 1e-9);
    }

    // ---- Line partition pass-through (`plan_sentence_rows`) --------------------------------

    /// Turns a list of "line texts" into character ranges on `target`; the line texts must concatenate in order to form `target`.
    fn row_ranges(rows: &[&str]) -> Vec<Range<usize>> {
        let mut cursor = 0usize;
        rows.iter()
            .map(|row| {
                let start = cursor;
                cursor += row.chars().count();
                start..cursor
            })
            .collect()
    }

    /// Each line gets one soft edge covering its whole range (this is what the model's line attribution looks like).
    fn row_edges(rows: &[(&[usize], Range<usize>)]) -> Vec<AlignEdge> {
        rows.iter()
            .flat_map(|(ordinals, range)| {
                ordinals
                    .iter()
                    .map(move |&src| AlignEdge::soft(src, range.clone(), 0.8))
            })
            .collect()
    }

    /// Line boundaries are frozen into block boundaries: piece count = line count, piece text = line text, `aligner` takes the line tag, and I3/I4 hold.
    #[test]
    fn rows_become_pieces_one_to_one_with_the_declared_source_spans() {
        let src = words(&[
            "We", "first", "analyze", "the", "data,", "then", "train", "the", "model,", "and",
            "finally", "deploy", "the", "service.",
        ]);
        let target = "我们先分析数据，然后训练模型，最后部署服务。";
        let rows = ["我们先分析数据，", "然后训练模型，", "最后部署服务。"];
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[
            (&[0, 1, 2, 3, 4], ranges[0].clone()),
            (&[5, 6, 7, 8], ranges[1].clone()),
            (&[9, 10, 11, 12, 13], ranges[2].clone()),
        ]);
        let mut input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        input.aligner = "llm-rows+anchor/1".to_owned();
        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        let entry = plan.entry;

        assert_eq!(entry.pieces.len(), rows.len());
        assert_eq!(
            entry
                .pieces
                .iter()
                .map(|piece| piece.text.as_str())
                .collect::<Vec<_>>(),
            rows
        );
        assert_eq!(entry.pieces[0].from, Some(0));
        assert_eq!(entry.pieces[0].to, Some(4));
        assert_eq!(entry.pieces[1].from, Some(5));
        assert_eq!(entry.pieces[2].to, Some(13));
        assert_eq!(entry.correspondence, Some(Correspondence::Block));
        assert_eq!(entry.text_basis, TextBasis::Trans);
        assert_eq!(entry.aligner.as_deref(), Some("llm-rows+anchor/1"));
        assert_eq!(concat(&entry), target);
        assert_invariants(&entry, src.len());
        // A line edge pins each whole line as one block: blocks and pieces correspond one-to-one, and the block's source span is exactly the span the line declared.
        assert_eq!(entry.blocks.len(), entry.pieces.len());
        assert_eq!(entry.blocks[0].src, (0, 4));
        assert_eq!(entry.blocks[1].src, (5, 8));
        assert_eq!(entry.blocks[2].src, (9, 13));
    }

    /// A single line covering the whole sentence (the degenerate shape when word order does not match): one piece, and blocks can still be subdivided.
    #[test]
    fn a_single_row_covering_the_whole_sentence_yields_one_piece() {
        let src = words(&["I", "didn't", "go", "because", "I", "was", "sick."]);
        let target = "因为我病了，所以没去。";
        let ranges = row_ranges(&[target]);
        let edges = row_edges(&[(&[0, 1, 2, 3, 4, 5, 6], ranges[0].clone())]);
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        let entry = plan.entry;
        assert_eq!(entry.pieces.len(), 1);
        assert_eq!(concat(&entry), target);
        assert_invariants(&entry, src.len());
    }

    /// If a line itself exceeds hard, further cutting is allowed only inside that line; it never merges across lines. A line edge pins the whole line's target range as one block, and there is no independent evidence inside the line to cut, so the whole sentence returns `None` and falls back to the regular path. It is better to spend one more align call than to pass off proportional anchoring as a semantic boundary.
    #[test]
    fn an_over_hard_row_falls_back_instead_of_merging_across_rows() {
        let src = words(&[
            "We",
            "first",
            "analyze",
            "the",
            "raw",
            "data,",
            "then",
            "train",
            "the",
            "model",
            "on",
            "it,",
            "and",
            "finally",
            "deploy",
            "the",
            "service",
            "to",
            "production.",
        ]);
        let target = "我们先分析原始数据，然后在上面训练模型，最后把服务部署到生产环境。";
        let rows = [
            "我们先分析原始数据，",
            "然后在上面训练模型，最后把服务部署到生产环境。",
        ];
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[
            (&[0, 1, 2, 3, 4, 5], ranges[0].clone()),
            (&(6..19).collect::<Vec<_>>(), ranges[1].clone()),
        ]);
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        assert!(
            target_cps_chars(rows[1], "zh") > input.params.hard,
            "第二行必须超 hard 才能覆盖再切分支"
        );
        assert!(plan_sentence_rows(&edges, &ranges, &input).is_none());
        // The regular path after fallback still produces a plan as usual (this sentence has a dedicated round to fall back on).
        assert!(!matches!(
            plan_sentence(&edges, &input),
            PlanOutcome::Aligned(_)
        ));
    }

    /// The line boundary conflicts with a hard anchor (an anchor edge crosses the line seam): do not force it. The whole sentence returns `None` and falls back to the regular path.
    #[test]
    fn a_row_boundary_straddled_by_an_anchor_falls_back() {
        let src = words(&[
            "We", "shipped", "version", "2024", "last", "week", "already.",
        ]);
        let target = "我们上周就发布了2024版本。";
        // The model split the line after "了", exactly cutting into the range covered by the hard anchor "2024版本".
        let rows = ["我们上周就发布了2", "024版本。"];
        let ranges = row_ranges(&rows);
        let mut edges = row_edges(&[
            (&[0, 1, 4, 5, 6], ranges[0].clone()),
            (&[2, 3], ranges[1].clone()),
        ]);
        edges.push(AlignEdge::hard(3, span(target, "2024版本")));
        let input = BilingualPlanInput::new(src.clone(), target, "en", "zh");
        assert!(plan_sentence_rows(&merge_edges(vec![edges]), &ranges, &input).is_none());
    }

    /// Anchored words with self-assigned times (the merge criteria depend on line duration, so the evenly spaced helper is not enough).
    fn timed_words(spans: &[(f64, f64)]) -> Vec<AnchorWord> {
        spans
            .iter()
            .enumerate()
            .map(|(index, &(t0, t1))| AnchorWord {
                id: format!("g1.{index}"),
                text: format!("w{index}"),
                t0,
                t1,
                glue: false,
            })
            .collect()
    }

    /// Deterministic line merge: [2 units/0.6s] + [5/1.2s] + [9/2.5s] ⇒ two lines.
    ///
    /// The first line at 0.6s is < 1.0s, which triggers a merge, and only the right neighbour can merge (7 units / 1.8s, cps 3.9). After merging, neither line is "too short" any more, so iteration stops.
    #[test]
    fn short_rows_are_merged_deterministically_after_the_row_split() {
        let src = timed_words(&[
            (0.0, 0.6),
            (0.6, 1.2),
            (1.2, 1.8),
            (1.8, 2.6),
            (2.6, 3.4),
            (3.4, 4.3),
        ]);
        let rows = ["甲乙", "丙丁戊己庚", "辛壬癸子丑寅卯辰巳"];
        let target: String = rows.concat();
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[
            (&[0], ranges[0].clone()),
            (&[1, 2], ranges[1].clone()),
            (&[3, 4, 5], ranges[2].clone()),
        ]);
        let input = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        assert_eq!(target_cps_chars(rows[0], "zh"), 2);
        assert_eq!(target_cps_chars(rows[1], "zh"), 5);
        assert_eq!(target_cps_chars(rows[2], "zh"), 9);

        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        assert_eq!(plan.merged_rows, 1);
        assert_eq!(
            plan.entry
                .pieces
                .iter()
                .map(|piece| piece.text.as_str())
                .collect::<Vec<_>>(),
            ["甲乙丙丁戊己庚", "辛壬癸子丑寅卯辰巳"]
        );
        assert_eq!(plan.entry.pieces[0].from, Some(0));
        assert_eq!(plan.entry.pieces[0].to, Some(2));
        assert_eq!(plan.entry.pieces[1].from, Some(3));
        // The block layer does not get coarser along with it: it remains the model's three-line correspondence.
        assert_eq!(plan.entry.blocks.len(), 3);
        assert_eq!(concat(&plan.entry), target);
        assert_invariants(&plan.entry, src.len());
    }

    #[test]
    fn paired_density_keeps_narrow_rows_when_duration_and_cps_are_safe() {
        let src = timed_words(&[
            (0.0, 1.2),
            (1.2, 1.8),
            (1.8, 2.4),
            (2.4, 3.1),
            (3.1, 3.8),
            (3.8, 4.5),
        ]);
        let rows = ["甲乙", "丙丁戊己庚", "辛壬癸子丑寅卯辰巳"];
        let target: String = rows.concat();
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[
            (&[0], ranges[0].clone()),
            (&[1, 2], ranges[1].clone()),
            (&[3, 4, 5], ranges[2].clone()),
        ]);
        let auto = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        let auto_plan = plan_sentence_rows(&edges, &ranges, &auto).expect("auto row plan");
        assert_eq!(auto_plan.entry.pieces.len(), 2);

        let mut paired = auto;
        paired.density = AlignDensity::Paired;
        let paired_plan = plan_sentence_rows(&edges, &ranges, &paired).expect("paired row plan");
        assert_eq!(paired_plan.merged_rows, 0);
        assert_eq!(paired_plan.entry.pieces.len(), 3);
        assert_invariants(&paired_plan.entry, src.len());
    }

    /// Merge guard: when adjacent lines are already close to fit, do not merge (merged width > fit units); short lines are left as they are.
    #[test]
    fn a_short_row_next_to_a_wide_row_is_left_alone() {
        let src = timed_words(&[(0.0, 0.6), (0.6, 1.6), (1.6, 2.6), (2.6, 3.6)]);
        let wide = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰";
        let rows = ["子丑", wide];
        let target: String = rows.concat();
        assert_eq!(target_cps_chars(rows[0], "zh"), 2);
        assert_eq!(target_cps_chars(wide, "zh"), 15);
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[(&[0], ranges[0].clone()), (&[1, 2, 3], ranges[1].clone())]);
        let input = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        // 2 + 15 = 17 > fit 16 ⇒ merge is illegal.
        assert!(2 + target_cps_chars(wide, "zh") > input.params.fit);

        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        assert_eq!(plan.merged_rows, 0);
        assert_eq!(plan.entry.pieces.len(), 2);
        assert_eq!(plan.entry.pieces[0].text, "子丑");
        assert_invariants(&plan.entry, src.len());
    }

    /// Guard tiering: a merge triggered by **cps > 6** may reach hard (20) in merged width, while one triggered only by "too small" still respects fit (16). Here two lines of 9 units each at 1.0s each (cps 9): merged 18 units > fit 16 but ≤ hard 20 ⇒ merge; reading speed drops to 9.0.
    #[test]
    fn a_too_fast_row_may_merge_up_to_hard_not_just_fit() {
        let src = timed_words(&[(0.0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0)]);
        let rows = ["甲乙丙丁戊己庚辛壬", "癸子丑寅卯辰巳午未"];
        let target: String = rows.concat();
        assert_eq!(target_cps_chars(rows[0], "zh"), 9);
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[(&[0, 1], ranges[0].clone()), (&[2, 3], ranges[1].clone())]);
        let input = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        // Both lines are 9 units / 1.0s = 9 cps > 6, but neither is "too small".
        assert!(9 > input.params.fit / 2);
        assert!(18 > input.params.fit && 18 <= input.params.hard);

        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        assert_eq!(plan.merged_rows, 1);
        assert_eq!(plan.entry.pieces.len(), 1);
        assert_eq!(plan.entry.pieces[0].text, target);
        assert_invariants(&plan.entry, src.len());
    }

    /// The converse: two lines of the same width whose reading speed is already compliant (9 units / 2.0s = 4.5 cps each). Neither is "too fast" nor "too small" ⇒ no merge is triggered at all, and the 18-unit wide line does not appear.
    #[test]
    fn rows_that_read_comfortably_are_never_widened_past_fit() {
        let src = timed_words(&[(0.0, 1.0), (1.0, 2.0), (2.0, 3.0), (3.0, 4.0)]);
        let rows = ["甲乙丙丁戊己庚辛壬", "癸子丑寅卯辰巳午未"];
        let target: String = rows.concat();
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[(&[0, 1], ranges[0].clone()), (&[2, 3], ranges[1].clone())]);
        let input = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        assert_eq!(plan.merged_rows, 0);
        assert_eq!(plan.entry.pieces.len(), 2);
        assert_invariants(&plan.entry, src.len());
    }

    /// Guard two: a merge is also refused if the merged duration exceeds `max_duration_sec` (default 7s).
    #[test]
    fn a_short_row_is_not_merged_past_the_dwell_ceiling() {
        let src = timed_words(&[(0.0, 0.6), (0.6, 7.0), (7.0, 8.0)]);
        let rows = ["甲乙", "丙丁戊己庚辛"];
        let target: String = rows.concat();
        let ranges = row_ranges(&rows);
        let edges = row_edges(&[(&[0], ranges[0].clone()), (&[1, 2], ranges[1].clone())]);
        let input = BilingualPlanInput::new(src.clone(), &target, "en", "zh");
        // Merged 0.0..8.0 = 8s > 7s.
        let plan = plan_sentence_rows(&edges, &ranges, &input).expect("row plan");
        assert_eq!(plan.merged_rows, 0);
        assert_eq!(plan.entry.pieces.len(), 2);
        assert_invariants(&plan.entry, src.len());
    }

    /// No edge takes part in decisions ⇒ no line pass-through (insufficient evidence).
    #[test]
    fn rows_without_counted_edges_fall_back() {
        let src = words(&["alpha", "bravo", "charlie", "delta"]);
        let target = "甲乙丙丁。";
        let ranges = row_ranges(&["甲乙", "丙丁。"]);
        let input = BilingualPlanInput::new(src, target, "en", "zh");
        assert!(plan_sentence_rows(&[], &ranges, &input).is_none());
    }
}
