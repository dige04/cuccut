//! Shared building blocks for implementers of [`crate::host::OverlayHost`].
//!
//! Why this layer exists: this crate **injects** the timeline projection into the host (discipline two), but the "shape of the projection" is defined by the kernel itself. `OverlayRenderPlan` only reads `document.pointer("/timeline/tracks")`, and requires `start` / `end` to already be resolved from word anchors into seconds. If each host wrote this rule separately, the CLI and App v2 would have two copies of anchor resolution. The same project would then place an element at 12.31 s in export and at 12.28 s in preview, and neither side would report an error. D2's original wording: “the CLI and the App each having their own copy is not allowed at any time.”
//!
//! So what lives here is the hosts' **shared implementation**, not the hosts themselves:
//! - [`word_timings_from_transcripts`]: transcripts → word timing table (the input to anchor resolution).
//! - [`tracks_with_resolved_anchors`]: serialization of `tracks` + word anchors → seconds.
//!
//! What stays in each host's own hands is **where the document is read from** (the CLI goes through `ProjectTimeline` / `IdAllocator` / `HistoryStore`, App v2 M1 only does a read-only load). That part will be unified together with `ccut-workspace` in the third cut of D2.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use serde_json::{Map, Value, json};
use speech_doc::doc::TranscriptDoc;
use timeline::schema::{TimeValue, WhiteboardBeat};
use timeline::{TimelineDocument, TimelineProjection, WordTiming, resolve_word_anchor};

/// `source id → word timing of that source`. `main` takes `transcript.json`; additional sources take `transcripts/<src>.json`.
pub type WordTimings = BTreeMap<String, Vec<WordTiming>>;

/// Reads all usable transcripts under the project and projects them into the timing table needed for word-anchor resolution.
///
/// A missing file is not an error. Additional sources often have no transcript of their own, and the main source may not have been transcribed yet. That source simply has no resolvable word anchors, and [`tracks_with_resolved_anchors`] reports the specific anchor error instead of rejecting the whole projection here.
pub fn word_timings_from_transcripts(
    project: &Path,
    document: &TimelineDocument,
) -> Result<WordTimings> {
    let mut source_ids = BTreeSet::from(["main".to_owned()]);
    source_ids.extend(document.sources.keys().cloned());
    let mut result = WordTimings::new();
    for source_id in source_ids {
        let path = if source_id == "main" {
            project.join("transcript.json")
        } else {
            project
                .join("transcripts")
                .join(format!("{source_id}.json"))
        };
        if !path.is_file() {
            continue;
        }
        let doc = TranscriptDoc::from_json(
            &fs::read(&path).with_context(|| format!("读取 {}", path.display()))?,
        )
        .map_err(|error| anyhow::anyhow!("{} 无效：{error:#}", path.display()))?;
        result.insert(
            source_id,
            doc.words
                .iter()
                .map(|word| WordTiming {
                    id: word.id.clone(),
                    t0: word.t0,
                    t1: word.t1,
                    hidden: doc.hidden.get(&word.id).copied().unwrap_or(false),
                })
                .collect(),
        );
    }
    Ok(result)
}

/// Projection of `document.tracks`: serialized as-is, then the word anchors in `start` / `end` are resolved into seconds.
///
/// Returns `(tracks, anchorErrors)`. The conventions match the kernel's reading rules one-to-one:
/// - `start` defaults to `0.0`. `end` defaults to the **content tail**: the larger of `projection.duration()` and the maximum of all numeric `end` values in the document (rounds 168 / 216: an empty project has no main material, so `endAnchor`-type items follow the tail of the finished piece as stretched out by the elements, rather than collapsing to zero length);
/// - when a word anchor resolves successfully, the value is written back to the field of the same name, and the original anchor is kept in `startAnchor` / `endAnchor`. The original anchors of whiteboard beats are kept in the element-level `whiteboardBeatAnchors[]` (`index / at / end / error`);
/// - when resolution fails, the field is set to `null` and `startError` / `endError` is written, and the failure is also collected into the second return value. When the kernel sees that `start` is not a number, it skips that element and leaves a warning. It **does not** render the whole frame as black. This is where “a bad anchor should not blow up the whole preview” is enforced.
/// - Word anchors for whiteboard `whiteboard.beats[].at` / `end` (0.9) are also resolved here: finished-video seconds minus the element's `start` are written back as element-local seconds. If either end fails to resolve, **the whole beat is dropped** (its strokes in the box fall back to geometric order), and the error is reported as `field: "whiteboard.beats[i].at|end"`. If the element's own `start` did not resolve, the element is skipped entirely and its beats are not reported separately.
pub fn tracks_with_resolved_anchors(
    document: &TimelineDocument,
    projection: &TimelineProjection,
    words: &WordTimings,
) -> (Value, Vec<Value>) {
    let mut tracks = serde_json::to_value(&document.tracks).expect("tracks serialize");
    let mut errors = Vec::new();
    // The content tail follows the kernel's single rule (`TimelineDocument::content_end`): for detached or pure-element documents it is determined only by the elements; for legacy documents it is the union of the main track and the elements.
    let content_end = document.content_end(projection);
    for (track_index, track) in document.tracks.iter().enumerate() {
        for (element_index, element) in track.elements.iter().enumerate() {
            let output = &mut tracks[track_index]["elements"][element_index];
            for (field, value, fallback) in [
                ("start", element.start.as_ref(), 0.0),
                ("end", element.end.as_ref(), content_end),
            ] {
                match value {
                    Some(TimeValue::Anchor(anchor)) => {
                        output[format!("{field}Anchor")] = json!(anchor);
                        match resolve_word_anchor(anchor, projection, words) {
                            Ok(time) => output[field] = json!(time),
                            Err(error) => {
                                output[field] = Value::Null;
                                output[format!("{field}Error")] = json!({
                                    "code": error.code(),
                                    "message": error.to_string(),
                                });
                                errors.push(json!({
                                    "code": error.code(),
                                    "trackId": track.id,
                                    "elementId": element.id,
                                    "field": field,
                                    "anchor": anchor,
                                    "message": error.to_string(),
                                }));
                            }
                        }
                    }
                    Some(TimeValue::Seconds(time)) => output[field] = json!(time),
                    None => output[field] = json!(fallback),
                }
            }
            let Some(beats) = element
                .whiteboard
                .as_ref()
                .and_then(|props| props.beats.as_ref())
                .filter(|beats| beats.iter().any(WhiteboardBeat::is_anchored))
            else {
                continue;
            };
            let start_secs = output["start"].as_f64();
            let mut kept = Vec::with_capacity(beats.len());
            let mut anchors = Vec::new();
            for (index, beat) in beats.iter().enumerate() {
                let mut resolved = serde_json::to_value(beat).expect("beat serialize");
                let mut record = json!({"index": index});
                let mut failure: Option<String> = None;
                for (field, value) in [("at", Some(&beat.at)), ("end", beat.end.as_ref())] {
                    let Some(TimeValue::Anchor(anchor)) = value else {
                        continue;
                    };
                    record[field] = json!(anchor);
                    match resolve_word_anchor(anchor, projection, words) {
                        Ok(time) => match start_secs {
                            Some(start) => resolved[field] = json!((time - start).max(0.0)),
                            None => {
                                failure.get_or_insert_with(|| {
                                    "元素 start 自己没有解析出来".to_owned()
                                });
                            }
                        },
                        Err(error) => {
                            failure.get_or_insert_with(|| error.to_string());
                            errors.push(json!({
                                "code": error.code(),
                                "trackId": track.id,
                                "elementId": element.id,
                                "field": format!("whiteboard.beats[{index}].{field}"),
                                "anchor": anchor,
                                "message": error.to_string(),
                            }));
                        }
                    }
                }
                if record.as_object().map_or(0, Map::len) > 1 {
                    if let Some(message) = &failure {
                        record["error"] = json!(message);
                    }
                    anchors.push(record);
                }
                if failure.is_none() {
                    kept.push(resolved);
                }
            }
            output["whiteboard"]["beats"] = Value::Array(kept);
            // The original anchors are kept in the element-level `whiteboardBeatAnchors` (same convention as `startAnchor`). The thin view uses them to identify beats that follow the narration and to list beats whose resolution failed. `render_plan` strips them before rendering.
            output["whiteboardBeatAnchors"] = Value::Array(anchors);
        }
    }
    (tracks, errors)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn document(tracks: Value) -> TimelineDocument {
        serde_json::from_value(json!({
            "ccutTimeline": "0.1",
            "sources": {},
            "clips": [],
            "tracks": tracks,
        }))
        .unwrap()
    }

    fn projection(document: &TimelineDocument, duration: f64) -> TimelineProjection {
        projection_of(document, duration)
    }

    fn projection_of(document: &TimelineDocument, duration: f64) -> TimelineProjection {
        TimelineProjection::build(document, &BTreeMap::from([("main".to_owned(), duration)]))
            .unwrap()
    }

    #[test]
    fn missing_bounds_fall_back_to_zero_and_duration() {
        let document = document(json!([{
            "id": "tr-1",
            "kind": "overlay",
            "elements": [{"id": "el-1", "kind": "text", "text": "hi"}],
        }]));
        let projection = projection(&document, 30.0);
        let (tracks, errors) =
            tracks_with_resolved_anchors(&document, &projection, &WordTimings::new());

        assert!(errors.is_empty());
        let element = &tracks[0]["elements"][0];
        assert_eq!(element["start"], json!(0.0));
        assert_eq!(element["end"], json!(30.0));
    }

    /// Round 216: an empty project has a duration of 0, and `endAnchor`-type items follow the content tail stretched out by the other elements.
    #[test]
    fn missing_end_follows_the_content_end_when_the_film_is_open_ended() {
        let document = document(json!([{
            "id": "tr-1",
            "kind": "overlay",
            "elements": [
                {"id": "el-1", "kind": "text", "text": "hi"},
                {"id": "el-2", "kind": "text", "text": "later", "start": 4.0, "end": 14.0},
            ],
        }]));
        let projection = projection(&document, 0.0);
        let (tracks, errors) =
            tracks_with_resolved_anchors(&document, &projection, &WordTimings::new());
        assert!(errors.is_empty());
        assert_eq!(tracks[0]["elements"][0]["end"], json!(14.0));
        // When there is a duration, it is still the lower bound: the content tail will not shorten a 30 s piece.
        let projection = projection_of(&document, 30.0);
        let (tracks, _) = tracks_with_resolved_anchors(&document, &projection, &WordTimings::new());
        assert_eq!(tracks[0]["elements"][0]["end"], json!(30.0));
    }

    /// 0.9: whiteboard beat word anchors resolve to **element-local seconds**. A beat that cannot be resolved is dropped as a whole and reported as `whiteboard.beats[i].at|end`. The element and the other beats are unchanged.
    #[test]
    fn whiteboard_beat_anchors_resolve_to_local_seconds_and_bad_beats_are_dropped() {
        let document: TimelineDocument = serde_json::from_value(json!({
            "ccutTimeline": "0.9",
            "sources": {"board": {"path": "media/board.png", "kind": "image"}},
            "clips": [],
            "tracks": [{
            "id": "tr-1",
            "kind": "overlay",
            "elements": [{
                "id": "wb",
                "kind": "whiteboard",
                "srcId": "board",
                "start": "~main:w1:start",
                "end": 20.0,
                "whiteboard": {"draw": 6.0, "pace": "natural", "beats": [
                    {"at": "~main:w1:start", "end": "~main:w1:end", "box": [0, 0, 50, 100], "label": "一"},
                    {"at": "~main:w9:start", "box": [50, 0, 50, 100]},
                    {"at": 3.0, "end": "~main:w2:end", "box": [0, 50, 100, 50]}
                ]}
            }],
        }]}))
        .unwrap();
        let projection = TimelineProjection::build(
            &document,
            &BTreeMap::from([("main".to_owned(), 30.0), ("board".to_owned(), 0.0)]),
        )
        .unwrap();
        let words = WordTimings::from([(
            "main".to_owned(),
            vec![
                WordTiming {
                    id: "w1".into(),
                    t0: 1.0,
                    t1: 2.5,
                    hidden: false,
                },
                WordTiming {
                    id: "w2".into(),
                    t0: 2.5,
                    t1: 5.0,
                    hidden: false,
                },
            ],
        )]);
        let (tracks, errors) = tracks_with_resolved_anchors(&document, &projection, &words);
        assert_eq!(errors.len(), 1, "{errors:?}");
        assert_eq!(errors[0]["elementId"], json!("wb"));
        assert_eq!(errors[0]["field"], json!("whiteboard.beats[1].at"));
        assert_eq!(errors[0]["anchor"], json!("~main:w9:start"));
        let element = &tracks[0]["elements"][0];
        assert_eq!(element["start"], json!(1.0));
        let beats = element["whiteboard"]["beats"].as_array().unwrap();
        assert_eq!(beats.len(), 2);
        assert_eq!(beats[0]["at"], json!(0.0));
        assert_eq!(beats[0]["end"], json!(1.5));
        assert_eq!(beats[0]["label"], json!("一"));
        assert_eq!(beats[1]["at"], json!(3.0));
        assert_eq!(beats[1]["end"], json!(4.0));
        assert_eq!(element["whiteboard"]["pace"], json!("natural"));
        // The resolved shape can still be read back as WhiteboardProps (without extra keys).
        let props: timeline::WhiteboardProps =
            serde_json::from_value(element["whiteboard"].clone()).unwrap();
        assert_eq!(props.beats.unwrap()[0].end_local(), Some(1.5));
        // The original anchors stay in the element-level `whiteboardBeatAnchors`: all three beats carry anchors, and beat 2 carries an error.
        let anchors = element["whiteboardBeatAnchors"].as_array().unwrap();
        assert_eq!(anchors.len(), 3);
        assert_eq!(anchors[0]["index"], json!(0));
        assert_eq!(anchors[0]["at"], json!("~main:w1:start"));
        assert_eq!(anchors[0]["end"], json!("~main:w1:end"));
        assert!(anchors[0].get("error").is_none());
        assert_eq!(anchors[1]["index"], json!(1));
        assert!(anchors[1]["error"].is_string());
        assert_eq!(anchors[2]["index"], json!(2));
        assert!(anchors[2].get("at").is_none());
        assert_eq!(anchors[2]["end"], json!("~main:w2:end"));
    }

    #[test]
    fn word_anchors_resolve_to_seconds_and_keep_the_anchor() {
        let document = document(json!([{
            "id": "tr-1",
            "kind": "overlay",
            "elements": [{
                "id": "el-1",
                "kind": "text",
                "text": "hi",
                "start": "~main:w2:start",
                "end": "~main:w2:end",
            }],
        }]));
        let projection = projection(&document, 30.0);
        let words = WordTimings::from([(
            "main".to_owned(),
            vec![
                WordTiming {
                    id: "w1".into(),
                    t0: 0.0,
                    t1: 1.0,
                    hidden: false,
                },
                WordTiming {
                    id: "w2".into(),
                    t0: 2.5,
                    t1: 3.25,
                    hidden: false,
                },
            ],
        )]);

        let (tracks, errors) = tracks_with_resolved_anchors(&document, &projection, &words);

        assert!(errors.is_empty(), "意外的 anchor 错误：{errors:?}");
        let element = &tracks[0]["elements"][0];
        assert_eq!(element["start"], json!(2.5));
        assert_eq!(element["end"], json!(3.25));
        // The original anchors must be kept. The authoring field is the source of truth; the seconds are a derived projection.
        assert_eq!(element["startAnchor"], json!("~main:w2:start"));
    }

    #[test]
    fn an_unresolvable_anchor_nulls_the_field_and_reports_once() {
        let document = document(json!([{
            "id": "tr-1",
            "kind": "overlay",
            "elements": [{
                "id": "el-1",
                "kind": "text",
                "text": "hi",
                "start": "~main:gone:start",
            }],
        }]));
        let projection = projection(&document, 30.0);
        let (tracks, errors) =
            tracks_with_resolved_anchors(&document, &projection, &WordTimings::new());

        assert_eq!(errors.len(), 1, "每个坏锚一条：{errors:?}");
        assert_eq!(errors[0]["elementId"], json!("el-1"));
        assert_eq!(errors[0]["field"], json!("start"));
        let element = &tracks[0]["elements"][0];
        assert!(element["start"].is_null());
        assert!(element["startError"]["code"].is_string());
    }

    #[test]
    fn transcripts_load_per_source_and_missing_files_are_not_errors() {
        let project = tempfile::tempdir().unwrap();
        fs::write(
            project.path().join("transcript.json"),
            serde_json::to_vec(&json!({
                "ccutTranscript": "0.3",
                "media": {"path": "main.mp4", "hash": "deadbeef", "duration": 10.0},
                "lang": "en",
                "engine": {"name": "test", "alignedWords": true},
                "speakers": {"s1": {"name": "S1"}},
                "words": [
                    {"id": "w1", "t0": 0.0, "t1": 0.5, "text": "hello", "sp": "s1"},
                    {"id": "w2", "t0": 0.5, "t1": 1.0, "text": "world", "sp": "s1"},
                ],
            }))
            .unwrap(),
        )
        .unwrap();
        let document = document(json!([]));

        let words = word_timings_from_transcripts(project.path(), &document).unwrap();

        assert_eq!(words.len(), 1, "只有 main 有转录稿");
        assert_eq!(words["main"].len(), 2);
        assert_eq!(words["main"][1].id, "w2");
    }
}
