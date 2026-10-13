//! `frame-v1`: `border` / `reverse_border` (design §7.4).
//!
//! The reference implementations `progress_border.frag` / `progress_reverse_border.frag` build the border from four box SDFs and take the union with `clamp(b1 + b2 + b3 + b4, 0, 1)`. On the vector side, the four edges go into **four subpaths of the same path**, filled with nonzero. The union of same-direction subpaths is exactly what `clamp(..., 0, 1)` means. Splitting them into four `FillRect`s would blend the semi-transparent color twice at the corners.
//!
//! ## Border thickness
//!
//! `barSize = BORDER_SIZE · sourceAspect.yx`. After both axes are converted to pixels, each equals `borderSize · max(w, h)`. The reference implementation takes this detour precisely so that the horizontal and vertical edges are **equally thick**. The vector side uses this conclusion directly.
//!
//! ## Two fill directions (the `fill` parameter)
//!
//! * `"forward"`: the perimeter is split into two segments by `w : h = srcRes.x : srcRes.y` (normalized by their sum). **Both arms start from the bottom-left corner together.** One runs along the bottom edge to the right and then up the right edge; the other runs up the left edge and then right along the top edge. They meet at the top-right corner when `progress == 1`.
//! * `"reverse"`: uses `1 − progress` as the length, with an L shape growing from the **bottom-left** and the **top-right** corners. The length on both axes is directly the normalized `1 − progress`. The reference implementation does **not** normalize the perimeter in this branch, and this is reproduced as is.
//!
//! ## Three `colorMode`s (P5b completes the last two; determinism = `visual`)
//!
//! * `"solid"`: the whole progress frame uses the primary color. Strict.
//! * `"rainbow"`: each of the four corner base colors goes through a **hue cycle** (`hue += sin(t) · hueSpeed`). The colors are then bilinearly interpolated by normalized position, and finally mixed with white by `mixBias + (sin t·½+½)·mixGain`. The color **differs at each point**, but a `FillPath` in DrawOp has only one solid color. So the CPU reference takes a downsampled approximation: "push a `ClipPath` of the progress frame, then fill it with a `gradientSteps × gradientSteps` grid of color blocks" (§8.7 visual tier). The authoritative pixel output is in WGSL.
//! * `"strobe"`: the four corners are `main / secondary / main / secondary`, and the sample point is the **constant** `(s, −s)`. So `fourCornerGradient` degenerates to `mix(main, secondary, s)`: the whole frame is one color, and on the CPU side a single `FillPath` is enough, **with no approximation**.
//!
//! The `a` in the reference implementation's `progressColour *= u_mainColor.a` is a different thing from the alpha of the four corner base colors. The former is element opacity (the host already folds it into `params.main_color`), and the latter is always 1. Both sides read it as "alpha = the primary color's alpha".

use motion::preset_registry::ProgressBody;
use serde_json::Value;

use crate::drawop::{Color4, DrawOp, FrameBuilder, Mat6, PathData, PathSeg};
use crate::source::kernel::{DrawBox, rect_subpath};
use crate::source::progress::ProgressParams;

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &ProgressBody,
    params: &ProgressParams,
    progress: f64,
    time: f64,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(border_size), Some(fill), Some(background), Some(mode)) = (
        recipe.number("borderSize"),
        recipe.text("fill"),
        recipe.flag("background"),
        recipe.object("colorMode"),
    ) else {
        return 0;
    };
    // Dispatches on **data** (`colorMode.kind`), not on a blocklist of ids.
    let kind = mode.get("kind").and_then(Value::as_str).unwrap_or("solid");
    let thickness = border_size * bbox.w.max(bbox.h);
    if !(thickness > 0.0) {
        return 0;
    }
    let before = builder.frame.ops.len();

    if background {
        let mut path = Vec::new();
        push_edge(&mut path, bbox, thickness, Edge::Bottom, 0.0, 1.0);
        push_edge(&mut path, bbox, thickness, Edge::Top, 0.0, 1.0);
        push_edge(&mut path, bbox, thickness, Edge::Left, 0.0, 1.0);
        push_edge(&mut path, bbox, thickness, Edge::Right, 0.0, 1.0);
        if !path.is_empty() {
            let path = builder.path_id(PathData(path));
            builder.push(DrawOp::FillPath {
                path,
                color: params.secondary_color,
                tf,
            });
        }
    }

    let mut path = Vec::new();
    if fill == "reverse" {
        // At full progress the whole ring disappears: the reference implementation's `if (progress > 0.0)` guard.
        let reach = 1.0 - progress;
        if reach > 0.0 {
            push_edge(&mut path, bbox, thickness, Edge::Bottom, 0.0, reach);
            push_edge(&mut path, bbox, thickness, Edge::Left, 0.0, reach);
            push_edge(&mut path, bbox, thickness, Edge::Top, 1.0 - reach, 1.0);
            push_edge(&mut path, bbox, thickness, Edge::Right, 1.0 - reach, 1.0);
        }
    } else if progress > 0.0 {
        // Perimeter normalization: the horizontal segment takes w/(w+h), and the vertical segment takes h/(w+h).
        let span = bbox.w + bbox.h;
        let (across, up) = (bbox.w / span, bbox.h / span);
        let leg = |from: f64, to: f64| -> f64 {
            if to <= from {
                0.0
            } else {
                ((progress - from) / (to - from)).clamp(0.0, 1.0)
            }
        };
        push_edge(
            &mut path,
            bbox,
            thickness,
            Edge::Bottom,
            0.0,
            leg(0.0, across),
        );
        push_edge(&mut path, bbox, thickness, Edge::Left, 0.0, leg(0.0, up));
        push_edge(&mut path, bbox, thickness, Edge::Top, 0.0, leg(up, 1.0));
        push_edge(
            &mut path,
            bbox,
            thickness,
            Edge::Right,
            0.0,
            leg(across, 1.0),
        );
    }
    if !path.is_empty() {
        let id = builder.path_id(PathData(path));
        match kind {
            // Hue cycle: the progress frame serves as the clip region, and the color-block grid is filled into it (see the module docs).
            "rainbow" => push_gradient_fill(builder, mode, params, time, bbox, id, tf),
            // Strobe: the whole frame is one color, as a single `FillPath`.
            "strobe" => builder.push(DrawOp::FillPath {
                path: id,
                color: strobe_color(mode, params, time),
                tf,
            }),
            _ => builder.push(DrawOp::FillPath {
                path: id,
                color: params.main_color,
                tf,
            }),
        }
    }
    builder.frame.ops.len() - before
}

/// `mixBias + (sin t · ½ + ½) · mixGain`: the mix amount between white and the gradient color.
fn mix_amount(mode: &serde_json::Map<String, Value>, time: f64) -> f64 {
    let number = |key: &str| mode.get(key).and_then(Value::as_f64).unwrap_or_default();
    number("mixBias") + (time.sin() * 0.5 + 0.5) * number("mixGain")
}

/// `mix(vec3(1), rgb, amount)`, with alpha taken from the primary color's alpha (element opacity).
fn toward_white(rgb: [f64; 3], amount: f64, alpha: f32) -> Color4 {
    [
        (1.0 + (rgb[0] - 1.0) * amount) as f32,
        (1.0 + (rgb[1] - 1.0) * amount) as f32,
        (1.0 + (rgb[2] - 1.0) * amount) as f32,
        alpha,
    ]
}

fn strobe_color(
    mode: &serde_json::Map<String, Value>,
    params: &ProgressParams,
    time: f64,
) -> Color4 {
    let speed = mode
        .get("speed")
        .and_then(Value::as_f64)
        .unwrap_or_default();
    let s = (time * speed).sin() * 0.5 + 0.5;
    // The corners are `main / secondary / main / secondary` and the sample point is the constant `(s, −s)`. The top and bottom edges interpolate to the same color, so the vertical `mix` pass degenerates.
    let blend = |slot: usize| {
        f64::from(params.main_color[slot])
            + (f64::from(params.secondary_color[slot]) - f64::from(params.main_color[slot])) * s
    };
    toward_white(
        [blend(0), blend(1), blend(2)],
        mix_amount(mode, time),
        params.main_color[3],
    )
}

/// The four-corner gradient for the hue cycle: a `gradientSteps × gradientSteps` grid of color blocks, pressed into the progress frame's `ClipPath`. This is the **only** approximation point of this style (§8.7 visual tier).
fn push_gradient_fill(
    builder: &mut FrameBuilder,
    mode: &serde_json::Map<String, Value>,
    params: &ProgressParams,
    time: f64,
    bbox: DrawBox,
    clip: u32,
    tf: Mat6,
) {
    let steps = mode
        .get("gradientSteps")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .max(1) as usize;
    let hue_speed = mode
        .get("hueSpeed")
        .and_then(Value::as_f64)
        .unwrap_or_default();
    let shift = time.sin() * hue_speed;
    let corners: Vec<[f64; 3]> = mode
        .get("corners")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .map(|entry| {
                    let channel = |slot: usize| {
                        entry
                            .as_array()
                            .and_then(|rgba| rgba.get(slot))
                            .and_then(Value::as_f64)
                            .unwrap_or_default()
                    };
                    hue_cycled([channel(0), channel(1), channel(2)], shift)
                })
                .collect()
        })
        .unwrap_or_default();
    if corners.len() < 4 {
        return;
    }
    let amount = mix_amount(mode, time);
    builder.push(DrawOp::ClipPath { path: clip, tf });
    for row in 0..steps {
        for column in 0..steps {
            // Each block takes the gradient color at its own center point. uv is **v-up** (the same convention as the WGSL side).
            let u = (column as f64 + 0.5) / steps as f64;
            let v = (row as f64 + 0.5) / steps as f64;
            let blend = |slot: usize| {
                let top = corners[0][slot] + (corners[1][slot] - corners[0][slot]) * u;
                let bottom = corners[2][slot] + (corners[3][slot] - corners[2][slot]) * u;
                top + (bottom - top) * v
            };
            let color = toward_white([blend(0), blend(1), blend(2)], amount, params.main_color[3]);
            let (x, y) = bbox.at(u - 0.5 / steps as f64, v + 0.5 / steps as f64);
            builder.push(DrawOp::FillRect {
                x: x as f32,
                y: y as f32,
                // Adjacent blocks overlap by half a cell so that no seams show at integer pixels. The clip region hides the overflow.
                w: (bbox.w / steps as f64 + 1.0) as f32,
                h: (bbox.h / steps as f64 + 1.0) as f32,
                radius: 0.0,
                color,
                tf,
            });
        }
    }
    builder.push(DrawOp::PopClip);
}

/// Shifts one rgb along the hue axis by `shift` (the reference implementation's `animate()`: rgb → hsv → rgb).
fn hue_cycled(rgb: [f64; 3], shift: f64) -> [f64; 3] {
    let (mut h, s, v) = rgb_to_hsv(rgb);
    h += shift;
    hsv_to_rgb(h, s, v)
}

fn rgb_to_hsv(rgb: [f64; 3]) -> (f64, f64, f64) {
    let max = rgb[0].max(rgb[1]).max(rgb[2]);
    let min = rgb[0].min(rgb[1]).min(rgb[2]);
    let delta = max - min;
    // The same ε as the reference implementation, to guard against division by zero.
    let epsilon = 1.0e-10;
    let hue = if delta <= epsilon {
        0.0
    } else if max == rgb[0] {
        ((rgb[1] - rgb[2]) / delta).rem_euclid(6.0) / 6.0
    } else if max == rgb[1] {
        ((rgb[2] - rgb[0]) / delta + 2.0) / 6.0
    } else {
        ((rgb[0] - rgb[1]) / delta + 4.0) / 6.0
    };
    (hue, delta / (max + epsilon), max)
}

fn hsv_to_rgb(h: f64, s: f64, v: f64) -> [f64; 3] {
    let channel = |offset: f64| {
        let p = ((h + offset).rem_euclid(1.0) * 6.0 - 3.0).abs();
        v * (1.0 + ((p - 1.0).clamp(0.0, 1.0) - 1.0) * s)
    };
    [channel(1.0), channel(2.0 / 3.0), channel(1.0 / 3.0)]
}

/// The four edges. `from` / `to` are the normalized interval along that edge. The directions match the reference implementation's four boxes: the bottom and top edges run **left to right**, and the left and right edges run **bottom to top**.
#[derive(Clone, Copy)]
enum Edge {
    Bottom,
    Top,
    Left,
    Right,
}

fn push_edge(
    out: &mut Vec<PathSeg>,
    bbox: DrawBox,
    thickness: f64,
    edge: Edge,
    from: f64,
    to: f64,
) {
    if !(to > from) {
        return;
    }
    match edge {
        Edge::Bottom => rect_subpath(
            out,
            bbox.x + bbox.w * from,
            bbox.y + bbox.h - thickness,
            bbox.w * (to - from),
            thickness,
        ),
        Edge::Top => rect_subpath(
            out,
            bbox.x + bbox.w * from,
            bbox.y,
            bbox.w * (to - from),
            thickness,
        ),
        Edge::Left => rect_subpath(
            out,
            bbox.x,
            bbox.y + bbox.h * (1.0 - to),
            thickness,
            bbox.h * (to - from),
        ),
        Edge::Right => rect_subpath(
            out,
            bbox.x + bbox.w - thickness,
            bbox.y + bbox.h * (1.0 - to),
            thickness,
            bbox.h * (to - from),
        ),
    }
}
