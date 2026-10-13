//! BCS1 (CucCut Spectrum v1): the spectrum cache that drives the pixels of the visualizer element.
//!
//! All little-endian. The header is 40 bytes, followed by `frame_count` fixed-length frames of 640 bytes each:
//!
//! | Offset | Size | Field |
//! | --- | --- | --- |
//! | 0 | 4 | `magic` = `"BCS1"` |
//! | 4 | 2 | `version` = 1 |
//! | 6 | 2 | `flags`, bit0 = backend (0 = symphonia, 1 = ffmpeg), other bits reserved and set to 0 |
//! | 8 | 4 | `analysis_rate` = 60 |
//! | 12 | 4 | `sample_rate` = 48000 |
//! | 16 | 4 | `fft_size` = 1024 |
//! | 20 | 4 | `time_bins` = 128 |
//! | 24 | 4 | `freq_bins` = 512 |
//! | 28 | 4 | `frame_count` |
//! | 32 | 8 | `content_hash` = FNV-1a64(decoded PCM ‖ DSP parameters) |
//!
//! The first 128 bytes of each frame are the time-domain row (centered on 128, semantically aligned with Web Audio's `getByteTimeDomainData`: silence ≈ 128). The last 512 bytes are the frequency-domain row (dB is mapped linearly to 0..255 over the **canonical window [-120, +40]**).
//!
//! The canonical window is the only dB window stored in the cache. The element-level `minDb` / `maxDb` / `smoothing` / `gain` are remapped by [`crate::remap`] during host preflight, so one cache serves any combination of parameters.

use anyhow::{Result, bail};

pub const MAGIC: &[u8; 4] = b"BCS1";
pub const VERSION: u16 = 1;
pub const HEADER_LEN: usize = 40;
/// Analysis frame rate (Hz). Aligned with the per-frame sampling cadence of the `AnalyserNode` in the 60 fps preview.
pub const ANALYSIS_RATE: u32 = 60;
/// Decoding sample rate dedicated to the visualizer. 48 kHz lets the first 64 FFT bins cover 0–3 kHz and all 512 bins cover 0–24 kHz,
/// consistent with the Web Audio reference chain.
pub const SAMPLE_RATE: u32 = 48_000;
/// FFT length fixed by the cache layer; **does not vary with the element's `fftSize`**.
pub const FFT_SIZE: u32 = 1024;
pub const TIME_BINS: u32 = 128;
pub const FREQ_BINS: u32 = FFT_SIZE / 2;
/// Bytes per frame = 128 + 512.
pub const FRAME_LEN: usize = (TIME_BINS + FREQ_BINS) as usize;
/// hop = `sample_rate / analysis_rate`, determined uniquely by the analysis frame rate.
pub const HOP: u32 = SAMPLE_RATE / ANALYSIS_RATE;
/// Lower edge of the canonical dB window. Covers the union of the two window sets (-80/+40 and -120/-10).
pub const CANONICAL_MIN_DB: f64 = -120.0;
/// Upper edge of the canonical dB window.
pub const CANONICAL_MAX_DB: f64 = 40.0;
/// The defined bits in `flags`; all other reserved bits must be 0.
const FLAG_BACKEND_FFMPEG: u16 = 1 << 0;

/// The source decoder of the PCM. Bit-identical PCM across backends is **not guaranteed**, so it is written into the header.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpectrumBackend {
    Symphonia,
    Ffmpeg,
}

impl SpectrumBackend {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Symphonia => "symphonia",
            Self::Ffmpeg => "ffmpeg",
        }
    }

    fn flags(self) -> u16 {
        match self {
            Self::Symphonia => 0,
            Self::Ffmpeg => FLAG_BACKEND_FFMPEG,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bcs1Header {
    pub version: u16,
    pub backend: SpectrumBackend,
    pub analysis_rate: u32,
    pub sample_rate: u32,
    pub fft_size: u32,
    pub time_bins: u32,
    pub freq_bins: u32,
    pub frame_count: u32,
    pub content_hash: u64,
}

impl Bcs1Header {
    /// Frozen parameters, plus this run's backend, frame count and content hash.
    pub fn new(backend: SpectrumBackend, frame_count: u32, content_hash: u64) -> Self {
        Self {
            version: VERSION,
            backend,
            analysis_rate: ANALYSIS_RATE,
            sample_rate: SAMPLE_RATE,
            fft_size: FFT_SIZE,
            time_bins: TIME_BINS,
            freq_bins: FREQ_BINS,
            frame_count,
            content_hash,
        }
    }

    /// Hexadecimal form of the content hash, used when feeding the render fingerprint, so that each place does not format it separately.
    pub fn content_hash_hex(&self) -> String {
        format!("{:016x}", self.content_hash)
    }

    /// Seconds covered by the spectrum = `frame_count / analysis_rate`.
    pub fn duration_seconds(&self) -> f64 {
        f64::from(self.frame_count) / f64::from(self.analysis_rate)
    }

    fn write_into(&self, bytes: &mut Vec<u8>) {
        bytes.extend_from_slice(MAGIC);
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend_from_slice(&self.backend.flags().to_le_bytes());
        bytes.extend_from_slice(&self.analysis_rate.to_le_bytes());
        bytes.extend_from_slice(&self.sample_rate.to_le_bytes());
        bytes.extend_from_slice(&self.fft_size.to_le_bytes());
        bytes.extend_from_slice(&self.time_bins.to_le_bytes());
        bytes.extend_from_slice(&self.freq_bins.to_le_bytes());
        bytes.extend_from_slice(&self.frame_count.to_le_bytes());
        bytes.extend_from_slice(&self.content_hash.to_le_bytes());
    }
}

/// Validated read-only view of BCS1. All row-access methods copy no bytes.
#[derive(Debug, Clone, Copy)]
pub struct Bcs1View<'a> {
    header: Bcs1Header,
    payload: &'a [u8],
}

impl<'a> Bcs1View<'a> {
    pub fn header(&self) -> Bcs1Header {
        self.header
    }

    pub fn frame_count(&self) -> usize {
        self.header.frame_count as usize
    }

    /// The full 640 bytes of frame `index`; returns `None` when out of range.
    pub fn frame(&self, index: usize) -> Option<&'a [u8]> {
        let start = index.checked_mul(FRAME_LEN)?;
        self.payload.get(start..start + FRAME_LEN)
    }

    /// The time-domain row of frame `index` (128 bytes, silence ≈ 128).
    pub fn time_row(&self, index: usize) -> Option<&'a [u8]> {
        self.frame(index).map(|frame| &frame[..TIME_BINS as usize])
    }

    /// The frequency-domain row of frame `index` (512 bytes, canonical dB window).
    pub fn freq_row(&self, index: usize) -> Option<&'a [u8]> {
        self.frame(index).map(|frame| &frame[TIME_BINS as usize..])
    }

    /// Seconds → frame number: round down and clamp to the valid range. Returns `None` when `frame_count` is 0.
    ///
    /// The rounding rule itself lives in [`frame_index_at`]. The render-time `VizTrack` has no BCS1 bytes, only `analysis_rate` and the frame count, so both sides must go through the same function.
    pub fn frame_index_at(&self, seconds: f64) -> Option<usize> {
        frame_index_at(self.header.analysis_rate, self.frame_count(), seconds)
    }
}

/// **The single source of truth for seconds → frame number** (design ADR-E04): `floor(t × analysis_rate)`,
/// then clamped to `0..frame_count-1`. No interpolation, no rounding.
///
/// The rounding direction matches `quantize_time(t, fps) = floor(t·fps + 1e-9)/fps`. Interpolation would make “rendering the same frame twice gives the same result” depend on floating-point associativity, so it was explicitly rejected.
/// Non-finite or non-positive `seconds` all fall to frame 0: a negative time is an out-of-range input from the caller, not an error.
pub fn frame_index_at(analysis_rate: u32, frame_count: usize, seconds: f64) -> Option<usize> {
    if frame_count == 0 {
        return None;
    }
    if !seconds.is_finite() || seconds <= 0.0 {
        return Some(0);
    }
    let index = (seconds * f64::from(analysis_rate)).floor();
    Some((index as usize).min(frame_count - 1))
}

/// header + payload → BCS1 bytes. The payload must be `frame_count × 640`.
pub fn encode(header: &Bcs1Header, payload: &[u8]) -> Result<Vec<u8>> {
    let expected = (header.frame_count as usize)
        .checked_mul(FRAME_LEN)
        .unwrap_or(usize::MAX);
    if payload.len() != expected {
        bail!(
            "BCS1 payload length {} does not match frameCount {} (expected {expected})",
            payload.len(),
            header.frame_count
        );
    }
    let mut bytes = Vec::with_capacity(HEADER_LEN + payload.len());
    header.write_into(&mut bytes);
    bytes.extend_from_slice(payload);
    Ok(bytes)
}

/// BCS1 bytes → read-only view. Frozen parameters are validated one by one; reserved bits must be 0.
pub fn parse(bytes: &[u8]) -> Result<Bcs1View<'_>> {
    if bytes.len() < HEADER_LEN || &bytes[..4] != MAGIC {
        bail!("spectrum is not in BCS1 format");
    }
    let u16_at = |offset: usize| u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap());
    let u32_at = |offset: usize| u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    let version = u16_at(4);
    if version != VERSION {
        bail!("BCS1 version {version} is not supported (current {VERSION})");
    }
    let flags = u16_at(6);
    if flags & !FLAG_BACKEND_FFMPEG != 0 {
        bail!("BCS1 flags reserved bits must be 0 (got {flags:#06x})");
    }
    let backend = if flags & FLAG_BACKEND_FFMPEG == 0 {
        SpectrumBackend::Symphonia
    } else {
        SpectrumBackend::Ffmpeg
    };
    for (offset, expected, name) in [
        (8usize, ANALYSIS_RATE, "analysisRate"),
        (12, SAMPLE_RATE, "sampleRate"),
        (16, FFT_SIZE, "fftSize"),
        (20, TIME_BINS, "timeBins"),
        (24, FREQ_BINS, "freqBins"),
    ] {
        let actual = u32_at(offset);
        if actual != expected {
            bail!("BCS1 {name} must be {expected} (got {actual})");
        }
    }
    let frame_count = u32_at(28);
    if frame_count == 0 {
        bail!("BCS1 frameCount must be greater than 0");
    }
    let content_hash = u64::from_le_bytes(bytes[32..40].try_into().unwrap());
    let payload = &bytes[HEADER_LEN..];
    let expected = (frame_count as usize)
        .checked_mul(FRAME_LEN)
        .unwrap_or(usize::MAX);
    if payload.len() != expected {
        bail!(
            "BCS1 frameCount {frame_count} does not match payload length {} (expected {expected})",
            payload.len()
        );
    }
    Ok(Bcs1View {
        header: Bcs1Header {
            version,
            backend,
            analysis_rate: ANALYSIS_RATE,
            sample_rate: SAMPLE_RATE,
            fft_size: FFT_SIZE,
            time_bins: TIME_BINS,
            freq_bins: FREQ_BINS,
            frame_count,
            content_hash,
        },
        payload,
    })
}

/// Read-only header. Does not validate the payload length; the render fingerprint uses it only for the content hash.
pub fn parse_header(bytes: &[u8]) -> Result<Bcs1Header> {
    Ok(parse(bytes)?.header())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_payload(frames: usize) -> Vec<u8> {
        (0..frames * FRAME_LEN)
            .map(|index| (index % 251) as u8)
            .collect()
    }

    #[test]
    fn frozen_constants_match_the_specification() {
        assert_eq!(HEADER_LEN, 40);
        assert_eq!(ANALYSIS_RATE, 60);
        assert_eq!(SAMPLE_RATE, 48_000);
        assert_eq!(FFT_SIZE, 1024);
        assert_eq!(TIME_BINS, 128);
        assert_eq!(FREQ_BINS, 512);
        assert_eq!(FRAME_LEN, 640);
        assert_eq!(HOP, 800);
        assert_eq!(CANONICAL_MIN_DB, -120.0);
        assert_eq!(CANONICAL_MAX_DB, 40.0);
    }

    #[test]
    fn round_trip_preserves_header_and_every_frame() {
        let payload = sample_payload(3);
        let header = Bcs1Header::new(SpectrumBackend::Ffmpeg, 3, 0x0123_4567_89ab_cdef);
        let bytes = encode(&header, &payload).unwrap();
        assert_eq!(bytes.len(), HEADER_LEN + 3 * FRAME_LEN);
        assert_eq!(&bytes[..4], MAGIC);
        assert_eq!(u16::from_le_bytes(bytes[6..8].try_into().unwrap()), 1);
        let view = parse(&bytes).unwrap();
        assert_eq!(view.header(), header);
        assert_eq!(view.header().content_hash_hex(), "0123456789abcdef");
        assert_eq!(view.frame_count(), 3);
        for frame in 0..3 {
            assert_eq!(
                view.frame(frame).unwrap(),
                &payload[frame * FRAME_LEN..(frame + 1) * FRAME_LEN]
            );
            assert_eq!(view.time_row(frame).unwrap().len(), 128);
            assert_eq!(view.freq_row(frame).unwrap().len(), 512);
            assert_eq!(
                view.freq_row(frame).unwrap(),
                &view.frame(frame).unwrap()[128..]
            );
        }
        assert!(view.frame(3).is_none());
    }

    #[test]
    fn backend_flag_survives_the_round_trip() {
        for backend in [SpectrumBackend::Symphonia, SpectrumBackend::Ffmpeg] {
            let header = Bcs1Header::new(backend, 1, 7);
            let bytes = encode(&header, &sample_payload(1)).unwrap();
            assert_eq!(parse(&bytes).unwrap().header().backend, backend);
        }
        let symphonia = encode(
            &Bcs1Header::new(SpectrumBackend::Symphonia, 1, 7),
            &sample_payload(1),
        )
        .unwrap();
        assert_eq!(u16::from_le_bytes(symphonia[6..8].try_into().unwrap()), 0);
    }

    #[test]
    fn parse_rejects_every_header_boundary_violation() {
        let good = encode(
            &Bcs1Header::new(SpectrumBackend::Symphonia, 2, 42),
            &sample_payload(2),
        )
        .unwrap();
        assert!(parse(&good).is_ok());
        assert!(parse(&good[..HEADER_LEN - 1]).is_err());

        let mut magic = good.clone();
        magic[..4].copy_from_slice(b"BCW1");
        assert!(parse(&magic).is_err());

        let mut version = good.clone();
        version[4..6].copy_from_slice(&2u16.to_le_bytes());
        assert!(parse(&version).is_err());

        let mut reserved = good.clone();
        reserved[6..8].copy_from_slice(&0b10u16.to_le_bytes());
        assert!(parse(&reserved).is_err());

        for offset in [8usize, 12, 16, 20, 24] {
            let mut tampered = good.clone();
            tampered[offset..offset + 4].copy_from_slice(&9u32.to_le_bytes());
            assert!(parse(&tampered).is_err(), "offset {offset} was not rejected");
        }

        let mut zero_frames = good.clone();
        zero_frames[28..32].copy_from_slice(&0u32.to_le_bytes());
        assert!(parse(&zero_frames).is_err());

        let mut short = good.clone();
        short.truncate(HEADER_LEN + FRAME_LEN);
        assert!(parse(&short).is_err());

        let mut long = good.clone();
        long.push(0);
        assert!(parse(&long).is_err());
    }

    #[test]
    fn encode_rejects_payloads_that_do_not_match_frame_count() {
        let header = Bcs1Header::new(SpectrumBackend::Symphonia, 2, 0);
        assert!(encode(&header, &sample_payload(1)).is_err());
        assert!(encode(&header, &sample_payload(3)).is_err());
        assert!(encode(&header, &sample_payload(2)).is_ok());
    }

    #[test]
    fn frame_index_floors_and_clamps() {
        let bytes = encode(
            &Bcs1Header::new(SpectrumBackend::Symphonia, 5, 0),
            &sample_payload(5),
        )
        .unwrap();
        let view = parse(&bytes).unwrap();
        assert_eq!(view.header().duration_seconds(), 5.0 / 60.0);
        assert_eq!(view.frame_index_at(-1.0), Some(0));
        assert_eq!(view.frame_index_at(0.0), Some(0));
        assert_eq!(view.frame_index_at(0.016), Some(0));
        assert_eq!(view.frame_index_at(1.0 / 60.0), Some(1));
        assert_eq!(view.frame_index_at(4.0 / 60.0), Some(4));
        assert_eq!(view.frame_index_at(99.0), Some(4));
        assert_eq!(view.frame_index_at(f64::NAN), Some(0));
    }

    /// The methods on the view only forward to the free functions. The render-time `VizTrack` goes through the free functions,
    /// and the two paths must give the same frame number at every moment (design ADR-E04: “the rounding rule is part of the contract”).
    #[test]
    fn the_view_method_forwards_to_the_free_function() {
        let bytes = encode(
            &Bcs1Header::new(SpectrumBackend::Symphonia, 5, 0),
            &sample_payload(5),
        )
        .unwrap();
        let view = parse(&bytes).unwrap();
        for step in -5..300 {
            let seconds = f64::from(step) / 1000.0;
            assert_eq!(
                view.frame_index_at(seconds),
                frame_index_at(ANALYSIS_RATE, 5, seconds),
                "{seconds}s"
            );
        }
        assert_eq!(frame_index_at(ANALYSIS_RATE, 0, 1.0), None);
    }
}
