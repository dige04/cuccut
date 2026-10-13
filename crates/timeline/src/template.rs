//! Pure derivations for the template-layer document: validation, box geometry, chapter segmentation, variable filling, subtitle avoidance, the seventeen built-in templates
//! (following the UI language, grouped into sections), and instantiation and brand-kit merging. The shapes live in `ccut-protocol::template`, one-to-one with the prototype `designs/cuccut/app/model-template.js` (round 112; 2026-09-14 templates and watermarks
//! merged, sections by group and the platform variants, ledger 2026-09-14-230340; 2026-09-15 logo layer `align`, and the vertical slice switched to a dark title card).
//! No I/O here, and no pixels are drawn.
//!
//! Coordinates are all percentages of the frame (origin at top-left); `play_t` / `dur` / chapter `start` / `end` use the same clock
//! (the renderer passes the timeline clock, and chapters are already mapped onto the timeline).

use std::collections::BTreeMap;

pub use crate::protocol::template::*;

use crate::schema::TimelineError;

/// Frame size in pixels (used when converting pixel drags and stretches into percentages).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    pub w: f64,
    pub h: f64,
}

/// One chapter (timeline clock).
#[derive(Debug, Clone, PartialEq)]
pub struct ChapterSpan {
    pub id: String,
    pub title: String,
    pub start: f64,
    pub end: f64,
}

/// One segment on the chapter bar.
#[derive(Debug, Clone, PartialEq)]
pub struct Segment {
    pub id: String,
    pub title: String,
    pub start: f64,
    /// Segment length (≥ 0.001); the chapter bar uses it for flex distribution.
    pub span: f64,
    /// Playback progress of this segment itself, 0..=1.
    pub done: f64,
    pub state: SegmentState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentState {
    Done,
    On,
    Todo,
}

/// Result of merging into the brand kit.
#[derive(Debug, Clone, PartialEq)]
pub struct MergeOutcome {
    pub list: Vec<TemplateDoc>,
    pub doc: TemplateDoc,
    /// `true` = an existing entry with the same name was overwritten; `false` = added as new.
    pub updated: bool,
}

/// The id of the built-in blank template.
pub const BLANK_ID: &str = "tpl-new";
/// Id prefix for brand-kit templates.
pub const BRAND_ID_PREFIX: &str = "tpl-brand-";

const WHITE: &str = "#FFFFFF";
const INK: &str = "#131313";
const ORANGE: &str = "#FF7A1A";
const RED: &str = "#C0392B";
const BLUE: &str = "#3B63FB";
const YELLOW: &str = "#FFE14D";
const PINK: &str = "#FF4D7A";
const TEAL: &str = "#1FB6C9";
/// Secondary chapter name on the vertical-slice title card: a light grey one step darker than the title's white.
const MIST: &str = "#D9D9D9";
/// Left and right padding shared by the four text layers of the vertical slice (1.2% of frame height; 23px at 1080×1920, equal to the old value the title got from 0.5em).
const VERTICAL_PAD: f64 = 1.2;

fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    v.max(lo).min(hi)
}

/// One decimal place.
pub fn r1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

// ---------- Validation ----------

/// Validates a template: ids are legal and layer ids are unique, colours are `#RRGGBB[AA]`, boxes lie within the frame and are not smaller than the minimum size,
/// font sizes are positive, `hue` is in the set, and `LogoSrc::File` is a project-relative path.
pub fn validate(doc: &TemplateDoc) -> Result<(), TimelineError> {
    crate::protocol::template::validate(doc).map_err(TimelineError::Invalid)
}

// ---------- Box geometry ----------

/// Clamp the size first, then the position; one decimal place.
pub fn clamp_box(b: LayerBox) -> LayerBox {
    let w = clamp(b.w, MIN_W, 100.0);
    let h = clamp(b.h, MIN_H, 100.0);
    LayerBox {
        x: r1(clamp(b.x, 0.0, 100.0 - w)),
        y: r1(clamp(b.y, 0.0, 100.0 - h)),
        w: r1(w),
        h: r1(h),
    }
}

/// Drag: the pixel displacement is converted to percentages, then the whole box is translated.
pub fn drag_box(box0: LayerBox, dx: f64, dy: f64, frame: Frame) -> LayerBox {
    clamp_box(LayerBox {
        x: box0.x + dx / frame.w * 100.0,
        y: box0.y + dy / frame.h * 100.0,
        ..box0
    })
}

/// Bottom-right corner stretch: changes only width and height.
pub fn resize_box(box0: LayerBox, dx: f64, dy: f64, frame: Frame) -> LayerBox {
    clamp_box(LayerBox {
        w: box0.w + dx / frame.w * 100.0,
        h: box0.h + dy / frame.h * 100.0,
        ..box0
    })
}

/// The eight stretch handles of the layout editor (four corners and four edges).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Handle {
    N,
    S,
    E,
    W,
    NE,
    NW,
    SE,
    SW,
}

impl Handle {
    pub const ALL: [Handle; 8] = [
        Handle::NW,
        Handle::N,
        Handle::NE,
        Handle::E,
        Handle::SE,
        Handle::S,
        Handle::SW,
        Handle::W,
    ];

    /// Wire names: `n` `s` `e` `w` `ne` `nw` `se` `sw`.
    pub fn as_str(self) -> &'static str {
        match self {
            Handle::N => "n",
            Handle::S => "s",
            Handle::E => "e",
            Handle::W => "w",
            Handle::NE => "ne",
            Handle::NW => "nw",
            Handle::SE => "se",
            Handle::SW => "sw",
        }
    }

    pub fn parse(s: &str) -> Option<Handle> {
        Handle::ALL.into_iter().find(|h| h.as_str() == s)
    }

    /// Which horizontal edge moves: `-1` left edge, `1` right edge, `0` does not move.
    pub fn sx(self) -> i8 {
        match self {
            Handle::W | Handle::NW | Handle::SW => -1,
            Handle::E | Handle::NE | Handle::SE => 1,
            Handle::N | Handle::S => 0,
        }
    }

    /// Which vertical edge moves: `-1` top edge, `1` bottom edge, `0` does not move.
    pub fn sy(self) -> i8 {
        match self {
            Handle::N | Handle::NE | Handle::NW => -1,
            Handle::S | Handle::SE | Handle::SW => 1,
            Handle::E | Handle::W => 0,
        }
    }
}

/// Drag one edge along one axis: the opposite edge is anchored, and the dragged edge is clamped within the frame and stays at least `min` away from the opposite edge.
fn drag_edge(start: f64, size: f64, delta: f64, side: i8, min: f64) -> (f64, f64) {
    let lo = start;
    let hi = start + size;
    match side {
        -1 => {
            let edge = clamp(lo + delta, 0.0, hi - min);
            (edge, hi - edge)
        }
        1 => {
            let edge = clamp(hi + delta, lo + min, 100.0);
            (lo, edge - lo)
        }
        _ => (start, size),
    }
}

/// Eight-handle stretch: `dx` and `dy` are pixel displacements; the dragged edge follows the pointer while the opposite edge stays put; the result then passes through [`clamp_box`].
///
/// [`resize_box`] is equivalent to `resize_box_from(.., Handle::SE, ..)` (the bottom-right handle).
pub fn resize_box_from(box0: LayerBox, handle: Handle, dx: f64, dy: f64, frame: Frame) -> LayerBox {
    let dxp = if frame.w > 0.0 {
        dx / frame.w * 100.0
    } else {
        0.0
    };
    let dyp = if frame.h > 0.0 {
        dy / frame.h * 100.0
    } else {
        0.0
    };
    let (x, w) = drag_edge(box0.x, box0.w, dxp, handle.sx(), MIN_W);
    let (y, h) = drag_edge(box0.y, box0.h, dyp, handle.sy(), MIN_H);
    clamp_box(LayerBox { x, y, w, h })
}

/// Hit test: top-down (end of the array first), skipping hidden layers; closed interval.
pub fn hit_test(doc: &TemplateDoc, x: f64, y: f64) -> Option<&TemplateLayer> {
    doc.layers.iter().rev().find(|l| {
        let b = &l.rect;
        l.on && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    })
}

// ---------- Chapter segmentation / variables ----------

/// Playback progress, 0..=1.
pub fn progress(play_t: f64, dur: f64) -> f64 {
    if dur <= 0.0 {
        return 0.0;
    }
    clamp(play_t / dur, 0.0, 1.0)
}

/// Segmentation of the chapter bar: an empty chapter table means one segment spanning the whole length.
pub fn segments(chapters: &[ChapterSpan], play_t: f64, dur: f64) -> Vec<Segment> {
    let whole;
    let list: &[ChapterSpan] = if chapters.is_empty() {
        whole = [ChapterSpan {
            id: "all".to_string(),
            title: String::new(),
            start: 0.0,
            end: dur,
        }];
        &whole
    } else {
        chapters
    };
    list.iter()
        .map(|c| {
            let span = (c.end - c.start).max(0.001);
            let done = clamp((play_t - c.start) / span, 0.0, 1.0);
            let state = if play_t >= c.end {
                SegmentState::Done
            } else if play_t >= c.start {
                SegmentState::On
            } else {
                SegmentState::Todo
            };
            Segment {
                id: c.id.clone(),
                title: c.title.clone(),
                start: c.start,
                span,
                done,
                state,
            }
        })
        .collect()
}

/// `h:mm:ss` (≥ 1 hour) or `m:ss`.
pub fn timecode(seconds: f64) -> String {
    let s = seconds.max(0.0).floor() as u64;
    let h = s / 3600;
    let m = (s % 3600) / 60;
    let sec = s % 60;
    if h > 0 {
        format!("{h}:{m:02}:{sec:02}")
    } else {
        format!("{m}:{sec:02}")
    }
}

/// Text-layer variable table: current chapter name, index, chapter count, time, remaining, total length and percentage, plus caller-supplied extras
/// (such as `title`). Current chapter = the first segment currently playing; when none is playing, use the last segment if playback has finished, otherwise the first segment.
pub fn vars(
    chapters: &[ChapterSpan],
    play_t: f64,
    dur: f64,
    extra: &[(&str, &str)],
) -> BTreeMap<String, String> {
    let segs = segments(chapters, play_t, dur);
    let cur = segs
        .iter()
        .position(|s| s.state == SegmentState::On)
        .unwrap_or(if play_t >= dur { segs.len() - 1 } else { 0 });
    let mut out = BTreeMap::new();
    out.insert("chapter".to_string(), segs[cur].title.clone());
    out.insert("n".to_string(), (cur + 1).to_string());
    out.insert("count".to_string(), segs.len().to_string());
    out.insert("time".to_string(), timecode(play_t));
    out.insert("remain".to_string(), timecode((dur - play_t).max(0.0)));
    out.insert("total".to_string(), timecode(dur));
    out.insert(
        "percent".to_string(),
        format!("{}%", (progress(play_t, dur) * 100.0).round() as i64),
    );
    for (k, v) in extra {
        out.insert((*k).to_string(), (*v).to_string());
    }
    out
}

/// Replaces `{name}`; unknown variables are kept as they are.
pub fn fill(text: &str, vars: &BTreeMap<String, String>) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(open) = rest.find('{') {
        out.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        let word_len = after
            .char_indices()
            .take_while(|(_, c)| c.is_ascii_alphanumeric() || *c == '_')
            .count();
        if word_len > 0 && after[word_len..].starts_with('}') {
            let name = &after[..word_len];
            match vars.get(name) {
                Some(v) => out.push_str(v),
                None => {
                    out.push('{');
                    out.push_str(name);
                    out.push('}');
                }
            }
            rest = &after[word_len + 1..];
        } else {
            out.push('{');
            rest = after;
        }
    }
    out.push_str(rest);
    out
}

/// The percentage the subtitle baseline should be raised to: only considers open, full-width horizontal-bar-type layers with y ≥ 50, taking the maximum of `100 - y + 2` and
/// `base`. If there is no such layer, returns `base`.
pub fn subs_bottom(doc: &TemplateDoc, base: f64) -> f64 {
    let mut out = base;
    if !doc.subs_avoid {
        return out;
    }
    for l in &doc.layers {
        if l.on && l.kind.is_strip() && l.rect.y >= 50.0 {
            out = out.max(r1(100.0 - l.rect.y + 2.0));
        }
    }
    out
}

// ---------- Built-in / instances / brand kit ----------

fn layer(id: &str, rect: LayerBox, kind: LayerKind) -> TemplateLayer {
    TemplateLayer {
        id: id.to_string(),
        on: true,
        rect,
        kind,
    }
}

fn logo_text(text: &str, bg: Option<&str>, color: &str, shape: LogoShape, size: f64) -> LayerKind {
    LayerKind::Logo {
        src: LogoSrc::TEXT,
        text: text.to_string(),
        bg: bg.map(str::to_string),
        color: color.to_string(),
        shape,
        size,
        pad: None,
        tile: false,
        opacity: 1.0,
        align: TextAlign::Center,
    }
}

/// Sets the whole-layer opacity and tiling of a logo layer (used for semi-transparent logos and built-in watermarks).
fn faded(mut kind: LayerKind, value: f64, tiled: bool) -> LayerKind {
    if let LayerKind::Logo { opacity, tile, .. } = &mut kind {
        *opacity = value;
        *tile = tiled;
    }
    kind
}

/// Horizontal alignment of the text or image within the box for a logo layer (defaults to centred).
fn aligned(mut kind: LayerKind, value: TextAlign) -> LayerKind {
    if let LayerKind::Logo { align, .. } = &mut kind {
        *align = value;
    }
    kind
}

/// Fixed left and right padding for text and logo layers (percentage of frame height). Used when several layers with different font sizes must start from the same vertical line:
/// by default the padding is derived from each layer's own font size, so changing a font size would shift the start position.
fn padded(mut kind: LayerKind, value: f64) -> LayerKind {
    if let LayerKind::Logo { pad, .. } | LayerKind::Text { pad, .. } = &mut kind {
        *pad = Some(value);
    }
    kind
}

fn text(
    text: &str,
    color: &str,
    bg: Option<&str>,
    align: TextAlign,
    size: f64,
    mono: bool,
    weight: u16,
) -> LayerKind {
    LayerKind::Text {
        text: text.to_string(),
        color: color.to_string(),
        bg: bg.map(str::to_string),
        align,
        size,
        pad: None,
        mono,
        weight,
    }
}

fn progress_kind(accent: &str, track: &str) -> LayerKind {
    LayerKind::Progress {
        accent: accent.to_string(),
        track: track.to_string(),
    }
}

fn chapters_kind(
    fill: ChapterFill,
    bg: &str,
    color: &str,
    accent: &str,
    color_done: Option<&str>,
    size: f64,
) -> LayerKind {
    LayerKind::Chapters {
        fill,
        bg: bg.to_string(),
        color: color.to_string(),
        accent: accent.to_string(),
        color_done: color_done.map(str::to_string),
        divider: true,
        size,
    }
}

fn doc(
    vocab: &Vocab,
    id: &str,
    hue: &str,
    group: &str,
    canvas: TemplateCanvas,
    layers: Vec<TemplateLayer>,
) -> TemplateDoc {
    let (name, desc) = vocab.doc(id);
    TemplateDoc {
        id: id.to_string(),
        name: name.to_string(),
        hue: hue.to_string(),
        group: Some(group.to_string()),
        canvas,
        ratio: None,
        lock_ratio: false,
        builtin: true,
        tag: None,
        imported: None,
        desc: desc.to_string(),
        font: None,
        from: None,
        subs_avoid: true,
        layers,
    }
}

/// "Apply frame size" and the frame-size lock (prototype round 218): applying also changes the project's frame size, after which it cannot be changed on the stage or in project settings;
/// to change it, unlock it first in template settings.
fn locked(mut doc: TemplateDoc, ratio: &str) -> TemplateDoc {
    doc.ratio = Some(ratio.to_owned());
    doc.lock_ratio = true;
    doc
}

/// Watermark category (`tag: "watermark"`).
fn watermark(mut doc: TemplateDoc) -> TemplateDoc {
    doc.tag = Some(TAG_WATERMARK.to_owned());
    doc
}

// ---------- Languages and groups of the built-in catalogue (2026-09-14) ----------

/// The UI languages the built-in catalogue follows (prototype `LANGS`): names, descriptions, and the sample text drawn into the frame (brand name, social handle,
/// speaker, episode number, hashtags, etc.) change per language, while ids and layer structure are the same across languages. UI languages without a word list fall back to English
/// (prototype `LANG_FALLBACK`); the CLI, the core, and callers without a language context use Simplified Chinese.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum TemplateLang {
    #[default]
    Zh,
    ZhHant,
    En,
    Ja,
}

impl TemplateLang {
    pub const ALL: [TemplateLang; 4] = [
        TemplateLang::Zh,
        TemplateLang::ZhHant,
        TemplateLang::En,
        TemplateLang::Ja,
    ];

    /// Word-list keys: `zh` / `zh-Hant` / `en` / `ja`.
    pub fn as_str(self) -> &'static str {
        match self {
            TemplateLang::Zh => "zh",
            TemplateLang::ZhHant => "zh-Hant",
            TemplateLang::En => "en",
            TemplateLang::Ja => "ja",
        }
    }

    /// Parses by word-list key (case-insensitive); returns `None` for unknown keys.
    pub fn parse(key: &str) -> Option<Self> {
        let key = key.trim();
        Self::ALL
            .into_iter()
            .find(|lang| lang.as_str().eq_ignore_ascii_case(key))
    }

    /// BCP 47 language tag → catalogue language (prototype `systemLang`): `zh` with Hant / TW / HK / MO maps to Traditional Chinese,
    /// other `zh` maps to Simplified Chinese, `ja` maps to Japanese, and everything else maps to English. `_` is treated as `-` (system locale notation).
    pub fn from_tag(tag: &str) -> Self {
        let tag = tag.trim().to_ascii_lowercase().replace('_', "-");
        let primary = |p: &str| tag == p || tag.starts_with(&format!("{p}-"));
        if primary("zh") {
            if ["hant", "-tw", "-hk", "-mo"]
                .iter()
                .any(|m| tag.contains(m))
            {
                TemplateLang::ZhHant
            } else {
                TemplateLang::Zh
            }
        } else if primary("ja") {
            TemplateLang::Ja
        } else {
            TemplateLang::En
        }
    }

    fn vocab(self) -> &'static Vocab {
        match self {
            TemplateLang::Zh => &ZH,
            TemplateLang::ZhHant => &ZH_HANT,
            TemplateLang::En => &EN,
            TemplateLang::Ja => &JA,
        }
    }
}

/// The built-in catalogue word list for one language (prototype `BC_TPL.STR`, verbatim; the demo brand 「科浪」 is not a real brand).
struct Vocab {
    brand: &'static str,
    handle: &'static str,
    speaker: &'static str,
    ep: &'static str,
    talk: &'static str,
    tags: &'static str,
    subscribe: &'static str,
    save: &'static str,
    part: &'static str,
    /// Group names, in [`GROUPS`] order.
    groups: [&'static str; 9],
    /// Each built-in `(id, name, description)`, in [`BUILTIN_IDS`] order.
    docs: [(&'static str, &'static str, &'static str); 17],
}

impl Vocab {
    /// `(name, description)`; if the word list lacks this entry, an empty string is given and validation catches it (a test locks it so nothing is missing).
    fn doc(&self, id: &str) -> (&'static str, &'static str) {
        self.docs
            .iter()
            .find(|(key, ..)| *key == id)
            .map(|(_, name, desc)| (*name, *desc))
            .unwrap_or(("", ""))
    }
}

const ZH: Vocab = Vocab {
    brand: "科浪访谈",
    handle: "@kelang.studio",
    speaker: "林深",
    ep: "第 {n} 集",
    talk: "TALK",
    tags: "#干货 #科普",
    subscribe: "订阅",
    save: "记得收藏",
    part: "P{n}",
    groups: [
        "章节与进度",
        "信息条",
        "竖屏",
        "抖音",
        "小红书",
        "YouTube",
        "B 站",
        "水印",
        "品牌库",
    ],
    docs: [
        (
            "tpl-chapter-bar",
            "章节底栏 · 色条",
            "底部章节名一字排开，播过的部分被一条色条填满；台标在左下角",
        ),
        (
            "tpl-chapter-dim",
            "章节底栏 · 明暗",
            "播过的章节段是深底，没播的是浅底，进度就是这条明暗分界；台标在右上角",
        ),
        (
            "tpl-progress-line",
            "极简进度线",
            "顶部一条细色线 + 右上角时间码，画面不被遮住",
        ),
        (
            "tpl-talk-top",
            "讲座顶栏",
            "顶部信息栏：讲者 · 当前章节名 · 计时，底部一条进度；整宽顶栏只按横屏排，画幅锁定 16:9",
        ),
        (
            "tpl-lower-third",
            "下三分名条",
            "左下角两行名条：上行蓝底写项目名、下行白底写当前章节名；访谈与新闻式讲解的经典版式",
        ),
        (
            "tpl-podcast",
            "播客集数",
            "左上角集数徽章、右上角计时，底部当前章节名 + 一条细进度；给音频转视频的对谈",
        ),
        (
            "tpl-vertical",
            "竖屏切片",
            "竖屏：上三分之一一张半透明深色标题卡，大字写视频标题、下面小一号写章节名；台标在左上、右上角「第几段 / 共几段」；不画进度条，画幅锁定 9:16",
        ),
        (
            "tpl-dy-title",
            "抖音 · 大字标题",
            "黑底黄字的大标题写章节名、下面一枚红底段数徽章；账号名放在左下、避开评论区与右侧按钮；画幅锁定 9:16",
        ),
        (
            "tpl-dy-list",
            "抖音 · 知识点条",
            "顶部黄底写项目名，下面一条明暗分段的知识点条——讲到第几点一眼看到；左下一行话题标签；画幅锁定 9:16",
        ),
        (
            "tpl-xhs-note",
            "小红书 · 笔记封面",
            "白底圆角标题卡居中写章节名，玫红页码徽章；台标白底放左下；软色调的笔记感，画幅锁定 9:16",
        ),
        (
            "tpl-xhs-list",
            "小红书 · 要点清单",
            "玫红话题标签 + 白底要点条按章节分段、播过的段填成玫红；左下一枚「记得收藏」白底徽章；画幅锁定 9:16",
        ),
        (
            "tpl-yt-lower",
            "YouTube · 频道名条",
            "左下角红底白字写项目名、白底红字「订阅」徽章，底部一条红色进度线；横屏长视频的经典开场名条",
        ),
        (
            "tpl-yt-chapters",
            "YouTube · 章节进度",
            "底部章节名一字排开、播过的段被红色色条填满；左上红底台标、右上剩余时间倒数",
        ),
        (
            "tpl-bili-part",
            "B 站 · 分 P 标题",
            "左上青底「P 几」徽章、右上台标，底部青色章节条写本 P 名；给分 P 长视频",
        ),
        (
            "tpl-wm-corner",
            "水印 · 角标",
            "右下角一枚半透明台标，全程压在画面上；导出时烧进画面",
        ),
        (
            "tpl-wm-tiled",
            "水印 · 平铺",
            "品牌名斜向铺满整幅画面，低不透明度；防搬运用",
        ),
        (
            "tpl-wm-handle",
            "水印 · 社交名",
            "右上角一枚社交账号徽章；发短视频平台时把账号带在画面上",
        ),
    ],
};

const ZH_HANT: Vocab = Vocab {
    brand: "科浪訪談",
    handle: "@kelang.studio",
    speaker: "林深",
    ep: "第 {n} 集",
    talk: "TALK",
    tags: "#乾貨 #科普",
    subscribe: "訂閱",
    save: "記得收藏",
    part: "P{n}",
    groups: [
        "章節與進度",
        "資訊條",
        "直屏",
        "抖音",
        "小紅書",
        "YouTube",
        "B 站",
        "浮水印",
        "品牌庫",
    ],
    docs: [
        (
            "tpl-chapter-bar",
            "章節底欄 · 色條",
            "底部章節名一字排開，播過的部分被一條色條填滿；台標在左下角",
        ),
        (
            "tpl-chapter-dim",
            "章節底欄 · 明暗",
            "播過的章節段是深底，沒播的是淺底，進度就是這條明暗分界；台標在右上角",
        ),
        (
            "tpl-progress-line",
            "極簡進度線",
            "頂部一條細色線 + 右上角時間碼，畫面不被遮住",
        ),
        (
            "tpl-talk-top",
            "講座頂欄",
            "頂部資訊欄：講者 · 目前章節名 · 計時，底部一條進度；整寬頂欄只按橫屏排，畫幅鎖定 16:9",
        ),
        (
            "tpl-lower-third",
            "下三分名條",
            "左下角兩行名條：上行藍底寫專案名、下行白底寫目前章節名；訪談與新聞式講解的經典版式",
        ),
        (
            "tpl-podcast",
            "播客集數",
            "左上角集數徽章、右上角計時，底部目前章節名 + 一條細進度；給音訊轉影片的對談",
        ),
        (
            "tpl-vertical",
            "直屏切片",
            "直屏：上三分之一一張半透明深色標題卡，大字寫影片標題、下面小一號寫章節名；台標在左上、右上角「第幾段 / 共幾段」；不畫進度條，畫幅鎖定 9:16",
        ),
        (
            "tpl-dy-title",
            "抖音 · 大字標題",
            "黑底黃字的大標題寫章節名、下面一枚紅底段數徽章；帳號名放在左下、避開留言區與右側按鈕；畫幅鎖定 9:16",
        ),
        (
            "tpl-dy-list",
            "抖音 · 知識點條",
            "頂部黃底寫專案名，下面一條明暗分段的知識點條——講到第幾點一眼看到；左下一行話題標籤；畫幅鎖定 9:16",
        ),
        (
            "tpl-xhs-note",
            "小紅書 · 筆記封面",
            "白底圓角標題卡置中寫章節名，玫紅頁碼徽章；台標白底放左下；軟色調的筆記感，畫幅鎖定 9:16",
        ),
        (
            "tpl-xhs-list",
            "小紅書 · 要點清單",
            "玫紅話題標籤 + 白底要點條按章節分段、播過的段填成玫紅；左下一枚「記得收藏」白底徽章；畫幅鎖定 9:16",
        ),
        (
            "tpl-yt-lower",
            "YouTube · 頻道名條",
            "左下角紅底白字寫專案名、白底紅字「訂閱」徽章，底部一條紅色進度線；橫屏長影片的經典開場名條",
        ),
        (
            "tpl-yt-chapters",
            "YouTube · 章節進度",
            "底部章節名一字排開、播過的段被紅色色條填滿；左上紅底台標、右上剩餘時間倒數",
        ),
        (
            "tpl-bili-part",
            "B 站 · 分 P 標題",
            "左上青底「P 幾」徽章、右上台標，底部青色章節條寫本 P 名；給分 P 長影片",
        ),
        (
            "tpl-wm-corner",
            "浮水印 · 角標",
            "右下角一枚半透明台標，全程壓在畫面上；匯出時燒進畫面",
        ),
        (
            "tpl-wm-tiled",
            "浮水印 · 平鋪",
            "品牌名斜向鋪滿整幅畫面，低不透明度；防搬運用",
        ),
        (
            "tpl-wm-handle",
            "浮水印 · 社群名",
            "右上角一枚社群帳號徽章；發短影音平台時把帳號帶在畫面上",
        ),
    ],
};

const EN: Vocab = Vocab {
    brand: "Kelang Talks",
    handle: "@kelang.studio",
    speaker: "Lin Shen",
    ep: "EP {n}",
    talk: "TALK",
    tags: "#tips #explainer",
    subscribe: "Subscribe",
    save: "Save this",
    part: "Part {n}",
    groups: [
        "Chapters & progress",
        "Info bars",
        "Vertical",
        "Douyin",
        "Xiaohongshu",
        "YouTube",
        "Bilibili",
        "Watermarks",
        "Brand kit",
    ],
    docs: [
        (
            "tpl-chapter-bar",
            "Chapter bar · fill",
            "Chapter names across the bottom, a color bar fills what has played; logo bottom-left",
        ),
        (
            "tpl-chapter-dim",
            "Chapter bar · dim",
            "Played chapters go dark, unplayed stay light, the edge is the progress; logo top-right",
        ),
        (
            "tpl-progress-line",
            "Thin progress line",
            "A hairline across the top plus a timecode top-right; nothing covers the picture",
        ),
        (
            "tpl-talk-top",
            "Talk header",
            "Top bar with speaker · current chapter · timer, a progress bar at the bottom; full-width header is landscape only, ratio locked to 16:9",
        ),
        (
            "tpl-lower-third",
            "Lower third",
            "Two-line name plate bottom-left: project title on blue above, current chapter on white below; the classic interview and news layout",
        ),
        (
            "tpl-podcast",
            "Podcast episode",
            "Episode badge top-left, timer top-right, current chapter along the bottom with a thin progress line; for audio turned into video",
        ),
        (
            "tpl-vertical",
            "Vertical clip",
            "Portrait: a translucent dark title card in the top third — the video title large, the chapter name smaller below; logo top-left, “part / of” top-right; no progress bar, ratio locked to 9:16",
        ),
        (
            "tpl-dy-title",
            "Douyin · big title",
            "Bold yellow-on-black title with the chapter name and a red part badge under it; handle bottom-left, clear of the comment area and side buttons; ratio locked to 9:16",
        ),
        (
            "tpl-dy-list",
            "Douyin · key points",
            "Project title on yellow at the top, a dim-fill points bar under it so the viewer sees which point you are on; hashtags bottom-left; ratio locked to 9:16",
        ),
        (
            "tpl-xhs-note",
            "Xiaohongshu · note cover",
            "A centered white title card with the chapter name and a rose page badge; logo on white bottom-left; the soft note look, ratio locked to 9:16",
        ),
        (
            "tpl-xhs-list",
            "Xiaohongshu · checklist",
            "Rose hashtag tag plus a white points bar split by chapter, played parts fill rose; a “Save this” badge bottom-left; ratio locked to 9:16",
        ),
        (
            "tpl-yt-lower",
            "YouTube · channel lower third",
            "Project title on red bottom-left with a white “Subscribe” badge, a red progress line along the bottom; the classic long-form intro plate",
        ),
        (
            "tpl-yt-chapters",
            "YouTube · chapter progress",
            "Chapter names across the bottom, played parts filled red; red logo badge top-left, remaining time top-right",
        ),
        (
            "tpl-bili-part",
            "Bilibili · part title",
            "Teal “Part n” badge top-left, logo top-right, a teal chapter bar along the bottom with this part’s name; for multi-part long videos",
        ),
        (
            "tpl-wm-corner",
            "Watermark · corner",
            "A translucent logo pinned bottom-right for the whole video; burned into the export",
        ),
        (
            "tpl-wm-tiled",
            "Watermark · tiled",
            "The brand name repeated diagonally across the whole frame at low opacity; deters re-uploads",
        ),
        (
            "tpl-wm-handle",
            "Watermark · handle",
            "A social handle badge top-right; keeps your account on the picture when posting to short-video platforms",
        ),
    ],
};

const JA: Vocab = Vocab {
    brand: "Kelang トーク",
    handle: "@kelang.studio",
    speaker: "リン・シェン",
    ep: "第 {n} 回",
    talk: "TALK",
    tags: "#豆知識 #解説",
    subscribe: "チャンネル登録",
    save: "保存してね",
    part: "P{n}",
    groups: [
        "チャプターと進捗",
        "情報バー",
        "縦型",
        "Douyin",
        "Xiaohongshu",
        "YouTube",
        "Bilibili",
        "透かし",
        "ブランドキット",
    ],
    docs: [
        (
            "tpl-chapter-bar",
            "チャプターバー · 塗り",
            "下部にチャプター名を並べ、再生済みの部分をカラーバーで塗る。ロゴは左下",
        ),
        (
            "tpl-chapter-dim",
            "チャプターバー · 明暗",
            "再生済みのチャプターは濃い地、未再生は薄い地、その境目が進捗。ロゴは右上",
        ),
        (
            "tpl-progress-line",
            "細い進捗ライン",
            "上端に細いラインと右上にタイムコード。映像を隠さない",
        ),
        (
            "tpl-talk-top",
            "講演ヘッダー",
            "上部に話者 · 現在のチャプター · タイマー、下部に進捗バー。全幅ヘッダーは横長のみ、比率は 16:9 に固定",
        ),
        (
            "tpl-lower-third",
            "ローワーサード",
            "左下に 2 行のネームプレート：上段は青地にプロジェクト名、下段は白地に現在のチャプター。インタビューとニュースの定番",
        ),
        (
            "tpl-podcast",
            "ポッドキャスト回数",
            "左上にエピソードバッジ、右上にタイマー、下部に現在のチャプターと細い進捗ライン。音声を映像にした対談向け",
        ),
        (
            "tpl-vertical",
            "縦型クリップ",
            "縦型：上 1/3 に半透明の暗いタイトルカード。動画タイトルを大きく、その下にチャプター名を小さく。ロゴは左上、右上に「何話目 / 全何話」。進捗バーなし、比率は 9:16 に固定",
        ),
        (
            "tpl-dy-title",
            "Douyin · 大見出し",
            "黒地に黄色の大見出しでチャプター名、その下に赤いパート番号バッジ。アカウント名は左下でコメント欄と右側ボタンを避ける。比率は 9:16 に固定",
        ),
        (
            "tpl-dy-list",
            "Douyin · ポイントバー",
            "上部に黄地でプロジェクト名、その下に明暗で区切ったポイントバー。いま何点目かが一目で分かる。左下にハッシュタグ。比率は 9:16 に固定",
        ),
        (
            "tpl-xhs-note",
            "Xiaohongshu · ノート表紙",
            "中央に白い角丸タイトルカードでチャプター名、ローズ色のページバッジ。ロゴは左下に白地。やわらかいノート風、比率は 9:16 に固定",
        ),
        (
            "tpl-xhs-list",
            "Xiaohongshu · チェックリスト",
            "ローズ色のハッシュタグと、チャプターで区切った白いポイントバー。再生済みはローズ色に塗る。左下に「保存してね」バッジ。比率は 9:16 に固定",
        ),
        (
            "tpl-yt-lower",
            "YouTube · チャンネルネームプレート",
            "左下に赤地白字でプロジェクト名、白地赤字の「チャンネル登録」バッジ、下端に赤い進捗ライン。横長長尺動画の定番オープニング",
        ),
        (
            "tpl-yt-chapters",
            "YouTube · チャプター進捗",
            "下部にチャプター名を並べ、再生済みを赤で塗る。左上に赤いロゴバッジ、右上に残り時間",
        ),
        (
            "tpl-bili-part",
            "Bilibili · パートタイトル",
            "左上にティール色の「P 番号」バッジ、右上にロゴ、下部にティール色のチャプターバーでこのパート名。分割長尺動画向け",
        ),
        (
            "tpl-wm-corner",
            "透かし · コーナー",
            "右下に半透明のロゴを全編固定。書き出し時に映像へ焼き込む",
        ),
        (
            "tpl-wm-tiled",
            "透かし · タイル",
            "ブランド名を低い不透明度で画面全体に斜めに敷き詰める。無断転載の抑止に",
        ),
        (
            "tpl-wm-handle",
            "透かし · アカウント名",
            "右上に SNS アカウントのバッジ。ショート動画に投稿するときアカウントを画面に載せる",
        ),
    ],
};

/// Group keys and order for the catalogue (prototype `GROUPS`): built-ins are grouped by `group`, brand-kit entries always go to `brand`,
/// and empty groups do not appear.
pub const GROUPS: [&str; 9] = [
    "chapters",
    "info",
    "vertical",
    "douyin",
    "xhs",
    "youtube",
    "bili",
    "watermark",
    "brand",
];
/// Brand-kit group key.
pub const GROUP_BRAND: &str = "brand";
/// Watermark group key.
pub const GROUP_WATERMARK: &str = "watermark";
/// The group key used when `group` is missing or unrecognised (info bar).
pub const GROUP_FALLBACK: &str = "info";

/// The group key of one template (prototype `groupKey`): if `brand` is true (a definition in the brand kit, regardless of where it came from), it always goes to the brand kit;
/// otherwise it follows `group`, and a missing or unrecognised value goes to "info bar".
pub fn group_key(doc: &TemplateDoc, brand: bool) -> &'static str {
    if brand {
        return GROUP_BRAND;
    }
    doc.group
        .as_deref()
        .and_then(|group| GROUPS.iter().copied().find(|key| *key == group))
        .unwrap_or(GROUP_FALLBACK)
}

/// Group label (prototype `groupLabel`); an unrecognised group key is returned as it is.
pub fn group_label(key: &str, lang: TemplateLang) -> &str {
    match GROUPS.iter().position(|k| *k == key) {
        Some(index) => lang.vocab().groups[index],
        None => key,
    }
}

/// One section of the catalogue: group key and the entries within it (keeps input order).
#[derive(Debug, Clone, PartialEq)]
pub struct TemplateGroup<T> {
    pub key: &'static str,
    pub items: Vec<T>,
}

/// Sectioning by group (prototype `groupTemplates`): `key_of` gives each entry's group key (usually [`group_key`]); sections are ordered by
/// [`GROUPS`], empty groups do not appear, and keys not in `GROUPS` go to "info bar".
pub fn group_templates<T>(
    items: impl IntoIterator<Item = T>,
    key_of: impl Fn(&T) -> &'static str,
) -> Vec<TemplateGroup<T>> {
    let mut by: Vec<Vec<T>> = GROUPS.iter().map(|_| Vec::new()).collect();
    let fallback = GROUPS
        .iter()
        .position(|k| *k == GROUP_FALLBACK)
        .unwrap_or(0);
    for item in items {
        let key = key_of(&item);
        let index = GROUPS.iter().position(|k| *k == key).unwrap_or(fallback);
        by[index].push(item);
    }
    GROUPS
        .iter()
        .zip(by)
        .filter(|(_, items)| !items.is_empty())
        .map(|(key, items)| TemplateGroup { key, items })
        .collect()
}

/// The ids of the built-in catalogue, in catalogue order (the same across languages).
pub const BUILTIN_IDS: [&str; 17] = [
    "tpl-chapter-bar",
    "tpl-chapter-dim",
    "tpl-progress-line",
    "tpl-talk-top",
    "tpl-lower-third",
    "tpl-podcast",
    "tpl-vertical",
    "tpl-dy-title",
    "tpl-dy-list",
    "tpl-xhs-note",
    "tpl-xhs-list",
    "tpl-yt-lower",
    "tpl-yt-chapters",
    "tpl-bili-part",
    "tpl-wm-corner",
    "tpl-wm-tiled",
    "tpl-wm-handle",
];

/// Whether this is an id from the built-in catalogue (builds no document; used to decide an instance's origin, independent of language).
pub fn is_builtin_id(id: &str) -> bool {
    BUILTIN_IDS.contains(&id)
}

/// The seventeen built-ins in Simplified Chinese; the CLI, the core, and callers without a language context use this set.
pub fn builtins() -> Vec<TemplateDoc> {
    builtins_in(TemplateLang::Zh)
}

/// Produces the seventeen built-ins for the UI language (prototype `builtins(lang)`, migrated field by field; rgba has been changed to hex8; text layers without a specified weight are recorded as 700).
/// The vertical variants and the lecture top bar lock the frame size; the layers of the platform vertical variants sit only inside the platform UI safe area and do not draw a progress bar.
pub fn builtins_in(lang: TemplateLang) -> Vec<TemplateDoc> {
    let v = lang.vocab();
    let wide = TemplateCanvas::Wide;
    let tall = TemplateCanvas::Tall;
    vec![
        doc(
            v,
            "tpl-chapter-bar",
            "purple",
            "chapters",
            wide,
            vec![
                layer(
                    "l-ch",
                    LayerBox::new(0.0, 91.0, 100.0, 9.0),
                    chapters_kind(ChapterFill::Bar, "#00000099", WHITE, ORANGE, None, 2.6),
                ),
                layer(
                    "l-lg",
                    LayerBox::new(2.0, 80.0, 14.0, 8.0),
                    logo_text(v.brand, Some(RED), WHITE, LogoShape::Badge, 3.2),
                ),
            ],
        ),
        doc(
            v,
            "tpl-chapter-dim",
            "cyan",
            "chapters",
            wide,
            vec![
                layer(
                    "l-ch",
                    LayerBox::new(0.0, 91.0, 100.0, 9.0),
                    chapters_kind(
                        ChapterFill::Dim,
                        "#FFFFFFB8",
                        INK,
                        "#000000C7",
                        Some(WHITE),
                        2.6,
                    ),
                ),
                layer(
                    "l-lg",
                    LayerBox::new(84.0, 4.0, 14.0, 8.0),
                    logo_text(v.brand, Some("#0000008C"), WHITE, LogoShape::Badge, 3.0),
                ),
            ],
        ),
        doc(
            v,
            "tpl-progress-line",
            "orange",
            "chapters",
            wide,
            vec![
                layer(
                    "l-pg",
                    LayerBox::new(0.0, 0.0, 100.0, 1.4),
                    progress_kind(ORANGE, "#FFFFFF40"),
                ),
                layer(
                    "l-tc",
                    LayerBox::new(80.0, 3.0, 18.0, 6.0),
                    text(
                        "{time} / {total}",
                        WHITE,
                        Some("#00000073"),
                        TextAlign::Right,
                        2.8,
                        true,
                        700,
                    ),
                ),
                layer(
                    "l-lg",
                    LayerBox::new(2.0, 3.0, 12.0, 6.0),
                    logo_text(v.brand, None, WHITE, LogoShape::Plain, 2.8),
                ),
            ],
        ),
        locked(
            doc(
                v,
                "tpl-talk-top",
                "yellow",
                "info",
                wide,
                vec![
                    layer(
                        "l-bar",
                        LayerBox::new(0.0, 0.0, 100.0, 7.0),
                        text(
                            &format!("{} · {} · {{chapter}}", v.talk, v.speaker),
                            INK,
                            Some(YELLOW),
                            TextAlign::Left,
                            2.8,
                            false,
                            800,
                        ),
                    ),
                    layer(
                        "l-tc",
                        LayerBox::new(84.0, 0.0, 16.0, 7.0),
                        text("{time}", INK, None, TextAlign::Right, 2.8, true, 700),
                    ),
                    layer(
                        "l-pg",
                        LayerBox::new(0.0, 98.0, 100.0, 2.0),
                        progress_kind(YELLOW, "#00000059"),
                    ),
                ],
            ),
            "16:9",
        ),
        doc(
            v,
            "tpl-lower-third",
            "blue",
            "info",
            wide,
            vec![
                layer(
                    "l-name",
                    LayerBox::new(4.0, 74.0, 40.0, 7.5),
                    text(
                        "{title}",
                        WHITE,
                        Some(BLUE),
                        TextAlign::Left,
                        3.2,
                        false,
                        800,
                    ),
                ),
                layer(
                    "l-role",
                    LayerBox::new(4.0, 81.5, 30.0, 6.5),
                    text(
                        "{chapter}",
                        INK,
                        Some(WHITE),
                        TextAlign::Left,
                        2.4,
                        false,
                        600,
                    ),
                ),
            ],
        ),
        doc(
            v,
            "tpl-podcast",
            "green",
            "info",
            wide,
            vec![
                layer(
                    "l-ep",
                    LayerBox::new(3.0, 4.0, 14.0, 7.0),
                    text(v.ep, INK, Some(YELLOW), TextAlign::Center, 2.8, false, 800),
                ),
                layer(
                    "l-tc",
                    LayerBox::new(80.0, 4.0, 17.0, 7.0),
                    text(
                        "-{remain}",
                        WHITE,
                        Some("#00000073"),
                        TextAlign::Right,
                        2.8,
                        true,
                        700,
                    ),
                ),
                layer(
                    "l-ch",
                    LayerBox::new(3.0, 86.0, 60.0, 7.0),
                    text(
                        "{n} / {count} · {chapter}",
                        WHITE,
                        None,
                        TextAlign::Left,
                        3.0,
                        false,
                        700,
                    ),
                ),
                layer(
                    "l-pg",
                    LayerBox::new(3.0, 95.0, 94.0, 1.2),
                    progress_kind(YELLOW, "#FFFFFF40"),
                ),
                layer(
                    "l-lg",
                    LayerBox::new(80.0, 86.0, 17.0, 7.0),
                    faded(
                        logo_text(v.brand, None, WHITE, LogoShape::Plain, 2.2),
                        0.8,
                        false,
                    ),
                ),
            ],
        ),
        locked(
            doc(
                v,
                "tpl-vertical",
                "magenta",
                "vertical",
                tall,
                vec![
                    // The logo text is left-aligned (the box and the top-right counter have the same width). The left and right edges of the four text layers' boxes fall at 6% and 94%,
                    // and the padding is fixed at VERTICAL_PAD for all: logo text, title and chapter name start from the same vertical line,
                    // and the right edge of the counter is symmetric with the logo text.
                    layer(
                        "l-lg",
                        LayerBox::new(6.0, 4.0, 24.0, 3.2),
                        padded(
                            aligned(
                                logo_text(v.brand, Some("#0000008C"), WHITE, LogoShape::Badge, 1.6),
                                TextAlign::Left,
                            ),
                            VERTICAL_PAD,
                        ),
                    ),
                    layer(
                        "l-n",
                        LayerBox::new(70.0, 4.0, 24.0, 3.2),
                        padded(
                            text(
                                "{n} / {count}",
                                WHITE,
                                None,
                                TextAlign::Right,
                                1.6,
                                true,
                                700,
                            ),
                            VERTICAL_PAD,
                        ),
                    ),
                    // Title card: the two lines have the same width and background, stacked with no gap (the seam falls at 17.5%, an integer multiple of 1.25%,
                    // so the two semi-transparent backgrounds do not produce a bright or dark seam); the video title is large and bold, and the chapter name is one size smaller and light grey.
                    layer(
                        "l-tt",
                        LayerBox::new(6.0, 12.5, 88.0, 5.0),
                        padded(
                            text(
                                "{title}",
                                WHITE,
                                Some("#0000008C"),
                                TextAlign::Left,
                                2.4,
                                false,
                                800,
                            ),
                            VERTICAL_PAD,
                        ),
                    ),
                    layer(
                        "l-ct",
                        LayerBox::new(6.0, 17.5, 88.0, 4.0),
                        padded(
                            text(
                                "{chapter}",
                                MIST,
                                Some("#0000008C"),
                                TextAlign::Left,
                                1.8,
                                false,
                                600,
                            ),
                            VERTICAL_PAD,
                        ),
                    ),
                ],
            ),
            "9:16",
        ),
        locked(
            doc(
                v,
                "tpl-dy-title",
                "red",
                "douyin",
                tall,
                vec![
                    layer(
                        "l-tt",
                        LayerBox::new(6.0, 12.0, 76.0, 9.0),
                        text(
                            "{chapter}",
                            YELLOW,
                            Some("#000000B8"),
                            TextAlign::Left,
                            3.2,
                            false,
                            800,
                        ),
                    ),
                    layer(
                        "l-n",
                        LayerBox::new(6.0, 22.0, 18.0, 3.6),
                        text(
                            "{n} / {count}",
                            WHITE,
                            Some(RED),
                            TextAlign::Center,
                            1.6,
                            true,
                            800,
                        ),
                    ),
                    layer(
                        "l-lg",
                        LayerBox::new(6.0, 66.0, 34.0, 3.4),
                        faded(
                            logo_text(v.handle, Some("#0000008C"), WHITE, LogoShape::Badge, 1.6),
                            0.9,
                            false,
                        ),
                    ),
                ],
            ),
            "9:16",
        ),
        locked(
            doc(
                v,
                "tpl-dy-list",
                "orange",
                "douyin",
                tall,
                vec![
                    layer(
                        "l-tt",
                        LayerBox::new(6.0, 11.0, 76.0, 5.5),
                        text(
                            "{title}",
                            INK,
                            Some(YELLOW),
                            TextAlign::Left,
                            2.2,
                            false,
                            800,
                        ),
                    ),
                    layer(
                        "l-ch",
                        LayerBox::new(6.0, 17.5, 76.0, 4.2),
                        chapters_kind(ChapterFill::Dim, "#0000008C", WHITE, ORANGE, Some(INK), 1.5),
                    ),
                    layer(
                        "l-tg",
                        LayerBox::new(6.0, 66.0, 60.0, 3.4),
                        text(v.tags, WHITE, None, TextAlign::Left, 1.6, false, 700),
                    ),
                ],
            ),
            "9:16",
        ),
        locked(
            doc(
                v,
                "tpl-xhs-note",
                "pink",
                "xhs",
                tall,
                vec![
                    layer(
                        "l-tt",
                        LayerBox::new(10.0, 13.0, 68.0, 8.0),
                        text(
                            "{chapter}",
                            INK,
                            Some(WHITE),
                            TextAlign::Center,
                            2.8,
                            false,
                            800,
                        ),
                    ),
                    layer(
                        "l-n",
                        LayerBox::new(36.0, 22.2, 16.0, 3.4),
                        text(
                            "{n} / {count}",
                            WHITE,
                            Some(PINK),
                            TextAlign::Center,
                            1.5,
                            true,
                            800,
                        ),
                    ),
                    layer(
                        "l-lg",
                        LayerBox::new(10.0, 66.0, 30.0, 3.4),
                        faded(
                            logo_text(v.brand, Some(WHITE), INK, LogoShape::Badge, 1.6),
                            0.92,
                            false,
                        ),
                    ),
                ],
            ),
            "9:16",
        ),
        locked(
            doc(
                v,
                "tpl-xhs-list",
                "pink",
                "xhs",
                tall,
                vec![
                    layer(
                        "l-tg",
                        LayerBox::new(6.0, 11.0, 36.0, 3.6),
                        text(v.tags, WHITE, Some(PINK), TextAlign::Left, 1.6, false, 800),
                    ),
                    layer(
                        "l-ch",
                        LayerBox::new(6.0, 16.0, 76.0, 5.0),
                        chapters_kind(ChapterFill::Bar, "#FFFFFFEB", INK, PINK, None, 1.5),
                    ),
                    layer(
                        "l-sv",
                        LayerBox::new(6.0, 66.0, 28.0, 3.4),
                        text(
                            v.save,
                            PINK,
                            Some(WHITE),
                            TextAlign::Center,
                            1.6,
                            false,
                            800,
                        ),
                    ),
                ],
            ),
            "9:16",
        ),
        doc(
            v,
            "tpl-yt-lower",
            "red",
            "youtube",
            wide,
            vec![
                layer(
                    "l-name",
                    LayerBox::new(4.0, 76.0, 44.0, 7.5),
                    text(
                        "{title}",
                        WHITE,
                        Some(RED),
                        TextAlign::Left,
                        3.2,
                        false,
                        800,
                    ),
                ),
                layer(
                    "l-sub",
                    LayerBox::new(4.0, 83.5, 16.0, 5.5),
                    text(
                        v.subscribe,
                        RED,
                        Some(WHITE),
                        TextAlign::Center,
                        2.4,
                        false,
                        800,
                    ),
                ),
                layer(
                    "l-pg",
                    LayerBox::new(0.0, 96.0, 100.0, 1.4),
                    progress_kind(RED, "#FFFFFF4D"),
                ),
            ],
        ),
        doc(
            v,
            "tpl-yt-chapters",
            "red",
            "youtube",
            wide,
            vec![
                layer(
                    "l-ch",
                    LayerBox::new(0.0, 92.0, 100.0, 6.0),
                    chapters_kind(ChapterFill::Bar, "#00000099", WHITE, RED, None, 2.2),
                ),
                layer(
                    "l-tc",
                    LayerBox::new(82.0, 3.0, 16.0, 5.5),
                    text(
                        "-{remain}",
                        WHITE,
                        Some("#00000073"),
                        TextAlign::Right,
                        2.6,
                        true,
                        700,
                    ),
                ),
                layer(
                    "l-lg",
                    LayerBox::new(2.0, 3.0, 15.0, 5.5),
                    logo_text(v.brand, Some(RED), WHITE, LogoShape::Badge, 2.4),
                ),
            ],
        ),
        doc(
            v,
            "tpl-bili-part",
            "cyan",
            "bili",
            wide,
            vec![
                layer(
                    "l-ep",
                    LayerBox::new(2.0, 3.0, 10.0, 5.5),
                    text(v.part, WHITE, Some(TEAL), TextAlign::Center, 2.6, true, 800),
                ),
                layer(
                    "l-lg",
                    LayerBox::new(84.0, 3.0, 14.0, 5.5),
                    logo_text(v.brand, Some("#0000008C"), WHITE, LogoShape::Badge, 2.4),
                ),
                layer(
                    "l-ch",
                    LayerBox::new(0.0, 93.0, 100.0, 5.0),
                    chapters_kind(ChapterFill::Bar, "#00000099", WHITE, TEAL, None, 2.0),
                ),
            ],
        ),
        watermark(doc(
            v,
            "tpl-wm-corner",
            "gray",
            "watermark",
            wide,
            vec![layer(
                "l-wm",
                LayerBox::new(80.0, 89.0, 17.0, 7.0),
                faded(
                    logo_text(v.brand, None, WHITE, LogoShape::Plain, 2.4),
                    0.7,
                    false,
                ),
            )],
        )),
        watermark(doc(
            v,
            "tpl-wm-tiled",
            "gray",
            "watermark",
            wide,
            vec![layer(
                "l-wm",
                LayerBox::new(0.0, 0.0, 100.0, 100.0),
                faded(
                    logo_text(v.brand, None, WHITE, LogoShape::Plain, 2.6),
                    0.2,
                    true,
                ),
            )],
        )),
        watermark(doc(
            v,
            "tpl-wm-handle",
            "gray",
            "watermark",
            wide,
            vec![layer(
                "l-wm",
                LayerBox::new(74.0, 4.0, 23.0, 6.0),
                faded(
                    logo_text(v.handle, Some("#0000008C"), WHITE, LogoShape::Badge, 2.4),
                    0.85,
                    false,
                ),
            )],
        )),
    ]
}

/// Finds a built-in by id (Simplified Chinese).
pub fn builtin(id: &str) -> Option<TemplateDoc> {
    builtin_in(id, TemplateLang::Zh)
}

/// Finds a built-in by id (given language).
pub fn builtin_in(id: &str, lang: TemplateLang) -> Option<TemplateDoc> {
    if !is_builtin_id(id) {
        return None;
    }
    builtins_in(lang).into_iter().find(|d| d.id == id)
}

/// Default parameters for a newly created layer, Simplified Chinese (prototype `newLayer`).
pub fn new_layer_kind(kind: &str) -> Option<(LayerBox, LayerKind)> {
    new_layer_kind_in(kind, TemplateLang::Zh)
}

/// Creates a layer for the UI language: the default text of a logo layer is that language's sample brand name.
pub fn new_layer_kind_in(kind: &str, lang: TemplateLang) -> Option<(LayerBox, LayerKind)> {
    Some(match kind {
        "chapters" => (
            LayerBox::new(0.0, 91.0, 100.0, 9.0),
            chapters_kind(ChapterFill::Bar, "#00000099", WHITE, ORANGE, None, 2.6),
        ),
        "progress" => (
            LayerBox::new(0.0, 98.0, 100.0, 2.0),
            progress_kind(ORANGE, "#FFFFFF40"),
        ),
        "logo" => (
            LayerBox::new(2.0, 4.0, 14.0, 8.0),
            logo_text(lang.vocab().brand, Some(RED), WHITE, LogoShape::Badge, 3.2),
        ),
        "text" => (
            LayerBox::new(4.0, 14.0, 40.0, 6.0),
            text(
                "{chapter}",
                WHITE,
                Some("#00000073"),
                TextAlign::Left,
                2.8,
                false,
                700,
            ),
        ),
        _ => return None,
    })
}

/// `prefix` plus the smallest unused positive integer.
pub fn next_id<'a>(prefix: &str, taken: impl IntoIterator<Item = &'a str>) -> String {
    let taken: Vec<&str> = taken.into_iter().collect();
    let mut n = 1;
    loop {
        let id = format!("{prefix}{n}");
        if !taken.contains(&id.as_str()) {
            return id;
        }
        n += 1;
    }
}

/// Blank template.
pub fn blank(canvas: TemplateCanvas) -> TemplateDoc {
    TemplateDoc {
        id: BLANK_ID.to_string(),
        name: "未命名模板".to_string(),
        hue: "gray".to_string(),
        group: None,
        canvas,
        ratio: None,
        lock_ratio: false,
        builtin: false,
        tag: None,
        imported: None,
        desc: String::new(),
        font: None,
        from: None,
        subs_avoid: true,
        layers: Vec::new(),
    }
}

/// Definition → instance: deep copy, record the source, remove the built-in marker.
pub fn instance(def: &TemplateDoc) -> TemplateDoc {
    let mut out = def.clone();
    out.from = Some(def.id.clone());
    out.builtin = false;
    out
}

/// The next free id in the brand kit.
pub fn next_brand_id(list: &[TemplateDoc]) -> String {
    next_id(BRAND_ID_PREFIX, list.iter().map(|d| d.id.as_str()))
}

/// Saves into the brand kit: same name overwrites (keeping the original id), otherwise a new id is assigned and it is appended; removes `from` and the built-in marker.
pub fn merge_into_brand(list: &[TemplateDoc], doc: &TemplateDoc, name: &str) -> MergeOutcome {
    let mut saved = doc.clone();
    saved.name = name.to_string();
    saved.from = None;
    saved.builtin = false;
    let mut list = list.to_vec();
    if let Some(pos) = list.iter().position(|d| d.name == name) {
        saved.id = list[pos].id.clone();
        list[pos] = saved.clone();
        MergeOutcome {
            list,
            doc: saved,
            updated: true,
        }
    } else {
        saved.id = next_brand_id(&list);
        list.push(saved.clone());
        MergeOutcome {
            list,
            doc: saved,
            updated: false,
        }
    }
}

// ---------- Legacy watermark presets → brand-kit templates (2026-09-14) ----------

/// The single logo-layer id of a template imported from a legacy watermark (the same one used by the built-in watermark).
pub const WATERMARK_LAYER_ID: &str = "l-wm";
/// The id prefix given by [`from_watermark`]; when saved into the brand kit, [`merge_into_brand`] replaces it with a brand-kit id.
pub const WATERMARK_ID_PREFIX: &str = "tpl-wm-";

/// The brand-kit logo that an image watermark points to: `value` is the logo id (the Brand kit convention); older data is matched by name
/// (the prototype looks it up by image name). Absolute paths, or ones that do not match, return `None`.
fn watermark_logo<'a>(
    w: &crate::protocol::brand::Watermark,
    logos: &'a [crate::protocol::brand::Logo],
) -> Option<&'a crate::protocol::brand::Logo> {
    if w.kind != crate::protocol::brand::WatermarkKind::Image {
        return None;
    }
    logos.iter().find(|l| l.id == w.value).or_else(|| {
        logos
            .iter()
            .find(|l| l.name == w.value || w.name.as_deref() == Some(l.name.as_str()))
    })
}

/// The template name of a legacy watermark in the brand kit: a non-empty `name` takes priority; an image watermark falls back to the name of the logo it points to; then falls back to
/// `value` (the same rule as the Brand kit watermark list). Both import and "when removed from the brand kit, also delete the source watermark" match on this.
pub fn watermark_template_name(
    w: &crate::protocol::brand::Watermark,
    logos: &[crate::protocol::brand::Logo],
) -> String {
    if let Some(name) = w.name.as_deref().map(str::trim).filter(|n| !n.is_empty()) {
        return name.to_owned();
    }
    match watermark_logo(w, logos) {
        Some(logo) => logo.name.clone(),
        None => w.value.clone(),
    }
}

/// One legacy watermark → one brand-kit definition containing only a logo layer (prototype `BC_TPL.fromWatermark`, PD §14.5 "legacy watermark
/// import"): tiled → covers the whole frame, `tile`, 22%; corner badge → an 18×8 box at the bottom-right, 75%. An image watermark that matches a brand-kit logo becomes an image logo layer; one that does not match (absolute path or deleted) falls back to a text logo layer showing the name.
pub fn from_watermark(
    w: &crate::protocol::brand::Watermark,
    logos: &[crate::protocol::brand::Logo],
    lang: TemplateLang,
) -> TemplateDoc {
    use crate::protocol::brand::{Placement, WatermarkKind};
    let name = watermark_template_name(w, logos);
    let tiled = w.placement == Placement::Tiled;
    let (rect, size, opacity) = if tiled {
        (LayerBox::new(0.0, 0.0, 100.0, 100.0), 2.6, 0.22)
    } else {
        (LayerBox::new(79.0, 88.0, 18.0, 8.0), 2.4, 0.75)
    };
    let text = match w.kind {
        WatermarkKind::Text => w.value.as_str(),
        WatermarkKind::Image => name.as_str(),
    };
    let mut kind = faded(
        logo_text(text, None, WHITE, LogoShape::Plain, size),
        opacity,
        tiled,
    );
    if let (Some(logo), LayerKind::Logo { src, .. }) = (watermark_logo(w, logos), &mut kind) {
        *src = LogoSrc::brand(logo.id.clone());
    }
    let (lead, mode) = match (lang, tiled) {
        (TemplateLang::Zh, true) => ("由水印导入", "平铺"),
        (TemplateLang::Zh, false) => ("由水印导入", "右下角"),
        (TemplateLang::ZhHant, true) => ("由浮水印匯入", "平鋪"),
        (TemplateLang::ZhHant, false) => ("由浮水印匯入", "右下角"),
        (TemplateLang::En, true) => ("Imported from watermark", "Tiled"),
        (TemplateLang::En, false) => ("Imported from watermark", "Bottom right"),
        (TemplateLang::Ja, true) => ("透かしから取り込み", "タイル"),
        (TemplateLang::Ja, false) => ("透かしから取り込み", "右下"),
    };
    TemplateDoc {
        id: format!("{WATERMARK_ID_PREFIX}{}", w.id),
        name,
        hue: "gray".to_string(),
        group: Some(GROUP_WATERMARK.to_string()),
        canvas: TemplateCanvas::Wide,
        ratio: None,
        lock_ratio: false,
        builtin: false,
        tag: Some(TAG_WATERMARK.to_owned()),
        imported: Some(IMPORTED_WATERMARK.to_owned()),
        desc: format!("{lead} · {mode}"),
        font: None,
        from: None,
        subs_avoid: true,
        layers: vec![layer(WATERMARK_LAYER_ID, rect, kind)],
    }
}

/// Imports legacy watermarks into the brand kit (prototype `BC_TPL.importWatermarks`): for each one, [`from_watermark`] then
/// [`merge_into_brand`]. **Templates with the same name already in the library are skipped rather than overwritten.** The Web re-runs this every time it reads the brand kit,
/// and overwriting would reset imported templates the user has edited. On a first import the two are equivalent, and repeated imports are idempotent.
pub fn import_watermarks(
    list: &[TemplateDoc],
    watermarks: &[crate::protocol::brand::Watermark],
    logos: &[crate::protocol::brand::Logo],
    lang: TemplateLang,
) -> Vec<TemplateDoc> {
    watermarks.iter().fold(list.to_vec(), |acc, w| {
        let doc = from_watermark(w, logos, lang);
        if acc.iter().any(|d| d.name == doc.name) {
            return acc;
        }
        let name = doc.name.clone();
        merge_into_brand(&acc, &doc, &name).list
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chapters() -> Vec<ChapterSpan> {
        [
            ("c1", "开场", 0.0, 40.0),
            ("c2", "正题", 40.0, 150.0),
            ("c3", "收尾", 150.0, 206.0),
        ]
        .into_iter()
        .map(|(id, title, start, end)| ChapterSpan {
            id: id.into(),
            title: title.into(),
            start,
            end,
        })
        .collect()
    }

    fn layer_text(doc: &TemplateDoc, layer: &str) -> String {
        let found = doc.layers.iter().find(|l| l.id == layer);
        match found.map(|l| &l.kind) {
            Some(LayerKind::Text { text, .. } | LayerKind::Logo { text, .. }) => text.clone(),
            other => panic!("{} layer {layer} is not a text or logo layer: {other:?}", doc.id),
        }
    }

    #[test]
    fn builtins_validate_and_round_trip() {
        for lang in TemplateLang::ALL {
            let list = builtins_in(lang);
            let ids: Vec<&str> = list.iter().map(|d| d.id.as_str()).collect();
            assert_eq!(ids, BUILTIN_IDS, "{lang:?}");
            for d in &list {
                validate(d).unwrap_or_else(|e| panic!("{lang:?} {}: {e}", d.id));
                assert!(d.builtin);
                assert!(
                    !d.name.is_empty() && !d.desc.is_empty(),
                    "{lang:?} {}",
                    d.id
                );
                let group = d.group.as_deref().expect("built-in templates all have a group");
                assert!(GROUPS.contains(&group) && group != GROUP_BRAND, "{}", d.id);
                assert_eq!(d.imported, None);
                assert!(d.subs_avoid && d.from.is_none() && d.font.is_none());
                let text = serde_json::to_string(d).unwrap();
                let back: TemplateDoc = serde_json::from_str(&text).unwrap();
                assert_eq!(&back, d);
            }
        }
        let list = builtins();
        assert_eq!(list, builtins_in(TemplateLang::default()));
        // Frame-size locks: the lecture top bar locks 16:9; the vertical slice and the four platform vertical variants lock 9:16; other landscape templates are not locked.
        for d in &list {
            match d.id.as_str() {
                "tpl-talk-top" => {
                    assert_eq!(d.canvas, TemplateCanvas::Wide);
                    assert_eq!(d.ratio.as_deref(), Some("16:9"));
                    assert!(ratio_locked(d));
                }
                "tpl-vertical" | "tpl-dy-title" | "tpl-dy-list" | "tpl-xhs-note"
                | "tpl-xhs-list" => {
                    assert_eq!(d.canvas, TemplateCanvas::Tall, "{}", d.id);
                    assert_eq!(d.ratio.as_deref(), Some("9:16"), "{}", d.id);
                    assert!(ratio_locked(d), "{}", d.id);
                    // The vertical variants do not draw a progress bar (prototype 2026-09-14).
                    assert!(
                        d.layers.iter().all(|l| l.kind.name() != "progress"),
                        "{}",
                        d.id
                    );
                }
                _ => {
                    assert_eq!(d.canvas, TemplateCanvas::Wide, "{}", d.id);
                    assert!(d.ratio.is_none() && !d.lock_ratio, "{}", d.id);
                }
            }
        }
        let talk = builtin("tpl-talk-top").unwrap();
        assert_eq!(
            ratio_lock(&talk).map(|lock| lock.name),
            Some("讲座顶栏".to_owned())
        );
        // Instantiation keeps the lock, group and tags: instances in a project still lock the frame size, and unlocking only affects the instance.
        let inst = instance(&builtin("tpl-vertical").unwrap());
        assert!(ratio_locked(&inst));
        assert_eq!(inst.group.as_deref(), Some("vertical"));
        let wm = instance(&builtin("tpl-wm-corner").unwrap());
        assert!(wm.is_watermark() && !wm.builtin);
        assert!(builtin("nope").is_none());
        assert!(builtin_in("nope", TemplateLang::En).is_none());
        assert!(is_builtin_id("tpl-wm-tiled"));
        assert!(!is_builtin_id("tpl-brand-1") && !is_builtin_id(BLANK_ID));
    }

    /// Each language only swaps strings: once the names, descriptions and on-frame text are removed, the fields are identical field by field.
    #[test]
    fn builtins_share_structure_across_languages() {
        fn blanked(mut d: TemplateDoc) -> TemplateDoc {
            d.name.clear();
            d.desc.clear();
            for layer in &mut d.layers {
                if let LayerKind::Text { text, .. } | LayerKind::Logo { text, .. } = &mut layer.kind
                {
                    text.clear();
                }
            }
            d
        }
        let zh: Vec<TemplateDoc> = builtins().into_iter().map(blanked).collect();
        for lang in TemplateLang::ALL {
            let other: Vec<TemplateDoc> = builtins_in(lang).into_iter().map(blanked).collect();
            assert_eq!(other, zh, "{lang:?}");
        }
        let by = |lang, id| builtin_in(id, lang).unwrap();
        use TemplateLang::{En, Ja, Zh, ZhHant};
        assert_eq!(by(Zh, "tpl-chapter-bar").name, "章节底栏 · 色条");
        assert_eq!(layer_text(&by(Zh, "tpl-chapter-bar"), "l-lg"), "科浪访谈");
        assert_eq!(
            layer_text(&by(ZhHant, "tpl-chapter-bar"), "l-lg"),
            "科浪訪談"
        );
        assert_eq!(
            layer_text(&by(En, "tpl-chapter-bar"), "l-lg"),
            "Kelang Talks"
        );
        assert_eq!(
            layer_text(&by(En, "tpl-talk-top"), "l-bar"),
            "TALK · Lin Shen · {chapter}"
        );
        assert_eq!(
            layer_text(&by(Zh, "tpl-talk-top"), "l-bar"),
            "TALK · 林深 · {chapter}"
        );
        assert_eq!(layer_text(&by(Zh, "tpl-bili-part"), "l-ep"), "P{n}");
        assert_eq!(layer_text(&by(En, "tpl-bili-part"), "l-ep"), "Part {n}");
        assert_eq!(layer_text(&by(En, "tpl-podcast"), "l-ep"), "EP {n}");
        assert_eq!(
            layer_text(&by(Zh, "tpl-dy-title"), "l-lg"),
            "@kelang.studio"
        );
        assert_ne!(by(Ja, "tpl-xhs-list").name, by(En, "tpl-xhs-list").name);
        // Variable placeholders are not translated.
        assert_eq!(layer_text(&by(Ja, "tpl-vertical"), "l-tt"), "{title}");
        assert_eq!(layer_text(&by(Ja, "tpl-vertical"), "l-ct"), "{chapter}");
    }

    /// Vertical slice (prototype 2026-09-15): the video title is primary and the chapter name secondary; the two lines form one dark semi-transparent card;
    /// the logo text is left-aligned and starts from the same vertical line as the title and chapter name, sharing a fixed padding;
    /// among the built-ins, only this one's logo specifies a non-centred alignment, and only this one specifies padding.
    #[test]
    fn vertical_clip_title_card_has_hierarchy_and_left_logo() {
        let v = builtin("tpl-vertical").unwrap();
        let find = |id: &str| v.layers.iter().find(|l| l.id == id).unwrap();
        let (title, chapter, logo) = (find("l-tt"), find("l-ct"), find("l-lg"));
        let text_style = |layer: &TemplateLayer| match &layer.kind {
            LayerKind::Text {
                text,
                color,
                bg,
                align,
                size,
                weight,
                ..
            } => (
                text.clone(),
                color.clone(),
                bg.clone(),
                *align,
                *size,
                *weight,
            ),
            other => panic!("{} is not a text layer: {other:?}", layer.id),
        };
        let (t_text, t_color, t_bg, t_align, t_size, t_weight) = text_style(title);
        let (c_text, c_color, c_bg, c_align, c_size, c_weight) = text_style(chapter);
        assert_eq!((t_text.as_str(), c_text.as_str()), ("{title}", "{chapter}"));
        assert!(t_size > c_size && t_weight > c_weight, "title is larger and bolder than the chapter name");
        assert_ne!(t_color, c_color, "chapter name uses a one-step-lower color");
        assert_eq!(title.rect.y + title.rect.h, chapter.rect.y, "the two rows touch vertically");
        assert_eq!(
            (title.rect.x, title.rect.w, &t_bg),
            (chapter.rect.x, chapter.rect.w, &c_bg),
            "same width and background"
        );
        assert_eq!(t_bg.as_deref(), Some("#0000008C"), "dark translucent background");
        assert!(chapter.rect.y + chapter.rect.h < 34.0, "title card sits in the top third");
        assert_eq!((t_align, c_align), (TextAlign::Left, TextAlign::Left));
        assert!(
            v.layers.iter().all(|l| !matches!(
                &l.kind,
                LayerKind::Text { bg: Some(bg), .. } | LayerKind::Logo { bg: Some(bg), .. }
                    if bg.eq_ignore_ascii_case(YELLOW)
            )),
            "no full-block bright yellow remains"
        );
        assert!(matches!(
            logo.kind,
            LayerKind::Logo {
                align: TextAlign::Left,
                ..
            }
        ));
        // Text start position = box left edge + padding. The three text layers have different font sizes, so the padding must be the same fixed value;
        // a default derived from font size would offset the three start lines. The counter sits to the right, and its right edge is symmetric with the logo text.
        let pad_of = |layer: &TemplateLayer| match &layer.kind {
            LayerKind::Logo { pad, .. } | LayerKind::Text { pad, .. } => {
                pad.unwrap_or_else(|| panic!("{} must have a fixed padding", layer.id))
            }
            other => panic!("{} is not a text or logo layer: {other:?}", layer.id),
        };
        let starts: Vec<(f64, f64)> = [logo, title, chapter]
            .iter()
            .map(|l| (l.rect.x, pad_of(l)))
            .collect();
        assert!(
            starts.windows(2).all(|w| w[0] == w[1]),
            "logo text, title and chapter name share a left edge: {starts:?}"
        );
        let counter = find("l-n");
        assert_eq!(pad_of(counter), pad_of(logo));
        assert_eq!(100.0 - (counter.rect.x + counter.rect.w), logo.rect.x);
        assert_eq!(subs_bottom(&v, 7.0), 7.0, "no full-width bottom band, so subtitles need no offset");
        for lang in TemplateLang::ALL {
            let aligned: Vec<String> = builtins_in(lang)
                .iter()
                .flat_map(|d| {
                    d.layers.iter().filter_map(move |l| match &l.kind {
                        LayerKind::Logo { align, .. } if *align != TextAlign::Center => {
                            Some(format!("{}/{}={align:?}", d.id, l.id))
                        }
                        _ => None,
                    })
                })
                .collect();
            assert_eq!(aligned, ["tpl-vertical/l-lg=Left"], "{lang:?}");
            let padded: Vec<String> = builtins_in(lang)
                .iter()
                .flat_map(|d| {
                    d.layers.iter().filter_map(move |l| match &l.kind {
                        LayerKind::Logo { pad: Some(_), .. }
                        | LayerKind::Text { pad: Some(_), .. } => {
                            Some(format!("{}/{}", d.id, l.id))
                        }
                        _ => None,
                    })
                })
                .collect();
            assert_eq!(
                padded,
                [
                    "tpl-vertical/l-lg",
                    "tpl-vertical/l-n",
                    "tpl-vertical/l-tt",
                    "tpl-vertical/l-ct"
                ],
                "{lang:?}"
            );
        }
    }

    #[test]
    fn legacy_watermarks_import_as_logo_only_brand_templates() {
        use crate::protocol::brand::{Logo, Placement, Watermark, WatermarkKind};
        let wm = |id: &str, name: Option<&str>, kind, value: &str, placement| Watermark {
            id: id.into(),
            name: name.map(Into::into),
            kind,
            value: value.into(),
            placement,
            opacity: 0.6,
            default: false,
        };
        let logos = vec![Logo {
            id: "bm2".into(),
            name: "logo-mark.png".into(),
            file: "brand/bm2.png".into(),
            bytes: 1,
            added_at: 1,
            used_at: None,
        }];
        let wms = vec![
            wm(
                "w1",
                None,
                WatermarkKind::Text,
                "@kelang.studio",
                Placement::Tiled,
            ),
            wm("w2", None, WatermarkKind::Image, "bm2", Placement::Corner),
            wm(
                "w3",
                Some("missing.png"),
                WatermarkKind::Image,
                "/abs/missing.png",
                Placement::Corner,
            ),
        ];
        let mut existing = blank(TemplateCanvas::Wide);
        existing.id = "tpl-brand-1".into();
        existing.name = "既有".into();
        let list = import_watermarks(&[existing], &wms, &logos, TemplateLang::Zh);
        let rows: Vec<(&str, &str, bool)> = list
            .iter()
            .map(|d| (d.id.as_str(), d.name.as_str(), d.is_imported_watermark()))
            .collect();
        assert_eq!(
            rows,
            [
                ("tpl-brand-1", "既有", false),
                ("tpl-brand-2", "@kelang.studio", true),
                ("tpl-brand-3", "logo-mark.png", true),
                ("tpl-brand-4", "missing.png", true),
            ]
        );
        for d in &list[1..] {
            assert!(d.is_watermark() && !d.builtin && d.from.is_none());
            assert_eq!(d.layers.len(), 1);
            assert_eq!(d.layers[0].id, WATERMARK_LAYER_ID);
            assert!(d.desc.starts_with("由水印导入"));
            assert!(validate(d).is_ok());
        }
        let tiled = &list[1].layers[0];
        assert!(tiled.kind.tiled());
        assert!(tiled.kind.opacity() < 0.3);
        assert_eq!(tiled.rect, LayerBox::new(0.0, 0.0, 100.0, 100.0));
        let LayerKind::Logo { src, text, .. } = &tiled.kind else {
            panic!("logo layer")
        };
        assert!(src.is_text());
        assert_eq!(text, "@kelang.studio");
        let image = &list[2].layers[0];
        assert!(!image.kind.tiled() && image.rect.x > 70.0 && image.rect.y > 80.0);
        let LayerKind::Logo { src, .. } = &image.kind else {
            panic!("logo layer")
        };
        assert_eq!(src, &LogoSrc::brand("bm2"));
        let LayerKind::Logo { src, text, .. } = &list[3].layers[0].kind else {
            panic!("logo layer")
        };
        assert!(src.is_text(), "an unmatched brand library logo falls back to text");
        assert_eq!(text, "missing.png");
        // Idempotent: importing again does not create a second copy, and does not overwrite the existing one.
        let mut edited = list.clone();
        edited[1].layers[0].rect = LayerBox::new(10.0, 10.0, 50.0, 50.0);
        let again = import_watermarks(&edited, &wms, &logos, TemplateLang::Zh);
        assert_eq!(again, edited);
        assert_eq!(
            from_watermark(&wms[0], &logos, TemplateLang::En).desc,
            "Imported from watermark · Tiled"
        );
        // Imported definitions can still be instantiated as usual.
        assert_eq!(instance(&list[1]).from.as_deref(), Some("tpl-brand-2"));
    }

    #[test]
    fn watermark_trio_is_logo_only_and_tagged() {
        let list = builtins();
        let ids: Vec<&str> = list
            .iter()
            .filter(|d| d.is_watermark())
            .map(|d| d.id.as_str())
            .collect();
        assert_eq!(ids, ["tpl-wm-corner", "tpl-wm-tiled", "tpl-wm-handle"]);
        for d in list.iter().filter(|d| d.is_watermark()) {
            assert_eq!(d.group.as_deref(), Some(GROUP_WATERMARK));
            assert_eq!(d.layers.len(), 1, "{}", d.id);
            assert_eq!(d.layers[0].id, "l-wm");
            assert_eq!(d.layers[0].kind.name(), "logo");
            assert!(!d.is_imported_watermark());
            // A logo layer is not a horizontal bar, so it does not raise subtitles.
            assert_eq!(subs_bottom(d, 0.0), 0.0);
        }
        assert!(
            list.iter()
                .filter(|d| !d.is_watermark())
                .all(|d| d.tag.is_none())
        );
        let tiled = builtin("tpl-wm-tiled").unwrap();
        assert!(tiled.layers[0].kind.tiled());
        assert_eq!(tiled.layers[0].kind.opacity(), 0.2);
        assert_eq!(tiled.layers[0].rect, LayerBox::new(0.0, 0.0, 100.0, 100.0));
        let corner = builtin("tpl-wm-corner").unwrap();
        assert!(!corner.layers[0].kind.tiled());
        assert_eq!(corner.layers[0].kind.opacity(), 0.7);
        let handle = builtin("tpl-wm-handle").unwrap();
        assert!(!handle.layers[0].kind.tiled());
        assert_eq!(handle.layers[0].kind.opacity(), 0.85);
        // Semi-transparent logos are not only for watermarks: the logos of the podcast and the platform vertical variants also have opacity.
        assert_eq!(
            builtin("tpl-podcast").unwrap().layers[4].kind.opacity(),
            0.8
        );
        assert_eq!(
            builtin("tpl-chapter-bar").unwrap().layers[1].kind.opacity(),
            1.0
        );
    }

    #[test]
    fn template_lang_follows_system_tag() {
        use TemplateLang::{En, Ja, Zh, ZhHant};
        for (tag, want) in [
            ("zh", Zh),
            ("zh-CN", Zh),
            ("zh-Hans-SG", Zh),
            ("zh-TW", ZhHant),
            ("zh-Hant-HK", ZhHant),
            ("ZH-mo", ZhHant),
            ("zh_HK", ZhHant),
            ("ja", Ja),
            ("ja-JP", Ja),
            ("jav", En),
            ("zhx", En),
            ("en-US", En),
            ("fr", En),
            ("", En),
        ] {
            assert_eq!(TemplateLang::from_tag(tag), want, "{tag:?}");
        }
        for lang in TemplateLang::ALL {
            assert_eq!(TemplateLang::parse(lang.as_str()), Some(lang));
        }
        assert_eq!(TemplateLang::parse("ZH-HANT"), Some(ZhHant));
        assert_eq!(TemplateLang::parse("fr"), None);
        assert_eq!(TemplateLang::default(), Zh);
    }

    #[test]
    fn groups_follow_catalog_order_and_skip_empty() {
        let list = builtins();
        let groups = group_templates(list.iter(), |d| group_key(d, false));
        let keys: Vec<&str> = groups.iter().map(|g| g.key).collect();
        assert_eq!(keys, GROUPS[..8], "built-in catalog has no brand library group");
        let counts: Vec<usize> = groups.iter().map(|g| g.items.len()).collect();
        assert_eq!(counts, [3, 3, 1, 2, 2, 2, 1, 3]);
        assert_eq!(groups[3].items[0].id, "tpl-dy-title", "items keep catalog order within a group");

        // Anything in the brand kit always goes to the brand kit; a missing or unrecognised group goes to info bar.
        let mut saved = builtin("tpl-wm-tiled").unwrap();
        saved.id = "tpl-brand-1".into();
        let mut odd = builtin("tpl-chapter-bar").unwrap();
        odd.group = Some("festival".into());
        let mut bare = builtin("tpl-vertical").unwrap();
        bare.group = None;
        assert_eq!(group_key(&saved, true), GROUP_BRAND);
        assert_eq!(group_key(&odd, false), GROUP_FALLBACK);
        assert_eq!(group_key(&bare, false), GROUP_FALLBACK);
        let items = [
            (&saved, true),
            (&odd, false),
            (&list[0], false),
            (&bare, false),
        ];
        let groups = group_templates(items, |(d, brand)| group_key(d, *brand));
        let shape: Vec<(&str, Vec<&str>)> = groups
            .iter()
            .map(|g| (g.key, g.items.iter().map(|(d, _)| d.id.as_str()).collect()))
            .collect();
        assert_eq!(
            shape,
            [
                ("chapters", vec!["tpl-chapter-bar"]),
                ("info", vec!["tpl-chapter-bar", "tpl-vertical"]),
                ("brand", vec!["tpl-brand-1"]),
            ]
        );
        // Keys not in GROUPS also go to info bar.
        let stray = group_templates([1], |_| "nope");
        assert_eq!(stray[0].key, GROUP_FALLBACK);

        assert_eq!(group_label("chapters", TemplateLang::Zh), "章节与进度");
        assert_eq!(group_label("xhs", TemplateLang::ZhHant), "小紅書");
        assert_eq!(group_label("brand", TemplateLang::En), "Brand kit");
        assert_eq!(group_label("festival", TemplateLang::Ja), "festival");
    }

    #[test]
    fn validation_rejects_bad_docs() {
        let mut d = builtin("tpl-chapter-bar").unwrap();
        d.layers[1].id = "l-ch".into();
        assert!(validate(&d).is_err(), "duplicate layer id");
        let mut d = builtin("tpl-chapter-bar").unwrap();
        d.layers[0].rect.h = 0.2;
        assert!(validate(&d).is_err(), "below minimum height");
        let mut d = builtin("tpl-chapter-bar").unwrap();
        d.layers[0].rect.y = 95.0;
        assert!(validate(&d).is_err(), "out of bounds");
        let mut d = builtin("tpl-chapter-bar").unwrap();
        if let LayerKind::Chapters { accent, .. } = &mut d.layers[0].kind {
            *accent = "rgba(0,0,0,0.5)".into();
        }
        assert!(validate(&d).is_err(), "non-hex color");
        let mut d = builtin("tpl-chapter-bar").unwrap();
        d.hue = "chartreuse".into();
        assert!(validate(&d).is_err(), "unknown hue");
        let mut d = builtin("tpl-chapter-bar").unwrap();
        if let LayerKind::Logo { src, .. } = &mut d.layers[1].kind {
            *src = LogoSrc::file("../secret.png");
        }
        assert!(validate(&d).is_err(), "file path escapes the project");
        if let LayerKind::Logo { src, .. } = &mut d.layers[1].kind {
            *src = LogoSrc::file("assets/template/logo.png");
        }
        validate(&d).unwrap();
        d.font = Some("Noto Sans SC".into());
        validate(&d).unwrap();
    }

    #[test]
    fn clamp_box_sizes_first_then_position() {
        let b = clamp_box(LayerBox::new(98.0, 99.5, 10.0, 0.2));
        assert_eq!(b, LayerBox::new(90.0, 99.4, 10.0, 0.6));
        let b = clamp_box(LayerBox::new(-3.33, 4.44, 200.0, 50.0));
        assert_eq!(b, LayerBox::new(0.0, 4.4, 100.0, 50.0));
        let b = clamp_box(LayerBox::new(10.0, 10.0, 1.0, 1.0));
        assert_eq!(b, LayerBox::new(10.0, 10.0, 4.0, 1.0));
    }

    #[test]
    fn resize_from_each_handle_anchors_the_opposite_edge() {
        let frame = Frame {
            w: 1000.0,
            h: 500.0,
        };
        let b0 = LayerBox::new(20.0, 20.0, 40.0, 20.0);
        // Bottom-right = the old resize_box.
        assert_eq!(
            resize_box_from(b0, Handle::SE, 100.0, 50.0, frame),
            resize_box(b0, 100.0, 50.0, frame)
        );
        // Left edge: the right edge at 60 stays put.
        let b = resize_box_from(b0, Handle::W, -100.0, 999.0, frame);
        assert_eq!(b, LayerBox::new(10.0, 20.0, 50.0, 20.0));
        // Top edge: the bottom edge at 40 stays put.
        let b = resize_box_from(b0, Handle::N, 999.0, 50.0, frame);
        assert_eq!(b, LayerBox::new(20.0, 30.0, 40.0, 10.0));
        // Top-left corner dragged past the opposite edge: stops at the minimum size, and the opposite edge still does not move.
        let b = resize_box_from(b0, Handle::NW, 5000.0, 5000.0, frame);
        assert_eq!(b, LayerBox::new(56.0, 39.4, 4.0, 0.6));
        // Dragged out of the frame: clamped at the boundary.
        let b = resize_box_from(b0, Handle::NE, 9000.0, -9000.0, frame);
        assert_eq!(b, LayerBox::new(20.0, 0.0, 80.0, 40.0));
        let b = resize_box_from(b0, Handle::SW, -9000.0, 9000.0, frame);
        assert_eq!(b, LayerBox::new(0.0, 20.0, 60.0, 80.0));
        // Pure horizontal or pure vertical handles do not touch the other axis.
        let b = resize_box_from(b0, Handle::E, 100.0, 300.0, frame);
        assert_eq!(b, LayerBox::new(20.0, 20.0, 50.0, 20.0));
        let b = resize_box_from(b0, Handle::S, 300.0, 50.0, frame);
        assert_eq!(b, LayerBox::new(20.0, 20.0, 40.0, 30.0));
        for h in Handle::ALL {
            assert_eq!(Handle::parse(h.as_str()), Some(h));
        }
        assert_eq!(Handle::parse("x"), None);
    }

    #[test]
    fn drag_and_resize_convert_pixels() {
        let frame = Frame { w: 800.0, h: 450.0 };
        let b0 = LayerBox::new(10.0, 10.0, 20.0, 10.0);
        assert_eq!(
            drag_box(b0, 80.0, 45.0, frame),
            LayerBox::new(20.0, 20.0, 20.0, 10.0)
        );
        assert_eq!(
            drag_box(b0, 8000.0, -4500.0, frame),
            LayerBox::new(80.0, 0.0, 20.0, 10.0)
        );
        assert_eq!(
            resize_box(b0, 80.0, 45.0, frame),
            LayerBox::new(10.0, 10.0, 30.0, 20.0)
        );
        assert_eq!(
            resize_box(b0, -8000.0, -4500.0, frame),
            LayerBox::new(10.0, 10.0, 4.0, 0.6)
        );
    }

    #[test]
    fn hit_test_is_top_down_and_skips_off_layers() {
        let mut d = builtin("tpl-chapter-bar").unwrap();
        assert_eq!(hit_test(&d, 5.0, 85.0).map(|l| l.id.as_str()), Some("l-lg"));
        assert_eq!(
            hit_test(&d, 50.0, 95.0).map(|l| l.id.as_str()),
            Some("l-ch")
        );
        assert!(hit_test(&d, 50.0, 50.0).is_none());
        d.layers[1].on = false;
        assert!(hit_test(&d, 5.0, 85.0).is_none());
        // Closed interval: a hit on the boundary counts.
        assert_eq!(
            hit_test(&d, 0.0, 100.0).map(|l| l.id.as_str()),
            Some("l-ch")
        );
    }

    #[test]
    fn segments_and_vars_follow_playhead() {
        let ch = chapters();
        let segs = segments(&ch, 100.0, 206.0);
        assert_eq!(segs.len(), 3);
        assert_eq!(segs[0].state, SegmentState::Done);
        assert_eq!(segs[0].done, 1.0);
        assert_eq!(segs[1].state, SegmentState::On);
        assert!((segs[1].done - 60.0 / 110.0).abs() < 1e-9);
        assert_eq!(segs[2].state, SegmentState::Todo);
        assert_eq!(segs[2].done, 0.0);
        assert_eq!(segs[2].span, 56.0);

        let whole = segments(&[], 10.0, 206.0);
        assert_eq!(whole.len(), 1);
        assert_eq!(whole[0].id, "all");
        assert_eq!(whole[0].span, 206.0);

        let v = vars(&ch, 100.0, 206.0, &[("title", "演示项目")]);
        assert_eq!(v["chapter"], "正题");
        assert_eq!(v["n"], "2");
        assert_eq!(v["count"], "3");
        assert_eq!(v["time"], "1:40");
        assert_eq!(v["remain"], "1:46");
        assert_eq!(v["total"], "3:26");
        assert_eq!(v["percent"], "49%");
        assert_eq!(v["title"], "演示项目");
        // If playback has finished, take the last segment; if it has not started, take the first.
        assert_eq!(vars(&ch, 206.0, 206.0, &[])["chapter"], "收尾");
        assert_eq!(vars(&ch, 300.0, 206.0, &[])["percent"], "100%");
        assert_eq!(vars(&ch, -1.0, 206.0, &[])["chapter"], "开场");
        assert_eq!(
            fill("{time} / {total} · {chapter} {nope} {", &v),
            "1:40 / 3:26 · 正题 {nope} {"
        );
    }

    #[test]
    fn timecode_formats() {
        assert_eq!(timecode(0.0), "0:00");
        assert_eq!(timecode(65.9), "1:05");
        assert_eq!(timecode(3600.0), "1:00:00");
        assert_eq!(timecode(7.0 * 3600.0 + 61.0), "7:01:01");
        assert_eq!(timecode(-5.0), "0:00");
    }

    #[test]
    fn subs_bottom_only_counts_low_strips() {
        let bar = builtin("tpl-chapter-bar").unwrap();
        assert_eq!(subs_bottom(&bar, 0.0), 11.0);
        assert_eq!(subs_bottom(&bar, 15.0), 15.0);
        let line = builtin("tpl-progress-line").unwrap();
        assert_eq!(subs_bottom(&line, 3.0), 3.0, "top progress line does not lift subtitles");
        let talk = builtin("tpl-talk-top").unwrap();
        assert_eq!(subs_bottom(&talk, 0.0), 4.0);
        assert_eq!(subs_bottom(&builtin("tpl-yt-chapters").unwrap(), 0.0), 10.0);
        assert_eq!(subs_bottom(&builtin("tpl-bili-part").unwrap(), 0.0), 9.0);
        assert_eq!(subs_bottom(&builtin("tpl-podcast").unwrap(), 0.0), 7.0);
        let dy = builtin("tpl-dy-list").unwrap();
        assert_eq!(subs_bottom(&dy, 0.0), 0.0, "upper-half knowledge bar does not lift subtitles");
        let mut off = bar.clone();
        off.layers[0].on = false;
        assert_eq!(subs_bottom(&off, 0.0), 0.0);
        let mut no_avoid = bar.clone();
        no_avoid.subs_avoid = false;
        assert_eq!(subs_bottom(&no_avoid, 0.0), 0.0);
    }

    #[test]
    fn instance_and_brand_merge() {
        let def = builtin("tpl-chapter-bar").unwrap();
        let inst = instance(&def);
        assert_eq!(inst.from.as_deref(), Some("tpl-chapter-bar"));
        assert!(!inst.builtin);
        assert_eq!(inst.layers, def.layers);

        let first = merge_into_brand(&[], &inst, "节目包装");
        assert!(!first.updated);
        assert_eq!(first.doc.id, "tpl-brand-1");
        assert_eq!(first.doc.name, "节目包装");
        assert_eq!(first.doc.from, None);
        assert_eq!(first.list.len(), 1);

        let mut changed = inst.clone();
        changed.hue = "blue".into();
        let second = merge_into_brand(&first.list, &changed, "节目包装");
        assert!(second.updated);
        assert_eq!(second.doc.id, "tpl-brand-1");
        assert_eq!(second.list.len(), 1);
        assert_eq!(second.list[0].hue, "blue");

        let third = merge_into_brand(&second.list, &inst, "另一套");
        assert_eq!(third.doc.id, "tpl-brand-2");
        assert_eq!(third.list.len(), 2);
        assert_eq!(next_id("l-", ["l-1", "l-3"]), "l-2");
    }

    #[test]
    fn blank_and_new_layer_defaults() {
        let b = blank(TemplateCanvas::Tall);
        assert_eq!(b.id, BLANK_ID);
        assert!(b.layers.is_empty());
        validate(&b).unwrap();
        for kind in ["chapters", "progress", "logo", "text"] {
            let (rect, k) = new_layer_kind(kind).unwrap();
            assert_eq!(k.name(), kind);
            let mut d = b.clone();
            d.layers.push(TemplateLayer {
                id: "l-1".into(),
                on: true,
                rect,
                kind: k,
            });
            validate(&d).unwrap();
        }
        assert!(new_layer_kind("sticker").is_none());
        // The default text of a new logo layer follows the language; the other parameters are the same across languages.
        let (_, zh) = new_layer_kind("logo").unwrap();
        let (_, en) = new_layer_kind_in("logo", TemplateLang::En).unwrap();
        assert!(matches!(&zh, LayerKind::Logo { text, .. } if text == "科浪访谈"));
        assert!(matches!(&en, LayerKind::Logo { text, .. } if text == "Kelang Talks"));
        assert_eq!(
            new_layer_kind_in("text", TemplateLang::Ja),
            new_layer_kind("text")
        );
    }
}
