//! Mono PCM → beats, bars and sections. The execution body of `ccut beats` only handles decoding and projection; the algorithms all live here.
//!
//! Pipeline (all deterministic: the same PCM gives the same result):
//!
//! 1. **Onset envelope**: STFT with a 32 ms Hann window and 10 ms hop; half-wave rectified spectral flux of the log magnitude.
//!    The low band (< 150 Hz, kick drum) gets its own envelope.
//! 2. **Tempo**: autocorrelation of the envelope, peak picking over the lags of `[min_bpm, max_bpm]`, multiplied by a log-normal prior centered at 120 BPM with a standard deviation of one octave (suppresses double and half tempo). Then half the support at twice the lag is added (taking the maximum over ±1 frame, so a peak that falls between integer lags when doubled is not lost), and parabolic interpolation gives the fractional lag.
//! 3. **Beats**: Ellis dynamic programming (penalty on the squared log of the deviation of each beat interval from the period). After backtracking, beats at the start and end with no onset support are trimmed.
//! 4. **Grid**: number the beats by period and fit least squares to get the period and phase of a constant-tempo grid. The residual tells the caller whether the song is constant-tempo (DAW-made songs are nearly zero, live recordings are large).
//! 5. **Downbeats**: group the beats by grid index modulo `beats_per_bar`. The group with the largest sum of z-scores (kick strength plus timbre change around the beat) is the first beat of the bar.
//! 6. **Sections**: for each bar, take the energy, the energy of three frequency bands and the onset density. The novelty is the difference between the means of the four bars before and after. Peaks cut the sections (slight weighting at integer multiples of four bars; minimum section length four bars).

use anyhow::{Result, bail};
use realfft::RealFftPlanner;

/// Analysis parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct BeatOptions {
    /// Beats per bar.
    pub beats_per_bar: usize,
    pub min_bpm: f64,
    pub max_bpm: f64,
}

impl Default for BeatOptions {
    fn default() -> Self {
        Self {
            beats_per_bar: 4,
            min_bpm: 60.0,
            max_bpm: 200.0,
        }
    }
}

/// One bar: `[start, end)`. `energy` is the loudness over the whole track, normalized to 0..1.
#[derive(Debug, Clone, PartialEq)]
pub struct Bar {
    pub start: f64,
    pub end: f64,
    pub energy: f64,
}

/// One section: `[start, end)`, covering bars `[first_bar, end_bar)`. `energy` is the mean bar energy within the section.
#[derive(Debug, Clone, PartialEq)]
pub struct Section {
    pub start: f64,
    pub end: f64,
    pub first_bar: usize,
    pub end_bar: usize,
    pub energy: f64,
}

/// Analysis result. All time units are seconds.
#[derive(Debug, Clone, PartialEq)]
pub struct BeatAnalysis {
    pub duration: f64,
    /// BPM of the constant-tempo grid (`60 / period`).
    pub tempo: f64,
    /// Seconds per beat.
    pub period: f64,
    /// The first beat on the grid that is ≥ 0.
    pub offset: f64,
    /// Root-mean-square residual (seconds) of the tracked beats relative to the grid.
    pub residual: f64,
    /// Salience of the tempo peak, 0..1.
    pub confidence: f64,
    /// The tracked beats.
    pub beats: Vec<f64>,
    pub beats_per_bar: usize,
    /// The first beat of the first bar (the downbeat).
    pub downbeat: f64,
    /// Confidence of the downbeat phase decision, 0..1.
    pub downbeat_confidence: f64,
    pub bars: Vec<Bar>,
    pub sections: Vec<Section>,
}

const HOP_SECONDS: f64 = 0.01;
const WINDOW_SECONDS: f64 = 0.032;
const LOW_BAND_HZ: f64 = 150.0;
const MID_BAND_HZ: f64 = 2000.0;
const MAX_BAND_HZ: f64 = 8000.0;
const PRIOR_BPM: f64 = 120.0;
/// Tightness of the DP: larger values forbid beat intervals from deviating from the period (librosa's default).
const TIGHTNESS: f64 = 100.0;
/// Half-window for section novelty, and the minimum section length, both in bars.
const SECTION_HALF_WINDOW: usize = 4;
const MIN_SECTION_BARS: usize = 4;

/// Per-frame features.
struct Frames {
    fps: f64,
    /// Full-band spectral flux.
    flux: Vec<f64>,
    /// Low-band spectral flux (kick drum).
    low_flux: Vec<f64>,
    /// Energy of three frequency bands (log), `[low, mid, high]`.
    bands: Vec<[f64; 3]>,
    /// Log magnitudes of 12 log-spaced bands, used for timbre comparison before and after a beat.
    timbre: Vec<[f64; 12]>,
}

pub fn analyze(pcm: &[f32], sample_rate: u32, options: &BeatOptions) -> Result<BeatAnalysis> {
    if sample_rate < 8000 {
        bail!("采样率 {sample_rate} Hz 太低，无法分析节拍");
    }
    if options.beats_per_bar == 0 || options.min_bpm <= 0.0 || options.max_bpm <= options.min_bpm {
        bail!("节拍参数无效：每小节拍数须 ≥ 1，BPM 下限须 > 0 且小于上限");
    }
    let duration = pcm.len() as f64 / f64::from(sample_rate);
    let frames = frames(pcm, sample_rate);
    let n = frames.flux.len();
    let onset = normalized(&frames.flux);
    if n < 4 || onset.iter().all(|value| *value == 0.0) {
        bail!("音频里没有可用的起音（静音或太短），无法分析节拍");
    }
    let (lag, confidence) = tempo_lag(&onset, frames.fps, options);
    let beat_frames = track_beats(&onset, lag);
    if beat_frames.len() < 2 {
        bail!("没能追踪到稳定的节拍");
    }
    let beats: Vec<f64> = beat_frames
        .iter()
        .map(|frame| *frame as f64 / frames.fps)
        .collect();
    let (period, phase, residual) = fit_grid(&beats, lag / frames.fps);
    let mut offset = phase - (phase / period).floor() * period;
    if offset < 0.0 {
        offset += period;
    }
    let grid_index: Vec<i64> = beats
        .iter()
        .map(|beat| ((beat - offset) / period).round() as i64)
        .collect();
    let (downbeat_phase, downbeat_confidence) = downbeat_phase(
        &frames,
        &beat_frames,
        &grid_index,
        lag,
        options.beats_per_bar,
    );
    let per_bar = options.beats_per_bar as i64;
    let bar_starts: Vec<f64> = beats
        .iter()
        .zip(&grid_index)
        .filter(|(_, index)| (*index - downbeat_phase as i64).rem_euclid(per_bar) == 0)
        .map(|(beat, _)| *beat)
        .collect();
    let downbeat = bar_starts.first().copied().unwrap_or(beats[0]);
    let bars = bars(
        pcm,
        sample_rate,
        &bar_starts,
        period * options.beats_per_bar as f64,
        duration,
    );
    let sections = sections(&frames, &onset, &bars, duration);
    Ok(BeatAnalysis {
        duration,
        tempo: 60.0 / period,
        period,
        offset,
        residual,
        confidence,
        beats,
        beats_per_bar: options.beats_per_bar,
        downbeat,
        downbeat_confidence,
        bars,
        sections,
    })
}

fn frames(pcm: &[f32], sample_rate: u32) -> Frames {
    let rate = f64::from(sample_rate);
    let hop = (rate * HOP_SECONDS).round().max(1.0) as usize;
    let fps = rate / hop as f64;
    let window_len = ((rate * WINDOW_SECONDS) as usize).next_power_of_two();
    let window: Vec<f64> = (0..window_len)
        .map(|index| {
            0.5 - 0.5 * (2.0 * std::f64::consts::PI * index as f64 / window_len as f64).cos()
        })
        .collect();
    let bin_hz = rate / window_len as f64;
    let bins = window_len / 2 + 1;
    let top = ((MAX_BAND_HZ.min(rate / 2.0) / bin_hz) as usize).min(bins - 1);
    let low = ((LOW_BAND_HZ / bin_hz).ceil() as usize).clamp(2, top);
    let mid = ((MID_BAND_HZ / bin_hz) as usize).clamp(low + 1, top);
    // 12 log-spaced bands: 100 Hz – 4 kHz.
    let edges: Vec<usize> = (0..=12)
        .map(|k| {
            let hz = 100.0 * (40.0_f64).powf(k as f64 / 12.0);
            ((hz / bin_hz) as usize).clamp(1, top)
        })
        .collect();
    let count = pcm.len().div_ceil(hop);
    let fft = RealFftPlanner::<f64>::new().plan_fft_forward(window_len);
    let mut input = fft.make_input_vec();
    let mut spectrum = fft.make_output_vec();
    let mut scratch = fft.make_scratch_vec();
    let mut previous = vec![0.0_f64; top + 1];
    let mut current = vec![0.0_f64; top + 1];
    let mut out = Frames {
        fps,
        flux: Vec::with_capacity(count),
        low_flux: Vec::with_capacity(count),
        bands: Vec::with_capacity(count),
        timbre: Vec::with_capacity(count),
    };
    let half = (window_len / 2) as isize;
    for frame in 0..count {
        let center = (frame * hop) as isize;
        for (offset, slot) in input.iter_mut().enumerate() {
            let index = center - half + offset as isize;
            let sample = if index < 0 {
                0.0
            } else {
                pcm.get(index as usize)
                    .copied()
                    .filter(|sample| sample.is_finite())
                    .unwrap_or(0.0)
            };
            *slot = f64::from(sample) * window[offset];
        }
        if fft
            .process_with_scratch(&mut input, &mut spectrum, &mut scratch)
            .is_err()
        {
            spectrum
                .iter_mut()
                .for_each(|bin| *bin = Default::default());
        }
        let mut power = [0.0_f64; 3];
        for (bin, slot) in current.iter_mut().enumerate() {
            let value = spectrum[bin];
            let magnitude =
                (value.re * value.re + value.im * value.im).sqrt() * 2.0 / window_len as f64;
            *slot = (1.0 + 1000.0 * magnitude).ln();
            let band = if bin < low {
                0
            } else if bin < mid {
                1
            } else {
                2
            };
            power[band] += magnitude * magnitude;
        }
        let mut flux = 0.0;
        let mut low_flux = 0.0;
        for bin in 1..=top {
            let rise = (current[bin] - previous[bin]).max(0.0);
            flux += rise;
            if bin < low {
                low_flux += rise;
            }
        }
        let mut timbre = [0.0_f64; 12];
        for (k, slot) in timbre.iter_mut().enumerate() {
            let (a, b) = (edges[k], edges[k + 1].max(edges[k] + 1).min(top + 1));
            let span = &current[a..b];
            *slot = span.iter().sum::<f64>() / span.len().max(1) as f64;
        }
        out.flux.push(if frame == 0 { 0.0 } else { flux });
        out.low_flux.push(if frame == 0 { 0.0 } else { low_flux });
        out.bands
            .push(power.map(|value| 10.0 * (value + 1e-12).log10()));
        out.timbre.push(timbre);
        std::mem::swap(&mut previous, &mut current);
    }
    out
}

/// Subtract the mean, normalize by the standard deviation, and set negative values to zero.
fn normalized(values: &[f64]) -> Vec<f64> {
    let (mean, std) = mean_std(values);
    if std <= 1e-12 {
        return vec![0.0; values.len()];
    }
    values
        .iter()
        .map(|value| ((value - mean) / std).max(0.0))
        .collect()
}

fn mean_std(values: &[f64]) -> (f64, f64) {
    if values.is_empty() {
        return (0.0, 0.0);
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let variance = values
        .iter()
        .map(|value| (value - mean).powi(2))
        .sum::<f64>()
        / values.len() as f64;
    (mean, variance.sqrt())
}

/// Tempo: returns the beat period (in frames, fractional) and its salience.
fn tempo_lag(onset: &[f64], fps: f64, options: &BeatOptions) -> (f64, f64) {
    let lag_min = ((fps * 60.0 / options.max_bpm).floor() as usize).max(1);
    let lag_max = ((fps * 60.0 / options.min_bpm).ceil() as usize).max(lag_min + 2);
    let n = onset.len();
    let acf = |lag: usize| -> f64 {
        if lag >= n {
            return 0.0;
        }
        let sum: f64 = onset[..n - lag]
            .iter()
            .zip(&onset[lag..])
            .map(|(a, b)| a * b)
            .sum();
        sum / (n - lag) as f64
    };
    let raw: Vec<f64> = (0..=2 * lag_max + 2).map(acf).collect();
    // For the double lag, take the maximum over ±1 frame. An integer lag doubled is off by one frame, and the autocorrelation peak of the onset envelope is only one or two frames wide. The true tempo's double-beat peak was therefore missed, and 1.5 beats (the 3-3-2 division's repeated figure) won instead (Gangnam Style 132 → 88).
    let near = |center: usize| {
        raw[center - 1..=center + 1]
            .iter()
            .copied()
            .fold(0.0, f64::max)
    };
    let weighted: Vec<f64> = (0..=lag_max + 1)
        .map(|lag| {
            if lag < lag_min || lag > lag_max {
                return 0.0;
            }
            let bpm = fps * 60.0 / lag as f64;
            let octave = (bpm / PRIOR_BPM).log2();
            let prior = (-0.5 * octave * octave).exp();
            (raw[lag] + 0.5 * near(2 * lag)) * prior
        })
        .collect();
    let best = (lag_min..=lag_max)
        .max_by(|a, b| weighted[*a].total_cmp(&weighted[*b]).then(b.cmp(a)))
        .unwrap_or(lag_min);
    let mut lag = best as f64;
    if best > lag_min && best < lag_max {
        let (left, mid, right) = (weighted[best - 1], weighted[best], weighted[best + 1]);
        let denominator = left - 2.0 * mid + right;
        if denominator.abs() > 1e-12 {
            lag += (0.5 * (left - right) / denominator).clamp(-0.5, 0.5);
        }
    }
    let mut sorted: Vec<f64> = weighted[lag_min..=lag_max].to_vec();
    sorted.sort_by(f64::total_cmp);
    let median = sorted[sorted.len() / 2];
    let peak = weighted[best];
    let confidence = if peak > 1e-12 {
        ((peak - median) / peak).clamp(0.0, 1.0)
    } else {
        0.0
    };
    (lag, confidence)
}

/// Ellis dynamic-programming beat tracking: returns the frames where the beats fall.
fn track_beats(onset: &[f64], period: f64) -> Vec<usize> {
    let n = onset.len();
    // Local score: the envelope smoothed with a Gaussian of width period/32.
    let sigma = (period / 32.0).max(0.5);
    let radius = (sigma * 3.0).ceil() as isize;
    let kernel: Vec<f64> = (-radius..=radius)
        .map(|k| (-0.5 * (k as f64 / sigma).powi(2)).exp())
        .collect();
    let local: Vec<f64> = (0..n as isize)
        .map(|t| {
            (-radius..=radius)
                .map(|k| {
                    let index = t + k;
                    if index < 0 || index >= n as isize {
                        0.0
                    } else {
                        onset[index as usize] * kernel[(k + radius) as usize]
                    }
                })
                .sum()
        })
        .collect();
    let far = (2.0 * period).round() as usize;
    let near = ((period / 2.0).round() as usize).max(1);
    let mut score = vec![0.0_f64; n];
    let mut back: Vec<Option<usize>> = vec![None; n];
    for t in 0..n {
        let mut best: Option<(f64, usize)> = None;
        if t >= near {
            for tau in t.saturating_sub(far)..=t - near {
                let gap = (t - tau) as f64 / period;
                let value = score[tau] - TIGHTNESS * gap.ln().powi(2);
                if best.is_none_or(|(current, _)| value > current) {
                    best = Some((value, tau));
                }
            }
        }
        match best {
            Some((value, tau)) if value > 0.0 => {
                score[t] = local[t] + value;
                back[t] = Some(tau);
            }
            _ => score[t] = local[t],
        }
    }
    // Last beat: the frame with the highest score within the last period.
    let tail = n.saturating_sub(period.ceil() as usize);
    let mut last = (tail..n)
        .max_by(|a, b| score[*a].total_cmp(&score[*b]).then(b.cmp(a)))
        .unwrap_or(n - 1);
    let mut beats = vec![last];
    while let Some(previous) = back[last] {
        beats.push(previous);
        last = previous;
    }
    beats.reverse();
    // Trim beats at the start and end that have no onset support (silence in the intro, decay at the end).
    let rms = (local.iter().map(|v| v * v).sum::<f64>() / n as f64).sqrt();
    let threshold = 0.5 * rms;
    let support = |frame: usize| {
        let lo = frame.saturating_sub(2);
        let hi = (frame + 3).min(n);
        local[lo..hi].iter().copied().fold(0.0, f64::max)
    };
    let first = beats.iter().position(|frame| support(*frame) >= threshold);
    let last = beats.iter().rposition(|frame| support(*frame) >= threshold);
    match (first, last) {
        (Some(first), Some(last)) if first <= last => beats[first..=last].to_vec(),
        _ => beats,
    }
}

/// Constant-tempo grid: `(period, phase, root-mean-square residual)`. The phase is the time of the beat numbered 0.
fn fit_grid(beats: &[f64], period_guess: f64) -> (f64, f64, f64) {
    let origin = beats[0];
    let mut period = period_guess;
    let mut phase = origin;
    let mut kept: Vec<(f64, f64)> = beats
        .iter()
        .map(|beat| (((beat - origin) / period).round(), *beat))
        .collect();
    for _ in 0..3 {
        let count = kept.len() as f64;
        if count < 2.0 {
            break;
        }
        let mean_x = kept.iter().map(|(x, _)| x).sum::<f64>() / count;
        let mean_y = kept.iter().map(|(_, y)| y).sum::<f64>() / count;
        let covariance: f64 = kept.iter().map(|(x, y)| (x - mean_x) * (y - mean_y)).sum();
        let variance: f64 = kept.iter().map(|(x, _)| (x - mean_x).powi(2)).sum();
        if variance <= 1e-12 {
            break;
        }
        period = covariance / variance;
        phase = mean_y - period * mean_x;
        // Renumber, and drop points more than 1/8 beat off the grid (tracking sometimes lands on off-beats).
        kept = beats
            .iter()
            .map(|beat| (((beat - phase) / period).round(), *beat))
            .filter(|(x, y)| (y - (phase + period * x)).abs() <= period / 8.0)
            .collect();
    }
    let residual = if beats.is_empty() {
        0.0
    } else {
        (beats
            .iter()
            .map(|beat| {
                let x = ((beat - phase) / period).round();
                (beat - (phase + period * x)).powi(2)
            })
            .sum::<f64>()
            / beats.len() as f64)
            .sqrt()
    };
    (period, phase, residual)
}

/// Downbeat phase: `(phase 0..beats_per_bar, confidence)`.
fn downbeat_phase(
    frames: &Frames,
    beat_frames: &[usize],
    grid_index: &[i64],
    period: f64,
    beats_per_bar: usize,
) -> (usize, f64) {
    if beats_per_bar <= 1 {
        return (0, 1.0);
    }
    let n = frames.flux.len();
    let span = (period.round() as usize).max(1);
    let kick: Vec<f64> = beat_frames
        .iter()
        .map(|frame| {
            let lo = frame.saturating_sub(3);
            let hi = (frame + 4).min(n);
            frames.low_flux[lo..hi].iter().copied().fold(0.0, f64::max)
        })
        .collect();
    let change: Vec<f64> = beat_frames
        .iter()
        .map(|frame| {
            let before = mean_timbre(&frames.timbre, frame.saturating_sub(span), *frame);
            let after = mean_timbre(&frames.timbre, *frame, (frame + span).min(n));
            before
                .iter()
                .zip(&after)
                .map(|(a, b)| (a - b).powi(2))
                .sum::<f64>()
                .sqrt()
        })
        .collect();
    let z = |values: &[f64]| -> Vec<f64> {
        let (mean, std) = mean_std(values);
        values
            .iter()
            .map(|value| {
                if std > 1e-12 {
                    (value - mean) / std
                } else {
                    0.0
                }
            })
            .collect()
    };
    let (kick, change) = (z(&kick), z(&change));
    let mut scores = vec![(0.0_f64, 0usize); beats_per_bar];
    for ((index, k), c) in grid_index.iter().zip(&kick).zip(&change) {
        let phase = index.rem_euclid(beats_per_bar as i64) as usize;
        scores[phase].0 += k + c;
        scores[phase].1 += 1;
    }
    let means: Vec<f64> = scores
        .iter()
        .map(|(sum, count)| {
            if *count > 0 {
                sum / *count as f64
            } else {
                f64::NEG_INFINITY
            }
        })
        .collect();
    let best = (0..beats_per_bar)
        .max_by(|a, b| means[*a].total_cmp(&means[*b]).then(b.cmp(a)))
        .unwrap_or(0);
    let mut sorted: Vec<f64> = means.iter().copied().filter(|v| v.is_finite()).collect();
    sorted.sort_by(|a, b| b.total_cmp(a));
    let confidence = match sorted.as_slice() {
        [first, second, .., last] if first - last > 1e-12 => {
            ((first - second) / (first - last)).clamp(0.0, 1.0)
        }
        _ => 0.0,
    };
    (best, confidence)
}

fn mean_timbre(timbre: &[[f64; 12]], from: usize, to: usize) -> [f64; 12] {
    let mut out = [0.0; 12];
    if to <= from {
        return out;
    }
    for row in &timbre[from..to] {
        for (slot, value) in out.iter_mut().zip(row) {
            *slot += value;
        }
    }
    out.map(|value| value / (to - from) as f64)
}

/// Bar: from one downbeat to the next. The last bar is one bar long and ends at the end of the track. Energy is the RMS dB of the samples in the bar, normalized to 0..1 by the 5th and 95th percentiles across the whole track.
fn bars(
    pcm: &[f32],
    sample_rate: u32,
    starts: &[f64],
    bar_seconds: f64,
    duration: f64,
) -> Vec<Bar> {
    let rate = f64::from(sample_rate);
    let mut bars: Vec<Bar> = starts
        .iter()
        .enumerate()
        .map(|(index, start)| {
            let end = starts
                .get(index + 1)
                .copied()
                .unwrap_or((start + bar_seconds).min(duration))
                .max(*start);
            Bar {
                start: *start,
                end,
                energy: 0.0,
            }
        })
        .filter(|bar| bar.end > bar.start)
        .collect();
    let decibels: Vec<f64> = bars
        .iter()
        .map(|bar| {
            let lo = ((bar.start * rate) as usize).min(pcm.len());
            let hi = ((bar.end * rate) as usize).clamp(lo, pcm.len());
            let slice = &pcm[lo..hi];
            let power = slice
                .iter()
                .map(|sample| f64::from(*sample).powi(2))
                .sum::<f64>()
                / slice.len().max(1) as f64;
            10.0 * (power + 1e-12).log10()
        })
        .collect();
    let (low, high) = (percentile(&decibels, 0.05), percentile(&decibels, 0.95));
    for (bar, db) in bars.iter_mut().zip(&decibels) {
        bar.energy = if high - low > 1e-9 {
            ((db - low) / (high - low)).clamp(0.0, 1.0)
        } else {
            1.0
        };
    }
    bars
}

fn percentile(values: &[f64], q: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    sorted[((sorted.len() - 1) as f64 * q).round() as usize]
}

/// Section: one feature vector per bar (energy, three frequency bands, onset density, each as a z-score). The novelty is the difference between the means of the [`SECTION_HALF_WINDOW`] bars before and after, and cuts are placed at peaks. The first section starts at 0 and the last ends at the end of the track.
fn sections(frames: &Frames, onset: &[f64], bars: &[Bar], duration: f64) -> Vec<Section> {
    let whole = |energy: f64| Section {
        start: 0.0,
        end: duration,
        first_bar: 0,
        end_bar: bars.len(),
        energy,
    };
    if bars.len() < 2 * MIN_SECTION_BARS {
        let energy = bars.iter().map(|bar| bar.energy).sum::<f64>() / bars.len().max(1) as f64;
        return vec![whole(energy)];
    }
    let n = frames.flux.len();
    let frame_of = |seconds: f64| ((seconds * frames.fps) as usize).min(n);
    let mut columns: Vec<Vec<f64>> = vec![Vec::with_capacity(bars.len()); 5];
    for bar in bars {
        let (lo, hi) = (
            frame_of(bar.start),
            frame_of(bar.end).max(frame_of(bar.start) + 1).min(n),
        );
        let span = (hi - lo).max(1) as f64;
        columns[0].push(bar.energy);
        for band in 0..3 {
            columns[band + 1].push(
                frames.bands[lo..hi]
                    .iter()
                    .map(|row| row[band])
                    .sum::<f64>()
                    / span,
            );
        }
        columns[4].push(onset[lo..hi].iter().sum::<f64>() / span);
    }
    let features: Vec<Vec<f64>> = columns
        .iter()
        .map(|column| {
            let (mean, std) = mean_std(column);
            column
                .iter()
                .map(|value| {
                    if std > 1e-12 {
                        (value - mean) / std
                    } else {
                        0.0
                    }
                })
                .collect()
        })
        .collect();
    let count = bars.len();
    let novelty: Vec<f64> = (0..count)
        .map(|k| {
            if k < 2 || k + 2 > count {
                return 0.0;
            }
            let before = k.saturating_sub(SECTION_HALF_WINDOW)..k;
            let after = k..(k + SECTION_HALF_WINDOW).min(count);
            let distance = features
                .iter()
                .map(|column| {
                    let a = column[before.clone()].iter().sum::<f64>() / before.len() as f64;
                    let b = column[after.clone()].iter().sum::<f64>() / after.len() as f64;
                    (a - b).powi(2)
                })
                .sum::<f64>()
                .sqrt();
            // Slight weighting at integer multiples of the four-bar phrase.
            if k % 4 == 0 {
                distance * 1.15
            } else {
                distance
            }
        })
        .collect();
    let (mean, std) = mean_std(&novelty);
    let threshold = mean + 0.5 * std;
    let mut candidates: Vec<usize> = (MIN_SECTION_BARS..=count - MIN_SECTION_BARS)
        .filter(|k| {
            let value = novelty[*k];
            value >= threshold
                && (k.saturating_sub(2)..=(k + 2).min(count - 1)).all(|j| novelty[j] <= value)
        })
        .collect();
    candidates.sort_by(|a, b| novelty[*b].total_cmp(&novelty[*a]).then(a.cmp(b)));
    let mut cuts: Vec<usize> = Vec::new();
    for k in candidates {
        if cuts.iter().all(|cut| cut.abs_diff(k) >= MIN_SECTION_BARS) {
            cuts.push(k);
        }
    }
    cuts.sort_unstable();
    sections_from_cuts(bars, &cuts, duration)
}

/// Additionally cut existing sections using an external signal (such as a long pause in the lyrics). `cuts` are bar indices. Cuts within 1 bar of an existing boundary are ignored, and so are cuts less than 2 bars from either end.
/// The returned sections again start at 0 for the first and end at `duration` for the last, and their energies are recomputed.
pub fn split_sections(
    bars: &[Bar],
    sections: &[Section],
    cuts: &[usize],
    duration: f64,
) -> Vec<Section> {
    let count = bars.len();
    let mut edges: Vec<usize> = sections
        .iter()
        .map(|section| section.first_bar)
        .filter(|&bar| bar > 0 && bar < count)
        .collect();
    for &cut in cuts {
        if cut >= 2 && cut + 2 <= count && edges.iter().all(|edge| edge.abs_diff(cut) > 1) {
            edges.push(cut);
        }
    }
    edges.sort_unstable();
    edges.dedup();
    sections_from_cuts(bars, &edges, duration)
}

fn sections_from_cuts(bars: &[Bar], cuts: &[usize], duration: f64) -> Vec<Section> {
    let count = bars.len();
    let mut edges = vec![0usize];
    edges.extend_from_slice(cuts);
    edges.push(count);
    edges
        .windows(2)
        .enumerate()
        .map(|(index, pair)| {
            let (a, b) = (pair[0], pair[1]);
            let energy =
                bars[a..b].iter().map(|bar| bar.energy).sum::<f64>() / (b - a).max(1) as f64;
            Section {
                start: if index == 0 { 0.0 } else { bars[a].start },
                end: if b == count { duration } else { bars[b].start },
                first_bar: a,
                end_bar: b,
                energy,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 16_000;

    /// Synthetic beats: each beat is a decaying sine “click”, with the downbeat louder and lower. From `noise_from` on, a layer of deterministic noise is added as the “chorus”.
    fn click_track(bpm: f64, offset: f64, seconds: f64, loud_from: Option<f64>) -> Vec<f32> {
        let len = (seconds * f64::from(RATE)) as usize;
        let mut pcm = vec![0.0_f32; len];
        let period = 60.0 / bpm;
        let mut beat = 0usize;
        loop {
            let t0 = offset + beat as f64 * period;
            if t0 >= seconds {
                break;
            }
            let downbeat = beat % 4 == 0;
            let (freq, gain) = if downbeat {
                (80.0, 0.9)
            } else {
                (1200.0, 0.35)
            };
            let start = (t0 * f64::from(RATE)) as usize;
            for i in 0..(0.08 * f64::from(RATE)) as usize {
                if start + i >= len {
                    break;
                }
                let t = i as f64 / f64::from(RATE);
                pcm[start + i] +=
                    (gain * (-t * 40.0).exp() * (2.0 * std::f64::consts::PI * freq * t).sin())
                        as f32;
            }
            beat += 1;
        }
        if let Some(from) = loud_from {
            let mut state = 12345u32;
            for (index, sample) in pcm.iter_mut().enumerate() {
                state = state.wrapping_mul(1_103_515_245).wrapping_add(12345);
                if index as f64 / f64::from(RATE) >= from {
                    let noise = (state >> 16) as f32 / 65536.0 - 0.5;
                    *sample += 0.25 * noise;
                }
            }
        }
        pcm
    }

    #[test]
    fn click_track_tempo_offset_and_downbeat() {
        let pcm = click_track(128.0, 0.212, 60.0, None);
        let analysis = analyze(&pcm, RATE, &BeatOptions::default()).unwrap();
        assert!((analysis.tempo - 128.0).abs() < 0.5, "{}", analysis.tempo);
        assert!(
            (analysis.offset - 0.212).abs() < 0.02,
            "{}",
            analysis.offset
        );
        assert!(
            (analysis.downbeat - 0.212).abs() < 0.02,
            "{}",
            analysis.downbeat
        );
        assert!(analysis.residual < 0.01, "{}", analysis.residual);
        assert!(analysis.confidence > 0.3, "{}", analysis.confidence);
        // Four beats per bar: bar starts are four beats apart.
        let bar = 4.0 * 60.0 / 128.0;
        assert!(analysis.bars.len() >= 28, "{}", analysis.bars.len());
        assert!(
            analysis
                .bars
                .windows(2)
                .all(|pair| (pair[1].start - pair[0].start - bar).abs() < 0.03)
        );
        assert!((analysis.beats.len() as f64 - 60.0 / (60.0 / 128.0)).abs() <= 3.0);
    }

    #[test]
    fn slower_track_is_not_doubled() {
        let pcm = click_track(90.0, 0.5, 40.0, None);
        let analysis = analyze(&pcm, RATE, &BeatOptions::default()).unwrap();
        assert!((analysis.tempo - 90.0).abs() < 0.5, "{}", analysis.tempo);
        assert!(
            (analysis.downbeat - 0.5).abs() < 0.02,
            "{}",
            analysis.downbeat
        );
    }

    /// Gangnam Style type: at 132 BPM and 100 fps one beat is 45.45 frames. Each beat has an onset, and each bar adds a repeated 3-3-2 division figure. DAW-made songs have very precise onsets, so the autocorrelation peak is only one frame wide. If the support at twice the lag only took integer frames, `2 × 45 = 90` would miss the double-beat peak of the true tempo at 91, and the half tempo that happens to match on integer lags (88 BPM, which is 1.5 beats in the real song) would win.
    #[test]
    fn a_fractional_beat_period_keeps_its_two_beat_support() {
        const RIFF: f64 = 1.5;
        const SIGMA: f64 = 0.6;
        let fps = 100.0;
        let period = fps * 60.0 / 132.0;
        let mut onset = vec![0.0_f64; 6000];
        // Onsets are spread with a narrow Gaussian (σ 0.6 frames, comparable to the peak width of real songs).
        let mut spike = |at: f64, gain: f64| {
            for (frame, slot) in onset.iter_mut().enumerate() {
                *slot += gain * (-0.5 * ((frame as f64 - at) / SIGMA).powi(2)).exp();
            }
        };
        let mut beat = 0usize;
        while 30.0 + beat as f64 * period < 5990.0 {
            let t = 30.0 + beat as f64 * period;
            spike(t, 1.0);
            if beat % 4 == 0 {
                spike(t + 1.5 * period, RIFF);
                spike(t + 3.0 * period, RIFF);
            }
            beat += 1;
        }
        let (lag, _) = tempo_lag(&onset, fps, &BeatOptions::default());
        let bpm = fps * 60.0 / lag;
        assert!((bpm - 132.0).abs() < 1.5, "{bpm}");
    }

    #[test]
    fn external_cuts_split_sections_but_not_next_to_an_edge() {
        let bars: Vec<Bar> = (0..12)
            .map(|k| Bar {
                start: 0.5 + 2.0 * k as f64,
                end: 2.5 + 2.0 * k as f64,
                energy: if k < 6 { 0.2 } else { 0.8 },
            })
            .collect();
        let whole = vec![Section {
            start: 0.0,
            end: 25.0,
            first_bar: 0,
            end_bar: 12,
            energy: 0.5,
        }];
        let split = split_sections(&bars, &whole, &[6, 1, 11, 7], 25.0);
        let spans: Vec<(usize, usize)> = split.iter().map(|s| (s.first_bar, s.end_bar)).collect();
        assert_eq!(spans, vec![(0, 6), (6, 12)], "1、11 离两端太近，7 贴着 6");
        assert_eq!((split[0].start, split[0].end), (0.0, 12.5));
        assert_eq!((split[1].start, split[1].end), (12.5, 25.0));
        assert!((split[0].energy - 0.2).abs() < 1e-9 && (split[1].energy - 0.8).abs() < 1e-9);
    }

    #[test]
    fn a_louder_second_half_is_its_own_section() {
        let bpm = 120.0;
        let bar = 4.0 * 60.0 / bpm;
        // The first 16 bars have only clicks; the last 16 bars have noise layered on.
        let pcm = click_track(bpm, 0.0, 32.0 * bar, Some(16.0 * bar));
        let analysis = analyze(&pcm, RATE, &BeatOptions::default()).unwrap();
        assert!(analysis.sections.len() >= 2, "{:?}", analysis.sections);
        let cut = analysis.sections[1].start;
        assert!(
            (cut - 16.0 * bar).abs() <= bar + 0.05,
            "{cut} {:?}",
            analysis.sections
        );
        assert!(analysis.sections[1].energy > analysis.sections[0].energy);
        assert_eq!(analysis.sections[0].start, 0.0);
        assert_eq!(analysis.sections.last().unwrap().end, analysis.duration);
    }

    #[test]
    fn silence_and_bad_options_are_errors() {
        assert!(analyze(&vec![0.0; 16_000 * 5], RATE, &BeatOptions::default()).is_err());
        let pcm = click_track(120.0, 0.0, 10.0, None);
        let bad = BeatOptions {
            beats_per_bar: 0,
            ..BeatOptions::default()
        };
        assert!(analyze(&pcm, RATE, &bad).is_err());
    }

    #[test]
    fn analysis_is_deterministic() {
        let pcm = click_track(128.0, 0.1, 20.0, Some(10.0));
        let a = analyze(&pcm, RATE, &BeatOptions::default()).unwrap();
        let b = analyze(&pcm, RATE, &BeatOptions::default()).unwrap();
        assert_eq!(a, b);
    }
}
