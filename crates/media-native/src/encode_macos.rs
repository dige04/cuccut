//! Native MP4 writing on macOS: `AVAssetWriter` + VideoToolbox H.264 + AAC.
//!
//! The structure is the same as the shipping export backend in `core/crates/ccut-kernel/src/services/native_video.rs` (that was the first implementation of this stack in this repo), but the scenario here is much simpler, so its pipeline was **not** copied:
//! there, the source stream is decoded while subtitles are composited, frames are expensive to produce, and a separate submit thread is worth it; here
//! frames are rasterised in parallel by the `ccut-render` worker pool and delivered in order, so the writing side only has to "feed the encoder". An extra thread would only add one more 8 MB copy and another SAFETY argument. Back-pressure is therefore handled in place:
//! when `isReadyForMoreMediaData` is false, sleep briefly and wait.
//!
//! ## Audio is a hand-built `CMSampleBuffer`
//!
//! Audio on the export backend comes from `AVAssetReader` (samples already present in the source file). Here the audio is raw f32le PCM mixed by `ccut-render`, with no container at all. So a layer has to be built by hand:
//! `CMBlockBuffer` (copies in the PCM bytes) + `CMAudioFormatDescription` (an ASBD describing "48 kHz stereo interleaved f32") → `CMAudioSampleBufferCreateReadyWithPacketDescriptions`.
//! The writer's `AVAssetWriterInput` is set up with AAC output settings, and AVFoundation does the transcoding
//! (the same path as the export backend feeding the source LPCM into an AAC input).
//!
//! ## Interleaving
//!
//! To keep the tracks interleaved, `AVAssetWriter` holds back one track's ready flag when the other track falls too far behind.
//! When one thread writes both tracks this is a deadlock risk: audio must keep being fed **inside the loop** that waits for video to be ready,
//! not wait for video to be ready first and only then handle audio. See the call site of [`AvWriter::pump_audio`].

#![allow(deprecated)]

use std::path::Path;
use std::ptr::NonNull;
use std::time::Duration;

use anyhow::{Context, Result, anyhow, bail};
use block2::RcBlock;
use objc2::AnyThread;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_av_foundation::{
    AVAssetWriter, AVAssetWriterInput, AVAssetWriterInputPixelBufferAdaptor, AVAssetWriterStatus,
    AVFileTypeMPEG4, AVMediaTypeAudio, AVMediaTypeVideo, AVVideoAverageBitRateKey, AVVideoCodecKey,
    AVVideoCodecTypeH264, AVVideoColorPrimaries_ITU_R_709_2, AVVideoColorPrimariesKey,
    AVVideoColorPropertiesKey, AVVideoCompressionPropertiesKey, AVVideoExpectedSourceFrameRateKey,
    AVVideoHeightKey, AVVideoMaxKeyFrameIntervalKey, AVVideoProfileLevelH264HighAutoLevel,
    AVVideoProfileLevelKey, AVVideoTransferFunction_ITU_R_709_2, AVVideoTransferFunctionKey,
    AVVideoWidthKey, AVVideoYCbCrMatrix_ITU_R_709_2, AVVideoYCbCrMatrixKey,
};
use objc2_avf_audio::{AVEncoderBitRateKey, AVFormatIDKey, AVNumberOfChannelsKey, AVSampleRateKey};
use objc2_core_audio_types::{
    AudioStreamBasicDescription, kAudioFormatFlagIsFloat, kAudioFormatFlagIsPacked,
    kAudioFormatFlagsNativeEndian, kAudioFormatLinearPCM, kAudioFormatMPEG4AAC,
};
use objc2_core_foundation::CFRetained;
use objc2_core_media::{
    CMAudioFormatDescriptionCreate, CMAudioSampleBufferCreateReadyWithPacketDescriptions,
    CMBlockBuffer, CMFormatDescription, CMSampleBuffer, CMTime, kCMBlockBufferAssureMemoryNowFlag,
};
use objc2_core_video::{
    CVPixelBuffer, CVPixelBufferGetBaseAddress, CVPixelBufferGetBytesPerRow,
    CVPixelBufferGetHeight, CVPixelBufferGetWidth, CVPixelBufferLockBaseAddress,
    CVPixelBufferLockFlags, CVPixelBufferPool, CVPixelBufferUnlockBaseAddress,
    kCVPixelFormatType_32BGRA,
};
use objc2_foundation::{NSDictionary, NSNumber, NSString, NSURL, ns_string};

use crate::encode::{
    AUDIO_CHANNELS, AUDIO_LEAD_SECONDS, AUDIO_SAMPLE_RATE, Mp4Sink, PcmChunk, PcmSource,
    WriterSetup,
};

/// Short sleep step when the encoder applies back-pressure: sleep briefly rather than spin, to avoid burning a whole core (same value as the export backend).
const BACKPRESSURE_NAP: Duration = Duration::from_micros(500);

/// Keyframe interval (seconds). Measured in this repo, the hardware encoder's default GOP can get so sparse that only the first frame is a keyframe,
/// and output like that is painful to scrub in preview; 2 seconds matches the export backend.
const KEYFRAME_INTERVAL_SECONDS: f64 = 2.0;

fn ns_path(path: &Path) -> Retained<NSString> {
    NSString::from_str(&path.to_string_lossy())
}

fn object_dictionary(
    keys: &[&NSString],
    values: &[&AnyObject],
) -> Retained<NSDictionary<NSString, AnyObject>> {
    NSDictionary::from_slices(keys, values)
}

unsafe fn video_output_settings(
    width: u32,
    height: u32,
    bitrate: u32,
    fps: f64,
) -> Retained<NSDictionary<NSString, AnyObject>> {
    let bitrate = NSNumber::numberWithUnsignedInt(bitrate);
    let keyframe_interval =
        NSNumber::numberWithUnsignedInt(((fps * KEYFRAME_INTERVAL_SECONDS).round() as u32).max(1));
    let source_frame_rate = NSNumber::numberWithDouble(fps);
    let compression = object_dictionary(
        &[
            unsafe { AVVideoAverageBitRateKey }.expect("AVVideoAverageBitRateKey"),
            unsafe { AVVideoProfileLevelKey }.expect("AVVideoProfileLevelKey"),
            unsafe { AVVideoMaxKeyFrameIntervalKey }.expect("AVVideoMaxKeyFrameIntervalKey"),
            unsafe { AVVideoExpectedSourceFrameRateKey }
                .expect("AVVideoExpectedSourceFrameRateKey"),
        ],
        &[
            &bitrate,
            unsafe { AVVideoProfileLevelH264HighAutoLevel }
                .expect("AVVideoProfileLevelH264HighAutoLevel"),
            &keyframe_interval,
            &source_frame_rate,
        ],
    );
    // BT.709 colour tags: without them, the bitstream VideoToolbox writes has primaries / transfer /
    // matrix all unknown (measured with ffprobe), and a player guessing 601 would shift the colours. With them set,
    // the BGRA→YUV conversion matrix is also fixed to 709, matching the `-colorspace bt709` contract of the ffmpeg fallback path.
    let color = object_dictionary(
        &[
            unsafe { AVVideoColorPrimariesKey }.expect("AVVideoColorPrimariesKey"),
            unsafe { AVVideoTransferFunctionKey }.expect("AVVideoTransferFunctionKey"),
            unsafe { AVVideoYCbCrMatrixKey }.expect("AVVideoYCbCrMatrixKey"),
        ],
        &[
            unsafe { AVVideoColorPrimaries_ITU_R_709_2 }
                .expect("AVVideoColorPrimaries_ITU_R_709_2"),
            unsafe { AVVideoTransferFunction_ITU_R_709_2 }
                .expect("AVVideoTransferFunction_ITU_R_709_2"),
            unsafe { AVVideoYCbCrMatrix_ITU_R_709_2 }.expect("AVVideoYCbCrMatrix_ITU_R_709_2"),
        ],
    );
    let width = NSNumber::numberWithUnsignedInt(width);
    let height = NSNumber::numberWithUnsignedInt(height);
    object_dictionary(
        &[
            unsafe { AVVideoCodecKey }.expect("AVVideoCodecKey"),
            unsafe { AVVideoWidthKey }.expect("AVVideoWidthKey"),
            unsafe { AVVideoHeightKey }.expect("AVVideoHeightKey"),
            unsafe { AVVideoCompressionPropertiesKey }.expect("AVVideoCompressionPropertiesKey"),
            unsafe { AVVideoColorPropertiesKey }.expect("AVVideoColorPropertiesKey"),
        ],
        &[
            unsafe { AVVideoCodecTypeH264 }.expect("AVVideoCodecTypeH264"),
            &width,
            &height,
            &compression,
            &color,
        ],
    )
}

unsafe fn adaptor_settings(width: u32, height: u32) -> Retained<NSDictionary<NSString, AnyObject>> {
    let pixel_format = NSNumber::numberWithUnsignedInt(kCVPixelFormatType_32BGRA);
    let width = NSNumber::numberWithUnsignedInt(width);
    let height = NSNumber::numberWithUnsignedInt(height);
    object_dictionary(
        &[
            ns_string!("PixelFormatType"),
            ns_string!("Width"),
            ns_string!("Height"),
        ],
        &[&pixel_format, &width, &height],
    )
}

unsafe fn audio_output_settings(bitrate: u32) -> Retained<NSDictionary<NSString, AnyObject>> {
    let format = NSNumber::numberWithUnsignedInt(kAudioFormatMPEG4AAC);
    let sample_rate = NSNumber::numberWithDouble(f64::from(AUDIO_SAMPLE_RATE));
    let channels = NSNumber::numberWithUnsignedInt(AUDIO_CHANNELS);
    let bitrate = NSNumber::numberWithUnsignedInt(bitrate);
    object_dictionary(
        &[
            unsafe { AVFormatIDKey }.expect("AVFormatIDKey"),
            unsafe { AVSampleRateKey }.expect("AVSampleRateKey"),
            unsafe { AVNumberOfChannelsKey }.expect("AVNumberOfChannelsKey"),
            unsafe { AVEncoderBitRateKey }.expect("AVEncoderBitRateKey"),
        ],
        &[&format, &sample_rate, &channels, &bitrate],
    )
}

/// Audio format description for "48 kHz stereo interleaved f32". The mixed PCM has no container, so the format can only be declared by hand.
fn pcm_format_description() -> Result<CFRetained<CMFormatDescription>> {
    let mut asbd = AudioStreamBasicDescription {
        mSampleRate: f64::from(AUDIO_SAMPLE_RATE),
        mFormatID: kAudioFormatLinearPCM,
        mFormatFlags: kAudioFormatFlagIsFloat
            | kAudioFormatFlagsNativeEndian
            | kAudioFormatFlagIsPacked,
        mBytesPerPacket: 4 * AUDIO_CHANNELS,
        mFramesPerPacket: 1,
        mBytesPerFrame: 4 * AUDIO_CHANNELS,
        mChannelsPerFrame: AUDIO_CHANNELS,
        mBitsPerChannel: 32,
        mReserved: 0,
    };
    let mut description: *const CMFormatDescription = std::ptr::null();
    let status = unsafe {
        CMAudioFormatDescriptionCreate(
            None,
            NonNull::from(&mut asbd),
            0,
            std::ptr::null(),
            0,
            std::ptr::null(),
            None,
            NonNull::from(&mut description),
        )
    };
    if status != 0 {
        bail!("创建 PCM 音频格式描述失败：{status}");
    }
    let pointer = NonNull::new(description.cast_mut()).context("CoreMedia 返回了空音频格式描述")?;
    Ok(unsafe { CFRetained::from_raw(pointer) })
}

/// One block of interleaved f32 PCM → a `CMSampleBuffer` that can be appended directly.
fn pcm_sample_buffer(
    format: &CMFormatDescription,
    chunk: &PcmChunk,
) -> Result<CFRetained<CMSampleBuffer>> {
    let length = std::mem::size_of_val(chunk.samples.as_slice());
    let mut block: *mut CMBlockBuffer = std::ptr::null_mut();
    // `memory_block` empty and `block_allocator` empty ⇒ allocate now with the default allocator;
    // `AssureMemoryNow` makes it allocate on the spot instead of waiting for the first access.
    let status = unsafe {
        CMBlockBuffer::create_with_memory_block(
            None,
            std::ptr::null_mut(),
            length,
            None,
            std::ptr::null(),
            0,
            length,
            kCMBlockBufferAssureMemoryNowFlag,
            NonNull::from(&mut block),
        )
    };
    if status != 0 {
        bail!("创建音频块缓冲失败：{status}");
    }
    let block = unsafe {
        CFRetained::from_raw(NonNull::new(block).context("CoreMedia 返回了空音频块缓冲")?)
    };
    let source = NonNull::new(chunk.samples.as_ptr().cast::<std::ffi::c_void>().cast_mut())
        .context("空 PCM 分块")?;
    let status = unsafe { CMBlockBuffer::replace_data_bytes(source, &block, 0, length) };
    if status != 0 {
        bail!("拷贝音频样本字节失败：{status}");
    }
    let mut sample: *mut CMSampleBuffer = std::ptr::null_mut();
    let status = unsafe {
        CMAudioSampleBufferCreateReadyWithPacketDescriptions(
            None,
            &block,
            format,
            chunk.frames() as isize,
            CMTime::new(chunk.start_frame as i64, AUDIO_SAMPLE_RATE as i32),
            std::ptr::null(),
            NonNull::from(&mut sample),
        )
    };
    if status != 0 {
        bail!("创建音频样本缓冲失败：{status}");
    }
    let pointer = NonNull::new(sample).context("CoreMedia 返回了空音频样本缓冲")?;
    Ok(unsafe { CFRetained::from_raw(pointer) })
}

struct AudioTrack {
    input: Retained<AVAssetWriterInput>,
    format: CFRetained<CMFormatDescription>,
    source: PcmSource,
    /// The PCM has been fully read and the audio track has been `markAsFinished`.
    finished: bool,
}

pub(crate) struct AvWriter {
    writer: Retained<AVAssetWriter>,
    video_input: Retained<AVAssetWriterInput>,
    adaptor: Retained<AVAssetWriterInputPixelBufferAdaptor>,
    pool: Retained<CVPixelBufferPool>,
    audio: Option<AudioTrack>,
    width: u32,
    height: u32,
    fps_num: u32,
    fps_den: u32,
    /// Number of video frames appended so far, which is also the frame number of the next frame.
    frames: u64,
    /// The writer has been wrapped up (`finish` has completed).
    closed: bool,
    /// AVFoundation's shadow-file directory. Setting `shouldOptimizeForNetworkUse` to move moov to the front
    /// writes a `.sb-*` temporary file nearly the size of the final output, and without a specified directory macOS may put it
    /// next to the user's output directory. Field order is drop order: it comes **after** the writer, so the writer
    /// is released first and AVFoundation wraps up its own file first, and TempDir cleans up as a fallback.
    _temporary: tempfile::TempDir,
}

pub(crate) fn open(out: &Path, setup: WriterSetup) -> Result<Box<dyn Mp4Sink>> {
    objc2::rc::autoreleasepool(|_| open_inner(out, setup))
        .map(|writer| Box::new(writer) as Box<dyn Mp4Sink>)
}

fn open_inner(out: &Path, setup: WriterSetup) -> Result<AvWriter> {
    let WriterSetup {
        width,
        height,
        fps_num,
        fps_den,
        bitrate,
        audio,
        audio_bitrate,
    } = setup;
    // AVAssetWriter refuses an output path that already exists, and callers often create the temporary file first and then hand it to us
    // (`ccut-render` passes in the empty file from `tempfile_in`). The ffmpeg path overwrites with `-y`, so the semantics must match.
    match std::fs::remove_file(out) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(error).with_context(|| format!("清理旧输出 {}", out.display()));
        }
    }
    let exact_fps = f64::from(fps_num) / f64::from(fps_den);
    // The guard is created before the writer; locals are dropped in reverse, so the writer is released first: AVFoundation
    // wraps up its own shadow file, and TempDir cleans up as a fallback.
    let temporary = tempfile::Builder::new()
        .prefix("ccut-mp4-writer-")
        .tempdir()
        .context("创建 AVFoundation 临时目录")?;
    let url = NSURL::fileURLWithPath(&ns_path(out));
    let writer = unsafe {
        AVAssetWriter::assetWriterWithURL_fileType_error(
            &url,
            AVFileTypeMPEG4.expect("AVFileTypeMPEG4"),
        )
    }
    .map_err(|error| anyhow!("unsupported: 创建 AVAssetWriter 失败（{error}）"))?;
    unsafe {
        let temporary_url = NSURL::fileURLWithPath(&ns_path(temporary.path()));
        writer.setDirectoryForTemporaryFiles(Some(&temporary_url));
        // Matches the ffmpeg `-movflags +faststart` from before the migration: moov at the front.
        writer.setShouldOptimizeForNetworkUse(true);
    }

    let video_settings = unsafe { video_output_settings(width, height, bitrate, exact_fps) };
    let video_input = unsafe {
        AVAssetWriterInput::initWithMediaType_outputSettings(
            AVAssetWriterInput::alloc(),
            AVMediaTypeVideo.expect("AVMediaTypeVideo"),
            Some(&video_settings),
        )
    };
    unsafe { video_input.setExpectsMediaDataInRealTime(false) };
    // For a non-integer frame rate, pin the media timescale to the numerator: the default 600 would round the 29.97 frame duration to 20/600,
    // which reads back as 30 fps (the same rule as `pin_media_time_scale` in `ccut-kernel`).
    if fps_den > 1
        && let Ok(scale) = i32::try_from(fps_num)
    {
        unsafe { video_input.setMediaTimeScale(scale) };
    }
    if !unsafe { writer.canAddInput(&video_input) } {
        bail!("unsupported: 本机没有可用的 H.264 编码器");
    }
    unsafe { writer.addInput(&video_input) };
    let adaptor = unsafe {
        AVAssetWriterInputPixelBufferAdaptor::initWithAssetWriterInput_sourcePixelBufferAttributes(
            AVAssetWriterInputPixelBufferAdaptor::alloc(),
            &video_input,
            Some(&adaptor_settings(width, height)),
        )
    };

    let audio_input = audio.as_ref().map(|_| {
        let input = unsafe {
            AVAssetWriterInput::initWithMediaType_outputSettings(
                AVAssetWriterInput::alloc(),
                AVMediaTypeAudio.expect("AVMediaTypeAudio"),
                Some(&audio_output_settings(audio_bitrate)),
            )
        };
        unsafe { input.setExpectsMediaDataInRealTime(false) };
        input
    });
    if let Some(input) = &audio_input {
        if !unsafe { writer.canAddInput(input) } {
            bail!("unsupported: 本机没有可用的 AAC 编码器");
        }
        unsafe { writer.addInput(input) };
    }

    if !unsafe { writer.startWriting() } {
        bail!(
            "unsupported: AVFoundation 无法启动 MP4 写入（{:?}）",
            unsafe { writer.error() }
        );
    }
    unsafe { writer.startSessionAtSourceTime(CMTime::new(0, 1)) };
    let pool = unsafe { adaptor.pixelBufferPool() }.context("AVFoundation 未创建像素缓冲池")?;

    let audio = match (audio, audio_input) {
        (Some(source), Some(input)) => Some(AudioTrack {
            input,
            format: pcm_format_description()?,
            source,
            finished: false,
        }),
        _ => None,
    };
    Ok(AvWriter {
        writer,
        video_input,
        adaptor,
        pool,
        audio,
        width,
        height,
        fps_num,
        fps_den,
        frames: 0,
        closed: false,
        _temporary: temporary,
    })
}

impl AvWriter {
    /// Presentation time of frame `index`. Fractional timebase (`den/num`), so frame rates like 29.97 do not drift.
    fn timestamp(&self, index: u64) -> CMTime {
        unsafe { CMTime::new(index as i64 * i64::from(self.fps_den), self.fps_num as i32) }
    }

    fn video_seconds(&self) -> f64 {
        self.frames as f64 * f64::from(self.fps_den) / f64::from(self.fps_num)
    }

    fn check_failed(&self) -> Result<()> {
        if unsafe { self.writer.status() } == AVAssetWriterStatus::Failed {
            bail!("AVFoundation 编码失败：{:?}", unsafe {
                self.writer.error()
            });
        }
        Ok(())
    }

    /// Feed audio up to `limit_seconds` (a hard limit on the audio timeline).
    ///
    /// Returns whether it actually advanced. It must be called in the loop that waits for video to be ready; otherwise the writer holds back the video ready flag to keep interleaving,
    /// and the caller waits only for video, so a render with an audio track would deadlock.
    fn pump_audio(&mut self, limit_seconds: f64) -> Result<bool> {
        let Some(audio) = self.audio.as_mut() else {
            return Ok(false);
        };
        if audio.finished {
            return Ok(false);
        }
        let mut advanced = false;
        loop {
            if audio.source.position_seconds() >= limit_seconds {
                return Ok(advanced);
            }
            if !unsafe { audio.input.isReadyForMoreMediaData() } {
                return Ok(advanced);
            }
            let chunk = audio.source.next_chunk()?;
            let Some(chunk) = chunk else {
                unsafe { audio.input.markAsFinished() };
                audio.finished = true;
                return Ok(true);
            };
            let sample = pcm_sample_buffer(&audio.format, &chunk)?;
            if !unsafe { audio.input.appendSampleBuffer(&sample) } {
                bail!("AVFoundation 写入 AAC 音频失败：{:?}", unsafe {
                    self.writer.error()
                });
            }
            advanced = true;
        }
    }

    fn append_frame(&mut self, rgba: &[u8]) -> Result<()> {
        let expected = self.width as usize * self.height as usize * 4;
        if rgba.len() != expected {
            bail!(
                "MP4 帧字节数与几何不符：{}x{} 需要 {expected} 字节，实得 {}",
                self.width,
                self.height,
                rgba.len()
            );
        }
        // Wait for video to be ready while still feeding audio (the interleaving deadlock risk, see `pump_audio`).
        let limit = self.video_seconds() + AUDIO_LEAD_SECONDS;
        loop {
            self.pump_audio(limit)?;
            if unsafe { self.video_input.isReadyForMoreMediaData() } {
                break;
            }
            self.check_failed()?;
            std::thread::sleep(BACKPRESSURE_NAP);
        }
        let buffer = new_pixel_buffer(&self.pool)?;
        unsafe { fill_bgra(&buffer, rgba, self.width, self.height)? };
        let timestamp = self.timestamp(self.frames);
        if !unsafe {
            self.adaptor
                .appendPixelBuffer_withPresentationTime(&buffer, timestamp)
        } {
            bail!("AVFoundation 写入视频帧失败：{:?}", unsafe {
                self.writer.error()
            });
        }
        self.frames += 1;
        Ok(())
    }

    /// Whether audio still needs feeding: it is done once everything before `video_end` has been handed out.
    fn audio_drained(&self, video_end: f64) -> bool {
        self.audio
            .as_ref()
            .is_none_or(|audio| audio.finished || audio.source.position_seconds() >= video_end)
    }

    fn close(&mut self) -> Result<()> {
        // The video track is wrapped up **first**, then the audio is drained. The order must not be reversed: to keep interleaving, the writer may hold back the audio ready flag to wait for more video data, while video has no next frame at this point. Calling
        // `markAsFinished` first is what tells it this, so the drain loop below does not spin until it times out.
        unsafe { self.video_input.markAsFinished() };
        // The remaining audio is cut at the end of the video, as ffmpeg's `-shortest` does. The chunk granularity is 0.1 s,
        // so when audio is longer than video it exceeds it by less than one chunk at most. In BCF rendering the two are equal in length to begin with, so this never happens.
        let video_end = self.video_seconds();
        while !self.audio_drained(video_end) {
            if !self.pump_audio(video_end)? {
                self.check_failed()?;
                std::thread::sleep(BACKPRESSURE_NAP);
            }
        }
        if let Some(audio) = self.audio.as_mut()
            && !audio.finished
        {
            unsafe { audio.input.markAsFinished() };
            audio.finished = true;
        }
        // From here on the writer is handed to `finishWriting`, and `Drop` must no longer cancel it.
        self.closed = true;
        let (finished_tx, finished_rx) = std::sync::mpsc::sync_channel(1);
        let completion = RcBlock::new(move || {
            let _ = finished_tx.send(());
        });
        unsafe { self.writer.finishWritingWithCompletionHandler(&completion) };
        finished_rx.recv().context("等待 AVFoundation 完成 MP4")?;
        if unsafe { self.writer.status() } != AVAssetWriterStatus::Completed {
            bail!("AVFoundation 完成 MP4 失败：{:?}", unsafe {
                self.writer.error()
            });
        }
        Ok(())
    }
}

impl Drop for AvWriter {
    fn drop(&mut self) {
        // Dropped midway (render error or cancel): cancel explicitly, so the encoder does not run its queue to completion in the background.
        if !self.closed {
            unsafe { self.writer.cancelWriting() };
        }
    }
}

impl Mp4Sink for AvWriter {
    fn write_frame(&mut self, rgba: &[u8]) -> Result<()> {
        // AVFoundation autoreleases a lot internally. One pool per frame means temporary objects do not pile up during a long render until the thread exits.
        objc2::rc::autoreleasepool(|_| self.append_frame(rgba))
    }

    fn finish(mut self: Box<Self>) -> Result<()> {
        objc2::rc::autoreleasepool(|_| self.close())
    }
}

fn new_pixel_buffer(pool: &CVPixelBufferPool) -> Result<CFRetained<CVPixelBuffer>> {
    let mut pointer: *mut CVPixelBuffer = std::ptr::null_mut();
    let status =
        unsafe { CVPixelBufferPool::create_pixel_buffer(None, pool, NonNull::from(&mut pointer)) };
    if status != 0 {
        bail!("AVFoundation 无法分配 BGRA 输出帧：{status}");
    }
    let pointer = NonNull::new(pointer).context("AVFoundation 返回空 BGRA 输出帧")?;
    Ok(unsafe { CFRetained::from_raw(pointer) })
}

/// top-down RGBA8 → 32BGRA pixel buffer.
///
/// `bytesPerRow` includes alignment padding (16/64 bytes), so it **must not** be treated as `width * 4`.
unsafe fn fill_bgra(buffer: &CVPixelBuffer, rgba: &[u8], width: u32, height: u32) -> Result<()> {
    let flags = CVPixelBufferLockFlags(0);
    if unsafe { CVPixelBufferLockBaseAddress(buffer, flags) } != 0 {
        bail!("锁定输出 CVPixelBuffer 失败");
    }
    let outcome = (|| -> Result<()> {
        let buffer_width = CVPixelBufferGetWidth(buffer);
        let buffer_height = CVPixelBufferGetHeight(buffer);
        let stride = CVPixelBufferGetBytesPerRow(buffer);
        let base = CVPixelBufferGetBaseAddress(buffer);
        if base.is_null()
            || buffer_width != width as usize
            || buffer_height != height as usize
            || stride < buffer_width * 4
        {
            bail!(
                "AVFoundation 交出的像素缓冲与请求不符：{buffer_width}x{buffer_height}（请求 {width}x{height}）"
            );
        }
        for y in 0..buffer_height {
            let row = unsafe {
                std::slice::from_raw_parts_mut(base.cast::<u8>().add(y * stride), buffer_width * 4)
            };
            let source = &rgba[y * buffer_width * 4..(y + 1) * buffer_width * 4];
            for (source, target) in source.chunks_exact(4).zip(row.chunks_exact_mut(4)) {
                // R,G,B,A → memory order B,G,R,A.
                target[0] = source[2];
                target[1] = source[1];
                target[2] = source[0];
                target[3] = source[3];
            }
        }
        Ok(())
    })();
    // The unlock runs unconditionally, so an early return on the error above cannot skip it.
    let unlocked = unsafe { CVPixelBufferUnlockBaseAddress(buffer, flags) };
    outcome?;
    if unlocked != 0 {
        bail!("解锁输出 CVPixelBuffer 失败");
    }
    Ok(())
}
