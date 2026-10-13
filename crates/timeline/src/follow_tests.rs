use super::*;
use crate::arrange::{add_clip, move_clip, remove_clips, set_clip_rate, split_clip, trim_clip};
use crate::cuts::{insert_cut, restore_cut};
use crate::schema::{Clip, Cut, Source};
use serde_json::{Value, json};

const MAIN: f64 = 12.0;

fn durations() -> BTreeMap<String, f64> {
    BTreeMap::from([("main".to_owned(), MAIN), ("b".to_owned(), 30.0)])
}

fn doc(value: Value) -> TimelineDocument {
    serde_json::from_value(value).expect("timeline fixture")
}

/// The shape of `det.ccut`: a source of 12 seconds, one separated picture covering 0–12 seconds, plus a B-roll stacked over 2–4, a word-anchored text element, a full-width background music track, and a corner badge with no end point.
fn detached() -> TimelineDocument {
    doc(json!({
        "ccutTimeline": "0.11",
        "sources": {"b": {"path": "b.mp4", "kind": "video", "duration": 30.0}},
        "main": {"detached": true, "muted": true, "place": {"opacity": 0}, "background": "black", "sourceDuration": MAIN},
        "tracks": [
            {"id": "video-track", "kind": "overlay", "elements": [
                {"id": "video-c1-1", "kind": "video", "srcId": "main", "srcStart": 0.0, "start": 0.0, "end": MAIN,
                 "rate": 1.0, "muted": false, "volume": 1.0, "mode": "pip", "fit": "contain", "bg": "black",
                 "place": {"w": 100.0}, "fx": {"blur": 2.0}}
            ]},
            {"id": "tr-overlay", "kind": "overlay", "elements": [
                {"id": "broll", "kind": "video", "role": "broll", "srcId": "b", "srcStart": 5.0, "start": 1.0, "end": 3.0},
                {"id": "broll-inside", "kind": "video", "role": "broll", "srcId": "b", "srcStart": 0.0, "start": 2.25, "end": 3.75},
                {"id": "broll-late", "kind": "video", "role": "broll", "srcId": "b", "srcStart": 0.0, "start": 3.0, "end": 6.0},
                {"id": "words", "kind": "text", "start": "~main:w1:start", "end": "~main:w2:end", "text": "anchored"},
                {"id": "badge", "kind": "text", "start": 1.0, "text": "open"}
            ]},
            {"id": "tr-music", "kind": "audio", "elements": [
                {"id": "music", "kind": "audio", "srcId": "b", "srcStart": 0.0, "start": 0.0, "end": MAIN}
            ]}
        ]
    }))
}

fn cut(id: &str, t0: f64, t1: f64) -> Cut {
    Cut {
        id: id.to_owned(),
        t0,
        t1,
        r#ref: None,
    }
}

fn ids() -> impl FnMut() -> String {
    let mut minted = 0;
    move || {
        minted += 1;
        format!("el-{minted}")
    }
}

/// One write: first changes the clock according to `op`, then follows using the clock from before this item as the baseline.
fn step(
    document: &mut TimelineDocument,
    next_id: &mut dyn FnMut() -> String,
    edit: ClockEdit,
    op: impl FnOnce(&mut TimelineDocument),
) -> FollowReport {
    let before = clock_snapshot(document);
    op(document);
    follow_clock(
        &before,
        document,
        &durations(),
        &BTreeMap::new(),
        &edit,
        next_id,
    )
    .expect("follow")
}

fn add_cuts(document: &mut TimelineDocument, cuts: &[(&str, f64, f64)]) {
    let source = document.sources.entry("main".to_owned()).or_default();
    for (id, t0, t1) in cuts {
        insert_cut(&mut source.cuts, cut(id, *t0, *t1), MAIN).unwrap();
    }
}

fn element<'a>(document: &'a TimelineDocument, id: &str) -> &'a Element {
    document
        .tracks
        .iter()
        .flat_map(|track| &track.elements)
        .find(|element| element.id == id)
        .unwrap_or_else(|| panic!("element {id} missing"))
}

fn has(document: &TimelineDocument, id: &str) -> bool {
    document
        .tracks
        .iter()
        .flat_map(|track| &track.elements)
        .any(|element| element.id == id)
}

fn span(element: &Element) -> (Option<f64>, Option<f64>, Option<f64>) {
    (
        seconds(&element.start),
        seconds(&element.end),
        element.src_start,
    )
}

/// Picture: `(start, end, srcStart)`, sorted by timeline time.
fn pictures_of(document: &TimelineDocument) -> Vec<(f64, f64, f64)> {
    let mut out: Vec<(f64, f64, f64)> = document.tracks[0]
        .elements
        .iter()
        .map(|element| {
            (
                seconds(&element.start).unwrap(),
                seconds(&element.end).unwrap(),
                element.src_start.unwrap(),
            )
        })
        .collect();
    out.sort_by(|a, b| a.0.total_cmp(&b.0));
    out
}

/// The coverage of the picture over the source: the merged `[source start, source end)` list.
fn coverage(document: &TimelineDocument) -> Vec<(f64, f64)> {
    let mut spans: Vec<(f64, f64)> = pictures_of(document)
        .into_iter()
        .map(|(start, end, src)| (src, src + (end - start)))
        .collect();
    spans.sort_by(|a, b| a.0.total_cmp(&b.0));
    let mut merged: Vec<(f64, f64)> = Vec::new();
    for (s0, s1) in spans {
        match merged.last_mut() {
            Some(last) if s0 <= last.1 + 1e-9 => last.1 = last.1.max(s1),
            _ => merged.push((s0, s1)),
        }
    }
    merged
}

fn content_end(document: &TimelineDocument) -> f64 {
    let projection = TimelineProjection::build(document, &durations()).unwrap();
    document.content_end(&projection)
}

fn bytes(document: &TimelineDocument, id: &str) -> String {
    serde_json::to_string(element(document, id)).unwrap()
}

/// Observed defect: on a separated document, cutting 2–4 leaves the picture at 0–12 and the export 12 seconds long. After following, the picture covers 0–2 (source 0–2)
/// and 2–10 (source 4–12), with the last 10 seconds of content; restore this cut to bring the coverage back to 0–12.
#[test]
fn cutting_a_detached_document_takes_the_picture_along_and_restore_brings_it_back() {
    let mut document = detached();
    let mut next_id = ids();
    let original_coverage = coverage(&document);
    assert_eq!(content_end(&document), 12.0);

    let report = step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 2.0, 4.0)])
    });
    assert_eq!(
        pictures_of(&document),
        vec![(0.0, 2.0, 0.0), (2.0, 10.0, 4.0)]
    );
    assert_eq!(content_end(&document), 10.0);
    let picture = element(&document, "video-c1-1");
    assert_eq!(span(picture), (Some(0.0), Some(2.0), Some(0.0)));
    assert_eq!(picture.fx, element(&document, "el-1").fx, "properties are kept as they are");
    assert_eq!(
        report.created,
        vec![FollowCreated {
            id: "el-1".to_owned(),
            from: Some("video-c1-1".to_owned()),
            clip_id: Some("c1".to_owned()),
        }]
    );
    assert!(report.retimed.contains(&"video-c1-1".to_owned()));

    let report = step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
        assert!(restore_cut(
            &mut d.sources.get_mut("main").unwrap().cuts,
            "cut-1"
        ));
    });
    assert_eq!(coverage(&document), original_coverage);
    assert_eq!(
        pictures_of(&document),
        vec![(0.0, 4.0, 0.0), (4.0, 12.0, 4.0)],
        "adjacent pieces are not merged automatically"
    );
    assert_eq!(content_end(&document), 12.0);
    assert!(report.removed.is_empty() && report.created.is_empty());
}

/// B-roll is shortened / deleted / pushed later by the rules and its `srcStart` is kept in sync; word anchors and elements with no end point are unchanged byte for byte;
/// the full-width background music is shortened at the cut.
#[test]
fn numeric_elements_shorten_drop_or_advance_and_anchors_stay_put() {
    let mut document = detached();
    let words = bytes(&document, "words");
    let badge = bytes(&document, "badge");
    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 2.0, 4.0)])
    });
    assert_eq!(
        span(element(&document, "broll")),
        (Some(1.0), Some(2.0), Some(5.0))
    );
    assert!(!has(&document, "broll-inside"));
    assert_eq!(report.removed, vec!["broll-inside".to_owned()]);
    // Start 3 falls inside the cut: push to 4 (pushed later by 1 second), and srcStart moves forward by 1 second in sync.
    assert_eq!(
        span(element(&document, "broll-late")),
        (Some(2.0), Some(4.0), Some(1.0))
    );
    assert_eq!(
        span(element(&document, "music")),
        (Some(0.0), Some(10.0), Some(0.0))
    );
    assert_eq!(bytes(&document, "words"), words);
    assert_eq!(bytes(&document, "badge"), badge);
    for id in ["broll", "broll-late", "music"] {
        assert!(report.retimed.contains(&id.to_owned()), "{id}");
    }
}

fn two_clips() -> TimelineDocument {
    let mut document = detached();
    document.clips = vec![
        Clip {
            id: "c1".to_owned(),
            src_id: "main".to_owned(),
            in_time: 0.0,
            out: 5.0,
            rate: 1.0,
        },
        Clip {
            id: "c2".to_owned(),
            src_id: "main".to_owned(),
            in_time: 5.0,
            out: 12.0,
            rate: 1.0,
        },
    ];
    let pictures = &mut document.tracks[0].elements;
    let mut second = pictures[0].clone();
    pictures[0].end = Some(TimeValue::Seconds(5.0));
    second.id = "video-c2-1".to_owned();
    second.start = Some(TimeValue::Seconds(5.0));
    second.src_start = Some(5.0);
    pictures.push(second);
    document.tracks[1].elements.push(doc_element(json!(
        {"id": "inside-c2", "kind": "text", "start": 6.0, "end": 8.0, "text": "c2"}
    )));
    document.tracks[1].elements.push(doc_element(json!(
        {"id": "across", "kind": "text", "start": 4.0, "end": 6.0, "text": "seam"}
    )));
    document
}

fn doc_element(value: Value) -> Element {
    serde_json::from_value(value).unwrap()
}

/// Moving a segment: the picture moves along with the segment; those whose start and end both lie within the same segment move along; those that span segments (background music, text across a seam) stay in place.
#[test]
fn moving_a_clip_carries_its_picture_and_contained_elements_only() {
    let mut document = two_clips();
    let music = bytes(&document, "music");
    let across = bytes(&document, "across");
    let report = step(&mut document, &mut ids(), ClockEdit::Move, |d| {
        move_clip(d, "c2", Some("c1"), None, None).unwrap();
    });
    assert_eq!(
        span(element(&document, "video-c2-1")),
        (Some(0.0), Some(7.0), Some(5.0))
    );
    assert_eq!(
        span(element(&document, "video-c1-1")),
        (Some(7.0), Some(12.0), Some(0.0))
    );
    assert_eq!(
        span(element(&document, "inside-c2")),
        (Some(1.0), Some(3.0), None)
    );
    // B-roll whose start and end are both within c1 (0–5) moves with c1 to after 7; broll-late, which crosses the c1/c2 seam, does not move.
    assert_eq!(
        span(element(&document, "broll")),
        (Some(8.0), Some(10.0), Some(5.0))
    );
    assert_eq!(
        span(element(&document, "broll-inside")),
        (Some(9.25), Some(10.75), Some(0.0))
    );
    assert_eq!(
        span(element(&document, "broll-late")),
        (Some(3.0), Some(6.0), Some(0.0))
    );
    assert_eq!(bytes(&document, "music"), music);
    assert_eq!(bytes(&document, "across"), across);
    assert!(report.created.is_empty() && report.removed.is_empty());
    assert_eq!(report.retimed.len(), 5);
}

/// Deleting a segment: its picture is deleted entirely and listed; the elements after it ripple forward.
#[test]
fn removing_a_clip_drops_its_picture_and_ripples_the_rest() {
    let mut document = two_clips();
    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        remove_clips(d, &durations(), &["c1".to_owned()]).unwrap();
    });
    assert_eq!(pictures_of(&document), vec![(0.0, 7.0, 5.0)]);
    assert!(report.removed.contains(&"video-c1-1".to_owned()));
    assert_eq!(
        span(element(&document, "inside-c2")),
        (Some(1.0), Some(3.0), None)
    );
    assert_eq!(
        span(element(&document, "across")),
        (Some(0.0), Some(1.0), None)
    );
    assert_eq!(
        span(element(&document, "music")),
        (Some(0.0), Some(7.0), Some(5.0)),
        "start moved later, srcStart follows"
    );
}

/// Splitting: the picture is cut at the seam, the right half takes a new id and is assigned to the new segment; other elements keep their current state (those stacked on the split point are cut).
#[test]
fn splitting_cuts_the_picture_and_every_numeric_lane_at_the_seam() {
    let mut document = detached();
    let report = step(
        &mut document,
        &mut ids(),
        ClockEdit::Split {
            left: "c1".to_owned(),
            right: "c2".to_owned(),
            at: 5.0,
        },
        |d| {
            split_clip(d, &durations(), 5.0, "c2".to_owned()).unwrap();
        },
    );
    assert_eq!(
        pictures_of(&document),
        vec![(0.0, 5.0, 0.0), (5.0, 12.0, 5.0)]
    );
    assert_eq!(
        report.created[0],
        FollowCreated {
            id: "el-1".to_owned(),
            from: Some("video-c1-1".to_owned()),
            clip_id: Some("c2".to_owned()),
        }
    );
    // B-roll and music sitting on the seam are cut (the right half's srcStart advances); B-roll before the seam is unchanged. IDs are issued in track order.
    assert_eq!(
        span(element(&document, "broll-late")),
        (Some(3.0), Some(5.0), Some(0.0))
    );
    assert_eq!(
        span(element(&document, "el-2")),
        (Some(5.0), Some(6.0), Some(2.0))
    );
    assert_eq!(
        span(element(&document, "music")),
        (Some(0.0), Some(5.0), Some(0.0))
    );
    assert_eq!(
        span(element(&document, "el-3")),
        (Some(5.0), Some(12.0), Some(5.0))
    );
    assert_eq!(bytes(&document, "broll"), bytes(&detached(), "broll"));
    assert!(has(&document, "badge") && has(&document, "words"));
}

/// Trim expansion: the newly exposed source range is filled by the adjacent picture (at the start of a segment, filled backward from the next item); segments whose picture the user deleted are not filled.
#[test]
fn trimming_outward_extends_the_neighbouring_picture_but_never_resurrects_a_deleted_one() {
    let mut document = detached();
    document.clips = vec![Clip {
        id: "c1".to_owned(),
        src_id: "main".to_owned(),
        in_time: 2.0,
        out: 10.0,
        rate: 1.0,
    }];
    document.tracks[0].elements[0].src_start = Some(2.0);
    document.tracks[0].elements[0].end = Some(TimeValue::Seconds(8.0));
    document.tracks[1].elements.clear();
    document.tracks[2].elements.clear();
    let mut trimmed = document.clone();
    step(&mut trimmed, &mut ids(), ClockEdit::Retime, |d| {
        trim_clip(d, &durations(), "c1", Some(0.0), Some(12.0)).unwrap();
    });
    assert_eq!(pictures_of(&trimmed), vec![(0.0, 12.0, 0.0)]);
    assert_eq!(trimmed.tracks[0].elements[0].id, "video-c1-1");

    // The user shrinks the picture to source 2–6: 6–10, which had a visible picture before the operation but now has none, is not filled; the newly exposed 0–2, adjacent to the picture, is filled backward by it;
    // the newly exposed 10–12, across the old gap, is filled by copying a neighbouring item.
    let mut shortened = document.clone();
    shortened.tracks[0].elements[0].end = Some(TimeValue::Seconds(4.0));
    let report = step(&mut shortened, &mut ids(), ClockEdit::Retime, |d| {
        trim_clip(d, &durations(), "c1", Some(0.0), Some(12.0)).unwrap();
    });
    assert_eq!(
        pictures_of(&shortened),
        vec![(0.0, 6.0, 0.0), (10.0, 12.0, 10.0)]
    );
    assert_eq!(
        report.created,
        vec![FollowCreated {
            id: "el-1".to_owned(),
            from: Some("video-c1-1".to_owned()),
            clip_id: Some("c1".to_owned()),
        }]
    );

    let mut deleted = document.clone();
    deleted.tracks[0].elements.clear();
    step(&mut deleted, &mut ids(), ClockEdit::Retime, |d| {
        trim_clip(d, &durations(), "c1", Some(0.0), Some(12.0)).unwrap();
    });
    assert!(
        deleted.tracks[0].elements.is_empty(),
        "segments that never had picture are not filled"
    );
}

/// When restoring a cut point, the newly exposed range across a gap the user deleted is filled by copying a neighbouring item, and the deleted part is not filled along with it.
#[test]
fn restoring_across_a_deleted_gap_clones_instead_of_stretching() {
    let mut document = detached();
    document.tracks[1].elements.clear();
    document.tracks[2].elements.clear();
    let mut next_id = ids();
    step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 6.0, 8.0)])
    });
    // The user deletes the picture of source 2–4: source 0–2, source 4–6 and 8–12 are left.
    let first = element(&document, "video-c1-1").clone();
    let mut left = first.clone();
    left.end = Some(TimeValue::Seconds(2.0));
    let mut middle = first.clone();
    middle.id = "user-middle".to_owned();
    middle.start = Some(TimeValue::Seconds(4.0));
    middle.src_start = Some(4.0);
    let rest: Vec<Element> = document.tracks[0]
        .elements
        .iter()
        .filter(|el| el.id != "video-c1-1")
        .cloned()
        .collect();
    document.tracks[0].elements = [vec![left, middle], rest].concat();
    assert_eq!(
        coverage(&document),
        vec![(0.0, 2.0), (4.0, 6.0), (8.0, 12.0)]
    );

    let report = step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
        restore_cut(&mut d.sources.get_mut("main").unwrap().cuts, "cut-1");
    });
    assert_eq!(coverage(&document), vec![(0.0, 2.0), (4.0, 12.0)]);
    assert!(report.created.is_empty(), "the newly exposed 6–8 is filled by extending the previous piece");
}

/// A newly added segment is created with the default separated picture; when the clock is changed by speed, the picture's `rate` follows.
#[test]
fn a_new_clip_gets_a_default_picture_and_rate_changes_retime_it() {
    let mut document = detached();
    document.tracks[1].elements.clear();
    document.tracks[2].elements.clear();
    let widths = BTreeMap::from([("b".to_owned(), 56.25)]);
    let before = clock_snapshot(&document);
    add_clip(
        &mut document,
        &durations(),
        "c9".to_owned(),
        "b".to_owned(),
        Some(0.0),
        Some(4.0),
        None,
        None,
    )
    .unwrap();
    let report = follow_clock(
        &before,
        &mut document,
        &durations(),
        &widths,
        &ClockEdit::Retime,
        &mut ids(),
    )
    .unwrap();
    assert_eq!(report.created.len(), 1);
    assert_eq!(report.created[0].from, None);
    assert_eq!(report.created[0].clip_id.as_deref(), Some("c9"));
    let created = element(&document, "el-1");
    assert_eq!(span(created), (Some(12.0), Some(16.0), Some(0.0)));
    assert_eq!(created.src_id.as_deref(), Some("b"));
    assert_eq!(created.place.as_ref().unwrap().w, Some(56.25));

    step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        set_clip_rate(d, &durations(), "c1", 2.0).unwrap();
    });
    let picture = element(&document, "video-c1-1");
    assert_eq!(span(picture), (Some(0.0), Some(6.0), Some(0.0)));
    assert_eq!(picture.rate, Some(2.0));
    assert_eq!(
        span(element(&document, "el-1")),
        (Some(6.0), Some(10.0), Some(0.0))
    );
}

/// Making several cuts in succession gives the same result as cutting the same batch of intervals at once (picture, B-roll, music, and new IDs are byte-for-byte identical).
#[test]
fn cutting_one_at_a_time_equals_cutting_the_batch() {
    let cuts = [
        ("cut-1", 1.0, 1.5),
        ("cut-2", 2.5, 3.5),
        ("cut-3", 5.0, 5.2),
        ("cut-4", 9.0, 11.0),
    ];
    let mut sequential = detached();
    let mut next_id = ids();
    for one in cuts {
        step(&mut sequential, &mut next_id, ClockEdit::Retime, |d| {
            add_cuts(d, &[one])
        });
    }
    let mut batch = detached();
    step(&mut batch, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &cuts)
    });
    assert_eq!(
        serde_json::to_value(&sequential).unwrap(),
        serde_json::to_value(&batch).unwrap()
    );
}

/// Cut and then restore: the coverage of the picture over the source returns to its original state (any combination of cuts, any order of restoration).
#[test]
fn every_cut_then_restore_order_returns_the_original_coverage() {
    let cuts = [
        ("cut-a", 0.5, 1.0),
        ("cut-b", 3.0, 4.5),
        ("cut-c", 6.0, 6.5),
        ("cut-d", 11.0, 12.0),
    ];
    for mask in 1..(1 << cuts.len()) {
        let chosen: Vec<_> = cuts
            .iter()
            .enumerate()
            .filter(|(index, _)| mask & (1 << index) != 0)
            .map(|(_, cut)| *cut)
            .collect();
        let mut document = detached();
        let original = coverage(&document);
        let mut next_id = ids();
        for one in &chosen {
            step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
                add_cuts(d, &[*one])
            });
        }
        for one in chosen.iter().rev() {
            step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
                restore_cut(&mut d.sources.get_mut("main").unwrap().cuts, one.0);
            });
        }
        assert_eq!(coverage(&document), original, "mask {mask:b}");
        assert_eq!(content_end(&document), 12.0, "mask {mask:b}");
    }
}

/// A legacy document has no picture to claim; other elements still follow as usual (equivalent to the original segment-deletion ripple).
#[test]
fn legacy_documents_ripple_numeric_elements_without_claiming_pictures() {
    let mut document = doc(json!({
        "ccutTimeline": "0.11",
        "sources": {"b": {"path": "b.mp4", "kind": "video", "duration": 30.0}},
        "clips": [
            {"id": "c1", "in": 0.0, "out": 4.0},
            {"id": "c2", "in": 4.0, "out": 6.0},
            {"id": "c3", "in": 6.0, "out": 12.0}
        ],
        "tracks": [
            {"id": "tr-overlays", "kind": "overlay", "elements": [
                {"id": "inside", "kind": "text", "start": 4.5, "end": 5.5, "text": "gone"},
                {"id": "leading", "kind": "text", "start": 3.0, "end": 4.5, "text": "left"},
                {"id": "crossing", "kind": "video", "start": 3.0, "end": 7.0, "srcId": "b"},
                {"id": "later", "kind": "image", "start": 6.5, "end": 7.5, "srcId": "b"},
                {"id": "global", "kind": "text", "text": "all"},
                {"id": "anchored", "kind": "text", "start": "~main:word-a:start", "end": "~main:word-b:end", "text": "words"}
            ]},
            {"id": "tr-inside-only", "kind": "overlay", "elements": [
                {"id": "inside-image", "kind": "image", "start": 4.25, "end": 5.75, "srcId": "b"}
            ]},
            {"id": "tr-empty", "kind": "overlay"}
        ]
    }));
    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        remove_clips(d, &durations(), &["c2".to_owned()]).unwrap();
    });
    assert_eq!(
        document
            .tracks
            .iter()
            .map(|track| track.id.as_str())
            .collect::<Vec<_>>(),
        vec!["tr-overlays", "tr-empty"],
        "only delete tracks emptied by follow"
    );
    assert_eq!(
        report.removed,
        vec!["inside".to_owned(), "inside-image".to_owned()]
    );
    assert_eq!(
        span(element(&document, "leading")),
        (Some(3.0), Some(4.0), None)
    );
    assert_eq!(
        span(element(&document, "crossing")),
        (Some(3.0), Some(5.0), None),
        "a piece spanning the deleted range is only shortened, no hole is dug"
    );
    assert_eq!(
        span(element(&document, "later")),
        (Some(4.5), Some(5.5), None)
    );
    assert_eq!(span(element(&document, "global")), (None, None, None));
    assert!(matches!(
        element(&document, "anchored").start,
        Some(TimeValue::Anchor(_))
    ));
}

/// Anything beyond the tail keeps its distance to the tail.
#[test]
fn elements_past_the_clock_end_keep_their_distance_to_it() {
    let mut document = detached();
    document.tracks[1].elements = vec![doc_element(json!(
        {"id": "outro", "kind": "text", "start": 11.0, "end": 14.0, "text": "outro"}
    ))];
    step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 2.0, 4.0)])
    });
    assert_eq!(
        span(element(&document, "outro")),
        (Some(9.0), Some(12.0), None)
    );
}

#[test]
fn reports_merge_across_one_transaction_and_serialize_the_receipt_shape() {
    let mut first = FollowReport {
        removed: vec!["a".to_owned()],
        created: vec![FollowCreated {
            id: "el-1".to_owned(),
            from: Some("v".to_owned()),
            clip_id: Some("c1".to_owned()),
        }],
        retimed: vec!["v".to_owned(), "m".to_owned()],
    };
    first.merge(FollowReport {
        removed: vec!["el-1".to_owned(), "m".to_owned()],
        created: vec![],
        retimed: vec!["v".to_owned(), "x".to_owned()],
    });
    assert_eq!(first.removed, vec!["a".to_owned(), "m".to_owned()]);
    assert!(first.created.is_empty());
    assert_eq!(first.retimed, vec!["v".to_owned(), "x".to_owned()]);
    assert_eq!(
        serde_json::to_value(&first).unwrap(),
        json!({"removed": ["a", "m"], "created": [], "retimed": 2})
    );
}

/// Scale: hours of material, thousands of cuts and tens of thousands of elements are the default scenario. A single follow over 5 thousand cuts × 50 thousand elements must be far below one second;
/// a quadratic algorithm (250 million comparisons) would be two orders of magnitude slower at that scale.
#[test]
fn following_thousands_of_cuts_and_tens_of_thousands_of_elements_stays_linearithmic() {
    const SOURCE: f64 = 36_000.0;
    let cut_count = 5_000;
    let mut cuts = Vec::with_capacity(cut_count);
    for index in 0..cut_count {
        let t0 = index as f64 * 7.0 + 3.0;
        cuts.push(cut(&format!("cut-{index}"), t0, t0 + 0.5));
    }
    let mut document = doc(json!({
        "ccutTimeline": "0.11",
        "main": {"detached": true, "muted": true, "place": {"opacity": 0}, "background": "black"},
        "tracks": []
    }));
    document.sources.insert(
        "main".to_owned(),
        Source {
            cuts,
            ..Source::default()
        },
    );
    let durations = BTreeMap::from([("main".to_owned(), SOURCE)]);
    let projection = TimelineProjection::build(&document, &durations).unwrap();
    let mut pictures = Vec::new();
    for (index, segment) in projection.clips()[0].segments.iter().enumerate() {
        pictures.push(json!({"id": format!("p{index}"), "kind": "video", "srcId": "main",
            "srcStart": segment.source_start, "start": segment.timeline_start, "end": segment.timeline_end}));
    }
    let mut texts = Vec::new();
    let total = projection.duration();
    for index in 0..45_000 {
        let start = total * index as f64 / 45_000.0;
        texts.push(json!({"id": format!("t{index}"), "kind": "text", "start": start, "end": start + 2.0, "text": "x"}));
    }
    document.tracks = serde_json::from_value(json!([
        {"id": "video-track", "kind": "overlay", "elements": pictures},
        {"id": "texts", "kind": "overlay", "elements": texts}
    ]))
    .unwrap();

    let before = clock_snapshot(&document);
    let started = std::time::Instant::now();
    // Cut once more in the middle of each segment: 5 thousand new cuts followed in one pass.
    let extra: Vec<Cut> = projection.clips()[0]
        .segments
        .iter()
        .enumerate()
        .filter(|(_, segment)| segment.source_end - segment.source_start > 2.0)
        .map(|(index, segment)| {
            let middle = (segment.source_start + segment.source_end) / 2.0;
            cut(&format!("extra-{index}"), middle, middle + 0.25)
        })
        .collect();
    let source = document.sources.get_mut("main").unwrap();
    let mut all = source.cuts.clone();
    all.extend(extra);
    all.sort_by(|a, b| a.t0.total_cmp(&b.t0));
    source.cuts = all;
    let report = follow_clock(
        &before,
        &mut document,
        &durations,
        &BTreeMap::new(),
        &ClockEdit::Retime,
        &mut ids(),
    )
    .unwrap();
    let elapsed = started.elapsed();
    assert!(report.created.len() >= 5_000);
    assert!(
        elapsed.as_secs_f64() < 10.0,
        "follow took {elapsed:?}; quadratic?"
    );
}

// ---------------------------------------------------------------------------
// Stale pictures: documents left by old-version cuts that did not carry their pictures along
// ---------------------------------------------------------------------------

/// The shape left by the old defect: 2–4 is cut, but the picture is still 0–12 (source 0). It does not match any segment of the folded result, but it does match
/// the clock that does not count cuts.
fn stale() -> TimelineDocument {
    let mut document = detached();
    add_cuts(&mut document, &[("cut-1", 2.0, 4.0)]);
    document
}

fn stale_ids(document: &TimelineDocument) -> Vec<(String, String)> {
    let projection = TimelineProjection::build(document, &durations()).unwrap();
    stale_pictures(document, &projection, &durations())
        .into_iter()
        .map(|stale| (stale.element_id, stale.clip_id))
        .collect()
}

fn assignments(document: &TimelineDocument) -> BTreeMap<String, Vec<String>> {
    let projection = TimelineProjection::build(document, &durations()).unwrap();
    picture_assignments(document, &projection)
}

/// Recognised: a stale picture is reported, but it is not included in `clip list` attribution; after restoring the cut it stays put and becomes a picture that follows properly.
#[test]
fn a_stale_picture_is_recognised_and_restoring_the_cut_leaves_it_in_place() {
    let mut document = stale();
    assert_eq!(
        stale_ids(&document),
        vec![("video-c1-1".to_owned(), "c1".to_owned())]
    );
    assert!(assignments(&document).is_empty());

    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        assert!(restore_cut(
            &mut d.sources.get_mut("main").unwrap().cuts,
            "cut-1"
        ));
    });
    assert_eq!(pictures_of(&document), vec![(0.0, 12.0, 0.0)]);
    assert!(!report.retimed.contains(&"video-c1-1".to_owned()));
    assert!(!report.removed.contains(&"video-c1-1".to_owned()));
    assert!(report.created.is_empty());
    assert!(stale_ids(&document).is_empty());
    assert_eq!(assignments(&document)["c1"], vec!["video-c1-1".to_owned()]);
}

/// Cutting once more: the stale picture is distributed over the segments left after the operation by its source range, equivalent to first back-filling the historical cut 2–4.
#[test]
fn cutting_again_fits_a_stale_picture_onto_every_segment() {
    let mut document = stale();
    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-2", 6.0, 7.0)])
    });
    assert_eq!(
        pictures_of(&document),
        vec![(0.0, 2.0, 0.0), (2.0, 4.0, 4.0), (4.0, 9.0, 7.0)]
    );
    // Clock only: the music in the fixture also did not follow the cut at the time (0–12 exceeds the 2-second timeline), so by rule 3 it is kept at its distance to the tail.
    assert_eq!(
        TimelineProjection::build(&document, &durations())
            .unwrap()
            .duration(),
        9.0
    );
    assert_eq!(
        span(element(&document, "video-c1-1")),
        (Some(0.0), Some(2.0), Some(0.0))
    );
    assert!(report.retimed.contains(&"video-c1-1".to_owned()));
    let created: Vec<_> = report
        .created
        .iter()
        .filter(|created| created.clip_id.is_some())
        .collect();
    assert_eq!(created.len(), 2);
    for created in created {
        assert_eq!(created.from.as_deref(), Some("video-c1-1"));
        assert_eq!(created.clip_id.as_deref(), Some("c1"));
    }
    assert!(stale_ids(&document).is_empty());
    assert_eq!(assignments(&document)["c1"].len(), 3);
}

/// Splitting: the stale picture is distributed over the two halves of the left segment and the right segment; the item in the right segment takes a new id and is assigned to the new segment.
#[test]
fn splitting_fits_a_stale_picture_onto_both_halves() {
    let mut document = stale();
    let report = step(
        &mut document,
        &mut ids(),
        ClockEdit::Split {
            left: "c1".to_owned(),
            right: "c2".to_owned(),
            at: 6.0,
        },
        |d| {
            split_clip(d, &durations(), 6.0, "c2".to_owned()).unwrap();
        },
    );
    assert_eq!(
        pictures_of(&document),
        vec![(0.0, 2.0, 0.0), (2.0, 6.0, 4.0), (6.0, 10.0, 8.0)]
    );
    assert_eq!(
        report.created[..2],
        [
            FollowCreated {
                id: "el-1".to_owned(),
                from: Some("video-c1-1".to_owned()),
                clip_id: Some("c1".to_owned()),
            },
            FollowCreated {
                id: "el-2".to_owned(),
                from: Some("video-c1-1".to_owned()),
                clip_id: Some("c2".to_owned()),
            },
        ]
    );
    let owned = assignments(&document);
    assert_eq!(
        owned["c1"],
        vec!["video-c1-1".to_owned(), "el-1".to_owned()]
    );
    assert_eq!(owned["c2"], vec!["el-2".to_owned()]);
}

/// Not claimed: an intentionally placed overlay video (source-synchronised but whose start is not at the unfolded position of the segment), and another video that happens to match the unfolded clock
/// when the segment already has a picture that follows properly. These follow by their numeric time and are not treated as picture segments.
#[test]
fn deliberate_overlay_video_is_never_claimed_as_a_stale_picture() {
    // The segment's own picture was deleted, leaving only an overlay video that plays from source 0 and sits at 1–3.
    let mut document = stale();
    document.tracks[0].elements[0] = doc_element(json!(
        {"id": "pip", "kind": "video", "srcId": "main", "srcStart": 0.0, "start": 1.0, "end": 3.0}
    ));
    assert!(stale_ids(&document).is_empty());
    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-2", 6.0, 7.0)])
    });
    assert_eq!(
        span(element(&document, "pip")),
        (Some(1.0), Some(3.0), Some(0.0))
    );
    assert!(
        report
            .created
            .iter()
            .all(|created| created.clip_id.is_none())
    );

    // The picture has already followed the cut; another video that matches the unfolded clock does not count as this segment's picture.
    let mut document = detached();
    let mut next_id = ids();
    step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 2.0, 4.0)])
    });
    document.tracks[1].elements.push(doc_element(json!(
        {"id": "ghost", "kind": "video", "srcId": "main", "srcStart": 0.0, "start": 0.0, "end": 12.0}
    )));
    assert!(stale_ids(&document).is_empty());
    let report = step(&mut document, &mut next_id, ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-2", 6.0, 7.0)])
    });
    assert!(
        report
            .created
            .iter()
            .all(|created| created.from.as_deref() != Some("ghost"))
    );
    assert!(has(&document, "ghost"));
}

// ---------------------------------------------------------------------------
// Keyframes and ducking follow along (G6 × G4)
// ---------------------------------------------------------------------------

fn keyframes_of(value: Value) -> Option<crate::keyframes::Keyframes> {
    Some(serde_json::from_value(value).expect("keyframes fixture"))
}

fn frames_of(element: &Element, prop: &str) -> Vec<(Value, f64)> {
    element
        .keyframes
        .as_ref()
        .and_then(|keyframes| keyframes.get(prop))
        .unwrap_or_else(|| panic!("{} has no {prop} keyframes", element.id))
        .iter()
        .map(|frame| (serde_json::to_value(&frame.t).unwrap(), frame.v))
        .collect()
}

fn close(actual: &[(Value, f64)], expected: &[(Value, f64)]) {
    assert_eq!(actual.len(), expected.len(), "{actual:?} vs {expected:?}");
    for ((t, v), (et, ev)) in actual.iter().zip(expected) {
        match (t.as_f64(), et.as_f64()) {
            (Some(a), Some(b)) => assert!((a - b).abs() < 1e-6, "{actual:?} vs {expected:?}"),
            _ => assert_eq!(t, et, "{actual:?} vs {expected:?}"),
        }
        assert!((v - ev).abs() < 1e-6, "{actual:?} vs {expected:?}");
    }
}

/// A cut splits the picture of a segment that has keyframes into two items: second-based notation is converted by each item's own source range, and sampled frames are added at the boundaries; percentages are rewritten into each item's own share, and the value at the seam is the value of the original animation at that moment.
#[test]
fn a_mid_cut_divides_picture_keyframes_between_the_two_pieces() {
    let mut document = detached();
    document.tracks[0].elements[0].keyframes = keyframes_of(json!({
        "scale": [{"t": 0.0, "v": 1.0}, {"t": 12.0, "v": 2.0}],
        "x": [{"t": "0%", "v": 0.0}, {"t": "100%", "v": 12.0}]
    }));
    step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 2.0, 4.0)])
    });
    let left = element(&document, "video-c1-1");
    let right = element(&document, "el-1");
    close(
        &frames_of(left, "scale"),
        &[(json!(0.0), 1.0), (json!(2.0), 1.0 + 2.0 / 12.0)],
    );
    close(
        &frames_of(right, "scale"),
        &[(json!(0.0), 1.0 + 4.0 / 12.0), (json!(8.0), 2.0)],
    );
    close(
        &frames_of(left, "x"),
        &[(json!("0%"), 0.0), (json!("100%"), 2.0)],
    );
    close(
        &frames_of(right, "x"),
        &[(json!("0%"), 4.0), (json!("100%"), 12.0)],
    );
    document.validate().expect("keyframes are still valid after follow");
}

/// An element that was only trimmed: second-based notation is shifted by the amount its start was pushed later (the frames dropped are replaced by a sampled frame at 0), while percentages
/// are kept as-is (they scale with the new duration).
#[test]
fn a_head_trim_shifts_second_keyframes_and_keeps_percent_ones() {
    let mut document = detached();
    document.tracks[1].elements.push(doc_element(json!({
        "id": "title", "kind": "text", "text": "hi", "start": 1.0, "end": 5.0,
        "keyframes": {
            "opacity": [{"t": 0.0, "v": 0.0}, {"t": 2.0, "v": 1.0}],
            "scale": [{"t": "0%", "v": 1.0}, {"t": "100%", "v": 2.0}]
        }
    })));
    step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 0.0, 2.0)])
    });
    let title = element(&document, "title");
    assert_eq!(span(title), (Some(0.0), Some(3.0), None));
    close(
        &frames_of(title, "opacity"),
        &[(json!(0.0), 0.5), (json!(1.0), 1.0)],
    );
    close(
        &frames_of(title, "scale"),
        &[(json!("0%"), 1.0), (json!("100%"), 2.0)],
    );
}

/// A split seam cuts background music that has keyframes and ducking: each half rewrites its percentages on its own, and it stays continuous at the seam; `duck` is carried by both halves.
#[test]
fn splitting_divides_keyframes_and_copies_duck_to_both_halves() {
    let mut document = detached();
    let music = &mut document.tracks[2].elements[0];
    music.keyframes = keyframes_of(json!({
        "volume": [{"t": "0%", "v": 1.0}, {"t": "100%", "v": 0.0}]
    }));
    music.duck = Some(serde_json::from_value(json!({"under": "speech", "depth": 12.0})).unwrap());
    step(
        &mut document,
        &mut ids(),
        ClockEdit::Split {
            left: "c1".to_owned(),
            right: "c2".to_owned(),
            at: 5.0,
        },
        |d| {
            split_clip(d, &durations(), 5.0, "c2".to_owned()).unwrap();
        },
    );
    let left = element(&document, "music");
    let right = element(&document, "el-3");
    let seam = 1.0 - 5.0 / 12.0;
    close(
        &frames_of(left, "volume"),
        &[(json!("0%"), 1.0), (json!("100%"), seam)],
    );
    close(
        &frames_of(right, "volume"),
        &[(json!("0%"), seam), (json!("100%"), 0.0)],
    );
    assert_eq!(left.duck, right.duck);
    assert!(right.duck.is_some());
    document.validate().expect("still valid after split");
}

/// Following deletes all the elements on the track that a ducking references: the track remains (empty), `duck.under` does not dangle, and the write is still valid.
#[test]
fn a_ducked_track_survives_being_emptied_by_follow() {
    let mut document = detached();
    document.tracks.push(
        serde_json::from_value(json!({"id": "tr-vo", "kind": "audio", "elements": [
            {"id": "vo", "kind": "audio", "srcId": "b", "srcStart": 0.0, "start": 2.0, "end": 4.0}
        ]}))
        .unwrap(),
    );
    document.tracks[2].elements[0].duck =
        Some(serde_json::from_value(json!({"under": "tr-vo"})).unwrap());
    let report = step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 1.5, 4.5)])
    });
    assert!(report.removed.contains(&"vo".to_owned()));
    let track = document
        .tracks
        .iter()
        .find(|track| track.id == "tr-vo")
        .expect("the empty track referenced by ducking is kept");
    assert!(track.elements.is_empty());
    document.validate().expect("duck.under still points to an existing track");
}

/// An element without keyframes does not gain `keyframes` after following.
#[test]
fn follow_never_adds_keyframes_to_elements_without_them() {
    let mut document = detached();
    step(&mut document, &mut ids(), ClockEdit::Retime, |d| {
        add_cuts(d, &[("cut-1", 2.0, 4.0)])
    });
    for element in document.tracks.iter().flat_map(|track| &track.elements) {
        assert!(element.keyframes.is_none(), "{}", element.id);
    }
}
