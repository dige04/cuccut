//! Translating the effect fields of a Timeline 0.1 element into effect-recipe references (design §6.3 / the stage 4 lowering).
//!
//! The persisted `timeline.json` format **does not change by a single byte**. `fx {grayscale, blur,
//! brightness}`, `mask {shape, feather}`, `place.radius`, and the `reveal` of the animation pose are
//! translated here into an **ordered** list of `(EffectRef, UniformMap)`, which the render side executes as given.
//!
//! The order is **the order of actual execution today**, not a redesigned order (the hard constraint of stage 4 is pixel
//! stability):
//!
//! | # | Effect | Buffer it acts on |
//! | --- | --- | --- |
//! | 1 | `filter.colorAdjust@1` | media source (native size) |
//! | 2 | `filter.blur@1` | media source (native size) |
//! | 3 | `mask.shape@1` | element-local canvas |
//! | 4 | `mask.progress@1` | element-local canvas |
//!
//! The "which buffer it acts on" column **does not belong to this layer yet**. That has to wait until each off-screen pixmap of an element
//! becomes a surface of the FramePlan (stage 4B). This layer only handles the vocabulary: id, version, uniforms
//! and order.
//!
//! ## Length units
//!
//! The three length parameters (`filter.blur.radius`, `mask.shape.radius/feather`) all declare
//! `basis: canvasShortEdge`, that is, a **proportion of the canvas short edge**. In Timeline 0.1 they are
//! "pixel counts at a 540 short edge", so lowering always divides by [`REFERENCE_SHORT_EDGE`].
//! The render side multiplies back by the real short edge, and the resulting pixel values are bit-for-bit identical to the existing implementation.

use ::motion::effect::{EffectRef, UniformMap, UniformValue};

use crate::schema::{EffectPreset, FilterPreset, Fx, Mask, MaskShape, Place};

/// Reference short edge for Timeline 0.1 visual parameters. `fx.blur = 8` means "8 px at a 540 short edge".
pub const REFERENCE_SHORT_EDGE: f64 = 540.0;

/// One effect produced by lowering.
#[derive(Debug, Clone, PartialEq)]
pub struct LoweredEffect {
    pub effect: EffectRef,
    pub uniforms: UniformMap,
}

impl LoweredEffect {
    fn new(id: &str, version: u32, uniforms: UniformMap) -> Self {
        LoweredEffect {
            effect: EffectRef::new(id, version),
            uniforms,
        }
    }

    pub fn id(&self) -> &str {
        &self.effect.id
    }
}

/// Translates the effect fields of one timeline element into an ordered effect stack.
///
/// * `fx` / `mask` — the persisted fields on the element;
/// * `place` — only `radius` is taken (rounded-corner mask);
/// * `reveal` — the reveal channel of the animation pose (only `Some` produces `mask.progress`);
/// * `pip_or_tiled` — rounded / elliptical masks take effect only in picture-in-picture or tiled layouts (consistent with the
///   existing check in `render_media_element`; corners are not clipped when fullscreen-filled).
///
/// Identity effects **produce no entry**: `fx {grayscale: 0, brightness: 0}` emits no
/// `colorAdjust`, and `radius = 0 && !ellipse` emits no `mask.shape`. This way "the effect stack is empty"
/// exactly equals "this element does not need an off-screen surface", so the planner's folding decision can use it directly.
pub fn lower_element_effects(
    fx: Option<&Fx>,
    mask: Option<&Mask>,
    place: Option<&Place>,
    reveal: Option<f64>,
    pip_or_tiled: bool,
) -> Vec<LoweredEffect> {
    let mut out = Vec::new();

    if let Some(fx) = fx {
        if let Some(preset) = fx.filter_preset {
            lower_filter_preset(&mut out, preset);
        }
        if let Some(preset) = fx.effect_preset {
            lower_effect_preset(
                &mut out,
                preset,
                fx.effect_intensity.unwrap_or(1.0).clamp(0.0, 1.0),
            );
        }
        let grayscale = fx.grayscale.unwrap_or(0.0).clamp(0.0, 1.0);
        let brightness = fx.brightness.unwrap_or(0.0).clamp(-1.0, 1.0);
        if grayscale > 0.0 || brightness != 0.0 {
            out.push(LoweredEffect::new(
                "filter.colorAdjust",
                1,
                UniformMap::new()
                    .with("grayscale", UniformValue::Scalar(grayscale))
                    .with("brightness", UniformValue::Scalar(brightness)),
            ));
        }
        push_scalar(
            &mut out,
            "filter.brightness",
            "amount",
            fx.exposure.unwrap_or(0.0).clamp(-1.0, 1.0) * (2.0 / 3.0),
            0.0,
        );
        push_scalar(
            &mut out,
            "filter.contrast",
            "amount",
            fx.contrast.unwrap_or(0.0).clamp(-1.0, 1.0),
            0.0,
        );
        push_scalar(
            &mut out,
            "filter.saturation",
            "amount",
            1.0 + fx.saturation.unwrap_or(0.0).clamp(-1.0, 1.0),
            1.0,
        );
        push_scalar(
            &mut out,
            "filter.hueRotate",
            "degrees",
            fx.hue.unwrap_or(0.0).clamp(-1.0, 1.0) * 180.0,
            0.0,
        );
        let blur = fx.blur.unwrap_or(0.0).max(0.0);
        if blur > 0.0 {
            out.push(LoweredEffect::new(
                "filter.blur",
                1,
                UniformMap::new().with("radius", UniformValue::Scalar(blur / REFERENCE_SHORT_EDGE)),
            ));
        }
        push_scalar(
            &mut out,
            "filter.sharpen",
            "amount",
            fx.sharpen.unwrap_or(0.0).clamp(0.0, 1.0),
            0.0,
        );
        push_scalar(
            &mut out,
            "filter.noise",
            "amount",
            fx.noise.unwrap_or(0.0).clamp(0.0, 1.0),
            0.0,
        );
        push_scalar(
            &mut out,
            "filter.vignette",
            "amount",
            fx.vignette.unwrap_or(0.0).clamp(0.0, 1.0),
            0.0,
        );
    }

    if pip_or_tiled {
        let radii = place
            .map(Place::corner_radii)
            .unwrap_or([0.0; 4])
            .map(|radius| radius.max(0.0));
        let radius = radii[0];
        let ellipse = mask.is_some_and(|mask| mask.shape == MaskShape::Ellipse);
        let feather = mask.and_then(|mask| mask.feather).unwrap_or(0.0).max(0.0);
        if ellipse || radii.iter().any(|radius| *radius > 0.0) {
            out.push(LoweredEffect::new(
                "mask.shape",
                1,
                UniformMap::new()
                    .with(
                        "shape",
                        UniformValue::Text(
                            if ellipse { "ellipse" } else { "roundedRect" }.to_owned(),
                        ),
                    )
                    .with(
                        "radius",
                        UniformValue::Scalar(radius / REFERENCE_SHORT_EDGE),
                    )
                    .with(
                        "radiusTopLeft",
                        UniformValue::Scalar(radii[0] / REFERENCE_SHORT_EDGE),
                    )
                    .with(
                        "radiusTopRight",
                        UniformValue::Scalar(radii[1] / REFERENCE_SHORT_EDGE),
                    )
                    .with(
                        "radiusBottomRight",
                        UniformValue::Scalar(radii[2] / REFERENCE_SHORT_EDGE),
                    )
                    .with(
                        "radiusBottomLeft",
                        UniformValue::Scalar(radii[3] / REFERENCE_SHORT_EDGE),
                    )
                    .with(
                        "feather",
                        UniformValue::Scalar(feather / REFERENCE_SHORT_EDGE),
                    ),
            ));
        }
    }

    if let Some(reveal) = reveal {
        out.push(LoweredEffect::new(
            "mask.progress",
            1,
            UniformMap::new().with("progress", UniformValue::Scalar(reveal.clamp(0.0, 1.0))),
        ));
    }

    out
}

fn push_scalar(out: &mut Vec<LoweredEffect>, id: &str, key: &str, value: f64, identity: f64) {
    if (value - identity).abs() <= f64::EPSILON {
        return;
    }
    out.push(LoweredEffect::new(
        id,
        1,
        UniformMap::new().with(key, UniformValue::Scalar(value)),
    ));
}

fn lower_filter_preset(out: &mut Vec<LoweredEffect>, preset: FilterPreset) {
    use FilterPreset::*;
    let parts: &[(&str, &str, f64, f64)] = match preset {
        None => &[],
        Calm1 => &[
            ("filter.saturation", "amount", 0.9, 1.0),
            ("filter.hueRotate", "degrees", -6.0, 0.0),
            ("filter.brightness", "amount", 0.03, 0.0),
        ],
        Calm2 => &[
            ("filter.saturation", "amount", 0.8, 1.0),
            ("filter.hueRotate", "degrees", -10.0, 0.0),
            ("filter.brightness", "amount", 0.05, 0.0),
            ("filter.contrast", "amount", -0.05, 0.0),
        ],
        Calm3 => &[
            ("filter.saturation", "amount", 0.68, 1.0),
            ("filter.hueRotate", "degrees", -14.0, 0.0),
            ("filter.brightness", "amount", 0.07, 0.0),
            ("filter.contrast", "amount", -0.08, 0.0),
        ],
        Clean1 => &[
            ("filter.contrast", "amount", 0.08, 0.0),
            ("filter.saturation", "amount", 1.04, 1.0),
        ],
        Clean2 => &[
            ("filter.contrast", "amount", 0.15, 0.0),
            ("filter.saturation", "amount", 1.08, 1.0),
            ("filter.brightness", "amount", 0.02, 0.0),
        ],
        Clean3 => &[
            ("filter.contrast", "amount", 0.24, 0.0),
            ("filter.saturation", "amount", 1.12, 1.0),
            ("filter.brightness", "amount", 0.04, 0.0),
        ],
        Cottage1 => &[
            ("filter.sepia", "amount", 0.14, 0.0),
            ("filter.saturation", "amount", 1.08, 1.0),
            ("filter.brightness", "amount", 0.02, 0.0),
        ],
        Cottage2 => &[
            ("filter.sepia", "amount", 0.24, 0.0),
            ("filter.saturation", "amount", 1.14, 1.0),
            ("filter.brightness", "amount", 0.04, 0.0),
        ],
        Cottage3 => &[
            ("filter.sepia", "amount", 0.34, 0.0),
            ("filter.saturation", "amount", 1.2, 1.0),
            ("filter.brightness", "amount", 0.06, 0.0),
            ("filter.contrast", "amount", -0.04, 0.0),
        ],
        Peckham1 => &[
            ("filter.saturation", "amount", 1.2, 1.0),
            ("filter.hueRotate", "degrees", 6.0, 0.0),
            ("filter.contrast", "amount", 0.05, 0.0),
        ],
        Peckham2 => &[
            ("filter.saturation", "amount", 1.35, 1.0),
            ("filter.hueRotate", "degrees", 10.0, 0.0),
            ("filter.contrast", "amount", 0.1, 0.0),
        ],
        Peckham3 => &[
            ("filter.saturation", "amount", 1.5, 1.0),
            ("filter.hueRotate", "degrees", 14.0, 0.0),
            ("filter.contrast", "amount", 0.16, 0.0),
        ],
    };
    for (id, key, value, identity) in parts {
        push_scalar(out, id, key, *value, *identity);
    }
}

fn lower_effect_preset(out: &mut Vec<LoweredEffect>, preset: EffectPreset, t: f64) {
    use EffectPreset::*;
    if t <= 0.0 || preset == None {
        return;
    }
    let mut lerp = |id: &str, key: &str, from: f64, to: f64| {
        push_scalar(out, id, key, from + (to - from) * t, from)
    };
    match preset {
        None => {}
        Invert => lerp("filter.invert", "amount", 0.0, 1.0),
        NightVision => {
            lerp("filter.grayscale", "amount", 0.0, 1.0);
            lerp("filter.sepia", "amount", 0.0, 1.0);
            lerp("filter.hueRotate", "degrees", 0.0, 55.0);
            lerp("filter.saturation", "amount", 1.0, 3.2);
            lerp("filter.brightness", "amount", 0.0, 0.1);
        }
        ThermalVision => {
            lerp("filter.invert", "amount", 0.0, 1.0);
            lerp("filter.hueRotate", "degrees", 0.0, 95.0);
            lerp("filter.saturation", "amount", 1.0, 3.0);
        }
        Old => {
            lerp("filter.sepia", "amount", 0.0, 0.85);
            lerp("filter.contrast", "amount", 0.0, 0.12);
            lerp("filter.brightness", "amount", 0.0, -0.04);
        }
        Polaroid => {
            lerp("filter.sepia", "amount", 0.0, 0.35);
            lerp("filter.saturation", "amount", 1.0, 1.4);
            lerp("filter.contrast", "amount", 0.0, -0.1);
            lerp("filter.brightness", "amount", 0.0, 0.08);
        }
        Filmic => {
            lerp("filter.contrast", "amount", 0.0, 0.3);
            lerp("filter.saturation", "amount", 1.0, 0.88);
            lerp("filter.brightness", "amount", 0.0, -0.02);
        }
        Snowy => {
            lerp("filter.brightness", "amount", 0.0, 0.18);
            lerp("filter.saturation", "amount", 1.0, 0.55);
            lerp("filter.contrast", "amount", 0.0, 0.12);
        }
        BoxBlur => lerp("filter.blur", "radius", 0.0, 6.0 / REFERENCE_SHORT_EDGE),
        BokehBlur => {
            lerp("filter.blur", "radius", 0.0, 10.0 / REFERENCE_SHORT_EDGE);
            lerp("filter.brightness", "amount", 0.0, 0.06);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fx(grayscale: Option<f64>, blur: Option<f64>, brightness: Option<f64>) -> Fx {
        Fx {
            grayscale,
            blur,
            brightness,
            contrast: None,
            exposure: None,
            hue: None,
            saturation: None,
            sharpen: None,
            noise: None,
            vignette: None,
            filter_preset: None,
            effect_preset: None,
            effect_intensity: None,
        }
    }

    fn place(radius: Option<f64>) -> Place {
        Place {
            x: None,
            y: None,
            w: None,
            scale: None,
            scale_y: None,
            rot: None,
            opacity: None,
            radius,
            corner_radii: None,
            flip_x: None,
            flip_y: None,
        }
    }

    #[test]
    fn an_element_without_effects_lowers_to_an_empty_stack() {
        assert!(lower_element_effects(None, None, None, None, true).is_empty());
        assert!(
            lower_element_effects(
                Some(&fx(Some(0.0), Some(0.0), Some(0.0))),
                None,
                Some(&place(Some(0.0))),
                None,
                true
            )
            .is_empty()
        );
    }

    #[test]
    fn the_stack_order_is_color_then_blur_then_shape_then_progress() {
        let stack = lower_element_effects(
            Some(&fx(Some(0.5), Some(8.0), Some(-0.1))),
            Some(&Mask {
                shape: MaskShape::Ellipse,
                feather: Some(2.0),
            }),
            Some(&place(Some(18.0))),
            Some(0.25),
            true,
        );
        assert_eq!(
            stack.iter().map(LoweredEffect::id).collect::<Vec<_>>(),
            [
                "filter.colorAdjust",
                "filter.blur",
                "mask.shape",
                "mask.progress"
            ]
        );
    }

    #[test]
    fn lengths_are_expressed_as_a_fraction_of_the_reference_short_edge() {
        let stack = lower_element_effects(
            Some(&fx(None, Some(8.0), None)),
            None,
            Some(&place(Some(27.0))),
            None,
            true,
        );
        assert_eq!(stack[0].uniforms.scalar("radius"), Some(8.0 / 540.0));
        assert_eq!(stack[1].uniforms.scalar("radius"), Some(27.0 / 540.0));
    }

    #[test]
    fn a_fullscreen_untiled_element_gets_no_shape_mask() {
        let stack = lower_element_effects(
            None,
            Some(&Mask {
                shape: MaskShape::Ellipse,
                feather: None,
            }),
            Some(&place(Some(18.0))),
            None,
            false,
        );
        assert!(stack.is_empty());
    }

    /// Every uniform produced by lowering must pass the manifest's validation — if the order table gets out of sync with
    /// the registry, it fails here.
    #[test]
    fn every_lowered_effect_resolves_against_its_manifest() {
        let stack = lower_element_effects(
            Some(&fx(Some(0.6), Some(4.0), Some(0.2))),
            Some(&Mask {
                shape: MaskShape::Ellipse,
                feather: Some(1.0),
            }),
            Some(&place(Some(18.0))),
            Some(0.5),
            true,
        );
        assert_eq!(stack.len(), 4);
        for lowered in &stack {
            let manifest = ::motion::effect::lookup(lowered.id(), lowered.effect.version)
                .unwrap_or_else(|error| panic!("{} 未注册：{error}", lowered.id()));
            manifest
                .resolve_uniforms(&lowered.uniforms)
                .unwrap_or_else(|error| panic!("{} 的 uniform 非法：{error}", lowered.id()));
        }
    }
}
