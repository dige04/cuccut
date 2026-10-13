//! Platform-native codecs (architecture design §9.11 “picture”): `media-native` is used where it works (macOS AVFoundation / Windows Media Foundation). Where it does not, that one path falls back to ffmpeg individually, and the fallback reason is recorded in `video.fallbacks` of the `done` event.
//!
//! - Decoding: each video instance's [`VideoDecoder`](media_core::decode::VideoDecoder) gets a native frame source attached ([`decode`]), with fallback per asset. Assets that may carry transparency do not use native (native decoding flattens alpha to 255) and go straight to ffmpeg.
//! - Encoding: the native writer ([`choose_encoder`]) is used only for H.264 + MP4, with even width and height, and a 48 kHz stereo WAV mix (32-bit float or 16/24/32-bit integer). HEVC, WebM/VP9, odd sizes, other mix formats, and cases where native cannot open fall back to ffmpeg.
//! - The environment variable `CUCCUT_EXPORT_NATIVE=0` turns native off, so the whole export uses only ffmpeg (for troubleshooting and tests).
//!
//! RGBA is the only pixel format in the export loop; the BGRA↔RGBA channel swap stays inside `media-native`.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use media_core::MediaError;
use media_core::decode::{FeedOpener, FrameFeed, NativeDecode};
use media_core::encode::{Container, EncodeSettings, FrameSink, Quality, VideoCodec};
use media_native::{AudioInput, Mp4Options, Mp4Writer, PcmFormat, SequentialDecoder};
use serde::Serialize;

/// Environment variable that turns native codecs off (off when the value is `0`).
pub const NATIVE_ENV: &str = "CUCCUT_EXPORT_NATIVE";

/// One record of native falling back to ffmpeg (an element of `done.video.fallbacks`). `reason` is an English code.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fallback {
    /// `decoder` or `encoder`.
    pub scope: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    pub reason: &'static str,
    pub message: String,
}

impl Fallback {
    pub fn encoder(reason: &'static str, message: impl Into<String>) -> Fallback {
        Fallback {
            scope: "encoder",
            asset_id: None,
            reason,
            message: message.into(),
        }
    }

    pub fn decoder(asset_id: Option<&str>, reason: &'static str, message: impl Into<String>) -> Fallback {
        Fallback {
            scope: "decoder",
            asset_id: asset_id.map(str::to_string),
            reason,
            message: message.into(),
        }
    }
}

fn enabled_by(value: Option<&str>) -> bool {
    value.is_none_or(|v| v.trim() != "0")
}

/// Whether native codecs have been turned off by the environment variable.
pub fn enabled() -> bool {
    enabled_by(std::env::var(NATIVE_ENV).ok().as_deref())
}

/// Reason native decoding as a whole is unavailable (turned off, or not offered on this platform); `None` when available.
pub fn decode_unavailable() -> Option<(&'static str, String)> {
    if !enabled() {
        return Some(("native-disabled", format!("{NATIVE_ENV}=0")));
    }
    if !media_native::available() {
        return Some(("native-unavailable", "no native decoding backend on this platform".into()));
    }
    None
}

/// The native frame source attached to the video decoder; `None` when native is unavailable.
pub fn decode() -> Option<NativeDecode> {
    if decode_unavailable().is_some() {
        return None;
    }
    let open: FeedOpener = Arc::new(|path: &Path, from: f64, width: u32, height: u32| {
        media_native::open_sequential_decoder(path, from, Some((width, height)))
            .map(|decoder| Box::new(Feed(decoder)) as Box<dyn FrameFeed>)
            .map_err(|e| format!("{e:#}"))
    });
    Some(NativeDecode {
        backend: media_native::backend(),
        open,
    })
}

struct Feed(SequentialDecoder);

impl FrameFeed for Feed {
    fn next_into(&mut self, data: &mut Vec<u8>) -> Result<Option<f64>, String> {
        match self.0.next_into(data) {
            Ok(frame) => Ok(frame.map(|info| info.pts_seconds)),
            Err(e) => Err(format!("{e:#}")),
        }
    }
}

/// Which path encoding takes: the native writer (with its parameters), or ffmpeg (with the reason it does not take native).
#[derive(Clone, Debug, PartialEq)]
pub enum EncoderPlan {
    Native(Mp4Options),
    Ffmpeg(Fallback),
}

/// Selects the encoder from the output settings. When the mix WAV has not been written yet (the preflight at export start), it is computed as if native would work; at execution time (WAV already present), it is set by the actual format.
pub fn choose_encoder(settings: &EncodeSettings) -> EncoderPlan {
    let audio_ok = |path: &Path| match media_native::read_wav_layout(path) {
        Ok(layout) if layout.is_native_pcm() => Ok(()),
        Ok(layout) => Err(format!(
            "mix is {} Hz, {} channels, {}-bit {}; the native writer only accepts 48000 Hz stereo, 32-bit float, or 16/24/32-bit integer",
            layout.sample_rate,
            layout.channels,
            layout.bits_per_sample,
            if layout.float { "float" } else { "integer" }
        )),
        Err(_) if !path.exists() => Ok(()),
        Err(e) => Err(format!("{e:#}")),
    };
    choose_encoder_with(settings, enabled(), media_native::encode_available(), audio_ok)
}

fn choose_encoder_with(
    settings: &EncodeSettings,
    enabled: bool,
    available: bool,
    audio_ok: impl Fn(&Path) -> Result<(), String>,
) -> EncoderPlan {
    let fallback = |reason, message: String| EncoderPlan::Ffmpeg(Fallback::encoder(reason, message));
    if !enabled {
        return fallback("native-disabled", format!("{NATIVE_ENV}=0"));
    }
    if !available {
        return fallback("native-unavailable", "no native encoding backend on this platform".into());
    }
    if settings.codec != VideoCodec::H264 {
        return fallback("codec", format!("the native writer only encodes H.264, requested {}", settings.codec.name()));
    }
    if settings.container != Container::Mp4 {
        return fallback("container", "the native writer only writes MP4".into());
    }
    if !settings.width.is_multiple_of(2) || !settings.height.is_multiple_of(2) {
        return fallback("odd-size", format!("{}×{} is not an even size", settings.width, settings.height));
    }
    let (Ok(fps_num), Ok(fps_den)) = (u32::try_from(settings.fps_num), u32::try_from(settings.fps_den)) else {
        return fallback(
            "frame-rate",
            format!("frame rate {}/{} is outside the native writer's range", settings.fps_num, settings.fps_den),
        );
    };
    if fps_num == 0 || fps_den == 0 {
        return fallback("frame-rate", format!("frame rate {fps_num}/{fps_den} is invalid"));
    }
    let audio = match &settings.audio {
        None => None,
        Some(track) => {
            if let Err(message) = audio_ok(&track.path) {
                return fallback("audio-format", message);
            }
            Some(AudioInput {
                path: track.path.clone(),
                format: PcmFormat::Wav,
                bitrate: track.bitrate_kbps.saturating_mul(1000),
                duration_seconds: Some(settings.duration_seconds),
            })
        }
    };
    let fps = f64::from(fps_num) / f64::from(fps_den);
    let video_bitrate = match settings.quality {
        Quality::BitrateKbps(kbps) => kbps.saturating_mul(1000),
        Quality::Crf(crf) => media_native::crf_bitrate(settings.width, settings.height, fps, crf),
    };
    EncoderPlan::Native(Mp4Options {
        width: settings.width,
        height: settings.height,
        fps_num,
        fps_den,
        video_bitrate: Some(video_bitrate),
        audio,
    })
}

/// Opens the native writer (called on the write thread of the encode queue).
pub fn open_sink(path: PathBuf, options: &Mp4Options) -> Result<Box<dyn FrameSink>, MediaError> {
    let writer = media_native::open_mp4_writer_with_options(&path, options)
        .map_err(|e| MediaError::new("EXPORT_ENCODE_FAILED", format!("{e:#}")))?;
    Ok(Box::new(NativeSink {
        writer: Some(writer),
        path,
    }))
}

/// Makes the native writer the output of the encode queue. On failure or abandonment, no file is left behind.
struct NativeSink {
    writer: Option<Mp4Writer>,
    path: PathBuf,
}

impl NativeSink {
    /// Deletes the output. No error is reported if it was never created (`NotFound`) or cannot be deleted, since the export has already failed or been cancelled for another reason.
    fn remove_output(&self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

impl FrameSink for NativeSink {
    fn write(&mut self, rgba: &[u8]) -> Result<(), MediaError> {
        let writer = self
            .writer
            .as_mut()
            .ok_or_else(|| MediaError::new("EXPORT_ENCODE_FAILED", "encoder is closed"))?;
        writer
            .write_frame(rgba)
            .map_err(|e| MediaError::new("EXPORT_ENCODE_FAILED", format!("native encoding failed: {e:#}")))
    }

    fn finish(mut self: Box<Self>) -> Result<(), MediaError> {
        let Some(writer) = self.writer.take() else {
            return Err(MediaError::new("EXPORT_ENCODE_FAILED", "encoder is closed"));
        };
        writer.finish().map_err(|e| {
            self.remove_output();
            MediaError::new("EXPORT_ENCODE_FAILED", format!("native encoding finalization failed: {e:#}"))
        })
    }

    fn abort(mut self: Box<Self>) {
        // Dropping the writer cancels the write (AVAssetWriter cancelWriting / Sink Writer release), then the half-written file is deleted.
        drop(self.writer.take());
        self.remove_output();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use media_core::encode::AudioTrack;

    fn settings() -> EncodeSettings {
        EncodeSettings {
            width: 1920,
            height: 1080,
            fps_num: 30000,
            fps_den: 1001,
            codec: VideoCodec::H264,
            container: Container::Mp4,
            quality: Quality::Crf(20),
            audio: Some(AudioTrack {
                path: PathBuf::from("/tmp/mix.wav"),
                bitrate_kbps: 192,
            }),
            duration_seconds: 2.5,
        }
    }

    fn reason(plan: EncoderPlan) -> &'static str {
        match plan {
            EncoderPlan::Native(_) => "native",
            EncoderPlan::Ffmpeg(fallback) => fallback.reason,
        }
    }

    #[test]
    fn h264_mp4_with_even_size_and_native_pcm_goes_native() {
        let plan = choose_encoder_with(&settings(), true, true, |_| Ok(()));
        let EncoderPlan::Native(options) = plan else {
            panic!("should take the native path: {plan:?}")
        };
        assert_eq!(
            (options.width, options.height, options.fps_num, options.fps_den),
            (1920, 1080, 30000, 1001)
        );
        let fps = 30000.0 / 1001.0;
        assert_eq!(options.video_bitrate, Some(media_native::crf_bitrate(1920, 1080, fps, 20)));
        let audio = options.audio.expect("has audio");
        assert_eq!(
            (audio.bitrate, audio.format, audio.duration_seconds),
            (192_000, PcmFormat::Wav, Some(2.5))
        );

        let mut fixed = settings();
        fixed.quality = Quality::BitrateKbps(6000);
        fixed.audio = None;
        let EncoderPlan::Native(options) = choose_encoder_with(&fixed, true, true, |_| Ok(())) else {
            panic!("should take the native path")
        };
        assert_eq!((options.video_bitrate, options.audio), (Some(6_000_000), None));
    }

    #[test]
    fn everything_else_falls_back_to_ffmpeg_with_a_reason() {
        let ok = |_: &Path| Ok(());
        assert_eq!(reason(choose_encoder_with(&settings(), false, true, ok)), "native-disabled");
        assert_eq!(reason(choose_encoder_with(&settings(), true, false, ok)), "native-unavailable");
        let mut hevc = settings();
        hevc.codec = VideoCodec::Hevc;
        assert_eq!(reason(choose_encoder_with(&hevc, true, true, ok)), "codec");
        let mut webm = settings();
        webm.codec = VideoCodec::Vp9;
        webm.container = Container::Webm;
        assert_eq!(reason(choose_encoder_with(&webm, true, true, ok)), "codec");
        let mut odd = settings();
        odd.width = 1279;
        assert_eq!(reason(choose_encoder_with(&odd, true, true, ok)), "odd-size");
        let wrong_audio = |_: &Path| Err("44100 Hz".to_string());
        assert_eq!(reason(choose_encoder_with(&settings(), true, true, wrong_audio)), "audio-format");
        let mut silent = settings();
        silent.audio = None;
        assert_eq!(reason(choose_encoder_with(&silent, true, true, wrong_audio)), "native");
    }

    #[test]
    fn only_zero_turns_native_off() {
        assert!(enabled_by(None));
        assert!(enabled_by(Some("1")));
        assert!(enabled_by(Some("")));
        assert!(!enabled_by(Some("0")));
        assert!(!enabled_by(Some(" 0 ")));
    }

    #[test]
    fn fallbacks_serialize_with_english_keys() {
        let value = serde_json::to_value(Fallback::decoder(Some("a1"), "open-failed", "x")).unwrap();
        assert_eq!(
            value,
            serde_json::json!({ "scope": "decoder", "assetId": "a1", "reason": "open-failed", "message": "x" })
        );
        let value = serde_json::to_value(Fallback::encoder("codec", "y")).unwrap();
        assert!(value.get("assetId").is_none());
    }

    /// Abandonment and failure during wrap-up both leave no file. On abandonment the file may not have been created yet, so no error is reported.
    #[test]
    fn an_aborted_native_sink_leaves_no_file() {
        if !media_native::encode_available() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.mp4");
        let options = Mp4Options {
            width: 64,
            height: 36,
            fps_num: 10,
            fps_den: 1,
            video_bitrate: None,
            audio: None,
        };
        let mut sink = open_sink(path.clone(), &options).unwrap();
        sink.write(&[0, 0, 0, 255].repeat(64 * 36)).unwrap();
        sink.abort();
        assert!(!path.exists());

        let mut sink = open_sink(path.clone(), &options).unwrap();
        for _ in 0..5 {
            sink.write(&[200, 60, 30, 255].repeat(64 * 36)).unwrap();
        }
        sink.finish().unwrap();
        assert!(path.exists());
    }
}
