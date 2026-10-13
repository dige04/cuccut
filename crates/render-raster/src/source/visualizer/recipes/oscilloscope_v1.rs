//! `oscilloscope-v1`: `oscilloscope` / `ring_wave` (design §7.2).
//!
//! The only algorithm that reads the **time-domain row**: it samples one waveform frame at `samples` points and strokes it as a polyline.
//! Waveform bytes use [`TIME_DOMAIN_SILENCE`] (128) as the zero point; `amplitude` is the fraction of half the box height (or of the radial band) that a full-scale swing covers.
//!
//! | Style | `layout` | `samples` | `lineWidth` | `amplitude` | `baseRadius` |
//! | --- | --- | --- | --- | --- | --- |
//! | `oscilloscope` | linear | 128 | 0.02 | 0.9 | 0 |
//! | `ring_wave` | polar | 128 | 0.015 | 0.6 | 0.6 |
//!
//! * `linear`: spans the box width and swings above and below the box's centre line;
//! * `polar`: goes once around the inscribed circle (clockwise from the top), base radius `baseRadius × R`, swing within `[baseRadius, 1] × R`, and the path closes into a ring.
//!
//! Silence also draws a straight line / a circle — when the oscilloscope has no signal, the screen shows just that line.
//! One `StrokePath` (width `lineWidth × box height`), returns 1. Uses the primary colour only.

use motion::preset_registry::VisualizerBody;

use crate::drawop::{FrameBuilder, Mat6};
use crate::source::kernel::{DrawBox, MID_V, polar, sample_row_linear};
use crate::source::visualizer::{TIME_DOMAIN_SILENCE, VisualizerParams, VizFrame, time_row};

use super::common::{polyline, push_stroke};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Layout {
    Linear,
    Polar,
}

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &VisualizerBody,
    params: &VisualizerParams,
    viz: &VizFrame,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(layout), Some(samples), Some(line_width), Some(amplitude), Some(base_radius)) = (
        recipe.text("layout").and_then(|name| match name {
            "linear" => Some(Layout::Linear),
            "polar" => Some(Layout::Polar),
            _ => None,
        }),
        recipe.integer("samples"),
        recipe.number("lineWidth"),
        recipe.number("amplitude"),
        recipe.number("baseRadius"),
    ) else {
        return 0;
    };
    let samples = samples as usize;
    if samples < 2 || !(bbox.w > 0.0 && bbox.h > 0.0) {
        return 0;
    }
    let row = time_row(viz, body.bin_width);
    let zero = f64::from(TIME_DOMAIN_SILENCE) / f64::from(u8::MAX);
    // Waveform value: [-1, 1] with the silence level as zero, then multiplied by the swing.
    let value = |u: f64| ((sample_row_linear(&row, u) - zero) * 2.0 * amplitude).clamp(-1.0, 1.0);

    let points: Vec<(f64, f64)> = match layout {
        Layout::Linear => (0..samples)
            .map(|index| {
                let u = index as f64 / (samples - 1) as f64;
                bbox.at(u, MID_V + value(u) * MID_V)
            })
            .collect(),
        Layout::Polar => {
            let radius = bbox.w.min(bbox.h) / 2.0;
            let base = base_radius.clamp(0.0, 1.0) * radius;
            let center = bbox.center();
            (0..samples)
                .map(|index| {
                    // Closed loop: the last point does not coincide with the first, so `close` closes it.
                    let u = index as f64 / samples as f64;
                    let r = (base + value(u) * (radius - base)).max(0.0);
                    polar(center, r, u * std::f64::consts::TAU)
                })
                .collect()
        }
    };
    let path = polyline(&points, layout == Layout::Polar);
    let width = line_width.clamp(0.0, 1.0) * bbox.h;
    usize::from(push_stroke(builder, path, params.main_color, width, tf))
}
