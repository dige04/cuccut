//! DrawOp golden for confetti: 10 styles × 6 moments (design doc §4.5 / §9).
//!
//! Confetti has **no asset source**. Its input is only `(recipe, override parameters, element-local time, element box)`, so the fixture carries its own `cases.json` (at the same level as `core/fixtures/progress/cases.json`, and not referencing it). The comparison method is likewise **byte-for-byte comparison of serialized text**.
//!
//! ```bash
//! cd core
//! cargo test -p ccut-render --test confetti_draw
//! cargo test -p ccut-render --test confetti_draw -- --ignored   # regenerate once the output has been checked
//! ```

use std::path::{Path, PathBuf};

use motion::preset_registry::{CatalogueRecipe, timeline_confettis};
use render_raster::drawop::{FrameBuilder, fingerprint};
use render_raster::source::{
    ConfettiBox, ConfettiParams, ConfettiShape, confetti_frame, confetti_particles,
};
use serde_json::{Value, json};

/// Element-local time in seconds. `0.0` is “the first wave has just been born” (for continuous, at t=0 only particle 0 can be alive; for burst, the whole wave is born at once). [`TILE_FRAME`] is the still frame of the catalog tile. `12.0` exceeds every recipe's `lifeSec`, testing the Nth round of continuous emission / repeated bursts, and styles with `interval: 0` (burst once) must be an empty frame here.
const TIMES: [f64; 6] = [0.0, 0.4, 1.2, 2.5, TILE_FRAME, 12.0];
/// Still-frame time of the catalog tile (seconds). It is the same number as `CONFETTI_THUMB_TIME` in `apps/cuccut` and as `TILE_T` in the prototype `panel-elements-tile.jsx`.
///
/// In round 234 it was raised from 1.2 to 4.5. At 1.2 s the continuous styles had only fired a beat or two (`hearts-petals` had only 19 pieces, all crowded into the top tenth), so the tile looked like a few specks of dust. 4.5 s is the moment where “even the weakest of the ten is at its best”: the four burst intervals (1.6 / 1.8 / 2.0 / 2.4 s) have all already burst and spread out by then, and the continuous styles have reached steady state.
const TILE_FRAME: f64 = 4.5;
const CANVAS: (f64, f64) = (1920.0, 1080.0);
const PIXEL_SCALE: f64 = 2.0;
const SEED: u64 = 20_260_909;
/// The minimum number of live particles each style must have on the tile still frame.
const TILE_MIN_ALIVE: u64 = 24;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/confetti")
}

fn element_box() -> ConfettiBox {
    ConfettiBox {
        x: 0.0,
        y: 0.0,
        w: CANVAS.0,
        h: CANVAS.1,
    }
}

fn hex(color: &str) -> [f32; 4] {
    let v = u32::from_str_radix(color.trim_start_matches('#'), 16).unwrap();
    let (r, g, b, a) = if color.len() == 9 {
        (
            (v >> 24) & 0xff,
            (v >> 16) & 0xff,
            (v >> 8) & 0xff,
            v & 0xff,
        )
    } else {
        ((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, 0xff)
    };
    [
        r as f32 / 255.0,
        g as f32 / 255.0,
        b as f32 / 255.0,
        a as f32 / 255.0,
    ]
}

/// Recipe defaults with a fixed seed: `colors` / `shapes` use the recipe's own values, and all multipliers are 1.
fn params(recipe: &CatalogueRecipe) -> ConfettiParams {
    let body = recipe.confetti().expect("confetti recipe");
    ConfettiParams {
        seed: SEED,
        colors: body.palette.iter().map(|c| hex(c)).collect(),
        shapes: body
            .shapes
            .iter()
            .map(|s| ConfettiShape::parse(s).expect("recipe shape was validated when the registry was parsed"))
            .collect(),
        pixel_scale: PIXEL_SCALE,
        ..ConfettiParams::default()
    }
}

fn record(recipe: &CatalogueRecipe, time: f64) -> Value {
    let mut builder = FrameBuilder::default();
    let pushed = confetti_frame(
        &mut builder,
        recipe,
        &params(recipe),
        time,
        None,
        element_box(),
        [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    );
    let frame = builder.finish();
    assert_eq!(pushed, frame.ops.len(), "returned count must equal the number of ops actually pushed");
    json!({
        "t": time,
        "ops": frame.ops.len(),
        "paths": frame.paths.len(),
        "fingerprint": format!("{:016x}", fingerprint(&frame)),
    })
}

fn cases_json() -> Value {
    json!({
        "note": "confetti 夹具的**输入**。GPU 对拍与 wasm 复用同一份，各自追加 \
                 expected-*.json。追加新输入请往末尾加，既有编号不动。times 是元素\
                 本地时刻（秒）；颜色与形状取配方缺省，倍率全 1，种子固定。",
        "canvas": [CANVAS.0, CANVAS.1],
        "times": TIMES.to_vec(),
        "pixelScale": PIXEL_SCALE,
        "seed": SEED,
        "box": "画幅 100% × 100%",
        "styles": timeline_confettis()
            .iter()
            .map(CatalogueRecipe::qualified_id)
            .collect::<Vec<_>>(),
    })
}

fn expected_json() -> Value {
    let styles = timeline_confettis()
        .iter()
        .map(|recipe| {
            let body = recipe.confetti().unwrap();
            json!({
                "style": recipe.qualified_id(),
                "algorithm": body.recipe.algorithm.name(),
                "samples": TIMES
                    .iter()
                    .map(|time| record(recipe, *time))
                    .collect::<Vec<_>>(),
            })
        })
        .collect::<Vec<_>>();
    json!({
        "note": "DrawOp 指令流指纹：每帧 = ClipPath + FillPath × N + PopClip，空帧 0 条。",
        "styles": styles,
    })
}

fn pretty(value: &Value) -> Vec<u8> {
    let mut out = serde_json::to_vec_pretty(value).unwrap();
    out.push(b'\n');
    out
}

/// Regenerate the fixtures. Run only after confirming the output:
/// `cargo test -p ccut-render --test confetti_draw -- --ignored`
#[test]
#[ignore]
fn write_confetti_draw_fixture() {
    let dir = fixture_dir();
    std::fs::create_dir_all(&dir).expect("create fixture directory");
    std::fs::write(dir.join("cases.json"), pretty(&cases_json())).unwrap();
    std::fs::write(dir.join("expected-draw.json"), pretty(&expected_json())).unwrap();
}

/// Everyday gate: recompute on the spot, then compare **byte for byte**.
#[test]
fn the_confetti_fixtures_are_up_to_date() {
    let dir = fixture_dir();
    for (name, expected) in [
        ("cases.json", pretty(&cases_json())),
        ("expected-draw.json", pretty(&expected_json())),
    ] {
        let actual = std::fs::read(dir.join(name))
            .unwrap_or_else(|e| panic!("{name} is missing (run with --ignored): {e}"));
        assert_eq!(actual, expected, "{name} does not match the generator");
    }
}

/// **All 10 styles are fully painted on the tile still frame**: on [`TILE_FRAME`], every style has at least [`TILE_MIN_ALIVE`]
/// particles, and the instruction stream always has the shape `ClipPath … PopClip`, with paths deduplicated by shape (path count ≤ shape count + 1).
///
/// The floor is not “> 0”: the tile is the user's only basis for recognizing a style, and a frame with one or two particles is technically “alive” but tells the user nothing. Before round 234 this check was stuck at `ops >= 3`, and `hearts-petals` at the old 1.2 s had only 19 particles, all crowded into the top tenth, yet the gate still passed.
#[test]
fn every_style_is_live_at_the_tile_frame() {
    let styles = timeline_confettis();
    assert_eq!(styles.len(), 10);
    for recipe in styles {
        let entry = record(recipe, TILE_FRAME);
        let ops = entry["ops"].as_u64().unwrap();
        assert!(
            ops >= TILE_MIN_ALIVE + 2,
            "{} @ t={TILE_FRAME} has only {} particles, too few to recognize the style on the tile",
            recipe.qualified_id(),
            ops.saturating_sub(2),
        );
        let shapes = recipe.confetti().unwrap().shapes.len() as u64;
        assert!(
            entry["paths"].as_u64().unwrap() <= shapes + 1,
            "{} paths are not deduplicated by shape",
            recipe.qualified_id()
        );
        let body = recipe.confetti().unwrap();
        let max_alive = body.recipe.integer("maxAlive").unwrap();
        assert!(
            ops - 2 <= max_alive,
            "{} exceeds maxAlive",
            recipe.qualified_id()
        );
    }
}

/// Negative times and empty frames: at `t < 0`, no ops are pushed at all; burst styles with `interval: 0` are empty frames after their lifetime.
#[test]
fn negative_time_and_finished_bursts_push_nothing() {
    for recipe in timeline_confettis() {
        let mut builder = FrameBuilder::default();
        let pushed = confetti_frame(
            &mut builder,
            recipe,
            &params(recipe),
            -0.5,
            None,
            element_box(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        );
        assert_eq!(pushed, 0, "{} must not draw at t<0", recipe.qualified_id());
        assert!(builder.finish().ops.is_empty());
    }
    // Single burst: after the user overrides interval = 0, t = 12 s must be an empty frame.
    let recipe = timeline_confettis()
        .iter()
        .find(|r| r.qualified_id().ends_with("golden-starburst"))
        .unwrap();
    let mut p = params(recipe);
    p.emit.interval = Some(0.0);
    let mut builder = FrameBuilder::default();
    let pushed = confetti_frame(
        &mut builder,
        recipe,
        &p,
        12.0,
        None,
        element_box(),
        [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    );
    assert_eq!(pushed, 0);
}

/// Shuffled sampling == sequential sampling (the precondition for parallel export and for dragging the playhead): at the same moment, regardless of what was sampled before, you get the same fingerprint; changing the seed must change the fingerprint.
#[test]
fn sampling_is_order_independent_and_seeded() {
    for recipe in timeline_confettis() {
        let forward: Vec<Value> = TIMES.iter().map(|t| record(recipe, *t)).collect();
        let backward: Vec<Value> = TIMES.iter().rev().map(|t| record(recipe, *t)).collect();
        for (a, b) in forward.iter().zip(backward.iter().rev()) {
            assert_eq!(a, b, "{} drifts under out-of-order sampling", recipe.qualified_id());
        }
        let mut other = params(recipe);
        other.seed = SEED + 1;
        let mut builder = FrameBuilder::default();
        confetti_frame(
            &mut builder,
            recipe,
            &other,
            1.2,
            None,
            element_box(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        );
        let reseeded = format!("{:016x}", fingerprint(&builder.finish()));
        assert_ne!(
            reseeded,
            forward[2]["fingerprint"].as_str().unwrap(),
            "{} must change the picture when the seed changes",
            recipe.qualified_id()
        );
    }
}

/// `settle`: given the element duration, the last `lifeSec` seconds emit nothing, so the end of the clip naturally clears.
#[test]
fn settle_empties_the_frame_before_the_element_ends() {
    let recipe = timeline_confettis()
        .iter()
        .find(|r| r.qualified_id().ends_with("rainbow-paper"))
        .unwrap();
    let mut p = params(recipe);
    p.emit.settle = true;
    let duration = 6.0;
    let life = recipe.confetti().unwrap().recipe.number("lifeSec").unwrap();
    let mut builder = FrameBuilder::default();
    let at_end = confetti_frame(
        &mut builder,
        recipe,
        &p,
        duration,
        Some(duration),
        element_box(),
        [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    );
    assert_eq!(at_end, 0, "the end of the clip must be cleared");
    let mut builder = FrameBuilder::default();
    let mid = confetti_frame(
        &mut builder,
        recipe,
        &p,
        duration - life - 0.5,
        Some(duration),
        element_box(),
        [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    );
    assert!(mid > 0, "emission before settle proceeds as usual");
}

// ---------------------------------------------------------------------------
// Covering the full frame (round 234)
// ---------------------------------------------------------------------------

/// **Drag must not pin particles inside the frame**.
///
/// The closed-form kernel `axis(p0, v0, a, k, τ)` has a hard asymptote `v0 / k` for displacement when `a == 0 && k > 0`, so no lifetime, however long, can get past it. `hearts-petals` once had `gravityPx: 0` with `dragY: 0.4`. Its vertical asymptote was only `136 / 0.4 = 340` reference px. It falls from the top edge (`spreadY: 0`), so the whole frame height has to be covered by flight, and the frame would stop at 51% forever, leaving the lower half empty (the user's report: “only fills half”).
///
/// The gate checks, per axis, **how much the emitter already spreads**. When on some axis the emission band already covers the full element box (`spread == 100`, e.g. the horizontal of a top-edge style), coverage does not depend on flight, and drag can be set freely. When the emission band is narrow on that axis, the remaining `(100 − spread)%` must be made up by displacement, and without acceleration (gravity / wind) the displacement is capped at `speed / drag`.
#[test]
fn drag_never_pins_particles_to_a_frontier_inside_the_frame() {
    const REF_SHORT: f64 = render_raster::source::confetti::kernel::REF_SHORT;
    for recipe in timeline_confettis() {
        let body = recipe.confetti().unwrap();
        let p = &body.recipe;
        let speed = p.array("speedPx").map_or(0.0, |a| {
            a.iter().filter_map(Value::as_f64).fold(0.0, f64::max)
        });
        let emitters = p.array("emitters").expect("recipe must have emitters");
        let widest = |key: &str| {
            emitters
                .iter()
                .filter_map(|e| e.get(key).and_then(Value::as_f64))
                .fold(0.0, f64::max)
        };
        for (axis, drag, accel, spread) in [
            (
                "dragX",
                p.number("dragX"),
                p.number("windPx"),
                widest("spreadX"),
            ),
            (
                "dragY",
                p.number("dragY"),
                p.number("gravityPx"),
                widest("spreadY"),
            ),
        ] {
            let drag = drag.unwrap_or(0.0);
            if drag <= 0.0 || accel.unwrap_or(0.0) != 0.0 {
                continue;
            }
            // The share that flight must still cover on this axis, converted to pixels on the reference short edge (a conservative lower bound: the long-edge direction demands more, but measuring against the short edge already catches blank space across the whole frame).
            let gap = (100.0 - spread).max(0.0) / 100.0 * REF_SHORT;
            assert!(
                speed / drag >= gap,
                "{} has {axis}={drag}, which pins displacement at {:.0} reference px, \
                 while the emission band covers only {spread:.0}% of this axis, leaving {gap:.0} px to be covered by flight; \
                 the frame would keep a front that never moves",
                recipe.qualified_id(),
                speed / drag,
            );
        }
    }
}

/// **Styles that emit from the top edge or from a full-frame band must reach the bottom edge**.
///
/// The previous check is a necessary condition at the recipe level; this one is a measurement at the frame level. For the styles whose emitter covers the upper half of the frame (scattering from the top edge) or the whole frame (a full-screen band), sample at steady state (`t = 6 s`, past every recipe's `lifeSec`); both the top tenth and the bottom tenth of the frame must contain particles. For styles such as bottom confetti cannons and low-altitude bursts, the top is supposed to be empty (that is their shape, not a defect), and they are automatically exempted based on their emitter band.
#[test]
fn styles_seeded_across_the_frame_reach_both_edges() {
    let mut checked = 0;
    for recipe in timeline_confettis() {
        let body = recipe.confetti().unwrap();
        let emitters = body.recipe.array("emitters").expect("recipe must have emitters");
        // Top and bottom edges of the emitter band (percent of the element box).
        let (mut top, mut bottom) = (f64::MAX, f64::MIN);
        for e in emitters {
            let y = e.get("y").and_then(Value::as_f64).unwrap_or(50.0);
            let h = e.get("spreadY").and_then(Value::as_f64).unwrap_or(0.0);
            top = top.min(y - h / 2.0);
            bottom = bottom.max(y + h / 2.0);
        }
        // Only checks styles that “start in the upper half of the frame”: top-edge scatter (band's top edge at 20% or more) or a full-frame band.
        if top > 20.0 {
            continue;
        }
        checked += 1;
        let particles = confetti_particles(recipe, &params(recipe), 6.0, None, CANVAS);
        let band = CANVAS.1 / 10.0;
        let hits = |lo: f64, hi: f64| particles.iter().filter(|q| q.y >= lo && q.y < hi).count();
        assert!(
            hits(0.0, band) > 0,
            "{} has an empty top tenth of the frame at steady state (emission band {top:.0}%–{bottom:.0}%)",
            recipe.qualified_id(),
        );
        assert!(
            hits(CANVAS.1 - band, CANVAS.1) > 0,
            "{} has an empty bottom tenth of the frame at steady state (emission band {top:.0}%–{bottom:.0}%),\
             this is the “only fills half” problem",
            recipe.qualified_id(),
        );
    }
    assert!(checked >= 5, "at least 5 styles should start in the upper half, found {checked}");
}
