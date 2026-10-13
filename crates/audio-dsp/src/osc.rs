//! Oscillators: per-sample frequency → phase accumulation; polyBLEP band-limited sawtooth / square; sine.
//!
//! The frequency curve is `&[f64]` (one Hz value per sample), and the phase accumulates as `phase0 + Σ f/sr` (the first sample already includes its own step, matching the reference project's `np.cumsum`); accumulation is done in `f64` so long notes do not drift.

use crate::math::TAU;

/// Accumulated phase (in cycles, not wrapped modulo 1).
pub fn phase_cycles(freq: &[f64], sr: f64, phase0: f64) -> Vec<f64> {
    let mut acc = phase0;
    freq.iter()
        .map(|f| {
            acc += f / sr;
            acc
        })
        .collect()
}

/// Accumulated phase (radians), for additive synthesis `sin(k·φ + θ)`.
pub fn phase_radians(freq: &[f64], sr: f64) -> Vec<f64> {
    let mut acc = 0.0;
    freq.iter()
        .map(|f| {
            acc += TAU * f / sr;
            acc
        })
        .collect()
}

fn poly_blep(t: f64, dt: f64) -> f64 {
    if dt <= 0.0 {
        return 0.0;
    }
    if t < dt {
        let x = t / dt;
        x + x - x * x - 1.0
    } else if t > 1.0 - dt {
        let x = (t - 1.0) / dt;
        x * x + x + x + 1.0
    } else {
        0.0
    }
}

/// Band-limited sawtooth (−1..1, rising edge); `phase0` is the starting phase (in cycles).
pub fn saw(freq: &[f64], sr: f64, phase0: f64) -> Vec<f32> {
    let mut ph = phase0 - libm::floor(phase0);
    freq.iter()
        .map(|f| {
            let dt = (f / sr).abs().min(0.5);
            ph += f / sr;
            ph -= libm::floor(ph);
            (2.0 * ph - 1.0 - poly_blep(ph, dt)) as f32
        })
        .collect()
}

/// Band-limited square wave (duty cycle `duty`, 0..1).
pub fn square(freq: &[f64], sr: f64, phase0: f64, duty: f64) -> Vec<f32> {
    let duty = duty.clamp(0.01, 0.99);
    let mut ph = phase0 - libm::floor(phase0);
    freq.iter()
        .map(|f| {
            let dt = (f / sr).abs().min(0.5);
            ph += f / sr;
            ph -= libm::floor(ph);
            let mut y = if ph < duty { 1.0 } else { -1.0 };
            y += poly_blep(ph, dt);
            let shifted = {
                let s = ph + 1.0 - duty;
                s - libm::floor(s)
            };
            y -= poly_blep(shifted, dt);
            y as f32
        })
        .collect()
}

/// Sine (phase accumulated from the frequency curve).
pub fn sine(freq: &[f64], sr: f64, phase0: f64) -> Vec<f32> {
    phase_cycles(freq, sr, phase0)
        .into_iter()
        .map(|c| libm::sin(TAU * c) as f32)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{Fft, next_pow2};

    const SR: f64 = 48_000.0;

    /// Fraction of the power spectrum's energy in `lo..hi` Hz.
    fn band_fraction(x: &[f32], lo: f64, hi: f64) -> f64 {
        let n = next_pow2(x.len());
        let fft = Fft::new(n);
        let mut re: Vec<f64> = x.iter().map(|v| *v as f64).collect();
        re.resize(n, 0.0);
        let mut im = vec![0.0; n];
        fft.forward(&mut re, &mut im);
        let (mut band, mut total) = (0.0, 0.0);
        for k in 1..n / 2 {
            let p = re[k] * re[k] + im[k] * im[k];
            let f = k as f64 * SR / n as f64;
            total += p;
            if f >= lo && f < hi {
                band += p;
            }
        }
        band / total
    }

    #[test]
    fn blep_saw_has_less_aliasing_than_naive() {
        let n = 32_768;
        let f = 3_111.0;
        let freq = vec![f; n];
        let blep = saw(&freq, SR, 0.0);
        let naive: Vec<f32> = phase_cycles(&freq, SR, 0.0)
            .into_iter()
            .map(|c| (2.0 * (c - libm::floor(c)) - 1.0) as f32)
            .collect();
        // Harmonics of 3111 Hz that land above 20 kHz fold back. Comparing spurious energy below 20 kHz at non-harmonic bins is inconvenient, so this compares the energy in the top band (20–24 kHz) directly: the less folding, the lower it is.
        let a = band_fraction(&blep, 20_000.0, 24_000.0);
        let b = band_fraction(&naive, 20_000.0, 24_000.0);
        assert!(a < b * 0.5, "blep {a} naive {b}");
        assert!(blep.iter().all(|v| v.abs() <= 1.2));
    }

    #[test]
    fn square_is_balanced_and_sine_has_unit_peak() {
        let freq = vec![500.0; 48_000];
        let sq = square(&freq, SR, 0.0, 0.5);
        let mean = sq.iter().map(|v| *v as f64).sum::<f64>() / sq.len() as f64;
        assert!(mean.abs() < 0.01);
        let s = sine(&freq, SR, 0.0);
        let peak = s.iter().fold(0.0f32, |m, v| m.max(v.abs()));
        assert!((peak - 1.0).abs() < 1e-3);
        assert_eq!(saw(&freq, SR, 0.3), saw(&freq, SR, 0.3));
    }
}
