//! Analysis and per-frame kernel for hand-drawn whiteboard elements (`docs/design/video/ccut-whiteboard-animation-design.md` §4).
//!
//! A static image → a time field of "what gets drawn first, what later" → the reveal frame at any `t`. Two things are kept separate:
//!
//! * [`analyze`] — **one-off** analysis: pixel classification (paper / ink line / colour block) → dilation → connected components (with `strict`, further split per pixel by `box`) → ordering (`beats` grouping → reading band → centroid x) → one window `[at, end]` per group (with `natural`, the group is drawn at natural speed and then holds at `end`) → within a group, time is allocated by √area → in-region geodesic BFS time field. The resulting [`WhiteboardAnalysis`] is memoised by the host keyed on `(source id, props)` (narration sync design §6).
//! * [`whiteboard_frame`] — **per frame**: pixels with `field ≤ t` take the source image, the rest are transparent (or paper colour), and when `t < 1` a vector pen is drawn at the pen-tip position. Each frame is just one mask comparison plus one blit.
//!
//! Same discipline as the rest of this directory: **stateless, no random numbers, no dependence on the previous frame** — the same `t` gives byte-identical output in the App preview, export, and `ccut render --t`; out-of-order sampling == sorted sampling.
//!
//! This module depends only on tiny-skia, and belongs to the `wasm-safe` minimal set. The conversion from `WhiteboardProps` (`ccut-timeline`) → [`WhiteboardParams`] (seconds → normalised) lives in `ccut-timeline-render`; this crate does not know the Timeline types.

use std::collections::VecDeque;

use tiny_skia::{Color, LineCap, Paint, PathBuilder, Pixmap, Stroke, Transform};

/// Upper bound on the working resolution used for analysis (pixels on the long side). Larger source images are first aggregated to this scale with nearest-neighbour sampling before analysis, and the time field is mapped back to natural resolution by an integer ratio. 960 is the scale verified by the prototype: BFS on a 4K source also takes on the order of a hundred milliseconds.
pub const WORK_LONG_EDGE: u32 = 960;
/// How wide a band of paper pixels around a stroke counts as its halo (natural pixels): the anti-aliasing / compression ringing of exported PNGs is about 5 px.
pub const HALO_RADIUS_PX: u32 = 6;

/// Ink-line dilation radius (working-resolution pixels): joins broken strokes and jagged edges into one stroke.
const DILATE_RADIUS: i32 = 3;

/// Connected components smaller than this area (working-resolution pixels) are merged into the nearest component, so specks do not become strokes of their own.
const MIN_COMPONENT_AREA: usize = 12;

/// With `inkFirst`, the fraction of the time window given to ink lines; colour blocks take the remainder.
pub const INK_SHARE: f64 = 0.7;

/// Number of reading bands: first by which `H / READING_BANDS` band `ymin` falls in, then by x.
const READING_BANDS: usize = 8;

/// Number of quantisation levels of the time field. `0` always means "visible from the start" (paper pixels); `1..=FIELD_MAX` are the reveal times of ink lines / colour blocks; `t` is normalised, multiplied by this, and compared after rounding.
const FIELD_MAX: u32 = 65_534;

/// Pen-tip window: the centroid of the pixels with `field ∈ (t − HAND_WINDOW, t]` is the hand's position.
const HAND_WINDOW: f64 = 0.02;

/// Pen style (the `hand` attribute).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WhiteboardHand {
    /// Thick-tip marker (default).
    #[default]
    Marker,
    /// Thin-barrel fountain pen.
    Pen,
    /// No pen drawn.
    None,
}

/// Semantic ordering hint (`beats[]`). `at` / `end` are already normalised to `[0, 1]` (relative to `draw`); when `end` is absent it equals the next beat's `at` (the last beat = 1); `rect` is a rectangle in percent of the frame `[x, y, w, h]`.
#[derive(Debug, Clone, PartialEq)]
pub struct WhiteboardBeat {
    pub at: f64,
    pub end: Option<f64>,
    pub rect: [f64; 4],
}

impl WhiteboardBeat {
    /// A beat with only a start point (the 0.8 shape).
    pub fn at(at: f64, rect: [f64; 4]) -> Self {
        Self {
            at,
            end: None,
            rect,
        }
    }
}

/// Per-beat pacing (`pace`, narration sync design §5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WhiteboardPace {
    /// Fill the group window: this beat's strokes stretch across the whole `[at, end]` (the 0.8 behaviour).
    #[default]
    Stretch,
    /// Draw at natural speed (`path / 900 px/s + 0.25 s/region`, not clamped), then hold at `end`; if the natural duration exceeds the group window, compress to the group window and record `compressed`.
    Natural,
}

impl WhiteboardPace {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Stretch => "stretch",
            Self::Natural => "natural",
        }
    }
}

/// Analysis parameters. Style (pen, paper colour) is not here: it does not affect the time field, only the frames.
#[derive(Debug, Clone, PartialEq)]
pub struct WhiteboardParams {
    /// Ink lines before colour blocks (default `true`); when `false`, the two kinds are interleaved and sorted by position only.
    pub ink_first: bool,
    /// Semantic ordering hints; empty = pure geometric order.
    pub beats: Vec<WhiteboardBeat>,
    /// Each beat either fills its group window or holds after finishing.
    pub pace: WhiteboardPace,
    /// `box` is a hard mask: each pixel is tagged with an owner by rectangle (later beats overwrite earlier ones); connected components that span boxes are split by pixel; dilation does not cross owners; foreground outside every box is scheduled after the last beat (`[end_last, 1]`).
    pub strict: bool,
    /// Effective drawing time (seconds): used by `natural` to convert natural seconds to the normalised timeline; `0` = unknown (treated as stretch).
    pub draw_seconds: f64,
}

impl WhiteboardParams {
    /// A copy of the geometric baseline: `beats` removed, reset to `stretch`. When `draw` is absent, this is first used to get the natural duration and `boxes`, then a second analysis normalises `beats` against the final `draw`.
    pub fn beats_cleared(mut self) -> Self {
        self.beats.clear();
        self.pace = WhiteboardPace::Stretch;
        self.strict = false;
        self.draw_seconds = 0.0;
        self
    }

    /// Only affects analysis beyond the geometric baseline: when there are beats, or `natural`.
    pub fn needs_second_pass(&self) -> bool {
        !self.beats.is_empty() || self.pace == WhiteboardPace::Natural
    }
}

impl Default for WhiteboardParams {
    fn default() -> Self {
        Self {
            ink_first: true,
            beats: Vec::new(),
            pace: WhiteboardPace::Stretch,
            strict: false,
            draw_seconds: 0.0,
        }
    }
}

/// The time budget of one beat (group), normalised to `draw`.
#[derive(Debug, Clone, PartialEq)]
pub struct WhiteboardGroup {
    /// Group window `[at, end]`.
    pub window: [f64; 2],
    /// The moment this beat's ink lines finish: with `stretch` = `end`; with `natural` = `at + natural duration` (not exceeding `end`).
    pub draw_end: f64,
    /// Natural duration of this beat's members in seconds (not clamped).
    pub natural_seconds: f64,
    /// Under `natural`, when the natural duration exceeds the group window, it is compressed to the group window (`whiteboard-window-too-short`).
    pub compressed: bool,
    /// No connected component falls into this beat (`whiteboard-empty-box`).
    pub empty: bool,
}

/// The bounding box of one connected component (reading order; the `boxes[]` of `ccut whiteboard probe`).
#[derive(Debug, Clone, PartialEq)]
pub struct WhiteboardBox {
    /// Percent of frame `[x, y, w, h]`.
    pub rect: [f64; 4],
    /// Number of real foreground pixels (working resolution).
    pub area: usize,
    /// Ink line (`true`) or colour block.
    pub ink: bool,
    /// Natural duration in seconds of drawing this region alone.
    pub natural_seconds: f64,
}

/// Pixel class (shared by working and natural resolution).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
enum Class {
    Paper = 0,
    Ink = 1,
    Color = 2,
}

/// The analysis result for one source image: the quantised time field at natural resolution, plus statistics.
#[derive(Debug, Clone, PartialEq)]
pub struct WhiteboardAnalysis {
    width: u32,
    height: u32,
    /// The reveal time of each natural pixel (`0` = visible from the start; `1..=FIELD_MAX` normalised to `draw`).
    field: Vec<u16>,
    /// Ink-line and colour-block pixel counts and connected-component counts at working resolution (used for probe output and natural-duration estimation).
    pub ink_pixels: usize,
    pub color_pixels: usize,
    pub components: usize,
    /// Working-resolution area (`ink_pixels / work_area` is the ink-line share).
    pub work_area: usize,
    /// Sum of the longest geodesic BFS paths over all connected components (working pixels) — "how far the pen has to travel".
    pub path_length: usize,
    /// Time budget per beat (with no beats, exactly one group `[0, 1]`).
    pub groups: Vec<WhiteboardGroup>,
    /// Number of foreground pixels outside every `box` under `strict` (working resolution); always 0 when not strict.
    pub unassigned_foreground: usize,
    /// Connected-component bounding boxes in reading order (independent of beats).
    pub boxes: Vec<WhiteboardBox>,
    /// In a hold segment (no new stroke landing), the hand rests on the last stroke: `natural` gives `true`; `stretch` keeps the 0.8 frames.
    pub hold_hand: bool,
    /// The representative colour of the source image's own opaque paper surface (premultiplied RGBA, the mean over all opaque paper pixels); `None` for a transparent background. When no `paper` is given, opaque stroke pixels not yet drawn are first filled with this colour, rather than being cut out as transparent holes that let the project background (often a black frame) show through and pass for ink lines.
    pub paper_fill: Option<[u8; 4]>,
}

impl WhiteboardAnalysis {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// Ink-line share (working resolution).
    pub fn ink_ratio(&self) -> f64 {
        if self.work_area == 0 {
            0.0
        } else {
            (self.ink_pixels + self.color_pixels) as f64 / self.work_area as f64
        }
    }

    /// Estimated natural drawing duration in seconds: the pen covers all geodesic paths at about 900 working pixels/s, plus 0.25 s per region for lifting and repositioning; clamped to `[1, 15]` seconds. This is only the source of the default value; the author can override it with `draw` at any time.
    pub fn natural_draw_seconds(&self) -> f64 {
        natural_seconds(self.path_length, self.components).clamp(1.0, 15.0)
    }

    /// Unclamped natural duration in seconds: the sum of `groups[].natural_seconds`.
    pub fn natural_seconds_unclamped(&self) -> f64 {
        natural_seconds(self.path_length, self.components)
    }

    /// Number of revealed pixels at normalised time `t` (for tests and probing).
    pub fn revealed_count(&self, t: f64) -> usize {
        let threshold = quantize(t);
        self.field
            .iter()
            .filter(|&&q| u32::from(q) <= threshold)
            .count()
    }

    /// Reveal time of natural pixel `(x, y)` (normalised; paper pixels are `0`).
    pub fn reveal_at(&self, x: u32, y: u32) -> f64 {
        let q = self.field[(y * self.width + x) as usize];
        f64::from(q) / f64::from(FIELD_MAX)
    }
}

/// Pen-speed model: about 900 working pixels/s, plus 0.25 s per region for lifting and repositioning.
fn natural_seconds(path_length: usize, components: usize) -> f64 {
    path_length as f64 / 900.0 + components as f64 * 0.25
}

fn quantize(t: f64) -> u32 {
    if t >= 1.0 {
        FIELD_MAX
    } else if t <= 0.0 {
        0
    } else {
        (t * f64::from(FIELD_MAX)).floor() as u32
    }
}

/// Premultiplied RGBA → class.
fn classify(px: &[u8]) -> Class {
    let a = px[3];
    if a < 8 {
        return Class::Paper;
    }
    // Un-premultiply before taking brightness / saturation, so semi-transparent edges that look darker from premultiplication are not misclassified as ink lines.
    let un = |c: u8| -> u32 { (u32::from(c) * 255 + u32::from(a) / 2) / u32::from(a) };
    let (r, g, b) = (un(px[0]).min(255), un(px[1]).min(255), un(px[2]).min(255));
    let lum = (r * 299 + g * 587 + b * 114) / 1000;
    let sat = r.max(g).max(b) - r.min(g).min(b);
    if lum > 235 && sat < 40 {
        Class::Paper
    } else if sat > 60 && lum < 235 {
        Class::Color
    } else {
        Class::Ink
    }
}

/// One connected component (working resolution).
struct Component {
    class: Class,
    /// Working-coordinate indices of the real (undilated) pixels in the region.
    pixels: Vec<u32>,
    /// Indices of all pixels in the dilated mask that belong to this region (the walkable surface for the geodesic BFS).
    footprint: Vec<u32>,
    xmin: u32,
    xmax: u32,
    ymin: u32,
    ymax: u32,
    cx: f64,
    cy: f64,
    /// The owning beat under `strict`; `None` = not inside any box (not used when not strict).
    owner: Option<usize>,
}

impl Component {
    fn new(
        class: Class,
        pixels: Vec<u32>,
        footprint: Vec<u32>,
        w: u32,
        owner: Option<usize>,
    ) -> Self {
        let (mut xmin, mut xmax, mut ymin, mut ymax) = (u32::MAX, 0, u32::MAX, 0);
        let (mut sx, mut sy) = (0f64, 0f64);
        for &p in &pixels {
            let (x, y) = (p % w, p / w);
            xmin = xmin.min(x);
            xmax = xmax.max(x);
            ymin = ymin.min(y);
            ymax = ymax.max(y);
            sx += f64::from(x);
            sy += f64::from(y);
        }
        let n = pixels.len().max(1) as f64;
        Self {
            class,
            pixels,
            footprint,
            xmin,
            xmax,
            ymin,
            ymax,
            cx: sx / n,
            cy: sy / n,
            owner,
        }
    }
}

fn rect_contains(rect: [f64; 4], px: f64, py: f64) -> bool {
    px >= rect[0] && px <= rect[0] + rect[2] && py >= rect[1] && py <= rect[1] + rect[3]
}

/// Analyses one source image. `src` is premultiplied RGBA.
///
/// The result depends only on the pixels and `params`; it contains no randomness.
pub fn analyze(src: &Pixmap, params: &WhiteboardParams) -> WhiteboardAnalysis {
    let width = src.width();
    let height = src.height();
    let long = width.max(height).max(1);
    let scale = if long > WORK_LONG_EDGE {
        u32::div_ceil(long, WORK_LONG_EDGE)
    } else {
        1
    };
    let ww = u32::div_ceil(width, scale).max(1);
    let wh = u32::div_ceil(height, scale).max(1);
    let work_area = (ww * wh) as usize;

    // 1. Classify (natural resolution) and aggregate into working cells: a cell is ink if it contains any ink line, otherwise a colour block if it contains one —
    //    this guarantees every natural ink-line pixel falls in a cell with a finite time.
    let mut natural_class = vec![Class::Paper; (width * height) as usize];
    let mut work_class = vec![Class::Paper; work_area];
    let (mut paper_sum, mut paper_count) = ([0u64; 3], 0u64);
    for y in 0..height {
        let wy = y / scale;
        for x in 0..width {
            let i = (y * width + x) as usize;
            let px = &src.data()[i * 4..i * 4 + 4];
            let c = classify(px);
            natural_class[i] = c;
            if c == Class::Paper && px[3] == 255 {
                for (sum, &v) in paper_sum.iter_mut().zip(&px[..3]) {
                    *sum += u64::from(v);
                }
                paper_count += 1;
            }
            if c != Class::Paper {
                let wi = (wy * ww + x / scale) as usize;
                let cur = work_class[wi];
                if c == Class::Ink || cur == Class::Paper {
                    work_class[wi] = c;
                }
            }
        }
    }
    let ink_pixels = work_class.iter().filter(|&&c| c == Class::Ink).count();
    let color_pixels = work_class.iter().filter(|&&c| c == Class::Color).count();
    let paper_fill = (paper_count > 0).then(|| {
        let avg = |sum: u64| ((sum + paper_count / 2) / paper_count).min(255) as u8;
        [avg(paper_sum[0]), avg(paper_sum[1]), avg(paper_sum[2]), 255]
    });

    // 2–3. Dilation + connected components; ink lines and colour blocks form their own regions.
    let mut components = Vec::new();
    for class in [Class::Ink, Class::Color] {
        let mask: Vec<bool> = work_class.iter().map(|&c| c == class).collect();
        if !mask.iter().any(|&m| m) {
            continue;
        }
        let dilated = dilate(&mask, ww, wh, DILATE_RADIUS);
        label_components(&dilated, &mask, ww, wh, class, &mut components);
    }
    merge_small_components(&mut components);

    // 3b. strict: tag each pixel with its owner by box (later beats overwrite), split regions that span boxes by pixel; the dilated surface is also split by owner, so geodesic walks never cross boxes.
    let beat_count = params.beats.len();
    let strict = params.strict && beat_count > 0;
    let mut unassigned_foreground = 0usize;
    if strict {
        let owner_of = |p: u32| -> Option<usize> {
            let px = (f64::from(p % ww) + 0.5) / ww as f64 * 100.0;
            let py = (f64::from(p / ww) + 0.5) / wh as f64 * 100.0;
            params
                .beats
                .iter()
                .rposition(|b| rect_contains(b.rect, px, py))
        };
        components = split_by_owner(components, ww, &owner_of);
        unassigned_foreground = components
            .iter()
            .filter(|c| c.owner.is_none())
            .map(|c| c.pixels.len())
            .sum();
    }

    // 4. Ordering: beat grouping → reading band → centroid x.
    let band = (wh as f64 / READING_BANDS as f64).max(1.0);
    let reading_key = |c: &Component| ((c.ymin as f64 / band) as usize, c.cx);
    let group_of = |c: &Component| -> usize {
        if beat_count == 0 {
            return 0;
        }
        if strict {
            return c.owner.unwrap_or(beat_count);
        }
        let px = c.cx / ww as f64 * 100.0;
        let py = c.cy / wh as f64 * 100.0;
        // Take the first beat whose rectangle contains the centroid; if none contains it, take the beat whose rectangle is nearest to the centroid.
        if let Some(i) = params
            .beats
            .iter()
            .position(|b| rect_contains(b.rect, px, py))
        {
            return i;
        }
        let mut best = 0;
        let mut best_d = f64::INFINITY;
        for (i, b) in params.beats.iter().enumerate() {
            let dx = (b.rect[0] - px).max(px - (b.rect[0] + b.rect[2])).max(0.0);
            let dy = (b.rect[1] - py).max(py - (b.rect[1] + b.rect[3])).max(0.0);
            let d = dx * dx + dy * dy;
            if d < best_d {
                best_d = d;
                best = i;
            }
        }
        best
    };
    let mut order: Vec<(usize, usize)> = components
        .iter()
        .enumerate()
        .map(|(i, c)| (group_of(c), i))
        .collect();
    order.sort_by(|(ga, ia), (gb, ib)| {
        let (band_a, cx_a) = reading_key(&components[*ia]);
        let (band_b, cx_b) = reading_key(&components[*ib]);
        (*ga, band_a)
            .cmp(&(*gb, band_b))
            .then(cx_a.partial_cmp(&cx_b).unwrap_or(std::cmp::Ordering::Equal))
            .then(ia.cmp(ib))
    });

    // Compute the in-region geodesic distances first: `natural` needs each group's natural duration before the windows are allocated.
    let distances: Vec<(Vec<u32>, u32)> = components
        .iter()
        .map(|c| geodesic_distances(c, ww, wh))
        .collect();

    // Reading-order bounding boxes (independent of beats): the source for probe's `boxes[]` and for the sync fallback.
    let mut reading: Vec<usize> = (0..components.len()).collect();
    reading.sort_by(|&a, &b| {
        let (band_a, cx_a) = reading_key(&components[a]);
        let (band_b, cx_b) = reading_key(&components[b]);
        band_a
            .cmp(&band_b)
            .then(cx_a.partial_cmp(&cx_b).unwrap_or(std::cmp::Ordering::Equal))
            .then(a.cmp(&b))
    });
    let boxes: Vec<WhiteboardBox> = reading
        .iter()
        .map(|&i| {
            let c = &components[i];
            WhiteboardBox {
                rect: [
                    f64::from(c.xmin) / ww as f64 * 100.0,
                    f64::from(c.ymin) / wh as f64 * 100.0,
                    f64::from(c.xmax + 1 - c.xmin) / ww as f64 * 100.0,
                    f64::from(c.ymax + 1 - c.ymin) / wh as f64 * 100.0,
                ],
                area: c.pixels.len(),
                ink: c.class == Class::Ink,
                natural_seconds: natural_seconds(distances[i].1 as usize, 1),
            }
        })
        .collect();

    // 5. Time windows: each beat group gets one `[at_g, end_g]` (when `end` is absent = next beat's at, last beat = 1);
    //    under `strict` one extra group "after the last beat" `[end_last, 1]` collects unowned foreground. With `natural`, the group uses only `[at_g, at_g + natural duration]` and holds for the rest. Within a group, inkFirst further splits into ink lines `[0, 0.7]` and colour blocks `[0.7, 1]`, and each kind is allocated by √area.
    let group_count = if beat_count == 0 {
        1
    } else if strict {
        beat_count + 1
    } else {
        beat_count
    };
    let group_window = |g: usize| -> (f64, f64) {
        if beat_count == 0 {
            return (0.0, 1.0);
        }
        if g >= beat_count {
            let last = &params.beats[beat_count - 1];
            let start = last.end.unwrap_or(1.0).clamp(0.0, 1.0);
            return (start, 1.0);
        }
        let start = params.beats[g].at.clamp(0.0, 1.0);
        let end = params.beats[g]
            .end
            .or_else(|| params.beats.get(g + 1).map(|b| b.at))
            .unwrap_or(1.0)
            .clamp(0.0, 1.0)
            .max(start);
        (start, end)
    };
    let natural_pace = params.pace == WhiteboardPace::Natural && params.draw_seconds > 0.0;
    let mut field_work = vec![u16::MAX; work_area];
    let mut path_length = 0usize;
    let mut groups = Vec::with_capacity(beat_count.max(1));
    for g in 0..group_count {
        let (g0, g1) = group_window(g);
        let members: Vec<usize> = order
            .iter()
            .filter(|(gg, _)| *gg == g)
            .map(|(_, i)| *i)
            .collect();
        let group_natural: f64 = members
            .iter()
            .map(|&i| natural_seconds(distances[i].1 as usize, 1))
            .sum();
        let (draw_end, compressed) = if natural_pace && !members.is_empty() {
            let window_secs = (g1 - g0) * params.draw_seconds;
            if group_natural >= window_secs {
                (g1, group_natural > window_secs + 1e-9)
            } else {
                (g0 + group_natural / params.draw_seconds, false)
            }
        } else {
            (g1, false)
        };
        if g < beat_count.max(1) {
            groups.push(WhiteboardGroup {
                window: [g0, g1],
                draw_end,
                natural_seconds: group_natural,
                compressed,
                empty: members.is_empty(),
            });
        }
        if members.is_empty() {
            continue;
        }
        let has_ink = members.iter().any(|&i| components[i].class == Class::Ink);
        let has_color = members.iter().any(|&i| components[i].class == Class::Color);
        let (p_start, p_end) = (g0, draw_end);
        let phases: Vec<(Option<Class>, f64, f64)> = if params.ink_first && has_ink && has_color {
            let split = p_start + (p_end - p_start) * INK_SHARE;
            vec![
                (Some(Class::Ink), p_start, split),
                (Some(Class::Color), split, p_end),
            ]
        } else {
            vec![(None, p_start, p_end)]
        };
        for (class, p0, p1) in phases {
            let seq: Vec<usize> = members
                .iter()
                .copied()
                .filter(|&i| class.is_none_or(|c| components[i].class == c))
                .collect();
            let weights: Vec<f64> = seq
                .iter()
                .map(|&i| (components[i].pixels.len() as f64).sqrt())
                .collect();
            let total: f64 = weights.iter().sum::<f64>().max(f64::EPSILON);
            let mut t = p0;
            for (&i, &w) in seq.iter().zip(&weights) {
                let dur = (p1 - p0) * w / total;
                let (dist, maxd) = &distances[i];
                write_field(&components[i], dist, *maxd, t, dur, &mut field_work);
                path_length += *maxd as usize;
                t += dur;
            }
        }
    }

    // 6. Map back to natural resolution: foreground pixels take the time of the working cell they are in (at least 1, so that no stroke is visible at t = 0). Paper pixels come in two kinds: those far from foreground are always 0 (true paper, always shown from the source image, so the paper texture does not suddenly appear at the end); those next to foreground follow the earliest-revealed foreground nearby. In PNGs from export tools, stroke edges have a halo a few pixels wide of light grey whose brightness just passes the paper threshold (anti-aliasing / compression ringing); keeping it at 0 would make the whole image appear as faint outlines before any stroke is drawn. "Next to" is computed as Chebyshev radius `HALO_RADIUS_PX` on working cells: first put the foreground cells' times into a grid (paper cells = MAX), then do two 1-D minimum scans. Only opaque paper pixels are handled: semi-transparent edges of a transparent background are already sorted into ink lines / colour blocks by un-premultiplied colour, and fully transparent pixels are invisible whether drawn or not.
    let src_data = src.data();
    let halo_cells = HALO_RADIUS_PX.div_ceil(scale) as usize;
    let mut halo_work: Vec<u16> = (0..work_area)
        .map(|wi| {
            if work_class[wi] == Class::Paper {
                u16::MAX
            } else {
                field_work[wi].min(u16::MAX - 1).max(1)
            }
        })
        .collect();
    let mut pass = halo_work.clone();
    for wy in 0..wh as usize {
        let row = wy * ww as usize;
        for wx in 0..ww as usize {
            let lo = wx.saturating_sub(halo_cells);
            let hi = (wx + halo_cells).min(ww as usize - 1);
            pass[row + wx] = halo_work[row + lo..=row + hi]
                .iter()
                .copied()
                .min()
                .unwrap();
        }
    }
    for wx in 0..ww as usize {
        for wy in 0..wh as usize {
            let lo = wy.saturating_sub(halo_cells);
            let hi = (wy + halo_cells).min(wh as usize - 1);
            halo_work[wy * ww as usize + wx] =
                (lo..=hi).map(|y| pass[y * ww as usize + wx]).min().unwrap();
        }
    }
    let mut field = vec![0u16; (width * height) as usize];
    for y in 0..height {
        let wy = y / scale;
        for x in 0..width {
            let i = (y * width + x) as usize;
            let wi = (wy * ww + x / scale) as usize;
            let q = if natural_class[i] != Class::Paper {
                field_work[wi]
            } else if src_data[i * 4 + 3] != 255 {
                continue;
            } else {
                let q = halo_work[wi];
                if q == u16::MAX {
                    continue;
                }
                q
            };
            field[i] = if q == u16::MAX { 1 } else { q.max(1) };
        }
    }

    WhiteboardAnalysis {
        width,
        height,
        field,
        ink_pixels,
        color_pixels,
        components: components.len(),
        work_area,
        path_length,
        groups,
        unassigned_foreground,
        boxes,
        hold_hand: params.pace == WhiteboardPace::Natural,
        paper_fill,
    }
}

/// `strict`: splits each region into sub-regions by pixel owner (`None` = not inside any box). The dilated surface is split by the same rule, so sub-regions do not share walkable surface.
fn split_by_owner(
    components: Vec<Component>,
    w: u32,
    owner_of: &dyn Fn(u32) -> Option<usize>,
) -> Vec<Component> {
    use std::collections::BTreeMap;
    let mut out = Vec::new();
    for c in components {
        let mut by_owner: BTreeMap<Option<usize>, (Vec<u32>, Vec<u32>)> = BTreeMap::new();
        for &p in &c.pixels {
            by_owner.entry(owner_of(p)).or_default().0.push(p);
        }
        for &p in &c.footprint {
            by_owner.entry(owner_of(p)).or_default().1.push(p);
        }
        for (owner, (pixels, footprint)) in by_owner {
            if pixels.is_empty() {
                continue;
            }
            out.push(Component::new(c.class, pixels, footprint, w, owner));
        }
    }
    out
}

fn dilate(mask: &[bool], w: u32, h: u32, radius: i32) -> Vec<bool> {
    let (wi, hi) = (w as i32, h as i32);
    let mut out = mask.to_vec();
    for y in 0..hi {
        for x in 0..wi {
            if !mask[(y * wi + x) as usize] {
                continue;
            }
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    if dx * dx + dy * dy > radius * radius {
                        continue;
                    }
                    let (nx, ny) = (x + dx, y + dy);
                    if nx >= 0 && ny >= 0 && nx < wi && ny < hi {
                        out[(ny * wi + nx) as usize] = true;
                    }
                }
            }
        }
    }
    out
}

const NEIGHBOURS: [(i32, i32); 8] = [
    (-1, 0),
    (1, 0),
    (0, -1),
    (0, 1),
    (-1, -1),
    (-1, 1),
    (1, -1),
    (1, 1),
];

fn label_components(
    dilated: &[bool],
    real: &[bool],
    w: u32,
    h: u32,
    class: Class,
    out: &mut Vec<Component>,
) {
    let (wi, hi) = (w as i32, h as i32);
    let mut seen = vec![false; dilated.len()];
    let mut queue = VecDeque::new();
    for start in 0..dilated.len() {
        if !dilated[start] || seen[start] {
            continue;
        }
        seen[start] = true;
        queue.push_back(start as u32);
        let mut footprint = Vec::new();
        let mut pixels = Vec::new();
        while let Some(idx) = queue.pop_front() {
            footprint.push(idx);
            if real[idx as usize] {
                pixels.push(idx);
            }
            let (x, y) = ((idx % w) as i32, (idx / w) as i32);
            for (dx, dy) in NEIGHBOURS {
                let (nx, ny) = (x + dx, y + dy);
                if nx < 0 || ny < 0 || nx >= wi || ny >= hi {
                    continue;
                }
                let n = (ny * wi + nx) as usize;
                if dilated[n] && !seen[n] {
                    seen[n] = true;
                    queue.push_back(n as u32);
                }
            }
        }
        if pixels.is_empty() {
            continue;
        }
        out.push(Component::new(class, pixels, footprint, w, None));
    }
}

/// Regions with area below [`MIN_COMPONENT_AREA`] are merged into the nearest large region of the **same kind** (by centroid); if there is no large region, they are kept as they are.
fn merge_small_components(components: &mut Vec<Component>) {
    let small: Vec<usize> = (0..components.len())
        .filter(|&i| components[i].pixels.len() < MIN_COMPONENT_AREA)
        .collect();
    if small.is_empty() {
        return;
    }
    let mut removed = vec![false; components.len()];
    for &s in &small {
        let (cx, cy, class) = (components[s].cx, components[s].cy, components[s].class);
        let target = (0..components.len())
            .filter(|&i| {
                i != s
                    && !removed[i]
                    && components[i].class == class
                    && components[i].pixels.len() >= MIN_COMPONENT_AREA
            })
            .min_by(|&a, &b| {
                let da = (components[a].cx - cx).powi(2) + (components[a].cy - cy).powi(2);
                let db = (components[b].cx - cx).powi(2) + (components[b].cy - cy).powi(2);
                da.partial_cmp(&db)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then(a.cmp(&b))
            });
        let Some(t) = target else {
            continue;
        };
        let (pixels, footprint) = {
            let c = &mut components[s];
            (
                std::mem::take(&mut c.pixels),
                std::mem::take(&mut c.footprint),
            )
        };
        let dst = &mut components[t];
        dst.pixels.extend(pixels);
        dst.footprint.extend(footprint);
        removed[s] = true;
    }
    let mut i = 0;
    components.retain(|_| {
        let keep = !removed[i];
        i += 1;
        keep
    });
}

/// In-region geodesic BFS: starts from the top-left-most real pixel and walks along the dilated mask. Returns arrival indices aligned with `pixels` (`u32::MAX` for unreachable pixels) and the longest path (working pixels).
///
/// After small regions are merged in, `footprint` may be disconnected (the footing of a small region can be a few pixels away from the large one); unreachable pixels are drawn at the latest time, so none are missed.
fn geodesic_distances(component: &Component, w: u32, h: u32) -> (Vec<u32>, u32) {
    let (wi, hi) = (w as i32, h as i32);
    let start = component
        .pixels
        .iter()
        .copied()
        .min_by(|&a, &b| {
            let key = |p: u32| {
                let (x, y) = (f64::from(p % w), f64::from(p / w));
                (y + x * 0.3, x)
            };
            key(a)
                .partial_cmp(&key(b))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .expect("component has pixels");
    let area = (w * h) as usize;
    let mut walkable = vec![false; area];
    for &p in &component.footprint {
        walkable[p as usize] = true;
    }
    let mut dist = vec![u32::MAX; area];
    let mut queue = VecDeque::new();
    dist[start as usize] = 0;
    queue.push_back(start);
    let mut maxd = 0u32;
    while let Some(idx) = queue.pop_front() {
        let d = dist[idx as usize];
        let (x, y) = ((idx % w) as i32, (idx / w) as i32);
        for (dx, dy) in NEIGHBOURS {
            let (nx, ny) = (x + dx, y + dy);
            if nx < 0 || ny < 0 || nx >= wi || ny >= hi {
                continue;
            }
            let n = (ny * wi + nx) as usize;
            if walkable[n] && dist[n] == u32::MAX {
                dist[n] = d + 1;
                maxd = maxd.max(d + 1);
                queue.push_back(n as u32);
            }
        }
    }
    (
        component.pixels.iter().map(|&p| dist[p as usize]).collect(),
        maxd,
    )
}

/// Normalises the arrival indices to `[t0, t0 + dur]` and writes them into the time field.
fn write_field(
    component: &Component,
    dist: &[u32],
    maxd: u32,
    t0: f64,
    dur: f64,
    field: &mut [u16],
) {
    let denom = f64::from(maxd.max(1));
    for (&p, &d) in component.pixels.iter().zip(dist) {
        let frac = if d == u32::MAX {
            1.0
        } else {
            f64::from(d) / denom
        };
        let t = t0 + dur * frac;
        let q = quantize(t).clamp(1, FIELD_MAX) as u16;
        let slot = &mut field[p as usize];
        // When two regions touch the same cell, the earlier time wins.
        if *slot == u16::MAX || q < *slot {
            *slot = q;
        }
    }
}

/// One frame: `t` is the normalised progress (`elapsed / draw`); `≥ 1` means finished.
///
/// The output has the same size as the source image, premultiplied RGBA. When `paper` is given, the whole frame is first filled with the paper colour. When `t ≥ 1` and there is no paper colour, the output is byte-identical to the source image.
pub fn whiteboard_frame(
    analysis: &WhiteboardAnalysis,
    src: &Pixmap,
    t: f64,
    hand: WhiteboardHand,
    paper: Option<Color>,
) -> Pixmap {
    debug_assert_eq!(src.width(), analysis.width);
    debug_assert_eq!(src.height(), analysis.height);
    let mut out =
        Pixmap::new(src.width().max(1), src.height().max(1)).expect("whiteboard frame pixmap");
    if let Some(paper) = paper {
        out.fill(paper);
    }
    let threshold = quantize(t);
    let src_data = src.data();
    let out_data = out.data_mut();
    let (mut front_x, mut front_y, mut front_n) = (0f64, 0f64, 0usize);
    // The hand in a hold segment: the centroid of the latest-revealed stroke among the revealed pixels (used only when `hold_hand`).
    let (mut last_q, mut last_x, mut last_y, mut last_n) = (0u32, 0f64, 0f64, 0usize);
    let window = (HAND_WINDOW * f64::from(FIELD_MAX)) as u32;
    let lower = threshold.saturating_sub(window);
    for (i, &q) in analysis.field.iter().enumerate() {
        let q = u32::from(q);
        if q > threshold {
            // Not yet drawn: an explicit paper colour is laid down first; without one, the source image's own opaque paper surface is on top, and only a transparent background actually lets the layer below show through.
            if paper.is_none()
                && let Some(fill) = analysis.paper_fill
                && src_data[i * 4 + 3] == 255
            {
                out_data[i * 4..i * 4 + 4].copy_from_slice(&fill);
            }
            continue;
        }
        if analysis.hold_hand && q > 0 {
            let (x, y) = (
                (i as u32 % analysis.width) as f64,
                (i as u32 / analysis.width) as f64,
            );
            if q > last_q {
                (last_q, last_x, last_y, last_n) = (q, x, y, 1);
            } else if q == last_q {
                last_x += x;
                last_y += y;
                last_n += 1;
            }
        }
        let px = &src_data[i * 4..i * 4 + 4];
        if px[3] == 0 && paper.is_some() {
            continue;
        }
        if paper.is_some() && px[3] < 255 {
            // Semi-transparent source pixels are composited over the paper colour (source-over, premultiplied).
            let a = u32::from(px[3]);
            for c in 0..4 {
                let dst = u32::from(out_data[i * 4 + c]);
                out_data[i * 4 + c] = (u32::from(px[c]) + dst * (255 - a) / 255).min(255) as u8;
            }
        } else {
            out_data[i * 4..i * 4 + 4].copy_from_slice(px);
        }
        if q > lower && q > 0 {
            front_x += (i as u32 % analysis.width) as f64;
            front_y += (i as u32 / analysis.width) as f64;
            front_n += 1;
        }
    }
    if t < 1.0 && hand != WhiteboardHand::None {
        if front_n > 0 {
            let x = front_x / front_n as f64 + 0.5;
            let y = front_y / front_n as f64 + 0.5;
            draw_hand(&mut out, hand, x, y);
        } else if analysis.hold_hand && last_n > 0 {
            let x = last_x / last_n as f64 + 0.5;
            let y = last_y / last_n as f64 + 0.5;
            draw_hand(&mut out, hand, x, y);
        }
    }
    out
}

/// Vector pen: tip at `(x, y)`, barrel pointing down-right at 55°. Size scales with the frame's short side.
fn draw_hand(out: &mut Pixmap, hand: WhiteboardHand, x: f64, y: f64) {
    let short = f64::from(out.width().min(out.height())).max(1.0);
    let (len, width, body, cap, band) = match hand {
        WhiteboardHand::Marker => (
            short * 0.22,
            short * 0.05,
            Color::from_rgba8(44, 44, 48, 255),
            Color::from_rgba8(28, 28, 30, 255),
            Color::from_rgba8(205, 205, 210, 255),
        ),
        WhiteboardHand::Pen => (
            short * 0.2,
            short * 0.022,
            Color::from_rgba8(34, 36, 62, 255),
            Color::from_rgba8(190, 194, 205, 255),
            Color::from_rgba8(150, 154, 168, 255),
        ),
        WhiteboardHand::None => return,
    };
    let angle = 55f64.to_radians();
    let (dx, dy) = (angle.cos(), angle.sin());
    let at = |d: f64| ((x + dx * d) as f32, (y + dy * d) as f32);
    let mut paint = Paint::default();
    paint.anti_alias = true;

    // Shadow: a faint offset ellipse at the tip, so the pen looks like it is resting on the paper.
    let shadow_r = (width * 0.7) as f32;
    if let Some(shadow) = PathBuilder::from_circle(
        x as f32 + shadow_r * 0.4,
        y as f32 + shadow_r * 0.5,
        shadow_r,
    ) {
        paint.set_color(Color::from_rgba8(0, 0, 0, 46));
        out.fill_path(
            &shadow,
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
    }

    // Nib: a cone from the tip to 0.14·len.
    let tip_len = len * 0.14;
    let tip_w = width * 0.9;
    let (nx, ny) = (-dy, dx);
    let (bx, by) = (x + dx * tip_len, y + dy * tip_len);
    let mut tip = PathBuilder::new();
    tip.move_to(x as f32, y as f32);
    tip.line_to(
        (bx + nx * tip_w / 2.0) as f32,
        (by + ny * tip_w / 2.0) as f32,
    );
    tip.line_to(
        (bx - nx * tip_w / 2.0) as f32,
        (by - ny * tip_w / 2.0) as f32,
    );
    tip.close();
    if let Some(tip) = tip.finish() {
        paint.set_color(cap);
        out.fill_path(
            &tip,
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
    }

    let stroke_segment = |out: &mut Pixmap, from: f64, to: f64, w: f64, color: Color| {
        let mut pb = PathBuilder::new();
        let (x0, y0) = at(from);
        let (x1, y1) = at(to);
        pb.move_to(x0, y0);
        pb.line_to(x1, y1);
        let Some(path) = pb.finish() else {
            return;
        };
        let mut p = Paint::default();
        p.anti_alias = true;
        p.set_color(color);
        let stroke = Stroke {
            width: w as f32,
            line_cap: LineCap::Round,
            ..Stroke::default()
        };
        out.stroke_path(&path, &p, &stroke, Transform::identity(), None);
    };
    // Barrel, colour ring, end cap.
    stroke_segment(out, tip_len + width * 0.3, len, width, body);
    stroke_segment(
        out,
        tip_len + width * 0.6,
        tip_len + width * 0.9,
        width * 1.02,
        band,
    );
    stroke_segment(out, len * 0.86, len, width * 0.9, cap);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Three ink lines (top-left horizontal, top-right horizontal, lower vertical) plus a red block at the bottom right, transparent background.
    fn sample() -> Pixmap {
        let mut pm = Pixmap::new(200, 120).unwrap();
        let mut paint = Paint::default();
        paint.set_color(Color::from_rgba8(20, 20, 20, 255));
        let rect = |x: f32, y: f32, w: f32, h: f32| {
            PathBuilder::from_rect(tiny_skia::Rect::from_xywh(x, y, w, h).unwrap())
        };
        for r in [
            rect(10.0, 10.0, 60.0, 4.0),
            rect(120.0, 12.0, 60.0, 4.0),
            rect(30.0, 40.0, 4.0, 60.0),
        ] {
            pm.fill_path(
                &r,
                &paint,
                tiny_skia::FillRule::Winding,
                Transform::identity(),
                None,
            );
        }
        paint.set_color(Color::from_rgba8(220, 40, 40, 255));
        pm.fill_path(
            &rect(130.0, 60.0, 50.0, 40.0),
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
        pm
    }

    fn count_visible(pm: &Pixmap) -> usize {
        pm.data().chunks_exact(4).filter(|p| p[3] > 0).count()
    }

    #[test]
    fn classifies_and_orders_components() {
        let src = sample();
        let a = analyze(&src, &WhiteboardParams::default());
        assert_eq!(a.components, 4);
        assert!(a.ink_pixels > 0 && a.color_pixels > 0);
        assert!(a.natural_draw_seconds() >= 1.0);
    }

    #[test]
    fn frame_zero_is_empty_and_frame_one_equals_source() {
        let src = sample();
        let a = analyze(&src, &WhiteboardParams::default());
        let f0 = whiteboard_frame(&a, &src, 0.0, WhiteboardHand::None, None);
        assert_eq!(count_visible(&f0), 0);
        let f1 = whiteboard_frame(&a, &src, 1.0, WhiteboardHand::Marker, None);
        assert_eq!(f1.data(), src.data());
    }

    /// Opaque white-background source (the usual case for AI-generated images): without `paper`, undrawn strokes are filled with the source image's paper colour rather than cut out as transparent holes.
    #[test]
    fn opaque_paper_source_fills_unrevealed_strokes_with_its_own_paper() {
        let mut src = sample();
        let strokes = src.clone();
        src.fill(Color::from_rgba8(250, 250, 250, 255));
        src.draw_pixmap(
            0,
            0,
            strokes.as_ref(),
            &tiny_skia::PixmapPaint::default(),
            Transform::identity(),
            None,
        );
        let a = analyze(&src, &WhiteboardParams::default());
        assert_eq!(a.paper_fill, Some([250, 250, 250, 255]));
        let f0 = whiteboard_frame(&a, &src, 0.0, WhiteboardHand::None, None);
        assert_eq!(count_visible(&f0), 200 * 120);
        assert!(
            f0.data().chunks_exact(4).all(|p| p == [250, 250, 250, 255]),
            "t=0 应整幅纸色"
        );
        let f1 = whiteboard_frame(&a, &src, 1.0, WhiteboardHand::None, None);
        assert_eq!(f1.data(), src.data());
        // An explicit paper colour takes precedence over the source image's paper surface.
        let f0 = whiteboard_frame(
            &a,
            &src,
            0.0,
            WhiteboardHand::None,
            Some(Color::from_rgba8(0, 0, 255, 255)),
        );
        // The source image's own paper pixels are visible from the start (same as 0.8); at the strokes, the explicit paper colour comes first.
        let px = |pm: &Pixmap, x: usize, y: usize| {
            pm.data()[(y * 200 + x) * 4..(y * 200 + x) * 4 + 4].to_vec()
        };
        assert_eq!(px(&f0, 68, 11), [0, 0, 255, 255]);
        // Paper pixels next to a stroke count as halo and follow the stroke; only those more than HALO_RADIUS_PX away from a stroke are paper.
        assert_eq!(px(&f0, 5, 5), [0, 0, 255, 255]);
        assert_eq!(px(&f0, 100, 110), [250, 250, 250, 255]);
        // A transparent source stays transparent.
        let t = sample();
        assert_eq!(analyze(&t, &WhiteboardParams::default()).paper_fill, None);
    }

    /// The anti-aliased edges of strokes are light grey whose brightness just passes the paper threshold (so they are classed as paper): they are revealed together with the strokes of their working cell, and at t = 0 they are paper-coloured, so they must not appear as faint outlines from the start. Paper pixels far from strokes remain 0 and are always shown from the source image.
    #[test]
    fn antialiased_halo_around_strokes_is_revealed_with_the_stroke() {
        let mut src = Pixmap::new(200, 120).unwrap();
        src.fill(Color::from_rgba8(255, 255, 255, 255));
        let mut paint = Paint::default();
        // A 3 px wide light-grey halo (lum 240 > 235 → paper) surrounds a black line.
        paint.set_color(Color::from_rgba8(240, 240, 240, 255));
        let halo =
            PathBuilder::from_rect(tiny_skia::Rect::from_xywh(19.0, 50.0, 122.0, 8.0).unwrap());
        src.fill_path(
            &halo,
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
        paint.set_color(Color::from_rgba8(0, 0, 0, 255));
        let line =
            PathBuilder::from_rect(tiny_skia::Rect::from_xywh(22.0, 53.0, 116.0, 2.0).unwrap());
        src.fill_path(
            &line,
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
        let a = analyze(&src, &WhiteboardParams::default());
        let fill = a.paper_fill.unwrap();
        assert!(fill[0] > 250, "{fill:?}");
        let px = |pm: &Pixmap, x: usize, y: usize| {
            pm.data()[(y * 200 + x) * 4..(y * 200 + x) * 4 + 4].to_vec()
        };
        // Halo pixels follow the line: at t = 0 they are paper colour, not the source image's light grey; distant paper is always the source image.
        assert!(a.reveal_at(30, 50) > 0.0);
        assert!(a.reveal_at(19, 53) > 0.0);
        assert!(a.reveal_at(30, 57) > 0.0);
        assert_eq!(a.reveal_at(5, 5), 0.0);
        let f0 = whiteboard_frame(&a, &src, 0.0, WhiteboardHand::None, None);
        assert_eq!(px(&f0, 30, 50), fill.to_vec());
        assert_eq!(px(&f0, 30, 57), fill.to_vec());
        assert_eq!(px(&f0, 30, 54), fill.to_vec());
        assert_eq!(px(&f0, 5, 5), [255, 255, 255, 255]);
        assert!(
            f0.data().chunks_exact(4).all(|p| p[0] >= 250),
            "t=0 不应有浅灰轮廓"
        );
        let f1 = whiteboard_frame(&a, &src, 1.0, WhiteboardHand::None, None);
        assert_eq!(f1.data(), src.data());
    }

    #[test]
    fn reveal_is_monotonic_and_ink_precedes_color() {
        let src = sample();
        let a = analyze(&src, &WhiteboardParams::default());
        let mut last = 0;
        for i in 0..=20 {
            let n = a.revealed_count(i as f64 / 20.0);
            assert!(n >= last, "t={i}/20 revealed {n} < {last}");
            last = n;
        }
        // Colour-block pixels (130..180, 60..100) do not appear at all before 0.7; ink lines have all appeared by 0.7.
        let f = whiteboard_frame(&a, &src, INK_SHARE - 0.001, WhiteboardHand::None, None);
        for y in 60..100u32 {
            for x in 130..180u32 {
                assert_eq!(f.data()[((y * 200 + x) * 4 + 3) as usize], 0);
            }
        }
        let f = whiteboard_frame(&a, &src, INK_SHARE, WhiteboardHand::None, None);
        assert_eq!(f.data()[((11 * 200 + 68) * 4 + 3) as usize], 255);
        assert_eq!(f.data()[((13 * 200 + 178) * 4 + 3) as usize], 255);
        assert_eq!(f.data()[((99 * 200 + 31) * 4 + 3) as usize], 255);
    }

    #[test]
    fn beats_reorder_components() {
        let src = sample();
        // Default: the top-left horizontal line comes before the top-right horizontal line.
        let a = analyze(&src, &WhiteboardParams::default());
        assert!(a.reveal_at(12, 11) < a.reveal_at(122, 13));
        // beats: draw the right half first, then the left half.
        let b = analyze(
            &src,
            &WhiteboardParams {
                beats: vec![
                    WhiteboardBeat::at(0.0, [50.0, 0.0, 50.0, 100.0]),
                    WhiteboardBeat::at(0.5, [0.0, 0.0, 50.0, 100.0]),
                ],
                ..WhiteboardParams::default()
            },
        );
        assert!(b.reveal_at(178, 13) < b.reveal_at(12, 11));
        assert!(b.reveal_at(12, 11) >= 0.5);
        assert_eq!(b.groups.len(), 2);
        assert_eq!(b.groups[0].window, [0.0, 0.5]);
        assert_eq!(b.groups[1].window, [0.5, 1.0]);
        assert!(!b.hold_hand);
        assert_eq!(b.unassigned_foreground, 0);
    }

    /// `end`: the right edge of the group window is no longer the next beat's `at`. Left half `[0, 0.3]`, right half `[0.5, 1]`; no pixel is drawn between `(0.3, 0.5)`.
    #[test]
    fn beat_end_closes_the_window_before_the_next_beat() {
        let src = sample();
        let a = analyze(
            &src,
            &WhiteboardParams {
                beats: vec![
                    WhiteboardBeat {
                        at: 0.0,
                        end: Some(0.3),
                        rect: [0.0, 0.0, 50.0, 100.0],
                    },
                    WhiteboardBeat::at(0.5, [50.0, 0.0, 50.0, 100.0]),
                ],
                ..WhiteboardParams::default()
            },
        );
        assert_eq!(a.groups[0].window, [0.0, 0.3]);
        assert!(a.reveal_at(12, 11) <= 0.3 && a.reveal_at(31, 99) <= 0.3);
        assert!(a.reveal_at(178, 13) >= 0.5 && a.reveal_at(150, 80) >= 0.5);
        assert_eq!(a.revealed_count(0.3), a.revealed_count(0.499));
    }

    /// `natural`: when the drawing time is much longer than the natural duration, the strokes are drawn at natural speed at the start and the rest holds; in a hold segment the hand rests on the last stroke (under stretch, if there is no new stroke at that moment, no hand is drawn).
    #[test]
    fn natural_pace_draws_at_natural_speed_then_holds() {
        let src = sample();
        let base = analyze(&src, &WhiteboardParams::default());
        let natural = base.natural_seconds_unclamped();
        let draw_seconds = natural * 10.0;
        let a = analyze(
            &src,
            &WhiteboardParams {
                pace: WhiteboardPace::Natural,
                draw_seconds,
                ..WhiteboardParams::default()
            },
        );
        assert_eq!(a.groups.len(), 1);
        assert!(!a.groups[0].compressed);
        assert!(
            (a.groups[0].draw_end - 0.1).abs() < 1e-6,
            "{:?}",
            a.groups[0]
        );
        assert!((a.groups[0].natural_seconds - natural).abs() < 1e-9);
        assert_eq!(a.revealed_count(0.11), a.revealed_count(1.0));
        assert!(a.revealed_count(0.05) < a.revealed_count(1.0));
        // The hand is still present in the hold segment; under stretch there is a new stroke at every moment before drawing finishes, so only natural is checked here.
        let bare = whiteboard_frame(&a, &src, 0.6, WhiteboardHand::None, None);
        let with_hand = whiteboard_frame(&a, &src, 0.6, WhiteboardHand::Marker, None);
        assert!(count_visible(&with_hand) > count_visible(&bare));
        assert!(a.hold_hand);
        // Group window shorter than natural duration: compress to the group window and record `compressed`.
        let tight = analyze(
            &src,
            &WhiteboardParams {
                pace: WhiteboardPace::Natural,
                draw_seconds: natural * 0.5,
                ..WhiteboardParams::default()
            },
        );
        assert!(tight.groups[0].compressed);
        assert_eq!(tight.groups[0].draw_end, 1.0);
        // draw_seconds unknown = stretch.
        let unknown = analyze(
            &src,
            &WhiteboardParams {
                pace: WhiteboardPace::Natural,
                ..WhiteboardParams::default()
            },
        );
        assert_eq!(unknown.groups[0].draw_end, 1.0);
    }

    /// `strict`: boxes are hard masks. The top-left horizontal line (x 10..70) is cut by `[0, 0, 20, 100]` (x < 40 px): the left segment belongs to the first beat, and the right segment is in no box → scheduled after the last beat `[0.5, 1]`.
    #[test]
    fn strict_boxes_split_components_and_park_unassigned_foreground_after_the_last_beat() {
        let src = sample();
        let a = analyze(
            &src,
            &WhiteboardParams {
                strict: true,
                beats: vec![WhiteboardBeat {
                    at: 0.0,
                    end: Some(0.5),
                    rect: [0.0, 0.0, 20.0, 100.0],
                }],
                ..WhiteboardParams::default()
            },
        );
        assert!(a.reveal_at(12, 11) < 0.5, "{}", a.reveal_at(12, 11));
        assert!(a.reveal_at(60, 11) >= 0.5, "{}", a.reveal_at(60, 11));
        assert!(a.reveal_at(178, 13) >= 0.5);
        assert!(a.unassigned_foreground > 0);
        assert_eq!(a.groups.len(), 1);
        assert!(!a.groups[0].empty);
        // Same box without strict: the whole horizontal line belongs to the first beat (its centroid is inside the box), with no unowned part.
        let loose = analyze(
            &src,
            &WhiteboardParams {
                beats: vec![WhiteboardBeat {
                    at: 0.0,
                    end: Some(0.5),
                    rect: [0.0, 0.0, 20.0, 100.0],
                }],
                ..WhiteboardParams::default()
            },
        );
        assert!(loose.reveal_at(60, 11) <= 0.5);
        assert_eq!(loose.unassigned_foreground, 0);
        // A later beat overrides an earlier one: the first beat's box is entirely covered by the second beat's box → the first beat ends up with nothing.
        let covered = analyze(
            &src,
            &WhiteboardParams {
                strict: true,
                beats: vec![
                    WhiteboardBeat::at(0.0, [0.0, 0.0, 50.0, 100.0]),
                    WhiteboardBeat::at(0.5, [0.0, 0.0, 100.0, 100.0]),
                ],
                ..WhiteboardParams::default()
            },
        );
        assert!(covered.groups[0].empty);
        assert!(!covered.groups[1].empty);
        assert!(covered.reveal_at(12, 11) >= 0.5);
    }

    /// `boxes[]`: for the four connected components, in reading order, their bounding boxes (percent), areas, and per-region natural durations.
    #[test]
    fn boxes_list_components_in_reading_order() {
        let src = sample();
        let a = analyze(&src, &WhiteboardParams::default());
        assert_eq!(a.boxes.len(), 4);
        let first = &a.boxes[0];
        assert!(first.ink);
        assert!((first.rect[0] - 5.0).abs() < 0.6, "{:?}", first.rect);
        assert!((first.rect[1] - 10.0 / 120.0 * 100.0).abs() < 1.0);
        assert!((first.rect[2] - 30.0).abs() < 0.6);
        assert!(first.natural_seconds > 0.25);
        assert!(!a.boxes[3].ink, "{:?}", a.boxes);
        assert!(a.boxes[3].rect[1] > a.boxes[0].rect[1]);
        let total: f64 = a.boxes.iter().map(|b| b.natural_seconds).sum();
        assert!((total - a.natural_seconds_unclamped()).abs() < 1e-9);
    }

    #[test]
    fn hand_and_paper_render_deterministically() {
        let src = sample();
        let a = analyze(&src, &WhiteboardParams::default());
        let paper = Some(Color::from_rgba8(245, 235, 215, 255));
        let f1 = whiteboard_frame(&a, &src, 0.4, WhiteboardHand::Marker, paper);
        let f2 = whiteboard_frame(&a, &src, 0.4, WhiteboardHand::Marker, paper);
        assert_eq!(f1.data(), f2.data());
        // The paper colour fills the whole frame.
        assert_eq!(count_visible(&f1), 200 * 120);
        // The pen is visible when t < 1: in a frame with a transparent background and no paper colour, there are more visible pixels than purely revealed pixels.
        let bare = whiteboard_frame(&a, &src, 0.4, WhiteboardHand::None, None);
        let with_hand = whiteboard_frame(&a, &src, 0.4, WhiteboardHand::Pen, None);
        assert!(count_visible(&with_hand) > count_visible(&bare));
    }

    #[test]
    fn large_sources_are_analysed_at_work_resolution() {
        let mut pm = Pixmap::new(2400, 1200).unwrap();
        let mut paint = Paint::default();
        paint.set_color(Color::from_rgba8(0, 0, 0, 255));
        let r =
            PathBuilder::from_rect(tiny_skia::Rect::from_xywh(100.0, 100.0, 1.0, 600.0).unwrap());
        pm.fill_path(
            &r,
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
        let a = analyze(&pm, &WhiteboardParams::default());
        assert_eq!(a.components, 1);
        assert!(a.work_area <= (WORK_LONG_EDGE * WORK_LONG_EDGE) as usize);
        // 1 px thin lines still all have times after aggregation, so the finished frame equals the source image.
        let f1 = whiteboard_frame(&a, &pm, 1.0, WhiteboardHand::None, None);
        assert_eq!(f1.data(), pm.data());
        assert_eq!(a.revealed_count(0.0), 2400 * 1200 - 600);
    }
}
