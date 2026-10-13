//! Image mask (`mask.image@1` / `mask.luma@1`).
//!
//! The alpha or luminance of the second input is used as coverage. Its size must match the main input.
//! Coverage is multiplied onto all four premultiplied channels.

use super::color_adjust::LUMA;
use super::mask_shape::multiply_pixel_coverage;
use anyhow::{Result, bail};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaskChannel {
    Alpha,
    Luminance,
}

pub fn image_mask(data: &mut [u8], mask: &[u8], channel: MaskChannel, invert: bool) -> Result<()> {
    if data.len() != mask.len() {
        bail!(
            "effect-input-mismatch: mask buffer is {} bytes, input is {} bytes",
            mask.len(),
            data.len()
        );
    }
    for (pixel, mask_pixel) in data.chunks_exact_mut(4).zip(mask.chunks_exact(4)) {
        let mask_alpha = f64::from(mask_pixel[3]) / 255.0;
        let coverage = match channel {
            MaskChannel::Alpha => mask_alpha,
            MaskChannel::Luminance => {
                if mask_alpha <= 0.0 {
                    0.0
                } else {
                    (f64::from(mask_pixel[0]) / mask_alpha * LUMA[0]
                        + f64::from(mask_pixel[1]) / mask_alpha * LUMA[1]
                        + f64::from(mask_pixel[2]) / mask_alpha * LUMA[2])
                        / 255.0
                }
            }
        };
        let coverage = if invert { 1.0 - coverage } else { coverage };
        multiply_pixel_coverage(pixel, coverage);
    }
    Ok(())
}
