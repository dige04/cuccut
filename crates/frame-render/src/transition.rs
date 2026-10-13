//! Transition drawing (format spec §3.9).
//!
//! The kernel first draws each side into a transparent layer the same size as the output (already including its own geometry, mask, effects, element animation and opacity). The layers are then combined here according to the transition.
//! Entry drawing acts on B, using B's own box, rotation and mirroring (same semantics as the entry transition of v2 media elements):
//!
//! - `dissolve`: opacity × e;
//! - `wipe`: reveals from the box's local left edge to e;
//! - `slide`: translates along the box's x axis by (e − 1) × box width, opacity × e;
//! - `zoom`: scales around the box center by 0.75 + 0.25e, opacity × e;
//! - `iris`: a circle with radius e × half-diagonal.
//!
//! For two-sided transitions, A is drawn fully first, then B is drawn with the entry method. `dip-to-color` fades A to the color during the first half and from the color to B during the second half. `push` pushes the whole canvas along the motion direction: B is short by (1 − e) canvas widths (heights), and A has moved by e. One-sided transitions use a transparent other side. An exit is the reverse of the same method, with progress replaced by e′ = easing(1 − p). Blending is done on sRGB-encoded values (consistent with Canvas 2D).

use render_graph::{LayerTransition, TransitionRole};
use serde_json::{Map, Value};
use subtitle_render::TimelineVisualElement;
use timeline::schema::{ElementKind, VisualMode};
use tiny_skia::{BlendMode, Color, FilterQuality, Pixmap, PixmapPaint, Transform};

use crate::effects::hex_rgba;

/// A side's box (output pixels): center, width and height, rotation (degrees, clockwise) and mirroring.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BoxGeom {
    pub cx: f64,
    pub cy: f64,
    pub w: f64,
    pub h: f64,
    pub rotation: f64,
    pub flip_x: bool,
    pub flip_y: bool,
}

impl BoxGeom {
    /// The element's box on `size` output. `element` already has this moment's keyframes substituted. `natural` is the pixel size of an external media source (including Lottie); when present, the box is computed from the media (the whole canvas in fill mode without tiling), otherwise from the element's static box.
    pub fn of(element: &TimelineVisualElement, natural: Option<(f64, f64)>, size: (f64, f64)) -> BoxGeom {
        let place = &element.place;
        let (cx, cy, w, h) = match natural {
            Some(natural) => {
                let tiled = element.tile.as_ref().is_some_and(|t| t.on);
                let fullscreen = element.mode == VisualMode::Fullscreen && !tiled;
                let natural = if natural.0 > 0.0 && natural.1 > 0.0 { natural } else { size };
                let (mut w, mut h, cx, cy) = timeline::geometry::media_box(element.kind, fullscreen, place, natural, size);
                if !fullscreen {
                    let scale = place.scale.unwrap_or(1.0);
                    w *= scale;
                    h *= scale * place.scale_y.unwrap_or(1.0);
                }
                (cx, cy, w, h)
            }
            None => {
                let view = subtitle_render::element_view(element);
                let geometry = timeline::ElementGeometry {
                    shape: element.shape.as_ref(),
                    sticker: element.sticker.as_ref(),
                    aspect: timeline_render::element::element_aspect(&view),
                };
                let kind = if element.kind == ElementKind::Video {
                    ElementKind::Image
                } else {
                    element.kind
                };
                let (x, y, w, h) = timeline::static_box(kind, &geometry, Some(place), size);
                (x + w / 2.0, y + h / 2.0, w, h)
            }
        };
        let (fx, fy) = place.flip_signs();
        BoxGeom {
            cx,
            cy,
            w: w.abs(),
            h: h.abs(),
            rotation: place.rot.unwrap_or(0.0),
            flip_x: fx < 0.0,
            flip_y: fy < 0.0,
        }
    }

    /// The distance from output pixel center `(x, y)` to the box's left edge (in the content direction) in the box's local coordinates, and its distance from the center.
    fn local_u(&self, x: f64, y: f64) -> f64 {
        let (sin, cos) = self.rotation.to_radians().sin_cos();
        let (px, py) = (x - self.cx, y - self.cy);
        let lx = px * cos + py * sin;
        let lx = if self.flip_x { -lx } else { lx };
        lx + self.w / 2.0
    }

    /// The unit vector of the box's x axis (content direction) on the output.
    fn axis(&self) -> (f64, f64) {
        let (sin, cos) = self.rotation.to_radians().sin_cos();
        let sign = if self.flip_x { -1.0 } else { 1.0 };
        (cos * sign, sin * sign)
    }
}

/// The progress this side uses in the transition: entry and two-sided transitions use `eased`; one-sided exit uses easing(1 − p).
pub fn effective_progress(transition: &LayerTransition, two_sided: bool) -> f64 {
    match (transition.role, two_sided) {
        (TransitionRole::Outgoing, false) => transition.easing.apply(1.0 - transition.progress),
        _ => transition.eased,
    }
    .clamp(0.0, 1.0)
}

/// Combines A and B into `out` according to `kind` at progress `e` (the caller provides a cleared transparent canvas). `b_box` is B's box.
pub fn compose(
    kind: &str,
    params: &Map<String, Value>,
    a: Option<&Pixmap>,
    b: Option<&Pixmap>,
    b_box: Option<BoxGeom>,
    e: f64,
    out: &mut Pixmap,
) {
    let e = if e.is_finite() { e.clamp(0.0, 1.0) } else { 1.0 };
    let (w, h) = (out.width() as f64, out.height() as f64);
    match kind {
        "dip-to-color" => {
            let [r, g, bl, _] = params
                .get("color")
                .and_then(Value::as_str)
                .and_then(hex_rgba)
                .unwrap_or([0, 0, 0, 255]);
            // First half: A → color (ratio 2e). Second half: color → B (ratio 2e − 1).
            let (side, colour_weight) = if e < 0.5 { (a, 2.0 * e) } else { (b, 1.0 - (2.0 * e - 1.0)) };
            lerp_to_colour(out, side, [r, g, bl], colour_weight);
        }
        "push" => {
            let (vx, vy) = match params.get("direction").and_then(Value::as_str) {
                Some("right") => (-w, 0.0),
                Some("up") => (0.0, h),
                Some("down") => (0.0, -h),
                _ => (w, 0.0),
            };
            // When moving left, B enters from the right: B is short by (1 − e), and A has moved left by e.
            blit(out, a, 1.0, Transform::from_translate((-vx * e) as f32, (-vy * e) as f32));
            blit(
                out,
                b,
                1.0,
                Transform::from_translate((vx * (1.0 - e)) as f32, (vy * (1.0 - e)) as f32),
            );
        }
        _ => {
            blit(out, a, 1.0, Transform::identity());
            let Some(b) = b else { return };
            let geom = b_box.unwrap_or(BoxGeom {
                cx: w / 2.0,
                cy: h / 2.0,
                w,
                h,
                rotation: 0.0,
                flip_x: false,
                flip_y: false,
            });
            incoming(kind, b, geom, e, out);
        }
    }
}

/// Draws B onto `out` with the entry method. An unrecognized kind becomes a hard cut (the caller has already reported it), and only B is drawn.
fn incoming(kind: &str, b: &Pixmap, geom: BoxGeom, e: f64, out: &mut Pixmap) {
    match kind {
        "dissolve" => blit(out, Some(b), e, Transform::identity()),
        "slide" => {
            let (ax, ay) = geom.axis();
            let shift = (e - 1.0) * geom.w;
            blit(out, Some(b), e, Transform::from_translate((ax * shift) as f32, (ay * shift) as f32));
        }
        "zoom" => {
            let s = 0.75 + 0.25 * e;
            let zoom = Transform::from_row(
                s as f32,
                0.0,
                0.0,
                s as f32,
                (geom.cx * (1.0 - s)) as f32,
                (geom.cy * (1.0 - s)) as f32,
            );
            blit(out, Some(b), e, zoom);
        }
        "wipe" => {
            let edge = e * geom.w;
            over_with_coverage(out, b, |x, y| (edge - geom.local_u(x, y) + 0.5).clamp(0.0, 1.0));
        }
        "iris" => {
            let radius = e * (geom.w / 2.0).hypot(geom.h / 2.0);
            over_with_coverage(out, b, |x, y| (radius - (x - geom.cx).hypot(y - geom.cy) + 0.5).clamp(0.0, 1.0));
        }
        _ => blit(out, Some(b), 1.0, Transform::identity()),
    }
}

fn blit(out: &mut Pixmap, side: Option<&Pixmap>, opacity: f64, transform: Transform) {
    let Some(side) = side else { return };
    if opacity <= 0.0 {
        return;
    }
    let quality = if transform.is_identity() || is_integer_translate(transform) {
        FilterQuality::Nearest
    } else {
        FilterQuality::Bilinear
    };
    let paint = PixmapPaint {
        opacity: opacity.min(1.0) as f32,
        blend_mode: BlendMode::SourceOver,
        quality,
    };
    out.draw_pixmap(0, 0, side.as_ref(), &paint, transform, None);
}

fn is_integer_translate(t: Transform) -> bool {
    t.sx == 1.0 && t.sy == 1.0 && t.kx == 0.0 && t.ky == 0.0 && t.tx.fract() == 0.0 && t.ty.fract() == 0.0
}

/// Applies `side` with per-pixel coverage onto `out` (premultiplied SourceOver).
fn over_with_coverage(out: &mut Pixmap, side: &Pixmap, coverage: impl Fn(f64, f64) -> f64) {
    let width = out.width() as usize;
    if side.width() != out.width() || side.height() != out.height() {
        return;
    }
    for (i, (dst, src)) in out.data_mut().chunks_exact_mut(4).zip(side.data().chunks_exact(4)).enumerate() {
        if src[3] == 0 {
            continue;
        }
        let x = (i % width) as f64 + 0.5;
        let y = (i / width) as f64 + 0.5;
        let k = coverage(x, y);
        if k <= 0.0 {
            continue;
        }
        let sa = f64::from(src[3]) * k;
        let keep = 1.0 - sa / 255.0;
        for c in 0..4 {
            let s = f64::from(src[c]) * k;
            dst[c] = (s + f64::from(dst[c]) * keep).round().clamp(0.0, 255.0) as u8;
        }
    }
}

/// `out = side × (1 − k) + opaque color × k` (linear interpolation on premultiplied values; a missing side is transparent).
fn lerp_to_colour(out: &mut Pixmap, side: Option<&Pixmap>, [r, g, b]: [u8; 3], k: f64) {
    let k = k.clamp(0.0, 1.0);
    out.fill(Color::TRANSPARENT);
    blit(out, side, 1.0, Transform::identity());
    let colour = [f64::from(r), f64::from(g), f64::from(b), 255.0];
    for px in out.data_mut().chunks_exact_mut(4) {
        for c in 0..4 {
            px[c] = (f64::from(px[c]) * (1.0 - k) + colour[c] * k).round().clamp(0.0, 255.0) as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opaque(w: u32, h: u32, rgba: [u8; 4]) -> Pixmap {
        let mut p = Pixmap::new(w, h).unwrap();
        p.fill(Color::from_rgba8(rgba[0], rgba[1], rgba[2], rgba[3]));
        p
    }

    fn px(p: &Pixmap, x: u32, y: u32) -> [u8; 4] {
        let i = ((y * p.width() + x) * 4) as usize;
        p.data()[i..i + 4].try_into().unwrap()
    }

    fn full(w: f64, h: f64) -> BoxGeom {
        BoxGeom {
            cx: w / 2.0,
            cy: h / 2.0,
            w,
            h,
            rotation: 0.0,
            flip_x: false,
            flip_y: false,
        }
    }

    #[test]
    fn wipe_reveals_from_the_box_left_and_follows_the_mirror() {
        let b = opaque(100, 10, [255, 0, 0, 255]);
        let mut out = Pixmap::new(100, 10).unwrap();
        compose("wipe", &Map::new(), None, Some(&b), Some(full(100.0, 10.0)), 0.3, &mut out);
        assert_eq!(px(&out, 10, 5)[3], 255);
        assert_eq!(px(&out, 50, 5)[3], 0);
        let mut out = Pixmap::new(100, 10).unwrap();
        let mirrored = BoxGeom {
            flip_x: true,
            ..full(100.0, 10.0)
        };
        compose("wipe", &Map::new(), None, Some(&b), Some(mirrored), 0.3, &mut out);
        assert_eq!(px(&out, 10, 5)[3], 0);
        assert_eq!(px(&out, 90, 5)[3], 255);
    }

    #[test]
    fn dip_to_colour_passes_through_the_colour_at_the_midpoint() {
        let a = opaque(4, 4, [255, 0, 0, 255]);
        let b = opaque(4, 4, [0, 0, 255, 255]);
        let mut params = Map::new();
        params.insert("color".into(), Value::String("#00FF00".into()));
        let mut out = Pixmap::new(4, 4).unwrap();
        compose("dip-to-color", &params, Some(&a), Some(&b), None, 0.5, &mut out);
        assert_eq!(px(&out, 1, 1), [0, 255, 0, 255]);
        compose("dip-to-color", &params, Some(&a), Some(&b), None, 0.0, &mut out);
        assert_eq!(px(&out, 1, 1), [255, 0, 0, 255]);
        compose("dip-to-color", &params, Some(&a), Some(&b), None, 1.0, &mut out);
        assert_eq!(px(&out, 1, 1), [0, 0, 255, 255]);
    }

    #[test]
    fn push_moves_both_sides_in_the_motion_direction() {
        let a = opaque(10, 2, [255, 0, 0, 255]);
        let b = opaque(10, 2, [0, 0, 255, 255]);
        let mut params = Map::new();
        params.insert("direction".into(), Value::String("left".into()));
        let mut out = Pixmap::new(10, 2).unwrap();
        compose("push", &params, Some(&a), Some(&b), None, 0.5, &mut out);
        assert_eq!(px(&out, 2, 0), [255, 0, 0, 255]);
        assert_eq!(px(&out, 7, 0), [0, 0, 255, 255]);
    }
}
