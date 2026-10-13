//! `bar-v1`: `normal` / `rounded` (design §7.4).
//!
//! Reference implementation (`progress_normal.frag` / `progress_rounded.frag`): the base color fills the whole quad, and the part where `texCoord.x < u_progress` is replaced with the primary color. `rounded` also multiplies by a **capsule-shaped alpha mask** (a rounded rectangle with `radius = 200px`).
//!
//! The key to vectorizing: the color boundary is a **vertical hard edge**, and rounding belongs only to the outer outline. So when `radiusPx > 0`, push one `ClipPath` (a rounded rectangle) and then draw two square rectangles. Adding rounding directly to the progress block would give its right end a round head that should not exist.

use motion::preset_registry::ProgressBody;
use serde_json::Value;

use crate::drawop::{DrawOp, FrameBuilder, Mat6, PathData};
use crate::source::kernel::DrawBox;
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
    let Some(direction) = recipe.text("direction") else {
        return 0;
    };
    // `corner: {"kind":"none"}` is square. `{"kind":"capsule", "radiusPx": …}` has its pixel length converted with the factor the host supplies, then clamped to within half the short edge (see the module docs of draw.rs).
    let radius = recipe
        .object("corner")
        .filter(|corner| corner.get("kind").and_then(Value::as_str) == Some("capsule"))
        .and_then(|corner| corner.get("radiusPx"))
        .and_then(Value::as_f64)
        .map(|pixels| (pixels * params.pixel_scale).min(bbox.w.min(bbox.h) / 2.0))
        .unwrap_or(0.0)
        .max(0.0);

    let before = builder.frame.ops.len();
    if radius > 0.0 {
        let path = builder.path_id(PathData(super::rounded_rect(bbox, radius)));
        builder.push(DrawOp::ClipPath { path, tf });
    }
    builder.push(DrawOp::FillRect {
        x: bbox.x as f32,
        y: bbox.y as f32,
        w: bbox.w as f32,
        h: bbox.h as f32,
        radius: 0.0,
        color: params.secondary_color,
        tf,
    });
    let filled = bbox.w * progress;
    if filled > 0.0 {
        // No recipe uses `rtl` yet, but its value domain is a closed enum in the registry (`ENUM_KEYS`), so it dispatches on the data rather than on the id.
        let x = if direction == "rtl" {
            bbox.x + bbox.w - filled
        } else {
            bbox.x
        };
        builder.push(DrawOp::FillRect {
            x: x as f32,
            y: bbox.y as f32,
            w: filled as f32,
            h: bbox.h as f32,
            radius: 0.0,
            color: params.main_color,
            tf,
        });
    }
    if radius > 0.0 {
        builder.push(DrawOp::PopClip);
    }
    builder.frame.ops.len() - before
}
