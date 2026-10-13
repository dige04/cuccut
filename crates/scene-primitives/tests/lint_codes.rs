//! Diagnostic codes added in stage 2 (spec §16), and the consistency between the “code table ↔ spec table”.
//!
//! The table in spec §16 is the **only list of codes**, and until now no test checked it against the code
//! (`docs/archive/reviews/2026-08-02-cli-doc-audit.md` already recorded this gap).

use std::path::{Path, PathBuf};

use scene_primitives::lint::{LINT_RULES, Severity, lint, resolve_error_code};
use serde_json::{Value, json};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("repo root")
}

/// A minimal resolvable document, with the given `animate` attached to an element.
fn doc_with_animate(animate: Value) -> Value {
    json!({
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end",
             "element": {"type": "text", "id": "el", "text": "hi",
                         "style": {"fontSize": 40},
                         "animate": animate}}
        ]}]
    })
}

fn codes(doc: &Value) -> Vec<&'static str> {
    lint(doc).into_iter().map(|d| d.rule).collect()
}

fn message(doc: &Value, rule: &str) -> String {
    lint(doc)
        .into_iter()
        .find(|d| d.rule == rule)
        .unwrap_or_else(|| panic!("no {rule}; actual: {:?}", codes(doc)))
        .message
}

fn doc_with_text(text: &str) -> Value {
    let mut doc = doc_with_animate(Value::Null);
    let el = &mut doc["tracks"][0]["clips"][0]["element"];
    el.as_object_mut().expect("element").remove("animate");
    el["text"] = json!(text);
    doc
}

/// A document that declares a `font` asset: strict font mode (§11.2), where system fonts do not take part in fallback.
fn strict_doc_with_text(text: &str) -> Value {
    let mut doc = doc_with_text(text);
    doc["assets"] = json!({"body": {"type": "font", "src": "fonts/body.ttf"}});
    doc
}

#[test]
fn text_newline_and_color_emoji_warn() {
    assert!(codes(&doc_with_text("line one\nline two")).contains(&"text-newline"));
    assert!(codes(&strict_doc_with_text("attach 📎")).contains(&"text-emoji-no-glyph"));
    assert!(codes(&strict_doc_with_text("done 🟢")).contains(&"text-emoji-no-glyph"));
    assert!(codes(&strict_doc_with_text("\u{2764}\u{FE0F}")).contains(&"text-emoji-no-glyph"));
    let clean = codes(&strict_doc_with_text("你好，world → 100% ★"));
    assert!(
        !clean.contains(&"text-newline") && !clean.contains(&"text-emoji-no-glyph"),
        "{clean:?}"
    );
}

/// An explicit `style.textWrap` or `split.by: "line"` enables multi-line layout (§6.2.2); `\n` is a hard line break.
#[test]
fn text_newline_is_quiet_in_paragraph_layout() {
    let mut wrapped = doc_with_text("line one\nline two");
    wrapped["tracks"][0]["clips"][0]["element"]["style"]["textWrap"] = json!("none");
    assert!(!codes(&wrapped).contains(&"text-newline"));
    let mut split = doc_with_text("line one\nline two");
    split["tracks"][0]["clips"][0]["element"]["split"] = json!({"by": "line"});
    assert!(!codes(&split).contains(&"text-newline"));
}

/// The old single-line path does not read `textAlign`; the whole line is always centered (§6.2.2). Left / right alignment without textWrap is silently dropped.
#[test]
fn text_align_without_wrap_warns() {
    let with_style = |text: &str, style: Value, split: Option<Value>| {
        let mut doc = doc_with_text(text);
        let el = &mut doc["tracks"][0]["clips"][0]["element"];
        el["style"] = style;
        if let Some(split) = split {
            el["split"] = split;
        }
        codes(&doc).contains(&"text-align-needs-wrap")
    };
    let base = json!({"fontSize": 40, "width": 880});
    let styled = |extra: Value| {
        let mut style = base.clone();
        for (k, v) in extra.as_object().expect("object") {
            style[k] = v.clone();
        }
        style
    };
    // Left / right, and illegal values that the single-line path likewise does not validate, are all reported
    for align in ["left", "right", "justify"] {
        assert!(
            with_style("hi", styled(json!({"textAlign": align})), None),
            "{align}"
        );
    }
    // Still reported when the content is a `$` reference: textAlign is independent of the content
    assert!(with_style(
        "$data.title",
        styled(json!({"textAlign": "left"})),
        None
    ));
    // Centered = the old behavior; a textAlign that is unset / null / a `$` reference is not reported
    assert!(!with_style("hi", base.clone(), None));
    assert!(!with_style(
        "hi",
        styled(json!({"textAlign": "center"})),
        None
    ));
    assert!(!with_style("hi", styled(json!({"textAlign": null})), None));
    assert!(!with_style(
        "hi",
        styled(json!({"textAlign": "$theme.align"})),
        None
    ));
    // Once the new layout is enabled (textWrap or split.by: "line"), textAlign takes effect and is not reported
    for wrap in ["none", "word", "grapheme"] {
        assert!(
            !with_style(
                "hi",
                styled(json!({"textAlign": "right", "textWrap": wrap})),
                None
            ),
            "{wrap}"
        );
    }
    assert!(!with_style(
        "hi",
        styled(json!({"textAlign": "left"})),
        Some(json!({"by": "line"}))
    ));
    // Splitting by word does not enable the new layout, so it is still reported
    assert!(with_style(
        "hi",
        styled(json!({"textAlign": "left"})),
        Some(json!({"by": "word"}))
    ));
}

/// `align` / `justify` only take effect under row / column / grid (§6.3): written under the default absolute layout they are silently dropped and the children land in the top-left corner. This is how the whiteboard clip's “text on the rounded card sticks to the top-left corner” came about.
#[test]
fn align_without_flow_layout_warns() {
    let with_box_style = |style: Value| {
        let mut doc = doc_with_text("hi");
        let clip = &mut doc["tracks"][0]["clips"][0];
        let label = clip["element"].take();
        clip["element"] = json!({"type": "box", "id": "card",
                                 "style": style, "children": [label]});
        codes(&doc)
            .into_iter()
            .filter(|code| *code == "layout-align-ignored")
            .count()
    };
    let size = json!({"x": 120, "y": 80, "width": 420, "height": 140});
    let styled = |extra: Value| {
        let mut style = size.clone();
        for (k, v) in extra.as_object().expect("object") {
            style[k] = v.clone();
        }
        style
    };
    // Default layout and explicit absolute: one node reports one entry; writing both keys is also one entry
    assert_eq!(
        with_box_style(styled(json!({"align": "center", "justify": "center"}))),
        1
    );
    assert_eq!(with_box_style(styled(json!({"justify": "end"}))), 1);
    assert_eq!(
        with_box_style(styled(json!({"layout": "absolute", "align": "center"}))),
        1
    );
    // Takes effect under row / column / grid; a layout that is unset, null, or a `$` reference is not reported
    for layout in ["row", "column", "grid"] {
        assert_eq!(
            with_box_style(styled(
                json!({"layout": layout, "align": "center", "justify": "center"})
            )),
            0,
            "{layout}"
        );
    }
    assert_eq!(with_box_style(size.clone()), 0);
    assert_eq!(with_box_style(styled(json!({"align": null}))), 0);
    assert_eq!(
        with_box_style(styled(json!({"layout": "$vars.layout", "align": "center"}))),
        0
    );
    let mut doc = doc_with_text("hi");
    doc["tracks"][0]["clips"][0]["element"]["style"]["justify"] = json!("center");
    assert!(message(&doc, "layout-align-ignored").contains("layout: \"column\""));
}

/// When no `font` asset is declared, it is drawn as a bitmap by the system color emoji font (§14.4 `DrawBitmap`); not reported.
#[test]
fn color_emoji_is_quiet_outside_strict_font_mode() {
    for text in ["attach 📎", "done 🟢", "\u{2764}\u{FE0F}"] {
        let found = codes(&doc_with_text(text));
        assert!(!found.contains(&"text-emoji-no-glyph"), "{text}: {found:?}");
    }
    // Having only image assets does not count as strict
    let mut doc = doc_with_text("attach 📎");
    doc["assets"] = json!({"logo": {"type": "image", "src": "img/logo.png"}});
    assert!(!codes(&doc).contains(&"text-emoji-no-glyph"));
}

#[test]
fn preset_unknown_still_fires() {
    let doc = doc_with_animate(json!({"enter": {"preset": "notAPreset", "dur": 0.4}}));
    assert!(codes(&doc).contains(&"preset-unknown"));
}

#[test]
fn preset_version_unknown_fires_for_builtin_and_manifest_presets() {
    let doc = doc_with_animate(json!({
        "enter": {"preset": "motion.moveIn", "presetVersion": 9, "dur": 0.4}
    }));
    assert!(codes(&doc).contains(&"preset-version-unknown"));
    // Frozen bcf.*@1 takes another path, and likewise must not silently use the latest
    let doc = doc_with_animate(json!({
        "enter": {"preset": "fadeIn", "presetVersion": 2, "dur": 0.4}
    }));
    assert!(codes(&doc).contains(&"preset-version-unknown"));
}

#[test]
fn preset_param_unknown_and_missing_fire() {
    let doc = doc_with_animate(json!({
        "enter": {"preset": "motion.moveIn", "dur": 0.4, "params": {"nope": 1}}
    }));
    assert!(codes(&doc).contains(&"preset-param-unknown"));

    // A type mismatch reuses unknown (spec §16 has no separate type code); the message explains the reason
    let doc = doc_with_animate(json!({
        "enter": {"preset": "motion.moveIn", "dur": 0.4, "params": {"direction": "sideways"}}
    }));
    let msg = message(&doc, "preset-param-unknown");
    assert!(msg.contains("direction"), "{msg}");
}

#[test]
fn relative_basis_unresolved_fires_when_the_target_has_no_layout_box() {
    // The caption lane's entrance template is anchored per item and has no single box of its own.
    let doc = json!({
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "presets": {"laneRise": {"keyframes": [{"prop": "y", "frames": [
            {"t": "0%", "v": {"value": 1.0, "basis": "selfWidth"}},
            {"t": "100%", "v": 0}]}]}},
        "tracks": [{"id": "cap", "kind": "captions", "clips": [
            {"id": "c", "start": 0, "end": "@s.end",
             "lanes": [{"id": "main", "animate": {"enter": {"preset": "laneRise", "dur": 0.2}}}],
             "captions": [{"at": 0.5, "until": 2.0, "lines": {"main": "hi"}}]}
        ]}]
    });
    assert!(
        codes(&doc).contains(&"relative-basis-unresolved"),
        "{:?}",
        lint(&doc)
            .iter()
            .map(|d| (d.rule, &d.message))
            .collect::<Vec<_>>()
    );
}

#[test]
fn relative_lengths_on_disallowed_properties_are_a_schema_error() {
    let doc = doc_with_animate(json!({"keyframes": [
        {"prop": "opacity", "frames": [
            {"t": "0%", "v": {"value": 0.1, "basis": "canvasWidth"}},
            {"t": "100%", "v": 1}]}
    ]}));
    let msg = message(&doc, "schema");
    assert!(msg.contains("opacity"), "{msg}");
}

#[test]
fn preset_compose_cycle_maps_to_its_own_code() {
    // There are no cycles in the built-in recipes (guarded by `tests/families.rs`), so the mapping function is tested directly here:
    // the Display prefix of `MotionError::PresetComposeCycle` raised at resolve time is the code.
    assert_eq!(
        resolve_error_code("preset-compose-cycle: motion.a → motion.b → motion.a"),
        "preset-compose-cycle"
    );
    let error = motion::MotionError::PresetComposeCycle("a → b → a".into());
    assert_eq!(
        resolve_error_code(&error.to_string()),
        "preset-compose-cycle"
    );
}

#[test]
fn every_resolve_error_prefix_maps_to_the_code_it_names() {
    for (prefix, code) in scene_primitives::lint::RESOLVE_ERROR_CODES {
        let msg = format!("{prefix}: 细节");
        assert_eq!(resolve_error_code(&msg), *code, "{prefix}");
    }
    assert_eq!(resolve_error_code("完全不认识的消息"), "resolve-error");
    // `component-` is a deliberately broad prefix: both kinds of message map to component-cycle
    assert_eq!(
        resolve_error_code("component-unknown: x"),
        "component-cycle"
    );
    assert_eq!(resolve_error_code("component-cycle: x"), "component-cycle");
}

#[test]
fn preset_alias_used_is_info_and_suggests_the_canonical_form() {
    let doc = doc_with_animate(json!({"enter": {"preset": "springPop", "dur": 0.4}}));
    let msg = message(&doc, "preset-alias-used");
    assert!(msg.contains("motion.backIn"), "{msg}");
    assert_eq!(
        lint(&doc)
            .into_iter()
            .find(|d| d.rule == "preset-alias-used")
            .unwrap()
            .severity,
        Severity::Info
    );
    // The canonical form no longer gets a hint
    let doc = doc_with_animate(json!({"enter": {"preset": "motion.backIn", "dur": 0.4}}));
    assert!(!codes(&doc).contains(&"preset-alias-used"));
}

#[test]
fn preset_sprawl_counts_families_not_cards() {
    // The four directions of the same family are one vocabulary and should not trigger.
    let mut children = Vec::new();
    for (i, direction) in ["left", "right", "up", "down"].iter().enumerate() {
        children.push(json!({
            "type": "text", "id": format!("t{i}"), "text": "x",
            "animate": {"enter": {"preset": "motion.backIn", "dur": 0.4,
                                  "params": {"direction": direction}}}
        }));
    }
    let doc = json!({
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end",
             "element": {"type": "box", "id": "root", "children": children}}
        ]}]
    });
    assert!(!codes(&doc).contains(&"preset-sprawl"), "{:?}", codes(&doc));

    // Triggers only with five **different** families
    let ids = [
        "motion.moveIn",
        "motion.scaleIn",
        "motion.backIn",
        "motion.rotateIn",
        "motion.blurIn",
    ];
    let children: Vec<Value> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| {
            json!({"type": "text", "id": format!("t{i}"), "text": "x",
                   "animate": {"enter": {"preset": id, "dur": 0.4}}})
        })
        .collect();
    let doc = json!({
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "s", "dur": 3}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c", "start": 0, "end": "@s.end",
             "element": {"type": "box", "id": "root", "children": children}}
        ]}]
    });
    let msg = message(&doc, "preset-sprawl");
    assert!(msg.contains("backIn"), "{msg}");
}

#[test]
fn motion_replace_overlap_fires_on_two_overlapping_replace_tracks() {
    // Two bare keyframes channels write the same property with overlapping times ⇒ the later declaration overrides by order.
    let doc = doc_with_animate(json!({"keyframes": [
        {"prop": "x", "frames": [{"t": "0%", "v": 0}, {"t": "80%", "v": 100}]},
        {"prop": "x", "frames": [{"t": "40%", "v": 0}, {"t": "100%", "v": -50}]}
    ]}));
    let msg = message(&doc, "motion-replace-overlap");
    assert!(msg.contains("\"x\""), "{msg}");

    // No report if they do not overlap
    let doc = doc_with_animate(json!({"keyframes": [
        {"prop": "x", "frames": [{"t": "0%", "v": 0}, {"t": "30%", "v": 100}]},
        {"prop": "x", "frames": [{"t": "60%", "v": 0}, {"t": "100%", "v": -50}]}
    ]}));
    assert!(!codes(&doc).contains(&"motion-replace-overlap"));
}

#[test]
fn add_and_multiply_tracks_never_trigger_replace_overlap() {
    // `motion.moveIn` (y=add) + `motion.pulse` (scale=multiply) stack on purpose.
    let doc = doc_with_animate(json!({
        "enter": {"preset": "motion.moveIn", "dur": 0.5},
        "emphasis": [{"preset": "motion.pulse", "at": 0.2, "dur": 0.6}]
    }));
    assert!(
        !codes(&doc).contains(&"motion-replace-overlap"),
        "{:?}",
        codes(&doc)
    );
}

/// Stable id discipline (direct-edit write-back plan §4.3-1): stage editing addresses elements by their element path.
#[test]
fn element_id_rules_guard_the_addressing_of_stage_edits() {
    let doc = |children: Value| {
        json!({
            "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
            "scenes": [{"id": "s", "dur": 3, "desc": "x"}],
            "tracks": [{"id": "main", "kind": "visual", "clips": [
                {"id": "c", "start": 0, "end": "@s.end",
                 "element": {"type": "box", "id": "root", "children": children}}
            ]}]
        })
    };

    // All have ids: neither rule fires
    let clean = doc(json!([
        {"type": "text", "id": "a", "text": "甲"},
        {"type": "text", "id": "b", "text": "乙"}
    ]));
    assert!(
        !codes(&clean).contains(&"element-id-missing"),
        "{:?}",
        codes(&clean)
    );
    assert!(!codes(&clean).contains(&"element-id-duplicate"));

    // Anonymous node → warn (does not block export)
    let anonymous = doc(json!([{"type": "text", "text": "甲"}]));
    assert!(codes(&anonymous).contains(&"element-id-missing"));
    assert_eq!(
        lint(&anonymous)
            .into_iter()
            .find(|d| d.rule == "element-id-missing")
            .unwrap()
            .severity,
        Severity::Warn
    );

    // Duplicate names in the same tree → error (one element path would point to two nodes)
    let duplicated = doc(json!([
        {"type": "text", "id": "a", "text": "甲"},
        {"type": "text", "id": "a", "text": "乙"}
    ]));
    let msg = message(&duplicated, "element-id-duplicate");
    assert!(msg.contains("\"a\""), "{msg}");
    assert_eq!(
        lint(&duplicated)
            .into_iter()
            .find(|d| d.rule == "element-id-duplicate")
            .unwrap()
            .severity,
        Severity::Error
    );

    // The scope is a **single tree**: the same name across clips is legal (paths are already relative to the clip root)
    let cross_clip = json!({
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "s", "dur": 3, "desc": "x"}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c1", "start": 0, "end": 1,
             "element": {"type": "text", "id": "title", "text": "甲"}},
            {"id": "c2", "start": 1, "end": "@s.end",
             "element": {"type": "text", "id": "title", "text": "乙"}}
        ]}]
    });
    assert!(
        !codes(&cross_clip).contains(&"element-id-duplicate"),
        "{:?}",
        codes(&cross_clip)
    );
}

#[test]
#[ignore = "reads the v2 BCF spec docs/design/bcf/cuccut-format-spec/16.md: v3 does not use BCF, so this spec was not carried over"]
fn every_declared_rule_appears_in_the_spec_section_sixteen_table() {
    // `schema` / `resolve-error` are two **structural-layer** fallback codes: spec §16's prose (not the table) describes them. All the others must be greppable.
    const STRUCTURAL: &[&str] = &["schema", "resolve-error"];
    let spec = std::fs::read_to_string(spec_path()).expect("spec");
    let mut missing: Vec<&str> = Vec::new();
    for (rule, _) in LINT_RULES {
        if STRUCTURAL.contains(rule) {
            continue;
        }
        if !spec.contains(&format!("`{rule}`")) {
            missing.push(rule);
        }
    }
    assert!(
        missing.is_empty(),
        "these codes are not in the table in docs/design/bcf/cuccut-format-spec/16.md: {missing:?}"
    );
}

/// The spec has been split by chapter (the main file is now only a table of contents); the §16 code table is in the chapter file.
fn spec_path() -> PathBuf {
    let path = repo_root().join("docs/design/bcf/cuccut-format-spec/16.md");
    assert!(Path::new(&path).is_file(), "{path:?}");
    path
}

#[test]
fn the_rule_table_has_no_duplicates() {
    let mut seen: Vec<&str> = Vec::new();
    for (rule, _) in LINT_RULES {
        assert!(!seen.contains(rule), "{rule} is duplicated");
        seen.push(rule);
    }
}

/// Effect parameter channels `effects[N].<param>` (§6.6): legal channels pass; an out-of-range index / unknown parameter / non-numeric parameter is an error.
#[test]
fn effect_param_channels_are_checked_against_the_effect_stack() {
    let with = |prop: &str| {
        let mut doc = doc_with_animate(json!({"keyframes": [
            {"prop": prop, "frames": [{"t": 0, "v": 0.0}, {"t": 1, "v": 1.0}]}
        ]}));
        doc["tracks"][0]["clips"][0]["element"]["effects"] = json!([
            {"preset": "filter.bloom", "presetVersion": 1},
            {"preset": "filter.outline", "presetVersion": 1}
        ]);
        lint(&doc)
            .into_iter()
            .filter(|d| d.severity == Severity::Error && d.rule != "scene-desc-missing")
            .map(|d| (d.rule, d.message))
            .collect::<Vec<_>>()
    };
    assert!(
        with("effects[0].intensity").is_empty(),
        "{:?}",
        with("effects[0].intensity")
    );
    assert!(with("effects[1].radius").is_empty());

    let out_of_range = with("effects[2].intensity");
    assert!(
        out_of_range.iter().any(|(_, m)| m.contains("effects[2]")),
        "{out_of_range:?}"
    );

    let unknown = with("effects[0].nope");
    assert!(
        unknown
            .iter()
            .any(|(rule, _)| *rule == "preset-param-unknown"),
        "{unknown:?}"
    );

    let color = with("effects[1].color");
    assert!(
        color.iter().any(|(_, m)| m.contains("is not a number")),
        "{color:?}"
    );

    // A non-canonical form is still an allowlist error.
    let malformed = with("effects[01].intensity");
    assert!(
        malformed.iter().any(|(_, m)| m.contains("allowlist")),
        "{malformed:?}"
    );
}

#[test]
fn proc_nodes_lint_clean_and_bad_params_surface_as_errors() {
    let with = |element: Value| {
        let mut doc = doc_with_animate(Value::Null);
        doc["tracks"][0]["clips"][0]["element"] = element;
        lint(&doc)
            .into_iter()
            .filter(|d| d.severity == Severity::Error && d.rule != "scene-desc-missing")
            .map(|d| (d.rule, d.message))
            .collect::<Vec<_>>()
    };
    for good in [
        json!({"type":"proc","id":"r","proc":"rain","seed":4,"params":{"density":0.7,"wind":0.5}}),
        json!({"type":"proc","id":"s","proc":"splash","params":{"at":0.5,"count":30}}),
        json!({"type":"proc","id":"k","proc":"sky","params":{
            "stars":0.8,"milkyWay":0.4,"cloud":0.6,"moon":{"x":0.7,"y":0.2,"r":0.05,"glow":0.8}}}),
    ] {
        let errors = with(good.clone());
        assert!(errors.is_empty(), "{good}: {errors:?}");
    }
    let bad = with(json!({"type":"proc","id":"r","proc":"rain","params":{"density":3}}));
    assert!(
        bad.iter().any(|(_, m)| m.contains("proc.rain.density")),
        "{bad:?}"
    );
    let unknown = with(json!({"type":"proc","id":"r","proc":"hail"}));
    assert!(!unknown.is_empty());
}

/// `src` / `imports` / `files` of a `program` asset that use `..` to climb out of the document's directory → `program-path-escape` (§6.5.3), with the pointer landing on the specific entry; the message states the boundary, the offending path and the fix. Paths that go down and come back up without leaving the boundary, staying inside the directory, are not reported.
#[test]
fn program_paths_escaping_the_document_directory_are_flagged_where_they_are() {
    let with = |program: Value| {
        let mut doc = doc_with_text("hi");
        let mut entry = json!({"type": "program", "width": 320, "height": 180,
                               "fps": 30, "frames": 30});
        entry
            .as_object_mut()
            .unwrap()
            .extend(program.as_object().unwrap().clone());
        doc["assets"] = json!({ "film": entry });
        lint(&doc)
            .into_iter()
            .filter(|d| d.rule == "program-path-escape")
            .map(|d| (d.severity, d.pointer, d.message))
            .collect::<Vec<_>>()
    };

    let inside = with(json!({
        "src": "film/Film.tsx",
        "imports": {"lib": "./film/lib/../lib.ts"},
        "files": ["film/data.json", "img/a/../b.png"]
    }));
    assert!(inside.is_empty(), "{inside:?}");

    let escaped = with(json!({
        "src": "../film/X.tsx",
        "imports": {"remotion": "../shim/remotion.ts", "a/b": "../x.ts"},
        "files": ["ok.png", "../art/logo.svg"]
    }));
    // lint output is sorted by pointer
    let pointers: Vec<&str> = escaped.iter().map(|(_, p, _)| p.as_str()).collect();
    assert_eq!(
        pointers,
        [
            "/assets/film/files/1",
            "/assets/film/imports/a~1b",
            "/assets/film/imports/remotion",
            "/assets/film/src",
        ],
        "{escaped:?}"
    );
    assert!(escaped.iter().all(|(s, _, _)| *s == Severity::Error));
    let (_, _, src) = &escaped[3];
    for needle in ["\"../film/X.tsx\"", "the document's directory", "project root", "next to the module"] {
        assert!(src.contains(needle), "message is missing {needle}: {src}");
    }
    assert!(escaped[0].2.contains("files[1]"), "{:?}", escaped[0]);
    assert!(escaped[1].2.contains("imports.a/b"), "{:?}", escaped[1]);
}

/// Scene count limit `1..400` (§5.1 / §16 Schema layer): 80 and 400 scenes pass, while 401 scenes report a `schema` error at `/scenes` with the limit stated in the message. One clip per scene, to confirm that lint can finish resolve at this scale.
#[test]
fn scene_count_limit_is_four_hundred() {
    let doc_with_scenes = |n: usize| {
        let scenes: Vec<Value> = (0..n)
            .map(|i| json!({"id": format!("s{i}"), "dur": 1, "desc": "镜头"}))
            .collect();
        let clips: Vec<Value> = (0..n)
            .map(|i| {
                json!({"id": format!("c{i}"), "start": format!("@s{i}.start"),
                       "end": format!("@s{i}.end"),
                       "element": {"type": "text", "id": format!("t{i}"), "text": "hi",
                                   "style": {"fontSize": 40}}})
            })
            .collect();
        json!({
            "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
            "scenes": scenes,
            "tracks": [{"id": "main", "kind": "visual", "clips": clips}]
        })
    };
    let scene_schema = |n: usize| {
        lint(&doc_with_scenes(n))
            .into_iter()
            .filter(|d| d.pointer == "/scenes")
            .map(|d| (d.rule, d.severity, d.message))
            .collect::<Vec<_>>()
    };
    for n in [80, 400] {
        let found = scene_schema(n);
        assert!(found.is_empty(), "{n} scenes should not report a scene count: {found:?}");
        let errors: Vec<_> = lint(&doc_with_scenes(n))
            .into_iter()
            .filter(|d| d.severity == Severity::Error)
            .collect();
        assert!(errors.is_empty(), "{n} scenes: {errors:?}");
    }
    let over = scene_schema(401);
    assert_eq!(over.len(), 1, "{over:?}");
    assert_eq!(over[0].0, "schema");
    assert_eq!(over[0].1, Severity::Error);
    assert!(
        over[0].2.contains("401") && over[0].2.contains("1..400"),
        "{over:?}"
    );
    assert_eq!(scene_schema(0).len(), 1);
}

/// `style.x` / `style.y` on a clip's root element has no effect (the root node is laid out from the canvas origin, §6.4) → `clip-root-xy-ignored` (warn). The pointer lands on the first key that has no effect, and the message gives the fix (wrap it in a full-frame Box). Writing 0, writing it on a child node, or using a `$` reference (the value is only known at resolve time) is not reported.
#[test]
fn clip_root_style_xy_warns_because_the_root_is_laid_out_at_the_origin() {
    let with_root = |style: Value| {
        let mut doc = doc_with_text("hi");
        doc["tracks"][0]["clips"][0]["element"]["style"] = style;
        lint(&doc)
            .into_iter()
            .filter(|d| d.rule == "clip-root-xy-ignored")
            .map(|d| (d.severity, d.pointer, d.message))
            .collect::<Vec<_>>()
    };
    let hits = with_root(json!({"fontSize": 40, "x": 160, "y": 460}));
    assert_eq!(hits.len(), 1, "{hits:?}");
    let (severity, pointer, message) = &hits[0];
    assert_eq!(*severity, Severity::Warn);
    assert_eq!(pointer, "/tracks/0/clips/0/element/style/x");
    for needle in ["\"c\"", "x=160", "y=460", "canvas origin", "Box"] {
        assert!(message.contains(needle), "missing {needle}: {message}");
    }
    let only_y = with_root(json!({"fontSize": 40, "y": "25%"}));
    assert_eq!(only_y.len(), 1, "{only_y:?}");
    assert_eq!(only_y[0].1, "/tracks/0/clips/0/element/style/y");

    for quiet in [
        json!({"fontSize": 40}),
        json!({"fontSize": 40, "x": 0, "y": 0}),
        json!({"fontSize": 40, "x": "0%"}),
        json!({"fontSize": 40, "x": "$vars.left"}),
    ] {
        assert!(with_root(quiet.clone()).is_empty(), "{quiet}");
    }

    // x/y on child nodes still takes effect as usual, not reported
    let mut doc = doc_with_text("hi");
    doc["tracks"][0]["clips"][0]["element"] = json!({
        "type": "box", "id": "root", "style": {"width": 1920, "height": 1080},
        "children": [{"type": "text", "id": "t", "text": "hi",
                      "style": {"fontSize": 40, "x": 160, "y": 460}}]
    });
    assert!(!codes(&doc).contains(&"clip-root-xy-ignored"));
}

/// `preset-unknown` is no longer swallowed by an earlier resolve error (§16): resolve fails fast, so a `motion-unsupported` hit first in the document (reported as `schema`, pointer `/`) used to hide a mistyped preset further down in `animate.parts`, surfacing only after each fix. Now an unknown preset is reported at its reference during the static phase, appearing together with the resolve error; `op: "preset"` entries in flow / parts also count as references.
#[test]
fn preset_unknown_is_reported_alongside_an_earlier_resolve_error() {
    let doc = json!({
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "a", "dur": 1}, {"id": "b", "dur": 1}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "c-rx", "start": "@a", "end": "@a.end",
             "element": {"type": "box", "id": "rx",
                         "style": {"width": 1920, "height": 1080},
                         "animate": {"keyframes": [{"prop": "rotationX",
                             "frames": [{"t": "@a", "v": 0}, {"t": "@a.end", "v": 80}]}]}}},
            {"id": "c-parts", "start": "@b", "end": "@b.end",
             "element": {"type": "text", "id": "t", "text": "FROM FIRE",
                         "style": {"fontSize": 96}, "split": {"by": "word"},
                         "animate": {"parts": {"op": "stagger", "gap": 0.1, "parts": true,
                             "item": {"op": "preset", "preset": "motion.blurParts",
                                      "presetVersion": 1}}}}}
        ]}]
    });
    let diags = lint(&doc);
    assert!(
        diags.iter().any(|d| d.rule == "schema" && d.pointer == "/"),
        "{diags:?}"
    );
    let unknown: Vec<_> = diags
        .iter()
        .filter(|d| d.rule == "preset-unknown")
        .collect();
    assert_eq!(unknown.len(), 1, "{diags:?}");
    assert_eq!(
        unknown[0].pointer,
        "/tracks/0/clips/1/element/animate/parts/item/preset"
    );
    assert_eq!(unknown[0].severity, Severity::Error);
    assert!(
        unknown[0].message.contains("motion.blurParts"),
        "{}",
        unknown[0].message
    );
}

/// An unknown preset already reported statically is not repeated by the resolve-failure entry (pointer `/`); known presets from the manifest, frozen recipes or the project level are not reported.
#[test]
fn preset_unknown_is_reported_once_at_the_reference() {
    let doc = doc_with_animate(json!({"enter": {"preset": "notAPreset", "dur": 0.4}}));
    let unknown: Vec<_> = lint(&doc)
        .into_iter()
        .filter(|d| d.rule == "preset-unknown")
        .collect();
    assert_eq!(unknown.len(), 1, "{unknown:?}");
    assert_eq!(
        unknown[0].pointer,
        "/tracks/0/clips/0/element/animate/enter/preset"
    );

    let flow = doc_with_animate(json!({"flow": {"op": "sequence", "items": [
        {"op": "preset", "preset": "motion.fadeIn"},
        {"op": "wait", "dur": 0.2},
        {"op": "preset", "preset": "motion.nope"}
    ]}}));
    let unknown: Vec<_> = lint(&flow)
        .into_iter()
        .filter(|d| d.rule == "preset-unknown")
        .collect();
    assert_eq!(unknown.len(), 1, "{unknown:?}");
    assert_eq!(
        unknown[0].pointer,
        "/tracks/0/clips/0/element/animate/flow/items/2/preset"
    );

    for known in [
        json!({"enter": {"preset": "motion.moveIn", "dur": 0.4}}),
        json!({"enter": {"preset": "fadeIn", "dur": 0.4}}),
        json!({"enter": {"preset": "mine", "dur": 0.4}}),
        json!({"flow": {"op": "preset", "preset": "motion.blurIn"}}),
    ] {
        let mut doc = doc_with_animate(known.clone());
        doc["presets"] = json!({"mine": {"keyframes": [
            {"prop": "opacity", "frames": [{"t": "0%", "v": 0}, {"t": "100%", "v": 1}]}
        ]}});
        assert!(
            !codes(&doc).contains(&"preset-unknown"),
            "{known}: {:?}",
            lint(&doc)
        );
    }
}

/// `op: "preset"` in flow / parts does not read the project-level `presets` (resolve looks up the registry directly): using a project-level name makes resolve fail, and lint reports it at the reference, explaining that it can only be used for enter / exit / emphasis.
#[test]
fn flow_preset_ops_do_not_see_project_presets() {
    let mut doc = doc_with_animate(json!({"flow": {"op": "preset", "preset": "mine"}}));
    doc["presets"] = json!({"mine": {"keyframes": [
        {"prop": "opacity", "frames": [{"t": "0%", "v": 0}, {"t": "100%", "v": 1}]}
    ]}});
    let err = scene_primitives::Resolver::new(doc.clone(), None)
        .and_then(|mut r| r.resolve())
        .err()
        .expect("resolve should reject");
    assert!(err.to_string().starts_with("preset-unknown"), "{err}");
    let unknown: Vec<_> = lint(&doc)
        .into_iter()
        .filter(|d| d.rule == "preset-unknown")
        .collect();
    assert_eq!(unknown.len(), 1, "{unknown:?}");
    assert_eq!(
        unknown[0].pointer,
        "/tracks/0/clips/0/element/animate/flow/preset"
    );
    assert!(
        unknown[0].message.contains("enter / exit / emphasis"),
        "{}",
        unknown[0].message
    );
}
