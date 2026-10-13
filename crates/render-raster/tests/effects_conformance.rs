//! Conformance fixtures for strict effects (design §11 “Conformance”).
//!
//! One directory per effect, `core/fixtures/effects/<id>@<ver>/`:
//! `uniforms.json` (case name → uniform table), `expected-<case>.png` (byte-exact reference output), `expected.json` (size + output pixel fingerprint, used to give precise failure messages).
//! The inputs are the shared `input-a.png` / `input-b.png` (generated programmatically, see `write_inputs`).
//!
//! To regenerate: `CCUT_UPDATE_GOLDEN=1 cargo test -p ccut-render --test effects_conformance`.
//!
//! **The same fixtures will later be run unchanged against the GPU and Web implementations**. This is the executable form of “the GPU is only an accelerator; if it fails conformance it falls back automatically” in ADR-M05.

use motion::effect::{
    Determinism, EffectDomain, EffectRef, UniformMap, UniformValue, builtin_registry,
};
use render_raster::drawop::fnv1a64;
use render_raster::effects::{
    apply_filter, apply_image_mask, apply_transition, kernel_is_implemented,
};
use serde_json::{Map, Value, json};
use std::path::{Path, PathBuf};
use tiny_skia::{IntSize, Pixmap};

const SIZE: u32 = 48;

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/effects")
}

fn updating() -> bool {
    std::env::var_os("CCUT_UPDATE_GOLDEN").is_some_and(|value| !value.is_empty())
}

/// Input A: high-frequency colour gradient + a semi-transparent region + a solid green block (for chroma key), transparent corners.
/// Input B: radial luminance ramp (for `mask.luma` / `mask.image`).
/// Both have analytically defined values ⇒ byte-identical across machines.
fn make_input_a() -> Pixmap {
    let mut data = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for y in 0..SIZE {
        for x in 0..SIZE {
            let corner = (x < 4 && y < 4) || (x >= SIZE - 4 && y >= SIZE - 4);
            let alpha: u32 = if corner {
                0
            } else if x >= SIZE / 2 && y < SIZE / 2 {
                128
            } else {
                255
            };
            let (r, g, b) = if x < SIZE / 3 && y >= SIZE / 2 {
                (0u32, 255u32, 0u32) // Solid green area: chroma key
            } else {
                (
                    (x * 7 + y * 13) % 256,
                    (x * 3 + 40) % 256,
                    (y * 5 + 90) % 256,
                )
            };
            // Premultiplied
            data.push((r * alpha / 255) as u8);
            data.push((g * alpha / 255) as u8);
            data.push((b * alpha / 255) as u8);
            data.push(alpha as u8);
        }
    }
    Pixmap::from_vec(data, IntSize::from_wh(SIZE, SIZE).unwrap()).unwrap()
}

fn make_input_b() -> Pixmap {
    let mut data = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    let center = f64::from(SIZE) / 2.0;
    for y in 0..SIZE {
        for x in 0..SIZE {
            let distance =
                ((f64::from(x) - center).powi(2) + (f64::from(y) - center).powi(2)).sqrt() / center;
            let level = ((1.0 - distance).clamp(0.0, 1.0) * 255.0).round() as u32;
            let alpha = ((1.0 - distance * 0.5).clamp(0.0, 1.0) * 255.0).round() as u32;
            data.push((level * alpha / 255) as u8);
            data.push((level * alpha / 255) as u8);
            data.push((level * alpha / 255) as u8);
            data.push(alpha as u8);
        }
    }
    Pixmap::from_vec(data, IntSize::from_wh(SIZE, SIZE).unwrap()).unwrap()
}

fn read_or_write_png(path: &Path, produce: impl FnOnce() -> Pixmap) -> Pixmap {
    if updating() || !path.exists() {
        let pixmap = produce();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, pixmap.encode_png().unwrap()).unwrap();
        return pixmap;
    }
    Pixmap::decode_png(&std::fs::read(path).unwrap()).unwrap()
}

fn uniform_from_json(value: &Value) -> UniformValue {
    match value {
        Value::Bool(flag) => UniformValue::Bool(*flag),
        Value::String(text) => UniformValue::Text(text.clone()),
        Value::Array(items) if items.len() == 4 => {
            let mut rgba = [0.0f64; 4];
            for (slot, item) in rgba.iter_mut().zip(items) {
                *slot = item.as_f64().unwrap();
            }
            UniformValue::Color(rgba)
        }
        Value::Array(items) if items.len() == 2 => {
            UniformValue::Vec2([items[0].as_f64().unwrap(), items[1].as_f64().unwrap()])
        }
        other => UniformValue::Scalar(other.as_f64().unwrap()),
    }
}

fn uniforms_from_json(object: &Map<String, Value>) -> UniformMap {
    object
        .iter()
        .map(|(key, value)| (key.clone(), uniform_from_json(value)))
        .collect()
}

/// `(id, version, [(case, uniforms JSON)])`.
fn cases() -> Vec<(&'static str, u32, Vec<(&'static str, Value)>)> {
    // The `length` parameter is a **fraction of the canvas's short side**: with a 48 px short side, 3/48 = 3 px.
    vec![
        (
            "filter.blur",
            1,
            vec![
                ("r0", json!({"radius": 0.0})),
                ("r3", json!({"radius": 3.0 / 48.0})),
            ],
        ),
        (
            "filter.brightness",
            1,
            vec![
                ("up", json!({"amount": 0.2})),
                ("down", json!({"amount": -0.35})),
            ],
        ),
        ("filter.contrast", 1, vec![("up", json!({"amount": 0.5}))]),
        (
            "filter.saturation",
            1,
            vec![
                ("flat", json!({"amount": 0.0})),
                ("boost", json!({"amount": 1.8})),
            ],
        ),
        (
            "filter.grayscale",
            1,
            vec![("full", json!({"amount": 1.0}))],
        ),
        ("filter.sepia", 1, vec![("full", json!({"amount": 1.0}))]),
        (
            "filter.hueRotate",
            1,
            vec![
                ("q90", json!({"degrees": 90.0})),
                ("neg", json!({"degrees": -120.0})),
            ],
        ),
        (
            "filter.colorAdjust",
            1,
            vec![("gray+bright", json!({"grayscale": 0.6, "brightness": -0.2}))],
        ),
        (
            "filter.invert",
            1,
            vec![("strong", json!({"amount": 0.75}))],
        ),
        (
            "filter.sharpen",
            1,
            vec![("medium", json!({"amount": 0.6}))],
        ),
        (
            "filter.rgbSplit",
            1,
            vec![
                ("horizontal", json!({"distance":3.0/48.0})),
                ("diagonal", json!({"distance":4.0/48.0,"angle":30})),
            ],
        ),
        (
            "filter.directionalBlur",
            1,
            vec![
                ("horizontal", json!({"distance":5.0/48.0})),
                ("diagonal", json!({"distance":4.0/48.0,"angle":-45})),
            ],
        ),
        (
            "filter.outline",
            1,
            vec![
                ("white", json!({"radius":2.0/48.0})),
                (
                    "colored",
                    json!({"radius":3.0/48.0,"color":[0.2,0.7,1.0,0.6]}),
                ),
            ],
        ),
        ("filter.noise", 1, vec![("grain", json!({"amount": 0.8}))]),
        ("filter.vignette", 1, vec![("full", json!({"amount": 1.0}))]),
        (
            "filter.dropShadow",
            1,
            vec![(
                "soft",
                json!({
                    "radius": 2.0 / 48.0, "dx": 2.0 / 48.0, "dy": 2.0 / 48.0,
                    "color": [0.0, 0.0, 0.0, 0.5]
                }),
            )],
        ),
        (
            "filter.chromaKey",
            1,
            vec![(
                "green",
                json!({"color": [0.0, 1.0, 0.0, 1.0], "similarity": 0.4, "smoothness": 0.1}),
            )],
        ),
        (
            "filter.alphaThreshold",
            1,
            vec![
                ("hard", json!({"threshold": 0.6, "softness": 0.0})),
                ("soft", json!({"threshold": 0.6, "softness": 0.25})),
            ],
        ),
        (
            "filter.bloom",
            1,
            vec![
                (
                    "soft",
                    json!({"threshold": 0.5, "knee": 0.25, "radius": 6.0 / 48.0, "intensity": 1.5}),
                ),
                (
                    "wide-hard",
                    json!({"threshold": 0.3, "knee": 0.0, "radius": 13.0 / 48.0, "intensity": 3.0}),
                ),
            ],
        ),
        (
            "filter.grade",
            1,
            vec![
                (
                    "dawn-warm",
                    json!({"lift": 0.04, "gamma": 1.15, "gain": 1.3, "saturation": 1.2, "tint": 0.7, "shoulder": 0.6}),
                ),
                (
                    "moon-cold",
                    json!({"lift": -0.05, "gamma": 0.85, "gain": 0.9, "saturation": 0.6, "tint": -0.8}),
                ),
            ],
        ),
        (
            "filter.radialBlur",
            1,
            vec![
                ("center", json!({"strength": 0.3, "samples": 6})),
                (
                    "corner-strong",
                    json!({"cx": 0.2, "cy": 0.8, "strength": 0.6, "samples": 8}),
                ),
            ],
        ),
        (
            "filter.godRays",
            1,
            vec![
                (
                    "skylight-gold",
                    json!({"cx": 0.5, "cy": 0.0, "threshold": 0.3, "length": 0.6, "intensity": 2.0, "decay": 0.5, "tint": [1.0, 0.85, 0.55, 1.0]}),
                ),
                (
                    "offscreen-long",
                    json!({"cx": 1.4, "cy": -0.5, "threshold": 0.1, "length": 0.9, "intensity": 1.0, "decay": 0.0}),
                ),
            ],
        ),
        (
            "mask.shape",
            1,
            vec![
                (
                    "ellipse",
                    json!({"shape": "ellipse", "feather": 1.0 / 48.0}),
                ),
                (
                    "rounded",
                    json!({"shape": "roundedRect", "radius": 9.0 / 48.0}),
                ),
            ],
        ),
        (
            "mask.progress",
            1,
            vec![
                ("half", json!({"progress": 0.5})),
                ("half-inverted", json!({"progress": 0.5, "invert": true})),
            ],
        ),
        ("mask.image", 1, vec![("plain", json!({}))]),
        ("mask.luma", 1, vec![("inverted", json!({"invert": true}))]),
    ]
}

#[test]
fn every_strict_manifest_has_a_cpu_reference_kernel() {
    for manifest in builtin_registry().iter() {
        if manifest.determinism != Determinism::Strict {
            continue;
        }
        assert!(
            kernel_is_implemented(&manifest.kernel),
            "{} declares strict, but kernel {} has no CPU reference implementation",
            manifest.qualified(),
            manifest.kernel
        );
    }
}

#[test]
fn every_conformance_case_names_a_registered_effect() {
    for (id, version, list) in cases() {
        assert!(
            builtin_registry().get(id, version).is_some(),
            "conformance references unregistered {id}@{version}"
        );
        assert!(!list.is_empty(), "{id}@{version} has no case");
    }
}

/// Every executable strict effect (`composite.blend` is a table, not a pixel kernel) must
/// have at least one conformance case. Adding an effect without a fixture fails here.
#[test]
fn every_pixel_effect_is_covered_by_conformance() {
    let covered: std::collections::BTreeSet<String> = cases()
        .into_iter()
        .map(|(id, version, _)| format!("{id}@{version}"))
        .collect();
    for manifest in builtin_registry().iter() {
        if manifest.kernel == "porter-duff-separable" {
            continue; // The blend table is covered by the raster blend reference test
        }
        if manifest.domain == EffectDomain::Transition {
            continue; // Dual-surface transitions are covered by `every_surface_transition_is_covered_by_conformance`
        }
        assert!(
            covered.contains(&manifest.qualified()),
            "{} has no conformance case",
            manifest.qualified()
        );
    }
}

#[test]
fn cpu_reference_output_matches_the_conformance_fixtures() {
    let input_a = read_or_write_png(&fixtures().join("input-a.png"), make_input_a);
    let input_b = read_or_write_png(&fixtures().join("input-b.png"), make_input_b);
    let short_edge = f64::from(SIZE);

    for (id, version, list) in cases() {
        let manifest = builtin_registry().get(id, version).unwrap();
        let dir = fixtures().join(manifest.qualified());
        let effect = EffectRef::new(id, version);

        let mut uniforms_doc = Map::new();
        let mut expected_doc = Map::new();
        for (case, raw) in &list {
            let uniforms = uniforms_from_json(raw.as_object().unwrap());
            let output = if manifest.inputs == 2 {
                apply_image_mask(&effect, &uniforms, &input_a, &input_b).unwrap()
            } else {
                apply_filter(&effect, &uniforms, &input_a, short_edge).unwrap()
            };
            let fingerprint = format!("{:016x}", fnv1a64(output.data()));
            uniforms_doc.insert((*case).to_owned(), raw.clone());
            expected_doc.insert(
                (*case).to_owned(),
                json!({
                    "width": output.width(),
                    "height": output.height(),
                    "pixelFingerprint": fingerprint,
                }),
            );

            let png = dir.join(format!("expected-{case}.png"));
            if updating() {
                std::fs::create_dir_all(&dir).unwrap();
                std::fs::write(&png, output.encode_png().unwrap()).unwrap();
                continue;
            }
            let expected = Pixmap::decode_png(&std::fs::read(&png).unwrap_or_else(|error| {
                panic!(
                    "failed to read {}: {error}; regenerate with CCUT_UPDATE_GOLDEN=1",
                    png.display()
                )
            }))
            .unwrap();
            assert_eq!(
                expected.data(),
                output.data(),
                "{}/{case}: CPU reference output does not match the conformance fixture (fingerprint {fingerprint})",
                manifest.qualified()
            );
        }

        for (name, doc) in [
            ("uniforms.json", Value::Object(uniforms_doc)),
            ("expected.json", Value::Object(expected_doc)),
        ] {
            let path = dir.join(name);
            let mut text = serde_json::to_string_pretty(&doc).unwrap();
            text.push('\n');
            if updating() {
                std::fs::create_dir_all(&dir).unwrap();
                std::fs::write(&path, &text).unwrap();
            } else {
                let stored = std::fs::read_to_string(&path)
                    .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
                assert_eq!(stored, text, "{} does not match the current case table", path.display());
            }
        }
    }
}

/// `radius = 0` must be the identity transform: the branch that folds to “no effect” must be able to rely on this.
#[test]
fn a_zero_radius_blur_is_the_identity() {
    let input = make_input_a();
    let output = apply_filter(
        &EffectRef::new("filter.blur", 1),
        &UniformMap::new().with("radius", UniformValue::Scalar(0.0)),
        &input,
        f64::from(SIZE),
    )
    .unwrap();
    assert_eq!(input.data(), output.data());
}

/// Two runs must be bit-for-bit identical (the minimum bar for strict).
#[test]
fn cpu_reference_is_bitwise_repeatable() {
    let input = make_input_a();
    let effect = EffectRef::new("filter.dropShadow", 1);
    let uniforms = UniformMap::new()
        .with("radius", UniformValue::Scalar(2.0 / 48.0))
        .with("dx", UniformValue::Scalar(2.0 / 48.0))
        .with("dy", UniformValue::Scalar(2.0 / 48.0));
    let first = apply_filter(&effect, &uniforms, &input, f64::from(SIZE)).unwrap();
    let second = apply_filter(&effect, &uniforms, &input, f64::from(SIZE)).unwrap();
    assert_eq!(first.data(), second.data());
}

/// A single-input Filter pass has no second surface to use, so it must fail with a clear error rather than silently ignore it.
#[test]
fn a_two_input_mask_is_rejected_by_the_single_input_entry() {
    let error = apply_filter(
        &EffectRef::new("mask.image", 1),
        &UniformMap::new(),
        &make_input_a(),
        f64::from(SIZE),
    )
    .unwrap_err()
    .to_string();
    assert!(error.contains("effect-input-mismatch"), "{error}");
}

/// `box_blur_content` (bounding-box version) and `box_blur_premul_u8` (whole-frame version) must be byte-identical.
/// The reference implementation of `filter.blur@1` uses the former; the comment in `blur.rs` gives the proof, and
/// this test is its executable form. The radii cover both “content is a small fraction” and “triggers the half-frame whole-frame fallback”.
#[test]
fn the_bounded_blur_equals_the_full_frame_blur() {
    for radius in [1usize, 2, 3, 5, 8, 13] {
        let mut bounded = make_input_a();
        let mut full = make_input_a();
        render_raster::effects::box_blur_content(bounded.data_mut(), SIZE, SIZE, radius);
        render_raster::effects::box_blur_premul_u8(full.data_mut(), SIZE, SIZE, radius);
        assert_eq!(
            bounded.data(),
            full.data(),
            "radius={radius}: bounding-box blur and whole-frame blur differ"
        );
    }
}

/// Sparse content fixture: in a `WIDE × TALL` all-zero buffer, pixels are lit at random only within the `[rows] × [cols]` region
/// (seeded LCG, no external random source). Returns the buffer and the region containing the content.
fn sparse_frame(seed: u64) -> (Vec<u8>, std::ops::Range<usize>, std::ops::Range<usize>) {
    const WIDE: usize = 320;
    const TALL: usize = 180;
    let rows = 118..149;
    let cols = 37..262;
    let mut data = vec![0_u8; WIDE * TALL * 4];
    let mut state = seed | 1;
    let mut next = || {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (state >> 33) as u32
    };
    for y in rows.clone() {
        for x in cols.clone() {
            if next() % 5 != 0 {
                continue;
            }
            let alpha = (next() % 255 + 1) as u8;
            let offset = (y * WIDE + x) * 4;
            data[offset] = (u32::from(alpha) * (next() % 256) / 255) as u8;
            data[offset + 1] = (u32::from(alpha) * (next() % 256) / 255) as u8;
            data[offset + 2] = (u32::from(alpha) * (next() % 256) / 255) as u8;
            data[offset + 3] = alpha;
        }
    }
    (data, rows, cols)
}

/// Bounding-box scan over a bounded window: as long as the window is a superset of the content, the answer must equal the full-frame scan.
/// The caller (subtitle rendering) computes the window from layout geometry; this invariant is the entire basis for its willingness to skip the full-frame scan.
#[test]
fn a_windowed_alpha_bbox_matches_the_full_frame_scan() {
    const WIDE: usize = 320;
    const TALL: usize = 180;
    for seed in [1_u64, 7, 4242] {
        let (data, rows, cols) = sparse_frame(seed);
        let full = render_raster::effects::alpha_bbox(&data, WIDE, TALL).expect("content is not empty");
        for (label, window) in [
            (
                "full-frame window",
                render_raster::effects::ContentBox {
                    rows: 0..TALL,
                    cols: 0..WIDE,
                },
            ),
            (
                "tight superset",
                render_raster::effects::ContentBox {
                    rows: rows.start..rows.end,
                    cols: cols.start..cols.end,
                },
            ),
            (
                "expanded superset (out-of-bounds parts are clamped to the canvas by the implementation)",
                render_raster::effects::ContentBox {
                    rows: rows.start.saturating_sub(9)..rows.end + 400,
                    cols: cols.start.saturating_sub(31)..cols.end + 400,
                },
            ),
        ] {
            let windowed =
                render_raster::effects::alpha_bbox_within(&data, WIDE, TALL, &window).expect(label);
            assert_eq!(
                windowed, full,
                "seed={seed} {label}: windowed scan diverges from the full-frame scan"
            );
        }
    }
    // An empty window or an all-zero window must both return None, not a degenerate empty interval.
    let (data, rows, _) = sparse_frame(1);
    assert_eq!(
        render_raster::effects::alpha_bbox_within(
            &data,
            WIDE,
            TALL,
            &render_raster::effects::ContentBox {
                rows: 0..rows.start,
                cols: 0..WIDE,
            },
        ),
        None
    );
}

/// The “window scan → bounded blur” path must be byte-identical to the “full-frame scan → whole-frame blur” path.
/// Subtitle export has switched every frame's glow / transition blur over to the former path.
#[test]
fn the_windowed_blur_path_equals_the_full_frame_blur_path() {
    const WIDE: usize = 320;
    const TALL: usize = 180;
    for seed in [1_u64, 7, 4242] {
        for radius in [1_usize, 3, 9, 40] {
            let (mut windowed, rows, cols) = sparse_frame(seed);
            let (mut full, _, _) = sparse_frame(seed);
            let window = render_raster::effects::ContentBox {
                rows: rows.start.saturating_sub(9)..rows.end + 400,
                cols: cols.start.saturating_sub(31)..cols.end + 400,
            };
            let bounds =
                render_raster::effects::alpha_bbox_within(&windowed, WIDE, TALL, &window).unwrap();
            render_raster::effects::box_blur_bounded(
                &mut windowed,
                WIDE as u32,
                TALL as u32,
                radius,
                &bounds,
            );
            render_raster::effects::box_blur_premul_u8(&mut full, WIDE as u32, TALL as u32, radius);
            assert_eq!(
                windowed, full,
                "seed={seed} radius={radius}: windowed path diverges from the full-frame path"
            );
        }
    }
}

// ── Surface Transition (spec §9, design §11 “Golden frames”) ─────────────────

/// The sample points pinned by design §11. Endpoints `0` / `1` are also a hard conformance requirement:
/// the output must be **byte-identical** to `from` / `to`.
const PROGRESS: &[f64] = &[0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];

fn progress_case(progress: f64) -> String {
    format!("p{:03}", (progress * 100.0).round() as u32)
}

/// `(id, version, uniforms)`. Each transition gets a set of uniforms × seven progress values.
fn transition_cases() -> Vec<(&'static str, u32, Value)> {
    vec![
        ("transition.crossfade", 1, json!({})),
        ("transition.slide", 1, json!({"direction": "up"})),
        (
            "transition.wipe",
            1,
            json!({"direction": "right", "softness": 4.0 / 48.0}),
        ),
        (
            "transition.circleCrop",
            1,
            json!({"softness": 3.0 / 48.0, "cx": 0.5, "cy": 0.5}),
        ),
        (
            "transition.inkBlot",
            1,
            json!({"cx": 0.2, "cy": 0.3, "roughness": 0.1, "seed": 7}),
        ),
        (
            "transition.shatter",
            1,
            json!({"pieces": 24, "seed": 5, "cx": 0.4, "cy": 0.45, "force": 0.3, "gravity": 0.25}),
        ),
        (
            "transition.glitch",
            1,
            json!({"slices": 8, "amount": 0.15, "rgb": 0.06, "seed": 3}),
        ),
    ]
}

fn run_transition(id: &str, version: u32, uniforms: &UniformMap, progress: f64) -> Pixmap {
    apply_transition(
        &EffectRef::new(id, version),
        uniforms,
        &make_input_a(),
        &make_input_b(),
        progress as f32,
        f64::from(SIZE),
    )
    .unwrap()
}

/// Every registered `transition.*` must have a case; adding a recipe without a fixture fails.
#[test]
fn every_surface_transition_is_covered_by_conformance() {
    let covered: std::collections::BTreeSet<String> = transition_cases()
        .into_iter()
        .map(|(id, version, _)| format!("{id}@{version}"))
        .collect();
    for manifest in builtin_registry().in_domain(EffectDomain::Transition) {
        assert!(
            covered.contains(&manifest.qualified()),
            "{} has no conformance case",
            manifest.qualified()
        );
    }
    assert!(!covered.is_empty());
}

/// **Endpoint discipline** (spec §9): `progress = 0` is byte-equal to `from`, and `= 1` is equal to `to`.
/// Not “looks the same”: it is the same byte sequence.
#[test]
fn progress_zero_is_from_and_progress_one_is_to() {
    let (from, to) = (make_input_a(), make_input_b());
    for (id, version, raw) in transition_cases() {
        let manifest = builtin_registry().get(id, version).unwrap();
        // Every uniform combination must pass, not just the defaults: softness / invert / direction
        // must not move the endpoints either.
        let variants = [
            raw.clone(),
            json!({}),
            match manifest.params.contains_key("invert") {
                true => json!({"invert": true}),
                false => json!({}),
            },
        ];
        for variant in variants {
            let uniforms = uniforms_from_json(variant.as_object().unwrap());
            let start = run_transition(id, version, &uniforms, 0.0);
            assert_eq!(start.data(), from.data(), "{id}@{version} {variant}: p=0");
            let end = run_transition(id, version, &uniforms, 1.0);
            assert_eq!(end.data(), to.data(), "{id}@{version} {variant}: p=1");
        }
    }
}

/// Monotonically advancing progress must produce **pairwise distinct** frames. A “recipe registered but does nothing” fails here.
#[test]
fn monotonic_progress_yields_distinct_frames() {
    for (id, version, raw) in transition_cases() {
        let uniforms = uniforms_from_json(raw.as_object().unwrap());
        let mut seen: std::collections::BTreeMap<u64, f64> = std::collections::BTreeMap::new();
        for progress in PROGRESS {
            let output = run_transition(id, version, &uniforms, *progress);
            let hash = fnv1a64(output.data());
            if let Some(previous) = seen.insert(hash, *progress) {
                panic!("{id}@{version}: progress {previous} and {progress} produce the same output");
            }
        }
    }
}

/// **Seekable**: sampling in random order must be byte-identical to sampling in sequence (one of the properties in design §11).
/// Transitions must not hold an incremental clock.
#[test]
fn transitions_are_seek_safe() {
    for (id, version, raw) in transition_cases() {
        let uniforms = uniforms_from_json(raw.as_object().unwrap());
        let sorted: Vec<Vec<u8>> = PROGRESS
            .iter()
            .map(|progress| {
                run_transition(id, version, &uniforms, *progress)
                    .data()
                    .to_vec()
            })
            .collect();
        // A fixed “shuffled” order: no random source is introduced, but the order differs from the one above.
        let shuffled = [3usize, 0, 6, 2, 5, 1, 4];
        let mut out = vec![Vec::new(); PROGRESS.len()];
        for index in shuffled {
            out[index] = run_transition(id, version, &uniforms, PROGRESS[index])
                .data()
                .to_vec();
        }
        assert_eq!(sorted, out, "{id}@{version}: out-of-order sampling differs from sequential sampling");
    }
}

/// Values outside the closed interval must error rather than being silently clamped; the domain of `progress` is part of the contract.
#[test]
fn progress_outside_the_closed_interval_is_refused() {
    for progress in [-0.01f32, 1.01] {
        let error = apply_transition(
            &EffectRef::new("transition.crossfade", 1),
            &UniformMap::new(),
            &make_input_a(),
            &make_input_b(),
            progress,
            f64::from(SIZE),
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("preset-param-invalid"), "{error}");
    }
}

/// Must error when the two inputs have different sizes (the manifest declares `resizeMode: same-as-input`).
#[test]
fn mismatched_input_sizes_are_refused() {
    let small = Pixmap::new(SIZE / 2, SIZE).unwrap();
    let error = apply_transition(
        &EffectRef::new("transition.crossfade", 1),
        &UniformMap::new(),
        &make_input_a(),
        &small,
        0.5,
        f64::from(SIZE),
    )
    .unwrap_err()
    .to_string();
    assert!(error.contains("effect-capability-unsupported"), "{error}");
}

#[test]
fn surface_transition_output_matches_the_conformance_fixtures() {
    for (id, version, raw) in transition_cases() {
        let manifest = builtin_registry().get(id, version).unwrap();
        let dir = fixtures().join(manifest.qualified());
        let uniforms = uniforms_from_json(raw.as_object().unwrap());

        let mut expected_doc = Map::new();
        for progress in PROGRESS {
            let case = progress_case(*progress);
            let output = run_transition(id, version, &uniforms, *progress);
            let fingerprint = format!("{:016x}", fnv1a64(output.data()));
            expected_doc.insert(
                case.clone(),
                json!({
                    "width": output.width(),
                    "height": output.height(),
                    "pixelFingerprint": fingerprint,
                }),
            );

            let png = dir.join(format!("expected-{case}.png"));
            if updating() {
                std::fs::create_dir_all(&dir).unwrap();
                std::fs::write(&png, output.encode_png().unwrap()).unwrap();
                continue;
            }
            let stored = Pixmap::decode_png(&std::fs::read(&png).unwrap_or_else(|error| {
                panic!(
                    "failed to read {}: {error}; regenerate with CCUT_UPDATE_GOLDEN=1",
                    png.display()
                )
            }))
            .unwrap();
            assert_eq!(
                stored.data(),
                output.data(),
                "{}/{case}: CPU reference does not match the conformance fixture (fingerprint {fingerprint})",
                manifest.qualified()
            );
        }

        for (name, doc) in [
            (
                "uniforms.json",
                json!({ "params": raw.clone(), "progress": PROGRESS }),
            ),
            ("expected.json", Value::Object(expected_doc)),
        ] {
            let path = dir.join(name);
            let mut text = serde_json::to_string_pretty(&doc).unwrap();
            text.push('\n');
            if updating() {
                std::fs::create_dir_all(&dir).unwrap();
                std::fs::write(&path, &text).unwrap();
            } else {
                let stored = std::fs::read_to_string(&path)
                    .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
                assert_eq!(stored, text, "{} does not match the current case table", path.display());
            }
        }
    }
}
