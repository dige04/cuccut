# Print design: posters, flyers, brochures, documents, anything exported as PDF

Print work is exported via Export PDF and comes in two forms. Decide which **before** making the first artboard; when the request does not say and someone can answer, ask in plain words ("Is each page designed on its own, or does the text flow onto pages automatically? What size?"); with no one to ask: documents flow, everything else uses fixed pages, on Letter/A4 paper.

- **Fixed pages** (`print` omitted or `"fixed"`): each artboard is exactly **one** PDF page, the size of its frame. Posters, flyers, certificates, résumés, the panels of a brochure, one-page overviews: any page designed as a layout, and any request that states a page count.
- **Flow** (`"print": "flow"` + `"paper": "letter"|"a4"`): **one** artboard of continuous content, paginated at export. Reports, memos, letters, papers, guides.

(`print`, `paper`, `w`, `h` are the artboard's fields in canvas.json; in a design created by this type, they are the keys of the same name in its `boards` entry in `<canvas>/canvas.json`.)

## Paper and units (CSS px, at 96 px/in)
- Fixed pages: the PDF page is the frame converted at this ratio; flow: the paper size.
- Letter 816×1056 · A4 794×1123 · landscape = the two swapped (fixed pages only).
  Letter for North American readers, A4 for readers who clearly use metric; unsure → Letter.
- Fixed pages only: Legal 816×1344 · Tabloid 1056×1632 · A5 559×794 ·
  A3 1123×1587 · a poster at a size the user **gave** = inches × 96 (18×24in → 1728×2304; each side ≤ 8000). No size given → design on Letter/A4; never invent a paper size.
- 1in = 96px · 1pt = 4/3px (12pt = 16px, 9pt = 12px) · 0.75in = 72px ·
  1mm ≈ 3.78px. Write in px; think in pt and inches. Never use vh/vw or window percentages: they follow the viewport, which the editor resizes, not the paper.

## Fixed pages
- The root is fixed at the frame's `w`×`h` (and so is `$preview`); it **fills** the page; content past the edges is clipped in the PDF and never moves to the next page: plan the heights before writing.
- Pages are full-bleed: backgrounds can run to the edge, content cannot: keep ≥40px clear inside every edge, and 72px (0.75in) around running text.
- Multi-page work is **a set** of artboards, one per page, in reading order (left → right, then the next row) on one page of the design, with nothing else on that page; "All artboards (.pdf)" combines all artboards on that page, in that order, into one file.
- Page numbers, headers, letterheads on every sheet: draw them on every artboard. A double-sided flyer = 2 artboards. A trifold = 2 artboards of 3 panels each: the outside = inner flap · back · **cover** (rightmost); the inside = one spread read left → right. Write it in the order the reader unfolds it (the cover makes the promise, the inside delivers it in three beats, the back gives the specifics and contact details).

## Flow documents
- `w` is 816 for `paper` `"letter"` and 794 for `"a4"`; portrait only. The root's `width` = `w`, with **no** fixed height (a print document has a fixed px width and content-driven height; a PAGE has no px width at all) and no inner scroll containers; the frame's `h` = the content's height, capped at 8000 (longer content still exports in full; the canvas shows only the first 8000px).
- You set the margins: 72px (0.75in) padding around the root, and that padding is the printed margin. At each page break, export adds only ≈53px (5% of a page) below the cut and above the next page's content, filled with the `<body>`/`<html>` background: set the paper color there, not on inner boxes.
- The exporter decides where pages break, not CSS: it cuts **between** lines of text and never through an `<img>`/`<svg>` (put photos in `<img>`, never `background-image`: that gets cut); nothing else stays whole: a bordered box, table or card can be split between any two of its lines. `break-before/inside`, `orphans`/`widows`, `@page` and repeated `<thead>` have no effect here, and you cannot force a page break. Keep every figure + caption well under a page; a caption can still land on the next page, and images taller than ≈950px get cut at the page end. When you care where things split or need to force a new page, make a set of fixed pages instead.
- Running text in **one** column only: CSS `columns` and side-by-side text columns run the full height of the document and are then cut across pages: use them only in blocks shorter than a page.
- Nothing repeats per page (no headers, footers or page numbers); no `position: fixed/sticky`; ≤100 pages per artboard.

## Text, tables, ink
- A document opens with its own `<h1>` (no separate masthead), then a clear h2/h3 hierarchy; body 16px (12pt), line height 1.5–1.65, measure 60–75 characters; captions and footnotes ≥12px (9pt), never smaller. Headings use `text-wrap: balance`, body text `pretty`.
- Tables: one header row, rules ≥1px (thinner hairlines vanish on paper), numbers right-aligned; figures and code blocks get a one-line caption.
- Ink: near-black body text on light paper; no large dark backgrounds; gray text no lighter than #767676; strokes ≥1px; it must still read when converted to grayscale.
- A flyer is read from across a room in three seconds: **one** dominant line (≤6 words, 80px/60pt+), everything else clearly subordinate; the five Ws (what, when, where, how much, one way to act: a short URL or QR code, a phone number, an optional row of dashed tear-off tabs) grouped tightly together, not scattered through paragraphs; prefer flat color blocks and vector graphics over photos and gradients; cut copy until the hierarchy is obvious at a glance.
