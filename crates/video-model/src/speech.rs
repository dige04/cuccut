//! Body of a transcript document, `cuccut.speech/1` (video format spec §5.2).
//!
//! The shapes correspond one-to-one with what the TS writers (the transcription pipeline and old-project import) write; fields not recognized here are collected into `extra`,
//! and are carried back unchanged on write-back (§1.4). Fields that may be `null` (`engine`, `createdAt`, `sentences`, the speaker's `hue`)
//! distinguish “no such field” from “value is null”, so a value read in and written back out is identical byte for byte.

use std::collections::BTreeMap;

use message_ref::{Text, msg};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};

use crate::Id;

pub const SPEECH_SCHEMA: &str = "cuccut.speech/1";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechBody {
    pub schema: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub clock: Option<String>,
    /// Ticks per second; when reading and it is absent, 1 000 000 is used (same as the TS readers).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timescale: Option<i64>,
    /// Description of the recognition engine, open content: the transcription pipeline writes the provider and model, old-project import writes the engine object in the old format, or null.
    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "present")]
    pub engine: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "present")]
    pub created_at: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<SpeechSpeaker>>,
    pub words: Vec<SpeechWord>,
    /// Saved sentences; null means sentences are derived from words by the derivation rules.
    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "present")]
    pub sentences: Option<Option<Vec<SpeechSentence>>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chapters: Option<Vec<SpeechChapter>>,
    /// Line breaks pinned by the user: word ID → break before this word or do not break (§5.5).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_breaks: Option<BTreeMap<Id, BreakPin>>,
    /// Line breaks pinned by auto-layout, grouped by LayoutProfile ID (§5.6); on the same word, the user's pin takes precedence.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_breaks: Option<BTreeMap<String, BTreeMap<Id, BreakPin>>>,
    /// The LayoutProfile used for source caption layout; when this field is absent it is `default` (§5.6).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_profile_id: Option<String>,
    /// Segments pinned by the user: these words start a new paragraph, and are also sentence boundaries (§5.5).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paragraph_breaks: Option<Vec<Id>>,
    /// Fingerprints taken when each processing stage commits, used to judge whether anyone has edited by hand since (§5.5).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stages: Option<SpeechStages>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechSpeaker {
    pub id: Id,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "present")]
    pub hue: Option<Option<u32>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechWord {
    pub id: Id,
    /// Source time, in units of the body's `timescale`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end: Option<i64>,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<Id>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timing_quality: Option<TimingQuality>,
    /// No space between this word and the previous word, regardless of how the joining rules judge it (§5.2).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub glue: Option<bool>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TimingQuality {
    Aligned,
    Provider,
    Estimated,
    Missing,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechSentence {
    pub id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first: Option<Id>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last: Option<Id>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub word_ids: Option<Vec<Id>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paragraph_start: Option<bool>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechChapter {
    pub id: Id,
    pub title: String,
    pub start: i64,
    pub end: i64,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BreakPin {
    Break,
    NoBreak,
}

/// Stage fingerprint (§5.5). The fingerprint's form is decided by the engine that wrote it; here it is only stored as is.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechStages {
    /// Fingerprint of the text when transcription completed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asr: Option<String>,
    /// Fingerprint of line breaks, segments and hidden items when transcription completed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asr_layout: Option<String>,
    /// Fingerprint of the text when the polish was committed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polish: Option<String>,
    /// Fingerprint of the word ID sequence when segments were committed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment: Option<String>,
    /// Fingerprint of the text when chapters were committed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chapters: Option<String>,
    /// Word times come from forced alignment of the script rather than from recognition.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligned: Option<AlignedStage>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignedStage {
    /// Currently only `script`.
    pub mode: String,
    /// The proportion of script characters that align to valid durations, 0–1.
    pub coverage: f64,
    /// Words whose duration collapsed to 0 and need review.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub low_confidence: Option<Vec<Id>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// When the field is present it is `Some`; when the value is null it is `Some(None)` or `Some(Value::Null)`; when the field is absent, `default` gives `None`.
pub(crate) fn present<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
}

/// Checks only the fields this spec adds for `cuccut.speech/1` (§5.2): when they appear, their shape must be correct. Other fields are not validated here,
/// and existing writers may keep writing them as usual.
pub fn speech_body_problems(body: &Value) -> Vec<Text> {
    // These structs are used only to check shape: if it reads in, it is correct; some fields are not looked at after reading.
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    #[allow(dead_code)]
    struct Additions {
        #[serde(default)]
        words: Option<Vec<WordAdditions>>,
        #[serde(default)]
        user_breaks: Option<BTreeMap<Id, BreakPin>>,
        #[serde(default)]
        auto_breaks: Option<BTreeMap<String, BTreeMap<Id, BreakPin>>>,
        #[serde(default)]
        layout_profile_id: Option<String>,
        #[serde(default)]
        paragraph_breaks: Option<Vec<Id>>,
        #[serde(default)]
        stages: Option<SpeechStages>,
    }
    #[derive(Deserialize)]
    #[allow(dead_code)]
    struct WordAdditions {
        #[serde(default)]
        glue: Option<bool>,
    }
    let mut problems = Vec::new();
    match serde_json::from_value::<Additions>(body.clone()) {
        Ok(additions) => {
            if additions.layout_profile_id.as_deref() == Some("") {
                problems.push(msg!("videoModel.layoutProfileEmpty", "layoutProfileId cannot be an empty string"));
            }
            if let Some(coverage) = additions.stages.as_ref().and_then(|s| s.aligned.as_ref()).map(|a| a.coverage)
                && !(0.0..=1.0).contains(&coverage)
            {
                problems.push(msg!("videoModel.coverageRange", "stages.aligned.coverage must be between 0 and 1"));
            }
        }
        Err(error) => problems.push(msg!("videoModel.bodyShape", "The body has fields of the wrong shape: {error}", error = error.to_string())),
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn null_and_missing_fields_round_trip_verbatim() {
        let body = json!({
            "schema": "cuccut.speech/1",
            "clock": "source-asset",
            "timescale": 1_000_000,
            "engine": null,
            "createdAt": null,
            "speakers": [{ "id": "s1", "name": "A", "hue": null }, { "id": "s2", "name": "B" }],
            "words": [{ "id": "w1", "start": 0, "end": 10, "text": "hi", "speaker": "s1", "custom": 1 }],
            "sentences": null,
            "chapters": [],
            "legacy": { "breakPins": {}, "paragraphPins": [] }
        });
        let parsed: SpeechBody = serde_json::from_value(body.clone()).unwrap();
        assert_eq!(parsed.engine, Some(Value::Null));
        assert_eq!(parsed.created_at, Some(None));
        assert_eq!(parsed.sentences, Some(None));
        assert_eq!(parsed.speakers.as_ref().unwrap()[0].hue, Some(None));
        assert_eq!(parsed.speakers.as_ref().unwrap()[1].hue, None);
        assert_eq!(serde_json::to_value(&parsed).unwrap(), body);

        let minimal = json!({ "schema": "cuccut.speech/1", "words": [] });
        let parsed: SpeechBody = serde_json::from_value(minimal.clone()).unwrap();
        assert_eq!(serde_json::to_value(&parsed).unwrap(), minimal);
    }

    #[test]
    fn added_fields_are_checked_only_for_shape() {
        let good = json!({
            "schema": "cuccut.speech/1",
            "words": [{ "id": "w1", "text": "a", "glue": true }],
            "userBreaks": { "w1": "no-break", "gone": "break" },
            "autoBreaks": { "default": { "w1": "break" } },
            "layoutProfileId": "default",
            "paragraphBreaks": ["w1"],
            "stages": { "asr": "1:a:a:x", "aligned": { "mode": "script", "coverage": 0.9 } }
        });
        assert!(speech_body_problems(&good).is_empty());
        for bad in [
            json!({ "words": [{ "id": "w1", "glue": "yes" }] }),
            json!({ "userBreaks": { "w1": "nobreak" } }),
            json!({ "autoBreaks": { "default": ["w1"] } }),
            json!({ "paragraphBreaks": { "w1": true } }),
            json!({ "layoutProfileId": "" }),
            json!({ "stages": { "aligned": { "mode": "script", "coverage": 2 } } }),
        ] {
            assert!(!speech_body_problems(&bad).is_empty(), "{bad}");
        }
    }
}
