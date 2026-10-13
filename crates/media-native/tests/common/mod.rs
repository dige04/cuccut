//! Shared fixtures and judging tools for native decode acceptance (used by both the single-frame extraction and the sequential frame stream test targets).
//!
//! Fixtures are generated fresh by ffmpeg, so the assertions can be **readable color predicates** rather than pixel goldens. Per `docs/design/bcf/cuccut-format-spec.md` §15.1, decoded video frame pixels only promise semantic equivalence plus tolerance. If ffmpeg cannot be detected, the whole test is skipped. This is the repository's existing courtesy: no fixture is not a failure.

// Each integration test target compiles this whole module in, and each uses only part of it.
#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use media_native::RgbaFrame;

pub const WIDTH: u32 = 320;
pub const HEIGHT: u32 = 180;
/// Duration of the three solid-color segments (seconds), in the order red / green / blue.
pub const SEGMENT: f64 = 1.0;
/// Source frame rate of the fixture.
pub const SOURCE_FPS: f64 = 30.0;

pub fn ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// A 320x180 H.264 clip with 1 second each of red / green / blue at 30 fps, one keyframe per second.
///
/// Each segment is deliberately one second long. If a fetch at a segment boundary grabs a frame from the wrong segment, the color predicate fails immediately. That says more about "whether the fetched frame is the one covering t" than how many milliseconds the timestamp is off.
///
/// Each segment is encoded with a **left-to-right linear luminance ramp** (0.2 → 1.0 times), for two reasons:
///
/// 1. **Solid-color frames are a pathological input for SSIM.** When the variance inside the window is zero, SSIM degenerates into a pure luminance ratio. A "small whole-frame offset" is exactly the kind of difference that §15.1 says SSIM should not be sensitive to, and should be left to per-channel deviation to catch. (The gray level of pure blue is only 29, so a few levels of matrix difference can drag the luminance ratio down to 0.8.) The ramp gives the structure term something to measure, so SSIM measures what it should.
/// 2. **Hard edges cannot be used.** An early version used two color blocks, white on the left and black on the right. It measured cross-backend SSIM at 0.91 with a per-channel maximum deviation of 99. The root cause was not decode quality (the maximum deviation in flat areas is only 1). It was that 4:2:0 chroma has only half the horizontal resolution, and AVFoundation and swscale each interpolate chroma sampling and edge scaling differently, which the sliding-window SSIM magnifies at that transition band. After switching to a continuous ramp, measured SSIM is ≥ 0.976 and the maximum deviation is ≤ 15. The difference between the two paths is back to the magnitude of color-matrix implementation differences, which is what §15.1 is meant to measure.
///
/// The three channels are scaled by the same factor, so dominant-color judgment is unaffected ([`dominant`] looks at the relative relationship between channels).
pub fn fixture() -> Option<(tempfile::TempDir, PathBuf)> {
    if !ffmpeg_available() {
        return None;
    }
    let dir = tempfile::tempdir().ok()?;
    let media = dir.path().join("rgb-segments.mp4");
    // Multiply each pixel by a horizontal linear ramp (0.2 → 1.0). The same coefficient is used for all three channels.
    let ramp = |channel: char| format!("{channel}='{channel}(X,Y)*(0.2+0.8*X/W)'");
    let gradient = format!("geq={}:{}:{}", ramp('r'), ramp('g'), ramp('b'));
    let source = |color: &str| {
        format!("color=c={color}:s={WIDTH}x{HEIGHT}:r={SOURCE_FPS}:d={SEGMENT},{gradient}")
    };
    let status = Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error", "-f", "lavfi", "-i"])
        .arg(source("red"))
        .args(["-f", "lavfi", "-i"])
        .arg(source("green"))
        .args(["-f", "lavfi", "-i"])
        .arg(source("blue"))
        .args([
            "-filter_complex",
            "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]",
            "-map",
            "[v]",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-g",
            "30",
            // Write out the full color tags explicitly. If they are not written, the container holds `unknown`. ffmpeg guesses BT.601 from the resolution, while AVFoundation guesses by its own rules. The two guess different matrices, so the YUV→RGB result of solid-color blocks can differ by dozens of levels, and what gets measured is no longer decode quality but missing tags.
            // Real material is always tagged, so the fixture has no reason to be worse than that.
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-colorspace",
            "bt709",
            "-color_range",
            "tv",
        ])
        .arg(&media)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .ok()?;
    (status.success() && media.is_file()).then_some((dir, media))
}

/// The ffmpeg frame-extraction recipe from before the migration (`-ss` before `-i`), decoded to raw RGBA for cross-checking.
pub fn ffmpeg_frame(media: &Path, time: f64, width: u32) -> Option<RgbaFrame> {
    let output = Command::new("ffmpeg")
        .args([
            "-nostdin",
            "-loglevel",
            "error",
            "-ss",
            &format!("{time:.3}"),
        ])
        .arg("-i")
        .arg(media)
        .args(["-frames:v", "1", "-vf", &format!("scale={width}:-2")])
        .args(["-f", "rawvideo", "-pix_fmt", "rgba", "-"])
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let height = u32::try_from(output.stdout.len() / (width as usize * 4)).ok()?;
    RgbaFrame::new(width, height, output.stdout).ok()
}

/// The sequential decode recipe from before the migration in `ccut-render::media::VideoReader`: `-ss` before `-i`, with output resampled to the composition fps as a raw RGBA stream. Returns whole frames, cut in output order.
pub fn ffmpeg_frame_stream(media: &Path, from: f64, fps: f64) -> Option<Vec<RgbaFrame>> {
    let output = Command::new("ffmpeg")
        .args([
            "-nostdin",
            "-loglevel",
            "error",
            "-ss",
            &format!("{from:.6}"),
        ])
        .arg("-i")
        .arg(media)
        .args([
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-r",
            &format!("{fps}"),
            "-",
        ])
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stride = WIDTH as usize * HEIGHT as usize * 4;
    Some(
        output
            .stdout
            .chunks_exact(stride)
            .map(|bytes| RgbaFrame::new(WIDTH, HEIGHT, bytes.to_vec()).expect("whole frame"))
            .collect(),
    )
}

/// Dominant-color judgment: which of the three channels is clearly the largest. A solid-color segment will not be exactly 255/0/0 after an H.264 4:2:0 round trip, but the dominance relation is stable, and it is stable across decoders.
pub fn dominant(frame: &RgbaFrame) -> &'static str {
    let mut totals = [0_u64; 3];
    for pixel in frame.data.chunks_exact(4) {
        totals[0] += u64::from(pixel[0]);
        totals[1] += u64::from(pixel[1]);
        totals[2] += u64::from(pixel[2]);
    }
    let max = totals.iter().copied().max().unwrap_or(0);
    // The dominant channel must exceed the second-highest channel by a wide margin. Otherwise the frame is not solid color (it crosses segments or mixes frames).
    let second = totals.iter().copied().filter(|value| *value != max).max();
    if second.is_some_and(|second| max < second * 3 / 2) {
        return "mixed";
    }
    match totals.iter().position(|value| *value == max) {
        Some(0) => "red",
        Some(1) => "green",
        Some(2) => "blue",
        _ => "mixed",
    }
}

/// `RgbaFrame` (straight alpha; video frames are always opaque) → `tiny_skia::Pixmap` (premultiplied). When alpha is always 255, the two conventions are byte-identical, so the bytes can be copied directly without actually running premultiplication.
pub fn to_pixmap(frame: &RgbaFrame) -> tiny_skia::Pixmap {
    let size = tiny_skia::IntSize::from_wh(frame.width, frame.height).expect("non-zero size");
    tiny_skia::Pixmap::from_vec(frame.data.clone(), size).expect("RGBA byte count matches the size")
}
