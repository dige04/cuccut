//! Conversion between decimal floating-point seconds and integer ticks (video format spec §2.10).
//!
//! - Ticks → seconds: `ticks / timescale` using IEEE 754 division, giving the nearest f64. When both numbers are at most 2^53 − 1 they are exactly representable, and the result is the correctly rounded true quotient.
//! - Seconds → ticks: first take the shortest decimal form of this f64 (the fewest digits that read back as the same f64), multiply that decimal number exactly by `timescale`, then round to the nearest integer tick, with ties going away from zero. This is the same rule the legacy project importer uses to convert microseconds (`micros` in `scripts/legacy-import/exact-time.ts`), so the same old data gives the same ticks by either path.
//!   It differs from the pts rounding in §2.13 (ties to even) and from the rounding of edit snapping; it is used only here.

use editor_semantics::{MAX_SAFE_INTEGER, MediaTime};

use crate::BridgeError;

/// Time base for a newly written body when there is no base: microseconds, the same as the legacy project import.
pub const FRESH_TIMESCALE: i64 = 1_000_000;

/// Result of one seconds → ticks conversion.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rounded {
    pub ticks: i64,
    /// The decimal value times the time base is exactly an integer; no rounding occurred.
    pub exact: bool,
}

pub fn check_timescale(timescale: i64) -> Result<(), BridgeError> {
    if timescale <= 0 || timescale as i128 > MAX_SAFE_INTEGER {
        return Err(BridgeError::new(format!("timescale {timescale} 必须是正的安全整数")));
    }
    Ok(())
}

/// Ticks → seconds.
pub fn ticks_to_seconds(ticks: i64, timescale: i64) -> Result<f64, BridgeError> {
    check_timescale(timescale)?;
    if (ticks as i128).abs() > MAX_SAFE_INTEGER {
        return Err(BridgeError::new(format!("刻度 {ticks} 超出安全整数")));
    }
    Ok(ticks as f64 / timescale as f64)
}

/// `MediaTime` → seconds, same rules as [`ticks_to_seconds`].
pub fn media_time_seconds(value: &MediaTime) -> Result<f64, BridgeError> {
    let ticks: i64 = value
        .ticks
        .parse()
        .map_err(|_| BridgeError::new(format!("MediaTime 的 ticks 不是整数：{}", value.ticks)))?;
    ticks_to_seconds(ticks, value.timescale)
}

/// Seconds → ticks; the rules are in the module docs.
pub fn seconds_to_ticks(seconds: f64, timescale: i64) -> Result<Rounded, BridgeError> {
    check_timescale(timescale)?;
    if !seconds.is_finite() {
        return Err(BridgeError::new(format!("时间 {seconds} 不是有限数")));
    }
    // The result must be a safe integer; coarse-filter first so the decimal string below does not get too long.
    if seconds.abs() > (MAX_SAFE_INTEGER as f64) / timescale as f64 + 1.0 {
        return Err(BridgeError::new(format!("时间 {seconds} 秒换成刻度超出安全整数")));
    }
    // Rust's `Display` gives the shortest round-trip decimal form, and never uses exponent notation.
    let text = format!("{}", seconds.abs());
    let (whole, fraction) = text.split_once('.').unwrap_or((&text, ""));
    let digits: u128 = format!("{whole}{fraction}")
        .parse()
        .map_err(|_| BridgeError::new(format!("时间 {seconds} 的十进制写法读不出来")))?;
    // Decimal value = digits / 10^k. |seconds| < 2^53 / timescale + 1, at most 17 significant digits, digits · timescale < 10^17 · 2^53 ≈ 9·10^32, which fits within u128.
    let k = fraction.len() as u32;
    let scaled = digits * timescale as u128;
    let (quotient, exact) = if k == 0 {
        (scaled, true)
    } else if k >= 38 {
        // 10^k exceeds u128; in that case scaled / 10^k < 10^33 / 10^38, which rounds to 0.
        (0, scaled == 0)
    } else {
        let unit = 10u128.pow(k);
        let (q, r) = (scaled / unit, scaled % unit);
        (if r * 2 >= unit { q + 1 } else { q }, r == 0)
    };
    if quotient > MAX_SAFE_INTEGER as u128 {
        return Err(BridgeError::new(format!("时间 {seconds} 秒换成刻度超出安全整数")));
    }
    let magnitude = quotient as i64;
    Ok(Rounded {
        ticks: if seconds < 0.0 { -magnitude } else { magnitude },
        exact,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verbatim copy of the legacy project importer's `micros()` (excluding the exponent-notation branch): take the shortest decimal form, truncate it to 7 decimal places, and round up by one when the 7th place is ≥ 5.
    fn legacy_micros(seconds: f64) -> i64 {
        let text = format!("{}", seconds.abs());
        let (whole, fraction) = text.split_once('.').unwrap_or((&text, ""));
        let digits: String = format!("{fraction}0000000").chars().take(7).collect();
        let mut value = whole.parse::<i64>().unwrap() * 1_000_000 + digits[..6].parse::<i64>().unwrap();
        if digits.as_bytes()[6] >= b'5' {
            value += 1;
        }
        if seconds < 0.0 { -value } else { value }
    }

    #[test]
    fn matches_the_legacy_importer_on_microseconds() {
        for seconds in [
            0.0,
            0.04,
            0.73,
            1.27,
            175.496,
            390.815,
            1.2345675,
            1.2345674999,
            2.0000005,
            3.9999995,
            0.1 + 0.2,
            1e-6,
            5e-6,
            12345.678901,
            -0.0000015,
            86399.999999,
        ] {
            assert_eq!(
                seconds_to_ticks(seconds, FRESH_TIMESCALE).unwrap().ticks,
                legacy_micros(seconds),
                "{seconds}"
            );
        }
    }

    #[test]
    fn ties_round_away_from_zero_and_report_exactness() {
        assert_eq!(
            seconds_to_ticks(1.2345675, 1_000_000).unwrap(),
            Rounded {
                ticks: 1_234_568,
                exact: false
            }
        );
        assert_eq!(
            seconds_to_ticks(-1.2345675, 1_000_000).unwrap(),
            Rounded {
                ticks: -1_234_568,
                exact: false
            }
        );
        assert_eq!(seconds_to_ticks(0.25, 2).unwrap(), Rounded { ticks: 1, exact: false });
        assert_eq!(
            seconds_to_ticks(0.73, 1_000_000).unwrap(),
            Rounded {
                ticks: 730_000,
                exact: true
            }
        );
        // The shortest form of 0.1 + 0.2 is 0.30000000000000004: multiply exactly in decimal, which gives 0.30000000000000004, not 0.3.
        assert_eq!(
            seconds_to_ticks(0.1 + 0.2, 1_000_000).unwrap(),
            Rounded {
                ticks: 300_000,
                exact: false
            }
        );
        assert_eq!(seconds_to_ticks(5e-324, 1_000_000).unwrap(), Rounded { ticks: 0, exact: false });
    }

    #[test]
    fn rejects_values_outside_the_contract() {
        assert!(seconds_to_ticks(f64::NAN, 1000).is_err());
        assert!(seconds_to_ticks(f64::INFINITY, 1000).is_err());
        assert!(seconds_to_ticks(1e10, 1_000_000).is_err());
        assert!(seconds_to_ticks(1.0, 0).is_err());
        assert!(ticks_to_seconds(1 << 53, 1).is_err());
    }

    /// Ticks → seconds → ticks returns the original value for any time base: when |ticks| < 2^51, adjacent ticks are farther apart than the f64 rounding error at that magnitude, so the value read back from the shortest decimal form is less than half a tick from the original tick.
    #[test]
    fn ticks_survive_the_round_trip_for_any_timescale() {
        let mut state = 0x9e37_79b9_7f4a_7c15_u64;
        let mut next = || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };
        for timescale in [1, 1000, 30_000, 48_000, 90_000, 1_000_000, 1_000_000_007, (1 << 53) - 1] {
            for _ in 0..20_000 {
                let ticks = (next() % (1 << 51)) as i64;
                let seconds = ticks_to_seconds(ticks, timescale).unwrap();
                let back = seconds_to_ticks(seconds, timescale).unwrap().ticks;
                assert_eq!(back, ticks, "{ticks}/{timescale}");
            }
        }
    }
}
