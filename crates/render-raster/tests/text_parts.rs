//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer` (the BCF document rendering pipeline and the host byte layer), which do not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Stage 3 acceptance (design §10 stage 3): the part mapping is correct for Chinese/English text, emoji, and ligatures, and `record_text` applies the pose per part without moving the layout box.
//!
//! **Not golden-tested here**: glyph pixels depend on system font resolution and shaping, and would produce false failures across machines that have nothing to do with animation (stage 0 §15 deviation 2 already recorded the same reason for `studio_export`).
//! The assertions only cover structural properties that are independent of the font: each part has at least one glyph, part boundaries light up one by one as time advances, and the layout box stays identical at every position.

use render_raster::drawop::DrawOp;
use render_raster::{FrameRenderer, TextEngine};
use serde_json::{Value, json};

fn doc(text: &str, split: &str, parts: Value) -> Value {
    json!({
        "meta": {"id": "t", "width": 1280, "height": 720, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end", "element": {
                "type": "text", "id": "el", "text": text,
                "style": {"fontSize": 64, "color": "#ffffff"},
                "split": {"by": split},
                "animate": {"parts": parts}
            }}
        ]}]
    })
}

fn typewriter(gap: f64) -> Value {
    json!({
        "op": "stagger", "gap": gap, "order": "start", "parts": true,
        "item": {"op": "preset", "preset": "motion.typewriter"}
    })
}

#[test]
fn line_parts_follow_wrapping_and_keep_the_layout_stable() {
    let mut document = doc("Alpha Beta Gamma", "line", typewriter(0.3));
    document["tracks"][0]["clips"][0]["element"]["style"] = json!({
        "font":"Poppins","fontSize":40,"width":180,"lineHeight":50,
        "textWrap":"word","textAlign":"left","color":"#ffffff"
    });
    let mut ir = resolve(document.clone());
    assert!(ir.visual_clips[0].tree.part_motion.is_none());
    let font = include_bytes!("../assets/fonts/Poppins-Regular.ttf").to_vec();
    let mut engine = TextEngine::with_document_fonts(&[font.clone()]);
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let node = &ir.visual_clips[0].tree;
    let block = node.text_block.as_ref().unwrap();
    let text = node.text.as_deref().unwrap();
    let lines: Vec<_> = block
        .lines
        .iter()
        .map(|line| &text[line.bytes.start..line.paint_end])
        .collect();
    assert_eq!(lines, ["Alpha", "Beta", "Gamma"]);
    assert_eq!(node.part_motion.as_ref().unwrap().map.ranges.len(), 3);
    let height = node.frame.h;
    let counts: Vec<_> = [0.0, 0.2, 0.5, 1.5]
        .map(|t| fill_paths(&renderer.record(&ir, &mut engine, t)))
        .into();
    assert!(counts.windows(2).all(|w| w[0] <= w[1]), "{counts:?}");
    assert!(counts[0] < counts[3]);
    assert_eq!(ir.visual_clips[0].tree.frame.h, height);
    let expected = renderer.record(&ir, &mut engine, 0.5);
    renderer.record(&ir, &mut engine, 2.0);
    assert_eq!(
        render_raster::drawop::fingerprint(&expected),
        render_raster::drawop::fingerprint(&renderer.record(&ir, &mut engine, 0.5))
    );
    document["tracks"][0]["clips"][0]["element"]["style"]["width"] = json!(340);
    let mut wider = resolve(document);
    FrameRenderer::new(&mut wider, &mut TextEngine::with_document_fonts(&[font])).unwrap();
    assert_ne!(
        ir.visual_clips[0]
            .tree
            .part_motion
            .as_ref()
            .unwrap()
            .map
            .fingerprint,
        wider.visual_clips[0]
            .tree
            .part_motion
            .as_ref()
            .unwrap()
            .map
            .fingerprint
    );
}

#[test]
fn paragraph_count_up_uses_current_content_ranges() {
    let mut document = doc("long placeholder", "grapheme", typewriter(0.1));
    let element = &mut document["tracks"][0]["clips"][0]["element"];
    element["style"] = json!({"fontSize":40,"width":180,"textWrap":"word"});
    element["animate"] =
        json!({"keyframes":[{"prop":"textCount","frames":[{"t":0,"v":1},{"t":1,"v":9}]}]});
    let mut ir = resolve(document);
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    assert!(fill_paths(&renderer.record(&ir, &mut engine, 0.0)) > 0);
}

fn resolve(doc: Value) -> scene_primitives::Ir {
    scene_primitives::Resolver::new(doc, None)
        .unwrap()
        .resolve()
        .unwrap()
}

fn fill_paths(frame: &render_raster::drawop::FrameOps) -> usize {
    frame
        .ops
        .iter()
        .filter(|op| matches!(op, DrawOp::FillPath { .. }))
        .count()
}

/// Each part hits at least one glyph (otherwise the part animation would appear to "not react" for some characters).
#[test]
fn every_part_owns_at_least_one_glyph_across_scripts() {
    let mut engine = TextEngine::new();
    for (text, split) in [
        ("Hello world", "grapheme"),
        ("Hello world", "word"),
        ("CucCut 剪辑 v2", "word"),
        ("中文混排 English 42", "grapheme"),
        ("Hi 👨‍👩‍👧 🇯🇵 ok", "grapheme"),
        ("waffle office ffi", "word"),
    ] {
        // The part map is obtained through the production path (`ccut-render` does not depend on `ccut-motion` directly).
        let ir = resolve(doc(text, split, typewriter(0.05)));
        let map = &ir.visual_clips[0]
            .tree
            .part_motion
            .as_ref()
            .expect("part motion")
            .map;
        let shaped = engine.shape(text, "", 64.0, 400);
        assert!(!shaped.glyphs.is_empty(), "{text}: shaping produced no output");
        let mut hit = vec![false; map.len()];
        for glyph in &shaped.glyphs {
            let part = map.part_of(glyph.cluster.start).unwrap_or_else(|| {
                panic!("{text}: 字形 cluster {:?} 落在 map 之外", glyph.cluster)
            });
            hit[part] = true;
        }
        // A ligature (ffi) can make one glyph cover multiple graphemes, but after attributing by `cluster.start`, every **word** part still has a glyph; a grapheme-level empty part is a known trade-off.
        assert!(
            hit.iter().all(|seen| *seen),
            "{text} / {split}: 有 part 没有任何字形（hit={hit:?}）"
        );
    }
}

/// Typewriter: as time advances, the number of drawn glyphs never decreases, and finally equals the full string.
#[test]
fn typewriter_reveals_parts_one_by_one() {
    let mut ir = resolve(doc("CucCut 剪辑 v2", "word", typewriter(0.2)));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let counts: Vec<usize> = [0.0, 0.25, 0.45, 0.65, 1.5]
        .into_iter()
        .map(|t| fill_paths(&renderer.record(&ir, &mut engine, t)))
        .collect();
    assert!(
        counts.windows(2).all(|w| w[0] <= w[1]),
        "字形数应随时间单调不减：{counts:?}"
    );
    assert!(counts[0] < *counts.last().unwrap(), "{counts:?}");

    let mut plain = resolve(json!({
        "meta": {"id": "t", "width": 1280, "height": 720, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end", "element": {
                "type": "text", "id": "el", "text": "CucCut 剪辑 v2",
                "style": {"fontSize": 64, "color": "#ffffff"}
            }}
        ]}]
    }));
    let plain_renderer = FrameRenderer::new(&mut plain, &mut engine).unwrap();
    assert_eq!(
        *counts.last().unwrap(),
        fill_paths(&plain_renderer.record(&plain, &mut engine, 1.5)),
        "全部 part 出场后应当与不带动画的整串一样多"
    );
}

/// Part animation does not change the layout box (spec §7.9).
#[test]
fn part_motion_leaves_the_layout_box_untouched() {
    let mut engine = TextEngine::new();
    let mut animated = resolve(doc("中文混排 English", "grapheme", typewriter(0.05)));
    let mut plain = resolve(json!({
        "meta": {"id": "t", "width": 1280, "height": 720, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end", "element": {
                "type": "text", "id": "el", "text": "中文混排 English",
                "style": {"fontSize": 64, "color": "#ffffff"}
            }}
        ]}]
    }));
    FrameRenderer::new(&mut animated, &mut engine).unwrap();
    FrameRenderer::new(&mut plain, &mut engine).unwrap();
    let a = animated.visual_clips[0].tree.frame;
    let b = plain.visual_clips[0].tree.frame;
    assert_eq!((a.x, a.y, a.w, a.h), (b.x, b.y, b.w, b.h));
}

/// Recording is a pure function of `(ir, t)`: two recordings at the same instant are byte-identical, and recording out of order yields the same sequence of fingerprints as recording in order (part sampling introduces no state).
#[test]
fn part_recording_stays_a_pure_function_of_time() {
    let mut ir = resolve(doc("CucCut 剪辑 v2", "word", typewriter(0.12)));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let instants: Vec<f64> = (0..40).map(|step| step as f64 * 0.05).collect();
    let forward: Vec<u64> = instants
        .iter()
        .map(|t| render_raster::drawop::fingerprint(&renderer.record(&ir, &mut engine, *t)))
        .collect();
    let mut backward: Vec<u64> = instants
        .iter()
        .rev()
        .map(|t| render_raster::drawop::fingerprint(&renderer.record(&ir, &mut engine, *t)))
        .collect();
    backward.reverse();
    assert_eq!(forward, backward);
}

/// `karaokeScale` scales around the part anchor: the instructions at peak time differ from those at rest, but the glyph count is the same (scaling does not swallow glyphs).
#[test]
fn karaoke_scale_changes_transforms_without_dropping_glyphs() {
    let mut ir = resolve(doc(
        "CucCut 剪辑",
        "word",
        json!({
            "op": "stagger", "gap": 0.15, "order": "start", "parts": true,
            "item": {"op": "preset", "preset": "motion.karaokeScale"}
        }),
    ));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let settled = renderer.record(&ir, &mut engine, 2.5);
    let peak = renderer.record(&ir, &mut engine, 0.12);
    assert_eq!(fill_paths(&settled), fill_paths(&peak));
    assert_ne!(
        render_raster::drawop::fingerprint(&settled),
        render_raster::drawop::fingerprint(&peak),
        "峰值时刻的变换应当与落定后不同"
    );
}
