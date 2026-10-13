//! Captions: caption instances are handed to the kernel with the caption document and style document for typesetting and drawing. Glyphs come from the fonts shipped with the kernel, and pixel positions are not computed per glyph body. The tests check placement (anchor, box, top/bottom order), display timing, color, and the wording used when something cannot be drawn.

mod common;

use common::*;
use frame_render::{Documents, FrozenDocument};
use serde_json::{Value, json};

const STUDIO: &str = "cuccut.legacy-studio-style/0.1";

/// Caption document: `cues` are (start seconds, end seconds, text).
fn caption_doc(id: &str, clock: &str, cues: &[(f64, f64, &str)], line_kind: &str) -> FrozenDocument {
    serde_json::from_value(json!({
        "documentId": id, "kind": "caption", "schema": "cuccut.caption/1", "lineKind": line_kind,
        "body": {
            "schema": "cuccut.caption/1", "clock": clock, "timescale": 1000,
            "cues": cues.iter().enumerate().map(|(i, (s, e, t))| json!({
                "id": format!("c{i}"), "start": (s * 1000.0) as i64, "end": (e * 1000.0) as i64, "text": t
            })).collect::<Vec<_>>(),
        }
    }))
    .unwrap()
}

fn style_doc(id: &str, body: Value) -> FrozenDocument {
    serde_json::from_value(json!({
        "documentId": id, "kind": "caption-style", "schema": body.get("schema").cloned(), "body": body
    }))
    .unwrap()
}

fn studio(style: Value) -> Value {
    json!({ "schema": STUDIO, "style": style })
}

/// Caption instance: on the caption track, from frame 0 for `frames` frames.
fn caption(id: &str, document: &str, style: Option<&str>, frames: i64, scopes: &[&str]) -> Value {
    let mut value = item(
        id,
        0,
        frames,
        json!({ "type": "caption", "documentId": document, "scopeItemIds": scopes }),
    );
    value["trackId"] = json!("trk_s1");
    if let Some(style) = style {
        value["styleDocumentId"] = json!(style);
    }
    value
}

fn draw(documents: Vec<FrozenDocument>, items: Vec<Value>, seconds: f64) -> Vec<u8> {
    let video = video(items, vec![], json!({}));
    render_with(
        &mut renderer(false, Documents::new(documents)),
        &video,
        seconds,
        &mut Media::default(),
    )
}

/// `(count, average x, average y)` of the pixels that satisfy `pick`.
fn centroid(frame: &[u8], pick: impl Fn([u8; 4]) -> bool) -> (usize, f64, f64) {
    let (mut n, mut sx, mut sy) = (0usize, 0.0, 0.0);
    for y in 0..H {
        for x in 0..W {
            if pick(px(frame, x, y)) {
                n += 1;
                sx += f64::from(x);
                sy += f64::from(y);
            }
        }
    }
    (n, sx / n.max(1) as f64, sy / n.max(1) as f64)
}

fn whiteish(p: [u8; 4]) -> bool {
    p[0] > 160 && p[1] > 160 && p[2] > 160
}

fn reddish(p: [u8; 4]) -> bool {
    p[0] > 160 && p[1] < 90 && p[2] < 90
}

fn greenish(p: [u8; 4]) -> bool {
    p[1] > 120 && p[0] < 90 && p[2] < 90
}

#[test]
fn mixed_script_captions_render_like_explicitly_spaced_text() {
    for kind in ["original", "translation"] {
        for style in [None, Some(studio(json!({"punct": false}))), Some(studio(json!({"punct": true})))] {
            let render = |text: &str| {
                let mut docs = vec![caption_doc("d", "sequence", &[(0.0, 3.0, text)], kind)];
                if let Some(body) = &style {
                    docs.push(style_doc("s", body.clone()));
                }
                draw(docs, vec![caption("c", "d", style.as_ref().map(|_| "s"), 90, &[])], 1.0)
            };
            let actual = render("让Claude创建Artifact");
            assert!(painted(&actual) > 0);
            assert!(actual == render("让 Claude 创建 Artifact"), "{kind} {style:?}");
        }
    }
}

#[test]
fn studio_caption_draws_the_active_cue_at_the_anchor() {
    let documents = || {
        vec![
            caption_doc("doc", "sequence", &[(1.0, 2.0, "AB"), (5.0, 6.0, "。")], "original"),
            style_doc(
                "style",
                studio(json!({ "fontSize": 120, "anim": { "name": "None" }, "displayTiming": { "leadIn": 0.5, "tail": 1.0 } })),
            ),
        ]
    };
    let items = || vec![caption("cap", "doc", Some("style"), 240, &[])];
    // Default anchor (50%, 86%): the text sits in the lower part of the canvas, horizontally centered.
    let frame = draw(documents(), items(), 1.5);
    let (n, x, y) = centroid(&frame, whiteish);
    assert!(n > 20, "{n}");
    assert!((x - 80.0).abs() < 6.0, "{x}");
    assert!((y - 0.86 * 90.0).abs() < 6.0, "{y}");
    // Display timing: 0.5 seconds kept before, 1 second kept after.
    assert!(painted(&draw(documents(), items(), 0.6)) > 0);
    assert!(painted(&draw(documents(), items(), 2.9)) > 0);
    assert_eq!(painted(&draw(documents(), items(), 0.4)), 0);
    assert_eq!(painted(&draw(documents(), items(), 3.1)), 0);
    // A sentence that has nothing left after removing punctuation under the delivery style is not drawn.
    assert_eq!(painted(&draw(documents(), items(), 5.5)), 0);
    // When captions are not burned in, the caption layer is not drawn and nothing is reported as undrawable.
    let video = video(items(), vec![], json!({}));
    let mut off = frame_render::FrameRenderer::new(
        frame_render::RenderOptions {
            width: W,
            height: H,
            skip_unsupported: false,
            captions: false,
        },
        Documents::new(documents()),
        fonts(),
    )
    .unwrap();
    assert_eq!(painted(&render_with(&mut off, &video, 1.5, &mut Media::default())), 0);
    assert!(off.skipped().is_empty());
}

/// A caption without a style document is drawn with the default preset (spec §5.6 'default preset'): ordinary commas and full stops are replaced by spaces, white text with a black outline, visible even on a white background.
/// One with a style document is drawn as that style says. `{}` is still the kernel's fallback (punctuation replaced by spaces, no outline).
#[test]
fn unstyled_captions_draw_the_default_preset() {
    let draw_on = |background: &str, text: &str, style: Option<Value>| {
        let mut documents = vec![caption_doc("doc", "sequence", &[(0.0, 2.0, text)], "original")];
        if let Some(style) = style.clone() {
            documents.push(style_doc("style", studio(style)));
        }
        let items = vec![caption("cap", "doc", style.as_ref().map(|_| "style"), 60, &[])];
        let video = video(
            items,
            vec![],
            json!({ "canvas": { "width": W, "height": H, "workingSpace": "srgb", "background": background } }),
        );
        render_with(&mut renderer(false, Documents::new(documents)), &video, 1.0, &mut Media::default())
    };
    let plain = || Some(json!({ "anim": { "name": "None" } }));
    // The default shadow is not drawn on sentences that have only commas and full stops. When explicitly turned off, it is kept. Question marks and exclamation marks are always kept.
    for punctuation in ["，", "。", "，。"] {
        assert_eq!(painted(&draw_on("#000000", punctuation, None)), 0);
        assert!(painted(&draw_on("#000000", punctuation, Some(json!({"punct": false})))) > 0);
    }
    assert!(painted(&draw_on("#000000", "，。？！", None)) > 0);
    assert_eq!(painted(&draw_on("#000000", "，。", plain())), 0);
    let span = |frame: &[u8]| painted_bounds(frame).map_or(0, |(left, _, right, _)| right - left);
    let projected = span(&draw_on("#000000", "其实，宇航员。", None));
    let spaces = span(&draw_on("#000000", "其实 宇航员", None));
    assert_eq!(projected, spaces, "projected width vs spaces");
    // Outline: white text on a white background stays visible thanks to the outline. A style without an outline has almost no dark pixels on a white background.
    let dark = |frame: &[u8]| centroid(frame, |p| p[0] < 160 && p[1] < 160 && p[2] < 160).0;
    let outlined = dark(&draw_on("#FFFFFF", "微重力环境", None));
    let bare = dark(&draw_on("#FFFFFF", "微重力环境", plain()));
    assert!(outlined > 20 && bare == 0, "{outlined} vs {bare}");
}

#[test]
fn bilingual_captions_stack_once_per_style_group_in_order() {
    let documents = |order: &str| {
        vec![
            caption_doc("orig", "sequence", &[(0.0, 2.0, "AB")], "original"),
            caption_doc("trans", "sequence", &[(0.0, 2.0, "一二")], "translation"),
            style_doc(
                "style",
                studio(json!({
                    "y": 50, "order": order, "fontSize": 90, "anim": { "name": "None" },
                    "origStyle": { "fontColor": "#FFFFFF" },
                    "transStyle": { "fontColor": "#FF0000" },
                    "dropShadow": { "on": false },
                })),
            ),
        ]
    };
    let items = || {
        vec![
            caption("a", "orig", Some("style"), 60, &[]),
            caption("b", "trans", Some("style"), 60, &[]),
        ]
    };
    // Two layers of the same style document form a group: when the translation is on top (default), the red text sits above the white text; when the original is on top, it is the other way round. Both lines are near the canvas midline.
    let frame = draw(documents("trans"), items(), 1.0);
    let ((reds, _, red_y), (whites, _, white_y)) = (centroid(&frame, reddish), centroid(&frame, whiteish));
    assert!(reds > 10 && whites > 10, "{reds} {whites}");
    assert!(red_y < white_y, "{red_y} {white_y}");
    assert!((red_y + white_y) / 2.0 > 30.0 && (red_y + white_y) / 2.0 < 60.0);
    let frame = draw(documents("orig"), items(), 1.0);
    let ((_, _, red_y), (_, _, white_y)) = (centroid(&frame, reddish), centroid(&frame, whiteish));
    assert!(white_y < red_y, "{red_y} {white_y}");
    // Captions without a style document each form their own group: drawn separately at the anchor with the default style (word-by-word color change).
    let frame = draw(
        vec![caption_doc("trans", "sequence", &[(0.0, 2.0, "一二")], "original")],
        vec![caption("a", "trans", None, 60, &[])],
        1.0,
    );
    assert!(painted(&frame) > 0);
}

#[test]
fn source_clock_captions_follow_the_scope_item() {
    let documents = || {
        vec![
            caption_doc("doc", "source-asset", &[(10.0, 11.0, "AB")], "original"),
            style_doc(
                "style",
                studio(json!({ "fontSize": 120, "anim": { "name": "None" }, "displayTiming": { "leadIn": 0, "tail": 0 } })),
            ),
        ]
    };
    // The instance plays from source second 10: sequence 0.5 s is source 10.5 s, which is right inside the sentence.
    let clip = || {
        video_item(
            "clip",
            "a_clip",
            0,
            60,
            json!({ "timeMap": { "kind": "linear", "sourceIn": { "ticks": "10", "timescale": 1 }, "rate": { "num": 1, "den": 1 } } }),
        )
    };
    let assets = || vec![video_asset("a_clip", 16, 9)];
    let render_at = |scopes: &[&str]| {
        let video = video(vec![clip(), caption("cap", "doc", Some("style"), 60, scopes)], assets(), json!({}));
        render_with(
            &mut renderer(false, Documents::new(documents())),
            &video,
            0.5,
            &mut Media::default(),
        )
    };
    assert!(centroid(&render_at(&["clip"]), whiteish).0 > 10);
    // Without an instance there is no source time to speak of, so nothing is drawn at this moment.
    assert_eq!(painted(&render_at(&[])), 0);
}

#[test]
fn boxed_captions_sit_in_their_box() {
    // The style canvas 320×180 is twice the output. The box center is 60 above the canvas center (30 on the output), width 240 and height 40 (120×20 on the output). So on the output, the box is x 20–140, y 5–25.
    let boxed = |align: &str, extra: Value| {
        let mut style = json!({ "fontSize": 24, "color": "#00FF00", "verticalAlign": align });
        if let (Some(style), Value::Object(extra)) = (style.as_object_mut(), extra) {
            style.extend(extra);
        }
        style_doc(
            "style",
            json!({
                "schema": "cuccut.boxed-caption-style/1",
                "canvas": { "width": 320, "height": 180 },
                "box": { "x": 0, "y": -60, "width": 240, "height": 40 },
                "style": style,
            }),
        )
    };
    let frame_with = |text: &str, style: FrozenDocument| {
        draw(
            vec![caption_doc("doc", "sequence", &[(0.0, 1.0, text)], "original"), style],
            vec![caption("cap", "doc", Some("style"), 60, &[])],
            0.5,
        )
    };
    let bounds = |frame: &[u8]| {
        let mut b: Option<(u32, u32, u32, u32)> = None;
        for y in 0..H {
            for x in 0..W {
                if greenish(px(frame, x, y)) {
                    b = Some(b.map_or((x, y, x, y), |(x0, y0, x1, y1)| (x0.min(x), y0.min(y), x1.max(x), y1.max(y))));
                }
            }
        }
        b.expect("glyphs were painted")
    };
    // Top-aligned sticks to the top of the box, bottom-aligned to the bottom, and centered on the box center (y 15). All are inside the box and horizontally centered.
    let top = bounds(&frame_with("AB", boxed("top", json!({}))));
    let bottom = bounds(&frame_with("AB", boxed("bottom", json!({}))));
    let center = bounds(&frame_with("AB", boxed("center", json!({}))));
    assert!(top.1 >= 5 && top.1 <= 9, "{top:?}");
    assert!(bottom.3 <= 25 && bottom.3 >= 20, "{bottom:?}");
    assert!(top.1 < center.1 && center.1 < bottom.1, "{top:?} {center:?} {bottom:?}");
    assert!(((center.1 + center.3) as f64 / 2.0 - 15.0).abs() < 3.0, "{center:?}");
    for (x0, _, x1, _) in [top, bottom, center] {
        assert!(x0 >= 20 && x1 <= 140 && ((x0 + x1) as f64 / 2.0 - 80.0).abs() < 3.0, "{x0} {x1}");
    }
    // Positioned-box styles do not use the delivery style, so the full stop is still drawn.
    let plain = centroid(&frame_with("AB", boxed("top", json!({}))), greenish).0;
    let dotted = centroid(&frame_with("AB.", boxed("top", json!({}))), greenish).0;
    assert!(dotted > plain, "{plain} {dotted}");
    // Opacity applies to the whole sentence, and the backing plate is laid under the text.
    let faded = frame_with("AB", boxed("top", json!({ "opacity": 0.5 })));
    let brightest = faded.chunks_exact(4).map(|p| p[1]).max().unwrap();
    assert!((110..=140).contains(&brightest), "{brightest}");
    let plated = frame_with("AB", boxed("center", json!({ "backgroundColor": "#0000FF", "textPadding": 8 })));
    assert!(centroid(&plated, |p| p[2] > 200 && p[1] < 60).0 > 50);
}

#[test]
fn boxed_caption_alignment_hugs_the_box_edges() {
    // On the output the box is x 20–140 (see the previous test). Padding 8 becomes 4 on the output, so the text sits one padding away from the box edge and the backing plate reaches exactly to the box edge.
    let frame = |align: &str| {
        draw(
            vec![
                caption_doc("doc", "sequence", &[(0.0, 1.0, "AB")], "original"),
                style_doc(
                    "style",
                    json!({
                        "schema": "cuccut.boxed-caption-style/1",
                        "canvas": { "width": 320, "height": 180 },
                        "box": { "x": 0, "y": -60, "width": 240, "height": 40 },
                        "style": { "fontSize": 24, "color": "#00FF00", "verticalAlign": "center", "textAlign": align,
                                   "backgroundColor": "#0000FF", "textPadding": 8 },
                    }),
                ),
            ],
            vec![caption("cap", "doc", Some("style"), 60, &[])],
            0.5,
        )
    };
    let span = |frame: &[u8], pick: fn([u8; 4]) -> bool| {
        let xs: Vec<u32> = (0..H)
            .flat_map(|y| (0..W).map(move |x| (x, y)))
            .filter(|&(x, y)| pick(px(frame, x, y)))
            .map(|(x, _)| x)
            .collect();
        (*xs.iter().min().expect("was painted"), *xs.iter().max().unwrap())
    };
    let plate = |p: [u8; 4]| p[2] > 200 && p[1] < 60;
    let (left, center, right) = (frame("left"), frame("center"), frame("right"));
    let (lp, cp, rp) = (span(&left, plate), span(&center, plate), span(&right, plate));
    let (lt, ct, rt) = (span(&left, greenish), span(&center, greenish), span(&right, greenish));
    assert!(lp.0.abs_diff(20) <= 1, "左对齐的底板贴框的左边：{lp:?}");
    assert!(rp.1.abs_diff(139) <= 1, "右对齐的底板贴框的右边：{rp:?}");
    assert!((f64::from(cp.0 + cp.1) / 2.0 - 80.0).abs() <= 1.5, "居中照旧：{cp:?}");
    // The same sentence in three alignments differs only by translation (anti-aliasing differences within one pixel).
    assert!((lp.1 - lp.0).abs_diff(cp.1 - cp.0) <= 1, "{lp:?} {cp:?}");
    assert!((rp.1 - rp.0).abs_diff(cp.1 - cp.0) <= 1, "{rp:?} {cp:?}");
    assert!(lt.0 >= 24 && lt.0 < ct.0 && ct.0 < rt.0 && rt.1 <= 136, "{lt:?} {ct:?} {rt:?}");
}

/// The positioned-box style chose word-by-word reveal (`animationPresetId: reveal`). A sentence without word timings is split into words at whitespace, and its duration is divided by character count. Words not yet spoken are not drawn, and each word is revealed in full once spoken. After all words are spoken, it is pixel-identical to the same sentence without animation.
#[test]
fn boxed_reveal_shows_words_as_they_are_reached() {
    let boxed = |preset: Option<&str>| {
        let mut style = json!({ "fontSize": 24, "color": "#00FF00", "verticalAlign": "center" });
        if let Some(preset) = preset {
            style["animationPresetId"] = json!(preset);
        }
        style_doc(
            "style",
            json!({
                "schema": "cuccut.boxed-caption-style/18",
                "canvas": { "width": 320, "height": 180 },
                "box": { "x": 0, "y": 0, "width": 300, "height": 60 },
                "style": style,
            }),
        )
    };
    // Three equally long words, each taking one second: [0, 1), [1, 2), [2, 3).
    let frame = |text: &str, preset: Option<&str>, seconds: f64| {
        draw(
            vec![caption_doc("doc", "sequence", &[(0.0, 3.0, text)], "original"), boxed(preset)],
            vec![caption("cap", "doc", Some("style"), 120, &[])],
            seconds,
        )
    };
    let right_edge = |frame: &[u8]| {
        (0..H)
            .flat_map(|y| (0..W).map(move |x| (x, y)))
            .filter(|&(x, y)| greenish(px(frame, x, y)))
            .map(|(x, _)| x)
            .max()
    };
    let text = "AA BB CC";
    let phases: Vec<Vec<u8>> = [0.5, 1.5, 2.5].iter().map(|&t| frame(text, Some("reveal"), t)).collect();
    let counts: Vec<usize> = phases.iter().map(|f| centroid(f, greenish).0).collect();
    let edges: Vec<u32> = phases.iter().map(|f| right_edge(f).expect("spoken word was painted")).collect();
    // One, two, then three words: more and more characters appear, each word further right (the line is laid out centered in the box, and unspoken words still hold their space).
    assert!(counts[0] > 10 && counts[0] < counts[1] && counts[1] < counts[2], "{counts:?}");
    assert!(edges[0] < edges[1] && edges[1] < edges[2], "{edges:?}");
    // At the starting moment the first word is not yet lit, so nothing of the sentence is drawn.
    assert_eq!(centroid(&frame(text, Some("reveal"), 0.0), greenish).0, 0);
    // The pixel position of the first word on the left does not move as later words light up.
    let first_word = |f: &[u8]| {
        (0..H)
            .flat_map(|y| (0..W).map(move |x| (x, y)))
            .filter(|&(x, y)| x <= edges[0] && greenish(px(f, x, y)))
            .count()
    };
    assert_eq!(first_word(&phases[0]), first_word(&phases[2]));
    // Once fully spoken, it matches the sentence without animation. A form other than the catalog ID that it does not recognize (not written here) is not animated either.
    assert_eq!(phases[2], frame(text, None, 2.5));
    // A Chinese sentence without whitespace is one word: it is revealed in full from the start, the same as without animation.
    assert_eq!(frame("一处切换", Some("reveal"), 0.2), frame("一处切换", None, 0.2));
    assert!(centroid(&frame("一处切换", Some("reveal"), 0.2), greenish).0 > 10);
}

#[test]
fn unreadable_captions_are_refused_or_skipped() {
    let good = || caption_doc("doc", "sequence", &[(0.0, 2.0, "AB")], "original");
    let reason = |documents: Vec<FrozenDocument>, style: Option<&str>| -> String {
        let video = video(vec![caption("cap", "doc", style, 60, &[])], vec![], json!({}));
        let error = try_render(&mut renderer(false, Documents::new(documents)), &video, 1.0, &mut Media::default()).unwrap_err();
        assert_eq!(error.code, "EXPORT_UNSUPPORTED_CONTENT");
        assert_eq!((error.items[0].layer_kind, error.items[0].scope), ("caption", "layer"));
        error.items[0].reason.clone()
    };
    assert_eq!(reason(vec![], None), "caption-document-missing");
    let mut odd = good();
    odd.body = json!({ "schema": "vendor.captions/3", "cues": [] });
    assert_eq!(reason(vec![odd], None), "caption-unknown-document");
    assert_eq!(reason(vec![good()], Some("style")), "caption-style-missing");
    assert_eq!(
        reason(
            vec![good(), style_doc("style", json!({ "schema": "vendor.style/1" }))],
            Some("style")
        ),
        "caption-unknown-style"
    );
    // Skipping drops only this one caption group.
    let video = video(vec![caption("cap", "doc", Some("style"), 60, &[])], vec![], json!({}));
    let mut skipping = renderer(true, Documents::new(vec![good()]));
    assert_eq!(painted(&render_with(&mut skipping, &video, 1.0, &mut Media::default())), 0);
    assert_eq!(skipping.skipped()[0].reason, "caption-style-missing");
}

#[test]
fn renderers_reused_across_sizes_and_documents_match_fresh_ones() {
    // When the size or the document changes, the typesetting engine is taken apart and reused. What is drawn is identical to a newly created renderer.
    let documents = || {
        vec![
            caption_doc("doc", "sequence", &[(0.0, 2.0, "AB")], "original"),
            style_doc("style", studio(json!({ "fontSize": 90, "anim": { "name": "None" } }))),
        ]
    };
    let title = item(
        "title",
        1,
        60,
        json!({ "type": "text", "text": "HH", "style": { "fontSize": 50, "fontColor": "#FF0000" }, "place": { "x": 50, "y": 30, "w": 60 } }),
    );
    let video = video(vec![caption("cap", "doc", Some("style"), 60, &[]), title], vec![], json!({}));
    let fresh = |width: u32, height: u32| {
        let mut renderer = frame_render::FrameRenderer::new(
            frame_render::RenderOptions {
                width,
                height,
                skip_unsupported: false,
                captions: true,
            },
            Documents::new(documents()),
            fonts(),
        )
        .unwrap();
        render_with(&mut renderer, &video, 1.0, &mut Media::default())
    };
    let mut reused = renderer(false, Documents::new(documents()));
    let first = render_with(&mut reused, &video, 1.0, &mut Media::default());
    assert!(painted(&first) > 100);
    assert!(first.chunks_exact(4).any(|p| reddish([p[0], p[1], p[2], p[3]])), "文字层画上去了");
    reused.resize(W * 2, H * 2).unwrap();
    assert_eq!(render_with(&mut reused, &video, 1.0, &mut Media::default()), fresh(W * 2, H * 2));
    reused.resize(W, H).unwrap();
    reused.set_documents(Documents::new(documents()));
    assert_eq!(render_with(&mut reused, &video, 1.0, &mut Media::default()), first);
}

/// Transcript document: `words` are (ID, text, start seconds, end seconds); words in `hidden` are hidden.
fn speech_doc(id: &str, asset: &str, words: &[(&str, &str, f64, f64)], hidden: &[&str]) -> FrozenDocument {
    serde_json::from_value(json!({
        "documentId": id, "kind": "speech", "schema": "cuccut.speech/1", "sourceAssetId": asset,
        "body": {
            "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000,
            "words": words.iter().map(|(w, t, s, e)| {
                let mut word = json!({ "id": w, "text": t, "start": (s * 1000.0) as i64, "end": (e * 1000.0) as i64 });
                if hidden.contains(w) {
                    word["hidden"] = json!(true);
                }
                word
            }).collect::<Vec<_>>(),
        }
    }))
    .unwrap()
}

/// Caption document on the source clock, with one sentence pointing at transcript `first`–`last`. When `speech` is `None`, the document header does not write `sourceDocumentId`.
fn worded_caption_doc(id: &str, speech: Option<&str>, cue: (f64, f64, &str), words: (&str, &str)) -> FrozenDocument {
    let mut value = json!({
        "documentId": id, "kind": "caption", "schema": "cuccut.caption/1", "lineKind": "original",
        "body": {
            "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000,
            "cues": [{ "id": "q-w1", "start": (cue.0 * 1000.0) as i64, "end": (cue.1 * 1000.0) as i64, "text": cue.2,
                       "words": { "first": words.0, "last": words.1 } }],
        }
    });
    if let Some(speech) = speech {
        value["sourceDocumentId"] = json!(speech);
    }
    serde_json::from_value(value).unwrap()
}

/// Video instance that plays `frames` frames from the source's `source_in` seconds, placed at sequence frame `from` (asset `a_clip`).
fn clip_at(id: &str, from: i64, frames: i64, source_in: f64) -> Value {
    video_item(
        id,
        "a_clip",
        from,
        frames,
        json!({ "timeMap": { "kind": "linear", "sourceIn": { "ticks": format!("{}", (source_in * 1000.0) as i64), "timescale": 1000 },
                             "rate": { "num": 1, "den": 1 } } }),
    )
}

/// Yellow pixels of the word-by-word color change (`#FFD43B`).
fn karaoke_yellow(p: [u8; 4]) -> bool {
    p[0] > 180 && p[1] > 150 && p[2] < 120
}

const SPACELESS: [(&str, &str, f64, f64); 4] = [
    ("w1", "真", 10.0, 10.5),
    ("w2", "的", 10.5, 11.0),
    ("w3", "别", 11.0, 11.5),
    ("w4", "再", 11.5, 12.0),
];

#[test]
fn spaceless_chinese_lines_advance_per_character_from_the_transcript() {
    let style = || {
        style_doc(
            "style",
            studio(json!({ "fontSize": 120, "anim": { "name": "Color" }, "displayTiming": { "leadIn": 0, "tail": 0 } })),
        )
    };
    let documents = |speech: Option<&str>| {
        vec![
            speech_doc("sp", "a_clip", &SPACELESS, &[]),
            worded_caption_doc("doc", speech, (10.0, 12.0, "真的别再"), ("w1", "w4")),
            style(),
        ]
    };
    let draw_at = |speech: Option<&str>, seconds: f64| {
        let video = video(
            vec![clip_at("clip", 0, 60, 10.0), caption("cap", "doc", Some("style"), 60, &["clip"])],
            vec![video_asset("a_clip", 16, 9)],
            json!({}),
        );
        render_with(
            &mut renderer(false, Documents::new(documents(speech))),
            &video,
            seconds,
            &mut Media::default(),
        )
    };
    // Get the per-character timings from the transcript: when the first character is spoken, only it changes color; when the fourth character is spoken, the colored part has moved to the right.
    let first = draw_at(Some("sp"), 0.25);
    let last = draw_at(Some("sp"), 1.75);
    let (yellow_first, x_first, _) = centroid(&first, karaoke_yellow);
    let (yellow_last, x_last, _) = centroid(&last, karaoke_yellow);
    let (white_first, ..) = centroid(&first, whiteish);
    assert!(yellow_first > 10 && yellow_last > 10, "{yellow_first} {yellow_last}");
    assert!(
        white_first > yellow_first * 2,
        "其余三个字还是白的：白 {white_first}，黄 {yellow_first}"
    );
    assert!(x_last - x_first > 30.0, "变色的字从左跑到右：{x_first} → {x_last}");
    // Without a transcript to draw from (the document header has no sourceDocumentId), the whole line is one 'word' and changes color together.
    let whole = draw_at(None, 0.25);
    let (yellow_whole, ..) = centroid(&whole, karaoke_yellow);
    let (white_whole, ..) = centroid(&whole, whiteish);
    assert!(yellow_whole > white_whole * 4, "整行一起变色：黄 {yellow_whole}，白 {white_whole}");
}

#[test]
fn cut_and_hidden_words_leave_the_caption_line() {
    let documents = |hidden: &[&str]| {
        vec![
            speech_doc("sp", "a_clip", &SPACELESS, hidden),
            worded_caption_doc("doc", Some("sp"), (10.0, 12.0, "真的别再"), ("w1", "w4")),
            style_doc(
                "style",
                studio(json!({ "fontSize": 120, "anim": { "name": "None" }, "displayTiming": { "leadIn": 0, "tail": 0 } })),
            ),
        ]
    };
    let width = |items: Vec<Value>, hidden: &[&str], seconds: f64| {
        let video = video(items, vec![video_asset("a_clip", 16, 9)], json!({}));
        let frame = render_with(
            &mut renderer(false, Documents::new(documents(hidden))),
            &video,
            seconds,
            &mut Media::default(),
        );
        let (x0, _, x1, _) = painted_bounds(&frame).expect("captions were painted");
        f64::from(x1 - x0)
    };
    let whole = || vec![clip_at("clip", 0, 60, 10.0), caption("cap", "doc", Some("style"), 60, &["clip"])];
    let four = width(whole(), &[], 0.25);
    // Cut out “的” (the particle “de”, source 10.5–11.0): the earlier segment plays source 10.0–10.5, and the later segment plays source 11.0–12.0 starting at sequence frame 15.
    let cut = vec![
        clip_at("left", 0, 15, 10.0),
        clip_at("right", 15, 30, 11.0),
        caption("cap", "doc", Some("style"), 45, &["left", "right"]),
    ];
    let three = width(cut, &[], 1.0);
    let char_width = four / 4.0;
    assert!((four - three - char_width).abs() < char_width * 0.4, "少了一个字：{four} → {three}");
    // Hidden words are not drawn either.
    let hidden = width(whole(), &["w2"], 0.25);
    assert!((hidden - three).abs() < 2.0, "{hidden} ≠ {three}");
    // In preview, the same renderer follows the edit: after a cut, the captions are re-timed.
    let mut shared = renderer(false, Documents::new(documents(&[])));
    let mut bounds = |items: Vec<Value>, seconds: f64| {
        let video = video(items, vec![video_asset("a_clip", 16, 9)], json!({}));
        // When preview sends a new video snapshot, it tells the renderer that the sequence has changed (preview-wasm's `set_video`).
        shared.sequence_changed();
        let (x0, _, x1, _) = painted_bounds(&render_with(&mut shared, &video, seconds, &mut Media::default())).unwrap();
        f64::from(x1 - x0)
    };
    assert_eq!(bounds(whole(), 0.25), four);
    let cut = vec![
        clip_at("left", 0, 15, 10.0),
        clip_at("right", 15, 30, 11.0),
        caption("cap", "doc", Some("style"), 45, &["left", "right"]),
    ];
    assert_eq!(bounds(cut, 1.0), three);
}

/// Pixels of the design caption's emphasis color (`#FF00AA`, which sits on a black background on entry).
fn emphasis_magenta(p: [u8; 4]) -> bool {
    p[0] > 90 && p[1] < 50 && p[2] > 45 && p[0] > p[2]
}

#[test]
fn designed_caption_emphasis_lands_on_transcript_words() {
    let words = [("w1", "真", 10.0, 10.5), ("w2", "的", 10.5, 11.0), ("w3", "说了", 11.0, 12.0)];
    let draw = |speech: Option<&str>, emphasis: Value| {
        let documents = vec![
            speech_doc("sp", "a_clip", &words, &[]),
            worded_caption_doc("doc", speech, (10.0, 12.0, "真的说了"), ("w1", "w3")),
            style_doc(
                "style",
                studio(json!({
                    "fontSize": 110, "displayTiming": { "leadIn": 0, "tail": 0 },
                    "wordAnimation": { "caption": { "schema": 1, "style": { "id": "caption-highlight", "version": 1 }, "content": "orig",
                                                    "palette": { "primary": "#FFFFFF", "accent": "#00FF66" } } },
                    "captionEmphasis": emphasis,
                })),
            ),
        ];
        let video = video(
            vec![clip_at("clip", 0, 60, 10.0), caption("cap", "doc", Some("style"), 60, &["clip"])],
            vec![video_asset("a_clip", 16, 9)],
            json!({}),
        );
        let frame = render_with(&mut renderer(false, Documents::new(documents)), &video, 0.25, &mut Media::default());
        let (count, x, _) = centroid(&frame, emphasis_magenta);
        let columns: Vec<u32> = (0..W).filter(|&x| (0..H).any(|y| emphasis_magenta(px(&frame, x, y)))).collect();
        (
            count,
            x,
            columns.first().copied().unwrap_or(0),
            columns.last().copied().unwrap_or(0),
        )
    };
    let hero = |id: &str| json!({ id: { "anchorText": "", "role": "hero", "color": "#FF00AA" } });
    // Emphasis is keyed by the transcript word ID: “的” (the particle “de”) is drawn in the emphasis color.
    let (single, x_single, ..) = draw(Some("sp"), hero("w2"));
    assert!(single > 5, "强调的字画成强调色：{single}");
    // Emphasis written on the multi-character word “split into `w3` and `w3~1`” lands on every split character: the right edge reaches the right side of “了”, and the left edge is on the left of “了” (“说” is in the emphasis color too).
    let (split, x_split, left, right) = draw(Some("sp"), hero("w3"));
    let (last, _, last_left, last_right) = draw(Some("sp"), hero("w3~1"));
    assert!(split > 5 && last > 5, "{split} {last}");
    assert!(x_single < x_split, "「的」在「说了」左边：{x_single} {x_split}");
    assert!(
        right + 1 >= last_right && left + 4 < last_left,
        "「说了」两个字都是强调色：{left}–{right}，「了」{last_left}–{last_right}"
    );
    // Without a transcript to draw from, words are derived by splitting on whitespace. Without this ID, emphasis does not land.
    let (none, ..) = draw(None, hero("w2"));
    assert_eq!(none, 0, "取不到词时不冒充强调");
}

#[test]
fn cue_styles_follow_the_document_cue_id_in_every_member() {
    // Two caption documents in the same style group have colliding sentence IDs. When handed to the kernel, the second sentence gets a suffix appended, and per-sentence styles still land on the two sentences by the IDs in the document.
    let documents = vec![
        caption_doc("one", "sequence", &[(0.0, 1.0, "AB")], "original"),
        caption_doc("two", "sequence", &[(2.0, 3.0, "CD")], "original"),
        style_doc(
            "style",
            studio(json!({
                "fontSize": 110, "anim": { "name": "None" }, "displayTiming": { "leadIn": 0, "tail": 0 },
                "cueStyles": { "c0": { "source": { "fontColor": "#FF0000" } } },
            })),
        ),
    ];
    let video = video(
        vec![
            caption("a", "one", Some("style"), 120, &[]),
            caption("b", "two", Some("style"), 120, &[]),
        ],
        vec![],
        json!({}),
    );
    let mut shared = renderer(false, Documents::new(documents));
    for seconds in [0.5, 2.5] {
        let frame = render_with(&mut shared, &video, seconds, &mut Media::default());
        let (red, ..) = centroid(&frame, reddish);
        let (white, ..) = centroid(&frame, whiteish);
        assert!(red > 10 && white < red / 4, "{seconds} 秒：红 {red}，白 {white}");
    }
}

#[test]
fn bottom_template_strips_lift_captions_without_drawing_the_template_twice() {
    // The bottom edge of the caption sits on the anchor line (`verticalAlign: bottom`), and the default anchor line is at 86%.
    let documents = || {
        vec![
            caption_doc("doc", "sequence", &[(0.0, 2.0, "AB")], "original"),
            style_doc(
                "style",
                studio(json!({ "fontSize": 80, "verticalAlign": "bottom", "anim": { "name": "None" },
                               "displayTiming": { "leadIn": 0, "tail": 0 } })),
            ),
        ]
    };
    // A full-width progress line starting at y = 80%. When avoiding it, the anchor line is raised above it by 100 − 80 + 2 = 22%, so it sits at 78%.
    let template = |subs_avoid: bool, accent: &str, track: &str| {
        json!({ "durationPolicy": { "kind": "fixed", "frames": 60 }, "template": { "id": "tpl", "name": "条", "subsAvoid": subs_avoid, "layers": [
            { "id": "bar", "box": { "x": 0, "y": 80, "w": 100, "h": 20 }, "kind": "progress", "accent": accent, "track": track }
        ] } })
    };
    let draw = |sequence: Value, with_caption: bool| {
        let mut items = vec![];
        if with_caption {
            items.push(caption("cap", "doc", Some("style"), 60, &[]));
        }
        let video = video(items, vec![], sequence);
        render_with(
            &mut renderer(false, Documents::new(documents())),
            &video,
            0.5,
            &mut Media::default(),
        )
    };
    let bottom = |frame: &[u8]| {
        (0..H)
            .rev()
            .find(|&y| (0..W).any(|x| whiteish(px(frame, x, y))))
            .expect("captions were painted")
    };
    let strip_top = (f64::from(H) * 0.8) as u32;
    // Transparent bar: only to see where the caption sits.
    let clear = |avoid: bool| template(avoid, "#FF000000", "#0000FF00");
    let plain = draw(json!({}), true);
    let lifted = draw(clear(true), true);
    let off = draw(clear(false), true);
    assert!(bottom(&plain) >= strip_top, "没有模板时字幕底边在 86% 附近：{}", bottom(&plain));
    assert!(bottom(&lifted) < strip_top, "底部横条把字幕抬到条的上沿之上：{}", bottom(&lifted));
    assert_eq!(off, plain, "关掉 subsAvoid 不抬");
    // The caption's appearance is unchanged: the white text has about the same pixel count.
    let (white_plain, ..) = centroid(&plain, whiteish);
    let (white_lifted, ..) = centroid(&lifted, whiteish);
    assert!(
        white_plain.abs_diff(white_lifted) * 10 < white_plain,
        "{white_plain} vs {white_lifted}"
    );
    // The caption layer draws only captions. The opaque bar's region is pixel-identical to when only the template is present (the template is not drawn again by the caption layer), and the caption is still lifted above it.
    let opaque = template(true, "#FF0000", "#0000FF");
    let over = draw(opaque.clone(), true);
    let bare = draw(opaque, false);
    for y in strip_top..H {
        for x in 0..W {
            assert_eq!(px(&over, x, y), px(&bare, x, y), "({x}, {y})");
        }
    }
    assert_eq!(bottom(&over), bottom(&lifted));
}

#[test]
fn caption_font_notes_stand_on_every_frame() {
    let documents = vec![
        caption_doc("doc", "sequence", &[(0.0, 2.0, "AB")], "original"),
        style_doc(
            "style",
            studio(json!({ "fontSize": 120, "fontFamily": "Nowhere Sans", "anim": { "name": "None" },
                           "displayTiming": { "leadIn": 0, "tail": 0 } })),
        ),
    ];
    let video = video(vec![caption("cap", "doc", Some("style"), 60, &[])], vec![], json!({}));
    let note = "cap: font \"Nowhere Sans\" is not available in the current font library; falling back to Noto Sans SC";
    let mut renderer = renderer(false, Documents::new(documents));
    // Preview clears the reports on every frame. The missing-font hint for captions is shown on every frame (previously it was reported only on the frame that compiled).
    for seconds in [0.5, 1.0, 1.5] {
        renderer.clear_reports();
        render_with(&mut renderer, &video, seconds, &mut Media::default());
        let notes: Vec<&str> = renderer.warnings().iter().map(|w| w.detail.as_str()).collect();
        assert_eq!(notes, vec![note], "{seconds} 秒");
        assert_eq!(renderer.missing_fonts(), vec!["Nowhere Sans".to_string()], "{seconds} 秒");
    }
}

#[test]
fn preview_hits_follow_rendered_bilingual_lines_and_clear_between_frames() {
    let docs = vec![
        caption_doc("orig", "sequence", &[(1.0, 2.0, "Original")], "original"),
        caption_doc("trans", "sequence", &[(1.0, 2.0, "Translation")], "translation"),
        style_doc(
            "style",
            studio(json!({ "fontSize": 40, "rotation": 15, "anim": { "name": "None" }, "displayTiming": { "leadIn": 0, "tail": 0 } })),
        ),
    ];
    let video = video(
        vec![
            caption("cap_o", "orig", Some("style"), 240, &[]),
            caption("cap_t", "trans", Some("style"), 240, &[]),
        ],
        vec![],
        json!({}),
    );
    let mut renderer = renderer(false, Documents::new(docs));
    renderer.set_collect_caption_hits(true);
    render_with(&mut renderer, &video, 1.5, &mut Media::default());
    let hits = renderer.caption_hits();
    assert_eq!(hits.len(), 2);
    for (document, item) in [("orig", "cap_o"), ("trans", "cap_t")] {
        let hit = hits.iter().find(|hit| hit.document_id == document).unwrap();
        assert_eq!(hit.item_id, item);
        assert_eq!(hit.layer_id, "cap_o");
        assert_eq!(hit.cue_id, "c0");
        assert_eq!(hit.rotation, 15.0);
        assert!(hit.w > 0.0 && hit.h > 0.0);
    }
    assert_ne!(hits[0].cy, hits[1].cy);
    // A frame with no sentences must not keep the previous hit box, and nothing can be hit when captions are not burned in.
    render_with(&mut renderer, &video, 3.5, &mut Media::default());
    assert!(renderer.caption_hits().is_empty());
    renderer.set_captions(false);
    render_with(&mut renderer, &video, 1.5, &mut Media::default());
    assert!(renderer.caption_hits().is_empty());
}
