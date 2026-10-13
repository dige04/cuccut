//! Sample-rate conversion (pure logic, compiled on all platforms).
//!
//! HTDemucs only works at 44.1 kHz; inputs at 48 kHz / 16 kHz etc. are first converted to 44.1 kHz, and after separation the output is directly at 44.1 kHz. The implementation is Hann-windowed sinc interpolation (`TAPS` taps on each side), and when downsampling the cutoff is set to the target Nyquist; this is accurate enough for dubbing, but not libsamplerate-level precision.

const TAPS: usize = 32;

/// Resamples `input` from `from` Hz to `to` Hz. Returns it unchanged when the rates are the same.
pub fn resample(input: &[f32], from: u32, to: u32) -> Vec<f32> {
    if from == to || input.is_empty() || from == 0 || to == 0 {
        return input.to_vec();
    }
    let ratio = f64::from(to) / f64::from(from);
    let out_len = ((input.len() as f64) * ratio).round().max(1.0) as usize;
    // When downsampling, widen the sinc to the target Nyquist to prevent aliasing.
    let cutoff = ratio.min(1.0);
    let half_width = (TAPS as f64 / cutoff).ceil() as isize;
    let mut out = Vec::with_capacity(out_len);
    for n in 0..out_len {
        let center = n as f64 / ratio;
        let base = center.floor() as isize;
        let mut acc = 0.0f64;
        let mut norm = 0.0f64;
        for i in (base - half_width + 1)..=(base + half_width) {
            if i < 0 || i >= input.len() as isize {
                continue;
            }
            let d = center - i as f64;
            let w = hann_sinc(d * cutoff, half_width as f64);
            acc += f64::from(input[i as usize]) * w;
            norm += w;
        }
        out.push(if norm.abs() > 1e-12 { (acc / norm) as f32 } else { 0.0 });
    }
    out
}

fn hann_sinc(x: f64, half_width: f64) -> f64 {
    let sinc = if x.abs() < 1e-9 {
        1.0
    } else {
        let px = std::f64::consts::PI * x;
        px.sin() / px
    };
    // Position normalized to [-1, 1], then apply the Hann window.
    let t = x / half_width;
    if t.abs() >= 1.0 {
        return 0.0;
    }
    sinc * 0.5 * (1.0 + (std::f64::consts::PI * t).cos())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(len: usize, rate: u32, freq: f64) -> Vec<f32> {
        (0..len)
            .map(|i| (2.0 * std::f64::consts::PI * freq * i as f64 / f64::from(rate)).sin() as f32)
            .collect()
    }

    fn check_sine(from: u32, to: u32, freq: f64) {
        let input = sine(from as usize, from, freq); // 1 second
        let out = resample(&input, from, to);
        assert!((out.len() as i64 - to as i64).abs() <= 1, "长度 {}", out.len());
        let expected = sine(out.len(), to, freq);
        // Ignore edge effects of 100 samples at each end.
        let err = out
            .iter()
            .zip(&expected)
            .skip(100)
            .take(out.len() - 200)
            .map(|(a, b)| (a - b).abs())
            .fold(0.0f32, f32::max);
        assert!(err < 2e-3, "{from}->{to} @ {freq} Hz 误差 {err}");
    }

    #[test]
    fn same_rate_is_identity() {
        let x = vec![0.1, 0.2, 0.3];
        assert_eq!(resample(&x, 44_100, 44_100), x);
        assert!(resample(&[], 16_000, 44_100).is_empty());
    }

    #[test]
    fn upsample_preserves_sine() {
        check_sine(16_000, 44_100, 440.0);
        check_sine(16_000, 44_100, 3_000.0);
    }

    #[test]
    fn downsample_preserves_sine() {
        check_sine(48_000, 44_100, 1_000.0);
        check_sine(48_000, 44_100, 8_000.0);
    }

    #[test]
    fn downsample_attenuates_above_new_nyquist() {
        // 23 kHz at 48k exceeds the Nyquist frequency at 44.1k, so it should be clearly attenuated rather than aliased back.
        let input = sine(48_000, 48_000, 23_000.0);
        let out = resample(&input, 48_000, 44_100);
        let rms = (out.iter().skip(200).map(|v| v * v).sum::<f32>() / (out.len() - 200) as f32).sqrt();
        assert!(rms < 0.2, "rms {rms}");
    }
}
