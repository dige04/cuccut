//! `visualizer_frame`: recipe + parameters + one frame of spectrum → DrawOp (ADR-E04's "pure drawing function").
//!
//! After the September 2026 redesign, the audio visualizer has **10 styles across 7 algorithm names**, all of them CPU vector recipes (catalog in the module docs of [`recipes`]). There is no GPU-side visualizer shader: the visualizer WGSL list in design §8.6 is retired as a whole, and the wgpu backend composites the visualizer as an ordinary vector layer.
//!
//! ## Three deliberate choices in the signature
//!
//! 1. **`&mut FrameBuilder` instead of `-> Vec<DrawOp>`** (ADR-E04 wrote the latter). `DrawOp::FillPath` / `StrokePath`'s `path` is an **index into a side table**, and only the builder can assign those numbers. The bar-type styles use only `FillRect`, and the other six algorithms all need paths. The already-landed counterpart, `element_draw::push_shape_ops`, has the same shape, so the two stay consistent.
//! 2. **The recipe type is `motion::preset_registry::CatalogueRecipe` directly.** `ccut-render` already depends on `ccut-motion`, and recipes are data, not code. Copying them into a "render-side recipe" would give the 10 manifests two readings.
//! 3. **The parameter type is this crate's own [`VisualizerParams`], not `ccut_timeline::schema::VisualizerProps`.** `ccut-render` **does not depend on** `ccut-timeline` (the dependency graph recorded in plan §2.3), and adding that edge would make the rendering layer know the product timeline's schema. The mapping (including falling back to the recipe's `defaultMainColor` and so on when a value is unset) is the host's job. `element_draw` in `apps/cli` does this step.
//!
//! Color and coordinate conventions are identical to `element_draw`: path points are **absolute canvas pixels**, and `tf` carries only the pose (rotation, mirroring, animation) around the center of the element box. `Color4` is non-premultiplied, 0..1.
//!
//! ## Silence semantics
//!
//! When silent (frequency rows all 0, time-domain rows 128), **every style still draws something**. Bars keep short columns at `minHeight`, the dot matrix keeps a row of base lights, the oscilloscope draws a straight line or a circle, the pulse ring stays at its rest position, and the ribbons degenerate to a centerline. The element does not vanish from the picture during silent stretches. Whether `alwaysShow` is visible is decided by compositing (`frame-render`).

use motion::preset_registry::{CatalogueRecipe, RecipeAlgorithm, VisualizerAspect};

use crate::drawop::{Color4, FrameBuilder, Mat6};

use super::VizFrame;
use super::recipes;

pub use crate::source::kernel::DrawBox as VizBox;

/// Drawing parameters: **already-resolved** colors. The host reads them from `VisualizerProps` and falls back to the recipe's `defaultMainColor` / `defaultSecondaryColor` when unset.
///
/// The dB window, smoothing and gain are **not here**. They are baked into [`super::VizTrack`] during preflight (step 2 of the ADR-E04 data flow). Reading them again at draw time would produce "one set for derivation and another for drawing".
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VisualizerParams {
    pub main_color: Color4,
    pub secondary_color: Color4,
}

/// One frame of visualizer → command stream; returns the **number of DrawOps newly pushed**.
///
/// A return value of `0` means "nothing to draw for this style this frame" (for example, a zero-size box). All 10 styles have drawing implementations, so the host's placeholder branch now covers only one real failure: "no spectrum track".
///
/// `time` is the **element-local time** (`t − element.start`, in seconds), corresponding to the reference implementation's `u_time`. The convention is the same as [`crate::source::progress::progress_frame`] (§13 P4 deviation 9): moving the same element elsewhere on the timeline leaves what is drawn unchanged. Currently only `ribbons-v1` (the ribbon phase) reads it.
pub fn visualizer_frame(
    builder: &mut FrameBuilder,
    recipe: &CatalogueRecipe,
    params: &VisualizerParams,
    viz: &VizFrame,
    time: f64,
    bbox: VizBox,
    tf: Mat6,
) -> usize {
    let Some(body) = recipe.visualizer() else {
        // Routing a progress or shape recipe here is a host dispatch error, not a data error.
        return 0;
    };
    // `aspect: "square"` is a **geometric constraint declared by the recipe**: the style is drawn in the largest inscribed square of the box, so circular styles are perfect circles in any element box rather than ellipses. (The default geometry table's "30% of frame width × 30% of frame height" is not a pixel square at 16:9.)
    let bbox = match body.aspect {
        VisualizerAspect::Square => bbox.inscribed_square(),
        VisualizerAspect::Free => bbox,
    };

    match body.recipe.algorithm {
        RecipeAlgorithm::SpectrumBarsV1 => {
            recipes::spectrum_bars_v1::draw(builder, body, params, viz, bbox, tf)
        }
        RecipeAlgorithm::PolarBarsV1 => {
            recipes::polar_bars_v1::draw(builder, body, params, viz, bbox, tf)
        }
        RecipeAlgorithm::OscilloscopeV1 => {
            recipes::oscilloscope_v1::draw(builder, body, params, viz, bbox, tf)
        }
        RecipeAlgorithm::SpectrumAreaV1 => {
            recipes::spectrum_area_v1::draw(builder, body, params, viz, bbox, tf)
        }
        RecipeAlgorithm::DotMatrixV1 => {
            recipes::dot_matrix_v1::draw(builder, body, params, viz, bbox, tf)
        }
        RecipeAlgorithm::PulseRingsV1 => {
            recipes::pulse_rings_v1::draw(builder, body, params, viz, bbox, tf)
        }
        RecipeAlgorithm::RibbonsV1 => {
            recipes::ribbons_v1::draw(builder, body, params, viz, time, bbox, tf)
        }
        // Progress and confetti algorithm names cannot appear in a visualizer recipe body. They are already rejected at recipe parse time by `RecipeAlgorithm::kind()` (`manifest-invalid`).
        RecipeAlgorithm::BarV1
        | RecipeAlgorithm::FrameV1
        | RecipeAlgorithm::RingV1
        | RecipeAlgorithm::SnakeV1
        | RecipeAlgorithm::ConfettiV1 => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drawop::DrawOp;

    fn frame() -> VizFrame {
        VizFrame {
            time: vec![128; 128].into_boxed_slice(),
            freq: vec![200; 512].into_boxed_slice(),
        }
    }

    fn silence() -> VizFrame {
        VizFrame {
            time: vec![128; 128].into_boxed_slice(),
            freq: vec![0; 512].into_boxed_slice(),
        }
    }

    /// One frame with a rising and falling waveform, plus a spectrum that is high in the first half and low in the second half.
    fn shaped() -> VizFrame {
        let time: Vec<u8> = (0..128)
            .map(|i| {
                let phase = f64::from(i) / 128.0 * std::f64::consts::TAU;
                (128.0 + 100.0 * phase.sin()).round() as u8
            })
            .collect();
        let freq: Vec<u8> = (0..512).map(|i| if i < 32 { 240 } else { 20 }).collect();
        VizFrame {
            time: time.into_boxed_slice(),
            freq: freq.into_boxed_slice(),
        }
    }

    fn params() -> VisualizerParams {
        VisualizerParams {
            main_color: [1.0, 1.0, 1.0, 1.0],
            secondary_color: [0.0, 0.0, 0.0, 1.0],
        }
    }

    const BOX: VizBox = VizBox {
        x: 10.0,
        y: 20.0,
        w: 100.0,
        h: 50.0,
    };
    const TF: Mat6 = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

    fn style(id: &str) -> &'static CatalogueRecipe {
        motion::preset_registry::timeline_visualizer(id).expect("style is registered")
    }

    fn draw(id: &str, viz: &VizFrame) -> FrameBuilder {
        draw_at(id, viz, 0.0)
    }

    fn draw_at(id: &str, viz: &VizFrame, time: f64) -> FrameBuilder {
        let mut builder = FrameBuilder::default();
        visualizer_frame(&mut builder, style(id), &params(), viz, time, BOX, TF);
        builder
    }

    fn rects(builder: &FrameBuilder) -> Vec<(f32, f32, f32, f32, f32)> {
        builder
            .frame
            .ops
            .iter()
            .filter_map(|op| match op {
                DrawOp::FillRect {
                    x, y, w, h, radius, ..
                } => Some((*x, *y, *w, *h, *radius)),
                _ => None,
            })
            .collect()
    }

    fn count<F: Fn(&DrawOp) -> bool>(builder: &FrameBuilder, pred: F) -> usize {
        builder.frame.ops.iter().filter(|op| pred(op)).count()
    }

    /// **All 10 styles draw something**, and the return value is the number of ops pushed. This holds even in silence.
    #[test]
    fn every_catalogue_style_draws_something_even_in_silence() {
        let styles = motion::preset_registry::timeline_visualizers();
        assert_eq!(styles.len(), 10, "all 10 sound wave styles are registered in the catalog");
        for recipe in styles {
            for viz in [frame(), silence(), shaped()] {
                let mut builder = FrameBuilder::default();
                let pushed = visualizer_frame(&mut builder, recipe, &params(), &viz, 0.0, BOX, TF);
                assert!(pushed > 0, "{} must draw something", recipe.id);
                assert_eq!(pushed, builder.frame.ops.len(), "{}", recipe.id);
            }
        }
    }

    /// Old ids are folded into the new styles through the alias table, and the output is identical item by item.
    #[test]
    fn legacy_ids_draw_through_the_alias_table() {
        for (old, new) in [
            ("trio_wave", "bars"),
            ("formation_rounded", "bars_rounded"),
            ("static", "bars_bottom"),
            ("formation_circle", "ring_bars"),
            ("beam", "oscilloscope"),
            ("harmony", "ribbons"),
            ("frequency_lines", "dots"),
            ("ripple_wave", "pulse_rings"),
        ] {
            let a = crate::drawop::fingerprint(&draw(old, &shaped()).finish());
            let b = crate::drawop::fingerprint(&draw(new, &shaped()).finish());
            assert_eq!(a, b, "{old} → {new}");
        }
    }

    /// The meaning of `u_time` (§13 P4 deviation 9): only `ribbons` changes over time.
    #[test]
    fn only_the_ribbons_read_the_clock() {
        let print =
            |id: &str, time: f64| crate::drawop::fingerprint(&draw_at(id, &frame(), time).finish());
        for recipe in motion::preset_registry::timeline_visualizers() {
            let id = recipe.id.as_str();
            let same = print(id, 0.0) == print(id, 1.3);
            assert_eq!(same, id != "ribbons", "{id}");
        }
    }

    /// Column count, corner radius and alignment all come from the manifest.
    #[test]
    fn the_bar_family_follows_the_manifest() {
        let bars = rects(&draw("bars", &frame()));
        assert_eq!(bars.len(), 48);
        assert!(bars.iter().all(|r| r.4 == 0.0), "bars have no rounded corners");
        // mirror: the columns are symmetric about the box's center line.
        for (_, y, _, h, _) in &bars {
            assert!((y + h / 2.0 - 45.0).abs() < 1e-3, "y={y} h={h}");
        }

        let rounded = rects(&draw("bars_rounded", &frame()));
        assert_eq!(rounded.len(), 32);
        for (_, _, w, h, radius) in &rounded {
            assert!(
                (radius - w.min(*h) / 2.0).abs() < 1e-4,
                "capsule: radius = half the short side"
            );
        }

        let bottom = rects(&draw("bars_bottom", &frame()));
        assert_eq!(bottom.len(), 64);
        for (_, y, _, h, _) in &bottom {
            assert!((y + h - 70.0).abs() < 1e-3, "flush to bottom: y+h = box bottom");
        }
    }

    /// In silence only short columns at `minHeight` remain. With sound, the columns grow taller, without exceeding the box.
    #[test]
    fn silence_leaves_the_minimum_bars() {
        let quiet = rects(&draw("bars", &silence()));
        assert!(
            quiet.iter().all(|r| (r.3 - 1.0).abs() < 1e-4),
            "0.02 × 50 = 1"
        );
        let loud = rects(&draw("bars", &frame()));
        assert!(loud.iter().all(|r| r.3 > 30.0 && r.3 <= 50.0), "{loud:?}");
    }

    /// `gap` is a fraction of the slot width: column width = slot width × (1 − gap), and each column is centered in its slot.
    #[test]
    fn the_gap_is_a_fraction_of_the_slot() {
        let bottom = rects(&draw("bars_bottom", &frame()));
        let slot = 100.0 / 64.0;
        for (index, (x, _, w, _, _)) in bottom.iter().enumerate() {
            assert!((w - slot * 0.75).abs() < 1e-4);
            let expected = 10.0 + slot * index as f32 + slot * 0.125;
            assert!((x - expected).abs() < 1e-3, "{index}: {x} vs {expected}");
        }
    }

    /// The `square` recipe is drawn within the inscribed square: `ring_bars`' sectors all fall within x ∈ [35, 85].
    #[test]
    fn the_square_aspect_draws_inside_the_inscribed_square() {
        let builder = draw("ring_bars", &frame());
        assert_eq!(
            count(&builder, |op| matches!(op, DrawOp::FillPath { .. })),
            72
        );
        for path in &builder.frame.paths {
            for seg in &path.0 {
                if seg.verb == 4 {
                    continue;
                }
                let xs = [seg.pts[0], seg.pts[2], seg.pts[4]];
                let ys = [seg.pts[1], seg.pts[3], seg.pts[5]];
                let n = match seg.verb {
                    0 | 1 => 1,
                    3 => 3,
                    _ => 0,
                };
                for i in 0..n {
                    assert!(
                        (34.9..=85.1).contains(&xs[i]) && (19.9..=70.1).contains(&ys[i]),
                        "({}, {})",
                        xs[i],
                        ys[i]
                    );
                }
            }
        }
    }

    /// The oscilloscope reads the time-domain row. In silence it is a flat centerline, and any waveform moves away from it.
    #[test]
    fn the_oscilloscope_reads_the_time_row() {
        let flat = draw("oscilloscope", &silence());
        assert_eq!(
            count(&flat, |op| matches!(op, DrawOp::StrokePath { .. })),
            1
        );
        let path = &flat.frame.paths[0].0;
        assert_eq!(path.len(), 128, "samples come from the manifest");
        assert!(path.iter().all(|seg| (seg.pts[1] - 45.0).abs() < 1e-3));

        let wavy = draw("oscilloscope", &shaped());
        let path = &wavy.frame.paths[0].0;
        let (min, max) = path.iter().fold((f32::MAX, f32::MIN), |(lo, hi), seg| {
            (lo.min(seg.pts[1]), hi.max(seg.pts[1]))
        });
        assert!(min < 30.0 && max > 60.0, "min={min} max={max}");
        assert!(min >= 20.0 && max <= 70.0, "stays inside the box");
    }

    /// `ring_wave` is a closed polar oscilloscope. In silence it is the base circle, and the path closes with `close`.
    #[test]
    fn the_ring_wave_closes_around_the_base_circle() {
        let flat = draw("ring_wave", &silence());
        let path = &flat.frame.paths[0].0;
        assert_eq!(path.last().map(|seg| seg.verb), Some(4));
        assert_eq!(path.len(), 129);
        let (cx, cy) = (60.0f32, 45.0f32);
        for seg in path.iter().filter(|seg| seg.verb != 4) {
            let r = ((seg.pts[0] - cx).powi(2) + (seg.pts[1] - cy).powi(2)).sqrt();
            assert!(
                (r - 15.0).abs() < 1e-2,
                "baseRadius 0.6 × 25 = 15, read {r}"
            );
        }
    }

    /// Area chart: one fill and one stroke. The fill closes down to the bottom of the box.
    #[test]
    fn the_spectrum_area_fills_down_to_the_bottom_edge() {
        let builder = draw("spectrum_area", &frame());
        assert!(
            matches!(builder.frame.ops[0], DrawOp::FillPath { color, .. } if color == [1.0; 4])
        );
        assert!(matches!(
            builder.frame.ops[1],
            DrawOp::StrokePath { color, width, .. } if color == [0.0, 0.0, 0.0, 1.0] && (width - 1.0).abs() < 1e-5
        ));
        let area = &builder.frame.paths[0].0;
        assert_eq!(area.len(), 64 + 3);
        assert_eq!(area[64].pts[1], 70.0);
        assert_eq!(area[65].pts[1], 70.0);
        assert_eq!(area[66].verb, 4);
    }

    /// Dot matrix: the column count comes from the manifest. The top dot of each column uses the secondary color, and silence still leaves a row of base lights.
    #[test]
    fn the_dot_matrix_lights_a_peak_per_column() {
        let loud = draw("dots", &frame());
        let peaks = count(
            &loud,
            |op| matches!(op, DrawOp::FillRect { color, .. } if *color == [0.0, 0.0, 0.0, 1.0]),
        );
        assert_eq!(peaks, 32);
        assert!(
            loud.frame.ops.len() > 32 * 4,
            "200/255 lights up most of the way through easeOutQuad"
        );

        let quiet = draw("dots", &silence());
        assert_eq!(quiet.frame.ops.len(), 32, "one base light per column");
        assert!(
            rects(&quiet)
                .iter()
                .all(|r| (r.1 + r.3 / 2.0 - (70.0 - 50.0 / 16.0)).abs() < 1e-3)
        );
    }

    /// Pulse ring: a disc plus `bands` rings. In silence it stays at its rest position, and with sound it is pushed outward.
    #[test]
    fn the_pulse_rings_expand_with_the_bands() {
        let radius_of = |builder: &FrameBuilder, index: usize| -> f32 {
            let seg = &builder.frame.paths[index].0[0];
            // The ring starts from straight up: center (60, 45), with the move point at (60, 45 − r).
            45.0 - seg.pts[1]
        };
        let quiet = draw("pulse_rings", &silence());
        assert_eq!(quiet.frame.ops.len(), 5);
        assert!(
            (radius_of(&quiet, 0) - 0.22 * 25.0).abs() < 1e-3,
            "the disc stops at coreRadius"
        );
        let loud = draw("pulse_rings", &frame());
        assert!(radius_of(&loud, 0) > radius_of(&quiet, 0));
        for band in 1..=4 {
            assert!(radius_of(&loud, band) > radius_of(&quiet, band), "{band}");
            assert!(radius_of(&loud, band) <= 0.9 * 25.0 + 0.035 * 25.0 / 2.0 + 1e-3);
        }
    }

    /// Ribbons: the number of strands and the sample points come from the manifest. The color fades from the primary to the secondary.
    #[test]
    fn the_ribbons_blend_from_main_to_secondary() {
        let builder = draw("ribbons", &shaped());
        let colors: Vec<Color4> = builder
            .frame
            .ops
            .iter()
            .filter_map(|op| match op {
                DrawOp::StrokePath { color, .. } => Some(*color),
                _ => None,
            })
            .collect();
        assert_eq!(
            colors,
            vec![[1.0; 4], [0.5, 0.5, 0.5, 1.0], [0.0, 0.0, 0.0, 1.0]]
        );
        assert!(builder.frame.paths.iter().all(|path| path.0.len() == 96));
    }

    /// A progress recipe reaching the visualizer entry: returns 0 and does not panic.
    #[test]
    fn a_progress_recipe_draws_nothing_instead_of_panicking() {
        let recipe = motion::preset_registry::timeline_progress("normal").expect("registered");
        let mut builder = FrameBuilder::default();
        assert_eq!(
            visualizer_frame(&mut builder, recipe, &params(), &frame(), 0.0, BOX, TF),
            0
        );
        assert!(builder.frame.ops.is_empty());
    }
}
