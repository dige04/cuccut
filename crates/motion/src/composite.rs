//! Composite modes, post-processing and the pose buffer (design §5.1).

use crate::value::{MOTION_PROP_COUNT, MOTION_PROPS, MotionValue, PropertyId};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CompositeMode {
    Replace,
    Add,
    Multiply,
}

/// Property normalization. `opacity` is clamped to `clamp(0,1)` on write-back, and `blur` to `max(0)` on write-back. This matches `motion.rs:825` / `:831`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PostOp {
    None,
    ClampUnit,
    ClampMin0,
}

impl Default for PostOp {
    fn default() -> Self {
        Self::None
    }
}

impl PostOp {
    pub fn apply(self, value: f64) -> f64 {
        match self {
            Self::None => value,
            Self::ClampUnit => value.clamp(0.0, 1.0),
            Self::ClampMin0 => value.max(0.0),
        }
    }

    /// Channel → default post-processing (the two convergence points in `motion.rs::sample_slot`).
    pub fn for_property(prop: &str) -> Self {
        match prop {
            "opacity" => Self::ClampUnit,
            "blur" => Self::ClampMin0,
            _ => Self::None,
        }
    }
}

/// The default composite mode for a property (spec §7.7 / design §5.1).
///
/// **Only for new recipes**: the lowering of `timeline.*@1` / `bcf.*@1` always uses an explicit `Replace` (ADR-M08, frozen). This keeps the legacy four-slot "last channel wins" rule bit-for-bit unchanged.
pub fn default_mode(prop: &str) -> CompositeMode {
    match prop {
        "x" | "y" | "dx" | "dy" | "rotation" | "rotationX" | "rotationY" | "skewX" | "skewY"
        | "blur" => CompositeMode::Add,
        "scale" | "scaleX" | "scaleY" | "opacity" => CompositeMode::Multiply,
        // color / backgroundColor / clipPath / pathMorph / borderRadius / pathDraw / textCount / reveal / volume / cam: enum, text, color and discrete values are always replace.
        _ => CompositeMode::Replace,
    }
}

/// The identity element of the composition (`base`). The identity of a `multiply` track is 1, and that of an `add` track is 0.
pub fn identity_for(prop: &str) -> f64 {
    match default_mode(prop) {
        CompositeMode::Multiply => 1.0,
        _ => 0.0,
    }
}

/// Each formula comes from `motion.rs:48-51` (the single-channel slice of `AnimationPose::mixed_toward_identity`).
pub fn mix_toward_identity(value: f64, identity: f64, amount: f64) -> f64 {
    let amount = amount.clamp(0.0, 1.0);
    identity + (value - identity) * amount
}

/// Sampling output buffer. The slots are fixed, so no heap memory is allocated during sampling.
///
/// The fold order is the fixed sequence from spec §7.7 / design §5.1:
/// `base → replace (higher order wins) → add sum → multiply product → property normalization / clamp`.
///
/// **Bit-for-bit invariance**: each track in stage 1 is a single replace, so the fold reduces to `post(replace.unwrap_or(base))`, exactly the same as the old implementation's `write(post(value))`.
#[derive(Clone, Debug, Default, PartialEq)]
struct Slot {
    /// The resting value of a track when it has no output at this moment (`PropertyTrack::base`).
    base: Option<MotionValue>,
    /// `(value, order)`. The higher order wins. With equal orders, the later write wins (declaration order).
    replace: Option<(MotionValue, u32)>,
    add: Option<f64>,
    mul: Option<f64>,
    post: PostOp,
    /// Whether any add or multiply contribution is present. When none is, **the whole fold is skipped**, which keeps the old path bit-for-bit unchanged.
    composed: bool,
}

impl Slot {
    fn fold(&self) -> Option<MotionValue> {
        let value = self
            .replace
            .as_ref()
            .map(|(value, _)| value.clone())
            .or_else(|| self.base.clone())?;
        if !self.composed {
            return Some(value);
        }
        // Discrete and color values do not take part in add or multiply (spec §7.7: enums, text and booleans are always replace + step). If no scalar can be obtained, the value is returned as-is.
        let Some(mut raw) = value.as_f64() else {
            return Some(value);
        };
        if let Some(add) = self.add {
            raw += add;
        }
        if let Some(mul) = self.mul {
            raw *= mul;
        }
        Some(value.with_scalar(self.post.apply(raw)))
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct PoseBuffer {
    slots: [Slot; MOTION_PROP_COUNT],
}

impl PoseBuffer {
    pub fn identity() -> Self {
        Self {
            slots: std::array::from_fn(|_| Slot::default()),
        }
    }

    /// Write the sampled value of one **track**. `post` is applied after the fold (spec §7.7, step 5).
    pub fn write(
        &mut self,
        prop: &PropertyId,
        value: MotionValue,
        mode: CompositeMode,
        order: u32,
        post: PostOp,
    ) {
        let Some(index) = prop.slot() else {
            return;
        };
        let slot = &mut self.slots[index];
        slot.post = post;
        match mode {
            CompositeMode::Replace => {
                let wins = match &slot.replace {
                    Some((_, seen)) => order >= *seen,
                    None => true,
                };
                if wins {
                    slot.replace = Some((value, order));
                }
            }
            CompositeMode::Add => {
                slot.composed = true;
                if let Some(raw) = value.as_f64() {
                    slot.add = Some(slot.add.unwrap_or(0.0) + raw);
                }
            }
            CompositeMode::Multiply => {
                slot.composed = true;
                if let Some(raw) = value.as_f64() {
                    slot.mul = Some(slot.mul.unwrap_or(1.0) * raw);
                }
            }
        }
    }

    /// The resting value of this track when it has no output at this moment (`PropertyTrack::base`).
    pub fn write_base(&mut self, prop: &PropertyId, value: MotionValue) {
        let Some(index) = prop.slot() else {
            return;
        };
        if self.slots[index].base.is_none() {
            self.slots[index].base = Some(value);
        }
    }

    pub fn get(&self, prop: &str) -> Option<MotionValue> {
        let index = MOTION_PROPS.iter().position(|known| *known == prop)?;
        self.slots[index].fold()
    }

    pub fn scalar(&self, prop: &str) -> Option<f64> {
        self.get(prop).and_then(|value| value.as_f64())
    }

    /// Default fallback: when `scalar(prop)` is absent, return the channel identity.
    pub fn scalar_or(&self, prop: &str, identity: f64) -> f64 {
        self.scalar(prop).unwrap_or(identity)
    }
}

impl Default for PoseBuffer {
    fn default() -> Self {
        Self::identity()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replace_writes_and_reads_back() {
        let mut buf = PoseBuffer::identity();
        assert_eq!(buf.scalar("opacity"), None);
        assert_eq!(buf.scalar_or("opacity", 1.0), 1.0);
        buf.write(
            &PropertyId::known("opacity"),
            MotionValue::Scalar(0.25),
            CompositeMode::Replace,
            0,
            PostOp::ClampUnit,
        );
        assert_eq!(buf.scalar("opacity"), Some(0.25));
    }

    #[test]
    fn unknown_properties_are_dropped_not_panicked() {
        let mut buf = PoseBuffer::identity();
        buf.write(
            &PropertyId::parse("notAProperty"),
            MotionValue::Scalar(1.0),
            CompositeMode::Replace,
            0,
            PostOp::None,
        );
        assert_eq!(buf.scalar("notAProperty"), None);
    }

    #[test]
    fn post_ops_match_the_sample_slot_clamps() {
        assert_eq!(PostOp::ClampUnit.apply(1.5), 1.0);
        assert_eq!(PostOp::ClampMin0.apply(-2.0), 0.0);
        assert_eq!(PostOp::for_property("opacity"), PostOp::ClampUnit);
        assert_eq!(PostOp::for_property("blur"), PostOp::ClampMin0);
        assert_eq!(PostOp::for_property("dy"), PostOp::None);
    }

    fn write(buf: &mut PoseBuffer, prop: &str, v: f64, mode: CompositeMode, order: u32) {
        buf.write(
            &PropertyId::parse(prop),
            MotionValue::Scalar(v),
            mode,
            order,
            PostOp::for_property(prop),
        );
    }

    #[test]
    fn the_highest_order_replace_wins() {
        let mut buf = PoseBuffer::identity();
        write(&mut buf, "y", 10.0, CompositeMode::Replace, 0);
        write(&mut buf, "y", 20.0, CompositeMode::Replace, 3);
        write(&mut buf, "y", 30.0, CompositeMode::Replace, 1);
        assert_eq!(buf.scalar("y"), Some(20.0));
    }

    #[test]
    fn equal_orders_fall_back_to_declaration_order() {
        let mut buf = PoseBuffer::identity();
        write(&mut buf, "y", 10.0, CompositeMode::Replace, 0);
        write(&mut buf, "y", 20.0, CompositeMode::Replace, 0);
        assert_eq!(buf.scalar("y"), Some(20.0));
    }

    #[test]
    fn base_then_replace_then_add_then_multiply_then_clamp() {
        let mut buf = PoseBuffer::identity();
        buf.write_base(&PropertyId::known("y"), MotionValue::Scalar(300.0));
        write(&mut buf, "y", -40.0, CompositeMode::Add, 0);
        write(&mut buf, "y", 6.0, CompositeMode::Add, 1);
        assert_eq!(buf.scalar("y"), Some(266.0));

        let mut buf = PoseBuffer::identity();
        buf.write_base(&PropertyId::known("scale"), MotionValue::Scalar(1.0));
        write(&mut buf, "scale", 0.8, CompositeMode::Multiply, 0);
        write(&mut buf, "scale", 1.06, CompositeMode::Multiply, 1);
        assert_eq!(buf.scalar("scale"), Some(0.8 * 1.06));

        // replace wins first, then add and multiply are stacked on top
        let mut buf = PoseBuffer::identity();
        write(&mut buf, "y", 100.0, CompositeMode::Replace, 0);
        write(&mut buf, "y", 5.0, CompositeMode::Add, 1);
        write(&mut buf, "y", 2.0, CompositeMode::Multiply, 2);
        assert_eq!(buf.scalar("y"), Some(210.0));
    }

    #[test]
    fn clamp_happens_after_composition_not_before() {
        let mut buf = PoseBuffer::identity();
        write(&mut buf, "opacity", 0.8, CompositeMode::Replace, 0);
        write(&mut buf, "opacity", 0.9, CompositeMode::Add, 1);
        // Clamping first would give 1.0 + 0.9 = 1.9, then clamp = 1.0. Here the result is also 1.0, but the intermediate value 1.7 is not truncated. The difference shows when multiply takes part.
        assert_eq!(buf.scalar("opacity"), Some(1.0));

        let mut buf = PoseBuffer::identity();
        write(&mut buf, "opacity", 1.5, CompositeMode::Replace, 0);
        write(&mut buf, "opacity", 0.5, CompositeMode::Multiply, 1);
        assert_eq!(buf.scalar("opacity"), Some(0.75));
    }

    #[test]
    fn a_single_replace_track_is_untouched_by_the_fold() {
        // The stage 0/1 goldens depend on this: when neither add nor multiply takes part, the fold must **return the written value as-is** (including non-scalars).
        let mut buf = PoseBuffer::identity();
        buf.write(
            &PropertyId::known("color"),
            MotionValue::Discrete(serde_json::json!("#ff0000")),
            CompositeMode::Replace,
            0,
            PostOp::None,
        );
        assert_eq!(
            buf.get("color"),
            Some(MotionValue::Discrete(serde_json::json!("#ff0000")))
        );
        let mut buf = PoseBuffer::identity();
        write(&mut buf, "opacity", 1.5, CompositeMode::Replace, 0);
        assert_eq!(buf.scalar("opacity"), Some(1.5), "a single track is not clamped");
    }

    #[test]
    fn discrete_values_ignore_add_and_multiply() {
        let mut buf = PoseBuffer::identity();
        buf.write(
            &PropertyId::known("color"),
            MotionValue::Discrete(serde_json::json!("#ff0000")),
            CompositeMode::Replace,
            0,
            PostOp::None,
        );
        buf.write(
            &PropertyId::known("color"),
            MotionValue::Discrete(serde_json::json!("#00ff00")),
            CompositeMode::Add,
            1,
            PostOp::None,
        );
        assert_eq!(
            buf.get("color"),
            Some(MotionValue::Discrete(serde_json::json!("#ff0000")))
        );
    }

    #[test]
    fn mix_toward_identity_clamps_the_amount() {
        assert_eq!(mix_toward_identity(0.0, 1.0, 2.0), 0.0);
        assert_eq!(mix_toward_identity(0.0, 1.0, -1.0), 1.0);
        assert_eq!(mix_toward_identity(0.5, 1.0, 0.5), 0.75);
    }
}
