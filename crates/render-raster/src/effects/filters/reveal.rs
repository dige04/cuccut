//! Horizontal progress wipe reveal (`mask.progress@1`).
//!
//! **Moved line by line from** `core/crates/ccut-kernel/src/cmd/studio_export/raster.rs::apply_horizontal_reveal`.
//! `boundary = progress × width`, `coverage = clamp(boundary - x, 0, 1)`. The boundary pixels therefore get a one-pixel-wide linear transition band.

use super::mask_shape::multiply_pixel_coverage;

pub fn horizontal_reveal(data: &mut [u8], width: u32, height: u32, reveal: f64) {
    let pixmap_width = width as usize;
    let boundary = reveal.clamp(0.0, 1.0) * f64::from(width);
    for y in 0..height as usize {
        for x in 0..pixmap_width {
            let coverage = (boundary - x as f64).clamp(0.0, 1.0);
            let offset = (y * pixmap_width + x) * 4;
            multiply_pixel_coverage(&mut data[offset..offset + 4], coverage);
        }
    }
}

/// The form for `invert: true`: reveals from right to left.
pub fn horizontal_reveal_inverted(data: &mut [u8], width: u32, height: u32, reveal: f64) {
    let pixmap_width = width as usize;
    let boundary = (1.0 - reveal.clamp(0.0, 1.0)) * f64::from(width);
    for y in 0..height as usize {
        for x in 0..pixmap_width {
            let coverage = (x as f64 + 1.0 - boundary).clamp(0.0, 1.0);
            let offset = (y * pixmap_width + x) * 4;
            multiply_pixel_coverage(&mut data[offset..offset + 4], coverage);
        }
    }
}
