//! Parts are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/SourceSeparation/HTDemucs/HTDemucsSpec.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-bundle interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! HTDemucs's STFT / iSTFT and demucs `_spec` / `_ispec` pad / crop arithmetic (CPU, realfft).
//!
//! Cross-referenced with speech-swift `HTDemucsSpec.swift`: the model normalizes the magnitude spectrum with the mean/std of its own input, so the whole pipeline is insensitive to the global scale of the STFT, as long as the forward and inverse transforms are a pair that reconstructs perfectly
//! (COLA periodic Hann, hop = nfft/4). With demucs' exact pad / crop, the lengths of the frequency branch and the time branch line up. The convention follows `torch.stft(center=True,
//! pad_mode="reflect")`; the scale difference is cancelled by the normalization.
//!
//! The layout of complex spectra is uniformly frequency-first `[freqs][frames]` (matching the model's `[C, Fr, T]`).

use anyhow::{Result, bail};
use realfft::num_complex::Complex;
use realfft::{ComplexToReal, RealFftPlanner, RealToComplex};
use std::sync::Arc;

pub type Complex32 = Complex<f32>;

/// Mono STFT plan: the window, forward and inverse FFT, and demucs' pad parameters.
pub struct Spectrogram {
    nfft: usize,
    hop: usize,
    window: Vec<f32>,
    forward: Arc<dyn RealToComplex<f32>>,
    inverse: Arc<dyn ComplexToReal<f32>>,
}

/// Output of `spec`: `nfft/2` frequency bins × `frames` frames, frequency-first.
#[derive(Debug, Clone, PartialEq)]
pub struct Spectrum {
    pub bins: usize,
    pub frames: usize,
    pub data: Vec<Complex32>,
}

impl Spectrum {
    pub fn zeros(bins: usize, frames: usize) -> Self {
        Self {
            bins,
            frames,
            data: vec![Complex32::new(0.0, 0.0); bins * frames],
        }
    }

    #[inline]
    pub fn at(&self, bin: usize, frame: usize) -> Complex32 {
        self.data[bin * self.frames + frame]
    }
}

impl Spectrogram {
    pub fn new(nfft: usize, hop: usize) -> Result<Self> {
        if nfft == 0 || hop == 0 || !nfft.is_multiple_of(hop) || !nfft.is_multiple_of(2) {
            bail!("invalid STFT parameters: nfft {nfft} hop {hop} (nfft must be even and a multiple of hop)");
        }
        // Periodic Hann (torch.hann_window default, periodic=True).
        let window = (0..nfft)
            .map(|i| (0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / nfft as f64).cos()) as f32)
            .collect();
        let mut planner = RealFftPlanner::<f32>::new();
        Ok(Self {
            nfft,
            hop,
            window,
            forward: planner.plan_fft_forward(nfft),
            inverse: planner.plan_fft_inverse(nfft),
        })
    }

    pub fn nfft(&self) -> usize {
        self.nfft
    }

    pub fn hop(&self) -> usize {
        self.hop
    }

    /// Number of frames output by demucs `_spec`: `ceil(T / hop)`.
    pub fn frames_for(&self, length: usize) -> usize {
        length.div_ceil(self.hop)
    }

    /// torch "reflect" padding: on the left it takes `x[left..=1]`, on the right it takes `x[L-2..=L-1-right]`, without repeating edge samples.
    pub fn reflect_pad(x: &[f32], left: usize, right: usize) -> Result<Vec<f32>> {
        let len = x.len();
        if len < 2 || left >= len || right >= len {
            bail!("reflect padding out of range: length {len}, left {left}, right {right}");
        }
        let mut out = Vec::with_capacity(left + len + right);
        out.extend((1..=left).rev().map(|i| x[i]));
        out.extend_from_slice(x);
        out.extend((0..right).map(|i| x[len - 2 - i]));
        Ok(out)
    }

    /// Equivalent to `torch.stft`: real sequence → complex spectrum `[nfft/2+1][frames]`,
    /// center=True (reflect padding of nfft/2 on both sides), periodic Hann.
    pub fn stft(&self, x: &[f32]) -> Result<Spectrum> {
        let pad = self.nfft / 2;
        let xp = Self::reflect_pad(x, pad, pad)?;
        let frames = 1 + (xp.len() - self.nfft) / self.hop;
        let bins = self.nfft / 2 + 1;
        let mut out = Spectrum::zeros(bins, frames);
        let mut input = vec![0.0f32; self.nfft];
        let mut output = vec![Complex32::new(0.0, 0.0); bins];
        let mut scratch = self.forward.make_scratch_vec();
        for f in 0..frames {
            let start = f * self.hop;
            for (k, v) in input.iter_mut().enumerate() {
                *v = xp[start + k] * self.window[k];
            }
            self.forward
                .process_with_scratch(&mut input, &mut output, &mut scratch)
                .map_err(|e| anyhow::anyhow!("rfft failed: {e}"))?;
            for (k, v) in output.iter().enumerate() {
                out.data[k * frames + f] = *v;
            }
        }
        Ok(out)
    }

    /// Inverse of `stft`: complex spectrum `[nfft/2+1][frames]` → real sequence of length `length`.
    /// Per-frame irfft × window, then overlap-add, then divided by the overlap-add of window² (floor 1e-8), and finally the center padding is cropped off.
    pub fn istft(&self, z: &Spectrum, length: usize) -> Result<Vec<f32>> {
        let bins = self.nfft / 2 + 1;
        if z.bins != bins {
            bail!("istft expects {bins} frequency bins, found {}", z.bins);
        }
        let frames = z.frames;
        let total = (frames - 1) * self.hop + self.nfft;
        let mut accum = vec![0.0f32; total];
        let mut win_sum = vec![0.0f32; total];
        let mut spectrum = vec![Complex32::new(0.0, 0.0); bins];
        let mut frame = vec![0.0f32; self.nfft];
        let mut scratch = self.inverse.make_scratch_vec();
        let scale = 1.0 / self.nfft as f32;
        for f in 0..frames {
            for (k, v) in spectrum.iter_mut().enumerate() {
                *v = z.data[k * frames + f];
            }
            // As with torch.irfft, the imaginary parts of DC and Nyquist are ignored (realfft would raise an error for them).
            spectrum[0].im = 0.0;
            spectrum[bins - 1].im = 0.0;
            self.inverse
                .process_with_scratch(&mut spectrum, &mut frame, &mut scratch)
                .map_err(|e| anyhow::anyhow!("irfft failed: {e}"))?;
            let start = f * self.hop;
            for k in 0..self.nfft {
                let w = self.window[k];
                accum[start + k] += frame[k] * scale * w;
                win_sum[start + k] += w * w;
            }
        }
        let pad = self.nfft / 2;
        if pad + length > total {
            bail!("istft output length {length} exceeds the reconstructable range {}", total - pad);
        }
        Ok((pad..pad + length).map(|i| accum[i] / win_sum[i].max(1e-8)).collect())
    }

    /// `htdemucs._spec`: real sequence → `[nfft/2][le]`, `le = ceil(T/hop)`.
    /// Extra reflect padding, plus dropping the highest-frequency bin and cropping 2 frames on each side, ensuring `out_size == in_size/hop`
    /// and aligning with the time-domain branch.
    pub fn spec(&self, x: &[f32]) -> Result<Spectrum> {
        let len = x.len();
        let le = self.frames_for(len);
        let pad = self.hop / 2 * 3;
        let xp = Self::reflect_pad(x, pad, pad + le * self.hop - len)?;
        let z = self.stft(&xp)?;
        if z.frames < 2 + le {
            bail!("not enough spec frames: {} < {}", z.frames, 2 + le);
        }
        let bins = self.nfft / 2;
        let mut out = Spectrum::zeros(bins, le);
        for k in 0..bins {
            let src = &z.data[k * z.frames + 2..k * z.frames + 2 + le];
            out.data[k * le..(k + 1) * le].copy_from_slice(src);
        }
        Ok(out)
    }

    /// `htdemucs._ispec`: `[nfft/2][le]` → real sequence of length `length`.
    pub fn ispec(&self, z: &Spectrum, length: usize) -> Result<Vec<f32>> {
        let bins = self.nfft / 2;
        if z.bins != bins {
            bail!("ispec expects {bins} frequency bins, found {}", z.bins);
        }
        let le = z.frames;
        // Zero-pad: frequency nfft/2 → nfft/2+1, and 2 frames are padded on each side.
        let mut zp = Spectrum::zeros(bins + 1, le + 4);
        for k in 0..bins {
            zp.data[k * (le + 4) + 2..k * (le + 4) + 2 + le].copy_from_slice(&z.data[k * le..(k + 1) * le]);
        }
        let pad = self.hop / 2 * 3;
        let le2 = self.hop * length.div_ceil(self.hop) + 2 * pad;
        let wav = self.istft(&zp, le2)?;
        Ok(wav[pad..pad + length].to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic test signal: a sum of multi-frequency sines; when `noise` is true, white noise is added as well
    /// (white noise has energy in the Nyquist bin, so it can only be used for pure stft/istft round trips that do not drop bins).
    fn test_signal(len: usize, seed: u32, noise: bool) -> Vec<f32> {
        let mut state = seed.wrapping_mul(2_654_435_761).wrapping_add(1);
        let freqs = [440.0f32, 1_234.5, 5_000.0, 9_876.0, 15_000.0];
        (0..len)
            .map(|i| {
                state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                let n = (state >> 8) as f32 / (1u32 << 24) as f32 - 0.5;
                let t = i as f32 / 44_100.0;
                let mut v = 0.0;
                for (k, f) in freqs.iter().enumerate() {
                    v += 0.4 / (k as f32 + 1.0) * (2.0 * std::f32::consts::PI * f * t).sin();
                }
                if noise { v + 0.3 * n } else { v }
            })
            .collect()
    }

    fn max_abs_diff(a: &[f32], b: &[f32]) -> f32 {
        assert_eq!(a.len(), b.len());
        a.iter().zip(b).map(|(x, y)| (x - y).abs()).fold(0.0, f32::max)
    }

    #[test]
    fn reflect_pad_matches_torch() {
        let x = [1.0, 2.0, 3.0, 4.0, 5.0];
        let padded = Spectrogram::reflect_pad(&x, 2, 3).unwrap();
        assert_eq!(padded, vec![3.0, 2.0, 1.0, 2.0, 3.0, 4.0, 5.0, 4.0, 3.0, 2.0]);
        assert!(Spectrogram::reflect_pad(&x, 5, 0).is_err());
    }

    #[test]
    fn stft_istft_roundtrip_is_exact() {
        let spec = Spectrogram::new(4096, 1024).unwrap();
        let x = test_signal(20_000, 7, true);
        let z = spec.stft(&x).unwrap();
        assert_eq!(z.bins, 2049);
        assert_eq!(z.frames, 1 + (20_000 + 4096 - 4096) / 1024);
        let y = spec.istft(&z, x.len()).unwrap();
        assert!(max_abs_diff(&x, &y) < 1e-4, "reconstruction error {}", max_abs_diff(&x, &y));
    }

    #[test]
    fn spec_ispec_roundtrip_matches_demucs_shapes() {
        let spec = Spectrogram::new(4096, 1024).unwrap();
        for len in [343_980usize, 44_100, 12_345] {
            let x = test_signal(len, len as u32, false);
            let z = spec.spec(&x).unwrap();
            assert_eq!(z.bins, 2048);
            assert_eq!(z.frames, len.div_ceil(1024));
            let y = spec.ispec(&z, len).unwrap();
            assert_eq!(y.len(), len);
            // demucs' `_spec` drops 2 frames at each end, while `_ispec`'s window normalization still counts all frames,
            // so about 1536 + hop samples at both ends are attenuated (the first sample at about 0.5×). This is inherent to the original model, which was already adapted to during end-to-end training. Here we only verify exact reconstruction in the interior,
            // and confirm that the edge attenuation really exists (otherwise the frame-cropping arithmetic would differ from demucs).
            let edge = 3 * 1024;
            let err = max_abs_diff(&x[edge..len - edge], &y[edge..len - edge]);
            assert!(err < 1e-3, "interior reconstruction error for length {len}: {err}");
            assert!(x[10].abs() > 1e-2);
            let ratio = y[10] / x[10];
            assert!((ratio - 0.5).abs() < 0.05, "edge attenuation ratio for length {len}: {ratio}");
        }
    }

    #[test]
    fn spec_is_linear_in_scale() {
        let spec = Spectrogram::new(4096, 1024).unwrap();
        let x = test_signal(8_192, 3, true);
        let scaled: Vec<f32> = x.iter().map(|v| v * 3.0).collect();
        let a = spec.spec(&x).unwrap();
        let b = spec.spec(&scaled).unwrap();
        for (p, q) in a.data.iter().zip(&b.data) {
            assert!((p * 3.0 - q).norm() < 1e-3);
        }
    }
}
