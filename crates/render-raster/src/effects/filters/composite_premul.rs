//! Integer source-over for premultiplied RGBA.
//!
//! **Moved line by line from** `composite_premultiplied_rgba` in `core/crates/ccut-kernel/src/cmd/studio_export/raster.rs`. It only iterates over `bounds`: the source's alpha and RGB outside the box are always 0 (the premultiplication invariant `rgb ≤ a`), and `dst = 0 + dst * 255 / 255 = dst` is an identity operation, so skipping them is byte-identical to a full-frame traversal.

use super::blur::ContentBox;

pub fn composite_premultiplied_rgba(
    destination: &mut [u8],
    source: &[u8],
    width: usize,
    bounds: &ContentBox,
) {
    for y in bounds.rows.clone() {
        let start = (y * width + bounds.cols.start) * 4;
        let end = (y * width + bounds.cols.end) * 4;
        composite_premultiplied_row(&mut destination[start..end], &source[start..end]);
    }
}

/// Source-over over a run of pixels of equal length (per pixel as above); when the two buffers have different strides, call it per row.
pub fn composite_premultiplied_row(destination: &mut [u8], source: &[u8]) {
    for (destination, source) in destination.chunks_exact_mut(4).zip(source.chunks_exact(4)) {
        let alpha = u16::from(source[3]);
        if alpha == 0 {
            continue;
        }
        let inverse = 255 - alpha;
        for channel in 0..4 {
            destination[channel] = (u16::from(source[channel])
                + u16::from(destination[channel]) * inverse / 255)
                .min(255) as u8;
        }
    }
}
