//! Curves: keyframe interpolation (smoothstep segments / linear segments) and random drift (Catmull-Rom spline).

use crate::math::smoothstep;
use crate::rng::Rng;

/// Piecewise smoothstep keyframes: `(t, v)` in ascending `t`; held at the end values outside both ends. Reference project `keys()`.
pub fn keys_smooth(points: &[(f64, f64)], t: f64) -> f64 {
    keys_with(points, t, |u| smoothstep(0.0, 1.0, u))
}

/// Piecewise linear keyframes.
pub fn keys_linear(points: &[(f64, f64)], t: f64) -> f64 {
    keys_with(points, t, |u| u)
}

fn keys_with(points: &[(f64, f64)], t: f64, shape: impl Fn(f64) -> f64) -> f64 {
    match points.len() {
        0 => 0.0,
        1 => points[0].1,
        _ => {
            if t <= points[0].0 {
                return points[0].1;
            }
            let last = points[points.len() - 1];
            if t >= last.0 {
                return last.1;
            }
            // The last segment with `t_k ≤ t` (consistent with `searchsorted(side='right') - 1`).
            let mut i = 0;
            while i + 2 < points.len() && points[i + 1].0 <= t {
                i += 1;
            }
            let (t0, v0) = points[i];
            let (t1, v1) = points[i + 1];
            let u = ((t - t0) / (t1 - t0).max(1e-9)).clamp(0.0, 1.0);
            v0 + (v1 - v0) * shape(u)
        }
    }
}

/// Sample smoothstep keyframes per sample over `[t0, t0 + n/sr)` (`points` use absolute time).
pub fn keys_curve(points: &[(f64, f64)], n: usize, sr: f64, t0: f64) -> Vec<f32> {
    (0..n)
        .map(|i| keys_smooth(points, t0 + i as f64 / sr) as f32)
        .collect()
}

/// Smooth random curve: changes about `rate` times per second, with values in `[lo, hi]`.
///
/// Scatter `k = max(4, ⌊dur·rate⌋ + 4)` random points in `[0, 1)`, use a Catmull-Rom spline to take `n` evenly spaced values between points 1..k−2,
/// clamp to `[0, 1]` and map to `[lo, hi]`. The reference project's `wander()` uses a cubic spline; here it is replaced by a local Catmull-Rom: no need to solve a tridiagonal system, and the shape is equally smooth.
pub fn wander(n: usize, sr: f64, rate: f64, lo: f64, hi: f64, rng: &mut Rng) -> Vec<f32> {
    let k = 4usize.max((n as f64 / sr * rate) as usize + 4);
    let p: Vec<f64> = (0..k).map(|_| rng.unit()).collect();
    let span = (k - 3) as f64;
    (0..n)
        .map(|i| {
            let x = 1.0
                + span
                    * if n > 1 {
                        i as f64 / (n - 1) as f64
                    } else {
                        0.0
                    };
            let j = (x as usize).clamp(1, k - 3);
            let u = x - j as f64;
            let (p0, p1, p2, p3) = (p[j - 1], p[j], p[j + 1], p[j + 2]);
            let v = 0.5
                * (2.0 * p1
                    + (p2 - p0) * u
                    + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u
                    + (3.0 * p1 - p0 - 3.0 * p2 + p3) * u * u * u);
            (lo + (hi - lo) * v.clamp(0.0, 1.0)) as f32
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_hold_ends_and_ease_between() {
        let pts = [(0.0, 1.0), (1.0, 3.0), (2.0, 3.0)];
        assert_eq!(keys_smooth(&pts, -1.0), 1.0);
        assert_eq!(keys_smooth(&pts, 5.0), 3.0);
        assert!((keys_smooth(&pts, 0.5) - 2.0).abs() < 1e-12);
        assert!(keys_smooth(&pts, 0.1) < keys_linear(&pts, 0.1));
        assert_eq!(keys_smooth(&[(0.0, 7.0)], 3.0), 7.0);
    }

    #[test]
    fn wander_stays_in_range_is_smooth_and_deterministic() {
        let sr = 48_000.0;
        let a = wander(48_000, sr, 2.0, 0.3, 1.0, &mut Rng::new(5));
        assert!(a.iter().all(|v| (0.3..=1.0).contains(v)));
        let max_step = a
            .windows(2)
            .map(|w| (w[1] - w[0]).abs())
            .fold(0.0f32, f32::max);
        assert!(max_step < 1e-3, "step {max_step}");
        assert_eq!(a, wander(48_000, sr, 2.0, 0.3, 1.0, &mut Rng::new(5)));
    }
}
