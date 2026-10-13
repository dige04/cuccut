//! GPU ↔ CPU conformance (acceptance point of the element plan, §8.7 / P5 in §10).
//!
//! The same set of parameters with the five values `progress ∈ {0, 0.25, 0.5, 0.75, 1}`: GPU output is compared pixel by pixel against the CPU
//! reference, **and each value is also run once in shuffled order**. The CPU is always the strict reference
//! (ADR-M05); the GPU is only an accelerator.
//!
//! **The comparison surface covers only the 14 progress styles.** Since the visualizer redesign of 2026-09, all 10 visualizer styles are CPU vector recipes (`source/visualizer/recipes/`) with no WGSL implementation; `shader_for` always returns `None` for them, and the host records a `ShaderMissing` fallback. That path is pinned by the fallback test at the end of the file, and there is no longer a pixel-by-pixel comparison for them.
//!
//! ```bash
//! cd core
//! cargo test -p ccut-render --features gpu --test gpu_conformance -- --nocapture
//! ```
//!
//! ## strict criteria (the **one-time correction** to §8.7, frozen after P5b landed)
//!
//! §12's risk table allows “one correction, based on measured results, recorded in the P5 implementation log”. The fact measured in P5a: the CPU reference is a **vector** path with hard edges, while the GPU draws a continuous `factor` (soft edges). Two **different anti-aliasing functions** necessarily differ by hundreds of grey levels across the transition band, while the centres of the colour blocks and the background are bit-identical. Full-resolution SSIM measures exactly “whether the two sides use the same anti-aliasing function”, which they never do — so it is not a meaningful hard gate.
//!
//! The corrected strict criteria are three **structural** metrics:
//!
//! 1. **Per-channel ≤ 2/255 in flat regions** ([`FLAT_CHANNEL_BUDGET`], the same 2 as in the original text of §8.7):
//!    only pixels whose 3×3 neighbourhood is constant in both images are checked, i.e. pixels that are “not on any edge”;
//! 2. **Share of transition-band pixels ≤ 20%** ([`EDGE_PIXEL_SHARE`]): this catches a real regression such as “the whole picture is shifted”, rather than rejecting “two edge pixels differ”, which is by design;
//! 3. **SSIM ≥ 0.98 after 4× downsampling** ([`SSIM_FLOOR_STRICT`]): downsampling is precisely the operation that “spreads the transition band out by area”; it measures whether the two images look like the same image.
//!
//! Full-resolution SSIM is **still printed for each case**, as a diagnostic rather than a hard gate.
//!
//! ## visual criteria (original values of §8.7, not revised)
//!
//! By definition the CPU reference for the `visual` tier is a downsampled / lookup-table approximation, and the criterion is **SSIM ≥ 0.96** ([`SSIM_FLOOR_VISUAL`]). Like the third strict criterion, it is measured after 4× downsampling — for the same reason as above; and the §8.7 sentence “does not pursue pixel-level accuracy” is exactly about this.
//!
//! ## What this criterion does not let slip through
//!
//! The colour boundary of `progress.normal` is a vertical hard edge and `progress × width` falls on pixel boundaries, so the two sides are **byte-identical**. This is pinned on its own with `assert_eq!(max_deviation, 0)`, and it is the strongest evidence that “the GPU path itself is correct” (single quad, y-flip, uniform order, premultiplied output, `DiscardClip`, and the full readback conversion chain).
#![cfg(feature = "gpu")]

use std::sync::Arc;

use anyhow::{Result, bail};
use motion::preset_registry::timeline_progress;
use render_raster::drawop::{FrameBuilder, Mat6};
use render_raster::imgcmp::{self, Comparison};
use render_raster::plan::shader_quad::ShaderQuad;
use render_raster::raster::{FrameMedia, rasterize_with_media};
use render_raster::source::kernel::DrawBox;
use render_raster::source::{ProgressParams, progress_frame};
use render_raster::{GpuExecutor, plan::gpu_fallback::GpuBackendReport};
use tiny_skia::Pixmap;

// ── Input side, identical word for word to `core/fixtures/progress/cases.json`.

/// The `progress` and `times` columns of `cases.json`.
const PROGRESS_VALUES: [f64; 5] = [0.0, 0.25, 0.5, 0.75, 1.0];
const PROGRESS_TIMES: [f64; 5] = [0.0, 0.75, 1.5, 2.25, 3.0];

/// `#3CADFF` / `#C4E6FF` (the fixture's `mainColor` / `secondaryColor`).
const MAIN: [f32; 4] = [0.235_294_12, 0.678_431_4, 1.0, 1.0];
const SECONDARY: [f32; 4] = [0.768_627_5, 0.901_960_8, 1.0, 1.0];
const TF: Mat6 = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

// ── §8.7 criteria (see the file header).

/// Lower bound for **4× downsampled SSIM** in the strict tier (the third criterion of §8.7 after correction).
const SSIM_FLOOR_STRICT: f64 = 0.98;

/// SSIM lower bound for the `visual` tier (the **original** value in §8.7, not revised).
const SSIM_FLOOR_VISUAL: f64 = 0.96;

/// The form of §8.7's “per-channel ≤ 2/255” over **flat regions**. This 2 is the same 2 as in the original text.
///
/// The algorithm has been consolidated into [`imgcmp`] (WP5b); here [`imgcmp::FLAT_CHANNEL_BUDGET`] is reused directly,
/// so that no second definition is kept that could drift.
const FLAT_CHANNEL_BUDGET: u8 = imgcmp::FLAT_CHANNEL_BUDGET;

/// Upper bound on the share of transition-band pixels (the second criterion of §8.7 after correction).
const EDGE_PIXEL_SHARE: f64 = 0.20;

/// Supersampling factor. 1× is “the reference implementation as-is”, 4× is “add anti-aliasing on the GPU side comparable to the rasterizer”. Both are measured, and the measured numbers are printed together.
const SUPERSAMPLE: u32 = 4;

/// The box for `aspect: "bar"`: same size as the fixture's geometry default table, origin reset to zero.
///
/// The `bar` box of the `progress` fixture is `80% × 5%` at 1080p = **1536 × 54** — both width and height are
/// exactly integer pixels, and `progress × 1536` also falls entirely on pixel boundaries. The GPU render target can only be
/// integer-sized, so here only the position is moved to the origin (compositing the quad's own picture is the caller's job),
/// and the **size matches the fixture**.
const PROGRESS_BOX: DrawBox = DrawBox {
    x: 0.0,
    y: 0.0,
    w: 1536.0,
    h: 54.0,
};

/// The box for `aspect: "square"`: the geometry default table's `30% × 30%` (576 × 324 at 1080p)
/// is shrunk to the inscribed square **324 × 324**.
///
/// Do not make do with the inscribed square of the bar box (54): that is only 54 px on a side, and after 4× downsampling it is
/// 13 × 13, not even big enough for two SSIM windows, and a single ring of anti-aliasing could drag the score down to 0.91 — which would measure
/// that the fixture is too small, not that the implementation is wrong.
const SQUARE_BOX: DrawBox = DrawBox {
    x: 0.0,
    y: 0.0,
    w: 324.0,
    h: 324.0,
};

/// The box for `aspect: "frame"`: the whole frame from the geometry default table. Conformance uses quarter resolution
/// (480 × 270); border thickness is a **relative quantity** (`borderSize · max(w, h)`), so the conversion is unaffected.
const FRAME_BOX: DrawBox = DrawBox {
    x: 0.0,
    y: 0.0,
    w: 480.0,
    h: 270.0,
};

/// The instruction stream contains no `DrawMedia`: if it is actually called, the precondition of this test is broken.
struct NoMedia;

impl FrameMedia for NoMedia {
    fn frame(&mut self, id: &str, _media_ms: i64) -> Result<Arc<Pixmap>> {
        bail!("the conformance instruction stream should not reference media {id}")
    }
}

fn progress_params() -> ProgressParams {
    ProgressParams {
        main_color: MAIN,
        secondary_color: SECONDARY,
        pixel_scale: 1.0,
    }
}

/// A style with `aspect: "square"` takes the inscribed square inside the box and draws there (same rule for CPU and GPU).
///
/// The GPU render target is only the quad's own picture (`QuadTarget::from_box` takes the inscribed
/// square), so the CPU reference must be rasterized into the **same box**, otherwise two images of different sizes would be compared. Positions are always reset to zero: compositing is the caller's job.
fn progress_box(style: &str) -> DrawBox {
    let recipe = timeline_progress(style).expect("style is registered");
    match recipe.progress().expect("progress recipe").aspect {
        motion::preset_registry::ProgressAspect::Square => SQUARE_BOX,
        motion::preset_registry::ProgressAspect::Frame => FRAME_BOX,
        motion::preset_registry::ProgressAspect::Bar => PROGRESS_BOX,
    }
}

fn cpu_progress(style: &str, progress: f64, time: f64) -> Pixmap {
    let recipe = timeline_progress(style).expect("style is registered");
    let bbox = progress_box(style);
    let mut builder = FrameBuilder::default();
    progress_frame(
        &mut builder,
        recipe,
        &progress_params(),
        progress,
        time,
        bbox,
        TF,
    );
    rasterize_with_media(
        &builder.finish(),
        bbox.w as u32,
        bbox.h as u32,
        &mut NoMedia,
    )
    .expect("CPU reference rasterization")
}

fn progress_quad(style: &str, progress: f64, time: f64) -> ShaderQuad {
    let recipe = timeline_progress(style).expect("style is registered");
    ShaderQuad::progress(
        recipe,
        &progress_params(),
        progress,
        time,
        progress_box(style),
        (PROGRESS_BOX.w, PROGRESS_BOX.h),
    )
    .unwrap_or_else(|error| panic!("{style} failed to build the quad: {error}"))
}

// ── Comparison: the algorithm is consolidated in `render_raster::imgcmp` (WP5b); this file keeps only the decision thresholds
// and the three assertion pieces of logic — those are criteria for this specific GPU anti-aliasing problem, not a shared algorithm contract.

/// Thin wrapper: the two images here are always the same size (the CPU reference and the GPU render are drawn into the same box),
/// so `imgcmp::compare`'s size error degrades to `expect`. If it actually fires, the precondition of this test is broken, and it is worth crashing outright rather than silently skipping.
fn compare(cpu: &Pixmap, gpu: &Pixmap) -> Comparison {
    imgcmp::compare(cpu, gpu).expect("both sides must have the same size")
}

fn executor() -> Option<GpuExecutor> {
    match GpuExecutor::new() {
        Ok(executor) => {
            println!(
                "GPU: backend={} adapter={}",
                executor.backend(),
                executor.adapter_name()
            );
            Some(executor)
        }
        Err(error) => {
            // On machines without a GPU this test is **skipped rather than failed** (§8.7: CI runs GPU conformance only on fixed
            // runners, and a failure does not block the CPU path).
            let report = GpuBackendReport::default();
            println!("skipping GPU conformance: {error}; report {:?}", report.records);
            None
        }
    }
}

fn assert_within_budget(label: &str, measured: Comparison, ssim_floor: f64) {
    println!(
        "  {label:26} ssim={:.4} ssim@4x={:.4} max={:>3} flat={:>3} edge={:>6.3}%",
        measured.ssim,
        measured.ssim_downsampled,
        measured.max_deviation,
        measured.flat_max_deviation,
        measured.edge_share * 100.0
    );
    // The criterion rests on **downsampled** SSIM; the full-resolution number is only printed, see the file header.
    assert!(
        measured.ssim_downsampled >= ssim_floor,
        "{label}: 4× downsampled SSIM {:.6} < {ssim_floor}",
        measured.ssim_downsampled
    );
    assert!(
        measured.flat_max_deviation <= FLAT_CHANNEL_BUDGET,
        "{label}: per-channel deviation in flat regions {}/255 > {FLAT_CHANNEL_BUDGET}/255",
        measured.flat_max_deviation
    );
    assert!(
        measured.edge_share <= EDGE_PIXEL_SHARE,
        "{label}: transition-band share {:.3}% > {:.1}% (the whole picture may be offset, not just the edges)",
        measured.edge_share * 100.0,
        EDGE_PIXEL_SHARE * 100.0
    );
}

/// The `visual` tier uses only the SSIM criterion (§8.7: the CPU reference is a downsampled approximation, so the two structural criteria for flat regions and transition bands are meaningless for it — its “flat regions” were never the same thing as the GPU's continuous field).
fn assert_visual(label: &str, measured: Comparison) {
    println!(
        "  {label:26} ssim={:.4} ssim@4x={:.4} max={:>3} flat={:>3} edge={:>6.3}%",
        measured.ssim,
        measured.ssim_downsampled,
        measured.max_deviation,
        measured.flat_max_deviation,
        measured.edge_share * 100.0
    );
    assert!(
        measured.ssim_downsampled >= SSIM_FLOOR_VISUAL,
        "{label}: 4× downsampled SSIM {:.6} < {SSIM_FLOOR_VISUAL}",
        measured.ssim_downsampled
    );
}

/// The determinism tier of one style. Catalogue-type recipes reuse the registry's enum (§7.3).
fn is_strict(determinism: motion::preset_registry::Determinism) -> bool {
    determinism == motion::preset_registry::Determinism::Strict
}

// ── Full comparison: 14 progress styles.

/// The colour boundary of `progress.normal` is a **vertical hard edge**, and `progress × 1536` falls exactly on pixel
/// boundaries, so neither side has anti-aliasing. This one can achieve **byte-identical** output and is the strongest evidence that “the GPU path itself is correct” (see the file header).
#[test]
fn the_pixel_aligned_progress_bar_matches_byte_for_byte() {
    let Some(mut gpu) = executor() else { return };
    println!("progress.normal (bar-v1, pixel-boundary aligned):");
    for (progress, time) in PROGRESS_VALUES.into_iter().zip(PROGRESS_TIMES) {
        let quad = progress_quad("normal", progress, time);
        let rendered = gpu.render_quad(&quad).expect("GPU render");
        let reference = cpu_progress("normal", progress, time);
        let measured = compare(&reference, &rendered);
        assert_within_budget(&format!("progress={progress}"), measured, SSIM_FLOOR_STRICT);
        assert_eq!(
            measured.max_deviation, 0,
            "progress={progress}: output must be byte-identical when pixel boundaries align"
        );
    }
}

/// **All 14 progress styles**: strict uses the three structural criteria, visual uses SSIM ≥ 0.96.
#[test]
fn every_progress_style_matches_the_cpu_reference() {
    let Some(mut gpu) = executor() else { return };
    for recipe in motion::preset_registry::timeline_progresses() {
        let body = recipe.progress().expect("progress recipe");
        println!(
            "progress.{} ({}, {}):",
            recipe.id,
            body.recipe.algorithm.name(),
            body.determinism.name()
        );
        for (progress, time) in PROGRESS_VALUES.into_iter().zip(PROGRESS_TIMES) {
            let quad = progress_quad(&recipe.id, progress, time);
            let rendered = gpu.render_quad(&quad).expect("GPU render");
            let reference = cpu_progress(&recipe.id, progress, time);
            let measured = compare(&reference, &rendered);
            let label = format!("progress={progress}");
            if is_strict(body.determinism) {
                assert_within_budget(&label, measured, SSIM_FLOOR_STRICT);
            } else {
                assert_visual(&label, measured);
            }
        }
    }
}

/// Supersampled version: adds anti-aliasing on the GPU side comparable to the rasterizer; the numbers go into the §13 implementation log.
///
/// Conclusion (measured in P5a, re-checked in P5b): **supersampling does not help** — the edge feathering comes from the shader's own
/// alpha ramp, not from aliasing, and the 4× numbers nearly coincide with 1×. It is kept so that “this difference is not due to insufficient
/// sampling” can be reproduced. The rounded caps of `rounded` are the only place in this family with slanted edges.
#[test]
fn the_supersampled_rounded_bar_reports_its_own_distribution() {
    let Some(mut gpu) = executor() else { return };
    println!("progress.rounded (bar-v1) {SUPERSAMPLE}× supersampled:");
    for (progress, time) in PROGRESS_VALUES.into_iter().zip(PROGRESS_TIMES) {
        let quad = progress_quad("rounded", progress, time);
        let rendered = gpu
            .render_quad_at(&quad, SUPERSAMPLE)
            .expect("GPU supersampled render");
        let reference = cpu_progress("rounded", progress, time);
        assert_within_budget(
            &format!("progress={progress}"),
            compare(&reference, &rendered),
            SSIM_FLOOR_STRICT,
        );
    }
}

// ── §8.7's “run once in shuffled order”.

/// The five values are run in **shuffled** order, and the per-frame bytes must match the results of the in-order run.
///
/// This is the form, on the **GPU executor**, of the ADR-E04 contract that “shuffled sampling = in-order sampling”:
/// neither pipeline caching nor uniform writes may let the previous frame affect the next one.
#[test]
fn shuffled_instants_render_the_same_bytes_as_sorted_ones() {
    let Some(mut gpu) = executor() else { return };
    let render = |gpu: &mut GpuExecutor, index: usize| -> Vec<u8> {
        let quad = progress_quad("normal", PROGRESS_VALUES[index], PROGRESS_TIMES[index]);
        gpu.render_quad(&quad).expect("GPU render").data().to_vec()
    };
    let sorted: Vec<Vec<u8>> = (0..PROGRESS_VALUES.len())
        .map(|index| render(&mut gpu, index))
        .collect();
    // The permutation over `cases.json` has 40 entries; here only a true permutation of the five values is needed.
    const SHUFFLE: [usize; 5] = [3, 0, 4, 1, 2];
    let mut shuffled = vec![Vec::new(); PROGRESS_VALUES.len()];
    for index in SHUFFLE {
        shuffled[index] = render(&mut gpu, index);
    }
    for (index, progress) in PROGRESS_VALUES.iter().enumerate() {
        assert_eq!(
            sorted[index], shuffled[index],
            "progress={progress} results differ in shuffled order"
        );
    }
    // The permutation must be a **real permutation** (not the identity), otherwise this test checks nothing.
    let mut seen = SHUFFLE;
    seen.sort_unstable();
    assert_eq!(seen, [0, 1, 2, 3, 4]);
    assert_ne!(SHUFFLE, [0, 1, 2, 3, 4]);
}

// ── Fallback skeleton.

/// Styles for which no WGSL is available: `shader_for` is `None`, and the host records a fallback on that basis and goes to the CPU.
///
/// There are now two fallback surfaces: styles missing from the registry, and **all 10 visualizer styles**
/// (CPU vector recipes, with no shader source). Both take the same `ShaderMissing` path, and the picture is unaffected either way;
/// all 14 progress styles, by contrast, can be looked up in source without exception.
#[test]
fn a_missing_shader_falls_back_instead_of_rendering_nothing() {
    use render_raster::plan::gpu_fallback::GpuFallbackReason;
    use render_raster::plan::shader_source::{ShaderDomain, shader_for};

    let mut report = GpuBackendReport {
        backend: Some("metal".to_owned()),
        records: Vec::new(),
    };
    assert!(report.is_fully_accelerated());
    for style in ["zz_not_a_style", "bars"] {
        assert!(
            shader_for(ShaderDomain::Visualizer, style).is_none(),
            "{style} should have no shader source"
        );
        report.push(
            Some((ShaderDomain::Visualizer, style.to_owned())),
            GpuFallbackReason::ShaderMissing,
            format!("visualizer style \"{style}\" has no WGSL implementation"),
        );
    }
    assert_eq!(report.records.len(), 2);
    assert!(!report.is_fully_accelerated());
    assert!(report.lines()[0].contains("falls back to CPU"));

    for recipe in motion::preset_registry::timeline_visualizers() {
        assert!(
            shader_for(ShaderDomain::Visualizer, &recipe.id).is_none(),
            "visualizer.{} is a CPU vector recipe and should have no shader source",
            recipe.id
        );
    }
    for recipe in motion::preset_registry::timeline_progresses() {
        assert!(shader_for(ShaderDomain::Progress, &recipe.id).is_some());
    }
    assert!(shader_for(ShaderDomain::Progress, "zz_not_a_style").is_none());
}

// ── Diagnostics (`--ignored`): print the cross-sections on both sides of one scanline.
//
// Use it when tuning a shader to see “where the difference is”, rather than looking at a single SSIM number.

/// ```bash
/// cargo test -p ccut-render --features gpu --test gpu_conformance -- --ignored --nocapture profile
/// ```
#[test]
#[ignore = "diagnostic only, not part of regular acceptance"]
fn print_a_scanline_profile() {
    let Some(mut gpu) = executor() else { return };
    let (progress, time) = (PROGRESS_VALUES[2], PROGRESS_TIMES[2]);
    let quad = progress_quad("rounded", progress, time);
    let rendered = gpu.render_quad(&quad).unwrap();
    let reference = cpu_progress("rounded", progress, time);
    {
        use render_raster::drawop::DrawOp;
        let recipe = timeline_progress("rounded").unwrap();
        let mut builder = FrameBuilder::default();
        progress_frame(
            &mut builder,
            recipe,
            &progress_params(),
            progress,
            time,
            PROGRESS_BOX,
            TF,
        );
        for op in builder.frame.ops.iter().take(3) {
            if let DrawOp::FillRect { x, y, w, h, .. } = op {
                println!("CPU FillRect x={x} y={y} w={w} h={h}");
            }
        }
    }
    let w = reference.width() as usize;
    let row = (reference.height() / 2) as usize;
    println!("x  cpu.a gpu.a   (box width {w}, midline y={row})");
    for x in 0..60 {
        let base = (row * w + x) * 4;
        println!(
            "{x:>3} {:>5} {:>5}",
            reference.data()[base + 3],
            rendered.data()[base + 3]
        );
    }
}

/// Diagnostic: draws the CPU / GPU difference for a given style as an ASCII map, plus an R-channel cross-section along the midline.
///
/// Use it when tuning a shader to see “where the difference is”, rather than looking at a single SSIM number — structural offsets
/// (misalignment, flips, seams) show up on this map first.
///
/// ```bash
/// CCUT_DIFF_STYLE=circle cargo test -p ccut-render --features gpu \
///     --test gpu_conformance -- --ignored --nocapture diff_map
/// ```
#[test]
#[ignore = "diagnostic only, not part of regular acceptance"]
fn print_a_diff_map() {
    let Some(mut gpu) = executor() else { return };
    let style = std::env::var("CCUT_DIFF_STYLE").unwrap_or_else(|_| "normal".to_owned());
    let (progress, time) = (PROGRESS_VALUES[2], PROGRESS_TIMES[2]);
    let quad = progress_quad(&style, progress, time);
    let rendered = gpu.render_quad(&quad).expect("GPU render");
    let reference = cpu_progress(&style, progress, time);
    let (w, h) = (reference.width() as usize, reference.height() as usize);
    let cell = (w / 60).max(1);
    println!("{style}: {w}x{h}, cell={cell}");
    // `#` present on both sides, `.` on neither side, `C` only in the CPU, `G` only in the GPU (judged by the R channel crossing half).
    for row in (0..h).step_by(cell) {
        let mut line = String::new();
        for col in (0..w).step_by(cell) {
            let base = (row * w + col) * 4;
            let (a, b) = (reference.data()[base], rendered.data()[base]);
            line.push(match (a > 128, b > 128) {
                (true, true) => '#',
                (false, false) => '.',
                (true, false) => 'C',
                (false, true) => 'G',
            });
        }
        println!("{line}");
    }
    // A cross-section along the midline: a structural offset shows up here as “the whole curve shifted by a cell or two”.
    let mid = h / 2;
    let window = (w / 4)..(w / 4 + 60).min(w);
    for (label, pixmap) in [("cpu", &reference), ("gpu", &rendered)] {
        print!("profile {label}:");
        for x in window.clone() {
            print!("{:>4}", pixmap.data()[(mid * w + x) * 4]);
        }
        println!();
    }
}
