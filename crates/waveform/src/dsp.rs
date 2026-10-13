//! Derived DSP for PCM → BCS1. The parameters are all frozen in [`crate::bcs1`]; no overrides are accepted here.
//!
//! | Parameter | Value |
//! | --- | --- |
//! | Window function | Blackman (periodic), window length = `fft_size` = 1024 |
//! | hop | `sample_rate / analysis_rate` = 800 |
//! | FFT | realfft `plan_fft_forward(1024)` |
//! | Magnitude | `sqrt(re² + im²) / fft_size` → `20 * log10(max(mag, 1e-10))` |
//! | Boundary | window left-aligned at `frame * hop`, zero-padded out of bounds |
//!
//! Frame count = `ceil(duration * analysis_rate)` = `ceil(samples / hop)`, which is deterministically related to the duration.

use anyhow::{Context, Result, bail};
use realfft::RealFftPlanner;

use crate::Fnv1a64;
use crate::bcs1::{
    ANALYSIS_RATE, Bcs1Header, CANONICAL_MAX_DB, CANONICAL_MIN_DB, FFT_SIZE, FRAME_LEN, FREQ_BINS,
    HOP, SAMPLE_RATE, SpectrumBackend, TIME_BINS, encode,
};

/// Magnitude floor: `log10(0)` is unusable, and any lower energy is already 0 in the canonical window.
const MAGNITUDE_FLOOR: f64 = 1e-10;
/// Domain separator for the content hash algorithm. The BCS1 binary version need not change with DSP tuning, but any algorithm that changes the spectrum bytes must change this identifier, so that the cache's content fingerprint is invalidated in step.
const DSP_FINGERPRINT: &[u8] = b"bcs1-dsp-blackman-normalized-v2";

/// Frame count for a given number of samples: `ceil(samples / hop)`.
pub fn frame_count_for(samples: usize) -> usize {
    samples.div_ceil(HOP as usize)
}

/// BCS1 header content hash: FNV-1a64(the decoded PCM's f32 little-endian bytes ‖ all DSP parameters).
///
/// **The backend does not take part**; it only goes into `flags`. The same PCM gives the same content hash whichever decoder produced it, so rendering is reproducible.
pub fn content_hash(pcm: &[f32]) -> u64 {
    let mut hash = Fnv1a64::new();
    hash.write(DSP_FINGERPRINT);
    for sample in pcm {
        hash.write(&sample.to_le_bytes());
    }
    for parameter in [ANALYSIS_RATE, SAMPLE_RATE, FFT_SIZE, TIME_BINS, FREQ_BINS] {
        hash.write(&parameter.to_le_bytes());
    }
    hash.finish()
}

/// Time-domain sample → centered byte: `128 + round(sample * 127)`, clamped to 0..255. Semantically aligned with Web Audio's `getByteTimeDomainData`: silence = 128.
pub fn time_byte(sample: f32) -> u8 {
    let sample = if sample.is_finite() {
        f64::from(sample)
    } else {
        0.0
    };
    (128.0 + (sample * 127.0).round()).clamp(0.0, 255.0) as u8
}

/// Magnitude → dB: `20 * log10(max(mag, 1e-10))`.
pub fn magnitude_db(magnitude: f64) -> f64 {
    20.0 * magnitude.max(MAGNITUDE_FLOOR).log10()
}

/// dB → canonical-window byte: `clamp(255 * (dB + 120) / 160, 0, 255)`.
pub fn canonical_byte(decibels: f64) -> u8 {
    let span = CANONICAL_MAX_DB - CANONICAL_MIN_DB;
    (255.0 * (decibels - CANONICAL_MIN_DB) / span)
        .clamp(0.0, 255.0)
        .round() as u8
}

/// 48 kHz mono PCM → the full BCS1 file bytes.
pub fn analyze(pcm: &[f32], backend: SpectrumBackend) -> Result<Vec<u8>> {
    let payload = analyze_payload(pcm)?;
    let frame_count = (payload.len() / FRAME_LEN) as u32;
    encode(
        &Bcs1Header::new(backend, frame_count, content_hash(pcm)),
        &payload,
    )
}

/// Computes only the payload (`frame_count × 640`), without the header.
pub fn analyze_payload(pcm: &[f32]) -> Result<Vec<u8>> {
    if pcm.is_empty() {
        bail!("媒体没有可解码的音频样本");
    }
    let frame_count = frame_count_for(pcm.len());
    if u32::try_from(frame_count).is_err() {
        bail!("频谱帧数 {frame_count} 超过 BCS1 上限");
    }
    let mut analyser = FrameAnalyser::new();
    let mut payload = Vec::with_capacity(frame_count * FRAME_LEN);
    for frame in 0..frame_count {
        analyser.frame(pcm, frame * HOP as usize, &mut payload)?;
    }
    Ok(payload)
}

/// Analysis of one frame: the window is left-aligned at `start`, zero-padded out of bounds.
struct FrameAnalyser {
    window: Vec<f64>,
    fft: std::sync::Arc<dyn realfft::RealToComplex<f64>>,
    input: Vec<f64>,
    spectrum: Vec<realfft::num_complex::Complex<f64>>,
    scratch: Vec<realfft::num_complex::Complex<f64>>,
}

impl FrameAnalyser {
    fn new() -> Self {
        let window_len = FFT_SIZE as usize;
        let fft = RealFftPlanner::<f64>::new().plan_fft_forward(window_len);
        Self {
            window: blackman_window(window_len),
            input: fft.make_input_vec(),
            spectrum: fft.make_output_vec(),
            scratch: fft.make_scratch_vec(),
            fft,
        }
    }

    fn frame(&mut self, pcm: &[f32], start: usize, payload: &mut Vec<u8>) -> Result<()> {
        let window_len = FFT_SIZE as usize;
        let stride = window_len / TIME_BINS as usize;
        // The time-domain row takes the raw, unwindowed samples in the window; windowing serves only the frequency domain.
        for point in 0..TIME_BINS as usize {
            payload.push(time_byte(sample_at(pcm, start + point * stride)));
        }
        for (offset, slot) in self.input.iter_mut().enumerate() {
            *slot = f64::from(sample_at(pcm, start + offset)) * self.window[offset];
        }
        self.fft
            .process_with_scratch(&mut self.input, &mut self.spectrum, &mut self.scratch)
            .context("执行 1024 点 real FFT")?;
        for bin in self.spectrum.iter().take(FREQ_BINS as usize) {
            // Web Audio's analyser normalizes the FFT output by 1/N before smoothing and the dB window. realfft returns unnormalized results, so the division by N is explicit here.
            let magnitude = (bin.re * bin.re + bin.im * bin.im).sqrt() / window_len as f64;
            payload.push(canonical_byte(magnitude_db(magnitude)));
        }
        Ok(())
    }
}

/// [`analyze`] fed PCM in segments. The result is byte-for-byte identical to passing the whole PCM to [`analyze`] at once, and only one window of samples is kept at a time. Use it when decoding and analysis happen in different places (the editor preview feeds browser-decoded audio into WASM in blocks), so the whole PCM need not sit in one buffer.
pub struct SpectrumStream {
    analyser: FrameAnalyser,
    hash: Fnv1a64,
    /// Number of samples fed so far.
    samples: usize,
    /// Samples still needed. The first one is the global sample at index `offset`.
    pending: Vec<f32>,
    offset: usize,
    /// Frame number of the next frame.
    next: usize,
    payload: Vec<u8>,
}

impl Default for SpectrumStream {
    fn default() -> Self {
        Self::new()
    }
}

impl SpectrumStream {
    pub fn new() -> Self {
        let mut hash = Fnv1a64::new();
        hash.write(DSP_FINGERPRINT);
        Self {
            analyser: FrameAnalyser::new(),
            hash,
            samples: 0,
            pending: Vec::new(),
            offset: 0,
            next: 0,
            payload: Vec::new(),
        }
    }

    /// Feeds the next segment of samples. Frames whose windows are complete are computed immediately, and samples no longer needed are discarded.
    pub fn push(&mut self, pcm: &[f32]) -> Result<()> {
        for sample in pcm {
            self.hash.write(&sample.to_le_bytes());
        }
        self.samples += pcm.len();
        self.pending.extend_from_slice(pcm);
        let hop = HOP as usize;
        while self.next * hop + FFT_SIZE as usize <= self.samples {
            let start = self.next * hop - self.offset;
            self.analyser
                .frame(&self.pending, start, &mut self.payload)?;
            self.next += 1;
        }
        let keep = self.next * hop - self.offset;
        if keep > 0 {
            let keep = keep.min(self.pending.len());
            self.pending.drain(..keep);
            self.offset += keep;
        }
        Ok(())
    }

    /// Done feeding: computes the trailing frames that run past the end (zero-padded), and returns the full BCS1 file bytes.
    pub fn finish(mut self, backend: SpectrumBackend) -> Result<Vec<u8>> {
        if self.samples == 0 {
            bail!("媒体没有可解码的音频样本");
        }
        let frame_count = frame_count_for(self.samples);
        let Ok(frames) = u32::try_from(frame_count) else {
            bail!("频谱帧数 {frame_count} 超过 BCS1 上限");
        };
        while self.next < frame_count {
            let start = self.next * HOP as usize - self.offset;
            self.analyser
                .frame(&self.pending, start, &mut self.payload)?;
            self.next += 1;
        }
        for parameter in [ANALYSIS_RATE, SAMPLE_RATE, FFT_SIZE, TIME_BINS, FREQ_BINS] {
            self.hash.write(&parameter.to_le_bytes());
        }
        encode(
            &Bcs1Header::new(backend, frames, self.hash.finish()),
            &self.payload,
        )
    }
}

/// Zero-padded beyond the end. Non-finite samples are treated as silence, so that NaN does not spread through the FFT and contaminate the whole frame.
fn sample_at(pcm: &[f32], index: usize) -> f32 {
    match pcm.get(index) {
        Some(sample) if sample.is_finite() => *sample,
        _ => 0.0,
    }
}

fn blackman_window(length: usize) -> Vec<f64> {
    (0..length)
        .map(|index| {
            let phase = 2.0 * std::f64::consts::PI * index as f64 / length as f64;
            0.42 - 0.5 * phase.cos() + 0.08 * (2.0 * phase).cos()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bcs1;

    #[test]
    fn frame_count_is_the_ceiling_of_samples_over_hop() {
        assert_eq!(frame_count_for(0), 0);
        assert_eq!(frame_count_for(1), 1);
        assert_eq!(frame_count_for(800), 1);
        assert_eq!(frame_count_for(801), 2);
        assert_eq!(frame_count_for(48_000), 60);
    }

    #[test]
    fn time_bytes_center_on_128() {
        assert_eq!(time_byte(0.0), 128);
        assert_eq!(time_byte(1.0), 255);
        assert_eq!(time_byte(-1.0), 1);
        assert_eq!(time_byte(2.0), 255);
        assert_eq!(time_byte(-2.0), 0);
        assert_eq!(time_byte(f32::NAN), 128);
        assert_eq!(time_byte(0.5), 128 + 64);
    }

    #[test]
    fn canonical_window_endpoints_and_floor() {
        assert_eq!(canonical_byte(-120.0), 0);
        assert_eq!(canonical_byte(40.0), 255);
        assert_eq!(canonical_byte(-200.0), 0);
        assert_eq!(canonical_byte(999.0), 255);
        assert_eq!(canonical_byte(-40.0), 128);
        // Magnitude floor: 0 and 1e-12 both fall at -200 dB, clamped to 0.
        assert_eq!(magnitude_db(0.0), -200.0);
        assert_eq!(magnitude_db(1.0), 0.0);
        assert!((magnitude_db(10.0) - 20.0).abs() < 1e-12);
        assert_eq!(canonical_byte(magnitude_db(0.0)), 0);
    }

    #[test]
    fn silence_produces_centered_time_rows_and_zero_spectrum() {
        let bytes = analyze(&vec![0.0; 1600], SpectrumBackend::Symphonia).unwrap();
        let view = bcs1::parse(&bytes).unwrap();
        assert_eq!(view.frame_count(), 2);
        for frame in 0..2 {
            assert!(view.time_row(frame).unwrap().iter().all(|&b| b == 128));
            assert!(view.freq_row(frame).unwrap().iter().all(|&b| b == 0));
        }
    }

    #[test]
    fn streamed_pcm_matches_one_shot_analysis() {
        // The length is not an integer multiple of the hop, and the block length is not aligned with the hop or window length.
        let pcm: Vec<f32> = (0..20_123)
            .map(|i| (i as f32 * 0.031).sin() * 0.6 + (i as f32 * 0.0007).cos() * 0.2)
            .collect();
        let whole = analyze(&pcm, SpectrumBackend::Symphonia).unwrap();
        for chunk in [1, 333, 800, 1024, 4097, 20_123] {
            let mut stream = SpectrumStream::new();
            for part in pcm.chunks(chunk) {
                stream.push(part).unwrap();
            }
            assert_eq!(
                stream.finish(SpectrumBackend::Symphonia).unwrap(),
                whole,
                "块长 {chunk}"
            );
        }
        assert!(
            SpectrumStream::new()
                .finish(SpectrumBackend::Symphonia)
                .is_err()
        );
    }

    #[test]
    fn empty_pcm_is_an_error_not_an_empty_file() {
        assert!(analyze(&[], SpectrumBackend::Symphonia).is_err());
        assert!(analyze_payload(&[]).is_err());
    }

    #[test]
    fn content_hash_tracks_pcm_and_is_backend_independent() {
        let pcm = vec![0.25f32; 800];
        let symphonia = analyze(&pcm, SpectrumBackend::Symphonia).unwrap();
        let ffmpeg = analyze(&pcm, SpectrumBackend::Ffmpeg).unwrap();
        let left = bcs1::parse(&symphonia).unwrap().header();
        let right = bcs1::parse(&ffmpeg).unwrap().header();
        assert_eq!(left.content_hash, right.content_hash);
        assert_ne!(left.backend, right.backend);
        // The payload is independent of the backend; only the flags differ.
        assert_eq!(symphonia[bcs1::HEADER_LEN..], ffmpeg[bcs1::HEADER_LEN..]);

        let mut nudged = pcm.clone();
        nudged[7] = 0.2500001;
        assert_ne!(content_hash(&pcm), content_hash(&nudged));
    }

    #[test]
    fn a_pure_tone_peaks_in_its_own_bin() {
        // 48 kHz / 1024 points → bin width 46.875 Hz; 3000 Hz falls in bin 64.
        let pcm: Vec<f32> = (0..9600)
            .map(|index| {
                (0.5 * (2.0 * std::f64::consts::PI * 3000.0 * index as f64 / 48_000.0).sin()) as f32
            })
            .collect();
        let bytes = analyze(&pcm, SpectrumBackend::Symphonia).unwrap();
        let view = bcs1::parse(&bytes).unwrap();
        assert_eq!(view.frame_count(), 12);
        let row = view.freq_row(4).unwrap();
        assert!(row[64] > row[63] && row[64] > row[65], "主瓣应落在 bin 64");
        assert!(row[64] > row[80] + 20, "主瓣应显著高于远端 bin");
    }

    #[test]
    fn windows_are_left_aligned_and_zero_padded_at_the_tail() {
        // Material one and a half frames long: in the second frame only the first 400 samples are valid; the rest are zero-padded.
        let pcm: Vec<f32> = (0..1200)
            .map(|index| if index < 800 { 0.5 } else { -0.5 })
            .collect();
        let bytes = analyze(&pcm, SpectrumBackend::Symphonia).unwrap();
        let view = bcs1::parse(&bytes).unwrap();
        assert_eq!(view.frame_count(), 2);
        assert_eq!(view.time_row(0).unwrap()[0], time_byte(0.5));
        assert_eq!(view.time_row(1).unwrap()[0], time_byte(-0.5));
        // Sample p of the second frame's time domain = sample 800 + p*8: p = 49 is still within the material, p = 50 is out of bounds.
        assert_eq!(view.time_row(1).unwrap()[49], time_byte(-0.5));
        assert_eq!(view.time_row(1).unwrap()[50], 128);
        assert_eq!(view.time_row(1).unwrap()[127], 128);
    }

    #[test]
    fn fft_magnitude_is_normalized_before_db_conversion() {
        // After a bin-centered sine passes through the periodic Blackman, the peak of the one-sided complex FFT is amplitude * sum(window) / 2. After dividing by N it should be about 0.5 * 0.42 / 2 = 0.105, i.e. -19.58 dB. If the 1/N were omitted, it would be about 60.2 dB too high and hit the ceiling.
        let pcm: Vec<f32> = (0..FFT_SIZE as usize)
            .map(|index| {
                (0.5 * (2.0 * std::f64::consts::PI * 64.0 * index as f64 / f64::from(FFT_SIZE))
                    .sin()) as f32
            })
            .collect();
        let bytes = analyze(&pcm, SpectrumBackend::Symphonia).unwrap();
        let view = bcs1::parse(&bytes).unwrap();
        let peak_db = crate::remap::canonical_db(view.freq_row(0).unwrap()[64]);
        assert!((peak_db - magnitude_db(0.105)).abs() <= 0.7, "{peak_db}");
        assert!(peak_db < -18.0, "归一化后的峰值不应贴顶：{peak_db}");
    }
}
