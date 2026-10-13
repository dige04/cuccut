//! Timeline partial patch (`patchTimeline`): compresses the difference between the editor's “whole timeline.json snapshot” into a patch containing only the changes, and applies it in place on the server to [`TimelineDocument`].
//!
//! The motivation is the same as `ccut-flow-core::patch` (`patchTranscript`): the Mac editor holds a mutable `Doc` locally, and every clip / element / track gesture used to be sent back as a whole `replaceTimeline`. timeline.json is usually only a few KB, so size is not the problem; the problem is **semantics**. Replacing the whole document makes the client rebuild, along with everything else, fields it should not touch, such as cut provenance and word anchors, and it also makes “what changed” impossible to tell apart in the journal and in the reply. A patch makes the request proportional to the change, and the semantics stay “the client submits the final value it wants”; business rules do not move back to the server.
//!
//! Patch shape (fields in the op other than `kind`; every section may be omitted):
//!
//! ```jsonc
//! {
//!   // Media sources: id → full Source (added or replaced as a whole; a source is small); null deletes. "main" can be written but not deleted.
//!   "sources": { "<id>": { path, kind, duration, … } | null },
//!   // The main-track clips are an ordered array, with the same shape as patchTranscript.words.
//!   "clips": {
//!     "update":  { "<id>": { "in"?, "out"?, "rate"?, "srcId"? } },   // field-level merge; null deletes an optional field
//!     "splices": [
//!       { "first": "<id>", "last": "<id>", "clips": [ {id,in,out,…}, … ] },   // closed-interval replacement (empty means delete)
//!       { "after": "<id>" | null,          "clips": [ … ] }                  // insert (after=null means at the start)
//!     ]
//!   },
//!   // Tracks are also an ordered array: adding or removing whole tracks goes through splices; retained tracks are changed field by field.
//!   "tracks": {
//!     "update": {
//!       "<trackId>": {
//!         "kind"?, "name"?, "hidden"?, "muted"?, "locked"?,                  // field-level merge; null deletes an optional field
//!         "elements": { "update": { "<elId>": { 字段: 值 | null } }, "splices": [ … ] }   // same shape as clips; the element key is `elements`
//!       }
//!     },
//!     "splices": [ { "first","last","tracks":[Track] } | { "after","tracks":[Track] } ]
//!   },
//!   // The main-track transform is small: a whole object; null deletes it.
//!   "main": { place, background, muted } | null,
//!   // Template instance: the whole layer document; null removes it (0.4).
//!   "template": { id, name, layers, … } | null
//! }
//! ```
//!
//! Application order: sources → clips (splices → update) → tracks (splices → update → each track's elements splices → update) → main. The patch operates on the JSON representation of the document; afterwards it is deserialized against the **strict** `ccutTimeline` schema (unknown fields are an error; `0.1`, `0.2`, `0.3` and `0.4` are read, and after deserialization it is always `0.4`, see `schema::TIMELINE_VERSIONS`). The caller then runs `validate()` and projection building; if any step fails an error is returned, and the caller must not write to disk.

use crate::schema::{TimelineDocument, TimelineError};
use serde_json::{Map, Value};

/// Statistics after the patch is applied, used for the `applied` entry in the apply receipt to describe what changed.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PatchSummary {
    pub sources_put: usize,
    pub sources_removed: usize,
    pub clips_updated: usize,
    pub clips_removed: usize,
    pub clips_inserted: usize,
    pub tracks_updated: usize,
    pub tracks_removed: usize,
    pub tracks_inserted: usize,
    pub elements_updated: usize,
    pub elements_removed: usize,
    pub elements_inserted: usize,
    pub main_changed: bool,
    pub template_changed: bool,
}

impl PatchSummary {
    pub fn is_empty(&self) -> bool {
        self == &Self::default()
    }

    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "sourcesPut": self.sources_put,
            "sourcesRemoved": self.sources_removed,
            "clipsUpdated": self.clips_updated,
            "clipsRemoved": self.clips_removed,
            "clipsInserted": self.clips_inserted,
            "tracksUpdated": self.tracks_updated,
            "tracksRemoved": self.tracks_removed,
            "tracksInserted": self.tracks_inserted,
            "elementsUpdated": self.elements_updated,
            "elementsRemoved": self.elements_removed,
            "elementsInserted": self.elements_inserted,
            "mainChanged": self.main_changed,
            "templateChanged": self.template_changed,
        })
    }
}

fn invalid(message: impl Into<String>) -> TimelineError {
    TimelineError::Invalid(message.into())
}

/// Applies the patch to a copy of `document`; on success returns the new document and the statistics. The original document is left untouched.
pub fn apply_patch(
    document: &TimelineDocument,
    patch: &Value,
) -> Result<(TimelineDocument, PatchSummary), TimelineError> {
    let Some(patch) = patch.as_object() else {
        return Err(invalid("patchTimeline 必须是对象"));
    };
    for key in patch.keys() {
        if !matches!(
            key.as_str(),
            "kind" | "sources" | "clips" | "tracks" | "main" | "template"
        ) {
            return Err(invalid(format!("patchTimeline 不认识的键：{key}")));
        }
    }
    let mut root = serde_json::to_value(document)
        .map_err(|error| invalid(format!("序列化 timeline 失败：{error}")))?;
    let mut summary = PatchSummary::default();

    if let Some(sources) = patch.get("sources") {
        let sources = sources
            .as_object()
            .ok_or_else(|| invalid("patchTimeline.sources 必须是对象"))?;
        let table = ensure_object(&mut root, "sources");
        for (id, value) in sources {
            if value.is_null() {
                if id == "main" {
                    return Err(invalid("patchTimeline 不能删除 main source"));
                }
                if table.remove(id).is_some() {
                    summary.sources_removed += 1;
                }
            } else if value.is_object() {
                table.insert(id.clone(), value.clone());
                summary.sources_put += 1;
            } else {
                return Err(invalid(format!(
                    "patchTimeline.sources.{id} 须为对象或 null"
                )));
            }
        }
    }

    if let Some(clips) = patch.get("clips") {
        let (inserted, removed, updated) =
            patch_array(ensure_array(&mut root, "clips"), clips, "clips", "clips")?;
        summary.clips_inserted += inserted;
        summary.clips_removed += removed;
        summary.clips_updated += updated;
    }

    if let Some(tracks) = patch.get("tracks") {
        let tracks = tracks
            .as_object()
            .ok_or_else(|| invalid("patchTimeline.tracks 必须是对象"))?;
        for key in tracks.keys() {
            if !matches!(key.as_str(), "update" | "splices") {
                return Err(invalid(format!("patchTimeline.tracks 不认识的键：{key}")));
            }
        }
        let array = ensure_array(&mut root, "tracks");
        if let Some(splices) = tracks.get("splices") {
            let (inserted, removed) = apply_splices(array, splices, "tracks", "tracks")?;
            summary.tracks_inserted += inserted;
            summary.tracks_removed += removed;
        }
        if let Some(update) = tracks.get("update") {
            let update = update
                .as_object()
                .ok_or_else(|| invalid("patchTimeline.tracks.update 必须是对象"))?;
            for (track_id, fields) in update {
                let fields = fields.as_object().ok_or_else(|| {
                    invalid(format!("patchTimeline.tracks.update.{track_id} 必须是对象"))
                })?;
                let track = array
                    .iter_mut()
                    .find(|track| track["id"].as_str() == Some(track_id))
                    .ok_or_else(|| invalid(format!("patchTimeline：track 不存在：{track_id}")))?;
                let mut touched = false;
                for (key, value) in fields {
                    if key == "elements" {
                        let (inserted, removed, updated) = patch_array(
                            ensure_array(track, "elements"),
                            value,
                            "elements",
                            &format!("tracks.update.{track_id}.elements"),
                        )?;
                        summary.elements_inserted += inserted;
                        summary.elements_removed += removed;
                        summary.elements_updated += updated;
                        continue;
                    }
                    if key == "id" {
                        return Err(invalid("patchTimeline 不能改写 track id"));
                    }
                    merge_field(track, key, value);
                    touched = true;
                }
                if touched {
                    summary.tracks_updated += 1;
                }
            }
        }
    }

    if let Some(main) = patch.get("main") {
        let root_object = root.as_object_mut().expect("timeline root is an object");
        if main.is_null() {
            root_object.remove("main");
        } else if main.is_object() {
            root_object.insert("main".to_owned(), main.clone());
        } else {
            return Err(invalid("patchTimeline.main 须为对象或 null"));
        }
        summary.main_changed = true;
    }

    if let Some(template) = patch.get("template") {
        let root_object = root.as_object_mut().expect("timeline root is an object");
        if template.is_null() {
            root_object.remove("template");
        } else if template.is_object() {
            root_object.insert("template".to_owned(), template.clone());
        } else {
            return Err(invalid("patchTimeline.template 须为对象或 null"));
        }
        summary.template_changed = true;
    }

    let patched: TimelineDocument = serde_json::from_value(root)
        .map_err(|error| invalid(format!("补丁后的 timeline 无效：{error}")))?;
    Ok((patched, summary))
}

fn ensure_object<'a>(root: &'a mut Value, key: &str) -> &'a mut Map<String, Value> {
    let object = root.as_object_mut().expect("timeline root is an object");
    if !object.get(key).is_some_and(Value::is_object) {
        object.insert(key.to_owned(), Value::Object(Map::new()));
    }
    object[key].as_object_mut().expect("just ensured")
}

fn ensure_array<'a>(root: &'a mut Value, key: &str) -> &'a mut Vec<Value> {
    let object = root.as_object_mut().expect("root is an object");
    if !object.get(key).is_some_and(Value::is_array) {
        object.insert(key.to_owned(), Value::Array(Vec::new()));
    }
    object[key].as_array_mut().expect("just ensured")
}

/// Merges `{key: value | null}` into an object: null deletes the key, everything else overwrites.
fn merge_field(target: &mut Value, key: &str, value: &Value) {
    let Some(object) = target.as_object_mut() else {
        return;
    };
    if value.is_null() {
        object.remove(key);
    } else {
        object.insert(key.to_owned(), value.clone());
    }
}

/// Patch for an ordered id array: `{update: {id: {fields}}, splices: [...]}`.
/// Returns (inserted, removed, updated). `items_key` is the key name in a splice that holds the items (`clips` / `elements` / `tracks`); `path` is used only for error messages.
fn patch_array(
    array: &mut Vec<Value>,
    patch: &Value,
    items_key: &str,
    path: &str,
) -> Result<(usize, usize, usize), TimelineError> {
    let patch = patch
        .as_object()
        .ok_or_else(|| invalid(format!("patchTimeline.{path} 必须是对象")))?;
    for key in patch.keys() {
        if !matches!(key.as_str(), "update" | "splices") {
            return Err(invalid(format!("patchTimeline.{path} 不认识的键：{key}")));
        }
    }
    let mut inserted = 0;
    let mut removed = 0;
    let mut updated = 0;
    if let Some(splices) = patch.get("splices") {
        let (i, r) = apply_splices(array, splices, items_key, path)?;
        inserted += i;
        removed += r;
    }
    if let Some(update) = patch.get("update") {
        let update = update
            .as_object()
            .ok_or_else(|| invalid(format!("patchTimeline.{path}.update 必须是对象")))?;
        for (id, fields) in update {
            let fields = fields
                .as_object()
                .ok_or_else(|| invalid(format!("patchTimeline.{path}.update.{id} 必须是对象")))?;
            let item = array
                .iter_mut()
                .find(|item| item["id"].as_str() == Some(id))
                .ok_or_else(|| invalid(format!("patchTimeline：{path} 里不存在 {id}")))?;
            for (key, value) in fields {
                if key == "id" {
                    return Err(invalid(format!("patchTimeline 不能改写 {path} 的 id")));
                }
                merge_field(item, key, value);
            }
            updated += 1;
        }
    }
    Ok((inserted, removed, updated))
}

/// Returns (inserted, removed).
fn apply_splices(
    array: &mut Vec<Value>,
    splices: &Value,
    items_key: &str,
    path: &str,
) -> Result<(usize, usize), TimelineError> {
    let splices = splices
        .as_array()
        .ok_or_else(|| invalid(format!("patchTimeline.{path}.splices 必须是数组")))?;
    let mut inserted = 0;
    let mut removed = 0;
    for splice in splices {
        let splice = splice
            .as_object()
            .ok_or_else(|| invalid(format!("patchTimeline.{path}.splices[] 必须是对象")))?;
        let items = splice
            .get(items_key)
            .and_then(Value::as_array)
            .ok_or_else(|| invalid(format!("patchTimeline.{path}.splices[] 缺 {items_key}[]")))?;
        for item in items {
            if !item.get("id").is_some_and(Value::is_string) {
                return Err(invalid(format!(
                    "patchTimeline.{path}.splices[].{items_key}[] 每项须带 id"
                )));
            }
        }
        let position = |id: &str| {
            array
                .iter()
                .position(|item| item["id"].as_str() == Some(id))
        };
        match (
            splice.get("first").and_then(Value::as_str),
            splice.get("last").and_then(Value::as_str),
        ) {
            (Some(first), Some(last)) => {
                let start = position(first)
                    .ok_or_else(|| invalid(format!("patchTimeline：{path} 里不存在 {first}")))?;
                let end = position(last)
                    .ok_or_else(|| invalid(format!("patchTimeline：{path} 里不存在 {last}")))?;
                if end < start {
                    return Err(invalid(format!(
                        "patchTimeline：{path} splice 区间反了（{first}..{last}）"
                    )));
                }
                removed += end - start + 1;
                inserted += items.len();
                array.splice(start..=end, items.iter().cloned());
            }
            (None, None) => {
                let at = match splice.get("after") {
                    None | Some(Value::Null) => 0,
                    Some(Value::String(after)) => {
                        position(after).ok_or_else(|| {
                            invalid(format!("patchTimeline：{path} 里不存在 {after}"))
                        })? + 1
                    }
                    Some(_) => {
                        return Err(invalid(format!(
                            "patchTimeline.{path}.splices[].after 须为 id 或 null"
                        )));
                    }
                };
                inserted += items.len();
                array.splice(at..at, items.iter().cloned());
            }
            _ => {
                return Err(invalid(format!(
                    "patchTimeline.{path}.splices[] 须同时给 first/last，或只给 after"
                )));
            }
        }
    }
    Ok((inserted, removed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn document() -> TimelineDocument {
        serde_json::from_value(json!({
            "ccutTimeline": "0.1",
            "sources": {
                "main": {},
                "src-1": {"path": "media/b.mp4", "kind": "video", "duration": 8.0}
            },
            "clips": [
                {"id": "c1", "in": 0.0, "out": 10.0},
                {"id": "c2", "in": 10.0, "out": 20.0, "srcId": "src-1"}
            ],
            "tracks": [
                {"id": "text", "kind": "overlay", "elements": [
                    {"id": "el-1", "kind": "text", "start": 1.0, "end": 3.0, "text": "hi", "place": {"x": 50, "y": 40}}
                ]},
                {"id": "wm", "kind": "overlay", "name": "Watermark", "elements": []}
            ],
            "main": {"place": {"x": 50, "y": 50, "scale": 1, "rot": 0, "opacity": 1}, "background": "blur"}
        }))
        .unwrap()
    }

    #[test]
    fn a_split_is_one_clip_update_and_one_insertion() {
        let (patched, summary) = apply_patch(
            &document(),
            &json!({
                "kind": "patchTimeline",
                "clips": {
                    "update": {"c1": {"out": 4.0}},
                    "splices": [{"after": "c1", "clips": [{"id": "clip-3", "in": 4.0, "out": 10.0}]}]
                }
            }),
        )
        .unwrap();
        let ids: Vec<_> = patched.clips.iter().map(|clip| clip.id.as_str()).collect();
        assert_eq!(ids, ["c1", "clip-3", "c2"]);
        assert_eq!(patched.clips[0].out, 4.0);
        assert_eq!(patched.clips[1].in_time, 4.0);
        assert_eq!(summary.clips_updated, 1);
        assert_eq!(summary.clips_inserted, 1);
        assert_eq!(summary.clips_removed, 0);
        // Parts that are not touched are kept as they are.
        assert_eq!(patched.sources.len(), 2);
        assert_eq!(patched.tracks.len(), 2);
        assert!(patched.main.is_some());
    }

    #[test]
    fn element_and_track_fields_merge_and_null_removes_optional_fields() {
        let (patched, summary) = apply_patch(
            &document(),
            &json!({
                "kind": "patchTimeline",
                "tracks": {
                    "update": {
                        "text": {"elements": {"update": {"el-1": {"end": 5.0, "text": "hello", "place": {"x": 10, "y": 20}}}}},
                        "wm": {"name": null, "hidden": true}
                    }
                },
                "main": null
            }),
        )
        .unwrap();
        let element = &patched.tracks[0].elements[0];
        assert_eq!(element.end, Some(crate::schema::TimeValue::Seconds(5.0)));
        assert_eq!(element.text.as_deref(), Some("hello"));
        assert_eq!(patched.tracks[1].name, None);
        assert!(patched.tracks[1].hidden);
        assert!(patched.main.is_none());
        assert_eq!(summary.elements_updated, 1);
        assert_eq!(summary.tracks_updated, 1);
        assert!(summary.main_changed);
        assert!(!summary.template_changed);
    }

    #[test]
    fn template_is_replaced_whole_and_null_removes_it() {
        let template = serde_json::to_value(crate::template::instance(
            &crate::template::builtin("tpl-progress-line").unwrap(),
        ))
        .unwrap();
        let (patched, summary) = apply_patch(
            &document(),
            &json!({"kind": "patchTimeline", "template": template}),
        )
        .unwrap();
        assert!(summary.template_changed);
        assert_eq!(
            patched.template.as_ref().unwrap().from.as_deref(),
            Some("tpl-progress-line")
        );
        patched.validate().unwrap();
        let (cleared, summary) = apply_patch(
            &patched,
            &json!({"kind": "patchTimeline", "template": null}),
        )
        .unwrap();
        assert!(summary.template_changed);
        assert!(cleared.template.is_none());
        assert!(apply_patch(&patched, &json!({"kind": "patchTimeline", "template": 3})).is_err());
        // A wrong layer kind is blocked by the strict schema already at the patch stage.
        assert!(apply_patch(
            &patched,
            &json!({"kind": "patchTimeline", "template": {"id": "t", "name": "n", "layers": [{"id": "a", "kind": "nope", "box": {"x": 0, "y": 0, "w": 10, "h": 10}}]}})
        )
        .is_err());
    }

    #[test]
    fn whole_tracks_and_sources_are_added_and_removed() {
        let (patched, summary) = apply_patch(
            &document(),
            &json!({
                "kind": "patchTimeline",
                "sources": {
                    "src-1": null,
                    "src-2": {"path": "media/c.png", "kind": "image", "duration": 0.0}
                },
                "clips": {"splices": [{"first": "c2", "last": "c2", "clips": []}]},
                "tracks": {
                    "splices": [
                        {"first": "wm", "last": "wm", "tracks": []},
                        {"after": null, "tracks": [{"id": "broll", "kind": "overlay", "elements": [
                            {"id": "br-1", "kind": "image", "srcId": "src-2", "start": 0.0, "end": 4.0, "place": {"x": 71, "y": 29}}
                        ]}]}
                    ]
                }
            }),
        )
        .unwrap();
        assert!(!patched.sources.contains_key("src-1"));
        assert!(patched.sources.contains_key("src-2"));
        let ids: Vec<_> = patched
            .tracks
            .iter()
            .map(|track| track.id.as_str())
            .collect();
        assert_eq!(ids, ["broll", "text"]);
        assert_eq!(patched.clips.len(), 1);
        assert_eq!(summary.sources_removed, 1);
        assert_eq!(summary.sources_put, 1);
        assert_eq!(summary.tracks_removed, 1);
        assert_eq!(summary.tracks_inserted, 1);
        assert_eq!(summary.clips_removed, 1);
    }

    #[test]
    fn dangling_references_and_unknown_fields_are_rejected_before_anything_is_written() {
        let original = document();
        for patch in [
            json!({"kind": "patchTimeline", "clips": {"update": {"nope": {"out": 1.0}}}}),
            json!({"kind": "patchTimeline", "clips": {"splices": [{"after": "nope", "clips": []}]}}),
            json!({"kind": "patchTimeline", "tracks": {"update": {"text": {"elements": {"update": {"el-9": {"end": 1.0}}}}}}}),
            json!({"kind": "patchTimeline", "tracks": {"update": {"text": {"id": "renamed"}}}}),
            json!({"kind": "patchTimeline", "sources": {"main": null}}),
            json!({"kind": "patchTimeline", "clips": {"update": {"c1": {"bogus": 1}}}}),
            json!({"kind": "patchTimeline", "extra": {}}),
        ] {
            let error = apply_patch(&original, &patch).expect_err(&patch.to_string());
            assert!(matches!(error, TimelineError::Invalid(_)), "{patch}");
        }
        // The input document is not touched.
        assert_eq!(original, document());
    }
}
