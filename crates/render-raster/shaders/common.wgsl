// The **binding-free shared pieces** of the CucCut element shaders (design §8.6).
//
// Only pure functions live here: constants, interval remapping, easing, cubic B-spline weights, and two SDFs.
// Anything that reads `@group(…)` (`DiscardClip`, the audio-row sampling helpers, the vertex shader) lives in
// each domain's own `_prelude.wgsl`: the `@group(1)` layouts of visualizer and progress
// differ (§8.2: 8 entries vs 9), so the shared pieces cannot assume that any binding exists.
//
// They are assembled by **build-time string concatenation** (prefix merging via `include_str!`, see
// `src/plan/shader_source.rs`), with no shader preprocessor: `#include` is the reference implementation's
// own directive, which CucCut does not copy (§8.6).
//
// Licence discipline (§8.6): this file is re-implemented by semantics and does not copy any reference shader word for word;
// not a single recipe number lives here; all of them are injected via the recipe uniform at `@group(3)`.

const PI : f32 = 3.14159265358979323846;
const TWO_PI : f32 = 6.28318530717958647692;

/// The **vertical midline** of the element box (normalised v). The `texCoord.y − 0.5` of the four curve shaders
/// all mean the same thing: the box midline, not a style choice. The Rust-side twin is
/// `kernel::MID_V`。
const MID_V : f32 = 0.5;

/// The iso-contour where the vector edge sits: `factor == 0.5` (the Rust-side twin is `kernel::COVERAGE`).
/// **Not a recipe parameter**: it is the conversion rule itself, “continuous factor field → vector edge”.
const COVERAGE : f32 = 0.5;

/// Linear remap of `[a1, a2]` → `[b1, b2]` (endpoints not clamped, same convention as the CPU side).
fn mapRange(value : f32, a1 : f32, a2 : f32, b1 : f32, b2 : f32) -> f32 {
    return b1 + (value - a1) * (b2 - b1) / (a2 - a1);
}

/// GLSL's `mod` (result has the sign of the divisor); WGSL's `%` is truncated remainder, and the two differ for negative numbers.
fn glslMod(x : f32, y : f32) -> f32 {
    return x - y * floor(x / y);
}

/// The ramp `{"edge0": a, "edge1": b}` in the recipe.
///
/// **Not using WGSL's built-in `smoothstep`**: `edge0 > edge1` (a falling ramp, which is what `gapCurve` does)
/// is spec'd as “result undefined” in WGSL / MSL / GLSL, and actual behaviour relies on each vendor's
/// goodwill. The CPU reference (`source/kernel.rs::smoothstep`) is defined for both directions and pins
/// `edge0 == edge1` to a step; conformance requires the two sides to agree point by point, so here we rewrite
/// the same definition word for word, rather than betting on the drivers.
fn ramp(edge0 : f32, edge1 : f32, x : f32) -> f32 {
    if (edge0 == edge1) {
        return select(1.0, 0.0, x < edge0);
    }
    let t : f32 = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

fn easeOutQuad(x : f32) -> f32 {
    let inv : f32 = 1.0 - x;
    return 1.0 - inv * inv;
}

fn easeOutCubic(x : f32) -> f32 {
    let inv : f32 = 1.0 - x;
    return 1.0 - inv * inv * inv;
}

fn easeOutSine(x : f32) -> f32 {
    return sin(x * PI * 0.5);
}

fn easeOutExpo(x : f32) -> f32 {
    if (x >= 1.0) {
        return 1.0;
    }
    return 1.0 - exp2(-10.0 * x);
}

fn easeInOutQuad(p : f32) -> f32 {
    if (p < 0.5) {
        return 2.0 * p * p;
    }
    return (-2.0 * p * p) + (4.0 * p) - 1.0;
}

fn easeInOutCubic(p : f32) -> f32 {
    if (p < 0.5) {
        return 4.0 * p * p * p;
    }
    let q : f32 = 2.0 * p - 2.0;
    return 0.5 * q * q * q + 1.0;
}

/// The `easing` field of the recipe (closed enum), passed down as a **numeric encoding** via the recipe uniform.
/// The single source of truth for the encoding table is Rust's `ShaderEasing` (`src/plan/shader_quad.rs`);
/// here it only dispatches, so the WGSL side has no knowledge of “which style uses which easing”.
fn applyEasing(code : f32, x : f32) -> f32 {
    if (code < 0.5) {
        return x;
    }
    if (code < 1.5) {
        return easeOutQuad(x);
    }
    if (code < 2.5) {
        return easeOutSine(x);
    }
    if (code < 3.5) {
        return easeOutCubic(x);
    }
    return easeOutExpo(x);
}

/// The **numeric encoding** of the recipe's `envelope.ease` (0 = `easeInOutQuad`, 1 = `easeInOutCubic`).
/// The single source of truth is Rust's `kernel::EnvelopeEase::code()`; here it only dispatches;
/// it is split into two functions apart from [`applyEasing`], because the value ranges of the two fields are disjoint
/// (top-level `easing` is `easeOut*`, envelope is `easeInOut*`); merging them into one table would turn
/// “which code belongs to which field” into a comment sentence.
fn applyEnvelopeEase(code : f32, p : f32) -> f32 {
    if (code < 0.5) {
        return easeInOutQuad(p);
    }
    return easeInOutCubic(p);
}

/// The CPU reference's `Envelope::apply`: `f = u·span`, `(1 − |center − f| / radius) · gain`,
/// `min(·, 1)`, then easing. **Deliberately no lower clamp**: the reference only does `min(p, 1)`, and when `p < 0`
/// `2p²` / `4p³` are still computed, so the ends of the curve family keep a tiny envelope value.
fn envelopeAt(u : f32, code : f32, span : f32, center : f32, radius : f32, gain : f32) -> f32 {
    let scaled : f32 = u * span;
    let value : f32 = (1.0 - abs(center - scaled) / radius) * gain;
    return applyEnvelopeEase(code, min(value, 1.0));
}

/// Cubic B-spline basis (sums to 1), `t ∈ [0, 1)`.
///
/// The reference computes the same weights with `n = (1,2,3,4) − t`, `s = n³` and then term-wise differences; this implementation
/// writes the basis functions directly: the two are identical point by point, and this skips one layer of indirection. The CPU side's `cubic_weights`
/// (`source/kernel.rs`) is the same set of numbers.
fn cubicWeights(t : f32) -> vec4f {
    let inv : f32 = 1.0 - t;
    let w0 : f32 = inv * inv * inv;
    let w1 : f32 = 3.0 * t * t * t - 6.0 * t * t + 4.0;
    let w2 : f32 = -3.0 * t * t * t + 3.0 * t * t + 3.0 * t + 1.0;
    let w3 : f32 = t * t * t;
    return vec4f(w0, w1, w2, w3) * (1.0 / 6.0);
}

/// SDF of a rectangle centred at the origin with half-side `b` (outside positive, inside negative).
fn sdBox(p : vec2f, b : vec2f) -> f32 {
    let d : vec2f = abs(p) - b;
    return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

/// SDF of the segment `ab`.
fn sdSegment(p : vec2f, a : vec2f, b : vec2f) -> f32 {
    let pa : vec2f = p - a;
    let ba : vec2f = b - a;
    let h : f32 = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

/// A **soft edge centred on the CPU's half-coverage iso-contour**: the `x < threshold` side is 0,
/// the `x > threshold` side is 1, the transition band is `width`, and half-coverage falls exactly on `threshold`.
///
/// ## Why not copy the reference's `smoothstep(threshold, threshold + width, x)` word for word
///
/// That one is **one-sided**: the half-coverage point lands at `threshold + width/2`, so the whole geometric edge shifts by
/// half a band width. `formation_circle`'s `smoothing = 0.01` on the 324 px square box comes to
/// 1.6 px, moved once at each end, so a radial bar comes out 3 px shorter than the CPU reference. This is not anti-aliasing; it is
/// **a geometric offset**, which the strict criterion (GPU vs CPU compared per pixel) cannot tolerate.
///
/// CucCut therefore reads this parameter as **the band width of the edge** rather than **the starting point of the edge**: the CPU reference draws the edge on
/// `threshold` per [`COVERAGE`] (it simply ignores the width, §13 P3 deviation 2), and the GPU lays a symmetric transition band across the same line.
/// The two edges **coincide**; the only difference left is the transition band
/// itself, which is exactly what the corrected §8.7 criterion leaves margin for.
fn softEdge(threshold : f32, width : f32, x : f32) -> f32 {
    let half : f32 = width * 0.5;
    return ramp(threshold - half, threshold + half, x);
}

/// The **clamped-to-one-pixel** version of [`softEdge`].
///
/// The reference's family of “soft-edge width” parameters falls into two classes:
///
/// * Widths already on the order of **one or two pixels** (`ring-v1`'s `featherPx = 4/res`,
///   `frame-v1`'s `smoothing = 0.0032`): that is anti-aliasing, used as is;
/// * Widths **well over one pixel** (`snake-v1`'s `smoothing = 0.032`,
///   `bars-polar-v1`'s `0.01`, which is 10 px / 3 px on a 324 px square box): that is **shaping**
///   rather than anti-aliasing. The CPU reference draws the edge on the iso-contour per [`COVERAGE`] and simply ignores the width
///   (§13 P3 deviation 2 / P4 deviation 5), and the strict criterion requires the GPU to be pixel-comparable with it,
///   so here the width is clamped to one pixel: the edge position is unchanged, and the transition band shrinks to the rasteriser's level.
///
/// This is **the same family rule** as “`lineWidth` read as a solid band” on the `beam` / `harmony` side
/// (see `bandCoverage`): soft-edge parameters always obey the geometry the CPU has already frozen.
fn softEdgePixel(threshold : f32, width : f32, pixel : f32, x : f32) -> f32 {
    return softEdge(threshold, min(width, pixel), x);
}

/// The coverage of a **band of definite width** along the `value` axis, with a transition of width `w` at each end.
///
/// P4 settled the reference's soft-edge case `lineWidth = −0.04` as “a solid band of width `|lineWidth|/2`”
/// (§13 P4 deviation 3): that is **CucCut's own semantics**, not anti-aliasing:
/// 0.04 normalised height is 9 px on a 1080p horizontal-bar element; copying the gradient would let a single style
/// use up the strict transition-band budget. So the WGSL of the curve family implements the CPU's two-part reading, with `w` carrying only
/// **anti-aliasing within one pixel** (callers pass `1/u_dstRes.y`).
fn bandCoverage(value : f32, low : f32, high : f32, w : f32) -> f32 {
    return ramp(low - w, low + w, value) * ramp(high + w, high - w, value);
}

/// Straight colour → premultiplied: `(rgb · a, a)`.
///
/// Several places in the reference write `colour * colour.a`, which multiplies **alpha in a second time**, giving
/// `a²`. With `a == 1` (the default) the two readings are word-for-word identical; on semi-transparent elements the reference would draw half as bright.
/// §13 P4 deviation 6 already settled this for `harmony`; this function is its general form.
fn premultiplied(colour : vec4f) -> vec4f {
    return vec4f(colour.rgb * colour.a, colour.a);
}

/// Premultiplied-alpha source-over: `src` drawn over `dst`.
///
/// Used for **the two halves of the same line itself** (fill and edging, which do not overlap) and for single-layer styles such as `beam`.
/// Between lines this does not apply: the reference uses additive `colour +=`, and `envelope-lines-v1` does the same on both sides
/// (the vector side is one layer per line + `Plus`); see [`storablePremultiplied`].
fn alphaOver(src : vec4f, dst : vec4f) -> vec4f {
    return src + dst * (1.0 - src.a);
}

/// Premultiplied contribution colour → **storable** premultiplied colour: when `rgb > a`, raise alpha to `max(rgb)`.
///
/// The reference's fragment is floating point, so after several lines `colour += ...` into the same pixel it can leave
/// **over-bright** premultiplied colours with `rgb > a` (`simi`'s three fixed colours are exactly that: `(1, 0.2, 0.2)` with
/// `a = 1/3`). CucCut's CPU reference sits on a tiny-skia **premultiplied u8** Pixmap, which cannot store such colours;
/// both sides must draw the same picture, so **both sides** raise alpha together: rgb is preserved bit for bit, at the cost that that
/// part no longer lets the background show through. The vector-side counterpart is
/// `source/visualizer/recipes/envelope_lines_v1.rs::storable_color`。
fn storablePremultiplied(contribution : vec4f) -> vec4f {
    let opaque : f32 = max(
        contribution.a,
        max(contribution.r, max(contribution.g, contribution.b))
    );
    return vec4f(contribution.rgb, opaque);
}

/// screen blend (the echo layer of `echo_lines`).
fn screenBlend(a : vec4f, b : vec4f) -> vec4f {
    return vec4f(1.0) - (vec4f(1.0) - a) * (vec4f(1.0) - b);
}

/// Four-corner bilinear gradient (shared by progress's rainbow / strobe).
fn fourCornerGradient(uv : vec2f, a : vec4f, b : vec4f, c : vec4f, d : vec4f) -> vec4f {
    let top : vec4f = mix(a, b, uv.x);
    let bot : vec4f = mix(c, d, uv.x);
    return mix(top, bot, uv.y);
}

/// HSV → RGB (the classic Iñigo Quílez form), alpha passed through.
fn hsvToRgb(hsv : vec4f) -> vec4f {
    let k : vec4f = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p : vec3f = abs(fract(hsv.xxx + k.xyz) * 6.0 - k.www);
    return vec4f(hsv.z * mix(k.xxx, clamp(p - k.xxx, vec3f(0.0), vec3f(1.0)), hsv.y), hsv[3]);
}

/// RGB → HSV, alpha passed through.
fn rgbToHsv(colour : vec4f) -> vec4f {
    let k : vec4f = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    let p : vec4f = mix(vec4f(colour.bg, k.wz), vec4f(colour.gb, k.xy), step(colour.b, colour.g));
    let q : vec4f = mix(vec4f(p.xyw, colour.r), vec4f(colour.r, p.yzx), step(p.x, colour.r));
    let d : f32 = q.x - min(q.w, q.y);
    let e : f32 = 1.0e-10;
    return vec4f(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x, colour[3]);
}

/// HSB → RGB (for the rainbow ring whose saturation comes from the radius; a different form from [`hsvToRgb`],
/// the reference uses one of each in two places, kept word for word so that nothing “looks the same but is a bit off”).
fn hsbToRgb(c : vec3f) -> vec3f {
    var rgb : vec3f = clamp(
        abs(glslMod3(c.x * 6.0 + vec3f(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
        vec3f(0.0),
        vec3f(1.0)
    );
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3f(1.0), rgb, c.y);
}

fn glslMod3(x : vec3f, y : f32) -> vec3f {
    return x - y * floor(x / y);
}

fn rotate2d(angle : f32) -> mat2x2f {
    return mat2x2f(cos(angle), -sin(angle), sin(angle), cos(angle));
}
