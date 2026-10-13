//! Cue / Para derived projections (§18.5, normative algorithm).
//!
//! Subtitle lines and paragraphs are not written to disk. Any implementation must derive the same result from the same transcript.

use crate::doc::{BreakOverride, TranscriptDoc, Word};

/// Normative default parameters (§18.5).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CueParams {
    pub max_chars: usize,
    pub pause_sec: f64,
    /// Minimum line width for breaking at clause punctuation (commas).
    pub min_clause_chars: usize,
    pub min_pause_chars: usize,
    /// Minimum line width for breaking at dashes (interruptions and restarts), lower than the comma tier.
    pub min_dash_chars: usize,
    pub overflow_slack: usize,
    pub min_cue_display_sec: f64,
}

impl Default for CueParams {
    fn default() -> Self {
        Self {
            max_chars: 42,
            pause_sec: 0.6,
            min_clause_chars: 12,
            min_pause_chars: 20,
            min_dash_chars: 6,
            overflow_slack: 8,
            min_cue_display_sec: 1.0,
        }
    }
}

/// A derived subtitle line (conceptual, not persisted).
#[derive(Debug, Clone, PartialEq)]
pub struct Cue {
    /// `"q-" + first word id`. Stable across re-derivation as long as the first word does not change.
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub sp: String,
    /// Index back into `doc.words` (non-hidden words only).
    pub word_indices: Vec<usize>,
}

impl Cue {
    pub fn text(&self, doc: &TranscriptDoc) -> String {
        join_words(self.word_indices.iter().map(|&index| &doc.words[index]))
    }
}

/// Paragraph: grouped by (chapter × consecutive same speaker), then overlaid with the paraBreaks pins.
#[derive(Debug, Clone, PartialEq)]
pub struct Para {
    /// `"p-" + first word id`.
    pub id: String,
    pub sp: String,
    pub cue_indices: Vec<usize>,
}

/// Joins a word sequence into display text (no space between adjacent CJK characters).
pub fn join_words<'a, I: IntoIterator<Item = &'a Word>>(words: I) -> String {
    crate::atomize::join_word_texts(words)
}

/// Scans word boundaries for manual line splitting: maps a display-string character offset `target_chars` back to a word boundary.
///
/// The ruler matches [`join_words`] / `join_word_texts` exactly (`join_prefix_char_lens`). Do not add a fixed separator width per word. The return value is the index in `word_texts` of **the last word of line A** (in `0..len-1`; the `breaks` pin lands on that word). Returns `None` when there are fewer than two words.
///
/// Tie-breaking is fixed: take the boundary whose prefix length is nearest to `target_chars`; on a tie, take the earlier boundary.
pub fn split_boundary_at_char<W: crate::atomize::JoinWord>(
    word_texts: &[W],
    target_chars: usize,
) -> Option<usize> {
    if word_texts.len() < 2 {
        return None;
    }
    let prefixes = crate::atomize::join_prefix_char_lens(word_texts);
    let mut best: Option<(usize, usize)> = None;
    for (index, &prefix) in prefixes.iter().take(word_texts.len() - 1).enumerate() {
        let diff = prefix.abs_diff(target_chars);
        if best.is_none_or(|(_, best_diff)| diff < best_diff) {
            best = Some((index, diff));
        }
    }
    best.map(|(index, _)| index)
}

/// Punctuation-first line-break ladder (§18.5 conditions 3–6, matching the JS/Swift `autoBreak`): sentence end > clause punctuation (dashes have a lower threshold) > long pause > overflow. When it overflows and the next word ends in clause or sentence punctuation, with the total width not exceeding `maxChars + overflowSlack`, the punctuation is pulled in, to avoid a hard cut one character before it.
pub(crate) fn auto_break(word: &Word, next: &Word, line_chars: usize, params: &CueParams) -> bool {
    if crate::atomize::sentence_end(&word.text) {
        return true;
    }
    if let Some(punct) = crate::atomize::clause_end_char(&word.text) {
        let gate = if punct == '—' || punct == '–' {
            params.min_dash_chars
        } else {
            params.min_clause_chars
        };
        if line_chars >= gate {
            return true;
        }
    }
    if next.t0 - word.t1 >= params.pause_sec && line_chars >= params.min_pause_chars {
        return true;
    }
    let projected = line_chars
        + crate::atomize::word_sep(&word.text, next)
        + crate::atomize::visual_width(&next.text);
    if projected > params.max_chars {
        let imminent_punct = crate::atomize::clause_end_char(&next.text).is_some()
            || crate::atomize::sentence_end(&next.text);
        if imminent_punct && projected <= params.max_chars + params.overflow_slack {
            return false;
        }
        return true;
    }
    false
}

/// Cue derivation: scan the non-hidden words in order and apply the six line-break conditions of §18.5, from highest to lowest priority.
///
/// The pin table is [`TranscriptDoc::effective_breaks`]: `autoBreaks[layoutProfile]` is the base, and the user's `breaks` override the same key. Since 0.4, the optimizer's results and the user's intent are kept in separate tables.
pub fn derive_cues(doc: &TranscriptDoc, params: &CueParams) -> Vec<Cue> {
    let mut cues: Vec<Cue> = Vec::new();
    let mut current: Vec<usize> = Vec::new();
    let mut current_chars = 0_usize;
    let pins = doc.effective_breaks(doc.layout_profile_id());

    let visible: Vec<usize> = (0..doc.words.len())
        .filter(|index| !doc.words[*index].id.is_empty())
        .filter(|index| {
            !doc.hidden
                .get(&doc.words[*index].id)
                .copied()
                .unwrap_or(false)
        })
        .collect();

    let flush = |cues: &mut Vec<Cue>, current: &mut Vec<usize>| {
        if current.is_empty() {
            return;
        }
        let first = &doc.words[current[0]];
        let last = &doc.words[*current.last().expect("non-empty")];
        cues.push(Cue {
            id: format!("q-{}", first.id),
            start: first.t0,
            end: last.t1,
            sp: first.sp.clone(),
            word_indices: std::mem::take(current),
        });
    };

    for (position, &index) in visible.iter().enumerate() {
        let word = &doc.words[index];
        // paraBreaks pins before a word. If that word falls inside an open Cue, the Cue must be closed first. Otherwise derive_paras only sees the Cue's first word, and the paragraph pin would have data but never take effect.
        if !current.is_empty() && doc.para_breaks.get(&word.id).copied().unwrap_or(false) {
            flush(&mut cues, &mut current);
            current_chars = 0;
        }
        if let Some(&previous) = current.last() {
            current_chars += crate::atomize::word_sep(&doc.words[previous].text, word);
        }
        current.push(index);
        current_chars += crate::atomize::visual_width(&word.text);

        let next = visible.get(position + 1).map(|&next| &doc.words[next]);
        let Some(next) = next else {
            flush(&mut cues, &mut current);
            break;
        };

        // Priority: speaker switch (not suppressible) > manual break/nobreak > automatic ladder.
        // A sentence end must close a Cue (a Sentence is aggregated from complete Cues). Only an explicit nobreak can suppress it.
        let break_now = if next.sp != word.sp {
            true
        } else {
            match pins.get(&word.id).copied() {
                Some(BreakOverride::Break) => true,
                Some(BreakOverride::Nobreak) => false,
                None => auto_break(word, next, current_chars, params),
            }
        };
        if break_now {
            flush(&mut cues, &mut current);
            current_chars = 0;
        }
    }
    cues
}

/// Para derivation: (chapter × consecutive same speaker) grouping, plus the paraBreaks pins.
pub fn derive_paras(doc: &TranscriptDoc, cues: &[Cue]) -> Vec<Para> {
    let mut paras: Vec<Para> = Vec::new();
    let mut current: Vec<usize> = Vec::new();

    let chapter_of = |t: f64| -> usize {
        doc.chapters
            .iter()
            .position(|chapter| t >= chapter.start && t < chapter.end)
            .unwrap_or(usize::MAX)
    };

    let flush = |paras: &mut Vec<Para>, current: &mut Vec<usize>| {
        if current.is_empty() {
            return;
        }
        let first_cue = &cues[current[0]];
        let first_word_id = first_cue.id.trim_start_matches("q-");
        paras.push(Para {
            id: format!("p-{first_word_id}"),
            sp: first_cue.sp.clone(),
            cue_indices: std::mem::take(current),
        });
    };

    for (index, cue) in cues.iter().enumerate() {
        // A paraBreaks pin before a word starts a new paragraph. If a Cue's first word is pinned, that Cue starts a new paragraph.
        let first_word = &doc.words[cue.word_indices[0]];
        let pinned = doc
            .para_breaks
            .get(&first_word.id)
            .copied()
            .unwrap_or(false);
        if !current.is_empty() {
            let previous = &cues[*current.last().expect("non-empty")];
            let speaker_changed = previous.sp != cue.sp;
            let chapter_changed = chapter_of(previous.start) != chapter_of(cue.start);
            if pinned || speaker_changed || chapter_changed {
                flush(&mut paras, &mut current);
            }
        }
        current.push(index);
    }
    flush(&mut paras, &mut current);
    paras
}

/// Default character limit for a 「short interjection」 paragraph (counted as `join_words` characters in the display measure).
pub const SHORT_INTERJECTION_MAX_CHARS: usize = 10;
/// Default duration limit for a 「short interjection」 paragraph (seconds).
pub const SHORT_INTERJECTION_MAX_SECONDS: f64 = 3.0;

/// Short-interjection paragraph: a paragraph between two paragraphs of the **same speaker**, whose own speaker is different, whose text is no more than `max_chars` characters, and whose duration is no more than `max_seconds` seconds (acknowledgements such as “mm.”, “oh.”, “right.”). Returns their indices in `paras`, in ascending order.
///
/// This is an **observation measure** only and does not change derivation. The §18.5 Para still groups by (chapter × consecutive same speaker), so every speaker change starts a new paragraph. In a measured multi-person interview, 1284 of 1965 paragraphs were such interjections (369 × 「嗯。」, median 8 characters and 0.95 s). The polish envelope reports this count so the UI can choose to fold or inline them. The derivation logic of the four platform implementations is not changed (decision of 2026-08).
pub fn short_interjection_paragraphs(
    doc: &TranscriptDoc,
    cues: &[Cue],
    paras: &[Para],
    max_chars: usize,
    max_seconds: f64,
) -> Vec<usize> {
    let mut found = Vec::new();
    for index in 1..paras.len().saturating_sub(1) {
        let (prev, this, next) = (&paras[index - 1], &paras[index], &paras[index + 1]);
        if prev.sp != next.sp || this.sp == prev.sp {
            continue;
        }
        let Some(&first) = this.cue_indices.first() else {
            continue;
        };
        let Some(&last) = this.cue_indices.last() else {
            continue;
        };
        let duration = cues[last].end - cues[first].start;
        if duration > max_seconds {
            continue;
        }
        let chars: usize = this
            .cue_indices
            .iter()
            .map(|&cue| cues[cue].text(doc).chars().count())
            .sum();
        if chars <= max_chars {
            found.push(index);
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr_rows::RowIn;
    use crate::build::build_doc;
    use crate::doc::{DocEngine, DocMedia, Word};
    use serde_json::{Value, json};

    fn doc_from_rows(rows: &[RowIn]) -> TranscriptDoc {
        build_doc(
            rows,
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 1000.0,
                sample_rate: None,
            },
            "zh",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    #[test]
    fn split_boundary_uses_the_join_ruler_and_breaks_ties_toward_the_earlier_boundary() {
        // Prefix length is measured with join_word_texts: no space between adjacent CJK characters.
        assert_eq!(
            crate::atomize::join_prefix_char_lens(["我", "用", "CucCut", "剪"]),
            vec![1, 2, 9, 11]
        );
        // On a tie, take the earlier boundary. With prefixes [2, 4, 7] and target 3, the target is equidistant from the first two boundaries.
        assert_eq!(split_boundary_at_char(&["ab", "c", "de"], 3), Some(0));
        // Not a tie: take the nearest boundary.
        assert_eq!(split_boundary_at_char(&["ab", "c", "de"], 4), Some(1));
        // The boundary after the last word does not count (splitting after the last word is no split). Fewer than two words cannot be split.
        assert_eq!(split_boundary_at_char(&["ab", "c", "de"], 99), Some(1));
        assert_eq!(split_boundary_at_char(&["ab"], 0), None);
        assert_eq!(split_boundary_at_char::<&str>(&[], 0), None);
    }

    #[test]
    fn speaker_switch_always_breaks() {
        let mut row_a = RowIn::new(0.0, 2.0, "你好");
        row_a.speaker = Some("A".to_owned());
        let mut row_b = RowIn::new(2.0, 4.0, "再见");
        row_b.speaker = Some("B".to_owned());
        let doc = doc_from_rows(&[row_a, row_b]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_ne!(cues[0].sp, cues[1].sp);
    }

    #[test]
    fn clause_punctuation_breaks_after_min_chars() {
        let text = "今天我们来聊一聊这个产品的设计。然后再看看它的实现细节究竟如何。";
        let doc = doc_from_rows(&[RowIn::new(0.0, 10.0, text)]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert!(cues[0].text(&doc).ends_with("。"));
    }

    #[test]
    fn short_sentence_end_still_closes_before_the_next_sentence() {
        // Regression test for the real failure shape: the previous display Cue was already broken by overflow before "take", leaving "their job." very short. The period must still close the Cue, and the next sentence "Maybe…" must not be swallowed into the same Cue or Sentence.
        let doc = doc_from_rows(&[RowIn::new(
            0.0,
            5.0,
            "take their job. Maybe they use a new tool.",
        )]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text(&doc), "take their job.");
        assert_eq!(cues[1].text(&doc), "Maybe they use a new tool.");
    }

    #[test]
    fn manual_break_and_nobreak_overrides_apply() {
        let doc = {
            let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "一二三四五")]);
            doc.breaks.insert("g1.0~1".to_owned(), BreakOverride::Break);
            doc
        };
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text(&doc), "一二");
        assert_eq!(cues[1].id, "q-g1.0~2");
    }

    fn auto_pin(doc: &mut TranscriptDoc, profile: &str, id: &str, value: BreakOverride) {
        doc.auto_breaks
            .entry(profile.to_owned())
            .or_default()
            .insert(id.to_owned(), value);
    }

    /// The automatic pins of `autoBreaks[default]` take part in derivation just like the user's `breaks`.
    #[test]
    fn auto_pins_apply_when_no_user_pin_covers_the_same_word() {
        let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "一二三四五")]);
        auto_pin(&mut doc, "default", "g1.0~1", BreakOverride::Break);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text(&doc), "一二");
        assert_eq!(cues[1].id, "q-g1.0~2");
    }

    /// On the same key the user's `breaks` win: a user nobreak overrides an automatic break, and a user break overrides an automatic nobreak.
    #[test]
    fn user_pins_override_auto_pins_on_the_same_word() {
        let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "一二三四五")]);
        auto_pin(&mut doc, "default", "g1.0~1", BreakOverride::Break);
        doc.breaks
            .insert("g1.0~1".to_owned(), BreakOverride::Nobreak);
        assert_eq!(derive_cues(&doc, &CueParams::default()).len(), 1);

        // Only nobreak can suppress the sentence-end close. An automatic nobreak is just as effective, but a user break overrides it.
        let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "今天聊设计。再看实现。")]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        let seam = doc.words[cues[0].word_indices[cues[0].word_indices.len() - 1]]
            .id
            .clone();
        auto_pin(&mut doc, "default", &seam, BreakOverride::Nobreak);
        assert_eq!(derive_cues(&doc, &CueParams::default()).len(), 1);
        doc.breaks.insert(seam, BreakOverride::Break);
        assert_eq!(derive_cues(&doc, &CueParams::default()).len(), 2);
    }

    /// A speaker switch cannot be suppressed: neither a user nobreak nor an automatic one can stop it.
    #[test]
    fn nobreak_pins_still_cannot_suppress_a_speaker_change() {
        let mut row_a = RowIn::new(0.0, 2.0, "你好");
        row_a.speaker = Some("A".to_owned());
        let mut row_b = RowIn::new(2.0, 4.0, "再见");
        row_b.speaker = Some("B".to_owned());
        let mut doc = doc_from_rows(&[row_a, row_b]);
        let seam = doc.words[0].id.clone();
        doc.breaks.insert(seam.clone(), BreakOverride::Nobreak);
        auto_pin(&mut doc, "default", &seam, BreakOverride::Nobreak);
        assert_eq!(derive_cues(&doc, &CueParams::default()).len(), 2);
    }

    /// When the document points to an unknown or other profile, only user pins take effect.
    #[test]
    fn unknown_layout_profile_falls_back_to_user_pins_only() {
        let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "一二三四五")]);
        auto_pin(&mut doc, "default", "g1.0~1", BreakOverride::Break);
        doc.layout_profile = Some("portrait".to_owned());
        assert_eq!(derive_cues(&doc, &CueParams::default()).len(), 1);
        doc.breaks.insert("g1.0~3".to_owned(), BreakOverride::Break);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text(&doc), "一二三四");
    }

    #[test]
    fn hidden_words_are_excluded_from_cues() {
        let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "嗯这个很好")]);
        doc.hidden.insert("g1.0".to_owned(), true);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues[0].text(&doc), "这个很好");
        assert_eq!(cues[0].id, "q-g1.0~1");
    }

    #[test]
    fn cue_derivation_matches_shared_rust_javascript_and_swift_contract() {
        let contract: Value = serde_json::from_str(include_str!(
            "../tests/fixtures/subtitle-render-contract.json"
        ))
        .unwrap();

        for row in contract["cueDerivations"].as_array().unwrap() {
            let mut doc = TranscriptDoc::new(
                DocMedia {
                    id: None,
                    path: None,
                    hash: "sha256-contract".to_owned(),
                    duration: 10.0,
                    sample_rate: None,
                },
                "en",
                DocEngine {
                    name: "contract".to_owned(),
                    version: None,
                    aligned_words: true,
                },
            );
            doc.words = serde_json::from_value::<Vec<Word>>(row["words"].clone()).unwrap();
            doc.breaks = serde_json::from_value(row["breaks"].clone()).unwrap();
            doc.hidden = serde_json::from_value(row["hidden"].clone()).unwrap();
            // 0.4 addition: `autoBreaks[profile]` is the base and `breaks` overrides it. The fixture's default is an empty table.
            if let Some(auto) = row.get("autoBreaks") {
                doc.auto_breaks = serde_json::from_value(auto.clone()).unwrap();
            }
            if let Some(profile) = row.get("layoutProfile") {
                doc.layout_profile = serde_json::from_value(profile.clone()).unwrap();
            }

            let actual = derive_cues(&doc, &CueParams::default())
                .into_iter()
                .map(|cue| {
                    json!({
                        "id": cue.id,
                        "start": cue.start,
                        "end": cue.end,
                        "sp": cue.sp,
                        "text": cue.text(&doc),
                        "wordIds": cue.word_indices.into_iter()
                            .map(|index| doc.words[index].id.clone())
                            .collect::<Vec<_>>(),
                    })
                })
                .collect::<Vec<_>>();
            assert_eq!(Value::Array(actual), row["expected"], "{}", row["name"]);
        }
    }

    #[test]
    fn cue_id_is_stable_across_rederivation() {
        let doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "大家好，今天讲字幕系统的设计与实现。")]);
        let a = derive_cues(&doc, &CueParams::default());
        let b = derive_cues(&doc, &CueParams::default());
        assert_eq!(a, b);
    }

    #[test]
    fn paras_group_by_speaker_and_pins() {
        let mut row_a = RowIn::new(0.0, 2.0, "今天我们先来讲第一个完整的句子。");
        row_a.speaker = Some("A".to_owned());
        let mut row_b = RowIn::new(2.0, 4.0, "然后我们再来讲第二个完整的句子。");
        row_b.speaker = Some("A".to_owned());
        let mut doc = doc_from_rows(&[row_a, row_b]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(derive_paras(&doc, &cues).len(), 1);
        doc.para_breaks.insert("g2.0".to_owned(), true);
        let paras = derive_paras(&doc, &cues);
        assert_eq!(paras.len(), 2);
        assert_eq!(paras[1].id, "p-g2.0");
    }

    #[test]
    fn paragraph_pin_inside_open_cue_forces_a_cue_boundary() {
        let mut doc = doc_from_rows(&[RowIn::new(0.0, 5.0, "alpha bravo charlie delta")]);
        doc.para_breaks.insert("g1.2".to_owned(), true);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text(&doc), "alpha bravo");
        assert_eq!(cues[1].id, "q-g1.2");
        let paras = derive_paras(&doc, &cues);
        assert_eq!(paras.len(), 2);
        assert_eq!(paras[1].id, "p-g1.2");
    }
    /// Short-interjection observation measure: 「嗯。」 between two paragraphs of the same speaker is counted. Long answers and adjacent paragraphs of the same speaker are not. Derivation itself is unchanged, and the interjection is still a separate Para.
    #[test]
    fn short_interjections_are_counted_but_still_their_own_paragraphs() {
        let mut row_a = RowIn::new(0.0, 4.0, "今天我们先来讲第一个完整的句子。");
        row_a.speaker = Some("A".to_owned());
        let mut row_b = RowIn::new(4.0, 4.6, "嗯。");
        row_b.speaker = Some("B".to_owned());
        let mut row_c = RowIn::new(4.6, 8.0, "然后我们再来讲第二个完整的句子。");
        row_c.speaker = Some("A".to_owned());
        let mut row_d = RowIn::new(8.0, 12.0, "这个问题我觉得要分三层来看才说得清楚。");
        row_d.speaker = Some("B".to_owned());
        let mut row_e = RowIn::new(12.0, 14.0, "好的。");
        row_e.speaker = Some("A".to_owned());
        let doc = doc_from_rows(&[row_a, row_b, row_c, row_d, row_e]);
        let cues = derive_cues(&doc, &CueParams::default());
        let paras = derive_paras(&doc, &cues);
        assert_eq!(paras.len(), 5, "派生不变：说话人一切换必然另起段");
        let found = short_interjection_paragraphs(
            &doc,
            &cues,
            &paras,
            SHORT_INTERJECTION_MAX_CHARS,
            SHORT_INTERJECTION_MAX_SECONDS,
        );
        assert_eq!(
            found,
            vec![1],
            "「嗯。」计入；长回答不计；末段「好的。」没有右邻不计"
        );
        // Duration limit: the same 「嗯。」 stretched to 5 seconds no longer counts as an interjection.
        let mut row_slow = RowIn::new(4.0, 9.0, "嗯。");
        row_slow.speaker = Some("B".to_owned());
        let mut row_a2 = RowIn::new(0.0, 4.0, "今天我们先来讲第一个完整的句子。");
        row_a2.speaker = Some("A".to_owned());
        let mut row_c2 = RowIn::new(9.0, 12.0, "然后我们再来讲第二个完整的句子。");
        row_c2.speaker = Some("A".to_owned());
        let doc = doc_from_rows(&[row_a2, row_slow, row_c2]);
        let cues = derive_cues(&doc, &CueParams::default());
        let paras = derive_paras(&doc, &cues);
        assert!(short_interjection_paragraphs(&doc, &cues, &paras, 10, 3.0).is_empty());
    }
}
