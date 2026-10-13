//! Built-in effect registry. Same discipline as the preset registry (design §5.4 / §6.3): the
//! `core/presets/builtin/{filter,composite}/*.json` files are embedded via `include_str!` and parsed once into `'static`
//! structures by `OnceLock`. Adding an effect means adding one line.
//!
//! Consistency between the directory and the manifests is kept by `tests/effects.rs` (dev-only, may read the filesystem).
//! **Every strict manifest's `kernel` has a CPU reference implementation**, kept by the registry tests in
//! `ccut-render::effects`. Together the two are the promise of ADR-M05.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use super::manifest::{EffectDomain, EffectManifest, parse_manifest};
use crate::MotionError;
use crate::fingerprint::fnv1a64;

macro_rules! builtin_effect {
    ($ns:literal, $file:literal) => {
        (
            $ns,
            $file,
            include_str!(concat!("../../presets/builtin/", $ns, "/", $file, ".json")),
        )
    };
}

/// Adding an effect means adding one line.
static EFFECT_SOURCES: &[(&str, &str, &str)] = &[
    builtin_effect!("filter", "filter.blur"),
    builtin_effect!("filter", "filter.brightness"),
    builtin_effect!("filter", "filter.contrast"),
    builtin_effect!("filter", "filter.saturation"),
    builtin_effect!("filter", "filter.grayscale"),
    builtin_effect!("filter", "filter.sepia"),
    builtin_effect!("filter", "filter.hueRotate"),
    builtin_effect!("filter", "filter.colorAdjust"),
    builtin_effect!("filter", "filter.invert"),
    builtin_effect!("filter", "filter.sharpen"),
    builtin_effect!("filter", "filter.rgbSplit"),
    builtin_effect!("filter", "filter.directionalBlur"),
    builtin_effect!("filter", "filter.outline"),
    builtin_effect!("filter", "filter.noise"),
    builtin_effect!("filter", "filter.vignette"),
    builtin_effect!("filter", "filter.dropShadow"),
    builtin_effect!("filter", "filter.chromaKey"),
    builtin_effect!("filter", "filter.alphaThreshold"),
    builtin_effect!("filter", "filter.bloom"),
    builtin_effect!("filter", "filter.grade"),
    builtin_effect!("filter", "filter.radialBlur"),
    builtin_effect!("filter", "filter.godRays"),
    builtin_effect!("filter", "mask.shape"),
    builtin_effect!("filter", "mask.progress"),
    builtin_effect!("filter", "mask.image"),
    builtin_effect!("filter", "mask.luma"),
    builtin_effect!("composite", "blend"),
    // Surface Transition (stage 5, spec §9). It sits in a separate registry from the `bcf.*.json` files in the same directory:
    // the former are **two-picture effects**, the latter are dual-channel property recipes; the vocabulary is shared.
    builtin_effect!("transition", "transition.crossfade"),
    builtin_effect!("transition", "transition.slide"),
    builtin_effect!("transition", "transition.wipe"),
    builtin_effect!("transition", "transition.circleCrop"),
    builtin_effect!("transition", "transition.inkBlot"),
    builtin_effect!("transition", "transition.shatter"),
    builtin_effect!("transition", "transition.glitch"),
];

pub struct EffectRegistry {
    /// `(id, version) → manifest`, sorted by id and then by version.
    by_id: BTreeMap<(String, u32), EffectManifest>,
}

impl EffectRegistry {
    pub fn get(&self, id: &str, version: u32) -> Option<&EffectManifest> {
        self.by_id.get(&(id.to_owned(), version))
    }

    /// Given only an id, returns the **highest** registered version. Used for diagnostics, not for evaluation: evaluation always
    /// requires an explicit version (`preset-version-unknown` must not upgrade silently).
    pub fn latest(&self, id: &str) -> Option<&EffectManifest> {
        self.by_id
            .iter()
            .filter(|((key, _), _)| key == id)
            .next_back()
            .map(|(_, manifest)| manifest)
    }

    pub fn iter(&self) -> impl Iterator<Item = &EffectManifest> {
        self.by_id.values()
    }

    pub fn len(&self) -> usize {
        self.by_id.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_id.is_empty()
    }

    pub fn ids(&self) -> Vec<String> {
        self.by_id.keys().map(|(id, _)| id.clone()).collect()
    }

    pub fn in_domain(&self, domain: EffectDomain) -> Vec<&EffectManifest> {
        self.by_id
            .values()
            .filter(|manifest| manifest.domain == domain)
            .collect()
    }
}

static REGISTRY: OnceLock<Result<EffectRegistry, String>> = OnceLock::new();

fn build() -> Result<EffectRegistry, String> {
    let mut by_id = BTreeMap::new();
    for (_, file, source) in EFFECT_SOURCES {
        let manifest = parse_manifest(source, fnv1a64(source.as_bytes()))
            .map_err(|error| error.to_string())?;
        // The file name must equal the id: a rename turns it red, with no extra index needed.
        if manifest.id != *file && !(*file == "blend" && manifest.id == "composite.blend") {
            return Err(format!(
                "manifest-invalid: {file}.json 声明的 id 是 {}",
                manifest.id
            ));
        }
        let key = (manifest.id.clone(), manifest.version);
        if by_id.insert(key, manifest).is_some() {
            return Err(format!("manifest-invalid: {file} 重复注册"));
        }
    }
    Ok(EffectRegistry { by_id })
}

/// Built-in effect registry (parsed once per process).
pub fn builtin_registry() -> &'static EffectRegistry {
    match REGISTRY.get_or_init(build) {
        Ok(registry) => registry,
        Err(error) => panic!("内置 effect manifest 非法：{error}"),
    }
}

/// Parse-time self-check: for dev tests in the style of `validate_all`; does not panic.
pub fn validate_all_effects() -> Result<(), MotionError> {
    REGISTRY
        .get_or_init(build)
        .as_ref()
        .map(|_| ())
        .map_err(|error| MotionError::ManifestInvalid(error.clone()))
}

/// File names registered under a directory (without `.json`). Used by the directory consistency test.
pub fn registered_effect_files(namespace: &str) -> Vec<&'static str> {
    EFFECT_SOURCES
        .iter()
        .filter(|(ns, _, _)| *ns == namespace)
        .map(|(_, file, _)| *file)
        .collect()
}

/// Looks up an `(id, version)`, distinguishing “no such effect” from “no such version”.
pub fn lookup(id: &str, version: u32) -> Result<&'static EffectManifest, MotionError> {
    let registry = builtin_registry();
    if let Some(manifest) = registry.get(id, version) {
        return Ok(manifest);
    }
    if registry.latest(id).is_some() {
        return Err(MotionError::PresetVersionUnknown(format!("{id}@{version}")));
    }
    Err(MotionError::PresetUnknown(id.to_owned()))
}
