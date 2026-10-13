//! macOS native decoding: single-frame extraction uses `AVAssetImageGenerator`, and sequential frame streams use `AVAssetReader`.
//!
//! ## Why the two paths do not share one object
//!
//! `AVAssetReader` is designed for sequential streams: building a reader is only worth it when reading a long run of frames. Thumbnails and filmstrips are the opposite: random time points, one frame at a time. `AVAssetImageGenerator` is the interface the system provides for the latter scenario, and it manages decoders and seeking internally. With `requestedTimeToleranceBefore/After` set to zero, the frame fetch is **exact**, equivalent to the pre-migration `ffmpeg -ss <t> -i <src> -frames:v 1` semantics (a fast seek to the keyframe, then decoding forward to t).
//! Sequential frame supply for the render pipeline uses the `AVAssetReader` stream in the lower half of this file.
//!
//! ## Rotation
//!
//! Portrait phone footage has to be rotated upright to display orientation. ffmpeg CLI's autorotate is on by default, and the fallback path's output is already upright, so the two paths must agree. The single-frame path relies on `appliesPreferredTrackTransform = YES`. The sequential stream has no such switch, so it reads the quadrant from `preferredTransform` and rotates the pixels itself. (This is a different matter from `naturalW/H` in `ccut-media-probe`, which excludes rotation. That one is a metadata basis, and this one is a pixel basis.)
//!
//! ## Size
//!
//! The `maximumSize` on the single-frame path is only a **fast-path hint**. It lets the system scale the frame down within the decode pipeline, which avoids a full 4K bitmap. But it only scales down and follows its own rounding rules, so the final size is decided by the bitmap context. The target height is computed by [`crate::scaled_height`], an RGBA context of exactly `w × h` is created, and CoreGraphics draws the CGImage into it. The first row of the context's memory is the top row of the image, so no extra flip is needed. The sequential stream does not scale by default, because `ccut-render`'s frame stream wants the source size as-is. When the sequential decoder used for video export ([`crate::SequentialDecoder`]) is given a delivery size, the `AVAssetReaderTrackOutput` output settings carry the width and height, and the decode pipeline delivers that size directly. (Ported from v2 `native_video.rs`'s `reader_pixel_settings`.)

#![allow(deprecated)]

use std::path::Path;
use std::ptr::{self, NonNull};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result, anyhow, bail};
use block2::RcBlock;
use objc2::AnyThread;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_av_foundation::{
    AVAssetImageGenerator, AVAssetReader, AVAssetReaderStatus, AVAssetReaderTrackOutput,
    AVAssetTrack, AVMediaTypeVideo, AVSampleBufferGenerator, AVSampleBufferRequest, AVSampleCursor,
    AVURLAsset,
};
use objc2_core_foundation::{
    CFDictionary, CFRetained, CFString, CGAffineTransform, CGPoint, CGRect, CGSize,
};
use objc2_core_graphics::{
    CGBitmapContextCreate, CGColorSpace, CGContext, CGImage, CGImageAlphaInfo,
    CGImageByteOrderInfo, CGInterpolationQuality,
};
use objc2_core_media::{
    CMFormatDescription, CMSampleBufferGetDuration, CMSampleBufferGetImageBuffer,
    CMSampleBufferGetPresentationTimeStamp, CMTime, CMTimeRange, kCMTimePositiveInfinity,
};
use objc2_core_video::{
    CVImageBuffer, CVPixelBufferGetBaseAddress, CVPixelBufferGetBytesPerRow,
    CVPixelBufferGetHeight, CVPixelBufferGetWidth, CVPixelBufferLockBaseAddress,
    CVPixelBufferLockFlags, CVPixelBufferUnlockBaseAddress, kCVPixelBufferHeightKey,
    kCVPixelBufferPixelFormatTypeKey, kCVPixelBufferWidthKey, kCVPixelFormatType_32BGRA,
};
use objc2_foundation::{NSDictionary, NSNumber, NSString, NSURL};
use objc2_video_toolbox::{VTDecodeFrameFlags, VTDecodeInfoFlags, VTDecompressionSession};

use crate::frames::{DecodedFrame, DecodedInto, FrameSource};
use crate::{RgbaFrame, scale};

/// The timebase for frame-fetch times. 600 is a common multiple of 24, 25, 30 and 60 fps, and it is the idiomatic value in Apple's own samples. Frame boundaries at common frame rates can be represented exactly, and timebase truncation does not push them onto adjacent frames.
const TIMESCALE: i32 = 600;

pub(crate) fn extract_frame_rgba(
    path: &Path,
    time_seconds: f64,
    target_width: u32,
) -> Result<RgbaFrame> {
    if !path.is_file() {
        bail!("media file does not exist: {}", path.display());
    }
    // AVFoundation uses autorelease heavily. Each frame fetch gets its own pool, so temporary objects do not pile up until the thread exits, even when a filmstrip fetches dozens of cells in a row.
    objc2::rc::autoreleasepool(|_| unsafe { extract_inner(path, time_seconds, target_width) })
}

unsafe fn extract_inner(path: &Path, time_seconds: f64, target_width: u32) -> Result<RgbaFrame> {
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    let asset = unsafe { AVURLAsset::URLAssetWithURL_options(&url, None) };
    let generator = unsafe { AVAssetImageGenerator::assetImageGeneratorWithAsset(&asset) };
    unsafe {
        generator.setAppliesPreferredTrackTransform(true);
        // Zero tolerance means exact frame fetching. With the default kCMTimePositiveInfinity tolerance, the system returns the nearest keyframe directly. On long-GOP material that can be several seconds off, and the filmstrip would show a run of identical cells.
        generator.setRequestedTimeToleranceBefore(CMTime::with_seconds(0.0, TIMESCALE));
        generator.setRequestedTimeToleranceAfter(CMTime::with_seconds(0.0, TIMESCALE));
        // A fast-path hint for the width constraint: the height is set to a large value that will not become the constraint, so the system scales by width.
        generator.setMaximumSize(CGSize {
            width: f64::from(target_width),
            height: f64::from(u16::MAX),
        });
    }
    let requested = unsafe { CMTime::with_seconds(time_seconds, TIMESCALE) };
    let image =
        unsafe { generator.copyCGImageAtTime_actualTime_error(requested, std::ptr::null_mut()) }
            .map_err(|error| {
                anyhow!(
                    "AVFoundation failed to fetch frame (t={time_seconds:.3}s, {}): {error}",
                    path.display()
                )
            })?;
    let source_width = CGImage::width(Some(&image));
    let source_height = CGImage::height(Some(&image));
    if source_width == 0 || source_height == 0 {
        bail!("AVFoundation returned an empty frame (t={time_seconds:.3}s)");
    }
    let height = scale::scaled_height(source_width as u32, source_height as u32, target_width);
    draw_into_rgba(&image, target_width, height)
}

/// CGImage → top-down RGBA8 of exactly `width × height`.
///
/// The first row of the bitmap context's data buffer is the top row of the image (the established memory layout of CGBitmapContext). Drawing the CGImage into the `(0, 0, w, h)` rectangle gives an upright, top-down image, with no flip needed. Scaling is left to CoreGraphics (high-quality interpolation), not this crate's CPU box filter.
fn draw_into_rgba(image: &CGImage, width: u32, height: u32) -> Result<RgbaFrame> {
    let (pixel_width, pixel_height) = (width as usize, height as usize);
    let stride = pixel_width * 4;
    let mut data = vec![0_u8; stride * pixel_height];
    let color_space = CGColorSpace::new_device_rgb().context("failed to create sRGB device color space")?;
    // RGBA8: alpha is in the last position, 32-bit big-endian (that is, byte order R,G,B,A). Video frames are opaque, so premultiplication does not change the result. Below, alpha is still uniformly forced to 255.
    let bitmap_info = CGImageAlphaInfo::PremultipliedLast.0 | CGImageByteOrderInfo::Order32Big.0;
    let context = unsafe {
        CGBitmapContextCreate(
            data.as_mut_ptr().cast(),
            pixel_width,
            pixel_height,
            8,
            stride,
            Some(&color_space),
            bitmap_info,
        )
    }
    .context("failed to create RGBA bitmap context")?;
    CGContext::set_interpolation_quality(Some(&context), CGInterpolationQuality::High);
    CGContext::draw_image(
        Some(&context),
        CGRect {
            origin: CGPoint { x: 0.0, y: 0.0 },
            size: CGSize {
                width: f64::from(width),
                height: f64::from(height),
            },
        },
        Some(image),
    );
    // The context still holds a pointer to `data`. Explicitly drop it before the buffer is touched.
    drop(context);
    for pixel in data.chunks_exact_mut(4) {
        pixel[3] = 255;
    }
    RgbaFrame::new(width, height, data)
}

// ── Sequential frame stream (WP6a): `AVAssetReader` + `AVAssetReaderTrackOutput`
//
// ## Why not an image generator
//
// The single-frame path builds a decoder and does an exact seek every time. Doing that for every frame of a whole-timeline render is pure waste. `AVAssetReader` is exactly the interface for "build once, read straight through". `timeRange` bounds the start point, and then `copyNextSampleBuffer` hands out `CMSampleBuffer`s in order.
//
// ## Rotation has to be done by ourselves
//
// The track output does **not** have `appliesPreferredTrackTransform`. That is a capability of the image generator and video composition. Here the rotation quadrant is read from `preferredTransform` and applied on the CPU ([`scale::rotate_rgba`]), which aligns with ffmpeg CLI's autorotate. Affine transforms that are not "pure 90-degree-multiple rotations" (mirroring, arbitrary angles) are reported directly as unsupported, so the caller falls back to ffmpeg. Guessing the wrong direction is worse than not decoding at all.

/// The output pixel format after rotation: 32BGRA. BGRA was chosen over RGBA because it is one of VideoToolbox's native output formats, so no extra conversion is needed. The byte-order conversion is just swapping R and B per pixel.
const OUTPUT_PIXEL_FORMAT: u32 = kCVPixelFormatType_32BGRA;

/// `size` is the desired delivery size (display orientation, after rotation). If given, the decode pipeline is asked to deliver this size directly (see [`start_reader`]).
pub(crate) fn open_frame_source(
    path: &Path,
    from_seconds: f64,
    size: Option<(u32, u32)>,
) -> Result<Box<dyn FrameSource>> {
    if !path.is_file() {
        bail!("media file does not exist: {}", path.display());
    }
    objc2::rc::autoreleasepool(|_| unsafe { open_inner(path, from_seconds, size) })
}

unsafe fn open_inner(
    path: &Path,
    from_seconds: f64,
    size: Option<(u32, u32)>,
) -> Result<Box<dyn FrameSource>> {
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    let asset = unsafe { AVURLAsset::URLAssetWithURL_options(&url, None) };
    let media_type = unsafe { AVMediaTypeVideo }.context("AVMediaTypeVideo is not linked")?;
    let tracks = unsafe { asset.tracksWithMediaType(media_type) };
    let track = tracks
        .firstObject()
        .context("unsupported: source media has no video track")?;

    let natural = unsafe { track.naturalSize() };
    let rotation = rotation_quadrant(unsafe { track.preferredTransform() })?;
    // Per-frame presentation duration. The `CMSampleBuffer`s handed out by `AVAssetReaderTrackOutput` **do not carry a valid duration**. `CMSampleBufferGetDuration` returns kCMTimeInvalid, and converting it to seconds gives NaN. So the duration can only come from track properties. `minFrameDuration` is the frame length for CFR material. If it is unavailable, fall back to the reciprocal of `nominalFrameRate`. Without it, `FrameStream` cannot detect the tail, and the output frame count would be one or two frames fewer than ffmpeg `-r`.
    let track_frame_duration = unsafe { track.minFrameDuration().seconds() }
        .filter_positive()
        .or_else(|| {
            let rate = f64::from(unsafe { track.nominalFrameRate() });
            (rate > 0.0).then(|| 1.0 / rate)
        });
    let (coded_width, coded_height) = (
        natural.width.round().max(0.0) as u32,
        natural.height.round().max(0.0) as u32,
    );
    if coded_width == 0 || coded_height == 0 {
        bail!("unsupported: source media has no valid video size");
    }
    let (width, height) = match size {
        Some(size) => size,
        None if matches!(rotation, 90 | 270) => (coded_height, coded_width),
        None => (coded_width, coded_height),
    };
    // The decoder's delivery size is the encoded orientation, before rotation. For 90/270-degree material, width and height are swapped (v2 `EncodeTarget::decoded_size`). If it equals the source size, nothing is requested, so the decoder does not take an extra scaling pass.
    let delivery = size
        .map(|(w, h)| {
            if matches!(rotation, 90 | 270) {
                (h, w)
            } else {
                (w, h)
            }
        })
        .filter(|delivery| *delivery != (coded_width, coded_height));

    let (reader, output) = unsafe { start_reader(&asset, &track, from_seconds, delivery)? };
    Ok(Box::new(AssetReaderFrames {
        asset,
        track,
        reader,
        output,
        width,
        height,
        coded_width,
        coded_height,
        delivery,
        rotation,
        track_frame_duration,
        finished: false,
        keyframes: None,
        keyframes_disabled: false,
    }))
}

/// `CFStringRef` keys such as `kCVPixelBuffer…Key` are toll-free bridged with `NSString *` (the established ABI on Apple platforms). So the pointer can be cast directly and used as a dictionary key.
fn cf_key(key: &CFString) -> &NSString {
    unsafe { &*ptr::from_ref(key).cast::<NSString>() }
}

/// The pixel output settings for the sequential stream: 32BGRA. If `delivery` (the width and height in encoded orientation) is given, the width and height are included too, so the decode pipeline delivers that size directly.
///
/// Ported from v2 `native_video.rs`'s `reader_pixel_settings`. For video export, each frame needs the size as it appears in the picture. For 4K material, the decoder scales down to 1080p, which saves a full 4K BGRA transfer and a CPU resample. If no width and height are given, the source size is delivered as-is, which is what `ccut-render`'s frame stream needs. `kCVPixelBuffer…Key` is a `CFStringRef`, toll-free bridged with `NSString *`, so the pointer is cast directly ([`cf_key`]).
unsafe fn reader_pixel_settings(
    delivery: Option<(u32, u32)>,
) -> Retained<NSDictionary<NSString, AnyObject>> {
    let format = NSNumber::new_u32(OUTPUT_PIXEL_FORMAT);
    let Some((width, height)) = delivery else {
        return NSDictionary::from_slices(
            &[cf_key(unsafe { kCVPixelBufferPixelFormatTypeKey })],
            &[format.as_ref() as &AnyObject],
        );
    };
    let width = NSNumber::new_u32(width);
    let height = NSNumber::new_u32(height);
    NSDictionary::from_slices(
        &[
            cf_key(unsafe { kCVPixelBufferPixelFormatTypeKey }),
            cf_key(unsafe { kCVPixelBufferWidthKey }),
            cf_key(unsafe { kCVPixelBufferHeightKey }),
        ],
        &[
            format.as_ref() as &AnyObject,
            width.as_ref() as &AnyObject,
            height.as_ref() as &AnyObject,
        ],
    )
}

/// Builds a reader that starts from `from_seconds` on an already-parsed `asset` / `track`.
///
/// It is split out for [`AssetReaderFrames::reopen`]. Random-access jumps only swap the reader, without re-parsing the container or re-finding the track. Those two steps are the most expensive part of a full reopen.
unsafe fn start_reader(
    asset: &AVURLAsset,
    track: &AVAssetTrack,
    from_seconds: f64,
    delivery: Option<(u32, u32)>,
) -> Result<(Retained<AVAssetReader>, Retained<AVAssetReaderTrackOutput>)> {
    let reader = unsafe { AVAssetReader::assetReaderWithAsset_error(asset) }
        .map_err(|error| anyhow!("unsupported: failed to create AVAssetReader ({error})"))?;
    let settings = unsafe { reader_pixel_settings(delivery) };
    let output = unsafe {
        AVAssetReaderTrackOutput::assetReaderTrackOutputWithTrack_outputSettings(
            track,
            Some(&settings),
        )
    };
    // The pixels are copied into our own `Vec` before the next `copyNextSampleBuffer`, so AVFoundation does not need to make another copy.
    unsafe { output.setAlwaysCopiesSampleData(false) };
    if !unsafe { reader.canAddOutput(&output) } {
        bail!("unsupported: AVAssetReader does not accept 32BGRA output for this video track (delivery size {delivery:?})");
    }
    unsafe { reader.addOutput(&output) };
    if from_seconds > 0.0 {
        // Read from the start point all the way to the end of the clip. AVAssetReader hands out samples that **intersect the range**, so the frame that covers the start point is included too. That is exactly the semantics of ffmpeg `-ss`.
        unsafe {
            reader.setTimeRange(CMTimeRange {
                start: CMTime::with_seconds(from_seconds, TIMESCALE),
                duration: kCMTimePositiveInfinity,
            })
        };
    }
    if !unsafe { reader.startReading() } {
        let detail = unsafe { reader.error() }
            .map(|error| error.to_string())
            .unwrap_or_else(|| "unknown error".to_owned());
        bail!("unsupported: AVAssetReader cannot read this source ({detail})");
    }
    Ok((reader, output))
}

/// For `Option<f64>`, "keep only finite positive values". `CMTimeGetSeconds` uses NaN for invalid times. A single extension is clearer than writing `is_finite() && > 0.0` in four places.
trait FilterPositive {
    fn filter_positive(self) -> Option<f64>;
    fn filter_finite(self) -> Option<f64>;
}

impl FilterPositive for f64 {
    fn filter_positive(self) -> Option<f64> {
        (self.is_finite() && self > 0.0).then_some(self)
    }
    fn filter_finite(self) -> Option<f64> {
        self.is_finite().then_some(self)
    }
}

/// `preferredTransform` → clockwise rotation quadrant (0 / 90 / 180 / 270).
///
/// Only pure rotations are accepted. The matrix `[a b; c d]` must have exactly two entries that are ±1 and two entries that are 0, with determinant +1 (a mirror has determinant −1). The angle is `atan2(b, a)`. The `preferredTransform` of portrait phone footage is `[0 1; -1 0]`, which gives 90. That is exactly the angle ffmpeg autorotate turns clockwise.
fn rotation_quadrant(transform: CGAffineTransform) -> Result<u16> {
    const TOLERANCE: f64 = 1e-3;
    let CGAffineTransform { a, b, c, d, .. } = transform;
    let determinant = a * d - b * c;
    let pure_rotation = (determinant - 1.0).abs() < TOLERANCE
        && (a - d).abs() < TOLERANCE
        && (b + c).abs() < TOLERANCE
        && (a * a + b * b - 1.0).abs() < TOLERANCE;
    if !pure_rotation {
        bail!("unsupported: the video track's preferredTransform is not a pure rotation in multiples of 90 degrees");
    }
    let degrees = b.atan2(a).to_degrees();
    let quadrant = (degrees / 90.0).round().rem_euclid(4.0) as u16 * 90;
    if (degrees - f64::from(quadrant))
        .abs()
        .min((degrees + 360.0 - f64::from(quadrant)).abs())
        > 1.0
    {
        bail!("unsupported: the video track's rotation angle {degrees:.2}° is not a multiple of 90 degrees");
    }
    Ok(quadrant)
}

struct AssetReaderFrames {
    /// The new reader from `reopen` and the sample generator of the keyframe decoder are both attached to the same asset.
    asset: Retained<AVURLAsset>,
    /// The video track. `reopen` builds a new output on it, and `sync_sample_at_or_before` uses its sample cursor to find keyframes.
    track: Retained<AVAssetTrack>,
    reader: Retained<AVAssetReader>,
    output: Retained<AVAssetReaderTrackOutput>,
    width: u32,
    height: u32,
    /// The encoded size **before** rotation. The keyframe decoder must constrain its output pixel buffers to this size, so that they match the frames delivered by `AVAssetReaderTrackOutput` (the clean aperture has already been cropped).
    coded_width: u32,
    coded_height: u32,
    /// The delivery size requested from the decoder (encoded orientation). `None` = the source size as-is. `reopen` reuses it.
    delivery: Option<(u32, u32)>,
    rotation: u16,
    /// The track-level frame duration in seconds. Used when a sample's own duration is invalid.
    track_frame_duration: Option<f64>,
    finished: bool,
    /// The resident keyframe decoder used during scrubbing. It is created the first time it is needed.
    keyframes: Option<KeyframeDecoder>,
    /// Once the keyframe decoder has failed, it permanently yields to "reopen + decode one frame" and does not retry.
    keyframes_disabled: bool,
}

/// The keyframe decoder used during scrubbing. `AVSampleBufferGenerator` takes the **compressed** samples of keyframes straight out of the container, and hands them to a resident `VTDecompressionSession` to decode.
///
/// `AVAssetReader` has to rebuild the decode session on every reopen. On 1080p H.264, the first frame pays a cold start of about 50 ms (each frame after that takes 2 ms). Dragging the playhead across a GOP boundary incurs this cost. When the timeline is zoomed out, every move crosses GOPs, which pins scrubbing at 12–15 fps. A resident session is rebuilt only when the format description changes. The keyframes themselves are fully sync samples, so one `DecodeFrame` produces the picture.
struct KeyframeDecoder {
    generator: Retained<AVSampleBufferGenerator>,
    /// The current session and the format description it accepts. It is rebuilt when a sample's format changes and the session cannot take it.
    session: Option<(
        CFRetained<VTDecompressionSession>,
        CFRetained<CMFormatDescription>,
    )>,
    /// Target pixel buffer attributes: 32BGRA, and the encoded size (so VT crops the clean aperture itself).
    destination: Retained<NSDictionary<NSString, AnyObject>>,
}

impl KeyframeDecoder {
    unsafe fn new(asset: &AVURLAsset, coded_width: u32, coded_height: u32) -> Self {
        // timebase is nil: the default immediate mode is requested, and sample data is loaded synchronously.
        let generator = unsafe {
            AVSampleBufferGenerator::initWithAsset_timebase(
                AVSampleBufferGenerator::alloc(),
                asset,
                None,
            )
        };
        let format = NSNumber::new_u32(OUTPUT_PIXEL_FORMAT);
        let width = NSNumber::new_u32(coded_width);
        let height = NSNumber::new_u32(coded_height);
        let destination = NSDictionary::from_slices(
            &[
                cf_key(unsafe { kCVPixelBufferPixelFormatTypeKey }),
                cf_key(unsafe { kCVPixelBufferWidthKey }),
                cf_key(unsafe { kCVPixelBufferHeightKey }),
            ],
            &[
                format.as_ref() as &AnyObject,
                width.as_ref() as &AnyObject,
                height.as_ref() as &AnyObject,
            ],
        );
        Self {
            generator,
            session: None,
            destination,
        }
    }

    /// A session that can decode `format`: reuse the one in hand if it works, otherwise invalidate it and rebuild.
    unsafe fn session_for(
        &mut self,
        format: &CMFormatDescription,
    ) -> Result<&VTDecompressionSession> {
        let reusable = match &self.session {
            Some((session, current)) => {
                ptr::eq(&**current, format)
                    || unsafe { session.can_accept_format_description(format) }
            }
            None => false,
        };
        if !reusable {
            if let Some((session, _)) = self.session.take() {
                unsafe { session.invalidate() };
            }
            let attributes: &CFDictionary =
                unsafe { &*ptr::from_ref(&*self.destination).cast::<CFDictionary>() };
            let mut raw: *mut VTDecompressionSession = ptr::null_mut();
            // No session-level callback is attached. Frame decoding uses `…WithOutputHandler`, and the callback is supplied with each call.
            let status = unsafe {
                VTDecompressionSession::create(
                    None,
                    format,
                    None,
                    Some(attributes),
                    ptr::null(),
                    NonNull::from(&mut raw),
                )
            };
            let session = NonNull::new(raw).filter(|_| status == 0).with_context(|| {
                format!("unsupported: failed to create VTDecompressionSession (OSStatus {status})")
            })?;
            self.session = Some((unsafe { CFRetained::from_raw(session) }, unsafe {
                CFRetained::retain(NonNull::from(format))
            }));
        }
        Ok(&self.session.as_ref().expect("just inserted").0)
    }
}

impl Drop for KeyframeDecoder {
    fn drop(&mut self) {
        if let Some((session, _)) = self.session.take() {
            unsafe { session.invalidate() };
        }
    }
}

/// The cursor is placed on "the last sample whose presentation time ≤ t", then walks back in decode order to the first fully sync sample. That is the frame the decoder must start from to produce the picture at t.
unsafe fn sync_cursor_at_or_before(
    track: &AVAssetTrack,
    time_seconds: f64,
) -> Option<Retained<AVSampleCursor>> {
    if !unsafe { track.canProvideSampleCursors() } {
        return None;
    }
    let cursor = unsafe {
        track.makeSampleCursorWithPresentationTimeStamp(CMTime::with_seconds(
            time_seconds,
            TIMESCALE,
        ))
    }?;
    let mut steps = 0_u32;
    while !unsafe { cursor.currentSampleSyncInfo() }
        .sampleIsFullSync
        .as_bool()
    {
        if steps >= SYNC_SEARCH_LIMIT || unsafe { cursor.stepInDecodeOrderByCount(-1) } == 0 {
            return None;
        }
        steps += 1;
    }
    Some(cursor)
}

/// The three outcomes of one `copyNextSampleBuffer`. An enum is used instead of `Option` plus a sentinel error, because "a sample with no pixels" and "end of stream" must be kept apart. The former means keep reading. Only the latter triggers a status check.
enum ReadStep {
    Frame(DecodedFrame),
    Skip,
    End,
}

impl AssetReaderFrames {
    /// If it is discarded before being fully read, cancel it explicitly, so the decoder does not read the rest of the source before finishing.
    fn cancel(&mut self) {
        if !self.finished {
            unsafe { self.reader.cancelReading() };
            self.finished = true;
        }
    }

    /// The resident decoder decodes the nearest keyframe at or before `time_seconds`. `Ok(None)` only occurs when the track cannot provide a sample cursor. All other failures are `Err`.
    unsafe fn decode_keyframe(&mut self, time_seconds: f64) -> Result<Option<(f64, RgbaFrame)>> {
        let Some(cursor) = (unsafe { sync_cursor_at_or_before(&self.track, time_seconds) }) else {
            return Ok(None);
        };
        let Some(pts) = (unsafe { cursor.presentationTimeStamp().seconds() }).filter_finite()
        else {
            return Ok(None);
        };
        let decoder = match self.keyframes.as_mut() {
            Some(decoder) => decoder,
            None => self.keyframes.insert(unsafe {
                KeyframeDecoder::new(&self.asset, self.coded_width, self.coded_height)
            }),
        };
        let request = unsafe {
            AVSampleBufferRequest::initWithStartCursor(AVSampleBufferRequest::alloc(), &cursor)
        };
        unsafe {
            request.setPreferredMinSampleCount(1);
            request.setMaxSampleCount(1);
        }
        let sample = unsafe {
            decoder
                .generator
                .createSampleBufferForRequest_error(&request)
        }
        .map_err(|error| anyhow!("unsupported: failed to fetch keyframe sample ({error})"))?;
        if !unsafe { sample.data_is_ready() } {
            let status = unsafe { sample.make_data_ready() };
            if status != 0 {
                bail!("unsupported: failed to load keyframe sample data (OSStatus {status})");
            }
        }
        let format = unsafe { sample.format_description() }
            .context("unsupported: keyframe sample has no format description")?;
        let session = unsafe { decoder.session_for(&format)? };
        // Synchronous decoding (no async flag): the callback finishes before `DecodeFrame` returns, so the frame is in the slot.
        let slot: Arc<Mutex<Option<Result<RgbaFrame>>>> = Arc::new(Mutex::new(None));
        let sink = Arc::clone(&slot);
        let rotation = self.rotation;
        let handler = RcBlock::new(
            move |status: i32,
                  _info: VTDecodeInfoFlags,
                  image: *mut CVImageBuffer,
                  _: CMTime,
                  _: CMTime| {
                let decoded = if status != 0 {
                    Err(anyhow!("VideoToolbox failed to decode keyframe (OSStatus {status})"))
                } else if image.is_null() {
                    Err(anyhow!("VideoToolbox returned no pixels"))
                } else {
                    unsafe { pixel_buffer_to_rgba(&*image, rotation) }
                };
                if let Ok(mut guard) = sink.lock() {
                    *guard = Some(decoded);
                }
            },
        );
        let mut info = VTDecodeInfoFlags::empty();
        let status = unsafe {
            session.decode_frame_with_output_handler(
                &sample,
                VTDecodeFrameFlags::empty(),
                &mut info,
                ptr::from_ref(&*handler).cast_mut(),
            )
        };
        if status != 0 {
            bail!("unsupported: VTDecompressionSessionDecodeFrame failed (OSStatus {status})");
        }
        // The decoder may deliver frames asynchronously. Wait until it has called back for all in-flight frames before checking the slot.
        unsafe { session.wait_for_asynchronous_frames() };
        let frame = slot
            .lock()
            .map_err(|_| anyhow!("keyframe slot was poisoned"))?
            .take()
            .context("VideoToolbox returned no callback")??;
        if (frame.width, frame.height) != (self.width, self.height) {
            bail!(
                "unsupported: keyframe decode size {}x{} does not match the sequential stream {}x{}",
                frame.width,
                frame.height,
                self.width,
                self.height
            );
        }
        Ok(Some((pts, frame)))
    }
}

impl Drop for AssetReaderFrames {
    fn drop(&mut self) {
        self.cancel();
    }
}

/// The maximum number of samples to walk when searching forward in decode order for a keyframe. H.264/HEVC GOPs are usually a few dozen to a few hundred frames. This limit only guards against pathological sources (no sync samples at all) walking the cursor back to the start of the file.
const SYNC_SEARCH_LIMIT: u32 = 4096;

impl FrameSource for AssetReaderFrames {
    fn size(&self) -> (u32, u32) {
        (self.width, self.height)
    }

    fn reopen(&mut self, from_seconds: f64) -> Result<()> {
        self.cancel();
        let (reader, output) = objc2::rc::autoreleasepool(|_| unsafe {
            start_reader(&self.asset, &self.track, from_seconds, self.delivery)
        })?;
        self.reader = reader;
        self.output = output;
        self.finished = false;
        Ok(())
    }

    fn sync_sample_at_or_before(&self, time_seconds: f64) -> Result<Option<f64>> {
        objc2::rc::autoreleasepool(|_| unsafe {
            Ok(sync_cursor_at_or_before(&self.track, time_seconds)
                .and_then(|cursor| cursor.presentationTimeStamp().seconds().filter_finite()))
        })
    }

    fn keyframe_at_or_before(&mut self, time_seconds: f64) -> Result<Option<(f64, RgbaFrame)>> {
        if self.keyframes_disabled {
            return Ok(None);
        }
        let decoded = objc2::rc::autoreleasepool(|_| unsafe { self.decode_keyframe(time_seconds) });
        match decoded {
            Ok(found) => Ok(found),
            // The resident decoder cannot handle this source (a codec VT does not accept, a size mismatch, ...). Yield to "reopen + decode one frame", which has the same semantics but is slower. Do not propagate the error upward, or the caller would demote the whole source to ffmpeg.
            Err(_) => {
                self.keyframes_disabled = true;
                self.keyframes = None;
                Ok(None)
            }
        }
    }

    fn next_decoded_into(&mut self, data: &mut Vec<u8>) -> Result<Option<DecodedInto>> {
        if self.finished {
            return Ok(None);
        }
        loop {
            // One autorelease pool per frame (same as `next_decoded`).
            let step = objc2::rc::autoreleasepool(|_| -> Result<Option<Option<DecodedInto>>> {
                let Some(sample) = (unsafe { self.output.copyNextSampleBuffer() }) else {
                    return Ok(None);
                };
                let pts_seconds =
                    unsafe { CMSampleBufferGetPresentationTimeStamp(&sample).seconds() };
                let duration_seconds = unsafe { CMSampleBufferGetDuration(&sample).seconds() }
                    .filter_positive()
                    .or(self.track_frame_duration);
                let Some(image) = (unsafe { CMSampleBufferGetImageBuffer(&sample) }) else {
                    return Ok(Some(None));
                };
                let (width, height) = if self.rotation == 0 {
                    // Material that does not rotate (the vast majority) is swapped straight from the pixel buffer into the caller's buffer, with no allocation and no extra copy.
                    unsafe { pixel_buffer_into_rgba(image.as_ref(), data)? }
                } else {
                    let frame = unsafe { pixel_buffer_to_rgba(image.as_ref(), self.rotation)? };
                    *data = frame.data;
                    (frame.width, frame.height)
                };
                Ok(Some(Some(DecodedInto {
                    pts_seconds,
                    duration_seconds,
                    width,
                    height,
                })))
            })?;
            match step {
                Some(Some(frame)) => return Ok(Some(frame)),
                Some(None) => continue,
                None => {
                    self.finished = true;
                    if unsafe { self.reader.status() } != AVAssetReaderStatus::Completed {
                        let detail = unsafe { self.reader.error() }
                            .map(|error| error.to_string())
                            .unwrap_or_else(|| "unknown error".to_owned());
                        bail!("AVAssetReader decoding was interrupted ({detail})");
                    }
                    return Ok(None);
                }
            }
        }
    }

    fn next_decoded(&mut self) -> Result<Option<DecodedFrame>> {
        if self.finished {
            return Ok(None);
        }
        loop {
            // One autorelease pool per frame, so AVFoundation's internal temporary objects do not pile up until the thread exits.
            let step = objc2::rc::autoreleasepool(|_| -> Result<ReadStep> {
                let Some(sample) = (unsafe { self.output.copyNextSampleBuffer() }) else {
                    return Ok(ReadStep::End);
                };
                let pts_seconds =
                    unsafe { CMSampleBufferGetPresentationTimeStamp(&sample).seconds() };
                // `CMTimeGetSeconds` returns NaN for invalid or indefinite CMTime. Asset reader samples have been measured to be like this, so it falls back to the track-level frame duration.
                let duration_seconds = unsafe { CMSampleBufferGetDuration(&sample).seconds() }
                    .filter_positive()
                    .or(self.track_frame_duration);
                let Some(image) = (unsafe { CMSampleBufferGetImageBuffer(&sample) }) else {
                    // A sample with no pixels (a marker such as a format change): skip it. Do not treat it as EOF.
                    return Ok(ReadStep::Skip);
                };
                let frame = unsafe { pixel_buffer_to_rgba(image.as_ref(), self.rotation)? };
                Ok(ReadStep::Frame(DecodedFrame {
                    pts_seconds,
                    duration_seconds,
                    frame,
                }))
            })?;
            match step {
                ReadStep::Frame(frame) => return Ok(Some(frame)),
                ReadStep::Skip => continue,
                ReadStep::End => {
                    self.finished = true;
                    // Only check the status after reading is complete. Anything other than `Completed` is a real failure.
                    if unsafe { self.reader.status() } != AVAssetReaderStatus::Completed {
                        let detail = unsafe { self.reader.error() }
                            .map(|error| error.to_string())
                            .unwrap_or_else(|| "unknown error".to_owned());
                        bail!("AVAssetReader decoding was interrupted ({detail})");
                    }
                    return Ok(None);
                }
            }
        }
    }
}

/// `CVPixelBuffer` (32BGRA) → upright top-down RGBA8.
///
/// `bytesPerRow` usually includes alignment padding (16 or 64 bytes). It **must not** be treated as `width * 4`.
unsafe fn pixel_buffer_to_rgba(
    buffer: &objc2_core_video::CVPixelBuffer,
    rotation: u16,
) -> Result<RgbaFrame> {
    let flags = CVPixelBufferLockFlags::ReadOnly;
    if unsafe { CVPixelBufferLockBaseAddress(buffer, flags) } != 0 {
        bail!("failed to lock CVPixelBuffer");
    }
    let width = CVPixelBufferGetWidth(buffer);
    let height = CVPixelBufferGetHeight(buffer);
    let stride = CVPixelBufferGetBytesPerRow(buffer);
    let base = CVPixelBufferGetBaseAddress(buffer);
    let outcome = if base.is_null() || width == 0 || height == 0 || stride < width * 4 {
        Err(anyhow!("AVFoundation returned an incomplete 32BGRA video frame"))
    } else {
        let mut data = vec![0_u8; width * height * 4];
        for y in 0..height {
            let row =
                unsafe { std::slice::from_raw_parts(base.cast::<u8>().add(y * stride), width * 4) };
            let out = &mut data[y * width * 4..(y + 1) * width * 4];
            swizzle_bgra_to_rgba_row(row, out);
        }
        RgbaFrame::new(width as u32, height as u32, data)
    };
    // Unlock unconditionally, so it is not skipped by an early return from the errors above.
    let unlocked = unsafe { CVPixelBufferUnlockBaseAddress(buffer, flags) };
    let frame = outcome?;
    if unlocked != 0 {
        bail!("failed to unlock CVPixelBuffer");
    }
    Ok(scale::rotate_rgba(&frame, rotation))
}

/// `CVPixelBuffer` (32BGRA, no rotation needed) → tightly packed top-down RGBA8, written into `data` (its length is changed to one frame). Returns the width and height.
unsafe fn pixel_buffer_into_rgba(
    buffer: &objc2_core_video::CVPixelBuffer,
    data: &mut Vec<u8>,
) -> Result<(u32, u32)> {
    let flags = CVPixelBufferLockFlags::ReadOnly;
    if unsafe { CVPixelBufferLockBaseAddress(buffer, flags) } != 0 {
        bail!("failed to lock CVPixelBuffer");
    }
    let width = CVPixelBufferGetWidth(buffer);
    let height = CVPixelBufferGetHeight(buffer);
    let stride = CVPixelBufferGetBytesPerRow(buffer);
    let base = CVPixelBufferGetBaseAddress(buffer);
    let outcome = if base.is_null() || width == 0 || height == 0 || stride < width * 4 {
        Err(anyhow!("AVFoundation returned an incomplete 32BGRA video frame"))
    } else {
        let row = width * 4;
        data.resize(row * height, 0);
        for (y, out) in data.chunks_exact_mut(row).enumerate() {
            let source =
                unsafe { std::slice::from_raw_parts(base.cast::<u8>().add(y * stride), row) };
            swizzle_bgra_to_rgba_row(source, out);
        }
        Ok((width as u32, height as u32))
    };
    // Unlock unconditionally, so it is not skipped by an early return from the errors above.
    let unlocked = unsafe { CVPixelBufferUnlockBaseAddress(buffer, flags) };
    let size = outcome?;
    if unlocked != 0 {
        bail!("failed to unlock CVPixelBuffer");
    }
    Ok(size)
}

/// One row of 32BGRA → RGBA (alpha forced to 255).
///
/// Memory order B,G,R,A → R,G,B,A. Video frames are opaque, so alpha is uniformly forced to 255. The platform may leave it as undefined bytes, and if they leaked through, compositing would turn the frame black. The conversion works on whole `u32` pixels, not byte by byte. A 1080p frame has 2 million pixels, and a per-byte loop in a debug build takes over 15 ms. That is the second-largest overhead on the preview frame-fetch path, after decoding. Whole-word conversion lets the compiler vectorize it directly.
fn swizzle_bgra_to_rgba_row(source: &[u8], target: &mut [u8]) {
    debug_assert_eq!(source.len(), target.len());
    for (bgra, rgba) in source.chunks_exact(4).zip(target.chunks_exact_mut(4)) {
        let px = u32::from_le_bytes([bgra[0], bgra[1], bgra[2], bgra[3]]);
        let out = ((px >> 16) & 0xFF) | (px & 0xFF00) | ((px & 0xFF) << 16) | 0xFF00_0000;
        rgba.copy_from_slice(&out.to_le_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Whole-word conversion is byte-for-byte identical to swapping byte by byte (including forcing alpha to 255).
    #[test]
    fn swizzle_matches_byte_wise_swap() {
        let source: Vec<u8> = (0..64_u8).map(|i| i.wrapping_mul(37)).collect();
        let mut expected = vec![0_u8; source.len()];
        for (s, t) in source.chunks_exact(4).zip(expected.chunks_exact_mut(4)) {
            t[0] = s[2];
            t[1] = s[1];
            t[2] = s[0];
            t[3] = 255;
        }
        let mut actual = vec![0_u8; source.len()];
        swizzle_bgra_to_rgba_row(&source, &mut actual);
        assert_eq!(actual, expected);
    }

    /// The `preferredTransform` of the four quadrants uses the same basis as ffmpeg autorotate. Mirroring and arbitrary angles are reported as unsupported, so the caller falls back to ffmpeg instead of guessing a direction to rotate by.
    #[test]
    fn preferred_transforms_map_to_clockwise_quadrants() {
        let make = |a, b, c, d| CGAffineTransform {
            a,
            b,
            c,
            d,
            tx: 0.0,
            ty: 0.0,
        };
        assert_eq!(rotation_quadrant(make(1.0, 0.0, 0.0, 1.0)).unwrap(), 0);
        assert_eq!(rotation_quadrant(make(0.0, 1.0, -1.0, 0.0)).unwrap(), 90);
        assert_eq!(rotation_quadrant(make(-1.0, 0.0, 0.0, -1.0)).unwrap(), 180);
        assert_eq!(rotation_quadrant(make(0.0, -1.0, 1.0, 0.0)).unwrap(), 270);
        // Horizontal mirroring (determinant −1) and 45 degrees: neither is accepted.
        assert!(rotation_quadrant(make(-1.0, 0.0, 0.0, 1.0)).is_err());
        let half = std::f64::consts::FRAC_1_SQRT_2;
        assert!(rotation_quadrant(make(half, half, -half, half)).is_err());
    }
}
