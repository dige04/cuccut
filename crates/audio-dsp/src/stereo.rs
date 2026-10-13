//! Stereo container (planar), constant-power panning, fades, peak / RMS normalization, DC removal.

use crate::math::samples;

/// Planar stereo: two channels of equal length. All DSP processes each channel separately; interleaving, when needed, is done by the caller at encode time.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Stereo {
    pub l: Vec<f32>,
    pub r: Vec<f32>,
}

impl Stereo {
    /// Silence of `n` samples.
    pub fn zeros(n: usize) -> Self {
        Self {
            l: vec![0.0; n],
            r: vec![0.0; n],
        }
    }

    /// Both channels are `x` (no panning compensation).
    pub fn dual_mono(x: &[f32]) -> Self {
        Self {
            l: x.to_vec(),
            r: x.to_vec(),
        }
    }

    /// Splits interleaved `[l0, r0, l1, r1, …]`.
    pub fn from_interleaved(x: &[f32]) -> Self {
        Self {
            l: x.iter().step_by(2).copied().collect(),
            r: x.iter().skip(1).step_by(2).copied().collect(),
        }
    }

    /// Interleaves into `[l0, r0, l1, r1, …]`.
    pub fn interleaved(&self) -> Vec<f32> {
        self.l
            .iter()
            .zip(&self.r)
            .flat_map(|(a, b)| [*a, *b])
            .collect()
    }

    pub fn len(&self) -> usize {
        self.l.len()
    }

    pub fn is_empty(&self) -> bool {
        self.l.is_empty()
    }

    /// Truncates or zero-pads to `n`.
    pub fn resize(&mut self, n: usize) {
        self.l.resize(n, 0.0);
        self.r.resize(n, 0.0);
    }

    /// Multiplies both channels by `g`.
    pub fn scale(&mut self, g: f64) {
        for v in self.l.iter_mut().chain(self.r.iter_mut()) {
            *v = (*v as f64 * g) as f32;
        }
    }

    /// Multiplies both channels sample by sample by the gain curve `g` (lengths must match).
    pub fn apply_gain(&mut self, g: &[f32]) {
        assert_eq!(g.len(), self.len(), "gain curve length");
        for ((l, r), g) in self.l.iter_mut().zip(self.r.iter_mut()).zip(g) {
            *l *= *g;
            *r *= *g;
        }
    }

    /// Mixes `other × gain` in starting at `offset` (`offset` may be negative; out-of-range parts are dropped).
    pub fn add_at(&mut self, other: &Stereo, offset: isize, gain: f64) {
        add_into(&mut self.l, &other.l, offset, gain);
        add_into(&mut self.r, &other.r, offset, gain);
    }

    /// Sample peak (linear, the larger of the two channels).
    pub fn peak(&self) -> f64 {
        peak(&self.l).max(peak(&self.r))
    }

    /// `(l + r) / 2`。
    pub fn to_mono(&self) -> Vec<f32> {
        self.l
            .iter()
            .zip(&self.r)
            .map(|(a, b)| ((*a as f64 + *b as f64) * 0.5) as f32)
            .collect()
    }

    /// Slice view of the two channels, for the multi-channel entry point.
    pub fn channels(&self) -> [&[f32]; 2] {
        [&self.l, &self.r]
    }
}

/// `dst[offset..] += src × gain`, truncated at the bounds.
pub fn add_into(dst: &mut [f32], src: &[f32], offset: isize, gain: f64) {
    let n = dst.len() as isize;
    let a = offset.max(0);
    let b = (offset + src.len() as isize).min(n);
    for i in a..b {
        let v = &mut dst[i as usize];
        *v = (*v as f64 + src[(i - offset) as usize] as f64 * gain) as f32;
    }
}

/// Sample peak (linear).
pub fn peak(x: &[f32]) -> f64 {
    x.iter().fold(0.0f64, |m, v| m.max((*v as f64).abs()))
}

/// RMS (linear).
pub fn rms(x: &[f32]) -> f64 {
    if x.is_empty() {
        return 0.0;
    }
    libm::sqrt(x.iter().map(|v| (*v as f64) * (*v as f64)).sum::<f64>() / x.len() as f64)
}

/// Left and right gains for constant-power panning: `p ∈ [−1, 1]`, θ = (p+1)·π/4, `(cos θ, sin θ)·√2` (both sides are 1 when centered,
/// the same convention as the reference project's `pan2`: a mono signal placed in the middle does not lose level).
pub fn pan_gains(p: f64) -> (f64, f64) {
    let a = (p.clamp(-1.0, 1.0) + 1.0) * core::f64::consts::FRAC_PI_4;
    let (s, c) = libm::sincos(a);
    (c * core::f64::consts::SQRT_2, s * core::f64::consts::SQRT_2)
}

/// Mono → stereo (constant-power panning).
pub fn pan_mono(x: &[f32], p: f64) -> Stereo {
    let (gl, gr) = pan_gains(p);
    Stereo {
        l: x.iter().map(|v| (*v as f64 * gl) as f32).collect(),
        r: x.iter().map(|v| (*v as f64 * gr) as f32).collect(),
    }
}

/// Stereo pan as a whole: multiplies left and right each by [`pan_gains`] (unchanged at `p = 0`).
pub fn pan_stereo(x: &mut Stereo, p: f64) {
    if p == 0.0 {
        return;
    }
    let (gl, gr) = pan_gains(p);
    for v in x.l.iter_mut() {
        *v = (*v as f64 * gl) as f32;
    }
    for v in x.r.iter_mut() {
        *v = (*v as f64 * gr) as f32;
    }
}

/// Linear fade-in over `a` seconds and fade-out over `b` seconds (in place). Fade-in envelope `linspace(0, 1, na)`, fade-out `linspace(1, 0, nb)`,
/// the same as the reference project's `fade`.
pub fn fade(x: &mut [f32], sr: f64, a: f64, b: f64) {
    let n = x.len();
    let na = samples(a, sr).min(n);
    let nb = samples(b, sr).min(n);
    let ramp = |i: usize, m: usize| {
        if m <= 1 {
            0.0
        } else {
            i as f64 / (m - 1) as f64
        }
    };
    for i in 0..na {
        x[i] = (x[i] as f64 * ramp(i, na)) as f32;
    }
    for i in 0..nb {
        let k = n - nb + i;
        x[k] = (x[k] as f64 * (1.0 - ramp(i, nb))) as f32;
    }
}

/// Same fade-in and fade-out applied to both stereo channels.
pub fn fade_stereo(x: &mut Stereo, sr: f64, a: f64, b: f64) {
    fade(&mut x.l, sr, a, b);
    fade(&mut x.r, sr, a, b);
}

/// Normalizes to peak `v` (linear).
pub fn peak_normalize(x: &mut [f32], v: f64) {
    let g = v / (peak(x) + 1e-12);
    for s in x.iter_mut() {
        *s = (*s as f64 * g) as f32;
    }
}

/// Normalizes to RMS `v` (linear).
pub fn rms_normalize(x: &mut [f32], v: f64) {
    let g = v / (rms(x) + 1e-12);
    for s in x.iter_mut() {
        *s = (*s as f64 * g) as f32;
    }
}

/// Subtracts the mean of the whole signal (DC removal).
pub fn remove_dc(x: &mut [f32]) {
    if x.is_empty() {
        return;
    }
    let mean = x.iter().map(|v| *v as f64).sum::<f64>() / x.len() as f64;
    for s in x.iter_mut() {
        *s = (*s as f64 - mean) as f32;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pan_is_equal_power_and_unity_at_centre() {
        let (l, r) = pan_gains(0.0);
        assert!((l - 1.0).abs() < 1e-12 && (r - 1.0).abs() < 1e-12);
        for p in [-1.0, -0.4, 0.3, 1.0] {
            let (l, r) = pan_gains(p);
            assert!((l * l + r * r - 2.0).abs() < 1e-12);
        }
        let (l, r) = pan_gains(1.0);
        assert!(l.abs() < 1e-12 && r > 1.4);
    }

    #[test]
    fn fades_and_normalizers() {
        let mut x = vec![1.0f32; 1000];
        fade(&mut x, 1000.0, 0.1, 0.2);
        assert_eq!(x[0], 0.0);
        assert_eq!(x[999], 0.0);
        assert_eq!(x[500], 1.0);
        assert!((x[50] - 50.0 / 99.0).abs() < 1e-6);
        let mut y = vec![0.5f32, -2.0, 1.0];
        peak_normalize(&mut y, 1.0);
        assert!((peak(&y) - 1.0).abs() < 1e-6);
        rms_normalize(&mut y, 0.1);
        assert!((rms(&y) - 0.1).abs() < 1e-6);
        let mut z = vec![1.0f32, 3.0];
        remove_dc(&mut z);
        assert_eq!(z, vec![-1.0, 1.0]);
    }

    #[test]
    fn add_at_clips_both_ends_and_interleave_roundtrips() {
        let mut a = Stereo::zeros(4);
        let b = Stereo::dual_mono(&[1.0, 2.0, 3.0]);
        a.add_at(&b, -1, 1.0);
        a.add_at(&b, 3, 2.0);
        assert_eq!(a.l, vec![2.0, 3.0, 0.0, 2.0]);
        assert_eq!(Stereo::from_interleaved(&a.interleaved()), a);
    }
}
