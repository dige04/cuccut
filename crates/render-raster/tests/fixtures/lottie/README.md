# `core/fixtures/lottie/` —— Lottie feature census and golden corpus

Prerequisite task for ADR-M11 ([`docs/design/bcf/ccut-motion-render-upgrade-design.md`](../../../docs/design/bcf/ccut-motion-render-upgrade-design.md)
§7 / §14, item 1). The decision is settled: a pure-Rust subset renderer is the primary path (`strict`, emitting DrawOp directly), `dotlottie-rs` (ThorVG) serves as the `visual` escape hatch behind the `lottie-thorvg`
feature, and **skia-safe is not introduced**. But **the subset boundary is drawn by the data**: the first version does not support text layers / effects / expressions / merge paths, and whether this "not supported" holds depends on how much of each appears in real assets.

This directory only contains the census script and three hand-written smoke samples. **The corpus is not in the repository**, and no script downloads it automatically.

## Usage

```bash
python3 core/fixtures/lottie/census.py <corpus-dir> [--json out.json] [--per-file]
```

The script is read-only, makes no network calls, and never writes to the corpus directory. It recursively reads `.json` and `.lottie` files (the latter are zip archives), and walks the entire document tree by **key name** to count features. It does not follow a schema, because bodymovin versions differ in their hierarchy, and missing one level would undercount, and undercounting is the one mistake this census must not make.

The output is a "feature / hit count / percentage" table, plus one criterion: if any of `effects` / `text` / `expressions` / `mergePaths` accounts for ≥ 20%, it prompts a reconsideration of the order of ADR-M11 per the "still open" entry in design §14 (ship ThorVG first, and accept `visual` in the first version).

## How to collect the corpus (manual, one-time)

Design §7 calls for **50–100 free LottieFiles assets**, and sets aside 10–20 of them as goldens (SSIM comparison against ThorVG / skottie reference renders). Collection rules:

1. Take only from the **LottieFiles Free section** (its license allows download and use); record each asset's page URL, author and license statement. **Do not** take Pro assets, and do not crawl the site wholesale.
2. Coverage should be deliberate, not just the attractive ones: take a batch each of loading animations / icon micro-interactions / illustrated narratives / data visualization / brand logos. Feature distributions differ widely between categories, and picking only one category would draw the subset boundary wrong.
3. Place the corpus **outside the repository** (for example `~/lottie-corpus/`) and point the script there. The assets themselves are **not committed**: their licenses vary, and tens of megabytes of third-party art should not go into git.
4. The 10–20 chosen as goldens are listed separately in a manifest (file name → source URL → author → license). The **manifest** is committed with the subset renderer's PR, still not the assets. Assets whose license requires attribution have that attribution recorded in this manifest.

## `samples/` are smoke inputs, not corpus

Three hand-written, minimal bodymovin documents, only meant to verify that the script recognises what it should:

| File | Deliberately includes |
| --- | --- |
| `shapes-only.json` | Only shape layers + keyframed rotation — should **not** hit any "not built in the first version" feature |
| `gradient-matte-precomp.json` | Gradients, track mattes (`td`/`tt`), layer masks, precomps, time remapping, non-normal blend modes, markers |
| `text-effects-expression.json` | Text layers, `ef` effects, expressions (`x` strings), bitmap assets, `mm` merge paths, repeaters, trim, rounded corners, `ao` |

Percentages from running on the 3-file smoke set are meaningless ("1/3 = 33%" would trigger the ≥20% criterion); the set only confirms classification is correct: `shapes-only.json` must hit only `shapes`.

```bash
$ python3 core/fixtures/lottie/census.py core/fixtures/lottie/samples --per-file
  gradient-matte-precomp.json: blendModes, gradients, markers, masks, mattes, precomps, shapes, solids, timeRemap
  shapes-only.json: shapes
  text-effects-expression.json: autoOrient, effects, expressions, images, mergePaths, repeaters, roundedCorners, shapes, text, trimPaths
```

## 2026-08-20 census results (100 LottieFiles Free assets)

Collected 100 free assets following the procedure above (20 each for loading / icon micro-interactions / illustrated narratives / data visualization / brand logos), fetched one by one via the official public GraphQL API; the source manifest is `manifest.json` in the corpus directory. The corpus itself is at `~/lottie-corpus/` and is not in the repository. Raw percentages: shapes 88%, precomps 39%, trimPaths 36%, images 27%, **effects 21%** (the only one to trigger the ≥20% criterion), mattes 18%, mergePaths 17%, masks 16%, expressions 12%, text 10%.

Following the criterion, ADR-M11 was reconsidered. The conclusion is **keep the subset-first approach and fine-tune the subset boundary**. Raw percentages are misleading; the refined statistics (the script now outputs them too) tell the real story:

- 84% of mergePaths instances are `mm=1` (plain concatenation, no boolean operation needed) → **included in the first version**; boolean modes (mm=2/3/4) block only 4 files, so they stay unsupported.
- The largest share of effects is `ty=5` controller groups (13 files) — without expressions they are dead data → **ignored with a warning**, not a failure; real raster effects (fill/blur/stroke/drop-shadow) block only 9 files, so they stay unsupported.
- With the crude boundary, strict can fully render 60% of the corpus; with the refined boundary, **70%**. The remaining hard blockers (raster effects 14%, text 10%, expressions 12% — the last one inherently conflicts with determinism) are handled by fail-fast `lottie-unsupported-feature` and the `lottie-thorvg` escape hatch (added on demand).

Twelve goldens were selected (see [`golden-corpus.json`](golden-corpus.json): file name → source page → author → license → covered features). All five categories are represented, covering every subset feature plus one file dedicated to testing the "ty=5 ignored + warning" path. The assets are still not committed; tests point to the corpus directory via `CCUT_LOTTIE_CORPUS`.

## What is in this directory

| Path | Contents |
| --- | --- |
| `census.py` | Feature census script (read-only, no network) |
| `samples/` | Three hand-written smoke samples, only to verify the script recognises what it should (see above) |
| `cases/` | **Always-on fixtures for the subset renderer**: seven minimal bodymovin documents, each targeting one group of features — shape primitives / gradients / trim+rounded corners+`mm=1` / masks and the four track-matte types / precomps+time remapping+solid+null parenting+blend modes / dashed strokes and line caps / embedded images |
| `cases-golden.json` | **Byte-level golden** of the DrawOps for `cases/`. `drawOpFingerprint` is the criterion (FNV-1a of the BCOP encoded bytes); the text disassembly next to it only exists to make diffs readable |
| `golden-corpus.json` | Manifest of the 12 golden corpus assets (file name → source page → author → license → covered features). **The assets are not in the repository** |
| `golden-frames.json` | DrawOp fingerprints of those 12 assets at five fixed sample points |
| `corpus-coverage.json` | Classification of the whole corpus (100 assets) under the refined subset boundary: fully renderable / blocked by fail-fast (with reasons) / within the subset but missing external sub-resources on this machine |

## Running the tests

The always-on part does not need the corpus:

```bash
cd core && cargo test -p ccut-render --test lottie_source
```

The corpus gate needs an environment variable to locate the corpus; if the corpus is missing, the whole gate is skipped (not failed):

```bash
cd core && CCUT_LOTTIE_CORPUS=~/lottie-corpus cargo test -p ccut-render --test lottie_corpus
```

Both follow the `CCUT_UPDATE_GOLDEN=1` convention for regenerating goldens.

## Already done

The subset renderer (`core/crates/ccut-render/src/source/lottie/`) **has landed**: serde_json parsing → keyframe evaluation → direct DrawOp emission, at level `strict`. `AssetKind::Lottie`, the `lottie` element (spec §6.5.2) and the `lottie-unsupported-feature` diagnostic code are all in the spec and the implementation.

Measured coverage matches the census forecast: **70/100** (64 fully renderable + 6 within the subset but missing external images). The 30 blocked assets break down as raster effects 12 / text layers 8 / expressions 5 / boolean merge 3 / mask feathering 1 / non-add mask mode 1.

## Still to do

- **The `lottie-thorvg` escape hatch is still not introduced**: it stays "add on demand". Only when users really need text or raster effects would `dotlottie-rs` be added behind a cargo feature, handled at the `visual` level (the ThorVG version goes into the content fingerprint).
- `.lottie` (zip packages) is not accepted: unpack it first, then declare the bodymovin JSON and the image directory.
- Lottie `replacements` (run-time replacement of text / images / colours inside an asset, spec §23 item 2) are not implemented. They either depend on text layers (not supported in this version) or amount to an asset remapping layer; to be decided once there is a real use case.
- Known approximations within the subset boundary: mask `inv` (inverting a single mask shape) and multi-mask blend modes are not implemented; stroke width under non-uniform scaling follows tiny-skia's single-scalar semantics (AE is itself an approximation); arc length for trim / dashes is sampled with a fixed 32 segments, which differs from AE at the sub-pixel level.
