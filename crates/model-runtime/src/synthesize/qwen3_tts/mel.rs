//! Partly implemented by rewriting speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3TTS/SpeakerEncoder.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` at the repo root.
//!
//! Input log-mel for the Speaker Encoder:
//! 24 kHz, n_fft 1024, hop 256, periodic Hann window, 128 HTK mel bins (0–12 kHz,
//! triangular filters without slaney normalization), reflection padding of n_fft/2, magnitude spectrum (not power spectrum),
//! `ln(max(mel, 1e-5))`. Pure Rust (realfft), compiles on all platforms.

use realfft::RealFftPlanner;
use realfft::num_complex::Complex;

pub const SAMPLE_RATE: u32 = 24_000;
pub const N_FFT: usize = 1024;
pub const HOP: usize = 256;
pub const N_MELS: usize = 128;
const F_MIN: f32 = 0.0;
const F_MAX: f32 = 12_000.0;

/// Log-mel in row-major `[frames, N_MELS]` layout.
pub struct LogMel {
    pub frames: usize,
    pub data: Vec<f32>,
}

fn hz_to_mel(hz: f32) -> f32 {
    2595.0 * (1.0 + hz / 700.0).log10()
}

fn mel_to_hz(mel: f32) -> f32 {
    700.0 * (10f32.powf(mel / 2595.0) - 1.0)
}

/// Triangular mel filterbank, row-major `[num_bins, N_MELS]`.
pub fn mel_filterbank() -> Vec<f32> {
    let num_bins = N_FFT / 2 + 1;
    let mel_min = hz_to_mel(F_MIN);
    let mel_max = hz_to_mel(F_MAX);
    let mel_points: Vec<f32> = (0..=(N_MELS + 1))
        .map(|i| mel_to_hz(mel_min + i as f32 * (mel_max - mel_min) / (N_MELS + 1) as f32))
        .collect();
    let mut fb = vec![0f32; num_bins * N_MELS];
    for m in 0..N_MELS {
        let f_low = mel_points[m];
        let f_center = mel_points[m + 1];
        let f_high = mel_points[m + 2];
        for k in 0..num_bins {
            let freq = k as f32 * SAMPLE_RATE as f32 / N_FFT as f32;
            if freq >= f_low && freq <= f_center && f_center > f_low {
                fb[k * N_MELS + m] = (freq - f_low) / (f_center - f_low);
            } else if freq > f_center && freq <= f_high && f_high > f_center {
                fb[k * N_MELS + m] = (f_high - freq) / (f_high - f_center);
            }
        }
    }
    fb
}

fn hann_window() -> Vec<f32> {
    (0..N_FFT)
        .map(|i| 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / N_FFT as f32).cos()))
        .collect()
}

/// Reflection padding (matches the reference implementation sample for sample).
fn reflect_pad(samples: &[f32]) -> Vec<f32> {
    let pad = N_FFT / 2;
    let n = samples.len();
    let mut padded = vec![0f32; pad + n + pad];
    for i in 0..pad {
        padded[pad - 1 - i] = samples[(i + 1).min(n - 1)];
    }
    padded[pad..pad + n].copy_from_slice(samples);
    for i in 0..pad {
        padded[pad + n + i] = samples[n.saturating_sub(2 + i)];
    }
    padded
}

/// Computes the log-mel of 24 kHz mono audio. Input must contain at least 1 sample.
pub fn compute(samples_24k: &[f32]) -> LogMel {
    if samples_24k.is_empty() {
        return LogMel {
            frames: 0,
            data: Vec::new(),
        };
    }
    let num_bins = N_FFT / 2 + 1;
    let padded = reflect_pad(samples_24k);
    let num_frames = (padded.len() - N_FFT) / HOP + 1;
    let window = hann_window();
    let fb = mel_filterbank();

    let mut planner = RealFftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(N_FFT);
    let mut input = fft.make_input_vec();
    let mut spectrum = fft.make_output_vec();
    let mut scratch = fft.make_scratch_vec();
    let mut magnitudes = vec![0f32; num_bins];
    let mut data = vec![0f32; num_frames * N_MELS];

    for frame in 0..num_frames {
        let start = frame * HOP;
        for i in 0..N_FFT {
            input[i] = padded[start + i] * window[i];
        }
        for c in spectrum.iter_mut() {
            *c = Complex::new(0.0, 0.0);
        }
        fft.process_with_scratch(&mut input, &mut spectrum, &mut scratch)
            .expect("realfft length matches");
        for (k, c) in spectrum.iter().enumerate() {
            magnitudes[k] = c.norm();
        }
        let row = &mut data[frame * N_MELS..(frame + 1) * N_MELS];
        for k in 0..num_bins {
            let mag = magnitudes[k];
            if mag == 0.0 {
                continue;
            }
            let fb_row = &fb[k * N_MELS..(k + 1) * N_MELS];
            for m in 0..N_MELS {
                row[m] += mag * fb_row[m];
            }
        }
        for v in row.iter_mut() {
            *v = v.max(1e-5).ln();
        }
    }
    LogMel { frames: num_frames, data }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filterbank_shape_and_peaks() {
        let fb = mel_filterbank();
        assert_eq!(fb.len(), (N_FFT / 2 + 1) * N_MELS);
        // Each filter's peak is ≤ 1, and none is empty
        for m in 0..N_MELS {
            let max = (0..(N_FFT / 2 + 1)).map(|k| fb[k * N_MELS + m]).fold(0f32, f32::max);
            assert!(max > 0.0 && max <= 1.0, "mel {m} max {max}");
        }
    }

    #[test]
    fn frame_count_matches_reference_formula() {
        let samples = vec![0f32; 24_000];
        let mel = compute(&samples);
        let expected = (24_000 + N_FFT - N_FFT) / HOP + 1;
        assert_eq!(mel.frames, expected);
        assert_eq!(mel.data.len(), expected * N_MELS);
        // Silence → ln(1e-5)
        assert!((mel.data[0] - (1e-5f32).ln()).abs() < 1e-6);
    }

    #[test]
    fn sine_lights_up_expected_mel() {
        let freq = 1000.0f32;
        let samples: Vec<f32> = (0..24_000)
            .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / 24_000.0).sin())
            .collect();
        let mel = compute(&samples);
        let frame = 40;
        let row = &mel.data[frame * N_MELS..(frame + 1) * N_MELS];
        let argmax = row.iter().enumerate().fold(0, |b, (i, v)| if *v > row[b] { i } else { b });
        // 1 kHz lies at about 1000 mel / (3823 mel total span) ≈ 34% along the HTK mel axis
        assert!((30..60).contains(&argmax), "argmax {argmax}");
        assert!(row[argmax] > 0.0);
    }

    #[test]
    fn reflect_pad_matches_reference_indexing() {
        let s = vec![1.0f32, 2.0, 3.0, 4.0, 5.0];
        let p = reflect_pad(&s);
        let pad = N_FFT / 2;
        assert_eq!(p[pad - 1], 2.0);
        assert_eq!(p[pad - 2], 3.0);
        assert_eq!(p[pad + 5], 4.0);
        assert_eq!(p[pad + 6], 3.0);
        assert_eq!(p[pad + 5 + 10], 1.0);
    }
}
