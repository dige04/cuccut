//! MP4 composition: frame-level parallel rendering (deterministic, so any frame is independent), with native platform encoding as the primary path and ffmpeg as the fallback.
//! A DrawOp fingerprint drives the still-frame cache (the composition-time form of opencat's scene snapshot):
//! frames with the same fingerprint reuse the already rasterized RGBA, so dead-air segments cost zero rasterization.
//!
//! ## Encode backends: native first, ffmpeg fallback (WP6b)
//!
//! Final output used to be encoded always through the `ffmpeg -f rawvideo … -c:v libx264 -crf 18` pipe. Now [`media_native::open_mp4_writer`] is tried first (macOS = AVFoundation/VideoToolbox, Windows = Media Foundation), and the original ffmpeg pipe is used only if that cannot be opened. The fallback is **silent and automatic**:
//!
//! | Case | Backend |
//! | --- | --- |
//! | macOS / Windows, even-sized canvas | native |
//! | Odd-sized canvas (H.264 4:2:0 requires even dimensions; the ffmpeg path cannot encode it either, so the fallback only passes the error on to it) | ffmpeg |
//! | No usable H.264 / AAC encoder on this machine | ffmpeg |
//! | Linux ([`media_native::encode_available`] is false) | ffmpeg |
//!
//! The difference from the decode side (`media.rs`) lies in **how the quality target is expressed**: the ffmpeg path uses `-crf 18` (quality-oriented, bitrate grows out of the content), while hardware encoders have no CRF and can only take an average bitrate. So the quality target is translated into a bitrate curve that scales with resolution and frame rate (`media_native::video_bitrate`). Per `docs/design/bcf/cuccut-format-spec.md` §15.1, **the bytes of an export encode were never promised to be reproducible**, so the two paths only need to produce semantically equivalent output. Which backend was actually used is reported through [`RenderStats::encode_backend`].

use crate::assets::LoadedAssets;
use crate::fonts::TextEngine;
use crate::media::MediaStore;
use crate::plan::{CpuExecutor, FramePlanner, SurfaceCache, execute_plan_with_fingerprints};
use crate::renderer::FrameRenderer;
use anyhow::{Context, Result, bail};
use scene_primitives::resolve::Ir;
use std::collections::BinaryHeap;
use std::collections::VecDeque;
use std::io::Write;
use std::path::Path;
use std::process::{Child, ChildStdin, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};

/// Identifier of the ffmpeg fallback backend. The identifier of the native backend comes from [`media_native::encode_backend`] (`avfoundation` / `media-foundation`).
/// Same name and same value as [`crate::media::FFMPEG_BACKEND`] on the decode side: it is the same ffmpeg.
pub const FFMPEG_BACKEND: &str = crate::media::FFMPEG_BACKEND;

/// Quality targets for each of the two encode backends. [`VideoWriter::open`] uses [`Self::EXPORT`].
///
/// The two sides use different measures (see the module doc): the native encoder can only take an average bitrate, while the ffmpeg fallback uses CRF.
/// Callers that need higher fidelity (the BCF preview proxy, and exports that may be encoded again) raise each side separately.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EncodeQuality {
    /// Multiplier applied to the native average bitrate relative to the `media_native::video_bitrate` curve. The product is still clamped to the curve's own 60 Mb/s cap.
    pub bitrate_scale: f64,
    /// `-crf` for the ffmpeg (libx264) fallback.
    pub crf: u8,
}

impl EncodeQuality {
    /// Final export: the unmodified bitrate curve, `-crf 18`.
    pub const EXPORT: Self = Self {
        bitrate_scale: 1.0,
        crf: 18,
    };

    /// Bitrate handed to the native writer; `None` = the unmodified curve value (identical to [`VideoWriter::open`]).
    pub fn native_bitrate(&self, width: u32, height: u32, fps: f64) -> Option<u32> {
        (self.bitrate_scale != 1.0).then(|| {
            let base = f64::from(media_native::video_bitrate(width, height, fps));
            (base * self.bitrate_scale).round().clamp(1.0, 60_000_000.0) as u32
        })
    }
}

/// Final-output writer: the platform-native writer is preferred, and the ffmpeg pipe is used only if the native one cannot be opened.
///
/// Both paths are consumed the same way (RGBA is fed frame by frame, and `finish` closes the output); they differ only at the byte level.
pub enum VideoWriter {
    /// Platform-native MP4 writing (AVFoundation / Media Foundation).
    Native(media_native::Mp4Writer),
    /// `ffmpeg -f rawvideo … -c:v libx264 -crf 18` pipe.
    Ffmpeg(FfmpegWriter),
}

impl VideoWriter {
    /// Opens the writer. If the native path fails (unsupported geometry, no encoder, or not macOS/Windows), it silently falls back to ffmpeg, following the same rule as the fallback in the decode-side `MediaStore`.
    pub fn open(
        out: &Path,
        width: u32,
        height: u32,
        fps: f64,
        audio_pcm: Option<&Path>,
    ) -> Result<Self> {
        Self::open_with_quality(out, width, height, fps, audio_pcm, EncodeQuality::EXPORT)
    }

    /// Same as [`Self::open`], but sets each backend's quality target from `quality`.
    pub fn open_with_quality(
        out: &Path,
        width: u32,
        height: u32,
        fps: f64,
        audio_pcm: Option<&Path>,
        quality: EncodeQuality,
    ) -> Result<Self> {
        if media_native::encode_available()
            && let Ok(writer) = media_native::open_mp4_writer_with_bitrate(
                out,
                width,
                height,
                fps,
                audio_pcm,
                quality.native_bitrate(width, height, fps),
            )
        {
            return Ok(VideoWriter::Native(writer));
        }
        FfmpegWriter::with_crf(out, width, height, fps, audio_pcm, quality.crf)
            .map(VideoWriter::Ffmpeg)
    }

    /// The encode backend actually in use (the observability clause of §15.1).
    pub fn backend(&self) -> &'static str {
        match self {
            VideoWriter::Native(writer) => writer.backend(),
            VideoWriter::Ffmpeg(_) => FFMPEG_BACKEND,
        }
    }

    pub fn write_frame(&mut self, rgba: &[u8]) -> Result<()> {
        match self {
            VideoWriter::Native(writer) => writer.write_frame(rgba),
            VideoWriter::Ffmpeg(writer) => writer.write_frame(rgba),
        }
    }

    pub fn finish(self) -> Result<()> {
        match self {
            VideoWriter::Native(writer) => writer.finish(),
            VideoWriter::Ffmpeg(writer) => writer.finish(),
        }
    }
}

pub struct FfmpegWriter {
    child: Child,
    stdin: Option<ChildStdin>,
}

impl FfmpegWriter {
    pub fn new(
        out: &Path,
        width: u32,
        height: u32,
        fps: f64,
        audio_pcm: Option<&Path>,
    ) -> Result<Self> {
        Self::with_crf(
            out,
            width,
            height,
            fps,
            audio_pcm,
            EncodeQuality::EXPORT.crf,
        )
    }

    pub fn with_crf(
        out: &Path,
        width: u32,
        height: u32,
        fps: f64,
        audio_pcm: Option<&Path>,
        crf: u8,
    ) -> Result<Self> {
        let crf = crf.to_string();
        let mut cmd = crate::exec::command("ffmpeg");
        cmd.args([
            "-y",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            &format!("{width}x{height}"),
            "-r",
            &format!("{fps}"),
            "-i",
            "-",
        ]);
        if let Some(pcm) = audio_pcm {
            cmd.args(["-f", "f32le", "-ar", "48000", "-ac", "2"])
                .arg("-i")
                .arg(pcm);
            cmd.args([
                "-map",
                "0:v",
                "-map",
                "1:a",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-shortest",
            ]);
        } else {
            cmd.arg("-an");
        }
        cmd.args([
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            &crf,
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
        ])
        .arg(out)
        .stdin(Stdio::piped());
        let mut child = cmd
            .spawn()
            .context("failed to start ffmpeg (install ffmpeg on PATH or in a standard location such as Homebrew)")?;
        let stdin = child.stdin.take();
        Ok(FfmpegWriter { child, stdin })
    }

    pub fn write_frame(&mut self, rgba: &[u8]) -> Result<()> {
        self.stdin.as_mut().expect("ffmpeg stdin").write_all(rgba)?;
        Ok(())
    }

    pub fn finish(mut self) -> Result<()> {
        drop(self.stdin.take());
        let status = self.child.wait()?;
        if !status.success() {
            bail!("ffmpeg exited with status {status}");
        }
        Ok(())
    }
}

struct OrderedFrame(usize, Arc<Vec<u8>>, u64);

impl PartialEq for OrderedFrame {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}
impl Eq for OrderedFrame {}
impl PartialOrd for OrderedFrame {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for OrderedFrame {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other.0.cmp(&self.0) // Min-heap
    }
}

/// Cache of “output surface fingerprint → RGBA” shared across workers (a small LRU; static segments can hit across threads too). This is a **special case** of [`crate::plan::SurfaceCache`]: it caches only output surfaces, and stores the RGBA that has already been `take()`n out directly. A hit is passed to the encoder with zero copies; wrapping it in a `Pixmap` would cost an extra 8.3 MB (1080p) memcpy on every hit.
///
/// Capped by both frame count and bytes (design §6.6 / §12): one 4K frame is 33 MB, so limiting only by frame count would keep several hundred MB resident.
struct FrameCache {
    entries: Mutex<VecDeque<(u64, Arc<Vec<u8>>)>>,
    cap: usize,
    byte_cap: usize,
    hits: AtomicUsize,
}

impl FrameCache {
    fn new(cap: usize, byte_cap: usize) -> Self {
        FrameCache {
            entries: Mutex::new(VecDeque::new()),
            cap: cap.max(1),
            byte_cap: byte_cap.max(1),
            hits: AtomicUsize::new(0),
        }
    }
    fn get(&self, key: u64) -> Option<Arc<Vec<u8>>> {
        let q = self.entries.lock().unwrap();
        let hit = q.iter().find(|(k, _)| *k == key).map(|(_, v)| v.clone());
        if hit.is_some() {
            self.hits.fetch_add(1, Ordering::Relaxed);
        }
        hit
    }
    fn put(&self, key: u64, val: Arc<Vec<u8>>) {
        let mut q = self.entries.lock().unwrap();
        if q.iter().any(|(k, _)| *k == key) {
            return;
        }
        if val.len() > self.byte_cap {
            return;
        }
        q.push_back((key, val));
        let mut total: usize = q.iter().map(|(_, v)| v.len()).sum();
        while q.len() > self.cap || (total > self.byte_cap && q.len() > 1) {
            match q.pop_front() {
                Some((_, dropped)) => total -= dropped.len(),
                None => break,
            }
        }
    }
}

/// Byte cap for the frame cache (128 MB: about 15 frames at 1080p, about 3 at 4K).
const FRAME_CACHE_BYTES: usize = 128 << 20;

pub struct RenderStats {
    pub total_frames: usize,
    /// Number of frames that skipped rasterization due to a fingerprint hit (static segments)
    pub reused_frames: usize,
    /// Number of reuses of FramePlan intermediate surfaces (always 0 for a document without effects: the plan folds into a single Draw pass, so no intermediate surface exists at all)
    pub reused_surfaces: usize,
    /// Per-frame fingerprints (in frame-number order; used by the render manifest §15). **The value is the content fingerprint of the FramePlan output surface**, no longer the DrawOp primitive fingerprint; see the three-layer fingerprint in `plan::frame_plan`.
    pub fingerprints: Vec<u64>,
    /// The encode backend that actually wrote the final output (§15.1 “backends must be observable”): `avfoundation` / `media-foundation` / `ffmpeg`.
    pub encode_backend: &'static str,
}

fn write_mixed_audio_temp(bytes: &[u8]) -> Result<tempfile::NamedTempFile> {
    // tempfile follows the platform temp root (TMPDIR on Unix, GetTempPath on
    // Windows) and removes the raw mix on drop, including error paths.
    let mut file = tempfile::Builder::new()
        .prefix("ccut-mix-")
        .suffix(".f32le")
        .tempfile()
        .context("failed to create temporary audio mix file")?;
    file.write_all(bytes).context("failed to write temporary audio mix file")?;
    file.as_file_mut().flush().context("failed to flush temporary audio mix file")?;
    Ok(file)
}

/// Renders the whole film in parallel to MP4. Each worker gets one TextEngine (the font system is not Sync) plus a MediaStore.
pub fn render_video(
    ir: &Ir,
    renderer: &FrameRenderer,
    assets: Arc<LoadedAssets>,
    out: &Path,
    jobs: usize,
    progress: impl Fn(usize, usize),
) -> Result<RenderStats> {
    render_video_cancellable(ir, renderer, assets, out, jobs, |done, total| {
        progress(done, total);
        true
    })
}

/// Same as [`render_video`], except that the progress callback can request cancellation at safe frame boundaries.
/// After it returns `false`, the writer is finalized: the native path wraps the frames already written into a container, and the ffmpeg path closes stdin and waits for the child process to exit. Both leave a valid MP4 “truncated at the cancel point”. An error with a `cancelled:` prefix is returned, and the caller is responsible for deleting or keeping the temporary output file.
pub fn render_video_cancellable(
    ir: &Ir,
    renderer: &FrameRenderer,
    assets: Arc<LoadedAssets>,
    out: &Path,
    jobs: usize,
    progress: impl FnMut(usize, usize) -> bool,
) -> Result<RenderStats> {
    render_video_with_motion_blur(ir, renderer, assets, out, jobs, 1, progress)
}

/// Same as [`render_video_cancellable`], plus the number of motion-blur sub-frames (`ccut render --motion-blur`; for the definition see [`crate::motion_blur`]). With `motion_blur = 1` the output is byte-for-byte and fingerprint-for-fingerprint identical to the former.
pub fn render_video_with_motion_blur(
    ir: &Ir,
    renderer: &FrameRenderer,
    assets: Arc<LoadedAssets>,
    out: &Path,
    jobs: usize,
    motion_blur: u32,
    mut progress: impl FnMut(usize, usize) -> bool,
) -> Result<RenderStats> {
    crate::motion_blur::validate(motion_blur)?;
    let total_frames = (ir.total * ir.fps).round() as usize;
    let jobs = jobs.max(1).min(total_frames.max(1));

    // Audio mix (when there is an audio clip, the PCM encoder input is generated in the system temp directory): raw f32le, 48 kHz, interleaved stereo; both encode paths read the same format.
    // Rebuildable raw audio must not be written into the project output directory.
    let audio_pcm = match crate::audio::mix_audio(ir, &assets)? {
        Some(bytes) => Some(write_mixed_audio_temp(&bytes)?),
        None => None,
    };

    let mut writer = VideoWriter::open(
        out,
        renderer.width,
        renderer.height,
        ir.fps,
        audio_pcm.as_ref().map(|file| file.path()),
    )?;
    let encode_backend = writer.backend();
    let cache = FrameCache::new(4, FRAME_CACHE_BYTES);
    // Intermediate surface cache (both sides of transitions, effect chains). A document without effects produces no entries.
    let surfaces = SurfaceCache::with_frame_cap(8);
    // Preflight runs to completion before the per-frame work (design §6.5): capabilities, dimensions, and effect versions are all settled here.
    let planner = FramePlanner::cpu(ir)?;

    // A bounded channel limits memory (1080p RGBA ≈ 8.3 MB/frame)
    let (tx, rx) = mpsc::sync_channel::<OrderedFrame>(jobs * 2);

    let mut fingerprints = vec![0u64; total_frames];
    let result = std::thread::scope(|scope| -> Result<()> {
        for worker in 0..jobs {
            let tx = tx.clone();
            let assets = assets.clone();
            let cache = &cache;
            let surfaces = &surfaces;
            let planner = &planner;
            scope.spawn(move || {
                let mut engine = TextEngine::for_document(&assets.fonts);
                let mut media = MediaStore::new(assets.clone(), ir.fps);
                let mut executor = CpuExecutor::new(planner.capabilities().clone());
                let mut f = worker;
                while f < total_frames {
                    let t = f as f64 / ir.fps;
                    if motion_blur > 1 {
                        let Some((rgba, fp)) = blurred_frame(
                            planner,
                            renderer,
                            ir,
                            &mut engine,
                            &mut media,
                            &mut executor,
                            surfaces,
                            cache,
                            t,
                            motion_blur,
                        ) else {
                            return; // The main thread reports an error on a frame-count gap
                        };
                        if tx.send(OrderedFrame(f, rgba, fp)).is_err() {
                            return;
                        }
                        f += jobs;
                        continue;
                    }
                    let plan = planner.plan(renderer, ir, &mut engine, t);
                    // The frame fingerprint and the executor's intermediate-surface cache keys come from the same table: compute once and hand it to the executor for reuse. Only for a non-folded plan would the instruction stream otherwise be encoded twice per frame.
                    let Ok((fp, fingerprints)) = plan.frame_fingerprints() else {
                        return; // The main thread reports an error on a frame-count gap
                    };
                    let rgba: Arc<Vec<u8>> = match cache.get(fp) {
                        Some(hit) => hit,
                        None => {
                            let pixmap = match execute_plan_with_fingerprints(
                                &plan,
                                &mut executor,
                                &mut media,
                                Some(surfaces),
                                &fingerprints,
                            ) {
                                Ok(p) => p,
                                Err(_) => return, // The main thread reports an error on a frame-count gap
                            };
                            let data = Arc::new(pixmap.take());
                            cache.put(fp, data.clone());
                            data
                        }
                    };
                    if tx.send(OrderedFrame(f, rgba, fp)).is_err() {
                        return; // Write end is closed
                    }
                    f += jobs;
                }
            });
        }
        drop(tx);

        // Reorder by frame number, then write to the encoder in order
        let mut heap: BinaryHeap<OrderedFrame> = BinaryHeap::new();
        let mut next = 0usize;
        for frame in rx {
            heap.push(frame);
            while let Some(top) = heap.peek() {
                if top.0 != next {
                    break;
                }
                let OrderedFrame(idx, data, fp) = heap.pop().unwrap();
                fingerprints[idx] = fp;
                writer.write_frame(&data)?;
                next += 1;
                if next % 120 == 0 || next == total_frames {
                    if !progress(next, total_frames) {
                        bail!("cancelled: render was cancelled at a frame boundary");
                    }
                }
            }
        }
        if next != total_frames {
            bail!("render interrupted: {next}/{total_frames} frames");
        }
        Ok(())
    });

    let finish = writer.finish();
    result?;
    finish?;
    Ok(RenderStats {
        total_frames,
        reused_frames: cache.hits.load(Ordering::Relaxed),
        reused_surfaces: surfaces.hits(),
        fingerprints,
        encode_backend,
    })
}

/// Motion blur for one frame: each sub-frame goes through the plan and executor one at a time (the intermediate-surface cache still applies), then they are averaged and stored in the frame cache under the composite fingerprint.
/// Adjacent sub-frames with the same fingerprint are drawn only once and weighted by count, so static segments do not pay N times the cost.
#[allow(clippy::too_many_arguments)]
fn blurred_frame(
    planner: &FramePlanner,
    renderer: &FrameRenderer,
    ir: &Ir,
    engine: &mut TextEngine,
    media: &mut MediaStore,
    executor: &mut CpuExecutor,
    surfaces: &SurfaceCache,
    cache: &FrameCache,
    t: f64,
    samples: u32,
) -> Option<(Arc<Vec<u8>>, u64)> {
    use crate::motion_blur::{Accumulator, composite_fingerprint, subframe_times};
    let plans: Vec<_> = subframe_times(t, ir.fps, samples)
        .into_iter()
        .map(|sub| {
            let plan = planner.plan(renderer, ir, engine, sub);
            let table = plan.frame_fingerprints().ok()?;
            Some((plan, table))
        })
        .collect::<Option<_>>()?;
    let fps: Vec<u64> = plans.iter().map(|(_, (fp, _))| *fp).collect();
    let key = composite_fingerprint(samples, &fps);
    if let Some(hit) = cache.get(key) {
        return Some((hit, key));
    }
    let mut acc = Accumulator::new((renderer.width * renderer.height * 4) as usize);
    let mut index = 0;
    while index < plans.len() {
        let (plan, (fp, table)) = &plans[index];
        let run = plans[index..]
            .iter()
            .take_while(|(_, (other, _))| other == fp)
            .count();
        let pixmap =
            execute_plan_with_fingerprints(plan, executor, media, Some(surfaces), table).ok()?;
        acc.add(pixmap.data(), run as u32);
        index += run;
    }
    let data = Arc::new(acc.finish());
    cache.put(key, data.clone());
    Some((data, key))
}

#[cfg(test)]
mod tests {
    use super::write_mixed_audio_temp;

    #[test]
    fn mixed_audio_uses_platform_temp_and_is_removed_on_drop() {
        let path;
        {
            let file = write_mixed_audio_temp(&[0, 0, 0, 0]).unwrap();
            path = file.path().to_path_buf();
            assert!(path.starts_with(std::env::temp_dir()));
            assert_eq!(std::fs::read(&path).unwrap(), [0, 0, 0, 0]);
        }
        assert!(!path.exists());
    }

    #[test]
    fn encode_quality_scales_the_native_curve_within_its_ceiling() {
        use super::EncodeQuality;
        assert_eq!(EncodeQuality::EXPORT.native_bitrate(1920, 1080, 30.0), None);
        let proxy = EncodeQuality {
            bitrate_scale: 2.5,
            crf: 16,
        };
        let base = media_native::video_bitrate(1920, 1080, 30.0);
        assert_eq!(
            proxy.native_bitrate(1920, 1080, 30.0),
            Some((f64::from(base) * 2.5).round() as u32)
        );
        assert_eq!(proxy.native_bitrate(3840, 2160, 30.0), Some(60_000_000));
    }
}
