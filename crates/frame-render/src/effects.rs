//! `fx` (format spec §3.9) is applied in a fixed order.
//!
//! 1–10 apply to the source picture (after cropping and before being placed in the frame, as with v2 media elements): filter and effect presets, grayscale and brightness, exposure, contrast, saturation, and hue, via the recipes from `timeline::lower_element_effects`, executed by `render-raster`; color temperature (8) has no ready-made recipe, so it is drawn here using the formula from the spec; blur, sharpen, grain and vignette (9–10) are handed back to recipes. Lengths are scaled from the 540-pixel short edge to the output canvas short edge.
//! Masks and reveals (11–12) are in the kernel's element pipeline. Stroke and shadow (13–14) apply to the finished layer: they follow the alpha outline, so they already include the results of masks, rounded corners and element animation; color and offset are in canvas direction and do not rotate with the instance.

use anyhow::Result;
use render_raster::effects::{EffectRef, UniformMap, UniformValue, apply_filter_in_place};
use subtitle_render::apply_media_effects;
use tiny_skia::Pixmap;
use video_model::Fx;

/// Effects 1–10 applied to the source picture. `short_edge` is the output canvas short edge, in pixels.
pub fn apply_to_source(fx: &Fx, pixmap: &mut Pixmap, short_edge: f64) {
    let scale = short_edge / timeline::REFERENCE_SHORT_EDGE;
    let v2 = fx.to_timeline();
    let colour = timeline::schema::Fx {
        blur: None,
        sharpen: None,
        noise: None,
        vignette: None,
        ..v2.clone()
    };
    apply_media_effects(pixmap, Some(&colour), scale);
    if let Some(amount) = fx.temperature.filter(|t| t.is_finite() && *t != 0.0) {
        temperature(pixmap, amount.clamp(-1.0, 1.0));
    }
    let detail = timeline::schema::Fx {
        grayscale: None,
        brightness: None,
        contrast: None,
        exposure: None,
        hue: None,
        saturation: None,
        filter_preset: None,
        effect_preset: None,
        effect_intensity: None,
        ..v2
    };
    apply_media_effects(pixmap, Some(&detail), scale);
}

/// Color temperature: R × (1 + 0.2t), B × (1 − 0.2t), clamped to [0, 1]. Computed on premultiplied values; clamping to alpha is equivalent to clamping to 1 on straight values.
pub fn temperature(pixmap: &mut Pixmap, amount: f64) {
    let red = 1.0 + 0.2 * amount;
    let blue = 1.0 - 0.2 * amount;
    for px in pixmap.data_mut().chunks_exact_mut(4) {
        let a = f64::from(px[3]);
        px[0] = (f64::from(px[0]) * red).round().min(a) as u8;
        px[2] = (f64::from(px[2]) * blue).round().min(a) as u8;
    }
}

/// Effects 13–14 applied to the finished layer: stroke first, then shadow.
pub fn apply_to_layer(fx: &Fx, layer: &mut Pixmap, short_edge: f64) -> Result<()> {
    if let Some(stroke) = &fx.stroke
        && stroke.width > 0.0
    {
        let uniforms = UniformMap::new()
            .with(
                "radius",
                UniformValue::Scalar((stroke.width / timeline::REFERENCE_SHORT_EDGE).clamp(0.0, 0.1)),
            )
            .with("color", UniformValue::Color(straight_color(&stroke.color, 1.0)));
        apply_filter_in_place(&EffectRef::new("filter.outline", 1), &uniforms, layer, short_edge)?;
    }
    if let Some(shadow) = &fx.shadow
        && shadow.opacity > 0.0
    {
        let uniforms = UniformMap::new()
            .with(
                "radius",
                UniformValue::Scalar((shadow.blur / timeline::REFERENCE_SHORT_EDGE).clamp(0.0, 0.5)),
            )
            .with(
                "dx",
                UniformValue::Scalar((shadow.offset_x / timeline::REFERENCE_SHORT_EDGE).clamp(-1.0, 1.0)),
            )
            .with(
                "dy",
                UniformValue::Scalar((shadow.offset_y / timeline::REFERENCE_SHORT_EDGE).clamp(-1.0, 1.0)),
            )
            .with(
                "color",
                UniformValue::Color(straight_color(&shadow.color, shadow.opacity.clamp(0.0, 1.0))),
            );
        apply_filter_in_place(&EffectRef::new("filter.dropShadow", 1), &uniforms, layer, short_edge)?;
    }
    Ok(())
}

/// Converts `#RRGGBB` / `#RRGGBBAA` to straight 0–1 RGBA, with alpha further multiplied by `alpha`. Black when unreadable.
pub fn straight_color(text: &str, alpha: f64) -> [f64; 4] {
    let [r, g, b, a] = hex_rgba(text).unwrap_or([0, 0, 0, 255]);
    [
        f64::from(r) / 255.0,
        f64::from(g) / 255.0,
        f64::from(b) / 255.0,
        f64::from(a) / 255.0 * alpha,
    ]
}

/// The four components of `#RRGGBB` or `#RRGGBBAA`.
pub fn hex_rgba(text: &str) -> Option<[u8; 4]> {
    let hex = text.strip_prefix('#')?;
    if !matches!(hex.len(), 6 | 8) || !hex.is_ascii() {
        return None;
    }
    let byte = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).ok();
    Some([byte(0)?, byte(2)?, byte(4)?, if hex.len() == 8 { byte(6)? } else { 255 }])
}

/// The stroke or shadow makes the layer's pixels extend beyond its own box (a layer as large as the whole canvas).
pub fn needs_layer_pass(fx: &Fx) -> bool {
    fx.stroke.as_ref().is_some_and(|s| s.width > 0.0) || fx.shadow.as_ref().is_some_and(|s| s.opacity > 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temperature_scales_red_and_blue_and_clips_to_alpha() {
        // Premultiplied values: the semi-transparent (200, 100, 100) is (100, 50, 50, 128).
        let mut pixmap = Pixmap::new(1, 1).unwrap();
        pixmap.data_mut().copy_from_slice(&[100, 50, 50, 128]);
        temperature(&mut pixmap, 1.0);
        assert_eq!(pixmap.data(), &[120, 50, 40, 128]);
        // Clamping to alpha equals clamping the straight value to 1.
        pixmap.data_mut().copy_from_slice(&[120, 50, 40, 128]);
        temperature(&mut pixmap, 1.0);
        assert_eq!(pixmap.data(), &[128, 50, 32, 128]);
        pixmap.data_mut().copy_from_slice(&[100, 50, 100, 128]);
        temperature(&mut pixmap, -0.5);
        assert_eq!(pixmap.data(), &[90, 50, 110, 128]);
    }

    #[test]
    fn colours_read_six_and_eight_digit_hex() {
        assert_eq!(hex_rgba("#FF8000"), Some([255, 128, 0, 255]));
        assert_eq!(hex_rgba("#ff800080"), Some([255, 128, 0, 128]));
        assert_eq!(hex_rgba("#F80"), None);
        assert_eq!(hex_rgba("red"), None);
        assert_eq!(straight_color("#FFFFFF80", 0.5), [1.0, 1.0, 1.0, 128.0 / 255.0 * 0.5]);
        assert_eq!(straight_color("nope", 1.0), [0.0, 0.0, 0.0, 1.0]);
    }
}
