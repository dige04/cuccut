//! Conversion between seconds and ticks. Inside the Worker, all calculations use f64 seconds; conversion happens once, at the boundary where results are written (architecture design §6.6).

/// Seconds → integer ticks (rounded; negative values become 0). Monotonic: if `a <= b`, the result is also `<=`.
pub fn seconds_to_ticks(seconds: f64, timescale: u64) -> u64 {
    if !seconds.is_finite() || seconds <= 0.0 {
        return 0;
    }
    (seconds * timescale as f64).round() as u64
}

/// Ticks → seconds.
pub fn ticks_to_seconds(ticks: u64, timescale: u64) -> f64 {
    if timescale == 0 {
        return 0.0;
    }
    ticks as f64 / timescale as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_and_rounds_at_the_boundary() {
        assert_eq!(seconds_to_ticks(1.5, 1_000_000), 1_500_000);
        assert_eq!(seconds_to_ticks(0.000_000_4, 1_000_000), 0);
        assert_eq!(seconds_to_ticks(0.000_000_6, 1_000_000), 1);
        assert_eq!(seconds_to_ticks(-3.0, 1_000_000), 0);
        assert_eq!(seconds_to_ticks(f64::NAN, 48_000), 0);
        assert_eq!(seconds_to_ticks(2.0, 48_000), 96_000);
        assert_eq!(seconds_to_ticks(1.0 / 3.0, 90_000), 30_000);
        // Keeps precision even for media longer than one hour.
        assert_eq!(seconds_to_ticks(3_725.123_456, 1_000_000), 3_725_123_456);
    }

    #[test]
    fn round_trips_range_ticks() {
        for (ticks, timescale) in [(12_345_678_u64, 1_000_000_u64), (90_000, 90_000), (7, 1), (1_001, 30_000)] {
            assert_eq!(seconds_to_ticks(ticks_to_seconds(ticks, timescale), timescale), ticks);
        }
        assert_eq!(ticks_to_seconds(5, 0), 0.0);
    }

    #[test]
    fn rounding_is_monotone() {
        let mut previous = 0;
        for step in 0..10_000 {
            let ticks = seconds_to_ticks(step as f64 * 0.000_123_7, 1_000);
            assert!(ticks >= previous);
            previous = ticks;
        }
    }
}
