# Slide design

This page covers how to make a deck easy to present, good-looking, and fitting on the slides. The format itself (which tags and styles are allowed) is in `references/format.md`.

## 1. Set the direction first

Decide once before writing, and keep it for the whole deck:

- **Occasion and audience**. Internal weekly meeting, external pitch, classroom, product launch: information density and tone all differ. For people who know the subject you can be denser; for strangers, put only one conclusion on a slide.
- **Presented or read**. When someone presents on stage, the slides are prompts and evidence: few words, large images. When no one presents and the deck is sent out to be read, the slides must explain themselves; sentences can be more complete, but it is still one thing per slide.
- **Visual direction**. Find a direction in the content: financial reports lean restrained (light background, one accent color, large numbers), product launches lean bold (dark background, large images, strong contrast), teaching leans clear (light background, many diagrams, obvious hierarchy). The direction sets layout, fonts and colors; do not change it slide by slide on a whim.

## 2. Colors

- One dark and one light background, plus one or two accent colors, all written as hex. Use only these colors and a few tints and shades of them across the deck.
- Do not use pure white `#ffffff` or pure black `#000000` for large backgrounds; slightly tinted whites and blacks (such as `#f7f5f0`, `#1c1d21`) wear better; cards can be one step lighter than the background.
- Contrast between body text and background is at least 4.5:1, and at least 3:1 for large text of 44px or more. Gray text on light backgrounds is most often too faint; err on the darker side.
- Colors that must be told apart (two lines in a chart, two states) also differ in lightness, not just hue; avoid distinguishing only by red and green; blue and orange are safer.
- Color never carries meaning alone: for status, good or bad, or a highlighted cell, say it in the text too ("+4%, above plan", "high risk").
- Every slide sets `background`. Alternate the two backgrounds across the deck for rhythm, and occasionally fill a whole slide with the accent color for a key-line or section slide.
- When the user gives brand colors or explicit color requirements, use them; the proportions above give way to the user's requirements. With a design system the colors come from it (`references/design-system.md`), and this section only governs contrast and not using color alone for meaning.

## 3. Fonts and font sizes

- One to three fonts: one for titles, one for body text, and at most one more monospace or decorative font. On slides with CJK text, `font-family` must include a font that can display those characters (a web font or a system font) and end with a generic family.
- With a design system, fonts come from its font stacks, and the recommendations below do not apply.
- Choose fonts by direction rather than using the same set every time: for Chinese body text `Noto Sans SC` is common, and formal or humanist titles can use `Noto Serif SC`; for Latin text choose Google Fonts such as `DM Sans`, `IBM Plex Sans` (technical), `Source Serif 4`, `EB Garamond` (academic, humanist) or `Oswald` (bold short titles).
- Every web font used and every imported font file must be registered in `faces` in `deck.json` (see "Fonts" in `references/format.md`); also put a common system font (Arial, Georgia, Courier New and the like) in the font stack as a fallback when exporting to other software.
- One type scale of four to five steps used across the deck, for example: title 72, subtitle 44, body 32, notes 24, with big numbers at 120–200. Emphasize with weight, italics or color, not an extra size.
- A small label line can go above the title to mark which part of the deck the slide belongs to: 24–28px, accent color, Latin text in all caps with a little letter spacing.
- When the user gives sizes in points (pt), multiply by 2 for px: 36pt is 72px.
- Body text is at least 24px; for projection in a meeting room, 28px or more is safer. Small text such as notes and sources is also at least 24px.
- Line height: titles around 1.1, body text 1.3–1.5.

## 4. One thing per slide

- Each slide makes one conclusion. By default the title states the conclusion ("New users doubled"), not the topic ("User growth"); for topic-organized material such as lessons or manuals, or when the user wants topic titles, write the topic. Either way, all titles use the same sentence form, and read in sequence they form the outline of the deck.
- Avoid bullet lists when you can: turn parallel items into a row of cards, a table or a few big numbers; if one sentence says it, put only that sentence, with an image.
- When you must list points, use no more than 5, one line each, in parallel form.
- Numbers need a source: write it in the footer or make it clear in the speaker notes. Numbers without a source are written as `[TBD: …]`, worded in the deck's language.
- Do not write contrived reversals like "It's not A, it's B", and do not pile up adjectives.
- Do not add filler: when the layout looks empty, adjust the layout instead of inventing extra paragraphs, numbers or icons to fill it; if you think another slide or paragraph is needed, ask the user first.
- Avoid the telltale generated look: large gradient backgrounds, emoji, rounded cards with an accent-colored bar on the left.

## 5. Layout and whitespace

- Content area: 128px margins on all sides, leaving 1664×824. A footer (page number, source, logo) holds only one line of 24px text pinned at `bottom:64px`; that slide's bottom padding becomes 160px (`padding:128px 128px 160px`), and no other content goes below y=920.
- Slides of the same kind share one structure: the title always sits at the same top-left position, not centered with the content, so it does not jump when changing slides.
- Content fills about 70% of the content area. With little content, use `justify-content:space-between` to spread the title and the conclusion apart, or an empty `flex:1` `<div>` as a spacer; do not leave a small block floating alone in the middle.
- Adjacent boxes either share one edge (remove `border-top` from the later one) or have a gap between them; never let two lines sit on top of each other.
- Alignment: elements on a slide align their left edges to the same line; cards in a row have equal width and height.
- Width: body sentences sit in a column 800–1000px wide (`width:960px`, or a `flex:1` column beside an image), not across the full 1664px; one line of large text (key line, conclusion) is no wider than about 1400px.
- When several columns sit side by side and each has the same rows (three options, each with a label, description and card), write them row by row in one `display:grid` so the rows line up across columns; do not write three columns that each stack downward on their own.

### Estimate heights to make sure it fits

When content does not fit, the editor shrinks the text in the box automatically (down to at most 60%, then it overflows), and the shrunk sizes fall off the type scale and vary from slide to slide. Estimate as below before writing; if it is over, cut words or split into two slides rather than relying on smaller sizes; the `layout` notes from validation also point out which boxes do not fit:

- Height of one line ≈ font size × line height. Title 72px, line height 1.1, two lines ≈ 160px.
- Characters per line: CJK ≈ width ÷ font size; Latin ≈ width ÷ (0.55 × font size). Content area 1664px, body 32px: about 52 CJK characters or 95 Latin letters per line.
- Card height = lines × font size × line height + top and bottom padding; do not hard-code a card `height` smaller than that; leave the height unset so it follows the content.
- One table row ≈ 2.1 × font size × lines of text.
- Latin text wraps only at spaces: a long word wider than its box gets cut off, so a box must be at least as wide as its longest word.
- Add up the block heights and the `gap`s between them, and compare with 824px (792px with a footer).

## 6. Images and charts

- For where images come from, which slides get them, and how to draw illustrations with an image generation model, see `references/images.md`. Every image is imported into the deck first (step 4 of "Making a new deck"); do not use web images of unknown origin; generated illustrations are only decorative and never pass themselves off as a real product, person or data.
- Photos use `object-fit:cover` to fill their frame; screenshots and diagrams use `object-fit:contain` on a background that contrasts clearly with them.
- A full-slide background photo is the `<section>`'s first child, pinned to fill the slide (`position:absolute;left:0;top:0;width:1920px;height:1080px`), with the text after it on top; put a translucent color block or card under the text to ensure contrast, and use the same approach throughout the deck.
- To label an image (callouts on a diagram, captions on a photo), put the `<img>` in a `position:relative` `<div>` with a set width and height, and use `<p>` elements pinned inside that `<div>` for the labels; never draw text into the image or put it in SVG `<text>`.
- Simple data charts (a few bars, one trend) can use `<div>` bars and inline `<svg>` lines; when there are many data points or precision matters, use a table rather than a hand-drawn approximation. Mark units and sources on the chart.
- Bars stand on the same baseline: put them in a fixed-height track with `display:flex;align-items:flex-end`, compute each bar's `height` with one scale for the whole slide, write the value on top of the bar and the category below the track; with several groups of bars on a slide, use the same track height and scale.
- Draw flows and relationships with `<x-shape>` and `<x-connector>`, with no more than seven or eight nodes; split anything more complex across several slides that build up step by step. Place the boxes first, then connect them: arrange boxes on a grid with uniform column and row spacing, make boxes of the same kind the same size, keep at least 32px between boxes, and make each box wide enough for its longest word; connect from the midpoint of one box edge to the midpoint of another, with straight lines within a row or column and `hv` or `vh` otherwise; pin line labels at least 8px from the line, never on top of it.

## 7. Rhythm and animation

- The cover, section slides and key-line slides use a dark or accent background, content slides a light one, so changing slides has some rise and fall.
- Use one transition across the deck (`fade` is safest); section slides can use a different one.
- Use elements appearing one by one (`data-build-in`) only where the presenter needs to reveal things step by step, no more than three or four steps per slide; not in decks sent out to be read.
- Speaker notes (`<aside>`) hold what the presenter says that is not on the slide: transitions, the reasons behind numbers, the one point to stress. For a deck presented on stage, write them on every slide; for a deck sent out to be read, don't; the slides must explain themselves.
