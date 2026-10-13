//! Generator for `core/runtime/preview/vendor/presets.json` (the preview shell is embedded into `ccut serve`).
//!
//! The browser preview used to be the **fourth implementation** of the BCF built-in recipes (the 5 hand-written `BUILTIN_PRESETS` in `preview/core.js`). After the canonical family added in phase 2 landed, the preview reported `preset-unknown` directly for `motion.*` (design §9 / §15 phase 2 “known gap”). The fix is not to copy the value table by hand a second time, but to **generate the data from the same set of manifests**: `core.js` keeps only the expansion algorithm and copies not a single number.
//!
//! How to run (`#[ignore]`; the routine `cargo test` does not write to disk):
//!
//! ```sh
//! cargo test -p motion --test gen_preview_presets -- --ignored emit_preview_presets_json
//! ```
//!
//! The routine gate is `preview_presets_json_is_up_to_date` in the same file: it renders into memory and compares byte for byte.

use std::collections::BTreeMap;
use std::path::PathBuf;

use motion::preset_registry::{aliases, manifest_ids};
use serde_json::{Map, Value};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("repo root")
}

fn target_path() -> PathBuf {
    repo_root().join("core/runtime/preview/vendor/presets.json")
}

/// Generates the JSON text. All numbers come verbatim from `core/presets/builtin/motion/motion.*.json`.
fn render() -> String {
    let dir = repo_root().join("core/presets/builtin/motion");
    let mut presets: BTreeMap<String, Value> = BTreeMap::new();
    for id in manifest_ids() {
        let path = dir.join(format!("{id}.json"));
        let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path:?}: {e}"));
        let doc: Value = serde_json::from_str(&text).unwrap_or_else(|e| panic!("{path:?}: {e}"));
        assert_eq!(
            doc.get("id").and_then(Value::as_str),
            Some(id),
            "{path:?}: file name does not match manifest id"
        );
        presets.insert(id.to_owned(), doc);
    }
    let alias_map: BTreeMap<String, String> = aliases()
        .into_iter()
        .map(|(alias, canonical)| (alias.to_owned(), canonical.to_owned()))
        .collect();

    let mut root = Map::new();
    root.insert(
        "generatedBy".into(),
        Value::from("core/crates/ccut-motion/tests/gen_preview_presets.rs"),
    );
    root.insert(
        "source".into(),
        Value::from("core/presets/builtin/motion/motion.*.json"),
    );
    root.insert(
        "note".into(),
        Value::from(
            "生成物，请勿手改。展开算法在 preview/core.js（镜像 ccut-motion 的 \
             preset_registry::compose）；ops 体配方在浏览器预览里不展开。",
        ),
    );
    root.insert("aliases".into(), serde_json::to_value(alias_map).unwrap());
    root.insert("presets".into(), serde_json::to_value(presets).unwrap());
    let mut text = serde_json::to_string_pretty(&Value::Object(root)).expect("json");
    text.push('\n');
    text
}

#[test]
#[ignore = "写盘：cargo test -p motion --test gen_preview_presets -- --ignored"]
fn emit_preview_presets_json() {
    let path = target_path();
    std::fs::write(&path, render()).unwrap_or_else(|e| panic!("{path:?}: {e}"));
    eprintln!("wrote {path:?}");
}

#[test]
#[ignore = "对拍 v2 的预览壳生成物 core/runtime/preview/vendor/presets.json：v3 没有这份文件，待预览 WASM 批次决定去留"]
fn preview_presets_json_is_up_to_date() {
    let path = target_path();
    let on_disk = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("{path:?}: {e} (run --ignored emit_preview_presets_json first)"));
    assert_eq!(
        on_disk,
        render(),
        "vendor/presets.json is out of sync with core/presets/builtin/motion; \
         run `cargo test -p motion --test gen_preview_presets -- --ignored`"
    );
}

/// The preview expander only accepts `tracks` / `compose`; for an `ops` body it gives an explicit hint instead of rendering wrongly.
/// This test guarantees that which recipes are available in the preview is **enumerable**, rather than left to chance.
#[test]
#[ignore = "读 v2 的预览壳生成物 core/runtime/preview/vendor/presets.json：v3 没有这份文件，待预览 WASM 批次决定去留"]
fn the_generated_registry_declares_which_recipes_the_preview_can_expand() {
    let text = std::fs::read_to_string(target_path()).expect("presets.json");
    let registry: Value = serde_json::from_str(&text).expect("json");
    let presets = registry["presets"].as_object().expect("presets");
    let mut ops_bodied: Vec<&str> = presets
        .iter()
        .filter(|(_, doc)| doc.get("ops").is_some())
        .map(|(id, _)| id.as_str())
        .collect();
    ops_bodied.sort_unstable();
    assert_eq!(
        ops_bodied,
        vec!["motion.drift", "motion.seededJitter", "motion.shake"],
        "ops body recipe list changed: sync the hints and author docs in preview/core.js"
    );
    for (_, doc) in presets {
        assert!(
            doc.get("tracks").is_some() || doc.get("compose").is_some() || doc.get("ops").is_some(),
            "{doc:?} has no expandable body"
        );
    }
}
