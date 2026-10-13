//! Template layer document (the wire shape of the top-level `template` in `timeline.json` and of the brand library `templates[]`).
//!
//! A template is a **layer document**: the four layer kinds `chapters | progress | logo | text` are positioned by percentage of the frame, and array order is the z-order (later items are drawn on top). This file contains only the shapes; validation, pure derivations (segmentation, variables, hit testing) and the built-in catalog are in `ccut-timeline::template`, and the write path is in `ccut-workspace::template`.
//!
//! v2 is in `ccut-protocol/src/template.rs` and was copied here as-is; only the `JsonSchema` derive used for generating JSON Schema and its test `schema_generates` were removed (this crate does not depend on `schemars`).
//!
//! There is no separate watermark format (2026-09-14, ledger 2026-09-14-230340): a watermark is simply a template with only a logo layer. The logo layer expresses it with `tile` (diagonal tiling) and `opacity` (whole-layer opacity), and `tag: "watermark"` marks this category. Old Brand kit watermark presets, once imported, become brand library templates with `imported: "watermark"`.
//!
//! Colors are always `#RRGGBB[AA]`; sizes (`size`) are percentages of the frame height; `font` is a font family name, where `None` means follow the caption style font; `mono` text layers always use the built-in monospace family and ignore `font`.

use serde::{Deserialize, Serialize};

/// Minimum layer width (percentage of the frame).
pub const MIN_W: f64 = 4.0;
/// Minimum layer height (percentage of the frame).
pub const MIN_H: f64 = 0.6;
/// The `{variable}` names available to text layers.
pub const VAR_NAMES: &[&str] = &[
    "chapter", "n", "count", "time", "remain", "total", "percent", "title",
];
/// Catalog card hue names (the value set from prototype round 112; on 2026-09-14 the platform edition added red / green / pink).
pub const HUES: &[&str] = &[
    "purple", "cyan", "orange", "yellow", "magenta", "blue", "gray", "red", "green", "pink",
];
/// Lower bound of the logo layer's opacity: 0 would be the same as turning the layer off, which is what `on` is for.
pub const MIN_OPACITY: f64 = 0.05;
/// The watermark-category values of `TemplateDoc::tag` (the three built-in watermarks and the imported old watermarks all carry it).
pub const TAG_WATERMARK: &str = "watermark";
/// The provenance values of `TemplateDoc::imported`: imported from an old Brand kit watermark preset.
pub const IMPORTED_WATERMARK: &str = "watermark";

/// Whole-layer opacity is clamped to `[MIN_OPACITY, 1]`; a non-number counts as 1 (prototype `clampOpacity`).
pub fn clamp_opacity(v: f64) -> f64 {
    if v.is_nan() {
        1.0
    } else {
        v.clamp(MIN_OPACITY, 1.0)
    }
}

/// Template canvas (frame) size.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum TemplateCanvas {
    #[default]
    #[serde(rename = "16:9")]
    Wide,
    #[serde(rename = "9:16")]
    Tall,
}

impl TemplateCanvas {
    pub fn as_str(self) -> &'static str {
        match self {
            TemplateCanvas::Wide => "16:9",
            TemplateCanvas::Tall => "9:16",
        }
    }

    pub fn ratio(self) -> f64 {
        match self {
            TemplateCanvas::Wide => 16.0 / 9.0,
            TemplateCanvas::Tall => 9.0 / 16.0,
        }
    }
}

/// Layer box; units are percentages of the frame.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LayerBox {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl LayerBox {
    pub const fn new(x: f64, y: f64, w: f64, h: f64) -> Self {
        Self { x, y, w, h }
    }
}

/// Fill mode of the chapter strip: `bar` is a progress bar at the bottom, `dim` tints the whole segment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChapterFill {
    #[default]
    Bar,
    Dim,
}

/// Logo shape.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogoShape {
    #[default]
    Badge,
    Plain,
}

/// Horizontal alignment: text layers default to left (`#[default]`), logo layers default to centered (see [`LayerKind::Logo`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TextAlign {
    #[default]
    Left,
    Center,
    Right,
}

/// The carrier for the `"text"` literal (`LogoSrc::Text`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LogoText {
    #[serde(rename = "text")]
    Text,
}

/// Logo source: a text badge, a brand library image id, or an image file at a project-relative path.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LogoSrc {
    Text(LogoText),
    BrandLogo {
        #[serde(rename = "brandLogo")]
        brand_logo: String,
    },
    File {
        file: String,
    },
}

impl LogoSrc {
    pub const TEXT: LogoSrc = LogoSrc::Text(LogoText::Text);

    pub fn brand(id: impl Into<String>) -> Self {
        LogoSrc::BrandLogo {
            brand_logo: id.into(),
        }
    }

    pub fn file(path: impl Into<String>) -> Self {
        LogoSrc::File { file: path.into() }
    }

    pub fn is_text(&self) -> bool {
        matches!(self, LogoSrc::Text(_))
    }
}

impl Default for LogoSrc {
    fn default() -> Self {
        LogoSrc::TEXT
    }
}

/// Layer types and their respective parameters; `kind` and the common fields of `TemplateLayer` are flattened into the same object.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "lowercase",
    rename_all_fields = "camelCase"
)]
pub enum LayerKind {
    /// Chapter strip: split into segments by chapter duration, with the current segment highlighted.
    Chapters {
        #[serde(default)]
        fill: ChapterFill,
        bg: String,
        color: String,
        accent: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        color_done: Option<String>,
        #[serde(default = "default_true")]
        divider: bool,
        #[serde(default = "default_chapters_size")]
        size: f64,
    },
    /// Progress line: a thin line filled according to playback progress.
    Progress { accent: String, track: String },
    /// Logo: a text badge or an image.
    Logo {
        #[serde(default)]
        src: LogoSrc,
        #[serde(default)]
        text: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        bg: Option<String>,
        color: String,
        #[serde(default)]
        shape: LogoShape,
        /// Horizontal alignment of text or image within the box. Defaults to centered, and centered is not written to disk. The background still fills the box as before; alignment has no effect when tiled.
        /// The default is given separately: `TextAlign`'s own default is left, which is what text layers use.
        #[serde(
            default = "default_logo_align",
            skip_serializing_if = "is_center_align"
        )]
        align: TextAlign,
        #[serde(default = "default_logo_size")]
        size: f64,
        /// Left/right inner padding of the text from the box edges, in the same units as `size` (percentage of frame height). By default it is derived from the font size (badge 0.6em, no background 0). When several text layers need to start from the same vertical line, give them the same value: paddings derived in em follow each layer's own font size, so they will not line up if the sizes differ. Image logos and tiling ignore it.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pad: Option<f64>,
        /// Diagonally tiled across the whole box (for watermarks); by default only one copy is drawn.
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        tile: bool,
        /// Whole-layer opacity. On read it is clamped to `[0.05, 1]` via [`clamp_opacity`]; the default 1 is not written to disk.
        #[serde(default = "default_opacity", skip_serializing_if = "is_full_opacity")]
        opacity: f64,
    },
    /// Text: supports variables such as `{chapter}`.
    Text {
        text: String,
        color: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        bg: Option<String>,
        #[serde(default)]
        align: TextAlign,
        #[serde(default = "default_text_size")]
        size: f64,
        /// Left/right inner padding of the text from the box edges, in the same units as `size`; defaults to 0.5em (derived from the font size), with the same meaning as the logo's `pad`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pad: Option<f64>,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        mono: bool,
        #[serde(default = "default_weight")]
        weight: u16,
    },
}

impl LayerKind {
    /// The `kind` name on the wire.
    pub fn name(&self) -> &'static str {
        match self {
            LayerKind::Chapters { .. } => "chapters",
            LayerKind::Progress { .. } => "progress",
            LayerKind::Logo { .. } => "logo",
            LayerKind::Text { .. } => "text",
        }
    }

    /// Full-width strip-type layers (chapter strip, progress line); caption avoidance only considers these two kinds.
    pub fn is_strip(&self) -> bool {
        matches!(
            self,
            LayerKind::Chapters { .. } | LayerKind::Progress { .. }
        )
    }

    /// The effective whole-layer opacity: logo layers are clamped per `opacity`; other kinds are always 1.
    pub fn opacity(&self) -> f64 {
        match self {
            LayerKind::Logo { opacity, .. } => clamp_opacity(*opacity),
            _ => 1.0,
        }
    }

    /// Whether this is a tiled logo.
    pub fn tiled(&self) -> bool {
        matches!(self, LayerKind::Logo { tile: true, .. })
    }
}

/// One layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TemplateLayer {
    pub id: String,
    #[serde(default = "default_true")]
    pub on: bool,
    #[serde(rename = "box")]
    pub rect: LayerBox,
    #[serde(flatten)]
    pub kind: LayerKind,
}

/// One template (a definition or an instance).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDoc {
    pub id: String,
    pub name: String,
    /// Catalog card hue name; see [`HUES`].
    #[serde(default = "default_hue")]
    pub hue: String,
    /// Catalog group key (written only for the built-in catalog: `chapters` / `info` / `vertical` / `douyin` / `xhs` /
    /// `youtube` / `bili` / `watermark`). Unknown or missing values are filed under “info bar”; brand library entries are always filed under the brand library group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(default)]
    pub canvas: TemplateCanvas,
    /// When applied, changes the **project canvas** to this value (optional; by default only layers are stacked and the canvas is left alone). Values use the same syntax as `ccut canvas --ratio`: `"original"` follows the source size, or `W:H` (`"16:9"`, `"9:16"`, `"2.35:1"`). This is a different thing from `canvas`, which sets the aspect ratio the layout is drawn for.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ratio: Option<String>,
    /// Aspect-ratio lock (prototype round 218): when true together with `ratio`, a project that has this template applied cannot change its aspect ratio in the stage ratio button, in project settings, or with `ccut project canvas` (it may only be changed to `ratio` itself). To change it, unlock it in the template settings first. Without `ratio` this field has no effect; see [`ratio_lock`].
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub lock_ratio: bool,
    /// `true` for the built-in catalog; `false` for instances and for entries stored in the brand library.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub builtin: bool,
    /// Category tag: `"watermark"` ([`TAG_WATERMARK`]) marks the watermark category; the catalog and brand page use it to show a chip.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    /// Provenance tag: `"watermark"` ([`IMPORTED_WATERMARK`]) marks an import from an old watermark preset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported: Option<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub desc: String,
    /// The font family for the whole template; `None` follows the caption style font.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font: Option<String>,
    /// The definition id the instance came from (built-in or brand library).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    /// Whether captions avoid the bottom strip.
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub subs_avoid: bool,
    #[serde(default)]
    pub layers: Vec<TemplateLayer>,
}

impl TemplateDoc {
    pub fn layer(&self, id: &str) -> Option<&TemplateLayer> {
        self.layers.iter().find(|l| l.id == id)
    }

    pub fn layer_mut(&mut self, id: &str) -> Option<&mut TemplateLayer> {
        self.layers.iter_mut().find(|l| l.id == id)
    }

    /// Watermark-category template (prototype `isWatermark`).
    pub fn is_watermark(&self) -> bool {
        self.tag.as_deref() == Some(TAG_WATERMARK)
    }

    /// A brand library template imported from an old watermark preset.
    pub fn is_imported_watermark(&self) -> bool {
        self.imported.as_deref() == Some(IMPORTED_WATERMARK)
    }
}

fn default_true() -> bool {
    true
}

fn is_true(v: &bool) -> bool {
    *v
}

fn default_hue() -> String {
    "gray".to_string()
}

fn default_chapters_size() -> f64 {
    2.6
}

fn default_logo_size() -> f64 {
    3.0
}

fn default_logo_align() -> TextAlign {
    TextAlign::Center
}

fn is_center_align(v: &TextAlign) -> bool {
    *v == TextAlign::Center
}

fn default_text_size() -> f64 {
    2.8
}

fn default_weight() -> u16 {
    700
}

fn default_opacity() -> f64 {
    1.0
}

/// If fully opaque (or not a number, which reads back as 1), it is not written to disk.
fn is_full_opacity(v: &f64) -> bool {
    v.is_nan() || *v >= 1.0
}

// ---------- Validation ----------

/// Validates the semantic constraints of a layer document: id/name/hue/font, layer ids unique, boxes not out of bounds and above minimum sizes, colors `#RRGGBB[AA]`, sizes positive, paddings non-negative, font weight 100..=900, and `file` must be a project-relative path.
/// Error messages are user-facing; `ccut-timeline` and `ccut-config` each wrap them in their own layer's error type.
pub fn validate(doc: &TemplateDoc) -> Result<(), String> {
    check_id("template", &doc.id)?;
    if doc.name.trim().is_empty() {
        return Err(format!("template {} is missing name", doc.id));
    }
    if !HUES.contains(&doc.hue.as_str()) {
        return Err(format!(
            "template {} hue is not in the allowed set: {}",
            doc.id, doc.hue
        ));
    }
    if let Some(font) = &doc.font {
        if font.trim().is_empty() {
            return Err(format!("template {} font cannot be an empty string", doc.id));
        }
    }
    if let Some(ratio) = &doc.ratio {
        check_ratio(ratio).map_err(|error| format!("template {} ratio {error}", doc.id))?;
    }
    let mut seen = std::collections::BTreeSet::new();
    for layer in &doc.layers {
        check_id("template layer", &layer.id)?;
        if !seen.insert(layer.id.as_str()) {
            return Err(format!("template {} has duplicate layer id: {}", doc.id, layer.id));
        }
        check_box(&layer.id, &layer.rect)?;
        check_layer_kind(&layer.id, &layer.kind)?;
    }
    Ok(())
}

/// Whether `ratio` means “follow the source size” (`original`, case-insensitive).
pub fn ratio_is_original(text: &str) -> bool {
    text.trim().eq_ignore_ascii_case("original")
}

/// The aspect ratio locked by the template (prototype `ratioLock`): it counts as locked only when `lockRatio` is true and `ratio` is declared. `ratio` is the locked target (`original` or `W:H`); `name` is for the copy, to state which template did the locking.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RatioLock {
    pub ratio: String,
    pub name: String,
}

impl RatioLock {
    /// Whether the locked target is “follow the source size”.
    pub fn is_original(&self) -> bool {
        ratio_is_original(&self.ratio)
    }

    /// Whether the requested aspect ratio (`None` = original) matches the locked target. A matching write is allowed, so applying the template itself, undo/redo and idempotent re-applies are never blocked by their own lock.
    pub fn allows(&self, requested: Option<&str>) -> bool {
        ratio_equivalent(Some(self.ratio.as_str()), requested)
    }
}

/// The template's aspect-ratio lock; `None` if not locked (`lockRatio` false or `ratio` missing).
pub fn ratio_lock(doc: &TemplateDoc) -> Option<RatioLock> {
    if !doc.lock_ratio {
        return None;
    }
    let ratio = doc.ratio.as_deref()?.trim();
    if ratio.is_empty() {
        return None;
    }
    Some(RatioLock {
        ratio: ratio.to_owned(),
        name: doc.name.clone(),
    })
}

/// Whether the template locks the aspect ratio (prototype `ratioLocked`).
pub fn ratio_locked(doc: &TemplateDoc) -> bool {
    ratio_lock(doc).is_some()
}

/// Whether two `--ratio` arguments refer to the same aspect ratio: `None` and `original` are equivalent; `W:H` is compared by value (`16:9` and `32:18` are the same), and anything that cannot be parsed is compared as text.
pub fn ratio_equivalent(left: Option<&str>, right: Option<&str>) -> bool {
    fn parse(text: Option<&str>) -> Option<Option<f64>> {
        // Absent (the `canvas` key is not written) means “follow the source size”, equivalent to an explicit `original`.
        let Some(text) = text.map(str::trim).filter(|t| !t.is_empty()) else {
            return Some(None);
        };
        if ratio_is_original(text) {
            return Some(None);
        }
        let (width, height) = text.split_once(':')?;
        let width = width.trim().parse::<f64>().ok()?;
        let height = height.trim().parse::<f64>().ok()?;
        (width.is_finite() && height.is_finite() && width > 0.0 && height > 0.0)
            .then_some(Some(width / height))
    }
    match (parse(left), parse(right)) {
        (Some(None), Some(None)) => true,
        (Some(Some(a)), Some(Some(b))) => (a - b).abs() < 1e-6,
        (Some(_), Some(_)) => false,
        _ => left.map(str::trim).unwrap_or("") == right.map(str::trim).unwrap_or(""),
    }
}

/// `ratio` syntax: `original` or `W:H` (both sides are positive finite numbers). It uses the same criteria as `ccut-workspace::canvas::CanvasInput::parse_ratio`; protocol cannot depend on workspace, so it is written out separately here, and a test keeps the two in agreement.
pub fn check_ratio(text: &str) -> Result<(), String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("cannot be an empty string (omit this field to keep the aspect ratio)".to_owned());
    }
    if ratio_is_original(text) {
        return Ok(());
    }
    let Some((width, height)) = text.split_once(':') else {
        return Err(format!("use original or W:H: {text}"));
    };
    for part in [width, height] {
        let ok = part
            .trim()
            .parse::<f64>()
            .map(|v| v.is_finite() && v > 0.0)
            .unwrap_or(false);
        if !ok {
            return Err(format!("both sides of W:H must be positive numbers: {text}"));
        }
    }
    Ok(())
}

fn check_box(layer_id: &str, rect: &LayerBox) -> Result<(), String> {
    const EPS: f64 = 0.051;
    let finite = [rect.x, rect.y, rect.w, rect.h]
        .iter()
        .all(|v| v.is_finite());
    if !finite
        || rect.x < -EPS
        || rect.y < -EPS
        || rect.w < MIN_W - EPS
        || rect.h < MIN_H - EPS
        || rect.x + rect.w > 100.0 + EPS
        || rect.y + rect.h > 100.0 + EPS
    {
        return Err(format!(
            "template layer {layer_id} box is out of bounds or below the minimum size: x={} y={} w={} h={}",
            rect.x, rect.y, rect.w, rect.h
        ));
    }
    Ok(())
}

fn positive(layer_id: &str, field: &str, v: f64) -> Result<(), String> {
    if !(v.is_finite() && v > 0.0) {
        return Err(format!(
            "template layer {layer_id} {field} must be a positive number: {v}"
        ));
    }
    Ok(())
}

fn non_negative_pad(layer_id: &str, pad: Option<f64>) -> Result<(), String> {
    match pad {
        Some(v) if !(v.is_finite() && v >= 0.0) => Err(format!(
            "template layer {layer_id} pad must be a non-negative number: {v}"
        )),
        _ => Ok(()),
    }
}

fn check_layer_kind(layer_id: &str, kind: &LayerKind) -> Result<(), String> {
    let id = format!("template layer {layer_id}");
    match kind {
        LayerKind::Chapters {
            bg,
            color,
            accent,
            color_done,
            size,
            ..
        } => {
            check_color(&id, "bg", bg)?;
            check_color(&id, "color", color)?;
            check_color(&id, "accent", accent)?;
            if let Some(c) = color_done {
                check_color(&id, "colorDone", c)?;
            }
            positive(layer_id, "size", *size)
        }
        LayerKind::Progress { accent, track } => {
            check_color(&id, "accent", accent)?;
            check_color(&id, "track", track)
        }
        LayerKind::Logo {
            src,
            bg,
            color,
            size,
            pad,
            opacity,
            ..
        } => {
            if !opacity.is_finite() {
                return Err(format!(
                    "template layer {layer_id} opacity must be a finite number: {opacity}"
                ));
            }
            match src {
                LogoSrc::Text(_) => {}
                LogoSrc::BrandLogo { brand_logo } => check_id("brandLogo", brand_logo)?,
                LogoSrc::File { file } => check_relative_file(layer_id, file)?,
            }
            if let Some(c) = bg {
                check_color(&id, "bg", c)?;
            }
            check_color(&id, "color", color)?;
            positive(layer_id, "size", *size)?;
            non_negative_pad(layer_id, *pad)
        }
        LayerKind::Text {
            color,
            bg,
            size,
            pad,
            weight,
            ..
        } => {
            check_color(&id, "color", color)?;
            if let Some(c) = bg {
                check_color(&id, "bg", c)?;
            }
            positive(layer_id, "size", *size)?;
            non_negative_pad(layer_id, *pad)?;
            if !(100..=900).contains(weight) {
                return Err(format!(
                    "template layer {layer_id} weight must be in 100..=900: {weight}"
                ));
            }
            Ok(())
        }
    }
}

fn check_relative_file(layer_id: &str, file: &str) -> Result<(), String> {
    let bad = file.is_empty()
        || file.starts_with('/')
        || file.starts_with('\\')
        || file.contains(':')
        || file
            .split(['/', '\\'])
            .any(|seg| seg == ".." || seg.is_empty());
    if bad {
        return Err(format!(
            "template layer {layer_id} file must be a project-relative path: {file}"
        ));
    }
    Ok(())
}

fn check_id(kind: &str, id: &str) -> Result<(), String> {
    if id.is_empty() || id.chars().any(char::is_whitespace) {
        Err(format!("{kind} id is invalid: {id}"))
    } else {
        Ok(())
    }
}

fn check_color(owner: &str, field: &str, color: &str) -> Result<(), String> {
    let hex = color.strip_prefix('#').unwrap_or("");
    if !matches!(hex.len(), 6 | 8) || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!("{owner} {field} is not #RRGGBB[AA]: {color}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample() -> TemplateDoc {
        TemplateDoc {
            id: "tpl-x".into(),
            name: "示例".into(),
            hue: "orange".into(),
            group: None,
            canvas: TemplateCanvas::Wide,
            ratio: None,
            lock_ratio: false,
            builtin: true,
            tag: None,
            imported: None,
            desc: "描述".into(),
            font: Some("Noto Sans SC".into()),
            from: None,
            subs_avoid: true,
            layers: vec![
                TemplateLayer {
                    id: "ch".into(),
                    on: true,
                    rect: LayerBox::new(0.0, 91.0, 100.0, 9.0),
                    kind: LayerKind::Chapters {
                        fill: ChapterFill::Bar,
                        bg: "#00000099".into(),
                        color: "#FFFFFF".into(),
                        accent: "#FF7A1A".into(),
                        color_done: None,
                        divider: true,
                        size: 2.6,
                    },
                },
                TemplateLayer {
                    id: "pg".into(),
                    on: false,
                    rect: LayerBox::new(0.0, 98.0, 100.0, 2.0),
                    kind: LayerKind::Progress {
                        accent: "#FF7A1A".into(),
                        track: "#FFFFFF40".into(),
                    },
                },
                TemplateLayer {
                    id: "lg".into(),
                    on: true,
                    rect: LayerBox::new(2.0, 4.0, 14.0, 8.0),
                    kind: LayerKind::Logo {
                        src: LogoSrc::brand("bm2"),
                        text: "科浪访谈".into(),
                        bg: None,
                        color: "#FFFFFF".into(),
                        shape: LogoShape::Badge,
                        align: TextAlign::Center,
                        size: 3.2,
                        pad: None,
                        tile: false,
                        opacity: 1.0,
                    },
                },
                TemplateLayer {
                    id: "tx".into(),
                    on: true,
                    rect: LayerBox::new(4.0, 14.0, 40.0, 6.0),
                    kind: LayerKind::Text {
                        text: "{chapter}".into(),
                        color: "#FFFFFF".into(),
                        bg: Some("#00000073".into()),
                        align: TextAlign::Center,
                        size: 2.8,
                        pad: None,
                        mono: true,
                        weight: 500,
                    },
                },
            ],
        }
    }

    #[test]
    fn round_trips_through_json() {
        let doc = sample();
        let value = serde_json::to_value(&doc).unwrap();
        // `kind` and the common fields are flattened into the same object.
        assert_eq!(value["layers"][0]["kind"], "chapters");
        assert_eq!(value["layers"][0]["box"]["y"], 91.0);
        assert_eq!(value["layers"][0]["fill"], "bar");
        assert_eq!(value["layers"][1]["on"], false);
        assert_eq!(value["layers"][2]["src"]["brandLogo"], "bm2");
        assert_eq!(value["layers"][3]["mono"], true);
        assert_eq!(value["subsAvoid"], serde_json::Value::Null);
        assert_eq!(value["font"], "Noto Sans SC");
        let back: TemplateDoc = serde_json::from_value(value).unwrap();
        assert_eq!(back, doc);
    }

    #[test]
    fn integer_numbers_and_defaults_are_accepted() {
        let raw = json!({
            "id": "tpl-min",
            "name": "最小",
            "layers": [
                {"id": "a", "kind": "text", "box": {"x": 4, "y": 14, "w": 40, "h": 6},
                 "text": "{chapter}", "color": "#FFFFFF"},
                {"id": "b", "kind": "logo", "box": {"x": 2, "y": 4, "w": 14, "h": 8},
                 "src": "text", "text": "T", "color": "#FFFFFF", "bg": "#C0392B", "extra": 1},
                {"id": "c", "kind": "progress", "box": {"x": 0, "y": 98, "w": 100, "h": 2},
                 "accent": "#FF7A1A", "track": "#FFFFFF40"}
            ]
        });
        let doc: TemplateDoc = serde_json::from_value(raw).unwrap();
        assert_eq!(doc.hue, "gray");
        assert_eq!(doc.canvas, TemplateCanvas::Wide);
        assert!(doc.subs_avoid);
        assert!(!doc.builtin);
        assert_eq!(doc.font, None);
        assert_eq!(doc.layers[0].rect.y, 14.0);
        match &doc.layers[0].kind {
            LayerKind::Text {
                align,
                size,
                mono,
                weight,
                ..
            } => {
                assert_eq!(*align, TextAlign::Left);
                assert_eq!(*size, 2.8);
                assert!(!mono);
                assert_eq!(*weight, 700);
            }
            other => panic!("unexpected {other:?}"),
        }
        match &doc.layers[1].kind {
            LayerKind::Logo { src, shape, .. } => {
                assert!(src.is_text());
                assert_eq!(*shape, LogoShape::Badge);
            }
            other => panic!("unexpected {other:?}"),
        }
        assert!(doc.layers.iter().all(|l| l.on));
    }

    #[test]
    fn rejects_unknown_kind_and_missing_required() {
        let raw = json!({"id": "t", "name": "n", "layers": [
            {"id": "a", "kind": "sticker", "box": {"x": 0, "y": 0, "w": 10, "h": 10}}
        ]});
        assert!(serde_json::from_value::<TemplateDoc>(raw).is_err());
        let raw = json!({"id": "t", "name": "n", "layers": [
            {"id": "a", "kind": "progress", "box": {"x": 0, "y": 0, "w": 10, "h": 10}, "accent": "#FFF"}
        ]});
        assert!(serde_json::from_value::<TemplateDoc>(raw).is_err());
    }

    #[test]
    fn logo_src_shapes() {
        assert_eq!(serde_json::to_value(LogoSrc::TEXT).unwrap(), json!("text"));
        assert_eq!(
            serde_json::to_value(LogoSrc::file("assets/template/a.png")).unwrap(),
            json!({"file": "assets/template/a.png"})
        );
        let src: LogoSrc = serde_json::from_value(json!({"brandLogo": "bm1"})).unwrap();
        assert_eq!(src, LogoSrc::brand("bm1"));
        assert!(serde_json::from_value::<LogoSrc>(json!("image")).is_err());
    }

    #[test]
    fn ratio_is_optional_and_follows_canvas_grammar() {
        let mut doc = sample();
        assert!(validate(&doc).is_ok());
        assert!(!serde_json::to_string(&doc).unwrap().contains("ratio"));
        for ok in ["original", "Original", "16:9", "9:16", "2.35:1", " 1:1 "] {
            doc.ratio = Some(ok.into());
            assert!(validate(&doc).is_ok(), "{ok}");
        }
        for bad in ["", " ", "16x9", "0:9", "16:-9", "a:b", "16:9:1", "nan:1"] {
            doc.ratio = Some(bad.into());
            assert!(validate(&doc).is_err(), "{bad:?}");
        }
        let raw = json!({"id": "t", "name": "n", "ratio": "9:16", "layers": []});
        let doc: TemplateDoc = serde_json::from_value(raw).unwrap();
        assert_eq!(doc.ratio.as_deref(), Some("9:16"));
        assert!(ratio_is_original("ORIGINAL"));
        assert!(!ratio_is_original("16:9"));
    }

    #[test]
    fn ratio_lock_needs_both_flag_and_ratio() {
        let mut doc = sample();
        assert!(ratio_lock(&doc).is_none());
        doc.lock_ratio = true;
        assert!(ratio_lock(&doc).is_none(), "a lock without ratio is invalid");
        assert!(validate(&doc).is_ok());
        doc.ratio = Some("16:9".into());
        let lock = ratio_lock(&doc).expect("lock applies");
        assert_eq!(lock.ratio, "16:9");
        assert_eq!(lock.name, "示例");
        assert!(!lock.is_original());
        assert!(lock.allows(Some("16:9")));
        assert!(lock.allows(Some("32:18")));
        assert!(!lock.allows(Some("9:16")));
        assert!(!lock.allows(None));
        doc.ratio = Some("original".into());
        let lock = ratio_lock(&doc).unwrap();
        assert!(lock.is_original());
        assert!(lock.allows(None));
        assert!(lock.allows(Some("Original")));
        assert!(!lock.allows(Some("1:1")));
        // On disk: false is not written; true writes `lockRatio`. Old documents missing the field read back as false.
        doc.lock_ratio = false;
        assert!(!serde_json::to_string(&doc).unwrap().contains("lockRatio"));
        doc.lock_ratio = true;
        let text = serde_json::to_string(&doc).unwrap();
        assert!(text.contains("\"lockRatio\":true"));
        let back: TemplateDoc = serde_json::from_str(&text).unwrap();
        assert_eq!(back, doc);
        assert!(ratio_equivalent(None, Some("original")));
        assert!(ratio_equivalent(Some("2.35:1"), Some("2.35:1")));
        assert!(!ratio_equivalent(Some("16:9"), Some("16x9")));
    }

    #[test]
    fn logo_tile_and_opacity_round_trip_and_clamp() {
        let mut doc = sample();
        let text = serde_json::to_string(&doc).unwrap();
        assert!(!text.contains("tile"), "default tile is not written to disk");
        assert!(!text.contains("opacity"), "default opacity is not written to disk");
        assert_eq!(doc.layers[2].kind.opacity(), 1.0);
        assert!(!doc.layers[2].kind.tiled());
        if let LayerKind::Logo { tile, opacity, .. } = &mut doc.layers[2].kind {
            *tile = true;
            *opacity = 0.2;
        }
        let value = serde_json::to_value(&doc).unwrap();
        assert_eq!(value["layers"][2]["tile"], true);
        assert_eq!(value["layers"][2]["opacity"], 0.2);
        let back: TemplateDoc = serde_json::from_value(value).unwrap();
        assert_eq!(back, doc);
        assert!(back.layers[2].kind.tiled());
        assert_eq!(back.layers[2].kind.opacity(), 0.2);
        assert!(validate(&back).is_ok());
        // Chapter strip, progress and text layers have no opacity; always 1.
        assert_eq!(doc.layers[0].kind.opacity(), 1.0);
        assert!(!doc.layers[3].kind.tiled());
        // Clamped on read: 0 → the lower bound, above 1 → 1, non-number → 1. Validation only rejects non-finite numbers.
        assert_eq!(clamp_opacity(0.0), MIN_OPACITY);
        assert_eq!(clamp_opacity(-2.0), MIN_OPACITY);
        assert_eq!(clamp_opacity(3.0), 1.0);
        assert_eq!(clamp_opacity(f64::NAN), 1.0);
        assert_eq!(clamp_opacity(0.6), 0.6);
        if let LayerKind::Logo { opacity, .. } = &mut doc.layers[2].kind {
            *opacity = 0.0;
        }
        assert!(validate(&doc).is_ok());
        assert_eq!(doc.layers[2].kind.opacity(), MIN_OPACITY);
        if let LayerKind::Logo { opacity, .. } = &mut doc.layers[2].kind {
            *opacity = f64::INFINITY;
        }
        assert!(validate(&doc).is_err());
        let raw = json!({"id": "t", "name": "n", "layers": [
            {"id": "a", "kind": "logo", "box": {"x": 0, "y": 0, "w": 100, "h": 100},
             "text": "T", "color": "#FFFFFF", "tile": true, "opacity": 1.5}
        ]});
        let doc: TemplateDoc = serde_json::from_value(raw).unwrap();
        assert!(doc.layers[0].kind.tiled());
        assert_eq!(doc.layers[0].kind.opacity(), 1.0);
    }

    #[test]
    fn logo_align_defaults_to_center_and_round_trips() {
        let mut doc = sample();
        let value = serde_json::to_value(&doc).unwrap();
        assert!(value["layers"][2].get("align").is_none(), "centered logo is not written to disk");
        assert_eq!(value["layers"][3]["align"], "center", "text layer is still written to disk");
        for (align, wire) in [(TextAlign::Left, "left"), (TextAlign::Right, "right")] {
            if let LayerKind::Logo { align: slot, .. } = &mut doc.layers[2].kind {
                *slot = align;
            }
            let value = serde_json::to_value(&doc).unwrap();
            assert_eq!(value["layers"][2]["align"], wire);
            let back: TemplateDoc = serde_json::from_value(value).unwrap();
            assert_eq!(back, doc);
        }
        // Old documents lack this field: the logo reads as centered, and text layers still read as left.
        let raw = json!({"id": "t", "name": "n", "layers": [
            {"id": "a", "kind": "logo", "box": {"x": 0, "y": 0, "w": 30, "h": 10},
             "text": "T", "color": "#FFFFFF"},
            {"id": "b", "kind": "text", "box": {"x": 0, "y": 20, "w": 30, "h": 10},
             "text": "T", "color": "#FFFFFF"}
        ]});
        let doc: TemplateDoc = serde_json::from_value(raw).unwrap();
        assert!(matches!(
            doc.layers[0].kind,
            LayerKind::Logo {
                align: TextAlign::Center,
                ..
            }
        ));
        assert!(matches!(
            doc.layers[1].kind,
            LayerKind::Text {
                align: TextAlign::Left,
                ..
            }
        ));
    }

    #[test]
    fn pad_is_optional_non_negative_and_round_trips() {
        let mut doc = sample();
        let text = serde_json::to_string(&doc).unwrap();
        assert!(!text.contains("\"pad\""), "default padding is not written to disk");
        for (i, v) in [(2, 1.2), (3, 0.0)] {
            match &mut doc.layers[i].kind {
                LayerKind::Logo { pad, .. } | LayerKind::Text { pad, .. } => *pad = Some(v),
                other => panic!("unexpected {other:?}"),
            }
        }
        assert!(validate(&doc).is_ok(), "0 is valid padding");
        let value = serde_json::to_value(&doc).unwrap();
        assert_eq!(value["layers"][2]["pad"], 1.2);
        assert_eq!(value["layers"][3]["pad"], 0.0);
        let back: TemplateDoc = serde_json::from_value(value).unwrap();
        assert_eq!(back, doc);
        for bad in [-0.5, f64::NAN, f64::INFINITY] {
            let mut doc = doc.clone();
            if let LayerKind::Text { pad, .. } = &mut doc.layers[3].kind {
                *pad = Some(bad);
            }
            assert!(validate(&doc).is_err(), "{bad}");
            let mut doc = sample();
            if let LayerKind::Logo { pad, .. } = &mut doc.layers[2].kind {
                *pad = Some(bad);
            }
            assert!(validate(&doc).is_err(), "{bad}");
        }
    }

    #[test]
    fn group_tag_and_imported_are_optional() {
        let mut doc = sample();
        let text = serde_json::to_string(&doc).unwrap();
        for key in ["group", "tag", "imported"] {
            assert!(!text.contains(&format!("\"{key}\"")), "{key} default is not written to disk");
        }
        assert!(!doc.is_watermark());
        assert!(!doc.is_imported_watermark());
        doc.group = Some("watermark".into());
        doc.tag = Some(TAG_WATERMARK.into());
        doc.imported = Some(IMPORTED_WATERMARK.into());
        let value = serde_json::to_value(&doc).unwrap();
        assert_eq!(value["group"], "watermark");
        assert_eq!(value["tag"], "watermark");
        assert_eq!(value["imported"], "watermark");
        let back: TemplateDoc = serde_json::from_value(value).unwrap();
        assert_eq!(back, doc);
        assert!(back.is_watermark());
        assert!(back.is_imported_watermark());
        // The group key is not checked for membership: an unknown group is still valid and is filed under “info bar” by the catalog.
        doc.group = Some("somewhere".into());
        assert!(validate(&doc).is_ok());
        // Hue added for the platform edition.
        for hue in ["red", "green", "pink"] {
            doc.hue = hue.into();
            assert!(validate(&doc).is_ok(), "{hue}");
        }
    }
}
