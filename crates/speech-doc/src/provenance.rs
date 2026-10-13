//! Translation provenance (design §11.3): `ai/state/translation.<lang>.json`.
//!
//! Records which version of the terminology/context a sentence's translation was produced from, so that once the terminology is changed the sentence can be judged stale, without re-translating the whole document. This module is pure functions: hashes use the deterministic digests from [`crate::fingerprint`], and file I/O and clocks are all handled by the host.
//!
//! Criterion (decided, see the M4 report): **only a change in the set of hashes of the terminology rows that hit the sentence counts as stale**. Differences in summary/style are only reported as advisory. Otherwise, every re-run of analysis would change a word of the summary, and the whole document would be judged stale, with a cost wildly out of proportion to the benefit.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::engines::brief::{DocumentBrief, GlossaryEntry};
use crate::engines::translate::term_present;
use crate::fingerprint::fingerprint_strings;

/// Snapshot of the basis for a single sentence's translation.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentenceProvenance {
    /// Hash of the context summary at the time the sentence was produced.
    pub context_hash: String,
    /// Hash of the writing style at the time the sentence was produced (`# Translation Style` + tone).
    pub style_hash: String,
    /// Hashes of the terminology rows that hit the sentence, sorted and de-duplicated.
    pub term_hashes: Vec<String>,
}

/// Overall shape of `ai/state/translation.<lang>.json`: sentence id → snapshot.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TranslationProvenance {
    pub sentences: BTreeMap<String, SentenceProvenance>,
}

impl TranslationProvenance {
    pub fn get(&self, sentence_id: &str) -> Option<&SentenceProvenance> {
        self.sentences.get(sentence_id)
    }

    pub fn insert(&mut self, sentence_id: impl Into<String>, record: SentenceProvenance) {
        self.sentences.insert(sentence_id.into(), record);
    }

    /// Sentences that no longer exist in the document are not kept in the state (otherwise the file would grow monotonically with editing).
    pub fn retain_sentences(&mut self, live: &BTreeSet<String>) {
        self.sentences.retain(|id, _| live.contains(id));
    }

    pub fn is_empty(&self) -> bool {
        self.sentences.is_empty()
    }
}

/// The “current basis” fixed for one run: computed once from the brief (i.e. the projection of `context.<lang>.md`) and reused sentence by sentence.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ContextDigest {
    pub context_hash: String,
    pub style_hash: String,
    /// `(source, hash)`, sorted by source.
    terms: Vec<(String, String)>,
    /// Whether there is actually a comparable basis (the brief exists).
    ///
    /// Must be distinguished from "the brief exists but the terminology table is empty": in the latter case the empty term set is a **real** basis, and the user deleting all terms should make the related sentences stale. A run with no basis at all, such as `--no-brief`, would, if compared against an empty set, judge the entire existing translation stale and re-translate the whole thing.
    basis: bool,
}

fn term_hash(entry: &GlossaryEntry) -> String {
    fingerprint_strings([
        entry.source.as_str(),
        entry.target.as_str(),
        entry.note.as_deref().unwrap_or(""),
        if entry.locked { "lock" } else { "free" },
    ])
}

impl ContextDigest {
    /// Constructed from the effective bilingual brief. When `brief` is `None` (this run has no context to base on at all, e.g. `--no-brief`), a no-basis summary is returned: [`scan_provenance`] skips the whole judgment, neither marking anything stale nor reporting advisories, and the ledger is left as-is for the next run that has a basis.
    pub fn from_brief(brief: Option<&DocumentBrief>) -> Self {
        let Some(brief) = brief else {
            return Self::default();
        };
        let mut terms: Vec<(String, String)> = brief
            .glossary
            .iter()
            .filter(|entry| !entry.source.trim().is_empty())
            .map(|entry| (entry.source.clone(), term_hash(entry)))
            .collect();
        terms.sort();
        terms.dedup_by(|left, right| left.0 == right.0);
        Self {
            context_hash: fingerprint_strings([brief.summary.as_str()]),
            style_hash: fingerprint_strings([
                brief.style_guide.as_str(),
                brief
                    .tone
                    .map(|tone| tone.prompt_line())
                    .unwrap_or_default(),
            ]),
            terms,
            basis: true,
        }
    }

    /// Whether this run actually has a comparable basis.
    pub fn has_basis(&self) -> bool {
        self.basis
    }

    /// Hashes of the terminology rows that hit the sentence's source text (ascending, de-duplicated).
    pub fn term_hashes_for(&self, source_text: &str) -> Vec<String> {
        let mut hits: Vec<String> = self
            .terms
            .iter()
            .filter(|(source, _)| term_present(source_text, source))
            .map(|(_, hash)| hash.clone())
            .collect();
        hits.sort();
        hits.dedup();
        hits
    }

    /// The snapshot this sentence should have under the **current** basis.
    pub fn record_for(&self, source_text: &str) -> SentenceProvenance {
        SentenceProvenance {
            context_hash: self.context_hash.clone(),
            style_hash: self.style_hash.clone(),
            term_hashes: self.term_hashes_for(source_text),
        }
    }
}

/// Result of the provenance scan.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProvenanceScan {
    /// Sentence ids whose terminology basis has changed and that must be re-translated.
    pub stale: BTreeSet<String>,
    /// Sentence ids that have a translation but no provenance record (legacy projects, or translations written by a previous CLI version).
    /// Advisory only; does not trigger re-translation.
    pub unknown: BTreeSet<String>,
    /// Sentence ids whose terminology is unchanged but whose summary/style changed; advisory only.
    pub context_drift: BTreeSet<String>,
}

impl ProvenanceScan {
    pub fn is_clean(&self) -> bool {
        self.stale.is_empty() && self.unknown.is_empty() && self.context_drift.is_empty()
    }
}

/// Scan the provenance status of existing translations.
///
/// `translated` is the sentences that already have a translation in this language, as `(id, source_text)`. Sentences without a translation are already picked up by translate's missing-translation criterion, so they need not go into the provenance ledger.
///
/// When `digest` has no basis (the brief is absent), no judgment is made at all: comparing existing records against an empty terminology set would count every record that carries terms as "terms gone", which amounts to re-translating the whole document.
pub fn scan_provenance<'a, I>(
    records: &TranslationProvenance,
    digest: &ContextDigest,
    translated: I,
) -> ProvenanceScan
where
    I: IntoIterator<Item = (&'a str, &'a str)>,
{
    let mut scan = ProvenanceScan::default();
    if !digest.has_basis() {
        return scan;
    }
    for (id, source_text) in translated {
        let Some(record) = records.get(id) else {
            scan.unknown.insert(id.to_owned());
            continue;
        };
        let current = digest.term_hashes_for(source_text);
        if current != record.term_hashes {
            scan.stale.insert(id.to_owned());
        } else if !digest.context_hash.is_empty()
            && (digest.context_hash != record.context_hash
                || digest.style_hash != record.style_hash)
        {
            scan.context_drift.insert(id.to_owned());
        }
    }
    scan
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engines::brief::GlossaryEntry;

    fn brief_with(glossary: Vec<GlossaryEntry>, summary: &str, style: &str) -> DocumentBrief {
        DocumentBrief {
            target_lang: "zh-Hans".to_owned(),
            tone: None,
            summary: summary.to_owned(),
            glossary,
            named_entities: Vec::new(),
            style_guide: style.to_owned(),
            difficulties: Vec::new(),
            fingerprint: String::new(),
            analysis_fingerprint: None,
            instructions_fingerprint: None,
        }
    }

    fn entry(source: &str, target: &str) -> GlossaryEntry {
        GlossaryEntry {
            source: source.to_owned(),
            target: target.to_owned(),
            note: None,
            locked: false,
        }
    }

    #[test]
    fn term_change_marks_only_hit_sentences_stale() {
        let before = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest_before = ContextDigest::from_brief(Some(&before));
        let mut records = TranslationProvenance::default();
        records.insert("s-1", digest_before.record_for("CucCut ships today"));
        records.insert("s-2", digest_before.record_for("nothing relevant here"));

        let after = brief_with(vec![entry("CucCut", "CucCut")], "a doc", "plain");
        let digest_after = ContextDigest::from_brief(Some(&after));
        let scan = scan_provenance(
            &records,
            &digest_after,
            [
                ("s-1", "CucCut ships today"),
                ("s-2", "nothing relevant here"),
            ],
        );
        assert_eq!(scan.stale, BTreeSet::from(["s-1".to_owned()]));
        assert!(scan.unknown.is_empty());
        assert!(scan.context_drift.is_empty());
    }

    #[test]
    fn unchanged_terms_are_clean() {
        let brief = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest = ContextDigest::from_brief(Some(&brief));
        let mut records = TranslationProvenance::default();
        records.insert("s-1", digest.record_for("CucCut ships today"));
        let scan = scan_provenance(&records, &digest, [("s-1", "CucCut ships today")]);
        assert!(scan.is_clean());
    }

    #[test]
    fn missing_record_is_unknown_not_stale() {
        let brief = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest = ContextDigest::from_brief(Some(&brief));
        let scan = scan_provenance(
            &TranslationProvenance::default(),
            &digest,
            [("s-1", "CucCut ships today")],
        );
        assert!(scan.stale.is_empty());
        assert_eq!(scan.unknown, BTreeSet::from(["s-1".to_owned()]));
    }

    #[test]
    fn summary_change_is_advisory_only() {
        let before = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest_before = ContextDigest::from_brief(Some(&before));
        let mut records = TranslationProvenance::default();
        records.insert("s-1", digest_before.record_for("CucCut ships today"));

        let after = brief_with(vec![entry("CucCut", "宝剪")], "a different doc", "plain");
        let digest_after = ContextDigest::from_brief(Some(&after));
        let scan = scan_provenance(&records, &digest_after, [("s-1", "CucCut ships today")]);
        assert!(scan.stale.is_empty());
        assert_eq!(scan.context_drift, BTreeSet::from(["s-1".to_owned()]));
    }

    #[test]
    fn missing_brief_never_marks_anything_stale() {
        // Runs such as `--no-brief` have no basis to compare against. If compared against an empty terminology set, s-1 would be judged "terms gone" and the whole document re-translated. This must stay silent here.
        let brief = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest = ContextDigest::from_brief(Some(&brief));
        let mut records = TranslationProvenance::default();
        records.insert("s-1", digest.record_for("CucCut ships today"));

        let no_basis = ContextDigest::from_brief(None);
        assert!(!no_basis.has_basis());
        let scan = scan_provenance(&records, &no_basis, [("s-1", "CucCut ships today")]);
        assert!(scan.is_clean(), "{scan:?}");
    }

    #[test]
    fn empty_glossary_is_a_real_basis() {
        // Contrast with "no brief": a user deleting all terms is a **real** change in basis, and the affected sentences should be judged stale.
        let before = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest_before = ContextDigest::from_brief(Some(&before));
        let mut records = TranslationProvenance::default();
        records.insert("s-1", digest_before.record_for("CucCut ships today"));

        let after = brief_with(Vec::new(), "a doc", "plain");
        let digest_after = ContextDigest::from_brief(Some(&after));
        assert!(digest_after.has_basis());
        let scan = scan_provenance(&records, &digest_after, [("s-1", "CucCut ships today")]);
        assert_eq!(scan.stale, BTreeSet::from(["s-1".to_owned()]));
    }

    #[test]
    fn round_trips_through_json() {
        let brief = brief_with(vec![entry("CucCut", "宝剪")], "a doc", "plain");
        let digest = ContextDigest::from_brief(Some(&brief));
        let mut records = TranslationProvenance::default();
        records.insert("s-g1.0", digest.record_for("CucCut ships today"));
        let json = serde_json::to_string(&records).expect("serialize");
        assert!(json.starts_with("{\"s-g1.0\":{\"contextHash\":"), "{json}");
        let back: TranslationProvenance = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back, records);
    }

    #[test]
    fn retain_drops_deleted_sentences() {
        let mut records = TranslationProvenance::default();
        records.insert("s-1", SentenceProvenance::default());
        records.insert("s-2", SentenceProvenance::default());
        records.retain_sentences(&BTreeSet::from(["s-2".to_owned()]));
        assert_eq!(records.sentences.len(), 1);
        assert!(records.get("s-2").is_some());
    }
}
