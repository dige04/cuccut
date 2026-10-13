//! Acceptance tests for the video engine: transactions, idempotency, the write lock, and undo and editing semantics.
//! Tests that need media generate the assets with ffmpeg on the spot; without ffmpeg they are skipped and the reason is printed.

#![allow(clippy::result_large_err)]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

use editor_semantics::Rate;
use serde_json::{Value, json};
use tempfile::TempDir;
use video_engine::model::{Actor, ActorKind, Background, Fit, TimelineItem, VisualMode};
use video_engine::video::payload_hash;
use video_engine::{CreateOptions, ErrorBody, OpenMode, UndoRequest, UndoTarget, Video, VideoTransaction};

fn ffprobe() -> PathBuf {
    PathBuf::from(std::env::var("CUCCUT_FFPROBE").unwrap_or_else(|_| "ffprobe".into()))
}

struct Fixtures {
    _dir: TempDir,
    video_file: PathBuf,
    audio: PathBuf,
}

/// A 2-second, 30 fps video (with sound) and a 1.5-second wav.
fn fixtures() -> Option<&'static Fixtures> {
    static FIXTURES: OnceLock<Option<Fixtures>> = OnceLock::new();
    FIXTURES
        .get_or_init(|| {
            let dir = tempfile::tempdir().ok()?;
            let video = dir.path().join("clip.mp4");
            let audio = dir.path().join("tone.wav");
            let ok = |args: &[&str]| {
                Command::new("ffmpeg")
                    .args(args)
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false)
            };
            let video_ok = ok(&[
                "-v",
                "error",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=size=320x180:rate=30:duration=2",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=2",
                "-c:v",
                "mpeg4",
                "-c:a",
                "aac",
                "-shortest",
                video.to_str()?,
            ]);
            let audio_ok = ok(&[
                "-v",
                "error",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=1.5",
                "-c:a",
                "pcm_s16le",
                audio.to_str()?,
            ]);
            if !(video_ok && audio_ok) {
                eprintln!("skipping: no usable ffmpeg to generate test media");
                return None;
            }
            Some(Fixtures {
                _dir: dir,
                video_file: video,
                audio,
            })
        })
        .as_ref()
}

fn user() -> Actor {
    Actor {
        kind: ActorKind::User,
        id: "user_local".into(),
    }
}

fn agent() -> Actor {
    Actor {
        kind: ActorKind::Agent,
        id: "agent_codex".into(),
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

fn tx(video: &Video, command_id: &str, operations: Vec<Value>) -> VideoTransaction {
    VideoTransaction {
        command_id: command_id.into(),
        expected_revision: video.revision(),
        label: None,
        label_ref: None,
        operations,
        actor: user(),
        task_id: None,
    }
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

fn item_ids(video: &Video) -> Vec<String> {
    let snapshot = video.snapshot();
    snapshot.sequences[&snapshot.root_sequence_id]
        .items
        .iter()
        .map(|i| i.base().id.clone())
        .collect()
}

fn span_of(video: &Video, id: &str) -> (i64, i64) {
    let span = video.state().items[id].value.span().expect("audio has no frame range");
    (span.from_frame, span.duration_frames)
}

fn err_code(result: Result<impl std::fmt::Debug, ErrorBody>) -> String {
    result.expect_err("should fail").code
}

/// Imports a video and places `count` instances in turn on V1 (each 60 frames long).
fn import_video(video: &mut Video, fixtures: &Fixtures, count: usize) -> Vec<String> {
    let mut ops = vec![json!({ "type": "importAsset", "path": fixtures.video_file, "ref": "clip" })];
    for _ in 0..count {
        ops.push(json!({ "type": "addItem", "sequenceId": seq(video), "asset": { "ref": "clip" }, "alignment": "nearest-frame" }));
    }
    let committed = video.apply(&tx(video, "cmd_import", ops)).expect("import and add");
    assert!(committed.event.is_some());
    item_ids(video)
}

#[test]
fn created_video_reopens_with_the_same_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let snapshot = video.snapshot();
    assert_eq!(snapshot.revision, "0");
    assert_eq!(snapshot.sequences.len(), 1);
    assert_eq!(snapshot.sequences[&snapshot.root_sequence_id].tracks.len(), 2);

    video
        .apply(&tx(
            &video,
            "cmd_rename",
            vec![json!({ "type": "renameVideo", "name": "新的名字" })],
        ))
        .unwrap();
    video
        .apply(&tx(
            &video,
            "cmd_track",
            vec![json!({ "type": "addTrack", "sequenceId": seq(&video), "kind": "visual" })],
        ))
        .unwrap();
    let before = video.snapshot();
    drop(video);

    let reopened = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    assert_eq!(reopened.snapshot(), before);
    assert_eq!(before.name, "新的名字");
    assert_eq!(before.revision, "2");
    assert_eq!(reopened.event_seq(), 2);
}

#[test]
fn default_root_sequence_name_carries_a_message_ref_until_renamed() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let s = seq(&video);
    let header = |video: &Video| video.snapshot().sequences[&s].header.clone();
    // The default name is stored in English with a reference; the UI displays it in the reader's language (video format spec §3.2).
    let created = header(&video);
    assert_eq!(created.name, "Main sequence");
    assert_eq!(created.name_ref.as_ref().map(|r| r.key.as_str()), Some("engine.mainSequence"));

    // Only the canvas changed and the name did not: it is still the default name.
    video
        .apply(&tx(
            &video,
            "cmd_background",
            vec![json!({ "type": "updateSequence", "sequenceId": s, "background": "#112233" })],
        ))
        .unwrap();
    assert_eq!(header(&video).name_ref, created.name_ref);

    // Renamed: the user's name is displayed as is, the reference is dropped, the exchange form has no nameRef; the same after reopening.
    let renamed = video
        .apply(&tx(
            &video,
            "cmd_sequence_name",
            vec![json!({ "type": "updateSequence", "sequenceId": s, "name": "Vertical cut" })],
        ))
        .unwrap();
    assert_eq!((header(&video).name, header(&video).name_ref), ("Vertical cut".to_string(), None));
    assert!(
        serde_json::to_value(&video.snapshot().sequences[&s])
            .unwrap()
            .get("nameRef")
            .is_none()
    );
    drop(video);
    let mut reopened = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    assert_eq!(header(&reopened).name_ref, None);

    // Undo the rename: the default name and its reference come back together.
    reopened
        .undo(&UndoRequest {
            command_id: "cmd_undo_name".into(),
            target: UndoTarget::Transaction(renamed.receipt.transaction_id.clone()),
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
    assert_eq!(
        (header(&reopened).name, header(&reopened).name_ref),
        (created.name, created.name_ref)
    );
}

#[test]
fn sequence_header_without_name_ref_round_trips_unchanged() {
    // Sequences written before nameRef existed: no reference on read, the engine does not add one, and writing back matches the original (undo compares as is).
    let stored = json!({
        "name": "主序列",
        "fps": { "num": 30, "den": 1 },
        "canvas": { "width": 1920, "height": 1080, "workingSpace": "srgb", "background": "#000000" },
        "durationPolicy": { "kind": "derived" },
        "animationBindings": [],
    });
    let header: video_engine::model::SequenceHeader = serde_json::from_value(stored.clone()).unwrap();
    assert_eq!(header.name_ref, None);
    assert_eq!(serde_json::to_value(&header).unwrap(), stored);
}

fn ref_json(message_ref: &impl serde::Serialize) -> Value {
    serde_json::to_value(message_ref).unwrap()
}

#[test]
fn default_labels_are_english_with_a_message_ref_and_caller_labels_stay_as_given() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());

    // An engine-generated change name: English with a reference; the UI regenerates it in the reader's language (command and protocol spec §3.1).
    let renamed = video
        .apply(&tx(&video, "cmd_rename", vec![json!({ "type": "renameVideo", "name": "一" })]))
        .unwrap();
    assert_eq!(renamed.receipt.label, "Rename video");
    assert_eq!(ref_json(&renamed.receipt.label_ref), json!({ "key": "engine.labelRenameVideo" }));
    let event = renamed.event.unwrap();
    assert_eq!(
        (event.label.as_str(), &event.label_ref),
        ("Rename video", &renamed.receipt.label_ref)
    );

    // Several changes: the main change name is a nested parameter, and the count covers all operations.
    let mixed = video
        .apply(&tx(
            &video,
            "cmd_mixed",
            vec![
                json!({ "type": "renameVideo", "name": "二" }),
                json!({ "type": "addTrack", "sequenceId": seq(&video), "kind": "audio" }),
            ],
        ))
        .unwrap();
    assert_eq!(mixed.receipt.label, "Rename video and more (2 changes)");
    assert_eq!(
        ref_json(&mixed.receipt.label_ref),
        json!({
            "key": "engine.labelMoreChanges",
            "params": { "main": { "key": "engine.labelRenameVideo", "text": "Rename video" }, "count": 2 }
        })
    );

    // The caller's change name is stored as given (leading and trailing whitespace removed); with no reference given, there is no reference.
    let mut named = tx(&video, "cmd_named", vec![json!({ "type": "renameVideo", "name": "三" })]);
    named.label = Some("  整理标题  ".into());
    let named = video.apply(&named).unwrap();
    assert_eq!((named.receipt.label.as_str(), &named.receipt.label_ref), ("整理标题", &None));
    assert!(serde_json::to_value(&named.receipt).unwrap().get("labelRef").is_none());

    // History and replayed events carry the same reference.
    let history = video.history(10).unwrap();
    assert_eq!(history[0].label_ref, None);
    assert_eq!(history[1].label_ref, mixed.receipt.label_ref);
    let events = video.events_after(0, 10).unwrap();
    assert_eq!(events[0].label_ref, renamed.receipt.label_ref);

    // “Import and add” counts as one add.
    if let Some(fixtures) = fixtures() {
        let ops = vec![
            json!({ "type": "importAsset", "path": fixtures.video_file, "ref": "clip" }),
            json!({ "type": "addItem", "sequenceId": seq(&video), "asset": { "ref": "clip" }, "alignment": "nearest-frame" }),
            json!({ "type": "addItem", "sequenceId": seq(&video), "asset": { "ref": "clip" }, "alignment": "nearest-frame" }),
        ];
        let added = video.apply(&tx(&video, "cmd_import_add", ops)).unwrap();
        assert_eq!(added.receipt.label, "Add clip");
        assert_eq!(ref_json(&added.receipt.label_ref), json!({ "key": "engine.labelAddClip" }));
    }
}

#[test]
fn undo_and_redo_labels_wrap_the_original_label() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let step = |video: &mut Video, id: &str, target: UndoTarget| {
        video
            .undo(&UndoRequest {
                command_id: id.into(),
                target,
                expected_revision: None,
                actor: user(),
            })
            .unwrap()
    };
    let rename_ref = json!({ "key": "engine.labelRenameVideo", "text": "Rename video" });

    video
        .apply(&tx(&video, "cmd_rename", vec![json!({ "type": "renameVideo", "name": "一" })]))
        .unwrap();
    let undone = step(&mut video, "cmd_undo", UndoTarget::Undo);
    assert_eq!(undone.receipt.label, "Undo: Rename video");
    assert_eq!(
        ref_json(&undone.receipt.label_ref),
        json!({ "key": "engine.labelUndo", "params": { "label": rename_ref } })
    );
    // A step on the undo stack uses the forward change name, and the reference goes with it.
    let redo = video.undo_state(&user()).unwrap().redo.unwrap();
    assert_eq!(
        (redo.label.as_str(), ref_json(&redo.label_ref)),
        ("Rename video", json!({ "key": "engine.labelRenameVideo" }))
    );
    let redone = step(&mut video, "cmd_redo", UndoTarget::Redo);
    assert_eq!(redone.receipt.label, "Redo: Rename video");
    assert_eq!(
        ref_json(&redone.receipt.label_ref),
        json!({ "key": "engine.labelRedo", "params": { "label": rename_ref } })
    );

    // A change name given by the caller with no reference is displayed as given, as a string parameter.
    let mut named = tx(&video, "cmd_named", vec![json!({ "type": "renameVideo", "name": "二" })]);
    named.label = Some("整理标题".into());
    video.apply(&named).unwrap();
    let undone_named = step(&mut video, "cmd_undo_named", UndoTarget::Undo);
    assert_eq!(undone_named.receipt.label, "Undo: 整理标题");
    assert_eq!(
        ref_json(&undone_named.receipt.label_ref),
        json!({ "key": "engine.labelUndo", "params": { "label": "整理标题" } })
    );

    // After reopening, the references in the history and undo stack are still there.
    drop(video);
    let reopened = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    let history = reopened.history(10).unwrap();
    assert_eq!(history[0].label_ref, undone_named.receipt.label_ref);
    assert_eq!(history[2].label_ref, redone.receipt.label_ref);
    let undo = reopened.undo_state(&user()).unwrap().undo.unwrap();
    assert_eq!(
        (undo.label.as_str(), ref_json(&undo.label_ref)),
        ("Rename video", json!({ "key": "engine.labelRenameVideo" }))
    );
}

#[test]
fn caller_labels_keep_the_ref_they_came_with() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let caller_ref = json!({ "key": "editLabel.moveClips", "params": { "count": 2 } });

    // A change name given by the caller carries a reference: the text and the reference are stored as given; the engine does not recognize this key (command and protocol spec §3.1).
    let mut named = tx(&video, "cmd_named", vec![json!({ "type": "renameVideo", "name": "一" })]);
    named.label = Some(" Move 2 clips ".into());
    named.label_ref = serde_json::from_value(caller_ref.clone()).unwrap();
    let applied = video.apply(&named).unwrap();
    assert_eq!(
        (applied.receipt.label.as_str(), ref_json(&applied.receipt.label_ref)),
        ("Move 2 clips", caller_ref.clone())
    );
    assert_eq!(applied.event.unwrap().label_ref, applied.receipt.label_ref);
    let undo = video.undo_state(&user()).unwrap().undo.unwrap();
    assert_eq!(ref_json(&undo.label_ref), caller_ref);

    // Undo passes it as a nested parameter, together with the text at that time (used when the reader does not recognize the key).
    let undone = video
        .undo(&UndoRequest {
            command_id: "cmd_undo".into(),
            target: UndoTarget::Undo,
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
    assert_eq!(undone.receipt.label, "Undo: Move 2 clips");
    assert_eq!(
        ref_json(&undone.receipt.label_ref),
        json!({
            "key": "engine.labelUndo",
            "params": { "label": { "key": "editLabel.moveClips", "params": { "count": 2 }, "text": "Move 2 clips" } }
        })
    );

    // Only a reference and no text: the caller is not considered to have given a name, so the engine names it as usual.
    let mut ref_only = tx(&video, "cmd_ref_only", vec![json!({ "type": "renameVideo", "name": "二" })]);
    ref_only.label = Some("  ".into());
    ref_only.label_ref = serde_json::from_value(caller_ref.clone()).unwrap();
    let ref_only = video.apply(&ref_only).unwrap();
    assert_eq!(
        (ref_only.receipt.label.as_str(), ref_json(&ref_only.receipt.label_ref)),
        ("Rename video", json!({ "key": "engine.labelRenameVideo" }))
    );

    // After reopening, the history still holds the caller's reference.
    drop(video);
    let reopened = Video::open(dir.path(), OpenMode::ReadOnly, &ffprobe()).unwrap();
    let history = reopened.history(10).unwrap();
    assert_eq!(ref_json(&history[2].label_ref), caller_ref);
    assert_eq!(history[1].label_ref, undone.receipt.label_ref);
}

#[test]
fn transactions_without_label_ref_columns_read_as_stored_text() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    video
        .apply(&tx(&video, "cmd_rename", vec![json!({ "type": "renameVideo", "name": "一" })]))
        .unwrap();
    drop(video);
    // A library from before the reference columns were added: without those two columns, the change name is the text written at the time (in Chinese).
    {
        let conn = rusqlite::Connection::open(dir.path().join("video.db")).unwrap();
        conn.execute_batch(
            "ALTER TABLE transactions DROP COLUMN label_ref;
             ALTER TABLE transactions DROP COLUMN base_label_ref;
             UPDATE transactions SET label = '重命名视频', base_label = '重命名视频';",
        )
        .unwrap();
    }

    // A read-only open does not modify the library: it reads the stored text as is, with no reference.
    let read_only = Video::open(dir.path(), OpenMode::ReadOnly, &ffprobe()).unwrap();
    let history = read_only.history(10).unwrap();
    assert_eq!((history[0].label.as_str(), &history[0].label_ref), ("重命名视频", &None));
    let undo = read_only.undo_state(&user()).unwrap().undo.unwrap();
    assert_eq!((undo.label.as_str(), &undo.label_ref), ("重命名视频", &None));
    drop(read_only);

    // A writable open adds the two columns; when an old change is undone, the old name is passed as a string parameter.
    let mut video = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    let undone = video
        .undo(&UndoRequest {
            command_id: "cmd_undo".into(),
            target: UndoTarget::Undo,
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
    assert_eq!(undone.receipt.label, "Undo: 重命名视频");
    assert_eq!(
        serde_json::to_value(&undone.receipt.label_ref).unwrap(),
        json!({ "key": "engine.labelUndo", "params": { "label": "重命名视频" } })
    );
    let history = video.history(10).unwrap();
    assert_eq!(history[0].label_ref, undone.receipt.label_ref);
    assert_eq!(history[1].label_ref, None);
}

#[test]
fn c03_second_writer_is_rejected_and_read_only_cannot_write() {
    let dir = tempfile::tempdir().unwrap();
    let video = new_video(dir.path());

    let second = Video::open(dir.path(), OpenMode::Write, &ffprobe());
    let err = second.err().expect("the second writer was rejected");
    assert_eq!(err.code, "VIDEO_LOCKED");
    assert_eq!(err.details["holder"]["pid"], json!(std::process::id()));

    let mut reader = Video::open(dir.path(), OpenMode::ReadOnly, &ffprobe()).unwrap();
    assert_eq!(reader.snapshot(), video.snapshot());
    let rename = tx(&reader, "cmd_ro", vec![json!({ "type": "renameVideo", "name": "x" })]);
    assert_eq!(err_code(reader.apply(&rename)), "VIDEO_READ_ONLY");

    // After release, the write lock can be taken again, and the owner generation is incremented.
    drop(video);
    Video::open(dir.path(), OpenMode::Write, &ffprobe()).expect("the lock was released");
}

/// The video is closed while another thread is spawning child processes, and the write lock can be taken again right away: the lock file descriptors copied when the child processes started do not hold the lock.
#[cfg(unix)]
#[test]
fn closing_releases_the_lock_while_other_threads_spawn_children() {
    let dir = tempfile::tempdir().unwrap();
    let stop = Arc::new(AtomicBool::new(false));
    let spawners: Vec<_> = (0..4)
        .map(|_| {
            let stop = stop.clone();
            std::thread::spawn(move || {
                while !stop.load(Ordering::Relaxed) {
                    let _ = Command::new("true").status();
                }
            })
        })
        .collect();

    let mut video = Some(new_video(dir.path()));
    let mut failure = None;
    for round in 0..200 {
        drop(video.take());
        match Video::open(dir.path(), OpenMode::Write, &ffprobe()) {
            Ok(reopened) => video = Some(reopened),
            Err(err) => {
                failure = Some((round, err));
                break;
            }
        }
    }
    stop.store(true, Ordering::Relaxed);
    for spawner in spawners {
        spawner.join().unwrap();
    }
    assert!(failure.is_none(), "reopening after closing was rejected: {failure:?}");
}

#[test]
fn stale_owner_cannot_commit_after_the_lock_moves() {
    let dir = tempfile::tempdir().unwrap();
    let video = new_video(dir.path());
    drop(video);
    let mut first = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    // Simulates the lock being legitimately taken by another party (for example, after the old host was judged unreachable): the owner generation is incremented directly.
    {
        let conn = rusqlite::Connection::open(dir.path().join("video.db")).unwrap();
        conn.execute("UPDATE videos SET owner_generation = owner_generation + 1", [])
            .unwrap();
    }
    let rename = tx(&first, "cmd_stale", vec![json!({ "type": "renameVideo", "name": "旧主人" })]);
    assert_eq!(err_code(first.apply(&rename)), "PROJECT_WRITER_UNAVAILABLE");
    assert_eq!(first.revision(), "0", "a failed commit does not change the working state");
}

#[test]
fn t06_a03_retry_returns_the_same_receipt_without_duplicating() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ops = vec![
        json!({ "type": "importAsset", "path": fixtures.video_file, "ref": "clip" }),
        json!({ "type": "addItem", "sequenceId": seq(&video), "asset": { "ref": "clip" }, "alignment": "nearest-frame" }),
    ];
    let request = tx(&video, "cmd_retry", ops);
    let first = video.apply(&request).unwrap();
    let again = video.apply(&request).unwrap();
    assert_eq!(again.receipt, first.receipt);
    assert!(again.event.is_none(), "replay produces no new event");
    assert_eq!(item_ids(&video).len(), 1);
    assert_eq!(video.state().assets.len(), 1);
    assert_eq!(video.revision(), "1");
}

#[test]
fn c05_same_key_with_another_payload_is_rejected_and_outbox_survives() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let request = tx(&video, "cmd_c05", vec![json!({ "type": "renameVideo", "name": "第一版" })]);
    let committed = video.apply(&request).unwrap();
    let event = committed.event.unwrap();

    let mut changed = request.clone();
    changed.operations = vec![json!({ "type": "renameVideo", "name": "第二版" })];
    assert_eq!(err_code(video.apply(&changed)), "IDEMPOTENCY_CONFLICT");
    assert_eq!(video.state().name, "第一版");

    // A broadcast was lost: the same event is re-sent from the durable outbox, with its sequence number and content unchanged.
    drop(video);
    let reopened = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    let events = reopened.events_after(0, 100).unwrap();
    assert_eq!(events, vec![event]);
    assert!(reopened.events_after(1, 100).unwrap().is_empty());
}

#[test]
fn c01_receipt_is_found_by_command_id_after_restart() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let committed = video
        .apply(&tx(&video, "cmd_c01", vec![json!({ "type": "renameVideo", "name": "崩溃前" })]))
        .unwrap();
    drop(video);
    let reopened = Video::open(dir.path(), OpenMode::Write, &ffprobe()).unwrap();
    assert_eq!(reopened.find_receipt("cmd_c01").unwrap(), Some(committed.receipt));
    assert_eq!(reopened.find_receipt("cmd_unknown").unwrap(), None);
}

#[test]
fn t07_stale_revision_is_an_explicit_conflict() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let stale = tx(&video, "cmd_agent", vec![json!({ "type": "renameVideo", "name": "智能体的标题" })]);
    video
        .apply(&tx(
            &video,
            "cmd_user",
            vec![json!({ "type": "renameVideo", "name": "用户的标题" })],
        ))
        .unwrap();
    let err = video.apply(&stale).expect_err("a change on an old version is rejected");
    assert_eq!(err.code, "PROJECT_REVISION_CONFLICT");
    assert_eq!(video.state().name, "用户的标题");
}

#[test]
fn failed_operation_leaves_the_video_untouched() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ops = vec![
        json!({ "type": "renameVideo", "name": "不应生效" }),
        json!({ "type": "deleteItems", "sequenceId": seq(&video), "itemIds": ["item_missing"] }),
    ];
    let err = video.apply(&tx(&video, "cmd_atomic", ops)).expect_err("the second operation fails");
    assert_eq!(err.code, "ENTITY_NOT_FOUND");
    assert_eq!(err.details["operationIndex"], json!(1));
    assert_eq!(video.state().name, "测试视频");
    assert_eq!(video.revision(), "0");
    assert_eq!(video.find_receipt("cmd_atomic").unwrap(), None);
}

#[test]
fn unknown_fields_and_missing_sequence_are_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let bad = vec![json!({ "type": "renameVideo", "name": "x", "patch": {} })];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_bad", bad))), "INVALID_OPERATION");
    // TM04: the frame rate is not guessed when the frame input has no sequence.
    let no_seq =
        vec![json!({ "type": "moveItem", "itemId": "item_x", "at": { "unit": "frames", "value": 3 }, "alignment": "exact-frame" })];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_noseq", no_seq))), "TIME_DOMAIN_MISMATCH");
    let float = vec![
        json!({ "type": "moveItem", "sequenceId": seq(&video), "itemId": "item_x", "at": { "unit": "seconds", "value": 1.5 }, "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_float", float))), "INVALID_TIME_VALUE");
}

#[test]
fn tm01_seconds_and_frames_resolve_to_the_same_frame() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let s = seq(&video);
    let by_seconds = video
        .apply(&tx(&video, "cmd_sec", vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "seconds", "value": "12.5" }, "alignment": "exact-frame" })]))
        .unwrap();
    assert_eq!(span_of(&video, &ids[0]).0, 375);
    let receipt = &by_seconds.receipt.time_resolution[0];
    assert_eq!(receipt.actual_frame, 375);
    let by_frames = video
        .apply(&tx(&video, "cmd_frame", vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "frames", "value": 375 }, "alignment": "exact-frame" })]))
        .unwrap();
    assert_eq!(by_frames.receipt.time_resolution[0].actual_time, receipt.actual_time);
    // Same position: the second transaction did not change any entity.
    assert!(by_frames.receipt.updated_ids.is_empty());
    assert!(!by_frames.receipt.undo.available);
}

#[test]
fn t05_editing_one_instance_preserves_the_others() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 3);
    assert_eq!(ids.len(), 3);
    assert_eq!(video.state().assets.len(), 1, "three items share one asset");
    assert_eq!(
        (span_of(&video, &ids[0]), span_of(&video, &ids[1]), span_of(&video, &ids[2])),
        ((0, 60), (60, 60), (120, 60))
    );
    let before_first = video.state().items[&ids[0]].clone();
    let before_third = video.state().items[&ids[2]].clone();

    let trim = vec![
        json!({ "type": "trimItem", "sequenceId": seq(&video), "itemId": ids[1], "edge": "end", "at": { "unit": "frames", "value": 90 }, "alignment": "exact-frame" }),
    ];
    let committed = video.apply(&tx(&video, "cmd_t05", trim)).unwrap();
    assert_eq!(committed.receipt.updated_ids, vec![ids[1].clone()]);
    assert_eq!(committed.receipt.preserved, {
        let mut p = vec![ids[0].clone(), ids[2].clone()];
        p.sort();
        p
    });
    assert_eq!(video.state().items[&ids[0]], before_first);
    assert_eq!(video.state().items[&ids[2]], before_third);
    assert_eq!(span_of(&video, &ids[1]), (60, 30));
    assert_eq!(committed.receipt.impact.new_duration_frames, 180);
}

#[test]
fn split_keeps_the_left_id_and_maps_the_right_source_exactly() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let split = vec![
        json!({ "type": "splitItem", "sequenceId": seq(&video), "itemId": ids[0], "at": { "unit": "seconds", "value": "0.5" }, "alignment": "exact-frame" }),
    ];
    let committed = video.apply(&tx(&video, "cmd_split", split)).unwrap();
    let right = committed.receipt.created_ids[0].clone();
    assert_eq!(committed.receipt.lineage[&ids[0]], vec![ids[0].clone(), right.clone()]);
    assert_eq!((span_of(&video, &ids[0]), span_of(&video, &right)), ((0, 15), (15, 45)));
    let TimelineItem::Video(r) = &video.state().items[&right].value else {
        panic!()
    };
    let editor_semantics::TimeMap::Linear { source_in, .. } = &r.time_map else {
        panic!()
    };
    assert_eq!((source_in.ticks.as_str(), source_in.timescale), ("1", 2));
    assert_eq!(r.base.lineage.as_ref().unwrap().origin_item_id, ids[0]);

    // Undo the split: the right segment is deleted, and the left segment is restored to its original length.
    let undone = video
        .undo(&UndoRequest {
            command_id: "cmd_undo_split".into(),
            target: UndoTarget::Transaction(committed.receipt.transaction_id.clone()),
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
    assert_eq!(undone.receipt.deleted_ids, vec![right]);
    assert_eq!(item_ids(&video), ids);
    assert_eq!(span_of(&video, &ids[0]), (0, 60));
}

#[test]
fn caption_scope_follows_split_and_delete() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let s = seq(&video);
    let setup = vec![
        json!({ "type": "addTrack", "sequenceId": s, "kind": "subtitle", "ref": "subs" }),
        json!({ "type": "putDocument", "ref": "cues", "kind": "caption", "body": { "schema": "cuccut.caption/1", "clock": "source-asset", "cues": [] } }),
        json!({ "type": "insertItems", "sequenceId": s, "items": [
            { "type": "caption", "trackRef": "subs", "span": { "fromFrame": 0, "durationFrames": 60 }, "documentRef": "cues", "scopeItemIds": [ids[0]] },
        ] }),
    ];
    video.apply(&tx(&video, "cmd_caption", setup)).unwrap();
    let caption = item_ids(&video).into_iter().find(|id| id != &ids[0]).unwrap();
    let scope = |video: &Video| -> Vec<String> {
        let TimelineItem::Caption(c) = &video.state().items[&caption].value else {
            panic!()
        };
        c.scope_item_ids.clone()
    };

    // Split: the right half follows the original instance into the acting instance, and subtitles past the split point still project through it.
    let split = vec![
        json!({ "type": "splitItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "frames", "value": 30 }, "alignment": "exact-frame" }),
    ];
    let committed = video.apply(&tx(&video, "cmd_split", split)).unwrap();
    let right = committed.receipt.created_ids[0].clone();
    assert_eq!(scope(&video), vec![ids[0].clone(), right.clone()]);
    assert!(committed.receipt.updated_ids.contains(&caption));

    // Delete one half: it is removed from the acting instance; when the last one is deleted, it is kept as is (emptying it would be the same as switching to the sequence clock).
    video
        .apply(&tx(
            &video,
            "cmd_delete_right",
            vec![json!({ "type": "deleteItems", "itemIds": [right] })],
        ))
        .unwrap();
    assert_eq!(scope(&video), vec![ids[0].clone()]);
    video
        .apply(&tx(
            &video,
            "cmd_delete_left",
            vec![json!({ "type": "deleteItems", "itemIds": [ids[0]] })],
        ))
        .unwrap();
    assert_eq!(scope(&video), vec![ids[0].clone()]);

    // Undo all the steps before the split: the acting instance returns to what it was before the split.
    for command in ["cmd_undo_left", "cmd_undo_right"] {
        video
            .undo(&UndoRequest {
                command_id: command.into(),
                target: UndoTarget::Undo,
                expected_revision: None,
                actor: user(),
            })
            .unwrap();
    }
    assert_eq!(scope(&video), vec![ids[0].clone(), right.clone()]);
    video
        .undo(&UndoRequest {
            command_id: "cmd_undo_split".into(),
            target: UndoTarget::Transaction(committed.receipt.transaction_id.clone()),
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
    assert_eq!(scope(&video), vec![ids[0].clone()]);
}

/// The instance's `timeMap.sourceIn` (in seconds) in JSON.
fn source_in_seconds(video: &Video, id: &str) -> f64 {
    let value = serde_json::to_value(&video.state().items[id].value).unwrap();
    let source_in = &value["timeMap"]["sourceIn"];
    let ticks: f64 = source_in["ticks"].as_str().unwrap().parse().unwrap();
    ticks / source_in["timescale"].as_f64().unwrap()
}

/// The start and length (in seconds) of an audio instance.
fn audio_range(video: &Video, id: &str) -> (f64, f64) {
    let TimelineItem::Audio(audio) = &video.state().items[id].value else {
        panic!("not audio")
    };
    let offset = audio.subframe_offset.to_ratio("t").unwrap().to_f64();
    (
        audio.from_frame as f64 / 30.0 + offset,
        audio.play_duration.to_ratio("t").unwrap().to_f64(),
    )
}

#[test]
fn remove_range_ripples_the_declared_tracks_and_captions_follow() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    // V1: A [0, 60), B [60, 120); A1: audio 0.25–1.75 seconds; V2: text [0, 120); subtitles [0, 120) projected through A and B.
    let ids = import_video(&mut video, fixtures, 2);
    let (a, b) = (ids[0].clone(), ids[1].clone());
    let s = seq(&video);
    let setup = vec![
        json!({ "type": "importAsset", "path": fixtures.audio, "ref": "tone" }),
        json!({ "type": "addItem", "sequenceId": s, "asset": { "ref": "tone" }, "at": { "unit": "seconds", "value": "0.25" }, "alignment": "exact-frame" }),
        json!({ "type": "addTrack", "sequenceId": s, "kind": "visual", "ref": "v2" }),
        json!({ "type": "addTrack", "sequenceId": s, "kind": "subtitle", "ref": "subs" }),
        json!({ "type": "putDocument", "ref": "cues", "kind": "caption", "body": { "schema": "cuccut.caption/1", "clock": "source-asset", "cues": [] } }),
        json!({ "type": "insertItems", "sequenceId": s, "items": [
            { "type": "text", "trackRef": "v2", "span": { "fromFrame": 0, "durationFrames": 120 },
              "place": { "x": 50, "y": 50, "w": 40 }, "text": "标题", "style": {} },
            { "type": "caption", "trackRef": "subs", "span": { "fromFrame": 0, "durationFrames": 120 }, "documentRef": "cues", "scopeItemIds": [a, b] },
        ] }),
    ];
    video.apply(&tx(&video, "cmd_setup", setup)).unwrap();
    let find = |video: &Video, kind: &str| -> String {
        video
            .state()
            .items
            .values()
            .find(|p| serde_json::to_value(&p.value).unwrap()["type"] == kind)
            .map(|p| p.value.base().id.clone())
            .unwrap()
    };
    let (tone, text, caption) = (find(&video, "audio"), find(&video, "text"), find(&video, "caption"));
    let subs = video.state().items[&caption].value.base().track_id.clone();
    let declared = json!([track(&video, "V1"), track(&video, "A1"), subs]);

    // Delete frames [20, 40): A is split, the middle is deleted, and the right segment moves forward; B moves forward; the audio is likewise split and moved forward; the subtitles are shortened, and the acting instance adds A's right segment; the text does not move.
    let cut = vec![
        json!({ "type": "removeRange", "sequenceId": s, "from": { "unit": "frames", "value": 20 },
        "to": { "unit": "frames", "value": 40 }, "trackIds": declared, "alignment": "exact-frame" }),
    ];
    let committed = video.apply(&tx(&video, "cmd_cut", cut)).unwrap();
    let created = committed.receipt.created_ids.clone();
    assert_eq!(created.len(), 2);
    let right = created
        .iter()
        .find(|id| video.state().items[*id].value.span().is_some())
        .unwrap()
        .clone();
    let tone_right = created.iter().find(|id| **id != right).unwrap().clone();
    assert_eq!(span_of(&video, &a), (0, 20));
    assert_eq!(span_of(&video, &right), (20, 20));
    assert!((source_in_seconds(&video, &right) - 40.0 / 30.0).abs() < 1e-9);
    assert_eq!(span_of(&video, &b), (40, 60));
    let (start, length) = audio_range(&video, &tone);
    assert!((start - 0.25).abs() < 1e-9 && (start + length - 20.0 / 30.0).abs() < 1e-9);
    let (start, length) = audio_range(&video, &tone_right);
    assert!((start - 20.0 / 30.0).abs() < 1e-9 && (start + length - (1.75 - 20.0 / 30.0)).abs() < 1e-9);
    assert!((source_in_seconds(&video, &tone_right) - (40.0 / 30.0 - 0.25)).abs() < 1e-9);
    assert_eq!(span_of(&video, &caption), (0, 100));
    assert_eq!(span_of(&video, &text), (0, 120));
    let TimelineItem::Caption(c) = &video.state().items[&caption].value else {
        panic!()
    };
    assert_eq!(c.scope_item_ids, vec![a.clone(), right.clone(), b.clone()]);

    // Anything that falls entirely within the range is deleted: [20, 40) is now exactly A's right segment.
    let again = vec![
        json!({ "type": "removeRange", "sequenceId": s, "from": { "unit": "frames", "value": 20 },
        "to": { "unit": "frames", "value": 40 }, "trackIds": [track(&video, "V1")], "alignment": "exact-frame" }),
    ];
    video.apply(&tx(&video, "cmd_cut_again", again)).unwrap();
    assert!(!video.state().items.contains_key(&right));
    assert_eq!(span_of(&video, &b), (20, 60));

    // A declared track is locked: the whole transaction is rejected. A range shorter than one frame, or with no track declared: rejected.
    video
        .apply(&tx(
            &video,
            "cmd_lock",
            vec![json!({ "type": "updateTrack", "sequenceId": s, "trackId": track(&video, "V2"), "locked": true })],
        ))
        .unwrap();
    let locked = vec![
        json!({ "type": "removeRange", "sequenceId": s, "from": { "unit": "frames", "value": 0 },
        "to": { "unit": "frames", "value": 10 }, "trackIds": [track(&video, "V1"), track(&video, "V2")], "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_locked", locked))), "TARGET_LOCKED");
    let empty = vec![
        json!({ "type": "removeRange", "sequenceId": s, "from": { "unit": "frames", "value": 10 },
        "to": { "unit": "frames", "value": 10 }, "trackIds": [track(&video, "V1")], "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_empty", empty))), "TIME_RANGE_COLLAPSED");
    let none = vec![
        json!({ "type": "removeRange", "sequenceId": s, "from": { "unit": "frames", "value": 0 },
        "to": { "unit": "frames", "value": 10 }, "trackIds": [], "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_none", none))), "INVALID_OPERATION");

    // Undo the first cut (selective undo, with the later steps undone first): back to before the cut.
    for command in ["cmd_undo_lock", "cmd_undo_again", "cmd_undo_cut"] {
        video
            .undo(&UndoRequest {
                command_id: command.into(),
                target: UndoTarget::Undo,
                expected_revision: None,
                actor: user(),
            })
            .unwrap();
    }
    assert_eq!(span_of(&video, &a), (0, 60));
    assert_eq!(span_of(&video, &b), (60, 60));
    assert_eq!(span_of(&video, &caption), (0, 120));
    let TimelineItem::Caption(c) = &video.state().items[&caption].value else {
        panic!()
    };
    assert_eq!(c.scope_item_ids, vec![a, b]);
}

#[test]
fn trimming_past_the_source_is_rejected() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let trim = vec![
        json!({ "type": "trimItem", "sequenceId": seq(&video), "itemId": ids[0], "edge": "end", "at": { "unit": "frames", "value": 61 }, "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_trim", trim))), "SOURCE_TIME_OUT_OF_RANGE");
    let collapse = vec![
        json!({ "type": "trimItem", "sequenceId": seq(&video), "itemId": ids[0], "edge": "start", "at": { "unit": "frames", "value": 60 }, "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_collapse", collapse))), "TIME_RANGE_COLLAPSED");
    // Trim 10 frames from the start: sourceIn moves forward 1/3 second.
    let start = vec![
        json!({ "type": "trimItem", "sequenceId": seq(&video), "itemId": ids[0], "edge": "start", "at": { "unit": "frames", "value": 10 }, "alignment": "exact-frame" }),
    ];
    video.apply(&tx(&video, "cmd_start", start)).unwrap();
    let TimelineItem::Video(v) = &video.state().items[&ids[0]].value else {
        panic!()
    };
    let editor_semantics::TimeMap::Linear { source_in, .. } = &v.time_map else {
        panic!()
    };
    assert_eq!((source_in.ticks.as_str(), source_in.timescale), ("1", 3));
    assert_eq!(span_of(&video, &ids[0]), (10, 50));
}

#[test]
fn overlaps_are_rejected_but_a_swap_in_one_transaction_works() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 2);
    let s = seq(&video);
    let onto = vec![
        json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[1], "at": { "unit": "frames", "value": 30 }, "alignment": "exact-frame" }),
    ];
    assert_eq!(err_code(video.apply(&tx(&video, "cmd_overlap", onto))), "TIMELINE_OVERLAP");
    let swap = vec![json!({ "type": "moveItems", "sequenceId": s, "alignment": "exact-frame", "moves": [
        { "itemId": ids[0], "at": { "unit": "frames", "value": 60 } },
        { "itemId": ids[1], "at": { "unit": "frames", "value": 0 } },
    ] })];
    video.apply(&tx(&video, "cmd_swap", swap)).unwrap();
    assert_eq!(item_ids(&video), vec![ids[1].clone(), ids[0].clone()]);
}

#[test]
fn locked_tracks_refuse_edits() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let v1 = track(&video, "V1");
    video
        .apply(&tx(
            &video,
            "cmd_lock",
            vec![json!({ "type": "updateTrack", "trackId": v1, "locked": true })],
        ))
        .unwrap();
    let del = vec![json!({ "type": "deleteItems", "sequenceId": seq(&video), "itemIds": [ids[0]] })];
    let err = video.apply(&tx(&video, "cmd_del", del)).expect_err("locked track");
    assert_eq!(err.code, "TARGET_LOCKED");
    assert_eq!(err.entity_ids, vec![v1]);
}

#[test]
fn audio_keeps_subframe_precision() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ops = vec![
        json!({ "type": "importAsset", "path": fixtures.audio, "ref": "tone" }),
        json!({ "type": "addItem", "sequenceId": seq(&video), "asset": { "ref": "tone" }, "at": { "unit": "seconds", "value": "1.01" }, "alignment": "nearest-frame" }),
    ];
    let committed = video.apply(&tx(&video, "cmd_audio", ops)).unwrap();
    assert!(committed.receipt.time_resolution.is_empty(), "audio is not quantized");
    let id = &item_ids(&video)[0];
    let TimelineItem::Audio(a) = &video.state().items[id].value else {
        panic!("expected audio")
    };
    assert_eq!(a.from_frame, 30);
    assert_eq!((a.subframe_offset.ticks.as_str(), a.subframe_offset.timescale), ("1", 100));
    assert_eq!((a.play_duration.ticks.as_str(), a.play_duration.timescale), ("3", 2));
    assert_eq!(a.base.track_id, track(&video, "A1"));
}

#[test]
fn reimporting_the_same_bytes_reuses_the_asset() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let first = video
        .apply(&tx(
            &video,
            "cmd_first",
            vec![json!({ "type": "importAsset", "path": fixtures.video_file, "storage": "managed" })],
        ))
        .unwrap();
    let asset_id = first.receipt.created_ids[0].clone();
    let again = video
        .apply(&tx(
            &video,
            "cmd_again",
            vec![json!({ "type": "importAsset", "path": fixtures.video_file, "storage": "managed" })],
        ))
        .unwrap();
    assert_eq!(video.state().assets.len(), 1);
    assert_eq!(again.receipt.preserved, vec![asset_id.clone()]);
    // Importing the same bytes without a storage mode (linked) also reuses the original asset.
    let linked = video
        .apply(&tx(
            &video,
            "cmd_linked",
            vec![json!({ "type": "importAsset", "path": fixtures.video_file })],
        ))
        .unwrap();
    assert_eq!(linked.receipt.preserved, vec![asset_id.clone()]);
    assert_eq!(video.state().assets.len(), 1);
    let blob = video.blob_path(&asset_id, None).unwrap();
    assert!(blob.starts_with(dir.path().join("blobs")));
    assert_eq!(
        std::fs::read_dir(dir.path().join("blobs/.staging")).unwrap().count(),
        0,
        "staging is emptied"
    );
}

#[test]
fn t08_undo_does_not_erase_later_additions_and_redo_works() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let asset = video.state().assets.keys().next().unwrap().clone();
    let s = seq(&video);

    // The user moves a clip; afterwards, the agent adds another clip.
    let moved = video
        .apply(&tx(&video, "cmd_move", vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "frames", "value": 100 }, "alignment": "exact-frame" })]))
        .unwrap();
    let mut by_agent = tx(
        &video,
        "cmd_agent_add",
        vec![
            json!({ "type": "addItem", "sequenceId": s, "asset": { "assetId": asset }, "at": { "unit": "frames", "value": 200 }, "alignment": "exact-frame" }),
        ],
    );
    by_agent.actor = agent();
    let added = video.apply(&by_agent).unwrap().receipt.created_ids[0].clone();

    // Undo the user's move: only that transaction is compensated; the agent's clip is kept.
    let undo = UndoRequest {
        command_id: "cmd_undo_move".into(),
        target: UndoTarget::Transaction(moved.receipt.transaction_id.clone()),
        expected_revision: None,
        actor: user(),
    };
    let undone = video.undo(&undo).unwrap();
    assert_eq!(undone.receipt.undo_of.as_deref(), Some(moved.receipt.transaction_id.as_str()));
    assert_eq!(span_of(&video, &ids[0]).0, 0, "back in place");
    assert!(video.state().items.contains_key(&added), "the agent's clip is still there");
    assert_eq!(
        err_code(video.undo(&UndoRequest {
            command_id: "cmd_undo_twice".into(),
            ..undo.clone()
        })),
        "UNDO_UNAVAILABLE"
    );

    // A retry of the same undo request returns the original receipt.
    assert_eq!(video.undo(&undo).unwrap().receipt, undone.receipt);

    // Redo = undo that undo.
    let redo = UndoRequest {
        command_id: "cmd_redo".into(),
        target: UndoTarget::Transaction(undone.receipt.transaction_id.clone()),
        expected_revision: None,
        actor: user(),
    };
    video.undo(&redo).unwrap();
    assert_eq!(span_of(&video, &ids[0]).0, 100);

    let history = video.history(10).unwrap();
    assert_eq!(history[0].label, "Redo: Move clips");
    assert_eq!(history[0].undo_depth, 2);
    assert!(history.iter().any(|h| h.actor == agent()));
}

#[test]
fn undo_conflicts_when_the_target_changed_afterwards() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let s = seq(&video);
    let first = video
        .apply(&tx(&video, "cmd_m1", vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "frames", "value": 30 }, "alignment": "exact-frame" })]))
        .unwrap();
    video
        .apply(&tx(&video, "cmd_m2", vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "frames", "value": 90 }, "alignment": "exact-frame" })]))
        .unwrap();
    let err = video
        .undo(&UndoRequest {
            command_id: "cmd_u".into(),
            target: UndoTarget::Transaction(first.receipt.transaction_id),
            expected_revision: None,
            actor: user(),
        })
        .expect_err("moved again afterwards");
    assert_eq!(err.code, "UNDO_CONFLICT");
    assert_eq!(err.entity_ids, vec![ids[0].clone()]);
    assert_eq!(span_of(&video, &ids[0]).0, 90);
}

#[test]
fn undoing_an_import_is_refused_while_a_later_item_uses_the_asset() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let imported = video
        .apply(&tx(
            &video,
            "cmd_imp",
            vec![json!({ "type": "importAsset", "path": fixtures.video_file })],
        ))
        .unwrap();
    let asset = imported.receipt.created_ids[0].clone();
    video
        .apply(&tx(
            &video,
            "cmd_add",
            vec![json!({ "type": "addItem", "sequenceId": seq(&video), "asset": { "assetId": asset }, "alignment": "nearest-frame" })],
        ))
        .unwrap();
    let err = video
        .undo(&UndoRequest {
            command_id: "cmd_u".into(),
            target: UndoTarget::Transaction(imported.receipt.transaction_id),
            expected_revision: None,
            actor: user(),
        })
        .expect_err("the clip still uses this asset");
    assert_eq!(err.code, "UNDO_CONFLICT");
}

#[test]
fn payload_hash_ignores_key_order() {
    let a = json!({ "operations": [{ "type": "renameVideo", "name": "x" }], "baseVideoRevision": "3" });
    let b = json!({ "baseVideoRevision": "3", "operations": [{ "name": "x", "type": "renameVideo" }] });
    assert_eq!(payload_hash(&a), payload_hash(&b));
    let c = json!({ "baseVideoRevision": "3", "operations": [{ "name": "y", "type": "renameVideo" }] });
    assert_ne!(payload_hash(&a), payload_hash(&c));
}

#[test]
fn read_only_open_works_after_the_writer_closed() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    video
        .apply(&tx(
            &video,
            "cmd_ro_after",
            vec![json!({ "type": "renameVideo", "name": "关闭之后" })],
        ))
        .unwrap();
    let snapshot = video.snapshot();
    drop(video);
    let reader = Video::open(dir.path(), OpenMode::ReadOnly, &ffprobe()).unwrap();
    assert_eq!(reader.snapshot(), snapshot);
    // A read-only open does not take the write lock.
    Video::open(dir.path(), OpenMode::Write, &ffprobe()).expect("the write lock is available");
}

#[test]
fn undo_stack_follows_the_actor_and_clears_redo_after_a_new_edit() {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let step = |video: &mut Video, cmd: &str, target: UndoTarget| {
        video.undo(&UndoRequest {
            command_id: cmd.into(),
            target,
            expected_revision: None,
            actor: user(),
        })
    };
    for (i, name) in ["一", "二", "三"].iter().enumerate() {
        video
            .apply(&tx(
                &video,
                &format!("cmd_name_{i}"),
                vec![json!({ "type": "renameVideo", "name": name })],
            ))
            .unwrap();
    }
    // The agent's changes do not enter the user's undo stack.
    let mut by_agent = tx(
        &video,
        "cmd_agent_track",
        vec![json!({ "type": "addTrack", "sequenceId": seq(&video), "kind": "audio" })],
    );
    by_agent.actor = agent();
    video.apply(&by_agent).unwrap();
    assert_eq!(video.undo_state(&user()).unwrap().undo.unwrap().label, "Rename video");
    assert!(video.undo_state(&user()).unwrap().redo.is_none());

    step(&mut video, "u1", UndoTarget::Undo).unwrap();
    step(&mut video, "u2", UndoTarget::Undo).unwrap();
    assert_eq!(video.state().name, "一");
    assert_eq!(video.state().tracks.len(), 3, "the agent's tracks are kept");
    step(&mut video, "r1", UndoTarget::Redo).unwrap();
    assert_eq!(video.state().name, "二");
    step(&mut video, "r2", UndoTarget::Redo).unwrap();
    assert_eq!(video.state().name, "三");
    assert!(video.undo_state(&user()).unwrap().redo.is_none());
    assert_eq!(err_code(step(&mut video, "r3", UndoTarget::Redo)), "UNDO_UNAVAILABLE");

    // After an undo, a new change is made: the redo stack is cleared.
    step(&mut video, "u3", UndoTarget::Undo).unwrap();
    assert!(video.undo_state(&user()).unwrap().redo.is_some());
    video
        .apply(&tx(&video, "cmd_new", vec![json!({ "type": "renameVideo", "name": "四" })]))
        .unwrap();
    assert!(video.undo_state(&user()).unwrap().redo.is_none());
    // Retrying the same undo in the same direction returns the original receipt and does not undo another step.
    let first = step(&mut video, "u4", UndoTarget::Undo).unwrap();
    let again = step(&mut video, "u4", UndoTarget::Undo).unwrap();
    assert_eq!(first.receipt, again.receipt);
    assert_eq!(video.state().name, "二");
}

#[test]
fn undo_that_would_overlap_a_later_item_is_an_undo_conflict() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 1);
    let asset = video.state().assets.keys().next().unwrap().clone();
    let s = seq(&video);
    let moved = video
        .apply(&tx(&video, "cmd_move", vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": ids[0], "at": { "unit": "frames", "value": 100 }, "alignment": "exact-frame" })]))
        .unwrap();
    let mut by_agent = tx(
        &video,
        "cmd_agent",
        vec![
            json!({ "type": "addItem", "sequenceId": s, "asset": { "assetId": asset }, "at": { "unit": "frames", "value": 0 }, "alignment": "exact-frame" }),
        ],
    );
    by_agent.actor = agent();
    let added = video.apply(&by_agent).unwrap().receipt.created_ids[0].clone();
    let err = video
        .undo(&UndoRequest {
            command_id: "cmd_u".into(),
            target: UndoTarget::Transaction(moved.receipt.transaction_id),
            expected_revision: None,
            actor: user(),
        })
        .expect_err("the restored position is occupied");
    assert_eq!(err.code, "UNDO_CONFLICT");
    assert!(err.entity_ids.contains(&added));
}

#[test]
fn speed_changes_keep_the_source_range_and_refuse_to_push_neighbours() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let ids = import_video(&mut video, fixtures, 2);
    let s = seq(&video);
    let speed =
        |id: &str, num: i64, den: i64| json!({ "type": "setSpeed", "sequenceId": s, "itemId": id, "rate": { "num": num, "den": den } });

    // A 2-second asset played at 2× speed: the length is halved, and the source interval does not change.
    video.apply(&tx(&video, "cmd_fast", vec![speed(&ids[0], 2, 1)])).unwrap();
    assert_eq!(span_of(&video, &ids[0]), (0, 30));
    let TimelineItem::Video(v) = &video.state().items[&ids[0]].value else {
        panic!("expected video")
    };
    assert_eq!(
        v.time_map,
        editor_semantics::TimeMap::Linear {
            source_in: editor_semantics::MediaTime::zero(),
            rate: Rate { num: 2, den: 1 }
        }
    );

    // Slowing it to 0.5× would cover the instance after it: rejected, and others are not pushed away.
    assert_eq!(
        err_code(video.apply(&tx(&video, "cmd_slow", vec![speed(&ids[0], 1, 2)]))),
        "TIMELINE_OVERLAP"
    );
    assert_eq!(
        err_code(video.apply(&tx(&video, "cmd_range", vec![speed(&ids[0], 1, 20)]))),
        "INVALID_OPERATION"
    );
    // 3/2×: a 60-frame source interval is played in 40 frames.
    video.apply(&tx(&video, "cmd_mid", vec![speed(&ids[0], 3, 2)])).unwrap();
    assert_eq!(span_of(&video, &ids[0]), (0, 40));

    // The audio length stays exact and is not snapped to frames.
    let ops = vec![
        json!({ "type": "importAsset", "path": fixtures.audio, "ref": "tone" }),
        json!({ "type": "addItem", "sequenceId": s, "asset": { "ref": "tone" }, "at": { "unit": "frames", "value": 0 }, "alignment": "exact-frame" }),
    ];
    let audio = video
        .apply(&tx(&video, "cmd_audio", ops))
        .unwrap()
        .receipt
        .created_ids
        .last()
        .unwrap()
        .clone();
    video.apply(&tx(&video, "cmd_audio_fast", vec![speed(&audio, 2, 1)])).unwrap();
    let TimelineItem::Audio(a) = &video.state().items[&audio].value else {
        panic!("expected audio")
    };
    assert_eq!((a.play_duration.ticks.as_str(), a.play_duration.timescale), ("3", 4));
}

#[test]
fn audio_mix_and_picture_fit_follow_the_item_kind() {
    let Some(fixtures) = fixtures() else { return };
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(dir.path());
    let id = import_video(&mut video, fixtures, 1)[0].clone();
    let s = seq(&video);
    let ops = vec![
        json!({ "type": "setAudioMix", "itemId": id, "muted": true, "volume": 0.5, "fadeIn": "0.5", "fadeOut": "0" }),
        json!({ "type": "setStyle", "sequenceId": s, "itemId": id, "mode": "pip", "fit": "cover", "bg": "blur", "opacity": 0.8 }),
    ];
    let committed = video.apply(&tx(&video, "cmd_mix", ops)).unwrap();
    assert_eq!(committed.receipt.label, "Adjust audio and more (2 changes)");
    let TimelineItem::Video(v) = &video.state().items[&id].value else {
        panic!("expected video")
    };
    let fade_in = v.embedded_audio.fade_in.as_ref().map(|t| (t.ticks.as_str(), t.timescale));
    assert_eq!(
        (v.embedded_audio.enabled, v.embedded_audio.volume, fade_in),
        (false, 0.5, Some(("1", 2)))
    );
    assert_eq!(
        (v.media.mode, v.media.fit, v.media.bg, v.place.opacity),
        (Some(VisualMode::Pip), Some(Fit::Cover), Some(Background::Blur), Some(0.8))
    );

    // A sum of fade-in and fade-out longer than the clip (2 seconds), a volume outside v2's [0, 4], and wrong seconds: all rejected.
    for (n, op) in [
        json!({ "type": "setAudioMix", "itemId": id, "fadeIn": "1.5", "fadeOut": "0.6" }),
        json!({ "type": "setAudioMix", "itemId": id, "volume": 5 }),
        json!({ "type": "setAudioMix", "itemId": id, "gainDb": -6 }),
        json!({ "type": "setAudioMix", "itemId": id }),
    ]
    .into_iter()
    .enumerate()
    {
        assert_eq!(
            err_code(video.apply(&tx(&video, &format!("cmd_bad_{n}"), vec![op]))),
            "INVALID_OPERATION"
        );
    }
    let bad_seconds = json!({ "type": "setAudioMix", "itemId": id, "fadeIn": "1e3" });
    assert!(video.apply(&tx(&video, "cmd_bad_seconds", vec![bad_seconds])).is_err());

    // Remove the padding and restore the sound.
    let ops = vec![
        json!({ "type": "setStyle", "itemId": id, "bg": null }),
        json!({ "type": "setAudioMix", "itemId": id, "muted": false, "fadeIn": "0" }),
    ];
    video.apply(&tx(&video, "cmd_reset", ops)).unwrap();
    let TimelineItem::Video(v) = &video.state().items[&id].value else {
        panic!("expected video")
    };
    assert_eq!(
        (v.media.bg, v.embedded_audio.enabled, v.embedded_audio.fade_in.is_none()),
        (None, true, true)
    );
}
