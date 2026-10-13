//! Watermark preset and logo metadata **wire shapes** (the `watermarks[]` / `logos[]` of `brand.json`).
//!
//! v2 is in `ccut-protocol/src/brand.rs`; this crate only uses [`Watermark`], [`WatermarkKind`], [`Placement`] and [`Logo`] for the watermark conversion in [`crate::template`], and does not port `ccut-protocol`. These four types, together with their default values, are copied here as-is (with the `JsonSchema` derive that only existed to generate JSON Schema removed). `BrandDocument`, fonts, caption style presets and watermark import stay in v2.

use serde::{Deserialize, Serialize};

/// The carrier type of a watermark preset.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WatermarkKind {
    Text,
    Image,
}

/// Watermark placement: tiled across the whole frame, or pinned to a corner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Placement {
    Tiled,
    Corner,
}

fn default_opacity() -> f64 {
    0.6
}

/// One watermark preset.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Watermark {
    pub id: String,
    /// The name shown in the list; falls back to `value` when omitted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub kind: WatermarkKind,
    /// `text` is the watermark text itself; `image` is a `logos[].id`, and an absolute path is also accepted.
    pub value: String,
    #[serde(default = "default_placement")]
    pub placement: Placement,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    /// The UI's “set as default” flag. The CLI does not implicitly pick a preset based on it: `--from-brand` always requires an explicit id.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub default: bool,
}

fn default_placement() -> Placement {
    Placement::Corner
}

/// One logo asset: the bytes live under `<config_root>/brand/`; only metadata is recorded here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Logo {
    pub id: String,
    /// Display name; defaults to the original file name at import time.
    pub name: String,
    /// A **path relative to `<config_root>`** (of the form `brand/logo-1.png`): the whole config directory can be moved or synced as a unit, and an absolute path would break on another machine.
    pub file: String,
    pub bytes: u64,
    /// Millisecond epoch.
    pub added_at: u64,
    /// Millisecond epoch of the most recent use (a sticker dropped onto the timeline, a logo applied to a project). Absent means never used; when sorting it falls back to `added_at`. It is `Option` rather than `0` because “never used” and “used in 1970” are not the same thing, and the UI may also want to show the two differently.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub used_at: Option<u64>,
}
