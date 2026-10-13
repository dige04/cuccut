//! Consistency guard between the directory and the `include_str!` manifest list.
//!
//! `ccut-motion` itself does no I/O, so this check can only live in a dev test target: if one `builtin!(...)` line is missing, the crate still compiles, and only this test goes red.

use std::collections::BTreeSet;
use std::path::PathBuf;

use motion::preset_registry::{Domain, ids, registered_files, validate_all};

fn presets_dir(domain: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("presets/builtin")
        .join(domain)
}

/// `core/presets/builtin/transition/` is a directory shared by **two** registries:
/// `bcf.*` (dual-channel property recipes) and `caption.*` (caption entry poses) are managed by the preset registry,
/// and `transition.*` are the two-picture effects of the effect registry (managed by `tests/effects.rs`).
/// Split by prefix, so neither side counts the other's files as missing registrations.
fn files_on_disk(domain: &str) -> BTreeSet<String> {
    std::fs::read_dir(presets_dir(domain))
        .expect("preset directory")
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension()?.to_str()? != "json" {
                return None;
            }
            let stem = path.file_stem()?.to_str()?.to_owned();
            if domain == "transition" && !(stem.starts_with("bcf.") || stem.starts_with("caption."))
            {
                return None;
            }
            Some(stem)
        })
        .collect()
}

#[test]
fn every_manifest_file_on_disk_is_registered() {
    // `shape` / `sticker` / `visualizer` / `progress` are directory-type recipes (ADR-E05),
    // and `textpreset` is the text preset pack (`docs/design/app-v2/text-pane-and-groups.md` §6.2).
    // If they are not added to this loop, a new directory will **never** get a consistency check: if one `builtin!(...)` line is missing, the crate still compiles.
    for domain in [
        "motion",
        "transition",
        "shape",
        "sticker",
        "visualizer",
        "progress",
        "confetti",
        "textpreset",
    ] {
        let disk = files_on_disk(domain);
        let registered: BTreeSet<String> = registered_files(domain)
            .into_iter()
            .map(str::to_owned)
            .collect();
        assert_eq!(
            disk, registered,
            "{domain}: core/presets/builtin/{domain} 与 preset_registry.rs 的清单不一致"
        );
    }
}

#[test]
fn the_effect_domain_directories_exist() {
    // Directory consistency of the effect manifests is guarded by `tests/effects.rs` (they are not motion presets, and they sit in a different registry); here we only confirm the path convention has not been moved.
    for domain in ["filter", "composite"] {
        assert!(
            presets_dir(domain).is_dir(),
            "缺 core/presets/builtin/{domain}"
        );
    }
}

#[test]
fn all_manifests_parse_and_the_catalogue_is_frozen() {
    validate_all().unwrap();
    // Text catalogue 25/21/11 + element catalogue 28/28/9 (2026-09-08).
    assert_eq!(ids(Domain::TimelineEnter).len(), 53);
    assert_eq!(ids(Domain::TimelineExit).len(), 49);
    assert_eq!(ids(Domain::TimelineLoop).len(), 20);
    assert_eq!(ids(Domain::BcfMotion).len(), 5);
    assert_eq!(ids(Domain::BcfTransition).len(), 10);
    // P7a: 23 basic shapes + CucCut's own `line`, in panel grid order.
    assert_eq!(
        ids(Domain::TimelineShape),
        vec![
            "rect", "ellipse", "triangle", "rombus", "pentagon", "hex", "octagon", "squig",
            "squig2", "line", "arrow", "tick", "tick2", "chevron", "chevron2", "cross2", "cross",
            "love2", "love", "diamond", "star", "sharp", "star2", "sharp2"
        ]
    );
    // P7b: first batch of 10 template stickers, all normalized paths drawn by CucCut itself.
    assert_eq!(
        ids(Domain::TimelineSticker),
        vec![
            "badge_check",
            "badge_cross",
            "star_burst",
            "speech_bubble",
            "heart",
            "bolt",
            "pin",
            "sparkle",
            "arrow_curved",
            "crown"
        ]
    );
    // Waveforms 10 (redesigned 2026-09) + progress 14 (design §7.3 / §7.4). CucCut does not do paid tiers,
    // and does not treat Countdown / Count Up as progress (those are text elements).
    assert_eq!(ids(Domain::TimelineVisualizer).len(), 10);
    assert_eq!(ids(Domain::TimelineProgress).len(), 14);
    // Ten confetti styles (`docs/design/elements/ccut-confetti-element-design.md` §4.4).
    assert_eq!(ids(Domain::TimelineConfetti).len(), 10);
}

/// The id of a directory-type recipe **is** the value in `timeline.json`, and **is** also the file name:
/// the three are identical word for word, so `preset-unknown` needs no extra prefix conversion rule.
#[test]
fn the_catalogue_ids_match_the_files_and_the_document_values() {
    for (dir, domain) in [
        ("shape", Domain::TimelineShape),
        ("sticker", Domain::TimelineSticker),
        ("visualizer", Domain::TimelineVisualizer),
        ("progress", Domain::TimelineProgress),
        ("confetti", Domain::TimelineConfetti),
    ] {
        let registered: BTreeSet<String> = registered_files(dir)
            .into_iter()
            .map(str::to_owned)
            .collect();
        let ids: BTreeSet<String> = ids(domain).into_iter().map(str::to_owned).collect();
        assert_eq!(registered, ids, "{dir}");
        assert_eq!(files_on_disk(dir), ids, "{dir}");
    }
}

/// `(id, version)` is the frozen unit of a directory-type recipe, and `manifest_hash` is the content hash of the source file.
/// All 34 are pinned one by one: id identical to the file name, `version` always 1, and `manifest_hash` all different and changing with file content (changing one parameter must consciously bump `version`).
#[test]
fn the_thirty_four_catalogue_recipes_are_frozen_at_version_one() {
    use motion::preset_registry::{timeline_confettis, timeline_progresses, timeline_visualizers};

    let mut hashes = Vec::new();
    for recipe in timeline_visualizers() {
        assert_eq!(recipe.version, 1, "{}", recipe.id);
        assert!(recipe.available, "{}", recipe.id);
        assert_eq!(recipe.qualified_id(), format!("visualizer.{}", recipe.id));
        assert!(recipe.visualizer().is_some(), "{}", recipe.id);
        hashes.push(recipe.manifest_hash);
    }
    for recipe in timeline_progresses() {
        assert_eq!(recipe.version, 1, "{}", recipe.id);
        assert!(recipe.available, "{}", recipe.id);
        assert_eq!(recipe.qualified_id(), format!("progress.{}", recipe.id));
        assert!(recipe.progress().is_some(), "{}", recipe.id);
        hashes.push(recipe.manifest_hash);
    }
    for recipe in timeline_confettis() {
        assert_eq!(recipe.version, 1, "{}", recipe.id);
        assert!(recipe.available, "{}", recipe.id);
        assert_eq!(recipe.qualified_id(), format!("confetti.{}", recipe.id));
        let body = recipe.confetti().expect(&recipe.id);
        // The “start point” toggle is only given to the four burst styles (design draft §6.2).
        let burst = body
            .recipe
            .object("emit")
            .and_then(|e| e.get("mode"))
            .and_then(|m| m.as_str())
            == Some("burst");
        assert_eq!(body.has_emitter_control, burst, "{}", recipe.id);
        hashes.push(recipe.manifest_hash);
    }
    assert_eq!(hashes.len(), 34);
    let total = hashes.len();
    hashes.sort_unstable();
    hashes.dedup();
    assert_eq!(hashes.len(), total, "两份配方的 manifest_hash 撞了");
}

/// `available` is a **surface catalog** switch (ADR-M09), not a kernel gate: core evaluation never reads it,
/// and `ccut render` still renders `wipe`. It only answers “can this row be selected in the App's animation panel”,
/// and since `wipe` still has no element bounding box to clip against, it is hidden in the catalog
/// (`core/crates/ccut-editor-core/src/anim_presets.rs`).
/// Since round 156 the catalog has no unavailable rows (`wipe`'s reveal is clipped by the core-composited scene);
/// this table pins that no recipe quietly slips into the catalog with available: false.
const UNAVAILABLE_TIMELINE_PRESETS: &[&str] = &[];

#[test]
fn every_manifest_declares_a_determinism_level() {
    for name in ids(Domain::TimelineEnter) {
        let recipe = motion::preset_registry::timeline_enter(name).unwrap();
        assert_eq!(recipe.determinism, "strict", "{name}");
        assert_eq!(
            recipe.available,
            !UNAVAILABLE_TIMELINE_PRESETS.contains(&name),
            "{name}"
        );
    }
    for name in ids(Domain::TimelineExit) {
        let recipe = motion::preset_registry::timeline_exit(name).unwrap();
        assert_eq!(recipe.determinism, "strict", "{name}");
        assert_eq!(
            recipe.available,
            !UNAVAILABLE_TIMELINE_PRESETS.contains(&name),
            "{name}"
        );
    }
    for name in ids(Domain::TimelineLoop) {
        let recipe = motion::preset_registry::timeline_loop(name).unwrap();
        assert_eq!(recipe.determinism, "strict", "{name}");
    }
}

// ── Caption entry poses (the `magic-*` absorbed in phase 5) ────────────────────────────

/// The numbers in these three recipes are the **ground truth for caption pixels**. This test aligns them item by item with the literals in `core/crates/ccut-kernel/src/cmd/studio_export/transition.rs` from before they were absorbed:
/// changing a recipe means changing this first; if you cannot change it here, that means you changed it wrong.
#[test]
fn the_caption_transition_recipes_match_the_historical_constants() {
    use motion::curve::CurveSpec;
    use motion::preset_registry::{caption_transition, caption_transitions};

    let expected: &[(&str, &str, [f64; 4])] = &[
        (
            "magic-fade",
            "transition.caption.fade",
            [0.42, 0.0, 0.58, 1.0],
        ),
        (
            "magic-pop",
            "transition.caption.pop",
            [0.22, 0.19, 0.54, 1.62],
        ),
        (
            "magic-flip",
            "transition.caption.flip",
            [0.25, 0.46, 0.45, 0.94],
        ),
    ];
    assert_eq!(caption_transitions().len(), expected.len());
    for (legacy, id, bezier) in expected {
        let recipe = caption_transition(legacy).unwrap_or_else(|| panic!("缺 {legacy}"));
        assert_eq!(recipe.id, *id);
        assert_eq!(recipe.version, 1);
        assert_eq!(recipe.determinism, "strict");
        // Phase quantization is a recipe parameter, not an implementation detail: caption poses follow the frame number.
        assert_eq!(recipe.time_quantization, "round-both-ends");
        assert_eq!(recipe.solver, "newton6-bisect10-1e-6");
        assert_eq!(
            recipe.curve,
            CurveSpec::CubicBezier {
                x1: bezier[0],
                y1: bezier[1],
                x2: bezier[2],
                y2: bezier[3],
            }
        );
    }

    // Each derived channel is aligned, one by one, with the expression in the original implementation.
    let fade = caption_transition("magic-fade").unwrap();
    assert_eq!(
        fade.channels
            .iter()
            .map(|channel| channel.prop.as_str())
            .collect::<Vec<_>>(),
        ["opacity", "blur"]
    );
    for e in [0.0, 0.25, 0.5, 0.75, 1.0] {
        // opacity = clamp(e, 0, 1)
        assert_eq!(
            fade.channel_value(&fade.channels[0], e, 2.5),
            e.clamp(0.0, 1.0)
        );
        // blur = (6 × canvasScale × (1 − e)).max(0) —— same evaluation order as the original expression
        for scale in [1.0, 2.5, 0.75] {
            assert_eq!(
                fade.channel_value(&fade.channels[1], e, scale),
                (6.0 * scale * (1.0 - e)).max(0.0)
            );
        }
    }
    let pop = caption_transition("magic-pop").unwrap();
    for e in [0.0, 0.4, 1.0, 1.1] {
        // scale = 0.7 + 0.3e, **not clamped** (the curve overshoots above 1)
        assert_eq!(pop.channel_value(&pop.channels[0], e, 1.0), 0.7 + 0.3 * e);
    }
    let flip = caption_transition("magic-flip").unwrap();
    for e in [-0.1, 0.0, 0.6, 1.0, 1.2] {
        assert_eq!(
            flip.channel_value(&flip.channels[0], e, 1.0),
            e.clamp(0.0, 1.0)
        );
    }

    // Phase: both ends are each rounded to fps, then subtracted.
    let fps = 30.0;
    assert_eq!(
        fade.phase(1.0 / 3.0, 0.02, 0.4, fps),
        (10.0 / 30.0 - 1.0 / 30.0) / 0.4
    );
}

/// Why caption recipes must declare `solver` explicitly: the two solvers are **not equal** on `[0, 1]`,
/// and once the difference is multiplied by 255 and lands on a u8 rounding boundary, it becomes a caption pixel difference.
#[test]
fn the_caption_solver_is_not_interchangeable_with_the_default_one() {
    let (x1, y1, x2, y2) = (0.22, 0.19, 0.54, 1.62);
    let mut worst = 0.0f64;
    let mut differs = false;
    for step in 0..=1000 {
        let t = f64::from(step) / 1000.0;
        let a = motion::curve::cubic_bezier_caption(x1, y1, x2, y2, t);
        let b = motion::curve::cubic_bezier(x1, y1, x2, y2, t);
        if a != b {
            differs = true;
        }
        worst = worst.max((a - b).abs());
    }
    assert!(differs, "两条求解器如果逐位相同，配方就不必声明 solver 了");
    assert!(worst > 1e-7, "实测最大差 {worst}");
    // The endpoints still agree; what differs is the iterative precision in between.
    for (x1, y1, x2, y2) in [(0.42, 0.0, 0.58, 1.0), (0.25, 0.46, 0.45, 0.94)] {
        assert_eq!(
            motion::curve::cubic_bezier_caption(x1, y1, x2, y2, 0.0),
            0.0
        );
        assert_eq!(
            motion::curve::cubic_bezier_caption(x1, y1, x2, y2, 1.0),
            1.0
        );
    }
}

// ── Template sticker catalog (design §10 P7 / P7b) ─────────────────────────────────

/// The **structural** criteria for template stickers: the value of this batch lies not in “what it draws” but in “whether the recipe shape is right”.
/// Each one must have layers, each layer must have a color and an outline, `strokeWidth` is a proportion of the element box's short side rather than pixels, `(id, version)` is frozen, and `manifest_hash` values are all different. P7c expanding the templates is pure data, and this test is its guardrail.
#[test]
fn every_sticker_template_is_a_stack_of_coloured_outlines() {
    use motion::preset_registry::{PathSegment, timeline_sticker, timeline_stickers};

    let mut hashes = Vec::new();
    for recipe in timeline_stickers() {
        let id = recipe.id.as_str();
        assert_eq!(recipe.version, 1, "{id}");
        assert!(recipe.available, "{id}");
        assert_eq!(recipe.qualified_id(), format!("sticker.{id}"), "{id}");
        // Stickers have no drawing algorithm: they are output directly as vectors, unlike visualizer / progress, which need a kernel name.
        assert!(recipe.recipe().is_none(), "{id}");
        assert!(recipe.shape().is_none(), "{id}");
        let body = recipe.sticker().expect("sticker 目录只装 sticker 配方");
        assert!(!body.layers.is_empty(), "{id}");
        for layer in &body.layers {
            assert!(
                layer.fill.is_some() || layer.stroke.is_some(),
                "{id}: 每层至少要有一个颜色"
            );
            for color in [layer.fill.as_deref(), layer.stroke.as_deref()]
                .into_iter()
                .flatten()
            {
                assert!(color.starts_with('#'), "{id}: {color}");
                assert!(matches!(color.len(), 7 | 9), "{id}: {color}");
            }
            assert!(
                layer.stroke_width > 0.0 && layer.stroke_width <= 1.0,
                "{id}: strokeWidth 是元素盒短边的比例"
            );
            assert!(
                matches!(layer.segments.first(), Some(PathSegment::Move(_))),
                "{id}: 轮廓必须以 move 开头"
            );
            // Geometry is written within the unit square (0..1): anything out of range would be drawn outside the element box.
            for point in layer.segments.iter().flat_map(|segment| match segment {
                PathSegment::Move(p) | PathSegment::Line(p) => vec![*p],
                PathSegment::Quad(a, b) => vec![*a, *b],
                PathSegment::Cubic(a, b, c) => vec![*a, *b, *c],
                PathSegment::Close => Vec::new(),
            }) {
                assert!(
                    (0.0..=1.0).contains(&point[0]) && (0.0..=1.0).contains(&point[1]),
                    "{id}: 点 {point:?} 越出单位正方"
                );
            }
        }
        assert!(timeline_sticker(id).is_some(), "{id}");
        hashes.push(recipe.manifest_hash);
    }
    assert_eq!(hashes.len(), 10);
    let total = hashes.len();
    hashes.sort_unstable();
    hashes.dedup();
    assert_eq!(hashes.len(), total, "两份模板的 manifest_hash 撞了");
    assert!(timeline_sticker("no-such-template").is_none());
}

/// Multiple layers and multiple colors are the dividing line between stickers and shapes: at least one template really uses two or more layers and two or more colors.
/// A monochrome single-layer “sticker” should be made as a shape recipe, not take up a spot in the sticker catalog.
#[test]
fn the_sticker_catalogue_actually_uses_more_than_one_layer() {
    use motion::preset_registry::timeline_stickers;

    let multi = timeline_stickers()
        .iter()
        .filter(|recipe| recipe.sticker().expect("sticker body").layers.len() > 1)
        .count();
    assert!(multi >= 6, "多层模板只有 {multi} 份");
}

/// Self-verifying invariants of sticker geometry (originally in `every_sticker_recipe_has_geometry` in `gen_element_sticker_paths.rs`; after the two generated outputs for Swift and `designs/cuccut-mac` were taken offline along with the old Mac surface and the generator was removed entirely, these registry assertions that do not depend on generated output were moved here and continue to guard it).
#[test]
fn every_sticker_layer_is_well_formed() {
    use motion::preset_registry::{PathSegment, timeline_stickers};

    for recipe in timeline_stickers() {
        let layers = &recipe.sticker().expect("sticker body").layers;
        assert!(!layers.is_empty(), "{} 一层都没有", recipe.id);
        for layer in layers {
            // The first segment of each layer must be `move` (validated at parse time), so consumers need not defend against it.
            assert!(
                matches!(layer.segments.first(), Some(PathSegment::Move(_))),
                "{} 的某一层没有以 move 开头",
                recipe.id
            );
            // At least one color (validated at parse time), otherwise the layer draws nothing.
            assert!(
                layer.fill.is_some() || layer.stroke.is_some(),
                "{} 的某一层既没有 fill 也没有 stroke",
                recipe.id
            );
            // Self-check of the convention: stroke width is a ratio, not pixels.
            assert!(
                layer.stroke_width > 0.0 && layer.stroke_width <= 1.0,
                "{} 的 strokeWidth 不像比例：{}",
                recipe.id,
                layer.stroke_width
            );
        }
    }
}

/// Self-check of the wave column: “4 bar-style + 6 curve/dot-matrix/pulse-style + 8 progress-style” is not a hand-copied id list,
/// but the result of “algorithms the drawing kernel has landed ∩ strict” (the wave column in design §7.3/§7.4).
/// Consumers filter with the same rule; here we pin its solution on the current catalog, otherwise, when P5 adds algorithms to the allowlist (and loosens the strict restriction), nobody would know what the baseline is.
/// (Originally in `gen_element_catalogue.rs`: the only consumer of that contract fixture was the Mac client, which has since been taken offline, and the generator was removed with it; this registry assertion that does not depend on generated output has been moved here.)
#[test]
fn the_shipped_wave_is_a_function_of_algorithm_and_determinism() {
    use motion::preset_registry::{timeline_progresses, timeline_visualizers};

    const VISUALIZER_BARS: [&str; 2] = ["spectrum-bars-v1", "polar-bars-v1"];
    const VISUALIZER_CURVES: [&str; 5] = [
        "oscilloscope-v1",
        "spectrum-area-v1",
        "dot-matrix-v1",
        "pulse-rings-v1",
        "ribbons-v1",
    ];
    const PROGRESS_P3: [&str; 3] = ["bar-v1", "frame-v1", "ring-v1"];
    const PROGRESS_P4: [&str; 1] = ["snake-v1"];

    let visualizers = |kernels: &[&str]| {
        let mut ids: Vec<&str> = timeline_visualizers()
            .iter()
            .filter(|recipe| {
                let body = recipe.visualizer().expect("visualizer body");
                recipe.available
                    && body.determinism.name() == "strict"
                    && kernels.contains(&body.recipe.algorithm.name())
            })
            .map(|recipe| recipe.id.as_str())
            .collect();
        ids.sort_unstable();
        ids
    };
    assert_eq!(
        visualizers(&VISUALIZER_BARS),
        ["bars", "bars_bottom", "bars_rounded", "ring_bars"],
        "柱状 4 种"
    );
    assert_eq!(
        visualizers(&VISUALIZER_CURVES),
        [
            "dots",
            "oscilloscope",
            "pulse_rings",
            "ribbons",
            "ring_wave",
            "spectrum_area"
        ],
        "曲线 / 点阵 / 脉冲 6 种"
    );

    let progresses = |kernels: &[&str]| {
        let mut ids: Vec<&str> = timeline_progresses()
            .iter()
            .filter(|recipe| {
                let body = recipe.progress().expect("progress body");
                recipe.available
                    && body.determinism.name() == "strict"
                    && kernels.contains(&body.recipe.algorithm.name())
            })
            .map(|recipe| recipe.id.as_str())
            .collect();
        ids.sort_unstable();
        ids
    };
    assert_eq!(
        progresses(&PROGRESS_P3),
        [
            "border",
            "circle",
            "donut",
            "normal",
            "reverse_border",
            "rounded"
        ],
        "P3 的 progress 6 种"
    );
    assert_eq!(
        progresses(&PROGRESS_P4),
        ["snake", "snake_spin"],
        "P4 的 snake 2 种"
    );

    // The collection that is live is exactly the solution of the consumer allowlist: 10 + 8.
    let mut shipped = VISUALIZER_BARS.to_vec();
    shipped.extend(VISUALIZER_CURVES);
    assert_eq!(visualizers(&shipped).len(), 10);
    let mut shipped = PROGRESS_P3.to_vec();
    shipped.extend(PROGRESS_P4);
    assert_eq!(progresses(&shipped).len(), 8);
}
