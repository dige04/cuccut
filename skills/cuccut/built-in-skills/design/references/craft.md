# Designing well: the full version

SKILL.md has the short rules; here are the reasons and details behind them. Read it when the user disputes a design decision, or for the specific section a piece of work needs: landing page structure, wireframe rounds, phone prototypes (print: print.md). Cross-family content rules are at the end; the bundled brand kit is described in format.md.

## Designing well (about craft, not format)

The general content rules at the end of this file (no filler content, ask before adding material, targeted changes touch only that spot, follow the visual vocabulary of an existing design, AI slop clichés, rules on copyrighted designs) apply in full to designs. What follows is specific to design itself.

### Settle the aesthetic with the user, not for the user

When the user gives no aesthetic, references or design system, get their input before settling it: ask them, or draw 2–4 genuinely different low-fidelity direction artboards they can **see**, rather than picking an aesthetic yourself (that is how slop happens). A concrete subject, asset or brand **is** input; when no one can be asked, settle on a direction you can name and say it, rather than ending with a question. Once a decision is made, it stands. Then settle a small system:

- A font pairing: Google Fonts can load in the artifact (put a `fonts.googleapis.com/css2?family=…&display=swap` `<link>` in `<helmet>`; no other webfont host works); 1–3 families, each with a system fallback of similar metrics (that is what shows while the font loads and wherever the font cannot be embedded; PNG/PDF exports embed linked Google Fonts).
- Foreground/background: one temperature (warm, cool, neutral); whites and blacks carry a subtle tint (white at a saturation below 0.02).
- Accents: 0–2, in oklch, with the same chroma and lightness and different hues. Prefer brand or design system colors; when they are too limiting, derive harmonious oklch colors from them rather than inventing new ones.

### When there is no brand or design system constraint

When the work is **not** constrained by an existing brand or design system, use this guidance and commit to a **bold** aesthetic direction before building:

- **Purpose**: what problem does this design solve? Who uses it?
- **Tone**: pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxurious/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, and so on. Use these for inspiration, but design a piece that is true to the chosen direction.
- **Differentiation**: what makes it **unforgettable**? What is the one thing people will remember?

Bold maximalism and refined minimalism both work; what matters is intention, not intensity. Then execute precisely:

- **Typography**: choose beautiful, distinctive, interesting fonts. Avoid generic fonts like Arial and Inter; choose ones with character and personality. Pair a distinctive display font with a refined body font.
- **Color and theme**: commit to one coherent aesthetic. A dominant color with sharp accents beats a timid, evenly distributed palette.
- **Motion**: when the design animates (CSS in the artboard), concentrate it on high-impact moments: one well-orchestrated reveal delights more than scattered micro-interactions.
- **Spatial composition**: unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space **or** controlled density.
- **Backgrounds and visual detail**: create atmosphere and depth rather than defaulting to solid colors: gradient meshes, noise textures, geometric patterns, layered transparency, dramatic shadows, decorative borders, grain overlays.

Vary between light and dark themes, different fonts and different aesthetics, and **never** converge on the same choices across generations. Match implementation complexity to the aesthetic vision: maximalist designs need elaborate effects; minimalist designs need restraint, precision and careful attention to spacing and subtle details.

### Anthropic-branded work

Use Ivory #FAF9F5 for the background, Slate #141413 for text and Clay #D97757 as the accent, with serif display type and sans-serif body text (the exact font stacks are on the brand colors and typography pages). When the design carries the Claude or Anthropic marks: the Claude Spark appears only once per surface, never rotated, distorted or put in a lockup; the Claude logo is dark on light and light on dark, with clearspace and its original aspect ratio; the Claude and Anthropic marks appear one after the other, never combined.

### High-fidelity mockups are grounded in context

Good high-fidelity design does not start from scratch; it is grounded in existing design context: the user's codebase or repository, brand assets, screenshots of the existing product, an attached design system. Take the time to get this context before designing, and ask the user for it if you cannot find it. Mocking up a whole product from scratch is the **last resort** and produces poor design. State your assumptions, context and design thinking early, and show the user something as soon as there is something they can react to.

When you lack an icon, asset or component, draw a placeholder: in high-fidelity design, a placeholder is better than a botched version of the real thing.

### Variations and alternatives on the canvas

A multi-artboard design exists for exploring alternatives; use it deliberately:

- While directional decisions are still open (overall direction, hero layout, font pairing, color approach, density), settle them **before** building the full deliverable. Offer 2–4 genuinely different candidates, each exploring a dimension you can name ("Warm editorial" vs "Dense data-first"): five shades of the same aesthetic are no choice at all. The fidelity needed to decide is not the fidelity of the deliverable: low-fidelity sketch artboards are enough to pick a direction.
- In your reply (not on the artboards), give each alternative an honest motivation and its main trade-off: a set of alternatives where only your favorite has an advocate is a rigged vote.
- Keep alternatives' names stable: once an artboard is called "Option B" or "Warm editorial", that is its identity; never renumber or rename alternatives between rounds.
- Once the direction is set and the user wants variations they can keep, give at least 3 across several dimensions: both by-the-book designs that fit existing patterns and novel interactions, layouts, metaphors and visual styles; recombine the brand's visual DNA (scale, fill, texture, rhythm, layering, type treatment). The goal is atomic variations the user can mix and match, not the one perfect option.
- In early exploration draw wireframes: breadth over polish, 3–5 different takes per idea, simple shapes, placeholder text, minimal color: sketchy, low fidelity, focused on structure and flow.

### Layouts that survive direct drag edits

Strongly prefer flex/grid with `gap` over inline flow. Lay out groups of siblings (buttons, chips, icons, cards, nav items, toolbars) with `display: flex`/`grid` plus `gap:`, rather than inline siblings separated by whitespace in the source or per-element margins: gap spacing survives direct-manipulation edits (drag to reorder, delete, duplicate, and the editor's drag-out and wrap-in-flex tools), whitespace text nodes do not. Inline flow is for running text, with the occasional `<a>`/`<strong>`/`<em>` in a sentence, not for laying out UI elements. Lean on modern CSS: `text-wrap: pretty`, CSS grid and other advanced effects are your friends.

### The right scale

In generated **mockup** content (buttons and list rows on a phone-screen artboard; not the appifact editor's own chrome, which has its own rules), hit targets should never be smaller than 44px. Body text on print artboards is at least 12pt; text in any design should be sized for its real viewing distance.

### Accessible as drawn

Even in static mockups, draw controls with real elements: `<button>`, `<a href>`, and `<input>` paired with `<label>`. A div or span with `role` or `onClick` looks the same, but Tab skips it and screen readers have nothing to read. Icon-only buttons get `aria-label`. Text contrast against what is behind it is at least 4.5:1 (3:1 from 24px). The usual failures are caption grays and colored fills under white text: darken both. Colors that must be told apart also differ in lightness, not only hue; prefer blue/orange over red/green.

### Landing pages and marketing artboards

Build to the structure of a marketing page: a hero that says in one sentence what is on offer, with a clear call to action; proof visitors can trust (testimonials, customer logos, numbers: from the user's material, or clearly marked placeholders); benefit sections that answer visitors' real concerns rather than listing features. One primary action per page, repeated further down, rather than three competing buttons.

For a landing page, the copy is the product. Write specific copy grounded in what the user told you: their product, their customers, their voice. Never lorem ipsum, never "Welcome to our website", never interchangeable marketing boilerplate that fits any company. When real information is missing (prices, dates, addresses), put in a clearly marked placeholder such as [YOUR PRICE] for the user to fill; do not make it up.

A landing page is a **PAGE**, not a fixed-size artboard: its canvas.json entry has `"expand": "fill"` and its root is fluid (no px width on the root; a `max-width` container with side padding, %/rem/fr, grids that collapse to one column on phones), so in the full-window view it lays out at the window width (on the canvas, at `w`). Height: on the canvas `100vh` is the frame's `h`, so `vh` is only for a root that fills the whole screen (a dashboard or web app shell); sections followed by more content (such as a hero) use a `px`/`rem` `min-height`, never `vh`; never use `%` for the root's height: when `$preview` is declared, its parent has no set height and `height: 100%` collapses to the content height. The frame's `w`/`h` (and `$preview`) are only its size on the canvas: set `h` to the page's height at width `w`, or the canvas clips it (better too tall than clipped). An inline `repeat(N, minmax(0, 1fr))` keeps N columns at any width, so page grids use `repeat(auto-fit, minmax(min(<min>px, 100%), 1fr))`, with `<min>` at most one column's width at width `w` (counting gaps); `min()` lets the single column on phones be narrower than `<min>` instead of overflowing. The same goes for dashboards, web app screens and scrolling explainers. Fixed-size roots are only for fixed formats: device mockups, posters, print (including memos and reports: `print.md`), social media images. Design for phone width as you write: no ugly title breaks, no squashed grids, no text too small to read.

### Print craft

Posters, flyers, brochures, memos, reports, anything delivered as a PDF: read `print.md` (right next to this file) before drawing the first artboard.

### Phone prototypes

Do not draw fake chrome: **no** fake iOS status bar (the "9:41 · battery · Wi-Fi" strip) or fake virtual keyboard. On a real phone the real status bar and keyboard render over your layout: a drawn fake looks doubled and amateurish. Leave that space alone. The same goes for device-frame artboards on desktop: no fake status bar inside the phone rectangle.

### Recreating an existing interface

When the user asks you to recreate an interface whose source you can access (a repository checkout, pasted files, an attached design system), work from the real source rather than from your training-data memory of the app: look at what is there first, read the components and styles, and copy the assets the page actually loads (icons, fonts, images, stylesheets; not component source meant only for a bundler). Copy exact values (padding, corner radii, font sizes, line heights) from the source; never round them or snap them to a 4/8-px grid or framework defaults. Claude is better at recreating and editing interfaces from code and design context than from screenshots: when the source is available, use screenshots only as a high-level reference. When you cannot read the source, stop and say so rather than inventing from memory. (Whether to recreate at all is governed by the shared rule on copyrighted designs.)

## Content and design rules shared by all appifact families

<!-- The block between the shared:* markers below is generated from
skills/_shared/content-design.md by scripts/inline-shared.ts — edit the
fragment and re-run it; hand edits here fail scripts/shared-inline.test.ts. -->

<!-- shared:content-design -->
These rules target the **content** written into an appifact (slides, artboards, dashboards, preset cards and rows), not its chrome (kit, toolbars, document mechanics). They apply to every family (each family's skill adds its own craft on top), and none of them changes the kit's rules.

- **Do not add filler content.** Never pad a design with placeholder text, fake sections or informational material just to fill space. Every element should earn its place. A section that looks empty is a design problem to solve with layout and composition, not with invented content. For every "yes" there are a thousand "no"s. Avoid "data slop": useless numbers, icons or stats. Less is more; lean minimal.
- **Ask before adding material.** When you think more sections, pages, copy or content would improve the design, ask the user first rather than adding it on your own. The user knows their audience and goals better than you.
- **Targeted changes touch only that spot.** When the user asks for a small, targeted change (a piece of text, a color, an element), change **only** that: leave all other layout, spacing, margins, fonts, sizes, positions, colors and content exactly as they are; do not redesign or "improve" parts you were not asked to touch. Requests to redesign, take a new direction or start over are different: then make the big change they asked for. When you think a broader change would help a small request, finish what they asked first, then **suggest** the rest, rather than doing it unasked.
- **Follow the visual vocabulary of an existing design.** When adding to an existing interface or document, first understand its visual vocabulary, then follow it: match the copywriting style, palette, tone, hover/click states, animation style, shadow + card + layout patterns, density, and so on.
- **Avoid AI slop clichés:** including but not limited to: overused gradient backgrounds, emoji (unless clearly part of the brand), rounded containers with a left-border accent color, and overused font families (Inter, Roboto, Arial, Fraunces). Emoji in content: only when the brand or design system uses them. (Appifact chrome is stricter: never use emoji as UI glyphs, with no exceptions.)
- **Recreate from source, not from memory or screenshots.** When asked to recreate an interface or design whose source you can access (a repository, pasted files, an attached design system), read the real source and work from it rather than from your training-data memory of the app: read the components and styles, copy the assets the design actually uses, and copy exact values (padding, corner radii, font sizes, line heights) rather than rounding or snapping to a 4/8-px grid or framework defaults. Claude is better at recreating interfaces from code and design context than from screenshots; when the source is available, use screenshots only as a high-level reference.
- **Do not recreate copyrighted designs.** When asked to recreate a company's distinctive UI patterns, proprietary command structure or branded visual elements, you must decline unless the user's email domain shows they work at that company. Instead, understand what the user is trying to make and help them create an original design while respecting intellectual property. (CucCut sessions have no account email domain signal, so this depends on the user telling you where they work; when unclear, ask.)
<!-- /shared:content-design -->
