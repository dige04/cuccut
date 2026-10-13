//! MP4 writing: the main native encoding path for BCF render export (WP6b).
//!
//! Symmetric with this crate's decoding side ([`crate::extract_frame_rgba`] / [`crate::open_frame_stream`]): **writes pixels out as MP4 without starting any ffmpeg child process**. Its usage matches the pre-migration `ccut-render::video::FfmpegWriter`: feed RGBA frame by frame, optionally one whole-piece mixed PCM track, and wrap up with [`Mp4Writer::finish`].
//!
//! | Platform | Backend | Video | Audio |
//! | --- | --- | --- | --- |
//! | macOS | AVFoundation | `AVAssetWriter` + `AVAssetWriterInputPixelBufferAdaptor` (BGRA pixel buffer pool → VideoToolbox H.264) | LPCM `CMSampleBuffer` → `AVAssetWriterInput` with AAC output settings |
//! | Windows | Media Foundation | `IMFSinkWriter` + H.264 MFT (NV12 input; odd canvases fall back to RGB32) | s16 PCM → AAC MFT |
//! | Others (Linux…) | None | [`encode_available`] is `false`, and `open_mp4_writer` returns `Err` directly | Same as left |
//!
//! **The caller must bring its own ffmpeg fallback** (the same rule as the decoding side): this module does not discover or start any external binary, and it does not promise to write every possible geometry. A native failure is simply a failure; whether to fall back is up to the caller (`ccut-render::video::VideoWriter`).
//!
//! ## Bitrate, not CRF
//!
//! The ffmpeg recipe before the migration was `libx264 -preset medium -crf 18`, which is **quality-oriented**: the bitrate grows out of the content's complexity by itself. The hardware encoders of VideoToolbox and Media Foundation
//! have no constant-quality mode like CRF and can only be given an average bitrate, so the quality target has to be translated into a bitrate curve that scales with resolution and frame rate ([`video_bitrate`]).
//!
//! ## Determinism boundary
//!
//! Per `docs/design/bcf/cuccut-format-spec.md` §15.1, **the bytes of an exported encode are not promised to be reproducible**: the same frame sequence goes through x264, VideoToolbox and Media Foundation and yields different bitstreams,
//! and the same machine may also produce different output after an OS update. Acceptance is judged on existence, frame count, duration tolerance, size, backend identifier,
//! semantic colour predicates and audio RMS; there are no pixel golden files. The compositing layer (`ccut-render`'s DrawOp
//! and FramePlan fingerprint) is still byte-for-byte deterministic; this module sits only downstream of it.

use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};

/// Fixed format of the mixed PCM, matching the output of `ccut-render::audio::mix_audio`:
/// 48 kHz, stereo, interleaved f32 (native byte order).
pub const AUDIO_SAMPLE_RATE: u32 = 48_000;
/// As above: the channel count.
pub const AUDIO_CHANNELS: u32 = 2;
/// Default output AAC bitrate, the same value as the `-b:a 192k` of the pre-migration ffmpeg path ([`AudioInput::bitrate`] can override it).
pub const AUDIO_BITRATE: u32 = 192_000;

/// Audio length handed over per step: 0.1 s. Small enough that the video track is not held back from ready for long while waiting on audio;
/// large enough that each frame needs only a single-digit number of system calls.
const AUDIO_CHUNK_FRAMES: usize = AUDIO_SAMPLE_RATE as usize / 10;

/// How far audio runs **ahead** of video (seconds). To keep interleaving, the MP4 writer holds back one track's ready flag when that track falls too far behind;
/// feeding audio a bit before the video time point means the video track does not stall because of this.
pub(crate) const AUDIO_LEAD_SECONDS: f64 = 2.0;

/// Whether the current platform has a native MP4 encoding implementation.
///
/// It uses the same system frameworks and the same set of platforms as the decoding side's [`crate::available`], but the meaning is
/// independent: the caller is asking "is it worth trying the native **write** path first?"
pub const fn encode_available() -> bool {
    cfg!(any(target_os = "macos", target_os = "windows"))
}

/// Identifier of the native encoding backend on the current platform (§15.1 “the backend must be observable”). The values match the decoding side's names:
/// both sides use the same system frameworks (`avfoundation` / `media-foundation`).
pub const fn encode_backend() -> &'static str {
    crate::backend()
}

/// Output bitrate (bit/s): a linear heuristic of resolution × frame rate.
///
/// The values follow the same curve as the timeline intermediate file in `apps/cli`
/// (the no-source-cap form of `services/timeline_media.rs::intermediate_video_bitrate`):
/// a 1080p30 baseline of 8 Mb/s, scaled linearly by pixel count and frame rate, then multiplied by a **quality-oriented margin** of 1.5,
/// finally clamped to 4–60 Mb/s.
///
/// The 1.5× margin is aimed at the pre-migration `-crf 18`, which is the “visually lossless” tier. A hardware encoder at the same
/// bitrate does not compress as well as x264, so without the margin it would show on high-detail material. The clamp is a safety net at both ends:
/// a tiny canvas is not pushed so low that it blocks, and 4K60 does not balloon into a file of several hundred megabytes.
///
/// There is **no source-bitrate cap** here (that exists only in the `apps/cli` export path): every frame of a BCF render is
/// synthesised, so there is no such thing as a “source bitrate”.
pub fn video_bitrate(width: u32, height: u32, fps: f64) -> u32 {
    let scaled = 8_000_000.0
        * (f64::from(width.max(1)) * f64::from(height.max(1)) / (1920.0 * 1080.0))
        * (fps.max(1.0) / 30.0)
        * 1.5;
    scaled.round().clamp(4_000_000.0, 60_000_000.0) as u32
}

/// Quality-oriented CRF → native average bitrate (bit/s): the [`video_bitrate`] curve scaled by `2^((18 − crf) / 6)`, clamped to
/// 1 b/s – 60 Mb/s.
///
/// Hardware encoders have no CRF, so the CRF can only be translated into a bitrate. The anchor is the curve's own basis: [`video_bitrate`] is aimed at the pre-migration `-crf 18`
/// (multiplier 1.0, the same value as `EncodeQuality::EXPORT` in `render-raster`). Experience with x264 is that each 6 steps of CRF roughly halves or doubles the bitrate, and this slope is extrapolated.
/// The preview proxy tier of `render-raster` (`crf 16` with a 2.5× multiplier) is a different margin and is not on this curve.
pub fn crf_bitrate(width: u32, height: u32, fps: f64, crf: u32) -> u32 {
    let base = f64::from(video_bitrate(width, height, fps));
    let scale = 2_f64.powf((18.0 - f64::from(crf)) / 6.0);
    (base * scale).round().clamp(1.0, 60_000_000.0) as u32
}

/// Standard frame-rate fractions for the NTSC family and the integer family. Timestamps at a constant frame rate must be expressed as fractions: a decimal approximation such as `29.97` would drift by more than a frame over 30 minutes.
const STANDARD_FRAME_RATES: &[(u32, u32)] = &[
    (24000, 1001),
    (30000, 1001),
    (48000, 1001),
    (60000, 1001),
    (120000, 1001),
];

/// Frame-rate snapping tolerance: 29.97 and 30 differ by only 0.1%, so the tolerance must be clearly smaller than that.
const FRAME_RATE_SNAP_TOLERANCE: f64 = 0.0005;

/// Rational number `(numerator, denominator)` used for the timestamps of a composited frame rate.
///
/// An integer frame rate uses `(fps, 1)` directly; NTSC-family rates (23.976 / 29.97 / 59.94…) snap to the exact
/// `k/1001`; anything else is rounded to a timebase of one-thousandth. The semantics match the pre-migration ffmpeg `-r {fps}`:
/// constant output frame rate, and the presentation time of frame `i` is `i × denominator / numerator`.
pub fn frame_rate_rational(fps: f64) -> (u32, u32) {
    if !fps.is_finite() || fps <= 0.0 {
        return (30, 1);
    }
    if (fps - fps.round()).abs() <= f64::EPSILON * fps.max(1.0)
        && fps.round() <= f64::from(u32::MAX)
    {
        return (fps.round() as u32, 1);
    }
    if let Some(standard) = STANDARD_FRAME_RATES.iter().copied().find(|(num, den)| {
        let standard = f64::from(*num) / f64::from(*den);
        (fps - standard).abs() <= standard * FRAME_RATE_SNAP_TOLERANCE
    }) {
        return standard;
    }
    (((fps * 1000.0).round() as u32).max(1), 1000)
}

/// How to open a platform writer: geometry, constant frame rate (rational), video bitrate, and an optional audio track.
pub(crate) struct WriterSetup {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps_num: u32,
    pub(crate) fps_den: u32,
    /// Average video bitrate (bit/s).
    pub(crate) bitrate: u32,
    pub(crate) audio: Option<PcmSource>,
    /// AAC bitrate (bit/s).
    pub(crate) audio_bitrate: u32,
}

/// Platform MP4 writer. Both platform implementations are used the same way: feed frames in order, then wrap up.
pub(crate) trait Mp4Sink {
    fn write_frame(&mut self, rgba: &[u8]) -> Result<()>;
    fn finish(self: Box<Self>) -> Result<()>;
}

/// Handle to a native MP4 writer.
///
/// Its lifetime matches the pre-migration `FfmpegWriter`: `open_mp4_writer` → any number of
/// [`write_frame`](Self::write_frame) calls → [`finish`](Self::finish). Dropping midway makes the platform writer cancel, and the output file is either cleaned up or left half-written, per platform convention. The caller was rendering to a temporary file anyway, and does not rely on this.
pub struct Mp4Writer {
    sink: Box<dyn Mp4Sink>,
}

impl Mp4Writer {
    /// Append one frame: top-down RGBA8, tightly packed (stride = `width * 4`).
    ///
    /// The byte count must be exactly `width * height * 4`. The frame's presentation time is determined by **call order**
    /// (the i-th call is frame i), matching the constant-frame-rate semantics of ffmpeg `-r`.
    pub fn write_frame(&mut self, rgba: &[u8]) -> Result<()> {
        self.sink.write_frame(rgba)
    }

    /// Wrap up: feed the remaining audio, wrap up the tracks, and wait for the container to be finished.
    pub fn finish(self) -> Result<()> {
        self.sink.finish()
    }

    /// The encoding backend actually in use (§15.1 observability clause).
    pub fn backend(&self) -> &'static str {
        encode_backend()
    }
}

/// Open a native MP4 writer.
///
/// - `width` / `height`: output canvas; must be positive even numbers (H.264 4:2:0 chroma requirement;
///   an odd canvas is reported as `unsupported`, so the caller falls back to ffmpeg, matching the pre-migration behaviour).
/// - `fps`: composited frame rate, which determines the constant-frame-rate grid.
/// - `audio_pcm`: path to the whole-piece mixed **raw f32le 48 kHz stereo** PCM file (the same one
///   that `ccut-render::audio::mix_audio` writes out); `None` = no audio track.
///
/// The relation between audio and video length follows ffmpeg's `-shortest`: audio is written only up to the end of the last video frame,
/// and if audio runs out before the video is finished, the audio track is simply wrapped up. In BCF rendering the two are already equal in length
/// (the mix spans `ir.total`, and the frame count is `round(ir.total × fps)`).
pub fn open_mp4_writer(
    out: &Path,
    width: u32,
    height: u32,
    fps: f64,
    audio_pcm: Option<&Path>,
) -> Result<Mp4Writer> {
    open_mp4_writer_with_bitrate(out, width, height, fps, audio_pcm, None)
}

/// Same as [`open_mp4_writer`], but the video bitrate (bit/s) can be specified.
///
/// When `bitrate` is `None`, the [`video_bitrate`] heuristic is used, exactly equivalent to [`open_mp4_writer`]. Timeline assembly and smart reframing pass explicit values: there the input is the **user's source material** rather than synthesised frames, so a “source bitrate” exists and can impose a cap on top of the heuristic tier (`services/timeline_media.rs::intermediate_video_bitrate`), so that a 1 Mb/s clip is not re-encoded into an intermediate file of over ten Mb/s.
pub fn open_mp4_writer_with_bitrate(
    out: &Path,
    width: u32,
    height: u32,
    fps: f64,
    audio_pcm: Option<&Path>,
    bitrate: Option<u32>,
) -> Result<Mp4Writer> {
    if !fps.is_finite() || fps <= 0.0 {
        bail!("unsupported: MP4 输出帧率必须是有限正值（实得 {fps}）");
    }
    let (fps_num, fps_den) = frame_rate_rational(fps);
    open_mp4_writer_with_options(
        out,
        &Mp4Options {
            width,
            height,
            fps_num,
            fps_den,
            video_bitrate: bitrate,
            audio: audio_pcm.map(|path| AudioInput {
                path: path.to_path_buf(),
                format: PcmFormat::RawF32,
                bitrate: AUDIO_BITRATE,
                duration_seconds: None,
            }),
        },
    )
}

/// Container of the mixed PCM.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PcmFormat {
    /// Raw f32le, 48 kHz, stereo interleaved (the one that `ccut-render::audio::mix_audio` writes out).
    RawF32,
    /// WAV (including `WAVE_FORMAT_EXTENSIBLE`): 48 kHz stereo, 32-bit float or 16 / 24 / 32-bit integer ([`WavLayout::is_native_pcm`]).
    Wav,
}

/// Audio track input: the whole mix and the AAC bitrate.
#[derive(Clone, Debug, PartialEq)]
pub struct AudioInput {
    pub path: PathBuf,
    pub format: PcmFormat,
    /// AAC bitrate (bit/s).
    pub bitrate: u32,
    /// Length of the audio track (seconds): if given, it is padded with silence or cut to exactly that length (aligned with the ffmpeg fallback's `apad=whole_dur,atrim=end`);
    /// `None` = cut to the end of the video per `-shortest`, and if shorter than the video, end at the end of the mix.
    pub duration_seconds: Option<f64>,
}

/// Parameters of [`open_mp4_writer_with_options`].
#[derive(Clone, Debug, PartialEq)]
pub struct Mp4Options {
    /// Output canvas; must be positive even numbers (H.264 4:2:0).
    pub width: u32,
    pub height: u32,
    /// Constant frame rate as a rational number (numerator, denominator); the presentation time of frame `i` is `i × denominator / numerator`. If the caller has the exact frame rate, pass it directly,
    /// without going through floating point and snapping again ([`frame_rate_rational`]).
    pub fps_num: u32,
    pub fps_den: u32,
    /// Average video bitrate (bit/s); `None` = the [`video_bitrate`] heuristic.
    pub video_bitrate: Option<u32>,
    pub audio: Option<AudioInput>,
}

/// Same as [`open_mp4_writer`], with the parameters collected into [`Mp4Options`]: the exact rational frame rate, the video bitrate, the audio track's container (raw PCM or WAV),
/// the AAC bitrate, and the audio track length.
///
/// The written video stream is tagged BT.709 (primaries, transfer function and YCbCr matrix), on the same basis as the `-colorspace bt709` of the ffmpeg fallback path.
pub fn open_mp4_writer_with_options(out: &Path, options: &Mp4Options) -> Result<Mp4Writer> {
    let &Mp4Options {
        width,
        height,
        fps_num,
        fps_den,
        video_bitrate: bitrate,
        ..
    } = options;
    if width == 0 || height == 0 {
        bail!("unsupported: MP4 输出尺寸必须为正（实得 {width}x{height}）");
    }
    if width % 2 != 0 || height % 2 != 0 {
        bail!("unsupported: H.264 输出尺寸必须为偶数（实得 {width}x{height}）");
    }
    if fps_num == 0 || fps_den == 0 || i32::try_from(fps_num).is_err() {
        bail!("unsupported: MP4 输出帧率必须是正的有理数（实得 {fps_num}/{fps_den}）");
    }
    if let Some(bitrate) = bitrate
        && bitrate == 0
    {
        bail!("unsupported: MP4 输出码率必须为正（实得 {bitrate}）");
    }
    let (audio, audio_bitrate) = match &options.audio {
        None => (None, AUDIO_BITRATE),
        Some(input) => {
            if input.bitrate == 0 {
                bail!("unsupported: AAC 码率必须为正");
            }
            let mut source = match input.format {
                PcmFormat::RawF32 => PcmSource::open(&input.path)?,
                PcmFormat::Wav => PcmSource::open_wav(&input.path)?,
            };
            if let Some(seconds) = input.duration_seconds {
                if !seconds.is_finite() || seconds < 0.0 {
                    bail!("unsupported: 音轨长度必须是非负有限值（实得 {seconds}）");
                }
                source.total = Some((seconds * f64::from(AUDIO_SAMPLE_RATE)).round() as u64);
            }
            (Some(source), input.bitrate)
        }
    };
    let exact_fps = f64::from(fps_num) / f64::from(fps_den);
    let setup = WriterSetup {
        width,
        height,
        fps_num,
        fps_den,
        bitrate: bitrate.unwrap_or_else(|| video_bitrate(width, height, exact_fps)),
        audio,
        audio_bitrate,
    };
    #[cfg(target_os = "macos")]
    {
        let sink = crate::encode_macos::open(out, setup)?;
        Ok(Mp4Writer { sink })
    }
    #[cfg(target_os = "windows")]
    {
        let sink = crate::encode_windows::open(out, setup)?;
        Ok(Mp4Writer { sink })
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (out, setup);
        bail!("unsupported: 当前平台没有原生 MP4 编码后端（请安装 ffmpeg 走兜底路径）")
    }
}

/// Format and data-chunk position of a WAV file ([`read_wav_layout`]).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WavLayout {
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
    /// IEEE float (format 3, or `WAVE_FORMAT_EXTENSIBLE` with sub-format 3).
    pub float: bool,
    /// File position of the first byte of the data chunk.
    pub data_offset: u64,
    /// Byte count of the data chunk. If the length is written as 0 or `0xFFFFFFFF` (it cannot be back-filled when streaming out), or is longer than the file, it counts to the end of the file.
    pub data_bytes: u64,
}

impl WavLayout {
    /// Whether the format is one the writer can take: 48 kHz, stereo, with samples as 32-bit float or 16 / 24 / 32-bit integer (integers are converted to float on read).
    pub fn is_native_pcm(&self) -> bool {
        self.sample_kind().is_some()
            && u32::from(self.channels) == AUDIO_CHANNELS
            && self.sample_rate == AUDIO_SAMPLE_RATE
    }

    fn sample_kind(&self) -> Option<SampleKind> {
        match (self.float, self.bits_per_sample) {
            (true, 32) => Some(SampleKind::F32),
            (false, 16) => Some(SampleKind::I16),
            (false, 24) => Some(SampleKind::I24),
            (false, 32) => Some(SampleKind::I32),
            _ => None,
        }
    }
}

/// Storage format of the mix samples. Integer samples are converted to float on the ffmpeg basis (divided by 2^(bits−1)).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SampleKind {
    F32,
    I16,
    I24,
    I32,
}

impl SampleKind {
    const fn bytes(self) -> usize {
        match self {
            SampleKind::I16 => 2,
            SampleKind::I24 => 3,
            SampleKind::F32 | SampleKind::I32 => 4,
        }
    }

    fn decode(self, raw: &[u8]) -> f32 {
        match self {
            SampleKind::F32 => f32::from_le_bytes([raw[0], raw[1], raw[2], raw[3]]),
            SampleKind::I16 => f32::from(i16::from_le_bytes([raw[0], raw[1]])) / 32_768.0,
            // A 24-bit sample is placed in the high 24 bits of an i32 and then arithmetically shifted right, so the sign bit extends naturally.
            SampleKind::I24 => {
                (i32::from_le_bytes([0, raw[0], raw[1], raw[2]]) >> 8) as f32 / 8_388_608.0
            }
            SampleKind::I32 => {
                (f64::from(i32::from_le_bytes([raw[0], raw[1], raw[2], raw[3]])) / 2_147_483_648.0)
                    as f32
            }
        }
    }
}

/// Read the WAV header: the positions of the format chunk and the data chunk (same rules as the master WAV reader in `export-worker`). Reports an error if it is not a WAV, the format chunk is incomplete,
/// or the data chunk comes before the format chunk or is missing; the format itself is not judged here ([`WavLayout::is_native_pcm`]).
pub fn read_wav_layout(path: &Path) -> Result<WavLayout> {
    let mut file =
        File::open(path).with_context(|| format!("打开混音 WAV 失败：{}", path.display()))?;
    let len = file.metadata().context("读混音 WAV 失败")?.len();
    let mut head = [0_u8; 12];
    file.read_exact(&mut head).context("混音不是 WAV 文件")?;
    if &head[0..4] != b"RIFF" || &head[8..12] != b"WAVE" {
        bail!("混音不是 WAV 文件");
    }
    let mut at = 12_u64;
    let mut format: Option<(u16, u16, u32, u16)> = None;
    loop {
        let mut chunk = [0_u8; 8];
        if file.read_exact(&mut chunk).is_err() {
            bail!("混音的 WAV 没有数据块");
        }
        let size = u64::from(u32::from_le_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]));
        let body = at + 8;
        match &chunk[0..4] {
            b"fmt " => {
                let mut fmt = vec![0_u8; size.min(64) as usize];
                file.read_exact(&mut fmt).context("读混音 WAV 失败")?;
                if fmt.len() < 16 {
                    bail!("混音的 WAV 格式块不完整");
                }
                let tag = u16::from_le_bytes([fmt[0], fmt[1]]);
                let channels = u16::from_le_bytes([fmt[2], fmt[3]]);
                let rate = u32::from_le_bytes([fmt[4], fmt[5], fmt[6], fmt[7]]);
                let bits = u16::from_le_bytes([fmt[14], fmt[15]]);
                // Only when it is 0xFFFE (WAVE_FORMAT_EXTENSIBLE) do the first two bytes of the sub-format GUID give the format number.
                let tag = if tag == 0xFFFE && fmt.len() >= 26 {
                    u16::from_le_bytes([fmt[24], fmt[25]])
                } else {
                    tag
                };
                format = Some((tag, channels, rate, bits));
            }
            b"data" => {
                let Some((tag, channels, sample_rate, bits_per_sample)) = format else {
                    bail!("混音的 WAV 在格式块之前就是数据块");
                };
                let rest = len.saturating_sub(body);
                let data_bytes = if size == 0 || size == u64::from(u32::MAX) || size > rest {
                    rest
                } else {
                    size
                };
                return Ok(WavLayout {
                    sample_rate,
                    channels,
                    bits_per_sample,
                    float: tag == 3,
                    data_offset: body,
                    data_bytes,
                });
            }
            _ => {}
        }
        // Chunks are aligned to even byte boundaries.
        at = body + size + (size & 1);
        file.seek(SeekFrom::Start(at)).context("读混音 WAV 失败")?;
    }
}

/// Chunked reader for the whole-piece mixed PCM (raw f32le, 48 kHz, stereo interleaved).
///
/// The whole mix can be several hundred MB (1 hour ≈ 1.3 GB), so it cannot be read into memory in one go; the platform writer also wants
/// to be "fed a small chunk at a time", so it is read in a streaming fashion by chunk, and the chunk number is the sample frame number.
pub(crate) struct PcmSource {
    reader: BufReader<File>,
    /// Number of sample frames handed out so far, which is also the starting frame number of the next chunk.
    frames: u64,
    /// Sample frames in the file not yet read (a WAV may have other chunks after the data chunk); `None` = read to the end of the file.
    remaining: Option<u64>,
    /// Total frame count of the audio track: if the file is too short, pad with silence; if it is long enough, cut here; `None` = hand out however many the file has.
    pub(crate) total: Option<u64>,
    /// The file has been fully read (after this, only silence can be added).
    exhausted: bool,
    /// Sample format: raw PCM is always 32-bit float; WAV follows its format chunk.
    kind: SampleKind,
}

/// One block of interleaved PCM.
pub(crate) struct PcmChunk {
    /// Frame number, within the whole piece, of the first sample frame in this block.
    pub(crate) start_frame: u64,
    /// Interleaved f32 samples (length = frames × channels).
    pub(crate) samples: Vec<f32>,
}

impl PcmChunk {
    /// Number of sample frames in this block.
    pub(crate) fn frames(&self) -> usize {
        self.samples.len() / AUDIO_CHANNELS as usize
    }
}

impl PcmSource {
    fn open(path: &Path) -> Result<Self> {
        let file =
            File::open(path).with_context(|| format!("打开混音 PCM 失败：{}", path.display()))?;
        Ok(Self {
            reader: BufReader::with_capacity(1 << 16, file),
            frames: 0,
            remaining: None,
            total: None,
            exhausted: false,
            kind: SampleKind::F32,
        })
    }

    /// Byte size of one sample frame (one sample per channel).
    fn frame_bytes(&self) -> usize {
        self.kind.bytes() * AUDIO_CHANNELS as usize
    }

    /// 48 kHz stereo WAV (32-bit float or 16 / 24 / 32-bit integer): read from the start of the data chunk, up to its end.
    /// Other formats are reported as `unsupported` (the caller falls back to ffmpeg).
    fn open_wav(path: &Path) -> Result<Self> {
        let layout = read_wav_layout(path)?;
        let kind = layout.sample_kind();
        if !layout.is_native_pcm() {
            bail!(
                "unsupported: 混音不是 {AUDIO_SAMPLE_RATE} Hz、{AUDIO_CHANNELS} 声道的 32 位浮点或 16/24/32 位整数 WAV（{} Hz、{} 声道、{} 位{}）",
                layout.sample_rate,
                layout.channels,
                layout.bits_per_sample,
                if layout.float { "浮点" } else { "整数" }
            );
        }
        let mut source = Self::open(path)?;
        source
            .reader
            .seek(SeekFrom::Start(layout.data_offset))
            .context("定位混音 WAV 的数据块失败")?;
        source.kind = kind.expect("is_native_pcm 查过");
        source.remaining = Some(layout.data_bytes / source.frame_bytes() as u64);
        Ok(source)
    }

    /// Audio seconds handed out so far (= the start time of the next block).
    pub(crate) fn position_seconds(&self) -> f64 {
        self.frames as f64 / f64::from(AUDIO_SAMPLE_RATE)
    }

    /// Next block; `None` = PCM fully read.
    ///
    /// Trailing bytes that do not make up a complete sample frame are simply dropped: the mix is always written in whole frames, so a half frame can only mean the file was truncated, and reporting an extra error for it is no better than wrapping up quietly (the video track is already finished).
    pub(crate) fn next_chunk(&mut self) -> Result<Option<PcmChunk>> {
        // Maximum frames in this block: the block length, cut to the total frame count.
        let mut want = AUDIO_CHUNK_FRAMES as u64;
        if let Some(total) = self.total {
            want = want.min(total.saturating_sub(self.frames));
        }
        if want == 0 || (self.exhausted && self.total.is_none()) {
            return Ok(None);
        }
        // Frames to read from the file: no more than what remains in the data chunk.
        let read_frames = self.remaining.map_or(want, |remaining| want.min(remaining)) as usize;
        let frame_bytes = self.frame_bytes();
        let mut bytes = vec![0_u8; read_frames * frame_bytes];
        let mut filled = 0_usize;
        while !self.exhausted && filled < bytes.len() {
            match self.reader.read(&mut bytes[filled..]) {
                Ok(0) => self.exhausted = true,
                Ok(read) => filled += read,
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {}
                Err(error) => return Err(error).context("读取混音 PCM 失败"),
            }
        }
        let read = filled / frame_bytes;
        if let Some(remaining) = self.remaining.as_mut() {
            *remaining -= read as u64;
            if *remaining == 0 {
                self.exhausted = true;
            }
        }
        // File too short: if there is a total frame count, pad with silence to this block's length; otherwise hand out what was read.
        let frames = if self.total.is_some() {
            want as usize
        } else {
            read
        };
        if frames == 0 {
            self.exhausted = true;
            return Ok(None);
        }
        let kind = self.kind;
        let mut samples: Vec<f32> = bytes[..read * frame_bytes]
            .chunks_exact(kind.bytes())
            .map(|value| kind.decode(value))
            .collect();
        samples.resize(frames * AUDIO_CHANNELS as usize, 0.0);
        let start_frame = self.frames;
        self.frames += frames as u64;
        Ok(Some(PcmChunk {
            start_frame,
            samples,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn the_bitrate_curve_scales_with_pixels_and_frame_rate_inside_the_clamp() {
        // 1080p30 baseline: 8 Mb/s × 1.5 quality margin.
        assert_eq!(video_bitrate(1920, 1080, 30.0), 12_000_000);
        // Pixels halved → bitrate halved; frame rate doubled → bitrate doubled.
        assert_eq!(video_bitrate(1280, 720, 30.0), 5_333_333);
        assert_eq!(video_bitrate(1920, 1080, 60.0), 24_000_000);
        // Clamp at both ends: a tiny canvas is raised to the 4 Mb/s floor, and 4K60 is capped at the 60 Mb/s ceiling.
        assert_eq!(video_bitrate(320, 180, 30.0), 4_000_000);
        assert_eq!(video_bitrate(3840, 2160, 60.0), 60_000_000);
    }

    /// CRF 18 sits on the curve's original value; each 6-point difference in CRF is a factor of two in bitrate. The ceiling is still 60 Mb/s.
    #[test]
    fn crf_maps_onto_the_bitrate_curve_doubling_every_six_steps() {
        let base = video_bitrate(1920, 1080, 30.0);
        assert_eq!(crf_bitrate(1920, 1080, 30.0, 18), base);
        assert_eq!(crf_bitrate(1920, 1080, 30.0, 24), base / 2);
        assert_eq!(crf_bitrate(1920, 1080, 30.0, 12), base * 2);
        // H.264's default CRF of 20: the curve's 2^(-1/3).
        assert_eq!(
            crf_bitrate(1920, 1080, 30.0, 20),
            (f64::from(base) * 2_f64.powf(-2.0 / 6.0)).round() as u32
        );
        assert_eq!(crf_bitrate(3840, 2160, 60.0, 0), 60_000_000);
        assert!(crf_bitrate(320, 180, 30.0, 51) >= 1);
    }

    /// Build a 32-bit float WAV the way ffmpeg writes one (optionally EXTENSIBLE, with a LIST chunk before the data chunk and a trailer chunk after it).
    fn wav(tag: u16, rate: u32, channels: u16, data_size: u32, samples: &[f32]) -> Vec<u8> {
        let mut fmt = Vec::new();
        fmt.extend_from_slice(&tag.to_le_bytes());
        fmt.extend_from_slice(&channels.to_le_bytes());
        fmt.extend_from_slice(&rate.to_le_bytes());
        fmt.extend_from_slice(&(rate * 4 * u32::from(channels)).to_le_bytes());
        fmt.extend_from_slice(&(4 * channels).to_le_bytes());
        fmt.extend_from_slice(&32u16.to_le_bytes());
        if tag == 0xFFFE {
            fmt.extend_from_slice(&22u16.to_le_bytes());
            fmt.extend_from_slice(&32u16.to_le_bytes());
            fmt.extend_from_slice(&3u32.to_le_bytes());
            fmt.extend_from_slice(&3u16.to_le_bytes());
            fmt.extend_from_slice(&[0u8; 14]);
        }
        let mut bytes = b"RIFF\0\0\0\0WAVE".to_vec();
        bytes.extend_from_slice(b"LIST");
        bytes.extend_from_slice(&3u32.to_le_bytes());
        bytes.extend_from_slice(b"abc\0");
        bytes.extend_from_slice(b"fmt ");
        bytes.extend_from_slice(&(fmt.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&fmt);
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data_size.to_le_bytes());
        for sample in samples {
            bytes.extend_from_slice(&sample.to_le_bytes());
        }
        bytes
    }

    /// WAV header: with EXTENSIBLE, or when the data chunk length is corrupt (0xFFFFFFFF), it counts to the end of the file; if the format is wrong the writer does not accept it (the caller falls back to ffmpeg).
    #[test]
    fn wav_headers_locate_the_data_and_report_the_format() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mix.wav");
        std::fs::write(&path, wav(3, 48_000, 2, 80, &[0.0; 20])).unwrap();
        let layout = read_wav_layout(&path).unwrap();
        assert_eq!(
            (layout.data_offset, layout.data_bytes),
            (12 + 12 + 8 + 16 + 8, 80)
        );
        assert!(layout.is_native_pcm());
        std::fs::write(&path, wav(0xFFFE, 48_000, 2, u32::MAX, &[0.0; 20])).unwrap();
        let layout = read_wav_layout(&path).unwrap();
        assert!(layout.is_native_pcm());
        assert_eq!(layout.data_bytes, 80);
        std::fs::write(&path, wav(3, 44_100, 2, 80, &[0.0; 20])).unwrap();
        assert!(!read_wav_layout(&path).unwrap().is_native_pcm());
        assert!(PcmSource::open_wav(&path).is_err());
        std::fs::write(&path, wav(3, 48_000, 1, 80, &[0.0; 20])).unwrap();
        assert!(!read_wav_layout(&path).unwrap().is_native_pcm());
        // 32-bit integers are accepted too (converted to float on read).
        std::fs::write(&path, wav(1, 48_000, 2, 80, &[0.0; 20])).unwrap();
        assert!(read_wav_layout(&path).unwrap().is_native_pcm());
        std::fs::write(&path, b"not a wav file").unwrap();
        assert!(read_wav_layout(&path).is_err());
    }

    /// WAV samples are read from the start of the data chunk and stop at its end (trailing chunks after it are not treated as sound); if a total frame count is given, pad with silence or cut to exactly that length.
    #[test]
    fn wav_pcm_is_padded_with_silence_or_cut_to_the_track_length() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mix.wav");
        let samples: Vec<f32> = (0..10).map(|i| i as f32).collect();
        let mut bytes = wav(3, 48_000, 2, 40, &samples);
        bytes.extend_from_slice(b"junk\x04\0\0\0\x7f\x7f\x7f\x7f");
        std::fs::write(&path, &bytes).unwrap();

        // No total frame count given: hand out only the 5 frames in the data chunk.
        let mut source = PcmSource::open_wav(&path).unwrap();
        let chunk = source.next_chunk().unwrap().unwrap();
        assert_eq!(chunk.samples, samples);
        assert!(source.next_chunk().unwrap().is_none());

        // Padding with silence: 5 frames in the data chunk, total length 1.5 blocks.
        let mut source = PcmSource::open_wav(&path).unwrap();
        let total = AUDIO_CHUNK_FRAMES as u64 * 3 / 2;
        source.total = Some(total);
        let first = source.next_chunk().unwrap().unwrap();
        assert_eq!(first.frames(), AUDIO_CHUNK_FRAMES);
        assert_eq!(first.samples[..10], samples[..]);
        assert!(first.samples[10..].iter().all(|v| *v == 0.0));
        let second = source.next_chunk().unwrap().unwrap();
        assert_eq!(second.start_frame, AUDIO_CHUNK_FRAMES as u64);
        assert_eq!(second.frames() as u64, total - AUDIO_CHUNK_FRAMES as u64);
        assert!(source.next_chunk().unwrap().is_none());
        assert_eq!(
            source.position_seconds(),
            total as f64 / f64::from(AUDIO_SAMPLE_RATE)
        );

        // Truncation: total length 3 frames.
        let mut source = PcmSource::open_wav(&path).unwrap();
        source.total = Some(3);
        assert_eq!(source.next_chunk().unwrap().unwrap().samples, samples[..6]);
        assert!(source.next_chunk().unwrap().is_none());
    }

    /// Integer WAV (the Runtime's mix is 16-bit): converted to float on the ffmpeg basis (divided by 2^(bits−1)), with 24-bit sign extension.
    #[test]
    fn integer_wav_samples_are_converted_to_float() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mix.wav");
        // The same 32-bit float header, changed to an integer format and bit depth; the data chunk is rewritten at the new bit depth.
        let build = |bits: u16, data: &[u8]| {
            let mut bytes = wav(1, 48_000, 2, data.len() as u32, &[]);
            let fmt = 12 + 12 + 8;
            bytes[fmt + 14..fmt + 16].copy_from_slice(&bits.to_le_bytes());
            bytes.extend_from_slice(data);
            bytes
        };
        let s16: Vec<u8> = [0_i16, 16_384, -32_768, 32_767]
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        std::fs::write(&path, build(16, &s16)).unwrap();
        let layout = read_wav_layout(&path).unwrap();
        assert_eq!((layout.bits_per_sample, layout.float), (16, false));
        assert!(layout.is_native_pcm());
        let mut source = PcmSource::open_wav(&path).unwrap();
        let chunk = source.next_chunk().unwrap().unwrap();
        assert_eq!(chunk.samples, [0.0, 0.5, -1.0, 32_767.0 / 32_768.0]);
        assert!(source.next_chunk().unwrap().is_none());

        // 24-bit: 0x400000 = 0.5, 0x800000 = -1.0.
        let s24 = [0, 0, 0x40, 0, 0, 0x80, 0xFF, 0xFF, 0xFF, 0, 0, 0];
        std::fs::write(&path, build(24, &s24)).unwrap();
        let chunk = PcmSource::open_wav(&path)
            .unwrap()
            .next_chunk()
            .unwrap()
            .unwrap();
        assert_eq!(chunk.samples, [0.5, -1.0, -1.0 / 8_388_608.0, 0.0]);

        // 8-bit is not accepted.
        std::fs::write(&path, build(8, &[0; 4])).unwrap();
        assert!(!read_wav_layout(&path).unwrap().is_native_pcm());
        assert!(PcmSource::open_wav(&path).is_err());
    }

    #[test]
    fn frame_rates_snap_to_exact_fractions() {
        assert_eq!(frame_rate_rational(30.0), (30, 1));
        assert_eq!(frame_rate_rational(24.0), (24, 1));
        assert_eq!(frame_rate_rational(30000.0 / 1001.0), (30000, 1001));
        assert_eq!(frame_rate_rational(24000.0 / 1001.0), (24000, 1001));
        // A non-standard frame rate falls back to a one-thousandth timebase; an invalid value falls back to 30.
        assert_eq!(frame_rate_rational(12.5), (12500, 1000));
        assert_eq!(frame_rate_rational(0.0), (30, 1));
        assert_eq!(frame_rate_rational(f64::NAN), (30, 1));
    }

    #[test]
    fn odd_or_zero_geometry_is_rejected_before_touching_the_platform() {
        let out = std::env::temp_dir().join("ccut-encode-guard.mp4");
        assert!(open_mp4_writer(&out, 0, 100, 30.0, None).is_err());
        assert!(open_mp4_writer(&out, 101, 100, 30.0, None).is_err());
        assert!(open_mp4_writer(&out, 100, 100, 0.0, None).is_err());
        let options = |fps_num, fps_den| Mp4Options {
            width: 100,
            height: 100,
            fps_num,
            fps_den,
            video_bitrate: None,
            audio: None,
        };
        assert!(open_mp4_writer_with_options(&out, &options(0, 1)).is_err());
        assert!(open_mp4_writer_with_options(&out, &options(30, 0)).is_err());
        assert!(!out.exists(), "守卫不该创建产物文件");
    }

    #[test]
    fn pcm_chunks_carry_their_own_frame_offset_and_stop_at_eof() {
        let mut file = tempfile::NamedTempFile::new().unwrap();
        // A tail of 1.5 blocks plus half a sample frame (the tail should be dropped).
        let frames = AUDIO_CHUNK_FRAMES + AUDIO_CHUNK_FRAMES / 2;
        let mut bytes = Vec::new();
        for frame in 0..frames {
            for channel in 0..AUDIO_CHANNELS as usize {
                bytes.extend_from_slice(&((frame + channel) as f32).to_le_bytes());
            }
        }
        bytes.extend_from_slice(&[0, 0, 0, 0]);
        file.write_all(&bytes).unwrap();
        file.flush().unwrap();

        let mut source = PcmSource::open(file.path()).unwrap();
        let first = source.next_chunk().unwrap().unwrap();
        assert_eq!(first.start_frame, 0);
        assert_eq!(first.frames(), AUDIO_CHUNK_FRAMES);
        assert_eq!(first.samples[0], 0.0);
        assert_eq!(first.samples[1], 1.0);
        let second = source.next_chunk().unwrap().unwrap();
        assert_eq!(second.start_frame, AUDIO_CHUNK_FRAMES as u64);
        assert_eq!(second.frames(), AUDIO_CHUNK_FRAMES / 2);
        assert_eq!(
            source.position_seconds(),
            frames as f64 / f64::from(AUDIO_SAMPLE_RATE)
        );
        assert!(source.next_chunk().unwrap().is_none());
    }
}
