//! Effects on visual media and composition instances (video format spec §3.9), masks, and cropping of the source picture (§3.5).
//!
//! `fx` is a fixed field of the v2 element model; rendering applies effects in the fixed order given in the spec, regardless of the order the fields are written in. Value ranges are defined by
//! `timeline::schema` (`FX_AMOUNT_RANGE`, `FX_ADJUST_RANGE`, `FX_BLUR_RANGE`). `temperature`,
//! `shadow` and `stroke` are fields merged in from the three effects that v3 already had; v2 does not have them, and their ranges are the constants here.

use message_ref::{Text, msg};
use serde::{Deserialize, Serialize};
pub use timeline::schema::{EffectPreset, FilterPreset, MaskShape};

/// The range of `fx.temperature`.
pub const FX_TEMPERATURE_RANGE: (f64, f64) = (-1.0, 1.0);
/// The range of `fx.shadow.blur` (pixels at a 540 short edge).
pub const FX_SHADOW_BLUR_RANGE: (f64, f64) = (0.0, 200.0);
/// The upper limit of `fx.stroke.width` (pixels at a 540 short edge); the lower limit excludes 0.
pub const FX_STROKE_WIDTH_MAX: f64 = 100.0;
/// The range of `fx.shadow.opacity`.
pub const FX_SHADOW_OPACITY_RANGE: (f64, f64) = (0.0, 1.0);

/// Effects on fixed fields (§3.9). A field that is omitted or equal to its identity value produces no effect.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Fx {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter_preset: Option<FilterPreset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect_preset: Option<EffectPreset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect_intensity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grayscale: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brightness: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exposure: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contrast: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saturation: Option<f64>,
    /// [-1, 1], multiplied by 180 degrees.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hue: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    /// [0, 100], pixels at a 540 short edge.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blur: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sharpen: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub noise: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vignette: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shadow: Option<FxShadow>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke: Option<FxStroke>,
}

/// Shadow: the alpha outline is offset, blurred and filled, drawn under the picture. Lengths are pixels at a 540 short edge; right and down are positive.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FxShadow {
    pub offset_x: f64,
    pub offset_y: f64,
    pub blur: f64,
    pub color: String,
    pub opacity: f64,
}

/// Stroke: drawn as a ring along the outside of the alpha outline. `width` is in (0, 100], pixels at a 540 short edge.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FxStroke {
    pub width: f64,
    pub color: String,
}

impl Fx {
    /// v2's fields of the same names (excluding the three merged in from v3); validated and evaluated by `timeline`.
    pub fn to_timeline(&self) -> timeline::schema::Fx {
        timeline::schema::Fx {
            grayscale: self.grayscale,
            blur: self.blur,
            brightness: self.brightness,
            contrast: self.contrast,
            exposure: self.exposure,
            hue: self.hue,
            saturation: self.saturation,
            sharpen: self.sharpen,
            noise: self.noise,
            vignette: self.vignette,
            filter_preset: self.filter_preset,
            effect_preset: self.effect_preset,
            effect_intensity: self.effect_intensity,
        }
    }

    /// Value checks for the three fields merged in from v3; v2 fields are checked by `timeline::schema::Fx::validate`.
    pub fn check_v3_fields(&self) -> Result<(), Text> {
        let (lo, hi) = FX_TEMPERATURE_RANGE;
        if self.temperature.is_some_and(|v| !v.is_finite() || !(lo..=hi).contains(&v)) {
            return Err(msg!("videoModel.fxTemperatureRange", "fx.temperature must be within -1..=1"));
        }
        if let Some(shadow) = &self.shadow {
            let (lo, hi) = FX_SHADOW_BLUR_RANGE;
            if !shadow.offset_x.is_finite() || !shadow.offset_y.is_finite() {
                return Err(msg!("videoModel.fxShadowOffset", "The fx.shadow offsets must be finite numbers"));
            }
            if !shadow.blur.is_finite() || !(lo..=hi).contains(&shadow.blur) {
                return Err(msg!("videoModel.fxShadowBlurRange", "fx.shadow.blur must be within 0..=200"));
            }
            let (lo, hi) = FX_SHADOW_OPACITY_RANGE;
            if !shadow.opacity.is_finite() || !(lo..=hi).contains(&shadow.opacity) {
                return Err(msg!("videoModel.fxShadowOpacityRange", "fx.shadow.opacity must be within 0..=1"));
            }
            if !is_color(&shadow.color) {
                return Err(msg!("videoModel.fxShadowColor", "fx.shadow.color must be #RRGGBB or #RRGGBBAA"));
            }
        }
        if let Some(stroke) = &self.stroke {
            if !stroke.width.is_finite() || stroke.width <= 0.0 || stroke.width > FX_STROKE_WIDTH_MAX {
                return Err(msg!("videoModel.fxStrokeWidthRange", "fx.stroke.width must be within (0, 100]"));
            }
            if !is_color(&stroke.color) {
                return Err(msg!("videoModel.fxStrokeColor", "fx.stroke.color must be #RRGGBB or #RRGGBBAA"));
            }
        }
        Ok(())
    }

    /// No fields at all: equivalent to no effect.
    pub fn is_empty(&self) -> bool {
        *self == Fx::default()
    }
}

/// Mask (§3.9): an ellipse inscribed in the frame; `feather` is pixels at a 540 short edge.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Mask {
    pub shape: MaskShape,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feather: Option<f64>,
}

impl Mask {
    pub fn to_timeline(&self) -> timeline::schema::Mask {
        timeline::schema::Mask {
            shape: self.shape,
            feather: self.feather,
        }
    }
}

/// Cropping of the source picture (§3.5): the proportion cut from each edge.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Crop {
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
}

impl Crop {
    /// Each side in [0, 1); left plus right, and top plus bottom, sum to less than 1 (so the remaining picture has area).
    pub fn is_valid(&self) -> bool {
        let sides = [self.left, self.top, self.right, self.bottom];
        sides.iter().all(|v| v.is_finite() && (0.0..1.0).contains(v)) && self.left + self.right < 1.0 && self.top + self.bottom < 1.0
    }

    /// All four sides 0: equivalent to no cropping.
    pub fn is_empty(&self) -> bool {
        self.left == 0.0 && self.top == 0.0 && self.right == 0.0 && self.bottom == 0.0
    }

    /// The kept region, normalized to the source's displayed size as `[u0, v0, u1, v1]`.
    pub fn rect(&self) -> [f64; 4] {
        [self.left, self.top, 1.0 - self.right, 1.0 - self.bottom]
    }
}

/// `#RRGGBB` or `#RRGGBBAA` (§3.7: colors are always written in one of these two forms).
pub fn is_color(text: &str) -> bool {
    matches!(text.len(), 7 | 9) && text.starts_with('#') && text[1..].chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fx_round_trips_without_nulls_and_checks_the_v3_fields() {
        let value = json!({
            "filterPreset": "calm1", "effectPreset": "night_vision", "brightness": 0.2, "temperature": -0.5,
            "shadow": { "offsetX": 4.0, "offsetY": 4.0, "blur": 8.0, "color": "#000000", "opacity": 0.5 },
            "stroke": { "width": 3.0, "color": "#FFFFFF" }
        });
        let fx: Fx = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&fx).unwrap(), value);
        assert!(fx.check_v3_fields().is_ok());
        assert!(fx.to_timeline().validate("e").is_ok());
        let bad = Fx {
            temperature: Some(2.0),
            ..Fx::default()
        };
        assert!(bad.check_v3_fields().is_err());
        let bad = Fx {
            stroke: Some(FxStroke {
                width: 0.0,
                color: "#FFFFFF".into(),
            }),
            ..Fx::default()
        };
        assert!(bad.check_v3_fields().is_err());
    }

    #[test]
    fn crop_bounds() {
        let crop = Crop {
            left: 0.1,
            top: 0.0,
            right: 0.2,
            bottom: 0.5,
        };
        assert!(crop.is_valid());
        assert_eq!(crop.rect(), [0.1, 0.0, 0.8, 0.5]);
        assert!(
            !Crop {
                left: 0.6,
                top: 0.0,
                right: 0.4,
                bottom: 0.0
            }
            .is_valid()
        );
    }
}
