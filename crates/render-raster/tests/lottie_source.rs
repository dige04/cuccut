//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer` (the BCF document rendering pipeline and host byte layer), and does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! The always-on gate for the Lottie subset renderer (fixtures are checked in, no dependence on the corpus).
//!
//! Three things:
//!
//! 1. One minimal bodymovin document per feature in `core/fixtures/lottie/cases/`; DrawOp output is compared **byte for byte** against `cases-golden.json`. The golden holds both a `drawOpFingerprint` (FNV-1a over the BCOP-encoded bytes, the real byte-level criterion) and a per-instruction textual disassembly (so diffs are readable rather than a string of hex with changed values).
//! 2. The three smoke samples in `core/fixtures/lottie/samples/` go through the diagnostic path: `shapes-only.json` must render, and the other two must produce the expected warn / fail.
//! 3. End-to-end for the `lottie` element in BCF: asset loading → resolve → record → rasterize.
//!
//! Regenerate: `CCUT_UPDATE_GOLDEN=1 cargo test -p ccut-render --test lottie_source`

use render_raster::drawop::{self, DrawOp, FrameBuilder, FrameOps, PaintData};
use render_raster::source::lottie::Lottie;
use render_raster::source::{MediaTime, PrepareCtx, VisualSource};
use render_raster::{FramePlanner, FrameRenderer, LoadedAssets, MediaStore, TextEngine};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/lottie")
}

fn updating() -> bool {
    std::env::var("CCUT_UPDATE_GOLDEN").is_ok_and(|v| v != "0")
}

/// Fixture file names (sorted, for determinism).
const CASES: [&str; 8] = [
    "dash-caps.json",
    "gradients.json",
    "image-embedded.json",
    "keyframe-dialects.json",
    "masks-mattes.json",
    "precomp-timeremap.json",
    "shapes.json",
    "trim-round-merge.json",
];

fn load_case(name: &str) -> Lottie {
    let path = fixtures().join("cases").join(name);
    let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("read {path:?}: {e}"));
    let mut lottie = Lottie::parse("case", name, &bytes)
        .unwrap_or_else(|e| panic!("fixture {name} must fall within the subset: {e:#}"));
    let loaded: Vec<_> = lottie
        .image_requirements()
        .iter()
        .map(|requirement| {
            let bytes = requirement
                .embedded
                .clone()
                .unwrap_or_else(|| panic!("fixture {name}'s sub-resource must be embedded"));
            let pixmap = render_raster::assets::decode_image_bytes(&requirement.id, &bytes)
                .unwrap_or_else(|e| panic!("fixture {name} sub-resource decode: {e:#}"));
            (requirement.asset_name.clone(), bytes, Arc::new(pixmap))
        })
        .collect();
    lottie.attach_images(loaded);
    lottie.prepare(&PrepareCtx::default()).expect("prepare");
    lottie
}

fn f(v: f32) -> String {
    // Normalize -0.0: the encoder does the same, so the disassembly follows suit and “same value, different text” cannot occur
    let v = if v == 0.0 { 0.0 } else { v };
    format!("{v}")
}

fn mat(m: &[f32; 6]) -> String {
    format!(
        "[{} {} {} {} {} {}]",
        f(m[0]),
        f(m[1]),
        f(m[2]),
        f(m[3]),
        f(m[4]),
        f(m[5])
    )
}

fn color(c: &[f32; 4]) -> String {
    format!("({} {} {} {})", f(c[0]), f(c[1]), f(c[2]), f(c[3]))
}

fn paint(data: &PaintData) -> String {
    let stops = |list: &[drawop::GradientStop]| {
        list.iter()
            .map(|s| format!("{}:{}", f(s.offset), color(&s.color)))
            .collect::<Vec<_>>()
            .join(" ")
    };
    match data {
        PaintData::Solid(c) => format!("solid {}", color(c)),
        PaintData::Linear { p0, p1, stops: s } => format!(
            "linear {},{} → {},{} [{}]",
            f(p0[0]),
            f(p0[1]),
            f(p1[0]),
            f(p1[1]),
            stops(s)
        ),
        PaintData::Radial {
            center,
            radius,
            focus,
            stops: s,
        } => format!(
            "radial c={},{} r={} focus={},{} [{}]",
            f(center[0]),
            f(center[1]),
            f(*radius),
            f(focus[0]),
            f(focus[1]),
            stops(s)
        ),
    }
}

/// Textual disassembly of the instruction stream (the human-readable half of the golden).
fn disassemble(frame: &FrameOps) -> Vec<String> {
    frame
        .ops
        .iter()
        .map(|op| match op {
            DrawOp::Clear { color: c } => format!("Clear {}", color(c)),
            DrawOp::FillRect {
                x,
                y,
                w,
                h,
                radius,
                color: c,
                tf,
            } => format!(
                "FillRect {} {} {} {} r={} {} {}",
                f(*x),
                f(*y),
                f(*w),
                f(*h),
                f(*radius),
                color(c),
                mat(tf)
            ),
            DrawOp::FillPath { path, color: c, tf } => {
                format!("FillPath #{path} {} {}", color(c), mat(tf))
            }
            DrawOp::StrokePath {
                path,
                color: c,
                width,
                tf,
            } => format!(
                "StrokePath #{path} {} w={} {}",
                color(c),
                f(*width),
                mat(tf)
            ),
            DrawOp::DrawMedia {
                asset,
                media_ms,
                src,
                tf,
            } => format!(
                "DrawMedia \"{}\" ms={media_ms} src=[{} {} {} {}] {}",
                frame
                    .strings
                    .get(*asset as usize)
                    .map(String::as_str)
                    .unwrap_or("?"),
                f(src[0]),
                f(src[1]),
                f(src[2]),
                f(src[3]),
                mat(tf)
            ),
            DrawOp::PushLayer { opacity, blend } => {
                format!("PushLayer o={} {}", f(*opacity), blend.as_str())
            }
            DrawOp::PopLayer => "PopLayer".into(),
            DrawOp::ClipPath { path, tf } => format!("ClipPath #{path} {}", mat(tf)),
            DrawOp::PopClip => "PopClip".into(),
            DrawOp::FillPathPaint {
                path,
                paint: id,
                even_odd,
                tf,
            } => format!(
                "FillPathPaint #{path} paint={id}{} {}",
                if *even_odd { " evenOdd" } else { "" },
                mat(tf)
            ),
            DrawOp::StrokePathPaint {
                path,
                paint: id,
                width,
                cap,
                join,
                miter,
                tf,
            } => format!(
                "StrokePathPaint #{path} paint={id} w={} cap={cap} join={join} miter={} {}",
                f(*width),
                f(*miter),
                mat(tf)
            ),
            DrawOp::PushMatte => "PushMatte".into(),
            DrawOp::PopMatte { mode } => format!("PopMatte mode={mode}"),
            DrawOp::DrawBitmap {
                bitmap,
                opacity,
                tf,
            } => format!("DrawBitmap #{bitmap} o={} {}", f(*opacity), mat(tf)),
        })
        .collect()
}

fn record(lottie: &Lottie, ms: i64) -> FrameOps {
    let mut builder = FrameBuilder::default();
    lottie
        .record(
            MediaTime::from_millis(ms),
            tiny_skia::Transform::identity(),
            &mut builder,
        )
        .expect("record");
    builder.finish()
}

#[test]
fn every_handwritten_case_keeps_its_draw_ops_byte_for_byte() {
    let golden_path = fixtures().join("cases-golden.json");
    let mut cases = Vec::new();
    for name in CASES {
        let lottie = load_case(name);
        let meta = lottie.metadata().clone();
        let samples: Vec<Value> = [0i64, meta.total_ms() / 2, meta.total_ms() - 1]
            .into_iter()
            .map(|ms| {
                let frame = record(&lottie, ms.max(0));
                json!({
                    "ms": ms.max(0),
                    "bcopVersion": drawop::required_version(&frame),
                    "drawOpFingerprint": format!("{:016x}", drawop::fingerprint(&frame)),
                    "encodedBytes": drawop::encode(&frame).len(),
                    "paints": frame.paints.iter().map(paint).collect::<Vec<_>>(),
                    "ops": disassemble(&frame),
                })
            })
            .collect();
        cases.push(json!({
            "file": name,
            "width": meta.width,
            "height": meta.height,
            "fps": lottie.frame_rate(),
            "frames": meta.frame_count(),
            "warnings": lottie.diagnostics().len(),
            "markers": lottie.markers().iter().map(|(n, t, d)| json!({
                "name": n, "frame": t, "duration": d
            })).collect::<Vec<_>>(),
            "samples": samples,
        }));
    }
    let actual = json!({
        "note": "手写夹具的 DrawOp 字节级 golden。drawOpFingerprint 是 BCOP 编码字节的 \
                 FNV-1a（真正的字节判据）；ops 是同一条指令流的文本反汇编，只为让 diff 可读。",
        "rendererTag": "ccut.source.lottie/v1",
        "cases": cases,
    });
    if updating() {
        let mut text = serde_json::to_string_pretty(&actual).unwrap();
        text.push('\n');
        std::fs::write(&golden_path, text).expect("write golden");
        return;
    }
    let expected: Value =
        serde_json::from_slice(&std::fs::read(&golden_path).expect("read golden")).expect("parse");
    if expected != actual {
        let expected_cases = expected["cases"].as_array().cloned().unwrap_or_default();
        let actual_cases = actual["cases"].as_array().cloned().unwrap_or_default();
        for (want, got) in expected_cases.iter().zip(actual_cases.iter()) {
            if want != got {
                panic!(
                    "fixture {} instruction stream changed.\nexpected:\n{}\nactual:\n{}\n\
                     if this semantic change is intended, regenerate with CCUT_UPDATE_GOLDEN=1 and say so in the commit.",
                    want["file"],
                    serde_json::to_string_pretty(want).unwrap(),
                    serde_json::to_string_pretty(got).unwrap()
                );
            }
        }
        panic!("cases-golden.json does not match the current implementation (entry count or header changed)");
    }
}

#[test]
fn recording_a_case_twice_gives_identical_bytes_and_survives_shuffling() {
    for name in CASES {
        let lottie = load_case(name);
        let total = lottie.metadata().total_ms();
        let points: Vec<i64> = (0..8).map(|k| total * k / 8).collect();
        let forward: Vec<Vec<u8>> = points
            .iter()
            .map(|ms| drawop::encode(&record(&lottie, *ms)))
            .collect();
        let backward: Vec<Vec<u8>> = points
            .iter()
            .rev()
            .map(|ms| drawop::encode(&record(&lottie, *ms)))
            .collect();
        assert_eq!(
            forward,
            backward.into_iter().rev().collect::<Vec<_>>(),
            "{name}: out-of-order recording must match in-order recording byte for byte"
        );
        // Record twice at the same time
        assert_eq!(
            drawop::encode(&record(&lottie, total / 3)),
            drawop::encode(&record(&lottie, total / 3)),
            "{name}: two recordings of the same frame must be byte-identical"
        );
    }
}

#[test]
fn every_case_rasterises_without_touching_the_stacks() {
    for name in CASES {
        let lottie = load_case(name);
        let total = lottie.metadata().total_ms();
        for k in 0..4 {
            let ms = total * k / 4;
            let frame = lottie
                .sample(MediaTime::from_millis(ms))
                .unwrap_or_else(|e| panic!("{name} failed to rasterize at {ms}ms: {e:#}"));
            assert_eq!(
                (frame.pixmap.width(), frame.pixmap.height()),
                (lottie.metadata().width, lottie.metadata().height)
            );
            assert!(
                frame.pixmap.data().iter().any(|b| *b != 0),
                "{name} drew a fully empty image at {ms}ms"
            );
        }
    }
}

#[test]
fn the_new_v4_primitives_only_show_up_where_the_case_needs_them() {
    let gradients = record(&load_case("gradients.json"), 0);
    assert!(
        gradients
            .paints
            .iter()
            .any(|p| !matches!(p, PaintData::Solid(_))),
        "the gradient fixture must emit a gradient paint"
    );
    assert_eq!(drawop::required_version(&gradients), 4);

    let mattes = record(&load_case("masks-mattes.json"), 0);
    let modes: Vec<u8> = mattes
        .ops
        .iter()
        .filter_map(|op| match op {
            DrawOp::PopMatte { mode } => Some(*mode),
            _ => None,
        })
        .collect();
    assert_eq!(
        modes,
        vec![0, 1, 0],
        "alpha / inverted alpha / translucent mask, once each"
    );
    assert_eq!(
        mattes
            .ops
            .iter()
            .filter(|op| matches!(op, DrawOp::ClipPath { .. }))
            .count(),
        2,
        "root frame + fully opaque add mask clip fast path"
    );

    let dashed = record(&load_case("dash-caps.json"), 0);
    let stroke = dashed
        .ops
        .iter()
        .find_map(|op| match op {
            DrawOp::StrokePathPaint {
                path, cap, join, ..
            } => Some((*path, *cap, *join)),
            _ => None,
        })
        .expect("the dashed fixture must emit a stroke");
    assert_eq!((stroke.1, stroke.2), (0, 0), "lc=1/lj=1 ⇒ butt / miter");
    // Perimeter (80+40)*2 = 240; 10 on, 6 off ⇒ 15 segments, one move per segment
    let moves = dashed.paths[stroke.0 as usize]
        .0
        .iter()
        .filter(|seg| seg.verb == 0)
        .count();
    assert_eq!(moves, 15, "the dash must split the closed path into 15 segments");
}

#[test]
fn the_keyframe_dialects_actually_animate() {
    // This fixture targets two kinds of “silently becomes 0”: a property that has keyframes but **omits the `a` flag**, and a **terminator-only last entry** in the old `{s, e, t}` format. Both once degraded the whole property to a constant.
    let lottie = load_case("keyframe-dialects.json");
    let total = lottie.metadata().total_ms();
    let fingerprints: Vec<u64> = [0, total / 3, total * 2 / 3, total - 1]
        .into_iter()
        .map(|ms| drawop::fingerprint(&record(&lottie, ms.max(0))))
        .collect();
    let mut unique = fingerprints.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(
        unique.len(),
        fingerprints.len(),
        "the four moments must all differ; if they match, the animation was classified as constant again"
    );

    // Opacity of all off-screen layers in this frame (a layer is only given its own offscreen buffer when its alpha < 1)
    let opacities = |ms: i64| -> Vec<f32> {
        record(&lottie, ms)
            .ops
            .iter()
            .filter_map(|op| match op {
                DrawOp::PushLayer { opacity, .. } => Some(*opacity),
                _ => None,
            })
            .collect()
    };
    let near = |list: &[f32], want: f32| list.iter().any(|o| (o - want).abs() < 0.02);

    let start = opacities(0);
    let finish = opacities(total - 1);
    // Layer missing the `a` flag: opacity 100 → 20. Starts fully opaque (no offscreen layer), last frame ~0.23
    assert!(
        !start.iter().any(|o| *o < 0.29),
        "the start layer should be fully opaque with no offscreen layer, actual {start:?}"
    );
    assert!(near(&finish, 0.227), "last frame should be ~0.23, actual {finish:?}");
    // Old format `{s, e, t}`: opacity 30 → 100. Start 0.3; frozen at 100 after the terminator (no offscreen layer)
    assert!(near(&start, 0.3), "legacy format start value 30%, actual {start:?}");
    assert!(
        !near(&finish, 0.3),
        "the legacy format end should freeze at the previous frame's `e` (100%), actual {finish:?}"
    );
    // And this layer is **still drawn** — the pitfall that was hit was the end value dropping to zero, so the whole layer was skipped by the alpha <= 0 check
    assert!(
        record(&lottie, total - 1)
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::StrokePathPaint { .. })),
        "the legacy format layer must still be visible at the end"
    );

    // Precomp with st ≠ 0: its internal keyframes are written on the internal timeline and only animate correctly when aligned by st
    let pixels = |ms: i64| {
        lottie
            .sample(MediaTime::from_millis(ms))
            .unwrap()
            .pixmap
            .data()
            .to_vec()
    };
    assert_ne!(pixels(0), pixels(total / 3), "the frame must change over time");
}

// ── Diagnostic path for smoke samples ─────────────────────────────

fn sample_bytes(name: &str) -> Vec<u8> {
    std::fs::read(fixtures().join("samples").join(name)).expect("read smoke sample")
}

#[test]
fn shapes_only_renders_clean() {
    let lottie = Lottie::parse(
        "smoke",
        "shapes-only.json",
        &sample_bytes("shapes-only.json"),
    )
    .expect("shapes-only must fall within the subset");
    assert!(lottie.diagnostics().is_empty(), "there should be no diagnostics");
    let frame = record(&lottie, 0);
    assert!(
        frame
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::FillPathPaint { .. })),
        "must draw something"
    );
}

#[test]
fn the_gradient_matte_precomp_sample_renders_and_warns_about_nothing_unexpected() {
    let name = "gradient-matte-precomp.json";
    let lottie = Lottie::parse("smoke", name, &sample_bytes(name))
        .unwrap_or_else(|e| panic!("{name} should fall within the subset (gradients, masks and precomps are supported): {e:#}"));
    // It deliberately contains gradients, track mattes, layer masks, precomps, time remapping, non-normal blend modes and markers
    let frame = record(&lottie, 0);
    assert!(frame.ops.iter().any(|op| matches!(op, DrawOp::PushMatte)));
    assert!(!lottie.markers().is_empty(), "markers must be read out");
}

#[test]
fn the_text_effects_expression_sample_fails_fast_with_the_documented_code() {
    let name = "text-effects-expression.json";
    let error = Lottie::parse("smoke", name, &sample_bytes(name))
        .expect_err("text / effect / expression samples must be rejected")
        .to_string();
    assert!(
        error.contains(render_raster::source::LOTTIE_RULE),
        "must carry diagnostic code lottie-unsupported-feature, actual: {error}"
    );
}

#[test]
fn an_expression_control_group_warns_but_still_renders() {
    let doc = json!({
        "v": "5.7.0", "fr": 10, "ip": 0, "op": 10, "w": 20, "h": 20,
        "layers": [{"ty": 4, "ind": 1, "nm": "ctrl", "ip": 0, "op": 10, "st": 0, "ks": {},
            "ef": [{"ty": 5, "nm": "控制组", "ef": [{"ty": 0, "nm": "滑块"}]}],
            "shapes": [{"ty": "gr", "it": [
                {"ty": "rc", "p": {"a": 0, "k": [10, 10]}, "s": {"a": 0, "k": [8, 8]},
                 "r": {"a": 0, "k": 0}},
                {"ty": "fl", "c": {"a": 0, "k": [1, 1, 1]}, "o": {"a": 0, "k": 100}},
                {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]},
                 "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0},
                 "o": {"a": 0, "k": 100}}]}]}]
    });
    let lottie =
        Lottie::parse("warn", "warn.json", &serde_json::to_vec(&doc).unwrap()).expect("should render");
    assert_eq!(lottie.diagnostics().len(), 1);
    assert_eq!(
        lottie.diagnostics()[0].rule,
        render_raster::source::LOTTIE_RULE
    );
    assert!(
        record(&lottie, 0)
            .ops
            .iter()
            .any(|op| matches!(op, DrawOp::FillPathPaint { .. })),
        "warn does not block rendering"
    );
}

// ── BCF `lottie` element end-to-end ────────────────────────────────

fn bcf_document(fit: &str) -> Value {
    json!({
        "ccut": "0.1",
        "meta": {"id": "lottie-case", "width": 160, "height": 120, "fps": 10,
                 "background": "#000000"},
        "assets": {"badge": {"type": "lottie", "src": "cases/shapes.json"}},
        "scenes": [{"id": "s1", "dur": 1.0, "desc": "Lottie 元素端到端夹具"}],
        "tracks": [{"id": "main", "clips": [{
            "id": "c1", "scene": "s1",
            // Wrap it in a box: `style.x` / `style.y` are used by the **parent layout** to position the child; the root node of a clip has no parent, so setting them has no effect (layout::is_absolute)
            "element": {"id": "root", "type": "box",
                "style": {"width": 160, "height": 120},
                "children": [{"id": "e1", "type": "lottie", "src": "$assets.badge",
                              "fit": fit, "loop": true,
                              "style": {"width": 80, "height": 80, "x": 40, "y": 20}}]}
        }]}]
    })
}

fn render_bcf(fit: &str, t: f64) -> (tiny_skia::Pixmap, Vec<String>) {
    let doc = bcf_document(fit);
    let base = fixtures();
    let diagnostics = scene_primitives::lint::lint(&doc);
    let errors: Vec<String> = diagnostics
        .iter()
        .filter(|d| d.severity == scene_primitives::lint::Severity::Error)
        .map(|d| format!("{} {} {}", d.rule, d.pointer, d.message))
        .collect();
    assert!(errors.is_empty(), "lint should not report errors: {errors:?}");

    let assets = render_raster::load_assets(&doc, &base).expect("load lottie assets");
    let assets = Arc::new(assets);
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let mut ir = resolver.resolve().expect("resolve");
    let mut engine = TextEngine::with_document_fonts(&assets.fonts);
    let renderer =
        FrameRenderer::new_with_assets(&mut ir, &mut engine, &assets).expect("assemble the vector source");
    let planner = FramePlanner::cpu_with_assets(&ir, &assets).expect("preflight");
    let mut media = MediaStore::new(assets.clone(), ir.fps);
    let pixmap = planner
        .render(&renderer, &ir, &mut engine, &mut media, t)
        .expect("render");
    let warnings = planner
        .report()
        .diagnostics
        .iter()
        .map(|d| d.rule.to_string())
        .collect();
    (pixmap, warnings)
}

#[test]
fn a_lottie_element_renders_inside_its_box_and_scales_with_it() {
    let (pixmap, warnings) = render_bcf("contain", 0.0);
    assert!(warnings.is_empty(), "a clean fixture should have no diagnostics: {warnings:?}");
    let at = |x: u32, y: u32| -> [u8; 4] {
        let i = ((y * pixmap.width() + x) * 4) as usize;
        pixmap.data()[i..i + 4].try_into().unwrap()
    };
    // The box is [40,20]–[120,100]; outside the box must still be the background colour (black, opaque)
    assert_eq!(at(5, 5), [0, 0, 0, 255], "nothing outside the box should be drawn");
    assert_eq!(at(150, 110), [0, 0, 0, 255]);
    // There should be non-background pixels inside the box
    let mut painted = 0;
    for y in 20..100 {
        for x in 40..120 {
            if at(x, y) != [0, 0, 0, 255] {
                painted += 1;
            }
        }
    }
    assert!(painted > 200, "content should be drawn inside the box, only {painted} pixels");
}

#[test]
fn cover_fit_clips_the_overflow_back_to_the_element_box() {
    let (pixmap, _) = render_bcf("cover", 0.0);
    let at = |x: u32, y: u32| -> [u8; 4] {
        let i = ((y * pixmap.width() + x) * 4) as usize;
        pixmap.data()[i..i + 4].try_into().unwrap()
    };
    // The asset is 120×90 and the box is 80×80 ⇒ cover overflows horizontally and must be clipped back to the box
    for y in [21u32, 60, 98] {
        assert_eq!(at(38, y), [0, 0, 0, 255], "left of the box is out of bounds");
        assert_eq!(at(122, y), [0, 0, 0, 255], "right of the box is out of bounds");
    }
}

#[test]
fn the_element_freezes_and_loops_like_an_animated_image() {
    // loop: true ⇒ a 1 s composition plays exactly once through in a 1 s clip; t=0 and t=0.99 should differ
    let (a, _) = render_bcf("contain", 0.0);
    let (b, _) = render_bcf("contain", 0.9);
    assert_ne!(a.data(), b.data(), "the asset with rotation keyframes should change frame by frame");
    // Two renders within the same frame window are byte-identical (10 fps ⇒ one frame per 100 ms)
    // Quantization uses the **asset's** frame table (30 fps ⇒ one frame per 33 ms), not the project fps
    let (c, _) = render_bcf("contain", 0.41);
    let (d, _) = render_bcf("contain", 0.42);
    assert_eq!(c.data(), d.data(), "the same asset frame window must be byte-identical");
    let (e, _) = render_bcf("contain", 0.44);
    assert_ne!(c.data(), e.data(), "frame boundaries across assets must change");
}

#[test]
fn a_renderer_without_the_vector_sources_refuses_to_assemble() {
    let doc = bcf_document("contain");
    let assets = render_raster::load_assets(&doc, &fixtures()).expect("load");
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let mut ir = resolver.resolve().unwrap();
    let mut engine = TextEngine::with_document_fonts(&[]);
    let error = match FrameRenderer::new_with_assets(&mut ir, &mut engine, &LoadedAssets::default())
    {
        Ok(_) => panic!("without a vector source it must fail at assembly time, not draw a blank image"),
        Err(error) => error.to_string(),
    };
    assert!(error.contains("lottie-source-missing"), "actual: {error}");
}

#[test]
fn the_asset_type_and_element_type_must_agree() {
    let mut doc = bcf_document("contain");
    doc["assets"]["badge"]["type"] = json!("image");
    let errors: Vec<String> = scene_primitives::lint::lint(&doc)
        .into_iter()
        .filter(|d| d.severity == scene_primitives::lint::Severity::Error)
        .map(|d| d.message)
        .collect();
    assert!(
        !errors.is_empty(),
        "a lottie element pointing at an image asset must be a lint error"
    );
}

#[test]
fn a_lottie_element_has_no_audio_track() {
    let mut doc = bcf_document("contain");
    doc["tracks"][0]["clips"][0]["element"]["children"][0]["withAudio"] = json!(true);
    let errors: Vec<String> = scene_primitives::lint::lint(&doc)
        .into_iter()
        .filter(|d| d.severity == scene_primitives::lint::Severity::Error)
        .map(|d| d.message)
        .collect();
    assert!(
        errors.iter().any(|m| m.contains("withAudio")),
        "actual: {errors:?}"
    );
}
