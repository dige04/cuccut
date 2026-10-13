//! `snake-v1`: `snake` / `snake_spin` (design §7.4).
//!
//! The reference implementations (`progress_snake.frag` / `progress_snake_spin.frag`): `circleRing()` is a **per-degree loop**. Starting at `startAngleDeg`, every `angleIncrementDeg` it places a soft-edged circle of radius `dotRadius`, accumulates their alphas, and applies `min(…, 1)`. The number of turns is set by `round(progress × the number of steps in one full turn)`, capped at `maxIterations`. The base ring is drawn once at progress 1 (secondary color), the progress ring once at the current progress (primary color), and then they are `mix`ed together.
//!
//! ## Per-degree loop → swept union (settled in P4)
//!
//! The spacing between circle centers (1° at a radius of 0.4 ≈ 0.007) is only one fourteenth of the circle radius (0.1). So the overlap field is **already saturated** inside the union, and the half-coverage contour is then exactly the boundary of the union itself. "The union of a disc swept along an arc" has a closed form ([`swept_arc_subpath`]), so the per-degree loop reduces to just **a fixed number of turns**. `maxIterations` / `angleIncrementDeg` / `startAngleDeg` remain the source of truth in the data, and none of them was moved into Rust. The gain is that even at 360 turns there is one path, not 360 subpaths.
//!
//! **`smoothing` and `boostSteps` are not read.** This is the second category recorded in P3: pure alpha transition bandwidth. In dense overlap the boundary of the union is `dotRadius` itself, so `smoothing` degenerates into edge antialiasing. `boostSteps` (multiplying alpha by 3 / 2 when there are fewer than 1 / 2 turns) exists to "make a few circles more prominent". On the vector side, those one or two circles are already solid at full radius, which is more prominent than in the reference implementation. P5's WGSL will use these two parameters verbatim.
//!
//! ## Angle conversion
//!
//! The reference implementation computes `pos + (cos a, sin a) · dist` in a v-up `texCoord`, so the circle center is at `0.5 − dist · (cos a, sin a)`. [`polar`]'s zero angle, however, is straight up, with clockwise positive. The conversion between the two is `phi = −(π/2 + a)`: `a = 270°` ⇒ `phi = 0` (straight up), and each decrease of `a` by 1° ⇒ `phi` increases by 1° (clockwise). That π/2 is the difference between the two coordinate systems' zero angles, not a style parameter.

use motion::preset_registry::ProgressBody;

use crate::drawop::{Color4, DrawOp, FrameBuilder, Mat6, PathData};
use crate::source::kernel::{DrawBox, sector_subpath, swept_arc_subpath};
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
    let (
        Some(dot_ratio),
        Some(orbit_ratio),
        Some(start_angle),
        Some(increment),
        Some(max_iterations),
        Some(color_mode),
    ) = (
        recipe.number("dotRadius"),
        recipe.number("orbitRadius"),
        recipe.number("startAngleDeg"),
        recipe.number("angleIncrementDeg"),
        recipe.integer("maxIterations"),
        recipe.object("colorMode"),
    )
    else {
        return 0;
    };
    // `colorMode.kind` dispatches by tag rather than by a blocklist of ids (the same rule as `frame-v1`).
    let rainbow = color_mode.get("kind").and_then(serde_json::Value::as_str) == Some("rainbow");
    let track_color = match color_mode
        .get("trackColor")
        .and_then(serde_json::Value::as_str)
    {
        Some("main") => params.main_color,
        _ => params.secondary_color,
    };
    // `aspect: "square"` has already been applied in `progress_frame` (the inscribed square). The reference implementation's lengths are all in normalized `texCoord`, so they are in units of side length.
    let side = bbox.w.min(bbox.h);
    let (center, orbit, dot) = (bbox.center(), orbit_ratio * side, dot_ratio * side);
    if !(dot > 0.0) {
        return 0;
    }
    let increment = increment.to_radians();
    if increment == 0.0 {
        return 0;
    }
    // Rotation: `offset = −mod(t · speed, 360°)` is added to `a` (the base ring and the progress ring share the same offset).
    let spin = recipe
        .object("spin")
        .and_then(|object| object.get("speedDegPerSec"))
        .and_then(serde_json::Value::as_f64)
        .map(|speed| {
            let turn = 360.0;
            -(time * speed).rem_euclid(turn)
        })
        .unwrap_or(0.0);
    // `phi = −(π/2 + a)` (see the module docs).
    let phi_start = -(std::f64::consts::FRAC_PI_2 + (start_angle + spin).to_radians());

    let before = builder.frame.ops.len();
    // The base ring (progress 1) is below, the progress ring on top, as in the reference implementation's `mix(bot, top, top.a)`.
    let push_arc = |builder: &mut FrameBuilder, from: f64, to: f64, color: Color4| {
        let mut path = Vec::new();
        swept_arc_subpath(&mut path, center, orbit, dot, from, to);
        if !path.is_empty() {
            let path = builder.path_id(PathData(path));
            builder.push(DrawOp::FillPath { path, color, tf });
        }
    };

    let track_dots = dot_count(1.0, increment, max_iterations);
    push_arc(
        builder,
        phi_start,
        phi_start - (track_dots - 1) as f64 * increment,
        track_color,
    );

    let dots = dot_count(progress, increment, max_iterations);
    let phi_end = phi_start - (dots - 1) as f64 * increment;
    if rainbow {
        // ── Approximation at the `visual` tier (§8.7). The reference implementation's rainbow is **per fragment**: `hue = the polar angle of this point / 2π + ½`, `saturation = the radius of this point × 2`. The color belongs to **the pixel's position**, not to any particular small circle. So on the vector side: ① the whole progress arc is pushed as one `ClipPath` layer; ② inside it, a `hueSteps × radialSteps` polar grid of color blocks is filled, each block taking the color at its own center. This way hue and saturation both follow **the fragment's position**, matching the reference implementation. The authoritative pixel output is still in WGSL.
        let steps = |key: &str, fallback: u64| {
            color_mode
                .get(key)
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(fallback)
                .max(1)
        };
        let hue_steps = steps("hueSteps", 1);
        let radial_steps = steps("radialSteps", 1);
        let speed = color_mode
            .get("rotationSpeedDegPerSec")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or_default();
        let from_radius = color_mode
            .get("saturationFromRadius")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);
        let alpha = params.main_color[3];

        let mut clip = Vec::new();
        swept_arc_subpath(&mut clip, center, orbit, dot, phi_start, phi_end);
        if !clip.is_empty() {
            let clip = builder.path_id(PathData(clip));
            builder.push(DrawOp::ClipPath { path: clip, tf });
            // The grid covers only the angular range of the progress arc (leaving the angle of one small circle at each end).
            let cap = (dot / orbit).clamp(-1.0, 1.0).asin();
            let (lo, hi) = if phi_end >= phi_start {
                (phi_start - cap, phi_end + cap)
            } else {
                (phi_end - cap, phi_start + cap)
            };
            let wedges = ((hi - lo) / std::f64::consts::TAU * hue_steps as f64).ceil() as u64;
            // **Adjacent blocks must overlap by half a pixel.** If each were its own `FillPath`, the rasterizer would antialias each shared edge separately and alpha-over them (`a + a(1−a) = 0.75`), and the grid would be covered in dark seams. Overlapping lets the block drawn later cover the boundary, so the error drops from a quarter-strength dark line to a half-pixel color offset. (On the bar family, the whole field is one color, so the cleaner approach of "pressing into the same path to take the union" is used.)
            let bleed = 0.5;
            for wedge in 0..wedges.max(1) {
                let from = lo + (hi - lo) * wedge as f64 / wedges.max(1) as f64;
                let to = lo + (hi - lo) * (wedge + 1) as f64 / wedges.max(1) as f64;
                for band in 0..radial_steps {
                    let inner = orbit - dot + 2.0 * dot * band as f64 / radial_steps as f64;
                    let outer = orbit - dot + 2.0 * dot * (band + 1) as f64 / radial_steps as f64;
                    let saturation = if from_radius {
                        ((inner + outer) / side).clamp(0.0, 1.0)
                    } else {
                        1.0
                    };
                    let mut path = Vec::new();
                    sector_subpath(
                        &mut path,
                        center,
                        outer + bleed,
                        (inner - bleed).max(0.0),
                        from - bleed / orbit,
                        to + bleed / orbit,
                    );
                    if path.is_empty() {
                        continue;
                    }
                    let id = builder.path_id(PathData(path));
                    builder.push(DrawOp::FillPath {
                        path: id,
                        color: rainbow_color((from + to) * 0.5, time, speed, saturation, alpha),
                        tf,
                    });
                }
            }
            builder.push(DrawOp::PopClip);
        }
    } else {
        push_arc(builder, phi_start, phi_end, params.main_color);
    }
    builder.frame.ops.len() - before
}

/// The color of one point on the rotating rainbow ring.
///
/// The reference implementation computes `hsb2rgb(vec3(atan2(y, x) / 2π + ½, |p| · 2, 1))`, where `p` has already been rotated once by `rotate2d(radians(t · speed))`. The polar angle `phi` is "clockwise from straight up". Converting it to that formula's "counterclockwise from the +x axis" coordinates gives `π/2 − phi`, plus the rotation amount.
fn rainbow_color(phi: f64, time: f64, speed_deg: f64, saturation: f64, alpha: f32) -> Color4 {
    let angle = std::f64::consts::FRAC_PI_2 - phi + (time * speed_deg).to_radians();
    let hue = angle / std::f64::consts::TAU + 0.5;
    let rgb = hsb_to_rgb(hue, saturation);
    [rgb[0] as f32, rgb[1] as f32, rgb[2] as f32, alpha]
}

/// The reference implementation's `hsb2rgb` (brightness is always 1).
fn hsb_to_rgb(hue: f64, saturation: f64) -> [f64; 3] {
    let channel = |offset: f64| {
        let raw = ((hue * 6.0 + offset).rem_euclid(6.0) - 3.0).abs() - 1.0;
        let clamped = raw.clamp(0.0, 1.0);
        // The reference implementation's `rgb * rgb * (3 − 2 rgb)`: a single smoothstep to sharpen the edges.
        let smooth = clamped * clamped * (3.0 - 2.0 * clamped);
        1.0 + (smooth - 1.0) * saturation
    };
    [channel(0.0), channel(4.0), channel(2.0)]
}

/// How many turns the reference implementation's loop actually ran.
///
/// `angleTotal = round(progress × the number of steps in one full turn)`. When `i >= angleTotal`, the loop body **finishes the current turn before it breaks**, so the number of turns is `angleTotal + 1`, capped at `maxIterations`. At progress 0 there is still one circle (as in the reference implementation, one dot always remains at the start point). This must be reproduced.
fn dot_count(progress: f64, increment: f64, max_iterations: u64) -> u64 {
    let steps_per_turn = std::f64::consts::TAU / increment.abs();
    let total = (progress.clamp(0.0, 1.0) * steps_per_turn).round();
    (total as u64 + 1).min(max_iterations.max(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The turn count reproduces the reference implementation exactly: `round(360·p)`, "finish the turn, then break", and the cap.
    #[test]
    fn the_dot_count_matches_the_reference_loop() {
        let degree = (-1.0f64).to_radians();
        assert_eq!(dot_count(0.0, degree, 360), 1, "progress 0 still keeps one dot");
        assert_eq!(dot_count(1.0 / 360.0, degree, 360), 2);
        assert_eq!(dot_count(0.5, degree, 360), 181);
        assert_eq!(dot_count(1.0, degree, 360), 360, "the cap holds 361 down");
        // Within half a degree, rounding gives the same turn count (`roundf` is `floor(x + 0.5)`).
        assert_eq!(dot_count(0.4 / 360.0, degree, 360), 1);
        assert_eq!(dot_count(0.6 / 360.0, degree, 360), 2);
    }
}
