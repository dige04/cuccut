//! Time-varying low-pass: a set of fixed cutoffs (90 Hz–15 kHz, 16 logarithmically spaced steps, each a second-order Butterworth) plus one bypass step.
//! Based on the per-sample cutoff frequency, it cross-fades linearly between adjacent steps (the reference project's `tv_lp`).
//!
//! More stable than recomputing coefficients per sample: there are no clicks from sudden coefficient changes, and no instability from a time-varying IIR; the cost is that the cutoff can only be mixed linearly between steps (one step per half octave, which the ear cannot hear).

use crate::biquad::Cascade;

const BANK_LO: f64 = 90.0;
const BANK_HI: f64 = 15_000.0;
const BANK_SIZE: usize = 16;
const TOP: f64 = 20_000.0;

fn bank() -> Vec<f64> {
    let (lo, hi) = (libm::log(BANK_LO), libm::log(BANK_HI));
    (0..BANK_SIZE)
        .map(|k| libm::exp(lo + (hi - lo) * k as f64 / (BANK_SIZE - 1) as f64))
        .collect()
}

/// Cutoff frequency → step position (a fraction in `0..=16`; 16 is bypass).
fn position(fc: f64, edges: &[f64]) -> f64 {
    let v = libm::log(fc.clamp(BANK_LO, TOP));
    if v <= edges[0] {
        return 0.0;
    }
    for k in 0..edges.len() - 1 {
        if v <= edges[k + 1] {
            return k as f64 + (v - edges[k]) / (edges[k + 1] - edges[k]);
        }
    }
    (edges.len() - 1) as f64
}

/// Low-pass with a per-sample cutoff. `fc.len()` must equal `x.len()` (for a constant cutoff use [`tv_lowpass_const`]).
pub fn tv_lowpass(x: &[f32], sr: f64, fc: &[f32]) -> Vec<f32> {
    assert_eq!(
        x.len(),
        fc.len(),
        "tv_lowpass: cutoff curve must match the signal length"
    );
    let n = x.len();
    let freqs = bank();
    let mut edges: Vec<f64> = freqs.iter().map(|f| libm::log(*f)).collect();
    edges.push(libm::log(TOP));
    let pos: Vec<f64> = fc.iter().map(|f| position(*f as f64, &edges)).collect();
    let mut out = vec![0.0f32; n];
    for k in 0..edges.len() {
        // Where this step has weight; filtering starts 4096 samples before that section, so the filter settles into steady state first.
        let weight = |i: usize| (1.0 - (pos[i] - k as f64).abs()).clamp(0.0, 1.0);
        let Some(first) = (0..n).find(|i| weight(*i) > 0.0) else {
            continue;
        };
        let last = (0..n).rev().find(|i| weight(*i) > 0.0).unwrap_or(first);
        if k == BANK_SIZE {
            for i in first..=last {
                out[i] += (x[i] as f64 * weight(i)) as f32;
            }
            continue;
        }
        let start = first.saturating_sub(4096);
        let mut y = x[start..=last].to_vec();
        Cascade::butter_lowpass(sr, freqs[k], 2).process(&mut y);
        for i in first..=last {
            out[i] += (y[i - start] as f64 * weight(i)) as f32;
        }
    }
    out
}

/// Time-varying low-pass for a constant cutoff (equivalent to a fixed filter lying between two steps).
pub fn tv_lowpass_const(x: &[f32], sr: f64, fc: f64) -> Vec<f32> {
    tv_lowpass(x, sr, &vec![fc as f32; x.len()])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::TAU;

    const SR: f64 = 48_000.0;

    fn rms(x: &[f32]) -> f64 {
        libm::sqrt(x.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / x.len() as f64)
    }

    #[test]
    fn sweeping_cutoff_opens_the_high_band() {
        let n = 96_000;
        let x: Vec<f32> = (0..n)
            .map(|i| libm::sin(TAU * 5000.0 * i as f64 / SR) as f32)
            .collect();
        // The first 0.8 s hold at 300 Hz, 0.8–1.2 s sweep up to 19 kHz, then hold.
        let fc: Vec<f32> = (0..n)
            .map(|i| {
                crate::curve::keys_smooth(&[(0.8, 300.0), (1.2, 19_000.0)], i as f64 / SR) as f32
            })
            .collect();
        let y = tv_lowpass(&x, SR, &fc);
        let early = rms(&y[9600..33_600]);
        let late = rms(&y[n - 9600..]);
        assert!(early < 0.02, "early {early}");
        assert!(late > 0.6, "late {late}");
    }

    #[test]
    fn top_slot_is_bypass() {
        let mut rng = crate::Rng::new(9);
        let x = rng.normals(4800);
        let y = tv_lowpass_const(&x, SR, 20_000.0);
        assert_eq!(x, y);
    }

    #[test]
    fn deterministic() {
        let mut rng = crate::Rng::new(9);
        let x = rng.normals(20_000);
        let fc: Vec<f32> = (0..20_000).map(|i| 100.0 + i as f32).collect();
        assert_eq!(tv_lowpass(&x, SR, &fc), tv_lowpass(&x, SR, &fc));
    }
}
