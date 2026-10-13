//! What can be drawn (format spec §3.7 principle: what cannot be drawn must be reported explicitly, not drawn as blank).
//!
//! Preflight and per-frame composition use the same judgment. Preflight lists everything in range that cannot be drawn (export is refused by default). In skip mode, composition does not draw these items and reports one warning for each. There are three granularities: the whole layer is not drawn (`layer`), one effect is skipped (`effect`), a transition becomes a hard cut (`transition`). An asset whose picture cannot be decoded is a fourth kind (`asset`), judged by whoever fetches the picture.

use render_graph::{LayerContent, LayerKind, VisualLayer};
use serde::Serialize;
use serde_json::Value;
use timeline::template::TemplateDoc;

use crate::captions::{CaptionStyle, read_captions};
use crate::documents::Documents;

/// One item that cannot be drawn.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsupportedItem {
    pub item_id: String,
    /// `layer`: the whole layer is not drawn; `effect`: skip this effect; `transition`: hard cut; `asset`: the asset cannot be decoded, so the whole layer is not drawn.
    pub scope: &'static str,
    pub layer_kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effect_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transition_id: Option<String>,
    /// Kind: the kind name of an effect or transition, or the content kind of a layer (the schema of generators, captions and styles).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    pub reason: String,
    pub message: String,
}

impl UnsupportedItem {
    /// Dedup key: the same item in the same instance is reported only once. Transitions are keyed by the transition itself (the layers on both sides report the same item).
    pub fn key(&self) -> String {
        if let (Some(transition), "transition") = (&self.transition_id, self.scope) {
            return format!("transition|{transition}");
        }
        format!(
            "{}|{}|{}|{}",
            self.item_id,
            self.scope,
            self.effect_id.as_deref().unwrap_or(""),
            self.transition_id.as_deref().unwrap_or("")
        )
    }

    /// The whole layer is not drawn (`layer` and `asset`).
    pub fn drops_layer(&self) -> bool {
        matches!(self.scope, "layer" | "asset")
    }

    pub fn layer(layer: &VisualLayer, kind: Option<String>, reason: &str, message: impl Into<String>) -> UnsupportedItem {
        UnsupportedItem {
            item_id: layer.item_id.clone(),
            scope: "layer",
            layer_kind: kind_name(layer.kind),
            effect_id: None,
            transition_id: None,
            kind,
            reason: reason.into(),
            message: message.into(),
        }
    }
}

pub fn kind_name(kind: LayerKind) -> &'static str {
    match kind {
        LayerKind::Video => "video",
        LayerKind::Image => "image",
        LayerKind::Text => "text",
        LayerKind::Shape => "shape",
        LayerKind::Generator => "generator",
        LayerKind::Caption => "caption",
        LayerKind::Unsupported => "unsupported",
    }
}

/// Generators that have a drawing method.
pub const GENERATORS: &[&str] = &[
    "cuccut.counter",
    "cuccut.audio-visualizer",
    "cuccut.progress",
    "cuccut.confetti",
    "cuccut.draw",
    "cuccut.placeholder",
    "cuccut.sticker",
    "cuccut.lottie",
    "cuccut.template",
];

/// Transitions that have a drawing method (all kinds in format spec §3.9).
pub const SUPPORTED_TRANSITIONS: &[&str] = &["dissolve", "wipe", "slide", "zoom", "iris", "dip-to-color", "push"];

/// Where one layer (excluding its transition) cannot be drawn. `template` is the sequence's template document (template layers look up its logo).
pub fn check_layer(layer: &VisualLayer, documents: &Documents, template: Option<&TemplateDoc>) -> Vec<UnsupportedItem> {
    check_layer_with(layer, template, &mut |document_id, style_document_id| {
        caption_problem(documents, document_id, style_document_id)
    })
}

/// [`check_layer`]. Whether a caption layer can be drawn is asked of `caption` (`(caption document, style document)` → [`caption_problem`]). The renderer remembers the answer per document, so it does not re-read the whole caption and style documents every frame.
pub fn check_layer_with(
    layer: &VisualLayer,
    template: Option<&TemplateDoc>,
    caption: &mut dyn FnMut(&str, Option<&str>) -> Option<CaptionProblem>,
) -> Vec<UnsupportedItem> {
    let mut items = Vec::new();
    if let Some(item) = check_content(layer, template, caption) {
        items.push(item);
        return items;
    }
    for effect in &layer.effects {
        if let Some(reason) = effect.unsupported.as_deref() {
            items.push(UnsupportedItem {
                item_id: layer.item_id.clone(),
                scope: "effect",
                layer_kind: kind_name(layer.kind),
                effect_id: Some(effect.id.clone()),
                transition_id: None,
                kind: Some(effect.kind.clone()),
                message: format!("effect \"{}\" cannot be drawn", effect.kind),
                reason: format!("effect-{reason}"),
            });
        }
    }
    items
}

/// Why a transition cannot be drawn (`unsupported` is the reason the plan gives). Preflight checks the transition list, and composition checks the transition on the layer; both ask here.
pub fn transition_problem(kind: &str, unsupported: Option<&str>) -> Option<String> {
    match unsupported {
        Some(reason) => Some(format!("transition-{reason}")),
        None if !SUPPORTED_TRANSITIONS.contains(&kind) => Some("transition-not-implemented".to_string()),
        None => None,
    }
}

/// The item reported when a layer's transition cannot be drawn (drawn as a hard cut).
pub fn check_transition(layer: &VisualLayer) -> Option<UnsupportedItem> {
    let transition = layer.transition.as_ref()?;
    let reason = transition_problem(&transition.kind, transition.unsupported.as_deref())?;
    Some(UnsupportedItem {
        item_id: layer.item_id.clone(),
        scope: "transition",
        layer_kind: kind_name(layer.kind),
        effect_id: None,
        transition_id: Some(transition.id.clone()),
        kind: Some(transition.kind.clone()),
        message: format!("transition \"{}\" cannot be drawn; drawing a hard cut instead", transition.kind),
        reason,
    })
}

/// Whether the shape and generator-referenced catalog entries (shape, sticker template, waveform, progress bar, confetti styles) exist in the catalog shipped with the kernel. If they do not, or are simply not written (a sticker's `templateId` may be missing), the kernel can only skip drawing them, so they are reported here: `(catalog entry, reason, description)`.
fn catalogue_problem(layer: &VisualLayer) -> Option<(Option<String>, &'static str, String)> {
    let text = |value: &Value, key: &str| value.get(key).and_then(Value::as_str).map(str::to_string);
    let (id, found, what) = match &layer.content {
        Some(LayerContent::Shape { shape }) => {
            let id = text(shape, "shape");
            let found = id
                .as_deref()
                .is_some_and(|id| motion::preset_registry::timeline_shape(id).is_some());
            (id, found, "shape")
        }
        Some(LayerContent::Generator { generator, parameters, .. }) => {
            let lookup: fn(&str) -> bool = match generator.as_str() {
                "cuccut.sticker" => |id| motion::preset_registry::timeline_sticker(id).is_some(),
                "cuccut.audio-visualizer" => |id| motion::preset_registry::timeline_visualizer(id).is_some(),
                "cuccut.progress" => |id| motion::preset_registry::timeline_progress(id).is_some(),
                "cuccut.confetti" => |id| motion::preset_registry::timeline_confetti(id).is_some(),
                _ => return None,
            };
            let key = if generator == "cuccut.sticker" { "templateId" } else { "style" };
            let id = text(parameters, key);
            let what = match generator.as_str() {
                "cuccut.sticker" => "sticker template",
                "cuccut.audio-visualizer" => "audio visualizer style",
                "cuccut.progress" => "progress style",
                _ => "confetti style",
            };
            let found = id.as_deref().is_some_and(lookup);
            (id, found, what)
        }
        _ => return None,
    };
    match (found, id) {
        (true, _) => None,
        (false, Some(id)) => {
            let message = format!("{what} \"{id}\" is not in the catalog shipped with the render kernel");
            Some((Some(id), "preset-unknown", message))
        }
        (false, None) => Some((None, "preset-missing", format!("no {what} specified"))),
    }
}

fn check_content(
    layer: &VisualLayer,
    template: Option<&TemplateDoc>,
    caption: &mut dyn FnMut(&str, Option<&str>) -> Option<CaptionProblem>,
) -> Option<UnsupportedItem> {
    if let Some((id, reason, message)) = catalogue_problem(layer) {
        return Some(UnsupportedItem::layer(layer, id, reason, message));
    }
    match (&layer.kind, &layer.content) {
        (LayerKind::Video | LayerKind::Image | LayerKind::Text | LayerKind::Shape, _) => None,
        (LayerKind::Unsupported, Some(LayerContent::Unsupported { reason })) => {
            Some(UnsupportedItem::layer(layer, None, reason, unsupported_message(reason)))
        }
        (LayerKind::Generator, Some(LayerContent::Generator { generator, parameters, .. })) => {
            if !GENERATORS.contains(&generator.as_str()) {
                return Some(UnsupportedItem::layer(
                    layer,
                    Some(generator.clone()),
                    "generator-not-implemented",
                    format!("\"{generator}\" cannot be drawn"),
                ));
            }
            if generator == "cuccut.template" {
                let layer_id = parameters.get("layerId").and_then(Value::as_str).unwrap_or(&layer.item_id);
                let reason = match template {
                    None => Some("template-missing"),
                    Some(doc) if !doc.layers.iter().any(|l| l.id == layer_id) => Some("template-missing"),
                    Some(doc) => crate::template::unsupported_reason(doc, layer_id),
                };
                if let Some(reason) = reason {
                    return Some(UnsupportedItem::layer(
                        layer,
                        Some(generator.clone()),
                        reason,
                        unsupported_message(reason),
                    ));
                }
            }
            None
        }
        (
            LayerKind::Caption,
            Some(LayerContent::Caption {
                document_id,
                style_document_id,
                ..
            }),
        ) => caption(document_id, style_document_id.as_deref())
            .map(|(kind, reason, message)| UnsupportedItem::layer(layer, kind, reason, message)),
        _ => Some(UnsupportedItem::layer(layer, None, "unknown-layer", "unrecognized layer type")),
    }
}

/// Human-readable description of the frame plan's unsupported reason or of the reason marked unsupported here.
fn unsupported_message(reason: &str) -> &'static str {
    match reason {
        "bundle-without-prerender" => "a code-bundle composition without a prerender stand-in cannot be drawn (generate the prerender stand-in first)",
        "sticker-asset-not-supported" => "a sticker of this asset type cannot be drawn (sticker assets must be images, videos or Lottie)",
        "placeholder-asset-not-supported" => "the asset filling the placeholder cannot be drawn (it must be an image or video)",
        "template-missing" => "the template layer is not found in the sequence's templates",
        "template-logo-image-not-supported" => "the template's image logo cannot be drawn (only text logos are drawn)",
        _ => "this layer cannot be drawn",
    }
}

/// Why a caption layer cannot be drawn: `(recognized kind, reason, description)`.
pub type CaptionProblem = (Option<String>, &'static str, String);

/// Whether a caption layer can be drawn: the caption document and style document both exist and are recognized, and the style has a drawing method. Looks only at the documents, not at the layer.
/// A style that is not recognized is not silently replaced with the default style: preview skips this group of captions and reports it, and export is refused with an explanation.
pub fn caption_problem(documents: &Documents, document_id: &str, style_document_id: Option<&str>) -> Option<CaptionProblem> {
    let Some(document) = documents.get(document_id) else {
        return Some((None, "caption-document-missing", format!("caption document {document_id} is gone")));
    };
    if read_captions(&document.body).is_none() {
        let found = schema(&document.body);
        let message = format!("caption document {} is not recognized", found.clone().unwrap_or_else(|| "(no schema)".into()));
        return Some((found, "caption-unknown-document", message));
    }
    let style_document = match style_document_id {
        Some(id) => match documents.get(id) {
            Some(style) => Some(style),
            None => return Some((None, "caption-style-missing", format!("caption style document {id} is gone"))),
        },
        None => None,
    };
    match CaptionStyle::read(style_document) {
        Ok(_) => None,
        Err(found) => {
            let message = format!(
                "caption style {} is not recognized (export does not replace the style)",
                found.clone().unwrap_or_else(|| "(no schema)".into())
            );
            Some((found, "caption-unknown-style", message))
        }
    }
}

pub(crate) fn schema(value: &Value) -> Option<String> {
    value.get("schema").and_then(Value::as_str).map(str::to_string)
}
