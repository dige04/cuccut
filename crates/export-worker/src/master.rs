//! Loudness mastering (architecture design §9.13): `export-worker master <input.json>` takes the whole mixed audio (a 32-bit float WAV in staging) and makes it reach the target loudness. It writes the result as 32-bit float raw PCM in staging (interleaved, `f32le`), and the Runtime then hands it to ffmpeg for encoding.
//!
//! The chain is the same one v2's export mastering uses (`chain::master_store` in `ccut-render`): loudness normalization (BS.1770 integrated loudness; silence or less than 400 ms is left alone), then true-peak limiting (the ceiling is the target true peak minus 0.1 dB), alternating for three rounds. Finally a static fallback brings the signal below the target true peak, based on a 4× oversampled true peak, and clamps it to [−1, 1].
//! Throughout, these are pure functions of `audio-dsp`. Transcendental functions use only libm, so the same mix yields bit-identical samples on every platform.
//!
//! The whole track is processed as a stream of fixed-length windows, so memory is independent of duration. The loudness meter carries its state across windows, the limiter carries a context of [`limiter_context`] samples on each side, and the true peak carries [`PEAK_CONTEXT`] on each side. The windowed result is bit-identical to computing the whole track at once (this file's tests cross-check it). The intermediate result of each round is written to a file in staging and deleted after use. v2 is only 48 kHz stereo; here we compute by the output's sample rate and channel count, and mono measures loudness as one channel (same as ffmpeg `ebur128`).
//!
//! stdout is JSON lines: `progress` (sample frames processed and the total; the measuring and processing of the three rounds, the peak scan, and the write-out are all counted), then a final line `mastered` (`inputLufs`, `lufs`, `truePeak`, `staticGainDb`), `error`, or `cancelled`.

use std::fs::File;
use std::io::{BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::atomic::Ordering;
use std::time::Instant;

use audio_dsp::loudness::{Meter, SILENCE_LUFS};
use audio_dsp::math::{db_to_gain, gain_to_db};
use audio_dsp::truepeak::{Limiter, PEAK_CONTEXT, limiter_context, limiter_gain, oversampled_peaks};
use serde::Deserialize;
use serde_json::json;

use crate::render::{PROGRESS_INTERVAL, watch_cancel};
use crate::{Failure, emit};

/// Number of rounds of normalization and limiting.
const PASSES: usize = 3;
/// Target integrated loudness and true-peak range (v2 `ccut export --loudness / --true-peak`).
pub const LUFS_RANGE: (f64, f64) = (-70.0, 0.0);
pub const TRUE_PEAK_RANGE: (f64, f64) = (-20.0, 0.0);

/// Mastering target.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Target {
    /// Integrated loudness (LUFS).
    pub lufs: f64,
    /// True-peak ceiling (dBTP).
    pub true_peak: f64,
}

/// Mastering measurements.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Measure {
    /// Integrated loudness before mastering (LUFS); when it cannot be measured (silence or under 400 ms) it is [`SILENCE_LUFS`].
    pub input_lufs: f64,
    /// Integrated loudness after mastering (LUFS).
    pub lufs: f64,
    /// True peak after mastering (dBTP).
    pub true_peak: f64,
    /// Sum of the static gains from loudness normalization across rounds (dB).
    pub static_gain_db: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MasterInput {
    /// Mix: 32-bit float WAV.
    input: PathBuf,
    /// Written raw PCM (`f32le`, interleaved).
    output: PathBuf,
    /// Intermediate files go here (the task's staging).
    staging: PathBuf,
    sample_rate: u32,
    channels: usize,
    lufs: f64,
    true_peak: f64,
}

fn invalid(message: impl Into<String>) -> Failure {
    Failure::new("INVALID_PARAMS", message)
}

fn io_failure(what: &str, error: std::io::Error) -> Failure {
    Failure::new("EXPORT_RENDER_FAILED", format!("{what}：{error}"))
}

/// A segment of samples with channels separated.
struct Planes(Vec<Vec<f32>>);

impl Planes {
    fn from_interleaved(x: &[f32], channels: usize) -> Planes {
        Planes(
            (0..channels)
                .map(|c| x.iter().skip(c).step_by(channels).copied().collect())
                .collect(),
        )
    }

    fn interleaved(&self) -> Vec<f32> {
        let n = self.0.first().map_or(0, Vec::len);
        let mut out = Vec::with_capacity(n * self.0.len());
        for i in 0..n {
            for c in &self.0 {
                out.push(c[i]);
            }
        }
        out
    }

    fn refs(&self) -> Vec<&[f32]> {
        self.0.iter().map(Vec::as_slice).collect()
    }

    /// Multiplies each channel by `g` (same formula as `Stereo::scale`).
    fn scale(&mut self, g: f64) {
        for v in self.0.iter_mut().flatten() {
            *v = (*v as f64 * g) as f32;
        }
    }

    /// Applies the gain curve over the segment `[lo, hi)` (same formula as `Stereo::apply_gain`).
    fn slice_with_gain(&self, lo: usize, hi: usize, gain: &[f64]) -> Planes {
        let g: Vec<f32> = gain[lo..hi].iter().map(|v| *v as f32).collect();
        Planes(
            self.0
                .iter()
                .map(|c| c[lo..hi].iter().zip(&g).map(|(v, g)| *v * *g).collect())
                .collect(),
        )
    }
}

/// The whole track's interleaved samples: in memory, as a raw `f32le` file in staging, or as the data chunk of a WAV file.
enum Store {
    /// The whole track in memory: tests cross-check it against the file-writing path.
    #[cfg_attr(not(test), allow(dead_code))]
    Mem(Vec<f32>),
    File {
        path: PathBuf,
        /// Data starts at this byte.
        offset: u64,
        writer: Option<BufWriter<File>>,
        /// Intermediate files that mastering creates itself are deleted after use. The input mix is not deleted here.
        owned: bool,
    },
}

impl Store {
    fn file(path: PathBuf) -> Result<Store, Failure> {
        let writer = BufWriter::new(File::create(&path).map_err(|e| io_failure("failed to create master intermediate file", e))?);
        Ok(Store::File {
            path,
            offset: 0,
            writer: Some(writer),
            owned: true,
        })
    }

    fn append(&mut self, x: &[f32]) -> Result<(), Failure> {
        match self {
            Store::Mem(v) => v.extend_from_slice(x),
            Store::File { writer, .. } => {
                let writer = writer.as_mut().expect("only append to an unfinished intermediate file");
                let mut bytes = Vec::with_capacity(x.len() * 4);
                for s in x {
                    bytes.extend_from_slice(&s.to_le_bytes());
                }
                writer.write_all(&bytes).map_err(|e| io_failure("failed to write master intermediate file", e))?;
            }
        }
        Ok(())
    }

    /// Written: read-only from now on.
    fn finish(&mut self) -> Result<(), Failure> {
        if let Store::File { writer, .. } = self
            && let Some(mut w) = writer.take()
        {
            w.flush().map_err(|e| io_failure("failed to write master intermediate file", e))?;
        }
        Ok(())
    }

    /// Interleaved samples of frames `[a, b)`.
    fn read(&self, a: u64, b: u64, channels: usize) -> Result<Vec<f32>, Failure> {
        let (from, to) = (a as usize * channels, b as usize * channels);
        match self {
            Store::Mem(v) => Ok(v[from..to].to_vec()),
            Store::File { path, offset, .. } => {
                let mut file = File::open(path).map_err(|e| io_failure("failed to read master input", e))?;
                file.seek(SeekFrom::Start(offset + from as u64 * 4))
                    .map_err(|e| io_failure("failed to read master input", e))?;
                let mut bytes = vec![0u8; (to - from) * 4];
                file.read_exact(&mut bytes).map_err(|e| io_failure("failed to read master input", e))?;
                Ok(bytes
                    .chunks_exact(4)
                    .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                    .collect())
            }
        }
    }

    fn planes(&self, a: u64, b: u64, channels: usize) -> Result<Planes, Failure> {
        Ok(Planes::from_interleaved(&self.read(a, b, channels)?, channels))
    }

    /// Deletes the intermediate file it created itself.
    fn discard(self) {
        if let Store::File { path, owned: true, .. } = self {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// Reads the format and data chunk of a 32-bit float WAV: returns the start of the data chunk and the frame count. If the data chunk length is written as 0 or `0xFFFFFFFF`, or exceeds the file, it is taken to run to the end of the file.
fn wav_data(path: &Path, sample_rate: u32, channels: usize) -> Result<(u64, u64), Failure> {
    let mut file = File::open(path).map_err(|e| io_failure("failed to read mix", e))?;
    let len = file.metadata().map_err(|e| io_failure("failed to read mix", e))?.len();
    let mut head = [0u8; 12];
    file.read_exact(&mut head).map_err(|e| io_failure("failed to read mix", e))?;
    if &head[0..4] != b"RIFF" || &head[8..12] != b"WAVE" {
        return Err(invalid("mix is not a WAV file"));
    }
    let mut at = 12u64;
    let mut format_ok = false;
    loop {
        let mut chunk = [0u8; 8];
        if file.read_exact(&mut chunk).is_err() {
            return Err(invalid("mix WAV has no data chunk"));
        }
        let size = u64::from(u32::from_le_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]));
        let body = at + 8;
        match &chunk[0..4] {
            b"fmt " => {
                let mut fmt = vec![0u8; size.min(64) as usize];
                file.read_exact(&mut fmt).map_err(|e| io_failure("failed to read mix", e))?;
                if fmt.len() < 16 {
                    return Err(invalid("mix WAV format chunk is incomplete"));
                }
                let tag = u16::from_le_bytes([fmt[0], fmt[1]]);
                let chans = usize::from(u16::from_le_bytes([fmt[2], fmt[3]]));
                let rate = u32::from_le_bytes([fmt[4], fmt[5], fmt[6], fmt[7]]);
                let bits = u16::from_le_bytes([fmt[14], fmt[15]]);
                // 3 is IEEE float; with 0xFFFE (WAVE_FORMAT_EXTENSIBLE), the first two bytes of the sub-format GUID are 3.
                let float = tag == 3 || (tag == 0xFFFE && fmt.len() >= 26 && u16::from_le_bytes([fmt[24], fmt[25]]) == 3);
                if !float || bits != 32 || chans != channels || rate != sample_rate {
                    return Err(invalid(format!(
                        "mix is not a {sample_rate} Hz, {channels}-channel 32-bit float WAV (format {tag}, {bits}-bit, {chans} channels, {rate} Hz)"
                    )));
                }
                format_ok = true;
            }
            b"data" => {
                if !format_ok {
                    return Err(invalid("mix WAV has a data chunk before the format chunk"));
                }
                let rest = len.saturating_sub(body);
                let bytes = if size == 0 || size == u64::from(u32::MAX) || size > rest {
                    rest
                } else {
                    size
                };
                return Ok((body, bytes / (4 * channels as u64)));
            }
            _ => {}
        }
        // Chunks are aligned to even byte boundaries.
        at = body + size + (size & 1);
        file.seek(SeekFrom::Start(at)).map_err(|e| io_failure("failed to read mix", e))?;
    }
}

/// Windowed mastering: bit-identical to running `(normalize → limit) × 3 → static fallback` over the whole track. `input` is the whole track before mastering, `scratch(k)` gives the storage for round k's intermediate results, `out` receives results window by window (interleaved, clamped to [−1, 1]), and `step(n)` reports that n frames were processed (returns `Err` on cancel).
#[allow(clippy::too_many_arguments)]
fn master_store(
    input: Store,
    frames: u64,
    channels: usize,
    sr: f64,
    target: Target,
    window: u64,
    scratch: &mut dyn FnMut(usize) -> Result<Store, Failure>,
    out: &mut dyn FnMut(&[f32]) -> Result<(), Failure>,
    step: &mut dyn FnMut(u64) -> Result<(), Failure>,
) -> Result<Measure, Failure> {
    let lim = Limiter {
        ceiling_db: target.true_peak - 0.1,
        ..Limiter::default()
    };
    let ctx = limiter_context(sr, lim) as u64;
    let windows = || (0..frames).step_by(window as usize).map(move |a| (a, (a + window).min(frames)));
    let measure = |store: &Store, step: &mut dyn FnMut(u64) -> Result<(), Failure>| -> Result<f64, Failure> {
        let mut meter = Meter::new(channels, sr);
        for (a, b) in windows() {
            meter.push(&store.planes(a, b, channels)?.refs());
            step(b - a)?;
        }
        Ok(meter.integrated())
    };
    let mut cur = input;
    let mut input_lufs = None;
    let mut static_gain_db = 0.0;
    for pass in 0..PASSES {
        let now = measure(&cur, step)?;
        input_lufs.get_or_insert(now);
        // Same as normalize_to_lufs: silence or under 400 ms is left alone.
        let gain = (now > SILENCE_LUFS).then_some(target.lufs - now);
        static_gain_db += gain.unwrap_or(0.0);
        let mut next = scratch(pass)?;
        for (a, b) in windows() {
            let (ca, cb) = (a.saturating_sub(ctx), (b + ctx).min(frames));
            let mut s = cur.planes(ca, cb, channels)?;
            if let Some(g) = gain {
                s.scale(db_to_gain(g));
            }
            let curve = limiter_gain(&s.refs(), sr, lim);
            let core = s.slice_with_gain((a - ca) as usize, (b - ca) as usize, &curve);
            next.append(&core.interleaved())?;
            step(b - a)?;
        }
        next.finish()?;
        cur.discard();
        cur = next;
    }
    // Static fallback: the whole track's true peak (with oversampling context on each side).
    let mut peak = 0.0f64;
    let pc = PEAK_CONTEXT as u64;
    for (a, b) in windows() {
        let (ca, cb) = (a.saturating_sub(pc), (b + pc).min(frames));
        let s = cur.planes(ca, cb, channels)?;
        let (lo, hi) = ((a - ca) as usize, (b - ca) as usize);
        for ch in s.refs() {
            peak = oversampled_peaks(ch)[lo..hi].iter().fold(peak, |m, v| m.max(*v));
        }
        step(b - a)?;
    }
    let tp = gain_to_db(peak);
    let trim = (tp > target.true_peak).then_some(target.true_peak - tp - 0.001);
    let mut meter = Meter::new(channels, sr);
    for (a, b) in windows() {
        let mut s = cur.planes(a, b, channels)?;
        if let Some(g) = trim {
            s.scale(db_to_gain(g));
        }
        meter.push(&s.refs());
        let mut x = s.interleaved();
        for v in &mut x {
            *v = v.clamp(-1.0, 1.0);
        }
        out(&x)?;
        step(b - a)?;
    }
    cur.discard();
    Ok(Measure {
        input_lufs: input_lufs.unwrap_or(SILENCE_LUFS),
        lufs: meter.integrated(),
        true_peak: tp + trim.unwrap_or(0.0),
        static_gain_db,
    })
}

/// Number of passes over the whole track (progress total = frames × passes): one measuring and one processing pass per round, plus one peak scan and one write-out pass.
const SWEEPS: u64 = 2 * PASSES as u64 + 2;

pub fn run(path: &Path) -> Result<ExitCode, Failure> {
    let cancel = watch_cancel();
    let text = std::fs::read_to_string(path).map_err(|e| invalid(format!("failed to read master input: {e}")))?;
    let input: MasterInput = serde_json::from_str(&text).map_err(|e| invalid(format!("cannot parse master input: {e}")))?;
    if !(LUFS_RANGE.0..=LUFS_RANGE.1).contains(&input.lufs) || !(TRUE_PEAK_RANGE.0..=TRUE_PEAK_RANGE.1).contains(&input.true_peak) {
        return Err(invalid(format!(
            "master target out of range: loudness {} LUFS (−70 to 0), true peak {} dBTP (−20 to 0)",
            input.lufs, input.true_peak
        )));
    }
    if !matches!(input.channels, 1 | 2) || input.sample_rate == 0 {
        return Err(invalid(format!(
            "master only supports mono or stereo: {} channels, {} Hz",
            input.channels, input.sample_rate
        )));
    }
    let channels = input.channels;
    let (offset, frames) = wav_data(&input.input, input.sample_rate, channels)?;
    let source = Store::File {
        path: input.input.clone(),
        offset,
        writer: None,
        owned: false,
    };
    let stem = input
        .output
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let mut scratch_paths: Vec<PathBuf> = Vec::new();
    let mut scratch = |pass: usize| {
        let path = input.staging.join(format!("{stem}.pass{}.f32", pass + 1));
        scratch_paths.push(path.clone());
        Store::file(path)
    };
    let mut writer = BufWriter::new(File::create(&input.output).map_err(|e| io_failure("failed to create master output", e))?);
    let mut out = |x: &[f32]| -> Result<(), Failure> {
        let mut bytes = Vec::with_capacity(x.len() * 4);
        for s in x {
            bytes.extend_from_slice(&s.to_le_bytes());
        }
        writer.write_all(&bytes).map_err(|e| io_failure("failed to write master output", e))
    };
    let total = frames * SWEEPS;
    let mut done = 0u64;
    let mut last = Instant::now();
    emit(&json!({ "event": "progress", "frame": 0, "total": total }));
    let mut step = |n: u64| -> Result<(), Failure> {
        done += n;
        if cancel.load(Ordering::SeqCst) {
            return Err(Failure::new("CANCELLED", "cancelled"));
        }
        if last.elapsed() >= PROGRESS_INTERVAL {
            last = Instant::now();
            emit(&json!({ "event": "progress", "frame": done, "total": total }));
        }
        Ok(())
    };
    let target = Target {
        lufs: input.lufs,
        true_peak: input.true_peak,
    };
    let sr = f64::from(input.sample_rate);
    let window = 4 * u64::from(input.sample_rate);
    let result = master_store(source, frames, channels, sr, target, window, &mut scratch, &mut out, &mut step);
    let result = result.and_then(|m| writer.flush().map(|()| m).map_err(|e| io_failure("failed to write master output", e)));
    for path in &scratch_paths {
        let _ = std::fs::remove_file(path);
    }
    match result {
        Ok(m) => {
            emit(&json!({
                "event": "mastered",
                "frames": frames,
                "inputLufs": m.input_lufs,
                "lufs": m.lufs,
                "truePeak": m.true_peak,
                "staticGainDb": m.static_gain_db,
            }));
            Ok(ExitCode::SUCCESS)
        }
        Err(failure) => {
            let _ = std::fs::remove_file(&input.output);
            if failure.code == "CANCELLED" {
                emit(&json!({ "event": "cancelled", "frame": done.min(total), "total": total }));
                return Ok(ExitCode::from(3));
            }
            Err(failure)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use audio_dsp::loudness::normalize_to_lufs;
    use audio_dsp::stereo::Stereo;
    use audio_dsp::truepeak::{limit, trim_to_ceiling, true_peak_db};

    fn noise(n: usize, seed: u64) -> Vec<f32> {
        let mut rng = audio_dsp::rng::Rng::new(seed);
        rng.normals(n).into_iter().map(|v| v * 0.3).collect()
    }

    /// Runs one windowed mastering pass. When `streamed`, both the input and the intermediate results are files in the temp directory.
    fn run_store(pre: &[f32], channels: usize, sr: f64, target: Target, window: u64, streamed: bool) -> (Vec<f32>, Measure) {
        let dir = tempfile::tempdir().unwrap();
        let frames = (pre.len() / channels) as u64;
        let input = if streamed {
            let mut store = Store::file(dir.path().join("in.f32")).unwrap();
            store.append(pre).unwrap();
            store.finish().unwrap();
            store
        } else {
            Store::Mem(pre.to_vec())
        };
        let mut got = Vec::new();
        let mut scratch = |pass: usize| {
            if streamed {
                Store::file(dir.path().join(format!("pass{pass}.f32")))
            } else {
                Ok(Store::Mem(Vec::new()))
            }
        };
        let m = master_store(
            input,
            frames,
            channels,
            sr,
            target,
            window,
            &mut scratch,
            &mut |x| {
                got.extend_from_slice(x);
                Ok(())
            },
            &mut |_| Ok(()),
        )
        .unwrap();
        if streamed {
            // Intermediate files are deleted as soon as they are used.
            let left: Vec<_> = std::fs::read_dir(dir.path()).unwrap().collect();
            assert!(left.is_empty(), "{left:?}");
        }
        (got, m)
    }

    #[test]
    fn windowed_master_matches_whole_signal_chain_bit_for_bit() {
        let n = 3 * 48_000 + 1234;
        let env = |i: usize| if (i / 7000).is_multiple_of(3) { 1.6 } else { 0.1 };
        let mut s = Stereo {
            l: noise(n, 3).into_iter().enumerate().map(|(i, v)| v * env(i)).collect(),
            r: noise(n, 4),
        };
        let target = Target {
            lufs: -16.0,
            true_peak: -1.2,
        };
        let pre = s.interleaved();
        // Reference: v2's whole-track one-shot computation.
        let lim = Limiter {
            ceiling_db: target.true_peak - 0.1,
            ..Limiter::default()
        };
        for _ in 0..PASSES {
            normalize_to_lufs(&mut s, 48_000.0, target.lufs);
            limit(&mut s, 48_000.0, lim);
        }
        trim_to_ceiling(&mut s, target.true_peak);
        let expected: Vec<f32> = s.interleaved().into_iter().map(|v| v.clamp(-1.0, 1.0)).collect();
        // The window length need not be a multiple of 10 ms: the loudness meter carries its state sample by sample.
        for (streamed, window) in [(false, 4800 * 3), (true, 4800 * 3), (true, 7777)] {
            let (got, m) = run_store(&pre, 2, 48_000.0, target, window, streamed);
            assert_eq!(got, expected, "streamed={streamed} window={window}");
            assert!((m.lufs - target.lufs).abs() < 0.5, "{m:?}");
            assert!(m.true_peak <= target.true_peak + 1e-6, "{m:?}");
            assert!(true_peak_db(&s.channels()) <= target.true_peak + 1e-6);
        }
    }

    /// Mastering part of v2 `export_loudness_masters_the_mix_and_refuses_the_ffmpeg_fallback`: a two-second 440 Hz stereo sine, peak 0.9, loudness far above −20 LUFS. After mastering it reaches the target, the true peak does not exceed the ceiling, and running it again is bit-identical.
    #[test]
    fn a_loud_tone_lands_on_the_target() {
        let target = Target {
            lufs: -20.0,
            true_peak: -2.0,
        };
        let tone: Vec<f32> = (0..96_000)
            .flat_map(|i| {
                let v = (0.9 * (std::f64::consts::TAU * 440.0 * i as f64 / 48_000.0).sin()) as f32;
                [v, v]
            })
            .collect();
        let (out, m) = run_store(&tone, 2, 48_000.0, target, 4 * 48_000, true);
        assert!((m.lufs - target.lufs).abs() < 0.5, "{m:?}");
        assert!(m.true_peak <= target.true_peak + 0.05, "{m:?}");
        assert!(m.input_lufs > m.lufs);
        let (again, _) = run_store(&tone, 2, 48_000.0, target, 4 * 48_000, false);
        assert_eq!(out, again);
    }

    /// Mono, 44.1 kHz: loudness is measured as one channel, and the result is bit-identical to the whole-track computation (same set of functions).
    #[test]
    fn mono_masters_against_its_own_whole_signal_reference() {
        let sr = 44_100.0;
        let n = 2 * 44_100 + 777;
        let mut x: Vec<f32> = noise(n, 9)
            .into_iter()
            .enumerate()
            .map(|(i, v)| if i % 9000 < 3000 { v * 2.5 } else { v * 0.05 })
            .collect();
        let target = Target {
            lufs: -18.0,
            true_peak: -1.0,
        };
        let pre = x.clone();
        let lim = Limiter {
            ceiling_db: target.true_peak - 0.1,
            ..Limiter::default()
        };
        for _ in 0..PASSES {
            let now = audio_dsp::loudness::integrated(&[&x], sr);
            if now > SILENCE_LUFS {
                let g = db_to_gain(target.lufs - now);
                for v in &mut x {
                    *v = (*v as f64 * g) as f32;
                }
            }
            let curve = limiter_gain(&[&x], sr, lim);
            for (v, g) in x.iter_mut().zip(curve) {
                *v *= g as f32;
            }
        }
        let tp = true_peak_db(&[&x]);
        if tp > target.true_peak {
            let g = db_to_gain(target.true_peak - tp - 0.001);
            for v in &mut x {
                *v = (*v as f64 * g) as f32;
            }
        }
        let expected: Vec<f32> = x.iter().map(|v| v.clamp(-1.0, 1.0)).collect();
        let (got, m) = run_store(&pre, 1, sr, target, 4 * 44_100, true);
        assert_eq!(got, expected);
        assert!((m.lufs - target.lufs).abs() < 0.5, "{m:?}");
        assert!(m.true_peak <= target.true_peak + 1e-6, "{m:?}");
    }

    /// Silence: loudness cannot be measured, so no gain is added; it is written out anyway (all zeros).
    #[test]
    fn silence_is_not_normalized() {
        let (out, m) = run_store(
            &vec![0.0; 2 * 48_000],
            2,
            48_000.0,
            Target {
                lufs: -16.0,
                true_peak: -1.2,
            },
            48_000,
            false,
        );
        assert_eq!(m.input_lufs, SILENCE_LUFS);
        assert_eq!(m.static_gain_db, 0.0);
        assert!(out.iter().all(|v| *v == 0.0));
    }

    /// Reads a float WAV written by ffmpeg (including EXTENSIBLE): rejected when the format does not match; when the data chunk length is malformed, it is taken to run to the end of the file.
    #[test]
    fn reads_float_wav_headers() {
        let dir = tempfile::tempdir().unwrap();
        let wav = |tag: u16, data_size: u32, samples: usize| {
            let mut fmt = Vec::new();
            fmt.extend_from_slice(&tag.to_le_bytes());
            fmt.extend_from_slice(&2u16.to_le_bytes());
            fmt.extend_from_slice(&48_000u32.to_le_bytes());
            fmt.extend_from_slice(&(48_000u32 * 8).to_le_bytes());
            fmt.extend_from_slice(&8u16.to_le_bytes());
            fmt.extend_from_slice(&32u16.to_le_bytes());
            if tag == 0xFFFE {
                fmt.extend_from_slice(&22u16.to_le_bytes());
                fmt.extend_from_slice(&32u16.to_le_bytes());
                fmt.extend_from_slice(&3u32.to_le_bytes());
                fmt.extend_from_slice(&3u16.to_le_bytes());
                fmt.extend_from_slice(&[0u8; 14]);
            }
            let mut bytes = b"RIFF\0\0\0\0WAVE".to_vec();
            bytes.extend_from_slice(b"LIST");
            bytes.extend_from_slice(&3u32.to_le_bytes());
            bytes.extend_from_slice(b"abc\0");
            bytes.extend_from_slice(b"fmt ");
            bytes.extend_from_slice(&(fmt.len() as u32).to_le_bytes());
            bytes.extend_from_slice(&fmt);
            bytes.extend_from_slice(b"data");
            bytes.extend_from_slice(&data_size.to_le_bytes());
            bytes.extend(std::iter::repeat_n(0u8, samples * 4));
            bytes
        };
        let path = dir.path().join("mix.wav");
        std::fs::write(&path, wav(3, 80, 20)).unwrap();
        let (offset, frames) = wav_data(&path, 48_000, 2).unwrap();
        assert_eq!((offset, frames), (12 + 12 + 8 + 16 + 8, 10));
        std::fs::write(&path, wav(0xFFFE, u32::MAX, 20)).unwrap();
        assert_eq!(wav_data(&path, 48_000, 2).unwrap().1, 10);
        assert!(wav_data(&path, 44_100, 2).is_err());
        assert!(wav_data(&path, 48_000, 1).is_err());
        std::fs::write(&path, wav(1, 80, 20)).unwrap();
        assert!(wav_data(&path, 48_000, 2).is_err());
    }
}
