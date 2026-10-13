//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer`
//! (the BCF document rendering path and the host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
//! v3: the `program` asset requires `ccut-compile` (not ported, architecture design §13.6), so this file is gated on the placeholder `program` feature and is not compiled.
#![cfg(feature = "program")]

//! End-to-end semantics of the `program` element (spec §6.5.3): module graph loading → resolve → quantization against the frame table at recording time → QuickJS produces SVG per frame → resvg rasterizes to get pixels.
//!
//! The fixture lives in `core/fixtures/program/`: `frames.tsx` encodes the frame number into the whole-canvas background color (r = frame % 256, g = frame / 256), so sampling one pixel reads back which frame was drawn.

use render_raster::drawop::DrawOp;
use render_raster::{
    FramePlanner, FrameRenderer, LoadedAssets, MediaStore, TextEngine, load_assets,
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/program")
}

/// Frame-number program: 16×8, `frames` frames, same frame rate as the document; the clip starts at document frame `start_frame`.
fn frames_doc(fps: f64, frames: u32, start_frame: u32, element: Value) -> Value {
    let start = f64::from(start_frame) / fps;
    let end = start + f64::from(frames) / fps + 1.0;
    json!({
        "meta": { "id": "pg", "width": 16, "height": 8, "fps": fps },
        "scenes": [ { "id": "a", "dur": end + 1.0, "desc": "程序元素" } ],
        "assets": { "prog": {
            "type": "program", "src": "frames.tsx", "export": "Frames",
            "width": 16, "height": 8, "fps": fps, "frames": frames
        } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "shot", "start": start, "end": end, "element": element }
            ] }
        ]
    })
}

fn element(extra: Value) -> Value {
    let mut el = json!({
        "type": "program", "id": "p1", "src": "$assets.prog",
        "style": { "x": 0, "y": 0, "width": 16, "height": 8 }
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
    planner: FramePlanner,
}

fn build(doc: Value) -> Harness {
    let assets = Arc::new(load_assets(&doc, &fixture_dir()).expect("load_assets"));
    build_with(doc, assets)
}

fn build_with(doc: Value, assets: Arc<LoadedAssets>) -> Harness {
    let lints = scene_primitives::lint::lint(&doc);
    let errors: Vec<String> = lints
        .iter()
        .filter(|d| d.severity == scene_primitives::lint::Severity::Error)
        .map(|d| format!("{} {} {}", d.rule, d.pointer, d.message))
        .collect();
    assert!(errors.is_empty(), "document should have zero lint errors: {errors:?}");

    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let mut ir = resolver.resolve().unwrap();
    let mut engine = TextEngine::for_document(&assets.fonts);
    let renderer = FrameRenderer::new_with_assets(&mut ir, &mut engine, &assets).unwrap();
    let planner = FramePlanner::cpu_with_assets(&ir, &assets).unwrap();
    let media = MediaStore::new(assets, ir.fps);
    Harness {
        ir,
        engine,
        renderer,
        media,
        planner,
    }
}

impl Harness {
    /// Source milliseconds recorded by `DrawMedia` at this moment (= frame start).
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
        assert_eq!(hits.len(), 1, "t={t} should have exactly one DrawMedia");
        hits[0]
    }

    /// Takes the pixel at (x, y) at this moment, via the frame plan and the CPU executor (which take the same path as export).
    fn pixel_at(&mut self, t: f64, x: u32, y: u32) -> (u8, u8, u8, u8) {
        let pm = self
            .planner
            .render(
                &self.renderer,
                &self.ir,
                &mut self.engine,
                &mut self.media,
                t,
            )
            .expect("render");
        let p = pm.pixel(x, y).unwrap();
        (p.red(), p.green(), p.blue(), p.alpha())
    }

    /// Reads back the frame number drawn by `frames.tsx`.
    fn drawn_frame(&mut self, t: f64) -> u32 {
        let (r, g, b, a) = self.pixel_at(t, 8, 4);
        assert_eq!((b, a), (7, 255), "t={t} is not the background color of the frame-number program");
        u32::from(r) + 256 * u32::from(g)
    }

    /// Key for the export frame cache: two frames with the same key reuse the same picture.
    fn fingerprint(&mut self, t: f64) -> u64 {
        let plan = self
            .planner
            .plan(&self.renderer, &self.ir, &mut self.engine, t);
        plan.frame_fingerprints().expect("fingerprint").0
    }
}

fn starts(fps: f64, frames: u32) -> Vec<i64> {
    (0..=frames)
        .map(|k| (f64::from(k) * 1000.0 / fps).round() as i64)
        .collect()
}

/// When the document frame rate equals the program frame rate, the k-th document frame in the clip draws program frame k, including frame rates whose frame starts land on half-millisecond values (frame 3 at 48 fps is 62.5 ms) and clips that do not start at 0.
#[test]
fn document_frames_map_one_to_one_onto_program_frames() {
    for fps in [24.0, 25.0, 30000.0 / 1001.0, 30.0, 48.0, 60.0] {
        let frames = 40;
        for start_frame in [0, 7] {
            let mut h = build(frames_doc(fps, frames, start_frame, element(json!({}))));
            let table = starts(fps, frames);
            for k in 0..frames {
                let t = f64::from(start_frame + k) / fps;
                assert_eq!(
                    h.media_ms(t),
                    table[k as usize],
                    "fps={fps} start={start_frame} k={k}"
                );
                assert_eq!(h.drawn_frame(t), k, "fps={fps} start={start_frame} k={k}");
            }
        }
    }
}

/// Export reuses pictures by frame-plan fingerprint: adjacent frames must have different fingerprints, and two document frames within the same program frame (document 60 fps, program 30 fps) must be identical.
#[test]
fn the_export_frame_cache_keys_on_the_program_frame() {
    let mut doc = frames_doc(60.0, 30, 0, element(json!({})));
    doc["assets"]["prog"]["fps"] = json!(30.0);
    let mut h = build(doc);
    for k in 0..29u32 {
        let (a, b) = (f64::from(2 * k) / 60.0, f64::from(2 * k + 1) / 60.0);
        assert_eq!(h.fingerprint(a), h.fingerprint(b), "k={k} same program frame");
        assert_eq!(h.drawn_frame(b), k);
        let next = f64::from(2 * k + 2) / 60.0;
        assert_ne!(h.fingerprint(a), h.fingerprint(next), "k={k} adjacent program frame");
    }
}

/// `playbackRate` / `loop` use the same formulas as video and animated images.
#[test]
fn playback_rate_and_loop_fold_like_other_timed_media() {
    let fps = 30.0;
    // rate 2: document frame f draws program frame 2f; a 10-frame program loops by default.
    let mut h = build(frames_doc(
        fps,
        10,
        0,
        element(json!({ "playbackRate": 2.0 })),
    ));
    for f in 0..12u32 {
        assert_eq!(h.drawn_frame(f64::from(f) / fps), (2 * f) % 10, "f={f}");
    }
    // loop false: freezes on the last frame after playback ends.
    let mut h = build(frames_doc(fps, 10, 0, element(json!({ "loop": false }))));
    assert_eq!(h.drawn_frame(9.0 / fps), 9);
    assert_eq!(h.drawn_frame(25.0 / fps), 9);
}

fn sprite_doc(files: Value, props: Value) -> Value {
    json!({
        "meta": { "id": "sp", "width": 32, "height": 16, "fps": 30 },
        "scenes": [ { "id": "a", "dur": 1, "desc": "程序元素" } ],
        "assets": { "prog": {
            "type": "program", "src": "sprite.tsx", "export": "Sprite",
            "width": 32, "height": 16, "fps": 30, "frames": 30,
            "files": files, "props": props
        } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "shot", "start": 0, "end": 1, "element": {
                    "type": "program", "id": "p1", "src": "$assets.prog",
                    "style": { "x": 0, "y": 0, "width": 32, "height": 16 }
                } }
            ] }
        ]
    })
}

/// Relative imports, `asset()` taking an SVG from `files`, and an HTML box are all drawn.
#[test]
fn modules_files_and_html_boxes_render() {
    let mut h = build(sprite_doc(json!(["dot.svg"]), json!({})));
    assert_eq!(h.pixel_at(0.0, 4, 8), (0xe0, 0x20, 0x20, 255), "dot.svg");
    assert_eq!(h.pixel_at(0.0, 24, 8), (0xf0, 0xd0, 0x00, 255), "HTML box");
}

/// `asset()` references a file outside `files`: the first-frame probe at load time reports `program-file-missing`, without reading from disk (the file is actually in the fixture directory).
#[test]
fn a_file_outside_files_is_reported_not_read() {
    let doc = sprite_doc(json!([]), json!({}));
    let Err(err) = load_assets(&doc, &fixture_dir()) else {
        panic!("should report an error");
    };
    let text = format!("{err:#}");
    assert!(text.starts_with("program-file-missing"), "{text}");
    assert!(
        text.contains("asset \"prog\"") && text.contains("dot.svg"),
        "{text}"
    );
}

/// An `asset()` path escapes the document directory with `..`. This is only known at evaluation time, so the first-frame probe at load time reports `program-path-escape` (the same code lint uses for `src` / `imports` / `files`), and the message names the path and the fix.
#[test]
fn an_asset_path_escaping_the_document_directory_is_program_path_escape() {
    let doc = sprite_doc(json!(["dot.svg"]), json!({ "src": "../program/dot.svg" }));
    let Err(err) = load_assets(&doc, &fixture_dir()) else {
        panic!("should report an error");
    };
    let text = format!("{err:#}");
    assert!(text.starts_with("program-path-escape: "), "{text}");
    for needle in [
        "asset \"prog\"",
        "asset()",
        "\"../program/dot.svg\"",
        "the document's directory",
        "project root",
    ] {
        assert!(text.contains(needle), "missing {needle}: {text}");
    }
}

/// A construct the runtime recognizes but cannot draw (here `textShadow`) raises a `program-degraded` warning at load time; the picture is still drawn.
#[test]
fn unsupported_styles_surface_as_degraded_warnings() {
    let doc = sprite_doc(json!(["dot.svg"]), json!({ "odd": true }));
    let assets = load_assets(&doc, &fixture_dir()).expect("load_assets");
    let degraded: Vec<&str> = assets
        .source_diagnostics
        .iter()
        .filter(|d| d.rule == "program-degraded")
        .map(|d| d.message.as_str())
        .collect();
    assert_eq!(degraded.len(), 1, "{degraded:?}");
    assert!(
        degraded[0].contains("asset \"prog\"") && degraded[0].contains("textShadow"),
        "{degraded:?}"
    );

    let clean = load_assets(&sprite_doc(json!(["dot.svg"]), json!({})), &fixture_dir()).unwrap();
    assert!(clean.source_diagnostics.is_empty());
}

/// An export from `backdrop.tsx`; the whole picture is drawn on `width`×`height`.
fn backdrop_doc(export: &str, width: u32, height: u32) -> Value {
    json!({
        "meta": { "id": "bd", "width": width, "height": height, "fps": 30 },
        "scenes": [ { "id": "a", "dur": 1, "desc": "程序元素" } ],
        "assets": { "prog": {
            "type": "program", "src": "backdrop.tsx", "export": export,
            "width": width, "height": height, "fps": 30, "frames": 30
        } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "shot", "start": 0, "end": 1, "element": {
                    "type": "program", "id": "p1", "src": "$assets.prog",
                    "style": { "x": 0, "y": 0, "width": width, "height": height }
                } }
            ] }
        ]
    })
}

/// `backdropFilter` blurs what has already been drawn behind the box (also when the box is nested in flex, transform and overflow:hidden), and only inside the box. A parent with `opacity < 1` is the backdrop root, so the box can only see what was drawn earlier inside that parent.
#[test]
fn backdrop_filter_blurs_what_is_behind_inside_its_root() {
    let mut h = build(backdrop_doc("Backdrop", 64, 32));
    let white = (255, 255, 255, 255);
    let black = (0, 0, 0, 255);
    // Outside the box (8..24): stripes unchanged
    assert_eq!(h.pixel_at(0.0, 2, 16), white);
    assert_eq!(h.pixel_at(0.0, 3, 16), black);
    assert_eq!(h.pixel_at(0.0, 16, 4), white);
    // Inside the box: stripes blurred to uniform grey
    let inside: Vec<u8> = (10..22).map(|x| h.pixel_at(0.0, x, 16).0).collect();
    let lo = *inside.iter().min().unwrap();
    let hi = *inside.iter().max().unwrap();
    assert!(
        hi - lo < 24 && lo > 90 && hi < 170,
        "the box should be gray: {inside:?}"
    );
    // Right half: the parent is its own backdrop root and nothing was drawn inside it before the box, so the stripes are not blurred
    assert_eq!(h.pixel_at(0.0, 40, 16), white);
    assert_eq!(h.pixel_at(0.0, 41, 16), black);
    assert!(h.planner.report().diagnostics.is_empty());
}

/// An `<svg>` in flex that has only `width` / `height` attributes participates in layout at this intrinsic size (centered).
#[test]
fn flex_items_use_the_intrinsic_size_of_svg() {
    let mut h = build(backdrop_doc("FlexIcon", 88, 88));
    let red = (0xe0, 0x20, 0x20, 255);
    let bg = (0x20, 0x30, 0x40, 255);
    assert_eq!(h.pixel_at(0.0, 44, 44), red);
    assert_eq!(h.pixel_at(0.0, 21, 44), red);
    assert_eq!(h.pixel_at(0.0, 67, 44), red);
    assert_eq!(h.pixel_at(0.0, 17, 44), bg);
    assert_eq!(h.pixel_at(0.0, 71, 44), bg);
    assert_eq!(h.pixel_at(0.0, 44, 17), bg);
}

/// Load time only tries rendering the first frame. Degraded constructs and missing glyphs that only appear in later frames are reported by `render_diagnostics` after rendering, carrying the earliest frame number where they appear, and do not duplicate the load-time ones.
#[test]
fn warnings_after_the_first_frame_are_reported_after_rendering() {
    let doc = backdrop_doc("Late", 16, 16);
    let assets = Arc::new(load_assets(&doc, &fixture_dir()).expect("load_assets"));
    assert!(
        assets.source_diagnostics.is_empty(),
        "{:?}",
        assets.source_diagnostics
    );
    assert!(assets.render_diagnostics().is_empty());

    let mut h = build_with(doc, assets.clone());
    h.pixel_at(10.0 / 30.0, 0, 0);
    h.pixel_at(7.0 / 30.0, 0, 0);
    h.pixel_at(0.0, 0, 0);
    let late = assets.render_diagnostics();
    let messages: Vec<&str> = late.iter().map(|d| d.message.as_str()).collect();
    assert!(
        late.iter().all(|d| d.rule == "program-degraded"),
        "{messages:?}"
    );
    assert_eq!(late.len(), 2, "{messages:?}");
    assert!(
        messages
            .iter()
            .any(|m| m.contains("textShadow") && m.contains("from program frame 7")),
        "{messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("U+10FFFD") && m.contains("from program frame 7")),
        "{messages:?}"
    );
}

/// An export from `probes.tsx`; the whole picture is drawn on 48×24.
fn probes_doc(export: &str) -> Value {
    let mut doc = backdrop_doc(export, 48, 24);
    doc["assets"]["prog"]["src"] = json!("probes.tsx");
    doc
}

fn degraded_messages(assets: &LoadedAssets) -> Vec<String> {
    assets
        .source_diagnostics
        .iter()
        .filter(|d| d.rule == "program-degraded")
        .map(|d| d.message.clone())
        .collect()
}

/// A component rewrites mutable module-top-level state: at load time the first-frame evaluation is run twice, and if the two outputs differ it reports `program-degraded`. Read-only top-level constant tables are not reported.
#[test]
fn module_state_that_changes_across_evaluations_is_reported() {
    let stateful = load_assets(&probes_doc("Stateful"), &fixture_dir()).expect("load_assets");
    let messages = degraded_messages(&stateful);
    assert_eq!(messages.len(), 1, "{messages:?}");
    assert!(messages[0].contains("module top level"), "{messages:?}");

    let pure = load_assets(&probes_doc("Pure"), &fixture_dir()).expect("load_assets");
    assert!(
        pure.source_diagnostics.is_empty(),
        "{:?}",
        pure.source_diagnostics
    );
}

/// A font family not present in the font library (here the name contains "24pt", which must be quoted at runtime to be valid CSS): the text falls back to the default sans-serif font and is still drawn, and `program-degraded` is reported naming this font family.
#[test]
fn an_unknown_font_family_falls_back_and_is_reported() {
    let assets =
        Arc::new(load_assets(&probes_doc("UnknownFamily"), &fixture_dir()).expect("load_assets"));
    let messages = degraded_messages(&assets);
    assert_eq!(messages.len(), 1, "{messages:?}");
    assert!(messages[0].contains("「Nope 24pt」"), "{messages:?}");

    let mut h = build_with(probes_doc("UnknownFamily"), assets);
    let pm = h
        .planner
        .render(&h.renderer, &h.ir, &mut h.engine, &mut h.media, 0.0)
        .expect("render");
    let lit = pm.pixels().iter().filter(|p| p.red() > 128).count();
    assert!(lit > 40, "text should be drawn; only {lit} bright pixels");
}
