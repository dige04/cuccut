//! Encoding: raw RGBA frames are written to ffmpeg's stdin, converted to bt709 and encoded as yuv420p, and the mixed audio file is muxed in alongside.
//!
//! Audio is padded with silence and cut to the picture length (frame count ÷ frame rate), so the two streams are the same length. On cancel, the encoder is killed (so it does not finish writing a half-finished file) and the output is deleted.
//! [`QueuedEncoder`] moves the write pipe to its own thread, so compositing does not wait for the encoder to read a frame. The output owned by the write thread is a [`FrameSink`]:
//! either ffmpeg's [`Encoder`], or a platform-native writer that the caller opens on the write thread ([`QueuedEncoder::spawn`]).

use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, SyncSender, channel, sync_channel};
use std::thread::JoinHandle;

use crate::{MediaError, Tools, tail};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VideoCodec {
    H264,
    Hevc,
    Vp9,
}

impl VideoCodec {
    pub fn parse(name: &str) -> Option<VideoCodec> {
        match name {
            "h264" => Some(VideoCodec::H264),
            "hevc" => Some(VideoCodec::Hevc),
            "vp9" => Some(VideoCodec::Vp9),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            VideoCodec::H264 => "h264",
            VideoCodec::Hevc => "hevc",
            VideoCodec::Vp9 => "vp9",
        }
    }

    /// The ffmpeg encoder used. Software encoders only: the results are reproducible, and the parameter (CRF) means the same thing on every platform.
    pub fn encoder(self) -> &'static str {
        match self {
            VideoCodec::H264 => "libx264",
            VideoCodec::Hevc => "libx265",
            VideoCodec::Vp9 => "libvpx-vp9",
        }
    }

    /// The CRF used when neither a bitrate nor a CRF is given.
    pub fn default_crf(self) -> u32 {
        match self {
            VideoCodec::H264 => 20,
            VideoCodec::Hevc => 23,
            VideoCodec::Vp9 => 32,
        }
    }

    /// Upper limit of the CRF value (the lower limit is 0).
    pub fn max_crf(self) -> u32 {
        match self {
            VideoCodec::H264 | VideoCodec::Hevc => 51,
            VideoCodec::Vp9 => 63,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Container {
    Mp4,
    Webm,
}

impl Container {
    pub fn parse(name: &str) -> Option<Container> {
        match name {
            "mp4" => Some(Container::Mp4),
            "webm" => Some(Container::Webm),
            _ => None,
        }
    }

    /// The video codecs the container can hold.
    pub fn accepts(self, codec: VideoCodec) -> bool {
        match self {
            Container::Mp4 => matches!(codec, VideoCodec::H264 | VideoCodec::Hevc),
            Container::Webm => codec == VideoCodec::Vp9,
        }
    }

    pub fn default_codec(self) -> VideoCodec {
        match self {
            Container::Mp4 => VideoCodec::H264,
            Container::Webm => VideoCodec::Vp9,
        }
    }

    /// Audio encoder: AAC for MP4, Opus for WebM.
    pub fn audio_encoder(self) -> &'static str {
        match self {
            Container::Mp4 => "aac",
            Container::Webm => "libopus",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Quality {
    Crf(u32),
    BitrateKbps(u32),
}

#[derive(Clone, Debug)]
pub struct AudioTrack {
    pub path: PathBuf,
    pub bitrate_kbps: u32,
}

#[derive(Clone, Debug)]
pub struct EncodeSettings {
    pub width: u32,
    pub height: u32,
    pub fps_num: i64,
    pub fps_den: i64,
    pub codec: VideoCodec,
    pub container: Container,
    pub quality: Quality,
    pub audio: Option<AudioTrack>,
    /// Length of the picture (frame count ÷ frame rate, seconds): audio is padded or cut to this length.
    pub duration_seconds: f64,
}

impl EncodeSettings {
    /// ffmpeg arguments (excluding the executable).
    pub fn arguments(&self, output: &Path) -> Vec<String> {
        let mut args: Vec<String> = ["-hide_banner", "-nostdin", "-nostats", "-loglevel", "error", "-y"]
            .map(String::from)
            .to_vec();
        args.extend([
            "-f".into(),
            "rawvideo".into(),
            "-pix_fmt".into(),
            "rgba".into(),
            "-s".into(),
            format!("{}x{}", self.width, self.height),
            "-framerate".into(),
            format!("{}/{}", self.fps_num, self.fps_den),
            "-i".into(),
            "pipe:0".into(),
        ]);
        if let Some(audio) = &self.audio {
            args.push("-i".into());
            args.push(audio.path.to_string_lossy().into_owned());
        }
        args.extend(["-map", "0:v:0"].map(String::from));
        if self.audio.is_some() {
            args.extend(["-map", "1:a:0"].map(String::from));
        }
        args.extend(
            [
                "-vf",
                "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic,format=yuv420p",
                "-c:v",
                self.codec.encoder(),
            ]
            .map(String::from),
        );
        match self.codec {
            VideoCodec::H264 => args.extend(["-preset", "medium", "-profile:v", "high"].map(String::from)),
            VideoCodec::Hevc => args.extend(["-preset", "medium", "-tag:v", "hvc1", "-x265-params", "log-level=error"].map(String::from)),
            VideoCodec::Vp9 => args.extend(["-deadline", "good", "-cpu-used", "2", "-row-mt", "1"].map(String::from)),
        }
        match self.quality {
            Quality::Crf(crf) => {
                args.extend(["-crf".to_string(), crf.to_string()]);
                if self.codec == VideoCodec::Vp9 {
                    args.extend(["-b:v", "0"].map(String::from));
                }
            }
            Quality::BitrateKbps(kbps) => args.extend(["-b:v".to_string(), format!("{kbps}k")]),
        }
        args.extend(
            [
                "-colorspace",
                "bt709",
                "-color_primaries",
                "bt709",
                "-color_trc",
                "bt709",
                "-color_range",
                "tv",
            ]
            .map(String::from),
        );
        if let Some(audio) = &self.audio {
            let duration = format!("{:.6}", self.duration_seconds);
            args.extend([
                "-c:a".to_string(),
                self.container.audio_encoder().to_string(),
                "-b:a".to_string(),
                format!("{}k", audio.bitrate_kbps),
                "-af".to_string(),
                format!("apad=whole_dur={duration},atrim=end={duration}"),
            ]);
        }
        if self.container == Container::Mp4 {
            args.extend(["-movflags", "+faststart"].map(String::from));
        }
        args.push(output.to_string_lossy().into_owned());
        args
    }
}

/// One output being encoded.
pub struct Encoder {
    child: Child,
    stdin: Option<ChildStdin>,
    log: Option<JoinHandle<String>>,
    output: PathBuf,
    frame_bytes: usize,
}

impl Encoder {
    pub fn start(tools: &Tools, settings: &EncodeSettings, output: &Path) -> Result<Encoder, MediaError> {
        let mut child = Command::new(&tools.ffmpeg)
            .args(settings.arguments(output))
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| MediaError::spawn(&tools.ffmpeg, e))?;
        let stdin = child.stdin.take();
        let mut stderr = child.stderr.take().expect("管道");
        let log = std::thread::spawn(move || {
            let mut text = String::new();
            let _ = stderr.read_to_string(&mut text);
            text
        });
        Ok(Encoder {
            child,
            stdin,
            log: Some(log),
            output: output.to_path_buf(),
            frame_bytes: settings.width as usize * settings.height as usize * 4,
        })
    }

    /// Write one frame (RGBA, `width`×`height`).
    pub fn write(&mut self, rgba: &[u8]) -> Result<(), MediaError> {
        if rgba.len() != self.frame_bytes {
            return Err(MediaError::new("EXPORT_ENCODE_FAILED", "帧的大小与输出尺寸不符"));
        }
        let stdin = self
            .stdin
            .as_mut()
            .ok_or_else(|| MediaError::new("EXPORT_ENCODE_FAILED", "编码器已关闭"))?;
        match stdin.write_all(rgba) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == ErrorKind::BrokenPipe => {
                self.stdin = None;
                let _ = self.child.wait();
                Err(MediaError::new(
                    "EXPORT_ENCODE_FAILED",
                    format!("编码器提前退出：{}", self.log_tail()),
                ))
            }
            Err(e) => Err(MediaError::new("EXPORT_ENCODE_FAILED", format!("写编码器失败：{e}"))),
        }
    }

    /// Done writing: close the input and wait for the encoder to finish.
    pub fn finish(mut self) -> Result<(), MediaError> {
        drop(self.stdin.take());
        let status = self
            .child
            .wait()
            .map_err(|e| MediaError::new("EXPORT_ENCODE_FAILED", format!("等编码器失败：{e}")))?;
        if !status.success() {
            let message = format!("编码失败：{}", self.log_tail());
            let _ = std::fs::remove_file(&self.output);
            return Err(MediaError::new("EXPORT_ENCODE_FAILED", message));
        }
        Ok(())
    }

    /// Abandon: kill the encoder and delete the output.
    pub fn abort(mut self) {
        drop(self.stdin.take());
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_file(&self.output);
    }

    fn log_tail(&mut self) -> String {
        let text = self.log.take().and_then(|h| h.join().ok()).unwrap_or_default();
        tail(&text, 4)
    }
}

/// The encoding output owned by the [`QueuedEncoder`] write thread: ffmpeg's [`Encoder`], or a native writer supplied by the caller.
///
/// Same contract as [`Encoder`]: `write` takes one whole RGBA frame; `finish` wraps up, and on failure leaves no half-written file; `abort` stops and deletes the output.
pub trait FrameSink {
    fn write(&mut self, rgba: &[u8]) -> Result<(), MediaError>;
    fn finish(self: Box<Self>) -> Result<(), MediaError>;
    fn abort(self: Box<Self>);
}

impl FrameSink for Encoder {
    fn write(&mut self, rgba: &[u8]) -> Result<(), MediaError> {
        Encoder::write(self, rgba)
    }

    fn finish(self: Box<Self>) -> Result<(), MediaError> {
        Encoder::finish(*self)
    }

    fn abort(self: Box<Self>) {
        Encoder::abort(*self)
    }
}

impl Drop for Encoder {
    fn drop(&mut self) {
        if self.stdin.is_some() {
            drop(self.stdin.take());
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

/// Writes the encoder on a separate thread: the compositing thread hands a whole frame into a bounded queue and goes on to draw the next one, without waiting for the pipe.
///
/// The frame buffers are a fixed pool (queue depth plus one). Used buffers come back through a recycling channel, so nothing is allocated per frame. Buffers in the pool are initially filled with `fill`
/// (one RGBA pixel), and afterwards are recycled as they are, keeping whatever was last written into them: a caller that writes only the picture area (the letterboxing) fills the bars only once.
///
/// The write thread owns the [`Encoder`]. When going through [`finish`](Self::finish), it writes out the queue before wrapping up. Otherwise (with [`abort`](Self::abort), or simply dropping it)
/// it stops writing the queued frames, kills the encoder and deletes the output. If the encoder fails midway, the write thread gives up and exits; the next time the compositing thread takes a buffer or hands in a frame, it fails
/// and gets the write thread's error.
pub struct QueuedEncoder {
    frames: Option<SyncSender<Vec<u8>>>,
    empty: Receiver<Vec<u8>>,
    finishing: Arc<AtomicBool>,
    aborting: Arc<AtomicBool>,
    writer: Option<JoinHandle<Result<(), MediaError>>>,
    frame_bytes: usize,
}

impl QueuedEncoder {
    /// `depth` is the number of frames queued waiting to be written (at least 1).
    pub fn new(encoder: Encoder, depth: usize, fill: [u8; 4]) -> QueuedEncoder {
        let frame_bytes = encoder.frame_bytes;
        let opened = QueuedEncoder::spawn(frame_bytes, depth, fill, move || Ok(Box::new(encoder) as Box<dyn FrameSink>));
        match opened {
            Ok(queued) => queued,
            Err(_) => unreachable!("现成的编码器不会打开失败"),
        }
    }

    /// Open the encoding output (`open`) on the write thread; returns only once it has opened successfully. If opening fails, the error is returned as is, and the caller may try again with a different output.
    /// The output is constructed on the write thread and used only there, so it does not need `Send` (platform writers often are not). `frame_bytes` is the byte count of one RGBA frame.
    pub fn spawn<F>(frame_bytes: usize, depth: usize, fill: [u8; 4], open: F) -> Result<QueuedEncoder, MediaError>
    where
        F: FnOnce() -> Result<Box<dyn FrameSink>, MediaError> + Send + 'static,
    {
        let depth = depth.max(1);
        let (frames, queued) = sync_channel::<Vec<u8>>(depth);
        let (recycle, empty) = channel::<Vec<u8>>();
        let finishing = Arc::new(AtomicBool::new(false));
        let aborting = Arc::new(AtomicBool::new(false));
        let (finish, abort) = (Arc::clone(&finishing), Arc::clone(&aborting));
        let (opened, open_result) = channel::<Result<(), MediaError>>();
        let refill = recycle.clone();
        let writer = std::thread::spawn(move || {
            let mut encoder = match open() {
                Ok(sink) => {
                    let _ = opened.send(Ok(()));
                    sink
                }
                Err(e) => {
                    let _ = opened.send(Err(e));
                    return Ok(());
                }
            };
            for frame in queued {
                if abort.load(Ordering::SeqCst) {
                    break;
                }
                if let Err(e) = encoder.write(&frame) {
                    encoder.abort();
                    return Err(e);
                }
                // If the compositing thread no longer takes buffers (it is abandoning), they cannot be sent back, so just drop them.
                let _ = recycle.send(frame);
            }
            if finish.load(Ordering::SeqCst) && !abort.load(Ordering::SeqCst) {
                encoder.finish()
            } else {
                encoder.abort();
                Ok(())
            }
        });
        let failed = match open_result.recv() {
            Ok(Ok(())) => None,
            Ok(Err(e)) => Some(e),
            Err(_) => Some(MediaError::new("EXPORT_ENCODE_FAILED", "写编码器的线程崩溃了")),
        };
        if let Some(e) = failed {
            let _ = writer.join();
            return Err(e);
        }
        for _ in 0..=depth {
            let _ = refill.send(fill.repeat(frame_bytes / 4));
        }
        Ok(QueuedEncoder {
            frames: Some(frames),
            empty,
            finishing,
            aborting,
            writer: Some(writer),
            frame_bytes,
        })
    }

    /// Take a frame buffer (its length is one frame; its contents are whatever was left from its last use). If all buffers are in the queue, wait for the write thread to write one frame.
    pub fn buffer(&mut self) -> Result<Vec<u8>, MediaError> {
        if self.writer.is_none() {
            return Err(MediaError::new("EXPORT_ENCODE_FAILED", "编码器已关闭"));
        }
        match self.empty.recv() {
            Ok(buffer) => Ok(buffer),
            Err(_) => Err(self.writer_error()),
        }
    }

    /// Hand a drawn frame to the write thread; wait if the queue is full.
    pub fn submit(&mut self, frame: Vec<u8>) -> Result<(), MediaError> {
        if frame.len() != self.frame_bytes {
            return Err(MediaError::new("EXPORT_ENCODE_FAILED", "帧的大小与输出尺寸不符"));
        }
        let sent = self.frames.as_ref().is_some_and(|frames| frames.send(frame).is_ok());
        if sent { Ok(()) } else { Err(self.writer_error()) }
    }

    /// Done writing: wait for the queued frames to be written and for the encoder to finish.
    pub fn finish(mut self) -> Result<(), MediaError> {
        self.finishing.store(true, Ordering::SeqCst);
        drop(self.frames.take());
        self.join()
    }

    /// Abandon: the queued frames are not written; kill the encoder and delete the output. When it returns, the encoder has stopped and the output has been deleted.
    pub fn abort(mut self) {
        self.stop();
    }

    fn stop(&mut self) {
        self.aborting.store(true, Ordering::SeqCst);
        drop(self.frames.take());
        let _ = self.join();
    }

    fn join(&mut self) -> Result<(), MediaError> {
        match self.writer.take() {
            Some(writer) => writer
                .join()
                .unwrap_or_else(|_| Err(MediaError::new("EXPORT_ENCODE_FAILED", "写编码器的线程崩溃了"))),
            None => Err(MediaError::new("EXPORT_ENCODE_FAILED", "编码器已关闭")),
        }
    }

    /// The write thread has already exited (encoder failure): wait for it to finish and take its error.
    fn writer_error(&mut self) -> MediaError {
        drop(self.frames.take());
        match self.join() {
            Err(e) => e,
            Ok(()) => MediaError::new("EXPORT_ENCODE_FAILED", "编码器已关闭"),
        }
    }
}

impl Drop for QueuedEncoder {
    fn drop(&mut self) {
        if self.writer.is_some() {
            self.stop();
        }
    }
}
