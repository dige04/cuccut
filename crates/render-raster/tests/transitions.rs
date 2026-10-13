//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer` (the BCF document rendering pipeline and the host byte layer), which do not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Transitions (spec §9, design §6.4).
//!
//! This file covers only **Motion Transitions**: the property tracks of both clips, without starting an offscreen surface.
//! So every one of these must keep "the plan collapses into a single Draw pass": a transition is not an effect stack.
//! The `Transition` pass for Surface Transitions is in `surface_transitions.rs`.

use render_raster::plan::FramePlanner;
use render_raster::{FrameRenderer, LoadedAssets, MediaStore, TextEngine};
use scene_primitives::resolve::{Ir, Resolver};
use serde_json::{Value, json};
use std::sync::Arc;

const W: u32 = 240;
const H: u32 = 160;
/// Cut point. The window is symmetric: `[t0 - dur/2, t0 + dur/2]` = `[0.8, 1.2]`.
const T0: f64 = 1.0;
const DUR: f64 = 0.4;

const RED: [u8; 4] = [0xff, 0x33, 0x66, 0xff];
const BLUE: [u8; 4] = [0x22, 0x66, 0xff, 0xff];

fn doc(preset: &str) -> Value {
    let plate = |id: &str, color: &str| {
        json!({"type": "box", "id": id,
               "style": {"width": W, "height": H, "background": color}})
    };
    json!({
        "ccut": "0.2",
        "meta": {"id": "tr", "width": W, "height": H, "fps": 30, "background": "#000000"},
        "scenes": [{"id": "a", "dur": 1}, {"id": "b", "dur": 1}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "a", "start": 0, "end": "@a.end",
             "transitionOut": {"preset": preset, "dur": DUR},
             "element": plate("pa", "#ff3366")},
            {"id": "b", "start": "@b", "end": "@b.end",
             "element": plate("pb", "#2266ff")}
        ]}]
    })
}

fn ir_of(document: Value) -> Ir {
    Resolver::new(document, None).unwrap().resolve().unwrap()
}

/// Render one instant, and also report the pass count: a Motion Transition must always be 1.
fn render(preset: &str, t: f64) -> (Vec<u8>, usize) {
    let mut ir = ir_of(doc(preset));
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let planner = FramePlanner::cpu(&ir).unwrap();
    let plan = planner.plan(&renderer, &ir, &mut engine, t);
    plan.validate().unwrap();
    let mut executor = render_raster::plan::CpuExecutor::default();
    let mut media = MediaStore::new(Arc::new(LoadedAssets::default()), ir.fps);
    let pixmap = render_raster::plan::execute_plan(&plan, &mut executor, &mut media, None).unwrap();
    (pixmap.data().to_vec(), plan.passes.len())
}

fn px(data: &[u8], x: u32, y: u32) -> [u8; 4] {
    let i = ((y * W + x) * 4) as usize;
    [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

fn uniform(data: &[u8], expected: [u8; 4]) -> bool {
    (0..W)
        .step_by(7)
        .all(|x| (0..H).step_by(11).all(|y| px(data, x, y) == expected))
}

/// The ten words from spec §9 Appendix B. Before stage 5, the last four already report `transition-unknown` at resolve time.
const VOCABULARY: &[&str] = &[
    "cut",
    "crossfade",
    "slideLeft",
    "slideRight",
    "slideUp",
    "slideDown",
    "wipeLeft",
    "wipeRight",
    "zoomThrough",
    "whipPan",
];

/// Both ends of the window are **clean** single frames: at `t0 - dur/2` only the outgoing frame remains, and at `t0 + dur/2` only the incoming frame remains. `cut` is the exception: it produces no channel, so during the overlap the two frames are stacked directly (this is the definition of `cut`, not a defect).
#[test]
fn every_motion_transition_starts_at_from_and_ends_at_to() {
    for preset in VOCABULARY {
        if *preset == "cut" {
            continue;
        }
        let (start, _) = render(preset, T0 - DUR / 2.0);
        assert!(uniform(&start, RED), "{preset}: 窗口起点应当只有离场画面");
        let (end, _) = render(preset, T0 + DUR / 2.0);
        assert!(uniform(&end, BLUE), "{preset}: 窗口终点应当只有入场画面");
    }
}

/// A Motion Transition is a property track, with **not a single extra pass**.
#[test]
fn motion_transitions_stay_in_one_draw_pass() {
    for preset in VOCABULARY {
        for t in [0.5, 0.8, 0.9, 1.0, 1.1, 1.2, 1.5] {
            let (_, passes) = render(preset, t);
            assert_eq!(passes, 1, "{preset} @ {t}");
        }
    }
}

/// The window midpoint must differ from both ends: "the recipe exists but nothing moved" fails here.
#[test]
fn every_motion_transition_actually_moves_at_the_midpoint() {
    for preset in VOCABULARY {
        if *preset == "cut" {
            continue;
        }
        let (mid, _) = render(preset, T0);
        assert!(!uniform(&mid, RED), "{preset}: 中点仍是纯离场画面");
        assert!(!uniform(&mid, BLUE), "{preset}: 中点已经是纯入场画面");
    }
}

/// The wipe edge of `wipeLeft` is at `x = (1 - p)·W`, and that of `wipeRight` is at `x = p·W`. At the midpoint both edges are at the exact center of the canvas, with hard edges on both sides and no feathering, and **the frame itself does not move** (this is exactly the difference between wipe and slide: with slide, both frames are offset by half a screen at the same instant).
#[test]
fn the_wipe_edge_sweeps_the_declared_direction() {
    let (left, _) = render("wipeLeft", T0);
    for y in (0..H).step_by(11) {
        assert_eq!(px(&left, 60, y), RED, "wipeLeft: 边左侧应是离场画面");
        assert_eq!(px(&left, 180, y), BLUE, "wipeLeft: 边右侧应是入场画面");
        // Hard edge: the adjacent pixels on either side of the edge switch colors directly, with no blending in between.
        assert_eq!(px(&left, 119, y), RED);
        assert_eq!(px(&left, 120, y), BLUE);
    }

    let (right, _) = render("wipeRight", T0);
    for y in (0..H).step_by(11) {
        assert_eq!(px(&right, 60, y), BLUE, "wipeRight: 边左侧应是入场画面");
        assert_eq!(px(&right, 180, y), RED, "wipeRight: 边右侧应是离场画面");
        assert_eq!(px(&right, 119, y), BLUE);
        assert_eq!(px(&right, 120, y), RED);
    }
}

/// `zoomThrough` is anchored on the **canvas center**: the incoming frame shrinks to 0.9375× at the midpoint, so the four corners show the background (black), while the center is still the frame. This test fails if the scale anchor is wrongly set to the element's top-left corner.
#[test]
fn zoom_through_scales_about_the_canvas_centre() {
    let (mid, _) = render("zoomThrough", T0);
    // At 240×160 the 0.9375× incoming board leaves a 7.5px gap on the left and right and a 5px gap on the top and bottom; the outgoing board is 1.1875×, covering only up to beyond the canvas, so what remains at the corners is the outgoing one.
    assert_ne!(px(&mid, 0, 0), [0, 0, 0, 255], "角上不该是纯背景");
    // Both boards cover the center, so after compositing it is neither pure red nor pure blue.
    let centre = px(&mid, W / 2, H / 2);
    assert_ne!(centre, RED);
    assert_ne!(centre, BLUE);
}

/// The two frames of `whipPan` travel in **opposite directions**: at the midpoint the outgoing frame has already moved left, while the incoming frame is still on the right. If they moved in the same direction, the two frames would be stacked and panning together (a pitfall hit before release).
#[test]
fn whip_pan_moves_the_two_shots_in_opposite_directions() {
    let (mid, _) = render("whipPan", T0);
    // Outgoing x = easeInQuart(0.5) · (-1.2·W) = -18, covering [-18, 222); incoming x = +18, covering [18, 258). So the rightmost 18px shows only the incoming frame, and the leftmost 18px shows only the outgoing frame. Both sides also carry 0.9375 opacity from the whip travel, so what is compared is hue, not equal value.
    let right = px(&mid, W - 4, H / 2);
    assert!(
        right[2] > right[0],
        "右缘应当是入场画面（偏蓝），实为 {right:?}"
    );
    let left = px(&mid, 4, H / 2);
    assert!(
        left[0] > left[2],
        "左缘应当是离场画面（偏红），实为 {left:?}"
    );
}
