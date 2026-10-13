//! Parts of this file are based on speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/Qwen3ASR/TimestampCorrection.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the algorithms in Rust and adapts them to this project's backends, model packages and
//! transcription interfaces; the upstream source notice is kept.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see
//! `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Monotonizes the forced-alignment time grid: anchors from the longest non-decreasing subsequence (LIS), then gap
//! correction. Ported from v2 `ccut-speech-core`.

use std::collections::HashSet;

/// Non-decreasing subsequence anchors + nearest-value correction for small gaps + interpolation for large gaps.
/// Adjacent words that share an end/start are legitimate equal values and must not be fixed into zero-length words by forcing strict increase.
#[allow(clippy::needless_range_loop)]
pub fn enforce_monotonicity(raw: &[usize]) -> Vec<usize> {
    if raw.windows(2).all(|pair| pair[0] <= pair[1]) {
        return raw.to_vec();
    }
    let lis_positions = monotone_subsequence_positions(raw, true);
    if lis_positions.len() == raw.len() {
        return raw.to_vec();
    }

    let anchors: Vec<(usize, usize)> = lis_positions.iter().map(|&position| (position, raw[position])).collect();
    let anchor_set: HashSet<usize> = lis_positions.into_iter().collect();
    let mut corrected = raw.to_vec();

    for index in 0..corrected.len() {
        if anchor_set.contains(&index) {
            continue;
        }
        let previous = anchors.iter().rev().find(|anchor| anchor.0 < index).copied();
        let next = anchors.iter().find(|anchor| anchor.0 > index).copied();
        corrected[index] = match (previous, next) {
            (Some(previous), Some(next)) => {
                let gap = next.0 - previous.0;
                if gap <= 3 {
                    if index - previous.0 <= next.0 - index { previous.1 } else { next.1 }
                } else {
                    let t = (index - previous.0) as f32 / (next.0 - previous.0) as f32;
                    previous.1 + (t * (next.1 - previous.1) as f32) as usize
                }
            }
            (Some(previous), None) => previous.1,
            (None, Some(next)) => next.1,
            (None, None) => corrected[index],
        };
    }

    for index in 1..corrected.len() {
        if corrected[index] < corrected[index - 1] {
            corrected[index] = corrected[index - 1];
        }
    }
    corrected
}

pub fn longest_increasing_subsequence_positions(values: &[usize]) -> Vec<usize> {
    monotone_subsequence_positions(values, false)
}

fn monotone_subsequence_positions(values: &[usize], allow_equal: bool) -> Vec<usize> {
    if values.is_empty() {
        return Vec::new();
    }
    let mut tails = Vec::<usize>::new();
    let mut tail_indices = Vec::<usize>::new();
    let mut parent = vec![None; values.len()];

    for (index, value) in values.iter().copied().enumerate() {
        let mut lo = 0;
        let mut hi = tails.len();
        while lo < hi {
            let mid = (lo + hi) / 2;
            if tails[mid] < value || (allow_equal && tails[mid] == value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        if lo == tails.len() {
            tails.push(value);
            tail_indices.push(index);
        } else {
            tails[lo] = value;
            tail_indices[lo] = index;
        }
        if lo > 0 {
            parent[index] = Some(tail_indices[lo - 1]);
        }
    }

    let mut positions = Vec::with_capacity(tails.len());
    let mut current = Some(tail_indices[tails.len() - 1]);
    while let Some(index) = current {
        positions.push(index);
        current = parent[index];
    }
    positions.reverse();
    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamp_correction_uses_lis_interpolation_and_clamping() {
        assert_eq!(longest_increasing_subsequence_positions(&[3, 1, 2, 5, 4]), vec![1, 2, 4]);
        assert_eq!(enforce_monotonicity(&[1, 2, 3]), vec![1, 2, 3]);
        let corrected = enforce_monotonicity(&[8, 1, 2, 99, 4, 5, 0]);
        assert!(corrected.windows(2).all(|pair| pair[0] <= pair[1]));
        assert_eq!(corrected[0], corrected[1]);
        assert_eq!(corrected[6], corrected[5]);
    }

    #[test]
    fn touching_word_boundaries_are_preserved_instead_of_collapsed_to_zero_length() {
        // Raw first ten classes from a real word-alignment run. Adjacent
        // words share end/start positions; nondecreasing is already monotonic.
        let raw = [1, 5, 5, 8, 8, 14, 24, 28, 28, 32];
        assert_eq!(enforce_monotonicity(&raw), raw);
        // Exercise repair as well as the already-monotonic fast path: repeated
        // valid anchors must survive one backwards prediction between them.
        assert_eq!(enforce_monotonicity(&[1, 5, 5, 4, 8, 8]), [1, 5, 5, 5, 8, 8]);
        let repeated = vec![3; 12000];
        assert_eq!(enforce_monotonicity(&repeated), repeated);
    }
}
