/*!
 * ccut-timeline-render —— **the intersection layer of the contract layer and the primitive layer**.
 *
 * Timeline elements (`ElementKind` of `ccut-timeline` + the four Props groups + the geometry default table)
 * → DrawOp instruction stream (`FrameBuilder` of `ccut-render`), plus the same-source live
 * [`SceneFrame`] / [`SceneNode`]. Pure functions, no I/O: no disk reads, no process spawning, and no
 * knowledge of any host's types, so `apps/cli`, `ccut-wasm` and the compositor use **the same**
 * implementation.
 *
 * Design basis: [docs/design/bcf/ccut-element-render-foundation-design.md] §9.1 (P6 needs the pure geometry /
 * DrawOp assembly of `render_plan.rs` pushed down into core before it can be compiled into wasm) and the
 * acceptance criteria of §10 P6 (wasm's `fingerprintAt(t)` must be bit-identical to the CLI's DrawOp fingerprint).
 * The reasoning for "a new crate rather than plugging `ccut-timeline` into `ccut-render`" is written in the comments
 * of `Cargo.toml`.
 *
 * ## Boundary
 *
 * [`push_element`] only draws **directly vector** elements: `shape` / `visualizer` / `progress`,
 * plus **`sticker` with a `template` source** (P7b: the built-in template library is normalized paths, not
 * SVG bytes, so no resvg is needed). For the live scene, [`external_media_scene_nodes`] may additionally accept
 * natural sizes injected by the host and produce texture nodes that carry no platform handles; decoding and texture upload
 * still belong to the host. `text` still needs the shared typesetting/glyph scene, and `audio` produces no picture.
 */

pub mod draw;
pub mod element;
#[cfg(feature = "external-media-scene")]
pub mod media;
pub mod scene;
#[cfg(feature = "scene-wire")]
pub mod scene_wire;

pub use draw::{
    ElementBox, ElementPose, element_transform, parse_color, push_draw_ops,
    push_media_placeholder_ops, push_placeholder_ops, push_shape_ops, push_sticker_ops,
};
pub use element::{
    ElementDraw, EvaluatedSceneElement, Stage, WarnSink, element_aspect, element_frame,
    element_opacity, evaluate_scene_element, push_confetti_element, push_draw_element,
    push_element, push_element_placeholder, push_placeholder_element, push_progress_element,
    push_shape_element, push_sticker_element, push_visualizer_element, visualizer_audio_source,
    whiteboard_draw_seconds, whiteboard_hand, whiteboard_paper, whiteboard_params,
    whiteboard_progress,
};
#[cfg(feature = "external-media-scene")]
pub use media::{
    EXTERNAL_MEDIA_TILE_NODE_LIMIT, ExternalMediaElement, ExternalMediaMetadata,
    external_media_scene_nodes, external_media_scene_nodes_at, external_media_scene_nodes_in_span,
};
pub use scene::{
    BlurredGroup, GLYPH_RUN_UNIFORM_LIMIT, GlyphCompositeMode, GlyphEffect, GlyphInstance,
    GlyphKey, GlyphMask, GlyphPaint, GlyphPixels, GlyphRun, GlyphRunUniform, GlyphTexture,
    GlyphTextureKey, RoundedRectNode, SCENE_BLUR_RADIUS_LIMIT, SCENE_GLYPH_STROKE_WIDTH_LIMIT,
    SCENE_GLYPH_TEXTURE_SIZE_LIMIT, SCENE_NODE_LIMIT, SceneCompositeMode, SceneCurveSolver,
    SceneFrame, SceneMotion, SceneNode, ScenePose, post_concat_mat6,
};
#[cfg(feature = "external-media-scene")]
pub use scene::{
    TEXTURE_EFFECT_LIMIT, TextureBackground, TextureEffect, TextureFit, TextureMaskShape,
    TextureNode,
};
#[cfg(feature = "scene-wire")]
pub use scene_wire::{decode_scene_frame, encode_scene_frame};
