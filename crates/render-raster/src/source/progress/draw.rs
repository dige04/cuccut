//! `progress_frame`: recipe + two colors + progress value → DrawOp.
//!
//! The signature has the same shape as [`crate::source::visualizer::visualizer_frame`] (`&mut FrameBuilder` + return the op count), so the host's two dispatch branches look alike.
//!
//! ## Units for pixel-valued parameters (the P2 open question is settled here)
//!
//! In the reference implementation, `rounded`'s `corner.radiusPx = 200` and `intervalPx = 5` are **absolute pixels relative to `u_dstRes`**. CucCut converts them with the length convention already fixed in P0: `× short_edge / REFERENCE_SHORT_EDGE(540)`, identical to `strokeWidth` / `cornerRadius` / `lower_element_effects`. Otherwise the corner radius on 4K export would degrade into a near-square corner.
//! After conversion, the value is clamped to within half the short edge, so a 5%-high progress bar is exactly a capsule.
//! The conversion **factor** is passed in by the host ([`ProgressParams::pixel_scale`]). The truth about the reference short edge of 540 lives in `ccut_timeline::REFERENCE_SHORT_EDGE`, but `ccut-render` does not depend on `ccut-timeline` (the dependency graph in §2.3), so writing another 540 here would be a second source of truth.
//!
//! `intervalPx` (and `insetRatio` / `alphaEdge`, and the ring's `featherPx` / `edgeFeatherPx`) describe the shader's **alpha transition band width**. Vector paths get their edges antialiased by the rasterizer, so there is no counterpart. This implementation **does not read** them. P5's WGSL will use them verbatim.

use motion::preset_registry::{CatalogueRecipe, ProgressAspect, RecipeAlgorithm};

use crate::drawop::{Color4, FrameBuilder, Mat6};

use super::recipes;

pub use crate::source::kernel::DrawBox as ProgressBox;

/// Drawing parameters: **already-resolved** two colors, plus the conversion factor for pixel lengths.
///
/// The progress value is not here. It is an explicit input of [`progress_frame`]: the same element is a different picture at different times, and putting it into "parameters" would suggest it is computed once per element, like the colors.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProgressParams {
    pub main_color: Color4,
    pub secondary_color: Color4,
    /// `canvas_short_edge / ccut_timeline::REFERENCE_SHORT_EDGE`, computed by the host (see the module docs). Passing `1.0` gives "raw pixels at a 540 short edge."
    pub pixel_scale: f64,
}

/// One frame of progress → command stream; returns the **number of DrawOps newly pushed**.
///
/// `progress` is computed by the host with `ccut_timeline::geometry::progress_at`; here it is only clamped once as a guard (NaN becomes 0).
///
/// `time` is the **element-local time** (`t − element.start`, in seconds), corresponding to the reference implementation's `u_time`. The styles that read it are `snake_spin` (rotation phase) and the six P5b rainbow / strobe styles (hue cycle / strobe). Element-local time is used rather than the output timeline so that "the same progress bar looks the same wherever it sits on the timeline". `progress` is already determined only by `start` / `end`, so the phase should move with it to stay consistent.
pub fn progress_frame(
    builder: &mut FrameBuilder,
    recipe: &CatalogueRecipe,
    params: &ProgressParams,
    progress: f64,
    time: f64,
    bbox: ProgressBox,
    tf: Mat6,
) -> usize {
    let Some(body) = recipe.progress() else {
        // Routing a visualizer or shape recipe here is a host dispatch error.
        return 0;
    };
    let progress = if progress.is_finite() {
        progress.clamp(0.0, 1.0)
    } else {
        0.0
    };
    let time = if time.is_finite() { time } else { 0.0 };
    // `aspect: "square"` follows the same rule as the visualizer: the largest inscribed square of the box is used, so ring-type styles are perfect circles in any box. `bar` / `frame` use the whole box.
    let bbox = match body.aspect {
        ProgressAspect::Square => bbox.inscribed_square(),
        ProgressAspect::Bar | ProgressAspect::Frame => bbox,
    };

    match body.recipe.algorithm {
        RecipeAlgorithm::BarV1 => recipes::bar_v1::draw(builder, body, params, progress, bbox, tf),
        RecipeAlgorithm::FrameV1 => {
            recipes::frame_v1::draw(builder, body, params, progress, time, bbox, tf)
        }
        RecipeAlgorithm::RingV1 => {
            recipes::ring_v1::draw(builder, body, params, progress, bbox, tf)
        }
        RecipeAlgorithm::SnakeV1 => {
            recipes::snake_v1::draw(builder, body, params, progress, time, bbox, tf)
        }
        // None of the visualizer's seven algorithm names can appear in a progress recipe body. They are rejected at parse time by `RecipeAlgorithm::kind()` (`manifest-invalid`).
        RecipeAlgorithm::SpectrumBarsV1
        | RecipeAlgorithm::PolarBarsV1
        | RecipeAlgorithm::OscilloscopeV1
        | RecipeAlgorithm::SpectrumAreaV1
        | RecipeAlgorithm::DotMatrixV1
        | RecipeAlgorithm::PulseRingsV1
        | RecipeAlgorithm::RibbonsV1
        | RecipeAlgorithm::ConfettiV1 => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drawop::DrawOp;
    use motion::preset_registry::timeline_progress;

    const BOX: ProgressBox = ProgressBox {
        x: 100.0,
        y: 50.0,
        w: 400.0,
        h: 20.0,
    };
    const TF: Mat6 = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

    fn params() -> ProgressParams {
        ProgressParams {
            main_color: [1.0, 0.0, 0.0, 1.0],
            secondary_color: [0.0, 0.0, 1.0, 1.0],
            pixel_scale: 1.0,
        }
    }

    /// Time is fixed at 0: only `snake_spin` reads it, and there is a dedicated test for it.
    fn draw(id: &str, progress: f64) -> FrameBuilder {
        draw_at(id, progress, 0.0)
    }

    fn draw_at(id: &str, progress: f64, time: f64) -> FrameBuilder {
        let mut builder = FrameBuilder::default();
        progress_frame(
            &mut builder,
            timeline_progress(id).expect("样式已登记"),
            &params(),
            progress,
            time,
            BOX,
            TF,
        );
        builder
    }

    /// **All 14 styles draw something** (after P5b there are no empty arms).
    #[test]
    fn every_catalogue_style_draws_something() {
        let styles = motion::preset_registry::timeline_progresses();
        assert_eq!(styles.len(), 14, "14 种 progress 全部登记在目录里");
        for recipe in styles {
            let mut builder = FrameBuilder::default();
            let pushed = progress_frame(&mut builder, recipe, &params(), 0.5, 0.0, BOX, TF);
            assert!(pushed > 0, "{} 必须画出东西", recipe.id);
            assert_eq!(pushed, builder.frame.ops.len(), "{}", recipe.id);
        }
    }

    /// The meaning of `u_time`: only styles that read the clock change over time.
    ///
    /// `snake_spin` (rotation) and the six P5b rainbow / strobe styles read it. The other seven do not.
    #[test]
    fn only_the_time_driven_styles_read_the_clock() {
        let print =
            |id: &str, time: f64| crate::drawop::fingerprint(&draw_at(id, 0.5, time).finish());
        for id in [
            "normal",
            "rounded",
            "border",
            "reverse_border",
            "circle",
            "donut",
            "snake",
        ] {
            assert_eq!(print(id, 0.0), print(id, 1.7), "{id} 不该读时钟");
        }
        for id in [
            "snake_spin",
            "rainbow_border",
            "reverse_rainbow_border",
            "strobe_border",
            "reverse_strobe_border",
            "snake_rainbow",
            "snake_spin_rainbow",
        ] {
            assert_ne!(print(id, 0.0), print(id, 1.7), "{id} 必须读时钟");
        }
    }

    /// Endpoints are exact: 0 leaves only the base color, and 1 fills everything.
    #[test]
    fn the_endpoints_are_exact() {
        for id in ["normal", "rounded", "border", "circle", "donut"] {
            let empty = draw(id, 0.0);
            let full = draw(id, 1.0);
            assert!(!empty.frame.ops.is_empty(), "{id} 的底色总要画");
            assert!(
                full.frame.ops.len() >= empty.frame.ops.len(),
                "{id}: 满进度不该比空进度画得少"
            );
        }
        // `normal` with empty progress is just the base-color bar.
        assert_eq!(draw("normal", 0.0).frame.ops.len(), 1);
        assert_eq!(draw("normal", 1.0).frame.ops.len(), 2);
        // `reverse_border` is the opposite: at full progress the progress ring disappears entirely.
        assert_eq!(draw("reverse_border", 1.0).frame.ops.len(), 1);
        assert_eq!(draw("reverse_border", 0.0).frame.ops.len(), 2);
    }

    /// Invalid progress values do not panic; they are treated as 0.
    #[test]
    fn a_non_finite_progress_reads_as_zero() {
        assert_eq!(
            draw("normal", f64::NAN).frame.ops.len(),
            draw("normal", 0.0).frame.ops.len()
        );
        assert_eq!(
            draw("normal", -5.0).frame.ops.len(),
            draw("normal", 0.0).frame.ops.len()
        );
        let over = draw("normal", 5.0);
        let DrawOp::FillRect { w, .. } = over.frame.ops[1] else {
            unreachable!()
        };
        assert!((f64::from(w) - BOX.w).abs() < 1e-6);
    }

    /// `snake`'s two paths: the base ring (secondary color, full circle) and the progress ring (primary color).
    /// At progress 0 a dot is still kept. The reference implementation's loop "finishes the current turn before it breaks".
    #[test]
    fn the_snake_draws_a_track_ring_and_a_progress_ring() {
        for progress in [0.0, 0.5, 1.0] {
            let builder = draw("snake", progress);
            assert_eq!(builder.frame.ops.len(), 2, "progress={progress}");
            let DrawOp::FillPath { color: track, .. } = builder.frame.ops[0] else {
                unreachable!()
            };
            let DrawOp::FillPath { color: fill, .. } = builder.frame.ops[1] else {
                unreachable!()
            };
            assert_eq!(track, params().secondary_color, "底环用 trackColor");
            assert_eq!(fill, params().main_color);
        }
        // The progress ring grows with progress: the number of path segments never decreases, since each extra sector adds a few more Béziers.
        let segments = |progress: f64| {
            let builder = draw("snake", progress);
            let DrawOp::FillPath { path, .. } = builder.frame.ops[1] else {
                unreachable!()
            };
            builder.frame.paths[path as usize].0.len()
        };
        assert!(segments(0.0) < segments(0.25));
        assert!(segments(0.25) < segments(1.0));
    }

    /// `aspect: "square"`: `snake` drawn in a horizontal bar box is still a perfect circle. Its outer edge reaches the sides of the inscribed square (`orbitRadius + dotRadius == 0.5`), so it does not flatten into an ellipse horizontally.
    #[test]
    fn the_snake_stays_circular_in_a_wide_box() {
        let builder = draw("snake", 1.0);
        let DrawOp::FillPath { path, .. } = builder.frame.ops[0] else {
            unreachable!()
        };
        let center = BOX.center();
        // Points on the curve (`close` has no point; the end points of cubic segments are at pts[4..6]).
        let radii: Vec<f64> = builder.frame.paths[path as usize]
            .0
            .iter()
            .filter_map(|seg| match seg.verb {
                0 | 1 => Some((f64::from(seg.pts[0]), f64::from(seg.pts[1]))),
                3 => Some((f64::from(seg.pts[4]), f64::from(seg.pts[5]))),
                _ => None,
            })
            .map(|(x, y)| ((x - center.0).powi(2) + (y - center.1).powi(2)).sqrt())
            .collect();
        let outer = radii.iter().cloned().fold(f64::MIN, f64::max);
        // `orbitRadius + dotRadius == 0.5` ⇒ the outer edge touches exactly the **sides of the inscribed square**, not the long sides of the bar box (which would flatten it into an ellipse).
        assert!((outer - BOX.h / 2.0).abs() < 1e-3, "{outer}");
        assert!(outer < BOX.w / 2.0);
    }

    /// `snake` with `spin: null` does not depend on time. `snake_spin` differs at each moment, and it returns to its starting position every `360 / speedDegPerSec` seconds (the period of `mod`).
    #[test]
    fn only_the_spinning_snake_reads_the_clock() {
        let print =
            |id: &str, time: f64| crate::drawop::fingerprint(&draw_at(id, 0.5, time).finish());
        assert_eq!(print("snake", 0.0), print("snake", 1.7));
        assert_ne!(print("snake_spin", 0.0), print("snake_spin", 1.7));
        // 50 °/s ⇒ one full turn every 7.2 s.
        assert_eq!(print("snake_spin", 0.0), print("snake_spin", 7.2));
        // Non-finite times are treated as 0 and do not panic.
        assert_eq!(print("snake_spin", f64::NAN), print("snake_spin", 0.0));
    }

    /// Using a visualizer recipe to draw progress is a host dispatch error: it returns 0 and does not panic.
    #[test]
    fn a_visualizer_recipe_draws_nothing_instead_of_panicking() {
        let recipe = motion::preset_registry::timeline_visualizer("bars").unwrap();
        let mut builder = FrameBuilder::default();
        assert_eq!(
            progress_frame(&mut builder, recipe, &params(), 0.5, 0.0, BOX, TF),
            0
        );
    }
}
