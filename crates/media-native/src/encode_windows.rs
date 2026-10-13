//! Native MP4 writing on Windows: Media Foundation `IMFSinkWriter` + H.264 MFT + AAC MFT.
//!
//! The structure is the same as the shipping export backend in `core/crates/ccut-kernel/src/services/native_video/platform.rs` (media type negotiation, NV12 input preferred, GOP set explicitly, faststart capability probing), but the scenario is much simpler:
//! there, the source stream is decoded while subtitles are composited and frames are laid out on a CFR grid; here the frames are delivered in order by `ccut-render`, and the writing side only has to "feed the encoder".
//!
//! ## NV12 input preferred
//!
//! The hardware H.264 MFT registers an NV12-family input. Matching it directly avoids the RGB32→YUV software conversion MFT that MF would otherwise insert, and lets the hardware encoder actually get selected. 4:2:0 requires even width and height,
//! and [`crate::open_mp4_writer`] already rejects odd canvases at the door, so NV12 can always be negotiated here. Negotiation can still fail if the machine has no encoder with NV12 input, and then it falls back to RGB32.
//!
//! ## Audio is 16-bit PCM
//!
//! The mix is f32, but the AAC MFT's input type is 16-bit PCM (`MFAudioFormat_PCM` in MF only negotiates integers). The conversion is done here: clamp to [-1, 1], then scale by 32767, matching the `f32 → s16` step that ffmpeg performs before `-c:a aac`.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow, bail};
use windows::Win32::Media::MediaFoundation::*;
use windows::core::{GUID, PCWSTR};

use crate::encode::{
    AUDIO_CHANNELS, AUDIO_LEAD_SECONDS, AUDIO_SAMPLE_RATE, Mp4Sink, PcmChunk, PcmSource,
    WriterSetup,
};
use crate::windows::{Runtime, media_feature_error, pack_ratio, wide_path};

const HNS_PER_SECOND: i64 = 10_000_000;

/// Keyframe interval (seconds). Measured in this repo, the encoder's default GOP can get so sparse that only the first frame is a keyframe,
/// and scrubbing the preview is painful; 2 seconds matches the export backend.
const KEYFRAME_INTERVAL_SECONDS: f64 = 2.0;

// ── BT.709 limited range fixed-point coefficients (scaled by 1<<16), in order R, G, B.
//
// Bit-for-bit identical to the `apps/cli` export backend: each of the two chroma coefficient sets sums to 0, and the luma set sums to the fixed-point value of 219/255.
// Pure black lands exactly on Y=16/UV=128, and pure white exactly on Y=235/UV=128, without relying on clamping as a fallback.
const BT709_LUMA: [i32; 3] = [11966, 40254, 4064];
const BT709_CHROMA_BLUE: [i32; 3] = [-6596, -22189, 28785];
const BT709_CHROMA_RED: [i32; 3] = [28785, -26145, -2640];

#[inline]
fn bt709_luma(red: u8, green: u8, blue: u8) -> u8 {
    let value = BT709_LUMA[0] * i32::from(red)
        + BT709_LUMA[1] * i32::from(green)
        + BT709_LUMA[2] * i32::from(blue);
    (16 + ((value + 32768) >> 16)).clamp(0, 255) as u8
}

#[inline]
fn bt709_chroma(coefficients: [i32; 3], red: i32, green: i32, blue: i32) -> u8 {
    let value = coefficients[0] * red + coefficients[1] * green + coefficients[2] * blue;
    (128 + ((value + 32768) >> 16)).clamp(0, 255) as u8
}

/// Rounded average of the four components in a 2x2 block.
#[inline]
fn average4(first: u8, second: u8, third: u8, fourth: u8) -> i32 {
    (i32::from(first) + i32::from(second) + i32::from(third) + i32::from(fourth) + 2) >> 2
}

/// top-down RGBA8 → NV12 (BT.709 limited range; the Y plane is followed directly by the interleaved UV plane).
///
/// Preconditions: `width` and `height` are both even, and both planes have a row stride equal to `width`. Chroma is 4:2:0: the RGB is averaged over each 2x2 block first and then converted; luma is still computed independently per pixel.
fn rgba_to_nv12(rgba: &[u8], width: usize, height: usize, nv12: &mut [u8]) {
    debug_assert_eq!(width % 2, 0);
    debug_assert_eq!(height % 2, 0);
    let (luma, chroma) = nv12.split_at_mut(width * height);
    for pair in 0..height / 2 {
        let row = pair * 2;
        let (top, bottom) = rgba[row * width * 4..(row + 2) * width * 4].split_at(width * 4);
        let (luma_top, luma_bottom) = luma[row * width..(row + 2) * width].split_at_mut(width);
        let chroma_row = &mut chroma[pair * width..(pair + 1) * width];
        for block in 0..width / 2 {
            let offset = block * 8;
            let upper = &top[offset..offset + 8];
            let lower = &bottom[offset..offset + 8];
            luma_top[block * 2] = bt709_luma(upper[0], upper[1], upper[2]);
            luma_top[block * 2 + 1] = bt709_luma(upper[4], upper[5], upper[6]);
            luma_bottom[block * 2] = bt709_luma(lower[0], lower[1], lower[2]);
            luma_bottom[block * 2 + 1] = bt709_luma(lower[4], lower[5], lower[6]);
            let red = average4(upper[0], upper[4], lower[0], lower[4]);
            let green = average4(upper[1], upper[5], lower[1], lower[5]);
            let blue = average4(upper[2], upper[6], lower[2], lower[6]);
            chroma_row[block * 2] = bt709_chroma(BT709_CHROMA_BLUE, red, green, blue);
            chroma_row[block * 2 + 1] = bt709_chroma(BT709_CHROMA_RED, red, green, blue);
        }
    }
}

unsafe fn attributes(capacity: u32) -> Result<IMFAttributes> {
    let mut value = None;
    unsafe { MFCreateAttributes(&mut value, capacity) }
        .map_err(|error| media_feature_error("创建 Media Foundation 属性", error))?;
    value.context("Media Foundation 返回空属性对象")
}

unsafe fn video_type(
    subtype: &GUID,
    width: u32,
    height: u32,
    fps_num: u32,
    fps_den: u32,
) -> Result<IMFMediaType> {
    let media_type = unsafe { MFCreateMediaType()? };
    unsafe {
        media_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        media_type.SetGUID(&MF_MT_SUBTYPE, subtype)?;
        media_type.SetUINT64(&MF_MT_FRAME_SIZE, pack_ratio(width, height))?;
        media_type.SetUINT64(&MF_MT_FRAME_RATE, pack_ratio(fps_num, fps_den))?;
        media_type.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, pack_ratio(1, 1))?;
        media_type.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
    }
    Ok(media_type)
}

unsafe fn pcm_type() -> Result<IMFMediaType> {
    let media_type = unsafe { MFCreateMediaType()? };
    unsafe {
        media_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Audio)?;
        media_type.SetGUID(&MF_MT_SUBTYPE, &MFAudioFormat_PCM)?;
        media_type.SetUINT32(&MF_MT_AUDIO_NUM_CHANNELS, AUDIO_CHANNELS)?;
        media_type.SetUINT32(&MF_MT_AUDIO_SAMPLES_PER_SECOND, AUDIO_SAMPLE_RATE)?;
        media_type.SetUINT32(&MF_MT_AUDIO_BITS_PER_SAMPLE, 16)?;
        media_type.SetUINT32(&MF_MT_AUDIO_BLOCK_ALIGNMENT, 2 * AUDIO_CHANNELS)?;
        media_type.SetUINT32(
            &MF_MT_AUDIO_AVG_BYTES_PER_SECOND,
            2 * AUDIO_CHANNELS * AUDIO_SAMPLE_RATE,
        )?;
        media_type.SetUINT32(&MF_MT_FIXED_SIZE_SAMPLES, 1)?;
        media_type.SetUINT32(&MF_MT_ALL_SAMPLES_INDEPENDENT, 1)?;
    }
    Ok(media_type)
}

/// AAC-LC output type. MF's AAC encoder accepts only four tiers: 96/128/160/192 kbps
/// (`MF_MT_AUDIO_AVG_BYTES_PER_SECOND` takes 12000/16000/20000/24000);
/// other requests snap to the nearest tier.
unsafe fn aac_type(bitrate: u32) -> Result<IMFMediaType> {
    let bytes_per_second = [12_000u32, 16_000, 20_000, 24_000]
        .into_iter()
        .min_by_key(|candidate| candidate.abs_diff(bitrate / 8))
        .unwrap_or(16_000);
    let media_type = unsafe { MFCreateMediaType()? };
    unsafe {
        media_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Audio)?;
        media_type.SetGUID(&MF_MT_SUBTYPE, &MFAudioFormat_AAC)?;
        media_type.SetUINT32(&MF_MT_AUDIO_NUM_CHANNELS, AUDIO_CHANNELS)?;
        media_type.SetUINT32(&MF_MT_AUDIO_SAMPLES_PER_SECOND, AUDIO_SAMPLE_RATE)?;
        media_type.SetUINT32(&MF_MT_AUDIO_BITS_PER_SAMPLE, 16)?;
        media_type.SetUINT32(&MF_MT_AUDIO_AVG_BYTES_PER_SECOND, bytes_per_second)?;
        media_type.SetUINT32(&MF_MT_AUDIO_BLOCK_ALIGNMENT, 1)?;
        media_type.SetUINT32(&MF_MT_AAC_PAYLOAD_TYPE, 0)?;
        media_type.SetUINT32(&MF_MT_AAC_AUDIO_PROFILE_LEVEL_INDICATION, 0x29)?;
        media_type.SetUINT32(&MF_MT_AUDIO_PREFER_WAVEFORMATEX, 1)?;
    }
    Ok(media_type)
}

/// One block of pixel bytes → an `IMFSample` with a timestamp.
unsafe fn sample_from_bytes(pixels: &[u8], time: i64, duration: i64) -> Result<IMFSample> {
    let length: u32 = pixels
        .len()
        .try_into()
        .context("单帧超过 4 GiB，Media Foundation 缓冲装不下")?;
    let buffer = unsafe { MFCreateMemoryBuffer(length)? };
    let mut pointer = std::ptr::null_mut();
    unsafe { buffer.Lock(&mut pointer, None, None)? };
    unsafe { std::slice::from_raw_parts_mut(pointer, pixels.len()) }.copy_from_slice(pixels);
    unsafe {
        buffer.Unlock()?;
        buffer.SetCurrentLength(length)?;
    }
    let sample = unsafe { MFCreateSample()? };
    unsafe {
        sample.AddBuffer(&buffer)?;
        sample.SetSampleTime(time)?;
        sample.SetSampleDuration(duration)?;
    }
    Ok(sample)
}

/// Temporary file for the faststart probe: in the same directory as the real output (same volume and filesystem), with a unique suffix so it never collides with the real output path.
fn faststart_probe_path(output: &Path) -> PathBuf {
    let mut name = output
        .file_name()
        .map(|value| value.to_os_string())
        .unwrap_or_default();
    name.push(".faststart-probe.mp4");
    output.with_file_name(name)
}

/// Write a 96x64 black frame to the temporary file and Finalize, to check whether the local MP4 sink can rewrite the moov to the front.
/// Hardware conversion is explicitly turned off: the moov layout is a sink-side behaviour and has nothing to do with which encoder MFT feeds it.
unsafe fn faststart_probe(path: &Path) -> Result<()> {
    const WIDTH: u32 = 96;
    const HEIGHT: u32 = 64;
    const FPS: u32 = 30;
    let attrs = unsafe { attributes(2)? };
    unsafe {
        attrs.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 0)?;
        attrs.SetUINT32(&MF_MPEG4SINK_MOOV_BEFORE_MDAT, 1)?;
    }
    let wide = wide_path(path);
    let writer = unsafe {
        MFCreateSinkWriterFromURL(PCWSTR(wide.as_ptr()), None::<&IMFByteStream>, &attrs)?
    };
    let encoded = unsafe { video_type(&MFVideoFormat_H264, WIDTH, HEIGHT, FPS, 1)? };
    unsafe {
        encoded.SetUINT32(&MF_MT_AVG_BITRATE, 100_000)?;
        encoded.SetUINT32(&MF_MT_MPEG2_PROFILE, 100)?;
    }
    let stream = unsafe { writer.AddStream(&encoded)? };
    let input = unsafe { video_type(&MFVideoFormat_RGB32, WIDTH, HEIGHT, FPS, 1)? };
    unsafe {
        writer.SetInputMediaType(stream, &input, None::<&IMFAttributes>)?;
        writer.BeginWriting()?;
    }
    let frame_duration = HNS_PER_SECOND / i64::from(FPS);
    let pixels = vec![0_u8; (WIDTH * HEIGHT * 4) as usize];
    for index in 0..2_i64 {
        let sample = unsafe { sample_from_bytes(&pixels, index * frame_duration, frame_duration)? };
        unsafe { writer.WriteSample(stream, &sample)? };
    }
    unsafe { writer.Finalize()? };
    Ok(())
}

/// Whether the local MP4 sink supports moov at the front.
///
/// On some Windows versions, `MF_MPEG4SINK_MOOV_BEFORE_MDAT=1` makes Finalize return `E_ACCESSDENIED` right away, and the whole render is wasted; the same code works on other machines. So it is probed once, before starting, per “this machine’s capability”. Any unexpected problem in the probe itself counts as unsupported: a broken probe must never sink a render that would otherwise have succeeded.
fn faststart_finalize_works(output: &Path) -> bool {
    let path = faststart_probe_path(output);
    let outcome = unsafe { faststart_probe(&path) };
    // The COM objects have all been released when `faststart_probe` returns; the temporary file is removed whether it succeeded or failed.
    let _ = std::fs::remove_file(&path);
    outcome.is_ok()
}

struct AudioTrack {
    stream: u32,
    source: PcmSource,
    /// The PCM has been fully read.
    finished: bool,
}

pub(crate) struct SinkWriter {
    /// The COM and Media Foundation lifetime follows the writer (`MFShutdown` in `Drop`).
    /// Field order is drop order: the writer is released first, and the runtime is shut down after.
    writer: IMFSinkWriter,
    video_stream: u32,
    audio: Option<AudioTrack>,
    width: usize,
    height: usize,
    fps_num: u32,
    fps_den: u32,
    /// Encoder input uses NV12 (otherwise RGB32).
    nv12: bool,
    /// Input buffer reused across frames; allocated only on the first frame.
    staging: Vec<u8>,
    frames: u64,
    _runtime: Runtime,
}

pub(crate) fn open(out: &Path, setup: WriterSetup) -> Result<Box<dyn Mp4Sink>> {
    let runtime = Runtime::start()?;
    let writer = unsafe { open_inner(runtime, out, setup) }?;
    Ok(Box::new(writer) as Box<dyn Mp4Sink>)
}

unsafe fn open_inner(runtime: Runtime, out: &Path, setup: WriterSetup) -> Result<SinkWriter> {
    let WriterSetup {
        width,
        height,
        fps_num,
        fps_den,
        bitrate,
        audio,
        audio_bitrate,
    } = setup;
    let exact_fps = f64::from(fps_num) / f64::from(fps_den);
    let faststart = faststart_finalize_works(out);
    if !faststart {
        eprintln!(
            "warning: 本机 Media Foundation 不支持 moov 前置（faststart），已回退为标准 MP4 布局"
        );
    }
    let writer_attrs = unsafe { attributes(2)? };
    unsafe {
        writer_attrs.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1)?;
        writer_attrs.SetUINT32(&MF_MPEG4SINK_MOOV_BEFORE_MDAT, u32::from(faststart))?;
    }
    let output_path = wide_path(out);
    let writer = unsafe {
        MFCreateSinkWriterFromURL(
            PCWSTR(output_path.as_ptr()),
            None::<&IMFByteStream>,
            &writer_attrs,
        )
    }
    .map_err(|error| media_feature_error("创建 MP4 Sink Writer", error))?;

    let encoded_video =
        unsafe { video_type(&MFVideoFormat_H264, width, height, fps_num, fps_den)? };
    unsafe {
        encoded_video.SetUINT32(&MF_MT_AVG_BITRATE, bitrate)?;
        encoded_video.SetUINT32(&MF_MT_MPEG2_PROFILE, 100)?;
        // BT.709 colour tags are set on the output type, and the H.264 MFT fills the VUI from them (primaries /
        // transfer / matrix). Whether they actually end up in the bitstream has not yet been verified with ffprobe on Windows.
        encoded_video.SetUINT32(&MF_MT_VIDEO_PRIMARIES, MFVideoPrimaries_BT709.0 as u32)?;
        encoded_video.SetUINT32(&MF_MT_TRANSFER_FUNCTION, MFVideoTransFunc_709.0 as u32)?;
        encoded_video.SetUINT32(&MF_MT_YUV_MATRIX, MFVideoTransferMatrix_BT709.0 as u32)?;
        encoded_video.SetUINT32(&MF_MT_VIDEO_NOMINAL_RANGE, MFNominalRange_16_235.0 as u32)?;
        // The GOP must be set explicitly: measured in this repo, the encoder's default keyframe interval can get so sparse that only the first frame
        // is a keyframe. The GOP length does not go into avcC or the sequence header, so it does not affect the equality check on the format description.
        encoded_video.SetUINT32(
            &MF_MT_MAX_KEYFRAME_SPACING,
            ((exact_fps * KEYFRAME_INTERVAL_SECONDS).round() as u32).max(1),
        )?;
    }
    let video_stream = unsafe { writer.AddStream(&encoded_video) }.map_err(|error| {
        media_feature_error(
            "unsupported: 创建 H.264 输出流（系统可能缺少视频编码器）",
            error,
        )
    })?;

    // NV12 first (the hardware MFT's native input); if negotiation fails, fall back to RGB32. Odd canvases are already rejected at the door by
    // `open_mp4_writer`, so there is no need to check for evenness here.
    let nv12 = {
        let media_type =
            unsafe { video_type(&MFVideoFormat_NV12, width, height, fps_num, fps_den)? };
        unsafe {
            media_type.SetUINT32(&MF_MT_DEFAULT_STRIDE, width)?;
            // Explicitly tag the matrix and quantisation range: without the tag, the encoder may label it as BT.601,
            // and the player would shift the colours.
            media_type.SetUINT32(&MF_MT_YUV_MATRIX, MFVideoTransferMatrix_BT709.0 as u32)?;
            media_type.SetUINT32(&MF_MT_VIDEO_NOMINAL_RANGE, MFNominalRange_16_235.0 as u32)?;
            writer
                .SetInputMediaType(video_stream, &media_type, None::<&IMFAttributes>)
                .is_ok()
        }
    };
    if !nv12 {
        let input_video =
            unsafe { video_type(&MFVideoFormat_RGB32, width, height, fps_num, fps_den)? };
        unsafe { writer.SetInputMediaType(video_stream, &input_video, None::<&IMFAttributes>) }
            .map_err(|error| media_feature_error("unsupported: 配置 RGB32→H.264 编码器", error))?;
    }

    let audio = match audio {
        Some(source) => {
            let encoded_audio = unsafe { aac_type(audio_bitrate)? };
            let stream = unsafe { writer.AddStream(&encoded_audio) }
                .map_err(|error| media_feature_error("unsupported: 创建 AAC-LC 输出流", error))?;
            let pcm = unsafe { pcm_type()? };
            unsafe { writer.SetInputMediaType(stream, &pcm, None::<&IMFAttributes>) }
                .map_err(|error| media_feature_error("unsupported: 配置 PCM→AAC 编码器", error))?;
            Some(AudioTrack {
                stream,
                source,
                finished: false,
            })
        }
        None => None,
    };
    unsafe { writer.BeginWriting() }
        .map_err(|error| media_feature_error("unsupported: 启动 MP4 写入", error))?;

    Ok(SinkWriter {
        writer,
        video_stream,
        audio,
        width: width as usize,
        height: height as usize,
        fps_num,
        fps_den,
        nv12,
        staging: Vec::new(),
        frames: 0,
        _runtime: runtime,
    })
}

impl SinkWriter {
    fn frame_duration_hns(&self) -> i64 {
        HNS_PER_SECOND * i64::from(self.fps_den) / i64::from(self.fps_num.max(1))
    }

    fn video_seconds(&self) -> f64 {
        self.frames as f64 * f64::from(self.fps_den) / f64::from(self.fps_num)
    }

    /// Feed audio up to `limit_seconds` (a hard limit on the audio timeline).
    ///
    /// `IMFSinkWriter::WriteSample` handles interleaving and back-pressure itself (through its internal queue). Unlike
    /// AVFoundation, it does not need external polling of ready flags, so here audio is purely "advance on demand".
    fn pump_audio(&mut self, limit_seconds: f64) -> Result<()> {
        let Some(audio) = self.audio.as_mut() else {
            return Ok(());
        };
        while !audio.finished && audio.source.position_seconds() < limit_seconds {
            let Some(chunk) = audio.source.next_chunk()? else {
                audio.finished = true;
                break;
            };
            let sample = unsafe { pcm_sample(&chunk)? };
            unsafe { self.writer.WriteSample(audio.stream, &sample) }
                .map_err(|error| anyhow!("Media Foundation 写入 AAC 音频失败：{error}"))?;
        }
        Ok(())
    }
}

/// One block of interleaved f32 PCM → a 16-bit PCM `IMFSample`.
unsafe fn pcm_sample(chunk: &PcmChunk) -> Result<IMFSample> {
    let mut bytes = Vec::with_capacity(chunk.samples.len() * 2);
    for sample in &chunk.samples {
        let value = (sample.clamp(-1.0, 1.0) * 32767.0).round() as i16;
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    let rate = i64::from(AUDIO_SAMPLE_RATE);
    let time = chunk.start_frame as i64 * HNS_PER_SECOND / rate;
    let duration = chunk.frames() as i64 * HNS_PER_SECOND / rate;
    unsafe { sample_from_bytes(&bytes, time, duration) }
}

impl Mp4Sink for SinkWriter {
    fn write_frame(&mut self, rgba: &[u8]) -> Result<()> {
        let expected = self.width * self.height * 4;
        if rgba.len() != expected {
            bail!(
                "MP4 帧字节数与几何不符：{}x{} 需要 {expected} 字节，实得 {}",
                self.width,
                self.height,
                rgba.len()
            );
        }
        self.pump_audio(self.video_seconds() + AUDIO_LEAD_SECONDS)?;
        let (width, height) = (self.width, self.height);
        if self.nv12 {
            self.staging.resize(width * height * 3 / 2, 0);
            rgba_to_nv12(rgba, width, height, &mut self.staging);
        } else {
            // The contiguous RGB32 buffer is bottom-up, with memory order B,G,R,X.
            self.staging.resize(width * height * 4, 0);
            for y in 0..height {
                let source = &rgba[y * width * 4..(y + 1) * width * 4];
                let target_row = height - 1 - y;
                let target =
                    &mut self.staging[target_row * width * 4..(target_row + 1) * width * 4];
                for (source, target) in source.chunks_exact(4).zip(target.chunks_exact_mut(4)) {
                    target[0] = source[2];
                    target[1] = source[1];
                    target[2] = source[0];
                    target[3] = source[3];
                }
            }
        }
        let duration = self.frame_duration_hns();
        let time = self.frames as i64 * duration;
        let sample = unsafe { sample_from_bytes(&self.staging, time, duration)? };
        unsafe { self.writer.WriteSample(self.video_stream, &sample) }
            .map_err(|error| anyhow!("Media Foundation 写入视频帧失败：{error}"))?;
        self.frames += 1;
        Ok(())
    }

    fn finish(mut self: Box<Self>) -> Result<()> {
        // The remaining audio is cut at the end of the video, as ffmpeg's `-shortest` does.
        let video_end = self.video_seconds();
        self.pump_audio(video_end)?;
        // Dropped midway (render error or cancel) without calling `Finalize`: when the sink is released it leaves a half-written file with no
        // moov. The caller was rendering to a temporary file anyway, so it can simply be deleted.
        unsafe { self.writer.Finalize() }
            .map_err(|error| anyhow!("Media Foundation 完成 MP4 失败：{error}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The NV12 conversion of solid colour blocks is bit-for-bit identical to the `apps/cli` export backend (same set of fixed-point coefficients):
    /// pure black lands on Y=16/UV=128, and pure white on Y=235/UV=128.
    #[test]
    fn solid_colours_land_on_the_limited_range_anchors() {
        let mut nv12 = vec![0_u8; 2 * 2 * 3 / 2];
        let black = vec![0_u8, 0, 0, 255].repeat(4);
        rgba_to_nv12(&black, 2, 2, &mut nv12);
        assert_eq!(&nv12[..4], &[16, 16, 16, 16]);
        assert_eq!(&nv12[4..], &[128, 128]);
        let white = vec![255_u8, 255, 255, 255].repeat(4);
        rgba_to_nv12(&white, 2, 2, &mut nv12);
        assert_eq!(&nv12[..4], &[235, 235, 235, 235]);
        assert_eq!(&nv12[4..], &[128, 128]);
    }
}
