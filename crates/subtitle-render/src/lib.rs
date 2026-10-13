//! CucCut subtitle overlay render kernel: **the same implementation used by both CLI burn-in and App v2 preview**.
//!
//! The content was moved as a whole from `core/crates/ccut-kernel/src/cmd/studio_export` (second cut of main plan D2; see `docs/archive/app-v2/m1-mvp.md` §2.1 W4 for details). The move was `git mv` plus visibility promotion, and no function body was changed by a single character. The M1-R3 requirement, “same kernel, same input, same pixels”, only holds when it is really the same code. Rewriting it and then cross-checking would leave the risk to the user.
//!
//! # Four disciplines
//!
//! **One: there is only one copy of subtitle typesetting.** The overlay's typesetting, per-word state, the Designed Caption recipes, timeline element composition and DrawOp fingerprints all live here. There must be no second implementation in `core/crates/ccut-kernel/src` or `apps/cuccut/src`. This is enforced by the scan in [`tests/no_second_implementation.rs`](https://github.com/hieudinh/cuccut-app). The App side may only call it. The red line of main plan D6 is “the App does no subtitle typesetting whatsoever”.
//!
//! **Two: probes and the timeline projection are injected items, not sunk items.** The canvas size, duration and fps are detected by the caller and **passed in as parameters** to [`OverlayRenderPlan::compile_project`]. This crate does not spawn `ffprobe` and does not link any platform media framework. The project-level timeline projection is injected through [`host::OverlayHost`] (the implementation belongs to `ccut-workspace`, the third cut of D2). Conversely, media paths and BCS1 cache naming must be sunk (see [`paths`]). Injecting them would require every host to replicate the naming rules, which is the second implementation discipline one forbids.
//!
//! **Three: read-only entry points have no side effects (main plan §9.1-b).** [`project_media`], [`load_preview_document`], [`load_overlay_document`] and [`load_subtitle_style_override`] only read files. They do not write to disk, create directories, migrate old data or acquire the project lock. The App's two-phase open calls them repeatedly when quickly switching projects. Any write would become a silent change to the user's document that they cannot see.
//!
//! **Four: PNG's upstream is RGBA, not the other way round.** [`OverlayRenderPlan::render_rgba`] returns the **premultiplied** RGBA that the renderer produces directly (tiny-skia memory layout). [`OverlayRenderPlan::render_png`] hands the same buffer to `Pixmap::encode_png` (PNG is straight alpha, and the encoder un-premultiplies). GPUI texture upload goes through `render_rgba`. Never “render PNG, then decode back to RGBA”. That would add a pointless encode/decode round trip, and pixel identity between the two ends would then rest on luck. Pixel identity is judged by [`OverlayFrame::draw_op_fingerprint`], and the subtitle layer content key is [`OverlayFrame::subtitle_key`]. The two cannot stand in for each other.
//!
//! # Minimal call sequence for App v2
//!
//! ```ignore
//! subtitle_render::host::register(Box::new(MyHost));   // once, at process start
//!
//! let media = subtitle_render::project_media(root)?;   // read-only
//! let probe = my_platform_probe(&media)?;                   // the probe is provided by the host
//! let document = subtitle_render::load_overlay_document(root)?;
//! let mut plan = subtitle_render::OverlayRenderPlan::compile_project(
//!     root, &document, width, height, probe.duration, probe.fps, mode,
//! )?;
//! let frame = plan.render_rgba_frame(t)?;   // frame.next_change = the next change time
//! ```

#![allow(clippy::too_many_arguments)]

/// Real-run sample for the "dynamic typesetting" card in the gallery (same typesetting and camera as the stage).
pub mod caption_sequence_demo;
pub mod word_animation_catalog;
pub mod word_motion;
pub mod word_motion_demo;

#[cfg(feature = "host")]
pub mod host;
// Shared building blocks for host implementers (word timing loading, and word anchor → seconds). Both the CLI and App v2 hosts call here. D2 does not allow either side to write a second copy of anchor resolution.
#[cfg(feature = "host")]
pub mod host_support;
#[cfg(feature = "host")]
pub mod paths;

/// Frame-by-frame direct drawing of the template layer document (the `template` in `timeline.json`). Shared by both features.
pub mod template_layer;
pub use template_layer::{FrameParams as TemplateFrameParams, TemplateScene, TemplateSource};

/// Two-way reconciliation of subtitle styles (`contexts` ↔ flat keys, and normalization of the track set). Moved down from `ccut-workspace`. The criteria themselves have no I/O, and both the write path and `ccut-editor-core` need the same copy.
pub mod style_sync;
pub mod text_design;

// v3: in v2 these two pieces were outside the kernel (the ASS soft-subtitle header in `ccut-kernel`, and the check verdicts in `ccut-engine`). They need this crate's `LineStyle` or the timeline schema, and `speech-doc` does not depend on rendering in reverse, so they landed here.
pub mod ass_style;
pub mod check;

// Flat namespace: in `studio_export`, the five files below are a single module assembled with `include!`, and hundreds of cross-references between them depend on this. Turning them into real modules would be a rewrite rather than a move, and would turn every cross-reference into a visibility problem. So the composition is kept as it is.
//
// The cost to be aware of: rustfmt only follows `mod` declarations and **does not visit files pulled in by `include!`**. So `cargo fmt --all -- --check` is always green for these six files below, and indentation can rot while still passing. The manual gate is:
//     rustfmt --edition 2024 --check core/crates/ccut-subtitle-render/src/*.rs
include!("document.rs");
include!("caption_recipe.rs");
include!("caption_sequence.rs");
include!("transition.rs");
include!("render_plan.rs");
include!("raster.rs");
include!("text_motion_raster.rs");
include!("tests.rs");
