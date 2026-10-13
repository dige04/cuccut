//! The **shared parts** of the drawing kernels for directory-type recipes (element plan §7.2 / §7.4).
//!
//! The recipe kernels for visualizer and progress only describe "how parameters become geometry",
//! and **carry no style parameters of their own** (the same discipline as `loop_kernel` in the motion doc, stage 1).
//! This module holds two kinds of things:
//!
//! 1. **The conversion rules themselves**: [`smoothstep`], [`Easing`] and [`sample_row_linear`].
//!    These are formulas, not recipe data.
//! 2. **Vector geometry tools**: the coordinate conversion of [`DrawBox`] and the path assemblers [`rect_subpath`],
//!    [`sector_subpath`], [`ring_subpath`] and [`swept_arc_subpath`].
//!
//! Each item here serves both the CPU vector recipes (visualizer's 10, progress's CPU reference) and the WGSL packing for progress ([`Easing::code`]). Both sides share the same conversion, so cross-checking them is meaningful. Anything used by only one recipe does not belong in this module; it stays in that recipe's own file.

use crate::drawop::PathSeg;

/// Path segment construction (`verb` encoding: see [`PathSeg`]). The f64 → f32 truncation happens only here.
pub(crate) fn seg(verb: u8, pts: [f64; 6]) -> PathSeg {
    PathSeg {
        verb,
        pts: [
            pts[0] as f32,
            pts[1] as f32,
            pts[2] as f32,
            pts[3] as f32,
            pts[4] as f32,
            pts[5] as f32,
        ],
    }
}

pub(crate) fn path_seg_move(x: f64, y: f64) -> PathSeg {
    seg(0, [x, y, 0.0, 0.0, 0.0, 0.0])
}

pub(crate) fn path_seg_line(x: f64, y: f64) -> PathSeg {
    seg(1, [x, y, 0.0, 0.0, 0.0, 0.0])
}

pub(crate) fn path_seg_cubic(c1: (f64, f64), c2: (f64, f64), to: (f64, f64)) -> PathSeg {
    seg(3, [c1.0, c1.1, c2.0, c2.1, to.0, to.1])
}

pub(crate) fn path_seg_close() -> PathSeg {
    seg(4, [0.0; 6])
}

/// The **vertical midline** of the element box (normalized v).
///
/// Recipes that "swing around a midline", such as the oscilloscope and ribbon, use it as zero. It is a geometric constant, not a style parameter.
/// (The `align: bottom` form of the bar family moves zero to the bottom of the box. That is the recipe's own business.)
pub const MID_V: f64 = 0.5;

/// Element box (canvas pixels, origin top-left).
///
/// Recipes work in normalized `(u, v)` coordinates with **the v axis pointing up**. The progress ring's "clockwise from straight up" and the bar family's
/// "bottom-aligned" corroborate each other (see [`DrawBox::at`]). The canvas is y-down, so the conversion must flip v once.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DrawBox {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl DrawBox {
    pub fn center(&self) -> (f64, f64) {
        (self.x + self.w / 2.0, self.y + self.h / 2.0)
    }

    /// The largest square centered inside the box.
    ///
    /// Recipes with `aspect: "square"` (`ring_bars`, `ring_wave`, `pulse_rings`,
    /// `circle`, `donut` and so on) use it to draw a circle as a **circle** rather than an ellipse. CucCut's geometry table sets the default
    /// box for such elements to "30% of frame width × 30% of frame height" (`ccut_timeline::geometry`), which is **not** a pixel square at 16:9.
    /// Since the recipe explicitly declares `square`, the drawing side follows that.
    pub fn inscribed_square(&self) -> DrawBox {
        let side = self.w.min(self.h);
        DrawBox {
            x: self.x + (self.w - side) / 2.0,
            y: self.y + (self.h - side) / 2.0,
            w: side,
            h: side,
        }
    }

    /// Normalized `(u, v)` (origin bottom-left, v up) → canvas pixels (origin top-left, y down).
    pub fn at(&self, u: f64, v: f64) -> (f64, f64) {
        (self.x + self.w * u, self.y + self.h * (1.0 - v))
    }
}

/// GLSL's `smoothstep`. When `edge0 == edge1` it degenerates into a step (undefined in GLSL, so fixed here).
pub fn smoothstep(edge0: f64, edge1: f64, x: f64) -> f64 {
    if edge0 == edge1 {
        return if x < edge0 { 0.0 } else { 1.0 };
    }
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// The closed set of values for recipe `easing` (the value domain was already validated against `ENUM_KEYS` at registry parse time).
///
/// visualizer and progress share one enum. Their values belong to **the same family** (both are `easeOut*` and both act on a
/// 0..1 amplitude). Differences in the value domains are the registry's business, and the drawing side only needs
/// "name → curve".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Easing {
    None,
    OutQuad,
    OutSine,
    OutCubic,
    OutExpo,
}

impl Easing {
    /// Unknown names are caught at **registry parse time** (`manifest-invalid`). If the drawing side reads `None`, someone must have bypassed
    /// the registry. In that case treat it as identity, and do not panic.
    pub fn parse(name: &str) -> Option<Easing> {
        match name {
            "none" => Some(Easing::None),
            "easeOutQuad" => Some(Easing::OutQuad),
            "easeOutSine" => Some(Easing::OutSine),
            "easeOutCubic" => Some(Easing::OutCubic),
            "easeOutExpo" => Some(Easing::OutExpo),
            _ => None,
        }
    }

    pub fn apply(self, x: f64) -> f64 {
        match self {
            Easing::None => x,
            Easing::OutQuad => 1.0 - (1.0 - x) * (1.0 - x),
            Easing::OutSine => (x * std::f64::consts::PI / 2.0).sin(),
            Easing::OutCubic => 1.0 - (1.0 - x).powi(3),
            // `exp2` saves one `exp(ln 2 · ·)` round trip compared with `pow(2, −10x)`.
            // Both sides (CPU and WGSL) use it.
            Easing::OutExpo => {
                if x >= 1.0 {
                    1.0
                } else {
                    1.0 - (-10.0 * x).exp2()
                }
            }
        }
    }

    /// The **numeric encoding** sent to WGSL (`applyEasing` in `common.wgsl` dispatches on it).
    ///
    /// The single source of truth for the encoding table is here. The shader therefore has no knowledge of "which style uses which easing", and
    /// the recipe's string names never need to enter WGSL. Any change here must be synchronized with `applyEasing`.
    /// `tests/shader_wgsl.rs` pins the two sides together with a cross-check.
    pub fn code(self) -> u32 {
        match self {
            Easing::None => 0,
            Easing::OutQuad => 1,
            Easing::OutSine => 2,
            Easing::OutCubic => 3,
            Easing::OutExpo => 4,
        }
    }
}

/// **Bilinear-equivalent sampling** of one byte row: `GL_LINEAR` + `CLAMP_TO_EDGE`, and `0..1`.
///
/// It uses the same conversion as the audio texture in §8.3 (`w × 2` `R8Unorm`, sampler linear / clamp-to-edge).
/// Texel centers sit at `(i + 0.5) / w`, so the texel coordinate for a normalized coordinate `u` is
/// `u·w − 0.5`. Waveform recipes read spectrum rows through here, and any future GPU waveform recipe will sample the same way.
pub fn sample_row_linear(row: &[u8], u: f64) -> f64 {
    if row.is_empty() {
        return 0.0;
    }
    let last = row.len() - 1;
    let position = u * row.len() as f64 - 0.5;
    let base = position.floor();
    let fraction = position - base;
    let index = |offset: f64| -> f64 {
        let clamped = (base + offset).clamp(0.0, last as f64) as usize;
        f64::from(row[clamped.min(last)]) / f64::from(u8::MAX)
    };
    index(0.0) * (1.0 - fraction) + index(1.0) * fraction
}

// ── path assembly ─────────────────────────────────────────────────────

/// One rectangle subpath (clockwise on the canvas).
///
/// Several subpaths in the same direction stacked in one path fill as a union under **nonzero**. Drawing them as separate `FillRect`s would
/// blend a semi-transparent color twice where they overlap.
pub fn rect_subpath(out: &mut Vec<PathSeg>, x: f64, y: f64, w: f64, h: f64) {
    if !(w > 0.0 && h > 0.0) {
        return;
    }
    out.push(path_seg_move(x, y));
    out.push(path_seg_line(x + w, y));
    out.push(path_seg_line(x + w, y + h));
    out.push(path_seg_line(x, y + h));
    out.push(path_seg_close());
}

/// Polar angle → canvas point. `phi` starts from **straight up** and is positive **clockwise**.
///
/// Same orientation as `atan(-centred.x, -centred.y) + PI` in `progress_circle` and `progress_donut`.
/// That formula gives "clockwise from straight up" in the v-up `texCoord`.
pub fn polar(center: (f64, f64), radius: f64, phi: f64) -> (f64, f64) {
    (center.0 + radius * phi.sin(), center.1 - radius * phi.cos())
}

/// Cubic Bézier approximation of an arc, appended to `out` (no move included).
fn arc_segments(out: &mut Vec<PathSeg>, center: (f64, f64), radius: f64, from: f64, to: f64) {
    let sweep = to - from;
    if sweep == 0.0 || radius <= 0.0 {
        return;
    }
    // Each segment spans no more than a quarter circle, so the Bézier approximation error (within π/2) is negligible.
    let count = (sweep.abs() / (std::f64::consts::FRAC_PI_2))
        .ceil()
        .max(1.0);
    let step = sweep / count;
    let handle = 4.0 / 3.0 * (step / 4.0).tan();
    let mut angle = from;
    for _ in 0..(count as usize) {
        let next = angle + step;
        let start = polar(center, radius, angle);
        let end = polar(center, radius, next);
        // dP/dφ = r·(cos φ, sin φ)
        let c1 = (
            start.0 + handle * radius * angle.cos(),
            start.1 + handle * radius * angle.sin(),
        );
        let c2 = (
            end.0 - handle * radius * next.cos(),
            end.1 - handle * radius * next.sin(),
        );
        out.push(path_seg_cubic(c1, c2, end));
        angle = next;
    }
}

/// A full ring (`inner <= 0` gives a solid disc).
///
/// Outer circle clockwise and inner circle counter-clockwise, so a nonzero fill hollows it out naturally. No even-odd is needed.
pub fn ring_subpath(out: &mut Vec<PathSeg>, center: (f64, f64), outer: f64, inner: f64) {
    if outer <= 0.0 {
        return;
    }
    let full = std::f64::consts::TAU;
    let start = polar(center, outer, 0.0);
    out.push(path_seg_move(start.0, start.1));
    arc_segments(out, center, outer, 0.0, full);
    out.push(path_seg_close());
    if inner > 0.0 {
        hole_subpath(out, center, inner);
    }
}

/// **Reverse-wound** full circle subpath. Appended after the forward subpath (the outer circle from [`rect_subpath`] or
/// [`ring_subpath`]), it becomes a **hole** under nonzero fill.
///
/// The φ=0 point of [`polar`] is at the top, and φ increasing goes right. On the y-down canvas that is clockwise, the same direction as
/// [`rect_subpath`], so the hole must be traced counter-clockwise.
pub fn hole_subpath(out: &mut Vec<PathSeg>, center: (f64, f64), radius: f64) {
    if radius <= 0.0 {
        return;
    }
    let start = polar(center, radius, 0.0);
    out.push(path_seg_move(start.0, start.1));
    arc_segments(out, center, radius, 0.0, -std::f64::consts::TAU);
    out.push(path_seg_close());
}

/// Ring sector: angle range `[from, to]` × radius range `[inner, outer]`. When `inner <= 0` it degenerates into a pie slice.
pub fn sector_subpath(
    out: &mut Vec<PathSeg>,
    center: (f64, f64),
    outer: f64,
    inner: f64,
    from: f64,
    to: f64,
) {
    if outer <= 0.0 || to == from {
        return;
    }
    if (to - from).abs() >= std::f64::consts::TAU {
        ring_subpath(out, center, outer, inner);
        return;
    }
    let start = polar(center, outer, from);
    out.push(path_seg_move(start.0, start.1));
    arc_segments(out, center, outer, from, to);
    if inner > 0.0 {
        let back = polar(center, inner, to);
        out.push(path_seg_line(back.0, back.1));
        arc_segments(out, center, inner, to, from);
    } else {
        out.push(path_seg_line(center.0, center.1));
    }
    out.push(path_seg_close());
}

/// The **union** of a disc of radius `dot` swept along the arc `[from, to]` of radius `orbit`.
///
/// The reference implementation of the `snake` family adds up the alpha of many small circles, one per degree, and then applies `min(…, 1)`.
/// The spacing between circle centers (0.4 of the radius at 1°, about 0.007) is only one-fourteenth of the circle radius (0.1), so the summed field
/// is already saturated throughout the interior of the union. The half-coverage contour is therefore the **boundary of the union** itself.
///
/// This union has a closed form. The set of points within distance `dot` of the arc is the ring sector `[orbit − dot, orbit + dot]`
/// together with two endpoint discs. For a point whose angle falls inside the sector, the nearest arc point lies at the same angle. For a point whose angle falls outside the sector, the nearest arc point is an endpoint.
/// These two cases cover everything, with no third case. The per-degree loop therefore reduces to **a fixed number of loops** (`maxIterations` and `angleIncrementDeg`
/// remain the source of truth for the data). The geometry itself is stated by one [`sector_subpath`] and two [`ring_subpath`] calls.
///
/// All three pieces are pushed in the orientation of [`ring_subpath`] (`phi` increasing). A nonzero fill computes a union only when the directions agree. A sector in the opposite direction would **cut out** the endpoint discs.
pub fn swept_arc_subpath(
    out: &mut Vec<PathSeg>,
    center: (f64, f64),
    orbit: f64,
    dot: f64,
    from: f64,
    to: f64,
) {
    if dot <= 0.0 {
        return;
    }
    let (outer, inner) = (orbit + dot, (orbit - dot).max(0.0));
    let (low, high) = if to >= from { (from, to) } else { (to, from) };
    sector_subpath(out, center, outer, inner, low, high);
    ring_subpath(out, polar(center, orbit, from), dot, 0.0);
    if to != from {
        ring_subpath(out, polar(center, orbit, to), dot, 0.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `edge0 == edge1` degenerates into a step. Elsewhere it uses the same formula as GLSL.
    #[test]
    fn the_smoothstep_degenerates_to_a_step() {
        assert_eq!(smoothstep(0.5, 0.5, 0.4), 0.0);
        assert_eq!(smoothstep(0.5, 0.5, 0.5), 1.0);
        assert!((smoothstep(0.0, 1.0, 0.5) - 0.5).abs() < 1e-12);
        assert_eq!(smoothstep(0.0, 1.0, -1.0), 0.0);
        assert_eq!(smoothstep(0.0, 1.0, 2.0), 1.0);
    }

    /// Texel centers sit at `(i + 0.5)/w`, so `u = 0` and `u = 1` fall on clamp-to-edge.
    #[test]
    fn the_row_sampler_matches_gl_linear_clamp_to_edge() {
        let row = [0u8, 255, 0, 255];
        assert!((sample_row_linear(&row, 0.0) - 0.0).abs() < 1e-12);
        assert!((sample_row_linear(&row, 1.0) - 1.0).abs() < 1e-12);
        // Exactly midway between texels 0 and 1, which is their average.
        let middle = sample_row_linear(&row, 0.25);
        assert!((middle - 0.5).abs() < 1e-9, "{middle}");
        // At a texel center, the texel itself is returned.
        assert!((sample_row_linear(&row, 0.375) - 1.0).abs() < 1e-12);
        assert_eq!(sample_row_linear(&[], 0.5), 0.0);
    }

    #[test]
    fn the_easings_match_the_reference_formulas() {
        assert_eq!(Easing::parse("easeOutQuad").unwrap().apply(0.0), 0.0);
        assert_eq!(Easing::parse("easeOutQuad").unwrap().apply(1.0), 1.0);
        assert!((Easing::parse("easeOutQuad").unwrap().apply(0.5) - 0.75).abs() < 1e-12);
        assert!((Easing::parse("easeOutCubic").unwrap().apply(0.5) - 0.875).abs() < 1e-12);
        assert!(
            (Easing::parse("easeOutSine").unwrap().apply(0.5)
                - (0.25 * std::f64::consts::PI).sin())
            .abs()
                < 1e-12
        );
        assert_eq!(Easing::parse("none").unwrap().apply(0.3), 0.3);
        assert!(Easing::parse("easeInBounce").is_none());
    }

    /// v-axis flip: normalized `v = 0` is the **bottom edge** of the box.
    #[test]
    fn the_box_flips_v_from_bottom_up_to_canvas_down() {
        let bbox = DrawBox {
            x: 10.0,
            y: 20.0,
            w: 100.0,
            h: 50.0,
        };
        assert_eq!(bbox.at(0.0, 0.0), (10.0, 70.0));
        assert_eq!(bbox.at(1.0, 1.0), (110.0, 20.0));
        assert_eq!(bbox.center(), (60.0, 45.0));
        let square = bbox.inscribed_square();
        assert_eq!((square.w, square.h), (50.0, 50.0));
        assert_eq!(square.center(), bbox.center());
    }

    /// Polar angle runs clockwise from straight up: π/2 is on the right, π is at the bottom.
    #[test]
    fn the_polar_helper_starts_at_the_top_and_turns_clockwise() {
        let center = (0.0, 0.0);
        let top = polar(center, 1.0, 0.0);
        assert!(top.0.abs() < 1e-12 && (top.1 + 1.0).abs() < 1e-12);
        let right = polar(center, 1.0, std::f64::consts::FRAC_PI_2);
        assert!((right.0 - 1.0).abs() < 1e-12 && right.1.abs() < 1e-12);
        let bottom = polar(center, 1.0, std::f64::consts::PI);
        assert!(bottom.0.abs() < 1e-12 && (bottom.1 - 1.0).abs() < 1e-12);
    }

    /// Swept union: a single point degenerates into a disc. A reverse interval and a forward interval draw the same path.
    #[test]
    fn the_swept_arc_is_direction_independent_and_degenerates_to_a_disc() {
        let center = (0.0, 0.0);
        let mut dot = Vec::new();
        swept_arc_subpath(&mut dot, center, 0.4, 0.1, 0.0, 0.0);
        let mut disc = Vec::new();
        ring_subpath(&mut disc, polar(center, 0.4, 0.0), 0.1, 0.0);
        assert_eq!(dot, disc, "a zero span leaves only one endpoint disc");

        let mut forward = Vec::new();
        swept_arc_subpath(&mut forward, center, 0.4, 0.1, 0.0, 1.0);
        let mut expected = Vec::new();
        sector_subpath(&mut expected, center, 0.5, 0.3, 0.0, 1.0);
        expected.extend(disc.iter().copied());
        ring_subpath(&mut expected, polar(center, 0.4, 1.0), 0.1, 0.0);
        assert_eq!(forward, expected);
        // Reverse interval: the sector's orientation is corrected (otherwise nonzero would cut out the endpoint discs).
        // Only the order of the two endpoint discs differs.
        let mut backward = Vec::new();
        swept_arc_subpath(&mut backward, center, 0.4, 0.1, 1.0, 0.0);
        let sector_len = expected.len() - 2 * disc.len();
        assert_eq!(forward[..sector_len], backward[..sector_len]);
        let mut nothing = Vec::new();
        swept_arc_subpath(&mut nothing, center, 0.4, 0.0, 0.0, 1.0);
        assert!(nothing.is_empty());
    }

    #[test]
    fn a_full_sweep_sector_degenerates_to_a_ring() {
        let mut sector = Vec::new();
        sector_subpath(
            &mut sector,
            (0.0, 0.0),
            10.0,
            4.0,
            0.0,
            std::f64::consts::TAU,
        );
        let mut ring = Vec::new();
        ring_subpath(&mut ring, (0.0, 0.0), 10.0, 4.0);
        assert_eq!(sector, ring);
    }
}
