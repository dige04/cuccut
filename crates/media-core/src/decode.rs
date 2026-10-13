//! Decoding: an ffmpeg child process decodes the picture into raw RGBA frames, read out through a pipe (`-f rawvideo -pix_fmt rgba`).
//!
//! Each video instance has one sequential decode stream: the source times requested only move forward, and the stream only reads forward, without repositioning frame by frame. Frame times come from the `showinfo`
//! filter (stderr), matched one-to-one with the frames on stdout; `-copyts` keeps the media's own timestamps, and subtracting the media's PTS origin gives the source time.
//! Frame selection follows the same rule as the preview's media element: take the last frame whose timestamp is not later than the target time (if the target is before the first frame, take the first frame; after reading to the end, stay on the last frame).
//! When going backwards or jumping far forward, the decode stream is reopened, starting from the keyframe before the target. ffmpeg applies rotation metadata automatically.
//! Each stream has a frame-reading thread that reads frames from the pipe ahead of frame selection (a bounded number of frames), so when a frame is needed, a frame ffmpeg has already decoded does not have to wait on the pipe.
//!
//! ## Native decoding first
//!
//! The caller can attach a platform-native sequential frame source with [`VideoDecoder::with_native`] (a [`FrameFeed`], for example an AVFoundation
//! asset reader). Once attached, each decode stream tries the native frame source first; frame selection, reopening on rewind or long jump, the frame-reading thread and buffer recycling all work the same as for ffmpeg streams.
//! The native frame source's timestamps must be on the same timeline as ffmpeg `-copyts` (the media's own PTS, including the PTS origin).
//! If the native source cannot be opened, fails midway, or cannot hand out a single frame, this decoder **switches permanently to ffmpeg** (continuing decoding from the same moment),
//! and the reason is recorded in [`VideoDecoder::fallback`]; reopens caused by the fallback are not counted in [`VideoDecoder::restarts`].
//! This crate depends on no platform library: the native frame source is constructed by the caller.

use std::io::{BufRead, BufReader, ErrorKind, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::mpsc::{Receiver, Sender, SyncSender, channel, sync_channel};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use crate::{MediaError, Picture, Tools, tail};

/// Tolerance (seconds) between a frame's timestamp and the target time: an exact source time converted to floating point may differ from the frame timestamp in the last digit.
const EPSILON: f64 = 1e-4;
/// When the target is this many seconds later than the next frame, seeking is faster than decoding through.
const JUMP_SECONDS: f64 = 5.0;
/// When reopening, look for a keyframe this many seconds before the target.
const SEEK_MARGIN: f64 = 0.05;
/// The frame-reading thread reads at most this many frames ahead (one buffer per frame; one 1080p RGBA frame is 8.3 MB).
const READ_AHEAD: usize = 2;

struct Timed {
    seconds: f64,
    picture: Picture,
}

/// What the frame-reading thread hands back: a frame (its pixels and its original timestamp on the media timeline), end of stream, or a read failure.
enum Chunk {
    Frame(Vec<u8>, f64),
    End,
    Failed(String),
    /// Native frame source failure (reason code, message): the decoder falls back to ffmpeg on this basis.
    NativeFailed(&'static str, String),
}

/// A platform-native sequential frame source: hands out RGBA frames in presentation order.
///
/// Each frame is written into `data` (its length must be exactly `width * height * 4`, tightly packed, top-down, alpha opaque), and returns the frame's
/// timestamp on the media timeline (seconds, consistent with ffmpeg `-copyts`, **not** minus the PTS origin); returns `None` at the end, or a message on failure.
/// The frame source is constructed and used only on the frame-reading thread, so it does not need `Send`.
pub trait FrameFeed {
    fn next_into(&mut self, data: &mut Vec<u8>) -> Result<Option<f64>, String>;
}

/// Open a native frame source: `(media path, start (seconds on the media timeline), output width, output height)`. The first frame should cover the start.
pub type FeedOpener = Arc<dyn Fn(&Path, f64, u32, u32) -> Result<Box<dyn FrameFeed>, String> + Send + Sync>;

/// Native decoding attached to a [`VideoDecoder`]: the backend name (for diagnostics, e.g. `avfoundation`) and how to open the frame source.
#[derive(Clone)]
pub struct NativeDecode {
    pub backend: &'static str,
    pub open: FeedOpener,
}

/// Record of a native decode falling back to ffmpeg. `reason` is an English code: `open-failed`, `read-failed`, `no-frames`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DecodeFallback {
    pub reason: &'static str,
    pub message: String,
}

struct Stream {
    /// The ffmpeg decode process; a native frame source has no child process.
    child: Option<Child>,
    /// Frames read ahead by the frame-reading thread (bounded).
    frames: Option<Receiver<Chunk>>,
    /// Used frame buffers are sent back to the frame-reading thread.
    recycle: Sender<Vec<u8>>,
    log: Arc<Mutex<String>>,
    /// Thread that reads stderr (the `showinfo` timestamps and log).
    reader: Option<JoinHandle<()>>,
    /// Thread that reads frames from stdout.
    puller: Option<JoinHandle<()>>,
}

impl Stream {
    fn stop(&mut self) {
        if let Some(child) = self.child.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
        // The frame-reading thread may be stuck sending into a full queue: drop the receiver first, then wait for it.
        drop(self.frames.take());
        if let Some(puller) = self.puller.take() {
            let _ = puller.join();
        }
        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }
}

/// Frame-reading thread: reads frames one by one from ffmpeg's stdout until the stream ends, pairs each with the timestamp from the stderr thread, and reads at most [`READ_AHEAD`] frames ahead of compositing.
fn pull_frames(mut stdout: ChildStdout, times: Receiver<f64>, spares: Receiver<Vec<u8>>, frames: SyncSender<Chunk>, len: usize) {
    loop {
        let mut data = spares.try_recv().unwrap_or_default();
        data.resize(len, 0);
        let chunk = match stdout.read_exact(&mut data) {
            Ok(()) => match times.recv() {
                Ok(pts) => Chunk::Frame(data, pts),
                Err(_) => Chunk::Failed("解码的帧没有时间戳".into()),
            },
            Err(e) if e.kind() == ErrorKind::UnexpectedEof => Chunk::End,
            Err(e) => Chunk::Failed(format!("读解码输出失败：{e}")),
        };
        let last = !matches!(chunk, Chunk::Frame(..));
        if frames.send(chunk).is_err() || last {
            break;
        }
    }
}

/// Native frame-reading thread: opens the frame source inside the thread (the frame source need not be `Send`) and reads frames one by one ahead of compositing, with the same rules as [`pull_frames`].
/// If it cannot be opened, a read fails, the size does not match, or there are no frames at all, that is handed back as [`Chunk::NativeFailed`], and the decoder falls back to ffmpeg.
fn pull_native(native: NativeDecode, path: PathBuf, from: f64, size: (u32, u32), spares: Receiver<Vec<u8>>, frames: SyncSender<Chunk>) {
    let mut feed = match (native.open)(&path, from, size.0, size.1) {
        Ok(feed) => feed,
        Err(message) => {
            let _ = frames.send(Chunk::NativeFailed("open-failed", message));
            return;
        }
    };
    let len = Picture::byte_len(size.0, size.1);
    let mut delivered = 0_u64;
    loop {
        let mut data = spares.try_recv().unwrap_or_default();
        let chunk = match feed.next_into(&mut data) {
            Ok(Some(pts)) if data.len() == len => {
                delivered += 1;
                Chunk::Frame(data, pts)
            }
            Ok(Some(_)) => Chunk::NativeFailed("read-failed", format!("原生解码交出的帧是 {} 字节，应为 {len}", data.len())),
            Ok(None) if delivered == 0 => Chunk::NativeFailed("no-frames", format!("原生解码从 {from:.3} 秒起一帧都没有")),
            Ok(None) => Chunk::End,
            Err(message) => Chunk::NativeFailed("read-failed", message),
        };
        let last = !matches!(chunk, Chunk::Frame(..));
        if frames.send(chunk).is_err() || last {
            break;
        }
    }
}

impl Drop for Stream {
    fn drop(&mut self) {
        self.stop();
    }
}

/// The sequential decode stream of one video instance.
pub struct VideoDecoder {
    tools: Tools,
    path: PathBuf,
    origin: f64,
    width: u32,
    height: u32,
    stream: Option<Stream>,
    current: Option<Timed>,
    next: Option<Timed>,
    /// One frame buffer kept while there is no decode stream; the next stream uses it first.
    spare: Vec<u8>,
    ended: bool,
    /// Whether a decode stream has been started before: any later start (after a rewind, a long jump, or reuse after being shut down) counts as a reopen.
    started: bool,
    restarts: u32,
    /// Generation number of the current frame: incremented each time a new frame is swapped in; it keeps counting across reopens and never goes back.
    generation: u64,
    /// The attached native decoder; cleared after falling back to ffmpeg, and not tried again.
    native: Option<NativeDecode>,
    /// Record of the native fallback (only the first one is kept).
    fallback: Option<DecodeFallback>,
    /// The source time the current stream started decoding from (if there is no current frame when falling back, decoding continues from here).
    from: f64,
}

impl VideoDecoder {
    /// `origin` is the media's PTS origin (seconds), and source time 0 corresponds to it. Output frames are scaled to `width`×`height`. ffmpeg starts only on the first frame fetch.
    pub fn new(tools: &Tools, path: &Path, origin: f64, width: u32, height: u32) -> VideoDecoder {
        VideoDecoder {
            tools: tools.clone(),
            path: path.to_path_buf(),
            origin,
            width,
            height,
            stream: None,
            current: None,
            next: None,
            spare: Vec::new(),
            ended: false,
            started: false,
            restarts: 0,
            generation: 0,
            native: None,
            fallback: None,
            from: 0.0,
        }
    }

    /// Try the native frame source first, falling back to ffmpeg on failure (see the module docs). Must be attached before the first frame fetch.
    pub fn with_native(mut self, native: NativeDecode) -> VideoDecoder {
        self.native = Some(native);
        self
    }

    /// In sequential export this is non-zero only when the media is reused after being idle, or on a rewind or long jump.
    /// In sequential export it should be 0. Reopens caused by a native fallback to ffmpeg are not counted.
    pub fn restarts(&self) -> u32 {
        self.restarts
    }

    /// The decode backend in use (or about to be used): the native backend name, or `ffmpeg`.
    pub fn backend(&self) -> &'static str {
        self.native.as_ref().map_or("ffmpeg", |native| native.backend)
    }

    /// Record of a native decode falling back to ffmpeg; `None` if no native decoder was attached or no fallback happened.
    pub fn fallback(&self) -> Option<&DecodeFallback> {
        self.fallback.as_ref()
    }

    /// The picture at source time `seconds`.
    pub fn frame_at(&mut self, seconds: f64) -> Result<&Picture, MediaError> {
        self.advance(seconds)?;
        Ok(&self.current.as_ref().expect("advance 成功就有当前帧").picture)
    }

    /// Advance to the picture at source time `seconds` (same rules as [`frame_at`](Self::frame_at)), and return the current frame's generation number: the same value as last time means it is still the same frame.
    pub fn advance(&mut self, seconds: f64) -> Result<u64, MediaError> {
        let target = seconds + EPSILON;
        let behind = self.current.as_ref().is_some_and(|c| target < c.seconds);
        let far = self.next.as_ref().is_some_and(|n| seconds - n.seconds > JUMP_SECONDS);
        if self.stream.is_none() && !self.ended || behind || far {
            if self.started {
                self.restarts += 1;
            }
            self.start(seconds)?;
        }
        loop {
            if self.next.is_none() && !self.ended {
                self.next = self.read()?;
                if self.next.is_none() {
                    self.ended = true;
                    if let Some(mut stream) = self.stream.take() {
                        stream.stop();
                    }
                }
            }
            match &self.next {
                Some(next) if next.seconds <= target || self.current.is_none() => {
                    let next = self.next.take().expect("上面看过");
                    self.generation += 1;
                    if let Some(old) = self.current.replace(next) {
                        self.recycle(old.picture.data);
                    }
                }
                _ => break,
            }
        }
        match &self.current {
            Some(_) => Ok(self.generation),
            None => Err(MediaError::new(
                "EXPORT_DECODE_FAILED",
                format!("{} 里解不出画面", self.path.display()),
            )),
        }
    }

    /// Swap the current frame's pixels out, leaving `spare` in their place (any length; it is later recycled to the frame-reading thread). The caller takes the pixels and does not copy them again.
    /// After the swap, the current frame's pixels are no longer valid until [`advance`](Self::advance) swaps in a new frame (the generation changes);
    /// do not read the same frame again with [`frame_at`](Self::frame_at). `None` if there is no current frame.
    pub fn swap_current(&mut self, spare: Vec<u8>) -> Option<Picture> {
        let current = self.current.as_mut()?;
        let data = std::mem::replace(&mut current.picture.data, spare);
        Some(Picture {
            width: current.picture.width,
            height: current.picture.height,
            data,
        })
    }

    /// Stop the decode process and drop all state except the last frame.
    pub fn close(&mut self) {
        if let Some(mut stream) = self.stream.take() {
            stream.stop();
        }
        self.current = None;
        self.next = None;
        self.ended = false;
    }

    fn start(&mut self, seconds: f64) -> Result<(), MediaError> {
        if let Some(mut stream) = self.stream.take() {
            stream.stop();
        }
        if let Some(old) = self.current.take() {
            self.spare = old.picture.data;
        }
        self.next = None;
        self.ended = false;
        self.started = true;
        self.open_stream(seconds)
    }

    /// Open a decode stream from source time `seconds` (native if available), leaving the current frame untouched.
    fn open_stream(&mut self, seconds: f64) -> Result<(), MediaError> {
        if let Some(mut stream) = self.stream.take() {
            stream.stop();
        }
        self.from = seconds;
        let (frames, pulled) = sync_channel(READ_AHEAD);
        let (recycle, spares) = channel();
        let spare = std::mem::take(&mut self.spare);
        if !spare.is_empty() {
            let _ = recycle.send(spare);
        }
        if let Some(native) = self.native.clone() {
            // The native frame source uses the same timeline as ffmpeg `-copyts`, so the start must include the PTS origin. The first frame the native reader hands out already covers the start,
            // so there is no need to leave a margin before it to find a keyframe, as ffmpeg does.
            let from = (self.origin + seconds).max(0.0);
            let path = self.path.clone();
            let size = (self.width, self.height);
            let puller = std::thread::spawn(move || pull_native(native, path, from, size, spares, frames));
            self.stream = Some(Stream {
                child: None,
                frames: Some(pulled),
                recycle,
                log: Arc::new(Mutex::new(String::new())),
                reader: None,
                puller: Some(puller),
            });
            return Ok(());
        }
        let seek = seconds - SEEK_MARGIN;
        let mut command = Command::new(&self.tools.ffmpeg);
        command.args(["-hide_banner", "-nostdin", "-nostats", "-loglevel", "info"]);
        if seek > 0.0 {
            command.args(["-noaccurate_seek", "-ss", &format!("{seek:.6}")]);
        }
        command
            .arg("-copyts")
            .arg("-i")
            .arg(&self.path)
            .args(["-map", "0:v:0", "-an", "-sn", "-dn", "-vf"])
            .arg(format!("showinfo,scale={}:{}:flags=bicubic,format=rgba", self.width, self.height))
            .args(["-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|e| MediaError::spawn(&self.tools.ffmpeg, e))?;
        let stdout = child.stdout.take().expect("管道");
        let stderr = child.stderr.take().expect("管道");
        let (sender, times) = channel();
        let log = Arc::new(Mutex::new(String::new()));
        let sink = Arc::clone(&log);
        let reader = std::thread::spawn(move || {
            let mut last = f64::NAN;
            for line in BufReader::new(stderr).lines() {
                let Ok(line) = line else { break };
                if line.contains("Parsed_showinfo") && line.contains(" n:") {
                    let time = pts_time(&line).unwrap_or(last);
                    last = time;
                    if sender.send(time).is_err() {
                        break;
                    }
                } else if !line.contains("Parsed_showinfo") {
                    let mut log = sink.lock().expect("锁");
                    if log.len() < 64 * 1024 {
                        log.push_str(&line);
                        log.push('\n');
                    }
                }
            }
        });
        let len = Picture::byte_len(self.width, self.height);
        let puller = std::thread::spawn(move || pull_frames(stdout, times, spares, frames, len));
        self.stream = Some(Stream {
            child: Some(child),
            frames: Some(pulled),
            recycle,
            log,
            reader: Some(reader),
            puller: Some(puller),
        });
        Ok(())
    }

    /// Used frame buffer: sent back to the frame-reading thread when a decode stream exists, otherwise kept for the next stream.
    fn recycle(&mut self, data: Vec<u8>) {
        match &self.stream {
            Some(stream) => {
                let _ = stream.recycle.send(data);
            }
            None => self.spare = data,
        }
    }

    /// Native frame source failure: record the reason, detach the native source, and open an ffmpeg stream from the current frame (or from this stream's start if there is none). The current frame is kept,
    /// and frames read afterwards replace it as usual with "the last frame not later than the target". Not counted as a reopen.
    fn fall_back(&mut self, reason: &'static str, message: String) -> Result<(), MediaError> {
        let Some(native) = self.native.take() else {
            return Err(MediaError::new("EXPORT_DECODE_FAILED", message));
        };
        if self.fallback.is_none() {
            self.fallback = Some(DecodeFallback {
                reason,
                message: format!("{}: {message}", native.backend),
            });
        }
        let resume = self.current.as_ref().map_or(self.from, |current| current.seconds.max(0.0));
        self.open_stream(resume)
    }

    /// Read the next frame (if the frame-reading thread has already read it, do not wait); `None` at the end of the stream. Reports an error if the process fails or there are no frames at all.
    fn read(&mut self) -> Result<Option<Timed>, MediaError> {
        let Some(stream) = self.stream.as_mut() else {
            return Ok(None);
        };
        let chunk = stream.frames.as_ref().and_then(|frames| frames.recv().ok()).unwrap_or(Chunk::End);
        let (data, pts) = match chunk {
            Chunk::Frame(data, pts) => (data, pts),
            Chunk::End => {
                let status = stream.child.as_mut().and_then(|child| child.wait().ok());
                if let Some(puller) = stream.puller.take() {
                    let _ = puller.join();
                }
                if let Some(reader) = stream.reader.take() {
                    let _ = reader.join();
                }
                let failed = status.is_some_and(|s| !s.success());
                if failed && self.current.is_none() {
                    let log = stream.log.lock().expect("锁").clone();
                    return Err(MediaError::new(
                        "EXPORT_DECODE_FAILED",
                        format!("解码 {} 失败：{}", self.path.display(), tail(&log, 3)),
                    ));
                }
                return Ok(None);
            }
            Chunk::Failed(message) => return Err(MediaError::new("EXPORT_DECODE_FAILED", message)),
            Chunk::NativeFailed(reason, message) => {
                self.fall_back(reason, message)?;
                return self.read();
            }
        };
        let seconds = if pts.is_finite() {
            pts - self.origin
        } else {
            self.current.as_ref().map_or(0.0, |c| c.seconds)
        };
        Ok(Some(Timed {
            seconds,
            picture: Picture {
                width: self.width,
                height: self.height,
                data,
            },
        }))
    }
}

fn pts_time(line: &str) -> Option<f64> {
    let rest = &line[line.find("pts_time:")? + "pts_time:".len()..];
    rest.split_whitespace().next()?.parse().ok()
}

/// Decode an image (or the first frame of a video) into one frame, scaled to `width`×`height`. GIFs and animated images take only the first frame.
pub fn decode_still(tools: &Tools, path: &Path, width: u32, height: u32) -> Result<Picture, MediaError> {
    let output = Command::new(&tools.ffmpeg)
        .args(["-hide_banner", "-nostdin", "-nostats", "-loglevel", "error", "-i"])
        .arg(path)
        .args(["-map", "0:v:0", "-frames:v", "1", "-vf"])
        .arg(format!("scale={width}:{height}:flags=bicubic,format=rgba"))
        .args(["-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"])
        .stdin(Stdio::null())
        .output()
        .map_err(|e| MediaError::spawn(&tools.ffmpeg, e))?;
    let expected = Picture::byte_len(width, height);
    if !output.status.success() || output.stdout.len() < expected {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::new(
            "EXPORT_DECODE_FAILED",
            format!("解码 {} 失败：{}", path.display(), tail(&stderr, 3)),
        ));
    }
    let mut data = output.stdout;
    data.truncate(expected);
    Ok(Picture { width, height, data })
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Mutex};

    use super::{FeedOpener, FrameFeed, NativeDecode, VideoDecoder, pts_time};
    use crate::Tools;

    /// Fake native frame source: 10 fps, `count` frames, media timeline starting at `origin`; each frame's pixels are filled with its frame number; frame `fail_at` reports an error.
    struct Fake {
        next: u32,
        count: u32,
        origin: f64,
        fail_at: Option<u32>,
        len: usize,
    }

    impl FrameFeed for Fake {
        fn next_into(&mut self, data: &mut Vec<u8>) -> Result<Option<f64>, String> {
            if Some(self.next) == self.fail_at {
                return Err("坏帧".into());
            }
            if self.next >= self.count {
                return Ok(None);
            }
            data.clear();
            data.resize(self.len, self.next as u8);
            let pts = self.origin + f64::from(self.next) / 10.0;
            self.next += 1;
            Ok(Some(pts))
        }
    }

    /// Open record (start on the media timeline) and frame source factory. With `fail_open`, it cannot be opened.
    fn fake(origin: f64, fail_open: bool, fail_at: Option<u32>) -> (NativeDecode, Arc<Mutex<Vec<f64>>>) {
        let opens = Arc::new(Mutex::new(Vec::new()));
        let seen = Arc::clone(&opens);
        let open: FeedOpener = Arc::new(move |_: &Path, from: f64, width: u32, height: u32| {
            seen.lock().unwrap().push(from);
            if fail_open {
                return Err("不支持的编码".to_string());
            }
            let first = ((from - origin) * 10.0 + 1e-6).floor().max(0.0) as u32;
            Ok(Box::new(Fake {
                next: first,
                count: 30,
                origin,
                fail_at,
                len: width as usize * height as usize * 4,
            }) as Box<dyn FrameFeed>)
        });
        (NativeDecode { backend: "fake", open }, opens)
    }

    /// A non-existent ffmpeg: after falling back it fails as soon as it starts, so the test does not depend on the local ffmpeg.
    fn no_ffmpeg() -> Tools {
        Tools {
            ffmpeg: PathBuf::from("/nonexistent/ffmpeg"),
            ffprobe: PathBuf::from("/nonexistent/ffprobe"),
        }
    }

    #[test]
    fn native_frames_follow_the_same_pick_and_restart_rules() {
        let (native, opens) = fake(10.0, false, None);
        let mut decoder = VideoDecoder::new(&no_ffmpeg(), Path::new("a.mp4"), 10.0, 4, 2).with_native(native);
        assert_eq!(decoder.backend(), "fake");
        // 0.25 s: the last frame not later than it is frame 2 (0.2).
        assert_eq!(decoder.frame_at(0.25).unwrap().data[0], 2);
        let first = decoder.advance(0.25).unwrap();
        assert_eq!(decoder.advance(0.29).unwrap(), first, "同一帧代号不变");
        assert_eq!(decoder.frame_at(1.0).unwrap().data[0], 10);
        assert_eq!(decoder.restarts(), 0);
        // Rewind: reopen, counted once; the start is on the media timeline (plus the PTS origin).
        assert_eq!(decoder.frame_at(0.5).unwrap().data[0], 5);
        assert_eq!(decoder.restarts(), 1);
        assert_eq!(*opens.lock().unwrap(), vec![10.25, 10.5]);
        // After reading to the end, stay on the last frame.
        assert_eq!(decoder.frame_at(4.0).unwrap().data[0], 29);
        assert!(decoder.fallback().is_none());
    }

    #[test]
    fn an_unopenable_native_source_falls_back_to_ffmpeg_without_counting_a_restart() {
        let (native, _) = fake(0.0, true, None);
        let mut decoder = VideoDecoder::new(&no_ffmpeg(), Path::new("a.mkv"), 0.0, 4, 2).with_native(native);
        // Start ffmpeg after the fallback: there is no ffmpeg here, so the reported error is a start failure.
        let error = decoder.frame_at(0.0).unwrap_err();
        assert_ne!(error.code, "EXPORT_DECODE_FAILED", "{error:?}");
        let fallback = decoder.fallback().expect("记下回落");
        assert_eq!(fallback.reason, "open-failed");
        assert!(fallback.message.contains("不支持的编码"), "{}", fallback.message);
        assert_eq!(decoder.backend(), "ffmpeg");
        assert_eq!(decoder.restarts(), 0);
    }

    #[test]
    fn a_native_read_failure_mid_stream_falls_back_and_keeps_the_current_frame() {
        let (native, _) = fake(0.0, false, Some(5));
        let mut decoder = VideoDecoder::new(&no_ffmpeg(), Path::new("a.mp4"), 0.0, 4, 2).with_native(native);
        assert_eq!(decoder.frame_at(0.3).unwrap().data[0], 3);
        assert!(decoder.frame_at(1.0).is_err());
        let fallback = decoder.fallback().expect("记下回落");
        assert_eq!(fallback.reason, "read-failed");
        assert_eq!(decoder.restarts(), 0);
    }

    #[test]
    fn a_native_source_without_frames_falls_back() {
        let (native, _) = fake(0.0, false, None);
        let mut decoder = VideoDecoder::new(&no_ffmpeg(), Path::new("a.mp4"), 0.0, 4, 2).with_native(native);
        // The start is 30 frames later: native cannot hand out a single frame.
        assert!(decoder.frame_at(5.0).is_err());
        assert_eq!(decoder.fallback().map(|f| f.reason), Some("no-frames"));
    }

    #[test]
    fn reads_pts_time_from_showinfo() {
        let line = "[Parsed_showinfo_0 @ 0x6000] n:   3 pts:   1536 pts_time:0.1       duration:    512 duration_time:0.0333333";
        assert_eq!(pts_time(line), Some(0.1));
        assert_eq!(pts_time("[Parsed_showinfo_0 @ 0x1] n: 0 pts: NOPTS pts_time:NOPTS"), None);
    }
}
