//! Effect manifest (design §6.3): an effect is a **data recipe**, not a code branch.
//!
//! What a manifest must declare (spec §14.5): uniform type / default / range, input count, texture coordinate origin,
//! color contract (`colorSpace` + `precision`), premultiplied alpha, sampling and edge rules, `resizeMode`, `determinism`,
//! `capabilities`, `fallback`, `version`, and the **named kernel** `kernel`. The CPU reference implementation is registered
//! under this name, and an unknown kernel name is rejected at parse time (the same discipline as the preset registry).
//!
//! The key set is closed: one extra key is `manifest-invalid`. A mistyped field is never silently ignored.

use std::collections::BTreeMap;

use serde_json::{Map, Value};

use super::{
    BlendMode, ColorContract, ColorSpace, Determinism, EffectRef, Precision, UniformValue,
};
use crate::MotionError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum EffectDomain {
    /// Single-input pixel filter.
    Filter,
    /// Mask: multiplies alpha by a coverage computed from geometry or an image.
    Mask,
    /// Composite (blend table).
    Composite,
    /// Two-picture transition: two input surfaces + `progress ∈ [0, 1]` closed interval (spec §9).
    Transition,
}

impl EffectDomain {
    pub fn as_str(self) -> &'static str {
        match self {
            EffectDomain::Filter => "filter",
            EffectDomain::Mask => "mask",
            EffectDomain::Composite => "composite",
            EffectDomain::Transition => "transition",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "filter" => Some(EffectDomain::Filter),
            "mask" => Some(EffectDomain::Mask),
            "composite" => Some(EffectDomain::Composite),
            "transition" => Some(EffectDomain::Transition),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParamKind {
    Number,
    /// Relative length: measured against `basis`, then rounded by `quantize` after evaluation.
    Length,
    Bool,
    Enum,
    /// Non-premultiplied RGBA 0..1.
    Color,
    Vec2,
    Text,
}

impl ParamKind {
    fn parse(text: &str) -> Option<Self> {
        match text {
            "number" => Some(ParamKind::Number),
            "length" => Some(ParamKind::Length),
            "bool" => Some(ParamKind::Bool),
            "enum" => Some(ParamKind::Enum),
            "color" => Some(ParamKind::Color),
            "vec2" => Some(ParamKind::Vec2),
            "text" => Some(ParamKind::Text),
            _ => None,
        }
    }

    fn accepts(self, value: &UniformValue) -> bool {
        matches!(
            (self, value),
            (
                ParamKind::Number | ParamKind::Length,
                UniformValue::Scalar(_) | UniformValue::Int(_)
            ) | (ParamKind::Bool, UniformValue::Bool(_))
                | (ParamKind::Enum | ParamKind::Text, UniformValue::Text(_))
                | (ParamKind::Color, UniformValue::Color(_))
                | (ParamKind::Vec2, UniformValue::Vec2(_))
        )
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParamSpec {
    pub kind: ParamKind,
    /// Default value. `None` = required (a caller that does not supply it gets `preset-param-missing`).
    pub default: Option<UniformValue>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    /// Closed set of values for `enum`.
    pub options: Vec<String>,
    /// Base names for `length` (`canvasShortEdge` / `inputShortEdge` / `px`).
    pub basis: Option<String>,
    /// Rounding rule applied after evaluation (`round-to-int` / `none`).
    pub quantize: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EffectManifest {
    pub id: String,
    pub version: u32,
    pub domain: EffectDomain,
    pub inputs: u8,
    pub params: BTreeMap<String, ParamSpec>,
    pub color: ColorContract,
    /// Named CPU kernel. `ccut-render::effects` registers implementations under this name.
    pub kernel: String,
    /// Texture coordinate origin. The current closed set has only `top-left`.
    pub origin: String,
    /// Alpha convention. The current closed set has only `premultiplied`.
    pub alpha: String,
    pub sampling: String,
    pub edge: String,
    pub resize_mode: String,
    pub determinism: Determinism,
    pub capabilities: Vec<String>,
    pub fallback: Option<EffectRef>,
    pub doc: Option<String>,
    /// Fingerprint of the manifest source text (used for `pkg_hash` in the FramePlan fingerprint).
    pub source_hash: u64,
}

impl EffectManifest {
    pub fn effect_ref(&self) -> EffectRef {
        EffectRef {
            id: self.id.clone(),
            version: self.version,
            pkg_hash: None,
        }
    }

    pub fn qualified(&self) -> String {
        format!("{}@{}", self.id, self.version)
    }

    /// The list of available parameter names that follows the “no parameter X” error. Authors have no other offline way to look
    /// up an effect's parameter table, so the list goes in the error itself. An effect without parameters says “it takes no parameters”.
    pub fn params_hint(&self) -> String {
        if self.params.is_empty() {
            return "it takes no parameters".to_owned();
        }
        let names = self.params.keys().map(String::as_str).collect::<Vec<_>>();
        format!("available parameters: {}", names.join(" / "))
    }

    /// Validates and fills in uniforms: unknown parameter → `preset-param-unknown`; missing required parameter →
    /// `preset-param-missing`; wrong type / out of range → `preset-param-invalid`.
    pub fn resolve_uniforms(
        &self,
        given: &super::UniformMap,
    ) -> Result<super::UniformMap, MotionError> {
        for (key, _) in given.iter() {
            if !self.params.contains_key(key) {
                return Err(MotionError::PresetParamUnknown(format!(
                    "{} has no parameter {key}; {}",
                    self.qualified(),
                    self.params_hint()
                )));
            }
        }
        let mut out = super::UniformMap::new();
        for (key, spec) in &self.params {
            let value = match given.get(key) {
                Some(value) => value.clone(),
                None => match &spec.default {
                    Some(value) => value.clone(),
                    None => {
                        return Err(MotionError::PresetParamMissing(format!(
                            "{} is missing required parameter {key}",
                            self.qualified()
                        )));
                    }
                },
            };
            if !spec.kind.accepts(&value) {
                return Err(MotionError::ManifestInvalid(format!(
                    "{} {key} has the wrong type (expected {:?})",
                    self.qualified(),
                    spec.kind
                )));
            }
            if let (ParamKind::Enum, Some(text)) = (spec.kind, value.as_str())
                && !spec.options.iter().any(|option| option == text)
            {
                return Err(MotionError::ManifestInvalid(format!(
                    "{} {key} value {text} is not in the closed set {:?}",
                    self.qualified(),
                    spec.options
                )));
            }
            let value = match (spec.min, spec.max, value.as_f64()) {
                (min, max, Some(number))
                    if matches!(spec.kind, ParamKind::Number | ParamKind::Length) =>
                {
                    let clamped = number
                        .max(min.unwrap_or(f64::NEG_INFINITY))
                        .min(max.unwrap_or(f64::INFINITY));
                    UniformValue::Scalar(clamped)
                }
                _ => value,
            };
            out.insert(key.clone(), value);
        }
        Ok(out)
    }
}

// ── Parsing ────────────────────────────────────────────────────────────

const MANIFEST_KEYS: &[&str] = &[
    "id",
    "version",
    "domain",
    "inputs",
    "params",
    "color",
    "kernel",
    "origin",
    "alpha",
    "sampling",
    "edge",
    "resizeMode",
    "determinism",
    "capabilities",
    "fallback",
    "doc",
    "blendModes",
];

const PARAM_KEYS: &[&str] = &[
    "type", "default", "min", "max", "options", "basis", "quantize", "doc",
];

/// Closed values for `origin` / `alpha` / `sampling` / `edge` / `resizeMode`.
const ORIGINS: &[&str] = &["top-left"];
const ALPHAS: &[&str] = &["premultiplied", "straight"];
const SAMPLINGS: &[&str] = &["nearest", "linear"];
const EDGES: &[&str] = &["clamp", "clamp-shrink-window", "transparent"];
const RESIZE_MODES: &[&str] = &["same-as-input", "canvas"];

fn invalid(message: impl Into<String>) -> MotionError {
    MotionError::ManifestInvalid(message.into())
}

fn closed_keys(
    object: &Map<String, Value>,
    allowed: &[&str],
    what: &str,
) -> Result<(), MotionError> {
    for key in object.keys() {
        if !allowed.contains(&key.as_str()) {
            return Err(invalid(format!("{what} has unknown key {key}")));
        }
    }
    Ok(())
}

fn closed_value<'a>(
    object: &'a Map<String, Value>,
    key: &str,
    allowed: &[&str],
    id: &str,
) -> Result<&'a str, MotionError> {
    let text = object
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| invalid(format!("{id} is missing string {key}")))?;
    if !allowed.contains(&text) {
        return Err(invalid(format!(
            "{id} {key} = {text} is not in the closed set {allowed:?}"
        )));
    }
    Ok(text)
}

fn uniform_from_json(
    kind: ParamKind,
    value: &Value,
    what: &str,
) -> Result<UniformValue, MotionError> {
    let bad = || invalid(format!("{what} default value does not match its type"));
    Ok(match kind {
        ParamKind::Number | ParamKind::Length => {
            UniformValue::Scalar(value.as_f64().ok_or_else(bad)?)
        }
        ParamKind::Bool => UniformValue::Bool(value.as_bool().ok_or_else(bad)?),
        ParamKind::Enum | ParamKind::Text => {
            UniformValue::Text(value.as_str().ok_or_else(bad)?.to_owned())
        }
        ParamKind::Color => {
            let array = value.as_array().ok_or_else(bad)?;
            if array.len() != 4 {
                return Err(bad());
            }
            let mut rgba = [0.0f64; 4];
            for (slot, item) in rgba.iter_mut().zip(array) {
                *slot = item.as_f64().ok_or_else(bad)?;
            }
            UniformValue::Color(rgba)
        }
        ParamKind::Vec2 => {
            let array = value.as_array().ok_or_else(bad)?;
            if array.len() != 2 {
                return Err(bad());
            }
            UniformValue::Vec2([
                array[0].as_f64().ok_or_else(bad)?,
                array[1].as_f64().ok_or_else(bad)?,
            ])
        }
    })
}

/// Parses one manifest source text. The caller computes `source_hash` over the original text.
pub fn parse_manifest(source: &str, source_hash: u64) -> Result<EffectManifest, MotionError> {
    let value: Value =
        serde_json::from_str(source).map_err(|error| invalid(format!("JSON parse failed: {error}")))?;
    let object = value.as_object().ok_or_else(|| invalid("top level must be an object"))?;
    closed_keys(object, MANIFEST_KEYS, "effect manifest")?;

    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("missing id"))?
        .to_owned();
    let version = object
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| invalid(format!("{id} is missing version")))? as u32;
    if version == 0 {
        return Err(invalid(format!("{id} version must be ≥ 1")));
    }
    let domain_text = object
        .get("domain")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid(format!("{id} 缺 domain")))?;
    let domain = EffectDomain::parse(domain_text)
        .ok_or_else(|| invalid(format!("{id} 的 domain {domain_text} 未知")))?;
    let inputs = object
        .get("inputs")
        .and_then(Value::as_u64)
        .ok_or_else(|| invalid(format!("{id} 缺 inputs")))? as u8;

    let mut params = BTreeMap::new();
    if let Some(raw) = object.get("params") {
        let raw = raw
            .as_object()
            .ok_or_else(|| invalid(format!("{id} 的 params 必须是对象")))?;
        for (key, spec) in raw {
            let spec = spec
                .as_object()
                .ok_or_else(|| invalid(format!("{id}.{key} 的参数定义必须是对象")))?;
            closed_keys(spec, PARAM_KEYS, &format!("{id}.{key}"))?;
            let kind_text = spec
                .get("type")
                .and_then(Value::as_str)
                .ok_or_else(|| invalid(format!("{id}.{key} 缺 type")))?;
            let kind = ParamKind::parse(kind_text)
                .ok_or_else(|| invalid(format!("{id}.{key} 的 type {kind_text} 未知")))?;
            let default = match spec.get("default") {
                Some(Value::Null) | None => None,
                Some(value) => Some(uniform_from_json(kind, value, &format!("{id}.{key}"))?),
            };
            let options: Vec<String> = spec
                .get("options")
                .and_then(Value::as_array)
                .map(|array| {
                    array
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_owned)
                        .collect()
                })
                .unwrap_or_default();
            if kind == ParamKind::Enum && options.is_empty() {
                return Err(invalid(format!("{id}.{key} 是 enum 但没有 options")));
            }
            params.insert(
                key.clone(),
                ParamSpec {
                    kind,
                    default,
                    min: spec.get("min").and_then(Value::as_f64),
                    max: spec.get("max").and_then(Value::as_f64),
                    options,
                    basis: spec.get("basis").and_then(Value::as_str).map(str::to_owned),
                    quantize: spec
                        .get("quantize")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                },
            );
        }
    }

    let color_object = object
        .get("color")
        .and_then(Value::as_object)
        .ok_or_else(|| invalid(format!("{id} 缺 color")))?;
    closed_keys(
        color_object,
        &["colorSpace", "precision"],
        &format!("{id}.color"),
    )?;
    let space_text = color_object
        .get("colorSpace")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid(format!("{id} 缺 color.colorSpace")))?;
    let precision_text = color_object
        .get("precision")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid(format!("{id} 缺 color.precision")))?;
    let color = ColorContract {
        space: ColorSpace::parse(space_text)
            .ok_or_else(|| invalid(format!("{id} 的 colorSpace {space_text} 未知")))?,
        precision: Precision::parse(precision_text)
            .ok_or_else(|| invalid(format!("{id} 的 precision {precision_text} 未知")))?,
    };

    let kernel = object
        .get("kernel")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid(format!("{id} 缺 kernel")))?
        .to_owned();
    if kernel.is_empty() {
        return Err(invalid(format!("{id} 的 kernel 不能为空")));
    }
    let origin = closed_value(object, "origin", ORIGINS, &id)?.to_owned();
    let alpha = closed_value(object, "alpha", ALPHAS, &id)?.to_owned();
    let sampling = closed_value(object, "sampling", SAMPLINGS, &id)?.to_owned();
    let edge = closed_value(object, "edge", EDGES, &id)?.to_owned();
    let resize_mode = closed_value(object, "resizeMode", RESIZE_MODES, &id)?.to_owned();

    let determinism_text = object
        .get("determinism")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid(format!("{id} 缺 determinism")))?;
    let determinism = Determinism::parse(determinism_text)
        .ok_or_else(|| invalid(format!("{id} 的 determinism {determinism_text} 未知")))?;

    let capabilities: Vec<String> = object
        .get("capabilities")
        .and_then(Value::as_array)
        .map(|array| {
            array
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();
    if determinism == Determinism::Strict && !capabilities.is_empty() {
        return Err(invalid(format!(
            "{id} 声明 strict 却要求后端能力 {capabilities:?}"
        )));
    }

    let fallback = match object.get("fallback") {
        None | Some(Value::Null) => None,
        Some(Value::String(text)) => Some(parse_effect_ref(text, &id)?),
        Some(_) => return Err(invalid(format!("{id} 的 fallback 必须是 \"id@version\""))),
    };
    if determinism != Determinism::Strict && fallback.is_none() {
        return Err(invalid(format!(
            "{id} 是 {determinism_text} 等级，必须声明 fallback"
        )));
    }

    // The blend table in the `composite` domain must line up item-for-item with the closed enum `BlendMode`.
    if let Some(list) = object.get("blendModes") {
        let list = list
            .as_array()
            .ok_or_else(|| invalid(format!("{id} 的 blendModes 必须是数组")))?;
        if list.len() != BlendMode::ALL.len() {
            return Err(invalid(format!(
                "{id} 的 blendModes 有 {} 项，BlendMode 有 {}",
                list.len(),
                BlendMode::ALL.len()
            )));
        }
        for (index, item) in list.iter().enumerate() {
            let name = item
                .as_str()
                .ok_or_else(|| invalid(format!("{id} 的 blendModes[{index}] 不是字符串")))?;
            if BlendMode::ALL[index].as_str() != name {
                return Err(invalid(format!(
                    "{id} 的 blendModes[{index}] = {name}，BlendMode 是 {}",
                    BlendMode::ALL[index].as_str()
                )));
            }
        }
    }

    Ok(EffectManifest {
        id,
        version,
        domain,
        inputs,
        params,
        color,
        kernel,
        origin,
        alpha,
        sampling,
        edge,
        resize_mode,
        determinism,
        capabilities,
        fallback,
        doc: object.get("doc").and_then(Value::as_str).map(str::to_owned),
        source_hash,
    })
}

fn parse_effect_ref(text: &str, id: &str) -> Result<EffectRef, MotionError> {
    let (name, version) = text
        .rsplit_once('@')
        .ok_or_else(|| invalid(format!("{id} 的 fallback {text} 缺 @version")))?;
    let version: u32 = version
        .parse()
        .map_err(|_| invalid(format!("{id} 的 fallback {text} 版本非法")))?;
    Ok(EffectRef::new(name, version))
}
