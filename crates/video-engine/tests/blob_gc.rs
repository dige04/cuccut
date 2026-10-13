//! GC for `blobs/` (`Video::gc_blobs`, architecture design §5.2, §5.5): any blob still mentioned by any record in the library (all versions of assets, undo records, current entities) is kept; unreferenced ones are deleted; staging entries past the grace period are deleted and fresh ones are kept; entries that are not blobs are not touched.

#![allow(clippy::result_large_err)]

use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use editor_semantics::Rate;
use serde_json::{Value, json};
use video_engine::gc::STAGING_GRACE;
use video_engine::import::blob_rel_path;
use video_engine::model::{Actor, ActorKind};
use video_engine::{CreateOptions, OpenMode, UndoRequest, UndoTarget, Video, VideoTransaction};

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
        name: "GC".into(),
        fps: Rate { num: 30, den: 1 },
        width: 1920,
        height: 1080,
    };
    Video::create(dir, &options, &ffprobe()).expect("create the video")
}

fn apply(video: &mut Video, command_id: &str, operations: Vec<Value>) -> video_engine::Committed {
    let transaction = VideoTransaction {
        command_id: command_id.into(),
        expected_revision: video.revision(),
        label: None,
        label_ref: None,
        operations,
        actor: user(),
        task_id: None,
    };
    video.apply(&transaction).unwrap()
}

fn undo(video: &mut Video, command_id: &str, transaction_id: &str) {
    video
        .undo(&UndoRequest {
            command_id: command_id.into(),
            target: UndoTarget::Transaction(transaction_id.into()),
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
}

fn import_svg(video: &mut Video, root: &Path, name: &str, storage: &str) -> String {
    let path = root.join(format!("{name}.svg"));
    fs::write(
        &path,
        format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><title>{name}</title></svg>"#),
    )
    .unwrap();
    let op = json!({ "type": "importAsset", "path": path, "ref": "i", "storage": storage });
    apply(video, &format!("cmd_import_{name}"), vec![op]).receipt.refs["i"].clone()
}

fn import_bundle(video: &mut Video, root: &Path, name: &str) -> String {
    let dir = root.join(name);
    fs::create_dir_all(dir.join("lib")).unwrap();
    fs::write(dir.join("index.html"), format!("<html><body>{name}</body></html>")).unwrap();
    fs::write(dir.join("lib").join("main.js"), format!("console.log('{name}')")).unwrap();
    let manifest = json!({
        "engine": "browser", "entry": "index.html",
        "intrinsic": { "width": 1920, "height": 1080, "fps": { "num": 30, "den": 1 }, "durationFrames": 60 },
    });
    let op = json!({ "type": "importAsset", "path": dir, "ref": "b", "bundle": manifest });
    apply(video, &format!("cmd_bundle_{name}"), vec![op]).receipt.refs["b"].clone()
}

/// The blob path of an asset's current version in the video directory (only when managed).
fn blob_of(video: &Video, asset_id: &str) -> PathBuf {
    let asset = &video.state().assets[asset_id];
    let rev = &asset.revisions[&asset.current_revision];
    video.dir().join(blob_rel_path(&rev.content_hash, &rev.media_type))
}

fn age(path: &Path, by: Duration) {
    let past = SystemTime::now() - by;
    File::open(path).unwrap().set_modified(past).unwrap();
}

#[test]
fn referenced_blobs_survive_and_orphans_go() {
    let root = tempfile::tempdir().unwrap();
    let mut video = new_video(&root.path().join("m"));

    // One managed asset, deleted and then undone; another deleted and not undone: the version records of both remain, and all blobs are kept.
    let kept = import_svg(&mut video, root.path(), "kept", "managed");
    let removed = import_svg(&mut video, root.path(), "removed", "managed");
    let kept_blob = blob_of(&video, &kept);
    let removed_blob = blob_of(&video, &removed);
    let remove_kept = apply(
        &mut video,
        "cmd_remove_kept",
        vec![json!({ "type": "removeAssets", "assetIds": [kept] })],
    );
    undo(&mut video, "cmd_undo_remove_kept", &remove_kept.receipt.transaction_id);
    apply(
        &mut video,
        "cmd_remove_removed",
        vec![json!({ "type": "removeAssets", "assetIds": [removed] })],
    );
    assert!(!video.state().assets.contains_key(&removed));

    // Linked, then collected in: the version record says linked, but the entity says managed. The blob must be kept.
    let collected = import_svg(&mut video, root.path(), "collected", "linked");
    apply(
        &mut video,
        "cmd_collect",
        vec![json!({ "type": "collectAssets", "assetIds": [collected] })],
    );
    let collected_blob = blob_of(&video, &collected);
    assert!(collected_blob.is_file());

    // Two code bundles (directory assets), one of them deleted: both are kept.
    let bundle_a = import_bundle(&mut video, root.path(), "bundle-a");
    let bundle_b = import_bundle(&mut video, root.path(), "bundle-b");
    let bundle_a_dir = blob_of(&video, &bundle_a);
    let bundle_b_dir = blob_of(&video, &bundle_b);
    apply(
        &mut video,
        "cmd_remove_bundle",
        vec![json!({ "type": "removeAssets", "assetIds": [bundle_b] })],
    );

    // Orphans left by a crash: one file blob, one directory blob. There is also one file that the video does not manage.
    let blobs = video.dir().join("blobs");
    let orphan_file = blobs.join(format!("{}.png", "1".repeat(64)));
    fs::write(&orphan_file, b"orphan bytes").unwrap();
    let orphan_tree = blobs.join("2".repeat(64));
    fs::create_dir_all(orphan_tree.join("sub")).unwrap();
    fs::write(orphan_tree.join("index.html"), b"12345").unwrap();
    fs::write(orphan_tree.join("sub").join("a.js"), b"123").unwrap();
    let stray = blobs.join("notes.txt");
    fs::write(&stray, b"user notes").unwrap();

    // Staging: expired files and directories (a directory is judged by its newest descendant) are deleted; fresh ones, and directories with new files deep inside, are kept.
    let staging = blobs.join(".staging");
    let old_file = staging.join("import_old");
    fs::write(&old_file, b"half written").unwrap();
    age(&old_file, Duration::from_secs(2 * 3600));
    let old_tree = staging.join("tree_old");
    fs::create_dir_all(old_tree.join("deep")).unwrap();
    fs::write(old_tree.join("deep").join("x.js"), b"x").unwrap();
    age(&old_tree.join("deep").join("x.js"), Duration::from_secs(2 * 3600));
    age(&old_tree.join("deep"), Duration::from_secs(2 * 3600));
    age(&old_tree, Duration::from_secs(2 * 3600));
    let fresh_file = staging.join("import_fresh");
    fs::write(&fresh_file, b"being written").unwrap();
    let busy_tree = staging.join("tree_busy");
    fs::create_dir_all(busy_tree.join("deep")).unwrap();
    fs::write(busy_tree.join("deep").join("y.js"), b"y").unwrap();
    age(&busy_tree, Duration::from_secs(2 * 3600));

    let report = video.gc_blobs(STAGING_GRACE).unwrap();

    for path in [&kept_blob, &removed_blob, &collected_blob] {
        assert!(path.is_file(), "still-referenced {} should be kept", path.display());
    }
    for path in [&bundle_a_dir, &bundle_b_dir] {
        assert!(
            path.join("lib").join("main.js").is_file(),
            "still-referenced code bundle {} should be kept",
            path.display()
        );
    }
    assert!(!orphan_file.exists() && !orphan_tree.exists());
    assert!(stray.is_file());
    assert!(!old_file.exists() && !old_tree.exists());
    assert!(fresh_file.is_file() && busy_tree.is_dir());
    assert!(staging.is_dir(), "the staging directory itself is kept");

    let removed_paths: Vec<&str> = report.removed.iter().map(|r| r.path.as_str()).collect();
    assert_eq!(
        removed_paths,
        vec![format!("blobs/{}.png", "1".repeat(64)), format!("blobs/{}", "2".repeat(64))]
    );
    let staging_paths: Vec<&str> = report.staging_removed.iter().map(|r| r.path.as_str()).collect();
    assert_eq!(staging_paths, vec!["blobs/.staging/import_old", "blobs/.staging/tree_old"]);
    assert_eq!(report.freed_bytes, 12 + 5 + 3 + 12 + 1);
    assert_eq!(report.kept, 5);
    assert_eq!(report.staging_kept, 2);
    assert_eq!(report.skipped, vec!["blobs/notes.txt".to_string()]);
    assert!(report.failed.is_empty());

    // The asset referenced by an undo record can still be restored, and its bytes are still there.
    let resolved = video.resolve_asset(&kept, None).unwrap();
    assert!(resolved.path.is_file());

    // Running again: nothing left to delete.
    let again = video.gc_blobs(STAGING_GRACE).unwrap();
    assert!(again.removed.is_empty() && again.staging_removed.is_empty() && again.freed_bytes == 0);
}

#[test]
fn read_only_videos_are_not_collected() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("m");
    drop(new_video(&dir));
    let orphan = dir.join("blobs").join(format!("{}.png", "3".repeat(64)));
    fs::write(&orphan, b"x").unwrap();
    let reader = Video::open(&dir, OpenMode::ReadOnly, &ffprobe()).unwrap();
    assert_eq!(reader.gc_blobs(STAGING_GRACE).unwrap_err().code, "VIDEO_READ_ONLY");
    assert!(orphan.is_file());
}

#[cfg(unix)]
#[test]
fn a_blob_that_cannot_be_removed_is_reported_not_fatal() {
    use std::os::unix::fs::PermissionsExt;
    let root = tempfile::tempdir().unwrap();
    let video = new_video(&root.path().join("m"));
    let tree = video.dir().join("blobs").join("4".repeat(64));
    fs::create_dir_all(tree.join("locked")).unwrap();
    fs::write(tree.join("locked").join("f"), b"f").unwrap();
    fs::set_permissions(tree.join("locked"), fs::Permissions::from_mode(0o500)).unwrap();
    let orphan = video.dir().join("blobs").join(format!("{}.png", "5".repeat(64)));
    fs::write(&orphan, b"x").unwrap();

    let report = video.gc_blobs(STAGING_GRACE).unwrap();
    fs::set_permissions(tree.join("locked"), fs::Permissions::from_mode(0o700)).unwrap();

    assert!(!orphan.exists(), "other orphans are still deleted");
    assert_eq!(report.failed.len(), 1);
    assert_eq!(report.failed[0].path, format!("blobs/{}", "4".repeat(64)));
}
