//! The frozen idle loop kernel (ADR-M08, plan §2.9).
//!
//! Stage 1 does **not** lower loop into keyframe tracks. The existing implementation is
//! `amp * intensity * sampled_wave(...)` followed by a whole-value `mixed_toward_identity(envelope)`. A keyframe track would first
//! compute `identity + a*w_i` and then interpolate; the two differ in the last ulp, which breaks “bit-for-bit unchanged”. So a named
//! kernel is kept, and **the kernel contains no numbers of its own**: amplitude, period, waveform, seed, lattice, sample count and
//! envelope constants all come from the manifest (plan §3.1).
//!
//! Function bodies copied expression-for-expression from `ccut-timeline/src/motion.rs:893-1033`.

use crate::composite::{PostOp, mix_toward_identity};
use crate::curve::{CurveSpec, sample_curve};

/// Lattice width for `jitter@1` (`motion.rs:15`), declared by the manifest; this is only the default.
pub const DEFAULT_LATTICE: i64 = 8;
/// Waveform resampling point count (`motion.rs:16`), same as above.
pub const DEFAULT_WAVE_SAMPLES: usize = 32;
/// Default seed for `jitter@1` (`motion.rs:949`).
pub const DEFAULT_NOISE_SEED: u64 = 17;

/// Channel → seed ordinal (`motion.rs:950-957`). `jitter`'s dx uses `seed+101` and dy uses `seed+202`, pinned by the golden values
/// at `motion.rs:1127-1148`. The manifest references channels by name; the ordinal is always derived.
pub const CHANNEL_ORDINALS: &[(&str, u32)] = &[
    ("opacity", 0),
    ("dx", 1),
    ("dy", 2),
    ("scaleX", 3),
    ("scaleY", 4),
    ("rotation", 5),
];

pub fn channel_ordinal(channel: &str) -> Option<u32> {
    CHANNEL_ORDINALS
        .iter()
        .find(|(name, _)| *name == channel)
        .map(|(_, ordinal)| *ordinal)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WaveKind {
    Sine,
    Dip,
    Noise,
    /// Monotonic ramp: phase → phase. The only waveform that takes 1 at phase 1 rather than 0. It is used only for periodic channels
    /// such as `rotation` (360° ≡ 0°, so the seam still closes).
    Ramp,
    /// Design draft `heartBeat`: two beats (a main beat plus a 0.7× secondary beat), then still.
    Heartbeat,
}

impl WaveKind {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "sine" => Some(Self::Sine),
            "dip" => Some(Self::Dip),
            "noise" => Some(Self::Noise),
            "ramp" => Some(Self::Ramp),
            "heartbeat" => Some(Self::Heartbeat),
            _ => None,
        }
    }
}

/// Named noise algorithm (ADR-M08). New recipes always use splitmix64; `jitter@1` is frozen on this branch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NoiseKind {
    LatticeMurmurV1,
    /// The splitmix64 of spec §7.3 ([`crate::rng`]). The new recipes from stage 3 on, and the `noise` op of `animate.flow`, both take
    /// this branch, with default seed **0**.
    Splitmix64V1,
}

impl NoiseKind {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "lattice-murmur-v1" => Some(Self::LatticeMurmurV1),
            "splitmix64-v1" => Some(Self::Splitmix64V1),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::LatticeMurmurV1 => "lattice-murmur-v1",
            Self::Splitmix64V1 => "splitmix64-v1",
        }
    }

    /// Lattice vertex values. Both branches pin vertex 0 to 0 and take the modulus by `lattice` (seamless loop).
    pub fn vertex(self, seed: u64, index: i64, lattice: i64) -> f64 {
        match self {
            Self::LatticeMurmurV1 => noise_hash(seed, index, lattice),
            Self::Splitmix64V1 => crate::rng::splitmix64_lattice(seed, index, lattice),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NoiseSpec {
    pub kind: NoiseKind,
    pub lattice: i64,
    pub default_seed: u64,
}

/// Named envelope algorithm.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EnvelopeKind {
    IdleRampV1,
    /// No envelope: `amount()` is always 1. `animate.flow`'s `oscillate` / `noise` use it (the author controls start and stop with `delay`
    /// / `repeat`, and the kernel no longer applies a ramp for them).
    None,
}

impl EnvelopeKind {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "idle-ramp-v1" => Some(Self::IdleRampV1),
            "none" => Some(Self::None),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct EnvelopeSpec {
    pub kind: EnvelopeKind,
    pub ramp_cap: f64,
    pub ramp_fraction: f64,
    pub tail_threshold_sec: f64,
    pub tail_start: f64,
    pub tail_span: f64,
}

impl EnvelopeSpec {
    /// Identity envelope (`EnvelopeKind::None`). The other fields do not take part in evaluation; write 0.
    pub const NONE: Self = Self {
        kind: EnvelopeKind::None,
        ramp_cap: 0.0,
        ramp_fraction: 0.0,
        tail_threshold_sec: 0.0,
        tail_start: 0.0,
        tail_span: 0.0,
    };

    /// Expression-for-expression from `motion.rs:961-973`.
    pub fn amount(&self, idle_local: f64, idle_duration: f64) -> f64 {
        if self.kind == EnvelopeKind::None {
            return 1.0;
        }
        let ramp = self.ramp_cap.min(idle_duration * self.ramp_fraction);
        let ramp_in = if ramp > 0.0 {
            (idle_local / ramp).clamp(0.0, 1.0)
        } else {
            1.0
        };
        if idle_duration <= self.tail_threshold_sec || idle_local <= idle_duration * self.tail_start
        {
            ramp_in
        } else {
            ramp_in
                * (1.0
                    - (idle_local - idle_duration * self.tail_start)
                        / (idle_duration * self.tail_span))
                    .max(0.0)
        }
    }
}

/// Single-channel idle loop kernel. All numeric values are computed at compile time from the manifest and the slot.
#[derive(Clone, Debug, PartialEq)]
pub struct LoopKernel {
    pub wave: WaveKind,
    pub wave_samples: usize,
    pub noise: Option<NoiseSpec>,
    /// `amp * intensity`, with the same left-to-right association as `motion.rs:952-957`.
    pub amplitude: f64,
    pub channel_ordinal: u32,
    pub channel_seed_stride: u64,
    pub seed: u64,
    pub period: f64,
    pub phase_offset: f64,
    pub envelope: EnvelopeSpec,
    pub identity: f64,
    pub post: PostOp,
    /// Multi-keyframe loop (2026-09-08, element loop). When non-empty, no waveform is used: interpolate with `sample_curve(curve of the
    /// segment-end frame)` according to the segment the phase falls in, and the envelope is always 1. This table is always empty for
    /// the waveform recipes, so their evaluation and fingerprints stay bit-for-bit unchanged.
    pub keyframes: Vec<ChannelKey>,
}

/// One frame of a keyframe chain (shared by the loop kernel and the [`crate::lower_timeline::TweenAtom`] of enter / exit): `value`
/// has already been folded as `identity + (v − identity)·intensity`; `curve` is the easing of the segment **arriving at** this frame.
#[derive(Clone, Debug, PartialEq)]
pub struct ChannelKey {
    pub at: f64,
    pub value: f64,
    pub curve: CurveSpec,
}

/// Takes the value at phase `phase ∈ [0, 1]` on the keyframe chain. Within segment `[k_i, k_{i+1}]` it is eased by `k_{i+1}.curve`;
/// when the phase lies exactly on a keyframe, it is bit-for-bit equal to that frame's `value`.
pub fn sample_keyframes(keys: &[ChannelKey], phase: f64) -> f64 {
    match keys {
        [] => 0.0,
        [only] => only.value,
        _ => {
            let index = keys.partition_point(|key| key.at <= phase);
            if index == 0 {
                return keys[0].value;
            }
            if index >= keys.len() {
                return keys[keys.len() - 1].value;
            }
            let (from, to) = (&keys[index - 1], &keys[index]);
            if phase == from.at {
                return from.value;
            }
            let span = to.at - from.at;
            let progress = if span <= 0.0 {
                1.0
            } else {
                (phase - from.at) / span
            };
            let eased = sample_curve(&to.curve, progress);
            from.value + (to.value - from.value) * eased
        }
    }
}

impl LoopKernel {
    /// Single-channel slice, expression-for-expression from `motion.rs:946-975`.
    pub fn sample(&self, idle_local: f64, idle_duration: f64) -> f64 {
        let phase = idle_local / self.period + self.phase_offset;
        let phase = phase.rem_euclid(1.0);
        if !self.keyframes.is_empty() {
            let raw = sample_keyframes(&self.keyframes, phase);
            return self.post.apply(raw);
        }
        let seed = self
            .seed
            .wrapping_add(self.channel_ordinal as u64 * self.channel_seed_stride);
        let term = self.amplitude
            * sampled_wave(
                self.wave,
                seed,
                phase,
                self.wave_samples,
                self.noise.as_ref(),
            );
        // `motion.rs` writes `amp*i*v` for channels with identity == 0 and `1.0 + amp*i*v` for channels with identity == 1. The two forms
        // differ in the sign of zero, so they are kept verbatim here.
        let raw = if self.identity == 0.0 {
            term
        } else {
            self.identity + term
        };
        let raw = self.post.apply(raw);
        let envelope = self.envelope.amount(idle_local, idle_duration);
        mix_toward_identity(raw, self.identity, envelope)
    }
}

/// Expression-for-expression from `motion.rs:985-991`.
pub fn wave_value(wave: WaveKind, seed: u64, phase: f64, noise: Option<&NoiseSpec>) -> f64 {
    use std::f64::consts::PI;
    match wave {
        WaveKind::Sine => libm::sin(2.0 * PI * phase),
        WaveKind::Dip => -(0.5 - 0.5 * libm::cos(2.0 * PI * phase)),
        WaveKind::Noise => {
            let lattice = noise.map_or(DEFAULT_LATTICE, |spec| spec.lattice);
            let kind = noise.map_or(NoiseKind::LatticeMurmurV1, |spec| spec.kind);
            noise_value_of(kind, seed, phase, lattice)
        }
        WaveKind::Ramp => phase.rem_euclid(1.0),
        WaveKind::Heartbeat => heartbeat_value(phase.rem_euclid(1.0)),
    }
}

/// Expression-for-expression from the design draft `model-textanim.js` `heartBeat`: one main beat in the first 15%, one 0.7× secondary
/// beat at 20%–35%, otherwise still.
pub fn heartbeat_value(u: f64) -> f64 {
    use std::f64::consts::PI;
    if u < 0.15 {
        libm::sin(u / 0.15 * PI)
    } else if u < 0.2 {
        0.0
    } else if u < 0.35 {
        libm::sin((u - 0.2) / 0.15 * PI) * 0.7
    } else {
        0.0
    }
}

/// The pinned value at the period end (phase 1): 0 for all except [`WaveKind::Ramp`], which takes 1.
pub fn seam_value(wave: WaveKind) -> f64 {
    if wave == WaveKind::Ramp { 1.0 } else { 0.0 }
}

/// Expression-for-expression from `motion.rs:993-1007`. The `samples`-th sample point is hard-pinned to [`seam_value`] (1 for ramp,
/// 0 otherwise).
pub fn sampled_wave(
    wave: WaveKind,
    seed: u64,
    phase: f64,
    samples: usize,
    noise: Option<&NoiseSpec>,
) -> f64 {
    let position = phase.rem_euclid(1.0) * samples as f64;
    let index = position.floor() as usize;
    let fraction = position - index as f64;
    let value = |sample: usize| {
        if sample == samples {
            seam_value(wave)
        } else {
            wave_value(wave, seed, sample as f64 / samples as f64, noise)
        }
    };
    let start = value(index);
    let end = value(index + 1);
    start + (end - start) * fraction
}

/// Expression-for-expression from `motion.rs:1009-1023` (murmur3 finalizer style; lattice vertex 0 pinned to 0).
pub fn noise_hash(seed: u64, index: i64, lattice: i64) -> f64 {
    let index = index.rem_euclid(lattice) as u64;
    if index == 0 {
        return 0.0;
    }
    let mut hash = seed
        .wrapping_mul(0x9E37_79B1)
        .wrapping_add(index.wrapping_mul(0x85EB_CA77));
    hash ^= hash >> 33;
    hash = hash.wrapping_mul(0xFF51_AFD7_ED55_8CCD);
    hash ^= hash >> 33;
    hash = hash.wrapping_mul(0xC4CE_B9FE_1A85_EC53);
    hash ^= hash >> 33;
    (hash % 20_001) as f64 / 10_000.0 - 1.0
}

/// Expression-for-expression from `motion.rs:1025-1033` (`lattice-murmur-v1`).
pub fn noise_value(seed: u64, phase: f64, lattice: i64) -> f64 {
    noise_value_of(NoiseKind::LatticeMurmurV1, seed, phase, lattice)
}

/// Smooth lattice interpolation for the named noise kernel. The vertex algorithm dispatches on `kind`; the interpolation (smoothstep)
/// is shared.
pub fn noise_value_of(kind: NoiseKind, seed: u64, phase: f64, lattice: i64) -> f64 {
    let x = phase.rem_euclid(1.0) * lattice as f64;
    let index = x.floor() as i64;
    let fraction = x - index as f64;
    let a = kind.vertex(seed, index, lattice);
    let b = kind.vertex(seed, index + 1, lattice);
    let smooth = fraction * fraction * (3.0 - 2.0 * fraction);
    a + (b - a) * smooth
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jitter_matches_voiceink_compiled_golden_samples() {
        // The same set of numbers as `jitter_matches_voiceink_compiled_golden_samples` in `ccut-timeline/src/motion.rs`, pinning the seed
        // ordinals 101 / 202 and the 32-point resampling.
        let cases = [
            (
                0.05,
                0.001_059_279_375_000_000_2,
                -0.000_569_161_250_000_000_1,
            ),
            (0.125, 0.002_922_15, -0.001_570_1),
            (0.25, -0.000_762_3, 0.003_081_4),
            (
                0.31,
                -0.000_261_544_500_000_000_1,
                0.002_915_694_250_000_000_2,
            ),
        ];
        let noise = NoiseSpec {
            kind: NoiseKind::LatticeMurmurV1,
            lattice: DEFAULT_LATTICE,
            default_seed: DEFAULT_NOISE_SEED,
        };
        for (phase, expected_dx, expected_dy) in cases {
            let dx = 0.0035 * sampled_wave(WaveKind::Noise, 17 + 101, phase, 32, Some(&noise));
            let dy = 0.0035 * sampled_wave(WaveKind::Noise, 17 + 202, phase, 32, Some(&noise));
            assert!((dx - expected_dx).abs() < 1e-15, "phase={phase} dx={dx}");
            assert!((dy - expected_dy).abs() < 1e-15, "phase={phase} dy={dy}");
        }
    }

    #[test]
    fn lattice_index_zero_is_pinned() {
        assert_eq!(noise_hash(17, 0, 8), 0.0);
        assert_eq!(noise_hash(17, 8, 8), 0.0);
        assert_eq!(noise_value(17, 0.0, 8), 0.0);
    }

    #[test]
    fn envelope_ramps_in_and_out() {
        let envelope = EnvelopeSpec {
            kind: EnvelopeKind::IdleRampV1,
            ramp_cap: 0.3,
            ramp_fraction: 0.15,
            tail_threshold_sec: 6.0,
            tail_start: 0.8,
            tail_span: 0.2,
        };
        assert_eq!(envelope.amount(0.0, 4.0), 0.0);
        assert_eq!(envelope.amount(1.0, 4.0), 1.0);
        // A short idle has no tail ramp-out
        assert_eq!(envelope.amount(3.9, 4.0), 1.0);
        // A long idle ramps out over the last 20%
        assert_eq!(envelope.amount(10.0, 10.0), 0.0);
        assert!(envelope.amount(9.0, 10.0) < 1.0);
    }

    #[test]
    fn the_two_noise_kernels_stay_separate_and_both_loop_seamlessly() {
        // ADR-M08: the murmur kernel of `jitter@1` must not be rewritten with splitmix64.
        let murmur = noise_value_of(NoiseKind::LatticeMurmurV1, 17, 0.37, 8);
        let split = noise_value_of(NoiseKind::Splitmix64V1, 17, 0.37, 8);
        assert_eq!(murmur, noise_value(17, 0.37, 8));
        assert_ne!(murmur, split);
        for kind in [NoiseKind::LatticeMurmurV1, NoiseKind::Splitmix64V1] {
            assert_eq!(noise_value_of(kind, 5, 0.0, 8), 0.0, "{kind:?}");
            assert_eq!(
                noise_value_of(kind, 5, 1.0, 8),
                noise_value_of(kind, 5, 0.0, 8),
                "{kind:?}"
            );
        }
    }

    #[test]
    fn the_none_envelope_is_the_identity() {
        assert_eq!(EnvelopeSpec::NONE.amount(0.0, 4.0), 1.0);
        assert_eq!(EnvelopeSpec::NONE.amount(4.0, 4.0), 1.0);
    }

    #[test]
    fn channel_ordinals_match_the_pose_channel_order() {
        assert_eq!(channel_ordinal("dx"), Some(1));
        assert_eq!(channel_ordinal("dy"), Some(2));
        assert_eq!(channel_ordinal("blur"), None);
    }
}
