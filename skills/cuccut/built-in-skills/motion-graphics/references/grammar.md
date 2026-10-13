# Motion graphics grammar

Each of the three slots has its own vocabulary. The numbers here come from statistics over a large set of overlay motion graphics; they are defaults, not limits. The user's style notes take precedence.

## 1. Motion verbs (motion)

Each verb = 1–2 properties + one easing + one time window. The form is fixed: `prop: (1 - p) * amplitude`, `scale: start + (1 - start) * p`, `rotate: (1 - p) * angle`, `opacity: p`, where `p` is the eased progress.

| Verb | Properties and form | Easing | Amplitude | Window |
| --- | --- | --- | --- | --- |
| slide | `x` or `y` from the amplitude to 0, with `opacity` | easeOut | element 30–120 px; off-frame panel 340–560 px | 0.57–0.7 s |
| rise | `y` from a positive value to 0 + `opacity` | easeOut | 32–100 px | 0.5–0.6 s |
| pop | `scale` from the start value to 1, optionally with `rotate` | backOut | start 0.2–0.45; angle −10° to −25° | 0.5–0.6 s |
| settle | container-level `scale` from the start value to 1 + `opacity` | easeOut | start 0.88–0.95 | 0.5–0.7 s |
| lock | the logo or core element that enters last: `scale` 0.2→1 with a small rotate | backOut | angle ≤ 10° | 0.5–0.6 s |
| stagger | same verb on elements of the same kind, with increasing start times | same as the element | 0.1–0.3 s between neighbors | 3–4 items |
| draw | `path(id, p)`, SVG element with `data-length` | easeInOut | — | 0.6–1.0 s |
| unfold / reveal | `clip` 0→1, or `scaleY` 0→1 (transform-origin at the top) | easeOut | — | 0.5–0.7 s |
| sweep / underline | `scaleX` 0→1 (transform-origin at the left) | easeInOut | — | 0.5–0.8 s |
| count | `text(id, format(target × p))`, fixed digit count, unit does not move | easeOut | — | 1.0–1.6 s |
| pulse | during the hold, multiply `scale` by `1 + 0.02 * Math.sin(range(time, a, b) * 2π)` | linear | ±2% | one cycle of 1.2–1.3 s |
| travel | `x` interpolated linearly, add `Math.sin(p * π) * arcHeight` to `y` to follow an arc; elements on a progress bar follow with `style(id, 'left', 'calc(…)')` | easeInOut | arc height 30–90 px | 0.8–1.2 s |
| highlight / active | the current item switches to the accent color, gets an outline or `scale` 1.05, following the current stagger index | — | — | in sync with the stagger |
| fade / crossfade | `opacity` only | easeInOut | — | 0.3–0.5 s |

Rules:

- An element's entrance combines only 1–2 properties (`x + opacity`, `scale + rotate`); never slide and pop at the same time.
- Movement uses easeOut, pops use backOut, draws, sweeps and exits use easeInOut.
- The scaffold handles the exit for everything (the whole `#scene` fades out); do not write an exit for individual elements. When one element must leave earlier, use an opacity of `1 - range(...)`.
- When you need a sense of randomness (particles, scatter), use a fixed-seed pseudo-random generator (for example mulberry32), never `Math.random`.

## 2. Time envelope

Default total duration 4 s, 30 fps.

| Item | Rule |
| --- | --- |
| First element starts | 0.02–0.05 s |
| Single-element window | 0.5–0.8 s (draw 0.6–1.0 s, count 1.0–1.6 s) |
| Stagger | start times of neighboring elements differ by 0.1–0.4 s |
| Element count | 2–6 time windows per graphic; lists 3–4 items |
| Entrance end | the last entrance ends before the halfway point (≤ 2.2 s at 4 s) |
| Hold | from the end of the entrance to the start of the exit ≥ 1.2 s; with full-sentence copy ≥ 2 s |
| Unified exit | from 0.62 s to 0.05 s before the end, easeInOut |

When the duration is not 4 s: the exit stays pinned to the end; the entrance section scales proportionally from the 4 s version, but no single window is shorter than 0.3 s or longer than 0.8 s; the hold takes the remaining time. Graphics with continuous motion (counting to the end, a marquee) add `data-motion-continuous="true"` to the root element, and the hold check becomes a manual review.

## 3. Structure roles (structure)

- Role words: mark (logo, icon), headline, label, card, rail (bar, track), node, badge, chip, pill, note, divider, track (progress track), state (status text), anchor, cursor, token (the emphasized word).
- Counts: 2–6 animated elements per graphic; lists 3–4 items; comparisons 2 items.
- Copy: one primary line `data-copy-primary`, one secondary line `data-copy-secondary`; the rest is fixed decorative text. Text containers get `class="copy"`.
- Common combinations:

| Combination | Use |
| --- | --- |
| mark + headline + tagline | brand sting, end card |
| name + role + org | lower third |
| value + unit + takeaway | big number |
| label + track + state | progress, countdown |
| headline + items[3–4] + active | list, steps, key points |
| anchor + line + label | callout, pointer |
| quote + source | quote |
| kicker + headline + summary | title card |

## 4. Position families and safe areas (layout)

| Position family | Where | Typical categories |
| --- | --- | --- |
| lower-safe | inside the bottom safe area, left-aligned or centered | lower third, keyword caption |
| centered | a card or large text in the middle of the frame | big number, quote, title |
| top-rail | a bar across the top | news ticker, chapter |
| side-rail | a column on the left or right | list, chat feed |
| split | two columns or two rows | comparison, pricing |
| grid / cluster | a group of cards | multiple metrics |
| radial | one in the center, several around it | features around a core |
| corner | one corner | logo, badge, watermark |
| full-frame-transparent | scattered across the frame with the center left empty | celebration, particles |

Safe areas (element bounding boxes must not cross them):

| Aspect ratio | Left/right | Top | Bottom |
| --- | --- | --- | --- |
| 16:9 (1920×1080) | ≥ 70 px | ≥ 100 px | ≥ 100 px |
| 9:16 (1080×1920) | ≥ 60 px | ≥ 180 px | ≥ 230 px |
| 1:1 (1080×1080) | ≥ 60 px | ≥ 100 px | ≥ 160 px |

Font sizes: captions 15–18 px, secondary 20–24 px, main headline 42 px, big numbers and poster-style titles 68–80 px. Copy containers have `max-width`, `overflow:hidden` and `text-overflow:ellipsis`.

A vertical reflow changes only the layout slot: turn horizontal grids vertical (`1fr 320px` → `1fr / 1fr 190px`), card width ≈ canvas width − 2×margin (about 920–960 px at 9:16), text blocks `left:0; right:0` and top-aligned, bottom elements moved up above the bottom margin; the structure and motion slots stay unchanged.

## 5. Color and skins

Use only three tokens, defined on `#root`: `--ink` (dark, text), `--panel` (light background), `--accent` (emphasis). For translucency use `color-mix(in srgb, var(--ink) N%, transparent)`.

Ready-to-use palettes:

| Name | `--accent` | `--ink` | `--panel` |
| --- | --- | --- | --- |
| Warm orange | `#f0583a` | `#24221f` | `#f9f6ef` |
| Bright yellow | `#ffd43b` | `#1a1714` | `#fff8e6` |
| Cyan | `#2bc4ee` | `#0f2230` | `#eaf7ff` |
| Mint | `#7fe0cf` | `#16212c` | `#f2fbff` |
| Grass green | `#a6ef5e` | `#181612` | `#fdfcf3` |
| Coral | `#ff6252` | `#2a241e` | `#fff8e8` |

Skin = palette + form; the form parameters go in the layout slot:

| Skin | Corner radius | Shadow | Font | Other |
| --- | --- | --- | --- | --- |
| clean (editorial) | 16–18 px | soft shadow or none | system sans-serif | thin dividers, letter-spacing 0.04em |
| bold (poster) | 28 px or more, or 0 | none | large bold type 68–80 px | big color blocks |
| glass (translucent) | 24–28 px | soft shadow | system sans-serif | panel uses color-mix 70–85% |
| brutal (hard-edged) | 0–4 px | hard shadow `6px 6px 0 var(--ink)` | bold | 2–3 px solid outline |
| tech (interface) | 6–10 px | none | monospace `ui-monospace, Menlo, monospace` | thin lines, corner marks, small all-caps text |
| sketch (hand-drawn) | irregular (use SVG paths) | none | system sans-serif | drawn lines, slight rotate of 1–3° |

## 6. Self-check list (matches the lint)

1. The root element (`id="root"`) has `data-composition-id="main"`, `data-start="0"`, `data-width`, `data-height`, `data-fps`, `data-duration`, `data-aspect-ratio`, plus the three descriptive layers `data-structure`, `data-layout`, `data-motion` (short English phrases); the width and height in `<meta name="viewport">` match the root element.
2. `window.__timelines.main` exists and `renderScene(time)` is a pure function: the frame is determined by `time` alone.
3. The unified-exit line is present, starting 0.62 s before the end and ending 0.05 s before it.
4. Every `range(time, a, b)`: a and b use only numbers, `DURATION` and arithmetic (otherwise the lint can only warn); the first a ≥ 0.02; each 0.2 ≤ b − a ≤ 2.0 and stays within 0–duration; the last entrance's b ≤ exit start − 1.2 (except continuous motion). A `range` inside a `Math.sin(...)` / `Math.cos(...)` argument (hold-period motion such as pulse) does not count as an entrance window.
5. No addresses starting with `http://`, `https://` or `//`; no `<script src>`, `<link>`, `@import`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource` or dynamic `import(`.
6. No `Date.now`, `performance.now`, `Math.random` or `new Date(`; `requestAnimationFrame` only inside the timeline's `play()`.
7. `#root` defines `--ink`, `--panel` and `--accent`; a transparent graphic's root has no background color. The whole file is at most 512 KB.
8. At least one `data-copy-primary`; text containers use `.copy`.
9. Frame checks: 0 s, entrance end, hold midpoint, 0.3 s before the end; after swapping in long copy and CJK copy nothing overflows and everything stays inside the safe area.
