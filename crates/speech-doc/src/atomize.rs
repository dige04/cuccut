//! Text atomization and character metrics (cross-checked character by character against voice-ink `SubText` / `SubAlign`).
//!
//! - [`atomize`]: Han characters and kana are split one per atom; other scripts (Latin, Hangul, ...) are split on whitespace. Punctuation attaches to the preceding atom, and the cohesion guard keeps `3.14` / `U.S.` / `don't` / `state-of-the-art` as single atoms. It is lossless: every non-whitespace character falls into exactly one atom.
//! - “中日韩” is two different questions here, each with its own predicate, and they must not be mixed:
//!   - **Whether it takes two cells and counts as one reading unit** (width, CPS, page budget): Han, kana and Hangul all count. See [`is_cjk_char`] / [`is_cjk_adjacent`] / [`is_cjk_text`].
//!   - **Whether a space is written between words** (character-by-character word splitting, concatenation without spaces, where any two characters may break): only Han and kana. See [`is_unspaced_cjk_char`] / [`is_unspaced_cjk_adjacent`]. Hangul is split on spaces and takes the Latin path.
//! - The two metrics are strictly separated: line width uses [`visual_width`] (CJK counts 2), and CPS uses [`count_cps_chars`] (non-whitespace counts 1).
//!
//! Known deviation from Swift: Swift iterates by grapheme cluster, while here it iterates by Unicode scalar, so counts differ in extreme cases with combining marks. Word splitting is not affected: combining marks and zero-width joiners follow the character they attach to ([`is_combining`]) and are not split off as punctuation.

use unicode_general_category::{GeneralCategory, get_general_category};

/// CJK word characters in the wide-character sense (three ranges): Han characters, kana, and Hangul syllables. This answers "takes two cells, and one character is one reading unit". It does **not** answer "is a space written between words"; for that question use [`is_unspaced_cjk_char`].
pub fn is_cjk_char(ch: char) -> bool {
    is_unspaced_cjk_char(ch) || is_hangul_syllable(ch)
}

/// Characters that take no space between words, where one character is one atom: Han characters and kana. Hangul is not included (Hangul is split on spaces). Thai and similar scripts also write without spaces, but they have no per-character word boundaries, so the whole run between whitespace is one atom; they are not included either.
pub fn is_unspaced_cjk_char(ch: char) -> bool {
    matches!(ch as u32, 0x4E00..=0x9FFF | 0x3040..=0x30FF)
}

/// Hangul syllables (U+AC00..U+D7AF).
pub fn is_hangul_syllable(ch: char) -> bool {
    matches!(ch as u32, 0xAC00..=0xD7AF)
}

/// A string counts as CJK if any of its scalars is CJK (matches `SubText.isCJK(String)`; treating mixed text on the CJK path is deliberate).
pub fn is_cjk_text(text: &str) -> bool {
    text.chars().any(is_cjk_char)
}

/// Normalization of punctuation for Chinese/Japanese context: ASCII `,` `:` `;` are replaced with full-width `，` `：` `；` when either directly adjacent character is a Han character or kana. They are left unchanged when neither side is (`3,000`, `10:30`, URLs, pure English sentences, Hangul; Hangul uses half-width punctuation). `.` is deliberately not mapped, because file names and abbreviations such as `配置好.env` and `详见 README.md` cannot be disambiguated from the adjacent characters. Idempotent: full-width characters are outside the mapping domain.
///
/// Purpose: when half-width punctuation mixes into LLM-generated brief summaries or style guides, it spreads through the system prompt echo into the whole downstream translation. The file-v1 benchmark's zh-Hans translations had 14 half-width commas/colons, while the json-v0 baseline had 0. One deterministic cleanup at acceptance or conversion breaks this chain, with no worker retry cost.
pub fn normalize_cjk_ascii_punctuation(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    for (index, &ch) in chars.iter().enumerate() {
        let mapped = match ch {
            ',' => '，',
            ':' => '：',
            ';' => '；',
            _ => {
                out.push(ch);
                continue;
            }
        };
        let prev_cjk = index > 0 && is_unspaced_cjk_char(chars[index - 1]);
        let next_cjk = chars
            .get(index + 1)
            .copied()
            .is_some_and(is_unspaced_cjk_char);
        out.push(if prev_cjk || next_cjk { mapped } else { ch });
    }
    out
}

/// A letter or digit of a script that puts spaces between words. Han, kana
/// and the scripts that run words together (Thai, Lao, Myanmar, Khmer,
/// Tibetan) are excluded; anything not listed counts as spaced, Hangul
/// included.
pub fn spaced_script_letter(ch: char) -> bool {
    ch.is_alphanumeric()
        && !is_unspaced_cjk_adjacent(ch)
        && !matches!(
            ch as u32,
            0x0E00..=0x0EFF | 0x0F00..=0x0FFF | 0x1000..=0x109F | 0x1780..=0x17FF
        )
}

/// “Wide characters” in the width sense (counted as 2 cells): CJK word characters (including Hangul), plus CJK punctuation and the full-width block, plus Chinese quotes and dashes. Whether a space is needed at concatenation is not decided by this; see [`is_unspaced_cjk_adjacent`].
pub fn is_cjk_adjacent(ch: char) -> bool {
    is_cjk_char(ch) || is_wide_mark(ch)
}

/// “Characters that take no space” in the concatenation sense: Han characters and kana, plus CJK punctuation and the full-width block, plus Chinese quotes and dashes. When both sides are such characters, no space is added between words ([`sep_len`] rule 1).
pub fn is_unspaced_cjk_adjacent(ch: char) -> bool {
    is_unspaced_cjk_char(ch) || is_wide_mark(ch)
}

fn is_wide_mark(ch: char) -> bool {
    matches!(ch as u32,
        0x3000..=0x303F | 0xFF00..=0xFFEF | 0x2014 | 0x2018..=0x201D | 0x2026)
}

/// Full-width punctuation and symbols: punctuation in the CJK punctuation block (U+3000..U+303F: 、。「」『』《》〈〉【】〔〕) and punctuation/symbols in the full-width block (U+FF00..U+FFEF: ，。！？：；（）). These glyphs **carry their own visual whitespace**, so no space should be added on either side when one side matches. The conjunction with [`is_punctuation_or_symbol`] exists to exclude full-width letters and digits (Ａ、１); those still take space as ordinary words.
fn is_fullwidth_punctuation(ch: char) -> bool {
    matches!(ch as u32, 0x3000..=0x303F | 0xFF00..=0xFFEF) && is_punctuation_or_symbol(ch)
}

/// Shared typographic marks used in both Chinese and English: U+2014 —, U+2018..U+201D ‘’‚‛“”, U+2026 …. In Latin typesetting they **normally take part in spacing** (`said “Hello`, `students’ books`, `so… yeah`), and their glyphs carry no whitespace of their own, so the single-side rule for full-width punctuation cannot apply to them.
fn is_shared_typographic_mark(ch: char) -> bool {
    matches!(ch as u32, 0x2014 | 0x2018..=0x201D | 0x2026)
}

/// Opening delimiters (Unicode Ps/Pi).
fn is_opening_delimiter(ch: char) -> bool {
    matches!(
        get_general_category(ch),
        GeneralCategory::OpenPunctuation | GeneralCategory::InitialPunctuation
    )
}

/// Closing delimiters (Unicode Pe/Pf).
fn is_closing_delimiter(ch: char) -> bool {
    matches!(
        get_general_category(ch),
        GeneralCategory::ClosePunctuation | GeneralCategory::FinalPunctuation
    )
}

pub(crate) fn is_punctuation_or_symbol(ch: char) -> bool {
    matches!(
        get_general_category(ch),
        GeneralCategory::ConnectorPunctuation
            | GeneralCategory::DashPunctuation
            | GeneralCategory::OpenPunctuation
            | GeneralCategory::ClosePunctuation
            | GeneralCategory::InitialPunctuation
            | GeneralCategory::FinalPunctuation
            | GeneralCategory::OtherPunctuation
            | GeneralCategory::MathSymbol
            | GeneralCategory::CurrencySymbol
            | GeneralCategory::ModifierSymbol
            | GeneralCategory::OtherSymbol
    )
}

const COHESIVE_MARKS: &[char] = &['.', ',', '\'', '’', '-', '–', ':', '/', '@', '&', '+'];

/// Which characters are one atom per character.
type PerChar = fn(char) -> bool;

fn is_word_char(ch: char, per_char: PerChar) -> bool {
    if per_char(ch) {
        return false;
    }
    ch.is_alphabetic() || ch.is_numeric() || ch == '_'
}

/// Combining marks (Unicode Mn / Mc / Me) and zero-width joiners (ZWNJ / ZWJ): in writing they belong to the character before them, and they are not punctuation. Thai tone marks (U+0E48..U+0E4B), the Devanagari virama and nukta, and decomposed Latin accents are all Mn rather than letters. Treating them as punctuation would end a word in the middle (`พื้นที่` would split into `พื้` + `นที่`, and `क्या` into `क्` + `या`). Re-joining them with inter-word spaces would then add spaces and change the original text.
pub(crate) fn is_combining(ch: char) -> bool {
    matches!(ch, '\u{200C}' | '\u{200D}')
        || matches!(
            get_general_category(ch),
            GeneralCategory::NonspacingMark
                | GeneralCategory::SpacingMark
                | GeneralCategory::EnclosingMark
        )
}

/// Lossless atomization: Han characters and kana character by character, other text by word (a run between whitespace). Here Hangul is split on spaces, one 어절 (eojeol) per atom.
///
/// This is the convention for **forming words**: building the draft, re-binding edited text back into words, and finding cut points in translations. Where model text is compared with draft words (as the LCS key), or where text is measured by page, use [`atomize_syllables`].
pub fn atomize(text: &str) -> Vec<String> {
    atomize_with(text, is_unspaced_cjk_char)
}

/// Atomization that also splits Hangul syllable by syllable (the convention for drafts before 0.5).
///
/// Used in two kinds of places:
///
/// - **Comparison and measurement**: as the LCS key between model text and draft words, as the word-sequence signature, and in [`word_count`]. A finer key is more stable: when the model changes one particle or adds one space, the whole 어절 should not stop matching. Budgets counted by syllable keep the content of a Hangul page the same as before.
/// - **Rewriting old drafts**: Hangul drafts built before 0.5 have one word per syllable (read in with a glue marker, so they display as before). When such a span is rewritten, the new words must follow the same granularity; see [`atomize_like`].
pub fn atomize_syllables(text: &str) -> Vec<String> {
    atomize_with(text, is_cjk_char)
}

/// Whether the span contains words that are split on word boundaries in scripts such as Thai ([`is_script_glued`]). If it does, comparing model text against these draft words for LCS must use the finer convention of [`comparison_atoms`].
pub fn needs_fine_comparison<W: JoinWord>(words: &[W]) -> bool {
    words.iter().any(is_script_glued)
}

/// Atoms of model text for LCS comparison against draft words (the caller passes the key further through [`atom_key`]).
///
/// When `fine` is false, these are identical atom by atom to [`atomize_syllables`]. When it is true (the span contains words split on word boundaries in scripts such as Thai; see [`needs_fine_comparison`]), each atom is further split into grapheme clusters. On the draft side each is one word, but model text split by whitespace alone only gets phrases, and mismatched granularity on the two sides would not match. Splitting model text with a word-segmentation model does not help either: it depends on context, so if the model changes one space it would change the split. Only when both sides are split into grapheme clusters is the comparison symmetric. Every atom is split (not only those containing Thai); otherwise a segment such as `14:30` embedded in Thai would be whole on one side and fragmented on the other.
///
/// Grapheme clusters here are **only a comparison key**. The caller maps matches back to draft word indices, and sentence cuts and segment boundaries still fall only on draft word boundaries.
pub fn comparison_atoms(text: &str, fine: bool) -> Vec<String> {
    let atoms = atomize_syllables(text);
    if !fine {
        return atoms;
    }
    atoms
        .iter()
        .flat_map(|atom| {
            crate::word_breaks::graphemes(atom)
                .into_iter()
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .collect()
}

/// Atomizes `text` at the granularity of the existing `words`:
///
/// - if the span has a glue-marked word from before 0.5 that is Hangul split by syllable ([`is_legacy_glued`]), split by syllable;
/// - if the span has glue-marked words from text in unspaced scripts ([`is_script_glued`], new drafts built word by word in Thai and similar scripts), use the split of [`atomize_words`], taking only the text;
/// - otherwise use [`atomize`].
///
/// It returns only text. Re-joining text from it would add spaces between Thai words, so where words are formed, use [`atomize_words_like`] to carry the markers.
pub fn atomize_like<W: JoinWord>(words: &[W], text: &str) -> Vec<String> {
    match span_granularity(words) {
        Granularity::LegacySyllables => atomize_syllables(text),
        Granularity::ScriptWords => atomize_words_anchored(words, text)
            .into_iter()
            .map(|(atom, _)| atom)
            .collect(),
        Granularity::Words => atomize(text),
    }
}

/// Splits the text of **one existing word** within the span into atoms at the span's granularity (for the comparison key; the other side is the rewritten text split by [`atomize_like`]). It differs from [`atomize_like`] only for spans in scripts split on word boundaries, such as Thai: an existing word is already one word and is not segmented again. A single word fed to a word-segmentation model may be cut into two pieces, and then the keys on the two sides would not match.
pub fn atomize_word_like<W: JoinWord>(words: &[W], word_text: &str) -> Vec<String> {
    match span_granularity(words) {
        Granularity::LegacySyllables => atomize_syllables(word_text),
        Granularity::ScriptWords | Granularity::Words => atomize(word_text),
    }
}

/// [`atomize_like`] with each atom's glue marker attached, for use where words are formed (rewritten spans, text edits). Syllable-split old Hangul spans and ordinary spans carry no markers. The former are re-bound by [`crate::rebind::reglue_legacy_span`] under the old rules, and the latter never had markers.
pub fn atomize_words_like<W: JoinWord>(words: &[W], text: &str) -> Vec<(String, bool)> {
    match span_granularity(words) {
        Granularity::LegacySyllables => atomize_syllables(text)
            .into_iter()
            .map(|atom| (atom, false))
            .collect(),
        Granularity::ScriptWords => atomize_words_anchored(words, text),
        Granularity::Words => atomize(text)
            .into_iter()
            .map(|atom| (atom, false))
            .collect(),
    }
}

/// The splitting rule for rewriting a span split on word boundaries, such as Thai: the segments at the start and end of `text` that are character-for-character identical to the span's original words keep the original word boundaries. Only the middle segment that was changed is re-segmented, and the markers are re-derived from whether `text` contains whitespace ([`script_glue_from_text`]).
///
/// Word-segmentation results depend on context: the same word may get different boundaries when the whole sentence is fed in versus only half of it. Measured on Thai acceptance sentences, re-cutting each sub-span separately changed the split for about 9% of sub-spans at the edges. Re-cutting the whole segment would change the IDs and timings of unedited words. With anchoring, the words come out as the originals whenever the text is unchanged. If the anchored result concatenated does not match the concatenation from [`atomize_words`] (for example, an anchor lands in the middle of a Latin word), the whole segment is re-cut instead.
fn atomize_words_anchored<W: JoinWord>(words: &[W], text: &str) -> Vec<(String, bool)> {
    let fresh = atomize_words(text);
    let clean_cut = |before: Option<char>, after: Option<char>| {
        !after.is_some_and(is_combining) && !before.is_some_and(is_preposed_vowel)
    };
    // Anchored word: (text, its start position in `text`).
    let mut head: Vec<(String, usize)> = Vec::new();
    let mut cursor = 0;
    for word in words {
        let word = word.join_text().trim();
        let rest = &text[cursor..];
        let at = cursor + (rest.len() - rest.trim_start().len());
        if word.is_empty() || !text[at..].starts_with(word) {
            break;
        }
        let end = at + word.len();
        if !clean_cut(text[..end].chars().last(), text[end..].chars().next()) {
            break;
        }
        head.push((word.to_owned(), at));
        cursor = end;
    }
    let mut tail: Vec<(String, usize)> = Vec::new();
    let mut end = text.len();
    for word in words[head.len()..].iter().rev() {
        let word = word.join_text().trim();
        let before = text[..end].trim_end();
        if word.is_empty() || !before.ends_with(word) || before.len() - word.len() < cursor {
            break;
        }
        let start = before.len() - word.len();
        if !clean_cut(text[..start].chars().last(), text[start..].chars().next()) {
            break;
        }
        tail.push((word.to_owned(), start));
        end = start;
    }
    // When the middle segment being re-cut has pure punctuation at both ends (the model added a space outside a quote, `ว่า“ยืนยัน` → `ว่า “ยืนยัน`: the tail anchor `ยืนยัน` is left as is and the middle is only `ว่า “`), the adjacent anchored words are handed back to the middle segment to be cut together. That way the punctuation attaches to a word as it would when the whole segment is re-cut, rather than standing alone as a word. At most one word is returned per side: punctuation that was already its own segment (a `—` with a space on both sides) cannot attach to any word, and returning more would only change the split of unchanged words.
    let punct_only =
        |piece: Option<&(String, bool)>| piece.is_some_and(|(atom, _)| atom_key(atom).is_none());
    let mut middle = atomize_words(&text[cursor..end]);
    if punct_only(middle.last()) && tail.pop().is_some() {
        // `tail` is stored from the end of the text backwards, so the last one is the anchor closest to the middle segment.
        end = tail.last().map_or(text.len(), |&(_, next)| next);
        middle = atomize_words(&text[cursor..end]);
    }
    if punct_only(middle.first())
        && let Some((_, start)) = head.pop()
    {
        cursor = start;
        middle = atomize_words(&text[cursor..end]);
    }
    let mut texts: Vec<String> = head.into_iter().map(|(word, _)| word).collect();
    texts.extend(middle.into_iter().map(|(atom, _)| atom));
    texts.extend(tail.into_iter().rev().map(|(word, _)| word));
    let Some(glue) = script_glue_from_text(&texts, text) else {
        return fresh;
    };
    let anchored: Vec<(String, bool)> = texts.into_iter().zip(glue).collect();
    if join_word_texts(anchored.iter()) == join_word_texts(fresh.iter()) {
        anchored
    } else {
        fresh
    }
}

/// Thai and Lao vowels written before the consonant (they also come first in logical order): they and the following consonant form one syllable, so a word boundary must not fall after them.
fn is_preposed_vowel(ch: char) -> bool {
    matches!(ch as u32, 0x0E40..=0x0E44 | 0x0EC0..=0x0EC4)
}

enum Granularity {
    LegacySyllables,
    ScriptWords,
    Words,
}

fn span_granularity<W: JoinWord>(words: &[W]) -> Granularity {
    if words.iter().any(is_legacy_glued) {
        Granularity::LegacySyllables
    } else if words.iter().any(is_script_glued) {
        Granularity::ScriptWords
    } else {
        Granularity::Words
    }
}

/// A Hangul word from before 0.5 that is split by syllable: it carries the glue marker and contains Hangul syllables. When old drafts are read, [`legacy_glue`] only marks words of this kind. (Hangul next to Hangul, and Hangul next to the outside of a dash, ellipsis or curly quote; the marked side is always Hangul.)
pub fn is_legacy_glued<W: JoinWord + ?Sized>(word: &W) -> bool {
    word.glued() && word.join_text().chars().any(is_hangul_syllable)
}

/// Glue markers carried by the later segments within a word, after text in unspaced scripts ([`is_unspaced_script_char`]) has been split into words at draft time: the marker is set, and the word is not [`is_legacy_glued`].
pub fn is_script_glued<W: JoinWord + ?Sized>(word: &W) -> bool {
    word.glued() && !is_legacy_glued(word)
}

/// Scripts that write no spaces between words and cannot be made into one-character words: Thai, Lao, Tibetan (including Zongkha), Burmese, and Khmer (including the extension blocks). In these scripts a space is a pause in a phrase or clause, not a word boundary, so word boundaries must come from word segmentation ([`atomize_words`]). They are the same set of scripts excluded by [`spaced_script_letter`].
pub fn is_unspaced_script_char(ch: char) -> bool {
    matches!(
        ch as u32,
        0x0E00..=0x0EFF
            | 0x0F00..=0x0FFF
            | 0x1000..=0x109F
            | 0x1780..=0x17FF
            | 0x19E0..=0x19FF
            | 0xA9E0..=0xA9FF
            | 0xAA60..=0xAA7F
    )
}

/// Scripts that have a word-segmentation model (Thai, Lao, Burmese, Khmer). Tibetan has no segmentation model; syllables within a word are already split by [`atomize`] at the syllable mark `་` (tsheg).
pub(crate) fn is_lstm_script_char(ch: char) -> bool {
    matches!(
        ch as u32,
        0x0E00..=0x0EFF | 0x1000..=0x109F | 0x1780..=0x17FF | 0x19E0..=0x19FF | 0xA9E0..=0xA9FF | 0xAA60..=0xAA7F
    )
}

/// A seam between two pieces of text touches unspaced script (the boundary character on either side is [`is_unspaced_script_char`]).
fn script_seam(prev: &str, next: &str) -> bool {
    prev.chars().last().is_some_and(is_unspaced_script_char)
        || next.chars().next().is_some_and(is_unspaced_script_char)
}

/// Atomization at word-formation granularity, with glue markers. First split by [`atomize`], then split the atoms containing Thai, Lao, Burmese, and Khmer text into words (ICU4X LSTM segmentation). An atom marked as glued has no whitespace in the original between it and the previous atom, and the seam touches unspaced script. Such a seam would get a space from [`sep_len`], so it must be marked in order to re-join to the original text. Seams left by splitting Tibetan at the syllable mark are marked the same way.
///
/// Text without these scripts is identical to [`atomize`] atom by atom, and all markers are false. It is lossless: re-joining by the markers ([`join_word_texts`]) gives the original text with leading and trailing whitespace removed and whitespace runs folded into single spaces.
pub fn atomize_words(text: &str) -> Vec<(String, bool)> {
    let atoms = atomize(text);
    let mut out: Vec<(String, bool)> = Vec::with_capacity(atoms.len());
    let mut cursor = 0;
    for atom in atoms {
        let rest = &text[cursor..];
        let skipped = rest.len() - rest.trim_start().len();
        let adjacent = skipped == 0;
        let start = if text[cursor + skipped..].starts_with(&atom) {
            cursor + skipped
        } else {
            // atomize is lossless: atoms are in order and separated only by whitespace. To be safe, if an atom is not found, locate it by substring; if it still cannot be located, treat it as separated by whitespace.
            match text[cursor..].find(&atom) {
                Some(offset) => cursor + offset,
                None => {
                    out.extend(
                        split_script_words(&atom)
                            .into_iter()
                            .enumerate()
                            .map(|(index, piece)| (piece, index > 0)),
                    );
                    continue;
                }
            }
        };
        cursor = start + atom.len();
        let glue_first = adjacent
            && out
                .last()
                .is_some_and(|(previous, _)| script_seam(previous, &atom));
        for (index, piece) in split_script_words(&atom).into_iter().enumerate() {
            out.push((piece, if index == 0 { glue_first } else { true }));
        }
    }
    out
}

/// For a sequence of words taken in order from `text` (per-word timings from the transcription engine, source words on the page), whether each word needs a glue marker relative to the previous word: there is no whitespace between the two words in the original, and the seam touches unspaced script ([`is_unspaced_script_char`]). All other seams (Chinese and Japanese character by character, Latin words) are always false, the same as without this step. Returns `None` when the words cannot be matched in order against the original.
pub fn script_glue_from_text<S: AsRef<str>>(words: &[S], text: &str) -> Option<Vec<bool>> {
    let mut flags = Vec::with_capacity(words.len());
    let mut cursor = 0;
    let mut previous: Option<&str> = None;
    for word in words {
        let word = word.as_ref().trim();
        if word.is_empty() {
            return None;
        }
        let rest = &text[cursor..];
        let skipped = rest.len() - rest.trim_start().len();
        if !text[cursor + skipped..].starts_with(word) {
            return None;
        }
        flags.push(skipped == 0 && previous.is_some_and(|previous| script_seam(previous, word)));
        cursor += skipped + word.len();
        previous = Some(word);
    }
    Some(flags)
}

/// Splits the Thai, Lao, Burmese and Khmer text in one atom into words. Only word boundaries where at least one side is one of these scripts are used, so Latin and digit segments embedded inside (such as `F-07` and `14:30`) stay intact. Segments that are only punctuation are merged into an adjacent word: an opening delimiter (Ps/Pi) goes to the following word, and the rest go to the preceding word. The repetition marks `ๆ` / `ໆ` go to the preceding word. Concatenated, the pieces equal the atom.
fn split_script_words(atom: &str) -> Vec<String> {
    if !atom.chars().any(is_lstm_script_char) {
        return vec![atom.to_owned()];
    }
    let boundaries: Vec<usize> = crate::word_breaks::lstm_word_boundaries(atom)
        .into_iter()
        .filter(|&offset| {
            let before = atom[..offset].chars().last();
            let after = atom[offset..].chars().next();
            (before.is_some_and(is_lstm_script_char) || after.is_some_and(is_lstm_script_char))
                && !after.is_some_and(is_combining)
        })
        .collect();
    let mut segments: Vec<&str> = Vec::with_capacity(boundaries.len() + 1);
    let mut start = 0;
    for end in boundaries.into_iter().chain(std::iter::once(atom.len())) {
        if end > start {
            segments.push(&atom[start..end]);
            start = end;
        }
    }
    let has_word_char = |segment: &str| segment.chars().any(|ch| ch.is_alphanumeric());
    let repetition_mark = |segment: &str| {
        segment
            .chars()
            .next()
            .is_some_and(|ch| matches!(ch, '\u{0E46}' | '\u{0EC6}'))
    };
    let mut pieces: Vec<String> = Vec::with_capacity(segments.len());
    let mut carry = String::new();
    for (index, segment) in segments.iter().enumerate() {
        let attach_back = !has_word_char(segment) || repetition_mark(segment);
        if attach_back {
            let opening = segment.chars().last().is_some_and(is_opening_delimiter)
                && !repetition_mark(segment);
            let has_next_word = segments[index + 1..].iter().any(|next| has_word_char(next));
            // Punctuation that follows punctuation already waiting for the next word also waits, so the order is preserved.
            if !carry.is_empty() || (opening && has_next_word) || pieces.is_empty() {
                carry.push_str(segment);
            } else if let Some(last) = pieces.last_mut() {
                last.push_str(segment);
            }
            continue;
        }
        let mut piece = std::mem::take(&mut carry);
        piece.push_str(segment);
        pieces.push(piece);
    }
    if !carry.is_empty() {
        match pieces.last_mut() {
            Some(last) => last.push_str(&carry),
            None => pieces.push(carry),
        }
    }
    pieces
}

fn atomize_with(text: &str, per_char: PerChar) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out: Vec<String> = Vec::new();
    let mut run = String::new(); // Open non-CJK word atom
    let mut pending_prefix = String::new(); // Punctuation at the start of a line or in a gap, waiting to attach backwards
    let mut gap_before = true; // The cursor is preceded by whitespace (or the start of the text)

    macro_rules! flush_run {
        () => {
            if !run.is_empty() {
                out.push(std::mem::take(&mut run));
            }
        };
    }

    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            flush_run!();
            gap_before = true;
            i += 1;
            continue;
        }
        if is_combining(c) && !gap_before {
            // Attaches to the character it belongs to: an open word, a just-closed atom (a CJK character, or a word ending in punctuation), or prefix punctuation still waiting for a word. An isolated mark after a gap has no character to attach to, and falls through to the branch below.
            if !run.is_empty() {
                run.push(c);
            } else if let Some(last) = out.last_mut() {
                last.push(c);
            } else {
                pending_prefix.push(c);
            }
            i += 1;
            continue;
        }
        if per_char(c) {
            flush_run!();
            let mut atom = std::mem::take(&mut pending_prefix);
            atom.push(c);
            out.push(atom);
            gap_before = false;
            i += 1;
            continue;
        }
        if is_word_char(c, per_char) {
            if run.is_empty() {
                run = std::mem::take(&mut pending_prefix);
            }
            run.push(c);
            gap_before = false;
            i += 1;
            continue;
        }
        // Punctuation/symbol run [i..j)
        let mut j = i;
        while j < chars.len()
            && !chars[j].is_whitespace()
            && !per_char(chars[j])
            && !is_word_char(chars[j], per_char)
        {
            j += 1;
        }
        let punct: String = chars[i..j].iter().collect();
        let next_is_word = j < chars.len() && is_word_char(chars[j], per_char);
        let next_is_content = j < chars.len() && !chars[j].is_whitespace();
        if !gap_before {
            if !run.is_empty() && next_is_word && j - i == 1 && COHESIVE_MARKS.contains(&chars[i]) {
                run.push(chars[i]); // 3.14 / don't / state-of-the-art stay cohesive
            } else if !run.is_empty() {
                run.push_str(&punct);
                flush_run!();
            } else if let Some(last) = out.last_mut() {
                last.push_str(&punct);
            } else {
                pending_prefix.push_str(&punct);
            }
            gap_before = false;
        } else if next_is_content {
            pending_prefix.push_str(&punct);
            gap_before = false;
        } else {
            flush_run!();
            let mut atom = std::mem::take(&mut pending_prefix);
            atom.push_str(&punct);
            out.push(atom);
            gap_before = true;
        }
        i = j;
    }
    flush_run!();
    if !pending_prefix.is_empty() {
        out.push(pending_prefix);
    }
    out
}

/// Number of measurement units in the text, used for language-neutral page budget measurement.
///
/// Han characters, kana and Hangul count one each per character. Other scripts count one per word. Attached punctuation is not counted separately (the convention of [`atomize_syllables`]). Measuring by character is unfair between CJK and Latin: a Latin word is about 5.5 characters, while a CJK character is one word. Under the same character budget a CJK page would carry several times the information density of a Latin page. Using this unit puts both kinds of script on the same scale. The **word** of Hangul is the 어절 ([`atomize`]), but the budget is still counted by syllable: a 어절 averages three syllables, so counting by 어절 would fit about three times the content into the same page budget. Pagination calls this once per page, so the allocation cost is negligible.
pub fn word_count(text: &str) -> usize {
    atomize_syllables(text).len()
}

/// Width of the separator between words, in three tiers (matches `SubText.sepLen`):
///
/// 1. Both sides are non-spaced characters ([`is_unspaced_cjk_adjacent`]: Han characters, kana, CJK punctuation and the full-width block, Chinese quotes and dashes) → 0. Hangul next to a Han character or kana → 0 (Hangul embedded in Chinese or Japanese, and Han characters embedded in Hangul, stay attached as they are). **Hangul next to Hangul is not in this case**: Hangul is split on spaces, so between two 어절 it is 1.
/// 2. Either side is **full-width punctuation** ([`is_fullwidth_punctuation`]) → 0. **One side is enough.**
/// 3. Either side is a **shared typographic mark** ([`is_shared_typographic_mark`]) → 0 only if the seam falls on the **content side** of that mark: `prev` ends with an opening delimiter (Ps/Pi), or `next` begins with a closing delimiter (Pe/Pf).
///
/// Why rules 2 and 3 differ, and **why they must not be merged back into one rule**: full-width punctuation glyphs carry their own visual whitespace, so no space should be added when either side matches. Shared typographic marks (U+2014 —, U+2018..U+201D ‘’‚‛“”, U+2026 …), however, take part in spacing as normal characters in Latin typesetting. Applying the single-side rule would squeeze `said “Hello` into `said“Hello`, `students’ books` into `students’books`, and `so… yeah` into `so…yeah`. English is a real translation target, so that would miscalculate the display width of English translation segments as a whole, and thereby affect the splitting.
///
/// The test for rule 3, in one sentence: **a delimiter takes no space on the side facing its own content.** So in `名为“` + `PluginDataJSON”`, the `“` (Pi) is at the end of `prev` and the seam is on its content side, giving 0. That joins back as `名为“PluginDataJSON”`, not with a phantom space `名为“ PluginDataJSON”`. A phantom space would make the canonical from `join_atoms` differ in length from the translation, shifting the seam offsets in `split.rs` and the protected-term matching. In `students’` + `books`, however, the `’` (Pf) is at the end of `prev` and the seam is on its **outer** side, giving 1, so the space after the English apostrophe is kept.
///
/// The judgement looks only at one boundary character on each side. `prev` is often the accumulated prefix of a whole segment, and it must not be scanned backwards; otherwise single-atom calls and whole-string calls would give different results, which would reintroduce offset drift. Known trade-off: a case like `sep_len("好”", "foo")`, a closing quote outside followed by Latin, should close in a Chinese context but keep a space in an English context (`“Hello world” today`). Two characters of local information cannot tell these apart, so it takes 1, as English (this was also the existing behaviour before this change).
pub fn sep_len(prev: &str, next: &str) -> usize {
    sep_len_with(prev, next, unspaced_pair)
}

/// Rule 1 of [`sep_len`]: no space between these two adjacent characters. Both sides are non-spaced characters (Han characters, kana, CJK punctuation and the full-width block, Chinese quotes and dashes), or Hangul sits next to a Han character or kana. Hangul next to Hangul is not included. Where stray spaces in model text are cleaned up (`markers::collapse_cjk_spaces`), the same convention is used.
pub fn unspaced_pair(prev: char, next: char) -> bool {
    (is_unspaced_cjk_adjacent(prev) && is_unspaced_cjk_adjacent(next))
        || (is_hangul_syllable(prev) && is_unspaced_cjk_char(next))
        || (is_unspaced_cjk_char(prev) && is_hangul_syllable(next))
}

/// The pre-0.5 version of [`unspaced_pair`]: Hangul also counts as a “non-spaced character”. Only for old drafts.
pub(crate) fn legacy_unspaced_pair(prev: char, next: char) -> bool {
    is_cjk_adjacent(prev) && is_cjk_adjacent(next)
}

/// The pre-0.5 version of [`sep_len`]. It is only used to read old drafts. See [`legacy_glue`].
fn legacy_sep_len(prev: &str, next: &str) -> usize {
    sep_len_with(prev, next, legacy_unspaced_pair)
}

/// A seam that got no space before 0.5 but would get one under the current rules. Old drafts need such words to carry a glue marker ([`crate::doc::Word::glue`]) to keep their original display.
///
/// Only syllable-split old Hangul words match: Hangul next to Hangul, and Hangul next to the outside of a dash, ellipsis or curly quote. It is used to mark words when old-version drafts are read, and when a span that is still split by syllable is rewritten.
pub fn legacy_glue(prev: &str, next: &str) -> bool {
    legacy_sep_len(prev, next) == 0 && sep_len(prev, next) == 1
}

fn sep_len_with(prev: &str, next: &str, unspaced_pair: fn(char, char) -> bool) -> usize {
    let p = prev.chars().last();
    let n = next.chars().next();
    if let (Some(p), Some(n)) = (p, n)
        && unspaced_pair(p, n)
    {
        return 0;
    }
    if p.is_some_and(is_fullwidth_punctuation) || n.is_some_and(is_fullwidth_punctuation) {
        return 0;
    }
    let shared_content_side = |ch: char, opening: bool| {
        is_shared_typographic_mark(ch)
            && if opening {
                is_opening_delimiter(ch)
            } else {
                is_closing_delimiter(ch)
            }
    };
    if p.is_some_and(|ch| shared_content_side(ch, true))
        || n.is_some_and(|ch| shared_content_side(ch, false))
    {
        return 0;
    }
    if prev.ends_with(' ') || next.starts_with(' ') {
        return 0;
    }
    1
}

/// A word as seen by the concatenation rules: its text, plus the glue marker stored in the draft ([`crate::doc::Word::glue`]). When the marker is true, no space is added between this word and the previous word in the concatenated sequence, whatever [`sep_len`] would decide.
///
/// Plain text (`&str` / `String`) has no marker and always follows [`sep_len`]. Translation atoms and segments written back by the model are of this kind. Wherever text is taken from `doc.words`, either pass the word itself, or carry the marker with `(text, glue)`. Passing only the text would add a space at that point in a draft that has markers.
pub trait JoinWord {
    fn join_text(&self) -> &str;
    fn glued(&self) -> bool {
        false
    }
}

impl JoinWord for str {
    fn join_text(&self) -> &str {
        self
    }
}

impl JoinWord for String {
    fn join_text(&self) -> &str {
        self
    }
}

impl<T: JoinWord + ?Sized> JoinWord for &T {
    fn join_text(&self) -> &str {
        (**self).join_text()
    }
    fn glued(&self) -> bool {
        (**self).glued()
    }
}

impl JoinWord for (&str, bool) {
    fn join_text(&self) -> &str {
        self.0
    }
    fn glued(&self) -> bool {
        self.1
    }
}

impl JoinWord for (String, bool) {
    fn join_text(&self) -> &str {
        &self.0
    }
    fn glued(&self) -> bool {
        self.1
    }
}

/// [`sep_len`] that honours the glue marker: `prev` is the already-joined prefix (or the text of the previous word).
pub fn word_sep<W: JoinWord + ?Sized>(prev: &str, next: &W) -> usize {
    if next.glued() {
        0
    } else {
        sep_len(prev, next.join_text())
    }
}

/// Joins a word sequence into display text (no spaces between Han characters and kana; words with a glue marker get no space).
pub fn join_word_texts<I>(words: I) -> String
where
    I: IntoIterator,
    I::Item: JoinWord,
{
    let mut output = String::new();
    for word in words {
        if !output.is_empty() && word_sep(&output, &word) == 1 {
            output.push(' ');
        }
        output.push_str(word.join_text());
    }
    output
}

/// The same ruler as [`join_word_texts`]: returns the cumulative character count of the display string at each word boundary.
///
/// `out[i]` is the number of characters after the first `i + 1` words are joined, including the spaces that the `sep_len` judgement inserts. So the indices correspond one-to-one with the input word sequence. Anything that needs to map a display-string offset back to a word boundary must use this, rather than accumulating a fixed separator width per word, because the latter drifts at CJK junctions.
pub fn join_prefix_char_lens<I>(words: I) -> Vec<usize>
where
    I: IntoIterator,
    I::Item: JoinWord,
{
    let mut output = String::new();
    let mut chars = 0_usize;
    let mut lens = Vec::new();
    for word in words {
        if !output.is_empty() && word_sep(&output, &word) == 1 {
            output.push(' ');
            chars += 1;
        }
        let text = word.join_text();
        output.push_str(text);
        chars += text.chars().count();
        lens.push(chars);
    }
    lens
}

/// Line width measure: adjacent CJK characters count 2, others count 1.
pub fn visual_width(text: &str) -> usize {
    text.chars()
        .map(|ch| if is_cjk_adjacent(ch) { 2 } else { 1 })
        .sum()
}

/// CPS numerator: the number of non-whitespace characters.
pub fn count_cps_chars(text: &str) -> usize {
    text.chars().filter(|ch| !ch.is_whitespace()).count()
}

/// Normalized character stream: strips whitespace, punctuation and symbols, and expands each character to lowercase (matches `SubAlign.normalizeChars`). “The model may only add punctuation” is proven by strict equality after normalization.
pub fn normalize_chars(text: &str) -> String {
    let mut output = String::new();
    for ch in text.chars() {
        if ch.is_whitespace() || is_punctuation_or_symbol(ch) {
            continue;
        }
        for low in ch.to_lowercase() {
            output.push(low);
        }
    }
    output
}

/// LCS atom key: the normalized string. A punctuation-only atom has an empty key, and the caller should drop it.
pub fn atom_key(atom: &str) -> Option<String> {
    let key = normalize_chars(atom);
    (!key.is_empty()).then_some(key)
}

/// Edit distance (character-level Levenshtein, using rolling rows).
pub fn edit_distance(a: &[char], b: &[char]) -> usize {
    if a.is_empty() {
        return b.len();
    }
    if b.is_empty() {
        return a.len();
    }
    let mut previous: Vec<usize> = (0..=b.len()).collect();
    let mut current = vec![0_usize; b.len() + 1];
    for (i, &ca) in a.iter().enumerate() {
        current[0] = i + 1;
        for (j, &cb) in b.iter().enumerate() {
            let substitution = previous[j] + usize::from(ca != cb);
            current[j + 1] = substitution.min(previous[j + 1] + 1).min(current[j] + 1);
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous[b.len()]
}

/// Normalized similarity: `1 - editDistance/maxLen`. If both sides are empty, it is 1.
pub fn similarity(a: &str, b: &str) -> f64 {
    let na: Vec<char> = normalize_chars(a).chars().collect();
    let nb: Vec<char> = normalize_chars(b).chars().collect();
    let max_len = na.len().max(nb.len());
    if max_len == 0 {
        return 1.0;
    }
    1.0 - edit_distance(&na, &nb) as f64 / max_len as f64
}

/// Character weight (`TranscriptModel.wWeight`): `max(2, letters+numbers+') + 1.4`.
pub fn w_weight(token: &str) -> f64 {
    let semantic = token
        .chars()
        .filter(|ch| ch.is_alphabetic() || ch.is_numeric() || *ch == '\'')
        .count();
    (semantic.max(2) as f64) + 1.4
}

/// Weight for filling rebind gaps (`correctionTimingWeight`): `max(1, letters+numbers+')`.
pub fn correction_timing_weight(token: &str) -> f64 {
    let semantic = token
        .chars()
        .filter(|ch| ch.is_alphabetic() || ch.is_numeric() || *ch == '\'')
        .count();
    semantic.max(1) as f64
}

const CLOSERS: &[char] = &['”', '"', '’', '\'', '」', '』', '）', ')', ']', '》'];
const TERMINAL: &[char] = &['。', '．', '.', '？', '?', '！', '!', '…'];
const CLAUSE_END: &[char] = &[',', ';', ':', '—', '–', '，', '；', '：', '、'];

/// Table of lowercase stem abbreviations. The period in `"Dr."` is not a sentence end.
const SENTENCE_ABBREV: &[&str] = &[
    "mr", "mrs", "ms", "dr", "prof", "st", "sr", "jr", "rev", "hon", "fr", "gen", "gov", "sen",
    "rep", "col", "lt", "sgt", "capt", "vs", "etc", "inc", "ltd", "corp", "dept", "vol", "fig",
];

/// Skips closing quotes and brackets in reverse order, then looks for the terminal punctuation (matches `TranscriptBoundary.endsSentence`).
pub fn ends_sentence(text: &str) -> bool {
    for ch in text.chars().rev() {
        if CLOSERS.contains(&ch) {
            continue;
        }
        return TERMINAL.contains(&ch);
    }
    false
}

/// Sentence-end check (matches `TranscriptModel.sentenceEnd`): a terminal punctuation mark after at most one closer. A `.` that has another `.` inside the token (`2.14` / `a.com`), or whose stem is an abbreviation, does not count as a sentence end.
pub fn sentence_end(token: &str) -> bool {
    let trimmed: Vec<char> = token.chars().collect();
    let mut index = trimmed.len();
    let mut closers_skipped = 0;
    while index > 0 && CLOSERS.contains(&trimmed[index - 1]) && closers_skipped < 1 {
        index -= 1;
        closers_skipped += 1;
    }
    if index == 0 {
        return false;
    }
    let last = trimmed[index - 1];
    if !TERMINAL.contains(&last) {
        return false;
    }
    if last == '.' {
        let stem: String = trimmed[..index - 1].iter().collect();
        if stem.contains('.') {
            return false; // 2.14 / a.com / U.S.
        }
        let stem_lower = stem
            .trim_matches(|ch: char| !ch.is_alphanumeric())
            .to_lowercase();
        if SENTENCE_ABBREV.contains(&stem_lower.as_str()) {
            return false;
        }
    }
    true
}

/// Clause punctuation (`clauseEndChar`): skips at most one closing quote or bracket, then takes the trailing punctuation. It returns the punctuation itself, because dashes (interruptions and restarts) and comma-like marks use different line-break thresholds.
pub fn clause_end_char(token: &str) -> Option<char> {
    let chars: Vec<char> = token.chars().collect();
    let mut index = chars.len();
    if index > 0 && CLOSERS.contains(&chars[index - 1]) {
        index -= 1;
    }
    if index == 0 {
        return None;
    }
    let last = chars[index - 1];
    CLAUSE_END.contains(&last).then_some(last)
}

/// Whether the `cut`-th atom boundary **in the original text** is actually backed by whitespace.
///
/// [`atomize`] drops whitespace, and [`join_word_texts`] then inserts a rendering space at CJK/Latin junctions. So at the atom level, “worried AI will take away…” looks like “your GPU is…” in having a word-space seam. But the former cuts between a verb and its object clause. Wherever seam quality is graded (the DP objective function, the free-seam judgement), the original whitespace must be used, not the spaces produced by concatenation.
pub fn seam_backed_by_whitespace(text: &str, atoms: &[String], cut: usize) -> bool {
    if cut == 0 || cut >= atoms.len() {
        return false;
    }
    let prefix_chars: usize = atoms[..cut].iter().map(|atom| atom.chars().count()).sum();
    let mut seen = 0usize;
    for ch in text.chars() {
        if seen == prefix_chars {
            return ch.is_whitespace();
        }
        if !ch.is_whitespace() {
            seen += 1;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_cjk_ascii_punctuation_targets_cjk_neighbors_only() {
        // The contagion pattern observed in the benchmark: a Latin word immediately followed by CJK.
        assert_eq!(
            normalize_cjk_ascii_punctuation("Martin,让我担心的是"),
            "Martin，让我担心的是"
        );
        assert_eq!(normalize_cjk_ascii_punctuation("他说:好"), "他说：好");
        assert_eq!(normalize_cjk_ascii_punctuation("分号;例子"), "分号；例子");
        // Neither side is CJK: digits, times, URLs and pure English are kept as they are.
        assert_eq!(
            normalize_cjk_ascii_punctuation("共 3,000 人"),
            "共 3,000 人"
        );
        assert_eq!(normalize_cjk_ascii_punctuation("10:30 开始"), "10:30 开始");
        assert_eq!(
            normalize_cjk_ascii_punctuation("见 http://example.com;q=1 页面"),
            "见 http://example.com;q=1 页面"
        );
        assert_eq!(
            normalize_cjk_ascii_punctuation("Keep tone light, direct: yes; ok"),
            "Keep tone light, direct: yes; ok"
        );
        // `.` is outside the mapping domain (file name and abbreviation ambiguity). Text that is already full-width is idempotent.
        assert_eq!(normalize_cjk_ascii_punctuation("配置好.env"), "配置好.env");
        let normalized = normalize_cjk_ascii_punctuation("他说：好，再见；完");
        assert_eq!(normalized, "他说：好，再见；完");
        assert_eq!(normalize_cjk_ascii_punctuation(&normalized), normalized);
    }

    #[test]
    fn seam_backing_follows_source_whitespace_not_rendered_spaces() {
        let text = "我发现很多人担心AI会抢走自己的工作。";
        let atoms = atomize(text);
        let cut = atoms
            .iter()
            .position(|atom| atom == "AI")
            .expect("AI atom present");
        // After joining it reads “worried AI”, but the original has no space, so it is not a seam.
        assert!(!seam_backed_by_whitespace(text, &atoms, cut));

        let spaced = "你的 GPU 在显存读取之间会有空闲算力——";
        let spaced_atoms = atomize(spaced);
        let spaced_cut = spaced_atoms
            .iter()
            .position(|atom| atom == "在")
            .expect("atom should be present");
        assert!(seam_backed_by_whitespace(spaced, &spaced_atoms, spaced_cut));
    }

    #[test]
    fn atomize_matches_voiceink_test_vectors() {
        assert_eq!(atomize("你好，世界。"), vec!["你", "好，", "世", "界。"]);
        // Han characters and kana character by character; Hangul split on spaces.
        assert_eq!(
            atomize("いい天気 한국어"),
            vec!["い", "い", "天", "気", "한국어"]
        );
        assert_eq!(
            atomize("3.14 U.S. don't state-of-the-art a.com"),
            vec!["3.14", "U.S.", "don't", "state-of-the-art", "a.com"]
        );
        assert_eq!(
            atomize("$100 50% 😀 +value"),
            vec!["$100", "50%", "😀", "+value"]
        );
    }

    /// Combining marks are not split: after splitting and re-joining, the result must still be the original text.
    #[test]
    fn combining_marks_stay_inside_their_word() {
        // Thai: tone marks U+0E49 / U+0E48 are Mn and are not letters.
        assert_eq!(atomize("พื้นที่"), vec!["พื้นที่"]);
        assert_eq!(atomize("ผมไม่ได้ไป ตลาดน้ำ"), vec!["ผมไม่ได้ไป", "ตลาดน้ำ"]);
        // Devanagari: virama U+094D, nukta U+093C. Bengali: hasanta U+09CD. Tamil: pulli U+0BCD.
        assert_eq!(atomize("क्या हुआ?"), vec!["क्या", "हुआ?"]);
        assert_eq!(atomize("ज़रूरी"), vec!["ज़रूरी"]);
        assert_eq!(atomize("বাংলা ভাষার জন্য"), vec!["বাংলা", "ভাষার", "জন্য"]);
        assert_eq!(atomize("தமிழ் மொழி"), vec!["தமிழ்", "மொழி"]);
        // Arabic tashkeel, Hebrew niqqud.
        assert_eq!(atomize("مَرْحَبًا بِكُمْ"), vec!["مَرْحَبًا", "بِكُمْ"]);
        assert_eq!(atomize("שָׁלוֹם עוֹלָם"), vec!["שָׁלוֹם", "עוֹלָם"]);
        // Latin accents in decomposed form (NFD).
        assert_eq!(
            atomize("re\u{301}sume\u{301} done"),
            vec!["re\u{301}sume\u{301}", "done"]
        );
        // Zero-width joiners (Persian ZWNJ, Sinhala ZWJ) stay within the word.
        assert_eq!(atomize("می\u{200C}خواهم"), vec!["می\u{200C}خواهم"]);
        // A combining dakuten after a CJK character goes with that character.
        assert_eq!(atomize("か\u{3099}き"), vec!["か\u{3099}", "き"]);
        // A mark following word-final punctuation still follows the previous atom, rather than starting a new one.
        assert_eq!(atomize("a.\u{301} b"), vec!["a.\u{301}", "b"]);
        // The emoji variation selector U+FE0F is also Mn, so it goes with the emoji as before.
        assert_eq!(atomize("I ❤\u{FE0F} you"), vec!["I", "❤\u{FE0F}", "you"]);
        assert_eq!(atomize("ok❤\u{FE0F}"), vec!["ok❤\u{FE0F}"]);
        for text in [
            "พื้นที่ ของ เรา",
            "क्या आप ठीक हैं?",
            "مَرْحَبًا بِكُمْ",
            "re\u{301}sume\u{301} done",
        ] {
            assert_eq!(
                join_word_texts(atomize(text).iter().map(String::as_str)),
                text
            );
        }
    }

    /// Hangul split on spaces: one 어절 per atom, punctuation follows the 어절 it is in, and re-joining gives the original text. This table is identical, test by test, to the same-named tests in `ccut-editor-core/src/subtext.rs`.
    #[test]
    fn korean_is_cut_and_joined_at_spaces() {
        assert_eq!(
            atomize("저는 내일 학교에 갑니다."),
            vec!["저는", "내일", "학교에", "갑니다."]
        );
        assert_eq!(
            atomize("“안녕하세요,” 그가 말했다."),
            vec!["“안녕하세요,”", "그가", "말했다."]
        );
        // Hangul written together with Latin letters and digits is one 어절.
        assert_eq!(
            atomize("iPhone을 3개 샀어요"),
            vec!["iPhone을", "3개", "샀어요"]
        );
        // Han characters embedded in Hangul stay character by character, and stick to the adjacent Hangul.
        assert_eq!(atomize("大韓민국"), vec!["大", "韓", "민국"]);
        for text in [
            "저는 내일 학교에 갑니다.",
            "“안녕하세요,” 그가 말했다.",
            "iPhone을 3개 샀어요",
            "그래서… 네, 맞아요 — 정말로",
            "大韓민국 만세",
            "他说안녕하세요就走了",
        ] {
            assert_eq!(
                join_word_texts(atomize(text).iter().map(String::as_str)),
                text,
            );
        }
        // Seams: between Hangul and Hangul is 1. Hangul next to Han characters or kana is 0. Full-width punctuation still closes on one side. Shared typographic marks follow the Latin rule.
        assert_eq!(sep_len("저는", "내일"), 1);
        assert_eq!(sep_len("갑니다.", "저는"), 1);
        assert_eq!(sep_len("韓", "민국"), 0);
        assert_eq!(sep_len("민국", "万"), 0);
        assert_eq!(sep_len("の", "한국"), 0);
        assert_eq!(sep_len("「", "안녕"), 0);
        assert_eq!(sep_len("안녕", "」"), 0);
        assert_eq!(sep_len("“", "안녕"), 0);
        assert_eq!(sep_len("안녕", "”"), 0);
        assert_eq!(sep_len("그래서…", "네"), 1);
        assert_eq!(sep_len("맞아요", "—"), 1);
        assert_eq!(sep_len("iPhone", "을"), 1);
        // Width unchanged: Hangul is still two cells.
        assert_eq!(visual_width("한국어 ab"), 9);
        assert!(is_cjk_char('한') && !is_unspaced_cjk_char('한'));
        assert!(spaced_script_letter('한') && !spaced_script_letter('漢'));
        // Hangul uses half-width punctuation, so it is not converted to full-width.
        assert_eq!(
            normalize_cjk_ascii_punctuation("네, 맞아요: 정말; 그래요"),
            "네, 맞아요: 정말; 그래요"
        );
    }

    /// The syllable-level convention is kept for comparison, measurement and old drafts. It is character-for-character identical to `atomize` before 0.5.
    #[test]
    fn syllable_atoms_keep_the_pre_0_5_cut() {
        assert_eq!(
            atomize_syllables("いい天気 한국어"),
            vec!["い", "い", "天", "気", "한", "국", "어"]
        );
        assert_eq!(
            atomize_syllables("저는 내일, 갑니다."),
            vec!["저", "는", "내", "일,", "갑", "니", "다."]
        );
        // For text without Hangul, the two conventions are identical character for character.
        for text in [
            "你好，世界。",
            "3.14 U.S. don't state-of-the-art a.com",
            "他用 Agent 来做",
            "ผมไม่ได้ไป ตลาดน้ำ",
            "いい天気ですね。",
        ] {
            assert_eq!(atomize_syllables(text), atomize(text), "{text}");
        }
        // The budget is counted by syllable.
        assert_eq!(word_count("저는 내일 학교에 갑니다."), 10);
        // An old word (one syllable, with its punctuation attached) is one atom under both conventions.
        for word in ["한", "다.", "(그", "어,”"] {
            assert_eq!(atomize(word), vec![word]);
            assert_eq!(atomize_syllables(word), vec![word]);
        }
        // If the span has marked words, keep the syllable-level split.
        let legacy = [("저", false), ("는", true)];
        let fresh = [("저는", false), ("내일", false)];
        assert_eq!(atomize_like(&legacy, "저는"), vec!["저", "는"]);
        assert_eq!(atomize_like(&fresh, "저는"), vec!["저는"]);
    }

    /// When a Thai-like span is rewritten, it is anchored to the existing words. If the original text is unchanged, it is cut back to the original words, even if the span starts in the middle of a phrase where re-cutting alone would change the split. When only the middle has changed, the first and last words are left alone.
    #[test]
    fn script_word_spans_are_recut_only_where_the_text_changed() {
        let phrase = "ลลิตาไม่ได้ยกเลิกการประชุมแต่เลื่อนไปเป็นวันพฤหัสบดี";
        let whole = atomize_words(phrase);
        assert!(whole.len() >= 8, "{whole:?}");
        for (start, end) in [(0, 4), (1, 5), (2, whole.len()), (0, whole.len())] {
            let span = &whole[start..end];
            let text = join_word_texts(span.iter());
            let mut expected = span.to_vec();
            expected[0].1 = false; // The relation between the span's first word and what precedes it is kept by the caller
            assert_eq!(atomize_words_like(span, &text), expected, "{start}..{end}");
            assert_eq!(
                atomize_like(span, &text),
                span.iter()
                    .map(|(atom, _)| atom.clone())
                    .collect::<Vec<_>>()
            );
        }
        // Only one word in the middle changed: the first and last words are kept as they are.
        let span = &whole[..];
        let edited = join_word_texts(
            span.iter()
                .enumerate()
                .map(|(index, (atom, glue))| {
                    let atom = if index == 3 {
                        "ยกเลิกการ"
                    } else {
                        atom.as_str()
                    };
                    (atom.to_owned(), *glue)
                })
                .collect::<Vec<_>>()
                .iter(),
        );
        let recut = atomize_words_like(span, &edited);
        assert_eq!(join_word_texts(recut.iter()), edited);
        let head: Vec<(String, bool)> = span[..3]
            .iter()
            .enumerate()
            .map(|(index, (atom, glue))| (atom.clone(), *glue && index > 0))
            .collect();
        assert_eq!(recut[..3], head[..]);
        assert_eq!(recut.last(), span.last());
        // An existing single word is kept as one atom, as it is.
        for (atom, _) in &whole {
            assert_eq!(atomize_word_like(span, atom), vec![atom.clone()]);
        }
    }

    /// Text in unspaced scripts is split into words and marked. Other text is identical to [`atomize`] atom by atom.
    #[test]
    fn atomize_words_splits_unspaced_scripts_and_leaves_the_rest_alone() {
        for text in [
            "Hello, world — it's state-of-the-art.",
            "大家好，今天天气不错。",
            "저는 내일 아이폰을 샀다.",
            "اشترينا 2.5 كيلوغرام من الأرز، وبقي نصفه.",
            "मैंने कल किताब पढ़ी।",
            "いい天気 한국어 mix 3.14",
        ] {
            let words = atomize_words(text);
            let atoms: Vec<String> = words.iter().map(|(atom, _)| atom.clone()).collect();
            assert_eq!(atoms, atomize(text), "{text}");
            assert!(words.iter().all(|(_, glue)| !glue), "{text}");
        }
        for text in [
            "ลลิตาไม่ได้ยกเลิกการประชุมแต่เลื่อนไปเป็นวันพฤหัสบดีเวลา14:30น.",
            "รหัสF-07ปรากฏข้างคำว่า“ยืนยันแล้ว”แต่ยังไม่ได้ส่งพัสดุ",
            "ถ้าอุณหภูมิลดลงต่ำกว่า5องศา ให้ปิดหน้าต่างก่อน",
            "ເຈົ້າສະບາຍດີບໍ່",
            "ខ្ញុំស្រលាញ់ភាសាខ្មែរ",
            "မြန်မာဘာသာစကား",
            "བོད་ཡིག་ནི་ཡག་པོ་རེད།",
            "พื้นที่ทำงาน",
        ] {
            let words = atomize_words(text);
            assert!(words.len() > 1, "{text}: {words:?}");
            assert!(!words[0].1, "{text}");
            let rejoined = join_word_texts(words.iter().map(|(atom, glue)| (atom.as_str(), *glue)));
            assert_eq!(rejoined, text, "{words:?}");
            for (atom, _) in &words {
                let first = atom.chars().next().unwrap();
                assert!(
                    !is_combining(first),
                    "a word never starts with a mark: {atom}"
                );
            }
        }
        // Latin and digit segments embedded in Thai are not split. Quotes do not stand alone as words: an opening quote inside an atom goes with the following word, and quotes at the edge of an atom keep the attachment rule of atomize.
        let words = atomize_words("รหัสF-07ปรากฏข้างคำว่า“ยืนยันแล้ว”แต่");
        let atoms: Vec<&str> = words.iter().map(|(atom, _)| atom.as_str()).collect();
        assert!(atoms.contains(&"F-07"), "{atoms:?}");
        assert!(!atoms.contains(&"“") && !atoms.contains(&"”"), "{atoms:?}");
        let words = atomize_words("เขาพูด“สวัสดี”ครับ");
        let atoms: Vec<&str> = words.iter().map(|(atom, _)| atom.as_str()).collect();
        assert!(!atoms.contains(&"“") && !atoms.contains(&"”"), "{atoms:?}");
        // Spaces between phrases carry no marker.
        let words = atomize_words("สวัสดีครับ ขอบคุณ");
        let after_space = words
            .iter()
            .position(|(atom, _)| atom.starts_with("ขอบ"))
            .unwrap();
        assert!(!words[after_space].1);
    }

    #[test]
    fn script_glue_follows_the_text_only_at_unspaced_script_seams() {
        assert_eq!(
            script_glue_from_text(&["ลลิตา", "ไม่ได้", "การประชุม"], "ลลิตาไม่ได้ การประชุม"),
            Some(vec![false, true, false])
        );
        assert_eq!(
            script_glue_from_text(&["เวลา", "14:30", "น."], "เวลา14:30น."),
            Some(vec![false, true, true])
        );
        // Chinese and Japanese character by character, and Latin words: no marker (the concatenation rules already handle them).
        assert_eq!(
            script_glue_from_text(&["大", "家"], "大家"),
            Some(vec![false, false])
        );
        assert_eq!(
            script_glue_from_text(&["don", "'t"], "don't"),
            Some(vec![false, false])
        );
        // Not given if it does not match the original.
        assert_eq!(
            script_glue_from_text(&["ลลิตา", "ยกเลิก"], "ลลิตาไม่ได้ยกเลิก"),
            None
        );
    }

    /// The two kinds of glued word are told apart: old Hangul syllable-level words contain Hangul, while Thai-like ones do not.
    #[test]
    fn legacy_and_script_glue_are_told_apart() {
        assert!(is_legacy_glued(&("는", true)));
        assert!(!is_legacy_glued(&("는", false)));
        assert!(is_script_glued(&("ได้", true)));
        assert!(!is_script_glued(&("는", true)));
        let thai = [("ลลิตา", false), ("ไม่ได้", true)];
        let atoms = atomize_like(&thai, "ลลิตาไม่ได้ยกเลิก");
        assert!(atoms.len() >= 3, "{atoms:?}");
        let words = atomize_words_like(&thai, "ลลิตาไม่ได้ยกเลิก");
        assert!(words[1..].iter().all(|(_, glue)| *glue));
        let legacy = [("저", false), ("는", true)];
        assert_eq!(atomize_like(&legacy, "저는"), vec!["저", "는"]);
        assert_eq!(
            atomize_words_like(&legacy, "저는"),
            vec![("저".to_owned(), false), ("는".to_owned(), false)]
        );
        // Thai spans without markers (from before 0.5, or drafts built by phrase) are split by phrase, as before.
        let phrases = [("ลลิตาไม่ได้", false)];
        assert_eq!(
            atomize_like(&phrases, "ลลิตาไม่ได้ยกเลิก"),
            vec!["ลลิตาไม่ได้ยกเลิก"]
        );
    }

    /// Glue in old drafts: only seams that got no space before 0.5 but get one now carry a marker.
    #[test]
    fn legacy_glue_marks_exactly_the_seams_the_rule_change_would_open() {
        assert!(legacy_glue("저", "는"));
        assert!(legacy_glue("다—", "그"));
        assert!(legacy_glue("…", "네"));
        // Seams where the two rules give the same answer carry no marker.
        assert!(!legacy_glue("다.", "그")); // Both are 1
        assert!(!legacy_glue("iPhone", "을")); // Both are 1
        assert!(!legacy_glue("韓", "국")); // Both are 0
        assert!(!legacy_glue("「", "안")); // Both are 0
        assert!(!legacy_glue("你", "好"));
        assert!(!legacy_glue("hello", "world"));
        assert!(!legacy_glue("い", "い"));
        // With the marker attached, old syllable-level words join exactly as they did character by character before 0.5.
        let words = [
            "저", "는", "내", "일", "iPhone", "을", "샀", "다.", "그", "래", "요",
        ];
        let mut marked: Vec<(&str, bool)> = Vec::new();
        let mut legacy = String::new();
        for (index, word) in words.iter().enumerate() {
            let glue = index > 0 && legacy_glue(words[index - 1], word);
            if index > 0 && legacy_sep_len(&legacy, word) == 1 {
                legacy.push(' ');
            }
            legacy.push_str(word);
            marked.push((word, glue));
        }
        assert_eq!(legacy, "저는내일 iPhone 을샀다. 그래요");
        assert_eq!(join_word_texts(marked), legacy);
    }

    #[test]
    fn word_count_matches_atomize_across_scripts() {
        // Pure English: counted by word.
        assert_eq!(
            word_count("alpha bravo charlie delta echo, foxtrot golf hotel."),
            8
        );
        // Pure Chinese: counted character by character, and the sentence-final punctuation attaches to the preceding atom.
        assert_eq!(word_count("你好，世界。"), 4);
        // Mixed Chinese and English.
        assert_eq!(word_count("他用 Agent 来做"), 5);
        // Digits and cohesive punctuation are not split apart.
        assert_eq!(word_count("3.14 U.S. don't state-of-the-art a.com"), 5);
        assert_eq!(word_count(""), 0);
    }

    #[test]
    fn word_count_exposes_cjk_information_density() {
        // With the same character count, CJK has far more words than Latin. This is exactly why budgeting pages by characters is unfair between the two languages.
        let zh = "人工智能正在改变视频剪辑的工作方式。";
        let en = "we ship fast video";
        assert_eq!(zh.chars().count(), en.chars().count());
        assert_eq!(word_count(zh), 17);
        assert_eq!(word_count(en), 4);
        assert!(word_count(zh) > word_count(en) * 3);
    }

    #[test]
    fn atomize_is_lossless_for_non_whitespace() {
        let input = "Hello, 世界! $100 (test) …";
        let atoms = atomize(input);
        let joined: String = atoms.concat();
        let expected: String = input.chars().filter(|ch| !ch.is_whitespace()).collect();
        assert_eq!(joined, expected);
    }

    #[test]
    fn sep_len_and_join_respect_cjk_adjacency() {
        assert_eq!(sep_len("你", "好"), 0);
        assert_eq!(sep_len("hello", "world"), 1);
        assert_eq!(sep_len("好，", "世"), 0);
        assert_eq!(
            join_word_texts(["他", "用", "Agent", "来", "做"]),
            "他用 Agent 来做"
        );
        // Full-width punctuation carries its own whitespace: it closes when either side matches (the single-side rule).
        assert_eq!(sep_len("Agent", "（"), 0);
        assert_eq!(sep_len("）", "Agent"), 0);
        assert_eq!(sep_len("名为「", "PluginDataJSON」"), 0);
        // A shared typographic mark closes only when the seam falls on its own content side: for an opening delimiter, look at the end of prev; for a closing delimiter, look at the start of next. The original reported case `名为“ | PluginDataJSON”` must give 0.
        assert_eq!(sep_len("名为“", "PluginDataJSON”"), 0);
        assert_eq!(sep_len("PluginDataJSON”", "的"), 0);
        assert_eq!(sep_len("他说", "“你好"), 0);
        // …but in a Latin context the same marks must keep their spaces (English is a real target language).
        assert_eq!(sep_len("said", "“Hello"), 1);
        assert_eq!(sep_len("students’", "books"), 1);
        assert_eq!(sep_len("so…", "yeah"), 1);
        assert_eq!(sep_len("dash—", "next"), 1);
        // Known trade-off: a closing quote outside followed by Latin cannot be told apart between Chinese and English contexts using two characters, so it takes 1, as English (the same as before this change).
        assert_eq!(sep_len("”", "Agent"), 1);
        // Full-width letters and digits are not punctuation, and are still treated as ordinary words.
        assert_eq!(sep_len("Ａ", "B"), 1);
        assert_eq!(sep_len("A", "１"), 1);
        // The opening/closing classification of shared typographic marks is checked against Unicode categories, not from memory: U+2018 Pi, U+201A Ps, U+201B Pi, U+201C Pi / U+2019 Pf, U+201D Pf / U+2014 Pd, U+2026 Po (neither of the last two is a delimiter, so only the two-sided rule applies).
        for ch in ['‘', '‚', '‛', '“'] {
            assert!(
                is_shared_typographic_mark(ch) && is_opening_delimiter(ch),
                "{ch}"
            );
        }
        for ch in ['’', '”'] {
            assert!(
                is_shared_typographic_mark(ch) && is_closing_delimiter(ch),
                "{ch}"
            );
        }
        for ch in ['—', '…'] {
            assert!(is_shared_typographic_mark(ch), "{ch}");
            assert!(
                !is_opening_delimiter(ch) && !is_closing_delimiter(ch),
                "{ch}"
            );
        }
        // Shared typographic marks are not in the full-width block, and full-width punctuation is not among the shared typographic marks (the two classes are mutually exclusive).
        assert!(!is_fullwidth_punctuation('“') && !is_fullwidth_punctuation('…'));
        assert!(is_fullwidth_punctuation('「') && !is_shared_typographic_mark('「'));
        assert!(!is_fullwidth_punctuation('Ａ') && !is_fullwidth_punctuation('１'));
        // For paired delimiters spanning Latin content, canonical must equal the original text character for character.
        assert_eq!(
            join_word_texts(["包", "含", "名为“", "PluginDataJSON”的", "清", "单"]),
            "包含名为“PluginDataJSON”的清单"
        );
        // A round trip of a whole English quotation must be lossless, character for character. (If tier 3 degraded into the single-side rule, this would collapse to `said“Hello world”today`.)
        assert_eq!(
            join_word_texts(["said", "“Hello", "world”", "today"]),
            "said “Hello world” today"
        );
    }

    #[test]
    fn width_and_cps_metrics_differ() {
        assert_eq!(visual_width("你好ab"), 6);
        assert_eq!(count_cps_chars("你好 ab"), 4);
    }

    #[test]
    fn normalize_strips_punct_and_lowercases() {
        assert_eq!(normalize_chars("Hi, 你好!"), "hi你好");
        assert_eq!(atom_key("…"), None);
        assert_eq!(atom_key("Hi,"), Some("hi".to_owned()));
    }

    #[test]
    fn similarity_matches_reference_cases() {
        assert_eq!(
            edit_distance(
                &"kitten".chars().collect::<Vec<_>>(),
                &"sitting".chars().collect::<Vec<_>>()
            ),
            3
        );
        assert_eq!(similarity("Hello, WORLD!", "hello world"), 1.0);
        assert_eq!(similarity("...", ""), 1.0);
        assert!(similarity("hello", "完全不同") < 0.3);
    }

    #[test]
    fn sentence_end_rejects_abbreviations_and_interior_dots() {
        assert!(sentence_end("ready."));
        assert!(sentence_end("好。"));
        assert!(sentence_end("done.\""));
        assert!(!sentence_end("2.14"));
        assert!(!sentence_end("agents.md"));
        assert!(!sentence_end("Dr."));
        assert!(!sentence_end("e.g."));
        assert!(!sentence_end("hello,"));
        assert_eq!(clause_end_char("hello,"), Some(','));
        assert_eq!(clause_end_char("wait—"), Some('—'));
        assert_eq!(clause_end_char("said,\""), Some(','));
        assert_eq!(clause_end_char("plain"), None);
        assert!(ends_sentence("说完了。」"));
    }

    #[test]
    fn a_glued_word_joins_without_a_space_whatever_its_neighbours_are() {
        // Plain text has no markers, so the character rules apply.
        assert_eq!(join_word_texts(["hello", "world"]), "hello world");
        assert_eq!(word_sep("hello", "world"), 1);
        // A glued word sticks to the previous word. The concatenation, the separator width and the prefix length use the same convention in all three places.
        let words = [("hello", false), ("world", true), ("again", false)];
        assert_eq!(join_word_texts(words), "helloworld again");
        assert_eq!(word_sep("hello", &words[1]), 0);
        assert_eq!(word_sep("world", &words[2]), 1);
        assert_eq!(join_prefix_char_lens(words), vec![5, 10, 16]);
        // The first word's marker has no previous word to attach to.
        assert_eq!(join_word_texts([("hello", true)]), "hello");
        // Without a marker, it is identical character for character to plain text.
        let plain = ["他", "用", "Agent", "来", "做"];
        assert_eq!(
            join_word_texts(plain.map(|text| (text, false))),
            join_word_texts(plain)
        );
    }

    #[test]
    fn weights_match_voiceink_formulas() {
        assert_eq!(w_weight("a"), 3.4); // max(2,1)+1.4
        assert_eq!(w_weight("hello"), 6.4);
        assert_eq!(w_weight("don't"), 6.4); // 5 semantic chars (including ')
        assert_eq!(correction_timing_weight("…"), 1.0);
        assert_eq!(correction_timing_weight("came"), 4.0);
    }
}
