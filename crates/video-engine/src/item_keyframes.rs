//! After an instance's window changes, rewrite its keyframe bindings and volume envelope (video format spec §3.15, §3.9).
//!
//! There is only one set of conversions, in `timeline::keyframes`: `rewindow` for trimming and following, `split_keyframes` for splitting, and `join_keyframes` for joining. This file only converts between the two representations. The bindings' `localFrame` is converted from sequence frames to instance-local seconds, and after conversion the nearest frame is written back (when several frames land on the same frame, only the later one's value is kept). Percentages round-trip unchanged. The volume envelope's `at` is written back in microseconds after conversion (`rewindow` itself works to microseconds).

use editor_semantics::{MediaTime, Rate, Ratio};
use timeline::keyframes::{KeyTime, Keyframe as V2Keyframe, Keyframes, Rewindow, join_keyframes, rewindow, split_keyframes};

use crate::error::{EngineResult, ErrorBody, Text, kinds};
use crate::ids::new_id;
use crate::model::*;
use crate::state::VideoState;
use render_graph::envelope::envelope_keyframes;

/// An instance's keyframes (picture bindings and volume envelope): in v2's form.
fn keyframes_of(state: &VideoState, item_id: &str, fps: f64) -> EngineResult<Keyframes> {
    let placed = state.items.get(item_id).ok_or_else(|| ErrorBody::not_found(kinds::item(), item_id))?;
    let header = &state.sequence(&placed.sequence_id)?.header;
    let fail = |message: Text| ErrorBody::invalid_operation(message).entities([item_id]);
    let mut keyframes = bindings_to_timeline(header.animation_bindings.iter().filter(|b| b.target_id == item_id), fps).map_err(fail)?;
    if let Some(points) = envelope(&placed.value).filter(|p| !p.is_empty()) {
        keyframes.volume = Some(envelope_keyframes(points).map_err(|e| fail(e.into()))?);
    }
    Ok(keyframes)
}

/// Writes v2-form keyframes back to the instance: picture properties are written as bindings on the sequence (existing bindings keep their IDs, new ones are assigned IDs); volume is written back to the envelope. Properties that do not appear are removed.
fn write_keyframes(state: &mut VideoState, item_id: &str, keyframes: &Keyframes, fps: f64) -> EngineResult<()> {
    let placed = state.items.get_mut(item_id).ok_or_else(|| ErrorBody::not_found(kinds::item(), item_id))?;
    if let Some(points) = envelope_mut(&mut placed.value) {
        *points = keyframes.volume.as_deref().map(to_envelope).unwrap_or_default();
    }
    let sequence_id = placed.sequence_id.clone();
    let header = &mut state
        .sequences
        .get_mut(&sequence_id)
        .ok_or_else(|| ErrorBody::not_found(kinds::sequence(), &sequence_id))?
        .header;
    let mut kept = Vec::new();
    for property in ALL_PROPERTIES {
        let frames = keyframes.get(property.as_str()).filter(|f| !f.is_empty());
        let existing = header
            .animation_bindings
            .iter()
            .find(|b| b.target_id == item_id && b.property_path == property)
            .map(|b| b.id.clone());
        if let Some(frames) = frames {
            kept.push(AnimationBinding {
                id: existing.unwrap_or_else(|| new_id("kb")),
                target_id: item_id.to_string(),
                property_path: property,
                keyframes: to_binding_keyframes(frames, fps),
            });
        }
    }
    // Keep the order of the bindings on the sequence: replace in place; new ones are appended after.
    let mut out = Vec::with_capacity(header.animation_bindings.len());
    for binding in header.animation_bindings.drain(..) {
        if binding.target_id != item_id {
            out.push(binding);
        } else if let Some(i) = kept.iter().position(|k| k.id == binding.id) {
            out.push(kept.remove(i));
        }
    }
    out.extend(kept);
    header.animation_bindings = out;
    Ok(())
}

/// Trimming and following: the instance's window was changed by `window` (§3.15 “when trimming or following a cut changes an instance's window”).
pub(crate) fn rewindow_item(state: &mut VideoState, item_id: &str, window: Rewindow, fps: Rate) -> EngineResult<()> {
    let fps = fps.ratio().to_f64();
    let keyframes = keyframes_of(state, item_id, fps)?;
    if keyframes.is_empty() {
        return Ok(());
    }
    write_keyframes(state, item_id, &rewindow(&keyframes, window), fps)
}

/// Split: `left_id` is already the left half, and `right_id` is the new right half (which still carries the left half's keyframes). `duration` is the length before the split; `cut` is the split point in the instance's local seconds. The left half keeps the original binding IDs; the right half's bindings are new.
pub(crate) fn split_item(state: &mut VideoState, left_id: &str, right_id: &str, duration: f64, cut: f64, fps: Rate) -> EngineResult<()> {
    let fps = fps.ratio().to_f64();
    let keyframes = keyframes_of(state, left_id, fps)?;
    if keyframes.is_empty() {
        return Ok(());
    }
    let (left, right) = split_keyframes(&keyframes, duration, cut);
    write_keyframes(state, left_id, &left, fps)?;
    write_keyframes(state, right_id, &right, fps)
}

/// Join: the earlier `early` (which is `early_duration` seconds long) and the later `late` are rejoined into one. When they can be reduced to the same sequence of frames, returns the joined keyframes (`Some(None)` means neither side has any), otherwise `None`.
pub(crate) fn join_items(
    state: &VideoState,
    early: &str,
    early_duration: f64,
    late: &str,
    late_duration: f64,
    fps: Rate,
) -> EngineResult<Option<Option<Keyframes>>> {
    let fps = fps.ratio().to_f64();
    let some = |k: Keyframes| (!k.is_empty()).then_some(k);
    let a = some(keyframes_of(state, early, fps)?);
    let b = some(keyframes_of(state, late, fps)?);
    Ok(join_keyframes(a.as_ref(), early_duration, b.as_ref(), late_duration))
}

/// Writes the joined keyframes onto the instance that remains.
pub(crate) fn write_joined(state: &mut VideoState, item_id: &str, keyframes: Option<&Keyframes>, fps: Rate) -> EngineResult<()> {
    write_keyframes(state, item_id, keyframes.unwrap_or(&Keyframes::default()), fps.ratio().to_f64())
}

/// Moves `from`'s keyframes over to `to` unchanged (when joining, `keep` selected the later side).
pub(crate) fn copy_bindings(state: &mut VideoState, from: &str, to: &str) -> EngineResult<()> {
    let sequence_id = state
        .items
        .get(to)
        .ok_or_else(|| ErrorBody::not_found(kinds::item(), to))?
        .sequence_id
        .clone();
    let header = &mut state
        .sequences
        .get_mut(&sequence_id)
        .ok_or_else(|| ErrorBody::not_found(kinds::sequence(), &sequence_id))?
        .header;
    header.animation_bindings.retain(|b| b.target_id != to);
    for binding in header.animation_bindings.iter_mut().filter(|b| b.target_id == from) {
        binding.target_id = to.to_string();
    }
    Ok(())
}

const ALL_PROPERTIES: [KeyframeProperty; 7] = [
    KeyframeProperty::X,
    KeyframeProperty::Y,
    KeyframeProperty::Scale,
    KeyframeProperty::ScaleY,
    KeyframeProperty::Rot,
    KeyframeProperty::Opacity,
    KeyframeProperty::Radius,
];

/// Converts v2 frames back into bindings: seconds are rounded to the nearest frame; when several land on the same frame only the later value is kept; percentages are unchanged.
pub(crate) fn to_binding_keyframes(frames: &[V2Keyframe], fps: f64) -> Vec<Keyframe> {
    let mut out: Vec<Keyframe> = Vec::with_capacity(frames.len());
    for frame in frames {
        let (local_frame, percent) = match &frame.t {
            KeyTime::Seconds(s) => (Some((s * fps).round().max(0.0) as i64), None),
            KeyTime::Percent(_) => (None, frame.t.percent()),
        };
        match out.last_mut() {
            Some(last) if local_frame.is_some() && last.local_frame == local_frame => last.value = frame.v,
            _ => out.push(Keyframe {
                local_frame,
                percent,
                value: frame.v,
                ease: frame.ease.clone(),
            }),
        }
    }
    out
}

/// Converts v2 volume frames back into the envelope: seconds are written back as microseconds.
fn to_envelope(frames: &[V2Keyframe]) -> Vec<EnvelopePoint> {
    frames
        .iter()
        .map(|frame| {
            let (at, percent) = match &frame.t {
                KeyTime::Seconds(s) => {
                    let micros = (s * 1e6).round().max(0.0) as i128;
                    let at = Ratio::new(micros, 1_000_000).and_then(|r| MediaTime::from_ratio(r, "at").ok());
                    (at, None)
                }
                KeyTime::Percent(_) => (None, frame.t.percent()),
            };
            EnvelopePoint {
                at,
                percent,
                volume: frame.v,
                ease: frame.ease.clone(),
            }
        })
        .collect()
}

fn envelope(item: &TimelineItem) -> Option<&[EnvelopePoint]> {
    match item {
        TimelineItem::Audio(a) => Some(&a.mix.envelope),
        TimelineItem::Video(v) => Some(&v.embedded_audio.envelope),
        TimelineItem::Composition(CompositionItem { audio: Some(audio), .. }) => Some(&audio.envelope),
        _ => None,
    }
}

fn envelope_mut(item: &mut TimelineItem) -> Option<&mut Vec<EnvelopePoint>> {
    match item {
        TimelineItem::Audio(a) => Some(&mut a.mix.envelope),
        TimelineItem::Video(v) => Some(&mut v.embedded_audio.envelope),
        TimelineItem::Composition(CompositionItem { audio: Some(audio), .. }) => Some(&mut audio.envelope),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seconds_round_to_the_nearest_frame_and_collapse_on_the_same_frame() {
        let frames = [
            V2Keyframe {
                t: KeyTime::Seconds(0.0),
                v: 0.0,
                ease: None,
            },
            V2Keyframe {
                t: KeyTime::Seconds(0.01),
                v: 0.5,
                ease: None,
            },
            V2Keyframe {
                t: KeyTime::Seconds(1.0),
                v: 1.0,
                ease: Some("easeOutQuad".into()),
            },
        ];
        let out = to_binding_keyframes(&frames, 30.0);
        assert_eq!(out.len(), 2);
        assert_eq!((out[0].local_frame, out[0].value), (Some(0), 0.5));
        assert_eq!((out[1].local_frame, out[1].ease.as_deref()), (Some(30), Some("easeOutQuad")));
        let percent = to_binding_keyframes(
            &[V2Keyframe {
                t: KeyTime::Percent("12.5%".into()),
                v: 1.0,
                ease: None,
            }],
            30.0,
        );
        assert_eq!((percent[0].local_frame, percent[0].percent), (None, Some(12.5)));
    }
}
