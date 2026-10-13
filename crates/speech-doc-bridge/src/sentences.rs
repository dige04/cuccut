//! Sentences and source fingerprints of the transcript body (video format spec §5.2, §5.3; architecture design §7.9).
//!
//! Sentences are derived from words by the subtitle and translation core's `derive_sentences` (sentence-ending punctuation, a pause of at least 1.8 seconds, speaker changes, at most 80 words per sentence, paragraph and chapter boundaries; hidden words do not enter sentences). The fingerprint is the core's FNV content fingerprint. Translation, review, dubbing and content indexing all get sentences through here, so there is only one copy of the rules: native callers link it directly, while the UI and Node go through `bindings/editor-wasm`.
//!
//! The `sentences` stored in the body do not take part: sentences are always derived from words under the core's rules. Time never goes through floating point: a sentence's start and end are the ticks in the body of its first and last word.

use editor_semantics::MediaTime;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use speech_doc::sentence::{Sentence, derive_sentences};
use video_model::Id;
use video_model::speech::SpeechBody;

use crate::time::FRESH_TIMESCALE;
use crate::{BridgeError, MediaFacts, speech};

/// Name of the sentence-derivation rule (goes into `sourceBasis.editViewHash`): the subtitle and translation core's `derive_sentences`.
pub const SENTENCE_DERIVATION: &str = "speech-doc/sentences";

/// One source sentence.
#[derive(Clone, Debug, PartialEq)]
pub struct SourceSentence {
    /// `s-<first word ID>`.
    pub id: Id,
    /// Visible words in the sentence, in word order.
    pub word_ids: Vec<Id>,
    pub text: String,
    /// The core's content fingerprint: `<word count>:<first word ID>:<last word ID>:<FNV-1a in base 36>`.
    pub fingerprint: String,
    /// Speaker of the first word; absent when there is no speaker. Not included in the fingerprint.
    pub speaker: Option<Id>,
    /// Start of the first word and end of the last word, in ticks at the body's `timescale`.
    pub start: i64,
    pub end: i64,
}

/// All sentences of one transcript.
#[derive(Clone, Debug, PartialEq)]
pub struct SourceSentences {
    pub derivation: &'static str,
    /// The body's `timescale` (1 000 000 when absent).
    pub timescale: i64,
    /// Digest of the derivation rule and of all sentence IDs and fingerprints (`sourceBasis.editViewHash`).
    pub edit_view_hash: String,
    /// Content fingerprint of the full text (the core's `fingerprint`, computed over all words including hidden ones): same format as `stages.asr`. Comparing the two shows whether anyone edited the source text after transcription (video format spec §5.5; this is the gate for manual script edits).
    ///
    pub content_fingerprint: String,
    pub sentences: Vec<SourceSentence>,
}

/// Sentences of a transcript body. Errors if the body is not `cuccut.speech/1`, if words lack source times, or if a speaker is invalid.
pub fn source_sentences(body: &SpeechBody) -> Result<SourceSentences, BridgeError> {
    // Sentences look only at words, hiding, paragraphs and chapters; asset facts and language do not take part, so placeholders are used.
    let media = MediaFacts {
        asset_id: None,
        path: None,
        content_hash: String::new(),
        duration: MediaTime {
            ticks: "0".into(),
            timescale: 1,
        },
        sample_rate: None,
    };
    let doc = speech::to_doc(&media, None, body)?;
    let derived = derive_sentences(&doc, &[]);
    let sentences = derived
        .iter()
        .map(|sentence| {
            let first = &body.words[sentence.word_indices[0]];
            let last = &body.words[*sentence.word_indices.last().expect("sentence has at least one word")];
            let speaker = doc.words[sentence.word_indices[0]].sp.clone();
            SourceSentence {
                id: sentence.id.clone(),
                word_ids: sentence.word_indices.iter().map(|&i| body.words[i].id.clone()).collect(),
                text: sentence.source_text.clone(),
                fingerprint: sentence.src_fingerprint.clone(),
                speaker: (!speaker.is_empty()).then_some(speaker),
                // `to_doc` has already confirmed that every word has a source time.
                start: first.start.unwrap_or_default(),
                end: last.end.unwrap_or_default(),
            }
        })
        .collect();
    Ok(SourceSentences {
        derivation: SENTENCE_DERIVATION,
        timescale: body.timescale.unwrap_or(FRESH_TIMESCALE),
        edit_view_hash: edit_view_hash(&derived),
        content_fingerprint: speech_doc::fingerprint::fingerprint(&doc.words),
        sentences,
    })
}

/// `sourceBasis.editViewHash`: `'sha256:'` + the sha256 of the UTF-8 of `{"derivation":<rule name>,"sentences":[[<ID>,<fingerprint>],…]}`.
pub fn edit_view_hash(sentences: &[Sentence]) -> String {
    let pairs: Vec<Value> = sentences
        .iter()
        .map(|sentence| json!([sentence.id, sentence.src_fingerprint]))
        .collect();
    // Keys are written by hand, in order; this does not depend on whether serde_json's Map preserves order.
    let canonical = format!(
        "{{\"derivation\":{},\"sentences\":{}}}",
        Value::String(SENTENCE_DERIVATION.into()),
        Value::Array(pairs)
    );
    let digest = Sha256::digest(canonical.as_bytes());
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("sha256:{hex}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(value: Value) -> SpeechBody {
        serde_json::from_value(value).unwrap()
    }

    #[test]
    fn derives_with_the_core_rules_and_keeps_ticks_exact() {
        let speech = body(json!({
            "schema": "cuccut.speech/1",
            "timescale": 1000,
            "words": [
                { "id": "w0", "start": 0, "end": 400, "text": "Hello", "speaker": "a" },
                { "id": "w1", "start": 500, "end": 900, "text": " there;", "speaker": "a" },
                { "id": "w2", "start": 1000, "end": 1300, "text": " friend", "speaker": "a" },
                // A 1.7-second pause does not split a sentence (the core uses 1.8 seconds).
                { "id": "w3", "start": 3000, "end": 3200, "text": " one.", "speaker": "a" },
                { "id": "w4", "start": 3300, "end": 3500, "text": " Two", "speaker": "a" },
                { "id": "w5", "start": 3600, "end": 3700, "text": " hidden", "speaker": "a", "hidden": true },
                // Hidden words do not count: 1.9 seconds after the last visible word, split the sentence.
                { "id": "w6", "start": 5400, "end": 5600, "text": " three", "speaker": "a" },
                { "id": "w7", "start": 5700, "end": 5900, "text": " four" }
            ],
            "sentences": [{ "id": "stored", "wordIds": ["w0"] }]
        }));
        let result = source_sentences(&speech).unwrap();
        assert_eq!(result.derivation, SENTENCE_DERIVATION);
        assert_eq!(result.timescale, 1000);
        let ids: Vec<&str> = result.sentences.iter().map(|s| s.id.as_str()).collect();
        // A semicolon does not split a sentence; stored sentences do not take part; a speaker change splits.
        assert_eq!(ids, ["s-w0", "s-w4", "s-w6", "s-w7"]);
        let first = &result.sentences[0];
        assert_eq!(first.word_ids, ["w0", "w1", "w2", "w3"]);
        assert_eq!(first.text, "Hello there; friend one.");
        assert!(first.fingerprint.starts_with("4:w0:w3:"), "{}", first.fingerprint);
        assert_eq!(first.speaker.as_deref(), Some("a"));
        assert_eq!((first.start, first.end), (0, 3200));
        assert_eq!(result.sentences[1].word_ids, ["w4"]);
        assert_eq!(result.sentences[3].speaker, None);
        assert!(result.edit_view_hash.starts_with("sha256:"));
        // The full-text fingerprint covers all words (including hidden ones), in the same format as `stages.asr`.
        assert!(result.content_fingerprint.starts_with("8:w0:w7:"), "{}", result.content_fingerprint);
    }

    #[test]
    fn rejects_bodies_the_core_cannot_read() {
        let missing_time = body(json!({ "schema": "cuccut.speech/1", "words": [{ "id": "w0", "text": "x" }] }));
        assert!(source_sentences(&missing_time).is_err());
        let other = body(json!({ "schema": "cuccut.caption/1", "words": [] }));
        assert!(source_sentences(&other).is_err());
    }
}
