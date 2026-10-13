# `core/fixtures/progress/` — conformance fixtures for progress elements

Output of §7.4 (the table of 14 progress styles) and §11 (test strategy) in
[`docs/design/bcf/ccut-element-render-foundation-design.md`](../../../docs/design/bcf/ccut-element-render-foundation-design.md).

In short: **the input is fixed in `cases.json`; each stage appends its own expected file.**
P3 pins the DrawOp instruction streams of the 6 strict styles; P4 adds `snake` / `snake_spin`;
P5 (the four rainbow / strobe styles + GPU cross-check) reuses the same input.

**These files are not hand-written, and must not be hand-edited.**

```bash
cd core
cargo test -p ccut-render --test progress_draw                # verify (includes the up-to-date gate)
cargo test -p ccut-render --test progress_draw -- --ignored   # regenerate after confirming
```

The generator is `crates/ccut-render/tests/progress_draw.rs` itself: the generating and consuming sides
share the same set of functions, so `the_progress_fixtures_are_up_to_date` is a real gate that
recomputes on the spot and then compares byte by byte.

## Why this is separate from `../visualizer/`

Progress **has no asset source**: its content is derived entirely from the playhead,
`progress = clamp((t − start) / (end − start), 0, 1)` (the source of truth is
`ccut_timeline::geometry::progress_at`). So its input contains no BCS1, no timing table and no
out-of-order sequence, only `(progress, element box, two colors)`. Forcing it into the visualizer's
`cases.json` would grow that file with half of its fields unused, and that file was frozen in P2.

## Layout

| Path | Content |
| --- | --- |
| `cases.json` | **Input**: five progress values (+ the five paired times) + three element boxes + two colors + pixel conversion factor + 14 style ids |
| `expected-draw.json` | **Golden for P3/P4**: for 14 styles × 5 (progress, time) pairs, the DrawOp count / path count / fingerprint |

## Element boxes and pixel units

The three boxes come directly from the default geometry table in `ccut_timeline::geometry`, in pixels at 1920×1080:

| aspect | box | used by |
| --- | --- | --- |
| `bar` | 80% × 5% of the frame, centred | `normal` / `rounded` |
| `square` | 30% × 30% of the frame, centred | `circle` / `donut` / `snake*` |
| `frame` | 100% × 100% of the frame | the six `*border` styles |

`times` is a column **added in P4**, paired one-to-one with `progress`. It holds the **element-local time**
(`t − element.start`, in seconds; corresponds to `u_time` in the reference implementation). The six P3
styles do not depend on time, and with this column added their fingerprints are unchanged byte for byte;
only the self-rotation phase of `snake_spin` reads it. The values are deliberately not
`progress × 7.2 s` (one full turn at 50 °/s): that would have the rotation exactly cancelled by the
progress, so the test would check nothing.

`pixelScale = 2.0` is `short_edge(1080) / REFERENCE_SHORT_EDGE(540)`: pixel-unit parameters in the recipe
(`corner.radiusPx` of `rounded`) are converted using the length convention fixed in P0, identical word for
word to `strokeWidth` / `cornerRadius` / `lower_element_effects`.

## Converting between vector and shader

The reference shader computes alpha per pixel; the vector side has no "half pixel". Therefore:

- Colour and geometry edges are drawn on the half-coverage iso-line where `factor == 0.5` (the module
  docs of `ccut_render::source::kernel` give the closed-form inverse);
- Pure anti-aliasing parameters (`intervalPx` / `insetRatio` / `alphaEdge` / `featherPx` /
  `edgeFeatherPx`, and `smoothing` / `boostSteps` of `snake`) are **not read**: vector edges are
  anti-aliased by the rasteriser. The P5 WGSL will use them word for word.
- The per-degree loop of `snake` is replaced by a **closed form of the swept union**
  (`kernel::swept_arc_subpath`): the circle centres are spaced only one-fourteenth of the circle radius
  apart, the superposed field is already saturated inside the union, and the half-coverage iso-line is
  the boundary of the union. `maxIterations` / `angleIncrementDeg` / `startAngleDeg` are still the source
  of truth for the data: they determine the **number of turns and the start/end angles**; the geometry
  itself is no longer drawn circle by circle.

## How later stages plug in

| Stage | New file | Compared against |
| --- | --- | --- |
| P4 | Reuses `expected-draw.json` (`cases.json` gains a `times` column) | `ops` of `snake` / `snake_spin` change from 0 to the real counts |
| P5 | Reuses + `expected-gpu.json` | the four rainbow / strobe styles go live; SSIM / maximum deviation of GPU vs CPU reference (§8.7) |
| P6 | Reuses `expected-draw.json` | the same inputs run in wasm; the instruction streams must be byte-identical |

When adding expected files, **do not touch `cases.json`**: once the input changes, every earlier golden
loses comparability. If new input is really needed, append it at the end so existing numbering stays
unchanged.
