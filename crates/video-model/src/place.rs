//! Geometry of picture instances and common fields of visual media (video format spec §3.5).
//!
//! Field names, values and defaults follow v2's `timeline::schema`; this is the exchange form that does not write `null`,
//! and during validation and evaluation it is converted to the same-named types of `timeline` (`to_timeline`).

use serde::{Deserialize, Serialize};
pub use timeline::schema::{Background, CornerRadii, Fit, VisualMode};

use crate::effect::{Fx, Mask};

/// Geometry (§3.5): stored as percentages of the frame. Defaults are per kind; see `timeline::geometry::default_place`.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Place {
    /// The horizontal coordinate of the frame's center, as a percentage of canvas width; left edge is 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    /// The vertical coordinate of the frame's center, as a percentage of canvas height; top edge is 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    /// Frame width, as a percentage of the width base.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub w: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale_y: Option<f64>,
    /// Degrees, clockwise around the frame's center.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rot: Option<f64>,
    /// [0, 1], default 1.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f64>,
    /// Uniform corner radius for all four corners, pixels at a 540 short edge.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radius: Option<f64>,
    /// Per-corner radii, same units as `radius`; when both are present, this one takes precedence.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub corner_radii: Option<CornerRadii>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub flip_x: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub flip_y: bool,
}

impl Place {
    pub fn to_timeline(&self) -> timeline::schema::Place {
        timeline::schema::Place {
            x: self.x,
            y: self.y,
            w: self.w,
            scale: self.scale,
            scale_y: self.scale_y,
            rot: self.rot,
            opacity: self.opacity,
            radius: self.radius,
            corner_radii: self.corner_radii,
            flip_x: self.flip_x.then_some(true),
            flip_y: self.flip_y.then_some(true),
        }
    }

    /// Opacity, default 1.
    pub fn opacity(&self) -> f64 {
        self.opacity.unwrap_or(1.0)
    }

    /// The corner radii `[top-left, top-right, bottom-right, bottom-left]`, pixels at a 540 short edge.
    pub fn corner_radii(&self) -> [f64; 4] {
        self.to_timeline().corner_radii()
    }
}

/// Tiling (§3.5): omitted entirely when not tiled.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Tile {
    pub on: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub angle: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gap_x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gap_y: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stagger: Option<bool>,
}

impl Tile {
    pub fn to_timeline(&self) -> timeline::schema::Tile {
        timeline::schema::Tile {
            on: self.on,
            angle: self.angle,
            gap_x: self.gap_x,
            gap_y: self.gap_y,
            stagger: self.stagger,
        }
    }
}

/// Common fields of visual media (§3.4 `MediaFields`): video, image, placeholder frame, whiteboard and material stickers.
/// `mask` and `fx` are also used for composition instances, where they are written separately.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFields {
    /// Default `pip`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<VisualMode>,
    /// Default `cover`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fit: Option<Fit>,
    /// Default `black`; takes effect only when `fullscreen` is combined with `contain`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bg: Option<Background>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mask: Option<Mask>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fx: Option<Fx>,
}

impl MediaFields {
    pub fn is_empty(&self) -> bool {
        *self == MediaFields::default()
    }

    pub fn mode(&self) -> VisualMode {
        self.mode.unwrap_or(VisualMode::Pip)
    }

    pub fn fit(&self) -> Fit {
        self.fit.unwrap_or(Fit::Cover)
    }

    pub fn bg(&self) -> Background {
        self.bg.unwrap_or(Background::Black)
    }
}

pub(crate) fn is_false(value: &bool) -> bool {
    !*value
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn place_omits_absent_fields_and_maps_to_timeline() {
        let value = json!({ "x": 50.0, "w": 34.0, "opacity": 0.5, "flipX": true });
        let place: Place = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&place).unwrap(), value);
        let v2 = place.to_timeline();
        assert_eq!(v2.flip_x, Some(true));
        assert_eq!(v2.flip_y, None);
        assert!(v2.validate("e").is_ok());
        assert!(serde_json::from_value::<Place>(json!({ "width": 3 })).is_err());
    }

    #[test]
    fn background_reads_any_case_and_writes_upper() {
        let media: MediaFields = serde_json::from_value(json!({ "bg": "#a0b1c2", "fit": "contain" })).unwrap();
        assert_eq!(serde_json::to_value(&media).unwrap(), json!({ "fit": "contain", "bg": "#A0B1C2" }));
    }
}
