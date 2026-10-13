//! Display splitting and projection of translations (v0.3 §5–§7, normative algorithm).
//!
//! - [`TransParams`]: three thresholds, fit (trigger) / soft (suggested) / hard (forced).
//! - [`split_independent`]: each side aligns on its own, using the target language's own habitual line splitting (zero LLM).
//! - [`split_proportional`]: a general plain-text tool that splits by character proportion and snaps to seams.
//! - [`anchor_pieces_to_words`]: maps independent pieces to source word ranges within the sentence (word atoms remain the only time source).
//! - [`derive_trans_cues`]: projection of the translation Cue stream. This is the shared consumption surface for export, check, and studio. Sentences without a valid `transAlign` degrade to the whole sentence on screen.

use crate::atomize::{
    atomize, clause_end_char, count_cps_chars, is_cjk_char, join_word_texts, normalize_chars,
    seam_backed_by_whitespace, sentence_end, sep_len, visual_width,
};
use crate::doc::{AlignMode, Correspondence, TextBasis, TransAlign, TranscriptDoc};
use crate::seam::{SeamLintKind, cjk_midword_boundary, is_objective_blocking, lint_pieces};
use crate::sentence::Sentence;

/// BCP-47 primary subtag (lowercase).
pub fn primary_subtag(lang: &str) -> String {
    lang.split(['-', '_'])
        .next()
        .unwrap_or(lang)
        .to_ascii_lowercase()
}

const DELIVERY_FILE_SUFFIXES: &[&str] = &[
    "app", "ai", "avi", "bin", "c", "cc", "cn", "com", "conf", "cpp", "css", "csv", "dev", "doc",
    "docx", "edu", "gif", "go", "gov", "h", "hpp", "html", "io", "java", "jpeg", "jpg", "js",
    "json", "log", "m", "md", "mov", "mp3", "mp4", "net", "org", "pdf", "php", "plist", "png",
    "py", "rb", "rs", "sh", "sql", "svg", "swift", "toml", "ts", "txt", "uk", "us", "vtt", "wav",
    "xml", "yaml", "yml", "zip",
];

const DELIVERY_ABBREVIATIONS: &[&str] = &[
    "mr", "mrs", "ms", "dr", "prof", "st", "sr", "jr", "rev", "hon", "fr", "gen", "gov", "sen",
    "rep", "col", "lt", "sgt", "capt", "vs", "etc", "inc", "ltd", "corp", "dept", "vol", "fig",
];

fn is_delivery_ascii_token(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || "._-@/:\\~%+?=&()[]{}".contains(ch)
}

fn delivery_suffix(token: &str) -> bool {
    DELIVERY_FILE_SUFFIXES
        .iter()
        .any(|suffix| token.eq_ignore_ascii_case(suffix))
}

fn delivery_code_like(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    if [
        "://", "@", "/", "\\", "=", "{", "}", "[", "]", "_", "::", "->",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
        || (lower.contains('(') && lower.contains(')'))
    {
        return true;
    }
    let stripped = lower.trim_matches(|ch| "\"'()[]{}<>,;:!?，。！？".contains(ch));
    let pieces: Vec<&str> = stripped
        .split('.')
        .filter(|piece| !piece.is_empty())
        .collect();
    pieces.len() >= 2 && pieces.last().is_some_and(|piece| delivery_suffix(piece))
}

fn preserve_delivery_ascii_period(chars: &[char], index: usize) -> bool {
    let previous = index.checked_sub(1).and_then(|i| chars.get(i)).copied();
    let next = chars.get(index + 1).copied();
    if previous.is_some_and(is_cjk_char) || next.is_some_and(is_cjk_char) {
        if previous.is_some_and(is_cjk_char) && next.is_some_and(|ch| ch.is_ascii_alphanumeric()) {
            let mut right = index + 1;
            while right < chars.len()
                && (chars[right].is_ascii_alphanumeric() || chars[right] == '.')
            {
                right += 1;
            }
            let token: String = chars[index + 1..right].iter().collect();
            let pieces: Vec<&str> = token
                .trim_matches('.')
                .split('.')
                .filter(|piece| !piece.is_empty())
                .collect();
            if pieces.first().is_some_and(|piece| delivery_suffix(piece))
                || pieces.last().is_some_and(|piece| delivery_suffix(piece))
            {
                return true;
            }
        }
        return false;
    }
    if previous.is_some_and(|ch| ch.is_ascii_digit()) && next.is_some_and(|ch| ch.is_ascii_digit())
    {
        return true;
    }
    if previous.is_some_and(|ch| ch.is_ascii_alphanumeric())
        && next.is_some_and(|ch| ch.is_ascii_alphanumeric())
    {
        return true;
    }

    let mut left = index;
    while left > 0 && is_delivery_ascii_token(chars[left - 1]) {
        left -= 1;
    }
    let mut right = index + 1;
    while right < chars.len() && is_delivery_ascii_token(chars[right]) {
        right += 1;
    }
    let token: String = chars[left..right].iter().collect();
    let lower = token.to_ascii_lowercase();

    if next.is_none_or(|ch| !is_delivery_ascii_token(ch)) {
        let prefix: String = chars[left..index].iter().collect();
        let prefix = prefix.to_ascii_lowercase();
        let prefix = prefix.trim_matches(|ch| "\"'()[]{}<>,;:!?，。！？".contains(ch));
        let pieces: Vec<&str> = prefix
            .split('.')
            .filter(|piece| !piece.is_empty())
            .collect();
        if pieces.len() >= 2 && pieces.last().is_some_and(|piece| delivery_suffix(piece)) {
            return false;
        }
    }
    if index == left
        && next.is_some_and(|ch| ch.is_ascii_alphanumeric())
        && (left == 0 || chars[left - 1].is_whitespace())
    {
        return true;
    }
    if delivery_code_like(&token)
        || (lower.chars().any(|ch| ch.is_ascii_digit()) && lower.contains('.'))
    {
        return true;
    }
    let pieces: Vec<&str> = lower.split('.').filter(|piece| !piece.is_empty()).collect();
    if pieces.len() >= 2
        && pieces
            .iter()
            .all(|piece| piece.len() == 1 && piece.as_bytes()[0].is_ascii_alphabetic())
    {
        return true;
    }
    if next.is_some_and(|ch| ch.is_ascii_alphanumeric())
        && pieces.len() >= 2
        && pieces.last().is_some_and(|piece| delivery_suffix(piece))
    {
        return true;
    }
    if index + 1 == right {
        let mut word_left = index;
        while word_left > 0 && chars[word_left - 1].is_ascii_alphabetic() {
            word_left -= 1;
        }
        let stem: String = chars[word_left..index].iter().collect();
        if DELIVERY_ABBREVIATIONS.contains(&stem.to_ascii_lowercase().as_str()) {
            return true;
        }
    }
    false
}

fn delivery_closing_delimiter(chars: &[char], index: usize) -> bool {
    let ch = chars[index];
    if !matches!(ch, '\'' | '"') {
        return ")]}）］｝】〕」』〉》”’".contains(ch);
    }
    let intra_word = |i: usize| {
        chars[i] == '\''
            && i > 0
            && i + 1 < chars.len()
            && chars[i - 1].is_alphabetic()
            && chars[i + 1].is_alphabetic()
    };
    if intra_word(index) {
        return false;
    }
    chars[..index]
        .iter()
        .enumerate()
        .filter(|(i, candidate)| **candidate == ch && !intra_word(*i))
        .count()
        % 2
        == 1
}

fn should_replace_delivery_punctuation(chars: &[char], index: usize) -> bool {
    let ch = chars[index];
    let comma = matches!(ch, ',' | '，');
    let period = matches!(ch, '.' | '。' | '．');
    if !comma && !period {
        return false;
    }
    let previous = index.checked_sub(1).and_then(|i| chars.get(i)).copied();
    let next = chars.get(index + 1).copied();
    if previous.is_some_and(|value| value.is_ascii_digit())
        && next.is_some_and(|value| value.is_ascii_digit())
    {
        return false;
    }
    if ch == '.' {
        let mut start = index;
        while start > 0 && chars[start - 1] == '.' {
            start -= 1;
        }
        let mut end = index + 1;
        while end < chars.len() && chars[end] == '.' {
            end += 1;
        }
        if end - start >= 3 || preserve_delivery_ascii_period(chars, index) {
            return false;
        }
    }
    true
}

/// Non-destructive delivery projection of subtitles (extending the display semantics of Voice Ink's `SubtitlePresentation.projectPunctuation` to all languages). Ordinary commas and full stops do not take subtitle budget. They are projected into a single half-width separator space only when visible content remains on both sides. Commas and full stops inside numbers and ASCII data tokens are kept.
pub fn target_delivery_projection(text: &str, _lang: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut output = String::new();
    let mut pending_separator = false;
    for (index, &ch) in chars.iter().enumerate() {
        if matches!(ch, '\n' | '\r') {
            output.push(ch);
            pending_separator = false;
            continue;
        }
        if should_replace_delivery_punctuation(&chars, index) {
            while output.ends_with(|candidate: char| {
                candidate.is_whitespace() && !matches!(candidate, '\n' | '\r')
            }) {
                output.pop();
            }
            pending_separator = true;
            continue;
        }
        if ch.is_whitespace() {
            if !pending_separator {
                output.push(ch);
            }
            continue;
        }
        if pending_separator && delivery_closing_delimiter(&chars, index) {
            output.push(ch);
            continue;
        }
        if pending_separator && !output.is_empty() {
            output.push(' ');
        }
        output.push(ch);
        pending_separator = false;
    }
    output
}

/// CJK double-width languages (zh/ja/ko): reading units are measured in full-width cells, and Latin is priced at roughly half a character.
fn cjk_cell_lang(lang: &str) -> bool {
    matches!(primary_subtag(lang).as_str(), "zh" | "ja" | "ko")
}

/// Target-language hard / CPS reading units. All languages first go through the delivery projection. CJK target languages (zh/ja/ko) are then counted by treating two half-width cells as about one full-width character, so Latin product names are not overestimated letter by letter. This is the "Latin letters and digits count about half" promised in the contract's twin. Other languages count the non-whitespace characters after projection.
pub fn target_cps_chars(text: &str, lang: &str) -> usize {
    let projected = target_delivery_projection(text, lang);
    if cjk_cell_lang(lang) {
        let compact: String = projected.chars().filter(|ch| !ch.is_whitespace()).collect();
        visual_width(&compact).div_ceil(2)
    } else {
        count_cps_chars(&projected)
    }
}

/// Width basis of a single piece as a display line: trailing punctuation of the segment (including closing quotes, brackets, and whitespace) is not counted. The contract says "whitespace and the trailing punctuation of a segment are free". The delivery projection exempts only ordinary commas and full stops, while a trailing colon such as “he said:” is still counted as 1 by [`target_cps_chars`]. That would let the flash-frame threshold pass a 2-character piece as 3. Punctuation inside the piece is counted as usual, because after merging it becomes a visible burden within the line.
pub fn piece_display_units(text: &str, lang: &str) -> usize {
    let trimmed = text.trim_end_matches(|ch: char| {
        ch.is_whitespace() || crate::atomize::is_punctuation_or_symbol(ch)
    });
    target_cps_chars(trimmed, lang)
}

/// Rewrite-magnitude guardrail for reordering (AI pipeline design §8.3 / file contract design §2: "validation exists in only one place").
///
/// `reordered` lets the worker reorder the clauses of a translated sentence to remove cross-ordering, but it only permits adjusting order and the necessary connectives and particles. A large drift in reading units means it quietly compressed or padded content, and it is rejected as a rewrite.
///
/// The tolerance is the larger of "±25% and ±4 units“4 units” compressed to “好” would also pass, and the guardrail would be a dead letter for short sentences. The cap affects only sentences under 8 units. The criterion for long sentences is unchanged word for word.
///
/// This is the **single implementation**. Provider acceptance in the align engine, the agent's submit-time lint, and the file-contract table parser all share it. It used to be three character-for-character copies of the arithmetic, which design §2 explicitly asked to merge.
pub fn reordered_rewrite_exceeds(old_units: usize, new_units: usize) -> bool {
    let tolerance = (old_units / 4).max(4).min(old_units.div_ceil(2));
    new_units.abs_diff(old_units) > tolerance
}

/// Target-language delivery reading speed (reading units per second, "bad" tier).
pub fn target_reading_cps(lang: &str) -> f64 {
    match primary_subtag(lang).as_str() {
        "zh" => 9.0,
        "ja" | "ko" => 13.0,
        "th" => 15.0,
        "ar" | "hi" => 18.0,
        _ => 21.0,
    }
}

/// Minimum suggested display duration for one target subtitle. Short clips get at least 1 second; otherwise it follows the target language's CPS.
pub fn target_required_seconds(text: &str, lang: &str) -> f64 {
    (target_cps_chars(text, lang) as f64 / target_reading_cps(lang)).max(1.0)
}

/// Single-line fit check for the target language. CJK target languages (zh/ja/ko) are measured in full-width cells: CJK/full-width = 2 cells, Latin/half-width = 1 cell. Other languages keep counting non-whitespace characters.
pub fn exceeds_one_line_fit(text: &str, lang: &str, fit: usize) -> bool {
    if cjk_cell_lang(lang) {
        visual_width(&target_delivery_projection(text, lang)) > fit * 2
    } else {
        count_cps_chars(text) > fit
    }
}

/// Three thresholds (v0.3 §6.1, counting basis = non-whitespace characters).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransParams {
    /// Trigger: translated sentence ≤ fit and not over hard ⇒ the whole sentence is one line and is not split.
    pub fit: usize,
    /// Suggested: the target piece length when splitting (goes into the LLM prompt and the splitter's DP).
    pub soft: usize,
    /// Forced: any piece > hard ⇒ check blocker. The deterministic splitter does not produce this by construction.
    pub hard: usize,
}

impl TransParams {
    /// Normative defaults: CJK (zh/ja/ko) 16/14/20, others 42/30/42.
    pub fn for_lang(lang: &str) -> Self {
        match primary_subtag(lang).as_str() {
            "zh" | "ja" | "ko" => Self {
                fit: 16,
                soft: 14,
                hard: 20,
            },
            _ => Self {
                fit: 42,
                soft: 30,
                hard: 42,
            },
        }
    }

    /// Explicit fit override (`--fit`, aimed at CJK scenarios): soft = fit−2 (floor 4), hard = max(fit, round(soft × 1.4)).
    pub fn with_fit(fit: usize) -> Self {
        let soft = fit.saturating_sub(2).max(4);
        let hard = fit.max((soft as f64 * 1.4).round() as usize);
        Self { fit, soft, hard }
    }

    /// Three thresholds for Shorts delivery (`delivery: "shorts"` in `project.json`). `fit` takes one line of a vertical caption block: for CJK, full-width characters per [`SHORTS_LINE_EM`]; for other languages, non-whitespace characters per [`SHORTS_LINE_CHARS`]. `soft` and `hard` keep the same ratios as the same tier in [`Self::for_lang`] (CJK 14/16, 20/16; others 30/42, 42/42). So the calibration of [`OVER_FIT_PENALTY`] and the seam-penalty ladder is unchanged. Everything is just narrowed to one line.
    pub fn for_shorts(lang: &str) -> Self {
        let base = Self::for_lang(lang);
        let fit = if cjk_cell_lang(lang) {
            SHORTS_LINE_EM
        } else {
            SHORTS_LINE_CHARS
        };
        let scale = |value: usize| (value as f64 * fit as f64 / base.fit as f64).round() as usize;
        Self {
            fit,
            soft: scale(base.soft),
            hard: scale(base.hard),
        }
    }

    /// Pick the three thresholds by the project's delivery format. `shorts` goes to [`Self::for_shorts`]. Absent or any other value goes to [`Self::for_lang`].
    pub fn for_delivery(lang: &str, delivery: Option<&str>) -> Self {
        match delivery.map(str::trim) {
            Some(SHORTS_DELIVERY) => Self::for_shorts(lang),
            _ => Self::for_lang(lang),
        }
    }
}

/// The value for Shorts delivery in `project.json` (same name as `ccut_project::DELIVERIES`).
pub const SHORTS_DELIVERY: &str = "shorts";

/// How many full-width characters (em) fit on one line of a Shorts vertical caption block. The caption block is 60% of the frame width, and the translation line's font size is 5.5% of the frame width (`ccut_editor_core::shorts::caption_width` / `CAPTION_WIDTH_PCT`; in both the bilingual and translation-only track sets, the translation line is the largest line). 60 / 5.5 ≈ 10.9, rounded down. The editor-core tests recompute from those two numbers and cross-check against this value. If one side changes, the other side fails.
pub const SHORTS_LINE_EM: usize = 10;

/// How many non-whitespace characters fit on one line for target languages other than CJK. The counting basis is the same as [`count_cps_chars`]. Based on the literal Shorts caption setup (`system` resolves to the built-in Noto Sans SC, weight 800): Latin sentences average 0.58–0.61 em per non-whitespace character (English, French, German, Spanish, with inter-word spaces spread in), so a 10.9 em line fits about 18–19. Cyrillic is 0.65 em, about 17. Take 17 so that Cyrillic also fits on one line. Other scripts (Arabic, Devanagari, Thai, etc.) fall into this same tier as in [`TransParams::for_lang`], without per-script measurement.
pub const SHORTS_LINE_CHARS: usize = 17;

/// Objective-function penalty for pieces over fit. Audit §7 P0-a: the "converge toward soft" square term of `piece_cost` **actively prefers** one 19u piece over two 9.5u pieces (0.178 < 1.089). So over-fit pieces were chosen by the objective function, not because seams were insufficient. 10 of the 30 over-fit pieces in R3 have a free seam available.
///
/// The calibration sits between the seam-penalty steps: it is greater than the inter-word whitespace 0.8 plus the worst-case length-square difference (((fit−soft)/soft)² ≈ 0.02 and ((hard−soft)/soft)² ≈ 0.19). So whenever a legal seam exists that can truly eliminate the over-fit piece, the DP always takes it. Measured on R3, the top-10 over-fit pieces all match the [`crate::seam::free_seam`] criterion.
pub(crate) const OVER_FIT_PENALTY: f64 = 1.5;

/// "No-seam" tier penalty (the seam has neither punctuation nor whitespace: CJK character boundaries, and after opening punctuation followed by Latin).
///
/// It must equal 1.5 + [`OVER_FIT_PENALTY`]. This is the arithmetic form of "a seam is forcibly used for splitting only if it is a **fully legal** seam". One cut can give back at most one piece's over-fit penalty (1.2), one seam-penalty tier (≤0.8), and the length-square term (≤((hard−soft)/soft)², 0.19 for the CJK tier). That totals less than 2.7. So over-fit can never buy a no-seam cut. In a pure-CJK piece with no free seam, the piece stays whole for delivery and goes to the translation-unsplittable channel. It is not forced into a cut like [`crate::seam::cjk_midword_boundary`], which the draft gate always rejects after splitting.
pub(crate) const NO_SEAM_PENALTY: f64 = 1.5 + OVER_FIT_PENALTY;

/// Objective seam penalty for grammatical defects (must be > [`NO_SEAM_PENALTY`]).
///
/// Originally the DP objective knew nothing about seam quality. Split legality depended entirely on the after-the-fact [`crate::seam::repair_lint_pieces`] merging back, and merging always widens a piece again. Once the over-fit penalty was introduced, this chain became a seesaw between "over-fit line ⇄ dangling". Measurements selected cuts such as `它会把 KV | 缓存拆分成…` (a dangling 处置式 construction) and `vLLM 还提供了一个零成本的 | n-gram 推测器，` (a dangling “的”). Once [`is_objective_blocking`] is counted directly in the objective, the DP cures over-fit only at **fully legal free seams**. That matches the [`crate::seam::free_seam`] criterion by construction.
pub(crate) const BLOCKING_SEAM_PENALTY: f64 = NO_SEAM_PENALTY + 0.5;

/// Seam penalty (lower = more willing to cut here): sentence end 0 < clause punctuation 0.3 < inter-word whitespace 0.8 < no-seam tier [`NO_SEAM_PENALTY`]. Atomic boundaries are naturally legal. Atomize attaches punctuation runs uniformly to the **preceding** atom (opening punctuation included, so `名为“` is one atom), and it keeps Latin words and numbers cohesive. So a seam of "opening punctuation followed by Latin" must be judged 0 by [`sep_len`] to fall into the 1.5 tier. Otherwise the DP would treat it as a cheap inter-word whitespace seam and preferentially cut right after the opening quote.
/// `whitespace_backed`: the seam really has whitespace in the original text (see [`seam_backed_by_whitespace`]). A rendered space inserted at a CJK/Latin junction is not a seam. Otherwise "担心 | AI 会抢走…" would be treated as an inter-word seam, and as soon as the over-fit penalty pressed, it would cut between a verb and its object clause. The alignment-block DP ([`crate::align_block`]) reuses the same yardstick.
pub(crate) fn seam_penalty(prev: &str, next: &str, whitespace_backed: bool) -> f64 {
    if sentence_end(prev) {
        0.0
    } else if clause_end_char(prev).is_some() {
        0.3
    } else if whitespace_backed && sep_len(prev, next) == 1 {
        0.8
    } else {
        NO_SEAM_PENALTY
    }
}

fn join_atoms(atoms: &[String]) -> String {
    join_word_texts(atoms.iter().map(String::as_str))
}

/// Align-each-side split (v0.3 §5.1). The DP chooses seams. Each piece is ≤ hard and close to soft, preferring higher-grade seams. The piece count is ≤ `max_pieces` (each piece must anchor at least one source word). If the translated sentence satisfies both ≤ fit and ≤ hard, it is kept as one whole piece.
/// A single atom over hard (for example a giant Latin word) falls back to a hard character-position cut.
pub fn split_independent(
    translation: &str,
    params: &TransParams,
    max_pieces: usize,
) -> Vec<String> {
    split_independent_for_lang(translation, params, max_pieces, "")
}

/// The target-language-aware version of [`split_independent`]. For Simplified Chinese, it uses the delivery-projection budget consistent with fit/hard validation.
pub fn split_independent_for_lang(
    translation: &str,
    params: &TransParams,
    max_pieces: usize,
    lang: &str,
) -> Vec<String> {
    split_independent_for_lang_protected(translation, params, max_pieces, lang, &[])
}

/// Target-language-aware splitting. Specified target terms are treated as atoms that must not be broken from the middle.
pub fn split_independent_for_lang_protected(
    translation: &str,
    params: &TransParams,
    max_pieces: usize,
    lang: &str,
    protected_terms: &[String],
) -> Vec<String> {
    split_independent_impl(
        translation,
        params,
        max_pieces,
        lang,
        protected_terms,
        SplitMode::Deliver,
    )
}

/// Strict legal split: cut only at **non-objective-defect** seams, every piece must be ≤ hard, and there is no fallback character-position hard cut. When such a split exists, return the pieces (≥2). When the whole thing is already ≤ fit and ≤ hard, return a single piece. Return `None` if none is found.
///
/// The difference from [`split_independent_for_lang`] is **the question each one answers**. A delivery split must always produce a result. Objective-defect seams are only heavily penalized, and the fallback does a hard character-position cut. So its output cannot be used to judge whether the worker has a legal action. The submit-time lint needs exactly that. It uses this function to hint the worker at a cut (the cut itself must pass the `align-illegal-seam` lint), or, when there is no solution, it lets the submission through instead of rejecting it.
pub fn legal_split_for_lang(
    translation: &str,
    params: &TransParams,
    max_pieces: usize,
    lang: &str,
) -> Option<Vec<String>> {
    let pieces = split_independent_impl(
        translation,
        params,
        max_pieces,
        lang,
        &[],
        SplitMode::LegalOnly,
    );
    (!pieces.is_empty()).then_some(pieces)
}

/// The two modes of [`split_independent_impl`].
#[derive(Clone, Copy, PartialEq, Eq)]
enum SplitMode {
    /// Delivery: always produces a result. Objective-defect seams are heavily penalized. A single atom over hard is allowed, and is handled by a character-position hard cut in [`oversize_hard_cut`] as a fallback.
    Deliver,
    /// Strict legal: objective-defect seams are simply infeasible. No piece may exceed hard. The DP returns empty if there is no solution.
    LegalOnly,
}

fn split_independent_impl(
    translation: &str,
    params: &TransParams,
    max_pieces: usize,
    lang: &str,
    protected_terms: &[String],
    mode: SplitMode,
) -> Vec<String> {
    let atoms = atomize(translation);
    if atoms.is_empty() {
        return Vec::new();
    }
    let within_visual_fit = !exceeds_one_line_fit(translation, lang, params.fit);
    let within_hard = target_cps_chars(translation, lang) <= params.hard;
    if within_visual_fit && within_hard {
        return vec![translation.to_owned()];
    }
    if atoms.len() == 1 || max_pieces <= 1 {
        return match mode {
            SplitMode::Deliver => oversize_hard_cut(join_atoms(&atoms), params, lang),
            SplitMode::LegalOnly => Vec::new(),
        };
    }

    let n = atoms.len();
    let canonical = join_atoms(&atoms);
    let seam_positions = {
        let mut positions = vec![0usize; n + 1];
        let mut cursor = 0usize;
        for index in 0..n {
            if index > 0 {
                cursor += sep_len(&atoms[index - 1], &atoms[index]);
            }
            positions[index] = cursor;
            cursor += atoms[index].chars().count();
        }
        positions[n] = cursor;
        positions
    };
    let protected_ranges = protected_terms
        .iter()
        .filter(|term| !term.is_empty() && target_cps_chars(term, lang) <= params.fit)
        .flat_map(|term| {
            canonical.match_indices(term).map(|(start, matched)| {
                let start_chars = canonical[..start].chars().count();
                let end_chars = start_chars + matched.chars().count();
                (start_chars, end_chars)
            })
        })
        .collect::<Vec<_>>();
    let seam_protected = |atom_index: usize| {
        let position = seam_positions[atom_index];
        protected_ranges
            .iter()
            .any(|(start, end)| *start < position && position < *end)
    };
    let widths: Vec<usize> = atoms
        .iter()
        .map(|atom| target_cps_chars(atom, lang))
        .collect();
    let prefix: Vec<usize> = std::iter::once(0)
        .chain(widths.iter().scan(0, |acc, w| {
            *acc += w;
            Some(*acc)
        }))
        .collect();
    let piece_len = |j: usize, i: usize| prefix[i] - prefix[j];
    // The over-fit check must use the same visual basis as check and delivery. `target_cps_chars` strips whitespace before measuring, and `exceeds_one_line_fit` measures together with the separator spaces. Pieces containing Latin (most of the R3 top-10 over-fit pieces) would be missed wholesale under a unit basis. Memoized per (j,i). Combinations over hard are already eliminated, and the search converges early by the monotonicity of `piece_len`.
    let mut over_fit = vec![false; (n + 1) * (n + 1)];
    for j in 0..n {
        for i in (j + 1)..=n {
            if piece_len(j, i) > params.hard {
                break;
            }
            over_fit[j * (n + 1) + i] =
                exceeds_one_line_fit(&join_atoms(&atoms[j..i]), lang, params.fit);
        }
    }
    // The seam legality is checked once in advance on the two-piece split "prefix | suffix", since the seam-quality criteria are both local tail and head shapes.
    // The strict basis separately records objective-defect seams. That is the rejection criterion of the `align-illegal-seam` lint. In LegalOnly mode they are simply infeasible.
    let mut objective_seam = vec![false; n + 1];
    let blocking_seam: Vec<bool> = (0..=n)
        .map(|j| {
            if j == 0 || j == n {
                return false;
            }
            let left = join_atoms(&atoms[..j]);
            let right = join_atoms(&atoms[j..]);
            let issues = lint_pieces(&[left.as_str(), right.as_str()], lang, params);
            objective_seam[j] = issues.iter().any(is_objective_blocking);
            // CJK intra-word boundaries rank at the same level as objective defects. The deterministic splitter works on character atoms and has no dictionary. So “a cut inside a word” is reported by none of the `lint_pieces` rules, because the trailing character “可” is not in the weak-tail table. Yet it is harder to read than any weak tail. Without this term, the DP would cut into the word on purpose, to avoid the weak-tail penalty of "…将". The p850 live case s-g79.0, "可|以", came from exactly this, and `oversize_hard_cut` was never called.
            // Use an additive penalty, not a hard exclusion. In a pure CJK long sentence every seam is an intra-word boundary, and a hard exclusion would leave the whole sentence without a solution.
            cjk_midword_boundary(left.trim_end(), right.trim_start())
                // Use the full Blocking set, not only the objective level. Flash fragments are likewise not a deliverable line, and the over-fit penalty must not push a piece into a 2-unit head piece such as `vLLM | 还提供了…`.
                || issues
                    .iter()
                    .any(|issue| issue.kind == SeamLintKind::Blocking)
        })
        .collect();
    let soft = params.soft as f64;
    let piece_cost = |j: usize, i: usize| -> Option<f64> {
        let len = piece_len(j, i);
        if len > params.hard {
            if i - j == 1 && mode == SplitMode::Deliver {
                // A single atom over hard is allowed (the later hard-cut fallback handles it), but it is heavily penalized.
                return Some(5.0 + (len - params.hard) as f64 * 0.5);
            }
            return None;
        }
        let mut cost = ((len as f64 - soft) / soft).powi(2);
        if over_fit[j * (n + 1) + i] {
            cost += OVER_FIT_PENALTY;
        }
        Some(cost)
    };

    let max_k = max_pieces.min(n);
    const INF: f64 = f64::INFINITY;
    // dp[k][i] = minimum cost of splitting the first i atoms into k pieces.
    let mut dp = vec![vec![INF; n + 1]; max_k + 1];
    let mut back = vec![vec![0usize; n + 1]; max_k + 1];
    dp[0][0] = 0.0;
    for k in 1..=max_k {
        for i in 1..=n {
            for j in (k - 1)..i {
                if j > 0 && seam_protected(j) {
                    continue;
                }
                if j > 0 && mode == SplitMode::LegalOnly && objective_seam[j] {
                    continue;
                }
                let Some(cost) = piece_cost(j, i) else {
                    continue;
                };
                if dp[k - 1][j] == INF {
                    continue;
                }
                let seam = if j > 0 {
                    seam_penalty(
                        &atoms[j - 1],
                        &atoms[j],
                        seam_backed_by_whitespace(translation, &atoms, j),
                    ) + if blocking_seam[j] {
                        BLOCKING_SEAM_PENALTY
                    } else {
                        0.0
                    }
                } else {
                    0.0
                };
                let candidate = dp[k - 1][j] + cost + seam + 0.05;
                if candidate < dp[k][i] {
                    dp[k][i] = candidate;
                    back[k][i] = j;
                }
            }
        }
    }
    let Some(best_k) = (1..=max_k)
        .filter(|&k| dp[k][n] < INF)
        .min_by(|&a, &b| dp[a][n].total_cmp(&dp[b][n]))
        .or_else(|| (mode == SplitMode::Deliver).then_some(1))
    else {
        return Vec::new();
    };

    let mut cuts = Vec::new();
    let mut i = n;
    for k in (1..=best_k).rev() {
        let j = back[k][i];
        cuts.push(j);
        i = j;
    }
    cuts.reverse(); // The first element is always 0
    let mut pieces = Vec::with_capacity(best_k);
    for (index, &j) in cuts.iter().enumerate() {
        let end = cuts.get(index + 1).copied().unwrap_or(n);
        let piece = join_atoms(&atoms[j..end]);
        match mode {
            SplitMode::Deliver => pieces.extend(oversize_hard_cut(piece, params, lang)),
            // Under LegalOnly, `piece_cost` has already excluded any piece over hard, so no fallback is needed.
            SplitMode::LegalOnly => pieces.push(piece),
        }
    }
    // The hard-cut fallback may break the piece-count cap. Merge from the head until it is within the cap (an extreme case, where completeness takes priority).
    while pieces.len() > max_pieces && pieces.len() > 1 {
        let merged = join_word_texts([pieces[0].as_str(), pieces[1].as_str()]);
        pieces.splice(0..2, [merged]);
    }
    pieces
}

/// Seam-snapping window (in atom count) for the over-hard fallback split. If a stronger seam exists within this many atoms of the ideal equal-width cut point, snap to it. A larger window would pull piece lengths too far from soft and create new over-width or flash pieces.
const OVERSIZE_SEAM_WINDOW: usize = 3;
/// Fallback split for a single piece over hard. First split at atom boundaries, and snap to the strongest seam within ±[`OVERSIZE_SEAM_WINDOW`] atoms of the ideal equal-width cut point. Only when the window contains nothing but CJK intra-word boundaries is it relaxed to all feasible boundaries, to find a non-intra-word cut. Only when the span has no usable atom boundary at all (for example a giant Latin word) does it fall back to a pure character-position hard cut.
///
/// This is the last fallback when the DP has no solution. [`piece_cost`] treats over-hard as infeasible, so a tail piece that contains long protected terms ends up here. The old implementation was a pure equal-width cut with no seam awareness, which inevitably produced intra-word cuts like "可|以". After making it seam-aware, it still guarantees each piece ≤ hard. Snapping is adopted only if neither side breaks the ceiling. Each cut's ideal position is re-derived from the **actual** previous cut, not from a fixed equal-width grid, so accumulated error cannot push the last piece over hard.
fn oversize_hard_cut(text: String, params: &TransParams, lang: &str) -> Vec<String> {
    let total = target_cps_chars(&text, lang);
    if total <= params.hard {
        return vec![text];
    }
    let atoms = atomize(&text);
    if atoms.len() >= 2 {
        return oversize_seam_cut(&atoms, params, lang);
    }
    oversize_char_cut(text, params, lang)
}

/// Atom-boundary plus seam-snapping over-hard split. Each piece is ≤ hard, unless a single atom by itself exceeds hard. In that case the atom is hard-cut at character positions alone.
fn oversize_seam_cut(atoms: &[String], params: &TransParams, lang: &str) -> Vec<String> {
    let n = atoms.len();
    // prefix[i] = the target's display units for the first i atoms (measured on the concatenated text, on the same basis as `target_cps_chars`).
    let mut prefix = vec![0usize; n + 1];
    for index in 0..n {
        prefix[index + 1] = prefix[index] + target_cps_chars(&atoms[index], lang);
    }
    let span = |from: usize, to: usize| prefix[to] - prefix[from];
    let refs: Vec<&str> = atoms.iter().map(String::as_str).collect();

    let mut pieces: Vec<String> = Vec::new();
    let mut start = 0usize;
    while start < n {
        let remaining = span(start, n);
        if remaining <= params.hard {
            pieces.push(join_atoms(&atoms[start..n]));
            break;
        }
        // A single atom over hard by itself: no legal boundary can save it, so fall back to a character hard cut.
        if span(start, start + 1) > params.hard {
            pieces.extend(oversize_char_cut(
                join_atoms(&atoms[start..start + 1]),
                params,
                lang,
            ));
            start += 1;
            continue;
        }
        // Feasibility upper bound: the left piece must not exceed hard.
        let mut max_cut = start + 1;
        while max_cut < n && span(start, max_cut + 1) <= params.hard {
            max_cut += 1;
        }
        // The ideal cut point is re-derived from the **remaining** length, not from a fixed grid.
        let parts_left = remaining.div_ceil(params.soft).max(2);
        let ideal_len = remaining.div_ceil(parts_left);
        let ideal = (start + 1..=max_cut)
            .find(|&cut| span(start, cut) >= ideal_len)
            .unwrap_or(max_cut);

        let midword = |cut: usize| {
            crate::seam::cjk_midword_boundary(
                join_atoms(&atoms[start..cut]).trim_end(),
                join_atoms(&atoms[cut..n]).trim_start(),
            )
        };
        let score = |cut: usize| {
            let strength = crate::seam::source_boundary_strength(&refs, cut);
            let distance = ideal.abs_diff(cut);
            // Seam strength first, then non-intra-word cuts, then closer to ideal, then earlier.
            (std::cmp::Reverse(strength), midword(cut), distance, cut)
        };
        let window_lo = ideal.saturating_sub(OVERSIZE_SEAM_WINDOW).max(start + 1);
        let window_hi = (ideal + OVERSIZE_SEAM_WINDOW).min(max_cut);
        let best = (window_lo..=window_hi)
            .min_by_key(|&cut| score(cut))
            .unwrap_or(ideal);
        // If the window has no seam, and only CJK intra-word cut points, relax to all feasible boundaries and pick a non-intra-word cut point (the one nearest the ideal point). Intra-word cuts are only the last fallback.
        let cut = if crate::seam::source_boundary_strength(&refs, best) == 0 && midword(best) {
            (start + 1..=max_cut)
                .filter(|&cut| !midword(cut))
                .min_by_key(|&cut| (ideal.abs_diff(cut), cut))
                .unwrap_or(best)
        } else {
            best
        };
        pieces.push(join_atoms(&atoms[start..cut]));
        start = cut;
    }
    pieces.retain(|piece| !piece.trim().is_empty());
    pieces
}

/// Pure character-position hard cut: split evenly by the soft target (returned as-is if under hard). Used only when the whole span has no usable atom boundary.
fn oversize_char_cut(text: String, params: &TransParams, lang: &str) -> Vec<String> {
    let total = target_cps_chars(&text, lang);
    if total <= params.hard {
        return vec![text];
    }
    let parts = total.div_ceil(params.soft).max(2);
    let per = total.div_ceil(parts);
    let mut pieces = Vec::with_capacity(parts);
    let mut current = String::new();
    let mut cps = 0usize;
    for ch in text.chars() {
        current.push(ch);
        if !ch.is_whitespace() && target_cps_chars(&ch.to_string(), lang) > 0 {
            cps += 1;
            if cps >= per && pieces.len() + 1 < parts {
                pieces.push(std::mem::take(&mut current).trim().to_owned());
                cps = 0;
            }
        }
    }
    if !current.trim().is_empty() {
        pieces.push(current.trim().to_owned());
    }
    pieces.retain(|piece| !piece.is_empty());
    pieces
}

/// Forced one-to-one or fallback split (v0.3 §5.3). The translation is split proportionally by `weights` (each source Cue's non-whitespace character count in the source text). Each cut point snaps to the nearest atom boundary within ±`snap` non-whitespace characters. If none is found, it is hard-cut by character position. Returns exactly `weights.len()` segments. Empty segments are allowed, so the caller must merge them into adjacent piece ranges.
pub fn split_proportional(translation: &str, weights: &[usize], snap: usize) -> Vec<String> {
    if weights.is_empty() {
        return Vec::new();
    }
    let atoms = atomize(translation);
    let canonical = join_atoms(&atoms);
    let chars: Vec<char> = canonical.chars().collect();
    // cps_prefix[i] = the number of non-whitespace characters in chars[0..i]. atom_boundary[i] = position i (between chars[i-1] and chars[i]) is an atom boundary.
    let mut cps_prefix = vec![0usize; chars.len() + 1];
    for (i, ch) in chars.iter().enumerate() {
        cps_prefix[i + 1] = cps_prefix[i] + usize::from(!ch.is_whitespace());
    }
    let mut atom_boundary = vec![false; chars.len() + 1];
    {
        let mut pos = 0usize;
        for (index, atom) in atoms.iter().enumerate() {
            if index > 0 && sep_len(&atoms[index - 1], atom) == 1 {
                pos += 1; // Separator space
                atom_boundary[pos] = true;
            } else if index > 0 {
                atom_boundary[pos] = true;
            }
            pos += atom.chars().count();
        }
    }
    let total_cps = *cps_prefix.last().expect("non-empty prefix");
    let total_weight: usize = weights.iter().map(|w| (*w).max(1)).sum();

    let mut cut_chars = Vec::with_capacity(weights.len() - 1);
    let mut accumulated = 0usize;
    let mut previous_char = 0usize;
    for weight in &weights[..weights.len() - 1] {
        accumulated += (*weight).max(1);
        let ideal_cps =
            ((accumulated as f64 / total_weight as f64) * total_cps as f64).round() as usize;
        // Target cps → character position (the first position that reaches the ideal).
        let ideal_char = cps_prefix
            .iter()
            .position(|&c| c >= ideal_cps)
            .unwrap_or(chars.len());
        // Find the nearest atom boundary within ±snap (in cps distance).
        let mut best: Option<(usize, usize)> = None; // (distance, position)
        for pos in previous_char + 1..=chars.len() {
            if !atom_boundary[pos] {
                continue;
            }
            let distance = cps_prefix[pos].abs_diff(ideal_cps);
            if distance <= snap && best.is_none_or(|(d, _)| distance < d) {
                best = Some((distance, pos));
            }
        }
        let cut = best.map_or_else(
            || ideal_char.clamp(previous_char, chars.len()),
            |(_, pos)| pos,
        );
        cut_chars.push(cut);
        previous_char = cut;
    }

    let mut pieces = Vec::with_capacity(weights.len());
    let mut start = 0usize;
    for &cut in &cut_chars {
        pieces.push(
            chars[start..cut]
                .iter()
                .collect::<String>()
                .trim()
                .to_owned(),
        );
        start = cut;
    }
    pieces.push(chars[start..].iter().collect::<String>().trim().to_owned());
    pieces
}

/// Independent pieces → source word ranges within the sentence (the discrete form of the time anchoring in v0.3 §5.1). Assign each piece at least one source word by cumulative character proportion, partitioning `0..word_count` into ranges. The caller guarantees `piece_cps.len() <= word_count`.
pub fn anchor_pieces_to_words(piece_cps: &[usize], word_count: usize) -> Vec<(usize, usize)> {
    let k = piece_cps.len();
    assert!(
        k >= 1 && k <= word_count,
        "pieces {k} must fit in {word_count} words"
    );
    let total: usize = piece_cps.iter().map(|c| (*c).max(1)).sum();
    let mut ranges = Vec::with_capacity(k);
    let mut cursor = 0usize;
    let mut accumulated = 0usize;
    for (index, cps) in piece_cps.iter().enumerate() {
        accumulated += (*cps).max(1);
        let remaining_pieces = k - index - 1;
        let ideal_end = ((accumulated as f64 / total as f64) * word_count as f64).round() as usize;
        let end = if remaining_pieces == 0 {
            word_count
        } else {
            ideal_end.clamp(cursor + 1, word_count - remaining_pieces)
        };
        ranges.push((cursor, end - 1));
        cursor = end;
    }
    ranges
}

/// The baseline text of a `transAlign` entry (alignment-block design §5). With `text_basis == trans`, take `trans[lang][sid]`. With `display`, take `transDisplay[lang][sid].text`. If it is missing ⇒ `None` (the entry is treated as align-stale).
pub fn basis_text<'a>(
    doc: &'a TranscriptDoc,
    lang: &str,
    sentence_id: &str,
    entry: &TransAlign,
) -> Option<&'a str> {
    match entry.text_basis {
        TextBasis::Trans => doc
            .trans
            .get(lang)
            .and_then(|table| table.get(sentence_id))
            .map(String::as_str),
        TextBasis::Display => doc
            .trans_display
            .get(lang)
            .and_then(|table| table.get(sentence_id))
            .map(|display| display.text.as_str()),
    }
}

/// The language-aware entry point of [`align_entry_valid`]. It resolves the baseline text automatically from `text_basis`.
pub fn align_entry_valid_for_lang(
    doc: &TranscriptDoc,
    sentence: &Sentence,
    lang: &str,
    entry: &TransAlign,
) -> bool {
    basis_text(doc, lang, &sentence.id, entry)
        .is_some_and(|text| align_entry_valid(doc, sentence, text, entry))
}

/// Validity of a `transAlign` entry (v0.3 §4 invariants plus the 0.4 block-layer I3/I4). Invalid ⇒ align-stale, and display degrades to the whole sentence on screen. `translation` must be the baseline text that matches the entry's `text_basis` ([`basis_text`]). Only a `trans`-based entry may be passed the natural translated sentence directly.
pub fn align_entry_valid(
    doc: &TranscriptDoc,
    sentence: &Sentence,
    translation: &str,
    entry: &TransAlign,
) -> bool {
    if entry.pieces.is_empty() {
        return false;
    }
    if entry.crossing && entry.mode != AlignMode::ManyToOne {
        return false;
    }
    let concatenated: String = entry
        .pieces
        .iter()
        .map(|piece| piece.text.as_str())
        .collect();
    if normalize_chars(&concatenated) != normalize_chars(translation) {
        return false;
    }
    match entry.mode {
        AlignMode::Independent => {
            // independent makes no alignment claim. It has no block layer, and it must not claim a block-level correspondence.
            if !entry.blocks.is_empty() || entry.correspondence == Some(Correspondence::Block) {
                return false;
            }
            ordered_anchor_ordinals(doc, sentence, &entry.words).is_some()
                && entry
                    .pieces
                    .iter()
                    .all(|piece| piece.from.is_none() && piece.to.is_none())
        }
        AlignMode::ManyToOne => {
            let Some(anchor_ordinals) = ordered_anchor_ordinals(doc, sentence, &entry.words) else {
                return false;
            };
            if entry.words.is_empty() {
                return false;
            }
            let anchor_count = anchor_ordinals.len();
            let mut expected = 0usize;
            for piece in &entry.pieces {
                let (Some(from), Some(to)) = (piece.from, piece.to) else {
                    return false;
                };
                if from != expected || to < from || to >= anchor_count {
                    return false;
                }
                expected = to + 1;
            }
            if expected != anchor_count {
                return false;
            }
            // Explicit whole-sentence correspondence: only one piece. (Old `crossing` entries are interpreted on the read side and are not restricted.)
            if entry.correspondence == Some(Correspondence::Sentence) && entry.pieces.len() != 1 {
                return false;
            }
            crate::align_block::validate_blocks(entry, anchor_count)
        }
        // The legacy oneToOne anchored directly to source Cues, which violates the contract that translation Cues are derived independently.
        AlignMode::OneToOne => false,
    }
}

/// Resolve an optional delivery-word snapshot to sentence-local word ordinals.
/// Empty `words` retains the historical independent-mode meaning of the whole
/// sentence; a non-empty list may be an ordered subset after timeline cuts.
fn ordered_anchor_ordinals(
    doc: &TranscriptDoc,
    sentence: &Sentence,
    words: &[String],
) -> Option<Vec<usize>> {
    if words.is_empty() {
        return Some((0..sentence.word_indices.len()).collect());
    }
    let mut output = Vec::with_capacity(words.len());
    let mut cursor = 0_usize;
    for id in words {
        let offset = sentence.word_indices[cursor..]
            .iter()
            .position(|&index| doc.words[index].id == *id)?;
        cursor += offset;
        output.push(cursor);
        cursor += 1;
    }
    Some(output)
}

/// Translation Cue (subtitle projection, not persisted).
#[derive(Debug, Clone, PartialEq)]
pub struct TransCue {
    pub sentence_id: String,
    pub text: String,
    pub start: f64,
    pub end: f64,
    /// Source-word index range within the sentence for manyToOne and independent. When the target has more pieces than source words, independent is timed by the whole-sentence window and this is left as `None`.
    pub word_span: Option<(usize, usize)>,
    /// true = whole-sentence on-screen fallback for an entry with no valid transAlign.
    pub fallback: bool,
}

/// Without changing the persisted word anchors or the piece text, use the silence between pieces and slightly move the display boundaries, to give the translated pieces within the same sentence the minimum reading time. If the whole sentence's duration cannot satisfy all pieces at once, distribute the whole-sentence window in proportion to the duration each piece needs. The shortage is shared by all pieces. It is not left to a later-ordered piece, or to the line that happened to pair with a short source piece, to flash by alone.
fn smooth_trans_cue_times(cues: &mut [TransCue], lang: &str) {
    if cues.len() < 2 {
        return;
    }
    let sentence_start = cues[0].start;
    let sentence_end = cues.last().expect("non-empty").end;
    let available = (sentence_end - sentence_start).max(0.0);
    let mut required: Vec<f64> = cues
        .iter()
        .map(|cue| target_required_seconds(&cue.text, lang))
        .collect();
    let total_required: f64 = required.iter().sum();
    if total_required > available {
        if total_required <= f64::EPSILON {
            return;
        }
        // After proportional compression, sum == available. The boundary derivation below stays feasible, and each piece gets a duration proportional to its reading load. (pad_trans_cue_times will then still borrow silence from outside the sentence to cover the absolute shortfall.)
        let scale = available / total_required;
        for value in &mut required {
            *value *= scale;
        }
    }

    let preferred: Vec<f64> = cues
        .windows(2)
        .map(|pair| (pair[0].end + pair[1].start) * 0.5)
        .collect();
    let mut suffix_required = vec![0.0; cues.len() + 1];
    for index in (0..cues.len()).rev() {
        suffix_required[index] = suffix_required[index + 1] + required[index];
    }

    let mut previous = sentence_start;
    for index in 0..cues.len() - 1 {
        let earliest = previous + required[index];
        let latest = sentence_end - suffix_required[index + 1];
        // Equivalent sums can differ by one ULP depending on accumulation
        // order, briefly making `earliest` a hair greater than `latest`.
        // Manual saturation keeps that harmless precision noise from turning
        // `f64::clamp` into a process-wide panic.
        let boundary = preferred[index].max(earliest).min(latest);
        cues[index].start = previous;
        cues[index].end = boundary;
        previous = boundary;
    }
    let last = cues.last_mut().expect("non-empty");
    last.start = previous;
    last.end = sentence_end;
}

/// Pad target subtitles that are still too short, using the real silence between adjacent subtitles (and the blank at the media tail). Extend only into blank space and never overlap adjacent subtitles. Borrow silence from the later side first, then from the earlier side.
fn pad_trans_cue_times(cues: &mut [TransCue], lang: &str, media_end: f64) {
    for index in 0..cues.len() {
        let required = target_required_seconds(&cues[index].text, lang);
        let mut missing = required - (cues[index].end - cues[index].start);
        if missing <= 1e-9 {
            continue;
        }

        let next_start = cues
            .get(index + 1)
            .map(|cue| cue.start)
            .unwrap_or_else(|| media_end.max(cues[index].end));
        let after = (next_start - cues[index].end).max(0.0);
        let extend_after = missing.min(after);
        cues[index].end += extend_after;
        missing -= extend_after;

        if missing > 1e-9 {
            let previous_end = index
                .checked_sub(1)
                .and_then(|previous| cues.get(previous))
                .map(|cue| cue.end)
                .unwrap_or(0.0);
            let before = (cues[index].start - previous_end).max(0.0);
            cues[index].start -= missing.min(before);
        }
    }
}

/// Derive the translation Cue stream. Each translated sentence expands into 1..N [`TransCue`] (in time order). Untranslated sentences produce nothing. Sentences with an invalid or missing `transAlign` produce a single cue for the whole sentence (the natural translation). The piece text of a valid entry is projected according to its `text_basis` baseline ([`basis_text`]). A manyToOne entry with explicit `correspondence: sentence` is shown as a single whole-sentence cue (time window = the anchored word window). `fallback` follows the rule "degrade only when the text exceeds single-line capacity".
pub fn derive_trans_cues(doc: &TranscriptDoc, sentences: &[Sentence], lang: &str) -> Vec<TransCue> {
    let Some(table) = doc.trans.get(lang) else {
        return Vec::new();
    };
    let align_table = doc.trans_align.get(lang);
    let mut out = Vec::new();
    for sentence in sentences {
        let mut sentence_out = Vec::new();
        let Some(translation) = table.get(&sentence.id) else {
            continue;
        };
        let entry = align_table
            .and_then(|t| t.get(&sentence.id))
            .filter(|entry| align_entry_valid_for_lang(doc, sentence, lang, entry));
        let Some(entry) = entry else {
            let fits_one_line =
                !exceeds_one_line_fit(translation, lang, TransParams::for_lang(lang).fit);
            sentence_out.push(TransCue {
                sentence_id: sentence.id.clone(),
                text: translation.clone(),
                start: sentence.word_start(doc),
                end: sentence.word_end(doc),
                word_span: None,
                // The translation stream does not read the source Cue count. Only exceeding the target single-line capacity without a valid split counts as degradation.
                fallback: !fits_one_line,
            });
            out.extend(sentence_out);
            continue;
        };
        match entry.mode {
            AlignMode::ManyToOne if entry.correspondence == Some(Correspondence::Sentence) => {
                // Whole-sentence correspondence: the source is highlighted word by word following the word timing, and the translation is shown statically as a whole sentence. It does not claim per-piece correspondence.
                let anchor_ordinals =
                    ordered_anchor_ordinals(doc, sentence, &entry.words).expect("validated");
                let first = anchor_ordinals[0];
                let last = *anchor_ordinals.last().expect("non-empty");
                let text = basis_text(doc, lang, &sentence.id, entry)
                    .expect("validated")
                    .to_owned();
                let fits_one_line =
                    !exceeds_one_line_fit(&text, lang, TransParams::for_lang(lang).fit);
                sentence_out.push(TransCue {
                    sentence_id: sentence.id.clone(),
                    text,
                    start: doc.words[sentence.word_indices[first]].t0,
                    end: doc.words[sentence.word_indices[last]].t1,
                    word_span: Some((first, last)),
                    fallback: !fits_one_line,
                });
            }
            AlignMode::ManyToOne => {
                let anchor_ordinals =
                    ordered_anchor_ordinals(doc, sentence, &entry.words).expect("validated");
                for piece in &entry.pieces {
                    let (from, to) = (piece.from.expect("validated"), piece.to.expect("validated"));
                    let first = anchor_ordinals[from];
                    let last = anchor_ordinals[to];
                    sentence_out.push(TransCue {
                        sentence_id: sentence.id.clone(),
                        text: piece.text.clone(),
                        start: doc.words[sentence.word_indices[first]].t0,
                        end: doc.words[sentence.word_indices[last]].t1,
                        word_span: Some((first, last)),
                        fallback: false,
                    });
                }
            }
            AlignMode::Independent => {
                let anchor_ordinals =
                    ordered_anchor_ordinals(doc, sentence, &entry.words).expect("validated");
                let piece_cps: Vec<usize> = entry
                    .pieces
                    .iter()
                    .map(|piece| target_cps_chars(&piece.text, lang).max(1))
                    .collect();
                if entry.pieces.len() <= anchor_ordinals.len() {
                    let ranges = anchor_pieces_to_words(&piece_cps, anchor_ordinals.len());
                    for (piece, (first, last)) in entry.pieces.iter().zip(ranges) {
                        let first = anchor_ordinals[first];
                        let last = anchor_ordinals[last];
                        sentence_out.push(TransCue {
                            sentence_id: sentence.id.clone(),
                            text: piece.text.clone(),
                            start: doc.words[sentence.word_indices[first]].t0,
                            end: doc.words[sentence.word_indices[last]].t1,
                            word_span: Some((first, last)),
                            fallback: false,
                        });
                    }
                } else {
                    // A very short source text may correspond to a very long translation. When the number of target pieces exceeds the source word count, it is impossible to give each piece a non-empty, contiguous word range. Display time is then allocated within the whole-sentence window by target reading units. This explicitly gives up per-piece bilingual correspondence, but still keeps the translation and the hard limit.
                    let start = doc.words[sentence.word_indices[anchor_ordinals[0]]].t0;
                    let end = doc.words[sentence.word_indices[*anchor_ordinals.last().unwrap()]].t1;
                    let duration = (end - start).max(0.0);
                    let total: usize = piece_cps.iter().sum();
                    let mut elapsed = 0usize;
                    for (index, (piece, weight)) in entry.pieces.iter().zip(piece_cps).enumerate() {
                        let piece_start = start + duration * elapsed as f64 / total as f64;
                        elapsed += weight;
                        let piece_end = if index + 1 == entry.pieces.len() {
                            end
                        } else {
                            start + duration * elapsed as f64 / total as f64
                        };
                        sentence_out.push(TransCue {
                            sentence_id: sentence.id.clone(),
                            text: piece.text.clone(),
                            start: piece_start,
                            end: piece_end,
                            word_span: None,
                            fallback: false,
                        });
                    }
                }
            }
            AlignMode::OneToOne => unreachable!("legacy Cue-anchored entry is never valid"),
        }
        smooth_trans_cue_times(&mut sentence_out, lang);
        out.extend(sentence_out);
    }
    pad_trans_cue_times(&mut out, lang, doc.media.duration);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cue::{CueParams, derive_cues};
    use crate::doc::{BreakOverride, DocEngine, DocMedia, Speaker, TransPiece, Word};
    use crate::sentence::derive_sentences;

    /// The absolute floor of the rewrite-magnitude guardrail (±4 units) must not exceed half of the original sentence. Otherwise sentences under 8 units never trigger, so “4 units” compressed to “1 unit” would also pass. The submit-time lint and provider acceptance would then have zero recall on short sentences. The criterion for long sentences is unchanged word for word.
    #[test]
    fn rewrite_guard_scales_down_for_short_sentences() {
        // Short sentence: the floor is capped at half of the original sentence.
        assert!(reordered_rewrite_exceeds(4, 1));
        assert!(!reordered_rewrite_exceeds(4, 2));
        assert!(reordered_rewrite_exceeds(2, 0));
        // From 8 units onward, the floor returns to ±4, identical word for word to the historical basis.
        assert!(!reordered_rewrite_exceeds(8, 4));
        assert!(reordered_rewrite_exceeds(8, 3));
        assert!(!reordered_rewrite_exceeds(24, 20));
        assert!(reordered_rewrite_exceeds(24, 17));
        // Same-length reordering is always allowed.
        assert!(!reordered_rewrite_exceeds(4, 4));
    }

    /// The contract twin declares "Latin letters and digits count about half". The coefficient is fixed for all CJK target languages (zh/ja/ko), not only Simplified Chinese. ja and ko once counted non-whitespace characters at full price, which contradicted the shared contract text.
    #[test]
    fn cjk_targets_price_latin_at_half() {
        // s-g6.18 benchmark sentence: 33 full-width characters plus 42 Latin characters such as "agentskills.io" and "Open Agent Skills". The half-price basis gives 54 units (54/14 ≈ 4 suggested pieces, consistent with the engine's data-budget output). The full-price basis would inflate it to 75.
        let text = "没错，而且虽然 agentskills.io 上定义了 Open Agent Skills 标准，但在创建 AI Agent Skills 时，这些仍然是我们需要考虑的一些问题。";
        assert_eq!(target_cps_chars(text, "zh"), 54);
        assert_eq!(target_cps_chars("KVキャッシュとPagedAttention", "ja"), 14);
        assert_eq!(target_cps_chars("KVキャッシュとPagedAttention", "zh"), 14);
        // Non-CJK target languages still count non-whitespace characters.
        assert_eq!(target_cps_chars("KV cache rocks", "en"), 12);
    }

    /// Piece-level display width: trailing punctuation of the piece (including colons and closing quotes) is free. In-piece punctuation counts as usual. Previously “he said:” was counted as 3 by the flash-frame threshold, while the contract basis is 2.
    #[test]
    fn piece_display_units_free_trailing_punctuation() {
        assert_eq!(target_cps_chars("他说:", "zh"), 3);
        assert_eq!(piece_display_units("他说:", "zh"), 2);
        assert_eq!(piece_display_units("他说：", "zh"), 2);
        // Ordinary full stops are already free under the delivery projection, so the two bases agree.
        assert_eq!(piece_display_units("他说。", "zh"), 2);
        // In-piece punctuation is a visible burden within the line, so it is not free.
        assert_eq!(piece_display_units("他说：好的", "zh"), 5);
        // A closing quote and sentence punctuation are free together.
        assert_eq!(piece_display_units("他说：好的！」", "zh"), 5);
        // A pure-punctuation piece has width 0 (it is itself a flash fragment).
        assert_eq!(piece_display_units("……", "zh"), 0);
    }

    #[test]
    fn shorts_delivery_narrows_the_budget_to_one_portrait_line() {
        let zh = TransParams::for_shorts("zh-Hans");
        assert_eq!(
            zh,
            TransParams {
                fit: SHORTS_LINE_EM,
                soft: 9,
                hard: 13
            }
        );
        assert_eq!(TransParams::for_shorts("ja"), zh);
        assert_eq!(TransParams::for_shorts("ko"), zh);
        let fr = TransParams::for_shorts("fr");
        assert_eq!(fr.fit, SHORTS_LINE_CHARS);
        // The default hard for non-CJK tiers equals fit, and it stays the same after narrowing.
        assert_eq!(fr.hard, fr.fit);
        // Scripts not listed fall into the non-CJK tier, as in the default table.
        for lang in ["ru", "ar", "hi", "th", "und"] {
            assert_eq!(TransParams::for_shorts(lang), fr, "{lang}");
        }
        // Every tier is narrower than the default: soft ≤ fit ≤ hard. hard and soft keep the same ratio as the default tier, so the seam-penalty calibration is unchanged.
        for lang in ["zh", "fr"] {
            let (base, narrow) = (TransParams::for_lang(lang), TransParams::for_shorts(lang));
            assert!(narrow.fit < base.fit, "{lang}");
            assert!(
                narrow.soft <= narrow.fit && narrow.fit <= narrow.hard,
                "{lang}"
            );
            let ratio = |params: TransParams| params.hard as f64 / params.soft as f64;
            assert!((ratio(narrow) - ratio(base)).abs() < 0.1, "{lang}");
        }

        assert_eq!(TransParams::for_delivery("zh", Some("shorts")), zh);
        assert_eq!(TransParams::for_delivery("zh", Some(" shorts ")), zh);
        assert_eq!(
            TransParams::for_delivery("zh", None),
            TransParams::for_lang("zh")
        );
        assert_eq!(
            TransParams::for_delivery("fr", Some("reels")),
            TransParams::for_lang("fr")
        );
    }

    /// After narrowing, the hard cap is only 13 full-width characters. Long sentences without punctuation must still be splittable, without splitting numbers from their quantifiers or breaking Latin strings apart. The line-breaking prohibition rules for vertical subtitles also hold at this splitting layer.
    #[test]
    fn shorts_budget_splits_a_long_clause_without_breaking_numbers_or_latin() {
        let params = TransParams::for_shorts("zh");
        let text = "这家公司去年一口气融资了10亿美元然后把钱全部投进了OpenAI的芯片研发";
        let pieces = split_independent_for_lang(text, &params, usize::MAX, "zh");
        assert!(pieces.len() >= 3, "{pieces:?}");
        // Delivery splitting inserts spaces between CJK text and digits or Latin (`10 亿`). Strip whitespace when comparing.
        let squeeze = |value: &str| value.split_whitespace().collect::<String>();
        assert_eq!(squeeze(&pieces.concat()), text);
        for piece in &pieces {
            assert!(
                piece_display_units(piece, "zh") <= params.hard,
                "{piece} > {}",
                params.hard
            );
        }
        for pair in pieces.windows(2) {
            let (left, right) = (pair[0].trim_end(), pair[1].trim_start());
            assert!(
                !(left.ends_with("10") && right.starts_with('亿')),
                "{pieces:?}"
            );
            assert!(
                !(left.ends_with("Open") || right.starts_with("AI")),
                "{pieces:?}"
            );
        }
    }

    #[test]
    fn params_defaults_and_fit_override() {
        assert_eq!(
            TransParams::for_lang("zh-CN"),
            TransParams {
                fit: 16,
                soft: 14,
                hard: 20
            }
        );
        assert_eq!(
            TransParams::for_lang("ja"),
            TransParams {
                fit: 16,
                soft: 14,
                hard: 20
            }
        );
        assert_eq!(
            TransParams::for_lang("fr"),
            TransParams {
                fit: 42,
                soft: 30,
                hard: 42
            }
        );
        assert_eq!(
            TransParams::with_fit(16),
            TransParams {
                fit: 16,
                soft: 14,
                hard: 20
            }
        );
        assert_eq!(
            TransParams::with_fit(8),
            TransParams {
                fit: 8,
                soft: 6,
                hard: 8
            }
        );
    }

    #[test]
    fn simplified_chinese_budgets_use_delivery_projection() {
        let phrase = "我是 Claude Code 的创始工程师之一，";
        assert_eq!(count_cps_chars(phrase), 21);
        assert_eq!(target_cps_chars(phrase, "zh"), 15);
        assert_eq!(
            target_delivery_projection(phrase, "zh"),
            "我是 Claude Code 的创始工程师之一"
        );
        // Mixed-script width over 16 full-width cells can wrap into two lines within one target unit. But it does not exceed the 20-char hard limit, so “之一” must not be pushed to the next semantic piece.
        assert!(exceeds_one_line_fit(phrase, "zh", 16));
        assert!(target_cps_chars(phrase, "zh") <= TransParams::for_lang("zh").hard);
        assert_eq!(target_cps_chars("版本 1.2，发布。", "zh"), 6);
        assert_eq!(
            target_delivery_projection(
                "3.14 1,000 U.S. Dr. README.md 报告.pdf。\nNext, line.",
                "zh-CN"
            ),
            "3.14 1,000 U.S. Dr. README.md 报告.pdf\nNext line"
        );
        assert_eq!(
            target_delivery_projection("他说，\"好。\"然后。", "zh"),
            "他说 \"好\" 然后"
        );
        assert_eq!(
            target_delivery_projection("Hello, world.", "en"),
            "Hello world"
        );
        assert_eq!(target_cps_chars("Hello, world.", "en"), 10);
    }

    #[test]
    fn mixed_product_names_use_visual_reading_units() {
        let params = TransParams::for_lang("zh");
        let phrase = "Claude Code、Antigravity，";
        assert!(!exceeds_one_line_fit(phrase, "zh", params.fit));
        assert!(target_cps_chars(phrase, "zh") <= params.hard);
        let pieces = split_independent_for_lang(phrase, &params, 8, "zh");
        assert_eq!(pieces, vec![phrase]);
    }

    #[test]
    fn independent_split_prefers_punctuation_seams() {
        let params = TransParams::for_lang("zh");
        // 22 characters, with a comma after the 10th. It should break at the comma rather than split evenly.
        let text = "你过的就是这种生活，二〇二八年人们会过的生活。";
        let pieces = split_independent(text, &params, 10);
        assert_eq!(pieces.len(), 2);
        assert!(pieces[0].ends_with("，"), "{pieces:?}");
        assert!(count_cps_chars(&pieces[0]) <= params.hard);
        assert!(count_cps_chars(&pieces[1]) <= params.hard);
        // Concatenation invariant.
        assert_eq!(normalize_chars(&pieces.concat()), normalize_chars(text));
    }

    #[test]
    fn independent_split_never_cuts_inside_paired_delimiter() {
        // s-g4.16 regression: the seam between `名为“` and `PluginDataJSON”` had once been judged a cheap inter-word whitespace seam (0.8 tier). The DP therefore preferred to cut after the opening quote, and the canonical text gained a phantom space.
        let trans =
            "最简单来说，一个代理插件就是一个根目录下包含名为“PluginDataJSON”的清单的文件夹。";
        let atoms = atomize(trans);
        // canonical must match the translation character for character. Otherwise the seam offset and the protected-term matching would be globally misaligned, and the phantom space would be persisted along with the piece text.
        assert_eq!(join_atoms(&atoms), trans);

        let params = TransParams::for_lang("zh-Hans");
        let pieces = split_independent_for_lang(trans, &params, 6, "zh-Hans");
        assert_eq!(pieces.concat(), trans);
        for piece in &pieces {
            assert!(
                !piece.ends_with('“'),
                "piece must not end on a dangling open quote: {pieces:?}"
            );
        }
        assert!(
            pieces
                .iter()
                .any(|piece| piece.contains("“PluginDataJSON”")),
            "quoted span must stay whole: {pieces:?}"
        );

        // The other side of the same root cause: when the seam does not fall on a delimiter, the phantom space stays in the piece text and is persisted. (`validate_target_texts` compares with normalize_chars, which cannot see whitespace.)
        let inline = "这是一个叫《PluginDataJSON》的清单文件。";
        let pieces = split_independent_for_lang(inline, &params, 4, "zh-Hans");
        assert_eq!(pieces.concat(), inline);
    }

    /// P0-a regression: line width is a hard constraint, not a soft preference inside a quadratic term.
    ///
    /// In the R3 quality audit, some of the 30 over-fit pieces had "a free seam but were not cut". The "stay near soft" square term of `piece_cost` made a 19u piece (0.178) clearly cheaper than cutting it into two (≥1.089, plus seam cost), so the DP deliberately chose the wide piece. The over-fit penalty must outweigh anything a single cut could give back (seam tier ≤0.8 plus length difference ≤0.19). Otherwise, moving the cut would wash the penalty away.
    #[test]
    fn over_fit_piece_is_cut_when_a_free_seam_exists() {
        let params = TransParams::for_lang("zh");
        assert!(OVER_FIT_PENALTY < NO_SEAM_PENALTY);
        assert!(NO_SEAM_PENALTY < BLOCKING_SEAM_PENALTY);
        // One cut can give back at most: the over-fit penalty, plus the most expensive real seam tier, plus the length-square difference.
        assert!(OVER_FIT_PENALTY + 0.8 + 1.0 < NO_SEAM_PENALTY + BLOCKING_SEAM_PENALTY);

        for (trans, expected) in [
            (
                "这样一来，你的显存分配看起来就更像这样。",
                vec!["这样一来，", "你的显存分配看起来就更像这样。"],
            ),
            (
                "通过 --speculative-model 启用推测解码模型。",
                vec!["通过 --speculative-model", "启用推测解码模型。"],
            ),
            (
                "你的 GPU 在显存读取之间会有空闲算力——",
                vec!["你的 GPU", "在显存读取之间会有空闲算力——"],
            ),
        ] {
            assert!(exceeds_one_line_fit(trans, "zh", params.fit), "{trans}");
            assert_eq!(
                split_independent_for_lang(trans, &params, 6, "zh"),
                expected
            );
        }
    }

    /// The other half of P0-a: over-fit pieces without a free seam stay whole. A forced cut would only swap the over-width line for a dangling tail (the dangling ⇄ over-width seesaw). Such pieces fall into the translation-unsplittable channel and are solved by rewriting the translation, not by display splitting.
    #[test]
    fn over_fit_piece_without_a_free_seam_stays_whole() {
        let params = TransParams::for_lang("zh");
        for trans in [
            "这样它们就不用重新计算你已经知道的东西。",
            "一个面向延迟敏感型工作负载的额外功能：",
            "从你现有的 GPU 中获得大幅提升的吞吐量。",
            // "担心|AI" looks like an inter-word space seam after concatenation, but the original has no whitespace there, so it is not a seam.
            "我发现很多人担心AI会抢走自己的工作。",
        ] {
            assert!(exceeds_one_line_fit(trans, "zh", params.fit), "{trans}");
            let pieces = split_independent_for_lang(trans, &params, 6, "zh");
            assert_eq!(
                pieces.len(),
                1,
                "no free seam — the piece must stay whole: {pieces:?}"
            );
            assert_eq!(normalize_chars(&pieces.concat()), normalize_chars(trans));
        }
    }

    #[test]
    fn independent_split_never_cuts_inside_protected_target_term() {
        let params = TransParams {
            fit: 8,
            soft: 6,
            hard: 10,
        };
        let term = "Claude Code".to_owned();
        let pieces = split_independent_for_lang_protected(
            "现在使用 Claude Code 构建稳定的字幕工作流。",
            &params,
            8,
            "zh-Hans",
            &[term.clone()],
        );
        assert!(pieces.iter().any(|piece| piece.contains(&term)));
        assert!(
            !pieces
                .iter()
                .any(|piece| piece == "Claude" || piece == "Code")
        );
    }

    #[test]
    fn independent_split_short_text_stays_whole_and_respects_max_pieces() {
        let params = TransParams::for_lang("zh");
        assert_eq!(split_independent("十六字以内整句。", &params, 10).len(), 1);
        let long = "这一句没有任何标点但是长度远远超过了单行容量需要拆开展示";
        let pieces = split_independent(long, &params, 2);
        assert_eq!(pieces.len(), 2);
        let unlimited = split_independent(long, &params, 10);
        assert!(unlimited.iter().all(|p| count_cps_chars(p) <= params.hard));
    }

    #[test]
    fn independent_split_latin_cuts_at_word_gaps() {
        let params = TransParams::for_lang("en");
        let text = "You have to sweat the tokens as much as you sweat the pixels, \
                    and this sentence is clearly longer than one line.";
        let pieces = split_independent(text, &params, 20);
        assert!(pieces.len() >= 2);
        for piece in &pieces {
            assert!(count_cps_chars(piece) <= params.hard, "{piece}");
            assert!(!piece.starts_with(' ') && !piece.ends_with(' '));
        }
        assert_eq!(normalize_chars(&pieces.join(" ")), normalize_chars(text));
    }

    #[test]
    fn proportional_split_snaps_to_atom_boundaries() {
        // Equal-weight split of 20 Chinese characters → the ideal cut is at 10. The nearest word boundary is after the punctuation.
        let text = "你得像打磨像素一样，打磨每一个词元。";
        let pieces = split_proportional(text, &[10, 10], 3);
        assert_eq!(pieces.len(), 2);
        assert_eq!(normalize_chars(&pieces.concat()), normalize_chars(text));
        // Latin: the cut point snaps to whitespace, so no word is split.
        let latin = split_proportional("alpha bravo charlie delta", &[12, 12], 3);
        assert_eq!(latin.len(), 2);
        assert!(latin.iter().all(|p| !p.is_empty()));
        assert!(!latin[0].ends_with("char"), "{latin:?}");
    }

    #[test]
    fn proportional_split_tiny_translation_yields_empty_tail() {
        let pieces = split_proportional("短。", &[10, 10, 10], 2);
        assert_eq!(pieces.len(), 3);
        assert!(pieces.iter().any(|p| p.is_empty()));
    }

    #[test]
    fn anchor_assigns_each_piece_at_least_one_word() {
        assert_eq!(anchor_pieces_to_words(&[10, 10], 4), vec![(0, 1), (2, 3)]);
        assert_eq!(anchor_pieces_to_words(&[1, 30], 4), vec![(0, 0), (1, 3)]);
        assert_eq!(anchor_pieces_to_words(&[30, 1], 4), vec![(0, 2), (3, 3)]);
        assert_eq!(anchor_pieces_to_words(&[5], 3), vec![(0, 2)]);
        // Piece count = word count: one word per piece.
        assert_eq!(
            anchor_pieces_to_words(&[8, 8, 8], 3),
            vec![(0, 0), (1, 1), (2, 2)]
        );
    }

    fn doc_two_cue_sentence() -> TranscriptDoc {
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
        let mk = |id: &str, t0: f64, t1: f64, text: &str| Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        };
        doc.words = vec![
            mk("g1.0", 0.0, 0.4, "alpha"),
            mk("g1.1", 0.4, 0.8, "bravo"),
            mk("g1.2", 0.8, 1.2, "charlie"),
            mk("g1.3", 1.2, 1.6, "delta"),
            mk("g1.4", 1.6, 2.0, "echo,"),
            mk("g1.5", 2.0, 2.4, "foxtrot"),
            mk("g1.6", 2.4, 2.8, "golf"),
            mk("g1.7", 2.8, 3.2, "hotel."),
        ];
        doc
    }

    #[test]
    fn trans_cues_expand_anchored_pieces_and_fall_back_whole_sentence() {
        let mut doc = doc_two_cue_sentence();
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 1);

        // Untranslated: empty stream.
        assert!(derive_trans_cues(&doc, &sentences, "zh").is_empty());

        // Over-fit translation with no alignment: degrade to whole-sentence on-screen.
        doc.trans.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            "第一段译文需要自然对应，第二段译文负责完整收尾。".to_owned(),
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 1);
        assert!(stream[0].fallback);
        assert_eq!(stream[0].start, 0.0);
        assert_eq!(stream[0].end, 3.2);

        // Old Cue-anchored entries are no longer valid. Translation Cues cannot inherit source Cue boundaries.
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            TransAlign {
                mode: AlignMode::ManyToOne,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                cues: vec!["q-g1.0".to_owned(), "q-g1.5".to_owned()],
                words: Vec::new(),
                pieces: vec![
                    TransPiece {
                        from: Some(0),
                        to: Some(0),
                        text: "第一段译文需要自然对应，".to_owned(),
                    },
                    TransPiece {
                        from: Some(1),
                        to: Some(1),
                        text: "第二段译文负责完整收尾。".to_owned(),
                    },
                ],
            },
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 1);
        assert!(stream[0].fallback);

        // New manyToOne: word anchors may fall inside an old Cue. Display boundaries smooth around the word anchors where feasible, but word_span still keeps the exact semantic mapping.
        doc.trans_align.get_mut("zh").unwrap().insert(
            "s-g1.0".to_owned(),
            TransAlign {
                mode: AlignMode::ManyToOne,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                // Even if the old cues snapshot is wrong, word-anchored entries are unaffected. Validation does not read it at all.
                cues: vec!["q-obsolete".to_owned()],
                words: doc.words.iter().map(|word| word.id.clone()).collect(),
                pieces: vec![
                    TransPiece {
                        from: Some(0),
                        to: Some(3),
                        text: "第一段译文需要自然对应，".to_owned(),
                    },
                    TransPiece {
                        from: Some(4),
                        to: Some(7),
                        text: "第二段译文负责完整收尾。".to_owned(),
                    },
                ],
            },
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream[0].word_span, Some((0, 3)));
        assert_eq!(stream[0].end, 1.6);
        assert_eq!(stream[1].start, 1.6);

        // Concatenation invariant broken (sentence-level rewrite) ⇒ entry invalid ⇒ falls back to whole-sentence on-screen.
        doc.trans.get_mut("zh").unwrap().insert(
            "s-g1.0".to_owned(),
            "完全重写过的译文已经超过单行容量而且旧切法不再有效。".to_owned(),
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 1);
        assert!(stream[0].fallback);
    }

    #[test]
    fn trans_cues_independent_anchor_to_word_edges() {
        let mut doc = doc_two_cue_sentence();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), "前半句译文，后半句译文。".to_owned());
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            "s-g1.0".to_owned(),
            TransAlign {
                mode: AlignMode::Independent,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                cues: vec!["q-g1.0".to_owned(), "q-g1.5".to_owned()],
                words: Vec::new(),
                pieces: vec![
                    TransPiece {
                        from: None,
                        to: None,
                        text: "前半句译文，".to_owned(),
                    },
                    TransPiece {
                        from: None,
                        to: None,
                        text: "后半句译文。".to_owned(),
                    },
                ],
            },
        );
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 2);
        // The boundary falls at the edge of a source word: the end word t1 of piece 1 equals the edge before the first word t0 of piece 2.
        assert_eq!(stream[0].start, 0.0);
        assert!(stream[0].end > 0.0 && stream[0].end < 3.2);
        assert_eq!(stream[1].end, 3.2);
        let boundary_ok = doc
            .words
            .iter()
            .any(|w| (w.t1 - stream[0].end).abs() < 1e-9);
        assert!(boundary_ok, "the boundary must be the t1 of some source word");
    }

    #[test]
    fn source_cue_reflow_does_not_change_translation_cues() {
        let mut doc = doc_two_cue_sentence();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let sentence = &sentences[0];
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentence.id.clone(), "前半句译文，后半句译文。".to_owned());
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            sentence.id.clone(),
            TransAlign {
                mode: AlignMode::ManyToOne,
                crossing: false,
                correspondence: None,
                text_basis: Default::default(),
                aligner: None,
                blocks: Vec::new(),
                cues: Vec::new(),
                words: sentence
                    .word_indices
                    .iter()
                    .map(|&index| doc.words[index].id.clone())
                    .collect(),
                pieces: vec![
                    TransPiece {
                        from: Some(0),
                        to: Some(3),
                        text: "前半句译文，".to_owned(),
                    },
                    TransPiece {
                        from: Some(4),
                        to: Some(7),
                        text: "后半句译文。".to_owned(),
                    },
                ],
            },
        );
        let before = derive_trans_cues(&doc, &sentences, "zh");

        // Only the display line-break override of the source text changes. The Sentence word sequence and its timing do not change.
        doc.breaks.insert("g1.4".to_owned(), BreakOverride::Nobreak);
        let reflowed_cues = derive_cues(&doc, &CueParams::default());
        assert_ne!(
            reflowed_cues.iter().map(|cue| &cue.id).collect::<Vec<_>>(),
            cues.iter().map(|cue| &cue.id).collect::<Vec<_>>()
        );
        let reflowed_sentences = derive_sentences(&doc, &reflowed_cues);
        let after = derive_trans_cues(&doc, &reflowed_sentences, "zh");
        assert_eq!(after, before);
    }

    #[test]
    fn trans_cues_pad_short_final_sentence_into_media_tail() {
        let mut doc = doc_two_cue_sentence();
        doc.words.push(Word {
            id: "g2.0".to_owned(),
            t0: 4.0,
            t1: 4.4,
            text: "Done.".to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        });
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        doc.trans.entry("zh".to_owned()).or_default().extend([
            ("s-g1.0".to_owned(), "第一句。".to_owned()),
            ("s-g2.0".to_owned(), "谢谢。".to_owned()),
        ]);

        let stream = derive_trans_cues(&doc, &sentences, "zh");
        let final_cue = stream.last().expect("translated final sentence");
        assert_eq!(final_cue.start, 4.0);
        assert!((final_cue.end - 5.0).abs() < 1e-9);
        assert!(
            final_cue.end - final_cue.start + 1e-9
                >= target_required_seconds(&final_cue.text, "zh")
        );
    }

    #[test]
    fn smoothing_tolerates_one_ulp_boundary_inversion() {
        let mut cues = vec![
            TransCue {
                sentence_id: "s1".to_owned(),
                text: "字".repeat(42),
                start: 2106.88,
                end: 2110.0,
                word_span: Some((0, 0)),
                fallback: false,
            },
            TransCue {
                sentence_id: "s1".to_owned(),
                text: "字".repeat(30),
                start: 2110.0,
                end: 2114.88,
                word_span: Some((1, 1)),
                fallback: false,
            },
        ];

        smooth_trans_cue_times(&mut cues, "zh");

        assert_eq!(cues[0].end, cues[1].start);
        assert!((cues[0].start - 2106.88).abs() < 1e-9);
        assert!((cues[1].end - 2114.88).abs() < 1e-9);
        assert!(cues[0].end - cues[0].start + 1e-9 >= target_required_seconds(&cues[0].text, "zh"));
        assert!(cues[1].end - cues[1].start + 1e-9 >= target_required_seconds(&cues[1].text, "zh"));
    }

    #[test]
    fn smoothing_shares_shortfall_proportionally_when_sentence_is_too_dense() {
        // When the whole-sentence window cannot fit all reading needs, word-edge times are no longer kept. That would let a line paired with a short source piece flash by alone. Instead, distribute proportionally to needs: a 4-character piece versus a 36-character piece need 1s versus 4s, so a 2.5s window should be allocated 0.5s and 2.0s.
        let mut cues = vec![
            TransCue {
                sentence_id: "s1".to_owned(),
                text: "字".repeat(4),
                start: 10.0,
                end: 10.2,
                word_span: Some((0, 0)),
                fallback: false,
            },
            TransCue {
                sentence_id: "s1".to_owned(),
                text: "字".repeat(36),
                start: 10.2,
                end: 12.5,
                word_span: Some((1, 1)),
                fallback: false,
            },
        ];

        smooth_trans_cue_times(&mut cues, "zh");

        assert_eq!(cues[0].end, cues[1].start);
        assert!((cues[0].start - 10.0).abs() < 1e-9);
        assert!((cues[1].end - 12.5).abs() < 1e-9);
        assert!(
            (cues[0].end - cues[0].start - 0.5).abs() < 1e-6,
            "first piece got {:.3}s",
            cues[0].end - cues[0].start
        );
        assert!(
            (cues[1].end - cues[1].start - 2.0).abs() < 1e-6,
            "second piece got {:.3}s",
            cues[1].end - cues[1].start
        );
    }

    #[test]
    fn align_entry_valid_enforces_coverage_and_concat() {
        let doc = doc_two_cue_sentence();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let sentence = &sentences[0];
        let entry = |pieces: Vec<TransPiece>, mode: AlignMode| TransAlign {
            mode,
            crossing: false,
            correspondence: None,
            text_basis: Default::default(),
            aligner: None,
            blocks: Vec::new(),
            cues: vec!["q-obsolete".to_owned()],
            words: if mode == AlignMode::ManyToOne {
                doc.words.iter().map(|word| word.id.clone()).collect()
            } else {
                Vec::new()
            },
            pieces,
        };
        let p = |from: usize, to: usize, text: &str| TransPiece {
            from: Some(from),
            to: Some(to),
            text: text.to_owned(),
        };
        let translation = "甲乙丙。";
        // Legal: contiguous full coverage plus equal concatenation.
        assert!(align_entry_valid(
            &doc,
            sentence,
            translation,
            &entry(vec![p(0, 3, "甲乙"), p(4, 7, "丙。")], AlignMode::ManyToOne)
        ));
        // Ranges not contiguous, coverage incomplete, or concatenation unequal → invalid.
        assert!(!align_entry_valid(
            &doc,
            sentence,
            translation,
            &entry(vec![p(0, 3, "甲乙"), p(3, 7, "丙。")], AlignMode::ManyToOne)
        ));
        assert!(!align_entry_valid(
            &doc,
            sentence,
            translation,
            &entry(vec![p(0, 6, "甲乙丙。")], AlignMode::ManyToOne)
        ));
        assert!(!align_entry_valid(
            &doc,
            sentence,
            translation,
            &entry(vec![p(0, 3, "改"), p(4, 7, "丙。")], AlignMode::ManyToOne)
        ));
        // The old Cue snapshot is ignored entirely. Old oneToOne Cue-anchored entries are always invalid.
        let stale_cues = entry(vec![p(0, 7, "甲乙丙。")], AlignMode::ManyToOne);
        assert!(align_entry_valid(&doc, sentence, translation, &stale_cues));
        let legacy = entry(vec![p(0, 1, "甲乙丙。")], AlignMode::OneToOne);
        assert!(!align_entry_valid(&doc, sentence, translation, &legacy));
    }

    /// 0.4 block layer: I3/I4 go into `align_entry_valid`. An explicit whole-sentence correspondence allows only one piece. independent contains no block. Legacy multi-piece `crossing` entries are still projected per piece (design §5, "keep pieces timing"). Explicit `sentence` entries are shown as a single whole-sentence cue.
    #[test]
    fn align_entry_valid_enforces_block_layer_and_sentence_shape() {
        use crate::doc::{AlignBlock, Correspondence};
        let mut doc = doc_two_cue_sentence();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        let sentence = &sentences[0];
        let words: Vec<String> = doc.words.iter().map(|word| word.id.clone()).collect();
        let p = |from: usize, to: usize, text: &str| TransPiece {
            from: Some(from),
            to: Some(to),
            text: text.to_owned(),
        };
        let block = |src: (usize, usize), tgt: (usize, usize)| AlignBlock {
            src,
            tgt,
            confidence: Some(0.9),
            flags: Vec::new(),
        };
        let translation = "甲乙，丙丁。";
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            words.clone(),
            vec![p(0, 3, "甲乙，"), p(4, 7, "丙丁。")],
        );
        entry.correspondence = Some(Correspondence::Block);
        entry.blocks = vec![
            block((0, 1), (0, 2)),
            block((2, 3), (2, 3)),
            block((4, 7), (3, 6)),
        ];
        assert!(align_entry_valid(&doc, sentence, translation, &entry));
        // (h) A piece cut inside a block: the source-side from is not at the block start.
        let mut inside = entry.clone();
        inside.pieces = vec![p(0, 2, "甲乙，"), p(3, 7, "丙丁。")];
        assert!(!align_entry_valid(&doc, sentence, translation, &inside));
        // Target side: the piece text cut point is not on a block boundary.
        let mut inside = entry.clone();
        inside.pieces = vec![p(0, 3, "甲乙"), p(4, 7, "，丙丁。")];
        assert!(!align_entry_valid(&doc, sentence, translation, &inside));
        // Block coverage incomplete, or it does not match the total piece length.
        let mut short = entry.clone();
        short.blocks.pop();
        assert!(!align_entry_valid(&doc, sentence, translation, &short));
        // Explicit whole-sentence correspondence: exactly one piece and exactly one block.
        let mut sentence_level = TransAlign::new(
            AlignMode::ManyToOne,
            words.clone(),
            vec![p(0, 7, "甲乙，丙丁。")],
        );
        sentence_level.correspondence = Some(Correspondence::Sentence);
        sentence_level.blocks = vec![block((0, 7), (0, 6))];
        assert!(align_entry_valid(
            &doc,
            sentence,
            translation,
            &sentence_level
        ));
        let mut two_pieces = sentence_level.clone();
        two_pieces.pieces = vec![p(0, 3, "甲乙，"), p(4, 7, "丙丁。")];
        two_pieces.blocks.clear();
        assert!(!align_entry_valid(&doc, sentence, translation, &two_pieces));
        // independent must not carry a block layer or claim block-level correspondence.
        let mut independent = TransAlign::new(
            AlignMode::Independent,
            Vec::new(),
            vec![
                TransPiece {
                    from: None,
                    to: None,
                    text: "甲乙，".to_owned(),
                },
                TransPiece {
                    from: None,
                    to: None,
                    text: "丙丁。".to_owned(),
                },
            ],
        );
        assert!(align_entry_valid(&doc, sentence, translation, &independent));
        independent.blocks = vec![block((0, 7), (0, 6))];
        assert!(!align_entry_valid(
            &doc,
            sentence,
            translation,
            &independent
        ));
        independent.blocks.clear();
        independent.correspondence = Some(Correspondence::Block);
        assert!(!align_entry_valid(
            &doc,
            sentence,
            translation,
            &independent
        ));

        // Projection: explicit sentence ⇒ a single cue for the whole sentence. Legacy crossing with multiple pieces ⇒ still per piece.
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentence.id.clone(), translation.to_owned());
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert(sentence.id.clone(), sentence_level);
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 1);
        assert_eq!(stream[0].text, translation);
        assert_eq!(stream[0].word_span, Some((0, 7)));
        assert!(!stream[0].fallback);
        let mut crossing = TransAlign::new(
            AlignMode::ManyToOne,
            words,
            vec![p(0, 3, "甲乙，"), p(4, 7, "丙丁。")],
        );
        crossing.crossing = true;
        assert_eq!(crossing.correspondence(), Correspondence::Sentence);
        doc.trans_align
            .get_mut("zh")
            .unwrap()
            .insert(sentence.id.clone(), crossing);
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        assert_eq!(stream.len(), 2);
        assert_eq!(stream[0].word_span, Some((0, 3)));
    }

    /// The DP side of E2: `blocking_seam` records CJK intra-word boundaries as objective defects. The p850 live case s-g79.0, "同时还可 ‖ 以将…", was not caused by a fallback hard cut. The DP cut into the word on purpose, to avoid the weak-tail penalty of "…将". Without the intra-word term, this test case reproduces the defect.
    #[test]
    fn dp_does_not_cut_inside_a_cjk_word_when_a_real_boundary_exists() {
        let params = TransParams::for_lang("zh");
        let tail = "同时还可以将 max_num_batched_tokens 设置为大于 2048。";
        for max_pieces in 2..=4 {
            let pieces = split_independent_for_lang(tail, &params, max_pieces, "zh");
            assert_eq!(
                pieces,
                vec![
                    "同时还可以将 max_num_batched_tokens".to_owned(),
                    "设置为大于 2048。".to_owned()
                ],
                "max_pieces={max_pieces}"
            );
        }
        // For the whole sentence as well: the comma seam is kept, and "可以" is not split.
        let full = "生产部署已观察到 50% 的吞吐量提升，同时还可以将 max_num_batched_tokens 设置为大于 2048。";
        let pieces = split_independent_for_lang(full, &params, 4, "zh");
        assert!(pieces[0].ends_with("提升，"), "{pieces:?}");
        for pair in pieces.windows(2) {
            assert!(
                !crate::seam::cjk_midword_boundary(pair[0].trim_end(), pair[1].trim_start()),
                "cut inside a CJK word: {pair:?}"
            );
        }
    }
}
