//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer` (the BCF document rendering path and the host byte layer), and it does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! End-to-end semantics of the `animatedImage` element (spec §6.5.1): asset loading → resolve →
//! quantization at record time → rasterized pixels.
//!
//! This is a companion to `video_semantics.rs`: that one verifies “quantization by source frame rate”, while this one verifies “quantization by per-frame duration table”. The rest (`mediaStart` / `playbackRate` / `segment` /
//! `loop` / `fit`) use the same formulas, so the tests deliberately compare against them with the same approach.

use render_raster::drawop::DrawOp;
use render_raster::{FrameRenderer, MediaStore, TextEngine, load_assets};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/animated")
}

/// `stripes.gif`, 8×8: 4 frames starting at 0 / 100 / 300 / 600 ms, total length 1000 ms, loops forever.
fn doc(element: Value) -> Value {
    json!({
        "meta": { "id": "ai", "width": 64, "height": 32, "fps": 25 },
        "scenes": [ { "id": "a", "dur": 4, "desc": "动图元素" } ],
        "assets": { "gif": { "type": "animatedImage", "src": "stripes.gif" } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "shot", "start": 0, "end": 4, "element": element }
            ] }
        ]
    })
}

fn element(extra: Value) -> Value {
    let mut el = json!({
        "type": "animatedImage", "id": "g1", "src": "$assets.gif",
        "style": { "x": 0, "y": 0, "width": 16, "height": 16 }
    });
    for (k, v) in extra.as_object().unwrap() {
        el.as_object_mut().unwrap().insert(k.clone(), v.clone());
    }
    el
}

struct Harness {
    ir: scene_primitives::Ir,
    engine: TextEngine,
    renderer: FrameRenderer,
    media: MediaStore,
}

fn build(element: Value) -> Harness {
    let doc = doc(element);
    let lints = scene_primitives::lint::lint(&doc);
    let errors: Vec<String> = lints
        .iter()
        .filter(|d| d.severity == scene_primitives::lint::Severity::Error)
        .map(|d| format!("{} {} {}", d.rule, d.pointer, d.message))
        .collect();
    assert!(errors.is_empty(), "文档应当零 lint 错误：{errors:?}");

    let assets = Arc::new(load_assets(&doc, &fixture_dir()).expect("load_assets"));
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let mut ir = resolver.resolve().unwrap();
    let mut engine = TextEngine::with_document_fonts(&[]);
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let media = MediaStore::new(assets, ir.fps);
    Harness {
        ir,
        engine,
        renderer,
        media,
    }
}

impl Harness {
    /// The source milliseconds recorded by `DrawMedia` at this moment (= the frame start).
    fn media_ms(&mut self, t: f64) -> i64 {
        let frame = self.renderer.record(&self.ir, &mut self.engine, t);
        let hits: Vec<i64> = frame
            .ops
            .iter()
            .filter_map(|op| match op {
                DrawOp::DrawMedia { media_ms, .. } => Some(*media_ms),
                _ => None,
            })
            .collect();
        assert_eq!(hits.len(), 1, "t={t} 应恰有一个 DrawMedia");
        hits[0]
    }

    /// The pixel at the canvas's top-left corner at this moment (the animated image is laid out at (0,0), so the sample point is guaranteed to fall inside the image).
    fn pixel(&mut self, t: f64) -> (u8, u8, u8, u8) {
        let frame = self.renderer.record(&self.ir, &mut self.engine, t);
        let pm = render_raster::rasterize_with_media(
            &frame,
            self.ir.w as u32,
            self.ir.h as u32,
            &mut self.media,
        )
        .expect("光栅化");
        let p = pm.pixel(1, 1).unwrap();
        (p.red(), p.green(), p.blue(), p.alpha())
    }
}

const RED: (u8, u8, u8, u8) = (0xe0, 0x20, 0x20, 255);
const GREEN: (u8, u8, u8, u8) = (0x20, 0xc0, 0x20, 255);
const BLUE: (u8, u8, u8, u8) = (0x20, 0x40, 0xe0, 255);
const YELLOW: (u8, u8, u8, u8) = (0xf0, 0xd0, 0x00, 255);

/// Duration-table quantization: every time within one frame's window records the same `media_ms`, and it jumps only across frames.
#[test]
fn the_duration_table_drives_the_recorded_source_time() {
    let mut h = build(element(json!({})));
    for (t, want) in [
        (0.0, 0),
        (0.04, 0),
        (0.08, 0),
        (0.1, 100),
        (0.28, 100),
        (0.3, 300),
        (0.56, 300),
        (0.6, 600),
        (0.96, 600),
    ] {
        assert_eq!(h.media_ms(t), want, "t={t}");
    }
}

/// With no `loop` declaration ⇒ the loop count embedded in the asset is used. `stripes.gif` loops forever, so the second pass starts from the beginning.
#[test]
fn the_intrinsic_loop_count_supplies_the_default() {
    let mut h = build(element(json!({})));
    assert_eq!(h.media_ms(1.0), 0, "1.0s 回到第 0 帧");
    assert_eq!(h.media_ms(1.35), 300);
    assert_eq!(h.media_ms(3.7), 600, "第四遍仍在循环");
    assert_eq!(h.pixel(1.05), RED);
    assert_eq!(h.pixel(3.65), YELLOW);
}

/// `loop: false` ⇒ after one pass, the last frame is frozen.
#[test]
fn an_explicit_loop_false_freezes_on_the_last_frame() {
    let mut h = build(element(json!({ "loop": false })));
    assert_eq!(h.media_ms(0.65), 600);
    assert_eq!(h.media_ms(1.0), 600, "越过总时长即冻结");
    assert_eq!(h.media_ms(3.9), 600);
    assert_eq!(h.pixel(3.9), YELLOW);
}

/// `mediaStart` / `playbackRate` / `segment` have the same structure as the §6.5 video formulas.
#[test]
fn media_start_rate_and_segment_fold_like_video() {
    // segment [0.1, 0.6): only frames 1 and 2 play; rate 2 ⇒ 1 s of document time covers 2 s of source time
    let mut h = build(element(
        json!({ "segment": [0.1, 0.6], "playbackRate": 2.0 }),
    ));
    // mediaStart default = segment start = 0.1 s
    assert_eq!(h.media_ms(0.0), 100);
    // t=0.1 → src = 0.1 + 0.2 = 0.3 → frame 2
    assert_eq!(h.media_ms(0.1), 300);
    // t=0.25 → src = 0.1 + 0.5 = 0.6 → wraps back to the segment start 0.1 → frame 1
    assert_eq!(h.media_ms(0.25), 100);
    assert_eq!(h.pixel(0.25), GREEN);
    assert_eq!(h.pixel(0.1), BLUE);

    // An explicit mediaStart lands on frame 2
    let mut h = build(element(json!({ "mediaStart": 0.35 })));
    assert_eq!(h.media_ms(0.0), 300);
    assert_eq!(h.pixel(0.0), BLUE);
}

/// An asset with a finite loop count (`disposal.gif` declares 2 passes): freezes after playing through, and an explicit `loop: true` can override it.
#[test]
fn a_finite_loop_count_stops_after_its_plays() {
    let with = |el: Value| {
        let mut doc = doc(el);
        doc["assets"]["gif"]["src"] = json!("disposal.gif");
        doc
    };
    let run = |doc: Value| {
        let assets = Arc::new(load_assets(&doc, &fixture_dir()).expect("load_assets"));
        let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
        resolver.set_host_inputs(assets.inputs.clone());
        let mut ir = resolver.resolve().unwrap();
        let mut engine = TextEngine::with_document_fonts(&[]);
        let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
        let media = MediaStore::new(assets, ir.fps);
        Harness {
            ir,
            engine,
            renderer,
            media,
        }
    };
    // Total length 300 ms, 2 passes ⇒ after 600 ms, frozen at the last frame's start, 200 ms
    let mut h = run(with(element(json!({}))));
    assert_eq!(h.media_ms(0.35), 0, "0.35s 折回第二遍的第 0 帧");
    assert_eq!(h.media_ms(0.45), 100, "第二遍的第 1 帧");
    assert_eq!(h.media_ms(0.6), 200, "两遍放完，冻结末帧");
    assert_eq!(h.media_ms(3.9), 200);
    // An explicit loop: true overrides the asset's declaration
    let mut h = run(with(element(json!({ "loop": true }))));
    assert_eq!(h.media_ms(0.6), 0, "第三遍从头开始");
    assert_eq!(h.media_ms(3.88), 200, "第 13 遍的末帧");
}

/// Out-of-order recording is byte-for-byte identical to in-order recording. Rendering is out of order and parallel, so this is not optional.
#[test]
fn shuffled_recording_matches_sorted_recording() {
    let mut h = build(element(json!({})));
    let times: Vec<f64> = (0..40).map(|i| i as f64 * 0.1).collect();
    let sorted: Vec<i64> = times.iter().map(|t| h.media_ms(*t)).collect();

    let mut h = build(element(json!({})));
    let mut shuffled = vec![i64::MIN; times.len()];
    let mut state = 0x9e3779b97f4a7c15u64;
    let mut order: Vec<usize> = (0..times.len()).collect();
    for i in (1..order.len()).rev() {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        order.swap(i, (state >> 33) as usize % (i + 1));
    }
    for i in order {
        shuffled[i] = h.media_ms(times[i]);
    }
    assert_eq!(sorted, shuffled);
}

/// Frame fingerprint: two times within the same animated-image frame have the same fingerprint, and across frames they always differ. The static frame cache relies on this for reuse, and also relies on it to avoid misuse.
#[test]
fn frame_fingerprints_change_exactly_at_frame_boundaries() {
    let mut h = build(element(json!({})));
    let fp = |h: &mut Harness, t: f64| {
        let frame = h.renderer.record(&h.ir, &mut h.engine, t);
        render_raster::fingerprint(&frame)
    };
    assert_eq!(fp(&mut h, 0.0), fp(&mut h, 0.08), "同一帧内指纹不变");
    assert_ne!(fp(&mut h, 0.08), fp(&mut h, 0.12), "跨帧指纹必须变");
    assert_eq!(fp(&mut h, 0.12), fp(&mut h, 0.28));
}

/// The static-image path is unaffected: the `image` element still has `media_ms = -1` with stretch (fill) semantics.
#[test]
fn the_static_image_path_is_untouched() {
    let doc = json!({
        "meta": { "id": "im", "width": 64, "height": 32, "fps": 25 },
        "scenes": [ { "id": "a", "dur": 1, "desc": "静态图" } ],
        "assets": { "card": { "type": "image", "src": "../assets/card.png" } },
        "tracks": [ { "id": "main", "kind": "visual", "clips": [
            { "id": "shot", "start": 0, "end": 1, "element": {
                "type": "image", "id": "i1", "src": "$assets.card",
                "style": { "x": 0, "y": 0, "width": 16, "height": 16 } } }
        ] } ]
    });
    let assets = load_assets(&doc, &fixture_dir()).expect("load_assets");
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let mut ir = resolver.resolve().unwrap();
    let mut engine = TextEngine::with_document_fonts(&[]);
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let frame = renderer.record(&ir, &mut engine, 0.5);
    let ops: Vec<_> = frame
        .ops
        .iter()
        .filter_map(|op| match op {
            DrawOp::DrawMedia { media_ms, src, .. } => Some((*media_ms, *src)),
            _ => None,
        })
        .collect();
    assert_eq!(ops, vec![(-1, [0.0f32; 4])], "静态图仍是 -1 + 整幅源");
}

/// When a GIF is declared as `type: "image"`, the error should point to `animatedImage` instead of simply saying “unsupported image format”.
#[test]
fn a_gif_declared_as_a_plain_image_points_at_animated_image() {
    let doc = json!({
        "meta": { "id": "bad", "width": 64, "height": 32, "fps": 25 },
        "scenes": [ { "id": "a", "dur": 1, "desc": "错声明" } ],
        "assets": { "gif": { "type": "image", "src": "stripes.gif" } },
        "tracks": [ { "id": "main", "kind": "visual", "clips": [
            { "id": "shot", "start": 0, "end": 1, "element": {
                "type": "image", "id": "i1", "src": "$assets.gif",
                "style": { "x": 0, "y": 0, "width": 16, "height": 16 } } }
        ] } ]
    });
    let err = match load_assets(&doc, &fixture_dir()) {
        Ok(_) => panic!("静态图解码器不该收下 GIF"),
        Err(e) => e,
    };
    let text = format!("{err:#}");
    assert!(text.contains("animatedImage"), "{text}");
}

/// `asset-kind-mismatch`: an `animatedImage` element referencing an `image` asset must be blocked at lint time.
#[test]
fn the_element_and_asset_kinds_must_agree() {
    let mut doc = doc(element(json!({})));
    doc["assets"]["gif"]["type"] = json!("image");
    let codes: Vec<String> = scene_primitives::lint::lint(&doc)
        .iter()
        .map(|d| d.rule.to_string())
        .collect();
    assert!(
        codes.iter().any(|c| c == "asset-kind-mismatch"),
        "应报 asset-kind-mismatch，实际 {codes:?}"
    );
}

/// Animated images have no audio track, so `withAudio` / `volume` is a mistake.
#[test]
fn an_animated_image_refuses_audio_fields() {
    let doc = doc(element(json!({ "withAudio": true, "volume": 0.5 })));
    let messages: Vec<String> = scene_primitives::lint::lint(&doc)
        .iter()
        .filter(|d| d.message.contains("没有音轨"))
        .map(|d| d.pointer.clone())
        .collect();
    assert_eq!(
        messages.len(),
        2,
        "withAudio 与 volume 各报一条：{messages:?}"
    );
}
