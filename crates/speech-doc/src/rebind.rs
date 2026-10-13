//! Rebind: writes the corrected text back into the word range. Words matched by LCS keep their id/t0/t1 unchanged, and new tokens are interpolated within the gap by character weight (cross-checked against voice-ink `TranscriptRebinding` + `SubAlign.rebindCorrected`).
//!
//! This is the foundation of the incremental system: a small-scope polish only changes the ids of the words it touched, so segmentation (keyed by id) doesn't go stale, and translation (keyed by group text fingerprint) only goes stale for the groups that were touched.

use crate::atomize::{
    atomize_words_like, correction_timing_weight, is_legacy_glued, is_script_glued, legacy_glue,
};
use crate::doc::Word;
use crate::timing::{normalize_doc_words, r2};

/// Source of new word ids. voice-ink's `uid()` uses wall-clock milliseconds plus a process-level counter (the only non-deterministic factor), so here it is made injectable to allow golden-lock testing.
pub trait IdSource {
    fn next_id(&mut self) -> String;
}

/// Production implementation: `w<base36 milliseconds>-<n>`.
pub struct WallClockIds {
    counter: usize,
}

impl WallClockIds {
    pub fn new() -> Self {
        Self { counter: 0 }
    }
}

impl Default for WallClockIds {
    fn default() -> Self {
        Self::new()
    }
}

impl IdSource for WallClockIds {
    fn next_id(&mut self) -> String {
        self.counter += 1;
        let ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        format!("w{}-{}", base36(ms), self.counter)
    }
}

/// Test implementation: `w0-1, w0-2, …`.
#[derive(Default)]
pub struct SeqIds {
    counter: usize,
}

impl IdSource for SeqIds {
    fn next_id(&mut self) -> String {
        self.counter += 1;
        format!("w0-{}", self.counter)
    }
}

fn base36(mut value: u64) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if value == 0 {
        return "0".to_owned();
    }
    let mut output = Vec::new();
    while value > 0 {
        output.push(DIGITS[(value % 36) as usize]);
        value /= 36;
    }
    output.reverse();
    String::from_utf8(output).expect("ascii")
}

/// Cell limit for the word-level LCS table in rebind (beyond it, the degenerate path of spreading all weight evenly is taken).
const REBIND_TABLE_CAP: usize = 4_000_000;

fn tokenize(text: &str) -> Vec<String> {
    text.split_whitespace().map(str::to_owned).collect()
}

/// Write `new_text` (split on whitespace) back into the `old_words` range.
///
/// `sp` is only a **fallback** speaker: new tokens always inherit the `sp` of their LCS neighbours (the preceding retained word, then the following retained word), and it is used only when no word in the range was retained.
pub fn rebind(old_words: &[Word], new_text: &str, sp: &str, ids: &mut dyn IdSource) -> Vec<Word> {
    let tokens = tokenize(new_text)
        .into_iter()
        .map(|token| (token, false))
        .collect();
    rebind_tokens(old_words, tokens, false, sp, ids)
}

/// Entry point for polish/segment write-back: re-tokenize uniformly with lossless atomize. Latin must also go through the same atomizer, otherwise no-space strong punctuation like `matters—the` would be fused by the whitespace tokenizer into one word, and later translation alignment could not express the real semantic boundary `matters— | the part`. Unchanged characters still keep their original id and timing via LCS.
///
/// Granularity follows the range ([`crate::atomize::atomize_like`]): Korean is split into words by 어절 (eojeol). A Korean range from before 0.5 (where words carry the "glued-front" marker) keeps per-syllable splitting, so that unchanged syllables keep their id and timing. For the latter kind of range, after the range is written back to the transcript, [`reglue_legacy_span`] must be called to add markers to the new words.
///
/// Speaker: a sentence range occasionally crosses speakers (a ⏹ forced boundary can't be moved and degrades to snapping to the sentence start; or the range starts with an interjection from the other party that the model deleted). So the new token's `sp` must **not** take `span[0].sp`. That would label every punctuated character in an S2 sentence ("啊，" "的，" "吗？") as S1, which in the UI shows as two speakers alternating character by character. Instead, it inherits from the LCS neighbours.
pub fn rebind_corrected(span: &[Word], corrected: &str, ids: &mut dyn IdSource) -> Vec<Word> {
    if span.is_empty() {
        return Vec::new();
    }
    let sp = span[0].sp.clone();
    let tokens = atomize_words_like(span, corrected);
    if !tokens.is_empty() {
        // For ranges split by word, such as Thai: the “glued-front” marker follows the rewritten text (retained words also take the marker from the new text), and the first word keeps its relationship to the word before the range. Atoms in other ranges carry no marker, and the result is the same as before; old Korean per-syllable ranges are re-marked by the caller.
        let adopt = !is_legacy_span(span) && span.iter().any(is_script_glued);
        let mut words = rebind_tokens(span, tokens, adopt, &sp, ids);
        if adopt && let Some(first) = words.first_mut() {
            first.glue = span[0].glue;
        }
        return words;
    }
    rebind(span, corrected, &sp, ids)
}

/// Whether the range is Korean per-syllable text from before 0.5 (some word is [`is_legacy_glued`]). For such a range, when rewritten, new words keep per-syllable splitting ([`rebind_corrected`]), and after write-back [`reglue_legacy_span`] must be called. Thai-style "glued-front" words split by word do not count: their markers come from the original text having no whitespace, and re-marking them under the old rules would clear them all and print spaces between words.
pub fn is_legacy_span(span: &[Word]) -> bool {
    span.iter().any(is_legacy_glued)
}

/// After a per-syllable old range is rewritten, re-mark its glue using the old concatenation rule: `range` is the position of the rewritten result within `words`. Every word in the range, plus the words after the range up to the first visible word, are re-judged with [`legacy_glue`]. This is the same rule used when marking old transcripts when reading them ([`crate::doc::mark_legacy_glue`]): a visible word is glued to the nearest visible word before it, and a hidden word is glued to the word immediately before it.
///
/// Markers in such a range were originally derived by this rule, so re-judging loses no information, and re-judged results for unchanged words stay the same. The display is character-for-character identical to the result of rewriting the same text before 0.5. Spaces written by the model or the user never appear in such a transcript; to get spaces back, the transcript must be re-transcribed.
///
/// The old rule only marks the Hangul side, so a marker on a word containing no Hangul can only be one applied when splitting by word, as with Thai ([`is_script_glued`]). It is left as-is and not cleared by the old rule.
pub fn reglue_legacy_span(
    words: &mut [Word],
    range: std::ops::Range<usize>,
    hidden: &std::collections::BTreeMap<String, bool>,
) {
    let is_hidden = |word: &Word| hidden.get(&word.id).copied().unwrap_or(false);
    let mut index = range.start;
    while index < words.len() {
        let word_hidden = is_hidden(&words[index]);
        let against = if word_hidden {
            index.checked_sub(1)
        } else {
            (0..index).rev().find(|&before| !is_hidden(&words[before]))
        };
        if !is_script_glued(&words[index]) {
            words[index].glue =
                against.is_some_and(|before| legacy_glue(&words[before].text, &words[index].text));
        }
        if index >= range.end && !word_hidden {
            break;
        }
        index += 1;
    }
}

/// The speaker with the most words in the range (ties go to whoever appears first); `None` for an empty range.
fn majority_speaker(words: &[Word]) -> Option<&str> {
    let mut counts: Vec<(&str, usize)> = Vec::new();
    for word in words {
        match counts.iter_mut().find(|(sp, _)| *sp == word.sp) {
            Some((_, count)) => *count += 1,
            None => counts.push((word.sp.as_str(), 1)),
        }
    }
    // `max_by` takes the last of tied items; after reversing, the one taken is the one that appears first in the original order.
    counts
        .into_iter()
        .rev()
        .max_by(|left, right| left.1.cmp(&right.1))
        .map(|(sp, _)| sp)
}

/// `tokens` are `(text, glued-front)`. New words take their token's marker. When `adopt_glue` is true, retained old words also take the marker of their corresponding token; otherwise they keep their own.
fn rebind_tokens(
    old_words: &[Word],
    tokens: Vec<(String, bool)>,
    adopt_glue: bool,
    sp: &str,
    ids: &mut dyn IdSource,
) -> Vec<Word> {
    let keep = |word: &Word, token: &(String, bool)| {
        let mut word = word.clone();
        if adopt_glue {
            word.glue = token.1;
        }
        word
    };
    let range_start = old_words.first().map_or(0.0, |word| word.t0);
    let range_end = old_words.last().map_or(range_start + 0.5, |word| word.t1);

    let mut prefix = 0;
    while prefix < old_words.len()
        && prefix < tokens.len()
        && old_words[prefix].text == tokens[prefix].0
    {
        prefix += 1;
    }
    let mut suffix = 0;
    while suffix < old_words.len() - prefix
        && suffix < tokens.len() - prefix
        && old_words[old_words.len() - 1 - suffix].text == tokens[tokens.len() - 1 - suffix].0
    {
        suffix += 1;
    }
    let changed_words = &old_words[prefix..old_words.len() - suffix];
    let changed_tokens = &tokens[prefix..tokens.len() - suffix];
    let old_count = changed_words.len();
    let new_count = changed_tokens.len();

    let table_rows = old_count + 1;
    let table_columns = new_count + 1;
    if table_rows > REBIND_TABLE_CAP / table_columns {
        // Degenerate path: all tokens are spread evenly over the old range by weight, and no old id is kept. The speaker is the one with the most words in the range (ties go to whoever appears first), not span[0].
        let sp = majority_speaker(old_words).unwrap_or(sp);
        let weights: Vec<f64> = tokens
            .iter()
            .map(|(token, _)| correction_timing_weight(token))
            .collect();
        let total: f64 = weights.iter().sum::<f64>().max(1e-9);
        let span = (0.02 * tokens.len() as f64).max(range_end - range_start);
        let mut accumulated = 0.0;
        let mut output = Vec::with_capacity(tokens.len());
        for (index, (token, glue)) in tokens.into_iter().enumerate() {
            let token_start = range_start + span * (accumulated / total);
            accumulated += weights[index];
            output.push(Word {
                id: ids.next_id(),
                t0: r2(token_start),
                t1: r2(range_start + span * (accumulated / total)),
                text: token,
                sp: sp.to_owned(),
                glue,
            });
        }
        normalize_doc_words(&mut output, range_start, range_end);
        return output;
    }

    // Word-level LCS (exact text equality), filling the table in reverse.
    let stride = table_columns;
    let mut table = vec![0_i32; table_rows * stride];
    if old_count > 0 && new_count > 0 {
        for old_index in (0..old_count).rev() {
            for new_index in (0..new_count).rev() {
                table[old_index * stride + new_index] =
                    if changed_words[old_index].text == changed_tokens[new_index].0 {
                        table[(old_index + 1) * stride + new_index + 1] + 1
                    } else {
                        table[(old_index + 1) * stride + new_index]
                            .max(table[old_index * stride + new_index + 1])
                    };
            }
        }
    }

    let mut output: Vec<Word> = Vec::new();
    let mut pending: Vec<(String, bool)> = Vec::new();
    let mut gap_start = old_words.first().map_or(0.0, |word| word.t0);
    // Speaker of a new token: the preceding retained word > the following retained word (the anchor at flush time) > fallback.
    let mut last_kept_sp: Option<String> = None;

    macro_rules! flush {
        ($gap_end:expr, $next_sp:expr) => {{
            let gap_end: f64 = $gap_end;
            let next_sp: Option<&str> = $next_sp;
            let inherited: String = last_kept_sp.as_deref().or(next_sp).unwrap_or(sp).to_owned();
            if !pending.is_empty() {
                let weights: Vec<f64> = pending
                    .iter()
                    .map(|(token, _)| correction_timing_weight(token))
                    .collect();
                let total: f64 = weights.iter().sum::<f64>().max(1e-9);
                let span = (0.02 * pending.len() as f64).max(gap_end - gap_start);
                let mut accumulated = 0.0;
                for (index, (token, glue)) in pending.drain(..).enumerate() {
                    let token_start = gap_start + span * (accumulated / total);
                    accumulated += weights[index];
                    output.push(Word {
                        id: ids.next_id(),
                        t0: r2(token_start),
                        t1: r2(gap_end
                            .max(token_start)
                            .min(gap_start + span * (accumulated / total))),
                        text: token,
                        sp: inherited.clone(),
                        glue,
                    });
                }
            }
        }};
    }

    for (word, token) in old_words[..prefix].iter().zip(&tokens) {
        output.push(keep(word, token));
        gap_start = word.t1;
        last_kept_sp = Some(word.sp.clone());
    }
    let mut old_index = 0;
    let mut new_index = 0;
    while old_index < old_count && new_index < new_count {
        if changed_words[old_index].text == changed_tokens[new_index].0 {
            flush!(
                changed_words[old_index].t0,
                Some(changed_words[old_index].sp.as_str())
            );
            output.push(keep(&changed_words[old_index], &changed_tokens[new_index]));
            gap_start = changed_words[old_index].t1;
            last_kept_sp = Some(changed_words[old_index].sp.clone());
            old_index += 1;
            new_index += 1;
        } else if table[(old_index + 1) * stride + new_index]
            >= table[old_index * stride + new_index + 1]
        {
            old_index += 1;
        } else {
            pending.push(changed_tokens[new_index].clone());
            new_index += 1;
        }
    }
    while new_index < new_count {
        pending.push(changed_tokens[new_index].clone());
        new_index += 1;
    }
    for (word, token) in old_words[old_words.len() - suffix..]
        .iter()
        .zip(&tokens[tokens.len() - suffix..])
    {
        flush!(word.t0, Some(word.sp.as_str()));
        output.push(keep(word, token));
        gap_start = word.t1;
        last_kept_sp = Some(word.sp.clone());
    }
    let final_end = old_words.last().map_or(gap_start + 0.5, |word| word.t1);
    flush!(final_end, None);
    normalize_doc_words(&mut output, range_start, range_end);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

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

    /// Korean transcripts from 0.5 onward have one 어절 (eojeol) per word: after rewriting, new words are also split by 어절, with spaces between words as usual.
    #[test]
    fn korean_rebind_forms_words_at_spaces() {
        let old = vec![
            word("g1.0", 0.0, 0.5, "저는"),
            word("g1.1", 0.5, 1.0, "내일"),
            word("g1.2", 1.0, 2.0, "아이폰을"),
            word("g1.3", 2.0, 2.5, "샀다."),
        ];
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, "저는 어제 아이폰을 샀습니다.", &mut ids);
        let texts: Vec<&str> = out.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, ["저는", "어제", "아이폰을", "샀습니다."]);
        assert_eq!(out[0].id, "g1.0");
        assert_eq!(out[2].id, "g1.2");
        assert!(out.iter().all(|word| !word.glue));
        assert_eq!(
            crate::atomize::join_word_texts(out.iter()),
            "저는 어제 아이폰을 샀습니다."
        );
    }

    fn glued(id: &str, t0: f64, t1: f64, text: &str, glue: bool) -> Word {
        Word {
            glue,
            ..word(id, t0, t1, text)
        }
    }

    /// A Thai range split by word is not an old Korean range: after rewriting, new words are split by word and carry markers, and unchanged words keep their id and timing. Concatenated, the result equals the rewritten text (no spaces are printed between words).
    #[test]
    fn a_thai_word_span_keeps_its_glue_through_a_rewrite() {
        let text = "ลลิตาไม่ได้ยกเลิก การประชุม";
        let atoms = crate::atomize::atomize_words(text);
        assert!(atoms.len() >= 4, "{atoms:?}");
        let old: Vec<Word> = atoms
            .iter()
            .enumerate()
            .map(|(index, (atom, glue))| {
                glued(
                    &format!("g1.{index}"),
                    index as f64,
                    index as f64 + 1.0,
                    atom,
                    *glue,
                )
            })
            .collect();
        assert!(!is_legacy_span(&old));
        let mut ids = SeqIds::default();
        let same = rebind_corrected(&old, text, &mut ids);
        assert_eq!(
            same, old,
            "an unchanged sentence keeps every word as it was"
        );

        let edited = rebind_corrected(&old, "ลลิตาไม่ได้ยกเลิกการประชุมนี้", &mut ids);
        assert_eq!(
            crate::atomize::join_word_texts(edited.iter()),
            "ลลิตาไม่ได้ยกเลิกการประชุมนี้"
        );
        assert_eq!(edited[0].id, "g1.0");
        assert!(!edited[0].glue);
        assert!(edited[1..].iter().all(|word| word.glue));

        // The range starts mid-phrase: the first word stays glued to the word before the range.
        let tail = &old[1..3];
        let tail_text = crate::atomize::join_word_texts(tail.iter());
        let rebound = rebind_corrected(tail, &format!("{tail_text}นี้"), &mut ids);
        assert!(rebound[0].glue);
        assert_eq!(rebound[0].id, tail[0].id);

        // For a range starting mid-phrase whose text is unchanged, every word is kept as-is (re-splitting this segment on its own would change the split; see `atomize_words_anchored`).
        for start in 0..old.len() {
            for end in start + 1..=old.len() {
                let span = &old[start..end];
                let span_text = crate::atomize::join_word_texts(span.iter());
                assert_eq!(rebind_corrected(span, &span_text, &mut ids), span);
            }
        }

        // The old re-marking rule only touches Hangul words: Thai markers are left alone. Korean words from 0.5 mixed into the same transcript are not glued by the old rule either, because such a range does not count as an old per-syllable transcript at all.
        let mut reglued = old.clone();
        let len = reglued.len();
        reglue_legacy_span(&mut reglued, 0..len, &Default::default());
        assert_eq!(reglued, old);
        let mut mixed = old.clone();
        mixed.push(glued("k1", 9.0, 10.0, "안녕", false));
        mixed.push(glued("k2", 10.0, 11.0, "하세요", false));
        assert!(!is_legacy_span(&mixed));
    }

    /// Polish added a space outside Thai quotation marks (the answer from an actual sandbox run): the quotes stay attached to words rather than forming a standalone pure-punctuation word; unchanged words at the start keep their id; concatenated, the result equals the rewritten text.
    #[test]
    fn a_space_added_outside_a_thai_quote_keeps_the_quote_on_a_word() {
        let source = "รหัสF-07ปรากฏข้างคำว่า“ยืนยันแล้ว”แต่ยังไม่ได้ส่งพัสดุ";
        let old: Vec<Word> = crate::atomize::atomize_words(source)
            .iter()
            .enumerate()
            .map(|(index, (atom, glue))| {
                glued(
                    &format!("g5.{index}"),
                    index as f64,
                    index as f64 + 1.0,
                    atom,
                    *glue,
                )
            })
            .collect();
        let corrected = "รหัส F-07 ปรากฏข้างคำว่า “ยืนยันแล้ว” แต่ยังไม่ได้ส่งพัสดุ";
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, corrected, &mut ids);
        assert_eq!(crate::atomize::join_word_texts(out.iter()), corrected);
        assert!(
            out.iter()
                .all(|word| crate::atomize::atom_key(&word.text).is_some()),
            "{:?}",
            out.iter()
                .map(|word| word.text.as_str())
                .collect::<Vec<_>>()
        );
        assert!(out.iter().any(|word| word.text.starts_with('“')));
        assert_eq!(out[0].id, old[0].id);
        assert_eq!(out.last().unwrap().id, old.last().unwrap().id);
    }

    /// A Korean per-syllable range from before 0.5 (words carry the "glued-front" marker): rewriting keeps per-syllable splitting, and unchanged syllables keep their id. After re-marking, reading it back gives text character-for-character identical to what the old rules concatenate. Spaces written by the model never enter this kind of transcript.
    #[test]
    fn a_legacy_korean_span_is_rewritten_per_syllable_and_stays_glued() {
        let mut old = vec![
            word("g1.0", 0.0, 0.5, "저"),
            word("g1.1", 0.5, 1.0, "는"),
            word("g1.2", 1.0, 1.5, "내"),
            word("g1.3", 1.5, 2.0, "일"),
            word("g1.4", 2.0, 2.5, "iPhone"),
            word("g1.5", 2.5, 3.0, "을"),
            word("g1.6", 3.0, 3.5, "샀"),
            word("g1.7", 3.5, 4.0, "다."),
        ];
        crate::doc::mark_legacy_glue(&mut old, &Default::default());
        assert!(is_legacy_span(&old));
        assert_eq!(
            crate::atomize::join_word_texts(old.iter()),
            "저는내일 iPhone 을샀다."
        );

        let mut ids = SeqIds::default();
        let mut out = rebind_corrected(&old, "저는 어제 iPhone을 샀다.", &mut ids);
        let texts: Vec<&str> = out.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, ["저", "는", "어", "제", "iPhone", "을", "샀", "다."]);
        assert_eq!(out[0].id, "g1.0");
        assert_eq!(out[1].id, "g1.1");
        assert_eq!(out[4].id, "g1.4");
        let len = out.len();
        reglue_legacy_span(&mut out, 0..len, &Default::default());
        assert_eq!(
            crate::atomize::join_word_texts(out.iter()),
            "저는어제 iPhone 을샀다."
        );
    }

    /// Re-marking uses the same rule as when reading old transcripts: a visible word is judged against the nearest visible word before it, and after the range judging continues up to the first visible word. The result for unchanged words stays the same.
    #[test]
    fn reglue_follows_the_visible_neighbour_and_reaches_the_next_visible_word() {
        let hidden: std::collections::BTreeMap<String, bool> =
            [("g1.2".to_owned(), true)].into_iter().collect();
        let mut words = vec![
            word("g1.0", 0.0, 0.5, "저"),
            word("g1.1", 0.5, 1.0, "는"),
            word("g1.2", 1.0, 1.5, "um"),
            word("g1.3", 1.5, 2.0, "내"),
            word("g1.4", 2.0, 2.5, "일"),
        ];
        crate::doc::mark_legacy_glue(&mut words, &hidden);
        let before: Vec<bool> = words.iter().map(|word| word.glue).collect();
        assert_eq!(before, [false, true, false, true, true]);
        // Re-judging the whole segment and re-judging only the first two words both give the same result as on read-in.
        let mut all = words.clone();
        reglue_legacy_span(&mut all, 0..5, &hidden);
        assert_eq!(all, words);
        let mut head = words.clone();
        for word in &mut head {
            word.glue = false;
        }
        reglue_legacy_span(&mut head, 0..2, &hidden);
        let flags: Vec<bool> = head.iter().map(|word| word.glue).collect();
        assert_eq!(flags, [false, true, false, true, false]);
    }

    #[test]
    fn unchanged_words_keep_id_and_timing() {
        let old = vec![
            word("g1.0", 0.0, 0.4, "King"),
            word("g1.1", 0.4, 0.8, "Arthur"),
            word("g1.2", 0.8, 1.6, "Camelot,"),
            word("g1.3", 1.6, 2.0, "didn't"),
            word("g1.4", 2.0, 2.3, "he?"),
        ];
        let mut ids = SeqIds::default();
        let out = rebind(&old, "King Arthur Camelot, didn't he?", "s1", &mut ids);
        assert_eq!(out, old);
    }

    #[test]
    fn camelot_split_uses_semantic_weight_ratio() {
        // Camelot → came a lot occupies the original word window in a 4:1:3 ratio (voice-ink test case).
        let old = vec![
            word("w0", 0.0, 0.4, "King"),
            word("w1", 0.4, 0.8, "Arthur"),
            word("w2", 0.8, 1.6, "Camelot,"),
            word("w3", 1.6, 2.0, "didn't"),
            word("w4", 2.0, 2.3, "he?"),
        ];
        let mut ids = SeqIds::default();
        let out = rebind(&old, "King Arthur came a lot, didn't he?", "s1", &mut ids);
        assert_eq!(out.len(), 7);
        assert_eq!(out[0].id, "w0");
        assert_eq!(out[6].id, "w4");
        let came = &out[2];
        let a = &out[3];
        let lot = &out[4];
        assert_eq!((came.t0, came.t1), (0.8, 1.2));
        assert_eq!((a.t0, a.t1), (1.2, 1.3));
        assert_eq!((lot.t0, lot.t1), (1.3, 1.6));
        for pair in out.windows(2) {
            assert!(pair[0].t1 <= pair[1].t0 + 1e-9);
        }
    }

    #[test]
    fn empty_source_synthesizes_half_second_span() {
        let mut ids = SeqIds::default();
        let out = rebind(&[], "hello world", "s1", &mut ids);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].t0, 0.0);
        assert!((out[1].t1 - 0.5).abs() < 1e-9);
    }

    #[test]
    fn cjk_rebind_keeps_untouched_chars_and_coheres_latin() {
        let old: Vec<Word> = ["他", "用", "A", "进", "来", "做", "任", "务"]
            .iter()
            .enumerate()
            .map(|(i, t)| {
                word(
                    &format!("g1.0~{i}"),
                    i as f64 * 0.2,
                    (i + 1) as f64 * 0.2,
                    t,
                )
            })
            .collect();
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, "他用Agent来做任务。", &mut ids);
        let joined = crate::atomize::join_word_texts(out.iter());
        assert_eq!(joined, "他用 Agent 来做任务。");
        assert!(out.iter().any(|w| w.text == "Agent"));
        // Unchanged characters keep their original id
        assert_eq!(out[0].id, "g1.0~0");
        assert_eq!(out[1].id, "g1.0~1");
        let lai = out.iter().find(|w| w.text == "来").unwrap();
        assert_eq!(lai.id, "g1.0~4");
    }

    #[test]
    fn latin_rebind_splits_no_space_em_dash_boundary() {
        let old = vec![
            word("g1.0", 0.0, 0.5, "matters"),
            word("g1.1", 0.5, 1.0, "the"),
            word("g1.2", 1.0, 1.5, "part"),
        ];
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, "matters—the part", &mut ids);
        assert_eq!(
            out.iter()
                .map(|word| word.text.as_str())
                .collect::<Vec<_>>(),
            vec!["matters—", "the", "part"]
        );
        assert_ne!(out[0].text, "matters—the");
        assert_eq!(out[2].id, "g1.2");
    }

    fn spoken(id: &str, t0: f64, t1: f64, text: &str, sp: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: sp.to_owned(),
            glue: false,
        }
    }

    /// Regression lock (screenshot of a two-person interview, 2026-08): the sentence range starts with an interjection from the other party, “s1”, that the model deleted, while the body is all s2. Punctuated characters ("啊，" "的，" "吗？") are new tokens, and they must inherit the LCS neighbour's s2 rather than the s1 of `span[0]`. Otherwise s1/s2 alternate character by character in the UI.
    #[test]
    fn new_tokens_inherit_the_neighbouring_speaker_not_the_span_head() {
        let old = vec![
            spoken("g174.0", 719.41, 719.87, "呃", "s1"),
            spoken("g174.1", 719.87, 720.03, "很", "s2"),
            spoken("g174.2", 720.03, 720.04, "多", "s2"),
            spoken("g174.3", 720.04, 720.21, "啊", "s2"),
            spoken("g174.4", 720.21, 720.37, "打", "s2"),
            spoken("g174.5", 720.37, 721.06, "DOTA", "s2"),
            spoken("g174.6", 721.06, 721.30, "啊", "s2"),
            spoken("g174.7", 721.30, 721.39, "什", "s2"),
            spoken("g174.8", 721.39, 721.47, "么", "s2"),
            spoken("g174.9", 721.47, 721.56, "的", "s2"),
            spoken("g174.10", 721.56, 721.65, "就", "s2"),
        ];
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, "很多啊，打DOTA什么的，就", &mut ids);
        let joined: String = out.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(joined, "很多啊，打DOTA什么的，就");
        for word in &out {
            assert_eq!(word.sp, "s2", "{word:?}");
        }
        assert_eq!(out[0].id, "g174.1", "未改字保住原 id");
    }

    /// The range starts with a new token and there is no retained word before it ⇒ inherit the speaker of the following retained word.
    #[test]
    fn leading_new_tokens_inherit_the_next_kept_speaker() {
        let old = vec![
            spoken("a", 0.0, 0.3, "呃", "s1"),
            spoken("b", 0.3, 0.6, "对", "s2"),
            spoken("c", 0.6, 0.9, "的", "s2"),
        ];
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, "嗯，对的", &mut ids);
        assert_eq!(out[0].text, "嗯，");
        assert_eq!(out[0].sp, "s2");
        assert_eq!(out[1].id, "b");
    }

    /// Fall back to the speaker of `span[0]` only when no word was retained at all (fallback).
    #[test]
    fn fully_rewritten_span_falls_back_to_the_span_head_speaker() {
        let old = vec![
            spoken("a", 0.0, 0.3, "one", "s1"),
            spoken("b", 0.3, 0.6, "two", "s1"),
        ];
        let mut ids = SeqIds::default();
        let out = rebind_corrected(&old, "three four", &mut ids);
        assert!(out.iter().all(|word| word.sp == "s1"), "{out:?}");
    }
}
