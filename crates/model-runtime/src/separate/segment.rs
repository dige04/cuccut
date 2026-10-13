//! Parts are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/SourceSeparation/HTDemucs/HTDemucsSeparator.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-bundle interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Window splitting and triangular cross-fading for long audio (pure logic, compiled on all platforms).
//!
//! Cross-referenced with speech-swift `HTDemucsSeparator.swift`'s `triangularWeight` / `applySplit`:
//! windows of `training_length`, sliding with a step of `(1 - overlap) × window length`; each window's output is multiplied by its triangular weight and overlap-added, and finally divided by the sum of the weights (shifts = 0, deterministic).

use anyhow::{Result, bail};

/// Triangular cross-fade weight: rises from 1 to half over the first half, falls back to 1 over the second half, then divided by the maximum.
pub fn triangular_weight(length: usize) -> Vec<f32> {
    if length == 0 {
        return Vec::new();
    }
    let half = length / 2;
    let mut w: Vec<f32> = (0..length)
        .map(|i| if i < half { (i + 1) as f32 } else { (length - i) as f32 })
        .collect();
    let max = w.iter().copied().fold(1.0, f32::max);
    for v in &mut w {
        *v /= max;
    }
    w
}

/// One inference window: its start and actual length (the last window may be shorter than the window length; the model zero-pads internally).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Window {
    pub offset: usize,
    pub len: usize,
}

/// Orders the windows by the rules of demucs `apply_model(split=True)`.
pub fn plan_windows(length: usize, segment_len: usize, overlap: f32) -> Vec<Window> {
    if length == 0 || segment_len == 0 {
        return Vec::new();
    }
    let stride = (((1.0 - overlap) * segment_len as f32) as usize).max(1);
    let mut windows = Vec::new();
    let mut offset = 0;
    while offset < length {
        let len = segment_len.min(length - offset);
        windows.push(Window { offset, len });
        offset += stride;
    }
    windows
}

/// CPU overlap-add accumulator: `channels` equal-length outputs plus the weight sum.
pub struct OverlapAdd {
    segment_len: usize,
    weight: Vec<f32>,
    out: Vec<Vec<f32>>,
    sum_w: Vec<f32>,
}

impl OverlapAdd {
    pub fn new(channels: usize, length: usize, segment_len: usize) -> Self {
        Self {
            segment_len,
            weight: triangular_weight(segment_len),
            out: vec![vec![0.0; length]; channels],
            sum_w: vec![0.0; length],
        }
    }

    /// Accumulates one window's output (each channel's length must equal `window.len`).
    pub fn add(&mut self, window: Window, chunk: &[Vec<f32>]) -> Result<()> {
        if chunk.len() != self.out.len() {
            bail!("window output channel count {} does not match accumulator {}", chunk.len(), self.out.len());
        }
        if window.len > self.segment_len || window.offset + window.len > self.sum_w.len() {
            bail!(
                "window [{}, +{}) is out of range (window length {}, total length {})",
                window.offset,
                window.len,
                self.segment_len,
                self.sum_w.len()
            );
        }
        for (dst, src) in self.out.iter_mut().zip(chunk) {
            if src.len() != window.len {
                bail!("window output length {} does not match window {}", src.len(), window.len);
            }
            for (i, v) in src.iter().enumerate() {
                dst[window.offset + i] += v * self.weight[i];
            }
        }
        for i in 0..window.len {
            self.sum_w[window.offset + i] += self.weight[i];
        }
        Ok(())
    }

    /// Divides by the weight sum to get the final output for each channel.
    pub fn finish(self) -> Vec<Vec<f32>> {
        let sum_w = self.sum_w;
        self.out
            .into_iter()
            .map(|mut ch| {
                for (v, w) in ch.iter_mut().zip(&sum_w) {
                    if *w > 0.0 {
                        *v /= w;
                    }
                }
                ch
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn triangular_weight_is_symmetric_and_normalized() {
        let w = triangular_weight(8);
        assert_eq!(w, vec![0.25, 0.5, 0.75, 1.0, 1.0, 0.75, 0.5, 0.25]);
        let w = triangular_weight(7);
        assert_eq!(w.len(), 7);
        assert_eq!(w[3], 1.0);
        assert!((w[0] - 0.25).abs() < 1e-6 && (w[6] - 0.25).abs() < 1e-6);
        assert!(w.iter().all(|&v| v > 0.0));
        assert!(triangular_weight(0).is_empty());
    }

    #[test]
    fn plan_windows_uses_75_percent_stride_and_short_tail() {
        let seg = 343_980;
        let windows = plan_windows(882_000, seg, 0.25);
        let stride = 257_985;
        assert_eq!(windows[0], Window { offset: 0, len: seg });
        assert_eq!(windows[1].offset, stride);
        assert_eq!(windows.last().unwrap().offset, stride * 3);
        assert_eq!(windows.last().unwrap().len, 882_000 - stride * 3);
        assert_eq!(windows.len(), 4);
        // Shorter than one window: there is just one window, and its length is the total length.
        assert_eq!(plan_windows(1000, seg, 0.25), vec![Window { offset: 0, len: 1000 }]);
        assert!(plan_windows(0, seg, 0.25).is_empty());
    }

    #[test]
    fn overlap_add_of_identity_reconstructs_input() {
        let length = 1000;
        let seg = 300;
        let signal: Vec<f32> = (0..length).map(|i| (i as f32 * 0.01).sin()).collect();
        let mut acc = OverlapAdd::new(1, length, seg);
        for w in plan_windows(length, seg, 0.25) {
            let chunk = vec![signal[w.offset..w.offset + w.len].to_vec()];
            acc.add(w, &chunk).unwrap();
        }
        let out = acc.finish();
        for (a, b) in out[0].iter().zip(&signal) {
            assert!((a - b).abs() < 1e-5);
        }
    }

    #[test]
    fn overlap_add_rejects_bad_chunk() {
        let mut acc = OverlapAdd::new(2, 100, 50);
        assert!(acc.add(Window { offset: 0, len: 50 }, &[vec![0.0; 50]]).is_err());
        assert!(acc.add(Window { offset: 80, len: 50 }, &[vec![0.0; 50], vec![0.0; 50]]).is_err());
    }
}
