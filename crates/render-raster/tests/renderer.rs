//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer`
//! (the BCF document rendering path and the host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

use render_raster::drawop::{self, DrawOp};
use render_raster::{FrameRenderer, LoadedAssets, MediaStore, TextEngine};
use serde_json::Value;
use std::sync::Arc;

/// Read the golden IR. The JSON is a fixture tracked in the repo and present on any checkout, so a read failure always panics.
fn golden_ir() -> scene_primitives::Ir {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/launch-golden/launch.ccut.json"
    );
    let text = std::fs::read_to_string(path).expect("read golden JSON");
    let doc: Value = serde_json::from_str(&text).unwrap();
    scene_primitives::Resolver::new(doc, None)
        .unwrap()
        .resolve()
        .unwrap()
}

#[test]
fn golden_timeline_records_shapes_text_transitions_and_captions() {
    let mut ir = golden_ir();
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let mut saw_fill_rect = false;
    let mut saw_fill_path = false;
    let mut saw_stroke_path = false;
    let mut saw_layer = false;
    let mut fingerprints = Vec::new();

    for t in [0.7, 2.9, 3.0, 4.0, 7.8, 8.0, 9.5, 10.5, 13.6, 16.1, 19.8] {
        let frame = renderer.record(&ir, &mut engine, t);
        assert!(matches!(frame.ops.first(), Some(DrawOp::Clear { .. })));
        saw_fill_rect |= frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::FillRect { .. }));
        saw_fill_path |= frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::FillPath { .. }));
        saw_stroke_path |= frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::StrokePath { .. }));
        saw_layer |= frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::PushLayer { .. }));
        assert!(
            !frame
                .ops
                .iter()
                .any(|op| matches!(op, DrawOp::DrawMedia { .. }))
        );
        fingerprints.push(drawop::fingerprint(&frame));
    }

    assert!(
        saw_fill_rect,
        "box/caption backgrounds should record FillRect"
    );
    assert!(saw_fill_path, "text glyphs should record FillPath");
    assert!(saw_stroke_path, "animated SVGs should record StrokePath");
    assert!(saw_layer, "transitions and opacity should record layers");
    fingerprints.sort_unstable();
    fingerprints.dedup();
    assert!(
        fingerprints.len() > 5,
        "timeline should produce distinct frames"
    );
}

/// Region subtitles (§3.6): the line boxes arranged by core must constrain glyph drawing within the rectangle, and grow upward.
#[test]
fn region_captions_draw_inside_the_rect_growing_up() {
    let doc: Value = serde_json::from_str(
        r#"{
      "meta": { "id": "r", "width": 1920, "height": 1080, "fps": 30 },
      "scenes": [ { "id": "s", "dur": 6, "desc": "x" } ],
      "tracks": [ { "id": "cap", "kind": "captions", "clips": [ {
        "id": "caps", "start": 0, "end": 6,
        "layout": { "region": { "x": 200, "y": 300, "width": 400, "height": 300 },
                    "grow": "up", "gap": 8 },
        "lanes": [ { "id": "zh", "style": { "fontSize": 30 } } ],
        "captions": [ { "at": 0, "until": 5, "lines": { "zh": {
          "text": "region wrapping keeps every glyph inside the declared rectangle"
        } } } ]
      } ] } ]
    }"#,
    )
    .unwrap();
    let mut ir = scene_primitives::Resolver::new(doc, None)
        .unwrap()
        .resolve()
        .unwrap();
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();

    let boxes = ir.caption_clips[0].items[0].lines["zh"]
        .boxes
        .as_ref()
        .expect("core has already laid out the line boxes");
    assert!(boxes.len() > 1, "a long line should wrap within the 400px-wide region");
    for b in boxes {
        assert!(b.w <= 400.0 + 1e-6, "line width {} exceeds the region", b.w);
        assert!(b.x >= 200.0 - 1e-6 && b.x + b.w <= 600.0 + 1e-6);
        assert!(b.y >= 300.0 - 1e-6 && b.y + b.h <= 600.0 + 1e-6);
    }
    // grow up: the bottom edge of the last line sits against the region's bottom edge (line boxes are vertically centered within the line height, so half a line gap is left over)
    let last = boxes.last().unwrap();
    assert!(600.0 - (last.y + last.h) < 30.0 * 1.3);

    let frame = renderer.record(&ir, &mut engine, 1.0);
    let mut glyph_xs = Vec::new();
    for op in &frame.ops {
        if let DrawOp::FillPath { tf, .. } = op {
            glyph_xs.push((tf[4], tf[5]));
        }
    }
    assert!(!glyph_xs.is_empty(), "subtitles should record glyphs");
    for (x, y) in glyph_xs {
        assert!((199.0..=601.0).contains(&x), "glyph x={x} is outside the region");
        assert!((299.0..=601.0).contains(&y), "glyph baseline y={y} is outside the region");
    }
}

/// A lane's `animate.exit` (§8.4) anchors to this entry's `until`. When declared, the exit runs for its declared duration and is no longer darkened early by the clip-wide `fade` (default 0.18 s). A lane without a declared exit still fades out according to `fade`, as before.
#[test]
fn caption_lane_exit_overrides_block_fade() {
    let doc = |exit: Value| -> Value {
        serde_json::json!({
          "meta": { "id": "x", "width": 800, "height": 400, "fps": 24 },
          "scenes": [ { "id": "s", "dur": 4, "desc": "x" } ],
          "tracks": [ { "id": "cap", "kind": "captions", "clips": [ {
            "id": "caps", "start": 0, "end": 4,
            "lanes": [ { "id": "en", "style": { "fontSize": 30 },
                         "animate": { "enter": { "preset": "fadeIn", "dur": 0.04 }, "exit": exit } } ],
            "captions": [ { "at": 0, "until": 2, "lines": { "en": { "text": "exit test" } } } ]
          } ] } ]
        })
    };
    // Opacity of the first PushLayer; no layer = fully opaque
    let alpha_at = |doc: Value, t: f64| -> f32 {
        let mut ir = resolve_doc(doc);
        let mut engine = TextEngine::new();
        let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
        let frame = renderer.record(&ir, &mut engine, t);
        assert!(
            frame
                .ops
                .iter()
                .any(|op| matches!(op, DrawOp::FillPath { .. })),
            "t={t} should draw the subtitle"
        );
        frame
            .ops
            .iter()
            .find_map(|op| match op {
                DrawOp::PushLayer { opacity, .. } => Some(*opacity),
                _ => None,
            })
            .unwrap_or(1.0)
    };
    let short = serde_json::json!({ "preset": "fadeOut", "dur": 0.04 });
    // 0.1 s before until: the short exit has not started yet
    assert!(alpha_at(doc(short.clone()), 1.9) > 0.999);
    // 0.02 s before until: the short exit is halfway done
    let mid = alpha_at(doc(short), 1.98);
    assert!(mid > 0.05 && mid < 0.95, "fadeOut 0.04 midpoint opacity {mid}");
    // No exit declared: fades out as a whole per the clip's fade (0.18 s), already darkened 0.1 s before until
    let dim = alpha_at(doc(Value::Null), 1.9);
    assert!(
        dim < 0.9,
        "with the default fade, 0.1 s before until should already be dimmed; got {dim}"
    );
}

fn resolve_doc(doc: Value) -> scene_primitives::Ir {
    scene_primitives::Resolver::new(doc, None)
        .unwrap()
        .resolve()
        .unwrap()
}

fn small_doc(children: Value) -> Value {
    serde_json::json!({
        "ccut": "0.2",
        "meta": {"id": "t", "width": 400, "height": 200, "fps": 30, "background": "#ffffff"},
        "scenes": [{"id": "s", "dur": 2}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end",
             "element": {"type": "box", "id": "stage",
                         "style": {"width": 400, "height": 200},
                         "children": children}}
        ]}]
    })
}

fn pixel(pixmap: &tiny_skia::Pixmap, x: u32, y: u32) -> [u8; 4] {
    let i = ((y * pixmap.width() + x) * 4) as usize;
    let d = pixmap.data();
    [d[i], d[i + 1], d[i + 2], d[i + 3]]
}

/// `style.mask` (spec §6.3): a masked element only appears within the alpha of the mask source, and the mask source itself does not enter the normal flow. The instruction stream is `PushLayer → … → PushMatte → source → PopMatte → PopLayer`.
#[test]
fn element_mask_records_a_matte_and_hides_its_source() {
    let mut ir = resolve_doc(small_doc(serde_json::json!([
        {"type": "box", "id": "red",
         "style": {"x": 0, "y": 0, "width": 400, "height": 200, "background": "#ff0000",
                   "mask": {"source": "#hole"}}},
        {"type": "box", "id": "hole",
         "style": {"x": 150, "y": 50, "width": 100, "height": 100, "background": "#0000ff"}}
    ])));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let frame = renderer.record(&ir, &mut engine, 1.0);
    let matte_at = frame
        .ops
        .iter()
        .position(|op| matches!(op, DrawOp::PushMatte))
        .expect("PushMatte");
    let pop_at = frame
        .ops
        .iter()
        .position(|op| matches!(op, DrawOp::PopMatte { mode: 0 }))
        .expect("PopMatte alpha");
    assert!(matte_at < pop_at);
    let fills = frame
        .ops
        .iter()
        .filter(|op| matches!(op, DrawOp::FillRect { .. }))
        .count();
    assert_eq!(fills, 2, "the red box once, the mask source once; the source is no longer drawn a second time in the normal flow");

    let assets = Arc::new(LoadedAssets::default());
    let mut media = MediaStore::new(assets, ir.fps);
    let pixmap = renderer.draw(&ir, &mut engine, &mut media, 1.0).unwrap();
    assert_eq!(pixel(&pixmap, 50, 50), [255, 255, 255, 255], "outside the mask is the background");
    assert_eq!(
        pixel(&pixmap, 200, 100),
        [255, 0, 0, 255],
        "inside the mask is the red box, not the blue source"
    );
    assert_eq!(pixel(&pixmap, 149, 100), [255, 255, 255, 255]);
}

/// `style.background` gradient object (§6.3) → `FillPathPaint`, with the two colors landing at their respective endpoints.
#[test]
fn gradient_background_fills_with_a_paint_side_table() {
    let mut ir = resolve_doc(small_doc(serde_json::json!([
        {"type": "box", "id": "g",
         "style": {"x": 0, "y": 0, "width": 400, "height": 200,
                   "background": {"kind": "linear", "angle": 90,
                                  "stops": [{"at": 0, "color": "#000000"}, {"at": 1, "color": "#ffffff"}]}}}
    ])));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let frame = renderer.record(&ir, &mut engine, 1.0);
    assert!(
        frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::FillPathPaint { .. }))
    );
    assert!(matches!(
        frame.paints.first(),
        Some(drawop::PaintData::Linear { .. })
    ));
    let assets = Arc::new(LoadedAssets::default());
    let mut media = MediaStore::new(assets, ir.fps);
    let pixmap = renderer.draw(&ir, &mut engine, &mut media, 1.0).unwrap();
    let left = pixel(&pixmap, 2, 100);
    let right = pixel(&pixmap, 397, 100);
    assert!(left[0] < 20, "left end is near black {left:?}");
    assert!(right[0] > 235, "right end is near white {right:?}");
    let mid = pixel(&pixmap, 200, 100);
    assert!((100..=160).contains(&mid[0]), "midpoint is mid-gray {mid:?}");
}

/// `style.border` (§6.3): an even-odd fill of a ring just inside the box, following the rounded corners; without a background, the picture below shows through the middle.
#[test]
fn border_paints_an_inner_ring_that_follows_the_radius() {
    let mut ir = resolve_doc(small_doc(serde_json::json!([
        {"type": "box", "id": "ring",
         "style": {"x": 100, "y": 50, "width": 200, "height": 100, "borderRadius": 20,
                   "border": {"width": 10, "color": "#ff0000"}}},
        {"type": "box", "id": "square",
         "style": {"x": 320, "y": 50, "width": 60, "height": 60, "background": "#0000ff",
                   "border": {"width": 6, "color": "#000000"}}}
    ])));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let frame = renderer.record(&ir, &mut engine, 1.0);
    let rings = frame
        .ops
        .iter()
        .filter(|op| matches!(op, DrawOp::FillPathPaint { even_odd: true, .. }))
        .count();
    assert_eq!(rings, 2, "one ring per box");
    assert!(
        frame
            .paints
            .iter()
            .all(|p| matches!(p, drawop::PaintData::Solid(_)))
    );
    let assets = Arc::new(LoadedAssets::default());
    let mut media = MediaStore::new(assets, ir.fps);
    let pixmap = renderer.draw(&ir, &mut engine, &mut media, 1.0).unwrap();
    assert_eq!(pixel(&pixmap, 104, 100), [255, 0, 0, 255], "the left ring");
    assert_eq!(pixel(&pixmap, 200, 145), [255, 0, 0, 255], "the bottom ring");
    assert_eq!(
        pixel(&pixmap, 115, 100),
        [255, 255, 255, 255],
        "the inside of the ring shows the background"
    );
    assert_eq!(
        pixel(&pixmap, 200, 100),
        [255, 255, 255, 255],
        "no background: the middle is empty"
    );
    assert_eq!(
        pixel(&pixmap, 101, 51),
        [255, 255, 255, 255],
        "the rounded corners cut off the box corners"
    );
    assert_eq!(
        pixel(&pixmap, 321, 51),
        [0, 0, 0, 255],
        "no rounded corners: the box corners are sharp"
    );
    assert_eq!(
        pixel(&pixmap, 350, 80),
        [0, 0, 255, 255],
        "the stroke is drawn above the background and only takes up the inner ring"
    );
    assert_eq!(pixel(&pixmap, 316, 80), [255, 255, 255, 255], "does not expand outward");
}

/// `skewX` (§6.4) is an affine transform: a positive angle pushes the bottom edge of the box to the right and the top edge to the left (CSS convention).
#[test]
fn skew_x_channel_shears_the_box() {
    let mut ir = resolve_doc(small_doc(serde_json::json!([
        {"type": "box", "id": "b",
         "style": {"x": 150, "y": 50, "width": 100, "height": 100, "background": "#000000"},
         "animate": {"keyframes": [{"prop": "skewX",
             "frames": [{"t": 0, "v": 30}, {"t": 2, "v": 30}]}]}}
    ])));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let assets = Arc::new(LoadedAssets::default());
    let mut media = MediaStore::new(assets, ir.fps);
    let pixmap = renderer.draw(&ir, &mut engine, &mut media, 1.0).unwrap();
    // Anchor at box center: the bottom edge shifts right by tan(30°)·50 ≈ 29px, and the top edge shifts left by the same distance.
    assert_eq!(
        pixel(&pixmap, 260, 140),
        [0, 0, 0, 255],
        "bottom-right is pushed into the box"
    );
    assert_eq!(
        pixel(&pixmap, 260, 60),
        [255, 255, 255, 255],
        "top-right is left empty"
    );
    assert_eq!(
        pixel(&pixmap, 140, 60),
        [0, 0, 0, 255],
        "top-left is pushed into the box"
    );
}

#[test]
fn golden_frame_rasterizes_without_media_assets() {
    let mut ir = golden_ir();
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let assets = Arc::new(LoadedAssets::default());
    let mut media = MediaStore::new(assets, ir.fps);

    let pixmap = renderer.draw(&ir, &mut engine, &mut media, 10.5).unwrap();

    assert_eq!((pixmap.width(), pixmap.height()), (1920, 1080));
    let first = &pixmap.data()[..4];
    assert!(
        pixmap.data().chunks_exact(4).any(|pixel| pixel != first),
        "rendered frame should contain foreground pixels"
    );
}
