//! Spectrum source for visualizer elements (element design, ADR-E04).
//!
//! A [`VizTrack`] is the whole-audio, per-frame spectrum derived from one element's parameters. It is computed once in the **host preflight** (BCS1 output of `ccut spectrum` → element dB window → exponential smoothing → gain). At render time it only does a single array index lookup:
//!
//! ```text
//! idx = clamp(floor(t × analysis_rate), 0, frame_count - 1)   // nearest, rounded down
//! ```
//!
//! **Why smoothing is not computed in `sample(t)`**: `y[n] = τ·y[n-1] + (1-τ)·x[n]` is a natural recurrence, and putting it in the sampling step would be the same as giving the source an incremental clock. But exports run out of order (`ccut render --t 7.5` jumps straight to a frame, and full-timeline exports split frames by stride across several workers). ADR-E04 therefore pins smoothing to the preflight and pins `sample` to a pure table lookup; `shuffled_sampling_equals_sorted_sampling` is the executable form of this contract.
//!
//! **Division of work between time-domain and frequency-domain rows** (the semantics of this module, see [`VizTrack::derive`]): frequency rows go through the full remap → smoothing → gain chain; time-domain rows are copied **byte for byte**. The reason is the Web Audio semantics this design follows throughout: `smoothingTimeConstant` only applies to `getByteFrequencyData`, while `getByteTimeDomainData` returns the raw waveform; and a dB window has no meaning for a centred waveform where silence ≈ 128.
//!
//! ## The §8 GPU interface is frozen here (this stage freezes it, does not implement it)
//!
//! Design §8 is a cross-document contract; the P5 wgpu backend and the P6 wasm preview both wire to it:
//!
//! * §8.1 bind groups: `@group(0)` transform, `@group(1)` per-effect scalars, `@group(2) @binding(0)` audio texture + `@binding(1)` sampler (linear / clamp-to-edge);
//! * §8.2 `@group(1)` uniform **order frozen**: 8 visualizer items `u_time / u_mainColor / u_secondaryColor / u_canvasRes / u_dstRes / u_colourMultiplier / u_clip / u_textureSize`;
//! * §8.3 audio texture: `R8Unorm`, `w × 2`, **row 0 = time domain, row 1 = frequency domain, no flip** (the GLSL reference implementation enables `UNPACK_FLIP_Y_WEBGL`, so its row order is the opposite of WGSL; when porting, the row index must be flipped, otherwise the result is a silently wrong image) — see [`AUDIO_TEXTURE_ROW_TIME`] / [`AUDIO_TEXTURE_ROW_FREQ`];
//! * §8.4 frequency mapping: 48 kHz BCS1 aligns directly with Web Audio; `binWidth == "64"` takes the lowest 64 bins (0–3 kHz), `half` covers 0–24 kHz — see [`VizFrame::freq_window`].

use anyhow::{Result, bail};
use sha2::{Digest, Sha256};
use waveform::bcs1::{self, TIME_BINS};
use waveform::remap::Remapper;

use super::ContentHash;

pub mod draw;
pub(crate) mod recipes;

pub use draw::{VisualizerParams, VizBox, visualizer_frame};

/// Row index of the time-domain row in the audio texture (design §8.3, **no flip**).
pub const AUDIO_TEXTURE_ROW_TIME: u32 = 0;
/// Row index of the frequency-domain row in the audio texture (design §8.3, **no flip**).
pub const AUDIO_TEXTURE_ROW_FREQ: u32 = 1;
/// Height of the audio texture.
pub const AUDIO_TEXTURE_ROWS: u32 = 2;
/// Texture width for `binWidth == "64"` (design §8.3/§8.4): the **lowest 64 bins** (0–3 kHz) under 48 kHz analysis.
pub const FIXED_BIN_WIDTH: usize = 64;

/// Takes the usable segment of the frequency-domain row according to the recipe's `binWidth` (design §8.4).
pub(crate) fn freq_row(frame: &VizFrame, bin_width: motion::preset_registry::BinWidth) -> &[u8] {
    match bin_width {
        motion::preset_registry::BinWidth::Fixed64 => frame.freq_window(FIXED_BIN_WIDTH),
        motion::preset_registry::BinWidth::Half => &frame.freq,
    }
}

/// Resamples the time-domain row **to the audio texture width** (the decision in design §8.3, frozen in P5b).
///
/// The two `VizFrame` rows have different widths (128 / 512 in BCS1), but the §8.3 texture is `w × 2`, so both rows must have the same width. The frequency row is windowed by `binWidth` (raw bytes); the time-domain row is resampled to the same width with the clamp-to-edge texel-centre rule of [`crate::source::kernel::sample_row_linear`].
///
/// **The CPU drawing path uses the same code**: `oscilloscope-v1` (`oscilloscope` / `ring_wave`) is the only algorithm that reads the time-domain row. Its `binWidth` is `"half"`, and the texture width of 512 is four times the time-domain row width of 128. The oscilloscope polyline takes `samples` points from the resampled row, which is byte-for-byte identical to what `AudioTexture` uploads — **resampling is part of the row semantics, not an upload-time implementation detail**: both sides share this function.
///
/// When the widths are equal the result is byte-identical (`Borrowed`, no copy).
pub(crate) fn time_row(
    frame: &VizFrame,
    bin_width: motion::preset_registry::BinWidth,
) -> std::borrow::Cow<'_, [u8]> {
    let width = freq_row(frame, bin_width).len().max(1);
    if frame.time.len() == width {
        return std::borrow::Cow::Borrowed(&frame.time);
    }
    std::borrow::Cow::Owned(
        (0..width)
            .map(|index| {
                let u = (index as f64 + 0.5) / width as f64;
                let value = crate::source::kernel::sample_row_linear(&frame.time, u);
                (value * f64::from(u8::MAX)).round().clamp(0.0, 255.0) as u8
            })
            .collect(),
    )
}

/// Version number of the derivation algorithm, included in [`VizTrack::fingerprint`].
///
/// Any change to semantics such as "which row takes which chain" or "at which step rounding happens" must bump this by +1; otherwise old artifacts would reuse the old fingerprint while carrying new pixels.
const DERIVE_VERSION: u32 = 1;

/// One spectrum frame: two byte rows.
///
/// The two rows have **different widths** (128 / 512 in BCS1) because they measure two different quantities to begin with: the time domain is waveform samples, the frequency domain is amplitude within the dB window. The `w × 2` texture of §8.3 belongs to the GPU upload stage — that step takes each row to the same `w` according to the recipe's `binWidth`, and is not part of this layer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VizFrame {
    /// Time-domain row, centred on 128 (silence ≈ 128), semantically aligned with `getByteTimeDomainData`.
    pub time: Box<[u8]>,
    /// Frequency-domain row, already remapped to the element's `[minDb, maxDb]`, smoothed, and multiplied by `gain`.
    pub freq: Box<[u8]>,
}

impl VizFrame {
    /// The **lowest `bins` bins** of the frequency-domain row (design §8.4: at 48 kHz, 64 bins = 0–3 kHz).
    ///
    /// When `bins` exceeds the row width, the whole row is returned. Asking for more bins than the cache holds is the recipe's problem; the sampling side should not panic.
    pub fn freq_window(&self, bins: usize) -> &[u8] {
        &self.freq[..bins.min(self.freq.len())]
    }

    /// One frame of **pure silence**: time-domain row centred on 128, frequency-domain row all 0.
    ///
    /// Used by the host for "maps to no audio segment" (when the output time of `audio: "project"` falls in a cut gap, or when another source is playing at that time). The frequency values are 0 rather than "some dB floor" because this is not "very quiet sound" — it is **no sound at all**. Bar styles' `max(freq, minHeight)` will draw it as a row of short bars, matching how a silent segment looks.
    pub fn silent(time_bins: usize, freq_bins: usize) -> VizFrame {
        VizFrame {
            time: vec![TIME_DOMAIN_SILENCE; time_bins].into_boxed_slice(),
            freq: vec![0; freq_bins].into_boxed_slice(),
        }
    }
}

/// Silence baseline of the time-domain row (the centre value of `getByteTimeDomainData`).
pub const TIME_DOMAIN_SILENCE: u8 = 128;

/// Element-level derived parameters (the render-side counterpart of `VisualizerProps`).
///
/// Deliberately does not derive `Default`: the default values live in the `VISUALIZER_*_DEFAULT` constants in `ccut_timeline::schema`, and copying them into this layer would create two sets of defaults.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VizParams {
    pub min_db: f64,
    pub max_db: f64,
    /// Offline equivalent of `smoothingTimeConstant`, clamped to 0..1.
    pub smoothing: f64,
    /// CucCut-specific field: multiplied in after remapping, before drawing.
    pub gain: f64,
}

/// Concrete implementation of the spectrum source: the whole track is kept resident, sampling is a pure table lookup.
#[derive(Debug, Clone)]
pub struct VizTrack {
    analysis_rate: u32,
    frames: Vec<VizFrame>,
    params: VizParams,
    hash: ContentHash,
}

impl VizTrack {
    /// **Step 2 of the ADR-E04 data flow**: canonical BCS1 bytes → the whole track with element parameters applied.
    ///
    /// Consumes bytes only and never touches the filesystem — reading BCS1 (cache path, fingerprint, atomic write) is the host's job (`services/spectrum.rs` in `apps/cli`).
    ///
    /// Frequency-domain rows are advanced **sequentially from frame 0** through [`Remapper`]; time-domain rows are copied through as-is (see the module docs).
    pub fn derive(spectrum: &[u8], params: VizParams) -> Result<VizTrack> {
        let view = bcs1::parse(spectrum)?;
        let header = view.header();
        let freq_bins = header.freq_bins as usize;
        let mut remapper = Remapper::new(
            freq_bins,
            params.min_db,
            params.max_db,
            params.smoothing,
            params.gain,
        );
        let mut frames = Vec::with_capacity(view.frame_count());
        let mut row = vec![0u8; freq_bins];
        for index in 0..view.frame_count() {
            let time = view
                .time_row(index)
                .ok_or_else(|| anyhow::anyhow!("BCS1 第 {index} 帧缺少时域行"))?;
            let freq = view
                .freq_row(index)
                .ok_or_else(|| anyhow::anyhow!("BCS1 第 {index} 帧缺少频域行"))?;
            remapper.push_row(freq, &mut row);
            frames.push(VizFrame {
                time: time.to_vec().into_boxed_slice(),
                freq: row.clone().into_boxed_slice(),
            });
        }
        VizTrack::assemble(header.analysis_rate, frames, params, header.content_hash)
    }

    /// Already-derived frames → track. An entry point left for hosts whose BCS1 comes from elsewhere (the P6 wasm preview).
    ///
    /// `source_hash` is the content hash of the upstream material (`content_hash` in BCS1), and goes into [`VizTrack::fingerprint`] together with the derivation parameters.
    pub fn assemble(
        analysis_rate: u32,
        frames: Vec<VizFrame>,
        params: VizParams,
        source_hash: u64,
    ) -> Result<VizTrack> {
        if analysis_rate == 0 {
            bail!("VizTrack 的 analysisRate 必须大于 0");
        }
        if frames.is_empty() {
            bail!("VizTrack 至少要有一帧");
        }
        let time_bins = frames[0].time.len();
        let freq_bins = frames[0].freq.len();
        if let Some(bad) = frames
            .iter()
            .position(|frame| frame.time.len() != time_bins || frame.freq.len() != freq_bins)
        {
            bail!("VizTrack 第 {bad} 帧的行宽与首帧不一致");
        }
        let mut hasher = Sha256::new();
        hasher.update(b"ccut-viztrack");
        hasher.update(DERIVE_VERSION.to_le_bytes());
        hasher.update(source_hash.to_le_bytes());
        hasher.update(analysis_rate.to_le_bytes());
        hasher.update((frames.len() as u64).to_le_bytes());
        hasher.update((time_bins as u64).to_le_bytes());
        hasher.update((freq_bins as u64).to_le_bytes());
        // Parameters go into the fingerprint: the same BCS1 with a different dB window is a different picture.
        for value in [params.min_db, params.max_db, params.smoothing, params.gain] {
            hasher.update(value.to_bits().to_le_bytes());
        }
        for frame in &frames {
            hasher.update(&frame.time);
            hasher.update(&frame.freq);
        }
        let hash = ContentHash::new(hasher.finalize().into());
        Ok(VizTrack {
            analysis_rate,
            frames,
            params,
            hash,
        })
    }

    pub fn params(&self) -> VizParams {
        self.params
    }

    /// Seconds covered = `frame_count / analysis_rate`.
    pub fn duration(&self) -> f64 {
        self.frames.len() as f64 / f64::from(self.analysis_rate)
    }

    /// Time-domain row width (in BCS1 it is [`waveform::bcs1::TIME_BINS`] = 128).
    pub fn time_bins(&self) -> usize {
        self.frames.first().map_or(0, |frame| frame.time.len())
    }

    /// Frequency-domain row width (in BCS1 it is `fftSize / 2` = 512).
    pub fn freq_bins(&self) -> usize {
        self.frames.first().map_or(0, |frame| frame.freq.len())
    }

    /// Frame number `index`; returns `None` when out of range.
    pub fn frame(&self, index: usize) -> Option<&VizFrame> {
        self.frames.get(index)
    }

    /// A silent frame matching this track's row widths (see [`VizFrame::silent`]).
    pub fn silent_frame(&self) -> VizFrame {
        VizFrame::silent(self.time_bins(), self.freq_bins())
    }
}

/// Sampling contract for spectrum sources (ADR-E04).
///
/// The four obligations are word-for-word the same as [`super::VisualSource`]: the only entry point is `sample` at an **absolute time**; no incremental clock may be held; sampling takes only `&self`; and the content fingerprint covers all bytes. Only "what a frame is" differs — see the reason the two traits are split in `source/mod.rs`.
pub trait VizSource: Send + Sync {
    fn analysis_rate(&self) -> u32;

    fn frame_count(&self) -> usize;

    /// Seconds → frame number (the rounding rule of ADR-E04). Returns `None` for an empty track.
    fn frame_index_at(&self, seconds: f64) -> Option<usize>;

    /// **The only official sampling interface**: absolute time → the spectrum frame at that time.
    fn sample(&self, seconds: f64) -> Option<&VizFrame>;

    fn fingerprint(&self) -> ContentHash;
}

impl VizSource for VizTrack {
    fn analysis_rate(&self) -> u32 {
        self.analysis_rate
    }

    fn frame_count(&self) -> usize {
        self.frames.len()
    }

    /// The rounding rule is **not implemented here**: `waveform::bcs1::frame_index_at` is its only home, and `Bcs1View::frame_index_at` also forwards to that same place (ADR-E04: "the rounding rule is part of the contract").
    fn frame_index_at(&self, seconds: f64) -> Option<usize> {
        bcs1::frame_index_at(self.analysis_rate, self.frames.len(), seconds)
    }

    fn sample(&self, seconds: f64) -> Option<&VizFrame> {
        self.frames.get(self.frame_index_at(seconds)?)
    }

    fn fingerprint(&self) -> ContentHash {
        self.hash
    }
}

/// BCS1 time-domain row width, for host test fixtures to align with.
pub const BCS1_TIME_BINS: usize = TIME_BINS as usize;

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> VizParams {
        VizParams {
            min_db: -120.0,
            max_db: 40.0,
            smoothing: 0.0,
            gain: 1.0,
        }
    }

    fn frame(time: u8, freq: u8) -> VizFrame {
        VizFrame {
            time: vec![time; 4].into_boxed_slice(),
            freq: vec![freq; 8].into_boxed_slice(),
        }
    }

    #[test]
    fn the_rounding_rule_floors_and_clamps() {
        let track = VizTrack::assemble(
            50,
            (0..5).map(|i| frame(i as u8, i as u8)).collect(),
            params(),
            0,
        )
        .unwrap();
        assert_eq!(track.frame_index_at(-1.0), Some(0));
        assert_eq!(track.frame_index_at(0.0), Some(0));
        assert_eq!(track.frame_index_at(0.019), Some(0));
        assert_eq!(track.frame_index_at(0.02), Some(1));
        assert_eq!(track.frame_index_at(0.0399), Some(1));
        assert_eq!(track.frame_index_at(99.0), Some(4));
        assert_eq!(track.frame_index_at(f64::NAN), Some(0));
        assert_eq!(track.duration(), 0.1);
    }

    #[test]
    fn ragged_and_empty_tracks_are_refused() {
        assert!(VizTrack::assemble(50, Vec::new(), params(), 0).is_err());
        assert!(VizTrack::assemble(0, vec![frame(1, 1)], params(), 0).is_err());
        let ragged = vec![
            frame(1, 1),
            VizFrame {
                time: vec![0; 3].into_boxed_slice(),
                freq: vec![0; 8].into_boxed_slice(),
            },
        ];
        assert!(VizTrack::assemble(50, ragged, params(), 0).is_err());
    }

    #[test]
    fn the_frequency_window_takes_the_lowest_bins() {
        let mut freq = vec![0u8; 8];
        for (index, byte) in freq.iter_mut().enumerate() {
            *byte = index as u8;
        }
        let frame = VizFrame {
            time: vec![128; 4].into_boxed_slice(),
            freq: freq.into_boxed_slice(),
        };
        assert_eq!(frame.freq_window(3), &[0, 1, 2]);
        assert_eq!(frame.freq_window(99).len(), 8);
    }

    #[test]
    fn the_texture_rows_are_frozen_without_a_flip() {
        assert_eq!(AUDIO_TEXTURE_ROW_TIME, 0);
        assert_eq!(AUDIO_TEXTURE_ROW_FREQ, 1);
        assert_eq!(AUDIO_TEXTURE_ROWS, 2);
    }
}
