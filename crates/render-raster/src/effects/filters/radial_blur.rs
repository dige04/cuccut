//! `filter.radialBlur@1`: radial (zoom) blur. Each pixel averages samples along the line from "pixel → center", so the blur stretches further the farther the pixel is from the center. The center point itself does not move.
//!
//! The implementation is three passes of log-step scaled sampling, shared with `filter.godRays` through [`zoom_passes`]. With the center as origin, sample points are `c + (p − c)·e^{−o}`, where `o` is the log scale amount. Pass k (k = 1, 2, 3) uses `o = j·σ/Tᵏ, j = 0..T`. After the three passes are composed, `o` is exactly T³ evenly spaced points with step `σ/T³` over `[0, σ)`. Each pixel therefore does only 3T bilinear samples and gets the effect of T³ sample points.
//! `σ = −ln(1 − strength)`: `strength` is the fraction of the way the farthest sample point travels toward the center.
//!
//! Numerics: f32 arithmetic. `e^{−o}` and the weights are each computed once with `libm` before the per-pixel loop (T per pass), so native and wasm are bit-identical. Pixel conventions match the other filters: premultiplied sRGB / u8.

pub(crate) type Px = [f32; 4];

/// Passes: T³ effective sample points.
const PASSES: u32 = 3;

pub(crate) fn to_planes(data: &[u8]) -> Vec<Px> {
    data.chunks_exact(4)
        .map(|px| {
            [
                f32::from(px[0]),
                f32::from(px[1]),
                f32::from(px[2]),
                f32::from(px[3]),
            ]
        })
        .collect()
}

/// Bilinear sampling. Coordinates are continuous, with pixel centers at integer values. Edges are clamped.
#[inline]
pub(crate) fn bilinear(buf: &[Px], width: usize, height: usize, x: f32, y: f32) -> Px {
    let x = x.clamp(0.0, (width - 1) as f32);
    let y = y.clamp(0.0, (height - 1) as f32);
    let (fx, fy) = (x.floor(), y.floor());
    let (tx, ty) = (x - fx, y - fy);
    let (x0, y0) = (fx as usize, fy as usize);
    let (x1, y1) = ((x0 + 1).min(width - 1), (y0 + 1).min(height - 1));
    let (a, b) = (buf[y0 * width + x0], buf[y0 * width + x1]);
    let (c, d) = (buf[y1 * width + x0], buf[y1 * width + x1]);
    let mut out = [0.0f32; 4];
    for k in 0..4 {
        let top = a[k] + (b[k] - a[k]) * tx;
        let bottom = c[k] + (d[k] - c[k]) * tx;
        out[k] = top + (bottom - top) * ty;
    }
    out
}

/// Three-pass log-step scaled sampling. `center` is in pixel coordinates (the pixel center is `x + 0.5`; it may lie outside the canvas). `sigma` is the total log scale amount. `taps` is the number of samples per pass. `far_weight` is the weight of the farthest sample relative to the nearest one: 1 means an equal-weight average, and smaller values favor the near side, which gives the light-shaft falloff. Each pass normalizes its weights, so the composed result is still a weighted average.
pub(crate) fn zoom_passes(
    buf: &mut Vec<Px>,
    width: usize,
    height: usize,
    center: (f64, f64),
    sigma: f64,
    taps: u32,
    far_weight: f64,
) {
    if width == 0 || height == 0 || sigma <= 0.0 || taps < 2 {
        return;
    }
    let far_weight = far_weight.clamp(1e-4, 1.0);
    let (cx, cy) = (center.0 as f32, center.1 as f32);
    let mut scratch: Vec<Px> = vec![[0.0; 4]; buf.len()];
    let mut step = sigma;
    for _ in 0..PASSES {
        step /= f64::from(taps);
        let mut factors = Vec::with_capacity(taps as usize);
        let mut weights = Vec::with_capacity(taps as usize);
        for j in 0..taps {
            let offset = f64::from(j) * step;
            factors.push(libm::exp(-offset) as f32);
            // (far_weight)^(offset / σ)
            weights.push(libm::exp(libm::log(far_weight) * offset / sigma));
        }
        let total: f64 = weights.iter().sum();
        let weights: Vec<f32> = weights.iter().map(|w| (w / total) as f32).collect();
        for y in 0..height {
            let py = y as f32 + 0.5 - cy;
            for x in 0..width {
                let px = x as f32 + 0.5 - cx;
                let mut acc = [0.0f32; 4];
                for (factor, weight) in factors.iter().zip(&weights) {
                    let sx = cx + px * factor - 0.5;
                    let sy = cy + py * factor - 0.5;
                    let sample = bilinear(buf, width, height, sx, sy);
                    for k in 0..4 {
                        acc[k] += sample[k] * weight;
                    }
                }
                scratch[y * width + x] = acc;
            }
        }
        std::mem::swap(buf, &mut scratch);
    }
}

/// Writes back to u8: rounds and keeps the premultiplication invariant (RGB ≤ alpha).
pub(crate) fn store(data: &mut [u8], buf: &[Px]) {
    for (out, px) in data.chunks_exact_mut(4).zip(buf) {
        let alpha = px[3].clamp(0.0, 255.0).round();
        out[3] = alpha as u8;
        for k in 0..3 {
            out[k] = px[k].clamp(0.0, alpha).round() as u8;
        }
    }
}

/// Radial blur. `cx` / `cy` are ratios of the canvas (= input surface) width and height. `strength` ∈ [0, 0.95] is the fraction of the way the farthest sample point travels toward the center. `samples` is the number of samples per pass (three passes).
pub fn radial_blur(
    data: &mut [u8],
    width: usize,
    height: usize,
    cx: f64,
    cy: f64,
    strength: f64,
    samples: f64,
) {
    let strength = strength.clamp(0.0, 0.95);
    if width == 0 || height == 0 || strength <= 0.0 {
        return;
    }
    let taps = samples.round().clamp(2.0, 16.0) as u32;
    let sigma = -libm::log(1.0 - strength);
    let mut buf = to_planes(data);
    zoom_passes(
        &mut buf,
        width,
        height,
        (cx * width as f64, cy * height as f64),
        sigma,
        taps,
        1.0,
    );
    store(data, &buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dot(size: usize, at: (usize, usize)) -> Vec<u8> {
        let mut data = vec![0u8; size * size * 4];
        let offset = (at.1 * size + at.0) * 4;
        data[offset..offset + 4].copy_from_slice(&[255; 4]);
        data
    }

    #[test]
    fn zero_strength_is_the_identity() {
        let mut data = dot(16, (3, 5));
        let before = data.clone();
        radial_blur(&mut data, 16, 16, 0.5, 0.5, 0.0, 8.0);
        assert_eq!(data, before);
    }

    #[test]
    fn a_dot_smears_toward_the_center_only() {
        let size = 64;
        let mut data = dot(size, (56, 32));
        radial_blur(&mut data, size, size, 0.5, 0.5, 0.4, 8.0);
        let alpha = |x: usize, y: usize| data[(y * size + x) * 4 + 3];
        // The point is to the right of the center. The outer side (opposite the direction toward the center) has smearing, and the inner side has none.
        assert!(alpha(60, 32) > 0, "外侧应有拖影");
        assert_eq!(alpha(50, 32), 0, "内侧不应有拖影");
        assert_eq!(alpha(56, 20), 0, "垂直方向不应扩散");
    }

    #[test]
    fn the_center_pixel_stays_put() {
        let size = 33;
        let mut data = dot(size, (16, 16));
        radial_blur(&mut data, size, size, 0.5, 0.5, 0.6, 8.0);
        assert_eq!(
            &data[(16 * size + 16) * 4..(16 * size + 16) * 4 + 4],
            &[255; 4]
        );
    }
}
