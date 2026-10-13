//! Render fingerprint (spec §15):
//! Content fingerprint = sha256( canonical(document JSON) ‖ canonical(variable set JSON) ),
//! where canonical is a normalized serialization with sorted keys and no extra whitespace.
//! Frame fingerprint (DrawOp fnv1a64) lives in ccut-render::drawop.

use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

/// Key-sorted, compact (no whitespace) canonical JSON serialization.
pub fn canonical_json(v: &Value) -> String {
    let mut out = String::new();
    write_canonical(v, &mut out);
    out
}

fn write_canonical(v: &Value, out: &mut String) {
    match v {
        Value::Object(o) => {
            out.push('{');
            let mut keys: Vec<&String> = o.keys().collect();
            keys.sort();
            for (i, k) in keys.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push_str(&Value::from(k.as_str()).to_string());
                out.push(':');
                write_canonical(&o[*k], out);
            }
            out.push('}');
        }
        Value::Array(a) => {
            out.push('[');
            for (i, x) in a.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_canonical(x, out);
            }
            out.push(']');
        }
        // Scalars use serde_json's deterministic text form (numbers keep the canonical representation they had when parsed)
        _ => out.push_str(&v.to_string()),
    }
}

/// Bare lowercase hex SHA-256 of the text (no `sha256-` prefix).
///
/// Same convention as `ccut_workspace::history::sha_of`: the `base` of `__ccut/put` and the `baseSourceHash` of direct-edit both use this one form, so cross-module comparisons need no conversion.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    lower_hex(&h.finalize())
}

/// Content fingerprint (§15): "sha256-<64hex>". A missing variable override is treated as an empty object.
pub fn content_fingerprint(doc: &Value, overrides: Option<&Map<String, Value>>) -> String {
    let vars = match overrides {
        Some(o) => Value::Object(o.clone()),
        None => Value::Object(Map::new()),
    };
    let mut h = Sha256::new();
    h.update(canonical_json(doc).as_bytes());
    h.update(canonical_json(&vars).as_bytes());
    format!("sha256-{}", lower_hex(&h.finalize()))
}

/// Lowercase hex of the digest, identical character-for-character to v2 (sha2 0.10)'s `{:x}`; the sha2 0.11 output type no longer implements `LowerHex`.
fn lower_hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonical_sorts_keys_and_strips_whitespace() {
        let v = json!({ "b": [1, 2.5, null], "a": { "z": "文", "y": true } });
        assert_eq!(
            canonical_json(&v),
            r#"{"a":{"y":true,"z":"文"},"b":[1,2.5,null]}"#
        );
    }

    #[test]
    fn fingerprint_is_stable_and_var_sensitive() {
        let a = json!({ "meta": { "id": "x" }, "scenes": [] });
        let b = json!({ "scenes": [], "meta": { "id": "x" } }); // Key order does not matter.
        assert_eq!(content_fingerprint(&a, None), content_fingerprint(&b, None));
        let mut vars = Map::new();
        vars.insert("name".into(), json!("客户A"));
        assert_ne!(
            content_fingerprint(&a, None),
            content_fingerprint(&a, Some(&vars))
        );
        assert!(content_fingerprint(&a, None).starts_with("sha256-"));
        assert_eq!(content_fingerprint(&a, None).len(), 7 + 64);
    }
}
