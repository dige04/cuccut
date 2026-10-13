//! The serde types for `ai/<stage>/manifest.json` (§4.2).
//!
//! core does not produce timestamps: `RunRecord::at` is filled in by the host.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::common::{PROTOCOL_VERSION, Problem};

/// Execution state of a stage or page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum RunStatus {
    /// Not started yet.
    #[default]
    Pending,
    /// In progress.
    Running,
    /// Completed.
    Done,
    /// Failed (the problems are written in `problems`).
    Failed,
}

impl RunStatus {
    /// Machine-readable string.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Done => "done",
            Self::Failed => "failed",
        }
    }
}

/// Audit record for a single page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageRecord {
    /// Page id (e.g. `p001`).
    pub id: String,
    /// Page state.
    pub status: RunStatus,
    /// Number of attempts made.
    #[serde(default)]
    pub attempts: u32,
    /// Input file name.
    pub src: String,
    /// Output file name (None until finished).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub out: Option<String>,
    /// Most recent protocol problem from parsing.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub problems: Vec<Problem>,
}

impl PageRecord {
    /// Constructs a page record to be executed.
    pub fn pending(id: impl Into<String>, src: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            status: RunStatus::Pending,
            attempts: 0,
            src: src.into(),
            out: None,
            problems: Vec::new(),
        }
    }
}

/// Audit record for one run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRecord {
    /// Timestamp filled in by the host (core does not read the clock).
    pub at: String,
    /// Run type (`full` / `stale-only` / `targeted` …).
    pub kind: String,
    /// Number of sentences covered by this run (optional).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sentences: Option<usize>,
}

/// `manifest.json`。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    /// Stage name.
    pub stage: String,
    /// Target language (translate/align only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    /// Stage version number (the numeric part of `v003`).
    pub version: u32,
    /// Protocol version, always [`PROTOCOL_VERSION`].
    pub protocol_version: String,
    /// Input fingerprint (word fingerprint + upstream stage stamps).
    pub input_fingerprint: String,
    /// Upstream stage versions (e.g. `{"context":"v001","polish":"v002"}`).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub parents: BTreeMap<String, String>,
    /// Model identifier.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Stage parameters (e.g. `{"fit":16}`).
    #[serde(default, skip_serializing_if = "serde_json::Map::is_empty")]
    pub params: serde_json::Map<String, serde_json::Value>,
    /// Per-page audit table.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pages: Vec<PageRecord>,
    /// Run history.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub runs: Vec<RunRecord>,
    /// Stage state.
    pub status: RunStatus,
}

impl Manifest {
    /// Constructs a new manifest (`protocolVersion` is filled in automatically).
    pub fn new(
        stage: impl Into<String>,
        version: u32,
        input_fingerprint: impl Into<String>,
    ) -> Self {
        Self {
            stage: stage.into(),
            lang: None,
            version,
            protocol_version: PROTOCOL_VERSION.to_owned(),
            input_fingerprint: input_fingerprint.into(),
            parents: BTreeMap::new(),
            model: None,
            params: serde_json::Map::new(),
            pages: Vec::new(),
            runs: Vec::new(),
            status: RunStatus::Pending,
        }
    }

    /// Whether this build supports the protocol version.
    pub fn protocol_supported(&self) -> bool {
        self.protocol_version == PROTOCOL_VERSION
    }

    /// Whether the fingerprint matches the given input (a mismatch means a rerun is needed).
    pub fn matches_input(&self, input_fingerprint: &str) -> bool {
        self.input_fingerprint == input_fingerprint
    }

    /// Pages not yet completed.
    pub fn unfinished_pages(&self) -> Vec<&PageRecord> {
        self.pages
            .iter()
            .filter(|page| page.status != RunStatus::Done)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filepipe::common::ProblemCode;

    #[test]
    fn manifest_round_trips_camel_case() {
        let mut manifest = Manifest::new("translate", 3, "1024:g1.0:g88.4:ab12cd");
        manifest.lang = Some("zh".to_owned());
        manifest.model = Some("provider:anthropic/claude-sonnet-5".to_owned());
        manifest
            .parents
            .insert("context".to_owned(), "v001".to_owned());
        manifest
            .parents
            .insert("polish".to_owned(), "v002".to_owned());
        manifest
            .params
            .insert("fit".to_owned(), serde_json::json!(16));
        let mut page = PageRecord::pending("p001", "p001.src.html");
        page.status = RunStatus::Done;
        page.attempts = 2;
        page.out = Some("p001.out.html".to_owned());
        manifest.pages.push(page);
        manifest.runs.push(RunRecord {
            at: "2026-08-13T00:00:00Z".to_owned(),
            kind: "stale-only".to_owned(),
            sentences: Some(12),
        });
        manifest.status = RunStatus::Done;

        let json = serde_json::to_string(&manifest).unwrap();
        assert!(json.contains("\"protocolVersion\":\"file-v1\""));
        assert!(json.contains("\"inputFingerprint\":\"1024:g1.0:g88.4:ab12cd\""));
        let decoded: Manifest = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, manifest);
        assert!(decoded.protocol_supported());
        assert!(decoded.matches_input("1024:g1.0:g88.4:ab12cd"));
        assert!(decoded.unfinished_pages().is_empty());
    }

    #[test]
    fn page_problems_serialize_with_codes() {
        let mut page = PageRecord::pending("p002", "p002.src.html");
        page.status = RunStatus::Failed;
        page.problems
            .push(Problem::sentence(ProblemCode::MissingId, "s-g1.0", "缺失"));
        let json = serde_json::to_string(&page).unwrap();
        assert!(json.contains("\"missing-id\""));
        let decoded: PageRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.problems[0].code, ProblemCode::MissingId);
    }
}
