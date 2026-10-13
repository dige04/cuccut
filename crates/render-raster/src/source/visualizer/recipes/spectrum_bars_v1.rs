//! `spectrum-bars-v1`: `bars` / `bars_rounded` / `bars_bottom` (design §7.2).
//!
//! The classic spectrum bars: the usable bins are split into `barCount` slots; each bar's height is the spectrum amplitude at the slot centre, shaped by `easing` and then taking the larger of that and `minHeight` (at silence, a row of short bars stays, so the element does not "disappear"). The three styles are told apart entirely by parameters:
//!
//! | Style | `barCount` | `align` | `gap` | `radius` | `minHeight` |
//! | --- | --- | --- | --- | --- | --- |
//! | `bars` | 48 | mirror | 0.35 | 0 | 0.02 |
//! | `bars_rounded` | 32 | mirror | 0.45 | 1 | 0.06 |
//! | `bars_bottom` | 64 | bottom | 0.25 | 0 | 0.02 |
//!
//! * `align: mirror` is symmetric above and below the box's centre line; `bottom` grows upward from the bottom of the box;
//! * `gap` is a **fraction of the slot width** (0 = bars fill the slot), and each bar is centred within its slot;
//! * `radius` is the corner radius as a fraction of "half of the smaller of bar width and bar height" — `1` gives a capsule with fully rounded ends, and no height produces self-intersecting corners.
//!
//! One `FillRect` per bar; returns `barCount`. Uses the primary colour only.

use motion::preset_registry::VisualizerBody;

use crate::drawop::{DrawOp, FrameBuilder, Mat6};
use crate::source::kernel::{DrawBox, sample_row_linear};
use crate::source::visualizer::{VisualizerParams, VizFrame, freq_row};

use super::common::easing_of;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Align {
    Mirror,
    Bottom,
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
    let (Some(bar_count), Some(align), Some(gap), Some(radius), Some(min_height)) = (
        recipe.integer("barCount"),
        recipe.text("align").and_then(|name| match name {
            "mirror" => Some(Align::Mirror),
            "bottom" => Some(Align::Bottom),
            _ => None,
        }),
        recipe.number("gap"),
        recipe.number("radius"),
        recipe.number("minHeight"),
    ) else {
        return 0;
    };
    let easing = easing_of(recipe);
    let bar_count = bar_count as usize;
    if bar_count == 0 || !(bbox.w > 0.0 && bbox.h > 0.0) {
        return 0;
    }
    let row = freq_row(viz, body.bin_width);
    let slot = bbox.w / bar_count as f64;
    let bar_w = slot * (1.0 - gap.clamp(0.0, 1.0));
    if !(bar_w > 0.0) {
        return 0;
    }
    let mut pushed = 0;
    for index in 0..bar_count {
        let u = (index as f64 + 0.5) / bar_count as f64;
        let amplitude = easing
            .apply(sample_row_linear(row, u))
            .max(min_height)
            .clamp(0.0, 1.0);
        let h = amplitude * bbox.h;
        if !(h > 0.0) {
            continue;
        }
        let x = bbox.x + slot * index as f64 + (slot - bar_w) / 2.0;
        let y = match align {
            Align::Mirror => bbox.y + (bbox.h - h) / 2.0,
            Align::Bottom => bbox.y + bbox.h - h,
        };
        let corner = radius.clamp(0.0, 1.0) * (bar_w.min(h) / 2.0);
        builder.push(DrawOp::FillRect {
            x: x as f32,
            y: y as f32,
            w: bar_w as f32,
            h: h as f32,
            radius: corner as f32,
            color: params.main_color,
            tf,
        });
        pushed += 1;
    }
    pushed
}
