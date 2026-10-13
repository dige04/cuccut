//! Lottie layer tree → DrawOp.
//!
//! **Emit primitives directly, without rasterizing first** (ADR-M11). Shape, stroke and gradient land in `FillPathPaint` and
//! `StrokePathPaint`. Layer opacity and blend land in `PushLayer`. Masks and track mattes land in `ClipPath` or `PushMatte`/`PopMatte`. This way Lottie and BCF's own elements share one command
//! stream, one frame fingerprint and one still-frame cache. Vector content also scales with the element box, instead of being rasterized first at the source size and then stretched and blurred.
//!
//! Time is always the **composition frame number** (f64). Layer visibility is checked against the parent composition frame using `ip` and `op`. A layer's own properties are evaluated at
//! `compFrame − st`. The internal frames of a precomposition are then divided by `sr`, or go through time remapping.
//! This follows lottie-web's convention. rlottie also spreads `sr` across ordinary layers, but this implementation follows lottie-web because it is the de facto reference implementation.

use super::geometry::{self, Affine, Contour, ShapePath};
use super::schema::{Animation, Gradient, Layer, LayerKind, ShapeItem, StrokeStyle, color_at};
use crate::drawop::{DrawOp, FrameBuilder, GradientStop, PaintData};
use anyhow::{Result, bail};
use motion::effect::BlendMode;
use std::collections::BTreeMap;

/// Context for one recording.
pub struct Lowering<'a> {
    doc: &'a Animation,
    /// Maps a Lottie image asset id to the asset name in the string side table of DrawOp.
    images: &'a BTreeMap<String, String>,
    /// Upper limit on precomposition recursion depth. Assets that reference each other would recurse forever, so they are rejected here.
    depth: usize,
}

const MAX_PRECOMP_DEPTH: usize = 16;

impl<'a> Lowering<'a> {
    pub fn new(doc: &'a Animation, images: &'a BTreeMap<String, String>) -> Lowering<'a> {
        Lowering {
            doc,
            images,
            depth: 0,
        }
    }

    /// Records the instructions for the whole animation at `frame` (a composition frame number). `tf` places the composition coordinate system onto the canvas.
    pub fn record(&self, frame: f64, tf: Affine, b: &mut FrameBuilder) -> Result<()> {
        // The root composition is clipped to its own frame size, as players do. Without clipping, out-of-bounds layers would bleed outside the element box.
        let clip = rect_path(self.doc.width, self.doc.height);
        let path = b.path_id(clip.to_path_data());
        b.push(DrawOp::ClipPath {
            path,
            tf: tf.to_mat6(),
        });
        self.render_layers(&self.doc.layers, frame, tf, b)?;
        b.push(DrawOp::PopClip);
        Ok(())
    }

    fn render_layers(
        &self,
        layers: &[Layer],
        frame: f64,
        tf: Affine,
        b: &mut FrameBuilder,
    ) -> Result<()> {
        // In bodymovin, layers[0] is the topmost layer, so drawing starts from the bottom.
        let mut consumed = vec![false; layers.len()];
        for idx in (0..layers.len()).rev() {
            if consumed[idx] {
                continue;
            }
            let layer = &layers[idx];
            if layer.hidden || layer.is_matte_source {
                // A matte source is not drawn itself. The layer below uses it through `matte_source`.
                continue;
            }
            let matte = layer.matte.and_then(|mode| {
                let source = idx.checked_sub(1)?;
                layers
                    .get(source)
                    .filter(|candidate| candidate.is_matte_source)
                    .map(|candidate| (source, candidate, mode))
            });
            if let Some((source, _, _)) = matte {
                consumed[source] = true;
            }
            self.render_layer(layers, layer, matte.map(|m| (m.1, m.2)), frame, tf, b)?;
        }
        Ok(())
    }

    fn render_layer(
        &self,
        siblings: &[Layer],
        layer: &Layer,
        matte: Option<(&Layer, crate::drawop::MatteMode)>,
        frame: f64,
        tf: Affine,
        b: &mut FrameBuilder,
    ) -> Result<()> {
        if !visible(layer, frame) {
            return Ok(());
        }
        // **Property time is the frame number of the containing composition**, not minus `st`. AE writes a layer's own keyframes on the
        // **composition timeline**. `st` (Start Time) means "the frame at which the **source** of this layer begins", and it should only
        // shift the internal clock of the precomposition. I hit this once: when `st` was also subtracted from the properties, a spinner with `st = -25` had its 8 `tm` tracks
        // (keyframes exactly covering `[ip, op) = [0,22]`) pushed wholesale outside the value range. They all degenerated into the constant end value, and the picture froze.
        //
        // lottie-web 5.13.0 looks as if it subtracts `st`, but both sides subtract it and it cancels:
        // `getValueAtCurrentTime` takes `frameNum = comp.renderedFrame − offsetTime`,
        // while the keyframe times used for lookup and interpolation are also `keyData.t − offsetTime`
        // (`lottie.js:3022/2802/2827`; shape properties `:3491/:3516` are the same). `offsetTime = elem.data.st` cancels in the difference. This is equivalent to taking the composition frame directly against the raw `t`.
        let local = frame;
        let alpha = layer.transform.alpha(local);
        if alpha <= 0.0 {
            return Ok(());
        }
        let matrix = self.layer_matrix(siblings, layer, frame).then(tf);

        // Masks: a single fully opaque add mask takes the clip fast path. The rest go through an offscreen mask layer.
        let masks = MaskPlan::of(layer, local);
        let needs_layer = alpha < 1.0
            || layer.blend != BlendMode::Normal
            || matte.is_some()
            || masks.needs_layer();

        if needs_layer {
            b.push(DrawOp::PushLayer {
                opacity: alpha as f32,
                blend: layer.blend,
            });
        }
        let content_alpha = if needs_layer { 1.0 } else { alpha };

        if let MaskPlan::Clip(contour) = &masks {
            let path = b.path_id(ShapePath::single(contour.clone()).to_path_data());
            b.push(DrawOp::ClipPath {
                path,
                tf: matrix.to_mat6(),
            });
        }

        self.render_content(layer, local, matrix, content_alpha, b)?;

        if let MaskPlan::Clip(_) = &masks {
            b.push(DrawOp::PopClip);
        }
        if let MaskPlan::Matte(shapes) = &masks {
            b.push(DrawOp::PushMatte);
            for (contour, opacity) in shapes {
                let paint = b.paint_id(PaintData::Solid([1.0, 1.0, 1.0, *opacity as f32]));
                let path = b.path_id(ShapePath::single(contour.clone()).to_path_data());
                b.push(DrawOp::FillPathPaint {
                    path,
                    paint,
                    even_odd: false,
                    tf: matrix.to_mat6(),
                });
            }
            b.push(DrawOp::PopMatte {
                mode: crate::drawop::MatteMode::Alpha.code(),
            });
        }

        if let Some((source, mode)) = matte {
            b.push(DrawOp::PushMatte);
            if visible(source, frame) {
                let source_matrix = self.layer_matrix(siblings, source, frame).then(tf);
                let source_alpha = source.transform.alpha(frame);
                self.render_content(source, frame, source_matrix, source_alpha, b)?;
            }
            b.push(DrawOp::PopMatte { mode: mode.code() });
        }

        if needs_layer {
            b.push(DrawOp::PopLayer);
        }
        Ok(())
    }

    /// The layer's own matrix plus its parent chain (`parent` points to the `ind` of another layer in the same composition).
    fn layer_matrix(&self, siblings: &[Layer], layer: &Layer, frame: f64) -> Affine {
        let mut matrix = layer.transform.matrix(frame);
        let mut parent = layer.parent;
        // Upper bound on the parent chain is the number of layers. A circular parent chain terminates naturally here, so it cannot loop forever.
        for _ in 0..siblings.len() {
            let Some(index) = parent else { break };
            let Some(next) = siblings.iter().find(|candidate| candidate.index == index) else {
                break;
            };
            matrix = matrix.then(next.transform.matrix(frame));
            parent = next.parent;
        }
        matrix
    }

    fn render_content(
        &self,
        layer: &Layer,
        local: f64,
        matrix: Affine,
        alpha: f64,
        b: &mut FrameBuilder,
    ) -> Result<()> {
        match &layer.kind {
            LayerKind::Null => Ok(()),
            LayerKind::Shape(items) => {
                let (_, pending) = self.render_shapes(items, local, matrix, alpha, &[]);
                emit(&pending, b);
                Ok(())
            }
            LayerKind::Solid {
                color,
                width,
                height,
            } => {
                let paint = b.paint_id(PaintData::Solid([
                    color[0] as f32,
                    color[1] as f32,
                    color[2] as f32,
                    alpha as f32,
                ]));
                let path = b.path_id(rect_path(*width, *height).to_path_data());
                b.push(DrawOp::FillPathPaint {
                    path,
                    paint,
                    even_odd: false,
                    tf: matrix.to_mat6(),
                });
                Ok(())
            }
            LayerKind::Image { ref_id } => {
                let Some(name) = self.images.get(ref_id) else {
                    bail!(
                        "lottie-asset-missing: layer \"{}\" references image asset \"{ref_id}\", which was not loaded",
                        layer.name
                    );
                };
                let asset = b.string_id(name);
                // Images are drawn at their natural size at the layer origin. The scaling of the element box is carried by `matrix`.
                let needs_alpha = alpha < 1.0;
                if needs_alpha {
                    b.push(DrawOp::PushLayer {
                        opacity: alpha as f32,
                        blend: BlendMode::Normal,
                    });
                }
                b.push(DrawOp::DrawMedia {
                    asset,
                    media_ms: -1,
                    src: [0.0; 4],
                    tf: matrix.to_mat6(),
                });
                if needs_alpha {
                    b.push(DrawOp::PopLayer);
                }
                Ok(())
            }
            LayerKind::Precomp {
                ref_id,
                width,
                height,
            } => {
                if self.depth >= MAX_PRECOMP_DEPTH {
                    bail!(
                        "lottie-precomp-depth: precomp nesting exceeds {MAX_PRECOMP_DEPTH} levels (\"{ref_id}\", possibly a circular reference)"
                    );
                }
                let Some(layers) = self.doc.precomps.get(ref_id) else {
                    bail!(
                        "lottie-asset-missing: layer \"{}\" references precomp \"{ref_id}\", which is not in assets",
                        layer.name
                    );
                };
                // **Only `st` and `sr` are used here**, for the internal clock of the precomposition.
                // When there is time remapping, it gives the absolute internal frame directly (the properties themselves are evaluated by composition frame).
                // Otherwise it translates and scales by `(composition frame − st) / sr`.
                let inner = match &layer.time_remap {
                    Some(remap) => remap.scalar(local) * self.doc.fr,
                    None => (local - layer.start) / layer.stretch,
                };
                let needs_layer = alpha < 1.0;
                if needs_layer {
                    b.push(DrawOp::PushLayer {
                        opacity: alpha as f32,
                        blend: BlendMode::Normal,
                    });
                }
                if *width > 0.0 && *height > 0.0 {
                    let path = b.path_id(rect_path(*width, *height).to_path_data());
                    b.push(DrawOp::ClipPath {
                        path,
                        tf: matrix.to_mat6(),
                    });
                }
                let nested = Lowering {
                    doc: self.doc,
                    images: self.images,
                    depth: self.depth + 1,
                };
                nested.render_layers(layers, inner, matrix, b)?;
                if *width > 0.0 && *height > 0.0 {
                    b.push(DrawOp::PopClip);
                }
                if needs_layer {
                    b.push(DrawOp::PopLayer);
                }
                Ok(())
            }
        }
    }

    // ── shape tree ─────────────────────────────────────────────────────

    /// One shape group.
    ///
    /// AE's shape groups have two rules that run in **opposite directions**, and both must be handled here:
    ///
    /// * Brushes (fill, stroke, modifiers) act on the path **above** them. That means the entries that come **before** them in the array. So paths accumulate in **forward** order.
    /// * Entries that come earlier are drawn **on top**. So drawing is emitted in **reverse** order.
    ///
    /// The code therefore walks forward first and records the draws as [`Pending`], then reverses the whole group at the end. A nested group takes part in the reversal as one block, and the block has already been reversed internally. The return value is the paths this group produces (already folded
    /// with this group's `tr`), for use by brushes above the parent group.
    fn render_shapes(
        &self,
        items: &[ShapeItem],
        frame: f64,
        tf: Affine,
        alpha: f64,
        inherited: &[Modifier],
    ) -> (ShapePath, Vec<Pending>) {
        let group = items.iter().find_map(|item| match item {
            ShapeItem::Transform(t) => Some(t),
            _ => None,
        });
        let group_tf = group.map(|t| t.matrix(frame)).unwrap_or(Affine::IDENTITY);
        let local_tf = group_tf.then(tf);
        let local_alpha = alpha * group.map(|t| t.alpha(frame)).unwrap_or(1.0);
        // Modifiers (Trim, Round Corners) act on all brushes **above** them, whether those brushes are entries earlier in this group or entries in a higher sub-group.
        //
        // * Same group: `[sh, st, tm, tr]` is the most common way to write a Trim Paths stroke animation (in the AE panel, Trim sits below Stroke). When walking forward and reaching `st`, `tm` has not been applied yet.
        //   So the brush must look back at `items[index + 1..]` itself. Otherwise the stroke would always be drawn in full, and the Noto "Rainbow" growth animation would degrade into a static full arc.
        // * Across groups: the Noto "Chart Increasing" polyline is `[gr{sh, st}, tm]`. The stroke is in the sub-group and tm is in the parent group, and `inherited` passes it down.
        //
        // The two passes are applied in the order "this group first, then inherited". This is the same convention as the `passed` that sub-groups receive.
        // Modifiers are applied in the group's local coordinates. (Trim uses percentages and is insensitive to affine transforms. Round Corners' radius does not fold in the `tr` scale, which is an acceptable approximation.)
        let painted = |index: usize, paths: &ShapePath| -> ShapePath {
            items[index + 1..]
                .iter()
                .filter_map(|item| Modifier::evaluate(item, frame))
                .chain(inherited.iter().cloned())
                .fold(paths.clone(), |acc, modifier| modifier.apply(&acc))
        };

        let mut paths = ShapePath::default();
        let mut pending: Vec<Pending> = Vec::new();
        for (index, item) in items.iter().enumerate() {
            match item {
                ShapeItem::Transform(_) | ShapeItem::MergeAppend => {}
                ShapeItem::Group { items: sub_items } => {
                    // Modifiers in this group that sit below a sub-group are applied first, then the modifiers inherited from further out.
                    let mut passed: Vec<Modifier> = items[index + 1..]
                        .iter()
                        .filter_map(|item| Modifier::evaluate(item, frame))
                        .collect();
                    passed.extend(inherited.iter().cloned());
                    let (sub, block) =
                        self.render_shapes(sub_items, frame, local_tf, local_alpha, &passed);
                    paths.extend(&sub);
                    pending.push(Pending::Block(block));
                }
                ShapeItem::Path {
                    path,
                    reversed: flip,
                } => {
                    let contour = path.value(frame);
                    paths
                        .0
                        .push(if *flip { contour.reversed() } else { contour });
                }
                ShapeItem::Rect {
                    position,
                    size,
                    radius,
                    reversed: flip,
                } => {
                    let contour = geometry::rect(
                        position.point(frame),
                        size.point(frame),
                        radius.scalar(frame),
                    );
                    paths
                        .0
                        .push(if *flip { contour.reversed() } else { contour });
                }
                ShapeItem::Ellipse {
                    position,
                    size,
                    reversed: flip,
                } => {
                    let contour = geometry::ellipse(position.point(frame), size.point(frame));
                    paths
                        .0
                        .push(if *flip { contour.reversed() } else { contour });
                }
                ShapeItem::Star {
                    position,
                    points,
                    rotation,
                    outer_radius,
                    outer_round,
                    inner_radius,
                    inner_round,
                    is_star,
                } => paths.0.push(geometry::star(
                    position.point(frame),
                    points.scalar(frame),
                    rotation.scalar(frame),
                    outer_radius.scalar(frame),
                    outer_round.scalar(frame),
                    inner_radius.scalar(frame),
                    inner_round.scalar(frame),
                    *is_star,
                )),
                ShapeItem::Trim {
                    start,
                    end,
                    offset,
                    individually,
                } => {
                    paths = geometry::trim(
                        &paths,
                        start.scalar(frame),
                        end.scalar(frame),
                        offset.scalar(frame),
                        *individually,
                    );
                }
                ShapeItem::RoundCorners { radius } => {
                    paths = geometry::round_corners(&paths, radius.scalar(frame));
                }
                ShapeItem::Fill {
                    color,
                    opacity,
                    even_odd,
                } => {
                    let rgb = color_at(color, frame);
                    let a = local_alpha * (opacity.scalar(frame) / 100.0).clamp(0.0, 1.0);
                    if paths.is_empty() || a <= 0.0 {
                        continue;
                    }
                    let path = painted(index, &paths);
                    if path.is_empty() {
                        continue;
                    }
                    pending.push(Pending::Fill {
                        path,
                        paint: PaintData::Solid([
                            rgb[0] as f32,
                            rgb[1] as f32,
                            rgb[2] as f32,
                            a as f32,
                        ]),
                        even_odd: *even_odd,
                        tf: local_tf,
                    });
                }
                ShapeItem::GradientFill {
                    gradient,
                    opacity,
                    even_odd,
                } => {
                    let a = local_alpha * (opacity.scalar(frame) / 100.0).clamp(0.0, 1.0);
                    if paths.is_empty() || a <= 0.0 {
                        continue;
                    }
                    let path = painted(index, &paths);
                    if path.is_empty() {
                        continue;
                    }
                    pending.push(Pending::Fill {
                        path,
                        paint: gradient_paint(gradient, frame, a),
                        even_odd: *even_odd,
                        tf: local_tf,
                    });
                }
                ShapeItem::Stroke {
                    color,
                    opacity,
                    style,
                } => {
                    let rgb = color_at(color, frame);
                    let a = local_alpha * (opacity.scalar(frame) / 100.0).clamp(0.0, 1.0);
                    let paint =
                        PaintData::Solid([rgb[0] as f32, rgb[1] as f32, rgb[2] as f32, a as f32]);
                    pending.extend(stroke(
                        &painted(index, &paths),
                        style,
                        paint,
                        frame,
                        a,
                        local_tf,
                    ));
                }
                ShapeItem::GradientStroke {
                    gradient,
                    opacity,
                    style,
                } => {
                    let a = local_alpha * (opacity.scalar(frame) / 100.0).clamp(0.0, 1.0);
                    let paint = gradient_paint(gradient, frame, a);
                    pending.extend(stroke(
                        &painted(index, &paths),
                        style,
                        paint,
                        frame,
                        a,
                        local_tf,
                    ));
                }
            }
        }
        pending.reverse();
        (paths.transformed(&group_tf), pending)
    }
}

/// Path modifiers (Trim Paths, Round Corners) evaluated at one frame. Used to pass them down from a parent group to sub-groups that sit above it.
#[derive(Clone, Debug)]
enum Modifier {
    Trim {
        start: f64,
        end: f64,
        offset: f64,
        individually: bool,
    },
    RoundCorners {
        radius: f64,
    },
}

impl Modifier {
    fn evaluate(item: &ShapeItem, frame: f64) -> Option<Self> {
        match item {
            ShapeItem::Trim {
                start,
                end,
                offset,
                individually,
            } => Some(Modifier::Trim {
                start: start.scalar(frame),
                end: end.scalar(frame),
                offset: offset.scalar(frame),
                individually: *individually,
            }),
            ShapeItem::RoundCorners { radius } => Some(Modifier::RoundCorners {
                radius: radius.scalar(frame),
            }),
            _ => None,
        }
    }

    fn apply(&self, paths: &ShapePath) -> ShapePath {
        match *self {
            Modifier::Trim {
                start,
                end,
                offset,
                individually,
            } => geometry::trim(paths, start, end, offset, individually),
            Modifier::RoundCorners { radius } => geometry::round_corners(paths, radius),
        }
    }
}

/// One pending draw. Recording first and emitting later lets both rules be satisfied at once: brushes take the paths above them, and entries above are drawn on top. These two rules run in opposite directions.
enum Pending {
    Fill {
        path: ShapePath,
        paint: PaintData,
        even_odd: bool,
        tf: Affine,
    },
    Stroke {
        path: ShapePath,
        paint: PaintData,
        width: f64,
        cap: u8,
        join: u8,
        miter: f64,
        tf: Affine,
    },
    /// Nested group. The order inside the block is already settled, and as a whole it takes part in the outer reversal.
    Block(Vec<Pending>),
}

fn emit(pending: &[Pending], b: &mut FrameBuilder) {
    for item in pending {
        match item {
            Pending::Block(inner) => emit(inner, b),
            Pending::Fill {
                path,
                paint,
                even_odd,
                tf,
            } => {
                let paint = b.paint_id(paint.clone());
                let path = b.path_id(path.to_path_data());
                b.push(DrawOp::FillPathPaint {
                    path,
                    paint,
                    even_odd: *even_odd,
                    tf: tf.to_mat6(),
                });
            }
            Pending::Stroke {
                path,
                paint,
                width,
                cap,
                join,
                miter,
                tf,
            } => {
                let paint = b.paint_id(paint.clone());
                let path = b.path_id(path.to_path_data());
                b.push(DrawOp::StrokePathPaint {
                    path,
                    paint,
                    width: *width as f32,
                    cap: *cap,
                    join: *join,
                    miter: *miter as f32,
                    tf: tf.to_mat6(),
                });
            }
        }
    }
}

fn visible(layer: &Layer, frame: f64) -> bool {
    frame >= layer.in_point && frame < layer.out_point
}

/// A rectangle centered at the origin with size `w × h`. It is simply the frame box whose top-left corner is at (0,0).
fn rect_path(w: f64, h: f64) -> ShapePath {
    ShapePath::single(Contour {
        v: vec![[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]],
        i: vec![[0.0, 0.0]; 4],
        o: vec![[0.0, 0.0]; 4],
        closed: true,
    })
}

#[allow(clippy::too_many_arguments)]
fn stroke(
    paths: &ShapePath,
    style: &StrokeStyle,
    paint: PaintData,
    frame: f64,
    alpha: f64,
    tf: Affine,
) -> Option<Pending> {
    if paths.is_empty() || alpha <= 0.0 {
        return None;
    }
    let width = style.width.scalar(frame);
    if width <= 0.0 {
        return None;
    }
    let pattern: Vec<f64> = style
        .dashes
        .iter()
        .map(|value| value.scalar(frame))
        .collect();
    let dashed = if pattern.is_empty() {
        paths.clone()
    } else {
        let offset = style
            .dash_offset
            .as_ref()
            .map(|value| value.scalar(frame))
            .unwrap_or(0.0);
        geometry::dash(paths, &pattern, offset)
    };
    if dashed.is_empty() {
        return None;
    }
    Some(Pending::Stroke {
        path: dashed,
        paint,
        width,
        cap: style.cap,
        join: style.join,
        miter: style.miter,
        tf,
    })
}

/// Gradient → paint-side table entry. The geometry is in the shape's local coordinate system (the same frame as the op's `tf`).
fn gradient_paint(gradient: &Gradient, frame: f64, alpha: f64) -> PaintData {
    let start = gradient.start.point(frame);
    let end = gradient.end.point(frame);
    let stops = gradient_stops(gradient, frame, alpha);
    if !gradient.radial {
        return PaintData::Linear {
            p0: [start[0] as f32, start[1] as f32],
            p1: [end[0] as f32, end[1] as f32],
            stops,
        };
    }
    let dx = end[0] - start[0];
    let dy = end[1] - start[1];
    let radius = (dx * dx + dy * dy).sqrt();
    // Highlight: along angle `a`, at `h`% from the center (clamped to within 99%, since a focal point on the circumference would degenerate).
    let highlight = (gradient.highlight_length.scalar(frame) / 100.0).clamp(-0.99, 0.99);
    let angle = gradient.highlight_angle.scalar(frame).to_radians();
    let focus = [
        start[0] + radius * highlight * angle.cos(),
        start[1] + radius * highlight * angle.sin(),
    ];
    PaintData::Radial {
        center: [start[0] as f32, start[1] as f32],
        radius: radius as f32,
        focus: [focus[0] as f32, focus[1] as f32],
        stops,
    }
}

/// Flat color-stop array → color-stop table. Color stops and alpha stops each have their own offset list. Take the union and interpolate each on its own. Using only the color stops would drop all mid-way transparency changes.
fn gradient_stops(gradient: &Gradient, frame: f64, alpha: f64) -> Vec<GradientStop> {
    let data = gradient.stops.value(frame);
    let count = gradient.stop_count.min(data.len() / 4);
    if count == 0 {
        return vec![GradientStop {
            offset: 0.0,
            color: [0.0, 0.0, 0.0, alpha as f32],
        }];
    }
    let colors: Vec<(f64, [f64; 3])> = (0..count)
        .map(|k| {
            (
                data[k * 4],
                [data[k * 4 + 1], data[k * 4 + 2], data[k * 4 + 3]],
            )
        })
        .collect();
    let alphas: Vec<(f64, f64)> = data[count * 4..]
        .chunks_exact(2)
        .map(|pair| (pair[0], pair[1]))
        .collect();

    let mut offsets: Vec<f64> = colors
        .iter()
        .map(|(o, _)| *o)
        .chain(alphas.iter().map(|(o, _)| *o))
        .collect();
    offsets.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    offsets.dedup_by(|a, b| (*a - *b).abs() < 1e-9);

    offsets
        .into_iter()
        .map(|offset| {
            let rgb = interpolate_stops(&colors, offset);
            let a = if alphas.is_empty() {
                1.0
            } else {
                interpolate_scalar(&alphas, offset)
            };
            GradientStop {
                offset: offset.clamp(0.0, 1.0) as f32,
                color: [
                    rgb[0] as f32,
                    rgb[1] as f32,
                    rgb[2] as f32,
                    (a * alpha).clamp(0.0, 1.0) as f32,
                ],
            }
        })
        .collect()
}

fn interpolate_stops(stops: &[(f64, [f64; 3])], at: f64) -> [f64; 3] {
    if stops.is_empty() {
        return [0.0; 3];
    }
    if at <= stops[0].0 {
        return stops[0].1;
    }
    let last = stops[stops.len() - 1];
    if at >= last.0 {
        return last.1;
    }
    for pair in stops.windows(2) {
        let (o0, c0) = pair[0];
        let (o1, c1) = pair[1];
        if at >= o0 && at <= o1 {
            let t = if o1 > o0 { (at - o0) / (o1 - o0) } else { 0.0 };
            return [
                c0[0] + (c1[0] - c0[0]) * t,
                c0[1] + (c1[1] - c0[1]) * t,
                c0[2] + (c1[2] - c0[2]) * t,
            ];
        }
    }
    last.1
}

fn interpolate_scalar(stops: &[(f64, f64)], at: f64) -> f64 {
    if stops.is_empty() {
        return 1.0;
    }
    if at <= stops[0].0 {
        return stops[0].1;
    }
    let last = stops[stops.len() - 1];
    if at >= last.0 {
        return last.1;
    }
    for pair in stops.windows(2) {
        let (o0, a0) = pair[0];
        let (o1, a1) = pair[1];
        if at >= o0 && at <= o1 {
            let t = if o1 > o0 { (at - o0) / (o1 - o0) } else { 0.0 };
            return a0 + (a1 - a0) * t;
        }
    }
    last.1
}

/// How a layer mask is realized.
enum MaskPlan {
    None,
    /// A single fully opaque add mask. One `ClipPath` is enough, with no offscreen layer needed.
    Clip(Contour),
    /// Otherwise: the mask shape is drawn into an offscreen mask layer and folded into the content by alpha.
    Matte(Vec<(Contour, f64)>),
}

impl MaskPlan {
    fn of(layer: &Layer, frame: f64) -> MaskPlan {
        if layer.masks.is_empty() {
            return MaskPlan::None;
        }
        let shapes: Vec<(Contour, f64)> = layer
            .masks
            .iter()
            .map(|mask| {
                let contour = mask.path.value(frame);
                let opacity = (mask.opacity.scalar(frame) / 100.0).clamp(0.0, 1.0);
                (contour, opacity)
            })
            .filter(|(contour, opacity)| !contour.is_empty() && *opacity > 0.0)
            .collect();
        if shapes.is_empty() {
            return MaskPlan::None;
        }
        if shapes.len() == 1 && shapes[0].1 >= 1.0 && !layer.masks[0].inverted {
            return MaskPlan::Clip(shapes[0].0.clone());
        }
        MaskPlan::Matte(shapes)
    }

    fn needs_layer(&self) -> bool {
        matches!(self, MaskPlan::Matte(_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::lottie::schema::{self, Diagnostics};
    use serde_json::json;

    fn lower(doc: serde_json::Value, frame: f64) -> crate::drawop::FrameOps {
        let mut diagnostics = Diagnostics::default();
        let animation = schema::parse("t", &doc, &mut diagnostics).unwrap();
        let images = BTreeMap::new();
        let mut builder = FrameBuilder::default();
        Lowering::new(&animation, &images)
            .record(frame, Affine::IDENTITY, &mut builder)
            .unwrap();
        builder.finish()
    }

    fn base(layers: serde_json::Value) -> serde_json::Value {
        json!({"v": "5.7.0", "fr": 10, "ip": 0, "op": 10, "w": 100, "h": 100, "layers": layers})
    }

    fn square_shape(fill: serde_json::Value) -> serde_json::Value {
        json!({"ty": 4, "ind": 1, "ip": 0, "op": 10, "st": 0, "ks": {},
        "shapes": [{"ty": "gr", "it": [
            {"ty": "rc", "p": {"a": 0, "k": [50, 50]}, "s": {"a": 0, "k": [40, 40]},
             "r": {"a": 0, "k": 0}},
            fill,
            {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]},
             "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0}, "o": {"a": 0, "k": 100}}
        ]}]})
    }

    fn solid_fill() -> serde_json::Value {
        json!({"ty": "fl", "c": {"a": 0, "k": [1, 0, 0, 1]}, "o": {"a": 0, "k": 100}})
    }

    /// Noto "Rainbow" rainbow arc: `[sh, st, tm, tr]`. Trim Paths and the stroke are in **the same group**, with the stroke below. This is the most common way to write a Trim growth animation. If it were drawn in array order, `tm` would not yet be applied when reaching `st`. The whole arc would then be drawn in full, and the animation would be lost.
    #[test]
    fn a_trim_below_a_stroke_in_the_same_group_trims_that_stroke() {
        fn doc(trim_end: f64) -> serde_json::Value {
            base(
                json!([{"ty": 4, "ind": 1, "ip": 0, "op": 10, "st": 0, "ks": {},
                "shapes": [{"ty": "gr", "it": [
                    {"ty": "sh", "ks": {"a": 0, "k": {"c": false,
                        "v": [[0, 50], [100, 50]], "i": [[0, 0], [0, 0]], "o": [[0, 0], [0, 0]]}}},
                    {"ty": "st", "c": {"a": 0, "k": [0, 0, 1, 1]}, "o": {"a": 0, "k": 100},
                     "w": {"a": 0, "k": 4}, "lc": 1, "lj": 1},
                    {"ty": "tm", "s": {"a": 0, "k": 0}, "e": {"a": 0, "k": trim_end},
                     "o": {"a": 0, "k": 0}, "m": 1},
                    {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]},
                     "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0}, "o": {"a": 0, "k": 100}}
                ]}]}]),
            )
        }
        let full = lower(doc(100.0), 0.0);
        let half = lower(doc(50.0), 0.0);
        let none = lower(doc(0.0), 0.0);
        let strokes = |frame: &crate::drawop::FrameOps| {
            frame
                .ops
                .iter()
                .filter(|op| matches!(op, DrawOp::StrokePathPaint { .. }))
                .count()
        };
        assert_eq!(strokes(&full), 1);
        assert_eq!(strokes(&half), 1);
        assert_eq!(strokes(&none), 0, "at 0% trim, the same-group stroke is no longer emitted");
        assert_ne!(
            full.paths, half.paths,
            "50% trim must actually change the path of the same-group stroke"
        );
    }

    /// Noto "Chart Increasing" polyline: the stroke is in a sub-group, and Trim Paths is in the parent group, ranked below the sub-group. Trim must be passed down. Otherwise the polyline would be drawn in full and the animation lost.
    #[test]
    fn a_trim_after_a_nested_group_trims_that_groups_stroke() {
        fn doc(trim_end: f64) -> serde_json::Value {
            base(
                json!([{"ty": 4, "ind": 1, "ip": 0, "op": 10, "st": 0, "ks": {},
                "shapes": [{"ty": "gr", "it": [
                    {"ty": "gr", "it": [
                        {"ty": "sh", "ks": {"a": 0, "k": {"c": false,
                            "v": [[0, 50], [100, 50]], "i": [[0, 0], [0, 0]], "o": [[0, 0], [0, 0]]}}},
                        {"ty": "st", "c": {"a": 0, "k": [0, 0, 1, 1]}, "o": {"a": 0, "k": 100},
                         "w": {"a": 0, "k": 4}, "lc": 1, "lj": 1}
                    ]},
                    {"ty": "tm", "s": {"a": 0, "k": 0}, "e": {"a": 0, "k": trim_end},
                     "o": {"a": 0, "k": 0}, "m": 1}
                ]}]}]),
            )
        }
        let full = lower(doc(100.0), 0.0);
        let half = lower(doc(50.0), 0.0);
        let none = lower(doc(0.0), 0.0);
        let strokes = |frame: &crate::drawop::FrameOps| {
            frame
                .ops
                .iter()
                .filter(|op| matches!(op, DrawOp::StrokePathPaint { .. }))
                .count()
        };
        assert_eq!(strokes(&full), 1);
        assert_eq!(strokes(&half), 1);
        assert_eq!(strokes(&none), 0, "at 0% trim, the child-group stroke is no longer emitted");
        assert_ne!(full.paths, half.paths, "50% trim must actually change the stroke path");
    }

    #[test]
    fn a_single_filled_rectangle_lowers_to_one_fill_between_clips() {
        let frame = lower(base(json!([square_shape(solid_fill())])), 0.0);
        let kinds: Vec<&str> = frame
            .ops
            .iter()
            .map(|op| match op {
                DrawOp::ClipPath { .. } => "clip",
                DrawOp::PopClip => "popclip",
                DrawOp::FillPathPaint { .. } => "fill",
                _ => "other",
            })
            .collect();
        assert_eq!(kinds, vec!["clip", "fill", "popclip"]);
        assert_eq!(frame.paints.len(), 1);
        assert_eq!(frame.paints[0], PaintData::Solid([1.0, 0.0, 0.0, 1.0]));
    }

    #[test]
    fn a_layer_outside_its_time_range_emits_nothing() {
        let mut doc = base(json!([square_shape(solid_fill())]));
        doc["layers"][0]["ip"] = json!(5);
        assert_eq!(lower(doc.clone(), 0.0).ops.len(), 2, "only clip/popclip remain");
        assert_eq!(lower(doc, 6.0).ops.len(), 3);
    }

    #[test]
    fn layer_opacity_and_blend_open_an_offscreen_layer() {
        let mut doc = base(json!([square_shape(solid_fill())]));
        doc["layers"][0]["ks"] = json!({"o": {"a": 0, "k": 50}});
        doc["layers"][0]["bm"] = json!(1);
        let frame = lower(doc, 0.0);
        let pushed = frame.ops.iter().find_map(|op| match op {
            DrawOp::PushLayer { opacity, blend } => Some((*opacity, *blend)),
            _ => None,
        });
        assert_eq!(pushed, Some((0.5, BlendMode::Multiply)));
        assert!(frame.ops.iter().any(|op| matches!(op, DrawOp::PopLayer)));
    }

    #[test]
    fn a_track_matte_wraps_the_content_in_push_pop_matte() {
        let mut matte_source = square_shape(solid_fill());
        matte_source["td"] = json!(1);
        matte_source["ind"] = json!(2);
        let mut content = square_shape(solid_fill());
        content["tt"] = json!(1);
        let frame = lower(base(json!([matte_source, content])), 0.0);
        let codes: Vec<&str> = frame
            .ops
            .iter()
            .map(|op| match op {
                DrawOp::PushLayer { .. } => "push",
                DrawOp::PopLayer => "pop",
                DrawOp::PushMatte => "pushmatte",
                DrawOp::PopMatte { .. } => "popmatte",
                DrawOp::FillPathPaint { .. } => "fill",
                DrawOp::ClipPath { .. } => "clip",
                DrawOp::PopClip => "popclip",
                _ => "other",
            })
            .collect();
        assert_eq!(
            codes,
            vec![
                "clip",
                "push",
                "fill",
                "pushmatte",
                "fill",
                "popmatte",
                "pop",
                "popclip"
            ]
        );
    }

    #[test]
    fn a_full_opacity_add_mask_becomes_a_clip_path() {
        let mut doc = base(json!([square_shape(solid_fill())]));
        doc["layers"][0]["masksProperties"] = json!([{
            "mode": "a", "o": {"a": 0, "k": 100},
            "pt": {"a": 0, "k": {"v": [[0, 0], [10, 0], [10, 10]],
                                 "i": [[0, 0], [0, 0], [0, 0]],
                                 "o": [[0, 0], [0, 0], [0, 0]], "c": true}}
        }]);
        let frame = lower(doc, 0.0);
        assert_eq!(
            frame
                .ops
                .iter()
                .filter(|op| matches!(op, DrawOp::ClipPath { .. }))
                .count(),
            2,
            "frame clip + mask clip"
        );
        assert!(!frame.ops.iter().any(|op| matches!(op, DrawOp::PushMatte)));
    }

    #[test]
    fn a_translucent_mask_falls_back_to_the_matte_layer() {
        let mut doc = base(json!([square_shape(solid_fill())]));
        doc["layers"][0]["masksProperties"] = json!([{
            "mode": "a", "o": {"a": 0, "k": 40},
            "pt": {"a": 0, "k": {"v": [[0, 0], [10, 0], [10, 10]],
                                 "i": [[0, 0], [0, 0], [0, 0]],
                                 "o": [[0, 0], [0, 0], [0, 0]], "c": true}}
        }]);
        let frame = lower(doc, 0.0);
        assert!(frame.ops.iter().any(|op| matches!(op, DrawOp::PushMatte)));
        assert!(frame.paints.iter().any(|paint| matches!(
            paint,
            PaintData::Solid(c) if (c[3] - 0.4).abs() < 1e-6
        )));
    }

    #[test]
    fn a_precomp_layer_clips_to_its_own_size_and_remaps_time() {
        let doc = json!({"v": "5.7.0", "fr": 10, "ip": 0, "op": 10, "w": 100, "h": 100,
            "assets": [{"id": "c", "layers": [square_shape(solid_fill())]}],
            "layers": [{"ty": 0, "ind": 1, "refId": "c", "w": 60, "h": 60,
                        "ip": 0, "op": 10, "st": 0, "sr": 1, "ks": {}}]});
        let frame = lower(doc, 0.0);
        assert_eq!(
            frame
                .ops
                .iter()
                .filter(|op| matches!(op, DrawOp::ClipPath { .. }))
                .count(),
            2,
            "root frame + precomp frame"
        );
        assert!(
            frame
                .ops
                .iter()
                .any(|op| matches!(op, DrawOp::FillPathPaint { .. }))
        );
    }

    #[test]
    fn a_gradient_fill_lowers_to_a_gradient_paint() {
        let gradient = json!({"ty": "gf", "t": 1,
            "s": {"a": 0, "k": [0, 0]}, "e": {"a": 0, "k": [100, 0]},
            "o": {"a": 0, "k": 100},
            "g": {"p": 2, "k": {"a": 0, "k": [0, 1, 0, 0, 1, 0, 0, 1]}}});
        let frame = lower(base(json!([square_shape(gradient)])), 0.0);
        match &frame.paints[0] {
            PaintData::Linear { p0, p1, stops } => {
                assert_eq!(*p0, [0.0, 0.0]);
                assert_eq!(*p1, [100.0, 0.0]);
                assert_eq!(stops.len(), 2);
                assert_eq!(stops[0].color, [1.0, 0.0, 0.0, 1.0]);
                assert_eq!(stops[1].color, [0.0, 0.0, 1.0, 1.0]);
            }
            other => panic!("expected a linear gradient, got {other:?}"),
        }
    }

    #[test]
    fn gradient_alpha_stops_merge_into_the_colour_stop_list() {
        let gradient = json!({"ty": "gf", "t": 1,
            "s": {"a": 0, "k": [0, 0]}, "e": {"a": 0, "k": [100, 0]},
            "o": {"a": 0, "k": 100},
            "g": {"p": 2, "k": {"a": 0, "k": [0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0.5, 0, 1, 1]}}});
        let frame = lower(base(json!([square_shape(gradient)])), 0.0);
        let PaintData::Linear { stops, .. } = &frame.paints[0] else {
            panic!("expected a linear gradient");
        };
        assert_eq!(stops.len(), 3, "two color stops + the transparent stop in between");
        assert!((stops[1].offset - 0.5).abs() < 1e-6);
        assert_eq!(stops[1].color[3], 0.0);
    }

    #[test]
    fn lowering_the_same_frame_twice_gives_identical_bytes() {
        let doc = base(json!([square_shape(solid_fill())]));
        let a = crate::drawop::encode(&lower(doc.clone(), 3.0));
        let b = crate::drawop::encode(&lower(doc, 3.0));
        assert_eq!(a, b);
    }
}
