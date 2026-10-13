//! progress DrawOp golden: 14 styles × 5 (progress, time) samples (design §11).
//!
//! progress has **no media source**; its input is only `(progress, element box, two colors)`, so the fixture ships its own `cases.json` (a peer of `core/fixtures/visualizer/cases.json`, not referenced by it).
//! The comparison is again **byte-for-byte comparison of serialized text**.
//!
//! ```bash
//! cd core
//! cargo test -p ccut-render --test progress_draw
//! cargo test -p ccut-render --test progress_draw -- --ignored   # regenerate only after confirming
//! ```

use std::path::{Path, PathBuf};

use motion::preset_registry::{CatalogueRecipe, ProgressAspect, timeline_progresses};
use render_raster::drawop::{FrameBuilder, fingerprint};
use render_raster::source::progress::ProgressBox;
use render_raster::source::{ProgressParams, progress_frame};
use serde_json::{Value, json};

/// Endpoints must be exact (`progress(t)` is monotonic on `[start, end]` and hits exactly 0/1, §11).
const STEPS: [f64; 5] = [0.0, 0.25, 0.5, 0.75, 1.0];

/// **Element-local times** (seconds, added in P4), paired one-to-one with `STEPS`.
///
/// The six from P3 are time-independent, so adding this column does not change their fingerprints; the rotation phase of `snake_spin` reads it.
/// Deliberately uses five neat instants on a 3-second element (a `0.75 s` step gives 37.5° per step at 50°/s), rather than `progress × 7.2 s`. With that, "one full turn" would exactly cancel out the self-rotation, and the test would prove nothing.
const TIMES: [f64; 5] = [0.0, 0.75, 1.5, 2.25, 3.0];

const CANVAS: (f64, f64) = (1920.0, 1080.0);

/// Scale factor from the 540 reference short edge to 1080p (`short_edge / REFERENCE_SHORT_EDGE`).
/// The source of truth is `ccut_timeline::REFERENCE_SHORT_EDGE`. The `ccut-render` crate does not depend on that crate, so the fixture writes the factor as an explicit constant and names its origin in a comment.
const PIXEL_SCALE: f64 = 2.0;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/progress")
}

/// Three element boxes taken directly from the default geometry table of `ccut_timeline::geometry`: `bar` = 80% × 5%, `square` = 30% × 30%, `frame` = 100% × 100%, all centered.
fn element_box(aspect: ProgressAspect) -> ProgressBox {
    let (width, height) = match aspect {
        ProgressAspect::Bar => (0.8, 0.05),
        ProgressAspect::Square => (0.3, 0.3),
        ProgressAspect::Frame => (1.0, 1.0),
    };
    let (w, h) = (CANVAS.0 * width, CANVAS.1 * height);
    ProgressBox {
        x: (CANVAS.0 - w) / 2.0,
        y: (CANVAS.1 - h) / 2.0,
        w,
        h,
    }
}

fn params() -> ProgressParams {
    ProgressParams {
        main_color: [0.235_294_12, 0.678_431_4, 1.0, 1.0],
        secondary_color: [0.768_627_5, 0.901_960_8, 1.0, 1.0],
        pixel_scale: PIXEL_SCALE,
    }
}

fn record(recipe: &CatalogueRecipe, progress: f64, time: f64) -> Value {
    let aspect = recipe.progress().expect("progress recipe").aspect;
    let mut builder = FrameBuilder::default();
    let pushed = progress_frame(
        &mut builder,
        recipe,
        &params(),
        progress,
        time,
        element_box(aspect),
        [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    );
    let frame = builder.finish();
    assert_eq!(pushed, frame.ops.len(), "the return count must equal the number of ops actually pushed");
    json!({
        "progress": progress,
        "t": time,
        "ops": frame.ops.len(),
        "paths": frame.paths.len(),
        "fingerprint": format!("{:016x}", fingerprint(&frame)),
    })
}

fn cases_json() -> Value {
    json!({
        "note": "progress 夹具的**输入**。P5 的 GPU 对拍与 P6 的 wasm 复用同一份，\
                 各自追加 expected-*.json。追加新输入请往末尾加，既有编号不动。\
                 times 与 progress 一一配对，是元素本地时刻（秒）：P4 追加，\
                 只有 snake_spin 读它，P3 六种的指纹不受影响。",
        "canvas": [CANVAS.0, CANVAS.1],
        "progress": STEPS.to_vec(),
        "times": TIMES.to_vec(),
        "pixelScale": PIXEL_SCALE,
        "mainColor": "#3CADFF",
        "secondaryColor": "#C4E6FF",
        "boxes": {
            "bar": "画幅 80% × 5%，居中",
            "square": "画幅 30% × 30%，居中",
            "frame": "画幅 100% × 100%",
        },
        "styles": timeline_progresses()
            .iter()
            .map(CatalogueRecipe::qualified_id)
            .collect::<Vec<_>>(),
    })
}

fn expected_json() -> Value {
    let styles = timeline_progresses()
        .iter()
        .map(|recipe| {
            json!({
                "style": recipe.qualified_id(),
                "algorithm": recipe.progress().unwrap().recipe.algorithm.name(),
                "aspect": match recipe.progress().unwrap().aspect {
                    ProgressAspect::Bar => "bar",
                    ProgressAspect::Square => "square",
                    ProgressAspect::Frame => "frame",
                },
                "samples": STEPS
                    .iter()
                    .zip(TIMES.iter())
                    .map(|(step, time)| record(recipe, *step, *time))
                    .collect::<Vec<_>>(),
            })
        })
        .collect::<Vec<_>>();
    json!({
        "note": "DrawOp 指令流指纹（P3 六种 + P4 的 snake 两种）。P5 的 rainbow / strobe \
                 四种填实后，对应样式的 ops 会从 0 变成真实条数。",
        "styles": styles,
    })
}

fn pretty(value: &Value) -> Vec<u8> {
    let mut bytes = serde_json::to_vec_pretty(value).expect("serialize fixture");
    bytes.push(b'\n');
    bytes
}

/// Regenerate the fixture. Only after confirming:
/// `cargo test -p ccut-render --test progress_draw -- --ignored`
#[test]
#[ignore]
fn write_progress_draw_fixture() {
    let dir = fixture_dir();
    std::fs::create_dir_all(&dir).expect("create fixture directory");
    std::fs::write(dir.join("cases.json"), pretty(&cases_json())).unwrap();
    std::fs::write(dir.join("expected-draw.json"), pretty(&expected_json())).unwrap();
}

/// Daily gate: recompute on the spot and compare **byte for byte**.
#[test]
fn the_progress_fixtures_are_up_to_date() {
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

/// **All 14 styles produce visible output** (since P5b there are no empty arms).
///
/// The half-progress point is the only sample where all 14 styles are non-degenerate. At the endpoints the progress box of `reverse_*` disappears entirely, and the two `background: false` strobe styles then genuinely emit 0 instructions at that end.
#[test]
fn every_style_is_live_in_the_golden() {
    let styles = expected_json();
    let styles = styles["styles"].as_array().unwrap();
    assert_eq!(styles.len(), 14);
    for style in styles {
        let id = style["style"].as_str().unwrap();
        let samples = style["samples"].as_array().unwrap();
        assert!(
            samples[2]["ops"].as_u64().unwrap() > 0,
            "{id} @ progress=0.5 must draw something"
        );
    }
}

/// Progress is monotonic: for the same style, the instruction streams of two adjacent steps must differ (except at degenerate endpoints).
/// This catches the silent failure where the progress value is never wired through.
#[test]
fn every_step_changes_the_instruction_stream() {
    for recipe in timeline_progresses() {
        let mut seen: Vec<String> = Vec::new();
        for (step, time) in STEPS.iter().zip(TIMES.iter()) {
            let entry = record(recipe, *step, *time);
            if entry["ops"].as_u64().unwrap() == 0 {
                continue;
            }
            let print = entry["fingerprint"].as_str().unwrap().to_owned();
            assert!(
                !seen.contains(&print),
                "{} at progress={step} is byte-identical to an earlier step",
                recipe.qualified_id()
            );
            seen.push(print);
        }
    }
}
