//! Two-tier validation (spec §16): Schema tier (structurally valid, closed enums) → Lint tier (semantics and taste).

use crate::assets::{self, AssetKind, HostInputs};
use crate::ease::EASE_NAMES;
use crate::json::JsonExt;
use crate::resolve::{Fit, RNode, Resolver, VisualClip};
use crate::timeexpr;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Info,
    Warn,
    Error,
}

impl fmt::Display for Severity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Severity::Info => write!(f, "info"),
            Severity::Warn => write!(f, "warn"),
            Severity::Error => write!(f, "error"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Diagnostic {
    pub rule: &'static str,
    pub severity: Severity,
    pub pointer: String,
    pub message: String,
}

/// Animatable property allowlist (spec §6.4). The only implementation is in `motion::value`.
pub use motion::value::ANIM_PROPS;

/// Scene count cap (spec §5.1 / §16 Schema tier, `1..MAX_SCENES`). Raised from 50 to 400 in `1.244.0`: long films with one shot per scene (MVs cut on every beat, ten-minute explainers) do not fit in 50 scenes, and the scene table is only a time anchor; the cost of resolve and lint scales linearly with the clip count, and 400 scenes have been measured not to be a bottleneck.
pub const MAX_SCENES: usize = 400;

/// Mapping from error-message prefixes of `resolve()` failures to lint codes (spec §16).
///
/// Order is match priority: earlier prefixes match first. `"component-"` is a **deliberately broad prefix**: the actual messages are `component-cycle:` and `component-unknown:`; the old implementation mapped both to `component-cycle`, and narrowing it would change existing lint output.
pub const RESOLVE_ERROR_CODES: &[(&str, &str)] = &[
    ("time-ref-cycle", "time-ref-cycle"),
    ("time-ref-unknown", "time-ref-unknown"),
    ("transition-mismatch", "transition-mismatch"),
    ("transition-unknown", "transition-unknown"),
    ("component-", "component-cycle"),
    ("preset-unknown", "preset-unknown"),
    ("preset-version-unknown", "preset-version-unknown"),
    ("preset-compose-cycle", "preset-compose-cycle"),
    ("preset-param-unknown", "preset-param-unknown"),
    ("preset-param-missing", "preset-param-missing"),
    (
        "effect-capability-unsupported",
        "effect-capability-unsupported",
    ),
    ("relative-basis-unresolved", "relative-basis-unresolved"),
    ("motion-legacy-and-flow", "motion-legacy-and-flow"),
    ("split-line-unsupported", "split-line-unsupported"),
    // Spec §16 has no separate code for "flow structure violation" (it is a schema-tier matter), and likewise `motion-unsupported` (capabilities not yet implemented in stage 3).
    ("motion-flow-invalid", "schema"),
    ("motion-unsupported", "schema"),
    // Spec §16 has no separate code for "relative length written on a disallowed property"; it falls under schema.
    ("relative-not-allowed", "schema"),
    ("manifest-invalid", "schema"),
    ("word-anchor-unmapped", "word-anchor-unmapped"),
    ("word-anchor-ambiguous", "word-anchor-ambiguous"),
    ("word-anchor-no-transcript", "word-anchor-no-transcript"),
    ("word-anchor-name-clash", "word-anchor-name-clash"),
    ("asset-media-outside-project", "asset-media-outside-project"),
    ("path-command-unsupported", "path-command-unsupported"),
    ("path-morph-topology", "path-morph-topology"),
    ("mask-source-unknown", "mask-source-unknown"),
];

/// All lint codes this implementation can produce. `tests/lint_codes.rs` greps each one against the spec §16 table.
pub const LINT_RULES: &[(&str, Severity)] = &[
    ("schema", Severity::Error),
    ("resolve-error", Severity::Error),
    ("time-ref-cycle", Severity::Error),
    ("time-ref-unknown", Severity::Error),
    ("track-overlap", Severity::Error),
    ("transition-mismatch", Severity::Error),
    ("transition-unknown", Severity::Error),
    ("component-cycle", Severity::Error),
    ("clip-outside-scenes", Severity::Error),
    ("camera-multi-track", Severity::Error),
    ("caption-lane-unknown", Severity::Error),
    ("caption-words-mismatch", Severity::Error),
    ("caption-from-unknown-media", Severity::Error),
    ("caption-from-and-items", Severity::Error),
    ("asset-media-outside-project", Severity::Error),
    ("word-anchor-unmapped", Severity::Error),
    ("word-anchor-ambiguous", Severity::Error),
    ("word-anchor-no-transcript", Severity::Error),
    ("word-anchor-name-clash", Severity::Error),
    ("scene-id-reserved", Severity::Error),
    ("element-id-duplicate", Severity::Error),
    ("path-command-unsupported", Severity::Error),
    ("path-outside-svg", Severity::Warn),
    ("svg-child-unsupported", Severity::Warn),
    ("text-newline", Severity::Warn),
    ("text-align-needs-wrap", Severity::Warn),
    ("layout-align-ignored", Severity::Warn),
    ("text-emoji-no-glyph", Severity::Warn),
    ("path-morph-topology", Severity::Error),
    ("mask-source-unknown", Severity::Error),
    ("path-morph-no-target", Severity::Warn),
    ("clip-path-evenodd", Severity::Warn),
    ("cue-off-grid", Severity::Warn),
    ("transition-in-sketch", Severity::Warn),
    ("cadence-fps-mismatch", Severity::Info),
    ("sketch-mixed-finish", Severity::Warn),
    ("sketch-color-off-palette", Severity::Warn),
    ("sketch-text-outside-signoff", Severity::Warn),
    // Produced host-side (`ccut lint --sheet` render extracts frames): core only registers the vocabulary.
    ("sketch-blank-frame", Severity::Warn),
    ("preset-unknown", Severity::Error),
    ("preset-version-unknown", Severity::Error),
    ("preset-compose-cycle", Severity::Error),
    ("preset-param-unknown", Severity::Error),
    ("preset-param-missing", Severity::Error),
    ("relative-basis-unresolved", Severity::Error),
    ("motion-legacy-and-flow", Severity::Error),
    ("motion-shader-inline", Severity::Error),
    ("split-line-unsupported", Severity::Error),
    ("bcf-version-unsupported", Severity::Error),
    ("effect-capability-unsupported", Severity::Error),
    // Two-level codes: fail (outside the subset, see §6.5.2) is a hard error at resource loading time; warn (a `ef ty=5` controller group without an expression) is surfaced through preflight reporting. The table records the stronger level — `ccut lint` itself does not produce it (lint has no I/O and cannot read asset bytes).
    ("lottie-unsupported-feature", Severity::Error),
    // Shape of the `program` asset declaration (§6.5.3): size / frame rate / frame count / imports / files / props; `ccut lint`'s module-graph check also uses it to report invalid paths in files.
    ("program-invalid", Severity::Error),
    // A `program`'s src / imports / files using `..` to escape the directory containing the document (§6.5.3). This module checks the three places visible statically; relative imports inside modules are reported by `ccut lint`'s module-graph check (ccut-compile `program::graph`, reads disk, does not evaluate) and at resource-loading time with the same code; only loading time can see `asset()`.
    ("program-path-escape", Severity::Error),
    // The following three are not produced by this module (pure function, no I/O): `ccut lint` reports them when the host layer reads disk and scans static imports; resource loading reports the same code (§6.5.3). Added to lint as of `1.244.0`.
    ("program-module-not-found", Severity::Error),
    ("program-compile-failed", Severity::Error),
    ("program-file-missing", Severity::Error),
    // The program uses constructs the renderer cannot draw (unsupported CSS properties etc.); it degrades and still renders frames. Collected by a trial render of the first frame at resource-loading time and surfaced through preflight reporting; `ccut lint` does not produce it.
    ("program-degraded", Severity::Warn),
    ("event-id-missing", Severity::Error),
    ("event-id-duplicate", Severity::Error),
    ("event-time-invalid", Severity::Error),
    ("event-phase-invalid", Severity::Error),
    ("event-outside-doc", Severity::Warn),
    ("element-id-missing", Severity::Warn),
    // style.x / style.y on the clip root element have no effect (the root node is laid out from the canvas origin, §6.4). Since `1.244.0`.
    ("clip-root-xy-ignored", Severity::Warn),
    ("dead-air", Severity::Warn),
    ("narration-idle", Severity::Warn),
    ("bcf-version-missing", Severity::Warn),
    ("effect-fallback-applied", Severity::Warn),
    ("transition-fallback-applied", Severity::Warn),
    ("preset-sprawl", Severity::Warn),
    ("motion-replace-overlap", Severity::Warn),
    ("caption-flash", Severity::Warn),
    ("text-beat-too-short", Severity::Warn),
    ("video-window-overrun", Severity::Warn),
    ("z-reserved-band", Severity::Warn),
    ("scene-dur-long", Severity::Warn),
    ("preset-alias-used", Severity::Info),
    ("effect-determinism-visual", Severity::Info),
    ("experimental-field", Severity::Info),
    ("caption-highlight-no-words", Severity::Info),
    ("orphan-scene", Severity::Info),
    ("abs-time-used", Severity::Info),
];

/// Zero-measure text: lint and template normalization only need box geometry, not fonts.
pub(crate) struct ZeroMeasure;
impl crate::layout::TextMeasure for ZeroMeasure {
    fn measure(
        &mut self,
        _t: &str,
        _f: &str,
        size: f64,
        _w: u16,
    ) -> crate::layout::TextMetricsLine {
        crate::layout::TextMetricsLine {
            width: 0.0,
            ascent: size * 0.8,
            descent: size * 0.2,
        }
    }
}

/// Error message → lint code. `resolve-error` is the fallback.
pub fn resolve_error_code(msg: &str) -> &'static str {
    RESOLVE_ERROR_CODES
        .iter()
        .find(|(prefix, _)| msg.starts_with(prefix))
        .map(|(_, code)| *code)
        .unwrap_or("resolve-error")
}

/// Style subset (spec §6.3, closed enum)
pub const STYLE_KEYS: &[&str] = &[
    "width",
    "height",
    "x",
    "y",
    "padding",
    "gap",
    "layout",
    "columns",
    "flex",
    "align",
    "justify",
    "background",
    "color",
    "borderRadius",
    "border",
    "shadow",
    "opacity",
    "font",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "textWrap",
    "textStroke",
    "scale",
    "scaleX",
    "scaleY",
    "rotation",
    "anchor",
    "overflow",
    "clipPath",
    "mask",
    "blendMode",
    "z",
];

/// Closed enum for `style.blendMode` (§6.6). The only implementation is `motion::effect::BlendMode`.
pub fn blend_modes() -> [&'static str; 9] {
    motion::effect::BlendMode::ALL.map(motion::effect::BlendMode::as_str)
}

pub const NODE_TYPES: &[&str] = &[
    "charGrid",
    "proc",
    "composition",
    "box",
    "text",
    "image",
    "animatedImage",
    "lottie",
    "program",
    "video",
    "svg",
    "path",
    "group",
    "use",
];

/// variables[].type closed enum (§11.1; asset is new in v0.3)
pub const VAR_TYPES: &[&str] = &[
    "string", "number", "color", "boolean", "enum", "json", "asset",
];

macro_rules! diag {
    ($out:expr, $rule:expr, $sev:expr, $ptr:expr, $msg:expr) => {
        $out.push(Diagnostic {
            rule: $rule,
            severity: $sev,
            pointer: $ptr,
            message: $msg,
        })
    };
}

/// Paths statically visible for a `program` asset (the value of `src`, the values in `imports`, each entry of `files`) that use `..` to escape the document's directory → `program-path-escape` (§6.5.3), with the pointer landing on the specific entry. A malformed shape (not a string, etc.) belongs to `program-invalid`; this only looks at the strings it can get.
fn lint_program_paths(out: &mut Vec<Diagnostic>, id: &str, ptr: &str, entry: &Value) {
    use crate::program_path::{PATH_ESCAPE, escape_message, escapes};
    // RFC 6901: escaping of `~` / `/` in keys
    let token = |name: &str| name.replace('~', "~0").replace('/', "~1");
    let mut escape = |pointer: String, subject: String, path: &str| {
        diag!(
            out,
            PATH_ESCAPE,
            Severity::Error,
            pointer,
            format!("program asset \"{id}\": {}", escape_message(&subject, path))
        );
    };
    if let Some(src) = entry.gstr("src")
        && escapes("", src)
    {
        escape(format!("{ptr}/src"), "src".into(), src);
    }
    if let Some(imports) = entry.get_("imports").and_then(Value::as_object) {
        for (name, target) in imports {
            if let Some(target) = target.as_str()
                && escapes("", target)
            {
                escape(
                    format!("{ptr}/imports/{}", token(name)),
                    format!("imports.{name}"),
                    target,
                );
            }
        }
    }
    if let Some(files) = entry.get_("files").and_then(Value::as_array) {
        for (index, file) in files.iter().enumerate() {
            if let Some(file) = file.as_str()
                && escapes("", file)
            {
                escape(
                    format!("{ptr}/files/{index}"),
                    format!("files[{index}]"),
                    file,
                );
            }
        }
    }
}

/// Validation profile (ADR-M12).
///
/// * `Document` — the author's project document. Effects at `visual` / `backend` level only emit info (`effect-determinism-visual`): the author knows what they are swapping.
///
/// The old `DistributableTemplate` (`.bctpl` distributable template, which reported `template-effect-determinism` as an error) was removed along with the `.bctpl` system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum LintProfile {
    #[default]
    Document,
    /// Art discipline for the hand-drawn style (spec §16): adds `sketch-*` rules on top of `document`.
    Sketch,
}

impl LintProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            LintProfile::Document => "document",
            LintProfile::Sketch => "sketch",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "document" => Some(LintProfile::Document),
            "sketch" => Some(LintProfile::Sketch),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct LintOptions {
    pub profile: LintProfile,
}

pub fn lint(doc: &Value) -> Vec<Diagnostic> {
    lint_with_inputs(doc, None)
}

/// Full validation with host injection: `inputs` provides the word-level transcript (for `~` anchor evaluation) and media metadata (`video-window-overrun` needs the duration). Pass None for pure-document scenes.
pub fn lint_with_inputs(doc: &Value, inputs: Option<&HostInputs>) -> Vec<Diagnostic> {
    lint_with_options(doc, inputs, LintOptions::default())
}

/// Full form of [`lint_with_inputs`]: additionally specifies the validation profile (ADR-M12).
pub fn lint_with_options(
    doc: &Value,
    inputs: Option<&HostInputs>,
    options: LintOptions,
) -> Vec<Diagnostic> {
    let profile = options.profile;
    let mut out: Vec<Diagnostic> = Vec::new();

    // Top-level version key (ADR-M13). A missing key is read as 0.1 (warn); an unknown version is a hard error — "an unknown higher version must never be silently downgraded". 0.1 is always readable.
    let declared = doc.gstr("ccut");
    if declared.is_none() {
        diag!(
            out,
            "bcf-version-missing",
            Severity::Warn,
            "/ccut".to_string(),
            format!(
                "top-level ccut version key is missing; read as \"{}\". `ccut migrate` can fill it in place (§4)",
                crate::migrate::BCF_FALLBACK
            )
        );
    } else if let Some(version) = declared.filter(|v| !crate::migrate::is_supported(v)) {
        diag!(
            out,
            "bcf-version-unsupported",
            Severity::Error,
            "/ccut".to_string(),
            format!(
                "document declares ccut version \"{version}\", which this implementation does not support ({:?}); it must not be read with a silent downgrade (§4)",
                crate::migrate::BCF_VERSIONS
            )
        );
    }
    // ADR-M13: experimental fields only emit info on 0.1 documents; after upgrading to `ccut: "0.2"` they become formal.
    let experimental_fields_apply = crate::migrate::doc_version(doc) == "0.1";
    // BCF is pure data: shaders / scripts / expressions are not allowed anywhere in the **whole document** (ADR-M07).
    lint_executable_content(doc, "", &mut out);

    // ── meta / scenes (Schema tier) ──
    match doc.get_("meta") {
        None => diag!(
            out,
            "schema",
            Severity::Error,
            "/meta".into(),
            "missing meta".into()
        ),
        Some(m) => {
            for k in ["id", "width", "height"] {
                if m.get_(k).is_none() {
                    diag!(
                        out,
                        "schema",
                        Severity::Error,
                        format!("/meta/{k}"),
                        format!("meta.{k} is required")
                    );
                }
            }
        }
    }
    match doc.get_("scenes").and_then(Value::as_array) {
        None => diag!(
            out,
            "schema",
            Severity::Error,
            "/scenes".into(),
            "missing scenes".into()
        ),
        Some(ss) => {
            if ss.is_empty() || ss.len() > MAX_SCENES {
                diag!(
                    out,
                    "schema",
                    Severity::Error,
                    "/scenes".into(),
                    format!("scene count {} is outside 1..{MAX_SCENES}", ss.len())
                );
            }
            let mut seen = HashSet::new();
            for (i, s) in ss.iter().enumerate() {
                let ptr = format!("/scenes/{i}");
                match s.gstr("id") {
                    None => diag!(
                        out,
                        "schema",
                        Severity::Error,
                        format!("{ptr}/id"),
                        "scene is missing id".into()
                    ),
                    Some(id) => {
                        if !seen.insert(id.to_string()) {
                            diag!(
                                out,
                                "schema",
                                Severity::Error,
                                format!("{ptr}/id"),
                                format!("scene id \"{id}\" is duplicated")
                            );
                        }
                        // `doc` is the @doc reserved anchor (§3.3) and cannot be used as a user scene id
                        if id == "doc" {
                            diag!(
                                out,
                                "scene-id-reserved",
                                Severity::Error,
                                format!("{ptr}/id"),
                                "scene id \"doc\" is a reserved anchor (@doc); rename it".into()
                            );
                        }
                    }
                }
                match s.get_("dur") {
                    None => diag!(
                        out,
                        "schema",
                        Severity::Error,
                        format!("{ptr}/dur"),
                        "scene is missing dur".into()
                    ),
                    Some(v) => {
                        if let Some(d) = v.as_f64() {
                            // dur must be positive is a hard constraint; the 300 s cap is a taste hint (§5.1) — the implicit host projection of §20.9 projects the whole film into a single scene, and long subtitled projects naturally exceed 300 s, so they must not be failed for that.
                            if d <= 0.0 {
                                diag!(
                                    out,
                                    "schema",
                                    Severity::Error,
                                    format!("{ptr}/dur"),
                                    format!("scene dur {d} must be positive")
                                );
                            } else if d > 300.0 {
                                diag!(
                                    out,
                                    "scene-dur-long",
                                    Severity::Warn,
                                    format!("{ptr}/dur"),
                                    format!(
                                        "scene dur {d} exceeds the suggested 300s limit (split long scenes; single scenes from an implicit host projection are exempt)"
                                    )
                                );
                            }
                        } else if !v.as_str().is_some_and(|s| s.starts_with("$vars.")) {
                            // number or "$vars.x" (§5.1); the actual value is settled at resolve time
                            diag!(
                                out,
                                "schema",
                                Severity::Error,
                                format!("{ptr}/dur"),
                                format!("scene dur {v} must be a positive number or a numeric variable reference \"$vars.x\"")
                            );
                        }
                    }
                }
                if s.gstr("desc").map_or(true, |d| d.is_empty()) {
                    diag!(
                        out,
                        "scene-desc-missing",
                        Severity::Error,
                        format!("{ptr}/desc"),
                        "scene desc is required (narrative anchor, spec §5.1)".into()
                    );
                }
            }
        }
    }

    // ── variables table (§11.1): closed type enum; asset-type value shape ──
    let mut var_types: HashMap<String, String> = HashMap::new();
    for (vi, v) in doc
        .get_("variables")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        let ptr = format!("/variables/{vi}");
        let Some(id) = v.gstr("id") else {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/id"),
                "variable is missing id".into()
            );
            continue;
        };
        let ty = v.gstr("type").unwrap_or("");
        if !VAR_TYPES.contains(&ty) {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/type"),
                format!("variable \"{id}\" type \"{ty}\" is not one of {}", VAR_TYPES.join("|"))
            );
        } else {
            var_types.insert(id.to_string(), ty.to_string());
        }
        if ty == "enum"
            && v.get_("options")
                .and_then(Value::as_array)
                .is_none_or(|a| a.is_empty())
        {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/options"),
                format!("enum variable \"{id}\" is missing options")
            );
        }
        if ty == "asset" {
            if let Some(d) = v.get_("default").filter(|d| !d.is_null()) {
                let obj = d.as_object();
                if obj.is_some_and(|o| o.contains_key("media")) {
                    diag!(
                        out,
                        "asset-media-outside-project",
                        Severity::Error,
                        format!("{ptr}/default"),
                        format!("asset variable \"{id}\": the {{media}} form requires a Project container (§17)")
                    );
                } else if !obj.is_some_and(|o| o.get("src").and_then(Value::as_str).is_some()) {
                    diag!(
                        out,
                        "schema",
                        Severity::Error,
                        format!("{ptr}/default"),
                        format!("asset variable \"{id}\" default must be a {{src, hash?}} object")
                    );
                }
            }
        }
    }

    // ── assets table (§11.2): closed type enum; exactly one of src|media|var; hash format ──
    let mut asset_kinds: HashMap<String, AssetKind> = HashMap::new();
    if let Some(entries) = doc.get_("assets").and_then(Value::as_object) {
        for (id, entry) in entries {
            let ptr = format!("/assets/{id}");
            match entry.gstr("type").and_then(AssetKind::parse) {
                Some(kind) => {
                    asset_kinds.insert(id.clone(), kind);
                }
                None => diag!(
                    out,
                    "schema",
                    Severity::Error,
                    format!("{ptr}/type"),
                    format!(
                        "asset type \"{}\" is not one of image|animatedImage|lottie|program|video|audio|font",
                        entry.gstr("type").unwrap_or("")
                    )
                ),
            }
            let has_src = entry.gstr("src").is_some_and(|s| !s.is_empty());
            let has_var = entry.gstr("var").is_some_and(|s| !s.is_empty());
            let has_media = entry.get_("media").is_some();
            if has_media {
                diag!(
                    out,
                    "asset-media-outside-project",
                    Severity::Error,
                    format!("{ptr}/media"),
                    format!("asset \"{id}\": a media reference requires a Project container (§17)")
                );
            }
            match (has_src, has_var) {
                (false, false) if !has_media => diag!(
                    out,
                    "schema",
                    Severity::Error,
                    format!("{ptr}/src"),
                    format!("asset \"{id}\" must have one of src / media / var")
                ),
                (true, true) => diag!(
                    out,
                    "schema",
                    Severity::Error,
                    format!("{ptr}/var"),
                    format!("asset \"{id}\": src and var are mutually exclusive (pick one)")
                ),
                _ => {}
            }
            if has_var {
                let var_name = entry.gstr("var").unwrap_or("");
                match var_types.get(var_name) {
                    None => diag!(
                        out,
                        "schema",
                        Severity::Error,
                        format!("{ptr}/var"),
                        format!("asset \"{id}\" delegates to undeclared variable \"{var_name}\"")
                    ),
                    Some(t) if t != "asset" => diag!(
                        out,
                        "schema",
                        Severity::Error,
                        format!("{ptr}/var"),
                        format!("asset \"{id}\" delegates to variable \"{var_name}\" whose type is {t}; it must be asset")
                    ),
                    _ => {}
                }
            }
            if entry.gstr("type") == Some("program") {
                if has_var {
                    diag!(
                        out,
                        "program-invalid",
                        Severity::Error,
                        format!("{ptr}/var"),
                        format!("program asset \"{id}\" does not accept var delegation (§6.5.3)")
                    );
                } else {
                    if let Err(error) = assets::ProgramReq::parse(id, entry) {
                        let message = error.to_string();
                        diag!(
                            out,
                            "program-invalid",
                            Severity::Error,
                            ptr.clone(),
                            message
                                .strip_prefix("program-invalid: ")
                                .unwrap_or(&message)
                                .to_string()
                        );
                    }
                    lint_program_paths(&mut out, id, &ptr, entry);
                }
            }
            if let Some(h) = entry.gstr("hash") {
                if !assets::valid_hash(h) {
                    diag!(
                        out,
                        "asset-hash-format",
                        Severity::Error,
                        format!("{ptr}/hash"),
                        "hash must be \"sha256-\" followed by 64 hex digits".into()
                    );
                }
            }
        }
    }

    // ── tracks: kind enum, camera/captions at most one each, TimeExpr syntax, abs-time ──
    let mut camera_tracks = 0;
    let mut caption_tracks = 0;
    let tracks = doc
        .get_("tracks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for (ti, tr) in tracks.iter().enumerate() {
        let kind = tr.gstr("kind").unwrap_or("visual");
        if !["visual", "camera", "captions", "audio"].contains(&kind) {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("/tracks/{ti}/kind"),
                format!("unknown track kind \"{kind}\"")
            );
        }
        if kind == "camera" {
            camera_tracks += 1;
        }
        if kind == "captions" {
            caption_tracks += 1;
        }
        for (ci, c) in tr
            .get_("clips")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            let ptr = format!("/tracks/{ti}/clips/{ci}");
            for key in ["start", "end"] {
                if let Some(v) = c.get_(key).filter(|v| !v.is_null()) {
                    if v.is_number() {
                        diag!(
                            out,
                            "abs-time-used",
                            Severity::Info,
                            format!("{ptr}/{key}"),
                            format!(
                                "clip \"{}\" {key} is a bare absolute time in seconds and does not follow reflow",
                                c.gstr("id").unwrap_or("?")
                            )
                        );
                    } else if let Some(s) = v.as_str() {
                        if let Err(e) = timeexpr::parse(s) {
                            diag!(
                                out,
                                "schema",
                                Severity::Error,
                                format!("{ptr}/{key}"),
                                e.to_string()
                            );
                        }
                    }
                }
            }
            if kind == "visual" {
                if let Some(el) = c.get_("element") {
                    lint_element(
                        el,
                        &format!("{ptr}/element"),
                        &asset_kinds,
                        experimental_fields_apply,
                        profile,
                        &mut out,
                    );
                    // Stable id discipline (direct-edit write-back scheme §4.3-1): the address for stage editing is the element path; a node without an id can only degrade to an index segment, and it would mismatch as soon as the author reorders.
                    lint_element_ids(el, &format!("{ptr}/element"), &mut out);
                    lint_clip_root_xy(c, el, &format!("{ptr}/element"), &mut out);
                }
            }
            if kind == "captions" {
                lint_captions(c, &ptr, &mut out);
            }
            if kind == "audio" {
                lint_media_src(
                    c.get_("src"),
                    AssetKind::Audio,
                    &format!("{ptr}/src"),
                    &asset_kinds,
                    &mut out,
                );
            }
        }
    }
    if camera_tracks > 1 || caption_tracks > 1 {
        diag!(
            out,
            "camera-multi-track",
            Severity::Error,
            "/tracks".into(),
            format!(
                "{camera_tracks} camera track(s) / {caption_tracks} captions track(s) (at most 1 of each)"
            )
        );
    }

    // ── project-level presets: animatable properties / ease enum ──
    if let Some(presets) = doc.get_("presets").and_then(Value::as_object) {
        for (name, def) in presets {
            for (ki, ch) in def
                .get_("keyframes")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
                .iter()
                .enumerate()
            {
                let ptr = format!("/presets/{name}/keyframes/{ki}");
                if let Some(prop) = ch.gstr("prop") {
                    if !motion::value::is_animatable(prop) {
                        diag!(
                            out,
                            "schema",
                            Severity::Error,
                            format!("{ptr}/prop"),
                            format!(
                                "\"{prop}\" is not in the animatable property allowlist{} (§6.4)",
                                motion::value::not_animatable_hint(prop)
                            )
                        );
                    }
                }
                for (fi, f) in ch
                    .get_("frames")
                    .and_then(Value::as_array)
                    .unwrap_or(&Vec::new())
                    .iter()
                    .enumerate()
                {
                    if let Some(e) = f.gstr("ease") {
                        if !EASE_NAMES.contains(&e) {
                            diag!(
                                out,
                                "schema",
                                Severity::Error,
                                format!("{ptr}/frames/{fi}/ease"),
                                format!("unknown ease \"{e}\" (closed set)")
                            );
                        }
                    }
                }
            }
        }
    }

    // ── component-cycle ──
    if let Some(comps) = doc.get_("components").and_then(Value::as_object) {
        let mut edges: HashMap<String, Vec<String>> = HashMap::new();
        for (name, def) in comps {
            let mut used = Vec::new();
            let root = def.get_("root").unwrap_or(&Value::Null);
            collect_uses(root, &mut used);
            edges.insert(name.clone(), used);
            // A component root is its own path space (scheme §4.3: authored paths of nodes inside a component are counted from the root)
            if root.is_object() {
                lint_element_ids(root, &format!("/components/{name}/root"), &mut out);
            }
        }
        for start in edges.keys() {
            let mut stack = vec![start.clone()];
            let mut visited = HashSet::new();
            while let Some(cur) = stack.pop() {
                if !visited.insert(cur.clone()) {
                    continue;
                }
                for next in edges.get(&cur).cloned().unwrap_or_default() {
                    if &next == start {
                        diag!(
                            out,
                            "component-cycle",
                            Severity::Error,
                            format!("/components/{start}"),
                            format!("component \"{start}\" instantiates itself recursively (via \"{cur}\")")
                        );
                        stack.clear();
                        break;
                    }
                    stack.push(next);
                }
            }
        }
    }

    lint_preset_vocabulary(doc, &mut out);
    let unknown_presets = lint_preset_refs_known(doc, &mut out);
    // resolve fails fast: if the `preset-unknown` it reports has already been reported statically at the reference site, it is not repeated again at `/`.
    let already_reported = |msg: &str| {
        msg.strip_prefix("preset-unknown: \"")
            .and_then(|rest| rest.strip_suffix('"'))
            .is_some_and(|name| unknown_presets.contains(name))
    };

    // ── checks that need window evaluation: track-overlap / time-ref-* / clip-outside-scenes ──
    match Resolver::new(doc.clone(), None) {
        Ok(mut r) => {
            if let Some(inputs) = inputs {
                r.set_host_inputs(inputs.clone());
            }
            match r.resolve() {
                Ok(mut ir) => {
                    // Stage 2: lint does not run real layout, but it does run one **zero-measure** layout, so that relative-length evaluation (and `relative-basis-unresolved`) happens at lint time. A zero-width box is still a box — the meaning of that code is "the target has no layout box".
                    let (cw, ch) = (ir.w, ir.h);
                    for clip in &mut ir.visual_clips {
                        crate::layout::layout_tree(&mut clip.tree, cw, ch, &mut ZeroMeasure);
                    }
                    if let Err(e) = crate::resolve::build_channels_after_layout(&mut ir) {
                        let msg = e.to_string();
                        diag!(
                            out,
                            resolve_error_code(&msg),
                            Severity::Error,
                            "/".into(),
                            msg
                        );
                    }
                    for vc in &ir.visual_clips {
                        // IR clips are already sorted across tracks and cannot be traced back to the original `/tracks/{i}/clips/{j}`; locate them by clip id, so the author can still see the offending segment at a glance.
                        lint_replace_overlap(
                            &vc.tree,
                            &format!("/clips/{}/element", vc.id),
                            &mut out,
                        );
                    }
                    for (ti, tr) in tracks.iter().enumerate() {
                        let mut wins: Vec<(String, f64, f64)> = Vec::new();
                        for c in tr
                            .get_("clips")
                            .and_then(Value::as_array)
                            .unwrap_or(&Vec::new())
                        {
                            let Some(id) = c.gstr("id") else { continue };
                            if let Some(&(Some(s), Some(e))) = r.clip_wins.get(id) {
                                wins.push((id.to_string(), s, e));
                                if e > ir.total + 1e-6 {
                                    diag!(
                                        out,
                                        "clip-outside-scenes",
                                        Severity::Error,
                                        format!("/tracks/{ti}"),
                                        format!(
                                            "clip \"{id}\" window [{s}, {e}] exceeds the film duration {}",
                                            ir.total
                                        )
                                    );
                                }
                            }
                        }
                        wins.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                        for w in wins.windows(2) {
                            // Declared window overlap (transition overlaps are materialized by the compiler and do not look at the render window)
                            if w[0].2 - w[1].1 > 1e-6 {
                                diag!(
                                    out,
                                    "track-overlap",
                                    Severity::Error,
                                    format!("/tracks/{ti}"),
                                    format!(
                                        "clip \"{}\" [{:.2},{:.2}] overlaps \"{}\" [{:.2},{:.2}] in time",
                                        w[0].0, w[0].1, w[0].2, w[1].0, w[1].1, w[1].2
                                    )
                                );
                            }
                        }
                    }
                    // video reference window overrun (§16): needs a host-probed duration
                    for vc in &ir.visual_clips {
                        lint_video_overrun(&vc.tree, vc, &mut out);
                    }
                    lint_cadence(doc, &ir, &mut out);
                    lint_narration_idle(doc, &ir, &mut out);
                    // Top-level `events[]` (§4.2): not read by rendering, but an undecodable `t` or a duplicate id is a document error
                    for issue in crate::events::resolve_events(&r, &ir.scenes, ir.total).issues {
                        out.push(Diagnostic {
                            rule: issue.rule,
                            severity: issue.severity,
                            pointer: issue.pointer,
                            message: issue.message,
                        });
                    }
                    if profile == LintProfile::Sketch {
                        lint_sketch(doc, &ir, &mut out);
                    }
                }
                Err(e) => {
                    let msg = e.to_string();
                    if !already_reported(&msg) {
                        diag!(
                            out,
                            resolve_error_code(&msg),
                            Severity::Error,
                            "/".into(),
                            msg
                        );
                    }
                }
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if !already_reported(&msg) {
                diag!(
                    out,
                    resolve_error_code(&msg),
                    Severity::Error,
                    "/".into(),
                    msg
                );
            }
        }
    }

    out.sort_by(|a, b| b.severity.cmp(&a.severity).then(a.pointer.cmp(&b.pointer)));
    out
}

/// `motion-replace-overlap` (warn, spec §7.7 / §16): multiple `replace` channels for the same property whose times overlap; the later one overrides the earlier by `order`.
///
/// The check is done directly on `RNode::channels`, not by going around `MotionProgram` — a channel's `(composite, order)` is exactly the two fields `lower_bcf` carries over unchanged; an extra conversion layer in between would only lose the pointer.
fn lint_replace_overlap(node: &RNode, ptr: &str, out: &mut Vec<Diagnostic>) {
    use motion::CompositeMode;

    let span = |ch: &crate::sample::Channel| -> Option<(f64, f64)> {
        Some((ch.frames.first()?.t, ch.frames.last()?.t))
    };
    for (i, a) in node.channels.iter().enumerate() {
        if a.composite != CompositeMode::Replace {
            continue;
        }
        let Some((a0, a1)) = span(a) else { continue };
        for b in node.channels.iter().skip(i + 1) {
            if b.composite != CompositeMode::Replace || b.prop != a.prop {
                continue;
            }
            let Some((b0, b1)) = span(b) else { continue };
            let t0 = a0.max(b0);
            let t1 = a1.min(b1);
            if t1 - t0 <= 1e-9 {
                continue;
            }
            let (early, late) = if a.order <= b.order {
                (a.order, b.order)
            } else {
                (b.order, a.order)
            };
            diag!(
                out,
                "motion-replace-overlap",
                Severity::Warn,
                format!("{ptr}/animate"),
                format!(
                    "element \"{}\" property \"{}\" has two replace tracks overlapping in [{t0:.3}, {t1:.3}]; order {late} overrides order {early} (§7.7)",
                    node.id, a.prop
                )
            );
        }
    }
    for (i, child) in node.children.iter().enumerate() {
        lint_replace_overlap(child, &format!("{ptr}/children/{i}"), out);
    }
}

/// All preset references appearing in the document: `(id, pointer)`.
fn collect_preset_refs(el: &Value, ptr: &str, out: &mut Vec<(String, String)>) {
    if let Some(a) = el.get_("animate") {
        for slot in ["enter", "exit"] {
            if let Some(id) = a.get_(slot).and_then(|v| v.gstr("preset")) {
                out.push((id.to_string(), format!("{ptr}/animate/{slot}/preset")));
            }
        }
        for (i, em) in a
            .get_("emphasis")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            if let Some(id) = em.gstr("preset") {
                out.push((id.to_string(), format!("{ptr}/animate/emphasis/{i}/preset")));
            }
        }
    }
    for (i, c) in el
        .get_("children")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        collect_preset_refs(c, &format!("{ptr}/children/{i}"), out);
    }
}

/// References from `op: "preset"` entries in `animate.flow` / `animate.parts`: `(id, pointer)`. Walks the full op tree along `item` / `items[]` (§7.5 / §7.9).
fn collect_op_preset_refs(el: &Value, ptr: &str, out: &mut Vec<(String, String)>) {
    fn walk(op: &Value, ptr: &str, out: &mut Vec<(String, String)>) {
        let Some(map) = op.as_object() else { return };
        if map.get("op").and_then(Value::as_str) == Some("preset") {
            if let Some(id) = map.get("preset").and_then(Value::as_str) {
                out.push((id.to_string(), format!("{ptr}/preset")));
            }
        }
        if let Some(item) = map.get("item") {
            walk(item, &format!("{ptr}/item"), out);
        }
        for (i, item) in map
            .get("items")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            walk(item, &format!("{ptr}/items/{i}"), out);
        }
    }
    if let Some(a) = el.get_("animate") {
        for slot in ["flow", "parts"] {
            if let Some(root) = a.get_(slot) {
                walk(root, &format!("{ptr}/animate/{slot}"), out);
            }
        }
    }
    for (i, c) in el
        .get_("children")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        collect_op_preset_refs(c, &format!("{ptr}/children/{i}"), out);
    }
}

/// Static check for `preset-unknown` (error, §7.4 / §16): reported at the reference site, without waiting for resolve.
///
/// resolve fails fast, so as long as there is an earlier error in the document (e.g. `motion-unsupported`), a misspelled preset stays invisible; here each of the two lookup paths is judged separately, corresponding one-to-one with resolve's judgments:
///
/// - `enter` / `exit` / `emphasis[i]`: project-level `presets` → generic manifest (including aliases) → frozen `bcf.*@1` recipes (`Resolver::slot_channels`);
/// - `op: "preset"` in flow / parts: only the registry is consulted (manifest and frozen recipes), **not** the project-level `presets` (`motion::graph` calls `preset_registry::expand` directly).
///
/// Values beginning with `$` (variable references) are left for resolve. Returns the names already reported, so that resolve's entry can deduplicate.
fn lint_preset_refs_known(doc: &Value, out: &mut Vec<Diagnostic>) -> HashSet<String> {
    use motion::preset_registry::{bcf_preset, canonical_id, manifest};
    let registry_known = |id: &str| {
        let canonical = canonical_id(id);
        manifest(canonical).is_some() || bcf_preset(canonical).is_some()
    };
    let project_level = |id: &str| doc.get_("presets").and_then(|p| p.get_(id)).is_some();
    let mut slots: Vec<(String, String)> = Vec::new();
    let mut ops: Vec<(String, String)> = Vec::new();
    for (ti, tr) in doc
        .get_("tracks")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        for (ci, c) in tr
            .get_("clips")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            if let Some(el) = c.get_("element") {
                let ptr = format!("/tracks/{ti}/clips/{ci}/element");
                collect_preset_refs(el, &ptr, &mut slots);
                collect_op_preset_refs(el, &ptr, &mut ops);
            }
        }
    }
    let mut reported = HashSet::new();
    for (id, ptr) in &slots {
        if id.starts_with('$') || project_level(id) || registry_known(id) {
            continue;
        }
        diag!(
            out,
            "preset-unknown",
            Severity::Error,
            ptr.clone(),
            format!(
                "preset-unknown: \"{id}\" is not a project-level preset, a built-in motion.* family or a bcf.* recipe (§7.4 / Appendix B)"
            )
        );
        reported.insert(id.clone());
    }
    for (id, ptr) in &ops {
        if id.starts_with('$') || registry_known(id) {
            continue;
        }
        let hint = if project_level(id) {
            "; project-level presets are only allowed in enter / exit / emphasis, and op: \"preset\" in flow / parts only accepts built-in motion.* families and bcf.* recipes"
        } else {
            "(§7.5 / Appendix B)"
        };
        diag!(
            out,
            "preset-unknown",
            Severity::Error,
            ptr.clone(),
            format!("preset-unknown: \"{id}\" is not a built-in preset{hint}")
        );
        reported.insert(id.clone());
    }
    reported
}

/// Spec §16: project-level presets using more than ~4 entrance/emphasis terms (`preset-sprawl`, warn) and `preset-alias-used` (info).
///
/// Counting rules (two):
///
/// 1. **Normalize to canonical family**: `Back In Left` and `Back In Right` are both `backIn` and count as one term — this is exactly the benefit of the design's §5.4.3 "UI vocabulary separated from canonical family".
///    Each id in project-level `presets` counts as its own family.
/// 2. **Frozen `bcf.*@1` functional recipes are not counted** (`countUp` / `barFill` / `kenBurns` / `fadeIn` / `fadeOut`). The rule measures the **vocabulary** of entrances and emphasis, a style dimension; number rolling and progress-bar fill are functions, not style, and counting them would make an exemplary document like `core/runtime/starter`, which uses only rise / draw / pop for the whole film, trigger the warning.
const PRESET_SPRAWL_THRESHOLD: usize = 4;

fn lint_preset_vocabulary(doc: &Value, out: &mut Vec<Diagnostic>) {
    let mut refs: Vec<(String, String)> = Vec::new();
    for (ti, tr) in doc
        .get_("tracks")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        for (ci, c) in tr
            .get_("clips")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            if let Some(el) = c.get_("element") {
                collect_preset_refs(el, &format!("/tracks/{ti}/clips/{ci}/element"), &mut refs);
            }
        }
    }
    let project_level = |id: &str| doc.get_("presets").and_then(|p| p.get_(id)).is_some();
    let mut families: HashSet<String> = HashSet::new();
    for (id, ptr) in &refs {
        if project_level(id) {
            families.insert(id.clone());
            continue;
        }
        let canonical = motion::preset_registry::canonical_id(id);
        if canonical != id {
            diag!(
                out,
                "preset-alias-used",
                Severity::Info,
                ptr.clone(),
                format!(
                    "\"{id}\" is an old alias; write the canonical family instead: {{\"preset\": \"{canonical}\", \"params\": {{…}}}} (§7.4 / Appendix B)"
                )
            );
        }
        if let Some(family) = motion::preset_registry::family_of(id) {
            families.insert(family.to_string());
        }
    }
    if families.len() > PRESET_SPRAWL_THRESHOLD {
        let mut names: Vec<&str> = families.iter().map(String::as_str).collect();
        names.sort_unstable();
        diag!(
            out,
            "preset-sprawl",
            Severity::Warn,
            "/tracks".to_string(),
            format!(
                "the film uses {} entrance/emphasis presets ({}), above the suggested {PRESET_SPRAWL_THRESHOLD}, which makes it feel fragmented (§7.4)",
                names.len(),
                names.join(", ")
            )
        );
    }
}

/// `video-window-overrun` (warn): the media requirement of a clip window, converted by playbackRate, exceeds the segment / source duration without loop enabled (§16). Skipped when duration is not probed (=0).
/// `animatedImage` / `lottie` / `program` are the same — the sampling formula is isomorphic to §6.5, and overrun also freezes the last frame.
fn lint_video_overrun(node: &RNode, vc: &VisualClip, out: &mut Vec<Diagnostic>) {
    lint_video_overrun_window(node, vc, vc.end - vc.start, out);
}

fn lint_video_overrun_window(
    node: &RNode,
    vc: &VisualClip,
    duration: f64,
    out: &mut Vec<Diagnostic>,
) {
    if matches!(
        node.ntype.as_str(),
        "video" | "animatedImage" | "lottie" | "program"
    ) && !node.loop_media
    {
        let limit = match (node.segment, node.media_duration > 0.0) {
            (Some((_, s1)), true) => Some(s1.min(node.media_duration)),
            (Some((_, s1)), false) => Some(s1),
            (None, true) => Some(node.media_duration),
            (None, false) => None,
        };
        if let Some(limit) = limit {
            let need = node.time_map.as_ref().map_or(
                node.media_start + duration * node.playback_rate,
                |map| {
                    map.points
                        .iter()
                        .filter(|(t, _)| *t <= duration)
                        .map(|(_, source)| *source)
                        .fold(map.sample(duration), f64::max)
                },
            );
            if need > limit + 1e-6 {
                diag!(
                    out,
                    "video-window-overrun",
                    Severity::Warn,
                    format!(
                        "/tracks (clip \"{}\" {} \"{}\")",
                        vc.id, node.ntype, node.id
                    ),
                    format!(
                        "media need reaches {need:.2}s, beyond the available {limit:.2}s; the excess freezes the last frame (loop: true can loop it)"
                    )
                );
            }
        }
    }
    for c in &node.children {
        lint_video_overrun_window(
            c,
            vc,
            node.composition
                .as_ref()
                .map_or(duration, |canvas| canvas.duration),
            out,
        );
    }
}

fn collect_uses(node: &Value, out: &mut Vec<String>) {
    if node.gstr("type") == Some("use") {
        if let Some(c) = node.gstr("component") {
            out.push(c.to_string());
        }
    }
    for c in node
        .get_("children")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
    {
        collect_uses(c, out);
    }
}

/// media src: must be $assets.* and declared, with a matching kind (catches "path unknown at render time" at compile time, §15)
fn lint_media_src(
    src: Option<&Value>,
    want: AssetKind,
    ptr: &str,
    asset_kinds: &HashMap<String, AssetKind>,
    out: &mut Vec<Diagnostic>,
) {
    let Some(s) = src.and_then(Value::as_str) else {
        diag!(
            out,
            "schema",
            Severity::Error,
            ptr.to_string(),
            "src is required".into()
        );
        return;
    };
    match assets::asset_ref_id(s) {
        None => diag!(
            out,
            "asset-src-literal",
            Severity::Error,
            ptr.to_string(),
            format!("src \"{s}\" does not accept a bare path or URL; it must be a $assets.* reference (§11.2)")
        ),
        Some(id) => match asset_kinds.get(id) {
            None => diag!(
                out,
                "asset-unknown",
                Severity::Error,
                ptr.to_string(),
                format!("referenced asset \"{id}\" is not declared in the assets table")
            ),
            Some(k) if *k != want => diag!(
                out,
                "asset-kind-mismatch",
                Severity::Error,
                ptr.to_string(),
                format!("asset \"{id}\" is {k}, but {want} is needed here")
            ),
            _ => {}
        },
    }
}

// ── Element-level checks (reusable) ───────────────────────────────────────────────
//
// The three functions below check respectively against the node-type allowlist / style subset / animate structure; `types` and `rule` are parameterized (document lint passes `NODE_TYPES` and `"schema"`), and diagnostics stay within their own rule families.

/// Node `type` must be within the allowlist (§6.1).
pub(crate) fn lint_node_type(
    el: &Value,
    ptr: &str,
    types: &[&str],
    rule: &'static str,
    out: &mut Vec<Diagnostic>,
) {
    let t = el.gstr("type").unwrap_or("");
    if !types.contains(&t) {
        diag!(
            out,
            rule,
            Severity::Error,
            format!("{ptr}/type"),
            format!("unknown node type \"{t}\"")
        );
    }
}

/// `style` keys must be within the closed subset (§6.3).
pub(crate) fn lint_style_keys(
    el: &Value,
    ptr: &str,
    rule: &'static str,
    out: &mut Vec<Diagnostic>,
) {
    if let Some(style) = el.get_("style").and_then(Value::as_object) {
        for k in style.keys() {
            if !STYLE_KEYS.contains(&k.as_str()) {
                diag!(
                    out,
                    rule,
                    Severity::Error,
                    format!("{ptr}/style/{k}"),
                    format!(
                        "style property \"{k}\" is not in the closed subset{} (§6.3)",
                        if k == "backgroundColor" {
                            "; in style, write the background color as background; backgroundColor is only an animation channel name"
                        } else {
                            ""
                        }
                    )
                );
            }
        }
    }
}

/// Effect parameter channels `effects[N].<param>` (§6.6) must point to a real entry in this element's `effects[]` and a **numeric** parameter (number / length). Out-of-range indices, unknown parameters, and boolean / color / enum parameters are all errors — a channel whose target entry cannot be found at render time is silently ignored, so this is the only interception point.
fn lint_effect_channel(
    el: &Value,
    prop: &str,
    ptr: String,
    rule: &'static str,
    out: &mut Vec<Diagnostic>,
) {
    use motion::effect::{ParamKind, lookup};
    let Some((index, param)) = motion::value::effect_param_channel(prop) else {
        return;
    };
    let Some(item) = el
        .get_("effects")
        .and_then(Value::as_array)
        .and_then(|items| items.get(index))
    else {
        diag!(
            out,
            rule,
            Severity::Error,
            ptr,
            format!("\"{prop}\" points to a non-existent effects[{index}] (§6.6)")
        );
        return;
    };
    let Some(id) = item.gstr("preset") else {
        return; // Missing preset is already reported by lint_effects
    };
    let version = item
        .get_("presetVersion")
        .and_then(Value::as_u64)
        .unwrap_or(1) as u32;
    let Ok(manifest) = lookup(id, version) else {
        return; // Unknown effect is already reported by lint_effects
    };
    match manifest.params.get(param).map(|spec| spec.kind) {
        Some(ParamKind::Number | ParamKind::Length) => {}
        Some(_) => diag!(
            out,
            rule,
            Severity::Error,
            ptr,
            format!(
                "\"{prop}\": {} parameter {param} is not a number and cannot be keyframed (§6.6)",
                manifest.qualified()
            )
        ),
        None => diag!(
            out,
            "preset-param-unknown",
            Severity::Error,
            ptr,
            format!(
                "\"{prop}\": {} has no parameter {param}; {} (§6.6)",
                manifest.qualified(),
                manifest.params_hint()
            )
        ),
    }
}

/// `{ prop }` at any level in `animate.flow` is checked with [`lint_effect_channel`].
fn lint_flow_effect_channels(
    el: &Value,
    node: &Value,
    ptr: &str,
    rule: &'static str,
    out: &mut Vec<Diagnostic>,
) {
    match node {
        Value::Object(map) => {
            if let Some(prop) = map.get("prop").and_then(Value::as_str) {
                lint_effect_channel(el, prop, format!("{ptr}/prop"), rule, out);
            }
            for (key, child) in map {
                lint_flow_effect_channels(el, child, &format!("{ptr}/{key}"), rule, out);
            }
        }
        Value::Array(items) => {
            for (index, child) in items.iter().enumerate() {
                lint_flow_effect_channels(el, child, &format!("{ptr}/{index}"), rule, out);
            }
        }
        _ => {}
    }
}

/// `animate.keyframes[].prop` is within the allowlist (§6.4), and `frames[].ease` is within the closed enum.
pub(crate) fn lint_animate(el: &Value, ptr: &str, rule: &'static str, out: &mut Vec<Diagnostic>) {
    if let Some(flow) = el.get_("animate").and_then(|a| a.get_("flow")) {
        lint_flow_effect_channels(el, flow, &format!("{ptr}/animate/flow"), rule, out);
    }
    if let Some(a) = el.get_("animate") {
        for (ki, ch) in a
            .get_("keyframes")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            if let Some(prop) = ch.gstr("prop") {
                if !motion::value::is_animatable(prop) {
                    diag!(
                        out,
                        rule,
                        Severity::Error,
                        format!("{ptr}/animate/keyframes/{ki}/prop"),
                        format!(
                            "\"{prop}\" is not in the animatable property allowlist{} (§6.4)",
                            motion::value::not_animatable_hint(prop)
                        )
                    );
                }
                lint_effect_channel(
                    el,
                    prop,
                    format!("{ptr}/animate/keyframes/{ki}/prop"),
                    rule,
                    out,
                );
            }
            for (fi, f) in ch
                .get_("frames")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
                .iter()
                .enumerate()
            {
                if let Some(e) = f.gstr("ease") {
                    if !EASE_NAMES.contains(&e) {
                        diag!(
                            out,
                            rule,
                            Severity::Error,
                            format!("{ptr}/animate/keyframes/{ki}/frames/{fi}/ease"),
                            format!("unknown ease \"{e}\" (closed set)")
                        );
                    }
                }
                // Each value of a `clipPath` channel must be a parseable parameterized shape (§6.3); there is no `Result` at recording time, so illegal values can only be caught here.
                if ch.gstr("prop") == Some("clipPath")
                    && let Some(v) = f.get_("v")
                    && let Err(error) = crate::resolve::ClipShape::parse(v)
                {
                    let msg = error.to_string();
                    diag!(
                        out,
                        if msg.starts_with("effect-capability-unsupported") {
                            "effect-capability-unsupported"
                        } else {
                            rule
                        },
                        Severity::Error,
                        format!("{ptr}/animate/keyframes/{ki}/frames/{fi}/v"),
                        msg
                    );
                }
                // Spec §7.8: relative lengths are only used for transform, blur, and effect parameters. Spec §16 has no separate code for this case; the caller's schema code is reused.
                if let (Some(prop), Some(v)) = (ch.gstr("prop"), f.get_("v")) {
                    if motion::preset_registry::manifest::is_relative_length_object(v)
                        && !motion::RELATIVE_LENGTH_PROPS.contains(&prop)
                    {
                        diag!(
                            out,
                            rule,
                            Severity::Error,
                            format!("{ptr}/animate/keyframes/{ki}/frames/{fi}/v"),
                            format!(
                                "property \"{prop}\" does not accept relative lengths; only {:?} do (§7.8)",
                                motion::RELATIVE_LENGTH_PROPS
                            )
                        );
                    }
                }
            }
        }
    }
}

/// If a value still contains `$theme.*` / `$vars.*` references ⇒ shape validation is left to resolve (it dereferences first).
fn has_dollar_ref(value: &Value) -> bool {
    match value {
        Value::String(s) => s.starts_with('$'),
        Value::Array(items) => items.iter().any(has_dollar_ref),
        Value::Object(map) => map.values().any(has_dollar_ref),
        _ => false,
    }
}

/// Shape validation of `style.background` (gradient object), `style.shadow`, `style.fontStyle`, and `style.mask` (§6.3). These keys were previously only allowed through in `STYLE_KEYS`, and nobody checked their values: when an author wrote `linear-gradient(...)` or a CSS shadow string, lint stayed silent and rendering drew nothing; this closes that gap.
/// Existence (the element that `mask.source` points to) is reported by resolve as `mask-source-unknown`.
pub(crate) fn lint_style_values(
    el: &Value,
    ptr: &str,
    rule: &'static str,
    out: &mut Vec<Diagnostic>,
) {
    let Some(style) = el.get_("style").and_then(Value::as_object) else {
        return;
    };
    if let Some(stroke) = style.get("textStroke").filter(|v| !v.is_null()) {
        if !has_dollar_ref(stroke) {
            if let Err(error) = crate::resolve::TextStroke::parse(stroke) {
                diag!(
                    out,
                    rule,
                    Severity::Error,
                    format!("{ptr}/style/textStroke"),
                    error.to_string()
                );
            }
        }
    }
    if let Some(bg) = style.get("background").filter(|v| !v.is_null()) {
        // String form: even `$theme.x` should not contain `gradient(`; for the object form, references are left to resolve.
        let check = match bg {
            Value::String(s) => s.contains("gradient(") || !s.starts_with('$'),
            _ => !has_dollar_ref(bg),
        };
        if check && let Err(error) = crate::resolve::BgGradient::parse(bg) {
            diag!(
                out,
                rule,
                Severity::Error,
                format!("{ptr}/style/background"),
                error.to_string()
            );
        }
    }
    if let Some(shadow) = style.get("shadow").filter(|v| !v.is_null())
        && !has_dollar_ref(shadow)
        && let Err(error) = crate::resolve::BoxShadow::parse(shadow)
    {
        diag!(
            out,
            rule,
            Severity::Error,
            format!("{ptr}/style/shadow"),
            error.to_string()
        );
    }
    if let Some(border) = style.get("border").filter(|v| !v.is_null())
        && !has_dollar_ref(border)
        && let Err(error) = crate::resolve::BoxBorder::parse(border)
    {
        diag!(
            out,
            rule,
            Severity::Error,
            format!("{ptr}/style/border"),
            error.to_string()
        );
    }
    if let Some(font_style) = style.get("fontStyle").filter(|v| !v.is_null())
        && !has_dollar_ref(font_style)
        && !matches!(font_style.as_str(), Some("normal") | Some("italic"))
    {
        diag!(
            out,
            rule,
            Severity::Error,
            format!("{ptr}/style/fontStyle"),
            format!("style.fontStyle {font_style} must be normal | italic (§6.3)")
        );
    }
    if let Some(mask) = style.get("mask").filter(|v| !v.is_null())
        && !has_dollar_ref(mask)
        && let Err(error) = crate::resolve::ElementMask::parse(mask)
    {
        diag!(
            out,
            rule,
            Severity::Error,
            format!("{ptr}/style/mask"),
            error.to_string()
        );
    }
}

/// Semantic validation of `effects[]` (§6.6), `style.blendMode`, and `style.clipPath`.
///
/// The vocabulary comes from the built-in registry of `motion::effect` — lint and rendering read the same manifest, so there is no second source of truth where "lint accepts, rendering errors".
pub(crate) fn lint_effects(
    el: &Value,
    ptr: &str,
    rule: &'static str,
    profile: LintProfile,
    out: &mut Vec<Diagnostic>,
) {
    if let Some(mode) = el
        .get_("style")
        .and_then(|s| s.get_("blendMode"))
        .filter(|v| !v.is_null())
    {
        let ok = mode
            .as_str()
            .is_some_and(|text| motion::effect::BlendMode::parse(text).is_some());
        if !ok {
            diag!(
                out,
                rule,
                Severity::Error,
                format!("{ptr}/style/blendMode"),
                format!("blendMode {mode} is not in the closed set {:?} (§6.6)", blend_modes())
            );
        }
    }
    if let Some(clip) = el
        .get_("style")
        .and_then(|s| s.get_("clipPath"))
        .filter(|v| !v.is_null())
        && let Err(error) = match crate::resolve::ClipPoly::parse(clip) {
            // The `path` shape is only legal on static style (§6.3)
            Ok(Some(_)) => Ok(()),
            Ok(None) => crate::resolve::ClipShape::parse(clip).map(|_| ()),
            Err(error) => Err(error),
        }
    {
        let msg = error.to_string();
        diag!(
            out,
            if msg.starts_with("effect-capability-unsupported") {
                "effect-capability-unsupported"
            } else if msg.starts_with("path-command-unsupported") {
                "path-command-unsupported"
            } else {
                rule
            },
            Severity::Error,
            format!("{ptr}/style/clipPath"),
            msg
        );
    }
    lint_style_values(el, ptr, rule, out);
    for field in ["effects", "backdropEffects"] {
        let Some(effects) = el.get_(field).filter(|v| !v.is_null()) else {
            continue;
        };
        let Some(items) = effects.as_array() else {
            diag!(
                out,
                rule,
                Severity::Error,
                format!("{ptr}/{field}"),
                "effects must be an array (§6.6)".to_string()
            );
            continue;
        };
        for (index, item) in items.iter().enumerate() {
            let eptr = format!("{ptr}/{field}/{index}");
            let Some(id) = item.gstr("preset") else {
                diag!(
                    out,
                    rule,
                    Severity::Error,
                    eptr,
                    "effects[] entry is missing preset (§6.6)".to_string()
                );
                continue;
            };
            let version = match item.get_("presetVersion") {
                Some(value) if !value.is_null() => match value.as_u64() {
                    Some(v) => v as u32,
                    None => {
                        diag!(
                            out,
                            rule,
                            Severity::Error,
                            format!("{eptr}/presetVersion"),
                            "presetVersion must be an integer".to_string()
                        );
                        continue;
                    }
                },
                _ => 1,
            };
            let manifest = match motion::effect::lookup(id, version) {
                Ok(manifest) => manifest,
                Err(error) => {
                    let msg = error.to_string();
                    diag!(out, resolve_error_code(&msg), Severity::Error, eptr, msg);
                    continue;
                }
            };
            // Domains beyond single-input filters (dual-input masks, composite tables) cannot be attached directly to an element.
            if manifest.inputs != 1 || (field == "backdropEffects" && !id.starts_with("filter.")) {
                diag!(
                    out,
                    "effect-capability-unsupported",
                    Severity::Error,
                    format!("{eptr}/preset"),
                    format!(
                        "{} needs {} inputs, but the element effect stack provides only 1 (§6.6); to mask with another element, write style.mask: {{ source: \"#id\", mode }} (§6.3)",
                        manifest.qualified(),
                        manifest.inputs
                    )
                );
                continue;
            }
            // `visual` / `backend` levels do not promise bit-identical output; they must be made visible before export (§14.6).
            if manifest.determinism != motion::effect::Determinism::Strict {
                match profile {
                    LintProfile::Document | LintProfile::Sketch => diag!(
                        out,
                        "effect-determinism-visual",
                        Severity::Info,
                        eptr.clone(),
                        format!(
                            "{} has determinism level {}, so the export does not promise bit-identical output (§14.6)",
                            manifest.qualified(),
                            manifest.determinism.as_str()
                        )
                    ),
                }
            }
            if let Err(error) = crate::resolve::parse_effects(&Value::Array(vec![item.clone()])) {
                let msg = error.to_string();
                diag!(out, resolve_error_code(&msg), Severity::Error, eptr, msg);
            }
        }
    }
}

/// Spec §16 / ADR-M13: 0.1 documents using "experimental" fields emit info. After upgrading to `ccut: "0.2"` these fields become formal, and this rule goes silent.
const EXPERIMENTAL_FIELDS: &[(&str, &str)] = &[
    ("/animate/flow", "animate.flow (§7.5)"),
    ("/animate/parts", "animate.parts (§7.9)"),
    ("/split", "split (§7.9)"),
    ("/effects", "effects (§6.6)"),
    ("/style/blendMode", "style.blendMode (§6.6)"),
    ("/states", "states (§7.9)"),
    ("/constraints", "constraints (§7.9)"),
    ("/layoutStates", "layoutStates (§7.9)"),
];

/// Executable content keys that must never appear in a document (spec §16 `motion-shader-inline`, ADR-M07). BCF is pure data: there is no shader source, no script, and no expression language.
const EXECUTABLE_KEYS: &[&str] = &[
    "shader",
    "glsl",
    "wgsl",
    "sksl",
    "metal",
    "script",
    "eval",
    "expression",
];

fn json_pointer_of(field: &str) -> &str {
    field.rsplit('/').next().unwrap_or(field)
}

/// `experimental-field` (info) + curve objects. Only called when `ccut == "0.1"`.
fn lint_experimental_fields(el: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    for (field, label) in EXPERIMENTAL_FIELDS {
        let present = match field.rsplit_once('/') {
            Some(("", key)) => el.get_(key).is_some_and(|v| !v.is_null()),
            Some((parent, key)) => el
                .get_(json_pointer_of(parent))
                .and_then(|p| p.get_(key))
                .is_some_and(|v| !v.is_null()),
            None => el.get_(field).is_some_and(|v| !v.is_null()),
        };
        if present {
            diag!(
                out,
                "experimental-field",
                Severity::Info,
                format!("{ptr}{field}"),
                format!("{label} is an experimental field in ccut 0.1; it becomes stable in \"0.2\" (ADR-M13)")
            );
        }
    }
    // Curve objects (§7.6) are likewise an experimental shape: the 0.1 closed enum only has names.
    if let Some(animate) = el.get_("animate") {
        if has_curve_object(animate) {
            diag!(
                out,
                "experimental-field",
                Severity::Info,
                format!("{ptr}/animate"),
                "structured curve objects (cubicBezier / steps / spring in §7.6) are an experimental form in ccut 0.1"
                    .to_string()
            );
        }
    }
}

fn has_curve_object(value: &Value) -> bool {
    match value {
        Value::Object(map) => {
            for key in ["curve", "ease"] {
                if map.get(key).is_some_and(Value::is_object) {
                    return true;
                }
            }
            map.values().any(has_curve_object)
        }
        Value::Array(items) => items.iter().any(has_curve_object),
        _ => false,
    }
}

/// `motion-shader-inline` (error): shader source or other executable definitions appear within the document.
fn lint_executable_content(value: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    match value {
        Value::Object(map) => {
            for (key, item) in map {
                if EXECUTABLE_KEYS.contains(&key.as_str()) {
                    diag!(
                        out,
                        "motion-shader-inline",
                        Severity::Error,
                        format!("{ptr}/{key}"),
                        format!(
                            "field \"{key}\" is executable content; BCF is a pure data format, so effects may only reference named recipes (§14.6)"
                        )
                    );
                }
                lint_executable_content(item, &format!("{ptr}/{key}"), out);
            }
        }
        Value::Array(items) => {
            for (index, item) in items.iter().enumerate() {
                lint_executable_content(item, &format!("{ptr}/{index}"), out);
            }
        }
        _ => {}
    }
}

/// `motion-legacy-and-flow` (error) and `split-line-unsupported` (error).
fn lint_flow_structure(el: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    if let Some(animate) = el.get_("animate") {
        let has_flow = animate.get_("flow").is_some_and(|v| !v.is_null());
        let legacy: Vec<&str> = crate::resolve::LEGACY_ANIMATE_SLOTS
            .iter()
            .copied()
            .filter(|slot| animate.get_(slot).is_some_and(|v| !v.is_null()))
            .collect();
        if has_flow && !legacy.is_empty() {
            diag!(
                out,
                "motion-legacy-and-flow",
                Severity::Error,
                format!("{ptr}/animate/flow"),
                format!("an element must not declare both animate.flow and {legacy:?} (§7.5)")
            );
        }
        if animate.get_("parts").is_some_and(|v| !v.is_null()) && el.gstr("type") != Some("text") {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/animate/parts"),
                "animate.parts can only be used on text nodes (§7.9)".to_string()
            );
        }
    }
    if let Some(split) = el.get_("split").filter(|v| !v.is_null()) {
        if let Err(error) = crate::resolve::parse_split_unit(split) {
            let msg = error.to_string();
            diag!(
                out,
                resolve_error_code(&msg),
                Severity::Error,
                format!("{ptr}/split/by"),
                msg
            );
        }
    }
}

/// `style.x` / `style.y` on the clip root element have no effect: `layout::layout_tree` pins the root node's box at the canvas origin, and `x` / `y` are only read when a parent places its children (§7). Only the statically written value is checked — writing 0 or a `$` reference (whose value only resolve knows) is not reported; displacement in `animate` is another channel and is not handled here.
fn lint_clip_root_xy(clip: &Value, root: &Value, root_ptr: &str, out: &mut Vec<Diagnostic>) {
    let Some(style) = root.get_("style").and_then(Value::as_object) else {
        return;
    };
    let ignored = |key: &str| -> Option<String> {
        match style.get(key)? {
            Value::Number(n) if n.as_f64() != Some(0.0) => Some(n.to_string()),
            Value::String(s) => {
                let t = s.trim();
                let zero = t
                    .trim_end_matches(|c: char| c.is_ascii_alphabetic() || c == '%')
                    .parse::<f64>()
                    .is_ok_and(|v| v == 0.0);
                (!t.starts_with('$') && !zero).then(|| format!("\"{s}\""))
            }
            _ => None,
        }
    };
    let found: Vec<(&str, String)> = ["x", "y"]
        .into_iter()
        .filter_map(|key| ignored(key).map(|value| (key, value)))
        .collect();
    let Some((first, _)) = found.first() else {
        return;
    };
    let written = found
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join(", ");
    diag!(
        out,
        "clip-root-xy-ignored",
        Severity::Warn,
        format!("{root_ptr}/style/{first}"),
        format!(
            "clip \"{}\" root element sets style.{written}, but the clip root is always laid out from the canvas origin, so x/y have no effect; \
             to position it, wrap it in a full-frame Box (style width/height = canvas) as a child, then set x/y on that child",
            clip.gstr("id").unwrap_or("?")
        )
    );
}

/// Element id discipline: ids are unique within one tree (error), and addressable elements should have ids (warn).
///
/// The scope is a **single element tree** (one clip's `element`, or one component's `root`) — element paths are already counted from the clip root, so same-named ids across clips do not make paths ambiguous.
fn lint_element_ids(root: &Value, root_ptr: &str, out: &mut Vec<Diagnostic>) {
    let mut seen: HashMap<String, String> = HashMap::new();
    walk_element_ids(root, root_ptr, &mut seen, out);
}

fn walk_element_ids(
    el: &Value,
    ptr: &str,
    seen: &mut HashMap<String, String>,
    out: &mut Vec<Diagnostic>,
) {
    match crate::editpath::stable_id(el) {
        Some(id) => {
            if let Some(first) = seen.get(id) {
                diag!(
                    out,
                    "element-id-duplicate",
                    Severity::Error,
                    format!("{ptr}/id"),
                    format!(
                        "element id \"{id}\" is duplicated in the same element tree (first seen at {first}); element paths would point to two nodes"
                    )
                );
            } else {
                seen.insert(id.to_string(), ptr.to_string());
            }
        }
        None => {
            // Containers and purely decorative nodes can render without ids; they are just not addressable: report warn and do not block export.
            diag!(
                out,
                "element-id-missing",
                Severity::Warn,
                ptr.to_string(),
                format!(
                    "{} element has no stable id, so stage editing can only address it by index (reordering breaks the match)",
                    el.gstr("type").unwrap_or("?")
                )
            );
        }
    }
    let mut local_seen = HashMap::new();
    let seen = if el.gstr("type") == Some("composition") {
        &mut local_seen
    } else {
        seen
    };
    for (i, c) in el
        .get_("children")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        walk_element_ids(c, &format!("{ptr}/children/{i}"), seen, out);
    }
}

fn lint_element(
    el: &Value,
    ptr: &str,
    asset_kinds: &HashMap<String, AssetKind>,
    experimental: bool,
    profile: LintProfile,
    out: &mut Vec<Diagnostic>,
) {
    let t = el.gstr("type").unwrap_or("");
    lint_node_type(el, ptr, NODE_TYPES, "schema", out);
    if let Some(want) = match t {
        "image" => Some(AssetKind::Image),
        "animatedImage" => Some(AssetKind::AnimatedImage),
        "lottie" => Some(AssetKind::Lottie),
        "program" => Some(AssetKind::Program),
        "video" => Some(AssetKind::Video),
        _ => None,
    } {
        lint_media_src(
            el.get_("src"),
            want,
            &format!("{ptr}/src"),
            asset_kinds,
            out,
        );
    }
    if matches!(t, "video" | "animatedImage" | "lottie" | "program") {
        lint_video_fields(el, ptr, out);
    }
    if matches!(t, "animatedImage" | "lottie" | "program") {
        // None of the three has an audio track: `withAudio` / `volume` here are written wrong, not silently effective
        for key in ["withAudio", "volume"] {
            if el.get_(key).is_some_and(|v| !v.is_null()) {
                diag!(
                    out,
                    "schema",
                    Severity::Error,
                    format!("{ptr}/{key}"),
                    format!("{t} has no audio track and does not accept {key} (§6.5.1 – §6.5.3)")
                );
            }
        }
    }
    if t == "path" {
        lint_path(el, ptr, out);
    }
    if t == "text" {
        lint_text_content(el, ptr, asset_kinds, out);
    }
    lint_clip_path_shape(el, ptr, out);
    lint_style_keys(el, ptr, "schema", out);
    lint_layout_align(el, ptr, out);
    lint_animate(el, ptr, "schema", out);
    lint_effects(el, ptr, "schema", profile, out);
    lint_flow_structure(el, ptr, out);
    if experimental {
        lint_experimental_fields(el, ptr, out);
    }
    if t != "svg" {
        // The geometry of a path is resolved in the Svg's viewBox; placed elsewhere, it will not be drawn.
        for (i, c) in el
            .get_("children")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            if c.gstr("type") == Some("path") {
                diag!(
                    out,
                    "path-outside-svg",
                    Severity::Warn,
                    format!("{ptr}/children/{i}"),
                    "path only takes effect as a direct child of svg (§6.2.1); this path will not be drawn"
                        .to_string()
                );
            }
        }
    } else {
        // svg children are limited to path (§6.2): layout only converts the viewBox for path and does not measure other nodes; the preview is a real <svg>, and HTML nodes inside it are not drawn. What `use` expands to is not known, so it is not reported.
        for (i, c) in el
            .get_("children")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            let ct = c.gstr("type").unwrap_or("");
            if !matches!(ct, "path" | "use" | "") {
                diag!(
                    out,
                    "svg-child-unsupported",
                    Severity::Warn,
                    format!("{ptr}/children/{i}"),
                    format!(
                        "svg children must be path (§6.2); this {ct} will not be drawn; place it next to svg inside the same group"
                    )
                );
            }
        }
    }
    for (i, c) in el
        .get_("children")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        lint_element(
            c,
            &format!("{ptr}/children/{i}"),
            asset_kinds,
            experimental,
            profile,
            out,
        );
    }
}

/// `align` / `justify` only take effect under `layout: "row" | "column" | "grid"` (§6.3). The default absolute layout places children without `x` / `y` at the top-left of the box, and if those two keys are written they are silently dropped — this is where "text on a rounded card sticks to the top-left corner" comes from; the rendering side and the preview shell both draw it this way, and lint said nothing before. A `layout` given as a `$` reference is not checked, since its value is only known at resolve.
fn lint_layout_align(el: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    let Some(style) = el.get_("style").filter(|style| style.is_object()) else {
        return;
    };
    match style.get("layout").filter(|layout| !layout.is_null()) {
        None => {}
        Some(Value::String(mode)) if mode == "absolute" => {}
        // Effective under row / column / grid; `$` references and invalid values (reported by schema separately) are not guessed here
        Some(_) => return,
    }
    let keys: Vec<&str> = ["align", "justify"]
        .into_iter()
        .filter(|key| style.get(*key).is_some_and(|v| !v.is_null()))
        .collect();
    let Some(first) = keys.first() else {
        return;
    };
    diag!(
        out,
        "layout-align-ignored",
        Severity::Warn,
        format!("{ptr}/style/{first}"),
        format!(
            "{} only takes effect under layout: \"row\" / \"column\" / \"grid\" (§6.3); this node uses the default absolute layout, so children without x / y still sit at the top left. To center children in the box, add layout: \"column\" (or use <Column> in the DSL)",
            keys.join(" / ")
        )
    );
}

/// Text is single-line (§6.2): `\n` does not wrap, and `textAlign` also has no effect (the legacy single-line path always centers). Color emoji are rasterized by color fonts into bitmaps (§14.4 `DrawBitmap`), and are only reported in strict font mode (the document declares a `font` asset, §11.2): in that mode the system emoji font does not participate in fallback, and a document without a color emoji font has missing glyphs. Lint cannot see font bytes, so documents that have declared a color font still receive this.
/// Content of `$` references is only known at resolve, so it is not checked; `textAlign` is independent of content and is checked.
fn lint_text_content(
    el: &Value,
    ptr: &str,
    asset_kinds: &HashMap<String, AssetKind>,
    out: &mut Vec<Diagnostic>,
) {
    // Explicit `style.textWrap` or `split.by: "line"` enables multi-line typesetting (§6.2.2): `\n` is a hard break, and `textAlign` takes effect. Both are only reported when not enabled.
    let paragraph = el
        .get_("style")
        .and_then(|style| style.get("textWrap"))
        .is_some_and(|wrap| !wrap.is_null())
        || el
            .get_("split")
            .and_then(|split| split.gstr("by"))
            .is_some_and(|by| by == "line");
    // The legacy single-line path centers the whole line within the element box and does not read textAlign; even its values are not validated. `$` references need resolve to know their value, so they are not checked.
    let align = el
        .get_("style")
        .and_then(|style| style.get("textAlign"))
        .filter(|v| !v.is_null() && !v.as_str().is_some_and(|s| s.starts_with('$')));
    if let Some(align) = align.filter(|v| v.as_str() != Some("center") && !paragraph) {
        diag!(
            out,
            "text-align-needs-wrap",
            Severity::Warn,
            format!("{ptr}/style/textAlign"),
            format!(
                "text without style.textWrap uses the legacy single-line layout (§6.2.2), so textAlign {align} has no effect and the line stays centered in the element box; for left or right alignment, add textWrap: \"none\" (single line, no wrapping) or \"word\" (wraps automatically with width)"
            )
        );
    }
    let Some(text) = el.gstr("text").filter(|s| !s.starts_with('$')) else {
        return;
    };
    if text.contains('\n') && !paragraph {
        diag!(
            out,
            "text-newline",
            Severity::Warn,
            format!("{ptr}/text"),
            "text lays out a single line (§6.2), and \\n does not break the line; for multiple lines, set style.textWrap explicitly (§6.2.2), or put one text per line in a layout: \"column\" box (<Column> in the DSL)".to_string()
        );
    }
    let strict_fonts = asset_kinds
        .values()
        .any(|kind| matches!(kind, AssetKind::Font));
    if !strict_fonts {
        return;
    }
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if looks_like_color_emoji(c, chars.peek().copied()) {
            diag!(
                out,
                "text-emoji-no-glyph",
                Severity::Warn,
                format!("{ptr}/text"),
                format!(
                    "\"{c}\" looks like a color emoji: the document declares font assets, so rendering is in strict font mode (§11.2), where system emoji fonts do not fall back and this glyph will be missing (§6.2). Declare the color emoji font (sbix / CBDT / COLR) as a font asset too, or use an image asset instead; ignore this if already declared. This check guesses by code point and may be a false positive"
                )
            );
            return;
        }
    }
}

/// Codepoint guess for color emoji: main pictographic ranges, regional indicators, colored circles / squares, 🀄 🃏, plus characters followed by U+FE0F (emoji presentation selector).
fn looks_like_color_emoji(c: char, next: Option<char>) -> bool {
    matches!(
        u32::from(c),
        0x1F004
            | 0x1F0CF
            | 0x1F1E6..=0x1F1FF
            | 0x1F300..=0x1F6FF
            | 0x1F7E0..=0x1F7EB
            | 0x1F900..=0x1F9FF
            | 0x1FA70..=0x1FAFF
    ) || next == Some('\u{FE0F}')
}

/// `d` of a path (§6.2.1): an unrecognized command makes the whole thing an error — the old implementation skipped it silently, so the drawn shape would be missing a piece without any hint.
fn lint_path(el: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    let Some(d) = el.gstr("d") else { return };
    let parsed = if d.starts_with('$') {
        crate::svgpath::Parsed::default()
    } else {
        crate::svgpath::parse_checked(d)
    };
    // Variable geometry is validated after evaluation by resolve.
    if !parsed.unsupported.is_empty() {
        let list: Vec<String> = parsed.unsupported.iter().map(char::to_string).collect();
        diag!(
            out,
            "path-command-unsupported",
            Severity::Error,
            format!("{ptr}/d"),
            format!(
                "path.d contains unsupported command {} (supported: M L H V C S Q T A Z and their lowercase relative forms)",
                list.join(" ")
            )
        );
    }
    // A `pathMorph` channel is a no-op when there is no `morphTo` to interpolate to (§6.2.1). Only the keyframes slot is looked at: channels expanded from preset / flow are handled by the rendering side the same way, "no target = original shape".
    let writes_morph = el
        .get_("animate")
        .and_then(|a| a.get_("keyframes"))
        .and_then(Value::as_array)
        .is_some_and(|ks| ks.iter().any(|k| k.gstr("prop") == Some("pathMorph")));
    if writes_morph && el.get_("morphTo").is_none_or(Value::is_null) {
        diag!(
            out,
            "path-morph-no-target",
            Severity::Warn,
            format!("{ptr}/animate/keyframes"),
            "the pathMorph channel needs morphTo target shapes on the same path, otherwise the shape will not change".to_string()
        );
    }
}

/// Three art-discipline rules for the `cadence` sampling domain (spec §7.10 / §16). None fire when no clip in the document is in the sampling domain.
fn lint_cadence(doc: &Value, ir: &crate::resolve::Ir, out: &mut Vec<Diagnostic>) {
    let mut mismatch_reported = false;
    for vc in &ir.visual_clips {
        let Some(fps) = vc.cadence.apply(ir.cadence_fps) else {
            continue;
        };
        let cells = vc.start * fps;
        if (cells - cells.round()).abs() > 1e-6 {
            diag!(
                out,
                "cue-off-grid",
                Severity::Warn,
                format!("/clips/{}/start", vc.id),
                format!(
                    "clip \"{}\" cuts in at {:.4}s, which is not on the {fps}fps drawing grid; the cut lands in the middle of a drawing (nearest grid point: {:.4}s)",
                    vc.id,
                    vc.start,
                    cells.round() / fps
                )
            );
        }
        let ratio = ir.fps / fps;
        if !mismatch_reported && (ratio - ratio.round()).abs() > 1e-6 {
            mismatch_reported = true;
            diag!(
                out,
                "cadence-fps-mismatch",
                Severity::Info,
                "/meta/fps".to_string(),
                format!(
                    "output {}fps is not an integer multiple of the drawing rate {fps}fps, so each drawing's hold length will alternate. Hand-drawn films should output 24fps",
                    ir.fps
                )
            );
        }
    }
    let in_domain = |id: &str| {
        ir.visual_clips
            .iter()
            .any(|vc| vc.id == id && vc.cadence.apply(ir.cadence_fps).is_some())
    };
    let empty = Vec::new();
    for (ti, track) in doc
        .get_("tracks")
        .and_then(Value::as_array)
        .unwrap_or(&empty)
        .iter()
        .enumerate()
    {
        for (ci, clip) in track
            .get_("clips")
            .and_then(Value::as_array)
            .unwrap_or(&empty)
            .iter()
            .enumerate()
        {
            if !clip.gstr("id").is_some_and(in_domain) {
                continue;
            }
            for key in ["transitionIn", "transitionOut"] {
                let preset = clip.get_(key).and_then(|t| t.gstr("preset")).unwrap_or("");
                if matches!(
                    preset,
                    "crossfade" | "bcf.crossfade" | "transition.crossfade"
                ) {
                    diag!(
                        out,
                        "transition-in-sketch",
                        Severity::Warn,
                        format!("/tracks/{ti}/clips/{ci}/{key}"),
                        format!(
                            "a clip in the cadence sampling domain uses {preset}: per-frame blending smears held frames into a continuous fade. Use a hard cut, a one-frame paper-color flash, transition.circleCrop or transition.inkBlot instead"
                        )
                    );
                }
            }
        }
    }
}

/// `narration-idle`: the threshold (seconds) for narration dead air. If narration is speaking but the picture has not changed anywhere for this long, viewers feel the picture has "frozen"; 4 s is roughly a medium-length Chinese line of dialogue.
const NARRATION_IDLE_GAP: f64 = 4.0;
/// Narration clips shorter than this are not checked: pausing for a beat in a one- or two-line transitional remark is normal.
const NARRATION_IDLE_MIN_CLIP: f64 = 6.0;
/// At most this many reports per document; the total count is given in the last one.
const NARRATION_IDLE_MAX_REPORTS: usize = 8;

/// `narration-idle` (warn, spec §16): during narration clip playback, the picture has not changed at all for more than 4 s.
///
/// Only **narration** is checked: an audio clip whose asset `src` lies under `assets/vo/` (the skill's project convention: narration goes into `<project>/assets/vo/`); other audio such as music beds is not checked, so music-first films do not trigger false reports. Sources of "the picture is changing": the start and end instants of visual clips, intervals where a per-node keyframe channel (including per-character part channels and node camera) has different values in adjacent frames, transitions (`wrap_channels` and Surface Transition windows), and the camera track. Channels only count within the render window of the clip they belong to; a single-frame channel counts as one instant. The caption track is not counted — it follows the narration, and counting it would mean the warning could never fire.
/// The window is the interval where narration is **actually speaking**: from clip start until the audio's real length is used up (`start + (media_duration − media_start) / rate`, and not beyond the end declared by the clip). Older projects often close with `@scene.end`, and a freeze after narration has finished is not counted as dead air. The real length is backfilled by host probing via `HostInputs` (`ccut lint` probes audio assets); when no real length is available (not probed, file missing, or cannot be decoded), it falls back to the clip's declared window.
/// The 6 s threshold is also computed against this effective window.
fn lint_narration_idle(doc: &Value, ir: &crate::resolve::Ir, out: &mut Vec<Diagnostic>) {
    use crate::sample::{Channel, Kf};

    let is_narration = |asset_id: &str| {
        doc.get_("assets")
            .and_then(|a| a.get_(asset_id))
            .and_then(|a| a.gstr("src"))
            .is_some_and(|src| src.replace('\\', "/").contains("assets/vo/"))
    };
    let speaking = |ac: &crate::resolve::AudioClip| {
        let mut end = ac.end;
        if ac.media_duration > 0.0 && ac.rate > 0.0 {
            end = end.min(ac.start + (ac.media_duration - ac.media_start).max(0.0) / ac.rate);
        }
        (ac.start, end)
    };
    let windows: Vec<(&str, f64, f64)> = ir
        .audio_clips
        .iter()
        .filter(|ac| is_narration(&ac.asset_id))
        .map(|ac| {
            let (w0, w1) = speaking(ac);
            (ac.id.as_str(), w0, w1)
        })
        .filter(|(_, w0, w1)| w1 - w0 >= NARRATION_IDLE_MIN_CLIP)
        .collect();
    if windows.is_empty() {
        return;
    }

    fn same(a: &Value, b: &Value) -> bool {
        match (a.as_f64(), b.as_f64()) {
            (Some(x), Some(y)) => (x - y).abs() <= 1e-9,
            _ => a == b,
        }
    }
    fn push_frames(frames: &[Kf], lo: f64, hi: f64, spans: &mut Vec<(f64, f64)>) {
        let mut add = |a: f64, b: f64| {
            let (a, b) = (a.max(lo), b.min(hi));
            if a <= b {
                spans.push((a, b));
            }
        };
        if let [only] = frames {
            add(only.t, only.t);
        }
        for pair in frames.windows(2) {
            if !same(&pair[0].v, &pair[1].v) {
                add(pair[0].t.min(pair[1].t), pair[0].t.max(pair[1].t));
            }
        }
    }
    fn push_channels(channels: &[Channel], lo: f64, hi: f64, spans: &mut Vec<(f64, f64)>) {
        for channel in channels {
            push_frames(&channel.frames, lo, hi, spans);
        }
    }
    fn walk(node: &RNode, lo: f64, hi: f64, spans: &mut Vec<(f64, f64)>) {
        push_channels(&node.channels, lo, hi, spans);
        push_frames(&node.local_camera, lo, hi, spans);
        if let Some(parts) = &node.part_motion {
            for channels in &parts.channels {
                push_channels(channels, lo, hi, spans);
            }
        }
        for child in &node.children {
            walk(child, lo, hi, spans);
        }
    }

    // All "change" intervals for the whole film are collected at once and sorted by start; the prefix-maximum end lets each narration window be located by binary search.
    let mut spans: Vec<(f64, f64)> = Vec::new();
    for vc in &ir.visual_clips {
        let (lo, hi) = (vc.render_start, vc.render_end);
        spans.push((vc.start, vc.start));
        spans.push((vc.end, vc.end));
        push_channels(&vc.wrap_channels, lo, hi, &mut spans);
        walk(&vc.tree, lo, hi, &mut spans);
    }
    for cam in &ir.camera_clips {
        push_frames(&cam.frames, cam.start, cam.end, &mut spans);
    }
    for tr in &ir.surface_transitions {
        spans.push((tr.t0 - tr.half, tr.t0 + tr.half));
    }
    spans.sort_by(|a, b| a.0.total_cmp(&b.0));
    let mut reach = Vec::with_capacity(spans.len() + 1);
    reach.push(f64::NEG_INFINITY);
    for (_, end) in &spans {
        let last = *reach.last().unwrap_or(&f64::NEG_INFINITY);
        reach.push(last.max(*end));
    }

    let mut gaps: Vec<(&str, f64, f64)> = Vec::new();
    for (clip, w0, w1) in windows {
        let first = spans.partition_point(|s| s.0 < w0);
        let mut cursor = w0.max(reach[first]);
        for &(s, e) in &spans[first..] {
            if s > w1 {
                break;
            }
            if s - cursor > NARRATION_IDLE_GAP {
                gaps.push((clip, cursor, s));
            }
            cursor = cursor.max(e);
        }
        if w1 - cursor > NARRATION_IDLE_GAP {
            gaps.push((clip, cursor, w1));
        }
    }

    let total = gaps.len();
    for (n, (clip, g0, g1)) in gaps
        .into_iter()
        .take(NARRATION_IDLE_MAX_REPORTS)
        .enumerate()
    {
        let (scene, base) = ir
            .scenes
            .iter()
            .find(|(_, s, e)| g0 >= *s - 1e-9 && g0 < *e - 1e-9)
            .or(ir.scenes.last())
            .map(|(id, s, _)| (id.as_str(), *s))
            .unwrap_or(("?", 0.0));
        let mut message = format!(
            "while narration \"{clip}\" plays in scene \"{scene}\" at {:.2}–{:.2}s (film {g0:.2}–{g1:.2}s), the picture does not change for {:.1}s (>{NARRATION_IDLE_GAP}s); schedule strokes or actions in the gap using this narration's word timing (narration().cue in @cuccut/dsl)",
            g0 - base,
            g1 - base,
            g1 - g0
        );
        if n + 1 == NARRATION_IDLE_MAX_REPORTS && total > NARRATION_IDLE_MAX_REPORTS {
            message.push_str(&format!(
                "; the film has {total} such gaps in total, listing the first {NARRATION_IDLE_MAX_REPORTS}"
            ));
        }
        diag!(
            out,
            "narration-idle",
            Severity::Warn,
            format!("/clips/{clip}"),
            message
        );
    }
}

/// `sketch` profile (spec §16): the art discipline of this style, not an engine limitation. Only looks at the post-resolve node tree — `$theme` has already become colors, and `bind: "literal"` and `bind: "theme"` are treated the same.
fn lint_sketch(doc: &Value, ir: &crate::resolve::Ir, out: &mut Vec<Diagnostic>) {
    use crate::pathstyle::Finish;

    fn key(c: &crate::color::Rgba) -> (u8, u8, u8) {
        (c.r.round() as u8, c.g.round() as u8, c.b.round() as u8)
    }
    fn palette_of(value: &Value, into: &mut Vec<(u8, u8, u8)>) {
        match value {
            Value::String(text) => {
                if let Some(color) = crate::color::Rgba::parse(text) {
                    into.push(key(&color));
                }
            }
            Value::Object(map) => map.values().for_each(|v| palette_of(v, into)),
            Value::Array(items) => items.iter().for_each(|v| palette_of(v, into)),
            _ => {}
        }
    }
    struct Seen {
        finishes: Vec<&'static str>,
        off: Vec<(String, (u8, u8, u8))>,
        texts: Vec<String>,
    }
    fn walk(node: &RNode, palette: &[(u8, u8, u8)], seen: &mut Seen) {
        if node.ntype == "text" {
            seen.texts.push(node.id.clone());
        }
        let mut colors: Vec<(u8, u8, u8)> = Vec::new();
        colors.extend(node.fill.as_ref().map(key));
        colors.extend(node.stroke.as_ref().map(key));
        colors.extend(node.stroke_brush.and_then(|b| b.load).as_ref().map(key));
        if let Some(texture) = &node.texture {
            colors.push(key(&texture.color));
            colors.extend(texture.load.as_ref().map(key));
            let name = match texture.finish {
                Finish::Ink => Some("ink"),
                Finish::Pencil => Some("pencil"),
                Finish::Screen => Some("screen"),
                Finish::Riso => Some("riso"),
                Finish::Wash => Some("wash"),
                Finish::Paint => Some("paint"),
                // flat draws nothing and grain is paper grain: neither counts as a "coloring technique"
                _ => None,
            };
            if let Some(name) = name
                && !seen.finishes.contains(&name)
            {
                seen.finishes.push(name);
            }
        }
        if !palette.is_empty() {
            for color in colors {
                if !palette.contains(&color) && !seen.off.iter().any(|(_, c)| *c == color) {
                    seen.off.push((node.id.clone(), color));
                }
            }
        }
        node.children
            .iter()
            .for_each(|child| walk(child, palette, seen));
    }

    let mut palette = Vec::new();
    if let Some(theme) = doc.get_("theme") {
        palette_of(theme, &mut palette);
    }
    // Closing scene = the last scene in declaration order; only it may contain text (sign-off).
    let signoff_from = ir.scenes.last().map(|(_, start, _)| *start);

    for vc in &ir.visual_clips {
        let mut seen = Seen {
            finishes: Vec::new(),
            off: Vec::new(),
            texts: Vec::new(),
        };
        walk(&vc.tree, &palette, &mut seen);
        let ptr = format!("/clips/{}", vc.id);
        if seen.finishes.len() > 1 {
            diag!(
                out,
                "sketch-mixed-finish",
                Severity::Warn,
                ptr.clone(),
                format!(
                    "clip \"{}\" uses {} texture finishes at once ({}); a shot should use one coloring technique",
                    vc.id,
                    seen.finishes.len(),
                    seen.finishes.join(" / ")
                )
            );
        }
        for (node, (r, g, b)) in seen.off.iter().take(4) {
            diag!(
                out,
                "sketch-color-off-palette",
                Severity::Warn,
                ptr.clone(),
                format!(
                    "clip \"{}\" node \"{node}\" uses #{r:02x}{g:02x}{b:02x}, which is not in any theme palette; take colors from the look",
                    vc.id
                )
            );
        }
        let in_signoff = signoff_from.is_some_and(|from| vc.start >= from - 1e-6);
        if !in_signoff && let Some(first) = seen.texts.first() {
            diag!(
                out,
                "sketch-text-outside-signoff",
                Severity::Warn,
                ptr,
                format!(
                    "clip \"{}\" has text node \"{first}\" ({} in total); hand-drawn films only put text in closing scenes and let the picture carry the rest",
                    vc.id,
                    seen.texts.len()
                )
            );
        }
    }
}

/// `path` shape of `style.clipPath` (§6.3): clipping only has nonzero semantics.
fn lint_clip_path_shape(el: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    let Some(clip) = el.get_("style").and_then(|s| s.get_("clipPath")) else {
        return;
    };
    if clip.gstr("shape") == Some("path") && clip.gstr("fillRule") == Some("evenodd") {
        diag!(
            out,
            "clip-path-evenodd",
            Severity::Warn,
            format!("{ptr}/style/clipPath/fillRule"),
            "a clipPath path shape clips with nonzero; evenodd holes will not take effect, so use subpaths with opposite winding instead"
                .to_string()
        );
    }
}

/// video element media fields (§6.5): playbackRate / segment / loop / fit / withAudio / volume
fn lint_video_fields(el: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    if let Some(r) = el.get_("playbackRate").filter(|v| !v.is_null()) {
        match r.as_f64() {
            Some(x) if x > 0.0 && x.is_finite() => {}
            _ => diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/playbackRate"),
                format!("playbackRate {r} must be positive")
            ),
        }
    }
    if let Some(seg) = el.get_("segment").filter(|v| !v.is_null()) {
        let ok = seg.as_array().is_some_and(|a| {
            a.len() == 2
                && a[0]
                    .as_f64()
                    .is_some_and(|s0| a[1].as_f64().is_some_and(|s1| s0 >= 0.0 && s1 > s0))
        });
        if !ok {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/segment"),
                format!("segment {seg} must be [start, end] with 0 ≤ start < end")
            );
        }
    }
    if let Some(f) = el.gstr("fit") {
        if Fit::parse(f).is_none() {
            diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/fit"),
                format!("fit \"{f}\" is not one of cover|contain|fill")
            );
        }
    }
    for key in ["loop", "withAudio"] {
        if let Some(v) = el.get_(key).filter(|v| !v.is_null()) {
            if !v.is_boolean() {
                diag!(
                    out,
                    "schema",
                    Severity::Error,
                    format!("{ptr}/{key}"),
                    format!("{key} {v} must be a boolean")
                );
            }
        }
    }
    if let Some(v) = el.get_("volume").filter(|v| !v.is_null()) {
        match v.as_f64() {
            Some(x) if (0.0..=1.0).contains(&x) => {}
            _ => diag!(
                out,
                "schema",
                Severity::Error,
                format!("{ptr}/volume"),
                format!("volume {v} must be in [0, 1]")
            ),
        }
    }
}

fn lint_captions(clip: &Value, ptr: &str, out: &mut Vec<Diagnostic>) {
    let lane_ids: HashSet<String> = clip
        .get_("lanes")
        .and_then(Value::as_array)
        .map(|ls| {
            ls.iter()
                .filter_map(|l| l.gstr("id").map(String::from))
                .collect()
        })
        .unwrap_or_default();
    for (ii, it) in clip
        .get_("captions")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .enumerate()
    {
        let iptr = format!("{ptr}/captions/{ii}");
        if let Some(lines) = it.get_("lines").and_then(Value::as_object) {
            for (lane_id, line) in lines {
                if !lane_ids.is_empty() && !lane_ids.contains(lane_id) {
                    diag!(
                        out,
                        "caption-lane-unknown",
                        Severity::Error,
                        format!("{iptr}/lines/{lane_id}"),
                        format!("caption item references undeclared lane \"{lane_id}\"")
                    );
                }
                if let Some(words) = line.get_("words").and_then(Value::as_array) {
                    let text = line.gstr("text").unwrap_or("");
                    let joined: String = words
                        .iter()
                        .filter_map(|w| w.gstr("text"))
                        .collect::<Vec<_>>()
                        .join("");
                    let norm =
                        |s: &str| s.chars().filter(|c| !c.is_whitespace()).collect::<String>();
                    if norm(&joined) != norm(text) {
                        diag!(
                            out,
                            "caption-words-mismatch",
                            Severity::Error,
                            format!("{iptr}/lines/{lane_id}/words"),
                            format!("words joined in order \"{joined}\" do not match text \"{text}\"")
                        );
                    }
                    let mut prev = f64::NEG_INFINITY;
                    for w in words {
                        let t = w.gf64("t").unwrap_or(0.0);
                        if t <= prev {
                            diag!(
                                out,
                                "caption-words-mismatch",
                                Severity::Error,
                                format!("{iptr}/lines/{lane_id}/words"),
                                "word timestamps are not strictly increasing".into()
                            );
                            break;
                        }
                        prev = t;
                    }
                }
            }
        }
    }
}
