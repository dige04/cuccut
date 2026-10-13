//! `dot-matrix-v1`: `dots` (design §7.2).
//!
//! An LED dot-matrix spectrum: the box is split into `columns × rows` cells. For each column, the spectrum amplitude, shaped by `easing`, decides how many rows light up from the bottom (rounded to whole rows, **at least one row** — in silence one row of base lights stays on, so the element does not disappear). Lit dots use the primary colour (`Dots`); the highest dot in each column uses the secondary colour (`Peaks`).
//!
//! `dotRadius` is the dot radius as a fraction of the **cell side length (the smaller of width and height)**. Each dot is one `FillRect` with fully rounded corners (a circle); returns the total number of lit dots.

use motion::preset_registry::VisualizerBody;

use crate::drawop::{DrawOp, FrameBuilder, Mat6};
use crate::source::kernel::{DrawBox, sample_row_linear};
use crate::source::visualizer::{VisualizerParams, VizFrame, freq_row};

use super::common::easing_of;

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &VisualizerBody,
    params: &VisualizerParams,
    viz: &VizFrame,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(columns), Some(rows), Some(dot_radius)) = (
        recipe.integer("columns"),
        recipe.integer("rows"),
        recipe.number("dotRadius"),
    ) else {
        return 0;
    };
    let easing = easing_of(recipe);
    let (columns, rows) = (columns as usize, rows as usize);
    if columns == 0 || rows == 0 || !(bbox.w > 0.0 && bbox.h > 0.0) {
        return 0;
    }
    let row = freq_row(viz, body.bin_width);
    let cell_w = bbox.w / columns as f64;
    let cell_h = bbox.h / rows as f64;
    let radius = dot_radius.clamp(0.0, 1.0) * cell_w.min(cell_h);
    if !(radius > 0.0) {
        return 0;
    }
    let mut pushed = 0;
    for column in 0..columns {
        let u = (column as f64 + 0.5) / columns as f64;
        let amplitude = easing.apply(sample_row_linear(row, u)).clamp(0.0, 1.0);
        let lit = ((amplitude * rows as f64).round() as usize).clamp(1, rows);
        let cx = bbox.x + cell_w * (column as f64 + 0.5);
        for level in 0..lit {
            let cy = bbox.y + bbox.h - cell_h * (level as f64 + 0.5);
            let color = if level + 1 == lit {
                params.secondary_color
            } else {
                params.main_color
            };
            builder.push(DrawOp::FillRect {
                x: (cx - radius) as f32,
                y: (cy - radius) as f32,
                w: (radius * 2.0) as f32,
                h: (radius * 2.0) as f32,
                radius: radius as f32,
                color,
                tf,
            });
            pushed += 1;
        }
    }
    pushed
}
