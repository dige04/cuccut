//! Two-way reconciliation between the flat root keys of the subtitle style and `voiceInkContexts`.
//!
//! `studio/style.json` holds two layers of truth at once:
//!
//! - `voiceInkContexts.{sub,bi}`: the **lossless** model of the Mac editor. Each of the two contexts has the complete appearance, geometry and per-word animation of its `orig` and `trans` lines;
//! - the flat root keys: a **single-context** projection. The Web preview, the GPUI panel, the burn-in side `studio_export::resolve_line_style` and the six editable project exports all read these directly.
//!
//! When the Mac writes, both layers are refreshed together (`ProductSubtitleStyleAdapter.replacingStyle` → `mergeFlat`, `apps/mac/Sources/VoiceInk/Adapters/ProductSubtitleStyleAdapter.swift:36-50` and `:222-282`). When it reads, contexts that can be decoded are adopted as a whole (`:27-33`). The CLI's two write paths used to touch only the flat layer:
//!
//! - The `style` overlay of `ccut studio apply` does a shallow top-level merge and leaves contexts untouched, so after the Web changes the mode or font size and apply runs, the Mac still reads the old contexts;
//! - `POST __ccut/style/apply` is a full replacement. When the request body carries no contexts (GPUI's `adapters/stylepane.rs` writes only root keys and line-level partials), the contexts on disk are deleted as a whole.
//!
//! This module converges both paths on one set of semantics: **first sink the flat keys explicitly changed in this write down into the contexts (flat → contexts), then recompute the flat projection from the contexts (contexts → flat)**. The order must not be reversed: a client that changes only root keys carries back the old contexts it read, and recomputing first would overwrite the change the user has just made.
//!
//! The determination of "which context" is the reverse of the Mac's. The Mac finds the changed set by diff; the CLI has no such information and can only infer it from the **document's own subtitle track set**: if it contains a translation track, the context is `bi`; otherwise it is `sub` (`sub`'s mode is pinned to single-line by `SubtitleStyleContexts.setMode` and carries no intent). When the track set holds only original-text tracks while the user is editing the `bi` appearance, the inference collides with `sub`, so both write paths accept an optional `ctx` hint (`"sub"` / `"bi"`), which the page should send when it knows which tab it is on.
//!
//! # The track set is the document's truth; `mode` is a write-only compatibility projection
//!
//! Which subtitle tracks are placed on the screen or timeline is declared by the root key `tracks`. Reads always go through [`resolve_track_set`](crate::resolve_track_set) (migrate on read, never write back). The flat `mode` and `voiceInkContexts.bi.mode` are demoted to compatibility fields derived from the track set, and every save writes them back through [`canonicalize_track_set`]. Documents left by earlier writers still carry them, and resolve's rule that "on inconsistency the compatibility signal wins" keeps those documents interoperable (the signal is `bi.mode`, falling back to the root `mode` only when `bi.mode` cannot be parsed).
use serde_json::{Map, Value, json};
use std::collections::BTreeSet;

pub const CONTEXTS_KEY: &str = "voiceInkContexts";

/// The two persistent contexts of the subtitle style. Their definition has moved, together with the write-transaction envelope, to `ccut-subtitle-render` ([`StyleContext::of_style`] is also there); only the original path is kept here.
pub use crate::StyleContext;
pub use crate::text_design::validate_motion_tree;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BilingualScope {
    Common,
    Original,
    Translation,
}

/// The "whole group" keys that correspond one-to-one with `mergeFlat`: they land on the set of the selected context.
const SET_KEYS: &[&str] = &[
    "x",
    "y",
    "width",
    "scale",
    "rotation",
    "verticalAlign",
    "transition",
];

/// Set keys that belong only to the bilingual context. `sub` is pinned to single-line, so these keys have no meaning on it (`SubtitleStyleContexts.swift:466-481`).
const BI_SET_KEYS: &[&str] = &["mode", "order", "gap", "backgroundMode"];

/// Flat appearance keys mapped to context line-style fields. The same-named batch.
const LOOK_KEYS: &[(&str, &str)] = &[
    ("textMotion", "textMotion"),
    ("wordBackground", "wordBackground"),
    ("fontSizeBasis", "fontSizeBasis"),
    ("backgroundPaddingY", "backgroundPaddingY"),
    ("fontColor", "fontColor"),
    ("backgroundColor", "backgroundColor"),
    ("backgroundPadding", "backgroundPadding"),
    ("backgroundStyle", "backgroundStyle"),
    ("borderRadius", "borderRadius"),
    ("align", "textAlign"),
    ("lineHeight", "lineHeight"),
    ("letterSpacing", "letterSpacing"),
    ("textTransform", "textTransform"),
    ("underline", "underline"),
    ("textOutline", "textOutline"),
    ("dropShadow", "dropShadow"),
    ("glow", "glow"),
    ("emphasisLook", "emphasisLook"),
];

/// Appearance keys whose field name or shape must be rewritten. Together with the batch above they make up the full set of `linePartial`.
const LOOK_KEYS_MAPPED: &[&str] = &[
    "fontFamily",
    "bold",
    "italic",
    "background",
    "outline",
    "wordAnimation",
];

/// Size keys: they do not land in a field directly; they go through the proportional chain (see `sink_sizes`).
const SIZE_KEYS: &[&str] = &["fontSize", "bilingualOrigScale", "transScale"];

/// Line-level partial: the whole block counts as one "explicit change", sunk key by key into the corresponding line.
const LINE_PARTIAL_KEYS: &[(&str, &str)] = &[("origStyle", "orig"), ("transStyle", "trans")];

/// Whether `contexts` is a usable two-context structure. If Mac's `decode(StyleContexts.self, …)` fails, the same fallback applies: a wrong structure counts as absent, and nothing is rewritten halfway.
pub fn valid_contexts(contexts: &Value) -> bool {
    let Some(contexts) = contexts.as_object() else {
        return false;
    };
    ["sub", "bi"].iter().all(|name| {
        contexts.get(*name).is_some_and(|set| {
            set.is_object()
                && ["orig", "trans"]
                    .iter()
                    .all(|line| set.get(*line).is_none_or(Value::is_object))
        })
    })
}

/// The context this write represents: an explicit hint takes priority; otherwise it is determined by the document's track set.
///
/// Without a hint, the track set ([`StyleContext::of_style`]) is used rather than the flat `mode`. `mode` has been demoted to a compatibility field derived from the track set, so reading it here would be a second criterion. This keeps `/style/apply` from apps/mac working without `ctx`: a document containing a translation track still lands on the `bi` context.
fn selected_context(style: &Value, hint: Option<&str>) -> &'static str {
    match hint {
        Some("bi") => "bi",
        Some("sub") => "sub",
        _ => StyleContext::of_style(style).as_str(),
    }
}

/// The line in the selected context that carries the flat root font size and appearance. It uses the same criterion as `mergeFlat`'s `let line = bilingual && set.mode == "trans" ? set.trans : set.orig`.
fn selected_line(contexts: &Value, ctx: &str) -> &'static str {
    if ctx == "bi" && contexts["bi"]["mode"].as_str() == Some("trans") {
        "trans"
    } else {
        "orig"
    }
}

/// Root keys explicitly changed in `after` relative to `before` (excluding `contexts` itself and the version stamp).
///
/// **Deleted keys also count as changes.** Mac uses key deletion to express "no opinion" (clearing the block-level anchor of `verticalAlign` is a key deletion). Missing it would make the sinking step blind to the clear, and the recomputation would add the value back unchanged.
pub fn changed_flat_keys(before: &Value, after: &Value) -> BTreeSet<String> {
    let empty = Map::new();
    let before = before.as_object().unwrap_or(&empty);
    let after = after.as_object().unwrap_or(&empty);
    let tracked = |key: &String| key != CONTEXTS_KEY && key != "ccutStudioStyle";
    after
        .iter()
        .filter(|(key, value)| tracked(key) && before.get(*key) != Some(*value))
        .map(|(key, _)| key.clone())
        .chain(
            before
                .keys()
                .filter(|key| tracked(key) && !after.contains_key(*key))
                .cloned(),
        )
        .collect()
}

fn slot<'a>(value: &'a mut Value, key: &str) -> &'a mut Value {
    if !value.is_object() {
        *value = json!({});
    }
    &mut value[key]
}

fn object_slot<'a>(value: &'a mut Value, key: &str) -> &'a mut Value {
    let target = slot(value, key);
    if !target.is_object() {
        *target = json!({});
    }
    target
}

fn number(value: &Value) -> Option<f64> {
    value.as_f64().filter(|value| value.is_finite())
}

fn finite(value: &Value, default: f64) -> f64 {
    number(value).unwrap_or(default)
}

fn merged_flat_line(style: &Value, partial_key: &str) -> Value {
    let mut merged = style.as_object().cloned().unwrap_or_default();
    if let Some(partial) = style[partial_key].as_object() {
        for (key, value) in partial {
            merged.insert(key.clone(), value.clone());
        }
    }
    Value::Object(merged)
}

/// Flat text appearance → full line records of `voiceInkContexts.*.{orig,trans}`.
///
/// This is the compatibility bridge for the first context edit on a flat-only project. Normal projects already have contexts and do not go through here. It moves only the fields the existing schema can express, and does not invent product defaults.
fn record_from_flat(flat: &Value, font_size: f64) -> Value {
    let mut line_style = Map::new();
    for (flat_key, field) in LOOK_KEYS {
        if !flat[*flat_key].is_null() {
            line_style.insert((*field).to_owned(), flat[*flat_key].clone());
        }
    }
    if let Some(family) = flat["fontFamily"].as_str() {
        line_style.insert(
            "fontFamily".to_owned(),
            json!({"type": "default", "fontFamily": family}),
        );
    } else if flat["fontFamily"].is_object() {
        line_style.insert("fontFamily".to_owned(), flat["fontFamily"].clone());
    }
    if let Some(weight) = flat["fontWeight"].as_str() {
        line_style.insert("fontWeight".to_owned(), json!(weight));
    } else if let Some(weight) = flat["fontWeight"].as_u64() {
        line_style.insert("fontWeight".to_owned(), json!(weight));
    } else if let Some(bold) = flat["bold"].as_bool() {
        line_style.insert(
            "fontWeight".to_owned(),
            json!(if bold { "bold" } else { "normal" }),
        );
    }
    if let Some(italic) = flat["italic"].as_bool() {
        line_style.insert("italic".to_owned(), json!(italic));
        line_style.insert(
            "fontStyle".to_owned(),
            json!(if italic { "italic" } else { "normal" }),
        );
    }
    if let Some(background) = flat["background"].as_bool() {
        line_style.insert("bgOn".to_owned(), json!(background));
    }
    if let Some(outline) = flat["outline"].as_bool() {
        let mut value = flat["textOutline"].as_object().cloned().unwrap_or_default();
        value.insert("on".to_owned(), json!(outline));
        line_style.insert("textOutline".to_owned(), Value::Object(value));
    }
    line_style.insert("fontSize".to_owned(), json!(font_size.max(1.0)));

    let mut record = json!({"style": Value::Object(line_style)});
    if !flat["wordAnimation"].is_null() {
        record["anim"] = flat["wordAnimation"].clone();
    }
    record
}

fn copy_line_geometry(record: &mut Value, partial: &Value) {
    if number(&partial["x"]).is_some() && number(&partial["y"]).is_some() {
        record["x"] = partial["x"].clone();
        record["y"] = partial["y"].clone();
    }
    if matches!(
        partial["verticalAlign"].as_str(),
        Some("top" | "center" | "bottom")
    ) {
        record["verticalAlign"] = partial["verticalAlign"].clone();
    }
}

fn set_from_flat(style: &Value, mode: &str, orig: Value, trans: Value) -> Value {
    let mut set = json!({"mode": mode, "orig": orig, "trans": trans});
    for key in SET_KEYS {
        if !style[*key].is_null() {
            set[*key] = style[*key].clone();
        }
    }
    for key in BI_SET_KEYS {
        if *key != "mode" && !style[*key].is_null() {
            set[*key] = style[*key].clone();
        }
    }
    if !style["punct"].is_null() {
        set["punct"] = style["punct"].clone();
    }
    set
}

/// Builds, in memory, the two lossless contexts for a flat-only style.
///
/// The function does no I/O. The caller commits the return value only after the user has actually edited. Sizes strictly follow the existing `fontSize × bilingualOrigScale × transScale` chain, so the first materialization does not change the picture.
pub fn materialize_contexts(style: &Value) -> Value {
    if valid_contexts(&style[CONTEXTS_KEY]) {
        return style.clone();
    }
    let mut result = style.clone();
    if !result.is_object() {
        result = json!({});
    }
    let root_size = finite(&style["fontSize"], 30.0).max(1.0);
    let orig_scale = finite(
        &style["bilingualOrigScale"],
        crate::DEFAULT_BILINGUAL_ORIG_SCALE,
    )
    .max(0.1);
    let trans_scale = finite(&style["transScale"], crate::DEFAULT_TRANSLATION_RATIO).max(0.1);
    let orig_size = number(&style["origStyle"]["fontSize"])
        .unwrap_or(root_size * orig_scale)
        .max(1.0);
    let trans_size = number(&style["transStyle"]["fontSize"])
        .unwrap_or(orig_size * trans_scale)
        .max(1.0);

    let sub_orig = record_from_flat(style, root_size);
    let sub_trans = record_from_flat(&merged_flat_line(style, "transStyle"), trans_size);
    let mut bi_orig = record_from_flat(&merged_flat_line(style, "origStyle"), orig_size);
    let mut bi_trans = record_from_flat(&merged_flat_line(style, "transStyle"), trans_size);
    copy_line_geometry(&mut bi_orig, &style["origStyle"]);
    copy_line_geometry(&mut bi_trans, &style["transStyle"]);
    // The mode of a bilingual context is derived from the track set (when both the track set and `mode` are absent, it falls back uniformly to `orig`), using the same criterion as [`canonicalize_track_set`].
    let mode = crate::mode_token(crate::StudioMode::of_style(style));
    result[CONTEXTS_KEY] = json!({
        "sub": set_from_flat(style, "orig", sub_orig, sub_trans),
        "bi": set_from_flat(style, mode, bi_orig, bi_trans),
    });
    result
}

fn partial_from_record(record: &Value, bilingual: bool) -> Value {
    let line_style = &record["style"];
    let mut partial = Map::new();
    if let Some(size) = number(&line_style["fontSize"]) {
        partial.insert("fontSize".to_owned(), json!(size.max(1.0)));
    }
    for (flat, source) in LOOK_KEYS {
        if !line_style[*source].is_null() {
            partial.insert((*flat).to_owned(), line_style[*source].clone());
        }
    }
    if let Some(family) = line_style
        .pointer("/fontFamily/fontFamily")
        .and_then(Value::as_str)
    {
        partial.insert("fontFamily".to_owned(), json!(family));
    }
    if let Some(weight) = line_style["fontWeight"].as_str() {
        partial.insert("bold".to_owned(), json!(matches!(weight, "bold" | "700")));
    } else if let Some(weight) = line_style["fontWeight"].as_u64() {
        partial.insert("bold".to_owned(), json!(weight >= 700));
    }
    if line_style["italic"].as_bool() == Some(true)
        || line_style["fontStyle"].as_str() == Some("italic")
    {
        partial.insert("italic".to_owned(), json!(true));
    }
    if let Some(background) = line_style["bgOn"].as_bool() {
        partial.insert("background".to_owned(), json!(background));
    }
    let outline = &line_style["textOutline"];
    if !outline.is_null() {
        partial.insert(
            "outline".to_owned(),
            json!(
                outline["on"]
                    .as_bool()
                    .unwrap_or_else(|| finite(&outline["width"], 0.0) > 0.0)
            ),
        );
    }
    if !record["anim"].is_null() {
        partial.insert("wordAnimation".to_owned(), record["anim"].clone());
    }
    if bilingual {
        for key in ["x", "y", "verticalAlign"] {
            if !record[key].is_null() {
                partial.insert(key.to_owned(), record[key].clone());
            }
        }
    }
    Value::Object(partial)
}

/// Gets the equivalent flat editing projection of one set of contexts.
///
/// Equivalent in meaning to Web `subtitle-rendering.js::contextStyle`: root keys are read by the shared controls, and the bilingual `origStyle` / `transStyle` by the line-level controls. The return value always keeps the complete contexts, so a later whole-document commit does not delete the other set's style.
pub fn context_style(style: &Value, context: StyleContext) -> Value {
    let mut result = materialize_contexts(style);
    let contexts = result[CONTEXTS_KEY].clone();
    project_flat(&mut result, &contexts, context.as_str());
    if context == StyleContext::Bilingual {
        result["origStyle"] = partial_from_record(&contexts["bi"]["orig"], true);
        result["transStyle"] = partial_from_record(&contexts["bi"]["trans"], true);
    } else if let Some(root) = result.as_object_mut() {
        root.remove("origStyle");
        root.remove("transStyle");
    }
    result
}

/// The flat fields common to both bilingual lines, and the field names that currently differ.
pub fn bilingual_common(style: &Value) -> (Value, BTreeSet<String>) {
    let projected = context_style(style, StyleContext::Bilingual);
    let empty = Map::new();
    let orig = projected["origStyle"].as_object().unwrap_or(&empty);
    let trans = projected["transStyle"].as_object().unwrap_or(&empty);
    let keys: BTreeSet<_> = orig.keys().chain(trans.keys()).cloned().collect();
    let mut common = Map::new();
    let mut mixed = BTreeSet::new();
    for key in keys {
        match (orig.get(&key), trans.get(&key)) {
            (Some(left), Some(right)) if left == right => {
                common.insert(key, left.clone());
            }
            _ => {
                mixed.insert(key);
            }
        }
    }
    (Value::Object(common), mixed)
}

/// Text appearance keys that the "shared / original / translation" scope can control.
pub fn is_line_look_key(key: &str) -> bool {
    key == "fontSize"
        || LOOK_KEYS.iter().any(|(flat, _)| *flat == key)
        || LOOK_KEYS_MAPPED.contains(&key)
}

/// Writes a group of flat text fields into the specified bilingual scope. The shared scope updates both lines; a line scope updates only its own record. The return value keeps the complete contexts and rebuilds the current bilingual root projection.
pub fn apply_bilingual_scope(style: &Value, scope: BilingualScope, patch: &Value) -> Value {
    let before = context_style(style, StyleContext::Bilingual);
    let Some(fields) = patch.as_object() else {
        return before;
    };
    let mut candidate = before.clone();
    let targets: &[&str] = match scope {
        BilingualScope::Common => &["origStyle", "transStyle"],
        BilingualScope::Original => &["origStyle"],
        BilingualScope::Translation => &["transStyle"],
    };
    for target in targets {
        for (key, value) in fields {
            if is_line_look_key(key) {
                candidate[*target][key] = value.clone();
            }
        }
    }
    reconcile_replacement(
        &mut candidate,
        &before,
        Some(StyleContext::Bilingual.as_str()),
    );
    candidate
}

/// Sinks one line's **appearance** from the flat shape into the context line record (`{style, anim}`).
/// `wanted` decides which keys count as "explicitly changed by this write". Only the keys it selects are sunk; re-capturing the whole set would wipe out styling the user adjusted separately in another context or on another line.
fn sink_look(line: &mut Value, flat: &Value, wanted: &dyn Fn(&str) -> bool) {
    if wanted("wordAnimation") && !flat["wordAnimation"].is_null() {
        *slot(line, "anim") = flat["wordAnimation"].clone();
    }
    let style = object_slot(line, "style");
    for (key, field) in LOOK_KEYS {
        if wanted(key) && !flat[*key].is_null() {
            style[*field] = flat[*key].clone();
        }
    }
    if wanted("fontFamily") {
        match &flat["fontFamily"] {
            Value::String(name) => {
                let kind = style
                    .pointer("/fontFamily/type")
                    .and_then(Value::as_str)
                    .unwrap_or("default")
                    .to_owned();
                style["fontFamily"] = json!({"type": kind, "fontFamily": name});
            }
            family if family.is_object() => style["fontFamily"] = family.clone(),
            _ => {}
        }
    }
    if wanted("bold")
        && let Some(bold) = flat["bold"].as_bool()
    {
        style["fontWeight"] = json!(if bold { "bold" } else { "normal" });
    }
    if wanted("italic")
        && let Some(italic) = flat["italic"].as_bool()
    {
        style["italic"] = json!(italic);
        style["fontStyle"] = json!(if italic { "italic" } else { "normal" });
    }
    if wanted("background")
        && let Some(background) = flat["background"].as_bool()
    {
        style["bgOn"] = json!(background);
    }
    // `outline` is the old boolean projection, and it writes `textOutline.on`. It must come after the whole `textOutline` group, otherwise cloning the group would overwrite the switch just written.
    if wanted("outline")
        && let Some(outline) = flat["outline"].as_bool()
    {
        object_slot(style, "textOutline")["on"] = json!(outline);
    }
}

/// Size: the strict inverse of `mergeFlat`.
///
/// `mergeFlat` writes "the absolute font size of the selected line, plus the two ratios of the bilingual pair" (`bilingualOrigScale = bi.orig / root`, `transScale = bi.trans / bi.orig`). The inverse therefore also moves only the end that was **actually changed** in this write; the other end keeps its absolute value. This matches the Mac's behaviour: editing the original line does not move the translation line, only the ratio follows.
fn sink_sizes(contexts: &mut Value, flat: &Value, ctx: &str, changed: &BTreeSet<String>) {
    let line = selected_line(contexts, ctx);
    let base = number(&flat["fontSize"]).map(|size| size.max(1.0));
    let orig_scale = number(&flat["bilingualOrigScale"]).map(|value| value.max(0.1));
    let trans_scale = number(&flat["transScale"]).map(|value| value.max(0.1));
    if changed.contains("fontSize")
        && let Some(base) = base
    {
        object_slot(object_slot(&mut contexts[ctx], line), "style")["fontSize"] = json!(base);
    }
    let size_of = |contexts: &Value, line: &str| {
        contexts
            .pointer(&format!("/bi/{line}/style/fontSize"))
            .and_then(number)
    };
    // Bilingual original line: when `sub` is selected, it is encoded as "root × bilingualOrigScale" (exactly the shape the Mac flushes from `sub`). When the translation line of `bi` is selected, the base switches to the translation line.
    if changed.contains("bilingualOrigScale")
        && let Some(scale) = orig_scale
    {
        let anchor = if ctx == "bi" && line == "trans" {
            size_of(contexts, "trans")
        } else if ctx == "sub" {
            base
        } else {
            None
        };
        if let Some(anchor) = anchor {
            object_slot(object_slot(&mut contexts["bi"], "orig"), "style")["fontSize"] =
                json!((anchor * scale).max(1.0));
        }
    }
    if changed.contains("transScale")
        && let Some(scale) = trans_scale
        && let Some(orig) = size_of(contexts, "orig")
    {
        object_slot(object_slot(&mut contexts["bi"], "trans"), "style")["fontSize"] =
            json!((orig * scale).max(1.0));
    }
}

/// flat → contexts: sinks the flat keys explicitly changed in this write down into the selected context.
fn sink(style: &Value, contexts: &mut Value, ctx: &str, changed: &BTreeSet<String>) {
    let line = selected_line(contexts, ctx);
    let wanted = |key: &str| changed.contains(key);
    {
        let record = object_slot(&mut contexts[ctx], line);
        sink_look(record, style, &wanted);
    }
    for key in SET_KEYS {
        if !changed.contains(*key) {
            continue;
        }
        // Absence means "no opinion" (on the Mac, `mergeFlat` assigns nil for verticalAlign, which deletes the key). So on a clear, the key must also be deleted from the set, rather than leaving a stale value.
        if style[*key].is_null() {
            if let Some(set) = contexts[ctx].as_object_mut() {
                set.remove(*key);
            }
        } else {
            contexts[ctx][*key] = style[*key].clone();
        }
    }
    // Punctuation is a **project-level** switch: the Mac's `setPunct` writes both contexts (`SubtitleStyleContexts.swift:450-458`).
    if changed.contains("punct") && !style["punct"].is_null() {
        for name in ["sub", "bi"] {
            contexts[name]["punct"] = style["punct"].clone();
        }
    }
    for key in BI_SET_KEYS {
        if changed.contains(*key) && !style[*key].is_null() {
            contexts["bi"][*key] = style[*key].clone();
        }
    }
    sink_sizes(contexts, style, ctx, changed);
    // Line-level partials are produced only by bilingual contexts (Mac `linePartial(_:bilingual:)` and `lineGeom`'s `guard ctx == .bi`). Keys that appear in a whole-block partial are this write's changes.
    for (flat_key, line_name) in LINE_PARTIAL_KEYS {
        if !changed.contains(*flat_key) {
            continue;
        }
        let partial = style[*flat_key].clone();
        let Some(fields) = partial.as_object().cloned() else {
            continue;
        };
        let record = object_slot(&mut contexts["bi"], line_name);
        sink_look(record, &partial, &|key: &str| fields.contains_key(key));
        for key in ["x", "y", "verticalAlign"] {
            match fields.get(key) {
                Some(value) if !value.is_null() => record[key] = value.clone(),
                Some(_) => {
                    if let Some(object) = record.as_object_mut() {
                        object.remove(key);
                    }
                }
                None => {}
            }
        }
        // Line-level `fontSize` is a side path that **explicitly bypasses the proportional chain** (`resolve_line_style`'s `explicit_size`). The Mac also reads it back into the context line style.
        if let Some(size) = fields.get("fontSize").and_then(number) {
            object_slot(record, "style")["fontSize"] = json!(size.max(1.0));
        }
    }
}

/// contexts → flat: flattens one context into the flat root keys.
///
/// Corresponds key by key to Mac `mergeFlat` (`ProductSubtitleStyleAdapter.swift:222-282`), with two deliberate differences:
///
/// - **Absent is not written.** On the Mac side the set is a strongly typed model, so its fields are always present. Here the contexts may be hand-written or half-migrated JSON, so when a field is missing, the base supplied by the caller is kept (the base on the migration path is `studio::default_style()`), rather than inserting a fabricated default.
/// - Line-level partials (`origStyle` / `transStyle`) are not produced here. They are line-level overrides that the Mac side added recently. The CLI sinks them only when someone explicitly writes them, and does not backfill them proactively, so that no extra override layer appears for the burn-in side.
pub fn project_flat(style: &mut Value, contexts: &Value, ctx: &str) {
    let set = &contexts[ctx];
    let bi = &contexts["bi"];
    let line = &set[selected_line(contexts, ctx)];
    let line_style = &line["style"];
    let put = |style: &mut Value, key: &str, value: &Value| {
        if !value.is_null() {
            style[key] = value.clone();
        }
    };
    // `mode` is carried as intent only by the bilingual context, and it has already been demoted to a compatibility field derived from the track set. Here we only carry the Mac's three Show states (written on `bi.mode`) back to the flat layer. Afterwards [`canonicalize_track_set`] adjudicates the track set uniformly and writes `mode` back.
    //
    // A non-`bi` context **no longer** unconditionally writes `mode="orig"`. That was the old root cause: the line would collapse a bilingual document into single-line on any single-line context style write. A context describes "who the style is written for"; it never describes "which tracks are on the screen".
    if ctx == "bi" {
        put(style, "mode", &set["mode"]);
    }
    put(style, "punct", &set["punct"]);
    if let Some(family) = line_style
        .pointer("/fontFamily/fontFamily")
        .and_then(Value::as_str)
    {
        style["fontFamily"] = json!(family);
    }
    put(style, "fontSize", &line_style["fontSize"]);
    put(style, "fontColor", &line_style["fontColor"]);
    if let Some(weight) = line_style["fontWeight"].as_str() {
        style["bold"] = json!(matches!(weight, "bold" | "700"));
    }
    let outline = &line_style["textOutline"];
    if !outline.is_null() {
        style["outline"] = json!(
            outline["on"]
                .as_bool()
                .unwrap_or_else(|| number(&outline["width"]).unwrap_or(0.0) > 0.0)
        );
    }
    if !line_style["bgOn"].is_null() || !line_style["backgroundColor"].is_null() {
        style["background"] = json!(line_style["bgOn"].as_bool().unwrap_or_else(|| {
            let color = line_style["backgroundColor"]
                .as_str()
                .unwrap_or("transparent");
            color != "transparent" && !color.ends_with(",0)") && !color.ends_with(",0.0)")
        }));
    }
    for (flat, source) in LOOK_KEYS {
        // `align` and other same-named keys are handled here; `textOutline` and `dropShadow` are cloned as whole groups.
        put(style, flat, &line_style[*source]);
    }
    for key in SET_KEYS {
        // `verticalAlign` is the M120 block-level anchor. Absence means "no opinion", so the key must be deleted rather than left holding a stale value from the last flush (the Mac assigns nil through `.map(JSONValue.string)`).
        if *key == "verticalAlign" {
            match set[*key].as_str() {
                Some(value) => style[*key] = json!(value),
                None => {
                    if let Some(object) = style.as_object_mut() {
                        object.remove(*key);
                    }
                }
            }
            continue;
        }
        put(style, key, &set[*key]);
    }
    // `order`, `gap` and `backgroundMode` are always taken from the bilingual context, and sinking writes only there. The Mac takes them from the set being flushed, but in a single-line context these three keys describe "how the two lines are arranged", which has no consumer. Taking them from the same place on both sides is what guarantees the page reads them back unchanged after an edit.
    for key in BI_SET_KEYS {
        if *key != "mode" {
            put(style, key, &bi[*key]);
        }
    }
    put(style, "wordAnimation", &line["anim"]);
    // The two ratios are always measured against the **bilingual pair**, with the base being the root font size just written. This is the same sentence as `mergeFlat`: when flattening from `sub`, the root is the font size of the single original line, yet the ratios still describe the bilingual stack.
    let selected = number(&line_style["fontSize"]).unwrap_or(0.0);
    let original = bi
        .pointer("/orig/style/fontSize")
        .and_then(number)
        .unwrap_or(0.0);
    let translated = bi
        .pointer("/trans/style/fontSize")
        .and_then(number)
        .unwrap_or(0.0);
    if selected > 0.0 && original > 0.0 {
        style["bilingualOrigScale"] = json!(original / selected);
        style["transScale"] = json!(translated / original);
    }
}

/// A complete reconciliation: first sink this write's changes, then recompute the flat projection from the contexts.
///
/// When there are no usable contexts, **nothing changes bit for bit** (pure Web projects and unmigrated old projects). This is the same exemption as Web `subtitle-rendering.js`'s `contextStyle`.
pub fn reconcile(style: &mut Value, changed: &BTreeSet<String>, ctx_hint: Option<&str>) {
    let mut contexts = style[CONTEXTS_KEY].clone();
    // If this write changes no key that a context can carry (only the preset name or `captionEmphasis` and the like change), nothing changes bit for bit. Recomputing the flat layer has side effects: it pulls root keys that are inconsistent with the contexts, left over from history, back to the contexts' truth. That should not be triggered incidentally by an unrelated write.
    if !valid_contexts(&contexts) || !changed.iter().any(|key| is_context_backed_key(key)) {
        return;
    }
    let ctx = selected_context(style, ctx_hint);
    sink(&style.clone(), &mut contexts, ctx, changed);
    project_flat(style, &contexts, ctx);
    style[CONTEXTS_KEY] = contexts;
}

/// The full-replacement semantics of `POST __ccut/style/apply`.
///
/// 1. If the request body carries no contexts but the disk has them → **inherit** the disk's contexts. GPUI writes only root keys, and a full replacement would delete the Mac's lossless truth wholesale.
/// 2. If the request body's contexts differ from the disk's → the client is context-aware (the Mac goes through `replacingStyle` and delivers both layers together). Accept them wholesale and do not reconcile: the Rust side's flattening cannot tell which set was changed, and recomputing would push the flat layer the Mac just wrote back onto the other context.
/// 3. Otherwise (inherited, or bit-identical to the disk) → the set of root-key differences is this write's intent, and `reconcile` runs to close it in both directions.
pub fn reconcile_replacement(candidate: &mut Value, before: &Value, ctx_hint: Option<&str>) {
    let stored = &before[CONTEXTS_KEY];
    let inherited = if candidate[CONTEXTS_KEY].is_null() && !stored.is_null() {
        candidate[CONTEXTS_KEY] = stored.clone();
        true
    } else {
        false
    };
    if !inherited && candidate[CONTEXTS_KEY] != *stored {
        return;
    }
    let changed = changed_flat_keys(before, candidate);
    reconcile(candidate, &changed, ctx_hint);
}

/// The optional context hint in the overlay or request body.
pub fn ctx_hint(value: &Value) -> Option<&str> {
    match value.as_str() {
        Some("sub") | Some("bi") => value.as_str(),
        _ => None,
    }
}

/// Whether this write explicitly declares a track set.
///
/// Step 3 of [`resolve_track_set`](crate::resolve_track_set) takes the signal as authoritative when `tracks` and the compatibility signals (`bi.mode` first, then the root `mode`) disagree; an old writer has updated them. This rule is correct on the **read** path. On the **write** path it turns a new-model client's track-set write into a no-op: the request body carries only `{"tracks": [...]}`, the stale `mode` on disk survives the shallow merge, and the track set is re-derived from `mode` back to its original value. So the write path must tell canonicalize who the intent of this write belongs to.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TrackSetIntent {
    /// The writer did not supply a track set, so keep resolve's compatibility adjudication (on inconsistency the compatibility signal wins).
    Inherited,
    /// The writer explicitly wrote `tracks` in this write without writing `mode`. The track set is the intent, so the stale `mode` is discarded.
    Authored,
}

impl TrackSetIntent {
    /// Judges intent from the set of keys explicitly changed by this write.
    pub fn of_changed<'a>(changed: impl IntoIterator<Item = &'a str>) -> Self {
        let mut tracks = false;
        let mut mode = false;
        for key in changed {
            match key {
                "tracks" => tracks = true,
                "mode" => mode = true,
                _ => {}
            }
        }
        if tracks && !mode {
            Self::Authored
        } else {
            Self::Inherited
        }
    }
}

/// The no-translation guard switch.
///
/// The division of labour between the two layers of truth is an existing ruling. This round changes only the criterion, not the division: **the style sidecar (`studio/style.json`) keeps the intent, and the projection (`studio/data.json`) holds the renderable facts**. If the user sets up bilingual before the translation exists, the intent must stay in the sidecar, so it returns to bilingual unchanged once the translation arrives. The projection, however, must drop the translation track; otherwise rendering and export would bail out in `render_plan` directly.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TranslationGuard {
    /// Keeps the translation track in the track set (the write path for the style sidecar).
    Keep,
    /// Drops the translation track (projection saves, old-document migration and repair of existing data).
    Drop,
}

impl TranslationGuard {
    pub fn of_has_translation(has_translation: bool) -> Self {
        if has_translation {
            Self::Keep
        } else {
            Self::Drop
        }
    }
}

/// The single track-set adjudication before style is saved: the single point on the write side.
///
/// 1. `tracks := resolve(style)`. For `Authored`, first discard the two stale compatibility signals, the root `mode` and `voiceInkContexts.bi.mode`. Otherwise this round's "take the translation track off / put it back" would be vetoed by the previous round's `bi.mode`.
/// 2. For `Drop`, remove the translation track (if the set becomes empty, fill in `[source]`). This is the track-set version of the old `mode` no-translation guard.
/// 3. Write back the compatibility projections: `style.mode` and `voiceInkContexts.bi.mode` both take `mode_of(tracks)`, and `sub.mode` stays `"orig"` (the Mac pins `sub` to single-line).
///    `bi.mode` **must** follow the track set unconditionally. It is the preferred signal for read-side adjudication, and if it were left at a stale value, the next `resolve` would put back the translation track that was just removed, and reading and writing would no longer be idempotent.
///
/// **Called only on the write path.** All read paths (rendering, preview, export) go through [`resolve_track_set`](crate::resolve_track_set), which migrates on read and does not write back.
///
/// It must be called **after** [`reconcile`], and it must not be folded inside `reconcile`. `reconcile` leaves everything bit-identical when "no key that a context can carry is changing", so a patch carrying only `tracks` would hit exactly that early return, and `mode` and `bi.mode` would stay at stale values.
pub fn canonicalize_track_set(style: &mut Value, guard: TranslationGuard, intent: TrackSetIntent) {
    if !style.is_object() {
        return;
    }
    if intent == TrackSetIntent::Authored && !crate::parse_track_set(style).is_empty() {
        if let Some(object) = style.as_object_mut() {
            object.remove("mode");
        }
        // Use `get_mut` rather than indexing: indexing would insert a null for an absent `voiceInkContexts`.
        if let Some(set) = style
            .get_mut(CONTEXTS_KEY)
            .and_then(|contexts| contexts.get_mut("bi"))
            .and_then(Value::as_object_mut)
        {
            set.remove("mode");
        }
    }
    let mut tracks = crate::resolve_track_set(style);
    if guard == TranslationGuard::Drop {
        tracks.retain(|track| track.role != crate::TrackRole::Translation);
        if tracks.is_empty() {
            tracks.push(crate::SubtitleTrack::source(None));
        }
    }
    let mode = crate::mode_token(crate::mode_of(&tracks));
    style["tracks"] = crate::tracks_json(&tracks);
    style["mode"] = json!(mode);
    if valid_contexts(&style[CONTEXTS_KEY]) {
        style[CONTEXTS_KEY]["sub"]["mode"] = json!("orig");
        style[CONTEXTS_KEY]["bi"]["mode"] = json!(mode);
    }
}

/// Fills in language annotations on the track set. Only blanks are filled; an existing `lang` is left alone, because the user or upstream knows better.
///
/// Language is information only the projection layer knows (the transcript `meta.lang` and the current projection target language). `default_style` cannot access it, so it is a separate step, run right before canonicalize at save time.
pub fn seed_track_langs(style: &mut Value, source_lang: Option<&str>, target_lang: Option<&str>) {
    let Some(tracks) = style["tracks"].as_array_mut() else {
        return;
    };
    for track in tracks {
        if track["lang"].as_str().is_some_and(|lang| !lang.is_empty()) {
            continue;
        }
        let lang = match track["role"].as_str() {
            Some("source") => source_lang,
            Some("translation") => target_lang,
            _ => None,
        };
        if let Some(lang) = lang.filter(|lang| !lang.trim().is_empty()) {
            track["lang"] = json!(lang);
        }
    }
}

/// All sinkable keys involved in one flat overlay write (so callers can judge whether reconciliation is worth doing).
pub fn is_context_backed_key(key: &str) -> bool {
    SET_KEYS.contains(&key)
        || BI_SET_KEYS.contains(&key)
        || SIZE_KEYS.contains(&key)
        || LOOK_KEYS.iter().any(|(flat, _)| *flat == key)
        || LOOK_KEYS_MAPPED.contains(&key)
        || LINE_PARTIAL_KEYS.iter().any(|(flat, _)| *flat == key)
        || key == "punct"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn contexts() -> Value {
        json!({
            "sub": {
                "mode": "orig", "punct": true, "x": 50.0, "y": 86.0,
                "orig": {"style": {"fontSize": 29.0, "fontColor": "#ffffff",
                                   "fontFamily": {"type": "default", "fontFamily": "Inter"}}},
                "trans": {"style": {"fontSize": 22.0}}
            },
            "bi": {
                "mode": "bi", "order": "trans", "gap": 6.0, "punct": true, "x": 50.0, "y": 86.0,
                "orig": {"style": {"fontSize": 16.0, "fontColor": "#ffffff"}},
                "trans": {"style": {"fontSize": 29.0, "fontColor": "#ffffff"}}
            }
        })
    }

    /// Measured shape: the flat root is flattened from the `sub` context (29 / 0.5517 / 1.8125 ↔ bi.orig 16, bi.trans 29), so `mode` is `orig`.
    fn flat() -> Value {
        json!({
            "mode": "orig", "punct": true, "fontSize": 29.0, "fontColor": "#ffffff",
            "fontFamily": "Inter", "x": 50.0, "y": 86.0,
            "bilingualOrigScale": 16.0 / 29.0, "transScale": 29.0 / 16.0,
            "voiceInkContexts": contexts()
        })
    }

    fn changed(keys: &[&str]) -> BTreeSet<String> {
        keys.iter().map(|key| (*key).to_owned()).collect()
    }

    #[test]
    fn flat_mode_switch_writes_the_bilingual_context_mode() {
        let mut style = flat();
        style["mode"] = json!("bi");
        reconcile(&mut style, &changed(&["mode"]), None);
        assert_eq!(style[CONTEXTS_KEY]["bi"]["mode"], "bi");
        // With the selected context switched to `bi`, the flat root becomes the projection of `bi`.
        assert_eq!(style["mode"], "bi");
        assert_eq!(style["fontSize"].as_f64(), Some(16.0));
        assert_eq!(style["bilingualOrigScale"].as_f64(), Some(1.0));
        assert_eq!(style["transScale"].as_f64(), Some(29.0 / 16.0));
        // The single-line context was not touched by this switch.
        assert_eq!(
            style[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontSize"].as_f64(),
            Some(29.0)
        );
    }

    #[test]
    fn font_size_lands_in_the_selected_context_only() {
        let mut style = flat();
        style["fontSize"] = json!(40.0);
        reconcile(&mut style, &changed(&["fontSize"]), None);
        let contexts = &style[CONTEXTS_KEY];
        assert_eq!(
            contexts["sub"]["orig"]["style"]["fontSize"].as_f64(),
            Some(40.0)
        );
        assert_eq!(
            contexts["bi"]["orig"]["style"]["fontSize"].as_f64(),
            Some(16.0)
        );
        assert_eq!(
            contexts["bi"]["trans"]["style"]["fontSize"].as_f64(),
            Some(29.0)
        );
        // The bilingual ratios are recomputed against the new root font size, so the absolute font size stays unchanged. This matches the Mac.
        assert_eq!(style["bilingualOrigScale"].as_f64(), Some(16.0 / 40.0));
    }

    /// apps/mac's `/style/apply` carries no `ctx`. A document whose track set contains a translation track must land in the `bi` context, otherwise the Mac's bilingual appearance would be written into the single-line `sub`.
    #[test]
    fn a_translation_track_selects_the_bilingual_context_without_a_ctx_hint() {
        let mut style = flat();
        style["tracks"] = json!([{"role": "source"}, {"role": "translation"}]);
        // Remove both compatibility signals (root `mode` and `bi.mode`). The track set itself must select `bi` as the context.
        style.as_object_mut().expect("object").remove("mode");
        style[CONTEXTS_KEY]["bi"]
            .as_object_mut()
            .expect("bi 上下文")
            .remove("mode");
        style["fontSize"] = json!(20.0);
        reconcile(&mut style, &changed(&["fontSize"]), None);
        assert_eq!(
            style[CONTEXTS_KEY]["bi"]["orig"]["style"]["fontSize"].as_f64(),
            Some(20.0)
        );
        // The single-line context does not move at all.
        assert_eq!(
            style[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontSize"].as_f64(),
            Some(29.0)
        );
    }

    /// The old writer (apps/mac) unconditionally writes back the flat `mode`. When `mode` conflicts with `tracks`, `mode` wins. A new-model writer always keeps the two in agreement, so a disagreement can only come from an old writer, and its value is the newer one.
    #[test]
    fn a_legacy_mode_writeback_wins_over_a_stale_track_set() {
        let mut style = json!({
            "mode": "orig",
            "tracks": [{"role": "source", "lang": "en"}, {"role": "translation", "lang": "zh"}],
        });
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Keep,
            TrackSetIntent::Inherited,
        );
        assert_eq!(style["tracks"], json!([{"role": "source", "lang": "en"}]));
        assert_eq!(style["mode"], "orig");
    }

    /// The reverse: this write explicitly gave `tracks` and did not touch `mode`, so the track set is the intent. Without this rule, a new-model client's "take the translation track off" would be vetoed by the stale `mode` on disk.
    #[test]
    fn an_authored_track_set_wins_over_the_stale_mode_it_replaces() {
        let mut style = json!({
            "mode": "bi",
            "tracks": [{"role": "source"}],
            CONTEXTS_KEY: contexts(),
        });
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Keep,
            TrackSetIntent::of_changed(["tracks"]),
        );
        assert_eq!(style["tracks"], json!([{"role": "source"}]));
        assert_eq!(style["mode"], "orig");
        assert_eq!(style[CONTEXTS_KEY]["sub"]["mode"], "orig");
        // Both compatibility signals follow the track set. `bi.mode` comes before the root `mode`, so leaving it at `"bi"` would make the next resolve put back the translation track that was just taken off.
        assert_eq!(style[CONTEXTS_KEY]["bi"]["mode"], "orig");
        // The saved form is self-consistent: resolving it again yields the same track set (read and write are idempotent).
        assert_eq!(
            crate::tracks_json(&crate::resolve_track_set(&style)),
            style["tracks"]
        );
    }

    /// When the Mac changes style in the Subtitle tab, it flushes a meaningless root `mode="orig"` from the pinned single-line `.sub` set, while the mode the user actually sees is on `bi.mode`. Re-deriving from the root `mode` would silently remove the translation track, so the preferred adjudication signal is `bi.mode`.
    #[test]
    fn the_bilingual_context_mode_outranks_a_flushed_flat_mode() {
        let mut contexts = contexts();
        contexts["bi"]["mode"] = json!("bi");
        // No tracks: derive from the signals.
        let mut style = json!({"mode": "orig", CONTEXTS_KEY: contexts.clone()});
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Keep,
            TrackSetIntent::Inherited,
        );
        assert_eq!(
            style["tracks"],
            json!([{"role": "source"}, {"role": "translation"}])
        );
        assert_eq!(style["mode"], "bi");

        // Has tracks but conflicts with the signals: `bi.mode` still wins, and the `lang` of the same role is kept.
        let mut style = json!({
            "mode": "orig",
            "tracks": [{"role": "source", "lang": "en"}],
            CONTEXTS_KEY: contexts,
        });
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Keep,
            TrackSetIntent::Inherited,
        );
        assert_eq!(
            style["tracks"],
            json!([{"role": "source", "lang": "en"}, {"role": "translation"}])
        );
    }

    /// The write-side adjudication and Studio's JS mirror share the same golden table, consumed row by row.
    #[test]
    fn canonicalization_matches_the_shared_contract_fixture() {
        let contract: Value = serde_json::from_str(include_str!(
            "../../speech-doc/tests/fixtures/subtitle-render-contract.json"
        ))
        .unwrap();
        let rows = contract["trackSet"]["canonicalize"]
            .as_array()
            .expect("夹具缺 trackSet.canonicalize");
        assert!(!rows.is_empty());
        for row in rows {
            let case = row["description"].as_str().unwrap_or("<无描述>");
            let intent = match row["intent"].as_str().expect("intent") {
                "authored" => TrackSetIntent::Authored,
                other => {
                    assert_eq!(other, "inherited", "{case}");
                    TrackSetIntent::Inherited
                }
            };
            // `guard: "drop"` means this row takes the projection path (the guard applies); the guard itself is still decided by `hasTranslation`. `guard: "keep"` is the sidecar write path, which ignores it.
            let guard = match row["guard"].as_str().expect("guard") {
                "drop" => TranslationGuard::of_has_translation(
                    row["hasTranslation"].as_bool().unwrap_or(false),
                ),
                other => {
                    assert_eq!(other, "keep", "{case}");
                    TranslationGuard::Keep
                }
            };
            let mut style = row["style"].clone();
            canonicalize_track_set(&mut style, guard, intent);
            assert_eq!(style["tracks"], row["expected"]["tracks"], "{case}");
            assert_eq!(style["mode"], row["expected"]["mode"], "{case}");
            if let Some(contexts) = row["expected"].get(CONTEXTS_KEY) {
                for (name, set) in contexts.as_object().expect("contexts") {
                    assert_eq!(style[CONTEXTS_KEY][name]["mode"], set["mode"], "{case}");
                }
            }
            // The saved form is self-consistent: the read side adjudicates once more and gets the same track set.
            assert_eq!(
                crate::tracks_json(&crate::resolve_track_set(&style)),
                style["tracks"],
                "{case}"
            );
        }
    }

    /// A document without `voiceInkContexts` (a flat style written by Studio or Web itself) falls back to the root `mode`.
    #[test]
    fn a_document_without_contexts_falls_back_to_the_flat_mode() {
        let mut style = json!({"mode": "bi"});
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Keep,
            TrackSetIntent::Inherited,
        );
        assert_eq!(
            style["tracks"],
            json!([{"role": "source"}, {"role": "translation"}])
        );
        // Do not conjure a context out of nothing when there is none.
        assert!(style.get(CONTEXTS_KEY).is_none());
    }

    /// A patch carrying only `tracks` hits the early return of `reconcile`, and must still get adjudication. This pins down that "canonicalize must not be folded inside reconcile".
    #[test]
    fn a_tracks_only_patch_is_canonicalized_outside_reconcile() {
        let mut style = flat();
        style["tracks"] = json!([{"role": "source"}, {"role": "translation"}]);
        let changed = changed(&["tracks"]);
        reconcile(&mut style, &changed, None);
        // `reconcile` leaves everything bit-identical: `tracks` is not a key that a context can carry.
        assert_eq!(style["mode"], "orig");
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Keep,
            TrackSetIntent::of_changed(changed.iter().map(String::as_str)),
        );
        assert_eq!(style["mode"], "bi");
        assert_eq!(style[CONTEXTS_KEY]["bi"]["mode"], "bi");
    }

    /// The no-translation guard belongs only to the projection copy: the sidecar keeps the intent.
    #[test]
    fn the_translation_guard_only_drops_the_track_where_it_is_asked_to() {
        let seed = json!({"mode": "bi", "tracks": [{"role": "source"}, {"role": "translation"}]});
        let mut kept = seed.clone();
        canonicalize_track_set(&mut kept, TranslationGuard::Keep, TrackSetIntent::Inherited);
        assert_eq!(kept["mode"], "bi");
        let mut dropped = seed;
        canonicalize_track_set(
            &mut dropped,
            TranslationGuard::Drop,
            TrackSetIntent::Inherited,
        );
        assert_eq!(dropped["tracks"], json!([{"role": "source"}]));
        assert_eq!(dropped["mode"], "orig");
    }

    /// After the only track is removed, the track set must not be empty: fall back to `[source]`.
    #[test]
    fn a_translation_only_track_set_falls_back_to_source_without_translation() {
        let mut style = json!({"tracks": [{"role": "translation", "lang": "zh"}]});
        canonicalize_track_set(
            &mut style,
            TranslationGuard::Drop,
            TrackSetIntent::Inherited,
        );
        assert_eq!(style["tracks"], json!([{"role": "source"}]));
        assert_eq!(style["mode"], "orig");
    }

    /// Language annotations only fill blanks.
    #[test]
    fn track_languages_are_seeded_without_overwriting_authored_values() {
        let mut style = json!({
            "tracks": [{"role": "source", "lang": "ja"}, {"role": "translation"}]
        });
        seed_track_langs(&mut style, Some("en"), Some("zh"));
        assert_eq!(
            style["tracks"],
            json!([{"role": "source", "lang": "ja"}, {"role": "translation", "lang": "zh"}])
        );
    }

    #[test]
    fn ctx_hint_overrides_the_ambiguous_flat_mode() {
        let mut style = flat();
        style["fontSize"] = json!(20.0);
        reconcile(&mut style, &changed(&["fontSize"]), Some("bi"));
        let contexts = &style[CONTEXTS_KEY];
        assert_eq!(
            contexts["bi"]["orig"]["style"]["fontSize"].as_f64(),
            Some(20.0)
        );
        assert_eq!(
            contexts["sub"]["orig"]["style"]["fontSize"].as_f64(),
            Some(29.0)
        );
        assert_eq!(style["fontSize"].as_f64(), Some(20.0));
        assert_eq!(style["bilingualOrigScale"].as_f64(), Some(1.0));
    }

    #[test]
    fn translation_scale_resizes_the_bilingual_translation_line() {
        let mut style = flat();
        style["transScale"] = json!(2.0);
        reconcile(&mut style, &changed(&["transScale"]), None);
        assert_eq!(
            style[CONTEXTS_KEY]["bi"]["trans"]["style"]["fontSize"].as_f64(),
            Some(32.0)
        );
        assert_eq!(style["transScale"].as_f64(), Some(2.0));
    }

    #[test]
    fn look_keys_are_mapped_onto_the_context_field_names() {
        let mut style = flat();
        style["fontColor"] = json!("#18E1D6");
        style["bold"] = json!(true);
        style["align"] = json!("left");
        style["background"] = json!(true);
        style["fontFamily"] = json!("Montserrat");
        reconcile(
            &mut style,
            &changed(&["fontColor", "bold", "align", "background", "fontFamily"]),
            None,
        );
        let line = &style[CONTEXTS_KEY]["sub"]["orig"]["style"];
        assert_eq!(line["fontColor"], "#18E1D6");
        assert_eq!(line["fontWeight"], "bold");
        assert_eq!(line["textAlign"], "left");
        assert_eq!(line["bgOn"], true);
        assert_eq!(
            line["fontFamily"],
            json!({"type":"default","fontFamily":"Montserrat"})
        );
        // The bilingual contexts were not affected at all by the single-line context change.
        assert_eq!(
            style[CONTEXTS_KEY]["bi"]["orig"]["style"]["fontColor"],
            "#ffffff"
        );
    }

    #[test]
    fn emphasis_look_sinks_into_the_context_and_projects_back() {
        let look = json!({"color": "#FF00AA", "bold": true, "scale": 1.3});
        let mut style = flat();
        style["emphasisLook"] = look.clone();
        reconcile(&mut style, &changed(&["emphasisLook"]), None);
        assert_eq!(
            style[CONTEXTS_KEY]["sub"]["orig"]["style"]["emphasisLook"],
            look
        );
        assert!(is_line_look_key("emphasisLook"));
        let contexts = style[CONTEXTS_KEY].clone();
        let mut projected = style.clone();
        projected["emphasisLook"] = Value::Null;
        project_flat(&mut projected, &contexts, "sub");
        assert_eq!(projected["emphasisLook"], look);
    }

    #[test]
    fn line_partials_land_on_the_bilingual_line_and_its_placement() {
        let mut style = flat();
        style["transStyle"] = json!({"fontColor": "#FF0000", "x": 30.0, "y": 20.0});
        reconcile(&mut style, &changed(&["transStyle"]), None);
        let line = &style[CONTEXTS_KEY]["bi"]["trans"];
        assert_eq!(line["style"]["fontColor"], "#FF0000");
        assert_eq!(line["x"].as_f64(), Some(30.0));
        assert_eq!(line["y"].as_f64(), Some(20.0));
    }

    #[test]
    fn replacement_without_contexts_inherits_and_stays_two_way_closed() {
        let before = flat();
        let mut candidate = before.clone();
        candidate.as_object_mut().unwrap().remove(CONTEXTS_KEY);
        candidate["mode"] = json!("bi");
        reconcile_replacement(&mut candidate, &before, None);
        assert_eq!(candidate[CONTEXTS_KEY]["bi"]["mode"], "bi");
        assert_eq!(
            candidate[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontSize"].as_f64(),
            Some(29.0)
        );
        assert_eq!(candidate["mode"], "bi");
    }

    #[test]
    fn replacement_with_authored_contexts_is_taken_verbatim() {
        let before = flat();
        let mut candidate = before.clone();
        candidate[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontSize"] = json!(11.0);
        candidate["fontSize"] = json!(11.0);
        let expected = candidate.clone();
        reconcile_replacement(&mut candidate, &before, None);
        assert_eq!(candidate, expected);
    }

    #[test]
    fn projects_are_untouched_without_contexts() {
        let mut style = json!({"mode": "bi", "fontSize": 30.0});
        let expected = style.clone();
        reconcile(&mut style, &changed(&["fontSize"]), None);
        assert_eq!(style, expected);
    }

    #[test]
    fn flat_only_styles_materialize_two_independent_contexts_without_changing_effective_sizes() {
        let style = json!({
            "mode": "bi", "fontFamily": "Inter", "fontSize": 30.0,
            "fontColor": "#FFFFFF", "bold": true,
            "bilingualOrigScale": 16.0 / 30.0, "transScale": 22.0 / 16.0,
            "origStyle": {"fontColor": "#00FF00"},
            "transStyle": {"fontColor": "#FF00FF", "x": 50.0, "y": 30.0}
        });
        let materialized = materialize_contexts(&style);
        let contexts = &materialized[CONTEXTS_KEY];
        assert!(valid_contexts(contexts));
        assert_eq!(contexts["sub"]["mode"], "orig");
        assert_eq!(contexts["bi"]["mode"], "bi");
        assert_eq!(
            contexts["sub"]["orig"]["style"]["fontSize"].as_f64(),
            Some(30.0)
        );
        assert_eq!(
            contexts["bi"]["orig"]["style"]["fontSize"].as_f64(),
            Some(16.0)
        );
        assert_eq!(
            contexts["bi"]["trans"]["style"]["fontSize"].as_f64(),
            Some(22.0)
        );
        assert_eq!(contexts["bi"]["orig"]["style"]["fontColor"], "#00FF00");
        assert_eq!(contexts["bi"]["trans"]["style"]["fontColor"], "#FF00FF");
        assert!(contexts["bi"]["orig"].get("x").is_none());
        assert_eq!(contexts["bi"]["trans"]["x"], 50.0);
        assert_eq!(contexts["bi"]["trans"]["y"], 30.0);
        assert_eq!(materialized["fontSize"], style["fontSize"]);
        assert_eq!(materialized["mode"], style["mode"]);

        let defaults = materialize_contexts(&json!({"mode": "bi", "fontSize": 30.0}));
        assert_eq!(
            defaults[CONTEXTS_KEY]["bi"]["orig"]["style"]["fontSize"],
            20.0
        );
        assert_eq!(
            defaults[CONTEXTS_KEY]["bi"]["trans"]["style"]["fontSize"],
            32.0
        );
    }

    #[test]
    fn each_context_projects_its_own_look_and_bilingual_line_partials() {
        let mut style = flat();
        style[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontColor"] = json!("#00AA00");
        style[CONTEXTS_KEY]["bi"]["orig"]["style"]["fontColor"] = json!("#AA0000");
        style[CONTEXTS_KEY]["bi"]["trans"]["style"]["fontColor"] = json!("#0000AA");

        let subtitle = context_style(&style, StyleContext::Subtitle);
        let bilingual = context_style(&style, StyleContext::Bilingual);
        assert_eq!(subtitle["mode"], "orig");
        assert_eq!(subtitle["fontColor"], "#00AA00");
        assert!(subtitle.get("origStyle").is_none());
        assert!(subtitle.get("transStyle").is_none());
        assert_eq!(bilingual["mode"], "bi");
        assert_eq!(bilingual["fontColor"], "#AA0000");
        assert_eq!(bilingual["origStyle"]["fontColor"], "#AA0000");
        assert_eq!(bilingual["transStyle"]["fontColor"], "#0000AA");
        assert_eq!(
            bilingual[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontColor"],
            "#00AA00"
        );
    }

    #[test]
    fn bilingual_common_reports_mixed_values_and_unifies_both_lines() {
        let mut style = flat();
        style[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontColor"] = json!("#00CC00");
        style[CONTEXTS_KEY]["bi"]["orig"]["style"]["fontColor"] = json!("#AA0000");
        style[CONTEXTS_KEY]["bi"]["trans"]["style"]["fontColor"] = json!("#0000AA");

        let (_, mixed) = bilingual_common(&style);
        assert!(mixed.contains("fontColor"));

        let unified = apply_bilingual_scope(
            &style,
            BilingualScope::Common,
            &json!({"fontColor": "#FFD43B", "fontSize": 36.0}),
        );
        let (common, mixed) = bilingual_common(&unified);
        assert_eq!(common["fontColor"], "#FFD43B");
        assert_eq!(common["fontSize"], 36.0);
        assert!(!mixed.contains("fontColor"));
        assert_eq!(
            unified[CONTEXTS_KEY]["sub"]["orig"]["style"]["fontColor"],
            "#00CC00"
        );
    }

    #[test]
    fn bilingual_line_scope_only_changes_the_selected_line() {
        let style = flat();
        let changed = apply_bilingual_scope(
            &style,
            BilingualScope::Translation,
            &json!({"fontColor": "#F000F0"}),
        );
        assert_eq!(
            changed[CONTEXTS_KEY]["bi"]["trans"]["style"]["fontColor"],
            "#F000F0"
        );
        assert_eq!(
            changed[CONTEXTS_KEY]["bi"]["orig"]["style"]["fontColor"],
            "#ffffff"
        );
    }

    #[test]
    fn style_context_wire_values_are_stable() {
        assert_eq!(
            serde_json::to_value(StyleContext::Subtitle).unwrap(),
            json!("sub")
        );
        assert_eq!(
            serde_json::to_value(StyleContext::Bilingual).unwrap(),
            json!("bi")
        );
        assert_eq!(StyleContext::from_hint("sub"), Some(StyleContext::Subtitle));
        assert_eq!(StyleContext::from_hint("bi"), Some(StyleContext::Bilingual));
        assert_eq!(StyleContext::from_hint("text"), None);
    }
}
