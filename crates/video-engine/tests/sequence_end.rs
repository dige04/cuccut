//! Until sequence end (video format spec §3.16): the end point of an instance with `untilSequenceEnd` is computed by the engine at the end of every edit transaction from the current timeline,
//! not from the length the instance itself stores; when there is an instance later on the same track, it is cut at that instance's start, at least 1 frame, and instances with a source clock do not extend past the material.

#![allow(clippy::result_large_err)]

use std::path::{Path, PathBuf};
use std::process::Command;

use editor_semantics::Rate;
use serde_json::{Value, json};
use video_engine::model::{Actor, ActorKind, TimelineItem};
use video_engine::{Committed, CreateOptions, ErrorBody, TaskProtection, UndoRequest, UndoTarget, Video, VideoTransaction};

fn ffprobe() -> PathBuf {
    PathBuf::from(std::env::var("CUCCUT_FFPROBE").unwrap_or_else(|_| "ffprobe".into()))
}

fn actor(kind: ActorKind) -> Actor {
    Actor { kind, id: "local".into() }
}

fn new_video(dir: &Path) -> Video {
    let options = CreateOptions {
        name: "测试视频".into(),
        fps: Rate { num: 30, den: 1 },
        width: 1920,
        height: 1080,
    };
    Video::create(dir, &options, &ffprobe()).expect("新建视频")
}

fn apply_guarded(video: &mut Video, command_id: &str, operations: Vec<Value>, guard: &[TaskProtection]) -> Result<Committed, ErrorBody> {
    let transaction = VideoTransaction {
        command_id: command_id.into(),
        expected_revision: video.revision(),
        label: None,
        label_ref: None,
        operations,
        actor: actor(if guard.is_empty() { ActorKind::User } else { ActorKind::Agent }),
        task_id: (!guard.is_empty()).then(|| "task_1".to_string()),
    };
    video.apply_guarded(&transaction, guard)
}

fn apply(video: &mut Video, command_id: &str, operations: Vec<Value>) -> Result<Committed, ErrorBody> {
    apply_guarded(video, command_id, operations, &[])
}

fn frames_of(video: &Video, id: &str) -> (i64, i64) {
    let span = video.state().items[id].value.span().expect("帧网格上的实例");
    (span.from_frame, span.end_frame())
}

fn shape(track: &str, from: i64, to: i64, until_end: bool) -> Value {
    let mut item = json!({ "type": "shape", "trackId": track, "span": { "fromFrame": from, "durationFrames": to - from },
            "shape": { "shape": "rect", "fill": "#FFD646" } });
    if until_end {
        item["untilSequenceEnd"] = json!(true);
    }
    item
}

fn trim_end(video: &mut Video, command_id: &str, item: &str, frame: i64) -> Result<Committed, ErrorBody> {
    let s = video.state().root_sequence_id.clone();
    apply(
        video,
        command_id,
        vec![json!({ "type": "trimItem", "sequenceId": s, "itemId": item, "edge": "end",
                     "at": { "unit": "frames", "value": frame }, "alignment": "exact-frame" })],
    )
}

struct Fixture {
    video: Video,
    /// Three picture tracks: the main content is on g1, and the until-sequence-end instances are on g2 and g3.
    tracks: [String; 3],
    /// [0, 300) on g1.
    main: String,
    _dir: tempfile::TempDir,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(&dir.path().join("m"));
    let s = video.state().root_sequence_id.clone();
    let made = apply(
        &mut video,
        "cmd_tracks",
        vec![
            json!({ "type": "addTrack", "sequenceId": s, "kind": "visual", "ref": "g1" }),
            json!({ "type": "addTrack", "sequenceId": s, "kind": "visual", "ref": "g2" }),
            json!({ "type": "addTrack", "sequenceId": s, "kind": "visual", "ref": "g3" }),
        ],
    )
    .unwrap();
    let tracks = ["g1", "g2", "g3"].map(|r| made.receipt.refs[r].clone());
    let main = apply(
        &mut video,
        "cmd_main",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": [shape(&tracks[0], 0, 300, false)] })],
    )
    .unwrap()
    .receipt
    .created_ids[0]
        .clone();
    Fixture {
        video,
        tracks,
        main,
        _dir: dir,
    }
}

fn insert(video: &mut Video, command_id: &str, items: Vec<Value>) -> Vec<String> {
    let s = video.state().root_sequence_id.clone();
    apply(
        video,
        command_id,
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": items })],
    )
    .unwrap()
    .receipt
    .created_ids
}

#[test]
fn the_open_end_follows_the_latest_other_item() {
    let Fixture {
        mut video,
        tracks,
        main,
        _dir,
    } = fixture();
    // The length given at write time does not count: within the same transaction it is computed to the sequence end. Two until-sequence-end instances do not count toward each other's end points.
    let mut open = insert(
        &mut video,
        "cmd_open",
        vec![shape(&tracks[1], 0, 30, true), shape(&tracks[2], 60, 90, true)],
    );
    open.sort_by_key(|id| frames_of(&video, id).0);
    assert_eq!(frames_of(&video, &open[0]), (0, 300));
    assert_eq!(frames_of(&video, &open[1]), (60, 300));

    let shortened = trim_end(&mut video, "cmd_short", &main, 150).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (0, 150));
    assert_eq!(frames_of(&video, &open[1]), (60, 150));
    assert_eq!(shortened.receipt.impact.new_duration_frames, 150);
    assert!(shortened.receipt.updated_ids.contains(&open[0]), "回执列出跟着变的实例");

    trim_end(&mut video, "cmd_long", &main, 240).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (0, 240));

    // Even directly editing its end point gets recomputed back to the sequence end: it has no end point of its own.
    trim_end(&mut video, "cmd_self", &open[0], 60).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (0, 240));

    // Undo returns to the length after the previous transaction.
    let last = trim_end(&mut video, "cmd_again", &main, 120).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (0, 120));
    video
        .undo(&UndoRequest {
            command_id: "cmd_undo".into(),
            target: UndoTarget::Transaction(last.receipt.transaction_id.clone()),
            expected_revision: None,
            actor: actor(ActorKind::User),
        })
        .unwrap();
    assert_eq!(frames_of(&video, &open[0]), (0, 240));
}

#[test]
fn a_later_item_on_the_same_track_caps_the_open_end() {
    let Fixture {
        mut video, tracks, _dir, ..
    } = fixture();
    let ids = insert(
        &mut video,
        "cmd_open",
        vec![shape(&tracks[1], 0, 30, true), shape(&tracks[1], 200, 230, false)],
    );
    let (open, later) = if frames_of(&video, &ids[0]).0 == 0 {
        (&ids[0], &ids[1])
    } else {
        (&ids[1], &ids[0])
    };
    assert_eq!(frames_of(&video, open), (0, 200));
    let s = video.state().root_sequence_id.clone();
    apply(
        &mut video,
        "cmd_delete",
        vec![json!({ "type": "deleteItems", "sequenceId": s, "itemIds": [later] })],
    )
    .unwrap();
    assert_eq!(frames_of(&video, open), (0, 300));
}

#[test]
fn the_open_end_keeps_at_least_one_frame() {
    let Fixture {
        mut video,
        tracks,
        main,
        _dir,
    } = fixture();
    let open = insert(&mut video, "cmd_open", vec![shape(&tracks[1], 280, 290, true)]);
    assert_eq!(frames_of(&video, &open[0]), (280, 300));
    trim_end(&mut video, "cmd_short", &main, 150).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (280, 281));
    trim_end(&mut video, "cmd_long", &main, 330).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (280, 330));
}

#[test]
fn locked_open_items_still_follow_and_task_guards_still_apply() {
    let Fixture {
        mut video,
        tracks,
        main,
        _dir,
    } = fixture();
    let open = insert(&mut video, "cmd_open", vec![shape(&tracks[1], 0, 30, true)]);
    let s = video.state().root_sequence_id.clone();
    apply(
        &mut video,
        "cmd_lock",
        vec![
            json!({ "type": "updateItem", "sequenceId": s, "itemId": open[0], "locked": true }),
            json!({ "type": "updateTrack", "sequenceId": s, "trackId": tracks[1], "locked": true }),
        ],
    )
    .unwrap();
    // The end point is computed, not an edit to it: it updates even when locked.
    trim_end(&mut video, "cmd_short", &main, 150).unwrap();
    assert_eq!(frames_of(&video, &open[0]), (0, 150));

    // Task protection is checked against the change: changing the main content would also change a protected instance, so the whole edit is rejected and nothing is written.
    let guard: Vec<TaskProtection> =
        serde_json::from_value(json!([{ "protectionId": "prot_e", "target": { "kind": "entity", "entityId": open[0] } }])).unwrap();
    let revision = video.revision();
    let error = apply_guarded(
        &mut video,
        "cmd_guarded",
        vec![json!({ "type": "trimItem", "sequenceId": s, "itemId": main, "edge": "end",
                     "at": { "unit": "frames", "value": 120 }, "alignment": "exact-frame" })],
        &guard,
    )
    .unwrap_err();
    assert_eq!(error.code, "TASK_PROTECTED");
    assert_eq!(video.revision(), revision);
    assert_eq!(frames_of(&video, &main), (0, 150));
    // Edits that do not change the sequence end pass as usual.
    apply_guarded(
        &mut video,
        "cmd_guarded_ok",
        vec![json!({ "type": "setStyle", "itemId": main, "opacity": 0.5 })],
        &guard,
    )
    .unwrap();
}

/// A video of 12 seconds at 30 fps.
fn clip() -> Option<(tempfile::TempDir, PathBuf)> {
    let dir = tempfile::tempdir().ok()?;
    let path = dir.path().join("talk.mp4");
    let ok = Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=160x90:rate=30:duration=12",
            "-c:v",
            "mpeg4",
        ])
        .arg(&path)
        .output()
        .is_ok_and(|o| o.status.success());
    if !ok {
        eprintln!("跳过：没有可用的 ffmpeg 生成测试素材");
        return None;
    }
    Some((dir, path))
}

#[test]
fn an_open_video_stops_at_the_end_of_its_source() {
    let Some((_media, path)) = clip() else { return };
    let Fixture {
        mut video,
        tracks,
        main,
        _dir,
    } = fixture();
    trim_end(&mut video, "cmd_long", &main, 600).unwrap();
    let s = video.state().root_sequence_id.clone();
    let added = apply(
        &mut video,
        "cmd_video",
        vec![
            json!({ "type": "importAsset", "path": path, "ref": "talk" }),
            json!({ "type": "addItem", "sequenceId": s, "asset": { "ref": "talk" }, "alignment": "nearest-frame" }),
        ],
    )
    .unwrap();
    let picture = added
        .receipt
        .created_ids
        .iter()
        .find(|id| matches!(video.state().items.get(*id).map(|p| &p.value), Some(TimelineItem::Video(_))))
        .unwrap()
        .clone();
    // A copy of the same material, starting at source second 2 and running to the sequence end: it plays at most to the end of the source, i.e. 10 seconds = 300 frames.
    let mut copy = serde_json::to_value(&video.state().items[&picture].value).unwrap();
    let fields = copy.as_object_mut().unwrap();
    fields.remove("id");
    fields.remove("lineage");
    fields.insert("trackId".into(), json!(tracks[1]));
    fields.insert("span".into(), json!({ "fromFrame": 100, "durationFrames": 30 }));
    fields.insert(
        "timeMap".into(),
        json!({ "kind": "linear", "sourceIn": { "ticks": "2", "timescale": 1 }, "rate": { "num": 1, "den": 1 } }),
    );
    fields.insert("untilSequenceEnd".into(), json!(true));
    let open = insert(&mut video, "cmd_open", vec![copy]);
    assert_eq!(frames_of(&video, &open[0]), (100, 400));
    trim_end(&mut video, "cmd_short", &main, 200).unwrap();
    assert_eq!(
        frames_of(&video, &open[0]),
        (100, 360),
        "主内容短于素材时，终点是序列里其余实例的终点（这里是 12 秒的原片）"
    );
}

#[test]
fn an_open_follower_tracks_the_end_through_a_cut_and_its_restore() {
    let Some((_media, path)) = clip() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(&dir.path().join("m"));
    let s = video.state().root_sequence_id.clone();
    let made = apply(
        &mut video,
        "cmd_add",
        vec![
            json!({ "type": "importAsset", "path": path, "ref": "talk" }),
            json!({ "type": "addItem", "sequenceId": s, "asset": { "ref": "talk" }, "alignment": "nearest-frame" }),
            json!({ "type": "addTrack", "sequenceId": s, "kind": "visual", "ref": "g" }),
        ],
    )
    .unwrap();
    let asset = made.receipt.refs["talk"].clone();
    let mut item = shape(&made.receipt.refs["g"], 30, 60, true);
    item["followPolicy"] = json!({ "kind": "follow-cuts" });
    let open = insert(&mut video, "cmd_open", vec![item]);
    assert_eq!(frames_of(&video, &open[0]), (30, 360));
    // Cut source [4, 6): the sequence is 60 frames shorter, the start point that follows the cut does not move (it is before the cut), and the end point is still the sequence end.
    apply(
        &mut video,
        "cmd_cut",
        vec![json!({ "type": "addCuts", "sequenceId": s, "assetId": asset, "cuts": [{ "from": "4", "to": "6" }] })],
    )
    .unwrap();
    assert_eq!(frames_of(&video, &open[0]), (30, 300));
    let body = video
        .document(
            &video.state().documents.values().find(|d| d.kind == "cut-set").unwrap().id.clone(),
            None,
        )
        .unwrap()
        .body;
    let cut_id = body["cuts"][0]["id"].as_str().unwrap().to_string();
    apply(
        &mut video,
        "cmd_restore",
        vec![json!({ "type": "restoreCut", "sequenceId": s, "assetId": asset, "cutId": cut_id })],
    )
    .unwrap();
    assert_eq!(frames_of(&video, &open[0]), (30, 360));
}
