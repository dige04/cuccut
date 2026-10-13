//! CucCut offline audio DSP primitives, shared by music / sound-effect synthesis (`ccut-score`) and mastering (the later `ccut-render` mix).
//!
//! Conventions (consistent across the crate):
//!
//! - **Pure functions, no I/O**: inputs are slices, outputs are new `Vec<f32>` or in-place rewrites via `&mut`. No hidden state, no global cache; the same input gives bit-identical results on repeated calls.
//! - **Sample rate is passed explicitly** (`sr: f64`, CucCut default 48 000). Time parameters are always seconds, frequencies are Hz, and levels are dB (`*_db`) or linear gain (otherwise).
//! - **Multichannel is always planar**: stereo is [`Stereo`] (`l` / `r`, two equal-length `Vec<f32>`); the general multichannel entry takes `&[&[f32]]` (one slice per channel). Interleaved only appears in the WAV encoding step (`ccut-score::wav`); it does not appear inside the DSP.
//! - **Samples are `f32`; internal accumulation and filter state are `f64`**: a 40 Hz high-pass or a 60-second loudness integral would drift in `f32`.
//! - **Deterministic, consistent across platforms**: transcendental functions (`sin` / `exp` / `ln` / `pow` / `tan` / `tanh`) go only through [`libm`]; randomness goes only through a seeded splitmix64 ([`rng::Rng`]); the FFT is this crate's own scalar radix-2 implementation (twiddle factors computed with `libm`). The four arithmetic operations and `sqrt` are IEEE correctly rounded, so they are consistent by nature. Does not depend on `rustfft` / `realfft`: they pick SIMD paths (AVX / NEON) by CPU, so the order of operations varies by platform and the last-bit results would differ; and mastering's loudness gain would amplify the last-bit difference to the whole audio. The cost is convolution several times slower, which is acceptable for offline rendering.
//!
//! For the module overview, see each module's docs: [`biquad`] (RBJ biquad + Butterworth cascade), [`tvlp`] (time-varying low-pass), [`osc`] (polyBLEP oscillators), [`noise`] (colored noise), [`curve`] (keyframes and drift curves), [`reverb`] (synthesized impulse response + FFT block convolution), [`dynamics`] (block RMS follower, activity ducking, glue compression), [`loudness`] (BS.1770-4 integrated loudness / LRA / short-term loudness), [`truepeak`] (4× oversampled true peak and lookahead limiter), [`stereo`] (panning, fades, normalization), [`resample`] (whole-segment sinc resampling), [`align`] (delay and phase alignment), [`master`] (mastering chain).

pub mod align;
pub mod biquad;
pub mod curve;
pub mod dynamics;
pub mod fft;
pub mod loudness;
pub mod master;
pub mod math;
pub mod noise;
pub mod osc;
pub mod resample;
pub mod reverb;
pub mod rng;
pub mod stereo;
pub mod truepeak;
pub mod tvlp;

pub use rng::Rng;
pub use stereo::Stereo;

/// CucCut audio's default sample rate.
pub const DEFAULT_RATE: f64 = 48_000.0;
