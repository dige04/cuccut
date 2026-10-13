#![cfg(feature = "media")]

//! Rendering contract for hand-drawn capabilities (spec §6.2.1 / §6.3 / §7.10, design draft `ccut-hand-drawn-animation-design.md`):
//!
//! - path: fixed draw order of fill, then texture, then stroke; `fillRule`, `lineCap` / `lineJoin`, `dash`;
//! - texture: time-independent, independent of sampling order, follows rigid transforms;
//! - `clipPath {shape:"path"}` and `anchor: [x, y]`;
//! - `cadence` sampling domain: absolute project-time grid, per-level override; media and subtitles are not quantized.

use render_raster::drawop::{DrawOp, encode};
use render_raster::plan::{CapabilityProfile, CpuExecutor, FramePlanner, execute_plan};
use render_raster::{FrameRenderer, LoadedAssets, MediaStore, TextEngine};
use scene_primitives::resolve::{Ir, Resolver};
use serde_json::{Value, json};
use std::sync::Arc;

const W: u32 = 240;

fn doc(meta_extra: Value, element: Value) -> Value {
    let mut meta =
        json!({"id": "sk", "width": 240, "height": 160, "fps": 60, "background": "#ffffff"});
    for (k, v) in meta_extra.as_object().unwrap() {
        meta[k] = v.clone();
    }
    json!({
        "ccut": "0.1",
        "meta": meta,
        "scenes": [{"id": "s", "dur": 4}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end", "element": element}
        ]}]
    })
}

/// 240×160 svg with a viewBox of the same size, so path coordinates are pixels.
fn svg(paths: Vec<Value>) -> Value {
    json!({
        "type": "svg", "id": "art", "viewBox": "0 0 240 160",
        "style": {"width": 240, "height": 160},
        "children": paths
    })
}

fn ir_of(doc: Value) -> Ir {
    Resolver::new(doc, None).unwrap().resolve().unwrap()
}

struct Stage {
    ir: Ir,
    engine: TextEngine,
    renderer: FrameRenderer,
}

impl Stage {
    fn new(doc: Value) -> Stage {
        let mut ir = ir_of(doc);
        let mut engine = TextEngine::new();
        let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
        Stage {
            ir,
            engine,
            renderer,
        }
    }

    fn bytes(&mut self, t: f64) -> Vec<u8> {
        encode(&self.renderer.record(&self.ir, &mut self.engine, t))
    }

    fn ops(&mut self, t: f64) -> Vec<DrawOp> {
        self.renderer.record(&self.ir, &mut self.engine, t).ops
    }

    fn pixels(&mut self, t: f64) -> Vec<u8> {
        let planner = FramePlanner::cpu(&self.ir).unwrap();
        let plan = planner.plan(&self.renderer, &self.ir, &mut self.engine, t);
        plan.validate().unwrap();
        let mut executor = CpuExecutor::new(CapabilityProfile::cpu_reference());
        let mut media = MediaStore::new(Arc::new(LoadedAssets::default()), self.ir.fps);
        execute_plan(&plan, &mut executor, &mut media, None)
            .unwrap()
            .data()
            .to_vec()
    }
}

fn px(data: &[u8], x: u32, y: u32) -> [u8; 4] {
    let i = ((y * W + x) * 4) as usize;
    [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

fn kind(op: &DrawOp) -> &'static str {
    match op {
        DrawOp::Clear { .. } => "clear",
        DrawOp::FillPath { .. } => "fill",
        DrawOp::FillPathPaint { .. } => "fillPaint",
        DrawOp::StrokePath { .. } => "stroke",
        DrawOp::StrokePathPaint { .. } => "strokePaint",
        DrawOp::ClipPath { .. } => "clip",
        DrawOp::PopClip => "popClip",
        _ => "other",
    }
}

fn kinds(ops: &[DrawOp]) -> Vec<&'static str> {
    ops.iter()
        .map(kind)
        .filter(|k| *k != "other" && *k != "clear")
        .collect()
}

const SQUARE: &str = "M40 30 L140 30 L140 130 L40 130 Z";

// ── Fill / stroke ─────────────────────────────────────────────────────────

#[test]
fn stroke_only_path_still_records_the_v3_stroke_op() {
    let mut stage = Stage::new(doc(
        json!({}),
        svg(vec![
            json!({"type": "path", "d": "M20 20 L200 20", "stroke": "#000000", "strokeWidth": 4}),
        ]),
    ));
    assert_eq!(kinds(&stage.ops(0.0)), ["stroke"]);
}

#[test]
fn fill_only_fill_and_stroke_and_draw_order() {
    let mut fill_only = Stage::new(doc(
        json!({}),
        svg(vec![
            json!({"type": "path", "d": SQUARE, "fill": "#ff0000"}),
        ]),
    ));
    assert_eq!(kinds(&fill_only.ops(0.0)), ["fill"]);
    let data = fill_only.pixels(0.0);
    assert_eq!(px(&data, 90, 80), [255, 0, 0, 255]);
    assert_eq!(px(&data, 10, 10), [255, 255, 255, 255]);

    let mut both = Stage::new(doc(
        json!({}),
        svg(vec![json!({
            "type": "path", "d": SQUARE, "fill": "#ff0000",
            "texture": {"finish": "ink", "color": "#0000ff", "seed": 3},
            "stroke": "#000000", "strokeWidth": 6
        })]),
    ));
    // Fill, then texture (clipped inside the shape), then stroke
    assert_eq!(
        kinds(&both.ops(0.0)),
        ["fill", "clip", "stroke", "popClip", "stroke"]
    );
    let data = both.pixels(0.0);
    assert_eq!(px(&data, 40, 80), [0, 0, 0, 255], "the stroke is drawn over the fill");
}

#[test]
fn path_draw_only_gates_the_stroke_not_the_fill() {
    let mut stage = Stage::new(doc(
        json!({}),
        svg(vec![json!({
            "type": "path", "d": SQUARE, "fill": "#00ff00", "stroke": "#000000", "strokeWidth": 4,
            "animate": {"keyframes": [{"prop": "pathDraw", "frames": [{"t": 0, "v": 0}, {"t": 2, "v": 1}]}]}
        })]),
    ));
    assert_eq!(kinds(&stage.ops(0.0)), ["fill"], "progress 0: only the fill");
    assert_eq!(kinds(&stage.ops(1.0)), ["fill", "stroke"]);
}

#[test]
fn z_closes_the_outline() {
    let mut stage = Stage::new(doc(
        json!({}),
        svg(vec![
            json!({"type": "path", "d": SQUARE, "stroke": "#000000", "strokeWidth": 6}),
        ]),
    ));
    let data = stage.pixels(0.0);
    // Left edge (x=40): only the segment that Z patches back passes through
    assert_eq!(px(&data, 40, 80), [0, 0, 0, 255]);
}

#[test]
fn even_odd_punches_the_inner_ring() {
    let ring = "M20 20 L220 20 L220 140 L20 140 Z M80 50 L160 50 L160 110 L80 110 Z";
    let mut nonzero = Stage::new(doc(
        json!({}),
        svg(vec![json!({"type": "path", "d": ring, "fill": "#0000ff"})]),
    ));
    assert_eq!(px(&nonzero.pixels(0.0), 120, 80), [0, 0, 255, 255]);

    let mut even_odd = Stage::new(doc(
        json!({}),
        svg(vec![
            json!({"type": "path", "d": ring, "fill": "#0000ff", "fillRule": "evenodd"}),
        ]),
    ));
    assert_eq!(kinds(&even_odd.ops(0.0)), ["fillPaint"]);
    let data = even_odd.pixels(0.0);
    assert_eq!(px(&data, 120, 80), [255, 255, 255, 255], "the inner ring is cut out");
    assert_eq!(px(&data, 40, 80), [0, 0, 255, 255]);
}

#[test]
fn dash_cuts_the_stroke_and_butt_caps_leave_clean_gaps() {
    let mut stage = Stage::new(doc(
        json!({}),
        svg(vec![json!({
            "type": "path", "d": "M20 80 L220 80", "stroke": "#000000", "strokeWidth": 8,
            "dash": [20, 20], "lineCap": "butt"
        })]),
    ));
    assert_eq!(kinds(&stage.ops(0.0)), ["strokePaint"]);
    let data = stage.pixels(0.0);
    assert_eq!(px(&data, 30, 80), [0, 0, 0, 255], "first solid segment 20..40");
    assert_eq!(px(&data, 50, 80), [255, 255, 255, 255], "first gap 40..60");
    assert_eq!(px(&data, 70, 80), [0, 0, 0, 255]);
}

#[test]
fn unknown_path_style_values_are_schema_errors() {
    for bad in [
        json!({"type": "path", "d": SQUARE, "fill": "#000", "fillRule": "winding"}),
        json!({"type": "path", "d": SQUARE, "stroke": "#000", "lineCap": "flat"}),
        json!({"type": "path", "d": SQUARE, "stroke": "#000", "dash": [4, -1]}),
        json!({"type": "path", "d": SQUARE, "fill": "#000", "texture": {"finish": "oil"}}),
        json!({"type": "path", "d": SQUARE, "fill": "#000", "texture": {"finish": "ink", "gapp": 3}}),
    ] {
        let error = Resolver::new(doc(json!({}), svg(vec![bad.clone()])), None)
            .and_then(|mut r| r.resolve())
            .err()
            .unwrap_or_else(|| panic!("should report an error: {bad}"));
        assert!(error.to_string().starts_with("schema:"), "{error}");
    }
}

// ── Texture ───────────────────────────────────────────────────────────────

fn textured(finish: &str) -> Value {
    doc(
        json!({"cadence": {"fps": 12}}),
        svg(vec![json!({
            "type": "path", "d": SQUARE, "fill": "#f4e9d0",
            "texture": {"finish": finish, "color": "#20304a", "seed": 11},
            "stroke": "#111111", "strokeWidth": 3
        })]),
    )
}

#[test]
fn static_textures_are_byte_identical_across_time_and_sampling_order() {
    for finish in ["ink", "pencil", "grain", "screen", "riso"] {
        let mut forward = Stage::new(textured(finish));
        let reference = forward.bytes(0.0);
        assert!(reference.len() > 64);
        for t in [0.01, 0.5, 1.37, 3.99] {
            assert_eq!(forward.bytes(t), reference, "{finish} @ {t}");
        }
        // Out of order, and with a new renderer instance (no cache available), same result
        let mut shuffled = Stage::new(textured(finish));
        for t in [3.2, 0.0, 2.5, 0.01] {
            assert_eq!(shuffled.bytes(t), reference, "{finish} out of order @ {t}");
        }
    }
}

#[test]
fn flat_finish_adds_nothing() {
    let mut stage = Stage::new(doc(
        json!({}),
        svg(vec![json!({
            "type": "path", "d": SQUARE, "fill": "#f4e9d0", "texture": {"finish": "flat"}
        })]),
    ));
    assert_eq!(kinds(&stage.ops(0.0)), ["fill"]);
}

#[test]
fn texture_geometry_rides_the_rigid_transform() {
    // The texture is generated in path-local coordinates: node translation and rotation only change tf, and the geometry in the side table stays byte-identical.
    let moving = |animate: Value| {
        doc(
            json!({}),
            json!({
                "type": "svg", "id": "art", "viewBox": "0 0 240 160",
                "style": {"width": 240, "height": 160},
                "animate": animate,
                "children": [{
                    "type": "path", "d": SQUARE, "fill": "#f4e9d0",
                    "texture": {"finish": "ink", "color": "#20304a", "seed": 5}
                }]
            }),
        )
    };
    let mut stage = Stage::new(moving(json!({"keyframes": [
        {"prop": "x", "frames": [{"t": 0, "v": 0}, {"t": 2, "v": 60}]},
        {"prop": "rotation", "frames": [{"t": 0, "v": 0}, {"t": 2, "v": 30}]}
    ]})));
    let a = stage.renderer.record(&stage.ir, &mut stage.engine, 0.0);
    let b = stage.renderer.record(&stage.ir, &mut stage.engine, 1.5);
    assert_eq!(a.paths, b.paths, "the path side table (including texture geometry) does not change with the transform");
    assert!(encode(&a) != encode(&b), "the transform does move things");
}

#[test]
fn background_texture_covers_the_canvas() {
    let plain = doc(json!({"background": "#fbf3e2"}), svg(vec![]));
    let mut plain = Stage::new(plain);
    assert!(kinds(&plain.ops(0.0)).is_empty());

    let mut paper = Stage::new(doc(
        json!({"background": {"color": "#fbf3e2", "texture": {"finish": "grain", "color": "#7a6a4f", "seed": 2}}}),
        svg(vec![]),
    ));
    assert_eq!(kinds(&paper.ops(0.0)), ["clip", "fill", "popClip"]);
    assert_eq!(paper.bytes(0.0), paper.bytes(2.75));
    let data = paper.pixels(0.0);
    let speckled = (0..160)
        .flat_map(|y| (0..W).map(move |x| (x, y)))
        .filter(|&(x, y)| px(&data, x, y) != [0xfb, 0xf3, 0xe2, 255])
        .count();
    assert!(speckled > 50, "paper should have grain ({speckled})");
}

/// Raster cache for the paper background (`FrameOps::static_prefix`): the recorder only sets the hint for documents with a texture. For frames with the hint set, whether first (a miss: render and store one picture) or later (a hit: copy the cache), the result is pixel-identical to replaying from scratch without the hint, while moving elements on the paper still change frame by frame. Layered plans are likewise consistent.
#[test]
fn background_texture_raster_cache_is_pixel_exact() {
    let mover = json!({
        "type": "box", "id": "m",
        "style": {"width": 40, "height": 40, "background": "#c0392b"},
        "animate": {"keyframes": [{"prop": "x", "frames": [{"t": 0, "v": 0}, {"t": 4, "v": 190}]}]}
    });
    let mut plain = Stage::new(doc(json!({"background": "#fbf3e2"}), mover.clone()));
    assert!(
        plain
            .renderer
            .record(&plain.ir, &mut plain.engine, 0.0)
            .static_prefix
            .is_none()
    );

    // The seed takes a value unique to this test, so no other test in the process-level cache will have put the same paper in first.
    let mut paper = Stage::new(doc(
        json!({"background": {"color": "#fbf3e2", "texture": {"finish": "grain", "color": "#7a6a4f", "seed": 4242}}}),
        mover,
    ));
    let mut reference = paper.renderer.record(&paper.ir, &mut paper.engine, 0.0);
    let hint = reference.static_prefix.expect("a textured document should carry a prefix hint");
    assert!(
        matches!(reference.ops[0], DrawOp::Clear { .. }),
        "the prefix starts at Clear"
    );
    assert!(
        matches!(reference.ops[hint.ops - 1], DrawOp::PopClip),
        "the prefix ends at the texture's PopClip"
    );
    reference.static_prefix = None;
    let mut media = MediaStore::new(Arc::new(LoadedAssets::default()), paper.ir.fps);
    let expected = render_raster::raster::rasterize(&reference, W, 160, &mut media).unwrap();

    let mut frames = Vec::new();
    for t in [0.0, 0.0, 1.5, 3.0] {
        let frame = paper.renderer.record(&paper.ir, &mut paper.engine, t);
        assert_eq!(frame.static_prefix, Some(hint), "the hint is independent of time");
        let cached = render_raster::raster::rasterize(&frame, W, 160, &mut media).unwrap();
        let mut uncached = frame;
        uncached.static_prefix = None;
        let replay = render_raster::raster::rasterize(&uncached, W, 160, &mut media).unwrap();
        assert!(
            cached.data() == replay.data(),
            "t={t}: cache and replay are pixel-identical"
        );
        assert!(
            paper.pixels(t) == cached.data(),
            "t={t}: layered plan matches the flat raster"
        );
        frames.push(cached);
    }
    assert!(frames[0].data() == expected.data() && frames[1].data() == expected.data());
    assert!(
        frames[2].data() != frames[3].data(),
        "elements on the paper still move every frame"
    );
}

// ── clipPath path shape / anchor array ────────────────────────────────────

#[test]
fn clip_path_shape_path_clips_to_the_polygon() {
    let mut stage = Stage::new(doc(
        json!({}),
        json!({
            "type": "box", "id": "b",
            "style": {
                "width": 200, "height": 100, "background": "#ff0000",
                // Upper-left triangle
                "clipPath": {"shape": "path", "d": "M0 0 L1 0 L0 1 Z"}
            }
        }),
    ));
    let data = stage.pixels(0.0);
    assert_eq!(px(&data, 20, 10), [255, 0, 0, 255]);
    assert_eq!(px(&data, 190, 90), [255, 255, 255, 255], "bottom-right corner is clipped");
}

#[test]
fn clip_path_shape_path_is_static_only() {
    // Channel values are checked by lint, since there is no `Result` at recording time
    let diagnostics = scene_primitives::lint::lint(&doc(
        json!({}),
        json!({
            "type": "box", "id": "b", "style": {"width": 100, "height": 100},
            "animate": {"keyframes": [{"prop": "clipPath", "frames": [
                {"t": 0, "v": {"shape": "path", "d": "M0 0 L1 0 L0 1 Z"}},
                {"t": 1, "v": {"shape": "path", "d": "M0 0 L1 1 L0 1 Z"}}
            ]}]}
        }),
    ));
    assert!(
        diagnostics.iter().any(|d| d.message.contains("can only be set on a static style.clipPath")),
        "{:?}",
        diagnostics.iter().map(|d| &d.message).collect::<Vec<_>>()
    );
}

#[test]
fn numeric_anchor_is_a_box_fraction_and_matches_the_named_anchors() {
    let bar = |anchor: Value| {
        doc(
            json!({}),
            json!({
                "type": "box", "id": "bar",
                "style": {
                    "width": 100, "height": 20, "background": "#000000",
                    "anchor": anchor, "rotation": 90
                }
            }),
        )
    };
    let bytes = |anchor: Value| Stage::new(bar(anchor)).bytes(0.0);
    assert_eq!(bytes(json!([0.5, 1.0])), bytes(json!("bottom")));
    assert_eq!(bytes(json!([0.5, 0.0])), bytes(json!("top")));
    assert_eq!(bytes(json!([0.5, 0.5])), bytes(json!("center")));
    assert!(
        bytes(json!([0.0, 0.5])) != bytes(json!("center")),
        "the joint is at the left end"
    );

    let error = Resolver::new(bar(json!([0.5])), None)
        .and_then(|mut r| r.resolve())
        .err()
        .expect("anchor array must have two items");
    assert!(error.to_string().starts_with("schema:"), "{error}");
}

// ── cadence ───────────────────────────────────────────────────────────

fn slider(meta: Value, clip_extra: Value, node_extra: Value) -> Value {
    let mut node = json!({
        "type": "box", "id": "dot",
        "style": {"position": "absolute", "left": 0, "top": 0, "width": 10, "height": 10, "background": "#000000"},
        "animate": {"keyframes": [{"prop": "x", "frames": [{"t": 0, "v": 0}, {"t": 4, "v": 200}]}]}
    });
    for (k, v) in node_extra.as_object().unwrap() {
        node[k] = v.clone();
    }
    let mut document = doc(
        meta,
        json!({"type": "box", "id": "root", "style": {"width": 240, "height": 160}, "children": [node]}),
    );
    for (k, v) in clip_extra.as_object().unwrap() {
        document["tracks"][0]["clips"][0][k] = v.clone();
    }
    document
}

#[test]
fn cadence_holds_frames_on_the_absolute_project_grid() {
    let mut stage = Stage::new(slider(
        json!({"cadence": {"fps": 12}}),
        json!({}),
        json!({}),
    ));
    let hold = stage.bytes(1.0);
    // All 60 fps output frames between 1.0 and 1.0 + 1/12 equal the grid-point frame
    for k in 1..5 {
        assert_eq!(stage.bytes(1.0 + f64::from(k) / 60.0), hold, "k={k}");
    }
    assert!(stage.bytes(1.0 + 5.0 / 60.0) != hold, "the next drawn frame");

    // Independent of output frame rate: timestamps at 24, 30 and 60 fps fall in the same cell ⇒ same frame
    for fps in [24.0, 30.0, 60.0] {
        for n in 0..(4.0 * fps) as u32 {
            let t = f64::from(n) / fps;
            let grid = ((t * 12.0) + 1e-9).floor() / 12.0;
            assert_eq!(stage.bytes(t), stage.bytes(grid), "fps={fps} n={n}");
        }
    }

    // Out-of-order sampling: new instance, fetched in reverse, same result
    let mut other = Stage::new(slider(
        json!({"cadence": {"fps": 12}}),
        json!({}),
        json!({}),
    ));
    for t in [3.3, 0.2, 2.71, 1.0] {
        assert_eq!(other.bytes(t), stage.bytes(t));
    }
}

#[test]
fn cadence_overrides_cascade_meta_clip_node() {
    let smooth = |stage: &mut Stage| stage.bytes(1.0) != stage.bytes(1.0 + 1.0 / 60.0);

    let mut none = Stage::new(slider(json!({}), json!({}), json!({})));
    assert!(smooth(&mut none), "no cadence: moves every frame");

    let mut meta = Stage::new(slider(
        json!({"cadence": {"fps": 12}}),
        json!({}),
        json!({}),
    ));
    assert!(!smooth(&mut meta));

    let mut clip_off = Stage::new(slider(
        json!({"cadence": {"fps": 12}}),
        json!({"cadence": "none"}),
        json!({}),
    ));
    assert!(smooth(&mut clip_off), "clip-level none exits the domain");

    let mut node_on = Stage::new(slider(json!({}), json!({}), json!({"cadence": {"fps": 8}})));
    assert!(!smooth(&mut node_on), "node-level enters the domain");
    assert!(node_on.bytes(1.0) != node_on.bytes(1.0 + 1.0 / 8.0));

    let mut node_off = Stage::new(slider(
        json!({"cadence": {"fps": 12}}),
        json!({}),
        json!({"cadence": "none"}),
    ));
    assert!(smooth(&mut node_off), "node-level none exits the domain");
}

#[test]
fn cadence_never_samples_before_the_clip_starts() {
    // The clip start 0.30 is not on the 12 fps grid (grid points 0.25 and 0.333): the first frame samples at the clip start rather than falling back to 0.25, because at that time the clip does not yet exist.
    let mut document = slider(
        json!({"cadence": {"fps": 12}}),
        json!({"start": 0.30}),
        json!({}),
    );
    document["tracks"][0]["clips"][0]["element"]["children"][0]["animate"] = json!({
        "keyframes": [{"prop": "x", "frames": [{"t": 0, "v": 100}, {"t": 3.7, "v": 200}]}]
    });
    let mut stage = Stage::new(document);
    assert_eq!(stage.bytes(0.30), stage.bytes(0.32));
    assert!(stage.bytes(0.32) != stage.bytes(0.34), "from 0.333 on, enters the next cell");
}

#[test]
fn boil_reseeds_on_draw_frames_and_static_wobble_does_not() {
    let wobbly = |every: u32| {
        doc(
            json!({"cadence": {"fps": 12}}),
            svg(vec![json!({
                "type": "path", "d": SQUARE, "stroke": "#000000", "strokeWidth": 3,
                "wobble": {"amp": 3, "seed": 9, "every": every}
            })]),
        )
    };
    let mut still = Stage::new(wobbly(0));
    assert_eq!(still.bytes(0.0), still.bytes(3.0));

    let mut boil = Stage::new(wobbly(2));
    // every=2 ⇒ changes every 2 drawn frames (1/6 s)
    assert_eq!(boil.bytes(1.0), boil.bytes(1.0 + 1.0 / 12.0 + 0.01));
    assert!(boil.bytes(1.0) != boil.bytes(1.0 + 2.0 / 12.0 + 0.01));
    // Pure function: returning to the same instant gives the same frame
    let again = boil.bytes(1.0);
    boil.bytes(2.5);
    assert_eq!(boil.bytes(1.0), again);
}
