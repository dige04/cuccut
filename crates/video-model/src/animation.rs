//! Keyframes and element animation (video format spec §3.15).
//!
//! The three element-animation slots are formal fields of the instance, stored as they are and sampled by `motion` at render time; preset names, ranges and easing names are defined by
//! `Animation::validate` in `timeline::schema`. A keyframe is an `AnimationBinding` on the sequence: its time is a frame local to the instance or a percentage of the instance length, and at validation it is converted to `timeline::keyframes::Keyframes` and handed to `timeline`.

use message_ref::{Text, msg};
use serde::{Deserialize, Serialize};

use crate::Id;

/// The three slots of element animation.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Animation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enter: Option<AnimationSlot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit: Option<AnimationSlot>,
    #[serde(default, rename = "loop", skip_serializing_if = "Option::is_none")]
    pub r#loop: Option<AnimationSlot>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnimationSlot {
    pub preset: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset_version: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dur: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delay: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intensity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ease: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stagger: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stagger_from: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
}

impl Animation {
    pub fn is_empty(&self) -> bool {
        self.enter.is_none() && self.exit.is_none() && self.r#loop.is_none()
    }

    pub fn to_timeline(&self) -> timeline::schema::Animation {
        timeline::schema::Animation {
            enter: self.enter.as_ref().map(AnimationSlot::to_timeline),
            exit: self.exit.as_ref().map(AnimationSlot::to_timeline),
            r#loop: self.r#loop.as_ref().map(AnimationSlot::to_timeline),
        }
    }
}

impl AnimationSlot {
    pub fn to_timeline(&self) -> timeline::schema::AnimationSlot {
        timeline::schema::AnimationSlot {
            preset: self.preset.clone(),
            preset_version: self.preset_version,
            dur: self.dur,
            delay: self.delay,
            intensity: self.intensity,
            ease: self.ease.clone(),
            stagger: self.stagger,
            stagger_from: self.stagger_from.clone(),
            period: self.period,
            phase: self.phase,
            seed: self.seed,
        }
    }
}

/// One keyframe binding: one property of one picture instance.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnimationBinding {
    pub id: Id,
    pub target_id: Id,
    pub property_path: KeyframeProperty,
    pub keyframes: Vec<Keyframe>,
}

/// Keyframe properties: one-to-one with the same-named fields of `place`. Volume keyframes are the mix envelope (§3.9) and are not here.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum KeyframeProperty {
    #[serde(rename = "x")]
    X,
    #[serde(rename = "y")]
    Y,
    #[serde(rename = "scale")]
    Scale,
    #[serde(rename = "scaleY")]
    ScaleY,
    #[serde(rename = "rot")]
    Rot,
    #[serde(rename = "opacity")]
    Opacity,
    #[serde(rename = "radius")]
    Radius,
}

impl KeyframeProperty {
    /// The names in `timeline::keyframes::KEYFRAME_PROPS`.
    pub fn as_str(self) -> &'static str {
        match self {
            KeyframeProperty::X => "x",
            KeyframeProperty::Y => "y",
            KeyframeProperty::Scale => "scale",
            KeyframeProperty::ScaleY => "scaleY",
            KeyframeProperty::Rot => "rot",
            KeyframeProperty::Opacity => "opacity",
            KeyframeProperty::Radius => "radius",
        }
    }
}

/// One keyframe. Exactly one of `localFrame` and `percent`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Keyframe {
    /// A frame local to the instance, on the sequence edit grid, ≥ 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_frame: Option<i64>,
    /// A percentage of the instance length, [0, 100].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    pub value: f64,
    /// The easing of the segment that leads into this frame; default `linear`; names are taken from `motion`'s easing table.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ease: Option<String>,
}

/// Converts a binding on an instance into v2's `Keyframes`: `localFrame` is converted to seconds local to the instance using `fps` (frames per second),
/// and percentages are written as `"N%"`. A frame that has both `localFrame` and `percent`, or neither, returns an error.
pub fn bindings_to_timeline<'a>(
    bindings: impl IntoIterator<Item = &'a AnimationBinding>,
    fps: f64,
) -> Result<timeline::keyframes::Keyframes, Text> {
    use timeline::keyframes::{KeyTime, Keyframe as V2Keyframe, Keyframes};
    let mut out = Keyframes::default();
    for binding in bindings {
        let mut frames = Vec::with_capacity(binding.keyframes.len());
        for key in &binding.keyframes {
            let t = match (key.local_frame, key.percent) {
                (Some(frame), None) => {
                    if frame < 0 {
                        return Err(msg!(
                            "videoModel.bindingNegativeFrame",
                            "localFrame of binding {binding} cannot be negative",
                            binding = binding.id
                        ));
                    }
                    KeyTime::Seconds(frame as f64 / fps)
                }
                (None, Some(percent)) => KeyTime::Percent(format!("{percent}%")),
                _ => {
                    return Err(msg!(
                        "videoModel.bindingFrameOrPercent",
                        "Each keyframe of binding {binding} must give exactly one of localFrame and percent",
                        binding = binding.id
                    ));
                }
            };
            frames.push(V2Keyframe {
                t,
                v: key.value,
                ease: key.ease.clone(),
            });
        }
        let prop = binding.property_path.as_str();
        if out.get(prop).is_some() {
            return Err(msg!(
                "videoModel.bindingDuplicate",
                "{prop} of clip {item} has more than one keyframe binding",
                prop,
                item = binding.target_id
            ));
        }
        out.set(prop, Some(frames));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn animation_round_trips_and_validates_through_timeline() {
        let value = json!({ "enter": { "preset": "fade", "dur": 0.5 }, "loop": { "preset": "pulse", "period": 1.0 } });
        let animation: Animation = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&animation).unwrap(), value);
        assert!(animation.to_timeline().validate("e").is_ok());
        let bad: Animation = serde_json::from_value(json!({ "enter": { "preset": "no-such-preset" } })).unwrap();
        assert!(bad.to_timeline().validate("e").is_err());
    }

    #[test]
    fn bindings_become_v2_keyframes() {
        let binding: AnimationBinding = serde_json::from_value(json!({
            "id": "kb_1", "targetId": "i", "propertyPath": "opacity",
            "keyframes": [{ "localFrame": 0, "value": 0.0 }, { "localFrame": 30, "value": 1.0, "ease": "easeOutQuad" }]
        }))
        .unwrap();
        let frames = bindings_to_timeline([&binding], 30.0).unwrap();
        assert!(frames.opacity.is_some());
        let caps = timeline::keyframes::KeyframeCaps {
            transform: true,
            radius: false,
            volume: false,
        };
        assert!(frames.validate("i", caps).is_ok());
        assert!(serde_json::from_value::<KeyframeProperty>(json!("volume")).is_err());
    }
}
