//! Image similarity comparison: SSIM plus per-channel maximum deviation, reused for golden and cross-backend tolerance comparisons.
//!
//! Before WP5b the repository had three mutually inconsistent SSIM implementations: `ccut ssim` / `ccut compare` in `apps/cli` (grayscale, 8×8 **non-overlapping** windows, population variance, alpha channel dropped), `tests/gpu_conformance.rs` in this crate (per-channel RGBA, 8×8 **sliding** windows, sample variance, plus 4× box downsampling and per-channel maximum deviation diagnostics), and a minimal grayscale version in the `ccut-media-native` tests. Each followed its own algorithm, so the same pair of images could report different SSIM values.
//!
//! This module consolidates them into a single implementation, using the `gpu_conformance.rs` version as the algorithmic baseline, since it is the most mature of the three: sliding windows match the reference SSIM paper's definition better than non-overlapping windows, per-channel comparison catches decoding-matrix differences that drift in only one color channel better than grayscale, and the downsampled SSIM and per-channel maximum deviation are exactly the diagnostic shape that `docs/design/bcf/cuccut-format-spec.md` §15.1 requires (tolerance criterion + bias diagnostics).
//!
//! The pass/fail thresholds in `gpu_conformance.rs` itself (`SSIM_FLOOR_STRICT` / `SSIM_FLOOR_VISUAL` / `EDGE_PIXEL_SHARE`) and its three assertion checks stay where they are. They judge the specific question of whether the GPU anti-aliasing function is acceptable, not this module's algorithm contract. This module consolidates only **the algorithm itself**; each caller decides which field of [`Comparison`] to gate on.
//!
//! It performs no I/O and depends only on `tiny-skia` (the `wasm-safe` subset of `ccut-render` already includes rasterization), so it is not gated behind the `media` feature.

use anyhow::{Result, bail};
use tiny_skia::Pixmap;

/// Per-channel deviation budget for flat-region pixels (pixels whose 3×3 neighborhood is constant in both images). Only deviations above this value count as “transition band” pixels. Keeps the value that `gpu_conformance.rs` originally used (the 2 in render plan §8.7).
pub const FLAT_CHANNEL_BUDGET: u8 = 2;

/// Box-downsampling factor for [`Comparison::ssim_downsampled`].
pub const DOWNSAMPLE_FACTOR: usize = 4;

/// Measured distribution from one RGBA image pair comparison.
#[derive(Debug, Clone, Copy)]
pub struct Comparison {
    /// Worst SSIM across the four channels (R/G/B/A) at full resolution (8×8 sliding window, sample variance).
    pub ssim: f64,
    /// Maximum absolute per-channel deviation across the whole image.
    pub max_deviation: u8,
    /// Maximum absolute per-channel deviation in **flat regions** (where the 3×3 neighborhood is constant in both images). This is the diagnostic §15.1 asks for, “record the per-channel maximum deviation in addition to SSIM”; it is more sensitive than SSIM to whole-image small biases such as YUV→RGB matrix differences.
    pub flat_max_deviation: u8,
    /// Share of pixels whose deviation is greater than [`FLAT_CHANNEL_BUDGET`].
    pub edge_share: f64,
    /// SSIM after applying one [`DOWNSAMPLE_FACTOR`]× box downsample to both sides. It spreads edge transition bands out by area, and measures whether the two images look like the same image, rather than whether the per-pixel anti-aliasing function is the same. When the image is smaller than the downsampling factor, it falls back to the same value as [`Comparison::ssim`] (downsampling is meaningless at that size).
    pub ssim_downsampled: f64,
}

/// Compares two RGBA `Pixmap`s; returns `Err` when the sizes differ (it does not panic, because the production CLI path must turn this into a normal failure envelope rather than crash the whole process).
pub fn compare(a: &Pixmap, b: &Pixmap) -> Result<Comparison> {
    if (a.width(), a.height()) != (b.width(), b.height()) {
        bail!(
            "size mismatch: {}x{} vs {}x{}",
            a.width(),
            a.height(),
            b.width(),
            b.height()
        );
    }
    let (w, h) = (a.width() as usize, a.height() as usize);
    let (da, db) = (a.data(), b.data());

    let mut ssim = f64::MAX;
    for channel in 0..4 {
        let plane_a: Vec<u8> = da.iter().skip(channel).step_by(4).copied().collect();
        let plane_b: Vec<u8> = db.iter().skip(channel).step_by(4).copied().collect();
        ssim = ssim.min(plane_ssim(&plane_a, &plane_b, w, h));
    }

    let mut max_deviation = 0u8;
    let mut flat_max_deviation = 0u8;
    let mut edge_pixels = 0usize;
    for y in 0..h {
        for x in 0..w {
            let base = (y * w + x) * 4;
            let mut pixel_max = 0u8;
            for channel in 0..4 {
                pixel_max = pixel_max.max(da[base + channel].abs_diff(db[base + channel]));
            }
            max_deviation = max_deviation.max(pixel_max);
            if pixel_max > FLAT_CHANNEL_BUDGET {
                edge_pixels += 1;
            }
            if is_flat(da, w, h, x, y) && is_flat(db, w, h, x, y) {
                flat_max_deviation = flat_max_deviation.max(pixel_max);
            }
        }
    }

    let ssim_downsampled = if w >= DOWNSAMPLE_FACTOR && h >= DOWNSAMPLE_FACTOR {
        let (small_a, sw, sh) = box_downsample(da, w, h, DOWNSAMPLE_FACTOR);
        let (small_b, _, _) = box_downsample(db, w, h, DOWNSAMPLE_FACTOR);
        let mut downsampled = f64::MAX;
        for channel in 0..4 {
            let plane_a: Vec<u8> = small_a.iter().skip(channel).step_by(4).copied().collect();
            let plane_b: Vec<u8> = small_b.iter().skip(channel).step_by(4).copied().collect();
            downsampled = downsampled.min(plane_ssim(&plane_a, &plane_b, sw, sh));
        }
        downsampled
    } else {
        // The image is smaller than the downsampling factor: downsampling is meaningless, so reuse the full-resolution SSIM directly.
        ssim
    };

    Ok(Comparison {
        ssim,
        max_deviation,
        flat_max_deviation,
        edge_share: edge_pixels as f64 / (w * h).max(1) as f64,
        ssim_downsampled,
    })
}

/// Box downsampling of RGBA8 (averaged in the premultiplied domain, the same rule as the executor's supersampling).
fn box_downsample(rgba: &[u8], w: usize, h: usize, factor: usize) -> (Vec<u8>, usize, usize) {
    let (ow, oh) = (w / factor, h / factor);
    let area = (factor * factor) as f64;
    let mut out = Vec::with_capacity(ow * oh * 4);
    for y in 0..oh {
        for x in 0..ow {
            let mut sums = [0f64; 4];
            for dy in 0..factor {
                for dx in 0..factor {
                    let base = ((y * factor + dy) * w + x * factor + dx) * 4;
                    for (channel, sum) in sums.iter_mut().enumerate() {
                        *sum += f64::from(rgba[base + channel]);
                    }
                }
            }
            for sum in sums {
                out.push((sum / area).round().clamp(0.0, 255.0) as u8);
            }
        }
    }
    (out, ow, oh)
}

/// A 3×3 neighborhood (including the pixel itself) that is constant per channel = “this pixel is not on any edge”.
///
/// Pixels on the image border have incomplete neighborhoods and are always counted as **not** flat; that is the most conservative reading.
fn is_flat(data: &[u8], w: usize, h: usize, x: usize, y: usize) -> bool {
    if x == 0 || y == 0 || x + 1 >= w || y + 1 >= h {
        return false;
    }
    let center = &data[((y * w + x) * 4)..][..4];
    for dy in -1i64..=1 {
        for dx in -1i64..=1 {
            let nx = (x as i64 + dx) as usize;
            let ny = (y as i64 + dy) as usize;
            if &data[((ny * w + nx) * 4)..][..4] != center {
                return false;
            }
        }
    }
    true
}

/// Single-channel SSIM: 8×8 sliding window, stride 1, window mean, sample variance (N−1).
///
/// The constants take the standard values `C1 = (0.01·255)²` and `C2 = (0.03·255)²`.
fn plane_ssim(a: &[u8], b: &[u8], w: usize, h: usize) -> f64 {
    const WINDOW: usize = 8;
    const C1: f64 = 6.5025; // (0.01 * 255)^2
    const C2: f64 = 58.5225; // (0.03 * 255)^2
    if w < WINDOW || h < WINDOW {
        // If the image is smaller than one window, it degrades to a single window covering the whole image.
        return window_ssim(a, b, w, 0, 0, w, h, C1, C2);
    }
    let mut total = 0.0;
    let mut count = 0usize;
    for y in 0..=(h - WINDOW) {
        for x in 0..=(w - WINDOW) {
            total += window_ssim(a, b, w, x, y, WINDOW, WINDOW, C1, C2);
            count += 1;
        }
    }
    total / count as f64
}

#[allow(clippy::too_many_arguments)]
fn window_ssim(
    a: &[u8],
    b: &[u8],
    w: usize,
    x0: usize,
    y0: usize,
    ww: usize,
    wh: usize,
    c1: f64,
    c2: f64,
) -> f64 {
    let n = (ww.max(1) * wh.max(1)) as f64;
    let (mut sum_a, mut sum_b) = (0.0, 0.0);
    for y in y0..y0 + wh {
        for x in x0..x0 + ww {
            sum_a += f64::from(a[y * w + x]);
            sum_b += f64::from(b[y * w + x]);
        }
    }
    let (mu_a, mu_b) = (sum_a / n, sum_b / n);
    let (mut va, mut vb, mut cov) = (0.0, 0.0, 0.0);
    for y in y0..y0 + wh {
        for x in x0..x0 + ww {
            let da = f64::from(a[y * w + x]) - mu_a;
            let db = f64::from(b[y * w + x]) - mu_b;
            va += da * da;
            vb += db * db;
            cov += da * db;
        }
    }
    // Sample variance (N−1), consistent with common SSIM implementations; a single-pixel window (N=1) degrades to 0.
    let denom = (n - 1.0).max(1.0);
    let (va, vb, cov) = (va / denom, vb / denom, cov / denom);
    ((2.0 * mu_a * mu_b + c1) * (2.0 * cov + c2))
        / ((mu_a * mu_a + mu_b * mu_b + c1) * (va + vb + c2))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32, gray: u8) -> Pixmap {
        let mut pixmap = Pixmap::new(width, height).unwrap();
        let color = tiny_skia::Color::from_rgba8(gray, gray, gray, 255);
        pixmap.fill(color);
        pixmap
    }

    #[test]
    fn identical_solids_score_a_perfect_ssim() {
        let a = solid(16, 16, 80);
        let b = solid(16, 16, 80);
        let measured = compare(&a, &b).unwrap();
        assert!((measured.ssim - 1.0).abs() < 1e-9);
        assert!((measured.ssim_downsampled - 1.0).abs() < 1e-9);
        assert_eq!(measured.max_deviation, 0);
        assert_eq!(measured.flat_max_deviation, 0);
        assert_eq!(measured.edge_share, 0.0);
    }

    #[test]
    fn black_vs_white_scores_a_near_zero_ssim() {
        let black = solid(16, 16, 0);
        let white = solid(16, 16, 255);
        let measured = compare(&black, &white).unwrap();
        assert!(measured.ssim < 0.001, "ssim={}", measured.ssim);
        assert_eq!(measured.max_deviation, 255);
    }

    #[test]
    fn mismatched_sizes_are_reported_not_panicked() {
        let a = solid(8, 8, 0);
        let b = solid(9, 8, 0);
        let error = compare(&a, &b).unwrap_err();
        assert!(error.to_string().contains("size mismatch"), "{error}");
    }

    /// When the image is smaller than the downsampling factor, it neither panics nor produces NaN.
    #[test]
    fn tiny_images_fall_back_to_full_resolution_ssim() {
        let a = solid(2, 2, 40);
        let b = solid(2, 2, 40);
        let measured = compare(&a, &b).unwrap();
        assert!((measured.ssim - 1.0).abs() < 1e-9);
        assert_eq!(measured.ssim_downsampled, measured.ssim);
    }
}
