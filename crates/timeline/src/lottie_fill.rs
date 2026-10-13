//! **Fill-color grouping** for Lottie assets (prototype `designs/cuccut/app/model-lottiefill.js`).
//!
//! Recoloring for static SVG stickers is in [`crate::svg_fill`]: count the fill-color groups in the source and you get that many swatches. Once an animated sticker is replaced with a Noto Lottie JSON, the claim that “animated stickers can be color-grouped too” is made good by this layer. Lottie colors are not on properties but on the layer's shape items (`ty: "fl"` fill / `ty: "st"` stroke, where `c.k` is an RGB array in 0–1) and on solid layers (`sc` on `ty: 1`).
//!
//! Two rules that are identical, word for word, to the other two implementations (the prototype's `BC_LOTTIEFILL.colorsOf` and the generator [`scripts/dev/elements/generate.py`]'s `lottie_colors`; each entry's `colors` in `anim/provenance.json` is its output):
//!
//! 1. **Only static colors are collected.** `c.a` being truthy means this color itself carries keyframes; that is not a color region that can be swapped as a whole, so it is skipped.
//! 2. **Sorted by occurrence count, at most [`MAX_SWATCHES`] groups**; ties are ordered by first appearance. The first swatch the user sees is the largest color block in the picture.
//!
//! The recoloring itself is not here: the source of truth in the document is `sticker.fillOverrides` (**keyed by source hex**, the same table as on the SVG side), and the render side applies it in `ccut_render::source::lottie::Lottie::apply_fill_overrides`. Translating between swatches and the override table reuses [`crate::svg_fill::fills_to_overrides`] and [`crate::svg_fill::fill_list_from_overrides`], one shared implementation for both asset types.

use serde_json::Value;

use crate::svg_fill::{FillCard, norm_fill_hex};

/// Maximum number of default swatches (prototype `BC_LOTTIEFILL.LIMIT`, generator `lottie_colors(limit=8)`).
///
/// More than the SVG side's [`crate::svg_fill::MAX_SWATCHES`] (5): eight groups is the upper bound on the number of colors actually found in the Noto asset batch.
pub const MAX_SWATCHES: usize = 8;

/// Lottie's `[r, g, b]` (0–1, occasionally 0–255) → `#RRGGBB`.
///
/// If any component is greater than 1, the whole triple is read as 0–255 (the generator's `lottie_rgb` makes the same decision). Lottie has both notations, and `[1, 1, 1]` is both white and “an almost-black value on the 255 scale”; reading it as 0–1 is bodymovin's default.
pub fn rgb_hex(value: &Value) -> Option<String> {
    let list = value.as_array()?;
    if list.len() < 3 {
        return None;
    }
    let mut rgb = [0.0f64; 3];
    for (slot, item) in rgb.iter_mut().zip(list) {
        let channel = item.as_f64()?;
        if !channel.is_finite() {
            return None;
        }
        *slot = channel;
    }
    if rgb.iter().any(|channel| *channel > 1.0) {
        for channel in &mut rgb {
            *channel /= 255.0;
        }
    }
    let mut out = String::with_capacity(7);
    out.push('#');
    for channel in rgb {
        let byte = (channel.clamp(0.0, 1.0) * 255.0).round() as u8;
        out.push_str(&format!("{byte:02X}"));
    }
    Some(out)
}

/// A solid layer's `sc`: only `#RGB` / `#RRGGBB` are recognized; anything else (`transparent`, an empty string, malformed values) is not a swappable color region and is skipped.
fn solid_hex(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let body = trimmed.strip_prefix('#')?;
    let hexy = body.chars().all(|c| c.is_ascii_hexdigit());
    (hexy && (body.len() == 3 || body.len() == 6)).then(|| norm_fill_hex(trimmed))
}

/// Static colors in the shape tree, emitted in the order encountered. `gr` recurses into `it`; other items are skipped.
fn visit_shapes(items: &Value, out: &mut Vec<String>) {
    let Some(list) = items.as_array() else {
        return;
    };
    for item in list {
        match item.get("ty").and_then(Value::as_str) {
            Some("fl" | "st") => {
                let Some(color) = item.get("c") else { continue };
                // `c.a` truthy = this color carries keyframes itself, so it is not a color region that can be swapped as a whole.
                if color.get("a").is_some_and(is_truthy) {
                    continue;
                }
                let Some(k) = color.get("k") else { continue };
                if let Some(hex) = rgb_hex(k) {
                    out.push(hex);
                }
            }
            Some("gr") => {
                if let Some(nested) = item.get("it") {
                    visit_shapes(nested, out);
                }
            }
            _ => {}
        }
    }
}

/// JS truthiness: `0` / `false` / `null` / absent are all falsy. Lottie's `a` is actually written as `0` / `1`, but `true` also appears in hand-written documents.
fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0),
        Value::Null => false,
        _ => true,
    }
}

/// Where every static color in one Lottie file lands, in the order encountered. Root layers come first; precomposition layers (`assets[].layers`) follow in the order of `assets`, the same single pass as the prototype and the generator.
pub fn colors_in_order(doc: &Value) -> Vec<String> {
    let mut out = Vec::new();
    let mut lists = vec![doc.get("layers")];
    if let Some(assets) = doc.get("assets").and_then(Value::as_array) {
        lists.extend(assets.iter().map(|asset| asset.get("layers")));
    }
    for layers in lists.into_iter().flatten() {
        let Some(layers) = layers.as_array() else {
            continue;
        };
        for layer in layers {
            if layer.get("ty").and_then(Value::as_i64) == Some(1)
                && let Some(sc) = layer.get("sc").and_then(Value::as_str)
                && let Some(hex) = solid_hex(sc)
            {
                out.push(hex);
            }
            if let Some(shapes) = layer.get("shapes") {
                visit_shapes(shapes, &mut out);
            }
        }
    }
    out
}

/// Swatch table: the top [`MAX_SWATCHES`] groups by occurrence count; ties are ordered by first appearance.
///
/// `tag` is always empty. On the SVG side the subtitle is the name of the tag carrying the color (`path` / `rect`); a Lottie color is carried by a shape item, which has no name meaningful to the user, so the card header is just “group N”.
pub fn fills_of_doc(doc: &Value) -> Vec<FillCard> {
    let order = colors_in_order(doc);
    let mut cards: Vec<FillCard> = Vec::new();
    for hex in order {
        match cards.iter_mut().find(|card| card.hex == hex) {
            Some(card) => card.count += 1,
            None => cards.push(FillCard {
                hex,
                tag: String::new(),
                count: 1,
            }),
        }
    }
    // Stable sort: count descending; ties keep their first-appearance order.
    cards.sort_by(|a, b| b.count.cmp(&a.count));
    cards.truncate(MAX_SWATCHES);
    cards
}

/// The swatch table for one Lottie JSON text. If it cannot be parsed, the table is empty. **An empty table means “no color section is shown”.**
pub fn fills_of(json: &str) -> Vec<FillCard> {
    serde_json::from_str::<Value>(json)
        .map(|doc| fills_of_doc(&doc))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rgb_reads_both_the_unit_and_the_byte_dialect() {
        assert_eq!(rgb_hex(&json!([1, 0, 0])).as_deref(), Some("#FF0000"));
        assert_eq!(rgb_hex(&json!([0, 128, 255])).as_deref(), Some("#0080FF"));
        assert_eq!(
            rgb_hex(&json!([0.0, 0.502, 1.0, 1.0])).as_deref(),
            Some("#0080FF")
        );
        assert_eq!(rgb_hex(&json!([1, 0])), None);
        assert_eq!(rgb_hex(&json!("#ff0000")), None);
    }

    #[test]
    fn only_static_colours_become_swatches() {
        let doc = json!({"layers": [{"ty": 4, "shapes": [
            {"ty": "gr", "it": [
                {"ty": "fl", "c": {"a": 0, "k": [1, 0, 0, 1]}},
                {"ty": "st", "c": {"a": 1, "k": [{"t": 0, "s": [0, 1, 0, 1]}]}},
            ]},
        ]}]});
        let cards = fills_of_doc(&doc);
        assert_eq!(cards.len(), 1, "带关键帧的描边色不出卡：{cards:?}");
        assert_eq!(cards[0].hex, "#FF0000");
    }

    /// The sort is “count descending, ties by first appearance”: the first swatch the user sees is the largest color block in the picture. This matches the prototype's `colorsOf` and the generator's `Counter.most_common`.
    #[test]
    fn swatches_rank_by_frequency_then_first_appearance() {
        let fill = |hex: [i64; 3]| json!({"ty": "fl", "c": {"a": 0, "k": hex}});
        let doc = json!({"layers": [{"ty": 4, "shapes": [
            fill([0, 0, 1]),
            fill([1, 0, 0]),
            fill([0, 1, 0]),
            fill([1, 0, 0]),
            fill([0, 1, 0]),
        ]}]});
        let cards = fills_of_doc(&doc);
        assert_eq!(
            cards
                .iter()
                .map(|card| (card.hex.as_str(), card.count))
                .collect::<Vec<_>>(),
            vec![("#FF0000", 2), ("#00FF00", 2), ("#0000FF", 1)],
        );
    }

    /// Layers inside precompositions count too: Noto's animated stickers put the whole animation inside `assets[].layers`, so reading only `doc.layers` would yield no swatches at all.
    #[test]
    fn precomp_layers_and_solids_count_too() {
        let doc = json!({
            "layers": [{"ty": 0, "refId": "c0"}],
            "assets": [{"id": "c0", "layers": [
                {"ty": 1, "sc": "#abc"},
                {"ty": 4, "shapes": [{"ty": "fl", "c": {"a": 0, "k": [1, 1, 1, 1]}}]},
            ]}],
        });
        let cards = fills_of_doc(&doc);
        assert_eq!(
            cards
                .iter()
                .map(|card| card.hex.as_str())
                .collect::<Vec<_>>(),
            vec!["#AABBCC", "#FFFFFF"],
        );
    }

    #[test]
    fn at_most_eight_swatches_and_junk_parses_to_none() {
        let shapes: Vec<_> = (0..12)
            .map(|i| json!({"ty": "fl", "c": {"a": 0, "k": [i * 20, 0, 0]}}))
            .collect();
        let doc = json!({"layers": [{"ty": 4, "shapes": shapes}]});
        assert_eq!(fills_of_doc(&doc).len(), MAX_SWATCHES);
        assert!(fills_of("not json").is_empty());
    }
}
