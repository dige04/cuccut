//! Body of a caption-style document (video format spec §5.6, document `kind: 'caption-style'`).
//!
//! Two kinds of body: the Studio style (`cuccut.legacy-studio-style/0.1`, the v2 caption style's `style` kept as it is) and the boxed-caption style
//! (`cuccut.boxed-caption-style/<N>`, written by external project imports). When the engine writes, it only checks the per-word animation of the boxed-caption style
//! ([`caption_style_body_problems`]); the other fields are read by the render kernel and are not validated.

use message_ref::{Text, msg};
use serde_json::Value;

pub const CAPTION_STYLE_KIND: &str = "caption-style";
/// Studio caption style.
pub const STUDIO_STYLE_SCHEMA: &str = "cuccut.legacy-studio-style/0.1";
const BOXED_STYLE_PREFIX: &str = "cuccut.boxed-caption-style/";

/// Boxed-caption style: `cuccut.boxed-caption-style/` followed by a version number.
pub fn is_boxed_style_schema(schema: &str) -> bool {
    schema
        .strip_prefix(BOXED_STYLE_PREFIX)
        .is_some_and(|v| !v.is_empty() && v.bytes().all(|b| b.is_ascii_digit()))
}

/// Default preset (video format spec §5.6 “default preset”): captions with no style document are drawn with it, and the Studio style seeded into a newly created caption layer is it too.
///
/// The finish is the seed “classic” for new projects (prototype `model-defaultsub.js`, the editor's `CLASSIC` in `caption-presets.ts`, identical field by field):
/// white text, weight 700, black outline (`textOutline.width` is a percentage of the font size and scales with it) and a shadow, legible even on light pictures; the backing plate is off.
/// `punct: true`: ordinary commas and periods are replaced with spaces; transcripts and exported caption files keep the original text. Not language-specific.
/// The editor (`DEFAULT_CAPTION_STYLE` in `packages/ui/src/model/property-values.ts`) and the pipeline (`caption-layer.ts` in `packages/jobs`) each keep a copy of the same body; change all three together when editing.
pub fn default_studio_style() -> Value {
    serde_json::json!({
        "fontStyle": "normal",
        "underline": false,
        "textAlign": "center",
        "lineHeight": 1.2,
        "letterSpacing": 0,
        "textTransform": "none",
        "background": false,
        "backgroundColor": "#000000B3",
        "backgroundStyle": "wrap",
        "backgroundPadding": 10,
        "borderRadius": 15,
        "fontFamily": "system",
        "fontWeight": 700,
        "bold": true,
        "italic": false,
        "fontColor": "#FFFFFF",
        "textOutline": { "on": true, "color": "#000000", "width": 14 },
        "dropShadow": { "on": true, "blur": 0.12, "distance": 0.08, "rotation": 45, "color": "#000000", "opacity": 0.9 },
        "outline": true,
        "glow": { "on": false },
        "wordAnimation": { "animationId": "magic-wbw", "animationName": "Color", "catalogId": "colourHighlight", "spoken": {}, "active": { "color": "#18E1D6" }, "unspoken": {} },
        "punct": true
    })
}

/// The 19 ids of the per-word animation catalog, with the same names in the same order as the render kernel's catalog (`subtitle_render::word_animation_catalog::WORD_ANIMATIONS`).
pub const WORD_ANIMATION_IDS: [&str; 19] = [
    "none",
    "boxHighlight",
    "flipClock",
    "highlight",
    "karaoke",
    "impact",
    "reveal",
    "floatInTop",
    "floatInBottom",
    "scaleIn",
    "dropIn",
    "impactPop",
    "colourHighlight",
    "rotateFlipClock",
    "rotateHighlight",
    "stack",
    "stomp",
    "bounce",
    "paint",
];

/// Places where the body does not match §5.6 (empty means it matches). Boxed-caption style: `style` is an object; when `style.animationPresetId` is present, it is an id in the per-word animation catalog.
/// Other schemas are not checked.
pub fn caption_style_body_problems(body: &Value) -> Vec<Text> {
    let schema = body.get("schema").and_then(Value::as_str).unwrap_or_default();
    if !is_boxed_style_schema(schema) {
        return Vec::new();
    }
    let mut problems = Vec::new();
    match body.get("style") {
        None => {}
        Some(Value::Object(style)) => match style.get("animationPresetId") {
            None => {}
            Some(Value::String(id)) if WORD_ANIMATION_IDS.contains(&id.as_str()) => {}
            Some(other) => problems.push(msg!(
                "videoModel.captionAnimationUnknown",
                "style.animationPresetId must be an ID from the word animation catalog, not {value}",
                value = other.to_string()
            )),
        },
        Some(_) => problems.push(msg!("videoModel.captionStyleNotObject", "style must be an object")),
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn boxed_schema_versions() {
        assert!(is_boxed_style_schema("cuccut.boxed-caption-style/1"));
        assert!(is_boxed_style_schema("cuccut.boxed-caption-style/18"));
        assert!(!is_boxed_style_schema("cuccut.boxed-caption-style/"));
        assert!(!is_boxed_style_schema("cuccut.boxed-caption-style/1a"));
        assert!(!is_boxed_style_schema(STUDIO_STYLE_SCHEMA));
    }

    #[test]
    fn the_default_preset_outlines_and_projects_punctuation() {
        let style = default_studio_style();
        assert_eq!(style["textOutline"], json!({ "on": true, "color": "#000000", "width": 14 }));
        assert_eq!(style["background"], json!(false));
        assert_eq!(style["punct"], json!(true));
        assert_eq!(style["wordAnimation"]["catalogId"], json!("colourHighlight"));
        assert_eq!(style["wordAnimation"]["active"]["color"], json!("#18E1D6"));
        assert!(caption_style_body_problems(&json!({ "schema": STUDIO_STYLE_SCHEMA, "style": style })).is_empty());
    }

    #[test]
    fn boxed_animation_presets_come_from_the_catalogue() {
        let boxed = |style: Value| json!({ "schema": "cuccut.boxed-caption-style/18", "style": style });
        assert!(caption_style_body_problems(&boxed(json!({ "animationPresetId": "reveal" }))).is_empty());
        assert!(caption_style_body_problems(&boxed(json!({ "fontSize": 40 }))).is_empty());
        assert!(caption_style_body_problems(&json!({ "schema": "cuccut.boxed-caption-style/1" })).is_empty());
        for bad in [
            json!({ "animationPresetId": "typewriter" }),
            json!({ "animationPresetId": 3 }),
            json!({ "animationPresetId": null }),
        ] {
            assert_eq!(caption_style_body_problems(&boxed(bad.clone())).len(), 1, "{bad}");
        }
        assert_eq!(caption_style_body_problems(&boxed(json!("reveal"))).len(), 1);
        // Studio styles are not checked against other schemas: `catalogId` in old documents may be a kernel name.
        let studio = json!({ "schema": STUDIO_STYLE_SCHEMA, "style": { "wordAnimation": { "catalogId": "Color" } } });
        assert!(caption_style_body_problems(&studio).is_empty());
    }
}
