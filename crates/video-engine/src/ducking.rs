//! Setting and deleting ducking rules (video format spec §3.9). Expanded into a gain envelope in `render-graph`.
//!
//! The ranges for depth and fade in/out durations, and the defaults, are taken from v2's `timeline::duck` constants.

use std::collections::BTreeSet;

use editor_semantics::{MediaTime, Ratio};
use serde_json::json;

use crate::error::{EngineResult, ErrorBody, kinds, msg};
use crate::ids::new_id;
use crate::model::*;
use crate::ops::{ensure_editable, ensure_track_editable, require_sequence};
use crate::state::{Placed, VideoState};

pub const DEFAULT_DEPTH: f64 = timeline::duck::DUCK_DEPTH_DEFAULT;

pub(crate) struct DuckingInput<'a> {
    pub sequence_id: &'a str,
    pub rule_id: Option<&'a str>,
    pub name: Option<&'a str>,
    pub enabled: Option<bool>,
    pub trigger: Option<&'a DuckingTrigger>,
    pub target: Option<&'a DuckingGroup>,
    pub depth: Option<f64>,
    pub attack: Option<&'a str>,
    pub release: Option<&'a str>,
}

/// Creates or modifies a ducking rule. Creating requires `trigger` and `target`; modifying changes only the fields given, and an empty name removes the name.
/// The tracks and instances in the target group must not be locked (the rule changes their sound). The trigger group is only read, so no such requirement applies.
pub(crate) fn set_ducking(state: &mut VideoState, input: DuckingInput<'_>) -> EngineResult<()> {
    let (sequence_id, _, _) = require_sequence(state, Some(input.sequence_id))?;
    let sequence_id = sequence_id.to_string();
    let mut rule = match input.rule_id {
        Some(id) => {
            let placed = state.ducking.get(id).ok_or_else(|| ErrorBody::not_found(kinds::ducking_rule(), id))?;
            if placed.sequence_id != sequence_id {
                return Err(ErrorBody::time_domain_mismatch(msg!(
                    "engine.duckingNotInSequence",
                    "Ducking rule {rule} does not belong to sequence {sequence}",
                    rule = id,
                    sequence = sequence_id
                )).entities([id]));
            }
            placed.value.clone()
        }
        None => {
            let (Some(trigger), Some(target)) = (input.trigger, input.target) else {
                return Err(ErrorBody::invalid_operation(msg!("engine.duckingNeedsTriggerAndTarget", "A new ducking rule needs trigger and target")));
            };
            DuckingRule {
                id: new_id("duck"),
                name: None,
                enabled: true,
                trigger: trigger.clone(),
                target: target.clone(),
                depth: DEFAULT_DEPTH,
                attack: default_ramp(timeline::duck::DUCK_ATTACK_DEFAULT, "attack")?,
                release: default_ramp(timeline::duck::DUCK_RELEASE_DEFAULT, "release")?,
            }
        }
    };
    if let Some(name) = input.name {
        let name = name.trim();
        if name.chars().count() > 200 {
            return Err(ErrorBody::invalid_operation(msg!("engine.duckingNameLength", "A ducking rule name cannot exceed 200 characters")));
        }
        rule.name = (!name.is_empty()).then(|| name.to_string());
    }
    if let Some(enabled) = input.enabled {
        rule.enabled = enabled;
    }
    if let Some(g) = input.trigger {
        rule.trigger = g.clone();
    }
    if let Some(g) = input.target {
        rule.target = g.clone();
    }
    if let Some(db) = input.depth {
        let (lo, hi) = timeline::duck::DUCK_DEPTH_RANGE;
        if !(db.is_finite() && (lo..=hi).contains(&db)) {
            return Err(ErrorBody::invalid_operation(msg!("engine.duckingDepthRange", "depth must be within [{lo}, {hi}] dB", lo, hi)).details(json!({ "depth": db })));
        }
        rule.depth = db;
    }
    if let Some(a) = input.attack {
        rule.attack = ramp(a, "attack")?;
    }
    if let Some(r) = input.release {
        rule.release = ramp(r, "release")?;
    }
    // Only the groups given in this call are validated: after a track or instance referenced in a group is deleted, the rule can still change other fields (at render time that entry matches no instance).
    if input.trigger.is_some()
        && let Some(group) = rule.trigger.group()
    {
        check_group(state, &sequence_id, group, "trigger")?;
    }
    if input.target.is_some() {
        check_group(state, &sequence_id, &rule.target, "target")?;
    }
    let trigger: BTreeSet<&Id> = rule
        .trigger
        .group()
        .map(|g| g.track_ids.iter().chain(&g.item_ids).collect())
        .unwrap_or_default();
    if let Some(shared) = rule
        .target
        .track_ids
        .iter()
        .chain(&rule.target.item_ids)
        .find(|id| trigger.contains(id))
    {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.duckingSelfTarget",
            "The same track or clip cannot both trigger and be ducked"
        )).entities([shared.clone()]));
    }
    for id in &rule.target.track_ids {
        if state.tracks.contains_key(id) {
            ensure_track_editable(state, id)?;
        }
    }
    for id in &rule.target.item_ids {
        if let Some(item) = state.items.get(id) {
            ensure_editable(state, &item.value)?;
        }
    }
    state.ducking.insert(rule.id.clone(), Placed { sequence_id, value: rule });
    Ok(())
}

pub(crate) fn remove_ducking(state: &mut VideoState, sequence_id: Option<&str>, rule_id: &str) -> EngineResult<()> {
    let placed = state
        .ducking
        .get(rule_id)
        .ok_or_else(|| ErrorBody::not_found(kinds::ducking_rule(), rule_id))?;
    if let Some(seq) = sequence_id
        && placed.sequence_id != seq
    {
        return Err(ErrorBody::time_domain_mismatch(msg!(
            "engine.duckingNotInSequence",
            "Ducking rule {rule} does not belong to sequence {sequence}",
            rule = rule_id,
            sequence = seq
        )).entities([rule_id]));
    }
    for id in &placed.value.target.track_ids {
        if state.tracks.contains_key(id) {
            ensure_track_editable(state, id)?;
        }
    }
    for id in &placed.value.target.item_ids {
        if let Some(item) = state.items.get(id) {
            ensure_editable(state, &item.value)?;
        }
    }
    state.ducking.remove(rule_id);
    Ok(())
}

/// When an instance is split and its group names it, the right half is also named: both halves still trigger or are ducked as before.
pub(crate) fn follow_split(state: &mut VideoState, item_id: &str, right_id: &str) {
    for placed in state.ducking.values_mut() {
        let rule = &mut placed.value;
        for group in [rule.trigger.group_mut(), Some(&mut rule.target)].into_iter().flatten() {
            if let Some(at) = group.item_ids.iter().position(|id| id == item_id) {
                group.item_ids.insert(at + 1, right_id.to_string());
            }
        }
    }
}

/// After merging: in the group, the later item is replaced with the one that remains.
pub(crate) fn follow_join(state: &mut VideoState, early_id: &str, late_id: &str) {
    for placed in state.ducking.values_mut() {
        let rule = &mut placed.value;
        for group in [rule.trigger.group_mut(), Some(&mut rule.target)].into_iter().flatten() {
            crate::ops::replace_joined(&mut group.item_ids, early_id, late_id);
        }
    }
}

/// The group is non-empty; the tracks and instances are all in this sequence and are of a kind that carries sound (audio tracks; audio, video and composition instances).
fn check_group(state: &VideoState, sequence_id: &str, group: &DuckingGroup, field: &str) -> EngineResult<()> {
    if group.is_empty() {
        return Err(ErrorBody::invalid_operation(msg!("engine.duckingGroupEmpty", "{field} needs at least one track or clip", field)));
    }
    if group.track_ids.len() + group.item_ids.len() > 256 {
        return Err(ErrorBody::invalid_operation(msg!("engine.duckingGroupTooLarge", "{field} can have at most 256 entries", field)));
    }
    for id in &group.track_ids {
        match state.tracks.get(id) {
            Some(t) if t.sequence_id == sequence_id => {
                if !matches!(t.value.kind, TrackKind::Audio | TrackKind::Visual) {
                    return Err(ErrorBody::invalid_operation(msg!("engine.trackHasNoSound", "Track {track} has no sound", track = id)).entities([id.clone()]));
                }
            }
            Some(_) => return Err(ErrorBody::time_domain_mismatch(msg!(
                    "engine.trackNotInSequence",
                    "Track {track} does not belong to sequence {sequence}",
                    track = id,
                    sequence = sequence_id
                )).entities([id.clone()])),
            None => return Err(ErrorBody::not_found(kinds::track(), id)),
        }
    }
    for id in &group.item_ids {
        match state.items.get(id) {
            Some(p) if p.sequence_id == sequence_id => {
                if !matches!(
                    p.value,
                    TimelineItem::Audio(_) | TimelineItem::Video(_) | TimelineItem::Composition(_)
                ) {
                    return Err(ErrorBody::invalid_operation(msg!("engine.itemHasNoSound", "Clip {item} has no sound", item = id)).entities([id.clone()]));
                }
            }
            Some(_) => return Err(ErrorBody::time_domain_mismatch(msg!(
                    "engine.itemNotInSequence",
                    "Clip {item} does not belong to sequence {sequence}",
                    item = id,
                    sequence = sequence_id
                )).entities([id.clone()])),
            None => return Err(ErrorBody::not_found(kinds::item(), id)),
        }
    }
    Ok(())
}

/// Fade in/out duration: decimal seconds, within `timeline::duck::DUCK_TIME_RANGE`.
fn ramp(text: &str, field: &str) -> EngineResult<MediaTime> {
    let value = editor_semantics::parse_decimal_seconds(text, field)?;
    let (lo, hi) = timeline::duck::DUCK_TIME_RANGE;
    let max = Ratio::from_int(hi as i128).expect("constant");
    if value.is_negative() || value > max {
        return Err(ErrorBody::invalid_operation(msg!("engine.secondsRange", "{field} must be between {lo} and {hi} seconds", field, lo, hi)).details(json!({ field: text })));
    }
    Ok(MediaTime::from_ratio(value, field)?)
}

/// The v2 default fades (seconds, f64) are written as decimal strings and then go through the same parsing.
fn default_ramp(seconds: f64, field: &str) -> EngineResult<MediaTime> {
    ramp(&format!("{seconds}"), field)
}
