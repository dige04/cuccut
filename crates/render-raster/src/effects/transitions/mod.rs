//! Strict CPU reference implementation of the Surface Transitions (spec §9, design §6.4).
//!
//! The four v1 recipes share one **endpoint discipline**. `progress` is the closed interval `[0, 1]`. The output at `progress = 0` must be byte-for-byte equal to `from`, and at `= 1` it must be byte-for-byte equal to `to` (the conformance requirement of spec §9). This discipline shapes the implementation:
//!
//! * A pixel whose coverage is 0 or 1 **copies the original bytes directly** and does not go through the blend formula.
//! * The blend formula itself is an integer formula ([`lerp_premul_u8`]). `a = 0` and `a = 255` are each an identity too, so the copy path and the blend path do not conflict at the endpoints.
//! * The sweep range gets one extra pixel (`span + softness + 1`). Without it, a hard edge would miss the last column or the farthest corner at `progress = 1`.
//!
//! The color contract matches the stage-4 filters: premultiplied sRGB / u8, as declared by the manifest.

pub mod circle_crop;
pub mod crossfade;
pub mod glitch;
pub mod ink_blot;
pub mod shatter;
pub mod slide;
pub mod wipe;

/// Axis direction. The parsed result of the `direction` parameter for `slide` and `wipe`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

impl Direction {
    pub fn parse(text: &str) -> Option<Direction> {
        match text {
            "left" => Some(Direction::Left),
            "right" => Some(Direction::Right),
            "up" => Some(Direction::Up),
            "down" => Some(Direction::Down),
            _ => None,
        }
    }

    pub fn is_horizontal(self) -> bool {
        matches!(self, Direction::Left | Direction::Right)
    }
}

/// Integer interpolation of premultiplied u8: `a = 0` gives `from`, and `a = 255` gives `to`.
///
/// The truncating division in `(f×(255−a) + t×a + 127) / 255` is exact at both ends. `a = 0` ⇒ `(f×255 + 127)/255 = f` (remainder 127 < 255). `a = 255` ⇒ `t`. Using floating point `f + (t − f)×p` followed by `round()` is also right at the endpoints, but the intermediate values carry binary rounding tails. The strict level needs arithmetic that can be reproduced byte for byte.
#[inline]
pub fn lerp_premul_u8(from: u8, to: u8, a: u32) -> u8 {
    ((u32::from(from) * (255 - a) + u32::from(to) * a + 127) / 255) as u8
}

/// Coverage to blend weight. `cov ≤ 0` and `≥ 1` are handled by the caller's copy branch. This function handles only the middle range.
#[inline]
pub fn coverage_to_alpha(coverage: f64) -> u32 {
    (coverage.clamp(0.0, 1.0) * 255.0).round() as u32
}

/// Composites `from` and `to` into `out` according to the per-pixel coverage.
///
/// A coverage of 0 copies the four bytes of `from` as they are. A coverage of 1 copies those of `to`. This shortcut guarantees the byte equality at the endpoints. The blend formula does not get it right by coincidence.
pub fn composite_by_coverage(
    from: &[u8],
    to: &[u8],
    out: &mut [u8],
    width: u32,
    height: u32,
    mut coverage: impl FnMut(u32, u32) -> f64,
) {
    for y in 0..height {
        for x in 0..width {
            let offset = ((y * width + x) * 4) as usize;
            let cov = coverage(x, y);
            if cov <= 0.0 {
                out[offset..offset + 4].copy_from_slice(&from[offset..offset + 4]);
            } else if cov >= 1.0 {
                out[offset..offset + 4].copy_from_slice(&to[offset..offset + 4]);
            } else {
                let a = coverage_to_alpha(cov);
                for channel in 0..4 {
                    out[offset + channel] =
                        lerp_premul_u8(from[offset + channel], to[offset + channel], a);
                }
            }
        }
    }
}

/// Sweep position: `progress × (span + softness + 1)`.
///
/// The `+ 1` is part of the endpoint discipline (see the module header).
#[inline]
pub fn sweep_edge(progress: f64, span: f64, softness: f64) -> f64 {
    progress.clamp(0.0, 1.0) * (span + softness + 1.0)
}

/// Sweep coverage: `softness = 0` is a hard edge. Otherwise it is a linear transition band with width `softness`.
#[inline]
pub fn sweep_coverage(edge: f64, u: f64, softness: f64) -> f64 {
    if softness <= 0.0 {
        if u < edge { 1.0 } else { 0.0 }
    } else {
        ((edge - u) / softness).clamp(0.0, 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_integer_lerp_is_exact_at_both_ends() {
        for value in [0u8, 1, 7, 128, 254, 255] {
            for other in [0u8, 3, 99, 255] {
                assert_eq!(lerp_premul_u8(value, other, 0), value);
                assert_eq!(lerp_premul_u8(other, value, 255), value);
            }
        }
    }

    #[test]
    fn the_sweep_covers_the_whole_axis_at_progress_one() {
        for softness in [0.0, 0.5, 4.0] {
            let edge = sweep_edge(1.0, 48.0, softness);
            // The last column has u = span − 1. It must be fully covered.
            assert_eq!(sweep_coverage(edge, 47.0, softness), 1.0);
            let start = sweep_edge(0.0, 48.0, softness);
            assert_eq!(sweep_coverage(start, 0.0, softness), 0.0);
        }
    }
}
