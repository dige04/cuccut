# `core/fixtures/confetti/` — conformance fixtures for the confetti element

Output of §4 (the `confetti-v1` closed-form motion kernel) and §9 (test strategy) of [`docs/design/elements/ccut-confetti-element-design.md`](../../../docs/design/elements/ccut-confetti-element-design.md).

In one sentence: **the input is fixed in `cases.json`, and each stage appends its own expected file.**
The current pins are the DrawOp instruction streams of the 10 recipes, with the recipes' default parameters and a fixed seed.

**These files are not hand-written, and must not be edited by hand.**

```bash
cd core
cargo test -p ccut-render --test confetti_draw                # verify (includes the up-to-date gate)
cargo test -p ccut-render --test confetti_draw -- --ignored   # regenerate after confirming
```

The generator is `crates/ccut-render/tests/confetti_draw.rs` itself. The generating side and the consuming side
share the same set of functions, so `the_confetti_fixtures_are_up_to_date` is a real gate: it recomputes everything on the spot and then compares byte by byte.

## Why this is separate from `../progress/`

Confetti has **no material source** and no progress value. The frame is determined entirely by `(recipe, override parameters, seed,
element-local time)`. The random value `c` of particle `i` is always
`splitmix64_unit(seed, i·16 + c)` (the source of truth is `ccut_render::source::confetti::kernel`).
Its input therefore contains no BCS1 and no progress sequence, only a single column of times.

## Layout

| Path | Contents |
| --- | --- |
| `cases.json` | **Input**: six element-local times + canvas + pixel scale factor + seed + 10 style ids |
| `expected-draw.json` | **Golden**: for each of the 10 styles × 6 times, the DrawOp count / path count / fingerprint |

## How the times were chosen

`0.0` is the first wave just born; `1.2` is the resting frame of the catalogue tile (the one used by the App v2 ten-cell grid); `12.0` is beyond every recipe's `lifeSec`, and tests continuous emission and the Nth round of repeated bursts. The instruction stream of each frame is always `ClipPath(element box) + FillPath × N + PopClip`, and an empty frame has 0 instructions. Paths are deduplicated by shape, so `paths ≤ shape count + 1`.

## Cross-checking against the prototype

The prototype `designs/cuccut/app/model-confetti.js` is a JS implementation of the same motion kernel. The same
props and the same t always produce the same particle table. The fingerprints here are the Rust-side serialization of DrawOps, so they cannot be compared directly with the prototype. Cross-checking is done by comparing the particle table item by item (position / rotation / size / opacity).
