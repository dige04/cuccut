//! Procedural picture source `type:"proc"` (spec §6.12): rain, splashes, night sky.
//!
//! Same discipline as [`super::confetti`]: **no per-frame state**. Every frame is a closed-form function of `(local seconds τ, seed, params, element box)`. `ccut render --t 7.5` jumps straight to frame 225, and export splits frames across several workers by stride; the output is the same bytes either way.
//! Randomness comes only from the integer hash of [`unit`] (splitmix64). Transcendental functions go only through `libm` (checked by the text scan in `tests/proc_libm_only.rs`), so native and wasm32 match bit for bit.
//!
//! The coordinate system is **element-box-local pixels** (top-left origin, y down); `tf` maps it onto the surface.
//! Parsing and defaults live in `scene_primitives::proc`; this file only turns the parameters into DrawOps.
mod noise;
mod rain;
mod sky;
mod splash;

use crate::drawop::{Color4, DrawOp, FrameBuilder, PathData, PathSeg};
use crate::source::kernel::{path_seg_close, path_seg_cubic, path_seg_line, path_seg_move};
use scene_primitives::Rgba;
use scene_primitives::proc::{ProcKind, ProcSource};
use tiny_skia::Transform;

/// Records the picture of a proc node at local time `time` into `b`. `w × h` is the element box.
pub fn record_proc(
    proc: &ProcSource,
    w: f64,
    h: f64,
    time: f64,
    tf: Transform,
    b: &mut FrameBuilder,
) {
    if !(w > 0.0 && h > 0.0) {
        return;
    }
    match &proc.kind {
        ProcKind::Rain(rain) => rain::record(rain, proc.seed, w, h, time, tf, b),
        ProcKind::Splash(splash) => splash::record(splash, proc.seed, w, h, time, tf, b),
        ProcKind::Sky(sky) => sky::record(sky, proc.seed, w, h, time, tf, b),
    }
}

/// splitmix64 final mix: integer in, uniform 64 bits out.
pub(crate) fn mix(mut z: u64) -> u64 {
    z = z.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// `[0, 1)` uniform number: each `(seed, index, purpose)` triple is independent.
pub(crate) fn unit(seed: u64, index: u64, salt: u64) -> f64 {
    let h = mix(seed ^ mix(index ^ salt.wrapping_mul(0xD6E8_FEB8_6659_FD93)));
    (h >> 11) as f64 / (1u64 << 53) as f64
}

pub(crate) fn mat(tf: Transform) -> [f32; 6] {
    [tf.sx, tf.ky, tf.kx, tf.sy, tf.tx, tf.ty]
}

/// Non-premultiplied color; `alpha` multiplies into the color's own a.
pub(crate) fn color(c: &Rgba, alpha: f64) -> Color4 {
    [
        (c.r / 255.0).clamp(0.0, 1.0) as f32,
        (c.g / 255.0).clamp(0.0, 1.0) as f32,
        (c.b / 255.0).clamp(0.0, 1.0) as f32,
        (c.a * alpha).clamp(0.0, 1.0) as f32,
    ]
}

/// Circle approximated by four cubic Béziers (κ = 0.5522847498), without trigonometry.
pub(crate) fn circle(out: &mut Vec<PathSeg>, cx: f64, cy: f64, rx: f64, ry: f64) {
    const K: f64 = 0.552_284_749_8;
    let (kx, ky) = (rx * K, ry * K);
    out.push(path_seg_move(cx + rx, cy));
    out.push(path_seg_cubic(
        (cx + rx, cy + ky),
        (cx + kx, cy + ry),
        (cx, cy + ry),
    ));
    out.push(path_seg_cubic(
        (cx - kx, cy + ry),
        (cx - rx, cy + ky),
        (cx - rx, cy),
    ));
    out.push(path_seg_cubic(
        (cx - rx, cy - ky),
        (cx - kx, cy - ry),
        (cx, cy - ry),
    ));
    out.push(path_seg_cubic(
        (cx + kx, cy - ry),
        (cx + rx, cy - ky),
        (cx + rx, cy),
    ));
    out.push(path_seg_close());
}

pub(crate) fn rect(out: &mut Vec<PathSeg>, w: f64, h: f64) {
    out.push(path_seg_move(0.0, 0.0));
    out.push(path_seg_line(w, 0.0));
    out.push(path_seg_line(w, h));
    out.push(path_seg_line(0.0, h));
    out.push(path_seg_close());
}

/// Clips to the box so rain streaks and clouds do not overflow. Paired with `PopClip`; must not span `PushLayer`.
pub(crate) fn push_box_clip(w: f64, h: f64, tf: Transform, b: &mut FrameBuilder) {
    let mut segs = Vec::new();
    rect(&mut segs, w, h);
    let path = b.path_id(PathData(segs));
    b.push(DrawOp::ClipPath { path, tf: mat(tf) });
}

pub(crate) fn fill(segs: Vec<PathSeg>, color: Color4, tf: Transform, b: &mut FrameBuilder) {
    if segs.is_empty() || color[3] <= 0.0 {
        return;
    }
    let path = b.path_id(PathData(segs));
    b.push(DrawOp::FillPath {
        path,
        color,
        tf: mat(tf),
    });
}

pub(crate) fn stroke(
    segs: Vec<PathSeg>,
    color: Color4,
    width: f64,
    tf: Transform,
    b: &mut FrameBuilder,
) {
    if segs.is_empty() || color[3] <= 0.0 || width <= 0.0 {
        return;
    }
    let path = b.path_id(PathData(segs));
    b.push(DrawOp::StrokePath {
        path,
        color,
        width: width as f32,
        tf: mat(tf),
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unit_is_uniform_enough_and_salted() {
        let n = 20_000;
        let mean = (0..n).map(|i| unit(7, i, 1)).sum::<f64>() / n as f64;
        assert!((mean - 0.5).abs() < 0.01, "{mean}");
        assert_ne!(unit(7, 3, 1), unit(7, 3, 2));
        assert_ne!(unit(7, 3, 1), unit(8, 3, 1));
        assert!((0..n).all(|i| (0.0..1.0).contains(&unit(1, i, 9))));
    }
}
