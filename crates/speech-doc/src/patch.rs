//! Partial transcript patch (`patchTranscript`): compresses the diff between the editor's "whole-document snapshot" into a patch containing only the changes, and applies it in place on the server to [`TranscriptDoc`].
//!
//! Motivation: the Mac editor holds a mutable document locally. After editing a speaker name, a chapter, a paragraph break or a subtitle segment, it used to send the whole thing back via `replaceTranscript`. A word-by-word transcript of several hours easily reaches several MB, which hits the request body limit and also makes every keystroke's disk write, history and projection be computed over the full document. The patch brings the cost of network and journal down to be proportional to the change, while the semantics remain "the client submits the final value it wants", without moving business rules back to the server.
//!
//! Patch shape (fields in an op other than `kind`):
//!
//! ```jsonc
//! {
//!   "words": {
//!     // in-place word edits: only list the fields that changed
//!     "update":  { "<id>": { "t0"?: 1.2, "t1"?: 1.5, "text"?: "…", "sp"?: "s1" } },
//!     // structural changes: closed-interval replacement (empty words means delete); or insert after a given word (after=null means at the start)
//!     "splices": [
//!       { "first": "<id>", "last": "<id>", "words": [ {id,t0,t1,text,sp}, … ] },
//!       { "after": "<id>" | null,          "words": [ … ] }
//!     ]
//!   },
//!   "set": {
//!     // sparse tables: key → new value; null deletes the key
//!     "speakers":   { "<id>": {"name": "…", "hue"?: 210} | null },
//!     "breaks":     { "<wordId>": "break" | "nobreak" | null },
//!     // optimizer auto-pins: profile → null deletes the whole table; profile → {wordId → value | null}
//!     "autoBreaks": { "<profile>": null | { "<wordId>": "break" | "nobreak" | null } },
//!     // the active LayoutProfile id; null reverts to the default "default"
//!     "layoutProfile": "<id>" | null,
//!     "paraBreaks": { "<wordId>": true | null },
//!     "hidden":     { "<wordId>": true | null },
//!     // stage stamp: a string is written as-is; null clears it; true = stamp with the content fingerprint of words after the patch is applied
//!     // (the only way for a client without the full words to declare that “this table matches the current text”)
//!     "stages":     { "asr"|"asrLayout"|"polish"|"segment"|"chapters": "…" | null | true },
//!     // two-level table: lang → null deletes the whole language; lang → {sid → value | null}
//!     "trans":      { "<lang>": null | { "<sid>": "…" | null } },
//!     "transAlign": { "<lang>": null | { "<sid>": {mode,pieces,…} | null } },
//!     "transSrc":   { "<lang>": null | { "<sid>": "…" | null } },
//!     // 0.4 monotonic display rewrite: lang → sid → {text,basis,transFingerprint}
//!     "transDisplay": { "<lang>": null | { "<sid>": {text,basis,transFingerprint} | null } },
//!     // the chapter table is small, so it is replaced whole
//!     "chapters":   [ {id,title,start,end}, … ]
//!   }
//! }
//! ```
//!
//! Application order: splices → update → set. After everything is applied, the caller runs [`TranscriptDoc::validate`]; the patch itself only guarantees that the referenced words/table keys exist and does no business validation. If any step fails, an error is returned and the caller must not write to disk (the patch operates on an in-memory copy).

use crate::doc::{
    BreakOverride, Chapter, Speaker, Stages, TransAlign, TransDisplay, TranscriptDoc, Word,
};
use crate::fingerprint::fingerprint;
use anyhow::{Result, anyhow, bail};
use serde::Deserialize;
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// Statistics after the patch is applied, describing what changed for the `applied` entries in the apply receipt.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PatchSummary {
    pub updated_words: usize,
    pub removed_words: usize,
    pub inserted_words: usize,
    pub splices: usize,
    /// Names of the tables touched by `set` (de-duplicated, in the order they appear in the patch).
    pub tables: Vec<String>,
}

impl PatchSummary {
    pub fn is_empty(&self) -> bool {
        self == &Self::default()
    }

    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "updatedWords": self.updated_words,
            "removedWords": self.removed_words,
            "insertedWords": self.inserted_words,
            "splices": self.splices,
            "tables": self.tables,
        })
    }
}

const WORD_KEYS: &[&str] = &["update", "splices"];
const SET_KEYS: &[&str] = &[
    "speakers",
    "chapters",
    "breaks",
    "autoBreaks",
    "layoutProfile",
    "paraBreaks",
    "hidden",
    "stages",
    "trans",
    "transAlign",
    "transSrc",
    "transDisplay",
];
const STAGE_KEYS: &[&str] = &["asr", "asrLayout", "polish", "segment", "chapters"];

/// Apply the patch to `doc`. `patch` is the op object itself (it may contain `kind`, which is ignored).
///
/// Transactional: if any step fails, `doc` is left unchanged (internally the patch is applied to a copy first, and swapped in only on success).
pub fn apply_patch(doc: &mut TranscriptDoc, patch: &Value) -> Result<PatchSummary> {
    let object = patch
        .as_object()
        .ok_or_else(|| anyhow!("patchTranscript must be an object"))?;
    for key in object.keys() {
        if !matches!(key.as_str(), "kind" | "words" | "set") {
            bail!("patchTranscript has an unknown field: {key}");
        }
    }
    let mut candidate = doc.clone();
    let mut summary = PatchSummary::default();
    if let Some(words) = object.get("words") {
        apply_words(&mut candidate, words, &mut summary)?;
    }
    if let Some(set) = object.get("set") {
        apply_set(&mut candidate, set, &mut summary)?;
    }
    if summary.is_empty() {
        bail!("patchTranscript is empty: neither words nor set changed anything");
    }
    *doc = candidate;
    Ok(summary)
}

fn apply_words(doc: &mut TranscriptDoc, words: &Value, summary: &mut PatchSummary) -> Result<()> {
    let object = words
        .as_object()
        .ok_or_else(|| anyhow!("patchTranscript.words must be an object"))?;
    for key in object.keys() {
        if !WORD_KEYS.contains(&key.as_str()) {
            bail!("patchTranscript.words has an unknown field: {key}");
        }
    }
    if let Some(splices) = object.get("splices") {
        let splices = splices
            .as_array()
            .ok_or_else(|| anyhow!("words.splices must be an array"))?;
        for (index, splice) in splices.iter().enumerate() {
            apply_splice(doc, splice, summary)
                .map_err(|error| anyhow!("words.splices[{index}]：{error}"))?;
        }
    }
    if let Some(update) = object.get("update") {
        let update = update
            .as_object()
            .ok_or_else(|| anyhow!("words.update must be an object"))?;
        apply_word_updates(doc, update, summary)?;
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SpliceBody {
    #[serde(default)]
    first: Option<String>,
    #[serde(default)]
    last: Option<String>,
    /// `Some(None)` = explicit null (insert at the start), `None` = not given.
    #[serde(default, deserialize_with = "deserialize_nullable")]
    after: Option<Option<String>>,
    words: Vec<Word>,
}

fn deserialize_nullable<'de, D>(
    deserializer: D,
) -> std::result::Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(Some)
}

fn apply_splice(doc: &mut TranscriptDoc, splice: &Value, summary: &mut PatchSummary) -> Result<()> {
    let body: SpliceBody = serde_json::from_value(splice.clone())
        .map_err(|error| anyhow!("splice has an invalid shape: {error}"))?;
    let index_of = |doc: &TranscriptDoc, id: &str| -> Result<usize> {
        doc.words
            .iter()
            .position(|word| word.id == id)
            .ok_or_else(|| anyhow!("word {id} does not exist"))
    };
    match (body.first, body.last, body.after) {
        (Some(first), Some(last), None) => {
            let start = index_of(doc, &first)?;
            let end = index_of(doc, &last)?;
            if end < start {
                bail!("first {first} comes after last {last}");
            }
            let removed = end - start + 1;
            let inserted = body.words.len();
            doc.words.splice(start..=end, body.words);
            summary.removed_words += removed;
            summary.inserted_words += inserted;
        }
        (None, None, Some(after)) => {
            if body.words.is_empty() {
                bail!("words of an insert splice must not be empty");
            }
            let at = match after {
                Some(id) => index_of(doc, &id)? + 1,
                None => 0,
            };
            summary.inserted_words += body.words.len();
            doc.words.splice(at..at, body.words);
        }
        _ => bail!("splice must be either {{first,last,words}} or {{after,words}}"),
    }
    summary.splices += 1;
    Ok(())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WordUpdate {
    #[serde(default)]
    t0: Option<f64>,
    #[serde(default)]
    t1: Option<f64>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    sp: Option<String>,
}

fn apply_word_updates(
    doc: &mut TranscriptDoc,
    update: &Map<String, Value>,
    summary: &mut PatchSummary,
) -> Result<()> {
    if update.is_empty() {
        return Ok(());
    }
    // Build the index once: an update may cover thousands of words (e.g. reassigning a whole run of speakers).
    let index: BTreeMap<&str, usize> = doc
        .words
        .iter()
        .enumerate()
        .map(|(index, word)| (word.id.as_str(), index))
        .collect();
    let mut targets = Vec::with_capacity(update.len());
    for (id, fields) in update {
        let position = *index
            .get(id.as_str())
            .ok_or_else(|| anyhow!("words.update: word {id} does not exist"))?;
        let fields: WordUpdate = serde_json::from_value(fields.clone())
            .map_err(|error| anyhow!("words.update[{id}] has an invalid shape: {error}"))?;
        if fields.t0.is_none()
            && fields.t1.is_none()
            && fields.text.is_none()
            && fields.sp.is_none()
        {
            bail!("words.update[{id}] has no fields");
        }
        targets.push((position, fields));
    }
    for (position, fields) in targets {
        let word = &mut doc.words[position];
        if let Some(t0) = fields.t0 {
            word.t0 = t0;
        }
        if let Some(t1) = fields.t1 {
            word.t1 = t1;
        }
        if let Some(text) = fields.text {
            word.text = text;
        }
        if let Some(sp) = fields.sp {
            word.sp = sp;
        }
        summary.updated_words += 1;
    }
    Ok(())
}

fn apply_set(doc: &mut TranscriptDoc, set: &Value, summary: &mut PatchSummary) -> Result<()> {
    let object = set
        .as_object()
        .ok_or_else(|| anyhow!("patchTranscript.set must be an object"))?;
    for (key, value) in object {
        match key.as_str() {
            "speakers" => patch_map(&mut doc.speakers, value, "speakers", |value| {
                serde_json::from_value::<Speaker>(value.clone())
                    .map_err(|error| anyhow!("speaker has an invalid shape: {error}"))
            })?,
            "chapters" => {
                doc.chapters = serde_json::from_value::<Vec<Chapter>>(value.clone())
                    .map_err(|error| anyhow!("set.chapters must be an array of chapters: {error}"))?;
            }
            "breaks" => patch_map(&mut doc.breaks, value, "breaks", |value| {
                serde_json::from_value::<BreakOverride>(value.clone())
                    .map_err(|_| anyhow!("breaks value must be break or nobreak"))
            })?,
            "autoBreaks" => patch_nested(&mut doc.auto_breaks, value, "autoBreaks", |value| {
                serde_json::from_value::<BreakOverride>(value.clone())
                    .map_err(|_| anyhow!("autoBreaks value must be break or nobreak"))
            })?,
            "layoutProfile" => {
                doc.layout_profile = match value {
                    Value::Null => None,
                    Value::String(id) if !id.trim().is_empty() => Some(id.clone()),
                    _ => bail!("set.layoutProfile must be a non-empty string or null"),
                };
            }
            "paraBreaks" => patch_map(&mut doc.para_breaks, value, "paraBreaks", |value| {
                value
                    .as_bool()
                    .ok_or_else(|| anyhow!("paraBreaks value must be a boolean"))
            })?,
            "hidden" => patch_map(&mut doc.hidden, value, "hidden", |value| {
                value
                    .as_bool()
                    .ok_or_else(|| anyhow!("hidden value must be a boolean"))
            })?,
            "stages" => {
                // set is applied last in order, so words are already in their final state; `true` stamps its content fingerprint.
                let current = fingerprint(&doc.words);
                patch_stages(&mut doc.stages, value, &current)?
            }
            "trans" => patch_nested(&mut doc.trans, value, "trans", |value| {
                value
                    .as_str()
                    .map(str::to_owned)
                    .ok_or_else(|| anyhow!("trans value must be a string"))
            })?,
            "transAlign" => patch_nested(&mut doc.trans_align, value, "transAlign", |value| {
                serde_json::from_value::<TransAlign>(value.clone())
                    .map_err(|error| anyhow!("transAlign has an invalid shape: {error}"))
            })?,
            "transSrc" => patch_nested(&mut doc.trans_src, value, "transSrc", |value| {
                value
                    .as_str()
                    .map(str::to_owned)
                    .ok_or_else(|| anyhow!("transSrc value must be a string"))
            })?,
            "transDisplay" => {
                patch_nested(&mut doc.trans_display, value, "transDisplay", |value| {
                    serde_json::from_value::<TransDisplay>(value.clone())
                        .map_err(|error| anyhow!("transDisplay has an invalid shape: {error}"))
                })?
            }
            other => bail!(
                "patchTranscript.set has an unknown table: {other} (available: {})",
                SET_KEYS.join(", ")
            ),
        }
        if !summary.tables.iter().any(|table| table == key) {
            summary.tables.push(key.clone());
        }
    }
    Ok(())
}

/// Sparse table patch: `{key: value | null}`.
fn patch_map<T>(
    table: &mut BTreeMap<String, T>,
    patch: &Value,
    name: &str,
    parse: impl Fn(&Value) -> Result<T>,
) -> Result<()> {
    let object = patch
        .as_object()
        .ok_or_else(|| anyhow!("set.{name} must be an object"))?;
    for (key, value) in object {
        if value.is_null() {
            table.remove(key);
        } else {
            let parsed = parse(value).map_err(|error| anyhow!("set.{name}[{key}]: {error}"))?;
            table.insert(key.clone(), parsed);
        }
    }
    Ok(())
}

/// Two-level table patch: `{lang: null | {sid: value | null}}`. When a language's table is emptied by the patch, it is removed automatically, matching the convention of `skip_serializing_if = "BTreeMap::is_empty"` used in serialization.
fn patch_nested<T>(
    table: &mut BTreeMap<String, BTreeMap<String, T>>,
    patch: &Value,
    name: &str,
    parse: impl Fn(&Value) -> Result<T>,
) -> Result<()> {
    let object = patch
        .as_object()
        .ok_or_else(|| anyhow!("set.{name} must be an object"))?;
    for (lang, value) in object {
        if value.is_null() {
            table.remove(lang);
            continue;
        }
        let entries = value
            .as_object()
            .ok_or_else(|| anyhow!("set.{name}[{lang}] must be an object or null"))?;
        let inner = table.entry(lang.clone()).or_default();
        for (id, entry) in entries {
            if entry.is_null() {
                inner.remove(id);
            } else {
                let parsed =
                    parse(entry).map_err(|error| anyhow!("set.{name}[{lang}][{id}]: {error}"))?;
                inner.insert(id.clone(), parsed);
            }
        }
        if inner.is_empty() {
            table.remove(lang);
        }
    }
    Ok(())
}

/// `current` is the content fingerprint of words after the patch is applied: stages whose value is written as `true` are stamped with it.
fn patch_stages(stages: &mut Stages, patch: &Value, current: &str) -> Result<()> {
    let object = patch
        .as_object()
        .ok_or_else(|| anyhow!("set.stages must be an object"))?;
    for (key, value) in object {
        let slot = match key.as_str() {
            "asr" => &mut stages.asr,
            "asrLayout" => &mut stages.asr_layout,
            "polish" => &mut stages.polish,
            "segment" => &mut stages.segment,
            "chapters" => &mut stages.chapters,
            other => bail!(
                "set.stages has an unknown stage: {other} (available: {})",
                STAGE_KEYS.join(", ")
            ),
        };
        *slot = match value {
            Value::Null => None,
            Value::String(text) => Some(text.clone()),
            Value::Bool(true) => Some(current.to_owned()),
            _ => bail!("set.stages[{key}] must be a string, null or true"),
        };
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::doc::{DocEngine, DocMedia};
    use serde_json::json;

    fn word(id: &str, t0: f64, t1: f64, text: &str) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: text.to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    fn doc() -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: "h".to_owned(),
                duration: 10.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        doc.speakers.insert(
            "s1".to_owned(),
            Speaker {
                name: "Alice".to_owned(),
                hue: Some(10),
            },
        );
        doc.words = vec![
            word("a", 0.0, 1.0, "one"),
            word("b", 1.0, 2.0, "two"),
            word("c", 2.0, 3.0, "three"),
            word("d", 3.0, 4.0, "four"),
        ];
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-a".to_owned(), "一二三四".to_owned());
        doc
    }

    #[test]
    fn renames_speaker_without_touching_words() {
        let mut doc = doc();
        let before_words = doc.words.clone();
        let summary = apply_patch(
            &mut doc,
            &json!({"kind": "patchTranscript", "set": {"speakers": {"s1": {"name": "Bob", "hue": 42}}}}),
        )
        .unwrap();
        assert_eq!(doc.speakers["s1"].name, "Bob");
        assert_eq!(doc.speakers["s1"].hue, Some(42));
        assert_eq!(doc.words, before_words);
        assert_eq!(summary.tables, vec!["speakers"]);
        assert_eq!(summary.updated_words, 0);
        doc.validate().unwrap();
    }

    #[test]
    fn updates_words_in_place_and_splices_ranges() {
        let mut doc = doc();
        let summary = apply_patch(
            &mut doc,
            &json!({
                "words": {
                    "update": {"a": {"text": "ONE"}, "d": {"t1": 4.5}},
                    "splices": [
                        {"first": "b", "last": "c", "words": [
                            {"id": "w1", "t0": 1.0, "t1": 3.0, "text": "twothree", "sp": "s1"}
                        ]},
                        {"after": null, "words": [
                            {"id": "w0", "t0": 0.0, "t1": 0.0, "text": "Hi", "sp": "s1"}
                        ]}
                    ]
                }
            }),
        )
        .unwrap();
        let ids: Vec<&str> = doc.words.iter().map(|word| word.id.as_str()).collect();
        assert_eq!(ids, vec!["w0", "a", "w1", "d"]);
        assert_eq!(doc.words[1].text, "ONE");
        assert_eq!(doc.words[3].t1, 4.5);
        assert_eq!(summary.updated_words, 2);
        assert_eq!(summary.removed_words, 2);
        assert_eq!(summary.inserted_words, 2);
        assert_eq!(summary.splices, 2);
        doc.validate().unwrap();
    }

    #[test]
    fn deletes_a_range_and_patches_nested_tables() {
        let mut doc = doc();
        apply_patch(
            &mut doc,
            &json!({
                "words": {"splices": [{"first": "c", "last": "d", "words": []}]},
                "set": {
                    "paraBreaks": {"b": true},
                    "trans": {"zh": {"s-a": "一二", "s-zzz": null}},
                    "transSrc": {"zh": {"s-a": "fp"}},
                    "stages": {"asr": null, "polish": "p1"},
                    "chapters": [{"id": "c1", "title": "T", "start": 0.0, "end": 2.0}]
                }
            }),
        )
        .unwrap();
        assert_eq!(doc.words.len(), 2);
        assert_eq!(doc.para_breaks["b"], true);
        assert_eq!(doc.trans["zh"]["s-a"], "一二");
        assert_eq!(doc.trans_src["zh"]["s-a"], "fp");
        assert_eq!(doc.stages.polish.as_deref(), Some("p1"));
        assert_eq!(doc.chapters.len(), 1);
        doc.validate().unwrap();

        // When a two-level table is emptied, the whole language disappears, consistent with the serialization convention.
        apply_patch(&mut doc, &json!({"set": {"trans": {"zh": {"s-a": null}}}})).unwrap();
        assert!(doc.trans.get("zh").is_none());
    }

    /// `stages.<stage>: true` stamps the content fingerprint of words **after** the patch is applied. If the same patch first edits words and then declares the chapters consistent, the stamp must equal the fingerprint after the word edits (the client does not have the full words).
    #[test]
    fn stage_true_stamps_the_post_patch_content_fingerprint() {
        let mut doc = doc();
        let before = fingerprint(&doc.words);
        apply_patch(
            &mut doc,
            &json!({
                "words": {"update": {"a": {"text": "changed"}}},
                "set": {
                    "chapters": [{"id": "c1", "title": "T", "start": 0.0, "end": 2.0}],
                    "stages": {"chapters": true, "polish": null}
                }
            }),
        )
        .unwrap();
        let after = fingerprint(&doc.words);
        assert_ne!(before, after);
        assert_eq!(doc.stages.chapters.as_deref(), Some(after.as_str()));
        assert!(doc.stages.polish.is_none());
        // false is not a valid value: it is neither a string nor “stamp current”.
        assert!(apply_patch(&mut doc, &json!({"set": {"stages": {"chapters": false}}})).is_err());
    }

    /// 0.4: `autoBreaks` is a two-level sparse table from profile → word id, and `layoutProfile` is a scalar.
    #[test]
    fn patches_auto_breaks_and_layout_profile() {
        let mut doc = doc();
        let summary = apply_patch(
            &mut doc,
            &json!({
                "set": {
                    "autoBreaks": {"default": {"a": "break", "b": "nobreak"}, "portrait": {"c": "break"}},
                    "layoutProfile": "portrait"
                }
            }),
        )
        .unwrap();
        assert_eq!(summary.tables, vec!["autoBreaks", "layoutProfile"]);
        assert_eq!(doc.auto_breaks["default"]["a"], BreakOverride::Break);
        assert_eq!(doc.auto_breaks["default"]["b"], BreakOverride::Nobreak);
        assert_eq!(doc.layout_profile.as_deref(), Some("portrait"));
        assert_eq!(doc.layout_profile_id(), "portrait");
        // Derivation takes the auto table by the active profile: portrait pins only c.
        assert_eq!(
            doc.effective_breaks(doc.layout_profile_id()),
            BTreeMap::from([("c".to_owned(), BreakOverride::Break)])
        );

        // Single-key deletion, whole-table deletion, and profile reverting to the default.
        apply_patch(
            &mut doc,
            &json!({"set": {
                "autoBreaks": {"default": {"b": null}, "portrait": null},
                "layoutProfile": null
            }}),
        )
        .unwrap();
        assert_eq!(doc.auto_breaks.get("default").map(BTreeMap::len), Some(1));
        assert!(!doc.auto_breaks.contains_key("portrait"));
        assert_eq!(doc.layout_profile, None);
        // When emptied, the whole profile disappears, consistent with the serialization convention.
        apply_patch(
            &mut doc,
            &json!({"set": {"autoBreaks": {"default": {"a": null}}}}),
        )
        .unwrap();
        assert!(doc.auto_breaks.is_empty());
        doc.validate().unwrap();

        // Value-range validation: invalid values and empty profile ids are both rejected, and no half-applied changes are left behind.
        let baseline = doc.clone();
        assert!(
            apply_patch(
                &mut doc,
                &json!({"set": {"autoBreaks": {"default": {"a": "maybe"}}}})
            )
            .is_err()
        );
        assert!(apply_patch(&mut doc, &json!({"set": {"layoutProfile": ""}})).is_err());
        assert!(apply_patch(&mut doc, &json!({"set": {"layoutProfile": 3}})).is_err());
        assert_eq!(doc, baseline);
    }

    /// 0.4: `transDisplay` has the same shape as the other `trans*` tables (lang → sid → value), and its value is a complete `{text,basis,transFingerprint}` object. Single-key deletion and whole-language deletion follow the same convention.
    #[test]
    fn patches_trans_display_table() {
        let mut doc = doc();
        let summary = apply_patch(
            &mut doc,
            &json!({"set": {"transDisplay": {"zh": {"s-a": {
                "text": "我没去，因为我病了。", "basis": "monotonic-rewrite", "transFingerprint": "fp"
            }}}}}),
        )
        .unwrap();
        assert_eq!(summary.tables, vec!["transDisplay"]);
        assert_eq!(doc.trans_display["zh"]["s-a"].text, "我没去，因为我病了。");
        assert_eq!(doc.trans_display["zh"]["s-a"].basis, "monotonic-rewrite");
        // An incomplete shape (missing transFingerprint) is rejected, with no half-applied changes left behind.
        let baseline = doc.clone();
        assert!(
            apply_patch(
                &mut doc,
                &json!({"set": {"transDisplay": {"zh": {"s-b": {"text": "x", "basis": "y"}}}}}),
            )
            .is_err()
        );
        assert_eq!(doc, baseline);
        apply_patch(
            &mut doc,
            &json!({"set": {"transDisplay": {"zh": {"s-a": null}}}}),
        )
        .unwrap();
        assert!(doc.trans_display.get("zh").is_none());
    }

    #[test]
    fn rejects_unknown_ids_tables_and_empty_patches() {
        let mut doc = doc();
        let baseline = doc.clone();
        assert!(
            apply_patch(
                &mut doc,
                &json!({"words": {"update": {"zz": {"text": "x"}}}})
            )
            .is_err()
        );
        assert!(
            apply_patch(
                &mut doc,
                &json!({"words": {"splices": [{"first": "c", "last": "a", "words": []}]}})
            )
            .is_err()
        );
        assert!(apply_patch(&mut doc, &json!({"set": {"media": {"duration": 1}}})).is_err());
        assert!(apply_patch(&mut doc, &json!({"set": {"words": []}})).is_err());
        assert!(apply_patch(&mut doc, &json!({"kind": "patchTranscript"})).is_err());
        assert!(apply_patch(&mut doc, &json!({"set": {"stages": {"bogus": "x"}}})).is_err());
        // First half valid, second half invalid: a failed patch must not leave half-applied changes behind.
        assert!(
            apply_patch(
                &mut doc,
                &json!({
                    "words": {"update": {"a": {"text": "changed"}}},
                    "set": {"speakers": {"s1": {"name": "X"}}, "nope": {}}
                })
            )
            .is_err()
        );
        assert_eq!(doc, baseline);
    }
}
