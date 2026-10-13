//! In-place replacement of a code picture (`replaceCodeBundle`, code bundle spec §3.3): only the code bundle version and the stand-in are swapped; the rest of the instance does not change;
//! the length follows the new version: if it is shortened, the excess is trimmed; if it is lengthened and collides with the instances after it, it is rejected; if the parameter schema changed, new parameters must be given.
//! The stand-in tests generate video with ffmpeg on the spot; without ffmpeg they are skipped and the reason is printed.

#![allow(clippy::result_large_err)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use editor_semantics::{Rate, TimeMap};
use serde_json::{Value, json};
use video_engine::model::{Actor, ActorKind, CompositionItem, CompositionSource, TimelineItem, VersionRef};
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

/// A code bundle directory: different content makes a different asset. The manifest's intrinsic is the frame count at 30 fps.
fn bundle_dir(root: &Path, name: &str, frames: i64, schema: Option<&str>) -> (PathBuf, Value) {
    let dir = root.join(name);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("index.html"), format!("<html><body>{name}</body></html>")).unwrap();
    let mut manifest = json!({
        "engine": "browser", "entry": "index.html",
        "intrinsic": { "width": 1920, "height": 1080, "fps": { "num": 30, "den": 1 }, "durationFrames": frames },
    });
    if let Some(schema) = schema {
        manifest["parametersSchemaRef"] = json!(schema);
    }
    (dir, manifest)
}

/// Imports a code bundle and returns a reference to its current version.
fn import_bundle(video: &mut Video, root: &Path, name: &str, frames: i64, schema: Option<&str>) -> Value {
    let (dir, manifest) = bundle_dir(root, name, frames, schema);
    let committed = apply(
        video,
        &format!("cmd_import_{name}"),
        vec![json!({ "type": "importAsset", "path": dir, "ref": "b", "bundle": manifest })],
    )
    .unwrap();
    let id = committed.receipt.refs["b"].clone();
    json!({ "id": id, "revision": video.state().assets[&id].current_revision })
}

fn composition(video: &Video, id: &str) -> CompositionItem {
    match &video.state().items[id].value {
        TimelineItem::Composition(c) => c.clone(),
        other => panic!("not a composition: {other:?}"),
    }
}

fn bundle_ref(c: &CompositionItem) -> &VersionRef {
    let CompositionSource::Bundle { asset_ref } = &c.source;
    asset_ref
}

/// A composition on the timeline: starts at frame 60, is `frames` frames long, and has parameters.
fn place_composition(video: &mut Video, bundle: &Value, frames: i64, params: Value) -> String {
    let s = seq(video);
    let item = json!({
        "type": "composition", "trackId": track(video, "V1"), "span": { "fromFrame": 60, "durationFrames": frames },
        "name": "下三分之一", "place": { "x": 30, "y": 80, "w": 40, "opacity": 0.9 },
        "source": { "kind": "bundle", "assetRef": bundle },
        "parameterValues": params,
        "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 30 }, "rate": { "num": 1, "den": 1 } },
        "fx": { "blur": 2 },
    });
    let committed = apply(
        video,
        "cmd_place",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": [item] })],
    )
    .unwrap();
    committed.receipt.created_ids[0].clone()
}

#[test]
fn replace_keeps_the_clip_and_swaps_only_the_source() {
    let root = tempfile::tempdir().unwrap();
    let mut video = new_video(&root.path().join("m"));
    let rev1 = import_bundle(&mut video, root.path(), "rev1", 120, Some("params.json"));
    let rev2 = import_bundle(&mut video, root.path(), "rev2", 60, Some("params.json"));
    let id = place_composition(&mut video, &rev1, 120, json!({ "title": "你好" }));
    apply(
        &mut video,
        "cmd_keys",
        vec![json!({ "type": "setKeyframes", "itemId": id, "property": "opacity",
                    "keyframes": [{ "localFrame": 0, "value": 0.0 }, { "localFrame": 30, "value": 1.0 }] })],
    )
    .unwrap();
    let before = composition(&video, &id);
    let bindings_before = video.snapshot().sequences[&seq(&video)].header.animation_bindings.clone();

    // The new version is half as long: with no stand-in, the length comes from the manifest's intrinsic; the parameter schema has not changed, so the old parameters are kept as they are.
    let committed = apply(
        &mut video,
        "cmd_replace",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": rev2 })],
    )
    .unwrap();
    let replaced_tx = committed.receipt.transaction_id.clone();
    assert_eq!(committed.receipt.label, "Replace code composition");
    assert_eq!(committed.receipt.updated_ids, vec![id.clone()]);
    assert!(committed.receipt.created_ids.is_empty() && committed.receipt.deleted_ids.is_empty());

    let after = composition(&video, &id);
    assert_eq!(serde_json::to_value(bundle_ref(&after)).unwrap(), rev2);
    assert_eq!(after.prerender, None);
    assert_eq!(
        (after.span.from_frame, after.span.duration_frames),
        (60, 60),
        "start unchanged; shortening trims the end"
    );
    assert!(matches!(&after.time_map, TimeMap::Linear { source_in, rate } if source_in.ticks == "0" && rate.num == rate.den));
    // Everything else is unchanged: ID, track, name, geometry and opacity, effects, parameters, enable and lock, follow, and lineage.
    assert_eq!(after.base, before.base);
    assert_eq!(after.place, before.place);
    assert_eq!(after.fx, before.fx);
    assert_eq!(after.mask, before.mask);
    assert_eq!(after.audio, before.audio);
    assert_eq!(after.parameter_values, json!({ "title": "你好" }));
    // Keyframes are all inside the new window: kept as they are.
    assert_eq!(video.snapshot().sequences[&seq(&video)].header.animation_bindings, bindings_before);

    // The receipt says the change is at the source level, and that the length went from 120 frames to 60 frames.
    let impact = serde_json::to_value(&committed.receipt.impact).unwrap();
    assert_eq!(
        impact["codeEdits"],
        json!([{
            "itemId": id, "layer": "source",
            "previousBundleRef": rev1, "bundleRef": rev2,
            "previousPrerender": null, "prerender": null,
            "oldDurationFrames": 120, "newDurationFrames": 60,
        }])
    );

    // Undo swaps back to the old version and the old length.
    video
        .undo(&UndoRequest {
            command_id: "cmd_undo".into(),
            target: UndoTarget::Transaction(replaced_tx),
            expected_revision: None,
            actor: user(),
        })
        .unwrap();
    let undone = composition(&video, &id);
    assert_eq!(serde_json::to_value(bundle_ref(&undone)).unwrap(), rev1);
    assert_eq!(undone.span.duration_frames, 120);
}

#[test]
fn a_longer_version_that_runs_into_the_next_clip_is_refused() {
    let root = tempfile::tempdir().unwrap();
    let mut video = new_video(&root.path().join("m"));
    let short = import_bundle(&mut video, root.path(), "short", 60, None);
    let long = import_bundle(&mut video, root.path(), "long", 120, None);
    let id = place_composition(&mut video, &short, 60, json!({}));
    let s = seq(&video);
    let next = json!({ "type": "text", "trackId": track(&video, "V1"), "span": { "fromFrame": 150, "durationFrames": 30 },
                       "text": "后面", "style": {} });
    let committed = apply(
        &mut video,
        "cmd_next",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": [next] })],
    )
    .unwrap();
    let next_id = committed.receipt.created_ids[0].clone();

    let before = video.revision();
    let err = apply(
        &mut video,
        "cmd_replace_long",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": long })],
    )
    .unwrap_err();
    assert_eq!(err.code, "TIMELINE_OVERLAP");
    assert!(err.entity_ids.contains(&id) && err.entity_ids.contains(&next_id));
    let recovery = err.recovery.clone().unwrap();
    assert!(recovery.contains("moveItem") && recovery.contains("deleteItems"), "{recovery}");
    assert_eq!(video.revision(), before);

    // After the later instances are moved away, the replacement can be made; the length becomes 120 frames.
    apply(
        &mut video,
        "cmd_move",
        vec![json!({ "type": "moveItem", "sequenceId": s, "itemId": next_id, "at": { "unit": "frames", "value": 200 }, "alignment": "exact-frame" })],
    )
    .unwrap();
    apply(
        &mut video,
        "cmd_replace_long_again",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": long })],
    )
    .unwrap();
    assert_eq!(composition(&video, &id).span.duration_frames, 120);
}

#[test]
fn only_composition_clips_and_bundle_assets_are_accepted() {
    let root = tempfile::tempdir().unwrap();
    let mut video = new_video(&root.path().join("m"));
    let rev1 = import_bundle(&mut video, root.path(), "rev1", 60, None);
    let id = place_composition(&mut video, &rev1, 60, json!({}));
    let s = seq(&video);
    let text = json!({ "type": "text", "trackId": track(&video, "V1"), "span": { "fromFrame": 0, "durationFrames": 30 },
                       "text": "标题", "style": {} });
    let text_id = apply(
        &mut video,
        "cmd_text",
        vec![json!({ "type": "insertItems", "sequenceId": s, "items": [text] })],
    )
    .unwrap()
    .receipt
    .created_ids[0]
        .clone();
    let logo = root.path().join("logo.svg");
    fs::write(&logo, "<svg xmlns=\"http://www.w3.org/2000/svg\"/>").unwrap();
    let image = apply(
        &mut video,
        "cmd_logo",
        vec![json!({ "type": "importAsset", "path": logo, "ref": "logo" })],
    )
    .unwrap()
    .receipt
    .refs["logo"]
        .clone();
    let image = json!({ "id": image, "revision": "1" });

    let before = video.revision();
    let cases = [
        // Not a composition instance.
        json!({ "type": "replaceCodeBundle", "itemId": text_id, "assetRef": rev1 }),
        // The asset is not a code bundle.
        json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": image }),
        // The stand-in is not a video.
        json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": rev1, "prerender": image }),
        // The parameters are not an object.
        json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": rev1, "parameterValues": [] }),
    ];
    for (n, op) in cases.into_iter().enumerate() {
        let err = apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).unwrap_err();
        assert_eq!(err.code, "INVALID_OPERATION", "case {n}: {}", err.message);
    }
    // The version does not exist.
    let err = apply(
        &mut video,
        "cmd_missing",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": { "id": rev1["id"], "revision": "9" } })],
    )
    .unwrap_err();
    assert_eq!(err.code, "ASSET_MISSING");
    assert_eq!(video.revision(), before);

    // A locked clip cannot be replaced.
    apply(
        &mut video,
        "cmd_lock",
        vec![json!({ "type": "updateItem", "itemId": id, "locked": true })],
    )
    .unwrap();
    let err = apply(
        &mut video,
        "cmd_locked",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": rev1 })],
    )
    .unwrap_err();
    assert_eq!(err.code, "TARGET_LOCKED");
}

#[test]
fn changed_parameter_schema_needs_new_parameter_values() {
    let root = tempfile::tempdir().unwrap();
    let mut video = new_video(&root.path().join("m"));
    let rev1 = import_bundle(&mut video, root.path(), "rev1", 60, Some("params-v1.json"));
    let no_schema = import_bundle(&mut video, root.path(), "rev2", 60, None);
    let other_schema = import_bundle(&mut video, root.path(), "rev3", 60, Some("params-v2.json"));
    let id = place_composition(&mut video, &rev1, 60, json!({ "title": "你好" }));

    let before = video.revision();
    for (n, target) in [&no_schema, &other_schema].into_iter().enumerate() {
        let err = apply(
            &mut video,
            &format!("cmd_gate_{n}"),
            vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": target })],
        )
        .unwrap_err();
        assert_eq!(err.code, "INVALID_OPERATION");
        assert_eq!(err.details["rule"], "parameters-incompatible");
    }
    assert_eq!(video.revision(), before);

    // The replacement can be made when new parameters are given at the same time.
    apply(
        &mut video,
        "cmd_with_values",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": other_schema, "parameterValues": { "headline": "新的" } })],
    )
    .unwrap();
    assert_eq!(composition(&video, &id).parameter_values, json!({ "headline": "新的" }));

    // A clip with no parameters is not subject to this restriction.
    let plain = import_bundle(&mut video, root.path(), "rev4", 30, Some("params-v1.json"));
    apply(
        &mut video,
        "cmd_clear",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": plain, "parameterValues": {} })],
    )
    .unwrap();
    apply(
        &mut video,
        "cmd_no_values",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": no_schema })],
    )
    .unwrap();
}

/// A 2-second, 30 fps video (60 frames), used as a pre-rendered stand-in.
fn prerender_clip(dir: &Path) -> Option<PathBuf> {
    let path = dir.join("prerender.mp4");
    let ok = Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=160x90:rate=30:duration=2",
            "-c:v",
            "mpeg4",
        ])
        .arg(&path)
        .output()
        .is_ok_and(|o| o.status.success());
    if !ok {
        eprintln!("skipping: no usable ffmpeg to generate test media");
        return None;
    }
    Some(path)
}

#[test]
fn the_prerender_sets_the_new_length() {
    let root = tempfile::tempdir().unwrap();
    let Some(clip) = prerender_clip(root.path()) else { return };
    let mut video = new_video(&root.path().join("m"));
    let rev1 = import_bundle(&mut video, root.path(), "rev1", 120, None);
    // The manifest says 120 frames, but the stand-in has only 60: the stand-in's length wins.
    let rev2 = import_bundle(&mut video, root.path(), "rev2", 120, None);
    let id = place_composition(&mut video, &rev1, 120, json!({}));
    let prerender = apply(
        &mut video,
        "cmd_pr",
        vec![json!({ "type": "importAsset", "path": clip, "ref": "pr" })],
    )
    .unwrap()
    .receipt
    .refs["pr"]
        .clone();
    let prerender = json!({ "id": prerender, "revision": "1" });
    let committed = apply(
        &mut video,
        "cmd_replace",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": rev2, "prerender": prerender })],
    )
    .unwrap();
    let after = composition(&video, &id);
    assert_eq!(serde_json::to_value(after.prerender.as_ref().unwrap()).unwrap(), prerender);
    assert_eq!(after.span.duration_frames, 60);
    let impact = serde_json::to_value(&committed.receipt.impact).unwrap();
    assert_eq!(impact["codeEdits"][0]["newDurationFrames"], 60);
    assert_eq!(impact["codeEdits"][0]["prerender"], prerender);

    // `prerender: null` removes the stand-in, and the length goes back to the manifest's intrinsic.
    apply(
        &mut video,
        "cmd_drop_prerender",
        vec![json!({ "type": "replaceCodeBundle", "itemId": id, "assetRef": rev2, "prerender": null })],
    )
    .unwrap();
    let after = composition(&video, &id);
    assert_eq!((after.prerender, after.span.duration_frames), (None, 120));
}
