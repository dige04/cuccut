//! Byte-for-byte golden for fixed PCM → BCS1.
//!
//! The fixture `tests/fixtures/spectrum/tone-48k-mono-f32.wav` is a 48 kHz, mono, **32-bit float** WAV. Decoding it to f32 PCM is an identity transform, with no resampling or integer quantization, so symphonia and ffmpeg receive identical samples, and the golden does not drift depending on whether CI has ffmpeg. The golden's `flags` are fixed at backend = symphonia (bit0 = 0).
//!
//! This test parses the WAV itself (20 lines of byte reading) and **does not depend on symphonia**. `waveform` is a pure-function crate with no I/O, and it should not pull a decoder into the dependency tree just to run tests. The end-to-end check “real decoder → same golden” is covered by the spectrum integration test in `apps/cli`.
//!
//! Regenerate: `CCUT_UPDATE_GOLDEN=1 cargo test -p waveform --test spectrum_golden`

use std::path::{Path, PathBuf};

use waveform::bcs1::{self, SpectrumBackend};
use waveform::dsp;

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/spectrum")
}

fn updating() -> bool {
    std::env::var("CCUT_UPDATE_GOLDEN").is_ok_and(|value| value != "0")
}

/// 48 kHz mono 32-bit float WAV → f32 PCM. Only accepts the one layout the fixture uses.
fn decode_float32_wav(bytes: &[u8]) -> Vec<f32> {
    assert_eq!(&bytes[..4], b"RIFF", "fixture is not RIFF");
    assert_eq!(&bytes[8..12], b"WAVE", "fixture is not WAVE");
    let mut offset = 12;
    let mut format = None;
    while offset + 8 <= bytes.len() {
        let id = &bytes[offset..offset + 4];
        let size = u32::from_le_bytes(bytes[offset + 4..offset + 8].try_into().unwrap()) as usize;
        let body = &bytes[offset + 8..offset + 8 + size];
        match id {
            b"fmt " => {
                let tag = u16::from_le_bytes(body[0..2].try_into().unwrap());
                let channels = u16::from_le_bytes(body[2..4].try_into().unwrap());
                let rate = u32::from_le_bytes(body[4..8].try_into().unwrap());
                let bits = u16::from_le_bytes(body[14..16].try_into().unwrap());
                assert_eq!(
                    (tag, channels, rate, bits),
                    (3, 1, 48_000, 32),
                    "fixture layout changed"
                );
                format = Some(());
            }
            b"data" => {
                assert!(format.is_some(), "data appears before fmt");
                return body
                    .chunks_exact(4)
                    .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
                    .collect();
            }
            _ => {}
        }
        offset += 8 + size + (size & 1);
    }
    panic!("fixture has no data chunk");
}

#[test]
fn the_fixture_tone_matches_the_bcs1_golden_byte_for_byte() {
    let wav = std::fs::read(fixtures().join("tone-48k-mono-f32.wav")).unwrap();
    let pcm = decode_float32_wav(&wav);
    assert_eq!(pcm.len(), 9600, "fixture should be 0.2 s @ 48 kHz");

    let produced = dsp::analyze(&pcm, SpectrumBackend::Symphonia).unwrap();
    let golden_path = fixtures().join("tone-48k-mono-f32.bcs1");
    if updating() {
        std::fs::write(&golden_path, &produced).unwrap();
    }
    let golden = std::fs::read(&golden_path).unwrap_or_else(|error| {
        panic!(
            "failed to read {}: {error}; regenerate with CCUT_UPDATE_GOLDEN=1",
            golden_path.display()
        )
    });
    assert_eq!(
        produced.len(),
        golden.len(),
        "BCS1 length changed: DSP parameters or frame-count semantics were modified; if intended, regenerate with CCUT_UPDATE_GOLDEN=1"
    );
    if let Some(offset) = produced.iter().zip(&golden).position(|(a, b)| a != b) {
        panic!(
            "BCS1 byte {offset} differs ({} != {}): this is a pixel-level semantic change; \
             regenerate with CCUT_UPDATE_GOLDEN=1 only after confirming it is intended",
            produced[offset], golden[offset]
        );
    }

    // Structural facts of the golden: 12 frames, backend fixed to symphonia, and the silent segment really is silent.
    let view = bcs1::parse(&golden).unwrap();
    let header = view.header();
    assert_eq!(header.frame_count, 12);
    assert_eq!(header.backend, SpectrumBackend::Symphonia);
    assert_eq!(u16::from_le_bytes(golden[6..8].try_into().unwrap()), 0);
    assert_eq!(header.content_hash, dsp::content_hash(&pcm));
    assert_eq!(header.duration_seconds(), 0.2);
    // Frame 0 lies entirely within the first 2400 silent samples (window length 1024), so its time-domain row is all 128.
    assert!(view.time_row(0).unwrap()[..100].iter().all(|&b| b == 128));
    // Frame 8 starts at sample 6400, inside the sounding section, so its time domain must leave the centre.
    assert!(view.time_row(8).unwrap().iter().any(|&b| b != 128));
}

#[test]
fn the_golden_survives_a_parse_encode_round_trip() {
    let golden = std::fs::read(fixtures().join("tone-48k-mono-f32.bcs1")).unwrap();
    let view = bcs1::parse(&golden).unwrap();
    let mut payload = Vec::new();
    for frame in 0..view.frame_count() {
        payload.extend_from_slice(view.frame(frame).unwrap());
    }
    assert_eq!(bcs1::encode(&view.header(), &payload).unwrap(), golden);
}
