// `ring-v1` WGSL implementation (element scheme §7.4): `circle` / `donut`.
//
// The CPU reference is `src/source/progress/recipes/ring_v1.rs`: background ring (full circle / full ring, secondary colour)
// + progress sector (pie / ring sector, primary colour). `innerRadius` is a ratio **relative to the outer radius**.
//
// ## Angle: clockwise from straight up, computed in **v-up** coordinates
//
// The reference implementation writes `atan2(−centred.x, −centred.y) + π`, matching its own y-down
// `texCoord`. CucCut's source of truth is the CPU reference (`kernel::polar`: zero angle straight up, clockwise
// positive), so here we first do the v flip from P5a deviation 4, then use `atan2(x, y)` directly to get the
// "clockwise from straight up" angle. The two forms are the same thing in their own coordinate systems, but only this one
// matches the CPU pixel by pixel.
//
// `featherPx` / `edgeFeatherPx` are the shader's anti-aliasing **band width**; the CPU side does not read them (vector edges
// are anti-aliased by the rasteriser). The GPU side uses `softEdge` to lay the transition band symmetrically across the CPU edge,
// rather than copying the reference's one-sided `smoothstep`. The reasoning is in the `softEdge` doc in `common.wgsl`
// (the one-sided reading would shrink the whole circle by half a band width).

/// Recipe parameters. Field order = the packing order of Rust's `pack_ring_v1`.
struct RingRecipe {
    /// Feather radius of the outer/inner circle edges, **pixels**.
    featherPx : f32,
    /// Feather radius of the colour boundary, **pixels**.
    edgeFeatherPx : f32,
    /// Inner radius (relative to outer radius); 0 = solid pie.
    innerRadius : f32,
    /// `direction`：0 = `cw`，1 = `ccw`。
    ccw : f32,
}

@group(3) @binding(0) var<uniform> u_recipe : RingRecipe;

@fragment fn fragmentMain(in : VertexOutput) -> @location(0) vec4f {
    DiscardProgressClip(in.texCoord);

    // The feather radius is tied to resolution; on a single dimension take the average of both sides (the reference's convention).
    let res : f32 = (u_dstRes.value.x + u_dstRes.value.y) * 0.5;
    let feather : f32 = u_recipe.featherPx / res;

    let uv : vec2f = vec2f(in.texCoord.x, 1.0 - in.texCoord.y);
    let centred : vec2f = uv * 2.0 - 1.0;
    let len : f32 = length(centred);

    // Clockwise index of one revolution from straight up. `atan2(x, y)` ∈ (−π, π]; the negative half-turn gets a full turn added.
    var percent : f32 = atan2(centred.x, centred.y) / TWO_PI;
    if (u_recipe.ccw > 0.5) {
        percent = -percent;
    }
    if (percent < 0.0) {
        percent = percent + 1.0;
    }

    let featherFactor : f32 = u_recipe.edgeFeatherPx / res / max(len, 0.01);
    let mixFactor : f32 = 1.0 - softEdge(u_progress.value.x, featherFactor, percent);
    var colour : vec4f = mix(u_secondaryColor, u_mainColor, mixFactor) * u_colourMultiplier;

    var mask : f32 = 1.0 - softEdge(1.0, feather, len);
    if (u_recipe.innerRadius > 0.0) {
        mask = mask * softEdge(u_recipe.innerRadius, feather, len);
    }

    // §8.5：premultiplied alpha。
    let alpha : f32 = colour.a * mask;
    return vec4f(colour.rgb * alpha, alpha);
}
