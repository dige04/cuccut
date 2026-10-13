//! Chroma key (`filter.chromaKey@1`).
//!
//! After un-premultiplying, the RGB Euclidean distance to the key color is computed. `≤ similarity × D` is fully transparent, and `≤ (similarity + smoothness) × D` transitions linearly, where `D = sqrt(3) × 255` is the diagonal length of the RGB cube. The coverage is multiplied into the premultiplied four channels.

use super::mask_shape::multiply_pixel_coverage;

/// RGB cube diagonal: sqrt(3) × 255.
const DIAGONAL: f64 = 441.672_955_930_063_7;

pub fn chroma_key(data: &mut [u8], color: [f64; 4], similarity: f64, smoothness: f64) {
    let key = [
        color[0].clamp(0.0, 1.0) * 255.0,
        color[1].clamp(0.0, 1.0) * 255.0,
        color[2].clamp(0.0, 1.0) * 255.0,
    ];
    let inner = similarity.clamp(0.0, 1.0) * DIAGONAL;
    let outer = (similarity.clamp(0.0, 1.0) + smoothness.clamp(0.0, 1.0)) * DIAGONAL;
    for pixel in data.chunks_exact_mut(4) {
        let alpha = f64::from(pixel[3]) / 255.0;
        if alpha <= 0.0 {
            continue;
        }
        let red = f64::from(pixel[0]) / alpha;
        let green = f64::from(pixel[1]) / alpha;
        let blue = f64::from(pixel[2]) / alpha;
        let distance =
            ((red - key[0]).powi(2) + (green - key[1]).powi(2) + (blue - key[2]).powi(2)).sqrt();
        let coverage = if distance <= inner {
            0.0
        } else if distance >= outer || outer <= inner {
            1.0
        } else {
            (distance - inner) / (outer - inner)
        };
        if coverage < 1.0 {
            multiply_pixel_coverage(pixel, coverage);
        }
    }
}
