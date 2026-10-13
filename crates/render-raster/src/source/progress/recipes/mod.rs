//! Drawing recipes for progress (the closed set of algorithm names in design §7.4; one algorithm name per module).
//!
//! P3 delivers three (covering 6 styles). P4 delivers `snake-v1` (covering 2). The four rainbow and strobe styles are P5: they reuse the skeleton of `frame-v1` / `snake-v1` and only swap `colorMode`.

pub(crate) mod bar_v1;
pub(crate) mod frame_v1;
pub(crate) mod ring_v1;
pub(crate) mod snake_v1;

use crate::drawop::PathSeg;
use crate::source::kernel::DrawBox;

/// A rounded rectangle with the same radius at all four corners (clockwise, starting where the top-left corner arc ends).
///
/// Same shape as `rounded_rect_path` in `apps/cli`'s `element_draw`. That one supports independent radii per corner and serves `ShapeProps.cornerRadius`, while this function serves only the `bar-v1` capsule mask. Design §9.1 plans to move `element_draw` down into this crate as a whole, and at that point the two will merge.
pub(crate) fn rounded_rect(bbox: DrawBox, radius: f64) -> Vec<PathSeg> {
    const KAPPA: f64 = 0.552_284_749_830_793_6;
    let DrawBox { x, y, w, h } = bbox;
    let r = radius.clamp(0.0, (w.min(h) / 2.0).max(0.0));
    let k = KAPPA * r;
    let seg = |verb: u8, pts: [f64; 6]| PathSeg {
        verb,
        pts: [
            pts[0] as f32,
            pts[1] as f32,
            pts[2] as f32,
            pts[3] as f32,
            pts[4] as f32,
            pts[5] as f32,
        ],
    };
    let line = |x: f64, y: f64| seg(1, [x, y, 0.0, 0.0, 0.0, 0.0]);
    let cubic = |c1: (f64, f64), c2: (f64, f64), to: (f64, f64)| {
        seg(3, [c1.0, c1.1, c2.0, c2.1, to.0, to.1])
    };
    let mut out = vec![seg(0, [x + r, y, 0.0, 0.0, 0.0, 0.0])];
    out.push(line(x + w - r, y));
    if r > 0.0 {
        out.push(cubic(
            (x + w - r + k, y),
            (x + w, y + r - k),
            (x + w, y + r),
        ));
    }
    out.push(line(x + w, y + h - r));
    if r > 0.0 {
        out.push(cubic(
            (x + w, y + h - r + k),
            (x + w - r + k, y + h),
            (x + w - r, y + h),
        ));
    }
    out.push(line(x + r, y + h));
    if r > 0.0 {
        out.push(cubic(
            (x + r - k, y + h),
            (x, y + h - r + k),
            (x, y + h - r),
        ));
    }
    out.push(line(x, y + r));
    if r > 0.0 {
        out.push(cubic((x, y + r - k), (x + r - k, y), (x + r, y)));
    }
    out.push(seg(4, [0.0; 6]));
    out
}
