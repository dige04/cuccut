//! Draw recipes for the visualizer (the closed set of algorithm names in design §7.2; one module per algorithm name).
//!
//! After the 2026-09 redesign, waveform visualizers are **10 styles across 7 algorithm names**, all CPU vector recipes (`determinism: strict`, `shader: null`):
//!
//! | Algorithm name | Styles | Reads |
//! | --- | --- | --- |
//! | [`spectrum_bars_v1`] | `bars` / `bars_rounded` / `bars_bottom` | frequency row |
//! | [`polar_bars_v1`] | `ring_bars` | frequency row |
//! | [`oscilloscope_v1`] | `oscilloscope` / `ring_wave` | **time-domain row** |
//! | [`spectrum_area_v1`] | `spectrum_area` | frequency row |
//! | [`dot_matrix_v1`] | `dots` | frequency row |
//! | [`pulse_rings_v1`] | `pulse_rings` | frequency row (band-split) |
//! | [`ribbons_v1`] | `ribbons` | frequency row (band-split) + **clock** |
//!
//! Styles under the same algorithm name are told apart **entirely by manifest parameters**; there is one Rust implementation. Sampling and path-pushing helpers shared across algorithms are in [`common`]; geometry formulas are in [`crate::source::kernel`].

pub(crate) mod common;
pub(crate) mod dot_matrix_v1;
pub(crate) mod oscilloscope_v1;
pub(crate) mod polar_bars_v1;
pub(crate) mod pulse_rings_v1;
pub(crate) mod ribbons_v1;
pub(crate) mod spectrum_area_v1;
pub(crate) mod spectrum_bars_v1;
