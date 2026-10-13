//! A video claims its owning project (architecture design §5.1; video format spec §1.3): three cases: adopt, same, and change identifier.

#![allow(clippy::result_large_err)]

use std::fs;
use std::path::{Path, PathBuf};

use editor_semantics::Rate;
use serde_json::json;
use video_engine::model::{Actor, ActorKind};
use video_engine::{CreateOptions, OpenMode, ProjectClaim, UndoRequest, UndoTarget, Video, VideoTransaction, claim_project_dir};

fn ffprobe() -> PathBuf {
    PathBuf::from(std::env::var("CUCCUT_FFPROBE").unwrap_or_else(|_| "ffprobe".into()))
}

fn user() -> Actor {
    Actor {
        kind: ActorKind::User,
        id: "user_local".into(),
    }
}

fn rename(video: &mut Video, command_id: &str, name: &str) {
    video
        .apply(&VideoTransaction {
            command_id: command_id.into(),
            expected_revision: video.revision(),
            label: None,
            label_ref: None,
            operations: vec![json!({ "type": "renameVideo", "name": name })],
            actor: user(),
            task_id: None,
        })
        .unwrap();
}

fn new_video(dir: &Path) -> Video {
    let options = CreateOptions {
        name: "样片".into(),
        fps: Rate { num: 30, den: 1 },
        width: 1280,
        height: 720,
    };
    Video::create(dir, &options, &ffprobe()).unwrap()
}

fn open(dir: &Path) -> Video {
    Video::open(dir, OpenMode::Write, &ffprobe()).unwrap()
}

/// Recursively copies a directory (`cp -r`). Lock files are copied too, just as when a user copies in Finder.
fn copy_dir(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), &target).unwrap();
        }
    }
}

#[test]
fn adopts_when_the_video_has_no_project_and_keeps_the_id() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("v");
    let mut video = new_video(&dir);
    rename(&mut video, "cmd_1", "第一版");
    let id = video.id().to_string();
    assert_eq!(video.project_id().unwrap(), None);

    assert_eq!(video.claim_project("proj_a").unwrap(), ProjectClaim::Adopted);
    assert_eq!(video.id(), id);
    assert_eq!(video.project_id().unwrap().as_deref(), Some("proj_a"));
    // Claiming is not a revision: the version number, history and undo stack are all unchanged.
    assert_eq!(video.revision(), "1");
    assert_eq!(video.history(10).unwrap().len(), 1);
    drop(video);

    let reopened = open(&dir);
    assert_eq!(reopened.id(), id);
    assert_eq!(reopened.project_id().unwrap().as_deref(), Some("proj_a"));
    assert!(reopened.previous_video_ids().unwrap().is_empty());
}

#[test]
fn same_project_changes_nothing() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("v");
    let mut video = new_video(&dir);
    video.claim_project("proj_a").unwrap();
    let id = video.id().to_string();
    assert_eq!(video.claim_project("proj_a").unwrap(), ProjectClaim::Unchanged);
    drop(video);
    let (current, claim) = claim_project_dir(&dir, "proj_a").unwrap();
    assert_eq!((current.as_str(), claim), (id.as_str(), ProjectClaim::Unchanged));
}

#[test]
fn a_copy_in_another_project_gets_a_new_id_with_history_intact() {
    let root = tempfile::tempdir().unwrap();
    let original_dir = root.path().join("原项目").join("v");
    let mut video = new_video(&original_dir);
    video.claim_project("proj_a").unwrap();
    rename(&mut video, "cmd_1", "第一版");
    rename(&mut video, "cmd_2", "第二版");
    let original_id = video.id().to_string();
    let snapshot = video.snapshot();
    let history = video.history(10).unwrap();
    drop(video);

    let copy_dir_path = root.path().join("副本").join("v");
    copy_dir(&original_dir, &copy_dir_path);

    let mut copy = open(&copy_dir_path);
    assert_eq!(copy.id(), original_id, "认领之前副本还是旧的 id");
    let claim = copy.claim_project("proj_b").unwrap();
    let new_id = copy.id().to_string();
    assert_ne!(new_id, original_id);
    assert_eq!(
        claim,
        ProjectClaim::Reassigned {
            previous_video_id: original_id.clone(),
            video_id: new_id.clone(),
        }
    );
    assert_eq!(copy.project_id().unwrap().as_deref(), Some("proj_b"));
    assert_eq!(copy.previous_video_ids().unwrap(), vec![original_id.clone()]);

    // Content, revision number and history are unchanged; only the video's id changed.
    let mut expected = snapshot.clone();
    expected.id = new_id.clone();
    assert_eq!(copy.snapshot(), expected);
    assert_eq!(copy.history(10).unwrap(), history);
    assert_eq!(copy.event_seq(), 2);
    // The videoId in receipts and events changed too: re-sent events route to the new id.
    assert_eq!(copy.find_receipt("cmd_2").unwrap().unwrap().video_id, new_id);
    assert!(copy.events_after(0, 10).unwrap().iter().all(|e| e.video_id == new_id));

    // Undo works as usual: the id of the video entity in the undo records has changed too, and after an undo the id does not revert to the old one.
    copy.undo(&UndoRequest {
        command_id: "cmd_undo".into(),
        target: UndoTarget::Undo,
        expected_revision: None,
        actor: user(),
    })
    .unwrap();
    assert_eq!(copy.id(), new_id);
    assert_eq!(copy.snapshot().name, "第一版");
    assert_eq!(copy.revision(), "3");
    drop(copy);

    let reopened = open(&copy_dir_path);
    assert_eq!(reopened.id(), new_id);
    assert_eq!(reopened.snapshot().name, "第一版");

    // The original video is unaffected.
    let original = open(&original_dir);
    assert_eq!(original.id(), original_id);
    assert_eq!(original.project_id().unwrap().as_deref(), Some("proj_a"));
    assert_eq!(original.snapshot(), snapshot);
    drop(original);

    // A copy of a copy: previously used ids are appended in order.
    let third = root.path().join("第三份").join("v");
    copy_dir(&copy_dir_path, &third);
    let (third_id, claim) = claim_project_dir(&third, "proj_c").unwrap();
    assert!(matches!(claim, ProjectClaim::Reassigned { .. }));
    let third_video = open(&third);
    assert_eq!(third_video.id(), third_id);
    assert_eq!(third_video.previous_video_ids().unwrap(), vec![original_id, new_id]);
}

#[test]
fn claiming_a_directory_respects_the_write_lock() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("v");
    let video = new_video(&dir);
    let err = claim_project_dir(&dir, "proj_a").unwrap_err();
    assert_eq!(err.code, "VIDEO_LOCKED");
    drop(video);
    let (_, claim) = claim_project_dir(&dir, "proj_a").unwrap();
    assert_eq!(claim, ProjectClaim::Adopted);

    // A read-only open cannot claim.
    let mut reader = Video::open(&dir, OpenMode::ReadOnly, &ffprobe()).unwrap();
    assert!(reader.claim_project("proj_b").is_err());
}
