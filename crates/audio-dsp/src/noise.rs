//! Noise: white noise (Gaussian) and colored noise shaped in the frequency domain (power ∝ f^−slope: 0 white, 1 pink, 2 brown).

use crate::fft::{Fft, next_pow2};
use crate::rng::Rng;

/// `n` standard normal samples.
pub fn white(n: usize, rng: &mut Rng) -> Vec<f32> {
    rng.normals(n)
}

/// Colored noise, normalized to unit RMS. In the frequency domain, zero-padded to a power-of-two length, multiply by `f^(−slope/2)`, and below 18 Hz further attenuate by `(f/18)²`
/// (so brown noise's DC drift does not eat the dynamic range). After the inverse transform, truncate back to `n`.
pub fn colored(n: usize, sr: f64, slope: f64, rng: &mut Rng) -> Vec<f32> {
    if n == 0 {
        return Vec::new();
    }
    let size = next_pow2(n);
    let fft = Fft::new(size);
    let mut re: Vec<f64> = (0..size).map(|_| rng.normal()).collect();
    let mut im = vec![0.0; size];
    fft.forward(&mut re, &mut im);
    let bin_hz = sr / size as f64;
    for k in 0..size {
        let kk = if k <= size / 2 { k } else { size - k };
        let f = (kk.max(1)) as f64 * bin_hz;
        let mut g = libm::pow(f, -slope / 2.0);
        if f < 18.0 {
            g *= (f / 18.0) * (f / 18.0);
        }
        re[k] *= g;
        im[k] *= g;
    }
    fft.inverse(&mut re, &mut im);
    re.truncate(n);
    let mean = re.iter().sum::<f64>() / n as f64;
    let var = re.iter().map(|v| (v - mean) * (v - mean)).sum::<f64>() / n as f64;
    let scale = 1.0 / (libm::sqrt(var) + 1e-12);
    re.into_iter().map(|v| (v * scale) as f32).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::biquad::{highpass, lowpass};

    const SR: f64 = 48_000.0;

    fn power(x: &[f32]) -> f64 {
        x.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / x.len() as f64
    }

    #[test]
    fn slope_tilts_energy_toward_lows() {
        let n = 96_000;
        let tilt = |slope: f64| {
            let x = colored(n, SR, slope, &mut Rng::new(4));
            let low = power(&lowpass(&x, SR, 500.0, 4));
            let high = power(&highpass(&x, SR, 4000.0, 4));
            crate::math::gain_to_db(libm::sqrt(low / high))
        };
        let (white, pink, brown) = (tilt(0.0), tilt(1.0), tilt(2.0));
        assert!(white < -10.0, "white {white}");
        assert!(
            pink > white + 8.0 && brown > pink + 8.0,
            "{white} {pink} {brown}"
        );
    }

    #[test]
    fn unit_rms_and_deterministic() {
        let a = colored(10_000, SR, 1.0, &mut Rng::new(1));
        assert!((power(&a) - 1.0).abs() < 1e-3);
        assert_eq!(a, colored(10_000, SR, 1.0, &mut Rng::new(1)));
        assert_ne!(a, colored(10_000, SR, 1.0, &mut Rng::new(2)));
    }
}
