//! Drop shadow / glow (`filter.dropShadow@1`).
//!
//! The structure matches the subtitle glow in `studio_export/render_plan.rs`: **effect layer → bounded blur → premultiplied source-over placed beneath the original image**. Here it is written as a single-input filter: the shadow layer is colored from the input's own alpha. The shadow layer only opens a local window near the content (no longer allocating or copying the whole frame), and the result is byte-identical to the whole-frame `box_blur_bounded` + `composite_premultiplied_rgba`, checked by unit tests.

use super::blur::{ContentBox, MAX_BLUR_RADIUS, alpha_bbox, box_blur_premul_u8};
use super::composite_premul::composite_premultiplied_row;

/// `color` is non-premultiplied RGBA 0..1; `dx`/`dy` are integer pixel offsets.
///
/// Works only in a local window: the window is the union of the offset content box expanded by 2×radius (clamped to the canvas) and the original content box. It is byte-identical to the whole-frame shadow layer for the same reason as `box_blur_bounded`: pixels in the window that are more than radius away from the non-canvas boundary read only zeros in their blur window, so both algorithms give 0, and the windows of the other pixels do not extend beyond the local window. The write-back range (blur box ∪ content box) also falls within the window. Unit tests compare against the whole-frame implementation.
pub fn drop_shadow(
    data: &mut [u8],
    width: u32,
    height: u32,
    radius: usize,
    dx: i32,
    dy: i32,
    color: [f64; 4],
) {
    let width_usize = width as usize;
    let height_usize = height as usize;
    if data.len() != width_usize * height_usize * 4 {
        return;
    }
    let Some(content) = alpha_bbox(data, width_usize, height_usize) else {
        return; // Fully transparent: there is no content to cast a shadow
    };
    let shifted = ContentBox {
        rows: (content.rows.start as i64 + i64::from(dy)).clamp(0, height_usize as i64) as usize
            ..(content.rows.end as i64 + i64::from(dy)).clamp(0, height_usize as i64) as usize,
        cols: (content.cols.start as i64 + i64::from(dx)).clamp(0, width_usize as i64) as usize
            ..(content.cols.end as i64 + i64::from(dx)).clamp(0, width_usize as i64) as usize,
    };
    if shifted.rows.is_empty() || shifted.cols.is_empty() {
        return;
    }
    let radius = radius.min(MAX_BLUR_RADIUS);
    let margin = radius * 2;
    let window = ContentBox {
        rows: shifted
            .rows
            .start
            .saturating_sub(margin)
            .min(content.rows.start)
            ..(shifted.rows.end + margin)
                .min(height_usize)
                .max(content.rows.end),
        cols: shifted
            .cols
            .start
            .saturating_sub(margin)
            .min(content.cols.start)
            ..(shifted.cols.end + margin)
                .min(width_usize)
                .max(content.cols.end),
    };
    let window_width = window.cols.len();
    let window_height = window.rows.len();
    let local =
        |x: usize, y: usize| ((y - window.rows.start) * window_width + x - window.cols.start) * 4;

    // Shadow layer: colors the input's alpha with `color` and shifts it as a whole. The coloring depends only on the alpha byte, so it is first looked up in a 256-entry table (the same expression as per-pixel computation).
    let (cr, cg, cb, ca) = (
        color[0].clamp(0.0, 1.0),
        color[1].clamp(0.0, 1.0),
        color[2].clamp(0.0, 1.0),
        color[3].clamp(0.0, 1.0),
    );
    let mut tint = [[0_u8; 4]; 256];
    for (byte, entry) in tint.iter_mut().enumerate() {
        let alpha = byte as f64 / 255.0 * ca;
        *entry = [
            (cr * alpha * 255.0).round() as u8,
            (cg * alpha * 255.0).round() as u8,
            (cb * alpha * 255.0).round() as u8,
            (alpha * 255.0).round() as u8,
        ];
    }
    let mut shadow = vec![0_u8; window_width * window_height * 4];
    for y in content.rows.clone() {
        let target_y = y as i64 + i64::from(dy);
        if target_y < 0 || target_y >= height_usize as i64 {
            continue;
        }
        for x in content.cols.clone() {
            let source_alpha = data[(y * width_usize + x) * 4 + 3];
            if source_alpha == 0 {
                continue;
            }
            let target_x = x as i64 + i64::from(dx);
            if target_x < 0 || target_x >= width_usize as i64 {
                continue;
            }
            let offset = local(target_x as usize, target_y as usize);
            shadow[offset..offset + 4].copy_from_slice(&tint[usize::from(source_alpha)]);
        }
    }

    let blurred = if radius == 0 {
        shifted
    } else {
        box_blur_premul_u8(
            &mut shadow,
            window_width as u32,
            window_height as u32,
            radius,
        );
        ContentBox {
            rows: shifted.rows.start.saturating_sub(radius)
                ..(shifted.rows.end + radius).min(height_usize),
            cols: shifted.cols.start.saturating_sub(radius)
                ..(shifted.cols.end + radius).min(width_usize),
        }
    };

    // Shadow beneath, original image on top: first composite the original onto the shadow layer, then copy the union back.
    for y in content.rows.clone() {
        let start = local(content.cols.start, y);
        let end = local(content.cols.end, y);
        composite_premultiplied_row(
            &mut shadow[start..end],
            &data[(y * width_usize + content.cols.start) * 4
                ..(y * width_usize + content.cols.end) * 4],
        );
    }
    let union = ContentBox {
        rows: blurred.rows.start.min(content.rows.start)..blurred.rows.end.max(content.rows.end),
        cols: blurred.cols.start.min(content.cols.start)..blurred.cols.end.max(content.cols.end),
    };
    for y in union.rows.clone() {
        let start = (y * width_usize + union.cols.start) * 4;
        let end = (y * width_usize + union.cols.end) * 4;
        data[start..end]
            .copy_from_slice(&shadow[local(union.cols.start, y)..local(union.cols.end, y)]);
    }
}

#[cfg(test)]
mod tests {
    use super::super::blur::box_blur_bounded;
    use super::super::composite_premul::composite_premultiplied_rgba;
    use super::*;

    /// The whole-frame implementation from before windowing, kept as a control.
    fn reference_drop_shadow(
        data: &mut [u8],
        width: u32,
        height: u32,
        radius: usize,
        dx: i32,
        dy: i32,
        color: [f64; 4],
    ) {
        let width_usize = width as usize;
        let height_usize = height as usize;
        let Some(content) = alpha_bbox(data, width_usize, height_usize) else {
            return;
        };
        let mut shadow = vec![0_u8; data.len()];
        let (cr, cg, cb, ca) = (
            color[0].clamp(0.0, 1.0),
            color[1].clamp(0.0, 1.0),
            color[2].clamp(0.0, 1.0),
            color[3].clamp(0.0, 1.0),
        );
        for y in content.rows.clone() {
            for x in content.cols.clone() {
                let source_alpha = f64::from(data[(y * width_usize + x) * 4 + 3]) / 255.0;
                if source_alpha <= 0.0 {
                    continue;
                }
                let target_x = x as i64 + i64::from(dx);
                let target_y = y as i64 + i64::from(dy);
                if target_x < 0
                    || target_y < 0
                    || target_x >= width_usize as i64
                    || target_y >= height_usize as i64
                {
                    continue;
                }
                let alpha = source_alpha * ca;
                let offset = (target_y as usize * width_usize + target_x as usize) * 4;
                shadow[offset] = (cr * alpha * 255.0).round() as u8;
                shadow[offset + 1] = (cg * alpha * 255.0).round() as u8;
                shadow[offset + 2] = (cb * alpha * 255.0).round() as u8;
                shadow[offset + 3] = (alpha * 255.0).round() as u8;
            }
        }
        let shifted = ContentBox {
            rows: (content.rows.start as i64 + i64::from(dy)).clamp(0, height_usize as i64) as usize
                ..(content.rows.end as i64 + i64::from(dy)).clamp(0, height_usize as i64) as usize,
            cols: (content.cols.start as i64 + i64::from(dx)).clamp(0, width_usize as i64) as usize
                ..(content.cols.end as i64 + i64::from(dx)).clamp(0, width_usize as i64) as usize,
        };
        if shifted.rows.is_empty() || shifted.cols.is_empty() {
            return;
        }
        let blurred = box_blur_bounded(&mut shadow, width, height, radius, &shifted);
        let original = data.to_vec();
        composite_premultiplied_rgba(&mut shadow, &original, width_usize, &content);
        let union = ContentBox {
            rows: blurred.rows.start.min(content.rows.start)
                ..blurred.rows.end.max(content.rows.end),
            cols: blurred.cols.start.min(content.cols.start)
                ..blurred.cols.end.max(content.cols.end),
        };
        for y in union.rows.clone() {
            let start = (y * width_usize + union.cols.start) * 4;
            let end = (y * width_usize + union.cols.end) * 4;
            data[start..end].copy_from_slice(&shadow[start..end]);
        }
    }

    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u32 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            (self.0 >> 32) as u32
        }
        fn below(&mut self, n: u32) -> u32 {
            self.next() % n
        }
    }

    #[test]
    fn windowed_drop_shadow_matches_full_frame() {
        let mut rng = Rng(0x0dd_b1a5_e5bad_5eed);
        let (width, height) = (71_u32, 47_u32);
        for round in 0..400 {
            let mut data = vec![0_u8; (width * height * 4) as usize];
            // Inside random rectangles, scatter valid premultiplied pixels; sometimes touching the edge, sometimes just one pixel.
            let x0 = rng.below(width);
            let y0 = rng.below(height);
            let (w, h) = match round % 4 {
                0 => (1, 1),
                _ => (1 + rng.below(width - x0), 1 + rng.below(height - y0)),
            };
            for y in y0..y0 + h {
                for x in x0..x0 + w {
                    if rng.below(10) < 3 && round % 4 != 0 {
                        continue;
                    }
                    let offset = ((y * width + x) * 4) as usize;
                    let alpha = rng.below(256);
                    for channel in 0..3 {
                        data[offset + channel] = rng.below(alpha + 1) as u8;
                    }
                    data[offset + 3] = alpha as u8;
                }
            }
            let radius = [0, 1, 2, 5, 13, 40, 300][rng.below(7) as usize];
            let dx = rng.below(61) as i32 - 30;
            let dy = if round % 9 == 0 {
                height as i32 + 3 // The whole shadow falls outside the canvas
            } else {
                rng.below(41) as i32 - 20
            };
            let color = [
                rng.below(1001) as f64 / 1000.0,
                rng.below(1001) as f64 / 1000.0,
                rng.below(1001) as f64 / 1000.0,
                rng.below(1201) as f64 / 1000.0,
            ];
            let mut expected = data.clone();
            reference_drop_shadow(&mut expected, width, height, radius, dx, dy, color);
            drop_shadow(&mut data, width, height, radius, dx, dy, color);
            assert!(
                data == expected,
                "round {round}: r={radius} dx={dx} dy={dy} box=({x0},{y0},{w},{h})"
            );
        }
    }
}
