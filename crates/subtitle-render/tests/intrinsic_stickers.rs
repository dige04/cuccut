use std::collections::HashSet;
use std::path::{Path, PathBuf};

// v2's path (`apps/cuccut/assets/stickers`). v3 has no sticker library yet, so tests that use it are marked ignore.
fn anim_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../apps/cuccut/assets/stickers/anim")
}

/// A 640×360 wide-frame sticker: 16 squares fill a 4×4 grid, each with its own SMIL displacement.
/// Used to verify that `fullscreen` + `cover` spread the sticker to the canvas edges in all three aspect ratios. Before round 231 this used an animated Confetti image; after Confetti became an algorithmic element, this inline test image took over.
fn fullscreen_grid_svg() -> String {
    let mut body = String::new();
    for row in 0..4 {
        for col in 0..4 {
            let dx = if (row + col) % 2 == 0 { 6 } else { -6 };
            body.push_str(&format!(
                "<rect x=\"{}\" y=\"{}\" width=\"160\" height=\"90\" fill=\"#FF476F\">\
                 <animateTransform attributeName=\"transform\" type=\"translate\" \
                 values=\"0 0;{dx} 0;0 0\" dur=\"3s\" repeatCount=\"indefinite\"/></rect>",
                col * 160,
                row * 90
            ));
        }
    }
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"640\" height=\"360\" viewBox=\"0 0 640 360\">{body}</svg>"
    )
}

/// A 128×128 SMIL sticker: one square slides from left to right and back within 3 s. Used to verify the independent clock of a shared source. Since round 238 the built-in catalog has only Lottie, and SVG animation comes from user uploads, so one is inlined here instead of borrowing built-in material.
fn sliding_square_svg() -> String {
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"128\" height=\"128\" viewBox=\"0 0 128 128\">\
     <rect x=\"8\" y=\"40\" width=\"48\" height=\"48\" fill=\"#2170E6\">\
     <animateTransform attributeName=\"transform\" type=\"translate\" \
     values=\"0 0;64 0;0 0\" dur=\"3s\" repeatCount=\"indefinite\"/></rect></svg>"
        .to_owned()
}

#[test]
fn fullscreen_cover_reaches_the_edges_in_landscape_portrait_and_square() {
    use serde_json::json;
    use subtitle_render::OverlayRenderPlan;
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("rain.svg"), fullscreen_grid_svg()).unwrap();
    let timeline = json!({"ccutTimeline":"0.5","sources":{"rain":{"kind":"image","path":"rain.svg","naturalW":640,"naturalH":360}},
        "tracks":[{"id":"overlay","kind":"overlay","elements":[{"id":"confetti","kind":"sticker","srcId":"rain","start":0,"end":3,
        "mode":"fullscreen","fit":"cover","place":{"x":50,"y":50,"w":100},"sticker":{"source":"asset","path":"rain.svg","loop":"loop"}}]}]});
    std::fs::write(
        root.path().join("timeline.json"),
        serde_json::to_vec(&timeline).unwrap(),
    )
    .unwrap();
    let doc = json!({"meta":{"duration":3},"style":{"mode":"orig","fontFamily":"Montserrat","fontSize":30},"cues":[],"sentences":[],"transCues":[],"timeline":timeline});
    for (w, h) in [(320, 180), (180, 320), (240, 240)] {
        let mut plan = OverlayRenderPlan::compile(&doc, w, h, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(root.path(), &doc).unwrap();
        let mut cells = HashSet::new();
        for t in [0.0, 0.5, 1.0, 1.5, 2.0, 2.5] {
            for (i, p) in plan.render_rgba(t).unwrap().chunks_exact(4).enumerate() {
                if p[3] > 100 {
                    cells.insert((
                        (i % w as usize) * 4 / w as usize,
                        (i / w as usize) * 4 / h as usize,
                    ));
                }
            }
        }
        assert_eq!(
            cells.len(),
            16,
            "{w}x{h}: a fullscreen cover sticker must reach all 4x4 canvas regions, not sit as a small center sticker"
        );
    }
}

/// Two stickers share one source and enter 0.5 s apart. Under `loop` each runs on its own clock. Under `hold` (freeze on the first frame) and `once` (play, then stop on the last frame) the two only match. Both dynamic sources, SVG animation (user-uploaded) and Lottie (built-in / uploaded), must uphold this.
#[test]
#[ignore = "读 v2 的贴纸库 apps/cuccut/assets/stickers：元素素材未随本批带来，待元素素材批次"]
fn shared_sources_keep_independent_clocks_and_honor_hold_and_once() {
    use serde_json::json;
    use subtitle_render::OverlayRenderPlan;
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir(root.path().join("media")).unwrap();
    std::fs::write(root.path().join("media/a.svg"), sliding_square_svg()).unwrap();
    // Noto ghost: 144 frames @ 60 fps = 2.4 s, with the body floating up and down after 1.0 s.
    std::fs::copy(
        anim_root().join("dyn-emoji-01.json"),
        root.path().join("media/a.json"),
    )
    .unwrap();
    let sources = [
        (
            "svg",
            json!({"kind":"image","path":"media/a.svg","naturalW":128,"naturalH":128}),
        ),
        (
            "lottie",
            json!({"kind":"lottie","path":"media/a.json","naturalW":1024,"naturalH":1024,"duration":2.4,"hasAudio":false}),
        ),
    ];
    for (label, source) in sources {
        let path = source["path"].as_str().unwrap().to_owned();
        for (mode, time, same) in [
            ("loop", 1.5, false),
            ("hold", 1.5, true),
            ("once", 4.0, true),
        ] {
            let element = |id: &str, start: f64, x: f64| {
                json!({"id":id,"kind":"sticker","srcId":"src","start":start,"end":8,
                "place":{"x":x,"y":50,"w":25},"sticker":{"source":"asset","path":path,"loop":mode}})
            };
            let timeline = json!({"ccutTimeline":"0.7","sources":{"src":source},
                "tracks":[{"id":"track","kind":"overlay","elements":[element("a",0.0,25.0),element("b",0.5,75.0)]}]});
            std::fs::write(
                root.path().join("timeline.json"),
                serde_json::to_vec(&timeline).unwrap(),
            )
            .unwrap();
            let doc = json!({"meta":{"duration":8},"style":{"mode":"orig","fontFamily":"Montserrat","fontSize":30},"cues":[],"sentences":[],"transCues":[],"timeline":timeline});
            let mut plan = OverlayRenderPlan::compile(&doc, 320, 180, 8.0, 30.0, None).unwrap();
            plan.load_timeline_elements(root.path(), &doc).unwrap();
            let pixels = plan.render_rgba(time).unwrap();
            let crop = |x: usize| {
                (50..130)
                    .flat_map(|y| {
                        pixels[(y * 320 + x) * 4..(y * 320 + x + 80) * 4]
                            .iter()
                            .copied()
                    })
                    .collect::<Vec<_>>()
            };
            assert!(
                crop(40).chunks_exact(4).any(|p| p[3] > 0),
                "{label}/{mode}: the first instance must be visible"
            );
            assert_eq!(
                crop(40) == crop(200),
                same,
                "{label}/{mode}: the two instances must follow their own source clock"
            );
        }
    }
}

/// Every entry in the built-in dynamic catalog (81 Noto Lottie) must animate by its own frames, without relying on element-level `animate`, and must still animate after recoloring. Rendering goes through `OverlayRenderPlan`, the same frame-fetch path as export.
#[test]
#[ignore = "读 v2 的贴纸库 apps/cuccut/assets/stickers：元素素材未随本批带来，待元素素材批次"]
fn all_81_dynamic_sources_animate_their_own_pixels_without_element_animation() {
    use render_raster::drawop::{DrawOp, FrameBuilder};
    use render_raster::source::MediaTime;
    use render_raster::source::lottie::Lottie;
    let mut count = 0;
    let mut recoloured = 0;
    let mut entries: Vec<_> = std::fs::read_dir(anim_root())
        .unwrap()
        .flatten()
        .map(|entry| entry.path())
        .filter(|p| {
            p.extension().is_some_and(|e| e == "json")
                && p.file_name().is_none_or(|name| name != "provenance.json")
        })
        .collect();
    entries.sort();
    // Each entry goes through the formal element-path entry `Lottie::record`, comparing the instruction stream rather than whole-frame pixels. The instruction stream is exactly what `ccut render` / export replays, and 81 entries × 5 sample points × 2 finish in under one second. Pixel-level proof is carried by the ghost case above.
    for p in entries {
        let bytes = std::fs::read(&p).unwrap();
        let mut lottie = Lottie::parse("test", "sticker", &bytes)
            .unwrap_or_else(|error| panic!("{}: {error:#}", p.display()));
        let total_ms = lottie
            .metadata()
            .frame_starts_ms
            .last()
            .copied()
            .unwrap_or(0);
        assert!(total_ms > 0, "{}", p.display());
        let distinct_frames = |lottie: &Lottie| {
            // Some entries fade in from an empty picture (first frame fully transparent), so the check only requires that the brush has been used at some point, not that every sample point has content.
            let mut frames = HashSet::new();
            let mut visible = false;
            for fraction in [0.0, 0.2, 0.45, 0.7, 0.9] {
                let mut builder = FrameBuilder::default();
                lottie
                    .record(
                        MediaTime::from_millis((total_ms as f64 * fraction) as i64),
                        tiny_skia::Transform::identity(),
                        &mut builder,
                    )
                    .unwrap();
                let frame = builder.finish();
                visible |= frame.ops.iter().any(|op| {
                    matches!(
                        op,
                        DrawOp::FillPath { .. }
                            | DrawOp::FillPathPaint { .. }
                            | DrawOp::StrokePathPaint { .. }
                    )
                });
                frames.insert(format!(
                    "{:?}|{:?}|{:?}",
                    frame.ops, frame.paths, frame.paints
                ));
            }
            assert!(visible, "{} never draws a pixel", p.display());
            frames.len()
        };
        assert!(
            distinct_frames(&lottie) >= 2,
            "{} has no intrinsic pixel motion",
            p.display()
        );
        // After recoloring (replacing every static solid fill with the same green), it must still move. Entries that rely entirely on gradients or animated colors have no static fill to recolor, so the recolor step is skipped for them.
        let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let mut colours = std::collections::BTreeMap::new();
        collect_fill_colours(&value, &mut colours);
        if !colours.is_empty() {
            let overrides: std::collections::BTreeMap<String, String> = colours
                .keys()
                .map(|hex| (hex.clone(), "#10FE72".to_string()))
                .collect();
            let touched = lottie.apply_fill_overrides(&overrides);
            assert!(touched > 0, "{} 的静态填充一个都没换到", p.display());
            assert!(
                distinct_frames(&lottie) >= 2,
                "{} stopped after recolor",
                p.display()
            );
            recoloured += 1;
        }
        count += 1;
    }
    assert_eq!(count, 81);
    assert!(recoloured >= 40, "只有 {recoloured} 款带静态纯色填充");
}

/// Collect the `#RRGGBB` of every `ty:"fl"` static solid fill in bodymovin (0..1 dialect).
fn collect_fill_colours(
    value: &serde_json::Value,
    out: &mut std::collections::BTreeMap<String, ()>,
) {
    match value {
        serde_json::Value::Object(map) => {
            if map.get("ty").and_then(|v| v.as_str()) == Some("fl")
                && let Some(k) = map
                    .get("c")
                    .and_then(|c| c.get("k"))
                    .and_then(|k| k.as_array())
                && k.len() >= 3
                && let (Some(r), Some(g), Some(b)) = (k[0].as_f64(), k[1].as_f64(), k[2].as_f64())
            {
                let channel = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
                out.insert(
                    format!("#{:02X}{:02X}{:02X}", channel(r), channel(g), channel(b)),
                    (),
                );
            }
            for child in map.values() {
                collect_fill_colours(child, out);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                collect_fill_colours(child, out);
            }
        }
        _ => {}
    }
}
