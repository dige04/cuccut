//! Pure decisions in the translate orchestration that never touch a provider or write to disk.
//!
//! Ported from CucCut v2 `ccut-engine`'s `flows/translate.rs`: `narrow_to_stale`, and the plan / skip advisory for the row-repair tail round (`plan_row_repair_tail`, `row_repair_tail_skip_advisory`).
//! [`ROW_DEFICIT_MAX_KEYS`] comes from `flows/refine.rs` in the same directory. The orchestration itself (calling the provider, `run_row_repair_tail` which writes the audit artifacts, and reading `align_params_for` from `project.json`) is not here;
//! its threshold logic is [`crate::split::TransParams::for_delivery`] / `with_fit`.

use std::collections::BTreeSet;

/// Maximum number of sentences in one round of targeted paired re-splitting. The refine row-repair round and the translate tail round share the same
/// cap. If each kept its own literal, the two would only drift apart into two batch semantics when tuning.
pub const ROW_DEFICIT_MAX_KEYS: usize = 40;

/// `--only-stale` / `--after-cut`: merges this language's stale sentences into the targeted set. When an explicit `--sentences`
/// is given, the intersection is taken. An empty set is a valid result (this language has no stale sentences, so this round neither translates nor aligns).
pub fn narrow_to_stale<K: Ord>(explicit: Option<&BTreeSet<K>>, stale: BTreeSet<K>) -> BTreeSet<K> {
    match explicit {
        Some(filter) => stale
            .into_iter()
            .filter(|key| filter.contains(key))
            .collect(),
        None => stale,
    }
}

/// Why the automatic row-repair tail round was skipped. All four are normal paths, not failures.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowRepairTailSkip {
    /// The caller turned it off explicitly (`--no-row-repair`, or refine's guard against recursion).
    OptedOut,
    /// The main alignment of this round is already paired: it is itself the re-split round, so no extra round is stacked on top.
    AlreadyPaired,
    /// This round wrote nothing. Re-running translate is a no-op, and the tail round must be a no-op too.
    NoWrites,
    /// Detection found no hits: no row-sticking means nothing to repair.
    NoHits,
}

impl RowRepairTailSkip {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OptedOut => "opted-out",
            Self::AlreadyPaired => "already-paired",
            Self::NoWrites => "no-writes",
            Self::NoHits => "no-hits",
        }
    }
}

/// Targeted plan for the tail round.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RowRepairTailPlan {
    /// Targeted sentence set truncated to `ROW_DEFICIT_MAX_KEYS`, used as `AlignOptions::sentences`.
    pub keys: BTreeSet<String>,
    /// The full set of hits, used as `AlignOptions::density_sentences`. The engine uses it to count the difference that this round's cap
    /// cut off and left for the next round into `row_repair.capped`.
    pub density_sentences: BTreeSet<String>,
}

/// Pure decision: whether this round should run the row-repair tail round, and if so which sentences to target. Makes zero LLM calls.
///
/// Detection reuses `row_deficit_issues`, the single predicate entry point for `align-row-deficit` in `ccut check`,
/// and does not copy the thresholds here. Translation cues must be derived **after the main alignment** (they read `trans` / `transAlign`, which the main round has just changed).
pub fn plan_row_repair_tail(
    doc: &crate::doc::TranscriptDoc,
    sentences: &[crate::sentence::Sentence],
    cues: &[crate::cue::Cue],
    lang: &str,
    no_row_repair: bool,
    density: crate::engines::align::AlignDensity,
    wrote_this_round: bool,
    sentence_filter: Option<&BTreeSet<String>>,
) -> Result<RowRepairTailPlan, RowRepairTailSkip> {
    if no_row_repair {
        return Err(RowRepairTailSkip::OptedOut);
    }
    if density == crate::engines::align::AlignDensity::Paired {
        return Err(RowRepairTailSkip::AlreadyPaired);
    }
    if !wrote_this_round {
        return Err(RowRepairTailSkip::NoWrites);
    }
    let stream = crate::split::derive_trans_cues(doc, sentences, lang);
    let mut hits: BTreeSet<String> =
        crate::engines::align::row_deficit_issues(doc, sentences, lang, cues, &stream)
            .into_iter()
            .map(|issue| issue.key)
            .collect();
    // Targeted re-translation only finishes the sentences this round touched. Row-sticking on sentences this round did not translate is legacy,
    // left to check + refine-align, and this does not widen the write scope here.
    if let Some(filter) = sentence_filter {
        hits.retain(|key| filter.contains(key));
    }
    if hits.is_empty() {
        return Err(RowRepairTailSkip::NoHits);
    }
    let keys: BTreeSet<String> = hits.iter().take(ROW_DEFICIT_MAX_KEYS).cloned().collect();
    Ok(RowRepairTailPlan {
        keys,
        density_sentences: hits,
    })
}

/// What to say when the tail round is skipped: it speaks up, returning one advisory, only when "this round's main alignment is itself the paired re-split round" and row-sticking still remains after it ran.
/// Pure decision, zero LLM calls.
///
/// The other three skips are deliberately not reported. `opted-out` mixes in refine's internal recursion guard (see
/// [`RowRepairTailSkip::OptedOut`]); refine hits it on every round, so reporting it would be noise that is always true. `no-writes` is an idempotent empty run: this round changed nothing. `no-hits` never had
/// any row-sticking to begin with. The remaining `already-paired` is the real signal: the caller explicitly asked for a re-split, row-sticking is still left after it ran, and by design the tail round will not stack another round on a paired round. Without this advisory, these sentences get
/// no hint outside `--json`.
pub fn row_repair_tail_skip_advisory(
    doc: &crate::doc::TranscriptDoc,
    sentences: &[crate::sentence::Sentence],
    cues: &[crate::cue::Cue],
    lang: &str,
    skip: RowRepairTailSkip,
    sentence_filter: Option<&BTreeSet<String>>,
) -> Option<String> {
    if skip != RowRepairTailSkip::AlreadyPaired {
        return None;
    }
    let stream = crate::split::derive_trans_cues(doc, sentences, lang);
    let mut remaining =
        crate::engines::align::row_deficit_issues(doc, sentences, lang, cues, &stream);
    if let Some(filter) = sentence_filter {
        remaining.retain(|issue| filter.contains(&issue.key));
    }
    if remaining.is_empty() {
        return None;
    }
    let sample = remaining
        .iter()
        .take(5)
        .map(|issue| issue.key.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let more = if remaining.len() > 5 { " …" } else { "" };
    Some(format!(
        "{lang}: 本轮 --align-density paired 之后仍有 {} 句译文黏结多行源字幕（{sample}{more}）；收尾轮按设计不会在 paired 轮上再叠一轮，请跑 ccut check + ccut refine-align",
        remaining.len()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr_rows::RowIn;
    use crate::build::build_doc;
    use crate::cue::{Cue, derive_cues};
    use crate::doc::{AlignMode, DocEngine, DocMedia, TransAlign, TransPiece, TranscriptDoc};
    use crate::engines::align::AlignDensity;
    use crate::sentence::Sentence;

    const SOURCE_TEXT: &str = "we have been working on this particular problem for a very long time and the results are finally starting to show up in the numbers that everybody can see today.";
    const TRANSLATION: &str = "我们在这个具体的问题上已经投入了非常长的时间，而现在所有人都能够从每天更新的数字里，清清楚楚地看到那些最终开始显现出来的结果。";

    fn doc_with_rows(rows: &[RowIn]) -> TranscriptDoc {
        build_doc(
            rows,
            DocMedia {
                id: None,
                path: Some("talk.wav".to_owned()),
                hash: "sha256-00".to_owned(),
                duration: 10_000.0,
                sample_rate: Some(16_000),
            },
            "en",
            DocEngine {
                name: "t".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    /// Installs one **valid whole-sentence** ManyToOne entry. This is exactly the live shape of row-sticking, and also why
    /// the tail round must pass `force: true`: a non-force round would skip this kind of sentence in bulk.
    fn glue_sentence(doc: &mut TranscriptDoc, sentence_id: &str, word_ids: Vec<String>) {
        let last = word_ids.len() - 1;
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentence_id.to_owned(), TRANSLATION.to_owned());
        doc.trans_align.entry("zh".to_owned()).or_default().insert(
            sentence_id.to_owned(),
            TransAlign::new(
                AlignMode::ManyToOne,
                word_ids,
                vec![TransPiece {
                    from: Some(0),
                    to: Some(last),
                    text: TRANSLATION.to_owned(),
                }],
            ),
        );
    }

    /// Single-sentence row-sticking: 4 source lines + 1 translation cue covering the whole sentence, held for 30s.
    fn glued_doc() -> (TranscriptDoc, Vec<Cue>, Vec<Sentence>) {
        let mut doc = doc_with_rows(&[RowIn::new(0.0, 30.0, SOURCE_TEXT)]);
        let word_ids = doc.words.iter().map(|word| word.id.clone()).collect();
        glue_sentence(&mut doc, "s-g1.0", word_ids);
        let (cues, sentences) = derive(&doc);
        (doc, cues, sentences)
    }

    fn derive(doc: &TranscriptDoc) -> (Vec<Cue>, Vec<Sentence>) {
        let cues = derive_cues(doc, &crate::layout_profile::cue_params_for_doc(doc));
        let sentences = crate::sentence::derive_sentences(doc, &cues);
        (cues, sentences)
    }

    fn plan(
        doc: &TranscriptDoc,
        cues: &[Cue],
        sentences: &[Sentence],
        no_row_repair: bool,
        density: AlignDensity,
        wrote: bool,
        filter: Option<&BTreeSet<String>>,
    ) -> Result<RowRepairTailPlan, RowRepairTailSkip> {
        plan_row_repair_tail(
            doc,
            sentences,
            cues,
            "zh",
            no_row_repair,
            density,
            wrote,
            filter,
        )
    }

    /// `--only-stale` and `--sentences` are intersected. When there is no explicit targeted set, the stale set is the targeted set;
    /// an empty set is a valid result (this language has no stale sentences, so this round translates nothing).
    #[test]
    fn only_stale_narrows_the_targeted_set() {
        let stale: BTreeSet<String> = ["s-1", "s-2", "s-3"].map(str::to_owned).into();
        let explicit: BTreeSet<String> = ["s-2", "s-9"].map(str::to_owned).into();
        assert_eq!(
            narrow_to_stale(None, stale.clone()),
            ["s-1", "s-2", "s-3"].map(str::to_owned).into()
        );
        assert_eq!(
            narrow_to_stale(Some(&explicit), stale),
            ["s-2"].map(str::to_owned).into()
        );
        assert!(narrow_to_stale(Some(&explicit), BTreeSet::new()).is_empty());
    }

    #[test]
    fn tail_is_skipped_when_opted_out() {
        let (doc, cues, sentences) = glued_doc();
        assert_eq!(
            plan(
                &doc,
                &cues,
                &sentences,
                true,
                AlignDensity::Auto,
                true,
                None
            ),
            Err(RowRepairTailSkip::OptedOut)
        );
    }

    #[test]
    fn tail_is_skipped_when_the_main_round_is_already_paired() {
        let (doc, cues, sentences) = glued_doc();
        assert_eq!(
            plan(
                &doc,
                &cues,
                &sentences,
                false,
                AlignDensity::Paired,
                true,
                None
            ),
            Err(RowRepairTailSkip::AlreadyPaired)
        );
    }

    #[test]
    fn tail_is_skipped_when_the_round_wrote_nothing() {
        // Idempotent: running translate again is a no-op, and the tail round must be a no-op too.
        let (doc, cues, sentences) = glued_doc();
        assert_eq!(
            plan(
                &doc,
                &cues,
                &sentences,
                false,
                AlignDensity::Auto,
                false,
                None
            ),
            Err(RowRepairTailSkip::NoWrites)
        );
    }

    #[test]
    fn tail_is_skipped_when_nothing_is_glued() {
        // Project with no row-sticking: translation output has zero drift, and the tail round sends no calls at all.
        let doc = doc_with_rows(&[RowIn::new(0.0, 3.0, "a short clean line.")]);
        let (cues, sentences) = derive(&doc);
        let mut doc = doc;
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentences[0].id.clone(), "一句干净的短译文。".to_owned());
        assert_eq!(
            plan(
                &doc,
                &cues,
                &sentences,
                false,
                AlignDensity::Auto,
                true,
                None
            ),
            Err(RowRepairTailSkip::NoHits)
        );
    }

    #[test]
    fn tail_only_targets_sentences_this_round_touched() {
        // Targeted re-translation only finishes the sentences it touched. Legacy row-sticking outside this round's filter is left to
        // check + refine-align, and this does not widen the write scope here.
        let (doc, cues, sentences) = glued_doc();
        let filter = BTreeSet::from(["s-g9.9".to_owned()]);
        assert_eq!(
            plan(
                &doc,
                &cues,
                &sentences,
                false,
                AlignDensity::Auto,
                true,
                Some(&filter)
            ),
            Err(RowRepairTailSkip::NoHits)
        );
    }

    /// This round's main alignment is already paired and row-sticking remains after it ran. The tail round will not stack another round, so it must speak up.
    #[test]
    fn a_skipped_tail_after_a_paired_round_still_reports_the_remaining_glue() {
        let (doc, cues, sentences) = glued_doc();
        let advisory = row_repair_tail_skip_advisory(
            &doc,
            &sentences,
            &cues,
            "zh",
            RowRepairTailSkip::AlreadyPaired,
            None,
        )
        .expect("paired 轮之后仍有黏结");
        assert!(advisory.contains("s-g1.0"), "{advisory}");
        assert!(advisory.contains("refine-align"), "{advisory}");
    }

    /// `opted-out` mixes in refine's internal recursion guard: reporting it would be noise that is always true.
    /// `no-writes` / `no-hits` are likewise not reported.
    #[test]
    fn the_other_skip_reasons_stay_silent_even_with_glue_left() {
        let (doc, cues, sentences) = glued_doc();
        for skip in [
            RowRepairTailSkip::OptedOut,
            RowRepairTailSkip::NoWrites,
            RowRepairTailSkip::NoHits,
        ] {
            assert_eq!(
                row_repair_tail_skip_advisory(&doc, &sentences, &cues, "zh", skip, None,),
                None,
                "{skip:?}"
            );
        }
    }

    /// Stays silent when no row-sticking is left.
    #[test]
    fn a_skipped_paired_tail_without_glue_says_nothing() {
        let mut doc = doc_with_rows(&[RowIn::new(0.0, 3.0, SOURCE_TEXT)]);
        let (cues, sentences) = derive(&doc);
        for sentence in &sentences {
            doc.trans
                .entry("zh".to_owned())
                .or_default()
                .insert(sentence.id.clone(), "短句。".to_owned());
        }
        assert_eq!(
            row_repair_tail_skip_advisory(
                &doc,
                &sentences,
                &cues,
                "zh",
                RowRepairTailSkip::AlreadyPaired,
                None,
            ),
            None
        );
    }

    #[test]
    fn tail_truncates_the_targeted_set_to_the_shared_cap() {
        let rows = (0..45)
            .map(|index| {
                let start = index as f64 * 40.0;
                RowIn::new(start, start + 30.0, SOURCE_TEXT)
            })
            .collect::<Vec<_>>();
        let mut doc = doc_with_rows(&rows);
        let (cues, sentences) = derive(&doc);
        assert_eq!(sentences.len(), 45);
        for sentence in &sentences {
            let word_ids = sentence
                .word_indices
                .iter()
                .map(|&index| doc.words[index].id.clone())
                .collect();
            glue_sentence(&mut doc, &sentence.id, word_ids);
        }
        let plan = plan(
            &doc,
            &cues,
            &sentences,
            false,
            AlignDensity::Auto,
            true,
            None,
        )
        .expect("45 句黏结");
        // Truncation only affects this round's targeted sentence set. The complete hit set is still handed to the engine in full, and the engine records the
        // difference in `row_repair.capped` (left for the next round).
        assert_eq!(plan.keys.len(), ROW_DEFICIT_MAX_KEYS);
        assert_eq!(plan.density_sentences.len(), 45);
        assert!(plan.density_sentences.is_superset(&plan.keys));
    }
}
