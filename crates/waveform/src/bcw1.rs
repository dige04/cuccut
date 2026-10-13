//! BCW1 (CucCut Waveform v1): the peak envelope for the timeline UI.
//!
//! Layout (little-endian): `"BCW1"` ‖ `u32 binsPerSecond` ‖ `u32 binCount` ‖ `binCount × u8`. Byte value = peak divided by the 0.98 quantile, clamped to 0..1, then multiplied by 255. **The format is independent of decoding**: sample rate, channel mixing and peak collection are all done on the host side. This module only takes a sequence of peaks.
//!
//! Migrated from `core/crates/ccut-kernel/src/services/waveform.rs`. The byte layout and quantile implementation are unchanged bit for bit: Swift's `BCWaveform.swift` and existing cache files depend on it.

use anyhow::{Result, bail};

pub const FORMAT: &str = "BCW1";
/// Bins per second. BCS1's `analysis_rate` aligns with it.
pub const BINS_PER_SECOND: u32 = 50;
pub const HEADER_LEN: usize = 12;
/// Normalization quantile. The peak is divided by it and then clamped, so a few loud spikes do not flatten the whole envelope.
const NORMALIZE_QUANTILE: f64 = 0.98;
/// Lower bound of the quantile. Fully silent material must not divide by 0.
const NORMALIZE_FLOOR: f32 = 1e-4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bcw1Info {
    pub bins_per_second: u32,
    pub bin_count: u32,
}

/// Peak sequence → BCW1 bytes.
pub fn encode(peaks: &[f32]) -> Result<Vec<u8>> {
    if peaks.is_empty() {
        bail!("media has no audio track");
    }
    let Ok(bin_count) = u32::try_from(peaks.len()) else {
        bail!("waveform bin count exceeds the BCW1 limit");
    };
    let mut sorted = peaks.to_vec();
    sorted.sort_by(f32::total_cmp);
    let percentile =
        sorted[((sorted.len() - 1) as f64 * NORMALIZE_QUANTILE) as usize].max(NORMALIZE_FLOOR);
    let mut bytes = Vec::with_capacity(HEADER_LEN + peaks.len());
    bytes.extend_from_slice(FORMAT.as_bytes());
    bytes.extend_from_slice(&BINS_PER_SECOND.to_le_bytes());
    bytes.extend_from_slice(&bin_count.to_le_bytes());
    bytes.extend(
        peaks
            .iter()
            .map(|peak| ((peak / percentile).clamp(0.0, 1.0) * 255.0).round() as u8),
    );
    Ok(bytes)
}

/// BCW1 bytes → header view. The payload length must match `binCount`.
pub fn parse(bytes: &[u8]) -> Result<Bcw1Info> {
    if bytes.len() < HEADER_LEN || &bytes[..4] != FORMAT.as_bytes() {
        bail!("waveform is not in BCW1 format");
    }
    let bins_per_second = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
    let bin_count = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    if bins_per_second == 0 {
        bail!("BCW1 binsPerSecond must be greater than 0");
    }
    if bin_count == 0 {
        bail!("BCW1 binCount must be greater than 0");
    }
    if usize::try_from(bin_count).ok() != Some(bytes.len() - HEADER_LEN) {
        bail!("BCW1 binCount does not match payload length");
    }
    Ok(Bcw1Info {
        bins_per_second,
        bin_count,
    })
}

/// Payload slice of validated BCW1 (one byte per bin).
pub fn bins(bytes: &[u8]) -> Result<&[u8]> {
    parse(bytes)?;
    Ok(&bytes[HEADER_LEN..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_and_percentile_are_stable() {
        let bytes = encode(&[0.0, 0.25, 0.5, 1.0]).unwrap();
        assert_eq!(&bytes[..4], b"BCW1");
        assert_eq!(parse(&bytes).unwrap().bins_per_second, 50);
        assert_eq!(parse(&bytes).unwrap().bin_count, 4);
        // Same as the original Web implementation: index floor((n - 1) * 0.98), here q = 0.5.
        assert_eq!(&bytes[12..], &[0, 128, 255, 255]);
        assert_eq!(bins(&bytes).unwrap(), &[0, 128, 255, 255]);
    }

    #[test]
    fn silence_does_not_divide_by_zero() {
        let bytes = encode(&[0.0, 0.0, 0.0]).unwrap();
        assert_eq!(&bytes[HEADER_LEN..], &[0, 0, 0]);
    }

    #[test]
    fn parse_rejects_truncated_and_mismatched_payloads() {
        assert!(encode(&[]).is_err());
        assert!(parse(b"BCW1").is_err());
        assert!(parse(b"NOPE\x32\0\0\0\x01\0\0\0\xff").is_err());
        let mut bytes = encode(&[0.5, 0.5]).unwrap();
        bytes.push(0);
        assert!(parse(&bytes).is_err());
        let mut zero_bins = encode(&[0.5]).unwrap();
        zero_bins[8..12].copy_from_slice(&0u32.to_le_bytes());
        assert!(parse(&zero_bins).is_err());
        let mut zero_rate = encode(&[0.5]).unwrap();
        zero_rate[4..8].copy_from_slice(&0u32.to_le_bytes());
        assert!(parse(&zero_rate).is_err());
    }
}
