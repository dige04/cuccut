//! Convenience access extensions for serde_json::Value (corresponding to the JSON enum helper methods in the Swift prototype).

use serde_json::{Map, Value};

pub trait JsonExt {
    fn str_(&self) -> Option<&str>;
    fn f64_(&self) -> Option<f64>;
    fn arr_(&self) -> Option<&Vec<Value>>;
    fn obj_(&self) -> Option<&Map<String, Value>>;
    fn get_(&self, key: &str) -> Option<&Value>;
    /// String at obj[key]
    fn gstr(&self, key: &str) -> Option<&str>;
    /// Number at obj[key]
    fn gf64(&self, key: &str) -> Option<f64>;
}

impl JsonExt for Value {
    fn str_(&self) -> Option<&str> {
        self.as_str()
    }
    fn f64_(&self) -> Option<f64> {
        self.as_f64()
    }
    fn arr_(&self) -> Option<&Vec<Value>> {
        self.as_array()
    }
    fn obj_(&self) -> Option<&Map<String, Value>> {
        self.as_object()
    }
    fn get_(&self, key: &str) -> Option<&Value> {
        self.as_object().and_then(|o| o.get(key))
    }
    fn gstr(&self, key: &str) -> Option<&str> {
        self.get_(key).and_then(|v| v.as_str())
    }
    fn gf64(&self, key: &str) -> Option<f64> {
        self.get_(key).and_then(|v| v.as_f64())
    }
}

pub fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    v.max(lo).min(hi)
}
