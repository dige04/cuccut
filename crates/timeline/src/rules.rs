//! Document predicates shared across all surfaces. **This is the single source of truth.**
//!
//! On 2026-09-16 a global audit found that three rules ("legacy vs. detached document", "where the original audio is", and "how long the finished cut is") each had their own implementation in the kernel crates, the App and the Web, and the criteria had drifted apart (without a `main` object, some counted it as legacy and some as element-only; original audio sometimes excluded `hasAudio:false` and sometimes didn't; the cut length was sometimes measured on the source clock and sometimes by elements). From now on the three rules are defined only here. Each surface only projects its own types (`TimelineDocument` / editor projection / raw JSON) into the rules' inputs:
//!
//! - [`legacy_main`]: whether the document has a **privileged main track**. It is not marked `main.detached`, and there really is a main-track clip sequence, either explicit `clips[]` or the implicit whole-length clip that arrange synthesizes for a `main` source with a duration. An empty project (`main` absent / `null`, no clips, no main media) is **not** a legacy document but an element-only document: all tracks are equal, with no main video and no main audio.
//! - [`content_end`]: the length of the finished cut. For detached / element-only documents it is determined only by the elements' explicit ends (0 if none); a legacy document is the union of the main-track clips and the element ends.
//! - [`original_audio`]: where the original audio is. In a legacy document it is `main.muted`. For other documents it is the sound carried by **every** `kind:"video"` element on the timeline (any track, any `srcId`), except where the source is explicitly marked `hasAudio:false`. A detached `kind:"audio"` element is an ordinary audio track and does not count as original audio.
use crate::arrange::TimelineProjection;
use crate::schema::{ElementKind, TimeValue, TimelineDocument};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

// ---------------------------------------------------------------------------
// Legacy privileged main track
// ---------------------------------------------------------------------------

/// Whether the document has a legacy privileged main track: not marked `detached`, and it actually has main-track clips (explicit or implicit).
pub fn legacy_main(detached: bool, has_main_clips: bool) -> bool {
    !detached && has_main_clips
}

/// `main.detached` of the raw JSON (`timeline.json` or the studio projection).
pub fn detached_json(timeline: &Value) -> bool {
    timeline
        .pointer("/main/detached")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

/// [`legacy_main`] on raw JSON. `main_duration` is the main media's duration (arrange synthesizes an implicit whole-length clip for a `main` source that has a duration). If the caller does not know it, pass 0, in which case only explicit `clips[]` count.
pub fn legacy_main_json(timeline: &Value, main_duration: f64) -> bool {
    let has_clips = timeline
        .get("clips")
        .and_then(Value::as_array)
        .is_some_and(|clips| !clips.is_empty());
    legacy_main(
        detached_json(timeline),
        has_clips || (main_duration.is_finite() && main_duration > 0.0),
    )
}

impl TimelineDocument {
    /// `main.detached` is already set (the main video has been split into ordinary elements).
    pub fn is_detached(&self) -> bool {
        self.main.as_ref().is_some_and(|main| main.detached)
    }

    /// [`legacy_main`], counting only explicit `clips[]` (the criterion when there is no projection).
    pub fn has_legacy_main(&self) -> bool {
        legacy_main(self.is_detached(), !self.clips.is_empty())
    }

    /// [`legacy_main`], counting the clips in the projection (including the implicit whole-length clip synthesized by arrange).
    pub fn has_legacy_main_with(&self, projection: &TimelineProjection) -> bool {
        legacy_main(self.is_detached(), !projection.clips().is_empty())
    }
}

// ---------------------------------------------------------------------------
// Finished cut length
// ---------------------------------------------------------------------------

/// Finished cut length. `element_ends` are the elements' explicit ends (`end: None`, word anchors and non-finite values do not count; they follow the end of the cut and cannot extend it in return). `clip_ends` are the timeline ends of the main-track clips, and only take part for legacy documents. Hiding or muting does not change the layout length.
pub fn content_end(
    legacy: bool,
    element_ends: impl IntoIterator<Item = f64>,
    clip_ends: impl IntoIterator<Item = f64>,
) -> f64 {
    let elements_end = element_ends
        .into_iter()
        .filter(|end| end.is_finite())
        .fold(0.0, f64::max)
        .max(0.0);
    if !legacy {
        return elements_end;
    }
    clip_ends
        .into_iter()
        .filter(|end| end.is_finite())
        .fold(elements_end, f64::max)
}

impl TimelineDocument {
    fn element_ends(&self) -> impl Iterator<Item = f64> + '_ {
        self.tracks
            .iter()
            .flat_map(|track| track.elements.iter())
            .filter_map(|element| match element.end {
                Some(TimeValue::Seconds(end)) => Some(end),
                _ => None,
            })
    }

    /// [`content_end`]: the end of the main-track clips is the projection's duration.
    pub fn content_end(&self, projection: &TimelineProjection) -> f64 {
        content_end(
            self.has_legacy_main_with(projection),
            self.element_ends(),
            [projection.duration()],
        )
    }
}

// ---------------------------------------------------------------------------
// Original audio
// ---------------------------------------------------------------------------

/// An element that may carry original audio, projected by the caller from its own type.
#[derive(Debug, Clone, Copy)]
pub struct AudioCarrier<'a> {
    pub id: &'a str,
    /// `kind == "video"`。
    pub video: bool,
    /// The source's registered `hasAudio`. Unregistered or unknown counts as having audio.
    pub source_has_audio: Option<bool>,
    pub hidden: bool,
    pub muted: bool,
    pub track_hidden: bool,
    pub track_muted: bool,
}

/// Where the original audio is, and whether it is on.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginalAudio {
    /// Legacy document: the original audio is the main track, its switch is `main.muted`, and `element_ids` is empty.
    pub legacy_main: bool,
    /// Whether there is original audio to toggle (if not, no `audio` lane is listed). Legacy documents always have it.
    pub has: bool,
    /// Original audio is off. For an element document: none of the carrying elements is still producing sound (neither the element nor its track is hidden / muted). With no carrying element there is no sound to output, so it counts as off.
    pub muted: bool,
    /// IDs of the elements carrying original audio, in document order.
    pub element_ids: Vec<String>,
}

/// The single algorithm behind [`OriginalAudio`]. `legacy_main_muted` is the `main.muted` of a legacy document (pass `None` for documents that are not legacy).
pub fn original_audio<'a>(
    legacy_main_muted: Option<bool>,
    carriers: impl IntoIterator<Item = AudioCarrier<'a>>,
) -> OriginalAudio {
    if let Some(muted) = legacy_main_muted {
        return OriginalAudio {
            legacy_main: true,
            has: true,
            muted,
            element_ids: Vec::new(),
        };
    }
    let mut element_ids = Vec::new();
    let mut audible = false;
    for carrier in carriers {
        if !carrier.video || carrier.source_has_audio == Some(false) {
            continue;
        }
        element_ids.push(carrier.id.to_owned());
        if !(carrier.hidden || carrier.muted || carrier.track_hidden || carrier.track_muted) {
            audible = true;
        }
    }
    OriginalAudio {
        legacy_main: false,
        has: !element_ids.is_empty(),
        muted: !audible,
        element_ids,
    }
}

impl TimelineDocument {
    /// [`original_audio`] on the typed document.
    pub fn original_audio(&self) -> OriginalAudio {
        let legacy = self
            .has_legacy_main()
            .then(|| self.main.as_ref().is_some_and(|main| main.muted));
        original_audio(
            legacy,
            self.tracks.iter().flat_map(|track| {
                track.elements.iter().map(move |element| AudioCarrier {
                    id: &element.id,
                    video: element.kind == ElementKind::Video,
                    source_has_audio: element
                        .src_id
                        .as_deref()
                        .and_then(|id| self.sources.get(id))
                        .and_then(|source| source.has_audio),
                    hidden: element.hidden,
                    muted: element.muted == Some(true),
                    track_hidden: track.hidden,
                    track_muted: track.muted,
                })
            }),
        )
    }
}

fn flag(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(false)
}

/// [`original_audio`] on raw JSON (`timeline.json` or a studio projection; counts only explicit `clips[]`, see [`legacy_main_json`]).
pub fn original_audio_json(timeline: &Value) -> OriginalAudio {
    let legacy = legacy_main_json(timeline, 0.0)
        .then(|| timeline.get("main").is_some_and(|main| flag(main, "muted")));
    let sources = timeline.get("sources");
    original_audio(
        legacy,
        timeline
            .get("tracks")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .flat_map(|track| {
                track
                    .get("elements")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .map(move |element| AudioCarrier {
                        id: element
                            .get("id")
                            .and_then(Value::as_str)
                            .unwrap_or_default(),
                        video: element.get("kind").and_then(Value::as_str) == Some("video"),
                        source_has_audio: element
                            .get("srcId")
                            .and_then(Value::as_str)
                            .and_then(|id| sources?.get(id)?.get("hasAudio")?.as_bool()),
                        hidden: flag(element, "hidden"),
                        muted: flag(element, "muted"),
                        track_hidden: flag(track, "hidden"),
                        track_muted: flag(track, "muted"),
                    })
            }),
    )
}

/// The only way to turn original audio on or off. A legacy document writes `main.muted`; other documents write `muted` on each carrying element, and `main.muted` (if present) is left unchanged. In a detached document `main.muted` must be true, otherwise `[amain]` would mix the same sound in a second time.
pub fn set_original_audio_muted_json(timeline: &mut Value, muted: bool) {
    let audio = original_audio_json(timeline);
    if audio.legacy_main {
        timeline["main"]["muted"] = json!(muted);
        return;
    }
    for track in timeline
        .get_mut("tracks")
        .and_then(Value::as_array_mut)
        .into_iter()
        .flatten()
    {
        for element in track
            .get_mut("elements")
            .and_then(Value::as_array_mut)
            .into_iter()
            .flatten()
        {
            let carries = element
                .get("id")
                .and_then(Value::as_str)
                .is_some_and(|id| audio.element_ids.iter().any(|known| known == id));
            if carries {
                element["muted"] = json!(muted);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Open-ended (blank) projects
// ---------------------------------------------------------------------------

/// The landing gap (in seconds; prototype `BLANK_TAIL`) that an open-ended project keeps after the end of its content. The ruler / scrub bar extends to `content_end + OPEN_TAIL`, so the playhead has somewhere to land at “the position where the next element should start”.
pub const OPEN_TAIL: f64 = 10.0;

/// Open-ended project: no main-track clips and no main media. The length of the finished cut is set entirely by the elements, and there is no end-of-cut that could truncate newly created elements or the playhead. A detached document is not open-ended as long as it still keeps `clips[]` on the source clock.
pub fn open_ended(has_main_clips: bool, has_main_media: bool) -> bool {
    !has_main_clips && !has_main_media
}

/// [`open_ended`] on raw JSON: counts only explicit `clips[]`.
pub fn open_ended_json(timeline: &Value, has_main_media: bool) -> bool {
    let has_clips = timeline
        .get("clips")
        .and_then(Value::as_array)
        .is_some_and(|clips| !clips.is_empty());
    open_ended(has_clips, has_main_media)
}

/// How far the ruler / scrub bar extends: an open-ended project keeps an extra [`OPEN_TAIL`] after the end of its content. A project with an end-of-cut is simply its own length.
pub fn display_duration(content_end: f64, open_ended: bool) -> f64 {
    let base = if content_end.is_finite() {
        content_end.max(0.0)
    } else {
        0.0
    };
    if open_ended { base + OPEN_TAIL } else { base }
}

impl TimelineDocument {
    /// [`open_ended`]: `has_main_media` is decided by the host (the project manifest / `meta.media`).
    pub fn is_open_ended(&self, has_main_media: bool) -> bool {
        open_ended(!self.clips.is_empty(), has_main_media)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn open_ended_needs_neither_clips_nor_media() {
        assert!(open_ended(false, false));
        assert!(!open_ended(true, false));
        assert!(!open_ended(false, true));
        assert!(open_ended_json(&json!({"main": {"detached": true}}), false));
        assert!(!open_ended_json(
            &json!({"main": {"detached": true}, "clips": [{"id": "c1"}]}),
            false
        ));
        assert_eq!(display_duration(12.0, true), 12.0 + OPEN_TAIL);
        assert_eq!(display_duration(12.0, false), 12.0);
        assert_eq!(display_duration(f64::NAN, true), OPEN_TAIL);
    }

    fn document(value: Value) -> TimelineDocument {
        serde_json::from_value(value).expect("测试文档")
    }

    fn projection(document: &TimelineDocument, main: f64) -> TimelineProjection {
        TimelineProjection::build(document, &BTreeMap::from([("main".to_owned(), main)]))
            .expect("投影")
    }

    /// A blank project (no `main`, no clips, no main media) is an element document. It is legacy only if it has explicit clips, or an implicit whole-length clip, and is not marked detached. A document marked detached is never legacy.
    #[test]
    fn legacy_main_needs_a_real_clip_track_and_no_detached_flag() {
        let blank = document(json!({"ccutTimeline": "0.1", "tracks": []}));
        assert!(!blank.has_legacy_main());
        assert!(!blank.has_legacy_main_with(&projection(&blank, 0.0)));
        assert!(!blank.is_detached());
        // Has main media: arrange synthesizes an implicit clip. The projection criterion counts it; the pure-document criterion does not.
        assert!(blank.has_legacy_main_with(&projection(&blank, 30.0)));
        assert!(!blank.has_legacy_main());

        let clips = document(json!({"ccutTimeline": "0.1",
            "clips": [{"id": "c1", "srcId": "main", "in": 0.0, "out": 5.0}]}));
        assert!(clips.has_legacy_main());
        let detached = document(json!({"ccutTimeline": "0.1",
            "clips": [{"id": "c1", "srcId": "main", "in": 0.0, "out": 5.0}],
            "main": {"detached": true, "muted": true, "place": {"opacity": 0}}}));
        assert!(detached.is_detached());
        assert!(!detached.has_legacy_main());
        assert!(!detached.has_legacy_main_with(&projection(&detached, 30.0)));

        assert!(!legacy_main_json(&json!({"main": null, "tracks": []}), 0.0));
        assert!(legacy_main_json(&json!({"main": null, "tracks": []}), 30.0));
        assert!(legacy_main_json(&json!({"clips": [{"id": "c1"}]}), 0.0));
        assert!(!legacy_main_json(
            &json!({"clips": [{"id": "c1"}], "main": {"detached": true}}),
            30.0
        ));
    }

    #[test]
    fn content_end_is_elements_only_unless_the_document_has_a_legacy_main() {
        let tracks = json!([{"id": "t", "kind": "overlay", "elements": [
            {"id": "a", "kind": "text", "text": "x", "start": 0.0, "end": 14.0},
            {"id": "b", "kind": "text", "text": "y", "start": 0.0, "end": "~main:w1:end"},
            {"id": "c", "kind": "text", "text": "z", "start": 1.0}
        ]}]);
        let open_ended = document(json!({"ccutTimeline": "0.1", "tracks": tracks}));
        assert_eq!(open_ended.content_end(&projection(&open_ended, 0.0)), 14.0);
        // Implicit whole-length main track of 30s: a legacy document takes the union.
        assert_eq!(open_ended.content_end(&projection(&open_ended, 30.0)), 30.0);
        assert_eq!(open_ended.content_end(&projection(&open_ended, 8.0)), 14.0);
        let detached = document(json!({"ccutTimeline": "0.1", "tracks": tracks,
            "clips": [{"id": "c1", "srcId": "main", "in": 0.0, "out": 30.0}],
            "main": {"detached": true, "muted": true, "place": {"opacity": 0}}}));
        assert_eq!(detached.content_end(&projection(&detached, 30.0)), 14.0);
        assert_eq!(content_end(false, [f64::NAN, -1.0], [99.0]), 0.0);
        assert_eq!(content_end(true, [], [99.0]), 99.0);
    }

    #[test]
    fn original_audio_is_every_audible_video_element_except_silent_sources() {
        let doc = json!({
            "ccutTimeline": "0.1",
            "sources": {"src-b1": {"kind": "video", "hasAudio": true},
                        "src-silent": {"kind": "video", "hasAudio": false}},
            "main": {"detached": true, "muted": true, "place": {"opacity": 0}},
            "tracks": [
                {"id": "tv", "kind": "overlay", "elements": [
                    {"id": "v1", "kind": "video", "srcId": "main", "muted": true},
                    {"id": "b1", "kind": "video", "srcId": "src-b1"},
                    {"id": "s1", "kind": "video", "srcId": "src-silent"},
                    {"id": "t1", "kind": "text", "text": "x"}
                ]},
                {"id": "ta", "kind": "audio", "elements": [
                    {"id": "a1", "kind": "audio", "srcId": "src-b1"}
                ]}
            ]
        });
        let expected = OriginalAudio {
            legacy_main: false,
            has: true,
            muted: false,
            element_ids: vec!["v1".into(), "b1".into()],
        };
        assert_eq!(original_audio_json(&doc), expected);
        assert_eq!(
            document(doc.clone()).original_audio(),
            expected,
            "两种入参同一答案"
        );

        let mut off = doc.clone();
        set_original_audio_muted_json(&mut off, true);
        assert_eq!(off["tracks"][0]["elements"][1]["muted"], json!(true));
        assert_eq!(
            off["tracks"][0]["elements"][2].get("muted"),
            None,
            "静音源不写"
        );
        assert_eq!(
            off["tracks"][1]["elements"][0].get("muted"),
            None,
            "分离音轨不是原声"
        );
        assert_eq!(off["main"]["muted"], json!(true));
        assert!(original_audio_json(&off).muted);
        set_original_audio_muted_json(&mut off, false);
        assert_eq!(
            off["main"]["muted"],
            json!(true),
            "分离文档的 main.muted 不动"
        );
        assert!(!original_audio_json(&off).muted);

        // Whole track muted means off. No carrying element means no original audio, so it counts as off.
        let mut track_muted = doc.clone();
        track_muted["tracks"][0]["muted"] = json!(true);
        assert!(original_audio_json(&track_muted).muted);
        let none = json!({"main": {"detached": true, "muted": true}, "tracks": []});
        assert_eq!(
            original_audio_json(&none),
            OriginalAudio {
                legacy_main: false,
                has: false,
                muted: true,
                element_ids: vec![]
            }
        );
    }

    #[test]
    fn legacy_documents_keep_their_audio_on_main_and_blank_projects_do_not() {
        let mut legacy = json!({"ccutTimeline": "0.1",
            "clips": [{"id": "c1", "srcId": "main", "in": 0.0, "out": 5.0}],
            "main": {"muted": true},
            "tracks": [{"id": "tv", "kind": "overlay", "elements": [
                {"id": "v1", "kind": "video", "srcId": "main"}]}]});
        let audio = original_audio_json(&legacy);
        assert!(audio.legacy_main && audio.has && audio.muted);
        assert!(audio.element_ids.is_empty());
        assert_eq!(document(legacy.clone()).original_audio(), audio);
        set_original_audio_muted_json(&mut legacy, false);
        assert_eq!(legacy["main"]["muted"], json!(false));
        assert_eq!(legacy["tracks"][0]["elements"][0].get("muted"), None);

        // The `main` object is present but there are no clips and no main media: a blank project, with the original audio on the elements.
        let blank = json!({"main": {}, "tracks": [{"id": "tv", "kind": "overlay", "elements": [
            {"id": "v1", "kind": "video", "srcId": "src-x"}]}]});
        let audio = original_audio_json(&blank);
        assert!(!audio.legacy_main);
        assert_eq!(audio.element_ids, vec!["v1".to_owned()]);
        let no_video = json!({"main": null, "tracks": []});
        assert!(!original_audio_json(&no_video).has);
    }
}
