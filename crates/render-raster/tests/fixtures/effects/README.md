# `core/fixtures/effects/` —— Conformance fixtures for strict effects

Output of §11 "Conformance" in [`docs/design/bcf/ccut-motion-render-upgrade-design.md`](../../../docs/design/bcf/ccut-motion-render-upgrade-design.md). Every `strict` effect must have a set of "reference input + uniforms + byte-for-byte reference output". **The CPU, the future GPU and the Web implementations all run against the same fixtures.** This is the executable form of the rule in ADR-M05 that "the GPU is only an accelerator; if conformance fails, it automatically falls back".

**These files are not hand-written, and must not be edited by hand.**

```bash
cd core
cargo test -p ccut-render --test effects_conformance                      # 校验
CCUT_UPDATE_GOLDEN=1 cargo test -p ccut-render --test effects_conformance # 确认过再重生成
```

## Layout

| Path | Content |
| --- | --- |
| `input-a.png` | Main input, 48×48: high-frequency colour gradient + semi-transparent region + a solid green block (for chroma key) + two transparent corners |
| `input-b.png` | Second input, 48×48: radial luminance ramp (used by `mask.image` / `mask.luma`) |
| `<id>@<ver>/uniforms.json` | Case name → uniform table (cross-checked against `cases()` in the test; change one and the other fails) |
| `<id>@<ver>/expected-<case>.png` | The **byte-for-byte** reference output for this case |
| `<id>@<ver>/expected.json` | Dimensions and output pixel fingerprint, used to give precise failure messages |

The Surface Transition (`transition.*@1`, spec §9) has one extra layer: it takes **two** inputs, with `input-a.png` as `from` and `input-b.png` as `to`, and one set of uniforms paired with a series of progress values.

| Path | Content |
| --- | --- |
| `transition.<name>@<ver>/uniforms.json` | `{ "params": …, "progress": [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1] }` — the sample points are fixed by "Golden frames" in design §11 |
| `transition.<name>@<ver>/expected-p050.png` | Byte-for-byte reference output for `progress = 0.50` (`p000` … `p100`) |

Both inputs are procedurally generated images with **analytically defined values** (see `make_input_a` / `make_input_b` in `effects_conformance.rs`), so they are byte-for-byte identical across machines. The PNGs are written to disk only so that other implementations can read the same bytes directly, not to memorise a random image.

## Units of length parameters

Parameters with `"type": "length"` in the manifest are **a fraction of the canvas short edge** (`basis: canvasShortEdge`), not pixels. With a 48 px short edge, `radius: 3/48` is 3 px. Parameters with `quantize: "round-to-int"` are rounded to an integer after conversion to pixels.

## Coverage guards

`effects_conformance.rs` contains three structural assertions that do not depend on the fixtures; regenerating the golden files does not clear them:

- `every_strict_manifest_has_a_cpu_reference_kernel`: every `strict` manifest's `kernel` is in `IMPLEMENTED_KERNELS`;
- `every_pixel_effect_is_covered_by_conformance`: every pixel kernel has at least one case (`composite.blend` is a table, not a kernel, and is covered by the blend reference test in `tests/raster.rs`);
- `every_conformance_case_names_a_registered_effect`: a case may not reference an unregistered effect;
- `every_surface_transition_is_covered_by_conformance`: every `transition.*` has a case.

There are also `a_zero_radius_blur_is_the_identity` (a zero-parameter blur must be an identity transform) and `cpu_reference_is_bitwise_repeatable` (two runs produce bit-identical results).

The Surface Transition has four more property assertions that do not look at the fixtures (spec §9 / design §11):

- `progress_zero_is_from_and_progress_one_is_to`: the endpoints are **byte-for-byte** equal to the inputs, and this holds for any combination of uniforms;
- `monotonic_progress_yields_distinct_frames`: the output fingerprints of the seven sample points are pairwise distinct;
- `transitions_are_seek_safe`: sampling out of order and in order give byte-for-byte identical results (the transition holds no incremental clock);
- `progress_outside_the_closed_interval_is_refused` / `mismatched_input_sizes_are_refused`: `progress` outside the closed interval is refused, and mismatched input sizes are refused. The closed interval and `resizeMode` are contracts, not suggestions.
