//! Source fingerprint handling for bilingual Find & Replace.
//!
//! The Mac `TranslateFindReplace.trReplaceMatches` changes the translation first and then the source, in one undo transaction. A source sentence gets a new fingerprint only when both sides of the same semantic paragraph have actually changed, and only if it already had a stamp before the edit and that stamp is still fresh. This decision cannot be left to the UI, and a document-level “refresh all” cannot replace it, because that would turn translations that went stale long ago and have nothing to do with this replacement into fresh ones.
//!
//! Re-flowing the source text can also change the first-word id of a Sentence. Before the edit, this module freezes the sentence order and starting points. After the edit, it re-attaches the sentence-key state of every language to the new id, but only if both still match. This gives the same visible result as Mac `editSpan`, which keeps the first-word id, without requiring the host to copy the sentence-level table structure.

use std::collections::{BTreeMap, BTreeSet};

use crate::cue::{derive_cues, derive_paras};
use crate::doc::TranscriptDoc;
use crate::layout_profile::cue_params_for_doc;
use crate::sentence::derive_sentences;

#[derive(Clone, Debug, PartialEq)]
struct SourceSentence {
    id: String,
    index: usize,
    start: f64,
}

#[derive(Clone, Debug, PartialEq)]
struct SyncCandidate {
    source: SourceSentence,
    paragraph: usize,
}

/// Result of re-attaching sentence keys after the edit and confirming source fingerprints.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct BilingualReplaceFinalize {
    pub rekeyed_sentences: usize,
    pub synced_stamps: usize,
}

/// The minimal plan frozen before the edit. The host may run any number of translation and source CAS operations first. After they all succeed, call [`finalize`](Self::finalize); if the transaction fails, drop this value.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct BilingualReplacePlan {
    language: Option<String>,
    source_sentences: Vec<SourceSentence>,
    sync_candidates: Vec<SyncCandidate>,
    target_paragraphs: BTreeSet<usize>,
}

impl BilingualReplacePlan {
    /// `source_word_ids` are the source word spans that this batch will really rewrite; `target_sentence_ids` are the translation Sentences that this batch will really rewrite (the host must strip `#N` from the piece ref first).
    /// `language = None` still re-attaches sentence keys, but does not confirm any stamp.
    pub fn capture(
        doc: &TranscriptDoc,
        language: Option<&str>,
        source_word_ids: &[String],
        target_sentence_ids: &[String],
    ) -> Self {
        if source_word_ids.is_empty() {
            return Self::default();
        }
        let cues = derive_cues(doc, &cue_params_for_doc(doc));
        let sentences = derive_sentences(doc, &cues);
        let paras = derive_paras(doc, &cues);
        let source_ids: BTreeSet<&str> = source_word_ids.iter().map(String::as_str).collect();
        let target_ids: BTreeSet<&str> = target_sentence_ids.iter().map(String::as_str).collect();

        // Mac `paragraphPairs` uses strict time intersection, and when a group unexpectedly spans paragraphs, the later paragraph overrides the earlier one. Inserting repeatedly in paragraph order gives the same attribution.
        let mut paragraph_of_sentence = BTreeMap::new();
        for (paragraph_index, paragraph) in paras.iter().enumerate() {
            let Some(first) = paragraph
                .cue_indices
                .first()
                .and_then(|index| cues.get(*index))
            else {
                continue;
            };
            let Some(last) = paragraph
                .cue_indices
                .last()
                .and_then(|index| cues.get(*index))
            else {
                continue;
            };
            for (sentence_index, sentence) in sentences.iter().enumerate() {
                if sentence.start(doc) < last.end && sentence.end(doc) > first.start {
                    paragraph_of_sentence.insert(sentence_index, paragraph_index);
                }
            }
        }

        let target_paragraphs = sentences
            .iter()
            .enumerate()
            .filter(|(_, sentence)| target_ids.contains(sentence.id.as_str()))
            .filter_map(|(index, _)| paragraph_of_sentence.get(&index).copied())
            .collect::<BTreeSet<_>>();

        let language = language.map(str::to_owned);
        let mut source_sentences = Vec::new();
        let mut sync_candidates = Vec::new();
        for (index, sentence) in sentences.iter().enumerate() {
            if !sentence
                .word_indices
                .iter()
                .filter_map(|word_index| doc.words.get(*word_index))
                .any(|word| source_ids.contains(word.id.as_str()))
            {
                continue;
            }
            let source = SourceSentence {
                id: sentence.id.clone(),
                index,
                start: sentence.start(doc),
            };
            source_sentences.push(source.clone());

            let Some(language) = language.as_deref() else {
                continue;
            };
            let Some(paragraph) = paragraph_of_sentence.get(&index).copied() else {
                continue;
            };
            let translated = doc
                .trans
                .get(language)
                .and_then(|table| table.get(&sentence.id))
                .is_some_and(|text| !text.trim().is_empty());
            let fresh_stamp = doc
                .trans_src
                .get(language)
                .and_then(|table| table.get(&sentence.id))
                .is_some_and(|stamp| stamp == &sentence.src_fingerprint);
            if translated && fresh_stamp {
                sync_candidates.push(SyncCandidate { source, paragraph });
            }
        }

        Self {
            language,
            source_sentences,
            sync_candidates,
            target_paragraphs,
        }
    }

    /// Finalizes after all text operations succeed. Candidates whose sentence order or starting point has changed are discarded; no ownership is guessed.
    pub fn finalize(self, doc: &mut TranscriptDoc) -> BilingualReplaceFinalize {
        if self.source_sentences.is_empty() {
            return BilingualReplaceFinalize::default();
        }
        let cues = derive_cues(doc, &cue_params_for_doc(doc));
        let sentences = derive_sentences(doc, &cues)
            .into_iter()
            .map(|sentence| {
                let start = sentence.start(doc);
                (sentence.id, sentence.src_fingerprint, start)
            })
            .collect::<Vec<_>>();
        let live_for = |source: &SourceSentence| {
            sentences
                .get(source.index)
                .filter(|(_, _, start)| (*start - source.start).abs() < 0.001)
        };

        let moves = self
            .source_sentences
            .iter()
            .filter_map(|source| {
                let live = live_for(source)?;
                (live.0 != source.id).then(|| (source.id.clone(), live.0.clone()))
            })
            .collect::<Vec<_>>();
        if !moves.is_empty() {
            rekey_nested(&mut doc.trans, &moves);
            rekey_nested(&mut doc.trans_display, &moves);
            rekey_nested(&mut doc.trans_align, &moves);
            rekey_nested(&mut doc.trans_src, &moves);
        }

        let mut synced_stamps = 0;
        if let Some(language) = self.language {
            for candidate in self.sync_candidates {
                if !self.target_paragraphs.contains(&candidate.paragraph) {
                    continue;
                }
                let Some(live) = live_for(&candidate.source) else {
                    continue;
                };
                let translated = doc
                    .trans
                    .get(&language)
                    .and_then(|table| table.get(&live.0))
                    .is_some_and(|text| !text.trim().is_empty());
                if !translated {
                    continue;
                }
                doc.trans_src
                    .entry(language.clone())
                    .or_default()
                    .insert(live.0.clone(), live.1.clone());
                synced_stamps += 1;
            }
        }

        BilingualReplaceFinalize {
            rekeyed_sentences: moves.len(),
            synced_stamps,
        }
    }
}

fn rekey_nested<T>(tables: &mut BTreeMap<String, BTreeMap<String, T>>, moves: &[(String, String)]) {
    for table in tables.values_mut() {
        // Remove all keys first, then insert all, so that key chains such as A→B and B→C do not swallow values.
        let moved = moves
            .iter()
            .filter_map(|(old, new)| table.remove(old).map(|value| (new.clone(), value)))
            .collect::<Vec<_>>();
        for (new, value) in moved {
            table.insert(new, value);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::doc::{DocEngine, DocMedia, Speaker, Word};
    use crate::sentence::stale_sentences;

    fn word(id: &str, t0: f64, text: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1: t0 + 0.4,
            text: text.to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    fn doc() -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 8.0,
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
        doc.words = vec![
            word("w0", 0.0, "Hello."),
            word("w1", 0.5, "Next."),
            word("w2", 1.0, "Last."),
        ];
        let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
        let sentences = derive_sentences(&doc, &cues);
        for (index, sentence) in sentences.iter().enumerate() {
            doc.trans
                .entry("zh".to_owned())
                .or_default()
                .insert(sentence.id.clone(), format!("译文{index}"));
            doc.trans_src
                .entry("zh".to_owned())
                .or_default()
                .insert(sentence.id.clone(), sentence.src_fingerprint.clone());
        }
        doc
    }

    #[test]
    fn same_paragraph_bilingual_change_rekeys_and_refreshes_only_fresh_source_sentence() {
        let mut doc = doc();
        let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
        let sentences = derive_sentences(&doc, &cues);
        let old = sentences[0].id.clone();
        let plan = BilingualReplacePlan::capture(
            &doc,
            Some("zh"),
            &[doc.words[0].id.clone()],
            &[sentences[1].id.clone()],
        );

        doc.words[0].id = "fresh-0".to_owned();
        doc.words[0].text = "Greetings.".to_owned();
        let outcome = plan.finalize(&mut doc);
        assert_eq!(outcome.rekeyed_sentences, 1);
        assert_eq!(outcome.synced_stamps, 1);

        let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
        let sentences = derive_sentences(&doc, &cues);
        let live = &sentences[0];
        assert_ne!(live.id, old);
        assert_eq!(doc.trans["zh"][&live.id], "译文0");
        assert!(!doc.trans["zh"].contains_key(&old));
        assert_eq!(doc.trans_src["zh"][&live.id], live.src_fingerprint);
        assert!(stale_sentences(&doc, "zh", &sentences).is_empty());
    }

    #[test]
    fn preexisting_stale_stamp_is_rekeyed_but_never_washed_fresh() {
        let mut doc = doc();
        let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
        let sentences = derive_sentences(&doc, &cues);
        doc.trans_src
            .get_mut("zh")
            .unwrap()
            .insert(sentences[0].id.clone(), "already-stale".to_owned());
        let plan = BilingualReplacePlan::capture(
            &doc,
            Some("zh"),
            &[doc.words[0].id.clone()],
            &[sentences[1].id.clone()],
        );

        doc.words[0].text = "Greetings.".to_owned();
        let outcome = plan.finalize(&mut doc);
        assert_eq!(outcome.synced_stamps, 0);
        let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
        let sentences = derive_sentences(&doc, &cues);
        assert!(stale_sentences(&doc, "zh", &sentences).contains(&sentences[0].id));
    }

    #[test]
    fn different_paragraph_target_does_not_acknowledge_source_change() {
        let mut doc = doc();
        doc.para_breaks.insert("w1".to_owned(), true);
        let cues = derive_cues(&doc, &cue_params_for_doc(&doc));
        let sentences = derive_sentences(&doc, &cues);
        let plan = BilingualReplacePlan::capture(
            &doc,
            Some("zh"),
            &[doc.words[0].id.clone()],
            &[sentences[1].id.clone()],
        );
        doc.words[0].text = "Greetings.".to_owned();
        let outcome = plan.finalize(&mut doc);
        assert_eq!(outcome.synced_stamps, 0);
    }
}
