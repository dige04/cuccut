//! **Pure geometry → DrawOp assembly** for Timeline elements.
//!
//! This deliberately depends on only three things: the instruction types of `render_raster::drawop`, the catalog-style recipes of `motion::preset_registry`, and the contract and geometry of `timeline`. It has no filesystem, no ffmpeg, and no I/O types from `apps/cli`. The code was placed where it can move down from the first line written in P0, and in P6a it was moved into this crate unchanged (`git mv`, function bodies not touched by a single character).
//!
//! Coordinate convention: path points are **absolute canvas pixels**. `tf` carries only the "rotation / mirror / animation pose around the element box center". The element box itself comes from `timeline::static_box`, the same function that gives the stage selection box and hit box, so the selection outline drawn in one place and the pixels drawn in another can no longer happen.

use motion::preset_registry::{CatalogueRecipe, ShapeHead, ShapeParam, ShapePath};
use render_raster::drawop::{Color4, DrawOp, FrameBuilder, Mat6, PaintData, PathData, PathSeg};
use timeline::effects::REFERENCE_SHORT_EDGE;
use timeline::schema::{
    DrawBrush, DrawProps, Place, PlaceholderProps, PlaceholderVariant, ShapeProps, StickerProps,
};

/// Element box (canvas pixels, top-left origin).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ElementBox {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl ElementBox {
    pub fn center(&self) -> (f64, f64) {
        (self.x + self.w / 2.0, self.y + self.h / 2.0)
    }
}

/// The element's pose input. Fields map one-to-one to the same-named channels of `timeline::AnimationPose`. It is a separate struct so this module does not depend on animation evaluation, which leaves one fewer edge when it moves down.
#[derive(Debug, Clone, Copy, Default)]
pub struct ElementPose {
    /// Translation as a ratio of the canvas short edge (same basis as media elements).
    pub dx: f64,
    pub dy: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub rotation: f64,
}

impl ElementPose {
    /// An element with no animation. The host's default input.
    pub const IDENTITY: Self = Self {
        dx: 0.0,
        dy: 0.0,
        scale_x: 1.0,
        scale_y: 1.0,
        rotation: 0.0,
    };
}

/// Affine transform around the element box center: mirror → pose scale → rotation → translation.
///
/// `place.scale` **does not go here**. It is already baked into the element box size (`static_box`), and multiplying it again would be double scaling. The stage selection box would then no longer match the pixels.
pub fn element_transform(
    place: &Place,
    pose: &ElementPose,
    bbox: ElementBox,
    canvas: (f64, f64),
) -> Mat6 {
    let (center_x, center_y) = bbox.center();
    let (flip_x, flip_y) = place.flip_signs();
    let short = canvas.0.min(canvas.1);
    let scale_x = flip_x * pose.scale_x;
    let scale_y = flip_y * pose.scale_y;
    let radians = (place.rot.unwrap_or(0.0) + pose.rotation).to_radians();
    let (sin, cos) = radians.sin_cos();
    // Composition order: T(-c) · S · R · T(c + d), the same order as `from_translate(...).post_scale(...).post_rotate(...).post_translate(...)` in `render_media_element`.
    let a = scale_x * cos;
    let b = scale_x * sin;
    let c = -scale_y * sin;
    let d = scale_y * cos;
    let tx = center_x + pose.dx * short - (center_x * a + center_y * c);
    let ty = center_y + pose.dy * short - (center_x * b + center_y * d);
    [a as f32, b as f32, c as f32, d as f32, tx as f32, ty as f32]
}

/// `#RRGGBB` / `#RRGGBBAA` → non-premultiplied RGBA 0..1. The format is already enforced at the schema layer (`validate_color`), so the `None` here appears only when the contract has been bypassed.
pub fn parse_color(color: &str, opacity: f64) -> Option<Color4> {
    let hex = color.strip_prefix('#')?;
    if !matches!(hex.len(), 6 | 8) {
        return None;
    }
    let channel = |index: usize| -> Option<f32> {
        u8::from_str_radix(hex.get(index * 2..index * 2 + 2)?, 16)
            .ok()
            .map(|value| f32::from(value) / 255.0)
    };
    let alpha = if hex.len() == 8 { channel(3)? } else { 1.0 };
    Some([
        channel(0)?,
        channel(1)?,
        channel(2)?,
        alpha * opacity.clamp(0.0, 1.0) as f32,
    ])
}

/// Stroke width conversion: `ShapeProps.strokeWidth` is **pixels on the reference short edge of 540**. It matches the length basis of `lower_element_effects`, so 4K export does not degrade into hairlines.
fn stroke_pixels(props: &ShapeProps, short_edge: f64) -> f64 {
    props.stroke_width() * short_edge / REFERENCE_SHORT_EDGE
}

/// Draws a shape element as `FillRect` / `FillPath` / `StrokePath`.
///
/// The shape definition comes from catalog-style recipes (ADR-E05). Colors and endpoints come from `ShapeProps`. Parameters the recipe declares unsupported are never read, because `params` is a closed vocabulary.
pub fn push_shape_ops(
    builder: &mut FrameBuilder,
    recipe: &CatalogueRecipe,
    props: &ShapeProps,
    bbox: ElementBox,
    tf: Mat6,
    opacity: f64,
    short_edge: f64,
) -> usize {
    let Some(body) = recipe.shape() else {
        return 0;
    };
    let fill = body
        .supports(ShapeParam::Fill)
        .then(|| props.fill.as_deref())
        .flatten()
        .and_then(|color| parse_color(color, opacity));
    let stroke = body
        .supports(ShapeParam::Stroke)
        .then(|| props.stroke.as_deref())
        .flatten()
        .and_then(|color| parse_color(color, opacity));
    let stroke_width = stroke_pixels(props, short_edge);
    let before = builder.frame.ops.len();

    match &body.path {
        ShapePath::Rect => {
            let radius = if body.supports(ShapeParam::CornerRadius) {
                scaled_corner_radius(props, bbox, short_edge)
            } else {
                [0.0; 4]
            };
            let uniform = radius.iter().all(|value| *value == radius[0]);
            if uniform {
                // When all four corners are the same, use `FillRect`. It is the native instruction for rounded rectangles, and splitting it into a path would only add a path side table to the fingerprint.
                if let Some(color) = fill {
                    builder.push(DrawOp::FillRect {
                        x: bbox.x as f32,
                        y: bbox.y as f32,
                        w: bbox.w as f32,
                        h: bbox.h as f32,
                        radius: radius[0] as f32,
                        color,
                        tf,
                    });
                }
                if let Some(color) = stroke.filter(|_| stroke_width > 0.0) {
                    let path = builder.path_id(rounded_rect_path(bbox, radius));
                    builder.push(DrawOp::StrokePath {
                        path,
                        color,
                        width: stroke_width as f32,
                        tf,
                    });
                }
            } else {
                let path = builder.path_id(rounded_rect_path(bbox, radius));
                if let Some(color) = fill {
                    builder.push(DrawOp::FillPath { path, color, tf });
                }
                if let Some(color) = stroke.filter(|_| stroke_width > 0.0) {
                    builder.push(DrawOp::StrokePath {
                        path,
                        color,
                        width: stroke_width as f32,
                        tf,
                    });
                }
            }
        }
        ShapePath::Ellipse => {
            let path = builder.path_id(ellipse_path(bbox));
            if let Some(color) = fill {
                builder.push(DrawOp::FillPath { path, color, tf });
            }
            if let Some(color) = stroke.filter(|_| stroke_width > 0.0) {
                builder.push(DrawOp::StrokePath {
                    path,
                    color,
                    width: stroke_width as f32,
                    tf,
                });
            }
        }
        ShapePath::Segment { default_head } => {
            let [x1, y1, x2, y2] = props.endpoints();
            let start = (bbox.x + bbox.w * x1 / 100.0, bbox.y + bbox.h * y1 / 100.0);
            let end = (bbox.x + bbox.w * x2 / 100.0, bbox.y + bbox.h * y2 / 100.0);
            // Line-type shapes have no fill. When `stroke` is absent, fall back to `fill`, so an element where only one color is set can still be drawn.
            let color = stroke
                .or(fill)
                .or_else(|| parse_color("#ffffff", opacity))
                .unwrap_or([1.0, 1.0, 1.0, opacity as f32]);
            if stroke_width > 0.0 {
                let path = builder.path_id(PathData(vec![
                    PathSeg {
                        verb: 0,
                        pts: [start.0 as f32, start.1 as f32, 0.0, 0.0, 0.0, 0.0],
                    },
                    PathSeg {
                        verb: 1,
                        pts: [end.0 as f32, end.1 as f32, 0.0, 0.0, 0.0, 0.0],
                    },
                ]));
                builder.push(DrawOp::StrokePath {
                    path,
                    color,
                    width: stroke_width as f32,
                    tf,
                });
            }
            let head = if body.supports(ShapeParam::Head) {
                props
                    .head
                    .as_deref()
                    .and_then(ShapeHead::parse)
                    .unwrap_or(*default_head)
            } else {
                *default_head
            };
            if head == ShapeHead::Arrow
                && let Some(path) = arrow_head_path(start, end, stroke_width)
            {
                let path = builder.path_id(path);
                builder.push(DrawOp::FillPath { path, color, tf });
            }
        }
        ShapePath::Outline { segments } => {
            let path = builder.path_id(outline_path(segments, bbox));
            if let Some(color) = fill {
                builder.push(DrawOp::FillPath { path, color, tf });
            }
            if let Some(color) = stroke.filter(|_| stroke_width > 0.0) {
                builder.push(DrawOp::StrokePath {
                    path,
                    color,
                    width: stroke_width as f32,
                    tf,
                });
            }
        }
    }
    builder.frame.ops.len() - before
}

/// Draws a template sticker as a stack of `FillPath` / `StrokePath`.
///
/// **Why paths are emitted directly instead of handing the SVG to resvg** (one of the two options in design §10 P7):
///
/// 1. **resvg sits behind `ccut-render/media`, and the wasm side does not have it** (P6a's feature matrix). Going through resvg would make template stickers into elements that only the CLI can draw. The studio's wasm overlay would then report `host_rasterized_elements` for every sticker, which breaks the "preview = export" guarantee just set up in P6b for any project with stickers. Going through paths needs no new dependency, and both sides share this function.
/// 2. **Determinism.** SVG is a language with filters, gradients, text and font fallback, and its rasterized result is not something `strict` can promise. The verb set here (move/line/quad/cubic/close) is validated at registry-parse time, so only tiny-skia is left.
/// 3. **Resolution independence.** resvg either rasterizes at its natural size (blurry at 4K), or the target size has to be threaded all the way into resource decoding. Paths land directly on element-box pixels, so 4K and 540p are equally sharp.
/// 4. **No new code.** P7a's `outline_path` and the parse-time validation are reused unchanged.
///
/// Returns the number of instructions emitted (0 = nothing drawn).
fn sticker_color<'a>(props: &'a StickerProps, source: &'a str) -> &'a str {
    props
        .fill_overrides
        .get(source)
        .or_else(|| {
            props
                .fill_overrides
                .iter()
                .find(|(candidate, _)| candidate.eq_ignore_ascii_case(source))
                .map(|(_, target)| target)
        })
        .map(String::as_str)
        .unwrap_or(source)
}

pub fn push_sticker_ops(
    builder: &mut FrameBuilder,
    recipe: &CatalogueRecipe,
    props: &StickerProps,
    bbox: ElementBox,
    tf: Mat6,
    opacity: f64,
) -> usize {
    let Some(body) = recipe.sticker() else {
        return 0;
    };
    let before = builder.frame.ops.len();
    // Stroke width is a ratio of the **element box short edge**: double the sticker's size and its outline gets twice as thick. This is deliberately different from shapes, which follow the canvas short edge. The reason is in `StickerLayer::stroke_width`.
    let short_edge = bbox.w.min(bbox.h);
    for layer in &body.layers {
        let path = builder.path_id(outline_path(&layer.segments, bbox));
        if let Some(color) = layer
            .fill
            .as_deref()
            .map(|color| sticker_color(props, color))
            .and_then(|color| parse_color(color, opacity))
        {
            builder.push(DrawOp::FillPath { path, color, tf });
        }
        let width = layer.stroke_width * short_edge;
        if width > 0.0
            && let Some(color) = layer
                .stroke
                .as_deref()
                .map(|color| sticker_color(props, color))
                .and_then(|color| parse_color(color, opacity))
        {
            builder.push(DrawOp::StrokePath {
                path,
                color,
                width: width as f32,
                tf,
            });
        }
    }
    builder.frame.ops.len() - before
}

/// The visualizer / progress placeholder before P3: a semi-transparent solid block inside the element box.
/// Deliberately **not** left empty. Leaving it empty would make "the waveform I added didn't draw" and "this stage isn't implemented yet" indistinguishable on screen.
pub fn push_placeholder_ops(builder: &mut FrameBuilder, bbox: ElementBox, tf: Mat6, color: Color4) {
    builder.push(DrawOp::FillRect {
        x: bbox.x as f32,
        y: bbox.y as f32,
        w: bbox.w as f32,
        h: bbox.h as f32,
        radius: 0.0,
        color,
        tf,
    });
}

/// Freehand drawing layer: normalized points → quadratic Bézier midpoint smoothing → DrawOp v4 stroke.
pub fn push_draw_ops(
    builder: &mut FrameBuilder,
    props: &DrawProps,
    bbox: ElementBox,
    tf: Mat6,
    opacity: f64,
    short_edge: f64,
) -> usize {
    let alpha = opacity * props.alpha.unwrap_or(1.0);
    let Some(color) = parse_color(&props.color, alpha) else {
        return 0;
    };
    let width = props.size * short_edge / REFERENCE_SHORT_EDGE;
    if width <= 0.0 {
        return 0;
    }
    let before = builder.frame.ops.len();
    for stroke in &props.strokes {
        let Some(first) = stroke.points.first() else {
            continue;
        };
        let point = |point: &[f64; 2]| {
            (
                bbox.x + bbox.w * point[0] / 100.0,
                bbox.y + bbox.h * point[1] / 100.0,
            )
        };
        let (first_x, first_y) = point(first);
        let mut segments = vec![move_to(first_x, first_y)];
        if stroke.points.len() == 1 {
            segments.push(line_to(first_x, first_y));
        } else {
            for index in 1..stroke.points.len().saturating_sub(1) {
                let control = point(&stroke.points[index]);
                let next = point(&stroke.points[index + 1]);
                segments.push(seg(
                    2,
                    [
                        control.0,
                        control.1,
                        (control.0 + next.0) / 2.0,
                        (control.1 + next.1) / 2.0,
                        0.0,
                        0.0,
                    ],
                ));
            }
            let last = point(stroke.points.last().expect("非空笔迹"));
            segments.push(line_to(last.0, last.1));
        }
        let path = builder.path_id(PathData(segments));
        match props.brush {
            DrawBrush::Round => builder.push(DrawOp::StrokePath {
                path,
                color,
                width: width as f32,
                tf,
            }),
            DrawBrush::Sliced => {
                let paint = builder.paint_id(PaintData::Solid(color));
                builder.push(DrawOp::StrokePathPaint {
                    path,
                    paint,
                    width: width as f32,
                    cap: 0,
                    join: 0,
                    miter: 4.0,
                    tf,
                });
            }
        }
    }
    builder.frame.ops.len() - before
}

/// Placeholder box for an asset that has not been replaced. The color belongs to the video picture content, not the App chrome.
pub fn push_media_placeholder_ops(
    builder: &mut FrameBuilder,
    props: &PlaceholderProps,
    bbox: ElementBox,
    tf: Mat6,
    opacity: f64,
) -> usize {
    let before = builder.frame.ops.len();
    let fill = [0.105, 0.118, 0.145, (0.94 * opacity) as f32];
    let stroke = [0.62, 0.67, 0.76, (0.9 * opacity) as f32];
    builder.push(DrawOp::FillRect {
        x: bbox.x as f32,
        y: bbox.y as f32,
        w: bbox.w as f32,
        h: bbox.h as f32,
        radius: (bbox.w.min(bbox.h) * 0.045) as f32,
        color: fill,
        tf,
    });
    let border = builder.path_id(rounded_rect_path(bbox, [bbox.w.min(bbox.h) * 0.045; 4]));
    builder.push(DrawOp::StrokePath {
        path: border,
        color: stroke,
        width: (bbox.w.min(bbox.h) * 0.012).max(1.0) as f32,
        tf,
    });
    let (cx, cy) = bbox.center();
    let icon_w = bbox.w * 0.16;
    let icon_h = bbox.h * 0.28;
    match props.variant {
        PlaceholderVariant::Camera => {
            builder.push(DrawOp::FillRect {
                x: (cx - icon_w / 2.0) as f32,
                y: (cy - icon_h / 2.0) as f32,
                w: icon_w as f32,
                h: icon_h as f32,
                radius: (icon_h * 0.18) as f32,
                color: stroke,
                tf,
            });
        }
        PlaceholderVariant::Media => {
            let diamond = builder.path_id(PathData(vec![
                move_to(cx, cy - icon_h / 2.0),
                line_to(cx + icon_w / 2.0, cy),
                line_to(cx, cy + icon_h / 2.0),
                line_to(cx - icon_w / 2.0, cy),
                close(),
            ]));
            builder.push(DrawOp::FillPath {
                path: diamond,
                color: stroke,
                tf,
            });
        }
        PlaceholderVariant::Screen => {
            builder.push(DrawOp::FillRect {
                x: (cx - icon_w / 2.0) as f32,
                y: (cy - icon_h / 2.0) as f32,
                w: icon_w as f32,
                h: icon_h as f32,
                radius: (icon_h * 0.08) as f32,
                color: stroke,
                tf,
            });
            builder.push(DrawOp::FillRect {
                x: (cx - icon_w * 0.2) as f32,
                y: (cy + icon_h * 0.62) as f32,
                w: (icon_w * 0.4) as f32,
                h: (icon_h * 0.08).max(1.0) as f32,
                radius: 0.0,
                color: stroke,
                tf,
            });
        }
    }
    builder.frame.ops.len() - before
}

/// Corner radius: `ShapeProps.cornerRadius` uses the same basis as `strokeWidth`, namely **pixels on the reference short edge of 540**. It is clamped to within half the box's side length, so adjacent corners cannot eat each other.
///
/// If it did not follow the canvas, the look would vary with resolution, such as rounded corners at 1080p and almost square corners at 4K.
fn scaled_corner_radius(props: &ShapeProps, bbox: ElementBox, short_edge: f64) -> [f64; 4] {
    let limit = (bbox.w.min(bbox.h) / 2.0).max(0.0);
    props
        .corner_radius()
        .map(|value| (value * short_edge / REFERENCE_SHORT_EDGE).clamp(0.0, limit))
}

const KAPPA: f64 = 0.552_284_749_830_793_6;

fn seg(verb: u8, pts: [f64; 6]) -> PathSeg {
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

fn move_to(x: f64, y: f64) -> PathSeg {
    seg(0, [x, y, 0.0, 0.0, 0.0, 0.0])
}

fn line_to(x: f64, y: f64) -> PathSeg {
    seg(1, [x, y, 0.0, 0.0, 0.0, 0.0])
}

fn cubic_to(c1: (f64, f64), c2: (f64, f64), to: (f64, f64)) -> PathSeg {
    seg(3, [c1.0, c1.1, c2.0, c2.1, to.0, to.1])
}

fn close() -> PathSeg {
    seg(4, [0.0; 6])
}

/// Rounded rectangle with independent corners (clockwise, starting where the top-left corner arc ends).
fn rounded_rect_path(bbox: ElementBox, radius: [f64; 4]) -> PathData {
    let ElementBox { x, y, w, h } = bbox;
    let [tl, tr, br, bl] = radius;
    let mut out = Vec::with_capacity(9);
    out.push(move_to(x + tl, y));
    out.push(line_to(x + w - tr, y));
    if tr > 0.0 {
        out.push(cubic_to(
            (x + w - tr + KAPPA * tr, y),
            (x + w, y + tr - KAPPA * tr),
            (x + w, y + tr),
        ));
    }
    out.push(line_to(x + w, y + h - br));
    if br > 0.0 {
        out.push(cubic_to(
            (x + w, y + h - br + KAPPA * br),
            (x + w - br + KAPPA * br, y + h),
            (x + w - br, y + h),
        ));
    }
    out.push(line_to(x + bl, y + h));
    if bl > 0.0 {
        out.push(cubic_to(
            (x + bl - KAPPA * bl, y + h),
            (x, y + h - bl + KAPPA * bl),
            (x, y + h - bl),
        ));
    }
    out.push(line_to(x, y + tl));
    if tl > 0.0 {
        out.push(cubic_to(
            (x, y + tl - KAPPA * tl),
            (x + tl - KAPPA * tl, y),
            (x + tl, y),
        ));
    }
    out.push(close());
    PathData(out)
}

/// The ellipse inscribed in the element box (four cubic Bézier segments).
fn ellipse_path(bbox: ElementBox) -> PathData {
    let (cx, cy) = bbox.center();
    let (rx, ry) = (bbox.w / 2.0, bbox.h / 2.0);
    let (kx, ky) = (KAPPA * rx, KAPPA * ry);
    PathData(vec![
        move_to(cx, cy - ry),
        cubic_to((cx + kx, cy - ry), (cx + rx, cy - ky), (cx + rx, cy)),
        cubic_to((cx + rx, cy + ky), (cx + kx, cy + ry), (cx, cy + ry)),
        cubic_to((cx - kx, cy + ry), (cx - rx, cy + ky), (cx - rx, cy)),
        cubic_to((cx - rx, cy - ky), (cx - kx, cy - ry), (cx, cy - ry)),
        close(),
    ])
}

/// Arrowhead: an isosceles triangle whose axis follows the line direction. Its size follows the stroke width.
fn arrow_head_path(start: (f64, f64), end: (f64, f64), stroke_width: f64) -> Option<PathData> {
    let (dx, dy) = (end.0 - start.0, end.1 - start.1);
    let length = dx.hypot(dy);
    if length <= f64::EPSILON || stroke_width <= 0.0 {
        return None;
    }
    let (ux, uy) = (dx / length, dy / length);
    let head = (stroke_width * 4.0).min(length);
    let half = head / 2.0;
    let base = (end.0 - ux * head, end.1 - uy * head);
    Some(PathData(vec![
        move_to(end.0, end.1),
        line_to(base.0 - uy * half, base.1 + ux * half),
        line_to(base.0 + uy * half, base.1 - ux * half),
        close(),
    ]))
}

/// Normalized outline (0..1) → canvas pixels inside the element box.
fn outline_path(segments: &[motion::preset_registry::PathSegment], bbox: ElementBox) -> PathData {
    use motion::preset_registry::PathSegment as S;
    let map = |point: [f64; 2]| (bbox.x + bbox.w * point[0], bbox.y + bbox.h * point[1]);
    PathData(
        segments
            .iter()
            .map(|segment| match segment {
                S::Move(point) => {
                    let (x, y) = map(*point);
                    move_to(x, y)
                }
                S::Line(point) => {
                    let (x, y) = map(*point);
                    line_to(x, y)
                }
                S::Quad(control, point) => {
                    let (cx, cy) = map(*control);
                    let (x, y) = map(*point);
                    seg(2, [cx, cy, x, y, 0.0, 0.0])
                }
                S::Cubic(c1, c2, point) => cubic_to(map(*c1), map(*c2), map(*point)),
                S::Close => close(),
            })
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use motion::preset_registry::timeline_shape;

    fn bbox() -> ElementBox {
        ElementBox {
            x: 100.0,
            y: 50.0,
            w: 400.0,
            h: 200.0,
        }
    }

    #[test]
    fn colors_parse_both_hex_lengths_and_fold_in_opacity() {
        assert_eq!(
            parse_color("#ff8000", 1.0),
            Some([1.0, 0.5019608, 0.0, 1.0])
        );
        assert_eq!(parse_color("#00000080", 1.0).unwrap()[3], 128.0 / 255.0);
        assert_eq!(parse_color("#ffffff", 0.5), Some([1.0, 1.0, 1.0, 0.5]));
        assert!(parse_color("red", 1.0).is_none());
        assert!(parse_color("#fff", 1.0).is_none());
    }

    /// Identity pose with no rotation is the identity matrix. An element without mirror or rotation should not change its pixels just because it went through a transform, since resampling would change the bytes.
    #[test]
    fn an_unposed_element_gets_the_identity_transform() {
        let tf = element_transform(
            &Place::default(),
            &ElementPose::IDENTITY,
            bbox(),
            (1920.0, 1080.0),
        );
        assert_eq!(tf, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
    }

    /// Mirror about the box center. The center stays put, and left and right swap.
    #[test]
    fn flip_x_mirrors_around_the_box_center() {
        let place = Place {
            flip_x: Some(true),
            ..Place::default()
        };
        let tf = element_transform(&place, &ElementPose::IDENTITY, bbox(), (1920.0, 1080.0));
        let apply = |x: f64, y: f64| {
            (
                f64::from(tf[0]) * x + f64::from(tf[2]) * y + f64::from(tf[4]),
                f64::from(tf[1]) * x + f64::from(tf[3]) * y + f64::from(tf[5]),
            )
        };
        let (cx, cy) = bbox().center();
        assert_eq!(apply(cx, cy), (cx, cy));
        assert_eq!(apply(bbox().x, cy), (bbox().x + bbox().w, cy));
    }

    #[test]
    fn a_uniform_rounded_rect_uses_the_native_fill_rect_op() {
        let mut builder = FrameBuilder::default();
        let mut props = ShapeProps::new("rect");
        props.fill = Some("#ff0000".to_owned());
        props.corner_radius = Some([12.0; 4]);
        let pushed = push_shape_ops(
            &mut builder,
            timeline_shape("rect").unwrap(),
            &props,
            bbox(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            1.0,
            540.0,
        );
        assert_eq!(pushed, 1);
        assert!(matches!(
            builder.frame.ops[0],
            DrawOp::FillRect { radius: 12.0, .. }
        ));
        assert!(builder.frame.paths.is_empty(), "圆角矩形不该建 path 侧表");
    }

    #[test]
    fn a_non_uniform_rounded_rect_falls_back_to_a_path() {
        let mut builder = FrameBuilder::default();
        let mut props = ShapeProps::new("rect");
        props.fill = Some("#ff0000".to_owned());
        props.corner_radius = Some([0.0, 20.0, 0.0, 20.0]);
        push_shape_ops(
            &mut builder,
            timeline_shape("rect").unwrap(),
            &props,
            bbox(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            1.0,
            540.0,
        );
        assert!(matches!(builder.frame.ops[0], DrawOp::FillPath { .. }));
        assert_eq!(builder.frame.paths.len(), 1);
    }

    /// Radius clamped to within half the side length, so adjacent corners cannot eat each other.
    #[test]
    fn the_corner_radius_is_clamped_to_half_the_short_side() {
        let mut props = ShapeProps::new("rect");
        props.corner_radius = Some([999.0; 4]);
        assert_eq!(
            scaled_corner_radius(&props, bbox(), REFERENCE_SHORT_EDGE),
            [100.0; 4]
        );
        // The radius follows the canvas short edge, so a 12 at 4K does not degrade into almost square.
        let mut small = ShapeProps::new("rect");
        small.corner_radius = Some([12.0; 4]);
        assert_eq!(
            scaled_corner_radius(&small, bbox(), REFERENCE_SHORT_EDGE * 2.0),
            [24.0; 4]
        );
    }

    #[test]
    fn the_ellipse_recipe_ignores_the_corner_radius_param() {
        let mut builder = FrameBuilder::default();
        let mut props = ShapeProps::new("ellipse");
        props.fill = Some("#00ff00".to_owned());
        props.corner_radius = Some([40.0; 4]);
        push_shape_ops(
            &mut builder,
            timeline_shape("ellipse").unwrap(),
            &props,
            bbox(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            1.0,
            540.0,
        );
        assert_eq!(builder.frame.paths.len(), 1);
        // 4 cubic Bézier segments + move + close
        assert_eq!(builder.frame.paths[0].0.len(), 6);
    }

    #[test]
    fn the_line_recipe_strokes_and_the_arrow_recipe_adds_a_head() {
        let mut props = ShapeProps::new("line");
        props.stroke = Some("#ffffff".to_owned());
        let mut builder = FrameBuilder::default();
        push_shape_ops(
            &mut builder,
            timeline_shape("line").unwrap(),
            &props,
            bbox(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            1.0,
            540.0,
        );
        assert_eq!(builder.frame.ops.len(), 1);
        assert!(matches!(builder.frame.ops[0], DrawOp::StrokePath { .. }));

        let mut props = ShapeProps::new("arrow");
        props.stroke = Some("#ffffff".to_owned());
        let mut builder = FrameBuilder::default();
        push_shape_ops(
            &mut builder,
            timeline_shape("arrow").unwrap(),
            &props,
            bbox(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            1.0,
            540.0,
        );
        assert_eq!(builder.frame.ops.len(), 2);
        assert!(matches!(builder.frame.ops[1], DrawOp::FillPath { .. }));

        // `head: "none"` turns the arrowhead off.
        props.head = Some("none".to_owned());
        let mut builder = FrameBuilder::default();
        push_shape_ops(
            &mut builder,
            timeline_shape("arrow").unwrap(),
            &props,
            bbox(),
            [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            1.0,
            540.0,
        );
        assert_eq!(builder.frame.ops.len(), 1);
    }

    /// The stroke width follows the canvas short edge, so 4K export does not degrade into hairlines.
    #[test]
    fn the_stroke_width_scales_with_the_canvas_short_edge() {
        let props = ShapeProps::new("line");
        assert_eq!(stroke_pixels(&props, REFERENCE_SHORT_EDGE), 2.0);
        assert_eq!(stroke_pixels(&props, REFERENCE_SHORT_EDGE * 2.0), 4.0);
    }
}
