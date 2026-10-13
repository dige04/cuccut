//! Native MP4 write acceptance (WP6b).
//!
//! Per `docs/design/bcf/cuccut-format-spec.md` §15.1 and the `studio_export` tests in `apps/cli`, **the bytes of export encoding do not promise to be reproducible**. So what is asserted here is existence, frame count and duration tolerance, dimensions, backend identifier, semantic color predicates, and audio RMS/frequency, **with no pixel golden**.
//!
//! All material is generated programmatically (segmented solid colors plus horizontal-gradient RGBA frames, and sine PCM), without depending on ffmpeg. Fixture generation and judging are entirely in this repository's hands. When the encoder is unavailable, the test is skipped per repository convention.

use std::path::Path;

use media_native::{RgbaFrame, encode_available, encode_backend, extract_frame_rgba};

mod common;

/// Output geometry: even width and height (a hard requirement of H.264 4:2:0).
const WIDTH: u32 = 320;
const HEIGHT: u32 = 180;
const FPS: f64 = 30.0;
/// Three solid-color segments of 1 second each, in the order red / green / blue.
const SEGMENT_SECONDS: f64 = 1.0;
const SEGMENTS: usize = 3;
const TOTAL_FRAMES: usize = (SEGMENT_SECONDS as usize) * SEGMENTS * (FPS as usize);
const TOTAL_SECONDS: f64 = SEGMENT_SECONDS * SEGMENTS as f64;

/// The frequency and amplitude of the sine tone. 440 Hz stays far from any folding point of 48 kHz, so after an AAC round trip it is still a clean spectral line. An amplitude of 0.5 does not trigger the encoder's clipping protection.
const TONE_HZ: f64 = 440.0;
const TONE_AMPLITUDE: f32 = 0.5;

/// RGBA of frame `index`: takes the dominant color of its segment, and lays a 0.2 → 1.0 linear luminance ramp across it horizontally.
///
/// The ramp serves the same purpose as the decode-side fixture (`common::fixture`). Solid-color pictures are a pathological input for compression and similarity judgment. Giving the structure term some content lets the color predicate measure "whether this segment is that color".
fn frame_rgba(index: usize) -> Vec<u8> {
    let segment = (index / (FPS as usize)).min(SEGMENTS - 1);
    let base = match segment {
        0 => [235_u8, 20, 20],
        1 => [20, 235, 20],
        _ => [20, 20, 235],
    };
    let mut data = Vec::with_capacity(WIDTH as usize * HEIGHT as usize * 4);
    for _ in 0..HEIGHT {
        for x in 0..WIDTH {
            let ramp = 0.2 + 0.8 * f64::from(x) / f64::from(WIDTH);
            for channel in base {
                data.push((f64::from(channel) * ramp).round().clamp(0.0, 255.0) as u8);
            }
            data.push(255);
        }
    }
    data
}

/// The whole sine PCM (raw f32le, 48 kHz, interleaved stereo), written to a temporary file.
fn write_tone_pcm(path: &Path) {
    let frames = (TOTAL_SECONDS * f64::from(media_native::AUDIO_SAMPLE_RATE)) as usize;
    let mut bytes = Vec::with_capacity(frames * 8);
    for frame in 0..frames {
        let t = frame as f64 / f64::from(media_native::AUDIO_SAMPLE_RATE);
        let value = (TONE_AMPLITUDE as f64 * (std::f64::consts::TAU * TONE_HZ * t).sin()) as f32;
        for _ in 0..media_native::AUDIO_CHANNELS {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    std::fs::write(path, bytes).expect("write sine PCM");
}

/// Writes a test MP4. Returns `None` when the encoder is unavailable (repository convention: no backend is not a failure).
fn write_fixture(out: &Path, audio: Option<&Path>) -> Option<()> {
    if !encode_available() {
        return None;
    }
    let mut writer = match media_native::open_mp4_writer(out, WIDTH, HEIGHT, FPS, audio) {
        Ok(writer) => writer,
        // There is no usable H.264 / AAC encoder on this machine, so skip rather than fail.
        Err(error) if format!("{error:#}").contains("unsupported") => return None,
        Err(error) => panic!("failed to open native MP4 writer: {error:#}"),
    };
    assert_eq!(writer.backend(), encode_backend());
    for index in 0..TOTAL_FRAMES {
        writer.write_frame(&frame_rgba(index)).expect("write frame");
    }
    writer.finish().expect("finish MP4");
    Some(())
}

/// Decodes back the whole audio track (48 kHz interleaved stereo f32).
fn decode_audio(path: &Path) -> Vec<f32> {
    use symphonia::core::codecs::audio::AudioDecoderOptions;
    use symphonia::core::formats::probe::Hint;
    use symphonia::core::formats::{FormatOptions, TrackType};
    use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
    use symphonia::core::meta::MetadataOptions;

    let file = std::fs::File::open(path).expect("open output");
    let stream = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());
    let mut hint = Hint::new();
    hint.with_extension("mp4");
    let mut format = symphonia::default::get_probe()
        .probe(
            &hint,
            stream,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .expect("demux output");
    let track = format
        .first_track_known_codec(TrackType::Audio)
        .expect("output should have an audio track");
    let track_id = track.id;
    let params = track
        .codec_params
        .as_ref()
        .and_then(|params| params.audio())
        .expect("audio codec parameters")
        .clone();
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(&params, &AudioDecoderOptions::default())
        .expect("AAC decoder");
    let mut interleaved = Vec::new();
    let mut out = Vec::new();
    while let Ok(Some(packet)) = format.next_packet() {
        if packet.track_id != track_id {
            continue;
        }
        let Ok(decoded) = decoder.decode(&packet) else {
            continue;
        };
        let channels = decoded.spec().channels().count();
        assert_eq!(channels, 2, "output audio track should be stereo");
        decoded.copy_to_vec_interleaved(&mut interleaved);
        out.extend_from_slice(&interleaved);
    }
    out
}

/// The RMS of the left channel over the window `[start, end)` seconds, and the fundamental frequency derived from the zero-crossing rate.
fn tone_metrics(samples: &[f32], start: f64, end: f64) -> (f64, f64) {
    let rate = f64::from(media_native::AUDIO_SAMPLE_RATE);
    let first = (start * rate) as usize;
    let last = ((end * rate) as usize).min(samples.len() / 2);
    assert!(last > first, "no samples in the window");
    let left: Vec<f64> = (first..last).map(|i| f64::from(samples[i * 2])).collect();
    let rms = (left.iter().map(|value| value * value).sum::<f64>() / left.len() as f64).sqrt();
    // Zero-crossing count: a sine crosses zero exactly twice per period, once up and once down. Noise at this SNR does not add extra crossings.
    let crossings = left
        .windows(2)
        .filter(|pair| (pair[0] < 0.0) != (pair[1] < 0.0))
        .count();
    let seconds = left.len() as f64 / rate;
    (rms, crossings as f64 / 2.0 / seconds)
}

#[test]
fn the_native_writer_produces_a_probeable_mp4_with_the_requested_geometry() {
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("video-only.mp4");
    if write_fixture(&out, None).is_none() {
        eprintln!("skipping: no native MP4 encoding backend on this platform");
        return;
    }
    assert!(out.is_file(), "output should exist");
    assert!(std::fs::metadata(&out).unwrap().len() > 0, "output should not be empty");

    let probe = media_probe::probe(&out).expect("probe output");
    assert_eq!(probe.dimensions(), Some((WIDTH, HEIGHT)));
    let duration = probe.positive_duration().expect("output should have a duration");
    assert!(
        (duration - TOTAL_SECONDS).abs() <= 0.1,
        "duration should be within ±0.1 s: {duration}"
    );
    assert!(!probe.has_audio(), "no audio track should be written without audio parameters");
    let fps = probe.fps().expect("output should have a frame rate");
    assert!((fps - FPS).abs() <= 0.05, "frame rate should be the requested one: {fps}");
}

#[test]
fn each_colour_segment_decodes_back_to_its_own_dominant_channel() {
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("segments.mp4");
    if write_fixture(&out, None).is_none() {
        eprintln!("skipping: no native MP4 encoding backend on this platform");
        return;
    }
    // Take the midpoint of each segment, avoiding the segment boundaries (where the encoder's B-frame references may mix two segments).
    for (index, expected) in ["red", "green", "blue"].iter().enumerate() {
        let time = index as f64 * SEGMENT_SECONDS + SEGMENT_SECONDS / 2.0;
        let frame: RgbaFrame = extract_frame_rgba(&out, time, WIDTH).expect("decode a single frame back");
        assert_eq!(frame.width, WIDTH);
        assert_eq!(frame.height, HEIGHT);
        assert_eq!(
            common::dominant(&frame),
            *expected,
            "the dominant colour at t={time:.2}s should be {expected}"
        );
    }
}

#[test]
fn the_mixed_audio_track_survives_the_aac_round_trip() {
    let dir = tempfile::tempdir().unwrap();
    let pcm = dir.path().join("mix.f32le");
    write_tone_pcm(&pcm);
    let out = dir.path().join("with-audio.mp4");
    if write_fixture(&out, Some(&pcm)).is_none() {
        eprintln!("skipping: no native MP4 encoding backend on this platform");
        return;
    }
    let probe = media_probe::probe(&out).expect("probe output");
    assert!(probe.has_audio(), "an audio track should be written when PCM is given");
    let duration = probe.positive_duration().expect("output should have a duration");
    assert!(
        (duration - TOTAL_SECONDS).abs() <= 0.1,
        "duration with audio should likewise be within ±0.1 s: {duration}"
    );

    let samples = decode_audio(&out);
    assert!(!samples.is_empty(), "audio track should decode to samples");
    // Trim 0.3 seconds from each end. The encoder's AAC warm-up samples and the trailing zero padding both lie within those two parts.
    let (rms, frequency) = tone_metrics(&samples, 0.3, TOTAL_SECONDS - 0.3);
    let expected_rms = f64::from(TONE_AMPLITUDE) / std::f64::consts::SQRT_2;
    assert!(
        (rms - expected_rms).abs() <= 0.05,
        "RMS should be close to {expected_rms:.3}, got {rms:.3}"
    );
    assert!(
        (frequency - TONE_HZ).abs() <= 5.0,
        "fundamental should be close to {TONE_HZ} Hz, got {frequency:.1}"
    );
}

#[test]
fn the_encode_backend_label_matches_platform_availability() {
    if cfg!(target_os = "macos") {
        assert_eq!(encode_backend(), "avfoundation");
        assert!(encode_available());
    } else if cfg!(target_os = "windows") {
        assert_eq!(encode_backend(), "media-foundation");
        assert!(encode_available());
    } else {
        assert!(!encode_available());
        assert_eq!(encode_backend(), "none");
    }
}

/// Written at 29.97 fps, it must read back as 30000/1001, not 30. AVAssetWriter's default 600 timescale rounds the frame duration of 1001/30000 to 20/600, and the next export step laid out the grid at 30 fps based on that (measured on a podcast Shorts clip).
#[test]
fn ntsc_frame_rates_survive_the_container_timebase() {
    if !encode_available() {
        eprintln!("skipping: no native MP4 encoding backend on this platform");
        return;
    }
    let dir = tempfile::tempdir().expect("temporary directory");
    let out = dir.path().join("ntsc.mp4");
    let fps = 30000.0 / 1001.0;
    let mut writer = match media_native::open_mp4_writer(&out, WIDTH, HEIGHT, fps, None) {
        Ok(writer) => writer,
        Err(error) if format!("{error:#}").contains("unsupported") => return,
        Err(error) => panic!("failed to open native MP4 writer: {error:#}"),
    };
    for index in 0..60 {
        writer.write_frame(&frame_rgba(index)).expect("write frame");
    }
    writer.finish().expect("finish");
    let probe = media_probe::probe(&out).expect("probe output");
    let read = probe.fps().expect("output should have a frame rate");
    assert!((read - fps).abs() < 1e-6, "29.97 read back as {read}");
}
