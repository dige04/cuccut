//! doc (JSON) → FlatIR (spec §14.1).
//! Step-by-step correspondence with resolveAll in the swift-renderer / index.html prototype:
//!   $ reference resolution → cue table → clip window fixed-point iteration → component/each/stagger expansion
//!   → presets expanded into absolute-time channels → transitions materialized → camera / captions.

use crate::assets::{CoreWord, MediaMeta, asset_ref_id, materialize_assets};
use crate::color::Rgba;
use crate::editpath::{NodeOrigin, OriginEntry, join_path, path_segment};
use crate::json::{JsonExt, clamp};
use crate::sample::{Channel, Kf};
use crate::timeexpr::{self, Mark, TimeExpr};
use anyhow::{Result, anyhow, bail};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::sync::Arc;

// ── $ references and {param} templates ────────────────────────────────────────────

/// Declaration order of the four slots → `Channel::order`. Multiplied by `SLOT_ORDER_STRIDE` to leave room for track ordering inside a recipe (makes the "later declaration overrides" rule of spec §7.1 explicit).
const SLOT_ORDER_ENTER: u32 = 0;
const SLOT_ORDER_EXIT: u32 = 1;
const SLOT_ORDER_EMPHASIS: u32 = 2;
const SLOT_ORDER_KEYFRAMES: u32 = 1000;
const SLOT_ORDER_STRIDE: u32 = 1000;

/// Lifecycle four slots (spec §7.1). Mutually exclusive with `animate.flow` (§7.5).
pub const LEGACY_ANIMATE_SLOTS: &[&str] = &["enter", "exit", "emphasis", "keyframes"];

#[derive(Clone)]
pub struct Ctx {
    pub vars: Map<String, Value>,
    pub theme: Value,
    pub assets: Value,
    pub props: Option<Map<String, Value>>,
    pub extra_delay: f64,
}

pub fn resolve_ref(v: &Value, ctx: &Ctx) -> Value {
    let Some(s) = v.as_str() else {
        return v.clone();
    };
    if let Some(path) = s.strip_prefix('$') {
        let parts: Vec<&str> = path.split('.').collect();
        let Some(head) = parts.first() else {
            return v.clone();
        };
        let mut cur: Option<Value> = match *head {
            "vars" => Some(Value::Object(ctx.vars.clone())),
            "theme" => Some(ctx.theme.clone()),
            "assets" => Some(ctx.assets.clone()),
            "props" => ctx.props.clone().map(Value::Object),
            _ => return v.clone(),
        };
        for k in &parts[1..] {
            cur = cur.and_then(|c| c.get_(k).cloned());
        }
        let Some(c) = cur else { return Value::Null };
        if c.is_null() {
            return Value::Null;
        }
        if let Some(src) = c.get_("src") {
            return src.clone(); // asset entries
        }
        return resolve_ref(&c, ctx); // theme may reference vars
    }
    if let Some(props) = &ctx.props {
        if s.contains('{') {
            // A lone placeholder "{param}" → replaced by the original value
            if let Some(inner) = s.strip_prefix('{').and_then(|t| t.strip_suffix('}')) {
                if !inner.is_empty() && inner.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
                {
                    if let Some(pv) = props.get(inner) {
                        return pv.clone();
                    }
                }
            }
            // String template: “{value} people in total”
            let mut out = s.to_string();
            for (k, pv) in props {
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
            return Value::from(out);
        }
    }
    v.clone()
}

/// `format` for the `textCount` track (spec §7.1): closed key set, with each key's type and range checked individually.
/// The renderer's `fmt_count` applies defaults for missing keys, so the validation is done only here.
fn validate_count_format(format: &Map<String, Value>) -> Result<()> {
    for (key, value) in format {
        let valid = match key.as_str() {
            "prefix" | "suffix" | "negativePrefix" => value.is_string(),
            "grouping" => value.is_boolean(),
            "decimals" | "pad" => value
                .as_f64()
                .is_some_and(|n| (0.0..=20.0).contains(&n) && n.fract() == 0.0),
            _ => bail!(
                "schema: textCount format 未知键 `{key}`（可用 decimals / prefix / suffix / negativePrefix / grouping / pad）"
            ),
        };
        if !valid {
            bail!("schema: textCount format.{key} 类型或范围无效（{value}）");
        }
    }
    Ok(())
}

pub fn deep_resolve(v: &Value, ctx: &Ctx) -> Value {
    match v {
        Value::String(_) => resolve_ref(v, ctx),
        Value::Array(a) => Value::Array(a.iter().map(|x| deep_resolve(x, ctx)).collect()),
        Value::Object(o) => Value::Object(
            o.iter()
                .map(|(k, x)| (k.clone(), deep_resolve(x, ctx)))
                .collect(),
        ),
        _ => v.clone(),
    }
}

// ── IR structures ──────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct VisualClip {
    pub id: String,
    pub screen_space: bool,
    pub start: f64,
    pub end: f64,
    pub render_start: f64,
    pub render_end: f64,
    pub z: f64,
    pub order: usize,
    pub wrap_channels: Vec<Channel>,
    /// Clip-level `cadence` (spec §7.10): overrides `meta.cadence`.
    pub cadence: Cadence,
    pub tree: RNode,
}

#[derive(Clone)]
pub struct CameraClip {
    pub start: f64,
    pub end: f64,
    pub frames: Vec<Kf>,
}

#[derive(Debug, Clone)]
pub struct CapWord {
    pub t: f64,
    pub end: f64,
    pub text: String,
}

/// A word within a line box (word-level highlight unit): `index` points back to `CapLine.words`, and `dx` is the offset from the line's left edge
#[derive(Debug, Clone)]
pub struct CapWordBox {
    pub index: usize,
    pub dx: f64,
    pub text: String,
}

/// Line box produced by deterministic typesetting (laid out in core, drawn only by the three platforms, §8.4).
/// Coordinates are absolute canvas coordinates. `y` excludes the dynamic y offset from the lane's entrance channel.
#[derive(Debug, Clone)]
pub struct CapLineBox {
    /// The text actually drawn for this line
    pub text: String,
    /// Left-edge x of the line
    pub x: f64,
    /// Top y of the content box
    pub y: f64,
    /// Line width (excluding background padding)
    pub w: f64,
    /// Content box height = fontSize * 1.25
    pub h: f64,
    pub ascent: f64,
    pub descent: f64,
    /// Word-level highlight box. Empty for non-word lanes.
    pub words: Vec<CapWordBox>,
}

#[derive(Debug, Clone)]
pub struct CapLine {
    pub text: String,
    pub words: Option<Vec<CapWord>>,
    /// Filled in by `layout::layout_captions`. None = not yet laid out.
    pub boxes: Option<Vec<CapLineBox>>,
}

#[derive(Debug, Clone)]
pub struct CapItem {
    pub at_abs: f64,
    pub until_abs: f64,
    pub lines: HashMap<String, CapLine>,
}

#[derive(Clone)]
pub struct CapLane {
    pub id: String,
    pub font_family: String,
    pub font_size: f64,
    pub font_weight: u16,
    pub color: Rgba,
    pub line_gap: f64,
    pub bg_mode: Option<String>,
    pub bg_color: Rgba,
    pub bg_pad_v: f64,
    pub bg_pad_h: f64,
    pub bg_radius: f64,
    pub hi_color: Option<Rgba>,
    pub hi_transition: f64,
    /// Enter preset template ('%' frames), anchored at each at_abs
    pub enter_kfs: Vec<Value>,
    pub enter_dur: f64,
    pub enter_delay: f64,
    /// Exit preset template ('%' frames), anchored at each until_abs: plays over [until_abs − exit_dur, until_abs].
    /// When empty, the lane fades out as a whole using the clip's `fade` (§8.4).
    pub exit_kfs: Vec<Value>,
    pub exit_dur: f64,
}

impl Default for CapLane {
    fn default() -> Self {
        CapLane {
            id: String::new(),
            font_family: String::new(),
            font_size: 30.0,
            font_weight: 400,
            color: Rgba::WHITE,
            line_gap: 0.0,
            bg_mode: None,
            bg_color: Rgba {
                r: 0.0,
                g: 0.0,
                b: 0.0,
                a: 0.55,
            },
            bg_pad_v: 4.0,
            bg_pad_h: 10.0,
            bg_radius: 6.0,
            hi_color: None,
            hi_transition: 0.1,
            enter_kfs: Vec::new(),
            enter_dur: 0.18,
            enter_delay: 0.0,
            exit_kfs: Vec::new(),
            exit_dur: 0.0,
        }
    }
}

#[derive(Clone)]
pub struct CaptionClip {
    pub start: f64,
    pub end: f64,
    /// Distance from the anchor edge (ratio relative to frame height)
    pub offset: f64,
    pub anchor_top: bool,
    pub gap: f64,
    /// Region layout rectangle [x, y, w, h] (px, canvas coordinates). None = anchor/offset semantics (§3.6).
    pub region: Option<[f64; 4]>,
    /// Growth direction of the line count in region mode. true = upward (rectangle's bottom edge fixed), false = downward (top edge fixed).
    pub grow_up: bool,
    /// Line-wrap width in anchor mode (px). None = no wrapping.
    pub max_width: Option<f64>,
    pub lanes: Vec<CapLane>,
    pub items: Vec<CapItem>,
    pub fade: f64,
}

/// Audio-track clip (spec §8.4): src is already resolved to a logical path, and volume is an absolute-time channel.
/// A video element with `withAudio: true` is also expanded at compile time into one AudioClip (§6.5).
/// In that case `rate` is inherited from the video's playbackRate.
#[derive(Clone)]
pub struct AudioClip {
    pub id: String,
    pub asset_id: String,
    pub start: f64,
    pub end: f64,
    pub media_start: f64,
    /// Media playback rate (audio-track clips are always 1.0; withAudio expansion inherits from the video)
    pub rate: f64,
    /// Native length of the source media (seconds). The host fills it in by probing via [`HostInputs`](crate::HostInputs), the same path as the video node's
    /// `media_duration`. `0` = unknown or unbounded (not probed, probe failed, or a looping withAudio video). Sound ends at `start + (media_duration − media_start) / rate`;
    /// after that, the clip window holds only silence. Rendering mixes by the window as usual and does not read this.
    pub media_duration: f64,
    pub base_volume: f64,
    /// Empty = constant base_volume
    pub volume: Vec<Kf>,
    /// Which audio track this clip came from (§8.4): the track's `id`, or `#<track index>` if no id was written. Clips expanded from `withAudio`
    /// do not belong to any audio track and are `None`. The host uses this to group by track (narration imported as a track). Rendering does not read it.
    pub track: Option<String>,
    /// Fade-in / fade-out duration (seconds, §8.4 `fadeIn` / `fadeOut`). `0` = no fade. A linear amplitude envelope, computed over the declared window [`fade_span`](Self::fade_span). Segments split out by `timeMap` share the original clip's window.
    pub fade_in: f64,
    pub fade_out: f64,
    /// The window the fades are based on (the original clip's `[start, end]`).
    pub fade_span: (f64, f64),
    /// Pan: −1 (full left) .. 1 (full right). Equal-power, so the level does not dip at centre. `0` = no pan.
    pub pan: f64,
    /// Mix bus (§8.4 `bus`; defaults derived from the track id, see [`crate::audio_mix::default_bus`]).
    pub bus: String,
    /// The containing audio track has `muted: true`. Compile keeps this clip (projection and checks still see it), but render / export mix / preview all skip it.
    pub muted: bool,
}

impl AudioClip {
    /// Fade gain `0..=1` at time `t` (absolute seconds). Constantly `1` when no fade is declared.
    pub fn fade_gain(&self, t: f64) -> f64 {
        let (a, b) = self.fade_span;
        let mut g = 1.0;
        if self.fade_in > 0.0 {
            g *= ((t - a) / self.fade_in).clamp(0.0, 1.0);
        }
        if self.fade_out > 0.0 {
            g *= ((b - t) / self.fade_out).clamp(0.0, 1.0);
        }
        g
    }

    /// This clip does not need the new stages of the mix chain: no fades, no panning.
    pub fn is_plain(&self) -> bool {
        self.fade_in <= 0.0 && self.fade_out <= 0.0 && self.pan == 0.0
    }
}

pub use crate::pathstyle::{Cadence, LineCap, LineJoin, PathTexture, PathWobble};

#[derive(Clone)]
pub struct Ir {
    pub total: f64,
    pub fps: f64,
    /// `meta.cadence` (spec §7.10): document-level default drawing frequency. It only quantizes the sampling clock of visual nodes. Clip activation, transition windows, camera, captions, and audio all use real time.
    pub cadence_fps: Option<f64>,
    /// The texture in the object form of `meta.background` (spec §4): fills the canvas and does not move with the camera.
    pub bg_texture: Option<PathTexture>,
    /// Absolute time windows `(id, start, end)` of the scene skeleton, in declaration order. The host uses them to label thumbnails by scene and to find cut points. Rendering does not read them.
    pub scenes: Vec<(String, f64, f64)>,
    pub w: f64,
    pub h: f64,
    pub bg: Rgba,
    pub visual_clips: Vec<VisualClip>,
    pub camera_clips: Vec<CameraClip>,
    pub caption_clips: Vec<CaptionClip>,
    pub audio_clips: Vec<AudioClip>,
    /// Document-level `audio` (§4: bus gain, ducking, mastering). `None` when unspecified, in which case mixing takes the old path, bit-for-bit unchanged.
    pub audio: Option<crate::audio_mix::DocAudio>,
    /// Cut points declared as **Surface Transition** (spec §9). A Motion Transition is materialized as `wrap_channels` on both sides and does not go into this table.
    pub surface_transitions: Vec<SurfaceTransition>,
}

/// A cut point that runs through the `Transition` pass (the second kind of transition in spec §9).
///
/// Both sides are drawn into an offscreen surface each, then composited by a two-input effect driven by `progress`.
/// `progress = (t − (t0 − half)) / (2 × half)`, closed interval `[0, 1]`.
///
/// `fallback_out` / `fallback_in` are **the Motion version of this same cut point**. They are substituted when the backend cannot run this effect, or when the caller takes the flat single-surface path (`ccut ops` / `FrameRenderer::draw`). Degradation happens on the render side, but the channels must be computed at resolve time, because that is where the canvas size and the recipe registry are available.
#[derive(Debug, Clone)]
pub struct SurfaceTransition {
    pub from_clip: String,
    pub to_clip: String,
    pub effect: motion::effect::EffectRef,
    pub uniforms: motion::effect::UniformMap,
    /// Cut point (window centre).
    pub t0: f64,
    /// Half duration. The window is `[t0 − half, t0 + half]`.
    pub half: f64,
    /// Name of the Motion Transition recipe used for degradation (default `crossfade`).
    pub fallback: String,
    pub fallback_out: Vec<Channel>,
    pub fallback_in: Vec<Channel>,
}

impl SurfaceTransition {
    /// Closed interval `[0, 1]`. Returns `None` outside the window.
    ///
    /// The two ends of the window must be computed with the same expressions as the two clips' `render_start = t0 − half` / `render_end = t0 + half`.
    /// Writing it as `(t0 − half) + 2·half` is off by one ulp (with `t0 = 2493/30` and `half = 0.4`, the end becomes `83.49999999999999`). When a frame lands exactly on the end, this would judge it outside the window while the exiting clip is still inside its render window, so that frame flashes back to the exiting picture.
    pub fn progress_at(&self, t: f64) -> Option<f64> {
        if self.half <= 0.0 {
            return None;
        }
        let start = self.t0 - self.half;
        let end = self.t0 + self.half;
        if t < start || t > end {
            return None;
        }
        Some(((t - start) / (end - start)).clamp(0.0, 1.0))
    }
}

// ── Render-tree nodes ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Default)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Fit mode for video elements (§6.5): mapping from the natural size to the layout box.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Fit {
    /// Scale up proportionally, cropping to fill the box (default)
    #[default]
    Cover,
    /// Scale down proportionally, fully visible (letterbox)
    Contain,
    /// Non-proportional stretch to fill
    Fill,
}

impl Fit {
    pub fn parse(s: &str) -> Option<Fit> {
        match s {
            "cover" => Some(Fit::Cover),
            "contain" => Some(Fit::Contain),
            "fill" => Some(Fit::Fill),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RNode {
    pub ntype: String,
    pub char_grid: Option<crate::char_grid::CharGrid>,
    /// Procedural picture source (`type:"proc"`, §6.12): closed-form evaluation of `(local seconds, seed)`.
    pub proc: Option<crate::proc::ProcSource>,
    /// An independent local canvas; instances reuse the existing components/props system.
    pub composition: Option<crate::composition::LocalCanvas>,
    pub time_map: Option<crate::composition::TimeMap>,
    pub media_crop: Option<[f64; 4]>,
    pub media_focal: Option<[f64; 2]>,
    pub local_camera: Vec<Kf>,
    pub id: String,
    pub style: Map<String, Value>,
    pub animate: Option<Value>,
    pub text: Option<String>,
    pub text_runs: Vec<crate::text_layout::Run>,
    pub text_stroke: Option<TextStroke>,
    /// Explicit paragraph layout; absent keeps the legacy single-line contract.
    pub text_wrap: Option<crate::text_layout::Wrap>,
    pub text_block: Option<crate::text_layout::TextBlock>,
    pub path_d: Option<String>,
    /// `morphTo` (spec §6.2.1): target shapes for the `pathMorph` channel, in declaration order.
    pub morph_d: Vec<String>,
    pub stroke: Option<Rgba>,
    pub stroke_width: f64,
    pub fill: Option<Rgba>,
    /// `fillRule: "evenodd"` (spec §6.2.1). Default nonzero.
    pub fill_even_odd: bool,
    /// Render-time texture fill: the clip is inside this path, generated in path-local coordinates, with no time dependency.
    pub texture: Option<PathTexture>,
    /// Stroke jitter (the fill does not jitter, so the fill and outline never drift apart).
    pub wobble: Option<PathWobble>,
    pub line_cap: LineCap,
    pub line_join: LineJoin,
    /// `dash` (in path-local coordinates, even number of entries). Empty = solid line.
    pub dash: Vec<f64>,
    pub dash_offset: f64,
    pub screen_size: bool,
    pub screen_stroke: bool,
    pub path_trim: Option<(f64, f64)>,
    pub stroke_brush: Option<crate::pathstyle::StrokeBrush>,
    pub follow: Option<crate::pathstyle::PathFollow>,
    pub echo: Option<crate::temporal::Echo>,
    /// Node-level `cadence` (spec §7.10).
    pub cadence: Cadence,
    pub view_box: Option<[f64; 4]>,
    pub wrap_layout: Option<Map<String, Value>>,
    /// Author provenance (scheme §4.3): which author node in the TSX/JSON this resolved node points back to.
    /// Registered at the same place where `expand_node` mints derived ids, so consumers do not have to reverse-parse the `-{i}` prefix.
    pub origin: Option<Box<NodeOrigin>>,
    pub extra_delay: f64,
    pub children: Vec<RNode>,
    pub channels: Vec<Channel>,
    /// `split.by` (spec §7.9, experimental field). When `animate.parts` is present and `split` is not written, the default is `grapheme`. `line` is computed from the final layout result, so it is compiled after layout.
    pub split: Option<motion::PartUnit>,
    /// Text part animation (phase 3, spec §7.9). `record_text` samples per glyph by part.
    pub part_motion: Option<PartMotion>,
    pub pending_line_motion: Option<PendingLineMotion>,
    /// Effect stack (spec §6.6). Non-empty ⇒ the element and its subtree are first drawn into an offscreen surface, each `Filter` pass runs in turn, and the result is composited back onto the parent surface by `blend` / opacity.
    pub effects: Vec<ResolvedEffect>,
    /// Filters of the already composed lower siblings, clipped to this node box.
    pub backdrop_effects: Vec<ResolvedEffect>,
    /// `style.blendMode` (spec §6.6). Anything other than `Normal` ⇒ `PushLayer{blend}` is emitted at record time.
    pub blend: motion::effect::BlendMode,
    /// Static shape of `style.clipPath` (spec §6.3). When a `clipPath` channel exists, it overrides this per frame.
    pub clip_shape: Option<ClipShape>,
    /// The `path` shape of `style.clipPath` (spec §6.3). It can only be declared statically, not via a channel.
    pub clip_poly: Option<ClipPoly>,

    // Media nodes (image / video)
    pub asset_id: Option<String>,
    pub media_start: f64,
    /// Media time = t - media_t0 (back-filled by build_channels from the clip window; holds when rate=1)
    pub media_t0: f64,
    /// Start of the host clip window (clip.start in the §6.5 srcTime formula)
    pub media_win_start: f64,
    pub nat_w: f64,
    pub nat_h: f64,

    // video media semantics (§6.5)
    pub playback_rate: f64,
    pub segment: Option<(f64, f64)>,
    pub loop_media: bool,
    pub fit: Fit,
    pub with_audio: bool,
    /// Static volume for withAudio expansion
    pub media_volume: f64,
    /// Source frame rate / source duration (host-probed; 0 = unknown, and sampling degrades to continuous time)
    pub media_fps: f64,
    pub media_duration: f64,

    // animatedImage / lottie / program media semantics (§6.5.1 – §6.5.3)
    /// Per-frame **start** millisecond table (N+1 entries, the last entry is the total duration). The host fills it in by probing.
    /// At record time, source time is quantized to frame starts using it.
    pub frame_starts_ms: Arc<[i64]>,
    /// Effective number of play passes (`0` = infinite). If the element sets `loop`, it uses `loop` (`true` → 0, `false` → 1). If not set, it inherits the asset's own loop count.
    pub media_plays: u32,

    // Static transform initial values (style; filled by layout::prepare)
    pub base_scale: f64,
    pub base_scale_x: Option<f64>,
    pub base_scale_y: Option<f64>,
    pub base_rotation: f64,
    pub base_opacity: f64,
    pub anchor: String,
    /// `style.anchor: [x, y]` (element box proportions). When set, it overrides the `anchor` enum.
    pub anchor_xy: Option<(f64, f64)>,

    // Layout results (filled by the layout module)
    pub frame: Rect,
    pub intrinsic_cache: Option<(f64, f64)>,
    pub svg_scale: f64,
    pub subpaths: Vec<Vec<(f64, f64)>>,
    /// Polylines for each `morphTo` target shape (already multiplied by `svg_scale`). Topology matches `subpaths` point for point.
    pub morph_shapes: Vec<Vec<Vec<(f64, f64)>>>,
    pub total_len: f64,
    pub text_w: f64,
    pub text_asc: f64,
    pub text_desc: f64,
    pub font_size: f64,
    pub font_weight: u16,
    /// style.font (`$theme` already resolved). Empty = default sans-serif family
    pub font_family: String,
    pub text_color: Rgba,
    pub bg_color: Option<Rgba>,
    /// Gradient form of `style.background`. Mutually exclusive with `bg_color` (§6.3).
    pub bg_gradient: Option<BgGradient>,
    pub border_radius: f64,
    /// `style.border` (§6.3): a stroke ring on the inside of the box.
    pub border: Option<BoxBorder>,
    /// `style.fontStyle: "italic"` (§6.3): takes part in font matching and shaping.
    pub font_italic: bool,
    /// `style.mask` (§6.3): uses another element in the same clip as a mask.
    pub mask: Option<ElementMask>,
    /// This node is named by some `style.mask.source`. It is a mask definition and is not drawn in the normal flow.
    pub mask_source: bool,
}

/// Author-provenance context carried during expansion (scheme §4.3).
///
/// It flows only along the `expand_node` chain. On entering a component it switches to component-local coordinates (`authored` restarts from the component root), and `site` / `index` record the instantiation point. It does not revert on exit: a resolved node either belongs wholly to some component instance, or not at all.
#[derive(Debug, Clone)]
pub(crate) struct OriginCtx {
    pub(crate) path: String,
    component: Option<String>,
    site: Option<String>,
    index: Option<usize>,
}

impl OriginCtx {
    pub(crate) fn root() -> Self {
        Self {
            path: String::new(),
            component: None,
            site: None,
            index: None,
        }
    }

    fn origin(&self) -> NodeOrigin {
        NodeOrigin {
            authored: self.path.clone(),
            component: self.component.clone(),
            site: self.site.clone(),
            index: self.index,
        }
    }

    fn child(&self, segment: &str) -> Self {
        Self {
            path: join_path(&self.path, segment),
            ..self.clone()
        }
    }

    /// Entering the `index`-th instance of `use`: author coordinates switch to the component root, and the instantiation point is the current path.
    fn instance(&self, component: &str, index: usize) -> Self {
        Self {
            path: String::new(),
            component: Some(component.to_string()),
            // For a component nested inside a component, site records the **outermost** instantiation point, because that is the position the author can edit.
            site: Some(self.site.clone().unwrap_or_else(|| self.path.clone())),
            index: Some(self.index.unwrap_or(index)),
        }
    }
}

/// Compiled output → **stage-space projection** (one of the two hops of the BCF direct-edit write-back, scheme §4.3).
///
/// The UI hits nodes after component expansion and `$` reference resolution, whereas the edit-map refers to positions the author wrote in the TSX. This is the intermediate layer: a doc-shaped JSON whose `tracks[].clips[].element` is the expanded element tree, each node carrying `_origin` (author provenance). Hence [`crate::editpath::locate_element`] works on it as usual, and the client only needs **one set of addresses** (stage paths). Mapping back to author nodes is the server's job.
///
/// Only visual tracks are projected, since those are the objects of stage editing. It does not run layout and needs no host inputs, so it works even with missing fonts or media (an `image` node's `src` is still written back as a `$assets.*` reference).
pub fn stage_projection(doc: &Value) -> Result<Value> {
    let resolver = Resolver::new(doc.clone(), None)?;
    let ctx = resolver.ctx.clone();
    let empty = Vec::new();
    let mut tracks = Vec::new();
    for tr in doc
        .get_("tracks")
        .and_then(Value::as_array)
        .unwrap_or(&empty)
    {
        if tr.gstr("kind") != Some("visual") {
            continue;
        }
        let mut clips = Vec::new();
        for c in tr.get_("clips").and_then(Value::as_array).unwrap_or(&empty) {
            let (Some(id), Some(el)) = (c.gstr("id"), c.get_("element")) else {
                continue;
            };
            let tree = resolver.expand_node(el, &ctx)?;
            clips.push(serde_json::json!({ "id": id, "element": node_view(&tree) }));
        }
        tracks.push(serde_json::json!({
            "id": tr.gstr("id").unwrap_or(""),
            "kind": "visual",
            "clips": clips,
        }));
    }
    Ok(serde_json::json!({ "tracks": tracks }))
}

/// JSON view of a single resolved node (field names match the spec layer, so addressing is unchanged).
fn node_view(n: &RNode) -> Value {
    let mut out = Map::new();
    out.insert("type".into(), Value::String(n.ntype.clone()));
    out.insert("id".into(), Value::String(n.id.clone()));
    out.insert("style".into(), Value::Object(n.style.clone()));
    if !n.text_runs.is_empty() {
        let text = n.text.as_deref().unwrap_or("");
        out.insert(
            "runs".into(),
            Value::Array(
                n.text_runs
                    .iter()
                    .map(|run| {
                        serde_json::json!({
                            "text":&text[run.bytes.clone()],"style":run.style
                        })
                    })
                    .collect(),
            ),
        );
    } else if let Some(text) = &n.text {
        out.insert("text".into(), Value::String(text.clone()));
    }
    if let Some(animate) = &n.animate {
        out.insert("animate".into(), animate.clone());
    }
    if let Some(asset) = &n.asset_id {
        out.insert("src".into(), Value::String(format!("$assets.{asset}")));
    }
    if let Some(grid) = &n.char_grid
        && let Some(fields) = grid.source.as_object()
    {
        out.extend(fields.clone());
    }
    if let Some(proc) = &n.proc
        && let Some(fields) = proc.source.as_object()
    {
        out.extend(fields.clone());
    }
    if let Some(canvas) = &n.composition {
        out.insert("canvas".into(), serde_json::json!({"width":canvas.width,"height":canvas.height,"duration":canvas.duration}));
    }
    if let Some(map) = &n.time_map {
        out.insert(
            "timeMap".into(),
            Value::Array(
                map.points
                    .iter()
                    .map(|(t, source)| serde_json::json!({"t":t,"source":source}))
                    .collect(),
            ),
        );
    }
    if !n.local_camera.is_empty() {
        out.insert(
            "camera".into(),
            Value::Array(
                n.local_camera
                    .iter()
                    .map(|f| serde_json::json!({"t":f.t,"v":f.v,"ease":f.ease}))
                    .collect(),
            ),
        );
    }
    if let Some([x, y, width, height]) = n.media_crop {
        out.insert(
            "crop".into(),
            serde_json::json!({"x":x,"y":y,"width":width,"height":height}),
        );
    }
    if let Some([x, y]) = n.media_focal {
        out.insert("focalPoint".into(), serde_json::json!({"x":x,"y":y}));
    }
    if let Some((start, end)) = n.path_trim {
        out.insert("trim".into(), serde_json::json!({"start":start,"end":end}));
    }
    if n.dash_offset != 0.0 {
        out.insert("dashOffset".into(), Value::from(n.dash_offset));
    }
    if let Some(brush) = n.stroke_brush {
        let kind = match brush.kind {
            crate::pathstyle::BrushKind::Clean => "clean",
            crate::pathstyle::BrushKind::Pencil => "pencil",
            crate::pathstyle::BrushKind::Ink => "ink",
            crate::pathstyle::BrushKind::Paint => "paint",
        };
        let mut value =
            serde_json::json!({"kind":kind,"seed":brush.seed,"roughness":brush.roughness});
        if brush.kind == crate::pathstyle::BrushKind::Paint {
            value["dry"] = Value::from(brush.dry);
            if let Some(load) = brush.load {
                value["load"] = Value::from(load.css());
            }
        }
        out.insert("brush".into(), value);
    }
    if let Some(follow) = &n.follow {
        let position = match follow.position {
            crate::pathstyle::FollowPosition::Start => Value::from("start"),
            crate::pathstyle::FollowPosition::End => Value::from("end"),
            crate::pathstyle::FollowPosition::Progress(p) => Value::from(p),
        };
        out.insert("follow".into(),serde_json::json!({"source":format!("#{}",follow.source),"position":position,"offset":follow.offset,"rotate":follow.rotate}));
    }
    if n.screen_size {
        out.insert("sizeScale".into(), Value::from("screen"));
    }
    if n.screen_stroke {
        out.insert("strokeScale".into(), Value::from("screen"));
    }
    if let Some(echo) = &n.echo {
        out.insert("echo".into(),serde_json::json!({"mode":if echo.mode==crate::temporal::EchoMode::Over {"over"}else{"average"},"samples":echo.samples.iter().map(|(offset,weight)|serde_json::json!({"offset":offset,"weight":weight})).collect::<Vec<_>>()}));
    }
    if let Some(origin) = &n.origin {
        out.insert("_origin".into(), origin.to_json());
    }
    if !n.children.is_empty() {
        out.insert(
            "children".into(),
            Value::Array(n.children.iter().map(node_view).collect()),
        );
    }
    Value::Object(out)
}

/// Resolved tree → reverse lookup table (scheme §4.3-2).
///
/// The key is the resolved **path**, not the resolved id. Multiple instances of a component share the component root's id, so the id is naturally duplicated in the tree, and only the path is unique.
pub fn edit_origins(root: &RNode) -> Vec<OriginEntry> {
    let mut out = Vec::new();
    walk_origins(root, String::new(), &mut out);
    out
}

fn walk_origins(node: &RNode, path: String, out: &mut Vec<OriginEntry>) {
    out.push(OriginEntry {
        resolved: path.clone(),
        id: node.id.clone(),
        origin: node.origin.as_deref().cloned().unwrap_or_default(),
    });
    for (i, child) in node.children.iter().enumerate() {
        let seg = resolved_segment(&node.children, i);
        walk_origins(child, join_path(&path, &seg), out);
    }
}

/// Same rules as [`crate::editpath::path_segment`], but applied to the resolved tree.
fn resolved_segment(siblings: &[RNode], index: usize) -> String {
    let fallback = format!("{}{index}", crate::editpath::INDEX_PREFIX);
    let Some(node) = siblings.get(index) else {
        return fallback;
    };
    let id = node.id.as_str();
    if id.is_empty() || id.contains('/') || id.starts_with(crate::editpath::INDEX_PREFIX) {
        return fallback;
    }
    let unique = siblings
        .iter()
        .enumerate()
        .all(|(i, other)| i == index || other.id != id);
    if unique { id.to_string() } else { fallback }
}

/// Compiled output of text part animation (design §5.6).
///
/// Each part gets a **group of channels** (rather than one `MotionProgram`). Relative lengths therefore take the same path as element channels, evaluated after layout (`build_channels_after_layout`), and `record_text` only needs `sample_channels`, with no compilation at record time.
#[derive(Debug, Clone)]
pub struct PartMotion {
    pub map: motion::PartMap,
    /// Indices align with `map.ranges`. An empty `Vec` = this part has no tracks at this moment.
    pub channels: Vec<Vec<Channel>>,
}

#[derive(Debug, Clone)]
pub struct PendingLineMotion {
    pub spec: Value,
    pub context: motion::CompileCtx,
    pub extra: f64,
}

impl Default for RNode {
    fn default() -> Self {
        RNode {
            ntype: "box".into(),
            char_grid: None,
            proc: None,
            composition: None,
            time_map: None,
            media_crop: None,
            media_focal: None,
            local_camera: Vec::new(),
            id: String::new(),
            style: Map::new(),
            animate: None,
            text: None,
            text_runs: Vec::new(),
            text_stroke: None,
            text_wrap: None,
            text_block: None,
            path_d: None,
            morph_d: Vec::new(),
            stroke: None,
            stroke_width: 0.0,
            fill: None,
            fill_even_odd: false,
            texture: None,
            wobble: None,
            line_cap: LineCap::default(),
            line_join: LineJoin::default(),
            dash: Vec::new(),
            dash_offset: 0.0,
            screen_size: false,
            screen_stroke: false,
            path_trim: None,
            stroke_brush: None,
            follow: None,
            echo: None,
            cadence: Cadence::Inherit,
            view_box: None,
            wrap_layout: None,
            origin: None,
            extra_delay: 0.0,
            children: Vec::new(),
            channels: Vec::new(),
            split: None,
            part_motion: None,
            pending_line_motion: None,
            effects: Vec::new(),
            backdrop_effects: Vec::new(),
            blend: motion::effect::BlendMode::Normal,
            clip_shape: None,
            clip_poly: None,
            asset_id: None,
            media_start: 0.0,
            media_t0: 0.0,
            media_win_start: 0.0,
            nat_w: 0.0,
            nat_h: 0.0,
            playback_rate: 1.0,
            segment: None,
            loop_media: false,
            fit: Fit::Cover,
            with_audio: false,
            media_volume: 1.0,
            media_fps: 0.0,
            media_duration: 0.0,
            frame_starts_ms: Arc::from(&[][..]),
            media_plays: 0,
            base_scale: 1.0,
            base_scale_x: None,
            base_scale_y: None,
            base_rotation: 0.0,
            base_opacity: 1.0,
            anchor: "center".into(),
            anchor_xy: None,
            frame: Rect::default(),
            intrinsic_cache: None,
            svg_scale: 1.0,
            subpaths: Vec::new(),
            morph_shapes: Vec::new(),
            total_len: 0.0,
            text_w: 0.0,
            text_asc: 0.0,
            text_desc: 0.0,
            font_size: 16.0,
            font_weight: 400,
            font_family: String::new(),
            text_color: Rgba::WHITE,
            bg_color: None,
            bg_gradient: None,
            border_radius: 0.0,
            border: None,
            font_italic: false,
            mask: None,
            mask_source: false,
        }
    }
}

// ── Effect stack, blending and clip shapes (spec §6.6 / §6.3) ─────────────────────

/// A resolved effect recipe reference on an element (spec §6.6).
///
/// `uniforms` has already gone through the manifest's `resolve_uniforms`: defaults filled in, ranges clamped, types validated. **`length`-type parameters are proportions of the canvas short side** (same convention as the manifest's `basis: canvasShortEdge`), so the same document gets proportionally scaled radii and feathering at any frame size.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedEffect {
    pub effect: motion::effect::EffectRef,
    pub uniforms: motion::effect::UniformMap,
}

/// The **gradient** form of `style.background` (spec §6.3).
///
/// Only a structured object is accepted, not a CSS `linear-gradient(...)` string. A string could only be silently drawn as nothing at record time, whereas each field of the object form can be validated at lint time. Colour-stop positions are in [0, 1]. All geometric quantities are **element box proportions**, transforming together with the element.
#[derive(Debug, Clone, PartialEq)]
pub enum BgGradient {
    /// `angle` uses the CSS convention: 0 = bottom to top, 90 = left to right, clockwise is positive.
    Linear { angle: f64, stops: Vec<(f64, Rgba)> },
    /// Centre `(cx, cy)` is in box proportions. `r` is a proportion relative to the **box short side**.
    Radial {
        cx: f64,
        cy: f64,
        r: f64,
        stops: Vec<(f64, Rgba)>,
    },
}

#[derive(Debug, Clone)]
pub struct TextStroke {
    pub width: f64,
    pub color: Option<Rgba>,
    pub gradient: Option<BgGradient>,
}

impl TextStroke {
    pub fn parse(value: &Value) -> Result<Self> {
        let map = value
            .as_object()
            .ok_or_else(|| anyhow!("schema: textStroke 必须是 {{width,paint}} 对象"))?;
        if map.keys().any(|key| key != "width" && key != "paint") {
            bail!("schema: textStroke 只接受 width/paint");
        }
        let width = map
            .get("width")
            .and_then(Value::as_f64)
            .filter(|w| w.is_finite() && *w >= 0.0)
            .ok_or_else(|| anyhow!("schema: textStroke.width 须为非负像素"))?;
        let paint = map
            .get("paint")
            .cloned()
            .unwrap_or_else(|| Value::String("#000000".into()));
        if paint.is_null() {
            bail!("schema: textStroke.paint 需要颜色或渐变");
        }
        let gradient =
            BgGradient::parse(&paint).map_err(|e| anyhow!("schema: textStroke.paint: {e}"))?;
        let color = Rgba::parse_value(Some(&paint));
        Ok(Self {
            width,
            color,
            gradient,
        })
    }
}

impl BgGradient {
    /// Parse `style.background`: a colour string returns `Ok(None)` (handed to `Rgba::parse`), and the object form returns a gradient. A CSS gradient string and an unparseable colour are both `schema` errors.
    pub fn parse(value: &Value) -> Result<Option<BgGradient>> {
        match value {
            Value::Null => Ok(None),
            Value::String(text) => {
                let trimmed = text.trim();
                if trimmed.contains("gradient(") {
                    bail!(
                        "schema: style.background 不接受 CSS 渐变字串 \"{trimmed}\"；\
                         请写对象形态 {{ kind: \"linear\", angle, stops: [{{ at, color }}] }} 或 \
                         {{ kind: \"radial\", cx, cy, r, stops }}（§6.3）"
                    );
                }
                if Rgba::parse(trimmed).is_none() {
                    bail!("schema: style.background \"{trimmed}\" 不是可解析的颜色（§6.3）");
                }
                Ok(None)
            }
            Value::Object(map) => {
                let kind = map.get("kind").and_then(Value::as_str).ok_or_else(|| {
                    anyhow!("schema: style.background 对象形态必须带 kind: \"linear\" | \"radial\"（§6.3）")
                })?;
                let stops = Self::parse_stops(map.get("stops"))?;
                let number = |key: &str, default: f64| -> Result<f64> {
                    match map.get(key) {
                        None | Some(Value::Null) => Ok(default),
                        Some(v) => v.as_f64().filter(|x| x.is_finite()).ok_or_else(|| {
                            anyhow!("schema: style.background.{key} 必须是有限数值（§6.3）")
                        }),
                    }
                };
                match kind {
                    "linear" => Ok(Some(BgGradient::Linear {
                        angle: number("angle", 180.0)?,
                        stops,
                    })),
                    "radial" => {
                        let r = number("r", 0.5)?;
                        if r <= 0.0 {
                            bail!("schema: style.background.r 必须大于 0（§6.3）");
                        }
                        Ok(Some(BgGradient::Radial {
                            cx: number("cx", 0.5)?,
                            cy: number("cy", 0.5)?,
                            r,
                            stops,
                        }))
                    }
                    other => bail!(
                        "schema: style.background.kind \"{other}\" 不在 linear | radial（§6.3）"
                    ),
                }
            }
            other => {
                bail!("schema: style.background 必须是颜色字串或渐变对象，实得 {other}（§6.3）")
            }
        }
    }

    fn parse_stops(value: Option<&Value>) -> Result<Vec<(f64, Rgba)>> {
        let Some(items) = value.and_then(Value::as_array) else {
            bail!("schema: style.background.stops 必须是至少两项的数组（§6.3）");
        };
        if items.len() < 2 {
            bail!("schema: style.background.stops 至少需要两个色标（§6.3）");
        }
        let mut out = Vec::with_capacity(items.len());
        let mut last = 0.0f64;
        for (index, item) in items.iter().enumerate() {
            let at = match item.get("at") {
                None | Some(Value::Null) => {
                    // Default: uniform distribution
                    index as f64 / (items.len() - 1) as f64
                }
                Some(v) => v
                    .as_f64()
                    .filter(|x| x.is_finite() && (0.0..=1.0).contains(x))
                    .ok_or_else(|| {
                        anyhow!("schema: style.background.stops[{index}].at 必须在 [0, 1]（§6.3）")
                    })?,
            };
            if at < last {
                bail!("schema: style.background.stops 的 at 必须单调不减（§6.3）");
            }
            last = at;
            let color = item
                .get("color")
                .and_then(Value::as_str)
                .and_then(Rgba::parse)
                .ok_or_else(|| {
                    anyhow!(
                        "schema: style.background.stops[{index}].color 必须是可解析的颜色（§6.3）"
                    )
                })?;
            out.push((at, color));
        }
        Ok(out)
    }
}

/// `style.shadow` (spec §6.3): a drop shadow of the element and its subtree.
///
/// Numeric values are **pixels** (same convention as `fontSize`). At definition time they are folded, by the canvas short side, into the relative-length parameters of `filter.dropShadow@1`. So an element with a shadow is an effect element: it falls under the nesting constraints of §6.6, and gets an offscreen surface on the layered render path.
#[derive(Debug, Clone, PartialEq)]
pub struct BoxShadow {
    pub color: Rgba,
    pub blur: f64,
    pub dx: f64,
    pub dy: f64,
}

impl BoxShadow {
    pub fn parse(value: &Value) -> Result<BoxShadow> {
        let Some(map) = value.as_object() else {
            bail!(
                "schema: style.shadow 必须是对象 {{ color, blur, dx, dy }}（像素，§6.3），实得 {value}"
            );
        };
        for key in map.keys() {
            if !matches!(key.as_str(), "color" | "blur" | "dx" | "dy") {
                bail!(
                    "schema: style.shadow 不接受键 \"{key}\"（只有 color / blur / dx / dy，§6.3）"
                );
            }
        }
        let number = |key: &str, default: f64| -> Result<f64> {
            match map.get(key) {
                None | Some(Value::Null) => Ok(default),
                Some(v) => v
                    .as_f64()
                    .filter(|x| x.is_finite())
                    .ok_or_else(|| anyhow!("schema: style.shadow.{key} 必须是有限数值（§6.3）")),
            }
        };
        let blur = number("blur", 0.0)?;
        if blur < 0.0 {
            bail!("schema: style.shadow.blur 不能为负（§6.3）");
        }
        let color = match map.get("color") {
            None | Some(Value::Null) => Rgba {
                r: 0.0,
                g: 0.0,
                b: 0.0,
                a: 0.5,
            },
            Some(v) => v
                .as_str()
                .and_then(Rgba::parse)
                .ok_or_else(|| anyhow!("schema: style.shadow.color 必须是可解析的颜色（§6.3）"))?,
        };
        Ok(BoxShadow {
            color,
            blur,
            dx: number("dx", 0.0)?,
            dy: number("dy", 0.0)?,
        })
    }

    /// Folded into `filter.dropShadow@1`. `short_edge` is the canvas short side in pixels.
    pub fn to_effect(&self, short_edge: f64) -> Result<ResolvedEffect> {
        use motion::effect::{UniformMap, UniformValue, lookup};
        let manifest = lookup("filter.dropShadow", 1).map_err(|error| anyhow!("{error}"))?;
        let short = short_edge.max(1.0);
        let given = UniformMap::new()
            .with("radius", UniformValue::Scalar(self.blur / short))
            .with("dx", UniformValue::Scalar(self.dx / short))
            .with("dy", UniformValue::Scalar(self.dy / short))
            .with(
                "color",
                UniformValue::Color([
                    self.color.r / 255.0,
                    self.color.g / 255.0,
                    self.color.b / 255.0,
                    self.color.a,
                ]),
            );
        let uniforms = manifest
            .resolve_uniforms(&given)
            .map_err(|error| anyhow!("{error}"))?;
        Ok(ResolvedEffect {
            effect: manifest.effect_ref(),
            uniforms,
        })
    }
}

/// `style.border` (§6.3): a stroke ring drawn on the inside of the element box. The outer edge is the element box, and it shrinks inward by `width` pixels. Corner radius follows `borderRadius` (inner corner radius = outer radius − width), matching CSS's border-box convention. It takes no layout space.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BoxBorder {
    pub width: f64,
    pub color: Rgba,
}

impl BoxBorder {
    pub fn parse(value: &Value) -> Result<BoxBorder> {
        let Some(map) = value.as_object() else {
            bail!(
                "schema: style.border 必须是对象 {{ width, color }}（像素，§6.3），不接受 CSS 简写，实得 {value}"
            );
        };
        for key in map.keys() {
            if !matches!(key.as_str(), "width" | "color") {
                bail!("schema: style.border 不接受键 \"{key}\"（只有 width / color，§6.3）");
            }
        }
        let width = map
            .get("width")
            .and_then(Value::as_f64)
            .filter(|w| w.is_finite() && *w > 0.0)
            .ok_or_else(|| {
                anyhow!("schema: style.border.width 必须是正的有限数值（像素，§6.3）")
            })?;
        let color = map
            .get("color")
            .and_then(Value::as_str)
            .and_then(Rgba::parse)
            .ok_or_else(|| anyhow!("schema: style.border.color 必须是可解析的颜色（§6.3）"))?;
        Ok(BoxBorder { width, color })
    }
}

/// `style.mask` (spec §6.3): uses **another element in the same clip** as the mask.
///
/// Like `clipPath`, it has single-surface semantics. At record time it compiles to `PushLayer` → this element's subtree → `PushMatte` → the mask source subtree → `PopMatte{mode}` → `PopLayer`, with no second surface needed. The mask source element **is no longer drawn in the normal flow** (it is a mask definition, as with SVG `<mask>`). It renders at its own layout position and with its ancestors' transforms, and the ancestors' opacity and clipping do not apply.
#[derive(Debug, Clone, PartialEq)]
pub struct ElementMask {
    /// Element id with the `#` removed.
    pub source: String,
    /// `mode: "luma"` (by luminance). Default `alpha`.
    pub luma: bool,
    pub invert: bool,
}

impl ElementMask {
    pub fn parse(value: &Value) -> Result<ElementMask> {
        let Some(map) = value.as_object() else {
            bail!(
                "schema: style.mask 必须是对象 {{ source: \"#id\", mode?, invert? }}（§6.3），实得 {value}"
            );
        };
        for key in map.keys() {
            if !matches!(key.as_str(), "source" | "mode" | "invert") {
                bail!("schema: style.mask 不接受键 \"{key}\"（只有 source / mode / invert，§6.3）");
            }
        }
        let source = map
            .get("source")
            .and_then(Value::as_str)
            .and_then(|s| s.strip_prefix('#'))
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow!("schema: style.mask.source 必须是 \"#<元素 id>\"（§6.3）"))?;
        let luma = match map.get("mode") {
            None | Some(Value::Null) => false,
            Some(v) => match v.as_str() {
                Some("alpha") => false,
                Some("luma") => true,
                _ => bail!("schema: style.mask.mode 必须是 alpha | luma（§6.3）"),
            },
        };
        let invert = match map.get("invert") {
            None | Some(Value::Null) => false,
            Some(v) => v
                .as_bool()
                .ok_or_else(|| anyhow!("schema: style.mask.invert 必须是布尔（§6.3）"))?,
        };
        Ok(ElementMask {
            source: source.to_string(),
            luma,
            invert,
        })
    }
}

/// `path` shape of `clipPath` (spec §6.3): `d` is in `viewBox` coordinates. Polyline points are normalized to **element box proportions** (x stretched by box width, y by box height). It can only be written on a static `style.clipPath`, since there is no well-defined per-key interpolation between arbitrary paths.
#[derive(Debug, Clone, PartialEq)]
pub struct ClipPoly {
    pub subpaths: Vec<Vec<(f64, f64)>>,
    pub even_odd: bool,
}

/// `morphTo` allows at most this many target shapes (spec §6.2.1).
pub const MORPH_TARGETS_MAX: usize = 256;

/// Parse `path.morphTo`: a `d` string or an array of strings. Each target, once flattened, must have the **same topology** as `d` (the subpath count and the vertex count of each subpath must match one for one). Otherwise `path-morph-topology`.
pub fn parse_morph_to(value: &Value, d: Option<&str>) -> Result<Vec<String>> {
    let targets: Vec<String> = match value {
        Value::String(s) => vec![s.clone()],
        Value::Array(items) => items
            .iter()
            .map(|v| {
                v.as_str()
                    .map(str::to_string)
                    .ok_or_else(|| anyhow!("schema: morphTo 的每一项必须是 path d 字符串"))
            })
            .collect::<Result<_>>()?,
        _ => bail!("schema: morphTo 必须是 path d 字符串或字符串数组（§6.2.1）"),
    };
    if targets.is_empty() || targets.len() > MORPH_TARGETS_MAX {
        bail!("schema: morphTo 需要 1..={MORPH_TARGETS_MAX} 个目标形状");
    }
    let Some(d) = d else {
        bail!("schema: morphTo 需要同一节点上的 d");
    };
    let base: Vec<usize> = crate::svgpath::parse(d).iter().map(Vec::len).collect();
    for (i, target) in targets.iter().enumerate() {
        let parsed = crate::svgpath::parse_checked(target);
        if let Some(c) = parsed.unsupported.first() {
            bail!("path-command-unsupported: morphTo[{i}] 含不支持的命令 \"{c}\"");
        }
        let topo: Vec<usize> = parsed.subpaths.iter().map(Vec::len).collect();
        if topo != base {
            bail!(
                "path-morph-topology: morphTo[{i}] 展平后的顶点数 {topo:?} 与 d 的 {base:?} 不一致\
                 （子路径数与各子路径顶点数必须逐一相等）"
            );
        }
    }
    Ok(targets)
}

const CLIP_KEYS_PATH: &[&str] = &["shape", "d", "viewBox", "fillRule"];

impl ClipPoly {
    /// Returns `Some` when `value.shape == "path"`. For other shapes, returns `None` and hands off to [`ClipShape`].
    pub fn parse(value: &Value) -> Result<Option<ClipPoly>> {
        let Some(map) = value.as_object() else {
            return Ok(None);
        };
        if map.get("shape").and_then(Value::as_str) != Some("path") {
            return Ok(None);
        }
        for key in map.keys() {
            if !CLIP_KEYS_PATH.contains(&key.as_str()) {
                bail!(
                    "schema: clipPath 形状 \"path\" 没有键 \"{key}\"（封闭键集 {CLIP_KEYS_PATH:?}）"
                );
            }
        }
        let Some(d) = map.get("d").and_then(Value::as_str) else {
            bail!("schema: clipPath 形状 \"path\" 缺少 d");
        };
        let vb = match map.get("viewBox") {
            None | Some(Value::Null) => [0.0, 0.0, 1.0, 1.0],
            Some(value) => {
                let nums: Vec<f64> = value
                    .as_str()
                    .unwrap_or("")
                    .split_whitespace()
                    .filter_map(|x| x.parse().ok())
                    .collect();
                if nums.len() != 4 || nums[2] <= 0.0 || nums[3] <= 0.0 {
                    bail!("schema: clipPath.viewBox 必须是 \"minX minY width height\"（宽高为正）");
                }
                [nums[0], nums[1], nums[2], nums[3]]
            }
        };
        let even_odd = match map.get("fillRule").and_then(Value::as_str) {
            None | Some("nonzero") => false,
            Some("evenodd") => true,
            Some(other) => bail!("schema: clipPath.fillRule \"{other}\" 不在 nonzero|evenodd"),
        };
        let parsed = crate::svgpath::parse_checked(d);
        if let Some(c) = parsed.unsupported.first() {
            bail!("path-command-unsupported: clipPath.d 含不支持的命令 \"{c}\"");
        }
        let subpaths: Vec<Vec<(f64, f64)>> = parsed
            .subpaths
            .into_iter()
            .filter(|poly| poly.len() >= 3)
            .map(|poly| {
                poly.into_iter()
                    .map(|(x, y)| ((x - vb[0]) / vb[2], (y - vb[1]) / vb[3]))
                    .collect()
            })
            .collect();
        if subpaths.is_empty() {
            bail!("schema: clipPath.d 没有可闭合的子路径（至少三个点）");
        }
        Ok(Some(ClipPoly { subpaths, even_odd }))
    }
}

/// Parameterized shapes for `style.clipPath` and the `clipPath` channel (spec §6.3).
///
/// All values are **proportions of the element box**: `inset`'s four sides are relative to the corresponding edge length, and corner radii and circle radii are relative to the short side. The proportional form lets `clipPath` interpolate linearly key by key (`mix_value`), and gives the same visual for the same declaration on a box of any size. `polygon` has no rasterized path in this implementation, so it is rejected at parse time with `effect-capability-unsupported`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ClipShape {
    Inset {
        top: f64,
        right: f64,
        bottom: f64,
        left: f64,
        radius: f64,
    },
    Circle {
        cx: f64,
        cy: f64,
        r: f64,
    },
    Ellipse {
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
    },
}

/// Closed key set for each shape: an extra key is a schema error, so a typo is never silently ignored.
const CLIP_KEYS_INSET: &[&str] = &["shape", "top", "right", "bottom", "left", "radius"];
const CLIP_KEYS_CIRCLE: &[&str] = &["shape", "cx", "cy", "r"];
const CLIP_KEYS_ELLIPSE: &[&str] = &["shape", "cx", "cy", "rx", "ry"];

impl ClipShape {
    /// Parse a `clipPath` value. `null` ⇒ `None` (on the channel it means "no clipping at this moment").
    pub fn parse(value: &Value) -> Result<Option<ClipShape>> {
        if value.is_null() {
            return Ok(None);
        }
        let Some(map) = value.as_object() else {
            bail!("schema: clipPath 必须是参数化形状对象（§6.3），实得 {value}");
        };
        let shape = map
            .get("shape")
            .and_then(Value::as_str)
            .unwrap_or("inset")
            .to_owned();
        let num = |key: &str, default: f64| -> f64 {
            map.get(key).and_then(Value::as_f64).unwrap_or(default)
        };
        let allowed: &[&str] = match shape.as_str() {
            "inset" => CLIP_KEYS_INSET,
            "circle" => CLIP_KEYS_CIRCLE,
            "ellipse" => CLIP_KEYS_ELLIPSE,
            "path" => bail!(
                "schema: clipPath 形状 \"path\" 只能写在静态 style.clipPath 上，不能进 clipPath 通道（§6.3）"
            ),
            "polygon" => bail!(
                "effect-capability-unsupported: clipPath \"polygon\" 没有光栅化实现，\
                 请改用 inset / circle / ellipse，或用 mask.image 提供遮罩（§6.3 / §6.6）"
            ),
            other => {
                bail!("schema: clipPath.shape \"{other}\" 不在 inset|circle|ellipse|path|polygon")
            }
        };
        for key in map.keys() {
            if !allowed.contains(&key.as_str()) {
                bail!("schema: clipPath 形状 \"{shape}\" 没有键 \"{key}\"（封闭键集 {allowed:?}）");
            }
        }
        Ok(Some(match shape.as_str() {
            "inset" => ClipShape::Inset {
                top: num("top", 0.0),
                right: num("right", 0.0),
                bottom: num("bottom", 0.0),
                left: num("left", 0.0),
                radius: num("radius", 0.0),
            },
            "circle" => ClipShape::Circle {
                cx: num("cx", 0.5),
                cy: num("cy", 0.5),
                r: num("r", 0.5),
            },
            _ => ClipShape::Ellipse {
                cx: num("cx", 0.5),
                cy: num("cy", 0.5),
                rx: num("rx", 0.5),
                ry: num("ry", 0.5),
            },
        }))
    }

    /// Identity clip (cuts nothing away) ⇒ no need to emit a `ClipPath` instruction.
    pub fn is_identity(&self) -> bool {
        match self {
            ClipShape::Inset {
                top,
                right,
                bottom,
                left,
                radius,
            } => *top <= 0.0 && *right <= 0.0 && *bottom <= 0.0 && *left <= 0.0 && *radius <= 0.0,
            _ => false,
        }
    }
}

/// `effects[]` array → resolved effect stack (spec §6.6).
pub fn parse_effects(value: &Value) -> Result<Vec<ResolvedEffect>> {
    use motion::effect::{UniformMap, lookup};

    let Some(items) = value.as_array() else {
        bail!("schema: effects 必须是数组（§6.6），实得 {value}");
    };
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let id = item
            .gstr("preset")
            .ok_or_else(|| anyhow!("schema: effects[] 条目缺少 preset（§6.6）"))?;
        // Persisted data must pin the version. The default is 1 (the first batch of recipes are all @1), and a version higher than the implementation is an error.
        let version = match item.get_("presetVersion") {
            Some(value) if !value.is_null() => value
                .as_u64()
                .ok_or_else(|| anyhow!("schema: effects[].presetVersion 必须是整数"))?
                as u32,
            _ => 1,
        };
        let manifest = lookup(id, version).map_err(|error| anyhow!("{error}"))?;
        let mut given = UniformMap::new();
        if let Some(params) = item.get_("params").and_then(Value::as_object) {
            for (key, raw) in params {
                let spec = manifest.params.get(key).ok_or_else(|| {
                    anyhow!(
                        "preset-param-unknown: {} 没有参数 {key}；{}（§6.6）",
                        manifest.qualified(),
                        manifest.params_hint()
                    )
                })?;
                given.insert(
                    key.clone(),
                    uniform_from_json(spec.kind, key, raw, manifest)?,
                );
            }
        }
        let uniforms = manifest
            .resolve_uniforms(&given)
            .map_err(|error| anyhow!("{error}"))?;
        out.push(ResolvedEffect {
            effect: manifest.effect_ref(),
            uniforms,
        });
    }
    Ok(out)
}

fn uniform_from_json(
    kind: motion::effect::ParamKind,
    key: &str,
    raw: &Value,
    manifest: &motion::effect::EffectManifest,
) -> Result<motion::effect::UniformValue> {
    use motion::effect::{ParamKind, UniformValue};
    let bad = |want: &str| {
        anyhow!(
            "schema: {} 的参数 {key} 期望 {want}，实得 {raw}",
            manifest.qualified()
        )
    };
    Ok(match kind {
        ParamKind::Number | ParamKind::Length => {
            UniformValue::Scalar(raw.as_f64().ok_or_else(|| bad("数值"))?)
        }
        ParamKind::Bool => UniformValue::Bool(raw.as_bool().ok_or_else(|| bad("布尔"))?),
        ParamKind::Enum | ParamKind::Text => {
            UniformValue::Text(raw.as_str().ok_or_else(|| bad("字符串"))?.to_owned())
        }
        ParamKind::Color => {
            let text = raw.as_str().ok_or_else(|| bad("颜色字符串"))?;
            let rgba = Rgba::parse(text).ok_or_else(|| bad("可解析的颜色"))?;
            UniformValue::Color([
                rgba.r / 255.0,
                rgba.g / 255.0,
                rgba.b / 255.0,
                rgba.a.clamp(0.0, 1.0),
            ])
        }
        ParamKind::Vec2 => {
            let items = raw
                .as_array()
                .filter(|a| a.len() == 2)
                .ok_or_else(|| bad("[x, y]"))?;
            UniformValue::Vec2([
                items[0].as_f64().ok_or_else(|| bad("[x, y]"))?,
                items[1].as_f64().ok_or_else(|| bad("[x, y]"))?,
            ])
        }
    })
}

// ── Built-in presets (subset of spec Appendix B, consistent with the Swift prototype) ────────────────
//
// The recipe bodies have moved to `core/presets/builtin/motion/bcf.*.json`, embedded and parsed by
// `motion::preset_registry` (ADR-M03). Only the access point is kept here.

/// `split.by` → part unit (spec §7.9).
///
/// The part map for `line` is built after the host font has taken part in typesetting. It cannot be guessed ahead of time from text line counts.
pub fn parse_split_unit(split: &Value) -> Result<motion::PartUnit> {
    match split.gstr("by").unwrap_or("grapheme") {
        "grapheme" => Ok(motion::PartUnit::Char),
        "word" => Ok(motion::PartUnit::Word),
        "line" => Ok(motion::PartUnit::Line),
        other => bail!("schema: split.by \"{other}\" 不在 grapheme|word|line（§7.9）"),
    }
}

/// `use.stagger.delay` / `RNode::extra_delay` wraps the whole flow (spec §10.3 / §7.5).
fn wrap_extra_delay(graph: motion::MotionGraph, extra: f64) -> motion::MotionGraph {
    if extra == 0.0 {
        return graph;
    }
    motion::MotionGraph {
        root: motion::MotionOp::Delay {
            delay: extra,
            child: Box::new(graph.root),
        },
    }
}

// ── Resolver ─────────────────────────────────────────────────────────

/// One media reference point (§18.6 reference window): an audio clip, or a visual clip containing a video element.
#[derive(Debug, Clone)]
struct MediaRef {
    /// Host clip id (source of the window)
    clip_id: String,
    asset_id: String,
    media_start: f64,
    rate: f64,
    segment: Option<(f64, f64)>,
}

pub struct Resolver {
    pub doc: Value,
    pub font_families: HashMap<String, String>,
    pub ctx: Ctx,
    pub cues: HashMap<String, (f64, f64, f64)>, // (start, dur, end)
    pub clip_wins: HashMap<String, (Option<f64>, Option<f64>)>,
    pub total: f64,
    /// meta.fps (TimeExpr results are aligned to the 1/fps grid, §5.4)
    pub fps: f64,
    /// Media metadata probed by the host (assets::HostInputs). The source of natural size for image/video.
    pub media: HashMap<String, MediaMeta>,
    /// Word-level transcript injected by the host (asset id → word list). The source for evaluating `~` word anchors.
    pub transcripts: HashMap<String, Vec<CoreWord>>,
    /// Per-frame start millisecond table for animatedImage (assets::HostInputs)
    pub frame_tables: HashMap<String, Arc<[i64]>>,
    /// Media reference point index (collected at the start of resolve())
    media_refs: Vec<MediaRef>,
    builtins: Value,
}

impl Resolver {
    /// variables overrides: `overrides` is injected in the form {"id": value} (§11.1).
    pub fn new(doc: Value, overrides: Option<&Map<String, Value>>) -> Result<Resolver> {
        let builtins: Value = motion::preset_registry::bcf_builtin_map().clone();
        let vars = crate::assets::effective_vars(&doc, overrides);
        // asset variable delegation (§11.2): var entries are materialized as {type, src, hash?}, so $assets.* references work transparently
        let raw_assets = doc
            .get_("assets")
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
        let assets = materialize_assets(&raw_assets, &vars)?;
        let pre_ctx = Ctx {
            vars: vars.clone(),
            theme: Value::Object(Map::new()),
            assets: assets.clone(),
            props: None,
            extra_delay: 0.0,
        };
        let theme = deep_resolve(
            doc.get_("theme").unwrap_or(&Value::Object(Map::new())),
            &pre_ctx,
        );
        let ctx = Ctx {
            vars,
            theme,
            assets,
            props: None,
            extra_delay: 0.0,
        };
        let fps = doc.get_("meta").and_then(|m| m.gf64("fps")).unwrap_or(30.0);
        Ok(Resolver {
            doc,
            ctx,
            cues: HashMap::new(),
            clip_wins: HashMap::new(),
            total: 0.0,
            fps,
            media: HashMap::new(),
            transcripts: HashMap::new(),
            frame_tables: HashMap::new(),
            font_families: HashMap::new(),
            media_refs: Vec::new(),
            builtins,
        })
    }

    /// Inject host-probed media metadata and the word-level transcript (assets::HostInputs). Must be called before resolve().
    pub fn set_host_inputs(&mut self, inputs: crate::assets::HostInputs) {
        self.media = inputs.media;
        self.transcripts = inputs.transcripts;
        self.frame_tables = inputs.frame_tables;
        self.font_families = inputs.font_families;
    }

    // ── TimeExpr evaluation (spec §5.2): returns None when #clip / ~word references have not yet converged ──
    /// Evaluation results are uniformly aligned to the 1/fps grid (§5.4).
    pub fn eval_t(&self, expr: &Value) -> Result<Option<f64>> {
        if let Some(n) = expr.as_f64() {
            return Ok(Some(self.align(n)));
        }
        Ok(self
            .eval_t_exact(expr)?
            .map(|t| clamp(self.align(t), 0.0, self.total + 10.0)))
    }

    /// Same as [`Self::eval_t`], but **without frame-grid alignment or clamping**. Top-level `events[]` (spec §4.2) are moments for the audio side, at millisecond precision, and out-of-clip ones must still be reported as-is. Must be called after `resolve()`.
    pub fn eval_t_exact(&self, expr: &Value) -> Result<Option<f64>> {
        if let Some(n) = expr.as_f64() {
            return Ok(Some(n));
        }
        let Some(s) = expr.as_str() else {
            bail!("非法 TimeExpr: {expr}");
        };
        let parsed = timeexpr::parse(s)?;
        let base = match parsed {
            TimeExpr::Abs(n) => n,
            TimeExpr::Anchor {
                sigil,
                id,
                mark,
                offset,
            } => {
                let b = if sigil == '@' {
                    // `@doc` reserved anchor (§3.3): the whole-document window [0, total], scaling with reflow
                    if id == "doc" {
                        match mark {
                            Mark::Pct(p) => self.total * p / 100.0,
                            Mark::End => self.total,
                            Mark::Start => 0.0,
                        }
                    } else {
                        let sc = self
                            .cues
                            .get(&id)
                            .ok_or_else(|| anyhow!("time-ref-unknown: 场景 \"{id}\" 不存在"))?;
                        match mark {
                            Mark::Pct(p) => sc.0 + sc.1 * p / 100.0,
                            Mark::End => sc.2,
                            Mark::Start => sc.0,
                        }
                    }
                } else {
                    let w = self
                        .clip_wins
                        .get(&id)
                        .ok_or_else(|| anyhow!("time-ref-unknown: clip \"{id}\" 不存在"))?;
                    let need = if mark == Mark::End { w.1 } else { w.0 };
                    match need {
                        Some(n) => n,
                        None => return Ok(None), // Not yet solved during fixed-point iteration
                    }
                };
                b + offset
            }
            TimeExpr::Word {
                ref_id,
                word_id,
                mark_end,
                offset,
            } => {
                match self.eval_word_anchor(&ref_id, &word_id, mark_end)? {
                    Some(t) => t + offset,
                    None => return Ok(None), // Host window not yet solved
                }
            }
        };
        Ok(Some(base))
    }

    /// Align to the 1/fps grid (§5.4). When fps is unknown (≤0), return as-is.
    fn align(&self, t: f64) -> f64 {
        if self.fps > 0.0 {
            (t * self.fps).round() / self.fps
        } else {
            t
        }
    }

    /// `~` word anchor evaluation (§18.6 mapToDoc): the word's media-source time → absolute document time.
    /// Returns None if some candidate reference window has not yet been solved during fixed-point iteration.
    fn eval_word_anchor(&self, ref_id: &str, word_id: &str, mark_end: bool) -> Result<Option<f64>> {
        let is_asset = self.ctx.assets.get_(ref_id).is_some();
        let is_clip = self.clip_wins.contains_key(ref_id);
        if is_asset && is_clip {
            bail!("word-anchor-name-clash: \"{ref_id}\" 同时是媒体 id 与 clip id，词锚点无法消歧");
        }
        let refs: Vec<&MediaRef> = if is_clip {
            self.media_refs
                .iter()
                .filter(|r| r.clip_id == ref_id)
                .collect()
        } else if is_asset {
            self.media_refs
                .iter()
                .filter(|r| r.asset_id == ref_id)
                .collect()
        } else {
            bail!("time-ref-unknown: 词锚点引用的 \"{ref_id}\" 既不是媒体 id 也不是 clip id");
        };
        if refs.is_empty() {
            bail!(
                "word-anchor-unmapped: \"{ref_id}\" 没有任何媒体引用点（audio clip 或 video 元素）"
            );
        }
        let mut any_transcript = false;
        let mut word_found = false;
        let mut pending = false;
        let mut hits: Vec<f64> = Vec::new();
        for r in &refs {
            let Some(words) = self.transcripts.get(&r.asset_id) else {
                continue;
            };
            any_transcript = true;
            let Some(w) = words.iter().find(|w| w.id == word_id) else {
                continue;
            };
            word_found = true;
            let Some(&(Some(ws), Some(we))) = self.clip_wins.get(&r.clip_id) else {
                pending = true;
                continue;
            };
            // Reference window test (§18.6): a word's start t0 falls within [mediaStart, mediaStart + window length × rate)
            // (this implementation does not expand the multiple mappings of loop; it tests against the first cycle)
            let mut lo = r.media_start;
            let mut hi = r.media_start + (we - ws).max(0.0) * r.rate;
            if let Some((s0, s1)) = r.segment {
                lo = lo.max(s0);
                hi = hi.min(s1);
            }
            if w.t0 < lo - 1e-9 || w.t0 >= hi - 1e-9 {
                continue;
            }
            let wt = if mark_end { w.t1 } else { w.t0 };
            hits.push(ws + (wt - r.media_start) / r.rate);
        }
        if pending {
            return Ok(None);
        }
        if !any_transcript {
            bail!(
                "word-anchor-no-transcript: \"{ref_id}\" 引用的媒体未注入词级转录（CLI --transcript）"
            );
        }
        if !word_found {
            bail!("time-ref-unknown: 词 \"{word_id}\" 不存在于 \"{ref_id}\" 的转录");
        }
        match hits.len() {
            0 => {
                bail!("word-anchor-unmapped: 词 \"{word_id}\" 不落在 \"{ref_id}\" 的任何引用窗口内")
            }
            1 => Ok(Some(hits[0])),
            n => bail!(
                "word-anchor-ambiguous: 词 \"{word_id}\" 在 \"{ref_id}\" 有 {n} 个引用点命中，请用 clip id 限定（~clipId:wordId）"
            ),
        }
    }

    // ── preset expansion ──
    pub fn expand_preset_def(
        &self,
        name: &str,
        user_params: Option<&Value>,
        ctx: &Ctx,
    ) -> Result<(Vec<Value>, Option<Map<String, Value>>)> {
        let def = self
            .doc
            .get_("presets")
            .and_then(|p| p.get_(name))
            .or_else(|| self.builtins.get_(name))
            .ok_or_else(|| anyhow!("preset-unknown: \"{name}\""))?;
        let mut params = Map::new();
        if let Some(specs) = def.get_("params").and_then(Value::as_object) {
            for (k, spec) in specs {
                params.insert(
                    k.clone(),
                    spec.get_("default").cloned().unwrap_or(Value::Null),
                );
            }
        }
        if let Some(up) = user_params.and_then(Value::as_object) {
            for (k, v) in up {
                params.insert(k.clone(), deep_resolve(v, ctx));
            }
        }
        let mut pctx = ctx.clone();
        pctx.props = Some(params.clone());
        let kfs = deep_resolve(
            def.get_("keyframes").unwrap_or(&Value::Array(vec![])),
            &pctx,
        )
        .as_array()
        .cloned()
        .unwrap_or_default();
        let meta = if motion::preset_registry::emits_params_meta(name) {
            Some(params)
        } else {
            None
        };
        Ok((kfs, meta))
    }

    /// Preset '%' frames → absolute-time channels over [t0, t0+dur].
    ///
    /// The numeric kernel lives in `motion::lower_bcf`. Here we only attach the channel IR to `Channel`'s `meta`, since countUp's prefix/suffix/decimals belong to the BCF document domain.
    pub fn lay_preset_frames(
        kfs: &[Value],
        t0: f64,
        dur: f64,
        meta: Option<Map<String, Value>>,
    ) -> Vec<Channel> {
        motion::lower_bcf::preset_channels(kfs, t0, dur)
            .into_iter()
            .map(|channel| channel_from_ir(channel, meta.clone()))
            .collect()
    }

    fn resolve_font_style(&self, style: &mut Map<String, Value>) {
        if let Some(family) = style
            .get("font")
            .and_then(Value::as_str)
            .and_then(|name| self.font_families.get(name))
        {
            style.insert("font".into(), Value::from(family.clone()));
        }
    }

    // ── Element tree expansion (components / each / stagger / $props) ──
    pub fn expand_node(&self, n: &Value, ectx: &Ctx) -> Result<RNode> {
        self.expand_node_guarded(n, ectx, 0, &OriginCtx::root())
    }

    /// Media field parsing and validation (§6.5): shared by `video` and `animatedImage`. The mediaStart of audio clips also reuses the default rule.
    fn video_media_fields(n: &Value) -> Result<(f64, f64, Option<(f64, f64)>, bool)> {
        let rate = n.gf64("playbackRate").unwrap_or(1.0);
        if rate <= 0.0 || !rate.is_finite() {
            bail!("媒体元素 playbackRate {rate} 必须为正数");
        }
        let segment = match n.get_("segment").filter(|v| !v.is_null()) {
            Some(v) => {
                let arr = v
                    .as_array()
                    .filter(|a| a.len() == 2)
                    .ok_or_else(|| anyhow!("媒体元素 segment 须为 [start, end] 两元素数组"))?;
                let (s0, s1) = (
                    arr[0]
                        .as_f64()
                        .ok_or_else(|| anyhow!("媒体元素 segment[0] 不是数字"))?,
                    arr[1]
                        .as_f64()
                        .ok_or_else(|| anyhow!("媒体元素 segment[1] 不是数字"))?,
                );
                if !(s0 >= 0.0 && s1 > s0) {
                    bail!("媒体元素 segment [{s0}, {s1}] 须满足 0 ≤ start < end");
                }
                Some((s0, s1))
            }
            None => None,
        };
        // mediaStart defaults to the segment start (§6.5)
        let media_start = n
            .gf64("mediaStart")
            .unwrap_or(segment.map(|s| s.0).unwrap_or(0.0));
        let loop_media = n.get_("loop").and_then(Value::as_bool).unwrap_or(false);
        Ok((media_start, rate, segment, loop_media))
    }

    /// Collect media reference points across the whole document (static half of the §18.6 reference window):
    /// audio-track clips, plus video nodes in visual clip element trees (including component roots, depth-limited).
    fn collect_media_refs(&self, all_clips: &[(String, Value)]) -> Result<Vec<MediaRef>> {
        fn walk_element(
            rsv: &Resolver,
            n: &Value,
            clip_id: &str,
            out: &mut Vec<MediaRef>,
            depth: usize,
        ) -> Result<()> {
            if depth > 64 {
                return Ok(()); // Component recursion is reported as an error by expand_node / lint; here it is silently truncated
            }
            if n.gstr("type") == Some("use") {
                if let Some(comp) = n
                    .gstr("component")
                    .and_then(|name| rsv.doc.get_("components").and_then(|c| c.get_(name)))
                {
                    if let Some(root) = comp.get_("root") {
                        walk_element(rsv, root, clip_id, out, depth + 1)?;
                    }
                }
            }
            if n.gstr("type") == Some("video") {
                // Only direct $assets.* references are resolved statically. A src delegated through $props cannot be located statically, so it is skipped
                if let Some(aid) = n.gstr("src").and_then(asset_ref_id) {
                    let (media_start, rate, segment, _) = Resolver::video_media_fields(n)?;
                    out.push(MediaRef {
                        clip_id: clip_id.to_string(),
                        asset_id: aid.to_string(),
                        media_start,
                        rate,
                        segment,
                    });
                }
            }
            for c in n
                .get_("children")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                walk_element(rsv, c, clip_id, out, depth)?;
            }
            Ok(())
        }

        let mut out = Vec::new();
        for (kind, c) in all_clips {
            let Some(id) = c.gstr("id") else { continue };
            match kind.as_str() {
                "audio" => {
                    if let Some(aid) = c.gstr("src").and_then(asset_ref_id) {
                        out.push(MediaRef {
                            clip_id: id.to_string(),
                            asset_id: aid.to_string(),
                            media_start: c.gf64("mediaStart").unwrap_or(0.0),
                            rate: 1.0,
                            segment: None,
                        });
                    }
                }
                "visual" => {
                    if let Some(el) = c.get_("element") {
                        walk_element(self, el, id, &mut out, 0)?;
                    }
                }
                _ => {}
            }
        }
        Ok(out)
    }

    fn expand_node_guarded(
        &self,
        n: &Value,
        ectx: &Ctx,
        depth: usize,
        octx: &OriginCtx,
    ) -> Result<RNode> {
        if depth > 64 {
            bail!("component-cycle: 组件实例化深度超过 64（疑似递归）");
        }
        if n.gstr("type") == Some("use") {
            let comp_name = n
                .gstr("component")
                .ok_or_else(|| anyhow!("use 节点缺少 component 字段"))?;
            let comp = self
                .doc
                .get_("components")
                .and_then(|c| c.get_(comp_name))
                .ok_or_else(|| anyhow!("component-unknown: \"{comp_name}\""))?;
            let items: Vec<Value> = if let Some(each) = n.get_("each") {
                resolve_ref(each, ectx)
                    .as_array()
                    .cloned()
                    .ok_or_else(|| anyhow!("use.each 不是数组: {each}"))?
            } else {
                vec![
                    n.get_("props")
                        .cloned()
                        .unwrap_or_else(|| Value::Object(Map::new())),
                ]
            };
            let mut wrap = RNode {
                ntype: "box".into(),
                id: n.gstr("id").unwrap_or("").to_string(),
                wrap_layout: n.get_("layout").and_then(Value::as_object).cloned(),
                origin: Some(Box::new(octx.origin())),
                ..Default::default()
            };
            let stagger_delay = n
                .get_("stagger")
                .and_then(|s| s.gf64("delay"))
                .unwrap_or(0.0);
            for (i, props) in items.iter().enumerate() {
                let mut defaults = Map::new();
                if let Some(specs) = comp.get_("props").and_then(Value::as_object) {
                    for (k, spec) in specs {
                        if let Some(d) = spec.get_("default") {
                            if !d.is_null() {
                                defaults.insert(k.clone(), deep_resolve(d, ectx));
                            }
                        }
                    }
                }
                if let Some(po) = deep_resolve(props, ectx).as_object() {
                    for (k, v) in po {
                        defaults.insert(k.clone(), v.clone());
                    }
                }
                let mut ictx = ectx.clone();
                ictx.props = Some(defaults);
                // Derived ids are minted here. The reverse lookup table is registered at the same place, so the two cannot diverge (scheme §4.3-2).
                let derived = octx.instance(comp_name, i);
                let inst = self.expand_node_guarded(
                    comp.get_("root").unwrap_or(&Value::Null),
                    &ictx,
                    depth + 1,
                    &derived,
                )?;
                let wrapper = RNode {
                    ntype: "box".into(),
                    id: format!("{}-{i}", wrap.id),
                    animate: n.get_("animate").cloned(), // Kept as is; build_channels expands it later
                    extra_delay: stagger_delay * i as f64 + ectx.extra_delay,
                    children: vec![inst],
                    // The per-instance wrapper is a synthetic box minted by the compiler. Its author node is the `use` itself (so `authored` stays in clip space), while the `authored` of nodes inside the component counts from the component root. The two are told apart by `component`.
                    origin: Some(Box::new(NodeOrigin {
                        authored: octx.path.clone(),
                        ..derived.origin()
                    })),
                    ..Default::default()
                };
                wrap.children.push(wrapper);
            }
            return Ok(wrap);
        }

        let mut node = RNode {
            ntype: n.gstr("type").unwrap_or("box").to_string(),
            id: n.gstr("id").unwrap_or("").to_string(),
            origin: Some(Box::new(octx.origin())),
            style: deep_resolve(n.get_("style").unwrap_or(&Value::Object(Map::new())), ectx)
                .as_object()
                .cloned()
                .unwrap_or_default(),
            animate: n.get_("animate").map(|a| deep_resolve(a, ectx)),
            ..Default::default()
        };
        self.resolve_font_style(&mut node.style);
        if node.ntype == "charGrid" {
            let grid = crate::char_grid::CharGrid::parse(&deep_resolve(n, ectx))?;
            if node.style.get("fontSize").is_some_and(|v| {
                !v.as_f64()
                    .is_some_and(|n| n.is_finite() && (1.0..=256.0).contains(&n))
            }) {
                bail!("schema: charGrid fontSize 须在 1..256 px");
            }
            node.style
                .entry("width")
                .or_insert(Value::from(grid.cols as f64 * grid.cell_width));
            node.style
                .entry("height")
                .or_insert(Value::from(grid.rows as f64 * grid.cell_height));
            node.char_grid = Some(grid);
        }
        if node.ntype == "proc" {
            let proc = crate::proc::ProcSource::parse(&deep_resolve(n, ectx))?;
            // Defaults to filling the canvas: rain and the night sky are usually a full-frame background layer.
            let meta = self.doc.get_("meta");
            let (cw, ch) = (
                meta.and_then(|m| m.gf64("width")).unwrap_or(1920.0),
                meta.and_then(|m| m.gf64("height")).unwrap_or(1080.0),
            );
            node.style.entry("width").or_insert(Value::from(cw));
            node.style.entry("height").or_insert(Value::from(ch));
            node.proc = Some(proc);
        }
        if node.ntype == "composition" {
            let canvas = crate::composition::LocalCanvas::parse(&deep_resolve(
                n.get_("canvas").unwrap_or(&Value::Null),
                ectx,
            ))?;
            node.style
                .entry("width")
                .or_insert(Value::from(canvas.width));
            node.style
                .entry("height")
                .or_insert(Value::from(canvas.height));
            node.composition = Some(canvas);
        } else if n.get_("canvas").is_some() {
            bail!("schema: canvas 只用于 composition");
        }
        if let Some(map) = n.get_("timeMap") {
            if !matches!(
                node.ntype.as_str(),
                "composition" | "video" | "animatedImage" | "lottie" | "program"
            ) {
                bail!("schema: timeMap 只用于 composition 或带源时钟的媒体");
            }
            if ["playbackRate", "mediaStart", "segment", "loop"]
                .iter()
                .any(|key| n.get_(*key).is_some())
            {
                bail!("schema: timeMap 不能与 playbackRate/mediaStart/segment/loop 混用");
            }
            node.time_map = Some(crate::composition::TimeMap::parse(&deep_resolve(
                map, ectx,
            ))?);
        }
        if let Some(camera) = n.get_("camera") {
            let Some(canvas) = &node.composition else {
                bail!("schema: 节点 camera 只用于 composition");
            };
            let camera = deep_resolve(camera, ectx);
            let Some(frames) = camera.as_array().filter(|v| v.len() <= 4096) else {
                bail!("schema: composition.camera 必须是最多 4096 帧的数组");
            };
            for frame in frames {
                let t = frame
                    .get_("t")
                    .and_then(Value::as_f64)
                    .filter(|v| v.is_finite() && *v >= 0.0 && *v <= canvas.duration)
                    .ok_or_else(|| anyhow!("schema: camera.t 须在局部时间范围内"))?;
                let v = frame
                    .get_("v")
                    .and_then(Value::as_object)
                    .ok_or_else(|| anyhow!("schema: camera.v 须为 {{x,y,zoom}}"))?;
                if v.keys()
                    .any(|key| !matches!(key.as_str(), "x" | "y" | "zoom"))
                    || v.values()
                        .any(|value| !value.as_f64().is_some_and(f64::is_finite))
                    || v.get("zoom")
                        .is_some_and(|v| v.as_f64().unwrap_or(0.0) <= 0.0)
                    || node
                        .local_camera
                        .last()
                        .is_some_and(|previous| previous.t >= t)
                {
                    bail!("schema: camera 帧须按 t 递增，x/y 有限且 zoom > 0");
                }
                node.local_camera.push(Kf {
                    t,
                    v: Value::Object(v.clone()),
                    ease: frame.gstr("ease").map(String::from),
                });
            }
        }
        if n.get_("crop").is_some() || n.get_("focalPoint").is_some() {
            if !matches!(node.ntype.as_str(), "image" | "video" | "animatedImage") {
                bail!("schema: crop/focalPoint 只用于位图媒体");
            }
            if let Some(crop) = n.get_("crop") {
                node.media_crop = Some(crate::composition::crop(&deep_resolve(crop, ectx))?);
            }
            if let Some(focal) = n.get_("focalPoint") {
                let focal = deep_resolve(focal, ectx);
                let valid = focal
                    .as_object()
                    .is_some_and(|o| o.keys().all(|key| matches!(key.as_str(), "x" | "y")));
                let number = |key| {
                    focal
                        .get_(key)
                        .and_then(Value::as_f64)
                        .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                };
                let (Some(x), Some(y)) = (number("x"), number("y")) else {
                    bail!("schema: focalPoint 须为 {{x,y}}，值在 0..1");
                };
                if !valid {
                    bail!("schema: focalPoint 只接受 x/y");
                }
                node.media_focal = Some([x, y]);
            }
        }
        if node.ntype == "image" {
            node.fit = n.gstr("fit").map_or(Ok(Fit::Fill), |fit| {
                Fit::parse(fit).ok_or_else(|| anyhow!("schema: image fit 无效"))
            })?;
        }
        if let Some(t) = n.get_("text") {
            node.text = Some(resolve_ref(t, ectx).as_str().unwrap_or("").to_string());
        }
        if let Some(stroke) = node.style.get("textStroke").filter(|v| !v.is_null()) {
            if node.ntype != "text" {
                bail!("schema: textStroke 只适用于 text");
            }
            node.text_stroke = Some(TextStroke::parse(stroke)?);
        }
        if let Some(runs) = n.get_("runs").filter(|v| !v.is_null()) {
            if node.ntype != "text" || n.get_("text").is_some() {
                bail!("schema: runs 只用于 text，且不能与 text 字段混用");
            }
            if node.style.get("textWrap").is_none_or(Value::is_null) {
                bail!("schema: runs 需要显式 style.textWrap（none/word/grapheme）");
            }
            let (text, runs) = crate::text_layout::parse_runs(&deep_resolve(runs, ectx))?;
            node.text = Some(text);
            node.text_runs = runs;
            for run in &mut node.text_runs {
                self.resolve_font_style(&mut run.style);
            }
        }
        if let Some(wrap) = node.style.get("textWrap") {
            use crate::text_layout::Wrap;
            if node.ntype != "text" {
                bail!("schema: textWrap 只适用于 text");
            }
            node.text_wrap = Some(match wrap.as_str() {
                Some("none") => Wrap::None,
                Some("word") => Wrap::Word,
                Some("grapheme") => Wrap::Grapheme,
                _ => bail!("schema: textWrap 必须是 none | word | grapheme"),
            });
        }
        if let Some(split) = n.get_("split").filter(|v| !v.is_null()) {
            node.split = Some(parse_split_unit(split)?);
            if node.split == Some(motion::PartUnit::Line) && node.text_wrap.is_none() {
                node.text_wrap = Some(crate::text_layout::Wrap::None);
            }
        }
        if let Some(wrap) = node.text_wrap {
            if node.ntype != "text" {
                bail!("schema: paragraph layout 只适用于 text");
            }
            if wrap != crate::text_layout::Wrap::None
                && !node
                    .style
                    .get("width")
                    .and_then(Value::as_f64)
                    .is_some_and(|w| w.is_finite() && w > 0.0)
            {
                bail!("schema: 自动折行需要正数 style.width");
            }
            if node
                .style
                .get("lineHeight")
                .is_some_and(|v| !v.as_f64().is_some_and(|n| n.is_finite() && n > 0.0))
            {
                bail!("schema: lineHeight 须为正数像素");
            }
            if node
                .style
                .get("letterSpacing")
                .is_some_and(|v| !v.as_f64().is_some_and(f64::is_finite))
            {
                bail!("schema: letterSpacing 须为有限像素数");
            }
            if node
                .style
                .get("textAlign")
                .is_some_and(|v| !matches!(v.as_str(), Some("left" | "center" | "right")))
            {
                bail!("schema: textAlign 须为 left | center | right");
            }
            if node
                .style
                .get("fontSize")
                .is_some_and(|v| !v.as_f64().is_some_and(|n| n.is_finite() && n > 0.0))
            {
                bail!("schema: fontSize 须为正数像素");
            }
            if node.style.get("fontWeight").is_some_and(|v| {
                !v.as_f64()
                    .is_some_and(|n| n.is_finite() && (1.0..=1000.0).contains(&n))
            }) {
                bail!("schema: fontWeight 须在 1..1000");
            }
        }
        // Effect stack / blend / clip shape (spec §6.6, §6.3). All three are finalized here. At record time only the resolved results are read, and JSON is no longer touched.
        if let Some(effects) = n.get_("effects").filter(|v| !v.is_null()) {
            node.effects = parse_effects(&deep_resolve(effects, ectx))?;
        }
        if let Some(effects) = n.get_("backdropEffects").filter(|v| !v.is_null()) {
            node.backdrop_effects = parse_effects(&deep_resolve(effects, ectx))?;
            for effect in &node.backdrop_effects {
                if !effect.effect.id.starts_with("filter.") {
                    bail!(
                        "effect-capability-unsupported: backdropEffects 只接受 filter.* 单输入滤镜"
                    );
                }
            }
        }
        if let Some(mode) = node.style.get("blendMode").and_then(Value::as_str) {
            node.blend = motion::effect::BlendMode::parse(mode).ok_or_else(|| {
                anyhow!(
                    "schema: style.blendMode \"{mode}\" 不在封闭枚举 {:?}（§6.6）",
                    motion::effect::BlendMode::ALL.map(motion::effect::BlendMode::as_str)
                )
            })?;
        }
        if let Some(clip) = node.style.get("clipPath") {
            node.clip_poly = ClipPoly::parse(clip)?;
            if node.clip_poly.is_none() {
                node.clip_shape = ClipShape::parse(clip)?;
            }
        }
        // `background` gradient / `shadow` / `fontStyle` / `mask` (spec §6.3): all are finalized and validated here. Not one key that lint lets through and recording cannot draw is left behind.
        if let Some(bg) = node.style.get("background") {
            node.bg_gradient = BgGradient::parse(bg)?;
        }
        if let Some(shadow) = node.style.get("shadow").filter(|v| !v.is_null()) {
            let shadow = BoxShadow::parse(shadow)?;
            let short_edge = self.canvas_short_edge();
            // Shadow comes before the author's explicit effects: it sits beneath the element, and subsequent filters apply to "element + shadow".
            node.effects.insert(0, shadow.to_effect(short_edge)?);
        }
        if let Some(border) = node.style.get("border").filter(|v| !v.is_null()) {
            node.border = Some(BoxBorder::parse(border)?);
        }
        if let Some(style) = node.style.get("fontStyle").filter(|v| !v.is_null()) {
            node.font_italic = match style.as_str() {
                Some("normal") => false,
                Some("italic") => true,
                _ => bail!("schema: style.fontStyle 必须是 normal | italic（§6.3）"),
            };
        }
        if let Some(mask) = node.style.get("mask").filter(|v| !v.is_null()) {
            node.mask = Some(ElementMask::parse(mask)?);
        }
        if let Some(cadence) = n.get_("cadence") {
            node.cadence = Cadence::parse(cadence)?;
        }
        if let Some(anchor) = node.style.get("anchor").and_then(Value::as_array) {
            let ok = anchor.len() == 2
                && anchor
                    .iter()
                    .all(|v| v.as_f64().is_some_and(|x| x.is_finite()));
            if !ok {
                bail!(
                    "schema: style.anchor 的数组形态必须是 [x, y] 两个有限数值（元素盒比例，§6.3）"
                );
            }
        }
        if matches!(
            node.ntype.as_str(),
            "image" | "video" | "animatedImage" | "lottie" | "program"
        ) {
            // src only accepts "$assets.x" (guaranteed by construction in spec §11.2; lint has already flagged bare paths as errors)
            let src = n.gstr("src").unwrap_or("");
            let id = asset_ref_id(src).ok_or_else(|| {
                anyhow!(
                    "asset-src-literal: {} 节点 src \"{src}\" 必须是 $assets.* 引用",
                    node.ntype
                )
            })?;
            node.asset_id = Some(id.to_string());
            node.media_start = n.gf64("mediaStart").unwrap_or(0.0);
            if let Some(meta) = self.media.get(id) {
                node.nat_w = meta.width;
                node.nat_h = meta.height;
            }
            if node.ntype == "video" {
                let (media_start, rate, segment, loop_media) = Self::video_media_fields(n)?;
                node.media_start = media_start;
                node.playback_rate = rate;
                node.segment = segment;
                node.loop_media = loop_media;
                node.fit = match n.gstr("fit") {
                    None => Fit::Cover,
                    Some(s) => Fit::parse(s)
                        .ok_or_else(|| anyhow!("video fit \"{s}\" 不在 cover|contain|fill"))?,
                };
                node.with_audio = n
                    .get_("withAudio")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                node.media_volume = clamp(n.gf64("volume").unwrap_or(1.0), 0.0, 1.0);
                if let Some(meta) = self.media.get(id) {
                    node.media_fps = meta.fps;
                    node.media_duration = meta.duration;
                }
            }
            if matches!(node.ntype.as_str(), "animatedImage" | "lottie" | "program") {
                // Media fields are isomorphic with §6.5 (except `withAudio` / `volume`, which none of these three has an audio track for)
                let (media_start, rate, segment, _) = Self::video_media_fields(n)?;
                node.media_start = media_start;
                node.playback_rate = rate;
                node.segment = segment;
                node.fit = match n.gstr("fit") {
                    None => Fit::Cover,
                    Some(s) => Fit::parse(s).ok_or_else(|| {
                        anyhow!("{} fit \"{s}\" 不在 cover|contain|fill", node.ntype)
                    })?,
                };
                // An explicit `loop` takes priority. If not written, it inherits the asset's own loop count (§6.5.1).
                // When metadata is missing, it falls back to infinite looping. In that case the frame table is also empty, and recording could not draw anything anyway, so loading has already failed fast.
                node.media_plays = match n.get_("loop").and_then(Value::as_bool) {
                    Some(true) => 0,
                    Some(false) => 1,
                    None => self.media.get(id).map(|meta| meta.plays).unwrap_or(0),
                };
                node.loop_media = node.media_plays != 1;
                if let Some(meta) = self.media.get(id) {
                    node.media_duration = meta.duration;
                }
                if let Some(table) = self.frame_tables.get(id) {
                    node.frame_starts_ms = table.clone();
                }
            }
        }
        if let Some(d) = n.get_("d") {
            node.path_d = Some(
                deep_resolve(d, ectx)
                    .as_str()
                    .ok_or_else(|| anyhow!("schema: path.d 须为字符串"))?
                    .to_owned(),
            );
        }
        if n.gstr("d").is_some_and(|value| value.starts_with('$'))
            && let Some(d) = &node.path_d
        {
            let parsed = crate::svgpath::parse_checked(d);
            if !parsed.unsupported.is_empty() {
                bail!(
                    "path-command-unsupported: path.d 含不支持的命令 {:?}",
                    parsed.unsupported
                );
            }
        }
        if let Some(mt) = n.get_("morphTo") {
            node.morph_d = parse_morph_to(&deep_resolve(mt, ectx), node.path_d.as_deref())?;
        }
        if let Some(st) = n.get_("stroke") {
            node.stroke = Rgba::parse_value(Some(&resolve_ref(st, ectx)));
        }
        if let Some(sw) = n.get_("strokeWidth") {
            node.stroke_width = deep_resolve(sw, ectx)
                .as_f64()
                .filter(|v| v.is_finite() && *v >= 0.0)
                .ok_or_else(|| anyhow!("schema: strokeWidth 须为有限非负数"))?;
        }
        if let Some(f) = n.get_("fill") {
            node.fill = Rgba::parse_value(Some(&resolve_ref(f, ectx)));
        }
        match n.gstr("fillRule") {
            None | Some("nonzero") => {}
            Some("evenodd") => node.fill_even_odd = true,
            Some(other) => bail!("schema: fillRule \"{other}\" 不在 nonzero|evenodd（§6.2.1）"),
        }
        if let Some(tx) = n.get_("texture") {
            node.texture = PathTexture::parse(&deep_resolve(tx, ectx))?;
        }
        if let Some(wb) = n.get_("wobble") {
            node.wobble = PathWobble::parse(&deep_resolve(wb, ectx))?;
        }
        if let Some(cap) = n.gstr("lineCap") {
            node.line_cap = LineCap::parse(cap)
                .ok_or_else(|| anyhow!("schema: lineCap \"{cap}\" 不在 butt|round|square"))?;
        }
        if let Some(join) = n.gstr("lineJoin") {
            node.line_join = LineJoin::parse(join)
                .ok_or_else(|| anyhow!("schema: lineJoin \"{join}\" 不在 miter|round|bevel"))?;
        }
        if let Some(dash) = n.get_("dash") {
            node.dash = crate::pathstyle::parse_dash(&deep_resolve(dash, ectx))?;
        }
        for (key, stroke) in [("sizeScale", false), ("strokeScale", true)] {
            if let Some(value) = n.get_(key) {
                let screen = match deep_resolve(value, ectx).as_str() {
                    Some("scene") => false,
                    Some("screen") => true,
                    _ => bail!("schema: {key} 须为 scene|screen"),
                };
                if stroke {
                    if node.ntype != "path" {
                        bail!("schema: strokeScale 只用于 path");
                    }
                    node.screen_stroke = screen;
                } else {
                    node.screen_size = screen;
                }
            }
        }
        if let Some(trim) = n.get_("trim") {
            if node.ntype != "path" {
                bail!("schema: trim 只用于 path");
            }
            let trim = deep_resolve(trim, ectx);
            let map = trim
                .as_object()
                .ok_or_else(|| anyhow!("schema: trim 须为 {{start,end}}"))?;
            if map.keys().any(|k| !matches!(k.as_str(), "start" | "end")) {
                bail!("schema: trim 含未知字段");
            }
            let number = |key: &str, default: f64| -> Result<f64> {
                match map.get(key) {
                    None => Ok(default),
                    Some(v) => v
                        .as_f64()
                        .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                        .ok_or_else(|| anyhow!("schema: trim.{key} 须在 0..1")),
                }
            };
            let (start, end) = (number("start", 0.0)?, number("end", 1.0)?);
            if start > end {
                bail!("schema: trim.start 不能超过 end");
            }
            node.path_trim = Some((start, end));
        }
        if let Some(offset) = n.get_("dashOffset") {
            if node.ntype != "path" {
                bail!("schema: dashOffset 只用于 path");
            }
            node.dash_offset = deep_resolve(offset, ectx)
                .as_f64()
                .filter(|v| v.is_finite())
                .ok_or_else(|| anyhow!("schema: dashOffset 须为有限路径单位"))?;
        }
        if let Some(brush) = n.get_("brush").filter(|v| !v.is_null()) {
            if node.ntype != "path" {
                bail!("schema: brush 只用于 path");
            }
            node.stroke_brush = Some(crate::pathstyle::StrokeBrush::parse(&deep_resolve(
                brush, ectx,
            ))?);
        }
        if let Some(echo) = n.get_("echo") {
            node.echo = Some(crate::temporal::Echo::parse(&deep_resolve(echo, ectx))?);
        }
        if let Some(follow) = n.get_("follow") {
            node.follow = Some(crate::pathstyle::PathFollow::parse(&deep_resolve(
                follow, ectx,
            ))?);
        }
        if let Some(vb) = n.gstr("viewBox") {
            let p: Vec<f64> = vb
                .split_whitespace()
                .filter_map(|x| x.parse().ok())
                .collect();
            if p.len() == 4 {
                node.view_box = Some([p[0], p[1], p[2], p[3]]);
            }
        }
        let empty = Vec::new();
        let kids = n
            .get_("children")
            .and_then(Value::as_array)
            .unwrap_or(&empty);
        for (i, c) in kids.iter().enumerate() {
            node.children.push(self.expand_node_guarded(
                c,
                ectx,
                depth,
                &octx.child(&path_segment(kids, i)),
            )?);
        }
        Ok(node)
    }

    /// Time pre-resolution for flow / parts (plan §3.2.2).
    ///
    /// `ccut-motion` does not understand TimeExpr (ADR-M01 forbids a reverse dependency on `ccut-core`), so before handing the JSON to it, each op's `at` / `repeat.until` is converted here into **absolute seconds**. Numbers are clip-local seconds (consistent with `keyframes[].t`). `"clip.start"` / `"clip.end"` are the two reserved strings of spec §7.5 (they are not valid TimeExprs). Everything else is evaluated as a TimeExpr.
    fn preresolve_flow_times(&self, value: &Value, win: (f64, f64)) -> Result<Value> {
        match value {
            Value::Array(items) => Ok(Value::Array(
                items
                    .iter()
                    .map(|item| self.preresolve_flow_times(item, win))
                    .collect::<Result<Vec<_>>>()?,
            )),
            Value::Object(map) => {
                let is_op = map.contains_key("op");
                let mut out = Map::new();
                for (key, item) in map {
                    if is_op && (key == "at" || key == "until") {
                        out.insert(key.clone(), Value::from(self.eval_flow_time(item, win)?));
                        continue;
                    }
                    out.insert(key.clone(), self.preresolve_flow_times(item, win)?);
                }
                Ok(Value::Object(out))
            }
            other => Ok(other.clone()),
        }
    }

    fn eval_flow_time(&self, value: &Value, win: (f64, f64)) -> Result<f64> {
        if let Some(n) = value.as_f64() {
            return Ok(win.0 + n);
        }
        match value.as_str() {
            Some("clip.start") => return Ok(win.0),
            Some("clip.end") => return Ok(win.1),
            _ => {}
        }
        self.eval_t(value)?
            .ok_or_else(|| anyhow!("time-ref-unknown: flow 时间 {value} 无法求值"))
    }

    /// One track of `CompiledFlow` → `Channel`. The `v` of keyframes is the raw JSON (possibly still an unevaluated relative-length object), and goes through the same finalize as the legacy channels.
    fn flow_track_channel(track: &motion::FlowTrack) -> Channel {
        Channel {
            prop: track.prop.clone(),
            frames: track
                .frames
                .iter()
                .map(|frame| Kf {
                    t: frame.t,
                    v: frame.v.clone(),
                    ease: frame.ease.clone(),
                })
                .collect(),
            meta: None,
            composite: track.composite,
            order: track.order,
        }
    }

    fn compile_ctx(&self, win: (f64, f64)) -> motion::CompileCtx {
        motion::CompileCtx {
            fps: self.fps,
            window: (win.0, Some(win.1)),
            project_end: win.1,
            time_base: motion::TimeBase::Absolute,
            default_seed: 0,
        }
    }

    /// `animate.flow` → absolute-time channels (spec §7.5).
    fn flow_channels(&self, flow: &Value, win: (f64, f64), extra: f64) -> Result<Vec<Channel>> {
        fn text_tween(value: &Value) -> bool {
            match value {
                Value::Object(map) => {
                    (map.get("op").and_then(Value::as_str) == Some("tween")
                        && map.get("prop").and_then(Value::as_str) == Some("text"))
                        || map.values().any(text_tween)
                }
                Value::Array(values) => values.iter().any(text_tween),
                _ => false,
            }
        }
        if text_tween(flow) {
            bail!("schema: text 内容使用离散 keyframes 或 flow.set，不使用 tween");
        }
        let resolved = self.preresolve_flow_times(flow, win)?;
        let mut graph = motion::parse_flow(&resolved, &motion::FlowParseCtx::default())
            .map_err(|error| anyhow!("{error}"))?;
        // Spec §10.3: `use.stagger.delay` and `RNode::extra_delay` wrap the whole flow (a flow has no enter slot), and absolute `at` values shift along with it.
        graph = wrap_extra_delay(graph, extra);
        let compiled = motion::compile_flow(&graph, &self.compile_ctx(win))
            .map_err(|error| anyhow!("{error}"))?;
        Ok(compiled
            .tracks
            .iter()
            .map(Self::flow_track_channel)
            .collect())
    }

    /// `animate.parts` → a group of channels per part (spec §7.9).
    fn part_motion(
        &self,
        parts: &Value,
        node: &RNode,
        win: (f64, f64),
        extra: f64,
    ) -> Result<Option<PartMotion>> {
        if node.ntype != "text" {
            bail!("schema: animate.parts 只能用在 text 节点上（§7.9）");
        }
        let text = node.text.clone().unwrap_or_default();
        let unit = node.split.unwrap_or(motion::PartUnit::Char);
        let map = motion::PartMap::build(&text, unit);
        if map.is_empty() {
            return Ok(None);
        }
        let resolved = self.preresolve_flow_times(parts, win)?;
        let mut graph = motion::parse_parts(
            &resolved,
            &motion::FlowParseCtx {
                part_count: map.len(),
                default_seed: 0,
            },
        )
        .map_err(|error| anyhow!("{error}"))?;
        graph = wrap_extra_delay(graph, extra);
        let compiled = motion::compile_flow(&graph, &self.compile_ctx(win))
            .map_err(|error| anyhow!("{error}"))?;
        let mut channels: Vec<Vec<Channel>> = vec![Vec::new(); map.len()];
        for track in &compiled.tracks {
            let index = track.target.0 as usize;
            if index == 0 || index > map.len() {
                bail!("motion-flow-invalid: animate.parts 产出了越界的 part target {index}");
            }
            channels[index - 1].push(Self::flow_track_channel(track));
        }
        Ok(Some(PartMotion { map, channels }))
    }

    // ── Element animation → absolute-time channels ──
    //
    // Phase 2: the channels are laid out here (diagnostic timing is unchanged), but **relative lengths are not evaluated**.
    // The raw `{value, basis, offset}` objects stay in `Kf.v`, and `build_channels_after_layout` converts them to px after layout (design §5.5 / §10 phase 2).
    pub fn build_channels(&self, node: &mut RNode, win: (f64, f64)) -> Result<()> {
        if matches!(
            node.ntype.as_str(),
            "video" | "animatedImage" | "lottie" | "program" | "composition" | "charGrid" | "proc"
        ) {
            // Media time = mediaStart + (t - clip.start) = t - media_t0 (rate=1 view)
            node.media_t0 = win.0 - node.media_start;
            node.media_win_start = win.0;
        }
        let mut chs: Vec<Channel> = Vec::new();
        let extra = node.extra_delay;
        if let Some(a) = node.animate.clone() {
            // Spec §7.5: the same element must not have both the four slots and `flow`. Checked twice, by lint and resolve (precedent: `transition-mismatch`). `ccut render` also rejects it.
            if a.get_("flow").is_some()
                && LEGACY_ANIMATE_SLOTS
                    .iter()
                    .any(|slot| a.get_(slot).is_some_and(|v| !v.is_null()))
            {
                bail!(
                    "motion-legacy-and-flow: 元素 \"{}\" 同时声明了 animate.flow 与 enter/exit/emphasis/keyframes（§7.5）",
                    node.id
                );
            }
            if let Some(flow) = a.get_("flow").filter(|v| !v.is_null()) {
                chs.extend(self.flow_channels(flow, win, extra)?);
            }
            if let Some(parts) = a.get_("parts").filter(|v| !v.is_null()) {
                if node.split == Some(motion::PartUnit::Line) {
                    if node.ntype != "text" {
                        bail!("schema: animate.parts 只能用在 text");
                    }
                    node.pending_line_motion = Some(PendingLineMotion {
                        spec: self.preresolve_flow_times(parts, win)?,
                        context: self.compile_ctx(win),
                        extra,
                    });
                } else {
                    node.part_motion = self.part_motion(parts, node, win, extra)?;
                }
            }
            if let Some(enter) = a.get_("enter") {
                if enter.gstr("preset").is_some() {
                    chs.extend(self.slot_channels(
                        enter,
                        win.0 + enter.gf64("delay").unwrap_or(0.0) + extra,
                        enter.gf64("dur").unwrap_or(0.5),
                        SLOT_ORDER_ENTER,
                    )?);
                }
            }
            if let Some(exit) = a.get_("exit") {
                if exit.gstr("preset").is_some() {
                    let d = exit.gf64("dur").unwrap_or(0.3);
                    chs.extend(self.slot_channels(exit, win.1 - d, d, SLOT_ORDER_EXIT)?);
                }
            }
            for (index, em) in a
                .get_("emphasis")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
                .iter()
                .enumerate()
            {
                if em.gstr("preset").is_none() {
                    continue;
                }
                let at = self
                    .eval_t(em.get_("at").unwrap_or(&Value::Null))?
                    .ok_or_else(|| anyhow!("emphasis.at 无法求值"))?;
                chs.extend(self.slot_channels(
                    em,
                    at,
                    em.gf64("dur").unwrap_or(0.5),
                    SLOT_ORDER_EMPHASIS + index as u32,
                )?);
            }
            for (index, kf) in a
                .get_("keyframes")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
                .iter()
                .enumerate()
            {
                let Some(prop) = kf.gstr("prop") else {
                    continue;
                };
                let mut frames = Vec::new();
                for f in kf
                    .get_("frames")
                    .and_then(Value::as_array)
                    .unwrap_or(&Vec::new())
                {
                    let tv = f.get_("t").cloned().unwrap_or(Value::Null);
                    let t = if let Some(pct) = tv
                        .as_str()
                        .and_then(|s| s.strip_suffix('%'))
                        .and_then(|s| s.parse::<f64>().ok())
                    {
                        win.0 + pct / 100.0 * (win.1 - win.0)
                    } else if let Some(n) = tv.as_f64() {
                        win.0 + n
                    } else {
                        self.eval_t(&tv)?
                            .ok_or_else(|| anyhow!("keyframe t 无法求值: {tv}"))?
                    };
                    frames.push(Kf {
                        t,
                        v: f.get_("v").cloned().unwrap_or(Value::Null),
                        ease: f.gstr("ease").map(String::from),
                    });
                }
                // A `textCount` track may carry `format: { decimals, prefix, suffix, negativePrefix,
                // grouping, pad }` (§7.1). The first three have the same meaning as countUp's display parameters.
                let meta = (prop == "textCount")
                    .then(|| kf.get_("format"))
                    .flatten()
                    .map(|format| {
                        let resolved = deep_resolve(format, &self.ctx);
                        let Value::Object(map) = resolved else {
                            bail!("schema: textCount format 必须是对象");
                        };
                        validate_count_format(&map)?;
                        Ok(map)
                    })
                    .transpose()?;
                let mut channel = Channel::replace(prop.to_string(), frames, meta);
                channel.order = (SLOT_ORDER_KEYFRAMES + index as u32) * SLOT_ORDER_STRIDE;
                chs.push(channel);
            }
        }
        node.channels = chs;
        for channel in &node.channels {
            if matches!(
                channel.prop.as_str(),
                "text" | "textReveal" | "fontWeight" | "letterSpacing"
            ) {
                if node.ntype != "text" {
                    bail!("schema: {} 只适用于 text", channel.prop);
                }
                for frame in &channel.frames {
                    let valid = match channel.prop.as_str() {
                        "text" => frame.v.is_string(),
                        _ => frame.v.as_f64().is_some_and(f64::is_finite),
                    };
                    if !valid {
                        bail!("schema: {} 通道值类型或范围无效", channel.prop);
                    }
                }
            }
        }
        if !node.text_runs.is_empty()
            && node
                .channels
                .iter()
                .any(|c| matches!(c.prop.as_str(), "text" | "textCount"))
        {
            bail!("schema: 富文本 runs 保持静态；内容/计数变化请使用独立 text 节点");
        }
        if node.channels.iter().any(|c| c.prop == "text")
            && node.channels.iter().any(|c| c.prop == "textCount")
        {
            bail!("schema: text 与 textCount 通道不能混用");
        }
        for channel in &node.channels {
            if matches!(channel.prop.as_str(), "crop" | "focalX" | "focalY") {
                if channel.composite != motion::CompositeMode::Replace {
                    bail!("schema: crop/focal 通道只接受 replace");
                }
                if !matches!(node.ntype.as_str(), "image" | "video" | "animatedImage") {
                    bail!("schema: {} 只用于位图媒体", channel.prop);
                }
                for frame in &channel.frames {
                    if channel.prop == "crop" {
                        crate::composition::crop(&frame.v)?;
                    } else if !frame
                        .v
                        .as_f64()
                        .is_some_and(|v| v.is_finite() && (0.0..=1.0).contains(&v))
                    {
                        bail!("schema: focalX/focalY 帧须在 0..1");
                    }
                }
            }
        }
        for channel in &node.channels {
            if matches!(
                channel.prop.as_str(),
                "pathStart" | "pathEnd" | "dashOffset" | "pathProgress"
            ) {
                if channel.composite != motion::CompositeMode::Replace {
                    bail!("schema: 路径范围/跟随通道只接受 replace");
                }
                if channel.prop == "pathProgress" {
                    if node.follow.is_none() {
                        bail!("schema: pathProgress 需要 follow.source");
                    }
                } else if node.ntype != "path" {
                    bail!("schema: {} 只用于 path", channel.prop);
                }
                for frame in &channel.frames {
                    if !frame.v.as_f64().is_some_and(|v| {
                        v.is_finite() && (channel.prop == "dashOffset" || (0.0..=1.0).contains(&v))
                    }) {
                        bail!("schema: 路径范围/跟随通道须为 0..1，dashOffset 须为有限数值");
                    }
                }
            }
        }
        validate_render_channels(node)?;
        let child_win = node
            .composition
            .as_ref()
            .map_or(win, |canvas| (0.0, canvas.duration));
        for c in &mut node.children {
            self.build_channels(c, child_win)?;
        }
        Ok(())
    }

    /// Canvas short side in pixels (`meta.width` / `meta.height`). Used to fold `style.shadow` into relative lengths.
    fn canvas_short_edge(&self) -> f64 {
        let meta = self.doc.get_("meta");
        let w = meta.and_then(|m| m.gf64("width")).unwrap_or(1920.0);
        let h = meta.and_then(|m| m.gf64("height")).unwrap_or(1080.0);
        w.min(h).max(1.0)
    }

    /// One preset reference (`enter` / `exit` / `emphasis[i]`) → absolute-time channels.
    ///
    /// Three paths, following the rule in spec §7.4 that the more specific name wins on a clash: project-level `presets` →
    /// generic manifest (the `motion.*` canonical families and their aliases) → frozen `bcf.*@1`.
    fn slot_channels(
        &self,
        reference: &Value,
        t0: f64,
        dur: f64,
        slot_order: u32,
    ) -> Result<Vec<Channel>> {
        let name = reference.gstr("preset").unwrap_or_default();
        let version = reference
            .get_("presetVersion")
            .and_then(Value::as_u64)
            .map(|v| v as u32);
        let project_level = self
            .doc
            .get_("presets")
            .and_then(|p| p.get_(name))
            .is_some();
        let base = slot_order * SLOT_ORDER_STRIDE;

        if !project_level {
            let canonical = motion::preset_registry::canonical_id(name);
            if motion::preset_registry::manifest(canonical).is_some() {
                let mut params = Map::new();
                if let Some(user) = reference.get_("params").and_then(Value::as_object) {
                    for (k, v) in user {
                        params.insert(k.clone(), deep_resolve(v, &self.ctx));
                    }
                }
                let expanded = motion::preset_registry::expand(
                    name,
                    version,
                    &params,
                    &motion::preset_registry::ExpandCtx::with_dur(dur),
                )
                .map_err(|error| anyhow!("{error}"))?;
                return Ok(expanded
                    .tracks
                    .into_iter()
                    .map(|track| Channel {
                        prop: track.prop,
                        frames: track
                            .frames
                            .into_iter()
                            .map(|frame| Kf {
                                t: t0 + frame.t,
                                v: frame.v,
                                ease: frame.ease,
                            })
                            .collect(),
                        meta: None,
                        composite: track.composite,
                        order: base + track.order,
                    })
                    .collect());
            }
        }
        // Spec §7.4: a `presetVersion` higher than the version the implementation knows is an error. It must not silently use the latest.
        // Project-level presets and the frozen `bcf.*` recipes both only have version 1.
        if let Some(version) = version {
            if version > 1 {
                bail!("preset-version-unknown: \"{name}@{version}\" > 1");
            }
        }
        let (kfs, meta) = self.expand_preset_def(name, reference.get_("params"), &self.ctx)?;
        let mut channels = Self::lay_preset_frames(&kfs, t0, dur, meta);
        for channel in &mut channels {
            channel.order = base;
        }
        Ok(channels)
    }

    // ── Transition vocabulary (dual channel, spec §9) ──
    //
    // Recipes live in `core/presets/builtin/transition/bcf.*.json`: `prop`, ease, and the relative lengths at both ends (`canvasWidth` / `canvasHeight`) are all data. Note that the 3rd parameter `h` is the **half duration**, and the 5th, `canvas_h`, is the canvas height.
    fn transition_channels(
        &self,
        preset: &str,
        t0: f64,
        h: f64,
        w: f64,
        canvas_h: f64,
        is_out: bool,
    ) -> Result<Vec<Channel>> {
        let recipe = motion::preset_registry::bcf_transition(preset)
            .ok_or_else(|| anyhow!("transition-unknown: \"{preset}\""))?;
        let ctx = motion::LengthContext::canvas(w, canvas_h);
        Ok(
            motion::lower_bcf::transition_channels(recipe, t0, h, &ctx, is_out)
                .map_err(|error| anyhow!("{error}"))?
                .into_iter()
                .map(|channel| channel_from_ir(channel, None))
                .collect(),
        )
    }

    /// Whether a `transitionIn/Out` declaration is a **Surface Transition** (spec §9, second kind).
    ///
    /// The decision depends only on which registry the name falls into. First check the Motion recipes (`crossfade` / `slideLeft` …), then the effect registry's `transition.*` domain. If neither has it, it is `transition-unknown`. There is **no silent fallback** to crossfade.
    ///
    /// `fallback` must be a Motion recipe. A degradation lands on the property track, so it can never be another Surface effect that is equally unable to run.
    #[allow(clippy::too_many_arguments)]
    fn surface_transition(
        &self,
        preset: &str,
        spec: Option<&Value>,
        from_clip: &str,
        to_clip: &str,
        t0: f64,
        half: f64,
        w: f64,
        canvas_h: f64,
    ) -> Result<Option<SurfaceTransition>> {
        use motion::effect::{EffectDomain, UniformMap, lookup};

        if motion::preset_registry::bcf_transition(preset).is_some() {
            return Ok(None);
        }
        if !preset.starts_with("transition.") {
            bail!("transition-unknown: \"{preset}\"");
        }
        let version = match spec.and_then(|value| value.get_("presetVersion")) {
            Some(value) if !value.is_null() => value
                .as_u64()
                .ok_or_else(|| anyhow!("schema: transitionIn/Out.presetVersion 必须是整数"))?
                as u32,
            _ => 1,
        };
        let manifest = match lookup(preset, version) {
            Ok(manifest) => manifest,
            // "No such name" is transition-unknown. "No such version" is preset-version-unknown. The two must not be merged into one sentence.
            Err(motion::MotionError::PresetUnknown(_)) => {
                bail!("transition-unknown: \"{preset}\"")
            }
            Err(error) => bail!("{error}"),
        };
        if manifest.domain != EffectDomain::Transition {
            bail!(
                "transition-unknown: \"{preset}\" 是 {} 域的效果，不是转场（§9）",
                manifest.domain.as_str()
            );
        }

        let mut given = UniformMap::new();
        if let Some(params) = spec
            .and_then(|value| value.get_("params"))
            .and_then(Value::as_object)
        {
            for (key, raw) in params {
                let param = manifest.params.get(key).ok_or_else(|| {
                    anyhow!(
                        "preset-param-unknown: {} 没有参数 {key}；{}（§9）",
                        manifest.qualified(),
                        manifest.params_hint()
                    )
                })?;
                given.insert(
                    key.clone(),
                    uniform_from_json(param.kind, key, &resolve_ref(raw, &self.ctx), manifest)?,
                );
            }
        }
        let uniforms = manifest
            .resolve_uniforms(&given)
            .map_err(|error| anyhow!("{error}"))?;

        let fallback = spec
            .and_then(|value| value.gstr("fallback"))
            .unwrap_or("crossfade")
            .to_owned();
        if motion::preset_registry::bcf_transition(&fallback).is_none() {
            bail!(
                "transition-unknown: \"{preset}\" 的 fallback \"{fallback}\" 不是 Motion Transition（§9）"
            );
        }

        Ok(Some(SurfaceTransition {
            from_clip: from_clip.to_owned(),
            to_clip: to_clip.to_owned(),
            effect: manifest.effect_ref(),
            uniforms,
            t0,
            half,
            fallback_out: self.transition_channels(&fallback, t0, half, w, canvas_h, true)?,
            fallback_in: self.transition_channels(&fallback, t0, half, w, canvas_h, false)?,
            fallback,
        }))
    }

    // ── Main entry ──
    pub fn resolve(&mut self) -> Result<Ir> {
        let doc = self.doc.clone();
        let meta = doc.get_("meta").ok_or_else(|| anyhow!("缺少 meta"))?;
        let w = meta.gf64("width").unwrap_or(1920.0);
        let h = meta.gf64("height").unwrap_or(1080.0);
        let fps = meta.gf64("fps").unwrap_or(30.0);
        // `meta.background`: a colour, or `{ color, texture }` (spec §4).
        let bg_value = deep_resolve(meta.get_("background").unwrap_or(&Value::Null), &self.ctx);
        let bg_texture = match bg_value.as_object() {
            Some(map) => {
                for key in map.keys() {
                    if key != "color" && key != "texture" {
                        bail!(
                            "schema: meta.background 没有键 \"{key}\"（封闭键集 [color, texture]）"
                        );
                    }
                }
                match map.get("texture") {
                    Some(texture) => PathTexture::parse(texture)?,
                    None => None,
                }
            }
            None => None,
        };
        let bg = Rgba::parse_value(Some(match bg_value.as_object() {
            Some(map) => map.get("color").unwrap_or(&Value::Null),
            None => &bg_value,
        }))
        .unwrap_or(Rgba {
            r: 0.0,
            g: 0.0,
            b: 0.0,
            a: 1.0,
        });

        // cue table. dur accepts a number or a "$vars.x" numeric variable (§5.1 / §11.1)
        let mut acc = 0.0;
        let mut scenes: Vec<(String, f64, f64)> = Vec::new();
        for s in doc
            .get_("scenes")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            let Some(id) = s.gstr("id") else { continue };
            let dur = match s.get_("dur") {
                Some(v @ Value::String(_)) => {
                    let r = resolve_ref(v, &self.ctx);
                    r.as_f64().ok_or_else(|| {
                        anyhow!("场景 \"{id}\" dur 变量引用 {v} 未解析为数字（实为 {r}）")
                    })?
                }
                Some(v) => match v.as_f64() {
                    Some(d) => d,
                    None => continue,
                },
                None => continue,
            };
            self.cues.insert(id.to_string(), (acc, dur, acc + dur));
            scenes.push((id.to_string(), acc, acc + dur));
            acc += dur;
        }
        self.total = acc;

        // clip window: fixed-point iteration (DAG)
        let mut all_clips: Vec<(String, Value)> = Vec::new();
        for tr in doc
            .get_("tracks")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            let kind = tr.gstr("kind").unwrap_or("visual").to_string();
            for c in tr
                .get_("clips")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                all_clips.push((kind.clone(), c.clone()));
            }
        }
        for (_, c) in &all_clips {
            if let Some(id) = c.gstr("id") {
                self.clip_wins.insert(id.to_string(), (None, None));
            }
        }
        // Media reference point index (needed for word-anchor evaluation; must come before window iteration)
        self.media_refs = self.collect_media_refs(&all_clips)?;
        let mut progress = true;
        let mut guard = 0;
        while progress && guard < 200 {
            guard += 1;
            progress = false;
            for (_, c) in &all_clips {
                let Some(id) = c.gstr("id") else { continue };
                let Some(mut win) = self.clip_wins.get(id).copied() else {
                    continue;
                };
                if win.0.is_none() {
                    if let Some(v) = self.eval_t(c.get_("start").unwrap_or(&Value::from(0)))? {
                        win.0 = Some(v);
                        progress = true;
                    }
                }
                if let Some(ws) = win.0 {
                    if win.1.is_none() {
                        if let Some(e) = c.get_("end").filter(|e| !e.is_null()) {
                            if let Some(v) = self.eval_t(e)? {
                                win.1 = Some(v);
                                progress = true;
                            }
                        } else if let Some(d) = c.gf64("dur") {
                            win.1 = Some(ws + d);
                            progress = true;
                        } else {
                            win.1 = Some(self.total);
                            progress = true;
                        }
                    }
                }
                self.clip_wins.insert(id.to_string(), win);
            }
        }
        for (_, c) in &all_clips {
            let id = c.gstr("id").unwrap_or("?");
            let win = self.clip_wins.get(id).copied().unwrap_or((None, None));
            if win.0.is_none() || win.1.is_none() {
                bail!("time-ref-cycle: clip \"{id}\" 的时间引用无法收敛");
            }
        }

        let cadence_fps = match meta.get_("cadence") {
            Some(value) => Cadence::parse(value)?.apply(None),
            None => None,
        };
        let mut ir = Ir {
            total: self.total,
            fps,
            cadence_fps,
            bg_texture,
            scenes,
            w,
            h,
            bg,
            visual_clips: Vec::new(),
            camera_clips: Vec::new(),
            caption_clips: Vec::new(),
            audio_clips: Vec::new(),
            audio: crate::audio_mix::DocAudio::parse(doc.get_("audio"))?,
            surface_transitions: Vec::new(),
        };

        // visual tracks: expansion + transition materialization
        let mut order = 0usize;
        for tr in doc
            .get_("tracks")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            if tr.gstr("kind").unwrap_or("visual") != "visual" {
                continue;
            }
            let mut clips: Vec<(VisualClip, Value)> = Vec::new();
            for c in tr
                .get_("clips")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                let Some(id) = c.gstr("id") else { continue };
                let Some(&(Some(ws), Some(we))) = self.clip_wins.get(id) else {
                    continue;
                };
                let vc = VisualClip {
                    id: id.to_string(),
                    screen_space: match c.get_("space") {
                        None => false,
                        Some(v) => match v.as_str() {
                            Some("scene") => false,
                            Some("screen") => true,
                            _ => bail!("schema: clip.space 须为 scene|screen"),
                        },
                    },
                    start: ws,
                    end: we,
                    render_start: ws,
                    render_end: we,
                    z: c.gf64("z").unwrap_or(0.0),
                    order,
                    wrap_channels: Vec::new(),
                    cadence: match c.get_("cadence") {
                        Some(value) => Cadence::parse(value)?,
                        None => Cadence::Inherit,
                    },
                    tree: RNode::default(),
                };
                order += 1;
                clips.push((vc, c.clone()));
            }
            clips.sort_by(|a, b| a.0.start.partial_cmp(&b.0.start).unwrap());

            for i in 1..clips.len() {
                let (left, right) = clips.split_at_mut(i);
                let (prev, praw) = left.last_mut().unwrap();
                let (cur, craw) = &mut right[0];
                let tin = craw.get_("transitionIn");
                let tout = praw.get_("transitionOut");
                if tin.is_none() && tout.is_none() {
                    continue;
                }
                if (prev.end - cur.start).abs() > 1e-6 {
                    continue;
                }
                let pin = tin.and_then(|t| t.gstr("preset"));
                let pout = tout.and_then(|t| t.gstr("preset"));
                if let (Some(a), Some(b)) = (pin, pout) {
                    if a != b {
                        bail!("transition-mismatch: {} → {}", prev.id, cur.id);
                    }
                }
                let Some(preset) = pin.or(pout) else { continue };
                let dur = tin
                    .and_then(|t| t.gf64("dur"))
                    .unwrap_or(0.0)
                    .max(tout.and_then(|t| t.gf64("dur")).unwrap_or(0.0));
                let d = if dur > 0.0 { dur } else { 0.4 };
                let t0 = cur.start;
                let half = d / 2.0;
                prev.render_end = prev.render_end.max(t0 + half);
                cur.render_start = cur.render_start.min(t0 - half);
                // All three kinds of transition share the same overlap window (spec §9). Motion goes through the property tracks of both sides. Surface goes through the `Transition` pass, where the pictures on both sides do not move and are composited by the effect, so **no wrap channel is attached**. Attaching one would mean doing the same transition twice.
                match self.surface_transition(
                    preset,
                    tin.or(tout),
                    &prev.id,
                    &cur.id,
                    t0,
                    half,
                    w,
                    h,
                )? {
                    Some(entry) => ir.surface_transitions.push(entry),
                    None => {
                        prev.wrap_channels
                            .extend(self.transition_channels(preset, t0, half, w, h, true)?);
                        cur.wrap_channels
                            .extend(self.transition_channels(preset, t0, half, w, h, false)?);
                    }
                }
            }

            for (mut vc, raw) in clips {
                let el = raw
                    .get_("element")
                    .ok_or_else(|| anyhow!("clip {} 缺少 element", vc.id))?;
                let mut tree = self.expand_node(el, &self.ctx.clone())?;
                link_mask_sources(&mut tree)?;
                self.build_channels(&mut tree, (vc.start, vc.end))?;
                // withAudio syntactic sugar (§6.5): expanded at compile time into same-window audio entries
                collect_with_audio(&tree, &vc, &mut ir.audio_clips)?;
                vc.tree = tree;
                ir.visual_clips.push(vc);
            }
        }
        ir.visual_clips.sort_by(|a, b| {
            if a.z != b.z {
                a.z.partial_cmp(&b.z).unwrap()
            } else {
                a.order.cmp(&b.order)
            }
        });

        // camera track
        for tr in doc
            .get_("tracks")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            if tr.gstr("kind") != Some("camera") {
                continue;
            }
            for c in tr
                .get_("clips")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                let Some(id) = c.gstr("id") else { continue };
                let Some(&(Some(ws), Some(we))) = self.clip_wins.get(id) else {
                    continue;
                };
                let cam = c
                    .get_("camera")
                    .ok_or_else(|| anyhow!("schema: camera clip {id} 缺少 camera 配置"))?;
                let frames: Vec<Kf> = if let Some(preset) = cam.gstr("preset") {
                    let (kfs, _) = self.expand_preset_def(preset, cam.get_("params"), &self.ctx)?;
                    Self::lay_preset_frames(&kfs, ws, we - ws, None)
                        .into_iter()
                        .next()
                        .map(|c| c.frames)
                        .unwrap_or_default()
                } else {
                    let mut out = Vec::new();
                    for f in cam
                        .get_("keyframes")
                        .and_then(Value::as_array)
                        .unwrap_or(&Vec::new())
                    {
                        let tv = f.get_("t").cloned().unwrap_or(Value::Null);
                        let t = if let Some(pct) = tv
                            .as_str()
                            .and_then(|s| s.strip_suffix('%'))
                            .and_then(|s| s.parse::<f64>().ok())
                        {
                            ws + pct / 100.0 * (we - ws)
                        } else if let Some(n) = tv.as_f64() {
                            ws + n
                        } else {
                            self.eval_t(&tv)?
                                .ok_or_else(|| anyhow!("camera keyframe t 无法求值"))?
                        };
                        out.push(Kf {
                            t,
                            v: f.get_("v").cloned().unwrap_or(Value::Null),
                            ease: f.gstr("ease").map(String::from),
                        });
                    }
                    out
                };
                ir.camera_clips.push(CameraClip {
                    start: ws,
                    end: we,
                    frames,
                });
            }
        }

        // audio track (§8.4): the volume channel supports % (window proportion), relative seconds, and TimeExpr
        for (track_index, tr) in doc
            .get_("tracks")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
            .iter()
            .enumerate()
        {
            if tr.gstr("kind") != Some("audio") {
                continue;
            }
            let track_id = tr
                .gstr("id")
                .map_or_else(|| format!("#{track_index}"), str::to_owned);
            let track_muted = match tr.get_("muted") {
                None | Some(Value::Null) => false,
                Some(Value::Bool(b)) => *b,
                Some(other) => bail!("schema: audio 轨 \"{track_id}\" muted 必须是布尔：{other}"),
            };
            let track_bus = crate::audio_mix::default_bus(Some(&track_id));
            for c in tr
                .get_("clips")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                let Some(id) = c.gstr("id") else { continue };
                let Some(&(Some(ws), Some(we))) = self.clip_wins.get(id) else {
                    continue;
                };
                let raw_src = c.gstr("src").unwrap_or("");
                let asset_id = asset_ref_id(raw_src)
                    .ok_or_else(|| {
                        anyhow!("asset-src-literal: audio clip \"{id}\" src \"{raw_src}\" 必须是 $assets.* 引用")
                    })?
                    .to_string();
                let mut volume: Vec<Kf> = Vec::new();
                if let Some(a) = c.get_("animate") {
                    for kf in a
                        .get_("keyframes")
                        .and_then(Value::as_array)
                        .unwrap_or(&Vec::new())
                    {
                        if kf.gstr("prop") != Some("volume") {
                            continue;
                        }
                        for f in kf
                            .get_("frames")
                            .and_then(Value::as_array)
                            .unwrap_or(&Vec::new())
                        {
                            let tv = f.get_("t").cloned().unwrap_or(Value::Null);
                            let t = if let Some(pct) = tv
                                .as_str()
                                .and_then(|s| s.strip_suffix('%'))
                                .and_then(|s| s.parse::<f64>().ok())
                            {
                                ws + pct / 100.0 * (we - ws)
                            } else if let Some(n) = tv.as_f64() {
                                ws + n
                            } else {
                                self.eval_t(&tv)?.ok_or_else(|| {
                                    anyhow!("audio volume keyframe t 无法求值: {tv}")
                                })?
                            };
                            volume.push(Kf {
                                t,
                                v: f.get_("v").cloned().unwrap_or(Value::Null),
                                ease: f.gstr("ease").map(String::from),
                            });
                        }
                    }
                }
                let media_duration = self
                    .media
                    .get(&asset_id)
                    .map(|meta| meta.duration)
                    .filter(|d| d.is_finite() && *d > 0.0)
                    .unwrap_or(0.0);
                let seconds = |key: &str| -> Result<f64> {
                    match c.get_(key) {
                        None | Some(Value::Null) => Ok(0.0),
                        Some(v) => v
                            .as_f64()
                            .filter(|x| x.is_finite() && *x >= 0.0)
                            .ok_or_else(|| {
                                anyhow!("schema: audio clip \"{id}\" {key} 必须是 ≥ 0 的秒数")
                            }),
                    }
                };
                let fade_in = seconds("fadeIn")?;
                let fade_out = seconds("fadeOut")?;
                let pan = match c.get_("pan") {
                    None | Some(Value::Null) => 0.0,
                    Some(v) => v
                        .as_f64()
                        .filter(|x| x.is_finite())
                        .ok_or_else(|| anyhow!("schema: audio clip \"{id}\" pan 必须是数"))?
                        .clamp(-1.0, 1.0),
                };
                let bus = match c.get_("bus") {
                    None | Some(Value::Null) => track_bus.clone(),
                    Some(Value::String(b)) if !b.is_empty() => b.clone(),
                    Some(other) => {
                        bail!("schema: audio clip \"{id}\" bus 必须是非空字符串：{other}")
                    }
                };
                let audio = AudioClip {
                    id: id.to_string(),
                    asset_id,
                    start: ws,
                    end: we,
                    media_start: c.gf64("mediaStart").unwrap_or(0.0),
                    rate: 1.0,
                    media_duration,
                    base_volume: c.gf64("volume").unwrap_or(1.0),
                    volume,
                    track: Some(track_id.clone()),
                    fade_in,
                    fade_out,
                    fade_span: (ws, we),
                    pan,
                    bus,
                    muted: track_muted,
                };
                if let Some(map) = c.get_("timeMap") {
                    if ["mediaStart", "playbackRate", "segment", "loop"]
                        .iter()
                        .any(|key| c.get_(*key).is_some())
                    {
                        bail!(
                            "schema: audio timeMap 不与 mediaStart/playbackRate/segment/loop 混用"
                        );
                    }
                    let map = crate::composition::TimeMap::parse(&deep_resolve(map, &self.ctx))?;
                    let spans = map.remap(&[crate::composition::TimeSpan {
                        start: ws,
                        end: we,
                        from: 0.0,
                        to: we - ws,
                    }])?;
                    for (index, span) in spans.iter().enumerate() {
                        let Some(rate) = span.audio_rate()? else {
                            continue;
                        };
                        ir.audio_clips.push(AudioClip {
                            id: format!("{}--map-{index}", audio.id),
                            asset_id: audio.asset_id.clone(),
                            start: span.start,
                            end: span.end,
                            media_start: span.from,
                            rate,
                            media_duration: audio.media_duration,
                            base_volume: audio.base_volume,
                            volume: audio.volume.clone(),
                            track: audio.track.clone(),
                            fade_in: audio.fade_in,
                            fade_out: audio.fade_out,
                            fade_span: audio.fade_span,
                            pan: audio.pan,
                            bus: audio.bus.clone(),
                            muted: audio.muted,
                        });
                    }
                } else {
                    ir.audio_clips.push(audio);
                }
            }
        }

        // captions track (bilingual lanes, §8.4)
        let cap_defaults = self
            .ctx
            .theme
            .get_("caption")
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
        for tr in doc
            .get_("tracks")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            if tr.gstr("kind") != Some("captions") {
                continue;
            }
            for c in tr
                .get_("clips")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                let Some(id) = c.gstr("id") else { continue };
                let Some(&(Some(ws), Some(we))) = self.clip_wins.get(id) else {
                    continue;
                };
                let fade = cap_defaults.gf64("fade").unwrap_or(0.18);
                let mut cap = CaptionClip {
                    start: ws,
                    end: we,
                    offset: 0.07,
                    anchor_top: false,
                    gap: 12.0,
                    region: None,
                    grow_up: false,
                    max_width: None,
                    lanes: Vec::new(),
                    items: Vec::new(),
                    fade,
                };

                let mut layout = cap_defaults
                    .get_("layout")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                if let Some(o) = c.get_("layout").and_then(Value::as_object) {
                    for (k, v) in o {
                        layout.insert(k.clone(), v.clone());
                    }
                }
                cap.anchor_top = layout.get("anchor").and_then(Value::as_str) == Some("top");
                if let Some(off) = layout.get("offset").and_then(Value::as_str) {
                    if let Some(p) = off.strip_suffix('%').and_then(|x| x.parse::<f64>().ok()) {
                        cap.offset = p / 100.0;
                    }
                } else if let Some(px) = layout.get("offset").and_then(Value::as_f64) {
                    cap.offset = px / h;
                }
                cap.gap = layout.get("gap").and_then(Value::as_f64).unwrap_or(12.0);
                // region: flow layout inside a rectangle (§3.6), px or "N%" (x/width relative to width, y/height relative to height)
                if let Some(rg) = layout.get("region").and_then(Value::as_object) {
                    let px = |v: Option<&Value>, span: f64| -> Option<f64> {
                        match v {
                            Some(Value::String(s)) => s
                                .strip_suffix('%')
                                .and_then(|x| x.parse::<f64>().ok())
                                .map(|p| p / 100.0 * span),
                            Some(v) => v.as_f64(),
                            None => None,
                        }
                    };
                    let rx = px(rg.get("x"), w).unwrap_or(0.0);
                    let ry = px(rg.get("y"), h).unwrap_or(0.0);
                    let rw = px(rg.get("width"), w).unwrap_or(w);
                    let rh = px(rg.get("height"), h).unwrap_or(h);
                    cap.region = Some([rx, ry, rw, rh]);
                }
                cap.grow_up = layout.get("grow").and_then(Value::as_str) == Some("up");
                // anchor-mode line-wrap width
                match layout.get("maxWidth") {
                    Some(Value::String(s)) => {
                        cap.max_width = s
                            .strip_suffix('%')
                            .and_then(|x| x.parse::<f64>().ok())
                            .map(|p| p / 100.0 * w);
                    }
                    Some(v) => cap.max_width = v.as_f64(),
                    None => {}
                }

                let lane_defaults = cap_defaults
                    .get_("lane")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let default_lanes = vec![serde_json::json!({ "id": "_default" })];
                let lane_jsons = c
                    .get_("lanes")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or(default_lanes);
                for lj in &lane_jsons {
                    let mut lane = CapLane {
                        id: lj.gstr("id").unwrap_or("_default").to_string(),
                        ..Default::default()
                    };
                    let mut style = lane_defaults.clone();
                    if let Some(o) = deep_resolve(
                        lj.get_("style").unwrap_or(&Value::Object(Map::new())),
                        &self.ctx,
                    )
                    .as_object()
                    {
                        for (k, v) in o {
                            style.insert(k.clone(), v.clone());
                        }
                    }
                    lane.font_family = style
                        .get("font")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    if let Some(family) = self.font_families.get(&lane.font_family) {
                        lane.font_family = family.clone();
                    }
                    lane.font_size = style
                        .get("fontSize")
                        .and_then(Value::as_f64)
                        .unwrap_or(30.0);
                    lane.font_weight = style
                        .get("fontWeight")
                        .and_then(Value::as_f64)
                        .unwrap_or(400.0) as u16;
                    lane.color = Rgba::parse_value(style.get("color")).unwrap_or(Rgba::WHITE);
                    lane.line_gap = style.get("lineGap").and_then(Value::as_f64).unwrap_or(0.0);
                    if let Some(bg) = lj.get_("background").map(|b| deep_resolve(b, &self.ctx)) {
                        if !bg.is_null() {
                            lane.bg_mode = Some(bg.gstr("mode").unwrap_or("text").to_string());
                            if let Some(c) = Rgba::parse_value(bg.get_("color")) {
                                lane.bg_color = c;
                            }
                            if let Some(pad) = bg.get_("padding").and_then(Value::as_array) {
                                if pad.len() == 2 {
                                    lane.bg_pad_v = pad[0].as_f64().unwrap_or(4.0);
                                    lane.bg_pad_h = pad[1].as_f64().unwrap_or(10.0);
                                }
                            }
                            lane.bg_radius = bg.gf64("radius").unwrap_or(6.0);
                        }
                    }
                    if let Some(hi) = lj.get_("highlight").map(|x| deep_resolve(x, &self.ctx)) {
                        if !hi.is_null() {
                            lane.hi_color =
                                Rgba::parse_value(hi.get_("params").and_then(|p| p.get_("color")))
                                    .or_else(|| Rgba::parse("#e8906a"));
                            lane.hi_transition = hi
                                .get_("params")
                                .and_then(|p| p.gf64("transition"))
                                .unwrap_or(0.1);
                        }
                    }
                    let enter = lj.get_("animate").and_then(|a| a.get_("enter"));
                    if let Some(preset) = enter.and_then(|e| e.gstr("preset")) {
                        let (kfs, _) = self.expand_preset_def(
                            preset,
                            enter.and_then(|e| e.get_("params")),
                            &self.ctx,
                        )?;
                        lane.enter_kfs = kfs;
                        lane.enter_dur = enter.and_then(|e| e.gf64("dur")).unwrap_or(0.3);
                        lane.enter_delay = enter.and_then(|e| e.gf64("delay")).unwrap_or(0.0);
                    } else {
                        let (kfs, _) = self.expand_preset_def("fadeIn", None, &self.ctx)?;
                        lane.enter_kfs = kfs;
                        lane.enter_dur = cap.fade;
                    }
                    let exit = lj.get_("animate").and_then(|a| a.get_("exit"));
                    if let Some(preset) = exit.and_then(|e| e.gstr("preset")) {
                        let (kfs, _) = self.expand_preset_def(
                            preset,
                            exit.and_then(|e| e.get_("params")),
                            &self.ctx,
                        )?;
                        lane.exit_kfs = kfs;
                        lane.exit_dur = exit.and_then(|e| e.gf64("dur")).unwrap_or(0.3).max(0.001);
                    }
                    cap.lanes.push(lane);
                }

                let mut items: Vec<CapItem> = Vec::new();
                for it in c
                    .get_("captions")
                    .and_then(Value::as_array)
                    .unwrap_or(&Vec::new())
                {
                    let Some(at) = self.eval_t(it.get_("at").unwrap_or(&Value::from(0)))? else {
                        continue;
                    };
                    let mut lines: HashMap<String, CapLine> = HashMap::new();
                    if let Some(ls) = it.get_("lines").and_then(Value::as_object) {
                        for (lane_id, line) in ls {
                            let mut cl = CapLine {
                                text: line.gstr("text").unwrap_or("").to_string(),
                                words: None,
                                boxes: None,
                            };
                            if let Some(ws_) = line.get_("words").and_then(Value::as_array) {
                                let mut words: Vec<CapWord> = ws_
                                    .iter()
                                    .filter_map(|w| {
                                        let t = w.gf64("t")?;
                                        let text = w.gstr("text")?.to_string();
                                        let end = w.gf64("d").map(|d| t + d).unwrap_or(-1.0);
                                        Some(CapWord { t, end, text })
                                    })
                                    .collect();
                                for i in 0..words.len() {
                                    if words[i].end < 0.0 && i + 1 < words.len() {
                                        words[i].end = words[i + 1].t;
                                    }
                                }
                                cl.words = Some(words);
                            }
                            lines.insert(lane_id.clone(), cl);
                        }
                    } else if let Some(txt) = it.gstr("text") {
                        if let Some(first) = cap.lanes.first() {
                            lines.insert(
                                first.id.clone(),
                                CapLine {
                                    text: txt.to_string(),
                                    words: None,
                                    boxes: None,
                                },
                            );
                        }
                    }
                    let until_abs = match it.get_("until").filter(|u| !u.is_null()) {
                        Some(u) => self.eval_t(u)?.unwrap_or(-1.0),
                        None => -1.0,
                    };
                    items.push(CapItem {
                        at_abs: at,
                        until_abs,
                        lines,
                    });
                }
                items.sort_by(|a, b| a.at_abs.partial_cmp(&b.at_abs).unwrap());
                let n_items = items.len();
                for i in 0..n_items {
                    if items[i].until_abs < 0.0 {
                        items[i].until_abs = if i + 1 < n_items {
                            items[i + 1].at_abs
                        } else {
                            we
                        };
                    }
                    // If the last word has no duration, it lasts until the end of this entry
                    let span = items[i].until_abs - items[i].at_abs;
                    for line in items[i].lines.values_mut() {
                        if let Some(words) = &mut line.words {
                            for w in words.iter_mut() {
                                if w.end < 0.0 {
                                    w.end = span;
                                }
                            }
                        }
                    }
                }
                cap.items = items;
                ir.caption_clips.push(cap);
            }
        }
        Ok(ir)
    }
}

/// Track IR → `Channel`. The `v` of keyframes is **raw JSON**: `sample_frames` `clone()`s the value at both ends, and `record_node` reads it back with `as_f64`, so an integer `0` must not become `0.0`.
fn channel_from_ir(channel: motion::ChannelIr, meta: Option<Map<String, Value>>) -> Channel {
    Channel::replace(
        channel.prop,
        channel
            .frames
            .into_iter()
            .map(|frame| Kf {
                t: frame.t,
                v: frame.v,
                ease: frame.ease,
            })
            .collect(),
        meta,
    )
}

/// After layout, converts the relative lengths in the channels to px (design §5.5 / §10 phase 2).
///
/// **Must be called after `layout::layout_tree` / `layout::layout_captions`**. Bases such as `selfWidth` / `parentWidth` only have values once the static layout box exists. This is the only structural adjustment in `ccut-core`'s resolve order. `FrameRenderer::new` already fixes "layout → finalize" as a contract. `ccut lint` also calls it after zero-measure layout, so that `relative-basis-unresolved` can be reported at lint time.
///
/// Documents without relative lengths (all the goldens today) come out **not a single byte different** here.
pub fn build_channels_after_layout(ir: &mut Ir) -> Result<()> {
    let canvas = (ir.w, ir.h);
    for clip in &mut ir.visual_clips {
        let ctx = motion::LengthContext::canvas(canvas.0, canvas.1);
        for channel in &mut clip.wrap_channels {
            resolve_channel_lengths(channel, &ctx)?;
        }
        let root = Some((clip.tree.frame.w, clip.tree.frame.h));
        resolve_tree_lengths(&mut clip.tree, canvas, root)?;
        validate_mask_dependencies(&clip.tree)?;
    }
    for clip in &mut ir.caption_clips {
        // The `enter` / `exit` templates of a caption lane are anchored per entry and have no single self box. So `self*` / `parent*` are reported here as `relative-basis-unresolved` (spec §7.8).
        let ctx = motion::LengthContext::canvas(canvas.0, canvas.1);
        for lane in &mut clip.lanes {
            for kf in lane.enter_kfs.iter_mut().chain(lane.exit_kfs.iter_mut()) {
                resolve_template_lengths(kf, &ctx)?;
            }
        }
    }
    for clip in &mut ir.camera_clips {
        let ctx = motion::LengthContext::canvas(canvas.0, canvas.1);
        for frame in &mut clip.frames {
            resolve_frame_lengths("cam", &mut frame.v, &ctx)?;
        }
    }
    for clip in &mut ir.audio_clips {
        let ctx = motion::LengthContext::canvas(canvas.0, canvas.1);
        for frame in &mut clip.volume {
            resolve_frame_lengths("volume", &mut frame.v, &ctx)?;
        }
    }
    Ok(())
}

/// `rotationX` / `rotationY` are in the allowlist (§6.4), but they need perspective projection, and both the CPU reference renderer and DrawOp v4 only have affine transforms. Rather than accepting them and drawing them as not moving, reject them here.
/// `skewX` / `skewY` are affine and render normally.
fn validate_render_channels(node: &RNode) -> Result<()> {
    let offending = node
        .channels
        .iter()
        .map(|channel| channel.prop.as_str())
        .chain(
            node.part_motion
                .iter()
                .flat_map(|pm| pm.channels.iter().flatten())
                .map(|channel| channel.prop.as_str()),
        )
        .find(|prop| matches!(*prop, "rotationX" | "rotationY"));
    if let Some(prop) = offending {
        bail!(
            "motion-unsupported: 元素 \"{}\" 的通道 \"{prop}\" 需要 3D 透视变换，本实现只有仿射变换（§6.4）；\
             翻页 / 立牌一类的效果请改用 scaleY + skewX 近似，或用 clipPath 擦除",
            node.id
        );
    }
    if let Some(parts) = &node.part_motion {
        for channel in parts.channels.iter().flatten() {
            if matches!(
                channel.prop.as_str(),
                "text" | "fontWeight" | "letterSpacing"
            ) {
                bail!(
                    "motion-unsupported: {} 仅支持整段 text，不支持 animate.parts",
                    channel.prop
                );
            }
            // A part only draws translation / scale / opacity / colour / reveal / blur. Any other channel written into animate.parts would be drawn as not moving, so it errors rather than silently dropping it (§6.4).
            if !matches!(
                channel.prop.as_str(),
                "opacity" | "x" | "y" | "scale" | "color" | "textReveal" | "blur"
            ) {
                bail!(
                    "motion-unsupported: animate.parts 的通道 \"{}\" 不受支持；part 只支持 \
                     opacity / x / y / scale / color / textReveal / blur（§6.4），旋转、斜切等请作用于整个元素",
                    channel.prop
                );
            }
            if channel.prop == "textReveal"
                && channel
                    .frames
                    .iter()
                    .any(|frame| !frame.v.as_f64().is_some_and(f64::is_finite))
            {
                bail!("schema: part.textReveal 须为有限数值");
            }
        }
    }
    Ok(())
}

/// Marks the element that `style.mask.source` points to as a mask source (spec §6.3).
///
/// Constraints: the source must be in the same clip's element tree, and cannot be the masked element itself or its ancestor / descendant. Violating any of these is `mask-source-unknown`. A mask that cannot be drawn must not fail silently.
fn link_mask_sources(tree: &mut RNode) -> Result<()> {
    type Wanted = (String, String, Vec<usize>, Vec<usize>, bool);
    fn collect(node: &RNode, path: &mut Vec<usize>, scope: &[usize], out: &mut Vec<Wanted>) {
        if let Some(mask) = &node.mask {
            out.push((
                node.id.clone(),
                mask.source.clone(),
                path.clone(),
                scope.to_vec(),
                true,
            ));
        }
        if let Some(follow) = &node.follow {
            out.push((
                node.id.clone(),
                follow.source.clone(),
                path.clone(),
                scope.to_vec(),
                false,
            ));
        }
        let child_scope = if node.composition.is_some() {
            path.clone()
        } else {
            scope.to_vec()
        };
        for (index, child) in node.children.iter().enumerate() {
            path.push(index);
            collect(child, path, &child_scope, out);
            path.pop();
        }
    }
    fn find(node: &RNode, id: &str, path: &mut Vec<usize>, root: bool) -> bool {
        if node.id == id {
            return true;
        }
        if !root && node.composition.is_some() {
            return false;
        }
        for (index, child) in node.children.iter().enumerate() {
            path.push(index);
            if find(child, id, path, false) {
                return true;
            }
            path.pop();
        }
        false
    }
    fn at_path<'a>(node: &'a mut RNode, path: &[usize]) -> &'a mut RNode {
        match path.split_first() {
            None => node,
            Some((head, rest)) => at_path(&mut node.children[*head], rest),
        }
    }
    let mut wanted = Vec::new();
    collect(tree, &mut Vec::new(), &[], &mut wanted);
    for (owner, source, owner_path, scope, is_mask) in wanted {
        let mut source_path = scope.clone();
        if !find(at_path(tree, &scope), &source, &mut source_path, true) {
            if !is_mask {
                bail!("schema: follow.source #{source} 在同一局部范围内找不到（元素 {owner}）");
            }
            bail!(
                "mask-source-unknown: 元素 \"{owner}\" 的 style.mask.source \"#{source}\" 在同一 clip / composition 范围里找不到（§6.3）"
            );
        }
        let prefix = |a: &[usize], b: &[usize]| b.starts_with(a);
        if prefix(&owner_path, &source_path) || prefix(&source_path, &owner_path) {
            if !is_mask {
                bail!("schema: follow.source 不能是自己、祖先或后代（元素 {owner}）");
            }
            bail!("mask-source-unknown: 元素 \"{owner}\" 的遮罩源不能是自己、祖先或后代（§6.3）");
        }
        if is_mask {
            at_path(tree, &source_path).mask_source = true;
        } else {
            if at_path(tree, &source_path).ntype != "path" {
                bail!("schema: follow.source #{source} 必须是 path");
            }
            for depth in scope.len() + 1..=source_path.len() {
                if at_path(tree, &source_path[..depth]).follow.is_some() {
                    bail!("schema: follow 的源路径及其局部祖先不能再带 follow");
                }
            }
        }
    }
    validate_mask_dependencies(tree)
}

/// Validates the subtree and mask references within the same local canvas. Instances do not share internal node identity.
fn validate_mask_dependencies(tree: &RNode) -> Result<()> {
    use std::collections::{HashMap, HashSet};
    type Nodes<'a> = HashMap<(usize, &'a str), &'a RNode>;
    fn collect<'a>(
        node: &'a RNode,
        scope: usize,
        nodes: &mut Nodes<'a>,
        scopes: &mut HashMap<usize, usize>,
    ) {
        let key = node as *const RNode as usize;
        nodes.entry((scope, &node.id)).or_insert(node);
        scopes.insert(key, scope);
        let child_scope = if node.composition.is_some() {
            key
        } else {
            scope
        };
        for child in &node.children {
            collect(child, child_scope, nodes, scopes);
        }
    }
    fn visit(
        node: &RNode,
        nodes: &Nodes<'_>,
        scopes: &HashMap<usize, usize>,
        active: &mut HashSet<usize>,
        done: &mut HashSet<(usize, bool)>,
        temporal: bool,
    ) -> Result<()> {
        if active.len() >= 128 {
            bail!("mask-source-unknown: 遮罩依赖深度超过 128（§6.3）");
        }
        let key = node as *const RNode as usize;
        if temporal && node.echo.is_some() {
            bail!("schema: echo 不能嵌套（包括遮罩依赖）");
        }
        if done.contains(&(key, temporal)) {
            return Ok(());
        }
        if !active.insert(key) {
            bail!(
                "mask-source-unknown: 遮罩依赖成环，涉及元素 #{}（§6.3）",
                node.id
            );
        }
        for child in &node.children {
            visit(
                child,
                nodes,
                scopes,
                active,
                done,
                temporal || node.echo.is_some(),
            )?;
        }
        if let Some(mask) = &node.mask
            && let Some(source) = nodes.get(&(scopes[&key], mask.source.as_str()))
        {
            visit(
                source,
                nodes,
                scopes,
                active,
                done,
                temporal || node.echo.is_some(),
            )?;
        }
        active.remove(&key);
        done.insert((key, temporal));
        Ok(())
    }
    let (mut nodes, mut scopes) = (HashMap::new(), HashMap::new());
    collect(tree, tree as *const RNode as usize, &mut nodes, &mut scopes);
    visit(
        tree,
        &nodes,
        &scopes,
        &mut HashSet::new(),
        &mut HashSet::new(),
        false,
    )
}

fn resolve_tree_lengths(
    node: &mut RNode,
    canvas: (f64, f64),
    parent_box: Option<(f64, f64)>,
) -> Result<()> {
    if let Some(pending) = &node.pending_line_motion {
        let text = node.text.as_deref().unwrap_or("");
        let ranges = if text.is_empty() {
            Vec::new()
        } else {
            node.text_block
                .as_ref()
                .map(|block| block.lines.iter().map(|line| line.bytes.clone()).collect())
                .unwrap_or_else(|| motion::split_animation_parts(text, motion::PartUnit::Line))
        };
        let map = motion::PartMap::from_ranges(text, motion::PartUnit::Line, ranges);
        node.part_motion = if map.is_empty() {
            None
        } else {
            let graph = motion::parse_parts(
                &pending.spec,
                &motion::FlowParseCtx {
                    part_count: map.len(),
                    default_seed: 0,
                },
            )
            .map_err(|e| anyhow!("{e}"))?;
            let graph = wrap_extra_delay(graph, pending.extra);
            let flow =
                motion::compile_flow(&graph, &pending.context).map_err(|e| anyhow!("{e}"))?;
            let mut channels = vec![Vec::new(); map.len()];
            for track in &flow.tracks {
                let index = track.target.0 as usize;
                if index == 0 || index > map.len() {
                    bail!("motion-flow-invalid: line part target 越界");
                }
                channels[index - 1].push(Resolver::flow_track_channel(track));
            }
            Some(PartMotion { map, channels })
        };
        validate_render_channels(node)?;
    }
    if let Some(shadow) = node.style.get("shadow").filter(|value| !value.is_null()) {
        // The shorthand is specified in local pixels; normalize against this canvas.
        node.effects[0] = BoxShadow::parse(shadow)?.to_effect(canvas.0.min(canvas.1).max(1.0))?;
    }
    let ctx = motion::LengthContext {
        canvas,
        self_box: Some((node.frame.w, node.frame.h)),
        parent_box,
    };
    for channel in &mut node.channels {
        resolve_channel_lengths(channel, &ctx)?;
    }
    if let Some(part_motion) = &mut node.part_motion {
        for part in &mut part_motion.channels {
            for channel in part {
                resolve_channel_lengths(channel, &ctx)?;
            }
        }
    }
    let child_canvas = node
        .composition
        .as_ref()
        .map_or(canvas, |local| (local.width, local.height));
    let own = Some(
        node.composition
            .as_ref()
            .map_or((node.frame.w, node.frame.h), |local| {
                (local.width, local.height)
            }),
    );
    for child in &mut node.children {
        resolve_tree_lengths(child, child_canvas, own)?;
    }
    Ok(())
}

fn resolve_channel_lengths(channel: &mut Channel, ctx: &motion::LengthContext) -> Result<()> {
    for frame in &mut channel.frames {
        resolve_frame_lengths(&channel.prop, &mut frame.v, ctx)?;
    }
    Ok(())
}

/// The `'%'` template of a caption lane (raw `{prop, frames[]}`), evaluated per entry.
fn resolve_template_lengths(kf: &mut Value, ctx: &motion::LengthContext) -> Result<()> {
    let prop = kf.gstr("prop").unwrap_or_default().to_string();
    let Some(frames) = kf.get_mut("frames").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    for frame in frames {
        if let Some(v) = frame.get_mut("v") {
            resolve_frame_lengths(&prop, v, ctx)?;
        }
    }
    Ok(())
}

fn resolve_frame_lengths(prop: &str, value: &mut Value, ctx: &motion::LengthContext) -> Result<()> {
    if motion::preset_registry::manifest::is_relative_length_object(value) {
        if !motion::RELATIVE_LENGTH_PROPS.contains(&prop) {
            bail!(
                "relative-not-allowed: 属性 \"{prop}\" 不接受相对长度（规范 §7.8 只允许 transform / blur / 效果参数）"
            );
        }
        let length = motion::preset_registry::manifest::parse_length_value(value)
            .ok_or_else(|| anyhow!("relative-basis-unresolved: 无法解析长度 {value}"))?;
        let px = length.resolve(ctx).map_err(|error| anyhow!("{error}"))?;
        *value = Value::from(px);
        return Ok(());
    }
    match value {
        Value::Array(items) => {
            for item in items {
                resolve_frame_lengths(prop, item, ctx)?;
            }
        }
        Value::Object(map) => {
            for (_, item) in map.iter_mut() {
                resolve_frame_lengths(prop, item, ctx)?;
            }
        }
        _ => {}
    }
    Ok(())
}

/// Static version of lay_preset_frames (reused by caption lanes; no meta)
pub fn lay_static(kfs: &[Value], t0: f64, dur: f64) -> Vec<Channel> {
    Resolver::lay_preset_frames(kfs, t0, dur, None)
}

/// `withAudio: true` video node → same-window AudioClip (§6.5 syntactic sugar).
fn collect_with_audio(node: &RNode, vc: &VisualClip, out: &mut Vec<AudioClip>) -> Result<()> {
    use crate::composition::{TimeMap, TimeSpan};
    fn has_audio(node: &RNode) -> bool {
        (node.ntype == "video" && node.with_audio) || node.children.iter().any(has_audio)
    }
    fn walk(
        node: &RNode,
        vc: &VisualClip,
        spans: &[TimeSpan],
        warped: bool,
        path: &str,
        out: &mut Vec<AudioClip>,
    ) -> Result<()> {
        if !has_audio(node) {
            return Ok(());
        }
        if node.ntype == "video"
            && node.with_audio
            && let Some(aid) = &node.asset_id
        {
            if warped || node.time_map.is_some() {
                if node.loop_media || node.segment.is_some() {
                    bail!(
                        "schema: 局部合成 withAudio 不与 segment/loop 混用；用独立音轨明确编排循环"
                    );
                }
                let local: Vec<_> = spans
                    .iter()
                    .map(|span| TimeSpan {
                        from: span.from - node.media_win_start,
                        to: span.to - node.media_win_start,
                        ..*span
                    })
                    .collect();
                let source = match &node.time_map {
                    Some(map) => map.remap(&local)?,
                    None => local
                        .iter()
                        .map(|span| TimeSpan {
                            from: node.media_start + span.from * node.playback_rate,
                            to: node.media_start + span.to * node.playback_rate,
                            ..*span
                        })
                        .collect(),
                };
                for (index, span) in source.iter().enumerate() {
                    // Holds and reverse playback have no automatic audio. Positive spans
                    // use the existing pitch-preserving rate path in preview and export.
                    let Some(rate) = span.audio_rate()? else {
                        continue;
                    };
                    out.push(AudioClip {
                        id: format!("{}--{}--audio-{path}-{index}", vc.id, node.id),
                        asset_id: aid.clone(),
                        start: span.start,
                        end: span.end,
                        media_start: span.from.max(0.0),
                        rate,
                        media_duration: if node.loop_media {
                            0.0
                        } else {
                            node.media_duration
                        },
                        base_volume: node.media_volume,
                        volume: Vec::new(),
                        track: None,
                        fade_in: 0.0,
                        fade_out: 0.0,
                        fade_span: (span.start, span.end),
                        pan: 0.0,
                        bus: crate::audio_mix::MAIN_BUS.to_string(),
                        muted: false,
                    });
                }
            } else {
                out.push(AudioClip {
                    id: format!("{}--{}--audio", vc.id, node.id),
                    asset_id: aid.clone(),
                    start: vc.start,
                    end: vc.end,
                    media_start: node.media_start,
                    rate: node.playback_rate,
                    media_duration: if node.loop_media {
                        0.0
                    } else {
                        node.media_duration
                    },
                    base_volume: node.media_volume,
                    volume: Vec::new(),
                    track: None,
                    fade_in: 0.0,
                    fade_out: 0.0,
                    fade_span: (vc.start, vc.end),
                    pan: 0.0,
                    bus: crate::audio_mix::MAIN_BUS.to_string(),
                    muted: false,
                });
            }
        }
        let mapped;
        let (child_spans, child_warped) = if let Some(canvas) = &node.composition {
            let local: Vec<_> = spans
                .iter()
                .map(|span| TimeSpan {
                    from: span.from - node.media_win_start,
                    to: span.to - node.media_win_start,
                    ..*span
                })
                .collect();
            let map = node
                .time_map
                .clone()
                .unwrap_or_else(|| TimeMap::linear(canvas.duration, 0.0, 1.0));
            let source = map.remap(&local)?;
            mapped = TimeMap::linear(canvas.duration, 0.0, 1.0).remap(&source)?;
            (mapped.as_slice(), true)
        } else {
            (spans, warped)
        };
        for (i, child) in node.children.iter().enumerate() {
            walk(
                child,
                vc,
                child_spans,
                child_warped,
                &format!("{path}-{i}"),
                out,
            )?;
        }
        Ok(())
    }
    walk(
        node,
        vc,
        &[TimeSpan {
            start: vc.start,
            end: vc.end,
            from: vc.start,
            to: vc.end,
        }],
        false,
        "root",
        out,
    )
}
