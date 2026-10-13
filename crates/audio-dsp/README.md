# audio-dsp

Ported from CucCut v2 `ccut-audio-dsp`; the algorithms and constants are unchanged. The `ccut-*` crates mentioned below all refer to v2.

Offline audio DSP primitives for CucCut. `ccut-score` (score / sound-effect synthesis and preview mastering) uses them, and the mixing in the later render stage uses them too.
They are pure functions with no I/O, and they **are not part of any `ccut-wasm*` dependency graph**: the Web does not need these operators, so they are not linked into the browser build. They run only on the local machine / CLI side.

## Conventions

| Item | Convention |
| --- | --- |
| Sample rate | Passed explicitly as `sr: f64`; CucCut's default is `DEFAULT_RATE = 48 000` |
| Channel layout | **Planar**: stereo is `Stereo { l, r }` (two equal-length `Vec<f32>`), and multi-channel entry points take `&[&[f32]]`. Interleaving appears only in the WAV encoding step |
| Numerics | Samples are `f32`; filter state, accumulation and loudness integration are `f64` |
| Units | Time in seconds, frequency in Hz, levels as `*_db` (dB) or linear gain |
| Determinism | Transcendental functions use only `libm`; randomness uses only a seeded splitmix64 (`Rng`); the FFT is a built-in scalar radix-2 implementation. The same input is bit-identical on macOS / Windows / Linux. `rustfft` is not used, because it selects SIMD paths by CPU, so the last bit would vary by platform |

## Modules

| Module | Contents |
| --- | --- |
| `biquad` | RBJ lowpass / highpass / bandpass / peaking / low and high shelves, first-order, Butterworth cascades (orders 1–8), and the convenience functions `lowpass` / `highpass` / `bandpass` / `resonator` |
| `tvlp` | Time-varying lowpass: 16 fixed cutoff steps (90 Hz–15 kHz, logarithmically spaced) plus one bypass step, cross-faded per sample |
| `osc` | Phase accumulator, polyBLEP sawtooth / square, sine |
| `noise` | White noise, and spectrally shaped colored noise (`slope`: 0 white, 1 pink, 2 brown), normalized to unit RMS |
| `curve` | smoothstep / linear keyframes, and `wander`, a smooth random curve |
| `reverb` | `IrSpec` (built-in spaces `room` / `hall` / `huge` / `water`), `synth_ir` for synthesized IRs, and `convolve` / `convolve_stereo` (overlap-add FFT convolution) |
| `dynamics` | 10 ms block RMS, `follow` attack/release follower, `activity` (a continuous 0..1 “someone is speaking”), `duck_gain`, and `Glue` compression |
| `loudness` | BS.1770-4 integrated loudness, short-term loudness, EBU 3342 LRA, `measure`, and `normalize_to_lufs` |
| `truepeak` | 4× oversampled true peak (Kaiser sinc), `Limiter` (a look-ahead gain curve that takes the centered minimum plus the average), and `trim_to_ceiling` as a static fallback |
| `stereo` | `Stereo`, constant-power panning (center gain is 1), `fade`, peak / RMS normalization, and DC removal |
| `resample` | Whole-buffer Blackman-windowed sinc resampling (256-phase kernel table; downsampling scales the cutoff and tap count proportionally): `resample` / `resample_stereo` / `output_len`. `ccut-score` uses it when reading narration WAVs with a different sample rate; the `ccut-render` streaming decoder has a separate block-by-block implementation (std float, bound to existing goldens), and the two are not interchangeable |
| `align` | Integer / fractional delay, and FFT cross-correlation to find time offset and polarity (`find_lag` / `align_to`) |
| `master` | `MasterSpec` → fade in/out → glue → (normalize → limit) × 3 → DC removal → static fallback → `MasterReport` |

The algorithms come from the reference project 精卫 (Jingwei), `tools/audio.py`: parameters, frequency bands and thresholds are ported with the same conventions, and differences are documented in each module's docs.

## Verification

```bash
cargo test -p audio-dsp
```

The unit tests cover these categories:

- **Frequency-response direction**: each filter, the time-varying lowpass, the tilt of colored noise, and the high-frequency loss of IRs.
- **Standard test vectors**:
  - EBU Tech 3341: a stereo 997 Hz, −23 dBFS sine should measure −23 LUFS.
  - EBU Tech 3342: the first 20 s at −20 dBFS and the last 20 s at −30 dBFS should give an LRA of 10 LU.
  - A sine at fs/4 with 45° phase: sample peak −3 dB, true peak 0 dBTP.
- **Cross-check against the independent `ebur128` crate** (used only as a dev-dependency): integrated loudness within ±0.3 LU, true peak within ±0.3 dB.
- **Mastering**: the output hits the target loudness, and the true peak does not exceed the ceiling.
- **Determinism**: every operator asserts bit-identical output.
