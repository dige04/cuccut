//! The **single source** of element geometry (ADR-E01).
//!
//! These numbers used to be written out in three places: `width*0.28` / `width*0.62` at `apps/mac/.../StageElementHost.swift:144`,
//! the same set of branches at `apps/gpui/src/adapters/stage_pose.rs:231-245`, and `element-geometry.js` in `skills/cuccut/templates/studio`.
//! The height formula is **part of the contract**: the selection frame, hit box on stage and exported pixels must be drawn in the same
//! box, so it can have only one source, and clients read it from here.
//!
//! Coordinate semantics follow `Place`: `x`/`y` are the centre point as a canvas percentage, `w` is the frame-width percentage, and
//! no second unit system is introduced. **The only exception** is the sound wave and progress bar of `aspect == Square`:
//! their `w%` measures the frame's **short edge** ([`width_basis`]) — see the explanation on that function.

use crate::schema::{ElementKind, Place, ShapeProps, StickerProps, Tile};

/// Default element width percentage (Mac `el.w ?? 20`).
pub const DEFAULT_ELEMENT_W: f64 = 20.0;
/// Default element centre percentage.
pub const DEFAULT_ELEMENT_X: f64 = 50.0;
pub const DEFAULT_ELEMENT_Y: f64 = 50.0;

/// Height/width ratio of a sticker with `template == "box"` (the `width*0.62` of the original `stage_pose.rs:240-243`).
pub const STICKER_BOX_HEIGHT_RATIO: f64 = 0.62;
/// Sticker template id: the only template not treated as square.
pub const STICKER_BOX_TEMPLATE: &str = "box";

/// Deterministic stamp centre points for tiled media/text.
///
/// Points are measured with the canvas centre as origin; the caller then applies element scale, rotation and animation displacement uniformly. The CPU strict path,
/// Web GPU and the native compositor must share this grid, and must not each cut their own set of points based on the visible area.
pub fn tile_stamp_points(
    frame_width: u32,
    frame_height: u32,
    stamp_width: u32,
    stamp_height: u32,
    tile: &Tile,
) -> Vec<(f64, f64)> {
    let frame_width = f64::from(frame_width);
    let frame_height = f64::from(frame_height);
    let step_x = f64::from(stamp_width) + frame_width * tile.gap_x.unwrap_or(8.0).max(2.0) / 100.0;
    let step_y =
        f64::from(stamp_height) + frame_height * tile.gap_y.unwrap_or(10.0).max(2.0) / 100.0;
    let diagonal = frame_width.hypot(frame_height);
    let mut points = Vec::new();
    let mut row = 0_i64;
    let mut y = -diagonal / 2.0;
    while y <= diagonal / 2.0 + step_y {
        let offset_x = if tile.stagger.unwrap_or(true) && row.rem_euclid(2) == 1 {
            step_x / 2.0
        } else {
            0.0
        };
        let mut x = -diagonal / 2.0 - step_x + offset_x;
        while x <= diagonal / 2.0 + step_x {
            points.push((x, y));
            x += step_x;
        }
        row += 1;
        y += step_y;
    }
    points
}

/// Default geometry for the visualizer horizontal-bar class (`1.0 × 0.2`, pinned to the bottom).
pub const VISUALIZER_BAR_W: f64 = 100.0;
pub const VISUALIZER_BAR_H: f64 = 20.0;
pub const VISUALIZER_BAR_Y: f64 = 85.0;
/// The visualizer circular class (`ring_bars` / `ring_wave` / `pulse_rings`) is **forced** to square, and the UI locks the ratio.
///
/// This percentage measures the **frame's short edge**, not the frame's width — see [`width_basis`].
pub const VISUALIZER_SQUARE_W: f64 = 30.0;

/// Default geometry for the progress horizontal-bar class (`normal` / `rounded`).
pub const PROGRESS_BAR_W: f64 = 80.0;
pub const PROGRESS_BAR_H: f64 = 5.0;
/// The progress circular class (`circle` / `donut` / `snake*`). It also measures the **frame's short edge**
/// ([`width_basis`]).
pub const PROGRESS_SQUARE_W: f64 = 30.0;
/// The progress `*border` class: fills the frame, following the canvas ratio.
pub const PROGRESS_FRAME_W: f64 = 100.0;
pub const PROGRESS_FRAME_H: f64 = 100.0;

/// The aspect ratio declared by a catalog-type recipe (recipe field `aspect`, ADR-E05 / §7.2).
///
/// P0 registered only the shape catalog; the visualizer / progress recipes enter the registry in P2.
/// Until then, callers pass `None`, and this module falls back to each class's horizontal-bar default.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementAspect {
    /// Free ratio (visualizer horizontal-bar class).
    Free,
    /// Forced square (visualizer / progress circular class).
    Square,
    /// Thin bar (progress `normal` / `rounded`).
    Bar,
    /// Fills the frame border (progress `*border`).
    Frame,
}

/// Default placement for a kind + aspect combination (frame percentages).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PlaceDefaults {
    /// Width (percentage of frame width).
    pub w: f64,
    /// Height (percentage of frame height); `None` = square (in pixels, take the width).
    pub h: Option<f64>,
    /// Centre y (percentage of frame height).
    pub y: f64,
}

/// The default geometry table of ADR-E01. New elements are filled with it to produce a `Place`, and the property panel uses it for "restore default".
pub fn default_place(kind: ElementKind, aspect: Option<ElementAspect>) -> PlaceDefaults {
    match kind {
        ElementKind::Visualizer => match aspect.unwrap_or(ElementAspect::Free) {
            // `h: None` = pixel square (height takes the width). **Not** `Some(30)`: on a
            // 16:9 frame that would be a 576×324 landscape box, while the recipe draws an inscribed square, so the selection frame and the drawn output would differ by a ring (round 213).
            ElementAspect::Square => PlaceDefaults {
                w: VISUALIZER_SQUARE_W,
                h: None,
                y: DEFAULT_ELEMENT_Y,
            },
            _ => PlaceDefaults {
                w: VISUALIZER_BAR_W,
                h: Some(VISUALIZER_BAR_H),
                y: VISUALIZER_BAR_Y,
            },
        },
        ElementKind::Progress => match aspect.unwrap_or(ElementAspect::Bar) {
            ElementAspect::Square => PlaceDefaults {
                w: PROGRESS_SQUARE_W,
                h: None,
                y: DEFAULT_ELEMENT_Y,
            },
            ElementAspect::Frame => PlaceDefaults {
                w: PROGRESS_FRAME_W,
                h: Some(PROGRESS_FRAME_H),
                y: DEFAULT_ELEMENT_Y,
            },
            _ => PlaceDefaults {
                w: PROGRESS_BAR_W,
                h: Some(PROGRESS_BAR_H),
                y: DEFAULT_ELEMENT_Y,
            },
        },
        ElementKind::Draw => PlaceDefaults {
            w: 100.0,
            h: Some(100.0),
            y: DEFAULT_ELEMENT_Y,
        },
        // Confetti fills the frame (aspect `frame`): particles are generated inside the box and clipped by it;
        // shrinking the place gives "a column of confetti" (design draft §3.1).
        ElementKind::Confetti => PlaceDefaults {
            w: PROGRESS_FRAME_W,
            h: Some(PROGRESS_FRAME_H),
            y: DEFAULT_ELEMENT_Y,
        },
        ElementKind::Placeholder => PlaceDefaults {
            w: 42.0,
            h: Some(24.0),
            y: DEFAULT_ELEMENT_Y,
        },
        _ => PlaceDefaults {
            w: DEFAULT_ELEMENT_W,
            h: None,
            y: DEFAULT_ELEMENT_Y,
        },
    }
}

/// Geometry input for one element: `kind` + **the one group of props for that kind**, the rest `None`
/// (the mutual-exclusion rule is in `element-props-mismatch` in `schema.rs`).
#[derive(Debug, Clone, Copy, Default)]
pub struct ElementGeometry<'a> {
    pub shape: Option<&'a ShapeProps>,
    pub sticker: Option<&'a StickerProps>,
    /// Aspect ratio of a visualizer / progress, from the `aspect` field of a catalog-type recipe.
    pub aspect: Option<ElementAspect>,
}

/// Element box width (pixels): `basis * w% * scale`.
///
/// `basis` is normally the frame width; the square variant must pass the short edge given by [`width_basis`].
pub fn element_width(place: Option<&Place>, frame_w: f64, scale: f64) -> f64 {
    let percent = place.and_then(|place| place.w).unwrap_or(DEFAULT_ELEMENT_W);
    frame_w * percent / 100.0 * scale
}

/// Whether this variant is a **pixel square** (the box height equals its width).
///
/// The criterion is `h == None` in the [`default_place`] table — no separate table is set up, otherwise
/// the two would eventually tell two different stories. Shape / sticker squares go through their own branches; this only recognises the three classes whose height is set by `aspect`.
pub fn is_pixel_square(kind: ElementKind, geometry: &ElementGeometry<'_>) -> bool {
    matches!(
        kind,
        ElementKind::Visualizer
            | ElementKind::Progress
            | ElementKind::Draw
            | ElementKind::Placeholder
    ) && default_place(kind, geometry.aspect).h.is_none()
}

/// Which edge (in pixels) the percentage `place.w` measures.
///
/// Normally the frame width. **Square variants measure the short edge**: if the size is stored as two canvas fractions `{width, height}`, the long-edge dimension of a square
/// `{0.3, 0.3}` must be scaled back by the canvas ratio, which on 16:9 gives `{0.16875, 0.3}` — that is, "30% of the short edge".
///
/// CucCut's `place` has only one size field, `w` (decision D2 does not add `h`), so this conversion cannot happen at **element creation** (that would require passing the canvas ratio all the way through `new_element` and the wasm interface,
/// and would also stretch the square flat after the canvas ratio changes). It is placed at the geometry-reading layer instead, so a square is always a square and does not skew when the resolution changes.
pub fn width_basis(kind: ElementKind, geometry: &ElementGeometry<'_>, frame: (f64, f64)) -> f64 {
    if is_pixel_square(kind, geometry) {
        frame.0.min(frame.1)
    } else {
        frame.0
    }
}

/// Element box height (pixels). **The only implementation**; all three ends read from here (ADR-E01 table).
///
/// - Shape: when `h` is given explicitly, use `frame_h * h/100 * scale`; by default it is square (= pixel width).
/// - Sticker: `template == "box"` uses `width * 0.62`; otherwise square.
///   The historical `type == "waveform"` (`width * 0.28`) is **deprecated**: the waveform has been moved out to a
///   standalone [`ElementKind::Visualizer`], and its height is now decided by the recipe's `aspect` (§5.4).
/// - Visualizer / Progress: there is no explicit `h` field; the height comes from the `aspect` default table,
///   in the same unit as the shape's `h` (percentage of frame height).
/// - Other kinds: square (following the fallback branch of Mac `elementHeight`).
pub fn element_height(
    kind: ElementKind,
    geometry: &ElementGeometry<'_>,
    frame_h: f64,
    width: f64,
    scale: f64,
) -> f64 {
    match kind {
        ElementKind::Shape => match geometry.shape.and_then(|shape| shape.h) {
            Some(percent) => frame_h * percent / 100.0 * scale,
            None => width,
        },
        ElementKind::Sticker => {
            let is_box = geometry.sticker.is_some_and(|sticker| {
                sticker.template_id.as_deref() == Some(STICKER_BOX_TEMPLATE)
            });
            if is_box {
                width * STICKER_BOX_HEIGHT_RATIO
            } else {
                width
            }
        }
        ElementKind::Visualizer
        | ElementKind::Progress
        | ElementKind::Draw
        | ElementKind::Placeholder
        | ElementKind::Confetti => match default_place(kind, geometry.aspect).h {
            Some(percent) => frame_h * percent / 100.0 * scale,
            None => width,
        },
        _ => width,
    }
}

/// The static box `(x, y, w, h)` of an element, with the top-left origin in pixel units. The stage selection frame, hit box and
/// export geometry all share this one function, to avoid "the ring drawn in one place, the pixels in another".
///
/// `place.scale_y` is the **vertical scale factor** (round 122 decision D2): there is no `place.h` field, and the height produced by four-edge scaling is always set here, with the formula `h = w% × aspect × scaleY` —
/// the `aspect` part is the "natural height" given by [`element_height`] above (already including `scale`), and `scale_y` multiplies once more.
/// When absent = 1 (not a fallback to `scale`: that would squash the element when `scale ≠ 1` if `scaleY = 1`, while the write-back path `stage_drag::place_resize` treats "left unchanged" as 1).
pub fn static_box(
    kind: ElementKind,
    geometry: &ElementGeometry<'_>,
    place: Option<&Place>,
    frame: (f64, f64),
) -> (f64, f64, f64, f64) {
    let scale = place.and_then(|place| place.scale).unwrap_or(1.0);
    let scale_y = place.and_then(|place| place.scale_y).unwrap_or(1.0);
    let width_percent = place
        .and_then(|place| place.w)
        .unwrap_or(default_place(kind, geometry.aspect).w);
    let width = width_basis(kind, geometry, frame) * width_percent / 100.0 * scale;
    let height = element_height(kind, geometry, frame.1, width, scale) * scale_y;
    let center_x = frame.0 * place.and_then(|place| place.x).unwrap_or(DEFAULT_ELEMENT_X) / 100.0;
    let center_y = frame.1
        * place
            .and_then(|place| place.y)
            .unwrap_or(default_place(kind, geometry.aspect).y)
        / 100.0;
    (
        center_x - width / 2.0,
        center_y - height / 2.0,
        width,
        height,
    )
}

/// Default media box width for image / video / placeholder / asset sticker (percentage of frame width; stickers and placeholders use their own tables).
pub const MEDIA_DEFAULT_W: f64 = 34.0;

/// Width (frame width %) used when a media box has no `place.w`: asset stickers follow the same square variant, placeholders take their default placement from their own default, and everything else is [`MEDIA_DEFAULT_W`].
pub fn media_default_w(kind: ElementKind) -> f64 {
    match kind {
        ElementKind::Sticker => DEFAULT_ELEMENT_W,
        ElementKind::Placeholder => default_place(kind, None).w,
        _ => MEDIA_DEFAULT_W,
    }
}

/// The box of an external media element (image / video / placeholder / asset sticker) on the canvas:
/// `(width, height, centre x, centre y)`, in pixels, not including `scale` / rotation / animation. **The only implementation**: the GPU texture scene (`ccut-timeline-render::media`) and the keyframe letterbox check both take it from here.
///
/// `fullscreen` = fill mode and no tiling: the box is the whole canvas, and `place.x/y/w` do not participate.
/// `natural` is the media's pixel size (the aspect ratio determines the height of the pip box).
pub fn media_box(
    kind: ElementKind,
    fullscreen: bool,
    place: &Place,
    natural: (f64, f64),
    canvas: (f64, f64),
) -> (f64, f64, f64, f64) {
    let (canvas_width, canvas_height) = canvas;
    if fullscreen {
        return (
            canvas_width,
            canvas_height,
            canvas_width / 2.0,
            canvas_height / 2.0,
        );
    }
    let width = canvas_width * place.w.unwrap_or(media_default_w(kind)).max(1.0) / 100.0;
    let height = if kind == ElementKind::Placeholder {
        canvas_height * default_place(kind, None).h.unwrap_or(24.0) / 100.0
    } else {
        width * natural.1 / natural.0
    };
    (
        width,
        height,
        canvas_width * place.x.unwrap_or(50.0) / 100.0,
        canvas_height * place.y.unwrap_or(50.0) / 100.0,
    )
}

/// For a media box transformed by `scale` / `scaleY` / `rot`: the maximum number of pixels by which it fails to cover the canvas,
/// i.e. the farthest distance from the canvas corners outside the box (measured in the box's local coordinates); `0` = fully covered.
pub fn media_box_uncovered_gap(
    place: &Place,
    media_box: (f64, f64, f64, f64),
    canvas: (f64, f64),
) -> f64 {
    let (width, height, center_x, center_y) = media_box;
    let scale = place.scale.unwrap_or(1.0);
    let half_w = (width * scale).abs() / 2.0;
    let half_h = (height * scale * place.scale_y.unwrap_or(1.0)).abs() / 2.0;
    let angle = place.rot.unwrap_or(0.0).to_radians();
    let (sin, cos) = angle.sin_cos();
    let mut gap: f64 = 0.0;
    for (corner_x, corner_y) in [
        (0.0, 0.0),
        (canvas.0, 0.0),
        (0.0, canvas.1),
        (canvas.0, canvas.1),
    ] {
        let dx = corner_x - center_x;
        let dy = corner_y - center_y;
        // Inverse-rotate into the box's local coordinates.
        let local_x = dx * cos + dy * sin;
        let local_y = -dx * sin + dy * cos;
        gap = gap.max(local_x.abs() - half_w).max(local_y.abs() - half_h);
    }
    gap.max(0.0)
}

/// `progress = clamp((t - start) / (end - start), 0, 1)` (ADR-E04).
///
/// A progress element **does not need** a `VisualSource`: its content is derived entirely from the playhead, making it a pure function.
pub fn progress_at(time: f64, start: f64, end: f64) -> f64 {
    if !(end > start) {
        return 0.0;
    }
    ((time - start) / (end - start)).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn place(w: Option<f64>, scale: Option<f64>) -> Place {
        Place {
            w,
            scale,
            ..Place::default()
        }
    }

    /// Line-by-line reference for the ADR-E01 height table. Changing this table means changing the contract.
    #[test]
    fn the_height_table_is_the_single_source_of_truth() {
        let frame_h = 1080.0;
        let square = ShapeProps::new("rect");
        let mut tall = ShapeProps::new("rect");
        tall.h = Some(25.0);
        let box_sticker = {
            let mut sticker = StickerProps::new("template");
            sticker.template_id = Some(STICKER_BOX_TEMPLATE.to_owned());
            sticker
        };
        let plain_sticker = StickerProps::new("asset");

        let cases: &[(ElementKind, ElementGeometry<'_>, f64, f64, f64)] = &[
            // kind, geometry, width, scale, expected height
            (
                ElementKind::Shape,
                ElementGeometry {
                    shape: Some(&square),
                    ..Default::default()
                },
                400.0,
                1.0,
                400.0,
            ),
            (
                ElementKind::Shape,
                ElementGeometry {
                    shape: Some(&tall),
                    ..Default::default()
                },
                400.0,
                2.0,
                1080.0 * 0.25 * 2.0,
            ),
            (
                ElementKind::Sticker,
                ElementGeometry {
                    sticker: Some(&box_sticker),
                    ..Default::default()
                },
                400.0,
                1.0,
                400.0 * STICKER_BOX_HEIGHT_RATIO,
            ),
            (
                ElementKind::Sticker,
                ElementGeometry {
                    sticker: Some(&plain_sticker),
                    ..Default::default()
                },
                400.0,
                1.0,
                400.0,
            ),
            (
                ElementKind::Visualizer,
                ElementGeometry::default(),
                400.0,
                1.0,
                1080.0 * 0.20,
            ),
            // Square variant: the height is **exactly the width already computed from the short edge**; the frame height is no longer multiplied.
            (
                ElementKind::Visualizer,
                ElementGeometry {
                    aspect: Some(ElementAspect::Square),
                    ..Default::default()
                },
                400.0,
                1.0,
                400.0,
            ),
            (
                ElementKind::Progress,
                ElementGeometry::default(),
                400.0,
                1.0,
                1080.0 * 0.05,
            ),
            (
                ElementKind::Progress,
                ElementGeometry {
                    aspect: Some(ElementAspect::Square),
                    ..Default::default()
                },
                400.0,
                1.0,
                400.0,
            ),
            (
                ElementKind::Progress,
                ElementGeometry {
                    aspect: Some(ElementAspect::Frame),
                    ..Default::default()
                },
                400.0,
                1.0,
                1080.0,
            ),
            (
                ElementKind::Image,
                ElementGeometry::default(),
                400.0,
                1.0,
                400.0,
            ),
        ];
        for (kind, geometry, width, scale, expected) in cases {
            assert_eq!(
                element_height(*kind, geometry, frame_h, *width, *scale),
                *expected,
                "{kind:?}"
            );
        }
    }

    /// The formula that the gpui and Mac versions each wrote before consolidation: width uses `w ?? 20`, and `scale` applies to both width and height.
    #[test]
    fn the_static_box_matches_the_two_client_formulas() {
        let frame = (1920.0, 1080.0);
        let props = ShapeProps::new("rect");
        let geometry = ElementGeometry {
            shape: Some(&props),
            ..Default::default()
        };
        let (x, y, w, h) = static_box(ElementKind::Shape, &geometry, None, frame);
        assert_eq!(w, 1920.0 * 20.0 / 100.0);
        assert_eq!(h, w);
        assert_eq!(x, 1920.0 / 2.0 - w / 2.0);
        assert_eq!(y, 1080.0 / 2.0 - h / 2.0);

        let scaled = place(Some(50.0), Some(2.0));
        let (_, _, w, h) = static_box(ElementKind::Shape, &geometry, Some(&scaled), frame);
        assert_eq!(w, 1920.0 * 0.5 * 2.0);
        assert_eq!(h, w);
    }

    /// Round 122 D2: `place.scaleY` changes only the height, not the width, and it is a multiplier **applied to the natural height**.
    #[test]
    fn scale_y_stretches_the_static_box_vertically_only() {
        let frame = (1920.0, 1080.0);
        let props = ShapeProps::new("rect");
        let geometry = ElementGeometry {
            shape: Some(&props),
            ..Default::default()
        };
        let stretched = Place {
            w: Some(50.0),
            scale: Some(2.0),
            scale_y: Some(1.6),
            ..Place::default()
        };
        let (_, y, w, h) = static_box(ElementKind::Shape, &geometry, Some(&stretched), frame);
        // Width unchanged: `scaleY` does not participate in the width path.
        assert_eq!(w, 1920.0 * 0.5 * 2.0);
        // Height = natural height (square = pixel width, already including scale) × scaleY.
        assert_eq!(h, w * 1.6);
        // The centre stays put; the box grows out to both sides from the centre.
        assert_eq!(y, 1080.0 / 2.0 - h / 2.0);

        // Absent = 1, not a fallback to `scale`.
        let plain = Place {
            w: Some(50.0),
            scale: Some(2.0),
            ..Place::default()
        };
        let (_, _, _, plain_h) = static_box(ElementKind::Shape, &geometry, Some(&plain), frame);
        assert_eq!(plain_h, w);
    }

    /// The visualizer horizontal bar is pinned to the bottom: the default y comes from the recipe's default table, not the vertical centre of the frame.
    #[test]
    fn the_visualizer_bar_defaults_to_the_bottom_of_the_frame() {
        let defaults = default_place(ElementKind::Visualizer, None);
        assert_eq!(
            (defaults.w, defaults.h, defaults.y),
            (100.0, Some(20.0), 85.0)
        );
        let (_, y, _, h) = static_box(
            ElementKind::Visualizer,
            &ElementGeometry::default(),
            None,
            (1920.0, 1080.0),
        );
        assert_eq!(h, 1080.0 * 0.2);
        assert_eq!(y, 1080.0 * 0.85 - h / 2.0);
    }

    /// Round 213: the box of a square variant must **be a pixel square**, and its side length is measured on the frame's short edge — measured once for a landscape frame and once for a portrait frame, the resulting side length is the same.
    #[test]
    fn the_square_aspect_box_is_a_true_pixel_square_on_the_short_side() {
        let geometry = ElementGeometry {
            aspect: Some(ElementAspect::Square),
            ..Default::default()
        };
        for frame in [(1920.0, 1080.0), (1080.0, 1920.0), (1080.0, 1080.0)] {
            let (x, y, w, h) = static_box(ElementKind::Visualizer, &geometry, None, frame);
            assert_eq!(w, h, "{frame:?} 不是正方");
            // Default side length of the square variant = 30% of the short edge.
            assert_eq!(w, frame.0.min(frame.1) * 0.30, "{frame:?} 边长");
            assert_eq!(x, frame.0 / 2.0 - w / 2.0);
            assert_eq!(y, frame.1 / 2.0 - h / 2.0);
        }
        // The horizontal-bar variant does not follow this: it still measures the frame width.
        let (_, _, w, h) = static_box(
            ElementKind::Visualizer,
            &ElementGeometry::default(),
            None,
            (1920.0, 1080.0),
        );
        assert_eq!(w, 1920.0);
        assert_eq!(h, 1080.0 * 0.2);
    }

    #[test]
    fn progress_is_clamped_and_degenerate_spans_read_zero() {
        assert_eq!(progress_at(2.0, 2.0, 6.0), 0.0);
        assert_eq!(progress_at(4.0, 2.0, 6.0), 0.5);
        assert_eq!(progress_at(9.0, 2.0, 6.0), 1.0);
        assert_eq!(progress_at(-1.0, 2.0, 6.0), 0.0);
        assert_eq!(progress_at(4.0, 6.0, 6.0), 0.0);
    }
}
