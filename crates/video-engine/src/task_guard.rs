//! The protection scope of a task (architecture design §3.2, video format spec §3.10): a “do not change” rule that applies to one task only.
//!
//! It belongs to TaskContract and is not written into the video. When the Runtime writes within a task (agent submissions carrying taskId, and the Job and flow application results under the task), it hands the protection to the engine along with the transaction. Before commit, the engine checks it against the entity changes of that transaction; if anything is touched, the whole transaction is rejected (`TASK_PROTECTED`) and nothing is written.
//! User and manual edits do not carry it and are not restricted.
//!
//! - `video`: any change to this video;
//! - `entity`: creating, modifying, and deleting this entity itself (not its child entities; to protect content on a track, use `interval` with `trackIds`);
//! - `property`: several properties on this entity (dot-separated paths in the entity JSON, such as `text`, `style.fontSize`); deleting the entity counts as touching it;
//! - `interval`: a frame interval on the sequence; timeline instances that intersect it, before or after the change (audio is measured by its exact start and end times); when `trackIds` is given, only instances on those tracks are checked.

use editor_semantics::{Ratio, frame_time};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::error::{EngineResult, ErrorBody, Retryability, msg};
use crate::model::*;
use crate::state::{EntityChange, EntityKind, VideoState, item_range};

/// A task protection.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskProtection {
    pub protection_id: Id,
    pub target: ProtectionTarget,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProtectionTarget {
    Video,
    #[serde(rename_all = "camelCase")]
    Entity {
        entity_id: Id,
    },
    #[serde(rename_all = "camelCase")]
    Property {
        entity_id: Id,
        property_paths: Vec<String>,
    },
    #[serde(rename_all = "camelCase")]
    Interval {
        sequence_id: Id,
        span: FrameSpan,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        track_ids: Option<Vec<Id>>,
    },
}

/// Whether the changes in this transaction touch a task protection. When touched, returns `TASK_PROTECTED`: `entityIds` are the touched entities,
/// and `details.protections` lists the touched protections (`protectionId`, `target`, and the entity that touched it).
pub fn check(before: &VideoState, after: &VideoState, changes: &[EntityChange], protections: &[TaskProtection]) -> EngineResult<()> {
    if protections.is_empty() || changes.is_empty() {
        return Ok(());
    }
    let mut touched_ids: Vec<Id> = Vec::new();
    let mut hits: Vec<Value> = Vec::new();
    for protection in protections {
        let entities = touched(before, after, changes, &protection.target);
        if entities.is_empty() {
            continue;
        }
        for id in &entities {
            if !touched_ids.contains(id) {
                touched_ids.push(id.clone());
            }
        }
        hits.push(json!({
            "protectionId": protection.protection_id,
            "target": protection.target,
            "entityIds": entities,
        }));
    }
    if hits.is_empty() {
        return Ok(());
    }
    Err(ErrorBody::new(
        "TASK_PROTECTED",
        msg!(
            "engine.taskProtected",
            "This change touches what the task contract says not to change"
        ),
        Retryability::AfterUserAction,
    )
    .entities(touched_ids)
    .details(json!({ "protections": hits }))
    .recovery(msg!(
        "engine.taskProtectedRecovery",
        "Avoid the protected objects, or ask the user to adjust the protection in the task contract"
    )))
}

fn touched(before: &VideoState, after: &VideoState, changes: &[EntityChange], target: &ProtectionTarget) -> Vec<Id> {
    match target {
        ProtectionTarget::Video => changes.iter().map(|c| c.id.clone()).collect(),
        ProtectionTarget::Entity { entity_id } => changes.iter().filter(|c| &c.id == entity_id).map(|c| c.id.clone()).collect(),
        ProtectionTarget::Property { entity_id, property_paths } => changes
            .iter()
            .filter(|c| &c.id == entity_id)
            .filter(|c| match (&c.before, &c.after) {
                (Some(b), Some(a)) => property_paths.iter().any(|p| lookup(b, p) != lookup(a, p)),
                _ => true,
            })
            .map(|c| c.id.clone())
            .collect(),
        ProtectionTarget::Interval {
            sequence_id,
            span,
            track_ids,
        } => changes
            .iter()
            .filter(|c| c.kind == EntityKind::Item)
            .filter(|c| {
                [before, after]
                    .into_iter()
                    .any(|state| item_in_interval(state, &c.id, sequence_id, span, track_ids.as_deref()))
            })
            .map(|c| c.id.clone())
            .collect(),
    }
}

/// Dot-separated property path (`style.fontSize`); array indices also use dots (`keyframes.0`). None if it does not exist.
fn lookup<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let segments: Vec<String> = path.split('.').map(|s| s.replace('~', "~0").replace('/', "~1")).collect();
    value.pointer(&format!("/{}", segments.join("/")))
}

/// Instances in this state that overlap this frame interval of the sequence (intersecting counts). If the interval cannot be converted, it is conservatively counted as overlapping.
fn item_in_interval(state: &VideoState, item_id: &str, sequence_id: &str, span: &FrameSpan, track_ids: Option<&[Id]>) -> bool {
    let Some(placed) = state.items.get(item_id) else {
        return false;
    };
    if placed.sequence_id != sequence_id {
        return false;
    }
    if let Some(tracks) = track_ids
        && !tracks.iter().any(|t| t == &placed.value.base().track_id)
    {
        return false;
    }
    let Some(sequence) = state.sequences.get(sequence_id) else {
        return true;
    };
    let fps = sequence.header.fps;
    let bounds = (|| -> Option<(Ratio, Ratio, Ratio, Ratio)> {
        let from = frame_time(span.from_frame as i128, fps)?;
        let to = frame_time(span.end_frame() as i128, fps)?;
        let (start, end) = item_range(&placed.value, fps).ok()?;
        Some((from, to, start, end))
    })();
    match bounds {
        Some((from, to, start, end)) => start < to && from < end,
        None => true,
    }
}
