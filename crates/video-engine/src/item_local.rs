//! Follow for `item-local` (video format spec §3.16): an instance keeps its position relative to its target instance. At the end of every edit transaction, positions are recomputed from the timeline before and after the transaction and from the split lineage:
//!
//! - The anchor moment is the follower's start point. If the target has a linear source clock, the anchor becomes the source moment on the target, found again on the target after the transaction (including the segments split from it): if the moment falls inside a segment, follow that segment and point the follow policy at it; if the source moment was trimmed or cut away, move to the start of the nearest segment after it (the target's new start); if it lies after all segments, extrapolate from the last segment. If the follower is before the target's start, keep the distance to the target's new start.
//! - A target with no source clock: when the target is moved as a whole, the follower moves with it; when only the start changes, the follower stays put, and if the start passes the anchor it moves to the target's new start; when split, it follows the segment containing the anchor.
//! - If the target is deleted (no segment left, including split-out ones), the follower is deleted with it, listed in the receipt's `impact.removedWithTarget`; followers of that follower are deleted too.
//! - If the follower itself was moved or trimmed in this transaction, or its follow policy was written by this transaction, it is not recomputed. It only moves and does not change length; the whole transaction is rejected if it is locked.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use editor_semantics::{FrameAlignment, Rate, Ratio, TimeMap, TimelineTimeInput, quantize_frame};

use crate::error::{EngineResult, ErrorBody, kinds, msg};
use crate::model::*;
use crate::ops::{EditContext, ItemMove, delete_items, move_item, overflow};
use crate::state::{VideoState, item_range};

/// The target to follow.
fn target_of(item: &TimelineItem) -> Option<&Id> {
    match &item.base().follow_policy {
        FollowPolicy::ItemLocal { item_id } => Some(item_id),
        _ => None,
    }
}

fn fps_of(state: &VideoState, sequence_id: &str) -> EngineResult<Rate> {
    state
        .sequences
        .get(sequence_id)
        .map(|s| s.header.fps)
        .ok_or_else(|| ErrorBody::not_found(kinds::sequence(), sequence_id))
}

/// Linear source clock: `(sourceIn, rate)`.
fn linear(item: &TimelineItem) -> EngineResult<Option<(Ratio, Ratio)>> {
    let map = match item {
        TimelineItem::Video(v) => &v.time_map,
        TimelineItem::Audio(a) => &a.time_map,
        TimelineItem::Composition(c) => &c.time_map,
        _ => return Ok(None),
    };
    Ok(match map {
        TimeMap::Linear { source_in, rate } => Some((source_in.to_ratio("sourceIn")?, rate.ratio())),
        _ => None,
    })
}

/// The instances representing the target after the transaction: the target itself and those split from it through the lineage (layer by layer), keeping only those that still exist.
fn pieces(next: &VideoState, roots: &[&Id], lineage: &BTreeMap<Id, Vec<Id>>, sequence_id: &str) -> Vec<Id> {
    let mut seen: BTreeSet<Id> = BTreeSet::new();
    let mut queue: VecDeque<Id> = roots.iter().map(|id| (*id).clone()).collect();
    while let Some(id) = queue.pop_front() {
        if !seen.insert(id.clone()) {
            continue;
        }
        for child in lineage.get(&id).into_iter().flatten() {
            queue.push_back(child.clone());
        }
    }
    seen.into_iter()
        .filter(|id| next.items.get(id).is_some_and(|p| p.sequence_id == sequence_id))
        .collect()
}

/// Recompute the positions of `item-local` followers in `next`; returns the instances deleted along with their target.
pub(crate) fn settle(before: &VideoState, next: &mut VideoState, ctx: &mut EditContext<'_>) -> EngineResult<Vec<Id>> {
    // Follow policy written by this transaction: the target must be on the same sequence.
    for placed in next.items.values() {
        let Some(target) = target_of(&placed.value) else { continue };
        let id = &placed.value.base().id;
        let written = before.items.get(id).map(|p| &p.value.base().follow_policy) != Some(&placed.value.base().follow_policy);
        if written && !next.items.get(target).is_some_and(|t| t.sequence_id == placed.sequence_id) {
            return Err(
                ErrorBody::invalid_operation(msg!(
                    "engine.itemLocalOtherSequence",
                    "The target {target} followed by clip {item} is not on the same sequence",
                    target,
                    item = id
                ))
                    .entities([id.clone(), target.clone()])
                    .details(serde_json::json!({ "rule": "item-local-target" })),
            );
        }
    }

    let mut pending: Vec<Id> = next
        .items
        .values()
        .filter(|p| {
            let base = p.value.base();
            let Some(old) = before.items.get(&base.id) else { return false };
            matches!(old.value.base().follow_policy, FollowPolicy::ItemLocal { .. })
                && matches!(base.follow_policy, FollowPolicy::ItemLocal { .. })
                && old.sequence_id == p.sequence_id
                && old.value.base().track_id == base.track_id
                && same_range(before, &old.value, next, &p.value, &p.sequence_id)
        })
        .map(|p| p.value.base().id.clone())
        .collect();

    let mut removed: Vec<Id> = Vec::new();
    // Recompute targets that are not themselves pending followers first (a follower's follower comes after it); cycles are left untouched.
    loop {
        let ready: Vec<Id> = pending
            .iter()
            .filter(|id| {
                let before_target = before.items.get(*id).and_then(|p| target_of(&p.value));
                let after_target = next.items.get(*id).and_then(|p| target_of(&p.value));
                ![before_target, after_target].into_iter().flatten().any(|t| pending.contains(t))
            })
            .cloned()
            .collect();
        if ready.is_empty() {
            break;
        }
        pending.retain(|id| !ready.contains(id));
        for id in ready {
            if follow(before, next, &id, ctx)? {
                removed.push(id);
            }
        }
    }
    Ok(removed)
}

/// The follower's range and track are unchanged before and after the transaction.
fn same_range(before: &VideoState, old: &TimelineItem, next: &VideoState, new: &TimelineItem, sequence_id: &str) -> bool {
    let (Ok(a), Ok(b)) = (fps_of(before, sequence_id), fps_of(next, sequence_id)) else {
        return false;
    };
    matches!((item_range(old, a), item_range(new, b)), (Ok(x), Ok(y)) if x == y)
}

/// Recompute one follower; returns true when the target is gone and the follower is deleted.
fn follow(before: &VideoState, next: &mut VideoState, id: &str, ctx: &mut EditContext<'_>) -> EngineResult<bool> {
    let Some(placed) = next.items.get(id) else { return Ok(false) };
    let sequence_id = placed.sequence_id.clone();
    let fps = fps_of(next, &sequence_id)?;
    let after_target = target_of(&placed.value).cloned().expect("only item-local targets are recomputed");
    let follower_before = &before.items[id].value;
    let before_target = target_of(follower_before).cloned().expect("only item-local targets are recomputed");
    let Some(target_was) = before.items.get(&before_target).filter(|p| p.sequence_id == sequence_id) else {
        return Ok(false);
    };
    let (anchor, _) = item_range(follower_before, fps_of(before, &sequence_id)?)?;
    let (s0, e0) = item_range(&target_was.value, fps_of(before, &sequence_id)?)?;

    let found = pieces(next, &[&before_target, &after_target], &ctx.lineage, &sequence_id);
    if found.is_empty() {
        delete_items(next, Some(&sequence_id), &[id.to_string()])?;
        return Ok(true);
    }
    if found == [before_target.clone()] && after_target == before_target && next.items[&before_target].value == target_was.value {
        return Ok(false);
    }
    let ranges: Vec<(Id, Ratio, Ratio)> = found
        .iter()
        .map(|p| item_range(&next.items[p].value, fps).map(|(s, e)| (p.clone(), s, e)))
        .collect::<EngineResult<_>>()?;
    let earliest = ranges.iter().min_by(|a, b| a.1.cmp(&b.1)).expect("at least one segment").clone();

    let (piece, start) = if anchor < s0 {
        // Follower is before the target's start: keep the distance to the target's new start.
        let offset = anchor.checked_sub(s0).ok_or_else(overflow)?;
        (earliest.0.clone(), earliest.1.checked_add(offset).ok_or_else(overflow)?)
    } else if let Some((source_in, rate)) = linear(&target_was.value)? {
        let source = source_in
            .checked_add(
                anchor
                    .checked_sub(s0)
                    .ok_or_else(overflow)?
                    .checked_mul(rate)
                    .ok_or_else(overflow)?,
            )
            .ok_or_else(overflow)?;
        by_source(next, &ranges, source)?.unwrap_or_else(|| (earliest.0.clone(), earliest.1))
    } else if ranges.len() > 1 {
        // Target without a source clock was split: follow the segment containing the anchor.
        let holder = ranges
            .iter()
            .find(|(_, s, e)| *s <= anchor && anchor < *e)
            .or_else(|| ranges.iter().filter(|(_, s, _)| *s <= anchor).max_by(|a, b| a.1.cmp(&b.1)))
            .unwrap_or(&earliest);
        (holder.0.clone(), anchor)
    } else {
        let (_, s1, e1) = &ranges[0];
        let moved = s1.checked_sub(s0).ok_or_else(overflow)?;
        if Some(moved) == e1.checked_sub(e0) {
            (ranges[0].0.clone(), anchor.checked_add(moved).ok_or_else(overflow)?)
        } else {
            // Only the start changed: move to the new start when the anchor is passed.
            (ranges[0].0.clone(), anchor.max(*s1))
        }
    };

    if piece != after_target
        && let Some(item) = next.items.get_mut(id)
    {
        item.value.base_mut().follow_policy = FollowPolicy::ItemLocal { item_id: piece };
    }
    if start != anchor {
        let frame = quantize_frame(start.max(Ratio::ZERO), fps, FrameAlignment::NearestFrame, "start").map_err(ErrorBody::time)?;
        let mv = ItemMove {
            item_id: id.to_string(),
            at: Some(TimelineTimeInput::Frames { value: frame }),
            offset: None,
            track_id: None,
        };
        move_item(next, Some(&sequence_id), &mv, FrameAlignment::NearestFrame, ctx)?;
    }
    Ok(false)
}

/// Position of source moment `source` on the segments after the transaction: if it falls inside a segment, take that segment; if it falls between segments or before all of them, take the start of the nearest segment after it;
/// if it lies after all segments, extrapolate from the last segment.
fn by_source(next: &VideoState, ranges: &[(Id, Ratio, Ratio)], source: Ratio) -> EngineResult<Option<(Id, Ratio)>> {
    let mut later: Option<(Ratio, &(Id, Ratio, Ratio))> = None;
    let mut earlier: Option<(Ratio, Ratio, &(Id, Ratio, Ratio))> = None;
    for range in ranges {
        let Some((source_in, rate)) = linear(&next.items[&range.0].value)? else {
            continue;
        };
        let length = range.2.checked_sub(range.1).ok_or_else(overflow)?;
        let source_out = source_in
            .checked_add(length.checked_mul(rate).ok_or_else(overflow)?)
            .ok_or_else(overflow)?;
        let at = |s: Ratio| -> EngineResult<Ratio> {
            range
                .1
                .checked_add(
                    s.checked_sub(source_in)
                        .ok_or_else(overflow)?
                        .checked_div(rate)
                        .ok_or_else(overflow)?,
                )
                .ok_or_else(overflow)
        };
        if source_in <= source && source < source_out {
            return Ok(Some((range.0.clone(), at(source)?)));
        }
        if source_in > source && later.is_none_or(|(s, _)| source_in < s) {
            later = Some((source_in, range));
        }
        if source_in <= source && earlier.is_none_or(|(s, _, _)| source_in > s) {
            earlier = Some((source_in, at(source)?, range));
        }
    }
    Ok(match (later, earlier) {
        (Some((_, range)), _) => Some((range.0.clone(), range.1)),
        (None, Some((_, time, range))) => Some((range.0.clone(), time)),
        (None, None) => None,
    })
}
