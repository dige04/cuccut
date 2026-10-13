//! Property editing: geometry, style, text, kind parameters, element animation, keyframes, template layers, caption style, clips and video settings. All are validated operations;
//! there is no arbitrary Patch; the applicable scope and values of fields are validated by the v2 element model (`timeline`).

#![allow(clippy::result_large_err)]

use std::path::{Path, PathBuf};

use editor_semantics::Rate;
use serde_json::{Value, json};
use video_engine::model::{Actor, ActorKind, KeyframeProperty, Place, TimelineItem};
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

fn item<'m>(video: &'m Video, id: &str) -> &'m TimelineItem {
    &video.state().items[id].value
}

fn find(video: &Video, pick: impl Fn(&TimelineItem) -> bool) -> String {
    video
        .state()
        .items
        .values()
        .find(|i| pick(&i.value))
        .unwrap()
        .value
        .base()
        .id
        .clone()
}

fn place_of(video: &Video, id: &str) -> Place {
    item(video, id).place().cloned().expect("visual item")
}

struct Fixture {
    video: Video,
    seq: String,
    text: String,
    shape: String,
    progress: String,
    caption: String,
    _dir: tempfile::TempDir,
}

/// A text, a shape, a progress bar and a caption; no media, so no ffprobe needed.
fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let mut video = new_video(&dir.path().join("m"));
    let s = seq(&video);
    apply(
        &mut video,
        "cmd_setup",
        vec![
            json!({ "type": "addTrack", "sequenceId": s, "kind": "subtitle" }),
            json!({ "type": "addTrack", "sequenceId": s, "kind": "visual" }),
            json!({ "type": "putDocument", "kind": "caption", "body": { "cues": [] } }),
        ],
    )
    .unwrap();
    let doc = video.state().documents.keys().next().unwrap().clone();
    let (v1, v2) = (track(&video, "V1"), track(&video, "V2"));
    let items = json!([
        { "type": "text", "trackId": v1, "span": { "fromFrame": 0, "durationFrames": 60 }, "place": { "x": 25, "y": 25, "w": 50 },
          "text": "标题", "style": { "fontSize": 64 } },
        { "type": "shape", "trackId": v1, "span": { "fromFrame": 60, "durationFrames": 30 },
          "shape": { "shape": "rect", "fill": "#FFD646" } },
        { "type": "progress", "trackId": v2, "span": { "fromFrame": 0, "durationFrames": 90 }, "place": { "y": 95, "w": 100 },
          "progress": { "style": "bar" } },
        { "type": "caption", "trackId": track(&video, "S1"), "span": { "fromFrame": 0, "durationFrames": 90 }, "documentId": doc },
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
        caption: find(&video, |i| matches!(i, TimelineItem::Caption(_))),
        seq: s,
        video,
        _dir: dir,
    }
}

#[test]
fn set_transform_changes_only_the_given_place_fields_and_bumps_the_sequence_revision() {
    let Fixture {
        mut video,
        seq: s,
        text,
        shape,
        ..
    } = fixture();
    // An omitted place is stored as an empty object, and the geometry takes the per-kind default.
    assert_eq!(place_of(&video, &shape), Place::default());

    let op = json!({ "type": "setTransform", "itemId": text, "x": 40.5, "rot": -30, "flipX": true });
    let committed = apply(&mut video, "cmd_move", vec![op]).unwrap();
    assert_eq!(committed.receipt.label, "Adjust position and size");
    let p = place_of(&video, &text);
    assert_eq!(
        (p.x, p.y, p.w, p.rot, p.flip_x, p.flip_y),
        (Some(40.5), Some(25.0), Some(50.0), Some(-30.0), true, false)
    );
    assert_eq!(video.snapshot().sequences[&s].revision, video.revision(), "changing a clip also changes the sequence");

    // null removes the field and reverts to the default.
    let reset = apply(
        &mut video,
        "cmd_reset",
        vec![json!({ "type": "setTransform", "itemId": text, "w": null })],
    )
    .unwrap();
    assert_eq!(place_of(&video, &text).w, None);

    // Not a number, an instance with no picture, an instance from another sequence, or the old layout-box fields: all rejected.
    let before = video.revision();
    let caption = find(&video, |i| matches!(i, TimelineItem::Caption(_)));
    for (n, op) in [
        json!({ "type": "setTransform", "itemId": text, "x": "左" }),
        json!({ "type": "setTransform", "itemId": caption, "x": 1 }),
        json!({ "type": "setTransform", "itemId": text, "sequenceId": "seq_other", "x": 1 }),
        json!({ "type": "setTransform", "itemId": text, "width": 100 }),
    ]
    .into_iter()
    .enumerate()
    {
        assert!(apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).is_err(), "case {n}");
    }
    assert_eq!(video.revision(), before);

    undo(&mut video, "cmd_undo_reset", &reset);
    undo(&mut video, "cmd_undo", &committed);
    let p = place_of(&video, &text);
    assert_eq!((p.x, p.rot, p.flip_x), (Some(25.0), None, false));
}

#[test]
fn style_text_and_props_go_to_the_matching_item_kinds() {
    let Fixture {
        mut video,
        text,
        shape,
        progress,
        ..
    } = fixture();
    let style = json!({ "fontSize": 48, "fontColor": "#FF0000", "glow": { "on": true } });
    apply(
        &mut video,
        "cmd_style",
        vec![
            json!({ "type": "setStyle", "itemId": text, "opacity": 0.5, "style": style, "verticalAlign": "bottom" }),
            json!({ "type": "setStyle", "itemId": shape, "shape": { "shape": "ellipse", "fill": "#00FF00" }, "radius": 12 }),
            json!({ "type": "setText", "itemId": text, "text": "新标题\n第二行" }),
            json!({ "type": "setProps", "itemId": progress, "props": { "style": "bar", "mainColor": "#FF0000", "endProgress": 0.5 } }),
        ],
    )
    .unwrap();
    let TimelineItem::Text(t) = item(&video, &text) else { panic!() };
    assert_eq!(
        (t.place.opacity, t.text.as_deref(), t.style.as_ref(), t.vertical_align.as_deref()),
        (Some(0.5), Some("新标题\n第二行"), Some(&style), Some("bottom"))
    );
    let TimelineItem::Shape(sh) = item(&video, &shape) else { panic!() };
    assert_eq!((sh.shape.shape.as_str(), sh.place.radius), ("ellipse", Some(12.0)));
    let TimelineItem::Progress(p) = item(&video, &progress) else {
        panic!()
    };
    assert_eq!(
        (p.progress.main_color.as_deref(), p.progress.end_progress),
        (Some("#FF0000"), Some(0.5))
    );

    // A timer is another kind of text content: counter replaces text.
    apply(
        &mut video,
        "cmd_counter",
        vec![json!({ "type": "setText", "itemId": text, "counter": { "mode": "countdown", "format": "mm:ss" } })],
    )
    .unwrap();
    let TimelineItem::Text(t) = item(&video, &text) else { panic!() };
    assert!(t.text.is_none() && t.counter.is_some());

    let before = video.revision();
    let cases = [
        json!({ "type": "setStyle", "itemId": shape, "style": {} }),
        json!({ "type": "setStyle", "itemId": text, "shape": { "shape": "rect" } }),
        json!({ "type": "setStyle", "itemId": text, "style": "粗体" }),
        json!({ "type": "setStyle", "itemId": text, "fit": "cover" }),
        json!({ "type": "setStyle", "itemId": shape, "bg": "blur" }),
        json!({ "type": "setStyle", "itemId": shape, "mask": { "shape": "circle" } }),
        json!({ "type": "setStyle", "itemId": shape, "tile": { "on": true } }),
        json!({ "type": "setStyle", "itemId": text, "verticalAlign": "middle" }),
        json!({ "type": "setStyle", "itemId": text }),
        json!({ "type": "setStyle", "itemId": text, "backdrop": "blur" }),
        json!({ "type": "setText", "itemId": shape, "text": "x" }),
        json!({ "type": "setText", "itemId": text }),
        json!({ "type": "setText", "itemId": text, "text": "x", "counter": { "mode": "countup" } }),
        json!({ "type": "setText", "itemId": text, "text": "字".repeat(10_001) }),
        json!({ "type": "setProps", "itemId": text, "props": { "style": "bar" } }),
        json!({ "type": "setProps", "itemId": progress, "props": { "style": "bar", "endProgress": 2 } }),
        json!({ "type": "setProps", "itemId": progress, "props": { "style": "bar", "speed": 2 } }),
        json!({ "type": "setProps", "itemId": shape, "props": [] }),
        json!({ "type": "setCodeParameters", "itemId": text, "values": {} }),
        json!({ "type": "setStyle", "itemId": text, "style": { "pad": "x".repeat(70_000) } }),
    ];
    for (n, op) in cases.into_iter().enumerate() {
        let err = apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).unwrap_err();
        assert_eq!(err.code, "INVALID_OPERATION", "case {n}");
    }
    assert_eq!(video.revision(), before);
}

#[test]
fn animation_keyframes_and_template_layers_are_checked_by_the_element_model() {
    let Fixture {
        mut video,
        seq: s,
        text,
        shape,
        caption,
        ..
    } = fixture();
    let animate = json!({ "enter": { "preset": "fade", "dur": 0.5 }, "loop": { "preset": "pulse", "period": 1.0 } });
    let keyframes = json!([{ "localFrame": 0, "value": 0.0 }, { "localFrame": 30, "value": 1.0, "ease": "easeOutQuad" }]);
    let template = json!({ "id": "tpl_1", "name": "片头条", "layers": [] });
    let committed = apply(
        &mut video,
        "cmd_motion",
        vec![
            json!({ "type": "setAnimation", "itemId": text, "animate": animate }),
            json!({ "type": "setKeyframes", "itemId": shape, "property": "opacity", "keyframes": keyframes }),
            json!({ "type": "setTemplate", "sequenceId": s, "template": template }),
        ],
    )
    .unwrap();
    assert_eq!(committed.receipt.label, "Set animation and more (3 changes)");
    assert_eq!(serde_json::to_value(item(&video, &text).animate().unwrap()).unwrap(), animate);
    let header = &video.snapshot().sequences[&s].header;
    let binding = &header.animation_bindings[0];
    assert_eq!(
        (binding.target_id.as_str(), binding.property_path, binding.keyframes.len()),
        (shape.as_str(), KeyframeProperty::Opacity, 2)
    );
    assert!(header.template.is_some());

    // Writing the same property again replaces it; null removes it.
    apply(
        &mut video,
        "cmd_kf_again",
        vec![json!({ "type": "setKeyframes", "itemId": shape, "property": "opacity", "keyframes": [{ "percent": 50, "value": 0.5 }] })],
    )
    .unwrap();
    assert_eq!(video.snapshot().sequences[&s].header.animation_bindings.len(), 1);

    let before = video.revision();
    let cases = [
        // Not in the preset table.
        json!({ "type": "setAnimation", "itemId": text, "animate": { "enter": { "preset": "no-such-preset" } } }),
        // The loop slot has no stagger.
        json!({ "type": "setAnimation", "itemId": text, "animate": { "loop": { "preset": "pulse", "stagger": 0.1 } } }),
        json!({ "type": "setAnimation", "itemId": caption, "animate": { "enter": { "preset": "fade" } } }),
        // Times not increasing, two notations mixed, no picture, or corner-radius keyframes used on a shape.
        json!({ "type": "setKeyframes", "itemId": shape, "property": "x", "keyframes": [{ "localFrame": 10, "value": 1 }, { "localFrame": 5, "value": 2 }] }),
        json!({ "type": "setKeyframes", "itemId": shape, "property": "x", "keyframes": [{ "localFrame": 1, "percent": 5, "value": 1 }] }),
        json!({ "type": "setKeyframes", "itemId": caption, "property": "x", "keyframes": [{ "localFrame": 0, "value": 1 }] }),
        json!({ "type": "setKeyframes", "itemId": shape, "property": "radius", "keyframes": [{ "localFrame": 0, "value": 1 }] }),
        json!({ "type": "setKeyframes", "itemId": shape, "property": "volume", "keyframes": [{ "localFrame": 0, "value": 1 }] }),
        json!({ "type": "setTemplate", "sequenceId": s, "template": { "id": "tpl_1", "name": " ", "layers": [] } }),
    ];
    for (n, op) in cases.into_iter().enumerate() {
        assert!(apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).is_err(), "case {n}");
    }
    assert_eq!(video.revision(), before);

    // Deleting an instance also removes its keyframe bindings.
    apply(&mut video, "cmd_delete", vec![json!({ "type": "deleteItems", "itemIds": [shape] })]).unwrap();
    assert!(video.snapshot().sequences[&s].header.animation_bindings.is_empty());
}

#[test]
fn caption_style_documents_are_switched_by_reference() {
    let Fixture {
        mut video, caption, text, ..
    } = fixture();
    let body = json!({ "schema": "cuccut.legacy-studio-style/0.1", "style": { "fontSize": 40, "y": 86 } });
    apply(
        &mut video,
        "cmd_style_doc",
        vec![
            json!({ "type": "putDocument", "kind": "caption-style", "name": "字幕样式", "ref": "look", "body": body }),
            json!({ "type": "setCaptionStyle", "itemId": caption, "styleDocument": { "ref": "look" } }),
        ],
    )
    .unwrap();
    let style_doc = video
        .state()
        .documents
        .values()
        .find(|d| d.kind == "caption-style")
        .unwrap()
        .id
        .clone();
    let TimelineItem::Caption(c) = item(&video, &caption) else {
        panic!()
    };
    assert_eq!(c.style_document_id.as_deref(), Some(style_doc.as_str()));

    // Can only be replaced with a caption-style document, and only on caption instances.
    let caption_doc = c.document_id.clone();
    let wrong_kind = json!({ "type": "setCaptionStyle", "itemId": caption, "styleDocument": { "documentId": caption_doc } });
    assert_eq!(
        apply(&mut video, "cmd_kind", vec![wrong_kind]).unwrap_err().code,
        "INVALID_OPERATION"
    );
    let not_caption = json!({ "type": "setCaptionStyle", "itemId": text, "styleDocument": { "documentId": style_doc } });
    assert_eq!(
        apply(&mut video, "cmd_text", vec![not_caption]).unwrap_err().code,
        "INVALID_OPERATION"
    );
    let missing = json!({ "type": "setCaptionStyle", "itemId": caption, "styleDocument": { "documentId": "doc_none" } });
    assert_eq!(
        apply(&mut video, "cmd_missing", vec![missing]).unwrap_err().code,
        "ENTITY_NOT_FOUND"
    );
}

#[test]
fn boxed_caption_styles_only_take_catalogue_animations() {
    let Fixture { mut video, .. } = fixture();
    let boxed = |preset: Value| {
        json!({ "type": "putDocument", "kind": "caption-style", "name": "字幕样式", "body": {
            "schema": "cuccut.boxed-caption-style/18", "canvas": { "width": 1920, "height": 1080 },
            "box": { "x": 0, "y": 432, "width": 1574, "height": 216 },
            "style": { "fontSize": 43, "animationPresetId": preset },
        } })
    };
    // Ids from the per-word animation catalog are accepted; other ids and other types are rejected, and the whole edit is not committed.
    apply(&mut video, "cmd_reveal", vec![boxed(json!("reveal"))]).unwrap();
    let before = video.revision();
    for (n, preset) in [json!("typewriter"), json!(7), json!(null)].into_iter().enumerate() {
        let error = apply(&mut video, &format!("cmd_bad_preset_{n}"), vec![boxed(preset)]).unwrap_err();
        assert_eq!(error.code, "INVALID_OPERATION");
        assert!(error.message.contains("animationPresetId"), "{}", error.message);
    }
    assert_eq!(video.revision(), before);
}

#[test]
fn locked_items_only_accept_unlocking() {
    let Fixture { mut video, text, .. } = fixture();
    apply(
        &mut video,
        "cmd_lock",
        vec![json!({ "type": "updateItem", "itemId": text, "name": "  片头  ", "enabled": false, "locked": true })],
    )
    .unwrap();
    let base = item(&video, &text).base();
    assert_eq!((base.name.as_deref(), base.enabled, base.locked), (Some("片头"), false, true));

    for (n, op) in [
        json!({ "type": "setText", "itemId": text, "text": "x" }),
        json!({ "type": "setTransform", "itemId": text, "x": 1 }),
        json!({ "type": "setAnimation", "itemId": text, "animate": null }),
        json!({ "type": "updateItem", "itemId": text, "enabled": true }),
    ]
    .into_iter()
    .enumerate()
    {
        assert_eq!(
            apply(&mut video, &format!("cmd_locked_{n}"), vec![op]).unwrap_err().code,
            "TARGET_LOCKED"
        );
    }

    // Other fields can be changed at the same time as unlocking; an empty name clears the name.
    apply(
        &mut video,
        "cmd_unlock",
        vec![json!({ "type": "updateItem", "itemId": text, "locked": false, "name": "", "enabled": true })],
    )
    .unwrap();
    let base = item(&video, &text).base();
    assert_eq!((base.name.as_deref(), base.enabled, base.locked), (None, true, false));
}

#[test]
fn canvas_changes_keep_percent_geometry_and_take_a_hex_background() {
    let Fixture {
        mut video, seq: s, text, ..
    } = fixture();
    let before = place_of(&video, &text);
    let committed = apply(
        &mut video,
        "cmd_canvas",
        vec![json!({ "type": "updateSequence", "sequenceId": s, "name": "竖版",
                     "canvas": { "width": 1080, "height": 1920 }, "background": "#ff8800" })],
    )
    .unwrap();
    assert_eq!(committed.receipt.label, "Edit video settings");
    let header = &video.snapshot().sequences[&s].header;
    assert_eq!(
        (header.name.as_str(), header.canvas.width, header.canvas.height),
        ("竖版", 1080, 1920)
    );
    assert_eq!(header.canvas.background, "#FF8800");
    // Geometry is stored as percentages of the frame, so changing the canvas does not require rewriting it.
    assert_eq!(place_of(&video, &text), before);

    let revision = video.revision();
    for (n, op) in [
        json!({ "type": "updateSequence", "sequenceId": s, "canvas": { "width": 0, "height": 1080 } }),
        json!({ "type": "updateSequence", "sequenceId": s, "canvas": { "width": 20000, "height": 1080 } }),
        json!({ "type": "updateSequence", "sequenceId": s, "canvas": { "width": 1080, "height": 1080, "layout": "keep" } }),
        json!({ "type": "updateSequence", "sequenceId": s, "background": "red" }),
        json!({ "type": "updateSequence", "sequenceId": s, "background": { "color": "#000000", "alpha": 1 } }),
        json!({ "type": "updateSequence", "sequenceId": s }),
    ]
    .into_iter()
    .enumerate()
    {
        assert_eq!(
            apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).unwrap_err().code,
            "INVALID_OPERATION",
            "case {n}"
        );
    }
    assert_eq!(video.revision(), revision);

    undo(&mut video, "cmd_undo", &committed);
    let header = &video.snapshot().sequences[&s].header;
    assert_eq!((header.canvas.width, header.canvas.background.as_str()), (1920, "#000000"));
}

#[test]
fn opacity_and_mask_feather_take_the_spec_ranges() {
    let Fixture {
        mut video,
        seq: s,
        text,
        shape,
        ..
    } = fixture();
    // The composition instance has a mask; the code package is a temporary directory, so no ffprobe is needed.
    let bundle = tempfile::tempdir().unwrap();
    std::fs::write(bundle.path().join("index.html"), "<html></html>").unwrap();
    apply(
        &mut video,
        "cmd_bundle",
        vec![json!({ "type": "importAsset", "path": bundle.path(), "storage": "linked",
                    "bundle": { "engine": "browser", "entry": "index.html" } })],
    )
    .unwrap();
    let asset_id = video.state().assets.keys().next().unwrap().clone();
    let v2 = track(&video, "V2");
    let composition = |feather: f64| {
        json!({
            "type": "composition", "trackId": v2, "span": { "fromFrame": 90, "durationFrames": 30 },
            "place": { "x": 50, "y": 50, "w": 100 }, "mask": { "shape": "ellipse", "feather": feather },
            "source": { "kind": "bundle", "assetRef": { "id": asset_id, "revision": "1" } }, "parameterValues": {},
            "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
        })
    };
    apply(
        &mut video,
        "cmd_ok",
        vec![
            json!({ "type": "setStyle", "itemId": text, "opacity": 0 }),
            json!({ "type": "setStyle", "itemId": shape, "opacity": 1 }),
            json!({ "type": "insertItems", "sequenceId": s, "items": [composition(12.0)] }),
        ],
    )
    .unwrap();

    let before = video.revision();
    let cases = [
        json!({ "type": "setStyle", "itemId": text, "opacity": 1.5 }),
        json!({ "type": "setStyle", "itemId": shape, "opacity": -0.1 }),
        json!({ "type": "setKeyframes", "itemId": shape, "property": "opacity", "keyframes": [{ "localFrame": 0, "value": 1.5 }] }),
        json!({ "type": "insertItems", "sequenceId": s, "items": [composition(-1.0)] }),
    ];
    for (n, op) in cases.into_iter().enumerate() {
        let err = apply(&mut video, &format!("cmd_bad_{n}"), vec![op]).unwrap_err();
        assert_eq!(err.code, "INVALID_OPERATION", "case {n}: {}", err.message);
    }
    assert_eq!(video.revision(), before);
}
