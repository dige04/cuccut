//! How one frame is assembled: background, layer order, placement, cropping, mirroring and opacity, output scaling, every transition (two-sided and one-sided), and how things that cannot be drawn are refused or skipped (never drawn as blank).

mod common;

use common::*;
use frame_render::{Documents, FrameRenderer, RenderOptions};
use serde_json::{Value, json};

/// Two full-canvas image assets, `a_a` and `a_b`.
fn two_images() -> Vec<(String, Value)> {
    vec![image_asset("a_a", W, H), image_asset("a_b", W, H)]
}

#[test]
fn background_is_the_sequence_colour() {
    let red = video(
        vec![],
        vec![],
        json!({ "canvas": { "width": W, "height": H, "workingSpace": "srgb", "background": "#FF0000" } }),
    );
    near(px(&render(&red, 0.0, &mut Media::default()), 3, 3), RED, 0);
    // A background color that cannot be read is treated as black.
    let odd = video(
        vec![],
        vec![],
        json!({ "canvas": { "width": W, "height": H, "workingSpace": "srgb", "background": "nope" } }),
    );
    near(px(&render(&odd, 0.0, &mut Media::default()), 3, 3), BLACK, 0);
}

#[test]
fn layers_follow_place_opacity_crop_order_and_mirror() {
    let assets = || vec![image_asset("a_a", 16, 9), image_asset("a_b", 16, 9)];
    let media = || Media::default().with("a", solid(16, 9, RED)).with("b", halves(16, 9, RED, BLUE));
    // Centered picture-in-picture, half the width.
    let pip = video(vec![image("a", 0, 0, 30, json!({ "place": { "w": 50 } }))], assets(), json!({}));
    let frame = render(&pip, 0.0, &mut media());
    near(px(&frame, 80, 45), RED, 2);
    near(px(&frame, 30, 45), BLACK, 0);
    near(px(&frame, 130, 45), BLACK, 0);
    // Opacity 0.5 over a black background.
    let half = video(
        vec![image("a", 0, 0, 30, json!({ "mode": "fullscreen", "place": { "opacity": 0.5 } }))],
        assets(),
        json!({}),
    );
    near(px(&render(&half, 0.0, &mut media()), 10, 10), [128, 0, 0, 255], 2);
    // Keep only the right half of the source. After filling, the whole picture is blue.
    let cropped = video(
        vec![image(
            "b",
            0,
            0,
            30,
            json!({ "mode": "fullscreen", "crop": { "left": 0.5, "top": 0, "right": 0, "bottom": 0 } }),
        )],
        assets(),
        json!({}),
    );
    let frame = render(&cropped, 0.0, &mut media());
    near(px(&frame, 20, 10), BLUE, 2);
    near(px(&frame, 140, 80), BLUE, 2);
    // Layers drawn later cover layers drawn earlier (same track, by paintOrder).
    let stacked = video(
        vec![
            image("b", 0, 0, 30, json!({ "mode": "fullscreen" })),
            image("a", 1, 0, 30, json!({ "place": { "x": 25, "y": 50, "w": 50 } })),
        ],
        assets(),
        json!({}),
    );
    let frame = render(&stacked, 0.0, &mut media());
    near(px(&frame, 40, 45), RED, 2);
    near(px(&frame, 140, 45), BLUE, 2);
    // Horizontal mirror.
    let mirrored = video(
        vec![image("b", 0, 0, 30, json!({ "mode": "fullscreen", "place": { "flipX": true } }))],
        assets(),
        json!({}),
    );
    let frame = render(&mirrored, 0.0, &mut media());
    near(px(&frame, 10, 45), BLUE, 2);
    near(px(&frame, 150, 45), RED, 2);
}

#[test]
fn output_scales_from_the_sequence_canvas() {
    // Sequence canvas 160×90, output 320×180: the same picture-in-picture lands at double size.
    let pip = video(
        vec![image("a", 0, 0, 30, json!({ "place": { "x": 75, "y": 75, "w": 50 } }))],
        vec![image_asset("a_a", 16, 9)],
        json!({}),
    );
    let mut big = FrameRenderer::new(
        RenderOptions {
            width: 2 * W,
            height: 2 * H,
            skip_unsupported: false,
            captions: true,
        },
        Documents::default(),
        fonts(),
    )
    .unwrap();
    let plan = plan(&pip, 0.0);
    let mut media = Media::default().with("a", solid(16, 9, RED));
    let frame = big
        .render(render_graph::VideoView::from(&pip), &plan, 0.0, &mut media)
        .unwrap()
        .to_vec();
    let at = |x: u32, y: u32| -> [u8; 4] { frame[((y * 2 * W + x) * 4) as usize..][..4].try_into().unwrap() };
    near(at(240, 135), RED, 2);
    near(at(80, 45), BLACK, 0);
}

/// A [0, 30) followed by B [30, 60), with a 20-frame two-sided transition in between (window [20, 40)). Draws frame `frame`.
fn two_sided(kind: &str, params: Value, frame: f64, a: tiny_skia::Pixmap, b: tiny_skia::Pixmap, b_body: Value) -> Vec<u8> {
    let mut b_item = full_image("b", 0, 30, 30);
    if let (Some(item), Value::Object(extra)) = (b_item.as_object_mut(), b_body) {
        item.extend(extra);
    }
    let video = video(
        vec![full_image("a", 0, 0, 30), b_item],
        two_images(),
        json!({ "transitions": [transition("tr", Some("a"), Some("b"), kind, params, 20)] }),
    );
    let mut media = Media::default().with("a", a).with("b", b);
    render(&video, at(frame), &mut media)
}

fn red() -> tiny_skia::Pixmap {
    solid(W, H, RED)
}

fn blue() -> tiny_skia::Pixmap {
    solid(W, H, BLUE)
}

#[test]
fn dissolve_and_dip_to_colour() {
    // Progress 0.25: A is fully drawn, and B is laid over it at 0.25.
    near(
        px(&two_sided("dissolve", json!({}), 25.0, red(), blue(), json!({})), 80, 45),
        [191, 0, 64, 255],
        2,
    );
    let green = json!({ "color": "#00FF00" });
    let dip = |frame: f64| px(&two_sided("dip-to-color", green.clone(), frame, red(), blue(), json!({})), 5, 5);
    near(dip(25.0), [128, 128, 0, 255], 2);
    near(dip(30.0), [0, 255, 0, 255], 2);
    near(dip(35.0), [0, 128, 128, 255], 2);
}

#[test]
fn push_moves_both_sides() {
    // A is red on the left and yellow on the right; B is blue. Pushed left halfway: A has moved left by half a canvas, so the left half is A's right half (yellow) and the right half is B.
    let frame = two_sided(
        "push",
        json!({ "direction": "left" }),
        30.0,
        halves(W, H, RED, YELLOW),
        blue(),
        json!({}),
    );
    near(px(&frame, 20, 45), YELLOW, 2);
    near(px(&frame, 140, 45), BLUE, 2);
}

#[test]
fn wipe_slide_zoom_and_iris_follow_the_incoming_box() {
    // Progress 0.5, B fills the canvas: the wipe reveals half from the box's left edge;
    let frame = two_sided("wipe", json!({}), 30.0, red(), blue(), json!({}));
    near(px(&frame, 20, 45), BLUE, 2);
    near(px(&frame, 140, 45), RED, 2);
    // B mirrored horizontally reveals from the right (the box's own local left edge);
    let frame = two_sided("wipe", json!({}), 30.0, red(), blue(), json!({ "place": { "flipX": true } }));
    near(px(&frame, 20, 45), RED, 2);
    near(px(&frame, 140, 45), BLUE, 2);
    // The slide moves in from the left by half along the box's x axis, while fading in by 0.5;
    let frame = two_sided("slide", json!({}), 30.0, red(), blue(), json!({}));
    near(px(&frame, 20, 45), [128, 0, 128, 255], 2);
    near(px(&frame, 140, 45), RED, 2);
    // The zoom shrinks around the box center to 0.875, while fading in by 0.5;
    let frame = two_sided("zoom", json!({}), 30.0, red(), blue(), json!({}));
    near(px(&frame, 80, 45), [128, 0, 128, 255], 2);
    near(px(&frame, 2, 2), RED, 2);
    // The iris is a circle with radius half of the half-diagonal.
    let frame = two_sided("iris", json!({}), 30.0, red(), blue(), json!({}));
    near(px(&frame, 80, 45), BLUE, 2);
    near(px(&frame, 2, 2), RED, 2);
    near(px(&frame, 158, 88), RED, 2);
}

#[test]
fn wipe_on_a_rotated_pip_reveals_along_its_own_axis() {
    // B is a picture-in-picture rotated 90°: the box's local left edge is at the top. Halfway through the reveal, the top half shows and the bottom half does not yet.
    let video = video(
        vec![
            full_image("a", 0, 0, 30),
            image("b", 0, 30, 30, json!({ "place": { "x": 50, "y": 50, "w": 40, "rot": 90 } })),
        ],
        vec![image_asset("a_a", W, H), image_asset("a_b", 100, 100)],
        json!({ "transitions": [transition("tr", Some("a"), Some("b"), "wipe", json!({}), 20)] }),
    );
    let mut media = Media::default().with("a", red()).with("b", solid(100, 100, BLUE));
    let frame = render(&video, at(30.0), &mut media);
    // Box 64×64 centered: the top half (local left half) is blue, and the bottom half is still A.
    near(px(&frame, 80, 25), BLUE, 2);
    near(px(&frame, 80, 65), RED, 2);
}

#[test]
fn single_sided_transitions_reveal_lower_layers() {
    let video = |role: &str| {
        let (left, right) = if role == "in" { (None, Some("top")) } else { (Some("top"), None) };
        video(
            vec![full_image("under", 0, 0, 90), full_image("top", 1, 0, 60)],
            vec![image_asset("a_under", W, H), image_asset("a_top", W, H)],
            json!({ "transitions": [transition("tr", left, right, "dissolve", json!({}), 20)] }),
        )
    };
    let media = || Media::default().with("under", blue()).with("top", red());
    // Entry (window [0, 20)) halfway: the upper, semi-transparent layer sits over the layer below.
    near(px(&render(&video("in"), at(10.0), &mut media()), 9, 9), [128, 0, 128, 255], 2);
    // Exit (window [40, 60)) at progress 0.25: by the reverse process, 3/4 remains.
    near(px(&render(&video("out"), at(45.0), &mut media()), 9, 9), [191, 0, 64, 255], 2);
    // One-sided wipe: the entry reveals half, and where nothing has been revealed, the layer below shows.
    let wipe = video_with_kind("wipe");
    let frame = render(&wipe, at(10.0), &mut media());
    near(px(&frame, 20, 45), RED, 2);
    near(px(&frame, 140, 45), BLUE, 2);
}

fn video_with_kind(kind: &str) -> video_model::VideoSnapshot {
    video(
        vec![full_image("under", 0, 0, 90), full_image("top", 1, 0, 60)],
        vec![image_asset("a_under", W, H), image_asset("a_top", W, H)],
        json!({ "transitions": [transition("tr", None, Some("top"), kind, json!({}), 20)] }),
    )
}

#[test]
fn unknown_transitions_are_refused_or_cut() {
    let video = video(
        vec![full_image("a", 0, 0, 30), full_image("b", 0, 30, 30)],
        two_images(),
        json!({ "transitions": [transition("tr", Some("a"), Some("b"), "vendor.spin", json!({ "turns": 2 }), 20)] }),
    );
    let media = || Media::default().with("a", red()).with("b", blue());
    let error = try_render(&mut renderer(false, Documents::default()), &video, at(25.0), &mut media()).unwrap_err();
    assert_eq!(error.code, "EXPORT_UNSUPPORTED_CONTENT");
    assert_eq!(
        (error.items[0].scope, error.items[0].reason.as_str(), error.items[0].kind.as_deref()),
        ("transition", "transition-unknown-kind", Some("vendor.spin"))
    );
    // Skipped, so a hard cut: before the cut point only A is drawn, and after it only B. Both sides report the same item.
    let mut skipping = renderer(true, Documents::default());
    near(px(&render_with(&mut skipping, &video, at(25.0), &mut media()), 80, 45), RED, 2);
    near(px(&render_with(&mut skipping, &video, at(35.0), &mut media()), 80, 45), BLUE, 2);
    assert_eq!(skipping.skipped().len(), 1);
}

#[test]
fn layers_the_plan_cannot_draw_are_refused_or_skipped_never_blank() {
    // Code-package composition without a pre-rendered stand-in: the whole layer is not drawn, and the reason and description are reported.
    let video = video(
        vec![
            full_image("a", 0, 0, 30),
            item(
                "bundle",
                1,
                30,
                json!({
                    "type": "composition", "source": { "kind": "bundle", "assetRef": { "id": "a_a", "revision": "rev_1" } },
                    "parameterValues": {},
                    "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
                    "place": { "w": 50 }
                }),
            ),
        ],
        vec![image_asset("a_a", W, H)],
        json!({}),
    );
    let media = || Media::default().with("a", red());
    let error = try_render(&mut renderer(false, Documents::default()), &video, 0.0, &mut media()).unwrap_err();
    assert_eq!(error.code, "EXPORT_UNSUPPORTED_CONTENT");
    assert_eq!(
        (
            error.items[0].item_id.as_str(),
            error.items[0].scope,
            error.items[0].reason.as_str()
        ),
        ("bundle", "layer", "bundle-without-prerender")
    );
    assert!(!error.items[0].message.is_empty());
    let mut skipping = renderer(true, Documents::default());
    let frame = render_with(&mut skipping, &video, 0.0, &mut media());
    near(px(&frame, 80, 45), RED, 2);
    assert_eq!(skipping.skipped()[0].reason, "bundle-without-prerender");
}

#[test]
fn layers_whose_source_was_skipped_are_left_out() {
    // When the side that fetches the picture says this layer has no picture (it has already recorded the undecodable asset in the skip list), the whole layer is not drawn, rather than drawn as an empty placeholder frame.
    let video = video(vec![full_image("a", 0, 0, 30)], vec![image_asset("a_a", W, H)], json!({}));
    let frame = render(&video, 0.0, &mut Media::default());
    assert_eq!(painted(&frame), 0);
}
