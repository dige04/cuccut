//! CPU reference implementation of box blur.
//!
//! Originally moved line by line from `core/crates/ccut-kernel/src/cmd/studio_export/raster.rs` (`box_blur_rgba`, `box_blur_rgba_bounded`, `box_blur_rgba_content`) and `render_plan.rs` (`alpha_bbox`). Bit-exactness is a hard requirement: the export pixel fixtures of `studio_export` pin it.
//! Later, for preview speed, the traversal order (one vertical pass changed to row-major), the division (fixed-point reciprocal) and the bounding-box scan (only the left and right margins are scanned) were changed, so it is no longer a line-by-line move. Byte-for-byte identity is guaranteed by this file's unit tests, which compare against the original implementation (the reciprocal division is checked exhaustively over all values).
//!
//! Key semantic points (they go into the `filter.blur@1` manifest): a single-pass separable box, u8 integer **truncating** division (not rounding), operating on **premultiplied sRGB**, with edges shrinking the window (smaller divisor) rather than zero-padding.

use std::ops::Range;

/// Structural upper bound on blur radius. The sliding window is O(1) per pixel, so the radius itself adds no computation. This bound only stops pathological values in hand-written JSON from pushing the local copy margin (`radius * 2`) beyond the whole frame. 4K plus the panel's maximum glow (0.9·fontSize) is also well within it.
pub const MAX_BLUR_RADIUS: usize = 256;

/// Row/column bounding box of nonzero content (half-open intervals).
#[derive(Debug, Clone, PartialEq)]
pub struct ContentBox {
    pub rows: Range<usize>,
    pub cols: Range<usize>,
}

/// Row/column bounding box of nonzero alpha (half-open intervals). The buffer is premultiplied RGBA, so any nonzero channel implies nonzero alpha, and a byte-level nonzero check is enough. Returns `None` if the whole frame is transparent.
pub fn alpha_bbox(rgba: &[u8], width: usize, height: usize) -> Option<ContentBox> {
    alpha_bbox_within(
        rgba,
        width,
        height,
        &ContentBox {
            rows: 0..height,
            cols: 0..width,
        },
    )
}

/// The **restricted-window** form of [`alpha_bbox`]: scans only the rows and columns covered by `window`.
///
/// Callers often already know where content is drawn (the subtitle layout geometry, an element's affine box), and a full-frame scan is pure waste: a 1080p transparent overlay would read the full 8.3 MB on every scan. The contract is that **`window` must be a superset of the nonzero pixels**. When that holds, the return value is field-for-field identical to [`alpha_bbox`] (the window only narrows the search range and does not change the answer). When it does not hold, the result is clipped by the window, so the window may only be derived from a geometric upper bound on what was drawn, never guessed.
pub fn alpha_bbox_within(
    rgba: &[u8],
    width: usize,
    height: usize,
    window: &ContentBox,
) -> Option<ContentBox> {
    let row_bytes = width * 4;
    let row_start = window.rows.start;
    let row_end = window.rows.end.min(height);
    let col_start = window.cols.start;
    let col_end = window.cols.end.min(width);
    if row_start >= row_end || col_start >= col_end {
        return None;
    }
    let row = |y: usize| &rgba[y * row_bytes + col_start * 4..y * row_bytes + col_end * 4];
    // First find the nonzero rows from both ends, then scan only the part of each row **outside** the current left and right bounds. The box can only grow, so the middle segment need not be re-examined. The result is the same as scanning every row in full and taking min/max.
    let min_row = (row_start..row_end).find(|&y| !bytes_are_zero(row(y)))?;
    let max_row = (min_row..row_end)
        .rev()
        .find(|&y| !bytes_are_zero(row(y)))
        .unwrap_or(min_row);
    let span = col_end - col_start;
    let mut first = span; // Leftmost nonzero pixel, relative to col_start
    let mut last: Option<usize> = None; // Rightmost nonzero pixel, relative to col_start
    for y in min_row..=max_row {
        let pixels = row(y);
        if let Some(x) = pixels[..first * 4]
            .chunks_exact(4)
            .position(|pixel| pixel != [0, 0, 0, 0])
        {
            first = x;
        }
        let from = last.map_or(0, |x| x + 1);
        if let Some(x) = pixels[from * 4..]
            .chunks_exact(4)
            .rposition(|pixel| pixel != [0, 0, 0, 0])
        {
            last = Some(from + x);
        }
        if first == 0 && last == Some(span - 1) {
            break;
        }
    }
    let last = last?;
    Some(ContentBox {
        rows: min_row..max_row + 1,
        cols: col_start + first..col_start + last + 1,
    })
}

/// Whether a whole byte slice is all zeros. Checks in 64-byte blocks with a bitwise OR and then tests for zero, which has fewer branches than a per-byte `all`.
fn bytes_are_zero(bytes: &[u8]) -> bool {
    bytes
        .chunks(64)
        .all(|block| block.iter().fold(0_u8, |acc, &byte| acc | byte) == 0)
}

/// Fixed-point reciprocal for `n / d`: for `d ≤ 2·MAX_BLUR_RADIUS + 1` and `n ≤ 255·d` (the upper bound on the sum of `d` u8 values in a box window), `(n · reciprocal(d)) >> 32` equals integer truncating division value for value (the error term `n / 2³² < 1 / d`; unit tests exhaustively cover all (n, d)).
fn reciprocal(divisor: u32) -> u64 {
    (1_u64 << 32) / u64::from(divisor) + 1
}

fn divide(sum: u32, reciprocal: u64) -> u8 {
    ((u64::from(sum) * reciprocal) >> 32) as u8
}

/// Single-pass separable box blur over a whole premultiplied RGBA frame.
///
/// Both passes walk memory in row-major order. The horizontal pass shares one window across four channels, and the vertical pass maintains `width × 4` sliding sums over a whole row. The summation order, the add and subtract terms, and the divisor for each (pixel, channel) are the same as in the per-column implementation; only the traversal order changed, and the division is replaced by a value-for-value identical fixed-point reciprocal. The output is therefore byte-identical (unit tests compare against the per-column reference implementation).
pub fn box_blur_premul_u8(data: &mut [u8], width: u32, height: u32, radius: usize) {
    let width = width as usize;
    let height = height as usize;
    let radius = radius.min(MAX_BLUR_RADIUS);
    if radius == 0 || width == 0 || height == 0 {
        return;
    }
    let row_bytes = width * 4;
    // Window sizes are only 1..=2·radius+1, so the reciprocals are precomputed as a table.
    let reciprocals: Vec<u64> = (0..=2 * radius as u32 + 1)
        .map(|count| if count == 0 { 0 } else { reciprocal(count) })
        .collect();
    let mut horizontal = vec![0_u8; data.len()];
    for (source, target) in data
        .chunks_exact(row_bytes)
        .zip(horizontal.chunks_exact_mut(row_bytes))
    {
        let mut sum = [0_u32; 4];
        for pixel in source[..(radius.min(width - 1) + 1) * 4].chunks_exact(4) {
            for channel in 0..4 {
                sum[channel] += u32::from(pixel[channel]);
            }
        }
        for x in 0..width {
            let left = x.saturating_sub(radius);
            let right = (x + radius).min(width - 1);
            let reciprocal = reciprocals[right - left + 1];
            for channel in 0..4 {
                target[x * 4 + channel] = divide(sum[channel], reciprocal);
            }
            if x >= radius {
                let leaving = &source[(x - radius) * 4..(x - radius) * 4 + 4];
                for channel in 0..4 {
                    sum[channel] -= u32::from(leaving[channel]);
                }
            }
            if x + radius + 1 < width {
                let entering = &source[(x + radius + 1) * 4..(x + radius + 2) * 4];
                for channel in 0..4 {
                    sum[channel] += u32::from(entering[channel]);
                }
            }
        }
    }
    let mut sums = vec![0_u32; row_bytes];
    for row in horizontal
        .chunks_exact(row_bytes)
        .take(radius.min(height - 1) + 1)
    {
        for (sum, &value) in sums.iter_mut().zip(row) {
            *sum += u32::from(value);
        }
    }
    for y in 0..height {
        let top = y.saturating_sub(radius);
        let bottom = (y + radius).min(height - 1);
        let reciprocal = reciprocals[bottom - top + 1];
        for (target, &sum) in data[y * row_bytes..(y + 1) * row_bytes]
            .iter_mut()
            .zip(&sums)
        {
            *target = divide(sum, reciprocal);
        }
        if y >= radius {
            let leaving = &horizontal[(y - radius) * row_bytes..(y - radius + 1) * row_bytes];
            for (sum, &value) in sums.iter_mut().zip(leaving) {
                *sum -= u32::from(value);
            }
        }
        if y + radius + 1 < height {
            let entering = &horizontal[(y + radius + 1) * row_bytes..(y + radius + 2) * row_bytes];
            for (sum, &value) in sums.iter_mut().zip(entering) {
                *sum += u32::from(value);
            }
        }
    }
}

/// Box blur only within the neighborhood of the nonzero content bounding box. The output is byte-identical to a whole-frame blur: a single blur spreads content outward by at most `radius`, so with the bounding box expanded by 2×radius, edge pixels of the sub-region have windows that read only zeros (both algorithms give 0). Pixels inside the sub-region have windows that do not go out of bounds, with the same divisor semantics as the whole frame. When the sub-region boundary coincides with the canvas boundary, window shrinking is also consistent.
///
/// Returns the nonzero bounding box after blurring.
pub fn box_blur_bounded(
    data: &mut [u8],
    width: u32,
    height: u32,
    radius: usize,
    content: &ContentBox,
) -> ContentBox {
    let radius = radius.min(MAX_BLUR_RADIUS);
    let width_usize = width as usize;
    let height_usize = height as usize;
    if radius == 0 {
        return content.clone();
    }
    let (rows, cols) = (content.rows.clone(), content.cols.clone());
    let blurred = ContentBox {
        rows: rows.start.saturating_sub(radius)..(rows.end + radius).min(height_usize),
        cols: cols.start.saturating_sub(radius)..(cols.end + radius).min(width_usize),
    };
    let margin = radius * 2;
    let x0 = cols.start.saturating_sub(margin);
    let x1 = (cols.end + margin).min(width_usize);
    let y0 = rows.start.saturating_sub(margin);
    let y1 = (rows.end + margin).min(height_usize);
    // When content covers more than half the frame, a local copy is no longer worthwhile, so the whole frame is done directly.
    if (x1 - x0) * (y1 - y0) * 2 >= width_usize * height_usize {
        box_blur_premul_u8(data, width, height, radius);
        return blurred;
    }
    let sub_width = x1 - x0;
    let sub_height = y1 - y0;
    let mut scratch = vec![0_u8; sub_width * sub_height * 4];
    for (sub_y, y) in (y0..y1).enumerate() {
        scratch[sub_y * sub_width * 4..(sub_y + 1) * sub_width * 4]
            .copy_from_slice(&data[(y * width_usize + x0) * 4..(y * width_usize + x1) * 4]);
    }
    box_blur_premul_u8(&mut scratch, sub_width as u32, sub_height as u32, radius);
    for (sub_y, y) in (y0..y1).enumerate() {
        data[(y * width_usize + x0) * 4..(y * width_usize + x1) * 4]
            .copy_from_slice(&scratch[sub_y * sub_width * 4..(sub_y + 1) * sub_width * 4]);
    }
    blurred
}

/// Auto-scanning version of [`box_blur_bounded`] (`None` = whole frame transparent).
pub fn box_blur_content(
    data: &mut [u8],
    width: u32,
    height: u32,
    radius: usize,
) -> Option<ContentBox> {
    let content = alpha_bbox(data, width as usize, height as usize)?;
    Some(box_blur_bounded(data, width, height, radius, &content))
}

/// Clears the pixels covered by `bounds` to zero. Source-over drawn onto an all-zero buffer only produces nonzero bytes where it is drawn, so clearing the "nonzero bounding box" returns the buffer to all zeros.
pub fn clear_content_box(data: &mut [u8], width: usize, bounds: &ContentBox) {
    for y in bounds.rows.clone() {
        let start = (y * width + bounds.cols.start) * 4;
        let end = (y * width + bounds.cols.end) * 4;
        data[start..end].fill(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The per-column implementation from before the row-major rewrite (moved from `studio_export/raster.rs`), kept as a control.
    fn reference_box_blur(data: &mut [u8], width: u32, height: u32, radius: usize) {
        let width = width as usize;
        let height = height as usize;
        let radius = radius.min(MAX_BLUR_RADIUS);
        if radius == 0 || width == 0 || height == 0 {
            return;
        }
        let source = data.to_vec();
        let mut horizontal = vec![0_u8; data.len()];
        for y in 0..height {
            for channel in 0..4 {
                let mut sum = 0_u32;
                for x in 0..=radius.min(width - 1) {
                    sum += u32::from(source[(y * width + x) * 4 + channel]);
                }
                for x in 0..width {
                    let left = x.saturating_sub(radius);
                    let right = (x + radius).min(width - 1);
                    horizontal[(y * width + x) * 4 + channel] =
                        (sum / (right - left + 1) as u32) as u8;
                    if x >= radius {
                        sum -= u32::from(source[(y * width + x - radius) * 4 + channel]);
                    }
                    if x + radius + 1 < width {
                        sum += u32::from(source[(y * width + x + radius + 1) * 4 + channel]);
                    }
                }
            }
        }
        for x in 0..width {
            for channel in 0..4 {
                let mut sum = 0_u32;
                for y in 0..=radius.min(height - 1) {
                    sum += u32::from(horizontal[(y * width + x) * 4 + channel]);
                }
                for y in 0..height {
                    let top = y.saturating_sub(radius);
                    let bottom = (y + radius).min(height - 1);
                    data[(y * width + x) * 4 + channel] = (sum / (bottom - top + 1) as u32) as u8;
                    if y >= radius {
                        sum -= u32::from(horizontal[((y - radius) * width + x) * 4 + channel]);
                    }
                    if y + radius + 1 < height {
                        sum += u32::from(horizontal[((y + radius + 1) * width + x) * 4 + channel]);
                    }
                }
            }
        }
    }

    pub(crate) struct Rng(pub(crate) u64);
    impl Rng {
        pub(crate) fn next(&mut self) -> u32 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            (self.0 >> 32) as u32
        }
    }

    #[test]
    fn reciprocal_division_is_exact_for_every_box_sum() {
        for divisor in 1..=2 * MAX_BLUR_RADIUS as u32 + 1 {
            let reciprocal = reciprocal(divisor);
            for sum in 0..=255 * divisor {
                assert_eq!(
                    u32::from(divide(sum, reciprocal)),
                    sum / divisor,
                    "{sum} / {divisor}"
                );
            }
        }
    }

    /// The full-row bounding-box scan implementation from before the rewrite, kept as a control.
    fn reference_alpha_bbox_within(
        rgba: &[u8],
        width: usize,
        height: usize,
        window: &ContentBox,
    ) -> Option<ContentBox> {
        let row_bytes = width * 4;
        let row_start = window.rows.start;
        let row_end = window.rows.end.min(height);
        let col_start = window.cols.start;
        let col_end = window.cols.end.min(width);
        if row_start >= row_end || col_start >= col_end {
            return None;
        }
        let span = col_end - col_start;
        let mut min_row = None;
        let mut max_row = 0_usize;
        let mut min_col = col_end;
        let mut max_col = col_start;
        for y in row_start..row_end {
            let row = &rgba[y * row_bytes + col_start * 4..y * row_bytes + col_end * 4];
            if row.iter().all(|&byte| byte == 0) {
                continue;
            }
            if min_row.is_none() {
                min_row = Some(y);
            }
            max_row = y;
            let first = row
                .chunks_exact(4)
                .position(|pixel| pixel.iter().any(|&byte| byte != 0))
                .unwrap_or(0);
            let last = span
                - row
                    .rchunks_exact(4)
                    .position(|pixel| pixel.iter().any(|&byte| byte != 0))
                    .unwrap_or(span - 1)
                - 1;
            min_col = min_col.min(col_start + first);
            max_col = max_col.max(col_start + last);
        }
        let min_row = min_row?;
        Some(ContentBox {
            rows: min_row..max_row + 1,
            cols: min_col..max_col + 1,
        })
    }

    #[test]
    fn bbox_scan_matches_full_row_reference() {
        let mut rng = Rng(0x5851_f42d_4c95_7f2d);
        let (width, height) = (83_usize, 29_usize);
        for round in 0..600 {
            let mut data = vec![0_u8; width * height * 4];
            let points = [0, 1, 2, 5, 40][round % 5];
            for _ in 0..points {
                let x = rng.next() as usize % width;
                let y = rng.next() as usize % height;
                let channel = rng.next() as usize % 4;
                data[(y * width + x) * 4 + channel] = 1 + (rng.next() % 255) as u8;
            }
            let window = if round % 3 == 0 {
                ContentBox {
                    rows: 0..height,
                    cols: 0..width,
                }
            } else {
                // The window may extend beyond the canvas (the implementation clamps it), and it may also be empty.
                let r0 = rng.next() as usize % (height + 2);
                let c0 = rng.next() as usize % (width + 2);
                ContentBox {
                    rows: r0..r0 + rng.next() as usize % (height + 4),
                    cols: c0..c0 + rng.next() as usize % (width + 4),
                }
            };
            assert_eq!(
                alpha_bbox_within(&data, width, height, &window),
                reference_alpha_bbox_within(&data, width, height, &window),
                "round {round}"
            );
        }
    }

    #[test]
    fn row_major_blur_matches_column_reference() {
        let mut rng = Rng(0x2545_f491_4f6c_dd1d);
        let sizes = [(1, 1), (1, 9), (9, 1), (5, 3), (37, 23), (64, 48)];
        let radii = [1, 2, 3, 7, 20, 300];
        for &(width, height) in &sizes {
            for &radius in &radii {
                let mut data: Vec<u8> = (0..width * height * 4)
                    .map(|_| (rng.next() % 256) as u8)
                    .collect();
                // Half of the cases leave large zero regions, close to realistic sparse inputs.
                if rng.next() % 2 == 0 {
                    for (index, byte) in data.iter_mut().enumerate() {
                        if (index / 4) % 5 != 0 {
                            *byte = 0;
                        }
                    }
                }
                let mut expected = data.clone();
                reference_box_blur(&mut expected, width, height, radius);
                box_blur_premul_u8(&mut data, width, height, radius);
                assert_eq!(data, expected, "{width}x{height} r={radius}");
            }
        }
    }
}
