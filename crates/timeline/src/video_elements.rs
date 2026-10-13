//! One-time conversion of the legacy base video to normal, independently editable elements.
//! Clips are retained solely as the source-to-transcript clock. Conversion is deterministic,
//! so a read can expose the normalized document before the next normal edit persists it.
use crate::schema::TimeValue;
use crate::{ElementKind, TimelineDocument, TimelineError, TimelineProjection};
use serde_json::json;
use std::collections::{BTreeMap, HashSet};

/// The equality window for "the source end falls on the recorded main-source duration": much smaller than one frame, yet still covering the floating-point tail of frame quantisation and the composite total length (for the same draft, the IR total length `73.8333` and the probed length of the finished video `73.833375` differ by 7.5e-5).
const FOLLOW_EPS: f64 = 1e-3;

pub fn detach_main_video(
    document: &mut TimelineDocument,
    durations: &BTreeMap<String, f64>,
    widths: &BTreeMap<String, f64>,
) -> Result<bool, TimelineError> {
    if document.is_detached() {
        return Ok(false);
    }
    let projection = TimelineProjection::build(document, durations)?;
    if projection.clips().is_empty() {
        return Ok(false);
    }
    let old = serde_json::to_value(&document.main).expect("timeline serialization");
    let mut used: HashSet<String> = document
        .sources
        .keys()
        .cloned()
        .chain(document.clips.iter().map(|clip| clip.id.clone()))
        .chain(
            document
                .sources
                .values()
                .flat_map(|source| source.cuts.iter().map(|cut| cut.id.clone())),
        )
        .chain(document.tracks.iter().flat_map(|track| {
            std::iter::once(track.id.clone()).chain(track.elements.iter().map(|el| el.id.clone()))
        }))
        .collect();
    let mut claim = |base: &str| {
        let mut id = base.to_owned();
        let mut suffix = 2;
        while !used.insert(id.clone()) {
            id = format!("{base}-{suffix}");
            suffix += 1;
        }
        id
    };
    let track_id = claim("video-track");
    let mut elements = Vec::new();
    for clip in projection.clips() {
        for (index, segment) in clip.segments.iter().enumerate() {
            let mut place = old
                .get("place")
                .filter(|v| v.is_object())
                .cloned()
                .unwrap_or(json!({}));
            let scale = place["scale"].as_f64().unwrap_or(1.0);
            if let Some(sy) = place["scaleY"].as_f64() {
                place["scaleY"] = json!(sy / scale.max(0.000001));
            }
            place["w"] = json!(widths.get(&clip.src_id).copied().unwrap_or(100.0));
            elements.push(picture_json(
                &claim(&format!("video-{}-{}", clip.id, index + 1)),
                &clip.src_id,
                (
                    segment.source_start,
                    segment.timeline_start,
                    segment.timeline_end,
                ),
                clip.rate,
                old["muted"].as_bool().unwrap_or(false),
                old["background"].as_str().unwrap_or("black"),
                place,
            ));
        }
    }
    let track = serde_json::from_value(json!({"id":track_id,"kind":"overlay","elements":elements}))
        .map_err(|error| TimelineError::Invalid(error.to_string()))?;
    let mut next = document.clone();
    next.tracks.insert(0, track);
    // Keep the legacy base invisible and silent for every existing rendering/audio consumer.
    next.main = Some(
        serde_json::from_value(json!({"detached":true,"muted":true,
        "place":{"opacity":0},"background":"black",
        "sourceDuration":durations.get("main").copied().filter(|d| d.is_finite() && *d > 0.0)}))
        .expect("valid disabled main"),
    );
    next.validate()?;
    *document = next;
    Ok(true)
}

/// A separated clip picture: `(srcStart, start, end)`, taken from a segment of the clip projection.
fn picture_json(
    id: &str,
    src_id: &str,
    (src_start, start, end): (f64, f64, f64),
    rate: f64,
    muted: bool,
    background: &str,
    place: serde_json::Value,
) -> serde_json::Value {
    json!({"id":id, "kind":"video", "srcId":src_id, "srcStart":src_start,
        "start":start, "end":end, "rate":rate, "muted":muted, "volume":1.0,
        "mode":"pip", "fit":"contain", "bg":background, "place":place})
}

/// The picture created for a clip newly added in a separated document, using the separation defaults (following rule 2): with sound, and `place.w` taken from the source width.
pub fn default_picture_element(
    id: &str,
    src_id: &str,
    src_start: f64,
    start: f64,
    end: f64,
    rate: f64,
    width: f64,
) -> crate::Element {
    serde_json::from_value(picture_json(
        id,
        src_id,
        (src_start, start, end),
        rate,
        false,
        "black",
        json!({"w": width}),
    ))
    .expect("valid default picture element")
}

/// When the main source duration changes, move the main video elements that "play until the end of the main source" to the new end.
///
/// The video elements in a separated document were placed at the moment of splitting, according to the main source duration at that time. In an animation project the main source is composed on the spot: when the author revises the script and re-renders, the duration changes, and if this is not reconciled the finished video would stop at the old length and the tail would be cut off (narration sync is the most common first element written in an animation project, and splitting happens at that point). `main.sourceDuration` records the main-source duration this layout was aligned to: elements whose source end (`srcStart + (end − start) × rate`) falls exactly on it move to the new end; elements that were shortened are left alone; then the record is refreshed to the current value.
///
/// Normalised on read (same as `fold_main_duplicates`): in memory only, and persisted together with the next write transaction. The record travels with the document, so undoing back to an older document and reading it again also reconciles against the record at that time. Applies only to separated documents. When `current` is not a positive finite value (no main media, or the composition has not been computed yet), nothing is changed, so that a process that cannot see the composition does not write the record as 0.
/// Returns whether the document changed.
pub fn follow_main_duration(document: &mut TimelineDocument, current: f64) -> bool {
    if !document.is_detached() || !current.is_finite() || current <= 0.0 {
        return false;
    }
    let Some(main) = document.main.as_mut() else {
        return false;
    };
    let recorded = main.source_duration;
    if recorded.is_some_and(|recorded| (recorded - current).abs() < FOLLOW_EPS) {
        return false;
    }
    main.source_duration = Some(current);
    let Some(recorded) = recorded else {
        return true;
    };
    for element in document
        .tracks
        .iter_mut()
        .flat_map(|track| track.elements.iter_mut())
    {
        if element.kind != ElementKind::Video || element.src_id.as_deref() != Some("main") {
            continue;
        }
        let (Some(TimeValue::Seconds(start)), Some(TimeValue::Seconds(end))) =
            (&element.start, &element.end)
        else {
            continue;
        };
        let (start, end) = (*start, *end);
        let rate = element.rate.filter(|rate| *rate > 0.0).unwrap_or(1.0);
        let src_start = element.src_start.unwrap_or(0.0);
        if (src_start + (end - start) * rate - recorded).abs() >= FOLLOW_EPS {
            continue;
        }
        let next = start + (current - src_start) / rate;
        if next > start + FOLLOW_EPS {
            element.end = Some(TimeValue::Seconds(next));
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn conversion_preserves_cuts_rates_and_source_clock_and_never_resurrects_deleted_video() {
        let mut doc: TimelineDocument = serde_json::from_value(json!({"ccutTimeline":"0.4",
            "sources":{"main":{"cuts":[{"id":"cut-1","t0":2,"t1":4}]}},
            "clips":[{"id":"c1","in":0,"out":10,"rate":2}],
            "main":{"muted":false,"place":{"scale":0.5,"scaleY":0.8,"rot":20,"opacity":0.7}}
        }))
        .unwrap();
        let durations = BTreeMap::from([("main".into(), 10.0)]);
        let before = TimelineProjection::build(&doc, &durations).unwrap();
        assert!(detach_main_video(&mut doc, &durations, &BTreeMap::new()).unwrap());
        let json = serde_json::to_value(&doc).unwrap();
        let els = json["tracks"][0]["elements"].as_array().unwrap();
        assert_eq!(els.len(), 2);
        assert_eq!(els[0]["end"], 1.0);
        assert_eq!(els[1]["srcStart"], 4.0);
        assert_eq!(els[1]["start"], 1.0);
        assert_eq!(els[1]["end"], 4.0);
        assert_eq!(els[1]["rate"], 2.0);
        assert_eq!(els[1]["place"]["scaleY"], 1.6);
        assert_eq!(els[1]["place"]["opacity"], 0.7);
        assert_eq!(
            TimelineProjection::build(&doc, &durations).unwrap().clips(),
            before.clips()
        );
        doc.tracks.clear();
        assert!(!detach_main_video(&mut doc, &durations, &BTreeMap::new()).unwrap());
        assert!(doc.tracks.is_empty());
    }

    fn ends(doc: &TimelineDocument) -> Vec<f64> {
        doc.tracks[0]
            .elements
            .iter()
            .map(|el| match el.end {
                Some(TimeValue::Seconds(end)) => end,
                _ => f64::NAN,
            })
            .collect()
    }

    /// Animation project: at the moment of splitting the composition was 60 s; re-rendered to 70 s or 50 s, the video element that played to the end follows; a neighbouring element that was shortened (its end is not on the record) stays put; undoing back to the document as it was at split time and reading it again still matches the current length.
    #[test]
    fn detached_video_that_ran_to_the_source_end_follows_a_rerendered_composition() {
        let mut doc: TimelineDocument =
            serde_json::from_value(json!({"ccutTimeline":"0.4"})).unwrap();
        let durations = BTreeMap::from([("main".into(), 60.0)]);
        assert!(detach_main_video(&mut doc, &durations, &BTreeMap::new()).unwrap());
        assert_eq!(doc.main.as_ref().unwrap().source_duration, Some(60.0));
        let trimmed: crate::Element = serde_json::from_value(json!({"id":"cut-short",
            "kind":"video","srcId":"main","srcStart":10,"start":0,"end":20}))
        .unwrap();
        doc.tracks[0].elements.push(trimmed);
        let detached_at_60 = doc.clone();

        assert!(!follow_main_duration(&mut doc, 60.0000001));
        assert!(follow_main_duration(&mut doc, 70.0));
        assert_eq!(ends(&doc), vec![70.0, 20.0]);
        assert_eq!(doc.main.as_ref().unwrap().source_duration, Some(70.0));
        doc.validate().unwrap();
        assert!(!follow_main_duration(&mut doc, 70.0));

        assert!(follow_main_duration(&mut doc, 50.0));
        assert_eq!(ends(&doc), vec![50.0, 20.0]);

        let mut undone = detached_at_60;
        assert!(follow_main_duration(&mut undone, 50.0));
        assert_eq!(ends(&undone), vec![50.0, 20.0]);
    }

    /// Speed change and splitting: the last segment converts to its source end using the rate; an old document with no record only stores the current value, without guessing.
    #[test]
    fn follow_honours_rate_and_leaves_unrecorded_or_legacy_documents_alone() {
        let mut doc: TimelineDocument = serde_json::from_value(json!({"ccutTimeline":"0.4",
        "main":{"detached":true,"muted":true,"place":{"opacity":0},"sourceDuration":10},
        "tracks":[{"id":"video-track","kind":"overlay","elements":[
            {"id":"a","kind":"video","srcId":"main","srcStart":0,"start":0,"end":2,"rate":2},
            {"id":"b","kind":"video","srcId":"main","srcStart":4,"start":2,"end":5,"rate":2}
        ]}]}))
        .unwrap();
        assert!(follow_main_duration(&mut doc, 14.0));
        assert_eq!(ends(&doc), vec![2.0, 7.0]);

        let mut old = doc.clone();
        old.main.as_mut().unwrap().source_duration = None;
        assert!(follow_main_duration(&mut old, 20.0));
        assert_eq!(ends(&old), vec![2.0, 7.0]);
        assert_eq!(old.main.as_ref().unwrap().source_duration, Some(20.0));
        assert!(!follow_main_duration(&mut old, 0.0));
        assert_eq!(old.main.as_ref().unwrap().source_duration, Some(20.0));

        let mut legacy: TimelineDocument =
            serde_json::from_value(json!({"ccutTimeline":"0.4"})).unwrap();
        assert!(!follow_main_duration(&mut legacy, 20.0));
        assert!(legacy.main.is_none());
    }
}
