# `core/fixtures/visualizer/` —— conformance fixtures for the visualizer

Artifacts of ADR-E04 (the `VisualSource` contract and injection protocol) and §8.7 (conformance standard) in
[`docs/design/bcf/ccut-element-render-foundation-design.md`](../../../docs/design/bcf/ccut-element-render-foundation-design.md).

In short: **the input is fixed in `cases.json`, and each stage appends its own expected files.**
P2 only pins down "how the spectrum is derived and how frames are fetched by time"; CPU drawing and the wasm preview reuse the same input, and each compares against its own golden.

**These files are not hand-written, and must not be hand-edited.**

```bash
cd core
cargo test -p ccut-render --test visualizer_source                # verify (includes the up-to-date gate)
cargo test -p ccut-render --test visualizer_source -- --ignored   # regenerate after review
```

The generator is `crates/ccut-render/tests/visualizer_source.rs` itself: the generating and consuming sides share the same set of functions, so `visualizer_fixtures_are_up_to_date` is a real gate that "recomputes on the spot and then compares byte by byte", not "run a script once and hope".

## Layout

| Path | Contents |
| --- | --- |
| `cases.json` | **Input**: two fixed BCS1 files × four sets of element parameters × five instants + shuffled sequence + 10 style ids |
| `sweep-48k-mono.bcs1` | Programmatically generated 3.0 s synthetic spectrum (180 frames × 640 bytes) |
| `expected-track.json` | **P2 golden**: whole-track fingerprints of 8 `VizTrack`s + frame numbers and per-row digests at five instants |
| `expected-draw.json` | **Draw golden**: DrawOp fingerprints for 10 styles × five instants + one silent frame, plus a frozen `samples` column for the line-type styles (generator is `tests/visualizer_draw.rs`) |
| `../spectrum/tone-48k-mono-f32.bcs1` | P1's real DSP golden (0.2 s); referenced by `cases.json`, not copied |
| `../progress/` | Counterpart fixtures for the progress element (it has no media source, so its input structure is entirely different; see the README there) |

## The two BCS1 files each cover one thing

| Name | Duration | Purpose |
| --- | --- | --- |
| `tone` | 0.2 s | Real STFT output. Instants 0.5 / 1.0 / 2.5 in the timeline are **all out of range**; they exist specifically to pin "freeze the last frame after the end". |
| `sweep` | 3.0 s | Synthesized with pure integer arithmetic; all five instants fall within the track, and it covers the full 0..255 byte range. |

`sweep` **deliberately does not go through `dsp::analyze`**: that path's bytes depend on rustfft's trigonometric functions, and nobody has promised bit-for-bit identical results across platforms. This directory pins the chain "remap → smooth → round → table lookup"; canonical bytes built from integers are a better input for it. The byte golden for real DSP is handled by P1's `core/fixtures/spectrum/`; here it is run as a second input alongside.

## The high-frequency band of `sweep` is empty (know this when reading `expected-draw.json`)

The frequency-domain row of `synth_spectrum` has `decay = 200 − bin·200/96`: **after bin ≥ 96 only jitter remains**, and after remapping with the `default` parameter group (`minDb = −80` / `maxDb = 40`) it becomes 0. As a result, the two styles that split bands evenly have some segments that are "static" on this input: the high band of `pulse_rings` stays at the rest radius, and the trailing ribbons of `ribbons` have zero swing and collapse to the centre line. They **still each have one instruction** (`ops` is always 5 / 3); the static form is part of the design, not a drawing that failed to connect. Per-segment geometry is pinned by `the_pulse_rings_expand_with_the_bands` / `the_ribbons_blend_from_main_to_secondary` in `source/visualizer/draw.rs`, using a single frame of constant spectrum.

`dots` is the only style whose `ops` change over time: the dot matrix only draws lit dots and peak dots, and in the first few frames of `sweep` the spectrum has not yet filled all columns.

To cover high bins, append a wider dB window set to the **end** of `params` in `cases.json`, rather than changing `sweep` (it is the input frozen by P2).

## Sample sequence and shuffling (numbering shared by the three executors)

The `sequence` in `cases.json` expands (spectra × params × instants) into `0 .. length-1` in the order written; `shuffle.order` is a permutation of it, using **splitmix64 + Fisher–Yates** (counting down from `len-1`, `pick = next % (i+1)`, seed written in `shuffle.seed`), identical word for word to the method in phase 0 of the motion plan.

"Shuffled sampling == sequential sampling, bit for bit" is a **required** item of source conformance, not optional: export is already out of order (`ccut render --t 7.5` jumps straight to a frame, and full-film export splits by stride across multiple workers), so once the source holds an incremental clock this check can never go green. Exponential smoothing is naturally recursive, so it is pinned to the whole-track derivation in the host preflight, and `sample(t)` is reduced to a single array index lookup (ADR-E04 §6.2).

## Rounding rule

```text
idx = clamp(floor(t × analysisRate), 0, frameCount - 1)
```

No interpolation, no rounding up or down. **There is only one implementation**: `ccut_waveform::bcs1::frame_index_at`; `Bcs1View::frame_index_at` and `VizTrack::frame_index_at` both forward to it, and `the_rounding_rule_matches_the_spectrum_format_layer` cross-checks the two paths instant by instant.

## Division of work between time-domain and frequency-domain rows

The frequency-domain row goes through the full "remap → smooth → gain"; **the time-domain row is carried over byte for byte, unchanged**. The basis is the Web Audio semantics this plan aligns with throughout: `smoothingTimeConstant` applies only to `getByteFrequencyData`, and a dB window makes no sense for a centred waveform where "silence ≈ 128". Of the 10 styles, only `oscilloscope-v1` (`oscilloscope` / `ring_wave`) reads the time-domain row.

## §8 GPU interface conventions (frozen and retained; visualizer does not currently use them)

Since the redesign of 2026-09, all 10 visualizer styles are **CPU vector recipes** (`source/visualizer/recipes/`), with no WGSL implementation; the GPU pass runs only progress. `expected-track.json` contains no GPU data at all, but the fixture input is still laid out according to the §8 interface conventions, so it can be used directly when GPU waveform recipes are added later:

- **§8.1 bind group**: `@group(0)` transform, `@group(1)` per-effect scalars, `@group(2) @binding(0)` audio texture + `@binding(1)` sampler (linear / clamp-to-edge).
- **§8.2 `@group(1)` uniform order frozen** (visualizer, 8 items):
  `u_time`, `u_mainColor`, `u_secondaryColor`, `u_canvasRes`, `u_dstRes`, `u_colourMultiplier`, `u_clip`, `u_textureSize`. `tests/shader_wgsl.rs` still cross-checks the prelude against `VisualizerUniforms`.
- **§8.3 Audio texture**: `R8Unorm`, `w × 2`, **row 0 = time domain, row 1 = frequency domain, no flip**.
  The code-side freeze point is `ccut_render::source::visualizer::{AUDIO_TEXTURE_ROW_TIME, AUDIO_TEXTURE_ROW_FREQ}`;
  CPU recipes read rows via `freq_row` / `time_row`, using the same conversion as the texture rows.
- **§8.4 Frequency mapping**: 48 kHz BCS1 aligns directly with Web Audio; `binWidth == "64"` takes the lowest 64 bins (0–3 kHz), and `half` covers 0–24 kHz (`VizFrame::freq_window`).
- **§8.7 Criteria**: strict styles must pass three checks: flat region ≤ 2/255, transition band ≤ 20%, 4× downsampled SSIM ≥ 0.98; visual styles need SSIM ≥ 0.96; a style that fails conformance automatically falls back to CPU and is reported in the preflight `fallbacks[]`. Currently only progress goes through this gate (`tests/gpu_conformance.rs`).

## How each consumer hooks in

| Consumer | File | Compared against |
| --- | --- | --- |
| CPU drawing | `expected-draw.json` | DrawOp fingerprints for the 10 styles; with sound and in silence, each style has `ops > 0` |
| wasm preview | Reuses `expected-draw.json` | The same inputs run in wasm; the instruction stream must be byte-identical |
| GPU waveform recipes (future) | `expected-gpu.json` | §8.7 criteria for GPU output vs. the CPU reference; there are no such recipes yet, so the file does not exist |

### The two rules for `expected-draw.json`

1. **Silence still has visuals.** When the frequency-domain row is all zeros, each style still draws its own "static form": bars stay at `minHeight`, the oscilloscope stays on the centre line, the dot matrix keeps its base lights, the rings stop at the rest radius, and the ribbons collapse to the centre line.
   Elements do not disappear from the canvas during the opening / silent sections; `every_style_is_live_in_the_golden` pins this for each style.
2. **`aspect: "square"` takes the inscribed square of the box.** The default geometry table gives "30% of frame width × 30% of frame height", which is not a square in pixels at 16:9. Since the recipe explicitly declares `square`, the drawing side draws within the inscribed square, so circular styles (`ring_bars` / `ring_wave` / `pulse_rings`) are perfect circles in any box. The geometry of all three styles is contained within the square, so no `ClipPath` is needed.

When adding expected files, **do not touch `cases.json`**: change the input and every golden from earlier stages loses comparability. If new input is truly needed, append to the end of `spectra` / `params` so that existing numbering stays unchanged.
