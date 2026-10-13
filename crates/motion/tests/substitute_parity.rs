//! The `"{param}"` substitution must be bit-for-bit identical to `ccut-core::resolve::resolve_ref`.
//!
//! The two paths coexisting is intentional: project-level presets go through `resolve_ref` (which also needs to recognize `$vars/$theme`), while built-in manifests go through `preset_registry::substitute` (because `ccut-motion` cannot depend on `ccut-core`).
//! The same template must give the same result; otherwise the claim that “built-in and project-level have no format difference” (spec §7.4) would be false.

use motion::preset_registry::substitute::{deep_substitute, substitute};
use scene_primitives::resolve::{Ctx, resolve_ref};
use serde_json::{Map, Value, json};

fn params() -> Map<String, Value> {
    let mut map = Map::new();
    map.insert("distance".into(), json!(0.045));
    map.insert("count".into(), json!(24));
    map.insert("big".into(), json!(1.0e16));
    map.insert("neg".into(), json!(-3));
    map.insert("zero".into(), json!(0));
    map.insert("direction".into(), json!("up"));
    map.insert("fade".into(), json!(true));
    map.insert("nothing".into(), Value::Null);
    map.insert("list".into(), json!([1, 2]));
    map
}

fn ctx(params: &Map<String, Value>) -> Ctx {
    Ctx {
        vars: Map::new(),
        theme: Value::Null,
        assets: Value::Null,
        props: Some(params.clone()),
        extra_delay: 0.0,
    }
}

const TEMPLATES: &[&str] = &[
    "{distance}",
    "{count}",
    "{big}",
    "{neg}",
    "{zero}",
    "{direction}",
    "{fade}",
    "{nothing}",
    "{list}",
    "{missing}",
    "",
    "plain",
    "共 {count} 人",
    "{count}/{count}",
    "d={distance} dir={direction}",
    "f={fade} n={nothing} l={list}",
    "{ not a name }",
    "{count",
    "count}",
    "{}",
    "{a-b}",
    "prefix{missing}suffix",
];

#[test]
fn every_template_matches_resolve_ref_bit_for_bit() {
    let params = params();
    let ctx = ctx(&params);
    for raw in TEMPLATES {
        let ours = substitute(&json!(raw), &params);
        let theirs = resolve_ref(&json!(raw), &ctx);
        assert_eq!(
            serde_json::to_string(&ours).unwrap(),
            serde_json::to_string(&theirs).unwrap(),
            "template {raw:?}"
        );
    }
}

#[test]
fn deep_substitute_matches_deep_resolve() {
    let params = params();
    let ctx = ctx(&params);
    let doc = json!({
        "v": "{distance}",
        "nested": {"t": "0%", "v": {"value": "{distance}", "basis": "canvasShortEdge"}},
        "list": ["{direction}", 1, "共 {count} 人", null],
    });
    assert_eq!(
        serde_json::to_string(&deep_substitute(&doc, &params)).unwrap(),
        serde_json::to_string(&scene_primitives::resolve::deep_resolve(&doc, &ctx)).unwrap()
    );
}

#[test]
fn non_strings_pass_through_untouched() {
    let params = params();
    for value in [json!(1), json!(null), json!(true), json!([1, 2])] {
        assert_eq!(substitute(&value, &params), value);
    }
}
