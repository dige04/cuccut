//! `filter.godRays@1`: volumetric light / light shafts. Take the bright areas, apply a radial stretch blur centered on the light source, multiply by the tint, then add the result back onto the original image.
//!
//! 1. **Bright pass**: the part where the premultiplied RGB max component `m` exceeds `threshold` is weighted per pixel by `w = clamp((m − t) / (1 − t))`. This keeps the hue, so a golden line drawing drags out golden light. At the same time it is downsampled 2×2 to half resolution, because light shafts are low-frequency anyway and half resolution saves three quarters of the samples.
//! 2. **Stretch**: uses the same three-pass log-step scaled sampling as `filter.radialBlur` ([`super::radial_blur::zoom_passes`]), centered on the light source. `length` is the fraction of the way the farthest sample point travels toward the light source, and `decay` lowers the weight of distant samples to `1 − decay`. Pixel p receives light from the bright areas on the line "p → light source", so bright objects drag light shafts in the direction **away from** the light source.
//! 3. **Add back**: bilinear upsample to the original resolution, then add RGB × `tint` (RGB) × `intensity` and alpha × `tint.a` × `intensity` onto the original image. The result is clamped so alpha ≥ RGB. This follows the same convention as `filter.bloom`: on a transparent background, bright objects grow light shafts that carry alpha.
//!
//! The light source coordinates are ratios of the canvas (= input surface) width and height. They may fall outside the frame, for example a skylight above the top edge of the picture.
//! Numerics: f32 arithmetic. The transcendental functions are computed with `libm` only, to build the weight table before the per-pixel loop.

use super::radial_blur::{Px, bilinear, zoom_passes};

/// Samples per pass: three passes give 512 effective sample points in total.
const TAPS: u32 = 8;

#[derive(Debug, Clone, Copy)]
pub struct GodRays {
    pub cx: f64,
    pub cy: f64,
    pub threshold: f64,
    /// Fraction of the way the farthest sample point travels toward the light source, `0..0.95`.
    pub length: f64,
    pub intensity: f64,
    /// `0..1`: the weight of the farthest sample is `1 − decay`.
    pub decay: f64,
    /// Non-premultiplied RGBA, 0..1.
    pub tint: [f64; 4],
}

pub fn god_rays(data: &mut [u8], width: usize, height: usize, params: &GodRays) {
    let length = params.length.clamp(0.0, 0.95);
    if width == 0 || height == 0 || params.intensity <= 0.0 || length <= 0.0 {
        return;
    }
    let threshold = params.threshold.clamp(0.0, 0.999) as f32;
    let (hw, hh) = (width.div_ceil(2), height.div_ceil(2));

    // 1. Bright pass + 2×2 downsample (edge clamping).
    let bright = |x: usize, y: usize| -> Px {
        let offset = (y.min(height - 1) * width + x.min(width - 1)) * 4;
        let px = &data[offset..offset + 4];
        let peak = f32::from(px[0].max(px[1]).max(px[2])) / 255.0;
        let weight = ((peak - threshold) / (1.0 - threshold)).clamp(0.0, 1.0);
        [
            f32::from(px[0]) * weight,
            f32::from(px[1]) * weight,
            f32::from(px[2]) * weight,
            f32::from(px[3]) * weight,
        ]
    };
    let mut rays: Vec<Px> = Vec::with_capacity(hw * hh);
    for y in 0..hh {
        for x in 0..hw {
            let (a, b) = (bright(2 * x, 2 * y), bright(2 * x + 1, 2 * y));
            let (c, d) = (bright(2 * x, 2 * y + 1), bright(2 * x + 1, 2 * y + 1));
            let mut px = [0.0f32; 4];
            for k in 0..4 {
                px[k] = (a[k] + b[k] + c[k] + d[k]) / 4.0;
            }
            rays.push(px);
        }
    }

    // 2. Radial stretch centered on the light source (half-resolution pixel coordinates).
    let center = (
        params.cx * width as f64 / 2.0,
        params.cy * height as f64 / 2.0,
    );
    let sigma = -libm::log(1.0 - length);
    zoom_passes(
        &mut rays,
        hw,
        hh,
        center,
        sigma,
        TAPS,
        1.0 - params.decay.clamp(0.0, 0.9999),
    );

    // 3. Upsample, tint, add back.
    let gain = params.intensity as f32;
    let tint = [
        params.tint[0].clamp(0.0, 1.0) as f32 * gain,
        params.tint[1].clamp(0.0, 1.0) as f32 * gain,
        params.tint[2].clamp(0.0, 1.0) as f32 * gain,
        params.tint[3].clamp(0.0, 1.0) as f32 * gain,
    ];
    for y in 0..height {
        let sy = (y as f32 + 0.5) / 2.0 - 0.5;
        for x in 0..width {
            let sx = (x as f32 + 0.5) / 2.0 - 0.5;
            let light = bilinear(&rays, hw, hh, sx, sy);
            let offset = (y * width + x) * 4;
            let out = &mut data[offset..offset + 4];
            let alpha = (f32::from(out[3]) + light[3] * tint[3]).min(255.0);
            for k in 0..3 {
                let value = (f32::from(out[k]) + light[k] * tint[k]).min(alpha);
                out[k] = value.round() as u8;
            }
            out[3] = alpha.round() as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> GodRays {
        GodRays {
            cx: 0.5,
            cy: 0.0,
            threshold: 0.5,
            length: 0.6,
            intensity: 1.5,
            decay: 0.5,
            tint: [1.0, 0.85, 0.5, 1.0],
        }
    }

    #[test]
    fn below_threshold_and_zero_intensity_are_identity() {
        let mut data: Vec<u8> = (0..64 * 64).flat_map(|_| [60, 60, 60, 255]).collect();
        let before = data.clone();
        god_rays(&mut data, 64, 64, &params());
        assert_eq!(data, before);
        let mut bright: Vec<u8> = (0..64 * 64).flat_map(|_| [255, 255, 255, 255]).collect();
        let copy = bright.clone();
        god_rays(
            &mut bright,
            64,
            64,
            &GodRays {
                intensity: 0.0,
                ..params()
            },
        );
        assert_eq!(bright, copy);
    }

    #[test]
    fn a_bright_spot_casts_a_shaft_away_from_the_light() {
        let size = 96;
        let mut data: Vec<u8> = (0..size * size).flat_map(|_| [0, 0, 0, 255]).collect();
        // Light source at the middle of the top edge; the bright block is near (48, 24).
        for y in 22..26 {
            for x in 46..50 {
                let offset = (y * size + x) * 4;
                data[offset..offset + 4].copy_from_slice(&[255, 230, 150, 255]);
            }
        }
        god_rays(&mut data, size, size, &params());
        let red = |x: usize, y: usize| data[(y * size + x) * 4];
        // The area below the bright block (away from the light source) is lit. The area above it (the light-source side) and the sides stay dark.
        assert!(red(48, 40) > 10, "下方应有光柱：{}", red(48, 40));
        assert!(red(48, 40) > red(48, 60), "光柱应随距离衰减");
        assert_eq!(red(48, 12), 0, "光源一侧不应有光");
        assert_eq!(red(20, 40), 0, "侧面不应有光");
    }
}
