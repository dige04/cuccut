//! Stitching of long text after per-chunk synthesis: the pauses and loudness between chunks are set here in a unified way, not left to the model.
//!
//! Each chunk is an independent generation: the model leaves silences of varying length at the start and end of each chunk, and the loudness also varies. When chunks are simply joined end to end, the pause at a chunk boundary (measured 0.7–1.1 s) is much longer than the pause between sentences within a chunk (0.2–0.5 s), and the loudness difference between adjacent chunks is 3–5 dB. It sounds like “speak a passage, pause for a long time, then another person speaks a passage”. [`Stitcher`] stitches in the order the chunks arrive:
//!
//! 1. Remove the leading and trailing silence on both sides of each chunk boundary (10 ms windows with RMS below −45 dBFS), keeping at most 50 ms per side; the cut gets a 5 ms fade-in and fade-out;
//!    the start and end of the whole output are left untouched;
//! 2. Insert a fixed pause between chunks, according to the boundary level after the previous chunk ([`ChunkBreak`]): sentence end 0.35 s, paragraph 0.6 s, mid-sentence break 0.2 s.
//!    The pause is measured from the last voiced window of the previous chunk to the first voiced window of the next chunk, and the residual edge silence is counted within it;
//! 3. Align each chunk's loudness (RMS of its voiced windows) to the first chunk, with gain limited to ±6 dB, and the peak after amplification not exceeding −1 dBFS;
//! 4. With only one chunk, output it as-is and do nothing.
//!
//! The text's content and order are unchanged; the peak limit for the whole output is handled separately by [`super::loudness::PeakLimited`].

use super::loudness::PEAK_CEILING;
use super::text::ChunkBreak;

/// Silence threshold: −45 dBFS (`10^(−45/20)`).
pub const SILENCE_THRESHOLD: f32 = 0.005_623_413;
/// Window length (seconds) used to detect silence.
pub const WINDOW_SECONDS: f64 = 0.01;
/// Maximum silence (seconds) kept on each side after trimming leading and trailing silence.
pub const KEEP_EDGE_SECONDS: f64 = 0.05;
/// Fade-in and fade-out at the cut point (seconds).
pub const FADE_SECONDS: f64 = 0.005;
/// Pause (seconds) when a chunk ends with sentence-final punctuation: taken from the measured distribution of pauses between sentences within the same model chunk.
pub const SENTENCE_PAUSE_SECONDS: f64 = 0.35;
/// Pause (seconds) at a paragraph (line break) boundary.
pub const PARAGRAPH_PAUSE_SECONDS: f64 = 0.6;
/// Pause (seconds) when a chunk breaks mid-sentence (at clause punctuation or a hard cut).
pub const CLAUSE_PAUSE_SECONDS: f64 = 0.2;
/// Gain limit for loudness alignment (dB, symmetric in both directions).
pub const MAX_GAIN_DB: f32 = 6.0;

/// Pause (seconds) after a first-level boundary.
pub const fn pause_seconds(after: ChunkBreak) -> f64 {
    match after {
        ChunkBreak::Clause => CLAUSE_PAUSE_SECONDS,
        ChunkBreak::Sentence => SENTENCE_PAUSE_SECONDS,
        ChunkBreak::Paragraph => PARAGRAPH_PAUSE_SECONDS,
    }
}

/// Joins the per-chunk synthesized audio in order. The number of chunks is known at the start (chunking happens before synthesis), so each chunk can be processed as soon as it arrives, and
/// [`Self::seconds`] is the cumulative stitched duration after each chunk (`TtsProgress::ChunkFinished.seconds`).
#[derive(Debug)]
pub struct Stitcher {
    sample_rate: u32,
    count: usize,
    pushed: usize,
    samples: Vec<f32>,
    /// Voiced RMS of the first chunk (the first chunk that has voiced content); later chunks are aligned to it.
    reference_rms: Option<f32>,
    /// Pause (seconds) to insert after the previous chunk, and the number of silent samples left at the end of the previous chunk.
    pending: Option<(f64, usize)>,
}

impl Stitcher {
    pub fn new(sample_rate: u32, count: usize) -> Self {
        Self {
            sample_rate,
            count,
            pushed: 0,
            samples: Vec::new(),
            reference_rms: None,
            pending: None,
        }
    }

    /// Appends the next chunk. `after` is the boundary level after this chunk (not used for the last chunk).
    pub fn push(&mut self, chunk: &[f32], after: ChunkBreak) {
        self.pushed += 1;
        if self.count <= 1 {
            self.samples.extend_from_slice(chunk);
            return;
        }
        let first = self.samples.is_empty() && self.pending.is_none();
        let last = self.pushed >= self.count;
        let pause = pause_seconds(after);
        let Some((voiced_start, voiced_end)) = voiced_span(chunk, self.sample_rate) else {
            // The whole chunk is silent (the model ends right at the start): do not append it, and do not insert an extra pause; use the longer of the two boundary levels.
            if let Some((pending, _)) = &mut self.pending {
                *pending = pending.max(pause);
            }
            return;
        };

        let keep = seconds_to_samples(KEEP_EDGE_SECONDS, self.sample_rate);
        let start = if first { 0 } else { voiced_start.saturating_sub(keep) };
        let end = if last { chunk.len() } else { (voiced_end + keep).min(chunk.len()) };
        let mut body = chunk[start..end].to_vec();
        let fade = seconds_to_samples(FADE_SECONDS, self.sample_rate).min(body.len() / 2);
        if start > 0 {
            for (i, sample) in body.iter_mut().take(fade).enumerate() {
                *sample *= i as f32 / fade as f32;
            }
        }
        if end < chunk.len() {
            let len = body.len();
            for (i, sample) in body[len - fade..].iter_mut().enumerate() {
                *sample *= (fade - 1 - i) as f32 / fade as f32;
            }
        }

        let rms = voiced_rms(&body, self.sample_rate);
        match self.reference_rms {
            None => self.reference_rms = Some(rms),
            Some(reference) => {
                let gain = alignment_gain(reference, rms, peak(&body));
                if gain != 1.0 {
                    body.iter_mut().for_each(|sample| *sample *= gain);
                }
            }
        }

        if let Some((pause, kept_tail)) = self.pending.take() {
            let kept_head = voiced_start - start;
            let silence = seconds_to_samples(pause, self.sample_rate).saturating_sub(kept_tail + kept_head);
            self.samples.resize(self.samples.len() + silence, 0.0);
        }
        self.samples.extend_from_slice(&body);
        self.pending = Some((pause, end.saturating_sub(voiced_end)));
    }

    /// Stitched duration so far (seconds).
    pub fn seconds(&self) -> f64 {
        self.samples.len() as f64 / f64::from(self.sample_rate)
    }

    pub fn finish(self) -> Vec<f32> {
        self.samples
    }
}

fn seconds_to_samples(seconds: f64, sample_rate: u32) -> usize {
    (seconds * f64::from(sample_rate)).round() as usize
}

fn window(sample_rate: u32) -> usize {
    seconds_to_samples(WINDOW_SECONDS, sample_rate).max(1)
}

fn mean_square(samples: &[f32]) -> f64 {
    samples.iter().map(|s| f64::from(*s) * f64::from(*s)).sum::<f64>() / samples.len().max(1) as f64
}

/// Start of the first voiced window and end of the last voiced window (sample indices, half-open interval [start, end)); `None` when the whole chunk is silent.
pub fn voiced_span(samples: &[f32], sample_rate: u32) -> Option<(usize, usize)> {
    let window = window(sample_rate);
    let threshold = f64::from(SILENCE_THRESHOLD) * f64::from(SILENCE_THRESHOLD);
    let mut span: Option<(usize, usize)> = None;
    for (index, frame) in samples.chunks(window).enumerate() {
        if mean_square(frame) > threshold {
            let start = index * window;
            let end = start + frame.len();
            span = Some(span.map_or((start, end), |(first, _)| (first, end)));
        }
    }
    span
}

/// RMS of the voiced windows (RMS above the silence threshold); when there are no voiced windows, the RMS of the whole segment.
pub fn voiced_rms(samples: &[f32], sample_rate: u32) -> f32 {
    let threshold = f64::from(SILENCE_THRESHOLD) * f64::from(SILENCE_THRESHOLD);
    let (mut sum, mut count) = (0.0f64, 0usize);
    for frame in samples.chunks(window(sample_rate)) {
        if mean_square(frame) > threshold {
            sum += frame.iter().map(|s| f64::from(*s) * f64::from(*s)).sum::<f64>();
            count += frame.len();
        }
    }
    if count == 0 {
        return mean_square(samples).sqrt() as f32;
    }
    (sum / count as f64).sqrt() as f32
}

fn peak(samples: &[f32]) -> f32 {
    samples.iter().fold(0.0_f32, |max, s| max.max(s.abs()))
}

/// Gain that aligns `rms` to `reference`: clamped to ±[`MAX_GAIN_DB`]; when amplifying, the peak must not exceed [`PEAK_CEILING`]
/// (anything already above it is not amplified further).
fn alignment_gain(reference: f32, rms: f32, peak: f32) -> f32 {
    // Neither NaN nor 0 is aligned.
    if !(rms.is_finite() && reference.is_finite() && rms > 0.0 && reference > 0.0) {
        return 1.0;
    }
    let limit = 10f32.powf(MAX_GAIN_DB / 20.0);
    let mut gain = (reference / rms).clamp(1.0 / limit, limit);
    if gain > 1.0 && peak * gain > PEAK_CEILING {
        gain = (PEAK_CEILING / peak).max(1.0);
    }
    gain
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 24_000;

    fn samples(seconds: f64) -> usize {
        seconds_to_samples(seconds, RATE)
    }

    /// A fake chunk: `lead` seconds of silence (with a little noise floor below the threshold), `voiced` seconds of a 220 Hz sine at amplitude `amplitude`, and `trail` seconds of silence.
    fn fake_chunk(lead: f64, voiced: f64, trail: f64, amplitude: f32) -> Vec<f32> {
        let noise = |i: usize| if i.is_multiple_of(2) { 0.001 } else { -0.001 };
        let mut out: Vec<f32> = (0..samples(lead)).map(noise).collect();
        out.extend((0..samples(voiced)).map(|i| amplitude * (i as f32 * 220.0 * std::f32::consts::TAU / RATE as f32).sin()));
        out.extend((0..samples(trail)).map(noise));
        out
    }

    /// Voiced segment `[start, end)` (samples) found in the output using 10 ms windows.
    fn voiced_runs(samples: &[f32]) -> Vec<(usize, usize)> {
        let window = window(RATE);
        let threshold = f64::from(SILENCE_THRESHOLD).powi(2);
        let mut runs: Vec<(usize, usize)> = Vec::new();
        for (index, frame) in samples.chunks(window).enumerate() {
            if mean_square(frame) > threshold {
                let start = index * window;
                match runs.last_mut() {
                    Some(run) if run.1 == start => run.1 = start + frame.len(),
                    _ => runs.push((start, start + frame.len())),
                }
            }
        }
        runs
    }

    fn stitch(chunks: &[(Vec<f32>, ChunkBreak)]) -> (Vec<f32>, Vec<f64>) {
        let mut stitcher = Stitcher::new(RATE, chunks.len());
        let mut progress = Vec::new();
        for (chunk, after) in chunks {
            stitcher.push(chunk, *after);
            progress.push(stitcher.seconds());
        }
        (stitcher.finish(), progress)
    }

    fn db(ratio: f32) -> f32 {
        20.0 * ratio.log10()
    }

    #[test]
    fn boundaries_get_the_fixed_pause_and_chunks_match_the_first_chunks_level() {
        // Three chunks with different leading and trailing silences and different loudness (−3 dB, +4 dB).
        let chunks = vec![
            (fake_chunk(0.12, 1.0, 0.9, 0.3), ChunkBreak::Sentence),
            (fake_chunk(0.7, 1.5, 0.4, 0.3 * 10f32.powf(-3.0 / 20.0)), ChunkBreak::Paragraph),
            (fake_chunk(0.3, 0.8, 0.25, 0.3 * 10f32.powf(4.0 / 20.0)), ChunkBreak::Paragraph),
        ];
        let (out, progress) = stitch(&chunks);
        let runs = voiced_runs(&out);
        assert_eq!(runs.len(), 3, "{runs:?}");
        let gap = |i: usize| (runs[i + 1].0 - runs[i].1) as f64 / f64::from(RATE);
        // The pause is measured in 10 ms windows, so it cannot differ by a whole window.
        assert!(
            (gap(0) - SENTENCE_PAUSE_SECONDS).abs() <= WINDOW_SECONDS + 1e-9,
            "sentence-end pause {}",
            gap(0)
        );
        assert!(
            (gap(1) - PARAGRAPH_PAUSE_SECONDS).abs() <= WINDOW_SECONDS + 1e-9,
            "paragraph pause {}",
            gap(1)
        );

        // The RMS of each chunk's voiced part equals that of the first chunk.
        let levels: Vec<f32> = runs.iter().map(|(s, e)| voiced_rms(&out[*s..*e], RATE)).collect();
        for level in &levels[1..] {
            assert!(db(level / levels[0]).abs() < 0.1, "{levels:?}");
        }

        // The total length is predictable: the start of the first chunk and the end of the last chunk are kept as-is; in between are three voiced sections plus two pauses.
        let expected = samples(0.12)
            + samples(1.0)
            + samples(SENTENCE_PAUSE_SECONDS)
            + samples(1.5)
            + samples(PARAGRAPH_PAUSE_SECONDS)
            + samples(0.8)
            + samples(0.25);
        assert!(
            out.len().abs_diff(expected) <= 2 * window(RATE),
            "total length {} expected {expected}",
            out.len()
        );
        // Progress is the cumulative stitched duration: monotonically increasing, and the last value equals the total length.
        assert!(progress.windows(2).all(|w| w[0] < w[1]), "{progress:?}");
        assert_eq!(*progress.last().unwrap(), out.len() as f64 / f64::from(RATE));
        // The start of the first chunk is left untouched (it is the loudness reference, and is not scaled).
        assert_eq!(&out[..samples(0.12)], &chunks[0].0[..samples(0.12)]);
    }

    #[test]
    fn a_single_chunk_is_returned_untouched() {
        let chunk = fake_chunk(0.5, 1.0, 0.8, 0.95);
        let (out, progress) = stitch(&[(chunk.clone(), ChunkBreak::Paragraph)]);
        assert_eq!(out, chunk);
        assert_eq!(progress, vec![chunk.len() as f64 / f64::from(RATE)]);
    }

    #[test]
    fn clause_breaks_get_the_short_pause() {
        let (out, _) = stitch(&[
            (fake_chunk(0.1, 0.5, 0.6, 0.3), ChunkBreak::Clause),
            (fake_chunk(0.6, 0.5, 0.1, 0.3), ChunkBreak::Paragraph),
        ]);
        let runs = voiced_runs(&out);
        let gap = (runs[1].0 - runs[0].1) as f64 / f64::from(RATE);
        assert!((gap - CLAUSE_PAUSE_SECONDS).abs() <= WINDOW_SECONDS + 1e-9, "{gap}");
    }

    #[test]
    fn gain_is_limited_to_six_db_and_never_pushes_the_peak_over_the_ceiling() {
        // A chunk 12 dB too quiet is raised by only 6 dB, so it is still 6 dB too quiet.
        let (out, _) = stitch(&[
            (fake_chunk(0.1, 0.5, 0.3, 0.4), ChunkBreak::Sentence),
            (fake_chunk(0.3, 0.5, 0.1, 0.1), ChunkBreak::Paragraph),
        ]);
        let runs = voiced_runs(&out);
        let levels: Vec<f32> = runs.iter().map(|(s, e)| voiced_rms(&out[*s..*e], RATE)).collect();
        assert!((db(levels[1] / levels[0]) + 6.0).abs() < 0.1, "{levels:?}");

        // A chunk 10 dB too loud is lowered by only 6 dB, so it is still 4 dB too loud.
        let (out, _) = stitch(&[
            (fake_chunk(0.1, 0.5, 0.3, 0.1), ChunkBreak::Sentence),
            (fake_chunk(0.3, 0.5, 0.1, 0.1 * 10f32.powf(10.0 / 20.0)), ChunkBreak::Paragraph),
        ]);
        let runs = voiced_runs(&out);
        let levels: Vec<f32> = runs.iter().map(|(s, e)| voiced_rms(&out[*s..*e], RATE)).collect();
        assert!((db(levels[1] / levels[0]) - 4.0).abs() < 0.1, "{levels:?}");

        // A quiet chunk with a single spike: it should be raised by about 9 dB, but raising stops when the peak reaches −1 dBFS.
        let mut spiky = fake_chunk(0.3, 0.5, 0.1, 0.15);
        let spike = samples(0.5);
        spiky[spike] = 0.8;
        let (out, _) = stitch(&[
            (fake_chunk(0.1, 0.5, 0.3, 0.4), ChunkBreak::Sentence),
            (spiky, ChunkBreak::Paragraph),
        ]);
        assert!((peak(&out) - PEAK_CEILING).abs() < 1e-5, "peak {}", peak(&out));
        // A chunk already above −1 dBFS is not amplified further (Base's codec output often goes above full scale; the whole output is reduced by PeakLimited).
        assert_eq!(alignment_gain(0.5, 0.2, 1.2), 1.0);
        assert!((alignment_gain(0.1, 0.4, 1.2) - 0.25f32.max(10f32.powf(-0.3))).abs() < 1e-6);
    }

    #[test]
    fn a_silent_chunk_adds_no_second_pause() {
        let (out, progress) = stitch(&[
            (fake_chunk(0.1, 0.5, 0.5, 0.3), ChunkBreak::Sentence),
            (Vec::new(), ChunkBreak::Paragraph),
            (fake_chunk(0.0, 0.0, 0.4, 0.0), ChunkBreak::Sentence),
            (fake_chunk(0.5, 0.5, 0.1, 0.3), ChunkBreak::Paragraph),
        ]);
        let runs = voiced_runs(&out);
        assert_eq!(runs.len(), 2, "{runs:?}");
        // The longest boundary level among the skipped chunks (paragraph).
        let gap = (runs[1].0 - runs[0].1) as f64 / f64::from(RATE);
        assert!((gap - PARAGRAPH_PAUSE_SECONDS).abs() <= WINDOW_SECONDS + 1e-9, "{gap}");
        assert_eq!(progress.len(), 4);
        assert_eq!(progress[0], progress[1]);
        assert_eq!(progress[1], progress[2]);
    }

    #[test]
    fn cut_edges_fade_instead_of_clicking() {
        // When the voiced part sits right against the chunk edge (no leading or trailing silence to remove), the cut falls on voiced samples and needs a fade-in and fade-out.
        let mut first = fake_chunk(0.0, 0.5, 0.0, 0.3);
        first.extend(vec![0.3; samples(0.2)]);
        let mut second = vec![0.3; samples(0.2)];
        second.extend(fake_chunk(0.0, 0.5, 0.0, 0.3));
        let (out, _) = stitch(&[(first, ChunkBreak::Sentence), (second, ChunkBreak::Paragraph)]);
        // Both chunks' voiced parts sit against their chunk edges with no silence to remove: only a pause is inserted between them, and the samples at the chunk tail and head are kept as-is (no cut, so no fade).
        let runs = voiced_runs(&out);
        assert_eq!(runs.len(), 2);
        assert!((out[runs[0].1 - 1] - 0.3).abs() < 1e-3);
        assert!((out[runs[1].0] - 0.3).abs() < 1e-3);

        // After keeping 50 ms, the cut falls on silence: both sides of the cut fade to 0.
        let (out, _) = stitch(&[
            (fake_chunk(0.0, 0.5, 0.5, 0.3), ChunkBreak::Sentence),
            (fake_chunk(0.5, 0.5, 0.0, 0.3), ChunkBreak::Paragraph),
        ]);
        let runs = voiced_runs(&out);
        let tail_cut = runs[0].1 + samples(KEEP_EDGE_SECONDS);
        assert_eq!(out[tail_cut - 1].abs(), 0.0);
    }
}
