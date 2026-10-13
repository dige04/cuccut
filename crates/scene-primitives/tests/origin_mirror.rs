//! **Rust ↔ preview-shell mirror cross-check** of the authoring origin reverse-lookup table (BCF direct-edit write-back plan §4.3-3).
//!
//! Where `expand_node` mints derived ids is also where the reverse-lookup table is registered, and `preview/resolve.js` mirrors the same rules bit for bit. Once the two sides drift, a node picked on the stage folds back to the wrong authored node. That is exactly the step where the W2 byte surgery must not go wrong, so here a real `node` runs the JS implementation for the cross-check.
//!
//! Environments without `node` (the pure-Rust CI mirror) skip this directly. This is a guard for mirror discipline, not a guard for core semantics; the core-side semantics are watched by `resolve`'s own unit tests.

use std::path::PathBuf;
use std::process::Command;

use scene_primitives::resolve::{Resolver, edit_origins};
use serde_json::{Value, json};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("repo root")
}

/// Component + `each` + anonymous sibling: all three path-segment forms covered at once.
fn doc() -> Value {
    json!({
        "meta": {"id": "mirror", "width": 1920, "height": 1080, "fps": 30},
        "scenes": [{"id": "s", "dur": 3, "desc": "对拍"}],
        "components": {
            "Card": {
                "props": {"label": {"type": "string"}},
                "root": {"type": "box", "id": "card", "children": [
                    {"type": "text", "id": "label", "text": "$props.label"},
                    {"type": "box"}
                ]}
            }
        },
        "tracks": [{"id": "main", "kind": "visual", "clips": [{
            "id": "shot", "start": "@s", "end": "@s.end",
            "element": {"type": "box", "id": "stage", "children": [
                {"type": "text", "id": "title", "text": "标题"},
                {"type": "box"},
                {"type": "box"},
                {"type": "use", "id": "cards", "component": "Card",
                 "each": [{"label": "甲"}, {"label": "乙"}]}
            ]}
        }]}]
    })
}

fn rust_origins(doc: &Value) -> Value {
    let resolver = Resolver::new(doc.clone(), None).expect("resolver");
    let element = &doc["tracks"][0]["clips"][0]["element"];
    let tree = resolver
        .expand_node(element, &resolver.ctx.clone())
        .expect("expand");
    Value::Array(edit_origins(&tree).iter().map(|e| e.to_json()).collect())
}

/// Runs the preview shell's `resolveAll` + `editOrigins` with `node`. `None` = no node in the environment.
fn js_origins(doc: &Value) -> Option<Value> {
    let preview = repo_root().join("core/runtime/preview/resolve.js");
    let module = preview.to_string_lossy().replace('\\', "\\\\");
    let script = format!(
        r#"import {{ resolveAll, editOrigins }} from "file://{module}";
const doc = JSON.parse(process.argv[1]);
const ir = resolveAll(doc);
process.stdout.write(JSON.stringify(editOrigins(ir.visualClips[0].tree)));
"#
    );
    let output = Command::new("node")
        .args(["--input-type=module", "--eval", &script, "--"])
        .arg(doc.to_string())
        .output()
        .ok()?;
    assert!(
        output.status.success(),
        "preview shell resolve.js failed to run: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    Some(serde_json::from_slice(&output.stdout).expect("editOrigins output is not JSON"))
}

#[test]
#[ignore = "cross-checks the v2 preview shell core/runtime/preview/resolve.js with node: v3 does not port this preview shell (BCF is not in v3)"]
fn the_preview_shell_mirrors_the_rust_origin_table() {
    let doc = doc();
    let rust = rust_origins(&doc);

    // First, self-check that the Rust side is itself correct: nodes expanded from a component must carry component / site / index, and nodes written directly in the clip must carry only authored.
    let row = |resolved: &str| {
        rust.as_array()
            .unwrap()
            .iter()
            .find(|e| e["resolved"] == resolved)
            .unwrap_or_else(|| panic!("no reverse-lookup entry for {resolved}: {rust:#}"))
            .clone()
    };
    assert_eq!(row("title")["origin"], json!({"authored": "title"}));
    // Anonymous siblings degrade to index segments
    assert_eq!(row("#1")["origin"], json!({"authored": "#1"}));
    // The use node itself is still an authored node (its props / each can be edited)
    assert_eq!(row("cards")["origin"], json!({"authored": "cards"}));
    // Per-instance wrapper: the id is the compiler-minted `cards-0`, and the origin points back to the instantiation site
    assert_eq!(
        row("cards/cards-0")["origin"],
        json!({"authored": "cards", "component": "Card", "site": "cards", "index": 0})
    );
    // Nodes inside a component: authored is counted from the **component root**
    assert_eq!(
        row("cards/cards-1/card/label")["origin"],
        json!({"authored": "label", "component": "Card", "site": "cards", "index": 1})
    );

    let Some(js) = js_origins(&doc) else {
        eprintln!("skipping mirror comparison: node is not available in this environment");
        return;
    };
    assert_eq!(js, rust, "preview shell resolve.js and ccut-core reverse lookup table have drifted");
}
