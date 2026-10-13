//! To the end of the sequence (video format spec §3.16): an instance with `untilSequenceEnd` has no end of its own; at the end of each edit transaction it is computed from the current timeline.
//!
//! - The end is the maximum exact end of the other instances in the sequence, rounded up to a frame (the same algorithm as the sequence length of `derived`); when `fixed`, it is a fixed number of frames.
//! - If later instances follow on the same track, it is cut at their start so it does not overlap them.
//! - The length is at least 1 frame; for instances with a linear source clock, it does not exceed the asset.
//! - This is a computed value, not an edit to the instance: it is updated even if the instance or track is locked, and task protection is checked as usual.

use editor_semantics::frame_time;

use crate::error::EngineResult;
use crate::model::*;
use crate::ops::overflow;
use crate::state::{VideoState, item_range};

/// Recompute, per §3.16, the end of each `untilSequenceEnd` instance on every sequence.
pub(crate) fn settle(state: &mut VideoState) -> EngineResult<()> {
    let sequence_ids: Vec<Id> = state.sequences.keys().cloned().collect();
    for sequence_id in sequence_ids {
        settle_sequence(state, &sequence_id)?;
    }
    Ok(())
}

fn settle_sequence(state: &mut VideoState, sequence_id: &str) -> EngineResult<()> {
    let header = &state.sequences[sequence_id].header;
    let fps = header.fps;
    let fixed = match header.duration_policy {
        DurationPolicy::Fixed { frames } => Some(frames),
        DurationPolicy::Derived => None,
    };
    let mut open: Vec<(i64, Id, Id)> = Vec::new();
    let mut end_frames = 0i64;
    for placed in state.items.values().filter(|p| p.sequence_id == sequence_id) {
        let base = placed.value.base();
        match placed.value.span() {
            Some(span) if base.until_sequence_end => open.push((span.from_frame, base.id.clone(), base.track_id.clone())),
            _ if fixed.is_some() => {}
            _ => {
                let (_, end) = item_range(&placed.value, fps)?;
                let frames = editor_semantics::frames_at(end, fps).ok_or_else(overflow)?;
                end_frames = end_frames.max(frames.ceil() as i64);
            }
        }
    }
    if open.is_empty() {
        return Ok(());
    }
    let end_frames = fixed.unwrap_or(end_frames);
    open.sort();
    for (from, id, track_id) in open {
        // The next instance on the same track: its start is after this instance's start (there is no overlap, so it is at least one frame later).
        let next = state
            .items
            .values()
            .filter(|p| p.sequence_id == sequence_id && p.value.base().track_id == track_id && p.value.base().id != id)
            .filter_map(|p| p.value.span().map(|s| s.from_frame))
            .filter(|&start| start > from)
            .min();
        let mut target = end_frames.max(from + 1);
        if let Some(next) = next {
            target = target.min(next);
        }
        let current = state.items[&id].value.span().expect("只收了帧网格上的实例").end_frame();
        let mut delta = target - current;
        if delta > 0 {
            let length = frame_time(delta as i128, fps).ok_or_else(overflow)?;
            delta = crate::cuts::extension(state, &id, length, delta, fps)?.1;
        }
        if delta != 0 {
            let length = frame_time(delta.unsigned_abs() as i128, fps).ok_or_else(overflow)?;
            let signed = if delta < 0 { crate::cuts::negate(length)? } else { length };
            crate::cuts::resize_end(state, &id, signed, delta, fps)?;
        }
    }
    Ok(())
}
