// WGSL implementation of `bar-v1` (element scheme §7.4).
//
// The CPU reference is `src/source/progress/recipes/bar_v1.rs`: the background fills the whole box,
// the part where `x < progress` takes the primary colour; the capsule style (`rounded`) adds a rounded-rectangle clip on top.
// The colour boundary is a **vertical hard edge**; rounding belongs only to the outer contour. Adding rounding to the progress block as well would grow a
// right round head that should not exist.
//
// Same discipline as the visualizer side: **this file contains no recipe numbers**; `direction` and
// `radiusPx` are injected via `@group(3)`, so the same source covers both `normal` and `rounded`
// (P5b only has to point `rounded.json`'s `shader` at it).

/// Recipe parameters. Field order = the packing order of Rust's `BarRecipeUniform`.
struct BarRecipe {
    /// 0 = `ltr`, 1 = `rtl` (a closed enum in the registry, dispatched by data rather than by id).
    direction : f32,
    /// Capsule corner radius, **pixels**. The host has already converted it by `pixel_scale`
    /// (`canvas_short_edge / REFERENCE_SHORT_EDGE`); see the module docs in progress/draw.rs
    /// for the module docs; 0 = square corners.
    radiusPx : f32,
    _pad0 : f32,
    _pad1 : f32,
}

@group(3) @binding(0) var<uniform> u_recipe : BarRecipe;

@fragment fn fragmentMain(in : VertexOutput) -> @location(0) vec4f {
    DiscardProgressClip(in.texCoord);

    // Rounded clip: clamped to within “half the short edge”, the same clamp word for word as the CPU side, so a
    // 5%-high progress bar is exactly a capsule, rather than being distorted by the raw 200 px radius.
    let radius : f32 = min(u_recipe.radiusPx, min(u_dstRes.value.x, u_dstRes.value.y) * 0.5);
    if (radius > 0.0) {
        let pixel : vec2f = in.texCoord * u_dstRes.value;
        let half : vec2f = u_dstRes.value * 0.5;
        // Rounded rectangle = rectangle SDF shrunk by r, then expanded by r.
        let dist : f32 = sdBox(pixel - half, half - vec2f(radius)) - radius;
        if (dist > 0.0) { discard; }
    }

    // No recipe uses `rtl` at the moment, but its value range is a closed enum in the registry, so the implementation is filled in.
    var filled : bool;
    if (u_recipe.direction > 0.5) {
        filled = in.texCoord.x >= 1.0 - u_progress.value.x;
    } else {
        filled = in.texCoord.x < u_progress.value.x;
    }

    var colour : vec4f = u_secondaryColor;
    if (filled) {
        colour = u_mainColor;
    }
    colour = colour * u_colourMultiplier;

    // §8.5：premultiplied alpha。
    let alpha : f32 = colour.a;
    return vec4f(colour.rgb * alpha, alpha);
}
