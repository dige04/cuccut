//! **Fill-colour grouping** for vector assets (round 122, §14.4).
//!
//! Follows the prototype `designs/cuccut/app/model-svgfill.js` line by line. The mechanism:
//!
//! * **Colours are not declared by the catalogue; they are parsed out of the asset**: walk the eight tags in [`TAGS`], and for each take the `fill` attribute → the `fill:` declaration in `style` → `stop-color`, extracting the hex from each.
//! * **Nodes with the same default hex are grouped together**; the number of groups = the number of distinct fill colours in the asset, regardless of element type.
//! * **Two exclusions**: if the asset contains an `<image>` (a bitmap wrapper) → no swatches at all; if there are **more than [`MAX_COLORS`]** distinct colours → no swatches at all (that is an illustration, and recolouring it colour by colour is meaningless).
//! * Otherwise take the **first [`MAX_SWATCHES`] groups** as the default swatches.
//!
//! ## Three rules (settled in the prototype; copied here, do not re-judge them elsewhere)
//!
//! 1. **Group order follows document order of first appearance**, not tag batches.
//! 2. **A recolour applies to every node in the group**, not filtered by tag; otherwise a same-colour group spanning tags would only be half recoloured.
//! 3. **In `style`, only the `fill:` declaration is recognised and changed** (matching hex against the whole `style` string, or overwriting the whole attribute when recolouring, would also lose `fill-rule` / `stroke`).
//!
//! `#RGB` is always expanded to `#RRGGBB` before comparing, so `#fff` and `#FFFFFF` are the same group.
//!
//! ## Why this layer does not parse the DOM
//!
//! Recolouring **replaces in place at absolute offsets**: re-serialising would wash out comments, indentation and `xml:space`, and this same text is still compared byte-for-byte against the original asset. So scanning is a single deterministic tag and attribute scan (equivalent to the prototype's three regexes), without introducing an xml crate, so it compiles to wasm.
//!
//! ## Relationship to document storage (D1)
//!
//! The on-screen truth is the core `sticker.fillOverrides` (**keyed by source hex**, `StickerProps` in `ccut_timeline::schema`). The UI side only lays out the order of [`fills_of`] as the "group N" cards; the translation between the two lives in [`fills_to_overrides`] and [`fill_list_from_overrides`], which both App and Web read, rather than each writing its own.

use std::collections::BTreeMap;

pub fn animation_duration(svg: &str) -> Result<Option<f64>, String> {
    scene_primitives::svg_animation::SvgAnimation::parse(svg)
        .map(|a| a.map(|a| a.duration()))
        .map_err(|e| e.to_string())
}
pub fn sample_animation(svg: &str, seconds: f64) -> Result<String, String> {
    scene_primitives::svg_animation::SvgAnimation::parse(svg)
        .map(|a| a.map_or_else(|| svg.to_owned(), |a| a.sample(seconds)))
        .map_err(|e| e.to_string())
}

/// Only the fill colours of these eight tags go into the swatches.
pub const TAGS: [&str; 8] = [
    "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "stop",
];
/// Maximum number of default swatches.
pub const MAX_SWATCHES: usize = 5;
/// If there are more distinct colours than this, no swatches are given at all.
pub const MAX_COLORS: usize = 15;

/// One place in the source text where a same-colour group's node carries its colour (absolute byte offsets, half-open range).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

/// A group of nodes sharing the same default colour.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FillGroup {
    /// The normalised default colour (`#RRGGBB` or `#RRGGBBAA`, uppercase).
    pub hex: String,
    /// The tag of the **first** node in this group (see module header rule 2).
    pub tag: String,
    /// How many nodes are in this group.
    pub count: usize,
    /// All positions to replace in place when recolouring (one node may have both a `fill` and a `style` entry).
    pub spans: Vec<Span>,
}

/// One swatch on the panel (the shape of `fillsOf`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FillCard {
    pub hex: String,
    pub tag: String,
    pub count: usize,
}

/// One layer of a built-in vector sticker (the `layers` in core `sticker/*.json`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BuiltinLayer<'a> {
    pub d: &'a str,
    pub fill: Option<&'a str>,
    pub stroke: Option<&'a str>,
    pub width: f64,
}

// ---------------------------------------------------------------------------
// Colour values
// ---------------------------------------------------------------------------

/// Normalising a fill key: expands the three-digit shorthand and uppercases everything, so that `#fff` and `#FFFFFF` are recognised as the same group.
/// Eight-digit values (with alpha) are kept as they are, since the override table is keyed by them. No validation is done here; colour values typed by the user go through
/// `ccut_editor_core::color::norm_hex` (validation and dropping alpha), which is also built on top of this.
pub fn norm_fill_hex(hex: &str) -> String {
    let upper = hex.to_ascii_uppercase();
    let bytes = upper.as_bytes();
    if bytes.len() == 4 {
        let mut out = String::with_capacity(7);
        out.push('#');
        for byte in &bytes[1..4] {
            out.push(*byte as char);
            out.push(*byte as char);
        }
        return out;
    }
    upper
}

/// The hex in a colour-value string (`none` / `currentColor` / gradient references yield no colour).
///
/// The three forms are tried in order: 8 digits (with alpha), then 6 digits, then the 3-digit shorthand. Not adding a word boundary is
/// deliberate: the four-digit form (`#RGBA`) reads back as its first three digits.
pub fn hex_in(value: &str) -> Option<String> {
    let cleaned = strip_url(value);
    find_hex(&cleaned, 8)
        .or_else(|| find_hex(&cleaned, 6))
        .or_else(|| find_hex(&cleaned, 3))
}

/// `/url\([^)]*\)/g → ' '`: the `#id` inside gradient / pattern references is not a colour.
fn strip_url(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(at) = rest.find("url(") {
        let tail = &rest[at + 4..];
        let Some(close) = tail.find(')') else {
            break;
        };
        out.push_str(&rest[..at]);
        out.push(' ');
        rest = &tail[close + 1..];
    }
    out.push_str(rest);
    out
}

/// The first `#` followed by `n` hex digits in the string.
fn find_hex(value: &str, digits: usize) -> Option<String> {
    let bytes = value.as_bytes();
    for (index, byte) in bytes.iter().enumerate() {
        if *byte != b'#' {
            continue;
        }
        let end = index + 1 + digits;
        if end > bytes.len() {
            continue;
        }
        if bytes[index + 1..end].iter().all(u8::is_ascii_hexdigit) {
            return Some(value[index..end].to_owned());
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Scanning (equivalent to the prototype's TAG_RE / ATTR_RE)
// ---------------------------------------------------------------------------

struct Attr {
    name: String,
    value: String,
    /// Absolute start position in the source text of the value (excluding quotes).
    start: usize,
}

struct Node {
    tag: String,
    attrs: Vec<Attr>,
}

impl Node {
    fn attr(&self, name: &str) -> Option<&Attr> {
        self.attrs.iter().find(|attr| attr.name == name)
    }
}

struct Scan {
    image: bool,
    nodes: Vec<Node>,
}

fn is_name_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic()
}

fn is_name_char(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b':' | b'_' | b'.' | b'-')
}

fn is_attr_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || matches!(byte, b'_' | b':')
}

fn scan(text: &str) -> Scan {
    let bytes = text.as_bytes();
    let mut nodes = Vec::new();
    let mut image = false;
    let mut at = 0usize;
    while at < bytes.len() {
        let Some(lt) = bytes[at..].iter().position(|b| *b == b'<').map(|i| i + at) else {
            break;
        };
        let name_start = lt + 1;
        if name_start >= bytes.len() || !is_name_start(bytes[name_start]) {
            at = lt + 1;
            continue;
        }
        let mut cursor = name_start;
        while cursor < bytes.len() && is_name_char(bytes[cursor]) {
            cursor += 1;
        }
        let tag = text[name_start..cursor].to_ascii_lowercase();
        // Attribute area: a `>` inside quotes is consumed by the quotes; a tag that is never closed does not match at all (same as the regex).
        let attrs_start = cursor;
        let mut scan_at = cursor;
        let mut closed = None;
        while scan_at < bytes.len() {
            match bytes[scan_at] {
                b'>' => {
                    closed = Some(scan_at);
                    break;
                }
                quote @ (b'"' | b'\'') => {
                    let Some(end) = bytes[scan_at + 1..]
                        .iter()
                        .position(|b| *b == quote)
                        .map(|i| i + scan_at + 1)
                    else {
                        break;
                    };
                    scan_at = end + 1;
                }
                _ => scan_at += 1,
            }
        }
        let Some(gt) = closed else {
            at = lt + 1;
            continue;
        };
        if tag == "image" {
            image = true;
            at = gt + 1;
            continue;
        }
        if TAGS.contains(&tag.as_str()) {
            nodes.push(Node {
                tag,
                attrs: scan_attrs(text, attrs_start, gt),
            });
        }
        at = gt + 1;
    }
    Scan { image, nodes }
}

/// All `name="value"` pairs in an attribute area (the absolute start of each value is recorded alongside).
fn scan_attrs(text: &str, from: usize, to: usize) -> Vec<Attr> {
    let bytes = text.as_bytes();
    let mut out: Vec<Attr> = Vec::new();
    let mut at = from;
    while at < to {
        if !is_attr_start(bytes[at]) {
            at += 1;
            continue;
        }
        let name_start = at;
        let mut cursor = at;
        while cursor < to && is_name_char(bytes[cursor]) {
            cursor += 1;
        }
        let name_end = cursor;
        while cursor < to && matches!(bytes[cursor], b' ' | b'\t' | b'\r' | b'\n') {
            cursor += 1;
        }
        if cursor >= to || bytes[cursor] != b'=' {
            at = name_start + 1;
            continue;
        }
        cursor += 1;
        while cursor < to && matches!(bytes[cursor], b' ' | b'\t' | b'\r' | b'\n') {
            cursor += 1;
        }
        if cursor >= to || !matches!(bytes[cursor], b'"' | b'\'') {
            at = name_start + 1;
            continue;
        }
        let quote = bytes[cursor];
        let value_start = cursor + 1;
        let Some(value_end) = bytes[value_start..to]
            .iter()
            .position(|b| *b == quote)
            .map(|i| i + value_start)
        else {
            at = name_start + 1;
            continue;
        };
        let name = text[name_start..name_end].to_ascii_lowercase();
        let attr = Attr {
            name,
            value: text[value_start..value_end].to_owned(),
            start: value_start,
        };
        // For a duplicate attribute name, the later one overwrites the earlier (as JS `attrs[name] = …`).
        if let Some(slot) = out.iter_mut().find(|old| old.name == attr.name) {
            *slot = attr;
        } else {
            out.push(attr);
        }
        at = value_end + 1;
    }
    out
}

/// All positions on a node that **carry a fill colour**: the `fill` attribute, the fill declaration in `style`, and
/// `stop-color`. The order is the order in which default colours are read.
fn carriers(node: &Node) -> Vec<(Span, String)> {
    let mut out = Vec::new();
    if let Some(fill) = node.attr("fill") {
        if let Some(hex) = hex_in(&fill.value) {
            let end = fill.start + fill.value.len();
            out.push((
                Span {
                    start: fill.start,
                    end,
                },
                hex,
            ));
        }
    }
    if let Some(style) = node.attr("style") {
        if let Some((offset, value)) = style_fill(&style.value) {
            if let Some(hex) = hex_in(value) {
                let start = style.start + offset;
                out.push((
                    Span {
                        start,
                        end: start + value.len(),
                    },
                    hex,
                ));
            }
        }
    }
    if let Some(stop) = node.attr("stop-color") {
        if let Some(hex) = hex_in(&stop.value) {
            let end = stop.start + stop.value.len();
            out.push((
                Span {
                    start: stop.start,
                    end,
                },
                hex,
            ));
        }
    }
    out
}

/// The value of the first `fill:` declaration in the `style` string (returns its offset within the string and the value itself).
///
/// Equivalent to the prototype's `/(^|;)([ \t]*)fill[ \t]*:[ \t]*([^;]*)/i`: the only candidate start positions are the beginning of the string and each `;`, so `fill-rule:` and `fill-opacity:` are not mistaken for it.
fn style_fill(style: &str) -> Option<(usize, &str)> {
    let bytes = style.as_bytes();
    let mut starts = vec![0usize];
    starts.extend(
        bytes
            .iter()
            .enumerate()
            .filter(|(_, b)| **b == b';')
            .map(|(i, _)| i + 1),
    );
    for start in starts {
        let mut at = start;
        while at < bytes.len() && matches!(bytes[at], b' ' | b'\t') {
            at += 1;
        }
        if at + 4 > bytes.len() || !style[at..at + 4].eq_ignore_ascii_case("fill") {
            continue;
        }
        at += 4;
        while at < bytes.len() && matches!(bytes[at], b' ' | b'\t') {
            at += 1;
        }
        if at >= bytes.len() || bytes[at] != b':' {
            continue;
        }
        at += 1;
        while at < bytes.len() && matches!(bytes[at], b' ' | b'\t') {
            at += 1;
        }
        let end = bytes[at..]
            .iter()
            .position(|b| *b == b';')
            .map_or(bytes.len(), |i| i + at);
        return Some((at, &style[at..end]));
    }
    None
}

// ---------------------------------------------------------------------------
// Grouping and swatches
// ---------------------------------------------------------------------------

/// Groups by normalised colour; group order = order of first appearance. If it contains `<image>`, returns an empty table directly.
pub fn groups_of(svg: &str) -> Vec<FillGroup> {
    let scanned = scan(svg);
    if scanned.image {
        return Vec::new();
    }
    let mut groups: Vec<FillGroup> = Vec::new();
    for node in &scanned.nodes {
        let spans = carriers(node);
        let Some((_, first)) = spans.first() else {
            continue;
        };
        let hex = norm_fill_hex(first);
        let index = match groups.iter().position(|group| group.hex == hex) {
            Some(index) => index,
            None => {
                groups.push(FillGroup {
                    hex,
                    tag: node.tag.clone(),
                    count: 0,
                    spans: Vec::new(),
                });
                groups.len() - 1
            }
        };
        groups[index].count += 1;
        groups[index]
            .spans
            .extend(spans.into_iter().map(|(span, _)| span));
    }
    groups
}

/// The swatch table. If it contains `<image>` or more than [`MAX_COLORS`] colours, the table is empty; otherwise it has at most
/// [`MAX_SWATCHES`] groups.
pub fn fills_of(svg: &str) -> Vec<FillCard> {
    let groups = groups_of(svg);
    if groups.len() > MAX_COLORS {
        return Vec::new();
    }
    groups
        .into_iter()
        .take(MAX_SWATCHES)
        .map(|group| FillCard {
            hex: group.hex,
            tag: group.tag,
            count: group.count,
        })
        .collect()
}

/// The default swatches (the set used when the element is first selected).
pub fn default_fills(svg: &str) -> Vec<String> {
    fills_of(svg).into_iter().map(|card| card.hex).collect()
}

/// Equal item by item to the default colours means this asset has not been recoloured yet, so the original URL is used directly on screen.
pub fn is_default(svg: &str, fill_list: &[Option<String>]) -> bool {
    if fill_list.is_empty() {
        return true;
    }
    let want = default_fills(svg);
    want.len() == fill_list.len()
        && want.iter().zip(fill_list).all(|(hex, got)| {
            got.as_deref()
                .is_some_and(|got| norm_fill_hex(got) == hex.as_str())
        })
}

/// Recolour by swatch: swatch i only changes the fill colours of the nodes in group i; not a single character elsewhere is touched.
pub fn apply_fills(svg: &str, fill_list: &[Option<String>]) -> String {
    if fill_list.is_empty() {
        return svg.to_owned();
    }
    let groups = groups_of(svg);
    let take = groups.len().min(fill_list.len()).min(MAX_SWATCHES);
    let mut edits: Vec<(Span, &str)> = Vec::new();
    for (group, want) in groups.iter().zip(fill_list).take(take) {
        let Some(want) = want.as_deref() else {
            continue;
        };
        if want.is_empty() {
            continue;
        }
        edits.extend(group.spans.iter().map(|span| (*span, want)));
    }
    if edits.is_empty() {
        return svg.to_owned();
    }
    edits.sort_by_key(|(span, _)| span.start);
    let mut out = String::with_capacity(svg.len());
    let mut at = 0usize;
    for (span, want) in edits {
        if span.start < at {
            continue;
        }
        out.push_str(&svg[at..span.start]);
        out.push_str(want);
        at = span.end;
    }
    out.push_str(&svg[at..]);
    out
}

/// Recolour by `sticker.fillOverrides`: the override table is keyed by **source hex**, and whichever group it matches gets recoloured.
///
/// This is the on-screen entry point (`ccut-subtitle-render` runs raster asset stickers through this step before rendering). It and the panel-side [`apply_fills`] ("by swatch N") are two ways of indexing the same span edit: the panel knows the swatch order, while the render chain only has the table in the document. The two must produce the same image, otherwise "preview equals export" breaks on a recoloured sticker. The swatch order in [`apply_fills`] is exactly the group order of [`groups_of`], so here the lookup is done directly by each group's default colour.
pub fn apply_overrides(svg: &str, overrides: &BTreeMap<String, String>) -> String {
    if overrides.is_empty() {
        return svg.to_owned();
    }
    let fill_list: Vec<Option<String>> = groups_of(svg)
        .into_iter()
        .map(|group| {
            overrides
                .iter()
                .find(|(source, _)| norm_fill_hex(source) == group.hex)
                .map(|(_, target)| norm_fill_hex(target))
        })
        .collect();
    apply_fills(svg, &fill_list)
}

// ---------------------------------------------------------------------------
// D1: swatches ↔ `sticker.fillOverrides`
// ---------------------------------------------------------------------------

/// The swatches on the panel → the override table in the document (**keys are source hex**, `schema::StickerProps`).
///
/// Only the groups that were actually changed are written: any group equal to its default colour gets no key. Otherwise the document would fill up with noise duplicating the asset's own values, and the `is_default` check could never tell "not changed".
pub fn fills_to_overrides(
    fills: &[FillCard],
    edits: &[Option<String>],
) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for (card, edit) in fills.iter().zip(edits) {
        let Some(edit) = edit.as_deref() else {
            continue;
        };
        let want = norm_fill_hex(edit);
        if want == card.hex {
            continue;
        }
        out.insert(card.hex.clone(), want);
    }
    out
}

/// Reverse read: the override table in the document → what colour each swatch on the panel is right now.
///
/// A group with no override reads back its default colour, so this list is always the same length as [`fills_of`]. The panel does not need to check again whether "group N has been changed".
pub fn fill_list_from_overrides(
    fills: &[FillCard],
    overrides: &BTreeMap<String, String>,
) -> Vec<Option<String>> {
    fills
        .iter()
        .map(|card| {
            overrides
                .iter()
                .find(|(source, _)| norm_fill_hex(source) == card.hex)
                .map(|(_, target)| norm_fill_hex(target))
                .or_else(|| Some(card.hex.clone()))
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Form handed to the renderer
// ---------------------------------------------------------------------------

/// When the box is stretched to an arbitrary width and height, the SVG's own `preserveAspectRatio` takes priority over
/// `object-fit`, and the image would leave black bars inside the stretched box. So the stretch mode has to change the asset itself: write `preserveAspectRatio="none"` on the root
/// `<svg>` (replacing it if present). Only the attribute area of the root tag is touched; a nested `<image preserveAspectRatio>` inside is left alone.
pub fn stretch(svg: &str) -> String {
    let Some((start, end)) = root_svg_tag(svg) else {
        return svg.to_owned();
    };
    let tag = &svg[start..end];
    let self_close = tag.ends_with("/>");
    let attrs = &tag[4..tag.len() - if self_close { 2 } else { 1 }];
    let attrs = strip_preserve_aspect(attrs);
    let mut out = String::with_capacity(svg.len() + 32);
    out.push_str(&svg[..start]);
    out.push_str("<svg");
    out.push_str(attrs.trim_end());
    out.push_str(" preserveAspectRatio=\"none\"");
    out.push_str(if self_close { "/>" } else { ">" });
    out.push_str(&svg[end..]);
    out
}

/// The span matched by `/<svg\b[^>]*>/i` (a half-open byte range).
fn root_svg_tag(svg: &str) -> Option<(usize, usize)> {
    let bytes = svg.as_bytes();
    let mut at = 0usize;
    while at + 4 <= bytes.len() {
        let Some(lt) = bytes[at..].iter().position(|b| *b == b'<').map(|i| i + at) else {
            return None;
        };
        if lt + 4 <= bytes.len() && svg[lt..lt + 4].eq_ignore_ascii_case("<svg") {
            let after = bytes.get(lt + 4).copied();
            // `\b`: `<svg` must be followed by a non-word character (`<svgfoo` does not count).
            if after.is_none_or(|byte| !byte.is_ascii_alphanumeric() && byte != b'_') {
                let gt = bytes[lt..]
                    .iter()
                    .position(|b| *b == b'>')
                    .map(|i| i + lt)?;
                return Some((lt, gt + 1));
            }
        }
        at = lt + 1;
    }
    None
}

/// `/\s*preserveAspectRatio\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi → ''`
fn strip_preserve_aspect(attrs: &str) -> String {
    const NAME: &str = "preserveAspectRatio";
    let bytes = attrs.as_bytes();
    let mut out = String::with_capacity(attrs.len());
    let mut at = 0usize;
    let mut kept = 0usize;
    while at < bytes.len() {
        let name_at = at
            + match attrs[at..]
                .to_ascii_lowercase()
                .find(&NAME.to_ascii_lowercase())
            {
                Some(index) => index,
                None => break,
            };
        // Leading whitespace before the name is also consumed (the regex's `\s*`).
        let mut lead = name_at;
        while lead > kept && bytes[lead - 1].is_ascii_whitespace() {
            lead -= 1;
        }
        let mut cursor = name_at + NAME.len();
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor >= bytes.len() || bytes[cursor] != b'=' {
            out.push_str(&attrs[kept..name_at + NAME.len()]);
            kept = name_at + NAME.len();
            at = kept;
            continue;
        }
        cursor += 1;
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        let value_end = match bytes.get(cursor) {
            Some(quote @ (b'"' | b'\'')) => bytes[cursor + 1..]
                .iter()
                .position(|b| b == quote)
                .map_or(bytes.len(), |i| cursor + 1 + i + 1),
            _ => {
                let mut end = cursor;
                while end < bytes.len() && !bytes[end].is_ascii_whitespace() && bytes[end] != b'>' {
                    end += 1;
                }
                end
            }
        };
        out.push_str(&attrs[kept..lead]);
        kept = value_end;
        at = value_end;
    }
    out.push_str(&attrs[kept..]);
    out
}

/// The form in which a recoloured asset is handed to the renderer (base64 data URI).
pub fn data_uri(svg: &str) -> String {
    format!("data:image/svg+xml;base64,{}", base64(svg.as_bytes()))
}

/// Standard base64 (no line breaks). This layer adds no dependency; the encoding itself is ten lines.
fn base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = u32::from(chunk[0]);
        let b1 = chunk.get(1).copied().map_or(0, u32::from);
        let b2 = chunk.get(2).copied().map_or(0, u32::from);
        let word = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[(word >> 18) as usize & 63] as char);
        out.push(TABLE[(word >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            TABLE[(word >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[word as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

/// A built-in vector sticker (the `layers` in core `sticker/*.json`) is translated directly into one SVG text. Its swatches and recolouring are then the same pieces as above, so there is no need to write a second grouping logic for the "path array".
pub fn builtin_svg(layers: &[BuiltinLayer<'_>]) -> String {
    let mut body = String::new();
    for layer in layers {
        body.push_str(&format!(
            "<path d=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
            layer.d,
            layer.fill.unwrap_or("none"),
            layer.stroke.unwrap_or("none"),
            layer.width,
        ));
    }
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\" width=\"100%\" style=\"display:block\" aria-hidden=\"true\">{body}</svg>"
    )
}

/// The built-in vector sticker draws the `layers` themselves (no text substitution, because the box-height case relies on
/// `preserveAspectRatio`). So this gives "which fill colour layer i should use right now": the layer's original colour
/// is found at some position in the swatch table, and the swatch at that position is taken. The grouping criterion is still the one above.
pub fn layer_fill(
    layers: &[BuiltinLayer<'_>],
    fill_list: &[Option<String>],
    index: usize,
) -> String {
    let own = layers.get(index).and_then(|layer| layer.fill);
    let own_hex = norm_fill_hex(own.unwrap_or(""));
    let at = fills_of(&builtin_svg(layers))
        .into_iter()
        .position(|card| card.hex == own_hex);
    at.and_then(|at| fill_list.get(at).cloned().flatten())
        .filter(|hex| !hex.is_empty())
        .or_else(|| own.map(str::to_owned))
        .unwrap_or_else(|| "none".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds one SVG out of `n` distinct colours.
    fn rainbow(n: usize) -> String {
        let mut body = String::new();
        for i in 0..n {
            body.push_str(&format!("<path fill=\"#{:02X}0000\" d=\"M0 0\"/>", i + 1));
        }
        format!("<svg>{body}</svg>")
    }

    /// More than 15 colours means no swatches at all. This is not
    /// "truncate to 15"; for that kind of asset (traced photos, gradient meshes), recolouring colour by colour is meaningless in the first place.
    #[test]
    fn too_many_colours_yield_no_swatches_at_all() {
        assert_eq!(groups_of(&rainbow(MAX_COLORS)).len(), MAX_COLORS);
        assert_eq!(fills_of(&rainbow(MAX_COLORS)).len(), MAX_SWATCHES);
        assert!(fills_of(&rainbow(MAX_COLORS + 1)).is_empty());
        assert!(default_fills(&rainbow(MAX_COLORS + 1)).is_empty());
    }

    /// Even within 15 colours, only the first 5 swatches are shown. There are 5 cards, but the groups are still complete (recolouring works by group).
    #[test]
    fn swatches_are_capped_but_groups_are_not() {
        let svg = rainbow(9);
        assert_eq!(fills_of(&svg).len(), MAX_SWATCHES);
        assert_eq!(groups_of(&svg).len(), 9);
    }

    /// A node may carry its colour in two places (`fill` and `style`). Recolouring must change both together, otherwise
    /// the `style` one would, by CSS precedence, override the new colour back.
    #[test]
    fn one_node_can_carry_the_colour_in_two_places() {
        let svg = "<svg><path fill=\"#fff\" style=\"fill: #FFFFFF\" d=\"M0 0\"/></svg>";
        let groups = groups_of(svg);
        assert_eq!(groups.len(), 1, "两处是同一组");
        assert_eq!(groups[0].hex, "#FFFFFF");
        assert_eq!(groups[0].count, 1, "算的是节点数不是承载数");
        assert_eq!(groups[0].spans.len(), 2);
        let out = apply_fills(svg, &[Some("#FF0000".to_owned())]);
        assert_eq!(out.matches("#FF0000").count(), 2, "两处都得换");
        assert!(!out.contains("#FFFFFF") && !out.contains("#fff\""));
    }

    /// `fill-rule` and `fill-opacity` are not fill colours. The regex side anchors on `(^|;)`, while here it relies on the closed set of candidate start positions; the criteria must match.
    #[test]
    fn fill_rule_and_fill_opacity_are_not_fills() {
        let svg = "<svg><path style=\"fill-rule:evenodd;fill-opacity:.5\" d=\"M0 0\"/></svg>";
        assert!(groups_of(svg).is_empty());
        let svg = "<svg><path style=\"fill-rule:evenodd;fill:#0a0\" d=\"M0 0\"/></svg>";
        assert_eq!(groups_of(svg)[0].hex, "#00AA00");
    }

    /// A gradient's `stop-color` is also a carrier. If it is not collected, the swatches of a gradient sticker would be entirely empty.
    #[test]
    fn gradient_stops_are_carriers_too() {
        let svg = "<svg><stop stop-color=\"#123456\"/><stop stop-color=\"#123456\"/></svg>";
        let groups = groups_of(svg);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].tag, "stop");
        assert_eq!(groups[0].count, 2);
    }

    /// Bitmap stickers (containing `<image>`) get no swatches at all: what can be changed is vector fills, and bitmaps cannot be recoloured.
    #[test]
    fn a_bitmap_sticker_offers_nothing() {
        let svg = "<svg><path fill=\"#fff\" d=\"M0 0\"/><image href=\"a.png\"/></svg>";
        assert!(groups_of(svg).is_empty());
        assert!(fills_of(svg).is_empty());
    }

    /// Built-in vector stickers go through the direct `layers` translation; swatches and grouping reuse the same criterion. `layer_fill`
    /// picks the colour by "which position the original colour occupies", and if the sticker has not been changed, it falls back to the layer's own original colour.
    #[test]
    fn builtin_layers_reuse_the_same_grouping() {
        let layers = [
            BuiltinLayer {
                d: "M0 0",
                fill: Some("#FFCC00"),
                stroke: None,
                width: 0.0,
            },
            BuiltinLayer {
                d: "M1 1",
                fill: Some("#000000"),
                stroke: Some("#000000"),
                width: 0.04,
            },
            BuiltinLayer {
                d: "M2 2",
                fill: Some("#ffcc00"),
                stroke: None,
                width: 0.0,
            },
        ];
        let svg = builtin_svg(&layers);
        let cards = fills_of(&svg);
        assert_eq!(
            cards.iter().map(|c| c.hex.as_str()).collect::<Vec<_>>(),
            ["#FFCC00", "#000000"],
            "大小写不同的同一个色只算一组"
        );
        assert_eq!(cards[0].count, 2);

        // Not changed: each layer keeps its original colour.
        let none: [Option<String>; 0] = [];
        assert_eq!(layer_fill(&layers, &none, 0), "#FFCC00");
        assert_eq!(layer_fill(&layers, &none, 1), "#000000");
        // Changing swatch 0: layer 2 of the same group changes along with it; the other group stays put.
        let list = [Some("#FF0000".to_owned())];
        assert_eq!(layer_fill(&layers, &list, 0), "#FF0000");
        assert_eq!(layer_fill(&layers, &list, 2), "#FF0000");
        assert_eq!(layer_fill(&layers, &list, 1), "#000000");
        // An out-of-range layer does not panic; it gets `none`.
        assert_eq!(layer_fill(&layers, &list, 9), "none");
    }

    /// An empty string means "this slot is not set", not "set to an empty colour". Otherwise one hole in `fill_list` would make the layer render transparent.
    #[test]
    fn an_empty_slot_means_unset_not_transparent() {
        let layers = [BuiltinLayer {
            d: "M0 0",
            fill: Some("#FFCC00"),
            stroke: None,
            width: 0.0,
        }];
        assert_eq!(layer_fill(&layers, &[Some(String::new())], 0), "#FFCC00");
        assert_eq!(layer_fill(&layers, &[None], 0), "#FFCC00");
    }

    /// The override table is keyed by **source colour**, not by index. This is the storage decision for D1: even if the swatch order changes, old documents are still recognised.
    /// Anything equal to the default colour gets no key, otherwise `is_default` could never tell "not changed".
    #[test]
    fn overrides_are_keyed_by_the_source_colour() {
        let svg = "<svg><path fill=\"#fff\" d=\"M0 0\"/><path fill=\"#000\" d=\"M1 1\"/></svg>";
        let cards = fills_of(svg);
        let list = [Some("#FFFFFF".to_owned()), Some("#ff0000".to_owned())];
        let overrides = fills_to_overrides(&cards, &list);
        assert_eq!(overrides.len(), 1, "与默认色相等的那一组不落键");
        assert_eq!(
            overrides.get("#000000").map(String::as_str),
            Some("#FF0000")
        );

        // The return trip is always the same length as the swatches: unoverridden entries read back their default colour, so the panel does not have to work out for itself whether it was changed.
        let back = fill_list_from_overrides(&cards, &overrides);
        assert_eq!(
            back,
            vec![Some("#FFFFFF".to_owned()), Some("#FF0000".to_owned())]
        );
        assert!(is_default(svg, &[]), "空表 = 没改过");
        assert!(!is_default(svg, &back));
    }

    /// The render-chain entry point and the panel entry point produce the same image: `fillOverrides` matches groups by source hex,
    /// and groups that are not matched are left untouched.
    #[test]
    fn apply_overrides_matches_the_card_ordered_edit() {
        use std::collections::BTreeMap;

        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg"><path fill="#FF7944" d="M0 0"/><path fill="#ffdfd5" d="M1 1"/></svg>"##;
        let mut overrides = BTreeMap::new();
        overrides.insert("#ff7944".to_owned(), "#00C853".to_owned());

        let by_overrides = super::apply_overrides(svg, &overrides);
        assert!(
            by_overrides.contains(r##"fill="#00C853""##),
            "{by_overrides}"
        );
        assert!(
            by_overrides.contains(r##"fill="#ffdfd5""##),
            "未被覆盖的组不能动"
        );

        // The panel side, given the same edit (swatch 1 recoloured, swatch 2 left at default), must produce the same
        // image. The bytes need not be identical: the panel path also rewrites unchanged groups to the normalised default
        // colour, whereas here not a single character is touched. It is enough that the group order and final colours agree.
        let cards = super::fills_of(svg);
        let by_cards =
            super::apply_fills(svg, &super::fill_list_from_overrides(&cards, &overrides));
        assert_eq!(
            super::default_fills(&by_overrides),
            super::default_fills(&by_cards)
        );

        assert_eq!(super::apply_overrides(svg, &BTreeMap::new()), svg);
    }
}
