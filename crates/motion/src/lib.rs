/*!
 * ccut-motion — CucCut's shared animation kernel (ADR-M01, design §5).
 *
 * Pure functions, no I/O, no clock, no randomness: manifests are embedded via `include_str!`, sampling is a pure function of
 * `(program, t)`, and random effects always take an explicitly seeded source.
 * `ccut-core` (the BCF domain) and `ccut-timeline` (the product editing domain) both come in through lowering, and neither
 * depends on the other.
 *
 * Do not introduce `std::fs`, `std::time`, `rand`, networking, or thread-local mutable state into this crate.
 */

#![forbid(unsafe_code)]

pub mod composite;
pub mod curve;
pub mod effect;
pub mod fingerprint;
pub mod flow;
pub mod graph;
pub mod interpolate;
pub mod loop_kernel;
pub mod lower_bcf;
pub mod lower_timeline;
pub mod preset_registry;
pub mod program;
pub mod relative_value;
pub mod rng;
pub mod sample;
pub mod text_motion;
pub mod text_parts;
pub mod value;

pub use composite::{CompositeMode, PoseBuffer, PostOp, default_mode, mix_toward_identity};
pub use curve::{
    CurveSpec, EASE_NAMES, EaseId, apply_ease, apply_ease_id, curve_overshoots, sample_curve,
    spring_normalized, spring_value,
};
pub use effect::{
    BlendMode, ColorContract, ColorSpace, Determinism, EffectDomain, EffectManifest, EffectRef,
    EffectRegistry, Precision, UniformMap, UniformValue, builtin_registry,
};
pub use fingerprint::fnv1a64;
pub use flow::{FlowParseCtx, parse_flow, parse_parts};
pub use graph::{
    CompileCtx, CompiledFlow, FlowFrame, FlowTrack, MotionGraph, MotionOp, RepeatEnd, RepeatMode,
    compile, compile_flow,
};
pub use interpolate::{InterpolatorSpec, mix};
pub use loop_kernel::{ChannelKey, LoopKernel, sample_keyframes};
pub use lower_bcf::{ChannelIr, KfIr};
pub use lower_timeline::{
    AnimationInput, ElementExtent, SlotInput, SlotTween, TextCascade, TextLowering,
    TimelineProgram, Window, compile_slot_tween, compile_slot_tween_with, effective_exit,
    lower_timeline_animation, lower_timeline_animation_with, lower_timeline_text,
};
pub use program::{
    MOTION_PROGRAM_VERSION, MotionProgram, MotionSegment, PartPlan, PresetRef, PropertyTrack,
    SegmentKind, TargetId, TimeBase,
};
pub use relative_value::{LengthBasis, LengthContext, RelativeLength};
pub use sample::{quantize_time, sample, sample_track};
pub use text_parts::{
    PartMap, PartUnit, StaggerFrom, StaggerPlan, split_animation_parts, stagger_order,
    stagger_order_from, stagger_plan,
};
pub use value::{
    ANIM_PROPS, MotionValue, PropertyId, RELATIVE_LENGTH_PROPS, ValueKind, effect_param_channel,
    is_animatable, property_kind,
};

/// Diagnostic vocabulary (design §5.4.2). Callers keep their own error types: `ccut-core` uses `anyhow!` and `ccut-timeline` uses
/// `TimelineError`. This crate does not bring in `anyhow`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MotionError {
    PresetUnknown(String),
    PresetParamUnknown(String),
    PresetParamMissing(String),
    PresetVersionUnknown(String),
    ManifestInvalid(String),
    /// A preset `compose` recursion forms a cycle (spec §7.4 / §16).
    PresetComposeCycle(String),
    /// A relative length was written on a property that does not allow it (spec §7.8).
    RelativeNotAllowed(String),
    /// Bases such as `selfWidth` / `parentWidth` that require static layout (spec §7.8).
    LayoutRequired(&'static str),
    /// Structural violation of `animate.flow` / `animate.parts` (spec §7.5 / §7.9). The key set and the operators are both closed, and one
    /// extra key is a hard error. “BCF contains no executable code” is guaranteed by the parser, not by convention (ADR-M07).
    FlowInvalid(String),
    /// Capability declared but not implemented in stage 1.
    Unsupported(&'static str),
}

impl std::fmt::Display for MotionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::PresetUnknown(id) => write!(f, "preset-unknown: \"{id}\""),
            Self::PresetParamUnknown(id) => write!(f, "preset-param-unknown: \"{id}\""),
            Self::PresetParamMissing(id) => write!(f, "preset-param-missing: \"{id}\""),
            Self::PresetVersionUnknown(id) => write!(f, "preset-version-unknown: \"{id}\""),
            Self::ManifestInvalid(detail) => write!(f, "manifest-invalid: {detail}"),
            Self::FlowInvalid(detail) => write!(f, "motion-flow-invalid: {detail}"),
            Self::PresetComposeCycle(path) => write!(f, "preset-compose-cycle: {path}"),
            Self::RelativeNotAllowed(prop) => {
                write!(f, "relative-not-allowed: \"{prop}\"")
            }
            Self::LayoutRequired(basis) => {
                write!(f, "relative-basis-unresolved: \"{basis}\"")
            }
            Self::Unsupported(what) => write!(f, "motion-unsupported: \"{what}\""),
        }
    }
}

impl std::error::Error for MotionError {}
