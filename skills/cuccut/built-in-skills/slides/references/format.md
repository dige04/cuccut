# Slide format

This page is the complete way to write a slide file: which tags, attributes and styles are allowed, and their limits. Anything not listed here is dropped or rejected when the editor loads it, and validation lists each case; a slide with errors can only be viewed in the editor, not edited.

## 1. Slide file

- `slides/<id>.html` contains exactly one `<section>` and nothing before or after it: no `<!doctype>`, `<html>`, `<head>`, `<body>`, and no `<title>`, `<link>`, `<style>`, `<meta>` or `<script>`.
- The canvas is fixed at 1920×1080 pixels; all coordinates and sizes are relative to it.
- Attributes allowed on `<section>`:
  - `id`: the same as the file name (letters, digits, `-`, `_`, at most 64 characters).
  - `style`: covers only four things: the background (`background`, a solid color or `linear-gradient(…)`); slide-wide text defaults (`font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `text-align`, `text-transform`, `white-space`, `color`); the layout (`display:flex` or `display:grid`, plus `flex-direction`, `gap`, `align-items`, `justify-content`, `grid-template-columns`); and `padding`. Borders, corner radii, shadows, opacity, transforms, width/height and positioning cannot go on `<section>`.
  - `data-transition`: the transition when entering this slide: `fade`, `push` or `magic`.
  - `hidden`: skip this slide during the show.
- Any other attribute is dropped. Sections go in `sections` in `deck.json`, not on the slides.

## 2. Flow and pinned

- Children without `position:absolute` are **in flow**: they are laid out one after another by the `<section>`'s layout and padding, with no coordinates to compute.
- Children with `position:absolute` are **pinned**: placed in canvas coordinates with `left`, `top`, `right`, `bottom`, `width`, `height`. Coordinates cannot be negative; if you set both edges in one direction (such as `left` and `right`), do not also set the size in that direction.
- Stacking order is source order: later elements cover earlier ones, and there is no `z-index`. A full-slide background image is written as the first child.
- Inside a `<div>` with `position:relative`, pinned children are positioned relative to that `<div>`.
- `id`, `data-build-in` and `data-build-out` work only on elements pinned directly under `<section>`; on flow elements they are dropped.

```html
<section id="quote" data-transition="fade" style="background:#1c1d21;color:#f4f1ea;font-family:'Source Sans 3', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:center">
  <p style="font-size:64px;font-weight:600;line-height:1.2">Half of editing time goes into finding footage.</p>
  <p id="source" data-build-in="fade 1" style="position:absolute;left:128px;bottom:96px;width:900px;font-size:28px;color:#a8a39a">— From interviews with 30 editors</p>
</section>
```

## 3. Tags

| Tag | Use and rules |
| --- | --- |
| `<h1>` `<h2>` `<h3>` | Headings. There is no `<h4>`–`<h6>`; for smaller headings use a bold `<p>`. |
| `<p>` | Paragraph. |
| `<ul>` `<ol>` `<li>` | Lists, one level only (nested lists are flattened). `<li>` holds only text and inline tags; styles go on `<ul>` or `<ol>`, and `style` on `<li>` is dropped; indent bullets with `padding-left`. |
| `<b>` `<i>` `<u>` `<a href>` `<span style>` `<br>` | Inline: bold, italic, underline, link, local style, line break. |
| `<div>` | Container that lays out children with flex or grid, nested at most 15 levels. An empty `<div>` with no content and no background is removed; to use one as a spacer, give it `flex:1`. |
| `<img>` | Image, see section 5. |
| `<svg>` | Inline vector graphic, see section 5. |
| `<table>` `<tr>` `<th>` `<td>` | Table, see section 6. |
| `<hr>` | A line: `border-top:2px solid #…`, or `background` plus `height` (1–32px) as the line width; dashed lines are not supported. |
| `<x-shape kind="…">` | Shape, see section 7. |
| `<x-icon name="…">` | Built-in icon, see section 7. |
| `<x-connector>` | Lines and arrows, see section 7. |
| `<aside>` | Speaker notes: a direct child of `<section>`, plain text (a `style` on it has no effect), up to 4000 characters, conventionally written last. |

- All other tags (`<h4>`–`<h6>`, `<blockquote>`, `<figure>`, `<pre>`, `<header>`, `<footer>`, `<nav>`, `<main>`, `<article>` and so on) are errors. The format also has `<video>` and `<x-embed>`, which are not used in CucCut.
- `class`, `title`, `role`, `aria-*`, `lang` and any `data-*` not mentioned above are dropped from elements.

## 4. Styles

- Only in the `style` attribute; every text element sets its own `font-size` (8–400px).
- Lengths in px. `%` is meaningful only on pinned elements, cell widths and flex-direction shares; do not use `em`, `rem`, `vw`, `calc()` or `var()`.
- Colors may be hex, `rgb()`, `rgba()`, `hsl()` or color names; using hex throughout the deck is easiest to manage.
- Spacing uses the parent's `gap` and `padding`, not `margin` (except `margin:0`); to push a block to the bottom, use `justify-content` or an empty `<div>` with `flex:1`.
- Available decoration: `border` (including single sides such as `border-left`), `border-radius`, `box-shadow`, `opacity`, `text-shadow`, `linear-gradient(…)` backgrounds, and `transform:rotate(…)` on pinned elements.
- Text: `font-family`, `font-size`, `font-weight`, `font-style`, `line-height` (multiplier or px), `letter-spacing`, `text-align`, `text-transform`, `text-decoration`, `white-space`, `color`.
- Not supported: `float`, `z-index`, `object-position`, `background-image:url(…)` (for a background image use an `<img>` pinned to fill the slide), `border-collapse`.
- `<h1>`–`<h3>`, `<p>`, `<ul>`, `<ol>` and `<table>` accept `data-fit`: the default is `shrink`, which shrinks the text when it does not fit, down to at most 60%; `none` means no shrinking, so it overflows when it does not fit.

## 5. Images and vector graphics

- `<img src>` accepts only two kinds of address: `/_blob/<id>` from importing into the deck; or a png, jpeg, gif, webp, avif or svg `data:` URL of at most 70 KB (only suitable for very small logos; write `#` inside SVG as `%23`). Web addresses, relative paths and absolute paths are errors.
- Write `alt` (at most 500 characters), and width/height in px.
- When the image is not available yet, you can write only `alt` and width/height without `src` as a placeholder image frame: it holds the place, and the user selects it in the editor to add the image (see "Placeholder image frames" in `references/images.md`).
- `object-fit:cover` (the default; crops the excess to fill the frame) or `contain` (shows the whole image). A cover image can be zoomed and given a focus with `data-crop="<zoom> X% Y%"`, zoom 1–50, for example `data-crop="1.5 50% 30%"`.
- `<svg>` is written directly in the slide: exactly one `<svg>` root element, source no more than about 70 KB; write `width` and `height` (with only `viewBox` it is treated as 400px wide); no `<script>`, `<foreignObject>`, event attributes such as `onclick`, or external `href` or `url(…)`. `aria-label` serves as alt text. The SVG as a whole is treated as an image: its `<text>` cannot be edited in the editor and does not use the deck's fonts, so put text outside the SVG. Write special characters in SVG directly, or as numeric references (`&#8212;`) and `&amp;`, `&lt;`, `&gt;`, `&quot;`; do not use HTML entities such as `&nbsp;`.

```html
<img src="/_blob/0f3a…" alt="Screenshot of the new timeline" style="position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:cover" data-crop="1.2 50% 40%">
```

## 6. Tables

- Write `<tr>` directly inside `<table>` (wrapping in `<thead>`, `<tbody>` also works), with the same number of cells in every row; `colspan` and `rowspan` are not supported: to merge, split the table or repeat the text.
- Cells hold only text and inline tags, no images (they are removed).
- Font size, color and width go on `<table>`; `<th>` and `<td>` accept only `text-align`, `width`, `color` and `padding`, and `<th>` also `font-weight`. Cells cannot have backgrounds or borders; the table draws its own thin rules. To emphasize a cell, change its color or make it bold.
- At most 4000 cells per slide and 40000 per deck; with a lot of data, split across slides or keep only the conclusion.

```html
<table style="font-size:28px;color:#22252b;width:1200px">
  <tr><th style="text-align:left">Channel</th><th style="text-align:right">New users</th><th style="text-align:right">QoQ</th></tr>
  <tr><td>Search</td><td style="text-align:right">12,400</td><td style="text-align:right;color:#15803d">+38%</td></tr>
  <tr><td>Social</td><td style="text-align:right">8,900</td><td style="text-align:right;color:#b91c1c">−6%</td></tr>
</table>
```

## 7. Shapes, icons and connectors

- `<x-shape kind="…">`: `rect`, `rounded` (rounded rectangle), `ellipse`, `diamond`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `line`. No content inside; `background` is the fill (solid colors only), `border` the stroke; when pinned, set both `width` and `height`; `transform` accepts only `rotate(…)`. To put text on a shape, add a `<p>` pinned at the same position.
- `<x-icon name="…">`: built-in icons, names case-insensitive: Activity, Book, Chart, Chat, Check, CheckCircle, Clock, Cloud, Code, Database, Globe, GraduationCap, Home, Key, Lightbulb, Lightning, Link, Lock, PaperPlane, Play, Search, Settings, Star, ThumbsUp, Tool, Trust, Users, Verified, Warning, Wrench. `width` and `height` in px (only one makes a square), `color` sets the color. Names not in the list render as text. Symbols missing from the font (✓ ✗ ★ ☐ and the like) fall back to a system font: for a check mark use `<x-icon name="Check">`, and for "none" write a word or a −.
- `<x-connector>`: straight lines, elbow lines and arrows. When pinned on the canvas, set all of `x1`, `y1`, `x2`, `y2` (px numbers; inside a `position:relative` `<div>` percentages also work).
  - `head`: `end` (arrow at the end, the default), `both`, `none`; or set `head-start` and `head-end` separately: `none`, `open`, `filled`.
  - `route`: `straight`, `elbow`, `hv` (horizontal then vertical), `vh` (vertical then horizontal).
  - Line width, style and color use `border` (`solid`, `dashed`, `dotted`).

```html
<x-shape kind="rounded" style="position:absolute;left:160px;top:420px;width:360px;height:160px;background:#ffffff;border:2px solid #22252b"></x-shape>
<p style="position:absolute;left:160px;top:470px;width:360px;font-size:32px;text-align:center">Import footage</p>
<x-connector x1="540" y1="500" x2="760" y2="500" head="end" style="border:3px solid #c2410c"></x-connector>
<x-icon name="lightbulb" style="position:absolute;left:800px;top:452px;width:96px;color:#c2410c"></x-icon>
```

## 8. Animation

- Slide transitions: `<section data-transition="fade">`, see section 1.
- Elements appearing one by one: write `data-build-in="<effect> <order>"` on a pinned element, and `data-build-out` for leaving. Effects are `fade`, `rise`, `drop`, `left`, `right`, `scale`, `pop`; the order is an integer 1–50, source order when omitted; a step ending in `auto` does not wait for a click and appears right after the previous step.

## 9. Fonts

- Every web font and font file used on the slides must be registered in `faces` in `deck.json`: the key is a short name of your choice, the value is `{ "family": "…", "href": "…" }` or `{ "family": "…", "src": "…" }`, with only one of `href` and `src`.
- `family` starts with a Latin letter, contains only letters, digits, spaces, `-` and `_`, is at most 40 characters, and matches what is written in `font-family` exactly.
- `href` can only be a Google Fonts css2 address (`https://fonts.googleapis.com/css2?family=…`), at most 1024 characters, with every weight you use included.
- `src` is the address of a font file in the deck, written verbatim; never a `data:` URL, web address or relative path. A static font file with only one weight shows every weight as that one: prefer a variable font file, or use only the most common weight.
- Import font files (woff2, woff, ttf, otf) one by one with `slides_import_asset` and set `src` to the returned `/_blob/<id>`; for any that cannot be imported, use Google Fonts or a system font and say so at delivery.
- A deck registers at most 4 fonts. System fonts (Arial, Georgia, Courier New, PingFang SC, Microsoft YaHei and the like) need no registration; put them at the end of the font stack as fallbacks, ending with `sans-serif` or `serif`.
- For Chinese you can use `Noto Sans SC` or `Noto Serif SC`; Japanese and Korean each have matching Noto fonts.

## 10. Limits

- At most 200 elements per slide (every tag counts); anything beyond is dropped.
- A text element holds at most 20000 characters and 100 inline styles.
- At most 500 slides per deck.
