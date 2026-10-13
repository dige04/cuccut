// Binding surface and vertex shader for the visualizer domain (design §8.1 / §8.2 / §8.3).
//
// This file is where the §8 frozen contract lands on the WGSL side: changing it changes the cross-document contract. The Rust-side
// counterpart is `VisualizerUniforms::BINDINGS` in `src/plan/shader_quad.rs` and
// `source/visualizer::AUDIO_TEXTURE_ROW_{TIME,FREQ}`; both are checked against each other by
// `tests/shader_wgsl.rs`.

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texCoord : vec2f,
}

// ── §8.1 `@group(0)`: vertex transform.
@group(0) @binding(0) var<uniform> u_transform : mat4x4f;
@group(0) @binding(1) var<uniform> u_texTransform : mat3x3f;

// ── §8.2 `@group(1)`: the 8 visualizer entries, **order frozen**.
// WebGL2 has no `BUFFER_BINDINGS_NOT_16_BYTE_ALIGNED`, so the scalar / vec2
// binding types are explicitly padded to 16 B; the binding count, names and order still match the frozen table one for one.
struct ScalarUniform { value : vec4f }
struct Vec2Uniform { value : vec2f, _padding : vec2f }
@group(1) @binding(0) var<uniform> u_time : ScalarUniform;
@group(1) @binding(1) var<uniform> u_mainColor : vec4f;
@group(1) @binding(2) var<uniform> u_secondaryColor : vec4f;
@group(1) @binding(3) var<uniform> u_canvasRes : Vec2Uniform;
@group(1) @binding(4) var<uniform> u_dstRes : Vec2Uniform;
@group(1) @binding(5) var<uniform> u_colourMultiplier : vec4f;
@group(1) @binding(6) var<uniform> u_clip : vec4f;
@group(1) @binding(7) var<uniform> u_textureSize : Vec2Uniform;

// ── §8.1 `@group(2)`: audio data texture + sampler (linear / clamp-to-edge).
@group(2) @binding(0) var u_audio : texture_2d<f32>;
@group(2) @binding(1) var uSampler : sampler;

// ── `@group(3)`: **recipe parameters**. §8.2 freezes the order of `@group(1)`; recipe numbers cannot
//    be squeezed in, so CucCut puts them in their own group, one binding per struct.
//    The struct's field table is declared by each style file; the packing order on the Rust side must match it exactly.

/// Four-edge clipping of the normalised `texCoord` (§8.5): `u_clip = [left, top, right, bottom]`,
/// `discard` when outside.
fn DiscardClip(texCoord : vec2f) {
    var clipped : bool = false;
    if (texCoord.x <= u_clip[0]) { clipped = true; }
    if (texCoord.y <= u_clip[1]) { clipped = true; }
    if (texCoord.x >= 1.0 - u_clip[2]) { clipped = true; }
    if (texCoord.y >= 1.0 - u_clip[3]) { clipped = true; }
    if (clipped) { discard; }
}

// ── §8.3 Row semantics of the audio texture: **row 0 = time domain, row 1 = frequency domain, no flip**.
//
// The reference implementation's GLSL version enabled `UNPACK_FLIP_Y_WEBGL`, so there `v = 0` is the frequency row, which is
// **the opposite** of the WGSL version. CucCut adopts the WGSL-side semantics; when porting the GLSL reference, the row
// index must be flipped, or you get a silently wrong image (the time-domain row is a centred waveform where "silence ≈ 128"; using it as the frequency row
// only draws a row of half-height bars, which looks like it "is working").
//
// `v = 0.0` / `v = 1.0` with clamp-to-edge land **outside the texel centres**, so the vertical coordinate is clamped to
// that row itself and the two rows never interpolate into each other. This matters especially for the bicubic below.
const AUDIO_ROW_TIME : f32 = 0.0;
const AUDIO_ROW_FREQ : f32 = 1.0;

fn sampleTemporal(x : f32) -> f32 {
    return textureSampleLevel(u_audio, uSampler, vec2f(x, AUDIO_ROW_TIME), 0.0).r;
}

fn sampleFrequency(x : f32) -> f32 {
    return textureSampleLevel(u_audio, uSampler, vec2f(x, AUDIO_ROW_FREQ), 0.0).r;
}

/// One-row **bicubic sampling**: the 1-D version of `textureBicubic`.
///
/// ## Why not the reference implementation's 2-D sampling (the number-one trap in P5b porting)
///
/// The reference `textureBicubic` does **2-D** bicubic on a `w × 2` texture. Plugging in the numbers:
/// when reading the frequency row, `v = 1`, and the vertical axis is rescued by clamp-to-edge; but the path that reads the **frequency row**
/// in the CPU-side counterpart has `fract(0·2 − 0.5) = 0.5` when `v = 0`, so the vertical weights become
/// `0.9792 × row0 + 0.0208 × row1` — 2.1% of the time-domain row seeps into the other row's value. In silence
/// (time-domain row ≈ 128) this term alone is `0.0208 × 0.5 ≈ 2.65/255`, **this one leak alone uses up the entire
/// strict-level budget of ≤ 2/255**.
///
/// That is the product of "two semantically unrelated rows squeezed into one texture and then interpolated in 2-D", not part of the style:
/// the recipe's `row` field already states which row to read. The CPU side
/// (`source/kernel.rs::sample_row_bicubic`) therefore **interpolates only along the u axis**, and this function is
/// word-for-word isomorphic with it: the `row` parameter is passed straight to the vertical coordinate, which is always clamped to that row.
///
/// The arithmetic follows the reference's "two linear samples + one mix" rather than a four-point convolution: the two readings
/// are identical point by point (pinned by a test on the CPU side); keep the one that matches the shader.
fn sampleRowBicubic(x : f32, row : f32) -> f32 {
    let width : f32 = u_textureSize.value.x;
    let coord : f32 = x * width - 0.5;
    let base : f32 = floor(coord);
    let w : vec4f = cubicWeights(coord - base);
    let low : f32 = w.x + w.y;
    let high : f32 = w.z + w.w;
    // Weights sum to 1 always and the two partial sums are always ≥ 1/6, so the division is safe.
    let left : f32 = (base - 0.5 + w.y / low) / width;
    let right : f32 = (base + 1.5 + w.w / high) / width;
    let mixing : f32 = low / (low + high);
    let a : f32 = textureSampleLevel(u_audio, uSampler, vec2f(right, row), 0.0).r;
    let b : f32 = textureSampleLevel(u_audio, uSampler, vec2f(left, row), 0.0).r;
    return mix(a, b, mixing);
}

/// §8.1: a single quad, all geometry generated procedurally in the fragment shader; the vertex shader only does
/// **y-flip** (matching the OpenGL convention) and texture-coordinate transform. Texture-coordinate origin is top-left.
@vertex fn vertexMain(@location(0) pos : vec2f, @location(1) uv : vec2f) -> VertexOutput {
    var output : VertexOutput;
    output.position = u_transform * vec4f(pos.x, -pos.y, 0.0, 1.0);
    let transformed : vec3f = u_texTransform * vec3f(uv, 1.0);
    output.texCoord = transformed.xy;
    return output;
}
