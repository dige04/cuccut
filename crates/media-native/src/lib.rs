/*!
 * ccut-media-native — platform-native media decoding primitives.
 *
 * In one sentence: **get CPU pixels or a platform GPU surface from a local video, without starting an ffmpeg subprocess**. It complements `ccut-media-probe` ("what is this file"). That one answers metadata questions, and this one answers frame questions.
 *
 * ## Three ways to get pixels
 *
 * - [`extract_frame_rgba`] (WP5a): decodes **one frame** at a given time point, scales it to the target width, and hands out RGBA8. It serves the "one frame at a time, at random time points" needs of thumbnails, filmstrips and viewfinder frames. Originally, every cell forked a `ffmpeg -ss ... -frames:v 1`.
 * - [`open_frame_stream`] (WP6a): a **sequential frame stream** from a starting point and a composition frame rate. It supplies frames one by one to the BCF render pipeline. Originally, each clip had one `ffmpeg … -f rawvideo` pipe.
 * - `open_dxgi_frame_server` on Windows (unified render R4): `IMFMediaEngine` in frame-server mode writes played frames directly into a three-slot D3D11 BGRA texture pool, and hands out an NT shared handle and a shared fence value with each frame. The real-time path makes no CPU copy of the pixels.
 *
 * These three do not share one "generic decoder" abstraction. Their trade-offs are completely different: sequential decoding cannot re-seek every frame, random frame fetching cannot build one reader and read from the start, and real-time playback cannot reduce a GPU surface to CPU bytes. So the platform layer uses the interface the system provides for each scenario.
 *
 * ## The reverse direction: writing pixels
 *
 * [`open_mp4_writer`] (WP6b) is the mirror image of the same rule. **Without starting an ffmpeg subprocess, it writes per-frame RGBA plus the full mixed PCM audio as an H.264/AAC MP4.** The contract, backend table and bitrate policy are in [`Mp4Writer`] and [`video_bitrate`].
 *
 * ## Backends
 *
 * | Platform | Backend | Single frame | Sequential stream | Real-time GPU playback frame | MP4 writing |
 * | --- | --- | --- | --- | --- | --- |
 * | macOS | AVFoundation | `AVAssetImageGenerator` (exact frame fetch with zero tolerance) + CoreGraphics bitmap context converted to RGBA | `AVAssetReader` + `AVAssetReaderTrackOutput` (32BGRA) | The app's playback layer holds `CVPixelBuffer` / IOSurface | `AVAssetWriter` + pixel buffer adaptor (VideoToolbox H.264 + AAC) |
 * | Windows | Media Foundation | `IMFSourceReader` + `MFVideoFormat_RGB32`, advancing to the target frame by timestamp after a seek | Same source reader, `ReadSample` all the way through after a seek | `IMFMediaEngine` frame-server → three-slot shared D3D11 BGRA textures + shared fence | `IMFSinkWriter` + H.264 MFT (NV12 input) + AAC MFT |
 * | Others (Linux…) | None | [`available`] returns `false`, and returns `Err` | Same as left | None | [`encode_available`] returns `false`, same as left |
 *
 * **The caller must bring its own ffmpeg fallback.** This crate does not discover or start any external binary (that is the job of `ccut-exec`), and it does not promise to decode every container. A native failure is simply a failure. Whether to fall back is up to the caller.
 *
 * ## Determinism boundary
 *
 * Decoded pixels belong to the platform decoder. The same H.264 bitstream on VideoToolbox, Media Foundation and ffmpeg swscale does not share the same YUV→RGB matrix implementation, chroma upsampling or rounding. Per `docs/design/bcf/cuccut-format-spec.md` §15.1, decoded video-frame pixels promise only **semantic equivalence + tolerance** (cross-backend grayscale SSIM ≥ 0.95). "Which frame is taken" remains a hard promise. Thumbnails are not golden.
 */

use std::path::Path;

use anyhow::Result;

mod encode;
mod frames;
mod scale;

#[cfg(target_os = "macos")]
mod encode_macos;
#[cfg(target_os = "windows")]
mod encode_windows;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod playback_windows;
#[cfg(target_os = "windows")]
mod windows;

pub use encode::{
    AUDIO_BITRATE, AUDIO_CHANNELS, AUDIO_SAMPLE_RATE, AudioInput, Mp4Options, Mp4Writer, PcmFormat,
    WavLayout, crf_bitrate, encode_available, encode_backend, frame_rate_rational, open_mp4_writer,
    open_mp4_writer_with_bitrate, open_mp4_writer_with_options, read_wav_layout, video_bitrate,
};
pub use frames::{
    DecodedFrameInfo, FrameStream, SequentialDecoder, open_frame_stream, open_sequential_decoder,
    prewarm_frame_stream,
};
#[cfg(target_os = "windows")]
pub use playback_windows::{
    DxgiAdapterLuid, DxgiFrameServer, DxgiPlaybackState, DxgiVideoFrame, open_dxgi_frame_server,
};
pub use scale::{resize_rgba, rotate_rgba, scaled_height};

/// One decoded frame: tightly packed top-down RGBA8 (stride = `width * 4`).
///
/// Alpha is always 255. Video frames have no transparency, and downstream code (`image` encoding JPEG, tiny-skia compositing) assumes an opaque canvas. Letting the platform decoder's "undefined alpha bytes" leak through would only turn into a black image.
#[derive(Clone, PartialEq, Eq)]
pub struct RgbaFrame {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

impl std::fmt::Debug for RgbaFrame {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("RgbaFrame")
            .field("width", &self.width)
            .field("height", &self.height)
            .field("bytes", &self.data.len())
            .finish()
    }
}

impl RgbaFrame {
    /// Constructs from tightly packed RGBA8 bytes. If the length does not match, it reports an error instead of leaving a half-built frame.
    pub fn new(width: u32, height: u32, data: Vec<u8>) -> Result<Self> {
        let expected = width as usize * height as usize * 4;
        if width == 0 || height == 0 || data.len() != expected {
            anyhow::bail!(
                "RGBA frame size does not match its byte count: {width}x{height} needs {expected} bytes, got {}",
                data.len()
            );
        }
        Ok(Self {
            width,
            height,
            data,
        })
    }

    /// The RGBA at `(x, y)`. Returns `None` when out of bounds. Used by tests and pixel checks.
    pub fn pixel(&self, x: u32, y: u32) -> Option<[u8; 4]> {
        if x >= self.width || y >= self.height {
            return None;
        }
        let offset = (y as usize * self.width as usize + x as usize) * 4;
        Some([
            self.data[offset],
            self.data[offset + 1],
            self.data[offset + 2],
            self.data[offset + 3],
        ])
    }
}

/// Whether the current platform has a native decoding implementation. Single-frame extraction and sequential frame streams are available together.
///
/// `true` does not mean every file can be decoded, since codecs and containers may still be unsupported. It only means "worth trying the native path first". Callers use it to decide whether to log an ffmpeg fallback when the native path fails.
pub const fn available() -> bool {
    cfg!(any(target_os = "macos", target_os = "windows"))
}

/// The identifier of the current platform's native backend. Per §15.1 "the decoding backend must be observable", it is used in diagnostic output.
pub const fn backend() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "avfoundation"
    }
    #[cfg(target_os = "windows")]
    {
        // Same name as the export backend identifiers in `native_video/platform.rs` and elsewhere (the unified value table of WP5b). In the repo, the Windows encoding side always writes "media-foundation" (with a hyphen). This place previously wrote "mediafoundation" on its own. No contract envelope has ever read this value (it only went into internal error text), so renaming it does not break compatibility.
        "media-foundation"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "none"
    }
}

/// Decodes one frame at `time_seconds`, scaled to `target_width`. The height follows the source's display aspect ratio and is aligned to an even number. Returns RGBA8.
///
/// Semantics aligned with the pre-migration `ffmpeg -ss <t> -i <src> -frames:v 1 -vf scale=<w>:-2`:
///
/// - **Which frame is taken**: the frame that covers `t`. If `t` falls within a frame's presentation interval, that frame is taken. It is not "the first keyframe after `t`". On macOS, `requestedTimeTolerance*` set to zero guarantees this. On Windows, advancing frame by frame by timestamp after the seek guarantees it.
/// - **Rotation**: the frame is rotated upright to display orientation according to the container's rotation metadata. ffmpeg CLI's autorotate is on by default, so the two paths agree. Note that this is a **different basis** from `naturalW/H` in `ccut-media-probe`, which is the encoded size without rotation.
/// - **Size**: the width is exactly `target_width`. The height follows from the display aspect ratio and is aligned to an even number ([`scaled_height`]). If the source is smaller than the target, it is scaled up too, unlike the platform API's `maximumSize`, which only scales down.
///
/// The size depends only on `(source display size, target_width)`, not on `t`. So every cell of a file's filmstrip has the same size, and the mosaic needs no further alignment.
pub fn extract_frame_rgba(path: &Path, time_seconds: f64, target_width: u32) -> Result<RgbaFrame> {
    if target_width == 0 {
        anyhow::bail!("target_width must be > 0");
    }
    let time = if time_seconds.is_finite() {
        time_seconds.max(0.0)
    } else {
        anyhow::bail!("time_seconds must be finite, got {time_seconds}");
    };
    #[cfg(target_os = "macos")]
    {
        macos::extract_frame_rgba(path, time, target_width)
    }
    #[cfg(target_os = "windows")]
    {
        windows::extract_frame_rgba(path, time, target_width)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (path, time, target_width);
        anyhow::bail!("unsupported: no native single-frame extraction backend on this platform (install ffmpeg to use the fallback path)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_reject_a_byte_count_that_does_not_match_the_geometry() {
        assert!(RgbaFrame::new(2, 2, vec![0; 16]).is_ok());
        assert!(RgbaFrame::new(2, 2, vec![0; 15]).is_err());
        assert!(RgbaFrame::new(0, 2, Vec::new()).is_err());
    }

    #[test]
    fn pixels_are_addressed_row_major_and_bounds_checked() {
        let frame = RgbaFrame::new(2, 1, vec![1, 2, 3, 255, 4, 5, 6, 255]).unwrap();
        assert_eq!(frame.pixel(0, 0), Some([1, 2, 3, 255]));
        assert_eq!(frame.pixel(1, 0), Some([4, 5, 6, 255]));
        assert_eq!(frame.pixel(2, 0), None);
        assert_eq!(frame.pixel(0, 1), None);
    }

    #[test]
    fn the_backend_label_matches_platform_availability() {
        assert_eq!(available(), backend() != "none");
    }

    #[test]
    fn non_finite_times_and_zero_widths_are_rejected_before_touching_the_platform() {
        let path = Path::new("/nonexistent.mp4");
        assert!(extract_frame_rgba(path, 0.0, 0).is_err());
        assert!(extract_frame_rgba(path, f64::NAN, 168).is_err());
        assert!(extract_frame_rgba(path, f64::INFINITY, 168).is_err());
    }
}
