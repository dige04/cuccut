//! The body `cuccut.translation/2` of a translation document (video format spec §5.3).
//!
//! Unrecognized fields are collected into `extra` and written back unchanged (§1.4). `glossaryRef` is only stored as-is; it is not interpreted here.

use message_ref::{Text, msg};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::{Id, VersionRef};

pub const TRANSLATION_SCHEMA: &str = "cuccut.translation/2";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationBody {
    pub schema: String,
    pub language: String,
    pub source_basis: SourceBasis,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub glossary_ref: Option<Value>,
    pub units: Vec<TranslationUnit>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceBasis {
    pub speech_ref: VersionRef,
    pub sequence_id: Id,
    pub scope_lineage: Vec<Id>,
    pub edit_view_hash: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationUnit {
    pub id: Id,
    pub source_sentence_id: Id,
    /// Content fingerprint of the source sentence; an empty string means no fingerprint was recorded. Two notations are described in §5.3.
    pub source_fingerprint: String,
    pub natural_text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_rewrite: Option<DisplayRewrite>,
    /// Required field; may be null.
    #[serde(default)]
    pub alignment: Option<UnitAlignment>,
    pub status: UnitStatus,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UnitStatus {
    Draft,
    Reviewed,
    Stale,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayRewrite {
    pub text: String,
    pub reason: String,
    pub reviewed: bool,
    /// Fingerprint of the natural translation the rewrite was based on. If the natural translation changes, the rewrite becomes stale (§5.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub natural_fingerprint: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitAlignment {
    pub basis: AlignmentBasis,
    pub correspondence: Correspondence,
    pub blocks: Vec<AlignmentBlock>,
    pub source_word_ids: Vec<Id>,
    pub text_hash: String,
    /// How the translated sentence is split into pieces for display in subtitles (§5.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub split: Option<AlignmentSplit>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AlignmentBasis {
    Natural,
    DisplayRewrite,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Correspondence {
    Block,
    Sentence,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentBlock {
    pub id: Id,
    pub source_word_range: SourceWordRange,
    pub target_text_range: TargetTextRange,
    /// Minimum weight, 0–1, of the alignment edges that support the two boundaries of this block; when absent, it is unknown or deterministically constructed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    /// `local-reorder` (crossings within the block), `anchor` (contains hard anchors), `weak` (soft edges only), etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flags: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceWordRange {
    pub first_word_id: Id,
    pub last_word_id: Id,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TargetTextRange {
    pub start: u64,
    pub end: u64,
}

/// Display split (§5.3).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentSplit {
    pub mode: SplitMode,
    /// When true, the piece's `from`/`to` and the block's source-side indices refer to `sourceWordIds`; when false, they refer to the source sentence's currently visible words.
    pub word_anchored: bool,
    /// The correspondence granularity given explicitly by the writer. When absent, it is derived from `mode` and `wordAnchored`, and the result is `alignment.correspondence`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub correspondence: Option<Correspondence>,
    /// Source of the alignment edge, e.g. `deterministic/1`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligner: Option<String>,
    pub pieces: Vec<SplitPiece>,
    /// Fields left by old projects, kept only for lossless import; no longer interpreted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legacy: Option<SplitLegacy>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SplitMode {
    Independent,
    ManyToOne,
    OneToOne,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SplitPiece {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<u64>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitLegacy {
    /// Legacy word-order crossing flag: when true, this sentence is aligned only as a whole sentence.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crossing: Option<bool>,
    /// Legacy snapshot of the source subtitle line.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cue_ids: Option<Vec<Id>>,
}

/// Checks only the fields this specification adds to `cuccut.translation/2` (§5.3): `displayRewrite.naturalFingerprint`,
/// `alignment.split`, and the block's `confidence` and `flags`. Other fields are not validated here.
pub fn translation_body_problems(body: &Value) -> Vec<Text> {
    // These structures are only used to check the shape: if they parse, they are fine. Some fields are no longer read once parsed.
    #[derive(Deserialize)]
    struct Additions {
        #[serde(default)]
        units: Option<Vec<UnitAdditions>>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    #[allow(dead_code)]
    struct UnitAdditions {
        #[serde(default)]
        display_rewrite: Option<DisplayRewriteAdditions>,
        #[serde(default)]
        alignment: Option<AlignmentAdditions>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    #[allow(dead_code)]
    struct DisplayRewriteAdditions {
        #[serde(default)]
        natural_fingerprint: Option<String>,
    }
    #[derive(Deserialize)]
    struct AlignmentAdditions {
        #[serde(default)]
        blocks: Option<Vec<BlockAdditions>>,
        #[serde(default)]
        split: Option<AlignmentSplit>,
    }
    #[derive(Deserialize)]
    #[allow(dead_code)]
    struct BlockAdditions {
        #[serde(default)]
        confidence: Option<f64>,
        #[serde(default)]
        flags: Option<Vec<String>>,
    }
    let mut problems = Vec::new();
    let additions = match serde_json::from_value::<Additions>(body.clone()) {
        Ok(additions) => additions,
        Err(error) => return vec![msg!("videoModel.bodyShape", "The body has fields of the wrong shape: {error}", error = error.to_string())],
    };
    for (index, unit) in additions.units.unwrap_or_default().into_iter().enumerate() {
        let Some(alignment) = unit.alignment else { continue };
        for block in alignment.blocks.unwrap_or_default() {
            if block.confidence.is_some_and(|c| !(0.0..=1.0).contains(&c)) {
                problems.push(msg!(
                    "videoModel.blockConfidence",
                    "confidence of the alignment blocks in units[{index}] must be between 0 and 1",
                    index
                ));
            }
        }
        if let Some(split) = alignment.split {
            if split.pieces.is_empty() {
                problems.push(msg!("videoModel.splitPiecesEmpty", "alignment.split.pieces in units[{index}] cannot be empty", index));
            }
            if split
                .pieces
                .iter()
                .any(|p| matches!((p.from, p.to), (Some(from), Some(to)) if from > to))
            {
                problems.push(msg!(
                    "videoModel.splitPieceOrder",
                    "alignment.split.pieces in units[{index}] has a piece whose from is greater than to",
                    index
                ));
            }
        }
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn unit(alignment: Value) -> Value {
        json!({
            "schema": "cuccut.translation/2",
            "language": "zh",
            "sourceBasis": { "speechRef": { "id": "d1", "revision": "r1" }, "sequenceId": "q1", "scopeLineage": [], "editViewHash": "sha256:0" },
            "units": [{
                "id": "t-s-w1", "sourceSentenceId": "s-w1", "sourceFingerprint": "", "naturalText": "你好",
                "displayRewrite": { "text": "你好", "reason": "monotonic-rewrite", "reviewed": false, "naturalFingerprint": "1:a:a:x" },
                "alignment": alignment, "status": "draft"
            }]
        })
    }

    #[test]
    fn bodies_round_trip_verbatim() {
        let split = json!({
            "basis": "display-rewrite", "correspondence": "block", "sourceWordIds": ["w1", "w2"], "textHash": "sha256:1",
            "blocks": [{ "id": "b1", "sourceWordRange": { "firstWordId": "w1", "lastWordId": "w2" },
                         "targetTextRange": { "start": 0, "end": 2 }, "confidence": 0.9, "flags": ["anchor"] }],
            "split": { "mode": "many-to-one", "wordAnchored": true, "aligner": "deterministic/1",
                       "pieces": [{ "text": "你好", "from": 0, "to": 1 }], "legacy": { "crossing": true, "cueIds": ["q-w1"] } },
            "extraField": [1]
        });
        for body in [unit(split), unit(Value::Null)] {
            let parsed: TranslationBody = serde_json::from_value(body.clone()).unwrap();
            assert_eq!(serde_json::to_value(&parsed).unwrap(), body);
            assert!(translation_body_problems(&body).is_empty());
        }
    }

    #[test]
    fn added_fields_are_checked_only_for_shape() {
        for bad in [
            json!({ "units": [{ "displayRewrite": { "naturalFingerprint": 3 } }] }),
            json!({ "units": [{ "alignment": { "blocks": [{ "confidence": 2 }] } }] }),
            json!({ "units": [{ "alignment": { "blocks": [{ "flags": "weak" }] } }] }),
            json!({ "units": [{ "alignment": { "split": { "mode": "manyToOne", "wordAnchored": false, "pieces": [{ "text": "a" }] } } }] }),
            json!({ "units": [{ "alignment": { "split": { "mode": "independent", "wordAnchored": false, "pieces": [] } } }] }),
            json!({ "units": [{ "alignment": { "split": { "mode": "independent", "wordAnchored": false, "pieces": [{ "text": "a", "from": 2, "to": 1 }] } } }] }),
        ] {
            assert!(!translation_body_problems(&bad).is_empty(), "{bad}");
        }
        // A body with only the existing fields and none of the added fields is unaffected.
        assert!(translation_body_problems(&json!({ "units": [{ "alignment": null }] })).is_empty());
    }
}
