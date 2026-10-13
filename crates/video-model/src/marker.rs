//! Markers on a sequence (video format spec §3.13). Chapters are markers with `kind: 'chapter'`.

use serde::{Deserialize, Serialize};

use crate::{Id, VersionRef};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    pub id: Id,
    /// Sequence frame. Fixed to sequence time; does not move with instances.
    pub frame: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_frames: Option<i64>,
    /// The marker's text; the chapter's title.
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<MarkerKind>,
    /// The chapter's description.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// The chapter's thumbnail: an image material version. When omitted, the UI uses the picture of the frame where the chapter starts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<VersionRef>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarkerKind {
    Chapter,
    Note,
    Todo,
}

impl Marker {
    pub fn is_chapter(&self) -> bool {
        self.kind == Some(MarkerKind::Chapter)
    }
}
