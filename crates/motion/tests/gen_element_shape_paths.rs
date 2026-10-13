//! Generator for `core/crates/ccut-editor-core/src/shape_paths.rs` and `designs/cuccut/app/model-shape-paths.js`: the **normalized geometry table** of 20 `outline` shape recipes (design §13 P7a note ①, landed by P7b-client).
//!
//! Why codegen rather than a fixture: `gen_element_catalogue.rs` emits a **contract fixture** (read at test time and compared line by line) because the consumer of that table is the property panel, which only needs "which class of geometry this is". Geometry **point lists** are different: they are **runtime rendering data**, which product code reads on every frame drawn. On the prototype side, the `<script>` manifest is opened via `file://`, so fetching a JSON would be blocked by CORS. Therefore it is a generated source file, not a shared JSON: **the same generator, the same write to disk**, so the two ends can never drift apart separately.
//!
//! App v2 (`apps/cuccut`) consumes this table through `ccut-editor-core` (M4 B0). When it **draws each frame** it goes through the kernel (`outline_path` of `ccut-timeline-render`) and does not need this table. What needs it is B3's shape picker: those 24 thumbnails are paths GPUI draws itself, in the same situation as the prototype's canvas 2D. So the generated output lives in the pure layer (which does not know about gpui), and the `ui/` side traces it into GPUI's `Path` via `x = box.x + box.w * px`.
//!
//! `designs/cuccut` is the second consumer (round 60.2). It previously had **its own hand-drawn geometry** (24 `d=` traced by eye from screenshots in round 39), so the same id drew as two different things in the prototype and in the core. The second generated output exists to end that twinning. It emits not 0..1 point lists but a **`d=` string within a 0..100 viewbox**, because the prototype draws shapes by scaling through `<svg viewBox>`, rather than the consumer mapping each point as on the other side.
//!
//! The segment table's expression is consistent down to field names: `{verb, pts}`, with verb in the manifest's spelling (`move` / `line` / `quad` / `cubic` / `close`). Points are **normalized element-box 0..1** coordinates (origin top-left), in the same convention as `motion::preset_registry::PathSegment` and `outline_path` of `ccut-timeline-render`. Consumers (GPUI's `Path`, the prototype's canvas 2D point tracing) only do the linear mapping `x = box.x + box.w * px`.
//!
//! How to run (`#[ignore]`; daily `cargo test` does not write to disk):
//!
//! ```sh
//! # write to disk (both ends)
//! cargo test -p motion --test gen_element_shape_paths -- --ignored
//! # gate: compare only, no writing to disk
//! cargo test -p motion --test gen_element_shape_paths
//! ```
//!
//! **Only `outline` is emitted.** The geometry of the `rect` / `ellipse` / `segment` kinds is **parameterized** (the box itself, the inscribed ellipse, the two endpoints of `ShapeProps`). Both ends already draw them on their own, and spreading them into point lists too would only add one more unread table to the 4 recipes.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use motion::preset_registry::{CatalogueRecipe, PathSegment, ShapePath, timeline_shapes};

/// P7a freeze: exactly 20 of the 24 shape recipes are `outline`. The generator does not decide for anyone: adding a new outline recipe means either changing this place, or it was a missed sync.
const FROZEN_OUTLINES: usize = 20;

const RUST_OUTPUT: &str = "../ccut-editor-core/src/shape_paths.rs";
const DESIGNS_OUTPUT: &str = "../../../designs/cuccut/app/model-shape-paths.js";

fn output_path(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join(relative)
}

// ── double emission ──────────────────────────────────────────────────────

/// Shortest round-trip decimal, and on the spot verify that parsing it back gives bit-identical values (same as `gen_anim_presets.rs`).
/// Rust and JS numeric literal syntax coincide on this subset, so one function emits for both.
fn double(value: f64) -> String {
    assert!(value.is_finite(), "a recipe contains a non-finite number {value}");
    assert!(
        (-0.5..=1.5).contains(&value),
        "normalized outline points should be near 0..1, got {value}"
    );
    let text = format!("{value:?}");
    let round_trip: f64 = text.parse().expect("emitted double must parse");
    assert_eq!(
        round_trip.to_bits(),
        value.to_bits(),
        "{text} is not a round-trip representation of {value}"
    );
    text
}

// ── segment table ────────────────────────────────────────────────────────────

/// A segment's verb name and its **flattened** coordinates (`[x, y]` / `[cx, cy, x, y]` / …).
/// Flattening is deliberate: both ends' consumers are positional-argument calls like `ctx.bezierCurveTo(...pts)`, and nesting one more level of point pairs would add an unpacking step at every call site.
fn flatten(segment: &PathSegment) -> (&'static str, Vec<f64>) {
    match segment {
        PathSegment::Move(p) => ("move", vec![p[0], p[1]]),
        PathSegment::Line(p) => ("line", vec![p[0], p[1]]),
        PathSegment::Quad(c, p) => ("quad", vec![c[0], c[1], p[0], p[1]]),
        PathSegment::Cubic(a, b, p) => ("cubic", vec![a[0], a[1], b[0], b[1], p[0], p[1]]),
        PathSegment::Close => ("close", Vec::new()),
    }
}

/// Catalogue order = the manifest's `order` (the panel dropdown order). Equal orders fall back to id, the same sort as `gen_element_catalogue.rs`, so the generated row order matches the fixture.
fn outline_rows() -> Vec<(&'static str, &'static [PathSegment])> {
    let mut rows: Vec<&CatalogueRecipe> = timeline_shapes()
        .iter()
        .filter(|recipe| {
            matches!(
                recipe.shape().map(|body| &body.path),
                Some(ShapePath::Outline { .. })
            )
        })
        .collect();
    rows.sort_by(|a, b| a.order.cmp(&b.order).then_with(|| a.id.cmp(&b.id)));
    assert_eq!(
        rows.len(),
        FROZEN_OUTLINES,
        "the number of outline recipes changed: update FROZEN_OUTLINES and the catalogue tests on both ends"
    );
    rows.into_iter()
        .map(|recipe| {
            let ShapePath::Outline { segments } = &recipe.shape().expect("shape body").path else {
                unreachable!("filtered to outline above")
            };
            (recipe.id.as_str(), segments.as_slice())
        })
        .collect()
}

// ── Rust（App v2） ──────────────────────────────────────────────────

fn rust_rows() -> String {
    let mut out = String::new();
    for (id, segments) in outline_rows() {
        let _ = writeln!(out, "    (\"{id}\", &[");
        for segment in segments {
            let (verb, pts) = flatten(segment);
            let numbers: Vec<String> = pts.into_iter().map(double).collect();
            let _ = writeln!(
                out,
                "        ShapePathSeg {{ verb: \"{verb}\", pts: &[{}] }},",
                numbers.join(", ")
            );
        }
        let _ = writeln!(out, "    ]),");
    }
    out
}

fn rust_ids() -> String {
    let quoted: Vec<String> = outline_rows()
        .into_iter()
        .map(|(id, _)| format!("\"{id}\""))
        .collect();
    let mut out = String::new();
    for (index, item) in quoted.iter().enumerate() {
        if index > 0 {
            if index % 5 == 0 {
                out.push_str(",\n    ");
            } else {
                out.push_str(", ");
            }
        }
        out.push_str(item);
    }
    out
}

fn render_rust() -> String {
    format!(
        r##"// @generated by core/crates/ccut-motion/tests/gen_element_shape_paths.rs — DO NOT EDIT.
// Regenerate with `cargo test -p motion --test gen_element_shape_paths --
// --ignored` after changing a manifest under `core/presets/builtin/shape/`. The
// same run rewrites the other twin: `designs/cuccut/app/model-shape-paths.js`.
//! Normalized geometry of the **`outline` class** in the shape catalogue (design §7 / §13 P7b-client).
//!
//! The catalogue's three parametric classes (`rect` / `ellipse` / `segment`) are drawn from their own parameters and are not
//! in this table; the {count} `outline` recipes are explicit point lists, and they live here. Points are **element-box 0..1
//! normalized** coordinates (top-left origin), stored exactly as `ccut_motion::preset_registry::PathSegment` stores them and
//! read exactly as `outline_path` in `ccut-timeline-render` reads them, so the app's picker thumbnails, the prototype and the
//! export use the same mapping:
//!
//! ```text
//! x = box.x + box.w * px,  y = box.y + box.h * py
//! ```
//!
//! **The frames actually drawn on stage never read this table**: they go through the engine (`ccut-timeline-render`),
//! so preview and export share one source. What reads it is the shape picker's thumbnails, paths drawn by the UI itself,
//! a path separate from the engine, like the prototype's canvas 2D.
//!
//! Adding a shape = adding a manifest and running the generator again, **never** editing a point below by hand,
//! and never writing a `match` in the renderer.

/// One normalized outline segment: `verb` is spelled as in the manifest, `pts` are the **flattened** coordinates
/// (`[x, y]` / `[cx, cy, x, y]` / `[c1x, c1y, c2x, c2y, x, y]` / empty).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ShapePathSeg {{
    pub verb: &'static str,
    pub pts: &'static [f64],
}}

/// Catalogue order (each manifest's `order`): the lookup table itself has no order, and the picker sorts by this.
#[rustfmt::skip]
pub const IDS: [&str; {count}] = [
    {ids},
];

/// id → normalized outline. Rows are in the order of [`IDS`].
#[rustfmt::skip]
pub const OUTLINES: [(&str, &[ShapePathSeg]); {count}] = [
{rows}];

/// Looks up an outline. `None` = this id is not an outline shape (`rect` / `ellipse` /
/// `line` / `arrow`, or a name this build does not know): the caller draws it its own way rather than
/// drawing nothing.
pub fn segments(id: &str) -> Option<&'static [ShapePathSeg]> {{
    OUTLINES
        .iter()
        .find(|(name, _)| *name == id)
        .map(|(_, segments)| *segments)
}}

/// Normalized point → point in the box. The only implementation of the mapping, so each place that draws does not write its own.
pub fn map_point(px: f64, py: f64, x: f32, y: f32, w: f32, h: f32) -> (f32, f32) {{
    (x + w * px as f32, y + h * py as f32)
}}
"##,
        count = FROZEN_OUTLINES,
        ids = rust_ids(),
        rows = rust_rows(),
    )
}

// ── SVG d (designs/cuccut prototype) ────────────────────────────────────

/// Normalized coordinate → an SVG number within the prototype viewbox (0..100).
///
/// The first three generated outputs emit 0..1 point lists, because their consumers do the `x = box.x + box.w * px` mapping themselves. This one emits a `d=` string: the prototype's shape is `<svg viewBox="-6 -6 112 112"><path d=…>`, scaling is handled by the viewBox, so the path itself must already lie within 0..100.
///
/// Four decimal places are not a trade-off: the manifest stores six-decimal normalized values, which after ×100 are exactly four decimals. The assertion guards this. If someone later writes a seventh decimal into a recipe, this goes red rather than silently losing precision.
fn svg_number(normalised: f64) -> String {
    assert!(normalised.is_finite(), "a recipe contains a non-finite number {normalised}");
    let scaled = normalised * 100.0;
    let mut text = format!("{scaled:.4}");
    if text.contains('.') {
        text = text.trim_end_matches('0').trim_end_matches('.').to_string();
    }
    if text == "-0" {
        text = String::from("0");
    }
    let round_trip: f64 = text.parse().expect("emitted svg number must parse");
    assert!(
        (round_trip / 100.0 - normalised).abs() <= 1e-9,
        "{text} lost precision of {normalised}: the recipe has more than six decimal places"
    );
    text
}

/// One outline → one `d=`. Verbs map one-to-one to SVG commands, all using absolute coordinates. No `H`/`V`/`S`-style abbreviations: the few bytes saved are not worth a second way of reading it.
fn svg_d(segments: &[PathSegment]) -> String {
    let mut out = String::new();
    let n = |p: &[f64; 2]| format!("{} {}", svg_number(p[0]), svg_number(p[1]));
    for segment in segments {
        match segment {
            PathSegment::Move(p) => {
                let _ = write!(out, "M{}", n(p));
            }
            PathSegment::Line(p) => {
                let _ = write!(out, "L{}", n(p));
            }
            PathSegment::Quad(c, p) => {
                let _ = write!(out, "Q{} {}", n(c), n(p));
            }
            PathSegment::Cubic(a, b, p) => {
                let _ = write!(out, "C{} {} {}", n(a), n(b), n(p));
            }
            PathSegment::Close => out.push('Z'),
        }
    }
    out
}

fn designs_rows() -> String {
    let mut out = String::new();
    for (id, segments) in outline_rows() {
        let _ = writeln!(out, "    {id}: '{}',", svg_d(segments));
    }
    out
}

fn designs_ids() -> String {
    let quoted: Vec<String> = outline_rows()
        .into_iter()
        .map(|(id, _)| format!("'{id}'"))
        .collect();
    let mut out = String::new();
    for (index, item) in quoted.iter().enumerate() {
        if index > 0 {
            if index % 5 == 0 {
                out.push_str(",\n    ");
            } else {
                out.push_str(", ");
            }
        }
        out.push_str(item);
    }
    out
}

fn render_designs() -> String {
    format!(
        r#"/* @generated by core/crates/ccut-motion/tests/gen_element_shape_paths.rs — DO NOT EDIT.
   After changing a manifest under `core/presets/builtin/shape/`, run
   `cargo test -p motion --test gen_element_shape_paths -- --ignored`;
   the same run rewrites the other twin:
   `core/crates/ccut-editor-core/src/shape_paths.rs`.

   The {count} geometries of the **`outline` class** in the shape catalogue (design §7 / §13 P7b-client).
   The catalogue's three parametric classes (`rect` / `ellipse` / `segment`) are drawn from their own parameters and are not in this table.

   **These are the original paths, copied point by point**, not redrawn from the names
   (see `docs/design/bcf/ccut-element-render-foundation-design.md` §13 P7a).
   So several ids do not match what they draw: `squig2` is a block right arrow, `tick2` is a cross,
   `cross`/`cross2` are both plus signs, `sharp2` is a speech bubble, `chevron` is a downward V.
   **Those are the original names, not porting mistakes**: ids keep the original names verbatim, and display names follow the
   drawing (`SHAPE_NAMES` in `model-elements.js`). "Fixing" one cell's geometry = making the prototype's and the core's
   canvases disagree at once.

   Coordinates are in a **0..100** viewbox, because the prototype scales shapes with `<svg viewBox>`, unlike the other
   generated output, whose consumers do `x = box.x + box.w * px` themselves.*/
window.BC_SHAPE = (() => {{

  /* Catalogue order (each manifest's `order`): the lookup table itself has no order */
  const IDS = Object.freeze([
    {ids},
  ]);

  /* id → SVG `d` in the 0..100 viewbox */
  const D = Object.freeze({{
{rows}  }});

  /* Looks up a path. `null` = this id is not an outline shape (`rect` / `ellipse` / `line` /
     `arrow`): the caller draws it its own way rather than drawing an empty `<path>` */
  const d = (id) => (Object.prototype.hasOwnProperty.call(D, id) ? D[id] : null);

  return {{IDS, D, d}};
}})();
"#,
        count = FROZEN_OUTLINES,
        ids = designs_ids(),
        rows = designs_rows(),
    )
}

// ── write to disk and gate ──────────────────────────────────────────────────

/// Writing and gating both generated outputs share the same manifest. Adding a consumer only changes one line here.
fn generated_outputs() -> [(&'static str, String); 2] {
    [
        (RUST_OUTPUT, render_rust()),
        (DESIGNS_OUTPUT, render_designs()),
    ]
}

/// Rewrites both generated outputs when the geometry changes.
///
/// `#[ignore]` is deliberate: the daily `cargo test` should not write to the product directory.
#[test]
#[ignore = "writes to disk: cargo test -p motion --test gen_element_shape_paths -- --ignored"]
fn emit_element_shape_paths() {
    for (relative, text) in generated_outputs() {
        let path = output_path(relative);
        std::fs::write(&path, text).expect("write the shape geometry table");
        eprintln!("wrote {}", path.display());
    }
}

/// Daily gate: both generated outputs must match the registry byte for byte. If the manifest was changed without running the generator, this goes red.
#[test]
#[ignore = "compares the generated ccut-editor-core/src/shape_paths.rs and designs/cuccut/app/model-shape-paths.js: waiting for the ccut-editor-core port"]
fn element_shape_paths_are_up_to_date() {
    for (relative, text) in generated_outputs() {
        let path = output_path(relative);
        let on_disk = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("reading {} failed: {err}", path.display()));
        assert_eq!(
            on_disk,
            text,
            "{} is out of sync with the shape recipes: run cargo test -p motion --test gen_element_shape_paths -- --ignored",
            path.display()
        );
    }
}

/// The generated table covers exactly "all outline shapes in the registry", neither more nor fewer. This is the precondition for the three ends' scene layers to enable the `outline` gate (a missing recipe means a dropdown item that cannot be drawn).
#[test]
fn every_outline_recipe_has_geometry() {
    let rows = outline_rows();
    let rust = render_rust();
    let designs = render_designs();
    for recipe in timeline_shapes() {
        let body = recipe.shape().expect("shape body");
        let is_outline = matches!(body.path, ShapePath::Outline { .. });
        assert_eq!(
            is_outline,
            rows.iter().any(|(id, _)| *id == recipe.id),
            "{}: whether it is an outline disagrees with the generated table",
            recipe.id
        );
        if is_outline {
            assert!(
                rust.contains(&format!("\n    (\"{}\", &[", recipe.id)),
                "{}",
                recipe.id
            );
            assert!(
                designs.contains(&format!("\n    {}: 'M", recipe.id)),
                "{}",
                recipe.id
            );
        }
    }
    // Each recipe's first segment must be `move` (already verified at parse time), so consumers need not defend against it.
    for (id, segments) in rows {
        assert!(
            matches!(segments.first(), Some(PathSegment::Move(_))),
            "{id}: the outline does not start with move"
        );
    }
}
