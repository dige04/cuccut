// WGSL implementation of `frame-v1` (element scheme §7.4).
//
// One source covers 6 variants: `border` / `reverse_border` (solid, strict),
// `rainbow_border` / `reverse_rainbow_border` (hue cycle, visual),
// `strobe_border` / `reverse_strobe_border` (strobe, visual). The differences all lie in the recipe's
// `fill` / `background` / `colorMode` three fields.
// The CPU reference is `src/source/progress/recipes/frame_v1.rs`.
//
// ## Coordinates: **v up**
//
// The reference implementation's four box comments read 'BL to BR' / 'BL to TL', which assume the `uv` origin is at
// **bottom-left**. The `texCoord` origin frozen by §8.1 is top-left, so here we first do the flip from P5a deviation 4,
// then lay out the four edges as the reference does. The CPU reference's `Edge::{Bottom,Top,Left,Right}` correspond one to one with
// the four boxes after the flip.
//
// ## Border thickness
//
// `barSize = borderSize · sourceAspect.yx` goes around this circle to make the horizontal and vertical edges
// **equally thick** in pixels (both equal `borderSize · max(w, h)`). The CPU side uses this conclusion directly,
// and here we copy that conversion word for word; it also determines the anisotropic smoothing band width of the SDF.

/// Recipe parameters. Field order = the packing order of Rust's `pack_frame_v1`.
struct FrameRecipe {
    borderSize : f32,
    /// SDF soft-edge band width (normalised). The CPU side does not read it (vector edges are anti-aliased by the rasteriser); the GPU side uses it.
    smoothing : f32,
    /// `fill`：0 = `forward`，1 = `reverse`。
    reverse : f32,
    /// `background`: whether the base frame is drawn.
    background : f32,
    /// `colorMode.kind`：0 = solid、1 = rainbow、2 = strobe。
    colorKind : f32,
    /// Hue-cycle speed for rainbow.
    hueSpeed : f32,
    /// Mix amount `mixBias + (sin(t)·0.5 + 0.5) · mixGain`.
    mixBias : f32,
    mixGain : f32,
    /// Strobe speed for strobe.
    strobeSpeed : f32,
    _pad0 : f32,
    _pad1 : f32,
    _pad2 : f32,
    /// The four corner base colours for rainbow.
    corners : array<vec4f, 4>,
}

@group(3) @binding(0) var<uniform> u_recipe : FrameRecipe;

/// SDF soft edge of a rectangle centred at the origin with half-side `b` (1 = inside).
///
/// The transition band rides **symmetrically** on the edge where `sdBox == 0` (`softEdge`), not the reference's
/// one-sided `smoothstep(0, smoothing, d)`: the one-sided reading would widen each edge by half a band width
/// (1.5 px on a 480 px-wide frame), whereas the CPU reference draws an exact rectangle.
fn frameBar(pos : vec2f, size : vec2f) -> f32 {
    return 1.0 - softEdge(0.0, u_recipe.smoothing, sdBox(pos, size));
}

/// Base frame: the union of the four full edges (`clamp(b1+b2+b3+b4, 0, 1)` is the union).
fn backgroundFrame(uv : vec2f, size : vec2f) -> f32 {
    let b1 : f32 = frameBar(uv, vec2f(1.0, size.y));
    let b2 : f32 = frameBar(uv, vec2f(size.x, 1.0));
    let b3 : f32 = frameBar(uv - vec2f(0.0, 1.0), vec2f(1.0, size.y));
    let b4 : f32 = frameBar(uv - vec2f(1.0, 0.0), vec2f(size.x, 1.0));
    return clamp(b1 + b2 + b3 + b4, 0.0, 1.0);
}

/// `fill: "forward"`: the perimeter is split into two segments by `w : h`; the two arms **start from the bottom-left corner together**,
/// and meet at the top-right corner when `progress == 1`.
fn forwardFrame(uv : vec2f, size : vec2f) -> f32 {
    let span : f32 = u_srcRes.value.x + u_srcRes.value.y;
    let across : f32 = u_srcRes.value.x / span;
    let up : f32 = u_srcRes.value.y / span;
    let progress : f32 = u_progress.value.x;

    var b1 : f32 = 0.0;
    var b2 : f32 = 0.0;
    var b3 : f32 = 0.0;
    var b4 : f32 = 0.0;
    if (progress > 0.0) {
        b1 = frameBar(uv, vec2f(clamp(progress / across, 0.0, 1.0), size.y));
        b2 = frameBar(uv, vec2f(size.x, clamp(progress / up, 0.0, 1.0)));
    }
    if (progress >= up) {
        b3 = frameBar(uv - vec2f(0.0, 1.0), vec2f(clamp((progress - up) / (1.0 - up), 0.0, 1.0), size.y));
    }
    if (progress >= across) {
        b4 = frameBar(uv - vec2f(1.0, 0.0), vec2f(size.x, clamp((progress - across) / (1.0 - across), 0.0, 1.0)));
    }
    return clamp(b1 + b2 + b3 + b4, 0.0, 1.0);
}

/// `fill: "reverse"`: uses `1 − progress` as the length, and from the bottom-left and top-right corners each extends out an
/// L shape. This branch has **no** perimeter normalisation; it is copied as-is. At full progress the whole ring disappears.
fn reverseFrame(uv : vec2f, size : vec2f) -> f32 {
    let reach : f32 = 1.0 - u_progress.value.x;
    if (!(reach > 0.0)) {
        return 0.0;
    }
    let flipped : vec2f = vec2f(1.0) - uv;
    var bars : f32 = frameBar(uv, vec2f(reach, size.y));
    bars = bars + frameBar(uv, vec2f(size.x, reach));
    bars = bars + frameBar(flipped, vec2f(reach, size.y));
    bars = bars + frameBar(flipped, vec2f(size.x, reach));
    return clamp(bars, 0.0, 1.0);
}

/// `sin(u_time) · 0.5 + 0.5`, then linearly mapped to `[mixBias, mixBias + mixGain]`.
fn frameMixAmount() -> f32 {
    return u_recipe.mixBias + (sin(u_time.value.x) * 0.5 + 0.5) * u_recipe.mixGain;
}

/// A role whose hue cycles along `sin(u_time) · hueSpeed`.
fn hueCycled(colour : vec4f) -> vec4f {
    var hsv : vec4f = rgbToHsv(colour);
    hsv.r = hsv.r + sin(u_time.value.x) * u_recipe.hueSpeed;
    return hsvToRgb(hsv);
}

/// Colour of the progress frame. `dist` is the coverage; the return value is already in premultiplied form.
fn frameProgressColour(uv : vec2f, dist : f32) -> vec4f {
    if (u_recipe.colorKind < 0.5) {
        // solid: primary colour × coverage.
        return vec4f(dist * u_mainColor.rgb, dist) * u_mainColor.a;
    }
    var gradient : vec4f;
    if (u_recipe.colorKind < 1.5) {
        // rainbow: each of the four corner base colours goes through one hue cycle, then bilinear by uv.
        gradient = fourCornerGradient(
            uv,
            hueCycled(u_recipe.corners[0]),
            hueCycled(u_recipe.corners[1]),
            hueCycled(u_recipe.corners[2]),
            hueCycled(u_recipe.corners[3])
        );
    } else {
        // strobe: two element colours alternate; **the sample point is constant** `(s, −s)`, so the whole frame is one colour.
        let s : f32 = sin(u_time.value.x * u_recipe.strobeSpeed) * 0.5 + 0.5;
        gradient = fourCornerGradient(
            vec2f(s, -s),
            u_mainColor,
            u_secondaryColor,
            u_mainColor,
            u_secondaryColor
        );
    }
    let amount : f32 = frameMixAmount();
    let rgb : vec3f = mix(vec3f(dist), gradient.rgb, amount * dist);
    return vec4f(rgb, dist) * u_mainColor.a;
}

@fragment fn fragmentMain(in : VertexOutput) -> @location(0) vec4f {
    DiscardProgressClip(in.texCoord);

    // See the file header: the reference implementation's four boxes are laid out in v-up coordinates.
    let uv : vec2f = vec2f(in.texCoord.x, 1.0 - in.texCoord.y);
    let aspect : vec2f = u_srcRes.value / min(u_srcRes.value.x, u_srcRes.value.y);
    let size : vec2f = vec2f(u_recipe.borderSize) * aspect.yx;

    var progressDistance : f32;
    if (u_recipe.reverse > 0.5) {
        progressDistance = reverseFrame(uv, size);
    } else {
        progressDistance = forwardFrame(uv, size);
    }
    let progressColour : vec4f = frameProgressColour(uv, progressDistance);

    var backgroundColour : vec4f = vec4f(0.0);
    if (u_recipe.background > 0.5) {
        let distance : f32 = backgroundFrame(uv, size);
        backgroundColour = vec4f(distance * u_secondaryColor.rgb, distance) * u_secondaryColor.a;
    }

    // `mask(bg, prog)` = `mix(bg, prog, prog.a)`, which is exactly the premultiplied
    // source-over: on the CPU side it is “draw the base frame first, then the progress frame”.
    return alphaOver(progressColour, backgroundColour) * u_colourMultiplier;
}
