//! Timeline 0.1 animation slot → `MotionProgram` (design §5.7).
//!
//! Every expression shape here must match the old implementation in `ccut-timeline/src/motion.rs` bit for bit,
//! and the phase-0 golden in `core/fixtures/motion/` is a hard gate. For the key trade-offs see plan §2.1–§2.10;
//! each one is annotated with its source in the comments below.

use std::ops::Range;

use crate::composite::{CompositeMode, PoseBuffer, PostOp};
use crate::curve::{CurveSpec, EaseId, sample_curve};
use crate::interpolate::{InterpolatorSpec, mix};
use crate::loop_kernel::{ChannelKey, LoopKernel, channel_ordinal, sample_keyframes};
use crate::preset_registry::{
    LoopRecipe, Slot, SlotKeyframe, SlotRecipe, timeline_enter, timeline_exit, timeline_loop,
};
use crate::program::{
    Fill, LoopKernelRef, MotionProgram, MotionSegment, PartPlan, PresetRef, PropertyTrack,
    SegmentKind, TargetId, TimeBase,
};
use crate::relative_value::LengthBasis;
use crate::text_parts::{
    CASCADE_SPREAD_CAP, PART_DURATION_FLOOR, PartUnit, split_animation_parts, stagger_order,
};
use crate::value::{MotionValue, PropertyId};

/// Borrowed view of `AnimationSlot`. This is why `ccut-motion` does not depend on `ccut-timeline::schema`
/// (the dependency direction is `ccut-timeline → ccut-motion`, ADR-M01).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct SlotInput<'a> {
    pub preset: &'a str,
    pub preset_version: Option<u32>,
    pub dur: Option<f64>,
    pub delay: Option<f64>,
    pub intensity: Option<f64>,
    pub ease: Option<&'a str>,
    pub stagger: Option<f64>,
    pub stagger_from: Option<&'a str>,
    pub period: Option<f64>,
    pub phase: Option<f64>,
    pub seed: Option<u64>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct AnimationInput<'a> {
    pub enter: Option<SlotInput<'a>>,
    pub exit: Option<SlotInput<'a>>,
    pub r#loop: Option<SlotInput<'a>>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Window {
    pub start: f64,
    pub end: Option<f64>,
    pub project_end: f64,
}

/// The element's own size, in **multiples of the canvas short edge** (same coordinate system as the pose's `dx`/`dy`).
/// When the recipe `basis` is `selfWidth` / `selfHeight` (element animation: x:1 = one element width),
/// lowering uses this to convert displacement into short-edge ratios. When the caller passes nothing (`None`),
/// it approximates with 1 short edge (since 2026-09-08 `ccut-timeline::resolve_animation_pose` still uses this approximation, see the ledger).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ElementExtent {
    pub width: f64,
    pub height: f64,
}

fn translate_factor(basis: LengthBasis, extent: Option<ElementExtent>) -> f64 {
    match basis {
        LengthBasis::SelfWidth => extent.map_or(1.0, |e| e.width),
        LengthBasis::SelfHeight => extent.map_or(1.0, |e| e.height),
        _ => 1.0,
    }
}

/// Channel identity table (`AnimationPose::IDENTITY`). `reveal` is not in it: it is an optional track.
const POSE_CHANNELS: &[(&str, f64)] = &[
    ("opacity", 1.0),
    ("dx", 0.0),
    ("dy", 0.0),
    ("scaleX", 1.0),
    ("scaleY", 1.0),
    ("rotation", 0.0),
    ("blur", 0.0),
];

const REVEAL_IDENTITY: f64 = 1.0;

/// `motion.rs:408-410`。
pub fn slot_duration(slot: &SlotInput<'_>, recipe: &SlotRecipe) -> f64 {
    slot.dur.unwrap_or(recipe.duration).max(0.0)
}

/// `motion.rs:412-442`. Four details that are easy to get wrong:
/// 1. An explicit `exit.preset == "none"` blocks derivation and returns `None`;
/// 2. An explicit exit preset that has no recipe in the **exit table** (`drop`/`pop`/`blurIn`/
///    `typewriter`/`riseWords`/`bounce`) is likewise `None`, meaning there is no exit at all;
/// 3. The derived `dur` is the **effective enter duration** × 0.75, not the enter recipe's default duration;
/// 4. `delay: Some(0.0)` and `ease: None` (the user's enter ease is deliberately dropped),
///    `stagger`/`staggerFrom`/`period`/`phase` are all `None`,
///    and `intensity`/`seed`/`presetVersion` are inherited.
pub fn effective_exit<'a>(
    animation: &AnimationInput<'a>,
) -> Option<(SlotInput<'a>, &'static SlotRecipe)> {
    if let Some(slot) = animation.exit {
        if slot.preset == "none" {
            return None;
        }
        return timeline_exit(slot.preset).map(|recipe| (slot, recipe));
    }
    let enter = animation.enter?;
    if enter.preset == "none" {
        return None;
    }
    let enter_recipe = timeline_enter(enter.preset)?;
    let mirror = enter_recipe.mirror.as_deref()?;
    let recipe = timeline_exit(mirror)?;
    Some((
        SlotInput {
            preset: mirror,
            preset_version: enter.preset_version,
            dur: Some(slot_duration(&enter, enter_recipe) * 0.75),
            delay: Some(0.0),
            intensity: enter.intensity,
            ease: None,
            stagger: None,
            stagger_from: None,
            period: None,
            phase: None,
            seed: enter.seed,
        },
        recipe,
    ))
}

/// The per-channel tween compiled from one enter/exit slot. Both the segment layout (`MotionProgram`) and the
/// text cascade (per-part progress) share it, so the two paths cannot compute different doubles.
#[derive(Clone, Debug, PartialEq)]
pub struct SlotTween {
    pub atoms: Vec<TweenAtom>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TweenAtom {
    pub property: PropertyId,
    pub identity: f64,
    pub from: MotionValue,
    pub to: MotionValue,
    pub curve: CurveSpec,
    pub post: PostOp,
    pub optional: bool,
    /// Multi-keyframe chain (2026-09-08). When non-empty, `from`/`to`/`curve` are only a summary of the first and last
    /// keyframes; evaluation tweens segment by segment between adjacent keyframes (segment easing = the curve of the segment's end frame). Frozen recipes always leave this table empty.
    pub keys: Vec<ChannelKey>,
}

impl TweenAtom {
    fn value_at(&self, progress: f64) -> MotionValue {
        if !self.keys.is_empty() {
            let raw = sample_keyframes(&self.keys, progress.clamp(0.0, 1.0));
            return MotionValue::Scalar(self.post.apply(raw));
        }
        let eased = sample_curve(&self.curve, progress);
        let raw = mix(&self.from, &self.to, eased, InterpolatorSpec::Linear);
        match raw.as_f64() {
            Some(n) => raw.with_scalar(self.post.apply(n)),
            None => raw,
        }
    }
}

impl SlotTween {
    /// Writes the full pose for a given progress directly into `out` (used for per-part text cascades).
    pub fn write_into(&self, out: &mut PoseBuffer, progress: f64) {
        for atom in &self.atoms {
            out.write(
                &atom.property,
                atom.value_at(progress),
                CompositeMode::Replace,
                0,
                PostOp::for_property(atom.property.as_str()),
            );
        }
    }
}

/// `motion.rs:783-841`.
///
/// - `intensity <= 0.0` returns `None`, meaning the **whole set is IDENTITY**, including `reveal: None`
///   (plan §2.3). Expanding per channel would give `wipe` `reveal = Some(1.0)`,
///   which is an observable difference (the CLI's reveal pass and the GPUI `is_identity` branch).
/// - Curves are assigned per channel: `opacity → opacity_curve`, `blur`/`reveal → safe_curve`,
///   everything else → `curve` (plan §2.7).
pub fn compile_slot_tween(
    slot: &SlotInput<'_>,
    recipe: &SlotRecipe,
    entering: bool,
) -> Option<SlotTween> {
    compile_slot_tween_with(slot, recipe, entering, None)
}

/// [`compile_slot_tween`] plus element size: only affects recipes whose `basis` is `selfWidth`/`selfHeight`
/// (the frozen catalogue is all `canvasShortEdge`, so the result is bit-for-bit unchanged).
pub fn compile_slot_tween_with(
    slot: &SlotInput<'_>,
    recipe: &SlotRecipe,
    entering: bool,
    extent: Option<ElementExtent>,
) -> Option<SlotTween> {
    let intensity = slot.intensity.unwrap_or(1.0).clamp(0.0, 2.0);
    if intensity <= 0.0 {
        return None;
    }
    if !recipe.keyframes.is_empty() {
        return Some(compile_keyframe_tween(
            slot, recipe, entering, intensity, extent,
        ));
    }
    let curve = slot
        .ease
        .map(CurveSpec::from_name)
        .unwrap_or_else(|| recipe.curve.clone());
    let safe_curve = if crate::curve::curve_overshoots(&curve) {
        CurveSpec::Named(if entering {
            EaseId::EaseOutCubic
        } else {
            EaseId::EaseInCubic
        })
    } else {
        curve.clone()
    };
    // Note `unwrap_or(curve)`: when the recipe has no opacityCurve it falls back to the **user-overridden** curve.
    let opacity_curve = recipe
        .opacity_curve
        .clone()
        .unwrap_or_else(|| curve.clone());
    let opacity_curve = if crate::curve::curve_overshoots(&opacity_curve) {
        safe_curve.clone()
    } else {
        opacity_curve
    };

    // For channels the recipe does not declare, `far == identity`, so the sampled result always equals the base and no track is emitted.
    // The only exception is a NaN intensity: the old implementation turned **every** channel into NaN
    // (`identity + 0.0 * NaN`), so keeping this branch is what makes it bit-for-bit identical.
    let emit_all = !intensity.is_finite();
    let mut atoms = Vec::new();
    for (channel, identity) in POSE_CHANNELS {
        let declared = recipe.from.get(channel);
        if declared.is_none() && !emit_all {
            continue;
        }
        let channel_curve = match *channel {
            "opacity" => opacity_curve.clone(),
            "blur" => safe_curve.clone(),
            _ => curve.clone(),
        };
        // far = identity + (from - identity) * intensity（`motion.rs:817`）
        let far = identity + (declared.unwrap_or(*identity) - identity) * intensity;
        let (from, to) = if entering {
            (far, *identity)
        } else {
            (*identity, far)
        };
        atoms.push(TweenAtom {
            property: PropertyId::parse(channel),
            identity: *identity,
            from: MotionValue::Scalar(from),
            to: MotionValue::Scalar(to),
            curve: channel_curve,
            post: PostOp::for_property(channel),
            optional: false,
            keys: Vec::new(),
        });
    }
    if let Some(declared) = recipe.from.reveal {
        let far = REVEAL_IDENTITY + (declared - REVEAL_IDENTITY) * intensity;
        let (from, to) = if entering {
            (far, REVEAL_IDENTITY)
        } else {
            (REVEAL_IDENTITY, far)
        };
        atoms.push(TweenAtom {
            property: PropertyId::known("reveal"),
            identity: REVEAL_IDENTITY,
            from: MotionValue::Scalar(from),
            to: MotionValue::Scalar(to),
            curve: safe_curve,
            post: PostOp::None,
            optional: true,
            keys: Vec::new(),
        });
    }
    Some(SlotTween { atoms })
}

/// Compilation of multi-keyframe recipes (element animations):
///
/// - One [`TweenAtom`] per channel, `keys[i].value = identity + (v_i − identity)·intensity`;
///   channels a keyframe does not specify take identity; `dx`/`dy` are first converted to short-edge ratios per the recipe `basis`.
/// - `keys[i].curve` is the easing of the segment **arriving at** frame i.
///   When the user `ease` overrides, the whole chain uses it; `opacity`/`blur`/`reveal` downgrade when they meet an overshooting curve
///   (the same rule as the two-point form).
/// - Keyframes are written in the recipe's own slot direction. When `entering` differs from `recipe.slot` (mirrored fallback),
///   the chain is reversed: `at' = 1 − at`, and the segment easing travels with its segment.
/// - NaN intensity, as in the two-point form, makes every channel emit a track (`identity + 0·NaN`).
fn compile_keyframe_tween(
    slot: &SlotInput<'_>,
    recipe: &SlotRecipe,
    entering: bool,
    intensity: f64,
    extent: Option<ElementExtent>,
) -> SlotTween {
    let user_curve = slot.ease.map(CurveSpec::from_name);
    let safe = CurveSpec::Named(if entering {
        EaseId::EaseOutCubic
    } else {
        EaseId::EaseInCubic
    });
    let emit_all = !intensity.is_finite();
    let forward = entering == (recipe.slot == Slot::Enter);
    let frames: Vec<&SlotKeyframe> = if forward {
        recipe.keyframes.iter().collect()
    } else {
        recipe.keyframes.iter().rev().collect()
    };
    let curve_for = |index: usize, channel: &str| -> CurveSpec {
        // Forward: segment [k_{i-1}, k_i] uses k_i.curve. After reversal, frame m corresponds to original frame n−m,
        // and segment [r_{m-1}, r_m] is the original [k_{n−m}, k_{n−m+1}], with easing k_{n−m+1}.curve.
        let curve = match user_curve.as_ref() {
            Some(curve) => curve.clone(),
            None if index == 0 => CurveSpec::from_name("linear"),
            None if forward => frames[index].curve.clone(),
            None => frames[index - 1].curve.clone(),
        };
        if matches!(channel, "opacity" | "blur" | "reveal")
            && crate::curve::curve_overshoots(&curve)
        {
            safe.clone()
        } else {
            curve
        }
    };
    let at_of = |index: usize| -> f64 {
        if forward {
            frames[index].at
        } else {
            1.0 - frames[index].at
        }
    };
    let build = |channel: &str, identity: f64, factor: f64| -> Vec<ChannelKey> {
        frames
            .iter()
            .enumerate()
            .map(|(index, frame)| {
                let declared = frame.channels.get(channel).unwrap_or(identity);
                let value = identity + (declared * factor - identity * factor) * intensity;
                ChannelKey {
                    at: at_of(index),
                    value,
                    curve: curve_for(index, channel),
                }
            })
            .collect()
    };
    let declares = |channel: &str| frames.iter().any(|f| f.channels.get(channel).is_some());

    let mut atoms = Vec::new();
    for (channel, identity) in POSE_CHANNELS {
        if !declares(channel) && !emit_all {
            continue;
        }
        let factor = match *channel {
            "dx" => translate_factor(recipe.basis.dx, extent),
            "dy" => translate_factor(recipe.basis.dy, extent),
            _ => 1.0,
        };
        let keys = build(channel, *identity, factor);
        atoms.push(TweenAtom {
            property: PropertyId::parse(channel),
            identity: *identity,
            from: MotionValue::Scalar(keys[0].value),
            to: MotionValue::Scalar(keys[keys.len() - 1].value),
            curve: keys[keys.len() - 1].curve.clone(),
            post: PostOp::for_property(channel),
            optional: false,
            keys,
        });
    }
    if declares("reveal") {
        let keys = build("reveal", REVEAL_IDENTITY, 1.0);
        atoms.push(TweenAtom {
            property: PropertyId::known("reveal"),
            identity: REVEAL_IDENTITY,
            from: MotionValue::Scalar(keys[0].value),
            to: MotionValue::Scalar(keys[keys.len() - 1].value),
            curve: keys[keys.len() - 1].curve.clone(),
            post: PostOp::None,
            optional: true,
            keys,
        });
    }
    SlotTween { atoms }
}

/// The compile-time part of `motion.rs:893-976`. Returns per-channel kernels; empty = identity for this moment.
fn compile_loop_kernels(
    slot: &SlotInput<'_>,
    recipe: &LoopRecipe,
    extent: Option<ElementExtent>,
) -> Vec<(PropertyId, LoopKernel)> {
    let period = slot.period.unwrap_or(recipe.period);
    if period <= 0.0 {
        return Vec::new();
    }
    let intensity = slot.intensity.unwrap_or(1.0).clamp(0.0, 2.0);
    let seed = slot.seed.unwrap_or(recipe.default_seed);
    let phase_offset = slot.phase.unwrap_or(0.0);
    let emit_all = !intensity.is_finite();
    let mut kernels = Vec::new();
    if !recipe.keyframes.is_empty() {
        // Keyframe loop: per channel, the keyframes are converted to `identity + (v − identity)·intensity`.
        // No waveform and no seed/envelope (exact interpolation within the period; at keyframes it equals the declared value bit for bit).
        for (channel, identity) in POSE_CHANNELS {
            let Some(ordinal) = channel_ordinal(channel) else {
                continue;
            };
            let declared = recipe
                .keyframes
                .iter()
                .any(|frame| frame.channels.get(channel).is_some());
            if !declared && !emit_all {
                continue;
            }
            let factor = match *channel {
                "dx" => translate_factor(recipe.basis.dx, extent),
                "dy" => translate_factor(recipe.basis.dy, extent),
                _ => 1.0,
            };
            let keyframes = recipe
                .keyframes
                .iter()
                .map(|frame| {
                    let value = frame.channels.get(channel).unwrap_or(*identity);
                    ChannelKey {
                        at: frame.at,
                        value: identity + (value * factor - identity * factor) * intensity,
                        curve: frame.curve.clone(),
                    }
                })
                .collect();
            kernels.push((
                PropertyId::parse(channel),
                LoopKernel {
                    wave: recipe.wave,
                    wave_samples: recipe.wave_samples,
                    noise: None,
                    amplitude: 0.0,
                    channel_ordinal: ordinal,
                    channel_seed_stride: 0,
                    seed,
                    period,
                    phase_offset,
                    envelope: crate::loop_kernel::EnvelopeSpec::NONE,
                    identity: *identity,
                    post: PostOp::for_property(channel),
                    keyframes,
                },
            ));
        }
        return kernels;
    }
    for (channel, identity) in POSE_CHANNELS {
        let Some(ordinal) = channel_ordinal(channel) else {
            continue; // blur does not take part in the loop (`motion.rs:958`)
        };
        let declared = recipe.amplitudes.get(channel);
        if declared.is_none() && !emit_all {
            continue;
        }
        // amp * intensity is multiplied first, matching the left-associative order in `motion.rs:952-957`.
        let amplitude = declared.unwrap_or(0.0) * intensity;
        kernels.push((
            PropertyId::parse(channel),
            LoopKernel {
                wave: recipe.wave,
                wave_samples: recipe.wave_samples,
                noise: recipe.noise,
                amplitude,
                channel_ordinal: ordinal,
                channel_seed_stride: recipe.channel_seed_stride,
                seed,
                period,
                phase_offset,
                envelope: recipe.envelope,
                identity: *identity,
                post: PostOp::for_property(channel),
                keyframes: Vec::new(),
            },
        ));
    }
    kernels
}

#[derive(Clone, Debug, PartialEq)]
pub struct TimelineProgram {
    pub lifetime: f64,
    /// `TimeBase::ElementLocal`: all windows are relative to `start` (plan §2.1).
    pub program: MotionProgram,
}

struct TrackBuilder {
    tracks: Vec<PropertyTrack>,
}

impl TrackBuilder {
    fn new() -> Self {
        Self { tracks: Vec::new() }
    }

    fn push(
        &mut self,
        property: &PropertyId,
        identity: f64,
        post: PostOp,
        optional: bool,
        segment: MotionSegment,
    ) {
        if let Some(track) = self
            .tracks
            .iter_mut()
            .find(|track| &track.property == property)
        {
            track.segments.push(segment);
            return;
        }
        self.tracks.push(PropertyTrack {
            target: TargetId::SELF,
            property: property.clone(),
            // Timeline 0.1 has exactly one Replace track per property (ADR-M08 freeze): the enter / loop /
            // exit segments advance along the same track with mutually exclusive times, and the mirror of `effective_exit` is no exception.
            composite: CompositeMode::Replace,
            order: 0,
            base: MotionValue::Scalar(identity),
            post,
            optional,
            segments: vec![segment],
        });
    }
}

fn tween_segment(atom: &TweenAtom, t0: f64, t1: f64, before: Fill, after: Fill) -> MotionSegment {
    MotionSegment {
        t0,
        t1,
        fill_before: before,
        fill_after: after,
        composite: CompositeMode::Replace,
        order: 0,
        kind: SegmentKind::Tween {
            from: atom.from.clone(),
            to: atom.to.clone(),
            curve: atom.curve.clone(),
            interpolator: InterpolatorSpec::Linear,
        },
    }
}

/// The segment list of one atom over `[t0, t1]`: the two-point form has exactly one segment (bit for bit equal to [`tween_segment`]);
/// a keyframe chain is cut by `at` into head-to-tail sub-windows, each segment `[t0 + at_i·dur, t0 + at_{i+1}·dur]`
/// uses the easing of frame i+1. Padding: the first segment inherits the slot's `before`, the last segment inherits `after`, and middle segments are Off/Off
/// (adjacent segments share endpoints, so they do not overlap under `[t0, t1)` semantics). Zero-length segments are skipped, and the padding moves on to the next segment.
fn chain_segments(
    atom: &TweenAtom,
    t0: f64,
    t1: f64,
    before: Fill,
    after: Fill,
) -> Vec<MotionSegment> {
    if atom.keys.len() < 2 {
        return vec![tween_segment(atom, t0, t1, before, after)];
    }
    let duration = t1 - t0;
    let mut segments: Vec<MotionSegment> = Vec::with_capacity(atom.keys.len() - 1);
    for pair in atom.keys.windows(2) {
        let (from, to) = (&pair[0], &pair[1]);
        let begin = t0 + from.at * duration;
        let end = t0 + to.at * duration;
        if end <= begin && atom.keys.len() > 2 {
            continue;
        }
        segments.push(MotionSegment {
            t0: begin,
            t1: end,
            fill_before: Fill::Off,
            fill_after: Fill::Off,
            composite: CompositeMode::Replace,
            order: 0,
            kind: SegmentKind::Tween {
                from: MotionValue::Scalar(from.value),
                to: MotionValue::Scalar(to.value),
                curve: to.curve.clone(),
                interpolator: InterpolatorSpec::Linear,
            },
        });
    }
    if segments.is_empty() {
        return vec![tween_segment(atom, t0, t1, before, after)];
    }
    segments[0].fill_before = before;
    let last = segments.len() - 1;
    segments[last].fill_after = after;
    segments
}

/// The compile-time part of `motion.rs:500-567`. `None` = illegal lifetime → the caller returns IDENTITY.
pub fn lower_timeline_animation(
    animation: &AnimationInput<'_>,
    win: Window,
) -> Option<TimelineProgram> {
    lower_timeline_animation_with(animation, win, None)
}

/// [`lower_timeline_animation`] plus element size (see [`ElementExtent`]). The frozen catalogue's
/// recipes do not read `extent`, so the two entry points are bit-for-bit identical for them.
pub fn lower_timeline_animation_with(
    animation: &AnimationInput<'_>,
    win: Window,
    extent: Option<ElementExtent>,
) -> Option<TimelineProgram> {
    let end = win.end.unwrap_or(win.project_end);
    let lifetime = end - win.start;
    if !lifetime.is_finite() || lifetime <= 0.0 {
        return None;
    }
    let half = lifetime * 0.5;

    let enter_window = animation.enter.and_then(|slot| {
        if slot.preset == "none" {
            return None;
        }
        let recipe = timeline_enter(slot.preset)?;
        let duration = slot_duration(&slot, recipe).min(half);
        let delay = slot
            .delay
            .unwrap_or(0.0)
            .max(0.0)
            .min((half - duration).max(0.0));
        Some((delay, delay + duration, slot, recipe))
    });
    let exit = effective_exit(animation);
    let exit_window = exit.as_ref().map(|(slot, recipe)| {
        let duration = slot_duration(slot, recipe).min(half);
        let delay = slot
            .delay
            .unwrap_or(0.0)
            .max(0.0)
            .min((half - duration).max(0.0));
        (lifetime - delay - duration, lifetime - delay)
    });
    let idle_begin = enter_window.map_or(0.0, |(_, finish, _, _)| finish);
    let idle_end = exit_window.map_or(lifetime, |(begin, _)| begin);

    let mut builder = TrackBuilder::new();
    let mut program = MotionProgram::new(TimeBase::ElementLocal);

    // ① Enter: `[begin, finish)`, Hold on the left (progress clamped to 0 when `local < begin`),
    //    Off on the right (`local >= finish` is handed to loop / exit / identity).
    if let Some((begin, finish, slot, recipe)) = enter_window {
        program.sources.push(PresetRef {
            id: format!("timeline.enter.{}", recipe.id),
            version: recipe.version,
            manifest_hash: recipe.manifest_hash,
        });
        if let Some(tween) = compile_slot_tween_with(&slot, recipe, true, extent) {
            for atom in &tween.atoms {
                for segment in chain_segments(atom, begin, finish, Fill::Hold, Fill::Off) {
                    builder.push(
                        &atom.property,
                        atom.identity,
                        atom.post,
                        atom.optional,
                        segment,
                    );
                }
            }
        }
    }

    // ② Idle loop: `[idle_begin, idle_end]`. The right endpoint is covered by fill_after only when there is **no exit**:
    //    when the exit is absent, `idle_end == lifetime`, and `local == lifetime` still takes the loop
    //    branch (`motion.rs:566`). When there is an exit it must be Off: the exit recipe may not drive some channel
    //    (`fade` only moves opacity), so on that channel the loop segment is the last segment, and Hold would drag the loop value
    //    all the way to the end of the element.
    if let Some(slot) = animation.r#loop.filter(|slot| slot.preset != "none")
        && idle_end > idle_begin
        && let Some(recipe) = timeline_loop(slot.preset)
    {
        program.sources.push(PresetRef {
            id: format!("timeline.loop.{}", recipe.id),
            version: recipe.version,
            manifest_hash: recipe.manifest_hash,
        });
        for (property, kernel) in compile_loop_kernels(&slot, recipe, extent) {
            let identity = kernel.identity;
            let post = kernel.post;
            let index = program.loop_kernels.len();
            program.loop_kernels.push(kernel);
            builder.push(
                &property,
                identity,
                post,
                false,
                MotionSegment {
                    t0: idle_begin,
                    t1: idle_end,
                    fill_before: Fill::Off,
                    fill_after: if exit_window.is_some() {
                        Fill::Off
                    } else {
                        Fill::Hold
                    },
                    composite: CompositeMode::Replace,
                    order: 0,
                    kind: SegmentKind::Loop(LoopKernelRef(index)),
                },
            );
        }
    }

    // ③ Exit: `[begin, finish]`, Hold on the right (progress clamped to 1 when `local > finish`).
    if let (Some((slot, recipe)), Some((begin, finish))) = (exit.as_ref(), exit_window) {
        program.sources.push(PresetRef {
            id: format!("timeline.exit.{}", recipe.id),
            version: recipe.version,
            manifest_hash: recipe.manifest_hash,
        });
        if let Some(tween) = compile_slot_tween_with(slot, recipe, false, extent) {
            for atom in &tween.atoms {
                for segment in chain_segments(atom, begin, finish, Fill::Off, Fill::Hold) {
                    builder.push(
                        &atom.property,
                        atom.identity,
                        atom.post,
                        atom.optional,
                        segment,
                    );
                }
            }
        }
    }

    program.property_tracks = builder.tracks;
    Some(TimelineProgram { lifetime, program })
}

/// The lowering result for text cascades. The three exits correspond one-to-one to the three fallbacks in `motion.rs:574-678`.
#[derive(Clone, Debug, PartialEq)]
pub enum TextLowering {
    /// Falls back to `resolve_animation_pose` (the whole container).
    Container,
    /// Falls back to `AnimationPose::IDENTITY`.
    Identity,
    Cascade(TextCascade),
}

#[derive(Clone, Debug, PartialEq)]
pub struct TextCascade {
    pub unit: PartUnit,
    pub ranges: Vec<Range<usize>>,
    pub lifetime: f64,
    /// The moment the cascade ends (element-local time); when `local >= finish`, falls back to the container.
    pub finish: f64,
    pub plan: PartPlan,
    /// `None` = `intensity <= 0`, identity for every part.
    pub tween: Option<SlotTween>,
}

/// The compile-time part of `motion.rs:574-678`.
pub fn lower_timeline_text(
    animation: &AnimationInput<'_>,
    win: Window,
    display_text: &str,
) -> TextLowering {
    let Some(slot) = animation.enter else {
        return TextLowering::Container;
    };
    let Some(plan) = crate::text_parts::stagger_plan(slot.preset) else {
        return TextLowering::Container;
    };
    let ranges = split_animation_parts(display_text, plan.unit);
    if ranges.len() <= 1 {
        return TextLowering::Container;
    }
    let end = win.end.unwrap_or(win.project_end);
    let lifetime = end - win.start;
    let Some(recipe) = timeline_enter(slot.preset) else {
        return TextLowering::Identity;
    };
    if !lifetime.is_finite() || lifetime <= 0.0 {
        return TextLowering::Identity;
    }
    let duration = slot_duration(&slot, recipe).min(lifetime * 0.5);
    let delay = slot
        .delay
        .unwrap_or(0.0)
        .max(0.0)
        .min((lifetime * 0.5 - duration).max(0.0));
    let finish = delay + duration;
    let count = ranges.len();
    // `0.5` (the upper limit on the cascade's total span) and `0.01` (the lower limit on part duration) are kernel policy constants
    // shared by every cascade recipe; only `partDur`/`stagger`/`unit` are recipe data (plan §2.10).
    let part_duration = plan
        .part_dur
        .max(PART_DURATION_FLOOR)
        .min(duration.max(0.0));
    let room = (duration - part_duration).max(0.0);
    let stagger = slot
        .stagger
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(plan.stagger);
    let spread = ((count - 1) as f64 * stagger)
        .min(CASCADE_SPREAD_CAP)
        .min(room);
    let step = spread / (count - 1) as f64;
    let orders = (0..count)
        .map(|index| stagger_order(index, count, slot.stagger_from))
        .collect();
    TextLowering::Cascade(TextCascade {
        unit: plan.unit,
        ranges,
        lifetime,
        finish,
        plan: PartPlan {
            unit: plan.unit,
            count,
            delay,
            part_duration,
            step,
            orders,
        },
        tween: compile_slot_tween(&slot, recipe, true),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::program::TargetId;
    use crate::sample::{quantize_time, sample};

    fn slot(preset: &str) -> SlotInput<'_> {
        SlotInput {
            preset,
            preset_version: Some(1),
            ..SlotInput::default()
        }
    }

    fn pose(animation: &AnimationInput<'_>, win: Window, time: f64, fps: f64) -> PoseBuffer {
        let mut buf = PoseBuffer::identity();
        let Some(lowered) = lower_timeline_animation(animation, win) else {
            return buf;
        };
        let local = (quantize_time(time, fps) - win.start).clamp(0.0, lowered.lifetime);
        sample(&lowered.program, TargetId::SELF, local, &mut buf);
        buf
    }

    /// ADR-M08 freeze guard: every recipe combination in Timeline 0.1 must lower to
    /// **exactly one `Replace` track per property**. The add / multiply of new families must not leak in here,
    /// otherwise “old projects render pixel-identical” breaks immediately.
    #[test]
    fn every_timeline_program_stays_single_replace_per_property() {
        let enters = crate::preset_registry::ids(crate::preset_registry::Domain::TimelineEnter);
        let exits = crate::preset_registry::ids(crate::preset_registry::Domain::TimelineExit);
        let loops = crate::preset_registry::ids(crate::preset_registry::Domain::TimelineLoop);
        let win = Window {
            start: 0.0,
            end: Some(6.0),
            project_end: 6.0,
        };
        for enter in &enters {
            for exit in exits.iter().map(Some).chain(std::iter::once(None)) {
                for lp in loops.iter().map(Some).chain(std::iter::once(None)) {
                    let animation = AnimationInput {
                        enter: Some(slot(enter)),
                        exit: exit.map(|id| slot(id)),
                        r#loop: lp.map(|id| slot(id)),
                    };
                    let Some(lowered) = lower_timeline_animation(&animation, win) else {
                        continue;
                    };
                    let mut seen: Vec<&str> = Vec::new();
                    for track in &lowered.program.property_tracks {
                        assert_eq!(
                            track.composite,
                            CompositeMode::Replace,
                            "{enter}/{exit:?}/{lp:?} {}",
                            track.property
                        );
                        assert_eq!(track.order, 0, "{}", track.property);
                        track.assert_segments_agree();
                        assert!(
                            !seen.contains(&track.property.as_str()),
                            "{enter}/{exit:?}/{lp:?}: {} has a second track",
                            track.property
                        );
                        seen.push(track.property.as_str());
                    }
                    assert!(
                        lowered.program.replace_overlaps().is_empty(),
                        "{enter}/{exit:?}/{lp:?}: segments overlap in time"
                    );
                }
            }
        }
    }

    #[test]
    fn enter_and_exit_windows_never_overlap() {
        // Property test from plan §2.4: a deterministic pseudo-random traversal.
        let mut state = 0x2545_F491_4F6C_DD1Du64;
        let mut next = || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            (state >> 11) as f64 / (1u64 << 53) as f64
        };
        for _ in 0..2000 {
            let lifetime = 0.01 + next() * 10.0;
            let half = lifetime * 0.5;
            let enter_dur = (next() * 3.0).min(half);
            let enter_delay = (next() * 3.0).max(0.0).min((half - enter_dur).max(0.0));
            let exit_dur = (next() * 3.0).min(half);
            let exit_delay = (next() * 3.0).max(0.0).min((half - exit_dur).max(0.0));
            let finish = enter_delay + enter_dur;
            let begin = lifetime - exit_delay - exit_dur;
            assert!(finish <= half + 1e-12, "{finish} > {half}");
            assert!(begin >= half - 1e-12, "{begin} < {half}");
            assert!(finish <= begin + 1e-12, "{finish} > {begin}");
        }
    }

    #[test]
    fn zero_intensity_returns_the_whole_identity_pose_including_reveal() {
        let mut enter = slot("wipe");
        enter.intensity = Some(0.0);
        let animation = AnimationInput {
            enter: Some(enter),
            exit: Some(slot("none")),
            r#loop: None,
        };
        let win = Window {
            start: 0.0,
            end: Some(2.0),
            project_end: 2.0,
        };
        let buf = pose(&animation, win, 0.1, 60.0);
        assert_eq!(buf.scalar("reveal"), None);
        assert_eq!(buf.scalar_or("opacity", 1.0), 1.0);
    }

    #[test]
    fn wipe_at_full_intensity_drives_reveal_only_during_the_entrance() {
        let animation = AnimationInput {
            enter: Some(slot("wipe")),
            exit: Some(slot("none")),
            r#loop: None,
        };
        let win = Window {
            start: 0.0,
            end: Some(4.0),
            project_end: 4.0,
        };
        assert_eq!(pose(&animation, win, 0.0, 60.0).scalar("reveal"), Some(0.0));
        // After the enter ends, reveal must be absent again (the `sample_loop` branch does not produce reveal).
        assert_eq!(pose(&animation, win, 2.0, 60.0).scalar("reveal"), None);
    }

    #[test]
    fn mirrored_exit_takes_three_quarters_of_the_effective_enter_duration() {
        let mut enter = slot("rise");
        enter.dur = Some(0.8);
        let animation = AnimationInput {
            enter: Some(enter),
            exit: None,
            r#loop: None,
        };
        let (exit, recipe) = effective_exit(&animation).unwrap();
        assert_eq!(exit.preset, "sink");
        assert_eq!(exit.dur, Some(0.8 * 0.75));
        assert_eq!(exit.delay, Some(0.0));
        assert_eq!(exit.ease, None);
        assert_eq!(recipe.id, "sink");
    }

    #[test]
    fn explicit_none_exit_blocks_derivation_and_missing_recipes_yield_no_exit() {
        let blocked = AnimationInput {
            enter: Some(slot("rise")),
            exit: Some(slot("none")),
            r#loop: None,
        };
        assert!(effective_exit(&blocked).is_none());
        for preset in ["pop", "blurIn", "typewriter", "riseWords", "bounce"] {
            let animation = AnimationInput {
                enter: Some(slot("rise")),
                exit: Some(slot(preset)),
                r#loop: None,
            };
            assert!(effective_exit(&animation).is_none(), "{preset}");
        }
    }

    #[test]
    fn overshooting_user_ease_degrades_only_constrained_channels() {
        let mut enter = slot("rise");
        enter.ease = Some("easeOutBack");
        let tween = compile_slot_tween(&enter, timeline_enter("rise").unwrap(), true).unwrap();
        let mut buf = PoseBuffer::identity();
        tween.write_into(&mut buf, 0.5);
        assert!((buf.scalar_or("opacity", 1.0) - 0.875).abs() < 1e-12);
        assert!(buf.scalar_or("dy", 0.0).abs() < 0.003);
    }

    #[test]
    fn pop_keeps_its_own_opacity_curve_under_an_overshooting_user_ease() {
        let mut enter = slot("pop");
        enter.ease = Some("easeOutBack");
        let tween = compile_slot_tween(&enter, timeline_enter("pop").unwrap(), true).unwrap();
        let opacity = tween
            .atoms
            .iter()
            .find(|atom| atom.property.as_str() == "opacity")
            .unwrap();
        assert_eq!(opacity.curve, CurveSpec::Named(EaseId::EaseOutExpo));
    }

    #[test]
    fn the_exit_wins_when_the_two_windows_touch_at_half() {
        let animation = AnimationInput {
            enter: Some(slot("slideL")),
            exit: Some(slot("slideR")),
            r#loop: None,
        };
        let win = Window {
            start: 0.0,
            end: Some(0.2),
            project_end: 0.2,
        };
        let mid = pose(&animation, win, 0.1, 60.0);
        assert!(mid.scalar_or("opacity", 1.0) > 0.99);
        let end = pose(&animation, win, 0.2, 60.0);
        assert_eq!(end.scalar_or("opacity", 1.0), 0.0);
    }

    #[test]
    fn loop_starts_at_identity_and_is_seek_safe() {
        let animation = AnimationInput {
            enter: None,
            exit: Some(slot("none")),
            r#loop: Some(slot("jitter")),
        };
        let win = Window {
            start: 0.0,
            end: Some(4.0),
            project_end: 4.0,
        };
        let at_start = pose(&animation, win, 0.0, 60.0);
        assert_eq!(at_start.scalar_or("dx", 0.0), 0.0);
        assert_eq!(at_start.scalar_or("dy", 0.0), 0.0);
        let first = pose(&animation, win, 1.234, 60.0);
        let second = pose(&animation, win, 1.234, 60.0);
        assert_eq!(first, second);
        assert!(first.scalar_or("dx", 0.0) != first.scalar_or("dy", 0.0));
    }

    /// Regression: the `fade` exit only drives opacity, so on `float`'s dy track the loop segment is the last segment.
    /// Its right endpoint must be Off, otherwise the loop value would be held all the way to the end of the element.
    #[test]
    fn a_loop_channel_the_exit_does_not_drive_stops_at_the_idle_end() {
        let animation = AnimationInput {
            enter: Some(slot("fade")),
            exit: Some(slot("fade")),
            r#loop: Some(slot("float")),
        };
        let win = Window {
            start: 1.0,
            end: Some(5.0),
            project_end: 10.0,
        };
        // lifetime 4 / half 2: enter [0, 0.4], idle [0.4, 3.7], exit [3.7, 4.0]
        assert!(pose(&animation, win, 4.6, 30.0).scalar_or("dy", 0.0) != 0.0);
        for t in [4.7, 4.8, 4.9, 5.0] {
            assert_eq!(
                pose(&animation, win, t, 30.0).scalar_or("dy", 0.0),
                0.0,
                "t={t}"
            );
        }
    }

    /// The reverse: when there is no exit, `local == lifetime` still falls inside the loop.
    #[test]
    fn without_an_exit_the_loop_still_covers_the_last_instant() {
        let animation = AnimationInput {
            enter: None,
            exit: Some(slot("none")),
            r#loop: Some(slot("float")),
        };
        let win = Window {
            start: 0.0,
            end: Some(3.0),
            project_end: 3.0,
        };
        // period 2.4: idle_local = 3.0 → phase 1.25 → rem_euclid 0.25 → positive peak
        assert!(pose(&animation, win, 3.0, 30.0).scalar_or("dy", 0.0) > 0.0);
    }

    #[test]
    fn text_cascade_gates_match_the_old_fallback_order() {
        let win = Window {
            start: 0.0,
            end: Some(6.0),
            project_end: 12.0,
        };
        let no_enter = AnimationInput::default();
        assert_eq!(
            lower_timeline_text(&no_enter, win, "abcde"),
            TextLowering::Container
        );
        let not_cascading = AnimationInput {
            enter: Some(slot("fade")),
            ..AnimationInput::default()
        };
        assert_eq!(
            lower_timeline_text(&not_cascading, win, "abcde"),
            TextLowering::Container
        );
        let single_part = AnimationInput {
            enter: Some(slot("typewriter")),
            ..AnimationInput::default()
        };
        assert_eq!(
            lower_timeline_text(&single_part, win, "a"),
            TextLowering::Container
        );
        let bad_window = Window {
            start: 0.0,
            end: Some(0.0),
            project_end: 0.0,
        };
        assert_eq!(
            lower_timeline_text(&single_part, bad_window, "abcde"),
            TextLowering::Identity
        );
    }

    #[test]
    fn typewriter_parts_match_the_voiceink_five_part_golden() {
        let win = Window {
            start: 0.0,
            end: Some(6.0),
            project_end: 12.0,
        };
        let animation = AnimationInput {
            enter: Some(slot("typewriter")),
            ..AnimationInput::default()
        };
        let TextLowering::Cascade(cascade) = lower_timeline_text(&animation, win, "abcde") else {
            panic!("expected cascade");
        };
        let local = quantize_time(0.05, 60.0);
        let tween = cascade.tween.as_ref().unwrap();
        let opacity: Vec<f64> = (0..cascade.plan.count)
            .map(|index| {
                let mut buf = PoseBuffer::identity();
                tween.write_into(&mut buf, cascade.plan.progress(index, local));
                buf.scalar_or("opacity", 1.0)
            })
            .collect();
        assert!((opacity[0] - 1.0).abs() < 1e-12);
        assert!((opacity[1] - 0.208_333_333_333_333_45).abs() < 1e-12);
        assert_eq!(&opacity[2..], &[0.0, 0.0, 0.0]);
    }

    // ---- 2026-09-08 element animation catalogue: multi-keyframe shapes ----

    fn scalar(buf: &PoseBuffer, prop: &str) -> f64 {
        buf.get(prop)
            .and_then(|value| value.as_f64())
            .unwrap_or_else(|| panic!("{prop} has no value"))
    }

    fn enter_only(preset: &str) -> AnimationInput<'_> {
        AnimationInput {
            enter: Some(SlotInput {
                preset,
                preset_version: Some(1),
                dur: Some(1.0),
                ..SlotInput::default()
            }),
            exit: Some(slot("none")),
            r#loop: None,
        }
    }

    const WIN: Window = Window {
        start: 0.0,
        end: Some(10.0),
        project_end: 10.0,
    };

    /// `pop`: `scale 0 → 1.2@0.7 → 0.95@0.8 → 1@1`; at the keyframes it equals the declared values bit for bit,
    /// and within a segment it eases by the segment's end frame (sinInOut).
    #[test]
    fn keyframe_enter_hits_declared_values_at_key_times() {
        let anim = enter_only("elPop");
        assert_eq!(scalar(&pose(&anim, WIN, 0.7, 1000.0), "scaleX"), 1.2);
        assert_eq!(scalar(&pose(&anim, WIN, 0.8, 1000.0), "scaleY"), 0.95);
        assert_eq!(scalar(&pose(&anim, WIN, 0.0, 1000.0), "scaleX"), 0.0);
        assert_eq!(scalar(&pose(&anim, WIN, 1.0, 1000.0), "scaleX"), 1.0);
        // 0.35 is the midpoint of the first segment (0→0.7, sinInOut): eased = 0.5, value = 0.6.
        let mid = scalar(&pose(&anim, WIN, 0.35, 1000.0), "scaleX");
        assert!((mid - 0.6).abs() < 1e-12, "{mid}");

        let anim = enter_only("elSlideBounceL");
        assert_eq!(scalar(&pose(&anim, WIN, 0.8, 1000.0), "dx"), -0.05);
        assert_eq!(scalar(&pose(&anim, WIN, 0.95, 1000.0), "dx"), 0.00675);
        assert_eq!(scalar(&pose(&anim, WIN, 0.0, 1000.0), "dx"), 1.0);

        let anim = enter_only("elBounce");
        assert_eq!(scalar(&pose(&anim, WIN, 0.8, 1000.0), "dy"), -0.05);
        assert_eq!(scalar(&pose(&anim, WIN, 0.01, 1000.0), "opacity"), 1.0);
        assert_eq!(scalar(&pose(&anim, WIN, 0.0, 1000.0), "opacity"), 0.0);
    }

    /// `selfWidth` basis: when the element size is given, `dx` is converted by element width; when not given, it is approximated with 1 short edge.
    #[test]
    fn element_extent_scales_self_relative_translate() {
        let anim = enter_only("elSlideL");
        let extent = ElementExtent {
            width: 0.4,
            height: 0.25,
        };
        let lowered = lower_timeline_animation_with(&anim, WIN, Some(extent)).unwrap();
        let mut buf = PoseBuffer::identity();
        sample(&lowered.program, TargetId::SELF, 0.0, &mut buf);
        assert_eq!(scalar(&buf, "dx"), 0.4);
        let lowered = lower_timeline_animation_with(&anim, WIN, None).unwrap();
        let mut buf = PoseBuffer::identity();
        sample(&lowered.program, TargetId::SELF, 0.0, &mut buf);
        assert_eq!(scalar(&buf, "dx"), 1.0);
        // Frozen recipes do not read extent: slideL's dx is canvasShortEdge.
        let frozen = enter_only("slideL");
        let a = lower_timeline_animation_with(&frozen, WIN, Some(extent)).unwrap();
        let b = lower_timeline_animation(&frozen, WIN).unwrap();
        assert_eq!(a, b);
    }

    /// Intensity only scales the deviation from identity: elPop@0.7 at 0.5 intensity is 1.1.
    #[test]
    fn keyframe_intensity_scales_deviation_from_identity() {
        let mut anim = enter_only("elPop");
        anim.enter.as_mut().unwrap().intensity = Some(0.5);
        assert_eq!(scalar(&pose(&anim, WIN, 0.7, 1000.0), "scaleX"), 1.1);
    }

    /// Segment layout of keyframe recipes: the first segment uses Hold-before, the last segment inherits the slot's after, middle segments are Off/Off,
    /// and adjacent segments share endpoints.
    #[test]
    fn keyframe_chain_segments_are_contiguous_with_slot_fills() {
        let anim = enter_only("elPop");
        let lowered = lower_timeline_animation(&anim, WIN).unwrap();
        let track = lowered
            .program
            .property_tracks
            .iter()
            .find(|t| t.property.as_str() == "scaleX")
            .unwrap();
        let bounds: Vec<(f64, f64)> = track.segments.iter().map(|s| (s.t0, s.t1)).collect();
        assert_eq!(bounds, vec![(0.0, 0.7), (0.7, 0.8), (0.8, 1.0)]);
        assert_eq!(track.segments[0].fill_before, Fill::Hold);
        assert_eq!(track.segments[0].fill_after, Fill::Off);
        assert_eq!(track.segments[1].fill_before, Fill::Off);
        assert_eq!(track.segments[2].fill_after, Fill::Off);
    }

    /// Mirror fallback: when an enter recipe is played backwards as an exit, the chain is reversed (`at' = 1 − at`).
    #[test]
    fn keyframe_recipe_reverses_when_used_against_its_slot() {
        let recipe = timeline_enter("elPop").unwrap();
        let tween = compile_slot_tween(&slot("elPop"), recipe, false).unwrap();
        let atom = tween
            .atoms
            .iter()
            .find(|a| a.property.as_str() == "scaleX")
            .unwrap();
        let ats: Vec<f64> = atom.keys.iter().map(|k| k.at).collect();
        for (got, want) in ats.iter().zip([0.0, 0.2, 0.3, 1.0]) {
            assert!((got - want).abs() < 1e-12, "{ats:?}");
        }
        assert_eq!(atom.value_at(ats[2]).as_f64(), Some(1.2));
        assert_eq!(atom.value_at(1.0).as_f64(), Some(0.0));
    }

    /// Keyframe loop: exact interpolation within the period; at the keyframes it equals the declared value bit for bit, and `intensity` scales the deviation.
    #[test]
    fn keyframe_loop_is_exact_at_key_phases() {
        let anim = AnimationInput {
            enter: Some(slot("none")),
            exit: Some(slot("none")),
            r#loop: Some(SlotInput {
                preset: "elHeartbeat",
                preset_version: Some(1),
                period: Some(2.0),
                ..SlotInput::default()
            }),
        };
        assert_eq!(scalar(&pose(&anim, WIN, 1.6, 1000.0), "scaleX"), 1.2);
        assert_eq!(scalar(&pose(&anim, WIN, 0.4, 1000.0), "scaleY"), 0.8);
        assert_eq!(scalar(&pose(&anim, WIN, 2.0 + 1.8, 1000.0), "scaleX"), 1.1);
        assert_eq!(scalar(&pose(&anim, WIN, 0.0, 1000.0), "scaleX"), 1.0);
        let mut half = anim;
        half.r#loop.as_mut().unwrap().intensity = Some(0.5);
        assert_eq!(scalar(&pose(&half, WIN, 1.6, 1000.0), "scaleX"), 1.1);

        let spin = AnimationInput {
            enter: Some(slot("none")),
            exit: Some(slot("none")),
            r#loop: Some(slot("elSpin")),
        };
        assert_eq!(scalar(&pose(&spin, WIN, 1.0, 1000.0), "rotation"), 180.0);
    }

    /// Every row of the element catalogue compiles, every enter has a same-named exit mirror, and `surface` is correct.
    #[test]
    fn element_catalogue_rows_are_keyframed_and_mirrored() {
        use crate::preset_registry::{Domain, RecipeSurface, ids, timeline_loop};
        for id in ids(Domain::TimelineEnter)
            .into_iter()
            .filter(|id| id.starts_with("el"))
        {
            let recipe = timeline_enter(id).unwrap();
            assert_eq!(recipe.surface, RecipeSurface::Element, "{id}");
            assert!(!recipe.keyframes.is_empty(), "{id}");
            assert!(recipe.from.get("opacity").is_none(), "{id}: from must be empty");
            assert_eq!(recipe.mirror.as_deref(), Some(id), "{id}");
            let exit = timeline_exit(id).unwrap_or_else(|| panic!("{id} is missing a same-name exit"));
            assert_eq!(exit.surface, RecipeSurface::Element);
            assert_eq!(recipe.basis.dx, LengthBasis::SelfWidth);
            assert_eq!(recipe.basis.dy, LengthBasis::SelfHeight);
            assert!(compile_slot_tween(&slot(id), recipe, true).is_some());
            assert!(compile_slot_tween(&slot(id), exit, false).is_some());
        }
        for id in ids(Domain::TimelineLoop)
            .into_iter()
            .filter(|id| id.starts_with("el"))
        {
            let recipe = timeline_loop(id).unwrap();
            assert_eq!(recipe.surface, RecipeSurface::Element, "{id}");
            assert!(!recipe.keyframes.is_empty(), "{id}");
            assert!(
                !compile_loop_kernels(&slot(id), recipe, None).is_empty(),
                "{id}"
            );
        }
        assert_eq!(
            timeline_enter("elWipeL").unwrap().edge.as_deref(),
            Some("right")
        );
        assert_eq!(
            timeline_exit("elWipeL").unwrap().edge.as_deref(),
            Some("left")
        );
        assert_eq!(timeline_enter("fade").unwrap().surface, RecipeSurface::Any);
    }
}
