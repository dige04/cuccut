//! Sound for a waveform instance (format spec §3.7): the asset's spectrum (BCS1, ordered by the asset's source time) is assembled according to the sequence's sound plan into one spectrum on this instance's sequence timeline. Frame k is the sound heard at sequence time `k / 60`, and the kernel samples by sequence time.
//!
//! - `audio: 'project'` (default) is the sequence's mixed sound: at each moment, every segment that is sounding ([`render_graph::audio_plan`], the same plan as the export mix, with gain, fades, crossfades and ducking all applied, except script-triggered ducking) contributes the frame at its source time. Frequency domain adds by power, time domain adds by amplitude;
//! - when `audio` is an asset ID, only that asset is heard: at each moment it takes the source time of the segment playing it (the later segment when two segments abut), with no gain applied. If it is not playing at that moment, it is silence;
//! - asset spectra are computed once per asset version (export: the Render Worker decodes the asset file; preview: the UI decodes it and computes via the preview WASM). Assembly is only a table lookup, and preview and export use the same code.
//!
//! The dB values of the spectrum use BCS1's canonical window ([-120, 40]); byte 0 is treated as no energy.
//!
//! Speakers and visibility (§3.7 `speaker`, `alwaysShow`) are applied on the derived track ([`gate`], [`audible_frames`]); the rules are in [`SPEAKER_HOLD`].

use std::collections::BTreeMap;

use render_graph::audio_plan::AudioSegment;
use render_raster::source::{VizSource, VizTrack};
use video_model::VersionRef;
use waveform::Fnv1a64;
use waveform::bcs1::{
    self, ANALYSIS_RATE, Bcs1Header, CANONICAL_MAX_DB, CANONICAL_MIN_DB, FRAME_LEN, FREQ_BINS, SpectrumBackend, TIME_BINS,
};
use waveform::remap::canonical_db;

/// Which sound channel the waveform listens to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Route {
    /// The sequence's mixed sound.
    Project,
    /// Listen to this asset only.
    Asset(String),
}

impl Route {
    pub fn of(audio: &str) -> Route {
        if audio == "project" {
            Route::Project
        } else {
            Route::Asset(audio.to_string())
        }
    }
}

/// Key for an asset spectrum: `asset ID@version`.
pub fn asset_key(asset: &VersionRef) -> String {
    format!("{}@{}", asset.id, asset.revision)
}

/// The sound segments that `route` uses in sequence time `[start, end)` (sequence time starts at 0, i.e. the whole sequence's sound plan).
pub fn segments_for<'a>(segments: &'a [AudioSegment], route: &Route, start: f64, end: f64) -> Vec<&'a AudioSegment> {
    segments
        .iter()
        .filter(|s| s.end > start && s.start < end && s.end > s.start)
        .filter(|s| match route {
            Route::Project => true,
            Route::Asset(id) => s.asset.id == *id,
        })
        .collect()
}

/// Asset spectra to read (deduplicated, sorted by key).
pub fn sources_of(segments: &[&AudioSegment]) -> Vec<VersionRef> {
    let mut seen = BTreeMap::new();
    for segment in segments {
        seen.entry(asset_key(&segment.asset)).or_insert_with(|| segment.asset.clone());
    }
    seen.into_values().collect()
}

/// The intervals in which each speaker talks on the sequence (seconds, sorted by start time; `render_graph::audio_plan::speaker_activity`).
pub type SpeakerActivity = BTreeMap<String, Vec<(f64, f64)>>;

/// Hold time (seconds) for speakers and `alwaysShow: false`: two words from the same speaker no more than this far apart count as continuous speech (same lower bound as the merged trigger intervals for script-triggered ducking). A waveform with `alwaysShow: false` hides only after it has been silent this long, and appears as soon as sound starts.
pub const SPEAKER_HOLD: f64 = 0.5;

/// Merges one speaker's word intervals into speech segments: segments no more than [`SPEAKER_HOLD`] apart are joined.
pub fn speaking_spans(intervals: &[(f64, f64)]) -> Vec<(f64, f64)> {
    let mut sorted: Vec<(f64, f64)> = intervals.iter().copied().filter(|(s, e)| e > s).collect();
    sorted.sort_by(|a, b| a.0.total_cmp(&b.0));
    let mut spans: Vec<(f64, f64)> = Vec::new();
    for (start, end) in sorted {
        match spans.last_mut() {
            Some(last) if start - last.1 <= SPEAKER_HOLD => last.1 = last.1.max(end),
            _ => spans.push((start, end)),
        }
    }
    spans
}

/// Keeps only the frames inside the speech segments (frame k is at sequence time `k / analysis frame rate` and falls within some `[start, end)` segment); all other frames are replaced with silent frames ([`VizTrack::silent_frame`]). When `spans` is `None`, the whole track is silent.
pub fn gate(track: &VizTrack, spans: Option<&[(f64, f64)]>) -> Option<VizTrack> {
    let rate = f64::from(track.analysis_rate());
    let silent = track.silent_frame();
    let frames = (0..track.frame_count())
        .map(|k| {
            let t = k as f64 / rate;
            let speaking = spans.is_some_and(|spans| spans.iter().any(|(s, e)| *s <= t && t < *e));
            match track.frame(k) {
                Some(frame) if speaking => frame.clone(),
                _ => silent.clone(),
            }
        })
        .collect();
    // The content fingerprint is computed from the frames (the source hash is just one item in it); there is no separate source here.
    VizTrack::assemble(track.analysis_rate(), frames, track.params(), 0).ok()
}

/// Whether each frame counts as sounding (with `alwaysShow: false`, only sounding frames are drawn): this frame, or some frame within [`SPEAKER_HOLD`] before it, has a frequency row that is not all 0.
pub fn audible_frames(track: &VizTrack) -> Vec<bool> {
    let hold = (SPEAKER_HOLD * f64::from(track.analysis_rate())).round() as usize;
    let mut last: Option<usize> = None;
    (0..track.frame_count())
        .map(|k| {
            if track.frame(k).is_some_and(|frame| frame.freq.iter().any(|&b| b != 0)) {
                last = Some(k);
            }
            last.is_some_and(|at| k - at <= hold)
        })
        .collect()
}

/// Assembles the spectrum for `route` over sequence time `[start, end)` (BCS1; frame k is at sequence time `k / 60`; frames before `start` are silent).
/// `sources` supplies asset spectra by [`asset_key`] and must contain every one listed by [`sources_of`]; an asset spectrum that cannot be read is an error.
pub fn compose(
    segments: &[&AudioSegment],
    route: &Route,
    start: f64,
    end: f64,
    sources: &BTreeMap<String, Vec<u8>>,
) -> Result<Vec<u8>, String> {
    let mut views = BTreeMap::new();
    for segment in segments {
        let key = asset_key(&segment.asset);
        if views.contains_key(&key) {
            continue;
        }
        let bytes = sources.get(&key).ok_or_else(|| format!("no spectrum for asset {key}"))?;
        let view = bcs1::parse(bytes).map_err(|e| format!("cannot read the spectrum of asset {key}: {e:#}"))?;
        views.insert(key, view);
    }
    let rate = f64::from(ANALYSIS_RATE);
    let frames = ((end.max(0.0) * rate).ceil() as usize).max(1);
    let first = ((start.max(0.0) * rate).floor() as usize).min(frames);
    let mut payload = vec![0u8; frames * FRAME_LEN];
    for frame in payload.chunks_exact_mut(FRAME_LEN) {
        frame[..TIME_BINS as usize].fill(128);
    }
    let mut power = vec![0f64; FREQ_BINS as usize];
    let mut wave = vec![0f64; TIME_BINS as usize];
    for k in first..frames {
        let t = k as f64 / rate;
        let out = &mut payload[k * FRAME_LEN..(k + 1) * FRAME_LEN];
        match route {
            Route::Asset(_) => {
                // When two segments abut (or overlap in a crossfade), the one that starts later is used.
                let Some(segment) = segments
                    .iter()
                    .filter(|s| s.start <= t && t < s.end)
                    .max_by(|a, b| a.start.total_cmp(&b.start))
                else {
                    continue;
                };
                if let Some(row) = source_frame(&views[&asset_key(&segment.asset)], segment, t) {
                    out.copy_from_slice(row);
                }
            }
            Route::Project => {
                power.fill(0.0);
                wave.fill(0.0);
                let mut any = false;
                for segment in segments.iter().filter(|s| s.start <= t && t < s.end) {
                    let Some(row) = source_frame(&views[&asset_key(&segment.asset)], segment, t) else {
                        continue;
                    };
                    any = true;
                    let gain_db = segment.gain_db_at(t);
                    let amplitude = 10f64.powf(gain_db / 20.0);
                    for (acc, &byte) in wave.iter_mut().zip(&row[..TIME_BINS as usize]) {
                        *acc += (f64::from(byte) - 128.0) * amplitude;
                    }
                    for (acc, &byte) in power.iter_mut().zip(&row[TIME_BINS as usize..]) {
                        if byte > 0 {
                            *acc += 10f64.powf((canonical_db(byte) + gain_db) / 10.0);
                        }
                    }
                }
                if !any {
                    continue;
                }
                for (slot, acc) in out[..TIME_BINS as usize].iter_mut().zip(&wave) {
                    *slot = (128.0 + acc.round()).clamp(0.0, 255.0) as u8;
                }
                for (slot, &p) in out[TIME_BINS as usize..].iter_mut().zip(&power) {
                    *slot = if p > 0.0 { canonical_byte(10.0 * p.log10()) } else { 0 };
                }
            }
        }
    }
    let mut hash = Fnv1a64::new();
    hash.write(b"cuccut-visualizer-compose-v1");
    hash.write(&[u8::from(*route == Route::Project)]);
    for segment in segments {
        let header = views[&asset_key(&segment.asset)].header();
        hash.write(&header.content_hash.to_le_bytes());
        for value in [
            segment.start,
            segment.end,
            segment.source_start,
            segment.source_rate,
            segment.gain_db,
        ] {
            hash.write(&value.to_le_bytes());
        }
    }
    let backend = if views.values().any(|v| v.header().backend == SpectrumBackend::Ffmpeg) {
        SpectrumBackend::Ffmpeg
    } else {
        SpectrumBackend::Symphonia
    };
    bcs1::encode(&Bcs1Header::new(backend, frames as u32, hash.finish()), &payload).map_err(|e| format!("{e:#}"))
}

/// Which asset frame a segment takes at sequence time `t` (none past the end of the asset).
fn source_frame<'a>(view: &bcs1::Bcs1View<'a>, segment: &AudioSegment, t: f64) -> Option<&'a [u8]> {
    let source = segment.source_start + (t - segment.start) * segment.source_rate;
    if !source.is_finite() || source < 0.0 {
        return None;
    }
    // Floating-point error must not drop a time that falls exactly on a frame boundary to the previous frame.
    let index = (source * f64::from(view.header().analysis_rate) + 1e-6).floor() as usize;
    view.frame(index)
}

/// dB → canonical byte (same formula as the BCS1 analysis).
fn canonical_byte(decibels: f64) -> u8 {
    (255.0 * (decibels - CANONICAL_MIN_DB) / (CANONICAL_MAX_DB - CANONICAL_MIN_DB))
        .clamp(0.0, 255.0)
        .round() as u8
}

/// Asset file → BCS1: decodes to 48 kHz mono in pure Rust, falling back to `ffmpeg` (`-ac 1 -ar 48000`) when that fails. No audio is an error.
#[cfg(feature = "host")]
pub fn analyze_file(path: &std::path::Path, ffmpeg: &std::path::Path) -> anyhow::Result<Vec<u8>> {
    use anyhow::Context;
    let (pcm, backend) = match render_raster::audio::decode_mono_48k(path) {
        Ok(pcm) if !pcm.is_empty() => (pcm, SpectrumBackend::Symphonia),
        _ => {
            let output = std::process::Command::new(ffmpeg)
                .args(["-v", "error", "-nostdin", "-i"])
                .arg(path)
                .args(["-vn", "-f", "f32le", "-ac", "1", "-ar", "48000", "-"])
                .stdin(std::process::Stdio::null())
                .output()
                .with_context(|| format!("failed to start ffmpeg decode of {}", path.display()))?;
            if !output.status.success() {
                anyhow::bail!(
                    "ffmpeg decode of {} failed: {}",
                    path.display(),
                    String::from_utf8_lossy(&output.stderr).trim()
                );
            }
            let pcm = output
                .stdout
                .chunks_exact(4)
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect();
            (pcm, SpectrumBackend::Ffmpeg)
        }
    };
    waveform::dsp::analyze(&pcm, backend).with_context(|| format!("computing the spectrum of {}", path.display()))
}
