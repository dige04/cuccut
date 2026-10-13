//! Format version constants for `timeline.json`.
//!
//! The v2 versions live in the `versions` module of `ccut-protocol/src/version.rs`. This crate only uses these two, so the original values are copied here as-is. `schema` still exports them under their original public names (`TIMELINE_VERSION` / `TIMELINE_VERSIONS`).

/// Timeline (`timeline.json`): reads 0.1–0.12, writes 0.12. (0.9: whiteboard beats follow the narration: `pace` / `strict` / `end` / `label` / word anchors;
/// 0.10: audio element `bcfClip`, the BCF audio clip claimed when an animation project's narration is imported as a track; 0.11: source `origin` (`"ai"`) and the provenance sidecar
/// `provenance`: image-generation results are registered as ordinary `Source`s; 0.12: element `keyframes` / `duck`, and `bg` and
/// `main.background` accept `#RRGGBB`.)
pub const TIMELINE_CURRENT: &str = "0.12";
pub const TIMELINE_SUPPORTED: &[&str] = &[
    "0.1",
    "0.2",
    "0.3",
    "0.4",
    "0.5",
    "0.6",
    "0.7",
    "0.8",
    "0.9",
    "0.10",
    "0.11",
    TIMELINE_CURRENT,
];
