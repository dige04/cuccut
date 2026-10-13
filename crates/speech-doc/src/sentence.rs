//! Sentence derivation (v0.3 §3, normative algorithm).
//!
//! A Sentence is the unit of translation and alignment: each source sentence maps 1:1 to a target sentence. It is derived directly from the visible word sequence and is not persisted. `trans` / `transSrc` / `transAlign` are keyed by sentence id (`s-<first word id>`).
//! Source Cues only backfill display metadata at the end. They must not take part in sentence boundaries, translation, or alignment semantics.

use std::collections::BTreeSet;

use crate::cue::{Cue, join_words};
use crate::doc::{TranscriptDoc, Word};
use crate::fingerprint::fingerprint;

/// Word-count cap within a sentence (fallback heuristic for long runs without punctuation).
///
/// A translation group may span several display Cues. A threshold that is too small would hard-split a semantically complete long sentence in the middle of a preposition, particle, or predicate. 80 words is still far below a single-page LLM budget, while covering long explanatory sentences in speech.
pub const SENTENCE_MAX_WORDS: usize = 80;
/// Strong-pause threshold (seconds) that alone is enough to close a sentence when there is no sentence-final punctuation.
///
/// 0.6s is still used for Cue display line breaks and as a soft LLM marker, but it must not double as the semantic sentence boundary. Natural speech often has 0.6–1.2s hesitation pauses inside a phrase. 1.8s matches the "long pause" tier of the pause marker.
pub const SENTENCE_HARD_GAP_SECONDS: f64 = 1.8;

/// A sentence = 1..N consecutive visible words. The unit for translation, dirty detection, and alignment.
#[derive(Debug, Clone, PartialEq)]
pub struct Sentence {
    /// `"s-" + first word id`. Stable across re-derivation as long as the first word does not change.
    pub id: String,
    pub cue_ids: Vec<String>,
    /// Refers back to the incoming cues slice.
    pub cue_indices: Vec<usize>,
    /// Refers back to `doc.words` (all non-hidden words within the sentence).
    pub word_indices: Vec<usize>,
    pub source_text: String,
    /// Content fingerprint of the sentence's word slice. This is the baseline for `transSrc` dirty detection.
    pub src_fingerprint: String,
}

impl Sentence {
    /// The sentence time window comes directly from its words, not from the display boundaries of source subtitle Cues.
    pub fn start(&self, doc: &TranscriptDoc) -> f64 {
        doc.words[self.word_indices[0]].t0
    }

    /// The sentence time window comes directly from its words, not from the display boundaries of source subtitle Cues.
    pub fn end(&self, doc: &TranscriptDoc) -> f64 {
        doc.words[*self.word_indices.last().expect("sentence non-empty")].t1
    }

    pub fn word_start(&self, doc: &TranscriptDoc) -> f64 {
        self.start(doc)
    }

    pub fn word_end(&self, doc: &TranscriptDoc) -> f64 {
        self.end(doc)
    }
}

/// Sentence derivation: a direct forward scan of the visible words. Closing conditions (close the sentence if any one holds):
/// 1. the last word has `sentence_end`; 2. the gap to the next word is ≥ 1.8s; 3. speaker change;
/// 4. word count within the sentence ≥ 80; 5. the next word is pinned by `paraBreaks` (paragraph boundary);
/// 6. the next word crosses a chapter boundary. `cues` only backfills `cue_ids/cue_indices` display metadata. Changing source subtitle `breaks` must not change sentence ids, word ranges, text, or fingerprints.
pub fn derive_sentences(doc: &TranscriptDoc, cues: &[Cue]) -> Vec<Sentence> {
    let chapter_of = |t: f64| -> usize {
        doc.chapters
            .iter()
            .position(|chapter| t >= chapter.start && t < chapter.end)
            .unwrap_or(usize::MAX)
    };

    let visible: Vec<usize> = (0..doc.words.len())
        .filter(|index| !doc.words[*index].id.is_empty())
        .filter(|index| {
            !doc.hidden
                .get(&doc.words[*index].id)
                .copied()
                .unwrap_or(false)
        })
        .collect();
    let mut cue_by_word = vec![None; doc.words.len()];
    for (cue_index, cue) in cues.iter().enumerate() {
        for &word_index in &cue.word_indices {
            cue_by_word[word_index] = Some(cue_index);
        }
    }

    let mut sentences = Vec::new();
    let mut current: Vec<usize> = Vec::new();
    for (position, &word_index) in visible.iter().enumerate() {
        current.push(word_index);
        let word = &doc.words[word_index];
        let next = visible
            .get(position + 1)
            .map(|&next_index| &doc.words[next_index]);
        let close = crate::atomize::sentence_end(&word.text)
            || current.len() >= SENTENCE_MAX_WORDS
            || next.is_none_or(|next| {
                next.t0 - word.t1 >= SENTENCE_HARD_GAP_SECONDS
                    || next.sp != word.sp
                    || doc.para_breaks.get(&next.id).copied().unwrap_or(false)
                    || chapter_of(next.t0) != chapter_of(word.t0)
            });
        if close {
            let word_indices = std::mem::take(&mut current);
            let cue_indices: Vec<usize> = word_indices
                .iter()
                .filter_map(|&index| cue_by_word[index])
                .fold(Vec::new(), |mut indices, index| {
                    if indices.last() != Some(&index) {
                        indices.push(index);
                    }
                    indices
                });
            let cue_ids = cue_indices
                .iter()
                .map(|&index| cues[index].id.clone())
                .collect();
            let words: Vec<Word> = word_indices
                .iter()
                .map(|&word_index| doc.words[word_index].clone())
                .collect();
            let first_word = words.first().expect("sentence non-empty");
            sentences.push(Sentence {
                id: format!("s-{}", first_word.id),
                cue_ids,
                cue_indices,
                source_text: join_words(words.iter()),
                src_fingerprint: fingerprint(&words),
                word_indices,
            });
        }
    }
    sentences
}

/// Sentence-level dirty detection: `transSrc[lang][id]` exists and ≠ the current fingerprint ⇒ stale.
/// **No stamp means not stale.** Data never translated under the new mechanism is not penalized.
pub fn stale_sentences(
    doc: &TranscriptDoc,
    lang: &str,
    sentences: &[Sentence],
) -> BTreeSet<String> {
    let Some(stamps) = doc.trans_src.get(lang) else {
        return BTreeSet::new();
    };
    sentences
        .iter()
        .filter(|sentence| {
            stamps
                .get(&sentence.id)
                .is_some_and(|stamp| stamp != &sentence.src_fingerprint)
        })
        .map(|sentence| sentence.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cue::{CueParams, derive_cues};
    use crate::doc::{Chapter, DocEngine, DocMedia, Speaker};

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
        for sp in ["s1", "s2"] {
            doc.speakers.insert(
                sp.to_owned(),
                Speaker {
                    name: sp.to_uppercase(),
                    hue: None,
                },
            );
        }
        doc.words = words;
        doc
    }

    fn w(id: &str, t0: f64, t1: f64, text: &str, sp: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: sp.to_owned(),
            glue: false,
        }
    }

    /// Sentence 1 = two Cues (a break from `pause_punct` at "echo," / sentence-final "hotel.");
    /// Sentence 2 = a single Cue "Done.".
    fn two_sentence_doc() -> TranscriptDoc {
        doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha", "s1"),
            w("g1.1", 0.4, 0.8, "bravo", "s1"),
            w("g1.2", 0.8, 1.2, "charlie", "s1"),
            w("g1.3", 1.2, 1.6, "delta", "s1"),
            w("g1.4", 1.6, 2.0, "echo,", "s1"),
            w("g1.5", 2.0, 2.4, "foxtrot", "s1"),
            w("g1.6", 2.4, 2.8, "golf", "s1"),
            w("g1.7", 2.8, 3.2, "hotel.", "s1"),
            w("g2.0", 3.4, 3.8, "Done.", "s1"),
        ])
    }

    #[test]
    fn sentences_close_on_sentence_end_and_pack_multiple_cues() {
        let doc = two_sentence_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 2);
        assert_eq!(sentences[0].id, "s-g1.0");
        assert_eq!(sentences[0].cue_ids, vec!["q-g1.0", "q-g1.5"]);
        assert_eq!(
            sentences[0].source_text,
            "alpha bravo charlie delta echo, foxtrot golf hotel."
        );
        assert_eq!(sentences[1].id, "s-g2.0");
        assert!(sentences[0].src_fingerprint.starts_with("8:g1.0:g1.7:"));
    }

    #[test]
    fn sentences_distinguish_display_pauses_from_semantic_boundaries() {
        // A 0.8s gap breaks the Cue, but it must not split the same semantic sentence into two translation groups.
        let doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.3, "one", "s1"),
            w("g1.1", 0.3, 0.6, "two", "s1"),
            w("g1.2", 0.6, 0.9, "three", "s1"),
            w("g1.3", 0.9, 1.2, "four", "s1"),
            w("g1.4", 1.2, 1.5, "five", "s1"),
            w("g1.5", 1.5, 1.8, "six,", "s1"),
            w("g1.6", 2.6, 2.9, "seven", "s1"),
            w("g1.7", 2.9, 3.2, "eight.", "s1"),
        ]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(derive_sentences(&doc, &cues).len(), 1);

        // A strong pause of 1.8s or more is enough to close a sentence even without sentence-final punctuation.
        let mut doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "first", "s1"),
            w("g1.1", 0.4, 0.8, "thought", "s1"),
            w("g1.2", 2.6, 3.0, "second", "s1"),
            w("g1.3", 3.0, 3.4, "thought.", "s1"),
        ]);
        doc.breaks
            .insert("g1.1".to_owned(), crate::doc::BreakOverride::Break);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(derive_sentences(&doc, &cues).len(), 2);
    }

    #[test]
    fn source_cue_reflow_does_not_change_sentence_semantics() {
        let mut doc = two_sentence_doc();
        let baseline_cues = derive_cues(&doc, &CueParams::default());
        let baseline = derive_sentences(&doc, &baseline_cues);

        doc.breaks
            .insert("g1.2".to_owned(), crate::doc::BreakOverride::Break);
        let reflowed_cues = derive_cues(&doc, &CueParams::default());
        assert_ne!(
            baseline_cues, reflowed_cues,
            "fixture must reflow source cues"
        );
        let reflowed = derive_sentences(&doc, &reflowed_cues);

        let semantic = |sentences: &[Sentence]| {
            sentences
                .iter()
                .map(|sentence| {
                    (
                        sentence.id.clone(),
                        sentence.word_indices.clone(),
                        sentence.source_text.clone(),
                        sentence.src_fingerprint.clone(),
                    )
                })
                .collect::<Vec<_>>()
        };
        assert_eq!(semantic(&baseline), semantic(&reflowed));
        assert_ne!(baseline[0].cue_ids, reflowed[0].cue_ids);
    }

    #[test]
    fn sentences_close_on_speaker_switch_and_word_cap() {
        let doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "good", "s1"),
            w("g2.0", 0.5, 0.9, "day", "s2"),
        ]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(derive_sentences(&doc, &cues).len(), 2);

        let words: Vec<Word> = (0..82)
            .map(|i| {
                w(
                    &format!("g1.{i}"),
                    i as f64 * 0.3,
                    i as f64 * 0.3 + 0.3,
                    "word",
                    "s1",
                )
            })
            .collect();
        let doc = doc_with_words(words);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 2);
        assert!(sentences[0].word_indices.len() >= SENTENCE_MAX_WORDS);
        assert_eq!(
            sentences
                .iter()
                .map(|sentence| sentence.word_indices.len())
                .sum::<usize>(),
            82
        );
    }

    #[test]
    fn medium_pauses_do_not_fragment_agent_definition() {
        // The real failure pattern from "What is an Agentic Harness (2)": tools→running 0.62s, accomplish→a goal 1.08s.
        let doc = doc_with_words(vec![
            w("g2.0", 0.00, 0.20, "An", "s1"),
            w("g2.1", 0.20, 0.55, "agent", "s1"),
            w("g2.2", 0.55, 0.70, "is", "s1"),
            w("g2.3", 0.70, 0.85, "an", "s1"),
            w("g2.4", 0.85, 1.10, "LLM", "s1"),
            w("g2.5", 1.10, 1.35, "with", "s1"),
            w("g2.6", 1.35, 1.60, "tools", "s1"),
            w("g2.7", 2.22, 2.45, "running", "s1"),
            w("g2.8", 2.45, 2.60, "in", "s1"),
            w("g2.9", 2.60, 2.70, "a", "s1"),
            w("g2.10", 2.70, 2.95, "loop", "s1"),
            w("g2.11", 2.95, 3.10, "to", "s1"),
            w("g2.12", 3.10, 3.50, "accomplish", "s1"),
            w("g2.13", 4.58, 4.68, "a", "s1"),
            w("g2.14", 4.68, 5.00, "goal.", "s1"),
        ]);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 3, "展示层仍应按两个中停顿拆成三个 Cue");
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 1, "翻译层必须保留完整语义句");
        assert_eq!(
            sentences[0].source_text,
            "An agent is an LLM with tools running in a loop to accomplish a goal."
        );
    }

    #[test]
    fn para_pin_and_chapter_boundary_close_sentences() {
        // An unpunctuated, unpaused stream from one speaker. Only paragraph pins force a sentence boundary.
        let mut doc = doc_with_words(vec![
            w("g1.0", 0.0, 0.4, "alpha", "s1"),
            w("g1.1", 0.4, 0.8, "bravo,", "s1"),
            w("g1.2", 0.8, 1.2, "charlie", "s1"),
            w("g1.3", 1.2, 1.6, "delta", "s1"),
        ]);
        // Break the Cue at "bravo," (pause_punct needs min_pause_chars=20, so use a manual break).
        doc.breaks
            .insert("g1.1".to_owned(), crate::doc::BreakOverride::Break);
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(cues.len(), 2);
        assert_eq!(derive_sentences(&doc, &cues).len(), 1);

        doc.para_breaks.insert("g1.2".to_owned(), true);
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert_eq!(sentences.len(), 2, "段落钉必须封句");
        assert_eq!(sentences[1].id, "s-g1.2");

        doc.para_breaks.clear();
        // The chapter boundary falls exactly at the start of Cue 2 (g1.2 t0=0.8).
        doc.chapters = vec![
            Chapter {
                id: "c1".to_owned(),
                title: "A".to_owned(),
                start: 0.0,
                end: 0.8,
            },
            Chapter {
                id: "c2".to_owned(),
                title: "B".to_owned(),
                start: 0.8,
                end: 2.0,
            },
        ];
        let cues = derive_cues(&doc, &CueParams::default());
        assert_eq!(derive_sentences(&doc, &cues).len(), 2, "章节边界必须封句");
    }

    #[test]
    fn stale_requires_existing_mismatched_stamp() {
        let mut doc = two_sentence_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        assert!(stale_sentences(&doc, "zh", &sentences).is_empty());
        doc.trans_src
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), "outdated".to_owned());
        let stale = stale_sentences(&doc, "zh", &sentences);
        assert_eq!(stale.into_iter().collect::<Vec<_>>(), vec!["s-g1.0"]);
        doc.trans_src
            .get_mut("zh")
            .unwrap()
            .insert("s-g1.0".to_owned(), sentences[0].src_fingerprint.clone());
        assert!(stale_sentences(&doc, "zh", &sentences).is_empty());
    }
}
