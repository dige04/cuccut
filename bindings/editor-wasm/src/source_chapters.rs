//! Parsing and snapping of chapters the source provides (architecture design §3.5, §7.9): material imported from a link carries, in `provenance.source`, the chapters the platform supplies (`chapters[]`) and the description (`description`, which often contains a timestamped outline). The agent's `chapters_adopt` and `videos_inspect` use the same rules here (`speech_doc::source_chapters`, ported unchanged from the old version).
//!
//! - Source chapters: an explicit outline (`outline`, an array or raw text) takes priority. Otherwise read the source metadata: take the structured `chapters[]` first (recognizing `start_time|start`, `end_time|end`, `title`), and if there are none, parse a timestamped outline from `description` (at least two entries). Cleanup: drop empty titles and invalid times, sort, deduplicate by start, and cap the count.
//! - Snapping: an author's timestamp is accurate to the second at most and is often a few seconds earlier than the real start of the topic, so each one is snapped to the nearest structural start in the transcript (paragraph > sentence > cue > word):
//!   within the one-second window `[t-1, t+2]` (inclusive), look for paragraph, sentence and cue starts in turn; if one candidate is at a level it is `matched`; if there are several it is `ambiguous` (the default is the nearest; at equal distance, the one after the timestamp);
//!   if none is found, widen to `[t-4, t+6]`, considering only paragraph and sentence starts, and take the nearest (`snapped`); if still none, look for a word start in the same one-second window; if there are none at all, keep the original time (`unanchored`).
//! - Rows: the final chapters come from the deterministic cleanup of the timed version (`resolve_rows`): drop empty titles, sort by start, deduplicate by start, clamp the first chapter to 0, and drop any that are not strictly increasing;
//!   each end is backfilled from the next chapter's start, and the last chapter ends at `durationSeconds`.
//!
//! All times are seconds of source (media) time; projecting them onto the timeline is done by the host. With no source chapters, it returns an empty result without an error (the error codes are decided by the host).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use speech_doc::source_chapters::{
    Anchor, AnchorTier, SnapPlan, SnapStatus, SourceChapter, doc_anchors, from_metadata, normalize, parse_description, resolve_rows,
    snap_to_anchors,
};
use speech_doc_bridge::{V3Documents, to_transcript_doc};
use video_model::speech::SpeechBody;

use crate::speakers::media_for;
use crate::{EntryError, invalid_input};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceChaptersInput {
    /// The material's transcript body; omitted when there is no transcript (or `snap: false`), in which case all entries keep their original time (`unanchored`).
    #[serde(default)]
    speech: Option<SpeechBody>,
    /// The material's source metadata (`provenance.source`).
    #[serde(default)]
    source: Option<Value>,
    /// An explicit outline, which takes priority over `source`: `[{ at, title }]`, or raw text (parsed as a timestamped outline from the description).
    #[serde(default)]
    outline: Option<Outline>,
    /// The material's duration (seconds): the end of the last chapter.
    duration_seconds: f64,
    /// Default true; false means parse only, without snapping.
    #[serde(default)]
    snap: Option<bool>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Outline {
    Rows(Vec<OutlineRow>),
    Text(String),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OutlineRow {
    at: f64,
    title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceChaptersOutput {
    source_chapters: Vec<SourceChapter>,
    entries: Vec<EntryOutput>,
    rows: Vec<RowOutput>,
    summary: SummaryOutput,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EntryOutput {
    source: SourceRef,
    status: SnapStatus,
    /// The snapped start (source time in seconds); when `unanchored`, the author's original time.
    at: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    anchor: Option<AnchorOutput>,
    candidates: Vec<AnchorOutput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceRef {
    start: f64,
    title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AnchorOutput {
    tier: AnchorTier,
    id: String,
    time: f64,
    snippet: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RowOutput {
    title: String,
    start: f64,
    end: f64,
    status: SnapStatus,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct SummaryOutput {
    entries: usize,
    matched: usize,
    ambiguous: usize,
    snapped: usize,
    unanchored: usize,
}

fn anchor_output(anchor: &Anchor) -> AnchorOutput {
    AnchorOutput {
        tier: anchor.tier,
        id: anchor.id.clone(),
        time: anchor.time,
        snippet: anchor.snippet.clone(),
    }
}

/// Source chapters: an explicit outline takes priority, then the source metadata.
fn chapters_of(input: &SourceChaptersInput) -> Vec<SourceChapter> {
    match &input.outline {
        Some(Outline::Rows(rows)) => normalize(
            rows.iter()
                .map(|row| SourceChapter {
                    start: row.at,
                    end: None,
                    title: row.title.clone(),
                })
                .collect(),
        ),
        Some(Outline::Text(text)) => parse_description(text),
        None => input.source.as_ref().map(from_metadata).unwrap_or_default(),
    }
}

/// The four-layer anchors of the transcript; empty when there is no transcript or snapping is off.
fn anchors_of(input: &SourceChaptersInput) -> Result<Vec<Anchor>, EntryError> {
    let Some(speech) = input.speech.as_ref().filter(|_| input.snap != Some(false)) else {
        return Ok(Vec::new());
    };
    // The duration takes the end of the last word (core validation requires words not to run past the duration); the material's duration is used only for the last chapter's end.
    let media = media_for(speech);
    let doc = to_transcript_doc(&V3Documents {
        media: &media,
        language: None,
        speech,
        translations: &[],
    })
    .map_err(|error| EntryError {
        code: "INVALID_SPEECH",
        message: error.message,
    })?;
    Ok(doc_anchors(&doc))
}

/// Which entry each cleaned row corresponds to: the first row's start is clamped to 0 and matched by title to the entry with the earliest start; the rest are matched by (title, start).
fn row_status(plan: &SnapPlan, index: usize, title: &str, start: f64) -> SnapStatus {
    let mut same_title = plan.entries.iter().filter(|entry| entry.source.title.trim() == title);
    let entry = if index == 0 {
        same_title.min_by(|a, b| a.start().total_cmp(&b.start()))
    } else {
        same_title.find(|entry| entry.start() == start)
    };
    entry.map_or(SnapStatus::Unanchored, |entry| entry.status)
}

/// Parsing and snapping of source chapters (JSON). Input that cannot be read is `INVALID_INPUT`; a transcript body in the wrong format is `INVALID_SPEECH`.
pub fn source_chapters(input: &[u8]) -> Result<String, EntryError> {
    let input: SourceChaptersInput = serde_json::from_slice(input).map_err(invalid_input)?;
    let chapters = chapters_of(&input);
    let anchors = if chapters.is_empty() { Vec::new() } else { anchors_of(&input)? };
    let plan = snap_to_anchors(&chapters, &anchors);
    let duration = if input.duration_seconds.is_finite() {
        input.duration_seconds.max(0.0)
    } else {
        0.0
    };
    let rows = resolve_rows(&plan.rows(), duration)
        .into_iter()
        .enumerate()
        .map(|(index, row)| RowOutput {
            status: row_status(&plan, index, &row.title, row.start),
            title: row.title,
            start: row.start,
            end: row.end,
        })
        .collect();
    let entries = plan
        .entries
        .iter()
        .map(|entry| EntryOutput {
            source: SourceRef {
                start: entry.source.start,
                title: entry.source.title.clone(),
            },
            status: entry.status,
            at: entry.start(),
            anchor: entry
                .pick
                .and_then(|pick| entry.candidates.get(pick))
                .map(|candidate| anchor_output(&candidate.anchor)),
            candidates: entry.candidates.iter().map(|candidate| anchor_output(&candidate.anchor)).collect(),
        })
        .collect();
    let summary = SummaryOutput {
        entries: plan.entries.len(),
        matched: plan.count(SnapStatus::Matched),
        ambiguous: plan.count(SnapStatus::Ambiguous),
        snapped: plan.count(SnapStatus::Snapped),
        unanchored: plan.count(SnapStatus::Unanchored),
    };
    let output = SourceChaptersOutput {
        source_chapters: chapters,
        entries,
        rows,
        summary,
    };
    Ok(serde_json::to_string(&output).expect("source chapters always serialize"))
}
