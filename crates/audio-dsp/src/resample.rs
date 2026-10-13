//! Whole-buffer resampling: Blackman-windowed sinc interpolation, using a polyphase kernel table ([`PHASES`] phases) that picks the nearest phase.
//!
//! For offline cases where the source's sample rate differs from the project's (for example, loading a 22.05 kHz narration WAV for the master score): the whole buffer is in memory and the result comes out in one pass. Transcendental functions only go through `libm`, so output is bit-identical across platforms. When downsampling, the cutoff and tap count scale proportionally to keep stopband attenuation.
//! Output sample `n` corresponds to source time `n / to` seconds (zero phase); out-of-range samples at both ends count as zero.
//!
//! The streaming decoder in `ccut-render` has a separate implementation that advances block by block (uses std floating point, and a golden test already pins its last bit). The two follow the same conventions, are implemented independently, and do not replace each other.

use crate::stereo::Stereo;

/// Base one-sided tap count (for upsampling; scaled up proportionally when downsampling).
const BASE_HALF: usize = 24;
/// Cutoff as a fraction of the new Nyquist frequency (leaves a little transition band).
const ROLLOFF: f64 = 0.94;
/// Number of phases in the kernel table.
pub const PHASES: usize = 256;

fn sinc(x: f64) -> f64 {
    if x.abs() < 1e-12 {
        1.0
    } else {
        let p = core::f64::consts::PI * x;
        libm::sin(p) / p
    }
}

fn blackman(x: f64) -> f64 {
    // x ∈ [-1, 1], zero at both ends.
    if x.abs() >= 1.0 {
        return 0.0;
    }
    let u = core::f64::consts::PI * (x + 1.0);
    0.42 - 0.5 * libm::cos(u) + 0.08 * libm::cos(2.0 * u)
}

struct Kernel {
    half: usize,
    step: f64,
    taps: Vec<f64>,
}

impl Kernel {
    fn new(from: f64, to: f64) -> Self {
        let step = from / to;
        let scale = step.max(1.0);
        let half = libm::ceil(BASE_HALF as f64 * scale) as usize;
        let cutoff = ROLLOFF * 0.5 / scale;
        let len = 2 * half + 1;
        let mut taps = vec![0.0f64; PHASES * len];
        for p in 0..PHASES {
            let frac = p as f64 / PHASES as f64;
            let row = &mut taps[p * len..(p + 1) * len];
            let mut sum = 0.0;
            for (k, t) in row.iter_mut().enumerate() {
                let d = k as f64 - half as f64 - frac;
                *t = 2.0 * cutoff * sinc(2.0 * cutoff * d) * blackman(d / (half as f64 + 1.0));
                sum += *t;
            }
            for t in row.iter_mut() {
                *t /= sum;
            }
        }
        Self { half, step, taps }
    }

    fn run(&self, x: &[f32], out_len: usize) -> Vec<f32> {
        let len = 2 * self.half + 1;
        (0..out_len)
            .map(|n| {
                let c = n as f64 * self.step;
                let fl = libm::floor(c);
                let phase = (((c - fl) * PHASES as f64) as usize).min(PHASES - 1);
                let row = &self.taps[phase * len..(phase + 1) * len];
                let first = fl as i64 - self.half as i64;
                let mut acc = 0.0f64;
                for (k, w) in row.iter().enumerate() {
                    let i = first + k as i64;
                    if i >= 0 && (i as usize) < x.len() {
                        acc += x[i as usize] as f64 * w;
                    }
                }
                acc as f32
            })
            .collect()
    }
}

/// Output length: `round(len · to / from)`.
pub fn output_len(len: usize, from: f64, to: f64) -> usize {
    let n = libm::round(len as f64 * to / from);
    if n > 0.0 { n as usize } else { 0 }
}

/// Mono, `from` Hz → `to` Hz. If the two rates are the same (differ by < 0.5 Hz), copies the input unchanged.
pub fn resample(x: &[f32], from: f64, to: f64) -> Vec<f32> {
    if (from - to).abs() < 0.5 || x.is_empty() {
        return x.to_vec();
    }
    Kernel::new(from, to).run(x, output_len(x.len(), from, to))
}

/// Stereo, `from` Hz → `to` Hz (both channels share one set of kernels, so there is no inter-channel phase difference).
pub fn resample_stereo(x: &Stereo, from: f64, to: f64) -> Stereo {
    if (from - to).abs() < 0.5 || x.l.is_empty() {
        return x.clone();
    }
    let k = Kernel::new(from, to);
    let n = output_len(x.l.len(), from, to);
    Stereo {
        l: k.run(&x.l, n),
        r: k.run(&x.r, n),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::TAU;

    fn tone(f: f64, sr: f64, secs: f64) -> Vec<f32> {
        (0..(sr * secs) as usize)
            .map(|i| (libm::sin(TAU * f * i as f64 / sr) * 0.5) as f32)
            .collect()
    }

    fn rms(x: &[f32]) -> f64 {
        (x.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / x.len() as f64).sqrt()
    }

    #[test]
    fn identity_and_lengths() {
        let x = tone(440.0, 48_000.0, 0.1);
        assert_eq!(resample(&x, 48_000.0, 48_000.0), x);
        assert_eq!(output_len(22_050, 22_050.0, 48_000.0), 48_000);
        assert_eq!(
            resample(&tone(440.0, 22_050.0, 1.0), 22_050.0, 48_000.0).len(),
            48_000
        );
        assert_eq!(
            resample(&tone(440.0, 48_000.0, 1.0), 48_000.0, 16_000.0).len(),
            16_000
        );
    }

    #[test]
    fn passband_tone_keeps_level_and_phase() {
        // 1 kHz @ 22.05 kHz → 48 kHz: the middle section should nearly match the same sine generated directly at 48 kHz.
        let up = resample(&tone(1000.0, 22_050.0, 1.0), 22_050.0, 48_000.0);
        let want = tone(1000.0, 48_000.0, 1.0);
        let mid = 4_800..43_200;
        let err: f64 = up[mid.clone()]
            .iter()
            .zip(&want[mid.clone()])
            .map(|(a, b)| ((*a - *b) as f64).abs())
            .fold(0.0, f64::max);
        assert!(err < 2e-3, "max err {err}");
        assert!((rms(&up[mid]) / (0.5 / 2f64.sqrt()) - 1.0).abs() < 1e-3);
    }

    #[test]
    fn downsampling_rejects_above_new_nyquist() {
        // 20 kHz @ 48 kHz → 16 kHz: above the new 8 kHz Nyquist, it should be suppressed below −60 dB.
        let down = resample(&tone(20_000.0, 48_000.0, 1.0), 48_000.0, 16_000.0);
        let r = rms(&down[1_600..14_400]) / (0.5 / 2f64.sqrt());
        assert!(20.0 * r.log10() < -60.0, "leak {}", 20.0 * r.log10());
    }

    #[test]
    fn stereo_matches_mono_per_channel_and_is_deterministic() {
        let l = tone(300.0, 44_100.0, 0.2);
        let r = tone(700.0, 44_100.0, 0.2);
        let s = resample_stereo(
            &Stereo {
                l: l.clone(),
                r: r.clone(),
            },
            44_100.0,
            48_000.0,
        );
        assert_eq!(s.l, resample(&l, 44_100.0, 48_000.0));
        assert_eq!(s.r, resample(&r, 44_100.0, 48_000.0));
        assert_eq!(s, resample_stereo(&Stereo { l, r }, 44_100.0, 48_000.0));
    }
}
