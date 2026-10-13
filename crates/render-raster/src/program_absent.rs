//! The `program` module when the `program` feature is off (v3-only; v2 has no such file).
//!
//! A v2 `program` asset requires `ccut-compile` to evaluate the TSX module graph into per-frame SVG. That is not ported (architecture design §13.6), so `program` is a placeholder feature (see the header of Cargo.toml). `assets::load_assets_with_vars` reports an error directly when it meets a `program` asset, and `LoadedAssets::programs` is always empty. The frame supply (`media.rs`) and the branches of `LoadedAssets::render_diagnostics` that check `programs` are compiled as in v2. `ProgramSource` is a value-less enum, so these branches never match.

use anyhow::Result;
use tiny_skia::Pixmap;

use crate::plan::PreflightDiagnostic;

/// No value: cannot be constructed without the `program` feature. Method signatures match the same-named methods in `program.rs`.
#[derive(Debug)]
pub enum ProgramSource {}

impl ProgramSource {
    pub fn width(&self) -> u32 {
        match *self {}
    }

    pub fn height(&self) -> u32 {
        match *self {}
    }

    pub fn frame_starts_ms(&self) -> &[i64] {
        match *self {}
    }

    pub fn duration(&self) -> f64 {
        match *self {}
    }

    pub fn frame_start_ms(&self, _ms: i64) -> i64 {
        match *self {}
    }

    pub fn late_diagnostics(&self) -> Vec<PreflightDiagnostic> {
        match *self {}
    }

    pub fn render(&self, _ms: i64, _target: Option<(u32, u32)>) -> Result<Pixmap> {
        match *self {}
    }
}
