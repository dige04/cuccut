//! Delay and phase alignment: integer / fractional delay, FFT cross-correlation to find the time offset and polarity, and aligning one signal to a reference.

use crate::fft::{Fft, next_pow2};

/// Integer delay (positive shifts later, negative pulls earlier); length unchanged, vacated positions are zero-filled.
pub fn delay(x: &[f32], lag: isize) -> Vec<f32> {
    let n = x.len() as isize;
    (0..n)
        .map(|i| {
            let j = i - lag;
            if j < 0 || j >= n { 0.0 } else { x[j as usize] }
        })
        .collect()
}

/// Fractional delay (seconds, may be negative): the integer part is a direct shift; the fractional part is interpolated with a Kaiser-windowed sinc (16 taps on each side).
pub fn fractional_delay(x: &[f32], seconds: f64, sr: f64) -> Vec<f32> {
    let d = seconds * sr;
    let whole = libm::floor(d);
    let frac = d - whole;
    let shifted = delay(x, whole as isize);
    if frac == 0.0 {
        return shifted;
    }
    const HALF: isize = 16;
    let i0 = |v: f64| {
        let (mut sum, mut term, q) = (1.0, 1.0, v * v / 4.0);
        for k in 1..64 {
            term *= q / (k as f64 * k as f64);
            sum += term;
        }
        sum
    };
    let beta = 8.0;
    let mut taps = Vec::with_capacity(2 * HALF as usize);
    for k in -HALF + 1..=HALF {
        // y[i] = Σ x[i − k] · h(k − frac)
        let t = k as f64 - frac;
        let pi = core::f64::consts::PI;
        let sinc = if t == 0.0 {
            1.0
        } else {
            libm::sin(pi * t) / (pi * t)
        };
        let r = t / HALF as f64;
        let w = if r.abs() >= 1.0 {
            0.0
        } else {
            i0(beta * libm::sqrt(1.0 - r * r)) / i0(beta)
        };
        taps.push((k, sinc * w));
    }
    let norm: f64 = taps.iter().map(|(_, h)| h).sum();
    let n = shifted.len() as isize;
    (0..n)
        .map(|i| {
            let mut v = 0.0;
            for (k, h) in &taps {
                let j = i - k;
                if (0..n).contains(&j) {
                    v += shifted[j as usize] as f64 * h;
                }
            }
            (v / norm) as f32
        })
        .collect()
}

/// Cross-correlation result.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Lag {
    /// How many samples `x` is later than `reference` (positive: `x` must be pulled earlier by this much to align).
    pub lag: isize,
    /// Normalized correlation coefficient at this offset (−1..1); a negative value means opposite polarity.
    pub correlation: f64,
}

/// Find the offset of `x` relative to `reference` within `±max_lag`, maximizing |correlation| (FFT cross-correlation).
pub fn find_lag(reference: &[f32], x: &[f32], max_lag: usize) -> Lag {
    let n = reference.len().max(x.len());
    let size = next_pow2(n + max_lag + 1).max(2);
    let fft = Fft::new(size);
    let mut ar: Vec<f64> = reference.iter().map(|v| *v as f64).collect();
    ar.resize(size, 0.0);
    let mut ai = vec![0.0; size];
    let mut br: Vec<f64> = x.iter().map(|v| *v as f64).collect();
    br.resize(size, 0.0);
    let mut bi = vec![0.0; size];
    fft.forward(&mut ar, &mut ai);
    fft.forward(&mut br, &mut bi);
    // conj(A) · B → r[k] = Σ a[i] · b[i + k]
    let mut cr = vec![0.0; size];
    let mut ci = vec![0.0; size];
    for k in 0..size {
        cr[k] = ar[k] * br[k] + ai[k] * bi[k];
        ci[k] = ar[k] * bi[k] - ai[k] * br[k];
    }
    fft.inverse(&mut cr, &mut ci);
    let ea: f64 = reference.iter().map(|v| (*v as f64).powi(2)).sum();
    let eb: f64 = x.iter().map(|v| (*v as f64).powi(2)).sum();
    let norm = libm::sqrt(ea * eb) + 1e-30;
    let mut best = Lag {
        lag: 0,
        correlation: 0.0,
    };
    let max_lag = max_lag as isize;
    for lag in -max_lag..=max_lag {
        let idx = if lag >= 0 {
            lag as usize
        } else {
            (size as isize + lag) as usize
        };
        let c = cr[idx] / norm;
        if c.abs() > best.correlation.abs() + 1e-12 {
            best = Lag {
                lag,
                correlation: c,
            };
        }
    }
    best
}

/// Align `x` to `reference`: shift by [`find_lag`], and flip if the polarity is opposite. Returns the aligned signal and the offset.
pub fn align_to(reference: &[f32], x: &[f32], max_lag: usize) -> (Vec<f32>, Lag) {
    let lag = find_lag(reference, x, max_lag);
    let mut y = delay(x, -lag.lag);
    if lag.correlation < 0.0 {
        for v in y.iter_mut() {
            *v = -*v;
        }
    }
    (y, lag)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::TAU;
    use crate::rng::Rng;

    #[test]
    fn finds_lag_and_polarity() {
        let a = Rng::new(1).normals(8000);
        let b: Vec<f32> = delay(&a, 37).iter().map(|v| -v).collect();
        let l = find_lag(&a, &b, 100);
        assert_eq!(l.lag, 37);
        assert!(l.correlation < -0.9);
        let (y, _) = align_to(&a, &b, 100);
        assert_eq!(y[1000], a[1000]);
        let c = delay(&a, -12);
        assert_eq!(find_lag(&a, &c, 50).lag, -12);
    }

    #[test]
    fn fractional_delay_shifts_a_sine() {
        let sr = 48_000.0;
        let f = 1000.0;
        let x: Vec<f32> = (0..4800)
            .map(|i| libm::sin(TAU * f * i as f64 / sr) as f32)
            .collect();
        let y = fractional_delay(&x, 2.5 / sr, sr);
        for i in 100..4700 {
            let want = libm::sin(TAU * f * (i as f64 - 2.5) / sr);
            assert!((y[i] as f64 - want).abs() < 2e-3, "{i}: {} vs {want}", y[i]);
        }
        assert_eq!(delay(&[1.0, 2.0, 3.0], 1), vec![0.0, 1.0, 2.0]);
    }
}
