//! Deterministic cleanup of word timings (checked word for word against voice-ink's `WordTimingNormalization` /
//! `WordTimingRepair`).
//!
//! Repair is pure timing work and does not touch any stage stamp: the text fingerprint covers only the text and endpoint ids,
//! so timing repair can run at any time without disturbing the freshness of polish or translation.

use crate::asr_rows::WordIn;

use crate::doc::Word;

/// Round to centiseconds (`TranscriptModel.r2`): half-away-from-zero.
pub fn r2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

fn cs(x: f64) -> i64 {
    (r2(x) * 100.0).round() as i64
}

/// Normalizes one run of word timings: returns `None` unchanged when the run is healthy. When it is not, the whole run is re-stamped,
/// with every word guaranteed at least 1 tick, strictly increasing, and inside the window. When the window cannot fit 1 tick per word (`span < count`),
/// it also returns unchanged (the repair layer widens the window and retries).
fn normalized_slots(
    times: &[(f64, f64)],
    range_start: f64,
    range_end: f64,
) -> Option<Vec<(f64, f64)>> {
    if times.is_empty() {
        return None;
    }
    let lo = cs(range_start);
    let hi = cs(range_end);
    let span = hi - lo;
    let count = times.len() as i64;
    if span < count {
        return None;
    }
    let tick = |value: f64| -> i64 { cs(value).clamp(lo, hi) };
    let mut previous_end = lo;
    let mut slots = Vec::with_capacity(times.len());
    let mut healthy = true;
    for &(t0, t1) in times {
        let raw_start = tick(t0);
        let raw_end = tick(t1);
        if raw_start < previous_end || raw_end <= raw_start || t0 < range_start || t1 > range_end {
            healthy = false;
        }
        let start = previous_end.max(raw_start);
        let end = start.max(raw_end);
        slots.push((start, end));
        previous_end = end;
    }
    if healthy {
        return None;
    }
    let available = span - count;
    // Integer division is deliberate (locked by voice-ink tests).
    let scaled = |absolute_tick: i64| -> i64 {
        if span > 0 {
            ((absolute_tick - lo).clamp(0, span) * available) / span
        } else {
            0
        }
    };
    Some(
        slots
            .iter()
            .enumerate()
            .map(|(index, slot)| {
                let index = index as i64;
                let start = lo + index + scaled(slot.0);
                let end = lo + index + 1 + scaled(slot.1);
                (start as f64 / 100.0, (start + 1).max(end) as f64 / 100.0)
            })
            .collect(),
    )
}

/// Normalizes word timings within a line (the WordIn variant, used by build).
pub fn normalized_word_timings(words: &mut [WordIn], range_start: f64, range_end: f64) {
    let times: Vec<(f64, f64)> = words.iter().map(|word| (word.start, word.end)).collect();
    if let Some(fixed) = normalized_slots(&times, range_start, range_end) {
        for (word, (start, end)) in words.iter_mut().zip(fixed) {
            word.start = start;
            word.end = end;
        }
    }
}

/// Word-atom variant of the normalization (used to finish rebind/repair).
pub fn normalize_doc_words(words: &mut [Word], range_start: f64, range_end: f64) {
    let times: Vec<(f64, f64)> = words.iter().map(|word| (word.t0, word.t1)).collect();
    if let Some(fixed) = normalized_slots(&times, range_start, range_end) {
        for (word, (t0, t1)) in words.iter_mut().zip(fixed) {
            word.t0 = t0;
            word.t1 = t1;
        }
    }
}

/// Defect classes (detection order is priority).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimingSymptom {
    NonFinite,
    NegativeDuration,
    ZeroDuration,
    StartRegression,
    Overlap,
}

pub fn issue_kind(words: &[Word], index: usize) -> Option<TimingSymptom> {
    let word = &words[index];
    if !word.t0.is_finite() || !word.t1.is_finite() {
        return Some(TimingSymptom::NonFinite);
    }
    if word.t1 < word.t0 {
        return Some(TimingSymptom::NegativeDuration);
    }
    if word.t1 == word.t0 {
        return Some(TimingSymptom::ZeroDuration);
    }
    if index > 0 {
        let previous = &words[index - 1];
        if word.t0 < previous.t0 {
            return Some(TimingSymptom::StartRegression);
        }
        if word.t0 < previous.t1 {
            return Some(TimingSymptom::Overlap);
        }
    }
    None
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct RepairReport {
    /// IDs of the words that were reordered.
    pub repaired: Vec<String>,
    /// IDs of words that still do not fit after expanding to the limit. No bad ticks are forced in; they are kept as-is and reported.
    pub unrepairable: Vec<String>,
}

impl RepairReport {
    pub fn is_clean(&self) -> bool {
        self.repaired.is_empty() && self.unrepairable.is_empty()
    }
}

fn floor_time(t: f64) -> f64 {
    if t.is_finite() { r2(t).max(0.0) } else { 0.0 }
}

fn ceil_time(t: f64, floor: f64) -> f64 {
    if t.is_finite() && t > floor {
        r2(t)
    } else {
        floor + 0.01
    }
}

/// Detection of the five defect classes plus bad-segment repair: a run of bad words is anchored to the healthy neighbours on both sides and reordered.
/// When the tick budget is short it expands into the neighbours (absorbing healthy neighbours into the run to reorder); if that still fails it records `unrepairable`.
pub fn word_timing_repair(words: &mut [Word]) -> RepairReport {
    let mut report = RepairReport::default();
    let count = words.len();
    if count == 0 {
        return report;
    }
    let sick: Vec<bool> = (0..count)
        .map(|index| issue_kind(words, index).is_some())
        .collect();

    let mut index = 0;
    while index < count {
        if !sick[index] {
            index += 1;
            continue;
        }
        let mut start_index = index;
        let mut end_index = index;
        while end_index + 1 < count && sick[end_index + 1] {
            end_index += 1;
        }
        index = end_index + 1;

        let mut guard = 0;
        loop {
            let range_start = if start_index > 0 {
                words[start_index - 1].t1
            } else {
                floor_time(words[start_index].t0)
            };
            let mut range_end = if end_index < count - 1 {
                words[end_index + 1].t0
            } else {
                ceil_time(words[end_index].t1, range_start)
            };
            if range_end <= range_start {
                if end_index == count - 1 && start_index == 0 {
                    range_end = range_start + (end_index - start_index + 1) as f64 / 100.0 + 0.01;
                } else {
                    // The middle run is boxed in by healthy neighbours on both sides: pushing the window into a neighbour would create new
                    // overlaps, so it expands into the neighbour instead (taking the expansion branch below).
                    range_end = range_start;
                }
            }
            let need = (end_index - start_index + 1) as i64;
            if cs(range_end) - cs(range_start) >= need || guard >= count {
                // Budget is enough (or nothing is left to expand): reorder the slice.
                let slice_times: Vec<(f64, f64)> = words[start_index..=end_index]
                    .iter()
                    .map(|word| (word.t0, word.t1))
                    .collect();
                match normalized_slots(&slice_times, range_start, range_end) {
                    Some(fixed) => {
                        for (word, (t0, t1)) in words[start_index..=end_index].iter_mut().zip(fixed)
                        {
                            word.t0 = t0;
                            word.t1 = t1;
                            report.repaired.push(word.id.clone());
                        }
                    }
                    None => {
                        // Normalization is a no-op (expanded to the limit and span is still < count, or the slice happens to look "healthy"
                        // yet cannot be fixed). Report it honestly; never succeed silently.
                        for word in &words[start_index..=end_index] {
                            report.unrepairable.push(word.id.clone());
                        }
                    }
                }
                break;
            }
            // Expand: absorb healthy neighbours forward first, then backward.
            guard += 1;
            if start_index > 0 {
                start_index -= 1;
            } else if end_index < count - 1 {
                end_index += 1;
            } else {
                break;
            }
        }
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word_in(start: f64, end: f64, text: &str) -> WordIn {
        WordIn {
            start,
            end,
            text: text.to_owned(),
        }
    }

    #[test]
    fn healthy_rows_are_left_bit_identical() {
        let mut words = vec![word_in(1.0, 1.3, "a"), word_in(1.8, 2.5, "b")];
        let before = words.clone();
        normalized_word_timings(&mut words, 0.9, 2.6);
        assert_eq!(words, before);
    }

    #[test]
    fn unhealthy_rows_redistribute_with_min_tick_inside_window() {
        let mut words = vec![
            word_in(1.0, 1.0, "a"), // zero duration → unhealthy
            word_in(0.9, 1.4, "b"),
            word_in(5.0, 9.0, "c"),
        ];
        normalized_word_timings(&mut words, 1.0, 2.0);
        assert!(words[0].end > words[0].start);
        assert!(words[1].start >= words[0].end);
        assert!(words[2].end <= 2.0 + 1e-9);
        for word in &words {
            assert!(word.end - word.start >= 0.01 - 1e-9);
        }
    }

    #[test]
    fn window_smaller_than_word_count_is_untouched() {
        let mut words = vec![word_in(0.0, 0.0, "a"), word_in(0.0, 0.0, "b")];
        let before = words.clone();
        normalized_word_timings(&mut words, 0.0, 0.01);
        assert_eq!(words, before);
    }

    fn doc_word(id: &str, t0: f64, t1: f64) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: "word".to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    #[test]
    fn repair_fixes_nan_segment_between_healthy_anchors() {
        let mut words = vec![
            doc_word("a", 0.0, 1.0),
            doc_word("b", f64::NAN, f64::NAN),
            doc_word("c", 3.0, 4.0),
        ];
        let report = word_timing_repair(&mut words);
        assert_eq!(report.repaired, vec!["b".to_owned()]);
        assert!(report.unrepairable.is_empty());
        assert!(words[1].t0 >= 1.0 && words[1].t1 <= 3.0 && words[1].t1 > words[1].t0);
    }

    #[test]
    fn repair_leaves_healthy_words_alone() {
        let mut words = vec![doc_word("a", 0.0, 1.0), doc_word("b", 1.5, 2.0)];
        let before = words.clone();
        let report = word_timing_repair(&mut words);
        assert!(report.is_clean());
        assert_eq!(words, before);
    }

    #[test]
    fn repair_expands_into_neighbors_when_gap_too_small() {
        let mut words = vec![
            doc_word("a", 0.0, 1.0),
            doc_word("b", 1.0, 0.5), // Negative duration with zero gap to its neighbour
            doc_word("c", 1.0, 4.0),
        ];
        let report = word_timing_repair(&mut words);
        assert!(report.unrepairable.is_empty());
        assert!(words[1].t1 > words[1].t0);
        assert!(words[0].t1 <= words[1].t0 + 1e-9);
        assert!(words[1].t1 <= words[2].t0 + 1e-9);
        assert!(issue_kind(&words, 1).is_none());
    }

    #[test]
    fn repair_tail_run_extends_past_last_word() {
        let mut words = vec![doc_word("a", 0.0, 2.0), doc_word("b", 1.0, 1.0)];
        let report = word_timing_repair(&mut words);
        assert!(report.unrepairable.is_empty());
        assert!(words[1].t0 >= words[0].t1 - 1e-9);
        assert!(words[1].t1 > words[1].t0);
    }
}
