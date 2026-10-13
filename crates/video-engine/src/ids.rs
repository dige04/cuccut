//! Server-assigned IDs and timestamps.

use std::time::{SystemTime, UNIX_EPOCH};

/// `<prefix>_<16 hex digits>`. Entity IDs only need to be unique and stable within a video.
pub fn new_id(prefix: &str) -> String {
    let hex = uuid::Uuid::new_v4().simple().to_string();
    format!("{prefix}_{}", &hex[..16])
}

/// Transaction IDs use the full 128 bits.
pub fn new_transaction_id() -> String {
    format!("tx_{}", uuid::Uuid::new_v4().simple())
}

/// The current time as RFC 3339 (UTC, milliseconds).
pub fn now_rfc3339() -> String {
    let elapsed = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    rfc3339_from_unix(elapsed.as_secs(), elapsed.subsec_millis())
}

/// Converts Unix time to RFC 3339 (UTC, milliseconds).
pub fn rfc3339_from_unix(secs: u64, millis: u32) -> String {
    let secs = secs as i64;
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    let (year, month, day) = civil_from_days(days);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

/// Converts days since 1970-01-01 to a Gregorian date (Howard Hinnant's algorithm).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

#[cfg(test)]
mod tests {
    #[test]
    fn civil_dates() {
        assert_eq!(super::civil_from_days(0), (1970, 1, 1));
        assert_eq!(super::civil_from_days(20_728), (2026, 10, 2));
        assert_eq!(super::civil_from_days(11_016), (2000, 2, 29));
    }
}
