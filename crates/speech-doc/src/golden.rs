//! Parsing and validation of the alignment golden set (`ccut-align-golden/1`).
//!
//! The data lives in `core/fixtures/align/golden/<project>/<lang>.json`; for the format and field semantics,
//! see `README.md` in the same directory. This module **only does parsing and pure validation**: `ccut-flow-core` does no
//! I/O; reading files is the job of the test harness (`tests/golden_align.rs`), and this module only exposes
//! [`GoldenFile::from_str`].
//!
//! Metric computation is in [`crate::metrics`] ([`crate::metrics::bead_prf`] /
//! [`crate::metrics::boundary_f1`] / [`crate::metrics::path_exact_match`]).

use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};

use crate::doc::Correspondence;
use crate::metrics::{Bead, beads_contiguous};

/// Schema string of the golden file.
pub const GOLDEN_SCHEMA: &str = "ccut-align-golden/1";

/// 13 tag values corresponding to 12 classes of annotated phenomena (`omission` / `addition` are the two directions of the "omitted translation / added translation"
/// class). The order is the order listed in the README.
pub const GOLDEN_TAGS: &[&str] = &[
    "1:1",
    "1:N",
    "N:1",
    "N:M",
    "causal-inversion",
    "attributive-reorder",
    "negation",
    "number",
    "proper-noun",
    "term",
    "omission",
    "addition",
    "hard-negative",
];

/// On-disk form of a bead: a half-open interval `[start, end)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct GoldenBead {
    /// Half-open interval of source word indices (the index is the position in `sourceWords`).
    pub src: [usize; 2],
    /// Half-open interval over target `chars()` (the index is the position in `target.chars()`).
    pub tgt: [usize; 2],
}

impl GoldenBead {
    pub fn bead(&self) -> Bead {
        Bead::new(self.src[0]..self.src[1], self.tgt[0]..self.tgt[1])
    }
}

/// Hard anchor: the target character interval that a given source word must land in (numbers, proper nouns, Latin kept as-is, locked terms).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct GoldenAnchor {
    /// Source word index.
    pub src: usize,
    /// Half-open interval over target `chars()`.
    pub tgt: [usize; 2],
}

/// Human-labelled expectation for this sentence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldenExpectation {
    /// Expected correspondence granularity: `block` = can be compared at block level, `sentence` = only whole-sentence correspondence is possible.
    pub correspondence: Correspondence,
    /// Minimum number of blocks a human judges should be reached (usually = `beads.len()`).
    pub min_blocks: usize,
    /// Adjacent hard-negative pair: this case must be distinguishable from that case.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hard_negative_of: Option<String>,
}

/// One golden case.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldenCase {
    /// Globally unique case id (`<project-short>-<lang>-<index>`).
    pub id: String,
    /// The sentence id actually derived from this transcript (`s-<first word id>`).
    pub sentence_id: String,
    /// Word text within the sentence; must match the derived Sentence's words one by one.
    pub source_words: Vec<String>,
    /// Human-confirmed whole-sentence translation in the target language; `beads[].tgt` are indices into its `chars()`.
    pub target: String,
    /// Phenomenon tag; for the allowed values see [`GOLDEN_TAGS`].
    pub tags: Vec<String>,
    /// Human-annotated minimal monotone alignment block partition (contiguous, full coverage on both sides, and monotone).
    pub beads: Vec<GoldenBead>,
    #[serde(default)]
    pub hard_anchors: Vec<GoldenAnchor>,
    pub expected: GoldenExpectation,
}

impl GoldenCase {
    /// The annotated bead sequence.
    pub fn beads(&self) -> Vec<Bead> {
        self.beads.iter().map(GoldenBead::bead).collect()
    }

    /// Number of characters in the target text.
    pub fn target_chars(&self) -> usize {
        self.target.chars().count()
    }

    /// Structural self-check (does not check the transcript; that part is done by the host against the derived Sentence):
    /// tags are valid, beads are contiguous with full coverage and monotone on both sides, hard anchors fall within the bead that owns their source word, and
    /// `minBlocks` does not exceed the number of annotated blocks.
    pub fn validate(&self) -> Result<()> {
        if self.id.is_empty() || self.sentence_id.is_empty() {
            bail!("golden 用例缺少 id / sentenceId");
        }
        if self.source_words.is_empty() {
            bail!("{}: sourceWords 为空", self.id);
        }
        if self.tags.is_empty() {
            bail!("{}: tags 为空", self.id);
        }
        for tag in &self.tags {
            if !GOLDEN_TAGS.contains(&tag.as_str()) {
                bail!("{}: 未知 tag {tag}", self.id);
            }
        }
        let beads = self.beads();
        if !beads_contiguous(&beads, self.source_words.len(), self.target_chars()) {
            bail!("{}: beads 不是两侧连续全覆盖的单调划分", self.id);
        }
        if self.expected.min_blocks == 0 || self.expected.min_blocks > beads.len() {
            bail!(
                "{}: expected.minBlocks={} 超出标注块数 {}",
                self.id,
                self.expected.min_blocks,
                beads.len()
            );
        }
        for anchor in &self.hard_anchors {
            let Some(bead) = beads.iter().find(|bead| bead.src.contains(&anchor.src)) else {
                bail!("{}: 硬锚源词 {} 越界", self.id, anchor.src);
            };
            if anchor.tgt[0] >= anchor.tgt[1]
                || anchor.tgt[0] < bead.tgt.start
                || anchor.tgt[1] > bead.tgt.end
            {
                bail!(
                    "{}: 硬锚源词 {} 的目标区间不在其 bead 内",
                    self.id,
                    anchor.src
                );
            }
        }
        Ok(())
    }
}

/// One `<project>/<lang>.json` file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldenFile {
    /// Always [`GOLDEN_SCHEMA`].
    pub schema: String,
    /// The directory name of `examples/<project>.ccut` (without `.ccut`).
    pub project: String,
    /// Target language (BCP-47 primary subtag).
    pub lang: String,
    pub cases: Vec<GoldenCase>,
}

impl GoldenFile {
    /// Parses and performs the structural self-check (no I/O).
    ///
    /// Deliberately does not implement `std::str::FromStr`: the error type is `anyhow::Error`, and this only
    /// serves the test harness, so it has no need for the generic `"...".parse()` entry point.
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(text: &str) -> Result<Self> {
        let file: Self = serde_json::from_str(text)?;
        file.validate()?;
        Ok(file)
    }

    /// Checks the schema, the language, uniqueness of case ids, and runs [`GoldenCase::validate`] on each case.
    pub fn validate(&self) -> Result<()> {
        if self.schema != GOLDEN_SCHEMA {
            bail!("未知 golden schema {}", self.schema);
        }
        if self.project.is_empty() || self.lang.is_empty() {
            bail!("golden 文件缺少 project / lang");
        }
        if self.cases.is_empty() {
            bail!("{}/{}: cases 为空", self.project, self.lang);
        }
        let mut seen = std::collections::BTreeSet::new();
        for case in &self.cases {
            if !seen.insert(case.id.as_str()) {
                bail!("{}/{}: 重复用例 id {}", self.project, self.lang, case.id);
            }
            case.validate()?;
        }
        for case in &self.cases {
            let Some(reference) = case.expected.hard_negative_of.as_deref() else {
                continue;
            };
            if reference == case.id || !seen.contains(reference) {
                bail!("{}: hardNegativeOf {reference} 不在同一文件内", case.id);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "schema": "ccut-align-golden/1",
      "project": "demo",
      "lang": "zh",
      "cases": [
        {
          "id": "demo-zh-001",
          "sentenceId": "s-g12.0",
          "sourceWords": ["I", "didn't", "go", "because", "I", "was", "sick"],
          "target": "因为我病了，所以没去",
          "tags": ["N:M", "causal-inversion"],
          "beads": [{ "src": [0, 7], "tgt": [0, 10] }],
          "hardAnchors": [],
          "expected": { "correspondence": "block", "minBlocks": 1 }
        }
      ]
    }"#;

    #[test]
    fn parses_and_validates_sample() {
        let file = GoldenFile::from_str(SAMPLE).expect("sample parses");
        assert_eq!(file.schema, GOLDEN_SCHEMA);
        assert_eq!(file.cases.len(), 1);
        let case = &file.cases[0];
        assert_eq!(case.target_chars(), 10);
        assert_eq!(case.beads(), vec![Bead::new(0..7, 0..10)]);
    }

    #[test]
    fn rejects_non_covering_beads() {
        let broken = SAMPLE.replace(
            r#"{ "src": [0, 7], "tgt": [0, 10] }"#,
            r#"{ "src": [0, 6], "tgt": [0, 10] }"#,
        );
        let error = GoldenFile::from_str(&broken).expect_err("must reject");
        assert!(error.to_string().contains("连续全覆盖"), "{error}");
    }

    #[test]
    fn rejects_unknown_tag() {
        let broken = SAMPLE.replace(r#""causal-inversion""#, r#""nonsense""#);
        let error = GoldenFile::from_str(&broken).expect_err("must reject");
        assert!(error.to_string().contains("未知 tag"), "{error}");
    }

    #[test]
    fn rejects_unknown_schema() {
        let broken = SAMPLE.replace("ccut-align-golden/1", "ccut-align-golden/9");
        let error = GoldenFile::from_str(&broken).expect_err("must reject");
        assert!(error.to_string().contains("未知 golden schema"), "{error}");
    }

    #[test]
    fn rejects_dangling_hard_negative() {
        let broken = SAMPLE.replace(
            r#""minBlocks": 1"#,
            r#""minBlocks": 1, "hardNegativeOf": "demo-zh-999""#,
        );
        let error = GoldenFile::from_str(&broken).expect_err("must reject");
        assert!(error.to_string().contains("hardNegativeOf"), "{error}");
    }
}
