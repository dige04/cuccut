//! Runtime IR: absolute or element-local time, strongly typed, already expanded (ADR-M02, design §5.3).
//!
//! MotionProgram is not written to disk (except in debug), and does not retain preset names. Provenance is kept only as a `sources` sidecar, and sampling never looks at it.

use crate::composite::{CompositeMode, PostOp};
use crate::curve::CurveSpec;
use crate::interpolate::InterpolatorSpec;
use crate::loop_kernel::LoopKernel;
use crate::text_parts::PartUnit;
use crate::value::{MotionValue, PropertyId};

pub const MOTION_PROGRAM_VERSION: u32 = 1;

/// Sampling target. `0` is the element itself; text parts are described by `PartPlan`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct TargetId(pub u32);

impl TargetId {
    pub const SELF: Self = Self(0);
}

/// Time base. **This is not decoration** (plan §2.1): Timeline windows are all relative to `start`, and `local = (quantize(t) - start).clamp(0, lifetime)` is not the same double as `t - (start + begin)`. So Timeline lowering must emit `ElementLocal`, with the caller doing the subtraction before the clamp. BCF channels are already absolute time.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TimeBase {
    ElementLocal,
    Absolute,
}

/// Value behavior outside the interval. `Hold` = clamp to the segment endpoint and evaluate there; `Off` = the track produces no output at this moment.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Fill {
    Off,
    Hold,
}

/// Index into `MotionProgram::loop_kernels`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LoopKernelRef(pub usize);

#[derive(Clone, Debug, PartialEq)]
pub enum SegmentKind {
    Tween {
        from: MotionValue,
        to: MotionValue,
        curve: CurveSpec,
        interpolator: InterpolatorSpec,
    },
    Hold {
        value: MotionValue,
    },
    Loop(LoopKernelRef),
}

#[derive(Clone, Debug, PartialEq)]
pub struct MotionSegment {
    pub t0: f64,
    pub t1: f64,
    pub fill_before: Fill,
    pub fill_after: Fill,
    pub composite: CompositeMode,
    pub order: u32,
    pub kind: SegmentKind,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PropertyTrack {
    pub target: TargetId,
    pub property: PropertyId,
    /// Composite mode of the whole track. **Invariant: a track has only one `(composite, order)`.** Multiple composites of the same property are expressed with multiple tracks, and `sample()` traverses all tracks for a target, so they stack naturally (design §5.1). The same-named fields kept on segments (the fingerprint already encodes them) must match the track.
    pub composite: CompositeMode,
    /// Overlap order between replace tracks: the larger wins (making explicit spec §7.1's "later declaration overrides").
    pub order: u32,
    /// Channel identity (opacity/scale are 1, dx/dy/rotation/blur are 0).
    pub base: MotionValue,
    pub post: PostOp,
    /// For channels like `reveal`: when no segment covers the time, pose fields stay absent rather than taking base.
    pub optional: bool,
    /// Sorted ascending by `t0`, non-overlapping (proof in plan §2.4).
    pub segments: Vec<MotionSegment>,
}

impl PropertyTrack {
    /// The track's and segment's `(composite, order)` must match. Asserted in debug; in release the track wins.
    pub fn assert_segments_agree(&self) {
        debug_assert!(
            self.segments
                .iter()
                .all(|segment| segment.composite == self.composite && segment.order == self.order),
            "track {} segments and track disagree on (composite, order)",
            self.property
        );
    }

    /// Time interval covered by this track (`None` = empty track).
    pub fn span(&self) -> Option<(f64, f64)> {
        let first = self.segments.first()?;
        let last = self.segments.last()?;
        Some((first.t0, last.t1))
    }
}

/// Two `replace` tracks on the same target and same property that overlap in time (spec §7.7 / §16 `motion-replace-overlap`).
#[derive(Clone, Debug, PartialEq)]
pub struct ReplaceOverlap {
    pub property: PropertyId,
    pub t0: f64,
    pub t1: f64,
    pub earlier_order: u32,
    pub later_order: u32,
}

/// Text cascade plan (plan §2.10). `delay`/`part_duration`/`begin_i` are stored separately, because `(local - delay - begin_i) / part_duration` and `(local - (delay + begin_i)) / part_duration` are not the same double.
#[derive(Clone, Debug, PartialEq)]
pub struct PartPlan {
    pub unit: PartUnit,
    pub count: usize,
    pub delay: f64,
    pub part_duration: f64,
    pub step: f64,
    /// `stagger_order(i, count, stagger_from)`, length = `count`.
    pub orders: Vec<usize>,
}

impl PartPlan {
    /// Taken verbatim from `motion.rs:657-662`.
    pub fn progress(&self, index: usize, local: f64) -> f64 {
        let begin = self.orders[index] as f64 * self.step;
        if self.part_duration > 0.0 {
            ((local - self.delay - begin) / self.part_duration).clamp(0.0, 1.0)
        } else {
            1.0
        }
    }
}

/// Recipe source. Only enters `full_fingerprint()`; not consulted at sampling time.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PresetRef {
    pub id: String,
    pub version: u32,
    pub manifest_hash: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MotionProgram {
    pub version: u32,
    pub time_base: TimeBase,
    pub property_tracks: Vec<PropertyTrack>,
    pub loop_kernels: Vec<LoopKernel>,
    pub part_plan: Option<PartPlan>,
    pub sources: Vec<PresetRef>,
}

impl MotionProgram {
    pub fn new(time_base: TimeBase) -> Self {
        Self {
            version: MOTION_PROGRAM_VERSION,
            time_base,
            property_tracks: Vec::new(),
            loop_kernels: Vec::new(),
            part_plan: None,
            sources: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.property_tracks.iter().all(|t| t.segments.is_empty())
    }

    pub fn track(&self, property: &str) -> Option<&PropertyTrack> {
        self.property_tracks
            .iter()
            .find(|track| track.property.as_str() == property)
    }

    /// Multiple replace tracks that overlap in time. `ccut lint` uses it to emit `motion-replace-overlap`.
    pub fn replace_overlaps(&self) -> Vec<ReplaceOverlap> {
        let mut out = Vec::new();
        for (i, a) in self.property_tracks.iter().enumerate() {
            if a.composite != CompositeMode::Replace {
                continue;
            }
            let Some((a0, a1)) = a.span() else { continue };
            for b in self.property_tracks.iter().skip(i + 1) {
                if b.composite != CompositeMode::Replace
                    || b.target != a.target
                    || b.property != a.property
                {
                    continue;
                }
                let Some((b0, b1)) = b.span() else { continue };
                let t0 = a0.max(b0);
                let t1 = a1.min(b1);
                if t1 - t0 <= 1e-9 {
                    continue;
                }
                let (earlier, later) = if a.order <= b.order {
                    (a.order, b.order)
                } else {
                    (b.order, a.order)
                };
                out.push(ReplaceOverlap {
                    property: a.property.clone(),
                    t0,
                    t1,
                    earlier_order: earlier,
                    later_order: later,
                });
            }
        }
        out
    }

    /// Shifts an `ElementLocal` program to absolute time. Used by the equivalence test (Timeline ≡ BCF).
    pub fn rebased(&self, offset: f64) -> Self {
        let mut next = self.clone();
        next.time_base = TimeBase::Absolute;
        for track in &mut next.property_tracks {
            for segment in &mut track.segments {
                segment.t0 += offset;
                segment.t1 += offset;
            }
        }
        next
    }
}

impl Default for MotionProgram {
    fn default() -> Self {
        Self::new(TimeBase::Absolute)
    }
}
