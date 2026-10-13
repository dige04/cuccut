//! The local font faces needed by the finished output: every picture layer in range is laid out with text, and families not in the kernel's bundled fonts are reported with their weight and italic style. The preview renderer records the same thing.

mod common;

use std::sync::Arc;

use common::*;
use frame_render::{Documents, FALLBACK_FAMILY, FrozenDocument, font_census, font_usage};
use render_graph::VideoView;
use render_graph::video_plan::plan_video;
use serde_json::json;

fn caption_documents() -> Vec<FrozenDocument> {
    vec![
        serde_json::from_value(json!({
            "documentId": "doc", "kind": "caption", "schema": "cuccut.caption/1", "lineKind": "original",
            "body": { "schema": "cuccut.caption/1", "clock": "sequence", "timescale": 1000, "cues": [
                { "id": "c0", "start": 0, "end": 1000, "text": "AB" },
                { "id": "c1", "start": 7000, "end": 8000, "text": "CD" },
            ] }
        }))
        .unwrap(),
        serde_json::from_value(json!({
            "documentId": "style", "kind": "caption-style", "schema": "cuccut.legacy-studio-style/0.1",
            "body": { "schema": "cuccut.legacy-studio-style/0.1",
                      "style": { "fontSize": 60, "fontFamily": "Caption Only Sans", "anim": { "name": "None" } } }
        }))
        .unwrap(),
    ]
}

fn census_video() -> video_model::VideoSnapshot {
    let text = |id: &str, from: i64, style: serde_json::Value| {
        let mut value = item(
            id,
            1,
            30,
            json!({ "type": "text", "text": "Hello", "style": style, "place": { "x": 50, "y": 50, "w": 90 } }),
        );
        value["span"]["fromFrame"] = json!(from);
        value
    };
    let mut caption = item(
        "cap",
        0,
        300,
        json!({ "type": "caption", "documentId": "doc", "styleDocumentId": "style", "scopeItemIds": [] }),
    );
    caption["trackId"] = json!("trk_s1");
    video(
        vec![
            // A bold weight present from the start and a light weight that appears much later: both must be reported.
            text(
                "early",
                0,
                json!({ "fontSize": 40, "fontFamily": "Nowhere Sans", "fontWeight": 700 }),
            ),
            text(
                "late",
                200,
                json!({ "fontSize": 40, "fontFamily": "Far Away Serif", "fontWeight": 300 }),
            ),
            // Families shipped with the kernel are not reported.
            text("bundled", 0, json!({ "fontSize": 40, "fontFamily": "Permanent Marker" })),
            caption,
        ],
        vec![],
        json!({}),
    )
}

#[test]
fn every_layer_in_the_range_reports_the_local_faces_it_names() {
    let video = census_video();
    let view = VideoView::from(&video);
    let overview = plan_video(view, "seq", None).unwrap();
    let frame = plan(&video, 0.0);
    let fonts: Vec<Arc<Vec<u8>>> = fonts().into_iter().map(Arc::new).collect();
    let faces = font_census(
        view,
        &frame,
        0.0,
        &overview.layers,
        Documents::new(caption_documents()),
        fonts.clone(),
        true,
    )
    .unwrap();
    assert_eq!(
        faces,
        vec![
            ("Caption Only Sans".to_string(), 400, false),
            ("Far Away Serif".to_string(), 300, false),
            ("Nowhere Sans".to_string(), 700, false),
        ]
    );
    // Captions are not laid out when they are not burned in.
    let faces = font_census(
        view,
        &frame,
        0.0,
        &overview.layers,
        Documents::new(caption_documents()),
        fonts,
        false,
    )
    .unwrap();
    assert!(faces.iter().all(|(family, ..)| family != "Caption Only Sans"), "{faces:?}");
}

#[test]
fn usage_lists_bundled_faces_too_and_marks_which_families_the_kernel_lacks() {
    let video = census_video();
    let view = VideoView::from(&video);
    let overview = plan_video(view, "seq", None).unwrap();
    let frame = plan(&video, 0.0);
    let fonts: Vec<Arc<Vec<u8>>> = fonts().into_iter().map(Arc::new).collect();
    let usage = font_usage(
        view,
        &frame,
        0.0,
        &overview.layers,
        Documents::new(caption_documents()),
        fonts,
        true,
    )
    .unwrap();
    assert!(
        usage.faces.contains(&("Permanent Marker".to_string(), 400, false)),
        "{:?}",
        usage.faces
    );
    assert!(usage.faces.contains(&("Nowhere Sans".to_string(), 700, false)), "{:?}", usage.faces);
    let missing: Vec<&str> = usage.missing.iter().map(String::as_str).collect();
    assert_eq!(missing, vec!["Caption Only Sans", "Far Away Serif", "Nowhere Sans"]);
    // The fallback family is the kernel's bundled CJK family: any glyphs it lacks are drawn by it.
    assert_eq!(FALLBACK_FAMILY, "Noto Sans SC");
}

#[test]
fn the_preview_renderer_logs_the_same_faces_as_it_draws() {
    let video = census_video();
    let mut renderer = renderer(false, Documents::new(caption_documents()));
    render_with(&mut renderer, &video, 0.2, &mut Media::default());
    let used = renderer.used_faces();
    assert!(used.contains(&("Nowhere Sans".to_string(), 700, false)), "{used:?}");
    assert!(used.contains(&("Caption Only Sans".to_string(), 400, false)), "{used:?}");
    assert!(used.contains(&("Permanent Marker".to_string(), 400, false)), "{used:?}");
    // A light weight that appears later is recorded when that frame draws it. The record is permanent (later frames that do not lay out text still keep it).
    assert!(!used.iter().any(|(family, ..)| family == "Far Away Serif"));
    renderer.clear_reports();
    render_with(&mut renderer, &video, at(205.0), &mut Media::default());
    assert!(renderer.used_faces().contains(&("Far Away Serif".to_string(), 300, false)));
    renderer.clear_reports();
    render_with(&mut renderer, &video, at(206.0), &mut Media::default());
    assert!(renderer.used_faces().contains(&("Nowhere Sans".to_string(), 700, false)));
}
