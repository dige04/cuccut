//! Catalog of word animations: 19 cells, each with one catalog id (`catalogId`), with the same names and order as [`crate::word_motion::WORD_ANIM_TRACKS`].
//!
//! The style root's `wordAnimation` (or the legacy key `anim`) is read by [`crate::word_animation`]: when `catalogId` is one of the cells in the catalog, it plays that cell's continuous track; `animationName` is the kernel's three-tier branch name (`Reveal`, `Highlight`, ...). [`word_animation_payload`] gives the payload written into the style when a cell is selected. Both the UI and styles that only supply a catalog id (`animationPresetId` in positioned-box styles) use it, rather than each writing their own.
//!
//! Ported from v2 `ccut-editor-core::stylepane`'s `WORD_ANIMATIONS` and `word_animation_payload`, behavior unchanged.

use serde_json::{Map, Value, json};

/// One cell of the catalog: its catalog id and the kernel's branch name.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WordAnimationEntry {
    pub catalog_id: &'static str,
    /// The `animationName` recognised by [`crate::word_animation`].
    pub kernel: &'static str,
}

const fn entry(catalog_id: &'static str, kernel: &'static str) -> WordAnimationEntry {
    WordAnimationEntry { catalog_id, kernel }
}

/// 19 cells, same order as [`crate::word_motion::WORD_ANIM_TRACKS`]: 17 cells unchanged, plus the kernel's own two cells, “bounce” and “colour fill”.
pub const WORD_ANIMATIONS: [WordAnimationEntry; 19] = [
    entry("none", "None"),
    entry("boxHighlight", "Highlight"),
    entry("flipClock", "flipClock"),
    entry("highlight", "Highlighter"),
    entry("karaoke", "Karaoke"),
    entry("impact", "impact"),
    entry("reveal", "Reveal"),
    entry("floatInTop", "floatInTop"),
    entry("floatInBottom", "floatInBottom"),
    entry("scaleIn", "scaleIn"),
    entry("dropIn", "dropIn"),
    entry("impactPop", "impactPop"),
    entry("colourHighlight", "Color"),
    entry("rotateFlipClock", "rotateFlipClock"),
    entry("rotateHighlight", "rotateHighlight"),
    entry("stack", "stack"),
    entry("stomp", "stomp"),
    entry("bounce", "Bounce"),
    entry("paint", "Paint"),
];

/// Find the cell by catalog id; `None` if it is not in the catalog.
pub fn word_animation_entry(catalog_id: &str) -> Option<&'static WordAnimationEntry> {
    WORD_ANIMATIONS
        .iter()
        .find(|entry| entry.catalog_id == catalog_id)
}

/// Scaling track for the “pill highlight” background block: `(phase, multiplier)`, easing [`WORD_BOX_EASING`].
pub const WORD_BOX_SCALE_KEYFRAMES: [(f64, f64); 3] = [(0.0, 0.9), (0.7, 1.1), (1.0, 1.0)];
/// Alpha track for the same block. The block's alpha is independent of the word's opacity; applying it to the word's opacity would fade the text along with it.
pub const WORD_BOX_OPACITY_KEYFRAMES: [(f64, f64); 3] = [(0.0, 0.75), (0.7, 1.0), (1.0, 1.0)];
/// Easing name shared by both tracks (`cubic-bezier(0.37, 0, 0.63, 1)`).
pub const WORD_BOX_EASING: &str = "sinInOut";

fn keyframes_json(frames: &[(f64, f64)]) -> Value {
    Value::Array(
        frames
            .iter()
            .map(|(time, value)| json!([time, value]))
            .collect(),
    )
}

/// The payload written into the style root's `wordAnimation` when a cell is selected: `{animationId, animationName, catalogId, spoken, active, unspoken}`.
///
/// `name` is the catalog id. If it is not one, it is treated as a kernel branch name (older documents that only have `animationName`, such as `Highlight` or `Custom`). In that case `catalogId` is set to that name, without quietly swapping it for the first catalog card with the same kernel.
pub fn word_animation_payload(name: &str) -> Value {
    let entry = word_animation_entry(name);
    let catalog_id = entry.map_or(name, |entry| entry.catalog_id);
    let kernel_name = entry.map_or(name, |entry| entry.kernel);
    let mut spoken = Map::new();
    let mut active = Map::new();
    let mut unspoken = Map::new();
    match kernel_name {
        "Color" => {
            active.insert("color".to_owned(), json!("#FFD43B"));
        }
        "Highlight" => {
            active.insert("backgroundColor".to_owned(), json!("#FFD43B"));
            active.insert("color".to_owned(), json!("#0D0D0D"));
            active.insert("borderRadiusEm".to_owned(), json!(0.25));
        }
        "Bounce" => {
            active.insert("bottomEm".to_owned(), json!(0.22));
        }
        "Paint" => {
            spoken.insert("color".to_owned(), json!("#FFD43B"));
            spoken.insert("underline".to_owned(), json!(true));
            spoken.insert("underlineOffsetEm".to_owned(), json!(0.18));
        }
        "Reveal" => {
            unspoken.insert("color".to_owned(), json!("transparent"));
            unspoken.insert("shadowOff".to_owned(), json!(true));
            unspoken.insert("underline".to_owned(), json!(false));
            unspoken.insert("opacity".to_owned(), json!(0.0));
        }
        // The two pure-opacity cells have no block and no color change; they only have `opacity`.
        "Karaoke" => {
            spoken.insert("opacity".to_owned(), json!(1.0));
            active.insert("opacity".to_owned(), json!(1.0));
            unspoken.insert("opacity".to_owned(), json!(0.5));
        }
        "Highlighter" => {
            spoken.insert("opacity".to_owned(), json!(0.5));
            active.insert("opacity".to_owned(), json!(1.0));
            unspoken.insert("opacity".to_owned(), json!(0.5));
        }
        "Custom" => {
            spoken.insert("color".to_owned(), json!("#2EC971"));
            active.insert("backgroundColor".to_owned(), json!("#FFD43B"));
            active.insert("color".to_owned(), json!("#0D0D0D"));
            active.insert("borderRadiusEm".to_owned(), json!(0.25));
            unspoken.insert("opacity".to_owned(), json!(0.5));
        }
        _ => {}
    }
    if catalog_id == "boxHighlight" {
        active.insert("backgroundColor".to_owned(), json!("#FFD43B"));
        active.insert("color".to_owned(), json!("#0D0D0D"));
        // Corner rounding is a multiple of the font size (0.5 → 0.5em), on the same scale as the plate's corner radius.
        active.insert("borderRadiusEm".to_owned(), json!(0.5));
        // Only this cell has a time track for the background block. The highlighter (`highlight`) block is a constant-on square-cornered backing.
        active.insert(
            "boxScale".to_owned(),
            keyframes_json(&WORD_BOX_SCALE_KEYFRAMES),
        );
        active.insert(
            "boxOpacity".to_owned(),
            keyframes_json(&WORD_BOX_OPACITY_KEYFRAMES),
        );
        active.insert("boxEasing".to_owned(), json!(WORD_BOX_EASING));
    }
    json!({
        "animationId": if kernel_name == "None" { "none" } else { "magic-wbw" },
        "animationName": kernel_name,
        "catalogId": catalog_id,
        "spoken": Value::Object(spoken),
        "active": Value::Object(active),
        "unspoken": Value::Object(unspoken),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::word_motion::WORD_ANIM_TRACKS;

    #[test]
    fn the_catalogue_lines_up_with_the_track_table() {
        let ids: Vec<_> = WORD_ANIMATIONS
            .iter()
            .map(|entry| entry.catalog_id)
            .collect();
        let tracks: Vec<_> = WORD_ANIM_TRACKS
            .iter()
            .map(|anim| anim.catalog_id)
            .collect();
        assert_eq!(ids, tracks);
    }

    #[test]
    fn switching_effects_replaces_the_whole_group_instead_of_patching_it() {
        let highlight = word_animation_payload("Highlight");
        assert_eq!(highlight["animationId"], json!("magic-wbw"));
        assert_eq!(highlight["active"]["backgroundColor"], json!("#FFD43B"));
        assert_eq!(highlight["active"]["color"], json!("#0D0D0D"));
        assert_eq!(highlight["spoken"], json!({}));
        // None is the only one that writes animationId as "none".
        let none = word_animation_payload("None");
        assert_eq!(none["animationId"], json!("none"));
        assert_eq!(none["active"], json!({}));
        let color = word_animation_payload("Color");
        assert_eq!(color["active"], json!({"color": "#FFD43B"}));
        assert_eq!(
            word_animation_payload("Reveal")["unspoken"]["color"],
            json!("transparent")
        );
        // The two pure-opacity cells: only `opacity`, with no backgroundColor or color.
        let karaoke = word_animation_payload("karaoke");
        assert_eq!(karaoke["animationName"], json!("Karaoke"));
        assert_eq!(karaoke["spoken"], json!({"opacity": 1.0}));
        assert_eq!(karaoke["active"], json!({"opacity": 1.0}));
        assert_eq!(karaoke["unspoken"], json!({"opacity": 0.5}));
        let marker = word_animation_payload("highlight");
        assert_eq!(marker["animationName"], json!("Highlighter"));
        assert_eq!(marker["spoken"], json!({"opacity": 0.5}));
        assert_eq!(marker["active"], json!({"opacity": 1.0}));
        assert_eq!(marker["unspoken"], json!({"opacity": 0.5}));
        assert_eq!(
            word_animation_payload("Custom")["spoken"]["color"],
            json!("#2EC971")
        );
        assert_eq!(
            word_animation_payload("Bounce")["active"]["bottomEm"],
            json!(0.22)
        );
        // The block's time track belongs only to the “pill highlight” cell; the `Highlight` kernel name passed in does not carry it.
        assert!(highlight["active"].get("boxScale").is_none());
        for entry in WORD_ANIMATIONS {
            let payload = word_animation_payload(entry.catalog_id);
            assert_eq!(
                payload["active"].get("boxScale").is_some(),
                entry.catalog_id == "boxHighlight",
                "{} has the wrong block timeline entries",
                entry.catalog_id
            );
        }
    }

    #[test]
    fn the_pill_highlight_payload_carries_a_box_track_the_kernel_reads() {
        let pill = word_animation_payload("boxHighlight");
        assert_eq!(
            pill["active"]["boxScale"],
            json!([[0.0, 0.9], [0.7, 1.1], [1.0, 1.0]])
        );
        assert_eq!(
            pill["active"]["boxOpacity"],
            json!([[0.0, 0.75], [0.7, 1.0], [1.0, 1.0]])
        );
        assert_eq!(pill["active"]["boxEasing"], json!("sinInOut"));
        let track = crate::word_box_track(&pill["active"]).expect("the kernel must recognize these three keys");
        assert!(track.is_animated());
        assert_eq!(track.scale_at(0.0), Some(0.9));
        assert_eq!(track.opacity_at(0.0), Some(0.75));
    }

    #[test]
    fn every_cell_reaches_the_kernel() {
        // Each cell's payload is handed to the kernel, which selects that cell's continuous track (`none` has no track). The branch name follows the catalog.
        for entry in WORD_ANIMATIONS {
            let payload = word_animation_payload(entry.catalog_id);
            let animation = crate::word_animation(&json!({ "wordAnimation": payload }));
            assert_eq!(animation.name, entry.kernel, "{}", entry.catalog_id);
            let expected = (entry.catalog_id != "none").then_some(entry.catalog_id);
            assert_eq!(
                animation.motion_id.as_deref(),
                expected,
                "{}",
                entry.catalog_id
            );
        }
        // Character-by-character reveal: unspoken words are transparent and have no shadow.
        let reveal =
            crate::word_animation(&json!({ "wordAnimation": word_animation_payload("reveal") }));
        assert_eq!(reveal.unspoken.opacity, Some(0.0));
        assert!(reveal.unspoken.shadow_off);
    }

    #[test]
    fn two_highlight_cells_write_two_distinct_payloads() {
        let pill = word_animation_payload("boxHighlight");
        let marker = word_animation_payload("highlight");
        assert_ne!(pill, marker);
        assert_eq!(pill["catalogId"], json!("boxHighlight"));
        assert_eq!(marker["catalogId"], json!("highlight"));
        assert_eq!(pill["active"]["borderRadiusEm"], json!(0.5));
        assert!(marker["active"].get("borderRadiusEm").is_none());
        assert!(marker["active"].get("backgroundColor").is_none());
    }
}
