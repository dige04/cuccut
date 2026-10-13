//! DrawOp golden for the sound wave: instruction-stream fingerprints for 10 styles × 5 instants (design §11).
//!
//! **Inputs are reused from `core/fixtures/visualizer/cases.json`** (frozen in P2; it may only be appended to, never modified):
//! the `sweep` spectrum, the `default` parameter group, and five instants. This file only adds the output-side `expected-draw.json`. The comparison method is the same as motion stage 0: **the serialized text is compared byte for byte**, not `Value` equality (a 1-ULP difference in f64 must fail).
//!
//! The golden adds one more column, `samples`. The sampling density of the three polyline algorithms (`oscilloscope-v1` / `spectrum-area-v1` / `ribbons-v1`) is a **frozen recipe constant** (design §7.2: this is the prerequisite for them to be rated `strict`). It enters the golden in two places (an explicit column, and implicitly by deciding the number of path segments), so changing this manifest file must necessarily fail.
//!
//! ```bash
//! cd core
//! cargo test -p ccut-render --test visualizer_draw
//! cargo test -p ccut-render --test visualizer_draw -- --ignored   # regenerate only after confirming
//! ```

use std::path::{Path, PathBuf};

use motion::preset_registry::{CatalogueRecipe, VisualizerAspect, timeline_visualizers};
use render_raster::drawop::{FrameBuilder, fingerprint};
use render_raster::source::visualizer::{VisualizerParams, VizBox, VizFrame, VizSource, VizTrack};
use render_raster::source::{VizParams, visualizer_frame};
use serde_json::{Value, json};

/// Identical, character for character, to the `instants` in `cases.json` (the five instants frozen in design §8.7).
const INSTANTS: [f64; 5] = [0.0, 0.1, 0.5, 1.0, 2.5];

/// Identical, character for character, to `params[1]` (`"default"`) in `cases.json`.
const PARAMS: VizParams = VizParams {
    min_db: -80.0,
    max_db: 40.0,
    smoothing: 0.8,
    gain: 1.0,
};

/// Two element boxes at 1080p, taken directly from the default geometry table of `ccut_timeline::geometry`: horizontal-bar types are `100% × 20%`, pinned to the bottom (y center at 85%); square types are `30% × 30%`, centered.
const CANVAS: (f64, f64) = (1920.0, 1080.0);

/// The three polyline algorithms: their `samples` directly determine the number of path segments.
const POLYLINE_ALGORITHMS: [&str; 3] = ["oscilloscope-v1", "spectrum-area-v1", "ribbons-v1"];

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/visualizer")
}

fn element_box(aspect: VisualizerAspect) -> VizBox {
    match aspect {
        VisualizerAspect::Free => VizBox {
            x: 0.0,
            y: CANVAS.1 * 0.85 - CANVAS.1 * 0.2 / 2.0,
            w: CANVAS.0,
            h: CANVAS.1 * 0.2,
        },
        VisualizerAspect::Square => VizBox {
            x: CANVAS.0 * 0.35,
            y: CANVAS.1 * 0.35,
            w: CANVAS.0 * 0.3,
            h: CANVAS.1 * 0.3,
        },
    }
}

/// Two pre-resolved colors. Deliberately not using the recipe's `defaultMainColor`: that would give every style a different color, and when the fingerprint changes you could not tell whether "the recipe changed the color" or "the geometry changed".
fn params() -> VisualizerParams {
    VisualizerParams {
        main_color: [0.235_294_12, 0.678_431_4, 1.0, 1.0],
        secondary_color: [1.0, 1.0, 1.0, 1.0],
    }
}

fn track() -> VizTrack {
    // The generator and the consumer share the same fixture bytes: `sweep-48k-mono.bcs1` is written to disk by `write_visualizer_fixtures` in `visualizer_source.rs`, and guarded byte for byte.
    let bytes = std::fs::read(fixture_dir().join("sweep-48k-mono.bcs1"))
        .expect("sweep-48k-mono.bcs1 缺失（先跑 visualizer_source 的 --ignored）");
    VizTrack::derive(&bytes, PARAMS).expect("派生 sweep 轨")
}

fn record(recipe: &CatalogueRecipe, viz: &VizFrame, time: f64) -> Value {
    let aspect = recipe.visualizer().expect("visualizer 配方").aspect;
    let mut builder = FrameBuilder::default();
    let pushed = visualizer_frame(
        &mut builder,
        recipe,
        &params(),
        viz,
        time,
        element_box(aspect),
        [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    );
    let frame = builder.finish();
    assert_eq!(pushed, frame.ops.len(), "返回条数必须等于实际压入条数");
    json!({
        "ops": frame.ops.len(),
        "paths": frame.paths.len(),
        "fingerprint": format!("{:016x}", fingerprint(&frame)),
    })
}

fn expected_json() -> Value {
    let track = track();
    let silence = track.silent_frame();
    let styles = timeline_visualizers()
        .iter()
        .map(|recipe| {
            let samples = INSTANTS
                .iter()
                .map(|instant| {
                    let viz = track.sample(*instant).expect("轨非空");
                    // The instant is both the coordinate for **fetching frames** and the element-local instant: `ribbons-v1` reads the latter.
                    let mut entry = record(recipe, viz, *instant);
                    entry["t"] = json!(instant);
                    entry
                })
                .collect::<Vec<_>>();
            let body = recipe.visualizer().unwrap();
            json!({
                "style": recipe.qualified_id(),
                "algorithm": body.recipe.algorithm.name(),
                "aspect": match body.aspect {
                    VisualizerAspect::Square => "square",
                    VisualizerAspect::Free => "free",
                },
                // Exclusive to the polyline types; bar, dot-matrix and ring types do not have this tier, so record null.
                "samples": body.recipe.integer("samples"),
                "instants": samples,
                // "Silence still has visuals": when the frequency-domain row is all zeros, every style still emits instructions (design §7.2).
                "silence": record(recipe, &silence, 0.0),
            })
        })
        .collect::<Vec<_>>();
    json!({
        "note": "DrawOp 指令流指纹（10 款全量：柱状 4 + 折线 3 + 点阵 1 + 环 1 + 丝带 1）。\
                 输入是 cases.json 的 sweep × default × 五时刻，元素盒取 ccut_timeline 几何默认表在 \
                 1920×1080 上的像素；时刻同时充当元素本地时钟，只有 ribbons 读它。\
                 samples 是折线类冻结的采样密度。",
        "canvas": [CANVAS.0, CANVAS.1],
        "spectrum": "sweep",
        "params": "default",
        "mainColor": "#3CADFF",
        "secondaryColor": "#FFFFFF",
        "styles": styles,
    })
}

fn pretty(value: &Value) -> Vec<u8> {
    let mut bytes = serde_json::to_vec_pretty(value).expect("序列化夹具");
    bytes.push(b'\n');
    bytes
}

/// Regenerate the golden. Run only after confirming:
/// `cargo test -p ccut-render --test visualizer_draw -- --ignored`
#[test]
#[ignore]
fn write_visualizer_draw_fixture() {
    std::fs::write(
        fixture_dir().join("expected-draw.json"),
        pretty(&expected_json()),
    )
    .unwrap();
}

/// Daily gate: recompute on the spot, then compare **byte for byte**.
#[test]
fn the_draw_golden_is_up_to_date() {
    let path = fixture_dir().join("expected-draw.json");
    let actual = std::fs::read(&path)
        .unwrap_or_else(|e| panic!("expected-draw.json 缺失（跑 --ignored）：{e}"));
    assert_eq!(
        actual,
        pretty(&expected_json()),
        "expected-draw.json 与生成器不一致"
    );
}

/// **All 10 styles really draw something**, both with sound and in silence. Silence is each style's "resting form" (bars keep `minHeight`, the oscilloscope keeps its centerline, the dot matrix keeps its base lights, the ring stops at its rest position, and the ribbons collapse to the centerline), so the element does not disappear from the canvas at the intro or in silent sections.
#[test]
fn every_style_is_live_in_the_golden() {
    let golden = expected_json();
    assert_eq!(golden["styles"].as_array().unwrap().len(), 10);
    for style in golden["styles"].as_array().unwrap() {
        let id = style["style"].as_str().unwrap();
        for sample in style["instants"].as_array().unwrap() {
            let ops = sample["ops"].as_u64().unwrap();
            assert!(ops > 0, "{id} @ t={} 必须画出东西", sample["t"]);
        }
        assert!(
            style["silence"]["ops"].as_u64().unwrap() > 0,
            "{id} 静音时也必须画出东西"
        );
    }
}

/// **`samples` guard**: the sampling density of the three polyline algorithms is a frozen constant, and changing it necessarily changes the golden.
///
/// Three things are pinned together: ① all four manifests declare it; ② the column in the golden is character-for-character identical to the registry (changing the manifest without regenerating ⇒ `the_draw_golden_is_up_to_date` fails); ③ the number of path segments in the instruction stream is indeed determined by it, so it is also **implicitly** part of the golden fingerprint. Both routes are closed.
///
/// Segment-count formula by algorithm:
/// - `oscilloscope-v1` linear layout: `samples` (one move + n−1 lines); polar layout `samples + 1` (one extra close);
/// - `spectrum-area-v1`: area path `samples + 3` (polyline + bottom-right + bottom-left + close), stroke path `samples`;
/// - `ribbons-v1`: `samples` per ribbon.
#[test]
fn the_polyline_density_is_frozen_by_the_manifest() {
    let track = track();
    let mut seen = 0;
    for style in expected_json()["styles"].as_array().unwrap() {
        let id = style["style"].as_str().unwrap();
        let algorithm = style["algorithm"].as_str().unwrap();
        if !POLYLINE_ALGORITHMS.contains(&algorithm) {
            assert!(style["samples"].is_null(), "{id} 不该有采样密度");
            continue;
        }
        seen += 1;
        let bare = id.strip_prefix("visualizer.").unwrap();
        let recipe = motion::preset_registry::timeline_visualizer(bare).unwrap();
        let body = recipe.visualizer().unwrap();
        let declared = body.recipe.integer("samples").expect("折线类必填 samples") as usize;
        assert_eq!(style["samples"].as_u64().unwrap() as usize, declared);
        let mut builder = FrameBuilder::default();
        visualizer_frame(
            &mut builder,
            recipe,
            &params(),
            track.sample(INSTANTS[2]).unwrap(),
            INSTANTS[2],
            element_box(body.aspect),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        );
        let frame = builder.finish();
        assert!(!frame.paths.is_empty(), "{id}");
        let allowed: &[usize] = match algorithm {
            "oscilloscope-v1" => match body.recipe.text("layout") {
                Some("polar") => &[declared + 1],
                _ => &[declared],
            },
            "spectrum-area-v1" => &[declared + 3, declared],
            _ => &[declared],
        };
        for path in &frame.paths {
            assert!(
                allowed.contains(&path.0.len()),
                "{id} 的 path 段数 {} 不在 {allowed:?} 里",
                path.0.len()
            );
        }
    }
    assert_eq!(
        seen, 4,
        "折线类恰好四款：oscilloscope、ring_wave、spectrum_area、ribbons"
    );
}

/// **Out-of-order sampling == in-order sampling** also holds at the drawing layer: the source is a pure table lookup and drawing is a pure function, so the instruction stream at the same instant is independent of access order (the executable form of ADR-E04).
#[test]
fn shuffled_drawing_equals_sorted_drawing() {
    let track = track();
    let recipe = motion::preset_registry::timeline_visualizer("bars").unwrap();
    let sorted: Vec<u64> = INSTANTS
        .iter()
        .map(|instant| {
            let mut builder = FrameBuilder::default();
            visualizer_frame(
                &mut builder,
                recipe,
                &params(),
                track.sample(*instant).unwrap(),
                *instant,
                element_box(VisualizerAspect::Free),
                [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            );
            fingerprint(&builder.finish())
        })
        .collect();
    // Fixed permutation (not random): the order changes, and the result must stay the same, for this to mean anything.
    let order = [3usize, 0, 4, 1, 2];
    let mut shuffled = vec![0u64; INSTANTS.len()];
    for index in order {
        let mut builder = FrameBuilder::default();
        visualizer_frame(
            &mut builder,
            recipe,
            &params(),
            track.sample(INSTANTS[index]).unwrap(),
            INSTANTS[index],
            element_box(VisualizerAspect::Free),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        );
        shuffled[index] = fingerprint(&builder.finish());
    }
    assert_eq!(sorted, shuffled);
}
