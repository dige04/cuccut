//! A single Timeline element → DrawOp instructions.
//!
//! This layer is the **pure-function** part that P6a moved down from `core/crates/ccut-kernel/src/cmd/studio_export/render_plan.rs`: the element box, the affine transform, the three direct-vector kinds (shape / visualizer / progress), and the placeholder block for missing spectrum. Function bodies were moved verbatim. The host side keeps only three jobs: fetch data, build views, collect diagnostics.
//!
//! ## Why it must be the same code and not two aligned implementations
//!
//! The acceptance criterion of §10 P6 is that "the same timeline + the same BCS1 + the same t give wasm's `fingerprintAt(t)` and the CLI's DrawOp fingerprint **bit-identical**". Two implementations kept aligned can only rely on tests to **discover** drift. A single implementation makes "bit-identical" structural: both sides advance the instruction stream through the same `push_*`, so the fingerprints share one origin.
//!
//! ## What the host must precompute and this does not do
//!
//! * **Spectrum track** (`VizTrack`): reading from disk, deriving, and merging by element id all happen in the host (the injection protocol of ADR-E04). Here we only receive an `Option<&VizTrack>`.
//! * **Sample-time conversion**: converting output time to source media time goes through [`timeline::TimelineProjection`]. The projection table belongs to the host. The CLI reads it from the project. The wasm side currently has no projection table, so it passes `Some(time)`, which is identical to the CLI's degenerate path when there is no projection. Here we only receive an `Option<f64>`: `None` means no such audio source is playing at this moment.
//! * **Diagnostic deduplication**: `warn` is a sink. The same diagnostic hits every frame, and deduplication is left to the host.

use std::sync::Arc;

use anyhow::Result;

use crate::draw::{
    ElementBox, ElementPose, parse_color, push_draw_ops, push_media_placeholder_ops,
    push_placeholder_ops, push_shape_ops,
};
use crate::scene::SceneNode;
use render_raster::ShaderQuad;
use render_raster::drawop::{Color4, DrawOp, FrameBuilder, FrameOps, Mat6};
use render_raster::source::kernel::DrawBox;
use timeline::schema::{
    ConfettiProps, DrawProps, ElementKind, Place, PlaceholderProps, ProgressProps, ShapeProps,
    StickerProps, TimeValue, VisualizerProps, WhiteboardHand, WhiteboardPace, WhiteboardProps,
};

/// Canvas size. `u32` rather than `f64`: the conversion basis of `short_edge` and `pixel_scale` is defined by `width.min(height)`. Converting to float first and then taking the min would give a different number at extreme sizes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stage {
    pub width: u32,
    pub height: u32,
}

impl Stage {
    pub fn new(width: u32, height: u32) -> Self {
        Stage { width, height }
    }

    pub fn canvas(self) -> (f64, f64) {
        (f64::from(self.width), f64::from(self.height))
    }

    /// The base for scaling pixel-unit recipe parameters (`strokeWidth` / `cornerRadius` / the progress line width). The single source of truth for the reference short edge is [`timeline::REFERENCE_SHORT_EDGE`].
    pub fn short_edge(self) -> f64 {
        f64::from(self.width.min(self.height))
    }
}

/// A borrowed view of all the **contract** inputs needed to draw an element.
///
/// Each host's element table (the CLI's `TimelineVisualElement`, the wasm side's [`timeline::schema::Element`]) has different fields, but drawing reads only these. A borrowed view is much cheaper than having this crate know about one host's struct.
#[derive(Debug, Clone, Copy)]
pub struct ElementDraw<'a> {
    pub id: &'a str,
    pub kind: ElementKind,
    pub start: f64,
    pub end: f64,
    pub place: &'a Place,
    pub shape: Option<&'a ShapeProps>,
    pub sticker: Option<&'a StickerProps>,
    pub visualizer: Option<&'a VisualizerProps>,
    pub progress: Option<&'a ProgressProps>,
    pub draw: Option<&'a DrawProps>,
    pub placeholder: Option<&'a PlaceholderProps>,
    /// Parameter for `kind: "confetti"` (0.6; design draft `docs/design/elements/ccut-confetti-element-design.md`).
    pub confetti: Option<&'a ConfettiProps>,
    /// Parameter for `kind: "whiteboard"` (0.8; design draft `docs/design/video/ccut-whiteboard-animation-design.md`). Drawing goes through the host's raster path (same as image). It is kept here only for `element_aspect` and other contract uses.
    pub whiteboard: Option<&'a WhiteboardProps>,
    pub has_source: bool,
}

/// Diagnostic outlet. The host handles deduplication and surfacing (the CLI's `warn_once`).
pub type WarnSink<'a> = &'a mut dyn FnMut(String);

/// The audio source id for `visualizer`. `VISUALIZER_AUDIO_DEFAULT` means "follow the main audio track". At the source layer it resolves to `main`.
pub fn visualizer_audio_source(props: &VisualizerProps) -> String {
    let audio = props.audio();
    if audio == timeline::schema::VISUALIZER_AUDIO_DEFAULT {
        "main".to_owned()
    } else {
        audio.to_owned()
    }
}

/// Default for `draw`: `min(0.8 × element duration, natural duration derived from analysis)` (ADR-WB05). For an open-ended tail (non-finite `duration`) only the natural duration is used. The result is at least 0.1 s.
pub fn whiteboard_draw_seconds(props: &WhiteboardProps, duration: f64, natural: f64) -> f64 {
    let draw = props.draw.unwrap_or_else(|| {
        if duration.is_finite() && duration > 0.0 {
            (duration * 0.8).min(natural)
        } else {
            natural
        }
    });
    draw.max(0.1)
}

/// `WhiteboardProps` → render kernel parameters. `beats[].at` and `end` (element-local seconds) are normalized by `draw`. `pace` and `strict` are passed through unchanged, and `draw` serves as the basis for converting `natural` into seconds.
///
/// Beats written as word anchors are resolved into local seconds by the host (`host_support::tracks_with_resolved_anchors`) before this point. Beats that are still anchors here (resolution failed, or a path with no word list) are **dropped whole**. The strokes in their box fall back to geometric order, and the element does not disappear.
pub fn whiteboard_params(
    props: &WhiteboardProps,
    draw: f64,
) -> render_raster::source::WhiteboardParams {
    let norm = |secs: f64| (secs / draw).clamp(0.0, 1.0);
    render_raster::source::WhiteboardParams {
        ink_first: props.ink_first(),
        beats: props
            .beats
            .iter()
            .flatten()
            .filter_map(|beat| {
                let at = beat.at_local()?;
                if matches!(beat.end, Some(TimeValue::Anchor(_))) {
                    return None;
                }
                Some(render_raster::source::WhiteboardBeat {
                    at: norm(at),
                    end: beat.end_local().map(norm),
                    rect: beat.rect,
                })
            })
            .collect(),
        pace: match props.pace() {
            WhiteboardPace::Stretch => render_raster::source::WhiteboardPace::Stretch,
            WhiteboardPace::Natural => render_raster::source::WhiteboardPace::Natural,
        },
        strict: props.strict(),
        draw_seconds: draw,
    }
}

/// The `hand` attribute → the kernel's pen style.
pub fn whiteboard_hand(props: &WhiteboardProps) -> render_raster::source::WhiteboardHand {
    match props.hand() {
        WhiteboardHand::Marker => render_raster::source::WhiteboardHand::Marker,
        WhiteboardHand::Pen => render_raster::source::WhiteboardHand::Pen,
        WhiteboardHand::None => render_raster::source::WhiteboardHand::None,
    }
}

/// The `paper` attribute → paper color (non-premultiplied RGBA 0..1). Absent or invalid means transparent.
pub fn whiteboard_paper(props: &WhiteboardProps) -> Option<Color4> {
    props
        .paper
        .as_deref()
        .and_then(|hex| crate::draw::parse_color(hex, 1.0))
}

/// Element-local progress: `(time − start) / draw`. It stays at 1 once drawing is complete.
pub fn whiteboard_progress(element: &ElementDraw<'_>, time: f64, draw: f64) -> f64 {
    ((time - element.start) / draw).clamp(0.0, 1.0)
}

/// The `aspect` declared by a catalog-style recipe → the geometry default table in `timeline` (ADR-E01).
///
/// Only the visualizer and progress kinds have this dimension. Other kinds get their height from the shape and sticker branches and return `None`. When the style is not registered, this also returns `None`, and geometry falls back to the default for its horizontal-bar class. The `preset-unknown` diagnostic is issued by the drawing branch.
pub fn element_aspect(element: &ElementDraw<'_>) -> Option<timeline::ElementAspect> {
    use motion::preset_registry::{ProgressAspect, VisualizerAspect};
    use timeline::ElementAspect;
    match element.kind {
        ElementKind::Visualizer => {
            let recipe = motion::preset_registry::timeline_visualizer(&element.visualizer?.style)?;
            Some(match recipe.visualizer()?.aspect {
                VisualizerAspect::Free => ElementAspect::Free,
                VisualizerAspect::Square => ElementAspect::Square,
            })
        }
        ElementKind::Progress => {
            let recipe = motion::preset_registry::timeline_progress(&element.progress?.style)?;
            Some(match recipe.progress()?.aspect {
                ProgressAspect::Bar => ElementAspect::Bar,
                ProgressAspect::Square => ElementAspect::Square,
                ProgressAspect::Frame => ElementAspect::Frame,
            })
        }
        // confetti is always `frame` (covers the full frame). When the style is not registered, it likewise falls back to the geometry default table.
        ElementKind::Confetti => {
            motion::preset_registry::timeline_confetti(&element.confetti?.style)?;
            Some(ElementAspect::Frame)
        }
        _ => None,
    }
}

/// Element box plus affine transform. All geometry comes from `timeline` (the single source for ADR-E01), so the stage selection box and the export pixels cannot be computed as two different boxes.
pub fn element_frame(
    element: &ElementDraw<'_>,
    pose: &timeline::AnimationPose,
    stage: Stage,
) -> (ElementBox, Mat6) {
    let canvas = stage.canvas();
    let geometry = timeline::ElementGeometry {
        shape: element.shape,
        sticker: element.sticker,
        // The `aspect` for visualizer and progress comes from the catalog-style recipe (in the registry since P2). Without reading it, `ring_bars` / `circle` / `donut` would get the horizontal-bar default box, and the geometry default table and the drawing side would disagree.
        aspect: element_aspect(element),
    };
    let (x, y, w, h) = timeline::static_box(element.kind, &geometry, Some(element.place), canvas);
    let bbox = ElementBox { x, y, w, h };
    let element_pose = ElementPose {
        dx: pose.dx,
        dy: pose.dy,
        scale_x: pose.scale_x,
        scale_y: pose.scale_y,
        rotation: pose.rotation,
    };
    let tf = crate::draw::element_transform(element.place, &element_pose, bbox, canvas);
    (bbox, tf)
}

pub fn element_opacity(element: &ElementDraw<'_>, pose: &timeline::AnimationPose) -> f64 {
    (element.place.opacity.unwrap_or(1.0) * pose.opacity).clamp(0.0, 1.0)
}

/// `kind: "shape"`: the registry's shape recipe + `ShapeProps` → direct vector output.
pub fn push_shape_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) {
    let Some(props) = element.shape else {
        return;
    };
    let Some(recipe) = motion::preset_registry::timeline_shape(&props.shape) else {
        // No such id in the registry means the document references a nonexistent shape. That is the timing of `preset-unknown` (§5.3), not `manifest-invalid`, which means the recipe file itself is invalid.
        warn(format!(
            "元素 {} 引用了未登记的形状 {}（preset-unknown），已跳过渲染",
            element.id, props.shape
        ));
        return;
    };
    let opacity = element_opacity(element, pose);
    if opacity <= 0.001 {
        return;
    }
    let (bbox, tf) = element_frame(element, pose, stage);
    let short_edge = stage.short_edge();
    if push_shape_ops(builder, recipe, props, bbox, tf, opacity, short_edge) == 0 {
        warn(format!(
            "元素 {} 的形状 {} 既没有 fill 也没有 stroke，画不出任何东西",
            element.id, props.shape
        ));
    }
}

/// `kind: "sticker"` with `source == "template"`: the registry's template recipe → direct vector output.
///
/// **Only the `template` source is accepted.** `asset` sources (PNG / JPEG / SVG / looping WebM with alpha) must be decoded before emitting `DrawMedia`. That requires an image decoder and ffmpeg, so it belongs to the host, on the same path as `image` / `video`. Returning `false` means "this crate does not claim it".
///
/// The element box is **square** (the sticker default in `element_height`), and the template geometry is also drawn in a unit square, so no `element_aspect` recipe lookup is needed here.
pub fn push_sticker_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) -> bool {
    let Some(props) = element.sticker else {
        return false;
    };
    if props.source != timeline::schema::STICKER_SOURCE_TEMPLATE {
        return false;
    }
    let Some(template_id) = props.template_id.as_deref() else {
        warn(format!(
            "元素 {} 的 sticker.source=template 但没有 templateId，已跳过渲染",
            element.id
        ));
        return true;
    };
    let Some(recipe) = motion::preset_registry::timeline_sticker(template_id) else {
        // Same timing and same code as shape / visualizer: the document references a template that is not in the registry.
        warn(format!(
            "元素 {} 引用了未登记的贴纸模板 {template_id}（preset-unknown），已跳过渲染",
            element.id
        ));
        return true;
    };
    let opacity = element_opacity(element, pose);
    if opacity <= 0.001 {
        return true;
    }
    let (bbox, tf) = element_frame(element, pose, stage);
    crate::draw::push_sticker_ops(builder, recipe, props, bbox, tf, opacity);
    true
}

enum ResolvedElement<T> {
    Ready(T),
    Placeholder,
    Skip,
}

struct VisualizerInput {
    recipe: &'static motion::preset_registry::CatalogueRecipe,
    params: render_raster::source::VisualizerParams,
    frame: render_raster::source::VizFrame,
    bbox: ElementBox,
    affine: Mat6,
    local_time: f64,
}

struct ProgressInput {
    recipe: &'static motion::preset_registry::CatalogueRecipe,
    params: render_raster::source::ProgressParams,
    progress: f64,
    bbox: ElementBox,
    affine: Mat6,
    local_time: f64,
}

struct ConfettiInput {
    recipe: &'static motion::preset_registry::CatalogueRecipe,
    params: render_raster::source::ConfettiParams,
    bbox: ElementBox,
    affine: Mat6,
    local_time: f64,
    /// Element duration (used by `emit.settle`). `None` for an open-ended tail.
    duration: Option<f64>,
}

fn resolved_color(explicit: Option<&str>, fallback: &str, opacity: f64) -> [f32; 4] {
    explicit
        .and_then(|value| parse_color(value, opacity))
        .or_else(|| parse_color(fallback, opacity))
        .unwrap_or([1.0, 1.0, 1.0, opacity as f32])
}

fn resolve_visualizer(
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    track: Option<&render_raster::source::VizTrack>,
    source_time: Option<f64>,
    warn: WarnSink<'_>,
) -> ResolvedElement<VisualizerInput> {
    let Some(props) = element.visualizer else {
        return ResolvedElement::Skip;
    };
    let Some(recipe) = motion::preset_registry::timeline_visualizer(&props.style) else {
        warn(format!(
            "元素 {} 引用了未登记的波形样式 {}（preset-unknown），已跳过渲染",
            element.id, props.style
        ));
        return ResolvedElement::Skip;
    };
    let opacity = element_opacity(element, pose);
    if opacity <= 0.001 {
        return ResolvedElement::Skip;
    }
    let Some(track) = track else {
        // A missing spectrum during preflight is a hard error (the host's `load_visualizer_tracks`). Reaching this point can only mean "a plan that did not go through preflight", as with `compile_with` in unit tests.
        warn(format!("元素 {} 没有注入频谱轨，已画占位块", element.id));
        return ResolvedElement::Placeholder;
    };
    let frame = match source_time {
        Some(source_time) => {
            let Some(frame) = render_raster::source::VizSource::sample(track, source_time) else {
                warn(format!("元素 {} 的频谱轨是空的，已画占位块", element.id));
                return ResolvedElement::Placeholder;
            };
            frame.clone()
        }
        None => track.silent_frame(),
    };
    let body = recipe
        .visualizer()
        .expect("visualizer 目录里只有 visualizer 配方");
    let params = render_raster::source::VisualizerParams {
        main_color: resolved_color(
            props.main_color.as_deref(),
            &body.default_main_color,
            opacity,
        ),
        secondary_color: resolved_color(
            props.secondary_color.as_deref(),
            &body.default_secondary_color,
            opacity,
        ),
    };
    let (bbox, affine) = element_frame(element, pose, stage);
    ResolvedElement::Ready(VisualizerInput {
        recipe,
        params,
        frame,
        bbox,
        affine,
        // Element-local time (scanline / noise phase) is determined only by its own start.
        local_time: (time - element.start).max(0.0),
    })
}

fn resolve_progress(
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) -> ResolvedElement<ProgressInput> {
    let Some(props) = element.progress else {
        return ResolvedElement::Skip;
    };
    let Some(recipe) = motion::preset_registry::timeline_progress(&props.style) else {
        warn(format!(
            "元素 {} 引用了未登记的进度样式 {}（preset-unknown），已跳过渲染",
            element.id, props.style
        ));
        return ResolvedElement::Skip;
    };
    let opacity = element_opacity(element, pose);
    if opacity <= 0.001 {
        return ResolvedElement::Skip;
    }
    let body = recipe
        .progress()
        .expect("progress 目录里只有 progress 配方");
    let params = render_raster::source::ProgressParams {
        main_color: resolved_color(
            props.main_color.as_deref(),
            &body.default_main_color,
            opacity,
        ),
        secondary_color: resolved_color(
            props.secondary_color.as_deref(),
            &body.default_secondary_color,
            opacity,
        ),
        pixel_scale: stage.short_edge() / timeline::REFERENCE_SHORT_EDGE,
    };
    let (bbox, affine) = element_frame(element, pose, stage);
    ResolvedElement::Ready(ProgressInput {
        recipe,
        params,
        progress: props.remap(timeline::progress_at(time, element.start, element.end)),
        bbox,
        affine,
        local_time: (time - element.start).max(0.0),
    })
}

fn resolve_confetti(
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) -> ResolvedElement<ConfettiInput> {
    use render_raster::source::{ConfettiEmitMode, ConfettiEmitOverride, ConfettiShape};
    let Some(props) = element.confetti else {
        return ResolvedElement::Skip;
    };
    let Some(recipe) = motion::preset_registry::timeline_confetti(&props.style) else {
        warn(format!(
            "元素 {} 引用了未登记的彩纸样式 {}（preset-unknown），已跳过渲染",
            element.id, props.style
        ));
        return ResolvedElement::Skip;
    };
    let opacity = element_opacity(element, pose) * props.opacity.unwrap_or(1.0);
    if opacity <= 0.001 {
        return ResolvedElement::Skip;
    }
    let body = recipe
        .confetti()
        .expect("confetti 目录里只有 confetti 配方");
    // Color and shape tables: if the user wrote one, it replaces the whole table; otherwise the recipe's is used. `validate` has already guaranteed non-empty. Here a single bad value is only skipped (a color that does not parse is not drawn, an unknown shape is not drawn).
    let color_names: &[String] = match &props.colors {
        Some(colors) if !colors.is_empty() => colors,
        _ => &body.palette,
    };
    let colors: Vec<[f32; 4]> = color_names
        .iter()
        .filter_map(|c| parse_color(c, 1.0))
        .collect();
    let shape_names: &[String] = match &props.shapes {
        Some(shapes) if !shapes.is_empty() => shapes,
        _ => &body.shapes,
    };
    let shapes: Vec<ConfettiShape> = shape_names
        .iter()
        .filter_map(|s| ConfettiShape::parse(s))
        .collect();
    if colors.is_empty() || shapes.is_empty() {
        return ResolvedElement::Skip;
    }
    let emit = props.emit.as_ref();
    let params = render_raster::source::ConfettiParams {
        seed: props.seed.unwrap_or(0),
        colors,
        shapes,
        size: props.size.unwrap_or(1.0),
        speed: props.speed.unwrap_or(1.0),
        gravity: props.gravity.unwrap_or(1.0),
        drift: props.drift.unwrap_or(1.0),
        spin: props.spin.unwrap_or(1.0),
        wind: props.wind.unwrap_or(0.0),
        opacity,
        emit: ConfettiEmitOverride {
            mode: emit.and_then(|e| e.mode).map(|m| match m {
                timeline::schema::ConfettiEmitMode::Continuous => ConfettiEmitMode::Continuous,
                timeline::schema::ConfettiEmitMode::Burst => ConfettiEmitMode::Burst,
            }),
            rate: emit.and_then(|e| e.rate),
            count: emit
                .and_then(|e| e.count)
                .map(|c| c.round().max(1.0) as u64),
            interval: emit.and_then(|e| e.interval),
            settle: emit.and_then(|e| e.settle).unwrap_or(false),
        },
        origin: props.origin.as_ref().map(|o| (o.x, o.y)),
        angle: props.angle,
        spread: props.spread,
        pixel_scale: stage.short_edge() / timeline::REFERENCE_SHORT_EDGE,
    };
    let (bbox, affine) = element_frame(element, pose, stage);
    let span = element.end - element.start;
    ResolvedElement::Ready(ConfettiInput {
        recipe,
        params,
        bbox,
        affine,
        local_time: time - element.start,
        duration: (span.is_finite() && span > 0.0).then_some(span),
    })
}

fn push_confetti_reference(builder: &mut FrameBuilder, input: &ConfettiInput) {
    // An empty frame (nothing emitted yet / everything has already landed) legitimately produces zero instructions.
    let _ = render_raster::source::confetti_frame(
        builder,
        input.recipe,
        &input.params,
        input.local_time,
        input.duration,
        render_raster::source::ConfettiBox {
            x: input.bbox.x,
            y: input.bbox.y,
            w: input.bbox.w,
            h: input.bbox.h,
        },
        input.affine,
    );
}

/// `kind: "confetti"`: the `confetti-v1` closed-form motion kernel → direct vector output (design draft §5).
///
/// It uses the same path as progress: the CPU emits `ClipPath + FillPath × N + PopClip`, and the GPU side automatically lands `SceneNode::Vectors`. Local time = `t − start`, and the particle table is determined only by it and `seed`, so out-of-order sampling equals sequential sampling.
pub fn push_confetti_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) {
    if let ResolvedElement::Ready(input) = resolve_confetti(element, time, pose, stage, warn) {
        push_confetti_reference(builder, &input);
    }
}

fn push_visualizer_reference(builder: &mut FrameBuilder, input: &VisualizerInput) {
    // Each of the 10 visualizer styles has its own resting form when the audio is silent (bars keep minHeight, the oscilloscope keeps the center line, …). ccut-render's goldens pin each style. A degenerate box (zero width or height) legitimately returns 0 instructions. Whether a recipe is fully implemented is guaranteed by the catalog tests over there. We do not treat one frame's instruction count as a runtime invariant.
    let _ = render_raster::source::visualizer_frame(
        builder,
        input.recipe,
        &input.params,
        &input.frame,
        input.local_time,
        render_raster::source::VizBox {
            x: input.bbox.x,
            y: input.bbox.y,
            w: input.bbox.w,
            h: input.bbox.h,
        },
        input.affine,
    );
}

fn push_progress_reference(builder: &mut FrameBuilder, input: &ProgressInput) {
    // `pushed == 0` can only happen for a strobe with no background at its own empty endpoint. That is a legitimate picture.
    let _ = render_raster::source::progress_frame(
        builder,
        input.recipe,
        &input.params,
        input.progress,
        input.local_time,
        render_raster::source::ProgressBox {
            x: input.bbox.x,
            y: input.bbox.y,
            w: input.bbox.w,
            h: input.bbox.h,
        },
        input.affine,
    );
}

/// `visualizer`: sampling of the injected [`render_raster::source::VizTrack`] → recipe drawing.
///
/// The data path was made to work in P2 (BCS1 read in preflight, whole track derived, injected by element id). P3–P5b filled in the drawing family by family. **After P5b all 15 have implementations**, so only two real failures fall back to the placeholder block: "no spectrum track was injected" and "the spectrum track is empty". Leaving it blank would make "the waveform I added didn't draw" and "this project's spectrum isn't ready" indistinguishable on screen.
///
/// ## Sampling time (P3 decision)
///
/// The meaning of `audio: "project"` is "the sound the viewer hears at this moment", but BCS1 is computed over the **entire source media**. So the output time `time` must first be converted back to source-media time through [`timeline::TimelineProjection::timeline_to_source`] before fetching the frame. In a trimmed project, output second 7 may correspond to source second 12. Looking up the table directly with output time would draw "sound from several seconds ago". The conversion is the host's job, and its result is passed in as `source_time`. `None` means the conversion does not land on this element's audio source (it falls in a cut gap, or another source is playing at that moment). It is treated as a **silent frame**: for bar-style styles, `max(freq, minHeight)` draws a row of small bars, matching how a real silent passage looks.
///
/// The smoothing recurrence is **not affected**. It is computed once over the whole track along the source-media timeline during host preflight (`VizTrack::derive`), so at sampling time only lookups remain. The determinism and out-of-order sampling contracts are unchanged.
pub fn push_visualizer_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    track: Option<&render_raster::source::VizTrack>,
    source_time: Option<f64>,
    warn: WarnSink<'_>,
) {
    match resolve_visualizer(element, time, pose, stage, track, source_time, warn) {
        ResolvedElement::Ready(input) => push_visualizer_reference(builder, &input),
        ResolvedElement::Placeholder => {
            push_element_placeholder(builder, element, pose, stage, warn)
        }
        ResolvedElement::Skip => {}
    }
}

/// `kind: "progress"`: progress value + catalog-style recipe → direct vector output.
///
/// The progress value comes from [`timeline::progress_at`] (ADR-E04's `clamp((t − start) / (end − start), 0, 1)`).
pub fn push_progress_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) {
    if let ResolvedElement::Ready(input) = resolve_progress(element, time, pose, stage, warn) {
        push_progress_reference(builder, &input);
    }
}

pub fn push_draw_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    pose: &timeline::AnimationPose,
    stage: Stage,
) {
    let Some(props) = element.draw else {
        return;
    };
    let opacity = element_opacity(element, pose);
    if opacity <= 0.001 {
        return;
    }
    let (bbox, tf) = element_frame(element, pose, stage);
    push_draw_ops(builder, props, bbox, tf, opacity, stage.short_edge());
}

pub fn push_placeholder_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    pose: &timeline::AnimationPose,
    stage: Stage,
) -> bool {
    if element.has_source {
        return false;
    }
    let Some(props) = element.placeholder else {
        return true;
    };
    let opacity = element_opacity(element, pose);
    if opacity <= 0.001 {
        return true;
    }
    let (bbox, tf) = element_frame(element, pose, stage);
    push_media_placeholder_ops(builder, props, bbox, tf, opacity);
    true
}

/// Placeholder for `visualizer` when spectrum data is missing: the main color (default semi-transparent white) fills the element box.
///
/// **Deliberately not left empty.** Leaving it empty would make "the waveform I added didn't draw" and "this project's spectrum isn't ready" indistinguishable on screen. After P5b all 29 styles have drawing implementations, so reaching this point means only one of two real failures: "no spectrum track was injected" or "the spectrum track is empty". (`progress` does not consume material, so it never reaches here.)
pub fn push_element_placeholder(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    pose: &timeline::AnimationPose,
    stage: Stage,
    warn: WarnSink<'_>,
) {
    let opacity = element_opacity(element, pose) * 0.35;
    if opacity <= 0.001 {
        return;
    }
    let (style, main_color) = match element.kind {
        ElementKind::Visualizer => match element.visualizer {
            Some(props) => (props.style.clone(), props.main_color.clone()),
            None => return,
        },
        _ => match element.progress {
            Some(props) => (props.style.clone(), props.main_color.clone()),
            None => return,
        },
    };
    warn(format!(
        "元素 {} 的 {} 样式 {style} 没有可用的频谱数据，已画占位块",
        element.id,
        element.kind.as_str()
    ));
    let color = main_color
        .as_deref()
        .and_then(|color| parse_color(color, opacity))
        .unwrap_or([1.0, 1.0, 1.0, opacity as f32]);
    let (bbox, tf) = element_frame(element, pose, stage);
    push_placeholder_ops(builder, bbox, tf, color);
}

/// Dispatch by kind. The direct-vector kinds are handled here. The rest (text / image / video / audio and **asset-source stickers**) are handled by the host's own rasterization path, and this function skips them as-is.
///
/// Returns `true` when this element is this crate's responsibility. The host uses this for explicit dispatch rather than copying the kind table into a `match`. **Sticker is the only kind claimed by props rather than by kind**: the two `source` values of the same kind take two completely different paths (P7b).
pub fn push_element(
    builder: &mut FrameBuilder,
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    track: Option<&render_raster::source::VizTrack>,
    source_time: Option<f64>,
    warn: WarnSink<'_>,
) -> bool {
    match element.kind {
        ElementKind::Shape => {
            push_shape_element(builder, element, pose, stage, warn);
            true
        }
        ElementKind::Visualizer => {
            push_visualizer_element(
                builder,
                element,
                time,
                pose,
                stage,
                track,
                source_time,
                warn,
            );
            true
        }
        ElementKind::Progress => {
            push_progress_element(builder, element, time, pose, stage, warn);
            true
        }
        ElementKind::Confetti => {
            push_confetti_element(builder, element, time, pose, stage, warn);
            true
        }
        ElementKind::Draw => {
            push_draw_element(builder, element, pose, stage);
            true
        }
        ElementKind::Placeholder => push_placeholder_element(builder, element, pose, stage),
        ElementKind::Sticker => push_sticker_element(builder, element, pose, stage, warn),
        // whiteboard takes the same path as image: host rasterization (the reveal is done inside `render_media_element`).
        ElementKind::Text
        | ElementKind::Image
        | ElementKind::Video
        | ElementKind::Audio
        | ElementKind::Whiteboard => false,
    }
}

/// The execution node of a single element in the live scene, together with a DrawOp reference that is fully homologous to the existing CPU / three-end fingerprint. `reference` is used only for consistency, fallback and fingerprinting. GPU nodes do not rasterize it into a whole-frame bitmap.
#[derive(Debug, Clone)]
pub struct EvaluatedSceneElement {
    pub node: Option<SceneNode>,
    pub reference: Arc<FrameOps>,
}

impl EvaluatedSceneElement {
    /// Merges the reference this element has already computed into the whole-frame fingerprint stream. It only remaps the four side tables and no longer invokes the element recipe. That way SceneFrame keeps the per-node z-order, and visualizer / progress do not have to be evaluated again just for fingerprinting. The reference carries full DrawOp semantics and should not be constrained backwards by the subset the GPU executor currently supports (rounded progress already contains a ClipPath).
    pub fn append_reference_to(&self, builder: &mut FrameBuilder) -> Result<()> {
        let path_ids = self
            .reference
            .paths
            .iter()
            .cloned()
            .map(|path| builder.path_id(path))
            .collect::<Vec<_>>();
        let string_ids = self
            .reference
            .strings
            .iter()
            .map(|value| builder.string_id(value))
            .collect::<Vec<_>>();
        let paint_ids = self
            .reference
            .paints
            .iter()
            .cloned()
            .map(|paint| builder.paint_id(paint))
            .collect::<Vec<_>>();
        let bitmap_ids = self
            .reference
            .bitmaps
            .iter()
            .cloned()
            .map(|bitmap| builder.bitmap_id(bitmap))
            .collect::<Vec<_>>();
        for op in &self.reference.ops {
            let remapped = match op {
                DrawOp::Clear { .. }
                | DrawOp::FillRect { .. }
                | DrawOp::PushLayer { .. }
                | DrawOp::PopLayer
                | DrawOp::PopClip
                | DrawOp::PushMatte
                | DrawOp::PopMatte { .. } => op.clone(),
                DrawOp::FillPath { path, color, tf } => DrawOp::FillPath {
                    path: *path_ids.get(*path as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference FillPath 引用未知 path {path}")
                    })?,
                    color: *color,
                    tf: *tf,
                },
                DrawOp::StrokePath {
                    path,
                    color,
                    width,
                    tf,
                } => DrawOp::StrokePath {
                    path: *path_ids.get(*path as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference StrokePath 引用未知 path {path}")
                    })?,
                    color: *color,
                    width: *width,
                    tf: *tf,
                },
                DrawOp::DrawMedia {
                    asset,
                    media_ms,
                    src,
                    tf,
                } => DrawOp::DrawMedia {
                    asset: *string_ids.get(*asset as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference DrawMedia 引用未知 asset {asset}")
                    })?,
                    media_ms: *media_ms,
                    src: *src,
                    tf: *tf,
                },
                DrawOp::ClipPath { path, tf } => DrawOp::ClipPath {
                    path: *path_ids.get(*path as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference ClipPath 引用未知 path {path}")
                    })?,
                    tf: *tf,
                },
                DrawOp::FillPathPaint {
                    path,
                    paint,
                    even_odd,
                    tf,
                } => DrawOp::FillPathPaint {
                    path: *path_ids.get(*path as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference FillPathPaint 引用未知 path {path}")
                    })?,
                    paint: *paint_ids.get(*paint as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference FillPathPaint 引用未知 paint {paint}")
                    })?,
                    even_odd: *even_odd,
                    tf: *tf,
                },
                DrawOp::StrokePathPaint {
                    path,
                    paint,
                    width,
                    cap,
                    join,
                    miter,
                    tf,
                } => DrawOp::StrokePathPaint {
                    path: *path_ids.get(*path as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference StrokePathPaint 引用未知 path {path}")
                    })?,
                    paint: *paint_ids.get(*paint as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference StrokePathPaint 引用未知 paint {paint}")
                    })?,
                    width: *width,
                    cap: *cap,
                    join: *join,
                    miter: *miter,
                    tf: *tf,
                },
                DrawOp::DrawBitmap {
                    bitmap,
                    opacity,
                    tf,
                } => DrawOp::DrawBitmap {
                    bitmap: *bitmap_ids.get(*bitmap as usize).ok_or_else(|| {
                        anyhow::anyhow!("scene reference DrawBitmap 引用未知 bitmap {bitmap}")
                    })?,
                    opacity: *opacity,
                    tf: *tf,
                },
            };
            builder.push(remapped);
        }
        Ok(())
    }
}

/// Derives both the CPU reference and the live GPU node from the same element input.
///
/// shape and template stickers continue as vector DrawOps. progress becomes a `ShaderQuad`. All 10 visualizer styles are CPU vector recipes and, like shape, land in `SceneNode::Vectors`. In degraded scenarios such as missing spectrum, the CPU placeholder DrawOp is used as-is. text / image / video / audio and asset stickers return `None`, explicitly left to host / R2 / R4, and are not silently swallowed into R1.
#[allow(clippy::too_many_arguments)]
pub fn evaluate_scene_element(
    element: &ElementDraw<'_>,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    track: Option<&render_raster::source::VizTrack>,
    source_time: Option<f64>,
    warn: WarnSink<'_>,
) -> Result<Option<EvaluatedSceneElement>> {
    let mut builder = FrameBuilder::default();
    let shader = match element.kind {
        ElementKind::Visualizer => {
            match resolve_visualizer(element, time, pose, stage, track, source_time, warn) {
                ResolvedElement::Ready(input) => {
                    push_visualizer_reference(&mut builder, &input);
                    None
                }
                ResolvedElement::Placeholder => {
                    push_element_placeholder(&mut builder, element, pose, stage, warn);
                    None
                }
                ResolvedElement::Skip => None,
            }
        }
        ElementKind::Progress => match resolve_progress(element, time, pose, stage, warn) {
            ResolvedElement::Ready(input) => {
                push_progress_reference(&mut builder, &input);
                let quad = ShaderQuad::progress(
                    input.recipe,
                    &input.params,
                    input.progress,
                    input.local_time,
                    DrawBox {
                        x: input.bbox.x,
                        y: input.bbox.y,
                        w: input.bbox.w,
                        h: input.bbox.h,
                    },
                    stage.canvas(),
                )?;
                Some(SceneNode::affine_shader_quad(
                    quad,
                    input.affine,
                    stage.canvas(),
                ))
            }
            ResolvedElement::Placeholder | ResolvedElement::Skip => None,
        },
        _ => {
            if !push_element(
                &mut builder,
                element,
                time,
                pose,
                stage,
                track,
                source_time,
                warn,
            ) {
                return Ok(None);
            }
            None
        }
    };
    let reference = Arc::new(builder.finish());
    let node = shader
        .or_else(|| (!reference.ops.is_empty()).then(|| SceneNode::Vectors(reference.clone())));
    Ok(Some(EvaluatedSceneElement { node, reference }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use timeline::AnimationPose;

    /// ADR-WB05's default drawing time is unchanged: for a 12 s bar with 4 s natural drawing time, it draws for 4 s. For a short bar it takes 0.8 × the duration. The kernel parameters produced by the 0.9 default (no beats, `pace` absent) are the 0.8 geometric order plus stretch.
    #[test]
    fn whiteboard_default_draw_and_params_are_unchanged_by_0_9() {
        let props = WhiteboardProps::default();
        assert_eq!(whiteboard_draw_seconds(&props, 12.0, 4.0), 4.0);
        assert_eq!(whiteboard_draw_seconds(&props, 4.0, 4.0), 3.2);
        assert_eq!(whiteboard_draw_seconds(&props, f64::INFINITY, 4.0), 4.0);
        let params = whiteboard_params(&props, 4.0);
        assert!(params.beats.is_empty());
        assert_eq!(params.pace, render_raster::source::WhiteboardPace::Stretch);
        assert!(!params.strict);
        assert_eq!(params.draw_seconds, 4.0);
        assert!(!params.needs_second_pass());
        let baseline = params.clone().beats_cleared();
        assert_eq!(baseline.draw_seconds, 0.0);
        assert!(baseline.beats.is_empty());
    }

    /// 0.9: `end` and `at` are both normalized by `draw`. Beats that are still anchors are dropped whole. `pace` and `strict` are passed through.
    #[test]
    fn whiteboard_params_normalize_end_and_drop_unresolved_anchor_beats() {
        let props: WhiteboardProps = serde_json::from_value(serde_json::json!({
            "draw": 8.0,
            "pace": "natural",
            "strict": true,
            "beats": [
                {"at": 0.0, "end": 2.0, "box": [0, 0, 50, 100]},
                {"at": "~main:g1.3:start", "box": [50, 0, 50, 100]},
                {"at": 4.0, "end": "~main:g1.9:end", "box": [0, 50, 100, 50]},
                {"at": 6.0, "box": [0, 0, 100, 100]}
            ]
        }))
        .unwrap();
        let params = whiteboard_params(&props, 8.0);
        assert_eq!(params.pace, render_raster::source::WhiteboardPace::Natural);
        assert!(params.strict);
        assert_eq!(params.draw_seconds, 8.0);
        assert_eq!(params.beats.len(), 2);
        assert_eq!(params.beats[0].at, 0.0);
        assert_eq!(params.beats[0].end, Some(0.25));
        assert_eq!(params.beats[1].at, 0.75);
        assert_eq!(params.beats[1].end, None);
        assert!(params.needs_second_pass());
    }

    fn pose() -> AnimationPose {
        timeline::resolve_animation_pose(None, 0.0, Some(4.0), 4.0, 1.0, 30.0)
    }

    fn shape_props(shape: &str) -> ShapeProps {
        let mut props = ShapeProps::new(shape);
        props.fill = Some("#ff0000".to_owned());
        props
    }

    fn view<'a>(
        id: &'a str,
        kind: ElementKind,
        place: &'a Place,
        shape: Option<&'a ShapeProps>,
        visualizer: Option<&'a VisualizerProps>,
        progress: Option<&'a ProgressProps>,
    ) -> ElementDraw<'a> {
        ElementDraw {
            id,
            kind,
            start: 0.0,
            end: 4.0,
            place,
            shape,
            sticker: None,
            visualizer,
            progress,
            draw: None,
            placeholder: None,
            confetti: None,
            whiteboard: None,
            has_source: false,
        }
    }

    /// An unregistered style = `preset-unknown`: one diagnostic, zero instructions.
    #[test]
    fn an_unregistered_style_warns_and_draws_nothing() {
        let place = Place::default();
        let props = shape_props("no-such-shape");
        let element = view("e1", ElementKind::Shape, &place, Some(&props), None, None);
        let mut builder = FrameBuilder::default();
        let mut warnings = Vec::new();
        push_shape_element(
            &mut builder,
            &element,
            &pose(),
            Stage::new(1920, 1080),
            &mut |message| warnings.push(message),
        );
        assert!(builder.frame.ops.is_empty());
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("preset-unknown"), "{}", warnings[0]);
    }

    /// `aspect` determines which tier of the geometry default table applies. A square style's box must be square; a horizontal-bar style's box must not be.
    #[test]
    fn the_recipe_aspect_picks_the_geometry_default() {
        let place = Place::default();
        let square = VisualizerProps::new("ring_bars");
        let bar = VisualizerProps::new("bars");
        let stage = Stage::new(1920, 1080);
        let (square_box, _) = element_frame(
            &view(
                "a",
                ElementKind::Visualizer,
                &place,
                None,
                Some(&square),
                None,
            ),
            &pose(),
            stage,
        );
        let (bar_box, _) = element_frame(
            &view("b", ElementKind::Visualizer, &place, None, Some(&bar), None),
            &pose(),
            stage,
        );
        // The default boxes of the two tiers **must differ**. Without reading `aspect`, `ring_bars` would get the horizontal-bar-class box, and the geometry default table and the drawing side would disagree from then on.
        assert_ne!(
            (square_box.w, square_box.h),
            (bar_box.w, bar_box.h),
            "square 与 free 两档必须落在几何默认表的不同一行"
        );
        // The `square` tier is taller and vertically centered. The `free` tier is a horizontal bar anchored to the bottom.
        assert!(
            square_box.h > bar_box.h && square_box.y < bar_box.y,
            "square 档应更高且不贴底：{square_box:?} / {bar_box:?}"
        );
    }

    /// No injected spectrum track ⇒ two diagnostics plus a placeholder block (not blank).
    #[test]
    fn a_visualizer_without_a_track_falls_back_to_the_placeholder_block() {
        let place = Place::default();
        let props = VisualizerProps::new("bars");
        let element = view(
            "v1",
            ElementKind::Visualizer,
            &place,
            None,
            Some(&props),
            None,
        );
        let mut builder = FrameBuilder::default();
        let mut warnings = Vec::new();
        push_visualizer_element(
            &mut builder,
            &element,
            1.0,
            &pose(),
            Stage::new(1920, 1080),
            None,
            Some(1.0),
            &mut |message| warnings.push(message),
        );
        assert_eq!(builder.frame.ops.len(), 1, "占位块是一条 FillRect");
        assert_eq!(warnings.len(), 2);
        assert!(warnings[0].contains("没有注入频谱轨"));
        assert!(warnings[1].contains("没有可用的频谱数据"));
    }

    /// On silent frames, each style draws its **resting form** (the oscilloscope centerline, the ribbon centerline, the `minHeight` baseline of the spectrum area), not an empty picture. Non-silent frames on the same track must still render normally. The element does not vanish from the canvas during intros or silent passages, and the resting form is not mistaken for "recipe not implemented" and used to kill the App's overlay thread.
    #[test]
    fn silent_frames_draw_the_resting_shape_and_loud_frames_still_draw() {
        use render_raster::source::{VizFrame, VizParams, VizTrack};

        let track = VizTrack::assemble(
            10,
            vec![
                VizFrame::silent(128, 512),
                VizFrame {
                    time: vec![128; 128].into_boxed_slice(),
                    freq: vec![220; 512].into_boxed_slice(),
                },
            ],
            VizParams {
                min_db: -80.0,
                max_db: 40.0,
                smoothing: 0.0,
                gain: 1.0,
            },
            0,
        )
        .unwrap();
        let place = Place::default();
        let stage = Stage::new(1920, 1080);
        for style in ["oscilloscope", "ribbons", "spectrum_area"] {
            let props = VisualizerProps::new(style);
            let element = view(
                "v1",
                ElementKind::Visualizer,
                &place,
                None,
                Some(&props),
                None,
            );

            let mut silent = FrameBuilder::default();
            assert!(push_element(
                &mut silent,
                &element,
                0.0,
                &pose(),
                stage,
                Some(&track),
                Some(0.0),
                &mut |_| {},
            ));
            assert!(!silent.frame.ops.is_empty(), "{style}: 静音也要画静止形态");

            let mut loud = FrameBuilder::default();
            assert!(push_element(
                &mut loud,
                &element,
                0.1,
                &pose(),
                stage,
                Some(&track),
                Some(0.1),
                &mut |_| {},
            ));
            assert!(!loud.frame.ops.is_empty(), "{style}");
        }
    }

    /// `progress` does not consume material, so it draws a real picture even when no track is given.
    #[test]
    fn a_progress_element_draws_without_any_injected_data() {
        let place = Place::default();
        let props = ProgressProps::new("normal");
        let element = view(
            "p1",
            ElementKind::Progress,
            &place,
            None,
            None,
            Some(&props),
        );
        let mut builder = FrameBuilder::default();
        let mut warnings = Vec::new();
        push_progress_element(
            &mut builder,
            &element,
            2.0,
            &pose(),
            Stage::new(1920, 1080),
            &mut |message| warnings.push(message),
        );
        assert!(!builder.frame.ops.is_empty());
        assert!(warnings.is_empty(), "{warnings:?}");
    }

    #[test]
    fn scene_evaluation_keeps_the_cpu_reference_and_emits_an_affine_shader_quad() {
        let place = Place {
            rot: Some(30.0),
            ..Place::default()
        };
        let props = ProgressProps::new("normal");
        let element = view(
            "p1",
            ElementKind::Progress,
            &place,
            None,
            None,
            Some(&props),
        );
        let evaluated = evaluate_scene_element(
            &element,
            2.0,
            &pose(),
            Stage::new(1920, 1080),
            None,
            Some(2.0),
            &mut |_| {},
        )
        .unwrap()
        .expect("progress is compositor-owned");
        assert!(!evaluated.reference.ops.is_empty());
        let Some(SceneNode::ShaderQuad { quad, transform }) = evaluated.node else {
            panic!("progress should become a shader quad")
        };
        assert_eq!(quad.style, "normal");
        assert!(transform.transform[1].abs() > 0.01);
        assert!(transform.transform[4].abs() > 0.01);
    }

    /// All 10 visualizer styles are CPU vector recipes. Even with a track they land in `SceneNode::Vectors`, the same instruction stream as the CPU reference, and they do not go through `ShaderQuad`.
    #[test]
    fn scene_evaluation_keeps_visualizers_as_vectors_even_with_a_track() {
        use render_raster::source::{VizFrame, VizParams, VizTrack};

        let track = VizTrack::assemble(
            10,
            vec![VizFrame {
                time: vec![128; 128].into_boxed_slice(),
                freq: vec![220; 512].into_boxed_slice(),
            }],
            VizParams {
                min_db: -80.0,
                max_db: 40.0,
                smoothing: 0.0,
                gain: 1.0,
            },
            0,
        )
        .unwrap();
        let place = Place::default();
        for style in ["bars", "ring_bars", "oscilloscope", "pulse_rings"] {
            let props = VisualizerProps::new(style);
            let element = view(
                "v1",
                ElementKind::Visualizer,
                &place,
                None,
                Some(&props),
                None,
            );
            let evaluated = evaluate_scene_element(
                &element,
                0.0,
                &pose(),
                Stage::new(1920, 1080),
                Some(&track),
                Some(0.0),
                &mut |_| {},
            )
            .unwrap()
            .expect("visualizer is compositor-owned");
            let Some(SceneNode::Vectors(ops)) = evaluated.node else {
                panic!("{style}: visualizer should stay a vector node")
            };
            assert!(!ops.ops.is_empty(), "{style}");
            assert_eq!(ops.ops.len(), evaluated.reference.ops.len(), "{style}");
        }
    }

    #[test]
    fn scene_evaluation_uses_vector_fallback_when_visualizer_data_is_missing() {
        let place = Place::default();
        let props = VisualizerProps::new("bars");
        let element = view(
            "v1",
            ElementKind::Visualizer,
            &place,
            None,
            Some(&props),
            None,
        );
        let evaluated = evaluate_scene_element(
            &element,
            1.0,
            &pose(),
            Stage::new(1920, 1080),
            None,
            Some(1.0),
            &mut |_| {},
        )
        .unwrap()
        .expect("visualizer is compositor-owned");
        assert!(matches!(evaluated.node, Some(SceneNode::Vectors(_))));
        assert_eq!(evaluated.reference.ops.len(), 1);
    }

    #[test]
    fn scene_references_remap_path_ids_without_re_evaluating_elements() {
        let left_place = Place {
            x: Some(30.0),
            ..Place::default()
        };
        let right_place = Place {
            x: Some(70.0),
            ..Place::default()
        };
        let props = shape_props("ellipse");
        let left = view(
            "left",
            ElementKind::Shape,
            &left_place,
            Some(&props),
            None,
            None,
        );
        let right = view(
            "right",
            ElementKind::Shape,
            &right_place,
            Some(&props),
            None,
            None,
        );
        let stage = Stage::new(640, 360);

        let mut canonical = FrameBuilder::default();
        for element in [&left, &right] {
            assert!(push_element(
                &mut canonical,
                element,
                1.0,
                &pose(),
                stage,
                None,
                Some(1.0),
                &mut |_| {},
            ));
        }

        let mut merged = FrameBuilder::default();
        for element in [&left, &right] {
            evaluate_scene_element(element, 1.0, &pose(), stage, None, Some(1.0), &mut |_| {})
                .unwrap()
                .unwrap()
                .append_reference_to(&mut merged)
                .unwrap();
        }
        let canonical = canonical.finish();
        let merged = merged.finish();
        assert_eq!(merged.paths.len(), 2);
        assert_eq!(
            render_raster::fingerprint(&merged),
            render_raster::fingerprint(&canonical)
        );
    }

    #[test]
    fn scene_reference_keeps_rounded_progress_clip_ops_for_the_canonical_fingerprint() {
        let place = Place::default();
        let props = ProgressProps::new("rounded");
        let element = view(
            "rounded",
            ElementKind::Progress,
            &place,
            None,
            None,
            Some(&props),
        );
        let stage = Stage::new(640, 360);
        let mut canonical = FrameBuilder::default();
        assert!(push_element(
            &mut canonical,
            &element,
            1.0,
            &pose(),
            stage,
            None,
            Some(1.0),
            &mut |_| {},
        ));
        assert!(
            canonical
                .frame
                .ops
                .iter()
                .any(|op| matches!(op, DrawOp::ClipPath { .. }))
        );

        let evaluated =
            evaluate_scene_element(&element, 1.0, &pose(), stage, None, Some(1.0), &mut |_| {})
                .unwrap()
                .unwrap();
        let mut merged = FrameBuilder::default();
        evaluated.append_reference_to(&mut merged).unwrap();
        assert_eq!(
            render_raster::fingerprint(&merged.finish()),
            render_raster::fingerprint(&canonical.finish())
        );
    }

    /// Dispatch table: the three direct-vector kinds belong to this crate, and the other four belong to the host. `sticker` is not in this table, because it is split by props. The test below pins that separately.
    #[test]
    fn the_dispatch_table_claims_exactly_the_three_vector_kinds() {
        let place = Place::default();
        let props = shape_props("rect");
        for (kind, claimed) in [
            (ElementKind::Shape, true),
            (ElementKind::Visualizer, true),
            (ElementKind::Progress, true),
            (ElementKind::Text, false),
            (ElementKind::Image, false),
            (ElementKind::Video, false),
            (ElementKind::Audio, false),
        ] {
            let element = view("e", kind, &place, Some(&props), None, None);
            let mut builder = FrameBuilder::default();
            assert_eq!(
                push_element(
                    &mut builder,
                    &element,
                    1.0,
                    &pose(),
                    Stage::new(1920, 1080),
                    None,
                    Some(1.0),
                    &mut |_| {},
                ),
                claimed,
                "{kind:?}"
            );
        }
    }

    // ── Template stickers (P7b) ────────────────────────────────────────────

    fn sticker_view<'a>(place: &'a Place, props: &'a StickerProps) -> ElementDraw<'a> {
        ElementDraw {
            id: "st1",
            kind: ElementKind::Sticker,
            start: 0.0,
            end: 4.0,
            place,
            shape: None,
            sticker: Some(props),
            visualizer: None,
            progress: None,
            draw: None,
            placeholder: None,
            confetti: None,
            whiteboard: None,
            has_source: false,
        }
    }

    fn draw_sticker(props: &StickerProps) -> (FrameBuilder, Vec<String>) {
        let place = Place::default();
        let element = sticker_view(&place, props);
        let mut builder = FrameBuilder::default();
        let mut warnings = Vec::new();
        let claimed = push_element(
            &mut builder,
            &element,
            1.0,
            &pose(),
            Stage::new(1920, 1080),
            None,
            Some(1.0),
            &mut |message| warnings.push(message),
        );
        assert!(claimed, "template 源的 sticker 必须由本 crate 认领");
        (builder, warnings)
    }

    fn template(id: &str) -> StickerProps {
        let mut props = StickerProps::new(timeline::schema::STICKER_SOURCE_TEMPLATE);
        props.template_id = Some(id.to_owned());
        props
    }

    /// **Sticker is split by props**: `template` belongs to this crate (direct vector output), and `asset` belongs to the host (it needs a decoder). This dispatch is the core contract of P7b.
    #[test]
    fn only_template_stickers_are_claimed_by_this_crate() {
        let place = Place::default();
        for (props, claimed) in [
            (template("heart"), true),
            (
                StickerProps::new(timeline::schema::STICKER_SOURCE_ASSET),
                false,
            ),
        ] {
            let element = sticker_view(&place, &props);
            let mut builder = FrameBuilder::default();
            assert_eq!(
                push_element(
                    &mut builder,
                    &element,
                    1.0,
                    &pose(),
                    Stage::new(1920, 1080),
                    None,
                    Some(1.0),
                    &mut |_| {},
                ),
                claimed,
                "{}",
                props.source
            );
        }
    }

    /// Every template must produce instructions, and no two may match. A collision means some layer was not read.
    #[test]
    fn every_template_pushes_a_distinct_instruction_stream() {
        use motion::preset_registry::timeline_stickers;

        let mut seen: Vec<(String, Vec<u8>)> = Vec::new();
        for recipe in timeline_stickers() {
            let (builder, warnings) = draw_sticker(&template(&recipe.id));
            let frame = builder.finish();
            assert!(!frame.ops.is_empty(), "{}", recipe.id);
            assert!(warnings.is_empty(), "{}: {warnings:?}", recipe.id);
            let encoded = render_raster::drawop::encode(&frame);
            for (other, bytes) in &seen {
                assert_ne!(*bytes, encoded, "{} 与 {other} 的指令流相同", recipe.id);
            }
            seen.push((recipe.id.clone(), encoded));
        }
        assert_eq!(seen.len(), 10);
    }

    /// An unregistered template = `preset-unknown`: one diagnostic, zero instructions. A missing `templateId` is handled the same way. Both are **claimed** (return true). Not claiming them would make the host report "needs rasterization" again.
    #[test]
    fn an_unregistered_template_warns_and_draws_nothing() {
        for props in [
            template("no-such-template"),
            StickerProps::new(timeline::schema::STICKER_SOURCE_TEMPLATE),
        ] {
            let (builder, warnings) = draw_sticker(&props);
            assert!(builder.frame.ops.is_empty());
            assert_eq!(warnings.len(), 1, "{warnings:?}");
        }
    }

    /// The stroke width follows the **element box**, not the canvas. The same template enlarged twice has its outline's pixel width doubled too. Otherwise the thickness ratio would drift with size.
    #[test]
    fn sticker_stroke_width_scales_with_the_element_box() {
        use render_raster::drawop::DrawOp;

        let widths = |percent: f64| {
            let place = Place {
                w: Some(percent),
                ..Place::default()
            };
            let props = template("speech_bubble");
            let element = sticker_view(&place, &props);
            let mut builder = FrameBuilder::default();
            push_element(
                &mut builder,
                &element,
                1.0,
                &pose(),
                Stage::new(1920, 1080),
                None,
                Some(1.0),
                &mut |_| {},
            );
            builder
                .frame
                .ops
                .iter()
                .filter_map(|op| match op {
                    DrawOp::StrokePath { width, .. } => Some(*width),
                    _ => None,
                })
                .collect::<Vec<_>>()
        };
        let small = widths(10.0);
        let large = widths(20.0);
        assert_eq!(small.len(), 1);
        assert!(
            (large[0] / small[0] - 2.0).abs() < 1e-4,
            "{small:?} {large:?}"
        );
    }

    /// `audio` default = the main audio track.
    #[test]
    fn the_default_audio_source_is_the_main_track() {
        assert_eq!(
            visualizer_audio_source(&VisualizerProps::new("bars")),
            "main"
        );
        let mut props = VisualizerProps::new("bars");
        props.audio = Some("bgm".to_owned());
        assert_eq!(visualizer_audio_source(&props), "bgm");
    }
}
