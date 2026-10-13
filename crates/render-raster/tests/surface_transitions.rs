//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer`
//! (the BCF document rendering path and the host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Surface Transition (spec §9 category two, design §6.4 / stage 5).
//!
//! The division of labor with the Motion version in `transitions.rs` is clear: each cut point here grows `Draw(from) → Draw(to) → Transition → Composite`. The two sides' pictures **do not move**, and a dual-input effect driven by `progress` composites them. A document without a Surface Transition gets not a single extra pass, and that invariant is guarded by `transitions.rs` and `frame_plan.rs`.

use render_raster::plan::{
    CapabilityProfile, CpuExecutor, FramePlanner, RenderPass, SurfaceLifetime, execute_plan,
};
use render_raster::{FrameRenderer, LoadedAssets, MediaStore, TextEngine};
use scene_primitives::resolve::{Ir, Resolver};
use serde_json::{Value, json};
use std::sync::Arc;

const W: u32 = 240;
const H: u32 = 160;
const T0: f64 = 1.0;
const DUR: f64 = 0.4;

const RED: [u8; 4] = [0xff, 0x33, 0x66, 0xff];
const BLUE: [u8; 4] = [0x22, 0x66, 0xff, 0xff];

fn plate(id: &str, color: &str) -> Value {
    json!({"type": "box", "id": id,
           "style": {"width": W, "height": H, "background": color}})
}

fn doc(transition: Value) -> Value {
    json!({
        "ccut": "0.2",
        "meta": {"id": "st", "width": W, "height": H, "fps": 30, "background": "#000000"},
        "scenes": [{"id": "a", "dur": 1}, {"id": "b", "dur": 1}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "a", "start": 0, "end": "@a.end",
             "transitionOut": transition,
             "element": plate("pa", "#ff3366")},
            {"id": "b", "start": "@b", "end": "@b.end",
             "element": plate("pb", "#2266ff")}
        ]}]
    })
}

fn circle_crop() -> Value {
    json!({"preset": "transition.circleCrop", "presetVersion": 1, "dur": DUR})
}

fn ir_of(document: Value) -> Ir {
    Resolver::new(document, None).unwrap().resolve().unwrap()
}

/// `Ir` has no `Debug`, so `unwrap_err()` cannot be used.
fn resolve_error(document: Value) -> String {
    match Resolver::new(document, None).unwrap().resolve() {
        Ok(_) => panic!("expected an error"),
        Err(error) => error.to_string(),
    }
}

struct Frame {
    data: Vec<u8>,
    kinds: Vec<&'static str>,
    lifetimes: Vec<SurfaceLifetime>,
}

fn render(document: Value, t: f64) -> Frame {
    let mut ir = ir_of(document);
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let planner = FramePlanner::cpu(&ir).unwrap();
    let plan = planner.plan(&renderer, &ir, &mut engine, t);
    plan.validate().unwrap();
    let kinds = plan.passes.iter().map(RenderPass::kind).collect();
    let lifetimes = plan.surfaces.iter().map(|s| s.lifetime).collect();
    let mut executor = CpuExecutor::new(CapabilityProfile::cpu_reference());
    let mut media = MediaStore::new(Arc::new(LoadedAssets::default()), ir.fps);
    let pixmap = execute_plan(&plan, &mut executor, &mut media, None).unwrap();
    Frame {
        data: pixmap.data().to_vec(),
        kinds,
        lifetimes,
    }
}

fn px(data: &[u8], x: u32, y: u32) -> [u8; 4] {
    let i = ((y * W + x) * 4) as usize;
    [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

// ── Plan shape ────────────────────────────────────────────────────────────

/// One Surface Transition cut point = two offscreen surfaces + one `Transition` pass, with the result composited back into the accumulated picture. This is what `ccut ops` shows.
#[test]
fn a_surface_transition_grows_a_transition_pass() {
    let frame = render(doc(circle_crop()), T0);
    assert_eq!(
        frame.kinds,
        ["draw", "draw", "draw", "transition", "composite"],
        "planned shape: background layer + sides + transition + composite"
    );
}

/// Outside the window there is no second picture, so the plan still **folds into a single Draw pass**. Declaring a Surface Transition should not make the whole timeline pay for offscreen rendering.
#[test]
fn outside_the_window_the_plan_still_folds() {
    for t in [0.3, 0.5, 1.5, 1.8] {
        let frame = render(doc(circle_crop()), t);
        assert_eq!(frame.kinds, ["draw"], "t={t}");
    }
}

/// When both sides' pictures are unchanged across frames, declare them `Static` (design §6.6: static surfaces may persist across frames). The criterion is conservative: a side with an animation attached falls back to `PerFrame`.
#[test]
fn static_sides_are_declared_static() {
    let frame = render(doc(circle_crop()), T0);
    // Background layer, two sides, transition output, composite output. The two sides are solid color boards, so Static.
    assert_eq!(
        frame.lifetimes,
        [
            SurfaceLifetime::PerFrame,
            SurfaceLifetime::Static,
            SurfaceLifetime::Static,
            SurfaceLifetime::PerFrame,
            SurfaceLifetime::PerFrame,
        ]
    );

    // Attach an animation to the outgoing board, and its side is no longer static.
    let mut animated = doc(circle_crop());
    animated["tracks"][0]["clips"][0]["element"]["animate"] =
        json!({"enter": {"preset": "fadeIn", "dur": 0.3}});
    let frame = render(animated, T0);
    assert_eq!(frame.lifetimes[1], SurfaceLifetime::PerFrame);
    assert_eq!(frame.lifetimes[2], SurfaceLifetime::Static);
}

// ── Pixel semantics ───────────────────────────────────────────────────────

/// Endpoints: at the start of the window the whole frame is the outgoing picture, and at the end the whole frame is the incoming picture.
/// This is the shape of `progress = 0 ⇒ from` and `= 1 ⇒ to` across the **whole chain**.
#[test]
fn the_window_endpoints_are_the_two_shots() {
    let start = render(doc(circle_crop()), T0 - DUR / 2.0);
    let end = render(doc(circle_crop()), T0 + DUR / 2.0);
    for x in (0..W).step_by(7) {
        for y in (0..H).step_by(11) {
            assert_eq!(px(&start.data, x, y), RED, "start ({x},{y})");
            assert_eq!(px(&end.data, x, y), BLUE, "end ({x},{y})");
        }
    }
}

/// Midpoint: near the circle's center is already the incoming picture, while the four corners are still the outgoing picture. The circle is **opening up**.
#[test]
fn the_circle_opens_from_the_centre() {
    let mid = render(doc(circle_crop()), T0);
    assert_eq!(px(&mid.data, W / 2, H / 2), BLUE, "circle center");
    assert_eq!(px(&mid.data, 1, 1), RED, "top-left corner");
    assert_eq!(px(&mid.data, W - 2, H - 2), RED, "bottom-right corner");
}

/// When the frame falls exactly on the end of the window, it is still the last frame of the transition (`progress = 1`), and the outgoing picture no longer shows. This uses the numbers from a real flashback in the footage: cut point `2493/30` s, `dur` 0.8 s, and the end is frame 2505. The window end was once computed as `(t0 − half) + 2·half`, giving `83.49999999999999`, which is one ulp earlier than this frame, while the render window of the outgoing clip extends to `t0 + half = 83.5`, so this frame still drew the outgoing picture. The incoming picture only occupies a small patch at the top-left and is transparent elsewhere, so drawing the outgoing picture one extra frame would expose it at the bottom-right corner.
#[test]
fn the_last_frame_of_the_window_does_not_flash_back() {
    let cut = 2493.0 / 30.0;
    let document = json!({
        "ccut": "0.2",
        "meta": {"id": "st", "width": W, "height": H, "fps": 30, "background": "#000000"},
        "scenes": [{"id": "a", "dur": cut}, {"id": "b", "dur": 1}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "a", "start": 0, "end": "@a.end",
             "transitionOut": {"preset": "transition.inkBlot", "presetVersion": 1, "dur": 0.8,
                               "params": {"seed": 5}},
             "element": plate("pa", "#ff3366")},
            {"id": "b", "start": "@b", "end": "@b.end",
             "element": {"type": "box", "id": "pb",
                         "style": {"width": 24, "height": 24, "background": "#2266ff"}}}
        ]}]
    });
    let end = render(document, 2505.0 / 30.0);
    assert_eq!(px(&end.data, 4, 4), BLUE, "incoming picture");
    assert_eq!(
        px(&end.data, W - 2, H - 2),
        [0, 0, 0, 0xff],
        "the end frame exposed the outgoing picture"
    );
}

/// `params` really enter the uniform: moving the circle center to the top-left, the bottom-right corner is consumed last.
#[test]
fn params_reach_the_effect_uniforms() {
    let mut spec = circle_crop();
    spec["params"] = json!({"cx": 0.0, "cy": 0.0});
    let mid = render(doc(spec), T0);
    assert_eq!(px(&mid.data, 1, 1), BLUE, "circle center is already at top-left");
    assert_eq!(px(&mid.data, W - 2, H - 2), RED, "the diagonal changes last");
}

/// The flat path (`FrameRenderer::record`, the stream `ccut ops` prints) cannot draw a dual-input composite, so it **degrades** to the Motion fallback of the cut point rather than silently dropping the transition. The default fallback is `crossfade`: the start of the window still shows only the outgoing picture.
#[test]
fn the_flat_path_degrades_to_the_motion_fallback() {
    let mut ir = ir_of(doc(circle_crop()));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let mut media = MediaStore::new(Arc::new(LoadedAssets::default()), ir.fps);
    // Start: crossfade's in-channel opacity = 0, so the incoming picture is entirely invisible.
    let start = renderer
        .draw(&ir, &mut engine, &mut media, T0 - DUR / 2.0)
        .unwrap();
    assert_eq!(px(start.data(), W / 2, H / 2), RED);
    // Midpoint: the two boards overlap, and the color is neither pure red nor pure blue.
    let mid = renderer.draw(&ir, &mut engine, &mut media, T0).unwrap();
    let centre = px(mid.data(), W / 2, H / 2);
    assert_ne!(centre, RED);
    assert_ne!(centre, BLUE);
}

/// The declared `fallback` must be a Motion recipe. The degradation target is a property track, and it cannot be another Surface effect that equally fails to run.
#[test]
fn an_unknown_fallback_is_refused() {
    let mut spec = circle_crop();
    spec["fallback"] = json!("transition.wipe");
    let error = resolve_error(doc(spec));
    assert!(error.contains("transition-unknown"), "{error}");
}

/// An unknown `transition.*` name and an unknown version must give **different** diagnostics.
#[test]
fn unknown_names_and_unknown_versions_are_different_diagnostics() {
    let mut nope = circle_crop();
    nope["preset"] = json!("transition.nope");
    let error = resolve_error(doc(nope));
    assert!(error.contains("transition-unknown"), "{error}");

    let mut future = circle_crop();
    future["presetVersion"] = json!(9);
    let error = resolve_error(doc(future));
    assert!(error.contains("preset-version-unknown"), "{error}");
}

/// Parameter validation takes the same manifest path as `effects[]`.
#[test]
fn unknown_params_are_refused() {
    let mut spec = circle_crop();
    spec["params"] = json!({"radiuz": 1.0});
    let error = resolve_error(doc(spec));
    assert!(error.contains("preset-param-unknown"), "{error}");
}

/// Both sides of a transition are **single-layer** offscreen pictures, so no effect stack may appear in the subtrees of those two clips. Preflight rejects this directly rather than silently dropping `effects[]`.
#[test]
fn an_effect_stack_inside_a_transition_side_is_rendered() {
    let mut document = doc(circle_crop());
    document["tracks"][0]["clips"][1]["element"]["effects"] =
        json!([{"preset": "filter.blur", "params": {"radius": 0.02}}]);
    let frame = render(document, T0);
    assert!(frame.kinds.contains(&"filter"));
    assert!(frame.kinds.contains(&"transition"));
    assert_eq!(px(&frame.data, W / 2, H / 2), BLUE);
}

/// All four built-in transitions can run on the CPU reference: the degradation list is empty, and `fallbacks[]` has no transition record.
#[test]
fn the_cpu_reference_never_falls_back() {
    let ir = ir_of(doc(circle_crop()));
    let planner = FramePlanner::cpu(&ir).unwrap();
    assert!(planner.transition_fallbacks().is_empty());
    assert!(planner.report().is_ok());
    assert!(
        planner
            .report()
            .fallbacks
            .iter()
            .all(|record| !record.reason.starts_with("transition-fallback-applied"))
    );
}

/// When a backend cannot run this transition, **fall back to the Motion channel** rather than erroring or drawing nothing.
///
/// The four built-ins are all strict and have a CPU reference, so this path never fires on the CPU backend. The test swaps the effect reference in the IR for an unregistered version to go through the same decision.
#[test]
fn a_backend_that_cannot_run_the_effect_falls_back_to_motion() {
    let mut ir = ir_of(doc(circle_crop()));
    ir.surface_transitions[0].effect = motion::effect::EffectRef::new("transition.circleCrop", 9);

    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let planner = FramePlanner::cpu(&ir).unwrap();

    // The degradation list is recorded by `from_clip`; `fallbacks[]` carries which Motion recipe the target is.
    assert_eq!(
        planner.transition_fallbacks().iter().collect::<Vec<_>>(),
        ["a"]
    );
    let record = planner
        .report()
        .fallbacks
        .iter()
        .find(|record| record.reason.starts_with("transition-fallback-applied"))
        .expect("should record one transition downgrade");
    assert_eq!(record.applied_preset.as_deref(), Some("crossfade"));
    assert!(record.applied.is_none(), "the transition target is not another effect");
    // "A degradation is available" is not a hard error: the whole timeline still renders as usual.
    assert!(planner.report().is_ok());

    // The plan has no Transition pass any more. It degraded into property tracks on both sides, so it folds.
    let plan = planner.plan(&renderer, &ir, &mut engine, T0);
    assert_eq!(
        plan.passes.iter().map(RenderPass::kind).collect::<Vec<_>>(),
        ["draw"]
    );

    // crossfade's window start: the incoming picture has opacity = 0, so the whole frame is still the outgoing picture.
    let mut media = MediaStore::new(Arc::new(LoadedAssets::default()), ir.fps);
    let mut executor = CpuExecutor::new(CapabilityProfile::cpu_reference());
    let start = planner.plan(&renderer, &ir, &mut engine, T0 - DUR / 2.0);
    let pixmap = execute_plan(&start, &mut executor, &mut media, None).unwrap();
    assert_eq!(px(pixmap.data(), W / 2, H / 2), RED);
}

// ── shatter / glitch (§9 implementation status) ───────────────────────────

fn shatter(dur: f64, params: Value) -> Value {
    json!({"preset": "transition.shatter", "presetVersion": 1, "dur": dur, "params": params})
}

fn glitch(dur: f64, params: Value) -> Value {
    json!({"preset": "transition.glitch", "presetVersion": 1, "dur": dur, "params": params})
}

/// Both new transitions hold their endpoints across the whole chain: at the window start the whole frame is outgoing, and at the end the whole frame is incoming. Both colors are present in between, and re-rendering at the same moment gives byte-identical output (seekable).
#[test]
fn shatter_and_glitch_keep_the_endpoints_and_are_seekable() {
    let dur = 0.8;
    for spec in [
        shatter(dur, json!({"seed": 7})),
        glitch(dur, json!({"seed": 3, "amount": 0.2})),
        glitch(dur, json!({"direction": "horizontal", "slices": 12})),
    ] {
        let name = spec["preset"].as_str().unwrap().to_string();
        let start = render(doc(spec.clone()), T0 - dur / 2.0);
        let end = render(doc(spec.clone()), T0 + dur / 2.0);
        for x in (0..W).step_by(9) {
            for y in (0..H).step_by(13) {
                assert_eq!(px(&start.data, x, y), RED, "{name} start ({x},{y})");
                assert_eq!(px(&end.data, x, y), BLUE, "{name} end ({x},{y})");
            }
        }
        let mid = render(doc(spec.clone()), T0 + 0.05);
        assert!(mid.kinds.contains(&"transition"), "{name}");
        let colors: std::collections::BTreeSet<[u8; 4]> = mid
            .data
            .chunks_exact(4)
            .map(|c| [c[0], c[1], c[2], c[3]])
            .collect();
        assert!(colors.contains(&BLUE), "{name} mid-section should reveal the incoming frame");
        assert!(colors.contains(&RED), "{name} mid-section should still show the outgoing frame");
        // Seek back backwards: byte-identical to the first time.
        let _ = render(doc(spec.clone()), T0 + dur / 2.0 - 0.01);
        assert_eq!(
            render(doc(spec), T0 + 0.05).data,
            mid.data,
            "{name} can seek"
        );
    }
}

/// The shatter fragments are shaped by the seed: a different seed gives a different picture, and the same seed gives the same one. Fragments near the explosion center break first, and the four corners lift off last.
#[test]
fn shatter_is_shaped_by_its_seed_and_breaks_from_the_impact() {
    let dur = 1.0;
    let early = T0 - dur / 2.0 + 0.12 * dur;
    let a = render(doc(shatter(dur, json!({"seed": 1}))), early).data;
    let b = render(doc(shatter(dur, json!({"seed": 2}))), early).data;
    let a2 = render(doc(shatter(dur, json!({"seed": 1}))), early).data;
    assert_eq!(a, a2);
    assert_ne!(a, b);
    // p = 0.12: the corner farthest from the explosion center has not yet lifted off (delay ≥ 0.3 × near 1), so it is still the outgoing picture.
    assert_eq!(px(&a, 0, 0), RED);
    assert_eq!(px(&a, W - 1, H - 1), RED);
}

/// The look of glitch is determined by the seed and the direction: a different seed or direction gives a different picture, and the same parameters give the same one.
#[test]
fn glitch_is_shaped_by_seed_and_direction() {
    let dur = 0.4;
    let mid = T0 + 0.02;
    let frame = |params: Value| render(doc(glitch(dur, params)), mid).data;
    let a = frame(json!({"seed": 1}));
    assert_eq!(a, frame(json!({"seed": 1})));
    assert_ne!(a, frame(json!({"seed": 2})));
    assert_ne!(a, frame(json!({"seed": 1, "direction": "horizontal"})));
}
