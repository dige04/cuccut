//! Parts of this are adapted from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/SpeechRestoration/SeamlessM4TFrontEnd.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the root directory.
//!
//! The three CPU front-end DSP routines for IndexTTS2 (all pure Rust + realfft, no dependency on MLX):
//!
//! - [`seamless_input_features`]: the SeamlessM4T log-mel front end for w2v-BERT 2.0,
//!   matching speech-swift `SpeechRestoration/SeamlessM4TFrontEnd.swift`.
//! - [`campplus_fbank`]: the 80-dim fbank for CAM++, matching the official
//!   `torchaudio.compliance.kaldi.fbank(num_mel_bins=80, dither=0)` (triangles in the mel domain;
//!   shares [`kaldi_mel_filterbank`] with the Seamless front end).
//! - [`torchaudio_resample`]: the default sinc-Hann resampling of `torchaudio.transforms.Resample`;
//!   the official code uses it to downsample the 22050 Hz speaker reference to 16 kHz. [`librosa_resample`] is the same kernel with a Kaiser window,
//!   fitted to match `librosa.load`'s default soxr_hq; it is used when reading reference audio.
//! - [`slaney_mel`]: the mel spectrogram with librosa's `norm='slaney'`, matching
//!   `MLXCommon/SlaneyMel.swift`; S2Mel's prompt mel uses it.
//!
//! All three return a row-major `[frames, bins]` `Vec<f32>`.

use realfft::RealFftPlanner;
use realfft::num_complex::Complex;

/// Runs rfft on a batch of frames that are already windowed and zero-padded to `n_fft`, returning the complex spectrum of each frame `[frames, n_fft/2+1]`.
fn rfft_frames(framed: &[f32], frames: usize, n_fft: usize) -> Vec<Complex<f32>> {
    let n_bins = n_fft / 2 + 1;
    let mut planner = RealFftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(n_fft);
    let mut input = fft.make_input_vec();
    let mut output = fft.make_output_vec();
    let mut spectrum = vec![Complex::new(0.0, 0.0); frames * n_bins];
    for t in 0..frames {
        input.copy_from_slice(&framed[t * n_fft..(t + 1) * n_fft]);
        fft.process(&mut input, &mut output).expect("rfft 尺寸匹配");
        spectrum[t * n_bins..(t + 1) * n_bins].copy_from_slice(&output);
    }
    spectrum
}

/// Povey window: `(0.5 - 0.5*cos(2πn/(N-1)))^0.85` (the 0.85 power of a symmetric Hann window).
fn povey_window(length: usize) -> Vec<f32> {
    let denom = (length - 1) as f32;
    (0..length)
        .map(|n| {
            let hann = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * n as f32 / denom).cos();
            hann.powf(0.85)
        })
        .collect()
}

// MARK: - SeamlessM4T（w2v-BERT 2.0）

pub const SEAMLESS_SAMPLE_RATE: u32 = 16_000;
pub const SEAMLESS_FRAME_LENGTH: usize = 400;
pub const SEAMLESS_HOP_LENGTH: usize = 160;
pub const SEAMLESS_FFT_LENGTH: usize = 512;
pub const SEAMLESS_NUM_MEL_BINS: usize = 80;
pub const SEAMLESS_STRIDE: usize = 2;
pub const SEAMLESS_FEATURE_DIM: usize = SEAMLESS_NUM_MEL_BINS * SEAMLESS_STRIDE;
const SEAMLESS_PREEMPHASIS: f32 = 0.97;
const SEAMLESS_MEL_FLOOR: f32 = 1.192_092_955_078_125e-7;
const SEAMLESS_NORM_EPSILON: f32 = 1e-7;
const SEAMLESS_MIN_FREQUENCY: f32 = 20.0;
const SEAMLESS_MAX_FREQUENCY: f32 = 8000.0;

fn hz_to_mel_kaldi(hz: f32) -> f32 {
    1127.0 * (1.0 + hz / 700.0).ln()
}

/// Kaldi-scale triangular mel filterbank, row-major `[257, 80]`, corresponding to
/// `mel_filter_bank(num_frequency_bins=256, num_mel_filters=80, min=20, max=8000,
/// sr=16000, norm=None, mel_scale="kaldi", triangularize_in_mel_space=True)`
/// followed by `np.pad(((0,1),(0,0)))`: row 256 is all zeros.
fn kaldi_mel_filterbank() -> Vec<f32> {
    let num_fft_freqs = 256usize;
    let n_mel = SEAMLESS_NUM_MEL_BINS;
    let sr = SEAMLESS_SAMPLE_RATE as f32;
    let mel_min = hz_to_mel_kaldi(SEAMLESS_MIN_FREQUENCY);
    let mel_max = hz_to_mel_kaldi(SEAMLESS_MAX_FREQUENCY);
    let filter_mel: Vec<f32> = (0..n_mel + 2)
        .map(|i| mel_min + (i as f32 / (n_mel + 1) as f32) * (mel_max - mel_min))
        .collect();
    let fft_bin_width = sr / (num_fft_freqs as f32 * 2.0);
    let fft_mel: Vec<f32> = (0..num_fft_freqs).map(|k| hz_to_mel_kaldi(fft_bin_width * k as f32)).collect();
    let rows = num_fft_freqs + 1;
    let mut fb = vec![0f32; rows * n_mel];
    for k in 0..num_fft_freqs {
        for m in 0..n_mel {
            let lower = filter_mel[m];
            let center = filter_mel[m + 1];
            let upper = filter_mel[m + 2];
            let s = fft_mel[k];
            let down = (s - lower) / (center - lower);
            let up = (upper - s) / (upper - center);
            fb[k * n_mel + m] = down.min(up).max(0.0);
        }
    }
    fb
}

/// 16 kHz mono → `input_features` (row-major `[frames, 160]`). When the input is shorter than one frame, returns `(empty, 0)`.
///
/// Steps: ×2^15 → framing (400/160, not centered) → per frame: remove DC, pre-emphasis, Povey window, 512-point rfft,
/// power spectrum → Kaldi mel (floored, then natural log) → normalize each mel bin over time with ddof=1 →
/// stack with a stride of 2.
pub fn seamless_input_features(audio: &[f32]) -> (Vec<f32>, usize) {
    if audio.len() < SEAMLESS_FRAME_LENGTH {
        return (Vec::new(), 0);
    }
    let frames = 1 + (audio.len() - SEAMLESS_FRAME_LENGTH) / SEAMLESS_HOP_LENGTH;
    if frames == 0 {
        return (Vec::new(), 0);
    }
    let n_fft = SEAMLESS_FFT_LENGTH;
    let n_bins = n_fft / 2 + 1;
    let window = povey_window(SEAMLESS_FRAME_LENGTH);
    let scale = 32768.0f32;

    let mut framed = vec![0f32; frames * n_fft];
    for t in 0..frames {
        let start = t * SEAMLESS_HOP_LENGTH;
        let frame = &mut framed[t * n_fft..t * n_fft + SEAMLESS_FRAME_LENGTH];
        for (i, value) in frame.iter_mut().enumerate() {
            *value = audio[start + i] * scale;
        }
        let mean = frame.iter().sum::<f32>() / SEAMLESS_FRAME_LENGTH as f32;
        for value in frame.iter_mut() {
            *value -= mean;
        }
        // Pre-emphasis: iterate from high to low index, so each neighbor read is still the value before the update.
        for i in (1..SEAMLESS_FRAME_LENGTH).rev() {
            frame[i] -= SEAMLESS_PREEMPHASIS * frame[i - 1];
        }
        frame[0] *= 1.0 - SEAMLESS_PREEMPHASIS;
        for (value, w) in frame.iter_mut().zip(window.iter()) {
            *value *= w;
        }
    }

    let spectrum = rfft_frames(&framed, frames, n_fft);
    let filters = kaldi_mel_filterbank();
    let n_mel = SEAMLESS_NUM_MEL_BINS;
    let mut log_mel = vec![0f32; frames * n_mel];
    let mut power = vec![0f32; n_bins];
    for t in 0..frames {
        for (b, value) in power.iter_mut().enumerate() {
            *value = spectrum[t * n_bins + b].norm_sqr();
        }
        for m in 0..n_mel {
            let mut acc = 0f32;
            for (f, p) in power.iter().enumerate() {
                acc += p * filters[f * n_mel + m];
            }
            log_mel[t * n_mel + m] = acc.max(SEAMLESS_MEL_FLOOR).ln();
        }
    }

    normalize_per_mel_bin(&mut log_mel, frames, n_mel);

    let stacked = frames / SEAMLESS_STRIDE;
    if stacked == 0 {
        return (Vec::new(), 0);
    }
    let mut out = vec![0f32; stacked * SEAMLESS_FEATURE_DIM];
    for s in 0..stacked {
        let src = s * SEAMLESS_STRIDE * n_mel;
        out[s * SEAMLESS_FEATURE_DIM..(s + 1) * SEAMLESS_FEATURE_DIM].copy_from_slice(&log_mel[src..src + SEAMLESS_FEATURE_DIM]);
    }
    (out, stacked)
}

/// Normalizes each mel bin along the time axis to zero mean and unit variance (sample variance, ddof=1), in place.
fn normalize_per_mel_bin(x: &mut [f32], frames: usize, n_mel: usize) {
    if frames <= 1 {
        if frames == 1 {
            // With a single frame, the ddof=1 variance is undefined; the extractor divides by sqrt(1e-7), so the result is 0.
            for value in x.iter_mut().take(n_mel) {
                *value = 0.0;
            }
        }
        return;
    }
    let n = frames as f32;
    for m in 0..n_mel {
        let mean = (0..frames).map(|t| x[t * n_mel + m]).sum::<f32>() / n;
        let sse = (0..frames)
            .map(|t| {
                let d = x[t * n_mel + m] - mean;
                d * d
            })
            .sum::<f32>();
        let var = sse / (n - 1.0);
        let inv_std = 1.0 / (var + SEAMLESS_NORM_EPSILON).sqrt();
        for t in 0..frames {
            x[t * n_mel + m] = (x[t * n_mel + m] - mean) * inv_std;
        }
    }
}

// MARK: - CAM++ Kaldi fbank

pub const CAMPPLUS_NUM_MEL_BINS: usize = 80;
const CAMPPLUS_WIN_LENGTH: usize = 400;
const CAMPPLUS_HOP_LENGTH: usize = 160;
const CAMPPLUS_N_FFT: usize = 512;
const CAMPPLUS_PREEMPH: f32 = 0.97;
const CAMPPLUS_LOG_FLOOR: f32 = 1.192_092_9e-7;

/// CAM++ log-mel features, row-major `[frames, 80]`; input shorter than one frame is zero-padded to at least one frame.
///
/// Matches the `kaldi.fbank` defaults: 25 ms / 10 ms, DC removal, pre-emphasis 0.97 (`frame[0]` minus itself), Povey window,
/// 512-point power spectrum, Kaldi mel triangles from 20 Hz to Nyquist (Nyquist bin weight 0), `log(max(x, eps))`.
/// Differences from the Seamless front end: no ×2^15, and no time-axis normalization (the caller subtracts the mean over the whole segment).
pub fn campplus_fbank(audio: &[f32]) -> (Vec<f32>, usize) {
    let n_bins = CAMPPLUS_N_FFT / 2 + 1;
    let signal_len = audio.len();
    let num_frames = if signal_len >= CAMPPLUS_WIN_LENGTH {
        ((signal_len - CAMPPLUS_WIN_LENGTH) / CAMPPLUS_HOP_LENGTH + 1).max(1)
    } else {
        1
    };
    let window = povey_window(CAMPPLUS_WIN_LENGTH);
    let mut framed = vec![0f32; num_frames * CAMPPLUS_N_FFT];
    let mut frame = vec![0f32; CAMPPLUS_WIN_LENGTH];
    for t in 0..num_frames {
        let start = t * CAMPPLUS_HOP_LENGTH;
        let mut mean = 0f32;
        for (i, value) in frame.iter_mut().enumerate() {
            let idx = start + i;
            *value = if idx < signal_len { audio[idx] } else { 0.0 };
            mean += *value;
        }
        mean /= CAMPPLUS_WIN_LENGTH as f32;
        for value in frame.iter_mut() {
            *value -= mean;
        }
        // Kaldi's pre-emphasis pads by replication: `frame[0]` minus 0.97 × itself.
        let mut prev = frame[0];
        for value in frame.iter_mut() {
            let cur = *value;
            *value = cur - CAMPPLUS_PREEMPH * prev;
            prev = cur;
        }
        let base = t * CAMPPLUS_N_FFT;
        for i in 0..CAMPPLUS_WIN_LENGTH {
            framed[base + i] = frame[i] * window[i];
        }
    }
    let spectrum = rfft_frames(&framed, num_frames, CAMPPLUS_N_FFT);
    let fb = kaldi_mel_filterbank();
    let mut out = vec![0f32; num_frames * CAMPPLUS_NUM_MEL_BINS];
    let mut power = vec![0f32; n_bins];
    for t in 0..num_frames {
        for (b, value) in power.iter_mut().enumerate() {
            let c = spectrum[t * n_bins + b];
            // The reference implementation uses abs(spec) * abs(spec), which is the same as norm_sqr.
            *value = c.norm_sqr();
        }
        for m in 0..CAMPPLUS_NUM_MEL_BINS {
            let mut acc = 0f32;
            for (k, p) in power.iter().enumerate() {
                acc += p * fb[k * CAMPPLUS_NUM_MEL_BINS + m];
            }
            out[t * CAMPPLUS_NUM_MEL_BINS + m] = acc.max(CAMPPLUS_LOG_FLOOR).ln();
        }
    }
    (out, num_frames)
}

// MARK: - torchaudio resampling

/// Default configuration of `torchaudio.transforms.Resample(orig, new)` (`sinc_interp_hann`,
/// `lowpass_filter_width = 6`, `rolloff = 0.99`): first reduces by the greatest common divisor, computes the kernel in f64 and converts it to f32,
/// zero-pads both sides of the input, convolves with stride `orig`, and truncates the output to `ceil(new × len / orig)`.
/// When the two sample rates are equal, the input is returned unchanged.
pub fn torchaudio_resample(samples: &[f32], orig_freq: u32, new_freq: u32) -> Vec<f32> {
    sinc_resample(samples, orig_freq, new_freq, SincWindow::Hann, 6.0, 0.99)
}

/// Approximation of the resampling the official code uses when reading reference audio, `librosa.load(path, sr=…)` (librosa's default is `soxr_hq`):
/// torchaudio's `sinc_interp_kaiser` (`lowpass_filter_width = 64`, `rolloff = 0.957`, `beta = 6`). The parameters are fitted to soxr_hq's measured frequency response (linear phase, zero delay, -3 dB near 0.95× Nyquist). The relative error on white noise is within 0.15% for 16k→22050, 44.1k/48k→22050, and 24k/44.1k→16k. CAM++-style vectors are very sensitive to the 7–8 kHz transition band: with a plain sinc, the cosine similarity to the official output is only 0.9975, which is enough to make the emotion matrix pick a different row; with this version it is 0.99999+.
pub fn librosa_resample(samples: &[f32], orig_freq: u32, new_freq: u32) -> Vec<f32> {
    sinc_resample(samples, orig_freq, new_freq, SincWindow::Kaiser { beta: 6.0 }, 64.0, 0.957)
}

#[derive(Debug, Clone, Copy)]
enum SincWindow {
    Hann,
    Kaiser { beta: f64 },
}

/// Point-by-point replica of torchaudio's `_get_sinc_resample_kernel` + `_apply_sinc_resample_kernel`.
fn sinc_resample(samples: &[f32], orig_freq: u32, new_freq: u32, window: SincWindow, lowpass_filter_width: f64, rolloff: f64) -> Vec<f32> {
    if orig_freq == new_freq || samples.is_empty() {
        return samples.to_vec();
    }
    fn gcd(a: u32, b: u32) -> u32 {
        if b == 0 { a } else { gcd(b, a % b) }
    }
    let g = gcd(orig_freq, new_freq);
    let orig = (orig_freq / g) as usize;
    let new = (new_freq / g) as usize;
    let base_freq = orig.min(new) as f64 * rolloff;
    let width = (lowpass_filter_width * orig as f64 / base_freq).ceil() as usize;
    let taps = 2 * width + orig;
    let scale = base_freq / orig as f64;
    let mut kernels = vec![0f32; new * taps];
    for j in 0..new {
        // `torch.arange(0, -new, -1) / new` is true division on an integer tensor, and the result is f32.
        let phase = (-(j as f32) / new as f32) as f64;
        for k in 0..taps {
            let idx = (k as f64 - width as f64) / orig as f64;
            let t = ((phase + idx) * base_freq).clamp(-lowpass_filter_width, lowpass_filter_width);
            let w = match window {
                SincWindow::Hann => (t * std::f64::consts::PI / lowpass_filter_width / 2.0).cos().powi(2),
                SincWindow::Kaiser { beta } => {
                    let r = (1.0 - (t / lowpass_filter_width).powi(2)).max(0.0);
                    bessel_i0(beta * r.sqrt()) / bessel_i0(beta)
                }
            };
            let t = t * std::f64::consts::PI;
            let sinc = if t == 0.0 { 1.0 } else { t.sin() / t };
            kernels[j * taps + k] = (sinc * w * scale) as f32;
        }
    }
    let length = samples.len();
    let mut padded = vec![0f32; width + length + width + orig];
    padded[width..width + length].copy_from_slice(samples);
    let steps = (padded.len() - taps) / orig + 1;
    let target = (new as f64 * length as f64 / orig as f64).ceil() as usize;
    let mut out = Vec::with_capacity(target);
    'outer: for p in 0..steps {
        let frame = &padded[p * orig..p * orig + taps];
        for j in 0..new {
            if out.len() == target {
                break 'outer;
            }
            let kernel = &kernels[j * taps..(j + 1) * taps];
            let acc: f32 = frame.iter().zip(kernel).map(|(x, w)| x * w).sum();
            out.push(acc);
        }
    }
    out
}

/// Modified Bessel function of the first kind, order zero, `I0(x)` (power series, converging to relative error 1e-17).
fn bessel_i0(x: f64) -> f64 {
    let quarter_sq = x * x / 4.0;
    let mut term = 1.0;
    let mut sum = 1.0;
    for k in 1..200 {
        term *= quarter_sq / (k * k) as f64;
        sum += term;
        if term < sum * 1e-17 {
            break;
        }
    }
    sum
}

// MARK: - Slaney mel（librosa）

#[derive(Debug, Clone, Copy)]
pub struct SlaneyMelConfig {
    pub sample_rate: u32,
    pub n_fft: usize,
    pub hop: usize,
    pub win: usize,
    pub n_mels: usize,
    pub fmin: f32,
    pub fmax: f32,
    /// Exponent applied to the STFT magnitude before the mel projection (1.0 for a magnitude spectrum, 2.0 for a power spectrum).
    pub power: f32,
    /// When true, takes `log(max(mel, log_floor))` after projection.
    pub log_mel: bool,
    pub log_floor: f32,
    /// When true, pads `n_fft/2` by reflection on each side (librosa `center=True`).
    pub center_pad: bool,
    /// When true, uses PyTorch's default periodic Hann window.
    pub periodic_hann: bool,
}

fn hann_window(length: usize, n_fft: usize, periodic: bool) -> Vec<f32> {
    let mut w = vec![0f32; n_fft];
    let denom = (if periodic { length } else { length - 1 }).max(1) as f32;
    for (i, value) in w.iter_mut().enumerate().take(length) {
        *value = 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / denom).cos());
    }
    w
}

/// numpy `mode='reflect'` padding (does not include the boundary sample).
fn reflect_pad_1d(row: &[f32], pad: usize) -> Vec<f32> {
    let mut out = vec![0f32; pad + row.len() + pad];
    out[pad..pad + row.len()].copy_from_slice(row);
    for i in 0..pad {
        out[i] = row[pad - i];
    }
    let last = row.len() - 1;
    for i in 0..pad {
        out[pad + row.len() + i] = row[last - 1 - i];
    }
    out
}

fn hz_to_mel_slaney(hz: f32) -> f32 {
    let f_spacing = 200.0f32 / 3.0;
    let min_log_hz = 1000.0f32;
    let min_log_mel = min_log_hz / f_spacing;
    let logstep = 6.4f32.ln() / 27.0;
    if hz >= min_log_hz {
        min_log_mel + (hz / min_log_hz).ln() / logstep
    } else {
        hz / f_spacing
    }
}

fn mel_to_hz_slaney(mel: f32) -> f32 {
    let f_spacing = 200.0f32 / 3.0;
    let min_log_hz = 1000.0f32;
    let min_log_mel = min_log_hz / f_spacing;
    let logstep = 6.4f32.ln() / 27.0;
    if mel >= min_log_mel {
        min_log_hz * (logstep * (mel - min_log_mel)).exp()
    } else {
        f_spacing * mel
    }
}

/// Slaney-normalized mel filterbank, row-major `(n_mels, n_fft/2 + 1)`.
pub fn slaney_filterbank(sr: u32, n_fft: usize, n_mels: usize, fmin: f32, fmax: f32) -> Vec<f32> {
    let n_bins = n_fft / 2 + 1;
    let f = sr as f32;
    let fft_freqs: Vec<f32> = (0..n_bins).map(|i| i as f32 * f / n_fft as f32).collect();
    let mel_min = hz_to_mel_slaney(fmin);
    let mel_max = hz_to_mel_slaney(fmax);
    let hz_points: Vec<f32> = (0..n_mels + 2)
        .map(|i| mel_to_hz_slaney(mel_min + (i as f32 / (n_mels + 1) as f32) * (mel_max - mel_min)))
        .collect();
    let mut fb = vec![0f32; n_mels * n_bins];
    for m in 0..n_mels {
        let lower = hz_points[m];
        let center = hz_points[m + 1];
        let upper = hz_points[m + 2];
        for (k, &freq) in fft_freqs.iter().enumerate() {
            if freq < lower || freq > upper {
                continue;
            }
            fb[m * n_bins + k] = if freq <= center {
                (freq - lower) / (center - lower).max(1e-12)
            } else {
                (upper - freq) / (upper - center).max(1e-12)
            };
        }
        let enorm = 2.0 / (upper - lower).max(1e-12);
        for k in 0..n_bins {
            fb[m * n_bins + k] *= enorm;
        }
    }
    fb
}

/// Mel spectrogram `(frames, n_mels)`, row-major.
pub fn slaney_mel(samples: &[f32], c: &SlaneyMelConfig) -> (Vec<f32>, usize) {
    let n_bins = c.n_fft / 2 + 1;
    let padded;
    let sig: &[f32] = if c.center_pad {
        padded = reflect_pad_1d(samples, c.n_fft / 2);
        &padded
    } else {
        samples
    };
    let frames = if sig.len() >= c.n_fft {
        (sig.len() - c.n_fft) / c.hop + 1
    } else {
        0
    };
    if frames == 0 {
        return (Vec::new(), 0);
    }
    let window = hann_window(c.win, c.n_fft, c.periodic_hann);
    let mut framed = vec![0f32; frames * c.n_fft];
    for t in 0..frames {
        let start = t * c.hop;
        for i in 0..c.n_fft {
            framed[t * c.n_fft + i] = sig[start + i] * window[i];
        }
    }
    let spectrum = rfft_frames(&framed, frames, c.n_fft);
    let fb = slaney_filterbank(c.sample_rate, c.n_fft, c.n_mels, c.fmin, c.fmax);
    let mut mel = vec![0f32; frames * c.n_mels];
    let mut mag = vec![0f32; n_bins];
    for t in 0..frames {
        for (b, value) in mag.iter_mut().enumerate() {
            let magnitude = spectrum[t * n_bins + b].norm();
            *value = if c.power == 1.0 { magnitude } else { magnitude.powf(c.power) };
        }
        for m in 0..c.n_mels {
            let mut acc = 0f32;
            for (k, &v) in mag.iter().enumerate() {
                acc += v * fb[m * n_bins + k];
            }
            mel[t * c.n_mels + m] = if c.log_mel { acc.max(c.log_floor).ln() } else { acc };
        }
    }
    (mel, frames)
}

/// Custom reflect padding for the IndexTTS2 prompt mel (matches `IndexTTS2ReferenceConditioning.reflectPad`):
/// left side `out[i] = s[clamp(pad - i, 0, n-1)]`, right side `out[pad+n+i] = s[max(last-1-i, 0)]`.
pub fn prompt_reflect_pad(samples: &[f32], pad: usize) -> Vec<f32> {
    if pad == 0 || samples.len() <= 1 {
        return samples.to_vec();
    }
    let n = samples.len();
    let mut out = vec![0f32; pad + n + pad];
    out[pad..pad + n].copy_from_slice(samples);
    for i in 0..pad {
        let src = (pad as isize - i as isize).clamp(0, n as isize - 1) as usize;
        out[i] = samples[src];
    }
    let last = n - 1;
    for i in 0..pad {
        let src = (last as isize - 1 - i as isize).max(0) as usize;
        out[pad + n + i] = samples[src];
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(sr: usize, seconds: f32, hz: f32) -> Vec<f32> {
        let n = (sr as f32 * seconds) as usize;
        (0..n)
            .map(|i| 0.3 * (2.0 * std::f32::consts::PI * hz * i as f32 / sr as f32).sin())
            .collect()
    }

    #[test]
    fn seamless_feature_shape_and_normalization() {
        let audio = sine(16_000, 1.0, 440.0);
        let (features, frames) = seamless_input_features(&audio);
        // 1 s: (16000-400)/160+1 = 98 frames → 49 after stacking.
        assert_eq!(frames, 49);
        assert_eq!(features.len(), 49 * 160);
        // After normalization, each mel bin's mean over time is approximately 0 (before stacking); here we check that the whole output is finite and non-zero.
        assert!(features.iter().all(|v| v.is_finite()));
        assert!(features.iter().any(|v| v.abs() > 0.1));
        assert_eq!(seamless_input_features(&audio[..300]).1, 0);
    }

    #[test]
    fn kaldi_filterbank_rows_sum_reasonably() {
        let fb = kaldi_mel_filterbank();
        assert_eq!(fb.len(), 257 * 80);
        assert!(fb[256 * 80..].iter().all(|v| *v == 0.0));
        // Each filter peaks at 1 (the triangle reaches 1 at its center; with discrete sampling the peak is slightly lower).
        for m in 0..80 {
            let peak = (0..256).map(|k| fb[k * 80 + m]).fold(0f32, f32::max);
            assert!(peak > 0.3 && peak <= 1.0 + 1e-6, "mel {m} peak {peak}");
        }
    }

    #[test]
    fn torchaudio_resample_length_and_passband() {
        // 22050 → 16000 reduces to 441 → 320, output ceil(320 × len / 441).
        let audio = sine(22_050, 1.0, 440.0);
        let out = torchaudio_resample(&audio, 22_050, 16_000);
        assert_eq!(out.len(), 16_000);
        // Sine amplitudes in the passband are essentially unchanged, and they match a sine synthesized directly at 16 kHz (edges skipped).
        let expected = sine(16_000, 1.0, 440.0);
        let max_err = out[200..15_800]
            .iter()
            .zip(&expected[200..15_800])
            .map(|(a, b)| (a - b).abs())
            .fold(0f32, f32::max);
        assert!(max_err < 5e-3, "max_err = {max_err}");
        assert_eq!(torchaudio_resample(&audio[..7], 22_050, 16_000).len(), 6);
        assert_eq!(torchaudio_resample(&audio, 16_000, 16_000), audio);
    }

    /// Point-by-point parity check against `torchaudio.transforms.Resample(22050, 16000)` (the values were computed in the official venv).
    #[test]
    fn torchaudio_resample_matches_torchaudio() {
        let sr = 22_050f32;
        let signal: Vec<f32> = (0..300)
            .map(|i| {
                let t = i as f32 / sr;
                0.3 * (2.0 * std::f32::consts::PI * 440.0 * t).sin() + 0.2 * (2.0 * std::f32::consts::PI * 3000.0 * t).sin()
            })
            .collect();
        let out = torchaudio_resample(&signal, 22_050, 16_000);
        assert_eq!(out.len(), 218);
        let expected = [
            (0, 0.017_446_8),
            (1, 0.232_487_9),
            (2, 0.244_994_3),
            (50, 0.353_684_4),
            (100, -0.500_170_7),
            (150, 0.353_655),
            (200, 0.000_019_2),
            (217, -0.200_260_2),
        ];
        for (at, value) in expected {
            assert!((out[at] - value).abs() < 2e-5, "out[{at}] = {} ≠ {value}", out[at]);
        }
        // 9 kHz is above the new Nyquist: torchaudio also only attenuates it to about 0.043 (a sine of amplitude 0.3).
        let high = sine(22_050, 1.0, 9_000.0);
        let peak = torchaudio_resample(&high, 22_050, 16_000)[200..15_800]
            .iter()
            .fold(0f32, |m, v| m.max(v.abs()));
        assert!((peak - 0.0434).abs() < 2e-3, "peak = {peak}");
    }

    /// Parity check against measured values from torchaudio `resample(…, "sinc_interp_kaiser", lowpass_filter_width=64,
    /// rolloff=0.957, beta=6.0)` (two sines at 440 Hz and 7.7 kHz, 400 samples).
    #[test]
    fn librosa_resample_matches_torchaudio_kaiser() {
        for (orig, new, len, expected) in [
            (
                16_000u32,
                22_050u32,
                552usize,
                [0.118_213_43, 0.327_312_65, 0.523_548_5, 0.044_298_634],
            ),
            (44_100, 22_050, 200, [0.080_036_07, 0.210_935_83, 0.573_810_9, 0.182_751_39]),
        ] {
            let signal: Vec<f32> = (0..400)
                .map(|i| {
                    let n = i as f64 / orig as f64;
                    (0.5 * (2.0 * std::f64::consts::PI * 440.0 * n).sin() + 0.3 * (2.0 * std::f64::consts::PI * 7_700.0 * n).sin()) as f32
                })
                .collect();
            let out = librosa_resample(&signal, orig, new);
            assert_eq!(out.len(), len);
            for (at, value) in [0usize, 57, 113, 150].into_iter().zip(expected) {
                assert!((out[at] - value).abs() < 2e-5, "{orig}→{new} out[{at}] = {} ≠ {value}", out[at]);
            }
        }
        assert!((bessel_i0(6.0) - 67.234_406_976_478_1).abs() < 1e-9);
    }

    #[test]
    fn campplus_fbank_shape() {
        let audio = sine(16_000, 0.5, 300.0);
        let (features, frames) = campplus_fbank(&audio);
        assert_eq!(frames, (8000 - 400) / 160 + 1);
        assert_eq!(features.len(), frames * 80);
        assert!(features.iter().all(|v| v.is_finite()));
        // Input that is too short still gets at least one frame.
        assert_eq!(campplus_fbank(&audio[..100]).1, 1);
    }

    #[test]
    fn slaney_mel_matches_expected_frame_count_and_peak_bin() {
        let audio = sine(22_050, 0.5, 1000.0);
        let config = SlaneyMelConfig {
            sample_rate: 22_050,
            n_fft: 1024,
            hop: 256,
            win: 1024,
            n_mels: 80,
            fmin: 0.0,
            fmax: 11_025.0,
            power: 1.0,
            log_mel: true,
            log_floor: 1e-5,
            center_pad: false,
            periodic_hann: true,
        };
        let padded = prompt_reflect_pad(&audio, (1024 - 256) / 2);
        let (mel, frames) = slaney_mel(&padded, &config);
        assert_eq!(frames, (padded.len() - 1024) / 256 + 1);
        assert_eq!(mel.len(), frames * 80);
        // The energy of a 1 kHz sine should concentrate in one bin in the middle part of the mel axis.
        let frame = &mel[10 * 80..11 * 80];
        let (peak, _) = frame
            .iter()
            .enumerate()
            .fold((0usize, f32::MIN), |acc, (i, v)| if *v > acc.1 { (i, *v) } else { acc });
        assert!((20..50).contains(&peak), "peak bin {peak}");
        // The filterbank is laid out flat as `[n_mels, n_fft/2 + 1]`.
        let ours = slaney_filterbank(22_050, 1024, 80, 0.0, 11_025.0);
        assert_eq!(ours.len(), 80 * 513);
    }

    #[test]
    fn prompt_reflect_pad_edges() {
        let s = [1.0, 2.0, 3.0, 4.0, 5.0];
        let out = prompt_reflect_pad(&s, 2);
        assert_eq!(out, vec![3.0, 2.0, 1.0, 2.0, 3.0, 4.0, 5.0, 4.0, 3.0]);
        assert_eq!(reflect_pad_1d(&s, 2), vec![3.0, 2.0, 1.0, 2.0, 3.0, 4.0, 5.0, 4.0, 3.0]);
    }
}
