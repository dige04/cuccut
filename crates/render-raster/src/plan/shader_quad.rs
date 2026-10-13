//! `ShaderQuad` pass (element plan ADR-E06 / §8.1–§8.5).
//!
//! A `ShaderQuad` = **one single-quad fragment draw**: all geometry is generated procedurally in the shader, with no per-primitive draw call. Only progress goes through this pass for now. Since the 2026-09 redesign, all 10 visualizer styles are CPU vector recipes (`visualizer_frame`), and the GPU backend composites them as ordinary vector layers. [`VisualizerUniforms`] / [`AudioTexture`] and `_prelude.wgsl` are kept as the frozen contract of §8.2 / §8.3, reserving a slot for a future GPU waveform recipe.
//!
//! ## Why it is not a fifth variant of `RenderPass`
//!
//! The motion stage 4 `FramePlan` / `PassExecutor` **has already landed** (the note in §10 P5 saying "not started" is out of date). Adding a variant to `RenderPass` would also touch `FRAME_PLAN_VERSION` and the plan encoding, which belong to motion stage 4's territory, and P5 must not change them unilaterally (last sentence of §10 P5). So P5a makes `ShaderQuad` a **separate pass description**: [`GpuExecutor`](super::executor_gpu) executes it directly, and the CPU side is unaffected. When the two lines merge, it can be folded into `RenderPass`; this module's fields are the fields of that variant.
//!
//! ## This module is not gated behind the `gpu` feature
//!
//! The **packing order** of the uniforms is the cross-document contract frozen in §8.2, and it must be pinned by tests even in builds without a GPU. Only execution actually needs wgpu.
//!
//! ## The §8.2 order is executable here
//!
//! [`VisualizerUniforms::BINDINGS`] / [`ProgressUniforms::BINDINGS`] are two `(binding, name)` tables, and [`UniformBinding`] produces bytes in the same order. The WGSL side, `_prelude.wgsl`, is cross-checked line by line against them (`tests/shader_wgsl.rs`).

use anyhow::{Result, bail};
use motion::preset_registry::{
    BinWidth, CatalogueRecipe, ProgressAspect, ProgressBody, RecipeAlgorithm,
};
use serde_json::Value;

use super::shader_source::{ShaderDomain, ShaderSource, shader_for};
use crate::drawop::{Color4, Mat6};
use crate::source::kernel::DrawBox;
use crate::source::progress::ProgressParams;
use crate::source::visualizer::{VizFrame, freq_row, time_row};

/// §8.3: number of rows in the audio texture.
pub const AUDIO_TEXTURE_ROWS: u32 = 2;

/// The bytes of one `@group(1)` uniform.
///
/// Each item is a **separate binding** (the §8.2 table is written by binding number), not one packed struct. This was adopted from the WGSL-side convention of the reference implementation; turning it into a struct would take away the checkable form of §8.2's "frozen order".
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UniformBinding {
    pub binding: u32,
    pub name: &'static str,
    pub bytes: Vec<u8>,
}

fn vec_bytes(values: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 4);
    for value in values {
        out.extend_from_slice(&value.to_le_bytes());
    }
    out
}

/// WebGL2/downlevel requires uniform binding type sizes to be multiples of 16 B. §8.2 still keeps each item as its own binding; only the tail of scalars and vec2 is zero-padded. vec4 is already 16 B.
fn uniform_bytes(values: &[f32]) -> Vec<u8> {
    let mut out = vec_bytes(values);
    out.resize(out.len().div_ceil(16) * 16, 0);
    out
}

fn f32_bytes(value: f32) -> Vec<u8> {
    uniform_bytes(&[value])
}

/// §8.1 `@group(0)`: vertex transform.
///
/// `u_transform` is a 4×4 column-major matrix, and `u_texTransform` is 3×3 (each column padded to 16 bytes in the uniform). The identity matrix means "the quad vertices are already in NDC, and texture coordinates pass through unchanged"; that is what the executor sends.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TransformUniforms {
    pub transform: [f32; 16],
    pub tex_transform: [f32; 9],
}

impl Default for TransformUniforms {
    fn default() -> Self {
        TransformUniforms {
            #[rustfmt::skip]
            transform: [
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
            #[rustfmt::skip]
            tex_transform: [
                1.0, 0.0, 0.0,
                0.0, 1.0, 0.0,
                0.0, 0.0, 1.0,
            ],
        }
    }
}

impl TransformUniforms {
    pub const BINDINGS: [(u32, &'static str); 2] = [(0, "u_transform"), (1, "u_texTransform")];

    /// **Sub-pixel placement**: maps the NDC unit quad onto a rectangle on the canvas that **may have fractional** coordinates (P5b decision 3).
    ///
    /// The §8.1 frozen vertex data are the four corners of `[-1, 1]²`, and the identity matrix in [`Default`] means "the quad fills the whole render target". In real compositing, an element box almost never lands on whole pixels (the default geometry table is in percentages; `85% × 1080 = 918` on 1080p is whole only by chance), while the width and height of a [`QuadTarget`] must be integers, since a render target can only have whole texels. **The fractional part is therefore carried by the transform here**: the content is shifted by half a pixel inside the target texture, rather than moved again at composite time (which would add a second resampling pass and blur the edges the shader worked to get right).
    ///
    /// `rect` and `surface` are both in **pixels**, origin top-left, y pointing down. The return value is a column-major 4×4. The `-pos.y` in the vertex shader already flips the vertex data into **y-up NDC**, so here we only need to convert canvas coordinates into y-up NDC (`ndc_y = 1 − 2·y/H`).
    ///
    pub fn place(rect: (f64, f64, f64, f64), surface: (f64, f64)) -> TransformUniforms {
        Self::place_affine(rect, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], surface)
    }

    /// Places the element's local quad into the canvas rectangle first, then applies the 2D affine in the same convention as DrawOp.
    /// `affine = [a,b,c,d,tx,ty]` means
    /// `(x',y') = (a·x+c·y+tx, b·x+d·y+ty)`. Rotation, mirroring and animation pose therefore share [`Mat6`] with the CPU reference, and the realtime compositor no longer degrades to axis-aligned placement.
    pub fn place_affine(
        rect: (f64, f64, f64, f64),
        affine: Mat6,
        surface: (f64, f64),
    ) -> TransformUniforms {
        let (x, y, w, h) = rect;
        let (sw, sh) = (surface.0.max(1.0), surface.1.max(1.0));
        let [a, b, c, d, tx, ty] = affine.map(f64::from);
        let center_x = x + w / 2.0;
        let center_y = y + h / 2.0;

        // The local coordinate the vertex shader receives is q=(pos.x,-pos.y): top-left=(-1,+1).
        // First map to pixels (cx+w/2*qx, cy-h/2*qy), then apply Mat6, then convert to NDC.
        let m00 = a * w / sw;
        let m10 = -b * w / sh;
        let m01 = -c * h / sw;
        let m11 = d * h / sh;
        let ndc_x = 2.0 * (a * center_x + c * center_y + tx) / sw - 1.0;
        let ndc_y = 1.0 - 2.0 * (b * center_x + d * center_y + ty) / sh;
        TransformUniforms {
            #[rustfmt::skip]
            transform: [
                m00 as f32,  m10 as f32, 0.0, 0.0,
                m01 as f32,  m11 as f32, 0.0, 0.0,
                0.0,         0.0,        1.0, 0.0,
                ndc_x as f32, ndc_y as f32, 0.0, 1.0,
            ],
            tex_transform: TransformUniforms::default().tex_transform,
        }
    }

    pub fn bindings(&self) -> Vec<UniformBinding> {
        // In the uniform address space, mat3x3f takes 16 bytes per column (4 bytes of padding after each column).
        let mut tex = Vec::with_capacity(48);
        for column in self.tex_transform.chunks(3) {
            tex.extend_from_slice(&vec_bytes(column));
            tex.extend_from_slice(&0f32.to_le_bytes());
        }
        vec![
            UniformBinding {
                binding: 0,
                name: "u_transform",
                bytes: vec_bytes(&self.transform),
            },
            UniformBinding {
                binding: 1,
                name: "u_texTransform",
                bytes: tex,
            },
        ]
    }
}

/// The 8 visualizer items of §8.2, **order frozen**.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VisualizerUniforms {
    /// Element-local time, in seconds.
    pub time: f32,
    pub main_color: Color4,
    pub secondary_color: Color4,
    /// Canvas resolution (pixels).
    pub canvas_res: [f32; 2],
    /// Output resolution of this quad (pixels). Used to compute the 1px line width.
    pub dst_res: [f32; 2],
    /// Multiplier for element opacity and enter/exit animation: the only seam between the GPU path and `MotionProgram` (§8.5: **do not recompute animation in the shader**).
    pub colour_multiplier: Color4,
    /// Four-edge crop, normalized `[left, top, right, bottom]`.
    pub clip: [f32; 4],
    /// Audio texture size; only styles that use bicubic sampling read it.
    pub texture_size: [f32; 2],
}

impl VisualizerUniforms {
    /// §8.2 frozen table (visualizer column).
    pub const BINDINGS: [(u32, &'static str); 8] = [
        (0, "u_time"),
        (1, "u_mainColor"),
        (2, "u_secondaryColor"),
        (3, "u_canvasRes"),
        (4, "u_dstRes"),
        (5, "u_colourMultiplier"),
        (6, "u_clip"),
        (7, "u_textureSize"),
    ];

    pub fn bindings(&self) -> Vec<UniformBinding> {
        let payloads: [Vec<u8>; 8] = [
            f32_bytes(self.time),
            uniform_bytes(&self.main_color),
            uniform_bytes(&self.secondary_color),
            uniform_bytes(&self.canvas_res),
            uniform_bytes(&self.dst_res),
            uniform_bytes(&self.colour_multiplier),
            uniform_bytes(&self.clip),
            uniform_bytes(&self.texture_size),
        ];
        zip_bindings(&VisualizerUniforms::BINDINGS, payloads)
    }
}

/// The 9 progress items of §8.2, **order frozen**. Has `u_progress` and `u_srcRes` added, and lacks `u_textureSize`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProgressUniforms {
    /// The host derives this each frame from `from/to` and the playhead, closed interval `[0, 1]`.
    pub progress: f32,
    /// Element-local time, in seconds (`t − element.start`, the convention fixed in P4).
    pub time: f32,
    pub main_color: Color4,
    pub secondary_color: Color4,
    pub canvas_res: [f32; 2],
    pub src_res: [f32; 2],
    pub dst_res: [f32; 2],
    pub colour_multiplier: Color4,
    pub clip: [f32; 4],
}

impl ProgressUniforms {
    /// §8.2 frozen table (progress column).
    pub const BINDINGS: [(u32, &'static str); 9] = [
        (0, "u_progress"),
        (1, "u_time"),
        (2, "u_mainColor"),
        (3, "u_secondaryColor"),
        (4, "u_canvasRes"),
        (5, "u_srcRes"),
        (6, "u_dstRes"),
        (7, "u_colourMultiplier"),
        (8, "u_clip"),
    ];

    pub fn bindings(&self) -> Vec<UniformBinding> {
        let payloads: [Vec<u8>; 9] = [
            f32_bytes(self.progress),
            f32_bytes(self.time),
            uniform_bytes(&self.main_color),
            uniform_bytes(&self.secondary_color),
            uniform_bytes(&self.canvas_res),
            uniform_bytes(&self.src_res),
            uniform_bytes(&self.dst_res),
            uniform_bytes(&self.colour_multiplier),
            uniform_bytes(&self.clip),
        ];
        zip_bindings(&ProgressUniforms::BINDINGS, payloads)
    }
}

fn zip_bindings<const N: usize>(
    table: &[(u32, &'static str); N],
    payloads: [Vec<u8>; N],
) -> Vec<UniformBinding> {
    table
        .iter()
        .zip(payloads)
        .map(|(&(binding, name), bytes)| UniformBinding {
            binding,
            name,
            bytes,
        })
        .collect()
}

/// The two forms of `@group(1)`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QuadUniforms {
    Visualizer(VisualizerUniforms),
    Progress(ProgressUniforms),
}

impl QuadUniforms {
    pub fn domain(&self) -> ShaderDomain {
        match self {
            QuadUniforms::Visualizer(_) => ShaderDomain::Visualizer,
            QuadUniforms::Progress(_) => ShaderDomain::Progress,
        }
    }

    pub fn bindings(&self) -> Vec<UniformBinding> {
        match self {
            QuadUniforms::Visualizer(uniforms) => uniforms.bindings(),
            QuadUniforms::Progress(uniforms) => uniforms.bindings(),
        }
    }
}

/// `@group(3) @binding(0)`: recipe parameters.
///
/// What §8.2 freezes is the order of `@group(1)`; the recipe numbers do not fit there, so CucCut puts them in their own group. The byte order is the field order of each style's struct in its WGSL.
///
/// The discipline that **the shader contains no recipe numbers** shares its origin with the Rust kernel (since `loop_kernel` in motion stage 1): `barCount` is data, and hard-coding it in WGSL would mean copying the source six times for the six styles of the `bars-v1` family.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecipeUniform {
    pub bytes: Vec<u8>,
}

impl RecipeUniform {
    fn from_floats(values: &[f32]) -> RecipeUniform {
        RecipeUniform {
            bytes: vec_bytes(values),
        }
    }
}

/// A color notation other than `#RRGGBB`: the recipe's `[r, g, b, a]` (0..1, passed through as-is).
fn color_floats(value: &Value) -> [f32; 4] {
    let array = value.as_array();
    let channel = |slot: usize| {
        array
            .and_then(|list| list.get(slot))
            .and_then(Value::as_f64)
            .unwrap_or_default() as f32
    };
    [channel(0), channel(1), channel(2), channel(3)]
}

/// Pads a run of f32 values up to a multiple of 16 bytes (the alignment requirement of WGSL uniform structs).
fn padded(values: &mut Vec<f32>) {
    while values.len() % 4 != 0 {
        values.push(0.0);
    }
}

/// The recipe uniform of `frame-v1` (`shaders/progress/border.wgsl`).
pub fn pack_frame_v1(body: &ProgressBody) -> Result<RecipeUniform> {
    let recipe = &body.recipe;
    let (Some(border_size), Some(smoothing), Some(fill), Some(background), Some(mode)) = (
        recipe.number("borderSize"),
        recipe.number("smoothing"),
        recipe.text("fill"),
        recipe.flag("background"),
        recipe.object("colorMode"),
    ) else {
        bail!("frame-v1 配方缺必填参数");
    };
    let kind = mode.get("kind").and_then(Value::as_str).unwrap_or("solid");
    let color_kind = match kind {
        "solid" => 0.0,
        "rainbow" => 1.0,
        "strobe" => 2.0,
        other => bail!("frame-v1 的 colorMode.kind 未知：{other}"),
    };
    let number = |key: &str| mode.get(key).and_then(Value::as_f64).unwrap_or_default() as f32;
    let mut values = vec![
        border_size as f32,
        smoothing as f32,
        if fill == "reverse" { 1.0 } else { 0.0 },
        if background { 1.0 } else { 0.0 },
        color_kind,
        number("hueSpeed"),
        number("mixBias"),
        number("mixGain"),
        number("speed"),
    ];
    padded(&mut values);
    let mut corners = [[0f32; 4]; 4];
    if let Some(list) = mode.get("corners").and_then(Value::as_array) {
        for (slot, entry) in list.iter().enumerate().take(4) {
            corners[slot] = color_floats(entry);
        }
    }
    for corner in corners {
        values.extend_from_slice(&corner);
    }
    Ok(RecipeUniform::from_floats(&values))
}

/// The recipe uniform of `ring-v1` (`shaders/progress/circle.wgsl`).
///
/// `featherPx` / `edgeFeatherPx` are **not multiplied by `pixel_scale`**: they mean "a few pixels of anti-aliasing", not "a few pixels on the reference short edge". The shader converts them in place using `u_dstRes`. (This differs from `radiusPx` in `bar-v1`, which is a length.)
pub fn pack_ring_v1(body: &ProgressBody) -> Result<RecipeUniform> {
    let recipe = &body.recipe;
    let (Some(feather), Some(edge_feather), Some(inner), Some(direction)) = (
        recipe.number("featherPx"),
        recipe.number("edgeFeatherPx"),
        recipe.number("innerRadius"),
        recipe.text("direction"),
    ) else {
        bail!("ring-v1 配方缺必填参数");
    };
    Ok(RecipeUniform::from_floats(&[
        feather as f32,
        edge_feather as f32,
        inner.clamp(0.0, 1.0) as f32,
        if direction == "ccw" { 1.0 } else { 0.0 },
    ]))
}

/// The recipe uniform of `snake-v1` (`shaders/progress/snake.wgsl`).
pub fn pack_snake_v1(body: &ProgressBody) -> Result<RecipeUniform> {
    let recipe = &body.recipe;
    let (
        Some(dot),
        Some(smoothing),
        Some(orbit),
        Some(start_angle),
        Some(increment),
        Some(max_iterations),
        Some(mode),
    ) = (
        recipe.number("dotRadius"),
        recipe.number("smoothing"),
        recipe.number("orbitRadius"),
        recipe.number("startAngleDeg"),
        recipe.number("angleIncrementDeg"),
        recipe.integer("maxIterations"),
        recipe.object("colorMode"),
    )
    else {
        bail!("snake-v1 配方缺必填参数");
    };
    if increment == 0.0 {
        bail!("snake-v1 的 angleIncrementDeg 不能是 0");
    }
    let mut boosts = [0f32; 4];
    if let Some(list) = recipe.array("boostSteps") {
        for (slot, step) in list.iter().enumerate().take(2) {
            boosts[slot * 2] = step
                .get("below")
                .and_then(Value::as_f64)
                .unwrap_or_default() as f32;
            boosts[slot * 2 + 1] =
                step.get("gain").and_then(Value::as_f64).unwrap_or_default() as f32;
        }
    }
    let spin = recipe
        .object("spin")
        .and_then(|object| object.get("speedDegPerSec"))
        .and_then(Value::as_f64)
        .unwrap_or_default() as f32;
    let kind = mode.get("kind").and_then(Value::as_str).unwrap_or("solid");
    let color_kind = match kind {
        "solid" => 0.0,
        "rainbow" => 1.0,
        other => bail!("snake-v1 的 colorMode.kind 未知：{other}"),
    };
    let track_is_main = if mode.get("trackColor").and_then(Value::as_str) == Some("main") {
        1.0
    } else {
        0.0
    };
    let rainbow_speed = mode
        .get("rotationSpeedDegPerSec")
        .and_then(Value::as_f64)
        .unwrap_or_default() as f32;
    let mut values = vec![
        dot as f32,
        smoothing as f32,
        orbit as f32,
        start_angle as f32,
        increment as f32,
        max_iterations.max(1) as f32,
        boosts[0],
        boosts[1],
        boosts[2],
        boosts[3],
        spin,
        color_kind,
        track_is_main,
        rainbow_speed,
    ];
    padded(&mut values);
    Ok(RecipeUniform::from_floats(&values))
}

/// The recipe uniform of `bar-v1`. Field order corresponds word for word to `struct BarRecipe` in `shaders/progress/normal.wgsl`.
///
/// `radiusPx` is multiplied by the host's `pixel_scale` (`canvas_short_edge / REFERENCE_SHORT_EDGE`) here, the same conversion as the CPU side in `bar_v1::draw`. Clamping it to "half the short edge" is the shader's job, since it is the one that has `u_dstRes`.
pub fn pack_bar_v1(body: &ProgressBody, pixel_scale: f64) -> Result<RecipeUniform> {
    let recipe = &body.recipe;
    let Some(direction) = recipe.text("direction") else {
        bail!("bar-v1 配方缺 direction");
    };
    let radius_px = recipe
        .object("corner")
        .filter(|corner| corner.get("kind").and_then(Value::as_str) == Some("capsule"))
        .and_then(|corner| corner.get("radiusPx"))
        .and_then(Value::as_f64)
        .map(|pixels| pixels * pixel_scale)
        .unwrap_or(0.0)
        .max(0.0);
    Ok(RecipeUniform::from_floats(&[
        if direction == "rtl" { 1.0 } else { 0.0 },
        radius_px as f32,
        0.0,
        0.0,
    ]))
}

/// A `w × 2` `R8Unorm` audio texture (§8.3).
///
/// **Row 0 = time domain, row 1 = frequency domain, no flip.** Row-major, `data.len() == width × 2`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioTexture {
    pub width: u32,
    pub rows: u32,
    pub data: Vec<u8>,
}

impl AudioTexture {
    /// One frame of spectrum → texture bytes.
    ///
    /// The two rows have **different widths** in `VizFrame` (128 and 512 for BCS1), while the texture requires equal widths. The frequency row takes a window according to the recipe's `binWidth` (§8.4, directly taking the lowest bins with no frequency compensation), and the time row is resampled to the same width using the clamp-to-edge texel-center rule.
    ///
    /// **Resampling is part of the row semantics.** The CPU reference goes through the same [`crate::source::visualizer::time_row`] (P5b decision; see that function's docs: if the two readings of `beam` do not coincide, flat regions deviate from 255).
    pub fn from_frame(frame: &VizFrame, bin_width: BinWidth) -> AudioTexture {
        let freq = freq_row(frame, bin_width);
        let width = freq.len().max(1);
        let mut data = Vec::with_capacity(width * AUDIO_TEXTURE_ROWS as usize);
        data.extend_from_slice(&time_row(frame, bin_width));
        data.extend_from_slice(freq);
        if freq.is_empty() {
            data.push(0);
        }
        AudioTexture {
            width: width as u32,
            rows: AUDIO_TEXTURE_ROWS,
            data,
        }
    }

    /// The bytes of row `row` (`row 0` time domain / `row 1` frequency domain).
    pub fn row(&self, row: u32) -> &[u8] {
        let width = self.width as usize;
        let start = row as usize * width;
        &self.data[start..start + width]
    }
}

/// The output rectangle of the quad: its landing position on the canvas, plus integer pixel size.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct QuadTarget {
    pub x: f64,
    pub y: f64,
    pub width: u32,
    pub height: u32,
}

impl QuadTarget {
    /// The **fractional part** of the landing position (pixels).
    ///
    /// A render target can only be whole texels, while an element box almost never lands on whole pixels. P5b decision 3: this half pixel is carried by the §8.1 `u_transform` ([`TransformUniforms::place`]), **not** by moving again at composite time, which would add another resampling pass. The integer size of `QuadTarget` only serves the offscreen conformance targets (the fixture's landing position is zeroed, so its fractional part is always 0).
    pub fn subpixel_offset(&self) -> (f64, f64) {
        (self.x - self.x.floor(), self.y - self.y.floor())
    }

    /// Element box → output rectangle. Size is rounded to whole pixels (GPU render targets must be integers).
    pub fn from_box(bbox: DrawBox) -> QuadTarget {
        QuadTarget {
            x: bbox.x,
            y: bbox.y,
            width: bbox.w.round().max(1.0) as u32,
            height: bbox.h.round().max(1.0) as u32,
        }
    }

    fn res(&self) -> [f32; 2] {
        [self.width as f32, self.height as f32]
    }
}

/// The full description of one `ShaderQuad` pass.
///
/// The fields are the three things ADR-E06 specifies (`shader_id` / `uniforms` / `data_texture`), plus the output rectangle and the recipe pack for `@group(3)`.
#[derive(Debug, Clone, PartialEq)]
pub struct ShaderQuad {
    /// Source registry entry. `ShaderQuad` takes an **already resolved** source, not a string id: "this style has no WGSL yet" must be an `Err` at the moment the quad is built, not discovered at compile time.
    pub shader: &'static ShaderSource,
    /// Style face-value id (for diagnostics and cache keys).
    pub style: String,
    pub transform: TransformUniforms,
    pub uniforms: QuadUniforms,
    pub recipe: RecipeUniform,
    /// The audio texture slot of §8.3. Always `None` for progress. Visualizer does not currently go through a quad, so the field is kept for a future GPU waveform recipe.
    pub data_texture: Option<AudioTexture>,
    pub target: QuadTarget,
}

impl ShaderQuad {
    pub fn domain(&self) -> ShaderDomain {
        self.uniforms.domain()
    }

    /// One progress frame → one quad.
    #[allow(clippy::too_many_arguments)]
    pub fn progress(
        recipe: &CatalogueRecipe,
        params: &ProgressParams,
        progress: f64,
        time: f64,
        bbox: DrawBox,
        canvas: (f64, f64),
    ) -> Result<ShaderQuad> {
        let Some(body) = recipe.progress() else {
            bail!("{} 不是 progress 配方", recipe.id);
        };
        let Some(shader) = shader_for(ShaderDomain::Progress, &recipe.id) else {
            bail!("progress 样式 \"{}\" 还没有 WGSL 实现", recipe.id);
        };
        let bbox = match body.aspect {
            ProgressAspect::Square => bbox.inscribed_square(),
            ProgressAspect::Bar | ProgressAspect::Frame => bbox,
        };
        let recipe_uniform = match body.recipe.algorithm {
            RecipeAlgorithm::BarV1 => pack_bar_v1(body, params.pixel_scale)?,
            RecipeAlgorithm::FrameV1 => pack_frame_v1(body)?,
            RecipeAlgorithm::RingV1 => pack_ring_v1(body)?,
            RecipeAlgorithm::SnakeV1 => pack_snake_v1(body)?,
            other => bail!("算法 {:?} 不是 progress 配方", other),
        };
        // Handling of non-finite values is identical to `progress_frame`: no panic, read as 0.
        let progress = if progress.is_finite() {
            progress.clamp(0.0, 1.0)
        } else {
            0.0
        };
        let time = if time.is_finite() { time } else { 0.0 };
        let target = QuadTarget::from_box(bbox);
        Ok(ShaderQuad {
            shader,
            style: recipe.id.clone(),
            transform: TransformUniforms::default(),
            uniforms: QuadUniforms::Progress(ProgressUniforms {
                progress: progress as f32,
                time: time as f32,
                main_color: params.main_color,
                secondary_color: params.secondary_color,
                canvas_res: [canvas.0 as f32, canvas.1 as f32],
                src_res: target.res(),
                dst_res: target.res(),
                colour_multiplier: [1.0, 1.0, 1.0, 1.0],
                clip: [0.0, 0.0, 0.0, 0.0],
            }),
            recipe: recipe_uniform,
            data_texture: None,
            target,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use motion::preset_registry::timeline_progress;

    const BOX: DrawBox = DrawBox {
        x: 0.0,
        y: 0.0,
        w: 480.0,
        h: 120.0,
    };

    fn frame() -> VizFrame {
        VizFrame {
            time: (0..128).map(|i| i as u8).collect::<Vec<_>>().into(),
            freq: (0..512).map(|i| (i % 256) as u8).collect::<Vec<_>>().into(),
        }
    }

    /// Sub-pixel placement (P5b decision 3): `u_transform` maps the unit quad onto a canvas rectangle **with fractional** coordinates. Four things are pinned together: filling the whole canvas equals the identity matrix; a box of half the width scales by half; **a shift of half a pixel is half a pixel** (this is what "sub-pixel" means); and the y-axis orientation matches the `-pos.y` in the vertex shader.
    #[test]
    fn the_transform_places_the_quad_at_subpixel_precision() {
        let identity = TransformUniforms::default().transform;
        assert_eq!(
            TransformUniforms::place((0.0, 0.0, 1920.0, 1080.0), (1920.0, 1080.0)).transform,
            identity
        );

        // Top-left quarter: halved in size, center lands at NDC (−0.5, +0.5).
        let quarter =
            TransformUniforms::place((0.0, 0.0, 960.0, 540.0), (1920.0, 1080.0)).transform;
        assert_eq!((quarter[0], quarter[5]), (0.5, 0.5));
        assert_eq!((quarter[12], quarter[13]), (-0.5, 0.5));

        // A half-pixel shift: on NDC it is exactly `2 · 0.5 / 1920` (x) and `−2 · 0.5 / 1080` (y).
        let base =
            TransformUniforms::place((100.0, 50.0, 480.0, 270.0), (1920.0, 1080.0)).transform;
        let moved =
            TransformUniforms::place((100.5, 50.5, 480.0, 270.0), (1920.0, 1080.0)).transform;
        // The tolerance is set at the magnitude of f32: subtracting two f32 values of about 0.65 gives an absolute error around 1e−7.
        assert!((f64::from(moved[12] - base[12]) - 1.0 / 1920.0).abs() < 1e-6);
        assert!((f64::from(moved[13] - base[13]) + 1.0 / 1080.0).abs() < 1e-6);
        // Scaling is not affected by the landing position.
        assert_eq!((moved[0], moved[5]), (base[0], base[5]));

        // `QuadTarget` only takes integer sizes; the fractional part is left to the transform above.
        let target = QuadTarget::from_box(DrawBox {
            x: 100.25,
            y: 50.75,
            w: 480.0,
            h: 270.0,
        });
        assert_eq!((target.width, target.height), (480, 270));
        let (dx, dy) = target.subpixel_offset();
        assert!((dx - 0.25).abs() < 1e-9 && (dy - 0.75).abs() < 1e-9);
        // The fixture's integer box: its fractional part is always 0.
        assert_eq!(QuadTarget::from_box(BOX).subpixel_offset(), (0.0, 0.0));
    }

    #[test]
    fn the_transform_applies_the_same_affine_as_drawops() {
        let rect = (100.0, 50.0, 200.0, 100.0);
        let affine = [2.0, 0.0, 0.0, 0.5, 10.0, 20.0];
        let matrix = TransformUniforms::place_affine(rect, affine, (1000.0, 500.0)).transform;
        let project = |qx: f32, qy: f32| {
            (
                matrix[0] * qx + matrix[4] * qy + matrix[12],
                matrix[1] * qx + matrix[5] * qy + matrix[13],
            )
        };
        let close = |left: f32, right: f32| (left - right).abs() < 1e-6;

        // Mat6 turns the pixel box [100,300]×[50,150] into [210,610]×[45,95].
        let top_left = project(-1.0, 1.0);
        assert!(close(top_left.0, -0.58));
        assert!(close(top_left.1, 0.82));
        let bottom_right = project(1.0, -1.0);
        assert!(close(bottom_right.0, 0.22));
        assert!(close(bottom_right.1, 0.62));

        assert_eq!(
            TransformUniforms::place_affine(rect, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], (1000.0, 500.0),),
            TransformUniforms::place(rect, (1000.0, 500.0))
        );
    }

    /// The order in §8.2 is a **frozen cross-document contract**; this test is its executable form.
    #[test]
    fn the_group1_uniform_order_is_frozen() {
        assert_eq!(
            VisualizerUniforms::BINDINGS.map(|(_, name)| name),
            [
                "u_time",
                "u_mainColor",
                "u_secondaryColor",
                "u_canvasRes",
                "u_dstRes",
                "u_colourMultiplier",
                "u_clip",
                "u_textureSize",
            ]
        );
        assert_eq!(
            ProgressUniforms::BINDINGS.map(|(_, name)| name),
            [
                "u_progress",
                "u_time",
                "u_mainColor",
                "u_secondaryColor",
                "u_canvasRes",
                "u_srcRes",
                "u_dstRes",
                "u_colourMultiplier",
                "u_clip",
            ]
        );
        // binding number = index in the table; each of the two tables is contiguous on its own.
        for (index, (binding, _)) in VisualizerUniforms::BINDINGS.iter().enumerate() {
            assert_eq!(*binding as usize, index);
        }
        for (index, (binding, _)) in ProgressUniforms::BINDINGS.iter().enumerate() {
            assert_eq!(*binding as usize, index);
        }
    }

    /// Each item in §8.2 is still a separate binding; scalars and vec2 are also padded to the 16 B that WebGL2 requires.
    #[test]
    fn the_uniform_payloads_match_their_wgsl_types() {
        let quad = ShaderQuad::progress(
            timeline_progress("normal").unwrap(),
            &ProgressParams {
                main_color: [1.0, 0.0, 0.0, 1.0],
                secondary_color: [0.0, 0.0, 1.0, 1.0],
                pixel_scale: 1.0,
            },
            0.5,
            0.0,
            BOX,
            (1920.0, 1080.0),
        )
        .unwrap();
        let sizes: Vec<usize> = quad
            .uniforms
            .bindings()
            .iter()
            .map(|binding| binding.bytes.len())
            .collect();
        assert_eq!(sizes, vec![16; 9]);
        // `@group(0)`: mat4x4f is 64 bytes; mat3x3f is padded to 16 per column ⇒ 48 bytes.
        let transform: Vec<usize> = quad
            .transform
            .bindings()
            .iter()
            .map(|binding| binding.bytes.len())
            .collect();
        assert_eq!(transform, vec![64, 48]);
        // `@group(3)`: four f32 in `struct BarRecipe`.
        assert_eq!(quad.recipe.bytes.len(), 16);
        assert!(quad.data_texture.is_none(), "progress 没有音频纹理");
    }

    /// The row semantics of §8.3: row 0 = time domain, row 1 = frequency domain, no flip.
    ///
    /// The GLSL reference implementation enables `UNPACK_FLIP_Y_WEBGL`, so its row order is the reverse of WGSL's. This assertion is the gate that stops "forgot to flip back when porting the GLSL".
    #[test]
    fn the_audio_texture_rows_are_time_then_frequency_without_a_flip() {
        let frame = frame();
        let texture = AudioTexture::from_frame(&frame, BinWidth::Half);
        assert_eq!(texture.rows, 2);
        assert_eq!(texture.width, 512);
        assert_eq!(texture.data.len(), 1024);
        // The frequency row is copied as-is (`half` = all 512).
        assert_eq!(texture.row(1), &frame.freq[..]);
        // The time row is resampled, but **the semantics of centering at 128 are unchanged**: the first byte still comes from the time row, not the frequency row. If the row order were flipped, `row(0)` would equal the frequency row.
        assert_ne!(texture.row(0), &frame.freq[..]);
        assert_eq!(texture.row(0).len(), 512);

        // `binWidth == "64"`: the frequency domain takes the lowest 64 bins (§8.4, no frequency compensation).
        let narrow = AudioTexture::from_frame(&frame, BinWidth::Fixed64);
        assert_eq!(narrow.width, 64);
        assert_eq!(narrow.row(1), &frame.freq[..64]);
    }

    /// When row widths are equal, the time row is **byte-for-byte identical** (it does not drift just because it went through a resampling step).
    #[test]
    fn the_time_row_is_verbatim_when_the_widths_agree() {
        let frame = VizFrame {
            time: (0..64).map(|i| (i * 3) as u8).collect::<Vec<_>>().into(),
            freq: vec![7u8; 64].into(),
        };
        let texture = AudioTexture::from_frame(&frame, BinWidth::Fixed64);
        assert_eq!(texture.row(0), &frame.time[..]);
        assert_eq!(texture.row(1), &frame.freq[..]);
    }

    /// **All 14 progress styles build a quad without exception**: the source exists, the recipe-packing arm exists, and the geometry is valid.
    ///
    /// The other half ("a style without WGSL must be `Err`, so the host falls back to CPU instead of getting a quad that draws nothing") is guarded by the lookup test in `plan::shader_source`, because only there can a nonexistent style id be constructed.
    #[test]
    fn every_progress_style_builds_a_quad() {
        let progress_params = ProgressParams {
            main_color: [1.0, 0.0, 0.0, 1.0],
            secondary_color: [0.0, 0.0, 1.0, 1.0],
            pixel_scale: 1.0,
        };
        for recipe in motion::preset_registry::timeline_progresses() {
            let quad =
                ShaderQuad::progress(recipe, &progress_params, 0.5, 0.25, BOX, (1920.0, 1080.0))
                    .unwrap_or_else(|error| panic!("progress/{}: {error}", recipe.id));
            // The recipe pack for `@group(3)` must be a multiple of 16 bytes (WGSL uniform alignment).
            assert_eq!(quad.recipe.bytes.len() % 16, 0, "{}", recipe.id);
            assert!(quad.data_texture.is_none(), "progress 没有音频纹理");
        }
    }

    /// The byte length of each recipe pack is checked, family by family, against the size of the struct in its own WGSL. If a field is changed and the other side is forgotten, this goes red immediately.
    #[test]
    fn the_recipe_payload_sizes_match_their_wgsl_structs() {
        use motion::preset_registry::timeline_progress;
        let prog = |id: &str| timeline_progress(id).unwrap().progress().unwrap();
        assert_eq!(pack_bar_v1(prog("normal"), 1.0).unwrap().bytes.len(), 16);
        assert_eq!(
            pack_frame_v1(prog("rainbow_border")).unwrap().bytes.len(),
            // 12 f32 + `array<vec4f, 4>`
            48 + 64
        );
        assert_eq!(pack_ring_v1(prog("donut")).unwrap().bytes.len(), 16);
        assert_eq!(pack_snake_v1(prog("snake_spin")).unwrap().bytes.len(), 64);
    }

    /// Non-finite progress values follow the same rule as `progress_frame` (read as 0, no panic).
    #[test]
    fn a_non_finite_progress_reads_as_zero() {
        let params = ProgressParams {
            main_color: [1.0, 0.0, 0.0, 1.0],
            secondary_color: [0.0, 0.0, 1.0, 1.0],
            pixel_scale: 1.0,
        };
        let quad = ShaderQuad::progress(
            timeline_progress("normal").unwrap(),
            &params,
            f64::NAN,
            f64::INFINITY,
            BOX,
            (1920.0, 1080.0),
        )
        .unwrap();
        let QuadUniforms::Progress(uniforms) = quad.uniforms else {
            unreachable!()
        };
        assert_eq!(uniforms.progress, 0.0);
        assert_eq!(uniforms.time, 0.0);
    }
}
