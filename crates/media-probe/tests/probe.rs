//! Self-tests for the pure Rust probe, plus cross-checks against `ffprobe`.
//!
//! Existing repo assets (`tests/fixtures/`) are asserted directly; video/WebM fixtures are generated with ffmpeg on the fly, and **if ffmpeg is not detected the test silently skips** (the same convention as the media pipeline tests in `ccut-render`).

use std::path::{Path, PathBuf};
use std::process::Command;

use media_probe::{MediaKind, ProbeBackend, probe, probe_with_fallback};

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn have(tool: &str) -> bool {
    Command::new(tool)
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

#[test]
fn video_bitrate_matches_track_bytes_instead_of_audio_and_container() {
    let Some(dir) = video_fixtures() else {
        return;
    };
    let path = dir.join("clip.mp4");
    let native = probe(&path).unwrap();
    let rate = native.video_bitrate(&path).unwrap();
    let external = media_probe::probe_with_ffprobe(&path, Path::new("ffprobe")).unwrap();
    let expected = external.video.unwrap().bitrate.unwrap();
    assert!(
        (rate - expected).abs() / expected < 0.01,
        "{rate} vs {expected}"
    );
    let total =
        std::fs::metadata(&path).unwrap().len() as f64 * 8.0 / native.positive_duration().unwrap();
    assert!(rate < total);
    let mut unavailable = native.clone();
    unavailable.video.as_mut().unwrap().bitrate = None;
    assert_eq!(unavailable.video_bitrate(&path), Some(total));
    unavailable.duration_seconds = Some(f64::NAN);
    assert_eq!(unavailable.video_bitrate(&path), None);
}

/// Generates a one-off fixture directory (idempotent across processes: an existing file with the same name is reused).
fn ff(args: &[&str]) -> bool {
    Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error"])
        .args(args)
        .status()
        .is_ok_and(|status| status.success())
}

/// Fixture directory; returns `None` if ffmpeg is not present (the caller skips).
fn video_fixtures() -> Option<PathBuf> {
    if !have("ffmpeg") {
        eprintln!("skipping: no ffmpeg in PATH");
        return None;
    }
    let dir = std::env::temp_dir().join("ccut-media-probe-fixtures");
    std::fs::create_dir_all(&dir).ok()?;

    let mp4 = dir.join("clip.mp4");
    if !mp4.exists() {
        assert!(ff(&[
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=640x360:rate=30:duration=2",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-shortest",
            mp4.to_str()?,
        ]));
    }

    let silent = dir.join("silent.mp4");
    if !silent.exists() {
        assert!(ff(&[
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=320x240:rate=25:duration=1",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            silent.to_str()?,
        ]));
    }

    let rotated = dir.join("rotated-display-matrix.mp4");
    if !rotated.exists()
        && !ff(&[
            // FFmpeg 7+ writes the MP4 tkhd display matrix using the input-level `-display_rotation`; for older versions that do not recognize this parameter, only the rotation case is skipped.
            "-display_rotation",
            "90",
            "-i",
            silent.to_str()?,
            "-c",
            "copy",
            rotated.to_str()?,
        ])
    {
        let _ = std::fs::remove_file(&rotated);
    }

    let alpha = dir.join("alpha.webm");
    if !alpha.exists() {
        // `yuva420p` + libvpx-vp9 ⇒ Matroska's `AlphaMode` gets written.
        // If this machine's ffmpeg was built without libvpx-vp9, generation fails, and the alpha case is skipped.
        let _ = ff(&[
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=160x120:rate=24:duration=1",
            "-vf",
            "format=yuva420p,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='128'",
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuva420p",
            alpha.to_str()?,
        ]);
    }

    let opaque = dir.join("opaque.webm");
    if !opaque.exists() {
        let _ = ff(&[
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=160x120:rate=24:duration=1",
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuv420p",
            opaque.to_str()?,
        ]);
    }

    Some(dir)
}

#[test]
fn wav_fixture_reports_audio_only() {
    let path = fixtures().join("speech/test-sample.wav");
    let probed = probe(&path).expect("the WAV fixture must be probeable in pure Rust");
    assert_eq!(probed.kind, MediaKind::Audio);
    assert!(probed.video.is_none());
    let audio = probed.audio.as_ref().expect("WAV must have an audio track");
    assert_eq!(audio.sample_rate, Some(16_000));
    assert_eq!(audio.channels, Some(1));
    let duration = probed.positive_duration().expect("WAV must have a duration");
    assert!(duration > 0.5, "{duration}");
}

#[test]
fn missing_file_is_an_error_and_has_no_ffprobe_fallback() {
    let directory = tempfile::tempdir().expect("tempdir");
    let path = directory.path().join("nope.wav");
    assert!(probe(&path).is_err());
    assert!(probe_with_fallback(&path, None).is_err());
}

#[test]
fn png_reports_image_kind_and_dimensions() {
    let directory = tempfile::tempdir().expect("tempdir");
    let path = directory.path().join("card.png");
    let buffer = image::RgbaImage::from_pixel(48, 17, image::Rgba([9, 9, 9, 255]));
    buffer.save(&path).expect("write PNG fixture");

    let probed = probe(&path).expect("PNG must be probeable in pure Rust");
    assert_eq!(probed.kind, MediaKind::Image);
    assert_eq!(probed.dimensions(), Some((48, 17)));
    assert_eq!(probed.duration_seconds, None);
    assert!(!probed.has_audio());
}

#[test]
fn mp4_reports_video_geometry_audio_and_fps() {
    let Some(dir) = video_fixtures() else { return };
    let probed = probe(&dir.join("clip.mp4")).expect("MP4 must be probeable in pure Rust");
    assert_eq!(probed.kind, MediaKind::Video);
    assert_eq!(probed.dimensions(), Some((640, 360)));
    assert!(probed.has_audio());
    let fps = probed.fps().expect("MP4 must report its frame rate");
    assert!((fps - 30.0).abs() < 0.01, "{fps}");
    let duration = probed.positive_duration().expect("MP4 must have a duration");
    assert!((duration - 2.0).abs() < 0.1, "{duration}");
    let video = probed.video.as_ref().expect("video");
    assert_eq!(video.codec.as_deref(), Some("h264"));
    assert!(!video.alpha);

    let silent = probe(&dir.join("silent.mp4")).expect("MP4 without an audio track");
    assert!(!silent.has_audio());
    assert_eq!(silent.dimensions(), Some((320, 240)));
}

#[test]
fn rotated_mp4_keeps_encoded_dimensions_and_adds_display_dimensions() {
    let Some(dir) = video_fixtures() else { return };
    let rotated = dir.join("rotated-display-matrix.mp4");
    if !rotated.exists() {
        eprintln!("skipping: this machine's ffmpeg does not support the -display_rotation fixture");
        return;
    }
    let probed = probe(&rotated).expect("rotated MP4 must be probeable in pure Rust");
    assert_eq!(
        probed.dimensions(),
        Some((320, 240)),
        "naturalW/H is still the coded size without rotation"
    );
    assert_eq!(
        probed.display_dimensions(),
        Some((240, 320)),
        "display size should be rotated upright by 90°"
    );
}

#[test]
fn webm_alpha_mode_is_visible_without_ffprobe() {
    let Some(dir) = video_fixtures() else { return };
    let alpha = dir.join("alpha.webm");
    if !alpha.exists() {
        eprintln!("skipping: this machine's ffmpeg cannot produce a libvpx-vp9 yuva420p WebM");
        return;
    }
    let probed = probe(&alpha).expect("WebM must be probeable in pure Rust");
    assert_eq!(probed.kind, MediaKind::Video);
    assert_eq!(probed.dimensions(), Some((160, 120)));
    let video = probed.video.as_ref().expect("video");
    assert_eq!(video.codec.as_deref(), Some("vp9"));
    assert!(video.alpha, "WebM with alpha must be detected");
    let fps = probed.fps().expect("WebM must report its frame rate");
    assert!((fps - 24.0).abs() < 0.01, "{fps}");

    let opaque = dir.join("opaque.webm");
    if opaque.exists() {
        let probed = probe(&opaque).expect("opaque WebM");
        assert!(!probed.video.expect("video").alpha);
    }
}

/// Cross-check: for the same file, the key fields from the native and ffprobe paths must match.
#[test]
fn native_matches_ffprobe() {
    if !have("ffprobe") {
        eprintln!("skipping: no ffprobe in PATH");
        return;
    }
    let ffprobe = Path::new("ffprobe");
    let mut targets = vec![fixtures().join("speech/test-sample.wav")];
    if let Some(dir) = video_fixtures() {
        targets.push(dir.join("clip.mp4"));
        targets.push(dir.join("silent.mp4"));
        let rotated = dir.join("rotated-display-matrix.mp4");
        if rotated.exists() {
            targets.push(rotated);
        }
        for name in ["alpha.webm", "opaque.webm"] {
            let path = dir.join(name);
            if path.exists() {
                targets.push(path);
            }
        }
    }

    for target in targets {
        let native =
            probe(&target).unwrap_or_else(|error| panic!("{}: {error:#}", target.display()));
        let reference = media_probe::probe_with_ffprobe(&target, ffprobe)
            .unwrap_or_else(|error| panic!("{}: {error:#}", target.display()));
        let label = target.display();

        assert_eq!(native.kind, reference.kind, "{label} kind");
        assert_eq!(
            native.has_audio(),
            reference.has_audio(),
            "{label} hasAudio"
        );
        assert_eq!(native.dimensions(), reference.dimensions(), "{label} dimensions");
        assert_eq!(
            native.display_dimensions(),
            reference.display_dimensions(),
            "{label} display dimensions"
        );

        match (native.duration_seconds, reference.duration_seconds) {
            (Some(a), Some(b)) => assert!((a - b).abs() <= 0.05, "{label} duration {a} != {b}"),
            (a, b) => assert_eq!(a, b, "{label} duration availability"),
        }
        match (native.fps(), reference.fps()) {
            (Some(a), Some(b)) => assert!((a - b).abs() <= 0.01, "{label} fps {a} != {b}"),
            (None, None) => {}
            (a, b) => panic!("{label} fps availability {a:?} != {b:?}"),
        }
        assert_eq!(
            native.video.as_ref().map(|video| video.alpha),
            reference.video.as_ref().map(|video| video.alpha),
            "{label} alpha"
        );
        assert_eq!(
            native.video.as_ref().and_then(|video| video.codec.clone()),
            reference
                .video
                .as_ref()
                .and_then(|video| video.codec.clone()),
            "{label} video codec"
        );
    }
}

/// Containers that pure Rust cannot parse (AVI) fall back to ffprobe, and the backend marker is reported accurately.
#[test]
fn unsupported_container_falls_back_to_ffprobe() {
    let Some(dir) = video_fixtures() else { return };
    if !have("ffprobe") {
        eprintln!("skipping: no ffprobe in PATH");
        return;
    }
    let avi = dir.join("clip.avi");
    if !avi.exists()
        && !ff(&[
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=320x240:rate=25:duration=1",
            "-c:v",
            "mpeg4",
            avi.to_str().expect("path"),
        ])
    {
        eprintln!("skipping: this machine's ffmpeg cannot produce the AVI fixture");
        return;
    }
    assert!(probe(&avi).is_err(), "AVI is outside pure Rust coverage");
    let (probed, backend) =
        probe_with_fallback(&avi, Some(Path::new("ffprobe"))).expect("ffprobe fallback");
    assert_eq!(backend, ProbeBackend::Ffprobe);
    assert_eq!(probed.kind, MediaKind::Video);
    assert_eq!(probed.dimensions(), Some((320, 240)));
}

#[test]
fn native_backend_is_reported_when_pure_rust_succeeds() {
    let path = fixtures().join("speech/test-sample.wav");
    let (_, backend) = probe_with_fallback(&path, Some(Path::new("ffprobe"))).expect("WAV");
    assert_eq!(backend, ProbeBackend::Native);
}
