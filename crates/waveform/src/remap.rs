//! Pure-function remapping of element-level parameters: canonical dB window → element dB window, exponential smoothing and gain.
//!
//! These parameters **are not cached**. A project can have several visualizers, each with different `minDb` / `maxDb` / `smoothing` / `gain`. If the parameters were in the cache, one STFT would have to be cached per combination. The canonical window plus this module lets one BCS1 serve any combination of parameters.
//!
//! Smoothing is inherently recursive (`m̂[n] = τ·m̂[n-1] + (1-τ)·m[n]`, `m̂[-1] = 0`), and Web Audio advances it in the **linear amplitude domain** before converting to dB. So it belongs to a one-time, whole-track computation in host preflight. It cannot go into `sample(t)`, which would introduce state and break consistency under out-of-order sampling.

use crate::bcs1::{CANONICAL_MAX_DB, CANONICAL_MIN_DB};

/// canonical byte → dB: `-120 + byte * 160 / 255`.
pub fn canonical_db(byte: u8) -> f64 {
    let span = CANONICAL_MAX_DB - CANONICAL_MIN_DB;
    CANONICAL_MIN_DB + f64::from(byte) * span / 255.0
}

/// canonical byte → linear amplitude. BCS1 quantizes only the unsmoothed dB, so the derivation stage first recovers the amplitude, in order to reproduce the recursion domain of `AnalyserNode.smoothingTimeConstant`.
pub fn canonical_magnitude(byte: u8) -> f64 {
    10.0f64.powf(canonical_db(byte) / 20.0)
}

/// canonical byte → element dB-window byte (the formula verbatim from §6.2).
pub fn remap(byte: u8, min_db: f64, max_db: f64) -> u8 {
    remap_value(byte, min_db, max_db).round() as u8
}

/// Same as [`remap`], but keeps the unrounded real-valued 0..255 result.
///
/// Smoothing must recurse **before rounding**: rounding first and then smoothing would carry the 1/255 quantization error through the recursion state. Rounding happens only at the last step.
pub fn remap_value(byte: u8, min_db: f64, max_db: f64) -> f64 {
    remap_decibels_value(canonical_db(byte), min_db, max_db)
}

/// dB already obtained → the unrounded 0..255 value under the element window.
fn remap_decibels_value(decibels: f64, min_db: f64, max_db: f64) -> f64 {
    let span = max_db - min_db;
    if !(span > 0.0) {
        // A degenerate window (upper and lower edges equal, or inverted) has no meaningful linear mapping. It gives the two ends by threshold, keeping the mapping monotonically non-decreasing in dB and never producing NaN.
        return if decibels >= max_db.max(min_db) {
            255.0
        } else {
            0.0
        };
    }
    (255.0 * (decibels - min_db) / span).clamp(0.0, 255.0)
}

/// Exponential time smoothing in the linear amplitude domain (the offline equivalent of Web Audio's `smoothingTimeConstant`).
pub fn smooth(previous: f64, current: f64, tau: f64) -> f64 {
    tau * previous + (1.0 - tau) * current
}

/// A sequential advancer for one frequency-domain row: canonical dB → linear amplitude → smoothing → dB remapping → gain.
///
/// `gain` is a CucCut-specific field, from the Mac's `WaveformConfig`, and is multiplied **after remapping and before drawing**. Each bin has its own smoothing state, so the advancer holds `previous` for a whole row.
#[derive(Debug, Clone)]
pub struct Remapper {
    min_db: f64,
    max_db: f64,
    tau: f64,
    gain: f64,
    previous: Vec<f64>,
}

impl Remapper {
    /// `bins` is the row width of each frame. `tau` is clamped to 0..1; a non-finite or negative `gain` is treated as 1.0.
    pub fn new(bins: usize, min_db: f64, max_db: f64, smoothing: f64, gain: f64) -> Self {
        Self {
            min_db,
            max_db,
            tau: if smoothing.is_finite() {
                smoothing.clamp(0.0, 1.0)
            } else {
                0.0
            },
            gain: if gain.is_finite() && gain >= 0.0 {
                gain
            } else {
                1.0
            },
            previous: vec![0.0; bins],
        }
    }

    pub fn tau(&self) -> f64 {
        self.tau
    }

    pub fn gain(&self) -> f64 {
        self.gain
    }

    /// Resets the recursion state to `m̂[-1] = 0`, for advancing again from frame 0.
    pub fn reset(&mut self) {
        self.previous.fill(0.0);
    }

    /// Advances one frame: `row` is a canonical byte row, and the output is written to `out` (which must have the same length).
    ///
    /// # Panics
    /// Panics when the length of `row` or `out` does not match `bins` given at construction. This is a programming error by the caller, not a data error.
    pub fn push_row(&mut self, row: &[u8], out: &mut [u8]) {
        assert_eq!(row.len(), self.previous.len(), "canonical row width mismatch");
        assert_eq!(out.len(), self.previous.len(), "output row width mismatch");
        for (bin, &byte) in row.iter().enumerate() {
            let magnitude = canonical_magnitude(byte);
            let smoothed = smooth(self.previous[bin], magnitude, self.tau);
            self.previous[bin] = smoothed;
            let decibels = if smoothed > 0.0 {
                20.0 * smoothed.log10()
            } else {
                f64::NEG_INFINITY
            };
            let mapped = remap_decibels_value(decibels, self.min_db, self.max_db);
            out[bin] = (mapped * self.gain).clamp(0.0, 255.0).round() as u8;
        }
    }

    /// The allocating version of [`Remapper::push_row`].
    pub fn map_row(&mut self, row: &[u8]) -> Vec<u8> {
        let mut out = vec![0u8; row.len()];
        self.push_row(row, &mut out);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_bytes_map_back_to_the_frozen_window() {
        assert_eq!(canonical_db(0), -120.0);
        assert_eq!(canonical_db(255), 40.0);
        assert!((canonical_db(128) - (-120.0 + 128.0 * 160.0 / 255.0)).abs() < 1e-12);
        assert!((canonical_magnitude(255) - 100.0).abs() < 1e-10);
        assert!((canonical_magnitude(0) - 1e-6).abs() < 1e-18);
    }

    #[test]
    fn remap_hits_the_element_window_endpoints() {
        // Element window same as the canonical window → identity mapping.
        for byte in [0u8, 1, 64, 128, 200, 255] {
            assert_eq!(remap(byte, -120.0, 40.0), byte);
        }
        // -80/+40 is the default for new items: canonical byte 63.75 is exactly -80 dB, so everything below the window's lower edge is 0.
        assert_eq!(remap(0, -80.0, 40.0), 0);
        assert_eq!(remap(63, -80.0, 40.0), 0);
        assert_eq!(remap(64, -80.0, 40.0), 0);
        assert_eq!(remap(255, -80.0, 40.0), 255);
        // Canonical byte 128 ≈ -39.69 dB, which lands at 86 in the -80/+40 window.
        assert_eq!(remap(128, -80.0, 40.0), 86);
        // -120/-10 is the override window for bicubic-style, all-bin looks.
        assert_eq!(remap(0, -120.0, -10.0), 0);
        assert_eq!(remap(255, -120.0, -10.0), 255);
        assert_eq!(remap(200, -120.0, -10.0), 255);
    }

    #[test]
    fn remap_is_monotonic_and_clamped_for_every_window() {
        for (min_db, max_db) in [
            (-120.0, 40.0),
            (-80.0, 40.0),
            (-120.0, -10.0),
            (-30.0, -20.0),
            (-1000.0, 1000.0),
        ] {
            let mut previous = 0u8;
            for byte in 0..=255u8 {
                let value = remap(byte, min_db, max_db);
                assert!(value >= previous, "({min_db},{max_db}) is not monotonic at {byte}");
                previous = value;
            }
        }
    }

    #[test]
    fn degenerate_windows_never_produce_nan() {
        assert_eq!(remap(0, -40.0, -40.0), 0);
        assert_eq!(remap(255, -40.0, -40.0), 255);
        // An inverted window is handled by threshold and is still monotonically non-decreasing.
        let mut previous = 0u8;
        for byte in 0..=255u8 {
            let value = remap(byte, 40.0, -120.0);
            assert!(value >= previous);
            previous = value;
        }
    }

    #[test]
    fn smoothing_degenerates_at_tau_zero_and_one() {
        assert_eq!(smooth(10.0, 200.0, 0.0), 200.0);
        assert_eq!(smooth(10.0, 200.0, 1.0), 10.0);
        assert_eq!(smooth(0.0, 200.0, 0.5), 100.0);

        // τ = 0: the remapping result passes through.
        let mut passthrough = Remapper::new(1, -120.0, 40.0, 0.0, 1.0);
        assert_eq!(passthrough.map_row(&[200]), vec![200]);
        assert_eq!(passthrough.map_row(&[10]), vec![10]);

        // τ = 1: y[-1] = 0 means it stays at 0 forever.
        let mut frozen = Remapper::new(1, -120.0, 40.0, 1.0, 1.0);
        assert_eq!(frozen.map_row(&[255]), vec![0]);
        assert_eq!(frozen.map_row(&[255]), vec![0]);
    }

    #[test]
    fn the_recursion_starts_at_zero_and_advances_frame_by_frame() {
        let mut remapper = Remapper::new(1, -120.0, 40.0, 0.5, 1.0);
        let magnitude = canonical_magnitude(200);
        let expected =
            |linear: f64| remap_decibels_value(20.0 * linear.log10(), -120.0, 40.0).round() as u8;
        // In the linear amplitude domain: m0 = 0.5x, m1 = 0.75x, m2 = 0.875x.
        assert_eq!(remapper.map_row(&[200]), vec![expected(0.5 * magnitude)]);
        assert_eq!(remapper.map_row(&[200]), vec![expected(0.75 * magnitude)]);
        assert_eq!(remapper.map_row(&[200]), vec![expected(0.875 * magnitude)]);
        assert_ne!(expected(0.5 * magnitude), 100, "must not fall back to byte-domain smoothing");
        remapper.reset();
        assert_eq!(remapper.map_row(&[200]), vec![expected(0.5 * magnitude)]);
    }

    #[test]
    fn gain_multiplies_after_the_remap_and_clamps() {
        let mut doubled = Remapper::new(2, -120.0, 40.0, 0.0, 2.0);
        assert_eq!(doubled.map_row(&[50, 200]), vec![100, 255]);
        let mut halved = Remapper::new(1, -120.0, 40.0, 0.0, 0.5);
        assert_eq!(halved.map_row(&[100]), vec![50]);
        // gain is not in the recursion state: the next frame still advances from the un-amplified y.
        let mut smoothed = Remapper::new(1, -120.0, 40.0, 0.5, 2.0);
        let magnitude = canonical_magnitude(100);
        let mapped = |linear: f64| remap_decibels_value(20.0 * linear.log10(), -120.0, 40.0);
        assert_eq!(
            smoothed.map_row(&[100]),
            vec![(mapped(0.5 * magnitude) * 2.0).round() as u8]
        );
        assert_eq!(
            smoothed.map_row(&[100]),
            vec![(mapped(0.75 * magnitude) * 2.0).round() as u8]
        );
        // Illegal parameters fall back to safe defaults.
        let fallback = Remapper::new(1, -120.0, 40.0, f64::NAN, -3.0);
        assert_eq!(fallback.tau(), 0.0);
        assert_eq!(fallback.gain(), 1.0);
        assert_eq!(Remapper::new(1, -120.0, 40.0, 5.0, 1.0).tau(), 1.0);
    }

    #[test]
    #[should_panic(expected = "canonical row width mismatch")]
    fn row_width_mismatch_is_a_programming_error() {
        Remapper::new(4, -120.0, 40.0, 0.0, 1.0).map_row(&[1, 2, 3]);
    }
}
