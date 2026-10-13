//! Inside the `media` gate: this file uses `video::VideoWriter` / `FfmpegWriter` (the host byte layer) and does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Acceptance for the final-render encoder backend selection (WP6b): whether the MP4 is written by the native platform encoder or by ffmpeg.
//!
//! Symmetric with `decode_backends.rs`. Per `docs/design/bcf/cuccut-format-spec.md` §15.1, **the bytes of an exported encode are not promised to be reproducible**, so what is asserted here is the selection rule, that the artifact exists, its geometry, the duration tolerance and the backend identifier — no pixel golden.
//!
//! - macOS / Windows, even canvas → platform native (AVFoundation / Media Foundation)
//! - Linux (`media_native::encode_available()` is false) → ffmpeg fallback
//! - The ffmpeg fallback path must still write a compliant MP4 on its own (once the native path takes over it has no routine traffic, so it especially needs a test that pins it)

use std::path::Path;
use std::process::{Command, Stdio};

use render_raster::video::{FfmpegWriter, VideoWriter};

const WIDTH: u32 = 160;
const HEIGHT: u32 = 96;
const FPS: f64 = 30.0;
const FRAMES: usize = 60;
const SECONDS: f64 = FRAMES as f64 / FPS;

fn ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// A gradient per frame: brightness advances with the frame number, so the encoder does not compress the whole clip into one static GOP.
fn frame(index: usize) -> Vec<u8> {
    let level = (index * 3 % 200 + 40) as u8;
    let mut data = Vec::with_capacity(WIDTH as usize * HEIGHT as usize * 4);
    for _ in 0..HEIGHT {
        for x in 0..WIDTH as usize {
            let ramp = (x * 255 / WIDTH as usize) as u8;
            data.extend_from_slice(&[level, ramp, 255 - level, 255]);
        }
    }
    data
}

fn assert_playable(out: &Path) {
    assert!(out.is_file(), "output file should exist");
    let probe = media_probe::probe(out).expect("probe the output");
    assert_eq!(probe.dimensions(), Some((WIDTH, HEIGHT)));
    let duration = probe.positive_duration().expect("output should have a duration");
    assert!(
        (duration - SECONDS).abs() <= 0.1,
        "duration should be within ±0.1s: {duration}"
    );
}

#[test]
fn the_writer_picks_the_platform_backend_when_one_exists() {
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("native.mp4");
    let mut writer = match VideoWriter::open(&out, WIDTH, HEIGHT, FPS, None) {
        Ok(writer) => writer,
        // Neither a native encoder nor ffmpeg is available: skip, per repository convention.
        Err(_) => {
            eprintln!("skipping: this machine has neither a native encoder nor ffmpeg");
            return;
        }
    };
    let backend = writer.backend();
    if media_native::encode_available() {
        assert_eq!(
            backend,
            media_native::encode_backend(),
            "should not fall back to ffmpeg when a native backend exists"
        );
    } else {
        assert_eq!(backend, "ffmpeg", "without a native backend it must be ffmpeg");
    }
    for index in 0..FRAMES {
        writer.write_frame(&frame(index)).expect("write frame");
    }
    writer.finish().expect("finish writing");
    assert_playable(&out);
}

#[test]
fn the_ffmpeg_fallback_still_writes_a_conforming_mp4() {
    if !ffmpeg_available() {
        eprintln!("skipping: this machine has no ffmpeg");
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("ffmpeg.mp4");
    let mut writer = FfmpegWriter::new(&out, WIDTH, HEIGHT, FPS, None).expect("start the ffmpeg writer");
    for index in 0..FRAMES {
        writer.write_frame(&frame(index)).expect("write frame");
    }
    writer.finish().expect("finish writing");
    assert_playable(&out);
}

/// The closed set of backend identifier values: diagnostic output and `encodeBackend` in `ccut render --json` both read it; alias drift would silently break clients' checks.
#[test]
fn the_backend_label_is_one_of_the_three_known_values() {
    let backend = if media_native::encode_available() {
        media_native::encode_backend()
    } else {
        "ffmpeg"
    };
    assert!(
        matches!(backend, "avfoundation" | "media-foundation" | "ffmpeg"),
        "unknown encode backend identifier: {backend}"
    );
}
