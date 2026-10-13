// WGSL implementation of `snake-v1` (element scheme §7.4).
//
// One source covers 4 variants: `snake` / `snake_spin` (solid, strict),
// `snake_rainbow` / `snake_spin_rainbow` (hue ring, visual).
// The CPU reference is `src/source/progress/recipes/snake_v1.rs`.
//
// ## Here it is **a per-degree loop**; the CPU side uses the closed form of the sweep union
//
// P4 turned the reference's `circleRing()` into a closed form (§13 P4 deviation 4). The vector side emitting 360
// sub-paths is both slow and unnecessary: the centre spacing is only a fourteenth of the circle radius, so the superposed field
// is already saturated deep inside the union. The GPU side has no such reason: the fragment evaluates point by point anyway, and per-degree accumulation is the reference's
// approach, and also the **only form that can use `smoothing` and `boostSteps` word for word** (the two parameters P3/P4 recorded
// as left for P5). The half-coverage iso-contours of the two readings differ by about one pixel; the accumulated field
// saturates quickly near the union boundary, as checked in P5b's measurements.
//
// ## Coordinates: **v up**
//
// The reference places the circle centre in the y-down `texCoord`, so the start angle of 270° falls at the **bottom** of the picture;
// the CPU reference's `phi = −(π/2 + a)` with `polar`'s 'clockwise from straight up' starts at the **top**.
// The CPU is the source of truth, so here we first do the v flip from P5a deviation 4.

/// Recipe parameters. Field order = the packing order of Rust's `pack_snake_v1`.
struct SnakeRecipe {
    /// Small-circle radius (normalised to the side length of the inscribed square).
    dotRadius : f32,
    /// Soft-edge band width of the small circles. The CPU side does not read it; the GPU side uses it word for word.
    smoothing : f32,
    /// Orbit radius of the small circles' centres.
    orbitRadius : f32,
    startAngleDeg : f32,
    angleIncrementDeg : f32,
    /// Loop upper bound (the reference's 360).
    maxIterations : f32,
    /// `boostSteps`: when the number of circles is below `below`, multiply alpha by `gain`.
    boostBelow0 : f32,
    boostGain0 : f32,
    boostBelow1 : f32,
    boostGain1 : f32,
    /// `spin.speedDegPerSec`；`spin: null` ⇒ 0。
    spinSpeed : f32,
    /// `colorMode.kind`：0 = solid、1 = rainbow。
    colorKind : f32,
    /// `colorMode.trackColor == "main"` ⇒ 1。
    trackIsMain : f32,
    /// Rotation speed of the rainbow ring (°/s).
    rainbowSpeed : f32,
    _pad0 : f32,
    _pad1 : f32,
}

@group(3) @binding(0) var<uniform> u_recipe : SnakeRecipe;

/// Soft-edge coverage of one small circle. Its centre is at `−(cos a, sin a) · orbit` (the reference's form:
/// it computes `length(pos + offset · dist)`).
///
/// `smoothing = 0.032` is 10 px on the 324 px square box: that is **shaping**, not anti-aliasing:
/// under dense superposition `min(Σ, 1)` pushes the union's boundary outward by two or three pixels as a whole, whereas the CPU reference's
/// swept-union boundary is exactly `dotRadius` itself (§13 P4 deviation 5). So `softEdgePixel` clamps
/// the band width to one pixel, so the edge lies on the same line.
fn snakeDot(pos : vec2f, angle : f32) -> f32 {
    let offset : vec2f = vec2f(cos(angle), sin(angle));
    let distance : f32 = length(pos + offset * u_recipe.orbitRadius);
    let pixel : f32 = 1.0 / max(min(u_dstRes.value.x, u_dstRes.value.y), 1.0);
    return 1.0 - softEdgePixel(u_recipe.dotRadius, u_recipe.smoothing, pixel, distance);
}

/// The reference's `circleRing()`: starting from `startAngleDeg + offset`, one small circle is placed every `angleIncrementDeg`,
/// with alpha accumulated and then `min(·, 1)`.
///
/// Number of circles `angleTotal = round(steps per full circle × progress)`; the loop body **finishes drawing this circle before it
/// breaks**, so the actual count is `angleTotal + 1`, capped at `maxIterations` — the CPU side's
/// `dot_count` is the same. Progress 0 also keeps one dot.
fn snakeRing(pos : vec2f, progress : f32, offsetDegrees : f32) -> f32 {
    let increment : f32 = u_recipe.angleIncrementDeg;
    let stepsPerTurn : f32 = 360.0 / abs(increment);
    let total : f32 = floor(clamp(progress, 0.0, 1.0) * stepsPerTurn + 0.5);
    let limit : f32 = max(u_recipe.maxIterations, 1.0);

    var accumulated : f32 = 0.0;
    var a : f32 = 0.0;
    for (var index : f32 = 0.0; index < limit; index = index + 1.0) {
        accumulated = accumulated + snakeDot(pos, radians(u_recipe.startAngleDeg + a + offsetDegrees));
        a = a + increment;
        if (index >= total) {
            break;
        }
    }
    // Make it more prominent when there are few circles (`boostSteps`).
    if (total < u_recipe.boostBelow0) {
        accumulated = accumulated * u_recipe.boostGain0;
    } else if (total < u_recipe.boostBelow1) {
        accumulated = accumulated * u_recipe.boostGain1;
    }
    return min(accumulated, 1.0);
}

/// A rotating rainbow whose hue comes from the angle and saturation from the radius (the two `snake_rainbow` variants).
fn snakeRainbow(uv : vec2f) -> vec3f {
    var transformed : vec2f = uv - 0.5;
    transformed = transformed * rotate2d(radians(u_time.value.x * u_recipe.rainbowSpeed));
    let angle : f32 = atan2(transformed.y, transformed.x);
    let radius : f32 = length(transformed) * 2.0;
    return hsbToRgb(vec3f(angle / TWO_PI + 0.5, radius, 1.0));
}

@fragment fn fragmentMain(in : VertexOutput) -> @location(0) vec4f {
    DiscardProgressClip(in.texCoord);

    let uv : vec2f = vec2f(in.texCoord.x, 1.0 - in.texCoord.y);
    let pos : vec2f = uv - 0.5;

    // Self-rotation: `offset = −mod(t · speed, 360°)`; the base ring and the progress ring share the same offset.
    var spin : f32 = 0.0;
    if (u_recipe.spinSpeed != 0.0) {
        spin = -glslMod(u_time.value.x * u_recipe.spinSpeed, 360.0);
    }

    // The base ring (progress 1) is at the bottom, the progress ring on top — the reference's `mix(bot, top, top.a)`.
    var trackColour : vec4f = u_secondaryColor;
    if (u_recipe.trackIsMain > 0.5) {
        trackColour = u_mainColor;
    }
    let trackDistance : f32 = snakeRing(pos, 1.0, spin);
    let bottom : vec4f = vec4f(trackDistance * trackColour.rgb, trackDistance) * trackColour.a;

    let topDistance : f32 = snakeRing(pos, u_progress.value.x, spin);
    var top : vec4f;
    if (u_recipe.colorKind > 0.5) {
        // The rainbow ring **does not multiply by the primary colour's alpha** (as in the reference: the primary colour only governs the base ring).
        top = vec4f(topDistance * snakeRainbow(uv), topDistance);
    } else {
        top = vec4f(topDistance * u_mainColor.rgb, topDistance) * u_mainColor.a;
    }

    return alphaOver(top, bottom) * u_colourMultiplier;
}
