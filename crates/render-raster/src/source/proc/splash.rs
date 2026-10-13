//! `proc:"splash"`: at time `at`, a cluster of water droplets is thrown up at `(x, y)`, plus an expanding ring of water crown.
//! One-shot: no op is emitted before `at` or after `at + life`. For multiple splashes, use multiple instances.
use super::{circle, color, fill, stroke, unit};
use crate::drawop::FrameBuilder;
use scene_primitives::proc::Splash;
use tiny_skia::Transform;

pub(super) fn record(
    splash: &Splash,
    seed: u64,
    w: f64,
    h: f64,
    time: f64,
    tf: Transform,
    b: &mut FrameBuilder,
) {
    let age = time - splash.at;
    if !(0.0..splash.life).contains(&age) {
        return;
    }
    let k = age / splash.life;
    let (ox, oy) = (splash.x * w, splash.y * h);
    let g = splash.gravity * h;

    let mut drops = Vec::new();
    for i in 0..splash.count as u64 {
        // Direction: a fan of ±0.8 rad around straight up.
        let a = (unit(seed, i, 1) - 0.5) * 1.6;
        let v = splash.speed * h * (0.4 + 0.6 * unit(seed, i, 2));
        let (vx, vy) = (v * libm::sin(a), -v * libm::cos(a));
        // Droplets vanish when they fall back to the launch line: they do not pass through the water surface.
        if g > 0.0 && age > -2.0 * vy / g {
            continue;
        }
        let x = ox + vx * age;
        let y = oy + vy * age + 0.5 * g * age * age;
        let r = splash.size * (0.5 + 0.5 * unit(seed, i, 3)) * (1.0 - 0.5 * k);
        circle(&mut drops, x, y, r, r);
    }
    fill(drops, color(&splash.color, 1.0 - k), tf, b);

    // Water crown: a flattened ellipse, expanding and fading out over the first 60% of its life.
    let crown = (age / (splash.life * 0.6)).min(1.0);
    if crown < 1.0 {
        let ease = 1.0 - (1.0 - crown) * (1.0 - crown);
        let rx = splash.size * 2.0 + splash.speed * h * 0.35 * ease;
        let mut ring = Vec::new();
        circle(&mut ring, ox, oy, rx, rx * 0.22);
        stroke(
            ring,
            color(&splash.color, 0.8 * (1.0 - crown)),
            (splash.size * 0.6).max(0.5),
            tf,
            b,
        );
    }
}
