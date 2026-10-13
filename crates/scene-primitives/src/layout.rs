//! Static layout: simplified flex (row/column + align/justify/gap) + absolute positioning.
//! Layout is computed once: animation does not change layout, only transforms (guaranteed by the §6.4 allowlist).
//! Text measurement is injected by the host through the TextMeasure trait (core does no I/O).

use crate::color::Rgba;
use crate::resolve::{CapLane, CapLine, CapLineBox, CapWordBox, Ir, RNode, Rect};
use crate::svgpath;
use serde_json::Value;

/// Result of measuring a single line of text
#[derive(Debug, Clone, Copy, Default)]
pub struct TextMetricsLine {
    pub width: f64,
    pub ascent: f64,
    pub descent: f64,
}

pub trait TextMeasure {
    /// Empty family = default sans-serif family; when the document has font assets, the host matches strictly (§8.4 determinism)
    fn measure(&mut self, text: &str, family: &str, font_size: f64, weight: u16)
    -> TextMetricsLine;

    /// Measurement with `fontStyle` (§6.3). The default implementation ignores italics; only hosts that really pick italic faces (`TextEngine` in `ccut-render`) need to override it.
    fn measure_styled(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
        _italic: bool,
    ) -> TextMetricsLine {
        self.measure(text, family, font_size, weight)
    }

    fn measure_spaced(
        &mut self,
        text: &str,
        family: &str,
        size: f64,
        weight: u16,
        italic: bool,
        spacing: f64,
    ) -> TextMetricsLine {
        use unicode_segmentation::UnicodeSegmentation;
        let mut metrics = self.measure_styled(text, family, size, weight, italic);
        metrics.width += text.graphemes(true).count() as f64 * spacing;
        metrics
    }

    fn measure_rich(
        &mut self,
        text: &str,
        range: std::ops::Range<usize>,
        base: crate::text_layout::FontStyle<'_>,
        runs: &[crate::text_layout::Run],
    ) -> TextMetricsLine {
        let mut out = TextMetricsLine::default();
        for (range, font) in crate::text_layout::font_runs(base, runs, range) {
            let m = self.measure_spaced(
                &text[range],
                font.family,
                font.size,
                font.weight,
                font.italic,
                font.spacing,
            );
            out.width += m.width;
            out.ascent = out.ascent.max(m.ascent);
            out.descent = out.descent.max(m.descent);
        }
        out
    }
}

pub fn prepare(node: &mut RNode, m: &mut dyn TextMeasure) {
    let s = &node.style;
    node.font_size = s.get("fontSize").and_then(Value::as_f64).unwrap_or(16.0);
    let weight = s.get("fontWeight").and_then(Value::as_f64).unwrap_or(400.0);
    node.font_weight = if node.text_wrap.is_some() {
        weight.round()
    } else {
        weight
    } as u16;
    node.font_family = s
        .get("font")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if let Some(c) = Rgba::parse_value(s.get("color")) {
        node.text_color = c;
    }
    node.bg_color = Rgba::parse_value(s.get("background"));
    node.border_radius = s.get("borderRadius").and_then(Value::as_f64).unwrap_or(0.0);
    node.base_scale = s.get("scale").and_then(Value::as_f64).unwrap_or(1.0);
    node.base_scale_x = s.get("scaleX").and_then(Value::as_f64);
    node.base_scale_y = s.get("scaleY").and_then(Value::as_f64);
    node.base_rotation = s.get("rotation").and_then(Value::as_f64).unwrap_or(0.0);
    node.base_opacity = s.get("opacity").and_then(Value::as_f64).unwrap_or(1.0);
    node.anchor = s
        .get("anchor")
        .and_then(Value::as_str)
        .unwrap_or("center")
        .to_string();
    // `anchor: [x, y]`: the box ratio of the element (spec §6.3). Joint pivots use it.
    node.anchor_xy = s.get("anchor").and_then(Value::as_array).and_then(|a| {
        match (
            a.first().and_then(Value::as_f64),
            a.get(1).and_then(Value::as_f64),
        ) {
            (Some(x), Some(y)) if a.len() == 2 && x.is_finite() && y.is_finite() => Some((x, y)),
            _ => None,
        }
    });

    if node.ntype == "text" {
        // Other strings of a content track `text` (§6.2.2): if `width` is not given, the element box is sized by the widest of all keyframe strings, so switching to a longer string does not overflow on either side of the box. If `width` is given, the author's value wins and nothing is collected here.
        let alternates: Vec<String> = if s.get("width").is_none() {
            node.channels
                .iter()
                .filter(|channel| channel.prop == "text")
                .flat_map(|channel| channel.frames.iter())
                .filter_map(|frame| frame.v.as_str())
                .filter(|text| Some(*text) != node.text.as_deref())
                .map(str::to_owned)
                .collect()
        } else {
            Vec::new()
        };
        if let Some(wrap) = node.text_wrap {
            let text = node.text.as_deref().unwrap_or("");
            let width = s.get("width").and_then(Value::as_f64);
            let line_height = s
                .get("lineHeight")
                .and_then(Value::as_f64)
                .unwrap_or_else(|| (node.font_size * 1.25).ceil());
            let spacing = s
                .get("letterSpacing")
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let base = crate::text_layout::FontStyle {
                family: &node.font_family,
                size: node.font_size,
                weight: node.font_weight,
                italic: node.font_italic,
                spacing,
            };
            let mut block = crate::text_layout::layout(text, wrap, width, line_height, |range| {
                m.measure_rich(text, range, base, &node.text_runs)
            });
            if s.get("lineHeight").is_none() {
                let mut offset = 0.0;
                for line in &mut block.lines {
                    let size = crate::text_layout::font_runs(
                        base,
                        &node.text_runs,
                        line.bytes.start..line.paint_end,
                    )
                    .iter()
                    .map(|(_, font)| font.size)
                    .fold(base.size, f64::max);
                    line.line_height = (size * 1.25).ceil();
                    line.offset = offset;
                    offset += line.line_height;
                }
                block.height = offset;
            }
            // Strings with changed content are measured by the same rules as the rendering side (no runs, see `record_text`).
            let widest = alternates
                .iter()
                .map(|alternate| {
                    crate::text_layout::layout(alternate, wrap, width, line_height, |range| {
                        m.measure_rich(alternate, range, base, &[])
                    })
                    .width
                })
                .fold(block.width, f64::max);
            node.text_w = widest;
            node.text_asc = block.lines.first().map_or(0.0, |line| line.metrics.ascent);
            node.text_desc = block.lines.first().map_or(0.0, |line| line.metrics.descent);
            node.text_block = Some(block);
        } else {
            let tm = m.measure_styled(
                node.text.as_deref().unwrap_or(""),
                &node.font_family,
                node.font_size,
                node.font_weight,
                node.font_italic,
            );
            let widest = alternates
                .iter()
                .map(|alternate| {
                    m.measure_styled(
                        alternate,
                        &node.font_family,
                        node.font_size,
                        node.font_weight,
                        node.font_italic,
                    )
                    .width
                })
                .fold(tm.width, f64::max);
            node.text_w = widest;
            node.text_asc = tm.ascent;
            node.text_desc = tm.descent;
        }
    }
    if node.ntype == "svg" {
        let vb_w = node.view_box.map(|v| v[2]).unwrap_or(120.0);
        let w = node
            .style
            .get("width")
            .and_then(Value::as_f64)
            .or(node.view_box.map(|v| v[2]))
            .unwrap_or(0.0);
        let scale = if vb_w > 0.0 { w / vb_w } else { 1.0 };
        // The (minX, minY) of the viewBox lands on the box's top-left corner (§6.2.1): translate first, then scale uniformly.
        let (ox, oy) = node.view_box.map_or((0.0, 0.0), |v| (v[0], v[1]));
        let to_box = |(x, y): (f64, f64)| ((x - ox) * scale, (y - oy) * scale);
        for c in &mut node.children {
            if c.ntype == "path" {
                c.svg_scale = scale;
                if let Some(d) = &c.path_d {
                    c.subpaths = svgpath::parse(d)
                        .into_iter()
                        .map(|poly| poly.into_iter().map(to_box).collect())
                        .collect();
                    let mut len = 0.0;
                    for poly in &c.subpaths {
                        for w in poly.windows(2) {
                            len += ((w[1].0 - w[0].0).powi(2) + (w[1].1 - w[0].1).powi(2)).sqrt();
                        }
                    }
                    c.total_len = len;
                    c.morph_shapes = c
                        .morph_d
                        .iter()
                        .map(|d| {
                            svgpath::parse(d)
                                .into_iter()
                                .map(|poly| poly.into_iter().map(to_box).collect())
                                .collect()
                        })
                        .collect();
                }
                prepare(c, m);
            }
        }
        return;
    }
    for c in &mut node.children {
        prepare(c, m);
    }
}

pub fn layout_mode(node: &RNode) -> Option<String> {
    if let Some(wl) = &node.wrap_layout {
        if let Some(m) = wl.get("mode").and_then(Value::as_str) {
            return Some(m.to_string());
        }
    }
    if let Some(m) = node.style.get("layout").and_then(Value::as_str) {
        if m == "row" || m == "column" || m == "grid" {
            return Some(m.to_string());
        }
    }
    None
}

/// grid column count (§6.3): when missing or invalid (≤0), treated as 1 column
fn grid_columns(node: &RNode) -> usize {
    node.style
        .get("columns")
        .and_then(Value::as_f64)
        .map(|n| n as i64)
        .filter(|n| *n > 0)
        .unwrap_or(1) as usize
}

/// Main-axis flex weight (§6.3 `flex`): non-numeric or ≤0 means it does not take part in distribution
fn flex_weight(node: &RNode) -> f64 {
    node.style
        .get("flex")
        .and_then(Value::as_f64)
        .filter(|v| *v > 0.0)
        .unwrap_or(0.0)
}

pub fn is_absolute(node: &RNode) -> bool {
    node.wrap_layout.is_some() || node.style.contains_key("x") || node.style.contains_key("y")
}

pub fn intrinsic(node: &mut RNode) -> (f64, f64) {
    if let Some(c) = node.intrinsic_cache {
        return c;
    }
    let ew = node.style.get("width").and_then(Value::as_f64);
    let eh = node.style.get("height").and_then(Value::as_f64);
    let mut size: (f64, f64);
    match node.ntype.as_str() {
        "text" => {
            size = (
                node.text_w,
                node.text_block
                    .as_ref()
                    .map_or_else(|| (node.font_size * 1.25).ceil(), |block| block.height),
            );
        }
        "svg" => {
            size = (ew.unwrap_or(0.0), eh.unwrap_or(0.0));
        }
        // image / animatedImage / lottie / program / video: natural size (HostInputs metadata); when only one side is given, the other side is derived from the aspect ratio
        "image" | "animatedImage" | "lottie" | "program" | "video" => {
            let (nw, nh) = (node.nat_w, node.nat_h);
            size = match (ew, eh) {
                (Some(w), Some(h)) => (w, h),
                (Some(w), None) => (w, if nw > 0.0 { w * nh / nw } else { 0.0 }),
                (None, Some(h)) => (if nh > 0.0 { h * nw / nh } else { 0.0 }, h),
                (None, None) => (nw, nh),
            };
        }
        _ => {
            if let Some(mode) = layout_mode(node) {
                let gap = node
                    .wrap_layout
                    .as_ref()
                    .and_then(|wl| wl.get("gap").and_then(Value::as_f64))
                    .or_else(|| node.style.get("gap").and_then(Value::as_f64))
                    .unwrap_or(0.0);
                if mode == "grid" {
                    // Fixed n columns, auto-wrapping in order; column width = widest child, row height = tallest child in that row
                    let cols = grid_columns(node);
                    let mut sizes: Vec<(f64, f64)> = Vec::new();
                    for c in &mut node.children {
                        if is_absolute(c) {
                            continue;
                        }
                        sizes.push(intrinsic(c));
                    }
                    let col_w = sizes.iter().fold(0.0f64, |a, s| a.max(s.0));
                    let rows = sizes.len().div_ceil(cols);
                    let mut hh = 0.0f64;
                    for r in 0..rows {
                        let lo = r * cols;
                        let hi = ((r + 1) * cols).min(sizes.len());
                        let row_h = sizes[lo..hi].iter().fold(0.0f64, |a, s| a.max(s.1));
                        hh += row_h + if r > 0 { gap } else { 0.0 };
                    }
                    size = (
                        cols as f64 * col_w + gap * (cols.saturating_sub(1)) as f64,
                        hh,
                    );
                } else {
                    let mut main = 0.0f64;
                    let mut cross = 0.0f64;
                    let mut i = 0usize;
                    for c in &mut node.children {
                        if is_absolute(c) {
                            continue;
                        }
                        let cs = intrinsic(c);
                        if mode == "row" {
                            main += cs.0 + if i > 0 { gap } else { 0.0 };
                            cross = cross.max(cs.1);
                        } else {
                            main += cs.1 + if i > 0 { gap } else { 0.0 };
                            cross = cross.max(cs.0);
                        }
                        i += 1;
                    }
                    size = if mode == "row" {
                        (main, cross)
                    } else {
                        (cross, main)
                    };
                }
            } else {
                let mut w = 0.0f64;
                let mut h = 0.0f64;
                for c in &mut node.children {
                    if is_absolute(c) {
                        continue;
                    }
                    let cs = intrinsic(c);
                    w = w.max(cs.0);
                    h = h.max(cs.1);
                }
                size = (w, h);
            }
        }
    }
    if let Some(w) = ew {
        size.0 = w;
    }
    if let Some(h) = eh {
        size.1 = h;
    }
    node.intrinsic_cache = Some(size);
    size
}

/// node.frame is already set; lay out the children and recurse
pub fn place(node: &mut RNode) {
    if node.ntype == "svg" {
        let sz = (node.frame.w, node.frame.h);
        for c in &mut node.children {
            c.frame = Rect {
                x: 0.0,
                y: 0.0,
                w: sz.0,
                h: sz.1,
            };
        }
        return;
    }
    let w = node
        .composition
        .as_ref()
        .map_or(node.frame.w, |canvas| canvas.width);
    let h = node
        .composition
        .as_ref()
        .map_or(node.frame.h, |canvas| canvas.height);
    let mode = layout_mode(node);
    let gap = node
        .wrap_layout
        .as_ref()
        .and_then(|wl| wl.get("gap").and_then(Value::as_f64))
        .or_else(|| node.style.get("gap").and_then(Value::as_f64))
        .unwrap_or(0.0);
    let align = node
        .style
        .get("align")
        .and_then(Value::as_str)
        .unwrap_or("center")
        .to_string();
    let justify = node
        .style
        .get("justify")
        .and_then(Value::as_str)
        .unwrap_or("start")
        .to_string();

    let mut flow_idx: Vec<usize> = Vec::new();
    for (i, c) in node.children.iter_mut().enumerate() {
        if is_absolute(c) {
            let (cx, cy) = {
                let wl = c.wrap_layout.as_ref();
                let x = wl
                    .and_then(|w| w.get("x").and_then(Value::as_f64))
                    .or_else(|| c.style.get("x").and_then(Value::as_f64))
                    .unwrap_or(0.0);
                let y = wl
                    .and_then(|w| w.get("y").and_then(Value::as_f64))
                    .or_else(|| c.style.get("y").and_then(Value::as_f64))
                    .unwrap_or(0.0);
                (x, y)
            };
            let cs = intrinsic(c);
            c.frame = Rect {
                x: cx,
                y: cy,
                w: cs.0,
                h: cs.1,
            };
        } else {
            flow_idx.push(i);
        }
    }

    if let Some(mode) = mode {
        let sizes: Vec<(f64, f64)> = flow_idx
            .iter()
            .map(|&i| intrinsic(&mut node.children[i]))
            .collect();
        if mode == "grid" {
            let cols = grid_columns(node);
            let col_w = (w - gap * (cols.saturating_sub(1)) as f64) / cols as f64;
            let rows = sizes.len().div_ceil(cols);
            let mut row_y = 0.0f64;
            for r in 0..rows {
                let lo = r * cols;
                let hi = ((r + 1) * cols).min(sizes.len());
                let row_h = sizes[lo..hi].iter().fold(0.0f64, |a, s| a.max(s.1));
                for (k, cs) in sizes[lo..hi].iter().enumerate() {
                    let cell_x = (col_w + gap) * k as f64;
                    let dx = match justify.as_str() {
                        "center" => (col_w - cs.0) / 2.0,
                        "end" => col_w - cs.0,
                        _ => 0.0,
                    };
                    let dy = match align.as_str() {
                        "start" => 0.0,
                        "end" => row_h - cs.1,
                        _ => (row_h - cs.1) / 2.0,
                    };
                    node.children[flow_idx[lo + k]].frame = Rect {
                        x: cell_x + dx,
                        y: row_y + dy,
                        w: cs.0,
                        h: cs.1,
                    };
                }
                row_y += row_h + gap;
            }
        } else {
            let mut main_total = 0.0;
            for (i, cs) in sizes.iter().enumerate() {
                main_total +=
                    (if mode == "row" { cs.0 } else { cs.1 }) + if i > 0 { gap } else { 0.0 };
            }
            let main_span = if mode == "row" { w } else { h };
            // flex distribution (§6.3): the remaining main-axis space is shared by weight among in-flow children that declare flex
            let weights: Vec<f64> = flow_idx
                .iter()
                .map(|&i| flex_weight(&node.children[i]))
                .collect();
            let wsum: f64 = weights.iter().sum();
            let free = main_span - main_total;
            let mut extra = vec![0.0f64; sizes.len()];
            if wsum > 0.0 && free > 0.0 {
                for (k, e) in extra.iter_mut().enumerate() {
                    *e = free * weights[k] / wsum;
                }
                main_total = main_span;
            }
            let mut pos = match justify.as_str() {
                "center" => (main_span - main_total) / 2.0,
                "end" => main_span - main_total,
                _ => 0.0,
            };
            for (k, &i) in flow_idx.iter().enumerate() {
                let cs = sizes[k];
                let main_size = (if mode == "row" { cs.0 } else { cs.1 }) + extra[k];
                let cross_span = if mode == "row" { h } else { w };
                let cross_size = if mode == "row" { cs.1 } else { cs.0 };
                let cross_pos = match align.as_str() {
                    "start" => 0.0,
                    "end" => cross_span - cross_size,
                    _ => (cross_span - cross_size) / 2.0,
                };
                node.children[i].frame = if mode == "row" {
                    Rect {
                        x: pos,
                        y: cross_pos,
                        w: main_size,
                        h: cs.1,
                    }
                } else {
                    Rect {
                        x: cross_pos,
                        y: pos,
                        w: cs.0,
                        h: main_size,
                    }
                };
                pos += main_size + gap;
            }
        }
    } else {
        for &i in &flow_idx {
            let cs = intrinsic(&mut node.children[i]);
            node.children[i].frame = Rect {
                x: 0.0,
                y: 0.0,
                w: cs.0,
                h: cs.1,
            };
        }
    }
    for c in &mut node.children {
        place(c);
    }
}

// ── Deterministic subtitle typesetting (§8.4): core lays out line boxes; the render side, preview side, and Swift side only draw ──

/// Whether a space is needed between words/characters: added between Latin words, not between CJK characters.
/// The rendering side and the browser preview side must use the same rule (the preview side is an equivalent regex implementation).
pub fn needs_space(prev: &str, next: &str) -> bool {
    let (Some(a), Some(b)) = (prev.chars().last(), next.chars().next()) else {
        return false;
    };
    const TAIL: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?;:'\")]";
    const HEAD: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789(\"'[";
    TAIL.contains(a) && HEAD.contains(b)
}

/// CJK ideographs / kana / fullwidth punctuation: may break line character by character
fn is_cjk(c: char) -> bool {
    matches!(c as u32,
        0x2E80..=0x303F | 0x3040..=0x30FF | 0x3400..=0x4DBF |
        0x4E00..=0x9FFF | 0xF900..=0xFAFF | 0xFF00..=0xFFEF)
}

/// Break unit: `lead_space` means a space width is needed between this unit and the previous one
struct Tok {
    text: String,
    lead_space: bool,
    width: f64,
    /// Index back into `CapLine.words` in the word-level lane
    word_index: Option<usize>,
}

/// Plain text split: whitespace tokenization + CJK per character
fn tokenize_text(text: &str) -> Vec<(String, bool)> {
    let mut out: Vec<(String, bool)> = Vec::new();
    let mut cur = String::new();
    let mut cur_lead = false;
    let mut pending = false;
    for c in text.chars() {
        if c.is_whitespace() {
            if !cur.is_empty() {
                out.push((std::mem::take(&mut cur), cur_lead));
            }
            pending = true;
            continue;
        }
        if is_cjk(c) {
            if !cur.is_empty() {
                out.push((std::mem::take(&mut cur), cur_lead));
            }
            out.push((c.to_string(), pending));
            pending = false;
            continue;
        }
        if cur.is_empty() {
            cur_lead = pending;
            pending = false;
        }
        cur.push(c);
    }
    if !cur.is_empty() {
        out.push((cur, cur_lead));
    }
    out
}

/// Typesetting draft of one line (x/y not yet decided)
struct RowDraft {
    text: String,
    w: f64,
    ascent: f64,
    descent: f64,
    words: Vec<CapWordBox>,
}

/// Single lane's subtitle line → line box draft.
/// When `wrap_w = None` or the whole line fits, returns a single line identical pixel-for-pixel to the no-wrap case.
fn build_rows(
    line: &CapLine,
    lane: &CapLane,
    wrap_w: Option<f64>,
    m: &mut dyn TextMeasure,
) -> Vec<RowDraft> {
    let (fam, fs, fw) = (lane.font_family.clone(), lane.font_size, lane.font_weight);
    let full = m.measure(&line.text, &fam, fs, fw);
    let word_mode = line.words.is_some() && lane.hi_color.is_some();
    let space_w = m.measure(" ", &fam, fs, fw).width;

    // ① First compute the no-wrap line box: if it fits, return it as-is, so line-breaking logic cannot disturb existing layout
    let mut single_words: Vec<CapWordBox> = Vec::new();
    let single_w = if word_mode {
        let words = line.words.as_ref().unwrap();
        let mut x = 0.0f64;
        for (i, w) in words.iter().enumerate() {
            if i > 0 && needs_space(&words[i - 1].text, &w.text) {
                x += space_w;
            }
            single_words.push(CapWordBox {
                index: i,
                dx: x,
                text: w.text.clone(),
            });
            x += m.measure(&w.text, &fam, fs, fw).width;
        }
        x
    } else {
        full.width
    };
    let fits = match wrap_w {
        None => true,
        Some(ww) => ww <= 0.0 || single_w <= ww,
    };
    if fits {
        return vec![RowDraft {
            text: line.text.clone(),
            w: single_w,
            ascent: full.ascent,
            descent: full.descent,
            words: single_words,
        }];
    }
    let wrap_w = wrap_w.unwrap();

    // ② Greedy line breaking
    let toks: Vec<Tok> = if word_mode {
        let words = line.words.as_ref().unwrap();
        words
            .iter()
            .enumerate()
            .map(|(i, w)| Tok {
                lead_space: i > 0 && needs_space(&words[i - 1].text, &w.text),
                width: m.measure(&w.text, &fam, fs, fw).width,
                text: w.text.clone(),
                word_index: Some(i),
            })
            .collect()
    } else {
        tokenize_text(&line.text)
            .into_iter()
            .map(|(text, lead_space)| Tok {
                width: m.measure(&text, &fam, fs, fw).width,
                text,
                lead_space,
                word_index: None,
            })
            .collect()
    };

    let mut rows: Vec<Vec<&Tok>> = Vec::new();
    let mut cur: Vec<&Tok> = Vec::new();
    let mut cur_w = 0.0f64;
    for tok in &toks {
        let lead = if !cur.is_empty() && tok.lead_space {
            space_w
        } else {
            0.0
        };
        if !cur.is_empty() && cur_w + lead + tok.width > wrap_w {
            rows.push(std::mem::take(&mut cur));
            cur_w = tok.width;
            cur.push(tok);
        } else {
            cur_w += lead + tok.width;
            cur.push(tok);
        }
    }
    if !cur.is_empty() {
        rows.push(cur);
    }

    let sp = space_w;
    rows.into_iter()
        .map(|row| {
            let mut text = String::new();
            let mut words: Vec<CapWordBox> = Vec::new();
            let mut x = 0.0f64;
            for (k, tok) in row.iter().enumerate() {
                if k > 0 && tok.lead_space {
                    text.push(' ');
                    x += sp;
                }
                text.push_str(&tok.text);
                if let Some(idx) = tok.word_index {
                    words.push(CapWordBox {
                        index: idx,
                        dx: x,
                        text: tok.text.clone(),
                    });
                }
                x += tok.width;
            }
            let tm = m.measure(&text, &fam, fs, fw);
            RowDraft {
                w: if word_mode { x } else { tm.width },
                ascent: tm.ascent,
                descent: tm.descent,
                words,
                text,
            }
        })
        .collect()
}

/// Computes line boxes for all subtitle cues in the IR (§3.6 region/grow + §8.4 anchor/offset).
/// Must be called once before rendering; the rendering side no longer lays out text on its own.
pub fn layout_captions(ir: &mut Ir, m: &mut dyn TextMeasure) {
    let (cw, ch) = (ir.w, ir.h);
    for cap in &mut ir.caption_clips {
        let lanes = &cap.lanes;
        let gap = cap.gap;
        let wrap_w = match cap.region {
            Some(r) => Some(r[2]),
            None => cap.max_width,
        };
        let center_x = match cap.region {
            Some(r) => r[0] + r[2] / 2.0,
            None => cw / 2.0,
        };
        for item in &mut cap.items {
            // pass 1: line-break each lane
            let mut drafts: Vec<(usize, Vec<RowDraft>)> = Vec::new();
            let mut total_h = 0.0f64;
            for (li, lane) in lanes.iter().enumerate() {
                let Some(line) = item.lines.get(&lane.id) else {
                    continue;
                };
                let rows = build_rows(line, lane, wrap_w, m);
                let lane_h = lane.font_size * 1.3 + lane.line_gap;
                if !drafts.is_empty() {
                    total_h += gap;
                }
                total_h += lane_h * rows.len() as f64;
                drafts.push((li, rows));
            }
            if drafts.is_empty() {
                continue;
            }
            // pass 2: positioning
            let mut top = match cap.region {
                Some(r) => {
                    if cap.grow_up {
                        r[1] + r[3] - total_h
                    } else {
                        r[1]
                    }
                }
                None => {
                    let offset_px = cap.offset * ch;
                    if cap.anchor_top {
                        offset_px
                    } else {
                        ch - offset_px - total_h
                    }
                }
            };
            for (li, rows) in drafts {
                let lane = &lanes[li];
                let lane_h = lane.font_size * 1.3 + lane.line_gap;
                let content_h = lane.font_size * 1.25;
                let n = rows.len();
                let boxes: Vec<CapLineBox> = rows
                    .into_iter()
                    .enumerate()
                    .map(|(r, d)| CapLineBox {
                        x: center_x - d.w / 2.0,
                        y: top + lane_h * r as f64 + (lane_h - content_h) / 2.0,
                        w: d.w,
                        h: content_h,
                        ascent: d.ascent,
                        descent: d.descent,
                        words: d.words,
                        text: d.text,
                    })
                    .collect();
                if let Some(line) = item.lines.get_mut(&lane.id) {
                    line.boxes = Some(boxes);
                }
                top += lane_h * n as f64 + gap;
            }
        }
    }
}

pub fn layout_tree(root: &mut RNode, canvas_w: f64, canvas_h: f64, m: &mut dyn TextMeasure) {
    prepare(root, m);
    let size = intrinsic(root);
    root.frame = Rect {
        x: 0.0,
        y: 0.0,
        w: if size.0 > 0.0 { size.0 } else { canvas_w },
        h: if size.1 > 0.0 { size.1 } else { canvas_h },
    };
    place(root);
}
