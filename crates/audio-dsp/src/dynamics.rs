//! Dynamics: 10 ms block RMS, one-pole attack/release follower, block sequence interpolated back to samples, speech activity (continuous 0..1), activity ducking, and glue compression. Same conventions as the reference project's `block_rms` / `follow` / `to_samples` / `activity`.

use crate::math::{db_to_gain, gain_to_db};
use crate::stereo::Stereo;

/// Block length (seconds).
pub const BLOCK_SECONDS: f64 = 0.01;
/// Lower bound of activity (dBFS): when the follower level is below it, it counts as “not speaking”.
pub const ACTIVITY_FLOOR_DB: f64 = -48.0;
/// Number of dB over which activity rises from 0 to 1.
pub const ACTIVITY_RANGE_DB: f64 = 14.0;

fn block_len(sr: f64) -> usize {
    libm::round(BLOCK_SECONDS * sr).max(1.0) as usize
}

/// Multichannel block RMS: first take each channel's mean square per sample, then the RMS per block; a tail shorter than a block is discarded (same as the reference).
pub fn block_rms(chans: &[&[f32]], sr: f64) -> Vec<f64> {
    let blk = block_len(sr);
    let n = chans.iter().map(|c| c.len()).min().unwrap_or(0);
    let k = chans.len().max(1) as f64;
    (0..n / blk)
        .map(|b| {
            let mut acc = 0.0f64;
            for i in b * blk..(b + 1) * blk {
                acc += chans
                    .iter()
                    .map(|c| (c[i] as f64) * (c[i] as f64))
                    .sum::<f64>()
                    / k;
            }
            libm::sqrt(acc / blk as f64 + 1e-12)
        })
        .collect()
}

/// One-pole attack/release follower over a block sequence (`att` / `rel` seconds): rising uses the attack coefficient, falling uses the release coefficient.
pub fn follow(v: &[f64], att: f64, rel: f64) -> Vec<f64> {
    let a = libm::exp(-BLOCK_SECONDS / att);
    let r = libm::exp(-BLOCK_SECONDS / rel);
    let mut s = 0.0f64;
    v.iter()
        .map(|x| {
            s = if *x > s {
                a * s + (1.0 - a) * x
            } else {
                r * s + (1.0 - r) * x
            };
            s
        })
        .collect()
}

/// Block sequence → per-sample (linear interpolation at block centers, ends held).
pub fn blocks_to_samples(g: &[f64], n: usize, sr: f64) -> Vec<f32> {
    if g.is_empty() {
        return vec![0.0; n];
    }
    (0..n).map(|i| block_value_at(g, i, sr) as f32).collect()
}

/// Single-point version of [`blocks_to_samples`]: the value at sample `i` (`g` non-empty). Use it when streaming through a whole piece window by window, without spreading out the full per-sample curve.
pub fn block_value_at(g: &[f64], i: usize, sr: f64) -> f64 {
    let blk = block_len(sr) as f64;
    let pos = (i as f64 - blk / 2.0) / blk;
    if pos <= 0.0 {
        return g[0];
    }
    let j = pos as usize;
    if j + 1 >= g.len() {
        return g[g.len() - 1];
    }
    let u = pos - j as f64;
    g[j] + (g[j + 1] - g[j]) * u
}

/// Block RMS → activity block sequence: follow with `att` / `rel`; the dB value is linearly mapped from `floor_db` to `floor_db + range_db` and clamped to [0, 1].
pub fn activity_blocks(rms: &[f64], att: f64, rel: f64, floor_db: f64, range_db: f64) -> Vec<f64> {
    follow(rms, att, rel)
        .into_iter()
        .map(|v| (gain_to_db(v + 1e-9) - floor_db) / range_db)
        .map(|v| v.clamp(0.0, 1.0))
        .collect()
}

/// Continuous “someone is speaking” 0..1: the dB value of the dry-voice follower level (20 ms attack / 350 ms release) is linearly mapped from `floor_db` to `floor_db + range_db` and clamped to [0, 1]. Length `n`.
pub fn activity(chans: &[&[f32]], n: usize, sr: f64, floor_db: f64, range_db: f64) -> Vec<f32> {
    let e = activity_blocks(&block_rms(chans, sr), 0.02, 0.35, floor_db, range_db);
    blocks_to_samples(&e, n, sr)
}

/// Ducking gain: `db(−depth_db · activity)`; `depth_db` can vary per sample (ducks more deeply during storms).
pub fn duck_gain(activity: &[f32], depth_db: &[f32]) -> Vec<f32> {
    assert_eq!(activity.len(), depth_db.len(), "duck curves length");
    activity
        .iter()
        .zip(depth_db)
        .map(|(a, d)| db_to_gain(-(*d as f64) * *a as f64) as f32)
        .collect()
}

/// Glue compression parameters.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Glue {
    pub threshold_db: f64,
    pub ratio: f64,
    pub attack: f64,
    pub release: f64,
}

impl Default for Glue {
    /// 2:1 above −20 dBFS, 30 ms / 250 ms (reference project mastering).
    fn default() -> Self {
        Self {
            threshold_db: -20.0,
            ratio: 2.0,
            attack: 0.03,
            release: 0.25,
        }
    }
}

/// Glue compression per-sample gain (linear): the part of the follower level above the threshold is reduced by `1 − 1/ratio`.
pub fn glue_gain(chans: &[&[f32]], n: usize, sr: f64, glue: Glue) -> Vec<f32> {
    let slope = 1.0 - 1.0 / glue.ratio.max(1.0);
    let gr: Vec<f64> = follow(&block_rms(chans, sr), glue.attack, glue.release)
        .into_iter()
        .map(|v| (-(gain_to_db(v + 1e-9) - glue.threshold_db) * slope).min(0.0))
        .collect();
    blocks_to_samples(&gr, n, sr)
        .into_iter()
        .map(|d| db_to_gain(d as f64) as f32)
        .collect()
}

/// Apply glue compression in place to stereo.
pub fn glue_stereo(x: &mut Stereo, sr: f64, glue: Glue) {
    let g = glue_gain(&x.channels(), x.len(), sr, glue);
    x.apply_gain(&g);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::TAU;

    const SR: f64 = 48_000.0;

    fn tone(n: usize, amp: f64) -> Vec<f32> {
        (0..n)
            .map(|i| (amp * libm::sin(TAU * 440.0 * i as f64 / SR)) as f32)
            .collect()
    }

    #[test]
    fn follower_rises_fast_and_falls_slow() {
        let mut v = vec![1.0; 100];
        v.extend(vec![0.0; 100]);
        let f = follow(&v, 0.02, 0.35);
        assert!(f[10] > 0.95);
        assert!(f[110] > 0.7);
        assert!(f[199] < 0.1);
    }

    #[test]
    fn activity_is_zero_in_silence_and_one_on_speech_level() {
        let mut x = vec![0.0f32; 48_000];
        x.extend(tone(48_000, 0.1));
        let a = activity(&[&x], x.len(), SR, ACTIVITY_FLOOR_DB, ACTIVITY_RANGE_DB);
        assert_eq!(a[24_000], 0.0);
        assert!((a[90_000] - 1.0).abs() < 1e-6);
        let d = duck_gain(&a, &vec![12.0; a.len()]);
        assert!((gain_to_db(d[90_000] as f64) + 12.0).abs() < 1e-3);
        assert_eq!(d[100], 1.0);
    }

    #[test]
    fn glue_compresses_above_threshold_by_ratio() {
        // A sine peak of 0.5 → RMS ≈ −9 dBFS, 11 dB over the threshold, so 2:1 should reduce by 5.5 dB.
        let x = tone(96_000, 0.5);
        let g = glue_gain(&[&x], x.len(), SR, Glue::default());
        let gr = gain_to_db(g[80_000] as f64);
        let expect = -(gain_to_db(0.5 / core::f64::consts::SQRT_2) + 20.0) * 0.5;
        assert!((gr - expect).abs() < 0.1, "{gr} vs {expect}");
        let quiet = tone(96_000, 0.01);
        let gq = glue_gain(&[&quiet], quiet.len(), SR, Glue::default());
        assert!(gq.iter().all(|v| *v == 1.0));
        assert_eq!(g, glue_gain(&[&x], x.len(), SR, Glue::default()));
    }
}
