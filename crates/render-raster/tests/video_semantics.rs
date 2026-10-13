//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer` (the BCF document rendering pipeline and the host byte layer), which do not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Recording-time verification of video element media semantics (§6.5): frame-exact quantization, freezing out of range, segment/loop folding, and the transform and source cropping for the three fit modes. No media bytes (only DrawOp is checked).

use render_raster::drawop::DrawOp;
use render_raster::{FrameRenderer, TextEngine};
use serde_json::json;

/// A video with natural size 40×20, duration 2s, and source frame rate 4fps; each of the four time segments verifies one mode.
fn build() -> (scene_primitives::Ir, TextEngine, FrameRenderer) {
    let doc = json!({
        "meta": { "id": "vs", "width": 200, "height": 100, "fps": 10 },
        "scenes": [ { "id": "a", "dur": 10, "desc": "视频语义" } ],
        "assets": { "clip": { "type": "video", "src": "assets/clip.mp4" } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "cover-shot", "start": 0, "end": 3, "element": {
                    "type": "video", "id": "v1", "src": "$assets.clip",
                    "style": { "x": 0, "y": 0, "width": 20, "height": 20 } } },
                { "id": "contain-shot", "start": 3, "end": 6, "element": {
                    "type": "video", "id": "v2", "src": "$assets.clip", "fit": "contain",
                    "style": { "x": 0, "y": 0, "width": 20, "height": 20 } } },
                { "id": "fill-shot", "start": 6, "end": 9, "element": {
                    "type": "video", "id": "v3", "src": "$assets.clip", "fit": "fill",
                    "style": { "x": 0, "y": 0, "width": 20, "height": 20 } } },
                { "id": "rate-shot", "start": 9, "end": 10, "element": {
                    "type": "video", "id": "v4", "src": "$assets.clip",
                    "playbackRate": 2, "segment": [0.5, 1.5], "loop": true,
                    "style": { "x": 0, "y": 0, "width": 40, "height": 20 } } }
            ] }
        ]
    });
    let mut r = scene_primitives::Resolver::new(doc, None).unwrap();
    let mut inputs = scene_primitives::HostInputs::default();
    inputs.insert_video("clip", 40.0, 20.0, 2.0, 4.0);
    r.set_host_inputs(inputs);
    let mut ir = r.resolve().unwrap();
    let mut engine = TextEngine::with_document_fonts(&[]);
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    (ir, engine, renderer)
}

fn draw_media(
    renderer: &FrameRenderer,
    ir: &scene_primitives::Ir,
    engine: &mut TextEngine,
    t: f64,
) -> (i64, [f32; 4], [f32; 6]) {
    let frame = renderer.record(ir, engine, t);
    let media: Vec<_> = frame
        .ops
        .iter()
        .filter_map(|op| match op {
            DrawOp::DrawMedia {
                media_ms, src, tf, ..
            } => Some((*media_ms, *src, *tf)),
            _ => None,
        })
        .collect();
    assert_eq!(media.len(), 1, "t={t} should have exactly one DrawMedia");
    media[0]
}

#[test]
fn frame_exact_quantization_and_freeze() {
    let (ir, mut engine, renderer) = build();
    // t=0.9 → srcTime 0.9 → frameIndex floor(0.9×4)=3 → frame start 0.75s
    let (ms, _, _) = draw_media(&renderer, &ir, &mut engine, 0.9);
    assert_eq!(ms, 750);
    // t=1.0 → exactly on the frame 4 boundary → 1.0s
    let (ms, _, _) = draw_media(&renderer, &ir, &mut engine, 1.0);
    assert_eq!(ms, 1000);
    // t=2.5 > source duration 2s → clamped to the last frame (N−1)/fps = 7/4 = 1.75s (frozen)
    let (ms, _, _) = draw_media(&renderer, &ir, &mut engine, 2.5);
    assert_eq!(ms, 1750);
}

#[test]
fn segment_loop_and_playback_rate() {
    let (ir, mut engine, renderer) = build();
    // t=9.5: srcTime = 0.5 + (9.5−9)×2 = 1.5 → loop folds back to 0.5 → 500ms
    let (ms, _, _) = draw_media(&renderer, &ir, &mut engine, 9.5);
    assert_eq!(ms, 500);
    // t=9.2：srcTime = 0.5 + 0.2×2 = 0.9 → floor(3.6)=3 → 750ms
    let (ms, _, _) = draw_media(&renderer, &ir, &mut engine, 9.2);
    assert_eq!(ms, 750);
}

#[test]
fn fit_modes_transform_and_crop() {
    let (ir, mut engine, renderer) = build();
    // cover (default): box 20×20, natural 40×20 → s = max(0.5, 1) = 1;
    // centered source-side crop [10, 0, 20, 20]
    let (_, src, tf) = draw_media(&renderer, &ir, &mut engine, 1.0);
    assert_eq!(src, [10.0, 0.0, 20.0, 20.0]);
    assert_eq!(tf, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);

    // contain: s = min(0.5, 1) = 0.5, vertical centering offset (20−20×0.5)/2 = 5, no cropping
    let (_, src, tf) = draw_media(&renderer, &ir, &mut engine, 4.0);
    assert_eq!(src, [0.0; 4]);
    assert_eq!(tf, [0.5, 0.0, 0.0, 0.5, 0.0, 5.0]);

    // fill: non-uniform stretch sx=0.5, sy=1, no cropping
    let (_, src, tf) = draw_media(&renderer, &ir, &mut engine, 7.0);
    assert_eq!(src, [0.0; 4]);
    assert_eq!(tf, [0.5, 0.0, 0.0, 1.0, 0.0, 0.0]);
}
