//! Speaker derivation: turn sequences, the stable short labels used for payload soft markers, and real-name candidates.
//!
//! Real-name candidates follow the narrow heuristic of CucCut's `CLISpeakerProposeNames`. They only produce evidence and do not guess voice identity. A name captured from an English or Chinese self-introduction must be cross-checked against the analysis's namedEntities before it is marked high confidence.
//!
//! Turns ([`speaker_turns`]) and labels ([`SpeakerLabels`]) are pure derivations. `words[].sp` is the only source of truth for speakers. Neither is persisted or included in output.

use std::collections::BTreeMap;
use std::ops::Range;

use serde::Serialize;

use crate::cue::join_words;
use crate::doc::{TranscriptDoc, Word};
use crate::row_mapping::{row_has_atoms, row_index_of, sorted_nonempty_rows};

/// Speaker turns: the maximal consecutive word runs with the same `sp` (half-open, left-closed).
///
/// An empty word stream returns an empty table. A single `sp` across the whole document (including the common form of "no speaker information") returns **exactly one** turn. Callers use `len() > 1` to decide whether "this document has speaker information".
pub fn speaker_turns(words: &[Word]) -> Vec<Range<usize>> {
    let mut turns: Vec<Range<usize>> = Vec::new();
    let mut start = 0usize;
    for index in 1..words.len() {
        if words[index].sp != words[index - 1].sp {
            turns.push(start..index);
            start = index;
        }
    }
    if !words.is_empty() {
        turns.push(start..words.len());
    }
    turns
}

/// Speaker → stable short label in the payload soft markers (`S1` / `S2` …).
///
/// Rules (deterministic. They look only at the word slice of this projection and do not read the `speakers` table):
///
/// 1. Collect all `sp` values in **order of first appearance**.
/// 2. Fewer than 2 speakers ⇒ empty table. A single-speaker document has no speaker switches, so there is nothing to mark.
/// 3. If every id has the form `s<digits>` (case-insensitive, 1–4 digits, distinct after deduplication) ⇒ the label takes that number: `s2` → `S2`, consistent with the speaker numbering in the UI across all three clients.
/// 4. Otherwise the whole table falls back to first-appearance ordinals: `S1`, `S2`, …
///
/// The same word stream always yields the same table, so a speaker's label is consistent across all pages. Labels go only into the payload copy and must not enter output (they are stripped on the return side by [`crate::engines::markers`]).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SpeakerLabels {
    labels: BTreeMap<String, String>,
}

impl SpeakerLabels {
    /// Derive the label table from a word slice (see the struct docs for the rules).
    pub fn from_words(words: &[Word]) -> Self {
        Self::derive(words, 2)
    }

    /// The **single-speaker-also-gets-a-label** form of [`Self::from_words`]. The numbering rules are exactly the same.
    ///
    /// A payload soft marker says "where the speaker changes", and a single speaker has no switch point, so [`Self::from_words`] returns an empty table. Real-name inference asks "what this voice is called", and a monologue likewise needs an addressable label (`S1`). The two needs differ, but the numbering rule is the same.
    pub fn from_words_allow_single(words: &[Word]) -> Self {
        Self::derive(words, 1)
    }

    fn derive(words: &[Word], min_speakers: usize) -> Self {
        let mut order: Vec<&str> = Vec::new();
        for word in words {
            if !order.iter().any(|sp| *sp == word.sp) {
                order.push(&word.sp);
            }
        }
        if order.len() < min_speakers {
            return Self::default();
        }
        let numeric: Option<Vec<usize>> = order
            .iter()
            .map(|sp| {
                let digits = sp.strip_prefix('s').or_else(|| sp.strip_prefix('S'))?;
                (!digits.is_empty()
                    && digits.len() <= 4
                    && digits.chars().all(|ch| ch.is_ascii_digit()))
                .then(|| digits.parse::<usize>().ok())
                .flatten()
                .filter(|value| *value > 0)
            })
            .collect();
        let numbers = numeric.filter(|values| {
            let mut sorted = values.clone();
            sorted.sort_unstable();
            sorted.dedup();
            sorted.len() == values.len()
        });
        let labels = order
            .iter()
            .enumerate()
            .map(|(index, sp)| {
                let number = numbers.as_ref().map_or(index + 1, |values| values[index]);
                ((*sp).to_owned(), format!("S{number}"))
            })
            .collect();
        Self { labels }
    }

    /// The label of this speaker. Always `None` for a single-speaker document.
    pub fn label(&self, speaker: &str) -> Option<&str> {
        self.labels.get(speaker).map(String::as_str)
    }

    /// Whether there are no labels at all (single speaker or empty word stream).
    pub fn is_empty(&self) -> bool {
        self.labels.is_empty()
    }

    /// All labels, ordered by speaker id ascending (`BTreeMap` order).
    pub fn all_labels(&self) -> Vec<&str> {
        self.labels.values().map(String::as_str).collect()
    }

    /// Label → speaker id (case-insensitive: `s2` and `S2` both match). `None` if not in the table.
    pub fn speaker_for_label(&self, label: &str) -> Option<&str> {
        let wanted = label.trim().to_ascii_uppercase();
        self.labels
            .iter()
            .find(|(_, candidate)| candidate.to_ascii_uppercase() == wanted)
            .map(|(speaker, _)| speaker.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakerNameCandidate {
    pub speaker: String,
    pub current_name: String,
    pub name: String,
    pub confidence: String,
    pub pattern: String,
    pub quote: String,
}

/// Whether the name is still a placeholder: equal to the speaker id itself, `s<digits>`, or `speaker <digits>`.
///
/// A name the user has edited never satisfies this check. Every automatic naming path uses it as its write gate.
pub fn is_placeholder_name(name: &str, id: &str) -> bool {
    let lower = name.trim().to_ascii_lowercase();
    lower == id.to_ascii_lowercase()
        || lower
            .strip_prefix('s')
            .is_some_and(|tail| !tail.is_empty() && tail.chars().all(|ch| ch.is_ascii_digit()))
        || lower
            .strip_prefix("speaker ")
            .is_some_and(|tail| !tail.is_empty() && tail.chars().all(|ch| ch.is_ascii_digit()))
}

fn normalized_name(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn matches_entity(name: &str, entities: &[String]) -> bool {
    let needle = normalized_name(name);
    !needle.is_empty()
        && entities.iter().any(|entity| {
            let entity = normalized_name(entity);
            entity == needle || entity.contains(&needle) || needle.contains(&entity)
        })
}

fn trim_name_token(token: &str) -> &str {
    token.trim_matches(|ch: char| !ch.is_alphanumeric() && ch != '\'' && ch != '-')
}

fn latin_name_after(text: &str, marker: &str) -> Option<String> {
    let lower = text.to_ascii_lowercase();
    let start = lower.find(marker)? + marker.len();
    let mut words = Vec::new();
    for raw in text[start..].split_whitespace().take(2) {
        let word = trim_name_token(raw);
        let first = word.chars().next()?;
        if word.len() < 2 || !first.is_uppercase() {
            break;
        }
        words.push(word);
    }
    (!words.is_empty()).then(|| words.join(" "))
}

fn cjk_name_after(text: &str, marker: &str) -> Option<String> {
    let start = text.find(marker)? + marker.len();
    let name: String = text[start..]
        .chars()
        .skip_while(|ch| ch.is_whitespace())
        .take_while(|ch| ('\u{4e00}'..='\u{9fff}').contains(ch))
        .take(4)
        .collect();
    (name.chars().count() >= 2).then_some(name)
}

fn self_intro(text: &str) -> Option<String> {
    // Prefer precise real-name patterns, so that "one" in "I'm one of…" is not taken as a person's name.
    latin_name_after(text, "my name is ")
        .or_else(|| cjk_name_after(text, "我是"))
        .or_else(|| cjk_name_after(text, "我叫"))
}

/// Each placeholder speaker returns at most one candidate. Scans at most the first 240 characters of that voice, because a common "Hi everybody." would push the real name into a second subtitle cue.
pub fn propose_names(doc: &TranscriptDoc, entities: &[String]) -> Vec<SpeakerNameCandidate> {
    let mut out = Vec::new();
    for (id, speaker) in &doc.speakers {
        if !is_placeholder_name(&speaker.name, id) {
            continue;
        }
        let words = doc.words.iter().filter(|word| &word.sp == id).take(48);
        let opening: String = join_words(words).chars().take(240).collect();
        let Some(name) = self_intro(&opening) else {
            continue;
        };
        let confidence = if matches_entity(&name, entities) {
            "high"
        } else {
            "medium"
        };
        out.push(SpeakerNameCandidate {
            speaker: id.clone(),
            current_name: speaker.name.clone(),
            name,
            confidence: confidence.to_owned(),
            pattern: "self-intro".to_owned(),
            quote: opening,
        });
    }
    out
}

// ── Row attribution restoration (row-level speaker from the joint model → word sp) ──

/// Upper bound on the mismatched run that one row-attribution restoration may touch. It only restores the shape of "snapping moved too far" or "an island was absorbed" (Pass 2's search window is ±1s, and Pass 1's islands are ≤4 words and ≤1.2s). Longer mismatched runs are intentional relabels by the user or by a later reidentify, and are left alone.
pub const ROW_REALIGN_MAX_RUN_WORDS: usize = 6;
pub const ROW_REALIGN_MAX_RUN_SECONDS: f64 = 1.5;
/// If the mismatch rate across the whole document exceeds this value ⇒ speaker attribution has been rewritten wholesale (a reidentify proposal was accepted, or the user batch-renamed and re-numbered the ids). The whole restoration is skipped, because restoring run by run would fight that rewrite.
pub const ROW_REALIGN_MAX_DIVERGENCE: f64 = 0.05;

/// Accounting for [`realign_to_row_speakers`].
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowRealignReport {
    /// Number of words that can be mapped back to their original row (`g<row>.<col>`-style ids).
    pub row_words: usize,
    /// Of those, the number of words whose `sp` does not match the speaker of their row (before restoration).
    pub mismatched_words: usize,
    /// Number of words actually changed back to the row's speaker (including rebound words sandwiched in a mismatch run, whose attribution is inferred from neighbors).
    pub realigned_words: usize,
    /// Number of mismatch runs actually changed back.
    pub realigned_runs: usize,
    /// Number of mismatch runs kept because they exceed the run-length or duration limit.
    pub kept_runs: usize,
    /// Reason for skipping the whole restoration: `no-speaker-rows` / `speaker-table-diverged` /
    /// `row-ownership-diverged`. `None` means it ran normally, even if nothing needed changing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<String>,
}

/// Restore a word's `sp` to the speaker of the original row it belongs to (`ai/asr-rows.json`).
///
/// This only matters for engines with **row-level speaker authority** (joint models such as MOSS). Those rows are the model's textual attribution verdict. The two-pass snapping in [`crate::build::build_doc`] (which also applied to MOSS before 2026-08) moves a particle at the start of an answer to the questioner, and merges a whole-line reply inside an unpunctuated chunk into the other speaker's sentence. Word ids `g<row>.<col>[~k]` point back to the row number naturally (row order is the same as `build_doc`: remove empty rows, stable-sort by start). Speaker ids are also rebuilt in the first-appearance order of `build_doc`, so this does not depend on the display names in the `speakers` table, which the user may have renamed.
///
/// Three gates. If any one is not met, the whole restoration is skipped, and `report.skipped` gives the reason:
///
/// 1. No speaker labels in the rows at all ⇒ `no-speaker-rows`.
/// 2. A rebuilt speaker id is not in `doc.speakers` ⇒ `speaker-table-diverged`.
/// 3. The ratio of mismatched words to mappable words > [`ROW_REALIGN_MAX_DIVERGENCE`] ⇒ `row-ownership-diverged` (attribution has been rewritten wholesale, so it should not be corrected run by run).
///
/// After the gates pass, restoration works by mismatch run. A run of ≤ [`ROW_REALIGN_MAX_RUN_WORDS`] words or ≤ [`ROW_REALIGN_MAX_RUN_SECONDS`] seconds is changed. Longer runs are kept (counted in `kept_runs`). Rebound words (`w…` ids, which have no row number) sandwiched inside a mismatch run are handled with that run. They are included only if the nearest mappable words on either side agree on the row's speaker. Otherwise they are left alone.
pub fn realign_to_row_speakers(
    doc: &mut TranscriptDoc,
    rows: &[crate::asr_rows::RowIn],
) -> RowRealignReport {
    let mut report = RowRealignReport::default();
    if !rows.iter().any(|row| row.speaker.is_some()) {
        report.skipped = Some("no-speaker-rows".to_owned());
        return report;
    }
    // Same row order and speaker-id assignment as build_doc.
    let sorted = sorted_nonempty_rows(rows);
    let mut speaker_ids: BTreeMap<String, String> = BTreeMap::new();
    let mut order: Vec<String> = Vec::new();
    let mut row_speaker: Vec<Option<String>> = Vec::with_capacity(sorted.len());
    for row in &sorted {
        if !row_has_atoms(row) {
            row_speaker.push(None);
            continue;
        }
        let sp = match row.speaker.as_deref() {
            Some(label) => speaker_ids
                .entry(label.to_owned())
                .or_insert_with(|| {
                    let id = format!("s{}", order.len() + 1);
                    order.push(id.clone());
                    id
                })
                .clone(),
            None => {
                if order.is_empty() {
                    order.push("s1".to_owned());
                }
                order[0].clone()
            }
        };
        row_speaker.push(Some(sp));
    }
    if order.iter().any(|id| !doc.speakers.contains_key(id)) {
        report.skipped = Some("speaker-table-diverged".to_owned());
        return report;
    }

    // Expected speaker of each word: row ids are looked up directly. Rebound words are inferred from the nearest row words on either side.
    let mut expected: Vec<Option<String>> = doc
        .words
        .iter()
        .map(|word| row_index_of(&word.id).and_then(|row| row_speaker.get(row).cloned().flatten()))
        .collect();
    let row_words = expected.iter().filter(|value| value.is_some()).count();
    report.row_words = row_words;
    if row_words == 0 {
        report.skipped = Some("row-ownership-diverged".to_owned());
        return report;
    }
    let mismatched = doc
        .words
        .iter()
        .zip(&expected)
        .filter(|(word, expected)| expected.as_ref().is_some_and(|sp| *sp != word.sp))
        .count();
    report.mismatched_words = mismatched;
    if mismatched as f64 / row_words as f64 > ROW_REALIGN_MAX_DIVERGENCE {
        report.skipped = Some("row-ownership-diverged".to_owned());
        return report;
    }
    // Expectation for a rebound word: it inherits only if the expectations of the previous and next row words agree. Otherwise it is left alone.
    let mut previous: Option<String> = None;
    let mut fill: Vec<Option<String>> = vec![None; expected.len()];
    for (index, value) in expected.iter().enumerate() {
        match value {
            Some(sp) => previous = Some(sp.clone()),
            None => fill[index] = previous.clone(),
        }
    }
    let mut next: Option<String> = None;
    for index in (0..expected.len()).rev() {
        match &expected[index] {
            Some(sp) => next = Some(sp.clone()),
            None => {
                if fill[index].is_some() && fill[index] != next {
                    fill[index] = None;
                }
            }
        }
    }
    for (slot, filled) in expected.iter_mut().zip(fill) {
        if slot.is_none() {
            *slot = filled;
        }
    }

    // Mismatch run: consecutive words where an expectation exists and ≠ the current sp.
    let mut index = 0;
    while index < doc.words.len() {
        let mismatch = expected[index]
            .as_ref()
            .is_some_and(|sp| *sp != doc.words[index].sp);
        if !mismatch {
            index += 1;
            continue;
        }
        let start = index;
        while index < doc.words.len()
            && expected[index]
                .as_ref()
                .is_some_and(|sp| *sp != doc.words[index].sp)
        {
            index += 1;
        }
        let run = start..index;
        let seconds = doc.words[run.end - 1].t1 - doc.words[run.start].t0;
        if run.len() <= ROW_REALIGN_MAX_RUN_WORDS || seconds <= ROW_REALIGN_MAX_RUN_SECONDS {
            for position in run.clone() {
                let sp = expected[position]
                    .clone()
                    .expect("mismatch implies expected");
                doc.words[position].sp = sp;
            }
            report.realigned_words += run.len();
            report.realigned_runs += 1;
        } else {
            report.kept_runs += 1;
        }
    }
    report
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use crate::doc::{DocEngine, DocMedia, Speaker, TranscriptDoc, Word};

    use super::*;

    fn sample() -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-00".to_owned(),
                duration: 10.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        doc.speakers = BTreeMap::from([(
            "s1".to_owned(),
            Speaker {
                name: "S1".to_owned(),
                hue: Some(222),
            },
        )]);
        for (index, text) in ["Hi,", "everybody.", "My", "name", "is", "Sid", "Bidasaria."]
            .into_iter()
            .enumerate()
        {
            doc.words.push(Word {
                id: format!("g1.{index}"),
                t0: index as f64,
                t1: index as f64 + 0.5,
                text: text.to_owned(),
                sp: "s1".to_owned(),
                glue: false,
            });
        }
        doc
    }

    #[test]
    fn proposes_cross_checked_name_after_greeting() {
        let candidates = propose_names(&sample(), &["Sid Bidasaria".to_owned()]);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].name, "Sid Bidasaria");
        assert_eq!(candidates[0].confidence, "high");
    }

    fn spoken(speakers: &[&str]) -> Vec<Word> {
        speakers
            .iter()
            .enumerate()
            .map(|(index, sp)| Word {
                id: format!("g{index}"),
                t0: index as f64,
                t1: index as f64 + 0.5,
                text: "aaaa".to_owned(),
                sp: (*sp).to_owned(),
                glue: false,
            })
            .collect()
    }

    #[test]
    fn turns_are_maximal_runs_of_one_speaker() {
        assert!(speaker_turns(&[]).is_empty());
        assert_eq!(speaker_turns(&spoken(&["s1", "s1", "s1"])), vec![0..3]);
        assert_eq!(
            speaker_turns(&spoken(&["s1", "s1", "s2", "s1", "s1"])),
            vec![0..2, 2..3, 3..5]
        );
    }

    #[test]
    fn labels_follow_speaker_ids_and_fall_back_to_first_use_order() {
        // A single speaker has no switch point, and therefore no labels.
        assert!(SpeakerLabels::from_words(&spoken(&["s1", "s1"])).is_empty());

        // Canonical id: the label takes the number in the id, consistent with the UI numbering (independent of first-appearance order).
        let canonical = SpeakerLabels::from_words(&spoken(&["s2", "s1", "s2"]));
        assert_eq!(canonical.label("s2"), Some("S2"));
        assert_eq!(canonical.label("s1"), Some("S1"));
        assert_eq!(canonical.label("s3"), None);

        // Non-canonical id (or a number conflict): the whole table falls back to first-appearance ordinals.
        let fallback = SpeakerLabels::from_words(&spoken(&["host", "s1", "host"]));
        assert_eq!(fallback.label("host"), Some("S1"));
        assert_eq!(fallback.label("s1"), Some("S2"));
        let collision = SpeakerLabels::from_words(&spoken(&["s01", "s1"]));
        assert_eq!(collision.label("s01"), Some("S1"));
        assert_eq!(collision.label("s1"), Some("S2"));
    }

    #[test]
    fn does_not_treat_role_intro_as_name() {
        let mut doc = sample();
        for word in &mut doc.words {
            word.text = "I'm".to_owned();
        }
        assert!(propose_names(&doc, &[]).is_empty());
    }

    // ── Row attribution restoration ──

    use crate::asr_rows::{RowIn, WordIn};

    fn cjk_row(start: f64, end: f64, text: &str, speaker: &str) -> RowIn {
        let chars: Vec<char> = text.chars().collect();
        let step = (end - start) / chars.len() as f64;
        let mut row = RowIn::new(start, end, text);
        row.speaker = Some(speaker.to_owned());
        row.words = Some(
            chars
                .iter()
                .enumerate()
                .map(|(index, character)| WordIn {
                    start: start + step * index as f64,
                    end: start + step * (index + 1) as f64,
                    text: character.to_string(),
                })
                .collect(),
        );
        row
    }

    fn turn_texts(doc: &TranscriptDoc) -> Vec<(String, String)> {
        let mut out: Vec<(String, String)> = Vec::new();
        for word in &doc.words {
            match out.last_mut() {
                Some((sp, text)) if *sp == word.sp => text.push_str(&word.text),
                _ => out.push((word.sp.clone(), word.text.clone())),
            }
        }
        out
    }

    fn built(rows: &[RowIn], policy: crate::build::SpeakerBoundaryPolicy) -> TranscriptDoc {
        crate::build::build_doc_with_policy(
            rows,
            crate::doc::DocMedia {
                id: None,
                path: None,
                hash: String::new(),
                duration: 1000.0,
                sample_rate: Some(16_000),
            },
            "zh",
            crate::doc::DocEngine {
                name: "moss-transcribe-diarize".to_owned(),
                version: None,
                aligned_words: true,
            },
            None,
            policy,
        )
    }

    /// Fixture = the original MOSS 7-hour interview rows (“filler” at 719s, a whole-line “filler” at 154s). A project built with the snapping strategy, after row attribution restoration, matches word-for-word the result built with the row-authority strategy.
    #[test]
    fn realign_restores_snapped_fillers_and_absorbed_backchannels() {
        let mut answer = cjk_row(719.41, 724.99, "呃很多啊打DOTA啊什么的", "S02");
        {
            let words = answer.words.as_mut().unwrap();
            words[0].end = 719.41;
            words[1].start = 719.89;
        }
        let rows = vec![
            cjk_row(151.0, 154.57, "呃NYU其实确实做得很不错", "S02"),
            cjk_row(154.70, 155.01, "嗯", "S01"),
            cjk_row(155.02, 158.0, "但另一方面NYU还有很强的电影学院", "S02"),
            cjk_row(718.14, 719.22, "当时打什么游戏", "S01"),
            answer,
        ];
        let mut legacy = built(&rows, crate::build::SpeakerBoundaryPolicy::SnapToPauses);
        let authoritative = built(&rows, crate::build::SpeakerBoundaryPolicy::RowAuthoritative);
        assert_ne!(
            turn_texts(&legacy),
            turn_texts(&authoritative),
            "夹具必须真的触发吸附"
        );

        let report = realign_to_row_speakers(&mut legacy, &rows);
        assert_eq!(report.skipped, None, "{report:?}");
        assert_eq!(report.realigned_runs, 2, "{report:?}");
        assert_eq!(report.kept_runs, 0);
        assert!(report.mismatched_words >= 2);
        assert_eq!(report.realigned_words, report.mismatched_words);
        assert_eq!(turn_texts(&legacy), turn_texts(&authoritative));
        // Idempotent: running it again changes nothing.
        let again = realign_to_row_speakers(&mut legacy, &rows);
        assert_eq!(again.realigned_words, 0);
        assert_eq!(again.mismatched_words, 0);
    }

    /// Rebound words (`w…` ids) sandwiched in a mismatch run are restored with that run only if the expectations of the row words on either side agree.
    #[test]
    fn realign_carries_rebound_words_inside_a_run_by_their_neighbours() {
        let rows = vec![
            cjk_row(0.0, 3.0, "你好啊今天天气不错我们来聊一聊", "S01"),
            cjk_row(3.0, 6.0, "呃我们开始今天的话题吧好不好呀", "S02"),
        ];
        let mut doc = built(&rows, crate::build::SpeakerBoundaryPolicy::RowAuthoritative);
        // Simulates legacy snapping plus a polish rebinding. "呃我" (filler + "我", "I") was moved to S01, and the "我" was rebound to a new id. It has no row number, so its attribution can only be inferred from the agreeing expectations of the neighboring row words “filler” and “plural suffix”.
        let filler = doc.words.iter().position(|word| word.text == "呃").unwrap();
        doc.words[filler].sp = "s1".to_owned();
        doc.words[filler + 1].sp = "s1".to_owned();
        doc.words[filler + 1].id = "wabc-1".to_owned();
        let report = realign_to_row_speakers(&mut doc, &rows);
        assert_eq!(report.skipped, None);
        assert_eq!(report.realigned_words, 2, "{report:?}");
        assert!(doc.words.iter().skip(filler).all(|word| word.sp == "s2"));
    }

    #[test]
    fn realign_skips_when_ownership_was_rewritten_or_rows_carry_no_speakers() {
        let rows = vec![
            cjk_row(0.0, 2.0, "第一句话说得很长很长", "S01"),
            cjk_row(2.0, 4.0, "第二句话也说得很长很长", "S02"),
        ];
        // Whole-document relabel (reidentify already accepted): the mismatch rate is far above 5% ⇒ skip.
        let mut rewritten = built(&rows, crate::build::SpeakerBoundaryPolicy::RowAuthoritative);
        for word in &mut rewritten.words {
            word.sp = "s1".to_owned();
        }
        let report = realign_to_row_speakers(&mut rewritten, &rows);
        assert_eq!(report.skipped.as_deref(), Some("row-ownership-diverged"));
        assert!(rewritten.words.iter().all(|word| word.sp == "s1"));

        // Long mismatch runs (the user intentionally changed a whole sentence) are kept and are not counted as skipped.
        let mut edited = built(&rows, crate::build::SpeakerBoundaryPolicy::RowAuthoritative);
        edited.words[0].sp = "s2".to_owned(); // A single word: a short run, and it will be restored
        let report = realign_to_row_speakers(&mut edited, &rows);
        assert_eq!(report.realigned_runs, 1);

        // No speaker labels in the rows: nothing to do.
        let plain = vec![RowIn::new(0.0, 1.0, "hello there")];
        let mut doc = built(
            &plain,
            crate::build::SpeakerBoundaryPolicy::RowAuthoritative,
        );
        let report = realign_to_row_speakers(&mut doc, &plain);
        assert_eq!(report.skipped.as_deref(), Some("no-speaker-rows"));

        // Speaker table renumbered (id not in the table): skip.
        let mut renamed = built(&rows, crate::build::SpeakerBoundaryPolicy::RowAuthoritative);
        let s2 = renamed.speakers.remove("s2").unwrap();
        renamed.speakers.insert("guest".to_owned(), s2);
        for word in &mut renamed.words {
            if word.sp == "s2" {
                word.sp = "guest".to_owned();
            }
        }
        let report = realign_to_row_speakers(&mut renamed, &rows);
        assert_eq!(report.skipped.as_deref(), Some("speaker-table-diverged"));
    }
}
