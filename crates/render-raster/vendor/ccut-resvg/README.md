# ccut-resvg

[resvg](https://github.com/linebender/resvg) **0.45.1** (crates.io release, Apache-2.0 OR MIT; the license texts are in `LICENSE-APACHE` / `LICENSE-MIT` in the same directory), plus six CucCut patches: four fix correctness, and two only speed things up with byte-identical output. The package is renamed to `ccut-resvg`, while the library name stays `resvg`. Only `ccut-render` references it, as `resvg = { package = "ccut-resvg", … }`, so call sites keep writing `resvg::…`. It does not use `[patch.crates-io]`, because the GPUI in `apps/cuccut` uses resvg 0.46, and swapping the package globally would affect it.

The upstream command-line program (`src/main.rs`) and examples, together with the `pico-args` dependency used only by them, have been removed. The rest of the source is kept verbatim.

## Patches

Run `diff -r ~/.cargo/registry/src/*/resvg-0.45.1/src src` to see all changes. Each one carries a `ccut-resvg:` comment.

| Location | What changed | Why |
| --- | --- | --- |
| `src/render.rs` `render_group` | When rendering child nodes, the clamp rectangle `max_bbox` is translated into the current layer's pixel coordinates (`translate(-ibbox.x, -ibbox.y)`), and `mask::apply` also uses the translated copy | Upstream passed a rectangle in canvas coordinates unchanged into nested layers. The farther a layer is from the canvas origin, the more it gets cropped: an inner layer ends up smaller than its filter region, and `feDisplacementMap` asserts that the source, displacement map and target have the same size, so it panics. Frames that do not panic still lose a strip at the edge of the image (measured: the right edge of a `program` element lost 32 px to black in one frame) |
| `src/render.rs` `layer_clamp_rect`, `src/lib.rs` | The clamp rectangle is reduced from the canvas −2W..3W (5×) to a quarter of the long side on each edge | A layer at 5× the canvas costs 25× the visible area in memory and blur time. Pixels further out can only reach the frame through a filter whose displacement exceeds this margin. Measured output at 1/8×, 1/2× and 2× is byte-identical |
| `src/filter/mod.rs` `apply_inner` | When the filter region does not match the layer size, the layer's full `(0, 0, w, h)` is used instead | After a layer is clamped, or off by one pixel from rounding, the primitives receive images of different sizes. Unifying on the layer size means every primitive operates on the same image |
| `src/filter/mod.rs` `apply_displacement_map` | Only the canvas scale is passed to `displacement_map::apply` (which multiplies by `scale` itself); the displacement map is un-premultiplied before its channels are read | Upstream passed `scale × canvas scale`, so `scale` was effectively squared: `scale="30"` moved pixels by up to 450 px instead of 15 px, and smoke or fire was torn into fragments skewed toward the bottom right. Upstream also read channels from a premultiplied displacement map (the spec and the function's own comments require non-premultiplied), so semi-transparent noise from `feTurbulence` shifted every pixel toward the top left. 0.46.0 has the same two issues |
| `src/filter/iir_blur.rs` | Four channels are interleaved into one `[f64; 4]` buffer and processed together; the vertical pass changed from column by column to scanning all columns row by row | Upstream accessed memory channel by channel and column by column across rows, so almost every sample missed the cache. A blur with σ < 2 was the heaviest item in a `program` element frame. Channels and columns never read each other, and each value goes through the same operations in the same order, so the output is bit-for-bit identical |
| `src/filter/box_blur.rs` `box_blur_vert` | The vertical sliding window changed from column by column to one integer accumulator per column, advancing row by row | Same cross-row access problem as above. With zero padding on both sides, each output is the integer sum of the rows currently in the window. Integer sums do not depend on summation order, so the result is bit-for-bit identical |

## Verification

`cargo test -p ccut-resvg` (run from `core/`):

- Ordinary documents (without filters, with in-canvas filters, masks, clipping, and transparent groups, and including Gaussian blur on both the IIR and box-blur paths, with box radius larger than the region height; no `feDisplacementMap`) are byte-identical to upstream 0.45.1;
- Content from nested transparent groups that extends in from outside the canvas is no longer clipped;
- A `feTurbulence` + `feDisplacementMap` where the filter region is larger than the layer clamp no longer panics;
- `feDisplacementMap` moves pixels by `scale × (C − 0.5)` (opaque and semi-transparent displacement maps, and groups with scaling), matching Chrome.

When upgrading the upstream version: replace the source, replay each patch in the table above one by one, rerun the three test groups above, and update the version number in this table.
