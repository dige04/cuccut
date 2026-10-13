//! Ducking (video format spec §3.9): when someone is speaking, or when instances in the trigger group sound, the target group is lowered by `depth` dB.
//!
//! It is computed from ranges on the timeline and does not look at signal level: the result depends only on the timeline, is determined frame by frame, and preview and export match. The curve (merging ranges,
//! four-point expansion, linear gain interpolation) comes from v2's `timeline::duck`; the ranges and defaults come from the constants of `timeline::duck`.

use editor_semantics::MediaTime;
use serde::{Deserialize, Serialize};

use crate::Id;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuckingRule {
    pub id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub enabled: bool,
    /// When to lower: when someone is speaking, or when these instances sound.
    pub trigger: DuckingTrigger,
    /// The tracks or instances being lowered.
    pub target: DuckingGroup,
    /// The dB lowered, [0, 60], default 10.
    pub depth: f64,
    /// How long before the trigger starts the drop begins, [0, 5] seconds.
    pub attack: MediaTime,
    /// How long after the trigger ends the level recovers, [0, 5] seconds.
    pub release: MediaTime,
}

/// The ducking trigger.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum DuckingTrigger {
    /// By script: the range on the sequence of each word in the current effective word stream.
    Speech,
    /// By instance: the ranges in which these instances in the group sound.
    Items(DuckingGroup),
}

impl DuckingTrigger {
    /// The group used when triggering by instance; there is none when triggering by script.
    pub fn group(&self) -> Option<&DuckingGroup> {
        match self {
            DuckingTrigger::Speech => None,
            DuckingTrigger::Items(group) => Some(group),
        }
    }

    pub fn group_mut(&mut self) -> Option<&mut DuckingGroup> {
        match self {
            DuckingTrigger::Speech => None,
            DuckingTrigger::Items(group) => Some(group),
        }
    }
}

/// A group of tracks and instances. A track includes all instances on it; an entry pointing to a track or instance that no longer exists has no effect.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuckingGroup {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub track_ids: Vec<Id>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub item_ids: Vec<Id>,
}

impl DuckingGroup {
    pub fn is_empty(&self) -> bool {
        self.track_ids.is_empty() && self.item_ids.is_empty()
    }

    /// Whether an instance is in this group: the instance itself is named, or the track it is on is named.
    pub fn contains(&self, item_id: &str, track_id: &str) -> bool {
        self.item_ids.iter().any(|id| id == item_id) || self.track_ids.iter().any(|id| id == track_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn triggers_round_trip() {
        let speech = json!({ "kind": "speech" });
        let items = json!({ "kind": "items", "trackIds": ["t1"] });
        let a: DuckingTrigger = serde_json::from_value(speech.clone()).unwrap();
        let b: DuckingTrigger = serde_json::from_value(items.clone()).unwrap();
        assert_eq!(a, DuckingTrigger::Speech);
        assert_eq!(serde_json::to_value(&a).unwrap(), speech);
        assert_eq!(serde_json::to_value(&b).unwrap(), items);
        assert!(b.group().is_some_and(|g| g.contains("x", "t1")));
    }
}
