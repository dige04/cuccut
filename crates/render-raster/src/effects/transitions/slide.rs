//! `transition.slide@1`: the two pictures are pushed together in `direction` by a full screen.
//!
//! Each output pixel is a **whole-pixel copy** (no blending, no resampling). The transition therefore introduces no new colors at any progress, and the endpoints equal the input byte for byte.

use super::Direction;

pub fn slide(
    from: &[u8],
    to: &[u8],
    out: &mut [u8],
    width: u32,
    height: u32,
    direction: Direction,
    progress: f64,
) {
    let progress = progress.clamp(0.0, 1.0);
    let span = if direction.is_horizontal() {
        f64::from(width)
    } else {
        f64::from(height)
    };
    // The offset is rounded to integers. Whole-pixel copies require this.
    let shift = (progress * span).round() as i64;
    let (w, h) = (width as i64, height as i64);

    for y in 0..h {
        for x in 0..w {
            // `u` is the coordinate along the push direction. `span_i` is the length of that axis.
            let (u, span_i) = match direction {
                Direction::Left => (x, w),
                Direction::Right => (w - 1 - x, w),
                Direction::Up => (y, h),
                Direction::Down => (h - 1 - y, h),
            };
            let out_offset = ((y * w + x) * 4) as usize;
            // The first `span − shift` columns are still the outgoing picture (moved forward by `shift`). The rest is the incoming picture.
            let (source, source_u) = if u < span_i - shift {
                (from, u + shift)
            } else {
                (to, u - (span_i - shift))
            };
            let (sx, sy) = match direction {
                Direction::Left => (source_u, y),
                Direction::Right => (w - 1 - source_u, y),
                Direction::Up => (x, source_u),
                Direction::Down => (x, h - 1 - source_u),
            };
            let source_offset = ((sy * w + sx) * 4) as usize;
            out[out_offset..out_offset + 4]
                .copy_from_slice(&source[source_offset..source_offset + 4]);
        }
    }
}
