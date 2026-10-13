//! Authoring / composition AST (ADR-M02, design §5.2) and its compiler.
//!
//! The **legacy** lowering of Timeline / BCF still constructs `MotionProgram` directly. Segment layout, fill semantics and the
//! per-channel curves must replicate the existing formulas bit for bit, and going around through Graph would only add drift
//! surface (see §15 stage 1, deviation 5). This is the compile path for `animate.flow` / `animate.parts`:
//!
//! ```text
//! MotionGraph ──compile_flow()──► Vec<FlowTrack> (one keyframe sequence per track)
//!                                     │
//!                        ┌────────────┴────────────┐
//!                        ▼                         ▼
//!             to_program() (strongly typed segments)   ccut-core's Channel (raw Kf.v JSON)
//! ```
//!
//! **Keyframes are the only intermediate form**, so the two projections are bit-for-bit identical. The segments of
//! `MotionProgram` are generated from the same keyframe sequence by the window rules of `lower_bcf::to_program`, and `Channel`
//! takes the keyframe sequence directly. The cost is that `oscillate` / `noise` / curve objects must all be **laid out as
//! keyframes** at compile time. That also keeps `sample(t)` a pure lookup, so out-of-order sampling is consistent by nature
//! (design §11).

use serde_json::Value;

use crate::MotionError;
use crate::composite::{CompositeMode, PostOp, default_mode};
use crate::curve::{CurveSpec, sample_curve};
use crate::interpolate::InterpolatorSpec;
use crate::loop_kernel::{DEFAULT_WAVE_SAMPLES, NoiseKind, WaveKind, sampled_wave};
use crate::preset_registry::ExpandCtx;
use crate::program::PresetRef;
use crate::program::{
    Fill, MotionProgram, MotionSegment, PropertyTrack, SegmentKind, TargetId, TimeBase,
};
use crate::text_parts::{StaggerFrom, stagger_order_from};
use crate::value::{MotionValue, PropertyId};

/// Upper bound on the number of segments produced by `repeat` expansion (plan §3.2.2). A 1.2 s child × 512 ≈ 10 minutes;
/// exceeding it raises an error rather than truncating silently.
pub const REPEAT_UNROLL_CAP: usize = 512;

/// Lower bound on the sampling rate when curve objects (spring / cubicBezier / steps) are laid out as keyframes.
/// **Named** curves in the closed enum do not take this path; they are lossless on `Kf.ease`.
pub const CURVE_BAKE_MIN_FPS: f64 = 60.0;

/// Upper bound on the keyframes of a single track, blocking a combinatorial explosion from `repeat` × `oscillate`.
pub const TRACK_FRAME_CAP: usize = 20_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RepeatMode {
    Loop,
    Yoyo,
}

/// The end point of `repeat` (spec §7.5). `Until` is an **already evaluated absolute second**. TimeExpr and the `clip.start` /
/// `clip.end` reserved strings are resolved by `ccut-core` before handing over to this crate (`ccut-motion` does not depend on
/// `ccut-core`, so there is no cue table or fixed-point iteration here).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum RepeatEnd {
    Count(u32),
    Until(f64),
}

/// Amplitude: a JSON number, or an unevaluated relative-length object (spec §7.8).
pub type Amplitude = Value;

/// Variant budget (design §13): 12. `At` is an **absolute positioning** variant that stage 3 added for the `at` key of spec §7.5
/// (`at` can appear on any op; wrapping it as one layer is cleaner than adding an `Option<f64>` field to each of the 11 variants).
#[derive(Clone, Debug, PartialEq)]
pub enum MotionOp {
    Set {
        target: TargetId,
        property: PropertyId,
        value: Value,
        composite: CompositeMode,
    },
    Wait {
        dur: f64,
    },
    Tween {
        target: TargetId,
        property: PropertyId,
        from: Value,
        to: Value,
        dur: f64,
        curve: CurveSpec,
        composite: CompositeMode,
        interpolator: InterpolatorSpec,
    },
    Preset {
        target: TargetId,
        id: String,
        version: Option<u32>,
        params: serde_json::Map<String, Value>,
        /// Always `Some` after `resolve_durations()` normalization.
        dur: Option<f64>,
    },
    Parallel(Vec<MotionOp>),
    Sequence(Vec<MotionOp>),
    /// `targets` are expanded into concrete targets (a part set or an element set) at **parse time**, so the duration rule
    /// `max(item_i + order_i·gap)` remains a pure function.
    Stagger {
        item: Box<MotionOp>,
        gap: f64,
        order: StaggerFrom,
        targets: Vec<TargetId>,
    },
    Delay {
        delay: f64,
        child: Box<MotionOp>,
    },
    Repeat {
        end: RepeatEnd,
        mode: RepeatMode,
        child: Box<MotionOp>,
    },
    Oscillate {
        target: TargetId,
        property: PropertyId,
        amplitude: Amplitude,
        period: f64,
        phase: f64,
        wave: WaveKind,
        dur: f64,
        composite: CompositeMode,
    },
    Noise {
        target: TargetId,
        property: PropertyId,
        amplitude: Amplitude,
        period: f64,
        seed: u64,
        /// Channel ordinal: `effective_seed = seed + channel × 101`, the same derivation as the frozen `jitter@1` `channelSeedStride`
        /// (x / y use different sub-seeds).
        channel: u64,
        lattice: i64,
        dur: f64,
        composite: CompositeMode,
    },
    /// Absolute positioning (spec §7.5 `at`). The `delay` offset is still added on top of it, so when `use.stagger` wraps a whole
    /// flow, the absolute time moves with it (spec §10.3).
    At {
        at: f64,
        child: Box<MotionOp>,
    },
}

impl MotionOp {
    /// The normative duration rule of design §5.2 / spec §7.5.
    pub fn duration(&self) -> f64 {
        match self {
            Self::Set { .. } => 0.0,
            Self::Wait { dur } | Self::Tween { dur, .. } => *dur,
            Self::Oscillate { dur, .. } | Self::Noise { dur, .. } => *dur,
            Self::Preset { dur, .. } => dur.unwrap_or(0.0),
            Self::Parallel(children) => children
                .iter()
                .map(MotionOp::duration)
                .fold(0.0f64, f64::max),
            Self::Sequence(children) => children.iter().map(MotionOp::duration).sum(),
            Self::Stagger {
                item,
                gap,
                order,
                targets,
            } => {
                let count = targets.len();
                (0..count)
                    .map(|index| {
                        item.duration() + stagger_order_from(index, count, *order) as f64 * gap
                    })
                    .fold(0.0f64, f64::max)
            }
            Self::Delay { delay, child } => delay + child.duration(),
            Self::Repeat { end, child, .. } => match end {
                RepeatEnd::Count(count) => *count as f64 * child.duration(),
                // `until` is absolute seconds, so a relative duration cannot be expressed here and it falls back to a single child.
                // `compile` recomputes the expansion count from the absolute start and does not depend on this value.
                RepeatEnd::Until(_) => child.duration(),
            },
            Self::At { child, .. } => child.duration(),
        }
    }

    /// Time reversal (the return leg of `repeat.mode = "yoyo"`).
    ///
    /// **Only swaps `from` / `to`; does not reverse the curve**. A reversed curve would fall outside the closed enum of BCF `Kf.ease`,
    /// and it would make the flow's keyframe projection diverge from program sampling (§15 stage 3 deviation). The `easeInOutSine`
    /// example in spec §7.5 is symmetric to begin with, so swapping the endpoints is an exact mirror.
    pub fn reversed(&self) -> MotionOp {
        match self {
            Self::Tween {
                target,
                property,
                from,
                to,
                dur,
                curve,
                composite,
                interpolator,
            } => Self::Tween {
                target: *target,
                property: property.clone(),
                from: to.clone(),
                to: from.clone(),
                dur: *dur,
                curve: curve.clone(),
                composite: *composite,
                interpolator: *interpolator,
            },
            Self::Parallel(children) => {
                Self::Parallel(children.iter().map(MotionOp::reversed).collect())
            }
            Self::Sequence(children) => {
                Self::Sequence(children.iter().rev().map(MotionOp::reversed).collect())
            }
            Self::Delay { delay, child } => {
                Self::Sequence(vec![child.reversed(), Self::Wait { dur: *delay }])
            }
            Self::Stagger {
                item,
                gap,
                order,
                targets,
            } => Self::Stagger {
                item: Box::new(item.reversed()),
                gap: *gap,
                order: *order,
                targets: targets.clone(),
            },
            other => other.clone(),
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MotionGraph {
    pub root: MotionOp,
}

impl MotionGraph {
    pub fn duration(&self) -> f64 {
        self.root.duration()
    }
}

/// Compile context. `window.0` is the default start of the root node (spec §7.5: the root defaults to `clip.start`).
#[derive(Clone, Copy, Debug)]
pub struct CompileCtx {
    pub fps: f64,
    pub window: (f64, Option<f64>),
    pub project_end: f64,
    pub time_base: TimeBase,
    /// Spec §7.3: when seed is omitted, the compile-time default is 0.
    pub default_seed: u64,
}

impl Default for CompileCtx {
    fn default() -> Self {
        Self {
            fps: 30.0,
            window: (0.0, None),
            project_end: 0.0,
            time_base: TimeBase::Absolute,
            default_seed: 0,
        }
    }
}

impl CompileCtx {
    /// Sampling rate for laying curve objects out as keyframes: not below [`CURVE_BAKE_MIN_FPS`].
    fn bake_fps(&self) -> f64 {
        if self.fps.is_finite() && self.fps > CURVE_BAKE_MIN_FPS {
            self.fps
        } else {
            CURVE_BAKE_MIN_FPS
        }
    }
}

// ── Compile output ─────────────────────────────────────────────────────────

/// One keyframe. `v` is the **raw JSON** (a number, or an unevaluated relative-length object).
#[derive(Clone, Debug, PartialEq)]
pub struct FlowFrame {
    pub t: f64,
    pub v: Value,
    pub ease: Option<String>,
}

/// The keyframe sequence of one track. `(target, prop, composite, order)` is the identity of the track.
#[derive(Clone, Debug, PartialEq)]
pub struct FlowTrack {
    pub target: TargetId,
    pub prop: String,
    pub composite: CompositeMode,
    pub order: u32,
    pub frames: Vec<FlowFrame>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct CompiledFlow {
    pub tracks: Vec<FlowTrack>,
    /// Expanded recipe (provenance; not consulted during sampling).
    pub sources: Vec<PresetRef>,
    /// The alias that was matched (for the `preset-alias-used` info lint).
    pub aliases_used: Vec<String>,
}

impl CompiledFlow {
    /// Keyframes → strongly typed `MotionProgram`. Segment layout uses the same window rules as `lower_bcf::to_program`, so program
    /// sampling and keyframe sampling are bit-for-bit identical.
    pub fn to_program(&self, time_base: TimeBase) -> MotionProgram {
        let mut program = MotionProgram::new(time_base);
        for track in &self.tracks {
            let property = PropertyId::parse(&track.prop);
            let typed: Vec<MotionValue> = track
                .frames
                .iter()
                .map(|frame| MotionValue::from_json(&track.prop, &frame.v))
                .collect();
            let base = MotionValue::Scalar(crate::composite::identity_for(&track.prop));
            let mut segments = Vec::new();
            match track.frames.len() {
                0 => {}
                1 => segments.push(MotionSegment {
                    t0: track.frames[0].t,
                    t1: track.frames[0].t,
                    fill_before: Fill::Hold,
                    fill_after: Fill::Hold,
                    composite: track.composite,
                    order: track.order,
                    kind: SegmentKind::Hold {
                        value: typed[0].clone(),
                    },
                }),
                count => {
                    for index in 0..count - 1 {
                        let (a, b) = (&track.frames[index], &track.frames[index + 1]);
                        segments.push(MotionSegment {
                            t0: a.t,
                            t1: b.t,
                            fill_before: if index == 0 { Fill::Hold } else { Fill::Off },
                            fill_after: if index + 2 == count {
                                Fill::Hold
                            } else {
                                Fill::Off
                            },
                            composite: track.composite,
                            order: track.order,
                            kind: SegmentKind::Tween {
                                from: typed[index].clone(),
                                to: typed[index + 1].clone(),
                                curve: match &b.ease {
                                    Some(name) => CurveSpec::from_name(name),
                                    None => CurveSpec::Default,
                                },
                                interpolator: InterpolatorSpec::Linear,
                            },
                        });
                    }
                }
            }
            program.property_tracks.push(PropertyTrack {
                target: track.target,
                property,
                composite: track.composite,
                order: track.order,
                base,
                post: PostOp::for_property(&track.prop),
                optional: false,
                segments,
            });
        }
        program.sources = self.sources.clone();
        program
    }
}

/// `MotionGraph` → `MotionProgram` (for the keyframe projection, see [`compile_flow`]).
pub fn compile(graph: &MotionGraph, ctx: &CompileCtx) -> Result<MotionProgram, MotionError> {
    Ok(compile_flow(graph, ctx)?.to_program(ctx.time_base))
}

/// `MotionGraph` → one keyframe sequence per track.
pub fn compile_flow(graph: &MotionGraph, ctx: &CompileCtx) -> Result<CompiledFlow, MotionError> {
    let mut graph = graph.clone();
    resolve_durations(&mut graph.root)?;
    let mut out = CompiledFlow::default();
    lower_op(&graph.root, ctx.window.0, 0.0, None, ctx, &mut out)?;
    for track in &mut out.tracks {
        // Stable sort: multiple frames at the same instant keep their write order (at a `repeat` seam, the frame that arrived first
        // carries the arriving curve).
        track
            .frames
            .sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));
        // At the seams of `repeat` / `sequence`, two frames with the **same value** appear at the same instant (the end of the previous
        // pass equals the start of the next). After deduplication, the segment count equals passes × segments per pass, and
        // `to_program()` produces no zero-length segments. True steps (different values at the same instant) are kept.
        track.frames.dedup_by(|later, earlier| {
            (later.t - earlier.t).abs() < f64::EPSILON && later.v == earlier.v
        });
        if track.frames.len() > TRACK_FRAME_CAP {
            return Err(MotionError::Unsupported("flow-track-too-many-frames"));
        }
    }
    out.tracks.sort_by(|a, b| {
        a.target
            .cmp(&b.target)
            .then(a.order.cmp(&b.order))
            .then(a.prop.cmp(&b.prop))
    });
    Ok(out)
}

/// Normalization pass: fills each `preset` op's `dur` with the recipe's `defaults.dur`, so that `duration()` stays a pure
/// function (plan §3.2.0).
pub fn resolve_durations(op: &mut MotionOp) -> Result<(), MotionError> {
    match op {
        MotionOp::Preset { id, dur, .. } => {
            if dur.is_none() {
                let canonical = crate::preset_registry::canonical_id(id);
                let default = crate::preset_registry::manifest(canonical)
                    .and_then(|manifest| manifest.defaults.dur)
                    .unwrap_or(DEFAULT_PRESET_DUR);
                *dur = Some(default);
            }
            Ok(())
        }
        MotionOp::Parallel(children) | MotionOp::Sequence(children) => {
            for child in children {
                resolve_durations(child)?;
            }
            Ok(())
        }
        MotionOp::Delay { child, .. }
        | MotionOp::Repeat { child, .. }
        | MotionOp::At { child, .. } => resolve_durations(child),
        MotionOp::Stagger { item, .. } => resolve_durations(item),
        _ => Ok(()),
    }
}

/// The historical default for the `enter` slot (`dur.unwrap_or(0.5)` in `resolve.rs`).
pub const DEFAULT_PRESET_DUR: f64 = 0.5;

fn push_frames(
    out: &mut CompiledFlow,
    target: TargetId,
    prop: &str,
    composite: CompositeMode,
    order: u32,
    frames: Vec<FlowFrame>,
) {
    if frames.is_empty() {
        return;
    }
    if let Some(track) = out.tracks.iter_mut().find(|track| {
        track.target == target
            && track.prop == prop
            && track.composite == composite
            && track.order == order
    }) {
        track.frames.extend(frames);
        return;
    }
    out.tracks.push(FlowTrack {
        target,
        prop: prop.to_owned(),
        composite,
        order,
        frames,
    });
}

/// `cursor` is the start of this op, and `shift` is the offset accumulated from outer `delay`s (`at` must move with it too).
fn lower_op(
    op: &MotionOp,
    cursor: f64,
    shift: f64,
    target_override: Option<TargetId>,
    ctx: &CompileCtx,
    out: &mut CompiledFlow,
) -> Result<(), MotionError> {
    let pick = |declared: TargetId| target_override.unwrap_or(declared);
    match op {
        MotionOp::Wait { .. } => Ok(()),
        MotionOp::Set {
            target,
            property,
            value,
            composite,
        } => {
            push_frames(
                out,
                pick(*target),
                property.as_str(),
                *composite,
                0,
                vec![FlowFrame {
                    t: cursor,
                    v: value.clone(),
                    ease: None,
                }],
            );
            Ok(())
        }
        MotionOp::Tween {
            target,
            property,
            from,
            to,
            dur,
            curve,
            composite,
            ..
        } => {
            let frames = tween_frames(from, to, cursor, *dur, curve, ctx)?;
            push_frames(out, pick(*target), property.as_str(), *composite, 0, frames);
            Ok(())
        }
        MotionOp::Preset {
            target,
            id,
            version,
            params,
            dur,
        } => {
            let dur = dur.unwrap_or(DEFAULT_PRESET_DUR);
            let expanded = crate::preset_registry::expand(
                id,
                *version,
                params,
                &ExpandCtx {
                    dur,
                    default_seed: ctx.default_seed,
                },
            )?;
            for source in expanded.sources {
                if !out.sources.contains(&source) {
                    out.sources.push(source);
                }
            }
            for alias in expanded.aliases_used {
                if !out.aliases_used.contains(&alias) {
                    out.aliases_used.push(alias);
                }
            }
            for track in expanded.tracks {
                let frames = track
                    .frames
                    .into_iter()
                    .map(|frame| FlowFrame {
                        t: cursor + frame.t,
                        v: frame.v,
                        ease: frame.ease,
                    })
                    .collect();
                push_frames(
                    out,
                    pick(*target),
                    &track.prop,
                    track.composite,
                    track.order,
                    frames,
                );
            }
            Ok(())
        }
        MotionOp::Parallel(children) => {
            for child in children {
                lower_op(child, cursor, shift, target_override, ctx, out)?;
            }
            Ok(())
        }
        MotionOp::Sequence(children) => {
            let mut at = cursor;
            for child in children {
                lower_op(child, at, shift, target_override, ctx, out)?;
                at += child.duration();
            }
            Ok(())
        }
        MotionOp::Delay { delay, child } => lower_op(
            child,
            cursor + delay,
            shift + delay,
            target_override,
            ctx,
            out,
        ),
        MotionOp::At { at, child } => lower_op(child, at + shift, shift, target_override, ctx, out),
        MotionOp::Stagger {
            item,
            gap,
            order,
            targets,
        } => {
            let count = targets.len();
            for (index, target) in targets.iter().enumerate() {
                let offset = stagger_order_from(index, count, *order) as f64 * gap;
                lower_op(item, cursor + offset, shift, Some(*target), ctx, out)?;
            }
            Ok(())
        }
        MotionOp::Repeat { end, mode, child } => {
            let child_dur = child.duration();
            if !(child_dur > 0.0) {
                return Err(MotionError::Unsupported("repeat-zero-length-child"));
            }
            let count = match end {
                RepeatEnd::Count(count) => *count as usize,
                RepeatEnd::Until(until) => {
                    let span = until - cursor;
                    if span <= 0.0 {
                        0
                    } else {
                        (span / child_dur).ceil() as usize
                    }
                }
            };
            if count > REPEAT_UNROLL_CAP {
                return Err(MotionError::Unsupported("repeat-too-many"));
            }
            let reversed = child.reversed();
            for index in 0..count {
                let at = cursor + index as f64 * child_dur;
                if let RepeatEnd::Until(until) = end {
                    if at >= *until {
                        break;
                    }
                }
                let step = if *mode == RepeatMode::Yoyo && index % 2 == 1 {
                    &reversed
                } else {
                    child.as_ref()
                };
                lower_op(step, at, shift, target_override, ctx, out)?;
            }
            Ok(())
        }
        MotionOp::Oscillate {
            target,
            property,
            amplitude,
            period,
            phase,
            wave,
            dur,
            composite,
        } => {
            let frames = wave_frames(
                *wave, None, 0, amplitude, *period, *phase, cursor, *dur, ctx,
            )?;
            push_frames(out, pick(*target), property.as_str(), *composite, 0, frames);
            Ok(())
        }
        MotionOp::Noise {
            target,
            property,
            amplitude,
            period,
            seed,
            channel,
            lattice,
            dur,
            composite,
        } => {
            let spec = crate::loop_kernel::NoiseSpec {
                kind: NoiseKind::Splitmix64V1,
                lattice: *lattice,
                default_seed: 0,
            };
            let seed = seed.wrapping_add(channel.wrapping_mul(CHANNEL_SEED_STRIDE));
            let frames = wave_frames(
                WaveKind::Noise,
                Some(spec),
                seed,
                amplitude,
                *period,
                0.0,
                cursor,
                *dur,
                ctx,
            )?;
            push_frames(out, pick(*target), property.as_str(), *composite, 0, frames);
            Ok(())
        }
    }
}

/// Channel sub-seed step for the `noise` op; same value as the frozen `jitter@1` `channelSeedStride`.
pub const CHANNEL_SEED_STRIDE: u64 = 101;

/// One tween → keyframes. Named curves are kept losslessly on `ease`. Curve objects (spring / cubicBezier / steps) are **laid out
/// as linear keyframes** at compile time (§15 stage 3 deviation).
fn tween_frames(
    from: &Value,
    to: &Value,
    t0: f64,
    dur: f64,
    curve: &CurveSpec,
    ctx: &CompileCtx,
) -> Result<Vec<FlowFrame>, MotionError> {
    let ease = match curve {
        CurveSpec::Default => None,
        CurveSpec::Named(id) => Some(id.name().to_owned()),
        CurveSpec::Unknown(name) => {
            return Err(MotionError::ManifestInvalid(format!(
                "unknown easing \"{name}\""
            )));
        }
        _ => {
            // Curve objects: lay keyframes on the fps grid.
            let steps = ((dur * ctx.bake_fps()).ceil() as usize).clamp(1, TRACK_FRAME_CAP - 1);
            let mut frames = Vec::with_capacity(steps + 1);
            for index in 0..=steps {
                let progress = index as f64 / steps as f64;
                let eased = sample_curve(curve, progress);
                frames.push(FlowFrame {
                    t: t0 + dur * progress,
                    v: mix_flow_value(from, to, eased)?,
                    ease: None,
                });
            }
            return Ok(frames);
        }
    };
    Ok(vec![
        FlowFrame {
            t: t0,
            v: from.clone(),
            ease: None,
        },
        FlowFrame {
            t: t0 + dur,
            v: to.clone(),
            ease,
        },
    ])
}

/// `oscillate` / `noise` → keyframes.
///
/// Inside [`sampled_wave`] the waveform is already a **piecewise linear** function of `wave_samples` points (the `samples`-th point
/// is pinned to [`crate::loop_kernel::seam_value`]: ramp is 1, the other waveforms are 0, closing a loop with their phase-0 values).
/// So laying the breakpoints out as keyframes with linear interpolation between them gives the kernel's values bit for bit, not an approximation.
#[allow(clippy::too_many_arguments)]
fn wave_frames(
    wave: WaveKind,
    noise: Option<crate::loop_kernel::NoiseSpec>,
    seed: u64,
    amplitude: &Amplitude,
    period: f64,
    phase: f64,
    t0: f64,
    dur: f64,
    _ctx: &CompileCtx,
) -> Result<Vec<FlowFrame>, MotionError> {
    if !(period > 0.0) || !(dur > 0.0) {
        return Err(MotionError::Unsupported("oscillate-nonpositive-period"));
    }
    let samples = DEFAULT_WAVE_SAMPLES;
    let step = period / samples as f64;
    let mut breakpoints: Vec<f64> = vec![0.0];
    // The instants at which the phase crosses k/samples are the breakpoints of the piecewise linear function.
    let first = ((phase * samples as f64).ceil()) as i64;
    let mut k = first;
    loop {
        let local = (k as f64 / samples as f64 - phase) * period;
        if local >= dur {
            break;
        }
        if local > 0.0 {
            breakpoints.push(local);
        }
        k += 1;
        if breakpoints.len() > TRACK_FRAME_CAP {
            return Err(MotionError::Unsupported("flow-track-too-many-frames"));
        }
    }
    let _ = step;
    breakpoints.push(dur);
    let mut frames = Vec::with_capacity(breakpoints.len());
    for local in breakpoints {
        let value = sampled_wave(wave, seed, local / period + phase, samples, noise.as_ref());
        frames.push(FlowFrame {
            t: t0 + local,
            v: scale_amplitude(amplitude, value)?,
            ease: None,
        });
    }
    Ok(frames)
}

/// Amplitude × waveform value. Numbers are multiplied directly. Relative-length objects are scaled per component (`value` and
/// `offset` are both multiplied); evaluation is still left to `build_channels_after_layout` after layout (design §5.5).
pub fn scale_amplitude(amplitude: &Value, factor: f64) -> Result<Value, MotionError> {
    if let Some(n) = amplitude.as_f64() {
        return Ok(Value::from(n * factor));
    }
    let length =
        crate::preset_registry::manifest::parse_length_value(amplitude).ok_or_else(|| {
            MotionError::ManifestInvalid(format!("amplitude {amplitude} 既不是数字也不是长度"))
        })?;
    Ok(serde_json::json!({
        "value": length.value * factor,
        "basis": length.basis.name(),
        "offset": length.offset_px * factor,
    }))
}

/// Linear blend of keyframe values (used when laying out curve-object frames).
///
/// Relative-length evaluation is `px = value × basis + offset`, which is bilinear in `value` / `offset`. So a linear interpolation
/// between the two ends can only be represented when **the result can still be written as a single `{value, basis, offset}`**:
/// either the same basis (each component linear on its own), or one end is an absolute length (which folds entirely into `offset`).
/// Two different non-absolute bases cannot blend into a single object, since that would need the sum of two bases. Raise an error
/// rather than guess.
fn mix_flow_value(a: &Value, b: &Value, u: f64) -> Result<Value, MotionError> {
    if let (Some(na), Some(nb)) = (a.as_f64(), b.as_f64()) {
        return Ok(Value::from(na + (nb - na) * u));
    }
    let (Some(la), Some(lb)) = (
        crate::preset_registry::manifest::parse_length_value(a),
        crate::preset_registry::manifest::parse_length_value(b),
    ) else {
        return Err(MotionError::Unsupported("curve-object-on-discrete-value"));
    };
    let length = |value: f64, basis: crate::relative_value::LengthBasis, offset: f64| {
        Ok(serde_json::json!({
            "value": value,
            "basis": basis.name(),
            "offset": offset,
        }))
    };
    use crate::relative_value::LengthBasis::Absolute;
    if la.basis == lb.basis {
        return length(
            la.value + (lb.value - la.value) * u,
            la.basis,
            la.offset_px + (lb.offset_px - la.offset_px) * u,
        );
    }
    if lb.basis == Absolute {
        return length(
            la.value * (1.0 - u),
            la.basis,
            la.offset_px * (1.0 - u) + (lb.value + lb.offset_px) * u,
        );
    }
    if la.basis == Absolute {
        return length(
            lb.value * u,
            lb.basis,
            (la.value + la.offset_px) * (1.0 - u) + lb.offset_px * u,
        );
    }
    Err(MotionError::Unsupported("curve-object-mixes-two-bases"))
}

/// Default composite mode for properties (used when `composite` is omitted, spec §7.7).
pub fn default_composite(prop: &str) -> CompositeMode {
    default_mode(prop)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::composite::PoseBuffer;
    use crate::curve::EaseId;
    use crate::loop_kernel::DEFAULT_LATTICE;
    use crate::rng::splitmix64;
    use crate::sample::sample;
    use serde_json::json;

    fn tween(dur: f64) -> MotionOp {
        MotionOp::Tween {
            target: TargetId::SELF,
            property: PropertyId::known("opacity"),
            from: json!(0.0),
            to: json!(1.0),
            dur,
            curve: CurveSpec::Named(EaseId::Linear),
            composite: CompositeMode::Replace,
            interpolator: InterpolatorSpec::Linear,
        }
    }

    fn tween_prop(prop: &'static str, from: f64, to: f64, dur: f64) -> MotionOp {
        MotionOp::Tween {
            target: TargetId::SELF,
            property: PropertyId::known(prop),
            from: json!(from),
            to: json!(to),
            dur,
            curve: CurveSpec::Named(EaseId::Linear),
            composite: CompositeMode::Replace,
            interpolator: InterpolatorSpec::Linear,
        }
    }

    #[test]
    fn parallel_is_max_and_sequence_is_sum() {
        let children = vec![tween(0.4), tween(1.2), MotionOp::Wait { dur: 0.7 }];
        assert_eq!(MotionOp::Parallel(children.clone()).duration(), 1.2);
        assert_eq!(MotionOp::Sequence(children).duration(), 0.4 + 1.2 + 0.7);
    }

    /// Design §11 property test: on random composition trees, `parallel = max` and `sequence = Σ`.
    #[test]
    fn duration_rules_hold_on_random_trees() {
        fn build(state: &mut u64, depth: usize) -> MotionOp {
            let roll = splitmix64(state) % 100;
            if depth == 0 || roll < 40 {
                let dur = (splitmix64(state) % 40) as f64 / 10.0;
                return if roll % 2 == 0 {
                    MotionOp::Wait { dur }
                } else {
                    tween(dur)
                };
            }
            let count = 1 + (splitmix64(state) % 3) as usize;
            let children: Vec<MotionOp> = (0..count).map(|_| build(state, depth - 1)).collect();
            if roll < 70 {
                MotionOp::Parallel(children)
            } else {
                MotionOp::Sequence(children)
            }
        }
        let mut state = 0xBAC0_1234_5678_9ABCu64;
        for _ in 0..200 {
            let op = build(&mut state, 3);
            match &op {
                MotionOp::Parallel(children) => assert_eq!(
                    op.duration(),
                    children
                        .iter()
                        .map(MotionOp::duration)
                        .fold(0.0f64, f64::max)
                ),
                MotionOp::Sequence(children) => {
                    let sum: f64 = children.iter().map(MotionOp::duration).sum();
                    assert_eq!(op.duration(), sum);
                }
                _ => {}
            }
        }
    }

    #[test]
    fn stagger_delay_and_repeat_duration_rules() {
        let stagger = MotionOp::Stagger {
            item: Box::new(tween(0.4)),
            gap: 0.1,
            order: StaggerFrom::Start,
            targets: vec![TargetId(1), TargetId(2), TargetId(3)],
        };
        assert!((stagger.duration() - 0.6).abs() < 1e-12);
        let delayed = MotionOp::Delay {
            delay: 0.25,
            child: Box::new(tween(0.5)),
        };
        assert_eq!(delayed.duration(), 0.75);
        assert_eq!(
            MotionOp::Repeat {
                end: RepeatEnd::Count(3),
                mode: RepeatMode::Loop,
                child: Box::new(tween(0.5)),
            }
            .duration(),
            1.5
        );
        assert_eq!(
            MotionOp::Set {
                target: TargetId::SELF,
                property: PropertyId::known("opacity"),
                value: json!(1.0),
                composite: CompositeMode::Replace,
            }
            .duration(),
            0.0
        );
    }

    /// Duration takes the maximum over the **actual order**: `start` / `end` are permutations of `0..n` (maximum n-1), while `center`
    /// is not (`[2,1,0,1,2]`, maximum 2). The spec §7.5 formula `max(item_i + i·gap)` assumes the default order is a permutation; taking
    /// the actual value here is more accurate (implementation note).
    #[test]
    fn stagger_duration_follows_the_actual_order_table() {
        for (order, span) in [
            (StaggerFrom::Start, 4.0),
            (StaggerFrom::End, 4.0),
            (StaggerFrom::Center, 2.0),
        ] {
            let stagger = MotionOp::Stagger {
                item: Box::new(tween(0.4)),
                gap: 0.1,
                order,
                targets: (1..=5).map(TargetId).collect(),
            };
            assert!(
                (stagger.duration() - (0.4 + span * 0.1)).abs() < 1e-12,
                "{order:?} => {}",
                stagger.duration()
            );
        }
    }

    #[test]
    fn stagger_start_times_are_monotonic_and_permuted_by_order() {
        let starts = |order: StaggerFrom| -> Vec<f64> {
            let graph = MotionGraph {
                root: MotionOp::Stagger {
                    item: Box::new(tween(0.2)),
                    gap: 0.1,
                    order,
                    targets: (1..=4).map(TargetId).collect(),
                },
            };
            let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
            let mut out = vec![0.0; 4];
            for track in &flow.tracks {
                out[track.target.0 as usize - 1] = track.frames[0].t;
            }
            out
        };
        let close = |got: Vec<f64>, want: Vec<f64>| {
            assert_eq!(got.len(), want.len());
            for (a, b) in got.iter().zip(&want) {
                assert!((a - b).abs() < 1e-12, "{got:?} != {want:?}");
            }
        };
        close(starts(StaggerFrom::Start), vec![0.0, 0.1, 0.2, 0.3]);
        let start = starts(StaggerFrom::Start);
        assert!(start.windows(2).all(|w| w[0] < w[1]), "{start:?}");
        let end = starts(StaggerFrom::End);
        assert!(end.windows(2).all(|w| w[0] > w[1]), "{end:?}");
        close(starts(StaggerFrom::Center), vec![0.1, 0.0, 0.0, 0.1]);
    }

    #[test]
    fn sequence_compiles_to_consecutive_segments() {
        let graph = MotionGraph {
            root: MotionOp::Sequence(vec![MotionOp::Wait { dur: 0.5 }, tween(1.0)]),
        };
        let program = compile(&graph, &CompileCtx::default()).unwrap();
        let track = program.track("opacity").unwrap();
        assert_eq!(track.segments.len(), 1);
        assert_eq!(track.segments[0].t0, 0.5);
        assert_eq!(track.segments[0].t1, 1.5);
        let mut buf = PoseBuffer::identity();
        sample(&program, TargetId::SELF, 1.0, &mut buf);
        assert_eq!(buf.scalar("opacity"), Some(0.5));
    }

    #[test]
    fn at_places_children_on_absolute_time_and_delay_still_shifts_them() {
        let graph = MotionGraph {
            root: MotionOp::At {
                at: 4.0,
                child: Box::new(tween(0.5)),
            },
        };
        let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
        assert_eq!(flow.tracks[0].frames[0].t, 4.0);

        let graph = MotionGraph {
            root: MotionOp::Delay {
                delay: 0.25,
                child: Box::new(MotionOp::At {
                    at: 4.0,
                    child: Box::new(tween(0.5)),
                }),
            },
        };
        let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
        assert_eq!(flow.tracks[0].frames[0].t, 4.25);
    }

    #[test]
    fn repeat_unrolls_and_is_independent_of_play_order() {
        let graph = MotionGraph {
            root: MotionOp::Repeat {
                end: RepeatEnd::Count(4),
                mode: RepeatMode::Yoyo,
                child: Box::new(tween_prop("y", -6.0, 6.0, 0.4)),
            },
        };
        let program = compile(&graph, &CompileCtx::default()).unwrap();
        let instants: Vec<f64> = (0..400).map(|i| i as f64 * 0.005).collect();
        let forward: Vec<u64> = instants
            .iter()
            .map(|t| {
                let mut buf = PoseBuffer::identity();
                sample(&program, TargetId::SELF, *t, &mut buf);
                buf.scalar_or("y", 0.0).to_bits()
            })
            .collect();
        let mut backward: Vec<u64> = instants
            .iter()
            .rev()
            .map(|t| {
                let mut buf = PoseBuffer::identity();
                sample(&program, TargetId::SELF, *t, &mut buf);
                buf.scalar_or("y", 0.0).to_bits()
            })
            .collect();
        backward.reverse();
        assert_eq!(forward, backward);
        // yoyo: the second pass returns from +6 to -6
        let track = program.track("y").unwrap();
        assert_eq!(track.segments.len(), 4);
        assert_eq!(track.segments[1].t0, 0.4);
    }

    #[test]
    fn repeat_until_stops_at_the_absolute_deadline() {
        let graph = MotionGraph {
            root: MotionOp::Repeat {
                end: RepeatEnd::Until(1.0),
                mode: RepeatMode::Loop,
                child: Box::new(tween_prop("y", 0.0, 1.0, 0.4)),
            },
        };
        let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
        // Passes start at 0.0 / 0.4 / 0.8; the pass starting at 1.2 already starts past `until`
        assert_eq!(flow.tracks[0].frames.len(), 6);
        assert!(flow.tracks[0].frames.iter().all(|f| f.t <= 1.2 + 1e-12));
    }

    #[test]
    fn repeat_rejects_absurd_unroll_counts() {
        let graph = MotionGraph {
            root: MotionOp::Repeat {
                end: RepeatEnd::Count(REPEAT_UNROLL_CAP as u32 + 1),
                mode: RepeatMode::Loop,
                child: Box::new(tween(0.1)),
            },
        };
        assert!(matches!(
            compile(&graph, &CompileCtx::default()),
            Err(MotionError::Unsupported("repeat-too-many"))
        ));
    }

    #[test]
    fn oscillate_frames_reproduce_the_kernel_wave_exactly() {
        let graph = MotionGraph {
            root: MotionOp::Oscillate {
                target: TargetId::SELF,
                property: PropertyId::known("y"),
                amplitude: json!(6.0),
                period: 1.2,
                phase: 0.0,
                wave: WaveKind::Sine,
                dur: 2.4,
                composite: CompositeMode::Add,
            },
        };
        let program = compile(&graph, &CompileCtx::default()).unwrap();
        for step in 0..=240 {
            let t = step as f64 * 0.01;
            let mut buf = PoseBuffer::identity();
            sample(&program, TargetId::SELF, t, &mut buf);
            let expected = if t <= 2.4 {
                6.0 * sampled_wave(WaveKind::Sine, 0, t / 1.2, DEFAULT_WAVE_SAMPLES, None)
            } else {
                6.0 * sampled_wave(WaveKind::Sine, 0, 2.0, DEFAULT_WAVE_SAMPLES, None)
            };
            assert!(
                (buf.scalar_or("y", 0.0) - expected).abs() < 1e-12,
                "t={t} got={} want={expected}",
                buf.scalar_or("y", 0.0)
            );
        }
    }

    #[test]
    fn noise_needs_an_explicit_seed_and_the_same_seed_gives_the_same_output() {
        let noise = |seed: u64| {
            let graph = MotionGraph {
                root: MotionOp::Noise {
                    target: TargetId::SELF,
                    property: PropertyId::known("x"),
                    amplitude: json!(4.0),
                    period: 0.6,
                    seed,
                    channel: 0,
                    lattice: DEFAULT_LATTICE,
                    dur: 1.2,
                    composite: CompositeMode::Add,
                },
            };
            let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
            flow.tracks[0]
                .frames
                .iter()
                .map(|f| f.v.as_f64().unwrap().to_bits())
                .collect::<Vec<_>>()
        };
        assert_eq!(noise(0), noise(0));
        assert_ne!(noise(0), noise(42));
        // At phase 0 the noise is always 0 (lattice vertex 0 is pinned) ⇒ the add track starts from the identity
        assert_eq!(noise(0)[0], 0.0f64.to_bits());
    }

    /// Curve object + relative length → absolute endpoints: the blend still comes out as a single `{value, basis, offset}`.
    #[test]
    fn baking_a_curve_object_keeps_relative_lengths_representable() {
        let graph = MotionGraph {
            root: MotionOp::Tween {
                target: TargetId::SELF,
                property: PropertyId::known("y"),
                from: json!({"value": 0.05, "basis": "canvasShortEdge"}),
                to: json!(0),
                dur: 0.5,
                curve: CurveSpec::Spring {
                    response: 0.45,
                    damping: 0.82,
                },
                composite: CompositeMode::Add,
                interpolator: InterpolatorSpec::Linear,
            },
        };
        let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
        let frames = &flow.tracks[0].frames;
        assert_eq!(frames[0].v["value"], json!(0.05));
        assert_eq!(frames[0].v["basis"], json!("canvasShortEdge"));
        assert_eq!(frames.last().unwrap().v["value"], json!(0.0));
        // Each frame is still an evaluable relative-length object
        for frame in frames {
            assert!(frame.v.get("basis").is_some(), "{:?}", frame.v);
        }
        // Two different non-absolute bases cannot blend into a single object ⇒ raise an error rather than guess
        let graph = MotionGraph {
            root: MotionOp::Tween {
                target: TargetId::SELF,
                property: PropertyId::known("y"),
                from: json!({"value": 0.05, "basis": "canvasShortEdge"}),
                to: json!({"value": 0.02, "basis": "canvasWidth"}),
                dur: 0.5,
                curve: CurveSpec::Spring {
                    response: 0.45,
                    damping: 0.82,
                },
                composite: CompositeMode::Add,
                interpolator: InterpolatorSpec::Linear,
            },
        };
        assert!(matches!(
            compile_flow(&graph, &CompileCtx::default()),
            Err(MotionError::Unsupported("curve-object-mixes-two-bases"))
        ));
    }

    #[test]
    fn amplitudes_may_be_relative_lengths() {
        let scaled =
            scale_amplitude(&json!({"value": 0.01, "basis": "canvasShortEdge"}), -0.5).unwrap();
        assert_eq!(scaled["value"], json!(-0.005));
        assert_eq!(scaled["basis"], json!("canvasShortEdge"));
    }

    #[test]
    fn curve_objects_are_baked_onto_the_fps_grid() {
        let graph = MotionGraph {
            root: MotionOp::Tween {
                target: TargetId::SELF,
                property: PropertyId::known("y"),
                from: json!(40.0),
                to: json!(0.0),
                dur: 0.5,
                curve: CurveSpec::Spring {
                    response: 0.45,
                    damping: 0.82,
                },
                composite: CompositeMode::Add,
                interpolator: InterpolatorSpec::Linear,
            },
        };
        let flow = compile_flow(&graph, &CompileCtx::default()).unwrap();
        assert_eq!(flow.tracks[0].frames.len(), 31); // 0.5s × 60fps + 1
        assert!(flow.tracks[0].frames.iter().all(|f| f.ease.is_none()));
        assert_eq!(flow.tracks[0].frames[0].v, json!(40.0));
        assert_eq!(flow.tracks[0].frames[30].v, json!(0.0));
    }

    /// Design §13: Graph op variant budget. An exhaustive `match` makes “adding a variant” fail to compile.
    #[test]
    fn motion_op_variant_budget_is_respected() {
        fn name(op: &MotionOp) -> &'static str {
            match op {
                MotionOp::Set { .. } => "set",
                MotionOp::Wait { .. } => "wait",
                MotionOp::Tween { .. } => "tween",
                MotionOp::Preset { .. } => "preset",
                MotionOp::Parallel(_) => "parallel",
                MotionOp::Sequence(_) => "sequence",
                MotionOp::Stagger { .. } => "stagger",
                MotionOp::Delay { .. } => "delay",
                MotionOp::Repeat { .. } => "repeat",
                MotionOp::Oscillate { .. } => "oscillate",
                MotionOp::Noise { .. } => "noise",
                MotionOp::At { .. } => "at",
            }
        }
        assert_eq!(name(&tween(0.1)), "tween");
    }
}
