//! Frame-level media supply (the CLI version of opencat MediaContext::frame_rgba_at_time): each render thread holds one MediaStore. Video is decoded sequentially, and within a thread the media time only moves forward (guaranteed by stride framing); the decoder is reopened when it goes backwards.
//!
//! ## Decoding backends: native first, ffmpeg as fallback (WP6a)
//!
//! Video frames used to be supplied uniformly by an `ffmpeg … -f rawvideo -pix_fmt rgba -r <fps> -` pipe, one subprocess per clip. Now [`media_native::open_frame_stream`] is tried first (AVFoundation on macOS, Media Foundation on Windows), and only if it cannot decode does it fall back to the original ffmpeg pipe. The fallback is **silent and automatic** and does not change any picture contract:
//!
//! | Case | Backend |
//! | --- | --- |
//! | MP4/MOV on macOS / Windows (H.264 / HEVC / ProRes…) | native |
//! | WebM with alpha (must explicitly name `libvpx-vp9`, since platform decoders cannot open it) | ffmpeg |
//! | Containers / codecs the platform cannot open | ffmpeg |
//! | Linux (`media_native::available()` is false) | ffmpeg |
//!
//! Per `docs/design/bcf/cuccut-format-spec.md` §15.1, decoded video frame pixels only promise **semantic equivalence + tolerance** (cross-backend grayscale SSIM ≥ 0.95), while “which frame is taken” remains a hard guarantee. Within one render, a given source always uses the same backend, so byte-level assertions such as `drawops_are_byte_deterministic`, which compare a backend against itself twice, still hold. The backend actually used is exposed by [`MediaStore::video_backend`] (§15.1 “decoding backend must be observable”).

use crate::assets::{LoadedAssets, VideoInfo};
use crate::source::{MediaTime, VisualSource};
use anyhow::{Context, Result, anyhow, bail};
use std::collections::HashMap;
use std::io::Read;
use std::process::{Child, ChildStdout, Stdio};
use std::sync::Arc;
use tiny_skia::Pixmap;

/// Identifier of the ffmpeg fallback backend. The native backend's identifier comes from [`media_native::backend`] (`avfoundation` / `media-foundation`).
pub const FFMPEG_BACKEND: &str = "ffmpeg";

/// Forward-jump threshold (in composition frames) that triggers “reopen the decoder” in random-access mode.
///
/// Sequentially draining one 1080p H.264 frame takes about 5 ms, while reopening the decoder takes tens of milliseconds. 30 frames (exactly 1 second at composition fps = 30) is both above normal playback's frame-by-frame advance and prefetch (idx +1 each time), and above the export stride (the worker count, which is in practice far below 30), so sequential advance is never mistaken for a jump.
const RANDOM_ACCESS_REOPEN_FRAMES: i64 = 30;

/// Step size (seconds) used when reopening while stepping backwards, for when the start point falls after the end of the video stream and no frame can be read. First try the last-frame time given by the probed duration (usually this lands in one step and decodes only one frame). When the container duration, computed from the audio track, is longer than the video stream, step back further level by level, at most 32 s. Going further back means the source file itself is at fault, and the error is still reported as before.
const TAIL_BACKOFF_SECONDS: [f64; 4] = [0.5, 2.0, 8.0, 32.0];

/// The decoder currently in use. Both paths are consumed the same way: ask for the next frame in sequence; if none can be obtained, it is end of stream.
enum Decoder {
    /// Platform-native sequential frame stream (AVFoundation / Media Foundation).
    Native(media_native::FrameStream),
    /// `ffmpeg … -f rawvideo -pix_fmt rgba -r <fps> -` pipe.
    Ffmpeg { child: Child, stdout: ChildStdout },
}

struct VideoReader {
    info: VideoInfo,
    fps: f64,
    /// Media time at which the current decoder starts (the time of frame 0)
    origin: f64,
    /// Index of the next frame to read (relative to origin)
    next_idx: i64,
    decoder: Option<Decoder>,
    /// Decoding backend actually in use (§15.1 observability clause).
    backend: &'static str,
    /// The native path for this source has been judged unusable (unsupported, geometry mismatch, or an error mid-stream), so from then on it always goes through ffmpeg. A source never switches backends back and forth; otherwise the frames within one render would come from two decoders, and the cross-backend tolerance would turn into inter-frame jitter.
    native_disabled: bool,
    last: Option<Arc<Pixmap>>,
    last_idx: i64,
    eof: bool,
    /// Allows “reopen the decoder when jumping too far forward” (see [`MediaStore::set_random_access`]).
    random_access: bool,
    /// Keyframe snapping (see [`MediaStore::set_keyframe_snap`]): the frame time is snapped to the nearest keyframe before it, so a jump costs only “reopen + decode one frame”.
    snap: bool,
    /// When `last` is an **approximate frame** produced by snapping, this records the media time it represents. `None` = `last` is an exact frame. An exact request that meets `Some` must reopen from the target time, and must never drain forward from the keyframe grid, because that grid is offset by half a frame from the composition grid.
    approx: Option<f64>,
    /// Presentation time of the approximate frame itself (that keyframe): used to decide whether it can be reused when scrubbing again within the same GOP. Approximate frames from the resident decoder do not pass through the sequential stream, so `origin`/`last_idx` cannot say where they are.
    approx_pts: Option<f64>,
}

impl VideoReader {
    fn new(info: VideoInfo, fps: f64, random_access: bool) -> Self {
        VideoReader {
            info,
            fps,
            origin: 0.0,
            next_idx: 0,
            decoder: None,
            backend: FFMPEG_BACKEND,
            native_disabled: false,
            last: None,
            last_idx: i64::MIN,
            eof: false,
            random_access,
            snap: false,
            approx: None,
            approx_pts: None,
        }
    }

    /// Whether this source is worth trying the native path for first.
    fn native_eligible(&self) -> bool {
        // A non-empty `decoder` means WebM with alpha, which must name `libvpx-vp9` / `libvpx` (`assets::probe_alpha_decoder`). That is an ffmpeg-only capability: platform decoders cannot even open VP8/VP9 containers, let alone recover the alpha in `BlockAdditional`.
        media_native::available() && self.info.decoder.is_none()
    }

    /// Reopens the decoder from `from`: native first, falling back to ffmpeg if that fails.
    ///
    /// When a native stream is already in hand, first try an **in-place reopen** (same container parsing and tracks, only the reader is swapped). Random access goes through here on every jump, and container parsing and track lookup in a full reopen would be pure waste. If the in-place reopen fails, discard it and do a full reopen; the semantics are unchanged.
    fn open(&mut self, from: f64) -> Result<()> {
        self.approx = None;
        self.approx_pts = None;
        if !self.native_disabled
            && let Some(Decoder::Native(stream)) = self.decoder.as_mut()
            && stream.reopen(from).is_ok()
        {
            self.origin = from;
            self.next_idx = 0;
            self.eof = false;
            return Ok(());
        }
        self.close();
        if !self.native_disabled && self.native_eligible() {
            match media_native::open_frame_stream(&self.info.path, from, self.fps) {
                // The geometry must match, pixel for pixel, the **display size after rotation correction** probed at resource load time: the downstream `Pixmap` is built from `info.width × info.height`, and a size mismatch means wrong frames. Both the native stream of rotated footage and ffmpeg autorotate hand over display geometry, so they are no longer misjudged as native failures because of the encoded-size convention of `naturalW/H`.
                Ok(stream)
                    if (stream.width(), stream.height()) == (self.info.width, self.info.height) =>
                {
                    self.decoder = Some(Decoder::Native(stream));
                    self.backend = media_native::backend();
                    self.origin = from;
                    self.next_idx = 0;
                    self.eof = false;
                    return Ok(());
                }
                _ => self.native_disabled = true,
            }
        }
        self.spawn_ffmpeg(from)
    }

    fn spawn_ffmpeg(&mut self, from: f64) -> Result<()> {
        // -ss before -i: fast seek to the keyframe plus exact decoding up to the point; output is resampled to the composition fps
        let mut command = crate::exec::command("ffmpeg");
        command.args(["-loglevel", "error", "-ss", &format!("{from:.6}")]);
        // WebM with alpha must explicitly name `libvpx-vp9` / `libvpx`: ffmpeg's native vp9/vp8 decoders silently drop the alpha plane (`assets::probe_alpha_decoder`). `-c:v` must come **before** `-i` to take effect on the input.
        if let Some(decoder) = &self.info.decoder {
            command.args(["-c:v", decoder]);
        }
        let mut child = command
            .arg("-i")
            .arg(&self.info.path)
            .args([
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgba",
                "-r",
                &format!("{}", self.fps),
                "-",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .context("failed to start ffmpeg video decode")?;
        let stdout = child.stdout.take().context("ffmpeg did not provide a stdout pipe")?;
        self.decoder = Some(Decoder::Ffmpeg { child, stdout });
        self.backend = FFMPEG_BACKEND;
        self.origin = from;
        self.next_idx = 0;
        self.eof = false;
        Ok(())
    }

    fn close(&mut self) {
        if let Some(Decoder::Ffmpeg { mut child, .. }) = self.decoder.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    /// The decoder's next frame (straight RGBA, source size); `None` = end of the source.
    fn read_frame(&mut self) -> Result<Option<Vec<u8>>> {
        match self.decoder.as_mut() {
            Some(Decoder::Native(stream)) => Ok(stream.next_frame()?.map(|frame| frame.data)),
            Some(Decoder::Ffmpeg { stdout, .. }) => {
                let mut buf = vec![0u8; self.info.width as usize * self.info.height as usize * 4];
                // A pipe that cannot fill a whole frame means end of stream (ffmpeg's normal completion also takes this path).
                Ok(stdout.read_exact(&mut buf).ok().map(|()| buf))
            }
            None => Ok(None),
        }
    }

    /// Converts a decoded frame into a premultiplied `Pixmap` and records it as `last`.
    fn store_frame(&mut self, mut bytes: Vec<u8>) -> Result<Arc<Pixmap>> {
        premultiply_in_place(&mut bytes);
        let pixmap = Pixmap::from_vec(
            bytes,
            tiny_skia::IntSize::from_wh(self.info.width, self.info.height)
                .ok_or_else(|| anyhow!("zero-sized video"))?,
        )
        .ok_or_else(|| anyhow!("failed to construct decoded frame"))?;
        let pixmap = Arc::new(pixmap);
        self.last = Some(pixmap.clone());
        Ok(pixmap)
    }

    /// Keyframe-snapped frame fetch: the nearest keyframe before `mtime`. `Ok(None)` = this path cannot answer (no decoder has been opened yet, it is not a native stream, the platform does not provide a keyframe table, or decoding failed), and the caller takes the exact path.
    fn snapped_frame(&mut self, mtime: f64) -> Result<Option<Arc<Pixmap>>> {
        let Some(Decoder::Native(stream)) = self.decoder.as_mut() else {
            return Ok(None);
        };
        if self.approx == Some(mtime) && self.last.is_some() {
            return Ok(self.last.clone());
        }
        let Some(keyframe) = stream.sync_sample_at_or_before(mtime)? else {
            return Ok(None);
        };
        // A frame in hand that falls between [keyframe, mtime] is a valid approximation: while dragging through the same GOP, nothing is reopened or re-decoded. The approximate frame itself sits on the keyframe (`approx_pts`), while an exact frame is computed from its time on the grid.
        let shown = self.approx_pts.or_else(|| {
            (self.last_idx >= 0).then(|| self.origin + self.last_idx as f64 / self.fps)
        });
        if self.last.is_some()
            && let Some(shown) = shown
            && keyframe <= shown + 1e-6
            && shown <= mtime + 1e-6
        {
            self.approx = Some(mtime);
            return Ok(self.last.clone());
        }
        // Fast path: the resident keyframe decoder produces the image directly, and the sequential stream stays where it is (an exact request will reopen from the target time anyway).
        if let Some((pts, frame)) = stream.keyframe_at_or_before(mtime)? {
            self.last_idx = i64::MIN;
            let pixmap = self.store_frame(frame.data)?;
            self.approx = Some(mtime);
            self.approx_pts = Some(pts);
            return Ok(Some(pixmap));
        }
        // Slow path: reopen to the keyframe and decode one frame.
        self.open(keyframe)?;
        self.last_idx = i64::MIN;
        match self.read_frame() {
            Ok(Some(bytes)) => {
                self.next_idx = 1;
                self.last_idx = 0;
                let pixmap = self.store_frame(bytes)?;
                self.approx = Some(mtime);
                self.approx_pts = Some(keyframe);
                Ok(Some(pixmap))
            }
            // No frame can be read at the keyframe: let the exact path handle it from the beginning under its own rules (including end-of-stream freezing).
            Ok(None) => {
                self.close();
                Ok(None)
            }
            Err(_) => {
                // The native stream fails mid-way: same discipline as the exact path, so the whole source is demoted to ffmpeg.
                self.native_disabled = true;
                self.close();
                Ok(None)
            }
        }
    }

    /// The frame at media time mtime (quantized to the composition fps grid); past the end, the last frame is frozen.
    fn frame_at(&mut self, mtime: f64) -> Result<Arc<Pixmap>> {
        let mtime = mtime.max(0.0);
        if self.snap
            && let Some(pixmap) = self.snapped_frame(mtime)?
        {
            return Ok(pixmap);
        }
        if self.approx.take().is_some() {
            // A dragging approximate frame is in hand: the exact request reopens from the target time (in-place reopen is cheap), rather than draining forward along the keyframe grid, which would shift the composition grid by half a frame.
            self.open(mtime)?;
            self.last = None;
            self.last_idx = i64::MIN;
        }
        let seeks_backward = mtime + 1e-9 < self.origin;
        // A forward request after the end of the stream has already been reached (`eof` also closes the decoder): on the same origin, no frames with index ≥ `next_idx` exist, so freeze the last frame directly. It must not fall through to the `decoder.is_none()` reopen below, because that would open an empty decoder beyond the end of the stream, and after playback reaches the end, every frame from the second onward would report “no frame to read”.
        if self.eof
            && !seeks_backward
            && ((mtime - self.origin) * self.fps).round() as i64 >= self.last_idx
            && let Some(pixmap) = &self.last
        {
            return Ok(pixmap.clone());
        }
        if self.decoder.is_none() || seeks_backward {
            self.open(mtime)?;
            // Frame indices are relative to the origin. Once the origin moves, the old `last_idx` is no longer comparable, and keeping it would make the loop-wrap guard below mistake it for “frame index went backwards”. `last` is invalidated only on backward movement; on forward movement it is kept as a fallback for when no frame can be read.
            self.last_idx = i64::MIN;
            if seeks_backward {
                self.last = None;
            }
        }
        let mut idx = ((mtime - self.origin) * self.fps).round() as i64;
        // A loop animation wraps the media clock from the end back to the start within the same decoder origin. Comparing only `mtime < origin` cannot see this kind of backward movement: next_idx has already passed the target frame, and the old implementation would take the last frame of the previous pass as the first frame of the new pass. When the frame index goes backwards, reopen from the target time, consistent with the out-of-order sampling semantics of an explicit seek.
        if idx < self.last_idx {
            self.open(mtime)?;
            self.last = None;
            self.last_idx = i64::MIN;
            idx = 0;
        }
        if idx == self.last_idx
            && let Some(pixmap) = &self.last
        {
            return Ok(pixmap.clone());
        }
        // Random access (interactive preview): when jumping too far forward, reopen the decoder instead of decoding every intermediate frame only to discard them. One drag of the playhead can skip tens of thousands of frames, and draining would amount to decoding the whole video.
        if self.random_access && !self.eof && idx - self.next_idx >= RANDOM_ACCESS_REOPEN_FRAMES {
            // The reopen point takes the **target time on the composition grid** rather than mtime. After `open`, `origin = target` and `idx = 0`, and what is obtained is still the “source frame that contains target” (both AVAssetReader's timeRange and ffmpeg `-ss` yield samples that intersect the start point), landing on the same frame as sequential draining. The grid is also not shifted, and subsequent frame indices still step by 1/fps. Using mtime directly would move the grid onto mtime, producing a half-frame offset from the export's draining path.
            let raw = self.origin + idx as f64 / self.fps;
            // Past the end of the stream, clamp to the last decodable time. On the draining path that case is “freeze the last frame”, and the reopen path must give the same last frame rather than a start point from which no frame can be decoded. Computing this time requires the source frame rate and duration (the comment on `VideoInfo::fps` describes exactly this use). If either cannot be probed, reopen only when it is **certainly still inside the clip**, otherwise fall back to sequential draining: slower, but byte-identical with the export path.
            let target = if self.info.fps > 0.0 && self.info.duration > 0.0 {
                Some(raw.min((self.info.duration - 1.0 / self.info.fps).max(0.0)))
            } else if raw < self.info.duration {
                Some(raw)
            } else {
                None
            };
            if let Some(target) = target {
                self.open(target)?;
                // Invalidate only the frame index (otherwise idx = 0 would collide with the old last_idx). `last` is kept as a fallback, so that if no frame can be read even after reopening, the previous frame is still frozen instead of reporting an error.
                self.last_idx = i64::MIN;
                idx = 0;
            }
        }
        let mut latest: Option<Vec<u8>> = None;
        while !self.eof && self.next_idx <= idx {
            match self.read_frame() {
                Ok(Some(bytes)) => {
                    self.next_idx += 1;
                    latest = Some(bytes);
                }
                Ok(None) => {
                    self.eof = true; // End of the source: freeze the last frame
                    self.close();
                }
                // The native decoder fails mid-way: the whole source is demoted to ffmpeg, reopened from the same origin, the frames already passed are replayed, and all subsequent frames come from ffmpeg.
                Err(error) if matches!(self.decoder, Some(Decoder::Native(_))) => {
                    let _ = error;
                    self.native_disabled = true;
                    let origin = self.origin;
                    self.open(origin)?;
                    latest = None;
                }
                Err(error) => return Err(error),
            }
        }
        if let Some(bytes) = latest {
            self.store_frame(bytes)?;
            self.last_idx = self.next_idx - 1;
        } else if self.eof && self.next_idx == 0 {
            self.freeze_tail()?;
        }
        self.last
            .clone()
            .ok_or_else(|| anyhow!("video {} has no readable frame at t={mtime:.3}", self.info.path.display()))
    }

    /// No frame can be read from `origin` onward, meaning the origin falls after the end of the video stream. This happens when the clip or project is longer than the video stream (container duration is computed from the audio track, and encoders pad the tail), on a cold start or when seeking to the last few tens of milliseconds. Reopen while stepping backwards, sequentially drain to the end, and freeze the true last frame (the same frame that draining from the beginning to the end yields). If a fallback frame left over from before the jump is in hand, that is used instead. If nothing can be read at all, return as-is and let the caller report the error.
    fn freeze_tail(&mut self) -> Result<()> {
        let beyond = self.origin;
        let probed_end = (self.info.fps > 0.0 && self.info.duration > 0.0)
            .then(|| (self.info.duration - 1.0 / self.info.fps).max(0.0));
        let backoff = TAIL_BACKOFF_SECONDS
            .iter()
            .map(|seconds| (beyond - seconds).max(0.0));
        let mut tried = beyond;
        for from in probed_end.into_iter().chain(backoff) {
            // Only step backwards: each step must be earlier than the previous one, otherwise the same empty interval would be reopened for nothing.
            if from + 1e-9 >= tried {
                continue;
            }
            tried = from;
            self.open(from)?;
            self.last_idx = i64::MIN;
            let mut latest = None;
            loop {
                match self.read_frame() {
                    Ok(Some(bytes)) => {
                        self.next_idx += 1;
                        latest = Some(bytes);
                    }
                    Ok(None) => break,
                    // Same discipline as sequential draining: if the native decoder fails mid-way, the whole source is demoted to ffmpeg and restarted from the same starting point.
                    Err(_) if matches!(self.decoder, Some(Decoder::Native(_))) => {
                        self.native_disabled = true;
                        self.open(from)?;
                        latest = None;
                    }
                    Err(error) => return Err(error),
                }
            }
            self.eof = true;
            self.close();
            if let Some(bytes) = latest {
                self.store_frame(bytes)?;
                self.last_idx = self.next_idx - 1;
                return Ok(());
            }
            if from <= 0.0 {
                break;
            }
        }
        Ok(())
    }
}

/// ffmpeg's `-pix_fmt rgba` output is **straight** (non-premultiplied) RGBA, whereas the byte convention of `tiny_skia::Pixmap` is **premultiplied**. Using straight values as if they were premultiplied, without conversion, makes colors look too bright when compositing.
///
/// **On opaque video this is an identity transform** (α = 255 ⇒ `c·255/255 = c`), so nothing ever touched it before videos with alpha appeared. P7b's animated stickers (GIF → WebM with alpha) are the first sources that reach α < 255.
/// Per frame, the result is written back **only when there are actually semi-transparent pixels**; fully opaque frames only incur an extra read-only scan pass.
fn premultiply_in_place(rgba: &mut [u8]) {
    if rgba.chunks_exact(4).all(|px| px[3] == 255) {
        return;
    }
    for px in rgba.chunks_exact_mut(4) {
        // tiny-skia's own `ColorU8::premultiply`: the single rounding rule, the same function that `assets::decode_image_bytes` uses.
        let premultiplied = tiny_skia::ColorU8::from_rgba(px[0], px[1], px[2], px[3]).premultiply();
        px[0] = premultiplied.red();
        px[1] = premultiplied.green();
        px[2] = premultiplied.blue();
        px[3] = premultiplied.alpha();
    }
}

/// Cache of rasterized animated-image frames (`(source id, frame start in ms, target pixel size)` → pixels).
///
/// Animated images and vector animated images have **no decoder state**, so fetching a frame is a pure function. When the same cell is requested repeatedly, the only thing that can be saved is recomputation. There are many cases where this happens: pausing on one frame, dragging the playhead back and forth across it, a `loop` sticker cycling back to the same cell, and building a scene and fetching its texture at the same moment.
///
/// The limit is in bytes rather than entry count: one 1024² RGBA is 4 MB, and limiting by count on large assets would keep several hundred MB resident.
struct AnimatedFrameCache {
    entries: std::sync::Mutex<std::collections::VecDeque<(AnimatedFrameKey, Arc<Pixmap>)>>,
    byte_cap: usize,
}

type AnimatedFrameKey = (String, i64, u32, u32);

/// Byte limit for the animated-frame cache: 32 MB (about 8 frames at 1024², about 32 at 512²).
const ANIMATED_CACHE_BYTES: usize = 32 << 20;

impl AnimatedFrameCache {
    fn new(byte_cap: usize) -> Self {
        AnimatedFrameCache {
            entries: std::sync::Mutex::new(std::collections::VecDeque::new()),
            byte_cap: byte_cap.max(1),
        }
    }

    fn get(&self, key: &AnimatedFrameKey) -> Option<Arc<Pixmap>> {
        let entries = self.entries.lock().ok()?;
        entries
            .iter()
            .find(|(candidate, _)| candidate == key)
            .map(|(_, pixmap)| pixmap.clone())
    }

    fn put(&self, key: AnimatedFrameKey, value: Arc<Pixmap>) {
        let bytes = pixmap_bytes(&value);
        let Ok(mut entries) = self.entries.lock() else {
            return;
        };
        if bytes > self.byte_cap {
            return; // A single frame exceeds the budget: do not cache it, and do not evict all existing entries either
        }
        if entries.iter().any(|(candidate, _)| *candidate == key) {
            return;
        }
        entries.push_back((key, value));
        let mut total: usize = entries.iter().map(|(_, value)| pixmap_bytes(value)).sum();
        while total > self.byte_cap && entries.len() > 1 {
            match entries.pop_front() {
                Some((_, dropped)) => total -= pixmap_bytes(&dropped),
                None => break,
            }
        }
    }
}

fn pixmap_bytes(pixmap: &Pixmap) -> usize {
    pixmap.width() as usize * pixmap.height() as usize * 4
}

/// Single-threaded media supplier: image references LoadedAssets directly, animatedImage looks up the decoded frame table, and video holds a sequential decoder.
pub struct MediaStore {
    assets: Arc<LoadedAssets>,
    fps: f64,
    readers: HashMap<String, VideoReader>,
    /// A sampleable picture source prepared by the host (e.g. a BCF composition); it shares the source-time entry point with real video.
    external_video: HashMap<String, Box<dyn crate::raster::FrameMedia + Send>>,
    random_access: bool,
    keyframe_snap: bool,
    animated_cache: AnimatedFrameCache,
    image_cache: AnimatedFrameCache,
    video_cache: AnimatedFrameCache,
    /// Memo of the natural size of an animated SVG (decoded once and remembered; see [`MediaStore::vector_natural_size`]).
    svg_natural: std::sync::Mutex<HashMap<String, (u32, u32)>>,
}

/// A composition picture source provided by the host. Its metadata is used for layout; pixels are still requested by explicit source time.
pub struct ExternalVideoSource {
    pub info: VideoInfo,
    pub frames: Box<dyn crate::raster::FrameMedia + Send>,
    pub warning: Option<String>,
}

/// The target-size field in the cache key: `None` (natural size) must be distinguishable from any explicit size, and `(0, 0)` is not a valid target size, so it conveniently serves as “unspecified”.
fn target_key(target: Option<(u32, u32)>) -> (u32, u32) {
    target.unwrap_or((0, 0))
}

impl MediaStore {
    pub fn new(assets: Arc<LoadedAssets>, fps: f64) -> Self {
        MediaStore {
            assets,
            fps,
            readers: HashMap::new(),
            external_video: HashMap::new(),
            random_access: false,
            keyframe_snap: false,
            animated_cache: AnimatedFrameCache::new(ANIMATED_CACHE_BYTES),
            image_cache: AnimatedFrameCache::new(64 << 20),
            video_cache: AnimatedFrameCache::new(64 << 20),
            svg_natural: std::sync::Mutex::new(HashMap::new()),
        }
    }

    /// Turns on **random-access** mode: when jumping forward by more than [`RANDOM_ACCESS_REOPEN_FRAMES`] frames, reopen the decoder instead of draining the intermediate frames one by one.
    ///
    /// Off by default; the behaviour of export (`render_video_cancellable`) is unchanged in every respect. It advances in stride order, and draining is its normal mode of operation. Only interactive preview skips thousands of frames at once (dragging the playhead, opening a project to locate it), where draining would amount to decoding the whole video.
    ///
    /// Both paths obtain the **same source frame**: the reopen point lies on the composition grid (see `frame_at`), so the hard guarantee about “which frame is taken” in `docs/design/bcf/cuccut-format-spec.md` §15.1 is unaffected.
    pub fn set_random_access(&mut self, enabled: bool) {
        self.random_access = enabled;
        for reader in self.readers.values_mut() {
            reader.random_access = enabled;
        }
    }

    /// Turns on **keyframe-snap** mode: the frame time is snapped to the nearest keyframe before it, and only that frame is decoded.
    ///
    /// Used by interactive preview **while dragging**. An exact fetch decodes “from the keyframe up to the target” on every jump, which for a 1080p H.264 GOP of over a hundred frames takes tens of milliseconds, so the playhead visibly lags behind the hand. With snapping, each jump costs only reopen + decode one frame, and the picture is at most one GOP away from the target time. This is the experience older AppKit clients had while dragging (`AVPlayer`'s keyframe-tolerant seek). After release, turn it off: the next fetch returns to the exact path, and it **never** drains forward from the approximate frame (the grid is offset by half a frame) but reopens from the target time.
    ///
    /// Only native streams (AVFoundation) can supply a keyframe table. On the ffmpeg fallback and on other platforms this switch is a no-op, and behaviour matches the exact path. Off by default; export is unchanged.
    pub fn set_keyframe_snap(&mut self, enabled: bool) {
        self.keyframe_snap = enabled;
        for reader in self.readers.values_mut() {
            reader.snap = enabled;
        }
    }

    pub fn has_image(&self, id: &str) -> bool {
        self.assets.images.contains_key(id) || self.assets.bounded_images.contains_key(id)
    }

    pub fn with_image_cache_limit(mut self, bytes: usize) -> Self {
        self.image_cache = AnimatedFrameCache::new(bytes.clamp(1, 64 << 20));
        self
    }
    pub fn image_cache_resident_bytes(&self) -> usize {
        self.image_cache
            .entries
            .lock()
            .map(|entries| entries.iter().map(|(_, p)| pixmap_bytes(p)).sum())
            .unwrap_or(0)
    }
    pub fn image_frame(&self, id: &str) -> Result<Arc<Pixmap>> {
        if let Some(image) = self.assets.images.get(id) {
            return Ok(image.clone());
        }
        let path = self
            .assets
            .bounded_images
            .get(id)
            .ok_or_else(|| anyhow!("image resource {id} is not loaded"))?;
        self.assets.validate_media_file(path)?;
        let key = (id.to_owned(), -1, 0, 0);
        if let Some(hit) = self.image_cache.get(&key) {
            return Ok(hit);
        }
        let bytes = std::fs::read(path)?;
        let label = match image::guess_format(&bytes)? {
            image::ImageFormat::Png => "tile.png",
            image::ImageFormat::Jpeg => "tile.jpg",
            image::ImageFormat::WebP => "tile.webp",
            image::ImageFormat::Gif => "tile.gif",
            _ => bail!("unsupported format for BCF bounded image: {id}"),
        };
        let image = crate::assets::decode_image(label, &bytes)?;
        self.assets.validate_media_file(path)?;
        if let Some(meta) = self.assets.inputs.media.get(id)
            && (image.width() as f64 != meta.width || image.height() as f64 != meta.height)
        {
            bail!("BCF bounded image changed size after preparation: {id}");
        }
        let image = Arc::new(image);
        self.image_cache.put(key, image.clone());
        Ok(image)
    }

    pub fn image(&self, id: &str) -> Option<Arc<Pixmap>> {
        self.assets.images.get(id).cloned()
    }

    /// Whether this source was loaded as a **video**. The host uses it to decide how the media time is computed: for the same `kind: "sticker"` element, static assets always take -1, while dynamic assets must be fetched frame by frame according to `sticker.loop` (P7b). The criterion is kept here rather than letting the host guess from the file extension.
    pub fn has_video(&self, id: &str) -> bool {
        self.assets.videos.contains_key(id)
    }

    /// Whether this source is a pre-decoded GIF / APNG / animated WebP.
    ///
    /// Historically the Timeline's `SourceKind::Image` accepted both static-image and animated-image extensions, so the host must tell the two apart by container bytes. The element layer can no longer infer that it is constant from `kind == image`.
    pub fn has_animated(&self, id: &str) -> bool {
        self.assets.animated.contains_key(id)
            || self.assets.animated_svgs.contains_key(id)
            || self.assets.lotties.contains_key(id)
            || self.assets.programs.contains_key(id)
    }

    /// Whether this source is a Lottie (Timeline 0.7 `sources[].kind: "lottie"`). It uses the same frame-fetch path as animated images ([`MediaStore::animated_frame`]), except that its pixels are rasterized on the fly by `Lottie::sample` at the asset's native size.
    pub fn has_lottie(&self, id: &str) -> bool {
        self.assets.lotties.contains_key(id)
    }

    /// Duration of one cycle of an animated image. Timeline image/B-roll uses it to wrap the local clock back into the frame table; the loop/segment semantics of BCF `animatedImage` itself are still handled in core during recording.
    pub fn animated_duration(&self, id: &str) -> Option<f64> {
        self.assets
            .animated
            .get(id)
            .map(|source| source.metadata().duration())
            .or_else(|| {
                self.assets
                    .animated_svgs
                    .get(id)
                    .map(|source| source.duration())
            })
            .or_else(|| {
                self.assets
                    .lotties
                    .get(id)
                    .map(|source| source.metadata().duration())
            })
            .or_else(|| self.assets.programs.get(id).map(|source| source.duration()))
    }

    pub fn is_time_varying(&self, id: &str) -> bool {
        self.has_video(id) || self.has_animated(id)
    }

    pub fn media_duration(&self, id: &str) -> Option<f64> {
        self.video_duration(id)
            .or_else(|| self.animated_duration(id))
    }

    /// Duration of the video source (seconds). The `loop` modulo for dynamic stickers needs it.
    pub fn video_duration(&self, id: &str) -> Option<f64> {
        self.assets.videos.get(id).map(|info| info.duration)
    }

    /// The **last decodable time** on the video source (`duration - 1/fps`, floored at 0).
    ///
    /// `ffmpeg -ss` past the last frame cannot read any frame (a hard error, not a frozen last frame), so callers who want to “stop on the last frame” must clamp to this. When the source frame rate cannot be probed, fall back to `duration`: clamping is then ineffective, but there is no better estimate.
    pub fn video_last_frame_time(&self, id: &str) -> Option<f64> {
        if let Some(svg) = self.assets.animated_svgs.get(id) {
            return Some(((svg.duration() * 30.0).ceil() - 1.0).max(0.0) / 30.0);
        }
        if let Some(lottie) = self.assets.lotties.get(id) {
            // The frame table is an N+1-entry table of start times: the start of the last frame is the last sampleable time.
            let starts = lottie.frame_starts_ms();
            let last = starts.len().checked_sub(2).map_or(0, |index| starts[index]);
            return Some(last as f64 / 1000.0);
        }
        if let Some(program) = self.assets.programs.get(id) {
            let starts = program.frame_starts_ms();
            let last = starts.len().checked_sub(2).map_or(0, |index| starts[index]);
            return Some(last as f64 / 1000.0);
        }
        self.assets.videos.get(id).map(|info| {
            if info.fps > 0.0 {
                (info.duration - 1.0 / info.fps).max(0.0)
            } else {
                info.duration
            }
        })
    }

    /// Animated images: `sample(sourceTime)` is a single table lookup. Unlike video, there is no decoder state here, so there is no “reopen the pipe when going backwards”. Out-of-order and sequential sampling cost the same.
    pub fn animated_frame(&self, id: &str, mtime_ms: i64) -> Option<Result<Arc<Pixmap>>> {
        self.animated_frame_for_target(id, mtime_ms, None)
    }

    /// Natural size of **vector animated images** (Lottie / SMIL animated SVG). Bitmap animated images and video return `None`.
    ///
    /// Callers use it to measure geometry first, then decide how large a texture to make (see [`Self::animated_frame_for_target`]). Bitmap animated images are not in this category: their frame size is the source data itself, and fetching at a different size would only add one resampling pass, so it is cheaper to leave scaling to the GPU.
    pub fn vector_natural_size(&self, id: &str) -> Option<(u32, u32)> {
        if let Some(lottie) = self.assets.lotties.get(id) {
            let meta = lottie.metadata();
            return Some((meta.width.max(1), meta.height.max(1)));
        }
        if let Some(program) = self.assets.programs.get(id) {
            return Some((program.width().max(1), program.height().max(1)));
        }
        let svg = self.assets.animated_svgs.get(id)?;
        if let Some(size) = self.svg_natural.lock().ok()?.get(id) {
            return Some(*size);
        }
        // The natural size of an animated SVG is only known after decoding. Decode one frame, record the size, and do not decode again afterwards.
        let frame = svg.sample(0.0);
        let pixmap = crate::assets::decode_image("frame.svg", frame.as_bytes()).ok()?;
        let size = (pixmap.width().max(1), pixmap.height().max(1));
        if let Ok(mut natural) = self.svg_natural.lock() {
            natural.insert(id.to_owned(), size);
        }
        Some(size)
    }

    /// Fetches an animated-image frame; vector sources are rasterized at the **target pixel size** given by `target`.
    ///
    /// `target = None` means natural size (existing behaviour). Bitmap animated images always ignore `target`. The target size is part of the cache key: the same cell at two sizes is two images and must not replace each other.
    pub fn animated_frame_for_target(
        &self,
        id: &str,
        mtime_ms: i64,
        target: Option<(u32, u32)>,
    ) -> Option<Result<Arc<Pixmap>>> {
        let (target_width, target_height) = target_key(target);
        if let Some(svg) = self.assets.animated_svgs.get(id) {
            let key = (id.to_owned(), mtime_ms, target_width, target_height);
            if let Some(hit) = self.animated_cache.get(&key) {
                return Some(Ok(hit));
            }
            let frame = svg.sample(mtime_ms as f64 / 1000.0);
            let decoded = match target {
                // Proportional: the long edge lands on the target long edge and the short edge follows (same rounding rule as `decode_svg_at_long_edge`).
                Some((width, height)) => {
                    crate::assets::decode_svg_at_long_edge(frame.as_bytes(), width.max(height))
                }
                None => crate::assets::decode_image("frame.svg", frame.as_bytes()),
            };
            return Some(decoded.map(|pixmap| {
                let pixmap = Arc::new(pixmap);
                self.animated_cache.put(key, pixmap.clone());
                pixmap
            }));
        }
        if let Some(lottie) = self.assets.lotties.get(id) {
            let time = MediaTime::from_millis(mtime_ms);
            let meta = lottie.metadata();
            // The key uses the **frame start** rather than the requested time: any time within the same cell renders byte-identically (`Lottie::sample_scaled` only reads `frame_at`), and keying by request time would mean the cache never hits.
            let start_ms = meta.frame_start(time).millis();
            let key = (id.to_owned(), start_ms, target_width, target_height);
            if let Some(hit) = self.animated_cache.get(&key) {
                return Some(Ok(hit));
            }
            let (width, height) = target.unwrap_or((meta.width, meta.height));
            return Some(lottie.sample_scaled(time, width, height).map(|frame| {
                self.animated_cache.put(key, frame.pixmap.clone());
                frame.pixmap
            }));
        }
        if let Some(program) = self.assets.programs.get(id) {
            // Same as Lottie: the key is the frame start, and times within the same frame window share one image.
            let start_ms = program.frame_start_ms(mtime_ms);
            let key = (id.to_owned(), start_ms, target_width, target_height);
            if let Some(hit) = self.animated_cache.get(&key) {
                return Some(Ok(hit));
            }
            return Some(program.render(start_ms, target).map(|pixmap| {
                let pixmap = Arc::new(pixmap);
                self.animated_cache.put(key, pixmap.clone());
                pixmap
            }));
        }
        let src = self.assets.animated.get(id)?;
        let time = MediaTime::from_millis(mtime_ms);
        let start_ms = src.metadata().frame_start(time).millis();
        let key = (id.to_owned(), start_ms, 0, 0);
        if let Some(hit) = self.animated_cache.get(&key) {
            return Some(Ok(hit));
        }
        Some(src.sample(time).map(|frame| {
            self.animated_cache.put(key, frame.pixmap.clone());
            frame.pixmap
        }))
    }

    pub fn video_frame(&mut self, id: &str, mtime: f64) -> Result<Arc<Pixmap>> {
        if !mtime.is_finite() {
            bail!("media-time-invalid: source time is not finite");
        }
        if let Some(source) = self.external_video.get_mut(id) {
            return source.frame(id, (mtime.max(0.0) * 1000.0).round() as i64);
        }
        // Only validate a source when this frame actually needs it. Inactive
        // videos and the document's audio catalog are not polled every frame.
        if let Some(info) = self.assets.videos.get(id) {
            self.assets.validate_media_file(&info.path)?;
        }
        let cache_key = (id.to_owned(), mtime.max(0.0).to_bits() as i64, 0, 0);
        if !self.keyframe_snap
            && let Some(hit) = self.video_cache.get(&cache_key)
        {
            return Ok(hit);
        }
        if !self.readers.contains_key(id) {
            let info = self
                .assets
                .videos
                .get(id)
                .ok_or_else(|| anyhow!("video resource \"{id}\" is not loaded"))?
                .clone();
            let mut reader = VideoReader::new(info, self.fps, self.random_access);
            reader.snap = self.keyframe_snap;
            self.readers.insert(id.to_string(), reader);
        }
        let reader = self.readers.get_mut(id).expect("reader");
        let was_disabled = reader.native_disabled;
        let frame = reader.frame_at(mtime)?;
        if reader.native_disabled != was_disabled
            && let Ok(mut cache) = self.video_cache.entries.lock()
        {
            cache.clear();
        }
        if let Some(info) = self.assets.videos.get(id) {
            self.assets.validate_media_file(&info.path)?;
        }
        if !self.keyframe_snap {
            self.video_cache.put(cache_key, frame.clone());
        }
        Ok(frame)
    }

    /// The decoding backend actually in use for this video source (`avfoundation` / `media-foundation` / [`FFMPEG_BACKEND`]). `None` = no decoder has been opened for it yet.
    ///
    /// §15.1's “decoding backend must be observable”: native and ffmpeg pixels only promise semantic equivalence + tolerance, so any cross-path comparison or diagnostic must be able to state which side it measured.
    pub fn video_backend(&self, id: &str) -> Option<&'static str> {
        if self.external_video.contains_key(id) {
            return Some("composition");
        }
        self.readers.get(id).map(|reader| reader.backend)
    }

    /// Injects a prepared picture source. On replacement, the old decoder is released; the concrete compilation and dependency reads remain in the host.
    pub fn insert_video_source(
        &mut self,
        id: String,
        source: Box<dyn crate::raster::FrameMedia + Send>,
    ) {
        self.readers.remove(&id);
        self.external_video.insert(id, source);
    }
}

impl Drop for VideoReader {
    fn drop(&mut self) {
        self.close();
    }
}

#[cfg(test)]
mod tests {
    use super::premultiply_in_place;

    /// For opaque frames this is an identity transform: the pixels of existing videos do not change by a single byte.
    #[test]
    fn an_opaque_frame_passes_through_untouched() {
        let mut rgba = vec![10, 200, 30, 255, 0, 0, 0, 255, 255, 255, 255, 255];
        let before = rgba.clone();
        premultiply_in_place(&mut rgba);
        assert_eq!(rgba, before);
    }

    /// Frames with alpha are premultiplied using tiny-skia's rounding rule: α = 0 clears everything to zero, α = 128 is roughly half brightness, and α = 255 is unchanged.
    #[test]
    fn a_frame_with_alpha_is_premultiplied() {
        let mut rgba = vec![
            255, 255, 255, 0, // Fully transparent → all zeros
            255, 255, 255, 128, // Semi-transparent white
            200, 100, 50, 255, // Opaque, unchanged
        ];
        premultiply_in_place(&mut rgba);
        assert_eq!(&rgba[0..4], &[0, 0, 0, 0]);
        assert_eq!(rgba[7], 128);
        for channel in &rgba[4..7] {
            assert!(*channel <= 128 && *channel >= 126, "{channel}");
        }
        assert_eq!(&rgba[8..12], &[200, 100, 50, 255]);
    }

    /// Idempotent: bytes that are already premultiplied do not get darkened a second time when run through again (α = 255 and α = 0 are both fixed points, and intermediate values change only within rounding error). This guards against “someday someone calls it in two places”.
    #[test]
    fn premultiplying_a_fully_transparent_or_opaque_frame_is_idempotent() {
        let mut rgba = vec![9, 9, 9, 0, 7, 7, 7, 255];
        premultiply_in_place(&mut rgba);
        let once = rgba.clone();
        premultiply_in_place(&mut rgba);
        assert_eq!(rgba, once);
    }
}
