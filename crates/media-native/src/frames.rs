//! Sequential frame stream: the native main path that the BCF render pipeline uses to decode frames one by one (WP6a).
//!
//! The trade-off is **the exact opposite** of [`crate::extract_frame_rgba`]. That one takes "random time points, one frame at a time", where each call is worth paying for one precise seek. This one takes "one starting point, then keep moving forward". Re-seeking for every frame would drag the whole render down. So the two paths share platform code but each has its own objects: single frames use an image generator / seek + advance, while sequential streams use an asset reader / source reader and call `ReadSample` all the way through.
//!
//! ## Semantic alignment with the pre-migration `ffmpeg -ss <from> -i <src> -f rawvideo -r <fps> -`
//!
//! - **Start**: the first output frame at or after `from` is "the frame that covers `from`". The platform seek only guarantees landing on a keyframe no later than `from`, so the extra leading frames are dropped by timestamp in this module.
//! - **Frame-rate resampling**: output frame `k` has target time `from + k / fps`, and takes the **last decoded frame whose pts ≤ target time**. If the source frame rate is lower than the composition frame rate, frames are repeated (dup). If it is higher, frames are skipped (drop). This is exactly the CFR conversion that ffmpeg `-r` does on the output side.
//! - **Tail**: the last frame fills the grid according to its own presentation interval (`pts + duration`). Once the target time passes the right end of that interval, [`FrameStream::next_frame`] returns `None`. By its own rules, ffmpeg's `-r` adds one or two more frames at the tail; this module stops strictly at the right end of the interval. The caller (`VideoReader` in `ccut-render`) already **freezes the last frame** at EOF, and those one or two frames would be byte-identical to the frozen picture, so the difference is not observable.
//! - **Rotation**: the frames are rotated upright to display orientation according to the container's rotation metadata (ffmpeg CLI autorotate is on by default).
//!
//! ## Determinism boundary
//!
//! The pixels belong to the platform decoder. Only semantic equivalence plus tolerance is promised (`docs/design/bcf/cuccut-format-spec.md` §15.1, cross-backend grayscale SSIM ≥ 0.95). "Which frame is taken" is a hard promise, guaranteed by the timestamp rules above.

use std::path::Path;

use anyhow::{Result, bail};

use crate::RgbaFrame;

/// One frame handed over by the platform decoder.
pub(crate) struct DecodedFrame {
    /// Presentation timestamp on the media timeline, in seconds. **Absolute value**: it is not reset to zero by seeking, because the target times of frame-rate resampling are also absolute, and both sides must share the same origin.
    pub(crate) pts_seconds: f64,
    /// Presentation duration of this frame, in seconds. `None` = not provided by the container or decoder.
    ///
    /// It has one purpose only: detecting the **tail** of the stream. Without it, the only option is "hand out the last frame once, then EOF", and the output frame count would be one or two frames fewer than ffmpeg's (ffmpeg fills the last frame out to its own presentation interval). Downstream, EOF means a frozen last frame, so a few missing frames do not change the picture. But a mismatched frame count would make assertions like "the resampled frame count is correct" impossible to pin down.
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) frame: RgbaFrame,
}

/// Platform sequential decoder. It only does "hand out the next frame in decode order, plus its timestamp". Frame-rate resampling, dropping leading frames and EOF semantics are all consolidated in [`FrameStream`], so the two platforms do not each implement them.
pub(crate) trait FrameSource {
    /// Output size after rotation is applied (constant for the whole stream).
    fn size(&self) -> (u32, u32);
    /// Next decoded frame; `None` = the source has been fully decoded.
    fn next_decoded(&mut self) -> Result<Option<DecodedFrame>>;
    /// Restarts reading from `from_seconds` on **the same already-parsed source**.
    ///
    /// Random access (dragging the playhead in preview) has to change the starting point on every jump. A full rebuild (re-parsing the container, finding tracks, building the reader) takes roughly 20 ms on macOS, and re-parsing the container and finding tracks is pure waste. Where the platform can reuse the track object, only the reader is swapped here. The default is `Err`: the caller falls back to a full reopen, with the same semantics.
    fn reopen(&mut self, from_seconds: f64) -> Result<()> {
        let _ = from_seconds;
        bail!("unsupported: this platform's decoder does not support reopening in place")
    }
    /// The presentation time of the nearest **fully sync sample** (keyframe) at or before `time_seconds`.
    ///
    /// Only for preview scrubbing: while scrubbing, snapping the frame time to a keyframe saves the part of the jump that decodes from a keyframe to the target. `Ok(None)` = the platform cannot answer; the caller takes the exact path.
    fn sync_sample_at_or_before(&self, time_seconds: f64) -> Result<Option<f64>> {
        let _ = time_seconds;
        Ok(None)
    }
    /// Decodes directly the single frame at or before `time_seconds` (the nearest keyframe), along with its presentation time. **Does not move** the sequential stream's own position: the platform answers this with a separate, resident decoding path, and the sequential stream stays where it is.
    ///
    /// Only for preview scrubbing: when each drag lands in a new GOP, most of the cost of "reopen the reader + decode one frame" is the cold start of the decode session, which the resident decoder avoids. `Ok(None)` = the platform cannot answer (the caller falls back to reopen + decode one frame). `Err` only appears when the platform fails explicitly.
    fn keyframe_at_or_before(&mut self, time_seconds: f64) -> Result<Option<(f64, RgbaFrame)>> {
        let _ = time_seconds;
        Ok(None)
    }
    /// Same as [`next_decoded`](Self::next_decoded), but the pixels are written into the caller's buffer (its length changes per frame). Returns the time and the actual size.
    ///
    /// Used by [`SequentialDecoder`]: when exporting a finished video, frames are fetched one by one, and buffers rotate between the caller and the reader thread, so nothing is allocated per frame. The default implementation swaps in freshly allocated pixels (same semantics, just without saving the allocation). Platforms that can write directly into the buffer override it.
    fn next_decoded_into(&mut self, data: &mut Vec<u8>) -> Result<Option<DecodedInto>> {
        Ok(self.next_decoded()?.map(|decoded| {
            let RgbaFrame {
                width,
                height,
                data: pixels,
            } = decoded.frame;
            *data = pixels;
            DecodedInto {
                pts_seconds: decoded.pts_seconds,
                duration_seconds: decoded.duration_seconds,
                width,
                height,
            }
        }))
    }
}

/// The time and size of the frame that [`FrameSource::next_decoded_into`] wrote into the buffer.
pub(crate) struct DecodedInto {
    pub(crate) pts_seconds: f64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

/// Timestamp comparison tolerance: 1 microsecond. Both the composition frame rate and the source frame rate are rational numbers, and the error after conversion to f64 is far below this magnitude. A larger tolerance would take one extra frame at the boundary when going from 30 fps to 30 fps.
const PTS_EPSILON: f64 = 1e-6;

/// Sequential frame stream. Each call to [`next_frame`](Self::next_frame) takes the next frame on the composition frame-rate grid.
pub struct FrameStream {
    source: Box<dyn FrameSource>,
    /// Start media time of the stream, in seconds.
    from: f64,
    /// Composition frame rate.
    fps: f64,
    /// Next output frame number to produce (relative to `from`).
    next_index: u64,
    /// A decoded frame whose timestamp is still after the target (one-frame lookahead).
    pending: Option<DecodedFrame>,
    /// The platform decoder has already reported EOF.
    source_done: bool,
    /// Current valid frame (repeated when dup).
    current: Option<RgbaFrame>,
    /// The right end of the **open interval** of the current frame's presentation interval (`pts + duration`). `None` = duration unknown.
    current_end: Option<f64>,
}

// SAFETY: the platform objects held inside the stream (AVAssetReader / IMFSourceReader) are not UI objects with thread affinity, so they can be used on any thread. The contract is **exclusive use by one thread**: the `MediaStore` in `ccut-render` has one per render worker, built and used to the end on its own thread. After being moved across threads, it is used only by the new thread. Without this impl, `MediaStore` would go from "is Send" to "is not Send", a regression in the API that existing callers can see.
unsafe impl Send for FrameStream {}

/// Opens a sequential frame stream for `path`, starting at `from_seconds` and resampled to `fps`.
///
/// Returning `Err` means "this source cannot be decoded natively" (container or codec not supported, no platform implementation, or the file cannot be opened). **The caller must bring its own ffmpeg fallback**. This crate does not discover or start any external binary.
pub fn open_frame_stream(path: &Path, from_seconds: f64, fps: f64) -> Result<FrameStream> {
    if !fps.is_finite() || fps <= 0.0 {
        bail!("fps must be a positive finite value, got {fps}");
    }
    let from = if from_seconds.is_finite() {
        from_seconds.max(0.0)
    } else {
        bail!("from_seconds must be finite, got {from_seconds}");
    };
    let source = open_source(path, from, None)?;
    Ok(FrameStream::new(source, from, fps))
}

/// Platform sequential decoder. `size` is the desired delivery size (display orientation, after rotation). Where the platform can scale within the decode pipeline, it delivers this size directly (macOS). Where it cannot, it delivers the original size, and the caller does one CPU resample.
fn open_source(path: &Path, from: f64, size: Option<(u32, u32)>) -> Result<Box<dyn FrameSource>> {
    #[cfg(target_os = "macos")]
    let source = crate::macos::open_frame_source(path, from, size)?;
    #[cfg(target_os = "windows")]
    let source = {
        // The Media Foundation source reader does not request scaling here (the v2 export backend has none either). It delivers the original size, and `SequentialDecoder` resamples on the CPU.
        let _ = size;
        crate::windows::open_frame_source(path, from)?
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let source: Box<dyn FrameSource> = {
        let _ = (path, from, size);
        bail!("unsupported: no native sequential frame-stream backend on this platform (install ffmpeg to use the fallback path)")
    };
    Ok(source)
}

/// Native decoder that hands out frames in timestamp order. It does no frame-rate resampling: each call hands out the next frame in decode order, along with its presentation time.
///
/// For callers that advance by **arbitrary rational times** (exporting a finished video: the source times of variable-speed clips do not fall on any fixed grid). "The last frame with pts ≤ target time" is judged by the caller from the times it receives. It shares the platform decoder with [`FrameStream`]. The only difference is this layer.
///
/// - Pixels are tightly packed top-down RGBA8 (alpha is always 255, since video frames have no transparency). The BGRA → RGBA conversion stays in this crate.
/// - Delivery size: if `size` is given at open time, the delivered size is always that size. The platform scales within the decode pipeline (macOS's `AVAssetReaderTrackOutput` output settings carry the width and height). Where the platform does not do this (Windows' source reader does not request scaling), one box-filter resample is done on the CPU.
/// - Times are **absolute** values on the source media timeline (same origin as [`FrameStream`]).
pub struct SequentialDecoder {
    source: Box<dyn FrameSource>,
    size: Option<(u32, u32)>,
    /// If the size the platform delivers differs from `size`, decode into this first, then resample into the caller's buffer.
    scratch: Vec<u8>,
}

// SAFETY: same reasoning as `FrameStream`. The platform objects (AVAssetReader / IMFSourceReader) have no thread affinity. The contract is exclusive use by one thread: after being moved across threads, it is used only by the new thread.
unsafe impl Send for SequentialDecoder {}

/// The time and size of the frame handed out by [`SequentialDecoder::next_into`] (the pixels are in the caller's buffer).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DecodedFrameInfo {
    /// Presentation time on the media timeline, in seconds.
    pub pts_seconds: f64,
    /// Presentation duration of this frame, in seconds. `None` when neither the container nor the track provides it.
    pub duration_seconds: Option<f64>,
    pub width: u32,
    pub height: u32,
}

/// Opens a sequential decoder for `path` that reads from `from_seconds` (media timeline, in seconds). `size` is the desired delivery size (display orientation).
///
/// The start semantics are the same as [`open_frame_stream`]: the first frame is the one covering `from_seconds`. The platform decodes from the keyframe before it, and earlier frames are dropped by timestamp, either by the platform layer or by the caller. Returning `Err` means this source cannot be decoded natively, and the caller falls back to ffmpeg.
pub fn open_sequential_decoder(
    path: &Path,
    from_seconds: f64,
    size: Option<(u32, u32)>,
) -> Result<SequentialDecoder> {
    if !from_seconds.is_finite() {
        bail!("from_seconds must be finite, got {from_seconds}");
    }
    if let Some((width, height)) = size
        && (width == 0 || height == 0)
    {
        bail!("delivery size must be positive, got {width}x{height}");
    }
    let source = open_source(path, from_seconds.max(0.0), size)?;
    Ok(SequentialDecoder::new(source, size))
}

impl SequentialDecoder {
    pub(crate) fn new(source: Box<dyn FrameSource>, size: Option<(u32, u32)>) -> Self {
        Self {
            source,
            size,
            scratch: Vec::new(),
        }
    }

    /// Delivery size (display orientation): the given size if one was provided at open time, otherwise the source size reported by the platform.
    pub fn size(&self) -> (u32, u32) {
        self.size.unwrap_or_else(|| self.source.size())
    }

    /// Writes the next frame in decode order into `data` (its length is changed to one frame). `None` = the source has been fully decoded.
    pub fn next_into(&mut self, data: &mut Vec<u8>) -> Result<Option<DecodedFrameInfo>> {
        let Some((width, height)) = self.size else {
            return Ok(self.source.next_decoded_into(data)?.map(info));
        };
        let Some(decoded) = self.source.next_decoded_into(data)? else {
            return Ok(None);
        };
        if (decoded.width, decoded.height) == (width, height) {
            return Ok(Some(info(decoded)));
        }
        // The platform did not deliver the requested size, so do one resample on the CPU (the same box filter used to finish single-frame extraction).
        std::mem::swap(data, &mut self.scratch);
        let frame = RgbaFrame::new(
            decoded.width,
            decoded.height,
            std::mem::take(&mut self.scratch),
        )?;
        let resized = crate::scale::resize_rgba(&frame, width, height);
        self.scratch = frame.data;
        *data = resized.data;
        Ok(Some(DecodedFrameInfo {
            width,
            height,
            ..info(decoded)
        }))
    }

    /// Restarts reading from `from_seconds` on the same source. `Err` = the platform does not support it, or the reopen failed. The decoder is then in an undefined state, and the caller discards it and reopens.
    pub fn reopen(&mut self, from_seconds: f64) -> Result<()> {
        if !from_seconds.is_finite() {
            bail!("from_seconds must be finite, got {from_seconds}");
        }
        self.source.reopen(from_seconds.max(0.0))
    }
}

fn info(decoded: DecodedInto) -> DecodedFrameInfo {
    DecodedFrameInfo {
        pts_seconds: decoded.pts_seconds,
        duration_seconds: decoded.duration_seconds,
        width: decoded.width,
        height: decoded.height,
    }
}

impl FrameStream {
    pub(crate) fn new(source: Box<dyn FrameSource>, from: f64, fps: f64) -> Self {
        Self {
            source,
            from,
            fps,
            next_index: 0,
            pending: None,
            source_done: false,
            current: None,
            current_end: None,
        }
    }

    /// Output frame width (after rotation). Constant for the whole stream.
    pub fn width(&self) -> u32 {
        self.source.size().0
    }

    /// Output frame height (after rotation). Constant for the whole stream.
    pub fn height(&self) -> u32 {
        self.source.size().1
    }

    /// Restarts reading from `from_seconds` on the same source. The resampling grid is also re-anchored to the new start.
    ///
    /// On success, this stream has exactly the same semantics as one newly opened with `open_frame_stream(path, from_seconds, fps)`. `Err` means the platform does not support it or the reopen failed. In that case the stream is in an **undefined** state, and the caller should discard it and reopen completely.
    pub fn reopen(&mut self, from_seconds: f64) -> Result<()> {
        if !from_seconds.is_finite() {
            bail!("from_seconds must be finite, got {from_seconds}");
        }
        let from = from_seconds.max(0.0);
        self.source.reopen(from)?;
        self.from = from;
        self.next_index = 0;
        self.pending = None;
        self.source_done = false;
        self.current = None;
        self.current_end = None;
        Ok(())
    }

    /// The presentation time of the nearest keyframe at or before `time_seconds`. `None` = the platform cannot tell.
    pub fn sync_sample_at_or_before(&self, time_seconds: f64) -> Result<Option<f64>> {
        if !time_seconds.is_finite() {
            return Ok(None);
        }
        self.source.sync_sample_at_or_before(time_seconds.max(0.0))
    }

    /// The picture and presentation time of the nearest keyframe at or before `time_seconds`. It uses the platform's resident keyframe decoder and does not change this stream's position. `None` = the platform cannot answer (the caller falls back to [`reopen`](Self::reopen) + [`next_frame`](Self::next_frame)).
    pub fn keyframe_at_or_before(&mut self, time_seconds: f64) -> Result<Option<(f64, RgbaFrame)>> {
        if !time_seconds.is_finite() {
            return Ok(None);
        }
        self.source.keyframe_at_or_before(time_seconds.max(0.0))
    }

    /// The next frame on the composition frame-rate grid. `None` = the source is exhausted (the caller treats it as a "frozen last frame").
    pub fn next_frame(&mut self) -> Result<Option<RgbaFrame>> {
        if self.next_index == 0
            && let Some(first) = self.peek()?
            && first > self.from + PTS_EPSILON
        {
            // The first frame after the seek landing point is later than the requested start. Either `from` falls before the source's first frame, or the platform snapped the start to a later position. In this case ffmpeg **aligns the output timeline to the first frame** (the first decoded frame after `-ss` is output frame 0) instead of first padding with repeated frames. Here too, the origin is re-anchored.
            self.from = first;
        }
        let target = self.from + self.next_index as f64 / self.fps;
        let mut advanced = false;
        // Consume all frames with pts ≤ target time and keep the last one. The drop happens here.
        while let Some(pts) = self.peek()? {
            if pts > target + PTS_EPSILON {
                break;
            }
            self.take_pending();
            advanced = true;
        }
        if self.current.is_none() {
            // There is no valid frame yet (floating-point error after re-anchoring the origin, or a source with non-monotonic timestamps). Fill in with the frame in hand, and do not hand out an empty frame.
            if self.pending.is_some() {
                self.take_pending();
                advanced = true;
            }
        }
        let Some(frame) = self.current.as_ref() else {
            return Ok(None); // The source has no frames at all
        };
        if self.source_done {
            // Tail check. If the target time passes the right end of the last frame's presentation interval, it is EOF. If it is still inside the interval, one more copy is emitted per CFR (ffmpeg `-r` does the same at the tail). If the duration is unknown, fall back to "the last frame is handed out only once", which is safer than an endless dup.
            match self.current_end {
                Some(end) if target >= end - PTS_EPSILON => return Ok(None),
                None if !advanced => return Ok(None),
                _ => {}
            }
        }
        self.next_index += 1;
        // A dup here is one full-frame copy, the same cost as ffmpeg writing one more rawvideo copy into the pipe.
        Ok(Some(frame.clone()))
    }

    /// The last actually decoded frame and the exclusive end of its presentation
    /// interval, once the decoder has reached clean EOF. This does not extend the
    /// stream or guess a duration. Hosts can distinguish a short audio/container
    /// tail from missing video while retaining their own bounded tail policy.
    pub fn terminal_frame(&self) -> Option<(&RgbaFrame, f64)> {
        if !self.source_done || self.pending.is_some() {
            return None;
        }
        Some((self.current.as_ref()?, self.current_end?))
    }

    /// Promotes the lookahead frame to the current frame, and remembers the right end of its presentation interval.
    fn take_pending(&mut self) {
        let decoded = self.pending.take().expect("pending was checked non-empty before the call");
        self.current_end = decoded
            .duration_seconds
            .filter(|duration| duration.is_finite() && *duration > 0.0)
            .map(|duration| decoded.pts_seconds + duration);
        self.current = Some(decoded.frame);
    }

    /// The timestamp of the lookahead frame (asks the platform decoder for a frame first if needed).
    fn peek(&mut self) -> Result<Option<f64>> {
        if self.pending.is_none() && !self.source_done {
            match self.source.next_decoded()? {
                Some(decoded) => self.pending = Some(decoded),
                None => self.source_done = true,
            }
        }
        Ok(self.pending.as_ref().map(|decoded| decoded.pts_seconds))
    }
}

/// Warm-up: opens a frame stream for `path` near `from_seconds`, decodes one frame, then discards it.
///
/// The **first** time a file is opened in a process, you pay for container index parsing and decode-session setup (a cold open of a 1 GB-class H.264 file takes about 230 ms, and a second open in the same process about 12 ms). The first frame decode costs another 80 ms or so. These platform-layer caches are shared per process and per file, and do not depend on any particular stream object. The caller runs this once on a background thread while the document is loading and the plan is still being compiled, so the real frame fetch lands on a hot path.
///
/// Any failure is silent. Warm-up only speeds things up, and sources that cannot be opened are reported by the regular path.
pub fn prewarm_frame_stream(path: &Path, from_seconds: f64, fps: f64) {
    if let Ok(mut stream) = open_frame_stream(path, from_seconds, fps) {
        let _ = stream.next_frame();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Warm-up is silent for a source that does not exist. It only speeds things up, and the error is left to the regular path.
    #[test]
    fn prewarm_is_silent_on_missing_media() {
        let dir = std::env::temp_dir().join("ccut-media-native-prewarm-missing");
        prewarm_frame_stream(&dir.join("missing.mp4"), 12.5, 30.0);
        prewarm_frame_stream(&dir.join("missing.mp4"), f64::NAN, 0.0);
    }

    /// A fake decoder that emits frames from a given sequence of (pts, duration, brightness). This lets the frame-rate resampling rules be verified offline.
    /// `script` is the whole source. `reopen` simulates a platform seek: it re-emits from the first frame with pts ≤ from (or from the start if there is none).
    struct ScriptedSource {
        script: Vec<(f64, Option<f64>, u8)>,
        frames: std::vec::IntoIter<(f64, Option<f64>, u8)>,
    }

    impl ScriptedSource {
        fn new(script: Vec<(f64, Option<f64>, u8)>) -> Self {
            Self {
                frames: script.clone().into_iter(),
                script,
            }
        }
    }

    impl FrameSource for ScriptedSource {
        fn size(&self) -> (u32, u32) {
            (1, 1)
        }
        fn next_decoded(&mut self) -> Result<Option<DecodedFrame>> {
            Ok(self
                .frames
                .next()
                .map(|(pts_seconds, duration_seconds, value)| DecodedFrame {
                    pts_seconds,
                    duration_seconds,
                    frame: RgbaFrame::new(1, 1, vec![value, value, value, 255]).unwrap(),
                }))
        }
        fn reopen(&mut self, from_seconds: f64) -> Result<()> {
            let start = self
                .script
                .iter()
                .rposition(|(pts, _, _)| *pts <= from_seconds + PTS_EPSILON)
                .unwrap_or(0);
            self.frames = self.script[start..].to_vec().into_iter();
            Ok(())
        }
    }

    /// An evenly spaced sequence at source frame rate `source_fps`, with frame values 0, 1, 2…
    fn cfr(count: u8, source_fps: f64) -> Vec<(f64, Option<f64>, u8)> {
        (0..count)
            .map(|i| (f64::from(i) / source_fps, Some(1.0 / source_fps), i))
            .collect()
    }

    fn stream(frames: Vec<(f64, Option<f64>, u8)>, from: f64, fps: f64) -> FrameStream {
        FrameStream::new(Box::new(ScriptedSource::new(frames)), from, fps)
    }

    /// Reopening in place is the same as opening a new one: the start point, grid, lookahead frame and EOF state are all reset.
    #[test]
    fn reopen_matches_a_freshly_opened_stream() {
        let script = cfr(12, 10.0);
        // First read a stream to EOF (pending is empty, source_done is true, and current is the last frame).
        let mut reused = stream(script.clone(), 0.0, 10.0);
        while reused.next_frame().unwrap().is_some() {}
        reused.reopen(0.55).unwrap();
        let fresh = stream(script, 0.55, 10.0);
        assert_eq!(drain(reused), drain(fresh));
    }

    /// If the platform does not support in-place reopen, `reopen` reports an error, and the caller uses that to do a full reopen.
    #[test]
    fn reopen_without_platform_support_is_an_error() {
        struct Plain;
        impl FrameSource for Plain {
            fn size(&self) -> (u32, u32) {
                (1, 1)
            }
            fn next_decoded(&mut self) -> Result<Option<DecodedFrame>> {
                Ok(None)
            }
        }
        let mut stream = FrameStream::new(Box::new(Plain), 0.0, 10.0);
        assert!(stream.reopen(1.0).is_err());
        assert_eq!(stream.sync_sample_at_or_before(1.0).unwrap(), None);
    }

    fn drain(mut stream: FrameStream) -> Vec<u8> {
        let mut out = Vec::new();
        while let Some(frame) = stream.next_frame().unwrap() {
            out.push(frame.pixel(0, 0).unwrap()[0]);
        }
        out
    }

    /// Source frame rate = composition frame rate: frames pass through one by one, unchanged.
    #[test]
    fn a_matching_frame_rate_passes_every_frame_through_once() {
        assert_eq!(drain(stream(cfr(5, 10.0), 0.0, 10.0)), vec![0, 1, 2, 3, 4]);
    }

    /// Source 10 fps, composition 20 fps: each frame is copied once (dup), so the total frame count doubles. 0.3 seconds of material is exactly 6 frames on the 20 fps grid, which matches the frame count of ffmpeg `-r 20`.
    #[test]
    fn a_slower_source_duplicates_frames_to_fill_the_grid() {
        assert_eq!(
            drain(stream(cfr(3, 10.0), 0.0, 20.0)),
            vec![0, 0, 1, 1, 2, 2]
        );
    }

    /// Source 20 fps, composition 10 fps: every other frame is dropped (drop). 0.3 seconds of material is 3 frames on the 10 fps grid. The last frame's presentation interval ends at 0.30 s, so grid point 0.3 is already out of range.
    #[test]
    fn a_faster_source_drops_frames_to_fit_the_grid() {
        assert_eq!(drain(stream(cfr(6, 20.0), 0.0, 10.0)), vec![0, 2, 4]);
    }

    /// `from` falls between two frames: the first output frame is **the frame that covers it**, not the first frame after it.
    #[test]
    fn the_first_output_frame_covers_the_requested_start() {
        // 0.25 s falls inside frame 2's (0.2 s) presentation interval.
        assert_eq!(drain(stream(cfr(5, 10.0), 0.25, 10.0)), vec![2, 3, 4]);
    }

    /// The platform snapped the seek landing point to after the target (the first frame is already later than `from`). The output timeline is re-anchored to the first frame, and no run of repeated frames is padded in front of it.
    #[test]
    fn a_seek_that_overshoots_rebases_the_output_timeline_onto_the_first_frame() {
        let source = vec![(1.0, Some(0.1), 7), (1.1, Some(0.1), 8)];
        assert_eq!(drain(stream(source, 0.5, 10.0)), vec![7, 8]);
    }

    /// If the container does not provide frame durations, fall back to "the last frame is handed out only once". That way it never dups endlessly just because the presentation interval cannot be computed.
    #[test]
    fn an_unknown_frame_duration_falls_back_to_emitting_the_last_frame_once() {
        let source = vec![(0.0, None, 0), (0.1, None, 1)];
        assert_eq!(drain(stream(source, 0.0, 20.0)), vec![0, 0, 1]);
    }

    #[test]
    fn terminal_frame_reports_the_actual_final_frame_between_sampling_points() {
        let mut source = stream(cfr(3, 10.0), 0.0, 2.0);
        assert_eq!(source.terminal_frame(), None);
        assert_eq!(
            source.next_frame().unwrap().unwrap().pixel(0, 0).unwrap()[0],
            0
        );
        assert_eq!(source.terminal_frame(), None);
        assert!(source.next_frame().unwrap().is_none());
        let (last, end) = source.terminal_frame().unwrap();
        assert_eq!(last.pixel(0, 0).unwrap()[0], 2);
        assert!((end - 0.3).abs() < 1e-9);
        assert!(source.next_frame().unwrap().is_none());
    }

    #[test]
    fn terminal_frame_never_invents_an_unknown_duration_or_empty_frame() {
        let mut unknown = stream(vec![(0.0, None, 7)], 0.0, 2.0);
        assert!(unknown.next_frame().unwrap().is_some());
        assert!(unknown.next_frame().unwrap().is_none());
        assert_eq!(unknown.terminal_frame(), None);
        let mut empty = stream(Vec::new(), 0.0, 2.0);
        assert!(empty.next_frame().unwrap().is_none());
        assert_eq!(empty.terminal_frame(), None);
    }

    /// The sequential decoder hands out frames unchanged in decode order (no resampling), with the source's own times, written into the caller's buffer.
    #[test]
    fn the_sequential_decoder_passes_frames_in_order_with_their_own_times() {
        let mut decoder = SequentialDecoder::new(Box::new(ScriptedSource::new(cfr(3, 10.0))), None);
        assert_eq!(decoder.size(), (1, 1));
        let mut data = Vec::new();
        let mut seen = Vec::new();
        while let Some(info) = decoder.next_into(&mut data).unwrap() {
            assert_eq!((info.width, info.height, data.len()), (1, 1, 4));
            seen.push((info.pts_seconds, data[0]));
        }
        assert_eq!(seen, vec![(0.0, 0), (0.1, 1), (0.2, 2)]);
        // In-place reopen: hand out again, starting from the frame that covers the starting point.
        decoder.reopen(0.15).unwrap();
        assert_eq!(
            decoder.next_into(&mut data).unwrap().unwrap().pts_seconds,
            0.1
        );
    }

    /// When the platform does not deliver frames at the requested size, do one CPU resample. What is handed out is always the requested size, so the byte counts match.
    #[test]
    fn the_sequential_decoder_resamples_when_the_platform_ignores_the_requested_size() {
        let mut decoder =
            SequentialDecoder::new(Box::new(ScriptedSource::new(cfr(2, 10.0))), Some((3, 2)));
        assert_eq!(decoder.size(), (3, 2));
        let mut data = vec![9; 7];
        let info = decoder.next_into(&mut data).unwrap().unwrap();
        assert_eq!((info.width, info.height), (3, 2));
        assert_eq!(data, [0, 0, 0, 255].repeat(6));
        let info = decoder.next_into(&mut data).unwrap().unwrap();
        assert_eq!((info.pts_seconds, data.len()), (0.1, 24));
        assert_eq!(data[..4], [1, 1, 1, 255]);
        assert!(decoder.next_into(&mut data).unwrap().is_none());
    }

    /// An invalid starting point or delivery size is rejected before touching the platform.
    #[test]
    fn the_sequential_decoder_rejects_bad_arguments_before_touching_the_platform() {
        let path = Path::new("/nonexistent.mp4");
        assert!(open_sequential_decoder(path, f64::NAN, None).is_err());
        assert!(open_sequential_decoder(path, 0.0, Some((0, 10))).is_err());
        assert!(open_sequential_decoder(path, 0.0, None).is_err());
    }

    /// Empty source: no frames are handed out, and it goes straight to EOF. It is not a panic, and it is not an endless dup.
    #[test]
    fn an_empty_source_ends_immediately() {
        assert_eq!(drain(stream(Vec::new(), 0.0, 30.0)), Vec::<u8>::new());
    }

    /// Invalid parameters are rejected before touching the platform.
    #[test]
    fn invalid_rates_and_times_are_rejected_before_touching_the_platform() {
        let path = Path::new("/nonexistent.mp4");
        assert!(open_frame_stream(path, 0.0, 0.0).is_err());
        assert!(open_frame_stream(path, 0.0, f64::NAN).is_err());
        assert!(open_frame_stream(path, f64::NAN, 30.0).is_err());
    }
}
