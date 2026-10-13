//! `ring-v1`: `circle` / `donut` (design §7.4).
//!
//! Reference implementation (`progress_circle.frag` / `progress_donut.frag`): `len = |texCoord·2 − 1|` on the inscribed circle. Sectors whose `anglePercent` (clockwise from straight up, `atan(−centred.x, −centred.y) + π`) is less than `u_progress` use the primary color, and the rest use the secondary. `donut` also multiplies by an inner-ring mask with `innerRadius = 0.8`.
//!
//! Vector side: a base ring (a full circle or full annulus) and progress sectors (a pie slice or an annular sector), as two `FillPath`s.
//! `innerRadius` is a ratio **relative to the outer radius**, in the same units as the reference implementation's `len`.
//! `featherPx` / `edgeFeatherPx` are the shader's antialiasing bandwidth. The vector path does not read them (see the module docs of `super::super::draw`).

use motion::preset_registry::ProgressBody;

use crate::drawop::{DrawOp, FrameBuilder, Mat6, PathData};
use crate::source::kernel::{DrawBox, ring_subpath, sector_subpath};
use crate::source::progress::ProgressParams;

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &ProgressBody,
    params: &ProgressParams,
    progress: f64,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(inner_ratio), Some(start_angle), Some(direction)) = (
        recipe.number("innerRadius"),
        recipe.text("startAngle"),
        recipe.text("direction"),
    ) else {
        return 0;
    };
    let center = bbox.center();
    let outer = bbox.w.min(bbox.h) / 2.0;
    if !(outer > 0.0) {
        return 0;
    }
    let inner = outer * inner_ratio.clamp(0.0, 1.0);
    // The only closed value of `startAngle` at present is `"top"` (registry `ENUM_KEYS`), while `kernel::polar`'s zero angle is straight up. When more values are added, the offset goes here.
    let phase = match start_angle {
        "top" => 0.0,
        _ => 0.0,
    };
    // Of the closed values of `direction`, `ccw` and `rtl` are not used by any progress recipe at present.
    let sign = if direction == "ccw" { -1.0 } else { 1.0 };

    let before = builder.frame.ops.len();
    let mut path = Vec::new();
    ring_subpath(&mut path, center, outer, inner);
    if !path.is_empty() {
        let path = builder.path_id(PathData(path));
        builder.push(DrawOp::FillPath {
            path,
            color: params.secondary_color,
            tf,
        });
    }
    if progress > 0.0 {
        let sweep = sign * progress * std::f64::consts::TAU;
        let mut path = Vec::new();
        sector_subpath(&mut path, center, outer, inner, phase, phase + sweep);
        if !path.is_empty() {
            let path = builder.path_id(PathData(path));
            builder.push(DrawOp::FillPath {
                path,
                color: params.main_color,
                tf,
            });
        }
    }
    builder.frame.ops.len() - before
}
