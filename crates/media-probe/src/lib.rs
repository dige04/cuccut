/*!
 * ccut-media-probe — the unified media probe for the whole repo.
 *
 * One-line responsibility: **answer “what is this file, how long is it, how big, what frame rate, does it have alpha”**. The main path is pure Rust; `ffprobe` is only an optional fallback for containers it cannot parse.
 *
 * ## Why a separate crate
 *
 * Before the migration, the repo had 9 different `ffprobe` subprocess implementations (render asset loading, speech duration, studio init, timeline fps, `ccut source probe`, serve's filmstrip, pre-export audio track checks, App v2 asset import...). Each differed slightly in arguments, parsing and error-tolerance semantics, and **all of them treated ffprobe as a hard prerequisite**. ffmpeg/ffprobe is being demoted from a default dependency to an optional enhancement, so probing must work before it is available.
 *
 * ## Backends
 *
 * | Container | Backend | Provides |
 * | --- | --- | --- |
 * | MP4 / MOV / M4A (ISO-BMFF) | [`re_mp4`] | duration, coded size, fps, codec, audio tracks |
 * | MKV / WebM (EBML) | [`matroska_demuxer`] | duration, size, fps, codec, **alpha** |
 * | WAV / MP3 / FLAC / OGG / OPUS / CAF… | [`symphonia`] | duration, codec, sample rate, channels |
 * | PNG / JPEG / GIF / WebP / BMP / TIFF | [`image`] (header only) | size |
 * | Others (AVI / TS / FLV / HEIC…) | none; handed to [`probe_with_fallback`] | — |
 *
 * ## Binary discovery is not this crate's job
 *
 * The `ffprobe` path for [`probe_with_fallback`] is **passed in by the caller**: the whole repo goes through `ccut_exec::find_executable("ffprobe")` (the unified search directory table of the core workspace, consolidated in WP3, see `core/crates/ccut-exec`), and passes `None` if it is not found. This crate never searches PATH itself, since that would make “which ffprobe to use” a second set of rules.
 *
 * ## Rotation and two sizes
 *
 * [`VideoInfo::width`] / [`VideoInfo::height`] keep the existing `naturalW/naturalH` convention: **coded size, without rotation** (see `docs/design/cli/ccut-cli-server-reference.md`). Decoders rotate pixels upright by default according to the container's rotation metadata, so [`VideoInfo::display_width`] / [`VideoInfo::display_height`] are also exposed for the frame buffer and render geometry. The new fields are additive and do not change any existing `naturalW/naturalH` output.
 *
 * ## Audio edit list
 *
 * [`audio_edit_start`] answers another “what is this file” question: the `elst` of an MP4 / M4A / MOV audio track says how many encoder-priming frames to drop after decoding. Symphonia does not apply edit lists, so the repo's three Symphonia decode loops (render mixing; speech / beat / separation; waveform) all rely on it to align with ffmpeg.
 */

use std::path::Path;

use anyhow::{Result, anyhow, bail};

mod edit_list;
mod ffprobe;
mod native;

pub use edit_list::{EditStart, audio_edit_start};
pub use ffprobe::probe_with_ffprobe;

/// Coarse media classification. Uses the same convention as the `kind` field of `ccut source probe`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaKind {
    Video,
    Audio,
    Image,
}

impl MediaKind {
    /// Lowercase name used for `ccut source probe` / timeline `source.kind`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Video => "video",
            Self::Audio => "audio",
            Self::Image => "image",
        }
    }
}

/// Visual track info. Static images also go through here (the size is the image's own pixel size).
#[derive(Debug, Clone, PartialEq)]
pub struct VideoInfo {
    /// Coded size, **without rotation** (same convention as the pre-migration ffprobe `stream=width,height`).
    pub width: u32,
    pub height: u32,
    /// Output pixel size after the decoder applies the container's rotation metadata.
    ///
    /// Same as `width` / `height` when there is no rotation; the two are swapped at 90° / 270°.
    /// These two fields only serve frame buffer geometry and do not replace `naturalW/naturalH`.
    pub display_width: u32,
    pub display_height: u32,
    /// Source frame rate; `None` = the container does not report it.
    ///
    /// Not **guaranteed to match ffprobe's `r_frame_rate` / `avg_frame_rate` exactly as rationals**; only guaranteed to match within f64 tolerance, since all downstream consumers use f64.
    pub fps: Option<f64>,
    /// Average video-track bitrate in bit/s, excluding audio and container overhead.
    pub bitrate: Option<f64>,
    /// Lowercase short name in ffprobe `codec_name` convention (`h264` / `hevc` / `vp9` / `av1`…).
    pub codec: Option<String>,
    /// The container **marks** this track as carrying an alpha plane.
    ///
    /// In practice only Matroska/WebM sets it (`AlphaMode`, EBML 0x53C0), corresponding to the pre-migration ffprobe `stream_tags=alpha_mode`. This is the only criterion for whether an alpha WebM sticker can be decoded correctly (see `ccut_render::assets::probe_alpha_decoder`).
    pub alpha: bool,
}

impl VideoInfo {
    /// Decoded frame size after upright correction.
    pub fn display_dimensions(&self) -> (u32, u32) {
        (self.display_width, self.display_height)
    }
}

/// Coded size + quadrant rotation → decoded frame size after upright correction.
///
/// Containers can in theory store any angle, but decoder backends disagree on the output canvas convention for non-quadrant affine transforms; in that case the coded size is kept, and it is up to the specific decoder backend whether to support it.
pub(crate) fn display_dimensions_for_rotation(width: u32, height: u32, degrees: f64) -> (u32, u32) {
    if !degrees.is_finite() {
        return (width, height);
    }
    let normalized = degrees.rem_euclid(360.0);
    let quadrant = (normalized / 90.0).round();
    if (normalized - quadrant * 90.0).abs() > 1.0 {
        return (width, height);
    }
    if quadrant as i64 % 2 == 0 {
        (width, height)
    } else {
        (height, width)
    }
}

/// Audio track info. **Presence means the file has an audio track** (`has_audio` just checks whether this is `Some`).
#[derive(Debug, Clone, PartialEq)]
pub struct AudioInfo {
    /// Lowercase short name in ffprobe `codec_name` convention (`aac` / `mp3` / `flac` / `opus`…).
    pub codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
}

/// All output of one probe.
#[derive(Debug, Clone, PartialEq)]
pub struct MediaProbe {
    pub kind: MediaKind,
    /// Container duration in seconds. Always `None` for images; also `None` when the container does not record a duration.
    pub duration_seconds: Option<f64>,
    pub video: Option<VideoInfo>,
    pub audio: Option<AudioInfo>,
}

impl MediaProbe {
    /// Whether there is an audio track.
    pub fn has_audio(&self) -> bool {
        self.audio.is_some()
    }

    /// Coded size; `None` when there is no visual track.
    pub fn dimensions(&self) -> Option<(u32, u32)> {
        self.video.as_ref().map(|video| (video.width, video.height))
    }

    /// Decoded frame size after applying the container's rotation metadata; `None` when there is no visual track.
    pub fn display_dimensions(&self) -> Option<(u32, u32)> {
        self.video.as_ref().map(VideoInfo::display_dimensions)
    }

    /// Source frame rate; `None` if it cannot be probed.
    pub fn fps(&self) -> Option<f64> {
        self.video.as_ref().and_then(|video| video.fps)
    }

    /// Prefer the video track; file size / duration is a conservative fallback
    /// for containers without a track bitrate. No full-file decode is needed.
    pub fn video_bitrate(&self, path: &Path) -> Option<f64> {
        if self.kind != MediaKind::Video {
            return None;
        }
        self.video
            .as_ref()?
            .bitrate
            .filter(|rate| rate.is_finite() && *rate > 0.0)
            .or_else(|| {
                let duration = self.positive_duration()?;
                let bytes = std::fs::metadata(path).ok()?.len();
                let rate = bytes as f64 * 8.0 / duration;
                (rate.is_finite() && rate > 0.0).then_some(rate)
            })
    }

    /// A finite duration greater than 0, otherwise `None` (every pre-migration call site applied this filter).
    pub fn positive_duration(&self) -> Option<f64> {
        self.duration_seconds
            .filter(|value| value.is_finite() && *value > 0.0)
    }
}

/// The probe backend that actually produced the result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeBackend {
    /// Pure Rust.
    Native,
    /// The fallback `ffprobe` subprocess.
    Ffprobe,
}

impl ProbeBackend {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Native => "native",
            Self::Ffprobe => "ffprobe",
        }
    }
}

/// File extensions (lowercase) treated as static images.
///
/// Classification **looks only at the extension**, consistent with the pre-migration criterion of `ccut source probe` / App v2 asset import: in ffprobe's view, a PNG inside a container is also a “video stream”, so stream type cannot distinguish an “image” from a “single-frame video”.
pub const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif",
];

/// Whether the path's extension belongs to a static image.
pub fn is_image_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            IMAGE_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
        })
}

/// Pure Rust probe. Containers it cannot parse return `Err`; callers that need a fallback should use [`probe_with_fallback`].
pub fn probe(path: &Path) -> Result<MediaProbe> {
    native::probe_native(path)
}

/// Pure Rust first, `ffprobe` as fallback.
///
/// `ffprobe` is **an executable path supplied by the caller** (usually the result of `ccut_exec::find_executable("ffprobe")`); `None` = there is no ffprobe on this machine, in which case a pure Rust failure is the final failure.
pub fn probe_with_fallback(
    path: &Path,
    ffprobe: Option<&Path>,
) -> Result<(MediaProbe, ProbeBackend)> {
    let native_error = match native::probe_native(path) {
        Ok(probe) => return Ok((probe, ProbeBackend::Native)),
        Err(error) => error,
    };
    let Some(ffprobe) = ffprobe else {
        return Err(native_error.context(format!(
            "{} 无法纯 Rust 探测，且没有可用的 ffprobe 兜底",
            path.display()
        )));
    };
    match ffprobe::probe_with_ffprobe(path, ffprobe) {
        Ok(probe) => Ok((probe, ProbeBackend::Ffprobe)),
        Err(error) => Err(anyhow!(
            "{} 两条探测路径都失败：纯 Rust：{native_error:#}；ffprobe：{error:#}",
            path.display()
        )),
    }
}

/// Sniffs the container by reading the first few bytes of the file.
pub(crate) fn read_magic(path: &Path) -> Result<[u8; 16]> {
    use std::io::Read as _;

    let mut file = std::fs::File::open(path)
        .map_err(|error| anyhow!("打开 {} 失败：{error}", path.display()))?;
    let mut magic = [0_u8; 16];
    let mut filled = 0;
    while filled < magic.len() {
        match file.read(&mut magic[filled..]) {
            Ok(0) => break,
            Ok(count) => filled += count,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {}
            Err(error) => bail!("读取 {} 失败：{error}", path.display()),
        }
    }
    Ok(magic)
}
