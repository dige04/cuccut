//! Timeline image/video elements → renderer-neutral external texture nodes.
//!
//! Decoders and pixels still belong to the host; this module only freezes the geometry, fit, corner radius, animated
//! pose and source time of the basic media elements. Effects that have no GPU pass yet explicitly return `None`, and callers keep
//! using the existing Konva/CPU path; `bg: blur` must not be silently drawn as black.

use std::sync::Arc;

use timeline::effects::{REFERENCE_SHORT_EDGE, lower_element_effects};
use timeline::schema::{
    Background, Element, ElementKind, Fit, Fx, Mask, Place, StickerProps, Tile, VisualMode,
};

use crate::{
    BlurredGroup, SCENE_BLUR_RADIUS_LIMIT, SceneNode, Stage, TEXTURE_EFFECT_LIMIT,
    TextureBackground, TextureEffect, TextureFit, TextureMaskShape, TextureNode, WarnSink,
};

/// The maximum number of texture nodes a single tile element may expand into in one live scene. Each node is still an ordered
/// texture pass; beyond the limit the whole element is left to the host, since a grid must not be truncated to deliver an incomplete picture.
pub const EXTERNAL_MEDIA_TILE_NODE_LIMIT: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExternalMediaMetadata {
    pub width: u32,
    pub height: u32,
    pub video: bool,
}

impl ExternalMediaMetadata {
    pub fn image(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            video: false,
        }
    }

    pub fn video(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            video: true,
        }
    }
}

/// The minimal element view required by the external media scene. Web borrows directly from the persistent [`Element`]; native
/// export borrows from a host element table whose absolute times are already resolved, avoiding fabricating a fake document just to share the geometry.
#[derive(Debug, Clone, Copy)]
pub struct ExternalMediaElement<'a> {
    pub id: &'a str,
    pub kind: ElementKind,
    /// A texture slot key within a compositor session. It can be a `srcId`, or an element-level key the host assigns for
    /// a same-source asynchronous clock; the scene does not interpret it as a project resource id.
    pub texture: Option<&'a str>,
    pub place: &'a Place,
    pub mode: VisualMode,
    pub fit: Fit,
    /// Backdrop for full-screen + contain letterboxing; `None` draws no backdrop (a compositing stand-in, so transparent areas show the layer below).
    pub background: Option<Background>,
    pub tile: Option<&'a Tile>,
    pub mask: Option<&'a Mask>,
    pub fx: Option<&'a Fx>,
    pub sticker: Option<&'a StickerProps>,
    pub transition: timeline::video_transitions::TransitionFrame,
}

/// The shared live scene for basic image/video/asset-sticker. Returns `None` to indicate that this element
/// still needs host rasterization; the reason is written to `warn`, so that Web dispatch takes over pixels only when capability is complete.
/// One timeline element may expand into several ordered nodes (e.g. an image tile), but still occupies the same
/// global z slot.
pub fn external_media_scene_nodes(
    element: &Element,
    start: f64,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    metadata: ExternalMediaMetadata,
    warn: WarnSink<'_>,
) -> Option<Vec<SceneNode>> {
    let end = match element.end {
        Some(timeline::schema::TimeValue::Seconds(end)) => end,
        _ => start + f64::MAX / 2.0,
    };
    external_media_scene_nodes_in_span(element, start, end, time, pose, stage, metadata, warn)
}

/// Hosts must pass the resolved end for anchored and implicit element spans.
#[allow(clippy::too_many_arguments)]
pub fn external_media_scene_nodes_in_span(
    element: &Element,
    start: f64,
    end: f64,
    time: f64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    metadata: ExternalMediaMetadata,
    warn: WarnSink<'_>,
) -> Option<Vec<SceneNode>> {
    let place = element.place.as_ref().cloned().unwrap_or_default();
    let view = ExternalMediaElement {
        id: &element.id,
        kind: element.kind,
        texture: element.src_id.as_deref(),
        place: &place,
        mode: element.mode.unwrap_or(VisualMode::Pip),
        fit: element.fit.unwrap_or(Fit::Cover),
        background: Some(element.bg.unwrap_or(Background::Black)),
        tile: element.tile.as_ref(),
        mask: element.mask.as_ref(),
        fx: element.fx.as_ref(),
        sticker: element.sticker.as_ref(),
        transition: element
            .transitions
            .as_ref()
            .map(|v| v.sample(time - start, end - start))
            .unwrap_or_default(),
    };
    external_media_scene_nodes_at(
        &view,
        media_time_ms(element, start, time, metadata.video),
        pose,
        stage,
        metadata,
        warn,
    )
}

/// External texture nodes once the host has frozen the media clock. Loop/once/hold for dynamic asset stickers
/// need the source duration, which is host data; it is injected via `media_ms`, and geometry and Web still share this function.
pub fn external_media_scene_nodes_at(
    element: &ExternalMediaElement<'_>,
    media_ms: i64,
    pose: &timeline::AnimationPose,
    stage: Stage,
    metadata: ExternalMediaMetadata,
    warn: WarnSink<'_>,
) -> Option<Vec<SceneNode>> {
    let supported_kind = matches!(
        element.kind,
        ElementKind::Image | ElementKind::Video | ElementKind::Placeholder
    ) || element.kind == ElementKind::Sticker
        && element
            .sticker
            .is_some_and(|props| props.source == timeline::schema::STICKER_SOURCE_ASSET);
    if !supported_kind {
        return None;
    }
    let Some(texture) = element.texture else {
        warn(format!("element {} external texture is missing srcId", element.id));
        return None;
    };
    if metadata.width == 0 || metadata.height == 0 {
        warn(format!(
            "element {} external texture has an invalid size ({}×{})",
            element.id, metadata.width, metadata.height
        ));
        return None;
    }
    let tile = element.tile.filter(|tile| tile.on);

    let mode = element.mode;
    let fit = element.fit;
    let place = element.place;
    let canvas_width = f64::from(stage.width);
    let canvas_height = f64::from(stage.height);
    let (box_width, box_height, center_x, center_y) = match (tile.is_some(), mode) {
        (false, VisualMode::Fullscreen) => (
            canvas_width,
            canvas_height,
            canvas_width / 2.0,
            canvas_height / 2.0,
        ),
        (_, VisualMode::Pip) | (true, VisualMode::Fullscreen) => {
            let defaults = timeline::geometry::default_place(element.kind, None);
            let default_width = match element.kind {
                ElementKind::Sticker => timeline::geometry::DEFAULT_ELEMENT_W,
                ElementKind::Placeholder => defaults.w,
                _ => 34.0,
            };
            let width = canvas_width * place.w.unwrap_or(default_width).max(1.0) / 100.0;
            let height = if element.kind == ElementKind::Placeholder {
                canvas_height * defaults.h.unwrap_or(24.0) / 100.0
            } else {
                width * f64::from(metadata.height) / f64::from(metadata.width)
            };
            (
                width,
                height,
                canvas_width * place.x.unwrap_or(50.0) / 100.0,
                canvas_height * place.y.unwrap_or(50.0) / 100.0,
            )
        }
    };
    if !(box_width.is_finite() && box_width > 0.0 && box_height.is_finite() && box_height > 0.0) {
        warn(format!("element {} media box has an invalid size", element.id));
        return None;
    }
    // The CPU reference and Konva both first establish an integer-pixel local canvas, then apply an affine transform around the center of this box.
    // Freeze the same rounding pass at the scene boundary, so the GPU does not produce half-pixel extra size for odd frame sizes/aspect ratios.
    let box_width = box_width.round().max(1.0);
    let box_height = box_height.round().max(1.0);

    let short = canvas_width.min(canvas_height);
    let pose = element
        .transition
        .compose_in_place(*pose, box_width, short, place);
    let source_effects = match lower_texture_effects(element.fx, short) {
        Ok(effects) => effects,
        Err(error) => {
            warn(format!(
                "element {} media effect chain cannot enter the GPU texture scene ({error}); continuing with the shared CPU effect stack",
                element.id
            ));
            return None;
        }
    };
    let center_x = center_x + pose.dx * short;
    let center_y = center_y + pose.dy * short;
    let (flip_x, flip_y) = place.flip_signs();
    let base_scale = place.scale.unwrap_or(1.0);
    let scale_x = base_scale * pose.scale_x * flip_x;
    // Round 122 D2: `scaleY` multiplies on top of `scale` (absent = 1), the same convention as `timeline::geometry::static_box`.
    let scale_y = base_scale * place.scale_y.unwrap_or(1.0) * pose.scale_y * flip_y;
    let opacity = (place.opacity.unwrap_or(1.0) * pose.opacity).clamp(0.0, 1.0) as f32;
    let background = if mode == VisualMode::Fullscreen && fit == Fit::Contain {
        match element.background {
            Some(Background::Black) => TextureBackground::Black,
            Some(Background::Blur) => TextureBackground::Blur,
            Some(Background::Color(rgb)) => TextureBackground::Color(rgb),
            None => TextureBackground::Transparent,
        }
    } else {
        TextureBackground::Transparent
    };
    let local_mask = mode == VisualMode::Pip || tile.is_some();
    let ellipse = local_mask
        && element
            .mask
            .is_some_and(|mask| mask.shape == timeline::schema::MaskShape::Ellipse);
    let corner_radii = place.corner_radii();
    if local_mask
        && !ellipse
        && corner_radii
            .windows(2)
            .any(|pair| (pair[0] - pair[1]).abs() > f64::EPSILON)
    {
        warn(format!(
            "element {} per-corner radii have not entered the GPU texture scene yet; continuing with the shared CPU effect stack",
            element.id
        ));
        return None;
    }
    let radius = if local_mask && !ellipse {
        (corner_radii[0].max(0.0) * short / REFERENCE_SHORT_EDGE) as f32
    } else {
        0.0
    };
    let mask_feather = if ellipse || radius > 0.0 {
        (element
            .mask
            .and_then(|mask| mask.feather)
            .unwrap_or(0.0)
            .max(0.0)
            * short
            / REFERENCE_SHORT_EDGE) as f32
    } else {
        0.0
    };
    let mask_shape = if ellipse {
        TextureMaskShape::Ellipse
    } else {
        TextureMaskShape::RoundedRect
    };
    let reveal = pose.reveal.unwrap_or(1.0).clamp(0.0, 1.0) as f32;
    let pose_blur = if pose.blur > 0.5 {
        (pose.blur * short / REFERENCE_SHORT_EDGE)
            .round()
            .max(1.0)
            .min(f64::from(SCENE_BLUR_RADIUS_LIMIT)) as u32
    } else {
        0
    };
    let fit = match fit {
        Fit::Cover => TextureFit::Cover,
        Fit::Contain => TextureFit::Contain,
    };
    let node_at = |center_x: f64, center_y: f64, rotation: f64| {
        let radians = rotation.to_radians();
        let (sin, cos) = radians.sin_cos();
        let a = scale_x * cos;
        let b = scale_x * sin;
        let c = -scale_y * sin;
        let d = scale_y * cos;
        SceneNode::Texture(Arc::new(TextureNode {
            texture: texture.to_owned(),
            media_ms,
            source_width: metadata.width,
            source_height: metadata.height,
            rect: [
                (center_x - box_width / 2.0) as f32,
                (center_y - box_height / 2.0) as f32,
                box_width as f32,
                box_height as f32,
            ],
            transform: [
                a as f32,
                b as f32,
                c as f32,
                d as f32,
                (center_x - (center_x * a + center_y * c)) as f32,
                (center_y - (center_x * b + center_y * d)) as f32,
            ],
            opacity,
            radius,
            mask_shape,
            mask_feather,
            source_effects: Arc::clone(&source_effects),
            reveal,
            iris: element.transition.iris as f32,
            fit,
            background,
        }))
    };

    let Some(tile) = tile else {
        return Some(with_pose_blur(
            vec![node_at(
                center_x,
                center_y,
                place.rot.unwrap_or(0.0) + pose.rotation,
            )],
            pose_blur,
        ));
    };
    let points = timeline::geometry::tile_stamp_points(
        stage.width,
        stage.height,
        box_width.round().max(1.0) as u32,
        box_height.round().max(1.0) as u32,
        tile,
    );
    if points.len() > EXTERNAL_MEDIA_TILE_NODE_LIMIT {
        warn(format!(
            "element {} tiled media needs {} texture nodes, which exceeds the real-time limit {}; continuing with host rendering",
            element.id,
            points.len(),
            EXTERNAL_MEDIA_TILE_NODE_LIMIT
        ));
        return None;
    }
    let rotation = tile.angle.unwrap_or(-30.0) + place.rot.unwrap_or(0.0) + pose.rotation;
    let radians = rotation.to_radians();
    let (sin, cos) = radians.sin_cos();
    let canvas_center_x = canvas_width / 2.0 + pose.dx * short;
    let canvas_center_y = canvas_height / 2.0 + pose.dy * short;
    Some(with_pose_blur(
        points
            .into_iter()
            .map(|(point_x, point_y)| {
                let scaled_x = point_x * (base_scale * pose.scale_x);
                let scaled_y = point_y * (base_scale * place.scale_y.unwrap_or(1.0) * pose.scale_y);
                let rotated_x = scaled_x * cos - scaled_y * sin;
                let rotated_y = scaled_x * sin + scaled_y * cos;
                node_at(
                    canvas_center_x + rotated_x,
                    canvas_center_y + rotated_y,
                    rotation,
                )
            })
            .collect(),
        pose_blur,
    ))
}

fn lower_texture_effects(
    fx: Option<&Fx>,
    canvas_short_edge: f64,
) -> Result<Arc<[TextureEffect]>, String> {
    let Some(fx) = fx else {
        return Ok(Arc::from([]));
    };
    let lowered = lower_element_effects(Some(fx), None, None, None, false);
    if lowered.len() > TEXTURE_EFFECT_LIMIT {
        return Err(format!(
            "effect-count={} limit={TEXTURE_EFFECT_LIMIT}",
            lowered.len()
        ));
    }
    let mut effects = Vec::with_capacity(lowered.len());
    for effect in lowered {
        let scalar = |key: &str| {
            effect
                .uniforms
                .scalar(key)
                .ok_or_else(|| format!("{} is missing {key}", effect.id()))
        };
        let mapped = match effect.id() {
            "filter.colorAdjust" => TextureEffect::ColorAdjust {
                grayscale: scalar("grayscale")? as f32,
                brightness: scalar("brightness")? as f32,
            },
            "filter.grayscale" => TextureEffect::Grayscale(scalar("amount")? as f32),
            "filter.brightness" => TextureEffect::Brightness(scalar("amount")? as f32),
            "filter.contrast" => TextureEffect::Contrast(scalar("amount")? as f32),
            "filter.saturation" => TextureEffect::Saturation(scalar("amount")? as f32),
            "filter.sepia" => TextureEffect::Sepia(scalar("amount")? as f32),
            "filter.hueRotate" => TextureEffect::HueRotate(scalar("degrees")? as f32),
            "filter.invert" => TextureEffect::Invert(scalar("amount")? as f32),
            "filter.blur" => {
                let radius = (scalar("radius")? * canvas_short_edge)
                    .round()
                    .clamp(0.0, f64::from(SCENE_BLUR_RADIUS_LIMIT))
                    as u32;
                if radius == 0 {
                    continue;
                }
                TextureEffect::Blur(radius)
            }
            "filter.sharpen" => TextureEffect::Sharpen(scalar("amount")? as f32),
            "filter.noise" => TextureEffect::Noise(scalar("amount")? as f32),
            "filter.vignette" => TextureEffect::Vignette(scalar("amount")? as f32),
            id => return Err(format!("unsupported-effect={id}")),
        };
        effects.push(mapped);
    }
    Ok(Arc::from(effects))
}

fn with_pose_blur(nodes: Vec<SceneNode>, radius: u32) -> Vec<SceneNode> {
    if radius == 0 {
        nodes
    } else {
        vec![SceneNode::BlurredGroup(Arc::new(BlurredGroup {
            nodes,
            radius: radius as f32,
            motion: None,
            reveal: None,
            composite: crate::SceneCompositeMode::Normal,
        }))]
    }
}

fn media_time_ms(element: &Element, start: f64, time: f64, video: bool) -> i64 {
    if !video {
        return -1;
    }
    let source_start = element.src_start.unwrap_or(0.0);
    let rate = element.rate.unwrap_or(1.0);
    ((source_start + (time - start) * rate).max(0.0) * 1_000.0).round() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn video_exit_uses_resolved_anchor_span_and_keeps_static_box() {
        let element: Element = serde_json::from_value(serde_json::json!({
            "id":"video", "kind":"video", "srcId":"asset-a", "start":0,
            "end":"~main:last:end", "place":{"x":50,"y":50,"w":50},
            "transitions":{"out":{"k":"iris","dur":0.5}}
        }))
        .unwrap();
        let node = |time| {
            let nodes = external_media_scene_nodes_in_span(
                &element,
                0.0,
                1.0,
                time,
                &timeline::AnimationPose::IDENTITY,
                Stage::new(640, 360),
                ExternalMediaMetadata::image(640, 360),
                &mut |_| {},
            )
            .unwrap();
            match &nodes[0] {
                SceneNode::Texture(n) => n.clone(),
                _ => panic!("texture"),
            }
        };
        let mid = node(0.5);
        let tail = node(0.75);
        assert_eq!(mid.rect, tail.rect);
        assert_eq!(mid.iris, 1.0);
        assert_eq!(tail.iris, 0.5);
        assert_eq!(tail.opacity, 1.0);
    }

    fn image() -> Element {
        serde_json::from_str(
            r#"{"id":"image-1","kind":"image","start":0,"end":4,"srcId":"asset-a","place":{"x":25,"y":30,"w":20,"opacity":0.5,"radius":8}}"#,
        )
        .unwrap()
    }

    #[test]
    fn basic_image_freezes_export_geometry_and_texture_identity() {
        let element = image();
        let mut warnings = Vec::new();
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_000, 500),
            ExternalMediaMetadata::image(400, 200),
            &mut |message| warnings.push(message),
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected texture node")
        };
        assert!(warnings.is_empty());
        assert_eq!(node.texture, "asset-a");
        assert_eq!(node.media_ms, -1);
        assert_eq!(node.rect, [150.0, 100.0, 200.0, 100.0]);
        assert_eq!(node.opacity, 0.5);
        assert!((node.radius - 7.4074073).abs() < 1e-5);
    }

    #[test]
    fn source_blur_is_frozen_in_natural_source_space() {
        let mut element = image();
        element.fx = Some(timeline::schema::Fx {
            grayscale: None,
            blur: Some(8.0),
            brightness: None,
            contrast: None,
            exposure: None,
            hue: None,
            saturation: None,
            sharpen: None,
            noise: None,
            vignette: None,
            filter_preset: None,
            effect_preset: None,
            effect_intensity: None,
        });
        let mut warnings = Vec::new();
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_000, 500),
            ExternalMediaMetadata::image(400, 200),
            &mut |message| warnings.push(message),
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected one blurred texture node")
        };
        assert!(warnings.is_empty());
        assert_eq!(
            node.source_effects.as_ref(),
            [TextureEffect::Blur(7)],
            "8 × 500 / 540 should round to 7 px"
        );
    }

    #[test]
    fn stylize_and_presets_enter_the_ordered_texture_effect_chain() {
        for fx in [
            r#"{"sharpen":0.3}"#,
            r#"{"noise":0.2}"#,
            r#"{"vignette":0.7}"#,
            r#"{"filterPreset":"calm1"}"#,
            r#"{"effectPreset":"invert","effectIntensity":0.5}"#,
        ] {
            let mut element = image();
            element.fx = Some(serde_json::from_str(fx).unwrap());
            let mut warnings = Vec::new();
            let nodes = external_media_scene_nodes(
                &element,
                0.0,
                1.0,
                &timeline::AnimationPose::IDENTITY,
                Stage::new(1_000, 500),
                ExternalMediaMetadata::image(400, 200),
                &mut |message| warnings.push(message),
            )
            .unwrap_or_else(|| panic!("GPU should fully take over {fx}: {warnings:?}"));
            let [SceneNode::Texture(node)] = nodes.as_slice() else {
                panic!("expected one texture node for {fx}")
            };
            assert!(!node.source_effects.is_empty(), "{fx}");
            assert!(warnings.is_empty(), "{fx}: {warnings:?}");
        }

        let mut identity = image();
        identity.fx = Some(
            serde_json::from_str(r#"{"contrast":0,"filterPreset":"none","effectPreset":"none"}"#)
                .unwrap(),
        );
        assert!(
            external_media_scene_nodes(
                &identity,
                0.0,
                1.0,
                &timeline::AnimationPose::IDENTITY,
                Stage::new(1_000, 500),
                ExternalMediaMetadata::image(400, 200),
                &mut |_| {},
            )
            .is_some()
        );
    }

    #[test]
    fn maximum_timeline_effect_recipe_fits_the_bounded_texture_chain() {
        let mut element = image();
        element.fx = Some(
            serde_json::from_str(
                r#"{
                    "filterPreset":"cottage3",
                    "effectPreset":"night_vision",
                    "effectIntensity":1,
                    "grayscale":1,
                    "brightness":0.2,
                    "exposure":0.3,
                    "contrast":0.4,
                    "saturation":0.5,
                    "hue":0.6,
                    "blur":7,
                    "sharpen":0.7,
                    "noise":0.8,
                    "vignette":0.9
                }"#,
            )
            .unwrap(),
        );
        let mut warnings = Vec::new();
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_080, 540),
            ExternalMediaMetadata::image(400, 200),
            &mut |message| warnings.push(message),
        )
        .expect("the largest valid Timeline 0.3 recipe must fully enter the GPU scene");
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected one texture node")
        };
        assert_eq!(node.source_effects.len(), 18);
        assert!(warnings.is_empty(), "{warnings:?}");
    }

    #[test]
    fn scalar_color_fx_are_frozen_in_shared_lowering_units() {
        let mut element = image();
        element.fx = Some(
            serde_json::from_str(
                r#"{"exposure":-0.6,"contrast":0.25,"saturation":0.4,"hue":-0.5}"#,
            )
            .unwrap(),
        );
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_000, 500),
            ExternalMediaMetadata::image(400, 200),
            &mut |_| {},
        )
        .expect("scalar color effects belong to the GPU texture scene");
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected one texture node")
        };
        assert_eq!(
            node.source_effects.as_ref(),
            [
                TextureEffect::Brightness(-0.4),
                TextureEffect::Contrast(0.25),
                TextureEffect::Saturation(1.4),
                TextureEffect::HueRotate(-90.0),
            ]
        );
    }

    #[test]
    fn reveal_stays_local_and_pose_blur_wraps_the_complete_media_element() {
        let element = image();
        let pose = timeline::AnimationPose {
            reveal: Some(0.25),
            blur: 8.0,
            ..timeline::AnimationPose::IDENTITY
        };
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            0.1,
            &pose,
            Stage::new(1_000, 500),
            ExternalMediaMetadata::image(400, 200),
            &mut |_| {},
        )
        .unwrap();
        let [SceneNode::BlurredGroup(group)] = nodes.as_slice() else {
            panic!("pose blur must wrap the complete media slot")
        };
        assert_eq!(group.radius, 7.0, "8 × 500 / 540 should round to 7 px");
        let [SceneNode::Texture(node)] = group.nodes.as_slice() else {
            panic!("blurred media group must retain its texture child")
        };
        assert_eq!(node.reveal, 0.25);
    }

    #[test]
    fn ellipse_mask_freezes_local_shape_and_feather_into_the_texture_node() {
        let element: Element = serde_json::from_str(
            r#"{"id":"masked","kind":"image","start":0,"end":4,"srcId":"asset-a","place":{"w":20,"radius":12},"mask":{"shape":"ellipse","feather":5},"fx":{"grayscale":0.6,"blur":4,"brightness":-0.2}}"#,
        )
        .unwrap();
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_080, 540),
            ExternalMediaMetadata::image(400, 200),
            &mut |_| {},
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected one masked texture node")
        };
        assert_eq!(node.mask_shape, TextureMaskShape::Ellipse);
        assert_eq!(node.radius, 0.0, "ellipse must ignore place.radius");
        assert_eq!(node.mask_feather, 5.0);
        assert_eq!(
            node.source_effects.as_ref(),
            [
                TextureEffect::ColorAdjust {
                    grayscale: 0.6,
                    brightness: -0.2,
                },
                TextureEffect::Blur(4),
            ]
        );

        let fullscreen: Element = serde_json::from_str(
            r#"{"id":"full","kind":"image","start":0,"end":4,"srcId":"asset-a","mode":"fullscreen","mask":{"shape":"ellipse","feather":5}}"#,
        )
        .unwrap();
        let nodes = external_media_scene_nodes(
            &fullscreen,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_080, 540),
            ExternalMediaMetadata::image(400, 200),
            &mut |_| {},
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected one fullscreen texture node")
        };
        assert_eq!(node.mask_shape, TextureMaskShape::RoundedRect);
        assert_eq!(node.mask_feather, 0.0);
    }

    #[test]
    fn fullscreen_contain_blur_freezes_the_compositor_background_pass() {
        let element: Element = serde_json::from_str(
            r#"{"id":"full","kind":"image","start":0,"end":4,"srcId":"asset-a","mode":"fullscreen","fit":"contain","bg":"blur"}"#,
        )
        .unwrap();
        let mut warnings = Vec::new();
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_080, 540),
            ExternalMediaMetadata::image(400, 300),
            &mut |warning| warnings.push(warning),
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected one fullscreen contain texture node")
        };
        assert_eq!(node.fit, TextureFit::Contain);
        assert_eq!(node.background, TextureBackground::Blur);
        assert_eq!(node.rect, [0.0, 0.0, 1_080.0, 540.0]);
        assert!(warnings.is_empty(), "{warnings:?}");
    }

    #[test]
    fn video_node_carries_the_source_clock() {
        let element: Element = serde_json::from_str(
            r#"{"id":"video-1","kind":"video","start":2,"end":8,"srcId":"clip-b","srcStart":1.5,"rate":2}"#,
        )
        .unwrap();
        let nodes = external_media_scene_nodes(
            &element,
            2.0,
            3.25,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_920, 1_080),
            ExternalMediaMetadata::video(1_280, 720),
            &mut |_| {},
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected texture node")
        };
        assert_eq!(node.media_ms, 4_000);
    }

    #[test]
    fn host_can_assign_an_element_texture_slot_and_precomputed_clock() {
        let element = image();
        let place = element.place.as_ref().unwrap();
        let view = ExternalMediaElement {
            id: &element.id,
            kind: ElementKind::Video,
            texture: Some("timeline-media:image-1"),
            place,
            mode: VisualMode::Pip,
            fit: Fit::Cover,
            background: Some(Background::Black),
            tile: None,
            mask: None,
            fx: None,
            sticker: None,
            transition: Default::default(),
        };
        let nodes = external_media_scene_nodes_at(
            &view,
            7_250,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(1_000, 500),
            ExternalMediaMetadata::video(400, 200),
            &mut |_| {},
        )
        .unwrap();
        let [SceneNode::Texture(node)] = nodes.as_slice() else {
            panic!("expected texture node")
        };
        assert_eq!(node.texture, "timeline-media:image-1");
        assert_eq!(node.media_ms, 7_250);
    }

    #[test]
    fn image_tile_expands_the_shared_cpu_grid_inside_one_scene_slot() {
        let element: Element = serde_json::from_str(
            r#"{"id":"tile-1","kind":"image","start":0,"end":4,"srcId":"asset-a","mode":"fullscreen","fit":"contain","bg":"black","place":{"x":7,"y":91,"w":20.2,"scale":1.25,"scaleY":0.75,"rot":5,"opacity":0.6,"radius":6},"tile":{"on":true,"angle":-30,"gapX":8,"gapY":10,"stagger":true}}"#,
        )
        .unwrap();
        let tile = element.tile.as_ref().unwrap();
        // A 64.64 × 32.32 local box must round to 65 × 32, as in CPU / Studio,
        // and must not silently truncate to 64 × 32 here, which would make the ownership decision on critical grid boundaries drift.
        let points = timeline::geometry::tile_stamp_points(320, 180, 65, 32, tile);
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(320, 180),
            ExternalMediaMetadata::image(400, 200),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(nodes.len(), points.len());
        assert!(nodes.len() > 20);

        let SceneNode::Texture(first) = &nodes[0] else {
            panic!("tile stamp must be a texture node")
        };
        let rotation = (-25.0_f64).to_radians();
        // Round 122 D2: `scaleY` is the vertical factor **multiplied on top of `scale`** (absent = 1),
        // no longer "replacing the vertical component of `scale`". So the vertical factor is 1.25 × 0.75 =
        // 0.9375, while the horizontal stays 1.25. Changing this expected value amounts to unifying the media convention with
        // `timeline::geometry::static_box` (vector elements) and `stage_objects::media_footprint_xy` in the editing core, all onto this one multiplication rule.
        let scale_x = 1.25;
        let scale_y = 1.25 * 0.75;
        let expected_center_x =
            160.0 + points[0].0 * scale_x * rotation.cos() - points[0].1 * scale_y * rotation.sin();
        let expected_center_y =
            90.0 + points[0].0 * scale_x * rotation.sin() + points[0].1 * scale_y * rotation.cos();
        let actual_center_x = f64::from(first.rect[0] + first.rect[2] / 2.0);
        let actual_center_y = f64::from(first.rect[1] + first.rect[3] / 2.0);
        assert!((actual_center_x - expected_center_x).abs() < 1e-4);
        assert!((actual_center_y - expected_center_y).abs() < 1e-4);
        assert_eq!(first.fit, TextureFit::Contain);
        assert_eq!(first.background, TextureBackground::Black);
        assert_eq!(first.opacity, 0.6);
        assert!(first.radius > 0.0, "fullscreen tile must also apply rounded corners");
        assert!(nodes.iter().all(|node| matches!(
            node,
            SceneNode::Texture(node)
                if node.texture == "asset-a" && node.media_ms == -1
        )));
    }

    #[test]
    fn excessively_dense_image_tile_stays_with_the_host() {
        let element: Element = serde_json::from_str(
            r#"{"id":"dense","kind":"image","start":0,"end":4,"srcId":"asset-a","place":{"w":1},"tile":{"on":true,"gapX":2,"gapY":2}}"#,
        )
        .unwrap();
        let mut warnings = Vec::new();
        let nodes = external_media_scene_nodes(
            &element,
            0.0,
            1.0,
            &timeline::AnimationPose::IDENTITY,
            Stage::new(320, 180),
            ExternalMediaMetadata::image(100, 100),
            &mut |message| warnings.push(message),
        );
        assert!(nodes.is_none());
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("exceeds the real-time limit 256"), "{:?}", warnings);
    }
}
