//! Keyframes follow their window (video format spec §3.15): on split, each half keeps the frames within its own window, and sampled values are filled in at the seam; merge is the inverse of split;
//! on trim and ripple delete, `localFrame` is converted by the content's shift, and `percent` is kept as is. The volume envelope follows the same rules.

#![allow(clippy::result_large_err)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use editor_semantics::Rate;
use serde_json::{Value, json};
use video_engine::model::{Actor, ActorKind, AnimationBinding, TimelineItem};
use video_engine::{CreateOptions, ErrorBody, UndoRequest, UndoTarget, Video, VideoTransaction};

fn ffprobe() -> PathBuf {
    PathBuf::from(std::env::var("CUCCUT_FFPROBE").unwrap_or_else(|_| "ffprobe".into()))
}

fn user() -> Actor {
    Actor {
        kind: ActorKind::User,
        id: "user_local".into(),
    }
}

fn new_video(dir: &Path) -> Video {
    let options = CreateOptions {
        name: "测试视频".into(),
        fps: Rate { num: 30, den: 1 },
        width: 1920,
        height: 1080,
    };
    Video::create(dir, &options, &ffprobe()).expect("create the video")
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

fn track(video: &Video, name: &str) -> String {
    video
        .state()
        .tracks
        .values()
        .find(|t| t.value.name.as_deref() == Some(name))
        .map(|t| t.value.id.clone())
        .unwrap()
}

fn seq(video: &Video) -> String {
    video.state().root_sequence_id.clone()
}

fn frames(value: i64) -> Value {
    json!({ "unit": "frames", "value": value })
}

fn bindings(video: &Video, target: &str) -> Vec<AnimationBinding> {
    let s = &video.state().root_sequence_id;
    video.snapshot().sequences[s]
        .header
        .animation_bindings
        .iter()
        .filter(|b| b.target_id == target)
        .cloned()
        .collect()
}

/// `(localFrame or percent, value)`.
fn keys(binding: &AnimationBinding) -> Vec<(f64, f64)> {
    binding
        .keyframes
        .iter()
        .map(|k| (k.local_frame.map_or_else(|| k.percent.unwrap(), |f| f as f64), k.value))
        .collect()
}

fn span(video: &Video, id: &str) -> (i64, i64) {
    let s = video.state().items[id].value.span().unwrap();
    (s.from_frame, s.duration_frames)
}

/// A 90-frame graphic with opacity 0 → 1 (from frame 0 to frame 60), with x written as a percentage.
fn shape_with_keyframes() -> (Video, String, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(&dir.path().join("m"));
    let s = video.state().root_sequence_id.clone();
    let shape = json!({ "type": "shape", "trackId": track(&video, "V1"), "span": { "fromFrame": 0, "durationFrames": 90 },
                        "shape": { "shape": "rect", "fill": "#FFD646" } });
    let committed = apply(
        &mut video,
        "cmd_shape",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": [shape] })],
    )
    .unwrap();
    let id = committed.receipt.created_ids[0].clone();
    apply(
        &mut video,
        "cmd_keys",
        vec![
            json!({ "type": "setKeyframes", "itemId": id, "property": "opacity",
                    "keyframes": [{ "localFrame": 0, "value": 0.0 }, { "localFrame": 60, "value": 1.0 }] }),
            json!({ "type": "setKeyframes", "itemId": id, "property": "x",
                    "keyframes": [{ "percent": 0, "value": 10.0 }, { "percent": 100, "value": 90.0 }] }),
        ],
    )
    .unwrap();
    (video, id, dir)
}

fn opacity(video: &Video, id: &str) -> AnimationBinding {
    bindings(video, id)
        .into_iter()
        .find(|b| b.property_path.as_str() == "opacity")
        .unwrap()
}

fn x(video: &Video, id: &str) -> AnimationBinding {
    bindings(video, id).into_iter().find(|b| b.property_path.as_str() == "x").unwrap()
}

#[test]
fn split_divides_keyframes_and_join_restores_them() {
    let (mut video, id, _dir) = shape_with_keyframes();
    let s = seq(&video);
    let before = bindings(&video, &id);
    let split = apply(
        &mut video,
        "cmd_split",
        vec![json!({ "type": "splitItem", "sequenceId": s, "itemId": id, "at": frames(30), "alignment": "exact-frame" })],
    )
    .unwrap();
    let right = split.receipt.created_ids.iter().find(|c| c.starts_with("item")).unwrap().clone();

    // The left half keeps the binding ID: frame 0 is 0, and the seam (frame 30) gets 0.5 filled in; the right half is a new binding: 0.5 at the seam, 1 at frame 30.
    assert_eq!(keys(&opacity(&video, &id)), vec![(0.0, 0.0), (30.0, 0.5)]);
    assert_eq!(
        opacity(&video, &id).id,
        before.iter().find(|b| b.property_path.as_str() == "opacity").unwrap().id
    );
    assert_eq!(keys(&opacity(&video, &right)), vec![(0.0, 0.5), (30.0, 1.0)]);
    assert!(bindings(&video, &right).iter().all(|b| before.iter().all(|o| o.id != b.id)));
    // Percentage values fold back into each piece's share: the left half 10 → 36.6667 across 0%–100%.
    let left_x = keys(&x(&video, &id));
    assert_eq!((left_x[0], left_x[1].0), ((0.0, 10.0), 100.0));
    assert!((left_x[1].1 - (10.0 + 80.0 / 3.0)).abs() < 1e-9);

    // Merge is the inverse of split: the same run of frames is put back together, the binding ID is unchanged, and the right half is deleted.
    let joined = apply(&mut video, "cmd_join", vec![json!({ "type": "joinItems", "itemIds": [right, id] })]).unwrap();
    assert_eq!(joined.receipt.label, "Join clips");
    assert!(joined.receipt.deleted_ids.contains(&right));
    assert_eq!(span(&video, &id), (0, 90));
    assert_eq!(bindings(&video, &id), before);
    assert!(bindings(&video, &right).is_empty());

    // Undo the merge, then undo the split: back to before the split.
    undo(&mut video, "cmd_undo_join", &joined);
    assert_eq!(keys(&opacity(&video, &right)), vec![(0.0, 0.5), (30.0, 1.0)]);
    undo(&mut video, "cmd_undo_split", &split);
    assert_eq!(bindings(&video, &id), before);
    assert!(!video.state().items.contains_key(&right));
}

#[test]
fn trimming_shifts_local_frames_and_keeps_percent_keys() {
    let (mut video, id, _dir) = shape_with_keyframes();
    let s = seq(&video);
    let x_before = keys(&x(&video, &id));
    // The start is trimmed by 15 frames: frame 0 falls outside the window, and a sampled value of 0.25 is filled in at the new start; frame 60 becomes frame 45.
    apply(
        &mut video,
        "cmd_trim",
        vec![json!({ "type": "trimItem", "sequenceId": s, "itemId": id, "edge": "start", "at": frames(15), "alignment": "exact-frame" })],
    )
    .unwrap();
    assert_eq!(span(&video, &id), (15, 75));
    assert_eq!(keys(&opacity(&video, &id)), vec![(0.0, 0.25), (45.0, 1.0)]);
    assert_eq!(keys(&x(&video, &id)), x_before);

    // The end is trimmed to frame 45 (local frame 30): the later frames are removed, and sampled values are filled in at the new end.
    apply(
        &mut video,
        "cmd_trim_end",
        vec![json!({ "type": "trimItem", "sequenceId": s, "itemId": id, "edge": "end", "at": frames(45), "alignment": "exact-frame" })],
    )
    .unwrap();
    let k = keys(&opacity(&video, &id));
    assert_eq!((k[0], k[1].0), ((0.0, 0.25), 30.0));
    assert!((k[1].1 - 0.75).abs() < 1e-9);
}

#[test]
fn ripple_delete_shortens_static_items_and_rewindows_their_keyframes() {
    let (mut video, id, _dir) = shape_with_keyframes();
    let s = seq(&video);
    let v1 = track(&video, "V1");
    apply(
        &mut video,
        "cmd_ripple",
        vec![json!({ "type": "removeRange", "sequenceId": s, "from": frames(30), "to": frames(60), "trackIds": [v1], "alignment": "exact-frame" })],
    )
    .unwrap();
    // The graphic spans the range: it is only shortened by 30 frames and its start does not move; frame 60 falls beyond the new end, so a sampled value of 1 is filled in at frame 60.
    assert_eq!(span(&video, &id), (0, 60));
    assert_eq!(keys(&opacity(&video, &id)), vec![(0.0, 0.0), (60.0, 1.0)]);
}

#[test]
fn join_refuses_what_a_split_could_not_have_produced() {
    let (mut video, id, _dir) = shape_with_keyframes();
    let s = seq(&video);
    let split = apply(
        &mut video,
        "cmd_split",
        vec![json!({ "type": "splitItem", "sequenceId": s, "itemId": id, "at": frames(30), "alignment": "exact-frame" })],
    )
    .unwrap();
    let right = split.receipt.created_ids.iter().find(|c| c.starts_with("item")).unwrap().clone();
    apply(
        &mut video,
        "cmd_style",
        vec![json!({ "type": "setStyle", "itemId": right, "opacity": 0.5 })],
    )
    .unwrap();
    let before = video.revision();
    let cases = [
        json!({ "type": "joinItems", "itemIds": [id] }),
        json!({ "type": "joinItems", "itemIds": [id, id] }),
        // The fields are inconsistent and there is no keep.
        json!({ "type": "joinItems", "itemIds": [id, right] }),
    ];
    for (n, op) in cases.into_iter().enumerate() {
        let err = apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).unwrap_err();
        assert_eq!(err.code, "INVALID_OPERATION", "case {n}");
    }
    let err = apply(
        &mut video,
        "cmd_bad_keys",
        vec![json!({ "type": "joinItems", "itemIds": [id, right] })],
    )
    .unwrap_err();
    assert_eq!(err.details["keys"], json!(["place"]));
    assert_eq!(video.revision(), before);

    // keep lets one side through: it takes the fields of the second one (the right half), keeping the ID and start of the earlier piece.
    apply(
        &mut video,
        "cmd_keep",
        vec![json!({ "type": "joinItems", "itemIds": [id, right], "keep": "second" })],
    )
    .unwrap();
    assert_eq!(span(&video, &id), (0, 90));
    assert_eq!(video.state().items[&id].value.place().unwrap().opacity, Some(0.5));

    // They do not join end-to-start: after splitting, the right half is moved away.
    let split = apply(
        &mut video,
        "cmd_split2",
        vec![json!({ "type": "splitItem", "sequenceId": s, "itemId": id, "at": frames(30), "alignment": "exact-frame" })],
    )
    .unwrap();
    let right = split.receipt.created_ids.iter().find(|c| c.starts_with("item")).unwrap().clone();
    apply(
        &mut video,
        "cmd_move",
        vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": right, "offset": frames(30), "alignment": "exact-frame" })],
    )
    .unwrap();
    let err = apply(&mut video, "cmd_gap", vec![json!({ "type": "joinItems", "itemIds": [id, right] })]).unwrap_err();
    assert_eq!(err.details["rule"], "not-adjacent");
}

fn has_ffprobe() -> bool {
    let ok = Command::new(ffprobe()).arg("-version").output().is_ok_and(|o| o.status.success());
    if !ok {
        eprintln!("skipping: no usable ffprobe");
    }
    ok
}

/// A silent 8 kHz mono 16-bit wav.
fn write_wav(path: &Path, seconds: u32) {
    let samples = 8000 * seconds;
    let data_len = samples * 2;
    let mut bytes = Vec::new();
    bytes.extend(b"RIFF");
    bytes.extend((36 + data_len).to_le_bytes());
    bytes.extend(b"WAVEfmt ");
    bytes.extend(16u32.to_le_bytes());
    bytes.extend(1u16.to_le_bytes());
    bytes.extend(1u16.to_le_bytes());
    bytes.extend(8000u32.to_le_bytes());
    bytes.extend(16000u32.to_le_bytes());
    bytes.extend(2u16.to_le_bytes());
    bytes.extend(16u16.to_le_bytes());
    bytes.extend(b"data");
    bytes.extend(data_len.to_le_bytes());
    bytes.resize(bytes.len() + data_len as usize, 0);
    fs::write(path, bytes).unwrap();
}

#[test]
fn audio_envelopes_split_and_join_like_keyframes() {
    if !has_ffprobe() {
        return;
    }
    let root = tempfile::tempdir().unwrap();
    let wav = root.path().join("vo.wav");
    write_wav(&wav, 2);
    let mut video = new_video(&root.path().join("m"));
    let s = video.state().root_sequence_id.clone();
    let imported = apply(
        &mut video,
        "cmd_link",
        vec![json!({ "type": "importAsset", "path": wav, "storage": "linked", "ref": "vo" })],
    )
    .unwrap();
    let asset_id = imported.receipt.refs["vo"].clone();
    let audio = json!({
        "type": "audio", "trackId": track(&video, "A1"), "assetRef": { "id": asset_id, "revision": "1" },
        "fromFrame": 0, "subframeOffset": { "ticks": "0", "timescale": 1 }, "playDuration": { "ticks": "2", "timescale": 1 },
        "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
        "mix": { "volume": 1.0, "envelope": [
            { "at": { "ticks": "0", "timescale": 1 }, "volume": 1.0 },
            { "at": { "ticks": "2", "timescale": 1 }, "volume": 0.0 } ] },
    });
    let inserted = apply(
        &mut video,
        "cmd_audio",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": [audio] })],
    )
    .unwrap();
    let id = inserted.receipt.created_ids[0].clone();
    let envelope = |video: &Video, id: &str| -> Vec<(f64, f64)> {
        let TimelineItem::Audio(a) = &video.state().items[id].value else {
            panic!("expected audio")
        };
        a.mix
            .envelope
            .iter()
            .map(|p| {
                let at = p.at.as_ref().unwrap().to_ratio("at").unwrap().to_f64();
                (at, p.volume)
            })
            .collect()
    };
    let before = envelope(&video, &id);
    // The audio is split at exact time: at 0.5 seconds.
    let split = apply(&mut video, "cmd_split", vec![json!({ "type": "splitItem", "sequenceId": s, "itemId": id, "at": { "unit": "seconds", "value": "0.5" }, "alignment": "exact-frame" })]).unwrap();
    let right = split.receipt.created_ids.iter().find(|c| c.starts_with("item")).unwrap().clone();
    assert_eq!(envelope(&video, &id), vec![(0.0, 1.0), (0.5, 0.75)]);
    assert_eq!(envelope(&video, &right), vec![(0.0, 0.75), (1.5, 0.0)]);
    apply(&mut video, "cmd_join", vec![json!({ "type": "joinItems", "itemIds": [id, right] })]).unwrap();
    assert_eq!(envelope(&video, &id), before);
}
