//! `proc:"rain"`: slanted rain streaks in three depth layers. The fall wraps modulo time, so it is closed-form at any instant.
use super::{color, push_box_clip, stroke, unit};
use crate::drawop::{DrawOp, FrameBuilder};
use crate::source::kernel::{path_seg_line, path_seg_move};
use scene_primitives::proc::{MAX_DROPS, Rain};
use tiny_skia::Transform;

/// Number of streaks for a 1080p box at density = 1.
const DROPS_AT_FULL_HD: f64 = 1_400.0;
/// Depth layers: one `StrokePath` per layer; stroke width and opacity are chosen per layer.
const LAYERS: usize = 3;

pub(super) fn record(
    rain: &Rain,
    seed: u64,
    w: f64,
    h: f64,
    time: f64,
    tf: Transform,
    b: &mut FrameBuilder,
) {
    if rain.density <= 0.0 || rain.length <= 0.0 {
        return;
    }
    let deg = core::f64::consts::PI / 180.0;
    // Gusts: the tilt angle swings around a baseline. The whole rain curtain has the same tilt at any instant (shear around each streak's start point), closed-form.
    let sway_phase = unit(seed, 0, 0x7769_6E64) * core::f64::consts::TAU;
    let angle = rain.angle + rain.wind * 20.0 * libm::sin(0.7 * time + sway_phase);
    let slope = libm::tan(angle.clamp(-80.0, 80.0) * deg);
    let (dx, dy) = {
        let norm = libm::sqrt(1.0 + slope * slope);
        (slope / norm, 1.0 / norm)
    };
    // The horizontal extent must be laid out wider for the maximum tilt, so the rain curtain covers the whole box.
    let max_slope = libm::tan((rain.angle.abs() + rain.wind * 20.0).min(80.0) * deg);
    let ext = h * max_slope;
    let span_x = w + 2.0 * ext;
    let count = ((rain.density * DROPS_AT_FULL_HD * (span_x * h) / (1920.0 * 1080.0)).round()
        as usize)
        .min(MAX_DROPS);
    let max_len = rain.length * h;
    let span_y = h + 2.0 * max_len;

    let mut layers: [Vec<_>; LAYERS] = Default::default();
    for i in 0..count as u64 {
        let z = 0.3 + 0.7 * unit(seed, i, 1);
        let x0 = -ext + span_x * unit(seed, i, 2);
        let speed = rain.speed * h * (0.55 + 0.45 * z) * (0.9 + 0.2 * unit(seed, i, 3));
        let len = max_len * (0.4 + 0.6 * z);
        let phase = span_y * unit(seed, i, 4);
        // Vertical travel of the streak head: modulo span_y, so it falls past the bottom of the box and re-enters from above the top.
        let s = (phase + speed * time).rem_euclid(span_y);
        let head_y = s - max_len;
        let head_x = x0 + head_y * slope;
        let (tail_x, tail_y) = (head_x - dx * len, head_y - dy * len);
        if head_y < 0.0 || tail_y > h {
            continue;
        }
        let layer = (((z - 0.3) / 0.7 * LAYERS as f64) as usize).min(LAYERS - 1);
        layers[layer].push(path_seg_move(tail_x, tail_y));
        layers[layer].push(path_seg_line(head_x, head_y));
    }

    push_box_clip(w, h, tf, b);
    for (index, segs) in layers.into_iter().enumerate() {
        let depth = (index as f64 + 0.5) / LAYERS as f64;
        let z = 0.3 + 0.7 * depth;
        stroke(
            segs,
            color(&rain.color, 0.45 + 0.55 * z),
            rain.width * (0.5 + 0.5 * z),
            tf,
            b,
        );
    }
    b.push(DrawOp::PopClip);
}
