//! Words of caption sentences (video format spec §3.8, §5.7): a caption document's sentence uses `words` (`{first, last}` or `{wordIds}`) to point to words in the transcript document (the `sourceDocumentId` in the caption document header).
//! The kernel receives these words from the effective word stream; word-by-word animation, word-by-word highlighting and designed-caption emphasis (by word ID) all advance by them:
//!
//! - Hidden words are not given; cut words (those that project to no point on the timeline) are not given either. When words are removed from a sentence this way, the sentence's text is reassembled from the remaining words (`speech_doc::atomize::join_word_texts`, recognizing the “attach-to-previous” flag on words), and a sentence with no words left is not drawn.
//! - Words get their times from the document clock: when the caption is on the source media clock, a word's own source time; when on the sequence clock, the place where the word projects onto the sequence and overlaps this sentence.
//! - Multi-character CJK words are split character by character using the same rule as the transcript's on-disk form (`speech_doc::build::atomize_timed_word`, sub-ID `<word>~<k>`).
//! - When a sentence has no `words` (captions generated earlier), it takes the words whose times fall in this sentence for timing, and its text is unchanged.
//! - Translated captions, captions without `sourceDocumentId`, or captions pointing to a non-transcript get no words; the kernel infers them by splitting on whitespace.

use std::collections::{HashMap, HashSet};

use render_graph::VideoView;
use render_graph::text_plan::plan_text;
use serde_json::{Value, json};
use video_model::{DocumentRecord, Id, TimelineItem};

use crate::documents::FrozenDocument;

pub const SPEECH_DOCUMENT: &str = "cuccut.speech/1";

/// A word in the transcript document (seconds, on the transcript's clock).
#[derive(Clone, Debug, PartialEq)]
pub struct SpeechWord {
    pub id: String,
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub glue: bool,
    pub hidden: bool,
}

/// A loaded transcript: words in document order, looked up by ID.
#[derive(Clone, Debug, Default)]
pub struct SpeechWords {
    pub words: Vec<SpeechWord>,
    index: HashMap<String, usize>,
    pub sequence_clock: bool,
}

impl SpeechWords {
    /// `None` unless the document is `cuccut.speech/1`. Times are integer ticks; `timescale` defaults to 1 000 000.
    pub fn read(body: &Value) -> Option<SpeechWords> {
        if body.get("schema").and_then(Value::as_str) != Some(SPEECH_DOCUMENT) {
            return None;
        }
        let timescale = match body.get("timescale").and_then(Value::as_f64) {
            Some(t) if t > 0.0 && t.is_finite() => t,
            _ => 1_000_000.0,
        };
        let mut words = Vec::new();
        let mut index = HashMap::new();
        for word in body.get("words")?.as_array()? {
            let (Some(id), Some(start), Some(end)) = (
                word.get("id").and_then(Value::as_str),
                word.get("start").and_then(Value::as_f64).filter(|v| v.is_finite()),
                word.get("end").and_then(Value::as_f64).filter(|v| v.is_finite()),
            ) else {
                continue;
            };
            index.entry(id.to_string()).or_insert(words.len());
            words.push(SpeechWord {
                id: id.to_string(),
                text: word.get("text").and_then(Value::as_str).unwrap_or_default().to_string(),
                start: start / timescale,
                end: (end / timescale).max(start / timescale),
                glue: word.get("glue").and_then(Value::as_bool).unwrap_or(false),
                hidden: word.get("hidden").and_then(Value::as_bool).unwrap_or(false),
            });
        }
        Some(SpeechWords {
            words,
            index,
            sequence_clock: body.get("clock").and_then(Value::as_str) == Some("sequence"),
        })
    }

    /// The words that a sentence's `words` points to (indices into the document, in document order). `None` if it is not set or none can be found.
    pub fn refs(&self, words: &Value) -> Option<Vec<usize>> {
        let found: Vec<usize> = if let Some(ids) = words.get("wordIds").and_then(Value::as_array) {
            ids.iter()
                .filter_map(|id| id.as_str().and_then(|id| self.index.get(id)).copied())
                .collect()
        } else {
            let at = |key: &str| words.get(key).and_then(Value::as_str).and_then(|id| self.index.get(id)).copied();
            match (at("first"), at("last")) {
                (Some(a), Some(b)) if a <= b => (a..=b).collect(),
                _ => Vec::new(),
            }
        };
        (!found.is_empty()).then_some(found)
    }
}

/// Whether each word survives the edit, and its timing.
#[derive(Clone, Debug, PartialEq)]
pub enum Placement {
    /// Cannot be projected onto the sequence (for example, the transcript's source is not on the timeline): all words are kept, at the transcript's own times.
    Unplaced,
    /// Word IDs that appear in the effective word stream (cut or hidden words are not included).
    Kept(HashSet<String>),
    /// The intervals of the words projected onto the sequence (seconds, from the sequence start).
    OnSequence(HashMap<String, Vec<(f64, f64)>>),
}

/// Projects `speech` onto the sequence. The instances it acts on are the `scopeItemIds` of the caption instance that displays `caption_document_id` (if neither is set, the instances of the media that the transcript describes on the timeline, found the same way as the effective word stream, `render_graph::text_plan::plan_text`). When `on_sequence` is set, the intervals of the words on the sequence are given; otherwise only whether each word is kept.
pub fn place(
    video: VideoView,
    sequence_id: &str,
    caption_document_id: &str,
    speech: &FrozenDocument,
    fallback_asset: Option<&str>,
    on_sequence: bool,
) -> Placement {
    let Some(sequence) = video.sequences.get(sequence_id) else {
        return Placement::Unplaced;
    };
    let mut scope: Vec<Id> = Vec::new();
    for item in &sequence.items {
        if let TimelineItem::Caption(caption) = item
            && caption.base.enabled
            && caption.document_id == caption_document_id
        {
            for id in &caption.scope_item_ids {
                if !scope.contains(id) {
                    scope.push(id.clone());
                }
            }
        }
    }
    let record = DocumentRecord {
        id: speech.document_id.clone(),
        kind: "speech".into(),
        name: String::new(),
        language: None,
        source_asset_id: speech.source_asset_id.clone().or_else(|| fallback_asset.map(str::to_string)),
        source_document_id: None,
        current_revision: String::new(),
        revisions: Default::default(),
        extensions: Default::default(),
    };
    let Ok(plan) = plan_text(video, sequence_id, &record, &speech.body, &scope, None) else {
        return Placement::Unplaced;
    };
    if on_sequence {
        let mut spans: HashMap<String, Vec<(f64, f64)>> = HashMap::new();
        for entry in plan.entries {
            spans.entry(entry.id).or_default().push((entry.start, entry.end));
        }
        Placement::OnSequence(spans)
    } else {
        Placement::Kept(plan.entries.into_iter().map(|entry| entry.id).collect())
    }
}

/// The words of one sentence handed to the kernel, and the text reassembled from them (when words were removed).
#[derive(Clone, Debug, PartialEq)]
pub struct CueWords {
    /// `{id, text, t0, t1}`, in document order.
    pub words: Vec<Value>,
    pub text: Option<String>,
}

/// The words kept in this sentence, and their start and end (on the caption clock).
type Member<'a> = (&'a SpeechWord, (f64, f64));

/// Index used to pick words by time for sentences without `words`: each word's possible midpoint on the caption clock (each occurrence's midpoint when projected onto the sequence) is sorted, so a sentence only looks at the words whose midpoints fall inside it, rather than scanning the whole transcript for every sentence (with thousands of sentences and tens of thousands of words, that would be hundreds of millions of lookups). Built once per transcript and per keep/cut setting.
pub struct WordTimes {
    middles: Vec<(f64, usize)>,
}

impl WordTimes {
    pub fn new(speech: &SpeechWords, placement: &Placement) -> WordTimes {
        let mut middles = Vec::with_capacity(speech.words.len());
        for (index, word) in speech.words.iter().enumerate() {
            match placement {
                Placement::OnSequence(spans) => {
                    for &(a, b) in spans.get(&word.id).map(Vec::as_slice).unwrap_or_default() {
                        middles.push(((a + b) / 2.0, index));
                    }
                }
                _ => middles.push(((word.start + word.end) / 2.0, index)),
            }
        }
        // NaN falls inside no sentence (comparisons are always false), so it is not indexed.
        middles.retain(|(middle, _)| !middle.is_nan());
        middles.sort_by(|x, y| x.0.total_cmp(&y.0));
        WordTimes { middles }
    }

    /// Words with a midpoint inside `[span.0, span.1)` (indices, in document order): candidates for picking words. Whether each is kept and its timing are still decided one by one by the rules of [`cue_words`].
    fn within(&self, span: (f64, f64)) -> Vec<usize> {
        let from = self.middles.partition_point(|&(middle, _)| middle < span.0);
        let to = self.middles.partition_point(|&(middle, _)| middle < span.1).max(from);
        let mut found: Vec<usize> = self.middles[from..to].iter().map(|&(_, index)| index).collect();
        found.sort_unstable();
        found.dedup();
        found
    }
}

/// The words of one sentence (`start`–`end` on the document clock, `refs` are the words its `words` points to) handed to the kernel. `sequence_clock` is the caption document's clock.
/// `None` when no words can be given (the kernel then infers them by splitting on whitespace).
pub fn cue_words(
    speech: &SpeechWords,
    refs: Option<&[usize]>,
    span: (f64, f64),
    sequence_clock: bool,
    placement: &Placement,
) -> Option<CueWords> {
    cue_words_indexed(speech, refs, span, sequence_clock, placement, None)
}

/// Same as [`cue_words`]; for a sentence without `words`, when `times` is given (built for the same transcript and keep/cut setting), words are picked only from the candidates.
pub fn cue_words_indexed(
    speech: &SpeechWords,
    refs: Option<&[usize]>,
    span: (f64, f64),
    sequence_clock: bool,
    placement: &Placement,
    times: Option<&WordTimes>,
) -> Option<CueWords> {
    // No words are given when the words' times cannot be converted to the caption clock (a caption on the sequence clock, or a transcript that cannot be projected onto the sequence).
    let usable = match placement {
        Placement::OnSequence(_) => sequence_clock && !speech.sequence_clock,
        _ => sequence_clock == speech.sequence_clock,
    };
    if !usable {
        return None;
    }
    // The word's time on the caption clock; `None` for a word that is not kept.
    let timed = |word: &SpeechWord| -> Option<(f64, f64)> {
        if word.hidden {
            return None;
        }
        match placement {
            Placement::OnSequence(spans) => {
                // When the same source segment is used twice, take the occurrence that overlaps this sentence the most.
                let spans = spans.get(&word.id)?;
                spans
                    .iter()
                    .map(|&(a, b)| (a, b, b.min(span.1) - a.max(span.0)))
                    .filter(|&(_, _, overlap)| overlap > 0.0)
                    .max_by(|x, y| x.2.total_cmp(&y.2))
                    .map(|(a, b, _)| (a, b))
            }
            Placement::Kept(kept) => {
                // Zero-length words are not part of the effective word stream; they stay with this sentence.
                (word.end <= word.start || kept.contains(&word.id)).then_some((word.start, word.end))
            }
            Placement::Unplaced => Some((word.start, word.end)),
        }
    };
    let (members, rebuild): (Vec<Member>, bool) = match refs {
        Some(refs) => {
            let kept: Vec<_> = refs
                .iter()
                .filter_map(|&i| speech.words.get(i))
                .filter_map(|word| timed(word).map(|t| (word, t)))
                .collect();
            let rebuild = kept.len() < refs.len();
            (kept, rebuild)
        }
        None => {
            let candidates: Box<dyn Iterator<Item = &SpeechWord>> = match times {
                Some(times) => Box::new(times.within(span).into_iter().filter_map(|i| speech.words.get(i))),
                None => Box::new(speech.words.iter()),
            };
            let kept: Vec<_> = candidates
                .filter_map(|word| timed(word).map(|t| (word, t)))
                .filter(|(_, (a, b))| {
                    let middle = (a + b) / 2.0;
                    middle >= span.0 && middle < span.1
                })
                .collect();
            if kept.is_empty() {
                return None;
            }
            (kept, false)
        }
    };
    let text = rebuild.then(|| speech_doc::atomize::join_word_texts(members.iter().map(|(word, _)| (word.text.as_str(), word.glue))));
    let mut words = Vec::new();
    for (word, (start, end)) in &members {
        for (id, text, t0, t1, _) in speech_doc::build::atomize_timed_word(&word.id, &word.text, *start, *end, word.glue) {
            words.push(json!({ "id": id, "text": text, "t0": t0, "t1": t1 }));
        }
    }
    Some(CueWords { words, text })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn speech(words: &[(&str, &str, f64, f64)], hidden: &[&str]) -> SpeechWords {
        SpeechWords::read(&json!({
            "schema": SPEECH_DOCUMENT, "clock": "source-asset", "timescale": 1000,
            "words": words.iter().map(|(id, text, s, e)| {
                let mut word = json!({ "id": id, "text": text, "start": (s * 1000.0) as i64, "end": (e * 1000.0) as i64 });
                if hidden.contains(id) {
                    word["hidden"] = json!(true);
                }
                word
            }).collect::<Vec<_>>(),
        }))
        .unwrap()
    }

    fn ids(words: &CueWords) -> Vec<&str> {
        words.words.iter().map(|w| w["id"].as_str().unwrap()).collect()
    }

    #[test]
    fn refs_take_ranges_or_lists() {
        let s = speech(&[("a", "x", 0.0, 1.0), ("b", "y", 1.0, 2.0), ("c", "z", 2.0, 3.0)], &[]);
        assert_eq!(s.refs(&json!({ "first": "a", "last": "c" })), Some(vec![0, 1, 2]));
        assert_eq!(s.refs(&json!({ "wordIds": ["c", "nope", "a"] })), Some(vec![2, 0]));
        assert_eq!(s.refs(&json!({ "first": "c", "last": "a" })), None);
        assert_eq!(s.refs(&Value::Null), None);
    }

    #[test]
    fn hidden_and_cut_words_drop_out_and_the_text_is_rebuilt() {
        let s = speech(
            &[
                ("w1", "真", 0.0, 0.2),
                ("w2", "的", 0.2, 0.4),
                ("w3", "别", 0.4, 0.6),
                ("w4", "再", 0.6, 0.8),
                ("w5", "Codex", 0.8, 1.2),
            ],
            &["w2"],
        );
        let refs = [0, 1, 2, 3, 4];
        let all = cue_words(&s, Some(&refs), (0.0, 1.2), false, &Placement::Unplaced).unwrap();
        assert_eq!(ids(&all), ["w1", "w3", "w4", "w5"]);
        assert_eq!(all.text.as_deref(), Some("真别再 Codex"));
        // w3 is cut: it is not in the effective word stream.
        let kept = Placement::Kept(["w1", "w4", "w5"].into_iter().map(String::from).collect());
        let cut = cue_words(&s, Some(&refs), (0.0, 1.2), false, &kept).unwrap();
        assert_eq!(ids(&cut), ["w1", "w4", "w5"]);
        assert_eq!(cut.text.as_deref(), Some("真再 Codex"));
        assert_eq!(cut.words[1]["t0"], json!(0.6));
        // When nothing is removed, the text is left unchanged.
        let s = speech(&[("a", "Hi", 0.0, 0.5), ("b", "there", 0.5, 1.0)], &[]);
        let same = cue_words(&s, Some(&[0, 1]), (0.0, 1.0), false, &Placement::Unplaced).unwrap();
        assert_eq!(same.text, None);
    }

    #[test]
    fn multi_character_cjk_words_split_per_character() {
        let s = speech(&[("g1", "大家好", 1.0, 1.6)], &[]);
        let words = cue_words(&s, Some(&[0]), (1.0, 1.6), false, &Placement::Unplaced).unwrap();
        assert_eq!(ids(&words), ["g1", "g1~1", "g1~2"]);
        assert_eq!(words.words[0]["t0"], json!(1.0));
        assert_eq!(words.words[2]["t1"], json!(1.6));
    }

    #[test]
    fn sequence_clock_captions_take_the_overlapping_occurrence() {
        let s = speech(&[("a", "one", 0.0, 1.0), ("b", "two", 1.0, 2.0)], &[]);
        let spans = Placement::OnSequence(HashMap::from([
            ("a".to_string(), vec![(5.0, 6.0), (10.0, 11.0)]),
            ("b".to_string(), vec![(11.0, 12.0)]),
        ]));
        let words = cue_words(&s, Some(&[0, 1]), (10.0, 12.0), true, &spans).unwrap();
        assert_eq!(words.words[0]["t0"], json!(10.0));
        assert_eq!(words.words[1]["t1"], json!(12.0));
        // When projection onto the sequence fails, captions on the sequence clock get no words.
        assert_eq!(cue_words(&s, Some(&[0, 1]), (10.0, 12.0), true, &Placement::Unplaced), None);
        // No word projects onto this sentence: the whole sentence is not drawn.
        let gone = cue_words(&s, Some(&[0, 1]), (20.0, 22.0), true, &spans).unwrap();
        assert!(gone.words.is_empty());
        assert_eq!(gone.text.as_deref(), Some(""));
    }

    #[test]
    fn cues_without_refs_take_the_words_inside_them() {
        let s = speech(&[("a", "one", 0.0, 1.0), ("b", "two", 1.0, 2.0), ("c", "three", 2.0, 3.0)], &[]);
        let words = cue_words(&s, None, (0.9, 2.1), false, &Placement::Unplaced).unwrap();
        assert_eq!(ids(&words), ["b"]);
        assert_eq!(words.text, None);
        assert_eq!(cue_words(&s, None, (5.0, 6.0), false, &Placement::Unplaced), None);
    }

    #[test]
    fn indexed_lookup_matches_the_full_scan() {
        let s = speech(
            &[
                ("a", "one", 0.0, 1.0),
                ("b", "two", 1.0, 2.0),
                ("c", "three", 2.0, 3.0),
                ("d", "four", 3.0, 3.0),
                ("e", "five", 3.0, 4.0),
            ],
            &["c"],
        );
        let placements = [
            (false, Placement::Unplaced),
            (
                false,
                Placement::Kept(HashSet::from(["a".to_string(), "b".to_string(), "e".to_string()])),
            ),
            (
                true,
                Placement::OnSequence(HashMap::from([
                    ("a".to_string(), vec![(10.0, 11.0), (0.0, 1.0)]),
                    ("b".to_string(), vec![(1.0, 2.0)]),
                    ("e".to_string(), vec![(2.0, 3.0), (5.0, 6.0)]),
                ])),
            ),
        ];
        for (clock, placement) in &placements {
            let times = WordTimes::new(&s, placement);
            for span in [
                (0.0, 1.0),
                (0.4, 2.6),
                (0.9, 2.1),
                (1.5, 3.5),
                (3.0, 3.0),
                (2.5, 6.0),
                (9.0, 12.0),
                (-1.0, 0.0),
            ] {
                assert_eq!(
                    cue_words_indexed(&s, None, span, *clock, placement, Some(&times)),
                    cue_words(&s, None, span, *clock, placement),
                    "{placement:?} {span:?}"
                );
            }
        }
    }
}
