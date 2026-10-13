//! Platform-independent size derivation and CPU resampling.
//!
//! The **fast path for scaling lives in the platform layer**: AVFoundation's `maximumSize`, CoreGraphics' bitmap context, and Media Foundation's advanced video processing can all produce the target size directly on the decode path. This module is the fallback: when a platform does not do so (MF often only agrees to return the original size), it performs one CPU resample to guarantee that the size contract of [`crate::extract_frame_rgba`] always holds.
//!
//! The filter is **box (area-average)**, which is enough for thumbnails. When downsampling it is the plainest area average (better anti-aliasing than bilinear); when upsampling it degrades to nearest neighbor. Under §15.1, thumbnails are not golden, so pixel-exact agreement with swscale is not pursued.

use crate::RgbaFrame;

/// Source display size + target width → target height (rounded to an even number, at least 2).
///
/// Matches ffmpeg `scale=<w>:-2`: the width is exactly `target_width`, and the height is derived from the aspect ratio and then snapped to the nearest even number. Even alignment is a historical constraint of 4:2:0 chroma sampling. It is kept here only so that the native path and the ffmpeg fallback produce the same size. When cells from both paths appear mixed in one filmstrip, the sizes must not conflict.
pub fn scaled_height(source_width: u32, source_height: u32, target_width: u32) -> u32 {
    if source_width == 0 || source_height == 0 || target_width == 0 {
        return 2;
    }
    let exact = f64::from(source_height) * f64::from(target_width) / f64::from(source_width);
    let even = (exact / 2.0).round().max(1.0);
    // u32 upper bound: 4K-class material is far below it, and even extreme aspect ratios will not overflow.
    ((even as u32).min(u32::MAX / 2)) * 2
}

/// Box-filter resample to `(width, height)`. If the size already matches, returns a clone directly.
pub fn resize_rgba(frame: &RgbaFrame, width: u32, height: u32) -> RgbaFrame {
    if frame.width == width && frame.height == height {
        return frame.clone();
    }
    let (source_width, source_height) = (frame.width as usize, frame.height as usize);
    let (target_width, target_height) = (width.max(1) as usize, height.max(1) as usize);
    let mut data = vec![0_u8; target_width * target_height * 4];
    for y in 0..target_height {
        // The source row interval [y0, y1) covered by target row y. When upsampling, the interval length is 1 (nearest neighbor).
        let y0 = y * source_height / target_height;
        let y1 = (((y + 1) * source_height).div_ceil(target_height)).max(y0 + 1);
        let y1 = y1.min(source_height);
        for x in 0..target_width {
            let x0 = x * source_width / target_width;
            let x1 = (((x + 1) * source_width).div_ceil(target_width)).max(x0 + 1);
            let x1 = x1.min(source_width);
            let mut sums = [0_u32; 3];
            let mut count = 0_u32;
            for sy in y0..y1 {
                let row = sy * source_width * 4;
                for sx in x0..x1 {
                    let offset = row + sx * 4;
                    sums[0] += u32::from(frame.data[offset]);
                    sums[1] += u32::from(frame.data[offset + 1]);
                    sums[2] += u32::from(frame.data[offset + 2]);
                    count += 1;
                }
            }
            let count = count.max(1);
            let out = (y * target_width + x) * 4;
            data[out] = (sums[0] / count) as u8;
            data[out + 1] = (sums[1] / count) as u8;
            data[out + 2] = (sums[2] / count) as u8;
            data[out + 3] = 255;
        }
    }
    RgbaFrame {
        width: target_width as u32,
        height: target_height as u32,
        data,
    }
}

/// Rotates clockwise by `degrees` (only 0 / 90 / 180 / 270 accepted). 0 degrees returns a clone directly.
///
/// Same rule as `copy_rows` in the Windows single-frame path: `degrees` is the clockwise angle needed to **turn the decoded pixels upright to the display orientation**, equivalent to ffmpeg CLI's autorotate. The macOS sequential frame stream needs it: `AVAssetReaderTrackOutput`, unlike `AVAssetImageGenerator`, has no `appliesPreferredTrackTransform`, so the orientation has to be handled here.
pub fn rotate_rgba(frame: &RgbaFrame, degrees: u16) -> RgbaFrame {
    if degrees % 360 == 0 {
        return frame.clone();
    }
    let (source_width, source_height) = (frame.width as usize, frame.height as usize);
    let (out_width, out_height) = if matches!(degrees % 360, 90 | 270) {
        (source_height, source_width)
    } else {
        (source_width, source_height)
    };
    let mut data = vec![0_u8; out_width * out_height * 4];
    for y in 0..source_height {
        for x in 0..source_width {
            let (tx, ty) = match degrees % 360 {
                90 => (source_height - 1 - y, x),
                180 => (source_width - 1 - x, source_height - 1 - y),
                270 => (y, source_width - 1 - x),
                _ => (x, y),
            };
            let from = (y * source_width + x) * 4;
            let to = (ty * out_width + tx) * 4;
            data[to..to + 4].copy_from_slice(&frame.data[from..from + 4]);
        }
    }
    RgbaFrame {
        width: out_width as u32,
        height: out_height as u32,
        data,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heights_follow_the_source_ratio_and_snap_to_even() {
        // 1920x1080 (16:9) scaled to width 168: 94.5 → 94 (nearest even).
        assert_eq!(scaled_height(1920, 1080, 168), 94);
        assert_eq!(scaled_height(1920, 1080, 320), 180);
        assert_eq!(scaled_height(320, 180, 320), 180);
        // Portrait.
        assert_eq!(scaled_height(1080, 1920, 168), 298);
        // Extreme ratios still get at least 2 pixels of height.
        assert_eq!(scaled_height(4000, 10, 84), 2);
        // Degenerate input does not panic.
        assert_eq!(scaled_height(0, 0, 168), 2);
        assert_eq!(scaled_height(1920, 1080, 0), 2);
    }

    #[test]
    fn resizing_to_the_same_size_is_a_pass_through() {
        let frame = RgbaFrame::new(2, 1, vec![1, 2, 3, 255, 4, 5, 6, 255]).unwrap();
        assert_eq!(resize_rgba(&frame, 2, 1), frame);
    }

    /// 2x2 with four colors reduced to 1x1: the box filter gives the average of the four pixels, and alpha is forced opaque.
    #[test]
    fn downsampling_averages_the_covered_source_box() {
        let frame = RgbaFrame::new(
            2,
            2,
            vec![
                0, 0, 0, 255, // Black
                255, 255, 255, 255, // White
                0, 0, 0, 255, //
                255, 255, 255, 255, //
            ],
        )
        .unwrap();
        let small = resize_rgba(&frame, 1, 1);
        assert_eq!(small.pixel(0, 0), Some([127, 127, 127, 255]));
    }

    /// Clockwise 90 degrees: width and height swap, and the top-left pixel moves to the top-right.
    #[test]
    fn rotating_a_quarter_turn_clockwise_swaps_the_axes() {
        // 2x1: red on the left, blue on the right.
        let frame = RgbaFrame::new(2, 1, vec![255, 0, 0, 255, 0, 0, 255, 255]).unwrap();
        let turned = rotate_rgba(&frame, 90);
        assert_eq!((turned.width, turned.height), (1, 2));
        // Source (0,0) → target (0,0); source (1,0) → target (0,1).
        assert_eq!(turned.pixel(0, 0), Some([255, 0, 0, 255]));
        assert_eq!(turned.pixel(0, 1), Some([0, 0, 255, 255]));
        // Four rotations return to the original image. 0 degrees is the identity.
        let full_circle = rotate_rgba(&rotate_rgba(&rotate_rgba(&turned, 90), 90), 90);
        assert_eq!(full_circle, frame);
        assert_eq!(rotate_rgba(&frame, 0), frame);
    }

    /// Coordinate mapping for 180 and 270.
    #[test]
    fn half_and_three_quarter_turns_map_corners_as_expected() {
        let frame = RgbaFrame::new(2, 1, vec![255, 0, 0, 255, 0, 0, 255, 255]).unwrap();
        let half = rotate_rgba(&frame, 180);
        assert_eq!((half.width, half.height), (2, 1));
        assert_eq!(half.pixel(0, 0), Some([0, 0, 255, 255]));
        let three = rotate_rgba(&frame, 270);
        assert_eq!((three.width, three.height), (1, 2));
        assert_eq!(three.pixel(0, 0), Some([0, 0, 255, 255]));
        assert_eq!(three.pixel(0, 1), Some([255, 0, 0, 255]));
    }

    /// Upsampling: each target pixel falls back to exactly one source pixel (nearest neighbor), so the left and right halves are each a solid color.
    #[test]
    fn upsampling_keeps_solid_regions_solid() {
        let frame = RgbaFrame::new(2, 1, vec![255, 0, 0, 255, 0, 0, 255, 255]).unwrap();
        let big = resize_rgba(&frame, 4, 2);
        assert_eq!(big.width, 4);
        assert_eq!(big.height, 2);
        for y in 0..2 {
            assert_eq!(big.pixel(0, y), Some([255, 0, 0, 255]));
            assert_eq!(big.pixel(1, y), Some([255, 0, 0, 255]));
            assert_eq!(big.pixel(2, y), Some([0, 0, 255, 255]));
            assert_eq!(big.pixel(3, y), Some([0, 0, 255, 255]));
        }
    }
}
