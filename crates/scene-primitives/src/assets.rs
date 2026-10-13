//! Explicit asset lifecycle (spec §11.2, pattern drawn from opencat core's HostRequirements/HostInputs):
//!   doc → host_requirements() (AssetId + kind + logical src + optional hash)
//!   → host-side fetch/probe (core does no I/O)
//!   → HostInputs (media metadata) injected into the Resolver → size fixed at resolve time, fail-fast.

use crate::json::JsonExt;
use anyhow::{Result, bail};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetKind {
    Image,
    /// GIF / APNG / animated WebP (spec §6.5.1). Split out from `Image` rather than adding a flag to `Image`: beyond the natural size it also needs a per-frame duration table and a loop declaration, and its element semantics differ (the `animatedImage` element has the media fields of §6.5, while the `image` element does not).
    AnimatedImage,
    /// bodymovin JSON (Lottie, spec §6.5.2). Split out from `AnimatedImage`: it is a **vector** source with no bitmap frames, its natural size comes from the composition header rather than a decoder, and its sub-resources (images) must be collected during preflight and included in the content fingerprint.
    Lottie,
    /// Code-generated picture (spec §6.5.3): a set of TSX/TS modules that the host evaluates frame by frame into SVG, then rasterizes. The natural size, frame rate and frame count are written in the asset entry (there is no probeable container); see [`ProgramReq`].
    Program,
    Video,
    Audio,
    Font,
}

impl AssetKind {
    pub fn parse(s: &str) -> Option<AssetKind> {
        match s {
            "image" => Some(AssetKind::Image),
            "animatedImage" => Some(AssetKind::AnimatedImage),
            "lottie" => Some(AssetKind::Lottie),
            "program" => Some(AssetKind::Program),
            "video" => Some(AssetKind::Video),
            "audio" => Some(AssetKind::Audio),
            "font" => Some(AssetKind::Font),
            _ => None,
        }
    }
}

impl fmt::Display for AssetKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AssetKind::Image => write!(f, "image"),
            AssetKind::AnimatedImage => write!(f, "animatedImage"),
            AssetKind::Lottie => write!(f, "lottie"),
            AssetKind::Program => write!(f, "program"),
            AssetKind::Video => write!(f, "video"),
            AssetKind::Audio => write!(f, "audio"),
            AssetKind::Font => write!(f, "font"),
        }
    }
}

/// A single resource requirement: id is the canonical identifier within the document, src is the logical location (relative to the document directory).
#[derive(Debug, Clone)]
pub struct AssetReq {
    pub id: String,
    pub kind: AssetKind,
    pub src: String,
    /// "sha256-<64hex>"; when provided, the host must verify that the content matches
    pub hash: Option<String>,
    pub bounded_image: bool,
    /// The remaining declarations of a `program` asset (§6.5.3); for other types, always `None`.
    pub program: Option<ProgramReq>,
}

/// Fields of a `program` asset entry other than `src` (§6.5.3). All paths are relative to the document directory.
#[derive(Debug, Clone, PartialEq)]
pub struct ProgramReq {
    /// The export name of the component in the entry module; defaults to `default`.
    pub export: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    /// Source frame count; source duration = `frames / fps`.
    pub frames: u32,
    /// Bare module name → module file (e.g. `"remotion": "compat/remotion.ts"`).
    pub imports: std::collections::BTreeMap<String, String>,
    /// File or directory referenced by the component via `asset()`, loaded into memory in full at load time.
    pub files: Vec<String>,
    /// Props passed to the component (a JSON object).
    pub props: Value,
}

/// Limits for program pictures: maximum size per side in pixels, frame rate, and frame count (one hour at 60 fps).
pub const PROGRAM_MAX_SIDE: u32 = 8192;
pub const PROGRAM_MAX_FPS: f64 = 240.0;
pub const PROGRAM_MAX_FRAMES: u32 = 216_000;

impl ProgramReq {
    /// Asset entry → declaration; when a field is missing or out of range, report the specific field.
    pub fn parse(id: &str, entry: &Value) -> Result<ProgramReq> {
        let side = |key: &str| -> Result<u32> {
            match entry.get_(key).and_then(Value::as_u64) {
                Some(v) if v >= 1 && v <= u64::from(PROGRAM_MAX_SIDE) => Ok(v as u32),
                _ => bail!(
                    "program-invalid: asset \"{id}\" {key} must be an integer in 1..={PROGRAM_MAX_SIDE}"
                ),
            }
        };
        let width = side("width")?;
        let height = side("height")?;
        let fps = match entry.gf64("fps") {
            Some(v) if v > 0.0 && v <= PROGRAM_MAX_FPS => v,
            _ => bail!("program-invalid: asset \"{id}\" fps must be a number in (0, {PROGRAM_MAX_FPS}]"),
        };
        let frames = match entry.get_("frames").and_then(Value::as_u64) {
            Some(v) if v >= 1 && v <= u64::from(PROGRAM_MAX_FRAMES) => v as u32,
            _ => bail!(
                "program-invalid: asset \"{id}\" frames must be an integer in 1..={PROGRAM_MAX_FRAMES}"
            ),
        };
        let export = match entry.get_("export") {
            None => "default".to_string(),
            Some(Value::String(name)) if !name.is_empty() => name.clone(),
            Some(_) => bail!("program-invalid: asset \"{id}\" export must be a non-empty string"),
        };
        let mut imports = std::collections::BTreeMap::new();
        match entry.get_("imports") {
            None => {}
            Some(Value::Object(map)) => {
                for (name, target) in map {
                    let Some(target) = target.as_str().filter(|t| !t.is_empty()) else {
                        bail!("program-invalid: asset \"{id}\" imports.{name} must be a module path");
                    };
                    imports.insert(name.clone(), target.to_string());
                }
            }
            Some(_) => bail!("program-invalid: asset \"{id}\" imports must be an object"),
        }
        let files = match entry.get_("files") {
            None => Vec::new(),
            Some(Value::Array(list)) => list
                .iter()
                .map(|v| {
                    v.as_str()
                        .filter(|s| !s.is_empty())
                        .map(String::from)
                        .ok_or_else(|| {
                            anyhow::anyhow!(
                                "program-invalid: asset \"{id}\" files must be an array of path strings"
                            )
                        })
                })
                .collect::<Result<_>>()?,
            Some(_) => bail!("program-invalid: asset \"{id}\" files must be an array of path strings"),
        };
        let props = match entry.get_("props") {
            None => Value::Object(Map::new()),
            Some(v @ Value::Object(_)) => v.clone(),
            Some(_) => bail!("program-invalid: asset \"{id}\" props must be an object"),
        };
        Ok(ProgramReq {
            export,
            width,
            height,
            fps,
            frames,
            imports,
            files,
            props,
        })
    }

    /// Per-frame start-time millisecond table (N+1 entries): `round(k × 1000 / fps)`, the same formula as the Lottie composition frame table; when the frame rates are equal, composition frame k picks up source frame k exactly.
    pub fn frame_starts_ms(&self) -> Vec<i64> {
        (0..=self.frames)
            .map(|k| (f64::from(k) * 1000.0 / self.fps).round() as i64)
            .collect()
    }
}

/// doc → resource requirement list (sorted by id, deterministic output).
/// Asset variable delegation (the `var` field, §11.2) is resolved against the variable default values; when there are variable overrides, use [`host_requirements_with_vars`].
pub fn host_requirements(doc: &Value) -> Result<Vec<AssetReq>> {
    host_requirements_with_vars(doc, None)
}

/// Same as [`host_requirements`], except that `overrides` in the form {"id": value} override the variable default values (§11.1).
pub fn host_requirements_with_vars(
    doc: &Value,
    overrides: Option<&Map<String, Value>>,
) -> Result<Vec<AssetReq>> {
    let vars = effective_vars(doc, overrides);
    let mut out = Vec::new();
    if let Some(assets) = doc.get_("assets").and_then(Value::as_object) {
        for (id, entry) in assets {
            let entry = materialize_asset_entry(id, entry, &vars)?;
            let Some(ty) = entry.gstr("type") else {
                bail!("asset \"{id}\" is missing type");
            };
            let Some(kind) = AssetKind::parse(ty) else {
                bail!(
                    "asset \"{id}\" has unknown type \"{ty}\" (image|animatedImage|lottie|program|video|audio|font)"
                );
            };
            let Some(src) = entry.gstr("src") else {
                bail!("asset \"{id}\" is missing src");
            };
            let program = match kind {
                AssetKind::Program => Some(ProgramReq::parse(id, &entry)?),
                _ => None,
            };
            let bounded_image = match entry.get_("cache") {
                None => false,
                Some(v) => match v.as_str() {
                    Some("eager") => false,
                    Some("bounded") if kind == AssetKind::Image => true,
                    _ => bail!("asset {id}: cache must be eager, or bounded for image"),
                },
            };
            out.push(AssetReq {
                id: id.clone(),
                kind,
                src: src.to_string(),
                hash: entry.gstr("hash").map(String::from),
                bounded_image,
                program,
            });
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

/// Variable default values + overrides → effective variable table.
pub fn effective_vars(doc: &Value, overrides: Option<&Map<String, Value>>) -> Map<String, Value> {
    let mut vars = Map::new();
    for v in doc
        .get_("variables")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
    {
        if let Some(id) = v.gstr("id") {
            let mut val = v.get_("default").cloned().unwrap_or(Value::Null);
            if let Some(o) = overrides {
                if let Some(ov) = o.get(id) {
                    val = ov.clone();
                }
            }
            vars.insert(id.to_string(), val);
        }
    }
    vars
}

/// Solving the `var` delegation for a single asset (§11.2): `{type, var}` → `{type, src, hash?}`.
/// The variable value must be `{src, hash?}`; the `{media}` form requires a Project container and is currently rejected.
pub fn materialize_asset_entry(
    id: &str,
    entry: &Value,
    vars: &Map<String, Value>,
) -> Result<Value> {
    let Some(var_name) = entry.gstr("var") else {
        return Ok(entry.clone());
    };
    if entry.get_("src").is_some() {
        bail!("asset \"{id}\" src and var are mutually exclusive (pick one, §11.2)");
    }
    let Some(val) = vars.get(var_name) else {
        bail!("asset \"{id}\" delegates to variable \"{var_name}\", which does not exist");
    };
    let Some(obj) = val.as_object() else {
        bail!("asset \"{id}\" variable \"{var_name}\" must be a {{src, hash?}} object");
    };
    if obj.contains_key("media") {
        bail!(
            "asset-media-outside-project: asset \"{id}\" variable value in the {{media}} form requires a Project container"
        );
    }
    let Some(src) = obj.get("src").and_then(Value::as_str) else {
        bail!("asset \"{id}\" variable \"{var_name}\" value is missing src");
    };
    let mut out = Map::new();
    if let Some(t) = entry.get_("type") {
        out.insert("type".into(), t.clone());
    }
    out.insert("src".into(), Value::from(src));
    if let Some(cache) = entry.get_("cache") {
        out.insert("cache".into(), cache.clone());
    }
    if let Some(h) = obj.get("hash") {
        out.insert("hash".into(), h.clone());
    }
    Ok(Value::Object(out))
}

/// Materializes the whole assets table: replaces `var`-delegated entries with the resolved `{type, src, hash?}`.
pub fn materialize_assets(assets: &Value, vars: &Map<String, Value>) -> Result<Value> {
    let Some(entries) = assets.as_object() else {
        return Ok(assets.clone());
    };
    let mut out = Map::new();
    for (id, entry) in entries {
        out.insert(id.clone(), materialize_asset_entry(id, entry, vars)?);
    }
    Ok(Value::Object(out))
}

/// Media metadata probed by the host (image: duration=0; audio: width/height=0).
/// `fps` is the media source frame rate (used for frame-exact sampling in §6.5); when unknown it is 0, and sampling degrades to continuous time.
#[derive(Debug, Clone, Copy, Default)]
pub struct MediaMeta {
    pub width: f64,
    pub height: f64,
    pub duration: f64,
    pub fps: f64,
    /// Number of playback loops the material itself declares (`0` = infinite). **Only meaningful for `animatedImage`**: GIF's NETSCAPE2.0 / APNG's `acTL.num_plays` / WebP's `ANIM.loop_count`. When the element does not write `loop`, the default is taken from it (§6.5.1).
    pub plays: u32,
}

/// The minimal core-side form of a transcript word atom (§18.6): the CLI bridges it from flow-core TranscriptDoc. t0/t1 are in source media seconds.
#[derive(Debug, Clone, PartialEq)]
pub struct CoreWord {
    pub id: String,
    pub t0: f64,
    pub t1: f64,
}

/// Back-fill from host → core: resolve time needs only metadata; the bytes stay in the host.
/// `transcripts` keys word lists by asset id (the source for `~` word-anchor evaluation, §5.2/§18.6).
#[derive(Debug, Clone, Default)]
pub struct HostInputs {
    /// Declared font source / asset reference → family name read by the host.
    pub font_families: HashMap<String, String>,
    pub media: HashMap<String, MediaMeta>,
    pub transcripts: HashMap<String, Vec<CoreWord>>,
    /// Per-frame **start** millisecond table of `animatedImage` / `lottie` (N+1 entries; the last entry is the total duration).
    /// During recording, source time is quantized to frame starts using it, so consecutive instants within the same frame emit byte-identical DrawOps, which is what lets the static-frame cache and frame fingerprints actually hit.
    pub frame_tables: HashMap<String, Arc<[i64]>>,
}

impl HostInputs {
    pub fn insert_image(&mut self, id: &str, width: f64, height: f64) {
        self.media.insert(
            id.to_string(),
            MediaMeta {
                width,
                height,
                duration: 0.0,
                fps: 0.0,
                plays: 0,
            },
        );
    }
    /// Animated image: width and height + per-frame start table + the number of playback loops the material declares itself.
    /// `duration` is derived from the table's last entry; `fps` is always 0 (per-frame durations may differ).
    pub fn insert_animated_image(
        &mut self,
        id: &str,
        width: f64,
        height: f64,
        frame_starts_ms: Vec<i64>,
        plays: u32,
    ) {
        let duration = frame_starts_ms.last().copied().unwrap_or(0) as f64 / 1000.0;
        self.media.insert(
            id.to_string(),
            MediaMeta {
                width,
                height,
                duration,
                fps: 0.0,
                plays,
            },
        );
        self.frame_tables
            .insert(id.to_string(), Arc::from(frame_starts_ms));
    }
    /// Lottie: width and height come from the composition header; the frame table covers `[ip, op)` at the composition frame rate.
    ///
    /// Sharing one back-fill path with animated images is **intentional**: the element time semantics of the two are fully isomorphic (`localTime = mediaStart + (t − clip.start) × rate`, then quantized by the frame table). The only difference is whether a frame holds a bitmap or vector instructions, and that is the host's concern.
    /// A Lottie container carries no playback loop count, so `plays` is always 0 (infinite); whether the element writes `loop` is the criterion.
    pub fn insert_lottie(&mut self, id: &str, width: f64, height: f64, frame_starts_ms: Vec<i64>) {
        self.insert_animated_image(id, width, height, frame_starts_ms, 0);
    }
    /// Program picture (§6.5.3): size and frame table both come from the asset declaration; the back-fill path is the same as Lottie, and `plays` is always 0 (if `loop` is not written, it loops infinitely).
    pub fn insert_program(&mut self, id: &str, program: &ProgramReq) {
        self.insert_animated_image(
            id,
            f64::from(program.width),
            f64::from(program.height),
            program.frame_starts_ms(),
            0,
        );
    }
    pub fn insert_video(&mut self, id: &str, width: f64, height: f64, duration: f64, fps: f64) {
        self.media.insert(
            id.to_string(),
            MediaMeta {
                width,
                height,
                duration,
                fps,
                plays: 0,
            },
        );
    }
    pub fn insert_audio(&mut self, id: &str, duration: f64) {
        self.media.insert(
            id.to_string(),
            MediaMeta {
                width: 0.0,
                height: 0.0,
                duration,
                fps: 0.0,
                plays: 0,
            },
        );
    }
    pub fn insert_transcript(&mut self, asset_id: &str, words: Vec<CoreWord>) {
        self.transcripts.insert(asset_id.to_string(), words);
    }
}

/// `"$assets.logo"` → `Some("logo")` (the only legal form of a media node's src, spec §11.2)
pub fn asset_ref_id(src: &str) -> Option<&str> {
    let rest = src.strip_prefix("$assets.")?;
    if rest.is_empty() || rest.contains('.') {
        return None;
    }
    Some(rest)
}

/// hash field format validation ("sha256-" + 64 hex digits)
pub fn valid_hash(h: &str) -> bool {
    h.strip_prefix("sha256-")
        .map(|hex| hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn requirements_sorted_and_typed() {
        let doc = json!({ "assets": {
            "zeta": { "type": "audio", "src": "a.mp3" },
            "alpha": { "type": "image", "src": "l.png", "hash": "sha256-".to_string() + &"ab".repeat(32) }
        }});
        let reqs = host_requirements(&doc).unwrap();
        assert_eq!(reqs.len(), 2);
        assert_eq!(reqs[0].id, "alpha");
        assert_eq!(reqs[0].kind, AssetKind::Image);
        assert!(valid_hash(reqs[0].hash.as_deref().unwrap()));
        assert_eq!(reqs[1].id, "zeta");
    }

    #[test]
    fn unknown_kind_rejected() {
        let doc = json!({ "assets": { "x": { "type": "gif", "src": "x.gif" } } });
        assert!(host_requirements(&doc).is_err());
        // Animated images have their own kind: the file extension does not participate in the decision, `type` does.
        let doc = json!({ "assets": { "x": { "type": "animatedImage", "src": "x.gif" } } });
        let reqs = host_requirements(&doc).unwrap();
        assert_eq!(reqs[0].kind, AssetKind::AnimatedImage);
        assert_eq!(reqs[0].kind.to_string(), "animatedImage");
    }

    #[test]
    fn asset_ref_parsing() {
        assert_eq!(asset_ref_id("$assets.logo"), Some("logo"));
        assert_eq!(asset_ref_id("assets/logo.png"), None);
        assert_eq!(asset_ref_id("$assets.a.b"), None);
        assert!(!valid_hash("sha256-zz"));
    }
}
