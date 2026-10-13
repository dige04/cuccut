//! Pure-Rust audio decoding main path (Symphonia): any container → 48 kHz interleaved stereo f32.
//!
//! Semantics aligned with the pre-migration
//! `ffmpeg -ss <start> -t <duration> -i <src> -f f32le -ac 2 -ar 48000 -`:
//!
//! - **Window**: `[start, start + duration)`, rounded on **source sample frames** (`round`),
//!   sample-accurate. If the source is not long enough it is simply truncated (ffmpeg's `-t` is likewise only an upper bound).
//! - **Edit list**: the start point of the `elst` on an MP4 / M4A / MOV audio track (the AAC encoder's leading priming frames:
//!   1024 frames from ffmpeg, 2112 frames from AVFoundation) is first dropped from the decoded frame stream, so that `start = 0` is frame 0 as seen by ffmpeg and by players. Symphonia does not apply the edit list itself; if this step is skipped, the whole
//!   audio runs one priming frame late (`media_probe::audio_edit_start`).
//! - **Channels**: mono is mapped to left and right with constant-power gain (each multiplied by 1/√2); stereo passes through unchanged.
//!   **Three or more channels return an error** so the caller falls back to ffmpeg. The `-ac 2` downmix matrix (gains and phases for center and surround) is careful work, and guessing an approximation would make 5.1 material sound different; it is better not to accept it.
//! - **Sample rate**: multi-phase windowed-sinc resampling to 48 kHz; when the source is already 48 kHz, it passes through without filtering.
//!
//! ## Relationship to the resampler in `ccut-speech`
//!
//! `core/crates/ccut-speech/src/audio/symphonia_decode.rs` has an implementation of the same family,
//! but it is an ASR front end hard-wired to **mono → 16 kHz** (taps and cutoff tuned for speech).
//! `ccut-render` cannot depend on `ccut-speech` (that is a heavy crate with MLX/Candle, and the dependency direction is also backwards).
//! Merging the two into one shared crate would be a bigger change than WP6a. This file keeps the same
//! algorithm (multi-phase windowed sinc, Blackman window, DC gain normalization) but takes the parameters afresh for full-band audio,
//! and the two files name each other; the shared crate will be extracted when there is a third call site.

use std::path::Path;

use anyhow::{Context, Result, bail};
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::codecs::audio::well_known::CODEC_ID_AAC;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::well_known::FORMAT_ID_ISOMP4;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo, TrackType};
use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::MetadataOptions;
use symphonia::core::units::Timestamp;

use super::{CHANNELS, SAMPLE_RATE};

/// Phase table size: fractional offsets quantized to 1/1024 of a source sample.
const PHASE_COUNT: usize = 1024;
/// Base tap count per side. Twice that of the ASR front end (16): this must pass the full audible band of music and voice, and a narrower transition band avoids clipping high frequencies in common conversions such as 44.1 → 48.
const BASE_HALF_TAPS: usize = 32;
/// Margin of the low-pass cutoff relative to Nyquist, to suppress aliasing near the transition band.
const CUTOFF_ROLLOFF: f64 = 0.92;

/// Decodes the samples of the first audio track of `path` over `[start, start + duration)`,
/// yielding 48 kHz interleaved stereo f32.
///
/// Any `Err` means "this source cannot be handled by the pure-Rust path", and the caller falls back to ffmpeg on that basis.
pub(crate) fn decode_stereo_48k(path: &Path, start: f64, duration: f64) -> Result<Vec<f32>> {
    decode_window(path, start, duration, true).map(|(samples, _)| samples)
}

/// The first audio track as a whole → 48 kHz mono f32: channels are averaged (a mono source passes through as-is).
pub(crate) fn decode_mono_48k(path: &Path) -> Result<Vec<f32>> {
    let (stereo, _, channels) = decode_window_channels(path, 0.0, f64::INFINITY, false)?;
    // A mono source is split into both sides at 1/√2 in stereo: multiply back.
    let scale = if channels == 1 {
        std::f32::consts::SQRT_2
    } else {
        1.0
    };
    Ok(stereo
        .chunks_exact(CHANNELS)
        .map(|frame| {
            if channels == 1 {
                frame[0] * scale
            } else {
                (frame[0] + frame[1]) * 0.5
            }
        })
        .collect())
}

fn open_format(path: &Path) -> Result<Box<dyn FormatReader>> {
    let file = std::fs::File::open(path).with_context(|| format!("打开媒体 {}", path.display()))?;
    let stream = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());
    let mut hint = Hint::new();
    if let Some(extension) = path.extension().and_then(|value| value.to_str()) {
        hint.with_extension(extension);
    }
    symphonia::default::get_probe()
        .probe(
            &hint,
            stream,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .with_context(|| format!("Rust 解复用失败：{}", path.display()))
}

/// The packet count lets regression tests bound work independently of machine speed.
fn decode_window(
    path: &Path,
    start: f64,
    duration: f64,
    allow_seek: bool,
) -> Result<(Vec<f32>, usize)> {
    decode_window_channels(path, start, duration, allow_seek)
        .map(|(samples, packets, _)| (samples, packets))
}

/// Same as [`decode_window`], additionally yielding the source's channel count.
fn decode_window_channels(
    path: &Path,
    start: f64,
    duration: f64,
    allow_seek: bool,
) -> Result<(Vec<f32>, usize, usize)> {
    let mut format = open_format(path)?;
    let track = format
        .first_track_known_codec(TrackType::Audio)
        .context("Rust 解复用器没有找到音频轨")?;
    let track_id = track.id;
    // MP4 / M4A encoder priming frames: Symphonia does not apply `elst`, so they are dropped here.
    let edit = media_probe::audio_edit_start(path, track_id);
    let codec_params = track
        .codec_params
        .as_ref()
        .and_then(|params| params.audio())
        .context("Rust 解复用器没有给出音频编解码参数")?
        .clone();
    // Only indexed ISO-BMFF AAC tracks with one timestamp tick per decoded sample
    // have the exact clock needed here. Other formats keep the sequential path.
    // AAC needs preceding packets to warm its overlap buffer. Seek 0.5 s before
    // the requested window, including elst priming in the media clock, then
    // discard up to the original sample boundary (never reset the resampler).
    // AAC perceptual noise substitution has a running PRNG: seeking preserves
    // its noise energy, but does not reproduce the sequential random samples.
    let seek_frame = codec_params
        .sample_rate
        .filter(|rate| {
            allow_seek
                && start.is_finite()
                && start > 0.5
                && codec_params.codec == CODEC_ID_AAC
                && format.format_info().format == FORMAT_ID_ISOMP4
                && track.start_ts.is_zero()
                && track
                    .time_base
                    .is_some_and(|base| base.numer.get() == 1 && base.denom.get() == *rate)
        })
        .map(|rate| {
            let priming = edit.map_or(0, |edit| edit.frames(rate));
            priming + ((start - 0.5) * f64::from(rate)).round() as u64
        });
    let mut position = 0_u64;
    if let Some(frame) = seek_frame.and_then(|frame| i64::try_from(frame).ok()) {
        match format.seek(
            SeekMode::Accurate,
            SeekTo::Timestamp {
                ts: Timestamp::new(frame),
                track_id,
            },
        ) {
            Ok(seeked) if seeked.actual_ts.get() >= 0 && seeked.actual_ts.get() <= frame => {
                position = seeked.actual_ts.get() as u64;
            }
            // A failed seek can have moved other tracks already. Reopen rather
            // than assuming the demuxer is still at zero (also preserves EOF).
            _ => format = open_format(path)?,
        }
    }
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(&codec_params, &AudioDecoderOptions::default())
        .context("Rust 音频解码器不可用")?;

    // When decoding to end of file (`duration` infinite), nothing is reserved in advance.
    let reserve = if duration.is_finite() {
        (duration.max(0.0) * f64::from(SAMPLE_RATE)) as usize * CHANNELS
    } else {
        0
    };
    let mut out: Vec<f32> = Vec::with_capacity(reserve);
    // The sample rate and channel count are only known at the first decoded frame; at that point the window boundaries are converted and the resampler is built.
    let mut state: Option<StreamState> = None;
    let mut reached_end = false;
    let mut decoded_packets = 0;
    // The interleave buffer is reused across packets; `copy_to_vec_interleaved` resizes it itself to the current frame size.
    let mut interleaved: Vec<f32> = Vec::new();
    loop {
        let packet = match format.next_packet() {
            Ok(Some(packet)) => packet,
            Ok(None) => break,
            Err(SymphoniaError::IoError(error))
                if error.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(SymphoniaError::ResetRequired) => {
                bail!("Rust 解码器要求重置，暂不支持动态音轨参数")
            }
            Err(error) => return Err(error).context("Rust 读取音频 packet 失败"),
        };
        if packet.track_id != track_id {
            continue;
        }
        decoded_packets += 1;
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(SymphoniaError::IoError(error))
                if error.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(error) => return Err(error).context("Rust 音频解码失败"),
        };
        let spec = decoded.spec();
        let channels = spec.channels().count();
        if channels == 0 {
            continue;
        }
        if channels > CHANNELS {
            bail!("Rust 解码路径不做 {channels} 声道下混（交给 ffmpeg 的 -ac 2）");
        }
        let state = match state.as_mut() {
            Some(state) if state.sample_rate != spec.rate() => {
                bail!("Rust 解码路径不支持解码期间采样率变化")
            }
            Some(state) if state.channels != channels => {
                bail!("Rust 解码路径不支持解码期间声道数变化")
            }
            Some(state) => state,
            None => state.insert(StreamState::new(
                spec.rate(),
                channels,
                start,
                duration,
                edit.map_or(0, |edit| edit.frames(spec.rate())),
            )?),
        };
        decoded.copy_to_vec_interleaved(&mut interleaved);
        for frame in interleaved.chunks_exact(channels) {
            let index = position;
            position += 1;
            if index < state.first_frame {
                continue;
            }
            if state.end_frame.is_some_and(|end| index >= end) {
                reached_end = true;
                break;
            }
            // Match ffmpeg's default mono-to-stereo matrix. Duplicating at
            // unity gain would double the power and make native output louder.
            let (left, right) = if channels == 1 {
                let value = frame[0] * std::f32::consts::FRAC_1_SQRT_2;
                (value, value)
            } else {
                (frame[0], frame[1])
            };
            state.resampler.push(left, right, &mut out);
        }
        if reached_end {
            break;
        }
    }
    let mut state = state.context("媒体没有可解码的音频帧")?;
    state.resampler.flush(&mut out);
    Ok((out, decoded_packets, state.channels))
}

struct StreamState {
    sample_rate: u32,
    channels: usize,
    /// Window boundaries in the decoded frame stream (end is exclusive), already counting the leading frames that the edit list says to drop.
    first_frame: u64,
    end_frame: Option<u64>,
    resampler: StereoResampler,
}

impl StreamState {
    /// `priming` is the number of decoded frames that the edit-list start converts to: presentation time 0 falls on this frame of the decoded stream.
    fn new(
        sample_rate: u32,
        channels: usize,
        start: f64,
        duration: f64,
        priming: u64,
    ) -> Result<Self> {
        if sample_rate == 0 {
            bail!("Rust 解码器报告了 0 采样率");
        }
        let rate = f64::from(sample_rate);
        let first_frame = priming + (start.max(0.0) * rate).round() as u64;
        let end_frame = (duration.is_finite() && duration > 0.0)
            .then(|| first_frame + (duration * rate).round() as u64);
        Ok(Self {
            sample_rate,
            channels,
            first_frame,
            end_frame,
            resampler: StereoResampler::new(sample_rate),
        })
    }
}

/// Stereo multi-phase windowed-sinc resampler: any source sample rate → [`SAMPLE_RATE`].
///
/// Both channels share the same kernel and the same phase cursor (the same interpolation point at the same instant), so no inter-channel phase difference is introduced. The filter is symmetric and zero-phase, so output sample n corresponds exactly to source time `n / SAMPLE_RATE` seconds within the window, consistent with the timeline of the ffmpeg fallback path.
struct StereoResampler {
    /// When the source rate equals the target, pass through with no filtering at all.
    passthrough: bool,
    /// Source-sample step per output sample = source sample rate / 48000.
    step: f64,
    /// Tap count per side (in source samples).
    half: usize,
    /// PHASE_COUNT kernels stored flat, each with 2*half+1 taps, DC gain normalized to 1.
    phases: Vec<f32>,
    /// Source samples within the window not yet consumed (interleaved stereo); only the tail still used by the convolution is kept.
    pending: Vec<f32>,
    /// Absolute index, in the window's source frame stream, of frame 0 of pending.
    pending_start: u64,
    /// Total number of in-window source frames received.
    received: u64,
    /// Index of the next output frame to produce.
    next_output: u64,
}

impl StereoResampler {
    fn new(source_rate: u32) -> Self {
        if source_rate == SAMPLE_RATE {
            return Self {
                passthrough: true,
                step: 1.0,
                half: 0,
                phases: Vec::new(),
                pending: Vec::new(),
                pending_start: 0,
                received: 0,
                next_output: 0,
            };
        }
        let step = f64::from(source_rate) / f64::from(SAMPLE_RATE);
        // When downsampling, the cutoff and taps are scaled together by the step to preserve stopband attenuation; when upsampling, the base is kept.
        let scale = step.max(1.0);
        let half = (BASE_HALF_TAPS as f64 * scale).ceil() as usize;
        let cutoff = CUTOFF_ROLLOFF * 0.5 / scale;
        let taps_len = 2 * half + 1;
        let mut phases = vec![0.0f32; PHASE_COUNT * taps_len];
        for phase in 0..PHASE_COUNT {
            let frac = phase as f64 / PHASE_COUNT as f64;
            let row = &mut phases[phase * taps_len..(phase + 1) * taps_len];
            let mut gain = 0.0f64;
            for (tap, slot) in row.iter_mut().enumerate() {
                let distance = tap as f64 - half as f64 - frac;
                let value = 2.0
                    * cutoff
                    * sinc(2.0 * cutoff * distance)
                    * blackman(distance / (half as f64 + 1.0));
                gain += value;
                *slot = value as f32;
            }
            let normalize = (1.0 / gain) as f32;
            for slot in row.iter_mut() {
                *slot *= normalize;
            }
        }
        Self {
            passthrough: false,
            step,
            half,
            phases,
            pending: Vec::new(),
            pending_start: 0,
            received: 0,
            next_output: 0,
        }
    }

    fn push(&mut self, left: f32, right: f32, output: &mut Vec<f32>) {
        if self.passthrough {
            output.push(left);
            output.push(right);
            return;
        }
        self.pending.push(left);
        self.pending.push(right);
        self.received += 1;
        self.drain(false, output);
    }

    /// After input ends, emit the remaining output; taps past the right edge are zero-padded.
    fn flush(&mut self, output: &mut Vec<f32>) {
        if self.passthrough {
            return;
        }
        self.drain(true, output);
        self.pending.clear();
    }

    fn drain(&mut self, flushing: bool, output: &mut Vec<f32>) {
        let taps_len = 2 * self.half + 1;
        let frames = |slice: &Vec<f32>| slice.len() / CHANNELS;
        loop {
            let center = self.next_output as f64 * self.step;
            if flushing && center >= self.received as f64 {
                break;
            }
            let center_floor = center.floor() as i64;
            let available_end = self.pending_start as i64 + frames(&self.pending) as i64;
            if !flushing && center_floor + self.half as i64 >= available_end {
                break;
            }
            let frac = center - center_floor as f64;
            let phase = ((frac * PHASE_COUNT as f64) as usize).min(PHASE_COUNT - 1);
            let kernel = &self.phases[phase * taps_len..(phase + 1) * taps_len];
            let first = center_floor - self.half as i64;
            let mut acc = [0.0f32; CHANNELS];
            for (tap, weight) in kernel.iter().enumerate() {
                // Out-of-range samples at the stream edges are zero-padded; the difference from ffmpeg's edge behavior is sub-millisecond only.
                let index = first + tap as i64 - self.pending_start as i64;
                if index >= 0 && (index as usize) < frames(&self.pending) {
                    let base = index as usize * CHANNELS;
                    acc[0] += self.pending[base] * weight;
                    acc[1] += self.pending[base + 1] * weight;
                }
            }
            output.extend_from_slice(&acc);
            self.next_output += 1;
            // Drop the prefix no longer needed to bound resident memory; move it in batches to amortize the copying cost.
            let keep_from = (self.next_output as f64 * self.step).floor() as i64 - self.half as i64;
            let drop = (keep_from - self.pending_start as i64).max(0) as usize;
            if drop >= 8192 {
                self.pending.drain(..drop * CHANNELS);
                self.pending_start += drop as u64;
            }
        }
    }
}

fn sinc(x: f64) -> f64 {
    if x.abs() < 1e-12 {
        1.0
    } else {
        let scaled = std::f64::consts::PI * x;
        scaled.sin() / scaled
    }
}

/// Blackman window; 0 when |u| >= 1.
fn blackman(u: f64) -> f64 {
    if u.abs() >= 1.0 {
        return 0.0;
    }
    let scaled = std::f64::consts::PI * u;
    0.42 + 0.5 * scaled.cos() + 0.08 * (2.0 * scaled).cos()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decoding_preserves_power_when_mapping_mono_and_stereo_to_stereo() {
        for channels in [1_u16, 2] {
            let file = tempfile::NamedTempFile::with_suffix(".wav").unwrap();
            let frames = 4800_u32;
            let size = frames * u32::from(channels) * 2;
            let mut wav = Vec::new();
            wav.extend_from_slice(b"RIFF");
            wav.extend_from_slice(&(size + 36).to_le_bytes());
            wav.extend_from_slice(b"WAVEfmt ");
            wav.extend_from_slice(&16_u32.to_le_bytes());
            wav.extend_from_slice(&1_u16.to_le_bytes());
            wav.extend_from_slice(&channels.to_le_bytes());
            wav.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
            wav.extend_from_slice(&(SAMPLE_RATE * u32::from(channels) * 2).to_le_bytes());
            wav.extend_from_slice(&(channels * 2).to_le_bytes());
            wav.extend_from_slice(&16_u16.to_le_bytes());
            wav.extend_from_slice(b"data");
            wav.extend_from_slice(&size.to_le_bytes());
            for _ in 0..frames {
                wav.extend_from_slice(&8192_i16.to_le_bytes());
                if channels == 2 {
                    wav.extend_from_slice(&(-16384_i16).to_le_bytes());
                }
            }
            std::fs::write(file.path(), wav).unwrap();
            let samples = decode_stereo_48k(file.path(), 0.02, 0.04).unwrap();
            assert_eq!(samples.len(), 1920 * 2);
            let expected_power = if channels == 1 { 0.0625 } else { 0.3125 };
            for frame in samples.chunks_exact(2) {
                let power = frame[0].powi(2) + frame[1].powi(2);
                assert!(
                    (power - expected_power).abs() < 1e-6,
                    "{channels} channels: decoded power {power}, expected {expected_power}"
                );
                if channels == 1 {
                    assert_eq!(frame[0], frame[1]);
                } else {
                    assert_eq!(frame, &[0.25, -0.5]);
                }
            }
        }
    }

    fn native_export_fixture() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/native-export/source.mp4")
    }

    /// MP4 edit list: the bundled fixture is a 48 kHz mono AAC sine encoded by ffmpeg, with the track's `elst media_time 1024`. After dropping the leading frames, the frame count matches `ffmpeg -f f32le` (48128), and the sine is present within the first 20 ms. If they are not dropped, there are 1024 extra frames, and the first 21 ms are near-silence padded by the encoder (peak about 0.0035, here again multiplied by 1/√2).
    #[test]
    fn mp4_edit_list_priming_is_dropped_like_ffmpeg() {
        let fixture = native_export_fixture();
        let samples = decode_stereo_48k(&fixture, 0.0, 10.0).unwrap();
        assert_eq!(samples.len() / CHANNELS, 48_128, "帧数应与 ffmpeg 解码一致");
        let head = samples[..960 * CHANNELS]
            .iter()
            .fold(0.0f32, |peak, value| peak.max(value.abs()));
        assert!(head > 0.05, "头 20 ms 峰值 {head}：前置帧没丢掉");
        // The window start is likewise measured from presentation time 0: at 48 kHz pass-through, it is equal sample by sample.
        let window = decode_stereo_48k(&fixture, 0.5, 0.1).unwrap();
        assert_eq!(window, samples[24_000 * CHANNELS..28_800 * CHANNELS]);
    }

    #[test]
    fn indexed_aac_windows_seek_without_changing_samples_or_resampling() {
        let directory = tempfile::tempdir().unwrap();
        for rate in [44_100, 48_000] {
            let path = directory.path().join(format!("indexed-{rate}.m4a"));
            let source = format!("anoisesrc=sample_rate={rate}:duration=12:seed=42");
            let encoded = crate::exec::command("ffmpeg")
                .args(["-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i"])
                .arg(source)
                .args(["-ac", "2", "-c:a", "aac", "-b:a", "192k", "-aac_pns", "0"])
                .arg(&path)
                .status();
            if !encoded.is_ok_and(|status| status.success()) {
                eprintln!("跳过：这台机器没有能编 AAC 的 ffmpeg");
                return;
            }
            // Non-packet-aligned boundaries, including the final padded packet
            // and an out-of-range seek which must recover the sequential EOF.
            for (start, duration) in [(10.373, 0.213), (11.873, 1.0), (20.0, 0.1)] {
                let (reference, sequential_packets) =
                    decode_window(&path, start, duration, false).unwrap();
                let (window, seek_packets) = decode_window(&path, start, duration, true).unwrap();
                assert_eq!(window, reference, "{rate} Hz at {start}s");
                if start < 12.0 {
                    assert!(
                        seek_packets * 5 < sequential_packets,
                        "decoded {seek_packets} packets instead of {sequential_packets}"
                    );
                }
            }
        }
    }

    #[test]
    #[ignore = "read-only benchmark; set CCUT_PERF_MEDIA to a long AAC MP4"]
    fn late_audio_window_benchmark() {
        let path = std::env::var("CCUT_PERF_MEDIA").expect("CCUT_PERF_MEDIA");
        let path = Path::new(&path);
        let before = std::time::Instant::now();
        let (reference, sequential_packets) = decode_window(path, 3058.8, 84.7, false).unwrap();
        let sequential_ms = before.elapsed().as_secs_f64() * 1000.0;
        let before = std::time::Instant::now();
        let (window, seek_packets) = decode_window(path, 3058.8, 84.7, true).unwrap();
        let seek_ms = before.elapsed().as_secs_f64() * 1000.0;
        assert_eq!(window.len(), reference.len());
        let max_diff = window
            .iter()
            .zip(&reference)
            .map(|(a, b)| (a - b).abs())
            .fold(0.0_f32, f32::max);
        let difference_power = window
            .iter()
            .zip(&reference)
            .map(|(a, b)| f64::from(a - b).powi(2))
            .sum::<f64>();
        let signal_power = reference
            .iter()
            .map(|value| f64::from(*value).powi(2))
            .sum::<f64>();
        let snr = 10.0 * (signal_power / difference_power).log10();
        assert!(seek_packets * 20 < sequential_packets);
        eprintln!(
            "audio window: sequential={sequential_ms:.1}ms/{sequential_packets} packets, seek={seek_ms:.1}ms/{seek_packets} packets, max_diff={max_diff}, snr={snr:.1}dB"
        );
        // This source uses AAC PNS; exact random samples cannot survive seek.
        // Bound the total deviation and verify zero sample lag independently.
        assert!(snr > 40.0, "snr={snr:.1}dB");
        let from = 10 * SAMPLE_RATE as usize * CHANNELS;
        let length = SAMPLE_RATE as usize * CHANNELS;
        let correlation = |lag: isize| -> f64 {
            (from..from + length)
                .step_by(CHANNELS)
                .map(|index| {
                    f64::from(reference[index])
                        * f64::from(window[(index as isize + lag * CHANNELS as isize) as usize])
                })
                .sum()
        };
        let best = (-32..=32)
            .max_by(|a, b| correlation(*a).total_cmp(&correlation(*b)))
            .unwrap();
        assert_eq!(best, 0, "audio seek introduced a sample offset");
    }

    /// The original scene from the report: a 44.1 kHz source encoded to M4A by `ffmpeg -c:a aac` (1024 leading frames).
    /// The pure-Rust path and the ffmpeg fallback path must decode to 48 kHz PCM with zero time offset. Before the fix, the Rust path was 1115 frames late (1024 × 48000 / 44100 ≈ 23.2 ms). Skipped if no ffmpeg able to encode AAC is available.
    #[test]
    fn an_ffmpeg_aac_m4a_decodes_with_zero_lag_against_ffmpeg() {
        let directory = tempfile::tempdir().unwrap();
        let wav = directory.path().join("noise.wav");
        let m4a = directory.path().join("noise.m4a");
        let rate = 44_100_u32;
        let frames = rate; // 1 second
        let size = frames * 2;
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(size + 36).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16_u32.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&rate.to_le_bytes());
        bytes.extend_from_slice(&(rate * 2).to_le_bytes());
        bytes.extend_from_slice(&2_u16.to_le_bytes());
        bytes.extend_from_slice(&16_u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&size.to_le_bytes());
        // Fixed-seed white noise: the cross-correlation peak is sharp and unique.
        let mut seed = 0x2545_f491_u32;
        for _ in 0..frames {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            bytes.extend_from_slice(&((seed >> 16) as i16 / 4).to_le_bytes());
        }
        std::fs::write(&wav, bytes).unwrap();
        let encoded = crate::exec::command("ffmpeg")
            .args(["-nostdin", "-loglevel", "error", "-y", "-i"])
            .arg(&wav)
            .args(["-c:a", "aac", "-b:a", "192k"])
            .arg(&m4a)
            .status();
        if !encoded.is_ok_and(|status| status.success()) {
            eprintln!("跳过：这台机器没有能编 AAC 的 ffmpeg");
            return;
        }
        let native = decode_stereo_48k(&m4a, 0.0, 1.0).unwrap();
        let reference = super::super::decode_with_ffmpeg("noise", &m4a, 0.0, 1.0, 1.0).unwrap();
        let left =
            |samples: &[f32]| -> Vec<f32> { samples.iter().step_by(CHANNELS).copied().collect() };
        let (native, reference) = (left(&native), left(&reference));
        // Take the middle 0.25 s and cross-correlate it against the reference at each offset, searching ±1500 frames (covering both the 1115 and 2112 leading-frame cases).
        let (from, len, reach) = (12_000_usize, 12_000_usize, 1_500_i64);
        let correlation = |lag: i64| -> f64 {
            (0..len)
                .map(|offset| {
                    let at = from + offset;
                    let shifted = at as i64 + lag;
                    let value = usize::try_from(shifted)
                        .ok()
                        .and_then(|index| native.get(index))
                        .copied()
                        .unwrap_or(0.0);
                    f64::from(reference[at]) * f64::from(value)
                })
                .sum()
        };
        let (best, _) = (-reach..=reach)
            .map(|lag| (lag, correlation(lag)))
            .max_by(|a, b| a.1.total_cmp(&b.1))
            .unwrap();
        assert_eq!(best, 0, "纯 Rust 路径相对 ffmpeg 晚 {best} 帧（48 kHz）");
    }

    /// Target sample rate pass-through: no sample is touched, and no delay is introduced.
    #[test]
    fn a_matching_sample_rate_passes_samples_through_untouched() {
        let mut resampler = StereoResampler::new(SAMPLE_RATE);
        let mut out = Vec::new();
        resampler.push(0.25, -0.5, &mut out);
        resampler.push(1.0, 0.0, &mut out);
        resampler.flush(&mut out);
        assert_eq!(out, vec![0.25, -0.5, 1.0, 0.0]);
    }

    /// 44.1k → 48k: the output frame count scales proportionally (±1 frame boundary margin), and the DC level is unchanged.
    #[test]
    fn upsampling_preserves_level_and_scales_the_frame_count() {
        let source_rate = 44_100_u32;
        let frames = source_rate as usize / 10; // 0.1 second
        let mut resampler = StereoResampler::new(source_rate);
        let mut out = Vec::new();
        for _ in 0..frames {
            resampler.push(0.5, -0.5, &mut out);
        }
        resampler.flush(&mut out);
        let produced = out.len() / CHANNELS;
        let expected = frames * SAMPLE_RATE as usize / source_rate as usize;
        assert!(
            produced.abs_diff(expected) <= 1,
            "输出 {produced} 帧，期望约 {expected} 帧"
        );
        // Each end has half a window of zero-padded transition band, so take the middle to verify the level.
        let middle = produced / 2 * CHANNELS;
        assert!(
            (out[middle] - 0.5).abs() < 1e-3,
            "左声道电平 {}",
            out[middle]
        );
        assert!(
            (out[middle + 1] + 0.5).abs() < 1e-3,
            "右声道电平 {}",
            out[middle + 1]
        );
    }

    /// 96k → 48k: downsampling is likewise proportional, and the left and right channels do not crosstalk.
    #[test]
    fn downsampling_keeps_the_channels_independent() {
        let source_rate = 96_000_u32;
        let frames = source_rate as usize / 10;
        let mut resampler = StereoResampler::new(source_rate);
        let mut out = Vec::new();
        for _ in 0..frames {
            resampler.push(1.0, 0.0, &mut out);
        }
        resampler.flush(&mut out);
        let produced = out.len() / CHANNELS;
        assert!(produced.abs_diff(frames / 2) <= 1, "输出 {produced} 帧");
        let middle = produced / 2 * CHANNELS;
        assert!((out[middle] - 1.0).abs() < 1e-3, "左声道 {}", out[middle]);
        assert!(out[middle + 1].abs() < 1e-3, "右声道应保持静音");
    }

    /// Sine fidelity: a 1 kHz sine at 44.1k resampled to 48k has an RMS matching the theoretical value (high frequencies are not clipped away, and the whole signal is not attenuated).
    #[test]
    fn a_sine_keeps_its_energy_across_the_rate_change() {
        let source_rate = 44_100_u32;
        let frames = source_rate as usize / 2; // 0.5 second
        let mut resampler = StereoResampler::new(source_rate);
        let mut out = Vec::new();
        for index in 0..frames {
            let phase = std::f64::consts::TAU * 1000.0 * index as f64 / f64::from(source_rate);
            let value = phase.sin() as f32;
            resampler.push(value, value, &mut out);
        }
        resampler.flush(&mut out);
        // Trim 10 ms from each end, past the transition band, before measuring RMS.
        let skip = SAMPLE_RATE as usize / 100 * CHANNELS;
        let core = &out[skip..out.len() - skip];
        let rms = (core
            .iter()
            .map(|v| f64::from(*v) * f64::from(*v))
            .sum::<f64>()
            / core.len() as f64)
            .sqrt();
        assert!(
            (rms - std::f64::consts::FRAC_1_SQRT_2).abs() < 0.02,
            "重采样后的 RMS {rms:.4} 偏离正弦理论值 0.7071"
        );
    }
}
