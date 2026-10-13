//! Receipts, events and history (command and protocol spec §5, §10).

use std::collections::BTreeMap;

use editor_semantics::TimeQuantizationReceipt;
use serde::{Deserialize, Serialize};
use message_ref::MessageRef;
use serde_json::Value;

use crate::model::{Actor, Id, VersionRef};
use crate::state::EntityKind;

/// A receipt exists only after the transaction has been persisted successfully. It is the sole evidence that the change actually happened.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionReceipt {
    pub transaction_id: Id,
    pub command_id: Id,
    pub status: String,
    pub video_id: Id,
    pub previous_revision: String,
    pub video_revision: String,
    pub event_seq: String,
    /// The human-readable name of a change (§3.1): the text the caller gave and any references are saved as they are; the engine's own name is in English, with a `labelRef`. When there is a reference, the UI regenerates the name in the reader's language.
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_ref: Option<MessageRef>,
    pub actor: Actor,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub undo_of: Option<Id>,
    pub created_ids: Vec<Id>,
    pub updated_ids: Vec<Id>,
    pub deleted_ids: Vec<Id>,
    /// Old instance → the instances produced from it (the left and right pieces after a split).
    pub lineage: BTreeMap<Id, Vec<Id>>,
    /// The asset or document IDs that a `ref` in an operation resolved to, so callers need not look them up in the snapshot again.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub refs: BTreeMap<String, Id>,
    pub impact: Impact,
    pub time_resolution: Vec<TimeQuantizationReceipt>,
    /// Objects explicitly kept unchanged, e.g. other instances of the same asset (acceptance T05).
    pub preserved: Vec<Id>,
    pub undo: UndoInfo,
    pub committed_at: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Impact {
    pub old_duration_frames: i64,
    pub new_duration_frames: i64,
    pub translation_units_stale: Vec<Id>,
    pub dubbing_units_stale: Vec<Id>,
    pub orphaned_anchors: Vec<Id>,
    /// Transitions deleted in this transaction because their two sides no longer abut, an instance was deleted or shortened, or the handles are not enough (video format spec §3.9).
    /// They also appear in `deletedIds`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_transitions: Vec<RemovedTransition>,
    /// One-sided transitions shortened in this transaction because their instance was shortened (effective length min(D, ⌊L/2⌋), video format spec §3.9).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shortened_transitions: Vec<ShortenedTransition>,
    /// Instances deleted with a cut point in this transaction: those lying entirely within the cut range (video format spec §3.16, §6.7). They also appear in `deletedIds`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_by_cuts: Vec<Id>,
    /// Cut points that were restored but whose seam cannot be found on the sequence to put them back: removed from the cut set, and the instances were not moved (§6.7).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cuts_not_relaid: Vec<Id>,
    /// Instances deleted together because the target they follow (`item-local`) was deleted (video format spec §3.16). They also appear in `deletedIds`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_with_target: Vec<Id>,
    /// Which layer of the code picture was changed in this transaction (code bundle spec §3.4): `replaceCodeBundle` swaps the source (code bundle version and proxy), together with the versions and lengths before and after. A shorter length means the tail was trimmed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub code_edits: Vec<CodeEdit>,
    /// Empty tracks deleted by `deleteTrack`. They also appear in `deletedIds`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_tracks: Vec<Id>,
    /// Asset records deleted by `removeAssets`, including the code bundles or pre-rendered proxies removed with them as a pair. They also appear in `deletedIds`; bytes are not deleted at this point.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removed_assets: Vec<Id>,
}

/// One change to the code picture: which layer changed, and the code bundle versions, proxies and lengths before and after.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEdit {
    pub item_id: Id,
    pub layer: CodeEditLayer,
    pub previous_bundle_ref: VersionRef,
    pub bundle_ref: VersionRef,
    #[serde(default)]
    pub previous_prerender: Option<VersionRef>,
    #[serde(default)]
    pub prerender: Option<VersionRef>,
    pub old_duration_frames: i64,
    pub new_duration_frames: i64,
}

/// The editing layer of the code picture (code bundle spec §3.4). Currently only source replacement.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEditLayer {
    Source,
}

/// A one-sided transition shortened along with its instance: the length written and the effective length.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortenedTransition {
    pub id: Id,
    pub duration_frames: i64,
    pub effective_frames: i64,
}

/// A transition that no longer holds after an edit and was removed by the engine.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedTransition {
    pub id: Id,
    pub reason: TransitionRemoval,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TransitionRemoval {
    /// One side's instance was deleted.
    ItemDeleted,
    /// The two sides are no longer adjacent on the same track.
    NotAdjacent,
    /// The instance was shortened to a window too small to hold the transition.
    TooLong,
    /// Not enough of the asset remains outside the instance for the transition.
    HandlesInsufficient,
    /// Overlaps the window of another transition on the same instance (the one that starts earlier is kept).
    Overlap,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoInfo {
    pub available: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unavailable_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unavailable_reason_ref: Option<MessageRef>,
}

/// Video event (§10.1): written to the outbox in the same transaction as the video change; delivered at least once.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoEvent {
    pub video_id: Id,
    pub event_seq: String,
    pub video_revision: String,
    pub transaction_id: Id,
    pub changed_ids: Vec<Id>,
    pub projection: Projection,
    pub actor: Actor,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_ref: Option<MessageRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub undo_of: Option<Id>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<Id>,
}

/// Projection changes that clients can consume directly: the new values of entities and the deleted entities. The new version of a sequence is given with the `sequence` entity.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Projection {
    pub upserts: Vec<EntityUpsert>,
    pub removals: Vec<EntityRemoval>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityUpsert {
    pub kind: EntityKind,
    pub id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sequence_id: Option<Id>,
    pub value: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityRemoval {
    pub kind: EntityKind,
    pub id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sequence_id: Option<Id>,
}

/// One transaction in the history.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub transaction_id: Id,
    pub command_id: Id,
    pub label: String,
    /// A reference column added after earlier transactions were committed (§3.1): shown as is, from `label`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_ref: Option<MessageRef>,
    pub actor: Actor,
    pub video_revision: String,
    pub committed_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub undo_of: Option<Id>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub undone_by: Option<Id>,
    /// 0 is a forward change, odd numbers are undos, and positive even numbers are redos.
    pub undo_depth: i64,
    pub undo_available: bool,
}
