//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer`
//! (the BCF document rendering path and the host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Micro-benchmark for FramePlan orchestration overhead (design §12: a project without effects must not regress performance because of the Render Graph).
//! Defaults to `#[ignore]`, because it measures wall-clock time and would produce false failures in CI under machine load.
//!
//! ```bash
//! cd core && cargo test -p ccut-render --release --test plan_overhead -- --ignored --nocapture
//! ```
//!
//! **Let the machine go idle before running it**: the threshold is calibrated on an idle system. Measured under a parallel `cargo build` (load ≈ 8), the ratio drifts between 0.80 and 1.26; that is scheduling noise, not a regression.

use anyhow::anyhow;
use render_raster::plan::{CpuExecutor, FramePlanner, execute_plan};
use render_raster::{FrameMedia, FrameRenderer, TextEngine};
use scene_primitives::HostInputs;
use scene_primitives::resolve::{Ir, Resolver};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tiny_skia::{Pixmap, PremultipliedColorU8};

fn media_demo_ir() -> Ir {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/media-demo.ccut.json"
    );
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let mut inputs = HostInputs::default();
    inputs.insert_image("card", 640.0, 360.0);
    inputs.insert_image("logo", 128.0, 128.0);
    inputs.insert_video("clip", 1280.0, 720.0, 12.0, 24.0);
    inputs.insert_audio("tone", 30.0);
    let mut resolver = Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(inputs);
    resolver.resolve().unwrap()
}

/// Deterministic bitmap media source generated in code, used for the three visual assets of `media-demo`.
///
/// Why not `MediaStore`: its video channel needs `ffmpeg` and a real mp4, and a micro-benchmar should not depend on an external process. Filling only `LoadedAssets::images` would still make `clip` (120 of its 210 frames, the 4 seconds) return Err early at `DrawMedia`. `FrameMedia` is a public trait, and the two compared paths get the **same instance**, so the cost of media supply cancels out in the numerator and denominator and the comparison stays fair.
struct DemoMedia {
    frames: HashMap<&'static str, Arc<Pixmap>>,
    /// How many times the image was actually fetched. Used to pin down that this run really rasterizes media.
    hits: usize,
}

impl DemoMedia {
    /// The size is taken from the intrinsic size declared by `media_demo_ir()`, so the resampling workload when scaling to the 960×540 canvas matches real footage.
    fn new() -> Self {
        DemoMedia {
            frames: HashMap::from([
                ("card", gradient(640, 360, 0)),
                ("logo", gradient(128, 128, 1)),
                ("clip", gradient(1280, 720, 2)),
            ]),
            hits: 0,
        }
    }
}

impl FrameMedia for DemoMedia {
    fn frame(&mut self, id: &str, _media_ms: i64) -> anyhow::Result<Arc<Pixmap>> {
        self.hits += 1;
        self.frames
            .get(id)
            .cloned()
            .ok_or_else(|| anyhow!("测试媒体源没有资源 \"{id}\""))
    }
}

/// Pure-function gradient bitmap: depends only on `(width, height, seed)`, with no randomness, no time and no I/O. This satisfies BCF's determinism requirement; every iteration within one build sees byte-identical pixels.
///
/// All opaque (alpha=255), so premultiplied and straight values are the same and construction itself introduces no extra color semantics.
fn gradient(width: u32, height: u32, seed: u32) -> Arc<Pixmap> {
    let mut pixmap = Pixmap::new(width, height).expect("尺寸非零");
    for (index, pixel) in pixmap.pixels_mut().iter_mut().enumerate() {
        let x = index as u32 % width;
        let y = index as u32 / width;
        let r = (x * 255 / width) as u8;
        let g = (y * 255 / height) as u8;
        let b = (seed.wrapping_mul(83) as u8) ^ ((x ^ y) as u8);
        *pixel = PremultipliedColorU8::from_rgba(r, g, b, 255).expect("alpha=255 恒合法");
    }
    Arc::new(pixmap)
}

/// The wall-clock time of `plan(t) + execute_plan` must not noticeably exceed that of `record(t) + rasterize`.
///
/// Both sides do exactly the same work (the same [`DemoMedia`], the same instruction stream); the only difference is the segment of "building the plan + fold check + surface fingerprint". The guard measures two ratios:
///
/// 1. **Orchestration segment** (`plan + frame_fingerprint` vs `record + drawop::fingerprint`, neither executes). All of the sensitivity lives on this one: orchestration itself is only a few percent of a whole frame, and if it is compared after mixing in rasterization it is diluted until it cannot be measured.
/// 2. **End-to-end** (each adds execution/rasterization on top). This guarantees something else: the plan path does not do extra pixel work. The denominator includes full-image resampling, so it is naturally insensitive to regressions in the orchestration segment. Both are needed, because without either one the guard has a blind spot.
///
/// **Coverage**: the comparison is of the general API pair (`rasterize_with_media` vs `execute_plan`). The template-export production path (`video.rs`) has, since 56232949, switched to `frame_fingerprints` + `execute_plan_with_fingerprints`, which is **cheaper** (one fewer fingerprint encoding, one fewer `validate`), so what is measured here is an upper bound on the production path's overhead. `media-demo` has no effects, so the plan is in folded form and the two execution entry points share the same code path on the folded branch; the only difference is the extra `plan.validate()` that `execute_plan` runs. Reuse of the fingerprint table for non-folded plans is outside this guard's coverage.
///
/// **Threshold calibration** (Apple Silicon M-series, `--release`, idle, alternating order and taking the minimum, measured range over 9 consecutive process runs):
///
/// - Orchestration segment per frame ≈ 0.017 ms, ratio **1.016–1.025**. This 2% is **systematic**, not noise: the plan path builds a `FramePlan` with more work (surfaces and passes as two Vecs), runs `is_folded` and `validate` once more, and its fingerprints pass through one more `BTreeMap` layer. A threshold of 1.05 leaves more than double the margin above the systematic baseline to absorb CI noise. Sensitivity measured: injecting one extra `frame_fingerprint()` into the plan leg (i.e. "encode the instruction stream once more per frame") gives a ratio of **1.327**, far above the threshold.
/// - End-to-end per frame ≈ 3.6 ms (media genuinely takes part in resampling; previously, with an empty `MediaStore` returning early, it was only 0.017 ms and neither side actually rasterized), ratio **0.997–1.005**, so threshold 1.03. In the same injection experiment this leg only moved to 1.005. It cannot detect a regression in the orchestration segment, which is exactly why the leg above must be kept.
#[test]
#[ignore = "墙钟微基准；手动跑 --release"]
fn folded_plan_orchestration_and_execution_stay_within_budget() {
    let mut ir = media_demo_ir();
    let mut engine = TextEngine::new();
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    let planner = FramePlanner::cpu(&ir).unwrap();
    let mut executor = CpuExecutor::new(planner.capabilities().clone());
    let mut media = DemoMedia::new();

    let total_frames = (ir.total * ir.fps).round() as usize;
    let times: Vec<f64> = (0..total_frames).map(|f| f as f64 / ir.fps).collect();

    // Warm-up (glyph/layout cache) **and** correctness precondition: both paths must finish rasterizing and draw the same frame.
    // The old form with an empty MediaStore failed exactly here: both sides returned `Err` at the first `DrawMedia`, so the guard only compared the cost of recording the instruction stream, and a regression in the execution phase would still pass.
    for t in &times {
        let ops = renderer.record(&ir, &mut engine, *t);
        let direct =
            render_raster::rasterize_with_media(&ops, renderer.width, renderer.height, &mut media)
                .expect("baseline 路径必须完成光栅化");
        let plan = planner.plan(&renderer, &ir, &mut engine, *t);
        let planned =
            execute_plan(&plan, &mut executor, &mut media, None).expect("计划路径必须完成光栅化");
        assert_eq!(
            direct.data(),
            planned.data(),
            "t={t:.4}s：折叠计划与直接光栅化必须逐字节相同"
        );
    }
    assert!(
        media.hits > 0,
        "整片一次 DrawMedia 都没有 ⇒ 分母里没有媒体光栅化，守卫是空转的"
    );

    // The two legs **alternate order** within each round: frequency and thermal drift of the machine is monotonic within one measurement, so a leg that always runs second would be systematically penalized (measured to push the end-to-end ratio up to 1.11).
    //
    // An orchestration segment round takes only a few milliseconds, so the rounds are raised to 24 for the min to converge (total cost under 0.2 s). An end-to-end round takes 0.8 s (full-image resampling), so 6 rounds is enough.
    let mut record_only = f64::INFINITY;
    let mut plan_only = f64::INFINITY;
    for round in 0..24 {
        for leg in 0..2 {
            let is_record = (leg == 0) == (round % 2 == 0);
            let start = Instant::now();
            if is_record {
                for t in &times {
                    let ops = renderer.record(&ir, &mut engine, *t);
                    std::hint::black_box(render_raster::drawop::fingerprint(&ops));
                }
            } else {
                for t in &times {
                    let plan = planner.plan(&renderer, &ir, &mut engine, *t);
                    std::hint::black_box(plan.frame_fingerprint().unwrap());
                }
            }
            let elapsed = start.elapsed().as_secs_f64();
            if is_record {
                record_only = record_only.min(elapsed);
            } else {
                plan_only = plan_only.min(elapsed);
            }
        }
    }

    let mut record_full = f64::INFINITY;
    let mut plan_full = f64::INFINITY;
    for round in 0..6 {
        for leg in 0..2 {
            let is_record = (leg == 0) == (round % 2 == 0);
            let start = Instant::now();
            if is_record {
                for t in &times {
                    let ops = renderer.record(&ir, &mut engine, *t);
                    let fingerprint = render_raster::drawop::fingerprint(&ops);
                    let frame = render_raster::rasterize_with_media(
                        &ops,
                        renderer.width,
                        renderer.height,
                        &mut media,
                    );
                    std::hint::black_box((fingerprint, frame.is_ok()));
                }
            } else {
                for t in &times {
                    let plan = planner.plan(&renderer, &ir, &mut engine, *t);
                    let fingerprint = plan.frame_fingerprint().unwrap();
                    let frame = execute_plan(&plan, &mut executor, &mut media, None);
                    std::hint::black_box((fingerprint, frame.is_ok()));
                }
            }
            let elapsed = start.elapsed().as_secs_f64();
            if is_record {
                record_full = record_full.min(elapsed);
            } else {
                plan_full = plan_full.min(elapsed);
            }
        }
    }

    let orchestration = plan_only / record_only;
    let end_to_end = plan_full / record_full;
    println!(
        "{total_frames} 帧 · 编排段 record {record_only:.4}s vs plan {plan_only:.4}s（{orchestration:.4}×）\
         · 端到端 {record_full:.4}s vs {plan_full:.4}s（{end_to_end:.4}×）"
    );
    assert!(
        orchestration <= 1.05,
        "编排段开销超过 5%：record+fingerprint {record_only:.4}s vs plan+fingerprint {plan_only:.4}s（{orchestration:.4}×）"
    );
    assert!(
        end_to_end <= 1.03,
        "端到端开销超过 3%：record+rasterize {record_full:.4}s vs plan+execute {plan_full:.4}s（{end_to_end:.4}×）"
    );
}
