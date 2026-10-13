//! The **end-to-end landing loop** from text preset packs to `timeline.json` (`docs/design/app-v2/text-pane-and-groups.md` §6.2).
//!
//! Presets live in `ccut-motion`, and that crate checks that the registry is internally consistent (closed category set, and shape and animation names all resolve to recipes). What it cannot check is this layer: whether the payload `instantiate` produces **can actually land in a document**. The `deny_unknown_fields` on `Element`, the closed `ENTER_PRESETS` / `EXIT_PRESETS` sets, and the 0.1..=2.0 range for `dur` all live on the `ccut-timeline` side.
//!
//! Without this test, “the panel click → kernel reports invalid” could only be discovered by users.

use motion::preset_registry::{TextPresetCategory, text_presets, textpreset};
use timeline::schema::{Element, ElementKind, TimeValue, Track, TrackKind};

/// Every preset, once landed, is a **valid document**: the field names are recognized, the animation is in the closed set, and the durations are ordered.
#[test]
fn every_builtin_text_preset_lands_as_a_valid_document() {
    let presets = text_presets();
    assert_eq!(presets.len(), 51, "内置目录条数变了就要同步这条断言");

    for recipe in presets {
        let elements = textpreset::instantiate(recipe, 3.0, 600.0);
        assert_eq!(elements.len(), recipe.content.len(), "{}", recipe.id);

        let parsed: Vec<Element> = elements
            .iter()
            .enumerate()
            .map(|(index, value)| {
                let mut value = value.clone();
                // The id for `addElement` is assigned by the kernel; fill one in first so validation can run.
                value["id"] = serde_json::json!(format!("el-{index}"));
                serde_json::from_value(value).unwrap_or_else(|error| {
                    panic!("{} 的第 {index} 个元素不是合法 Element：{error}", recipe.id)
                })
            })
            .collect();

        for element in &parsed {
            assert!(
                matches!(element.kind, ElementKind::Text | ElementKind::Shape),
                "{} 出现了非 text/shape 的 kind",
                recipe.id
            );
            let seconds = |value: &Option<TimeValue>| match value {
                Some(TimeValue::Seconds(seconds)) => *seconds,
                other => panic!("预设的时间点必须是秒，实为 {other:?}"),
            };
            let (start, end) = (seconds(&element.start), seconds(&element.end));
            assert!(start < end, "{} 的元素时长非正", recipe.id);
            assert!(start >= 3.0 - 1e-9, "{} 的成员早于预设起点", recipe.id);
        }

        // Run validation over the whole document: the animation closed set, the `dur` range and `place` finiteness all turn red here.
        let document = document_with(parsed);
        document
            .validate()
            .unwrap_or_else(|error| panic!("{} 校验不过：{error}", recipe.id));
    }
}

/// Category distribution = the default catalog (simple 13 / title 10 / lowerThird 20 / other 8).
/// Changing the catalog turns this red, which is exactly what needs to be pinned down.
#[test]
fn the_catalogue_keeps_the_ported_category_split() {
    let counts = TextPresetCategory::ALL.map(|category| {
        text_presets()
            .iter()
            .filter(|recipe| recipe.category == category)
            .count()
    });
    assert_eq!(counts, [13, 10, 20, 8]);
}

/// Every preset has at least one text member: once the preset library lands, it has to claim “the first text member”, and a purely shape preset would make that claim silently fail.
#[test]
fn every_preset_carries_at_least_one_text_member() {
    for recipe in text_presets() {
        assert!(recipe.headline().is_some(), "{} 没有文字成员", recipe.id);
    }
}

fn document_with(elements: Vec<Element>) -> timeline::schema::TimelineDocument {
    let tracks = vec![Track {
        id: "text".to_owned(),
        kind: TrackKind::Overlay,
        name: Some("Text".to_owned()),
        hidden: false,
        locked: false,
        muted: false,
        elements,
    }];
    timeline::schema::TimelineDocument {
        tracks,
        ..Default::default()
    }
}
