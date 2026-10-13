//! `spectrum-area-v1`: `spectrum_area` (design §7.2).
//!
//! An **area chart** of the spectrum envelope: across the box width, it takes the spectrum amplitude at `samples` points (shaped by `easing`, and taking the larger of that and `minHeight`), connects the points into a polyline, closes it down to the bottom of the box and fills with the primary colour, then strokes an edge along the same polyline with the secondary colour (width `lineWidth × box height`). The two colour labels are `Fill` / `Line`.
//!
//! One `FillPath` + one `StrokePath`; returns 2.

use motion::preset_registry::VisualizerBody;

use crate::drawop::{FrameBuilder, Mat6};
use crate::source::kernel::{DrawBox, path_seg_close, path_seg_line, sample_row_linear};
use crate::source::visualizer::{VisualizerParams, VizFrame, freq_row};

use super::common::{easing_of, polyline, push_fill, push_stroke};

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &VisualizerBody,
    params: &VisualizerParams,
    viz: &VizFrame,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(samples), Some(min_height), Some(line_width)) = (
        recipe.integer("samples"),
        recipe.number("minHeight"),
        recipe.number("lineWidth"),
    ) else {
        return 0;
    };
    let easing = easing_of(recipe);
    let samples = samples as usize;
    if samples < 2 || !(bbox.w > 0.0 && bbox.h > 0.0) {
        return 0;
    }
    let row = freq_row(viz, body.bin_width);
    let points: Vec<(f64, f64)> = (0..samples)
        .map(|index| {
            let u = index as f64 / (samples - 1) as f64;
            let amplitude = easing
                .apply(sample_row_linear(row, u))
                .max(min_height)
                .clamp(0.0, 1.0);
            bbox.at(u, amplitude)
        })
        .collect();

    let mut area = polyline(&points, false);
    let (left, bottom) = bbox.at(0.0, 0.0);
    let (right, _) = bbox.at(1.0, 0.0);
    area.push(path_seg_line(right, bottom));
    area.push(path_seg_line(left, bottom));
    area.push(path_seg_close());
    let mut pushed = usize::from(push_fill(builder, area, params.main_color, tf));

    let width = line_width.clamp(0.0, 1.0) * bbox.h;
    pushed += usize::from(push_stroke(
        builder,
        polyline(&points, false),
        params.secondary_color,
        width,
        tf,
    ));
    pushed
}
