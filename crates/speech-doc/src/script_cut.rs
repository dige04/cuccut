//! Deterministic engine for the script pre-cut (`ccut cut script`): aligns the script with the transcript recognized from the recording as a sequence, finds consecutive word spans that the recording has beyond the script, classifies them into three reasons `repeat` / `filler` / `extra`, then snaps the start and end of each cut to the clip's own silences. Spec: see the spoken-video plan doc §5.1.
//!
//! This module does no I/O. Reading the script (plain text / SRT / LRC / JSON) lives in [`crate::script`]. The host reads the audio energy into BCW1 peak values and passes it in as a [`SilenceMap`]. Writing to the timeline happens in `ccut-workspace`.
//!
//! **Language-independent**:
//! - Tokenization only looks at Unicode properties: compatibility decomposition followed by recomposition (NFKC), lowercasing, and removal of punctuation, symbols and whitespace. Scripts that do not separate words with spaces (Han, kana, Hangul, Thai, Lao, Khmer, Myanmar, Tibetan, etc.) become one token per character. Other text is grouped into runs of consecutive letters and digits. Apostrophes are removed but do not split words.
//! - Substitutions (the speaker misheard a word or phrased it differently) are **never cut**, so alignment needs no pronunciation normalization, and numbers are not expanded.
//! - The filler table is per-language data, passed in by the caller according to the transcript language. Without a table no `filler` is produced, and those spans are classed as `extra`.
//!
//! **Scale**: alignment is not quadratic. It first strips the common prefix and suffix, then takes k-grams that occur exactly once on both sides as anchors (k tried in the order 8 / 4 / 2 / 1), uses the longest increasing subsequence to pick a monotone anchor chain, and recurses into the gaps between anchors. A gap is handed to exact LCS in [`crate::lcs::lcs_matches`] only once it shrinks to within [`GAP_CELL_CAP`]. A gap that has no anchors and exceeds the cap is recorded as wholly unmatched (deterministic; usually means the wrong script was used, so coverage will be low). [`AlignStats`] records how many LCS cells were actually computed, and the scale test uses it to pin down "not quadratic".

use std::collections::HashMap;

use unicode_general_category::{GeneralCategory, get_general_category};
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

use crate::lcs::{AtomInterner, lcs_matches};

/// Upper limit on the cells ((n+1)·(m+1)) handed to exact LCS for a single gap. About 2000 × 2000 tokens.
pub const GAP_CELL_CAP: usize = 4_000_000;
/// Length of the anchor k-gram, tried from longest to shortest.
const ANCHOR_WIDTHS: [usize; 4] = [8, 4, 2, 1];
/// The `repeat` check looks at the window next to the kept segment: `2 × segment length + REPEAT_WINDOW_SLACK` tokens.
const REPEAT_WINDOW_SLACK: usize = 8;
/// When the same sentence is started more than once, each piece that is assembled into a `repeat` must be at least this many tokens (a one-token piece matches too easily).
const REPEAT_MIN_PIECE_TOKENS: usize = 2;
/// Segments longer than this many tokens are not assembled from pieces (see [`covered_by_pieces`]).
const REPEAT_PIECE_MAX_TOKENS: usize = 512;
/// Cuts shorter than this duration are dropped (seconds).
pub const MIN_CUT_SECONDS: f64 = 0.05;
/// Silence threshold: this many decibels below the envelope's 95th percentile.
const SILENCE_BELOW_HIGH_DB: f64 = 35.0;
/// Lower bound of the silence threshold: this many decibels above the noise floor (10th percentile)...
const SILENCE_ABOVE_FLOOR_DB: f64 = 6.0;
/// ...but the lower bound is not allowed to rise above this many decibels below the 95th percentile (material with a very high noise floor would otherwise find almost no silence to snap to).
const SILENCE_MAX_BELOW_HIGH_DB: f64 = 15.0;
/// A silent span must be at least this many consecutive bins long.
const SILENCE_MIN_BINS: usize = 2;

/// Which take to keep. `Last` is the default: when a sentence was said twice, keep the later take.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Take {
    Last,
    First,
}

impl Take {
    pub fn parse(value: &str) -> Option<Self> {
        match value.to_ascii_lowercase().as_str() {
            "last" => Some(Self::Last),
            "first" => Some(Self::First),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Last => "last",
            Self::First => "first",
        }
    }
}

/// Reason for a candidate cut.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reason {
    Repeat,
    Filler,
    Extra,
}

impl Reason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Repeat => "repeat",
            Self::Filler => "filler",
            Self::Extra => "extra",
        }
    }

    /// Cut category recorded in the timeline's provenance.
    pub fn cut_kind(self) -> &'static str {
        match self {
            Self::Repeat => "badTake",
            Self::Filler => "filler",
            Self::Extra => "offScript",
        }
    }
}

/// A transcript word on the recording side (the caller has already removed `hidden` words).
#[derive(Debug, Clone, PartialEq)]
pub struct RecWord {
    pub text: String,
    pub t0: f64,
    pub t1: f64,
}

/// A run of consecutive words the recording has beyond the script (inclusive word index range).
#[derive(Debug, Clone, PartialEq)]
pub struct PlanSegment {
    pub first: usize,
    pub last: usize,
    pub reason: Reason,
}

/// Record of the alignment cost.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct AlignStats {
    /// Total number of units handed to exact LCS.
    pub lcs_cells: u64,
    /// Total number of k-grams entered into the table when searching for anchors.
    pub hashed: u64,
    /// In gaps that have no anchors, exceed the cap, and were therefore recorded wholly as unmatched: the number of script-side tokens.
    pub unresolved_script_tokens: usize,
    /// Same as above, for the recording-side token count.
    pub unresolved_rec_tokens: usize,
}

/// Result of alignment and classification.
#[derive(Debug, Clone, PartialEq)]
pub struct MatchPlan {
    pub script_tokens: usize,
    pub matched: usize,
    /// Spans the recording has beyond the script, in time order.
    pub segments: Vec<PlanSegment>,
    /// Script lines that were not spoken at all (0-based line indices).
    pub missing_lines: Vec<usize>,
    pub stats: AlignStats,
}

impl MatchPlan {
    /// Share of the script's tokens that were matched; 0 if the script has no tokens.
    pub fn coverage(&self) -> f64 {
        if self.script_tokens == 0 {
            0.0
        } else {
            self.matched as f64 / self.script_tokens as f64
        }
    }
}

/// Text that does not separate words with spaces, tokenized one character per token.
fn is_spaceless_char(ch: char) -> bool {
    matches!(ch as u32,
        0x0E00..=0x0EFF      // Thai, Lao
        | 0x0F00..=0x0FFF    // Tibetan
        | 0x1000..=0x109F    // Myanmar
        | 0x1100..=0x11FF    // Hangul jamo
        | 0x1780..=0x17FF    // Khmer
        | 0x19E0..=0x19FF    // Khmer symbols
        | 0x2E80..=0x2FDF    // Radicals
        | 0x3040..=0x30FF    // Kana
        | 0x3100..=0x312F    // Bopomofo
        | 0x3130..=0x318F    // Hangul compatibility jamo
        | 0x31A0..=0x31FF    // Bopomofo Extended, Katakana Phonetic Extensions
        | 0x3400..=0x4DBF    // CJK Unified Ideographs Extension A
        | 0x4E00..=0x9FFF    // Han
        | 0xA000..=0xA4CF    // Yi
        | 0xAC00..=0xD7AF    // Hangul syllables
        | 0xF900..=0xFAFF    // CJK compatibility ideographs
        | 0x20000..=0x323AF  // From CJK Unified Ideographs Extension B onward
    )
}

fn is_word_char(ch: char) -> bool {
    use GeneralCategory::*;
    matches!(
        get_general_category(ch),
        UppercaseLetter
            | LowercaseLetter
            | TitlecaseLetter
            | ModifierLetter
            | OtherLetter
            | DecimalNumber
            | LetterNumber
            | OtherNumber
            | NonspacingMark
            | SpacingMark
            | EnclosingMark
    )
}

/// Apostrophe-like marks: removed, but do not split words (`don't` and `dont` are the same token).
fn is_apostrophe(ch: char) -> bool {
    matches!(ch, '\'' | '\u{2019}' | '\u{02BC}' | '\u{2018}' | '\u{FF07}')
}

/// Normalized tokens of a piece of text (see the module docs).
pub fn tokens(text: &str) -> Vec<String> {
    let normalized: String = text.nfkc().flat_map(char::to_lowercase).collect();
    let mut out = Vec::new();
    let mut run = String::new();
    for grapheme in normalized.graphemes(true) {
        let Some(base) = grapheme.chars().next() else {
            continue;
        };
        if is_apostrophe(base) && grapheme.chars().count() == 1 {
            continue;
        }
        if is_spaceless_char(base) {
            if !run.is_empty() {
                out.push(std::mem::take(&mut run));
            }
            out.push(grapheme.chars().filter(|&ch| is_word_char(ch)).collect());
            continue;
        }
        if is_word_char(base) {
            run.extend(grapheme.chars().filter(|&ch| is_word_char(ch)));
        } else if !run.is_empty() {
            out.push(std::mem::take(&mut run));
        }
    }
    if !run.is_empty() {
        out.push(run);
    }
    out
}

/// Word key for filler comparison: lowercased, with leading and trailing non-alphanumeric characters removed (same normalization as the filler handling in `cut detect`).
pub fn filler_key(text: &str) -> String {
    text.to_lowercase()
        .trim_matches(|ch: char| !ch.is_alphanumeric())
        .to_owned()
}

/// Align and classify. `lines` are the lines split out according to the script reading. `fillers` are filler phrases (each phrase is a sequence of words already normalized by [`filler_key`]). `None` means this language has no filler table.
pub fn plan(
    lines: &[String],
    words: &[RecWord],
    take: Take,
    fillers: Option<&[Vec<String>]>,
) -> MatchPlan {
    let mut interner = AtomInterner::default();
    let mut script = Vec::new();
    let mut script_line = Vec::new();
    for (line_index, line) in lines.iter().enumerate() {
        for token in tokens(line) {
            script.push(interner.intern(&token));
            script_line.push(line_index);
        }
    }
    let mut rec = Vec::new();
    let mut word_tokens = Vec::with_capacity(words.len());
    for word in words {
        let start = rec.len();
        for token in tokens(&word.text) {
            rec.push(interner.intern(&token));
        }
        word_tokens.push(start..rec.len());
    }

    let mut stats = AlignStats::default();
    let mut pairs = match take {
        Take::First => align(&script, &rec, &mut stats),
        Take::Last => {
            let rev_a = script.iter().rev().copied().collect::<Vec<_>>();
            let rev_b = rec.iter().rev().copied().collect::<Vec<_>>();
            let (n, m) = (script.len(), rec.len());
            let mut pairs = align(&rev_a, &rev_b, &mut stats)
                .into_iter()
                .map(|(i, j)| (n - 1 - i, m - 1 - j))
                .collect::<Vec<_>>();
            pairs.reverse();
            pairs
        }
    };
    slide_insertions(&mut pairs, script.len(), &rec, take);

    let (script_state, rec_state) = classify_tokens(&pairs, script.len(), rec.len());
    let matched = pairs.len();

    let mut missing_lines = Vec::new();
    {
        let mut index = 0;
        while index < script.len() {
            let line = script_line[index];
            let mut all_missing = true;
            while index < script.len() && script_line[index] == line {
                all_missing &= script_state[index] == TokenState::Unmatched;
                index += 1;
            }
            if all_missing {
                missing_lines.push(line);
            }
        }
    }

    // Word state: if any of its tokens is matched or falls in a substitution, keep it. If all of its tokens are recording-extra, it is a candidate. A word with no tokens is neutral.
    #[derive(Clone, Copy, PartialEq)]
    enum WordState {
        Kept,
        Extra,
        Empty,
    }
    let word_state = word_tokens
        .iter()
        .map(|range| {
            if range.is_empty() {
                WordState::Empty
            } else if range.clone().all(|j| rec_state[j] == TokenState::Unmatched) {
                WordState::Extra
            } else {
                WordState::Kept
            }
        })
        .collect::<Vec<_>>();

    let filler_keys = fillers.map(|_| {
        words
            .iter()
            .map(|word| filler_key(&word.text))
            .collect::<Vec<_>>()
    });

    let mut segments = Vec::new();
    let mut index = 0;
    while index < words.len() {
        if word_state[index] != WordState::Extra {
            index += 1;
            continue;
        }
        let first = index;
        let mut last = index;
        let mut cursor = index + 1;
        while cursor < words.len() && word_state[cursor] != WordState::Kept {
            if word_state[cursor] == WordState::Extra {
                last = cursor;
            }
            cursor += 1;
        }
        index = last + 1;

        let filler_words = match (fillers, &filler_keys) {
            (Some(phrases), Some(keys)) => filler_cover(&keys[first..=last], phrases),
            _ => vec![false; last - first + 1],
        };
        let segment_tokens = (first..=last)
            .filter(|&word| !filler_words[word - first])
            .flat_map(|word| rec[word_tokens[word].clone()].iter().copied())
            .collect::<Vec<_>>();
        let token_start = word_tokens[first].start;
        let token_end = word_tokens[last].end;
        let reason = if !segment_tokens.is_empty()
            && is_repeat(
                &segment_tokens,
                &rec,
                &rec_state,
                token_start,
                token_end,
                take,
            ) {
            Reason::Repeat
        } else if fillers.is_some() && filler_words.iter().all(|&filler| filler) {
            Reason::Filler
        } else {
            Reason::Extra
        };
        segments.push(PlanSegment {
            first,
            last,
            reason,
        });
    }
    MatchPlan {
        script_tokens: script.len(),
        matched,
        segments,
        missing_lines,
        stats,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TokenState {
    Matched,
    /// Within one gap, when both sides have unmatched tokens: a substitution, keep.
    Replaced,
    /// Pure script-extra / pure recording-extra.
    Unmatched,
}

fn classify_tokens(
    pairs: &[(usize, usize)],
    n: usize,
    m: usize,
) -> (Vec<TokenState>, Vec<TokenState>) {
    let mut script_state = vec![TokenState::Unmatched; n];
    let mut rec_state = vec![TokenState::Unmatched; m];
    let mut previous = (0usize, 0usize);
    for &(i, j) in pairs.iter().chain(std::iter::once(&(n, m))) {
        if i > previous.0 && j > previous.1 {
            script_state[previous.0..i].fill(TokenState::Replaced);
            rec_state[previous.1..j].fill(TokenState::Replaced);
        }
        if i < n && j < m {
            script_state[i] = TokenState::Matched;
            rec_state[j] = TokenState::Matched;
        }
        previous = (i + 1, j + 1);
    }
    (script_state, rec_state)
}

/// A pure recording-extra gap (empty script side) slides along the recording so that the same words stay in the take chosen by `take`. `Last` slides forward (the earlier take gets cut), `First` slides backward. It slides only when the matches on both sides adjacent to the gap are contiguous and the script side is contiguous, so that sliding never merges an insertion into a substitution.
fn slide_insertions(pairs: &mut [(usize, usize)], script_len: usize, rec: &[u32], take: Take) {
    let count = pairs.len();
    // After match q moves, the gap on its other side must still be empty on the script side, otherwise the insertion would merge into a substitution.
    let script_contiguous_left = |pairs: &[(usize, usize)], q: usize| {
        if q == 0 {
            pairs[0].0 == 0
        } else {
            pairs[q - 1].0 + 1 == pairs[q].0
        }
    };
    let script_contiguous_right = |pairs: &[(usize, usize)], q: usize| {
        if q + 1 == count {
            pairs[q].0 + 1 == script_len
        } else {
            pairs[q].0 + 1 == pairs[q + 1].0
        }
    };
    match take {
        Take::Last => {
            for p in 1..count {
                // The gap lies between pairs[p-1] and pairs[p]. It is pure recording-extra only when the script side is contiguous.
                if pairs[p].0 != pairs[p - 1].0 + 1 || pairs[p].1 == pairs[p - 1].1 + 1 {
                    continue;
                }
                let mut q = p - 1; // Match immediately to the left of the gap
                loop {
                    let gap_end = pairs[q + 1].1; // Right end of the gap's open interval
                    let left = pairs[q].1;
                    if rec[left] != rec[gap_end - 1] || !script_contiguous_left(pairs, q) {
                        break;
                    }
                    pairs[q].1 = gap_end - 1;
                    // Keep sliding only if the match one further left is also adjacent.
                    if q == 0 || pairs[q - 1].1 + 1 != left {
                        break;
                    }
                    q -= 1;
                }
            }
        }
        Take::First => {
            for p in (0..count.saturating_sub(1)).rev() {
                if pairs[p + 1].0 != pairs[p].0 + 1 || pairs[p + 1].1 == pairs[p].1 + 1 {
                    continue;
                }
                let mut q = p + 1; // Match immediately to the right of the gap
                loop {
                    let gap_start = pairs[q - 1].1 + 1;
                    let right = pairs[q].1;
                    if rec[right] != rec[gap_start] || !script_contiguous_right(pairs, q) {
                        break;
                    }
                    pairs[q].1 = gap_start;
                    if q + 1 == count || pairs[q + 1].1 != right + 1 {
                        break;
                    }
                    q += 1;
                }
            }
        }
    }
}

/// Greedily covers a span of words with filler phrases and returns whether each word is covered (longer phrases take priority).
fn filler_cover(keys: &[String], phrases: &[Vec<String>]) -> Vec<bool> {
    let mut covered = vec![false; keys.len()];
    let mut index = 0;
    while index < keys.len() {
        let best = phrases
            .iter()
            .filter(|phrase| {
                !phrase.is_empty()
                    && index + phrase.len() <= keys.len()
                    && phrase
                        .iter()
                        .zip(&keys[index..])
                        .all(|(token, key)| token == key)
            })
            .map(Vec::len)
            .max();
        match best {
            Some(length) => {
                covered[index..index + length].fill(true);
                index += length;
            }
            None => index += 1,
        }
    }
    covered
}

/// Whether the segment's tokens (with fillers removed) can be assembled from consecutive substrings of the kept segment adjacent on the `take` side. Either the whole segment is one substring, or it is cut in order into several pieces, each piece at least [`REPEAT_MIN_PIECE_TOKENS`] tokens long and each itself a substring (the same sentence started several times, e.g. “Step one: read the timeline. Step one.”). Pieces separated by words not found in the kept segment (apology or correction words) do not count; such spans are classed as `extra`.
fn is_repeat(
    needle: &[u32],
    rec: &[u32],
    rec_state: &[TokenState],
    token_start: usize,
    token_end: usize,
    take: Take,
) -> bool {
    let window = needle.len() * 2 + REPEAT_WINDOW_SLACK;
    let haystack = match take {
        Take::Last => {
            let mut out = Vec::new();
            let mut j = token_end;
            while j < rec.len() && rec_state[j] != TokenState::Unmatched && out.len() < window {
                out.push(rec[j]);
                j += 1;
            }
            out
        }
        Take::First => {
            let mut out = Vec::new();
            let mut j = token_start;
            while j > 0 && rec_state[j - 1] != TokenState::Unmatched && out.len() < window {
                out.push(rec[j - 1]);
                j -= 1;
            }
            out.reverse();
            out
        }
    };
    contains_run(&haystack, needle) || covered_by_pieces(&haystack, needle)
}

/// Whether `needle` can be cut in order into several pieces, each at least [`REPEAT_MIN_PIECE_TOKENS`] tokens long and each a consecutive substring of `haystack`. Segments longer than [`REPEAT_PIECE_MAX_TOKENS`] are not cut (long segments are mostly off-script talk).
fn covered_by_pieces(haystack: &[u32], needle: &[u32]) -> bool {
    let n = needle.len();
    if n < REPEAT_MIN_PIECE_TOKENS || n > REPEAT_PIECE_MAX_TOKENS {
        return false;
    }
    // Length of the longest prefix starting at i that occurs in haystack (if a string occurs, all its prefixes occur too).
    let longest = (0..n)
        .map(|i| {
            (0..haystack.len())
                .map(|p| {
                    needle[i..]
                        .iter()
                        .zip(&haystack[p..])
                        .take_while(|(a, b)| a == b)
                        .count()
                })
                .max()
                .unwrap_or(0)
        })
        .collect::<Vec<_>>();
    let mut reachable = vec![false; n + 1];
    reachable[n] = true;
    for i in (0..n).rev() {
        reachable[i] = (REPEAT_MIN_PIECE_TOKENS..=longest[i]).any(|length| reachable[i + length]);
    }
    reachable[0]
}

/// KMP: whether `needle` is a consecutive substring of `haystack`.
fn contains_run(haystack: &[u32], needle: &[u32]) -> bool {
    if needle.is_empty() || needle.len() > haystack.len() {
        return needle.is_empty();
    }
    let mut failure = vec![0usize; needle.len()];
    let mut k = 0;
    for i in 1..needle.len() {
        while k > 0 && needle[i] != needle[k] {
            k = failure[k - 1];
        }
        if needle[i] == needle[k] {
            k += 1;
        }
        failure[i] = k;
    }
    let mut k = 0;
    for &value in haystack {
        while k > 0 && value != needle[k] {
            k = failure[k - 1];
        }
        if value == needle[k] {
            k += 1;
            if k == needle.len() {
                return true;
            }
        }
    }
    false
}

/// Order-preserving match pairs between two token strings (biased early: among equally long matches, take the earlier one).
pub fn align(a: &[u32], b: &[u32], stats: &mut AlignStats) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    align_range(a, b, 0, a.len(), 0, b.len(), stats, &mut out);
    out
}

#[allow(clippy::too_many_arguments)]
fn align_range(
    a: &[u32],
    b: &[u32],
    mut a0: usize,
    mut a1: usize,
    mut b0: usize,
    mut b1: usize,
    stats: &mut AlignStats,
    out: &mut Vec<(usize, usize)>,
) {
    while a0 < a1 && b0 < b1 && a[a0] == b[b0] {
        out.push((a0, b0));
        a0 += 1;
        b0 += 1;
    }
    let mut suffix = 0;
    while a0 < a1 && b0 < b1 && a[a1 - 1] == b[b1 - 1] {
        a1 -= 1;
        b1 -= 1;
        suffix += 1;
    }
    let (n, m) = (a1 - a0, b1 - b0);
    if n > 0 && m > 0 {
        let cells = (n + 1).saturating_mul(m + 1);
        if cells <= GAP_CELL_CAP {
            stats.lcs_cells += cells as u64;
            let matches = lcs_matches(&a[a0..a1], &b[b0..b1], GAP_CELL_CAP)
                .expect("gap is within the cell cap");
            out.extend(matches.into_iter().map(|(i, j)| (a0 + i, b0 + j)));
        } else {
            let anchors = ANCHOR_WIDTHS.iter().find_map(|&width| {
                let anchors = find_anchors(a, b, a0, a1, b0, b1, width, stats);
                (!anchors.is_empty()).then_some((anchors, width))
            });
            match anchors {
                Some((anchors, width)) => {
                    let (mut pa, mut pb) = (a0, b0);
                    for (i, j) in anchors {
                        align_range(a, b, pa, i, pb, j, stats, out);
                        out.extend((0..width).map(|k| (i + k, j + k)));
                        pa = i + width;
                        pb = j + width;
                    }
                    align_range(a, b, pa, a1, pb, b1, stats, out);
                }
                None => {
                    stats.unresolved_script_tokens += n;
                    stats.unresolved_rec_tokens += m;
                }
            }
        }
    }
    out.extend((0..suffix).map(|k| (a1 + k, b1 + k)));
}

/// In `[a0,a1) × [b0,b1)`, take the `width`-tuples that occur exactly once on each side, sort them by script position, take the longest strictly increasing subsequence of recording positions, then remove any that overlap. The result is a monotone, non-overlapping anchor chain.
#[allow(clippy::too_many_arguments)]
fn find_anchors(
    a: &[u32],
    b: &[u32],
    a0: usize,
    a1: usize,
    b0: usize,
    b1: usize,
    width: usize,
    stats: &mut AlignStats,
) -> Vec<(usize, usize)> {
    if a1 - a0 < width || b1 - b0 < width {
        return Vec::new();
    }
    // (occurrence count in script, script position, occurrence count in recording, recording position)
    let mut table: HashMap<&[u32], (u32, usize, u32, usize)> = HashMap::new();
    for i in a0..=a1 - width {
        let entry = table.entry(&a[i..i + width]).or_insert((0, i, 0, 0));
        entry.0 += 1;
    }
    for j in b0..=b1 - width {
        if let Some(entry) = table.get_mut(&b[j..j + width]) {
            if entry.2 == 0 {
                entry.3 = j;
            }
            entry.2 += 1;
        }
    }
    stats.hashed += ((a1 - a0 + 1 - width) + (b1 - b0 + 1 - width)) as u64;
    let mut unique = table
        .values()
        .filter(|entry| entry.0 == 1 && entry.2 == 1)
        .map(|entry| (entry.1, entry.3))
        .collect::<Vec<_>>();
    unique.sort_unstable();
    let chain = longest_increasing_by_second(&unique);
    let mut anchors = Vec::with_capacity(chain.len());
    let (mut end_a, mut end_b) = (a0, b0);
    for (i, j) in chain {
        if i >= end_a && j >= end_b {
            anchors.push((i, j));
            end_a = i + width;
            end_b = j + width;
        }
    }
    anchors
}

/// For points already sorted by the first dimension, take the longest subsequence that is strictly increasing in the second dimension (O(r log r); among equal lengths, take the lexicographically earlier one).
fn longest_increasing_by_second(points: &[(usize, usize)]) -> Vec<(usize, usize)> {
    let mut tails: Vec<usize> = Vec::new(); // tails[k] = index of the end point of the chain of length k+1
    let mut parent = vec![usize::MAX; points.len()];
    for (index, &(_, value)) in points.iter().enumerate() {
        let position = tails.partition_point(|&tail| points[tail].1 < value);
        if position > 0 {
            parent[index] = tails[position - 1];
        }
        if position == tails.len() {
            tails.push(index);
        } else {
            tails[position] = index;
        }
    }
    let mut chain = Vec::with_capacity(tails.len());
    let mut cursor = tails.last().copied();
    while let Some(index) = cursor {
        chain.push(points[index]);
        cursor = (parent[index] != usize::MAX).then(|| parent[index]);
    }
    chain.reverse();
    chain
}

/// Silent intervals of the material (seconds, sorted by time, mutually disjoint).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SilenceMap {
    runs: Vec<(f64, f64)>,
}

impl SilenceMap {
    /// Derives silent intervals from a peak envelope (BCW1 bytes) with `bins_per_second` bins per second.
    ///
    /// The threshold is taken from this material's own loudness distribution: [`SILENCE_BELOW_HIGH_DB`] below the 95th percentile. The lower bound is [`SILENCE_ABOVE_FLOOR_DB`] above the noise floor (10th percentile), but the lower bound itself is not allowed to rise above [`SILENCE_MAX_BELOW_HIGH_DB`] below the 95th percentile. A silence requires at least [`SILENCE_MIN_BINS`] consecutive bins that do not exceed the threshold.
    pub fn from_levels(levels: &[u8], bins_per_second: f64) -> Self {
        if levels.is_empty() || bins_per_second <= 0.0 || !bins_per_second.is_finite() {
            return Self::default();
        }
        let mut sorted = levels.to_vec();
        sorted.sort_unstable();
        let quantile = |q: f64| f64::from(sorted[((sorted.len() - 1) as f64 * q) as usize]);
        let high = quantile(0.95);
        let floor = quantile(0.10);
        let gain = |db: f64| 10f64.powf(db / 20.0);
        let lower_bound =
            (floor * gain(SILENCE_ABOVE_FLOOR_DB)).min(high * gain(-SILENCE_MAX_BELOW_HIGH_DB));
        let threshold = (high * gain(-SILENCE_BELOW_HIGH_DB))
            .max(lower_bound)
            .max(1.0);
        let mut runs = Vec::new();
        let mut start: Option<usize> = None;
        for (index, &level) in levels.iter().enumerate() {
            let silent = f64::from(level) <= threshold;
            match (silent, start) {
                (true, None) => start = Some(index),
                (false, Some(from)) => {
                    if index - from >= SILENCE_MIN_BINS {
                        runs.push((
                            from as f64 / bins_per_second,
                            index as f64 / bins_per_second,
                        ));
                    }
                    start = None;
                }
                _ => {}
            }
        }
        if let Some(from) = start
            && levels.len() - from >= SILENCE_MIN_BINS
        {
            runs.push((
                from as f64 / bins_per_second,
                levels.len() as f64 / bins_per_second,
            ));
        }
        Self { runs }
    }

    /// Gives silent intervals directly (for tests and other energy sources).
    pub fn from_runs(mut runs: Vec<(f64, f64)>) -> Self {
        runs.retain(|(start, end)| end > start);
        runs.sort_by(|left, right| left.0.total_cmp(&right.0));
        Self { runs }
    }

    pub fn runs(&self) -> &[(f64, f64)] {
        &self.runs
    }

    /// Within `[lo, hi]`, finds the silence closest to `target` and returns the midpoint of "silence ∩ window".
    pub fn snap(&self, lo: f64, hi: f64, target: f64) -> Option<f64> {
        if !(hi > lo) {
            return None;
        }
        let first = self.runs.partition_point(|run| run.1 <= lo);
        let mut best: Option<(f64, f64)> = None;
        for &(start, end) in &self.runs[first..] {
            if start >= hi {
                break;
            }
            let (from, to) = (start.max(lo), end.min(hi));
            if to <= from {
                continue;
            }
            let point = (from + to) / 2.0;
            let distance = (point - target).abs();
            if best.is_none_or(|(_, best_distance)| distance < best_distance) {
                best = Some((point, distance));
            }
        }
        best.map(|(point, _)| point)
    }
}

/// A cut with its cut points set (source seconds, rounded to milliseconds).
#[derive(Debug, Clone, PartialEq)]
pub struct PlacedCut {
    pub segment: usize,
    pub t0: f64,
    pub t1: f64,
    /// Both ends snapped to silence.
    pub snapped: bool,
}

fn round_ms(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

/// Assigns cut points to each candidate segment. It first takes the word boundaries, then snaps to the nearest silence within `snap` seconds. Cut points that cannot snap fall at the midpoint of the gap between words. If the segment has no word before it, its start is 0. If it has no word after it, its end is `duration`, so the whole stretch of extra material at the start or end of the recording is cut together with the surrounding whitespace.
/// Cut points never cross an adjacent kept word. Cuts shorter than [`MIN_CUT_SECONDS`] are dropped.
pub fn place_cuts(
    segments: &[PlanSegment],
    words: &[RecWord],
    duration: f64,
    silence: Option<&SilenceMap>,
    snap: f64,
) -> Vec<PlacedCut> {
    let silence = silence.filter(|_| snap > 0.0);
    let mut out = Vec::new();
    for (index, segment) in segments.iter().enumerate() {
        let head = &words[segment.first];
        let tail = &words[segment.last];
        let prev_end = segment
            .first
            .checked_sub(1)
            .map_or(0.0, |previous| words[previous].t1.min(head.t0));
        let next_start = words
            .get(segment.last + 1)
            .map_or(duration.max(tail.t1), |next| next.t0.max(tail.t1));

        let start_snap = silence.and_then(|map| {
            map.snap(
                (head.t0 - snap).max(prev_end),
                (head.t0 + snap).min(head.t1.max(head.t0)),
                head.t0,
            )
        });
        let end_snap = silence.and_then(|map| {
            map.snap(
                (tail.t1 - snap).max(tail.t0.min(tail.t1)),
                (tail.t1 + snap).min(next_start),
                tail.t1,
            )
        });
        // If no word comes before the segment (the segment is at the start of the recording), cut all the way to 0. If no word comes after it, cut all the way to the end of the material.
        let has_prev = segment.first > 0;
        let has_next = segment.last + 1 < words.len();
        let t0 = round_ms(start_snap.unwrap_or(if has_prev {
            (prev_end + head.t0) / 2.0
        } else {
            0.0
        }));
        let t1 = round_ms(end_snap.unwrap_or(if has_next {
            (tail.t1 + next_start) / 2.0
        } else {
            next_start
        }));
        if t1 - t0 < MIN_CUT_SECONDS {
            continue;
        }
        out.push(PlacedCut {
            segment: index,
            t0,
            t1,
            snapped: start_snap.is_some() && end_snap.is_some(),
        });
    }
    out
}

#[cfg(test)]
#[path = "script_cut_tests.rs"]
mod tests;
