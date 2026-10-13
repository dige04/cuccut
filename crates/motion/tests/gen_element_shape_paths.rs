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
//! cargo test -p ccut-motion --test gen_element_shape_paths -- --ignored
//! # gate: compare only, no writing to disk
//! cargo test -p ccut-motion --test gen_element_shape_paths
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
    assert!(value.is_finite(), "配方里出现了非有限数 {value}");
    assert!(
        (-0.5..=1.5).contains(&value),
        "归一化轮廓的点应当在 0..1 附近，出现了 {value}"
    );
    let text = format!("{value:?}");
    let round_trip: f64 = text.parse().expect("emitted double must parse");
    assert_eq!(
        round_trip.to_bits(),
        value.to_bits(),
        "{text} 不是 {value} 的往返表示"
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
        "outline 配方份数变了——同步 FROZEN_OUTLINES 与两端的目录测试"
    );
    rows.into_iter()
        .map(|recipe| {
            let ShapePath::Outline { segments } = &recipe.shape().expect("shape body").path else {
                unreachable!("上面已经筛过 outline")
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
// Regenerate with `cargo test -p ccut-motion --test gen_element_shape_paths --
// --ignored` after changing a manifest under `core/presets/builtin/shape/`. The
// same run rewrites the other twin: `designs/cuccut/app/model-shape-paths.js`.
//! 形状目录里 **`outline` 类**的归一化几何表（设计 §7 / §13 P7b-client）。
//!
//! 目录的参数化三类（`rect` / `ellipse` / `segment`）由各自的参数画出，不在这
//! 张表里；{count} 份 `outline` 配方是显式点列，就是这里。点是**元素盒 0..1
//! 归一化**坐标（左上原点），与 `ccut_motion::preset_registry::PathSegment`
//! 的存法、`ccut-timeline-render` 的 `outline_path` 的读法逐字同一口径，所以
//! App 的选择器缩略图、原型和导出用同一条映射：
//!
//! ```text
//! x = box.x + box.w * px,  y = box.y + box.h * py
//! ```
//!
//! **舞台上真正的每一帧不读这张表**——那条路走内核（`ccut-timeline-render`），
//! 预览与导出因此同源。读它的是形状选择器的缩略图：那是 GPUI 自己描的路径，
//! 与内核是两条路，正如原型的 canvas 2D。
//!
//! 加一个形状 = 加一份 manifest 再跑一次生成器，**永远不是**手改下面某个点，
//! 也永远不是在渲染器里写 `match`。

/// 一段归一化轮廓：verb 用 manifest 的拼写，`pts` 是**展平**的坐标
/// （`[x, y]` / `[cx, cy, x, y]` / `[c1x, c1y, c2x, c2y, x, y]` / 空）。
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ShapePathSeg {{
    pub verb: &'static str,
    pub pts: &'static [f64],
}}

/// 目录顺序（各 manifest 的 `order`）——查表本身没有顺序，选择器要按这个排。
#[rustfmt::skip]
pub const IDS: [&str; {count}] = [
    {ids},
];

/// id → 归一化轮廓。行序同 [`IDS`]。
#[rustfmt::skip]
pub const OUTLINES: [(&str, &[ShapePathSeg]); {count}] = [
{rows}];

/// 查一份轮廓。`None` = 这个 id 不是 outline 形状（`rect` / `ellipse` /
/// `line` / `arrow`，或这份构建不认识的名字）——调用方按自己的方式画，而不是
/// 什么都不画。
pub fn segments(id: &str) -> Option<&'static [ShapePathSeg]> {{
    OUTLINES
        .iter()
        .find(|(name, _)| *name == id)
        .map(|(_, segments)| *segments)
}}

/// 归一化点 → 盒内点。唯一的映射实现，免得每个描点处各写一遍。
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
    assert!(normalised.is_finite(), "配方里出现了非有限数 {normalised}");
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
        "{text} 丢了 {normalised} 的精度——配方的小数位超过了六位"
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
        r#"/* @generated by core/crates/ccut-motion/tests/gen_element_shape_paths.rs —— 不要手改。
   改了 `core/presets/builtin/shape/` 下的 manifest 就跑
   `cargo test -p ccut-motion --test gen_element_shape_paths -- --ignored`，
   同一次写盘还会重写另一份孪生：
   `core/crates/ccut-editor-core/src/shape_paths.rs`。

   形状目录里 **`outline` 类**的 {count} 份几何（设计 §7 / §13 P7b-client）。
   目录的参数化三类（`rect` / `ellipse` / `segment`）由各自的参数画出，不在这张表里。

   **这是逐点落下的原始路径**，不是照名字重画的
   （见 `docs/design/bcf/ccut-element-render-foundation-design.md` §13 P7a）。
   于是好几个 id 与它画出来的东西对不上——`squig2` 是块状右箭头、`tick2` 是叉、
   `cross`/`cross2` 都是加号、`sharp2` 是对话气泡、`chevron` 是向下的 V。
   **那是原名，不是移植错误**：id 逐字沿用原名，显示名照画面取
   （`model-elements.js` 的 `SHAPE_NAMES`）。想「修好」某一格的几何 = 让原型与核心
   两处的画布同时对不上。

   坐标在 **0..100** 视框里，因为原型画形状用的是 `<svg viewBox>` 缩放，不像另一份
   生成物那样由消费者自己做 `x = box.x + box.w * px`。*/
window.BC_SHAPE = (() => {{

  /* 目录顺序（各 manifest 的 `order`）——查表本身没有顺序 */
  const IDS = Object.freeze([
    {ids},
  ]);

  /* id → 0..100 视框里的 SVG `d` */
  const D = Object.freeze({{
{rows}  }});

  /* 查一条路径。`null` = 这个 id 不是 outline 形状（`rect` / `ellipse` / `line` /
     `arrow`），调用方按自己的方式画，而不是画一个空的 `<path>` */
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
#[ignore = "写盘：cargo test -p ccut-motion --test gen_element_shape_paths -- --ignored"]
fn emit_element_shape_paths() {
    for (relative, text) in generated_outputs() {
        let path = output_path(relative);
        std::fs::write(&path, text).expect("写入形状几何表");
        eprintln!("wrote {}", path.display());
    }
}

/// Daily gate: both generated outputs must match the registry byte for byte. If the manifest was changed without running the generator, this goes red.
#[test]
#[ignore = "对拍 v2 的生成物 ccut-editor-core/src/shape_paths.rs 与 designs/cuccut/app/model-shape-paths.js：待 ccut-editor-core 移植"]
fn element_shape_paths_are_up_to_date() {
    for (relative, text) in generated_outputs() {
        let path = output_path(relative);
        let on_disk = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("读取 {} 失败：{err}", path.display()));
        assert_eq!(
            on_disk,
            text,
            "{} 与形状配方不同步——跑 cargo test -p ccut-motion --test gen_element_shape_paths -- --ignored",
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
            "{} 的 outline 归属与生成表不一致",
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
            "{id} 的轮廓没有以 move 开头"
        );
    }
}
