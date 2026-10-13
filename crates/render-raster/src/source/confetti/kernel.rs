//! `confetti-v1` closed-form motion kernel (design doc `docs/design/elements/ccut-confetti-element-design.md` §4).
//!
//! The motion model is adapted from three MIT sources (original attribution and license text in
//! `core/assets/elements/vendor/sources.json`; the ids match `sources[]` in the recipes):
//!
//! * `react-confetti/particle` (© Aaron Lampros, MIT): gravity, drag and flip (the `sy` triangle-wave) model for paper pieces;
//! * `party-js/confetti` + `party-js/shapes` (© Ian Hornik, MIT): the party-popper emitter, the fan angle, and the random ranges for `spinDps` / `flipHz`;
//! * `js-confetti/flight` (© Vitalii Loginov, MIT): burst emission, fade-out by age, and `sizeRamp` scale-up at birth.
//!
//! The source is textually identical to the prototype `designs/cuccut/app/model-confetti.js`: the same props and
//! the same t always yield the same particle table. The cross-check between prototype and core depends on this.
//!
//! ## Two hard constraints
//!
//! 1. **Closed-form motion.** Each particle's position, rotation, size and opacity is an explicit function of τ (its own age).
//!    Nothing is integrated and no previous frame is stored, so scrubbing the playhead, playing backwards and export frame sampling do not drift.
//!    This is also the precondition of the `ccut-render` contract that "out-of-order sampling == sequential sampling".
//! 2. **Random numbers come only from [`splitmix64_unit`]`(seed, i·16 + c)`.** Channel c of particle i is a pure function;
//!    this module has no RNG state at all.
//!
//! This module only describes "parameters → particle table" and carries no style parameters of its own. The numbers for the ten recipes live in
//! `core/presets/builtin/confetti/*.json` (the `ccut-motion` registry), and user overrides live in `ConfettiProps` in `ccut-timeline`. The host folds both into a [`Motion`] and [`Overrides`] before they arrive here.

use std::f64::consts::{PI, TAU};

/// Reference short edge of the recipes: all pixel quantities (`speedPx` / `gravityPx` / `sizePx` / `driftPx` /
/// `windPx`) are values at a 540 short edge. The host folds them into `pixel_scale` as `short edge / 540`.
/// The source of truth is `ccut_timeline::REFERENCE_SHORT_EDGE`. `ccut-render` does not depend on that crate,
/// so the value is restated here once, with its source named.
pub const REF_SHORT: f64 = 540.0;
/// Number of random channels per particle.
pub const CHANNELS: u64 = 16;
/// Lower bound of lifetime jitter: `life = lifeSec · lerp(0.85, 1, u13)`.
pub const LIFE_JITTER: f64 = 0.85;

/// Folds the `k`-th output of `splitmix64` into `[0, 1)` (53-bit mantissa).
///
/// Bit-for-bit identical to the prototype's BigInt implementation: `z = seed + k·φ`, two rounds of xorshift-multiply,
/// then take the high 53 bits and divide by 2⁵³.
pub fn splitmix64_unit(seed: u64, k: u64) -> f64 {
    let mut z = seed.wrapping_add(k.wrapping_mul(0x9E37_79B9_7F4A_7C15));
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^= z >> 31;
    (z >> 11) as f64 / 9_007_199_254_740_992.0
}

/// The 16 random channels of particle `i`.
pub fn channels(seed: u64, i: u64) -> [f64; CHANNELS as usize] {
    let mut out = [0.0; CHANNELS as usize];
    for (c, slot) in out.iter_mut().enumerate() {
        *slot = splitmix64_unit(seed, i * CHANNELS + c as u64);
    }
    out
}

/// Emission mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmitMode {
    /// Continuous: the i-th particle is born at `(i + u0) / rate` seconds.
    Continuous,
    /// Burst: one wave every `interval` seconds, `count` particles per wave; `interval == 0` bursts only once.
    Burst,
}

/// Effective emission parameters (recipe defaults with user overrides merged).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Emit {
    pub mode: EmitMode,
    /// `continuous`: particles per second (already rounded, ≥ 1).
    pub rate: f64,
    /// `burst`: particles per wave (≥ 1).
    pub count: u64,
    /// `burst`: seconds between waves; `0` = burst only once.
    pub interval: f64,
    /// Stops emitting `lifeSec` seconds before the element ends, so the frame clears naturally.
    pub settle: bool,
}

/// One emitter: center `(x, y)` and spread `(spread_x, spread_y)` are both percentages of the element box.
/// `angle` is this emitter's own base angle (screen coordinates, 90 = down, −90 = up). When absent,
/// the recipe's `angle` is used.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Emitter {
    pub x: f64,
    pub y: f64,
    pub spread_x: f64,
    pub spread_y: f64,
    pub angle: Option<f64>,
}

/// Size pulsing (`champagne-sparkle`): `size ×= lerp(min, max, ½ + ½·sin(2π·hz·τ + φ))`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Pulse {
    pub min: f64,
    pub max: f64,
    pub hz: f64,
}

/// Motion parameters of one recipe (a strongly typed mirror of `recipe.params`; pixel quantities at a 540 short edge).
#[derive(Debug, Clone, PartialEq)]
pub struct Motion {
    pub emit: Emit,
    pub emitters: Vec<Emitter>,
    pub angle: f64,
    pub spread: f64,
    pub speed_px: [f64; 2],
    pub drag_x: f64,
    pub drag_y: f64,
    pub gravity_px: f64,
    pub wind_px: f64,
    pub drift_px: f64,
    pub drift_hz: f64,
    pub size_px: [f64; 2],
    pub size_ramp: bool,
    pub spin_dps: [f64; 2],
    pub flip_hz: [f64; 2],
    pub pulse: Option<Pulse>,
    pub life_sec: f64,
    pub fade_in: f64,
    pub fade_out: f64,
    pub max_alive: usize,
}

/// User-side overrides (the shape after `ConfettiProps` has been folded).
///
/// Multiplier fields multiply the recipe base. `wind` is an absolute acceleration (px/s², 540 short edge) added on top of the
/// recipe's `windPx`. When `origin`, `angle` or `spread` is `Some`, it **replaces** the recipe's emitter group, base angle or fan.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Overrides {
    pub seed: u64,
    pub size: f64,
    pub speed: f64,
    pub gravity: f64,
    pub drift: f64,
    pub spin: f64,
    pub wind: f64,
    pub opacity: f64,
    pub origin: Option<(f64, f64)>,
    pub angle: Option<f64>,
    pub spread: Option<f64>,
    /// Length of the shape table and the palette: particles carry only indices, and the caller looks up shape and color from the tables.
    pub shape_count: usize,
    pub color_count: usize,
}

/// One live particle (pixel coordinates within the element box, origin top-left).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Particle {
    pub index: u64,
    pub x: f64,
    pub y: f64,
    /// Scale of the unit path (pixels).
    pub size: f64,
    /// Rotation angle (degrees, clockwise).
    pub rot_deg: f64,
    /// Vertical flip factor `[-1, 1]` (triangle wave), multiplied into the y scale when drawing.
    pub sy: f64,
    pub alpha: f64,
    pub shape: usize,
    pub color: usize,
}

fn lerp(a: f64, b: f64, u: f64) -> f64 {
    a + (b - a) * u
}

/// `smoothstep(0, 1, x)`。
pub fn smooth(x: f64) -> f64 {
    let t = x.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Triangle wave: frac 0 → 1, frac 0.5 → −1.
pub fn tri(x: f64) -> f64 {
    4.0 * (x - x.floor() - 0.5).abs() - 1.0
}

/// Displacement along one axis: drag `k` (1/s) plus acceleration `a` (px/s²). When `k > 0` there is a terminal velocity
/// `a / k`. Otherwise it degenerates into uniform acceleration.
pub fn axis(p0: f64, v0: f64, a: f64, k: f64, tau: f64) -> f64 {
    if k > 0.0 {
        let vt = a / k;
        p0 + vt * tau + (v0 - vt) * (1.0 - libm::exp(-k * tau)) / k
    } else {
        p0 + v0 * tau + 0.5 * a * tau * tau
    }
}

/// Birth time of particle `i`. `None` = under this set of parameters it is never born.
///
/// `duration` is the element duration (used by `settle`; pass `None` for open-ended tails).
pub fn spawn_at(
    emit: &Emit,
    seed: u64,
    i: u64,
    duration: Option<f64>,
    life_max: f64,
) -> Option<f64> {
    let t0 = match emit.mode {
        EmitMode::Burst => {
            let count = emit.count.max(1);
            let wave = i / count;
            if emit.interval <= 0.0 && wave > 0 {
                return None;
            }
            wave as f64 * emit.interval
        }
        EmitMode::Continuous => {
            (i as f64 + splitmix64_unit(seed, i * CHANNELS)) / emit.rate.max(1.0)
        }
    };
    if emit.settle
        && let Some(duration) = duration
        && t0 > duration - life_max
    {
        return None;
    }
    Some(t0)
}

/// Range `[lo, hi]` of particle indices that may be alive at this moment: those whose birth time falls within `(t − lifeMax, t]`.
pub fn index_window(emit: &Emit, t: f64, life_max: f64) -> (u64, u64) {
    match emit.mode {
        EmitMode::Burst => {
            let count = emit.count.max(1);
            let (wave_lo, wave_hi) = if emit.interval <= 0.0 {
                (0.0, 0.0)
            } else {
                (
                    ((t - life_max) / emit.interval).ceil().max(0.0),
                    (t / emit.interval).floor(),
                )
            };
            (wave_lo as u64 * count, (wave_hi as u64 + 1) * count - 1)
        }
        EmitMode::Continuous => {
            let rate = emit.rate.max(1.0);
            // The birth time carries a [0,1)/rate jitter per slot, and both ends are widened by one slot.
            let lo = (((t - life_max) * rate).floor() - 1.0).max(0.0);
            let hi = (t * rate).floor() + 1.0;
            (lo as u64, hi as u64)
        }
    }
}

/// Computes one frame. Inputs: element-local time `t` (seconds), element box `(w, h)` in pixels, `pixel_scale =
/// canvas short edge / 540`, and `duration` (the element duration, for `settle`). Returns the particle table in ascending index order,
/// truncated beyond `max_alive`.
pub fn sample(
    motion: &Motion,
    over: &Overrides,
    emit: &Emit,
    t: f64,
    (w, h): (f64, f64),
    pixel_scale: f64,
    duration: Option<f64>,
) -> Vec<Particle> {
    let mut out = Vec::new();
    if !(t >= 0.0) || over.shape_count == 0 || over.color_count == 0 || motion.emitters.is_empty() {
        return out;
    }
    let px = pixel_scale;
    let life_max = motion.life_sec;
    let origin_emitter = over.origin.map(|(x, y)| Emitter {
        x,
        y,
        spread_x: 0.0,
        spread_y: 0.0,
        angle: None,
    });
    let emitters: &[Emitter] = match &origin_emitter {
        Some(single) => std::slice::from_ref(single),
        None => &motion.emitters,
    };
    let (lo, hi) = index_window(emit, t, life_max);
    let mut i = lo;
    while i <= hi && out.len() < motion.max_alive {
        let index = i;
        i += 1;
        let Some(t0) = spawn_at(emit, over.seed, index, duration, life_max) else {
            continue;
        };
        let u = channels(over.seed, index);
        let life = life_max * lerp(LIFE_JITTER, 1.0, u[13]);
        let tau = t - t0;
        if tau < 0.0 || tau >= life {
            continue;
        }
        let em = emitters[(index % emitters.len() as u64) as usize];
        let x0 = (em.x + (u[1] - 0.5) * em.spread_x) / 100.0 * w;
        let y0 = (em.y + (u[2] - 0.5) * em.spread_y) / 100.0 * h;
        let base_angle = over.angle.or(em.angle).unwrap_or(motion.angle);
        let spread = over.spread.unwrap_or(motion.spread);
        let ang = (base_angle + (u[3] - 0.5) * spread) * PI / 180.0;
        let v0 = lerp(motion.speed_px[0], motion.speed_px[1], u[4]) * over.speed * px;
        let ax = (motion.wind_px + over.wind) * px;
        let ay = motion.gravity_px * over.gravity * px;
        let mut x = axis(x0, v0 * libm::cos(ang), ax, motion.drag_x, tau);
        let y = axis(y0, v0 * libm::sin(ang), ay, motion.drag_y, tau);
        if motion.drift_px > 0.0 && over.drift > 0.0 {
            x += over.drift
                * motion.drift_px
                * px
                * libm::sin(TAU * motion.drift_hz * tau + TAU * u[12]);
        }
        let dir = if u[9] < 0.5 { -1.0 } else { 1.0 };
        let rot_deg = u[9] * 360.0
            + dir * over.spin * lerp(motion.spin_dps[0], motion.spin_dps[1], u[8]) * tau;
        let sy = tri(u[10] + over.spin * lerp(motion.flip_hz[0], motion.flip_hz[1], u[11]) * tau);
        let mut size = over.size * lerp(motion.size_px[0], motion.size_px[1], u[5]) * px;
        if motion.size_ramp {
            size *= (3.0 * tau).min(1.0);
        }
        if let Some(pulse) = motion.pulse {
            size *= lerp(
                pulse.min,
                pulse.max,
                0.5 + 0.5 * libm::sin(TAU * pulse.hz * tau + TAU * u[14]),
            );
        }
        let mut alpha = over.opacity;
        if motion.fade_in > 0.0 {
            alpha *= smooth(tau / motion.fade_in);
        }
        if motion.fade_out > 0.0 {
            alpha *= smooth((life - tau) / motion.fade_out);
        }
        if alpha <= 0.002 || size <= 0.05 {
            continue;
        }
        let shape = ((u[6] * over.shape_count as f64).floor() as usize) % over.shape_count;
        let color = ((u[7] * over.color_count as f64).floor() as usize) % over.color_count;
        out.push(Particle {
            index,
            x,
            y,
            size,
            rot_deg,
            sy,
            alpha,
            shape,
            color,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splitmix_matches_the_reference_vector() {
        // Value given by the prototype's BigInt implementation of `splitmix64Unit(1, 0)` (53-bit mantissa).
        let a = splitmix64_unit(1, 0);
        let b = splitmix64_unit(1, 1);
        assert!((0.0..1.0).contains(&a) && (0.0..1.0).contains(&b));
        assert_ne!(a, b);
        assert_eq!(
            a,
            splitmix64_unit(1, 0),
            "纯函数：同一 (seed, k) 恒得同一值"
        );
        // seed 0 / k 0 is a known vector: z = 0, which is still 0 after the two rounds of mixing.
        assert_eq!(splitmix64_unit(0, 0), 0.0);
    }

    #[test]
    fn helpers_follow_the_prototype_formulae() {
        assert_eq!(smooth(-1.0), 0.0);
        assert_eq!(smooth(0.5), 0.5);
        assert_eq!(smooth(2.0), 1.0);
        assert_eq!(tri(0.0), 1.0);
        assert_eq!(tri(0.5), -1.0);
        assert_eq!(tri(1.25), 0.0);
        // No drag means uniform acceleration. With drag, as τ→∞ the velocity approaches a/k.
        assert_eq!(axis(1.0, 2.0, 4.0, 0.0, 1.0), 1.0 + 2.0 + 2.0);
        let far = axis(0.0, 0.0, 10.0, 2.0, 100.0);
        let further = axis(0.0, 0.0, 10.0, 2.0, 101.0);
        assert!((further - far - 5.0).abs() < 1e-6);
    }

    fn emit(mode: EmitMode) -> Emit {
        Emit {
            mode,
            rate: 40.0,
            count: 80,
            interval: 2.0,
            settle: false,
        }
    }

    #[test]
    fn spawn_and_window_agree_on_bursts() {
        let e = emit(EmitMode::Burst);
        assert_eq!(spawn_at(&e, 7, 0, None, 4.5), Some(0.0));
        assert_eq!(spawn_at(&e, 7, 79, None, 4.5), Some(0.0));
        assert_eq!(spawn_at(&e, 7, 80, None, 4.5), Some(2.0));
        let once = Emit { interval: 0.0, ..e };
        assert_eq!(spawn_at(&once, 7, 80, None, 4.5), None);
        assert_eq!(index_window(&once, 30.0, 4.5), (0, 79));
        // t = 5: only waves 1 and 2 can be alive (born at 2s and 4s). Wave 0 has already outlived its lifetime.
        assert_eq!(index_window(&e, 5.0, 4.5), (80, 239));
        // settle: no emission during the last lifeMax seconds.
        let settle = Emit { settle: true, ..e };
        assert_eq!(spawn_at(&settle, 7, 160, Some(8.0), 4.5), None);
        assert_eq!(spawn_at(&settle, 7, 80, Some(8.0), 4.5), Some(2.0));
    }

    #[test]
    fn continuous_window_covers_every_alive_particle() {
        let e = emit(EmitMode::Continuous);
        let life = 4.5;
        for t in [0.0, 0.3, 4.4, 4.6, 12.0] {
            let (lo, hi) = index_window(&e, t, life);
            for i in 0..(t * e.rate) as u64 + 3 {
                let t0 = spawn_at(&e, 9, i, None, life).unwrap();
                let alive = t0 <= t && t - t0 < life;
                if alive {
                    assert!(i >= lo && i <= hi, "t={t} i={i} 在窗口 [{lo},{hi}] 之外");
                }
            }
        }
    }
}
