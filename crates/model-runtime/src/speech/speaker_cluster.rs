//! Pure-logic clustering that merges speakers across chunks.
//!
//! When long audio is transcribed chunk by chunk, each chunk only knows its own local speaker numbers.
//! This module treats each chunk's local clusters as “units”, and uses constrained agglomerative clustering (centroid
//! linkage) to merge the units of the same person globally:
//!
//! - Two units in the same chunk come from the same local clustering run, so they have already been judged to be different people,
//!   and merging them is never allowed; this constraint keeps propagating after a merge as the union of the chunk sets.
//! - Units without an embedding (audio too short to yield a vector) take no part in distance computation; each keeps its own id.
//! - The whole pipeline has no I/O and no float-keyed sorted containers, so the same input always produces the same output.
//!
//! Ported unchanged from the v2 module of the same name; behaviour and thresholds are unchanged.

use std::collections::BTreeSet;

/// The smallest unit that takes part in cross-chunk merging: one local cluster within a chunk.
#[derive(Debug, Clone, PartialEq)]
pub struct SpeakerUnit {
    /// Source chunk index; units from the same chunk are mutually exclusive and never merge.
    pub chunk: usize,
    /// Local cluster id within the chunk (already shifted to a global numbering); this module only passes it through and does not use it in decisions.
    pub local_cluster: usize,
    /// Speaker embedding; `None` means the audio was too short and no embedding was extracted, so the unit never takes part in merging.
    pub embedding: Option<Vec<f32>>,
    /// The earliest speaking time of this unit, used to sort the final labels.
    pub first_start: f64,
}

/// Default merge threshold, in cosine distance (0..=2); merge only when the distance is strictly less than this value.
pub const DEFAULT_MERGE_THRESHOLD: f32 = 0.715;

/// Cumulative-duration threshold, in seconds, for identifying “orphan clusters”; see
/// [`merge_speaker_units_with_durations`].
///
/// The 2-second value follows Pyannote's sampling scheme: with a 10-second window and a 5-second step, every second of real speech is picked up by two adjacent windows, so a cluster's cumulative duration is about twice its real duration. A cluster under 2 seconds actually owns less than 1 second of speech, which is where short-turn misjudgments are most frequent.
pub const DEFAULT_MIN_CLUSTER_SECONDS: f64 = 2.0;

/// Cosine distance, with values in the closed interval 0..=2.
///
/// An empty vector, mismatched dimensions, or a denominator ≤ 1e-10 (either side being close to the zero vector) all return 2.0, i.e. “farthest”, so such a pair is never merged under any normal threshold.
pub fn cosine_distance(first: &[f32], second: &[f32]) -> f32 {
    if first.is_empty() || first.len() != second.len() {
        return 2.0;
    }
    let mut dot = 0.0f32;
    let mut first_norm = 0.0f32;
    let mut second_norm = 0.0f32;
    for (left, right) in first.iter().zip(second.iter()) {
        dot += left * right;
        first_norm += left * left;
        second_norm += right * right;
    }
    let denominator = first_norm.sqrt() * second_norm.sqrt();
    // Written as a positive comparison: NaN makes `usable` false, which likewise falls to 2.0.
    let usable = denominator > 1e-10;
    if !usable {
        return 2.0;
    }
    1.0 - dot / denominator
}

/// Merges the cross-chunk speaker units into global clusters and returns the final cluster id of each unit.
///
/// The ids are compacted to a contiguous `0..K` and assigned in ascending order of each cluster's earliest `first_start`,
/// so id 0 (displayed as S01) is always the speaker who speaks first.
pub fn merge_speaker_units(units: &[SpeakerUnit], threshold: f32) -> Vec<usize> {
    cluster_speaker_units(units, threshold, None, None).assignment
}

/// Same as [`merge_speaker_units`], but additionally caps the final cluster count to `max_clusters`.
///
/// After the threshold loop ends, if the cluster count still exceeds the cap, keep merging the closest pair whose chunks do not conflict,
/// until the cap is met or no mergeable pair remains (the same-chunk constraint always takes priority over the cap).
///
/// Note: units without an embedding each keep their own id and count toward the cap, but they can never be merged. A caller that needs a hard cap should therefore pass only units that have embeddings.
pub fn merge_speaker_units_capped(units: &[SpeakerUnit], threshold: f32, max_clusters: Option<usize>) -> Vec<usize> {
    cluster_speaker_units(units, threshold, max_clusters, None).assignment
}

/// Same as [`merge_speaker_units_capped`], plus “orphan cluster reassignment”.
///
/// `unit_seconds[i]` is the speech duration (seconds) of `units[i]`. After the threshold loop ends, a cluster whose cumulative duration is below `min_cluster_seconds` is judged an orphan:
/// each of its units is merged into the nearest “large cluster” by voiceprint distance, skipping candidates that have a chunk conflict; a unit that finds no target is kept where it is.
///
/// Why this step is needed: same-chunk exclusion is a **whole-cluster** constraint. Two clusters that each have one unit in the same chunk can never be merged, even if their other units have identical voiceprints. When this constraint blocks a real speaker from merging, the speaker shatters into several clusters of only one or two seconds each, pushing the speaker count to twice the true value. Here the constraint is relaxed to the **unit level** (a unit may join a target cluster as long as the target does not already contain that unit's own chunk). This breaks the whole-cluster deadlock while keeping the hard fact the model provides: two local speakers in the same window are not the same person.
///
/// Determinism: all distances are computed against the **centroids frozen before reassignment begins**, and the processing order is fixed: orphan cluster id ascending, then unit index within the cluster ascending, so the same input always produces the same output.
///
/// If `unit_seconds` does not match `units` in length, or `min_cluster_seconds <= 0`, this function is equivalent to [`merge_speaker_units_capped`].
pub fn merge_speaker_units_with_durations(
    units: &[SpeakerUnit],
    threshold: f32,
    max_clusters: Option<usize>,
    unit_seconds: &[f64],
    min_cluster_seconds: f64,
) -> Vec<usize> {
    let orphan = (unit_seconds.len() == units.len() && min_cluster_seconds > 0.0).then_some(OrphanRule {
        unit_seconds,
        min_cluster_seconds,
        // An orphan may only join a cluster that was already close enough and is blocked only by the same-chunk exclusion. Without this cap,
        // every small cluster would be absorbed by its nearest large cluster no matter how far away it is, and the sensitivity knob would stop working (aggressive and balanced would produce byte-identical output).
        max_distance: threshold,
    });
    cluster_speaker_units(units, threshold, max_clusters, orphan).assignment
}

/// Orphan cluster reassignment rule; see [`merge_speaker_units_with_durations`].
#[derive(Debug, Clone, Copy)]
struct OrphanRule<'a> {
    unit_seconds: &'a [f64],
    min_cluster_seconds: f64,
    /// Maximum cosine distance at which an orphan unit may merge into a large cluster; beyond it, the original cluster is kept.
    max_distance: f32,
}

/// Clustering result; `centroids[id]` aligns with the final id, and units without an embedding are `None`.
#[derive(Debug, Clone, PartialEq)]
struct ClusterOutcome {
    assignment: Vec<usize>,
    centroids: Vec<Option<Vec<f32>>>,
}

/// Internal implementation; additionally exposes the merged centroids so tests can assert the weighted-average semantics.
fn cluster_speaker_units(
    units: &[SpeakerUnit],
    threshold: f32,
    max_clusters: Option<usize>,
    orphan: Option<OrphanRule<'_>>,
) -> ClusterOutcome {
    if units.is_empty() {
        return ClusterOutcome {
            assignment: Vec::new(),
            centroids: Vec::new(),
        };
    }

    // Uses the dimension of the first non-empty embedding. Units whose dimension does not match, or that are empty, degrade to “no embedding”:
    // they take part neither in the distance matrix nor in the centroid weighted average, which always runs on equal-length vectors.
    let dimension = units
        .iter()
        .filter_map(|unit| unit.embedding.as_deref())
        .map(<[f32]>::len)
        .find(|&len| len > 0);
    let mut clusterable = vec![false; units.len()];
    let mut seeds: Vec<usize> = Vec::new();
    if let Some(dimension) = dimension {
        for (index, unit) in units.iter().enumerate() {
            if unit.embedding.as_deref().is_some_and(|embedding| embedding.len() == dimension) {
                clusterable[index] = true;
                seeds.push(index);
            }
        }
    }

    let count = seeds.len();
    let mut centroids: Vec<Vec<f32>> = seeds
        .iter()
        .map(|&index| units[index].embedding.clone().unwrap_or_default())
        .collect();
    let mut members: Vec<Vec<usize>> = seeds.iter().map(|&index| vec![index]).collect();
    let mut chunks: Vec<BTreeSet<usize>> = seeds.iter().map(|&index| BTreeSet::from([units[index].chunk])).collect();
    let mut active = vec![true; count];
    let mut active_count = count;
    // Units without an embedding always form their own cluster and count toward the final cluster count, and therefore toward the cap.
    let solo_count = units.len() - count;

    // A cluster-pair distance changes only when one side is merged, so the symmetric matrix is cached and each round refreshes only the surviving rows.
    let mut distances = vec![f32::INFINITY; count * count];
    for first in 0..count {
        for second in (first + 1)..count {
            if units[seeds[first]].chunk == units[seeds[second]].chunk {
                continue;
            }
            let distance = cosine_distance(&centroids[first], &centroids[second]);
            distances[first * count + second] = distance;
            distances[second * count + first] = distance;
        }
    }

    while active_count > 1 {
        // A linear scan in index order with a strict less-than comparison naturally lets the pair that appears first win ties.
        let mut best_distance = f32::MAX;
        let mut best_first = usize::MAX;
        let mut best_second = usize::MAX;
        for first in 0..count {
            if !active[first] {
                continue;
            }
            for second in (first + 1)..count {
                if !active[second] {
                    continue;
                }
                let distance = distances[first * count + second];
                if distance < best_distance {
                    best_distance = distance;
                    best_first = first;
                    best_second = second;
                }
            }
        }
        // Merge only when strictly less than; if the threshold or distance is NaN, `mergeable` is false.
        // When the cluster count is above the cap, relax the threshold and keep merging the nearest pair (infinity = same-chunk conflict is a hard constraint and is never allowed in any case).
        let over_cap = max_clusters.is_some_and(|cap| active_count + solo_count > cap);
        let mergeable = best_distance < threshold || (over_cap && best_distance.is_finite());
        if best_first == usize::MAX || !mergeable {
            break;
        }

        let first_size = members[best_first].len() as f32;
        let second_size = members[best_second].len() as f32;
        let combined_size = first_size + second_size;
        let merged: Vec<f32> = centroids[best_first]
            .iter()
            .zip(centroids[best_second].iter())
            .map(|(left, right)| (left * first_size + right * second_size) / combined_size)
            .collect();
        centroids[best_first] = merged;

        let absorbed = std::mem::take(&mut members[best_second]);
        members[best_first].extend(absorbed);
        let absorbed_chunks = std::mem::take(&mut chunks[best_second]);
        chunks[best_first].extend(absorbed_chunks);
        active[best_second] = false;
        active_count -= 1;

        for other in 0..count {
            if !active[other] || other == best_first {
                continue;
            }
            let distance = if chunks[best_first].is_disjoint(&chunks[other]) {
                cosine_distance(&centroids[best_first], &centroids[other])
            } else {
                f32::INFINITY
            };
            distances[best_first * count + other] = distance;
            distances[other * count + best_first] = distance;
        }
    }

    if let Some(rule) = orphan {
        reassign_orphan_clusters(units, rule, &active, &mut members, &mut chunks, &mut centroids);
        // A cluster whose units have all been moved out is no longer a speaker.
        for cluster in 0..count {
            if members[cluster].is_empty() {
                active[cluster] = false;
            }
        }
    }

    // The surviving clusters and the units without an embedding are compacted into contiguous ids in ascending order of the earliest `first_start` in each group.
    struct Group {
        first_start: f64,
        anchor: usize,
        members: Vec<usize>,
        centroid: Option<Vec<f32>>,
    }
    let mut groups: Vec<Group> = Vec::new();
    for cluster in 0..count {
        if !active[cluster] {
            continue;
        }
        let mut cluster_members = std::mem::take(&mut members[cluster]);
        cluster_members.sort_unstable();
        let first_start = cluster_members
            .iter()
            .map(|&index| units[index].first_start)
            .min_by(f64::total_cmp)
            .unwrap_or(f64::INFINITY);
        groups.push(Group {
            first_start,
            anchor: cluster_members[0],
            members: cluster_members,
            centroid: Some(centroids[cluster].clone()),
        });
    }
    for (index, unit) in units.iter().enumerate() {
        if clusterable[index] {
            continue;
        }
        groups.push(Group {
            first_start: unit.first_start,
            anchor: index,
            members: vec![index],
            centroid: None,
        });
    }
    // When `first_start` is equal, the smallest unit index breaks the tie, so the order is fully deterministic.
    groups.sort_by(|left, right| left.first_start.total_cmp(&right.first_start).then(left.anchor.cmp(&right.anchor)));

    let mut assignment = vec![0usize; units.len()];
    let mut out_centroids = Vec::with_capacity(groups.len());
    for (id, group) in groups.iter().enumerate() {
        for &member in &group.members {
            assignment[member] = id;
        }
        out_centroids.push(group.centroid.clone());
    }
    ClusterOutcome {
        assignment,
        centroids: out_centroids,
    }
}

/// Breaks up orphan clusters whose cumulative duration is insufficient, and merges each unit into the nearest large cluster by voiceprint distance.
///
/// Distances are always computed against a **frozen snapshot** of `centroids`, so the processing order affects only the chunk-conflict decisions, not the distances themselves. The order is fixed: orphan cluster id ascending, then unit index within the cluster ascending.
fn reassign_orphan_clusters(
    units: &[SpeakerUnit],
    rule: OrphanRule<'_>,
    active: &[bool],
    members: &mut [Vec<usize>],
    chunks: &mut [BTreeSet<usize>],
    centroids: &mut [Vec<f32>],
) {
    let count = members.len();
    let frozen: Vec<Vec<f32>> = centroids.to_vec();
    let totals: Vec<f64> = (0..count)
        .map(|cluster| members[cluster].iter().map(|&index| rule.unit_seconds[index]).sum())
        .collect();
    let targets: Vec<usize> = (0..count)
        .filter(|&cluster| active[cluster] && !members[cluster].is_empty() && totals[cluster] >= rule.min_cluster_seconds)
        .collect();
    if targets.is_empty() {
        return;
    }

    for orphan in 0..count {
        if !active[orphan] || members[orphan].is_empty() || totals[orphan] >= rule.min_cluster_seconds {
            continue;
        }
        let mut kept: Vec<usize> = Vec::new();
        let mut moving = std::mem::take(&mut members[orphan]);
        moving.sort_unstable();
        for index in moving {
            let Some(embedding) = units[index].embedding.as_deref() else {
                kept.push(index);
                continue;
            };
            let mut best: Option<(f32, usize)> = None;
            for &target in &targets {
                // Two local speakers in the same window have already been judged by the model to be different people. This hard fact still holds at the unit level;
                // it just no longer requires the whole clusters' chunk sets to be disjoint.
                if chunks[target].contains(&units[index].chunk) {
                    continue;
                }
                let distance = cosine_distance(embedding, &frozen[target]);
                if !distance.is_finite() || distance >= rule.max_distance {
                    continue;
                }
                // Strict less-than lets the scan order (cluster id ascending) win ties.
                if best.is_none_or(|(current, _)| distance < current) {
                    best = Some((distance, target));
                }
            }
            let Some((_, target)) = best else {
                kept.push(index);
                continue;
            };
            let size = members[target].len() as f32;
            if centroids[target].len() == embedding.len() {
                for (slot, value) in centroids[target].iter_mut().zip(embedding) {
                    *slot = (*slot * size + value) / (size + 1.0);
                }
            }
            members[target].push(index);
            chunks[target].insert(units[index].chunk);
        }
        members[orphan] = kept;
    }

    for cluster_members in members.iter_mut().take(count) {
        cluster_members.sort_unstable();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unit(chunk: usize, embedding: &[f32], first_start: f64) -> SpeakerUnit {
        SpeakerUnit {
            chunk,
            local_cluster: chunk * 10,
            embedding: Some(embedding.to_vec()),
            first_start,
        }
    }

    fn silent_unit(chunk: usize, first_start: f64) -> SpeakerUnit {
        SpeakerUnit {
            chunk,
            local_cluster: chunk * 10,
            embedding: None,
            first_start,
        }
    }

    fn assert_vec_close(actual: &[f32], expected: &[f32]) {
        assert_eq!(actual.len(), expected.len(), "{actual:?} != {expected:?}");
        for (left, right) in actual.iter().zip(expected) {
            assert!((left - right).abs() <= 1e-6, "{actual:?} != {expected:?} ± 1e-6");
        }
    }

    #[test]
    fn three_speakers_merge_across_chunks_and_sort_by_first_speech() {
        // Three nearly orthogonal speakers: the same person across chunks has a distance of ≈0.02, different people have distances of ≈0.8~1.0.
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 10.0),  // A@chunk0
            unit(0, &[0.0, 1.0, 0.0], 5.0),   // B@chunk0
            unit(0, &[0.0, 0.0, 1.0], 1.0),   // C@chunk0
            unit(1, &[0.98, 0.2, 0.0], 30.0), // A@chunk1
            unit(1, &[0.2, 0.98, 0.0], 25.0), // B@chunk1
            unit(1, &[0.0, 0.2, 0.98], 21.0), // C@chunk1
        ];
        assert!(cosine_distance(&[1.0, 0.0, 0.0], &[0.98, 0.2, 0.0]) < DEFAULT_MERGE_THRESHOLD);
        assert!(cosine_distance(&[1.0, 0.0, 0.0], &[0.2, 0.98, 0.0]) > DEFAULT_MERGE_THRESHOLD);

        // C speaks first → 0, then B → 1, and A last → 2.
        assert_eq!(merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD), vec![2, 1, 0, 2, 1, 0]);
    }

    #[test]
    fn identical_embeddings_in_same_chunk_never_merge() {
        let units = vec![unit(0, &[1.0, 0.0], 4.0), unit(0, &[1.0, 0.0], 2.0), unit(0, &[1.0, 0.0], 9.0)];
        assert_eq!(merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD), vec![1, 0, 2]);
    }

    #[test]
    fn merged_chunk_sets_keep_blocking_further_merges() {
        // After A(chunk0) and B(chunk1) merge, their chunk set is {0,1}, so even if C(chunk1) has distance 0 it must not be merged in.
        let units = vec![unit(0, &[1.0, 0.0], 0.0), unit(1, &[1.0, 0.0], 1.0), unit(1, &[1.0, 0.0], 2.0)];
        assert_eq!(merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD), vec![0, 0, 1]);
    }

    #[test]
    fn units_without_embedding_stay_alone_but_join_ordering() {
        let units = vec![
            silent_unit(0, 5.0),
            unit(0, &[1.0, 0.0], 10.0),
            unit(1, &[1.0, 0.0], 1.0),
            silent_unit(1, 0.5),
        ];
        // The merged cluster's earliest time is 1.0; the silent units are 0.5 and 5.0.
        assert_eq!(merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD), vec![2, 1, 1, 0]);
    }

    #[test]
    fn distance_exactly_at_threshold_does_not_merge() {
        let units = vec![unit(0, &[1.0, 0.0], 0.0), unit(1, &[0.0, 1.0], 1.0)];
        assert_eq!(cosine_distance(&[1.0, 0.0], &[0.0, 1.0]), 1.0);
        // Merge only when strictly less than.
        assert_eq!(merge_speaker_units(&units, 1.0), vec![0, 1]);
        assert_eq!(merge_speaker_units(&units, 1.000_001), vec![0, 0]);
    }

    #[test]
    fn centroid_uses_size_weighted_average_without_renormalizing() {
        let units = vec![unit(0, &[2.0, 0.0], 0.0), unit(1, &[2.0, 2.0], 1.0), unit(2, &[0.0, 2.0], 2.0)];
        // Round 1: d(0,1)=d(1,2)≈0.29289; the scan order lets (0,1) win first → centroid [2,1].
        // Round 2: [2,1](size 2) and [0,2](size 1) have a distance ≈0.55279 < 0.6 → merge, centroid = ([2,1]*2 + [0,2]*1)/3 = [4/3, 4/3].
        // If the centroid were wrongly re-L2-normalized it would be [0.7071, 0.7071]; if it were a equal-weight average it would be [1.0, 1.5]. Both would be rejected by the assertions below.
        let outcome = cluster_speaker_units(&units, 0.6, None, None);
        assert_eq!(outcome.assignment, vec![0, 0, 0]);
        assert_eq!(outcome.centroids.len(), 1);
        assert_vec_close(outcome.centroids[0].as_deref().expect("centroid"), &[4.0 / 3.0, 4.0 / 3.0]);
    }

    #[test]
    fn zero_and_mismatched_embeddings_never_merge() {
        assert_eq!(cosine_distance(&[0.0, 0.0], &[1.0, 0.0]), 2.0);
        assert_eq!(cosine_distance(&[1.0, 0.0], &[1.0, 0.0, 0.0]), 2.0);
        assert_eq!(cosine_distance(&[], &[]), 2.0);

        let units = vec![
            unit(0, &[1.0, 0.0], 0.0),
            unit(1, &[1.0, 0.0, 0.0], 1.0), // Dimension mismatch → degrades to no embedding
            unit(2, &[0.0, 0.0], 2.0),      // Zero vector → distance is always 2.0
        ];
        assert_eq!(merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD), vec![0, 1, 2]);
    }

    #[test]
    fn degenerate_inputs_are_handled() {
        assert!(merge_speaker_units(&[], DEFAULT_MERGE_THRESHOLD).is_empty());
        assert_eq!(merge_speaker_units(&[unit(0, &[1.0, 0.0], 3.0)], DEFAULT_MERGE_THRESHOLD), vec![0]);
        assert_eq!(merge_speaker_units(&[silent_unit(0, 3.0)], DEFAULT_MERGE_THRESHOLD), vec![0]);
        assert_eq!(
            merge_speaker_units(
                &[silent_unit(0, 8.0), silent_unit(1, 2.0), silent_unit(2, 5.0)],
                DEFAULT_MERGE_THRESHOLD
            ),
            vec![2, 0, 1]
        );
    }

    #[test]
    fn cap_keeps_merging_nearest_clusters_beyond_threshold() {
        // Three speakers far from one another (pairwise distance 1.0 > threshold); with no cap, three clusters remain.
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 0.0),
            unit(1, &[0.0, 1.0, 0.0], 1.0),
            unit(2, &[0.0, 0.0, 1.0], 2.0),
        ];
        assert_eq!(merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, None), vec![0, 1, 2]);
        // With a cap of 2, keep merging the nearest pair: the distances are all equal, so the scan order lets (0,1) win first.
        assert_eq!(merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, Some(2)), vec![0, 0, 1]);
        assert_eq!(merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, Some(1)), vec![0, 0, 0]);
        // When the cap is wider than the actual cluster count, no extra merges happen.
        assert_eq!(merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, Some(9)), vec![0, 1, 2]);
    }

    #[test]
    fn cap_never_overrides_same_chunk_constraint() {
        // All three units are in chunk 0, so the exclusion constraint is hard: they cannot be merged even with a cap of 1.
        let units = vec![unit(0, &[1.0, 0.0], 0.0), unit(0, &[1.0, 0.0], 1.0), unit(0, &[1.0, 0.0], 2.0)];
        assert_eq!(merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, Some(1)), vec![0, 1, 2]);
    }

    #[test]
    fn symmetric_input_has_fixed_tie_break_and_is_deterministic() {
        // Four identical embeddings spread across two chunks: all distances are 0, so the scan order decides the winner.
        // (0,1) merges first, the chunk set becomes {0,1}, and the remaining (2,3) can only form a cluster of their own.
        let units = vec![
            unit(0, &[1.0, 0.0], 3.0),
            unit(1, &[1.0, 0.0], 4.0),
            unit(0, &[1.0, 0.0], 1.0),
            unit(1, &[1.0, 0.0], 2.0),
        ];
        let first = merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD);
        let second = merge_speaker_units(&units, DEFAULT_MERGE_THRESHOLD);
        assert_eq!(first, second);
        assert_eq!(first, vec![1, 1, 0, 0]);
    }

    /// Two speakers each occupy two chunks, plus a fragment of only 0.5 seconds whose voiceprint noise pushed beyond the threshold.
    /// Threshold clustering necessarily gives it its own id; orphan reassignment should merge it back into the nearest large cluster.
    #[test]
    fn orphan_cluster_joins_nearest_large_cluster() {
        // A = {u0, u1}; O = {u2, u3}. The centroid distance between O and A is close enough, but u2 in O and u0 in A both belong to chunk 0,
        // so whole-cluster exclusion blocks the merge. Reassignment at the unit level relaxes this: u3 (chunk 2, which A does not have) may join A, while u2 stays in its original cluster.
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 0.0),
            unit(1, &[1.0, 0.0, 0.0], 10.0),
            unit(0, &[1.0, 0.9, 0.0], 1.0),
            unit(2, &[1.0, 0.6, 0.0], 20.0),
        ];
        let seconds = vec![10.0, 10.0, 0.25, 0.25];
        let to_a = cosine_distance(&[1.0, 0.6, 0.0], &[1.0, 0.0, 0.0]);
        assert!(to_a < DEFAULT_MERGE_THRESHOLD);

        assert_eq!(merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, None), vec![0, 0, 1, 1]);
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, DEFAULT_MIN_CLUSTER_SECONDS),
            vec![0, 0, 1, 0]
        );
        // When the threshold is lowered below the fragment's duration, reassignment is no longer triggered.
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, 0.1),
            vec![0, 0, 1, 1]
        );
    }

    /// Distance cap: an orphan that is farther from the nearest large cluster than the merge threshold keeps its own identity and is not absorbed.
    /// Without this, every small cluster would be absorbed by its nearest large cluster, and the sensitivity knob would stop working.
    #[test]
    fn orphan_cluster_beyond_threshold_keeps_its_identity() {
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 0.0),
            unit(1, &[1.0, 0.0, 0.0], 10.0),
            unit(2, &[0.0, 1.0, 0.0], 20.0),
            unit(3, &[0.0, 1.0, 0.0], 30.0),
            unit(4, &[0.3, 0.2, 1.0], 40.0),
        ];
        let seconds = vec![10.0, 10.0, 10.0, 10.0, 0.5];
        // The fragment's distances to both large clusters exceed the merge threshold.
        let to_a = cosine_distance(&[0.3, 0.2, 1.0], &[1.0, 0.0, 0.0]);
        let to_b = cosine_distance(&[0.3, 0.2, 1.0], &[0.0, 1.0, 0.0]);
        assert!(to_a > DEFAULT_MERGE_THRESHOLD && to_b > DEFAULT_MERGE_THRESHOLD);

        assert_eq!(
            merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, None),
            vec![0, 0, 1, 1, 2]
        );
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, DEFAULT_MIN_CLUSTER_SECONDS),
            vec![0, 0, 1, 1, 2]
        );
    }

    /// When distances are exactly equal, the cluster's internal scan order decides the winner; repeated calls must give the same result.
    #[test]
    fn orphan_reassignment_tie_break_is_deterministic() {
        // A = {u0, u1}, B = {u2, u3}, orphan cluster O = {u4, u5, u6}. O's distances to A and B are equal and both within the threshold, but u5/u6 each share a chunk with A and B respectively,
        // so whole-cluster merging is blocked by exclusion. Unit-level reassignment processes in ascending index order: u4 (chunk 4, neither side has that chunk) ties and goes to A, the smaller id;
        // then u5 has only B left as a candidate, and u6 only A.
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 0.0),
            unit(1, &[1.0, 0.0, 0.0], 10.0),
            unit(2, &[0.0, 1.0, 0.0], 20.0),
            unit(3, &[0.0, 1.0, 0.0], 30.0),
            unit(4, &[1.0, 1.0, 0.0], 40.0),
            unit(0, &[1.0, 1.0, 0.0], 1.0),
            unit(2, &[1.0, 1.0, 0.0], 21.0),
        ];
        let seconds = vec![10.0, 10.0, 10.0, 10.0, 0.2, 0.2, 0.2];
        assert_eq!(
            cosine_distance(&[1.0, 1.0, 0.0], &[1.0, 0.0, 0.0]),
            cosine_distance(&[1.0, 1.0, 0.0], &[0.0, 1.0, 0.0])
        );
        assert!(cosine_distance(&[1.0, 1.0, 0.0], &[1.0, 0.0, 0.0]) < DEFAULT_MERGE_THRESHOLD);
        let first = merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, DEFAULT_MIN_CLUSTER_SECONDS);
        let second = merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, DEFAULT_MIN_CLUSTER_SECONDS);
        assert_eq!(first, second);
        assert_eq!(first, vec![0, 0, 1, 1, 0, 1, 0]);
    }

    /// When the target cluster already contains the chunk where the fragment sits, it must not absorb it: two local speakers in the same window
    /// are the model's hard fact that they are “different people”.
    #[test]
    fn orphan_reassignment_respects_same_chunk_constraint() {
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 0.0),
            unit(1, &[1.0, 0.0, 0.0], 10.0),
            unit(1, &[0.3, 0.2, 1.0], 12.0),
        ];
        let seconds = vec![10.0, 10.0, 0.5];
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, DEFAULT_MIN_CLUSTER_SECONDS),
            vec![0, 0, 1]
        );
    }

    /// If every cluster is an orphan there is no target to merge into, and the behaviour degrades to ordinary clustering.
    #[test]
    fn orphan_reassignment_needs_at_least_one_large_cluster() {
        let units = vec![unit(0, &[1.0, 0.0, 0.0], 0.0), unit(1, &[0.0, 1.0, 0.0], 1.0)];
        let seconds = vec![0.4, 0.4];
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &seconds, DEFAULT_MIN_CLUSTER_SECONDS),
            vec![0, 1]
        );
    }

    /// When the duration array length does not match or the duration threshold is non-positive, silently degrades to [`merge_speaker_units_capped`].
    #[test]
    fn orphan_reassignment_is_skipped_on_malformed_input() {
        let units = vec![
            unit(0, &[1.0, 0.0, 0.0], 0.0),
            unit(1, &[1.0, 0.0, 0.0], 10.0),
            unit(2, &[0.3, 0.2, 1.0], 40.0),
        ];
        let baseline = merge_speaker_units_capped(&units, DEFAULT_MERGE_THRESHOLD, None);
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &[10.0, 10.0], DEFAULT_MIN_CLUSTER_SECONDS),
            baseline
        );
        assert_eq!(
            merge_speaker_units_with_durations(&units, DEFAULT_MERGE_THRESHOLD, None, &[10.0, 10.0, 0.5], 0.0),
            baseline
        );
    }
}
