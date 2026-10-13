//! Cross-chunk speaker merging for MOSS. MOSS generates chunk by chunk, and `S01` only means 'the first person in this chunk'; same-named labels across chunks have no relation. Here speaker embeddings (WeSpeaker) are used to merge each chunk's local clusters into global speakers, and the global labels are written back to `row.speaker`. Ported verbatim from the `merge_moss_speakers` family in v2 `ccut-transcribe`; the embedding model is provided by the caller ([`SpeakerEmbedding`]), and files are not looked up here.
//!
//! If any step does not hold, the original per-chunk labels are kept and returned as-is: merging must never discard a completed transcription.

use std::collections::{BTreeMap, HashMap, HashSet};

use super::speaker_cluster::{DEFAULT_MERGE_THRESHOLD, SpeakerUnit, merge_speaker_units_capped};
use super::{RowIn, SpeakerEmbedding, SpeakerRange};
use crate::SAMPLE_RATE;

/// Each merge unit takes at most this many seconds of audio for its embedding.
pub const SPEAKER_UNIT_MAX_SECONDS: f64 = 30.0;
/// Units with fewer than this many samples (0.5 seconds) do not get an embedding and each occupy their own speaker.
pub const SPEAKER_UNIT_MIN_SAMPLES: usize = 8_000;

/// Result of one merge (lets the caller decide whether to raise a warning or record provenance).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpeakerMerge {
    /// No speaker intervals; nothing to do.
    Nothing,
    /// Speaker-labelled rows do not line up with the intervals: keep the chunk labels.
    Mismatched,
    /// No usable embedding model: keep the chunk labels.
    EmbedderUnavailable,
    /// Merge complete: number of units, number of units that got an embedding, and number of speakers after merging.
    Merged { units: usize, embedded: usize, speakers: usize },
}

/// Merges `speaker_ranges` by embedding and writes back `rows[].speaker` (`S01`, `S02`, …). `embedder` being `None` means the embedding model is entirely unavailable (this step degrades). No speaker-count cap is passed: in v2 the count was only a hint, and the engine does not hard-truncate it.
pub fn merge_moss_speakers(
    rows: &mut [RowIn],
    speaker_ranges: &mut [SpeakerRange],
    samples: &[f32],
    embedder: Option<&mut dyn SpeakerEmbedding>,
    threshold: f32,
    max_speakers: Option<usize>,
) -> SpeakerMerge {
    if speaker_ranges.is_empty() {
        return SpeakerMerge::Nothing;
    }
    // On the MOSS path, the speaker-labelled rows and speaker_ranges are pushed in pairs in the same loop of adapt_output, so they have the same order and length. This is the only basis for writing back labels, so validate first before acting.
    let Some(paired) = paired_speaker_rows(rows, speaker_ranges) else {
        return SpeakerMerge::Mismatched;
    };
    if paired.is_empty() {
        return SpeakerMerge::Nothing;
    }
    let Some(embedder) = embedder else {
        return SpeakerMerge::EmbedderUnavailable;
    };
    let (mut units, audio) = build_speaker_units(speaker_ranges, samples);
    let embeddings = embed_speaker_units(embedder, &audio);
    let embedded = embeddings.iter().filter(|slot| slot.is_some()).count();
    for (unit, embedding) in units.iter_mut().zip(embeddings) {
        unit.embedding = embedding;
    }
    let assignments = speaker_assignments(&units, threshold, max_speakers);
    let mut final_id = HashMap::new();
    for (unit, assigned) in units.iter().zip(&assignments) {
        final_id.insert(unit.local_cluster, *assigned);
    }
    let speakers = assignments.iter().copied().collect::<HashSet<_>>().len();
    for (row_index, range) in paired.iter().zip(speaker_ranges.iter_mut()) {
        let Some(assigned) = final_id.get(&range.cluster).copied() else {
            continue;
        };
        range.cluster = assigned;
        rows[*row_index].speaker = Some(format!("S{:02}", assigned + 1));
    }
    SpeakerMerge::Merged {
        units: units.len(),
        embedded,
        speakers,
    }
}

/// Validates the pairing invariant between the speaker-labelled rows and `speaker_ranges`, and returns the indices of the paired rows.
///
/// If the lengths differ, or if any pair's start offset deviates by more than 0.5 seconds, the invariant is considered broken (returns `None`).
pub fn paired_speaker_rows(rows: &[RowIn], speaker_ranges: &[SpeakerRange]) -> Option<Vec<usize>> {
    let paired = rows
        .iter()
        .enumerate()
        .filter(|(_, row)| row.speaker.is_some())
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    if paired.len() != speaker_ranges.len() {
        return None;
    }
    if paired
        .iter()
        .zip(speaker_ranges)
        .any(|(row_index, range)| (range.start - rows[*row_index].start).abs() > 0.5)
    {
        return None;
    }
    Some(paired)
}

/// Groups `speaker_ranges` into merge units by local clustering, and assembles length-limited audio for each unit.
pub fn build_speaker_units(speaker_ranges: &[SpeakerRange], samples: &[f32]) -> (Vec<SpeakerUnit>, Vec<Vec<f32>>) {
    let cap = (SPEAKER_UNIT_MAX_SECONDS * f64::from(SAMPLE_RATE)) as usize;
    // BTreeMap ensures the unit order is determined only by the cluster number, independent of HashMap's random iteration.
    let mut order = BTreeMap::new();
    let mut units: Vec<SpeakerUnit> = Vec::new();
    let mut audio: Vec<Vec<f32>> = Vec::new();
    for range in speaker_ranges {
        let slot = *order.entry(range.cluster).or_insert_with(|| {
            units.push(SpeakerUnit {
                chunk: range.chunk,
                local_cluster: range.cluster,
                embedding: None,
                first_start: range.start,
            });
            audio.push(Vec::new());
            units.len() - 1
        });
        units[slot].first_start = units[slot].first_start.min(range.start);
        if audio[slot].len() >= cap {
            continue;
        }
        let start = ((range.start.max(0.0) * f64::from(SAMPLE_RATE)) as usize).min(samples.len());
        let end = ((range.end.max(0.0) * f64::from(SAMPLE_RATE)) as usize).clamp(start, samples.len());
        let take = (cap - audio[slot].len()).min(end - start);
        audio[slot].extend_from_slice(&samples[start..start + take]);
    }
    (units, audio)
}

/// Merge threshold: overridable via `CCUT_SPEAKER_MERGE_THRESHOLD` (for diagnostics); invalid or out-of-range values fall back to the default.
pub fn speaker_merge_threshold() -> f32 {
    std::env::var("CCUT_SPEAKER_MERGE_THRESHOLD")
        .ok()
        .and_then(|raw| raw.trim().parse::<f32>().ok())
        .filter(|value| value.is_finite() && *value > 0.0 && *value < 2.0)
        .unwrap_or(DEFAULT_MERGE_THRESHOLD)
}

/// Merges cross-chunk voiceprints using the chosen threshold, and where there is safe room to merge, tries to converge to the speaker-count cap. Units that the model has already judged to be different people within the same chunk are still not forced together, so the cap is a safety target rather than a hard truncation that destroys separation evidence (the cap semantics are implemented in exactly one place: `merge_speaker_units_capped`).
pub fn speaker_assignments(units: &[SpeakerUnit], threshold: f32, max_speakers: Option<usize>) -> Vec<usize> {
    merge_speaker_units_capped(units, threshold.clamp(0.01, 1.99), max_speakers.filter(|count| *count > 0))
}

/// Extracts a voiceprint embedding unit by unit. If a single unit fails (for example, audio too short), it is set to `None`, and that unit occupies its own speaker.
fn embed_speaker_units(embedder: &mut dyn SpeakerEmbedding, audio: &[Vec<f32>]) -> Vec<Option<Vec<f32>>> {
    audio
        .iter()
        .map(|unit| {
            if unit.len() < SPEAKER_UNIT_MIN_SAMPLES {
                return None;
            }
            embedder.embed(unit).ok()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn range(start: f64, end: f64, cluster: usize, chunk: usize) -> SpeakerRange {
        SpeakerRange {
            start,
            end,
            cluster,
            chunk,
        }
    }

    fn row(start: f64, end: f64, speaker: &str) -> RowIn {
        let mut row = RowIn::new(start, end, "text");
        row.speaker = Some(speaker.to_owned());
        row
    }

    /// Gives embeddings based on the first sample value of each unit's audio: units with the same value are the same person.
    struct ByFirstSample;

    impl SpeakerEmbedding for ByFirstSample {
        fn embed(&mut self, samples: &[f32]) -> anyhow::Result<Vec<f32>> {
            Ok(if samples[0] > 0.0 { vec![1.0, 0.0] } else { vec![0.0, 1.0] })
        }
    }

    /// Two chunks, two people each; the second chunk's S01 is actually the first chunk's S02. After merging there are only two people globally, and labels are written back with global numbering.
    #[test]
    fn merges_local_clusters_across_chunks() {
        let rate = SAMPLE_RATE as usize;
        let mut samples = vec![0.0_f32; 40 * rate];
        // 0–10 s and 30–40 s are A (positive values), 10–30 s is B (negative values).
        samples[..10 * rate].fill(0.5);
        samples[10 * rate..30 * rate].fill(-0.5);
        samples[30 * rate..].fill(0.5);
        let mut rows = vec![
            row(0.0, 10.0, "S01"),
            row(10.0, 20.0, "S02"),
            row(20.0, 30.0, "S01"),
            row(30.0, 40.0, "S02"),
        ];
        let mut ranges = vec![
            range(0.0, 10.0, 0, 0),
            range(10.0, 20.0, 1, 0),
            range(20.0, 30.0, 2, 1),
            range(30.0, 40.0, 3, 1),
        ];
        let outcome = merge_moss_speakers(
            &mut rows,
            &mut ranges,
            &samples,
            Some(&mut ByFirstSample),
            DEFAULT_MERGE_THRESHOLD,
            None,
        );
        assert_eq!(
            outcome,
            SpeakerMerge::Merged {
                units: 4,
                embedded: 4,
                speakers: 2
            }
        );
        let labels: Vec<_> = rows.iter().map(|row| row.speaker.clone().unwrap()).collect();
        assert_eq!(labels[0], labels[3]);
        assert_eq!(labels[1], labels[2]);
        assert_ne!(labels[0], labels[1]);
    }

    #[test]
    fn keeps_chunk_labels_without_an_embedder_or_when_rows_do_not_pair() {
        let samples = vec![0.5_f32; 20 * SAMPLE_RATE as usize];
        let mut rows = vec![row(0.0, 10.0, "S01"), row(10.0, 20.0, "S01")];
        let mut ranges = vec![range(0.0, 10.0, 0, 0), range(10.0, 20.0, 1, 1)];
        assert_eq!(
            merge_moss_speakers(&mut rows, &mut ranges, &samples, None, DEFAULT_MERGE_THRESHOLD, None),
            SpeakerMerge::EmbedderUnavailable
        );
        let mut shifted = vec![range(3.0, 10.0, 0, 0), range(10.0, 20.0, 1, 1)];
        assert_eq!(
            merge_moss_speakers(
                &mut rows,
                &mut shifted,
                &samples,
                Some(&mut ByFirstSample),
                DEFAULT_MERGE_THRESHOLD,
                None
            ),
            SpeakerMerge::Mismatched
        );
        assert_eq!(
            merge_moss_speakers(
                &mut rows,
                &mut [],
                &samples,
                Some(&mut ByFirstSample),
                DEFAULT_MERGE_THRESHOLD,
                None
            ),
            SpeakerMerge::Nothing
        );
        assert!(rows.iter().all(|row| row.speaker.as_deref() == Some("S01")));
    }

    /// Unit audio is grouped by cluster number and length-limited; units that are too short do not get an embedding.
    #[test]
    fn speaker_units_group_by_cluster_and_cap_audio() {
        let rate = SAMPLE_RATE as usize;
        let samples = vec![0.1_f32; 100 * rate];
        let ranges = vec![range(0.0, 20.0, 1, 0), range(20.0, 20.2, 0, 0), range(40.0, 60.0, 1, 0)];
        let (units, audio) = build_speaker_units(&ranges, &samples);
        assert_eq!(units.iter().map(|unit| unit.local_cluster).collect::<Vec<_>>(), vec![1, 0]);
        assert_eq!(audio[0].len(), (SPEAKER_UNIT_MAX_SECONDS as usize) * rate);
        assert!(audio[1].len() < SPEAKER_UNIT_MIN_SAMPLES);
        let embedded = embed_speaker_units(&mut ByFirstSample, &audio);
        assert!(embedded[0].is_some() && embedded[1].is_none());
    }
}
