//! BCF document version and `0.1 → 0.2` migration (ADR-M13, spec §4 / §16).
//!
//! 0.2 does **only one thing**: it promotes fields marked "experimental" in 0.1 drafts to formal
//! (`animate.flow` / `animate.parts` / `split` / `effects` / `style.blendMode` / structured curves / `states` / `constraints` / `layoutStates`), and requires recipe references to pin a version. Semantics have not changed by a single byte — **0.1 documents remain readable forever**; the legacy four slots, aliases, and old field names are all kept.
//!
//! Migration is therefore **non-destructive**: it only writes the two top-level keys `ccut` / `motionVersion`, and fills in `presetVersion` with the current implementation version wherever a recipe is already referenced without one. It does not reorder fields, delete legacy entries, or change any value.

use anyhow::{Result, bail};
use serde_json::{Map, Value};

use crate::json::JsonExt;
use crate::lint::{Diagnostic, Severity};

/// All BCF document versions this implementation can read. **Only additions, never removals**: 0.1 is always listed.
pub use crate::bcf_version::BCF_SUPPORTED as BCF_VERSIONS;

/// Version newly written documents default to (the default target of `ccut migrate --to`).
pub use crate::bcf_version::BCF_CURRENT;

/// Documents missing the `ccut` key are read as this version (`bcf-version-missing`, warn).
pub const BCF_FALLBACK: &str = "0.1";

/// Animation kernel version declared by 0.2 documents (`motionVersion`).
pub const MOTION_VERSION: u64 = 1;

/// The version declared by the document; when the key is missing, [`BCF_FALLBACK`] applies.
pub fn doc_version(doc: &Value) -> &str {
    doc.gstr("ccut").unwrap_or(BCF_FALLBACK)
}

pub fn is_supported(version: &str) -> bool {
    BCF_VERSIONS.contains(&version)
}

/// `0.1 → 0.2` migration (ADR-M13).
///
/// When `from` is `None`, it follows the document's own declaration; when `to` is `None`, it uses [`BCF_CURRENT`].
/// Returns the migrated document and process diagnostics (which `presetVersion`s were filled in).
pub fn migrate_doc(
    doc: &Value,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<(Value, Vec<Diagnostic>)> {
    let declared = doc_version(doc);
    let from = from.unwrap_or(declared);
    let to = to.unwrap_or(BCF_CURRENT);
    if !is_supported(from) {
        bail!("bcf-version-unsupported: source version \"{from}\" is not in {BCF_VERSIONS:?}");
    }
    if !is_supported(to) {
        bail!("bcf-version-unsupported: target version \"{to}\" is not in {BCF_VERSIONS:?}");
    }
    if from != declared {
        bail!(
            "bcf-version-unsupported: --from \"{from}\" does not match the document's declared \"{declared}\"; \
             migration does not guess the version"
        );
    }
    if from == to {
        return Ok((doc.clone(), Vec::new()));
    }
    if from != "0.1" || to != "0.2" {
        bail!("bcf-version-unsupported: this implementation only provides the 0.1 → 0.2 migration path");
    }
    let Some(object) = doc.as_object() else {
        bail!("schema: document root must be an object");
    };

    let mut out = object.clone();
    let mut diagnostics = Vec::new();
    out.insert("ccut".to_owned(), Value::from(to));
    diagnostics.push(Diagnostic {
        rule: "bcf-version-missing",
        severity: Severity::Info,
        pointer: "/ccut".to_owned(),
        message: format!("ccut version set to \"{to}\" (was declared as \"{declared}\")"),
    });
    if !out.contains_key("motionVersion") {
        out.insert("motionVersion".to_owned(), Value::from(MOTION_VERSION));
        diagnostics.push(Diagnostic {
            rule: "bcf-version-missing",
            severity: Severity::Info,
            pointer: "/motionVersion".to_owned(),
            message: format!("add motionVersion = {MOTION_VERSION} (ADR-M13)"),
        });
    }

    let mut migrated = Value::Object(out);
    backfill_preset_versions(&mut migrated, "", &mut diagnostics);
    Ok((migrated, diagnostics))
}

/// Recursively fill in `presetVersion`.
///
/// The judgment is deliberately conservative: it only recognizes the one shape where **the same object** has a string `preset` and no `presetVersion`, and only writes when the registry really recognizes that id. Ids in project-defined `presets` have no version to look up and are left empty (they have no version sequence).
fn backfill_preset_versions(value: &mut Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    match value {
        Value::Object(map) => {
            if let Some(version) = preset_version_for(map) {
                map.insert("presetVersion".to_owned(), Value::from(version));
                out.push(Diagnostic {
                    rule: "bcf-version-missing",
                    severity: Severity::Info,
                    pointer: format!("{ptr}/presetVersion"),
                    message: format!(
                        "add presetVersion = {version} (recipe {})",
                        map.get("preset").and_then(Value::as_str).unwrap_or("")
                    ),
                });
            }
            let keys: Vec<String> = map.keys().cloned().collect();
            for key in keys {
                if let Some(child) = map.get_mut(&key) {
                    backfill_preset_versions(child, &format!("{ptr}/{key}"), out);
                }
            }
        }
        Value::Array(items) => {
            for (index, item) in items.iter_mut().enumerate() {
                backfill_preset_versions(item, &format!("{ptr}/{index}"), out);
            }
        }
        _ => {}
    }
}

fn preset_version_for(map: &Map<String, Value>) -> Option<u32> {
    let id = map.get("preset")?.as_str()?;
    if map.get("presetVersion").is_some_and(|v| !v.is_null()) {
        return None;
    }
    // Animation recipes (including aliases) take priority; then the effect registry is consulted.
    let canonical = motion::preset_registry::canonical_id(id);
    if let Some(manifest) = motion::preset_registry::manifest(canonical) {
        return Some(manifest.version);
    }
    if motion::preset_registry::bcf_preset(canonical).is_some() {
        // Frozen `bcf.*` recipes are only @1.
        return Some(1);
    }
    motion::effect::builtin_registry()
        .latest(id)
        .map(|manifest| manifest.version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn doc() -> Value {
        json!({
            "ccut": "0.1",
            "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 30},
            "scenes": [{"id": "s", "dur": 3}],
            "tracks": [{"id": "main", "kind": "visual", "clips": [
                {"id": "c", "start": 0, "end": "@s.end", "element": {
                    "type": "text", "id": "el", "text": "hi",
                    "animate": {"enter": {"preset": "motion.moveIn", "dur": 0.4}},
                    "effects": [{"preset": "filter.blur", "params": {"radius": 0.01}}]
                }}
            ]}]
        })
    }

    #[test]
    fn migration_sets_the_version_keys_and_backfills_preset_versions() {
        let (out, diagnostics) = migrate_doc(&doc(), None, None).unwrap();
        assert_eq!(out["ccut"], "0.2");
        assert_eq!(out["motionVersion"], 1);
        let element = &out["tracks"][0]["clips"][0]["element"];
        assert_eq!(element["animate"]["enter"]["presetVersion"], 1);
        assert_eq!(element["effects"][0]["presetVersion"], 1);
        assert!(diagnostics.len() >= 3);
    }

    /// Non-destructive: except for the three newly added keys, everything else is byte-identical.
    #[test]
    fn migration_touches_nothing_else() {
        let before = doc();
        let (mut after, _) = migrate_doc(&before, None, None).unwrap();
        let object = after.as_object_mut().unwrap();
        object.insert("ccut".to_owned(), Value::from("0.1"));
        object.remove("motionVersion");
        let element = after
            .pointer_mut("/tracks/0/clips/0/element")
            .and_then(Value::as_object_mut)
            .unwrap()
            .clone();
        let mut element = element;
        element
            .get_mut("animate")
            .and_then(Value::as_object_mut)
            .and_then(|a| a.get_mut("enter"))
            .and_then(Value::as_object_mut)
            .unwrap()
            .remove("presetVersion");
        element
            .get_mut("effects")
            .and_then(Value::as_array_mut)
            .unwrap()[0]
            .as_object_mut()
            .unwrap()
            .remove("presetVersion");
        *after.pointer_mut("/tracks/0/clips/0/element").unwrap() = Value::Object(element);
        assert_eq!(after, before);
    }

    #[test]
    fn migrating_an_already_current_document_is_a_no_op() {
        let (out, _) = migrate_doc(&doc(), None, None).unwrap();
        let (again, diagnostics) = migrate_doc(&out, None, None).unwrap();
        assert_eq!(again, out);
        assert!(diagnostics.is_empty());
    }

    #[test]
    fn unsupported_versions_are_refused() {
        let mut doc = doc();
        doc["ccut"] = Value::from("0.9");
        let error = migrate_doc(&doc, None, None).unwrap_err().to_string();
        assert!(error.starts_with("bcf-version-unsupported"), "{error}");
        // When `--from` does not match the document's declaration, nothing is guessed.
        let doc = super::tests::doc();
        let error = migrate_doc(&doc, Some("0.2"), None)
            .unwrap_err()
            .to_string();
        assert!(error.starts_with("bcf-version-unsupported"), "{error}");
    }
}
