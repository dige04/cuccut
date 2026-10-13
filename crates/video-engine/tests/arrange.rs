//! Stacking order: `arrangeItem` moves a picture instance forward or backward one layer, or to the front or back, and `moveTrack` moves a track above or below tracks of the same kind.
//! Stacking order is the vertical order of the tracks: instances on a shared track are split onto newly created adjacent tracks, and instances on an exclusive track move the whole track. Both operations can be undone.

#![allow(clippy::result_large_err)]

use std::path::Path;

use editor_semantics::Rate;
use serde_json::{Value, json};
use video_engine::model::{Actor, ActorKind, TimelineItem};
use video_engine::{CreateOptions, ErrorBody, UndoRequest, UndoTarget, Video, VideoTransaction};

fn ffprobe() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("CUCCUT_FFPROBE").unwrap_or_else(|_| "ffprobe".into()))
}

fn user() -> Actor {
    Actor {
        kind: ActorKind::User,
        id: "user_local".into(),
    }
}

fn new_video(dir: &Path) -> Video {
    let options = CreateOptions {
        name: "叠放".into(),
        fps: Rate { num: 30, den: 1 },
        width: 1920,
        height: 1080,
    };
    Video::create(dir, &options, &ffprobe()).expect("新建视频")
}

fn apply(video: &mut Video, command_id: &str, operations: Vec<Value>) -> Result<video_engine::Committed, ErrorBody> {
    let transaction = VideoTransaction {
        command_id: command_id.into(),
        expected_revision: video.revision(),
        label: None,
        label_ref: None,
        operations,
        actor: user(),
        task_id: None,
    };
    video.apply(&transaction)
}

fn undo(video: &mut Video, command_id: &str, committed: &video_engine::Committed) {
    video
        .undo(&UndoRequest {
            command_id: command_id.into(),
            target: UndoTarget::Transaction(committed.receipt.transaction_id.clone()),
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
}

fn seq(video: &Video) -> String {
    video.state().root_sequence_id.clone()
}

fn track(video: &Video, name: &str) -> String {
    video
        .state()
        .tracks
        .values()
        .find(|t| t.value.name.as_deref() == Some(name))
        .map(|t| t.value.id.clone())
        .unwrap()
}

fn order(video: &Video, id: &str) -> i64 {
    video.state().tracks[id].value.order
}

fn track_of(video: &Video, item_id: &str) -> String {
    video.state().items[item_id].value.base().track_id.clone()
}

fn find(video: &Video, pick: impl Fn(&TimelineItem) -> bool) -> String {
    video
        .state()
        .items
        .values()
        .find(|p| pick(&p.value))
        .map(|p| p.value.base().id.clone())
        .unwrap()
}

/// Picture track names from bottom to top (by `order`).
fn visual_stack(video: &Video) -> Vec<String> {
    let mut tracks: Vec<_> = video
        .state()
        .tracks
        .values()
        .filter(|t| t.value.kind == video_engine::model::TrackKind::Visual)
        .collect();
    tracks.sort_by_key(|t| t.value.order);
    tracks.iter().map(|t| t.value.name.clone().unwrap()).collect()
}

fn arrange(video: &mut Video, command_id: &str, item_id: &str, direction: &str) -> Result<video_engine::Committed, ErrorBody> {
    apply(
        video,
        command_id,
        vec![json!({ "type": "arrangeItem", "itemId": item_id, "direction": direction })],
    )
}

struct Fixture {
    video: Video,
    seq: String,
    /// Text at frames 0–60 on V1, sharing V1 with a graphic.
    text: String,
    /// A graphic at frames 60–90 on V1.
    shape: String,
    /// A progress bar exclusive to V2.
    progress: String,
    _dir: tempfile::TempDir,
}

/// V1 (text and graphic), A1, V2 (progress bar): order 0, 1, 2 in turn. No media, so no ffprobe is needed.
fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(&dir.path().join("m"));
    let s = seq(&video);
    apply(
        &mut video,
        "cmd_setup",
        vec![json!({ "type": "addTrack", "sequenceId": s, "kind": "visual" })],
    )
    .unwrap();
    let (v1, v2) = (track(&video, "V1"), track(&video, "V2"));
    assert_eq!(
        [order(&video, &v1), order(&video, &track(&video, "A1")), order(&video, &v2)],
        [0, 1, 2]
    );
    let items = json!([
        { "type": "text", "trackId": v1, "span": { "fromFrame": 0, "durationFrames": 60 }, "place": { "x": 25, "y": 25, "w": 50 },
          "text": "标题", "style": { "fontSize": 64 } },
        { "type": "shape", "trackId": v1, "span": { "fromFrame": 60, "durationFrames": 30 },
          "shape": { "shape": "rect", "fill": "#FFD646" } },
        { "type": "progress", "trackId": v2, "span": { "fromFrame": 0, "durationFrames": 90 }, "place": { "y": 95, "w": 100 },
          "progress": { "style": "bar" } },
    ]);
    apply(
        &mut video,
        "cmd_items",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": items })],
    )
    .unwrap();
    Fixture {
        text: find(&video, |i| matches!(i, TimelineItem::Text(_))),
        shape: find(&video, |i| matches!(i, TimelineItem::Shape(_))),
        progress: find(&video, |i| matches!(i, TimelineItem::Progress(_))),
        seq: s,
        video,
        _dir: dir,
    }
}

#[test]
fn a_clip_sharing_its_track_is_split_out_to_a_new_adjacent_track() {
    let mut f = fixture();
    let (v1, a1, v2) = (track(&f.video, "V1"), track(&f.video, "A1"), track(&f.video, "V2"));

    // Move forward one layer: the text is split onto a new V3 created above V1, and the tracks above shift up one; the graphic stays on V1.
    let committed = arrange(&mut f.video, "cmd_forward", &f.text, "forward").unwrap();
    assert_eq!(committed.receipt.created_ids.len(), 1, "新建了一条轨道");
    let v3 = committed.receipt.created_ids[0].clone();
    assert_eq!(track_of(&f.video, &f.text), v3);
    assert_eq!(track_of(&f.video, &f.shape), v1);
    assert_eq!(
        [
            order(&f.video, &v1),
            order(&f.video, &v3),
            order(&f.video, &a1),
            order(&f.video, &v2)
        ],
        [0, 1, 2, 3]
    );
    assert_eq!(visual_stack(&f.video), ["V1", "V3", "V2"]);
    assert!(committed.receipt.updated_ids.contains(&f.text));
    assert!(
        committed.receipt.updated_ids.contains(&a1) && committed.receipt.updated_ids.contains(&v2),
        "让位的轨道列在 updatedIds"
    );

    // Undo: the track is gone, the text returns to V1, and order is restored.
    undo(&mut f.video, "cmd_undo", &committed);
    assert!(!f.video.state().tracks.contains_key(&v3));
    assert_eq!(track_of(&f.video, &f.text), v1);
    assert_eq!([order(&f.video, &v1), order(&f.video, &a1), order(&f.video, &v2)], [0, 1, 2]);

    // Move backward one layer: split onto a new track created below V1; V1 and the tracks above it shift up one; order never becomes negative.
    let committed = arrange(&mut f.video, "cmd_backward", &f.shape, "backward").unwrap();
    let below = committed.receipt.created_ids[0].clone();
    assert_eq!(track_of(&f.video, &f.shape), below);
    assert_eq!(
        [
            order(&f.video, &below),
            order(&f.video, &v1),
            order(&f.video, &a1),
            order(&f.video, &v2)
        ],
        [0, 1, 2, 3]
    );
    assert_eq!(visual_stack(&f.video), ["V3", "V1", "V2"]);
}

#[test]
fn front_and_back_on_a_shared_track_create_tracks_at_the_extremes() {
    let mut f = fixture();
    let (v1, v2) = (track(&f.video, "V1"), track(&f.video, "V2"));

    // Move to front: the new track is placed above all tracks (max + 1); other tracks do not move.
    let committed = arrange(&mut f.video, "cmd_front", &f.text, "front").unwrap();
    let top = committed.receipt.created_ids[0].clone();
    assert_eq!(track_of(&f.video, &f.text), top);
    assert_eq!(order(&f.video, &top), 3);
    assert_eq!([order(&f.video, &v1), order(&f.video, &v2)], [0, 2]);
    assert_eq!(visual_stack(&f.video), ["V1", "V2", "V3"]);

    // The graphic now exclusively holds V1; “Move to back” again: it is already at the back, so it is rejected.
    let err = arrange(&mut f.video, "cmd_back_edge", &f.shape, "back").unwrap_err();
    assert_eq!(err.code, "INVALID_OPERATION");
    assert_eq!(err.details["rule"], json!("already-at-edge"));
    assert_eq!(err.details["edge"], json!("back"));

    // Move the graphic back onto the text's track, then “Move to back”: split onto a new track created at the very bottom, and the other tracks shift up one.
    apply(
        &mut f.video,
        "cmd_join",
        vec![json!({ "type": "moveItem", "sequenceId": f.seq, "itemId": f.shape, "at": { "unit": "frames", "value": 60 }, "trackId": top, "alignment": "exact-frame" })],
    )
    .unwrap();
    let committed = arrange(&mut f.video, "cmd_back", &f.shape, "back").unwrap();
    let bottom = committed.receipt.created_ids[0].clone();
    assert_eq!(track_of(&f.video, &f.shape), bottom);
    assert_eq!(order(&f.video, &bottom), 0);
    assert_eq!([order(&f.video, &v1), order(&f.video, &v2), order(&f.video, &top)], [1, 3, 4]);
}

#[test]
fn a_clip_alone_on_its_track_moves_the_whole_track() {
    let mut f = fixture();
    let (v1, a1, v2) = (track(&f.video, "V1"), track(&f.video, "A1"), track(&f.video, "V2"));

    // The progress bar exclusively holds the top V2: there is nowhere further forward.
    let err = arrange(&mut f.video, "cmd_edge", &f.progress, "forward").unwrap_err();
    assert_eq!(err.code, "INVALID_OPERATION");
    assert_eq!(err.details["edge"], json!("front"));
    assert_eq!(err.entity_ids, vec![f.progress.clone()]);

    // Move backward one layer: V2 and V1 swap order; no new track is created; audio tracks do not move.
    let committed = arrange(&mut f.video, "cmd_backward", &f.progress, "backward").unwrap();
    assert!(committed.receipt.created_ids.is_empty());
    assert_eq!(track_of(&f.video, &f.progress), v2);
    assert_eq!([order(&f.video, &v2), order(&f.video, &a1), order(&f.video, &v1)], [0, 1, 2]);
    assert_eq!(visual_stack(&f.video), ["V2", "V1"]);
    assert!(!committed.receipt.updated_ids.contains(&a1));
    undo(&mut f.video, "cmd_undo", &committed);
    assert_eq!([order(&f.video, &v1), order(&f.video, &a1), order(&f.video, &v2)], [0, 1, 2]);

    // With three picture tracks, “Move to back”: this one goes to the very bottom, the others shift in turn; the set of order values is unchanged.
    apply(&mut f.video, "cmd_v3", vec![json!({ "type": "addTrack", "kind": "visual" })]).unwrap();
    let v3 = track(&f.video, "V3");
    assert_eq!(order(&f.video, &v3), 3);
    apply(
        &mut f.video,
        "cmd_lift",
        vec![json!({ "type": "moveItem", "sequenceId": f.seq, "itemId": f.progress, "at": { "unit": "frames", "value": 0 }, "trackId": v3, "alignment": "exact-frame" })],
    )
    .unwrap();
    arrange(&mut f.video, "cmd_back", &f.progress, "back").unwrap();
    assert_eq!([order(&f.video, &v3), order(&f.video, &v1), order(&f.video, &v2)], [0, 2, 3]);
    assert_eq!(visual_stack(&f.video), ["V3", "V1", "V2"]);
    // Then “Move to front”: it returns to the top.
    arrange(&mut f.video, "cmd_front", &f.progress, "front").unwrap();
    assert_eq!([order(&f.video, &v1), order(&f.video, &v2), order(&f.video, &v3)], [0, 2, 3]);
}

#[test]
fn arranging_refuses_locked_clips_and_tracks() {
    let mut f = fixture();
    let v1 = track(&f.video, "V1");
    apply(
        &mut f.video,
        "cmd_lock_item",
        vec![json!({ "type": "updateItem", "itemId": f.text, "locked": true })],
    )
    .unwrap();
    assert_eq!(
        arrange(&mut f.video, "cmd_a", &f.text, "forward").unwrap_err().code,
        "TARGET_LOCKED"
    );
    apply(
        &mut f.video,
        "cmd_lock_track",
        vec![json!({ "type": "updateTrack", "trackId": v1, "locked": true })],
    )
    .unwrap();
    assert_eq!(
        arrange(&mut f.video, "cmd_b", &f.shape, "forward").unwrap_err().code,
        "TARGET_LOCKED"
    );
    // An instance of another sequence, a nonexistent instance.
    let err = apply(
        &mut f.video,
        "cmd_c",
        vec![json!({ "type": "arrangeItem", "sequenceId": "seq_other", "itemId": f.progress, "direction": "front" })],
    )
    .unwrap_err();
    assert_eq!(err.code, "TIME_DOMAIN_MISMATCH");
    assert_eq!(
        apply(
            &mut f.video,
            "cmd_d",
            vec![json!({ "type": "arrangeItem", "itemId": "item_missing", "direction": "front" })]
        )
        .unwrap_err()
        .code,
        "ENTITY_NOT_FOUND"
    );
}

#[test]
fn splitting_a_clip_out_drops_the_transition_with_its_former_neighbour() {
    let mut f = fixture();
    let s = f.seq.clone();
    let set = apply(
        &mut f.video,
        "cmd_tr",
        vec![
            json!({ "type": "setTransition", "sequenceId": s, "leftItemId": f.text, "rightItemId": f.shape, "kind": "dissolve",
                     "duration": { "unit": "frames", "value": 10 }, "alignment": "exact-frame" }),
        ],
    )
    .unwrap();
    let transition = set.receipt.created_ids[0].clone();
    let committed = arrange(&mut f.video, "cmd_forward", &f.text, "forward").unwrap();
    let impact = serde_json::to_value(&committed.receipt.impact).unwrap();
    assert_eq!(
        impact["removedTransitions"],
        json!([{ "id": transition, "reason": "not-adjacent" }])
    );
    assert!(committed.receipt.deleted_ids.contains(&transition));
}

#[test]
fn a_picture_clip_can_be_brought_in_front_of_a_subtitle_track() {
    let mut f = fixture();
    let (v2, _) = (track(&f.video, "V2"), ());
    apply(&mut f.video, "cmd_s1", vec![json!({ "type": "addTrack", "kind": "subtitle" })]).unwrap();
    let s1 = track(&f.video, "S1");
    assert!(order(&f.video, &s1) > order(&f.video, &v2));

    // The progress bar exclusively holds V2, with only a subtitle track above it: moving forward one layer swaps it with the subtitle track, so the picture covers the subtitles.
    let committed = arrange(&mut f.video, "cmd_fwd", &f.progress, "forward").unwrap();
    assert!(order(&f.video, &v2) > order(&f.video, &s1));
    assert!(committed.receipt.created_ids.is_empty());
    assert_eq!(track_of(&f.video, &f.progress), v2);

    // Already at the top; cannot go further forward.
    let err = arrange(&mut f.video, "cmd_top", &f.progress, "forward").unwrap_err();
    assert_eq!(err.code, "INVALID_OPERATION");
    undo(&mut f.video, "cmd_undo", &committed);
    assert!(order(&f.video, &s1) > order(&f.video, &v2));
}

#[test]
fn move_track_reorders_tracks_within_one_stack() {
    let mut f = fixture();
    let (v1, a1, v2) = (track(&f.video, "V1"), track(&f.video, "A1"), track(&f.video, "V2"));
    apply(&mut f.video, "cmd_v3", vec![json!({ "type": "addTrack", "kind": "visual" })]).unwrap();
    let v3 = track(&f.video, "V3");
    assert_eq!(visual_stack(&f.video), ["V1", "V2", "V3"]);

    // V1 is moved above V3: tracks of the same kind take back their original order values {0, 2, 3}; audio tracks do not move.
    let committed = apply(
        &mut f.video,
        "cmd_move",
        vec![json!({ "type": "moveTrack", "sequenceId": f.seq, "trackId": v1, "target": v3, "position": "above" })],
    )
    .unwrap();
    assert_eq!(visual_stack(&f.video), ["V2", "V3", "V1"]);
    assert_eq!(
        [
            order(&f.video, &v2),
            order(&f.video, &v3),
            order(&f.video, &v1),
            order(&f.video, &a1)
        ],
        [0, 2, 3, 1]
    );
    assert!(committed.receipt.created_ids.is_empty());
    assert!(!committed.receipt.updated_ids.contains(&a1));
    // Instances follow their track: no change of track.
    assert_eq!(track_of(&f.video, &f.text), v1);
    undo(&mut f.video, "cmd_undo", &committed);
    assert_eq!(visual_stack(&f.video), ["V1", "V2", "V3"]);

    // V3 is moved below V1.
    apply(
        &mut f.video,
        "cmd_below",
        vec![json!({ "type": "moveTrack", "trackId": v3, "target": v1, "position": "below" })],
    )
    .unwrap();
    assert_eq!(visual_stack(&f.video), ["V3", "V1", "V2"]);
    assert_eq!([order(&f.video, &v3), order(&f.video, &v1), order(&f.video, &v2)], [0, 2, 3]);

    // Pictures and subtitles are in the same stack: a picture track may be placed above a subtitle track (the picture covers the subtitles).
    apply(&mut f.video, "cmd_s1", vec![json!({ "type": "addTrack", "kind": "subtitle" })]).unwrap();
    let s1 = track(&f.video, "S1");
    assert!(order(&f.video, &s1) > order(&f.video, &v2));
    apply(
        &mut f.video,
        "cmd_over_subs",
        vec![json!({ "type": "moveTrack", "trackId": v2, "target": s1, "position": "above" })],
    )
    .unwrap();
    assert!(order(&f.video, &v2) > order(&f.video, &s1));
    assert!(order(&f.video, &s1) > order(&f.video, &v1));

    // Sound is another stack; itself; locked; nonexistent.
    let err = apply(
        &mut f.video,
        "cmd_kind",
        vec![json!({ "type": "moveTrack", "trackId": v1, "target": a1, "position": "above" })],
    )
    .unwrap_err();
    assert_eq!(err.code, "INVALID_OPERATION");
    let err = apply(
        &mut f.video,
        "cmd_self",
        vec![json!({ "type": "moveTrack", "trackId": v1, "target": v1, "position": "above" })],
    )
    .unwrap_err();
    assert_eq!(err.code, "INVALID_OPERATION");
    apply(
        &mut f.video,
        "cmd_lock",
        vec![json!({ "type": "updateTrack", "trackId": v1, "locked": true })],
    )
    .unwrap();
    let err = apply(
        &mut f.video,
        "cmd_locked",
        vec![json!({ "type": "moveTrack", "trackId": v1, "target": v2, "position": "above" })],
    )
    .unwrap_err();
    assert_eq!(err.code, "TARGET_LOCKED");
    let err = apply(
        &mut f.video,
        "cmd_missing",
        vec![json!({ "type": "moveTrack", "trackId": v2, "target": "track_missing", "position": "above" })],
    )
    .unwrap_err();
    assert_eq!(err.code, "ENTITY_NOT_FOUND");
}
