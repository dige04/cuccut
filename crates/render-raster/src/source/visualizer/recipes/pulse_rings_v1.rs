//! `pulse-rings-v1`: `pulse_rings` (design §7.2).
//!
//! A central disc that breathes with the low frequencies (`Core`, primary colour), plus `bands` concentric rings that expand outward with their own frequency bands (`Rings`, secondary colour). The usable bins are split into `bands` segments; the average amplitude of segment `k` drives ring `k` through `easing`; the disc follows segment 0 (the lowest frequencies).
//!
//! Radial layout (`R` is the half-side of the inscribed square; the recipe declares `aspect: square`):
//!
//! ```text
//! step   = (ringRadius − coreRadius) / (bands + 1)      // one radial slot per ring; the disc also takes one
//! core   = R · (coreRadius + step · a₀)                  // the disc breathes within its own slot
//! ring_k = R · (coreRadius + step · (k + 1) + step · a_k) // evenly spaced at silence, pushed outward when there is sound
//! ```
//!
//! Ring width `ringWidth × R` (centred on `ring_k`). At silence the disc rests at `coreRadius` and the rings rest at their static positions, so the picture stays complete. One disc `FillPath` plus `bands` ring `FillPath`s; returns `bands + 1`.

use motion::preset_registry::VisualizerBody;

use crate::drawop::{FrameBuilder, Mat6};
use crate::source::kernel::{DrawBox, ring_subpath};
use crate::source::visualizer::{VisualizerParams, VizFrame, freq_row};

use super::common::{band_amplitude, easing_of, push_fill};

pub(crate) fn draw(
    builder: &mut FrameBuilder,
    body: &VisualizerBody,
    params: &VisualizerParams,
    viz: &VizFrame,
    bbox: DrawBox,
    tf: Mat6,
) -> usize {
    let recipe = &body.recipe;
    let (Some(bands), Some(core_radius), Some(ring_radius), Some(ring_width)) = (
        recipe.integer("bands"),
        recipe.number("coreRadius"),
        recipe.number("ringRadius"),
        recipe.number("ringWidth"),
    ) else {
        return 0;
    };
    let easing = easing_of(recipe);
    let bands = bands as usize;
    let radius = bbox.w.min(bbox.h) / 2.0;
    if bands == 0 || !(radius > 0.0) {
        return 0;
    }
    let row = freq_row(viz, body.bin_width);
    let center = bbox.center();
    let core_radius = core_radius.clamp(0.0, 1.0);
    let ring_radius = ring_radius.clamp(core_radius, 1.0);
    let step = (ring_radius - core_radius) / (bands as f64 + 1.0);
    let amplitude = |band: usize| {
        let from = band as f64 / bands as f64;
        let to = (band as f64 + 1.0) / bands as f64;
        easing.apply(band_amplitude(row, from, to)).clamp(0.0, 1.0)
    };

    let mut pushed = 0;
    let core = radius * (core_radius + step * amplitude(0));
    let mut disc = Vec::with_capacity(8);
    ring_subpath(&mut disc, center, core, 0.0);
    pushed += usize::from(push_fill(builder, disc, params.main_color, tf));

    let half_width = ring_width.clamp(0.0, 1.0) * radius / 2.0;
    for band in 0..bands {
        let middle = radius * (core_radius + step * (band as f64 + 1.0) + step * amplitude(band));
        let outer = middle + half_width;
        let inner = (middle - half_width).max(0.0);
        if !(outer > inner) {
            continue;
        }
        let mut ring = Vec::with_capacity(16);
        ring_subpath(&mut ring, center, outer, inner);
        pushed += usize::from(push_fill(builder, ring, params.secondary_color, tf));
    }
    pushed
}
