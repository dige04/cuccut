//! Windows native decoding: Media Foundation `IMFSourceReader` + `MFVideoFormat_RGB32`.
//! Single-frame extraction and sequential frame streaming share the same reader setup and pixel transfer. They differ only in how they read.
//!
//! ## Known pitfall: `SetCurrentPosition` only seeks to a keyframe
//!
//! MF's seek semantics are "position to the keyframe no later than the target". On long-GOP material that keyframe can land several seconds before the target. **After a seek you must loop over `ReadSample` and compare timestamps to advance to the target frame**; otherwise the filmstrip shows a long run of identical cells. This is the biggest implementation difference from macOS `AVAssetImageGenerator` (exact when tolerance is zero), and the main complexity of this module.
//!
//! ## Scaling is done on the CPU
//!
//! In theory the reader could be given a target-size output media type so that advanced video processing scales along the way. In practice this path is very picky about format negotiation (different decoders accept different sets of target sizes), and the failure is silent: when negotiation fails, it returns the original size. Thumbnails decode only one frame, so one box downsample on the CPU ([`crate::resize_rgba`]) costs negligible time, and in return the "size contract always holds". The sequential frame stream does not scale at all: the render pipeline wants the source size.
//!
//! ## Rotation
//!
//! MF does not orient frames automatically. The rotation angle is read from the native media type's `MF_MT_VIDEO_ROTATION` and applied during pixel transfer (the same rule as the MF export backend in `apps/cli`).

use std::os::windows::ffi::OsStrExt;
use std::path::Path;

use anyhow::{Context, Result, anyhow, bail};
use windows::Win32::Media::MediaFoundation::*;
use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx, CoUninitialize};
use windows::core::{GUID, Interface, PCWSTR};

use crate::{RgbaFrame, scale};

const HNS_PER_SECOND: f64 = 10_000_000.0;
const VIDEO_STREAM: u32 = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;
const ALL_STREAMS: u32 = MF_SOURCE_READER_ALL_STREAMS.0 as u32;

/// The COM + Media Foundation lifetime during one native media operation (frame extraction, sequential stream, MP4 write). Decoding and encoding share this one: both sides need `CoInitializeEx` + `MFStartup`, and writing it separately on each side would only make the `MFShutdown` pairing harder to see.
pub(crate) struct Runtime;

impl Runtime {
    pub(crate) fn start() -> Result<Self> {
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED)
                .ok()
                .map_err(|error| media_feature_error("初始化 COM", error))?;
            if let Err(error) = MFStartup(MF_VERSION, MFSTARTUP_FULL) {
                CoUninitialize();
                return Err(media_feature_error("启动 Media Foundation", error));
            }
        }
        Ok(Self)
    }
}

impl Drop for Runtime {
    fn drop(&mut self) {
        unsafe {
            let _ = MFShutdown();
            CoUninitialize();
        }
    }
}

pub(crate) fn media_feature_error(context: &str, error: windows::core::Error) -> anyhow::Error {
    anyhow!(
        "{context}失败：{error}。如果使用 Windows N/KN，请在‘可选功能’中安装 Media Feature Pack"
    )
}

/// Paths with the `\\?\` prefix are not recognized by MF's URL parser (it treats them as network addresses), so the same normalization rule as the export backend applies.
pub(crate) fn wide_path(path: &Path) -> Vec<u16> {
    let wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    let verbatim = [b'\\' as u16, b'\\' as u16, b'?' as u16, b'\\' as u16];
    let unc = [b'U' as u16, b'N' as u16, b'C' as u16, b'\\' as u16];
    let mut normalized =
        if wide.starts_with(&verbatim) && wide.get(4..8).is_some_and(|value| value == unc) {
            [b'\\' as u16, b'\\' as u16]
                .into_iter()
                .chain(wide[8..].iter().copied())
                .collect()
        } else if wide.starts_with(&verbatim)
            && wide.get(5) == Some(&(b':' as u16))
            && wide.get(6) == Some(&(b'\\' as u16))
        {
            wide[4..].to_vec()
        } else {
            wide
        };
    normalized.push(0);
    normalized
}

pub(crate) fn pack_ratio(numerator: u32, denominator: u32) -> u64 {
    (u64::from(numerator) << 32) | u64::from(denominator)
}

fn unpack_ratio(value: u64) -> (u32, u32) {
    ((value >> 32) as u32, value as u32)
}

pub(crate) fn extract_frame_rgba(
    path: &Path,
    time_seconds: f64,
    target_width: u32,
) -> Result<RgbaFrame> {
    if !path.is_file() {
        bail!("媒体文件不存在：{}", path.display());
    }
    let _runtime = Runtime::start()?;
    unsafe { extract_inner(path, time_seconds, target_width) }
}

unsafe fn extract_inner(path: &Path, time_seconds: f64, target_width: u32) -> Result<RgbaFrame> {
    let attributes = unsafe {
        let mut value = None;
        MFCreateAttributes(&mut value, 2)
            .map_err(|error| media_feature_error("创建 Media Foundation 属性", error))?;
        let value = value.context("Media Foundation 返回空属性对象")?;
        value.SetUINT32(&MF_SOURCE_READER_ENABLE_ADVANCED_VIDEO_PROCESSING, 1)?;
        value
    };
    let wide = wide_path(path);
    let reader = unsafe { MFCreateSourceReaderFromURL(PCWSTR(wide.as_ptr()), &attributes) }
        .map_err(|error| media_feature_error("打开源媒体", error))?;

    let native = unsafe { reader.GetNativeMediaType(VIDEO_STREAM, 0) }
        .context("unsupported: 源媒体没有视频流")?;
    let (encoded_width, encoded_height) =
        unpack_ratio(unsafe { native.GetUINT64(&MF_MT_FRAME_SIZE) }.context("读取视频尺寸失败")?);
    if encoded_width == 0 || encoded_height == 0 {
        bail!("unsupported: 源媒体没有有效的视频尺寸");
    }
    let rotation = unsafe { native.GetUINT32(&MF_MT_VIDEO_ROTATION) }
        .unwrap_or(0)
        .rem_euclid(360) as u16;

    // Decode only the video track. Decoding the audio track too would just waste time.
    unsafe {
        reader.SetStreamSelection(ALL_STREAMS, false)?;
        reader.SetStreamSelection(VIDEO_STREAM, true)?;
    }
    let rgb32 = unsafe {
        let media_type = MFCreateMediaType()?;
        media_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        media_type.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;
        media_type
    };
    unsafe { reader.SetCurrentMediaType(VIDEO_STREAM, None, &rgb32) }.map_err(|error| {
        anyhow!("unsupported: Media Foundation 无法把该视频解成 RGB32（{error}）")
    })?;

    let target_hns = (time_seconds * HNS_PER_SECOND) as i64;
    if target_hns > 0 {
        let position = PROPVARIANT::from(target_hns);
        unsafe { reader.SetCurrentPosition(&GUID::zeroed(), &position) }.map_err(|error| {
            anyhow!("Media Foundation 无法定位到 {time_seconds:.3}s（{error}）")
        })?;
    }

    // A seek only guarantees landing on a keyframe before the target. Here we advance frame by frame to "the frame that covers t", that is, the last frame whose timestamp is ≤ t. If the first frame is already later than t (the seek overshot, or t is before the first frame), use that frame itself, or an empty frame would be returned.
    let mut held: Option<IMFSample> = None;
    loop {
        let (flags, timestamp, sample) = unsafe { read_sample(&reader)? };
        if flags & MF_SOURCE_READERF_ENDOFSTREAM.0 as u32 != 0 {
            break;
        }
        let Some(sample) = sample else {
            // Stream gap / format change notification: no sample, keep reading.
            continue;
        };
        if timestamp > target_hns {
            if held.is_none() {
                held = Some(sample);
            }
            break;
        }
        held = Some(sample);
    }
    let sample = held.with_context(|| {
        format!(
            "Media Foundation 在 {time_seconds:.3}s 处没有解出任何帧（{}）",
            path.display()
        )
    })?;

    let decoded = unsafe {
        sample_to_rgba(
            &sample,
            encoded_width as usize,
            encoded_height as usize,
            rotation,
        )?
    };
    let height = scale::scaled_height(decoded.width, decoded.height, target_width);
    Ok(scale::resize_rgba(&decoded, target_width, height))
}

unsafe fn read_sample(reader: &IMFSourceReader) -> Result<(u32, i64, Option<IMFSample>)> {
    let mut flags = 0_u32;
    let mut timestamp = 0_i64;
    let mut sample = None;
    unsafe {
        reader.ReadSample(
            VIDEO_STREAM,
            0,
            None,
            Some(&mut flags),
            Some(&mut timestamp),
            Some(&mut sample),
        )?;
    }
    Ok((flags, timestamp, sample))
}

/// RGB32 sample → upright, top-down RGBA8 (source size, not yet scaled).
///
/// The 2D buffer's `Lock2D` is the sole authority on row order and row pitch: `scanline0` always points to the **first visual row**, and `pitch` is the byte step to the next visual row. A negative value means bottom-up. If no 2D buffer is available, fall back to the contiguous buffer and handle it with RGB32's historical default (bottom-up, pitch = width × 4).
unsafe fn sample_to_rgba(
    sample: &IMFSample,
    width: usize,
    height: usize,
    rotation: u16,
) -> Result<RgbaFrame> {
    let two_dimensional = unsafe { sample.GetBufferByIndex(0) }
        .ok()
        .and_then(|buffer| buffer.cast::<IMF2DBuffer>().ok());
    if let Some(buffer) = two_dimensional {
        let mut scanline0: *mut u8 = std::ptr::null_mut();
        let mut pitch = 0_i32;
        unsafe { buffer.Lock2D(&mut scanline0, &mut pitch)? };
        // Between Lock2D and Unlock2D, do not use `?`: the result first lands in `outcome`, and the unlock runs unconditionally.
        let outcome = if scanline0.is_null() || (pitch.unsigned_abs() as usize) < width * 4 {
            Err(anyhow!("Media Foundation 返回了不完整的 RGB32 视频帧"))
        } else {
            Ok(unsafe { copy_rows(scanline0, pitch as isize, width, height, rotation) })
        };
        let unlocked = unsafe { buffer.Unlock2D() };
        let frame = outcome?;
        unlocked?;
        return Ok(frame);
    }
    let buffer = unsafe { sample.ConvertToContiguousBuffer()? };
    let mut pointer = std::ptr::null_mut();
    let mut maximum = 0_u32;
    let mut current = 0_u32;
    unsafe { buffer.Lock(&mut pointer, Some(&mut maximum), Some(&mut current))? };
    let stride = width * 4;
    let outcome = if (current as usize) < stride * height {
        Err(anyhow!("Media Foundation 返回了不完整的 RGB32 视频帧"))
    } else {
        // A contiguous RGB32 buffer is bottom-up: the first visual row is at the end of the buffer, so the stride is negative.
        let first_visual_row = unsafe { pointer.add(stride * (height - 1)) };
        Ok(unsafe {
            copy_rows(
                first_visual_row,
                -(stride as isize),
                width,
                height,
                rotation,
            )
        })
    };
    let unlocked = unsafe { buffer.Unlock() };
    let frame = outcome?;
    unlocked?;
    Ok(frame)
}

/// Transfers RGB32 (memory order B,G,R,X) → RGBA8 one visual row at a time, applying rotation at the same time.
///
/// `first_row` points to the first visual row. `pitch` is the byte step to the next visual row (may be negative). After rotation the output width and height swap for 90/270. Alpha is always 255, because MF's RGB32 often leaves the alpha byte as 0.
unsafe fn copy_rows(
    first_row: *const u8,
    pitch: isize,
    width: usize,
    height: usize,
    rotation: u16,
) -> RgbaFrame {
    let (out_width, out_height) = if matches!(rotation, 90 | 270) {
        (height, width)
    } else {
        (width, height)
    };
    let mut data = vec![0_u8; out_width * out_height * 4];
    for y in 0..height {
        let row = unsafe { first_row.offset(pitch * y as isize) };
        for x in 0..width {
            let pixel = unsafe { std::slice::from_raw_parts(row.add(x * 4), 4) };
            // After rotating clockwise by `rotation` degrees, the target coordinate where source (x, y) lands.
            let (tx, ty) = match rotation {
                90 => (height - 1 - y, x),
                180 => (width - 1 - x, height - 1 - y),
                270 => (y, width - 1 - x),
                _ => (x, y),
            };
            let out = (ty * out_width + tx) * 4;
            data[out] = pixel[2];
            data[out + 1] = pixel[1];
            data[out + 2] = pixel[0];
            data[out + 3] = 255;
        }
    }
    RgbaFrame {
        width: out_width as u32,
        height: out_height as u32,
        data,
    }
}

// ── Sequential frame stream (WP6a)
//
// It shares the reader setup and `sample_to_rgba` with single-frame extraction. There are only two differences:
//
// 1. **No scaling**: the render pipeline wants the source size as is.
// 2. **No frame selection here**: `FrameStream` does frame-rate resampling and start alignment by timestamp. This module only hands out "the next frame in decode order, with its timestamp and duration". The one exception is the batch of frames right after a seek that lie **entirely before the start point**. MF's `SetCurrentPosition` only guarantees landing on a keyframe no later than the target, and on a long GOP that can add dozens of frames. They are bound to be dropped, so skipping them here by timestamp saves the same number of RGB32 → RGBA transfers.

pub(crate) fn open_frame_source(
    path: &Path,
    from_seconds: f64,
) -> Result<Box<dyn crate::frames::FrameSource>> {
    if !path.is_file() {
        bail!("媒体文件不存在：{}", path.display());
    }
    let runtime = Runtime::start()?;
    unsafe { open_inner(runtime, path, from_seconds) }
}

unsafe fn open_inner(
    runtime: Runtime,
    path: &Path,
    from_seconds: f64,
) -> Result<Box<dyn crate::frames::FrameSource>> {
    let attributes = unsafe {
        let mut value = None;
        MFCreateAttributes(&mut value, 2)
            .map_err(|error| media_feature_error("创建 Media Foundation 属性", error))?;
        let value = value.context("Media Foundation 返回空属性对象")?;
        value.SetUINT32(&MF_SOURCE_READER_ENABLE_ADVANCED_VIDEO_PROCESSING, 1)?;
        value
    };
    let wide = wide_path(path);
    let reader = unsafe { MFCreateSourceReaderFromURL(PCWSTR(wide.as_ptr()), &attributes) }
        .map_err(|error| media_feature_error("打开源媒体", error))?;

    let native = unsafe { reader.GetNativeMediaType(VIDEO_STREAM, 0) }
        .context("unsupported: 源媒体没有视频流")?;
    let (encoded_width, encoded_height) =
        unpack_ratio(unsafe { native.GetUINT64(&MF_MT_FRAME_SIZE) }.context("读取视频尺寸失败")?);
    if encoded_width == 0 || encoded_height == 0 {
        bail!("unsupported: 源媒体没有有效的视频尺寸");
    }
    let rotation = unsafe { native.GetUINT32(&MF_MT_VIDEO_ROTATION) }
        .unwrap_or(0)
        .rem_euclid(360) as u16;
    // Track-level frame duration: used to detect the end of the stream when the sample's own duration is invalid. The same pitfall exists on macOS, see `frames::DecodedFrame::duration_seconds`.
    let track_frame_duration = unsafe { native.GetUINT64(&MF_MT_FRAME_RATE) }
        .ok()
        .map(unpack_ratio)
        .filter(|(numerator, denominator)| *numerator > 0 && *denominator > 0)
        .map(|(numerator, denominator)| f64::from(denominator) / f64::from(numerator));

    unsafe {
        reader.SetStreamSelection(ALL_STREAMS, false)?;
        reader.SetStreamSelection(VIDEO_STREAM, true)?;
    }
    let rgb32 = unsafe {
        let media_type = MFCreateMediaType()?;
        media_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        media_type.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;
        media_type
    };
    unsafe { reader.SetCurrentMediaType(VIDEO_STREAM, None, &rgb32) }.map_err(|error| {
        anyhow!("unsupported: Media Foundation 无法把该视频解成 RGB32（{error}）")
    })?;

    let from_hns = (from_seconds * HNS_PER_SECOND) as i64;
    if from_hns > 0 {
        let position = PROPVARIANT::from(from_hns);
        unsafe { reader.SetCurrentPosition(&GUID::zeroed(), &position) }.map_err(|error| {
            anyhow!("Media Foundation 无法定位到 {from_seconds:.3}s（{error}）")
        })?;
    }

    let (width, height) = if matches!(rotation, 90 | 270) {
        (encoded_height, encoded_width)
    } else {
        (encoded_width, encoded_height)
    };
    Ok(Box::new(SourceReaderFrames {
        reader,
        encoded_width: encoded_width as usize,
        encoded_height: encoded_height as usize,
        width,
        height,
        rotation,
        from_hns,
        track_frame_duration,
        finished: false,
        _runtime: runtime,
    }))
}

struct SourceReaderFrames {
    reader: IMFSourceReader,
    encoded_width: usize,
    encoded_height: usize,
    /// Output size after orientation correction.
    width: u32,
    height: u32,
    rotation: u16,
    /// Start media time of the stream (hns). Frames that lie entirely before it are skipped before their pixels are transferred.
    from_hns: i64,
    track_frame_duration: Option<f64>,
    finished: bool,
    /// The COM + Media Foundation lifetime follows the stream (`MFShutdown` + `CoUninitialize` in `Drop`).
    ///
    /// **Must be the last field.** Rust drops fields in declaration order. If it were placed before `reader`, MF would shut down first and then the source reader would be released, so the decoder MFT would get a callback after its module was already unloaded. Measured: `ccut export` always crashed on exit with `0xC0000005` (`msmpeg2vdec.dll_unloaded`, called from `mfreadwrite.dll`). The MP4 was fully written, but the exit code was an access violation. See also `SinkWriter` in `encode_windows.rs`.
    _runtime: Runtime,
}

impl crate::frames::FrameSource for SourceReaderFrames {
    fn size(&self) -> (u32, u32) {
        (self.width, self.height)
    }

    fn next_decoded(&mut self) -> Result<Option<crate::frames::DecodedFrame>> {
        if self.finished {
            return Ok(None);
        }
        loop {
            let (flags, timestamp, sample) = unsafe { read_sample(&self.reader)? };
            if flags & MF_SOURCE_READERF_ENDOFSTREAM.0 as u32 != 0 {
                self.finished = true;
                return Ok(None);
            }
            let Some(sample) = sample else {
                // Stream gap / format change notification: no sample, keep reading.
                continue;
            };
            let duration_hns = unsafe { sample.GetSampleDuration() }.ok();
            let duration_seconds = duration_hns
                .filter(|value| *value > 0)
                .map(|value| value as f64 / HNS_PER_SECOND)
                .or(self.track_frame_duration);
            // The frames between the seek landing point and the start point that are bound to be dropped: skip a frame only when it lies **entirely before** the start. The frame that covers the start (ts ≤ from < ts + dur) must be kept.
            if let Some(duration) = duration_hns.filter(|value| *value > 0)
                && timestamp + duration <= self.from_hns
            {
                continue;
            }
            let frame = unsafe {
                sample_to_rgba(
                    &sample,
                    self.encoded_width,
                    self.encoded_height,
                    self.rotation,
                )?
            };
            return Ok(Some(crate::frames::DecodedFrame {
                pts_seconds: timestamp as f64 / HNS_PER_SECOND,
                duration_seconds,
                frame,
            }));
        }
    }
}

#[cfg(test)]
mod tests {
    /// Media Foundation must shut down after every COM interface it has issued. `Runtime`'s `Drop` runs `MFShutdown` + `CoUninitialize`, and Rust drops fields in **declaration order**, so the struct that holds it must list it as the last field.
    ///
    /// Once, `SourceReaderFrames` had `_runtime` placed before `reader`. MF shut down first, and only then was the source reader released. `mfreadwrite.dll` called back into the unloaded decoder MFT, and `ccut export` exited with `0xC0000005` every time it finished. The MP4 was actually fully written, but the exit code was an access violation, and callers treated every such exit as an export failure. No type can express field order, so it can only be pinned by scanning the source.
    #[test]
    fn every_media_foundation_runtime_is_declared_as_the_last_droppable_field() {
        for file in ["windows.rs", "encode_windows.rs", "playback_windows.rs"] {
            let source = std::fs::read_to_string(
                std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("src")
                    .join(file),
            )
            .expect("读取平台源码");
            for (index, line) in source.lines().enumerate() {
                if line.trim() != "_runtime: Runtime," {
                    continue;
                }
                // After this, only fields without any drop behavior may appear (currently only PhantomData), and then the struct's closing `}` must come.
                let rest = source
                    .lines()
                    .skip(index + 1)
                    .map(str::trim)
                    .filter(|line| !line.is_empty() && !line.starts_with("///"));
                for following in rest {
                    if following == "}" {
                        break;
                    }
                    assert!(
                        following.contains("PhantomData"),
                        "{file}:{} 的 Runtime 后面还有会析构的字段 `{following}`",
                        index + 1
                    );
                }
            }
        }
    }
}
