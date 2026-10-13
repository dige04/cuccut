// Binding surface and vertex shader for the progress domain (design §8.1 / §8.2).
//
// Kept as **a second copy** of visualizer's `_prelude.wgsl` rather than shared: the `@group(1)` layout differs
// (progress has 9 entries, more `u_progress` / `u_srcRes`, and no `u_textureSize`), and
// progress has **no `@group(2)`**: its content is derived from the playhead, not from a material source.

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texCoord : vec2f,
}

// ── §8.1 `@group(0)`: vertex transform.
@group(0) @binding(0) var<uniform> u_transform : mat4x4f;
@group(0) @binding(1) var<uniform> u_texTransform : mat3x3f;

// ── §8.2 `@group(1)`: the 9 progress entries, **order frozen**.
// WebGL2 has no `BUFFER_BINDINGS_NOT_16_BYTE_ALIGNED`, so the scalar / vec2 binding types are explicitly padded to 16 B;
// the binding count, names and order still match the frozen table one for one.
struct ScalarUniform { value : vec4f }
struct Vec2Uniform { value : vec2f, _padding : vec2f }
@group(1) @binding(0) var<uniform> u_progress : ScalarUniform;
@group(1) @binding(1) var<uniform> u_time : ScalarUniform;
@group(1) @binding(2) var<uniform> u_mainColor : vec4f;
@group(1) @binding(3) var<uniform> u_secondaryColor : vec4f;
@group(1) @binding(4) var<uniform> u_canvasRes : Vec2Uniform;
@group(1) @binding(5) var<uniform> u_srcRes : Vec2Uniform;
@group(1) @binding(6) var<uniform> u_dstRes : Vec2Uniform;
@group(1) @binding(7) var<uniform> u_colourMultiplier : vec4f;
@group(1) @binding(8) var<uniform> u_clip : vec4f;

// ── `@group(3)`: recipe parameters (see the same-named section on the visualizer side for the reasoning).

/// The four-edge clipping of §8.5, under the progress side's name.
fn DiscardProgressClip(texCoord : vec2f) {
    var clipped : bool = false;
    if (texCoord.x <= u_clip[0]) { clipped = true; }
    if (texCoord.y <= u_clip[1]) { clipped = true; }
    if (texCoord.x >= 1.0 - u_clip[2]) { clipped = true; }
    if (texCoord.y >= 1.0 - u_clip[3]) { clipped = true; }
    if (clipped) { discard; }
}

/// §8.1: single quad + y-flip, identical word for word to the visualizer side.
@vertex fn vertexMain(@location(0) pos : vec2f, @location(1) uv : vec2f) -> VertexOutput {
    var output : VertexOutput;
    output.position = u_transform * vec4f(pos.x, -pos.y, 0.0, 1.0);
    let transformed : vec3f = u_texTransform * vec3f(uv, 1.0);
    output.texCoord = transformed.xy;
    return output;
}
