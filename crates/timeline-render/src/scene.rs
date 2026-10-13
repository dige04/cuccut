use std::sync::Arc;

use motion::CurveSpec;
use render_raster::ShaderQuad;
use render_raster::drawop::{FrameOps, Mat6};
use render_raster::plan::TransformUniforms;

/// The dynamic run limit for a single glyph scene node. The fixed budget makes the uniform texture on desktop/Web both 8×1024 RGBA32F (128 KiB), so producers can explicitly fall back before entering the GPU.
pub const GLYPH_RUN_UNIFORM_LIMIT: usize = 1024;

/// The per-layer scene node limit. The BCS2 codec and the producers that expand nodes share the same budget, so that native does not claim a node first and then fall back when crossing the wasm wire because the packet structure is too large.
pub const SCENE_NODE_LIMIT: usize = 4096;

/// The structural limit of the CPU reference `filter.blur@1`. The scene freezes the radius in integer pixels; the GPU executor must not invent its own clamping convention for different platforms.
pub const SCENE_BLUR_RADIUS_LIMIT: u32 = 256;

/// The number of source effects a single media element may freeze. The closed set of Timeline 0.3 reaches at most 18 when the four-stage filter preset, the five-stage effect preset and all explicit fields are enabled at once; six slots are reserved for compatible extensions within the same version, while also preventing corrupt input from creating an unbounded GPU pass chain.
pub const TEXTURE_EFFECT_LIMIT: usize = 24;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ScenePose {
    pub transform: Mat6,
    pub opacity: f32,
    /// The box blur radius (canvas pixels) for whole-group post-processing. Ordinary vector/glyph passes ignore it; only an explicit `BlurredGroup` consumes it. Placing it in the shared pose lets it be sampled on the same curve as transform/opacity.
    pub blur: f32,
}

impl ScenePose {
    pub const IDENTITY: Self = Self {
        transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        opacity: 1.0,
        blur: 0.0,
    };
}

impl Default for ScenePose {
    fn default() -> Self {
        Self::IDENTITY
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SceneCurveSolver {
    Standard,
    Caption,
}

/// The pose interval the compositor can sample directly. The curves still come from the shared `ccut-motion` manifest; the scene only freezes absolute times and endpoints, and does not copy subtitle recipes or introduce a platform clock.
#[derive(Debug, Clone, PartialEq)]
pub struct SceneMotion {
    pub start: f64,
    pub end: f64,
    pub from: ScenePose,
    pub to: ScenePose,
    pub curve: CurveSpec,
    pub solver: SceneCurveSolver,
}

impl SceneMotion {
    pub fn sample(&self, time: f64) -> ScenePose {
        let duration = self.end - self.start;
        let phase = if duration.is_finite() && duration > 0.0 && time.is_finite() {
            ((time - self.start) / duration).clamp(0.0, 1.0)
        } else if time >= self.end {
            1.0
        } else {
            0.0
        };
        let eased = match (&self.curve, self.solver) {
            (CurveSpec::CubicBezier { x1, y1, x2, y2 }, SceneCurveSolver::Caption) => {
                motion::curve::cubic_bezier_caption(*x1, *y1, *x2, *y2, phase)
            }
            _ => motion::sample_curve(&self.curve, phase),
        };
        let mut transform = [0.0; 6];
        for (output, (from, to)) in transform
            .iter_mut()
            .zip(self.from.transform.into_iter().zip(self.to.transform))
        {
            *output = (f64::from(from) + f64::from(to - from) * eased) as f32;
        }
        ScenePose {
            transform,
            opacity: (f64::from(self.from.opacity)
                + f64::from(self.to.opacity - self.from.opacity) * eased)
                as f32,
            blur: (f64::from(self.from.blur) + f64::from(self.to.blur - self.from.blur) * eased)
                as f32,
        }
    }
}

/// The renderer-neutral Mat6 convention of tiny-skia's `Transform::post_concat`: apply `first` first, then `second`. The vector and glyph executors must share this one ordering.
pub fn post_concat_mat6(first: Mat6, second: Mat6) -> Mat6 {
    let [a, b, c, d, tx, ty] = first;
    let [e, f, g, h, ux, uy] = second;
    [
        e * a + g * b,
        f * a + h * b,
        e * c + g * d,
        f * c + h * d,
        e * tx + g * ty + ux,
        f * tx + h * ty + uy,
    ]
}

/// The unique identity, within the host, of a glyph rasterization result. It does not enter the BCF / DrawOp fingerprint; it is used only for residency and reuse in the live glyph atlas. Producers must encode the font face, glyph id, discrete font-size bucket and sub-pixel bucket into it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct GlyphKey(pub [u64; 2]);

/// The pixel type of the glyph atlas. Alpha is tightly packed row by row as R8 coverage; Color is tightly packed row by row as premultiplied RGBA8.
#[derive(Debug, Clone)]
pub enum GlyphPixels {
    Alpha(Arc<[u8]>),
    Color(Arc<[u8]>),
}

impl GlyphPixels {
    pub fn data(&self) -> &Arc<[u8]> {
        match self {
            Self::Alpha(data) | Self::Color(data) => data,
        }
    }

    pub fn is_color(&self) -> bool {
        matches!(self, Self::Color(_))
    }
}

/// A glyph image that can enter the atlas. The origin is the top-left corner of the pixels; `left` / `top` are the swash placement relative to the glyph's baseline origin (`top` is positive upward). The historical name `GlyphMask` is kept unchanged, but pixels may be R8 or colour RGBA.
#[derive(Debug, Clone)]
pub struct GlyphMask {
    pub key: GlyphKey,
    pub width: u32,
    pub height: u32,
    pub left: i32,
    pub top: i32,
    pub pixels: GlyphPixels,
}

impl GlyphMask {
    pub fn new(
        key: GlyphKey,
        width: u32,
        height: u32,
        left: i32,
        top: i32,
        alpha: impl Into<Arc<[u8]>>,
    ) -> Option<Self> {
        Self::new_pixels(
            key,
            width,
            height,
            left,
            top,
            GlyphPixels::Alpha(alpha.into()),
            1,
        )
    }

    pub fn new_color(
        key: GlyphKey,
        width: u32,
        height: u32,
        left: i32,
        top: i32,
        rgba: impl Into<Arc<[u8]>>,
    ) -> Option<Self> {
        Self::new_pixels(
            key,
            width,
            height,
            left,
            top,
            GlyphPixels::Color(rgba.into()),
            4,
        )
    }

    fn new_pixels(
        key: GlyphKey,
        width: u32,
        height: u32,
        left: i32,
        top: i32,
        pixels: GlyphPixels,
        channels: usize,
    ) -> Option<Self> {
        let expected = (width as usize)
            .checked_mul(height as usize)
            .and_then(|pixels| pixels.checked_mul(channels));
        (width > 0 && height > 0 && expected == Some(pixels.data().len())).then_some(Self {
            key,
            width,
            height,
            left,
            top,
            pixels,
        })
    }
}

/// The stable geometry of one atlas quad. `transform` maps the glyph's **baseline origin** to canvas coordinates without the dynamic run pose applied. The executor first applies the mask's own `left/-top` placement, then applies this transform, and only last fetches the dynamic uniform pointed to by `uniform_index`.
#[derive(Debug, Clone)]
pub struct GlyphInstance {
    pub mask: Arc<GlyphMask>,
    pub transform: Mat6,
    pub uniform_index: u32,
}

/// The content identity of a renderer-neutral glyph pattern texture. Like [`GlyphKey`], it serves only residency/reuse within a compositor session and does not enter BCF; producers must make the key cover the size and all premultiplied RGBA8 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct GlyphTextureKey(pub [u64; 2]);

/// The per-side limit for a retained glyph pattern; a 2048² RGBA8 texture is exactly the 16 MiB resource limit of BCS2.
pub const SCENE_GLYPH_TEXTURE_SIZE_LIMIT: u32 = 2048;

/// An optional read-only repeating pattern for a glyph run. Pixels are tightly packed row by row as premultiplied RGBA8; the scene carries content rather than a platform texture handle, so native, Web and offline executors all consume the same resource.
#[derive(Debug, Clone)]
pub struct GlyphTexture {
    pub key: GlyphTextureKey,
    pub width: u32,
    pub height: u32,
    pub rgba: Arc<[u8]>,
}

impl GlyphTexture {
    pub fn new(
        key: GlyphTextureKey,
        width: u32,
        height: u32,
        rgba: impl Into<Arc<[u8]>>,
    ) -> Option<Self> {
        let rgba = rgba.into();
        let expected = (width as usize)
            .checked_mul(height as usize)
            .and_then(|pixels| pixels.checked_mul(4));
        (width > 0
            && height > 0
            && width <= SCENE_GLYPH_TEXTURE_SIZE_LIMIT
            && height <= SCENE_GLYPH_TEXTURE_SIZE_LIMIT
            && expected == Some(rgba.len()))
        .then_some(Self {
            key,
            width,
            height,
            rgba,
        })
    }
}

/// Renderer-neutral glyph fills. `RepeatLinearGradient` defines a repeating linear gradient A→B→A in each glyph's local outline coordinates; `RepeatTexture` reads a repeating pattern in the same coordinate system from the owning [`GlyphRun::texture`]; `DilatedStroke` expands a centred stroke by canvas pixels around the stable alpha mask. All three let per-word state change only uniforms, without rewriting the atlas quad.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum GlyphPaint {
    #[default]
    Solid,
    RepeatLinearGradient {
        start: [f32; 2],
        end: [f32; 2],
        first: [f32; 4],
        middle: [f32; 4],
    },
    /// Samples the run-level premultiplied RGBA8 pattern repeatedly in the glyph's local outline coordinates.
    RepeatTexture,
    /// Applies a centred stroke to alpha glyphs; `width` is the full stroke width, and colour glyphs do not apply this effect. The compositor reserves a fixed outset for the mask quad, so producers must respect [`SCENE_GLYPH_STROKE_WIDTH_LIMIT`].
    DilatedStroke { width: f32 },
}

/// The maximum full stroke width that the retained glyph shader can express without rebuilding the quad.
pub const SCENE_GLYPH_STROKE_WIDTH_LIMIT: f32 = 16.0;

/// The per-pixel compositing mode of a retained scene node against existing targets. Under premultiplied colour, `Screen` can be written strictly as `source + destination * (1 - source)`, so all four wgpu backends can execute it with a fixed blend state. `Difference` / `Exclusion` must be placed on a top-level [`BlurredGroup`], and the host must supply a real target that supports `COPY_SRC`; ordinary transparent overlay targets must explicitly fall back.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum SceneCompositeMode {
    #[default]
    Normal,
    Screen,
    Difference,
    Exclusion,
}

/// The public name kept for compatibility with the first glyph-only scenes of R2; new nodes use the general enum.
pub type GlyphCompositeMode = SceneCompositeMode;

/// The run-local state shared by a group of glyphs. `transform` is applied after the stable instance geometry and before [`GlyphRun::pose`]; the colour is straight RGBA, converted to premultiplied inside the fragment shader and then composited into the target per [`GlyphRun::composite`]. `clip` is a canvas-coordinate rectangle `[left, top, right, bottom]` taken before the run transform is applied, so the clip box moves together with the per-word pose / scene pose while still only changing uniforms. Per-word emphasis neither rewrites glyph vertices nor re-rasterizes the mask.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GlyphRunUniform {
    pub transform: Mat6,
    pub color: [f32; 4],
    /// The chunk opacity excluding the text colour's alpha. Colour glyphs ignore the text colour and consume only this opacity; alpha masks still use `color.a`.
    pub color_opacity: f32,
    pub clip: Option<[f32; 4]>,
    pub paint: GlyphPaint,
}

/// A batch of glyphs that keeps the original draw order. Per-word state updates `uniforms`; whole-group entrance updates `pose`, or is sampled at compositing time by `motion`. The mask itself keeps hitting the atlas, so the overlay is no longer re-rasterized as a whole.
#[derive(Debug, Clone, Default)]
pub struct GlyphRun {
    pub glyphs: Arc<[GlyphInstance]>,
    pub uniforms: Vec<GlyphRunUniform>,
    /// The single read-only resource for `RepeatTexture`. A run allows only one pattern, to avoid stuffing a resource index into the per-word uniform; different patterns must be split into different ordered runs.
    pub texture: Option<Arc<GlyphTexture>>,
    pub composite: GlyphCompositeMode,
    pub pose: ScenePose,
    pub motion: Option<SceneMotion>,
}

/// Source-over composites multiple glyph layers onto a transparent intermediate layer first, then applies one separable box blur to the whole layer. The outline of subtitle shadow/glow and the body text must be merged before blurring; blurring each layer separately would change the overlapping alpha.
#[derive(Debug, Clone, Default)]
pub struct GlyphEffect {
    pub layers: Vec<Arc<GlyphRun>>,
    pub radius: u32,
}

/// Draws the child nodes into a transparent intermediate layer in their original z order, then applies to the whole group an optional box blur, a horizontal reveal, and a single composite. The subtitle entrance `magic-fade` uses it to ensure the backplate, shadow/glow, outline and fill all blur together; the text element `wipe` clips the whole layer after the blur; non-Normal subtitles use radius 0 to keep the CPU's "source-over within the group first, then composite the whole layer".
#[derive(Debug, Clone, Default)]
pub struct BlurredGroup {
    pub nodes: Vec<SceneNode>,
    pub radius: f32,
    pub motion: Option<SceneMotion>,
    /// The normalized width kept from the canvas left edge after blur. `None` means no clipping; the executor clamps the value to `[0, 1]`, and edge pixels use the same sub-pixel coverage as the CPU `mask.progress@1`.
    pub reveal: Option<f32>,
    /// Child nodes are first merged into a transparent intermediate layer using Normal, then the complete layer is composited onto the real target in one pass.
    pub composite: SceneCompositeMode,
}

/// A procedural rounded rectangle at compositing time. The position, size, corner radius and colour of the subtitle plate all belong to the per-frame uniform; the executor draws only one fixed quad, and does not re-tessellate for a width sweep-in or cross-word movement. `rect` is the canvas pixel `[x, y, width, height]` before [`Self::pose`] is applied; the colour is straight RGBA, and the final opacity must also be multiplied by the group opacity of the pose/motion.
#[derive(Debug, Clone, PartialEq)]
pub struct RoundedRectNode {
    pub rect: [f32; 4],
    pub radius: f32,
    pub color: [f32; 4],
    pub pose: ScenePose,
    pub motion: Option<SceneMotion>,
}

/// The scaling rule for an external media texture within the element box. The source pixels are still held by the host; the scene only freezes the renderer-neutral sampling semantics, and the Web/Metal/DX12 executors must not each recompute cover/contain on their own.
#[cfg(feature = "external-media-scene")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextureFit {
    Cover,
    Contain,
}

/// The compositing semantics of the letterbox margin in `contain`. PIP's historical behaviour is a transparent margin; fullscreen may choose black, or have the compositor generate a blurred background via an intermediate pass of cover → local box blur → darken → contain. The enum only freezes semantics and carries no platform texture.
#[cfg(feature = "external-media-scene")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextureBackground {
    Transparent,
    Black,
    Blur,
    /// A solid canvas background from 0.12 (`#RRGGBB`, opaque). `Black` is kept as a separate tier, so the parameters and fingerprints of older documents stay bit-identical.
    Color([u8; 3]),
}

/// The analytic mask of the external texture over the element's local box. Rounded rectangles continue to use [`TextureNode::radius`]; ellipses ignore the corner radius, consistent with the CPU reference of `mask.shape@1`.
#[cfg(feature = "external-media-scene")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextureMaskShape {
    RoundedRect,
    Ellipse,
}

/// Ordered effects executed before the media's natural size, fit/mask and element affine transform. The array order comes directly from `timeline::effects::lower_element_effects`; the compositor must not regroup them in a way that changes the visible RGBA8 round-trip boundaries. The `Blur` radius has already been converted to a natural-pixel integer based on the canvas short side.
#[cfg(feature = "external-media-scene")]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TextureEffect {
    ColorAdjust { grayscale: f32, brightness: f32 },
    Grayscale(f32),
    Brightness(f32),
    Contrast(f32),
    Saturation(f32),
    Sepia(f32),
    HueRotate(f32),
    Invert(f32),
    Blur(u32),
    Sharpen(f32),
    Noise(f32),
    Vignette(f32),
}

/// An ordered sampling node for one host texture. `texture` is a session key (usually the Timeline `srcId`) and carries no platform handle; before submission, the host fetches decoded frames only for the keys the current scene actually references. `transform` acts on `rect` in canvas pixels, using the same convention as DrawOp Mat6.
#[cfg(feature = "external-media-scene")]
#[derive(Debug, Clone, PartialEq)]
pub struct TextureNode {
    pub texture: String,
    /// The source media time; -1 for static images. The host may use it to drive an independent video decoder. The compositor only samples textures that have already arrived, and does not seek inside the render pass.
    pub media_ms: i64,
    pub source_width: u32,
    pub source_height: u32,
    pub rect: [f32; 4],
    pub transform: Mat6,
    pub opacity: f32,
    /// The corner radius is in element-local pixels, applied after cover/contain and before the affine transform.
    pub radius: f32,
    /// The shape for `mask.shape@1`. Full-screen non-tiled media is frozen as RoundedRect, keeping the historical semantics of not applying a local shape mask.
    pub mask_shape: TextureMaskShape,
    /// The mask feather width (element-local pixels). The CPU applies it on the local canvas first, then the element affine transform; the compositor must keep the same order and must not reinterpret it in final screen pixels.
    pub mask_feather: f32,
    /// The ordered effect chain at the media's natural size. The shared lowering has already expanded the filter/effect presets; identity effects are omitted, and the same chain can be executed item by item by native, Web and offscreen export.
    pub source_effects: Arc<[TextureEffect]>,
    /// The horizontal display ratio for `mask.progress@1`. 1 means no cropping; coverage is evaluated on element-local pixels, multiplied with the shape mask, and only then enters the element affine transform.
    pub reveal: f32,
    /// Circular reveal fraction, 1 = the complete local box.
    pub iris: f32,
    pub fit: TextureFit,
    pub background: TextureBackground,
}

/// An ordered node within one frame's scene. Array order is the z order; the execution layer must not reorder by node type. `SceneNode` belongs to the timeline/render intersection layer, not the wgpu execution layer.
#[derive(Debug, Clone)]
pub enum SceneNode {
    /// The existing DrawOp instruction stream shared by the CPU reference and the GPU vector executor.
    Vectors(Arc<FrameOps>),
    /// The same DrawOp geometry as `Vectors`, but additionally carrying a compositing-time pose. The subtitle backplate can move continuously with glyph motion, while the evaluation layer only needs to rebuild the scene at discrete word boundaries or when the motion ends.
    AnimatedVectors {
        frame: Arc<FrameOps>,
        pose: ScenePose,
        motion: Option<SceneMotion>,
    },
    /// A procedural shader node explicitly carries a canvas transform. `ShaderQuad`'s own identity transform is still used for offscreen conformance; the live scene does not rely on the executor guessing placement semantics.
    ShaderQuad {
        quad: Arc<ShaderQuad>,
        transform: TransformUniforms,
    },
    /// The host texture node shared by images, video frames and asset stickers. Its array position is its global z order relative to vector/glyph/shader; the execution layer must not open a separate canvas per resource type.
    #[cfg(feature = "external-media-scene")]
    Texture(Arc<TextureNode>),
    /// The glyph masks and per-glyph poses produced by the shared typesetting layer. The atlas and shader passes both belong to the compositor; nothing here carries any wgpu resource.
    Glyphs(Arc<GlyphRun>),
    /// A rounded rectangle for things like the Designed Caption plate, whose box parameters change every frame. A fixed quad plus a fragment SDF ensures the animation only writes uniforms and does not fall back to per-frame vector tessellation.
    RoundedRect(Arc<RoundedRectNode>),
    /// Multiple glyph layers are composited first, then blurred, then placed above the preceding nodes with source-over. The executor uses full-GPU intermediate textures; the live path must not read back to compute a bounding box or blur results.
    BlurredGlyphs(Arc<GlyphEffect>),
    /// Child nodes are composited first, then a whole-group blur is applied. `motion` samples the radius only at compositing time, while each child still consumes the transform/opacity channels of the same motion.
    BlurredGroup(Arc<BlurredGroup>),
}

impl SceneNode {
    pub fn shader_quad(quad: ShaderQuad, canvas: (f64, f64)) -> Self {
        let target = &quad.target;
        let transform = TransformUniforms::place(
            (
                target.x,
                target.y,
                f64::from(target.width),
                f64::from(target.height),
            ),
            canvas,
        );
        Self::ShaderQuad {
            quad: Arc::new(quad),
            transform,
        }
    }

    pub fn affine_shader_quad(quad: ShaderQuad, affine: Mat6, canvas: (f64, f64)) -> Self {
        let target = &quad.target;
        let transform = TransformUniforms::place_affine(
            (
                target.x,
                target.y,
                f64::from(target.width),
                f64::from(target.height),
            ),
            affine,
            canvas,
        );
        Self::ShaderQuad {
            quad: Arc::new(quad),
            transform,
        }
    }
}

/// The per-frame manifest that the evaluation layer hands to the compositor. `fingerprint` reuses the existing DrawOp/plan identity and is not recomputed by the GPU; `next_change` follows the absolute-time semantics of OverlayScheduler.
#[derive(Debug, Clone, Default)]
pub struct SceneFrame {
    pub nodes: Vec<SceneNode>,
    pub next_change: Option<f64>,
    /// `Some(t)` means the current scene contains continuous GPU motion before `t`; the scheduler should call `render_at` at the display refresh rate, but must not re-run the evaluation layer. Once that time is reached, if no other dirty source exists, zero-frame pumping resumes.
    pub active_until: Option<f64>,
    pub fingerprint: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scene_motion_samples_shared_curve_without_clamping_overshoot() {
        let motion = SceneMotion {
            start: 1.0,
            end: 2.0,
            from: ScenePose {
                transform: [0.7, 0.0, 0.0, 0.7, 30.0, 40.0],
                opacity: 0.25,
                blur: 6.0,
            },
            to: ScenePose::IDENTITY,
            curve: CurveSpec::CubicBezier {
                x1: 0.22,
                y1: 0.19,
                x2: 0.54,
                y2: 1.62,
            },
            solver: SceneCurveSolver::Caption,
        };
        assert_eq!(motion.sample(1.0), motion.from);
        assert_eq!(motion.sample(2.0), motion.to);
        assert!(
            (1..100)
                .map(|step| motion.sample(1.0 + f64::from(step) / 100.0))
                .any(|pose| pose.transform[0] > 1.0),
            "magic-pop 的 manifest 曲线过冲不能在 scene 层被夹掉"
        );
    }

    #[test]
    fn mat6_post_concat_applies_the_second_transform_last() {
        let combined = post_concat_mat6(
            [2.0, 3.0, 5.0, 7.0, 11.0, 13.0],
            [17.0, 19.0, 23.0, 29.0, 31.0, 37.0],
        );
        let point = [41.0, 43.0];
        let first = [
            2.0 * point[0] + 5.0 * point[1] + 11.0,
            3.0 * point[0] + 7.0 * point[1] + 13.0,
        ];
        let expected = [
            17.0 * first[0] + 23.0 * first[1] + 31.0,
            19.0 * first[0] + 29.0 * first[1] + 37.0,
        ];
        let actual = [
            combined[0] * point[0] + combined[2] * point[1] + combined[4],
            combined[1] * point[0] + combined[3] * point[1] + combined[5],
        ];
        assert_eq!(actual, expected);
    }
}
