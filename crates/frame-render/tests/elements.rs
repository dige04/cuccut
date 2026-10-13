//! The pixels each kind of picture instance draws: placement, cropping, opacity, the order of `fx`, masks and tiling, element animation and keyframes, and text, shapes and each generator.

mod common;

use common::*;
use serde_json::{Value, json};

fn matrix_bounds(m: [f64; 6]) -> (f64, f64, f64, f64) {
    let [a, b, c, d, e, f] = m;
    let xs = [e, e + a, e + c, e + a + c];
    let ys = [f, f + b, f + d, f + b + d];
    let min = |v: [f64; 4]| v.iter().copied().fold(f64::INFINITY, f64::min);
    let max = |v: [f64; 4]| v.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    (min(xs), min(ys), max(xs), max(ys))
}

#[test]
fn fullscreen_image_fills_the_canvas() {
    let video = video(
        vec![item(
            "img",
            0,
            30,
            json!({ "type": "image", "assetRef": { "id": "a_img", "revision": "rev_1" }, "place": {}, "mode": "fullscreen", "fit": "cover" }),
        )],
        vec![image_asset("a_img", 160, 90)],
        json!({}),
    );
    let mut media = Media::default().with("img", halves(160, 90, RED, BLUE));
    let frame = render(&video, 0.5, &mut media);
    near(px(&frame, 10, 45), RED, 2);
    near(px(&frame, 150, 45), BLUE, 2);
}

#[test]
fn cropped_pip_image_fills_the_planned_box() {
    // Top 40% cropped, leaving 160×54. The box height follows the kept aspect ratio (format spec §3.5).
    let video = video(
        vec![item(
            "img",
            0,
            30,
            json!({
                "type": "image", "assetRef": { "id": "a_img", "revision": "rev_1" },
                "place": { "x": 50, "y": 50, "w": 50 }, "mode": "pip", "fit": "cover",
                "crop": { "left": 0, "top": 0.4, "right": 0, "bottom": 0 }
            }),
        )],
        vec![image_asset("a_img", 160, 90)],
        json!({}),
    );
    let plan = plan(&video, 0.5);
    let (x0, y0, x1, y1) = matrix_bounds(plan.layers[0].matrix);
    assert!(
        (x1 - x0 - 80.0).abs() < 1e-6 && (y1 - y0 - 27.0).abs() < 1e-6,
        "{x0} {y0} {x1} {y1}"
    );
    let mut media = Media::default().with("img", solid(160, 90, GREEN));
    let frame = render(&video, 0.5, &mut media);
    let (bx0, by0, bx1, by1) = painted_bounds(&frame).unwrap();
    assert!(
        (f64::from(bx0) - x0).abs() <= 1.0 && (f64::from(bx1 + 1) - x1).abs() <= 1.0,
        "{bx0}..{bx1} vs {x0}..{x1}"
    );
    assert!(
        (f64::from(by0) - y0).abs() <= 1.0 && (f64::from(by1 + 1) - y1).abs() <= 1.0,
        "{by0}..{by1} vs {y0}..{y1}"
    );
}

#[test]
fn text_is_drawn_with_its_opacity() {
    let video = video(
        vec![item(
            "title",
            0,
            30,
            json!({
                "type": "text", "text": "HHHH", "style": { "fontSize": 60, "color": "#FFFFFF" },
                "place": { "x": 50, "y": 50, "w": 90, "opacity": 0.5 }
            }),
        )],
        vec![],
        json!({}),
    );
    let frame = render(&video, 0.5, &mut Media::default());
    assert!(painted(&frame) > 100, "文字要画出来");
    let brightest = frame.chunks_exact(4).map(|p| p[0]).max().unwrap();
    assert!((120..=136).contains(&brightest), "半透明的白字最亮 ≈ 128，实际 {brightest}");
}

/// A red picture-in-picture image (16×9) placed in the middle of the canvas, 50% wide: box 80×45, top-left corner at (40, 22.5).
fn red_pip(body: serde_json::Value) -> video_model::VideoSnapshot {
    let mut value = image("a", 0, 0, 90, json!({ "place": { "w": 50 } }));
    if let (Some(item), serde_json::Value::Object(extra)) = (value.as_object_mut(), body) {
        item.extend(extra);
    }
    video(vec![value], vec![image_asset("a_a", 16, 9)], json!({}))
}

fn red_media() -> Media {
    Media::default().with("a", solid(16, 9, RED))
}

#[test]
fn video_items_draw_the_picture_at_the_planned_source_time() {
    let video = video(
        vec![video_item(
            "v",
            "a_v",
            0,
            60,
            json!({ "timeMap": {
                "kind": "linear", "sourceIn": { "ticks": "2", "timescale": 1 }, "rate": { "num": 1, "den": 1 }
            } }),
        )],
        vec![video_asset("a_v", W, H)],
        json!({}),
    );
    let plan = plan(&video, 0.5);
    assert!((plan.layers[0].source_seconds.unwrap() - 2.5).abs() < 1e-9);
    let frame = render(&video, 0.5, &mut Media::default().with("v", solid(W, H, GREEN)));
    near(px(&frame, 80, 45), GREEN, 2);
    near(px(&frame, 2, 2), GREEN, 2);
}

#[test]
fn shapes_fill_stroke_and_round_their_corners() {
    let shape = |props: serde_json::Value| {
        video(
            vec![item("s", 0, 30, json!({ "type": "shape", "shape": props, "place": { "w": 50 } }))],
            vec![],
            json!({}),
        )
    };
    let filled = shape(json!({ "shape": "rect", "fill": "#FF0000" }));
    let (x0, y0, x1, y1) = matrix_bounds(plan(&filled, 0.0).layers[0].matrix);
    let (cx, cy) = (((x0 + x1) / 2.0) as u32, ((y0 + y1) / 2.0) as u32);
    let frame = render(&filled, 0.0, &mut Media::default());
    near(px(&frame, cx, cy), RED, 2);
    near(px(&frame, x0 as u32 + 1, y0 as u32 + 1), RED, 2);
    near(px(&frame, x0 as u32 - 3, cy), BLACK, 0);
    // Stroke only: the edge is white and the middle is not filled.
    let frame = render(
        &shape(json!({ "shape": "rect", "stroke": "#FFFFFF", "strokeWidth": 30 })),
        0.0,
        &mut Media::default(),
    );
    assert!(px(&frame, x0 as u32 + 1, cy)[0] > 200);
    near(px(&frame, cx, cy), BLACK, 0);
    // Rounded corners: the corners are empty, and the middle of each edge is still filled.
    let frame = render(
        &shape(json!({ "shape": "rect", "fill": "#FF0000", "cornerRadius": [150, 150, 150, 150] })),
        0.0,
        &mut Media::default(),
    );
    near(px(&frame, x0 as u32 + 1, y0 as u32 + 1), BLACK, 8);
    near(px(&frame, cx, y0 as u32 + 1), RED, 2);
    // Ellipse: the box corners are empty and the center is filled.
    let frame = render(&shape(json!({ "shape": "ellipse", "fill": "#0000FF" })), 0.0, &mut Media::default());
    near(px(&frame, cx, cy), BLUE, 2);
    near(px(&frame, x0 as u32 + 1, y0 as u32 + 1), BLACK, 8);
}

#[test]
fn colour_fx_run_in_the_fixed_order_before_opacity() {
    // Desaturated: gray.
    let frame = render(&red_pip(json!({ "fx": { "saturation": -1 } })), 0.5, &mut red_media());
    let [r, g, b, _] = px(&frame, 80, 45);
    assert!(r.abs_diff(g) <= 3 && g.abs_diff(b) <= 3 && r > 20, "{r} {g} {b}");
    // Desaturate first (step 6), then warm (step 8): the gray is tinted warm, red > green > blue. The reverse order would give pure gray.
    let frame = render(
        &red_pip(json!({ "fx": { "saturation": -1, "temperature": 1 } })),
        0.5,
        &mut red_media(),
    );
    let [r, g, b, _] = px(&frame, 80, 45);
    assert!(r > g && g > b, "{r} {g} {b}");
    // Darken first, then multiply by opacity.
    let dim = px(
        &render(&red_pip(json!({ "fx": { "brightness": -0.5 } })), 0.5, &mut red_media()),
        80,
        45,
    )[0];
    let dim_half = px(
        &render(
            &red_pip(json!({ "fx": { "brightness": -0.5 }, "place": { "w": 50, "opacity": 0.5 } })),
            0.5,
            &mut red_media(),
        ),
        80,
        45,
    )[0];
    assert!(dim < 230 && dim > 20, "{dim}");
    assert!((i32::from(dim_half) - i32::from(dim) / 2).abs() <= 3, "{dim_half} vs {dim}");
}

#[test]
fn blur_softens_the_source_edges() {
    let video = video(
        vec![image("a", 0, 0, 30, json!({ "mode": "fullscreen", "fx": { "blur": 40 } }))],
        vec![image_asset("a_a", W, H)],
        json!({}),
    );
    let frame = render(&video, 0.0, &mut Media::default().with("a", halves(W, H, RED, BLUE)));
    let mid = px(&frame, 80, 45);
    assert!(mid[0] > 40 && mid[2] > 40, "{mid:?}");
    let far = px(&frame, 10, 45);
    assert!(far[0] > 200 && far[2] < 60, "{far:?}");
}

#[test]
fn stroke_and_shadow_sit_around_and_under_the_layer() {
    // Stroke: a green ring just outside the box, while the inside stays red.
    let frame = render(
        &red_pip(json!({ "fx": { "stroke": { "width": 20, "color": "#00FF00" } } })),
        0.5,
        &mut red_media(),
    );
    near(px(&frame, 80, 45), RED, 2);
    let ring = px(&frame, 38, 45);
    assert!(ring[1] > 150 && ring[0] < 100, "{ring:?}");
    near(px(&frame, 5, 5), BLACK, 0);
    // Drop shadow: a white shadow offset to the lower right, drawn beneath the layer.
    let frame = render(
        &red_pip(json!({ "fx": { "shadow": { "offsetX": 60, "offsetY": 60, "blur": 0, "color": "#FFFFFF", "opacity": 1 } } })),
        0.5,
        &mut red_media(),
    );
    near(px(&frame, 80, 45), RED, 2);
    let shadow = px(&frame, 125, 72);
    assert!(shadow[0] > 200 && shadow[1] > 200, "{shadow:?}");
    near(px(&frame, 35, 18), BLACK, 0);
}

#[test]
fn stroke_and_shadow_offsets_follow_the_canvas_not_the_rotation() {
    // A red box rotated 30°, with drop shadow offsetX 60 (540 short side) = exactly 10 pixels to the right on the canvas, not blurred. Where the layer does not cover it, the shadow's brightness is exactly the coverage of the layer 10 pixels to the left. If the offset followed the instance's rotation, it would land at (8.66, 5), which would not match.
    let rotated = |fx: Value| red_pip(json!({ "place": { "w": 50, "rot": 30 }, "fx": fx }));
    let plain = render(&rotated(json!({})), 0.5, &mut red_media());
    let shadowed = render(
        &rotated(json!({ "shadow": { "offsetX": 60, "offsetY": 0, "blur": 0, "color": "#FFFFFF", "opacity": 1 } })),
        0.5,
        &mut red_media(),
    );
    let mut solid_shadow = 0;
    for y in 0..H {
        for x in 10..W {
            if px(&plain, x, y)[0] != 0 {
                continue;
            }
            let coverage = px(&plain, x - 10, y)[0];
            let [r, g, b, _] = px(&shadowed, x, y);
            for channel in [r, g, b] {
                assert!(
                    (i32::from(channel) - i32::from(coverage)).abs() <= 2,
                    "({x}, {y}) 处 {channel} ≠ 覆盖度 {coverage}"
                );
            }
            solid_shadow += usize::from(coverage == 255);
        }
    }
    assert!(solid_shadow > 100, "只露出投影的像素太少：{solid_shadow}");
    // The stroke follows the outline after rotation: for a box rotated 90°, the left edge is at x = 57.5 and green hugs it. The unrotated left edge (x = 38) is black.
    let frame = render(
        &red_pip(json!({ "place": { "w": 50, "rot": 90 }, "fx": { "stroke": { "width": 20, "color": "#00FF00" } } })),
        0.5,
        &mut red_media(),
    );
    let ring = px(&frame, 55, 45);
    assert!(ring[1] > 150 && ring[0] < 100, "{ring:?}");
    near(px(&frame, 38, 45), BLACK, 0);
    near(px(&frame, 80, 45), RED, 2);
}

#[test]
fn ellipse_masks_cut_the_box_corners() {
    let frame = render(&red_pip(json!({ "mask": { "shape": "ellipse" } })), 0.5, &mut red_media());
    near(px(&frame, 80, 45), RED, 2);
    near(px(&frame, 41, 24), BLACK, 8);
}

#[test]
fn tiled_media_repeat_across_the_canvas() {
    // Tiling is a diagonally staggered grid (with gaps between stamps), so instead of checking one pixel, check whether each of the four quadrants contains red. When not tiled, a box 20% wide sits only in the middle of the canvas, and none of the four corner quadrants reach it.
    let quadrants = |frame: &[u8]| {
        let mut red = [0usize; 4];
        for y in 0..90usize {
            for x in 0..160usize {
                let at = (y * 160 + x) * 4;
                if frame[at] > 200 && frame[at + 1] < 60 && (x < 40 || x >= 120 || y < 20 || y >= 70) {
                    red[usize::from(x >= 80) + 2 * usize::from(y >= 45)] += 1;
                }
            }
        }
        red
    };
    let single = render(&red_pip(json!({ "place": { "w": 20 } })), 0.5, &mut red_media());
    assert_eq!(quadrants(&single), [0; 4]);
    let tiled = render(
        &red_pip(json!({ "place": { "w": 20 }, "tile": { "on": true } })),
        0.5,
        &mut red_media(),
    );
    let red = quadrants(&tiled);
    assert!(red.iter().all(|&n| n > 100), "{red:?}");
}

#[test]
fn enter_exit_and_loop_slots_animate_the_layer() {
    let still = render(&red_pip(json!({})), 0.1, &mut red_media());
    let fading = render(
        &red_pip(json!({ "animate": { "enter": { "preset": "fade", "dur": 1.0 } } })),
        0.1,
        &mut red_media(),
    );
    assert!(px(&fading, 80, 45)[0] < px(&still, 80, 45)[0] - 30, "入场淡入还没完成");
    let settled = render(
        &red_pip(json!({ "animate": { "enter": { "preset": "fade", "dur": 1.0 } } })),
        1.5,
        &mut red_media(),
    );
    near(px(&settled, 80, 45), RED, 2);
    let leaving = render(
        &red_pip(json!({ "animate": { "exit": { "preset": "fade", "dur": 1.0 } } })),
        2.9,
        &mut red_media(),
    );
    assert!(px(&leaving, 80, 45)[0] < 200, "出场淡出");
    let looping = red_pip(json!({ "animate": { "loop": { "preset": "rotate" } } }));
    assert_ne!(
        render(&looping, 0.2, &mut red_media()),
        render(&looping, 0.7, &mut red_media()),
        "循环动画让不同时刻的画面不同"
    );
}

#[test]
fn keyframe_bindings_drive_place_fields() {
    let bound = |property: &str, from: f64, to: f64| {
        let mut video = red_pip(json!({}));
        let binding: video_model::AnimationBinding = serde_json::from_value(json!({
            "id": "kf", "targetId": "a", "propertyPath": property,
            "keyframes": [{ "localFrame": 0, "value": from }, { "localFrame": 60, "value": to }]
        }))
        .unwrap();
        video.sequences.get_mut("seq").unwrap().header.animation_bindings.push(binding);
        video
    };
    // Opacity 0 → 1: at frame 30 it is about half.
    let frame = render(&bound("opacity", 0.0, 1.0), 1.0, &mut red_media());
    let r = px(&frame, 80, 45)[0];
    assert!((100..=160).contains(&r), "{r}");
    // x moves from 25% to 75%: the box starts on the left and ends on the right.
    let start = render(&bound("x", 25.0, 75.0), 0.0, &mut red_media());
    let end = render(&bound("x", 25.0, 75.0), 2.0, &mut red_media());
    near(px(&start, 40, 45), RED, 2);
    near(px(&start, 120, 45), BLACK, 0);
    near(px(&end, 120, 45), RED, 2);
}

#[test]
fn text_styles_reach_the_pixels() {
    let video = video(
        vec![item(
            "title",
            0,
            30,
            json!({
                "type": "text", "text": "HHHH",
                "style": { "fontSize": 60, "fontColor": "#FF0000", "background": true, "backgroundColor": "#0000FF" },
                "place": { "x": 50, "y": 50, "w": 90 }
            }),
        )],
        vec![],
        json!({}),
    );
    let frame = render(&video, 0.5, &mut Media::default());
    let reds = frame.chunks_exact(4).filter(|p| p[0] > 200 && p[1] < 60 && p[2] < 60).count();
    let blues = frame.chunks_exact(4).filter(|p| p[2] > 200 && p[0] < 60).count();
    assert!(reds > 20, "红字 {reds}");
    assert!(blues > 20, "蓝底板 {blues}");
}

/// A generated-type instance (`body` is the kind and fields), drawn at `seconds`.
fn generated(body: serde_json::Value, seconds: f64) -> (Vec<u8>, frame_render::FrameRenderer) {
    let mut value = item("g", 0, 90, json!({ "place": { "w": 60 } }));
    if let (Some(item), serde_json::Value::Object(extra)) = (value.as_object_mut(), body) {
        item.extend(extra);
    }
    let video = video(vec![value], vec![], json!({}));
    let mut renderer = renderer(false, frame_render::Documents::default());
    let frame = render_with(&mut renderer, &video, seconds, &mut Media::default());
    (frame, renderer)
}

#[test]
fn counters_count() {
    let body = json!({ "type": "text", "counter": { "mode": "countdown" }, "style": { "fontSize": 80 } });
    let (early, _) = generated(body.clone(), 0.2);
    let (late, _) = generated(body, 2.2);
    assert!(painted(&early) > 20 && painted(&late) > 20);
    assert_ne!(early, late, "3 → 1");
}

#[test]
fn progress_bars_fill_over_the_span() {
    let body = json!({ "type": "progress", "progress": { "style": "normal", "mainColor": "#FFFFFF" }, "place": { "y": 90, "w": 80 } });
    let (early, _) = generated(body.clone(), 0.3);
    let (late, _) = generated(body, 2.7);
    let white = |f: &[u8]| f.chunks_exact(4).filter(|p| p[0] > 200 && p[1] > 200 && p[2] > 200).count();
    assert!(white(&late) > white(&early) + 50, "{} → {}", white(&early), white(&late));
}

#[test]
fn visualizers_without_any_audio_draw_at_rest() {
    // No sound in the sequence: what is heard is silence, so it is drawn in its still look (every silent style still draws something), and no hint is reported.
    // For the placeholder and hint when asset spectra are missing, see `tests/spectrum.rs`.
    let (frame, renderer) = generated(
        json!({ "type": "visualizer", "visualizer": { "style": "bars", "mainColor": "#FFFFFF" } }),
        0.5,
    );
    assert!(painted(&frame) > 0, "静音时按静止的样子画");
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
    assert!(renderer.missing_spectra().is_empty());
}

#[test]
fn visualizers_follow_the_injected_spectrum_and_its_db_window() {
    let video = |max_db: f64| {
        video(
            vec![item(
                "g",
                0,
                90,
                json!({ "type": "visualizer", "place": { "w": 60 },
                        "visualizer": { "style": "bars", "mainColor": "#FFFFFF", "minDb": -80, "maxDb": max_db } }),
            )],
            vec![],
            json!({}),
        )
    };
    let mut media = Media::default();
    let (silent, _) = generated(
        json!({ "type": "visualizer", "visualizer": { "style": "bars", "mainColor": "#FFFFFF" } }),
        0.5,
    );
    // Low frequencies loud, high frequencies quiet: once the spectrum is fed in, it no longer looks static and no longer reports a hint.
    media
        .spectra
        .insert("g".into(), spectrum(30, |bin| if bin < 128 { 220 } else { 40 }));
    let mut renderer = renderer(false, frame_render::Documents::default());
    let loud = render_with(&mut renderer, &video(40.0), 0.5, &mut media);
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
    assert_ne!(loud, silent);
    // The dB window changed, so the spectrum is re-derived with the new window (the cache key carries the parameters): the same spectrum is shorter in a wider window.
    renderer.clear_reports();
    let wide = render_with(&mut renderer, &video(140.0), 0.5, &mut media);
    assert!(painted(&wide) < painted(&loud), "{} {}", painted(&wide), painted(&loud));
    // The host swapped the spectrum: after the cache is cleared, it follows the swap.
    media.spectra.insert("g".into(), spectrum(30, |_| 0));
    renderer.clear_spectra();
    let quiet = render_with(&mut renderer, &video(140.0), 0.5, &mut media);
    assert!(painted(&quiet) < painted(&wide));
}

#[test]
fn confetti_falls() {
    let body = json!({ "type": "confetti", "confetti": { "style": "pastel-fall", "seed": 7 }, "place": { "w": 100 } });
    let (a, _) = generated(body.clone(), 0.5);
    let (b, _) = generated(body, 1.0);
    assert!(painted(&a) > 0 && painted(&b) > 0);
    assert_ne!(a, b);
}

#[test]
fn draw_items_paint_their_strokes() {
    // Stroke points are canvas percentages (0..=100).
    let body = json!({ "type": "draw", "draw": {
        "brush": "round", "color": "#FFFFFF", "size": 8,
        "strokes": [{ "points": [[10, 50], [50, 20], [90, 50]] }]
    } });
    let (frame, _) = generated(body, 2.9);
    assert!(painted(&frame) > 30, "{}", painted(&frame));
}

#[test]
fn empty_placeholders_draw_their_slot() {
    let (frame, _) = generated(json!({ "type": "placeholder", "placeholder": { "variant": "camera" } }), 0.5);
    assert!(painted(&frame) > 30);
}

#[test]
fn filled_placeholders_draw_the_media() {
    let video = video(
        vec![item(
            "slot",
            0,
            30,
            json!({ "type": "placeholder", "placeholder": { "variant": "media" }, "place": { "w": 50 },
                    "assetRef": { "id": "a_img", "revision": "rev_1" } }),
        )],
        vec![image_asset("a_img", 16, 9)],
        json!({}),
    );
    let frame = render(&video, 0.5, &mut Media::default().with("slot", solid(16, 9, GREEN)));
    near(px(&frame, 80, 45), GREEN, 2);
}

#[test]
fn template_stickers_draw_their_vector() {
    let (frame, renderer) = generated(
        json!({ "type": "sticker", "sticker": { "source": "template", "templateId": "heart" } }),
        0.5,
    );
    assert!(painted(&frame) > 30, "{:?}", renderer.warnings());
}

#[test]
fn catalogue_entries_missing_from_the_core_are_refused() {
    // A catalog entry the kernel can only skip (third-party assets are not distributed): the whole layer is reported rather than drawn as blank.
    for (body, id) in [
        (
            json!({ "type": "sticker", "sticker": { "source": "template", "templateId": "vendor-star" } }),
            "vendor-star",
        ),
        (json!({ "type": "progress", "progress": { "style": "vendor-bar" } }), "vendor-bar"),
        (
            json!({ "type": "visualizer", "visualizer": { "style": "vendor-wave" } }),
            "vendor-wave",
        ),
        (json!({ "type": "confetti", "confetti": { "style": "vendor-rain" } }), "vendor-rain"),
        (json!({ "type": "shape", "shape": { "shape": "vendor-blob" } }), "vendor-blob"),
    ] {
        let mut value = item("g", 0, 90, json!({ "place": { "w": 60 } }));
        if let (Some(item), serde_json::Value::Object(extra)) = (value.as_object_mut(), body) {
            item.extend(extra);
        }
        let video = video(vec![value], vec![], json!({}));
        let error = try_render(
            &mut renderer(false, frame_render::Documents::default()),
            &video,
            0.5,
            &mut Media::default(),
        )
        .unwrap_err();
        assert_eq!(
            (error.items[0].scope, error.items[0].reason.as_str(), error.items[0].kind.as_deref()),
            ("layer", "preset-unknown", Some(id))
        );
    }
    // A sticker may omit its template. It likewise cannot be drawn, and reports 'not specified'.
    let video = video(
        vec![item(
            "g",
            0,
            90,
            json!({ "type": "sticker", "sticker": { "source": "template" }, "place": { "w": 60 } }),
        )],
        vec![],
        json!({}),
    );
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &video,
        0.5,
        &mut Media::default(),
    )
    .unwrap_err();
    assert_eq!(
        (error.items[0].reason.as_str(), error.items[0].kind.as_deref()),
        ("preset-missing", None)
    );
}

#[test]
fn image_stickers_draw_the_picture() {
    let video = video(
        vec![item(
            "st",
            0,
            30,
            json!({ "type": "sticker", "sticker": { "source": "asset" }, "place": { "w": 30 },
                    "assetRef": { "id": "a_img", "revision": "rev_1" } }),
        )],
        vec![image_asset("a_img", 10, 10)],
        json!({}),
    );
    let frame = render(&video, 0.5, &mut Media::default().with("st", solid(10, 10, BLUE)));
    near(px(&frame, 80, 45), BLUE, 2);
}

const LOTTIE: &[u8] = include_bytes!("../../render-raster/tests/fixtures/lottie/cases/shapes.json");

fn lottie_video() -> video_model::VideoSnapshot {
    video(
        vec![item(
            "lt",
            0,
            60,
            json!({ "type": "sticker", "sticker": { "source": "asset" }, "place": { "w": 60 },
                    "assetRef": { "id": "a_lottie", "revision": "rev_1" } }),
        )],
        vec![lottie_asset("a_lottie")],
        json!({}),
    )
}

#[test]
fn lottie_stickers_play_their_animation() {
    let mut media = Media::default();
    media.assets.insert("a_lottie".into(), LOTTIE.to_vec());
    let a = render(&lottie_video(), 0.1, &mut media);
    let b = render(&lottie_video(), 0.6, &mut media);
    assert!(painted(&a) > 30);
    assert_ne!(a, b);
}

const LOTTIE_IMAGE: &[u8] = include_bytes!("../../render-raster/tests/fixtures/lottie/cases/image-embedded.json");

fn lottie_with(fill_overrides: Value) -> video_model::VideoSnapshot {
    video(
        vec![item(
            "lt",
            0,
            60,
            json!({ "type": "sticker", "sticker": { "source": "asset", "fillOverrides": fill_overrides }, "place": { "w": 60 },
                    "assetRef": { "id": "a_lottie", "revision": "rev_1" } }),
        )],
        vec![lottie_asset("a_lottie")],
        json!({}),
    )
}

fn magenta(frame: &[u8]) -> usize {
    frame.chunks_exact(4).filter(|p| p[0] > 200 && p[1] < 60 && p[2] > 200).count()
}

#[test]
fn lottie_fill_overrides_recolour_flat_fills() {
    let mut media = Media::default();
    media.assets.insert("a_lottie".into(), LOTTIE.to_vec());
    let plain = render(&lottie_video(), 0.3, &mut media);
    assert_eq!(magenta(&plain), 0);
    // In the fixture, the pure orange (#FF4000) fill is swapped to magenta. The same asset's instance without recoloring is unchanged (variants are saved separately in a recolor table).
    let mut renderer = renderer(false, frame_render::Documents::default());
    let recoloured = render_with(&mut renderer, &lottie_with(json!({ "#FF4000": "#FF00FF" })), 0.3, &mut media);
    assert!(magenta(&recoloured) > 20, "换色之后要有品红，实际 {}", magenta(&recoloured));
    assert_eq!(render_with(&mut renderer, &lottie_with(json!({})), 0.3, &mut media), plain);
}

#[test]
fn lottie_embedded_images_are_drawn_and_external_ones_are_missing() {
    let mut media = Media::default();
    media.assets.insert("a_lottie".into(), LOTTIE_IMAGE.to_vec());
    let a = render(&lottie_video(), 0.1, &mut media);
    let b = render(&lottie_video(), 0.8, &mut media);
    assert!(painted(&a) > 30, "内嵌的位图要画出来");
    assert_ne!(a, b, "位图图层跟着关键帧动");
    // An image that gives only a path: the asset is just a JSON file, so it cannot be read.
    let mut external: Value = serde_json::from_slice(LOTTIE_IMAGE).unwrap();
    external["assets"][0]["e"] = json!(0);
    external["assets"][0]["u"] = json!("images/");
    external["assets"][0]["p"] = json!("img_0.png");
    media.assets.insert("a_lottie".into(), serde_json::to_vec(&external).unwrap());
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &lottie_video(),
        0.1,
        &mut media,
    )
    .unwrap_err();
    assert_eq!(
        (error.items[0].scope, error.items[0].reason.as_str()),
        ("asset", "lottie-asset-missing")
    );
    assert_eq!(
        frame_render::lottie_problem(&serde_json::to_vec(&external).unwrap()).unwrap().0,
        "lottie-asset-missing"
    );
    assert!(frame_render::lottie_problem(LOTTIE_IMAGE).is_none());
}

/// A `.lottie` archive: takes the animation from the manifest, and images are found inside the package. The embedded SVG is rasterized at its declared width and height. The sticker is 75% wide (120 px), so the 120×90 composition lands exactly 1:1 on output x 20–140.
#[test]
fn dotlottie_archives_draw_with_images_from_the_archive_and_svg_images() {
    let video = video(
        vec![item(
            "lt",
            0,
            60,
            json!({ "type": "sticker", "sticker": { "source": "asset" }, "place": { "w": 75 },
                    "assetRef": { "id": "a_lottie", "revision": "rev_1" } }),
        )],
        vec![dotlottie_asset("a_lottie")],
        json!({}),
    );
    let mut media = Media::default();
    media.assets.insert("a_lottie".into(), dotlottie_fixture());
    let start = render(&video, 0.0, &mut media);
    let reds = |frame: &[u8]| {
        let ys: Vec<u32> = (0..H)
            .filter(|&y| (0..W).any(|x| px(frame, x, y)[0] > 200 && px(frame, x, y)[1] < 60))
            .collect();
        (ys.first().copied(), ys.last().copied())
    };
    let greens = |frame: &[u8]| {
        let xs: Vec<u32> = (0..H)
            .flat_map(|y| (0..W).map(move |x| (x, y)))
            .filter(|&(x, y)| {
                let p = px(frame, x, y);
                p[1] > 150 && p[0] < 60 && p[2] < 140
            })
            .map(|(x, _)| x)
            .collect();
        (xs.len(), xs.iter().min().copied(), xs.iter().max().copied())
    };
    let (top, bottom) = reds(&start);
    assert!(top.is_some_and(|y| y.abs_diff(10) <= 1), "包里的 PNG 画在 (10,10) 起：{top:?}");
    assert!(bottom.is_some_and(|y| y.abs_diff(41) <= 1), "放大 4 倍（32 像素）：{bottom:?}");
    // The 6×6 green circle, declared as 24×24, is drawn starting at composition (80, 30): on the output it spans x 100–124, with an area of about π·12² ≈ 452.
    let (area, left, right) = greens(&start);
    assert!((380..520).contains(&area), "SVG 按声明的 24×24 光栅：{area}");
    assert!(
        left.is_some_and(|x| x.abs_diff(100) <= 1) && right.is_some_and(|x| x.abs_diff(123) <= 1),
        "{left:?}–{right:?}"
    );
    let later = render(&video, 0.5, &mut media);
    assert!(reds(&later).0.unwrap() > top.unwrap() + 10, "PNG 跟着关键帧往下移");

    // An image missing from the package: it is still `lottie-asset-missing`.
    let broken = stored_zip(&[(
        "animations/main.json",
        br#"{"v":"5","fr":30,"ip":0,"op":30,"w":8,"h":8,"assets":[{"id":"x","w":1,"h":1,"u":"images/","p":"x.png"}],"layers":[]}"#,
    )]);
    media.assets.insert("a_lottie".into(), broken.clone());
    let error = try_render(&mut renderer(false, frame_render::Documents::default()), &video, 0.1, &mut media).unwrap_err();
    assert_eq!(error.items[0].reason, "lottie-asset-missing");
    assert_eq!(frame_render::lottie_problem(&broken).unwrap().0, "lottie-asset-missing");
    assert!(frame_render::lottie_problem(&dotlottie_fixture()).is_none());
}

#[test]
fn unreadable_lottie_is_refused_or_skipped() {
    let mut media = Media::default();
    media.assets.insert("a_lottie".into(), b"{}".to_vec());
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &lottie_video(),
        0.1,
        &mut media,
    )
    .unwrap_err();
    assert_eq!(
        (error.items[0].scope, error.items[0].reason.as_str()),
        ("asset", "lottie-unreadable")
    );
    let mut missing = Media::default();
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &lottie_video(),
        0.1,
        &mut missing,
    )
    .unwrap_err();
    assert_eq!(error.items[0].reason, "lottie-asset-missing");
    let mut skipping = renderer(true, frame_render::Documents::default());
    assert_eq!(painted(&render_with(&mut skipping, &lottie_video(), 0.1, &mut media)), 0);
    assert_eq!(skipping.skipped()[0].reason, "lottie-unreadable");
}

#[test]
fn whiteboards_reveal_their_image() {
    let video = video(
        vec![item(
            "wb",
            0,
            90,
            json!({ "type": "whiteboard", "whiteboard": {}, "place": { "w": 60 },
                    "assetRef": { "id": "a_img", "revision": "rev_1" } }),
        )],
        vec![image_asset("a_img", 32, 18)],
        json!({}),
    );
    let mut picture = solid(32, 18, WHITE);
    for x in 4..28 {
        for y in 8..10 {
            let i = ((y * 32 + x) * 4) as usize;
            picture.data_mut()[i..i + 3].copy_from_slice(&[0, 0, 0]);
        }
    }
    let early = render(&video, 0.1, &mut Media::default().with("wb", picture.clone()));
    let late = render(&video, 2.9, &mut Media::default().with("wb", picture));
    assert!(painted(&late) > 30);
    assert_ne!(early, late, "白板按顺序画出来");
}

#[test]
fn prerendered_compositions_draw_their_stand_in() {
    let video = video(
        vec![item(
            "comp",
            0,
            30,
            json!({
                "type": "composition", "source": { "kind": "bundle", "assetRef": { "id": "a_bundle", "revision": "rev_1" } },
                "prerender": { "id": "a_v", "revision": "rev_1" }, "parameterValues": {},
                "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
                "place": {}
            }),
        )],
        vec![video_asset("a_v", W, H)],
        json!({}),
    );
    let frame = render(&video, 0.5, &mut Media::default().with("comp", solid(W, H, GREEN)));
    near(px(&frame, 80, 45), GREEN, 2);
}

#[test]
fn prerendered_compositions_have_no_backdrop_so_transparent_pixels_show_the_layer_below() {
    // A full-screen video (green) on the lower layer, and a full-canvas composition on the upper layer: the stand-in is semi-transparent on the left and red on the right. The composition has no `bg`. Full screen + contain does not pre-fill a black background, so the transparent left half shows the green below.
    let video = video(
        vec![
            video_item("clip", "a_clip", 0, 30, json!({})),
            item(
                "comp",
                1,
                30,
                json!({
                    "type": "composition", "source": { "kind": "bundle", "assetRef": { "id": "a_bundle", "revision": "rev_1" } },
                    "prerender": { "id": "a_v", "revision": "rev_1" }, "parameterValues": {},
                    "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
                    "place": {}
                }),
            ),
        ],
        vec![video_asset("a_clip", W, H), video_asset("a_v", W, H)],
        json!({}),
    );
    let mut media = Media::default()
        .with("clip", solid(W, H, GREEN))
        .with("comp", halves(W, H, [0, 0, 0, 0], RED));
    let frame = render(&video, 0.5, &mut media);
    near(px(&frame, 40, 45), GREEN, 2);
    near(px(&frame, 120, 45), RED, 2);
}

#[test]
fn template_layers_draw_from_the_sequence_template() {
    let video = video(
        vec![],
        vec![],
        json!({
            "durationPolicy": { "kind": "fixed", "frames": 90 },
            "template": { "id": "tpl", "name": "条", "layers": [
                { "id": "bar", "box": { "x": 0, "y": 90, "w": 100, "h": 10 }, "kind": "progress", "accent": "#FF0000", "track": "#0000FF" },
                { "id": "logo", "box": { "x": 2, "y": 4, "w": 20, "h": 12 }, "kind": "logo", "src": "text", "text": "T", "color": "#FFFFFF", "bg": "#00FF00" }
            ] }
        }),
    );
    let frame = render(&video, 1.5, &mut Media::default());
    // The progress bar is at the bottom: the part already passed on the left is the accent color, and the part not yet reached on the right is the base color.
    let left = px(&frame, 20, 86);
    let right = px(&frame, 140, 86);
    assert!(left[0] > 150 && left[2] < 100, "{left:?}");
    assert!(right[2] > 150 && right[0] < 100, "{right:?}");
    // The background color of a text logo.
    let logo = px(&frame, 6, 6);
    assert!(logo[1] > 150, "{logo:?}");
}

#[test]
fn image_logos_in_templates_are_refused() {
    let video = video(
        vec![],
        vec![],
        json!({
            "durationPolicy": { "kind": "fixed", "frames": 90 },
            "template": { "id": "tpl", "name": "条", "layers": [
                { "id": "logo", "box": { "x": 2, "y": 4, "w": 20, "h": 12 }, "kind": "logo", "src": { "file": "logo.png" }, "color": "#FFFFFF" }
            ] }
        }),
    );
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &video,
        0.5,
        &mut Media::default(),
    )
    .unwrap_err();
    assert_eq!(error.items[0].reason, "template-logo-image-not-supported");
}

/// An SVG with a solid fill: top half red, bottom half blue.
const FLAT_SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="5" fill="#FF0000"/><rect y="5" width="10" height="5" fill="#0000ff"/></svg>"##;

fn svg_sticker(fill_overrides: Value) -> video_model::VideoSnapshot {
    video(
        vec![item(
            "st",
            0,
            30,
            json!({ "type": "sticker", "sticker": { "source": "asset", "fillOverrides": fill_overrides }, "place": { "w": 30 },
                    "assetRef": { "id": "a_svg", "revision": "rev_1" } }),
        )],
        vec![svg_asset("a_svg", 10, 10)],
        json!({}),
    )
}

#[test]
fn svg_stickers_are_rasterised_from_their_bytes_and_recoloured() {
    let mut media = Media::default();
    media.assets.insert("a_svg".into(), FLAT_SVG.as_bytes().to_vec());
    // A 30% wide square in the middle of the frame: 48×48 px, top half red, bottom half blue.
    let plain = render(&svg_sticker(json!({})), 0.5, &mut media);
    near(px(&plain, 80, 35), RED, 2);
    near(px(&plain, 80, 55), BLUE, 2);
    // The keys of `fillOverrides` are source colors (case is normalized the same way), and only the matching group is swapped.
    let mut renderer = renderer(false, frame_render::Documents::default());
    let recoloured = render_with(&mut renderer, &svg_sticker(json!({ "#ff0000": "#00FF00" })), 0.5, &mut media);
    near(px(&recoloured, 80, 35), GREEN, 2);
    near(px(&recoloured, 80, 55), BLUE, 2);
    // In the same renderer, instances that are not recolored are unchanged (variants are saved separately in a recolor table).
    assert_eq!(render_with(&mut renderer, &svg_sticker(json!({})), 0.5, &mut media), plain);
}

#[test]
fn svg_images_use_the_kernel_raster_and_missing_bytes_are_refused() {
    let video = video(vec![full_image("im", 0, 0, 30)], vec![svg_asset("a_im", 10, 10)], json!({}));
    let mut media = Media::default();
    // Do not use the picture given by the UI: the SVG is drawn only from the asset bytes.
    media.pictures.insert("im".into(), solid(10, 10, YELLOW));
    let error = try_render(&mut renderer(false, frame_render::Documents::default()), &video, 0.5, &mut media).unwrap_err();
    assert_eq!(
        (error.items[0].scope, error.items[0].reason.as_str()),
        ("asset", "asset-undecodable")
    );
    media.assets.insert("a_im".into(), FLAT_SVG.as_bytes().to_vec());
    let frame = render(&video, 0.5, &mut media);
    near(px(&frame, 80, 20), RED, 2);
    near(px(&frame, 80, 70), BLUE, 2);
}

fn gif_sticker(mode: &str) -> video_model::VideoSnapshot {
    video(
        vec![item(
            "st",
            0,
            90,
            json!({ "type": "sticker", "sticker": { "source": "asset", "loop": mode }, "place": { "w": 30 },
                    "assetRef": { "id": "a_gif", "revision": "rev_1" } }),
        )],
        vec![gif_asset("a_gif", 8, 8)],
        json!({}),
    )
}

/// A renderer loaded only with the fallback font (Source Han Sans).
fn fallback_only_renderer() -> frame_render::FrameRenderer {
    frame_render::FrameRenderer::new(
        frame_render::RenderOptions {
            width: W,
            height: H,
            skip_unsupported: false,
            captions: true,
        },
        frame_render::Documents::default(),
        fonts()[..1].to_vec(),
    )
    .unwrap()
}

fn marker_title() -> video_model::VideoSnapshot {
    video(
        vec![item(
            "title",
            0,
            30,
            json!({
                "type": "text", "text": "HHHH", "style": { "fontSize": 60, "color": "#FFFFFF", "fontFamily": "Permanent Marker" },
                "place": { "x": 50, "y": 50, "w": 90 }
            }),
        )],
        vec![],
        json!({}),
    )
}

#[test]
fn gif_images_play_from_their_bytes_and_loop() {
    let video = video(vec![full_image("im", 0, 0, 90)], vec![gif_asset("a_im", 8, 8)], json!({}));
    let mut media = Media::default();
    // Do not use the picture given by the UI: the GIF is decoded only from the asset bytes.
    media.pictures.insert("im".into(), solid(8, 8, WHITE));
    media.assets.insert("a_im".into(), STRIPES_GIF.to_vec());
    let mut renderer = renderer(false, frame_render::Documents::default());
    // Frame table [0, 100) [100, 300) [300, 600) [600, 1000). After 1 second it starts again from the beginning.
    for (seconds, frame) in [(0.05, 0), (0.15, 1), (0.35, 2), (0.75, 3), (1.05, 0), (1.35, 2)] {
        let pixels = render_with(&mut renderer, &video, seconds, &mut media);
        near(px(&pixels, 80, 45), STRIPES[frame], 2);
    }
}

#[test]
fn gif_stickers_follow_their_loop_mode() {
    let mut media = Media::default();
    media.assets.insert("a_gif".into(), STRIPES_GIF.to_vec());
    for (mode, seconds, frame) in [
        ("loop", 1.15, 1),
        ("once", 0.15, 1),
        // Plays once and stops on the last frame.
        ("once", 1.5, 3),
        ("hold", 0.5, 0),
    ] {
        let pixels = render(&gif_sticker(mode), seconds, &mut media);
        near(px(&pixels, 80, 45), STRIPES[frame], 2);
    }
}

#[test]
fn gifs_that_cannot_animate_draw_their_first_frame() {
    // Frames with no hold: drawn from the first frame, with no hint.
    let still = frame_render::load_gif("still", &tiny_gif(3, 0)).unwrap();
    assert!(matches!(still, (frame_render::Gif::Still(_), None)));
    // Chinese characters in the file name must not make a zero duration be misjudged as exceeding the budget.
    let still = frame_render::load_gif("超过上限.gif", &tiny_gif(3, 0)).unwrap();
    assert!(matches!(still, (frame_render::Gif::Still(_), None)));
    // Frame count over the limit: drawn from the first frame, with a hint.
    let (gif, note) = frame_render::load_gif("big", &tiny_gif(frame_render::GIF_BUDGET.max_frames + 1, 1)).unwrap();
    assert!(matches!(gif, frame_render::Gif::Still(_)));
    assert!(note.unwrap().contains("drawing only the first frame"));
    assert!(matches!(
        frame_render::load_gif("small", &tiny_gif(3, 1)).unwrap(),
        (frame_render::Gif::Animated(_), None)
    ));

    let mut media = Media::default();
    media
        .assets
        .insert("a_gif".into(), tiny_gif(frame_render::GIF_BUDGET.max_frames + 1, 1));
    let mut renderer = renderer(false, frame_render::Documents::default());
    let pixels = render_with(&mut renderer, &gif_sticker("loop"), 0.5, &mut media);
    near(px(&pixels, 80, 45), RED, 2);
    assert!(renderer.warnings().iter().any(|w| w.detail.starts_with("st: GIF is too large")));
}

#[test]
fn unreadable_gifs_are_refused() {
    let mut media = Media::default();
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &gif_sticker("loop"),
        0.5,
        &mut media,
    )
    .unwrap_err();
    assert_eq!(error.items[0].reason, "asset-undecodable");
    media.assets.insert("a_gif".into(), b"GIF89a broken".to_vec());
    let error = try_render(
        &mut renderer(false, frame_render::Documents::default()),
        &gif_sticker("loop"),
        0.5,
        &mut media,
    )
    .unwrap_err();
    assert_eq!(error.items[0].reason, "asset-undecodable");
}

#[test]
fn text_in_a_missing_family_is_reported_on_every_frame_until_its_font_arrives() {
    let video = marker_title();
    let note = "title：字体 \"Permanent Marker\" 在当前字体库中不可用，将使用 Noto Sans SC fallback";
    let mut renderer = fallback_only_renderer();
    let fallback = render_with(&mut renderer, &video, 0.5, &mut Media::default());
    assert_eq!(renderer.missing_fonts(), vec!["Permanent Marker".to_string()]);
    assert!(renderer.warnings().iter().any(|w| w.detail == note), "{:?}", renderer.warnings());
    // Preview clears the reports on every frame. The kernel caches the laid-out text, so the next frame still reports it (consistent with export).
    renderer.clear_reports();
    assert!(renderer.missing_fonts().is_empty());
    let again = render_with(&mut renderer, &video, 0.6, &mut Media::default());
    assert_eq!(again, fallback);
    assert_eq!(renderer.missing_fonts(), vec!["Permanent Marker".to_string()]);
    assert!(renderer.warnings().iter().any(|w| w.detail == note), "{:?}", renderer.warnings());
    // The host sends fonts in: the missing-font reports already made are withdrawn (when export redraws this frame, no hint is left). Re-laid out with them, nothing is reported, and the drawing matches one that had this font from the start.
    renderer.add_fonts(vec![std::sync::Arc::new(
        include_bytes!("../../render-raster/assets/fonts/PermanentMarker-Regular.ttf").to_vec(),
    )]);
    assert!(renderer.missing_fonts().is_empty(), "{:?}", renderer.missing_fonts());
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
    let loaded = render_with(&mut renderer, &video, 0.5, &mut Media::default());
    assert!(renderer.missing_fonts().is_empty(), "{:?}", renderer.missing_fonts());
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
    assert_ne!(loaded, fallback, "换了字体，字形不同");
    let mut full = common::renderer(false, frame_render::Documents::default());
    assert_eq!(loaded, render_with(&mut full, &video, 0.5, &mut Media::default()));
}

#[test]
fn bundled_families_are_not_reported_missing() {
    let mut renderer = renderer(false, frame_render::Documents::default());
    render_with(&mut renderer, &marker_title(), 0.5, &mut Media::default());
    assert!(renderer.missing_fonts().is_empty());
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
}
