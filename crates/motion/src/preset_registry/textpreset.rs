//! Text preset packs (`core/presets/builtin/textpreset/*.json`): the **fourth** recipe shape of the registry,
//! the core-side contract of `docs/design/app-v2/text-pane-and-groups.md` §6.2.
//!
//! Alongside the existing three: [`super::frozen`] (the four dedicated frozen paths),
//! [`super::manifest`] (the general animation manifest), and [`super::catalogue`] (the shape /
//! sticker / visualizer / progress shape library).
//!
//! **Why not reuse `parse_catalogue`**: a catalogue recipe describes **one** way of drawing one kind (one recipe ↔ one `ShapeProps.shape` value); a text preset describes **a group** of arranged elements: 1..5 text / shape items, each with coordinates, style, entry stagger and animation. That is a scene template, not a drawing method, and forcing it into `CatalogueBody` would require inventing a fake body.
//!
//! What is reused is the **discipline**: the `builtin!` + `include_str!` list, a one-time `OnceLock` `build()`, `(id, version)` + `manifest_hash` freezing, and catalogue consistency guarded by `tests/manifests.rs`.
//!
//! ## Three contracts (changing this means changing the contract)
//!
//! 1. **Content items are the element payload itself** (`kind` / `place` / `text` / `style` / `shape` / `animate`). Field names align one-to-one with `ccut_timeline::schema::Element`, and [`instantiate`] only adds `start` / `end`. This way, an element landed by a preset and an element written with a hand-written `addElement` cannot take two different shapes.
//! 2. **Units are converted at generation time**: `place.x/y` is a percentage of the frame, `style.fontSize` is pixels on a reference short side of 540, and `place.rot` is an angle. There is no second set of units at runtime.
//! 3. **Animation names and shape names are checked against the registry at parse time**: `enter` looks up `timeline.enter.*`, `exit` looks up `timeline.exit.*`, and `shape.shape` looks up the shape catalogue. The document-level exit closed set (`EXIT_PRESETS` ∪ `EXIT_LEGACY_PRESETS`) still reads names such as `pop` / `blurIn` from 0.1 documents for compatibility, even though they have **no exit recipe** (`lower_timeline::effective_exit` treats them as no exit). Presets are built-in data, so a slot that is "legal but does not move" must not be allowed. That is why this validates against the recipe table, stricter than the document layer.
//!
//! **The reference tables are passed in by the caller; parse time never queries `data()`**: the preset tables are built inside `build()`, when the `OnceLock` is not yet fully initialized, so any `data()` call would be re-entrant. `get_or_init` on re-entry **deadlocks** rather than returning an error.

use serde_json::{Map, Value};

use crate::MotionError;

use super::catalogue::CatalogueRecipe;
use super::frozen::{LoopRecipe, SlotRecipe};
use super::json::{field, number, text, version};

/// The three tables checked at parse time. All are passed in by the caller (`preset_registry::build`);
/// see "the reference tables are passed in by the caller" in the module header.
#[derive(Clone, Copy)]
pub struct TextPresetTables<'a> {
    pub shapes: &'a [CatalogueRecipe],
    pub enter: &'a [SlotRecipe],
    pub exit: &'a [SlotRecipe],
    pub loops: &'a [LoopRecipe],
}

/// Panel category (closed set). Order is the order of the chip row.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum TextPresetCategory {
    Simple,
    Title,
    LowerThird,
    Other,
}

impl TextPresetCategory {
    pub const ALL: [Self; 4] = [Self::Simple, Self::Title, Self::LowerThird, Self::Other];

    /// Value of the JSON `category` field, which is also the UI's lookup key.
    pub const fn key(self) -> &'static str {
        match self {
            Self::Simple => "simple",
            Self::Title => "title",
            Self::LowerThird => "lowerThird",
            Self::Other => "other",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.key() == value)
    }
}

/// Element type of a content item (closed set).
///
/// The first batch has only these two: `text` is the lead, and `shape` carries the color blocks / dots / arrows from the catalogue (in CucCut's kind closed set this is a parameterized shape, drawn directly as vector).
/// Image-type content items are **not** in the first batch: they need a material asset distributed with the package, which is a separate pipeline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextPresetItemKind {
    Text,
    Shape,
}

impl TextPresetItemKind {
    pub const fn key(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Shape => "shape",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        match value {
            "text" => Some(Self::Text),
            "shape" => Some(Self::Shape),
            _ => None,
        }
    }
}

/// One content item.
#[derive(Clone, Debug, PartialEq)]
pub struct TextPresetItem {
    pub kind: TextPresetItemKind,
    /// Entry stagger relative to the preset start (seconds, ≥ 0).
    pub delay: f64,
    /// Element payload: an object validated at parse time, **not containing** `start` / `end` / `id`.
    pub element: Value,
}

/// One text preset.
#[derive(Clone, Debug, PartialEq)]
pub struct TextPresetRecipe {
    pub id: String,
    pub version: u32,
    pub category: TextPresetCategory,
    /// Panel order (globally unique, checked for duplicates at parse time).
    pub order: u32,
    /// Default duration (seconds).
    pub duration: f64,
    pub content: Vec<TextPresetItem>,
    pub manifest_hash: u64,
}

impl TextPresetRecipe {
    /// Body text of the first text content item. The panel card's readable label and the claim target after landing both use it.
    pub fn headline(&self) -> Option<&str> {
        self.content
            .iter()
            .find(|item| item.kind == TextPresetItemKind::Text)
            .and_then(|item| item.element.get("text"))
            .and_then(Value::as_str)
    }
}

/// Duration floor: the fallback when the preset duration is clamped to 0 by the clip length, to avoid creating zero-length elements.
const MIN_SPAN: f64 = 0.1;

/// One preset → N `addElement` element payloads (array order is z-order, lower layers first).
///
/// * The whole group occupies `[start, end)`, and `end` is clamped by `film_end`;
/// * Member start = `start + delay` (group stagger), clamped within `end - MIN_SPAN`;
/// * No `id` is assigned: the kernel `addElement` mints its own when it sees no `id`.
pub fn instantiate(recipe: &TextPresetRecipe, start: f64, film_end: f64) -> Vec<Value> {
    let start = if start.is_finite() {
        start.max(0.0)
    } else {
        0.0
    };
    let ceiling = if film_end.is_finite() {
        film_end.max(start + MIN_SPAN)
    } else {
        start + recipe.duration
    };
    let end = round3((start + recipe.duration).min(ceiling));
    recipe
        .content
        .iter()
        .map(|item| {
            let mut object = item.element.as_object().cloned().unwrap_or_else(Map::new);
            let item_start = round3((start + item.delay).min(end - MIN_SPAN).max(start));
            object.insert("start".to_owned(), Value::from(item_start));
            object.insert("end".to_owned(), Value::from(end));
            Value::Object(object)
        })
        .collect()
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

/// Parses a preset pack. `file` is the file name in the manifest (without extension) and is also the expected value of the id.
pub fn parse_text_preset(
    file: &str,
    doc: &Value,
    manifest_hash: u64,
    tables: TextPresetTables<'_>,
) -> Result<TextPresetRecipe, MotionError> {
    let invalid = |message: String| MotionError::ManifestInvalid(format!("{file}: {message}"));

    let domain = text(file, doc, "domain")?;
    if domain != "textpreset" {
        return Err(invalid(format!("domain 应为 textpreset，实为 {domain}")));
    }
    let id = text(file, doc, "id")?;
    if id != file {
        return Err(invalid(format!("id \"{id}\" 与文件名不一致")));
    }
    let category = TextPresetCategory::parse(text(file, doc, "category")?)
        .ok_or_else(|| invalid("未知 category".to_owned()))?;
    if !id.starts_with(category.key()) {
        return Err(invalid("id 前缀应是它自己的 category".to_owned()));
    }
    let order = field(file, doc, "order")?
        .as_u64()
        .filter(|order| *order > 0)
        .ok_or_else(|| invalid("order 须是正整数".to_owned()))? as u32;
    let duration = number(file, doc, "duration")?;
    if !duration.is_finite() || duration < MIN_SPAN {
        return Err(invalid(format!("duration 非法：{duration}")));
    }

    let items = field(file, doc, "content")?
        .as_array()
        .ok_or_else(|| invalid("content 不是数组".to_owned()))?;
    if items.is_empty() {
        return Err(invalid("content 为空".to_owned()));
    }
    let mut content = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        content.push(parse_item(file, index, item, tables)?);
    }

    Ok(TextPresetRecipe {
        id: id.to_owned(),
        version: version(file, doc)?,
        category,
        order,
        duration,
        content,
        manifest_hash,
    })
}

fn parse_item(
    file: &str,
    index: usize,
    item: &Value,
    tables: TextPresetTables<'_>,
) -> Result<TextPresetItem, MotionError> {
    let invalid = |message: String| {
        MotionError::ManifestInvalid(format!("{file}: content[{index}] {message}"))
    };
    let object = item
        .as_object()
        .ok_or_else(|| invalid("不是对象".to_owned()))?;
    let kind = object
        .get("kind")
        .and_then(Value::as_str)
        .and_then(TextPresetItemKind::parse)
        .ok_or_else(|| invalid("kind 只能是 text / shape".to_owned()))?;

    let place = object
        .get("place")
        .and_then(Value::as_object)
        .ok_or_else(|| invalid("缺 place".to_owned()))?;
    for key in ["x", "y"] {
        let value = place
            .get(key)
            .and_then(Value::as_f64)
            .ok_or_else(|| invalid(format!("place.{key} 缺失或非数字")))?;
        if !value.is_finite() {
            return Err(invalid(format!("place.{key} 非法")));
        }
    }
    for key in ["w", "rot"] {
        if let Some(value) = place.get(key) {
            let value = value
                .as_f64()
                .filter(|value| value.is_finite())
                .ok_or_else(|| invalid(format!("place.{key} 非法")))?;
            if key == "w" && value <= 0.0 {
                return Err(invalid("place.w 须为正".to_owned()));
            }
        }
    }

    match kind {
        TextPresetItemKind::Text => {
            object
                .get("text")
                .and_then(Value::as_str)
                .filter(|text| !text.is_empty())
                .ok_or_else(|| invalid("text 缺失或为空".to_owned()))?;
            object
                .get("style")
                .and_then(Value::as_object)
                .ok_or_else(|| invalid("缺 style 对象".to_owned()))?;
        }
        TextPresetItemKind::Shape => {
            let shape = object
                .get("shape")
                .and_then(Value::as_object)
                .ok_or_else(|| invalid("缺 shape 对象".to_owned()))?;
            let name = shape
                .get("shape")
                .and_then(Value::as_str)
                .ok_or_else(|| invalid("shape.shape 缺失".to_owned()))?;
            // Shape names go through the **shape catalogue**. Writing a name the catalogue does not have fails here, instead of waiting until the user clicks the preset, the element is saved, and rendering discovers it cannot be drawn.
            if !tables.shapes.iter().any(|recipe| recipe.id == name) {
                return Err(invalid(format!("形状目录里没有 \"{name}\"")));
            }
        }
    }

    let delay = match object.get("delay") {
        Some(value) => value
            .as_f64()
            .filter(|value| value.is_finite() && *value >= 0.0)
            .ok_or_else(|| invalid("delay 非法".to_owned()))?,
        None => 0.0,
    };

    if let Some(animate) = object.get("animate") {
        let animate = animate
            .as_object()
            .ok_or_else(|| invalid("animate 不是对象".to_owned()))?;
        for (slot, value) in animate {
            let preset = value
                .get("preset")
                .and_then(Value::as_str)
                .ok_or_else(|| invalid(format!("animate.{slot} 缺 preset")))?;
            let known = match slot.as_str() {
                "enter" => tables.enter.iter().any(|recipe| recipe.id == preset),
                "exit" => tables.exit.iter().any(|recipe| recipe.id == preset),
                "loop" => tables.loops.iter().any(|recipe| recipe.id == preset),
                other => return Err(invalid(format!("未知动画槽 {other}"))),
            };
            if !known {
                return Err(invalid(format!("animate.{slot} 的 \"{preset}\" 没有配方")));
            }
            if let Some(dur) = value.get("dur") {
                let dur = dur
                    .as_f64()
                    .filter(|dur| dur.is_finite())
                    .ok_or_else(|| invalid(format!("animate.{slot}.dur 非法")))?;
                // Same basis as `ccut_timeline::animations::{DURATION_MIN, DURATION_MAX}`.
                // Those two constants live in a downstream crate and cannot be referenced here, so they are restated, and pinned in reverse by the preset-landing tests in `ccut-timeline`.
                if !(0.1..=2.0).contains(&dur) {
                    return Err(invalid(format!("animate.{slot}.dur 须在 0.1..=2.0")));
                }
            }
        }
    }

    // The payload should not contain fields that `instantiate` or the kernel is responsible for.
    for key in ["id", "start", "end", "role"] {
        if object.contains_key(key) {
            return Err(invalid(format!("不许自带 \"{key}\"")));
        }
    }

    let mut element = object.clone();
    element.remove("delay");
    Ok(TextPresetItem {
        kind,
        delay,
        element: Value::Object(element),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::preset_registry::{
        Domain, ids, text_preset, text_presets, timeline_enter, timeline_exit, timeline_loop,
        timeline_shapes,
    };

    /// Reference table for tests: obtained through the query surface, and it is the same data as the one in `build()`.
    fn tables() -> (
        Vec<crate::preset_registry::frozen::SlotRecipe>,
        Vec<crate::preset_registry::frozen::SlotRecipe>,
        Vec<crate::preset_registry::frozen::LoopRecipe>,
    ) {
        let enter = ids(Domain::TimelineEnter)
            .into_iter()
            .filter_map(|id| timeline_enter(id).cloned())
            .collect();
        let exit = ids(Domain::TimelineExit)
            .into_iter()
            .filter_map(|id| timeline_exit(id).cloned())
            .collect();
        let loops = ids(Domain::TimelineLoop)
            .into_iter()
            .filter_map(|id| timeline_loop(id).cloned())
            .collect();
        (enter, exit, loops)
    }

    /// Catalogue shapes: 51 entries, with fixed entry counts per category (simple 13 / title 10 / lowerThird 20 / other 8). `order` is ascending and categories are contiguous, so chip filtering can take a sub-slice directly.
    #[test]
    fn the_builtin_catalogue_has_the_default_shape() {
        let all = text_presets();
        assert_eq!(all.len(), 51);
        let mut counts = [0usize; 4];
        for (index, recipe) in all.iter().enumerate() {
            counts[TextPresetCategory::ALL
                .iter()
                .position(|kind| *kind == recipe.category)
                .expect("已知分类")] += 1;
            if index > 0 {
                assert!(all[index - 1].order < recipe.order, "order 必须升序");
                assert!(
                    all[index - 1].category <= recipe.category,
                    "分类必须成段：{}",
                    recipe.id
                );
            }
        }
        assert_eq!(counts, [13, 10, 20, 8]);
    }

    /// Every preset can be looked up by id, and the id matches its category prefix (already verified at parse time; pinned here for the query surface).
    #[test]
    fn every_preset_is_reachable_by_id() {
        for recipe in text_presets() {
            let found = text_preset(&recipe.id).expect(&recipe.id);
            assert_eq!(found.id, recipe.id);
            assert!(recipe.id.starts_with(recipe.category.key()));
            assert!(!recipe.content.is_empty());
            assert!(recipe.headline().is_some(), "{} 没有文字项", recipe.id);
        }
    }

    /// The three cases of `instantiate`: member count is conserved, start times stagger by delay, and end time is clamped by clip length.
    #[test]
    fn instantiate_staggers_members_and_clamps_to_the_film_end() {
        let recipe = text_presets()
            .iter()
            .find(|recipe| recipe.content.iter().any(|item| item.delay > 0.0))
            .expect("至少有一条带错峰的预设");
        let elements = instantiate(recipe, 2.0, 600.0);
        assert_eq!(elements.len(), recipe.content.len());
        for (element, item) in elements.iter().zip(&recipe.content) {
            assert_eq!(element["start"].as_f64().unwrap(), round3(2.0 + item.delay));
            assert_eq!(
                element["end"].as_f64().unwrap(),
                round3(2.0 + recipe.duration)
            );
            assert!(element.get("id").is_none(), "id 由内核分配");
            assert_eq!(element["kind"].as_str().unwrap(), item.kind.key());
        }
        // Clip-length clamping: the whole group is squeezed to 3.0, and member starts may not pass the end.
        let clamped = instantiate(recipe, 2.0, 3.0);
        for element in &clamped {
            assert_eq!(element["end"].as_f64().unwrap(), 3.0);
            assert!(element["start"].as_f64().unwrap() <= 3.0 - MIN_SPAN + 1e-9);
        }
    }

    /// Parse-time guards, one by one: unknown category / unknown shape / animation with no recipe / carrying its own id.
    #[test]
    fn the_parser_rejects_the_four_classes_of_bad_data() {
        let good = serde_json::json!({
            "id": "simple.99", "version": 1, "domain": "textpreset",
            "category": "simple", "order": 199, "duration": 4.0,
            "content": [{"kind": "text", "place": {"x": 50.0, "y": 50.0},
                         "text": "Hi", "style": {"fontSize": 30.0}}],
        });
        let (enter, exit, loops) = tables();
        let tables = TextPresetTables {
            shapes: timeline_shapes(),
            enter: &enter,
            exit: &exit,
            loops: &loops,
        };
        assert!(parse_text_preset("simple.99", &good, 0, tables).is_ok());

        let mut wrong_category = good.clone();
        wrong_category["category"] = serde_json::json!("banner");
        assert!(parse_text_preset("simple.99", &wrong_category, 0, tables).is_err());

        let mut wrong_shape = good.clone();
        wrong_shape["content"] = serde_json::json!([
            {"kind": "shape", "place": {"x": 50.0, "y": 50.0, "w": 20.0},
             "shape": {"shape": "no-such-shape"}}
        ]);
        assert!(parse_text_preset("simple.99", &wrong_shape, 0, tables).is_err());

        let mut dead_exit = good.clone();
        // `pop` is a legal exit name in the document closed set, but the exit recipe table has no entry for it. Writing it into built-in data would make a "legal but never moves" slot, so parsing must reject it.
        dead_exit["content"][0]["animate"] = serde_json::json!({"exit": {"preset": "pop"}});
        assert!(parse_text_preset("simple.99", &dead_exit, 0, tables).is_err());

        let mut carries_id = good.clone();
        carries_id["content"][0]["id"] = serde_json::json!("el-1");
        assert!(parse_text_preset("simple.99", &carries_id, 0, tables).is_err());

        let mut wrong_file = good.clone();
        wrong_file["id"] = serde_json::json!("simple.98");
        assert!(parse_text_preset("simple.99", &wrong_file, 0, tables).is_err());
    }
}
