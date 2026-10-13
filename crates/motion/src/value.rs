//! Strongly typed animation values and property vocabulary (design §5.1).
//!
//! `PropertyId` preferentially points to the `'static` names in `MOTION_PROPS`. BCF documents can write channel names that are not in the table (for example the `camera` of a camera clip), so a `Cow` escape hatch is kept. Only in-table properties have `PoseBuffer` slots.

use std::borrow::Cow;

use serde_json::Value;

/// Animatable property allowlist (spec §6.4). `ccut-core::lint::ANIM_PROPS` re-exports from here.
pub const ANIM_PROPS: &[&str] = &[
    "x",
    "y",
    "scale",
    "scaleX",
    "scaleY",
    "rotation",
    "rotationX",
    "rotationY",
    "skewX",
    "skewY",
    "opacity",
    "blur",
    "color",
    "backgroundColor",
    "borderRadius",
    "clipPath",
    "pathDraw",
    "pathMorph",
    "textCount",
    "text",
    "textReveal",
    "fontWeight",
    "letterSpacing",
    "crop",
    "focalX",
    "focalY",
    "pathStart",
    "pathEnd",
    "dashOffset",
    "pathProgress",
    "volume",
];

/// Effect parameter channel (spec §6.6): `effects[N].<param>` is split into `(N, param)`.
///
/// Only the spec form is recognized: `N` is a decimal index without leading zeros, and `param` is a manifest parameter name (ASCII alphanumeric). Whether the index is out of range, and whether the parameter exists and is numeric, is checked by lint against the node's `effects[]`. Channels whose entry cannot be found at render time are silently ignored.
pub fn effect_param_channel(prop: &str) -> Option<(usize, &str)> {
    let rest = prop.strip_prefix("effects[")?;
    let (index, param) = rest.split_once("].")?;
    if index.is_empty()
        || !index.bytes().all(|b| b.is_ascii_digit())
        || (index.len() > 1 && index.starts_with('0'))
        || param.is_empty()
        || !param.bytes().all(|b| b.is_ascii_alphanumeric())
    {
        return None;
    }
    Some((index.parse().ok()?, param))
}

/// Animatable property: a named property in `ANIM_PROPS`, or an `effects[N].<param>` effect parameter channel.
pub fn is_animatable(prop: &str) -> bool {
    ANIM_PROPS.contains(&prop) || effect_param_channel(prop).is_some()
}

/// Supplement to the "not in animatable property allowlist" error: the only static style key whose name differs from its animation channel is the background color (style writes `background`, the channel is called `backgroundColor`). When a style key is written, the error points directly to the channel name.
pub fn not_animatable_hint(prop: &str) -> &'static str {
    match prop {
        "background" => "；背景色的动画通道叫 backgroundColor（style 里仍写 background）",
        _ => "",
    }
}

/// Properties allowed to take relative lengths (spec §7.8: relative values are used only for transform, blur and effect parameters, and **must not** affect layout in reverse). `width/height/gap/padding/layout` were never in `ANIM_PROPS`, so writing them in keyframes is a hard schema error.
pub const RELATIVE_LENGTH_PROPS: &[&str] = &["x", "y", "dx", "dy", "blur", "borderRadius"];

/// The 8 channels of Timeline `AnimationPose`, in order. They are the first 8 slots of `PoseBuffer`.
pub const POSE_PROPS: &[&str] = &[
    "opacity", "dx", "dy", "scaleX", "scaleY", "rotation", "blur", "reveal",
];

/// `PoseBuffer` slot table: `POSE_PROPS` comes first, the rest are BCF channel names. The order is a stable contract.
pub const MOTION_PROPS: &[&str] = &[
    // POSE_PROPS (slots 0..8)
    "opacity",
    "dx",
    "dy",
    "scaleX",
    "scaleY",
    "rotation",
    "blur",
    "reveal",
    // BCF channels
    "x",
    "y",
    "scale",
    "rotationX",
    "rotationY",
    "skewX",
    "skewY",
    "color",
    "backgroundColor",
    "borderRadius",
    "clipPath",
    "pathDraw",
    "pathMorph",
    "textCount",
    "volume",
    "cam",
    "camera",
    // Append new slots; existing indices remain stable.
    "text",
    "textReveal",
    "fontWeight",
    "letterSpacing",
    "crop",
    "focalX",
    "focalY",
    "pathStart",
    "pathEnd",
    "dashOffset",
    "pathProgress",
];

pub const MOTION_PROP_COUNT: usize = MOTION_PROPS.len();

/// Property name. In-table names are `'static`; out-of-table names are kept as written in the BCF source.
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PropertyId(Cow<'static, str>);

impl PropertyId {
    /// Constant construction of in-table properties (usable at compile time).
    pub const fn known(name: &'static str) -> Self {
        Self(Cow::Borrowed(name))
    }

    pub fn parse(name: &str) -> Self {
        match MOTION_PROPS.iter().find(|known| **known == name) {
            Some(known) => Self(Cow::Borrowed(known)),
            None => Self(Cow::Owned(name.to_owned())),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// `PoseBuffer` slot; out-of-table properties have no slot.
    pub fn slot(&self) -> Option<usize> {
        MOTION_PROPS.iter().position(|known| *known == self.0)
    }
}

impl std::fmt::Display for PropertyId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ValueKind {
    Scalar,
    LengthPx,
    Vec2,
    AngleDeg,
    Color,
    Discrete,
}

/// 0..255 components + 0..1 alpha, mirroring `scene_primitives::color::Rgba`.
///
/// Stage 1 does not produce this variant: `mix_value` still depends on `ccut-core`'s color parsing and CSS output, and moving it would drag color goldens into the same PR (plan §1.2).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgba {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub enum MotionValue {
    Scalar(f64),
    LengthPx(f64),
    Vec2([f64; 2]),
    AngleDeg(f64),
    Color(Rgba),
    /// Step value; also the lossless carrier of the raw BCF JSON (plan §4.4).
    Discrete(Value),
}

/// Property → type table from design §5.1 (stage 1 subset).
pub fn property_kind(prop: &str) -> ValueKind {
    match prop {
        "x" | "y" | "scale" | "scaleX" | "scaleY" | "rotation" | "opacity" | "blur"
        | "textCount" | "textReveal" | "fontWeight" | "letterSpacing" | "volume" | "pathDraw"
        | "pathMorph" | "dx" | "dy" | "reveal" | "focalX" | "focalY" | "pathStart" | "pathEnd"
        | "dashOffset" | "pathProgress" => ValueKind::Scalar,
        "rotationX" | "rotationY" | "skewX" | "skewY" => ValueKind::AngleDeg,
        other if effect_param_channel(other).is_some() => ValueKind::Scalar,
        _ => ValueKind::Discrete,
    }
}

impl MotionValue {
    /// JSON → strongly typed.
    ///
    /// **Only numbers that round-trip bit for bit** are recognized as scalars. When `Value::from(n) == *v` does not hold (typically the serde_json variant difference between integer `0` and `0.0`), `Discrete(v.clone())` is kept. This way `to_json()` always restores the original text, and `to_channels(to_program(chs)) == chs` holds by construction rather than by chance (plan §4.4).
    pub fn from_json(prop: &str, v: &Value) -> Self {
        let kind = property_kind(prop);
        match kind {
            ValueKind::Scalar | ValueKind::LengthPx | ValueKind::AngleDeg => {
                // `v.is_f64()` ⟺ `Value::from(n) == *v`: among JSON numbers only the Float variant can be restored as-is by `Value::from(f64)`; integer `0` would become `0.0`.
                if let Some(n) = v.as_f64()
                    && v.is_f64()
                {
                    return match kind {
                        ValueKind::AngleDeg => Self::AngleDeg(n),
                        ValueKind::LengthPx => Self::LengthPx(n),
                        _ => Self::Scalar(n),
                    };
                }
                Self::Discrete(v.clone())
            }
            _ => Self::Discrete(v.clone()),
        }
    }

    pub fn to_json(&self) -> Value {
        match self {
            Self::Scalar(n) | Self::LengthPx(n) | Self::AngleDeg(n) => Value::from(*n),
            Self::Vec2([x, y]) => Value::Array(vec![Value::from(*x), Value::from(*y)]),
            Self::Color(c) => Value::String(format!("rgba({}, {}, {}, {})", c.r, c.g, c.b, c.a)),
            Self::Discrete(v) => v.clone(),
        }
    }

    /// Scalar view; numbers inside `Discrete` count too (used for fingerprint and equivalence checks).
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Self::Scalar(n) | Self::LengthPx(n) | Self::AngleDeg(n) => Some(*n),
            Self::Discrete(v) => v.as_f64(),
            _ => None,
        }
    }

    pub fn kind(&self) -> ValueKind {
        match self {
            Self::Scalar(_) => ValueKind::Scalar,
            Self::LengthPx(_) => ValueKind::LengthPx,
            Self::Vec2(_) => ValueKind::Vec2,
            Self::AngleDeg(_) => ValueKind::AngleDeg,
            Self::Color(_) => ValueKind::Color,
            Self::Discrete(_) => ValueKind::Discrete,
        }
    }

    /// In-place replacement of a scalar of the same kind, keeping the variant unchanged.
    pub fn with_scalar(&self, n: f64) -> Self {
        match self {
            Self::LengthPx(_) => Self::LengthPx(n),
            Self::AngleDeg(_) => Self::AngleDeg(n),
            _ => Self::Scalar(n),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn pose_props_are_the_first_slots() {
        for (index, name) in POSE_PROPS.iter().enumerate() {
            assert_eq!(PropertyId::parse(name).slot(), Some(index));
        }
    }

    #[test]
    fn effect_param_channels_parse_only_the_canonical_form() {
        assert_eq!(
            effect_param_channel("effects[0].intensity"),
            Some((0, "intensity"))
        );
        assert_eq!(effect_param_channel("effects[12].tint"), Some((12, "tint")));
        for bad in [
            "effects[].x",
            "effects[01].x",
            "effects[0]x",
            "effects[0].",
            "effects[-1].x",
            "effects[0].a.b",
            "effect[0].x",
        ] {
            assert_eq!(effect_param_channel(bad), None, "{bad}");
        }
        assert!(is_animatable("effects[1].threshold"));
        assert!(is_animatable("opacity"));
        assert!(!is_animatable("width"));
        assert_eq!(property_kind("effects[0].gain"), ValueKind::Scalar);
    }

    #[test]
    fn motion_props_have_no_duplicates() {
        let mut seen = MOTION_PROPS.to_vec();
        seen.sort_unstable();
        seen.dedup();
        assert_eq!(seen.len(), MOTION_PROPS.len());
    }

    #[test]
    fn anim_props_are_all_addressable() {
        for prop in ANIM_PROPS {
            assert!(PropertyId::parse(prop).slot().is_some(), "{prop}");
        }
    }

    #[test]
    fn integers_stay_discrete_so_json_round_trips_verbatim() {
        let v = json!(0);
        let typed = MotionValue::from_json("opacity", &v);
        assert!(matches!(typed, MotionValue::Discrete(_)));
        assert_eq!(typed.to_json(), v);
        assert_eq!(typed.as_f64(), Some(0.0));

        let f = json!(0.0);
        let typed = MotionValue::from_json("opacity", &f);
        assert_eq!(typed, MotionValue::Scalar(0.0));
        assert_eq!(typed.to_json(), f);
    }

    #[test]
    fn unknown_property_keeps_its_name_without_a_slot() {
        let id = PropertyId::parse("notAProperty");
        assert_eq!(id.as_str(), "notAProperty");
        assert_eq!(id.slot(), None);
    }
}
