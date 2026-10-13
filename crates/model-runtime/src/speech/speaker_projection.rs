//! Projection of speaker spans onto words. Ported from `cmd/media/support.rs` in v2 `ccut-kernel` (`project_speaker_clusters` and its helper functions).
//!
//! The input is the global speaker spans ([`SpeakerRange`]) obtained from Pyannote segmentation plus voiceprint clustering, and the output is the cluster number of each word. v3 changes only the boundaries: the functions move into `speech`, and the transcription job calls them after recognition completes. The projection logic, constants and tests are kept as they were.

use super::SpeakerRange;

// ── Word → speaker projection layer ──
//
// Spans are the evidence of “who speaks when”, and the word stream is the fact of “when the text appears”. The two come from different models, and their boundaries never line up strictly.
// Taking the maximum overlap word by word carries every jitter in the spans straight into the transcript: diagnostics showed as many as a hundred-odd places within one continuous ASR utterance that carry two or more speaker labels. This is the one error pattern this layer can actually stem.
// The constants below are shape assumptions (the rhythm of human speech, how long an interruption must be at least), not values tuned on any particular video.

/// Utterance-segmentation threshold: when the gap between adjacent words reaches this many seconds, a new segment starts.
///
/// 0.8 s is the conservative end: common diarization speaker-change pauses last 0.5–1.0 s, while the gaps between words in continuous Chinese reading are usually well under 0.5 s. A smaller value would make “a segment” shorter, and voting could smooth over less. Genuine quick speaker changes are preserved by the interruption escape hatch below, not by segment boundaries.
const UTTERANCE_GAP_SECONDS: f64 = 0.8;

/// Distance cap for the nearest-span fallback. Beyond it, no snapping happens; the word is left to segment voting or to neighbour inheritance.
///
/// Slightly larger than the segmentation threshold: a word inside a segment that the spans missed because of non-speech detection (breaths, laughter, pauses) can still snap back to that segment's span. A word more than 1.5 s from the nearest span has already crossed at least one segment boundary, and “nearest” is no longer evidence there.
const NEAREST_RANGE_MAX_GAP_SECONDS: f64 = 1.5;

/// Number of neighbouring words before and after that are considered when scoring overlap regions.
const CONTINUITY_WINDOW_WORDS: usize = 3;

/// Maximum bonus ratio that neighbour-label consistency may add to the overlap duration.
///
/// 0.25 means the neighbouring words' label can flip the result only when the two candidate clusters' overlap durations differ by less than 25%. When the overlap evidence clearly favours one cluster, continuity always yields, so genuinely concurrent speakers are not flattened into one person.
const CONTINUITY_SCORE_WEIGHT: f64 = 0.25;

/// The lead multiple required for a word's attribution to count as “unambiguous” (so that it can serve as a reference for its neighbours).
const CLEAR_DOMINANCE_RATIO: f64 = 2.0;

/// Interruption escape hatch: a continuous sub-segment inside a segment keeps a label different from the segment's main label only if it satisfies all three of: word count, duration and coverage.
/// 0.6 s of Chinese is about 3–4 characters, already an interjection that can be heard clearly. Coverage requires that more than 60% of the sub-segment's span really falls within that cluster's spans, which excludes cases that only graze the edge.
///
/// The word-count floor is 1, not 2: real interjections such as 对 (yes), 是啊 (yeah) and 哈哈 (haha) are often a single word, and a floor of 2 would wipe them out entirely into the neighbour's label. The measured gain depends on upstream parameters. With `DOMINANCE_MARGIN` at 0.10, the number of the 53 real interjections retained under the lenient criterion rose from 16 to 19; at the current 0.20 the retained count stays the same (still 16), but the word-level cluster count recovers from 6 to 7, so at least one pure-interjection cluster is no longer flattened. In both cases the duration and coverage criteria still block span jitter, and neither fragmentation nor purity regressed.
/// Loosening duration and coverage further (0.4 s / 50%) saves only 2 more interjections, but raises fragmentation from 59 to 61 turns and costs 0.06 pp of purity, so it is not worth it.
const INTERJECTION_MIN_WORDS: usize = 1;
const INTERJECTION_MIN_SECONDS: f64 = 0.6;
const INTERJECTION_MIN_COVERAGE: f64 = 0.6;

/// Probe window for zero-length words: a word with `t1 == t0` has zero overlap with any span, so it is given a centisecond window to obtain evidence.
const WORD_PROBE_MIN_SECONDS: f64 = 0.01;

/// Projects speaker spans onto the word stream and returns the cluster number of each word (`None` = no evidence available).
///
/// This is a pure function that takes only time: `spans` are each word's `(t0, t1)`, and `ranges` are the recognised speaker spans.
/// The three stages, in order:
/// 1. Score each word by overlap; within overlap regions, combine with the label continuity of neighbouring words (`CONTINUITY_SCORE_WEIGHT`);
/// 2. Cut continuous utterance segments at inter-word gaps, and within each segment take a duration-weighted majority vote and unify the label;
/// 3. Within a segment, a continuous sub-segment whose label differs from the main label and whose evidence is strong enough keeps its own label (interruption escape hatch).
///
/// A segment with no overlap evidence first falls back to the nearest span within a capped distance; if that still yields nothing, it inherits the nearest already-decided segment. Only when the whole word stream has no evidence at all does it return `None` overall.
pub fn project_speaker_clusters(spans: &[(f64, f64)], ranges: &[SpeakerRange]) -> Vec<Option<usize>> {
    if spans.is_empty() {
        return Vec::new();
    }
    if ranges.is_empty() {
        return vec![None; spans.len()];
    }
    let intervals = merged_cluster_intervals(ranges);
    let probes = spans
        .iter()
        .map(|&(start, end)| (start, end.max(start + WORD_PROBE_MIN_SECONDS)))
        .collect::<Vec<_>>();
    let overlaps = probes
        .iter()
        .map(|&(start, end)| {
            intervals
                .iter()
                .filter_map(|(&cluster, list)| {
                    let overlap = interval_overlap(list, start, end);
                    (overlap > 0.0).then_some((cluster, overlap))
                })
                .collect::<std::collections::BTreeMap<usize, f64>>()
        })
        .collect::<Vec<_>>();
    let segments = utterance_segments(&probes);

    // The first pass looks only at overlap and produces “unambiguous” reference labels; only the second pass lets ambiguous words refer to their neighbours,
    // so the result does not depend on traversal order.
    let plain = overlaps.iter().map(heaviest_cluster).collect::<Vec<_>>();
    let clear = overlaps.iter().map(is_clear_overlap).collect::<Vec<_>>();
    let mut labels = plain.clone();
    for segment in &segments {
        for index in segment.clone() {
            if overlaps[index].len() > 1 && !clear[index] {
                labels[index] = continuity_cluster(&overlaps[index], index, segment, &plain, &clear);
            }
        }
    }

    let mut projected = vec![None; spans.len()];
    let mut majorities = vec![None; segments.len()];
    for (slot, segment) in segments.iter().enumerate() {
        let mut weights: std::collections::BTreeMap<usize, f64> = std::collections::BTreeMap::new();
        for index in segment.clone() {
            if let Some(cluster) = labels[index] {
                *weights.entry(cluster).or_default() += word_weight(probes[index]);
            }
        }
        if weights.is_empty() {
            // No overlap evidence across the whole segment: only then is the nearest-span fallback used, and it must be within the distance cap.
            for index in segment.clone() {
                if let Some(cluster) = nearest_range_cluster(ranges, probes[index].0, probes[index].1, NEAREST_RANGE_MAX_GAP_SECONDS) {
                    *weights.entry(cluster).or_default() += word_weight(probes[index]);
                }
            }
        }
        let Some(majority) = heaviest_cluster(&weights) else {
            continue;
        };
        majorities[slot] = Some(majority);
        for index in segment.clone() {
            projected[index] = Some(majority);
        }
        for (start, end, cluster) in labeled_runs(segment.clone(), &labels) {
            if cluster == majority {
                continue;
            }
            if !interjection_survives(start, end, cluster, &probes, &intervals) {
                continue;
            }
            for index in start..=end {
                projected[index] = Some(cluster);
            }
        }
    }

    // Segments still undecided (no overlap, and the nearest span is also beyond the limit) inherit the nearest already-decided segment: search backward first, then forward.
    for (slot, segment) in segments.iter().enumerate() {
        if majorities[slot].is_some() {
            continue;
        }
        let inherited = majorities[..slot]
            .iter()
            .rev()
            .find_map(|majority| *majority)
            .or_else(|| majorities[slot + 1..].iter().find_map(|majority| *majority));
        let Some(cluster) = inherited else {
            continue;
        };
        for index in segment.clone() {
            projected[index] = Some(cluster);
        }
    }
    projected
}

/// The weight of a word in voting is its duration; zero-length words are weighted by the probe window, so every word has a say.
fn word_weight((start, end): (f64, f64)) -> f64 {
    (end - start).max(WORD_PROBE_MIN_SECONDS)
}

/// Groups the spans by cluster and merges the parts of the same cluster that overlap each other, so overlap duration is not counted twice.
fn merged_cluster_intervals(ranges: &[SpeakerRange]) -> std::collections::BTreeMap<usize, Vec<(f64, f64)>> {
    let mut by_cluster: std::collections::BTreeMap<usize, Vec<(f64, f64)>> = std::collections::BTreeMap::new();
    for range in ranges {
        if range.end > range.start {
            by_cluster.entry(range.cluster).or_default().push((range.start, range.end));
        }
    }
    for list in by_cluster.values_mut() {
        list.sort_by(|left, right| left.0.total_cmp(&right.0));
        let mut merged: Vec<(f64, f64)> = Vec::with_capacity(list.len());
        for &(start, end) in list.iter() {
            match merged.last_mut() {
                Some(last) if start <= last.1 => last.1 = last.1.max(end),
                _ => merged.push((start, end)),
            }
        }
        *list = merged;
    }
    by_cluster
}

/// The total number of seconds that a set of non-overlapping spans overlaps `[start, end)`.
fn interval_overlap(intervals: &[(f64, f64)], start: f64, end: f64) -> f64 {
    intervals
        .iter()
        .map(|&(range_start, range_end)| (end.min(range_end) - start.max(range_start)).max(0.0))
        .sum()
}

/// Cuts continuous utterance segments at inter-word gaps. A gap is measured against the latest end time of all earlier words and clamped to non-negative,
/// so an out-of-order or zero-length ASR word does not cut a segment out of nothing.
fn utterance_segments(probes: &[(f64, f64)]) -> Vec<std::ops::Range<usize>> {
    let mut segments = Vec::new();
    let mut start = 0usize;
    let mut previous_end = probes[0].1;
    for index in 1..probes.len() {
        let gap = (probes[index].0 - previous_end).max(0.0);
        if gap >= UTTERANCE_GAP_SECONDS {
            segments.push(start..index);
            start = index;
        }
        previous_end = previous_end.max(probes[index].1);
    }
    segments.push(start..probes.len());
    segments
}

/// The cluster with the largest weight. On a tie the smaller cluster number wins (ascending BTreeMap + `>=` keeps the first one seen), so the result is deterministic.
fn heaviest_cluster(weights: &std::collections::BTreeMap<usize, f64>) -> Option<usize> {
    weights
        .iter()
        .fold(None, |best: Option<(usize, f64)>, (&cluster, &weight)| match best {
            Some((_, best_weight)) if best_weight >= weight => best,
            _ => Some((cluster, weight)),
        })
        .map(|(cluster, _)| cluster)
}

/// Whether the attribution is clean enough to serve as a reference for neighbours: it reduces to a single cluster, or leads the runner-up by more than a factor of two.
fn is_clear_overlap(overlaps: &std::collections::BTreeMap<usize, f64>) -> bool {
    let mut sorted = overlaps.values().copied().collect::<Vec<_>>();
    sorted.sort_by(|left, right| right.total_cmp(left));
    match sorted.as_slice() {
        [] => false,
        [_] => true,
        [top, second, ..] => *top >= *second * CLEAR_DOMINANCE_RATIO,
    }
}

/// Overlap-region scoring: adds a label-consistency bonus from the neighbouring words before and after within the same segment to the overlap duration.
fn continuity_cluster(
    overlaps: &std::collections::BTreeMap<usize, f64>,
    index: usize,
    segment: &std::ops::Range<usize>,
    plain: &[Option<usize>],
    clear: &[bool],
) -> Option<usize> {
    let low = index.saturating_sub(CONTINUITY_WINDOW_WORDS).max(segment.start);
    let high = (index + CONTINUITY_WINDOW_WORDS + 1).min(segment.end);
    let mut counts: std::collections::BTreeMap<usize, usize> = std::collections::BTreeMap::new();
    let mut total = 0usize;
    for neighbor in low..high {
        if neighbor == index || !clear[neighbor] {
            continue;
        }
        if let Some(cluster) = plain[neighbor] {
            *counts.entry(cluster).or_default() += 1;
            total += 1;
        }
    }
    let scored = overlaps
        .iter()
        .map(|(&cluster, &overlap)| {
            let agreement = if total == 0 {
                0.0
            } else {
                counts.get(&cluster).copied().unwrap_or(0) as f64 / total as f64
            };
            (cluster, overlap * (1.0 + CONTINUITY_SCORE_WEIGHT * agreement))
        })
        .collect::<std::collections::BTreeMap<usize, f64>>();
    heaviest_cluster(&scored)
}

/// Within a segment, cuts continuous sub-segments by label and returns `(first word index, last word index, cluster number)`.
/// A word without a label does not break a sub-segment; it follows the ruling of the sub-segment it sits in.
fn labeled_runs(segment: std::ops::Range<usize>, labels: &[Option<usize>]) -> Vec<(usize, usize, usize)> {
    let mut runs: Vec<(usize, usize, usize)> = Vec::new();
    for index in segment {
        let Some(cluster) = labels[index] else {
            continue;
        };
        match runs.last_mut() {
            Some(last) if last.2 == cluster => last.1 = index,
            _ => runs.push((index, index, cluster)),
        }
    }
    runs
}

/// Interruption escape hatch: a segment may switch labels only when the sub-segment is long enough, has enough words, and is genuinely covered by that cluster's spans.
fn interjection_survives(
    start: usize,
    end: usize,
    cluster: usize,
    probes: &[(f64, f64)],
    intervals: &std::collections::BTreeMap<usize, Vec<(f64, f64)>>,
) -> bool {
    if end + 1 - start < INTERJECTION_MIN_WORDS {
        return false;
    }
    let span_start = probes[start].0;
    let span_end = probes[end].1;
    let span = span_end - span_start;
    if span < INTERJECTION_MIN_SECONDS {
        return false;
    }
    let Some(list) = intervals.get(&cluster) else {
        return false;
    };
    interval_overlap(list, span_start, span_end) >= span * INTERJECTION_MIN_COVERAGE
}

/// Fallback for a word that overlaps none of the speaker spans: take the span nearest in time.
///
/// Beyond `max_gap` it no longer snaps. Unbounded snapping would forcibly attribute distant silence, laughter and non-speech to some speaker (the historical behaviour).
/// The caller uses this only when the whole segment has no overlap evidence. If it yields nothing, the segment inherits its neighbour's ruling, so it does not degrade into the default “s1” of `Word::sp`.
/// On a tie (equal distance) the smallest cluster number wins, so the result is deterministic.
fn nearest_range_cluster(ranges: &[SpeakerRange], start: f64, end: f64, max_gap: f64) -> Option<usize> {
    let mut best: Option<(f64, usize)> = None;
    for range in ranges {
        let gap = if end < range.start {
            range.start - end
        } else if start > range.end {
            start - range.end
        } else {
            0.0
        };
        if gap > max_gap {
            continue;
        }
        let better = match best {
            None => true,
            Some((best_gap, best_cluster)) => gap < best_gap || (gap == best_gap && range.cluster < best_cluster),
        };
        if better {
            best = Some((gap, range.cluster));
        }
    }
    best.map(|(_, cluster)| cluster)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn speaker_range(start: f64, end: f64, cluster: usize) -> SpeakerRange {
        SpeakerRange {
            start,
            end,
            cluster,
            chunk: 0,
        }
    }

    /// A synthetic word stream of 0.3-second cells, contiguous end to end. Grid points are computed with integer division, and boundaries and span endpoints are exactly equal,
    /// so the assertions are not affected by floating-point error.
    fn word_grid(count: usize) -> Vec<(f64, f64)> {
        (0..count)
            .map(|index| ((index * 3) as f64 / 10.0, ((index + 1) * 3) as f64 / 10.0))
            .collect()
    }

    /// P3: a one- or two-word label jitter within a segment is smoothed out by duration-weighted majority voting and no longer passes through to the transcript.
    #[test]
    fn speaker_projection_smooths_short_label_flicker() {
        let spans = word_grid(10);
        // s0 covers the whole segment; only 1.2–1.5 (the 5th word) is cut out as a 0.3 s fragment with a different label.
        let ranges = vec![speaker_range(0.0, 1.2, 0), speaker_range(1.2, 1.5, 1), speaker_range(1.5, 3.0, 0)];
        assert_eq!(project_speaker_clusters(&spans, &ranges), vec![Some(0); 10]);

        // A single word is kept as long as it is long enough (≥0.6 s) and its evidence is strong enough. Real interjections such as 对 (yes) and 是啊 (yeah) are often just one word, which is why the word-count floor is 1.
        let long_flicker = vec![(0.0, 0.9), (0.9, 1.8), (1.8, 2.7)];
        let ranges = vec![speaker_range(0.0, 0.9, 0), speaker_range(0.9, 1.8, 1), speaker_range(1.8, 2.7, 0)];
        assert_eq!(project_speaker_clusters(&long_flicker, &ranges), vec![Some(0), Some(1), Some(0)]);

        // A single word shorter than 0.6 s is still judged to be span jitter and is smoothed out.
        let short_flicker = vec![(0.0, 0.9), (0.9, 1.4), (1.4, 2.3)];
        let ranges = vec![speaker_range(0.0, 0.9, 0), speaker_range(0.9, 1.4, 1), speaker_range(1.4, 2.3, 0)];
        assert_eq!(project_speaker_clusters(&short_flicker, &ranges), vec![Some(0); 3]);

        // The word count and duration are both sufficient, but the different label only grazes 1/3 of the sub-segment's span (three 0.1 s fragments of spans); the coverage threshold judges it to be span jitter.
        let spans = word_grid(6);
        let ranges = vec![
            speaker_range(0.0, 0.6, 0),
            speaker_range(0.7, 0.8, 1),
            speaker_range(1.0, 1.1, 1),
            speaker_range(1.3, 1.4, 1),
            speaker_range(1.5, 1.8, 0),
        ];
        assert_eq!(project_speaker_clusters(&spans, &ranges), vec![Some(0); 6]);
    }

    /// P3 escape hatch: real quick interjections (≥2 words, ≥0.6 s, coverage ≥60%) must survive the voting.
    #[test]
    fn speaker_projection_keeps_real_interjection() {
        let spans = word_grid(10);
        // 1.2–2.1 is a 3-word, 0.9 s interjection fully covered by s1; the segment's main label is still s0.
        let ranges = vec![speaker_range(0.0, 1.2, 0), speaker_range(1.2, 2.1, 1), speaker_range(2.1, 3.0, 0)];
        assert_eq!(
            project_speaker_clusters(&spans, &ranges),
            vec![
                Some(0),
                Some(0),
                Some(0),
                Some(0),
                Some(1),
                Some(1),
                Some(1),
                Some(0),
                Some(0),
                Some(0),
            ]
        );

        // A 2-word, 0.7 s interjection just above the threshold must also survive.
        let spans = vec![(0.0, 1.0), (1.0, 1.35), (1.35, 1.7), (1.7, 2.7), (2.7, 3.7)];
        let ranges = vec![speaker_range(0.0, 1.0, 0), speaker_range(1.0, 1.7, 1), speaker_range(1.7, 3.7, 0)];
        assert_eq!(
            project_speaker_clusters(&spans, &ranges),
            vec![Some(0), Some(1), Some(1), Some(0), Some(0)]
        );
    }

    /// P5: in a concurrent region where the overlap durations tie, the attribution is decided by the label consistency of the neighbouring words.
    #[test]
    fn speaker_projection_uses_neighbor_continuity_in_overlap() {
        let spans = word_grid(10);
        // 1.2–2.1 is a two-person concurrent region: within it, each word's overlap with the two clusters is exactly equal.
        // Pure “maximum overlap” would always assign them to the smaller cluster number s0, while continuity hands the later words to s1.
        let ranges = vec![speaker_range(0.0, 2.1, 0), speaker_range(1.2, 3.0, 1)];
        let projected = project_speaker_clusters(&spans, &ranges);
        assert_eq!(projected[4], Some(0), "并发区靠前的词跟随前文 {projected:?}");
        assert_eq!(projected[6], Some(1), "并发区靠后的词跟随后文 {projected:?}");
        assert_eq!(
            projected,
            vec![
                Some(0),
                Some(0),
                Some(0),
                Some(0),
                Some(0),
                Some(0),
                Some(1),
                Some(1),
                Some(1),
                Some(1),
            ]
        );
    }

    /// P4: the nearest-span fallback has a distance cap. Words beyond the cap inherit from the neighbouring segment and never silently fall to s1.
    #[test]
    fn speaker_projection_caps_nearest_range_fallback() {
        let ranges = vec![speaker_range(0.0, 1.0, 0), speaker_range(5.0, 6.0, 1)];

        // Within the cap (gap 1.0 s < 1.5 s) it still snaps.
        assert_eq!(project_speaker_clusters(&[(2.0, 2.5)], &ranges), vec![Some(0)]);
        // Beyond the cap, with no other evidence anywhere in the word stream: remain unattributed, so the caller keeps the original value.
        assert_eq!(project_speaker_clusters(&[(20.0, 20.5)], &ranges), vec![None]);

        // A segment beyond the limit inherits the nearest already-decided segment, rather than being recorded under speaker 0.
        let spans = vec![(0.2, 0.8), (5.2, 5.8), (20.0, 20.5), (20.6, 21.0)];
        assert_eq!(project_speaker_clusters(&spans, &ranges), vec![Some(0), Some(1), Some(1), Some(1)]);
    }

    /// With no spans, projection is a pure no-op: it must not invent a speaker for any word.
    #[test]
    fn speaker_projection_without_ranges_is_a_no_op() {
        assert_eq!(project_speaker_clusters(&word_grid(3), &[]), vec![None, None, None]);
        assert!(project_speaker_clusters(&[], &[speaker_range(0.0, 1.0, 0)]).is_empty());
    }
}
