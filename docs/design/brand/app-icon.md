# CucCut App Icon: Design Rationale

Status: finalized 2026-10-06. For the drawing source and export method, see [`tools/app-icon/`](../../../tools/app-icon/README.md). This document only explains why the icon looks the way it does.

![CucCut App icon](../../../apps/desktop/build/icon.png)The geometry was carried over unchanged from v2 (the v2 design record is at `docs/design/product/ccut-app-icon.md` in the `cuccut-app` repo).

## 1. What it must express

CucCut is the tool for "cutting video and making subtitles with an AI Agent". The icon says only two things:

- **Video editing**: timeline tracks, a clip that has been cut, a play button.
- **AI Agent**: a four-point sparkle, the same four-pointed star as the `ai-sparkle` icon in the interface. Users already read it as the "AI entry point".

Constraints:

- **Simple**: it must be recognizable in a 16 px Finder list.
- **Few colors**: v2 used six clip colors plus gold, and users said it had "too many colors". This version uses **only three colors** across the whole icon.
- **Tile does not change with light or dark mode**: borrowing Adobe's approach, the product icon is a fixed brand-colored tile. It does not change color on a dark Dock, and its own color is the recognition cue. The warm-white tile of v2 became just a white square on a dark Dock.
- **Reproducible**: generated from vector source; each bitmap is rendered at its target size and not downscaled from a large image.

## 2. What the graphic is made of

1. **Play button**: a triangle with three rounded corners; from a distance it reads as a play button.
2. **Three tracks**: three horizontal bars clipped into the triangle, with the tile color showing through as gaps between the bars. "The tracks form a play arrow" is the core idea.
3. **Playhead**: a vertical line placed at 42% of the triangle's width, which cuts each track into a left and a right segment of different shades. This is the "cut". The left side is the segment the playhead has already passed, in a light tint; the right side has not been played yet, in a solid color. This matches the App's convention where subtitles that have already played turn gray. The tile shows on both sides of the playhead, and this gap is also the gap between the two segments.
4. **Sparkle**: mounted at the top of the playhead, so the line and the sparkle read as one magic wand, meaning "AI cuts for you". The sparkle extends above the triangle's upper edge, so its outline does not blur into a blob at small sizes.

## 3. Color

Following Spectrum 2's "one product color, with a dark and a light step": the brand color is the tile, the graphic is white, and the clip segment on the right of the cut uses the light step of the brand color.

| Position | Recommended variant A | Notes |
| --- | --- | --- |
| Tile | Coral `#FF5C4A` | CucCut's brand color. Slightly darker than the v2 arrow tip `#FF6A5A`: the whole tile is this color, and it needs to be a bit deeper to hold up the white graphic |
| Right clip segment (not yet played), playhead, sparkle | White `#FFFFFF` | White clip and AI elements share one color, so the graphic reads as one whole |
| Left clip segment (already played) | Light coral `#FFC1B8` | Differs from the right side only in lightness, enough to show the "cut" without adding a second hue; any lighter and it blends into the tile |

Principles:

- **The whole icon uses only three colors**; no fourth color is added.
- **The left/right difference between segments comes only from lightness**, not hue.
- **No inner shadows and no soft glow.** Only the main drop shadow from the macOS template is kept.
- Both tile variants fall within Spectrum 2's allowance that brand colors may differ slightly from UI tokens. The accent in the interface still follows the design system; the icon does not define UI colors in reverse.

### Alternative variants

| Variant | Composition | Conclusion |
| --- | --- | --- |
| **A Coral tile** | Coral tile, white graphic, light-coral played segment | **Recommended**. Stands out on all three backgrounds (light Dock, dark Dock, wallpaper); at 16 px it is "red block + white block", the easiest to recognize |
| B Dark tile | Near-black tile `#1F1F1F`, white played segment, coral unplayed segment, white AI element | Most restrained on light backgrounds, but on a dark Dock the tile disappears and only the graphic floats; also too similar to Adobe Express's dark background with white letters |
| C Gradient tile | Single-hue vertical gradient from coral to deep coral `#E8381F`, otherwise as A | Has the flavor of Spectrum 2 brand gradients; at small sizes it cannot be told apart from A, and the gradient is only visible at 128 px and above, so the gain is small |

## 4. Shape and size

- **Shape template**: keeps the v2 macOS template. The body is 824×824, placed at (100,100) on a 1024 canvas; continuous corner radius 185.4, smoothing 0.6; shadow black 30%, blur 20, offset down 12. The placeholder in the Dock is unchanged.
- **Center of mass**: in the first draft the triangle's left edge was at 312 and the playhead at 38%, and users said the center of mass was too far left. After visual comparison could not separate the candidates, the choice was made from data: the graphic's (white and light coral) brightness increment relative to the tile is used as the weight, the horizontal centroid is computed, and the target is the tile's center line at 512. The centroid changes almost only with the triangle's left edge position (moving the left edge by 1 moves the centroid by about 1); the playhead between 36% and 46% affects it by only ±2. The centroid of the v2 geometry is at 490, 22 to the left. The final choice is **left edge 332, playhead 42%**, centroid 512. The vertical centroid is at 537, 25 below the center line, which is the natural result of the triangle being heavier than the sparkle. The bounding box of the graphic (sparkle top at 168 to triangle bottom at 836) is itself centered, so it is not adjusted further.
- **Small sizes**: at 16–32 px the track gaps and the playhead merge, leaving "coral block + white play button + white star dot"; at 48 px and above the three tracks and the cut are visible.

## 5. The path taken

| Option | Conclusion |
| --- | --- |
| v2: warm-white tile, six clip colors, gold sparkle and playhead | Too many colors; a warm-white tile does not work on a dark Dock |
| Two-letter wordmark (Adobe Creative Cloud style) | Not adopted: borrows Adobe's principles (single product color, tile that does not change with theme, gradient that does not overpower), but not its wordmark look |
| This version's A / B / C | The user chose A |
| A's center of mass: only shift right by 28, only move the playhead to 44%, only deepen the segment shades | Each solves only half the problem; the final version takes a little from each of the three (shift right 16, 42%, `#FFC1B8`) |
| Light segment on the right, white on the left | Changed to light segment on the left: the left is what the playhead has already passed, which means the same as played subtitles turning gray in the App |
| Geometry chosen by eye | Candidates could no longer be told apart by eye, so the final choice was made by brightness centroid (see §4) |

## 6. How to change it

- The geometry is in `GEOMETRY` in [`tools/app-icon/app-icon.mjs`](../../../tools/app-icon/app-icon.mjs); the colors are in `VARIANTS` (`tile` / `left` / `right` / `mark`).
- After changing, run `npm run icons` from the repo root to regenerate the prototype's `app-icon.svg` and the `icon.png`, `icon.icns` and `icon.ico` under `apps/desktop/build/`. Do not hand-edit generated files.
- Windows `.ico` files carry no template shadow, while the other outputs do; to change this, edit `shadow` in `render.mjs`.
