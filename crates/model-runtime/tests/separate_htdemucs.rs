//! HTDemucs-FT real-weight separation (ported from v2's `htdemucs_smoke`, plus a speech-and-synthetic-bass mix): the same set of tests runs against MLX (`mlx::`, Apple Silicon) and against candle (`candle::`, with `backend-candle` enabled; default device, CPU or CUDA). When both are compiled in, the vocal outputs of the two backends are compared once more (`parity::`).
//!
//! ```sh
//! CUCCUT_TEST_MODELS_DIR="$HOME/Library/Application Support/CucCut/models" \
//!   cargo test -p model-runtime --features backend-candle --test separate_htdemucs -- --ignored --test-threads=1 --nocapture
//! ```
//!
//! If the weights are absent (no `CUCCUT_TEST_MODELS_DIR` or no `.ccut-manifest.json`), the reason is printed and the test is skipped. The model directory is read-only.
//! With `CUCCUT_REQUIRE_CUDA=1`, candle must get CUDA and must not silently fall back to CPU (same as v2's `CCUT_REQUIRE_CUDA`).

#![cfg(any(
    feature = "backend-candle",
    all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64")
))]

use std::path::{Path, PathBuf};
use std::time::Instant;

use model_runtime::bundle::{FAMILY_HTDEMUCS_FT, FileEntry, ModelFiles, VerifiedFiles};
use model_runtime::separate::types::{SeparationProgress, StereoAudio};
use model_runtime::separate::{self, Separator, resample::resample, wav};
use serde_json::Value;

const REPO: &str = "aufklarer/HTDemucs-FT-MLX";

/// Builds and validates the file manifest from `<models-root>/<repo>/.ccut-manifest.json`; returns `None` and prints the reason if the weights are absent.
fn verified() -> Option<VerifiedFiles> {
    let Some(root) = std::env::var_os("CUCCUT_TEST_MODELS_DIR") else {
        println!("skipped: CUCCUT_TEST_MODELS_DIR is not set");
        return None;
    };
    let dir = PathBuf::from(root).join(REPO);
    let Ok(bytes) = std::fs::read(dir.join(".ccut-manifest.json")) else {
        println!("skipped: {} has no .ccut-manifest.json (weights not installed)", dir.display());
        return None;
    };
    let manifest: Value = serde_json::from_slice(&bytes).expect("manifest JSON");
    let files = manifest["files"]
        .as_array()
        .expect("manifest files")
        .iter()
        .map(|file| FileEntry {
            path: file["path"].as_str().expect("path").to_owned(),
            sha256: file["sha256"].as_str().unwrap_or_default().to_owned(),
            byte_length: file["size"].as_u64().expect("size"),
        })
        .collect();
    Some(
        ModelFiles {
            family: FAMILY_HTDEMUCS_FT.to_owned(),
            revision: manifest["revision"].as_str().unwrap_or_default().to_owned(),
            dir: dir.to_string_lossy().into_owned(),
            files,
        }
        .verify("separator")
        .expect("verify bundle files"),
    )
}

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
fn load_mlx() -> Option<Box<dyn Separator>> {
    let files = verified()?;
    let started = Instant::now();
    let separator = separate::load_separator(&files).expect("load HTDemucs");
    println!("HTDemucs-FT (MLX): loaded in {:.2} s", started.elapsed().as_secs_f32());
    Some(separator)
}

#[cfg(feature = "backend-candle")]
fn load_candle() -> Option<Box<dyn Separator>> {
    let device = model_runtime::backend::candle::default_device();
    if std::env::var("CUCCUT_REQUIRE_CUDA").ok().as_deref() == Some("1") {
        assert!(device.is_cuda(), "CUCCUT_REQUIRE_CUDA=1 forbids silent fallback to CPU");
    }
    let files = verified()?;
    let started = Instant::now();
    let label = model_runtime::backend::candle::device_label(&device);
    let separator = separate::load_candle_separator(&files, device).expect("load HTDemucs");
    println!("HTDemucs-FT (candle {label}): loaded in {:.2} s", started.elapsed().as_secs_f32());
    Some(separator)
}

fn synth(len: usize, rate: u32) -> StereoAudio {
    let sine = |f: f32, phase: f32| -> Vec<f32> {
        (0..len)
            .map(|i| {
                let t = i as f32 / rate as f32;
                0.3 * (2.0 * std::f32::consts::PI * f * t + phase).sin() + 0.2 * (2.0 * std::f32::consts::PI * 3.0 * f * t).sin()
            })
            .collect()
    };
    StereoAudio {
        left: sine(220.0, 0.0),
        right: sine(220.0, 0.5),
        sample_rate: rate,
    }
}

/// Pearson correlation coefficient.
fn correlation(a: &[f32], b: &[f32]) -> f64 {
    let n = a.len().min(b.len());
    let mean = |x: &[f32]| x[..n].iter().map(|v| f64::from(*v)).sum::<f64>() / n as f64;
    let (ma, mb) = (mean(a), mean(b));
    let (mut cov, mut va, mut vb) = (0.0, 0.0, 0.0);
    for i in 0..n {
        let (x, y) = (f64::from(a[i]) - ma, f64::from(b[i]) - mb);
        cov += x * y;
        va += x * x;
        vb += y * y;
    }
    cov / (va.sqrt() * vb.sqrt()).max(1e-12)
}

/// Expands the same set of tests once for one backend's loading function.
macro_rules! separation_tests {
    ($backend:ident, $load:path) => {
        mod $backend {
            use super::*;

            /// v2 smoke test: 48 kHz input goes through resampling; the four stems are equal length and finite, and their sum roughly reconstructs the mix; the first callback returning `false` must produce an error.
            #[test]
            #[ignore = "needs installed models (CUCCUT_TEST_MODELS_DIR)"]
            fn separates_short_clip_and_reconstructs_mix() {
                let Some(mut separator) = $load() else { return };
                assert_eq!(separator.sample_rate(), 44_100);

                // 2-second 48 kHz input: goes through the resampling path, and the output should be 44.1 kHz.
                let mix = synth(96_000, 48_000);
                let mut windows_seen = 0;
                let stems = separator
                    .separate(&mix, &mut |p| {
                        if let SeparationProgress::Window { done, total } = p {
                            assert!(done <= total);
                            windows_seen = done;
                        }
                        true
                    })
                    .expect("separate");
                assert!(windows_seen > 0);
                let expected_len = (96_000.0 * 44_100.0 / 48_000.0_f64).round() as usize;
                for stem in [&stems.vocals, &stems.drums, &stems.bass, &stems.other] {
                    assert_eq!(stem.sample_rate, 44_100);
                    assert_eq!(stem.len(), expected_len);
                    assert!(stem.left.iter().all(|v| v.is_finite()));
                }

                // The sum of the four stems should roughly reconstruct the mix (each sub-model predicts independently, so some residual is allowed).
                let resampled_left = resample(&mix.left, 48_000, 44_100);
                let sum: Vec<f32> = (0..expected_len)
                    .map(|i| stems.vocals.left[i] + stems.drums.left[i] + stems.bass.left[i] + stems.other.left[i])
                    .collect();
                let energy: f32 = resampled_left.iter().map(|v| v * v).sum();
                let residual: f32 = sum.iter().zip(&resampled_left).map(|(a, b)| (a - b) * (a - b)).sum();
                assert!(residual / energy < 0.5, "residual energy ratio {}", residual / energy);

                // Cancellation: the first callback returning false must produce an error.
                let err = separator.separate(&mix, &mut |_| false).expect_err("cancellation should return an error");
                assert!(err.to_string().contains("取消"), "{err}");
            }

            /// An English speech clip (16 kHz fixture, upsampled to 44.1 kHz) overlaid with a synthetic bass (82 Hz + second harmonic): the vocals should follow the speech, and the background should follow the bass.
            #[test]
            #[ignore = "needs installed models (CUCCUT_TEST_MODELS_DIR)"]
            fn splits_speech_from_a_synthetic_bass_line() {
                let Some(mut separator) = $load() else { return };
                let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/test-sample.wav");
                let speech16 = wav::read_wav(&fixture).expect("read fixture");
                assert_eq!(speech16.sample_rate, 16_000);
                let speech = resample(&speech16.left, 16_000, 44_100);
                let tone: Vec<f32> = (0..speech.len())
                    .map(|i| {
                        let t = i as f32 / 44_100.0;
                        0.15 * (std::f32::consts::TAU * 82.41 * t).sin() + 0.08 * (std::f32::consts::TAU * 164.82 * t).sin()
                    })
                    .collect();
                let mixed: Vec<f32> = speech.iter().zip(&tone).map(|(s, t)| s + t).collect();
                let mix = StereoAudio {
                    left: mixed.clone(),
                    right: mixed,
                    sample_rate: 44_100,
                };
                let started = Instant::now();
                let stems = separator.separate(&mix, &mut |_| true).expect("separate");
                let seconds = mix.duration_seconds();
                println!("{seconds:.2} s mix separated in {:.2} s", started.elapsed().as_secs_f32());
                let vocals = stems.vocals.to_mono();
                let background = stems.background().to_mono();
                let vs = correlation(&vocals, &speech);
                let vt = correlation(&vocals, &tone);
                let bt = correlation(&background, &tone);
                let bs = correlation(&background, &speech);
                println!("correlations: vocals~speech {vs:.3}, vocals~bass {vt:.3}, background~bass {bt:.3}, background~speech {bs:.3}");
                assert!(vs > 0.95, "vocals should follow speech: {vs:.3}");
                assert!(bt > 0.95, "background should follow bass: {bt:.3}");
                assert!(vt.abs() < 0.1, "vocals should not contain bass: {vt:.3}");
                assert!(bs.abs() < 0.1, "background should not contain speech: {bs:.3}");
            }

            /// The self-check sample (the same 16 kHz English speech, mono, upsampled to 44.1 kHz) contains only vocals: vocal RMS must be at least 2× the background. This is the same threshold `models.test` uses to judge separation model packs (Model Worker protocol spec §4.3).
            #[test]
            #[ignore = "needs installed models (CUCCUT_TEST_MODELS_DIR)"]
            fn pure_speech_lands_in_vocals() {
                let Some(mut separator) = $load() else { return };
                let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/test-sample.wav");
                let speech16 = wav::read_wav(&fixture).expect("read fixture");
                let speech = resample(&speech16.left, 16_000, 44_100);
                let mix = StereoAudio {
                    left: speech.clone(),
                    right: speech,
                    sample_rate: 44_100,
                };
                let stems = separator.separate(&mix, &mut |_| true).expect("separate");
                let rms = |x: &[f32]| (x.iter().map(|v| f64::from(*v) * f64::from(*v)).sum::<f64>() / x.len().max(1) as f64).sqrt();
                let vocals = rms(&stems.vocals.to_mono());
                let background = rms(&stems.background().to_mono());
                let db = 20.0 * (vocals / background.max(1e-12)).log10();
                println!("speech only: vocals RMS {vocals:.4}, background RMS {background:.4}, vocals {db:.1} dB above background");
                assert!(vocals >= 0.001, "vocals should not be silent: {vocals:.4}");
                assert!(
                    vocals >= 2.0 * background,
                    "vocals should be clearly above background: {vocals:.4} vs {background:.4}"
                );
            }
        }
    };
}

#[cfg(all(feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
separation_tests!(mlx, load_mlx);

#[cfg(feature = "backend-candle")]
separation_tests!(candle, load_candle);

/// Signal-to-distortion ratio (dB): the error energy of `estimate` relative to `reference`.
#[cfg(all(feature = "backend-candle", feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
fn sdr(reference: &[f32], estimate: &[f32]) -> f64 {
    let n = reference.len().min(estimate.len());
    let signal: f64 = reference[..n].iter().map(|v| f64::from(*v).powi(2)).sum();
    let noise: f64 = reference[..n]
        .iter()
        .zip(&estimate[..n])
        .map(|(r, e)| (f64::from(*r) - f64::from(*e)).powi(2))
        .sum();
    10.0 * (signal / noise.max(1e-20)).log10()
}

/// Both backends read the same weights and compute the same graph: the vocals and background of the same mix should be nearly identical (candle's CPU f32 versus MLX's Metal f32 differ only in floating-point accumulation order).
#[cfg(all(feature = "backend-candle", feature = "backend-mlx", target_os = "macos", target_arch = "aarch64"))]
#[test]
#[ignore = "needs installed models (CUCCUT_TEST_MODELS_DIR)"]
fn candle_matches_mlx_on_speech_over_bass() {
    let Some(mut mlx) = load_mlx() else { return };
    let Some(mut candle) = load_candle() else { return };
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/test-sample.wav");
    let speech16 = wav::read_wav(&fixture).expect("read fixture");
    let speech = resample(&speech16.left, 16_000, 44_100);
    let mixed: Vec<f32> = speech
        .iter()
        .enumerate()
        .map(|(i, s)| s + 0.15 * (std::f32::consts::TAU * 82.41 * i as f32 / 44_100.0).sin())
        .collect();
    let mix = StereoAudio {
        left: mixed.clone(),
        right: mixed,
        sample_rate: 44_100,
    };
    let started = Instant::now();
    let reference = mlx.separate(&mix, &mut |_| true).expect("MLX separation");
    let mlx_seconds = started.elapsed().as_secs_f32();
    let started = Instant::now();
    let estimate = candle.separate(&mix, &mut |_| true).expect("candle separation");
    let candle_seconds = started.elapsed().as_secs_f32();
    let vocals = sdr(&reference.vocals.to_mono(), &estimate.vocals.to_mono());
    let background = sdr(&reference.background().to_mono(), &estimate.background().to_mono());
    println!(
        "{:.2} s mix: MLX {mlx_seconds:.2} s, candle {candle_seconds:.2} s; candle vs MLX SDR: vocals {vocals:.1} dB, background {background:.1} dB",
        mix.duration_seconds()
    );
    assert!(vocals > 40.0, "vocals differ too much from MLX: {vocals:.1} dB");
    assert!(background > 40.0, "background differs too much from MLX: {background:.1} dB");
}
