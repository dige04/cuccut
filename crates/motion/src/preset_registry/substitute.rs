//! `"{param}"` substitution (spec §7.4: **substitute only, no arithmetic**).
//!
//! The semantics here must be **identical, expression for expression,** to the `'{'` branch of `ccut-core/src/resolve.rs::resolve_ref`:
//! project-level presets take that path, built-in manifests take this one, and the same template must give the same result.
//! Consistency is checked on both sides by `ccut-motion/tests/substitute_parity.rs`.
//!
//! The only difference from `resolve_ref`: this does not recognize `$vars/$theme/$assets` references, because a manifest is data inside the repository and there is no document context to look them up in.

use serde_json::{Map, Value};

/// Substitutes a single value. Non-string values are returned unchanged.
pub fn substitute(v: &Value, params: &Map<String, Value>) -> Value {
    let Some(s) = v.as_str() else {
        return v.clone();
    };
    if !s.contains('{') {
        return v.clone();
    }
    // Whole string is "{name}" and name is all [A-Za-z0-9_] → return the parameter's original value (type preserved)
    if let Some(inner) = s.strip_prefix('{').and_then(|t| t.strip_suffix('}')) {
        if !inner.is_empty() && inner.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            if let Some(pv) = params.get(inner) {
                return pv.clone();
            }
        }
    }
    // String template: "共 {value} 人"
    let mut out = s.to_string();
    for (k, pv) in params {
        let needle = format!("{{{k}}}");
        if !out.contains(&needle) {
            continue;
        }
        let rep = match pv {
            Value::String(ps) => ps.clone(),
            Value::Number(n) => {
                let f = n.as_f64().unwrap_or(0.0);
                if f == f.round() && f.abs() < 1e15 {
                    format!("{}", f as i64)
                } else {
                    format!("{f}")
                }
            }
            _ => String::new(),
        };
        out = out.replace(&needle, &rep);
    }
    Value::from(out)
}

/// Recursive substitution (arrays / objects key by key), mirroring `deep_resolve`.
pub fn deep_substitute(v: &Value, params: &Map<String, Value>) -> Value {
    match v {
        Value::String(_) => substitute(v, params),
        Value::Array(a) => Value::Array(a.iter().map(|x| deep_substitute(x, params)).collect()),
        Value::Object(o) => Value::Object(
            o.iter()
                .map(|(k, x)| (k.clone(), deep_substitute(x, params)))
                .collect(),
        ),
        _ => v.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn params() -> Map<String, Value> {
        let mut map = Map::new();
        map.insert("distance".into(), json!(0.045));
        map.insert("count".into(), json!(24));
        map.insert("direction".into(), json!("up"));
        map.insert("fade".into(), json!(true));
        map
    }

    #[test]
    fn whole_string_placeholder_keeps_the_type() {
        assert_eq!(substitute(&json!("{distance}"), &params()), json!(0.045));
        assert_eq!(substitute(&json!("{fade}"), &params()), json!(true));
    }

    #[test]
    fn templates_print_integers_without_a_decimal_point() {
        assert_eq!(
            substitute(&json!("共 {count} 个"), &params()),
            json!("共 24 个")
        );
        assert_eq!(
            substitute(&json!("d={distance}"), &params()),
            json!("d=0.045")
        );
    }

    #[test]
    fn unknown_names_are_left_alone() {
        assert_eq!(substitute(&json!("{nope}"), &params()), json!("{nope}"));
        assert_eq!(substitute(&json!("plain"), &params()), json!("plain"));
        assert_eq!(substitute(&json!(3), &params()), json!(3));
    }

    #[test]
    fn deep_substitute_walks_objects_and_arrays() {
        let out = deep_substitute(
            &json!({"v": "{distance}", "list": ["{direction}", 1]}),
            &params(),
        );
        assert_eq!(out, json!({"v": 0.045, "list": ["up", 1]}));
    }
}
