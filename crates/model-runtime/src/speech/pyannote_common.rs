//! Post-processing of Pyannote speaker segmentation, shared by MLX and candle. Ported from v2 `ccut-speech`'s `pyannote_common.rs`.
//!
//! The compact PyanNet model emits seven powerset logits per frame (silence,
//! three single-speaker classes and three two-speaker overlaps). Both backends
//! hand those **raw logits** to this module, which owns the whole decode:
//! per-frame softmax → per-speaker probability sum → onset/offset hysteresis →
//! minimum speech/silence smoothing. Keeping the decode here (instead of an
//! `argmax` inside each backend) is what makes MLX and candle frame-identical,
//! and it is the only way overlapped speech survives at all — `argmax` collapses
//! every frame to a single powerset class.
//!
//! Local speaker indices are arbitrary in every ten-second window, so global
//! identity is decided by WeSpeaker voiceprint embeddings plus constrained
//! agglomerative clustering (segmentation first, then embedding clustering).
//! IoU chaining across the window overlap is only the degraded path used when
//! no embedding backend is available.

use crate::speech::speaker_cluster::{DEFAULT_MIN_CLUSTER_SECONDS, SpeakerUnit, merge_speaker_units_with_durations};
use anyhow::{Result, bail};
use std::collections::{BTreeMap, BTreeSet, HashSet};

pub use crate::speech::speaker_cluster::DEFAULT_MERGE_THRESHOLD;

pub const SAMPLE_RATE: usize = 16_000;
pub const WINDOW_SECONDS: f64 = 10.0;
pub const WINDOW_SAMPLES: usize = SAMPLE_RATE * 10;
/// Sliding-window step = half a window (5 seconds, `step = windowSamples / 2`).
///
/// It used to be 1 second. With a 1-second step, each sentence spans a dozen-odd windows, and the local speaker numbers between windows are unrelated, so the same continuous speech gets split into a dozen-odd separate attribution zones; any single window misjudging leaves a fragment on the timeline. Measured: 102 turns were internally self-contradictory. A 5-second step also makes the attribution zone 5 seconds wide (see `render_segments`), so a whole sentence usually falls inside one window's attribution zone. That removes the fragmentation, and it also cuts segmentation inference to 1/5 of the original.
pub const STEP_SAMPLES: usize = WINDOW_SAMPLES / 2;
/// Number of step-lengths a window spans; also the number of history windows looked back at for IoU (see [`STEP_SAMPLES`]).
pub const WINDOW_STEPS: usize = WINDOW_SAMPLES / STEP_SAMPLES;
pub const FRAMES_PER_WINDOW: usize = 589;
pub const LOCAL_SPEAKERS: usize = 3;
/// Number of powerset classes: 0 silence, 1..=3 single speaker, 4..=6 two-speaker overlap.
pub const CLASS_COUNT: usize = 7;
pub const INFERENCE_BATCH: usize = 8;

/// Onset threshold for hysteresis binarization.
pub const ONSET: f32 = 0.5;
/// Offset threshold for hysteresis binarization.
pub const OFFSET: f32 = 0.3;

/// Minimum speech segment (`minSpeechDuration`).
const MIN_SPEECH_SECONDS: f64 = 0.30;
/// Minimum silence gap. Gaps shorter than this are first filled within the window, and the same value is used to merge across windows.
const MIN_SILENCE_SECONDS: f64 = 0.15;
const MERGE_GAP_SECONDS: f64 = MIN_SILENCE_SECONDS;
/// Minimum IoU for judging that two local speakers in adjacent windows are the same person.
///
/// Applies only on the degraded path with **no voiceprint backend** (see [`diarize_with`]). After changing the step to 5 seconds, the overlap is 5 seconds rather than 9, but IoU is computed only within the overlap, so its scale does not drift with the overlap length, and the threshold stays unchanged.
const MATCH_THRESHOLD: f64 = 0.08;
/// Minimum exclusive speech needed to extract a voiceprint (0.5 seconds, `sampleRate/2`), consistent with `wespeaker::MINIMUM_SAMPLES`.
const MIN_EMBEDDING_SAMPLES: usize = SAMPLE_RATE / 2;

/// Margin for the 'dominant' criterion when strict exclusivity cannot accumulate enough voiceprint audio.
///
/// Strict exclusivity requires the raw probabilities of all other locals to be below [`OFFSET`]. In continuous conversation the main speaker's probability hardly ever drops below 0.3, so the secondary speaker gets **0 ms** of exclusive speech across the whole window. Measured: 81 of 121 windows lost at least one speaker this way; that person could never enter clustering and so never became an independent identity. The fallback criterion instead asks whether this person's probability clearly outranks the other locals. 0.20 is the operating point from the ablation scan (0.00/0.05/0.10/0.15/0.20/0.30) where purity and fragmentation both meet target: 0 pulls in all overlapping segments (fragmentation 76 turns), while too large a value degrades back to strict exclusivity.
const DOMINANCE_MARGIN: f32 = 0.20;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DiarizedSegment {
    pub start: f64,
    pub end: f64,
    pub speaker: usize,
}

#[derive(Debug)]
pub struct PyannoteCancelled;

impl std::fmt::Display for PyannoteCancelled {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Pyannote speaker diarization cancelled")
    }
}

impl std::error::Error for PyannoteCancelled {}

pub struct PyannoteCallbacks<'a> {
    pub on_progress: Option<&'a mut dyn FnMut(f64, f64)>,
    pub should_cancel: Option<&'a mut dyn FnMut() -> bool>,
}

impl Default for PyannoteCallbacks<'_> {
    fn default() -> Self {
        Self {
            on_progress: None,
            should_cancel: None,
        }
    }
}

/// Speaker diarization parameters.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PyannoteOptions {
    /// Global speaker-count cap; `None` means unlimited.
    pub max_speakers: Option<usize>,
    /// Voiceprint clustering threshold (cosine distance; merge only when strictly less). Smaller is more conservative (more people).
    pub clustering_threshold: f32,
}

impl Default for PyannoteOptions {
    fn default() -> Self {
        Self {
            max_speakers: None,
            clustering_threshold: DEFAULT_MERGE_THRESHOLD,
        }
    }
}

/// Voiceprint extraction callback: input is 16 kHz mono exclusive speech, returns an embedding vector. `None` means this segment yields no usable vector (audio too short or backend unavailable), and that local speaker does not take part in global identity.
pub type SpeakerEmbedder<'a> = &'a mut dyn FnMut(&[f32]) -> Option<Vec<f32>>;

#[derive(Debug, Clone)]
struct WindowActivity {
    start_sample: usize,
    end_sample: usize,
    /// Per-frame speaking probability for each local speaker (sum of powerset class probabilities, see [`speaker_probabilities`]). Exclusivity judgments must use this rather than the binarized [`Self::tracks`]: the hysteresis offset threshold is 0.3, so a speaker with probability 0.4 who is in the hysteresis-off state appears silent in tracks, and treating such a frame as exclusive would contaminate the voiceprint.
    probabilities: [Vec<f32>; LOCAL_SPEAKERS],
    /// Per-frame active flags after hysteresis and minimum speech/silence smoothing; multiple speakers may be true at once.
    tracks: [Vec<bool>; LOCAL_SPEAKERS],
}

/// Sums powerset class probabilities per speaker after per-frame softmax.
///
/// The mapping follows pyannote's powerset definition and is bit-identical to the tracks mapping in the old `decode_powerset`: spk1 = {1,4,5}, spk2 = {2,4,6}, spk3 = {3,5,6}. The softmax uses the numerically stable form that subtracts the per-frame maximum; if a whole frame contains NaN, that frame's probabilities degrade to 0.
pub fn speaker_probabilities(logits: &[f32]) -> [Vec<f32>; LOCAL_SPEAKERS] {
    let frames = logits.len() / CLASS_COUNT;
    let mut probabilities: [Vec<f32>; LOCAL_SPEAKERS] = std::array::from_fn(|_| Vec::with_capacity(frames));
    for frame in 0..frames {
        let row = &logits[frame * CLASS_COUNT..(frame + 1) * CLASS_COUNT];
        let maximum = row.iter().copied().fold(f32::NEG_INFINITY, f32::max);
        let mut exponentials = [0.0_f32; CLASS_COUNT];
        let mut total = 0.0_f32;
        for (index, value) in row.iter().enumerate() {
            let exponential = (value - maximum).exp();
            exponentials[index] = exponential;
            total += exponential;
        }
        // When total is not finite (logits contain NaN), scale is zeroed, so this frame activates no speaker.
        let scale = if total > 0.0 && total.is_finite() { 1.0 / total } else { 0.0 };
        probabilities[0].push((exponentials[1] + exponentials[4] + exponentials[5]) * scale);
        probabilities[1].push((exponentials[2] + exponentials[4] + exponentials[6]) * scale);
        probabilities[2].push((exponentials[3] + exponentials[5] + exponentials[6]) * scale);
    }
    probabilities
}

/// Hysteresis binarization plus minimum speech/silence smoothing for a single speaker.
///
/// Hysteresis: from the silent state, it turns on only when `prob >= ONSET`; from the active state, it turns off only when `prob < OFFSET`. Then it fills **internal** gaps shorter than [`MIN_SILENCE_SECONDS`], and discards speech segments shorter than [`MIN_SPEECH_SECONDS`].
pub fn binarize_speaker_track(probabilities: &[f32]) -> Vec<bool> {
    let mut active = vec![false; probabilities.len()];
    let mut open = false;
    for (index, probability) in probabilities.iter().enumerate() {
        open = if open { *probability >= OFFSET } else { *probability >= ONSET };
        active[index] = open;
    }

    let frame_seconds = WINDOW_SECONDS / FRAMES_PER_WINDOW as f64;
    let min_silence_frames = (MIN_SILENCE_SECONDS / frame_seconds).round() as usize;
    let min_speech_frames = (MIN_SPEECH_SECONDS / frame_seconds).round() as usize;

    // Only internal gaps are filled: leading and trailing silence may just be cut off by the window, and filling it would invent speech.
    let mut index = 0;
    while index < active.len() {
        if active[index] {
            index += 1;
            continue;
        }
        let gap_start = index;
        while index < active.len() && !active[index] {
            index += 1;
        }
        let bounded = gap_start > 0 && index < active.len();
        if bounded && index - gap_start < min_silence_frames {
            active[gap_start..index].fill(true);
        }
    }

    let mut index = 0;
    while index < active.len() {
        if !active[index] {
            index += 1;
            continue;
        }
        let run_start = index;
        while index < active.len() && active[index] {
            index += 1;
        }
        if index - run_start < min_speech_frames {
            active[run_start..index].fill(false);
        }
    }
    active
}

/// For cross-backend comparison: the per-frame powerset winning class. **Not used in actual decoding**; it is kept only to pinpoint differences between the two backends at the network layer. What actually determines the output is [`speaker_probabilities`] + [`binarize_speaker_track`].
pub fn argmax_classes(logits: &[f32]) -> Vec<u8> {
    (0..logits.len() / CLASS_COUNT)
        .map(|frame| {
            let row = &logits[frame * CLASS_COUNT..(frame + 1) * CLASS_COUNT];
            let mut best = 0_usize;
            for index in 1..CLASS_COUNT {
                if row[index] > row[best] {
                    best = index;
                }
            }
            best as u8
        })
        .collect()
}

/// Runs batched segmentation and turns local powerset logits into stable global speaker ranges. `infer` receives tightly packed, zero-padded 10-second windows and returns `FRAMES_PER_WINDOW * CLASS_COUNT` **raw logits** per batch item (row-major, frame outer / class inner).
///
/// `embed` is an optional voiceprint extractor: when provided, global identity is decided by constrained hierarchical clustering; when absent, it degrades to pure IoU chaining, and the same speaker across a long silence is judged a new identity. This is an explicit degradation when the backend capability is missing, not the default path.
pub fn diarize_with<F>(
    samples: &[f32],
    options: &PyannoteOptions,
    callbacks: &mut PyannoteCallbacks<'_>,
    mut infer: F,
    embed: Option<SpeakerEmbedder<'_>>,
) -> Result<Vec<DiarizedSegment>>
where
    F: FnMut(&[f32], usize) -> Result<Vec<Vec<f32>>>,
{
    if options.max_speakers == Some(0) {
        bail!("the speaker count limit must be at least 1");
    }
    if samples.is_empty() {
        return Ok(Vec::new());
    }

    let positions = window_positions(samples.len());
    // With the voiceprint stage, the progress denominator doubles: one pass for segmentation, one for embedding.
    let progress_total = (positions.len() * if embed.is_some() { 2 } else { 1 }) as f64;
    let mut windows = Vec::with_capacity(positions.len());
    for batch_start in (0..positions.len()).step_by(INFERENCE_BATCH) {
        check_cancelled(callbacks)?;
        let batch_end = (batch_start + INFERENCE_BATCH).min(positions.len());
        let batch_size = batch_end - batch_start;
        let mut packed = vec![0.0_f32; batch_size * WINDOW_SAMPLES];
        for (batch_index, (start, end)) in positions[batch_start..batch_end].iter().enumerate() {
            let target = &mut packed[batch_index * WINDOW_SAMPLES..(batch_index + 1) * WINDOW_SAMPLES];
            target[..end - start].copy_from_slice(&samples[*start..*end]);
        }
        let batch_logits = infer(&packed, batch_size)?;
        if batch_logits.len() != batch_size {
            bail!("Pyannote returned an abnormal window count: found {}, expected {batch_size}", batch_logits.len());
        }
        for (offset, logits) in batch_logits.into_iter().enumerate() {
            if logits.len() != FRAMES_PER_WINDOW * CLASS_COUNT {
                bail!(
                    "Pyannote returned an abnormal logits count: found {}, expected {}",
                    logits.len(),
                    FRAMES_PER_WINDOW * CLASS_COUNT
                );
            }
            let (start_sample, end_sample) = positions[batch_start + offset];
            let probabilities = speaker_probabilities(&logits);
            let tracks = std::array::from_fn(|local| binarize_speaker_track(&probabilities[local]));
            windows.push(WindowActivity {
                start_sample,
                end_sample,
                probabilities,
                tracks,
            });
        }
        if let Some(on_progress) = callbacks.on_progress.as_deref_mut() {
            on_progress(batch_end as f64, progress_total);
        }
    }

    check_cancelled(callbacks)?;
    let mappings = match embed {
        Some(embed) => {
            match cluster_window_speakers(&windows, samples, options, callbacks, embed)? {
                Some(mappings) => mappings,
                // No segment anywhere in the file meets the minimum exclusive-speech requirement: no voiceprint is available, so fall back to IoU.
                None => stitch_window_speakers(&windows, options.max_speakers),
            }
        }
        None => stitch_window_speakers(&windows, options.max_speakers),
    };
    Ok(render_segments(&windows, &mappings, samples.len()))
}

/// Voiceprint re-identification: for each window and local speaker, extracts an embedding from exclusive speech, and constrained hierarchical clustering determines global identity.
///
/// Returns `None` when not a single usable embedding exists; the caller should fall back to pure IoU.
///
/// **No IoU bridge.** The old implementation filled in labels for local speakers that could not yield an embedding, using the majority cluster of the IoU chain, with the reasoning given in the comment at the time: with a 1-second step, the attribution zone was only 1 second, so dropping one window would punch a 1-second hole in the timeline. But that path produced labels unrelated to voiceprints, and the measured error rate for 0–1 second short turns was as high as 70%. With a 5-second step the premise disappears: the attribution zone is 5 seconds wide and exclusive speech is generally long enough, so simply skipping such a local speaker suffices. The cost of skipping is only that this short stretch has no speaker annotation; bridging would cost a wrong annotation, and the latter is worse.
fn cluster_window_speakers(
    windows: &[WindowActivity],
    samples: &[f32],
    options: &PyannoteOptions,
    callbacks: &mut PyannoteCallbacks<'_>,
    embed: SpeakerEmbedder<'_>,
) -> Result<Option<Vec<[Option<usize>; LOCAL_SPEAKERS]>>> {
    let mut units: Vec<SpeakerUnit> = Vec::new();
    let mut owners: Vec<(usize, usize)> = Vec::new();
    let mut seconds: Vec<f64> = Vec::new();
    for (window_index, window) in windows.iter().enumerate() {
        // Embedding is the second-longest stage, so the cancellation check must sit inside the loop.
        check_cancelled(callbacks)?;
        for local in 0..LOCAL_SPEAKERS {
            let Some((audio, first_start)) = exclusive_audio(window, local, samples) else {
                continue;
            };
            let duration = audio.len() as f64 / SAMPLE_RATE as f64;
            let Some(embedding) = embed(&audio) else {
                continue;
            };
            units.push(SpeakerUnit {
                chunk: window_index,
                local_cluster: window_index * LOCAL_SPEAKERS + local,
                embedding: Some(embedding),
                first_start,
            });
            owners.push((window_index, local));
            seconds.push(duration);
        }
        if let Some(on_progress) = callbacks.on_progress.as_deref_mut() {
            on_progress((windows.len() + window_index + 1) as f64, (windows.len() * 2) as f64);
        }
    }
    if units.is_empty() {
        return Ok(None);
    }

    let assignment = merge_speaker_units_with_durations(
        &units,
        options.clustering_threshold,
        options.max_speakers,
        &seconds,
        // `seconds[]` counts exclusive seconds per (window, local): the same real second of speech is counted once by each of the `WINDOW_STEPS` windows. With a 5 s step, 2.0 is equivalent to 1.0 seconds of real duration.
        DEFAULT_MIN_CLUSTER_SECONDS,
    );

    // The speaker cap is a hard commitment, but mutual exclusion within the same chunk is also a hard constraint. When the two conflict, clustering can only leave excess clusters (for example, in single-speaker material one window falsely reported a second local speaker). Here the `cap` clusters with the most cumulative exclusive duration are kept, and the other local speakers are not output in this window: better to under-label than to mislabel.
    let keep = surviving_clusters(&assignment, &seconds, options.max_speakers);

    let mut mappings = vec![[None; LOCAL_SPEAKERS]; windows.len()];
    for (index, (window_index, local)) in owners.iter().copied().enumerate() {
        if let Some(keep) = keep.as_ref()
            && !keep.contains(&assignment[index])
        {
            continue;
        }
        mappings[window_index][local] = Some(assignment[index]);
    }
    Ok(Some(mappings))
}

/// When over the speaker cap, picks the clusters to keep by cumulative exclusive duration; returns `None` when not over the limit. On equal duration, keeps the smaller id, to guarantee determinism.
fn surviving_clusters(assignment: &[usize], seconds: &[f64], max_speakers: Option<usize>) -> Option<BTreeSet<usize>> {
    let cap = max_speakers?;
    let mut totals: BTreeMap<usize, f64> = BTreeMap::new();
    for (index, cluster) in assignment.iter().copied().enumerate() {
        *totals.entry(cluster).or_default() += seconds.get(index).copied().unwrap_or_default();
    }
    if totals.len() <= cap {
        return None;
    }
    let mut ranked = totals.into_iter().collect::<Vec<_>>();
    ranked.sort_by(|left, right| right.1.total_cmp(&left.1).then(left.0.cmp(&right.0)));
    Some(ranked.into_iter().take(cap).map(|(id, _)| id).collect())
}

/// Takes a local speaker's exclusive speech within this window (no one else is speaking in that frame).
///
/// 'Exclusive' means this person is active after binarization, and the **raw probabilities** of all other local speakers are below [`OFFSET`]. Using raw probabilities rather than the binarized tracks is deliberate: hysteresis can leave a speaker with probability 0.4 in the off state, so judging by tracks would count such frames as exclusive and mix in others' voices, contaminating the WeSpeaker vector.
///
/// Returns `(audio, absolute seconds of the first exclusive frame)`; returns `None` when there are fewer than [`MIN_EMBEDDING_SAMPLES`]. Sampling is always clamped to `end_sample` and `samples.len()`: the last window is zero-padded for alignment, and feeding padded segments into WeSpeaker would contaminate the vector.
fn exclusive_audio(window: &WindowActivity, local: usize, samples: &[f32]) -> Option<(Vec<f32>, f64)> {
    if let Some(strict) = collect_clean_audio(window, local, samples, None) {
        return Some(strict);
    }
    // Fallback when strict exclusivity cannot accumulate enough: union in this person's frames that clearly outrank the other locals.
    collect_clean_audio(window, local, samples, Some(DOMINANCE_MARGIN))
}

/// `margin = None` ⇒ strict exclusivity (raw probabilities of other locals < OFFSET).
/// `margin = Some(m)` ⇒ dominance criterion (this person's probability is at least m higher than the other locals).
fn collect_clean_audio(window: &WindowActivity, local: usize, samples: &[f32], margin: Option<f32>) -> Option<(Vec<f32>, f64)> {
    let frame_samples = WINDOW_SAMPLES as f64 / FRAMES_PER_WINDOW as f64;
    let limit = window.end_sample.min(samples.len());
    let mut audio = Vec::new();
    let mut first_start = None;
    for frame in 0..window.tracks[local].len() {
        if !window.tracks[local][frame] {
            continue;
        }
        let own = window.probabilities[local][frame];
        // With margin = Some(m), take the union of 'strict exclusivity ∪ dominance': strictly exclusive frames are themselves the purest batch, and relaxing the criterion should not exclude them.
        let clean = (0..LOCAL_SPEAKERS)
            .filter(|other| *other != local)
            .all(|other| window.probabilities[other][frame] < OFFSET)
            || margin.is_some_and(|margin| {
                (0..LOCAL_SPEAKERS)
                    .filter(|other| *other != local)
                    .all(|other| window.probabilities[other][frame] + margin <= own)
            });
        if !clean {
            continue;
        }
        let start = window.start_sample + (frame as f64 * frame_samples) as usize;
        let end = window.start_sample + ((frame + 1) as f64 * frame_samples) as usize;
        let (start, end) = (start.min(limit), end.min(limit));
        if end <= start {
            continue;
        }
        first_start.get_or_insert(start as f64 / SAMPLE_RATE as f64);
        audio.extend_from_slice(&samples[start..end]);
    }
    if audio.len() < MIN_EMBEDDING_SAMPLES {
        return None;
    }
    Some((audio, first_start?))
}

fn check_cancelled(callbacks: &mut PyannoteCallbacks<'_>) -> Result<()> {
    if callbacks.should_cancel.as_deref_mut().is_some_and(|should_cancel| should_cancel()) {
        return Err(anyhow::Error::new(PyannoteCancelled));
    }
    Ok(())
}

fn window_positions(sample_count: usize) -> Vec<(usize, usize)> {
    if sample_count <= WINDOW_SAMPLES {
        return vec![(0, sample_count)];
    }
    let mut positions = Vec::new();
    let mut start = 0;
    while start + WINDOW_SAMPLES <= sample_count {
        positions.push((start, start + WINDOW_SAMPLES));
        start += STEP_SAMPLES;
    }
    if positions.last().is_none_or(|(_, end)| *end < sample_count) {
        let final_start = sample_count - WINDOW_SAMPLES;
        if positions.last().is_none_or(|(start, _)| *start != final_start) {
            positions.push((final_start, sample_count));
        }
    }
    positions
}

fn stitch_window_speakers(windows: &[WindowActivity], max_speakers: Option<usize>) -> Vec<[Option<usize>; LOCAL_SPEAKERS]> {
    let mut mappings = Vec::with_capacity(windows.len());
    let mut next_speaker = 0_usize;

    for (window_index, window) in windows.iter().enumerate() {
        let active = (0..LOCAL_SPEAKERS)
            .filter(|speaker| window.tracks[*speaker].iter().any(|value| *value))
            .collect::<Vec<_>>();
        let mut mapping = [None; LOCAL_SPEAKERS];
        if active.is_empty() {
            mappings.push(mapping);
            continue;
        }

        let mut scores = Vec::new();
        // Only look back at history windows that still share samples with the current window; earlier windows have zero overlap.
        let history_start = window_index.saturating_sub(WINDOW_STEPS);
        for local in active.iter().copied() {
            let mut by_global = BTreeMap::<usize, (usize, usize)>::new();
            for previous_index in history_start..window_index {
                let previous = &windows[previous_index];
                if previous.end_sample <= window.start_sample {
                    continue;
                }
                for previous_local in 0..LOCAL_SPEAKERS {
                    let Some(global) = mappings[previous_index][previous_local] else {
                        continue;
                    };
                    let (intersection, union) = track_overlap(window, local, previous, previous_local);
                    let entry = by_global.entry(global).or_default();
                    entry.0 += intersection;
                    entry.1 += union;
                }
            }
            for (global, (intersection, union)) in by_global {
                if union > 0 {
                    scores.push((intersection as f64 / union as f64, local, global));
                }
            }
        }
        scores.sort_by(|left, right| {
            right
                .0
                .total_cmp(&left.0)
                .then_with(|| left.1.cmp(&right.1))
                .then_with(|| left.2.cmp(&right.2))
        });

        let mut used_local = HashSet::new();
        let mut used_global = HashSet::new();
        for (score, local, global) in scores {
            if score < MATCH_THRESHOLD || used_local.contains(&local) || used_global.contains(&global) {
                continue;
            }
            mapping[local] = Some(global);
            used_local.insert(local);
            used_global.insert(global);
        }

        for local in active {
            if mapping[local].is_some() {
                continue;
            }
            // When the cap is reached, do not invent identities: with neither overlap evidence nor an empty slot to assign, this local speaker does not take part in output for this window, since its time is most likely covered by adjacent windows. (The old implementation searched for an empty slot by index with `unwrap_or(0)`, which effectively forced evidence-less speech into speaker 0.)
            if max_speakers.is_some_and(|limit| next_speaker >= limit) {
                continue;
            }
            let global = next_speaker;
            next_speaker += 1;
            mapping[local] = Some(global);
            used_global.insert(global);
        }
        mappings.push(mapping);
    }
    mappings
}

fn track_overlap(left: &WindowActivity, left_speaker: usize, right: &WindowActivity, right_speaker: usize) -> (usize, usize) {
    let overlap_start = left.start_sample.max(right.start_sample);
    let overlap_end = left.end_sample.min(right.end_sample);
    if overlap_end <= overlap_start {
        return (0, 0);
    }
    let mut intersection = 0;
    let mut union = 0;
    for frame in 0..FRAMES_PER_WINDOW {
        let absolute_sample = left.start_sample + ((frame as f64 + 0.5) * WINDOW_SAMPLES as f64 / FRAMES_PER_WINDOW as f64) as usize;
        if absolute_sample < overlap_start || absolute_sample >= overlap_end {
            continue;
        }
        let right_frame =
            (((absolute_sample - right.start_sample) as f64 / WINDOW_SAMPLES as f64) * FRAMES_PER_WINDOW as f64).floor() as usize;
        if right_frame >= FRAMES_PER_WINDOW {
            continue;
        }
        let a = left.tracks[left_speaker][frame];
        let b = right.tracks[right_speaker][right_frame];
        intersection += usize::from(a && b);
        union += usize::from(a || b);
    }
    (intersection, union)
}

fn render_segments(windows: &[WindowActivity], mappings: &[[Option<usize>; LOCAL_SPEAKERS]], sample_count: usize) -> Vec<DiarizedSegment> {
    let duration = sample_count as f64 / SAMPLE_RATE as f64;
    let frame_duration = WINDOW_SECONDS / FRAMES_PER_WINDOW as f64;
    let mut segments = Vec::new();
    for (index, window) in windows.iter().enumerate() {
        let window_start = window.start_sample as f64 / SAMPLE_RATE as f64;
        let window_end = window.end_sample as f64 / SAMPLE_RATE as f64;
        let previous_end = index
            .checked_sub(1)
            .map(|previous| windows[previous].end_sample as f64 / SAMPLE_RATE as f64)
            .unwrap_or(0.0);
        let next_start = windows
            .get(index + 1)
            .map(|next| next.start_sample as f64 / SAMPLE_RATE as f64)
            .unwrap_or(duration);
        // Center zone: with a 5-second step it is exactly the middle 5 seconds of the window; the first window's left edge is pulled to 0, and the last window's right edge is pulled to the end of the file.
        let own_start = if index == 0 { 0.0 } else { (window_start + previous_end) * 0.5 };
        let own_end = if index + 1 == windows.len() {
            duration
        } else {
            (window_end + next_start) * 0.5
        };

        for local in 0..LOCAL_SPEAKERS {
            let Some(global) = mappings[index][local] else {
                continue;
            };
            let mut run_start = None;
            for frame in 0..=FRAMES_PER_WINDOW {
                let active = frame < FRAMES_PER_WINDOW && window.tracks[local][frame];
                if active && run_start.is_none() {
                    run_start = Some(frame);
                } else if !active && let Some(start_frame) = run_start.take() {
                    // The duration threshold has already been checked on the raw run within the window in binarize_speaker_track; here we only trim to the attribution zone. The two halves of a segment cut across attribution zones are adjacent in time, and the MERGE_GAP_SECONDS merge below joins them back.
                    let raw_start = window_start + start_frame as f64 * frame_duration;
                    let raw_end = window_start + frame as f64 * frame_duration;
                    let start = raw_start.max(own_start);
                    let end = raw_end.min(window_end).min(own_end);
                    if end > start {
                        segments.push(DiarizedSegment {
                            start,
                            end,
                            speaker: global,
                        });
                    }
                }
            }
        }
    }

    segments.sort_by(|left, right| left.speaker.cmp(&right.speaker).then_with(|| left.start.total_cmp(&right.start)));
    let mut merged: Vec<DiarizedSegment> = Vec::new();
    for segment in segments {
        if let Some(previous) = merged.last_mut()
            && previous.speaker == segment.speaker
            && segment.start - previous.end < MERGE_GAP_SECONDS
        {
            previous.end = previous.end.max(segment.end);
        } else {
            merged.push(segment);
        }
    }
    // After merging, one more floor check: isolated fragments that the attribution zone cut down to an extremely short length still are not output.
    merged.retain(|segment| segment.end - segment.start >= MIN_SPEECH_SECONDS);

    let used = merged.iter().map(|segment| segment.speaker).collect::<BTreeSet<_>>();
    let compact = used
        .into_iter()
        .enumerate()
        .map(|(new, old)| (old, new))
        .collect::<BTreeMap<_, _>>();
    for segment in &mut merged {
        segment.speaker = compact[&segment.speaker];
    }
    merged.sort_by(|left, right| left.start.total_cmp(&right.start).then_with(|| left.speaker.cmp(&right.speaker)));
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Translates the intent of 'one powerset class per frame' into logits: the winning class gets 10.0, the others 0.0. After softmax, the winning class probability is ≈0.99994, comfortably above [`ONSET`].
    fn logits_from_classes(classes: &[u8]) -> Vec<f32> {
        let mut logits = vec![0.0_f32; classes.len() * CLASS_COUNT];
        for (frame, class) in classes.iter().enumerate() {
            logits[frame * CLASS_COUNT + *class as usize] = 10.0;
        }
        logits
    }

    #[test]
    fn positions_use_ten_second_windows_with_half_window_step() {
        assert_eq!(window_positions(8_000), vec![(0, 8_000)]);
        assert_eq!(STEP_SAMPLES, 80_000);
        assert_eq!(WINDOW_STEPS, 2);
        let positions = window_positions(WINDOW_SAMPLES + 2 * STEP_SAMPLES);
        assert_eq!(positions, vec![(0, 160_000), (80_000, 240_000), (160_000, 320_000)]);
        // If the tail is shorter than one step, add an edge-aligned window.
        assert_eq!(window_positions(WINDOW_SAMPLES + 20_000), vec![(0, 160_000), (20_000, 180_000)]);
    }

    #[test]
    fn powerset_probabilities_sum_per_speaker() {
        // Frame 0 silence, frame 1 only spk1, frame 2 is spk1+spk2, frame 3 is spk2+spk3.
        let probabilities = speaker_probabilities(&logits_from_classes(&[0, 1, 4, 6]));
        let active: Vec<Vec<bool>> = probabilities
            .iter()
            .map(|track| track.iter().map(|value| *value >= ONSET).collect())
            .collect();
        assert_eq!(active[0], vec![false, true, true, false]);
        assert_eq!(active[1], vec![false, false, true, true]);
        assert_eq!(active[2], vec![false, false, false, true]);
    }

    #[test]
    fn overlap_probability_survives_when_argmax_would_lose() {
        // Single-speaker class 1 gets 0.40, overlap class 4 gets 0.35: argmax judges 'only spk1'. After summing probabilities, spk2 = 0.35 < onset but spk1 = 0.75. The key is that spk2's 0.35 is above OFFSET, which would stop this frame from counting as spk1's exclusive speech.
        let mut logits = vec![f32::NEG_INFINITY; CLASS_COUNT];
        logits[0] = 0.25_f32.ln();
        logits[1] = 0.40_f32.ln();
        logits[4] = 0.35_f32.ln();
        let probabilities = speaker_probabilities(&logits);
        assert!((probabilities[0][0] - 0.75).abs() < 1e-5);
        assert!((probabilities[1][0] - 0.35).abs() < 1e-5);
        assert!(probabilities[1][0] >= OFFSET);
        assert_eq!(argmax_classes(&logits), vec![1]);
    }

    #[test]
    fn hysteresis_keeps_a_dipping_speaker_active() {
        // 0.6 turns on → 0.4 sits between onset and offset, so hysteresis keeps it active → 0.1 turns off.
        let probabilities = std::iter::repeat_n(0.6_f32, 40)
            .chain(std::iter::repeat_n(0.4, 40))
            .chain(std::iter::repeat_n(0.1, 40))
            .collect::<Vec<_>>();
        let track = binarize_speaker_track(&probabilities);
        assert!(track[0..80].iter().all(|value| *value));
        assert!(track[80..].iter().all(|value| !*value));
        // Without hysteresis (single threshold 0.5), the middle 40 frames would be misjudged as silence.
        assert!(probabilities[40] < ONSET && probabilities[40] >= OFFSET);
    }

    #[test]
    fn smoothing_fills_short_gaps_and_drops_short_speech() {
        let frame_seconds = WINDOW_SECONDS / FRAMES_PER_WINDOW as f64;
        let long = (1.0 / frame_seconds) as usize; // 1 second
        let short_gap = (0.10 / frame_seconds) as usize; // < MIN_SILENCE_SECONDS
        let short_speech = (0.20 / frame_seconds) as usize; // < MIN_SPEECH_SECONDS
        let probabilities = std::iter::repeat_n(0.9_f32, long)
            .chain(std::iter::repeat_n(0.0, short_gap))
            .chain(std::iter::repeat_n(0.9, long))
            .chain(std::iter::repeat_n(0.0, long))
            .chain(std::iter::repeat_n(0.9, short_speech))
            .collect::<Vec<_>>();
        let track = binarize_speaker_track(&probabilities);
        // Short gap filled: the first 2 seconds and the middle gap join into one segment.
        assert!(track[..2 * long + short_gap].iter().all(|value| *value));
        // The final 0.2 seconds of speech is shorter than MIN_SPEECH_SECONDS and is discarded.
        assert!(track[2 * long + short_gap..].iter().all(|value| !*value));
    }

    fn blank_window(start_sample: usize) -> WindowActivity {
        WindowActivity {
            start_sample,
            end_sample: start_sample + WINDOW_SAMPLES,
            probabilities: std::array::from_fn(|_| vec![0.0; FRAMES_PER_WINDOW]),
            tracks: std::array::from_fn(|_| vec![false; FRAMES_PER_WINDOW]),
        }
    }

    /// Sets a range of frames for a window's local speaker to active (writes both probability and tracks).
    fn activate(window: &mut WindowActivity, local: usize, range: std::ops::Range<usize>) {
        window.probabilities[local][range.clone()].fill(1.0);
        window.tracks[local][range].fill(true);
    }

    #[test]
    fn overlap_stitching_survives_local_label_swap() {
        // Step 5 s = 294.5 frames: frame f of window 0 (f ≥ 294) corresponds to frame f-294 of window 1, as determined by the frame-center mapping in `track_overlap`. The intervals below were computed by hand following this mapping.
        let mut first = blank_window(0);
        let mut second = blank_window(STEP_SAMPLES);
        activate(&mut first, 0, 300..500);
        activate(&mut first, 1, 520..580);
        activate(&mut second, 1, 6..206); // Fully coincides with first.tracks[0]
        activate(&mut second, 0, 226..286); // Fully coincides with first.tracks[1]
        let mappings = stitch_window_speakers(&[first, second], None);
        assert_eq!(mappings[0][0], mappings[1][1]);
        assert_eq!(mappings[0][1], mappings[1][0]);
        assert_ne!(mappings[0][0], mappings[0][1]);
    }

    #[test]
    fn speaker_cap_does_not_create_extra_global_ids() {
        let mut window = blank_window(0);
        for local in 0..LOCAL_SPEAKERS {
            activate(&mut window, local, 0..FRAMES_PER_WINDOW);
        }
        let mappings = stitch_window_speakers(&[window], Some(2));
        let ids = mappings[0].into_iter().flatten().collect::<BTreeSet<_>>();
        assert_eq!(ids, BTreeSet::from([0, 1]));
        // The third local speaker has neither an empty slot nor overlap evidence, so it is no longer forced into speaker 0.
        assert_eq!(mappings[0].iter().flatten().count(), 2);
    }

    /// The same person speaks first for 0–5 s, goes silent for 25 s, returns at 30–35 s, and the model gives them different local numbers. IoU look-back covers only [`WINDOW_STEPS`] windows, so it necessarily judges two people; voiceprint clustering must merge the two segments back into the same global id.
    #[test]
    fn same_speaker_returning_after_long_silence_keeps_one_identity() {
        const DURATION_SECONDS: usize = 40;
        let samples = vec![0.1_f32; DURATION_SECONDS * SAMPLE_RATE];

        fn synth(window_index: usize) -> Vec<f32> {
            let classes = (0..FRAMES_PER_WINDOW)
                .map(|frame| {
                    let time = window_index as f64 * (STEP_SAMPLES as f64 / SAMPLE_RATE as f64)
                        + frame as f64 * WINDOW_SECONDS / FRAMES_PER_WINDOW as f64;
                    if (0.0..5.0).contains(&time) {
                        1 // local 0
                    } else if (30.0..35.0).contains(&time) {
                        2 // Same person; this time the model gives local 1
                    } else {
                        0
                    }
                })
                .collect::<Vec<u8>>();
            logits_from_classes(&classes)
        }

        fn infer() -> impl FnMut(&[f32], usize) -> Result<Vec<Vec<f32>>> {
            let mut next_window = 0_usize;
            move |_packed: &[f32], batch: usize| {
                let logits = (0..batch).map(|index| synth(next_window + index)).collect();
                next_window += batch;
                Ok(logits)
            }
        }

        // Pure IoU (no voiceprint backend): the same person returning after a long silence is judged a second speaker.
        let iou_only = diarize_with(
            &samples,
            &PyannoteOptions::default(),
            &mut PyannoteCallbacks::default(),
            infer(),
            None,
        )
        .unwrap();
        let iou_speakers = iou_only.iter().map(|segment| segment.speaker).collect::<BTreeSet<_>>();
        assert_eq!(iou_speakers.len(), 2, "{iou_only:?}");

        // With voiceprints connected: the two segments' embeddings are the same, so constrained hierarchical clustering merges them into the same global identity.
        let mut embed = |audio: &[f32]| {
            assert!(audio.len() >= MIN_EMBEDDING_SAMPLES);
            Some(vec![1.0_f32, 0.0])
        };
        let clustered = diarize_with(
            &samples,
            &PyannoteOptions::default(),
            &mut PyannoteCallbacks::default(),
            infer(),
            Some(&mut embed),
        )
        .unwrap();
        let speakers = clustered.iter().map(|segment| segment.speaker).collect::<BTreeSet<_>>();
        assert_eq!(speakers, BTreeSet::from([0]), "{clustered:?}");
        assert!(clustered.iter().any(|segment| segment.start < 1.0));
        assert!(clustered.iter().any(|segment| segment.end > 34.0));
    }

    /// A continuous stretch of speech spanning multiple attribution zones must be output as one whole and must not be chopped up by trimming.
    #[test]
    fn continuous_speech_survives_ownership_zone_clipping() {
        let step_seconds = STEP_SAMPLES as f64 / SAMPLE_RATE as f64;
        let windows = (0..4)
            .map(|index| {
                let mut window = blank_window(index * STEP_SAMPLES);
                for frame in 0..FRAMES_PER_WINDOW {
                    let time = index as f64 * step_seconds + frame as f64 * WINDOW_SECONDS / FRAMES_PER_WINDOW as f64;
                    if (2.0..12.0).contains(&time) {
                        window.probabilities[0][frame] = 1.0;
                        window.tracks[0][frame] = true;
                    }
                }
                window
            })
            .collect::<Vec<_>>();
        let mappings = stitch_window_speakers(&windows, None);
        let segments = render_segments(&windows, &mappings, 25 * SAMPLE_RATE);
        assert_eq!(segments.len(), 1, "{segments:?}");
        assert!((segments[0].start - 2.0).abs() < 0.05, "{segments:?}");
        assert!((segments[0].end - 12.0).abs() < 0.05, "{segments:?}");
    }

    #[test]
    fn speaker_cap_drops_the_quietest_cluster_when_chunks_conflict() {
        // Two units in the same chunk are mutually exclusive and can never be merged; with cap=1, the shorter one must be dropped by duration ordering rather than outputting two speakers.
        let assignment = vec![0, 1];
        let seconds = vec![9.0, 0.4];
        let keep = surviving_clusters(&assignment, &seconds, Some(1)).expect("over limit");
        assert_eq!(keep, BTreeSet::from([0]));
        assert!(surviving_clusters(&assignment, &seconds, Some(2)).is_none());
        assert!(surviving_clusters(&assignment, &seconds, None).is_none());
    }
}
