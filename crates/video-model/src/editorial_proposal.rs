//! Body of an editorial proposal (video format spec §6.2, document `kind: 'editorial-proposal'`): ranges suggested for removal from a source material.
//!
//! The engine's `proposeCuts` writes it by detecting verbal tics and long pauses in the transcript; `acceptCutSuggestions` compiles the accepted suggestions into cuts (`ref` is the suggestion's ID)
//! and marks them `accepted`; `putDocument` checks it with [`editorial_proposal_body_problems`] on write.

use editor_semantics::Ratio;
use message_ref::{Text, msg};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::Id;

pub const EDITORIAL_PROPOSAL_SCHEMA: &str = "cuccut.editorial-proposal/1";
pub const EDITORIAL_PROPOSAL_KIND: &str = "editorial-proposal";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorialProposalBody {
    /// `cuccut.editorial-proposal/1`。
    pub schema: String,
    /// Ticks per second.
    pub timescale: u64,
    /// `source-asset`: times are on the clock of the edited material.
    pub clock: String,
    /// The transcript version the detection read: if the transcript is edited afterwards, the suggestions expire and can no longer be accepted.
    pub speech_ref: ProposalSpeechRef,
    /// Sorted by `t0`.
    pub suggestions: Vec<Suggestion>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSpeechRef {
    pub id: Id,
    pub revision: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SuggestionKind {
    /// Verbal tic: `wordIds` are the words to cut.
    Filler,
    /// Long pause: compressed to the kept length; `afterWordId` is the word before the pause.
    Pause,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SuggestionStatus {
    Pending,
    Accepted,
}

/// One suggestion: the source range `[t0, t1)` suggested for removal; integer ticks are written as decimal strings.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub id: Id,
    pub kind: SuggestionKind,
    pub t0: String,
    pub t1: String,
    /// The words in the range (verbal tic).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub word_ids: Vec<Id>,
    /// The word before the pause (pause).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after_word_id: Option<Id>,
    /// The text in the range: for a verbal tic, the original text of these words; for a pause, empty.
    pub text: String,
    /// Reason: the short sentence written by the detector, shown as is.
    pub reason: String,
    /// Additional notes, such as the length of a pause before and after compression.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub detail: String,
    /// 0–1; absent when the detector cannot give one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    pub status: SuggestionStatus,
}

impl Suggestion {
    /// The exact range of the suggestion on the source material's clock (seconds). `None` when the ticks are not integers.
    pub fn range(&self, timescale: u64) -> Option<(Ratio, Ratio)> {
        let at = |ticks: &str| Ratio::new(ticks.parse::<i128>().ok()?, i128::from(timescale));
        Some((at(&self.t0)?, at(&self.t1)?))
    }
}

/// Places where the body does not match §6.2 (empty means it matches): shape, `schema`, `clock`, `timescale`, ticks, `0 ≤ t0 < t1`, sorted by `t0`;
/// `confidence` between 0 and 1, and suggestion ids not repeated. Suggestions may overlap each other.
pub fn editorial_proposal_body_problems(body: &Value) -> Vec<Text> {
    let parsed = match serde_json::from_value::<EditorialProposalBody>(body.clone()) {
        Ok(parsed) => parsed,
        Err(error) => return vec![msg!("videoModel.bodyShape", "The body has fields of the wrong shape: {error}", error = error.to_string())],
    };
    let mut problems = Vec::new();
    if parsed.schema != EDITORIAL_PROPOSAL_SCHEMA {
        problems.push(msg!("videoModel.schemaMismatch", "schema must be {schema}", schema = EDITORIAL_PROPOSAL_SCHEMA));
    }
    if parsed.clock != "source-asset" {
        problems.push(msg!("videoModel.clockSourceAsset", "clock must be source-asset"));
    }
    if parsed.timescale == 0 || parsed.timescale > editor_semantics::MAX_SAFE_INTEGER as u64 {
        problems.push(msg!("videoModel.timescaleSafeInteger", "timescale must be a positive safe integer"));
        return problems;
    }
    let mut previous: Option<Ratio> = None;
    for s in &parsed.suggestions {
        let Some((t0, t1)) = s.range(parsed.timescale) else {
            problems.push(msg!(
                "videoModel.suggestionTicksNotInteger",
                "t0 and t1 of suggestion {suggestion} must be integer ticks",
                suggestion = s.id
            ));
            continue;
        };
        if t0.is_negative() || t1 <= t0 {
            problems.push(msg!("videoModel.suggestionRangeInvalid", "Suggestion {suggestion} must satisfy 0 ≤ t0 < t1", suggestion = s.id));
        }
        if previous.is_some_and(|p| t0 < p) {
            problems.push(msg!("videoModel.suggestionOrder", "Suggestion {suggestion} is not sorted by t0", suggestion = s.id));
        }
        previous = Some(t0);
        if s.confidence.is_some_and(|c| !(0.0..=1.0).contains(&c)) {
            problems.push(msg!(
                "videoModel.suggestionConfidence",
                "confidence of suggestion {suggestion} must be between 0 and 1",
                suggestion = s.id
            ));
        }
    }
    let mut ids: Vec<&str> = parsed.suggestions.iter().map(|s| s.id.as_str()).collect();
    ids.sort_unstable();
    if ids.windows(2).any(|w| w[0] == w[1]) {
        problems.push(msg!("videoModel.suggestionIdsRepeated", "Suggestion IDs are repeated"));
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn body(suggestions: Value) -> Value {
        json!({ "schema": EDITORIAL_PROPOSAL_SCHEMA, "timescale": 1000, "clock": "source-asset",
                "speechRef": { "id": "doc_1", "revision": "1" }, "suggestions": suggestions })
    }

    #[test]
    fn body_round_trips() {
        let value = body(json!([
            { "id": "cut-fl-w1", "kind": "filler", "t0": "1000", "t1": "1400", "wordIds": ["w1"], "text": "um",
              "reason": "Filler word", "detail": "“um”", "status": "pending" },
            { "id": "cut-sl-w2", "kind": "pause", "t0": "2150", "t1": "3850", "afterWordId": "w2", "text": "",
              "reason": "Pause", "detail": "2.0s → 0.3s", "confidence": 0.5, "status": "accepted" },
        ]));
        let parsed: EditorialProposalBody = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&parsed).unwrap(), value);
        assert!(editorial_proposal_body_problems(&value).is_empty());
    }

    #[test]
    fn problems_name_ticks_order_confidence_and_ids() {
        let one = |id: &str, t0: &str, t1: &str| json!({ "id": id, "kind": "pause", "t0": t0, "t1": t1, "text": "", "reason": "Pause", "status": "pending" });
        assert_eq!(editorial_proposal_body_problems(&body(json!([one("a", "5", "5")]))).len(), 1);
        assert_eq!(editorial_proposal_body_problems(&body(json!([one("a", "0.5", "5")]))).len(), 1);
        assert_eq!(
            editorial_proposal_body_problems(&body(json!([one("a", "10", "20"), one("b", "0", "5")]))).len(),
            1
        );
        assert_eq!(
            editorial_proposal_body_problems(&body(json!([one("a", "0", "5"), one("a", "6", "9")]))).len(),
            1
        );
        let mut far = one("a", "0", "5");
        far["confidence"] = json!(2);
        assert_eq!(editorial_proposal_body_problems(&body(json!([far]))).len(), 1);
        // Unknown suggestion category (there is no detector yet for repeated segments): wrong shape.
        let repeat = json!([{ "id": "a", "kind": "repeat", "t0": "0", "t1": "1", "text": "", "reason": "", "status": "pending" }]);
        assert_eq!(editorial_proposal_body_problems(&body(repeat)).len(), 1);
    }
}
