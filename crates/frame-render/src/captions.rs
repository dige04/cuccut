//! Captions: a caption document (`cuccut.caption/1`) is laid out and drawn by the rendering kernel (`subtitle-render`) according to a style document.
//!
//! Caption instances that share one style document form a group (an instance on its own when there is no style document); the group is drawn once, at the position of its first layer, in the whole-canvas coordinate system.
//! A group becomes one caption document for the kernel: the sentences of original captions are `cues`, and those of translated captions (`lineKind: translation`) are `transCues`; the style is the `style` of the Studio style document (`cuccut.legacy-studio-style/0.1`). When the group has only original text it uses original mode, only translation uses translation mode, and with both it uses bilingual mode (top-to-bottom order set by the style's `order`). Display timing (`displayTiming`), the delivery form of punctuation, word-by-word animation and designed-caption recipes are all drawn by the kernel according to the style, byte-for-byte identical to the old version. A group takes its times from its first layer's clock: when the document is on the sequence clock, sequence time is used; when on the source media clock, the source time projected from the acting instance is used.
//!
//! Boxed caption styles (`cuccut.boxed-caption-style/N`, written by the old external project import) are converted into an equivalent Studio style and drawn by the same kernel ([`boxed_as_studio`]): the box position and width become anchor and wrap width, and pixels on the style document canvas are scaled to the output size.

use std::{collections::HashMap, sync::Arc};

use anyhow::Result;
use render_raster::TextEngine;
use serde::Serialize;
use serde_json::{Value, json};
use subtitle_render::{CaptionCompositeMode, OverlayIncludes, OverlayRenderPlan, TemplateScene};
use timeline::template::TemplateDoc;
use tiny_skia::BlendMode;

use crate::caption_words::{Placement, SpeechWords, WordTimes, cue_words_indexed};
use crate::documents::FrozenDocument;

pub const CAPTION_DOCUMENT: &str = "cuccut.caption/1";
/// Studio caption style (the style document of legacy captions).
pub const STUDIO_STYLE: &str = "cuccut.legacy-studio-style/0.1";

/// Boxed caption style: `cuccut.boxed-caption-style/` followed by a version number.
pub fn is_boxed_style(schema: &str) -> bool {
    video_model::caption_style::is_boxed_style_schema(schema)
}

#[derive(Clone, Debug, PartialEq)]
pub struct CaptionCue {
    /// The sentence ID in the document (per-sentence styles of designed captions are looked up by it); empty when not set.
    pub id: String,
    /// Seconds on the document clock.
    pub start: f64,
    pub end: f64,
    pub text: String,
    /// The sentence's `words` (pointing to words in the transcript), unchanged.
    pub refs: Option<Value>,
    /// Words handed to the kernel (filled by [`CaptionTrack::attach_words`]); when empty, the kernel infers them by splitting on whitespace.
    pub words: Vec<Value>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CaptionTrack {
    /// Whether the document is on the sequence clock (otherwise on the source media clock).
    pub sequence_clock: bool,
    pub cues: Vec<CaptionCue>,
}

/// Reads the body of a caption document; returns `None` unless it is `cuccut.caption/1`. Times are integer ticks; `timescale` defaults to 1 000 000.
pub fn read_captions(body: &Value) -> Option<CaptionTrack> {
    let body = body.as_object()?;
    if body.get("schema").and_then(Value::as_str) != Some(CAPTION_DOCUMENT) {
        return None;
    }
    let cues = body.get("cues")?.as_array()?;
    let timescale = match body.get("timescale").and_then(Value::as_f64) {
        Some(t) if t > 0.0 && t.is_finite() => t,
        _ => 1_000_000.0,
    };
    let num = |cue: &serde_json::Map<String, Value>, key: &str| cue.get(key).and_then(Value::as_f64).filter(|v| v.is_finite());
    let cues = cues
        .iter()
        .filter_map(Value::as_object)
        .map(|cue| {
            let start = num(cue, "start").unwrap_or(0.0) / timescale;
            CaptionCue {
                id: cue.get("id").and_then(Value::as_str).unwrap_or_default().to_string(),
                start,
                end: start.max(num(cue, "end").unwrap_or(0.0) / timescale),
                text: cue.get("text").and_then(Value::as_str).unwrap_or_default().to_string(),
                refs: cue.get("words").filter(|w| w.is_object()).cloned(),
                words: Vec::new(),
            }
        })
        .collect();
    Some(CaptionTrack {
        sequence_clock: body.get("clock").and_then(Value::as_str) == Some("sequence"),
        cues,
    })
}

impl CaptionTrack {
    /// Attaches the transcript words to each sentence ([`crate::caption_words`]): cut or hidden words are not given, and a sentence with words removed has its text reassembled from the remaining words.
    pub fn attach_words(&mut self, speech: &SpeechWords, placement: &Placement) {
        // Sentences without `words` pick words by time: the index is built on first use and shared by the whole caption track.
        let mut times: Option<WordTimes> = None;
        for cue in &mut self.cues {
            let refs = cue.refs.as_ref().and_then(|refs| speech.refs(refs));
            let times = match refs {
                Some(_) => None,
                None => Some(&*times.get_or_insert_with(|| WordTimes::new(speech, placement))),
            };
            if let Some(found) = cue_words_indexed(speech, refs.as_deref(), (cue.start, cue.end), self.sequence_clock, placement, times) {
                cue.words = found.words;
                if let Some(text) = found.text {
                    cue.text = text;
                }
            }
        }
    }
}

/// The style read from the style document.
pub enum CaptionStyle {
    /// The root of a Studio style (the `style` object of v2).
    Studio(Value),
    /// The body of a boxed caption style.
    Boxed(Value),
}

/// A Studio style converted for the kernel.
pub struct KernelStyle {
    pub root: Value,
    /// Opacity of the whole caption group (`opacity` of a boxed style; always 1 for a Studio style).
    pub opacity: f32,
    /// Things the conversion cannot carry over (reported as render notes).
    pub notes: Vec<String>,
}

impl CaptionStyle {
    /// The Studio style handed to the kernel (`size` is the output size).
    pub fn kernel_style(&self, size: (u32, u32)) -> KernelStyle {
        match self {
            CaptionStyle::Studio(root) => KernelStyle {
                root: root.clone(),
                opacity: 1.0,
                notes: Vec::new(),
            },
            CaptionStyle::Boxed(body) => boxed_as_studio(body, size),
        }
    }
}

/// Converts a boxed caption style to a Studio style.
///
/// The lengths of a boxed style are pixels on the style document's `canvas`; `k = output width / canvas.width` folds them into output pixels. Studio style font sizes are measured against the 540 short edge, and padding, corner radius and letter spacing are normalized to their own font size (`REFERENCE_FONT_SIZE` 30), so the conversion reverses that here:
/// - Box (`box`: offset of its center from the canvas center, plus width and height) → anchor `x/y` (canvas percentages) and `verticalAlign`: anchored at the box top when aligned to the top, at the box bottom when aligned to the bottom, otherwise at the box center; the wrap width `width` is the box width minus `textPadding` on both sides.
/// - `textPadding` is also the horizontal and vertical padding of the background plate (`backgroundPadding`, `backgroundPaddingY`), so the text sits exactly one padding away from the box edge.
/// - The offset of `textShadow` becomes the shadow's direction and distance; the background plate is drawn when `backgroundColor` opacity is not 0.
/// - Display timing gets no extra padding before or after, and punctuation is not given the delivery form (boxed styles draw the original text).
/// - Word animation: when `animationPresetId` is an entry in the word animation catalog ([`subtitle_render::word_animation_catalog`]), it is drawn with that entry's payload, the same as when that entry is selected in a Studio style; when not set, there is no animation. Imported captions have no word timing, so the kernel infers words by splitting on whitespace (spec §3.8). An unrecognized id is not animated, and a notice is reported.
/// - `textAlign` (left, center, right) is copied as is, and lines are aligned within the wrap width ([`subtitle_render::ALIGN_WITHIN_WRAP_KEY`]): left-aligned lines stick to the box's left edge (one padding in), right-aligned lines to the right edge, and the background plate follows the text.
pub fn boxed_as_studio(body: &Value, size: (u32, u32)) -> KernelStyle {
    let (width, height) = (f64::from(size.0.max(1)), f64::from(size.1.max(1)));
    let object = |value: Option<&Value>| value.filter(|v| v.is_object()).cloned().unwrap_or_else(|| json!({}));
    let style = object(body.get("style"));
    let frame = object(body.get("box"));
    let canvas = object(body.get("canvas"));
    let num =
        |value: &Value, key: &str, fallback: f64| value.get(key).and_then(Value::as_f64).filter(|v| v.is_finite()).unwrap_or(fallback);
    let text = |key: &str| style.get(key).and_then(Value::as_str).map(str::to_string);
    let k = width / num(&canvas, "width", width).max(1.0);
    let pad = num(&style, "textPadding", 0.0).max(0.0) * k;
    let font_px = num(&style, "fontSize", 40.0).max(1.0) * k * num(&style, "scale", 1.0).max(0.05);
    // Studio style font size unit: pixels on the 540 short edge; padding and similar are normalized by `font_px / 30`.
    let short_edge = width.min(height);
    let size_scale = font_px / 30.0;
    let box_width = (num(&frame, "width", width * 0.8 / k) * k).max(1.0);
    let box_height = (num(&frame, "height", height * 0.2 / k) * k).max(1.0);
    let center_x = width / 2.0 + num(&frame, "x", 0.0) * k;
    let center_y = height / 2.0 + num(&frame, "y", 0.0) * k;
    let (anchor_y, align) = match style.get("verticalAlign").and_then(Value::as_str) {
        Some("top") => (center_y - box_height / 2.0, "top"),
        Some("bottom") => (center_y + box_height / 2.0, "bottom"),
        _ => (center_y, "center"),
    };
    let mut root = json!({
        "x": center_x / width * 100.0,
        "y": anchor_y / height * 100.0,
        "verticalAlign": align,
        "width": ((box_width - pad * 2.0).max(1.0) / width * 100.0),
        "scale": 1.0,
        "fontSize": font_px * timeline::REFERENCE_SHORT_EDGE / short_edge,
        "fontColor": text("color").unwrap_or_else(|| "#FFFFFF".into()),
        "lineHeight": num(&style, "lineHeight", 1.2).max(0.5),
        "letterSpacing": num(&style, "letterSpacing", 0.0) * k / size_scale,
        "backgroundPadding": pad / (size_scale * 0.8),
        "backgroundPaddingY": pad / (size_scale * 0.8),
        "borderRadius": num(&style, "backgroundRadius", 0.0).max(0.0) * k / (size_scale * 0.55),
        "background": text("backgroundColor").and_then(|c| crate::effects::hex_rgba(&c)).is_some_and(|c| c[3] > 0),
        "displayTiming": { "leadIn": 0, "tail": 0 },
        "punct": false,
        // No animation when no word animation is selected (the Studio style default is per-word color change).
        "anim": { "name": "None" },
    });
    let mut notes = Vec::new();
    match style.get("animationPresetId") {
        None | Some(Value::Null) => {}
        Some(Value::String(id)) if subtitle_render::word_animation_catalog::word_animation_entry(id).is_some() => {
            root["anim"] = subtitle_render::word_animation_catalog::word_animation_payload(id);
        }
        Some(other) => notes.push(format!("字幕动画预设 {other} 认不出，按不动画画")),
    }
    if let Some(family) = style.get("fontFamily").filter(|v| v.is_string()) {
        root["fontFamily"] = family.clone();
    }
    if let Some(weight) = style.get("fontWeight").filter(|v| v.is_number() || v.is_string()) {
        root["fontWeight"] = weight.clone();
    }
    for (from, to) in [("fontStyle", "fontStyle"), ("backgroundColor", "backgroundColor")] {
        if let Some(value) = text(from) {
            root[to] = json!(value);
        }
    }
    if style.get("underline") == Some(&Value::Bool(true)) {
        root["underline"] = json!(true);
    }
    if style.get("allCaps") == Some(&Value::Bool(true)) {
        root["textTransform"] = json!("uppercase");
    }
    let shadow = object(style.get("textShadow"));
    if let Some([r, g, b, a]) = shadow
        .get("color")
        .and_then(Value::as_str)
        .and_then(crate::effects::hex_rgba)
        .filter(|c| c[3] > 0)
    {
        let (dx, dy) = (num(&shadow, "offsetX", 0.0) * k, num(&shadow, "offsetY", 0.0) * k);
        root["dropShadow"] = json!({
            "on": true,
            "color": format!("#{r:02X}{g:02X}{b:02X}"),
            "opacity": f64::from(a) / 255.0,
            "distance": dx.hypot(dy) / font_px,
            "rotation": dy.atan2(dx).to_degrees(),
            "blur": num(&shadow, "blur", 0.0).max(0.0) * k / font_px,
        });
    } else {
        root["dropShadow"] = json!({ "on": false });
    }
    if let Some(side @ ("left" | "center" | "right")) = style.get("textAlign").and_then(Value::as_str) {
        root["textAlign"] = json!(side);
    }
    root[subtitle_render::ALIGN_WITHIN_WRAP_KEY] = json!(true);
    KernelStyle {
        root,
        opacity: num(&style, "opacity", 1.0).clamp(0.0, 1.0) as f32,
        notes,
    }
}

impl CaptionStyle {
    /// Without a style document, the default preset is used (spec §5.6, [`video_model::caption_style::default_studio_style`]). For an unrecognized style, its schema is reported. When there is a style document, it is drawn as written: keys it does not set fall back to the kernel's defaults, and are not filled in from the default preset.
    pub fn read(style: Option<&FrozenDocument>) -> Result<CaptionStyle, Option<String>> {
        let Some(document) = style else {
            return Ok(CaptionStyle::Studio(video_model::caption_style::default_studio_style()));
        };
        match document.body.get("schema").and_then(Value::as_str) {
            Some(STUDIO_STYLE) => Ok(CaptionStyle::Studio(
                document
                    .body
                    .get("style")
                    .filter(|v| v.is_object())
                    .cloned()
                    .unwrap_or_else(|| json!({})),
            )),
            Some(s) if is_boxed_style(s) => Ok(CaptionStyle::Boxed(document.body.clone())),
            other => Err(other.map(str::to_string)),
        }
    }
}

/// Designed-caption emphasis (`captionEmphasis` at the style root) is keyed by word ID. When a multi-character CJK word is drawn, it is split into `<word ID>~<k>`, and emphasis set on the whole word applies to each character it is split into (characters with their own emphasis are left alone).
fn split_emphasis(style: &mut Value, cues: &[Value]) {
    let Some(emphasis) = style.get_mut("captionEmphasis").and_then(Value::as_object_mut) else {
        return;
    };
    let ids = cues
        .iter()
        .flat_map(|cue| cue.get("words").and_then(Value::as_array).into_iter().flatten())
        .filter_map(|word| word.get("id").and_then(Value::as_str));
    for id in ids {
        let Some((parent, _)) = id.rsplit_once('~') else { continue };
        if emphasis.contains_key(id) {
            continue;
        }
        if let Some(value) = emphasis.get(parent).cloned() {
            emphasis.insert(id.to_string(), value);
        }
    }
}

/// Whether the caption document's line kind is translation.
pub fn is_translation(document: &FrozenDocument) -> bool {
    document.line_kind.as_deref() == Some("translation")
}

/// Caption line box measured by the renderer (output pixels), rotated about the line's center.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionHit {
    pub layer_id: String,
    pub item_id: String,
    pub document_id: String,
    pub cue_id: String,
    pub cx: f64,
    pub cy: f64,
    pub w: f64,
    pub h: f64,
    pub rotation: f64,
}

/// One frame of the caption layer: premultiplied RGBA (shared with the kernel's frame buffer), the bounding rectangle of non-zero pixels, and the blend mode.
pub struct CaptionLayer {
    pub rgba: Arc<Vec<u8>>,
    pub width: u32,
    pub height: u32,
    /// `(left, top, right, bottom)`, in pixels, right and bottom exclusive; covers all non-zero pixels.
    pub rect: (usize, usize, usize, usize),
    pub blend: BlendMode,
}

/// The kernel plan compiled for one group of captions.
pub struct CaptionPlan {
    plan: OverlayRenderPlan,
    sources: HashMap<(bool, String), (String, String)>,
    /// Whether the first document in the group is on the sequence clock.
    pub sequence_clock: bool,
    /// Opacity of the whole group (from the style).
    pub opacity: f32,
    notes: Vec<String>,
    /// Font families missing when setting text (persistent).
    missing: std::collections::BTreeSet<String>,
}

impl CaptionPlan {
    /// Compiles a group of captions: `members` are the caption documents of the layers in the group (already confirmed readable), in layer order.
    pub fn compile(
        style: &CaptionStyle,
        members: &[(&FrozenDocument, CaptionTrack)],
        size: (u32, u32),
        fps: f64,
        text: TextEngine,
        fonts_loaded: usize,
    ) -> Result<CaptionPlan> {
        let mut sources = HashMap::new();
        let mut cues = |translation: bool| -> Vec<Value> {
            let mut cues: Vec<(&FrozenDocument, &CaptionCue)> = members
                .iter()
                .filter(|(document, _)| is_translation(document) == translation)
                .flat_map(|(document, track)| track.cues.iter().map(move |cue| (*document, cue)))
                .collect();
            cues.retain(|(_, cue)| !cue.text.trim().is_empty());
            cues.sort_by(|(_, a), (_, b)| a.start.total_cmp(&b.start));
            // Sentence IDs are kept as in the document (per-sentence styles and emphasis are looked up by ID); a missing or duplicate ID is filled in by order.
            let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
            cues.iter()
                .enumerate()
                .map(|(index, (document, cue))| {
                    let mut id = if cue.id.is_empty() { format!("c{index}") } else { cue.id.clone() };
                    let mut n = 1;
                    while !seen.insert(id.clone()) {
                        n += 1;
                        id = format!("{}#{n}", if cue.id.is_empty() { format!("c{index}") } else { cue.id.clone() });
                    }
                    sources.insert((translation, id.clone()), (document.document_id.clone(), cue.id.clone()));
                    let mut value = json!({ "id": id, "start": cue.start, "end": cue.end, "text": cue.text });
                    // When the same sentence appears several times on the sequence, each ID gets a suffix, while per-sentence styles are still looked up by the ID in the document.
                    if !cue.id.is_empty() {
                        value["sourceItemId"] = json!(cue.id);
                    }
                    if !cue.words.is_empty() {
                        value["words"] = Value::Array(cue.words.clone());
                    }
                    value
                })
                .collect()
        };
        let KernelStyle {
            root: mut style_root,
            opacity,
            notes,
        } = style.kernel_style(size);
        let (original, translation) = (cues(false), cues(true));
        split_emphasis(&mut style_root, &original);
        let mode = match (original.is_empty(), translation.is_empty()) {
            (false, false) => "bilingual",
            (true, false) => "trans",
            _ => "orig",
        };
        let end = members
            .iter()
            .flat_map(|(_, track)| &track.cues)
            .map(|cue| cue.end)
            .fold(0.0_f64, f64::max);
        let document = json!({
            "style": style_root,
            "cues": original,
            "transCues": translation,
        });
        let includes = OverlayIncludes {
            subtitles: true,
            texts: false,
            media_overlays: false,
            watermarks: false,
        };
        // The duration only decides which path the kernel takes to fetch caption frames; leave room for the display timing tail.
        let duration = end + 3600.0;
        let plan = OverlayRenderPlan::compile_with_text_engine(
            &document,
            size.0,
            size.1,
            duration,
            fps,
            Some(mode),
            includes,
            fonts_loaded,
            text,
        )?;
        Ok(CaptionPlan {
            plan,
            sources,
            sequence_clock: members.first().is_some_and(|(_, track)| track.sequence_clock),
            opacity,
            notes,
            missing: Default::default(),
        })
    }

    /// The sequence's template layer (caption avoidance, format spec §3.17): a full-width bar at the bottom lifts the captions up. Only the avoidance is taken; the template itself is drawn by the template layer.
    pub fn avoid_template(&mut self, template: Option<&TemplateDoc>) {
        if self.plan.template_scene().map(|scene| &scene.doc) == template {
            return;
        }
        self.plan
            .set_template_scene(template.map(|doc| TemplateScene::new(doc.clone(), Vec::new(), "", Vec::new())));
    }

    /// Takes the layout engine apart, for use by the next plan.
    pub fn into_text_engine(self) -> TextEngine {
        self.plan.into_text_engine()
    }

    /// The caption layer at the moment `seconds` on the document clock; `None` when there is no caption at that moment.
    ///
    /// The pixels are shared with the kernel's frame buffer (the full buffer is not copied) and are handed out together with the content box the kernel computed, so the caller does not need to scan again.
    pub fn render(&mut self, seconds: f64) -> Result<Option<CaptionLayer>> {
        let frame = self.plan.render_subtitle_frame(seconds.max(0.0))?;
        let Some(bounds) = frame.bounds else {
            return Ok(None);
        };
        let (width, height) = (self.plan.width, self.plan.height);
        if frame.rgba.len() != width as usize * height as usize * 4 {
            anyhow::bail!("字幕层的尺寸不对");
        }
        let blend = match frame.composite {
            CaptionCompositeMode::Normal => BlendMode::SourceOver,
            CaptionCompositeMode::Difference => BlendMode::Difference,
            CaptionCompositeMode::Exclusion => BlendMode::Exclusion,
            CaptionCompositeMode::Screen => BlendMode::Screen,
        };
        Ok(Some(CaptionLayer {
            rgba: frame.rgba,
            width,
            height,
            rect: (bounds.cols.start, bounds.rows.start, bounds.cols.end, bounds.rows.end),
            blend,
        }))
    }

    /// Line geometry from the same source as the raster; the UI does not estimate glyph widths or redo display timing.
    pub fn hits(&mut self, seconds: f64) -> Result<Vec<CaptionHit>> {
        let layout = self.plan.subtitle_layout(seconds)?;
        let mut hits = Vec::new();
        let mut push = |translation: bool, cue: &str, cx, cy, w, h, rotation| {
            if let Some((document_id, cue_id)) = self.sources.get(&(translation, cue.to_owned())) {
                hits.push(CaptionHit {
                    layer_id: String::new(),
                    item_id: String::new(),
                    document_id: document_id.clone(),
                    cue_id: cue_id.clone(),
                    cx,
                    cy,
                    w,
                    h,
                    rotation,
                });
            }
        };
        let angle = layout.rotation.to_radians();
        for line in &layout.lines {
            let dx = line.x + line.w / 2.0 - layout.anchor.0;
            let dy = line.y + line.h / 2.0 - layout.anchor.1;
            push(
                line.kind == "trans",
                &line.cue_id,
                layout.anchor.0 + dx * angle.cos() - dy * angle.sin(),
                layout.anchor.1 + dx * angle.sin() + dy * angle.cos(),
                line.w,
                line.h,
                layout.rotation,
            );
        }
        if let Some(sequence) = layout.sequence {
            for row in sequence.rows.iter().filter(|row| row.visible) {
                let [a, b, c, d] = row.quad;
                push(
                    false,
                    &row.cue_id,
                    (a[0] + c[0]) / 2.0,
                    (a[1] + c[1]) / 2.0,
                    (b[0] - a[0]).hypot(b[1] - a[1]),
                    (d[0] - a[0]).hypot(d[1] - a[1]),
                    (b[1] - a[1]).atan2(b[0] - a[0]).to_degrees(),
                );
            }
        }
        Ok(hits)
    }

    /// Notices for this caption group (from style conversion, and from kernel compilation and drawing) and font families missing when setting text. Persistent: the kernel caches frames it has already drawn and does not report them again, so the full set is given with every frame drawn, and the caller de-duplicates.
    pub fn notes(&mut self) -> (Vec<String>, Vec<String>) {
        for note in std::mem::take(&mut self.plan.warnings) {
            if !self.notes.contains(&note) {
                self.notes.push(note);
            }
        }
        self.missing.extend(self.plan.text.take_missing_families());
        (self.notes.clone(), self.missing.iter().cloned().collect())
    }
}

// Display timing (padding before and after, short gaps split evenly in half) and the delivery form of punctuation are computed by the kernel from the style; verified in `subtitle-render`'s `short_gaps_are_split_exactly_between_tail_and_lead_in` and `video_plan_projects_punctuation_in_every_language_and_honors_the_style_switch`.
#[cfg(test)]
mod tests {
    use super::*;

    fn caption(cues: &[(f64, f64, &str)], clock: &str) -> Value {
        json!({
            "schema": CAPTION_DOCUMENT, "clock": clock, "timescale": 1000,
            "cues": cues.iter().map(|(s, e, t)| json!({ "start": (s * 1000.0) as i64, "end": (e * 1000.0) as i64, "text": t }))
                .collect::<Vec<_>>(),
        })
    }

    #[test]
    fn reads_documents_in_seconds() {
        let track = read_captions(&caption(&[(1.5, 2.0, "你好")], "sequence")).unwrap();
        assert!(track.sequence_clock);
        assert_eq!(
            track.cues[0],
            CaptionCue {
                id: String::new(),
                start: 1.5,
                end: 2.0,
                text: "你好".into(),
                refs: None,
                words: Vec::new(),
            }
        );
        // If the end is before the start, the length is zero; without `timescale`, times are in microseconds.
        let track = read_captions(&json!({ "schema": CAPTION_DOCUMENT, "cues": [{ "start": 3_000_000, "end": 1, "text": "a" }] })).unwrap();
        assert!(!track.sequence_clock);
        assert_eq!((track.cues[0].start, track.cues[0].end), (3.0, 3.0));
        assert!(read_captions(&json!({ "schema": "other/1", "cues": [] })).is_none());
        assert!(read_captions(&Value::Null).is_none());
    }

    #[test]
    fn boxed_schema_versions() {
        assert!(is_boxed_style("cuccut.boxed-caption-style/1"));
        assert!(is_boxed_style("cuccut.boxed-caption-style/12"));
        assert!(!is_boxed_style("cuccut.boxed-caption-style/"));
        assert!(!is_boxed_style("cuccut.boxed-caption-style/1a"));
    }

    #[test]
    fn boxed_styles_become_the_equivalent_studio_style() {
        let body = json!({
            "schema": "cuccut.boxed-caption-style/1",
            "canvas": { "width": 3840, "height": 2160 },
            "box": { "x": 192, "y": 540, "width": 1920, "height": 432 },
            "style": {
                "fontFamily": "Noto Sans SC", "fontSize": 96, "color": "#FFEE00", "verticalAlign": "bottom",
                "textPadding": 24, "backgroundColor": "#00000080", "backgroundRadius": 12, "letterSpacing": 4,
                "textShadow": { "color": "#00000040", "offsetX": 0, "offsetY": 8, "blur": 6 },
                "allCaps": true, "opacity": 0.8, "textAlign": "left",
            },
        });
        // Output 1920×1080: k = 0.5, glyphs 48 px (24 on the 540 short edge), and the ratio normalized to size 30 is 1.6.
        let KernelStyle { root, opacity, notes } = boxed_as_studio(&body, (1920, 1080));
        let close = |key: &str, expected: f64| {
            let got = root[key].as_f64().unwrap();
            assert!((got - expected).abs() < 1e-9, "{key}: {got} ≠ {expected}");
        };
        // Box center (960 + 96, 540 + 270), height 216: anchored at the bottom of the box, 918, when aligned to the bottom.
        close("x", 1056.0 / 1920.0 * 100.0);
        close("y", 918.0 / 1080.0 * 100.0);
        assert_eq!(root["verticalAlign"], "bottom");
        // Wrap width: box width 960 minus 12 padding on each side.
        close("width", 936.0 / 1920.0 * 100.0);
        close("fontSize", 24.0);
        close("backgroundPadding", 12.0 / (1.6 * 0.8));
        close("backgroundPaddingY", 12.0 / (1.6 * 0.8));
        close("borderRadius", 6.0 / (1.6 * 0.55));
        close("letterSpacing", 2.0 / 1.6);
        assert_eq!(root["background"], true);
        assert_eq!(root["textTransform"], "uppercase");
        assert_eq!(root["fontFamily"], "Noto Sans SC");
        // Shadow offset 4 px down with a 3 px blur, both measured against the font size.
        let shadow = &root["dropShadow"];
        assert_eq!(shadow["color"], "#000000");
        assert!((shadow["opacity"].as_f64().unwrap() - 64.0 / 255.0).abs() < 1e-9);
        assert!((shadow["distance"].as_f64().unwrap() - 4.0 / 48.0).abs() < 1e-9);
        assert!((shadow["rotation"].as_f64().unwrap() - 90.0).abs() < 1e-9);
        assert!((shadow["blur"].as_f64().unwrap() - 3.0 / 48.0).abs() < 1e-9);
        assert_eq!(root["punct"], false);
        assert_eq!(root["anim"]["name"], "None");
        assert!((opacity - 0.8).abs() < 1e-6);
        assert!(notes.is_empty(), "左右对齐照画，不再报提示：{notes:?}");
        assert_eq!(root["textAlign"], "left");
        assert_eq!(root[subtitle_render::ALIGN_WITHIN_WRAP_KEY], true);
    }

    #[test]
    fn boxed_animation_presets_pick_the_catalogue_cell() {
        let boxed = |preset: Value| json!({ "schema": "cuccut.boxed-caption-style/18", "style": { "animationPresetId": preset } });
        let KernelStyle { root, notes, .. } = boxed_as_studio(&boxed(json!("reveal")), (1920, 1080));
        assert_eq!(
            root["anim"],
            subtitle_render::word_animation_catalog::word_animation_payload("reveal")
        );
        assert_eq!(root["anim"]["animationName"], "Reveal");
        assert_eq!(root["anim"]["catalogId"], "reveal");
        assert!(notes.is_empty(), "{notes:?}");
        // Unrecognized ones are not animated; a notice is reported.
        let KernelStyle { root, notes, .. } = boxed_as_studio(&boxed(json!("typewriter")), (1920, 1080));
        assert_eq!(root["anim"]["name"], "None");
        assert_eq!(notes.len(), 1, "{notes:?}");
    }

    #[test]
    fn the_engine_and_the_kernel_share_one_catalogue() {
        let kernel: Vec<_> = subtitle_render::word_animation_catalog::WORD_ANIMATIONS
            .iter()
            .map(|entry| entry.catalog_id)
            .collect();
        assert_eq!(kernel, video_model::caption_style::WORD_ANIMATION_IDS);
    }
}
