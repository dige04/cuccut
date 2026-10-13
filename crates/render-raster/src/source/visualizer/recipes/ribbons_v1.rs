//! `ribbons-v1`: `ribbons` (design §7.2).
//!
//! `ribbonCount` sinusoidal ribbons span the box width and swing around the box's centre line. The usable bins are split into `ribbonCount` segments; the swing of ribbon `j` is the average amplitude of segment `j` (as a fraction of half the box height). The phase flows with the **element's local time** (`speed` is the number of cycles per second), `cycles` is the number of cycles across the box width, and the initial phases of the ribbons are spaced evenly across one full turn. The swing is further multiplied by `sin(π·u)`, so the ribbons pinch toward the centre line at the left and right ends of the box, which is the classic form of this kind of visual. Colour interpolates linearly from the primary colour (first ribbon) to the secondary colour (last ribbon), with labels `Ribbon A` / `Ribbon B`.
//!
//! At silence the ribbons have zero swing and collapse into `ribbonCount` coincident centre lines. **The only algorithm that reads the clock**: the same spectrum frame draws different phases at different times. One `StrokePath` per ribbon (width `lineWidth × box height`); returns `ribbonCount`.

use motion::preset_registry::VisualizerBody;

use crate::drawop::{FrameBuilder, Mat6};
use crate::source::kernel::{DrawBox, MID_V};
use crate::source::visualizer::{VisualizerParams, VizFrame, freq_row};

use super::common::{band_amplitude, mix_color, polyline, push_stroke};

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &VisualizerBody,
    params: &VisualizerParams,
    viz: &VizFrame,
    time: f64,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(count), Some(samples), Some(line_width), Some(speed), Some(cycles)) = (
        recipe.integer("ribbonCount"),
        recipe.integer("samples"),
        recipe.number("lineWidth"),
        recipe.number("speed"),
        recipe.number("cycles"),
    ) else {
        return 0;
    };
    let (count, samples) = (count as usize, samples as usize);
    if count == 0 || samples < 2 || !(bbox.w > 0.0 && bbox.h > 0.0) {
        return 0;
    }
    let row = freq_row(viz, body.bin_width);
    let width = line_width.clamp(0.0, 1.0) * bbox.h;
    let tau = std::f64::consts::TAU;
    let mut pushed = 0;
    for ribbon in 0..count {
        let from = ribbon as f64 / count as f64;
        let to = (ribbon as f64 + 1.0) / count as f64;
        let amplitude = band_amplitude(row, from, to).clamp(0.0, 1.0);
        let phase = tau * from - tau * speed * time;
        let points: Vec<(f64, f64)> = (0..samples)
            .map(|index| {
                let u = index as f64 / (samples - 1) as f64;
                let window = (std::f64::consts::PI * u).sin();
                let swing = amplitude * window * (tau * cycles * u + phase).sin();
                bbox.at(u, MID_V + swing * MID_V)
            })
            .collect();
        let t = if count > 1 {
            ribbon as f64 / (count - 1) as f64
        } else {
            0.0
        };
        let color = mix_color(params.main_color, params.secondary_color, t);
        pushed += usize::from(push_stroke(
            builder,
            polyline(&points, false),
            color,
            width,
            tf,
        ));
    }
    pushed
}
