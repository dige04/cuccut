//! BCF `animate` → channel IR → `MotionProgram` (design §5.7).
//!
//! In phase 1 the BCF path is a **structural** refactor; the output contract stays byte-for-byte unchanged. `Channel/Kf` and
//! `sample_frames` remain the compatibility layer (design §5.3). `deep_resolve`/`resolve_ref`/
//! `mix_value` stay in `ccut-core`: they depend on `Ctx`, `$vars/$theme/$assets` and
//! `Rgba`, so they belong to the BCF document domain rather than the animation kernel (plan §4.1).

use serde_json::Value;

use crate::MotionError;
use crate::composite::{CompositeMode, PostOp};
use crate::curve::CurveSpec;
use crate::interpolate::InterpolatorSpec;
use crate::preset_registry::TransitionRecipe;
use crate::program::{
    Fill, MotionProgram, MotionSegment, PropertyTrack, SegmentKind, TargetId, TimeBase,
};
use crate::relative_value::LengthContext;
use crate::value::{MotionValue, PropertyId};

/// A keyframe. `v` is the **raw JSON**, and `typed` is the strongly typed view.
///
/// Keeping both is deliberate (plan §4.4): `sample_frames` `clone()`s the raw value at both ends,
/// and `record_node` then reads it back with `as_f64`, so an integer `0` must always stay `Number(0)` rather than
/// `0.0`. `to_channels()` therefore restores the original by construction, rather than relying on luck to re-serialize to a match.
#[derive(Clone, Debug, PartialEq)]
pub struct KfIr {
    pub t: f64,
    pub v: Value,
    pub ease: Option<String>,
    pub typed: MotionValue,
}

impl KfIr {
    pub fn new(prop: &str, t: f64, v: Value, ease: Option<String>) -> Self {
        let typed = MotionValue::from_json(prop, &v);
        Self { t, v, ease, typed }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ChannelIr {
    pub prop: String,
    pub frames: Vec<KfIr>,
}

/// Formulas carried over one-for-one from `ccut-core/src/resolve.rs::lay_preset_frames`:
/// the preset's `'%'` frames → absolute-time channels over `[t0, t0+dur]`.
pub fn preset_channels(kfs: &[Value], t0: f64, dur: f64) -> Vec<ChannelIr> {
    kfs.iter()
        .filter_map(|ch| {
            let prop = ch.get("prop").and_then(Value::as_str)?;
            let frames: Vec<KfIr> = ch
                .get("frames")
                .and_then(Value::as_array)
                .map(|fs| {
                    fs.iter()
                        .filter_map(|f| {
                            let ts = f.get("t").and_then(Value::as_str)?;
                            let pct: f64 = ts.strip_suffix('%')?.parse().ok()?;
                            Some(KfIr::new(
                                prop,
                                t0 + pct / 100.0 * dur,
                                f.get("v").cloned().unwrap_or(Value::Null),
                                f.get("ease").and_then(Value::as_str).map(String::from),
                            ))
                        })
                        .collect()
                })
                .unwrap_or_default();
            Some(ChannelIr {
                prop: prop.to_string(),
                frames,
            })
        })
        .collect()
}

/// Formulas carried over one-for-one from `ccut-core/src/resolve.rs::transition_channels` (spec §9, two channels).
///
/// Only the **second** keyframe carries an ease; its time is `t0 ± half`. `cut` produces zero channels.
/// One side may have several channels (`zoomThrough`'s scale + opacity), each with its own ease.
pub fn transition_channels(
    recipe: &TransitionRecipe,
    t0: f64,
    half: f64,
    ctx: &LengthContext,
    is_out: bool,
) -> Result<Vec<ChannelIr>, MotionError> {
    let mut out = Vec::with_capacity(recipe.side(is_out).len());
    for channel in recipe.side(is_out) {
        let prop = channel.prop.as_str();
        let from = channel.from.resolve(ctx)?;
        let to = channel.to.resolve(ctx)?;
        out.push(ChannelIr {
            prop: prop.to_string(),
            frames: vec![
                KfIr::new(prop, t0 - half, Value::from(from), None),
                KfIr::new(prop, t0 + half, Value::from(to), channel.ease.clone()),
            ],
        });
    }
    Ok(out)
}

fn interpolator_for(a: &MotionValue, b: &MotionValue) -> InterpolatorSpec {
    if a.as_f64().is_some() && b.as_f64().is_some() {
        InterpolatorSpec::Linear
    } else {
        InterpolatorSpec::Step
    }
}

fn curve_of(ease: Option<&str>) -> CurveSpec {
    match ease {
        Some(name) => CurveSpec::from_name(name),
        None => CurveSpec::Default,
    }
}

/// Channel IR → strongly typed program (used for the fingerprint and the phase-4 `PoseBuffer` path).
pub fn to_program(channels: &[ChannelIr]) -> MotionProgram {
    let mut program = MotionProgram::new(TimeBase::Absolute);
    for channel in channels {
        let property = PropertyId::parse(&channel.prop);
        let base = channel
            .frames
            .first()
            .map(|frame| frame.typed.clone())
            .unwrap_or(MotionValue::Discrete(Value::Null));
        let mut segments = Vec::new();
        // When the first frame carries an ease, insert a zero-length marker segment: `sample_frames` never reads the first frame's ease,
        // but `to_channels()` must restore it. The common case (no first-frame ease) produces no such segment.
        if let Some(first) = channel.frames.first()
            && first.ease.is_some()
        {
            segments.push(MotionSegment {
                t0: first.t,
                t1: first.t,
                fill_before: Fill::Hold,
                fill_after: Fill::Off,
                composite: CompositeMode::Replace,
                order: 0,
                kind: SegmentKind::Tween {
                    from: first.typed.clone(),
                    to: first.typed.clone(),
                    curve: curve_of(first.ease.as_deref()),
                    interpolator: InterpolatorSpec::Step,
                },
            });
        }
        match channel.frames.len() {
            0 => {}
            1 => {
                let only = &channel.frames[0];
                segments.push(MotionSegment {
                    t0: only.t,
                    t1: only.t,
                    fill_before: Fill::Hold,
                    fill_after: Fill::Hold,
                    composite: CompositeMode::Replace,
                    order: 0,
                    kind: SegmentKind::Hold {
                        value: only.typed.clone(),
                    },
                });
            }
            count => {
                for (index, window) in channel.frames.windows(2).enumerate() {
                    let (a, b) = (&window[0], &window[1]);
                    segments.push(MotionSegment {
                        t0: a.t,
                        t1: b.t,
                        fill_before: if index == 0 { Fill::Hold } else { Fill::Off },
                        fill_after: if index + 2 == count {
                            Fill::Hold
                        } else {
                            Fill::Off
                        },
                        composite: CompositeMode::Replace,
                        order: 0,
                        kind: SegmentKind::Tween {
                            from: a.typed.clone(),
                            to: b.typed.clone(),
                            curve: curve_of(b.ease.as_deref()),
                            interpolator: interpolator_for(&a.typed, &b.typed),
                        },
                    });
                }
            }
        }
        program.property_tracks.push(PropertyTrack {
            target: TargetId::SELF,
            property,
            // BCF legacy four slots: each channel gets one Replace track, with `order` always 0. Frame output does not go through this
            // program: `ccut-core::sample::sample_channels` resolves the replace tracks per window.
            composite: CompositeMode::Replace,
            order: 0,
            base,
            post: PostOp::None,
            optional: true,
            segments,
        });
    }
    program
}

/// The lossless inverse of `to_program`: `to_channels(to_program(chs)) == chs`.
pub fn to_channels(program: &MotionProgram) -> Vec<ChannelIr> {
    let mut out = Vec::new();
    for track in &program.property_tracks {
        let prop = track.property.as_str().to_owned();
        let mut frames: Vec<KfIr> = Vec::new();
        let mut head_ease = None;
        let mut segments = track.segments.as_slice();
        // Zero-length marker segment (first-frame ease)
        if let Some(first) = segments.first()
            && segments.len() > 1
            && first.t0 == first.t1
            && let SegmentKind::Tween { curve, .. } = &first.kind
        {
            head_ease = curve.ease_name().map(str::to_owned);
            segments = &segments[1..];
        }
        for (index, segment) in segments.iter().enumerate() {
            match &segment.kind {
                SegmentKind::Hold { value } => {
                    frames.push(KfIr {
                        t: segment.t0,
                        v: value.to_json(),
                        ease: head_ease.take(),
                        typed: value.clone(),
                    });
                }
                SegmentKind::Tween {
                    from, to, curve, ..
                } => {
                    if index == 0 {
                        frames.push(KfIr {
                            t: segment.t0,
                            v: from.to_json(),
                            ease: head_ease.take(),
                            typed: from.clone(),
                        });
                    }
                    frames.push(KfIr {
                        t: segment.t1,
                        v: to.to_json(),
                        ease: curve.ease_name().map(str::to_owned),
                        typed: to.clone(),
                    });
                }
                SegmentKind::Loop(_) => {}
            }
        }
        out.push(ChannelIr { prop, frames });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::preset_registry::{bcf_builtin, bcf_transition};
    use serde_json::json;

    fn kfs(name: &str) -> Vec<Value> {
        bcf_builtin(name)
            .and_then(|def| def.get("keyframes"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
    }

    /// ADR-M08 freeze guard: every channel of the BCF legacy four slots lowers to a single `Replace` track,
    /// with `order` always 0. Only an author who explicitly references the **new** family (`motion.*`) gets
    /// add / multiply.
    #[test]
    fn every_builtin_bcf_preset_lowers_to_single_replace_tracks() {
        for name in crate::preset_registry::ids(crate::preset_registry::Domain::BcfMotion) {
            let channels = preset_channels(&kfs(name), 1.0, 0.5);
            let program = to_program(&channels);
            for track in &program.property_tracks {
                assert_eq!(track.composite, CompositeMode::Replace, "{name}");
                assert_eq!(track.order, 0, "{name}");
                track.assert_segments_agree();
            }
            assert_eq!(to_channels(&program), channels, "{name}");
        }
    }

    #[test]
    fn preset_frames_land_on_the_absolute_window() {
        let channels = preset_channels(&kfs("fadeIn"), 1.0, 0.4);
        assert_eq!(channels.len(), 1);
        assert_eq!(channels[0].prop, "opacity");
        assert_eq!(channels[0].frames[0].t, 1.0);
        assert_eq!(channels[0].frames[1].t, 1.4);
        // Integers stay integers (`sample_frames` clones the raw value at the endpoints)
        assert_eq!(channels[0].frames[0].v, json!(0));
        assert_eq!(channels[0].frames[1].v, json!(1));
    }

    #[test]
    fn transitions_match_the_old_sign_convention() {
        let ctx = LengthContext::canvas(1920.0, 1080.0);
        let cut = bcf_transition("cut").unwrap();
        assert!(
            transition_channels(cut, 1.0, 0.25, &ctx, true)
                .unwrap()
                .is_empty()
        );

        let left = bcf_transition("slideLeft").unwrap();
        let out = transition_channels(left, 2.0, 0.25, &ctx, true).unwrap();
        assert_eq!(out[0].prop, "x");
        assert_eq!(out[0].frames[0].t, 1.75);
        assert_eq!(out[0].frames[0].v, json!(0.0));
        assert_eq!(out[0].frames[0].ease, None);
        assert_eq!(out[0].frames[1].t, 2.25);
        assert_eq!(out[0].frames[1].v, json!(-1920.0));
        assert_eq!(out[0].frames[1].ease.as_deref(), Some("easeInOutCubic"));
        let into = transition_channels(left, 2.0, 0.25, &ctx, false).unwrap();
        assert_eq!(into[0].frames[0].v, json!(1920.0));
        assert_eq!(into[0].frames[1].v, json!(0.0));

        let up = bcf_transition("slideUp").unwrap();
        let out = transition_channels(up, 2.0, 0.25, &ctx, true).unwrap();
        assert_eq!(out[0].prop, "y");
        assert_eq!(out[0].frames[1].v, json!(-1080.0));
        let into = transition_channels(up, 2.0, 0.25, &ctx, false).unwrap();
        assert_eq!(into[0].frames[0].v, json!(1080.0));

        let down = bcf_transition("slideDown").unwrap();
        assert_eq!(
            transition_channels(down, 2.0, 0.25, &ctx, true).unwrap()[0].frames[1].v,
            json!(1080.0)
        );
        assert_eq!(
            transition_channels(down, 2.0, 0.25, &ctx, false).unwrap()[0].frames[0].v,
            json!(-1080.0)
        );

        let crossfade = bcf_transition("crossfade").unwrap();
        let out = transition_channels(crossfade, 2.0, 0.25, &ctx, true).unwrap();
        assert_eq!(out[0].prop, "opacity");
        assert_eq!(out[0].frames[0].v, json!(1.0));
        assert_eq!(out[0].frames[1].v, json!(0.0));
        assert_eq!(out[0].frames[1].ease.as_deref(), Some("easeInOutSine"));
    }

    #[test]
    fn channels_round_trip_through_the_program() {
        let mut corpus = Vec::new();
        for name in ["fadeIn", "fadeOut", "countUp", "barFill", "kenBurns"] {
            corpus.extend(preset_channels(&kfs(name), 1.25, 0.5));
        }
        let ctx = LengthContext::canvas(1920.0, 1080.0);
        for name in [
            "crossfade",
            "slideLeft",
            "slideRight",
            "slideUp",
            "slideDown",
        ] {
            let recipe = bcf_transition(name).unwrap();
            corpus.extend(transition_channels(recipe, 2.0, 0.25, &ctx, true).unwrap());
            corpus.extend(transition_channels(recipe, 2.0, 0.25, &ctx, false).unwrap());
        }
        // A first frame with an ease, single-frame channels, and property names not in the table must all round-trip unchanged.
        corpus.push(ChannelIr {
            prop: "volume".into(),
            frames: vec![
                KfIr::new("volume", 0.0, json!(1), Some("easeInSine".into())),
                KfIr::new("volume", 1.0, json!(0), None),
            ],
        });
        corpus.push(ChannelIr {
            prop: "camera".into(),
            frames: vec![KfIr::new("camera", 3.0, json!({"zoom": 1.2}), None)],
        });
        assert_eq!(to_channels(&to_program(&corpus)), corpus);
    }

    #[test]
    fn typed_scalars_agree_with_the_raw_json() {
        for channel in preset_channels(&kfs("barFill"), 0.0, 1.0) {
            for frame in &channel.frames {
                if let Some(n) = frame.v.as_f64() {
                    assert_eq!(frame.typed.as_f64(), Some(n));
                }
            }
        }
    }
}
