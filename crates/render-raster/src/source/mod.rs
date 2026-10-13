//! Dynamic asset sources (upgrade plan §7 / spec §23 item 2).
//!
//! A `VisualSource` is a randomly accessible asset of the form "give me a source time, return me a picture":
//! animated images (GIF / APNG / WebP), Lottie in the future, and video, which has always been conceptually the same.
//!
//! **The only official interface is [`VisualSource::sample`], whose argument is an absolute source time, not a delta.**
//! There is no `update(delta)`, no internal clock, and no "previous frame" state — this is not a style preference,
//! but a prerequisite for export to be out-of-order, parallel and cacheable:
//!
//! * Rendering is **out of order**: `ccut render --t 7.5` jumps straight to frame 225, and full-film export also
//!   hands frames to multiple workers by stride, each worker jumping around on its own;
//! * The frame fingerprint (`plan::frame_plan`'s three-layer fingerprint) requires that the same moment always equals the same bytes,
//!   which a source holding an incremental clock cannot guarantee;
//! * Therefore "sequential sampling == out-of-order sampling" in conformance is mandatory, not optional
//!   (see `tests/animated_source.rs`).
//!
//! Two implementations: [`animated_image::AnimatedImage`] (GIF / APNG / WebP, a bitmap source with all frames resident
//! ) and [`lottie::Lottie`] (bodymovin subset, **emits DrawOps directly** rather than first
//! rasterizing). Design §7 said "after the two coexist, extract a `ccut-source` crate"; that moment has arrived,
//! but the two share only the roughly hundred lines of trait and duration-table utilities in this file, while `Lottie` in turn
//! depends on `crate::drawop` / `crate::raster` / `crate::plan::PreflightDiagnostic`
//! — splitting it out for real would drag three `ccut-render` modules along with it, in exchange for a new crate
//! boundary and a new Cargo entry. So **after evaluation, this batch decided not to split**, and it stays in
//! `ccut-render/src/source/`; revisit when a third kind of source (alpha video / vector sequence)
//! appears, or when another crate needs to consume the source layer on its own.

//! ## Two traits, not one
//!
//! [`VisualSource`] is the **picture** source: `sample` returns a premultiplied RGBA
//! [`SourceFrame`]. The element-side visualizer ([`visualizer::VizTrack`], ADR-E04)
//! goes through the neighboring [`visualizer::VizSource`] and is **not** merged into this trait, for two reasons:
//!
//! 1. **A frame of spectrum is not a picture.** `VizFrame` is a time-domain row plus a frequency-domain row, two byte rows of **different widths** (BCS1's 128 / 512); forcing it into a `Pixmap` would mean inventing a pixel convention on the spot,
//!    whereas ADR-E04's downstream consumer is `visualizer_frame(recipe, props, viz, bbox)
//!    -> DrawOp`, which wants data, not pixels. The `w × 2` `R8Unorm` texture in §8.3 is
//!    **built at GPU upload time** from the recipe's `binWidth`; it is not a product of the source layer.
//! 2. **Spectrum has no "native asset size".** [`lottie::Lottie`] also emits DrawOps directly, but it at least
//!    has a composition canvas that can be rasterized (its `VisualSource::sample` does exactly this, and only serves probe / conformance); a spectrum has no picture at all until it has the recipe, colors and element box, and that step is `visualizer_frame` itself.
//!
//! Only "what one frame is" is split. **The four sampling obligations are identical word for word in both traits**: the single entry point is
//! `sample` at an absolute time, no incremental clock may be held, sampling takes only `&self`, and the content fingerprint covers all
//! bytes; "out-of-order sampling == sequential sampling" in conformance is mandatory on both sides.

pub mod animated_image;
pub mod confetti;
pub mod kernel;
pub mod lottie;
pub mod paint;
pub mod proc;
pub mod progress;
pub mod texture;
pub mod visualizer;
pub mod whiteboard;

use anyhow::Result;
use std::fmt;
use std::sync::Arc;
use tiny_skia::Pixmap;

pub use animated_image::AnimatedImage;
pub use confetti::{
    ConfettiBox, ConfettiEmitMode, ConfettiEmitOverride, ConfettiParams, ConfettiShape,
    confetti_frame, confetti_particles, confetti_unit_path,
};
pub use kernel::DrawBox;
pub use lottie::{LOTTIE_RULE, Lottie};
pub use progress::{ProgressBox, ProgressParams, progress_frame};
pub use visualizer::{
    VisualizerParams, VizBox, VizFrame, VizParams, VizSource, VizTrack, visualizer_frame,
};
pub use whiteboard::{
    WhiteboardAnalysis, WhiteboardBeat, WhiteboardBox, WhiteboardGroup, WhiteboardHand,
    WhiteboardPace, WhiteboardParams, analyze as whiteboard_analyze, whiteboard_frame,
};

/// Source kind (the render-side counterpart of `AssetKind`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceKind {
    /// GIF / APNG / animated WebP
    AnimatedImage,
    /// Pure-Rust subset renderer for bodymovin JSON (ADR-M11)
    Lottie,
}

impl SourceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            SourceKind::AnimatedImage => "animatedImage",
            SourceKind::Lottie => "lottie",
        }
    }
}

impl fmt::Display for SourceKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Source time (media source moment).
///
/// Stored internally as **whole milliseconds**: animated-image frame durations are already milliseconds (GIF uses 10 ms units,
/// APNG/WebP use milliseconds), and DrawOp's `media_ms` is also milliseconds; keeping an extra floating-point layer would only leave room for
/// "two reads at the same moment getting different frames". Rounding from seconds to milliseconds happens only in
/// [`MediaTime::from_secs`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MediaTime {
    ms: i64,
}

impl MediaTime {
    pub const ZERO: MediaTime = MediaTime { ms: 0 };

    /// Seconds → source time (rounded to milliseconds, same convention as the video path in `record_media`).
    pub fn from_secs(secs: f64) -> MediaTime {
        MediaTime {
            ms: (secs * 1000.0).round() as i64,
        }
    }

    pub const fn from_millis(ms: i64) -> MediaTime {
        MediaTime { ms }
    }

    pub const fn millis(self) -> i64 {
        self.ms
    }

    pub fn secs(self) -> f64 {
        self.ms as f64 / 1000.0
    }
}

impl fmt::Display for MediaTime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}ms", self.ms)
    }
}

/// The asset's own loop declaration (GIF's NETSCAPE2.0 / APNG's `acTL.num_plays` /
/// WebP's `ANIM.loop_count`).
///
/// **It is metadata obtained by probing, not a rendering criterion**: whether the picture loops is decided by whether the `animatedImage` element in the document writes
/// `loop` (the default falls back to this field). The reason is determinism — a document's playback behavior should not depend on some container byte, but should be written in the document; `ccut probe` prints it out, and
/// the author decides from that whether to write `loop` explicitly.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceLoop {
    Infinite,
    Finite(u32),
}

impl SourceLoop {
    /// Play count; `0` = infinite (the encoding of `RNode::media_plays`).
    pub fn plays(self) -> u32 {
        match self {
            SourceLoop::Infinite => 0,
            SourceLoop::Finite(n) => n,
        }
    }

    pub fn from_plays(plays: u32) -> SourceLoop {
        match plays {
            0 => SourceLoop::Infinite,
            n => SourceLoop::Finite(n),
        }
    }
}

impl fmt::Display for SourceLoop {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SourceLoop::Infinite => f.write_str("infinite"),
            SourceLoop::Finite(n) => write!(f, "{n}x"),
        }
    }
}

/// Probe result: dimensions, frame count, per-frame duration table, loop declaration.
#[derive(Debug, Clone)]
pub struct SourceMetadata {
    pub kind: SourceKind,
    pub width: u32,
    pub height: u32,
    /// Per-frame **start** time table in milliseconds, length = frame count + 1; the last entry is the total duration (a cumulative sum).
    /// Non-decreasing; two adjacent equal entries mean that frame has zero duration (the container wrote delay 0).
    pub frame_starts_ms: Vec<i64>,
    pub loops: SourceLoop,
}

impl SourceMetadata {
    pub fn frame_count(&self) -> usize {
        self.frame_starts_ms.len().saturating_sub(1)
    }

    /// Total duration (seconds).
    pub fn duration(&self) -> f64 {
        self.total_ms() as f64 / 1000.0
    }

    pub fn total_ms(&self) -> i64 {
        self.frame_starts_ms.last().copied().unwrap_or(0)
    }

    /// `frameIndex = frame_at_duration_table(localTime)` (design §7).
    ///
    /// Any time after the end freezes on the last frame — loop folding is the **caller's** job (the element's
    /// `loop` / `segment` semantics have already been folded in `record_media`); the source itself does not loop.
    pub fn frame_at(&self, time: MediaTime) -> usize {
        frame_index(&self.frame_starts_ms, time.millis())
    }

    /// The **start** of the frame that contains this moment — during recording, it is used to quantize the source time to the frame start,
    /// so consecutive moments within the same frame get byte-identical DrawOps (the still-frame cache hits on this).
    pub fn frame_start(&self, time: MediaTime) -> MediaTime {
        MediaTime::from_millis(frame_start_ms(&self.frame_starts_ms, time.millis()))
    }
}

/// Duration-table lookup: returns the frame index that contains `ms`. The table must have the `frame_starts_ms` shape
/// (N+1 entries, non-decreasing). An empty table returns 0.
pub fn frame_index(frame_starts_ms: &[i64], ms: i64) -> usize {
    let n = frame_starts_ms.len().saturating_sub(1);
    if n == 0 {
        return 0;
    }
    let total = frame_starts_ms[n];
    let ms = ms.clamp(0, (total - 1).max(0));
    // On ties, take the **later** frame: zero-duration frames (delay 0) are thus skipped, consistent with browsers.
    frame_starts_ms[..n]
        .partition_point(|start| *start <= ms)
        .saturating_sub(1)
}

/// Duration-table lookup: returns the start time in milliseconds of the frame that contains `ms`.
pub fn frame_start_ms(frame_starts_ms: &[i64], ms: i64) -> i64 {
    frame_starts_ms
        .get(frame_index(frame_starts_ms, ms))
        .copied()
        .unwrap_or(0)
}

/// One frame of picture (premultiplied RGBA, same pixel format as the other pictures in `MediaStore`).
#[derive(Debug, Clone)]
pub struct SourceFrame {
    pub index: usize,
    /// Start of this frame on the source timeline
    pub start: MediaTime,
    pub pixmap: Arc<Pixmap>,
}

/// Content fingerprint: `sha256(source kind ‖ decoder version ‖ all bytes)`.
///
/// "All bytes" is deliberate — every frame of an animated image lives in the same container, so changing any frame, any
/// delay, or the loop count changes the fingerprint. Once Lottie is in (its sub-assets image/font are separate files),
/// the hashes of sub-assets are folded into the same chain in preflight collection order (design §7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ContentHash([u8; 32]);

impl ContentHash {
    pub fn new(bytes: [u8; 32]) -> ContentHash {
        ContentHash(bytes)
    }

    pub fn bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub fn hex(&self) -> String {
        self.0.iter().map(|b| format!("{b:02x}")).collect()
    }
}

impl fmt::Display for ContentHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "sha256-{}", self.hex())
    }
}

/// Decode budget: animated images are **fully resident** (see `AnimatedImage`) and must have a cap,
/// otherwise a single 1080p × 400-frame GIF would eat 3.3 GB outright.
#[derive(Debug, Clone, Copy)]
pub struct PrepareCtx {
    pub max_frames: usize,
    pub max_bytes: usize,
}

impl Default for PrepareCtx {
    fn default() -> Self {
        PrepareCtx {
            max_frames: 2048,
            // 256 MiB: about 32 frames at 1080p, about 256 frames at 512×512, and thousands of frames for typical meme animations
            max_bytes: 256 << 20,
        }
    }
}

/// Dynamic asset source (design §7).
///
/// `prepare` and `sample` both take `&self`: the source is constructed once during `load_assets` and then shared by
/// several render workers (`Arc<LoadedAssets>`); sampling must not change any observable state.
pub trait VisualSource: Send + Sync {
    fn kind(&self) -> SourceKind;

    /// Metadata (dimensions, duration table, loop declaration).
    fn probe(&self) -> Result<SourceMetadata>;

    /// Warm-up: prepare everything the render phase needs here (Lottie's sub-assets are collected here and folded into the hash).
    /// Idempotent; no further I/O may happen during rendering, and certainly no network.
    fn prepare(&self, ctx: &PrepareCtx) -> Result<()>;

    /// **The only official sampling interface**: absolute source time → picture.
    fn sample(&self, time: MediaTime) -> Result<SourceFrame>;

    fn fingerprint(&self) -> ContentHash;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_duration_table_maps_time_to_frames() {
        // Three frames: [0,100) [100,300) [300,600)
        let table = [0, 100, 300, 600];
        assert_eq!(frame_index(&table, 0), 0);
        assert_eq!(frame_index(&table, 99), 0);
        assert_eq!(frame_index(&table, 100), 1);
        assert_eq!(frame_index(&table, 299), 1);
        assert_eq!(frame_index(&table, 300), 2);
        assert_eq!(frame_index(&table, 599), 2);
        // After the end, freeze on the last frame; negative values clamp to the first frame
        assert_eq!(frame_index(&table, 600), 2);
        assert_eq!(frame_index(&table, 10_000), 2);
        assert_eq!(frame_index(&table, -5), 0);
    }

    #[test]
    fn zero_length_frames_are_skipped() {
        // Frame 1 has delay 0: no moment should ever land on it
        let table = [0, 100, 100, 400];
        assert_eq!(frame_index(&table, 99), 0);
        assert_eq!(frame_index(&table, 100), 2);
        assert_eq!(frame_index(&table, 399), 2);
    }

    #[test]
    fn frame_start_quantises_time() {
        let table = [0, 100, 300, 600];
        assert_eq!(frame_start_ms(&table, 0), 0);
        assert_eq!(frame_start_ms(&table, 99), 0);
        assert_eq!(frame_start_ms(&table, 250), 100);
        assert_eq!(frame_start_ms(&table, 599), 300);
        assert_eq!(frame_start_ms(&table, 1_000), 300);
    }

    #[test]
    fn media_time_rounds_once() {
        assert_eq!(MediaTime::from_secs(0.1234).millis(), 123);
        assert_eq!(MediaTime::from_secs(0.1235).millis(), 124);
        assert_eq!(MediaTime::from_millis(250).secs(), 0.25);
    }

    #[test]
    fn loop_counts_round_trip_through_the_plays_encoding() {
        assert_eq!(SourceLoop::Infinite.plays(), 0);
        assert_eq!(SourceLoop::Finite(3).plays(), 3);
        assert_eq!(SourceLoop::from_plays(0), SourceLoop::Infinite);
        assert_eq!(SourceLoop::from_plays(1), SourceLoop::Finite(1));
    }
}
