//! Transitions (video format spec §3.9): between two visual instances that touch end to end on the same track, or at an instance's entry or exit.
//! The effective length of a one-sided transition shrinks as the instance gets shorter ([`Transition::effective_frames`]). The kinds and duration ranges are taken from v2's `timeline::video_transitions`.
//!
//! Transitions only use the instance's handles (the parts of the source material outside the instance's range) and never make instances overlap. Instances on the same track never overlap to begin with (§3.4), so there is no “real overlap” kind. The kinds form a closed set; an unrecognized kind is kept as-is, treated as a hard cut in the plan, and reported (§1.4).

use message_ref::{Text, msg};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::{FrameSpan, Id};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(try_from = "RawTransition", into = "RawTransition")]
pub struct Transition {
    pub id: Id,
    /// The picture leaves it (the outgoing side). When this is the only side, it is the instance's exit transition.
    pub left_item_id: Option<Id>,
    /// The picture enters it (the incoming side). When this is the only side, it is the instance's entry transition.
    pub right_item_id: Option<Id>,
    pub kind: TransitionKind,
    pub duration_frames: i64,
    pub easing: Easing,
    pub placement: TransitionPlacement,
    /// The audio of both instances is crossfaded at the same time, using equal-power curves.
    pub audio_crossfade: bool,
}

/// The transition kind and its parameters (§3.9). The first five kinds can be one-sided or two-sided; `dip-to-color` and `push` are two-sided only.
#[derive(Clone, Debug, PartialEq)]
pub enum TransitionKind {
    /// Opacity multiplied by progress.
    Dissolve,
    /// Reveals progress amount from the left edge of the box.
    Wipe,
    /// Slides in from the left along the box's own horizontal axis, while fading in.
    Slide,
    /// Scales around the box center from 0.75 + 0.25 × progress, while fading in.
    Zoom,
    /// Circular reveal centered on the box center.
    Iris,
    /// Blends first toward a color, then from that color into the new picture. Two-sided only.
    DipToColor { color: String },
    /// The new picture is pushed in along `direction`, pushing the old picture out. Two-sided only.
    Push { direction: Direction },
    /// A kind this version does not recognize (or recognizes but whose parameters cannot be read): kept as-is, rendered as a hard cut, and reported.
    Unsupported { kind: String, params: Map<String, Value> },
}

/// Kinds that can be one-sided or two-sided, matching `timeline::video_transitions::PRESETS` (with `none` removed).
pub const SINGLE_SIDED_KINDS: &[&str] = &["dissolve", "wipe", "slide", "zoom", "iris"];
/// Kinds that are two-sided only.
pub const TWO_SIDED_ONLY_KINDS: &[&str] = &["dip-to-color", "push"];

impl TransitionKind {
    pub fn name(&self) -> &str {
        match self {
            TransitionKind::Dissolve => "dissolve",
            TransitionKind::Wipe => "wipe",
            TransitionKind::Slide => "slide",
            TransitionKind::Zoom => "zoom",
            TransitionKind::Iris => "iris",
            TransitionKind::DipToColor { .. } => "dip-to-color",
            TransitionKind::Push { .. } => "push",
            TransitionKind::Unsupported { kind, .. } => kind,
        }
    }

    /// Kinds that are two-sided only.
    pub fn two_sided_only(&self) -> bool {
        matches!(self, TransitionKind::DipToColor { .. } | TransitionKind::Push { .. })
    }

    pub fn params(&self) -> Map<String, Value> {
        let mut map = Map::new();
        match self {
            TransitionKind::DipToColor { color } => {
                map.insert("color".into(), Value::String(color.clone()));
            }
            TransitionKind::Push { direction } => {
                map.insert("direction".into(), serde_json::to_value(direction).expect("枚举总能序列化"));
            }
            TransitionKind::Unsupported { params, .. } => return params.clone(),
            _ => {}
        }
        map
    }

    /// Constructs from a name and parameters. Returns `None` when the name is not recognized; returns an error description when the parameters are invalid.
    pub fn parse(kind: &str, params: &Map<String, Value>) -> Option<Result<TransitionKind, Text>> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Empty {}
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Color {
            color: String,
        }
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Directed {
            direction: Direction,
        }
        let value = Value::Object(params.clone());
        let err = |e: serde_json::Error| {
            msg!("videoModel.transitionParamsInvalid", "Invalid parameters for {kind}: {error}", kind, error = e.to_string())
        };
        let plain = |made: TransitionKind| serde_json::from_value::<Empty>(value.clone()).map(|_| made).map_err(err);
        Some(match kind {
            "dissolve" => plain(TransitionKind::Dissolve),
            "wipe" => plain(TransitionKind::Wipe),
            "slide" => plain(TransitionKind::Slide),
            "zoom" => plain(TransitionKind::Zoom),
            "iris" => plain(TransitionKind::Iris),
            "dip-to-color" => serde_json::from_value::<Color>(value).map_err(err).and_then(|c| {
                if is_hex_color(&c.color) {
                    Ok(TransitionKind::DipToColor { color: c.color })
                } else {
                    Err(msg!("videoModel.dipColorInvalid", "color of dip-to-color must be #RRGGBB"))
                }
            }),
            "push" => serde_json::from_value::<Directed>(value)
                .map_err(err)
                .map(|d| TransitionKind::Push { direction: d.direction }),
            _ => return None,
        })
    }
}

/// Direction of motion: which way the picture or edge travels.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

/// Easing curve (shares one vocabulary with the volume envelope, §3.9): maps the linear progress `p ∈ [0, 1]` to eased progress.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Easing {
    #[default]
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
}

impl Easing {
    pub fn parse(text: &str) -> Option<Easing> {
        serde_json::from_value(Value::String(text.to_string())).ok()
    }

    pub fn apply(self, p: f64) -> f64 {
        let p = if p.is_finite() { p.clamp(0.0, 1.0) } else { 0.0 };
        match self {
            Easing::Linear => p,
            Easing::EaseIn => p * p,
            Easing::EaseOut => 1.0 - (1.0 - p) * (1.0 - p),
            Easing::EaseInOut => p * p * (3.0 - 2.0 * p),
        }
    }
}

/// Where the window of a two-sided transition sits relative to the cut point. A one-sided transition always lies within the instance, so this does not apply to it.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TransitionPlacement {
    /// Centered on the cut point: `[cut − ⌊D/2⌋, cut − ⌊D/2⌋ + D)`.
    #[default]
    Center,
    /// Starts at the cut point: `[cut, cut + D)`, using the handles at the tail of the left-hand instance.
    StartAtCut,
    /// Ends at the cut point: `[cut − D, cut)`, using the handles at the head of the right-hand instance.
    EndAtCut,
}

impl Transition {
    /// The frame range `[start, end)` the transition occupies on the sequence. For a two-sided transition the cut point is the end of the left-hand instance;
    /// the caller checks whether the two sides touch end to end. `None` when neither side is present.
    pub fn window(&self, left: Option<FrameSpan>, right: Option<FrameSpan>) -> Option<(i64, i64)> {
        let d = self.effective_frames(left, right);
        let start = match (left, right) {
            (Some(l), Some(_)) => {
                let cut = l.end_frame();
                match self.placement {
                    TransitionPlacement::Center => cut - d / 2,
                    TransitionPlacement::StartAtCut => cut,
                    TransitionPlacement::EndAtCut => cut - d,
                }
            }
            (None, Some(r)) => r.from_frame,
            (Some(l), None) => l.end_frame() - d,
            (None, None) => return None,
        };
        Some((start, start + d))
    }

    /// Whether it is one-sided (entry or exit).
    pub fn is_single_sided(&self) -> bool {
        self.left_item_id.is_none() || self.right_item_id.is_none()
    }

    /// Effective length (frames). For a two-sided transition it is the length as written; for a one-sided transition it is min(D, ⌊L / 2⌋), where L is the instance's frame count (§3.9), so it shortens as the instance shortens. At 0 this side is drawn as a hard cut.
    pub fn effective_frames(&self, left: Option<FrameSpan>, right: Option<FrameSpan>) -> i64 {
        match (left, right) {
            (Some(_), Some(_)) => self.duration_frames,
            (Some(span), None) | (None, Some(span)) => self.duration_frames.min(span.duration_frames / 2).max(0),
            (None, None) => 0,
        }
    }

    /// The instances the transition involves.
    pub fn item_ids(&self) -> impl Iterator<Item = &Id> {
        self.left_item_id.iter().chain(&self.right_item_id)
    }
}

pub(crate) fn is_hex_color(text: &str) -> bool {
    text.len() == 7 && text.starts_with('#') && text[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// Storage and exchange form: `kind` is a string, parameters are in `params`.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTransition {
    id: Id,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    left_item_id: Option<Id>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    right_item_id: Option<Id>,
    kind: String,
    #[serde(default, skip_serializing_if = "Map::is_empty")]
    params: Map<String, Value>,
    duration_frames: i64,
    #[serde(default)]
    easing: Easing,
    #[serde(default)]
    placement: TransitionPlacement,
    #[serde(default, skip_serializing_if = "is_false")]
    audio_crossfade: bool,
}

impl TryFrom<RawTransition> for Transition {
    type Error = String;

    fn try_from(raw: RawTransition) -> Result<Transition, String> {
        if raw.left_item_id.is_none() && raw.right_item_id.is_none() {
            return Err(format!("transition {} has no clip on either side", raw.id));
        }
        let kind = match TransitionKind::parse(&raw.kind, &raw.params) {
            Some(Ok(kind)) => kind,
            // Unrecognized kinds and unreadable parameters are kept as-is (§1.4).
            _ => TransitionKind::Unsupported {
                kind: raw.kind,
                params: raw.params,
            },
        };
        Ok(Transition {
            id: raw.id,
            left_item_id: raw.left_item_id,
            right_item_id: raw.right_item_id,
            kind,
            duration_frames: raw.duration_frames,
            easing: raw.easing,
            placement: raw.placement,
            audio_crossfade: raw.audio_crossfade,
        })
    }
}

impl From<Transition> for RawTransition {
    fn from(t: Transition) -> RawTransition {
        RawTransition {
            params: t.kind.params(),
            kind: t.kind.name().to_string(),
            id: t.id,
            left_item_id: t.left_item_id,
            right_item_id: t.right_item_id,
            duration_frames: t.duration_frames,
            easing: t.easing,
            placement: t.placement,
            audio_crossfade: t.audio_crossfade,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn known_kinds_round_trip_and_unknown_kinds_are_kept() {
        let value = json!({
            "id": "tr_1", "leftItemId": "a", "rightItemId": "b", "kind": "push", "params": { "direction": "left" },
            "durationFrames": 12, "easing": "ease-in-out", "placement": "start-at-cut", "audioCrossfade": true
        });
        let t: Transition = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(
            t.kind,
            TransitionKind::Push {
                direction: Direction::Left
            }
        );
        assert_eq!(serde_json::to_value(&t).unwrap(), value);

        let future = json!({ "id": "tr_2", "rightItemId": "b", "kind": "spiral", "params": { "shape": "star" }, "durationFrames": 5, "easing": "linear", "placement": "center" });
        let t: Transition = serde_json::from_value(future.clone()).unwrap();
        assert!(matches!(&t.kind, TransitionKind::Unsupported { kind, .. } if kind == "spiral"));
        assert_eq!(serde_json::to_value(&t).unwrap(), future);
        // A recognized kind with unreadable parameters is likewise kept as-is.
        let odd = json!({ "id": "tr_3", "rightItemId": "b", "kind": "wipe", "params": { "direction": "left" }, "durationFrames": 5, "easing": "linear", "placement": "center" });
        let t: Transition = serde_json::from_value(odd.clone()).unwrap();
        assert!(matches!(&t.kind, TransitionKind::Unsupported { kind, .. } if kind == "wipe"));
        assert_eq!(serde_json::to_value(&t).unwrap(), odd);
    }

    #[test]
    fn windows_follow_the_placement() {
        let left = FrameSpan {
            from_frame: 0,
            duration_frames: 90,
        };
        let right = FrameSpan {
            from_frame: 90,
            duration_frames: 60,
        };
        let mut t = Transition {
            id: "t".into(),
            left_item_id: Some("a".into()),
            right_item_id: Some("b".into()),
            kind: TransitionKind::Dissolve,
            duration_frames: 15,
            easing: Easing::Linear,
            placement: TransitionPlacement::Center,
            audio_crossfade: false,
        };
        assert_eq!(t.window(Some(left), Some(right)), Some((83, 98)));
        t.placement = TransitionPlacement::StartAtCut;
        assert_eq!(t.window(Some(left), Some(right)), Some((90, 105)));
        t.placement = TransitionPlacement::EndAtCut;
        assert_eq!(t.window(Some(left), Some(right)), Some((75, 90)));
        assert_eq!(t.window(None, Some(right)), Some((90, 105)));
        assert_eq!(t.window(Some(left), None), Some((75, 90)));
        // The effective length of a one-sided transition does not exceed half the instance.
        let short = FrameSpan {
            from_frame: 90,
            duration_frames: 20,
        };
        assert_eq!(t.effective_frames(None, Some(short)), 10);
        assert_eq!(t.window(None, Some(short)), Some((90, 100)));
        assert_eq!(t.effective_frames(Some(left), Some(right)), 15);
    }

    #[test]
    fn easing_curves_meet_their_ends() {
        for e in [Easing::Linear, Easing::EaseIn, Easing::EaseOut, Easing::EaseInOut] {
            assert_eq!(e.apply(0.0), 0.0);
            assert_eq!(e.apply(1.0), 1.0);
        }
        assert_eq!(Easing::EaseIn.apply(0.5), 0.25);
        assert_eq!(Easing::EaseOut.apply(0.5), 0.75);
        assert_eq!(Easing::EaseInOut.apply(0.5), 0.5);
    }
}
