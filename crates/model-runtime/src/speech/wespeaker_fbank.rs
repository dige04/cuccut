//! The backend-independent parts of WeSpeaker ResNet34-LM: the fbank front end, the network shape constants and the cosine distance. Ported from v2 `ccut-speech`.
//!
//! Unlike the Whisper front end in `mel.rs`, the speaker embedding uses Kaldi-style fbank: pre-emphasis 0.97, a Hamming window, the HTK mel scale (fmin=20 Hz), natural log, and CMN along the time axis (subtracting the mean of each mel bin). CMN cannot be omitted; without it all the embeddings collapse onto each other.
//!
//! All of this is pure CPU f32 computation. The MLX backend (`backend::mlx::wespeaker`) uses it, and later backends share the same implementation, so the front-end parameters do not drift apart across backends.

use std::sync::Arc;

use anyhow::{Context, Result};
use realfft::{RealFftPlanner, RealToComplex};

use super::mel::TimeMajorMelFeatures;

/// The model accepts only 16 kHz mono input.
pub const SAMPLE_RATE: u32 = 16_000;
/// Embedding dimension.
pub const EMBEDDING_DIM: usize = 256;
/// Audio shorter than 0.5 seconds is not embedded, because statistical pooling is unstable at that length.
pub const MINIMUM_SAMPLES: usize = 8_000;

/// fbank frame length (samples).
pub const N_FFT: usize = 400;
/// fbank frame shift (samples).
pub const HOP_LENGTH: usize = 160;
/// Number of fbank mel channels.
pub const N_MELS: usize = 80;

/// Output dimension of statistical pooling (mean‖std): 256 channels × 10 frequency bins × 2.
pub const POOLING_OUTPUT_DIM: usize = 5_120;
/// After three stride-2 stages, the frequency axis goes from 80 to 10.
pub const POOLED_FREQUENCY: usize = 10;

const PADDED_FFT: usize = 512;
const FREQUENCY_BINS: usize = PADDED_FFT / 2 + 1;
const MEL_MINIMUM_HERTZ: f32 = 20.0;
const PRE_EMPHASIS: f32 = 0.97;
/// vDSP's `vDSP_fft_zrip` output is twice the standard DFT, so the power is 4 times larger. CMN cancels this constant entirely; it is kept only so that values match the Swift reference implementation exactly.
const VDSP_POWER_SCALE: f32 = 4.0;
const LOG_FLOOR: f32 = 1e-10;

/// The WeSpeaker 80-dimensional log-mel fbank front end (CPU, f32).
pub struct WeSpeakerFbank {
    window: Vec<f32>,
    /// `[FREQUENCY_BINS * N_MELS]`, bin-major, so that per-frame accumulation is easy.
    filterbank: Vec<f32>,
    fft: Arc<dyn RealToComplex<f32>>,
}

impl std::fmt::Debug for WeSpeakerFbank {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("WeSpeakerFbank")
            .field("n_fft", &N_FFT)
            .field("hop_length", &HOP_LENGTH)
            .field("n_mels", &N_MELS)
            .finish()
    }
}

impl Default for WeSpeakerFbank {
    fn default() -> Self {
        Self::new()
    }
}

impl WeSpeakerFbank {
    pub fn new() -> Self {
        // Symmetric Hamming (denominator n_fft-1), consistent with the pyannote/wespeaker inference pipeline; it is not Kaldi's default Povey window.
        let window = (0..N_FFT)
            .map(|index| 0.54 - 0.46 * (2.0 * std::f32::consts::PI * index as f32 / (N_FFT - 1) as f32).cos())
            .collect();
        Self {
            window,
            filterbank: make_htk_filterbank(),
            fft: RealFftPlanner::<f32>::new().plan_fft_forward(PADDED_FFT),
        }
    }

    /// Analysis window (for tests and diagnostics).
    pub fn window(&self) -> &[f32] {
        &self.window
    }

    /// HTK/Slaney-normalized filter bank, row-major `[bin][mel]`.
    pub fn filterbank(&self) -> &[f32] {
        &self.filterbank
    }

    /// Number of frames for a given sample count. With reflection padding of `n_fft/2` on each side, the last frame is not dropped.
    pub fn frame_count(sample_count: usize) -> usize {
        if sample_count == 0 {
            return 0;
        }
        sample_count / HOP_LENGTH + 1
    }

    /// Extracts `[T, 80]` time-major features (CMN already applied).
    pub fn extract(&self, audio: &[f32]) -> Result<TimeMajorMelFeatures> {
        if audio.is_empty() {
            return Ok(TimeMajorMelFeatures {
                data: Vec::new(),
                mel_bins: N_MELS,
                time_frames: 0,
            });
        }
        let count = audio.len();

        // 1. Pre-emphasis y[n] = x[n] - 0.97 * x[n-1]; the first sample passes through unchanged (following the Swift reference).
        let mut emphasized = vec![0.0_f32; count];
        emphasized[0] = audio[0];
        for index in 1..count {
            emphasized[index] = audio[index] - PRE_EMPHASIS * audio[index - 1];
        }

        // 2. Reflection padding of n_fft/2 on each side.
        let pad_length = N_FFT / 2;
        let mut padded = vec![0.0_f32; pad_length + count + pad_length];
        for (index, target) in padded[..pad_length].iter_mut().enumerate() {
            *target = emphasized[(pad_length - index).min(count - 1)];
        }
        padded[pad_length..pad_length + count].copy_from_slice(&emphasized);
        for index in 0..pad_length {
            padded[pad_length + count + index] = emphasized[count.saturating_sub(2 + index)];
        }

        // 3–5. Framing → windowing → zero-padding to 512 for the rFFT → power spectrum.
        let frame_count = (padded.len() - N_FFT) / HOP_LENGTH + 1;
        debug_assert_eq!(frame_count, Self::frame_count(count));
        let mut padded_frame = vec![0.0_f32; PADDED_FFT];
        let mut spectrum = self.fft.make_output_vec();
        let mut scratch = self.fft.make_scratch_vec();
        let mut mel = vec![0.0_f32; frame_count * N_MELS];

        for frame in 0..frame_count {
            let start = frame * HOP_LENGTH;
            for index in 0..N_FFT {
                padded_frame[index] = padded[start + index] * self.window[index];
            }
            padded_frame[N_FFT..].fill(0.0);
            self.fft
                .process_with_scratch(&mut padded_frame, &mut spectrum, &mut scratch)
                .context("run WeSpeaker 512-point real FFT")?;

            // 6. Projection onto the triangular filter bank.
            let output_row = &mut mel[frame * N_MELS..(frame + 1) * N_MELS];
            for (bin, value) in spectrum.iter().enumerate() {
                let power = VDSP_POWER_SCALE * (value.re * value.re + value.im * value.im);
                let filter_row = &self.filterbank[bin * N_MELS..(bin + 1) * N_MELS];
                for mel_bin in 0..N_MELS {
                    output_row[mel_bin] += power * filter_row[mel_bin];
                }
            }
        }

        // 7. Natural log (not Whisper's log10).
        for value in mel.iter_mut() {
            *value = value.max(LOG_FLOOR).ln();
        }

        // 8. CMN: subtract the time-axis mean of each mel bin.
        cepstral_mean_normalize(&mut mel, frame_count, N_MELS);

        Ok(TimeMajorMelFeatures {
            data: mel,
            mel_bins: N_MELS,
            time_frames: frame_count,
        })
    }
}

/// Triangular filter bank with the HTK mel scale (2595·log10(1+hz/700)), fmin=20 Hz, fmax=8000 Hz, with Slaney area normalization `2/(f[m+2]-f[m])`.
fn make_htk_filterbank() -> Vec<f32> {
    let hertz_to_mel = |hertz: f32| 2_595.0 * (1.0 + hertz / 700.0).log10();
    let mel_to_hertz = |mel: f32| 700.0 * (10.0_f32.powf(mel / 2_595.0) - 1.0);

    let maximum_hertz = SAMPLE_RATE as f32 / 2.0;
    let minimum_mel = hertz_to_mel(MEL_MINIMUM_HERTZ);
    let maximum_mel = hertz_to_mel(maximum_hertz);
    let point_count = N_MELS + 2;
    let step = (maximum_mel - minimum_mel) / (point_count - 1) as f32;
    let frequencies: Vec<f32> = (0..point_count)
        .map(|index| mel_to_hertz(minimum_mel + index as f32 * step))
        .collect();
    let differences: Vec<f32> = frequencies.windows(2).map(|pair| pair[1] - pair[0]).collect();

    let mut matrix = vec![0.0_f32; FREQUENCY_BINS * N_MELS];
    for bin in 0..FREQUENCY_BINS {
        let hertz = bin as f32 * SAMPLE_RATE as f32 / PADDED_FFT as f32;
        for mel in 0..N_MELS {
            let rising = (hertz - frequencies[mel]) / differences[mel];
            let falling = (frequencies[mel + 2] - hertz) / differences[mel + 1];
            let normalization = 2.0 / (frequencies[mel + 2] - frequencies[mel]);
            matrix[bin * N_MELS + mel] = rising.min(falling).max(0.0) * normalization;
        }
    }
    matrix
}

fn cepstral_mean_normalize(features: &mut [f32], frame_count: usize, bin_count: usize) {
    if frame_count == 0 || bin_count == 0 {
        return;
    }
    let mut means = vec![0.0_f64; bin_count];
    for frame in 0..frame_count {
        let row = &features[frame * bin_count..(frame + 1) * bin_count];
        for (bin, value) in row.iter().enumerate() {
            means[bin] += f64::from(*value);
        }
    }
    let scale = frame_count as f64;
    let means: Vec<f32> = means.iter().map(|sum| (sum / scale) as f32).collect();
    for frame in 0..frame_count {
        let row = &mut features[frame * bin_count..(frame + 1) * bin_count];
        for (bin, value) in row.iter_mut().enumerate() {
            *value -= means[bin];
        }
    }
}

/// Layer plan of the ResNet34 backbone: `(layer number, input channels, output channels, number of BasicBlocks)`.
/// The first block of each layer uses stride 2 when the channel count changes, downsampling both the frequency and time axes.
pub const RESNET_PLAN: [(usize, usize, usize, usize); 4] = [(1, 32, 32, 3), (2, 32, 64, 4), (3, 64, 128, 6), (4, 128, 256, 3)];

/// Cosine distance `1 - cos(a, b)`. Returns 2.0 (the maximum distance) when the lengths differ, when either vector is empty, or when a norm is too small.
pub fn cosine_distance(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 2.0;
    }
    let mut dot = 0.0_f64;
    let mut left = 0.0_f64;
    let mut right = 0.0_f64;
    for (x, y) in a.iter().zip(b) {
        dot += f64::from(*x) * f64::from(*y);
        left += f64::from(*x) * f64::from(*x);
        right += f64::from(*y) * f64::from(*y);
    }
    let denominator = left.sqrt() * right.sqrt();
    if denominator <= 1e-10 {
        return 2.0;
    }
    (1.0 - dot / denominator) as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_count_matches_reflect_padded_framing() {
        assert_eq!(WeSpeakerFbank::frame_count(16_000), 101);
        assert_eq!(WeSpeakerFbank::frame_count(8_000), 51);
        assert_eq!(WeSpeakerFbank::frame_count(0), 0);
    }

    #[test]
    fn cosine_distance_handles_degenerate_inputs() {
        assert_eq!(cosine_distance(&[1.0, 0.0], &[1.0, 0.0, 0.0]), 2.0);
        assert_eq!(cosine_distance(&[], &[]), 2.0);
        assert_eq!(cosine_distance(&[0.0, 0.0], &[1.0, 0.0]), 2.0);
        assert!((cosine_distance(&[1.0, 0.0], &[1.0, 0.0])).abs() < 1e-6);
        assert!((cosine_distance(&[1.0, 0.0], &[-1.0, 0.0]) - 2.0).abs() < 1e-6);
    }

    // ---- The following two are ported from v2 `ccut-speech/tests/frontend.rs` ----

    fn assert_close(actual: f32, expected: f32, tolerance: f32) {
        assert!((actual - expected).abs() <= tolerance, "{actual} != {expected} ± {tolerance}");
    }

    /// Deterministic pseudo-random test audio (linear congruential generator), bit-identical to the golden reference script.
    fn pseudo_random_audio(count: usize) -> Vec<f32> {
        let mut state = 12_345_u32;
        (0..count)
            .map(|_| {
                state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                (state >> 8) as f32 / 8_388_608.0 - 1.0
            })
            .collect()
    }

    #[test]
    fn wespeaker_fbank_matches_kaldi_reference() -> Result<()> {
        let fbank = WeSpeakerFbank::new();

        // Symmetric Hamming (denominator 399): the endpoints are 0.08, and the midpoint is close to 1.
        let window = fbank.window();
        assert_eq!(window.len(), 400);
        assert_close(window[0], 0.08, 1e-6);
        assert_close(window[399], 0.08, 1e-6);
        assert_close(window[199], 0.999_985_8, 1e-6);

        let audio = pseudo_random_audio(16_000);
        assert_close(audio[0], -0.959_194_66, 1e-6);

        let features = fbank.extract(&audio)?;
        // With reflection padding of 200 on each side the last frame is not dropped: (16000+400-400)/160+1 = 101.
        assert_eq!(features.time_frames, 101);
        assert_eq!(features.mel_bins, 80);
        assert_eq!(features.data.len(), 101 * 80);
        assert_eq!(WeSpeakerFbank::frame_count(16_000), 101);

        // After CMN, the mean of each mel bin along the time axis must be 0.
        for bin in 0..80 {
            let mean = (0..features.time_frames).map(|frame| features.data[frame * 80 + bin]).sum::<f32>() / features.time_frames as f32;
            assert!(mean.abs() < 1e-4, "CMN residual mean for bin {bin}: {mean}");
        }

        // NumPy independent reference implementation (pre-emphasis 0.97 / Hamming / HTK mel fmin=20 / ln / CMN).
        let times = [0_usize, 1, 5, 50, 100];
        let bins = [0_usize, 1, 7, 20, 40, 79];
        let expected = [
            3.558_4, 3.352, 1.292_831, 0.522_167, -1.033_338, -0.984_262, //
            1.155_988, 1.757_882, 0.931_735, 1.031_609, -1.717_376, 0.018_180, //
            -0.695_208, -1.849_046, 0.983_913, 0.645_739, -0.315_347, 0.304_023, //
            -0.256_786, -2.299_857, 0.990_178, -0.577_879, 0.708_347, -0.221_042, //
            1.753_836, 1.016_739, 1.177_642, -2.237_659, 0.229_697, 0.135_222,
        ];
        let mut index = 0;
        for time in times {
            for bin in bins {
                assert_close(features.data[time * 80 + bin], expected[index], 1e-3);
                index += 1;
            }
        }
        assert_eq!(index, expected.len());
        Ok(())
    }

    #[test]
    fn wespeaker_cosine_distance_is_scale_invariant() {
        let a = [0.6_f32, 0.8, 0.0];
        let scaled = [6.0_f32, 8.0, 0.0];
        assert!(cosine_distance(&a, &scaled).abs() < 1e-6);
        assert!((cosine_distance(&a, &[0.8, -0.6, 0.0]) - 1.0).abs() < 1e-6);
        assert_eq!(cosine_distance(&a, &[0.0, 0.0]), 2.0);
        assert_eq!(cosine_distance(&a, &[0.0, 0.0, 0.0]), 2.0);
    }
}
